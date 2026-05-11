import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackHandler } from './backHandler';

const API = window.location.origin;
const WS_BASE = API.replace(/^http/, 'ws');
let _tok = '';
const getTok = () => _tok || (typeof localStorage !== 'undefined' ? localStorage.getItem('swaip_session') || localStorage.getItem('swaip_session_token') || '' : '');
const mkProxy = (url: string) => `${API}/api/browser-proxy?url=${encodeURIComponent(url)}`;

/* ─── Video URL helpers ─── */
function parseVideoUrl(raw: string): { type: 'youtube' | 'rutube' | 'vk' | 'vimeo' | 'twitch' | 'direct' | 'proxy'; embedUrl: string; originalUrl: string } {
  const url = raw.trim();

  // YouTube — watch, shorts, music, youtu.be, embed
  const ytMatch = url.match(/(?:(?:www\.|music\.)?youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (ytMatch) {
    const embedUrl = `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?autoplay=1&rel=0&playsinline=1`;
    return { type: 'youtube', embedUrl, originalUrl: url };
  }

  // Rutube — direct embed (ID: 8-40 hex chars)
  const rtMatch = url.match(/rutube\.ru\/(?:video\/(?:private\/)?|play\/embed\/)([a-f0-9]{8,40})/i);
  if (rtMatch) {
    return { type: 'rutube', embedUrl: `https://rutube.ru/play/embed/${rtMatch[1]}/`, originalUrl: url };
  }

  // VK Video (vk.com/video or vkvideo.ru/video)
  const vkMatch = url.match(/(?:vk\.com|vkvideo\.ru)\/video(-?\d+_\d+)/);
  if (vkMatch) {
    const parts = vkMatch[1].split('_');
    return { type: 'vk', embedUrl: `https://vk.com/video_ext.php?oid=${parts[0]}&id=${parts[1]}&hd=2`, originalUrl: url };
  }
  // VK clip (vk.com/clip or vkvideo.ru/clip)
  const vkClipMatch = url.match(/(?:vk\.com|vkvideo\.ru)\/clip(-?\d+_\d+)/);
  if (vkClipMatch) {
    const parts = vkClipMatch[1].split('_');
    return { type: 'vk', embedUrl: `https://vk.com/video_ext.php?oid=${parts[0]}&id=${parts[1]}&hd=2`, originalUrl: url };
  }

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vimeoMatch) {
    return { type: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}?autoplay=1&dnt=1`, originalUrl: url };
  }

  // Twitch clip
  const twitchClip = url.match(/twitch\.tv\/(?:\w+\/clip\/|clip\/)([A-Za-z0-9_-]+)/);
  if (twitchClip) {
    const parent = window.location.hostname;
    return { type: 'twitch', embedUrl: `https://clips.twitch.tv/embed?clip=${twitchClip[1]}&parent=${parent}`, originalUrl: url };
  }
  // Twitch channel
  const twitchCh = url.match(/twitch\.tv\/([A-Za-z0-9_]+)(?:\/)?$/);
  if (twitchCh) {
    const parent = window.location.hostname;
    return { type: 'twitch', embedUrl: `https://player.twitch.tv/?channel=${twitchCh[1]}&parent=${parent}&autoplay=true`, originalUrl: url };
  }

  // Direct video file — use <video> tag
  if (/\.(mp4|webm|ogg|m3u8)(\?|$)/i.test(url)) {
    return { type: 'direct', embedUrl: url, originalUrl: url };
  }

  // Anything else — browser proxy
  const fullUrl = url.startsWith('http') ? url : `https://${url}`;
  return { type: 'proxy', embedUrl: mkProxy(fullUrl), originalUrl: fullUrl };
}

function fmtTime(sec: number) {
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${m}:${String(ss).padStart(2, '0')}`;
}

interface RoomInfo {
  id: string; name: string; hostHash: string;
  videoUrl: string; videoTitle: string;
  isPlaying: boolean; memberCount: number; createdAt: number;
}
interface Member { hash: string; name: string; avatar: string; }
interface ChatMsg { id: string; userHash: string; userName: string; userAvatar: string; text: string; createdAt: number; }
interface RoomState {
  id: string; name: string; hostHash: string;
  videoUrl: string; videoTitle: string;
  isPlaying: boolean; currentTime: number;
}

function Av({ name, avatar, size = 32 }: { name: string; avatar?: string; size?: number }) {
  const colors = ['#7c3aed', '#db2777', '#059669', '#d97706', '#2563eb', '#dc2626'];
  const color = colors[(name.charCodeAt(0) || 0) % colors.length];
  if (avatar) return <img src={avatar} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: color, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 800, color: '#fff', fontFamily: '"Montserrat",sans-serif' }}>
      {name[0]?.toUpperCase() || '?'}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   CINEMA LOBBY
══════════════════════════════════════════════════════ */
export default function CinemaScreen({ myHash, onBack, sessionToken }: { myHash: string; onBack: () => void; sessionToken?: string }) {
  if (sessionToken) _tok = sessionToken;
  const [view, setView] = useState<'lobby' | 'room'>('lobby');
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createUrl, setCreateUrl] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchRooms = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/cinema/rooms`);
      const d = await r.json();
      setRooms(d.rooms || []);
    } catch { /* ignore */ }
    setLoadingRooms(false);
  }, []);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);
  useEffect(() => {
    if (view !== 'lobby') return;
    const t = setInterval(fetchRooms, 10_000);
    return () => clearInterval(t);
  }, [view, fetchRooms]);

  const createRoom = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const raw = createUrl.trim();
      const parsed = raw ? parseVideoUrl(raw) : null;
      const r = await fetch(`${API}/api/cinema/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': getTok() },
        body: JSON.stringify({
          name: createName.trim() || 'Кино-комната',
          videoUrl: raw,           /* always store ORIGINAL url, not embed/proxy */
          videoTitle: parsed?.originalUrl ? raw.slice(0, 80) : '',
        }),
      });
      const d = await r.json();
      if (d.success) {
        setCurrentRoomId(d.room.id);
        setView('room');
        setShowCreate(false);
        setCreateName(''); setCreateUrl('');
      }
    } catch { /* ignore */ }
    setCreating(false);
  };

  const joinRoom = (id: string) => { setCurrentRoomId(id); setView('room'); };
  const leaveRoom = () => { setCurrentRoomId(null); setView('lobby'); fetchRooms(); };

  useBackHandler(view === 'room' ? leaveRoom : showCreate ? () => setShowCreate(false) : onBack);

  if (view === 'room' && currentRoomId) {
    return <CinemaRoom roomId={currentRoomId} myHash={myHash} onLeave={leaveRoom} />;
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#05050c', display: 'flex', flexDirection: 'column',
      fontFamily: '"Montserrat",sans-serif', zIndex: 500 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '48px 16px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,8,18,0.98)',
        backdropFilter: 'blur(20px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
          style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(255,255,255,0.06)', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff' }}>←</motion.button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#fff' }}>🎬 Кинотеатр</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>Вставь любую ссылку — смотри с друзьями</div>
        </div>
        <motion.button whileTap={{ scale: 0.92 }} onClick={() => setShowCreate(true)}
          style={{ padding: '10px 18px', borderRadius: 100, border: 'none', flexShrink: 0,
            background: 'linear-gradient(135deg,#7c3aed,#db2777)', color: '#fff',
            fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif' }}>
          + Создать
        </motion.button>
      </div>

      <div style={{ margin: '12px 16px 0', padding: '12px 16px', borderRadius: 14,
        background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)',
        display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>💡</span>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6 }}>
          Поддерживаются: <b style={{ color: '#c4b5fd' }}>YouTube</b> (включая Shorts), <b style={{ color: '#c4b5fd' }}>Rutube</b>, <b style={{ color: '#c4b5fd' }}>ВКонтакте</b>, <b style={{ color: '#c4b5fd' }}>Vimeo</b>, <b style={{ color: '#c4b5fd' }}>Twitch</b>, прямой MP4.
          Хост управляет воспроизведением, все смотрят синхронно.
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 80px' }}>
        {loadingRooms ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
            Загружаю комнаты...
          </div>
        ) : rooms.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎭</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', marginBottom: 6 }}>Нет активных комнат</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Создай первую и позови друзей!</div>
          </div>
        ) : (
          rooms.map(room => (
            <motion.div key={room.id} whileTap={{ scale: 0.97 }}
              onClick={() => joinRoom(room.id)}
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 16, padding: '14px 16px', marginBottom: 10, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#1a0a3a,#7c3aed)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>
                🎬
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 14, color: '#fff', marginBottom: 2 }}>{room.name}</div>
                {room.videoTitle && (
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {room.videoTitle}
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                  {room.memberCount} зрител{room.memberCount === 1 ? 'ь' : room.memberCount < 5 ? 'я' : 'ей'} · {room.isPlaying ? '▶ Идёт' : '⏸ Пауза'}
                </div>
              </div>
              <div style={{ fontSize: 20, color: 'rgba(255,255,255,0.3)' }}>→</div>
            </motion.div>
          ))
        )}
      </div>

      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCreate(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 360, damping: 34 }}
              style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301,
                background: '#0f0f1a', borderRadius: '24px 24px 0 0',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '20px 20px calc(32px + env(safe-area-inset-bottom,0px))' }}>
              <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 99, margin: '0 auto 20px' }} />
              <div style={{ fontWeight: 900, fontSize: 17, color: '#fff', marginBottom: 4 }}>Новая кино-комната</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 20 }}>Вставь любую ссылку и пригласи друзей</div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 700 }}>НАЗВАНИЕ КОМНАТЫ</div>
                <input value={createName} onChange={e => setCreateName(e.target.value)}
                  placeholder="Например: Вечер фильмов"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 14,
                    fontFamily: '"Montserrat",sans-serif', outline: 'none', boxSizing: 'border-box' }} />
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6, fontWeight: 700 }}>ССЫЛКА НА ВИДЕО (НЕОБЯЗАТЕЛЬНО)</div>
                <input value={createUrl} onChange={e => setCreateUrl(e.target.value)}
                  placeholder="youtube.com/watch?v=... · rutube.ru · прямой MP4"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 14,
                    fontFamily: '"Montserrat",sans-serif', outline: 'none', boxSizing: 'border-box' }} />
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 5 }}>
                  YouTube (Shorts ✓) · Rutube · ВКонтакте · Vimeo · Twitch · прямой MP4
                </div>
              </div>

              <motion.button whileTap={{ scale: 0.96 }} onClick={createRoom} disabled={creating}
                style={{ width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                  background: creating ? 'rgba(124,58,237,0.4)' : 'linear-gradient(135deg,#7c3aed,#db2777)',
                  color: '#fff', fontWeight: 800, fontSize: 15, cursor: creating ? 'not-allowed' : 'pointer',
                  fontFamily: '"Montserrat",sans-serif' }}>
                {creating ? 'Создаю...' : '🎬 Создать комнату'}
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   CINEMA ROOM
══════════════════════════════════════════════════════ */
function CinemaRoom({ roomId, myHash, onLeave }: { roomId: string; myHash: string; onLeave: () => void }) {
  const wsRef = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatText, setChatText] = useState('');
  const [connected, setConnected] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showVideoInput, setShowVideoInput] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [landscape, setLandscape] = useState(false);

  const showToast = (text: string) => {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  const isHost = room?.hostHash === myHash;
  const parsed = room?.videoUrl ? parseVideoUrl(room.videoUrl) : null;

  useEffect(() => {
    const tok = getTok();
    const ws = new WebSocket(`${WS_BASE}/api/ws/cinema?token=${encodeURIComponent(tok)}&hash=${encodeURIComponent(myHash)}&room=${roomId}`);
    wsRef.current = ws;

    ws.onopen = () => { setConnected(true); ws.send(JSON.stringify({ type: 'ping' })); };
    ws.onclose = () => setConnected(false);

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'init') {
          setRoom(msg.room);
          setMembers(msg.members || []);
          setMessages(msg.messages || []);
          setCurrentTime(msg.room.currentTime || 0);
        }
        if (msg.type === 'member_joined') { setMembers(msg.members); showToast(`${msg.name} зашёл`); }
        if (msg.type === 'member_left') { setMembers(msg.members); showToast(`${msg.name} вышел`); }
        if (msg.type === 'chat') { setMessages(prev => [...prev.slice(-199), msg.message]); }
        if (msg.type === 'video_changed') {
          setRoom(prev => prev ? { ...prev, videoUrl: msg.url, videoTitle: msg.title, isPlaying: false, currentTime: 0 } : prev);
          showToast(`${msg.by} поставил видео`);
        }
        if (msg.type === 'play') {
          setRoom(prev => prev ? { ...prev, isPlaying: true, currentTime: msg.currentTime } : prev);
          setCurrentTime(msg.currentTime);
          if (videoRef.current) { videoRef.current.currentTime = msg.currentTime; videoRef.current.play().catch(() => {}); }
          if (msg.by) showToast(`${msg.by} ▶`);
        }
        if (msg.type === 'pause') {
          setRoom(prev => prev ? { ...prev, isPlaying: false, currentTime: msg.currentTime } : prev);
          setCurrentTime(msg.currentTime);
          if (videoRef.current) { videoRef.current.pause(); videoRef.current.currentTime = msg.currentTime; }
          if (msg.by) showToast(`${msg.by} ⏸`);
        }
        if (msg.type === 'seek') {
          setRoom(prev => prev ? { ...prev, currentTime: msg.currentTime } : prev);
          setCurrentTime(msg.currentTime);
          if (videoRef.current) videoRef.current.currentTime = msg.currentTime;
          showToast(`→ ${fmtTime(msg.currentTime)}`);
        }
        if (msg.type === 'sync_state') {
          setCurrentTime(msg.currentTime);
          if (videoRef.current) {
            videoRef.current.currentTime = msg.currentTime;
            if (msg.isPlaying) videoRef.current.play().catch(() => {});
            else videoRef.current.pause();
          }
        }
      } catch { /* ignore */ }
    };

    const ping = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' })); }, 20_000);
    return () => { clearInterval(ping); ws.close(); };
  }, [roomId]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    const check = () => setLandscape(window.innerWidth > window.innerHeight);
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => { window.removeEventListener('resize', check); window.removeEventListener('orientationchange', check); };
  }, []);

  const send = (payload: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(payload));
  };

  const hostPlay = () => {
    const t = videoRef.current?.currentTime ?? currentTime;
    send({ type: 'play', currentTime: t });
    if (videoRef.current) videoRef.current.play().catch(() => {});
    setRoom(prev => prev ? { ...prev, isPlaying: true, currentTime: t } : prev);
  };
  const hostPause = () => {
    const t = videoRef.current?.currentTime ?? currentTime;
    send({ type: 'pause', currentTime: t });
    if (videoRef.current) videoRef.current.pause();
    setRoom(prev => prev ? { ...prev, isPlaying: false, currentTime: t } : prev);
  };
  const hostSeek = (t: number) => {
    send({ type: 'seek', currentTime: t });
    if (videoRef.current) videoRef.current.currentTime = t;
    setCurrentTime(t);
  };

  const sendChat = () => {
    const text = chatText.trim();
    if (!text) return;
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      showToast('⚠️ Нет соединения — подожди секунду');
      return;
    }
    send({ type: 'chat', text });
    setChatText('');
  };

  const setVideo = () => {
    const url = newVideoUrl.trim();
    if (!url) return;
    /* Always send the ORIGINAL url to the server — embed is computed client-side */
    send({ type: 'set_video', url, title: url.slice(0, 80) });
    setNewVideoUrl(''); setShowVideoInput(false);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        await (screen.orientation as any).lock?.('landscape').catch(() => {});
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        await (screen.orientation as any).unlock?.().catch(() => {});
        setIsFullscreen(false);
      }
    } catch { setIsFullscreen(f => !f); }
  };

  const videoHeight = landscape || isFullscreen ? '100dvh' : '240px';

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', display: 'flex',
      flexDirection: landscape ? 'row' : 'column', fontFamily: '"Montserrat",sans-serif', zIndex: 500 }}>

      {/* Video area */}
      <div style={{ position: 'relative', width: landscape ? '60%' : '100%',
        height: landscape ? '100%' : videoHeight, background: '#000', flexShrink: 0 }}>

        {parsed ? (
          parsed.type === 'direct' ? (
            <video ref={videoRef} src={parsed.embedUrl} controls={isHost}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)} />
          ) : parsed.type === 'proxy' ? (
            /* Proxy URL — may fail in hosted environments; show friendly fallback if needed */
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ background: 'rgba(239,180,0,0.15)', borderBottom: '1px solid rgba(239,180,0,0.3)',
                padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 14 }}>⚠️</span>
                <span style={{ fontSize: 11, color: 'rgba(255,220,50,0.85)', fontWeight: 600, flex: 1, lineHeight: 1.4 }}>
                  Этот URL загружается через прокси — работает не для всех сайтов.
                  Лучше используй YouTube, Rutube или ВКонтакте.
                </span>
                {isHost && (
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowVideoInput(v => !v)}
                    style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid rgba(124,58,237,0.5)',
                      background: 'rgba(124,58,237,0.2)', color: '#c4b5fd', fontSize: 11, cursor: 'pointer',
                      fontWeight: 700, fontFamily: '"Montserrat",sans-serif', flexShrink: 0 }}>
                    Сменить
                  </motion.button>
                )}
              </div>
              <iframe
                key={parsed.embedUrl}
                src={parsed.embedUrl}
                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                allowFullScreen
                style={{ flex: 1, border: 'none', width: '100%' }}
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-presentation allow-modals"
                title="Cinema Player"
              />
            </div>
          ) : (
            /* Iframe for YouTube / Rutube / VK / Vimeo / Twitch — direct embed, no sandbox */
            <iframe
              key={parsed.embedUrl}
              src={parsed.embedUrl}
              allow="autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write; accelerometer; gyroscope"
              allowFullScreen
              style={{ width: '100%', height: '100%', border: 'none' }}
              title="Cinema Player"
            />
          )
        ) : (
          /* No video yet */
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
            <div style={{ fontSize: 52 }}>🎬</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Видео не выбрано</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, maxWidth: 240 }}>
              {isHost ? 'Нажми кнопку ниже и вставь любую ссылку' : 'Хост ещё не выбрал видео'}
            </div>
            {isHost && (
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowVideoInput(v => !v)}
                style={{ padding: '10px 22px', borderRadius: 100, border: 'none',
                  background: 'linear-gradient(135deg,#7c3aed,#db2777)', color: '#fff',
                  fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif' }}>
                🔗 Вставить ссылку
              </motion.button>
            )}
          </div>
        )}

        {/* Top bar overlay */}
        {!landscape && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0,
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)' }}>
            <motion.button whileTap={{ scale: 0.9 }} onClick={onLeave}
              style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(0,0,0,0.5)', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: 16, color: '#fff' }}>←</motion.button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {room?.name || '...'}
              </div>
              <div style={{ fontSize: 10, color: connected ? '#4ade80' : '#f87171' }}>
                ● {connected ? `${members.length} зрителей` : 'Подключение...'}
              </div>
            </div>
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowMembers(v => !v)}
              style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 14, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              👥
            </motion.button>
            {isHost && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowVideoInput(v => !v)}
                style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(124,58,237,0.7)',
                  border: '1px solid rgba(167,139,250,0.4)', cursor: 'pointer', fontSize: 14, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                🔗
              </motion.button>
            )}
            <motion.button whileTap={{ scale: 0.9 }} onClick={toggleFullscreen}
              style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(0,0,0,0.5)',
                border: '1px solid rgba(255,255,255,0.2)', cursor: 'pointer', fontSize: 14, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ⛶
            </motion.button>
          </div>
        )}

        {/* Host controls — only for direct video */}
        {isHost && parsed?.type === 'direct' && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '8px 12px',
            background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
            display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.button whileTap={{ scale: 0.88 }} onClick={room?.isPlaying ? hostPause : hostPlay}
              style={{ width: 40, height: 40, borderRadius: '50%', border: 'none',
                background: 'rgba(124,58,237,0.9)', cursor: 'pointer', fontSize: 16, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {room?.isPlaying ? '⏸' : '▶'}
            </motion.button>
            <span style={{ fontSize: 11, color: '#fff', minWidth: 40 }}>{fmtTime(currentTime)}</span>
            <input type="range" min={0} max={videoRef.current?.duration || 100} value={currentTime}
              onChange={e => hostSeek(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#a78bfa', cursor: 'pointer' }} />
          </div>
        )}

        {/* Video URL input for host */}
        <AnimatePresence>
          {showVideoInput && isHost && (
            <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }}
              style={{ position: 'absolute', top: 56, left: 8, right: 8, zIndex: 20,
                background: 'rgba(15,15,26,0.97)', borderRadius: 14, padding: 12,
                border: '1px solid rgba(124,58,237,0.4)', backdropFilter: 'blur(10px)' }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                Вставь любую ссылку (YouTube, Rutube, VK, сайт, MP4...)
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newVideoUrl} onChange={e => setNewVideoUrl(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && setVideo()}
                  placeholder="https://youtube.com/watch?v=..."
                  autoFocus
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 13,
                    fontFamily: '"Montserrat",sans-serif', outline: 'none' }} />
                <motion.button whileTap={{ scale: 0.95 }} onClick={setVideo}
                  style={{ padding: '10px 16px', borderRadius: 10, border: 'none',
                    background: 'linear-gradient(135deg,#7c3aed,#db2777)', color: '#fff',
                    fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif' }}>
                  ▶
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toast */}
        <AnimatePresence>
          {toast && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', top: 60, left: '50%', transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.75)', borderRadius: 10, padding: '6px 14px',
                fontSize: 12, color: '#fff', whiteSpace: 'nowrap', zIndex: 30, maxWidth: '80%',
                overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Members panel */}
        <AnimatePresence>
          {showMembers && (
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
              style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 160,
                background: 'rgba(10,10,20,0.95)', borderLeft: '1px solid rgba(255,255,255,0.08)',
                overflowY: 'auto', padding: '50px 10px 10px', zIndex: 25 }}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 10, fontWeight: 700 }}>
                ЗРИТЕЛИ ({members.length})
              </div>
              {members.map(m => (
                <div key={m.hash} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Av name={m.name} avatar={m.avatar} size={28} />
                  <div style={{ fontSize: 12, color: '#fff', fontWeight: m.hash === myHash ? 800 : 600 }}>
                    {m.hash === myHash ? 'Ты' : m.name}
                    {m.hash === room?.hostHash && <span style={{ color: '#a78bfa' }}> 🎬</span>}
                  </div>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#05050c',
        minHeight: 0, ...(landscape ? { width: '40%', height: '100%' } : {}) }}>

        {landscape && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '48px 12px 10px',
            borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,8,18,0.98)' }}>
            <motion.button whileTap={{ scale: 0.9 }} onClick={onLeave}
              style={{ width: 34, height: 34, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 14, color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</motion.button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {room?.name || '...'}
              </div>
              <div style={{ fontSize: 10, color: connected ? '#4ade80' : '#f87171' }}>
                ● {connected ? `${members.length} зрителей` : 'Подключение...'}
              </div>
            </div>
            {isHost && (
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowVideoInput(v => !v)}
                style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(124,58,237,0.6)',
                  border: 'none', cursor: 'pointer', fontSize: 14, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                🔗
              </motion.button>
            )}
          </div>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.length === 0
            ? <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12, paddingTop: 20 }}>
                Будь первым — напиши что-нибудь!
              </div>
            : messages.map(m => (
              <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Av name={m.userName} avatar={m.userAvatar} size={26} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 800, color: m.userHash === myHash ? '#a78bfa' : '#fff', marginRight: 6 }}>
                    {m.userHash === myHash ? 'Ты' : m.userName}
                  </span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{m.text}</span>
                </div>
              </div>
            ))}
          <div ref={chatEndRef} />
        </div>

        <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.07)',
          paddingBottom: 'calc(8px + env(safe-area-inset-bottom,0px))', display: 'flex', gap: 8 }}>
          <input value={chatText} onChange={e => setChatText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendChat()}
            placeholder="Написать в чат..."
            style={{ flex: 1, padding: '10px 14px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13,
              fontFamily: '"Montserrat",sans-serif', outline: 'none' }} />
          <motion.button whileTap={{ scale: 0.88 }} onClick={sendChat} disabled={!chatText.trim()}
            style={{ width: 38, height: 38, borderRadius: '50%', border: 'none',
              background: chatText.trim() ? 'linear-gradient(135deg,#7c3aed,#db2777)' : 'rgba(255,255,255,0.08)',
              color: '#fff', cursor: chatText.trim() ? 'pointer' : 'default', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>➤</motion.button>
        </div>
      </div>
    </div>
  );
}
