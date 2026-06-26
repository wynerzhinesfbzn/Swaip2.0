import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import InGameChat from './InGameChat';

interface PlayerInfo { hash: string; name: string; avatar: string; }
interface GameState {
  gameId: string; gameType: 'truthdare'; status: 'playing' | 'ended';
  playerOrder: string[]; players: Record<string, PlayerInfo>;
  currentHash: string; choice: 'truth' | 'dare' | null;
  currentTask: string | null; round: number; scores: Record<string, number>;
}

const C = { bg: '#07070f', surface: '#0f0f1c', card: '#14141f', border: 'rgba(200,200,255,0.1)',
  text: '#e8e8f8', sub: '#6060a0', accent: '#6366f1', green: '#22c55e' };

function hashColor(h: string) {
  const p = ['#6366f1','#ec4899','#3b82f6','#14b8a6','#f59e0b','#ef4444','#8b5cf6','#22c55e'];
  let n = 0; for (let i = 0; i < Math.min(h.length,8); i++) n += h.charCodeAt(i); return p[n % p.length];
}
function initials(n: string) {
  const p = n.trim().split(/\s+/); return p.length >= 2 ? (p[0][0]+p[1][0]).toUpperCase() : n.slice(0,2).toUpperCase();
}

export default function TruthDareGame({ game, myHash, onAction, onLeave, chatMessages, onChat }:
  { game: GameState; myHash: string; onAction: (a: object) => void; onLeave: () => void; chatMessages?: any[]; onChat?: (t: string) => void }) {
  const isMyTurn = game.currentHash === myHash;
  const chosen = !!game.choice;

  if (game.status === 'ended') {
    const sorted = [...game.playerOrder].sort((a, b) => (game.scores[b] || 0) - (game.scores[a] || 0));
    return (
      <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 200, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16, fontFamily: 'Montserrat,sans-serif', padding: 24 }}>
        <div style={{ fontSize: 48 }}>🎉</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>Игра окончена!</div>
        <div style={{ width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sorted.map((h, i) => (
            <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
              background: C.card, borderRadius: 14, border: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 18 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`}</span>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: hashColor(h),
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff' }}>
                {initials(game.players[h]?.name || '?')}
              </div>
              <span style={{ flex: 1, fontSize: 13, color: C.text }}>{game.players[h]?.name}</span>
              <span style={{ fontSize: 13, color: C.accent, fontWeight: 800 }}>⭐ {game.scores[h] || 0}</span>
            </div>
          ))}
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={onLeave}
          style={{ padding: '13px 32px', background: C.accent, border: 'none', borderRadius: 20,
            color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', marginTop: 8 }}>Выйти</motion.button>
      </div>
    );
  }

  const currentPlayer = game.players[game.currentHash];

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 200,
      display: 'flex', flexDirection: 'column', fontFamily: 'Montserrat,sans-serif', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: C.surface, padding: '44px 16px 12px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 22 }}>🎯</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: C.text }}>Правда или Действие</div>
          <div style={{ fontSize: 11, color: C.sub }}>Раунд {game.round}</div>
        </div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onLeave}
          style={{ fontSize: 11, color: C.sub, background: 'none', border: `1px solid ${C.border}`,
            borderRadius: 16, padding: '5px 12px', cursor: 'pointer' }}>Выйти</motion.button>
      </div>

      {/* Current player */}
      <div style={{ padding: '18px 16px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: hashColor(game.currentHash),
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff',
          boxShadow: `0 0 20px ${hashColor(game.currentHash)}60` }}>
          {initials(currentPlayer?.name || '?')}
        </div>
        <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>
          {isMyTurn ? '🫵 Твой ход!' : `Ход: ${currentPlayer?.name}`}
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        alignItems: 'center', padding: '0 20px', gap: 16 }}>
        <AnimatePresence mode="wait">
          {!chosen ? (
            <motion.div key="choose" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }} style={{ display: 'flex', gap: 16, width: '100%', maxWidth: 340 }}>
              <motion.button whileTap={{ scale: 0.92 }}
                onClick={isMyTurn ? () => onAction({ type: 'game_action', action: { type: 'choose', choice: 'truth' } }) : undefined}
                disabled={!isMyTurn}
                style={{ flex: 1, padding: '28px 10px', background: isMyTurn ? 'linear-gradient(135deg,#312e81,#6366f1)' : C.card,
                  border: `1.5px solid ${isMyTurn ? '#6366f1' : C.border}`, borderRadius: 22,
                  color: C.text, fontSize: 14, fontWeight: 900, cursor: isMyTurn ? 'pointer' : 'not-allowed',
                  opacity: isMyTurn ? 1 : 0.5, letterSpacing: 0.5 }}>
                🔍<br/>ПРАВДА
              </motion.button>
              <motion.button whileTap={{ scale: 0.92 }}
                onClick={isMyTurn ? () => onAction({ type: 'game_action', action: { type: 'choose', choice: 'dare' } }) : undefined}
                disabled={!isMyTurn}
                style={{ flex: 1, padding: '28px 10px', background: isMyTurn ? 'linear-gradient(135deg,#7f1d1d,#ef4444)' : C.card,
                  border: `1.5px solid ${isMyTurn ? '#ef4444' : C.border}`, borderRadius: 22,
                  color: C.text, fontSize: 14, fontWeight: 900, cursor: isMyTurn ? 'pointer' : 'not-allowed',
                  opacity: isMyTurn ? 1 : 0.5, letterSpacing: 0.5 }}>
                ⚡<br/>ДЕЙСТВИЕ
              </motion.button>
            </motion.div>
          ) : (
            <motion.div key="task" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ width: '100%', maxWidth: 380 }}>
              <div style={{ padding: '20px', borderRadius: 22,
                background: game.choice === 'truth' ? 'rgba(99,102,241,0.12)' : 'rgba(239,68,68,0.12)',
                border: `1.5px solid ${game.choice === 'truth' ? 'rgba(99,102,241,0.4)' : 'rgba(239,68,68,0.4)'}`,
                textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase',
                  color: game.choice === 'truth' ? '#818cf8' : '#f87171', marginBottom: 12 }}>
                  {game.choice === 'truth' ? '🔍 Правда' : '⚡ Действие'}
                </div>
                <div style={{ fontSize: 16, fontWeight: 700, color: C.text, lineHeight: 1.5 }}>
                  {game.currentTask}
                </div>
              </div>
              {isMyTurn && (
                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => onAction({ type: 'game_action', action: { type: 'done' } })}
                    style={{ flex: 2, padding: '13px', background: C.green, border: 'none',
                      borderRadius: 16, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                    ✅ Выполнено
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => onAction({ type: 'game_action', action: { type: 'skip' } })}
                    style={{ flex: 1, padding: '13px', background: 'transparent', border: `1px solid ${C.border}`,
                      borderRadius: 16, color: C.sub, fontSize: 13, cursor: 'pointer' }}>
                    Пропустить
                  </motion.button>
                </div>
              )}
              {!isMyTurn && (
                <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12, color: C.sub }}>
                  Ждём {currentPlayer?.name}…
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scoreboard */}
      <div style={{ padding: '10px 14px 28px', background: C.surface, borderTop: `1px solid ${C.border}` }}>
        <div style={{ fontSize: 10, color: C.sub, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Очки</div>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {game.playerOrder.map(h => (
            <div key={h} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
              background: h === game.currentHash ? 'rgba(99,102,241,0.15)' : C.card,
              border: h === game.currentHash ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
              borderRadius: 12, padding: '6px 10px', flexShrink: 0, minWidth: 54 }}>
              <div style={{ width: 24, height: 24, borderRadius: '50%', background: hashColor(h),
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff' }}>
                {initials(game.players[h]?.name || '?')}
              </div>
              <div style={{ fontSize: 9, color: C.text, maxWidth: 48, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {game.players[h]?.name?.split(' ')[0]}
              </div>
              <div style={{ fontSize: 12, fontWeight: 800, color: C.accent }}>⭐{game.scores[h] || 0}</div>
            </div>
          ))}
        </div>
      </div>
      <InGameChat messages={chatMessages || []} myHash={myHash} onSend={onChat || (() => {})} />
    </div>
  );
}
