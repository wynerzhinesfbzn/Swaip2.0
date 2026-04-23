import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackHandler } from './backHandler';

/* ─── Audio ───────────────────────────────────────────────────── */
let _audioCtx: AudioContext | null = null;
function getAC() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return _audioCtx;
}
function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.22) {
  try {
    const ctx = getAC();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch {}
}
const sfx = {
  click: () => tone(440, 0.05, 'square', 0.12),
  good:  () => { tone(523, 0.1); setTimeout(() => tone(659, 0.1), 90); setTimeout(() => tone(784, 0.18), 180); },
  bad:   () => tone(160, 0.35, 'sawtooth', 0.1),
  win:   () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22), i * 110)),
  move:  () => tone(320, 0.04, 'square', 0.08),
  hit:   () => tone(180, 0.09, 'square', 0.18),
  pop:   () => tone(640, 0.06, 'sine', 0.16),
  drop:  () => tone(140, 0.12, 'sine', 0.14),
  beep:  (n: number) => tone(220 + n * 90, 0.18, 'sine', 0.28),
};

/* ─── Game Metadata ───────────────────────────────────────────── */
interface GameMeta {
  id: string;
  name: string;
  emoji: string;
  color: string;
  tag: string;
  desc: string;
  instructions: string;
  multiplayer?: boolean;
}
const GAMES: GameMeta[] = [
  { id:'snake',       name:'Змейка',           emoji:'🐍', color:'#22c55e', tag:'Одиночная',    desc:'Управляй змейкой и ешь яблоки',
    instructions:'Нажимай стрелки или кнопки на экране, чтобы управлять змейкой. Съешь яблоко — вырастешь. Не врезайся в стены и в себя!' },
  { id:'tetris',      name:'Тетрис',           emoji:'🧱', color:'#3b82f6', tag:'Одиночная',    desc:'Складывай фигуры без пробелов',
    instructions:'Фигуры падают сверху — укладывай их без пустот. Заполненная линия исчезает. Стрелки: ←→ двигать, ↓ ускорить, ↑ повернуть.' },
  { id:'g2048',       name:'2048',             emoji:'🔢', color:'#f59e0b', tag:'Одиночная',    desc:'Складывай плитки до 2048',
    instructions:'Смахивай влево/вправо/вверх/вниз. Одинаковые плитки сливаются. Цель — получить плитку 2048!' },
  { id:'tictactoe',   name:'Крестики-нолики',  emoji:'❌', color:'#ec4899', tag:'Vs AI',        desc:'Три в ряд — игра с компьютером',
    instructions:'Ты играешь крестиками (❌), компьютер — ноликами (⭕). Нажми на свободную клетку. Поставь три в ряд — победишь!' },
  { id:'minesweeper', name:'Сапёр',            emoji:'💣', color:'#ef4444', tag:'Одиночная',    desc:'Найди все мины, не подорвавшись',
    instructions:'Нажми на клетку, чтобы открыть. Цифра показывает сколько мин рядом. Долгое нажатие ставит флажок 🚩. Открой все безопасные клетки!' },
  { id:'memory',      name:'Мемо',             emoji:'🃏', color:'#8b5cf6', tag:'Одиночная',    desc:'Найди все пары карточек',
    instructions:'Переверни две карточки. Если они одинаковые — они останутся открытыми. Найди все 8 пар за как можно меньше ходов!' },
  { id:'hangman',     name:'Виселица',         emoji:'🎯', color:'#06b6d4', tag:'Одиночная',    desc:'Угадай слово по буквам',
    instructions:'Компьютер загадал русское слово. Нажимай буквы, чтобы угадать. 6 ошибок — и игра окончена. Угадай слово целиком!' },
  { id:'puzzle15',    name:'Пятнашки',         emoji:'🔵', color:'#0ea5e9', tag:'Одиночная',    desc:'Расставь числа по порядку',
    instructions:'Кликни на плитку рядом с пустым местом, чтобы передвинуть её. Цель — расставить числа от 1 до 15 по порядку!' },
  { id:'bullscows',   name:'Быки и коровы',    emoji:'🐮', color:'#d97706', tag:'Одиночная',    desc:'Угадай 4-значное число',
    instructions:'Компьютер загадал 4-значное число без повторяющихся цифр. Вводи свои варианты. Бык = правильная цифра на правильном месте. Корова = правильная цифра не на том месте.' },
  { id:'pong',        name:'Пинг-понг',        emoji:'🏓', color:'#10b981', tag:'Vs AI',        desc:'Теннис против компьютера',
    instructions:'Двигай ракетку мышью или пальцем по экрану. Не дай мячику улететь за твою сторону! У кого первого наберётся 7 очков — победитель.' },
  { id:'math',        name:'Арифметика',       emoji:'🧮', color:'#f97316', tag:'Одиночная',    desc:'Реши как можно больше примеров',
    instructions:'Реши пример и введи ответ. У тебя 60 секунд. Правильный ответ = +10 очков. Неправильный = -5. Побей свой рекорд!' },
  { id:'sudoku',      name:'Судоку',           emoji:'🧩', color:'#6366f1', tag:'Одиночная',    desc:'Заполни сетку 9×9 цифрами',
    instructions:'Каждая строка, столбец и квадрат 3×3 должны содержать цифры 1-9 без повторений. Нажми на пустую клетку и введи цифру.' },
  { id:'arkanoid',    name:'Арканоид',         emoji:'🏹', color:'#dc2626', tag:'Одиночная',    desc:'Разбей все кирпичики мячом',
    instructions:'Двигай ракетку мышью или пальцем. Не дай мячику упасть. Разбей все кирпичики, чтобы перейти на следующий уровень!' },
  { id:'simon',       name:'Саймон',           emoji:'🎵', color:'#7c3aed', tag:'Одиночная',    desc:'Повтори цветовую последовательность',
    instructions:'Запомни последовательность, которую показывает компьютер, и повтори её нажатием кнопок. Каждый раунд добавляется новый цвет!' },
  { id:'wordscramble',name:'Анаграммы',        emoji:'🔤', color:'#0891b2', tag:'Одиночная',    desc:'Угадай слово из перемешанных букв',
    instructions:'Буквы слова перемешаны — угадай исходное русское слово и введи его. 3 подсказки — но они уменьшают очки!' },
  { id:'lightout',    name:'Лампочки',         emoji:'💡', color:'#ca8a04', tag:'Одиночная',    desc:'Выключи все лампочки',
    instructions:'Нажми на лампочку — она и все соседние переключаются. Цель — выключить все лампочки на поле 5×5. Думай стратегически!' },
  { id:'battleship',  name:'Морской бой',      emoji:'🚢', color:'#1d4ed8', tag:'Мультиплеер', desc:'Потопи флот противника',
    instructions:'Доступно только в чате! Открой любой чат и нажми 🎮, чтобы вызвать друга на Морской бой. Стреляй по очереди, топи корабли!',  multiplayer:true },
  { id:'chess',       name:'Шахматы',          emoji:'♟️', color:'#374151', tag:'Мультиплеер', desc:'Классические шахматы с другом',
    instructions:'Доступно только в чате! Открой любой чат и нажми 🎮, чтобы сыграть в шахматы. Белые ходят первыми — пожелаем удачи!', multiplayer:true },
  { id:'checkers',    name:'Шашки',            emoji:'⚫', color:'#4b5563', tag:'Мультиплеер', desc:'Русские шашки против друга',
    instructions:'Доступно только в чате! Открой любой чат и нажми 🎮. Шашки по русским правилам — обязательное взятие, дамки ходят далеко!', multiplayer:true },
  { id:'durak',       name:'Дурак',            emoji:'🎴', color:'#7f1d1d', tag:'Мультиплеер', desc:'Карточная игра до 6 игроков',
    instructions:'Доступно в чате! Открой личный чат или группу и нажми 🎮 → Дурак. До 6 игроков в групповом чате. Избавься от карт — и не будь дураком!', multiplayer:true },
];

/* ─── Shared UI helpers ───────────────────────────────────────── */
const GameBtn = ({ children, onClick, color = '#6366f1', disabled = false, size = 'md' }:
  { children: React.ReactNode; onClick?: () => void; color?: string; disabled?: boolean; size?: 'sm'|'md'|'lg' }) => {
  const pad = size === 'sm' ? '6px 14px' : size === 'lg' ? '14px 28px' : '10px 22px';
  const fs = size === 'sm' ? 12 : size === 'lg' ? 16 : 14;
  return (
    <motion.button whileTap={disabled ? {} : { scale: 0.92 }}
      onClick={disabled ? undefined : onClick}
      style={{ background: disabled ? 'rgba(255,255,255,0.08)' : color, color: '#fff', border: 'none',
        padding: pad, borderRadius: 10, fontSize: fs, fontWeight: 800, cursor: disabled ? 'not-allowed' :
        'pointer', opacity: disabled ? 0.45 : 1, fontFamily: '"Montserrat",sans-serif' }}>
      {children}
    </motion.button>
  );
};
const ScoreBox = ({ label, value, color = '#a78bfa' }:
  { label: string; value: string | number; color?: string }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
    <div style={{ fontSize: 22, fontWeight: 900, color }}>{value}</div>
  </div>
);

/* ═══════════════════════════════════════════════════════════════
   SNAKE
════════════════════════════════════════════════════════════════ */
function SnakeGame() {
  const COLS = 20, ROWS = 20, CELL = 16;
  type Dir = [number, number];
  const [snake, setSnake] = useState([[10, 10], [10, 11]]);
  const [food, setFood] = useState([5, 5]);
  const [dir, setDir] = useState<Dir>([0, -1]);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem('snake_best') || 0));
  const [status, setStatus] = useState<'idle' | 'running' | 'over'>('idle');
  const dirRef = useRef<Dir>([0, -1]);
  const snakeRef = useRef([[10, 10], [10, 11]]);
  const foodRef = useRef([5, 5]);
  const scoreRef = useRef(0);
  const ivRef = useRef<ReturnType<typeof setInterval>>();

  const rndFood = (s: number[][]) => {
    let f: number[];
    do { f = [Math.floor(Math.random() * ROWS), Math.floor(Math.random() * COLS)]; }
    while (s.some(([r, c]) => r === f[0] && c === f[1]));
    return f;
  };

  const startGame = () => {
    clearInterval(ivRef.current);
    const initSnake = [[10, 10], [10, 11]];
    const initFood = rndFood(initSnake);
    dirRef.current = [0, -1]; snakeRef.current = initSnake; foodRef.current = initFood; scoreRef.current = 0;
    setSnake(initSnake); setFood(initFood); setDir([0, -1]); setScore(0); setStatus('running');
    ivRef.current = setInterval(() => {
      const [dr, dc] = dirRef.current;
      const [hr, hc] = snakeRef.current[0];
      const nHead = [hr + dr, hc + dc];
      if (nHead[0] < 0 || nHead[0] >= ROWS || nHead[1] < 0 || nHead[1] >= COLS ||
          snakeRef.current.some(([r, c]) => r === nHead[0] && c === nHead[1])) {
        clearInterval(ivRef.current);
        sfx.bad();
        const s = scoreRef.current;
        if (s > Number(localStorage.getItem('snake_best') || 0)) { localStorage.setItem('snake_best', String(s)); setBest(s); }
        setStatus('over'); return;
      }
      const ate = nHead[0] === foodRef.current[0] && nHead[1] === foodRef.current[1];
      const newSnake = [nHead, ...snakeRef.current];
      if (!ate) newSnake.pop(); else {
        sfx.pop(); scoreRef.current += 10; setScore(scoreRef.current);
        foodRef.current = rndFood(newSnake);
        setFood([...foodRef.current]);
      }
      snakeRef.current = newSnake; setSnake([...newSnake]);
    }, 120);
  };
  useEffect(() => () => clearInterval(ivRef.current), []);
  const move = (d: Dir) => {
    if (status !== 'running') return;
    const [dr, dc] = dirRef.current;
    if (d[0] === -dr && d[1] === -dc) return;
    dirRef.current = d; setDir(d);
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp')    { e.preventDefault(); move([- 1, 0]); }
      if (e.key === 'ArrowDown')  { e.preventDefault(); move([1, 0]); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); move([0, -1]); }
      if (e.key === 'ArrowRight') { e.preventDefault(); move([0, 1]); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  });
  const snakeSet = new Set(snake.map(([r, c]) => `${r},${c}`));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', gap: 24, marginBottom: 4 }}>
        <ScoreBox label="Очки" value={score} color="#22c55e" />
        <ScoreBox label="Рекорд" value={best} color="#fbbf24" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`, gap: 1,
        background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', padding: 2 }}>
        {Array.from({ length: ROWS * COLS }, (_, i) => {
          const r = Math.floor(i / COLS), c = i % COLS;
          const isHead = snake[0]?.[0] === r && snake[0]?.[1] === c;
          const isSnake = snakeSet.has(`${r},${c}`);
          const isFood = food[0] === r && food[1] === c;
          return <div key={i} style={{ width: CELL, height: CELL, borderRadius: isHead ? 4 : 2,
            background: isFood ? '#ef4444' : isHead ? '#4ade80' : isSnake ? '#22c55e' : 'transparent',
            boxShadow: isFood ? '0 0 6px #ef4444' : isHead ? '0 0 4px #4ade80' : 'none',
            transition: 'background 0.05s' }} />;
        })}
      </div>
      {status !== 'running' && (
        <div style={{ textAlign: 'center' }}>
          {status === 'over' && <div style={{ color: '#ef4444', fontWeight: 800, marginBottom: 8 }}>💀 Конец игры! Счёт: {score}</div>}
          <GameBtn onClick={startGame} color="#22c55e">{status === 'idle' ? '🐍 Начать' : '↩️ Снова'}</GameBtn>
        </div>
      )}
      {status === 'running' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, width: 140 }}>
          {([['', [- 1, 0], '↑'], ['←', [0, -1], ''], ['↓', [1, 0], ''], ['', [0, 1], '↓→']] as any[]).map(() => null)}
          <div />
          <GameBtn size="sm" onClick={() => move([-1, 0])} color="#22c55e">↑</GameBtn>
          <div />
          <GameBtn size="sm" onClick={() => move([0, -1])} color="#22c55e">←</GameBtn>
          <GameBtn size="sm" onClick={() => move([1, 0])} color="#22c55e">↓</GameBtn>
          <GameBtn size="sm" onClick={() => move([0, 1])} color="#22c55e">→</GameBtn>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TETRIS
════════════════════════════════════════════════════════════════ */
function TetrisGame() {
  const W = 10, H = 20;
  const PIECES = [
    { shape: [[1,1,1,1]], color: '#06b6d4' },
    { shape: [[1,1],[1,1]], color: '#fbbf24' },
    { shape: [[1,1,1],[0,1,0]], color: '#a78bfa' },
    { shape: [[1,1,1],[1,0,0]], color: '#f97316' },
    { shape: [[1,1,1],[0,0,1]], color: '#3b82f6' },
    { shape: [[1,1,0],[0,1,1]], color: '#22c55e' },
    { shape: [[0,1,1],[1,1,0]], color: '#ef4444' },
  ];
  const empty = () => Array.from({ length: H }, () => Array(W).fill(null));
  const rndPiece = () => PIECES[Math.floor(Math.random() * PIECES.length)];
  const [board, setBoard] = useState<(string | null)[][]>(empty());
  const [cur, setCur] = useState({ piece: rndPiece(), r: 0, c: 3 });
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [status, setStatus] = useState<'idle' | 'running' | 'over'>('idle');
  const ivRef = useRef<ReturnType<typeof setInterval>>();
  const stRef = useRef({ board: empty(), cur: { piece: rndPiece(), r: 0, c: 3 }, score: 0, lines: 0, running: false });

  const rotate = (shape: number[][]) => shape[0].map((_, i) => shape.map(r => r[i]).reverse());
  const valid = (b: (string | null)[][], shape: number[][], r: number, c: number) =>
    shape.every((row, dr) => row.every((v, dc) => !v || (r + dr >= 0 && r + dr < H && c + dc >= 0 && c + dc < W && !b[r + dr][c + dc])));
  const merge = (b: (string | null)[][], shape: number[][], r: number, c: number, col: string) => {
    const nb = b.map(row => [...row]);
    shape.forEach((row, dr) => row.forEach((v, dc) => { if (v) nb[r + dr][c + dc] = col; }));
    return nb;
  };
  const clearLines = (b: (string | null)[][]) => {
    const kept = b.filter(row => row.some(v => !v));
    const cleared = H - kept.length;
    return { nb: [...Array(cleared).fill(null).map(() => Array(W).fill(null)), ...kept], cleared };
  };

  const tick = useCallback(() => {
    const st = stRef.current;
    const { piece, r, c } = st.cur;
    const nr = r + 1;
    if (valid(st.board, piece.shape, nr, c)) {
      st.cur = { ...st.cur, r: nr };
      setCur({ ...st.cur });
    } else {
      const merged = merge(st.board, piece.shape, r, c, piece.color);
      const { nb, cleared } = clearLines(merged);
      const pts = [0, 100, 300, 500, 800][cleared] ?? 0;
      st.score += pts; st.lines += cleared; st.board = nb;
      if (cleared) sfx.good(); else sfx.drop();
      const np = { piece: rndPiece(), r: 0, c: 3 };
      if (!valid(nb, np.piece.shape, np.r, np.c)) {
        clearInterval(ivRef.current); st.running = false;
        sfx.bad(); setStatus('over'); setBoard(nb);
        return;
      }
      st.cur = np; setCur(np); setBoard([...nb.map(r => [...r])]);
      setScore(st.score); setLines(st.lines);
    }
  }, []);

  const startGame = () => {
    clearInterval(ivRef.current);
    const initBoard = empty(); const initCur = { piece: rndPiece(), r: 0, c: 3 };
    stRef.current = { board: initBoard, cur: initCur, score: 0, lines: 0, running: true };
    setBoard(initBoard); setCur(initCur); setScore(0); setLines(0); setStatus('running');
    ivRef.current = setInterval(tick, 500);
  };
  useEffect(() => () => clearInterval(ivRef.current), []);

  const action = useCallback((type: 'left' | 'right' | 'down' | 'rotate') => {
    if (!stRef.current.running) return;
    const { piece, r, c } = stRef.current.cur;
    sfx.move();
    if (type === 'left'   && valid(stRef.current.board, piece.shape, r, c - 1)) { stRef.current.cur.c--; setCur({ ...stRef.current.cur }); }
    if (type === 'right'  && valid(stRef.current.board, piece.shape, r, c + 1)) { stRef.current.cur.c++; setCur({ ...stRef.current.cur }); }
    if (type === 'down')    tick();
    if (type === 'rotate') {
      const rot = rotate(piece.shape);
      if (valid(stRef.current.board, rot, r, c)) { stRef.current.cur.piece = { ...piece, shape: rot }; setCur({ ...stRef.current.cur }); }
    }
  }, [tick]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); action('left'); }
      if (e.key === 'ArrowRight') { e.preventDefault(); action('right'); }
      if (e.key === 'ArrowDown')  { e.preventDefault(); action('down'); }
      if (e.key === 'ArrowUp')    { e.preventDefault(); action('rotate'); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [action]);

  const displayBoard = board.map(row => [...row]);
  if (status === 'running') {
    const { piece, r, c } = cur;
    piece.shape.forEach((row, dr) => row.forEach((v, dc) => {
      if (v && r + dr >= 0 && r + dr < H && c + dc >= 0 && c + dc < W) displayBoard[r + dr][c + dc] = piece.color;
    }));
  }
  const CELL = 22;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <div style={{ display: 'flex', gap: 24, marginBottom: 4 }}>
        <ScoreBox label="Очки" value={score} color="#3b82f6" />
        <ScoreBox label="Линии" value={lines} color="#a78bfa" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${W}, ${CELL}px)`, gap: 1,
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, padding: 2, background: 'rgba(0,0,0,0.4)' }}>
        {displayBoard.flat().map((col, i) => (
          <div key={i} style={{ width: CELL, height: CELL, borderRadius: 3,
            background: col ?? 'rgba(255,255,255,0.03)', boxShadow: col ? `inset 0 1px 0 rgba(255,255,255,0.3), 0 0 4px ${col}55` : 'none' }} />
        ))}
      </div>
      {status !== 'running' ? (
        <div style={{ textAlign: 'center' }}>
          {status === 'over' && <div style={{ color: '#ef4444', fontWeight: 800, marginBottom: 8 }}>Игра окончена! {score} очков</div>}
          <GameBtn onClick={startGame} color="#3b82f6">{status === 'idle' ? '🧱 Начать' : '↩️ Снова'}</GameBtn>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          <GameBtn size="sm" onClick={() => action('rotate')} color="#3b82f6">↻ Поворот</GameBtn>
          <GameBtn size="sm" onClick={() => action('left')}   color="#6366f1">← Влево</GameBtn>
          <GameBtn size="sm" onClick={() => action('right')}  color="#6366f1">→ Вправо</GameBtn>
          <GameBtn size="sm" onClick={() => action('down')}   color="#8b5cf6">↓ Вниз</GameBtn>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   2048
════════════════════════════════════════════════════════════════ */
function G2048Game() {
  const N = 4;
  const mkGrid = () => { const g = Array.from({ length: N }, () => Array(N).fill(0)); addRnd(g); addRnd(g); return g; };
  function addRnd(g: number[][]) {
    const e: [number, number][] = [];
    g.forEach((r, i) => r.forEach((v, j) => { if (!v) e.push([i, j]); }));
    if (!e.length) return; const [ri, ci] = e[Math.floor(Math.random() * e.length)];
    g[ri][ci] = Math.random() < 0.9 ? 2 : 4;
  }
  const [grid, setGrid] = useState<number[][]>(mkGrid);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(() => Number(localStorage.getItem('g2048_best') || 0));
  const [status, setStatus] = useState<'running' | 'over'>('running');
  const ref = useRef({ grid: grid, score: 0 });

  const slide = (row: number[]) => {
    const f = row.filter(v => v);
    let pts = 0;
    for (let i = 0; i < f.length - 1; i++) if (f[i] === f[i + 1]) { f[i] *= 2; pts += f[i]; f.splice(i + 1, 1); }
    while (f.length < N) f.push(0);
    return { row: f, pts };
  };
  const move = useCallback((d: 'l' | 'r' | 'u' | 'd') => {
    if (status === 'over') return;
    const g = ref.current.grid.map(r => [...r]);
    let pts = 0; let changed = false;
    const process = (rows: number[][]) => rows.map(row => { const { row: nr, pts: p } = slide(row); pts += p; if (nr.join() !== row.join()) changed = true; return nr; });
    if (d === 'l') ref.current.grid = process(g);
    if (d === 'r') ref.current.grid = process(g.map(r => [...r].reverse())).map(r => r.reverse());
    if (d === 'u') { const t = g[0].map((_, c) => g.map(r => r[c])); const nt = process(t); ref.current.grid = g.map((_, r) => nt.map(col => col[r])); }
    if (d === 'd') { const t = g[0].map((_, c) => g.map(r => r[c]).reverse()); const nt = process(t); ref.current.grid = g.map((_, r) => nt.map(col => col[nt[0].length - 1 - r])); }
    if (!changed) return; sfx.pop();
    addRnd(ref.current.grid); ref.current.score += pts;
    const ns = ref.current.score; const nb = Math.max(ns, Number(localStorage.getItem('g2048_best') || 0));
    localStorage.setItem('g2048_best', String(nb)); setBest(nb);
    setScore(ns); setGrid(ref.current.grid.map(r => [...r]));
    const flat = ref.current.grid.flat();
    const canMove = flat.some(v => !v) || ref.current.grid.some((r, i) => r.some((v, j) =>
      (j < N-1 && v === r[j+1]) || (i < N-1 && v === ref.current.grid[i+1][j])));
    if (!canMove) { sfx.bad(); setStatus('over'); }
  }, [status]);

  const restart = () => { const g = mkGrid(); ref.current = { grid: g, score: 0 }; setGrid(g.map(r=>[...r])); setScore(0); setStatus('running'); };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)) e.preventDefault();
      if (e.key === 'ArrowLeft') move('l'); if (e.key === 'ArrowRight') move('r');
      if (e.key === 'ArrowUp') move('u'); if (e.key === 'ArrowDown') move('d');
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [move]);

  const touch = useRef<[number,number] | null>(null);
  const tileColor = (v: number) => {
    const m: Record<number,string> = { 0:'rgba(255,255,255,0.04)', 2:'#eee4da', 4:'#ede0c8', 8:'#f2b179', 16:'#f59563', 32:'#f67c5f', 64:'#f65e3b', 128:'#edcf72', 256:'#edcc61', 512:'#edc850', 1024:'#edc53f', 2048:'#edc22e' };
    return m[v] ?? '#ff6b35';
  };
  const CELL = 68;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ display: 'flex', gap: 24 }}>
        <ScoreBox label="Очки" value={score} color="#f59e0b" /><ScoreBox label="Рекорд" value={best} color="#fbbf24" />
      </div>
      <div onTouchStart={e => { touch.current = [e.touches[0].clientX, e.touches[0].clientY]; }}
        onTouchEnd={e => {
          if (!touch.current) return;
          const dx = e.changedTouches[0].clientX - touch.current[0];
          const dy = e.changedTouches[0].clientY - touch.current[1];
          touch.current = null;
          if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'r' : 'l');
          else move(dy > 0 ? 'd' : 'u');
        }}
        style={{ display: 'grid', gridTemplateColumns: `repeat(${N}, ${CELL}px)`, gap: 6,
          background: '#bbada0', borderRadius: 10, padding: 6 }}>
        {grid.flat().map((v, i) => (
          <div key={i} style={{ width: CELL, height: CELL, borderRadius: 6, background: tileColor(v),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: v >= 1024 ? 18 : v >= 128 ? 22 : 26, fontWeight: 900,
            color: v <= 4 ? '#776e65' : '#f9f6f2', boxShadow: v >= 2048 ? '0 0 12px #fbbf24' : 'none' }}>
            {v || ''}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <GameBtn size="sm" onClick={() => move('l')} color="#f59e0b">←</GameBtn>
        <GameBtn size="sm" onClick={() => move('d')} color="#f59e0b">↓</GameBtn>
        <GameBtn size="sm" onClick={() => move('u')} color="#f59e0b">↑</GameBtn>
        <GameBtn size="sm" onClick={() => move('r')} color="#f59e0b">→</GameBtn>
      </div>
      {status === 'over' && <div style={{ textAlign:'center' }}><div style={{color:'#ef4444',fontWeight:800,marginBottom:8}}>Игра окончена!</div><GameBtn onClick={restart} color="#f59e0b">↩️ Снова</GameBtn></div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TIC-TAC-TOE (vs AI minimax)
════════════════════════════════════════════════════════════════ */
function TicTacToeGame() {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [status, setStatus] = useState<'playing' | 'won' | 'lost' | 'draw'>('playing');
  const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const checkWin = (b: (string|null)[], p: string) => wins.some(([a,c,d]) => b[a]===p&&b[c]===p&&b[d]===p);
  const minimax = (b: (string|null)[], isMax: boolean): number => {
    if (checkWin(b,'O')) return 10; if (checkWin(b,'X')) return -10;
    if (b.every(Boolean)) return 0;
    const moves = b.map((_,i)=>i).filter(i=>!b[i]);
    return isMax
      ? Math.max(...moves.map(i => { const nb=[...b]; nb[i]='O'; return minimax(nb,false); }))
      : Math.min(...moves.map(i => { const nb=[...b]; nb[i]='X'; return minimax(nb,true); }));
  };
  const aiMove = (b: (string|null)[]) => {
    const moves = b.map((_,i)=>i).filter(i=>!b[i]);
    return moves.reduce((best,i) => { const nb=[...b]; nb[i]='O'; return minimax(nb,false) > minimax([...b.map((_,j)=>j===best?'O':b[j])],false) ? i : best; }, moves[0]);
  };
  const click = (i: number) => {
    if (board[i] || status !== 'playing') return;
    sfx.click();
    const nb = [...board]; nb[i] = 'X';
    if (checkWin(nb,'X')) { setBoard(nb); setStatus('won'); sfx.win(); return; }
    if (nb.every(Boolean)) { setBoard(nb); setStatus('draw'); return; }
    const ai = aiMove(nb); nb[ai] = 'O'; sfx.move();
    if (checkWin(nb,'O')) { setBoard(nb); setStatus('lost'); sfx.bad(); return; }
    if (nb.every(Boolean)) { setBoard(nb); setStatus('draw'); return; }
    setBoard(nb);
  };
  const reset = () => { setBoard(Array(9).fill(null)); setStatus('playing'); };
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
      <div style={{ fontSize:14, fontWeight:800, color: status==='won'?'#22c55e':status==='lost'?'#ef4444':status==='draw'?'#fbbf24':'rgba(255,255,255,0.6)' }}>
        {status==='playing'?'Твой ход (❌)':status==='won'?'🎉 Ты победил!':status==='lost'?'😔 Компьютер победил':'🤝 Ничья!'}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,80px)', gap:6 }}>
        {board.map((v,i) => (
          <motion.div key={i} whileTap={!v&&status==='playing'?{scale:0.9}:{}} onClick={()=>click(i)}
            style={{ width:80, height:80, borderRadius:12, background:'rgba(255,255,255,0.06)',
              border:'2px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:36, cursor:!v&&status==='playing'?'pointer':'default',
              color: v==='X'?'#ec4899':'#3b82f6' }}>
            {v}
          </motion.div>
        ))}
      </div>
      {status !== 'playing' && <GameBtn onClick={reset} color="#ec4899">↩️ Снова</GameBtn>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MINESWEEPER
════════════════════════════════════════════════════════════════ */
function MinesweeperGame() {
  const ROWS=9, COLS=9, MINES=10;
  type Cell = { mine:boolean; revealed:boolean; flagged:boolean; adj:number };
  const mkBoard = () => {
    const cells: Cell[] = Array.from({length:ROWS*COLS},()=>({mine:false,revealed:false,flagged:false,adj:0}));
    let placed=0; while(placed<MINES){const i=Math.floor(Math.random()*ROWS*COLS);if(!cells[i].mine){cells[i].mine=true;placed++;}}
    cells.forEach((cell,i)=>{ if(cell.mine) return;
      const r=Math.floor(i/COLS),c=i%COLS;
      const nb=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
      cell.adj=nb.reduce((s,[dr,dc])=>{const nr=r+dr,nc=c+dc;return nr>=0&&nr<ROWS&&nc>=0&&nc<COLS&&cells[nr*COLS+nc].mine?s+1:s;},0);
    }); return cells;
  };
  const [cells, setCells] = useState<Cell[]>(mkBoard);
  const [status, setStatus] = useState<'playing'|'won'|'lost'>('playing');
  const [flags, setFlags] = useState(0);

  const reveal = (idx: number, cs: Cell[]) => {
    if (cs[idx].revealed || cs[idx].flagged) return;
    cs[idx] = {...cs[idx], revealed:true};
    if (!cs[idx].adj && !cs[idx].mine) {
      const r=Math.floor(idx/COLS),c=idx%COLS;
      [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]].forEach(([dr,dc])=>{
        const nr=r+dr,nc=c+dc;if(nr>=0&&nr<ROWS&&nc>=0&&nc<COLS)reveal(nr*COLS+nc,cs);
      });
    }
  };
  const click = (i: number) => {
    if (status!=='playing'||cells[i].revealed||cells[i].flagged) return;
    sfx.click();
    const nc=[...cells.map(c=>({...c}))];
    if (nc[i].mine) { nc.forEach(c=>{if(c.mine)c.revealed=true;}); setCells(nc); setStatus('lost'); sfx.bad(); return; }
    reveal(i,nc);
    const won=nc.every(c=>c.mine||c.revealed);
    setCells(nc); if(won){setStatus('won');sfx.win();}
  };
  const flag = (e: React.MouseEvent, i: number) => {
    e.preventDefault(); if(status!=='playing'||cells[i].revealed) return;
    sfx.move();
    const nc=[...cells.map(c=>({...c}))];
    nc[i]={...nc[i],flagged:!nc[i].flagged};
    setFlags(nc.filter(c=>c.flagged).length); setCells(nc);
  };
  const reset = () => { setCells(mkBoard()); setStatus('playing'); setFlags(0); };
  const CELL=32;
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
      <div style={{display:'flex',gap:20}}>
        <ScoreBox label="Мины" value={`${flags}/${MINES}`} color="#ef4444"/>
        <ScoreBox label="Статус" value={status==='playing'?'😐':status==='won'?'😎':'💀'} color="#fbbf24"/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:`repeat(${COLS},${CELL}px)`,gap:2}}>
        {cells.map((cell,i)=>(
          <motion.div key={i} whileTap={!cell.revealed&&status==='playing'?{scale:0.85}:{}}
            onClick={()=>click(i)} onContextMenu={e=>flag(e,i)}
            style={{width:CELL,height:CELL,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:cell.revealed?12:14,fontWeight:800,cursor:'pointer',userSelect:'none',
              background:cell.revealed?(cell.mine?'#ef4444':'rgba(255,255,255,0.08)'):'rgba(255,255,255,0.12)',
              border:`1px solid ${cell.revealed?'rgba(255,255,255,0.05)':'rgba(255,255,255,0.2)'}`,
              color:['','#3b82f6','#22c55e','#ef4444','#7c3aed','#dc2626','#0891b2','#000','#6b7280'][cell.adj]??'#fff'}}>
            {cell.revealed?(cell.mine?'💣':(cell.adj||'')):cell.flagged?'🚩':''}
          </motion.div>
        ))}
      </div>
      {status!=='playing'&&<div style={{textAlign:'center'}}><div style={{color:status==='won'?'#22c55e':'#ef4444',fontWeight:800,marginBottom:8}}>{status==='won'?'🎉 Все мины найдены!':'💥 Подорвался!'}</div><GameBtn onClick={reset} color="#ef4444">↩️ Снова</GameBtn></div>}
      <div style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>Длинное нажатие = поставить флажок</div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MEMORY (pairs)
════════════════════════════════════════════════════════════════ */
function MemoryGame() {
  const EMOJIS = ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼'];
  const mkCards = () => [...EMOJIS,...EMOJIS].sort(()=>Math.random()-0.5).map((e,i)=>({id:i,emoji:e,flipped:false,matched:false}));
  const [cards, setCards] = useState(mkCards());
  const [sel, setSel] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const checking = useRef(false);
  const flip = (id: number) => {
    if (checking.current||sel.length===2) return;
    const card=cards.find(c=>c.id===id);
    if (!card||card.flipped||card.matched) return;
    sfx.click();
    const ns=[...sel,id];
    const nc=cards.map(c=>c.id===id?{...c,flipped:true}:c);
    setSel(ns); setCards(nc);
    if (ns.length===2) {
      setMoves(m=>m+1);
      const [a,b]=ns.map(i=>nc.find(c=>c.id===i)!);
      checking.current=true;
      setTimeout(()=>{
        if(a.emoji===b.emoji){sfx.good();const fc=nc.map(c=>ns.includes(c.id)?{...c,matched:true}:c);setCards(fc);const w=fc.every(c=>c.matched);if(w){sfx.win();setWon(true);}}
        else{sfx.bad();setCards(nc.map(c=>ns.includes(c.id)?{...c,flipped:false}:c));}
        setSel([]); checking.current=false;
      },800);
    }
  };
  const reset=()=>{setCards(mkCards());setSel([]);setMoves(0);setWon(false);};
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
      <div style={{display:'flex',gap:24}}><ScoreBox label="Ходы" value={moves} color="#8b5cf6"/>{won&&<ScoreBox label="Победа!" value="🎉" color="#22c55e"/>}</div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,64px)',gap:8}}>
        {cards.map(card=>(
          <motion.div key={card.id} whileTap={!card.flipped&&!card.matched?{scale:0.88}:{}}
            animate={{rotateY:card.flipped||card.matched?180:0}} onClick={()=>flip(card.id)}
            style={{width:64,height:64,borderRadius:12,display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:30,cursor:!card.flipped&&!card.matched?'pointer':'default',position:'relative',
              background:card.flipped||card.matched?'rgba(139,92,246,0.3)':'rgba(255,255,255,0.08)',
              border:`2px solid ${card.matched?'#22c55e':card.flipped?'#8b5cf6':'rgba(255,255,255,0.15)'}`,
              transformStyle:'preserve-3d'}}>
            {(card.flipped||card.matched)?card.emoji:'?'}
          </motion.div>
        ))}
      </div>
      {won&&<GameBtn onClick={reset} color="#8b5cf6">↩️ Снова</GameBtn>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   HANGMAN
════════════════════════════════════════════════════════════════ */
const HANGMAN_WORDS = ['ЯБЛОКО','КОМПЬЮТЕР','ПРОГРАММА','ТЕЛЕФОН','МУЗЫКА','РОССИЯ','МОСКВА','ПРИВЕТ','СПАСИБО','СВОБОДА','КОМАНДА','ВОЛШЕБСТВО','ШОКОЛАД','БИБЛИОТЕКА','ПРАЗДНИК','ЖИВОТНОЕ','ПЛАНЕТА','ИСТОРИЯ','КУЛЬТУРА','ПРИРОДА','ИГРУШКА','МОЛОТОК','СЕРДЦЕ','БАБОЧКА','РАДУГА'];
function HangmanGame() {
  const [word, setWord] = useState(() => HANGMAN_WORDS[Math.floor(Math.random()*HANGMAN_WORDS.length)]);
  const [guessed, setGuessed] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<'playing'|'won'|'lost'>('playing');
  const MAX_ERR = 6;
  const errors = [...guessed].filter(l=>!word.includes(l)).length;
  const revealed = word.split('').every(l=>guessed.has(l));
  const guess = (l: string) => {
    if (status!=='playing'||guessed.has(l)) return;
    sfx[word.includes(l)?'good':'bad']();
    const ng=new Set(guessed); ng.add(l); setGuessed(ng);
    const newErr=[...ng].filter(x=>!word.includes(x)).length;
    if ([...word].every(x=>ng.has(x))) { setStatus('won'); sfx.win(); }
    else if (newErr>=MAX_ERR) setStatus('lost');
  };
  const reset = () => { setWord(HANGMAN_WORDS[Math.floor(Math.random()*HANGMAN_WORDS.length)]); setGuessed(new Set()); setStatus('playing'); };
  const PARTS = ['😐','😟','😰','😱','💀','💀','☠️'];
  const RU_KEYBOARD = ['ЙЦУКЕНГШЩЗХЪ','ФЫВАПРОЛДЖЭ','ЯЧСМИТЬБЮ'];
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
      <div style={{fontSize:48}}>{PARTS[errors]}</div>
      <div style={{display:'flex',gap:6,alignItems:'center'}}>
        {Array.from({length:MAX_ERR},(_,i)=>(
          <div key={i} style={{width:16,height:16,borderRadius:'50%',background:i<errors?'#ef4444':'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',transition:'background 0.3s'}}/>
        ))}
        <span style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginLeft:4}}>{MAX_ERR-errors} попыток</span>
      </div>
      <div style={{display:'flex',gap:6,flexWrap:'wrap',justifyContent:'center'}}>
        {word.split('').map((l,i)=>(
          <div key={i} style={{width:28,height:36,borderBottom:'2px solid rgba(255,255,255,0.5)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:900,color:'#fff'}}>
            {guessed.has(l)||status==='lost'?l:''}
          </div>
        ))}
      </div>
      {RU_KEYBOARD.map((row,ri)=>(
        <div key={ri} style={{display:'flex',gap:3,flexWrap:'wrap',justifyContent:'center'}}>
          {row.split('').map(l=>(
            <motion.button key={l} whileTap={!guessed.has(l)&&status==='playing'?{scale:0.85}:{}}
              onClick={()=>guess(l)} disabled={guessed.has(l)||status!=='playing'}
              style={{width:28,height:28,borderRadius:6,border:'none',fontSize:12,fontWeight:700,cursor:'pointer',
                background:guessed.has(l)?(word.includes(l)?'#22c55e':'rgba(255,255,255,0.08)'):'rgba(255,255,255,0.15)',
                color:guessed.has(l)&&!word.includes(l)?'rgba(255,255,255,0.3)':'#fff',fontFamily:'"Montserrat",sans-serif'}}>
              {l}
            </motion.button>
          ))}
        </div>
      ))}
      {status!=='playing'&&<div style={{textAlign:'center'}}><div style={{fontWeight:800,marginBottom:8,color:status==='won'?'#22c55e':'#ef4444'}}>{status==='won'?'🎉 Правильно!':'😢 Слово: '+word}</div><GameBtn onClick={reset} color="#06b6d4">↩️ Снова</GameBtn></div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   15-PUZZLE
════════════════════════════════════════════════════════════════ */
function Puzzle15Game() {
  const mkGrid = () => {
    let arr=Array.from({length:16},(_,i)=>i);
    do{for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}}while(!isSolvable(arr)||isSolved(arr));
    return arr;
  };
  const isSolvable=(a:number[])=>{let inv=0;const f=a.filter(v=>v);for(let i=0;i<f.length;i++)for(let j=i+1;j<f.length;j++)if(f[i]>f[j])inv++;const blank=Math.floor(a.indexOf(0)/4)+1;return(inv+blank)%2===0;};
  const isSolved=(a:number[])=>a.every((v,i)=>v===(i+1)%16);
  const [grid, setGrid] = useState(mkGrid);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const click = (i: number) => {
    if (won) return;
    const blank=grid.indexOf(0);const r=Math.floor(i/4),c=i%4,br=Math.floor(blank/4),bc=blank%4;
    if(!((r===br&&Math.abs(c-bc)===1)||(c===bc&&Math.abs(r-br)===1)))return;
    sfx.move();
    const ng=[...grid];[ng[i],ng[blank]]=[ng[blank],ng[i]];
    setGrid(ng);setMoves(m=>m+1);
    if(isSolved(ng)){setWon(true);sfx.win();}
  };
  const reset=()=>{setGrid(mkGrid());setMoves(0);setWon(false);};
  const CELL=70;
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
      <div style={{display:'flex',gap:24}}><ScoreBox label="Ходы" value={moves} color="#0ea5e9"/>{won&&<ScoreBox label="Победа!" value="🎉" color="#22c55e"/>}</div>
      <div style={{display:'grid',gridTemplateColumns:`repeat(4,${CELL}px)`,gap:4,background:'#1e3a5f',padding:4,borderRadius:10}}>
        {grid.map((v,i)=>(
          <motion.div key={i} whileTap={v&&!won?{scale:0.92}:{}} onClick={()=>click(i)}
            style={{width:CELL,height:CELL,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:22,fontWeight:900,cursor:v?'pointer':'default',
              background:v?`hsl(${(v*23)%360},60%,35%)`:'rgba(0,0,0,0.3)',
              color:'#fff',boxShadow:v?'inset 0 1px 0 rgba(255,255,255,0.2)':'none'}}>
            {v||''}
          </motion.div>
        ))}
      </div>
      <GameBtn onClick={reset} color="#0ea5e9" size="sm">🔀 Перемешать</GameBtn>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   BULLS & COWS
════════════════════════════════════════════════════════════════ */
function BullsCowsGame() {
  const mkSecret = () => { const d=[1,2,3,4,5,6,7,8,9]; for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];} return d.slice(0,4).map(String); };
  const [secret, setSecret] = useState(mkSecret);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<{guess:string,bulls:number,cows:number}[]>([]);
  const [won, setWon] = useState(false);
  const guess = () => {
    const g=input.trim().split('').filter(c=>'0123456789'.includes(c));
    if(g.length!==4||new Set(g).size!==4){sfx.bad();return;}
    sfx.click();
    const bulls=g.filter((d,i)=>d===secret[i]).length;
    const cows=g.filter(d=>secret.includes(d)).length-bulls;
    const nh=[{guess:g.join(''),bulls,cows},...history];
    setHistory(nh);setInput('');
    if(bulls===4){setWon(true);sfx.win();}
  };
  const reset=()=>{setSecret(mkSecret());setHistory([]);setInput('');setWon(false);};
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12,width:'100%'}}>
      <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',textAlign:'center'}}>4-значное число, цифры не повторяются<br/>🐂 Бык = правильная цифра, правильное место<br/>🐄 Корова = правильная цифра, не то место</div>
      {!won&&<div style={{display:'flex',gap:8,alignItems:'center'}}>
        <input value={input} onChange={e=>setInput(e.target.value.slice(0,4))} onKeyDown={e=>e.key==='Enter'&&guess()}
          placeholder="1234" maxLength={4}
          style={{width:80,padding:'8px 12px',borderRadius:10,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.07)',color:'#fff',fontSize:18,fontWeight:900,fontFamily:'"Montserrat",sans-serif',textAlign:'center'}}/>
        <GameBtn onClick={guess} color="#d97706">Проверить</GameBtn>
      </div>}
      <div style={{width:'100%',maxWidth:280,display:'flex',flexDirection:'column',gap:4,maxHeight:250,overflowY:'auto'}}>
        {history.map((h,i)=>(
          <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 12px',background:'rgba(255,255,255,0.05)',borderRadius:8,fontSize:14}}>
            <span style={{fontWeight:900,fontSize:18,letterSpacing:4,color:'#fbbf24'}}>{h.guess}</span>
            <span style={{color:'rgba(255,255,255,0.7)'}}>🐂{h.bulls} 🐄{h.cows}</span>
          </div>
        ))}
      </div>
      {won&&<div style={{textAlign:'center'}}><div style={{color:'#22c55e',fontWeight:800,marginBottom:8}}>🎉 Загаданное число: {secret.join('')}</div><GameBtn onClick={reset} color="#d97706">↩️ Снова</GameBtn></div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PONG (canvas)
════════════════════════════════════════════════════════════════ */
function PongGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const W=300,H=400,PR=6,PH=50,BALL_R=7;
  const stRef = useRef({ px:W/2-30,ax:W/2-30,ball:{x:W/2,y:H/2,vx:2.5,vy:-2.5},ps:0,as:0,running:false });
  const [scores, setScores] = useState({p:0,a:0});
  const [status, setStatus] = useState<'idle'|'running'|'won'|'lost'>('idle');
  const rafRef = useRef<number>();
  const draw = useCallback(() => {
    const cv=canvasRef.current; if(!cv) return;
    const ctx=cv.getContext('2d')!;
    const st=stRef.current;
    ctx.fillStyle='#0a0a1a'; ctx.fillRect(0,0,W,H);
    ctx.setLineDash([6,6]); ctx.strokeStyle='rgba(255,255,255,0.1)'; ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke(); ctx.setLineDash([]);
    const grad=ctx.createLinearGradient(0,0,W,0);
    grad.addColorStop(0,'#3b82f6'); grad.addColorStop(1,'#60a5fa');
    ctx.fillStyle=grad; ctx.roundRect(st.ax,10,60,PR,3); ctx.fill();
    ctx.fillStyle='#22c55e'; ctx.roundRect(st.px,H-10-PR,60,PR,3); ctx.fill();
    ctx.shadowColor='#fff'; ctx.shadowBlur=12;
    ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(st.ball.x,st.ball.y,BALL_R,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur=0;
    ctx.fillStyle='rgba(255,255,255,0.5)'; ctx.font='bold 16px Montserrat';
    ctx.textAlign='center'; ctx.fillText(`${st.as}`,W/2,H/2-12); ctx.fillText(`${st.ps}`,W/2,H/2+24);
  }, []);

  const loop = useCallback(() => {
    const st=stRef.current;
    const b=st.ball;
    b.x+=b.vx; b.y+=b.vy;
    if(b.x<=BALL_R||b.x>=W-BALL_R) { b.vx=-b.vx; sfx.hit(); }
    if(b.y<=10+PR&&b.x>=st.ax&&b.x<=st.ax+60) { b.vy=Math.abs(b.vy); sfx.pop(); b.vx+=(Math.random()-0.5)*0.3; }
    if(b.y>=H-10-PR-BALL_R&&b.x>=st.px&&b.x<=st.px+60) { b.vy=-Math.abs(b.vy); sfx.pop(); }
    if(b.y<0) { st.ps++; setScores({p:st.ps,a:st.as}); sfx.good(); b.x=W/2;b.y=H/2;b.vx=(Math.random()>0.5?1:-1)*2.5;b.vy=2.5; }
    if(b.y>H) { st.as++; setScores({p:st.ps,a:st.as}); sfx.bad(); b.x=W/2;b.y=H/2;b.vx=(Math.random()>0.5?1:-1)*2.5;b.vy=-2.5; }
    if(st.ps>=7||st.as>=7) { setStatus(st.ps>=7?'won':'lost'); sfx[st.ps>=7?'win':'bad'](); st.running=false; draw(); return; }
    const speed=Math.min(1.5+Math.max(st.ps,st.as)*0.2,3);
    st.ax=Math.max(0,Math.min(W-60,b.x-30+((b.x>st.ax+30?1:-1)*speed*1.2)));
    draw(); if(st.running) rafRef.current=requestAnimationFrame(loop);
  }, [draw]);

  const start = () => {
    if(rafRef.current) cancelAnimationFrame(rafRef.current);
    stRef.current={px:W/2-30,ax:W/2-30,ball:{x:W/2,y:H/2,vx:2.5,vy:-2.5},ps:0,as:0,running:true};
    setScores({p:0,a:0}); setStatus('running'); rafRef.current=requestAnimationFrame(loop);
  };
  useEffect(()=>()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);},[]);

  const mouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect=canvasRef.current!.getBoundingClientRect();
    stRef.current.px=Math.max(0,Math.min(W-60,e.clientX-rect.left-30));
  };
  const touchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect=canvasRef.current!.getBoundingClientRect();
    stRef.current.px=Math.max(0,Math.min(W-60,e.touches[0].clientX-rect.left-30));
  };
  useEffect(()=>{ if(status==='idle') draw(); },[draw,status]);
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
      <div style={{display:'flex',gap:24}}><ScoreBox label="Компьютер" value={scores.a} color="#3b82f6"/><ScoreBox label="Ты" value={scores.p} color="#22c55e"/></div>
      <canvas ref={canvasRef} width={W} height={H} onMouseMove={mouseMove} onTouchMove={touchMove}
        style={{borderRadius:12,border:'1px solid rgba(255,255,255,0.1)',cursor:'none',touchAction:'none'}}/>
      {status!=='running'&&<div style={{textAlign:'center'}}>
        {(status==='won'||status==='lost')&&<div style={{fontWeight:800,color:status==='won'?'#22c55e':'#ef4444',marginBottom:8}}>{status==='won'?'🎉 Ты победил!':'😔 Компьютер выиграл'}</div>}
        <GameBtn onClick={start} color="#10b981">{status==='idle'?'🏓 Начать':'↩️ Снова'}</GameBtn>
      </div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MATH QUIZ
════════════════════════════════════════════════════════════════ */
function MathGame() {
  const mkQ=()=>{const ops=['+','-','*'];const op=ops[Math.floor(Math.random()*ops.length)];
    let a=Math.floor(Math.random()*12)+1,b=Math.floor(Math.random()*12)+1;
    if(op==='-'&&b>a)[a,b]=[b,a];
    const ans=op==='+'?a+b:op==='-'?a-b:a*b;
    return{a,b,op,ans};};
  const [q, setQ] = useState(mkQ);
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [time, setTime] = useState(60);
  const [status, setStatus] = useState<'idle'|'running'|'over'>('idle');
  const [correct, setCorrect] = useState(0);
  const ivRef=useRef<ReturnType<typeof setInterval>>();
  const start=()=>{setScore(0);setTime(60);setStatus('running');setCorrect(0);setQ(mkQ());setInput('');
    clearInterval(ivRef.current);ivRef.current=setInterval(()=>setTime(t=>{if(t<=1){clearInterval(ivRef.current);setStatus('over');sfx.bad();return 0;}return t-1;}),1000);};
  useEffect(()=>()=>clearInterval(ivRef.current),[]);
  const submit=()=>{
    if(!input.trim()||status!=='running')return;
    const v=parseInt(input);
    if(v===q.ans){sfx.good();setScore(s=>s+10);setCorrect(c=>c+1);}else{sfx.bad();setScore(s=>Math.max(0,s-5));}
    setInput('');setQ(mkQ());};
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:14}}>
      <div style={{display:'flex',gap:24}}>
        <ScoreBox label="Очки" value={score} color="#f97316"/>
        <ScoreBox label="Время" value={`${time}с`} color={time<=10?'#ef4444':'#fbbf24'}/>
        <ScoreBox label="Правильно" value={correct} color="#22c55e"/>
      </div>
      {status==='running'&&<>
        <div style={{fontSize:36,fontWeight:900,color:'#fff',letterSpacing:2}}>{q.a} {q.op} {q.b} = ?</div>
        <div style={{display:'flex',gap:8}}>
          <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()}
            autoFocus type="number" placeholder="Ответ"
            style={{width:100,padding:'10px',borderRadius:10,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.07)',color:'#fff',fontSize:18,fontWeight:900,fontFamily:'"Montserrat",sans-serif',textAlign:'center'}}/>
          <GameBtn onClick={submit} color="#f97316">✓</GameBtn>
        </div>
      </>}
      {status==='over'&&<div style={{textAlign:'center'}}><div style={{color:'#fbbf24',fontWeight:800,fontSize:16,marginBottom:8}}>Итог: {score} очков, {correct} правильных</div><GameBtn onClick={start} color="#f97316">↩️ Снова</GameBtn></div>}
      {status==='idle'&&<GameBtn onClick={start} color="#f97316" size="lg">🧮 Начать</GameBtn>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SUDOKU
════════════════════════════════════════════════════════════════ */
const SUDOKU_DATA = [
  '530070000600195000098000060800060003400803001700020006060000280000419005000080079',
  '010020300009005001070004520500100040000600000002003006980000050300700600005010000',
  '200080300060070084030500209000105408000000000402706000301007040720040060004010003',
];
function parseSudoku(s:string){return Array.from({length:9},(_,r)=>Array.from({length:9},(_,c)=>s[r*9+c]!=='0'?Number(s[r*9+c]):0));}
function SudokuGame() {
  const [puzzle] = useState(()=>parseSudoku(SUDOKU_DATA[Math.floor(Math.random()*SUDOKU_DATA.length)]));
  const [grid, setGrid] = useState(()=>puzzle.map(r=>[...r]));
  const [sel, setSel] = useState<[number,number]|null>(null);
  const [errors, setErrors] = useState(new Set<string>());
  const [won, setWon] = useState(false);
  const isFixed=(r:number,c:number)=>puzzle[r][c]!==0;
  const place=(n:number)=>{
    if(!sel||isFixed(...sel))return; sfx.click();
    const [r,c]=sel; const ng=grid.map(row=>[...row]);
    ng[r][c]=n;
    const ne=new Set<string>();
    for(let i=0;i<9;i++)for(let j=0;j<9;j++){if(!ng[i][j])continue;
      for(let k=0;k<9;k++){if(k!==j&&ng[i][k]===ng[i][j])ne.add(`${i},${j}`);
        if(k!==i&&ng[k][j]===ng[i][j])ne.add(`${i},${j}`);}
      const br=Math.floor(i/3)*3,bc=Math.floor(j/3)*3;
      for(let dr=0;dr<3;dr++)for(let dc=0;dc<3;dc++){const ri=br+dr,ci=bc+dc;if((ri!==i||ci!==j)&&ng[ri][ci]===ng[i][j])ne.add(`${i},${j}`);}}
    setErrors(ne); setGrid(ng);
    if(!ne.size&&ng.every(row=>row.every(v=>v))){setWon(true);sfx.win();}
  };
  const reset=()=>{setGrid(puzzle.map(r=>[...r]));setErrors(new Set());setWon(false);setSel(null);};
  const CELL=36;
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
      {won&&<div style={{color:'#22c55e',fontWeight:800,fontSize:16}}>🎉 Судоку решено!</div>}
      <div style={{display:'grid',gridTemplateColumns:`repeat(9,${CELL}px)`,gap:1,background:'rgba(99,102,241,0.3)',borderRadius:6,padding:1}}>
        {grid.map((row,r)=>row.map((v,c)=>{
          const fixed=isFixed(r,c),err=errors.has(`${r},${c}`);
          const isSel=sel?.[0]===r&&sel?.[1]===c;
          const samePeer=sel&&(sel[0]===r||sel[1]===c||(Math.floor(sel[0]/3)===Math.floor(r/3)&&Math.floor(sel[1]/3)===Math.floor(c/3)));
          return (<div key={`${r},${c}`} onClick={()=>!fixed&&setSel([r,c])}
            style={{width:CELL,height:CELL,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,fontWeight:fixed?900:700,
              cursor:fixed?'default':'pointer',
              borderRight:c%3===2&&c<8?'2px solid rgba(99,102,241,0.6)':'1px solid rgba(255,255,255,0.05)',
              borderBottom:r%3===2&&r<8?'2px solid rgba(99,102,241,0.6)':'1px solid rgba(255,255,255,0.05)',
              background:isSel?'rgba(99,102,241,0.5)':samePeer?'rgba(99,102,241,0.1)':'transparent',
              color:err?'#ef4444':fixed?'#a78bfa':'#fff'}}>
            {v||''}
          </div>);
        }))}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,42px)',gap:4}}>
        {[1,2,3,4,5,6,7,8,9].map(n=>(<GameBtn key={n} size="sm" onClick={()=>place(n)} color="#6366f1">{n}</GameBtn>))}
        <GameBtn size="sm" onClick={()=>place(0)} color="#374151">✕</GameBtn>
      </div>
      <GameBtn size="sm" onClick={reset} color="#4b5563">↩️ Сброс</GameBtn>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   ARKANOID (canvas)
════════════════════════════════════════════════════════════════ */
function ArkanoidGame() {
  const CW=280,CH=360,PW=60,PH=8,BR=7;
  const mkBricks=()=>Array.from({length:4},(_,r)=>Array.from({length:7},(_,c)=>({x:4+c*38,y:40+r*22,alive:true,color:`hsl(${r*40+c*15},70%,55%)`})));
  const stRef=useRef({px:CW/2-PW/2,ball:{x:CW/2,y:CH-60,vx:2,vy:-2.5},bricks:mkBricks(),score:0,lives:3,running:false,level:1});
  const [ui,setUi]=useState({score:0,lives:3,level:1});
  const [status,setStatus]=useState<'idle'|'running'|'won'|'lost'>('idle');
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const rafRef=useRef<number>();

  const draw=useCallback(()=>{
    const cv=canvasRef.current;if(!cv)return;
    const ctx=cv.getContext('2d')!,st=stRef.current;
    ctx.fillStyle='#05050f';ctx.fillRect(0,0,CW,CH);
    st.bricks.flat().filter(b=>b.alive).forEach(b=>{
      ctx.fillStyle=b.color;ctx.roundRect(b.x,b.y,34,16,4);ctx.fill();
      ctx.fillStyle='rgba(255,255,255,0.25)';ctx.roundRect(b.x,b.y,34,4,4);ctx.fill();});
    const pg=ctx.createLinearGradient(st.px,0,st.px+PW,0);pg.addColorStop(0,'#6366f1');pg.addColorStop(1,'#a78bfa');
    ctx.fillStyle=pg;ctx.roundRect(st.px,CH-20,PW,PH,4);ctx.fill();
    ctx.shadowColor='#a78bfa';ctx.shadowBlur=12;
    ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(st.ball.x,st.ball.y,BR,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
  },[]);

  const loop=useCallback(()=>{
    const st=stRef.current;const b=st.ball;
    b.x+=b.vx;b.y+=b.vy;
    if(b.x<=BR||b.x>=CW-BR)b.vx=-b.vx;
    if(b.y<=BR)b.vy=-b.vy;
    if(b.y>=CH-20-BR&&b.x>=st.px&&b.x<=st.px+PW){
      b.vy=-Math.abs(b.vy);sfx.pop();
      b.vx+=((b.x-(st.px+PW/2))/PW)*2;
      b.vx=Math.max(-4,Math.min(4,b.vx));
    }
    if(b.y>CH){
      st.lives--;sfx.bad();b.x=CW/2;b.y=CH-60;b.vx=(Math.random()>0.5?1:-1)*2;b.vy=-2.5;
      setUi({score:st.score,lives:st.lives,level:st.level});
      if(st.lives<=0){setStatus('lost');st.running=false;draw();return;}
    }
    st.bricks.flat().forEach(bk=>{
      if(!bk.alive)return;
      if(b.x+BR>bk.x&&b.x-BR<bk.x+34&&b.y+BR>bk.y&&b.y-BR<bk.y+16){
        bk.alive=false;sfx.hit();st.score+=10;setUi({score:st.score,lives:st.lives,level:st.level});
        const dx=Math.min(Math.abs(b.x-bk.x),Math.abs(b.x-(bk.x+34)));
        const dy=Math.min(Math.abs(b.y-bk.y),Math.abs(b.y-(bk.y+16)));
        if(dx<dy)b.vx=-b.vx;else b.vy=-b.vy;
      }
    });
    if(st.bricks.flat().every(bk=>!bk.alive)){
      st.level++;st.bricks=mkBricks();b.x=CW/2;b.y=CH-60;
      const spd=2+st.level*0.3;b.vx=(Math.random()>0.5?1:-1)*spd;b.vy=-spd;
      setUi({score:st.score,lives:st.lives,level:st.level});sfx.win();
    }
    draw();if(st.running)rafRef.current=requestAnimationFrame(loop);
  },[draw]);

  const start=()=>{
    if(rafRef.current)cancelAnimationFrame(rafRef.current);
    stRef.current={px:CW/2-PW/2,ball:{x:CW/2,y:CH-60,vx:2,vy:-2.5},bricks:mkBricks(),score:0,lives:3,running:true,level:1};
    setUi({score:0,lives:3,level:1});setStatus('running');rafRef.current=requestAnimationFrame(loop);
  };
  useEffect(()=>()=>{if(rafRef.current)cancelAnimationFrame(rafRef.current);},[]);
  useEffect(()=>{if(status==='idle')draw();},[draw,status]);

  const mouseMove=(e:React.MouseEvent<HTMLCanvasElement>)=>{const r=canvasRef.current!.getBoundingClientRect();stRef.current.px=Math.max(0,Math.min(CW-PW,e.clientX-r.left-PW/2));};
  const touchMove=(e:React.TouchEvent<HTMLCanvasElement>)=>{e.preventDefault();const r=canvasRef.current!.getBoundingClientRect();stRef.current.px=Math.max(0,Math.min(CW-PW,e.touches[0].clientX-r.left-PW/2));};
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}>
      <div style={{display:'flex',gap:16}}><ScoreBox label="Очки" value={ui.score} color="#dc2626"/><ScoreBox label="Жизни" value={'❤️'.repeat(ui.lives)} color="#ef4444"/><ScoreBox label="Уровень" value={ui.level} color="#fbbf24"/></div>
      <canvas ref={canvasRef} width={CW} height={CH} onMouseMove={mouseMove} onTouchMove={touchMove}
        style={{borderRadius:12,border:'1px solid rgba(255,255,255,0.1)',cursor:'none',touchAction:'none'}}/>
      {status!=='running'&&<div style={{textAlign:'center'}}>
        {(status==='won'||status==='lost')&&<div style={{fontWeight:800,color:status==='won'?'#22c55e':'#ef4444',marginBottom:8}}>{status==='won'?'🎉 Победа!':'💀 Все жизни исчерпаны'}</div>}
        <GameBtn onClick={start} color="#dc2626">{status==='idle'?'🏹 Начать':'↩️ Снова'}</GameBtn>
      </div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SIMON SAYS
════════════════════════════════════════════════════════════════ */
function SimonGame() {
  const COLORS=['#ef4444','#22c55e','#3b82f6','#fbbf24'];
  const FREQS=[261,329,392,523];
  const [seq, setSeq] = useState<number[]>([]);
  const [player, setPlayer] = useState<number[]>([]);
  const [active, setActive] = useState<number|null>(null);
  const [status, setStatus] = useState<'idle'|'showing'|'input'|'lost'>('idle');
  const [round, setRound] = useState(0);
  const flash=(i:number,dur=400)=>new Promise<void>(res=>{setActive(i);sfx.beep(i);setTimeout(()=>{setActive(null);setTimeout(res,150);},dur);});
  const showSeq=async(s:number[])=>{
    setStatus('showing');setPlayer([]);
    for(const x of s){await new Promise(r=>setTimeout(r,200));await flash(x);}
    setStatus('input');
  };
  const start=()=>{const s=[Math.floor(Math.random()*4)];setSeq(s);setRound(1);showSeq(s);};
  const press=async(i:number)=>{
    if(status!=='input')return;
    sfx.beep(i);setActive(i);setTimeout(()=>setActive(null),200);
    const np=[...player,i];
    if(np[np.length-1]!==seq[np.length-1]){sfx.bad();setStatus('lost');return;}
    if(np.length===seq.length){
      sfx.good();await new Promise(r=>setTimeout(r,600));
      const ns=[...seq,Math.floor(Math.random()*4)];setSeq(ns);setRound(r=>r+1);showSeq(ns);
    }else setPlayer(np);
  };
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:16}}>
      <div style={{display:'flex',gap:24}}><ScoreBox label="Раунд" value={round} color="#7c3aed"/><ScoreBox label="Шаг" value={`${player.length}/${seq.length}`} color="#a78bfa"/></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,width:240}}>
        {COLORS.map((col,i)=>(
          <motion.div key={i} onClick={()=>press(i)} whileTap={status==='input'?{scale:0.92}:{}}
            animate={{opacity:active===i?1:0.6,boxShadow:active===i?`0 0 24px ${col}`:undefined}}
            style={{width:110,height:100,borderRadius:14,background:active===i?col:`${col}55`,
              border:`3px solid ${col}`,cursor:status==='input'?'pointer':'default',transition:'background 0.1s'}}/>
        ))}
      </div>
      {status==='idle'&&<GameBtn onClick={start} color="#7c3aed" size="lg">🎵 Начать</GameBtn>}
      {status==='showing'&&<div style={{color:'rgba(255,255,255,0.5)',fontSize:13}}>👁 Смотри и запоминай…</div>}
      {status==='input'&&<div style={{color:'#a78bfa',fontSize:13,fontWeight:700}}>👆 Повтори последовательность</div>}
      {status==='lost'&&<div style={{textAlign:'center'}}><div style={{color:'#ef4444',fontWeight:800,marginBottom:8}}>❌ Ошибка! Дошёл до {round} раунда</div><GameBtn onClick={start} color="#7c3aed">↩️ Снова</GameBtn></div>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   WORD SCRAMBLE (Russian anagrams)
════════════════════════════════════════════════════════════════ */
const WORD_LIST = [
  {word:'КОШКА',hint:'Домашнее животное'},
  {word:'ДЕРЕВО',hint:'Растёт в лесу'},
  {word:'МАШИНА',hint:'Едет по дороге'},
  {word:'СОЛНЦЕ',hint:'Светит днём'},
  {word:'ЦВЕТОК',hint:'Красиво пахнет'},
  {word:'РЫБАК',hint:'Ловит рыбу'},
  {word:'КНИГА',hint:'Читают её'},
  {word:'ЗАМОК',hint:'Крепость или на двери'},
  {word:'ОБЛАКО',hint:'На небе'},
  {word:'РАКЕТА',hint:'Летит в космос'},
  {word:'ОРЁЛ',hint:'Птица или монета'},
  {word:'ПЧЕЛА',hint:'Делает мёд'},
  {word:'ШКОЛА',hint:'Учатся там'},
  {word:'КАРЕТА',hint:'Конная повозка'},
  {word:'БЕРЁЗА',hint:'Русское дерево'},
];
function WordScrambleGame() {
  const [idx, setIdx] = useState(()=>Math.floor(Math.random()*WORD_LIST.length));
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [hints, setHints] = useState(0);
  const [showHint, setShowHint] = useState(false);
  const [status, setStatus] = useState<'playing'|'correct'|'wrong'>('playing');
  const scramble=(w:string)=>{const a=[...w];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a.join('')===w?scramble(w):a.join('');};
  const [scrambled] = useState(()=>scramble(WORD_LIST[idx].word));
  const [sc2, setSc2] = useState(scrambled);
  const next=()=>{const ni=(idx+1)%WORD_LIST.length;setIdx(ni);setSc2(scramble(WORD_LIST[ni].word));setInput('');setShowHint(false);setStatus('playing');};
  const check=()=>{
    if(input.toUpperCase().trim()===WORD_LIST[idx].word){sfx.win();setScore(s=>s+(showHint?5:10));setStatus('correct');}
    else{sfx.bad();setStatus('wrong');setTimeout(()=>setStatus('playing'),800);}
  };
  const hint=()=>{if(hints>=3)return;sfx.click();setHints(h=>h+1);setShowHint(true);};
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
      <div style={{display:'flex',gap:24}}><ScoreBox label="Очки" value={score} color="#0891b2"/><ScoreBox label="Слово" value={`${idx+1}/${WORD_LIST.length}`} color="#a78bfa"/></div>
      <div style={{fontSize:32,fontWeight:900,letterSpacing:6,color:'#38bdf8',textShadow:'0 0 20px #38bdf855'}}>{sc2}</div>
      {showHint&&<div style={{fontSize:12,color:'#fbbf24',fontStyle:'italic'}}>💡 Подсказка: {WORD_LIST[idx].hint}</div>}
      {status==='correct'?(<div style={{textAlign:'center'}}><div style={{color:'#22c55e',fontWeight:800,marginBottom:8}}>✅ Правильно! +{showHint?5:10} очков</div><GameBtn onClick={next} color="#0891b2">Следующее →</GameBtn></div>):(
        <>
          <div style={{display:'flex',gap:8}}>
            <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&check()} placeholder="Введи слово"
              style={{padding:'8px 12px',borderRadius:10,border:`1px solid ${status==='wrong'?'#ef4444':'rgba(255,255,255,0.2)'}`,background:'rgba(255,255,255,0.07)',color:'#fff',fontSize:16,fontWeight:700,fontFamily:'"Montserrat",sans-serif',width:160}}/>
            <GameBtn onClick={check} color="#0891b2">✓</GameBtn>
          </div>
          <div style={{display:'flex',gap:8}}>
            <GameBtn size="sm" onClick={hint} color="#ca8a04" disabled={hints>=3}>💡 Подсказка</GameBtn>
            <GameBtn size="sm" onClick={next} color="#374151">Пропустить →</GameBtn>
          </div>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LIGHTS OUT
════════════════════════════════════════════════════════════════ */
function LightOutGame() {
  const N=5;
  const mkGrid=()=>{
    const g=Array(N*N).fill(false);
    for(let i=0;i<10;i++){const x=Math.floor(Math.random()*N*N);g[x]=!g[x];[x-1,x+1,x-N,x+N].forEach(j=>j>=0&&j<N*N&&(Math.abs(j%N-x%N)<=1)&&(g[j]=!g[j]));}
    return g;
  };
  const [grid, setGrid] = useState(mkGrid);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const click=(i:number)=>{
    sfx.click();setMoves(m=>m+1);
    const ng=[...grid]; [i,i-1,i+1,i-N,i+N].forEach(j=>{
      if(j>=0&&j<N*N){const r=Math.floor(j/N),c=j%N,ri=Math.floor(i/N),ci=i%N;
        if(Math.abs(r-ri)<=1&&Math.abs(c-ci)<=1&&(r===ri||c===ci))ng[j]=!ng[j];}});
    setGrid(ng);
    if(ng.every(v=>!v)){setWon(true);sfx.win();}
  };
  const reset=()=>{setGrid(mkGrid());setMoves(0);setWon(false);};
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
      <div style={{display:'flex',gap:24}}><ScoreBox label="Ходы" value={moves} color="#ca8a04"/>{won&&<ScoreBox label="Победа!" value="🎉" color="#22c55e"/>}</div>
      <div style={{display:'grid',gridTemplateColumns:`repeat(${N},56px)`,gap:6}}>
        {grid.map((on,i)=>(
          <motion.div key={i} whileTap={!won?{scale:0.88}:{}} onClick={()=>!won&&click(i)}
            style={{width:56,height:56,borderRadius:10,cursor:won?'default':'pointer',
              background:on?'#fbbf24':'rgba(255,255,255,0.05)',
              border:`2px solid ${on?'#f59e0b':'rgba(255,255,255,0.1)'}`,
              boxShadow:on?'0 0 16px #fbbf2499':'none',transition:'all 0.15s',
              display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>
            {on?'💡':''}
          </motion.div>
        ))}
      </div>
      <GameBtn size="sm" onClick={reset} color="#ca8a04">🔀 Перемешать</GameBtn>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MULTIPLAYER NOTICE
════════════════════════════════════════════════════════════════ */
function MultiplayerNotice({ game }: { game: GameMeta }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 24, textAlign: 'center' }}>
      <div style={{ fontSize: 72 }}>{game.emoji}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{game.name}</div>
      <div style={{ padding: '16px 20px', borderRadius: 16, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', maxWidth: 280 }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>
          {game.instructions}
        </div>
      </div>
      <div style={{ padding: '12px 20px', borderRadius: 12, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#22c55e', marginBottom: 4 }}>🎮 Как начать:</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
          Открой любой чат → нажми кнопку <b style={{ color: '#fff' }}>🎮</b> вверху → выбери игру
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   GAME RENDERER
════════════════════════════════════════════════════════════════ */
function GameRenderer({ game }: { game: GameMeta }) {
  if (game.multiplayer) return <MultiplayerNotice game={game} />;
  const map: Record<string, () => JSX.Element> = {
    snake: () => <SnakeGame />,
    tetris: () => <TetrisGame />,
    g2048: () => <G2048Game />,
    tictactoe: () => <TicTacToeGame />,
    minesweeper: () => <MinesweeperGame />,
    memory: () => <MemoryGame />,
    hangman: () => <HangmanGame />,
    puzzle15: () => <Puzzle15Game />,
    bullscows: () => <BullsCowsGame />,
    pong: () => <PongGame />,
    math: () => <MathGame />,
    sudoku: () => <SudokuGame />,
    arkanoid: () => <ArkanoidGame />,
    simon: () => <SimonGame />,
    wordscramble: () => <WordScrambleGame />,
    lightout: () => <LightOutGame />,
  };
  return map[game.id]?.() ?? <div style={{ color: 'rgba(255,255,255,0.5)' }}>Игра в разработке</div>;
}

/* ═══════════════════════════════════════════════════════════════
   GAME CARD
════════════════════════════════════════════════════════════════ */
function GameCard({ game, onClick }: { game: GameMeta; onClick: () => void }) {
  return (
    <motion.div whileTap={{ scale: 0.94 }} onClick={onClick}
      style={{ borderRadius: 16, padding: '14px 12px', cursor: 'pointer', position: 'relative', overflow: 'hidden',
        background: `linear-gradient(135deg, ${game.color}22, ${game.color}11)`,
        border: `1px solid ${game.color}44` }}>
      <div style={{ position: 'absolute', top: -12, right: -8, fontSize: 48, opacity: 0.12, lineHeight: 1 }}>{game.emoji}</div>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{game.emoji}</div>
      <div style={{ fontSize: 12, fontWeight: 900, color: '#fff', lineHeight: 1.2, marginBottom: 3 }}>{game.name}</div>
      <div style={{ fontSize: 9, fontWeight: 700, color: game.color, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{game.tag}</div>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', lineHeight: 1.3 }}>{game.desc}</div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN GAMES ARCADE SCREEN
════════════════════════════════════════════════════════════════ */
export default function GamesArcade({ onBack, accentColor = '#6366f1' }: { onBack: () => void; accentColor?: string }) {
  const [selected, setSelected] = useState<GameMeta | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [filter, setFilter] = useState<'all'|'solo'|'multi'>('all');

  /* Обработчик аппаратной кнопки «Назад»:
     инструкции → закрыть инструкции
     игра выбрана → вернуться в список
     иначе → вернуться в приложение */
  useBackHandler(
    showInstructions ? () => setShowInstructions(false)
    : selected       ? () => setSelected(null)
    : onBack
  );

  const filtered = GAMES.filter(g => filter === 'all' ? true : filter === 'solo' ? !g.multiplayer : g.multiplayer);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, background: '#080810', display: 'flex', flexDirection: 'column', fontFamily: '"Montserrat",sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '48px 16px 12px', background: 'rgba(8,8,22,0.97)', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <motion.button whileTap={{ scale: 0.88 }} onClick={onBack}
          style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>←</motion.button>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>🎮 Игры</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>20 игр · одиночные и мультиплеер</div>
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, padding: '10px 16px', flexShrink: 0 }}>
        {([['all','Все'], ['solo','Одиночные'], ['multi','Мультиплеер']] as [typeof filter, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            style={{ padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: '"Montserrat",sans-serif',
              background: filter === k ? accentColor : 'rgba(255,255,255,0.07)', color: '#fff' }}>{l}</button>
        ))}
      </div>

      {/* Game grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {filtered.map(game => (
            <GameCard key={game.id} game={game} onClick={() => { sfx.click(); setSelected(game); }} />
          ))}
        </div>
      </div>

      {/* Game modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0, y: '100%' }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            style={{ position: 'fixed', inset: 0, zIndex: 500, background: '#07070f', display: 'flex', flexDirection: 'column' }}>
            {/* Game header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '48px 16px 12px',
              background: `linear-gradient(180deg, ${selected.color}22, transparent)`,
              borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => setSelected(null)}
                style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>←</motion.button>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>{selected.emoji} {selected.name}</div>
                <div style={{ fontSize: 10, color: selected.color, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{selected.tag}</div>
              </div>
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowInstructions(true)}
                style={{ width: 36, height: 36, borderRadius: '50%', background: `${selected.color}22`, border: `1px solid ${selected.color}55`, color: selected.color, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>?</motion.button>
            </div>
            {/* Game content */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 8px 32px' }}>
              <GameRenderer game={selected} />
            </div>

            {/* Instructions overlay */}
            <AnimatePresence>
              {showInstructions && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', zIndex: 10 }}
                  onClick={() => setShowInstructions(false)}>
                  <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 30 }} onClick={e => e.stopPropagation()}
                    style={{ width: '100%', background: '#0f0f1e', borderRadius: '24px 24px 0 0', padding: '24px 20px 40px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto 20px' }} />
                    <div style={{ fontSize: 24, marginBottom: 8, textAlign: 'center' }}>{selected.emoji}</div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', textAlign: 'center', marginBottom: 16 }}>{selected.name} — Правила</div>
                    <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.75)', lineHeight: 1.8, textAlign: 'center' }}>{selected.instructions}</div>
                    <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
                      <GameBtn onClick={() => setShowInstructions(false)} color={selected.color}>Понятно!</GameBtn>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
