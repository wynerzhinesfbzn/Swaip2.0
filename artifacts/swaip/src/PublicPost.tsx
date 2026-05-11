import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ══════════════════════════════════════════════════════
   ПУБЛИЧНАЯ СТРАНИЦА ПОСТА
   /post/:shareId — доступна без регистрации.
   Запись/покупка — без регистрации.
   Комментарии — регистрация с возвратом на эту страницу.
══════════════════════════════════════════════════════ */

interface BookingSlot { time: string; booked: boolean; }
interface Comment { id: string; author: string; text: string; ts: number; }

interface PostData {
  id: string;
  type: string;
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  hasBooking?: boolean;
  bookingSlots?: BookingSlot[];
  bookingLabel?: string;
  createdAt: number;
  comments?: Comment[];
  reactions?: Record<string, number>;
}

interface ChannelData {
  id: string;
  name: string;
  vibeColor?: string;
  vibe?: string;
  avatarPhotoUrl?: string;
  handle?: string;
}

type PageStatus = 'loading' | 'not_found' | 'loaded' | 'booked';

function fmtSlot(s: string) {
  try {
    const [d, t] = s.split(' ');
    if (!d || !t) return s;
    const dt = new Date(`${d}T${t}`);
    return dt.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + t;
  } catch { return s; }
}

function timeAgo(ts: number) {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return 'только что';
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

export default function PublicPost() {
  const shareId = window.location.pathname.split('/post/')[1]?.split('?')[0] || '';

  const [status, setStatus] = useState<PageStatus>('loading');
  const [post, setPost] = useState<PostData | null>(null);
  const [channel, setChannel] = useState<ChannelData | null>(null);
  const [ownerHash, setOwnerHash] = useState('');

  /* Booking */
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [bookStatus, setBookStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  /* Comments nudge */
  const [showRegNudge, setShowRegNudge] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const commentInputRef = useRef<HTMLTextAreaElement>(null);

  const accent = channel?.vibeColor || '#6366f1';

  const c = {
    bg: '#07090f',
    card: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.08)',
    light: '#f8fafc',
    sub: 'rgba(255,255,255,0.4)',
    mid: 'rgba(255,255,255,0.65)',
  };

  const inp: React.CSSProperties = {
    padding: '13px 14px', borderRadius: 14, border: `1px solid ${c.border}`,
    background: c.card, color: c.light, fontSize: 14, fontFamily: 'inherit',
    outline: 'none', width: '100%', boxSizing: 'border-box',
  };

  useEffect(() => {
    if (!shareId) { setStatus('not_found'); return; }
    fetch(`${window.location.origin}/api/shared-post/${shareId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d?.post) { setStatus('not_found'); return; }
        setPost(d.post);
        setChannel(d.channel);
        setOwnerHash(d.ownerHash);
        setStatus('loaded');
      })
      .catch(() => setStatus('not_found'));
  }, [shareId]);

  /* ── Отправить запись (без регистрации) ── */
  const submitBooking = async () => {
    if (!clientName.trim() || !clientPhone.trim()) return;
    setBookStatus('sending');
    try {
      const r = await fetch(`${window.location.origin}/api/booking-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetHash: ownerHash,
          clientName: clientName.trim(),
          clientPhone: clientPhone.trim(),
          service: post?.bookingLabel || 'Запись',
          slot: selectedSlot || '',
          text: `Запись через публичную ссылку на пост. ${post?.bookingLabel || ''}. Слот: ${selectedSlot || 'не выбран'}`,
        }),
      });
      if (r.ok) { setBookStatus('done'); setStatus('booked'); }
      else setBookStatus('error');
    } catch { setBookStatus('error'); }
  };

  /* ── Зарегистрироваться и вернуться ── */
  const goRegister = () => {
    try { localStorage.setItem('swaip_return_url', window.location.href); } catch {}
    window.location.href = window.location.origin + '/';
  };

  /* ── Попытка написать комментарий ── */
  const onCommentFocus = () => {
    setCommentDraft('');
    setShowRegNudge(true);
    commentInputRef.current?.blur();
  };

  const freeSlots = post?.bookingSlots?.filter(s => !s.booked) || [];
  const comments: Comment[] = post?.comments || [];

  /* ─────────── LOADING ─────────── */
  if (status === 'loading') {
    return (
      <div style={{ minHeight: '100svh', background: '#07090f', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
          style={{ width: 42, height: 42, borderRadius: '50%', border: '3px solid rgba(99,102,241,0.15)', borderTopColor: '#6366f1' }} />
        <span style={{ color: 'rgba(165,180,252,0.45)', fontSize: 12, fontFamily: '"Montserrat",sans-serif', letterSpacing: '0.2em' }}>SWAIP</span>
      </div>
    );
  }

  /* ─────────── NOT FOUND ─────────── */
  if (status === 'not_found') {
    return (
      <div style={{ minHeight: '100svh', background: '#07090f', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, fontFamily: '"Montserrat",sans-serif' }}>
        <div style={{ fontSize: 48 }}>🔍</div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>Пост не найден</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center' }}>Возможно, ссылка устарела или пост был удалён</div>
        <button onClick={() => window.location.href = window.location.origin + '/'}
          style={{ marginTop: 8, padding: '12px 28px', borderRadius: 14, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
          Открыть SWAIP
        </button>
      </div>
    );
  }

  /* ─────────── BOOKED SUCCESS ─────────── */
  if (status === 'booked') {
    return (
      <div style={{ minHeight: '100svh', background: '#07090f', fontFamily: '"Montserrat",sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 18, textAlign: 'center' }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
          <div style={{ fontSize: 64 }}>🎉</div>
        </motion.div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#34d399' }}>Заявка отправлена!</div>
        <div style={{ fontSize: 14, color: c.sub, lineHeight: 1.6 }}>Мы получили вашу запись.<br />Ждём вас!</div>
        <div style={{ padding: '14px 18px', borderRadius: 18, background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)', width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left' }}>
          <div style={{ fontSize: 13, color: '#34d399', fontWeight: 700 }}>👤 {clientName}</div>
          <div style={{ fontSize: 13, color: '#34d399', fontWeight: 700 }}>📱 {clientPhone}</div>
          {selectedSlot && <div style={{ fontSize: 13, color: '#34d399', fontWeight: 700 }}>📅 {fmtSlot(selectedSlot)}</div>}
        </div>
        {/* CTA регистрации */}
        <div style={{ width: '100%', maxWidth: 360, padding: '16px', borderRadius: 20, background: 'linear-gradient(135deg,rgba(99,102,241,0.12),rgba(168,85,247,0.08))', border: '1px solid rgba(99,102,241,0.25)', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#a5b4fc' }}>Хочешь свой канал с записью?</div>
          <div style={{ fontSize: 12, color: c.sub }}>SWAIP — это 3 секунды. Свои клиенты, CRM, канал.</div>
          <button onClick={goRegister}
            style={{ padding: '13px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg,#6366f1,#a855f7)', color: '#fff', fontWeight: 900, fontSize: 14, cursor: 'pointer' }}>
            Зарегистрироваться — 3 секунды ⚡
          </button>
        </div>
      </div>
    );
  }

  /* ─────────── MAIN VIEW ─────────── */
  return (
    <div style={{ minHeight: '100svh', background: c.bg, fontFamily: '"Montserrat",sans-serif', paddingBottom: 100 }}>

      {/* ── Шапка ── */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(7,9,15,0.93)', backdropFilter: 'blur(16px)', borderBottom: `1px solid ${c.border}`, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        {channel?.avatarPhotoUrl ? (
          <img src={channel.avatarPhotoUrl} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${accent}50` }} />
        ) : (
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg,${accent},${accent}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
            {channel?.vibe || '📢'}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: c.light, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{channel?.name || 'Канал'}</div>
          {channel?.handle && <div style={{ fontSize: 10, color: c.sub }}>@{channel.handle}</div>}
        </div>
        <button onClick={goRegister}
          style={{ padding: '7px 13px', borderRadius: 10, border: `1px solid ${accent}40`, background: `${accent}12`, color: accent, fontSize: 11, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>
          Войти в SWAIP
        </button>
      </div>

      {/* ── Контент поста ── */}
      {post && (
        <div style={{ padding: '14px 14px 0' }}>
          <div style={{ borderRadius: 20, background: c.card, border: `1px solid ${c.border}`, overflow: 'hidden' }}>
            {post.imageUrl && (
              <img src={post.imageUrl.startsWith('http') ? post.imageUrl : `${window.location.origin}${post.imageUrl}`}
                alt="" style={{ width: '100%', maxHeight: 400, objectFit: 'cover', display: 'block' }} />
            )}
            {post.videoUrl && (
              <video src={post.videoUrl.startsWith('http') ? post.videoUrl : `${window.location.origin}${post.videoUrl}`}
                controls playsInline style={{ width: '100%', maxHeight: 340, display: 'block', background: '#000' }} />
            )}
            {post.text && (
              <div style={{ padding: '14px 16px 4px', fontSize: 15, color: c.light, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {post.text}
              </div>
            )}
            <div style={{ padding: '6px 16px 12px', fontSize: 11, color: c.sub }}>
              {new Date(post.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>
        </div>
      )}

      {/* ── Форма записи (если у поста есть запись) — БЕЗ регистрации ── */}
      {post?.hasBooking && (
        <div style={{ padding: '12px 14px 0' }}>
          <div style={{ borderRadius: 20, background: c.card, border: `1px solid ${accent}30`, padding: '18px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: accent, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              📅 {post.bookingLabel || 'Записаться'}
            </div>

            {freeSlots.length > 0 && (
              <div>
                <div style={{ fontSize: 11, color: c.sub, marginBottom: 8, fontWeight: 700 }}>Выберите время:</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {freeSlots.map(s => (
                    <button key={s.time} onClick={() => setSelectedSlot(s.time === selectedSlot ? '' : s.time)}
                      style={{ padding: '7px 12px', borderRadius: 20,
                        border: `1.5px solid ${selectedSlot === s.time ? accent : c.border}`,
                        background: selectedSlot === s.time ? `${accent}20` : c.card,
                        color: selectedSlot === s.time ? accent : c.mid,
                        fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      {fmtSlot(s.time)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {freeSlots.length === 0 && (
              <div style={{ fontSize: 13, color: c.sub, padding: '4px 0' }}>
                Нет свободных слотов — оставьте заявку и с вами свяжутся
              </div>
            )}

            <input value={clientName} onChange={e => setClientName(e.target.value)}
              placeholder="Ваше имя *" style={inp} />
            <input value={clientPhone} onChange={e => setClientPhone(e.target.value)}
              placeholder="Телефон +7… *" type="tel" style={inp} />

            {bookStatus === 'error' && (
              <p style={{ margin: 0, fontSize: 12, color: '#f87171', textAlign: 'center' }}>Ошибка. Попробуйте ещё раз.</p>
            )}

            <motion.button whileTap={{ scale: 0.97 }} onClick={submitBooking}
              disabled={bookStatus === 'sending' || !clientName.trim() || !clientPhone.trim()}
              style={{ padding: '14px', borderRadius: 16, border: 'none', cursor: 'pointer',
                background: (!clientName.trim() || !clientPhone.trim() || bookStatus === 'sending')
                  ? 'rgba(255,255,255,0.08)' : `linear-gradient(135deg,${accent},${accent}cc)`,
                color: '#fff', fontSize: 15, fontWeight: 900,
                opacity: (!clientName.trim() || !clientPhone.trim()) ? 0.55 : 1 }}>
              {bookStatus === 'sending' ? 'Отправляем…' : `📅 ${post.bookingLabel || 'Записаться'}`}
            </motion.button>
          </div>
        </div>
      )}

      {/* ── Комментарии ── */}
      <div style={{ padding: '16px 14px 0' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: c.sub, marginBottom: 10, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Комментарии {comments.length > 0 ? `· ${comments.length}` : ''}
        </div>

        {/* Существующие комментарии */}
        {comments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {comments.map(cm => (
              <div key={cm.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: `linear-gradient(135deg,${accent}88,${accent}44)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>
                  {cm.author?.[0]?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, background: c.card, borderRadius: 14, padding: '9px 12px', border: `1px solid ${c.border}` }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: c.mid, marginBottom: 3 }}>{cm.author}</div>
                  <div style={{ fontSize: 13, color: c.light, lineHeight: 1.5 }}>{cm.text}</div>
                  <div style={{ fontSize: 10, color: c.sub, marginTop: 4 }}>{timeAgo(cm.ts)}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ padding: '14px 0 10px', fontSize: 13, color: c.sub, textAlign: 'center' }}>
            Комментариев пока нет. Будьте первым! 💬
          </div>
        )}

        {/* Поле ввода комментария — клик открывает регистрационный nudge */}
        <div style={{ position: 'relative' }}>
          <textarea
            ref={commentInputRef}
            value={commentDraft}
            onFocus={onCommentFocus}
            onChange={() => {}}
            placeholder="Написать комментарий…"
            rows={2}
            style={{ ...inp, resize: 'none', borderRadius: 16, padding: '12px 52px 12px 14px',
              lineHeight: 1.5, cursor: 'pointer' }}
          />
          <div style={{ position: 'absolute', right: 12, bottom: 10, pointerEvents: 'none' }}>
            <span style={{ fontSize: 20 }}>💬</span>
          </div>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: c.sub, textAlign: 'center' }}>
          Для комментариев нужна регистрация — это <span style={{ color: accent, fontWeight: 800 }}>3 секунды</span>
        </div>
      </div>

      {/* ── Регистрационный bottom sheet (появляется при попытке комментировать) ── */}
      <AnimatePresence>
        {showRegNudge && (
          <>
            <motion.div key="overlay"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowRegNudge(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 300 }} />
            <motion.div key="sheet"
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 34 }}
              style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301,
                borderRadius: '26px 26px 0 0',
                background: 'linear-gradient(180deg,#101420,#080b12)',
                border: '1px solid rgba(99,102,241,0.22)',
                padding: '28px 22px 44px',
                display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', textAlign: 'center' }}>
              {/* Handle */}
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)' }} />
              <div style={{ fontSize: 52, marginTop: 8 }}>💬</div>
              <div style={{ fontSize: 21, fontWeight: 900, color: '#fff', lineHeight: 1.2 }}>
                Хочешь оставить комментарий?
              </div>
              <div style={{ fontSize: 14, color: c.sub, lineHeight: 1.65, maxWidth: 300 }}>
                Регистрация займёт <strong style={{ color: accent }}>3 секунды</strong>.<br />
                Никаких паролей — только мастер-ключ.<br />
                После регистрации вернёшься прямо сюда.
              </div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={goRegister}
                style={{ width: '100%', maxWidth: 340, padding: '15px', borderRadius: 16, border: 'none',
                  background: 'linear-gradient(135deg,#6366f1,#a855f7)',
                  color: '#fff', fontWeight: 900, fontSize: 16, cursor: 'pointer',
                  boxShadow: '0 8px 32px rgba(99,102,241,0.4)' }}>
                Зарегистрироваться — 3 секунды ⚡
              </motion.button>
              <button onClick={() => setShowRegNudge(false)}
                style={{ background: 'none', border: 'none', color: c.sub, fontSize: 13, cursor: 'pointer', padding: '4px 12px' }}>
                Не сейчас
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
