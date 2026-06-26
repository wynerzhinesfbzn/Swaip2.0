import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';

const C = { bg: '#0a0a14', board1: '#c8a06e', board2: '#8b5e3c', border: 'rgba(200,200,255,0.15)', text: '#e8e8f8', sub: '#6060a0', accent: '#6366f1' };

interface Piece { c: 'w' | 'b'; k: boolean; }
interface Props { game: any; joined: string[]; myHash: string; members: any[]; onAction: (a: any) => void; }

const IDX = (r: number, c: number) => r * 8 + c;
const RC  = (i: number) => ({ r: Math.floor(i / 8), c: i % 8 });
const playable = (i: number) => { const {r,c}=RC(i); return (r+c)%2===1; };

export default function CheckersGame({ game, myHash, onAction }: Props) {
  const [selected, setSelected] = useState<number | null>(null);

  const board: (Piece | null)[] = game?.board ?? Array(64).fill(null);
  const status: string = game?.status ?? 'waiting';
  const currentHash: string = game?.currentHash ?? '';
  const winner: string | null = game?.winner ?? null;
  const winnerName: string | null = game?.winnerName ?? null;
  const mustFrom: number | null = game?.mustFrom ?? null;

  const myPlayer = game?.players?.find((p: any) => p.hash === myHash);
  const myColor = myPlayer?.color ?? null;
  const isMyTurn = currentHash === myHash;

  const getLegal = useCallback((from: number): number[] => {
    if (!board[from] || board[from]!.c !== myColor) return [];
    const piece = board[from]!;
    const {r, c} = RC(from);
    const dirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
    const caps: number[] = [];
    const moves: number[] = [];

    for (const [dr, dc] of dirs) {
      if (!piece.k && ((myColor==='w'&&dr>0)||(myColor==='b'&&dr<0))) continue;
      if (!piece.k) {
        const [mr,mc,lr,lc] = [r+dr,c+dc,r+2*dr,c+2*dc];
        if (mr<0||mr>7||mc<0||mc>7||lr<0||lr>7||lc<0||lc>7) continue;
        const mid=IDX(mr,mc), land=IDX(lr,lc);
        if (board[mid]?.c&&board[mid]!.c!==myColor&&!board[land]) caps.push(land);
        else if (!board[IDX(mr,mc)]) moves.push(IDX(mr,mc));
      } else {
        let s=1;
        while(true){
          const[nr,nc]=[r+s*dr,c+s*dc];
          if(nr<0||nr>7||nc<0||nc>7) break;
          const ni=IDX(nr,nc);
          if(board[ni]) break;
          moves.push(ni);
          s++;
        }
      }
    }
    // Simplified: show all moves (server enforces mandatory capture)
    return caps.length ? caps : moves;
  }, [board, myColor]);

  const handleCell = (i: number) => {
    if (!isMyTurn || status !== 'playing') return;
    if (!playable(i)) return;
    if (selected === null) {
      if (board[i]?.c === myColor) {
        if (mustFrom !== null && mustFrom !== i) return;
        setSelected(i);
      }
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

  const legalHighlight = selected !== null ? new Set(getLegal(selected)) : new Set<number>();

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, padding:'12px 0' }}>
      {/* Status bar */}
      <div style={{ fontSize:13, color: winner ? '#fbbf24' : isMyTurn ? '#22c55e' : C.sub, fontWeight:700, textAlign:'center' }}>
        {winner ? `🏆 Победил: ${winnerName}` : isMyTurn ? '🟢 Ваш ход' : '⏳ Ход соперника'}
        {isMyTurn && mustFrom !== null && <span style={{color:'#f59e0b'}}> · Продолжайте бить!</span>}
      </div>

      {/* Who is who */}
      <div style={{ display:'flex', gap:16, fontSize:11, color:C.sub }}>
        {game?.players?.map((p: any) => (
          <span key={p.hash} style={{ color: p.hash===currentHash ? '#fff' : C.sub }}>
            {p.color==='w'?'⬜':'⬛'} {p.name} {p.hash===myHash?'(вы)':''}
          </span>
        ))}
      </div>

      {/* Board */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(8,1fr)', gap:0, border:'2px solid rgba(200,200,255,0.2)', borderRadius:8, overflow:'hidden', userSelect:'none' }}>
        {Array.from({length:64},(_,i)=>{
          const {r,c}=RC(i);
          const isLight=(r+c)%2===0;
          const piece=board[i];
          const isSel=selected===i;
          const isHint=legalHighlight.has(i);
          return (
            <motion.div key={i}
              whileTap={{scale:0.92}}
              onClick={()=>handleCell(i)}
              style={{
                width:40,height:40,
                background: isSel ? '#7c6b3a' : isHint ? 'rgba(99,102,241,0.45)' : isLight ? C.board1 : C.board2,
                display:'flex',alignItems:'center',justifyContent:'center',
                cursor: isMyTurn && (piece?.c===myColor||isHint) ? 'pointer' : 'default',
                position:'relative',
              }}>
              {piece && (
                <div style={{
                  width:30,height:30,borderRadius:'50%',
                  background: piece.c==='w' ? 'radial-gradient(circle at 35% 35%,#fff,#d0d0d0)' : 'radial-gradient(circle at 35% 35%,#555,#111)',
                  border: `2px solid ${piece.c==='w'?'#999':'#333'}`,
                  boxShadow:'0 2px 6px rgba(0,0,0,0.5)',
                  display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:14,
                }}>
                  {piece.k && <span style={{color:piece.c==='w'?'#6366f1':'#fbbf24'}}>♛</span>}
                </div>
              )}
              {isHint && !piece && (
                <div style={{width:12,height:12,borderRadius:'50%',background:'rgba(99,102,241,0.7)'}}/>
              )}
            </motion.div>
          );
        })}
      </div>

      {status==='ended' && (
        <div style={{fontSize:12,color:C.sub,textAlign:'center'}}>Игра завершена</div>
      )}
    </div>
  );
}
