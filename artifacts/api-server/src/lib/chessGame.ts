export interface PlayerInfo { hash: string; name: string; avatar: string; }
export type ChessColor = 'w' | 'b';
export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';
export interface ChessPiece { t: PieceType; c: ChessColor; }
export interface ChessState {
  status: 'waiting' | 'playing' | 'ended';
  board: (ChessPiece | null)[];
  players: { hash: string; name: string; color: ChessColor }[];
  currentHash: string;
  currentColor: ChessColor;
  winner: string | null;
  winnerName: string | null;
  draw: boolean;
  inCheck: boolean;
  lastMove: [number, number] | null;
  enPassant: number | null;
  castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
}

const RC = (i: number) => ({ r: Math.floor(i / 8), c: i % 8 });
const IDX = (r: number, c: number) => r * 8 + c;
const ok = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

function initBoard(): (ChessPiece | null)[] {
  const b: (ChessPiece | null)[] = Array(64).fill(null);
  const backRank: PieceType[] = ['r','n','b','q','k','b','n','r'];
  for (let c = 0; c < 8; c++) {
    b[IDX(0, c)] = { t: backRank[c], c: 'b' };
    b[IDX(1, c)] = { t: 'p', c: 'b' };
    b[IDX(6, c)] = { t: 'p', c: 'w' };
    b[IDX(7, c)] = { t: backRank[c], c: 'w' };
  }
  return b;
}

function pseudoMoves(b: (ChessPiece | null)[], from: number, col: ChessColor, ep: number | null): number[] {
  const p = b[from]; if (!p || p.c !== col) return [];
  const { r, c } = RC(from);
  const res: number[] = [];
  const add = (r2: number, c2: number) => { if (ok(r2,c2)) { const i=IDX(r2,c2); if (!b[i]||b[i]!.c!==col) res.push(i); } };
  const slide = (drs: [number,number][]) => { for (const [dr,dc] of drs) { let s=1; while(true){const[nr,nc]=[r+s*dr,c+s*dc]; if(!ok(nr,nc))break; const ni=IDX(nr,nc); res.push(ni); if(b[ni])break; s++; } } };

  switch (p.t) {
    case 'p': {
      const dir = col === 'w' ? -1 : 1;
      const start = col === 'w' ? 6 : 1;
      const nr = r + dir;
      if (ok(nr,c) && !b[IDX(nr,c)]) {
        res.push(IDX(nr,c));
        if (r === start && !b[IDX(r+2*dir,c)]) res.push(IDX(r+2*dir,c));
      }
      for (const dc of [-1,1]) {
        if (!ok(nr,c+dc)) continue;
        const ni = IDX(nr,c+dc);
        if ((b[ni] && b[ni]!.c !== col) || ni === ep) res.push(ni);
      }
      break;
    }
    case 'r': slide([[-1,0],[1,0],[0,-1],[0,1]]); break;
    case 'b': slide([[-1,-1],[-1,1],[1,-1],[1,1]]); break;
    case 'q': slide([[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]); break;
    case 'n': for (const [dr,dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) add(r+dr,c+dc); break;
    case 'k': for (const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) add(r+dr,c+dc); break;
  }
  return [...new Set(res)];
}

function isAttacked(b: (ChessPiece | null)[], sq: number, byColor: ChessColor): boolean {
  for (let i = 0; i < 64; i++) {
    const p = b[i]; if (!p || p.c !== byColor) continue;
    if (pseudoMoves(b, i, byColor, null).includes(sq)) return true;
  }
  return false;
}

function findKing(b: (ChessPiece | null)[], col: ChessColor): number {
  for (let i = 0; i < 64; i++) { const p = b[i]; if (p?.t === 'k' && p.c === col) return i; }
  return -1;
}

function legalMoves(b: (ChessPiece | null)[], from: number, col: ChessColor, ep: number|null, castling: ChessState['castling']): number[] {
  const piece = b[from]; if (!piece || piece.c !== col) return [];
  const pseudo = pseudoMoves(b, from, col, ep);
  const res: number[] = [];
  for (const to of pseudo) {
    const b2 = [...b];
    const { r: fr, c: fc } = RC(from);
    const { r: tr } = RC(to);
    // En passant capture
    if (piece.t === 'p' && to === ep) { b2[ep] = null; const capR = col==='w' ? tr+1 : tr-1; b2[IDX(capR, RC(to).c)] = null; }
    b2[to] = b2[from]; b2[from] = null;
    const king = findKing(b2, col);
    if (king >= 0 && !isAttacked(b2, king, col === 'w' ? 'b' : 'w')) res.push(to);
  }
  // Castling
  if (piece.t === 'k') {
    const opp = col === 'w' ? 'b' : 'w';
    const kingIdx = from;
    if (!isAttacked(b, kingIdx, opp)) {
      if (col === 'w' && castling.wK && !b[IDX(7,5)] && !b[IDX(7,6)] && !isAttacked(b,IDX(7,5),opp) && !isAttacked(b,IDX(7,6),opp)) res.push(IDX(7,6));
      if (col === 'w' && castling.wQ && !b[IDX(7,3)] && !b[IDX(7,2)] && !b[IDX(7,1)] && !isAttacked(b,IDX(7,3),opp) && !isAttacked(b,IDX(7,2),opp)) res.push(IDX(7,2));
      if (col === 'b' && castling.bK && !b[IDX(0,5)] && !b[IDX(0,6)] && !isAttacked(b,IDX(0,5),opp) && !isAttacked(b,IDX(0,6),opp)) res.push(IDX(0,6));
      if (col === 'b' && castling.bQ && !b[IDX(0,3)] && !b[IDX(0,2)] && !b[IDX(0,1)] && !isAttacked(b,IDX(0,3),opp) && !isAttacked(b,IDX(0,2),opp)) res.push(IDX(0,2));
    }
  }
  return res;
}

function hasAnyLegal(b: (ChessPiece | null)[], col: ChessColor, ep: number|null, castling: ChessState['castling']): boolean {
  for (let i = 0; i < 64; i++) { if (b[i]?.c === col && legalMoves(b,i,col,ep,castling).length) return true; }
  return false;
}

export function createChessGame(players: PlayerInfo[]): ChessState {
  if (players.length !== 2) throw new Error('Шахматы: нужно ровно 2 игрока');
  return { status: 'playing', board: initBoard(),
    players: [ { hash: players[0].hash, name: players[0].name, color: 'w' },
               { hash: players[1].hash, name: players[1].name, color: 'b' } ],
    currentHash: players[0].hash, currentColor: 'w', winner: null, winnerName: null,
    draw: false, inCheck: false, lastMove: null, enPassant: null,
    castling: { wK: true, wQ: true, bK: true, bQ: true } };
}

export function applyChessAction(state: ChessState, hash: string, action: any): { ok: boolean; error?: string } {
  if (state.status !== 'playing') return { ok: false, error: 'Игра не идёт' };
  if (state.currentHash !== hash) return { ok: false, error: 'Не ваш ход' };
  if (action.type !== 'move') return { ok: false, error: 'Неизвестное действие' };
  const { from, to } = action;
  if (typeof from !== 'number' || typeof to !== 'number') return { ok: false, error: 'Неверный ход' };
  const col = state.currentColor;
  const b = state.board;
  const legal = legalMoves(b, from, col, state.enPassant, state.castling);
  if (!legal.includes(to)) return { ok: false, error: 'Недопустимый ход' };

  const piece = b[from]!;
  const { r: fr, c: fc } = RC(from);
  const { r: tr, c: tc } = RC(to);

  // Move
  b[to] = b[from]; b[from] = null;

  // En passant capture
  if (piece.t === 'p' && to === state.enPassant) {
    const capR = col === 'w' ? tr+1 : tr-1;
    b[IDX(capR, tc)] = null;
  }

  // Castling rook move
  if (piece.t === 'k' && Math.abs(tc - fc) === 2) {
    if (tc === 6) { b[IDX(tr,5)] = b[IDX(tr,7)]; b[IDX(tr,7)] = null; }
    else { b[IDX(tr,3)] = b[IDX(tr,0)]; b[IDX(tr,0)] = null; }
  }

  // Pawn promotion (auto queen)
  if (piece.t === 'p' && (tr === 0 || tr === 7)) b[to] = { t: 'q', c: col };

  // Update en passant
  state.enPassant = (piece.t === 'p' && Math.abs(fr-tr) === 2) ? IDX((fr+tr)/2, fc) : null;

  // Update castling rights
  if (piece.t === 'k') { if (col==='w'){state.castling.wK=false;state.castling.wQ=false;}else{state.castling.bK=false;state.castling.bQ=false;} }
  if (piece.t === 'r') {
    if (from === IDX(7,0)) state.castling.wQ = false;
    if (from === IDX(7,7)) state.castling.wK = false;
    if (from === IDX(0,0)) state.castling.bQ = false;
    if (from === IDX(0,7)) state.castling.bK = false;
  }

  state.lastMove = [from, to];

  // Switch turn
  const opp: ChessColor = col === 'w' ? 'b' : 'w';
  const oppPlayer = state.players.find(p => p.color === opp)!;
  state.currentColor = opp;
  state.currentHash = oppPlayer.hash;

  // Check/checkmate/stalemate
  const oppKing = findKing(b, opp);
  const inCheck = oppKing >= 0 && isAttacked(b, oppKing, col);
  state.inCheck = inCheck;

  if (!hasAnyLegal(b, opp, state.enPassant, state.castling)) {
    state.status = 'ended';
    if (inCheck) {
      const winner = state.players.find(p => p.color === col)!;
      state.winner = winner.hash; state.winnerName = winner.name;
    } else {
      state.draw = true;
    }
  }

  return { ok: true };
}

export function sanitizeChessForPlayer(state: ChessState, _h: string): ChessState { return state; }
