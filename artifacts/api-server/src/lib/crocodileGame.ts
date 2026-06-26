export interface PlayerInfo { hash: string; name: string; avatar: string; }

const WORDS = [
  'Президент','Балалайка','Телевизор','Пицца','Футбол','Танцы','Самолёт','Снеговик',
  'Зубная щётка','Лифт','Бассейн','Гитарист','Повар','Пожарный','Доктор','Полицейский',
  'Карусель','Трамплин','Батут','Аквариум','Паук','Торнадо','Маяк','Пингвин',
  'Регбист','Жонглёр','Акробат','Дирижёр','Скрипач','Фокусник','Канатоходец','Боксёр',
  'Сноуборд','Батарейка','Зарядка','Мышеловка','Термометр','Микроскоп','Телескоп','Компас',
  'Черепаха','Осьминог','Скорпион','Медуза','Крокодил','Горилла','Лемур','Хамелеон',
  'Борщ','Сосиска','Вареники','Блины','Шашлык','Мороженое','Пельмени','Оладьи',
  'Гамак','Качели','Горка','Батарея','Диван','Люстра','Шторы','Будильник',
];

export interface CrocState {
  gameId: string;
  gameType: 'crocodile';
  status: 'playing' | 'ended';
  phase: 'explain' | 'between';
  playerOrder: string[];
  players: Record<string, PlayerInfo>;
  explainerHash: string;
  word: string;
  scores: Record<string, number>;
  round: number;
  lastWord: string;
  lastExplainer: string;
  usedWords: number[];
}

function shuffle<T>(a: T[]): T[] {
  const arr = [...a]; for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr;
}

function pickWord(used: number[]): { word: string; idx: number } {
  const available = WORDS.map((_, i) => i).filter(i => !used.includes(i));
  const pool = available.length > 0 ? available : WORDS.map((_, i) => i);
  const idx = pool[Math.floor(Math.random() * pool.length)];
  return { word: WORDS[idx], idx };
}

export function createCrocGame(players: PlayerInfo[]): CrocState {
  if (players.length < 3) throw new Error('Нужно минимум 3 игрока');
  const order = shuffle(players.map(p => p.hash));
  const playersMap: Record<string, PlayerInfo> = {};
  const scores: Record<string, number> = {};
  for (const p of players) { playersMap[p.hash] = p; scores[p.hash] = 0; }
  const { word, idx } = pickWord([]);
  return {
    gameId: Math.random().toString(36).slice(2, 8),
    gameType: 'crocodile',
    status: 'playing',
    phase: 'explain',
    playerOrder: order,
    players: playersMap,
    explainerHash: order[0],
    word,
    scores,
    round: 1,
    lastWord: '',
    lastExplainer: '',
    usedWords: [idx],
  };
}

export type CrocAction =
  | { type: 'guessed'; guesserHash: string }
  | { type: 'skip' }
  | { type: 'next' };

export function applyCrocAction(state: CrocState, actorHash: string, action: CrocAction): { ok: boolean; error?: string } {
  if (state.status !== 'playing') return { ok: false, error: 'Игра окончена' };

  if (action.type === 'guessed') {
    if (actorHash !== state.explainerHash) return { ok: false, error: 'Только объясняющий отмечает' };
    const guesserHash = action.guesserHash;
    if (state.playerOrder.includes(guesserHash)) {
      state.scores[guesserHash] = (state.scores[guesserHash] || 0) + 2;
      state.scores[state.explainerHash] = (state.scores[state.explainerHash] || 0) + 1;
    }
    state.lastWord = state.word;
    state.lastExplainer = state.explainerHash;
    state.phase = 'between';
    return { ok: true };
  }

  if (action.type === 'skip') {
    if (actorHash !== state.explainerHash) return { ok: false, error: 'Только объясняющий может пропустить' };
    state.lastWord = state.word;
    state.lastExplainer = state.explainerHash;
    state.phase = 'between';
    return { ok: true };
  }

  if (action.type === 'next') {
    if (state.phase !== 'between') return { ok: false, error: 'Сначала закончи раунд' };
    const idx = state.playerOrder.indexOf(state.explainerHash);
    state.explainerHash = state.playerOrder[(idx + 1) % state.playerOrder.length];
    const { word, idx: wi } = pickWord(state.usedWords);
    state.word = word;
    state.usedWords.push(wi);
    if (state.usedWords.length > WORDS.length - 5) state.usedWords = [];
    state.phase = 'explain';
    if (state.explainerHash === state.playerOrder[0]) state.round++;
    if (state.round > 5) {
      state.status = 'ended';
    }
    return { ok: true };
  }

  return { ok: false, error: 'Неизвестное действие' };
}

export function sanitizeCrocForPlayer(state: CrocState, playerHash: string): object {
  return {
    gameId: state.gameId, gameType: state.gameType, status: state.status, phase: state.phase,
    playerOrder: state.playerOrder, players: state.players,
    explainerHash: state.explainerHash,
    word: playerHash === state.explainerHash ? state.word : undefined,
    scores: state.scores, round: state.round,
    lastWord: state.lastWord, lastExplainer: state.lastExplainer,
    isExplainer: playerHash === state.explainerHash,
  };
}
