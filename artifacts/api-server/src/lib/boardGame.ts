export interface PlayerInfo { hash: string; name: string; avatar: string; }

const TOTAL = 40;
const COLORS = ['#6366f1','#ef4444','#22c55e','#f59e0b'];

// Special cells: key=landing cell, value=effect
const SPECIALS: Record<number, { type: 'ladder'|'snake'|'bonus'|'skip'; to?: number; label: string }> = {
  4:  { type: 'ladder', to: 14,  label: '🪜 Лестница! +10' },
  9:  { type: 'ladder', to: 26,  label: '🪜 Лестница! +17' },
  20: { type: 'ladder', to: 32,  label: '🪜 Лестница! +12' },
  28: { type: 'ladder', to: 37,  label: '🪜 Лестница! +9' },
  17: { type: 'snake',  to: 7,   label: '🐍 Змея! -10' },
  22: { type: 'snake',  to: 3,   label: '🐍 Змея! -19' },
  31: { type: 'snake',  to: 19,  label: '🐍 Змея! -12' },
  35: { type: 'snake',  to: 11,  label: '🐍 Змея! -24' },
  13: { type: 'bonus',  label: '⭐ Бонус! ход ещё раз' },
  25: { type: 'bonus',  label: '⭐ Бонус! ход ещё раз' },
  8:  { type: 'skip',   label: '💤 Пропускаешь ход' },
  16: { type: 'skip',   label: '💤 Пропускаешь ход' },
  30: { type: 'skip',   label: '💤 Пропускаешь ход' },
};

interface BoardPlayer { hash: string; name: string; color: string; pos: number; skipNext: boolean; }
export interface BoardGameState {
  status: 'waiting' | 'playing' | 'ended';
  players: BoardPlayer[];
  currentHash: string;
  lastDice: number | null;
  lastEffect: string | null;
  needsRoll: boolean;
  winner: string | null;
  winnerName: string | null;
  total: number;
  specials: typeof SPECIALS;
}

export function createBoardGame(players: PlayerInfo[]): BoardGameState {
  if (players.length < 2 || players.length > 4) throw new Error('Ходилка: 2–4 игрока');
  return {
    status: 'playing',
    players: players.map((p, i) => ({ hash: p.hash, name: p.name, color: COLORS[i], pos: 0, skipNext: false })),
    currentHash: players[0].hash,
    lastDice: null, lastEffect: null,
    needsRoll: true,
    winner: null, winnerName: null,
    total: TOTAL,
    specials: SPECIALS,
  };
}

export function applyBoardAction(state: BoardGameState, hash: string, action: any): { ok: boolean; error?: string } {
  if (state.status !== 'playing') return { ok: false, error: 'Игра не идёт' };
  if (state.currentHash !== hash) return { ok: false, error: 'Не ваш ход' };
  if (action.type !== 'roll') return { ok: false, error: 'Бросьте кубик' };
  if (!state.needsRoll) return { ok: false, error: 'Ждите' };

  const pidx = state.players.findIndex(p => p.hash === hash);
  const player = state.players[pidx];

  // Skip turn?
  if (player.skipNext) {
    player.skipNext = false;
    state.lastEffect = '💤 Ход пропущен';
    state.lastDice = null;
    state.needsRoll = true;
    nextTurn(state);
    return { ok: true };
  }

  const dice = Math.floor(Math.random() * 6) + 1;
  state.lastDice = dice;

  let newPos = player.pos + dice;
  if (newPos > TOTAL) newPos = player.pos; // exact landing rule (can't overshoot)
  player.pos = newPos;

  // Check win
  if (newPos >= TOTAL) {
    state.status = 'ended';
    state.winner = player.hash;
    state.winnerName = player.name;
    state.lastEffect = `🏆 ${player.name} победил!`;
    state.needsRoll = false;
    return { ok: true };
  }

  // Apply special
  const spec = SPECIALS[newPos];
  let extraTurn = false;
  if (spec) {
    state.lastEffect = spec.label;
    if (spec.type === 'ladder' || spec.type === 'snake') {
      player.pos = spec.to!;
    } else if (spec.type === 'bonus') {
      extraTurn = true;
    } else if (spec.type === 'skip') {
      player.skipNext = true;
    }
  } else {
    state.lastEffect = null;
  }

  if (extraTurn) {
    state.needsRoll = true; // same player goes again
  } else {
    state.needsRoll = true;
    nextTurn(state);
  }

  return { ok: true };
}

function nextTurn(state: BoardGameState) {
  const idx = state.players.findIndex(p => p.hash === state.currentHash);
  state.currentHash = state.players[(idx + 1) % state.players.length].hash;
}

export function sanitizeBoardForPlayer(state: BoardGameState, _h: string): BoardGameState { return state; }
