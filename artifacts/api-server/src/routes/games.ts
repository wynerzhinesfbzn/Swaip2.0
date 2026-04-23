import { Router } from "express";
import { requireSession } from "../lib/sessionAuth.js";

const router = Router();

function genId() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

/* ── Types ── */
type GameType = "battleship" | "chess" | "checkers" | "durak";
type GameStatus = "pending" | "active" | "finished" | "declined";

interface GameSession {
  id: string;
  type: GameType;
  convId: number;
  hostHash: string;
  players: string[];
  status: GameStatus;
  state: Record<string, unknown>;
  winner: string | null;
  createdAt: number;
  expiresAt: number;
}

const games = new Map<string, GameSession>();

setInterval(() => {
  const now = Date.now();
  for (const [id, g] of games.entries()) if (g.expiresAt < now) games.delete(id);
}, 10 * 60 * 1000);

/* ── Battleship helpers ── */
function canPlace(board: number[][], row: number, col: number, len: number, horiz: boolean): boolean {
  for (let i = 0; i < len; i++) {
    const r = horiz ? row : row + i;
    const c = horiz ? col + i : col;
    if (r < 0 || r >= 10 || c < 0 || c >= 10) return false;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nr < 10 && nc >= 0 && nc < 10 && board[nr][nc] === 1) return false;
    }
  }
  return true;
}

function generateBattleshipBoard(): number[][] {
  const board = Array.from({ length: 10 }, () => Array(10).fill(0));
  for (const len of [4, 3, 2, 2, 1, 1, 1, 1]) {
    for (let a = 0; a < 200; a++) {
      const horiz = Math.random() > 0.5;
      const row = Math.floor(Math.random() * 10);
      const col = Math.floor(Math.random() * 10);
      if (canPlace(board, row, col, len, horiz)) {
        for (let i = 0; i < len; i++) horiz ? (board[row][col + i] = 1) : (board[row + i][col] = 1);
        break;
      }
    }
  }
  return board;
}

function countAlive(board: number[][], shots: [number, number][]): number {
  const shotSet = new Set(shots.map(([r, c]) => `${r},${c}`));
  return board.flat().filter((v, i) => v === 1 && !shotSet.has(`${Math.floor(i / 10)},${i % 10}`)).length;
}

/* ── Chess helpers ── */
function initialChessBoard(): (string | null)[][] {
  const b: (string | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  const back = ["r", "n", "b", "q", "k", "b", "n", "r"];
  for (let c = 0; c < 8; c++) { b[0][c] = "b" + back[c]; b[1][c] = "bp"; b[6][c] = "wp"; b[7][c] = "w" + back[c]; }
  return b;
}

/* ── Checkers helpers ── */
function initialCheckersBoard(): (string | null)[][] {
  const b: (string | null)[][] = Array.from({ length: 8 }, () => Array(8).fill(null));
  for (let r = 0; r < 3; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) b[r][c] = "b";
  for (let r = 5; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) b[r][c] = "w";
  return b;
}

/* ── Durak helpers ── */
const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["6", "7", "8", "9", "10", "J", "Q", "K", "A"];
const RANK_VAL: Record<string, number> = { "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14 };

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  return arr;
}

function generateDurakDeck(): string[] {
  const deck: string[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push(r + s);
  return shuffle(deck);
}

function initDurakState(players: string[]) {
  const deck = generateDurakDeck();
  const trumpCard = deck[deck.length - 1];
  const trumpSuit = trumpCard.slice(-1);
  const hands: Record<string, string[]> = {};
  for (const p of players) hands[p] = deck.splice(0, 6);
  return {
    deck, trumpCard, trumpSuit, hands,
    attackerIdx: 0, defenderIdx: 1,
    table: [] as { attack: string; defense: string | null }[],
    discardPile: [] as string[],
    passed: [] as string[],
    gameOver: false,
    durak: null as string | null,
    playerOrder: [...players],
  };
}

function durakCardBeats(attack: string, defense: string, trump: string): boolean {
  const aRank = attack.slice(0, -1), aSuit = attack.slice(-1);
  const dRank = defense.slice(0, -1), dSuit = defense.slice(-1);
  if (aSuit === dSuit) return RANK_VAL[dRank] > RANK_VAL[aRank];
  if (dSuit === trump && aSuit !== trump) return true;
  return false;
}

function fillHandsDurak(state: ReturnType<typeof initDurakState>) {
  const order = state.playerOrder;
  const atkIdx = state.attackerIdx;
  const fillOrder = [...order.slice(atkIdx), ...order.slice(0, atkIdx)];
  for (const p of fillOrder) {
    while (state.hands[p] && state.hands[p].length < 6 && state.deck.length > 0) {
      state.hands[p].push(state.deck.shift()!);
    }
  }
}

/* ═══════════════════════════════════════════════════════
   ROUTES
═══════════════════════════════════════════════════════ */

/* POST /api/game/invite */
router.post("/game/invite", requireSession, (req, res) => {
  const me = (req as any).userHash as string;
  const { convId, type, opponentHash } = req.body as { convId: number; type: GameType; opponentHash?: string };
  if (!convId || !type) { res.status(400).json({ error: "missing params" }); return; }

  /* Cancel any existing pending invite in this conv */
  for (const [id, g] of games.entries()) {
    if (g.convId === convId && g.hostHash === me && g.status === "pending") games.delete(id);
  }

  const players = opponentHash ? [me, opponentHash] : [me];
  let state: Record<string, unknown> = {};

  if (type === "battleship") {
    state = {
      hostBoard: generateBattleshipBoard(),
      guestBoard: [] as number[][],
      hostShots: [] as [number, number][],
      guestShots: [] as [number, number][],
      turn: "guest",
      hostReady: true,
      guestReady: false,
    };
  } else if (type === "chess") {
    state = { board: initialChessBoard(), turn: "white", moveHistory: [], castling: { wK: true, wQ: true, bK: true, bQ: true }, enPassant: null };
  } else if (type === "checkers") {
    state = { board: initialCheckersBoard(), turn: "w", mustCapture: null };
  } else if (type === "durak") {
    if (players.length >= 2) {
      state = initDurakState(players) as unknown as Record<string, unknown>;
    } else {
      state = { waiting: true, deck: generateDurakDeck() };
    }
  }

  const g: GameSession = {
    id: genId(), type, convId: Number(convId),
    hostHash: me, players,
    status: "pending",
    state, winner: null,
    createdAt: Date.now(),
    expiresAt: Date.now() + 2 * 60 * 60 * 1000,
  };
  games.set(g.id, g);
  res.json({ gameId: g.id });
});

/* GET /api/game/pending?convId=X */
router.get("/game/pending", requireSession, (req, res) => {
  const me = (req as any).userHash as string;
  const convId = Number(req.query.convId);
  if (!convId) { res.status(400).json({ error: "missing convId" }); return; }
  const found = [...games.values()].find(g =>
    g.convId === convId &&
    (g.status === "pending" || g.status === "active") &&
    g.expiresAt > Date.now()
  );
  if (!found) { res.json({ game: null }); return; }
  res.json({ game: sanitizeGame(found, me) });
});

/* GET /api/game/:id */
router.get("/game/:id", requireSession, (req, res) => {
  const me = (req as any).userHash as string;
  const g = games.get(req.params.id as string);
  if (!g) { res.status(404).json({ error: "not found" }); return; }
  res.json({ game: sanitizeGame(g, me) });
});

/* POST /api/game/:id/accept */
router.post("/game/:id/accept", requireSession, (req, res) => {
  const me = (req as any).userHash as string;
  const g = games.get(req.params.id as string);
  if (!g || g.status !== "pending") { res.status(400).json({ error: "invalid" }); return; }
  if (!g.players.includes(me)) g.players.push(me);
  if (g.type === "battleship") {
    const st = g.state as any;
    st.guestBoard = generateBattleshipBoard();
    st.guestReady = true;
    g.status = "active";
    st.turn = "host";
  } else if (g.type === "durak") {
    if (g.players.length >= 2) {
      g.state = initDurakState(g.players) as unknown as Record<string, unknown>;
      g.status = "active";
    }
  } else {
    g.status = "active";
  }
  res.json({ ok: true });
});

/* POST /api/game/:id/join  (durak multiplayer) */
router.post("/game/:id/join", requireSession, (req, res) => {
  const me = (req as any).userHash as string;
  const g = games.get(req.params.id as string);
  if (!g || g.type !== "durak") { res.status(400).json({ error: "invalid" }); return; }
  if (g.players.includes(me)) { res.json({ ok: true }); return; }
  if (g.players.length >= 6) { res.status(400).json({ error: "full" }); return; }
  g.players.push(me);
  res.json({ ok: true });
});

/* POST /api/game/:id/start  (host starts durak after enough players joined) */
router.post("/game/:id/start", requireSession, (req, res) => {
  const me = (req as any).userHash as string;
  const g = games.get(req.params.id as string);
  if (!g || g.hostHash !== me || g.type !== "durak") { res.status(400).json({ error: "invalid" }); return; }
  if (g.players.length < 2) { res.status(400).json({ error: "need at least 2 players" }); return; }
  g.state = initDurakState(g.players) as unknown as Record<string, unknown>;
  g.status = "active";
  res.json({ ok: true });
});

/* POST /api/game/:id/decline */
router.post("/game/:id/decline", requireSession, (req, res) => {
  const g = games.get(req.params.id as string);
  if (!g) { res.status(404).json({ error: "not found" }); return; }
  g.status = "declined";
  setTimeout(() => games.delete(g.id), 10_000);
  res.json({ ok: true });
});

/* POST /api/game/:id/move */
router.post("/game/:id/move", requireSession, (req, res) => {
  const me = (req as any).userHash as string;
  const g = games.get(req.params.id as string);
  if (!g || g.status !== "active") { res.status(400).json({ error: "not active" }); return; }
  if (!g.players.includes(me)) { res.status(403).json({ error: "not a player" }); return; }

  const { move } = req.body as { move: Record<string, unknown> };
  const st = g.state as any;

  if (g.type === "battleship") {
    const isHost = g.players[0] === me;
    const [row, col] = [move.row as number, move.col as number];
    const myShots: [number, number][] = isHost ? st.hostShots : st.guestShots;
    const opponentBoard: number[][] = isHost ? st.guestBoard : st.hostBoard;

    if (st.turn !== (isHost ? "host" : "guest")) { res.status(400).json({ error: "not your turn" }); return; }
    if (myShots.some(([r, c]) => r === row && c === col)) { res.status(400).json({ error: "already shot" }); return; }

    myShots.push([row, col]);
    const alive = countAlive(opponentBoard, myShots);
    if (alive === 0) {
      g.status = "finished";
      g.winner = me;
    } else {
      st.turn = isHost ? "guest" : "host";
    }

  } else if (g.type === "chess") {
    const { from, to, promotion } = move as { from: [number, number]; to: [number, number]; promotion?: string };
    const board = st.board as (string | null)[][];
    const piece = board[from[0]][from[1]];
    if (!piece) { res.status(400).json({ error: "no piece" }); return; }
    const color = piece[0];
    const isHost = g.players[0] === me;
    if ((color === "w" && !isHost) || (color === "b" && isHost)) { res.status(400).json({ error: "wrong color" }); return; }
    if (st.turn !== color) { res.status(400).json({ error: "not your turn" }); return; }

    board[to[0]][to[1]] = promotion ? color + promotion : piece;
    board[from[0]][from[1]] = null;

    /* Pawn promotion */
    const moved = board[to[0]][to[1]]!;
    if (moved === "wp" && to[0] === 0) board[to[0]][to[1]] = promotion ? "w" + promotion : "wq";
    if (moved === "bp" && to[0] === 7) board[to[0]][to[1]] = promotion ? "b" + promotion : "bq";

    (st.moveHistory as unknown[]).push({ from, to, piece });
    st.turn = st.turn === "w" ? "b" : "w";

    /* Simple win check: king missing */
    const flat = board.flat();
    if (!flat.includes("wk")) { g.status = "finished"; g.winner = g.players[1]; }
    if (!flat.includes("bk")) { g.status = "finished"; g.winner = g.players[0]; }

  } else if (g.type === "checkers") {
    const { path } = move as { path: [number, number][] };
    const board = st.board as (string | null)[][];
    if (path.length < 2) { res.status(400).json({ error: "invalid path" }); return; }

    const [fr, fc] = path[0];
    const piece = board[fr][fc];
    const isHost = g.players[0] === me;
    if (!piece) { res.status(400).json({ error: "no piece" }); return; }
    const myColor = isHost ? "w" : "b";
    if (!piece.startsWith(myColor)) { res.status(400).json({ error: "wrong piece" }); return; }
    if (st.turn !== myColor) { res.status(400).json({ error: "not your turn" }); return; }

    for (let i = 0; i < path.length - 1; i++) {
      const [r1, c1] = path[i], [r2, c2] = path[i + 1];
      const dr = r2 - r1, dc = c2 - c1;
      if (Math.abs(dr) === 2) {
        const mr = r1 + dr / 2, mc = c1 + dc / 2;
        board[mr][mc] = null;
      }
      board[r2][c2] = piece;
      board[r1][c1] = null;
    }

    /* King promotion */
    const [lr, lc] = path[path.length - 1];
    if (piece === "w" && lr === 0) board[lr][lc] = "wk";
    if (piece === "b" && lr === 7) board[lr][lc] = "bk";

    st.turn = st.turn === "w" ? "b" : "w";

    /* Win check */
    const flat = board.flat();
    if (!flat.some(p => p && p.startsWith("w"))) { g.status = "finished"; g.winner = g.players[1]; }
    if (!flat.some(p => p && p.startsWith("b"))) { g.status = "finished"; g.winner = g.players[0]; }

  } else if (g.type === "durak") {
    const st2 = g.state as ReturnType<typeof initDurakState>;
    const { action } = move as { action: string; card?: string; tableIdx?: number };

    if (action === "attack") {
      const { card } = move as { card: string };
      const myHand = st2.hands[me];
      if (!myHand || !myHand.includes(card)) { res.status(400).json({ error: "no card" }); return; }
      const attackerHash = st2.playerOrder[st2.attackerIdx];
      const isAttacker = me === attackerHash || (
        st2.table.length > 0 &&
        st2.passed.includes(me) === false &&
        me !== st2.playerOrder[st2.defenderIdx]
      );
      if (!isAttacker) { res.status(400).json({ error: "not attacker" }); return; }
      if (st2.table.length > 0) {
        const tableRanks = st2.table.flatMap(t => [t.attack.slice(0, -1), t.defense?.slice(0, -1)].filter(Boolean));
        if (!tableRanks.includes(card.slice(0, -1))) { res.status(400).json({ error: "rank not on table" }); return; }
      }
      if (st2.table.length >= 6) { res.status(400).json({ error: "table full" }); return; }
      myHand.splice(myHand.indexOf(card), 1);
      st2.table.push({ attack: card, defense: null });

    } else if (action === "defend") {
      const { card, tableIdx } = move as { card: string; tableIdx: number };
      const defenderHash = st2.playerOrder[st2.defenderIdx];
      if (me !== defenderHash) { res.status(400).json({ error: "not defender" }); return; }
      const myHand = st2.hands[me];
      if (!myHand || !myHand.includes(card)) { res.status(400).json({ error: "no card" }); return; }
      const slot = st2.table[tableIdx];
      if (!slot || slot.defense !== null) { res.status(400).json({ error: "slot taken" }); return; }
      if (!durakCardBeats(slot.attack, card, st2.trumpSuit)) { res.status(400).json({ error: "card does not beat" }); return; }
      myHand.splice(myHand.indexOf(card), 1);
      slot.defense = card;

    } else if (action === "pickup") {
      const defenderHash = st2.playerOrder[st2.defenderIdx];
      if (me !== defenderHash) { res.status(400).json({ error: "not defender" }); return; }
      const cards = st2.table.flatMap(t => [t.attack, t.defense].filter(Boolean) as string[]);
      st2.hands[me].push(...cards);
      st2.table = [];
      st2.passed = [];
      /* Attacker stays, defender skips a turn */
      const n = st2.playerOrder.length;
      st2.defenderIdx = (st2.defenderIdx + 1) % n;
      fillHandsDurak(st2);

    } else if (action === "pass") {
      const defenderHash = st2.playerOrder[st2.defenderIdx];
      if (me === defenderHash) { res.status(400).json({ error: "defender cannot pass" }); return; }
      if (!st2.table.every(t => t.defense !== null)) { res.status(400).json({ error: "not all defended" }); return; }
      if (!st2.passed.includes(me)) st2.passed.push(me);

      const attackers = st2.playerOrder.filter(p => p !== defenderHash);
      if (st2.passed.length >= attackers.length) {
        /* Round over - move to next */
        st2.discardPile.push(...st2.table.flatMap(t => [t.attack, t.defense!]));
        st2.table = [];
        st2.passed = [];
        fillHandsDurak(st2);
        const n = st2.playerOrder.length;
        st2.attackerIdx = st2.defenderIdx % n;
        st2.defenderIdx = (st2.attackerIdx + 1) % n;

        /* Remove players with no cards (and deck empty) */
        if (st2.deck.length === 0) {
          const empties = st2.playerOrder.filter(p => st2.hands[p]?.length === 0);
          for (const p of empties) {
            const idx = st2.playerOrder.indexOf(p);
            st2.playerOrder.splice(idx, 1);
            if (st2.attackerIdx >= st2.playerOrder.length) st2.attackerIdx = 0;
            if (st2.defenderIdx >= st2.playerOrder.length) st2.defenderIdx = 0;
          }
          if (st2.playerOrder.length <= 1) {
            st2.gameOver = true;
            st2.durak = st2.playerOrder[0] ?? null;
            g.status = "finished";
            g.winner = null;
          }
        }
      }
    }
  }

  res.json({ game: sanitizeGame(g, me) });
});

/* POST /api/game/:id/leave */
router.post("/game/:id/leave", requireSession, (req, res) => {
  const g = games.get(req.params.id as string);
  if (!g) { res.status(404).json({ error: "not found" }); return; }
  games.delete(g.id);
  res.json({ ok: true });
});

/* ── Sanitize game state (hide opponent-private info) ── */
function sanitizeGame(g: GameSession, viewerHash: string) {
  const st = g.state as any;
  const isHost = g.players[0] === viewerHash;

  if (g.type === "battleship" && g.status === "active") {
    return {
      id: g.id, type: g.type, status: g.status, winner: g.winner,
      players: g.players, hostHash: g.hostHash,
      myBoard: isHost ? st.hostBoard : st.guestBoard,
      opponentShots: isHost ? st.guestShots : st.hostShots,
      myShots: isHost ? st.hostShots : st.guestShots,
      turn: st.turn,
    };
  }

  if (g.type === "durak" && st.hands) {
    const myHand = st.hands[viewerHash] ?? [];
    const otherHands: Record<string, number> = {};
    for (const [p, h] of Object.entries(st.hands as Record<string, string[]>)) {
      if (p !== viewerHash) otherHands[p] = (h as string[]).length;
    }
    return {
      id: g.id, type: g.type, status: g.status, winner: g.winner,
      players: g.players, hostHash: g.hostHash,
      myHand, otherHands,
      deckSize: (st.deck as unknown[]).length,
      trumpCard: st.trumpCard, trumpSuit: st.trumpSuit,
      table: st.table, passed: st.passed,
      attackerIdx: st.attackerIdx, defenderIdx: st.defenderIdx,
      playerOrder: st.playerOrder,
      gameOver: st.gameOver, durak: st.durak,
    };
  }

  return {
    id: g.id, type: g.type, status: g.status, winner: g.winner,
    players: g.players, hostHash: g.hostHash,
    state: st,
  };
}

export default router;
