import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useBackHandler } from './backHandler';
import { motion, AnimatePresence } from 'framer-motion';
import DurakGame from './DurakGame';
import PyanitsaGame from './PyanitsaGame';
import MafiaGame from './MafiaGame';
import DominoGame from './DominoGame';
import TruthDareGame from './TruthDareGame';
import HangmanGame from './HangmanGame';
import CrocodileGame from './CrocodileGame';
import CheckersGame from './CheckersGame';
import ChessGame from './ChessGame';
import BoardGameComp from './BoardGameComp';

const API = window.location.origin;
const WS_BASE = API.replace(/^http/, 'ws');
const getTok = () => { try { return localStorage.getItem('swaip_session') || ''; } catch { return ''; } };

const C = {
  bg: '#07070f', surface: '#0f0f1c', card: '#12121e', border: 'rgba(200,200,255,0.1)',
  borderB: 'rgba(200,200,255,0.22)', text: '#e8e8f8', sub: '#6060a0', accent: '#6366f1', green: '#22c55e',
};

const THEMES: Record<string, { icon: string; label: string; grad: string; doorColor: string; accent: string }> = {
  cozy:     { icon: '🔥', label: 'Уютная',   grad: 'linear-gradient(160deg,#78350f,#b45309,#92400e)', doorColor: '#f59e0b', accent: '#fbbf24' },
  tropical: { icon: '🌴', label: 'Тропики',  grad: 'linear-gradient(160deg,#065f46,#0891b2,#047857)', doorColor: '#34d399', accent: '#6ee7b7' },
  night:    { icon: '🌙', label: 'Ночная',   grad: 'linear-gradient(160deg,#1e1b4b,#312e81,#0f172a)', doorColor: '#818cf8', accent: '#a78bfa' },
  arcade:   { icon: '🎮', label: 'Аркада',   grad: 'linear-gradient(160deg,#581c87,#7c3aed,#0891b2)', doorColor: '#c084fc', accent: '#e879f9' },
  zen:      { icon: '🍵', label: 'Дзен',     grad: 'linear-gradient(160deg,#14532d,#1e3a5f,#166534)', doorColor: '#86efac', accent: '#6ee7b7' },
  festival: { icon: '🎪', label: 'Праздник', grad: 'linear-gradient(160deg,#831843,#be123c,#9d174d)', doorColor: '#fb7185', accent: '#f9a8d4' },
};

const GAMES = [
  { id: 'durak',     icon: '🃏', name: 'Дурак',            desc: '2–6 игроков',  min: 2, max: 6,  color: '#312e81,#6366f1' },
  { id: 'pyanitsa',  icon: '🍺', name: 'Пьяница',          desc: '2 игрока',     min: 2, max: 2,  color: '#78350f,#d97706' },
  { id: 'mafia',     icon: '🕵️', name: 'Мафия',            desc: '4–10 игроков', min: 4, max: 10, color: '#450a0a,#7f1d1d' },
  { id: 'domino',    icon: '🎲', name: 'Домино',            desc: '2–4 игрока',   min: 2, max: 4,  color: '#14532d,#047857' },
  { id: 'truthdare', icon: '🎯', name: 'Правда/Действие',  desc: '2–10 игроков', min: 2, max: 10, color: '#7c2d12,#ea580c' },
  { id: 'hangman',   icon: '🔤', name: 'Виселица',          desc: '2–8 игроков',  min: 2, max: 8,  color: '#1e3a5f,#1d4ed8' },
  { id: 'crocodile', icon: '🐊', name: 'Крокодил',          desc: '3–8 игроков',  min: 3, max: 8,  color: '#14532d,#15803d' },
  { id: 'checkers',  icon: '⬛', name: 'Шашки',             desc: '2 игрока',     min: 2, max: 2,  color: '#292524,#57534e' },
  { id: 'chess',     icon: '♟️', name: 'Шахматы',           desc: '2 игрока',     min: 2, max: 2,  color: '#1c1917,#44403c' },
  { id: 'boardgame', icon: '🎲', name: 'Ходилка',           desc: '2–4 игрока',   min: 2, max: 4,  color: '#4c1d95,#7c3aed' },
];

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
];

function initials(n: string) { const p = n.trim().split(/\s+/); return p.length >= 2 ? (p[0][0]+p[1][0]).toUpperCase() : n.slice(0,2).toUpperCase(); }
function hashColor(h: string) {
  const pal = ['#6366f1','#8b5cf6','#ec4899','#3b82f6','#14b8a6','#f59e0b','#ef4444','#22c55e'];
  let n = 0; for (let i = 0; i < Math.min(h.length,8); i++) n += h.charCodeAt(i); return pal[n % pal.length];
}
function fmt(iso: string) { const d = new Date(iso); return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`; }

/* ── Compact Door Card ─────────────────── */
function DoorCard({ room, onlineCount, onClick }: { room: any; onlineCount: number; onClick: () => void }) {
  const th = THEMES[room.theme] || THEMES.cozy;
  const isFull = onlineCount >= (room.maxPlayers || 20);
  return (
    <motion.div whileTap={{ scale: 0.96 }} onClick={!isFull ? onClick : undefined}
      style={{ cursor: isFull ? 'not-allowed' : 'pointer', opacity: isFull ? 0.6 : 1, width: 110 }}>
      <div style={{ width: 110, height: 18, background: th.doorColor, borderRadius: '55px 55px 0 0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: `0 0 14px ${th.doorColor}50`, fontSize: 14 }}>{th.icon}</div>
      <div style={{ width: 110, height: 130, background: th.grad, border: `2px solid ${th.doorColor}`,
        borderTop: 'none', boxShadow: `0 6px 24px rgba(0,0,0,0.6),inset 0 0 30px rgba(0,0,0,0.3)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 8px 8px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 5, border: `1px solid ${th.doorColor}25`, borderRadius: 2, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, background: 'rgba(0,0,0,0.45)',
          borderRadius: 8, padding: '2px 6px', alignSelf: 'flex-end', position: 'relative', zIndex: 1 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: onlineCount > 0 ? C.green : '#666' }} />
          <span style={{ fontSize: 9, color: '#fff', fontWeight: 600 }}>{onlineCount}</span>
        </div>
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 9, color: `${th.accent}cc`, letterSpacing: 1.5, textTransform: 'uppercase' }}>комната</div>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', textShadow: `0 0 16px ${th.accent}`, lineHeight: 1.1 }}>{room.roomId}</div>
        </div>
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: th.doorColor }} />
        </div>
      </div>
      <div style={{ width: 118, height: 6, background: th.doorColor, marginLeft: -4, borderRadius: '0 0 3px 3px', opacity: 0.55 }} />
      <div style={{ marginTop: 6, textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: C.text, maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room.name}</div>
        <div style={{ fontSize: 9, color: C.sub }}>{th.label} · {room.maxPlayers} мест</div>
        {isFull && <div style={{ fontSize: 9, color: '#ef4444', fontWeight: 700 }}>Полная</div>}
      </div>
    </motion.div>
  );
}

/* ── Compact Game Card ─────────────────── */
function GameCard({ gm, joined, myHash, currentGameType, gameState, members, onJoin, onStart, onLeave, onOpen }:
  { gm: typeof GAMES[0]; joined: string[]; myHash: string; currentGameType: string | null;
    gameState: any; members: any[]; onJoin: () => void; onStart: () => void; onLeave: () => void; onOpen: () => void }) {
  const isThisGame = currentGameType === gm.id;
  const otherGameActive = !!(currentGameType && currentGameType !== gm.id && gameState?.status === 'playing');
  const isPlaying = isThisGame && gameState?.status === 'playing';
  const iAmJoined = isThisGame && joined.includes(myHash);
  const canStart = iAmJoined && joined.length >= gm.min && joined.length <= gm.max;

  if (otherGameActive) return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16,
      padding: '12px 14px', marginBottom: 8, opacity: 0.4, display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 20 }}>{gm.icon}</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{gm.name}</div>
        <div style={{ fontSize: 10, color: C.sub }}>Идёт другая игра</div>
      </div>
    </div>
  );

  return (
    <div style={{ background: C.card, border: `1px solid ${isThisGame ? C.accent+'44' : C.border}`,
      borderRadius: 16, padding: '12px 14px', marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: isInLobbyOrPlaying(isThisGame, joined) ? 10 : 0 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: `linear-gradient(135deg,${gm.color})`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{gm.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 900, color: C.text }}>{gm.name}</span>
            {isPlaying && <span style={{ fontSize: 9, color: C.green, fontWeight: 800, background: 'rgba(34,197,94,0.12)', padding: '1px 6px', borderRadius: 8 }}>● ИДЁТ</span>}
          </div>
          <div style={{ fontSize: 10, color: C.sub }}>{gm.desc}</div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {!iAmJoined && !isPlaying && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={onJoin}
              style={{ padding: '7px 12px', background: C.accent, border: 'none', borderRadius: 12,
                color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Войти</motion.button>
          )}
          {iAmJoined && !isPlaying && canStart && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={onStart}
              style={{ padding: '7px 12px', background: C.green, border: 'none', borderRadius: 12,
                color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>▶ Старт</motion.button>
          )}
          {iAmJoined && isPlaying && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={onOpen}
              style={{ padding: '7px 12px', background: C.accent, border: 'none', borderRadius: 12,
                color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Открыть</motion.button>
          )}
          {iAmJoined && !isPlaying && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={onLeave}
              style={{ padding: '7px 10px', background: 'transparent', border: `1px solid ${C.border}`,
                borderRadius: 12, color: C.sub, fontSize: 12, cursor: 'pointer' }}>✕</motion.button>
          )}
        </div>
      </div>
      {isThisGame && joined.length > 0 && !isPlaying && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: C.sub }}>{joined.length}/{gm.max === 2 ? 2 : `${gm.min}+`}</span>
          {joined.map(h => {
            const m = members.find((mm: any) => mm.hash === h);
            return (
              <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 3,
                background: C.surface, borderRadius: 8, padding: '2px 6px', border: `1px solid ${C.border}` }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: hashColor(h),
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 6, fontWeight: 800, color: '#fff' }}>
                  {initials(m?.name || '?')}
                </div>
                <span style={{ fontSize: 9, color: C.text }}>{m?.name?.split(' ')[0] || '…'}</span>
              </div>
            );
          })}
          {!canStart && (
            <span style={{ fontSize: 9, color: '#f59e0b' }}>
              {gm.id === 'pyanitsa' ? 'нужен 2-й игрок' : `ещё ${Math.max(0, gm.min - joined.length)}`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function isInLobbyOrPlaying(isThisGame: boolean, joined: string[]) {
  return isThisGame && joined.length > 0;
}

/* ── Main component ────────────────────── */
export default function LoungeScreen({ myHash, onBack }: { myHash?: string; onBack?: () => void }) {
  const [view, setView] = useState<'list' | 'room'>('list');
  const [roomsList, setRoomsList] = useState<any[]>([]);
  const [onlineCounts, setOnlineCounts] = useState<Record<string, number>>({});
  const [currentRoom, setCurrentRoom] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [myInfo, setMyInfo] = useState<any>(null);
  const [input, setInput] = useState('');
  const [tab, setTab] = useState<'chat' | 'game'>('chat');

  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createTheme, setCreateTheme] = useState('cozy');
  const [createMax, setCreateMax] = useState(20);
  const [creating, setCreating] = useState(false);

  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  const [showInvite, setShowInvite] = useState(false);

  const [gameState, setGameState] = useState<any>(null);
  const [gameJoined, setGameJoined] = useState<string[]>([]);
  const [currentGameType, setCurrentGameType] = useState<string | null>(null);
  const [showGameView, setShowGameView] = useState(false);

  /* ── Voice state ── */
  const [voiceActive, setVoiceActive] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceParticipants, setVoiceParticipants] = useState<string[]>([]);
  const [voiceMutedMap, setVoiceMutedMap] = useState<Record<string, boolean>>({});
  const [voiceError, setVoiceError] = useState('');

  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recordRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const listIntervalRef = useRef<number | null>(null);

  /* ── Voice refs ── */
  const voiceActiveRef = useRef(false);
  const myHashRef = useRef('');
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElemsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  /* Keep refs in sync */
  useEffect(() => { voiceActiveRef.current = voiceActive; }, [voiceActive]);
  useEffect(() => { myHashRef.current = myHash || myInfo?.hash || ''; }, [myHash, myInfo]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const autoCode = params.get('joinLounge');
    if (autoCode) {
      setJoinCode(autoCode.toUpperCase()); setShowJoin(true);
      const url = new URL(window.location.href);
      url.searchParams.delete('joinLounge');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const loadRooms = useCallback(async () => {
    try { const r = await fetch(`${API}/api/lounge/rooms`); const data = await r.json(); setRoomsList(data.rooms || []); } catch {}
  }, []);

  useEffect(() => {
    loadRooms();
    listIntervalRef.current = window.setInterval(loadRooms, 6000);
    return () => { if (listIntervalRef.current) clearInterval(listIntervalRef.current); };
  }, [loadRooms]);

  /* ── Voice functions (all use refs — no stale closures) ── */
  const closePeer = useCallback((hash: string) => {
    const pc = peersRef.current.get(hash);
    if (pc) { try { pc.close(); } catch {} peersRef.current.delete(hash); }
    const audio = audioElemsRef.current.get(hash);
    if (audio) { audio.srcObject = null; try { audio.pause(); } catch {} audioElemsRef.current.delete(hash); }
  }, []);

  const makePeer = useCallback((targetHash: string): RTCPeerConnection => {
    const existing = peersRef.current.get(targetHash);
    if (existing) { try { existing.close(); } catch {} }
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current.set(targetHash, pc);
    localStreamRef.current?.getTracks().forEach(t => pc.addTrack(t, localStreamRef.current!));
    pc.onicecandidate = (e) => {
      if (e.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'voice_ice', targetHash, candidate: e.candidate }));
      }
    };
    pc.ontrack = (e) => {
      let audio = audioElemsRef.current.get(targetHash);
      if (!audio) {
        audio = new Audio();
        audio.autoplay = true;
        audioElemsRef.current.set(targetHash, audio);
      }
      audio.srcObject = e.streams[0];
      audio.play().catch(() => {});
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        closePeer(targetHash);
      }
    };
    return pc;
  }, [closePeer]);

  const createOffer = useCallback(async (targetHash: string) => {
    const pc = makePeer(targetHash);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      wsRef.current?.send(JSON.stringify({ type: 'voice_offer', targetHash, sdp: offer }));
    } catch { closePeer(targetHash); }
  }, [makePeer, closePeer]);

  const handleOffer = useCallback(async (fromHash: string, sdp: RTCSessionDescriptionInit) => {
    const pc = makePeer(fromHash);
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      wsRef.current?.send(JSON.stringify({ type: 'voice_answer', targetHash: fromHash, sdp: answer }));
    } catch { closePeer(fromHash); }
  }, [makePeer, closePeer]);

  const joinVoice = useCallback(async () => {
    setVoiceError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      voiceActiveRef.current = true;
      setVoiceActive(true);
      setVoiceMuted(false);
      wsRef.current?.send(JSON.stringify({ type: 'voice_join' }));
    } catch {
      setVoiceError('Разрешите доступ к микрофону в браузере');
      setTimeout(() => setVoiceError(''), 3000);
    }
  }, []);

  const leaveVoice = useCallback(() => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    localStreamRef.current = null;
    peersRef.current.forEach((_, h) => closePeer(h));
    voiceActiveRef.current = false;
    setVoiceActive(false);
    setVoiceMuted(false);
    wsRef.current?.send(JSON.stringify({ type: 'voice_leave' }));
  }, [closePeer]);

  const toggleVoiceMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    setVoiceMuted(prev => {
      const nextMuted = !prev;
      stream.getAudioTracks().forEach(t => { t.enabled = !nextMuted; });
      wsRef.current?.send(JSON.stringify({ type: 'voice_mute', muted: nextMuted }));
      return nextMuted;
    });
  }, []);

  /* ── WebSocket (room) ── */
  useEffect(() => {
    if (view !== 'room' || !currentRoom) return;
    const tok = getTok();
    const ws = new WebSocket(`${WS_BASE}/api/ws/lounge?token=${encodeURIComponent(tok)}&room=${currentRoom.roomId}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);

        if (msg.type === 'init') {
          setMessages(msg.messages || []); setMembers(msg.members || []); setMyInfo(msg.you);
          if (msg.game) { setGameState(msg.game); setGameJoined(msg.joined || []); setCurrentGameType(msg.gameType || msg.game?.gameType || null); }
          setOnlineCounts(prev => ({ ...prev, [currentRoom.roomId]: (msg.members || []).length }));
          setVoiceParticipants(msg.voice || []);
        }
        if (msg.type === 'message') setMessages(p => [...p, msg.message]);
        if (msg.type === 'member_joined' || msg.type === 'member_left') {
          setMembers(msg.members || []);
          setOnlineCounts(prev => ({ ...prev, [currentRoom.roomId]: (msg.members || []).length }));
        }
        if (msg.type === 'game_state') { setGameState(msg.game); setGameJoined(msg.joined || []); setCurrentGameType(msg.gameType || msg.game?.gameType || null); if (msg.game?.status === 'playing') setShowGameView(true); }
        if (msg.type === 'game_joined') { setGameJoined(msg.joined || []); setCurrentGameType(msg.gameType || null); }
        if (msg.type === 'game_ended') { setGameState(null); setGameJoined([]); setCurrentGameType(null); setShowGameView(false); }

        /* ── Voice signaling ── */
        if (msg.type === 'voice_joined') {
          setVoiceParticipants(msg.voice || []);
          if (voiceActiveRef.current && msg.hash !== myHashRef.current) {
            createOffer(msg.hash);
          }
        }
        if (msg.type === 'voice_left') {
          setVoiceParticipants(msg.voice || []);
          closePeer(msg.hash);
          setVoiceMutedMap(prev => { const n = { ...prev }; delete n[msg.hash]; return n; });
        }
        if (msg.type === 'voice_offer') {
          if (voiceActiveRef.current) handleOffer(msg.fromHash, msg.sdp);
        }
        if (msg.type === 'voice_answer') {
          const pc = peersRef.current.get(msg.fromHash);
          if (pc) pc.setRemoteDescription(new RTCSessionDescription(msg.sdp)).catch(() => {});
        }
        if (msg.type === 'voice_ice') {
          const pc = peersRef.current.get(msg.fromHash);
          if (pc && msg.candidate) pc.addIceCandidate(new RTCIceCandidate(msg.candidate)).catch(() => {});
        }
        if (msg.type === 'voice_muted') {
          setVoiceMutedMap(prev => ({ ...prev, [msg.hash]: !!msg.muted }));
        }
      } catch {}
    };

    ws.onerror = () => {};
    ws.onclose = () => {};
    const ping = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' })); }, 20000);

    return () => {
      clearInterval(ping);
      ws.close();
      wsRef.current = null;
      /* Voice cleanup on room leave */
      if (voiceActiveRef.current) {
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        peersRef.current.forEach((_, h) => closePeer(h));
        voiceActiveRef.current = false;
        setVoiceActive(false);
        setVoiceMuted(false);
        setVoiceParticipants([]);
        setVoiceMutedMap({});
      }
    };
  }, [view, currentRoom, createOffer, handleOffer, closePeer]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const enterRoom = useCallback((room: any) => {
    setCurrentRoom(room); setMessages([]); setMembers([]); setMyInfo(null);
    setGameState(null); setGameJoined([]); setCurrentGameType(null); setShowGameView(false);
    setTab('chat'); setView('room');
  }, []);

  const leaveRoom = useCallback(() => {
    if (voiceActiveRef.current) {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      peersRef.current.forEach((_, h) => closePeer(h));
      voiceActiveRef.current = false;
      setVoiceActive(false);
    }
    wsRef.current?.close(); setView('list'); setCurrentRoom(null);
    setGameState(null); setCurrentGameType(null); setShowGameView(false);
    setVoiceParticipants([]); setVoiceMutedMap({});
    loadRooms();
  }, [loadRooms, closePeer]);

  useBackHandler(view === 'room' ? leaveRoom : (onBack ?? null));

  const createRoom = useCallback(async () => {
    if (!createName.trim() || creating) return; setCreating(true);
    try {
      const r = await fetch(`${API}/api/lounge/rooms`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': getTok() },
        body: JSON.stringify({ name: createName.trim(), theme: createTheme, maxPlayers: createMax }) });
      const data = await r.json();
      if (data.roomId) {
        setShowCreate(false); setCreateName(''); await loadRooms();
        const fr = await fetch(`${API}/api/lounge/rooms`).then(rr => rr.json());
        const nr = fr.rooms?.find((rm: any) => rm.roomId === data.roomId);
        if (nr) enterRoom(nr);
      }
    } catch {} finally { setCreating(false); }
  }, [createName, createTheme, createMax, creating, loadRooms, enterRoom]);

  const joinByCode = useCallback(async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code || joining) return; setJoining(true); setJoinError('');
    try {
      const r = await fetch(`${API}/api/lounge/join/${code}`); const data = await r.json();
      if (data.roomId) { setShowJoin(false); setJoinCode(''); enterRoom(data); }
      else setJoinError('Комната не найдена');
    } catch { setJoinError('Ошибка соединения'); } finally { setJoining(false); }
  }, [joinCode, joining, enterRoom]);

  const sendText = useCallback(() => {
    const ws = wsRef.current; const text = input.trim();
    if (!ws || !text || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'text', content: text })); setInput('');
  }, [input]);

  const startRecord = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream); chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const fd = new FormData(); fd.append('file', blob, 'voice.webm');
        try {
          const r = await fetch(`${API}/api/upload`, { method: 'POST', headers: { 'x-session-token': getTok() }, body: fd });
          const d = await r.json();
          if (d.url && wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify({ type: 'audio', audioUrl: d.url }));
        } catch {}
      };
      mr.start(); recordRef.current = mr; setRecording(true);
    } catch {}
  }, []);
  const stopRecord = useCallback(() => { recordRef.current?.stop(); recordRef.current = null; setRecording(false); }, []);

  const sendGame = useCallback((action: object) => {
    const ws = wsRef.current; if (!ws || ws.readyState !== WebSocket.OPEN) return; ws.send(JSON.stringify(action));
  }, []);

  const joinGame = useCallback((gameType: string) => { sendGame({ type: 'game_join', gameType }); setTab('game'); }, [sendGame]);
  const startGame = useCallback(() => { sendGame({ type: 'game_start' }); }, [sendGame]);
  const leaveGame = useCallback(() => {
    sendGame({ type: 'game_leave' }); setGameState(null); setGameJoined([]); setCurrentGameType(null); setShowGameView(false);
  }, [sendGame]);

  const inviteLink = currentRoom ? `${window.location.origin}?joinLounge=${currentRoom.inviteCode}` : '';
  const copyLink = () => { if (inviteLink) navigator.clipboard.writeText(inviteLink).catch(() => {}); };
  const copyCode = () => { if (currentRoom?.inviteCode) navigator.clipboard.writeText(currentRoom.inviteCode).catch(() => {}); };

  const th = THEMES[currentRoom?.theme] || THEMES.cozy;
  const myHashResolved = myHash || myInfo?.hash || '';
  const iAmJoinedGame = myHashResolved && gameJoined.includes(myHashResolved);
  const isGamePlaying = gameState?.status === 'playing';

  const sendChat = useCallback((text: string) => {
    const ws = wsRef.current;
    if (!ws || !text.trim() || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ type: 'text', content: text.trim() }));
  }, []);

  /* ── Game screen ── */
  if (view === 'room' && showGameView && iAmJoinedGame && isGamePlaying) {
    const props = { myHash: myHashResolved, onAction: sendGame, onLeave: leaveGame, chatMessages: messages, onChat: sendChat };
    if (currentGameType === 'durak')     return <DurakGame    game={gameState} joined={gameJoined} {...props} />;
    if (currentGameType === 'pyanitsa')  return <PyanitsaGame game={gameState} {...props} />;
    if (currentGameType === 'mafia')     return <MafiaGame    game={gameState} {...props} />;
    if (currentGameType === 'domino')    return <DominoGame   game={gameState} {...props} />;
    if (currentGameType === 'truthdare') return <TruthDareGame game={gameState} {...props} />;
    if (currentGameType === 'hangman')   return <HangmanGame  game={gameState} {...props} />;
    if (currentGameType === 'crocodile') return <CrocodileGame game={gameState} {...props} />;
    if (currentGameType === 'checkers')  return <CheckersGame  game={gameState} joined={gameJoined} members={members} {...props} />;
    if (currentGameType === 'chess')     return <ChessGame     game={gameState} joined={gameJoined} members={members} {...props} />;
    if (currentGameType === 'boardgame') return <BoardGameComp game={gameState} joined={gameJoined} members={members} {...props} />;
  }

  /* ── LIST VIEW ── */
  if (view === 'list') return (
    <div style={{ height: '100dvh', background: C.bg, fontFamily: 'Montserrat,sans-serif',
      display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`,
        padding: '50px 16px 12px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {onBack && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={onBack}
              style={{ background: 'none', border: 'none', color: C.sub, fontSize: 22, cursor: 'pointer', padding: 0, lineHeight: 1 }}>‹</motion.button>
          )}
          <div style={{ fontSize: 18, fontWeight: 900, color: C.text }}>🛋️ Комнаты</div>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: C.sub }}>{roomsList.length} активных</div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowCreate(true)}
            style={{ flex: 1, padding: '10px', background: C.accent, border: 'none', borderRadius: 16,
              color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer' }}>＋ Создать</motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setShowJoin(true); setJoinError(''); setJoinCode(''); }}
            style={{ padding: '10px 14px', background: 'transparent', border: `1px solid ${C.border}`,
              borderRadius: 16, color: C.text, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>🔑 Код</motion.button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
        {roomsList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🚪</div>
            <div style={{ fontSize: 15, color: C.sub }}>Нет активных комнат</div>
            <div style={{ fontSize: 12, color: `${C.sub}88`, marginTop: 6 }}>Создай свою!</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
            {roomsList.map(room => (
              <DoorCard key={room.roomId} room={room} onlineCount={onlineCounts[room.roomId] ?? 0} onClick={() => enterRoom(room)} />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 999,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
            onClick={() => setShowCreate(false)}>
            <motion.div initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }} transition={{ type: 'spring', damping: 22 }}
              onClick={e => e.stopPropagation()}
              style={{ background: C.surface, borderRadius: '24px 24px 0 0', padding: '22px 20px 36px',
                width: '100%', maxWidth: 500, border: `1px solid ${C.border}`, maxHeight: '88vh', overflowY: 'auto' }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: C.text, marginBottom: 16 }}>Новая комната</div>
              <input value={createName} onChange={e => setCreateName(e.target.value)} placeholder="Название комнаты…"
                style={{ width: '100%', padding: '11px 13px', borderRadius: 14, background: C.card,
                  border: `1px solid ${C.border}`, color: C.text, fontSize: 14, outline: 'none',
                  boxSizing: 'border-box', fontFamily: 'Montserrat,sans-serif', marginBottom: 14 }} />
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 8 }}>Тема</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {Object.entries(THEMES).map(([key, t]) => (
                  <motion.button key={key} whileTap={{ scale: 0.9 }} onClick={() => setCreateTheme(key)}
                    style={{ padding: '7px 12px', borderRadius: 12,
                      background: createTheme === key ? C.accent : C.card,
                      border: createTheme === key ? `1.5px solid ${C.accent}` : `1px solid ${C.border}`,
                      color: C.text, fontSize: 12, cursor: 'pointer' }}>
                    {t.icon} {t.label}
                  </motion.button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 6 }}>Макс. игроков: {createMax}</div>
              <input type="range" min={2} max={20} value={createMax} onChange={e => setCreateMax(Number(e.target.value))}
                style={{ width: '100%', marginBottom: 16 }} />
              <motion.button whileTap={{ scale: 0.95 }} onClick={createRoom} disabled={creating || !createName.trim()}
                style={{ width: '100%', padding: '13px', background: creating || !createName.trim() ? '#333' : C.accent,
                  border: 'none', borderRadius: 16, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer' }}>
                {creating ? 'Создаём…' : '✨ Создать комнату'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showJoin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 999,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
            onClick={() => setShowJoin(false)}>
            <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }} transition={{ type: 'spring', damping: 22 }}
              onClick={e => e.stopPropagation()}
              style={{ background: C.surface, borderRadius: '24px 24px 0 0', padding: '22px 20px 40px',
                width: '100%', maxWidth: 500, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: C.text, marginBottom: 4 }}>Войти по коду</div>
              <div style={{ fontSize: 12, color: C.sub, marginBottom: 16 }}>6-значный код приглашения</div>
              <input value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} placeholder="ABCD12" maxLength={6}
                onKeyDown={e => e.key === 'Enter' && joinByCode()}
                style={{ width: '100%', padding: '13px', borderRadius: 14, background: C.card,
                  border: joinError ? '1.5px solid #ef4444' : `1px solid ${C.border}`,
                  color: C.text, fontSize: 22, fontWeight: 900, letterSpacing: 8, textAlign: 'center',
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'Montserrat,sans-serif' }} />
              {joinError && <div style={{ color: '#ef4444', fontSize: 12, marginTop: 6, textAlign: 'center' }}>{joinError}</div>}
              <motion.button whileTap={{ scale: 0.95 }} onClick={joinByCode} disabled={joining || joinCode.length < 3}
                style={{ width: '100%', padding: '13px', background: joining ? '#333' : C.accent,
                  border: 'none', borderRadius: 16, color: '#fff', fontSize: 14, fontWeight: 800, cursor: 'pointer', marginTop: 14 }}>
                {joining ? 'Ищем…' : '🔑 Войти'}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  /* ── ROOM VIEW ── */
  return (
    <div style={{ height: '100dvh', background: C.bg, display: 'flex', flexDirection: 'column',
      fontFamily: 'Montserrat,sans-serif', overflow: 'hidden' }}>

      {/* Room header */}
      <div style={{ background: th.grad, padding: '46px 14px 10px', borderBottom: `1px solid ${th.doorColor}25`,
        flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={leaveRoom}
            style={{ background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: 18, width: 32, height: 32,
              color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>‹</motion.button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {th.icon} {currentRoom?.name}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.65)' }}>#{currentRoom?.roomId} · {members.length} онлайн</div>
          </div>
          <div style={{ display: 'flex', marginRight: 6 }}>
            {members.slice(0, 5).map((m: any, i: number) => (
              <div key={m.hash} style={{ width: 22, height: 22, borderRadius: '50%',
                background: m.avatar ? `url(${m.avatar}) center/cover` : hashColor(m.hash),
                border: '1.5px solid rgba(0,0,0,0.4)', marginLeft: i === 0 ? 0 : -6, zIndex: 5 - i,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 800, color: '#fff' }}>
                {!m.avatar && initials(m.name)}
              </div>
            ))}
          </div>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowInvite(true)}
            style={{ background: 'rgba(0,0,0,0.4)', border: 'none', borderRadius: 18, width: 32, height: 32,
              color: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>📨</motion.button>
        </div>
      </div>

      {/* ── Voice bar ── */}
      <div style={{ background: 'rgba(0,0,0,0.55)', borderBottom: `1px solid rgba(255,255,255,0.07)`,
        padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, minHeight: 46 }}>
        {!voiceActive ? (
          <motion.button whileTap={{ scale: 0.93 }} onClick={joinVoice}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
              background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 20, color: '#22c55e', fontSize: 12, fontWeight: 800, cursor: 'pointer',
              fontFamily: 'Montserrat,sans-serif' }}>
            <span>🎤</span>
            <span>Голос{voiceParticipants.length > 0 ? ` (${voiceParticipants.length})` : ''}</span>
          </motion.button>
        ) : (
          <>
            <motion.button whileTap={{ scale: 0.93 }} onClick={toggleVoiceMute}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px',
                background: voiceMuted ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.2)',
                border: `1px solid ${voiceMuted ? 'rgba(239,68,68,0.45)' : 'rgba(34,197,94,0.5)'}`,
                borderRadius: 20, color: voiceMuted ? '#f87171' : '#22c55e',
                fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'Montserrat,sans-serif' }}>
              <span>{voiceMuted ? '🔇' : '🎤'}</span>
              <span>{voiceMuted ? 'Выкл' : 'Вкл'}</span>
            </motion.button>
            <motion.button whileTap={{ scale: 0.93 }} onClick={leaveVoice}
              style={{ padding: '6px 10px', background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)', borderRadius: 20,
                color: '#f87171', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'Montserrat,sans-serif' }}>
              Выйти
            </motion.button>
          </>
        )}

        {/* Voice participants avatars */}
        {voiceParticipants.length > 0 && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 2, flex: 1, overflow: 'hidden' }}>
            {voiceParticipants.map(h => {
              const m = members.find((mm: any) => mm.hash === h);
              const isMuted = voiceMutedMap[h];
              const isMe = h === myHashResolved;
              const color = hashColor(h);
              return (
                <div key={h} title={m?.name || h} style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', background: color,
                    border: `2px solid ${isMuted ? '#ef4444' : '#22c55e'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, color: '#fff',
                    boxShadow: (!isMuted && voiceActive && isMe) ? `0 0 8px ${color}99` : 'none',
                  }}>
                    {initials(m?.name || '?')}
                  </div>
                  {isMuted && (
                    <div style={{ position: 'absolute', bottom: -1, right: -1, fontSize: 8,
                      background: '#0a0a0a', borderRadius: '50%', lineHeight: 1, padding: 1 }}>🔇</div>
                  )}
                  {isMe && (
                    <div style={{ position: 'absolute', bottom: -1, left: -1, width: 8, height: 8,
                      borderRadius: '50%', background: '#6366f1', border: '1px solid #0a0a0a' }} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Error hint */}
        {voiceError && (
          <div style={{ fontSize: 10, color: '#f87171', fontWeight: 700, flex: 1, textAlign: 'right' }}>
            ⚠️ {voiceError}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
        {(['chat', 'game'] as const).map(t => (
          <motion.button key={t} whileTap={{ scale: 0.96 }} onClick={() => setTab(t)}
            style={{ flex: 1, padding: '10px', background: 'none', border: 'none',
              borderBottom: tab === t ? `2px solid ${C.accent}` : '2px solid transparent',
              color: tab === t ? C.accent : C.sub, fontSize: 13, fontWeight: tab === t ? 800 : 500, cursor: 'pointer' }}>
            {t === 'chat' ? '💬 Чат' : `🎮 Игры${isGamePlaying ? ' ●' : ''}`}
          </motion.button>
        ))}
      </div>

      {/* Chat */}
      {tab === 'chat' && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 4px', minHeight: 0 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: C.sub, padding: '30px 0', fontSize: 13 }}>Начни общение 👋</div>
            )}
            {messages.map((m: any) => {
              const isMe = m.senderHash === (myInfo?.hash || myHash);
              return (
                <div key={m.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', gap: 7, marginBottom: 8 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: hashColor(m.senderHash),
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>
                    {initials(m.senderName)}
                  </div>
                  <div style={{ maxWidth: '74%' }}>
                    <div style={{ fontSize: 9, color: C.sub, marginBottom: 2, textAlign: isMe ? 'right' : 'left' }}>
                      {isMe ? 'Ты' : m.senderName} · {m.createdAt ? fmt(m.createdAt) : ''}
                    </div>
                    {m.type === 'audio' ? (
                      <audio controls src={m.audioUrl} style={{ height: 32, borderRadius: 18 }} />
                    ) : (
                      <div style={{ padding: '8px 12px', borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                        background: isMe ? C.accent : C.card, border: `1px solid ${isMe ? 'transparent' : C.border}`,
                        fontSize: 13, color: C.text, lineHeight: 1.45, wordBreak: 'break-word' }}>{m.content}</div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
          <div style={{ padding: '8px 12px 24px', background: C.surface, borderTop: `1px solid ${C.border}`,
            display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendText()}
              placeholder="Написать…"
              style={{ flex: 1, padding: '10px 14px', borderRadius: 20, background: C.card,
                border: `1px solid ${C.border}`, color: C.text, fontSize: 13, outline: 'none',
                fontFamily: 'Montserrat,sans-serif', minWidth: 0 }} />
            {input.trim() ? (
              <motion.button whileTap={{ scale: 0.9 }} onClick={sendText}
                style={{ width: 40, height: 40, borderRadius: '50%', background: C.accent, border: 'none',
                  color: '#fff', fontSize: 16, cursor: 'pointer', flexShrink: 0 }}>➤</motion.button>
            ) : (
              <motion.button onPointerDown={startRecord} onPointerUp={stopRecord} onPointerLeave={stopRecord}
                style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', flexShrink: 0,
                  background: recording ? '#ef4444' : C.card, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>🎙️</motion.button>
            )}
          </div>
        </>
      )}

      {/* Games */}
      {tab === 'game' && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px', minHeight: 0 }}>
          {GAMES.map(gm => (
            <GameCard key={gm.id} gm={gm}
              joined={currentGameType === gm.id ? gameJoined : []}
              myHash={myHashResolved}
              currentGameType={currentGameType}
              gameState={currentGameType === gm.id ? gameState : null}
              members={members}
              onJoin={() => joinGame(gm.id)}
              onStart={startGame}
              onLeave={leaveGame}
              onOpen={() => setShowGameView(true)} />
          ))}
        </div>
      )}

      {/* Invite modal */}
      <AnimatePresence>
        {showInvite && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 999,
              display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
            onClick={() => setShowInvite(false)}>
            <motion.div initial={{ y: 260 }} animate={{ y: 0 }} exit={{ y: 260 }} transition={{ type: 'spring', damping: 22 }}
              onClick={e => e.stopPropagation()}
              style={{ background: C.surface, borderRadius: '24px 24px 0 0', padding: '22px 20px 40px',
                width: '100%', maxWidth: 500, border: `1px solid ${C.border}` }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: C.text, marginBottom: 4 }}>📨 Пригласить</div>
              <div style={{ fontSize: 12, color: C.sub, marginBottom: 18 }}>Поделись кодом или ссылкой</div>
              <div style={{ fontSize: 10, color: C.sub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Код</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <div style={{ flex: 1, padding: '12px', background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 14, fontSize: 22, fontWeight: 900, letterSpacing: 8, color: C.text, textAlign: 'center' }}>
                  {currentRoom?.inviteCode}
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => { copyCode(); setShowInvite(false); }}
                  style={{ padding: '12px 16px', background: C.accent, border: 'none', borderRadius: 14,
                    color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Копировать</motion.button>
              </div>
              <div style={{ fontSize: 10, color: C.sub, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Ссылка</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1, padding: '10px 12px', background: C.card, border: `1px solid ${C.border}`,
                  borderRadius: 14, fontSize: 10, color: C.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inviteLink}
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => { copyLink(); setShowInvite(false); }}
                  style={{ padding: '10px 14px', background: C.card, border: `1px solid ${C.border}`,
                    borderRadius: 14, color: C.text, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🔗</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
