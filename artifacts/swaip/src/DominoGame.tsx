import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import InGameChat from './InGameChat';

interface Domino { left: number; right: number; id: string; }
interface BoardPiece { domino: Domino; flipped: boolean; }
interface PlayerInfo { hash: string; name: string; avatar: string; }
interface GameState {
  gameId: string; gameType: 'domino';
  status: 'playing' | 'ended';
  board: BoardPiece[];
  leftEnd: number; rightEnd: number; boardEmpty: boolean;
  drawPileSize: number;
  currentHash: string;
  playerOrder: string[];
  players: Record<string, PlayerInfo>;
  winner: string | null;
  lastAction: string;
  handSizes: Record<string, number>;
  myHand: Domino[];
  consecutivePasses: number;
}

const C = { bg: '#07070f', surface: '#0f0f1c', card: '#14141f', border: 'rgba(200,200,255,0.1)',
  text: '#e8e8f8', sub: '#6060a0', accent: '#6366f1', green: '#22c55e' };

function hashColor(h: string) {
  const p = ['#6366f1','#ec4899','#3b82f6','#14b8a6','#f59e0b','#ef4444'];
  let n = 0; for (let i = 0; i < 8 && i < h.length; i++) n += h.charCodeAt(i);
  return p[n % p.length];
}
function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0]+p[1][0]).toUpperCase() : name.slice(0,2).toUpperCase();
}

const PIP_POS: Record<number, [number, number][]> = {
  0: [],
  1: [[50, 50]],
  2: [[25, 25], [75, 75]],
  3: [[25, 25], [50, 50], [75, 75]],
  4: [[25, 25], [75, 25], [25, 75], [75, 75]],
  5: [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  6: [[25, 20], [75, 20], [25, 50], [75, 50], [25, 80], [75, 80]],
};

function DominoFace({ value, size = 36 }: { value: number; size?: number }) {
  const pips = PIP_POS[value] || [];
  return (
    <div style={{ width: size, height: size, background: '#fff', borderRadius: 4, position: 'relative' }}>
      {pips.map(([x, y], i) => (
        <div key={i} style={{ position: 'absolute',
          left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)',
          width: size * 0.18, height: size * 0.18, borderRadius: '50%',
          background: value === 0 ? 'transparent' : '#1a1a2e' }} />
      ))}
    </div>
  );
}

function DomView({ dom, selected, horizontal, onClick, small }:
  { dom: Domino; selected?: boolean; horizontal?: boolean; onClick?: () => void; small?: boolean }) {
  const s = small ? 28 : 36;
  const isDouble = dom.left === dom.right;
  return (
    <motion.div whileTap={onClick ? { scale: 0.93 } : {}} onClick={onClick}
      style={{ display: 'flex', flexDirection: horizontal ? 'row' : 'column',
        gap: 2, cursor: onClick ? 'pointer' : 'default', flexShrink: 0,
        background: selected ? 'rgba(99,102,241,0.15)' : '#1a1a2e',
        border: selected ? `2px solid ${C.accent}` : '1.5px solid rgba(255,255,255,0.15)',
        borderRadius: 8, padding: 4,
        boxShadow: selected ? `0 0 0 3px rgba(99,102,241,0.3)` : '0 2px 8px rgba(0,0,0,0.4)',
        transform: selected ? 'translateY(-6px)' : 'none', transition: 'transform 0.15s' }}>
      <DominoFace value={dom.left} size={s} />
      <div style={{ width: horizontal ? 2 : '100%', height: horizontal ? '100%' : 2,
        background: 'rgba(255,255,255,0.3)', flexShrink: 0, minWidth: 2, minHeight: 2 }} />
      <DominoFace value={dom.right} size={s} />
    </motion.div>
  );
}

function canFit(dom: Domino, leftEnd: number, rightEnd: number, empty: boolean): { left: boolean; right: boolean } {
  if (empty) return { left: true, right: true };
  return {
    left: dom.left === leftEnd || dom.right === leftEnd,
    right: dom.left === rightEnd || dom.right === rightEnd,
  };
}

export default function DominoGame({ game, myHash, onAction, onLeave, chatMessages, onChat }:
  { game: GameState; myHash: string; onAction: (a: object) => void; onLeave: () => void; chatMessages?: any[]; onChat?: (t: string) => void }) {
  const [selected, setSelected] = useState<Domino | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const isMyTurn = game.currentHash === myHash;
  const canPlay = (dom: Domino) => {
    const { left, right } = canFit(dom, game.leftEnd, game.rightEnd, game.boardEmpty);
    return left || right;
  };
  const hasPlayable = game.myHand.some(canPlay);

  const place = (side: 'left' | 'right') => {
    if (!selected) return;
    onAction({ type: 'game_action', action: { type: 'place', dominoId: selected.id, side } });
    setSelected(null);
  };
  const draw = () => { onAction({ type: 'game_action', action: { type: 'draw' } }); };
  const pass = () => { onAction({ type: 'game_action', action: { type: 'pass' } }); setSelected(null); };

  if (game.status === 'ended') {
    const iWon = game.winner === myHash;
    return (
      <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 200,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 20, fontFamily: 'Montserrat,sans-serif' }}>
        <div style={{ fontSize: 56 }}>{iWon ? '🏆' : '😅'}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: C.text }}>
          {iWon ? 'Ты победил!' : `Победитель: ${game.players[game.winner || '']?.name || '?'}`}
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={onLeave}
          style={{ padding: '13px 32px', background: C.accent, border: 'none', borderRadius: 20,
            color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer' }}>
          Выйти
        </motion.button>
      </div>
    );
  }

  const selectedCanFit = selected ? canFit(selected, game.leftEnd, game.rightEnd, game.boardEmpty) : null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 200,
      display: 'flex', flexDirection: 'column', fontFamily: 'Montserrat,sans-serif', overflow: 'hidden' }}>

      {/* Шапка */}
      <div style={{ background: C.surface, padding: '48px 14px 12px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 22 }}>🎲</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900, color: C.text }}>Домино</div>
            <div style={{ fontSize: 11, color: C.sub }}>
              Резерв: {game.drawPileSize} · Ход: {game.players[game.currentHash]?.name}
            </div>
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onLeave}
            style={{ fontSize: 11, color: C.sub, background: 'none', border: `1px solid ${C.border}`,
              borderRadius: 16, padding: '5px 12px', cursor: 'pointer' }}>Выйти</motion.button>
        </div>

        {/* Игроки */}
        <div style={{ display: 'flex', gap: 10, marginTop: 10, overflowX: 'auto' }}>
          {game.playerOrder.map(h => (
            <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 6,
              background: h === game.currentHash ? 'rgba(99,102,241,0.18)' : C.card,
              border: h === game.currentHash ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`,
              borderRadius: 12, padding: '5px 10px', flexShrink: 0 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: hashColor(h),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 800, color: '#fff' }}>
                {initials(game.players[h]?.name || '?')}
              </div>
              <span style={{ fontSize: 11, color: h === game.currentHash ? C.accent : C.text }}>
                {game.players[h]?.name?.split(' ')[0]} 🎲{game.handSizes[h] ?? 0}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Последнее действие */}
      {game.lastAction && (
        <div style={{ padding: '6px 14px', background: C.card, fontSize: 11, color: C.sub }}>
          {game.lastAction}
        </div>
      )}

      {/* Доска */}
      <div style={{ flex: 1, overflowX: 'auto', padding: '16px 14px', display: 'flex',
        alignItems: 'center', minHeight: 120 }} ref={boardRef}>
        {game.board.length === 0 ? (
          <div style={{ color: C.sub, fontSize: 13 }}>Доска пуста</div>
        ) : (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {/* Левый конец */}
            {selected && selectedCanFit?.left && (
              <motion.div whileTap={{ scale: 0.9 }} onClick={() => place('left')}
                style={{ width: 44, height: 80, borderRadius: 8, border: `2px dashed ${C.accent}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', background: 'rgba(99,102,241,0.08)', flexShrink: 0 }}>
                <span style={{ fontSize: 16 }}>◀</span>
              </motion.div>
            )}

            {game.board.map((bp, i) => (
              <DomView key={i} dom={bp.domino} horizontal small />
            ))}

            {/* Правый конец */}
            {selected && selectedCanFit?.right && (
              <motion.div whileTap={{ scale: 0.9 }} onClick={() => place('right')}
                style={{ width: 44, height: 80, borderRadius: 8, border: `2px dashed ${C.accent}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', background: 'rgba(99,102,241,0.08)', flexShrink: 0 }}>
                <span style={{ fontSize: 16 }}>▶</span>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Подсказка */}
      {isMyTurn && (
        <div style={{ padding: '4px 14px', fontSize: 11, textAlign: 'center',
          color: selected ? C.accent : C.sub }}>
          {selected
            ? '← Нажми стрелку чтобы поставить домино'
            : hasPlayable
              ? 'Выбери домино из руки'
              : game.drawPileSize > 0 ? 'Нет ходов — возьми из резерва' : 'Нет ходов — пасуй'}
        </div>
      )}
      {!isMyTurn && (
        <div style={{ padding: '4px 14px', fontSize: 11, textAlign: 'center', color: C.sub }}>
          Ход {game.players[game.currentHash]?.name}…
        </div>
      )}

      {/* Кнопки */}
      {isMyTurn && (
        <div style={{ padding: '6px 14px 8px', display: 'flex', gap: 8 }}>
          {game.drawPileSize > 0 && !hasPlayable && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={draw}
              style={{ flex: 1, padding: '11px', background: 'rgba(245,158,11,0.15)',
                border: '1px solid rgba(245,158,11,0.4)', borderRadius: 16,
                color: '#f59e0b', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              📥 Взять из резерва
            </motion.button>
          )}
          {(!hasPlayable || game.drawPileSize === 0) && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={pass}
              style={{ flex: 1, padding: '11px', background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.35)', borderRadius: 16,
                color: '#ef4444', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              ✋ Пас
            </motion.button>
          )}
          {selected && (
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => setSelected(null)}
              style={{ padding: '11px 14px', background: C.card, border: `1px solid ${C.border}`,
                borderRadius: 16, color: C.sub, fontSize: 12, cursor: 'pointer' }}>
              Отмена
            </motion.button>
          )}
        </div>
      )}

      {/* Рука */}
      <div style={{ padding: '8px 14px 32px', background: C.surface, borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 11, color: C.sub, marginBottom: 8 }}>
          Твои домино ({game.myHand.length})
          {isMyTurn && selected ? ' — нажми стрелку' : isMyTurn ? ' — выбери для хода' : ''}
        </div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {game.myHand.map(dom => (
            <DomView key={dom.id} dom={dom}
              selected={selected?.id === dom.id}
              onClick={isMyTurn ? () => setSelected(prev => prev?.id === dom.id ? null : dom) : undefined} />
          ))}
          {game.myHand.length === 0 && (
            <div style={{ color: C.green, fontSize: 13, padding: '20px 0' }}>🏆 Ты выложил все домино!</div>
          )}
        </div>
      </div>
      <InGameChat messages={chatMessages || []} myHash={myHash} onSend={onChat || (() => {})} />
    </div>
  );
}
