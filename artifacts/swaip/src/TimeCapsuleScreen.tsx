import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API = window.location.origin;
const getST = () => { try { return localStorage.getItem('swaip_session') || localStorage.getItem('swaip_session_token') || ''; } catch { return ''; } };

interface Capsule {
  id: string; authorHash: string; authorName: string; authorAvatar: string;
  revealAt: number; createdAt: number; revealed: boolean;
  content: string | null; imageUrl: string | null; preview: string | null;
  recipientHash: string | null;
}

function fmtReveal(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' });
}
function countdown(ts: number) {
  const diff = ts - Date.now();
  if (diff <= 0) return 'Открыта!';
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `${d}д ${h}ч`;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

function CapsuleCard({ cap, onDelete, myHash }: { cap: Capsule; onDelete: (id: string) => void; myHash: string }) {
  const [open, setOpen] = useState(false);
  const isOwn = cap.authorHash === myHash;
  const daysLeft = Math.ceil((cap.revealAt - Date.now()) / 86400000);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${cap.revealed ? 'rgba(34,197,94,0.5)' : 'rgba(167,139,250,0.25)'}`, borderRadius: 20, overflow: 'hidden', marginBottom: 12 }}>

      {/* Header */}
      <div onClick={() => cap.revealed && setOpen(v => !v)}
        style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, cursor: cap.revealed ? 'pointer' : 'default' }}>
        <div style={{ fontSize: 36, flexShrink: 0 }}>{cap.revealed ? '📬' : '📦'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: '#fff', marginBottom: 3 }}>
            {cap.revealed ? 'Капсула открыта!' : `Откроется ${fmtReveal(cap.revealAt)}`}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
            {cap.revealed ? 'Нажмите чтобы прочитать' : `⏳ Осталось: ${countdown(cap.revealAt)}`}
          </div>
        </div>
        {!cap.revealed && (
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#a78bfa' }}>{daysLeft > 0 ? daysLeft : '0'}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>ДНЕЙ</div>
          </div>
        )}
        {cap.revealed && <span style={{ color: '#22c55e', fontSize: 20 }}>▼</span>}
        {isOwn && !cap.revealed && (
          <motion.button whileTap={{ scale: 0.9 }} onClick={e => { e.stopPropagation(); onDelete(cap.id); }}
            style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 50, width: 30, height: 30, cursor: 'pointer', color: '#ef4444', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            ×
          </motion.button>
        )}
      </div>

      {/* Revealed content */}
      <AnimatePresence>
        {cap.revealed && open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden' }}>
            <div style={{ padding: '0 18px 18px' }}>
              {cap.imageUrl && <img src={cap.imageUrl} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: 12, maxHeight: 260, objectFit: 'cover' }} />}
              <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.88)', lineHeight: 1.7, whiteSpace: 'pre-wrap', background: 'rgba(167,139,250,0.08)', borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(167,139,250,0.15)' }}>
                {cap.content}
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 10, textAlign: 'right' }}>
                Написано {new Date(cap.createdAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sealed preview */}
      {!cap.revealed && (
        <div style={{ padding: '0 18px 16px' }}>
          <div style={{ background: 'rgba(167,139,250,0.07)', borderRadius: 12, padding: '10px 14px', border: '1px dashed rgba(167,139,250,0.2)', textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: 'rgba(167,139,250,0.6)', letterSpacing: 1.5, fontWeight: 700, textTransform: 'uppercase' }}>Запечатано</div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default function TimeCapsuleScreen({ myHash, onBack }: { myHash: string; onBack: () => void }) {
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ content: '', revealDate: '', imageUrl: '' });
  const [tab, setTab] = useState<'all' | 'ready'>('all');
  const [toast, setToast] = useState('');

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/capsules/my`, { headers: { 'x-session-token': getST() } });
      const d = await r.json();
      setCapsules(d.capsules || []);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.content.trim() || !form.revealDate) return;
    setCreating(true);
    try {
      const r = await fetch(`${API}/api/capsules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': getST() },
        body: JSON.stringify({ content: form.content, revealAt: new Date(form.revealDate).toISOString(), imageUrl: form.imageUrl || undefined }),
      });
      if (r.ok) {
        setShowCreate(false);
        setForm({ content: '', revealDate: '', imageUrl: '' });
        showToast('📦 Капсула создана!');
        load();
      }
    } catch { /* */ }
    setCreating(false);
  };

  const deleteCap = async (id: string) => {
    await fetch(`${API}/api/capsules/${id}`, { method: 'DELETE', headers: { 'x-session-token': getST() } }).catch(() => {});
    setCapsules(p => p.filter(c => c.id !== id));
    showToast('🗑 Капсула удалена');
  };

  const displayed = tab === 'ready' ? capsules.filter(c => c.revealed) : capsules;
  const readyCount = capsules.filter(c => c.revealed).length;

  /* Min date — tomorrow */
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().slice(0, 10);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#07070f', display: 'flex', flexDirection: 'column', fontFamily: '"Montserrat",sans-serif', zIndex: 500 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '52px 16px 14px', background: 'rgba(8,8,18,0.98)', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
          style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 16, color: '#fff' }}>←</motion.button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: '#fff' }}>📦 Капсулы времени</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Письма будущему себе</div>
        </div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowCreate(true)}
          style={{ padding: '9px 16px', borderRadius: 100, background: 'linear-gradient(135deg,#7c3aed,#a21caf)', border: 'none', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
          + Создать
        </motion.button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, padding: '10px 16px', flexShrink: 0 }}>
        {[['all', 'Все', capsules.length], ['ready', 'Открыты', readyCount]] .map(([k, lbl, cnt]) => (
          <button key={String(k)} onClick={() => setTab(k as 'all' | 'ready')}
            style={{ flex: 1, padding: '9px 0', borderRadius: 12, border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif',
              background: tab === k ? 'rgba(167,139,250,0.18)' : 'transparent', color: tab === k ? '#a78bfa' : 'rgba(255,255,255,0.4)' }}>
            {String(lbl)} {Number(cnt) > 0 && <span style={{ fontSize: 10, background: 'rgba(167,139,250,0.3)', borderRadius: 20, padding: '1px 6px' }}>{String(cnt)}</span>}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 16px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', paddingTop: 60, color: 'rgba(255,255,255,0.3)' }}>Загрузка...</div>
        ) : displayed.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>{tab === 'ready' ? '📭' : '📦'}</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
              {tab === 'ready' ? 'Нет открытых капсул' : 'Нет капсул'}
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>
              {tab === 'all' && 'Напишите письмо будущему себе — оно откроется в нужный день'}
            </div>
          </div>
        ) : displayed.map(c => (
          <CapsuleCard key={c.id} cap={c} onDelete={deleteCap} myHash={myHash} />
        ))}
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: 'rgba(20,20,35,0.97)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: 50, padding: '10px 22px', fontSize: 13, color: '#fff', fontWeight: 700, zIndex: 1000, whiteSpace: 'nowrap' }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCreate(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 600 }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
              style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 601, background: '#0f0f1a', borderRadius: '24px 24px 0 0', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 0 32px' }}>
              <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 99, margin: '10px auto 20px' }} />
              <div style={{ padding: '0 20px' }}>
                <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 4 }}>📦 Создать капсулу</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>Сообщение откроется в выбранную дату</div>

                <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  placeholder="Дорогой(ая) будущий(ая) я..."
                  rows={5}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '12px 14px', color: '#fff', fontSize: 14, resize: 'none', fontFamily: '"Montserrat",sans-serif', boxSizing: 'border-box', outline: 'none' }} />

                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: 6 }}>📅 Дата открытия</label>
                  <input type="date" min={minDate} value={form.revealDate} onChange={e => setForm(p => ({ ...p, revealDate: e.target.value }))}
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 14, fontFamily: '"Montserrat",sans-serif', boxSizing: 'border-box', outline: 'none', colorScheme: 'dark' }} />
                </div>

                <div style={{ marginTop: 12 }}>
                  <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 700, display: 'block', marginBottom: 6 }}>🖼 URL изображения (необязательно)</label>
                  <input value={form.imageUrl} onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value }))}
                    placeholder="https://..."
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 14, fontFamily: '"Montserrat",sans-serif', boxSizing: 'border-box', outline: 'none' }} />
                </div>

                <motion.button whileTap={{ scale: 0.97 }} onClick={create} disabled={creating || !form.content.trim() || !form.revealDate}
                  style={{ marginTop: 18, width: '100%', padding: '14px', borderRadius: 16, border: 'none', fontWeight: 900, fontSize: 15, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif', color: '#fff', background: creating || !form.content.trim() || !form.revealDate ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#7c3aed,#a21caf)' }}>
                  {creating ? 'Сохраняем...' : '📦 Запечатать капсулу'}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
