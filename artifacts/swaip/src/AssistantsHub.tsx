import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { SPECIALISTS, type Specialist } from './specialistsConfig';
import AssistantScreen from './AssistantScreen';
import { useBackHandler } from './backHandler';

interface AssistantsHubProps {
  onBack: () => void;
}

export interface ConvState {
  answer: { title: string; answer: string; voiceScript: string; voice: string } | null;
  question: string;
}

export default function AssistantsHub({ onBack }: AssistantsHubProps) {
  const [selected, setSelected] = useState<Specialist | null>(null);
  const convsRef = useRef<Record<string, ConvState>>({});

  useBackHandler(!selected ? onBack : null);

  const handleStateChange = (id: string, state: ConvState) => {
    convsRef.current[id] = state;
  };

  if (selected) {
    return (
      <AssistantScreen
        specialist={selected}
        onBack={() => setSelected(null)}
        savedState={convsRef.current[selected.id] ?? null}
        onStateChange={s => handleStateChange(selected.id, s)}
      />
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(160deg,#05050f 0%,#0a0a1f 50%,#05050f 100%)',
      fontFamily: '"Montserrat",sans-serif',
      overflowY: 'auto',
    }}>

      {/* Stars */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        {STAR_POSITIONS.map((s, i) => (
          <motion.div key={i}
            animate={{ opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: s.dur, repeat: Infinity, delay: s.delay }}
            style={{ position: 'absolute', width: s.size, height: s.size, borderRadius: '50%', background: '#fff', left: `${s.x}%`, top: `${s.y}%` }} />
        ))}
      </div>

      {/* Header */}
      <div style={{
        position: 'relative', zIndex: 2, flexShrink: 0,
        padding: '48px 16px 20px',
        background: 'linear-gradient(180deg,rgba(255,255,255,0.06) 0%,transparent 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <motion.button whileTap={{ scale: 0.85 }} onClick={onBack}
            style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff', fontSize: 18, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>←</motion.button>
          <div>
            <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>SWAP</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1 }}>Виртуальные помощники</div>
          </div>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, paddingLeft: 50 }}>
          12 AI-специалистов · Голосовые ответы · Ввод голосом и текстом
        </p>
      </div>

      {/* Grid */}
      <div style={{
        position: 'relative', zIndex: 2, flex: 1,
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: 12, padding: '16px 12px 32px',
      }}>
        {SPECIALISTS.map((sp, idx) => {
          const hasConv = !!(convsRef.current[sp.id]?.answer);
          return (
            <motion.button
              key={sp.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.035, type: 'spring', damping: 22 }}
              whileTap={{ scale: 0.94 }}
              onClick={() => setSelected(sp)}
              style={{
                position: 'relative', overflow: 'hidden',
                borderRadius: 20, border: hasConv ? '2px solid rgba(255,255,255,0.35)' : 'none',
                cursor: 'pointer', background: sp.cardGradient,
                padding: '18px 14px 16px',
                display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
                boxShadow: `0 8px 32px ${sp.cardGlow}, 0 2px 8px rgba(0,0,0,0.4)`,
                textAlign: 'left',
              }}>

              <div style={{ position: 'absolute', inset: 0, borderRadius: 20, background: 'linear-gradient(135deg,rgba(255,255,255,0.12) 0%,transparent 60%)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', top: 0, right: 0, width: 60, height: 60, borderRadius: '0 20px 0 60px', background: 'rgba(255,255,255,0.08)', pointerEvents: 'none' }} />

              {hasConv && (
                <div style={{ position: 'absolute', top: 8, right: 8, width: 10, height: 10, borderRadius: '50%', background: '#4cff91', boxShadow: '0 0 6px #4cff91' }} />
              )}

              <div style={{ fontSize: 34, lineHeight: 1 }}>{sp.emoji}</div>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#fff', lineHeight: 1.2, marginBottom: 3 }}>{sp.name}</div>
                <div style={{ display: 'inline-block', fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: sp.headerAccent, background: 'rgba(0,0,0,0.25)', borderRadius: 6, padding: '2px 6px', marginBottom: 5 }}>
                  {sp.role}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>{sp.tagline}</div>
              </div>

              <div style={{ position: 'absolute', bottom: 12, right: 14, width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>→</div>
            </motion.button>
          );
        })}
      </div>

      <div style={{ position: 'relative', zIndex: 2, flexShrink: 0, textAlign: 'center', padding: '0 16px 32px', color: 'rgba(255,255,255,0.18)', fontSize: 10 }}>
        Голос — OpenAI TTS · Текст — GPT-4.1 mini · Распознавание — Whisper
      </div>
    </div>
  );
}

const STAR_POSITIONS = Array.from({ length: 40 }, () => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 1,
  dur: 2 + Math.random() * 3,
  delay: Math.random() * 4,
}));
