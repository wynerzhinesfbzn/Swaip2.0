import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import InGameChat from './InGameChat';

interface Card { suit: string; value: string; id: string; }
const RED = new Set(['♥', '♦']);

interface GameState {
  gameId: string; gameType: 'pyanitsa';
  status: 'playing' | 'ended';
  table: Record<string, Card | null>;
  pileSizes: Record<string, number>;
  warPileSize: number;
  roundWinner: string | 'war' | null;
  playerOrder: string[];
  players: Record<string, { hash: string; name: string; avatar: string }>;
  winner: string | null;
  round: number;
  readyToFlip: string[];
}

function hashColor(h: string) {
  const p = ['#6366f1','#ec4899','#3b82f6','#14b8a6','#f59e0b','#ef4444'];
  let n = 0; for (let i = 0; i < 8 && i < h.length; i++) n += h.charCodeAt(i);
  return p[n % p.length];
}
function initials(name: string) {
  const p = name.trim().split(/\s+/);
  return p.length >= 2 ? (p[0][0]+p[1][0]).toUpperCase() : name.slice(0,2).toUpperCase();
}

function CardView({ card, faceDown }: { card?: Card; faceDown?: boolean }) {
  if (!card || faceDown) return (
    <div style={{ width: 70, height: 100, borderRadius: 10,
      background: 'linear-gradient(135deg,#312e81,#1e1b4b)',
      border: '2px solid rgba(255,255,255,0.15)' }} />
  );
  const col = RED.has(card.suit) ? '#ef4444' : '#111';
  return (
    <motion.div initial={{ rotateY: 180 }} animate={{ rotateY: 0 }} transition={{ duration: 0.4 }}
      style={{ width: 70, height: 100, borderRadius: 10, background: '#fff',
        border: '2px solid rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column',
        padding: '6px 8px', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', position: 'relative' }}>
      <div style={{ fontSize: 16, fontWeight: 900, color: col, lineHeight: 1 }}>
        {card.value}<br/>{card.suit}
      </div>
      <div style={{ position: 'absolute', bottom: 6, right: 8, fontSize: 16, fontWeight: 900,
        color: col, transform: 'rotate(180deg)', lineHeight: 1 }}>
        {card.value}<br/>{card.suit}
      </div>
    </motion.div>
  );
}

const C = { bg: '#07070f', surface: '#0f0f1c', card: '#14141f', border: 'rgba(200,200,255,0.1)',
  text: '#e8e8f8', sub: '#6060a0', accent: '#6366f1', green: '#22c55e' };

export default function PyanitsaGame({ game, myHash, onAction, onLeave, chatMessages, onChat }:
  { game: GameState; myHash: string; onAction: (a: object) => void; onLeave: () => void; chatMessages?: any[]; onChat?: (t: string) => void }) {
  const [flipping, setFlipping] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const mySize = game.pileSizes[myHash] ?? 0;
  const othHash = game.playerOrder.find(h => h !== myHash) || '';
  const othSize = game.pileSizes[othHash] ?? 0;
  const iWaiting = game.readyToFlip.includes(myHash);
  const othWaiting = game.readyToFlip.includes(othHash);
  const myCard = game.table[myHash];
  const othCard = game.table[othHash];
  const winner = game.roundWinner;

  const flip = useCallback(() => {
    if (iWaiting || mySize === 0) return;
    setFlipping(true);
    onAction({ type: 'game_action', action: { type: 'flip' } });
    setTimeout(() => setFlipping(false), 600);
    if (winner === myHash) setLastResult('Ты взял!');
    else if (winner === othHash) setLastResult('Противник взял!');
    else if (winner === 'war') setLastResult('Война!');
  }, [iWaiting, mySize, onAction, winner, myHash, othHash]);

  if (game.status === 'ended') {
    const iWon = game.winner === myHash;
    return (
      <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 200,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 20, fontFamily: 'Montserrat,sans-serif' }}>
        <div style={{ fontSize: 60 }}>{iWon ? '🏆' : game.winner ? '😵' : '🤝'}</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: C.text }}>
          {iWon ? 'Ты победил!' : game.winner ? 'Ты проиграл!' : 'Ничья!'}
        </div>
        <div style={{ fontSize: 14, color: C.sub }}>Сыграно раундов: {game.round}</div>
        {game.winner && (
          <div style={{ fontSize: 15, color: C.text }}>
            Победитель: {game.players[game.winner]?.name}
          </div>
        )}
        <motion.button whileTap={{ scale: 0.95 }} onClick={onLeave}
          style={{ padding: '13px 32px', background: C.accent, border: 'none', borderRadius: 20,
            color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer', marginTop: 10 }}>
          Выйти
        </motion.button>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 200,
      display: 'flex', flexDirection: 'column', fontFamily: 'Montserrat,sans-serif' }}>

      {/* Шапка */}
      <div style={{ background: C.surface, padding: '48px 16px 14px',
        borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ fontSize: 24 }}>🍺</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: C.text }}>Пьяница</div>
          <div style={{ fontSize: 11, color: C.sub }}>Раунд {game.round}</div>
        </div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onLeave}
          style={{ fontSize: 11, color: C.sub, background: 'none', border: `1px solid ${C.border}`,
            borderRadius: 16, padding: '5px 12px', cursor: 'pointer' }}>Выйти</motion.button>
      </div>

      {/* Противник */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0 10px', gap: 8 }}>
        <div style={{ width: 42, height: 42, borderRadius: '50%', background: hashColor(othHash),
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff' }}>
          {initials(game.players[othHash]?.name || '?')}
        </div>
        <div style={{ fontSize: 13, color: C.text }}>{game.players[othHash]?.name}</div>
        <div style={{ fontSize: 12, color: C.sub }}>🃏 {othSize} карт</div>
        {othWaiting && <div style={{ fontSize: 11, color: C.green }}>Ждёт тебя…</div>}
      </div>

      {/* Стол */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', gap: 20, position: 'relative' }}>

        {/* Карты на столе */}
        <div style={{ display: 'flex', gap: 40, alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 11, color: C.sub }}>
              {game.players[othHash]?.name?.split(' ')[0]}
            </div>
            {othCard ? <CardView card={othCard} /> : <CardView faceDown />}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            {game.warPileSize > 0 && (
              <div style={{ fontSize: 12, color: '#f59e0b', fontWeight: 700 }}>
                ⚔️ Война! ({game.warPileSize} карт)
              </div>
            )}
            {winner && winner !== 'war' && (
              <AnimatePresence>
                <motion.div key={winner} initial={{ scale: 0 }} animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  style={{ fontSize: 14, fontWeight: 800,
                    color: winner === myHash ? C.green : '#ef4444',
                    textAlign: 'center' }}>
                  {winner === myHash ? '🎉 Твоя!' : `😤 ${game.players[winner]?.name?.split(' ')[0]} берёт`}
                </motion.div>
              </AnimatePresence>
            )}
            {winner === 'war' && (
              <div style={{ fontSize: 22 }}>⚔️</div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: 11, color: C.sub }}>Ты</div>
            {myCard ? <CardView card={myCard} /> : <CardView faceDown />}
          </div>
        </div>
      </div>

      {/* Моя зона */}
      <div style={{ padding: '16px 20px 36px', background: C.surface,
        borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 12 }}>
        <div style={{ fontSize: 13, color: C.text }}>🃏 У тебя {mySize} карт</div>
        <motion.button whileTap={{ scale: 0.93 }} onClick={flip}
          disabled={iWaiting || mySize === 0}
          style={{ width: '100%', maxWidth: 300, padding: '16px', fontSize: 20, fontWeight: 900,
            background: iWaiting ? 'rgba(99,102,241,0.15)' : C.accent,
            border: iWaiting ? `2px solid ${C.accent}` : 'none',
            borderRadius: 22, color: iWaiting ? C.accent : '#fff', cursor: iWaiting ? 'default' : 'pointer',
            letterSpacing: 2 }}>
          {iWaiting ? '⏳ Ждём…' : mySize === 0 ? '🏆 Карт нет!' : '🃏 БИТЬ!'}
        </motion.button>
      </div>
      <InGameChat messages={chatMessages || []} myHash={myHash} onSend={onChat || (() => {})} />
    </div>
  );
}
