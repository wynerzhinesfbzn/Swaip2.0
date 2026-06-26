export interface PlayerInfo { hash: string; name: string; avatar: string; }
export type CColor = 'w' | 'b';
interface Piece { c: CColor; k: boolean; }
export interface CheckersState {
  status: 'waiting' | 'playing' | 'ended';
  board: (Piece | null)[];
  players: { hash: string; name: string; color: CColor }[];
  currentHash: string;
  winner: string | null;
  winnerName: string | null;
  mustFrom: number | null;
}

const IDX = (r: number, c: number) => r * 8 + c;
const RC  = (i: number) => ({ r: Math.floor(i / 8), c: i % 8 });
const ok  = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

function initBoard(): (Piece | null)[] {
  const b: (Piece | null)[] = Array(64).fill(null);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    if ((r + c) % 2 !== 1) continue;
    if (r < 3) b[IDX(r, c)] = { c: 'b', k: false };
    else if (r > 4) b[IDX(r, c)] = { c: 'w', k: false };
  }
  return b;
}

function captures(b: (Piece | null)[], from: number, col: CColor, king: boolean): { to: number; over: number }[] {
  const { r, c } = RC(from);
  const res: { to: number; over: number }[] = [];
  const dirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
  for (const [dr, dc] of dirs) {
    if (!king && ((col === 'w' && dr > 0) || (col === 'b' && dr < 0))) continue;
    if (!king) {
      const [mr, mc, lr, lc] = [r+dr, c+dc, r+2*dr, c+2*dc];
      if (!ok(mr,mc) || !ok(lr,lc)) continue;
      const mid = IDX(mr,mc), land = IDX(lr,lc);
      if (b[mid]?.c && b[mid]!.c !== col && !b[land]) res.push({ to: land, over: mid });
    } else {
      let s = 1, foundEnemy: number | null = null;
      while (true) {
        const [nr, nc] = [r + s*dr, c + s*dc];
        if (!ok(nr,nc)) break;
        const ni = IDX(nr,nc);
        if (b[ni]) { if (b[ni]!.c !== col && !foundEnemy) foundEnemy = ni; else break; }
        else if (foundEnemy !== null) res.push({ to: ni, over: foundEnemy });
        s++;
      }
    }
  }
  return res;
}

function moves(b: (Piece | null)[], from: number, col: CColor, king: boolean): number[] {
  const { r, c } = RC(from);
  const res: number[] = [];
  const dirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
  for (const [dr, dc] of dirs) {
    if (!king && ((col === 'w' && dr > 0) || (col === 'b' && dr < 0))) continue;
    if (!king) {
      const [nr, nc] = [r+dr, c+dc];
      if (!ok(nr,nc)) continue;
      const ni = IDX(nr,nc);
      if (!b[ni]) res.push(ni);
    } else {
      let s = 1;
      while (true) {
        const [nr, nc] = [r + s*dr, c + s*dc];
        if (!ok(nr,nc)) break;
        const ni = IDX(nr,nc);
        if (b[ni]) break;
        res.push(ni);
        s++;
      }
    }
  }
  return res;
}

function anyCapture(b: (Piece | null)[], col: CColor) {
  for (let i = 0; i < 64; i++) { const p = b[i]; if (p?.c === col && captures(b, i, col, p.k).length) return true; } return false;
}
function anyMove(b: (Piece | null)[], col: CColor) {
  for (let i = 0; i < 64; i++) { const p = b[i]; if (!p || p.c !== col) continue; if (captures(b,i,col,p.k).length || moves(b,i,col,p.k).length) return true; } return false;
}

export function createCheckersGame(players: PlayerInfo[]): CheckersState {
  if (players.length !== 2) throw new Error('Шашки: нужно ровно 2 игрока');
  return { status: 'playing', board: initBoard(),
    players: [ { hash: players[0].hash, name: players[0].name, color: 'w' },
               { hash: players[1].hash, name: players[1].name, color: 'b' } ],
    currentHash: players[0].hash, winner: null, winnerName: null, mustFrom: null };
}

export function applyCheckersAction(state: CheckersState, hash: string, action: any): { ok: boolean; error?: string } {
  if (state.status !== 'playing') return { ok: false, error: 'Игра не идёт' };
  if (state.currentHash !== hash) return { ok: false, error: 'Не ваш ход' };
  const player = state.players.find(p => p.hash === hash)!;
  const col = player.color;
  const b = state.board;
  if (action.type !== 'move') return { ok: false, error: 'Неизвестное действие' };
  const { from, to } = action;
  if (typeof from !== 'number' || typeof to !== 'number') return { ok: false, error: 'Неверный ход' };
  if (!b[from] || b[from]!.c !== col) return { ok: false, error: 'Не ваша шашка' };
  if (state.mustFrom !== null && state.mustFrom !== from) return { ok: false, error: 'Продолжайте бить этой шашкой' };
  const piece = b[from]!;
  const caps = captures(b, from, col, piece.k);
  const must = anyCapture(b, col);
  const cap = caps.find(x => x.to === to);
  if (must && !cap) return { ok: false, error: 'Обязательно бить!' };
  if (cap) {
    b[to] = piece; b[from] = null; b[cap.over] = null;
    const { r } = RC(to);
    const promoted = !piece.k && ((col === 'w' && r === 0) || (col === 'b' && r === 7));
    if (promoted) b[to]!.k = true;
    const more = !promoted ? captures(b, to, col, b[to]!.k) : [];
    if (more.length) { state.mustFrom = to; }
    else { state.mustFrom = null; switchTurn(state); }
  } else {
    const ms = moves(b, from, col, piece.k);
    if (!ms.includes(to)) return { ok: false, error: 'Недопустимый ход' };
    b[to] = piece; b[from] = null;
    const { r } = RC(to);
    if (!piece.k && ((col === 'w' && r === 0) || (col === 'b' && r === 7))) b[to]!.k = true;
    state.mustFrom = null;
    switchTurn(state);
  }
  return { ok: true };
}

function switchTurn(s: CheckersState) {
  const other = s.players.find(p => p.hash !== s.currentHash)!;
  s.currentHash = other.hash;
  if (!anyMove(s.board, other.color)) {
    s.status = 'ended';
    const winner = s.players.find(p => p.hash !== other.hash)!;
    s.winner = winner.hash; s.winnerName = winner.name;
  }
}

export function sanitizeCheckersForPlayer(state: CheckersState, _h: string): CheckersState { return state; }
