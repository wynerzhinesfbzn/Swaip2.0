import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const API = window.location.origin;
const getST = () => { try { return localStorage.getItem('swaip_session') || ''; } catch { return ''; } };

interface Clip {
  id: string;
  authorHash: string;
  authorName: string;
  authorAvatar: string;
  videoUrl: string;
  content: string;
  likes: number;
  liked: boolean;
  comments: number;
  createdAt: string;
}

function fmtCount(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'М';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'К';
  return String(n);
}

function ClipPlayer({ clip, isActive, myHash, onLike, onComment }: {
  clip: Clip; isActive: boolean; myHash: string;
  onLike: (id: string) => void;
  onComment: (clip: Clip) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [showHeart, setShowHeart] = useState(false);
  const [paused, setPaused] = useState(false);
  const lastTap = useRef(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isActive) {
      v.currentTime = 0;
      v.play().catch(() => {});
      setPaused(false);
    } else {
      v.pause();
    }
  }, [isActive]);

  const handleTap = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      onLike(clip.id);
      setShowHeart(true);
      setTimeout(() => setShowHeart(false), 800);
    } else {
      const v = videoRef.current;
      if (!v) return;
      if (v.paused) { v.play().catch(() => {}); setPaused(false); }
      else { v.pause(); setPaused(true); }
    }
    lastTap.current = now;
    e.preventDefault();
  };

  const videoSrc = clip.videoUrl.startsWith('http') ? clip.videoUrl : `${API}${clip.videoUrl}`;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ url: `${API}/clip/${clip.id}`, title: `Клип от @${clip.authorName}` });
      } else {
        await navigator.clipboard.writeText(`${API}/clip/${clip.id}`);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        try { await navigator.clipboard.writeText(`${API}/clip/${clip.id}`); } catch {}
      }
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#000' }}>
      <video
        ref={videoRef}
        src={videoSrc}
        loop
        playsInline
        muted={false}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onClick={handleTap}
      />

      <AnimatePresence>
        {paused && (
          <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(0,0,0,0.55)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>⏸</div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHeart && (
          <motion.div initial={{ opacity: 0, scale: 0.5, y: 0 }} animate={{ opacity: 1, scale: 1.4, y: -40 }}
            exit={{ opacity: 0, scale: 0 }} transition={{ duration: 0.5 }}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', pointerEvents: 'none', fontSize: 80 }}>
            ❤️
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
        pointerEvents: 'none' }} />

      {/* Right sidebar */}
      <div style={{ position: 'absolute', right: 12, bottom: 100, display: 'flex', flexDirection: 'column',
        alignItems: 'center', gap: 20 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', overflow: 'hidden',
          border: '2px solid #fff', background: '#7c3aed' }}>
          {clip.authorAvatar
            ? <img src={clip.authorAvatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 18 }}>
                {clip.authorName[0]?.toUpperCase()}
              </div>}
        </div>

        <motion.button whileTap={{ scale: 1.3 }} onClick={() => onLike(clip.id)}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}>
          <span style={{ fontSize: 32, filter: clip.liked ? 'none' : 'grayscale(1)' }}>❤️</span>
          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: '"Montserrat",sans-serif' }}>
            {fmtCount(clip.likes)}
          </span>
        </motion.button>

        <motion.button whileTap={{ scale: 1.2 }} onClick={() => onComment(clip)}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}>
          <span style={{ fontSize: 28 }}>💬</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', fontFamily: '"Montserrat",sans-serif' }}>
            {fmtCount(clip.comments)}
          </span>
        </motion.button>

        <motion.button whileTap={{ scale: 1.2 }} onClick={handleShare}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            background: 'none', border: 'none', cursor: 'pointer', color: '#fff' }}>
          <span style={{ fontSize: 28 }}>↗️</span>
          <span style={{ fontSize: 12, fontWeight: 700, fontFamily: '"Montserrat",sans-serif' }}>Поделиться</span>
        </motion.button>
      </div>

      {/* Bottom info */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 70, padding: '0 16px 60px' }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#fff', fontFamily: '"Montserrat",sans-serif',
          marginBottom: 6, textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
          @{clip.authorName}
        </div>
        {clip.content && (
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.9)', fontFamily: '"Montserrat",sans-serif',
            lineHeight: 1.4, textShadow: '0 1px 4px rgba(0,0,0,0.8)', maxHeight: 60, overflow: 'hidden' }}>
            {clip.content}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClipsScreen({ myHash, onBack }: { myHash: string; onBack: () => void }) {
  const [clips, setClips] = useState<Clip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const startY = useRef(0);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [commentClip, setCommentClip] = useState<Clip | null>(null);
  const [commentText, setCommentText] = useState('');
  const [sendingComment, setSendingComment] = useState(false);

  const fetchClips = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/broadcasts?limit=100`, {
        headers: { 'x-session-token': getST() }
      });
      const data = await r.json();
      const arr = Array.isArray(data) ? data : [];
      const videoClips: Clip[] = arr
        .filter((b: any) => b.videoUrl)
        .map((b: any) => ({
          id: String(b.id),
          authorHash: b.authorHash || '',
          authorName: b.authorName || b.authorHandle || 'Пользователь',
          authorAvatar: b.authorAvatar || '',
          videoUrl: b.videoUrl,
          content: b.content || '',
          likes: (b.reactions || []).reduce((s: number, r: any) => s + r.count, 0),
          liked: (b.myReactions || []).length > 0,
          comments: b.commentCount || 0,
          createdAt: b.createdAt || '',
        }));
      setClips(videoClips);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchClips(); }, [fetchClips]);

  const toggleLike = async (id: string) => {
    setClips(prev => prev.map(c => c.id === id
      ? { ...c, liked: !c.liked, likes: c.liked ? c.likes - 1 : c.likes + 1 }
      : c));
    try {
      await fetch(`${API}/api/interactions/${id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session: myHash })
      });
    } catch { /* ignore */ }
  };

  const sendComment = async () => {
    if (!commentClip || !commentText.trim()) return;
    setSendingComment(true);
    try {
      await fetch(`${API}/api/interactions/${commentClip.id}/comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: myHash,
          authorHash: myHash,
          authorName: 'Я',
          text: commentText.trim()
        })
      });
      setClips(prev => prev.map(c => c.id === commentClip.id
        ? { ...c, comments: c.comments + 1 } : c));
      setCommentText('');
      setCommentClip(null);
    } catch { /* ignore */ }
    setSendingComment(false);
  };

  const handleTouchStart = (e: React.TouchEvent) => { startY.current = e.touches[0].clientY; };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const dy = startY.current - e.changedTouches[0].clientY;
    if (Math.abs(dy) > 60) {
      if (dy > 0) setActiveIdx(i => Math.min(i + 1, clips.length - 1));
      else setActiveIdx(i => Math.max(i - 1, 0));
    }
  };

  const handleUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    setUploadProgress('Загружаю видео...');
    try {
      /* Send as raw binary to /api/video-upload */
      const uploadRes = await fetch(`${API}/api/video-upload`, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'video/mp4',
          'x-session-token': getST(),
          'x-filename': file.name,
        },
        body: file,
      });
      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
      const upData = await uploadRes.json();
      const videoUrl = upData.url || upData.videoUrl;
      if (!videoUrl) throw new Error('no url');
      setUploadProgress('Публикую клип...');
      const postRes = await fetch(`${API}/api/broadcasts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': getST() },
        body: JSON.stringify({ content: uploadCaption.trim() || ' ', videoUrl, authorMode: 'pro' }),
      });
      if (!postRes.ok) throw new Error('Post failed');
      setShowUpload(false);
      setUploadCaption('');
      setUploadProgress('');
      await fetchClips();
    } catch (e: any) {
      setUploadProgress(`Ошибка: ${e?.message || 'попробуй ещё раз'}`);
      setTimeout(() => setUploadProgress(''), 3000);
    }
    setUploading(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 500,
      fontFamily: '"Montserrat",sans-serif', overflow: 'hidden' }}>

      {/* Header buttons */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '48px 16px 16px',
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)',
        pointerEvents: 'none' }}>
        <motion.button whileTap={{ scale: 0.88 }} onClick={onBack}
          style={{ pointerEvents: 'all', width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, color: '#fff', cursor: 'pointer' }}>←</motion.button>
        <div style={{ fontWeight: 900, fontSize: 17, color: '#fff' }}>🎬 Клипы</div>
        <motion.button whileTap={{ scale: 0.88 }} onClick={() => setShowUpload(true)}
          style={{ pointerEvents: 'all', width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, color: '#fff', cursor: 'pointer' }}>+</motion.button>
      </div>

      {/* Main video area */}
      {loading ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', gap: 12, color: 'rgba(255,255,255,0.5)' }}>
          <div style={{ fontSize: 48 }}>🎬</div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>Загружаю клипы...</div>
        </div>
      ) : clips.length === 0 ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', gap: 12, padding: 32 }}>
          <div style={{ fontSize: 56 }}>🎬</div>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#fff', textAlign: 'center' }}>
            Клипов пока нет
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center' }}>
            Стань первым — загрузи вертикальное видео!
          </div>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowUpload(true)}
            style={{ marginTop: 12, padding: '12px 28px', borderRadius: 100, border: 'none',
              background: 'linear-gradient(135deg,#7c3aed,#db2777)', color: '#fff',
              fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif' }}>
            + Загрузить клип
          </motion.button>
        </div>
      ) : (
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          style={{ position: 'absolute', inset: 0 }}>
          {clips.map((clip, idx) => (
            <motion.div key={clip.id}
              animate={{ y: `${(idx - activeIdx) * 100}%` }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{ position: 'absolute', inset: 0 }}>
              <ClipPlayer clip={clip} isActive={idx === activeIdx} myHash={myHash}
                onLike={toggleLike} onComment={setCommentClip} />
            </motion.div>
          ))}

          {/* Scroll dots */}
          <div style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            display: 'flex', flexDirection: 'column', gap: 4, zIndex: 10 }}>
            {clips.slice(Math.max(0, activeIdx - 3), activeIdx + 4).map((_, i) => {
              const real = Math.max(0, activeIdx - 3) + i;
              return (
                <div key={real} style={{ width: real === activeIdx ? 6 : 3, height: real === activeIdx ? 6 : 3,
                  borderRadius: '50%', background: real === activeIdx ? '#fff' : 'rgba(255,255,255,0.4)',
                  transition: 'all 0.2s' }} />
              );
            })}
          </div>
        </div>
      )}

      {/* Upload modal */}
      <AnimatePresence>
        {showUpload && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => !uploading && setShowUpload(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.8)' }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301,
                background: '#0f0f1a', borderRadius: '24px 24px 0 0',
                padding: '20px 20px calc(32px + env(safe-area-inset-bottom,0px))' }}>
              <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 99, margin: '0 auto 20px' }} />
              <div style={{ fontWeight: 900, fontSize: 17, color: '#fff', marginBottom: 16 }}>📹 Новый клип</div>
              <input value={uploadCaption} onChange={e => setUploadCaption(e.target.value)}
                placeholder="Подпись к клипу..."
                style={{ width: '100%', padding: '12px 14px', borderRadius: 12,
                  border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
                  color: '#fff', fontSize: 14, fontFamily: '"Montserrat",sans-serif', outline: 'none',
                  marginBottom: 14, boxSizing: 'border-box' }} />
              {uploadProgress && (
                <div style={{ textAlign: 'center', fontSize: 13, color: '#a78bfa', marginBottom: 12, fontWeight: 700 }}>
                  {uploadProgress}
                </div>
              )}
              <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
              <motion.button whileTap={{ scale: 0.96 }} disabled={uploading}
                onClick={() => fileRef.current?.click()}
                style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none',
                  background: uploading ? 'rgba(124,58,237,0.4)' : 'linear-gradient(135deg,#7c3aed,#db2777)',
                  color: '#fff', fontWeight: 800, fontSize: 15, cursor: uploading ? 'not-allowed' : 'pointer',
                  fontFamily: '"Montserrat",sans-serif' }}>
                {uploading ? '⏳ Загружаю...' : '📁 Выбрать видео'}
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Comment modal */}
      <AnimatePresence>
        {commentClip && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setCommentClip(null)}
              style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.6)' }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 401,
                background: '#0f0f1a', borderRadius: '24px 24px 0 0',
                padding: '20px 20px calc(24px + env(safe-area-inset-bottom,0px))' }}>
              <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 99, margin: '0 auto 16px' }} />
              <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', marginBottom: 14 }}>💬 Комментарий</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <input value={commentText} onChange={e => setCommentText(e.target.value)}
                  placeholder="Напиши что-нибудь..." autoFocus
                  onKeyDown={e => e.key === 'Enter' && sendComment()}
                  style={{ flex: 1, padding: '12px 14px', borderRadius: 12,
                    border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
                    color: '#fff', fontSize: 14, fontFamily: '"Montserrat",sans-serif', outline: 'none' }} />
                <motion.button whileTap={{ scale: 0.9 }} onClick={sendComment} disabled={sendingComment || !commentText.trim()}
                  style={{ padding: '12px 20px', borderRadius: 12, border: 'none',
                    background: commentText.trim() ? 'linear-gradient(135deg,#7c3aed,#db2777)' : 'rgba(255,255,255,0.1)',
                    color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif' }}>
                  {sendingComment ? '...' : '➤'}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
