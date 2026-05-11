import React from 'react';
import { motion } from 'framer-motion';

interface Props { game: any; joined: string[]; myHash: string; members: any[]; onAction: (a: any) => void; }

const TOTAL = 40;

function cellLabel(i: number, specials: Record<number, any>): string {
  const s = specials?.[i];
  if (!s) return '';
  if (s.type === 'ladder') return '🪜';
  if (s.type === 'snake')  return '🐍';
  if (s.type === 'bonus')  return '⭐';
  if (s.type === 'skip')   return '💤';
  return '';
}

function cellBg(i: number, specials: Record<number, any>): string {
  const s = specials?.[i];
  if (!s) return 'rgba(255,255,255,0.04)';
  if (s.type === 'ladder') return 'rgba(34,197,94,0.18)';
  if (s.type === 'snake')  return 'rgba(239,68,68,0.18)';
  if (s.type === 'bonus')  return 'rgba(251,191,36,0.18)';
  if (s.type === 'skip')   return 'rgba(99,102,241,0.18)';
  return 'rgba(255,255,255,0.04)';
}

export default function BoardGameComp({ game, myHash, onAction }: Props) {
  const players: any[] = game?.players ?? [];
  const currentHash: string = game?.currentHash ?? '';
  const lastDice: number|null = game?.lastDice ?? null;
  const lastEffect: string|null = game?.lastEffect ?? null;
  const status: string = game?.status ?? 'waiting';
  const winnerName: string|null = game?.winnerName ?? null;
  const specials = game?.specials ?? {};
  const isMyTurn = currentHash === myHash;

  // Build 40 cells, snake-path layout (boustrophedon)
  // Row 0 bottom → cells 1-8 (left→right)
  // Row 1 → cells 9-16 (right→left)  etc.
  function cellPosition(cellNum: number): { col: number; row: number } {
    // cellNum: 1..40. row 0 = bottom
    const idx = cellNum - 1; // 0-indexed
    const rowFromBottom = Math.floor(idx / 8);
    const posInRow = idx % 8;
    const col = rowFromBottom % 2 === 0 ? posInRow : 7 - posInRow;
    return { col, row: rowFromBottom };
  }

  const ROWS = Math.ceil(TOTAL / 8); // 5
  const COLS = 8;
  const CELL = 36;

  // Place players on cells
  const playersByCell: Record<number, any[]> = {};
  for (const p of players) {
    if (!playersByCell[p.pos]) playersByCell[p.pos] = [];
    playersByCell[p.pos].push(p);
  }

  // Build grid: grid[row][col] = cellNum (1-40) or 0
  const grid: number[][] = Array.from({length: ROWS}, () => Array(COLS).fill(0));
  for (let n = 1; n <= TOTAL; n++) {
    const {col, row} = cellPosition(n);
    grid[row][col] = n;
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10, padding:'10px 4px' }}>

      {/* Status */}
      <div style={{ fontSize:13, fontWeight:700, color: status==='ended'?'#fbbf24':isMyTurn?'#22c55e':'#6060a0', textAlign:'center' }}>
        {status==='ended' ? `🏆 Победил: ${winnerName}` : isMyTurn ? '🎲 Ваш ход — бросьте кубик!' : `⏳ Ход: ${players.find(p=>p.hash===currentHash)?.name??''}`}
      </div>

      {/* Last effect */}
      {lastEffect && (
        <div style={{ fontSize:12, color:'#fbbf24', fontWeight:600, textAlign:'center', padding:'4px 10px',
          background:'rgba(251,191,36,0.1)', borderRadius:8, border:'1px solid rgba(251,191,36,0.2)' }}>
          {lastEffect}
        </div>
      )}

      {/* Dice */}
      {lastDice && (
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{ fontSize:36 }}>{['','⚀','⚁','⚂','⚃','⚄','⚅'][lastDice]}</div>
          <span style={{ fontSize:13, color:'#a0a0c0' }}>= {lastDice}</span>
        </div>
      )}

      {/* Board */}
      <div style={{
        display:'grid',
        gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
        gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`,
        gap:2,
        padding:6,
        background:'rgba(255,255,255,0.03)',
        border:'1px solid rgba(200,200,255,0.12)',
        borderRadius:10,
      }}>
        {/* Render rows bottom-to-top visually */}
        {Array.from({length:ROWS},(_,visualRow)=>{
          const dataRow = ROWS - 1 - visualRow; // flip: bottom row = row 0 in data
          return Array.from({length:COLS},(_2,col)=>{
            const cellNum = grid[dataRow][col];
            const ps = cellNum > 0 ? (playersByCell[cellNum]??[]) : [];
            const isStart = cellNum === 0;
            const isEnd = cellNum === TOTAL;
            return (
              <div key={`${visualRow}-${col}`}
                style={{
                  width:CELL, height:CELL, borderRadius:6,
                  background: cellNum===0 ? 'transparent' : isEnd ? 'rgba(251,191,36,0.25)' : cellBg(cellNum, specials),
                  border: cellNum===0 ? 'none' : `1px solid rgba(200,200,255,0.1)`,
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                  position:'relative', fontSize:8, color:'#6060a0',
                }}>
                {cellNum > 0 && (
                  <>
                    <div style={{fontSize:7,color:'rgba(160,160,200,0.5)',position:'absolute',top:2,left:3}}>{cellNum}</div>
                    {isEnd && <span style={{fontSize:16}}>🏁</span>}
                    {!isEnd && <span style={{fontSize:12}}>{cellLabel(cellNum,specials)}</span>}
                    {/* Player tokens */}
                    <div style={{display:'flex',flexWrap:'wrap',gap:1,justifyContent:'center',maxWidth:CELL-4}}>
                      {ps.map((p:any)=>(
                        <div key={p.hash} title={p.name}
                          style={{width:10,height:10,borderRadius:'50%',background:p.color,
                            border:`1.5px solid ${p.hash===myHash?'#fff':'rgba(255,255,255,0.3)'}`,
                            boxShadow:p.hash===currentHash?`0 0 6px ${p.color}`:'none'}}>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          });
        })}
      </div>

      {/* Player positions */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center' }}>
        {players.map((p:any)=>(
          <div key={p.hash} style={{ display:'flex', alignItems:'center', gap:6, padding:'4px 10px',
            background:`rgba(255,255,255,0.04)`, borderRadius:8,
            border:`1px solid ${p.hash===currentHash?p.color:'rgba(200,200,255,0.1)'}` }}>
            <div style={{width:12,height:12,borderRadius:'50%',background:p.color,flexShrink:0}}/>
            <span style={{fontSize:12,color:p.hash===myHash?'#fff':'#a0a0c0'}}>{p.name}</span>
            <span style={{fontSize:11,color:p.color,fontWeight:700}}>кл.{p.pos}</span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center', fontSize:10, color:'#5050a0' }}>
        <span>🪜 Лестница</span><span>🐍 Змея</span><span>⭐ Бонус</span><span>💤 Пропуск</span><span>🏁 Финиш</span>
      </div>

      {/* Roll button */}
      {isMyTurn && status === 'playing' && (
        <motion.button whileTap={{ scale: 0.92 }}
          onClick={() => onAction({ type: 'game_action', action: { type: 'roll' } })}
          style={{ padding:'12px 32px', borderRadius:14, border:'none', cursor:'pointer', fontWeight:800, fontSize:15,
            background:'linear-gradient(135deg,#6366f1,#a855f7)', color:'#fff',
            boxShadow:'0 4px 16px rgba(99,102,241,0.4)' }}>
          🎲 Бросить кубик
        </motion.button>
      )}
    </div>
  );
}
