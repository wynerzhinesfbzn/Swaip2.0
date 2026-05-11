export interface Domino { left: number; right: number; id: string; }
export interface PlayerInfo { hash: string; name: string; avatar: string; }

export interface BoardPiece { domino: Domino; flipped: boolean; }

export interface DominoState {
  gameId: string;
  gameType: 'domino';
  status: 'playing' | 'ended';
  hands: Record<string, Domino[]>;
  drawPile: Domino[];
  board: BoardPiece[];
  leftEnd: number;
  rightEnd: number;
  boardEmpty: boolean;
  currentHash: string;
  playerOrder: string[];
  players: Record<string, PlayerInfo>;
  consecutivePasses: number;
  winner: string | null;
  lastAction: string;
}

function makeDominoes(): Domino[] {
  const pieces: Domino[] = [];
  for (let i = 0; i <= 6; i++) {
    for (let j = i; j <= 6; j++) {
      pieces.push({ left: i, right: j, id: `${i}-${j}` });
    }
  }
  return shuffle(pieces);
}

function shuffle<T>(a: T[]): T[] {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function findStartPlayer(hands: Record<string, Domino[]>, playerOrder: string[]): { hash: string; domino: Domino } {
  let bestHash = playerOrder[0];
  let bestDom = hands[playerOrder[0]][0];
  let bestVal = -1;
  // Find highest double
  for (const hash of playerOrder) {
    for (const d of hands[hash]) {
      if (d.left === d.right && d.left > bestVal) {
        bestVal = d.left; bestDom = d; bestHash = hash;
      }
    }
  }
  // If no double, find highest total
  if (bestVal === -1) {
    for (const hash of playerOrder) {
      for (const d of hands[hash]) {
        const v = d.left + d.right;
        if (v > bestVal) { bestVal = v; bestDom = d; bestHash = hash; }
      }
    }
  }
  return { hash: bestHash, domino: bestDom };
}

export function createDominoGame(players: PlayerInfo[]): DominoState {
  if (players.length < 2 || players.length > 4) throw new Error('Домино: 2–4 игрока');
  const pieces = makeDominoes();
  const cardsEach = players.length === 2 ? 7 : players.length === 3 ? 6 : 5;
  const playerOrder = shuffle(players.map(p => p.hash));
  const hands: Record<string, Domino[]> = {};
  let idx = 0;
  for (const hash of playerOrder) {
    hands[hash] = pieces.splice(0, cardsEach);
    idx++;
  }
  const drawPile = [...pieces];
  const playersMap: Record<string, PlayerInfo> = {};
  for (const p of players) playersMap[p.hash] = p;

  const { hash: startHash, domino: startDomino } = findStartPlayer(hands, playerOrder);
  hands[startHash] = hands[startHash].filter(d => d.id !== startDomino.id);
  const startIdx = playerOrder.indexOf(startHash);
  const nextHash = playerOrder[(startIdx + 1) % playerOrder.length];

  return {
    gameId: Math.random().toString(36).slice(2, 8),
    gameType: 'domino',
    status: 'playing',
    hands,
    drawPile,
    board: [{ domino: startDomino, flipped: false }],
    leftEnd: startDomino.left,
    rightEnd: startDomino.right,
    boardEmpty: false,
    currentHash: nextHash,
    playerOrder,
    players: playersMap,
    consecutivePasses: 0,
    winner: null,
    lastAction: `${playersMap[startHash]?.name} начинает: [${startDomino.left}|${startDomino.right}]`,
  };
}

function nextPlayer(state: DominoState): string {
  const active = state.playerOrder.filter(h => state.hands[h] !== undefined);
  const idx = active.indexOf(state.currentHash);
  return active[(idx + 1) % active.length];
}

function canPlay(state: DominoState, d: Domino): boolean {
  if (state.boardEmpty) return true;
  return d.left === state.leftEnd || d.right === state.leftEnd ||
         d.left === state.rightEnd || d.right === state.rightEnd;
}

function checkWin(state: DominoState): void {
  if ((state.hands[state.currentHash] || []).length === 0) {
    state.status = 'ended';
    state.winner = state.currentHash;
    return;
  }
  // All players passed = stuck game
  if (state.consecutivePasses >= state.playerOrder.length) {
    state.status = 'ended';
    let minPips = Infinity;
    for (const hash of state.playerOrder) {
      const total = (state.hands[hash] || []).reduce((s, d) => s + d.left + d.right, 0);
      if (total < minPips) { minPips = total; state.winner = hash; }
    }
  }
}

export type DominoAction =
  | { type: 'place'; dominoId: string; side: 'left' | 'right' }
  | { type: 'draw' }
  | { type: 'pass' };

export function applyDominoAction(state: DominoState, actorHash: string, action: DominoAction): { ok: boolean; error?: string } {
  if (state.status !== 'playing') return { ok: false, error: 'Игра окончена' };
  if (actorHash !== state.currentHash) return { ok: false, error: 'Не твой ход' };

  if (action.type === 'place') {
    const hand = state.hands[actorHash];
    const domIdx = hand.findIndex(d => d.id === action.dominoId);
    if (domIdx < 0) return { ok: false, error: 'Домино не найдено' };
    const dom = hand[domIdx];

    if (state.boardEmpty) {
      hand.splice(domIdx, 1);
      state.board = [{ domino: dom, flipped: false }];
      state.leftEnd = dom.left; state.rightEnd = dom.right; state.boardEmpty = false;
    } else if (action.side === 'left') {
      if (dom.right === state.leftEnd) {
        hand.splice(domIdx, 1);
        state.board.unshift({ domino: dom, flipped: false });
        state.leftEnd = dom.left;
      } else if (dom.left === state.leftEnd) {
        hand.splice(domIdx, 1);
        state.board.unshift({ domino: { ...dom, left: dom.right, right: dom.left }, flipped: true });
        state.leftEnd = dom.right;
      } else {
        return { ok: false, error: 'Домино не подходит к этому концу' };
      }
    } else {
      if (dom.left === state.rightEnd) {
        hand.splice(domIdx, 1);
        state.board.push({ domino: dom, flipped: false });
        state.rightEnd = dom.right;
      } else if (dom.right === state.rightEnd) {
        hand.splice(domIdx, 1);
        state.board.push({ domino: { ...dom, left: dom.right, right: dom.left }, flipped: true });
        state.rightEnd = dom.left;
      } else {
        return { ok: false, error: 'Домино не подходит к этому концу' };
      }
    }

    state.consecutivePasses = 0;
    const pname = state.players[actorHash]?.name || '?';
    state.lastAction = `${pname} поставил [${dom.left}|${dom.right}]`;
    checkWin(state);
    const s1 = state as DominoState;
    if (s1.status !== 'ended') s1.currentHash = nextPlayer(state);
    return { ok: true };
  }

  if (action.type === 'draw') {
    if (!state.drawPile.length) return { ok: false, error: 'Резерв пуст — пасуй' };
    const drawn = state.drawPile.shift()!;
    state.hands[actorHash].push(drawn);
    state.lastAction = `${state.players[actorHash]?.name || '?'} взял из резерва`;
    // If the drawn domino can be played, player must play this turn still
    return { ok: true };
  }

  if (action.type === 'pass') {
    const hand = state.hands[actorHash] || [];
    const hasPlayable = hand.some(d => canPlay(state, d));
    if (hasPlayable && state.drawPile.length > 0) return { ok: false, error: 'Есть ходы или можно взять из резерва' };
    state.consecutivePasses++;
    state.lastAction = `${state.players[actorHash]?.name || '?'} пасует`;
    checkWin(state);
    const s2 = state as DominoState;
    if (s2.status !== 'ended') s2.currentHash = nextPlayer(state);
    return { ok: true };
  }

  return { ok: false, error: 'Неизвестное действие' };
}

export function sanitizeDominoForPlayer(state: DominoState, playerHash: string): object {
  const handSizes: Record<string, number> = {};
  for (const [h, hand] of Object.entries(state.hands)) handSizes[h] = hand.length;
  return {
    gameId: state.gameId,
    gameType: 'domino',
    status: state.status,
    board: state.board,
    leftEnd: state.leftEnd,
    rightEnd: state.rightEnd,
    boardEmpty: state.boardEmpty,
    drawPileSize: state.drawPile.length,
    currentHash: state.currentHash,
    playerOrder: state.playerOrder,
    players: state.players,
    winner: state.winner,
    lastAction: state.lastAction,
    handSizes,
    myHand: state.hands[playerHash] || [],
    consecutivePasses: state.consecutivePasses,
  };
}
