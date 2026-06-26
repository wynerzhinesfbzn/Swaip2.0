import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import InGameChat from './InGameChat';

interface PlayerInfo { hash: string; name: string; avatar: string; }
interface GameState {
  gameId: string; gameType: 'crocodile'; status: 'playing' | 'ended';
  phase: 'explain' | 'between'; playerOrder: string[]; players: Record<string, PlayerInfo>;
  explainerHash: string; word?: string; scores: Record<string, number>;
  round: number; lastWord: string; lastExplainer: string; isExplainer: boolean;
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

export default function CrocodileGame({ game, myHash, onAction, onLeave, chatMessages, onChat }:
  { game: GameState; myHash: string; onAction: (a: object) => void; onLeave: () => void; chatMessages?: any[]; onChat?: (t: string) => void }) {
  const isExplainer = game.explainerHash === myHash;
  const explainer = game.players[game.explainerHash];

  if (game.status === 'ended') {
    const sorted = [...game.playerOrder].sort((a, b) => (game.scores[b] || 0) - (game.scores[a] || 0));
    return (
      <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 200, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 14, fontFamily: 'Montserrat,sans-serif', padding: 24 }}>
        <div style={{ fontSize: 48 }}>🐊</div>
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

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 200,
      display: 'flex', flexDirection: 'column', fontFamily: 'Montserrat,sans-serif', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ background: C.surface, padding: '44px 16px 12px', borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 22 }}>🐊</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: C.text }}>Крокодил</div>
          <div style={{ fontSize: 11, color: C.sub }}>Раунд {game.round} / 5</div>
        </div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onLeave}
          style={{ fontSize: 11, color: C.sub, background: 'none', border: `1px solid ${C.border}`,
            borderRadius: 16, padding: '5px 12px', cursor: 'pointer' }}>Выйти</motion.button>
      </div>

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '16px 20px', gap: 16 }}>
        <AnimatePresence mode="wait">
          {game.phase === 'explain' ? (
            <motion.div key="explain" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }} style={{ width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Explainer card */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 50, height: 50, borderRadius: '50%', background: hashColor(game.explainerHash),
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff',
                  boxShadow: `0 0 20px ${hashColor(game.explainerHash)}60` }}>
                  {initials(explainer?.name || '?')}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>
                  {isExplainer ? '🎭 Ты объясняешь!' : `🎭 ${explainer?.name} объясняет`}
                </div>
              </div>

              {/* Word (only for explainer) */}
              {isExplainer && game.word ? (
                <div style={{ padding: '20px', borderRadius: 20, background: 'rgba(99,102,241,0.12)',
                  border: '1.5px solid rgba(99,102,241,0.4)', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#818cf8', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
                    Твоё слово
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, color: C.text, letterSpacing: 2 }}>{game.word}</div>
                  <div style={{ fontSize: 11, color: C.sub, marginTop: 10 }}>Объясни без слов, жестами или описанием!</div>
                </div>
              ) : !isExplainer ? (
                <div style={{ padding: '20px', borderRadius: 20, background: C.card,
                  border: `1px solid ${C.border}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>🤔</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Угадай слово!</div>
                  <div style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>Напиши ответ в чате комнаты</div>
                </div>
              ) : null}

              {/* Explainer buttons */}
              {isExplainer && (
                <div style={{ display: 'flex', gap: 10 }}>
                  {/* Show players to pick who guessed */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: C.sub, marginBottom: 8 }}>Кто угадал?</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {game.playerOrder.filter(h => h !== myHash).map(h => (
                        <motion.button key={h} whileTap={{ scale: 0.95 }}
                          onClick={() => onAction({ type: 'game_action', action: { type: 'guessed', guesserHash: h } })}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px',
                            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
                            cursor: 'pointer', textAlign: 'left' }}>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: hashColor(h),
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', flexShrink: 0 }}>
                            {initials(game.players[h]?.name || '?')}
                          </div>
                          <span style={{ fontSize: 13, color: C.text }}>{game.players[h]?.name}</span>
                          <span style={{ marginLeft: 'auto', fontSize: 14 }}>✅</span>
                        </motion.button>
                      ))}
                    </div>
                    <motion.button whileTap={{ scale: 0.95 }}
                      onClick={() => onAction({ type: 'game_action', action: { type: 'skip' } })}
                      style={{ width: '100%', padding: '10px', marginTop: 10, background: 'transparent',
                        border: `1px solid ${C.border}`, borderRadius: 12, color: C.sub, fontSize: 13, cursor: 'pointer' }}>
                      Никто не угадал — пропустить
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div key="between" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, width: '100%', maxWidth: 380 }}>
              <div style={{ fontSize: 36 }}>🎯</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>Раунд завершён!</div>
              {game.lastWord && (
                <div style={{ padding: '12px 20px', borderRadius: 14, background: C.card,
                  border: `1px solid ${C.border}`, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>Было слово</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: C.accent }}>{game.lastWord}</div>
                </div>
              )}
              <motion.button whileTap={{ scale: 0.95 }}
                onClick={() => onAction({ type: 'game_action', action: { type: 'next' } })}
                style={{ padding: '13px 28px', background: C.accent, border: 'none', borderRadius: 18,
                  color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                ▶️ Следующий раунд
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Scoreboard */}
      <div style={{ padding: '8px 12px 28px', background: C.surface, borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {game.playerOrder.map(h => (
            <div key={h} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              background: h === game.explainerHash ? 'rgba(99,102,241,0.15)' : C.card,
              border: `1px solid ${h === game.explainerHash ? C.accent : C.border}`,
              borderRadius: 10, padding: '5px 8px', flexShrink: 0, minWidth: 48 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: hashColor(h),
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff' }}>
                {initials(game.players[h]?.name || '?')}
              </div>
              <div style={{ fontSize: 9, color: C.text, maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {game.players[h]?.name?.split(' ')[0]}
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.accent }}>⭐{game.scores[h] || 0}</div>
              {h === game.explainerHash && <div style={{ fontSize: 7, color: C.accent }}>🎭</div>}
            </div>
          ))}
        </div>
      </div>
      <InGameChat messages={chatMessages || []} myHash={myHash} onSend={onChat || (() => {})} />
    </div>
  );
}
