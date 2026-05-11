export type MafiaRole = 'mafia' | 'civilian' | 'doctor' | 'sheriff';
export type MafiaPhase = 'night_mafia' | 'night_doctor' | 'night_sheriff' | 'day' | 'vote' | 'ended';

export interface PlayerInfo { hash: string; name: string; avatar: string; }

export interface MafiaState {
  gameId: string;
  gameType: 'mafia';
  status: 'playing' | 'ended';
  phase: MafiaPhase;
  roles: Record<string, MafiaRole>;
  alive: string[];
  dead: { hash: string; role: MafiaRole; name: string }[];
  nightActions: { mafiaKill: string | null; doctorSave: string | null; sheriffCheck: string | null };
  votes: Record<string, string>;
  lastEvent: string;
  winner: 'mafia' | 'civilians' | null;
  players: Record<string, PlayerInfo>;
  playerOrder: string[];
  sheriffReveal: { hash: string; isMafia: boolean } | null;
  dayCount: number;
  eliminatedThisRound: string | null;
}

function shuffle<T>(a: T[]): T[] {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function assignRoles(playerOrder: string[], n: number): Record<string, MafiaRole> {
  const shuffled = shuffle([...playerOrder]);
  const roles: Record<string, MafiaRole> = {};
  const mafiaCount = Math.max(1, Math.floor(n / 4));
  let i = 0;
  for (; i < mafiaCount; i++) roles[shuffled[i]] = 'mafia';
  if (n >= 4) roles[shuffled[i++]] = 'doctor';
  if (n >= 5) roles[shuffled[i++]] = 'sheriff';
  for (; i < n; i++) roles[shuffled[i]] = 'civilian';
  return roles;
}

function checkWin(state: MafiaState): boolean {
  const aliveMafia = state.alive.filter(h => state.roles[h] === 'mafia').length;
  const aliveCivilian = state.alive.filter(h => state.roles[h] !== 'mafia').length;
  if (aliveMafia === 0) {
    state.status = 'ended'; state.phase = 'ended'; state.winner = 'civilians';
    state.lastEvent = '🎉 Мирные жители победили! Мафия уничтожена.';
    return true;
  }
  if (aliveMafia >= aliveCivilian) {
    state.status = 'ended'; state.phase = 'ended'; state.winner = 'mafia';
    state.lastEvent = '🔫 Мафия захватила город! Мирные проиграли.';
    return true;
  }
  return false;
}

function nextNightPhase(state: MafiaState): void {
  const doctorAlive = state.alive.some(h => state.roles[h] === 'doctor');
  const sheriffAlive = state.alive.some(h => state.roles[h] === 'sheriff');
  if (state.phase === 'night_mafia') {
    state.phase = doctorAlive ? 'night_doctor' : sheriffAlive ? 'night_sheriff' : 'day';
    if (state.phase === 'day') resolveNight(state);
  } else if (state.phase === 'night_doctor') {
    state.phase = sheriffAlive ? 'night_sheriff' : 'day';
    if (state.phase === 'day') resolveNight(state);
  } else if (state.phase === 'night_sheriff') {
    state.phase = 'day';
    resolveNight(state);
  }
}

function resolveNight(state: MafiaState): void {
  const killed = state.nightActions.mafiaKill;
  const saved = state.nightActions.doctorSave;
  if (killed && killed !== saved && state.alive.includes(killed)) {
    const role = state.roles[killed];
    state.dead.push({ hash: killed, role, name: state.players[killed]?.name || '?' });
    state.alive = state.alive.filter(h => h !== killed);
    state.eliminatedThisRound = killed;
    state.lastEvent = `🔪 ${state.players[killed]?.name || '?'} убит этой ночью. Его роль: ${roleLabel(role)}`;
  } else if (killed && killed === saved) {
    state.eliminatedThisRound = null;
    state.lastEvent = '🏥 Доктор спас жертву — этой ночью никто не погиб!';
  } else {
    state.eliminatedThisRound = null;
    state.lastEvent = '🌙 Тихая ночь — никто не погиб.';
  }
  if (state.nightActions.sheriffCheck) {
    const ch = state.nightActions.sheriffCheck;
    state.sheriffReveal = { hash: ch, isMafia: state.roles[ch] === 'mafia' };
  } else {
    state.sheriffReveal = null;
  }
  state.nightActions = { mafiaKill: null, doctorSave: null, sheriffCheck: null };
  state.votes = {};
  state.dayCount++;
  checkWin(state);
}

function resolveVote(state: MafiaState): void {
  const counts: Record<string, number> = {};
  for (const v of Object.values(state.votes)) { counts[v] = (counts[v] || 0) + 1; }
  let maxVotes = 0, topCandidates: string[] = [];
  for (const [h, c] of Object.entries(counts)) {
    if (c > maxVotes) { maxVotes = c; topCandidates = [h]; }
    else if (c === maxVotes) topCandidates.push(h);
  }
  if (topCandidates.length === 1) {
    const eliminated = topCandidates[0];
    const role = state.roles[eliminated];
    state.dead.push({ hash: eliminated, role, name: state.players[eliminated]?.name || '?' });
    state.alive = state.alive.filter(h => h !== eliminated);
    state.eliminatedThisRound = eliminated;
    state.lastEvent = `🗳️ Город проголосовал: ${state.players[eliminated]?.name || '?'} исключён! Его роль: ${roleLabel(role)}`;
  } else {
    state.eliminatedThisRound = null;
    state.lastEvent = '🗳️ Голоса разделились — никто не исключён!';
  }
  state.votes = {};
  if (!checkWin(state)) {
    state.phase = 'night_mafia';
  }
}

function roleLabel(r: MafiaRole): string {
  return r === 'mafia' ? '🔫 Мафия' : r === 'doctor' ? '🏥 Доктор' : r === 'sheriff' ? '🔍 Шериф' : '👤 Мирный';
}

export function createMafiaGame(players: PlayerInfo[]): MafiaState {
  if (players.length < 4) throw new Error('Нужно минимум 4 игрока');
  const playerOrder = shuffle(players.map(p => p.hash));
  const roles = assignRoles(playerOrder, players.length);
  const playersMap: Record<string, PlayerInfo> = {};
  for (const p of players) playersMap[p.hash] = p;
  return {
    gameId: Math.random().toString(36).slice(2, 8),
    gameType: 'mafia',
    status: 'playing',
    phase: 'night_mafia',
    roles,
    alive: [...playerOrder],
    dead: [],
    nightActions: { mafiaKill: null, doctorSave: null, sheriffCheck: null },
    votes: {},
    lastEvent: '🌙 Первая ночь... Мафия выходит на охоту!',
    winner: null,
    players: playersMap,
    playerOrder,
    sheriffReveal: null,
    dayCount: 0,
    eliminatedThisRound: null,
  };
}

export type MafiaAction =
  | { type: 'mafia_kill'; target: string }
  | { type: 'doctor_save'; target: string }
  | { type: 'sheriff_check'; target: string }
  | { type: 'vote'; target: string };

export function applyMafiaAction(state: MafiaState, actorHash: string, action: MafiaAction): { ok: boolean; error?: string } {
  if (state.status !== 'playing') return { ok: false, error: 'Игра окончена' };
  if (!state.alive.includes(actorHash)) return { ok: false, error: 'Ты уже выбыл из игры' };

  if (action.type === 'mafia_kill') {
    if (state.phase !== 'night_mafia') return { ok: false, error: 'Сейчас не ночь Мафии' };
    if (state.roles[actorHash] !== 'mafia') return { ok: false, error: 'Ты не Мафия' };
    if (!state.alive.includes(action.target) || state.roles[action.target] === 'mafia') return { ok: false, error: 'Недопустимая цель' };
    state.nightActions.mafiaKill = action.target;
    nextNightPhase(state);
    return { ok: true };
  }

  if (action.type === 'doctor_save') {
    if (state.phase !== 'night_doctor') return { ok: false, error: 'Сейчас не ночь Доктора' };
    if (state.roles[actorHash] !== 'doctor') return { ok: false, error: 'Ты не Доктор' };
    if (!state.alive.includes(action.target)) return { ok: false, error: 'Недопустимая цель' };
    state.nightActions.doctorSave = action.target;
    nextNightPhase(state);
    return { ok: true };
  }

  if (action.type === 'sheriff_check') {
    if (state.phase !== 'night_sheriff') return { ok: false, error: 'Сейчас не ночь Шерифа' };
    if (state.roles[actorHash] !== 'sheriff') return { ok: false, error: 'Ты не Шериф' };
    if (!state.alive.includes(action.target) || action.target === actorHash) return { ok: false, error: 'Недопустимая цель' };
    state.nightActions.sheriffCheck = action.target;
    nextNightPhase(state);
    return { ok: true };
  }

  if (action.type === 'vote') {
    if (state.phase !== 'vote') return { ok: false, error: 'Сейчас не голосование' };
    if (!state.alive.includes(action.target) || action.target === actorHash) return { ok: false, error: 'Недопустимая цель' };
    state.votes[actorHash] = action.target;
    if (Object.keys(state.votes).length >= state.alive.length) {
      resolveVote(state);
    }
    return { ok: true };
  }

  return { ok: false, error: 'Неизвестное действие' };
}

export function sanitizeMafiaForPlayer(state: MafiaState, playerHash: string): object {
  const myRole = state.roles[playerHash];
  const mafiaTeam = myRole === 'mafia'
    ? Object.entries(state.roles).filter(([_, r]) => r === 'mafia').map(([h]) => h)
    : undefined;
  const sheriffResult = (myRole === 'sheriff' && state.phase === 'day' && state.sheriffReveal)
    ? state.sheriffReveal : undefined;
  const myVote = state.votes[playerHash] ?? null;

  const nightActed: Record<string, boolean> = {
    mafiaActed: !!state.nightActions.mafiaKill,
    doctorActed: !!state.nightActions.doctorSave,
    sheriffActed: !!state.nightActions.sheriffCheck,
  };

  return {
    gameId: state.gameId,
    gameType: 'mafia',
    status: state.status,
    phase: state.phase,
    myRole,
    mafiaTeam,
    alive: state.alive,
    dead: state.dead,
    lastEvent: state.lastEvent,
    players: state.players,
    playerOrder: state.playerOrder,
    winner: state.winner,
    votes: state.votes,
    myVote,
    dayCount: state.dayCount,
    sheriffResult,
    eliminatedThisRound: state.eliminatedThisRound,
    nightActed,
  };
}
