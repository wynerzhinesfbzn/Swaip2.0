const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK: Record<string, number> = {};
VALUES.forEach((v, i) => { RANK[v] = i; });

export interface Card { suit: string; value: string; id: string; }
export interface PlayerInfo { hash: string; name: string; avatar: string; }

export interface WarState {
  gameId: string;
  gameType: 'pyanitsa';
  status: 'playing' | 'ended';
  piles: Record<string, Card[]>;
  table: Record<string, Card | null>;
  warPile: Card[];
  roundWinner: string | 'war' | null;
  playerOrder: string[];
  players: Record<string, PlayerInfo>;
  winner: string | null;
  readyToFlip: string[];
  round: number;
}

function shuffle<T>(a: T[]): T[] {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeDeck(): Card[] {
  const cards: Card[] = [];
  for (const s of SUITS) for (const v of VALUES) cards.push({ suit: s, value: v, id: `${v}${s}` });
  return shuffle(cards);
}

export function createWarGame(players: PlayerInfo[]): WarState {
  if (players.length !== 2) throw new Error('Пьяница — игра для двоих');
  const deck = makeDeck();
  const half = Math.floor(deck.length / 2);
  const [p1, p2] = shuffle(players);
  const piles: Record<string, Card[]> = {
    [p1.hash]: deck.slice(0, half),
    [p2.hash]: deck.slice(half),
  };
  const playersMap: Record<string, PlayerInfo> = {};
  for (const p of players) playersMap[p.hash] = p;
  return {
    gameId: Math.random().toString(36).slice(2, 8),
    gameType: 'pyanitsa',
    status: 'playing',
    piles,
    table: { [p1.hash]: null, [p2.hash]: null },
    warPile: [],
    roundWinner: null,
    playerOrder: [p1.hash, p2.hash],
    players: playersMap,
    winner: null,
    readyToFlip: [],
    round: 1,
  };
}

export function applyWarAction(state: WarState, actorHash: string, action: { type: 'flip' }): { ok: boolean; error?: string } {
  if (state.status !== 'playing') return { ok: false, error: 'Игра окончена' };
  if (action.type !== 'flip') return { ok: false, error: 'Неизвестное действие' };
  if (state.readyToFlip.includes(actorHash)) return { ok: false, error: 'Уже ждём другого игрока' };
  if (!state.piles[actorHash]?.length) return { ok: false, error: 'Карт нет' };

  state.readyToFlip.push(actorHash);

  if (state.readyToFlip.length >= 2) {
    const [h1, h2] = state.playerOrder;
    const c1 = state.piles[h1].shift()!;
    const c2 = state.piles[h2].shift()!;
    state.table = { [h1]: c1, [h2]: c2 };
    state.readyToFlip = [];

    const r1 = RANK[c1.value], r2 = RANK[c2.value];
    if (r1 > r2) {
      state.roundWinner = h1;
      state.piles[h1].push(...shuffle([c1, c2, ...state.warPile]));
      state.warPile = [];
    } else if (r2 > r1) {
      state.roundWinner = h2;
      state.piles[h2].push(...shuffle([c2, c1, ...state.warPile]));
      state.warPile = [];
    } else {
      state.roundWinner = 'war';
      state.warPile.push(c1, c2);
    }

    state.round++;

    if (!state.piles[h1].length && !state.piles[h2].length) {
      state.status = 'ended'; state.winner = null;
    } else if (!state.piles[h1].length) {
      state.status = 'ended'; state.winner = h2;
    } else if (!state.piles[h2].length) {
      state.status = 'ended'; state.winner = h1;
    } else if (state.round > 600) {
      state.status = 'ended';
      const s1 = state.piles[h1].length, s2 = state.piles[h2].length;
      state.winner = s1 > s2 ? h1 : s2 > s1 ? h2 : null;
    }
  }

  return { ok: true };
}

export function sanitizeWarForPlayer(state: WarState, _playerHash: string): object {
  const pileSizes: Record<string, number> = {};
  for (const [h, pile] of Object.entries(state.piles)) pileSizes[h] = pile.length;
  return {
    gameId: state.gameId,
    gameType: state.gameType,
    status: state.status,
    table: state.table,
    pileSizes,
    warPileSize: state.warPile.length,
    roundWinner: state.roundWinner,
    playerOrder: state.playerOrder,
    players: state.players,
    winner: state.winner,
    round: state.round,
    readyToFlip: state.readyToFlip,
  };
}
