import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API_BASE = import.meta.env.BASE_URL?.replace(/\/$/, '') === ''
  ? '' : (import.meta.env.BASE_URL?.replace(/\/$/, '') ?? '');

function getST() { return localStorage.getItem('swaip_session_token') ?? ''; }
async function api(path: string, opts?: RequestInit) {
  return fetch(`${API_BASE}${path}`, { ...opts, headers: { 'x-session-token': getST(), 'Content-Type': 'application/json', ...(opts?.headers ?? {}) } });
}

/* ─────────── Types ─────────── */
type GameType = 'battleship' | 'chess' | 'checkers' | 'durak';

export interface GameView {
  id: string;
  type: GameType;
  status: 'pending' | 'active' | 'finished' | 'declined';
  winner: string | null;
  players: string[];
  hostHash: string;
  state?: Record<string, unknown>;
  /* battleship */
  myBoard?: number[][];
  opponentShots?: [number, number][];
  myShots?: [number, number][];
  turn?: string;
  /* durak */
  myHand?: string[];
  otherHands?: Record<string, number>;
  deckSize?: number;
  trumpCard?: string;
  trumpSuit?: string;
  table?: { attack: string; defense: string | null }[];
  passed?: string[];
  attackerIdx?: number;
  defenderIdx?: number;
  playerOrder?: string[];
  gameOver?: boolean;
  durak?: string | null;
}

/* ─────────── Game Names ─────────── */
const GAME_NAMES: Record<GameType, string> = {
  battleship: 'Морской бой 🚢', chess: 'Шахматы ♟', checkers: 'Шашки ⚫', durak: 'Дурак 🃏',
};

/* ═══════════════════════════════════════════════════════
   useGameSession hook
═══════════════════════════════════════════════════════ */
export function useGameSession(convId: number | null, myHash: string) {
  const [game, setGame] = useState<GameView | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    if (!convId || !myHash) return;
    try {
      const r = await api(`/api/game/pending?convId=${convId}`);
      if (!r.ok) return;
      const d = await r.json();
      setGame(d.game);
    } catch { /* ignore */ }
  }, [convId, myHash]);

  const refreshById = useCallback(async (id: string) => {
    try {
      const r = await api(`/api/game/${id}`);
      if (!r.ok) return;
      const d = await r.json();
      setGame(d.game);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refresh();
    pollRef.current = setInterval(() => {
      if (game?.id) refreshById(game.id);
      else refresh();
    }, 1500);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [refresh, refreshById, game?.id]);

  const sendInvite = useCallback(async (type: GameType, opponentHash?: string) => {
    if (!convId) return;
    const r = await api('/api/game/invite', { method: 'POST', body: JSON.stringify({ convId, type, opponentHash }) });
    const d = await r.json();
    if (d.gameId) setTimeout(() => refreshById(d.gameId), 300);
  }, [convId, refreshById]);

  const accept = useCallback(async (id: string) => {
    await api(`/api/game/${id}/accept`, { method: 'POST' });
    refreshById(id);
  }, [refreshById]);

  const decline = useCallback(async (id: string) => {
    await api(`/api/game/${id}/decline`, { method: 'POST' });
    setGame(null);
  }, []);

  const leave = useCallback(async (id: string) => {
    await api(`/api/game/${id}/leave`, { method: 'POST' });
    setGame(null);
  }, []);

  const move = useCallback(async (id: string, moveData: Record<string, unknown>) => {
    const r = await api(`/api/game/${id}/move`, { method: 'POST', body: JSON.stringify({ move: moveData }) });
    const d = await r.json();
    if (d.game) setGame(d.game);
  }, []);

  const joinGame = useCallback(async (id: string) => {
    await api(`/api/game/${id}/join`, { method: 'POST' });
    refreshById(id);
  }, [refreshById]);

  const startGame = useCallback(async (id: string) => {
    await api(`/api/game/${id}/start`, { method: 'POST' });
    refreshById(id);
  }, [refreshById]);

  return { game, sendInvite, accept, decline, leave, move, joinGame, startGame, refresh };
}

/* ═══════════════════════════════════════════════════════
   GameInvitePanel — main panel shown in chat
═══════════════════════════════════════════════════════ */
interface GamePanelProps {
  game: GameView;
  myHash: string;
  otherName: string;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onLeave: (id: string) => void;
  onMove: (id: string, m: Record<string, unknown>) => void;
  onJoin: (id: string) => void;
  onStart: (id: string) => void;
  isGroup?: boolean;
  accent?: string;
}

export function GamePanel({ game, myHash, otherName, onAccept, onDecline, onLeave, onMove, onJoin, onStart, isGroup, accent = '#6366f1' }: GamePanelProps) {
  const isHost = game.players[0] === myHash;
  const amPlayer = game.players.includes(myHash);

  const bodyStyle: React.CSSProperties = {
    position: 'absolute', inset: 0,
    background: 'linear-gradient(160deg,#0a0f1a 0%,#0d1628 100%)',
    zIndex: 65, display: 'flex', flexDirection: 'column', alignItems: 'center',
    overflow: 'hidden', fontFamily: '"Montserrat",sans-serif',
  };

  /* Pending invite */
  if (game.status === 'pending') {
    return (
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={bodyStyle}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 56 }}>{gameEmoji(game.type)}</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: '#fff' }}>{GAME_NAMES[game.type]}</div>
          {isHost ? (
            <>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Ждём {otherName}…</div>
              {isGroup && game.type === 'durak' && (
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', maxWidth: 240 }}>
                  Участники могут присоединиться. Нажми «Начать», когда все готовы.
                </div>
              )}
              {isGroup && game.type === 'durak' && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 260 }}>
                  {game.players.map(p => (
                    <div key={p} style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 8, padding: '4px 10px', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
                      {p === myHash ? 'Ты' : p.slice(0, 6) + '…'}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                {isGroup && game.type === 'durak' && game.players.length >= 2 && (
                  <motion.button whileTap={{ scale: 0.93 }} onClick={() => onStart(game.id)}
                    style={{ padding: '12px 28px', borderRadius: 14, background: `linear-gradient(135deg,${accent},${accent}cc)`, border: 'none', color: '#fff', fontWeight: 900, fontSize: 14, cursor: 'pointer', boxShadow: `0 4px 20px ${accent}55` }}>
                    ▶ Начать игру
                  </motion.button>
                )}
                <motion.button whileTap={{ scale: 0.93 }} onClick={() => onLeave(game.id)}
                  style={{ padding: '12px 24px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                  Отменить
                </motion.button>
              </div>
              {isGroup && game.type === 'durak' && !game.players.includes(myHash) && (
                <motion.button whileTap={{ scale: 0.93 }} onClick={() => onJoin(game.id)}
                  style={{ padding: '12px 28px', borderRadius: 14, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', marginTop: 8 }}>
                  🙋 Войти в игру
                </motion.button>
              )}
            </>
          ) : amPlayer ? (
            <>
              <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>{otherName} предлагает сыграть!</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <motion.button whileTap={{ scale: 0.92 }} onClick={() => onAccept(game.id)}
                  style={{ padding: '12px 32px', borderRadius: 14, background: `linear-gradient(135deg,${accent},${accent}aa)`, border: 'none', color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer', boxShadow: `0 4px 20px ${accent}55` }}>
                  ✅ Принять
                </motion.button>
                <motion.button whileTap={{ scale: 0.92 }} onClick={() => onDecline(game.id)}
                  style={{ padding: '12px 24px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.55)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
                  Отказ
                </motion.button>
              </div>
            </>
          ) : (
            game.type === 'durak' && isGroup ? (
              <motion.button whileTap={{ scale: 0.93 }} onClick={() => onJoin(game.id)}
                style={{ padding: '12px 28px', borderRadius: 14, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                🙋 Войти в игру
              </motion.button>
            ) : <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Идёт игра между участниками…</div>
          )}
        </div>
      </motion.div>
    );
  }

  /* Declined / finished */
  if (game.status === 'declined' || game.status === 'finished') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={bodyStyle}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, textAlign: 'center' }}>
          {game.status === 'declined' ? (
            <><div style={{ fontSize: 48 }}>😔</div><div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{otherName} отклонил(а) игру</div></>
          ) : (
            <>
              <div style={{ fontSize: 48 }}>{game.type === 'durak' ? '🃏' : '🏆'}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>
                {game.type === 'durak'
                  ? `Дурак: ${(game as any).state?.durak === myHash ? 'Ты проиграл! 😢' : 'Ты не дурак! 🎉'}`
                  : game.winner === myHash ? '🎉 Ты победил!' : game.winner ? `Победил ${otherName}` : 'Ничья!'}
              </div>
            </>
          )}
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => onLeave(game.id)}
            style={{ marginTop: 12, padding: '10px 28px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Закрыть
          </motion.button>
        </div>
      </motion.div>
    );
  }

  /* Active games */
  const sharedProps = { game, myHash, accent, onMove: (m: Record<string, unknown>) => onMove(game.id, m), onLeave: () => onLeave(game.id) };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={bodyStyle}>
      <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>{gameEmoji(game.type)} {GAME_NAMES[game.type]}</div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => onLeave(game.id)} style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '4px 12px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
          ✕ Выйти
        </motion.button>
      </div>
      <div style={{ flex: 1, width: '100%', overflow: 'auto' }}>
        {game.type === 'battleship' && <BattleshipGame {...sharedProps} />}
        {game.type === 'chess' && <ChessGame {...sharedProps} />}
        {game.type === 'checkers' && <CheckersGame {...sharedProps} />}
        {game.type === 'durak' && <DurakGame {...sharedProps} />}
      </div>
    </motion.div>
  );
}

function gameEmoji(type: GameType) { return { battleship: '🚢', chess: '♟', checkers: '⚫', durak: '🃏' }[type]; }

/* ═══════════════════════════════════════════════════════
   BATTLESHIP
═══════════════════════════════════════════════════════ */
function BattleshipGame({ game, myHash, accent, onMove, onLeave: _ }: { game: GameView; myHash: string; accent: string; onMove: (m: Record<string, unknown>) => void; onLeave: () => void }) {
  const isHost = game.players[0] === myHash;
  const myTurn = game.turn === (isHost ? 'host' : 'guest');
  const myBoard = game.myBoard ?? [];
  const opponentShots = game.opponentShots ?? [];
  const myShots = game.myShots ?? [];
  const shotSet = new Set(myShots.map(([r, c]) => `${r},${c}`));
  const hitSet = new Set(myBoard.flatMap((row, r) => row.map((v, c) => v === 1 && opponentShots.some(([sr, sc]) => sr === r && sc === c) ? `${r},${c}` : null).filter(Boolean) as string[]));

  const fire = (r: number, c: number) => {
    if (!myTurn || shotSet.has(`${r},${c}`)) return;
    onMove({ row: r, col: c });
  };

  const cellSize = 28;

  const renderBoard = (board: number[][], shots: [number, number][], clickable: boolean, label: string) => {
    const shotS = new Set(shots.map(([r, c]) => `${r},${c}`));
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.4)', marginBottom: 6, letterSpacing: 1, textTransform: 'uppercase' }}>{label}</div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(10, ${cellSize}px)`, gap: 2 }}>
          {Array.from({ length: 100 }, (_, i) => {
            const r = Math.floor(i / 10), c = i % 10;
            const key = `${r},${c}`;
            const isShip = board[r]?.[c] === 1;
            const isHit = isShip && shotS.has(key);
            const isMiss = !isShip && shotS.has(key);
            const alreadyMine = clickable && shotSet.has(key);
            return (
              <motion.div key={key}
                whileTap={clickable && !alreadyMine ? { scale: 0.85 } : undefined}
                onClick={() => clickable && fire(r, c)}
                style={{
                  width: cellSize, height: cellSize, borderRadius: 4, cursor: clickable && !alreadyMine ? 'crosshair' : 'default',
                  background: isHit ? '#ef4444' : isMiss ? 'rgba(255,255,255,0.1)' : isShip ? `${accent}99` : 'rgba(255,255,255,0.04)',
                  border: isHit ? '1.5px solid #ef4444' : isMiss ? '1.5px solid rgba(255,255,255,0.2)' : isShip ? `1.5px solid ${accent}66` : '1px solid rgba(255,255,255,0.07)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, transition: 'background 0.15s',
                }}>
                {isHit ? '💥' : isMiss ? '◦' : ''}
              </motion.div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: myTurn ? '#22c55e' : 'rgba(255,255,255,0.4)', marginBottom: 8, textAlign: 'center' }}>
        {myTurn ? '🎯 Твой ход — нажми на клетку' : '⏳ Ход противника…'}
      </div>
      {renderBoard([] as number[][], myShots, myTurn, 'Поле противника (стреляй сюда)')}
      {renderBoard(myBoard, opponentShots, false, 'Твоё поле')}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CHESS
═══════════════════════════════════════════════════════ */
const PIECE_CHARS: Record<string, string> = { wk: '♔', wq: '♕', wr: '♖', wb: '♗', wn: '♘', wp: '♙', bk: '♚', bq: '♛', br: '♜', bb: '♝', bn: '♞', bp: '♟' };

function ChessGame({ game, myHash, accent, onMove, onLeave: _ }: { game: GameView; myHash: string; accent: string; onMove: (m: Record<string, unknown>) => void; onLeave: () => void }) {
  const isHost = game.players[0] === myHash;
  const myColor = isHost ? 'w' : 'b';
  const st = game.state as any;
  const board: (string | null)[][] = st?.board ?? [];
  const turn: string = st?.turn ?? 'w';
  const myTurn = turn === myColor;

  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [promotionPending, setPromotionPending] = useState<{ from: [number, number]; to: [number, number] } | null>(null);

  const getLegalMoves = useCallback((r: number, c: number, b: (string | null)[][]): [number, number][] => {
    const piece = b[r][c];
    if (!piece) return [];
    const color = piece[0];
    const type = piece.slice(1);
    const moves: [number, number][] = [];
    const opp = color === 'w' ? 'b' : 'w';
    const inBounds = (nr: number, nc: number) => nr >= 0 && nr < 8 && nc >= 0 && nc < 8;
    const isEmpty = (nr: number, nc: number) => inBounds(nr, nc) && !b[nr][nc];
    const isOpp = (nr: number, nc: number) => inBounds(nr, nc) && b[nr][nc]?.startsWith(opp);
    const slide = (dr: number, dc: number) => { for (let i = 1; i < 8; i++) { const nr = r + dr * i, nc = c + dc * i; if (!inBounds(nr, nc) || b[nr][nc]?.startsWith(color)) break; moves.push([nr, nc]); if (b[nr][nc]) break; } };

    if (type === 'p') {
      const dir = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;
      if (isEmpty(r + dir, c)) { moves.push([r + dir, c]); if (r === startRow && isEmpty(r + dir * 2, c)) moves.push([r + dir * 2, c]); }
      if (isOpp(r + dir, c - 1)) moves.push([r + dir, c - 1]);
      if (isOpp(r + dir, c + 1)) moves.push([r + dir, c + 1]);
    } else if (type === 'r') { [[-1, 0], [1, 0], [0, -1], [0, 1]].forEach(([dr, dc]) => slide(dr, dc)); }
    else if (type === 'b') { [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([dr, dc]) => slide(dr, dc)); }
    else if (type === 'q') { [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([dr, dc]) => slide(dr, dc)); }
    else if (type === 'n') { [[-2, -1], [-2, 1], [2, -1], [2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2]].forEach(([dr, dc]) => { if (inBounds(r + dr, c + dc) && !b[r + dr][c + dc]?.startsWith(color)) moves.push([r + dr, c + dc]); }); }
    else if (type === 'k') { for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dr || dc) && inBounds(r + dr, c + dc) && !b[r + dr][c + dc]?.startsWith(color)) moves.push([r + dr, c + dc]); }

    return moves;
  }, []);

  const legalMoves = selected ? getLegalMoves(selected[0], selected[1], board) : [];
  const legalSet = new Set(legalMoves.map(([r, c]) => `${r},${c}`));

  const handleClick = (r: number, c: number) => {
    if (!myTurn) return;
    if (selected) {
      if (legalSet.has(`${r},${c}`)) {
        const [fr, fc] = selected;
        const piece = board[fr][fc];
        /* Pawn promotion? */
        if (piece === `${myColor}p` && (r === 0 || r === 7)) {
          setPromotionPending({ from: [fr, fc], to: [r, c] });
          setSelected(null);
          return;
        }
        onMove({ from: [fr, fc], to: [r, c] });
        setSelected(null);
      } else if (board[r][c]?.startsWith(myColor)) {
        setSelected([r, c]);
      } else {
        setSelected(null);
      }
    } else {
      if (board[r][c]?.startsWith(myColor)) setSelected([r, c]);
    }
  };

  const displayBoard = isHost ? board : [...board].reverse().map(row => [...row].reverse());

  const cellSize = 38;

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: myTurn ? '#22c55e' : 'rgba(255,255,255,0.4)', marginBottom: 10, textAlign: 'center' }}>
        {myTurn ? `✅ Твой ход (${myColor === 'w' ? 'Белые' : 'Чёрные'})` : `⏳ Ход ${turn === 'w' ? 'белых' : 'чёрных'}…`}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(8, ${cellSize}px)`, border: '2px solid rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden' }}>
        {Array.from({ length: 64 }, (_, i) => {
          const r = Math.floor(i / 8), c = i % 8;
          const realR = isHost ? r : 7 - r;
          const realC = isHost ? c : 7 - c;
          const piece = board[realR]?.[realC];
          const isLight = (r + c) % 2 === 0;
          const isSel = selected?.[0] === realR && selected?.[1] === realC;
          const isLegal = legalSet.has(`${realR},${realC}`);
          return (
            <motion.div key={i}
              whileTap={myTurn ? { scale: 0.92 } : undefined}
              onClick={() => handleClick(realR, realC)}
              style={{
                width: cellSize, height: cellSize, cursor: myTurn ? 'pointer' : 'default',
                background: isSel ? `${accent}88` : isLegal ? (piece ? 'rgba(239,68,68,0.45)' : 'rgba(99,255,120,0.25)') : isLight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, position: 'relative', transition: 'background 0.15s',
              }}>
              {isLegal && !piece && <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(100,255,120,0.6)', position: 'absolute' }} />}
              {piece && <span style={{ filter: piece[0] === 'w' ? 'drop-shadow(0 0 3px rgba(255,255,255,0.8))' : 'none', lineHeight: 1 }}>{PIECE_CHARS[piece]}</span>}
            </motion.div>
          );
        })}
      </div>

      {/* Promotion modal */}
      <AnimatePresence>
        {promotionPending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#fff' }}>Выбери фигуру для превращения</div>
            <div style={{ display: 'flex', gap: 12 }}>
              {['q', 'r', 'b', 'n'].map(p => (
                <motion.button key={p} whileTap={{ scale: 0.9 }} onClick={() => {
                  onMove({ from: promotionPending.from, to: promotionPending.to, promotion: p });
                  setPromotionPending(null);
                }} style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {PIECE_CHARS[myColor + p]}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CHECKERS
═══════════════════════════════════════════════════════ */
function CheckersGame({ game, myHash, accent, onMove, onLeave: _ }: { game: GameView; myHash: string; accent: string; onMove: (m: Record<string, unknown>) => void; onLeave: () => void }) {
  const isHost = game.players[0] === myHash;
  const myColor = isHost ? 'w' : 'b';
  const st = game.state as any;
  const board: (string | null)[][] = st?.board ?? [];
  const turn: string = st?.turn ?? 'w';
  const myTurn = turn === myColor;
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [path, setPath] = useState<[number, number][]>([]);

  const getMoves = useCallback((r: number, c: number, b: (string | null)[][]): { to: [number, number]; capture?: [number, number] }[] => {
    const piece = b[r][c];
    if (!piece) return [];
    const color = piece.startsWith('w') ? 'w' : 'b';
    const opp = color === 'w' ? 'b' : 'w';
    const isKing = piece.endsWith('k');
    const dirs: [number, number][] = isKing ? [[-1, -1], [-1, 1], [1, -1], [1, 1]] : color === 'w' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
    const moves: { to: [number, number]; capture?: [number, number] }[] = [];
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        if (!b[nr][nc]) moves.push({ to: [nr, nc] });
        else if (b[nr][nc]?.startsWith(opp)) {
          const jr = nr + dr, jc = nc + dc;
          if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8 && !b[jr][jc]) moves.push({ to: [jr, jc], capture: [nr, nc] });
        }
      }
    }
    return moves;
  }, []);

  const captures = selected ? getMoves(selected[0], selected[1], board).filter(m => m.capture) : [];
  const normalMoves = selected ? getMoves(selected[0], selected[1], board).filter(m => !m.capture) : [];
  const availableMoves = captures.length > 0 ? captures : normalMoves;
  const moveSet = new Set(availableMoves.map(m => `${m.to[0]},${m.to[1]}`));

  const handleClick = (r: number, c: number) => {
    if (!myTurn) return;
    if (selected) {
      if (moveSet.has(`${r},${c}`)) {
        const mv = availableMoves.find(m => m.to[0] === r && m.to[1] === c)!;
        const newPath = path.length === 0 ? [selected, mv.to] : [...path, mv.to];
        if (mv.capture) {
          onMove({ path: newPath });
          setSelected(null); setPath([]);
        } else {
          onMove({ path: newPath });
          setSelected(null); setPath([]);
        }
      } else if (board[r][c]?.startsWith(myColor)) {
        setSelected([r, c]); setPath([]);
      } else {
        setSelected(null); setPath([]);
      }
    } else {
      if (board[r][c]?.startsWith(myColor)) { setSelected([r, c]); setPath([]); }
    }
  };

  const cellSize = 38;

  return (
    <div style={{ padding: 12, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: myTurn ? '#22c55e' : 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
        {myTurn ? `✅ Твой ход (${myColor === 'w' ? '⚪ Белые' : '⚫ Чёрные'})` : `⏳ Ход ${turn === 'w' ? '⚪' : '⚫'}…`}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(8, ${cellSize}px)`, border: '2px solid rgba(255,255,255,0.15)', borderRadius: 4, overflow: 'hidden' }}>
        {Array.from({ length: 64 }, (_, i) => {
          const r = Math.floor(i / 8), c = i % 8;
          const realR = isHost ? r : 7 - r;
          const realC = isHost ? c : 7 - c;
          const piece = board[realR]?.[realC];
          const isDark = (r + c) % 2 === 1;
          const isSel = selected?.[0] === realR && selected?.[1] === realC;
          const isTarget = moveSet.has(`${realR},${realC}`);
          return (
            <motion.div key={i} whileTap={myTurn && isDark ? { scale: 0.88 } : undefined}
              onClick={() => isDark && handleClick(realR, realC)}
              style={{
                width: cellSize, height: cellSize, cursor: myTurn && isDark ? 'pointer' : 'default',
                background: isSel ? `${accent}99` : isTarget ? (piece ? 'rgba(239,68,68,0.4)' : 'rgba(99,255,120,0.2)') : isDark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,255,0.07)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', transition: 'background 0.15s',
              }}>
              {isTarget && !piece && isDark && <div style={{ width: 12, height: 12, borderRadius: '50%', background: 'rgba(100,255,120,0.7)', position: 'absolute' }} />}
              {piece && (
                <div style={{
                  width: cellSize - 8, height: cellSize - 8, borderRadius: '50%',
                  background: piece.startsWith('w') ? 'radial-gradient(circle at 35% 35%,#fff,#ccc)' : 'radial-gradient(circle at 35% 35%,#444,#111)',
                  border: `3px solid ${piece.startsWith('w') ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.2)'}`,
                  boxShadow: isSel ? `0 0 12px ${accent}` : '0 2px 6px rgba(0,0,0,0.5)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, color: piece.startsWith('w') ? '#333' : '#eee',
                }}>
                  {piece.endsWith('k') ? '♛' : ''}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   DURAK
═══════════════════════════════════════════════════════ */
const SUIT_COLOR: Record<string, string> = { '♠': '#fff', '♣': '#fff', '♥': '#f87171', '♦': '#f87171' };

function DurakCard({ card, selected, onClick, size = 'md', faceDown }: { card: string; selected?: boolean; onClick?: () => void; size?: 'sm' | 'md' | 'lg'; faceDown?: boolean }) {
  const rank = card.slice(0, -1), suit = card.slice(-1);
  const dim = size === 'sm' ? { w: 32, h: 44, fs: 9 } : size === 'lg' ? { w: 52, h: 72, fs: 16 } : { w: 42, h: 58, fs: 12 };
  return (
    <motion.div whileTap={onClick ? { scale: 0.93, y: -6 } : undefined} onClick={onClick}
      style={{ width: dim.w, height: dim.h, borderRadius: 6, cursor: onClick ? 'pointer' : 'default', flexShrink: 0, position: 'relative', zIndex: selected ? 5 : 1,
        background: faceDown ? 'linear-gradient(135deg,#1e3a5f,#0f2040)' : '#fff',
        border: selected ? '2px solid #22c55e' : '1px solid rgba(0,0,0,0.2)',
        boxShadow: selected ? '0 0 12px rgba(34,197,94,0.7)' : '0 2px 6px rgba(0,0,0,0.4)',
        transform: selected ? 'translateY(-12px)' : undefined, transition: 'transform 0.15s',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
      }}>
      {!faceDown && (
        <div style={{ fontSize: dim.fs, fontWeight: 900, color: SUIT_COLOR[suit] ?? '#333', lineHeight: 1.2, textAlign: 'center' }}>
          <div>{rank}</div><div>{suit}</div>
        </div>
      )}
      {faceDown && <div style={{ fontSize: dim.fs + 4, opacity: 0.3 }}>🂠</div>}
    </motion.div>
  );
}

function DurakGame({ game, myHash, accent, onMove, onLeave: _ }: { game: GameView; myHash: string; accent: string; onMove: (m: Record<string, unknown>) => void; onLeave: () => void }) {
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  const playerOrder = game.playerOrder ?? [];
  const myIdx = playerOrder.indexOf(myHash);
  const attackerIdx = game.attackerIdx ?? 0;
  const defenderIdx = game.defenderIdx ?? 1;
  const attackerHash = playerOrder[attackerIdx];
  const defenderHash = playerOrder[defenderIdx];
  const isAttacker = myHash === attackerHash || (game.passed !== undefined && !game.passed?.includes(myHash) && myHash !== defenderHash && playerOrder.includes(myHash));
  const isDefender = myHash === defenderHash;

  const myHand = game.myHand ?? [];
  const table = game.table ?? [];
  const trumpSuit = game.trumpSuit ?? '';
  const trumpCard = game.trumpCard ?? '';

  const attack = () => {
    if (!selectedCard || !isAttacker) return;
    onMove({ action: 'attack', card: selectedCard });
    setSelectedCard(null);
  };

  const defend = (tableIdx: number) => {
    if (!selectedCard || !isDefender) return;
    onMove({ action: 'defend', card: selectedCard, tableIdx });
    setSelectedCard(null);
  };

  const pickup = () => onMove({ action: 'pickup' });
  const pass = () => { onMove({ action: 'pass' }); setSelectedCard(null); };

  const canDefend = table.some(t => t.defense === null);
  const allDefended = table.length > 0 && table.every(t => t.defense !== null);
  const isParticipant = playerOrder.includes(myHash);

  if (!isParticipant) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 36 }}>🃏</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>Ты не участвуешь в этой партии</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '8px 12px', gap: 8, overflow: 'hidden' }}>

      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
        <div>Козырь: <span style={{ color: SUIT_COLOR[trumpSuit] ?? '#fff', fontWeight: 800 }}>{trumpCard}</span></div>
        <div>Колода: {game.deckSize ?? 0} карт</div>
        <div style={{ color: isAttacker ? '#f97316' : isDefender ? '#60a5fa' : 'rgba(255,255,255,0.4)', fontWeight: 800 }}>
          {isAttacker ? '⚔️ Атакуешь' : isDefender ? '🛡 Защищаешься' : 'Ждёшь'}
        </div>
      </div>

      {/* Other players hand counts */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
        {playerOrder.filter(p => p !== myHash).map((p, i) => (
          <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '3px 8px' }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{p.slice(0, 6)}…</span>
            <span style={{ fontSize: 10, color: p === attackerHash ? '#f97316' : p === defenderHash ? '#60a5fa' : '#fff', fontWeight: 800 }}>
              {game.otherHands?.[p] ?? 0} 🃏
              {p === attackerHash && ' ⚔️'}
              {p === defenderHash && ' 🛡'}
            </span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ flex: 1, background: 'rgba(255,255,255,0.03)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)', padding: 12, display: 'flex', flexWrap: 'wrap', gap: 12, alignContent: 'flex-start', overflow: 'auto', minHeight: 80 }}>
        {table.length === 0 && (
          <div style={{ width: '100%', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12, paddingTop: 20 }}>Стол пуст</div>
        )}
        {table.map((slot, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
            <DurakCard card={slot.attack} />
            {slot.defense ? (
              <DurakCard card={slot.defense} />
            ) : isDefender && selectedCard ? (
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => defend(i)}
                style={{ width: 42, height: 24, borderRadius: 6, background: '#22c55e', border: 'none', cursor: 'pointer', fontSize: 10, color: '#fff', fontWeight: 800 }}>
                Бить
              </motion.button>
            ) : (
              <div style={{ width: 42, height: 24, borderRadius: 6, border: '1px dashed rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>пусто</div>
            )}
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        {isAttacker && selectedCard && (
          <motion.button whileTap={{ scale: 0.92 }} onClick={attack}
            style={{ flex: 1, padding: '8px 0', borderRadius: 10, background: '#f97316', border: 'none', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
            ⚔️ Атаковать
          </motion.button>
        )}
        {isAttacker && allDefended && (
          <motion.button whileTap={{ scale: 0.92 }} onClick={pass}
            style={{ flex: 1, padding: '8px 0', borderRadius: 10, background: '#22c55e', border: 'none', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
            ✅ Отбито! Пас
          </motion.button>
        )}
        {isDefender && canDefend && (
          <motion.button whileTap={{ scale: 0.92 }} onClick={pickup}
            style={{ flex: 1, padding: '8px 0', borderRadius: 10, background: '#ef4444', border: 'none', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
            📥 Забрать
          </motion.button>
        )}
      </div>

      {/* My hand */}
      <div style={{ flexShrink: 0 }}>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 6, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Твои карты ({myHand.length})</div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {myHand.map((card, i) => (
            <DurakCard key={card + i} card={card} selected={selectedCard === card}
              onClick={() => setSelectedCard(selectedCard === card ? null : card)} />
          ))}
          {myHand.length === 0 && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', padding: '12px 0' }}>Карты кончились! 🎉</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   GamePickerModal — select a game to invite
═══════════════════════════════════════════════════════ */
interface GamePickerProps {
  onSelect: (type: GameType) => void;
  onClose: () => void;
  isGroup?: boolean;
  accent?: string;
}

export function GamePickerModal({ onSelect, onClose, isGroup, accent = '#6366f1' }: GamePickerProps) {
  const games: { type: GameType; emoji: string; desc: string; multi?: boolean }[] = [
    { type: 'battleship', emoji: '🚢', desc: 'Классический морской бой 10×10' },
    { type: 'chess', emoji: '♟', desc: 'Шахматы — классика интеллекта' },
    { type: 'checkers', emoji: '⚫', desc: 'Русские шашки' },
    { type: 'durak', emoji: '🃏', desc: isGroup ? 'До 6 игроков!' : '2 игрока, 36 карт', multi: true },
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 65, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 320 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', fontFamily: '"Montserrat",sans-serif' }}>🎮 Выбери игру</div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 20 }}>✕</motion.button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {games.map(g => (
            <motion.button key={g.type} whileTap={{ scale: 0.96 }} onClick={() => { onSelect(g.type); onClose(); }}
              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', borderRadius: 14, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', textAlign: 'left', width: '100%' }}>
              <div style={{ fontSize: 28, flexShrink: 0 }}>{g.emoji}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', fontFamily: '"Montserrat",sans-serif' }}>{GAME_NAMES[g.type]}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2, fontFamily: '"Montserrat",sans-serif' }}>{g.desc}</div>
              </div>
              {g.multi && isGroup && <div style={{ marginLeft: 'auto', fontSize: 9, background: accent, color: '#fff', borderRadius: 6, padding: '2px 7px', fontWeight: 800 }}>МУЛЬТИ</div>}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
