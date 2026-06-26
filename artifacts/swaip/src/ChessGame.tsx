import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';

const C = { board1: '#f0d9b5', board2: '#b58863', sub: '#6060a0', accent: '#6366f1' };

type PT = 'p'|'r'|'n'|'b'|'q'|'k';
interface Piece { t: PT; c: 'w'|'b'; }
interface Props { game: any; joined: string[]; myHash: string; members: any[]; onAction: (a:any)=>void; }

const GLYPHS: Record<string, string> = {
  wp:'♙',wr:'♖',wn:'♘',wb:'♗',wq:'♕',wk:'♔',
  bp:'♟',br:'♜',bn:'♞',bb:'♝',bq:'♛',bk:'♚',
};

const RC  = (i: number) => ({ r: Math.floor(i/8), c: i%8 });
const IDX = (r: number, c: number) => r*8+c;

/* Simple legal-move preview on client (server enforces for real) */
function clientLegal(board: (Piece|null)[], from: number, col: 'w'|'b', ep: number|null): number[] {
  const p = board[from]; if(!p||p.c!==col) return [];
  const {r,c} = RC(from);
  const res: number[] = [];
  const add = (r2:number,c2:number)=>{if(r2>=0&&r2<8&&c2>=0&&c2<8){const i=IDX(r2,c2);if(!board[i]||board[i]!.c!==col)res.push(i);}};
  const slide=(dirs:[number,number][])=>{for(const[dr,dc]of dirs){let s=1;while(true){const[nr,nc]=[r+s*dr,c+s*dc];if(nr<0||nr>7||nc<0||nc>7)break;const ni=IDX(nr,nc);res.push(ni);if(board[ni])break;s++;}}};
  switch(p.t){
    case'p':{const dir=col==='w'?-1:1;const st=col==='w'?6:1;const nr=r+dir;if(nr>=0&&nr<8&&!board[IDX(nr,c)]){res.push(IDX(nr,c));if(r===st&&!board[IDX(r+2*dir,c)])res.push(IDX(r+2*dir,c));}for(const dc of[-1,1]){if(nr<0||nr>7||c+dc<0||c+dc>7)continue;const ni=IDX(nr,c+dc);if((board[ni]&&board[ni]!.c!==col)||ni===ep)res.push(ni);}break;}
    case'r':slide([[-1,0],[1,0],[0,-1],[0,1]]);break;
    case'b':slide([[-1,-1],[-1,1],[1,-1],[1,1]]);break;
    case'q':slide([[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]]);break;
    case'n':for(const[dr,dc]of[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]])add(r+dr,c+dc);break;
    case'k':for(const[dr,dc]of[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]])add(r+dr,c+dc);
      // Basic castling hint
      if(!board[IDX(r,c+1)]&&!board[IDX(r,c+2)])res.push(IDX(r,c+2));
      if(!board[IDX(r,c-1)]&&!board[IDX(r,c-2)]&&!board[IDX(r,c-3)])res.push(IDX(r,c-2));
      break;
  }
  return [...new Set(res)];
}

export default function ChessGame({ game, myHash, onAction }: Props) {
  const [selected, setSelected] = useState<number | null>(null);

  const board: (Piece|null)[] = game?.board ?? Array(64).fill(null);
  const status: string = game?.status ?? 'waiting';
  const currentHash: string = game?.currentHash ?? '';
  const winner: string|null = game?.winner ?? null;
  const winnerName: string|null = game?.winnerName ?? null;
  const draw: boolean = game?.draw ?? false;
  const inCheck: boolean = game?.inCheck ?? false;
  const lastMove: [number,number]|null = game?.lastMove ?? null;
  const ep: number|null = game?.enPassant ?? null;

  const myPlayer = game?.players?.find((p:any) => p.hash === myHash);
  const myColor: 'w'|'b' = myPlayer?.color ?? 'w';
  const isMyTurn = currentHash === myHash;
  const flipped = myColor === 'b';

  const getLegal = useCallback((from: number) => {
    return clientLegal(board, from, myColor, ep);
  }, [board, myColor, ep]);

  const handleCell = (rawIdx: number) => {
    // rawIdx is visual index — flip if black
    const i = flipped ? 63 - rawIdx : rawIdx;
    if (!isMyTurn || status !== 'playing') return;
    if (selected === null) {
      if (board[i]?.c === myColor) setSelected(i);
    } else {
      if (i === selected) { setSelected(null); return; }
      const legal = getLegal(selected);
      if (legal.includes(i)) {
        onAction({ type: 'game_action', action: { type: 'move', from: selected, to: i } });
        setSelected(null);
      } else if (board[i]?.c === myColor) {
        setSelected(i);
      } else {
        setSelected(null);
      }
    }
  };

  const legalSet = selected !== null ? new Set(getLegal(selected)) : new Set<number>();
  const indices = flipped ? Array.from({length:64},(_,i)=>63-i) : Array.from({length:64},(_,i)=>i);

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:'10px 0' }}>
      {/* Status */}
      <div style={{ fontSize:13, fontWeight:700, textAlign:'center',
        color: winner||draw ? '#fbbf24' : inCheck ? '#ef4444' : isMyTurn ? '#22c55e' : '#6060a0' }}>
        {draw ? '🤝 Ничья!' : winner ? `🏆 Победил: ${winnerName}` : inCheck ? '⚠️ Шах!' : isMyTurn ? '🟢 Ваш ход' : '⏳ Ход соперника'}
      </div>

      {/* Players */}
      <div style={{ display:'flex', gap:16, fontSize:11, color:'#6060a0' }}>
        {game?.players?.map((p:any)=>(
          <span key={p.hash} style={{ color:p.hash===currentHash?'#fff':'#6060a0' }}>
            {p.color==='w'?'♔':'♚'} {p.name} {p.hash===myHash?'(вы)':''}
          </span>
        ))}
      </div>

      {/* Coord labels top */}
      <div style={{ display:'flex', marginLeft:20 }}>
        {(flipped?['h','g','f','e','d','c','b','a']:['a','b','c','d','e','f','g','h']).map(l=>(
          <div key={l} style={{ width:42, textAlign:'center', fontSize:9, color:'#6060a0' }}>{l}</div>
        ))}
      </div>

      {/* Board */}
      <div style={{ display:'flex', gap:0 }}>
        <div style={{ display:'flex', flexDirection:'column', justifyContent:'space-around', marginRight:2 }}>
          {(flipped?[1,2,3,4,5,6,7,8]:[8,7,6,5,4,3,2,1]).map(n=>(
            <div key={n} style={{ height:42, display:'flex', alignItems:'center', fontSize:9, color:'#6060a0' }}>{n}</div>
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', border:'2px solid rgba(200,200,255,0.2)', borderRadius:4, overflow:'hidden', userSelect:'none' }}>
          {indices.map((realIdx, visIdx) => {
            const {r,c} = RC(realIdx);
            const isLight = (r+c)%2===0;
            const piece = board[realIdx];
            const isSel = selected === realIdx;
            const isHint = legalSet.has(realIdx);
            const isLast = lastMove && (lastMove[0]===realIdx||lastMove[1]===realIdx);
            return (
              <motion.div key={visIdx}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleCell(visIdx)}
                style={{
                  width: 42, height: 42,
                  background: isSel ? '#aaa23a' : isHint ? 'rgba(99,102,241,0.5)' : isLast ? (isLight?'#cdd16f':'#aaa23a') : isLight ? C.board1 : C.board2,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: isMyTurn ? 'pointer' : 'default', position: 'relative',
                }}>
                {piece && (
                  <span style={{
                    fontSize: 28, lineHeight: 1,
                    color: piece.c === 'w' ? '#fff' : '#1a1a1a',
                    textShadow: piece.c==='w' ? '0 1px 3px rgba(0,0,0,0.8)' : '0 1px 2px rgba(255,255,255,0.3)',
                    filter: piece.c==='w' ? 'drop-shadow(0 0 2px rgba(0,0,0,0.9))' : 'none',
                  }}>
                    {GLYPHS[piece.c + piece.t]}
                  </span>
                )}
                {isHint && !piece && (
                  <div style={{ width:14, height:14, borderRadius:'50%', background:'rgba(99,102,241,0.6)' }}/>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>

      <div style={{ fontSize:11, color:'#6060a0', textAlign:'center' }}>
        Вы играете {myColor==='w'?'белыми ♔':'чёрными ♚'}
      </div>
    </div>
  );
}
