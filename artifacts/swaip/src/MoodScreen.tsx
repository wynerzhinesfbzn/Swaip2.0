import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API = window.location.origin;
const getST = () => { try { return localStorage.getItem('swaip_session') || localStorage.getItem('swaip_session_token') || ''; } catch { return ''; } };

const MOOD_EMOJIS = [
  { emoji: '😊', label: 'Радостно' },
  { emoji: '🥰', label: 'Влюблён(а)' },
  { emoji: '😎', label: 'Круто' },
  { emoji: '🤩', label: 'Восхищён(а)' },
  { emoji: '😂', label: 'Смешно' },
  { emoji: '😌', label: 'Спокойно' },
  { emoji: '🥳', label: 'Праздник' },
  { emoji: '💪', label: 'Энергично' },
  { emoji: '🤔', label: 'Задумчиво' },
  { emoji: '😴', label: 'Сонно' },
  { emoji: '😔', label: 'Грустно' },
  { emoji: '😤', label: 'Раздражён(а)' },
  { emoji: '😰', label: 'Тревожно' },
  { emoji: '🤒', label: 'Болею' },
  { emoji: '😶', label: 'Устал(а)' },
  { emoji: '🔥', label: 'На огне' },
  { emoji: '❄️', label: 'Холодно' },
  { emoji: '🎵', label: 'В настроении' },
  { emoji: '🎮', label: 'Играю' },
  { emoji: '📚', label: 'Учусь' },
  { emoji: '✈️', label: 'В поездке' },
  { emoji: '🏠', label: 'Дома' },
  { emoji: '🌙', label: 'Ночь' },
  { emoji: '☀️', label: 'Солнечно' },
];

interface FriendMood {
  userHash: string; userName: string; userAvatar: string;
  emoji: string; text: string; setAt: number;
}

function fmtAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return 'только что';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
  return `${Math.floor(diff / 3600000)} ч назад`;
}
function Av({ name, avatar, size = 36 }: { name: string; avatar?: string; size?: number }) {
  const colors = ['#7c3aed', '#db2777', '#059669', '#d97706', '#2563eb'];
  const col = colors[(name.charCodeAt(0) || 0) % colors.length];
  if (avatar) return <img src={avatar} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return <div style={{ width: size, height: size, borderRadius: '50%', background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: size * 0.4, flexShrink: 0, fontFamily: '"Montserrat",sans-serif' }}>{name[0]?.toUpperCase() || '?'}</div>;
}

export default function MoodScreen({ myHash, onBack, onMoodSet }: {
  myHash: string;
  onBack: () => void;
  onMoodSet?: (emoji: string, text: string) => void;
}) {
  const [myMood, setMyMood] = useState<{ emoji: string; text: string } | null>(null);
  const [friendMoods, setFriendMoods] = useState<FriendMood[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPicker, setShowPicker] = useState(false);
  const [selected, setSelected] = useState('');
  const [moodText, setMoodText] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2500); };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [myR, frR] = await Promise.all([
          fetch(`${API}/api/moods/my`, { headers: { 'x-session-token': getST() } }),
          fetch(`${API}/api/moods/all`),
        ]);
        const myD = await myR.json();
        const frD = await frR.json();
        if (myD.mood) { setMyMood({ emoji: myD.mood.emoji, text: myD.mood.text }); }
        const all: FriendMood[] = (frD.moods || []).filter((m: FriendMood) => m.userHash !== myHash);
        setFriendMoods(all);
      } catch { /* */ }
      setLoading(false);
    };
    load();
  }, [myHash]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/moods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': getST() },
        body: JSON.stringify({ emoji: selected, text: moodText.trim() }),
      });
      const d = await r.json();
      if (d.success) {
        setMyMood({ emoji: selected, text: moodText.trim() });
        onMoodSet?.(selected, moodText.trim());
        setShowPicker(false);
        setSelected('');
        setMoodText('');
        showToast('🎭 Настроение обновлено!');
      }
    } catch { /* */ }
    setSaving(false);
  };

  const clear = async () => {
    await fetch(`${API}/api/moods`, { method: 'DELETE', headers: { 'x-session-token': getST() } }).catch(() => {});
    setMyMood(null);
    onMoodSet?.('', '');
    showToast('Настроение сброшено');
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#05050c', display: 'flex', flexDirection: 'column', fontFamily: '"Montserrat",sans-serif', zIndex: 500 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '48px 16px 14px', background: 'rgba(8,8,18,0.98)', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, backdropFilter: 'blur(20px)' }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
          style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 18, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</motion.button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#fff' }}>🎭 Настроение дня</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Поделись с друзьями как ты сегодня</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 80px' }}>

        {/* My current mood */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>Моё настроение</div>
          <motion.div whileTap={{ scale: 0.98 }} onClick={() => setShowPicker(true)}
            style={{ background: myMood ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.04)', border: `1.5px solid ${myMood ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: 20, padding: '18px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 44 }}>{myMood?.emoji || '🫥'}</div>
            <div style={{ flex: 1 }}>
              {myMood ? (
                <>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>{myMood.emoji} {MOOD_EMOJIS.find(m => m.emoji === myMood.emoji)?.label || ''}</div>
                  {myMood.text && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 3 }}>{myMood.text}</div>}
                </>
              ) : (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'rgba(255,255,255,0.5)' }}>Нажми чтобы выбрать настроение</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 3 }}>Друзья увидят твоё настроение сегодня</div>
                </div>
              )}
            </div>
            {myMood ? (
              <motion.button whileTap={{ scale: 0.9 }} onClick={e => { e.stopPropagation(); clear(); }}
                style={{ padding: '8px 14px', borderRadius: 100, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: '#f87171', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: '"Montserrat",sans-serif' }}>
                Сброс
              </motion.button>
            ) : (
              <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.3)' }}>+</div>
            )}
          </motion.div>
        </div>

        {/* Friends moods */}
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' }}>
          Настроение сообщества
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)' }}>Загрузка...</div>
        ) : friendMoods.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🌐</div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>Никто пока не поделился настроением</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {friendMoods.map(m => (
              <motion.div key={m.userHash} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Av name={m.userName} avatar={m.userAvatar} size={28} />
                  <div style={{ fontWeight: 700, fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.userName}</div>
                </div>
                <div style={{ fontSize: 32, textAlign: 'center' }}>{m.emoji}</div>
                {m.text && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 1.3 }}>{m.text}</div>}
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', textAlign: 'center' }}>{fmtAgo(m.setAt)}</div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Picker modal */}
      <AnimatePresence>
        {showPicker && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowPicker(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 600 }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
              style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 601, background: '#0f0f1a', borderRadius: '24px 24px 0 0', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90dvh', overflowY: 'auto', padding: '8px 20px calc(36px + env(safe-area-inset-bottom,0px))' }}>
              <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 99, margin: '10px auto 18px' }} />
              <div style={{ fontWeight: 900, fontSize: 17, color: '#fff', marginBottom: 16 }}>Как ты сегодня?</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 16 }}>
                {MOOD_EMOJIS.map(m => (
                  <motion.button key={m.emoji} whileTap={{ scale: 0.9 }} onClick={() => setSelected(m.emoji)}
                    style={{ padding: '12px 4px', borderRadius: 14, border: `2px solid ${selected === m.emoji ? 'rgba(124,58,237,0.7)' : 'rgba(255,255,255,0.08)'}`, background: selected === m.emoji ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 28 }}>{m.emoji}</span>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.5)', fontFamily: '"Montserrat",sans-serif', fontWeight: 600, textAlign: 'center', lineHeight: 1.2 }}>{m.label}</span>
                  </motion.button>
                ))}
              </div>

              <input value={moodText} onChange={e => setMoodText(e.target.value.slice(0, 60))}
                placeholder="Доп. текст (необязательно)..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '11px 14px', color: '#fff', fontSize: 13, fontFamily: '"Montserrat",sans-serif', boxSizing: 'border-box', outline: 'none', marginBottom: 14 }} />

              <motion.button whileTap={{ scale: 0.97 }} onClick={save} disabled={!selected || saving}
                style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', fontWeight: 900, fontSize: 15, cursor: !selected ? 'not-allowed' : 'pointer', fontFamily: '"Montserrat",sans-serif', color: '#fff', background: !selected ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
                {saving ? 'Сохраняю...' : selected ? `${selected} Поделиться настроением` : 'Выбери настроение'}
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: 'rgba(20,20,35,0.97)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 50, padding: '10px 22px', fontSize: 13, color: '#fff', fontWeight: 700, zIndex: 1000, whiteSpace: 'nowrap' }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
