import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API = window.location.origin;
const getST = () => { try { return localStorage.getItem('swaip_session') || localStorage.getItem('swaip_session_token') || ''; } catch { return ''; } };

interface PollOption { id: string; text: string; voteCount: number; }
interface Poll {
  id: string; authorHash: string; authorName: string; authorAvatar: string;
  question: string; allowMultiple: boolean; expiresAt: number | null;
  createdAt: number; expired: boolean; total: number; myVotes: string[];
  options: PollOption[];
}

function fmtTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtExpiry(ts: number | null) {
  if (!ts) return null;
  const diff = ts - Date.now();
  if (diff <= 0) return 'Завершён';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 24) return `${Math.floor(h / 24)}д`;
  if (h > 0) return `${h}ч ${m}м`;
  return `${m}м`;
}

function Av({ name, avatar, size = 32 }: { name: string; avatar?: string; size?: number }) {
  const colors = ['#7c3aed', '#db2777', '#059669', '#d97706', '#2563eb'];
  const col = colors[(name.charCodeAt(0) || 0) % colors.length];
  if (avatar) return <img src={avatar} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return <div style={{ width: size, height: size, borderRadius: '50%', background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: size * 0.4, flexShrink: 0, fontFamily: '"Montserrat",sans-serif' }}>{name[0]?.toUpperCase() || '?'}</div>;
}

function PollCard({ poll, myHash, onVoted }: { poll: Poll; myHash: string; onVoted: (updated: Poll) => void }) {
  const [myVotes, setMyVotes] = useState<string[]>(poll.myVotes || []);
  const [options, setOptions] = useState<PollOption[]>(poll.options);
  const [total, setTotal] = useState(poll.total);
  const [voting, setVoting] = useState(false);
  const hasVoted = myVotes.length > 0;
  const isExpired = poll.expired || (poll.expiresAt != null && Date.now() > poll.expiresAt);

  const vote = async (optionId: string) => {
    if (voting || isExpired) return;
    let newVotes: string[];
    if (poll.allowMultiple) {
      newVotes = myVotes.includes(optionId) ? myVotes.filter(v => v !== optionId) : [...myVotes, optionId];
    } else {
      newVotes = myVotes.includes(optionId) ? [] : [optionId];
    }
    setVoting(true);
    try {
      const r = await fetch(`${API}/api/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': getST() },
        body: JSON.stringify({ optionIds: newVotes }),
      });
      const d = await r.json();
      if (d.poll) {
        setMyVotes(d.poll.myVotes || []);
        setOptions(d.poll.options);
        setTotal(d.poll.total);
        onVoted(d.poll);
      }
    } catch { /* */ }
    setVoting(false);
  };

  const expiry = fmtExpiry(poll.expiresAt);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '16px 18px', marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Av name={poll.authorName} avatar={poll.authorAvatar} />
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#fff' }}>{poll.authorName}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{fmtTime(poll.createdAt)}</div>
        </div>
        {expiry && (
          <div style={{ marginLeft: 'auto', fontSize: 11, color: isExpired ? 'rgba(239,68,68,0.7)' : 'rgba(167,139,250,0.7)', fontWeight: 700 }}>
            {isExpired ? '🔒 Завершён' : `⏱ ${expiry}`}
          </div>
        )}
        {poll.allowMultiple && (
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: 100, marginLeft: expiry ? 4 : 'auto' }}>
            Мульти
          </div>
        )}
      </div>

      <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', marginBottom: 14, lineHeight: 1.4 }}>
        📊 {poll.question}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {options.map(opt => {
          const pct = total > 0 ? Math.round((opt.voteCount / total) * 100) : 0;
          const chosen = myVotes.includes(opt.id);
          return (
            <motion.button key={opt.id} whileTap={!isExpired && !voting ? { scale: 0.98 } : {}}
              onClick={() => vote(opt.id)}
              style={{ position: 'relative', width: '100%', padding: '11px 14px', borderRadius: 12, border: `1.5px solid ${chosen ? 'rgba(167,139,250,0.6)' : 'rgba(255,255,255,0.1)'}`, background: 'transparent', cursor: isExpired ? 'default' : 'pointer', textAlign: 'left', overflow: 'hidden' }}>
              {hasVoted && (
                <div style={{ position: 'absolute', inset: 0, left: 0, width: `${pct}%`, background: chosen ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.05)', borderRadius: 10, transition: 'width 0.4s ease' }} />
              )}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: chosen ? '#c4b5fd' : 'rgba(255,255,255,0.85)', fontFamily: '"Montserrat",sans-serif' }}>
                  {chosen ? '✓ ' : ''}{opt.text}
                </span>
                {hasVoted && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: chosen ? '#a78bfa' : 'rgba(255,255,255,0.4)', flexShrink: 0, marginLeft: 8 }}>{pct}%</span>
                )}
              </div>
            </motion.button>
          );
        })}
      </div>

      <div style={{ marginTop: 10, fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>
        {total} {total === 1 ? 'голос' : total < 5 ? 'голоса' : 'голосов'}
        {poll.allowMultiple && ' · можно выбрать несколько'}
      </div>
    </motion.div>
  );
}

export default function PollsScreen({ myHash, onBack }: { myHash: string; onBack: () => void }) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ question: '', options: ['', ''], allowMultiple: false, expiresInHours: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/polls?contextType=feed`, { headers: { 'x-session-token': getST() } });
      const d = await r.json();
      setPolls(d.polls || []);
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    const opts = form.options.filter(o => o.trim());
    if (!form.question.trim() || opts.length < 2) return;
    setCreating(true);
    try {
      const r = await fetch(`${API}/api/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': getST() },
        body: JSON.stringify({
          question: form.question.trim(),
          options: opts,
          allowMultiple: form.allowMultiple,
          expiresInHours: form.expiresInHours ? parseInt(form.expiresInHours) : undefined,
          contextType: 'feed',
        }),
      });
      const d = await r.json();
      if (d.poll) {
        setPolls(prev => [d.poll, ...prev]);
        setShowCreate(false);
        setForm({ question: '', options: ['', ''], allowMultiple: false, expiresInHours: '' });
      }
    } catch { /* */ }
    setCreating(false);
  };

  const addOption = () => { if (form.options.length < 10) setForm(p => ({ ...p, options: [...p.options, ''] })); };
  const updateOption = (i: number, v: string) => setForm(p => ({ ...p, options: p.options.map((o, j) => j === i ? v : o) }));
  const removeOption = (i: number) => { if (form.options.length > 2) setForm(p => ({ ...p, options: p.options.filter((_, j) => j !== i) })); };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#05050c', display: 'flex', flexDirection: 'column', fontFamily: '"Montserrat",sans-serif', zIndex: 500 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '48px 16px 14px', background: 'rgba(8,8,18,0.98)', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, backdropFilter: 'blur(20px)' }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
          style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 18, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</motion.button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#fff' }}>📊 Опросы</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Голосуй и узнавай мнения</div>
        </div>
        <motion.button whileTap={{ scale: 0.92 }} onClick={() => setShowCreate(true)}
          style={{ padding: '9px 16px', borderRadius: 100, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#db2777)', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
          + Создать
        </motion.button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 80px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'rgba(255,255,255,0.3)' }}>Загрузка...</div>
        ) : polls.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>📊</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', marginBottom: 6 }}>Нет опросов</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Создай первый!</div>
          </div>
        ) : polls.map(p => (
          <PollCard key={p.id} poll={p} myHash={myHash} onVoted={updated => setPolls(prev => prev.map(x => x.id === updated.id ? updated : x))} />
        ))}
      </div>

      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCreate(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 600 }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
              style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 601, background: '#0f0f1a', borderRadius: '24px 24px 0 0', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '90dvh', overflowY: 'auto', padding: '8px 20px calc(36px + env(safe-area-inset-bottom,0px))' }}>
              <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 99, margin: '10px auto 20px' }} />
              <div style={{ fontWeight: 900, fontSize: 17, color: '#fff', marginBottom: 16 }}>📊 Новый опрос</div>

              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 700 }}>ВОПРОС</div>
                <textarea value={form.question} onChange={e => setForm(p => ({ ...p, question: e.target.value }))}
                  placeholder="Какой вопрос хочешь задать?"
                  rows={2}
                  style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 14, resize: 'none', fontFamily: '"Montserrat",sans-serif', boxSizing: 'border-box', outline: 'none' }} />
              </div>

              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 8, fontWeight: 700 }}>ВАРИАНТЫ ОТВЕТА</div>
              {form.options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input value={opt} onChange={e => updateOption(i, e.target.value)}
                    placeholder={`Вариант ${i + 1}`}
                    style={{ flex: 1, background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 13, fontFamily: '"Montserrat",sans-serif', outline: 'none' }} />
                  {form.options.length > 2 && (
                    <button onClick={() => removeOption(i)} style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'rgba(239,68,68,0.15)', color: '#f87171', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                  )}
                </div>
              ))}
              {form.options.length < 10 && (
                <button onClick={addOption} style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1.5px dashed rgba(255,255,255,0.15)', background: 'transparent', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13, fontFamily: '"Montserrat",sans-serif', marginBottom: 14 }}>
                  + Добавить вариант
                </button>
              )}

              <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 700 }}>СРОК (часов)</div>
                  <input type="number" min="1" value={form.expiresInHours} onChange={e => setForm(p => ({ ...p, expiresInHours: e.target.value }))}
                    placeholder="∞ без срока"
                    style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 13, fontFamily: '"Montserrat",sans-serif', boxSizing: 'border-box', outline: 'none' }} />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 700 }}>МУЛЬТИ-ВЫБОР</div>
                  <button onClick={() => setForm(p => ({ ...p, allowMultiple: !p.allowMultiple }))}
                    style={{ flex: 1, borderRadius: 10, border: `1.5px solid ${form.allowMultiple ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.1)'}`, background: form.allowMultiple ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)', color: form.allowMultiple ? '#c4b5fd' : 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: '"Montserrat",sans-serif' }}>
                    {form.allowMultiple ? '✓ Вкл' : 'Выкл'}
                  </button>
                </div>
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={create} disabled={creating || !form.question.trim() || form.options.filter(o => o.trim()).length < 2}
                style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', fontWeight: 900, fontSize: 15, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif', color: '#fff', background: !form.question.trim() ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
                {creating ? 'Создаю...' : '📊 Опубликовать опрос'}
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
