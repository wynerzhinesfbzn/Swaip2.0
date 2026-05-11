import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackHandler } from './backHandler';

const API = window.location.origin;
const WS_BASE = API.replace(/^http/, 'ws');
const getST = () => { try { return localStorage.getItem('swaip_session') || localStorage.getItem('swaip_session_token') || ''; } catch { return ''; } };

interface Room { id: string; name: string; hostHash: string; memberCount: number; isPlaying: boolean; trackTitle?: string; trackArtist?: string; }
interface Member { hash: string; name: string; }

function Av({ name, size = 36 }: { name: string; size?: number }) {
  const colors = ['#7c3aed','#db2777','#059669','#d97706','#2563eb','#dc2626','#0891b2'];
  const col = colors[(name.charCodeAt(0) || 0) % colors.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: col, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: size * 0.4, flexShrink: 0, fontFamily: '"Montserrat",sans-serif' }}>
      {name[0]?.toUpperCase() || '?'}
    </div>
  );
}

function RoomCard({ room, onJoin }: { room: Room; onJoin: () => void }) {
  return (
    <motion.div whileTap={{ scale: 0.98 }} onClick={onJoin}
      style={{ background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: '16px 18px', marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(135deg,#1e1b4b,#312e81)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
        {room.isPlaying ? '🎵' : '🎶'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 800, fontSize: 14, color: '#fff', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room.name}</div>
        {room.trackTitle ? (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {room.isPlaying ? '▶ ' : '⏸ '}{room.trackArtist} — {room.trackTitle}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Ждём трек...</div>
        )}
      </div>
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: '#818cf8' }}>{room.memberCount}</div>
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700 }}>слушают</div>
      </div>
    </motion.div>
  );
}

/* ── Player inside a room ── */
function RoomPlayer({ roomId, myHash, myName, onLeave }: { roomId: string; myHash: string; myName: string; onLeave: () => void }) {
  const wsRef = useRef<WebSocket | null>(null);
  const startTsRef = useRef(0);
  const startCtRef = useRef(0);

  const [connected, setConnected] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [room, setRoom] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [trackInfo, setTrackInfo] = useState<{ title: string; artist: string } | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [toast, setToast] = useState('');
  const [messages, setMessages] = useState<{ name: string; text: string }[]>([]);
  const [chatText, setChatText] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 3000); };
  const send = (p: unknown) => { if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(p)); };
  const isHost = room?.hostHash === myHash;

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/api/ws/cinema?token=${encodeURIComponent(getST())}&room=${roomId}`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = e => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'init') { setRoom(msg.room); setMembers(msg.members || []); }
        if (msg.type === 'member_joined') { setMembers(msg.members); showToast(`👤 ${msg.name} присоединился`); }
        if (msg.type === 'member_left') { setMembers(msg.members); }
        if (msg.type === 'play') { startTsRef.current = Date.now() - msg.currentTime * 1000; startCtRef.current = msg.currentTime; setIsPlaying(true); setCurrentTime(msg.currentTime); }
        if (msg.type === 'pause') { setIsPlaying(false); setCurrentTime(msg.currentTime); startCtRef.current = msg.currentTime; }
        if (msg.type === 'chat') { if (msg.message?.text) setMessages(p => [...p.slice(-99), { name: msg.message.author?.name || '?', text: msg.message.text }]); }
        if (msg.type === 'relay' && msg.payload?.type === 'listen_track') {
          setEmbedUrl(msg.payload.embedUrl || null);
          setTrackInfo(msg.payload.track || null);
          setIsPlaying(false);
          setCurrentTime(0);
        }
      } catch { /* */ }
    };
    const ping = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' })); }, 20_000);
    return () => { clearInterval(ping); ws.close(); };
  }, [roomId]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  /* RAF for current time */
  const rafRef = useRef(0);
  useEffect(() => {
    if (!isPlaying) { cancelAnimationFrame(rafRef.current); return; }
    const tick = () => { setCurrentTime(startCtRef.current + (Date.now() - startTsRef.current) / 1000); rafRef.current = requestAnimationFrame(tick); };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying]);

  const loadTrack = () => {
    const url = urlInput.trim();
    if (!url) return;
    let embedUrl = '';
    const ytM = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    const rtM = url.match(/rutube\.ru\/video\/([a-f0-9]{32})/i);
    if (ytM) embedUrl = `/api/browser-proxy?url=${encodeURIComponent(`https://www.youtube-nocookie.com/embed/${ytM[1]}?autoplay=1`)}`;
    else if (rtM) embedUrl = `/api/browser-proxy?url=${encodeURIComponent(`https://rutube.ru/play/embed/${rtM[1]}/?autoplay=true`)}`;
    if (!embedUrl) { showToast('⚠️ Вставьте ссылку YouTube или Rutube'); return; }
    const track = { title: 'Трек', artist: 'Неизвестно' };
    setEmbedUrl(embedUrl);
    setTrackInfo(track);
    setUrlInput('');
    setShowUrlInput(false);
    setIsPlaying(false);
    setCurrentTime(0);
    send({ type: 'relay', payload: { type: 'listen_track', embedUrl, track } });
    showToast('🎵 Трек загружен!');
  };

  const hostPlay = () => { const t = currentTime; startTsRef.current = Date.now() - t * 1000; startCtRef.current = t; setIsPlaying(true); send({ type: 'play', currentTime: t }); };
  const hostPause = () => { setIsPlaying(false); startCtRef.current = currentTime; send({ type: 'pause', currentTime }); };
  const sendChat = () => { const t = chatText.trim(); if (!t) return; send({ type: 'chat', text: t }); setChatText(''); };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#06060f', display: 'flex', flexDirection: 'column', fontFamily: '"Montserrat",sans-serif', zIndex: 500 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '48px 16px 12px', background: 'rgba(8,8,18,0.98)', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onLeave}
          style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 16, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</motion.button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 14, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room?.name || '...'}</div>
          <div style={{ fontSize: 10, color: connected ? '#22c55e' : '#ef4444' }}>● {connected ? `${members.length} слушают` : 'Подключение...'}</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>{members.slice(0, 5).map(m => <Av key={m.hash} name={m.name} size={26} />)}</div>
        {isHost && (
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowUrlInput(v => !v)}
            style={{ padding: '8px 14px', borderRadius: 100, border: 'none', background: 'linear-gradient(135deg,#4338ca,#7c3aed)', color: '#fff', fontWeight: 800, fontSize: 12, cursor: 'pointer' }}>
            + Трек
          </motion.button>
        )}
      </div>

      {/* URL input */}
      <AnimatePresence>
        {showUrlInput && isHost && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', flexShrink: 0 }}>
            <div style={{ padding: '10px 16px', background: 'rgba(10,8,24,0.98)', borderBottom: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 8 }}>
              <input value={urlInput} onChange={e => setUrlInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadTrack()}
                placeholder="Ссылка YouTube или Rutube..."
                style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '10px 14px', color: '#fff', fontSize: 13, fontFamily: '"Montserrat",sans-serif', outline: 'none' }} />
              <motion.button whileTap={{ scale: 0.95 }} onClick={loadTrack}
                style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#4338ca,#7c3aed)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
                ▶
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Player */}
      {embedUrl ? (
        <div style={{ height: 200, flexShrink: 0, background: '#000', position: 'relative' }}>
          <iframe key={embedUrl} src={embedUrl} allow="autoplay; fullscreen" allowFullScreen
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-presentation"
            style={{ width: '100%', height: '100%', border: 'none' }} title="Слушаем вместе" />
        </div>
      ) : (
        <div style={{ height: 120, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(8,8,18,0.6)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.3)' }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>🎶</div>
            <div style={{ fontSize: 13 }}>{isHost ? 'Нажмите «+ Трек» чтобы выбрать музыку' : 'Ждём трек от организатора...'}</div>
          </div>
        </div>
      )}

      {/* Now playing + controls */}
      {trackInfo && (
        <div style={{ padding: '10px 16px', background: 'rgba(10,8,24,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 42, height: 42, borderRadius: 10, background: 'linear-gradient(135deg,#4338ca,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>🎵</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{trackInfo.title}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{trackInfo.artist}</div>
          </div>
          {isHost && (
            <div style={{ display: 'flex', gap: 6 }}>
              <motion.button whileTap={{ scale: 0.9 }} onClick={isPlaying ? hostPause : hostPlay}
                style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,#4338ca,#7c3aed)', cursor: 'pointer', fontSize: 18, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isPlaying ? '⏸' : '▶'}
              </motion.button>
            </div>
          )}
        </div>
      )}

      {/* Members row */}
      <div style={{ padding: '8px 16px', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {members.map(m => (
          <div key={m.hash} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            <Av name={m.name} size={32} />
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', maxWidth: 48, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
          </div>
        ))}
      </div>

      {/* Chat */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#818cf8' }}>{m.name}: </span>
            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{m.text}</span>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      {/* Chat input */}
      <div style={{ padding: '10px 16px', background: 'rgba(8,8,18,0.98)', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 8, flexShrink: 0, paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}>
        <input value={chatText} onChange={e => setChatText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()}
          placeholder="Сообщение..."
          style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: '10px 16px', color: '#fff', fontSize: 14, fontFamily: '"Montserrat",sans-serif', outline: 'none' }} />
        <motion.button whileTap={{ scale: 0.9 }} onClick={sendChat}
          style={{ width: 42, height: 42, borderRadius: '50%', background: 'linear-gradient(135deg,#4338ca,#7c3aed)', border: 'none', cursor: 'pointer', fontSize: 18, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ➤
        </motion.button>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'rgba(20,20,35,0.97)', border: '1px solid rgba(129,140,248,0.3)', borderRadius: 50, padding: '10px 22px', fontSize: 13, color: '#fff', fontWeight: 700, zIndex: 700, whiteSpace: 'nowrap' }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Room list ── */
export default function ListenTogetherScreen({ myHash, myName, onBack }: { myHash: string; myName: string; onBack: () => void }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/cinema/rooms`, { headers: { 'x-session-token': getST() } });
      const d = await r.json();
      /* Filter for 'listen' type rooms */
      const all: any[] = d.rooms || [];
      setRooms(all.filter(r => r.type === 'listen' || r.name?.startsWith('🎵')));
    } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useBackHandler(activeRoom ? () => { setActiveRoom(null); load(); } : showCreate ? () => setShowCreate(false) : onBack);

  const create = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const r = await fetch(`${API}/api/cinema/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': getST() },
        body: JSON.stringify({ name: `🎵 ${newName.trim()}`, type: 'listen' }),
      });
      const d = await r.json();
      if (d.room?.id) { setActiveRoom(d.room.id); setShowCreate(false); setNewName(''); }
    } catch { /* */ }
    setCreating(false);
  };

  if (activeRoom) {
    return <RoomPlayer roomId={activeRoom} myHash={myHash} myName={myName} onLeave={() => { setActiveRoom(null); load(); }} />;
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#06060f', display: 'flex', flexDirection: 'column', fontFamily: '"Montserrat",sans-serif', zIndex: 500 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '52px 16px 14px', background: 'rgba(8,8,18,0.98)', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
          style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 16, color: '#fff' }}>←</motion.button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 16, color: '#fff' }}>🎵 Слушаем вместе</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Музыка в компании</div>
        </div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowCreate(true)}
          style={{ padding: '9px 16px', borderRadius: 100, background: 'linear-gradient(135deg,#4338ca,#7c3aed)', border: 'none', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
          + Создать
        </motion.button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', paddingTop: 60, color: 'rgba(255,255,255,0.3)' }}>Загрузка...</div>
        ) : rooms.length === 0 ? (
          <div style={{ textAlign: 'center', paddingTop: 60 }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>🎶</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>Нет активных комнат</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>Создайте комнату и позовите друзей слушать музыку вместе</div>
          </div>
        ) : rooms.map(r => (
          <RoomCard key={r.id} room={r} onJoin={() => setActiveRoom(r.id)} />
        ))}
      </div>

      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCreate(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 600 }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 340, damping: 32 }}
              style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 601, background: '#0f0f1a', borderRadius: '24px 24px 0 0', border: '1px solid rgba(255,255,255,0.1)', padding: '8px 20px 40px' }}>
              <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 99, margin: '10px auto 20px' }} />
              <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', marginBottom: 16 }}>🎵 Новая комната</div>
              <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && create()}
                placeholder="Название комнаты..."
                autoFocus
                style={{ width: '100%', background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '12px 16px', color: '#fff', fontSize: 15, fontFamily: '"Montserrat",sans-serif', boxSizing: 'border-box', outline: 'none', marginBottom: 14 }} />
              <motion.button whileTap={{ scale: 0.97 }} onClick={create} disabled={creating || !newName.trim()}
                style={{ width: '100%', padding: 14, borderRadius: 16, border: 'none', fontWeight: 900, fontSize: 15, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif', color: '#fff', background: creating || !newName.trim() ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg,#4338ca,#7c3aed)' }}>
                {creating ? 'Создаём...' : 'Создать комнату'}
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
