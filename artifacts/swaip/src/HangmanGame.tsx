import React, { useState } from 'react';
import { motion } from 'framer-motion';
import InGameChat from './InGameChat';

interface PlayerInfo { hash: string; name: string; avatar: string; }
interface GameState {
  gameId: string; gameType: 'hangman'; status: 'playing' | 'ended';
  maskedWord: string; wordLength: number;
  guessedLetters: string[]; wrongLetters: string[]; maxWrong: number; errorsLeft: number;
  winner: string | null; revealedWord?: string; lastGuesser: string | null;
  players: Record<string, PlayerInfo>; playerOrder: string[]; scores: Record<string, number>;
}

const C = { bg: '#07070f', surface: '#0f0f1c', card: '#14141f', border: 'rgba(200,200,255,0.1)',
  text: '#e8e8f8', sub: '#6060a0', accent: '#6366f1', green: '#22c55e', red: '#ef4444' };

function hashColor(h: string) {
  const p = ['#6366f1','#ec4899','#3b82f6','#14b8a6','#f59e0b','#ef4444','#8b5cf6','#22c55e'];
  let n = 0; for (let i = 0; i < Math.min(h.length,8); i++) n += h.charCodeAt(i); return p[n % p.length];
}
function initials(n: string) {
  const p = n.trim().split(/\s+/); return p.length >= 2 ? (p[0][0]+p[1][0]).toUpperCase() : n.slice(0,2).toUpperCase();
}

const PARTS = [
  // head, body, left arm, right arm, left leg, right leg, face
  { d: 'M 50 20 A 14 14 0 1 1 50.01 20', stroke: '#818cf8' },
  { d: 'M 50 34 L 50 68', stroke: '#818cf8' },
  { d: 'M 50 42 L 30 58', stroke: '#818cf8' },
  { d: 'M 50 42 L 70 58', stroke: '#818cf8' },
  { d: 'M 50 68 L 34 88', stroke: '#818cf8' },
  { d: 'M 50 68 L 66 88', stroke: '#818cf8' },
  { d: 'M 44 17 Q 50 12 56 17', stroke: '#ef4444' },
];

const ROWS = [
  'Й Ц У К Е Н Г Ш Щ З Х Ъ'.split(' '),
  'Ф Ы В А П Р О Л Д Ж Э'.split(' '),
  'Я Ч С М И Т Ь Б Ю'.split(' '),
];

export default function HangmanGame({ game, myHash, onAction, onLeave, chatMessages, onChat }:
  { game: GameState; myHash: string; onAction: (a: object) => void; onLeave: () => void; chatMessages?: any[]; onChat?: (t: string) => void }) {
  const wrong = game.wrongLetters.length;
  const partsShown = PARTS.slice(0, wrong);
  const isEnded = game.status === 'ended';

  const guess = (letter: string) => {
    if (game.guessedLetters.includes(letter) || game.wrongLetters.includes(letter) || isEnded) return;
    onAction({ type: 'game_action', action: { type: 'guess', letter } });
  };

  if (isEnded) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: C.bg, zIndex: 200, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 14, fontFamily: 'Montserrat,sans-serif', padding: 24 }}>
        <div style={{ fontSize: 48 }}>{game.winner ? '🏆' : '💀'}</div>
        <div style={{ fontSize: 20, fontWeight: 900, color: C.text }}>
          {game.winner ? `${game.players[game.winner]?.name} угадал!` : 'Никто не угадал'}
        </div>
        {game.revealedWord && (
          <div style={{ fontSize: 24, fontWeight: 900, color: C.accent, letterSpacing: 6 }}>{game.revealedWord}</div>
        )}
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
        <div style={{ fontSize: 22 }}>🔤</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: C.text }}>Виселица</div>
          <div style={{ fontSize: 11, color: C.sub }}>Ошибок: {wrong} / {game.maxWrong}</div>
        </div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onLeave}
          style={{ fontSize: 11, color: C.sub, background: 'none', border: `1px solid ${C.border}`,
            borderRadius: 16, padding: '5px 12px', cursor: 'pointer' }}>Выйти</motion.button>
      </div>

      {/* Gallows + Word */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 0 0', gap: 4 }}>
        <svg width="100" height="100" viewBox="0 0 100 100">
          {/* Gallows */}
          <line x1="10" y1="95" x2="90" y2="95" stroke="#444" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="25" y1="95" x2="25" y2="5" stroke="#444" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="25" y1="5" x2="50" y2="5" stroke="#444" strokeWidth="2.5" strokeLinecap="round" />
          <line x1="50" y1="5" x2="50" y2="8" stroke="#444" strokeWidth="2" strokeLinecap="round" />
          {/* Body parts */}
          {partsShown.map((p, i) => (
            <motion.path key={i} initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }}
              d={p.d} stroke={p.stroke} strokeWidth={i === 0 ? 2 : 2.5}
              fill={i === 0 ? 'none' : 'none'} strokeLinecap="round" />
          ))}
        </svg>
        {/* Word */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center', padding: '0 16px' }}>
          {game.maskedWord.split('').map((ch, i) => (
            <div key={i} style={{ minWidth: ch === ' ' ? 16 : 26, height: 36, borderBottom: ch !== ' ' ? '2px solid #818cf8' : 'none',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: 4 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: ch !== '_' ? C.green : 'transparent' }}>{ch === '_' ? '.' : ch}</span>
            </div>
          ))}
        </div>
        {/* Wrong letters */}
        {game.wrongLetters.length > 0 && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center', padding: '6px 20px 0' }}>
            {game.wrongLetters.map(l => (
              <span key={l} style={{ fontSize: 13, color: C.red, fontWeight: 700, opacity: 0.7 }}>{l}</span>
            ))}
          </div>
        )}
      </div>

      {/* Keyboard */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 8px', gap: 5 }}>
        {ROWS.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: 4, flexWrap: 'nowrap' }}>
            {row.map(letter => {
              const guessed = game.guessedLetters.includes(letter);
              const wrong2 = game.wrongLetters.includes(letter);
              const used = guessed || wrong2;
              return (
                <motion.button key={letter} whileTap={!used ? { scale: 0.85 } : {}} onClick={() => guess(letter)}
                  style={{ width: 30, height: 34, borderRadius: 8, border: 'none',
                    background: guessed ? 'rgba(34,197,94,0.2)' : wrong2 ? 'rgba(239,68,68,0.12)' : C.card,
                    color: guessed ? C.green : wrong2 ? C.red : C.text,
                    fontSize: 13, fontWeight: 700, cursor: used ? 'not-allowed' : 'pointer',
                    opacity: used ? 0.5 : 1, flexShrink: 0 }}>
                  {letter}
                </motion.button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Players */}
      <div style={{ padding: '8px 12px 28px', background: C.surface, borderTop: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {game.playerOrder.map(h => (
            <div key={h} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              background: game.lastGuesser === h ? 'rgba(99,102,241,0.15)' : C.card,
              border: `1px solid ${game.lastGuesser === h ? C.accent : C.border}`,
              borderRadius: 10, padding: '5px 8px', flexShrink: 0, minWidth: 48 }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: hashColor(h),
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff' }}>
                {initials(game.players[h]?.name || '?')}
              </div>
              <div style={{ fontSize: 9, color: C.text, maxWidth: 44, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {game.players[h]?.name?.split(' ')[0]}
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, color: C.accent }}>⭐{game.scores[h] || 0}</div>
            </div>
          ))}
        </div>
      </div>
      <InGameChat messages={chatMessages || []} myHash={myHash} onSend={onChat || (() => {})} />
    </div>
  );
}
