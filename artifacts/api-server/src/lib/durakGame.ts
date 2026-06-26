const SUITS = ['♠', '♥', '♦', '♣'];
const VALUES = ['6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const VALUE_RANK: Record<string, number> = {};
VALUES.forEach((v, i) => { VALUE_RANK[v] = i; });

export interface Card { suit: string; value: string; id: string; }
export interface AttackSlot { attack: Card; defense: Card | null; }
export interface PlayerInfo { hash: string; name: string; avatar: string; }

export interface DurakState {
  gameId: string;
  status: 'waiting' | 'playing' | 'ended';
  phase: 'attack' | 'defend';
  deckCount: number;
  trumpSuit: string;
  trumpCard: Card;
  hands: Record<string, Card[]>;
  table: AttackSlot[];
  attackerHash: string;
  defenderHash: string;
  playerOrder: string[];
  players: Record<string, PlayerInfo>;
  winners: string[];
  durak: string | null;
  passedHashes: string[];
  readyHashes: string[];
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
  for (const suit of SUITS) for (const value of VALUES) {
    cards.push({ suit, value, id: `${value}${suit}` });
  }
  return shuffle(cards);
}

function canDefend(attack: Card, def: Card, trump: string): boolean {
  if (def.suit === attack.suit) return VALUE_RANK[def.value] > VALUE_RANK[attack.value];
  if (def.suit === trump && attack.suit !== trump) return true;
  return false;
}

function activePlayers(state: DurakState): string[] {
  return state.playerOrder.filter(h => !state.winners.includes(h));
}

function nextActive(state: DurakState, fromHash: string, skip?: string): string {
  const order = state.playerOrder;
  let idx = order.indexOf(fromHash);
  for (let i = 0; i < order.length; i++) {
    idx = (idx + 1) % order.length;
    const h = order[idx];
    if (!state.winners.includes(h) && h !== skip) return h;
  }
  return fromHash;
}

function drawUp(state: DurakState, deck: Card[]): void {
  const drawOrder = [
    state.attackerHash,
    ...state.playerOrder.filter(h => h !== state.attackerHash && h !== state.defenderHash && !state.winners.includes(h)),
    state.defenderHash,
  ];
  for (const hash of drawOrder) {
    if (state.winners.includes(hash)) continue;
    while (state.hands[hash].length < 6 && deck.length > 0) {
      state.hands[hash].push(deck.shift()!);
    }
  }
  state.deckCount = deck.length;
  for (const hash of state.playerOrder) {
    if (!state.winners.includes(hash) && state.hands[hash].length === 0 && deck.length === 0) {
      state.winners.push(hash);
    }
  }
}

function endRound(state: DurakState, deck: Card[], defenderTook: boolean): void {
  drawUp(state, deck);
  const active = activePlayers(state);
  if (active.length <= 1) {
    state.status = 'ended';
    state.durak = active[0] ?? null;
    return;
  }
  if (defenderTook) {
    const newAtt = nextActive(state, state.defenderHash);
    const newDef = nextActive(state, newAtt);
    state.attackerHash = newAtt;
    state.defenderHash = newDef;
  } else {
    const newAtt = state.defenderHash;
    const newDef = nextActive(state, newAtt);
    state.attackerHash = newAtt;
    state.defenderHash = newDef;
  }
  state.table = [];
  state.passedHashes = [];
  state.phase = 'attack';
}

export function createGame(playerInfoList: PlayerInfo[]): { state: DurakState; deck: Card[] } {
  if (playerInfoList.length < 2) throw new Error('Need at least 2 players');
  const deck = makeDeck();
  const trumpCard = deck[deck.length - 1];
  const trump = trumpCard.suit;
  const playerOrder = shuffle(playerInfoList.map(p => p.hash));
  const hands: Record<string, Card[]> = {};
  for (const hash of playerOrder) hands[hash] = deck.splice(0, 6);

  let attackerIdx = 0;
  let lowestRank = 99;
  playerOrder.forEach((hash, idx) => {
    for (const card of hands[hash]) {
      if (card.suit === trump && VALUE_RANK[card.value] < lowestRank) {
        lowestRank = VALUE_RANK[card.value];
        attackerIdx = idx;
      }
    }
  });
  const defenderIdx = (attackerIdx + 1) % playerOrder.length;
  const players: Record<string, PlayerInfo> = {};
  for (const p of playerInfoList) players[p.hash] = p;

  const state: DurakState = {
    gameId: Math.random().toString(36).slice(2, 10),
    status: 'playing',
    phase: 'attack',
    deckCount: deck.length,
    trumpSuit: trump,
    trumpCard,
    hands,
    table: [],
    attackerHash: playerOrder[attackerIdx],
    defenderHash: playerOrder[defenderIdx],
    playerOrder,
    players,
    winners: [],
    durak: null,
    passedHashes: [],
    readyHashes: [],
  };
  return { state, deck };
}

export type GameAction =
  | { type: 'attack'; cardId: string }
  | { type: 'defend'; attackCardId: string; defenseCardId: string }
  | { type: 'pass' }
  | { type: 'take' };

function removeCard(hand: Card[], cardId: string): Card | null {
  const idx = hand.findIndex(c => c.id === cardId);
  if (idx < 0) return null;
  return hand.splice(idx, 1)[0];
}

export function applyAction(
  state: DurakState, deck: Card[], actorHash: string, action: GameAction
): { ok: boolean; error?: string } {
  if (state.status !== 'playing') return { ok: false, error: 'Игра не идёт' };

  if (action.type === 'attack') {
    const isAttacker = actorHash === state.attackerHash;
    const isHelper = state.table.length > 0 && actorHash !== state.defenderHash && !state.winners.includes(actorHash);
    if (!isAttacker && !isHelper) return { ok: false, error: 'Сейчас не твой ход' };
    if (state.phase === 'defend' && isHelper) {
      const tableVals = new Set(state.table.flatMap(s => [s.attack.value, s.defense?.value].filter(Boolean) as string[]));
      const card = state.hands[actorHash]?.find(c => c.id === action.cardId);
      if (!card || !tableVals.has(card.value)) return { ok: false, error: 'Можно добавить только карту такого же достоинства' };
    } else if (state.phase !== 'attack' && isAttacker) {
      return { ok: false, error: 'Дождись защиты' };
    }
    const card = removeCard(state.hands[actorHash] ?? [], action.cardId);
    if (!card) return { ok: false, error: 'Карта не найдена' };
    state.table.push({ attack: card, defense: null });
    state.phase = 'defend';
    return { ok: true };
  }

  if (action.type === 'defend') {
    if (actorHash !== state.defenderHash) return { ok: false, error: 'Ты не защищаешься' };
    const slot = state.table.find(s => s.attack.id === action.attackCardId && !s.defense);
    if (!slot) return { ok: false, error: 'Карта атаки не найдена' };
    const defCard = removeCard(state.hands[actorHash] ?? [], action.defenseCardId);
    if (!defCard) return { ok: false, error: 'Защитная карта не найдена' };
    if (!canDefend(slot.attack, defCard, state.trumpSuit)) {
      state.hands[actorHash].push(defCard);
      return { ok: false, error: 'Нельзя отбиться этой картой' };
    }
    slot.defense = defCard;
    if (state.table.every(s => s.defense)) state.phase = 'attack';
    return { ok: true };
  }

  if (action.type === 'pass') {
    if (actorHash === state.defenderHash) return { ok: false, error: 'Защищающийся не может пасовать' };
    if (!state.passedHashes.includes(actorHash)) state.passedHashes.push(actorHash);
    const attackers = activePlayers(state).filter(h => h !== state.defenderHash);
    if (state.passedHashes.length >= attackers.length && state.table.every(s => s.defense)) {
      endRound(state, deck, false);
    }
    return { ok: true };
  }

  if (action.type === 'take') {
    if (actorHash !== state.defenderHash) return { ok: false, error: 'Ты не защищаешься' };
    const allCards = state.table.flatMap(s => [s.attack, s.defense].filter(Boolean) as Card[]);
    state.hands[actorHash].push(...allCards);
    const newAtt = nextActive(state, state.defenderHash, state.defenderHash);
    const oldDef = state.defenderHash;
    state.attackerHash = newAtt;
    state.defenderHash = nextActive(state, newAtt, newAtt);
    state.table = [];
    state.passedHashes = [];
    state.phase = 'attack';
    drawUp(state, deck);
    if (activePlayers(state).length <= 1) {
      state.status = 'ended';
      state.durak = activePlayers(state)[0] ?? oldDef;
    }
    return { ok: true };
  }

  return { ok: false, error: 'Неизвестное действие' };
}

export function sanitizeForPlayer(state: DurakState, playerHash: string): object {
  const handSizes: Record<string, number> = {};
  for (const [h, hand] of Object.entries(state.hands)) handSizes[h] = hand.length;
  return {
    gameId: state.gameId,
    status: state.status,
    phase: state.phase,
    deckCount: state.deckCount,
    trumpSuit: state.trumpSuit,
    trumpCard: state.trumpCard,
    table: state.table,
    attackerHash: state.attackerHash,
    defenderHash: state.defenderHash,
    playerOrder: state.playerOrder,
    players: state.players,
    winners: state.winners,
    durak: state.durak,
    handSizes,
    myHand: state.hands[playerHash] || [],
    passedHashes: state.passedHashes,
  };
}
