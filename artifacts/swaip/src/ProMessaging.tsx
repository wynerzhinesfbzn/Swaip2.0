import React, { useState, useRef, useEffect, createContext, useContext, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { UseCallSignalingReturn } from './useCallSignaling';
import { getOrCreateMyPubKey, getOrDeriveSharedKey, encryptMsg, decryptMsg } from './secretCrypto';
import { useGameSession, GamePanel, GamePickerModal } from './ChatGames';
import { BgMusicAutoplay, BgMusicPicker, type BgMusicPreset } from './BgMusic';

/* ── CallCtx — провайдится из SwaipHome ── */
export const CallCtx = createContext<UseCallSignalingReturn | null>(null);
export const useCall = (): UseCallSignalingReturn => useContext(CallCtx)!;

/* ── Сессионный токен ── */
const getST = () => {
  try { return localStorage.getItem('swaip_session_token') || localStorage.getItem('swaip_session') || ''; }
  catch { return ''; }
};

const API_BASE = window.location.origin;

/* ── Типы ── */
export interface ConvUser { name: string; avatar: string; handle: string; }
export interface GroupParticipant { hash: string; info: ConvUser; }
export interface ConvItem {
  id: number; type: string; otherHash: string; otherInfo: ConvUser;
  name: string | null; participants: GroupParticipant[];
  lastMessage: MsgItem | null; unreadCount: number; lastMessageAt: string;
}
export interface ReplyInfo {
  id: number; content: string; messageType: string; author: ConvUser; senderHash: string;
}
export interface MsgItem {
  id: number; conversationId: number; senderHash: string; content: string;
  messageType: string; mediaUrl: string | null; mediaName: string | null;
  duration: number | null; isRead: boolean; createdAt: string; author: ConvUser;
  replyToId?: number | null;
  replyTo?: ReplyInfo | null;
  editedAt?: string | null;
  deletedForAll?: boolean;
  reactions?: Record<string, string[]>;
  burnAt?: string | null;
}
type VFrame = 'filmstrip' | 'retrotv' | 'camera' | 'camcorder' | 'balloon';

/* ── Переводы (русский) ── */
const T = {
  leave_chat: 'Покинуть беседу?',
  group_name_ph: 'Название беседы',
  message_ph: 'Сообщение…',
  members_label: 'Участники',
  you_label: 'Вы',
  leave_chat_btn: '🚪 Покинуть беседу',
  follow_to_add: 'Добавьте собеседника через Поиск, чтобы начать чат',
  call_voice: 'Аудиозвонок',
  video_message: 'Видеосообщение',
  invitation_label: 'SWAIP',
  add_to_circle_hint: 'Добавить в Круг',
  open_profile_hint: 'Открыть профиль',
  tap_to_open: 'Нажмите, чтобы открыть',
  recording: 'Запись…',
  messages_header: 'Сообщения',
  messages_subtitle: 'Все ваши переписки',
  no_chats: 'Нет сообщений',
  no_chats_hint: 'Найдите человека через Поиск и начните переписку',
  go_to_search: 'Найти людей',
};

/* ── Эмодзи для чата ── */
const EMOJIS_CHAT = ['😀','😂','❤️','🔥','👍','👎','😮','😢','😡','🎉','💯','🙏','✨','💪','👏','🤔','😍','🤣','😎','👋','🌊','⚡','💎','🚀','🎤','🎧','🎶','📸','🤝','💬'];

/* ── Форматирование времени ── */
function formatMsgTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return 'только что';
  if (diff < 3600000) return `${Math.floor(diff/60000)}м`;
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'});
  return d.toLocaleDateString('ru',{day:'2-digit',month:'short'});
}

function fmtLastSeen(iso: string): string {
  const d = new Date(iso); const now = Date.now(); const diff = now - d.getTime();
  if (diff < 60000) return 'только что';
  if (diff < 3600000) return `${Math.floor(diff/60000)} мин назад`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)} ч назад`;
  if (diff < 172800000) return 'вчера';
  return d.toLocaleDateString('ru',{day:'2-digit',month:'short'});
}

function getReplyPreview(r: ReplyInfo): string {
  if (r.messageType==='image') return '📷 Фото';
  if (r.messageType==='video') return '🎬 Видео';
  if (r.messageType==='audio') return '🎤 Голосовое';
  if (r.messageType==='gif')   return '🎞 GIF';
  if (r.messageType==='file')  return '📎 Файл';
  if (r.messageType==='bgmusic') return `🎵 ${r.content || 'Фоновая музыка'}`;
  if (r.content==='__deleted__') return 'Сообщение удалено';
  if (r.content.startsWith('e2e:')) return '🔒 Зашифровано';
  return r.content.length>60 ? r.content.slice(0,60)+'…' : r.content;
}

const REACT_EMOJIS = ['❤️','😂','👍','👎','😮','😢','🔥','🙏','😍','💯'];

function getMsgPreview(m: MsgItem | null): string {
  if (!m) return '';
  if (m.messageType === 'image') return '📷 Фото';
  if (m.messageType === 'video') return '🎬 Видео';
  if (m.messageType === 'videoMessage') return '🎥 Видеосообщение';
  if (m.messageType === 'audio') return '🎤 Голосовое';
  if (m.messageType === 'gif') return '🎞 GIF';
  if (m.messageType === 'file') return `📎 ${m.mediaName || 'Файл'}`;
  if (m.messageType === 'bgmusic') return `🎵 ${m.mediaName || m.content || 'Фоновая музыка'}`;
  if (m.messageType === 'system') return `• ${m.content}`;
  if (typeof m.content === 'string' && m.content.startsWith('e2e:')) return '🔒 Зашифровано';
  return m.content || '';
}

/* ── Аватар ── */
function Avatar32({ info, accent }: { info: ConvUser; accent: string }) {
  const initials = (info.name || '?').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
  if (info.avatar && !info.avatar.startsWith('blob:')) {
    return <img src={info.avatar} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />;
  }
  return (
    <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center',
      background:`linear-gradient(135deg,${accent}44,${accent}22)`, fontSize:14, fontWeight:800, color:accent,
      fontFamily:'"Montserrat",sans-serif' }}>
      {initials}
    </div>
  );
}

/* ── Back tab ── */
function BackBtn({ onBack, accent = '#60a5fa' }: { onBack: () => void; accent?: string }) {
  return (
    <motion.button whileTap={{ scale:0.93 }} onClick={onBack}
      style={{ position:'fixed', left:0, top:'50%', transform:'translateY(-50%)', zIndex:200,
        background:'rgba(0,0,0,0.78)', backdropFilter:'blur(16px)',
        border:`1px solid ${accent}44`, borderLeft:'none',
        borderRadius:'0 24px 24px 0', padding:'14px 10px 14px 6px',
        cursor:'pointer', display:'flex', alignItems:'center', gap:4,
        boxShadow:`3px 0 20px ${accent}33` }}>
      <div style={{ width:4, height:24, borderRadius:2, background:accent, opacity:0.8 }} />
    </motion.button>
  );
}

/* ── uploadToStorage (simplified — no NSFW check needed in messaging) ── */
async function uploadToStorage(file: File): Promise<string> {
  if (file.size > 80 * 1024 * 1024) throw new Error('Файл слишком большой (максимум 80 МБ)');
  const ct = file.type || 'application/octet-stream';
  const isImage = ct.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
  const endpoint = isImage ? '/api/image-upload' : '/api/upload';
  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const tid = setTimeout(() => { xhr.abort(); reject(new Error('Загрузка прервана по таймауту')); }, 120000);
    xhr.onload = () => {
      clearTimeout(tid);
      if (xhr.status < 200 || xhr.status >= 300) { reject(new Error(`Ошибка ${xhr.status}`)); return; }
      try { const d = JSON.parse(xhr.responseText); if (d.url) resolve(d.url); else reject(new Error('Нет URL')); }
      catch { reject(new Error('Неверный ответ')); }
    };
    xhr.onerror = () => { clearTimeout(tid); reject(new Error('Сетевая ошибка')); };
    xhr.open('POST', `${API_BASE}${endpoint}`);
    xhr.setRequestHeader('Content-Type', ct);
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(file.name));
    const tok = getST(); if (tok) xhr.setRequestHeader('x-session-token', tok);
    xhr.send(file);
  });
}

/* ══════════════════════════════════════════════
   CHAT SCREEN
══════════════════════════════════════════════ */
export function ChatScreen({ convId, otherHash, otherInfo, myHash, accent, onBack, isGroup: isGroupProp, groupName: groupNameProp, participants: participantsProp, isSecret: isSecretProp, onViewProfile }: {
  convId: number; otherHash: string; otherInfo: ConvUser; myHash: string; accent: string; onBack: () => void;
  onViewProfile?: (hash: string) => void;
  isGroup?: boolean; groupName?: string | null; participants?: GroupParticipant[];
  isSecret?: boolean;
}) {
  const call = useCall();
  const isSecret = isSecretProp ?? false;
  const C = { bg: isSecret ? '#060a0c' : '#0a0c14', sub:'rgba(255,255,255,0.4)' };
  const secAccent = '#22c55e'; /* зелёный для секретных */
  const eff = isSecret ? secAccent : accent;

  const [messages,      setMessages]      = useState<MsgItem[]>([]);
  const [input,         setInput]         = useState('');
  const [sending,       setSending]       = useState(false);
  const [uploadingFile, setUploadingFile] = useState<string | null>(null);
  const [showEmoji,     setShowEmoji]     = useState(false);
  const [recording,     setRecording]     = useState(false);
  const [recSec,        setRecSec]        = useState(0);
  const [videoOpen,     setVideoOpen]     = useState(false);
  const [videoRecording,setVideoRecording]= useState(false);
  const [videoSec,      setVideoSec]      = useState(0);
  const [camFacing,     setCamFacing]     = useState<'user'|'environment'>('user');
  const [videoTick,     setVideoTick]     = useState(0);
  const [videoFrame,    setVideoFrame]    = useState<VFrame>('filmstrip');
  const [isGroup,       setIsGroup]       = useState(isGroupProp ?? false);
  const [groupName,     setGroupName]     = useState(groupNameProp ?? '');
  const [participants,  setParticipants]  = useState<GroupParticipant[]>(participantsProp ?? []);
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [showMembers,   setShowMembers]   = useState(false);
  const [contacts,      setContacts]      = useState<GroupParticipant[]>([]);
  const [adding,        setAdding]        = useState<string | null>(null);
  const [editingName,   setEditingName]   = useState(false);
  const [newGroupName,  setNewGroupName]  = useState('');
  /* ── Секретный чат: состояние E2E ── */
  const [e2eReady,      setE2eReady]      = useState(false);
  const [e2eError,      setE2eError]      = useState('');
  const [myPubKey,      setMyPubKey]      = useState('');
  const [peerPubKey,    setPeerPubKey]    = useState('');
  const [burnTimer,     setBurnTimer]     = useState(0);
  const [showBurnPicker,setShowBurnPicker]= useState(false);
  const sharedKeyRef = useRef<CryptoKey | null>(null);
  /* ── Reply / Edit / Context menu / Online ── */
  const [replyTarget,   setReplyTarget]   = useState<MsgItem | null>(null);
  const [editTarget,    setEditTarget]    = useState<MsgItem | null>(null);
  const [swipeMsg,      setSwipeMsg]      = useState<number|null>(null);
  const [swipeDx,       setSwipeDx]       = useState(0);
  const swipeTouchRef   = useRef<{x:number;y:number;locked:boolean}|null>(null);
  const [contextMenu,   setContextMenu]   = useState<{msg:MsgItem;x:number;y:number}|null>(null);
  const [onlineStatus,  setOnlineStatus]  = useState<{online:boolean;lastSeenAt:string|null}|null>(null);
  const [showReactPicker,setShowReactPicker] = useState<number|null>(null); /* msgId */
  /* ── Secret Swipe (двухпальцевый свайп по аватару) ── */
  const [secretSwipeOpen, setSecretSwipeOpen] = useState(false);
  const [secretSwipeText, setSecretSwipeText] = useState('');
  const [secretSwipeSending, setSecretSwipeSending] = useState(false);
  const [msgTimers, setMsgTimers] = useState<Record<number,string>>({});
  /* ── Swipe Battle ── */
  const [battleId, setBattleId] = useState<string|null>(null);
  const [battleData, setBattleData] = useState<any|null>(null);
  const [battleSwiped, setBattleSwiped] = useState(false);
  const [battleCountdown, setBattleCountdown] = useState(30);
  const battlePollRef = useRef<ReturnType<typeof setInterval>|null>(null);
  const battleCdRef   = useRef<ReturnType<typeof setInterval>|null>(null);
  /* ── Chat Games ── */
  const [showGamePicker, setShowGamePicker] = useState(false);
  const [showBgMusicPicker, setShowBgMusicPicker] = useState(false);
  const [chatBgMusicSel, setChatBgMusicSel] = useState<BgMusicPreset|null>(null);
  const gameSession = useGameSession(convId ?? null, myHash);

  const bottomRef     = useRef<HTMLDivElement>(null);
  const mediaRef      = useRef<MediaRecorder | null>(null);
  const chunksRef     = useRef<Blob[]>([]);
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef      = useRef<HTMLInputElement>(null);
  const vidPreviewRef = useRef<HTMLVideoElement | null>(null);
  const vidStreamRef  = useRef<MediaStream | null>(null);
  const vidMediaRef   = useRef<MediaRecorder | null>(null);
  const vidChunksRef  = useRef<Blob[]>([]);
  const vidTimerRef   = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ── Poll for incoming Battle challenges ── */
  useEffect(() => {
    if (isGroup || isSecret || !otherHash) return;
    const t = setInterval(async () => {
      if (battleId) return; /* already in a battle */
      try {
        const r = await fetch(`${API_BASE}/api/battle/incoming`, { headers: { 'x-session-token': getST() } });
        if (!r.ok) return;
        const d = await r.json();
        if (d.battle && d.battle.challengerHash === otherHash) {
          setBattleId(d.battle.id);
          setBattleData({ ...d.battle, myRole: 'opponent' });
          pollBattle(d.battle.id);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [isGroup, isSecret, otherHash, battleId]);

  /* ── Timer countdown for burnAt messages ── */
  useEffect(() => {
    /* Seed timers for any secret_swipe messages with burnAt */
    const seed: Record<number,string> = {};
    messages.forEach(m => { if (m.messageType === 'secret_swipe' && m.burnAt) seed[m.id] = '...'; });
    if (Object.keys(seed).length) setMsgTimers(prev => ({ ...prev, ...seed }));
  }, [messages.length]);

  useEffect(() => {
    const t = setInterval(() => {
      setMsgTimers(prev => {
        const burnMsgs = messages.filter(m => m.messageType === 'secret_swipe' && m.burnAt);
        if (!burnMsgs.length) return prev;
        const next: Record<number,string> = {};
        let changed = false;
        for (const msg of burnMsgs) {
          const diff = new Date(msg.burnAt!).getTime() - Date.now();
          if (diff <= 0) { changed = true; continue; }
          const h = Math.floor(diff / 3600000);
          const m2 = Math.floor((diff % 3600000) / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          const label = h > 0 ? `${h}ч ${m2}м` : m2 > 0 ? `${m2}м ${s}с` : `${s}с`;
          next[msg.id] = label;
          if (next[msg.id] !== prev[msg.id]) changed = true;
        }
        return changed ? { ...prev, ...next } : prev;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [messages]);

  /* ── Secret Swipe send ── */
  const sendSecretSwipe = async () => {
    if (!secretSwipeText.trim() || secretSwipeSending) return;
    setSecretSwipeSending(true);
    try {
      const r = await fetch(`${API_BASE}/api/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': getST() },
        body: JSON.stringify({ content: secretSwipeText.trim(), messageType: 'secret_swipe', burnInMs: 24 * 60 * 60 * 1000 }),
      });
      if (r.ok) {
        const newMsg = await r.json();
        setMessages(prev => [...prev, { ...newMsg, author: { name: otherInfo.name, avatar: otherInfo.avatar, handle: otherInfo.handle } }]);
        setSecretSwipeText('');
        setSecretSwipeOpen(false);
      }
    } finally { setSecretSwipeSending(false); }
  };

  /* ── Battle functions ── */
  const startBattle = async () => {
    if (!otherHash) return;
    try {
      const r = await fetch(`${API_BASE}/api/battle/challenge`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session-token': getST() },
        body: JSON.stringify({ opponentHash: otherHash }),
      });
      if (r.ok) {
        const d = await r.json();
        setBattleId(d.battleId);
        setBattleSwiped(false);
        pollBattle(d.battleId);
      }
    } catch {}
  };

  const pollBattle = (id: string) => {
    if (battlePollRef.current) clearInterval(battlePollRef.current);
    battlePollRef.current = setInterval(async () => {
      try {
        const r = await fetch(`${API_BASE}/api/battle/${id}`, { headers: { 'x-session-token': getST() } });
        if (r.ok) {
          const d = await r.json();
          setBattleData(d);
          if (d.status === 'active' && !battleCdRef.current) {
            setBattleCountdown(30);
            battleCdRef.current = setInterval(() => setBattleCountdown(c => { if (c <= 1) { clearInterval(battleCdRef.current!); battleCdRef.current = null; return 0; } return c - 1; }), 1000);
          }
          if (d.status === 'completed' || d.status === 'declined' || d.status === 'expired') {
            clearInterval(battlePollRef.current!); battlePollRef.current = null;
            if (battleCdRef.current) { clearInterval(battleCdRef.current); battleCdRef.current = null; }
          }
        }
      } catch {}
    }, 1500);
  };

  const acceptBattle = async (id: string) => {
    await fetch(`${API_BASE}/api/battle/${id}/accept`, { method: 'POST', headers: { 'x-session-token': getST() } });
    setBattleId(id);
    setBattleSwiped(false);
    pollBattle(id);
  };

  const doSwipe = async (direction: 'up' | 'down') => {
    if (!battleId || battleSwiped) return;
    setBattleSwiped(true);
    try {
      await fetch(`${API_BASE}/api/battle/${battleId}/swipe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session-token': getST() },
        body: JSON.stringify({ direction }),
      });
    } catch {}
  };

  const closeBattle = () => {
    if (battlePollRef.current) { clearInterval(battlePollRef.current); battlePollRef.current = null; }
    if (battleCdRef.current) { clearInterval(battleCdRef.current); battleCdRef.current = null; }
    setBattleId(null); setBattleData(null); setBattleSwiped(false); setBattleCountdown(30);
  };

  /* ── E2E: инициализация при открытии секретного чата ── */
  useEffect(() => {
    if (!isSecret) return;
    let cancelled = false;
    const initE2E = async () => {
      try {
        /* 1. Получаем или создаём наш публичный ключ */
        const myPub = await getOrCreateMyPubKey(convId);
        if (cancelled) return;
        setMyPubKey(myPub);

        /* 2. Отправляем публичный ключ на сервер */
        await fetch(`${API_BASE}/api/conversations/${convId}/public-key`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'x-session-token': getST() },
          body: JSON.stringify({ publicKey: myPub }),
        });

        /* 3. Опрашиваем ключ собеседника (polling, пока не придёт) */
        let attempts = 0;
        const pollPeer = async () => {
          if (cancelled) return;
          const r = await fetch(`${API_BASE}/api/conversations/${convId}/peer-key`, { headers: { 'x-session-token': getST() } });
          if (r.ok) {
            const { peerKey, burnTimer: bt } = await r.json();
            if (cancelled) return;
            if (bt !== undefined) setBurnTimer(bt);
            if (peerKey) {
              setPeerPubKey(peerKey);
              /* 4. Производим общий секрет */
              const sk = await getOrDeriveSharedKey(convId, myPub, peerKey);
              sharedKeyRef.current = sk;
              setE2eReady(true);
              return;
            }
          }
          attempts++;
          if (attempts < 30) setTimeout(pollPeer, 2000);
          else if (!cancelled) setE2eError('Собеседник ещё не открыл чат. Подождите.');
        };
        await pollPeer();
      } catch (err: any) {
        if (!cancelled) setE2eError(`Ошибка E2E: ${err?.message || err}`);
      }
    };
    initE2E();
    return () => { cancelled = true; };
  }, [convId, isSecret]);

  const loadMessages = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/conversations/${convId}/messages`, { headers: { 'x-session-token': getST() } });
      if (r.ok) {
        const { messages: ms } = await r.json();
        if (isSecret && sharedKeyRef.current) {
          /* Расшифровываем каждое сообщение локально */
          const decrypted = await Promise.all((ms ?? []).map(async (m: MsgItem) => {
            if (m.messageType === 'system' || !m.content.startsWith('e2e:')) return m;
            const plain = await decryptMsg(m.content, sharedKeyRef.current!);
            return { ...m, content: plain };
          }));
          setMessages(decrypted);
        } else {
          setMessages(ms ?? []);
        }
      }
    } catch {}
  }, [convId, isSecret]);

  /* ── SSE: мгновенная доставка новых сообщений ── */
  useEffect(() => {
    if (!convId) return;
    const token = getST();
    if (!token) return;
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let alive = true;

    const connect = () => {
      if (!alive) return;
      const url = `${API_BASE}/api/conversations/${convId}/sse?token=${encodeURIComponent(token)}`;
      es = new EventSource(url);
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'new_message') loadMessages();
        } catch {}
      };
      es.onerror = () => {
        es?.close();
        if (alive) retryTimer = setTimeout(connect, 5000);
      };
    };
    connect();
    return () => {
      alive = false;
      es?.close();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [convId, loadMessages]);

  /* ── Polling как резервный механизм (1.5 сек) ── */
  useEffect(() => { loadMessages(); const t = setInterval(loadMessages, 1500); return () => clearInterval(t); }, [loadMessages]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages.length]);

  /* ── Онлайн-статус собеседника ── */
  useEffect(() => {
    if (isGroup || !otherHash) return;
    let cancelled = false;
    const fetchOnline = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/online-status?hashes=${otherHash}`, { headers:{'x-session-token':getST()} });
        if (r.ok && !cancelled) { const {statuses}=await r.json(); setOnlineStatus(statuses[otherHash]??null); }
      } catch {}
    };
    fetchOnline();
    const t = setInterval(fetchOnline, 30000);
    return () => { cancelled=true; clearInterval(t); };
  }, [otherHash, isGroup]);

  const loadContacts = async () => {
    try {
      const r = await fetch(`${API_BASE}/api/contacts`, { headers: { 'x-session-token': getST() } });
      if (r.ok) { const { contacts: cs } = await r.json(); setContacts(cs ?? []); }
    } catch {}
  };

  const handleAddParticipant = async (addHash: string) => {
    setAdding(addHash);
    try {
      const r = await fetch(`${API_BASE}/api/conversations/${convId}/participants`, {
        method:'POST', headers:{ 'Content-Type':'application/json', 'x-session-token': getST() },
        body: JSON.stringify({ addHash }),
      });
      if (r.ok) {
        const data = await r.json();
        if (data.conversation) {
          setIsGroup(data.conversation.type === 'group');
          setGroupName(data.conversation.name ?? '');
          setParticipants(data.conversation.participants ?? []);
        }
        await loadMessages(); setShowAddModal(false);
      }
    } catch {}
    setAdding(null);
  };

  const handleLeaveGroup = async () => {
    if (!confirm(T.leave_chat)) return;
    try { await fetch(`${API_BASE}/api/conversations/${convId}/participants`, { method:'DELETE', headers:{ 'x-session-token': getST() } }); onBack(); } catch {}
  };

  const handleRenameGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const r = await fetch(`${API_BASE}/api/conversations/${convId}`, {
        method:'PATCH', headers:{ 'Content-Type':'application/json', 'x-session-token': getST() },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });
      if (r.ok) { setGroupName(newGroupName.trim()); setEditingName(false); }
    } catch {}
  };

  const handleSetBurnTimer = async (seconds: number) => {
    setBurnTimer(seconds);
    setShowBurnPicker(false);
    try {
      await fetch(`${API_BASE}/api/conversations/${convId}/burn-timer`, {
        method:'PATCH', headers:{ 'Content-Type':'application/json', 'x-session-token': getST() },
        body: JSON.stringify({ burnTimer: seconds }),
      });
    } catch {}
  };

  const sendMsg = async (content: string, type = 'text', mediaUrl?: string, mediaName?: string, dur?: number, rplId?: number) => {
    if (sending) return;
    if (isSecret && !e2eReady) return;
    setSending(true);
    try {
      let finalContent = content;
      if (isSecret && sharedKeyRef.current && type === 'text') {
        finalContent = await encryptMsg(content, sharedKeyRef.current);
      }
      const body: Record<string,unknown> = { content: finalContent, messageType: type };
      if (mediaUrl) body.mediaUrl = mediaUrl;
      if (mediaName) body.mediaName = mediaName;
      if (dur) body.duration = dur;
      if (rplId) body.replyToId = rplId;
      const r = await fetch(`${API_BASE}/api/conversations/${convId}/messages`, {
        method:'POST', headers:{ 'Content-Type':'application/json', 'x-session-token': getST() },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        const msg = await r.json();
        const displayMsg = isSecret ? { ...msg, content, replyTo: rplId ? messages.find(m=>m.id===rplId)||null : null } : msg;
        setMessages(p => [...p, displayMsg]);
        setReplyTarget(null);
      }
    } catch {}
    setSending(false);
  };

  const handleSend = async () => {
    const txt = input.trim(); if (!txt) return;
    if (editTarget) {
      /* Режим редактирования */
      try {
        const r = await fetch(`${API_BASE}/api/conversations/${convId}/messages/${editTarget.id}`, {
          method:'PATCH', headers:{ 'Content-Type':'application/json', 'x-session-token': getST() },
          body: JSON.stringify({ content: txt }),
        });
        if (r.ok) {
          const updated = await r.json();
          setMessages(p => p.map(m => m.id===editTarget.id ? {...m, content:updated.content, editedAt:updated.editedAt} : m));
        }
      } catch {}
      setEditTarget(null);
      setInput('');
      return;
    }
    setInput(''); await sendMsg(txt, 'text', undefined, undefined, undefined, replyTarget?.id);
  };

  const handleReaction = async (msgId: number, emoji: string) => {
    try {
      const r = await fetch(`${API_BASE}/api/conversations/${convId}/messages/${msgId}/reactions`, {
        method:'POST', headers:{ 'Content-Type':'application/json', 'x-session-token': getST() },
        body: JSON.stringify({ emoji }),
      });
      if (r.ok) {
        const { reactions } = await r.json();
        setMessages(p => p.map(m => m.id===msgId ? {...m, reactions} : m));
      }
    } catch {}
    setShowReactPicker(null);
  };

  const handleDeleteMsg = async (msg: MsgItem, forAll: boolean) => {
    try {
      await fetch(`${API_BASE}/api/conversations/${convId}/messages/${msg.id}`, {
        method:'DELETE', headers:{ 'Content-Type':'application/json', 'x-session-token': getST() },
        body: JSON.stringify({ deleteForAll: forAll }),
      });
      if (forAll) {
        setMessages(p => p.map(m => m.id===msg.id ? {...m, deletedForAll:true, content:'__deleted__'} : m));
      } else {
        setMessages(p => p.filter(m => m.id!==msg.id));
      }
    } catch {}
    setContextMenu(null);
  };

  const handleFile = async (file: File) => {
    if (file.size > 80 * 1024 * 1024) { alert('Файл слишком большой (максимум 80 МБ)'); return; }
    const isGif = file.type === 'image/gif';
    const type = isGif ? 'gif' : file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file';
    const shortName = file.name.length > 24 ? file.name.slice(0,22)+'…' : file.name;
    setUploadingFile(shortName);
    try {
      const url = await uploadToStorage(file);
      const body: Record<string,unknown> = { content: '', messageType: type, mediaUrl: url, mediaName: file.name };
      const r = await fetch(`${API_BASE}/api/conversations/${convId}/messages`, {
        method:'POST', headers:{ 'Content-Type':'application/json', 'x-session-token': getST() },
        body: JSON.stringify(body),
      });
      if (r.ok) { const msg = await r.json(); setMessages(p => [...p, msg]); }
    } catch (err) { alert(`Не удалось отправить файл. ${err instanceof Error ? err.message : ''}`); }
    finally { setUploadingFile(null); }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.start(); mediaRef.current = mr;
      setRecording(true); setRecSec(0);
      timerRef.current = setInterval(() => setRecSec(s => s+1), 1000);
    } catch {}
  };

  const stopRecording = async () => {
    if (!mediaRef.current) return;
    const mr = mediaRef.current; const dur = recSec;
    mediaRef.current = null;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false); setRecSec(0);
    await new Promise<void>(resolve => { mr.onstop = () => resolve(); mr.stop(); mr.stream.getTracks().forEach(t=>t.stop()); });
    await new Promise(r => setTimeout(r, 100));
    if (chunksRef.current.length === 0) return;
    const mimeType = mr.mimeType || 'audio/webm';
    const ext = mimeType.includes('ogg')?'ogg':mimeType.includes('mp4')?'mp4':'webm';
    const blob = new Blob(chunksRef.current, { type: mimeType });
    const file = new File([blob], `voice_${Date.now()}.${ext}`, { type: mimeType });
    chunksRef.current = [];
    setUploadingFile('голосовое…');
    try {
      const url = await uploadToStorage(file);
      const body = { content:'🎤 Голосовое сообщение', messageType:'audio', mediaUrl:url, mediaName:file.name, duration:dur };
      const r = await fetch(`${API_BASE}/api/conversations/${convId}/messages`, {
        method:'POST', headers:{ 'Content-Type':'application/json', 'x-session-token': getST() },
        body: JSON.stringify(body),
      });
      if (r.ok) { const msg = await r.json(); setMessages(p => [...p, msg]); }
    } catch { alert('Не удалось отправить голосовое.'); }
    finally { setUploadingFile(null); }
  };

  const cancelRecording = () => {
    if (mediaRef.current) { mediaRef.current.stop(); mediaRef.current.stream.getTracks().forEach(t=>t.stop()); mediaRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false); setRecSec(0);
  };

  useEffect(() => {
    if (videoOpen && vidPreviewRef.current && vidStreamRef.current) {
      vidPreviewRef.current.srcObject = vidStreamRef.current;
      vidPreviewRef.current.play().catch(() => {});
    }
  }, [videoOpen, videoTick]);

  const openVideoCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: camFacing, width:{ ideal:1280 }, height:{ ideal:960 } }, audio: true,
      });
      vidStreamRef.current = stream; setVideoOpen(true); setVideoTick(t=>t+1);
    } catch { alert('Нет доступа к камере.'); }
  };

  const closeVideoCamera = () => {
    vidStreamRef.current?.getTracks().forEach(t=>t.stop()); vidStreamRef.current = null;
    if (vidTimerRef.current) { clearInterval(vidTimerRef.current); vidTimerRef.current = null; }
    if (vidMediaRef.current) { try { vidMediaRef.current.stop(); } catch {} vidMediaRef.current = null; }
    vidChunksRef.current = []; setVideoOpen(false); setVideoRecording(false); setVideoSec(0);
  };

  const startVideoRec = () => {
    if (!vidStreamRef.current) return;
    const mime = ['video/mp4;codecs=avc1,mp4a.40.2','video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t))?? '';
    const opts = mime ? { mimeType:mime, videoBitsPerSecond:1_200_000, audioBitsPerSecond:64_000 } : {};
    const mr = new MediaRecorder(vidStreamRef.current, opts);
    vidChunksRef.current = [];
    mr.ondataavailable = e => { if (e.data.size>0) vidChunksRef.current.push(e.data); };
    mr.start(200); vidMediaRef.current = mr;
    setVideoRecording(true); setVideoSec(0);
    vidTimerRef.current = setInterval(() => setVideoSec(s=>s+1), 1000);
  };

  const stopVideoRec = async () => {
    if (!vidMediaRef.current) return;
    const mr = vidMediaRef.current; const dur = videoSec;
    vidMediaRef.current = null;
    if (vidTimerRef.current) { clearInterval(vidTimerRef.current); vidTimerRef.current = null; }
    setVideoRecording(false); setVideoSec(0); setVideoOpen(false);
    await new Promise<void>(resolve => { mr.onstop = ()=>resolve(); mr.stop(); });
    await new Promise(r => setTimeout(r, 300));
    vidStreamRef.current?.getTracks().forEach(t=>t.stop()); vidStreamRef.current = null;
    const chunks = [...vidChunksRef.current]; vidChunksRef.current = [];
    if (chunks.length === 0) { alert('Видео не записано. Разрешите доступ к камере.'); return; }
    const mimeType = mr.mimeType || 'video/webm';
    const ext = mimeType.includes('mp4')?'mp4':'webm';
    const blob = new Blob(chunks, { type:mimeType });
    const file = new File([blob], `video_${Date.now()}.${ext}`, { type:mimeType });
    setUploadingFile('видеосообщение…');
    try {
      const url = await uploadToStorage(file);
      const body = { content:`videoMessage:${videoFrame}`, messageType:'videoMessage', mediaUrl:url, mediaName:file.name, duration:dur };
      const r = await fetch(`${API_BASE}/api/conversations/${convId}/messages`, {
        method:'POST', headers:{ 'Content-Type':'application/json', 'x-session-token': getST() },
        body: JSON.stringify(body),
      });
      if (r.ok) { const msg = await r.json(); setMessages(p=>[...p,msg]); }
    } catch { alert('Не удалось отправить видеосообщение.'); }
    finally { setUploadingFile(null); }
  };

  const flipCamera = async () => {
    const nf = camFacing === 'environment' ? 'user' : 'environment';
    setCamFacing(nf); vidStreamRef.current?.getTracks().forEach(t=>t.stop());
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:nf }, audio:true });
      vidStreamRef.current = stream; setVideoTick(t=>t+1);
    } catch {}
  };

  const participantHashes = new Set(participants.map(p=>p.hash)); participantHashes.add(myHash);
  const availableContacts = contacts.filter(c => !participantHashes.has(c.hash));

  const FRAMES: { id: VFrame; label: string; name: string }[] = [
    { id:'filmstrip', label:'🎞', name:'Плёнка' },
    { id:'retrotv',   label:'📺', name:'Ретро' },
    { id:'camera',    label:'📷', name:'Камера' },
    { id:'camcorder', label:'📹', name:'VHS' },
    { id:'balloon',   label:'🎈', name:'Шар' },
  ];

  const recLabel = `${String(Math.floor(videoSec/60)).padStart(2,'0')}:${String(videoSec%60).padStart(2,'0')}`;

  const BURN_OPTIONS = [
    { label: 'Выкл', value: 0 },
    { label: '5 сек', value: 5 },
    { label: '30 сек', value: 30 },
    { label: '1 мин', value: 60 },
    { label: '1 час', value: 3600 },
    { label: '24 ч', value: 86400 },
  ];
  const burnLabel = BURN_OPTIONS.find(o => o.value === burnTimer)?.label ?? 'Выкл';

  return (
    <div style={{ position:'fixed', inset:0, background:C.bg, display:'flex', flexDirection:'column', zIndex:300 }}>
      <BackBtn onBack={onBack} accent={eff} />

      {/* E2E Banner */}
      {isSecret && (
        <div style={{ background: e2eError ? 'rgba(239,68,68,0.18)' : e2eReady ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)',
          borderBottom: `1px solid ${e2eError ? '#ef4444' : e2eReady ? '#22c55e' : '#eab308'}44`,
          padding:'5px 16px', fontSize:11, color: e2eError ? '#ef4444' : e2eReady ? '#22c55e' : '#eab308',
          fontFamily:'"Montserrat",sans-serif', fontWeight:700, display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          <span style={{ fontSize:13 }}>{e2eError ? '⚠️' : e2eReady ? '🔒' : '⏳'}</span>
          {e2eError || (e2eReady ? 'Сквозное шифрование активно — сообщения видны только вам и собеседнику' : 'Устанавливаем зашифрованное соединение…')}
        </div>
      )}

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px 10px 36px',
        background: isSecret ? 'rgba(5,10,8,0.97)' : 'rgba(10,12,20,0.95)', backdropFilter:'blur(16px)',
        borderBottom:`1px solid ${isSecret ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.07)'}`, flexShrink:0 }}>
        {isGroup ? (
          <div style={{ width:44, height:44, borderRadius:'50%', background:`linear-gradient(135deg,${eff}44,${eff}22)`,
            border:`2px solid ${eff}66`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>👥</div>
        ) : (
          <motion.div whileTap={{ scale:0.9 }} onClick={() => !isSecret && onViewProfile && onViewProfile(otherHash)}
            style={{ width:44, height:44, borderRadius:'50%', overflow:'hidden', border:`2px solid ${eff}`, flexShrink:0,
              cursor: (!isSecret && onViewProfile) ? 'pointer' : 'default' }}>
            <Avatar32 info={otherInfo} accent={eff} />
          </motion.div>
        )}
        <div style={{ flex:1, minWidth:0 }}>
          {editingName ? (
            <div style={{ display:'flex', gap:6 }}>
              <input value={newGroupName} onChange={e=>setNewGroupName(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter') handleRenameGroup(); if(e.key==='Escape') setEditingName(false); }}
                placeholder={T.group_name_ph}
                style={{ flex:1, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.2)',
                  borderRadius:8, padding:'4px 8px', color:'#fff', fontSize:13, outline:'none', fontFamily:'"Montserrat",sans-serif' }} autoFocus />
              <button onClick={handleRenameGroup} style={{ background:eff, border:'none', borderRadius:6,
                color:'#000', fontWeight:700, fontSize:12, padding:'4px 8px', cursor:'pointer' }}>✓</button>
            </div>
          ) : (
            <>
              <div style={{ fontWeight:800, fontSize:15, fontFamily:'"Montserrat",sans-serif', color:'#fff',
                overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                cursor: (isGroup || (!isSecret && onViewProfile)) ? 'pointer' : 'default', display:'flex', alignItems:'center', gap:4 }}
                onClick={() => { if(isGroup){setNewGroupName(groupName);setEditingName(true);} else if(!isSecret && onViewProfile){onViewProfile(otherHash);} }}>
                {isSecret && <span style={{ fontSize:14 }}>🔒</span>}
                {isGroup ? (groupName || 'Беседа') : otherInfo.name}
              </div>
              <div style={{ fontSize:11, fontFamily:'"Montserrat",sans-serif',
                color: isSecret ? secAccent : (onlineStatus?.online ? '#22c55e' : 'rgba(255,255,255,0.4)'),
                display:'flex', alignItems:'center', gap:4 }}>
                {isSecret ? 'Секретный чат' : isGroup ? `${participants.length} участников` : (
                  <>
                    {onlineStatus?.online && <span style={{ width:6, height:6, borderRadius:'50%', background:'#22c55e', display:'inline-block' }} />}
                    {onlineStatus
                      ? onlineStatus.online
                        ? 'в сети'
                        : onlineStatus.lastSeenAt
                          ? `был(а) ${fmtLastSeen(onlineStatus.lastSeenAt)}`
                          : 'давно не заходил(а)'
                      : 'SWAIP'}
                  </>
                )}
              </div>
            </>
          )}
        </div>
        {!isGroup && !isSecret && (
          <motion.button whileTap={{ scale:0.88 }} onClick={startBattle}
            style={{ background:'rgba(251,146,60,0.15)', border:'1px solid rgba(251,146,60,0.4)', borderRadius:'50%',
              width:36, height:36, cursor:'pointer', fontSize:17, display:'flex', alignItems:'center',
              justifyContent:'center', flexShrink:0 }} title="Swipe Battle ⚔️">⚔️</motion.button>
        )}
        {!isSecret && (
          <motion.button whileTap={{ scale:0.88 }} onClick={() => setShowGamePicker(true)}
            style={{ background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.4)', borderRadius:'50%',
              width:36, height:36, cursor:'pointer', fontSize:17, display:'flex', alignItems:'center',
              justifyContent:'center', flexShrink:0 }} title="Игры 🎮">🎮</motion.button>
        )}
        {!isGroup && !isSecret && call && (
          <>
            <motion.button whileTap={{ scale:0.88 }} onClick={() => call.startCall(otherHash,'audio')}
              disabled={call.callState !== 'idle'}
              style={{ background:'rgba(34,197,94,0.15)', border:'1px solid rgba(34,197,94,0.35)', borderRadius:'50%',
                width:36, height:36, cursor: call.callState!=='idle'?'not-allowed':'pointer', fontSize:18,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                opacity: call.callState!=='idle'?0.4:1 }} title={T.call_voice}>📞</motion.button>
            <motion.button whileTap={{ scale:0.88 }} onClick={() => call.startCall(otherHash,'video')}
              disabled={call.callState !== 'idle'}
              style={{ background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.35)', borderRadius:'50%',
                width:36, height:36, cursor: call.callState!=='idle'?'not-allowed':'pointer', fontSize:18,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                opacity: call.callState!=='idle'?0.4:1 }} title="Видеозвонок">🎥</motion.button>
          </>
        )}
        {isSecret && (
          <div style={{ position:'relative' }}>
            <motion.button whileTap={{ scale:0.88 }} onClick={() => setShowBurnPicker(s=>!s)}
              style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.35)', borderRadius:'50%',
                width:36, height:36, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center',
                justifyContent:'center', flexShrink:0, color:secAccent, fontWeight:800 }} title="Таймер сгорания">
              {burnTimer > 0 ? '⏱' : '🔥'}
            </motion.button>
            {showBurnPicker && (
              <div style={{ position:'absolute', top:40, right:0, background:'#0f1823', border:'1px solid rgba(34,197,94,0.3)',
                borderRadius:10, overflow:'hidden', zIndex:10, minWidth:110, boxShadow:'0 8px 24px rgba(0,0,0,0.7)' }}>
                <div style={{ fontSize:9, fontWeight:900, color:'rgba(255,255,255,0.3)', padding:'8px 12px 4px',
                  letterSpacing:2, textTransform:'uppercase', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
                  УДАЛЯТЬ ЧЕРЕЗ
                </div>
                {BURN_OPTIONS.map(opt => (
                  <div key={opt.value} onClick={() => handleSetBurnTimer(opt.value)}
                    style={{ padding:'8px 14px', cursor:'pointer', fontSize:13, fontFamily:'"Montserrat",sans-serif',
                      color: burnTimer === opt.value ? secAccent : '#fff',
                      background: burnTimer === opt.value ? 'rgba(34,197,94,0.1)' : 'transparent',
                      fontWeight: burnTimer === opt.value ? 800 : 400,
                      display:'flex', alignItems:'center', gap:8 }}>
                    <span>{burnTimer === opt.value ? '✓' : ' '}</span>{opt.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {!isSecret && (
        <motion.button whileTap={{ scale:0.88 }} onClick={() => { loadContacts(); setShowAddModal(true); }}
          style={{ background:`${eff}22`, border:`1px solid ${eff}44`, borderRadius:'50%',
            width:36, height:36, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center',
            justifyContent:'center', flexShrink:0, color:eff }}>👥</motion.button>
        )}
        {isGroup && (
          <motion.button whileTap={{ scale:0.88 }} onClick={() => setShowMembers(s=>!s)}
            style={{ background:'rgba(255,255,255,0.07)', border:'none', borderRadius:'50%', width:36, height:36,
              cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>ℹ️</motion.button>
        )}
      </div>

      {/* Members panel */}
      {showMembers && isGroup && (
        <div style={{ background:'rgba(10,12,20,0.98)', borderBottom:'1px solid rgba(255,255,255,0.07)',
          padding:'10px 14px', display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
          <div style={{ fontSize:10, fontWeight:900, color:'rgba(255,255,255,0.3)', letterSpacing:3, textTransform:'uppercase', marginBottom:4 }}>
            {T.members_label.toUpperCase()}
          </div>
          {participants.map(p => (
            <div key={p.hash} style={{ display:'flex', alignItems:'center', gap:10 }}>
              <div style={{ width:32, height:32, borderRadius:'50%', overflow:'hidden', border:`1.5px solid ${accent}44`, flexShrink:0 }}>
                <Avatar32 info={p.info} accent={accent} />
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#fff' }}>{p.info.name}</div>
                {p.info.handle && <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)' }}>@{p.info.handle}</div>}
              </div>
              {p.hash === myHash && <div style={{ fontSize:10, color:accent, fontWeight:700 }}>{T.you_label}</div>}
            </div>
          ))}
          <motion.button whileTap={{ scale:0.95 }} onClick={handleLeaveGroup}
            style={{ marginTop:4, padding:'8px', borderRadius:8, border:'1px solid rgba(239,68,68,0.3)',
              background:'rgba(239,68,68,0.1)', color:'#ef4444', fontWeight:700, fontSize:12,
              cursor:'pointer', fontFamily:'"Montserrat",sans-serif' }}>
            {T.leave_chat_btn}
          </motion.button>
        </div>
      )}

      {/* Add participant modal */}
      <AnimatePresence>
        {showAddModal && (
          <div style={{ position:'absolute', inset:0, zIndex:1000, background:'rgba(0,0,0,0.7)',
            display:'flex', alignItems:'flex-end', backdropFilter:'blur(4px)' }}
            onClick={e => { if(e.target===e.currentTarget) setShowAddModal(false); }}>
            <motion.div initial={{ y:300 }} animate={{ y:0 }} exit={{ y:300 }}
              style={{ width:'100%', background:'#0d1020', borderRadius:'24px 24px 0 0',
                padding:'20px 16px 32px', maxHeight:'70vh', display:'flex', flexDirection:'column',
                border:'1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display:'flex', alignItems:'center', marginBottom:16, gap:10 }}>
                <div style={{ fontSize:18, fontWeight:900, color:'#fff', flex:1, fontFamily:'"Montserrat",sans-serif' }}>
                  {isGroup ? '➕ Добавить участника' : '👥 Создать беседу'}
                </div>
                <button onClick={() => setShowAddModal(false)}
                  style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', cursor:'pointer', fontSize:22 }}>✕</button>
              </div>
              <div style={{ flex:1, overflowY:'auto' }}>
                {availableContacts.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'32px 0', color:'rgba(255,255,255,0.35)', fontSize:13, fontFamily:'"Montserrat",sans-serif' }}>
                    <div style={{ fontSize:36, marginBottom:8 }}>🤷</div>Нет доступных контактов<br/>
                    <span style={{ fontSize:11 }}>{T.follow_to_add}</span>
                  </div>
                ) : availableContacts.map(c => (
                  <div key={c.hash} style={{ display:'flex', alignItems:'center', gap:12,
                    padding:'10px 0', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ width:44, height:44, borderRadius:'50%', overflow:'hidden', border:`1.5px solid ${accent}44`, flexShrink:0 }}>
                      <Avatar32 info={c.info} accent={accent} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>{c.info.name}</div>
                      {c.info.handle && <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)' }}>@{c.info.handle}</div>}
                    </div>
                    <motion.button whileTap={{ scale:0.92 }} onClick={() => handleAddParticipant(c.hash)} disabled={adding===c.hash}
                      style={{ padding:'8px 16px', borderRadius:100,
                        background: adding===c.hash ? 'rgba(255,255,255,0.1)' : `linear-gradient(135deg,${accent},${accent}bb)`,
                        border:'none', color: adding===c.hash ? 'rgba(255,255,255,0.5)' : '#000',
                        fontWeight:900, fontSize:13, cursor:'pointer', fontFamily:'"Montserrat",sans-serif', flexShrink:0 }}>
                      {adding===c.hash ? '…' : '+ Добавить'}
                    </motion.button>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'16px 12px', display:'flex', flexDirection:'column', gap:4 }}>
        {messages.length === 0 && (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, padding:40, opacity:0.6 }}>
            <div style={{ fontSize:48 }}>💬</div>
            <div style={{ fontSize:15, color:'rgba(255,255,255,0.5)', textAlign:'center', fontFamily:'"Montserrat",sans-serif' }}>
              Здесь пока ничего нет…<br/><span style={{ fontSize:12 }}>Отправьте первое сообщение</span>
            </div>
          </div>
        )}
        {messages.map((m, i) => {
          const isMe = m.senderHash === myHash;
          const isSystem = m.messageType === 'system' || m.senderHash === '__system__';
          const showDate = i===0 || new Date(m.createdAt).toDateString() !== new Date(messages[i-1].createdAt).toDateString();
          const showSenderName = isGroup && !isMe && !isSystem;
          const prevM = i > 0 ? messages[i-1] : null;
          const isSameAuthorAsPrev = prevM && prevM.senderHash === m.senderHash;
          const isDeleted = m.deletedForAll;
          const reactions = m.reactions ?? {};
          const hasReactions = Object.keys(reactions).length > 0;
          let pressTimer: ReturnType<typeof setTimeout>;
          const onPressStart = (e: React.TouchEvent | React.MouseEvent) => {
            if (isSystem || isDeleted) return;
            pressTimer = setTimeout(() => {
              const rect = (e.target as HTMLElement).getBoundingClientRect();
              setContextMenu({ msg: m, x: rect.left, y: rect.top });
              setShowReactPicker(null);
            }, 500);
          };
          const onPressEnd = () => clearTimeout(pressTimer);
          return (
            <React.Fragment key={m.id}>
              {showDate && (
                <div style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,0.3)', margin:'8px 0', fontFamily:'"Montserrat",sans-serif' }}>
                  {new Date(m.createdAt).toLocaleDateString('ru',{day:'2-digit',month:'long'})}
                </div>
              )}
              {isSystem ? (
                <div style={{ textAlign:'center', fontSize:11, color:'rgba(255,255,255,0.35)', margin:'6px 0',
                  padding:'4px 12px', fontFamily:'"Montserrat",sans-serif' }}>— {m.content} —</div>
              ) : (
                <div
                  onTouchStart={isDeleted?undefined:e=>{
                    swipeTouchRef.current={x:e.touches[0].clientX,y:e.touches[0].clientY,locked:false};
                    setSwipeMsg(m.id); setSwipeDx(0);
                  }}
                  onTouchMove={isDeleted?undefined:e=>{
                    const s=swipeTouchRef.current; if(!s)return;
                    const dx=e.touches[0].clientX-s.x;
                    const dy=Math.abs(e.touches[0].clientY-s.y);
                    if(s.locked)return;
                    if(dy>20){swipeTouchRef.current=null;setSwipeMsg(null);setSwipeDx(0);return;}
                    if(dx>8){s.locked=true;}
                    if(s.locked&&dx>0){e.preventDefault();setSwipeDx(Math.min(dx,80));}
                  }}
                  onTouchEnd={isDeleted?undefined:()=>{
                    if(swipeDx>55&&swipeMsg===m.id){
                      setReplyTarget(m);
                      setTimeout(()=>inputRef.current?.focus(),50);
                    }
                    swipeTouchRef.current=null;
                    setSwipeMsg(null); setSwipeDx(0);
                  }}
                  style={{ display:'flex', flexDirection:isMe?'row-reverse':'row', gap:8, alignItems:'flex-end',
                    marginTop: showSenderName && !isSameAuthorAsPrev ? 8 : 2,
                    transform: swipeMsg===m.id&&swipeDx>0 ? `translateX(${isMe?-swipeDx:swipeDx}px)` : 'none',
                    transition: swipeDx===0 ? 'transform 0.2s ease' : 'none' }}>
                  {!isMe && (
                    <div
                      onClick={() => m.senderHash && onViewProfile && onViewProfile(m.senderHash)}
                      onTouchStart={e => {
                        if (e.touches.length >= 2 && !isGroup && !isSecret) {
                          e.preventDefault(); e.stopPropagation();
                          setSecretSwipeOpen(true);
                        }
                      }}
                      style={{ width:28, height:28, borderRadius:'50%', overflow:'hidden', flexShrink:0, marginBottom:2,
                        visibility: !isSameAuthorAsPrev ? 'visible' : 'hidden',
                        cursor: (m.senderHash && onViewProfile) ? 'pointer' : 'default' }}>
                      <Avatar32 info={m.author} accent={accent} />
                    </div>
                  )}
                  <div style={{ maxWidth:'72%', display:'flex', flexDirection:'column', alignItems:isMe?'flex-end':'flex-start' }}>
                    {showSenderName && !isSameAuthorAsPrev && (
                      <div onClick={() => m.senderHash && onViewProfile && onViewProfile(m.senderHash)}
                        style={{ fontSize:10, fontWeight:700, color:accent, marginBottom:2,
                          fontFamily:'"Montserrat",sans-serif', paddingLeft:2,
                          cursor: (m.senderHash && onViewProfile) ? 'pointer' : 'default' }}>
                        {m.author.name}
                      </div>
                    )}
                    {/* ── Цитата ответа ── */}
                    {m.replyTo && !isDeleted && (
                      <div style={{ borderLeft:`3px solid ${eff}`, paddingLeft:8, marginBottom:4,
                        background:'rgba(255,255,255,0.05)', borderRadius:'0 8px 8px 0',
                        padding:'4px 8px 4px 8px', maxWidth:'100%', marginLeft: isMe?0:0 }}>
                        <div style={{ fontSize:10, fontWeight:700, color:eff, fontFamily:'"Montserrat",sans-serif', marginBottom:1 }}>
                          {m.replyTo.author.name}
                        </div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', fontFamily:'"Montserrat",sans-serif',
                          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:200 }}>
                          {getReplyPreview(m.replyTo)}
                        </div>
                      </div>
                    )}
                    {/* secret_swipe timer badge */}
                    {m.messageType === 'secret_swipe' && m.burnAt && (
                      <div style={{ fontSize:9, fontWeight:800, color:'#a855f7', marginBottom:2, fontFamily:'"Montserrat",sans-serif',
                        display:'flex', alignItems:'center', gap:3 }}>
                        <span>🕵️</span>
                        <span>исчезнет через {msgTimers[m.id] ?? '...'}</span>
                      </div>
                    )}
                    <div
                      onMouseDown={onPressStart} onMouseUp={onPressEnd} onMouseLeave={onPressEnd}
                      onTouchStart={onPressStart} onTouchEnd={onPressEnd} onTouchCancel={onPressEnd}
                      style={{
                        background: isDeleted ? 'rgba(255,255,255,0.04)' : m.messageType==='secret_swipe' ? (isMe ? 'rgba(168,85,247,0.25)' : 'rgba(168,85,247,0.12)') : isMe ? eff : 'rgba(255,255,255,0.09)',
                        color: isDeleted ? 'rgba(255,255,255,0.3)' : m.messageType==='secret_swipe' ? '#e9d5ff' : isMe ? '#000' : '#fff',
                        borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        padding: (!isDeleted && (m.messageType==='image'||m.messageType==='videoMessage')) ? '4px' : '10px 14px',
                        maxWidth:'100%', wordBreak:'break-word',
                        border: isDeleted ? '1px solid rgba(255,255,255,0.06)' : m.messageType==='secret_swipe' ? '1px solid rgba(168,85,247,0.4)' : isMe ? 'none' : '1px solid rgba(255,255,255,0.08)',
                        cursor:'default', userSelect:'none',
                        fontStyle: isDeleted ? 'italic' : 'normal',
                      }}>
                      {isDeleted ? (
                        <span style={{ fontSize:13, fontFamily:'"Montserrat",sans-serif' }}>🗑 Сообщение удалено</span>
                      ) : (
                        <>
                          {m.messageType==='image' && m.mediaUrl && (
                            <img src={m.mediaUrl} alt="" style={{ maxWidth:220, maxHeight:300, borderRadius:14, display:'block' }} />
                          )}
                          {m.messageType==='gif' && m.mediaUrl && (
                            <img src={m.mediaUrl} alt="gif" style={{ maxWidth:220, borderRadius:14, display:'block' }} />
                          )}
                          {m.messageType==='video' && m.mediaUrl && (
                            <video src={m.mediaUrl} controls style={{ maxWidth:220, maxHeight:300, borderRadius:14, display:'block' }} />
                          )}
                          {m.messageType==='audio' && m.mediaUrl && (
                            <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:180 }}>
                              <span style={{ fontSize:24 }}>🎤</span>
                              <audio controls src={m.mediaUrl} style={{ height:36, flex:1 }} />
                              {m.duration && <span style={{ fontSize:11, opacity:0.7 }}>{m.duration}с</span>}
                            </div>
                          )}
                          {m.messageType==='videoMessage' && m.mediaUrl && (
                            <div style={{ position:'relative', display:'inline-block', borderRadius:18, overflow:'hidden',
                              width:148, boxShadow:'0 6px 28px rgba(0,0,0,0.55)', flexShrink:0 }}>
                              <video src={m.mediaUrl} controls playsInline
                                style={{ width:148, height:260, display:'block',
                                  objectFit:'cover' }} />
                              {/* SWAIP-полоска снизу */}
                              <div style={{ position:'absolute', bottom:0, left:0, right:0,
                                background:'linear-gradient(90deg,#6366f1,#a855f7,#06b6d4)',
                                height:28, display:'flex', alignItems:'center', justifyContent:'center',
                                gap:5, backdropFilter:'blur(4px)' }}>
                                <span style={{ fontSize:10, fontWeight:900, color:'#fff', letterSpacing:1.5,
                                  fontFamily:'"Montserrat",sans-serif', textShadow:'0 1px 4px rgba(0,0,0,0.4)' }}>SWAIP</span>
                                {m.duration && (
                                  <span style={{ fontSize:9, color:'rgba(255,255,255,0.75)',
                                    fontFamily:'"Montserrat",sans-serif', fontWeight:700 }}>
                                    · {String(Math.floor(m.duration/60)).padStart(2,'0')}:{String(m.duration%60).padStart(2,'0')}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                          {m.messageType==='file' && (
                            <a href={m.mediaUrl||'#'} target="_blank" rel="noopener noreferrer"
                              style={{ display:'flex', alignItems:'center', gap:10, color:'inherit', textDecoration:'none', minWidth:160 }}>
                              <span style={{ fontSize:28 }}>📎</span>
                              <div>
                                <div style={{ fontSize:13, fontWeight:700 }}>{m.mediaName || 'Файл'}</div>
                                <div style={{ fontSize:11, opacity:0.6 }}>Нажмите, чтобы открыть</div>
                              </div>
                            </a>
                          )}
                          {m.messageType==='bgmusic' && m.mediaUrl && (
                            <div style={{ minWidth:230, maxWidth:280 }}>
                              <BgMusicAutoplay url={m.mediaUrl} postId={`msg-${m.id}`}
                                label={m.mediaName || m.content || 'Фоновая музыка'} attach="parent"/>
                            </div>
                          )}
                          {(m.messageType==='text'||!m.messageType) && (
                            <span style={{ fontSize:14, fontFamily:'"Montserrat",sans-serif', lineHeight:1.5 }}>{m.content}</span>
                          )}
                        </>
                      )}
                    </div>
                    {/* ── Реакции ── */}
                    {hasReactions && !isDeleted && (
                      <div style={{ display:'flex', flexWrap:'wrap', gap:3, marginTop:3,
                        justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                        {Object.entries(reactions).map(([emoji, users]) => {
                          const iMine = users.includes(myHash);
                          return (
                            <motion.button key={emoji} whileTap={{ scale:0.85 }}
                              onClick={() => handleReaction(m.id, emoji)}
                              style={{ display:'flex', alignItems:'center', gap:3, padding:'2px 7px',
                                borderRadius:12, fontSize:13, cursor:'pointer', fontFamily:'"Montserrat",sans-serif',
                                background: iMine ? `${eff}33` : 'rgba(255,255,255,0.08)',
                                border: iMine ? `1px solid ${eff}66` : '1px solid rgba(255,255,255,0.12)',
                                color: iMine ? eff : 'rgba(255,255,255,0.7)' }}>
                              {emoji}<span style={{ fontSize:11 }}>{users.length}</span>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}
                    <div style={{ fontSize:10, color:'rgba(255,255,255,0.28)', marginTop:2, paddingInline:4,
                      display:'flex', alignItems:'center', gap:4 }}>
                      {m.editedAt && !isDeleted && <span style={{ opacity:0.7 }}>изм.</span>}
                      {formatMsgTime(m.createdAt)}
                    </div>
                    {/* ── Reaction picker (показывается под пузырём) ── */}
                    <AnimatePresence>
                      {showReactPicker === m.id && !isDeleted && (
                        <motion.div initial={{ scale:0.7, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.7, opacity:0 }}
                          style={{ position:'absolute', zIndex:300, background:'rgba(15,17,28,0.98)',
                            borderRadius:28, padding:'6px 10px', display:'flex', gap:2,
                            boxShadow:'0 8px 32px rgba(0,0,0,0.5)', border:'1px solid rgba(255,255,255,0.1)' }}>
                          {REACT_EMOJIS.map(e => (
                            <motion.button key={e} whileTap={{ scale:0.8 }}
                              onClick={() => handleReaction(m.id, e)}
                              style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', padding:'2px' }}>
                              {e}
                            </motion.button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Emoji picker */}
      <AnimatePresence>
        {showEmoji && (
          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
            style={{ overflow:'hidden', flexShrink:0 }}>
            <div style={{ padding:'10px 12px', background:'rgba(10,12,20,0.97)',
              borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', flexWrap:'wrap', gap:4 }}>
              {EMOJIS_CHAT.map(e => (
                <motion.button key={e} whileTap={{ scale:0.85 }}
                  onClick={() => { setInput(p=>p+e); setShowEmoji(false); inputRef.current?.focus(); }}
                  style={{ background:'none', border:'none', fontSize:24, cursor:'pointer', padding:'4px' }}>
                  {e}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Video recording overlay */}
      <AnimatePresence>
        {videoOpen && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.92)', zIndex:200,
              display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'16px' }}>
            <motion.div initial={{ scale:0.92, opacity:0 }} animate={{ scale:1, opacity:1 }}
              style={{ width:'100%', maxWidth:340, background:'rgba(15,17,28,0.98)',
                borderRadius:24, padding:'16px 16px 20px', border:'1px solid rgba(255,255,255,0.1)',
                display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <motion.button whileTap={{ scale:0.88 }} onClick={closeVideoCamera}
                  style={{ background:'rgba(255,255,255,0.08)', border:'none', borderRadius:'50%',
                    width:38, height:38, cursor:'pointer', fontSize:16, display:'flex', alignItems:'center',
                    justifyContent:'center', color:'#fff' }}>✕</motion.button>
                {videoRecording ? (
                  <div style={{ display:'flex', alignItems:'center', gap:7, background:'rgba(239,68,68,0.15)',
                    borderRadius:20, padding:'5px 12px', border:'1px solid rgba(239,68,68,0.4)' }}>
                    <motion.div animate={{ scale:[1,1.4,1] }} transition={{ repeat:Infinity, duration:0.75 }}
                      style={{ width:8, height:8, borderRadius:'50%', background:'#ef4444' }} />
                    <span style={{ color:'#ef4444', fontWeight:700, fontSize:13, fontFamily:'"Montserrat",sans-serif' }}>{recLabel}</span>
                  </div>
                ) : (
                  <span style={{ color:'rgba(255,255,255,0.65)', fontSize:13, fontFamily:'"Montserrat",sans-serif', fontWeight:600 }}>
                    {T.video_message}
                  </span>
                )}
                <motion.button whileTap={{ scale:0.88 }} onClick={flipCamera} disabled={videoRecording}
                  style={{ background:'rgba(255,255,255,0.08)', border:'none', borderRadius:'50%',
                    width:38, height:38, cursor: videoRecording?'not-allowed':'pointer', fontSize:18,
                    display:'flex', alignItems:'center', justifyContent:'center', opacity: videoRecording?0.4:1 }}>🔄</motion.button>
              </div>
              {!videoRecording && (
                <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                  {FRAMES.map(f => (
                    <motion.button key={f.id} whileTap={{ scale:0.88 }} onClick={() => setVideoFrame(f.id)}
                      style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3,
                        background: videoFrame===f.id ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.05)',
                        border: videoFrame===f.id ? '1.5px solid rgba(255,255,255,0.4)' : '1.5px solid rgba(255,255,255,0.1)',
                        borderRadius:12, padding:'6px 8px', cursor:'pointer', minWidth:48 }}>
                      <span style={{ fontSize:18 }}>{f.label}</span>
                      <span style={{ fontSize:9, color: videoFrame===f.id?'#fff':'rgba(255,255,255,0.4)',
                        fontFamily:'"Montserrat",sans-serif', fontWeight:600 }}>{f.name}</span>
                    </motion.button>
                  ))}
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'center' }}>
                <div style={{ width:160, height:284, borderRadius:22, overflow:'hidden', background:'#000', position:'relative',
                  border: videoRecording ? '3px solid #ef4444' : '3px solid rgba(255,255,255,0.18)',
                  boxShadow: videoRecording ? '0 0 0 5px rgba(239,68,68,0.28),0 8px 32px rgba(0,0,0,0.6)' : '0 8px 32px rgba(0,0,0,0.4)',
                  transition:'border-color 0.3s,box-shadow 0.3s' }}>
                  <video ref={vidPreviewRef} muted playsInline autoPlay
                    style={{ display:'block', width:'100%', height:'100%', objectFit:'cover',
                      transform: camFacing==='user' ? 'scaleX(-1)' : 'none' }} />
                  {/* Пульсирующая рамка при записи */}
                  {videoRecording && (
                    <motion.div animate={{ opacity:[0.35,0.9,0.35] }} transition={{ repeat:Infinity, duration:0.85 }}
                      style={{ position:'absolute', inset:0, border:'3px solid #ef4444', borderRadius:19, pointerEvents:'none' }} />
                  )}
                  {/* REC-бейдж */}
                  {videoRecording && (
                    <div style={{ position:'absolute', top:10, left:12, display:'flex', alignItems:'center', gap:5,
                      background:'rgba(0,0,0,0.55)', borderRadius:20, padding:'3px 8px', backdropFilter:'blur(4px)' }}>
                      <motion.div animate={{ opacity:[1,0.2,1] }} transition={{ repeat:Infinity, duration:0.9 }}
                        style={{ width:7, height:7, borderRadius:'50%', background:'#ef4444', flexShrink:0 }} />
                      <span style={{ fontSize:9, fontWeight:900, color:'#fff', letterSpacing:1, fontFamily:'"Montserrat",sans-serif' }}>REC</span>
                    </div>
                  )}
                  {/* SWAIP-полоска снизу */}
                  <div style={{ position:'absolute', bottom:0, left:0, right:0,
                    background:'linear-gradient(90deg,#6366f1,#a855f7,#06b6d4)',
                    height:26, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ fontSize:9, fontWeight:900, color:'#fff', letterSpacing:2,
                      fontFamily:'"Montserrat",sans-serif', textShadow:'0 1px 4px rgba(0,0,0,0.4)' }}>SWAIP</span>
                  </div>
                </div>
              </div>
              <div style={{ display:'flex', justifyContent:'center' }}>
                {videoRecording ? (
                  <motion.button whileTap={{ scale:0.9 }} onClick={stopVideoRec}
                    style={{ width:66, height:66, borderRadius:'50%', border:'4px solid #fff',
                      background:'#ef4444', cursor:'pointer', display:'flex', alignItems:'center',
                      justifyContent:'center', fontSize:24, boxShadow:'0 0 0 6px rgba(239,68,68,0.3)' }}>⬛</motion.button>
                ) : (
                  <motion.button whileTap={{ scale:0.9 }} onClick={startVideoRec}
                    style={{ width:66, height:66, borderRadius:'50%', border:'4px solid #fff',
                      background:'#ef4444', cursor:'pointer', display:'flex', alignItems:'center',
                      justifyContent:'center', boxShadow:'0 0 0 6px rgba(239,68,68,0.22)' }}>
                    <div style={{ width:26, height:26, borderRadius:'50%', background:'#fff' }} />
                  </motion.button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Context menu overlay ── */}
      <AnimatePresence>
        {contextMenu && (
          <div style={{ position:'fixed', inset:0, zIndex:500 }}
            onClick={() => setContextMenu(null)}>
            <motion.div initial={{ scale:0.85, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ scale:0.85, opacity:0 }}
              style={{ position:'absolute', background:'rgba(15,17,28,0.98)',
                borderRadius:16, padding:'6px 0', minWidth:190,
                boxShadow:'0 8px 40px rgba(0,0,0,0.6)', border:'1px solid rgba(255,255,255,0.1)',
                left: Math.min(contextMenu.x, window.innerWidth - 200),
                top: Math.min(contextMenu.y, window.innerHeight - 200),
              }}
              onClick={e => e.stopPropagation()}>
              {/* Быстрые реакции */}
              <div style={{ display:'flex', gap:4, padding:'8px 12px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
                {REACT_EMOJIS.slice(0,7).map(e => (
                  <motion.button key={e} whileTap={{ scale:0.8 }}
                    onClick={() => { handleReaction(contextMenu.msg.id, e); setContextMenu(null); }}
                    style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', padding:0 }}>{e}</motion.button>
                ))}
              </div>
              {/* Ответить */}
              <button onClick={() => { setReplyTarget(contextMenu.msg); setContextMenu(null); setTimeout(()=>inputRef.current?.focus(),50); }}
                style={{ width:'100%', background:'none', border:'none', padding:'10px 16px', color:'#fff', fontSize:14,
                  fontFamily:'"Montserrat",sans-serif', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:10 }}>
                ↩️ Ответить
              </button>
              {/* Редактировать — только своё текстовое */}
              {contextMenu.msg.senderHash === myHash && contextMenu.msg.messageType === 'text' && !isSecret && (
                <button onClick={() => { setEditTarget(contextMenu.msg); setInput(contextMenu.msg.content); setContextMenu(null); setTimeout(()=>inputRef.current?.focus(),50); }}
                  style={{ width:'100%', background:'none', border:'none', padding:'10px 16px', color:'#fff', fontSize:14,
                    fontFamily:'"Montserrat",sans-serif', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:10 }}>
                  ✏️ Редактировать
                </button>
              )}
              {/* Удалить у меня */}
              {contextMenu.msg.senderHash === myHash && (
                <button onClick={() => handleDeleteMsg(contextMenu.msg, false)}
                  style={{ width:'100%', background:'none', border:'none', padding:'10px 16px', color:'#ef4444', fontSize:14,
                    fontFamily:'"Montserrat",sans-serif', cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:10 }}>
                  🗑 Удалить у меня
                </button>
              )}
              {/* Удалить у всех — только своё */}
              {contextMenu.msg.senderHash === myHash && (
                <button onClick={() => handleDeleteMsg(contextMenu.msg, true)}
                  style={{ width:'100%', background:'none', border:'none', padding:'10px 16px', color:'#ef4444', fontSize:14,
                    fontFamily:'"Montserrat",sans-serif', fontWeight:700, cursor:'pointer', textAlign:'left', display:'flex', alignItems:'center', gap:10 }}>
                  🗑 Удалить у всех
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Reply / Edit bar ── */}
      <AnimatePresence>
        {(replyTarget || editTarget) && (
          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
            style={{ overflow:'hidden', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'6px 12px',
              background:'rgba(10,12,20,0.97)', borderTop:`1px solid ${eff}33` }}>
              <div style={{ width:3, height:'100%', minHeight:28, borderRadius:2, background:eff, flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:700, color:eff, fontFamily:'"Montserrat",sans-serif' }}>
                  {editTarget ? '✏️ Редактирование' : `↩️ ${replyTarget!.author.name}`}
                </div>
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', fontFamily:'"Montserrat",sans-serif',
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                  {editTarget ? editTarget.content : getReplyPreview(replyTarget! as ReplyInfo)}
                </div>
              </div>
              <button onClick={() => { setReplyTarget(null); setEditTarget(null); setInput(''); }}
                style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:'50%', width:24, height:24,
                  cursor:'pointer', color:'rgba(255,255,255,0.6)', fontSize:14, display:'flex', alignItems:'center',
                  justifyContent:'center', flexShrink:0 }}>✕</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload indicator */}
      {uploadingFile && (
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 16px',
          background:'rgba(10,12,20,0.97)', borderTop:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
          <motion.div animate={{ rotate:360 }} transition={{ repeat:Infinity, duration:0.9, ease:'linear' }}
            style={{ width:16, height:16, borderRadius:'50%', border:`2px solid ${accent}`, borderTopColor:'transparent', flexShrink:0 }} />
          <span style={{ fontSize:13, color:'rgba(255,255,255,0.7)', fontFamily:'"Montserrat",sans-serif',
            overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>
            Загрузка: {uploadingFile}
          </span>
        </div>
      )}

      {/* Input bar */}
      {recording ? (
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px',
          paddingBottom:'calc(12px + env(safe-area-inset-bottom,0px))',
          background:'rgba(10,12,20,0.97)', borderTop:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
          <motion.button whileTap={{ scale:0.88 }} onClick={cancelRecording}
            style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:'50%',
              width:44, height:44, cursor:'pointer', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center' }}>🗑</motion.button>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:10 }}>
            <motion.div animate={{ scale:[1,1.2,1] }} transition={{ repeat:Infinity, duration:0.8 }}
              style={{ width:10, height:10, borderRadius:'50%', background:'#ef4444' }} />
            <span style={{ color:'#ef4444', fontFamily:'"Montserrat",sans-serif', fontWeight:700, fontSize:14 }}>
              {String(Math.floor(recSec/60)).padStart(2,'0')}:{String(recSec%60).padStart(2,'0')}
            </span>
            <span style={{ fontSize:12, color:'rgba(255,255,255,0.4)' }}>{T.recording}</span>
          </div>
          <motion.button whileTap={{ scale:0.88 }} onClick={stopRecording}
            style={{ background:accent, border:'none', borderRadius:'50%', width:44, height:44,
              cursor:'pointer', fontSize:20, display:'flex', alignItems:'center', justifyContent:'center' }}>✅</motion.button>
        </div>
      ) : (
        <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 10px',
          paddingBottom:'calc(8px + env(safe-area-inset-bottom,0px))',
          background:'rgba(10,12,20,0.97)', borderTop:'1px solid rgba(255,255,255,0.07)',
          flexShrink:0, boxSizing:'border-box', width:'100%' }}>
          <motion.button whileTap={{ scale:0.88 }} onClick={() => setShowEmoji(s=>!s)}
            style={{ background:'rgba(255,255,255,0.07)', border:'none', borderRadius:'50%', width:36, height:36,
              cursor:'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>😊</motion.button>
          {!isSecret && (
            <motion.button whileTap={{ scale:0.88 }} onClick={() => setShowBgMusicPicker(true)} title="Фоновая музыка"
              style={{ background:'rgba(236,72,153,0.12)', border:'1.5px solid rgba(236,72,153,0.35)',
                borderRadius:'50%', width:36, height:36, cursor:'pointer', fontSize:16,
                display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>🎵</motion.button>
          )}
          <input ref={inputRef} value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e => { if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); handleSend(); } }}
            disabled={isSecret && !e2eReady && !e2eError}
            placeholder={isSecret ? (e2eReady ? '🔒 Зашифрованное сообщение…' : e2eError ? '⚠️ Ошибка шифрования' : '⏳ Ожидание соединения…') : T.message_ph}
            style={{ flex:1, minWidth:0, background: isSecret ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.08)',
              border: isSecret ? '1px solid rgba(34,197,94,0.2)' : '1px solid rgba(255,255,255,0.1)',
              borderRadius:20, padding:'9px 14px', color:'#fff', fontSize:14,
              fontFamily:'"Montserrat",sans-serif', outline:'none',
              opacity: (isSecret && !e2eReady) ? 0.5 : 1 }} />
          {!isSecret && (
            <>
              <label style={{ background:'rgba(255,255,255,0.07)', border:'none', borderRadius:'50%', width:36, height:36,
                cursor:'pointer', fontSize:17, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                📎
                <input type="file" style={{ display:'none' }} multiple
                  accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.gif"
                  onChange={e => { Array.from(e.target.files||[]).forEach(f=>handleFile(f)); e.target.value=''; }} />
              </label>
              {!input.trim() && (
                <>
                  <motion.button whileTap={{ scale:0.88 }} onClick={openVideoCamera}
                    style={{ background:'rgba(239,68,68,0.12)', border:'1.5px solid rgba(239,68,68,0.35)',
                      borderRadius:'50%', width:33, height:33, cursor:'pointer', fontSize:15,
                      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>🎥</motion.button>
                  <motion.button
                    onMouseDown={startRecording} onMouseUp={stopRecording}
                    onTouchStart={startRecording} onTouchEnd={stopRecording}
                    whileTap={{ scale:0.88 }}
                    style={{ background:'rgba(59,130,246,0.15)', border:'1.5px solid rgba(59,130,246,0.4)',
                      borderRadius:'50%', width:33, height:33, cursor:'pointer', fontSize:15,
                      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>🎙</motion.button>
                  <motion.button whileTap={{ scale:0.88 }}
                    title="Отправить приглашение в Круг"
                    onClick={() => {
                      const link = `${window.location.origin}/${myHash}/krug`;
                      setInput(`Приглашаю тебя в мой Круг на SWAIP: ${link}`);
                      setTimeout(() => inputRef.current?.focus(), 50);
                    }}
                    style={{ background:'rgba(201,152,58,0.15)', border:'1.5px solid rgba(201,152,58,0.4)',
                      borderRadius:'50%', width:33, height:33, cursor:'pointer', fontSize:15,
                      display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>🔗</motion.button>
                </>
              )}
            </>
          )}
          <motion.button whileTap={{ scale:0.88 }} onClick={handleSend}
            disabled={sending || (isSecret && !e2eReady)}
            style={{
              background: (isSecret && e2eReady && input.trim()) ? secAccent : input.trim() ? eff : 'rgba(255,255,255,0.12)',
              border: input.trim() ? 'none' : '1.5px solid rgba(255,255,255,0.2)',
              borderRadius:'50%',
              width: input.trim() ? 40 : 36, height: input.trim() ? 40 : 36,
              cursor:(sending||(isSecret&&!e2eReady))?'not-allowed':'pointer', fontSize:18, display:'flex', alignItems:'center', justifyContent:'center',
              flexShrink:0, opacity: (sending||(isSecret&&!e2eReady)) ? 0.4 : 1, transition:'background 0.2s,width 0.15s,height 0.15s',
            }}>➤</motion.button>
        </div>
      )}

      {/* ══ Secret Swipe Sheet ══ */}
      <AnimatePresence>
        {secretSwipeOpen && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.7)', zIndex:50, display:'flex', alignItems:'flex-end' }}
            onClick={e=>{ if(e.target===e.currentTarget) setSecretSwipeOpen(false); }}>
            <motion.div initial={{ y: 200 }} animate={{ y:0 }} exit={{ y:200 }} transition={{ type:'spring', stiffness:280, damping:28 }}
              style={{ width:'100%', background:'#0f0a1a', borderRadius:'24px 24px 0 0', padding:'20px 20px 36px',
                border:'1px solid rgba(168,85,247,0.3)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16 }}>
                <div style={{ width:38, height:38, borderRadius:'50%', background:'rgba(168,85,247,0.15)',
                  border:'1.5px solid rgba(168,85,247,0.4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🕵️</div>
                <div>
                  <div style={{ fontSize:14, fontWeight:900, color:'#e9d5ff', fontFamily:'"Montserrat",sans-serif' }}>Секретный свайп</div>
                  <div style={{ fontSize:10, color:'rgba(168,85,247,0.7)', fontWeight:600 }}>Только для {otherInfo.name} · Удалится через 24ч</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
                <textarea value={secretSwipeText} onChange={e=>setSecretSwipeText(e.target.value)}
                  placeholder={`Секретное сообщение для ${otherInfo.name}…`}
                  maxLength={500}
                  rows={3}
                  style={{ flex:1, background:'rgba(168,85,247,0.07)', border:'1.5px solid rgba(168,85,247,0.3)',
                    borderRadius:12, padding:'10px 12px', color:'#e9d5ff', fontSize:14, resize:'none',
                    outline:'none', fontFamily:'"Montserrat",sans-serif', lineHeight:1.5 }} autoFocus />
                <motion.button whileTap={{ scale:0.88 }} onClick={sendSecretSwipe} disabled={!secretSwipeText.trim()||secretSwipeSending}
                  style={{ width:44, height:44, borderRadius:'50%', background: secretSwipeText.trim() ? '#7c3aed' : 'rgba(255,255,255,0.1)',
                    border:'none', cursor: secretSwipeText.trim() ? 'pointer' : 'default', fontSize:18,
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                    opacity: secretSwipeSending ? 0.5 : 1, transition:'background 0.2s' }}>
                  {secretSwipeSending ? '⌛' : '✈️'}
                </motion.button>
              </div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.25)', marginTop:8, fontFamily:'"Montserrat",sans-serif' }}>
                🕵️ Сообщение не сохраняется в истории и автоматически удалится через 24 часа
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Battle Overlay ══ */}
      <AnimatePresence>
        {battleData && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.92)', zIndex:60, display:'flex', flexDirection:'column',
              alignItems:'center', justifyContent:'center', padding:24 }}>

            {/* Ожидание принятия */}
            {battleData.status === 'pending' && battleData.myRole === 'challenger' && (
              <div style={{ textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
                <div style={{ fontSize:48 }}>⚔️</div>
                <div style={{ fontSize:18, fontWeight:900, color:'#fff', fontFamily:'"Montserrat",sans-serif' }}>Вызов отправлен!</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.5)' }}>Ждём, пока {otherInfo.name} примет вызов…</div>
                <motion.div animate={{ rotate:[0,10,-10,0] }} transition={{ repeat:Infinity, duration:1.2 }} style={{ fontSize:40 }}>⏳</motion.div>
                <motion.button whileTap={{ scale:0.95 }} onClick={closeBattle}
                  style={{ marginTop:8, padding:'10px 28px', borderRadius:12, border:'1px solid rgba(255,255,255,0.2)',
                    background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.6)', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'"Montserrat",sans-serif' }}>
                  Отменить
                </motion.button>
              </div>
            )}

            {/* Входящий вызов */}
            {battleData.status === 'pending' && battleData.myRole === 'opponent' && (
              <div style={{ textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
                <div style={{ fontSize:48 }}>⚔️</div>
                <div style={{ fontSize:18, fontWeight:900, color:'#fff', fontFamily:'"Montserrat",sans-serif' }}>{otherInfo.name} вызывает тебя!</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.5)' }}>Swipe Battle — кто быстрее свайпнет пост?</div>
                <div style={{ display:'flex', gap:12, marginTop:8 }}>
                  <motion.button whileTap={{ scale:0.92 }} onClick={() => battleId && acceptBattle(battleId)}
                    style={{ padding:'12px 32px', borderRadius:14, background:'linear-gradient(135deg,#f97316,#ef4444)',
                      border:'none', color:'#fff', fontWeight:900, fontSize:15, cursor:'pointer', fontFamily:'"Montserrat",sans-serif',
                      boxShadow:'0 4px 20px rgba(249,115,22,0.5)' }}>⚔️ Принять!</motion.button>
                  <motion.button whileTap={{ scale:0.92 }} onClick={async()=>{ battleId&&await fetch(`${API_BASE}/api/battle/${battleId}/decline`,{method:'POST',headers:{'x-session-token':getST()}}); closeBattle(); }}
                    style={{ padding:'12px 28px', borderRadius:14, border:'1px solid rgba(255,255,255,0.2)',
                      background:'rgba(255,255,255,0.07)', color:'rgba(255,255,255,0.6)', fontWeight:700, fontSize:15, cursor:'pointer', fontFamily:'"Montserrat",sans-serif' }}>
                    Отклонить
                  </motion.button>
                </div>
              </div>
            )}

            {/* Игра! */}
            {battleData.status === 'active' && (
              <div style={{ width:'100%', display:'flex', flexDirection:'column', alignItems:'center', gap:20 }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ fontSize:28 }}>⚔️</div>
                  <div style={{ fontSize:16, fontWeight:900, color:'#f97316', fontFamily:'"Montserrat",sans-serif' }}>SWIPE BATTLE</div>
                  <div style={{ fontSize:28 }}>⚔️</div>
                </div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.5)', fontFamily:'"Montserrat",sans-serif' }}>
                  Свайп вверх 👍 или вниз 👎 — кто быстрее?
                </div>
                {/* Таймер */}
                <div style={{ fontSize:36, fontWeight:900, color: battleCountdown <= 5 ? '#ef4444' : '#f97316',
                  fontFamily:'"Montserrat",sans-serif', transition:'color 0.3s' }}>{battleCountdown}</div>
                {/* Пост */}
                <div style={{ width:'100%', background:'rgba(255,255,255,0.06)', borderRadius:16,
                  border:'1px solid rgba(255,255,255,0.1)', padding:16, maxHeight:180, overflow:'hidden' }}>
                  {battleData.postImage && (
                    <img src={battleData.postImage} alt="" style={{ width:'100%', maxHeight:100, objectFit:'cover', borderRadius:10, marginBottom:8 }} />
                  )}
                  <div style={{ fontSize:14, color:'rgba(255,255,255,0.9)', fontFamily:'"Montserrat",sans-serif', lineHeight:1.5,
                    display:'-webkit-box', WebkitLineClamp:4, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
                    {battleData.postContent}
                  </div>
                </div>
                {/* Кнопки свайпа */}
                {!battleSwiped ? (
                  <div style={{ display:'flex', gap:20, width:'100%' }}>
                    <motion.button whileTap={{ scale:0.85, y:-8 }} onClick={()=>doSwipe('up')}
                      style={{ flex:1, height:64, borderRadius:18, background:'linear-gradient(135deg,#22c55e,#16a34a)',
                        border:'none', fontSize:28, cursor:'pointer', fontWeight:900,
                        boxShadow:'0 6px 24px rgba(34,197,94,0.4)' }}>👍</motion.button>
                    <motion.button whileTap={{ scale:0.85, y:8 }} onClick={()=>doSwipe('down')}
                      style={{ flex:1, height:64, borderRadius:18, background:'linear-gradient(135deg,#ef4444,#dc2626)',
                        border:'none', fontSize:28, cursor:'pointer', fontWeight:900,
                        boxShadow:'0 6px 24px rgba(239,68,68,0.4)' }}>👎</motion.button>
                  </div>
                ) : (
                  <div style={{ textAlign:'center', color:'rgba(255,255,255,0.5)', fontSize:14, fontFamily:'"Montserrat",sans-serif' }}>
                    ✅ Ты свайпнул! Ждём {otherInfo.name}…
                  </div>
                )}
              </div>
            )}

            {/* Declined */}
            {battleData.status === 'declined' && (
              <div style={{ textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
                <div style={{ fontSize:48 }}>😔</div>
                <div style={{ fontSize:17, fontWeight:900, color:'#fff', fontFamily:'"Montserrat",sans-serif' }}>{otherInfo.name} отклонил вызов</div>
                <motion.button whileTap={{ scale:0.95 }} onClick={closeBattle}
                  style={{ padding:'10px 28px', borderRadius:12, background:accent, border:'none', color:'#000', fontWeight:800, fontSize:14, cursor:'pointer', fontFamily:'"Montserrat",sans-serif' }}>
                  Закрыть
                </motion.button>
              </div>
            )}

            {/* Expired */}
            {battleData.status === 'expired' && (
              <div style={{ textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
                <div style={{ fontSize:48 }}>⏰</div>
                <div style={{ fontSize:17, fontWeight:900, color:'#fff', fontFamily:'"Montserrat",sans-serif' }}>Вызов истёк</div>
                <motion.button whileTap={{ scale:0.95 }} onClick={closeBattle}
                  style={{ padding:'10px 28px', borderRadius:12, background:accent, border:'none', color:'#000', fontWeight:800, fontSize:14, cursor:'pointer', fontFamily:'"Montserrat",sans-serif' }}>
                  Закрыть
                </motion.button>
              </div>
            )}

            {/* Результат */}
            {battleData.status === 'completed' && (
              <div style={{ textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:20 }}>
                <motion.div animate={{ scale:[1,1.15,1] }} transition={{ repeat:2, duration:0.4 }} style={{ fontSize:64 }}>
                  {battleData.winner === myHash ? '🏆' : '💀'}
                </motion.div>
                <div style={{ fontSize:22, fontWeight:900, fontFamily:'"Montserrat",sans-serif',
                  color: battleData.winner === myHash ? '#f97316' : '#ef4444' }}>
                  {battleData.winner === myHash ? 'ТЫ ПОБЕДИЛ!' : 'ТЫ ПРОИГРАЛ!'}
                </div>
                <div style={{ fontSize:14, color:'rgba(255,255,255,0.5)', fontFamily:'"Montserrat",sans-serif' }}>
                  {battleData.winner === myHash
                    ? `Ты свайпнул быстрее ${otherInfo.name} 🎉`
                    : `${otherInfo.name} оказался(ась) быстрее 😤`}
                </div>
                {battleData.winner === myHash && (
                  <div style={{ background:'rgba(249,115,22,0.15)', border:'1px solid rgba(249,115,22,0.4)',
                    borderRadius:12, padding:'10px 20px', display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:16 }}>⚔️</span>
                    <span style={{ fontSize:12, color:'#f97316', fontWeight:800, fontFamily:'"Montserrat",sans-serif' }}>
                      Ты получаешь значок чемпиона на 24 часа!
                    </span>
                  </div>
                )}
                <motion.button whileTap={{ scale:0.95 }} onClick={closeBattle}
                  style={{ marginTop:8, padding:'12px 36px', borderRadius:14, background:'linear-gradient(135deg,#f97316,#ef4444)',
                    border:'none', color:'#fff', fontWeight:900, fontSize:15, cursor:'pointer', fontFamily:'"Montserrat",sans-serif',
                    boxShadow:'0 4px 20px rgba(249,115,22,0.4)' }}>
                  Закрыть
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ Chat Games Panel ══ */}
      <AnimatePresence>
        {gameSession.game && (
          <GamePanel
            game={gameSession.game}
            myHash={myHash}
            otherName={isGroup ? (groupName || 'Группа') : otherInfo.name}
            onAccept={gameSession.accept}
            onDecline={gameSession.decline}
            onLeave={gameSession.leave}
            onMove={gameSession.move}
            onJoin={gameSession.joinGame}
            onStart={gameSession.startGame}
            isGroup={isGroup}
            accent={accent}
          />
        )}
      </AnimatePresence>

      {/* ══ Game Picker Modal ══ */}
      <AnimatePresence>
        {showGamePicker && (
          <GamePickerModal
            onSelect={type => gameSession.sendInvite(type, isGroup ? undefined : otherHash)}
            onClose={() => setShowGamePicker(false)}
            isGroup={isGroup}
            accent={accent}
          />
        )}
      </AnimatePresence>

      {/* Bg music picker для чата */}
      <AnimatePresence>
        {showBgMusicPicker && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={() => setShowBgMusicPicker(false)}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:300,
              display:'flex', alignItems:'flex-end', justifyContent:'center' }}>
            <motion.div initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
              transition={{ type:'spring', damping:30, stiffness:300 }}
              onClick={e => e.stopPropagation()}
              style={{ width:'100%', maxWidth:560, background:'#0e0e16', borderRadius:'24px 24px 0 0',
                padding:'18px 16px calc(20px + env(safe-area-inset-bottom,0px))',
                maxHeight:'80vh', overflowY:'auto', boxShadow:'0 -8px 40px rgba(0,0,0,0.6)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
                <span style={{ fontSize:20 }}>🎵</span>
                <p style={{ margin:0, fontSize:15, fontWeight:900, color:'#fff', flex:1,
                  fontFamily:'"Montserrat",sans-serif' }}>Фоновая музыка для чата</p>
                <button onClick={() => setShowBgMusicPicker(false)}
                  style={{ background:'rgba(255,255,255,0.08)', border:'none', borderRadius:'50%',
                    width:30, height:30, color:'#fff', fontSize:14, cursor:'pointer', lineHeight:1 }}>✕</button>
              </div>
              <p style={{ margin:'0 0 12px', fontSize:11.5, color:'rgba(255,255,255,0.55)',
                fontFamily:'"Montserrat",sans-serif', lineHeight:1.5 }}>
                Выбери дорожку — она отправится в чат и будет автоматически играть у всех при открытии переписки.
              </p>
              <BgMusicPicker selected={chatBgMusicSel} onChange={setChatBgMusicSel} />
              <div style={{ display:'flex', gap:8, marginTop:14 }}>
                <button onClick={() => { setChatBgMusicSel(null); setShowBgMusicPicker(false); }}
                  style={{ flex:1, padding:'12px', borderRadius:12, border:'1.5px solid rgba(255,255,255,0.15)',
                    background:'transparent', color:'#fff', fontSize:13, fontWeight:700,
                    fontFamily:'"Montserrat",sans-serif', cursor:'pointer' }}>Отмена</button>
                <motion.button whileTap={{ scale:0.97 }} disabled={!chatBgMusicSel}
                  onClick={() => {
                    if (!chatBgMusicSel) return;
                    sendMsg(`${chatBgMusicSel.emoji} ${chatBgMusicSel.label}`, 'bgmusic',
                      chatBgMusicSel.url, `${chatBgMusicSel.emoji} ${chatBgMusicSel.label}`);
                    setChatBgMusicSel(null);
                    setShowBgMusicPicker(false);
                  }}
                  style={{ flex:2, padding:'12px', borderRadius:12, border:'none',
                    background: chatBgMusicSel ? 'linear-gradient(135deg,#ec4899,#a855f7)' : 'rgba(255,255,255,0.08)',
                    color: chatBgMusicSel ? '#fff' : 'rgba(255,255,255,0.3)',
                    fontSize:13, fontWeight:900, fontFamily:'"Montserrat",sans-serif',
                    cursor: chatBgMusicSel ? 'pointer' : 'not-allowed' }}>
                  🎵 Отправить
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════
   MESSAGES SCREEN (Conversations List)
══════════════════════════════════════════════ */
export function MessagesScreen({ myHash, accent, onBack, openChatWith, openSecretChatWith, onViewProfile, onFindPeople, onOpenSearch }: {
  myHash: string; accent: string; onBack: () => void;
  openChatWith?: { hash: string; info: ConvUser };
  openSecretChatWith?: { hash: string; info: ConvUser };
  onViewProfile?: (hash: string) => void;
  onFindPeople?: () => void;
  onOpenSearch?: (tab: 'people'|'channels'|'groups') => void;
}) {
  type ChatTab = 'direct' | 'group' | 'broadcast' | 'secret';
  const [chatTab,        setChatTab]       = useState<ChatTab>('direct');
  const [conversations,  setConversations] = useState<ConvItem[]>([]);
  const [loading,        setLoading]       = useState(true);
  const [activeConv,     setActiveConv]    = useState<{ id:number; otherHash:string; otherInfo:ConvUser; isGroup:boolean; isBroadcast:boolean; isSecret:boolean; groupName:string|null; participants:GroupParticipant[] }|null>(null);
  const [showCreateGroup,setShowCreateGroup] = useState(false);
  const [newGroupName,   setNewGroupName]  = useState('');
  const [creatingGroup,  setCreatingGroup] = useState(false);
  const [showCreateBcast,setShowCreateBcast] = useState(false);
  const [newBcastName,   setNewBcastName]  = useState('');
  const [creatingBcast,  setCreatingBcast] = useState(false);

  const C = { bg:'#0a0c14' };

  const loadConversations = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/api/conversations`, { headers: { 'x-session-token': getST() } });
      if (r.ok) { const { conversations: cs } = await r.json(); setConversations(cs ?? []); }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (!openChatWith) return;
    const startChat = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/conversations`, {
          method:'POST', headers:{ 'Content-Type':'application/json', 'x-session-token': getST() },
          body: JSON.stringify({ otherHash: openChatWith.hash }),
        });
        if (r.ok) {
          const { conversation: cv } = await r.json();
          setActiveConv({ id:cv.id, otherHash:openChatWith.hash, otherInfo:openChatWith.info, isGroup:false, isBroadcast:false, isSecret:false, groupName:null, participants:[] });
        }
      } catch {}
    };
    startChat();
  }, [openChatWith?.hash]);

  /* Открыть секретный чат с конкретным пользователем */
  useEffect(() => {
    if (!openSecretChatWith) return;
    const startSecret = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/conversations`, {
          method:'POST', headers:{ 'Content-Type':'application/json', 'x-session-token': getST() },
          body: JSON.stringify({ otherHash: openSecretChatWith.hash, type: 'secret' }),
        });
        if (r.ok) {
          const { conversation: cv } = await r.json();
          setChatTab('secret');
          setActiveConv({ id:cv.id, otherHash:openSecretChatWith.hash, otherInfo:openSecretChatWith.info, isGroup:false, isBroadcast:false, isSecret:true, groupName:null, participants:[] });
        }
      } catch {}
    };
    startSecret();
  }, [openSecretChatWith?.hash]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    setCreatingGroup(true);
    try {
      const r = await fetch(`${API_BASE}/api/conversations`, {
        method:'POST', headers:{ 'Content-Type':'application/json', 'x-session-token': getST() },
        body: JSON.stringify({ type:'group', name: newGroupName.trim() }),
      });
      if (r.ok) {
        const { conversation: cv } = await r.json();
        setShowCreateGroup(false); setNewGroupName('');
        setActiveConv({ id:cv.id, otherHash:'', otherInfo:{name:'',avatar:'',handle:''}, isGroup:true, isBroadcast:false, isSecret:false, groupName:cv.name||newGroupName.trim(), participants:[] });
        loadConversations();
      }
    } catch {} finally { setCreatingGroup(false); }
  };

  const handleCreateBcast = async () => {
    if (!newBcastName.trim()) return;
    setCreatingBcast(true);
    try {
      const r = await fetch(`${API_BASE}/api/conversations`, {
        method:'POST', headers:{ 'Content-Type':'application/json', 'x-session-token': getST() },
        body: JSON.stringify({ type:'broadcast', name: newBcastName.trim() }),
      });
      if (r.ok) {
        const { conversation: cv } = await r.json();
        setShowCreateBcast(false); setNewBcastName('');
        setActiveConv({ id:cv.id, otherHash:'', otherInfo:{name:'',avatar:'',handle:''}, isGroup:true, isBroadcast:true, isSecret:false, groupName:cv.name||newBcastName.trim(), participants:[] });
        loadConversations();
      }
    } catch {} finally { setCreatingBcast(false); }
  };

  if (activeConv) return (
    <ChatScreen convId={activeConv.id} otherHash={activeConv.otherHash} otherInfo={activeConv.otherInfo}
      myHash={myHash} accent={accent}
      isGroup={activeConv.isGroup} groupName={activeConv.groupName} participants={activeConv.participants}
      isSecret={activeConv.isSecret}
      onBack={() => { setActiveConv(null); loadConversations(); }}
      onViewProfile={onViewProfile} />
  );

  /* фильтрация по вкладке */
  const filtered = conversations.filter(cv => {
    if (chatTab === 'direct') return cv.type === 'dm' || !cv.type;
    if (chatTab === 'group') return cv.type === 'group';
    if (chatTab === 'broadcast') return cv.type === 'broadcast';
    if (chatTab === 'secret') return cv.type === 'secret';
    return false;
  });

  const TAB_DEFS: { key: ChatTab; label: string; icon: string }[] = [
    { key:'direct',    label:'Личные',  icon:'💬' },
    { key:'group',     label:'Группы',  icon:'👥' },
    { key:'broadcast', label:'Эфиры',   icon:'📡' },
    { key:'secret',    label:'Секрет',  icon:'🔒' },
  ];

  return (
    <div style={{ position:'fixed', inset:0, background:C.bg, display:'flex', flexDirection:'column', zIndex:100 }}>
      <BackBtn onBack={onBack} accent={accent} />

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px 10px 36px',
        background:'rgba(10,12,20,0.97)', backdropFilter:'blur(16px)',
        borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
        <div style={{ flex:1 }}>
          <p style={{ margin:0, fontWeight:900, fontSize:18, fontFamily:'"Montserrat",sans-serif',
            background:`linear-gradient(90deg,${accent},${accent}88)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            {T.messages_header}
          </p>
          <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.35)', fontFamily:'"Montserrat",sans-serif' }}>
            {chatTab==='direct'?'Личные переписки':chatTab==='group'?'Групповые чаты':'Каналы и эфиры'}
          </p>
        </div>
        {/* кнопка создания */}
        {chatTab==='group' && (
          <motion.button whileTap={{ scale:0.9 }} onClick={() => setShowCreateGroup(true)}
            style={{ background:`${accent}22`, border:`1px solid ${accent}44`, borderRadius:'50%',
              width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center',
              cursor:'pointer', color:accent, fontSize:20, flexShrink:0 }}>＋</motion.button>
        )}
        {chatTab==='broadcast' && (
          <motion.button whileTap={{ scale:0.9 }} onClick={() => setShowCreateBcast(true)}
            style={{ background:`${accent}22`, border:`1px solid ${accent}44`, borderRadius:'50%',
              width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center',
              cursor:'pointer', color:accent, fontSize:20, flexShrink:0 }}>＋</motion.button>
        )}
      </div>

      {/* ── Вкладки ── */}
      <div style={{ display:'flex', gap:6, padding:'10px 12px 8px', background:'rgba(10,12,20,0.97)', flexShrink:0,
        borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
        {TAB_DEFS.map(tab => (
          <motion.button key={tab.key} whileTap={{ scale:0.93 }} onClick={() => setChatTab(tab.key)}
            style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:2,
              padding:'8px 4px', borderRadius:12, border:'none', cursor:'pointer',
              background: chatTab===tab.key ? `${accent}22` : 'rgba(255,255,255,0.04)',
              color: chatTab===tab.key ? accent : 'rgba(255,255,255,0.45)',
              fontFamily:'"Montserrat",sans-serif', transition:'all 0.18s',
              outline: chatTab===tab.key ? `1.5px solid ${accent}44` : '1.5px solid transparent' }}>
            <span style={{ fontSize:20 }}>{tab.icon}</span>
            <span style={{ fontSize:10, fontWeight:800, letterSpacing:0.5 }}>{tab.label}</span>
          </motion.button>
        ))}
      </div>

      {/* ── Список чатов ── */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {loading && (
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:200 }}>
            <div style={{ width:28, height:28, borderRadius:'50%', border:`3px solid ${accent}`, borderTopColor:'transparent',
              animation:'spin 0.8s linear infinite' }} />
          </div>
        )}

        {/* пустые состояния */}
        {!loading && filtered.length === 0 && chatTab === 'direct' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, padding:'60px 24px' }}>
            <div style={{ fontSize:52 }}>💬</div>
            <div style={{ fontSize:16, fontWeight:800, color:'#fff', textAlign:'center', fontFamily:'"Montserrat",sans-serif' }}>{T.no_chats}</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.45)', textAlign:'center', lineHeight:1.65, maxWidth:280, fontFamily:'"Montserrat",sans-serif' }}>{T.no_chats_hint}</div>
            <motion.button whileTap={{ scale:0.96 }} onClick={onFindPeople||onBack}
              style={{ padding:'12px 28px', borderRadius:100, border:'none', background:`linear-gradient(135deg,${accent},${accent}bb)`,
                color:'#000', fontWeight:900, fontSize:14, cursor:'pointer', fontFamily:'"Montserrat",sans-serif' }}>
              🔍 {T.go_to_search}
            </motion.button>
          </div>
        )}

        {!loading && filtered.length === 0 && chatTab === 'group' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, padding:'60px 24px' }}>
            <div style={{ fontSize:52 }}>👥</div>
            <div style={{ fontSize:16, fontWeight:800, color:'#fff', textAlign:'center', fontFamily:'"Montserrat",sans-serif' }}>Нет групп</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.45)', textAlign:'center', lineHeight:1.65, maxWidth:280, fontFamily:'"Montserrat",sans-serif' }}>Создайте беседу и пригласите друзей</div>
            <motion.button whileTap={{ scale:0.96 }} onClick={() => setShowCreateGroup(true)}
              style={{ padding:'12px 28px', borderRadius:100, border:'none', background:`linear-gradient(135deg,${accent},${accent}bb)`,
                color:'#000', fontWeight:900, fontSize:14, cursor:'pointer', fontFamily:'"Montserrat",sans-serif' }}>
              ＋ Создать группу
            </motion.button>
            <motion.button whileTap={{ scale:0.96 }} onClick={() => (onOpenSearch||onFindPeople) ? (onOpenSearch ? onOpenSearch('people') : onFindPeople!()) : onBack()}
              style={{ padding:'10px 24px', borderRadius:100, border:`1.5px solid ${accent}55`, background:'transparent',
                color:accent, fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'"Montserrat",sans-serif' }}>
              🔍 Найти людей
            </motion.button>
          </div>
        )}

        {!loading && filtered.length === 0 && chatTab === 'broadcast' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, padding:'60px 24px' }}>
            <div style={{ fontSize:52 }}>📡</div>
            <div style={{ fontSize:16, fontWeight:800, color:'#fff', textAlign:'center', fontFamily:'"Montserrat",sans-serif' }}>Нет каналов</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.45)', textAlign:'center', lineHeight:1.65, maxWidth:280, fontFamily:'"Montserrat",sans-serif' }}>Создайте канал — транслируйте эфиры своей аудитории</div>
            <motion.button whileTap={{ scale:0.96 }} onClick={() => setShowCreateBcast(true)}
              style={{ padding:'12px 28px', borderRadius:100, border:'none', background:`linear-gradient(135deg,${accent},${accent}bb)`,
                color:'#000', fontWeight:900, fontSize:14, cursor:'pointer', fontFamily:'"Montserrat",sans-serif' }}>
              📡 Создать канал
            </motion.button>
            <motion.button whileTap={{ scale:0.96 }} onClick={() => onOpenSearch ? onOpenSearch('channels') : (onFindPeople ? onFindPeople() : onBack())}
              style={{ padding:'10px 24px', borderRadius:100, border:`1.5px solid ${accent}55`, background:'transparent',
                color:accent, fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:'"Montserrat",sans-serif' }}>
              🔍 Найти каналы
            </motion.button>
          </div>
        )}

        {!loading && filtered.length === 0 && chatTab === 'secret' && (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, padding:'60px 24px' }}>
            <div style={{ fontSize:52 }}>🔒</div>
            <div style={{ fontSize:16, fontWeight:800, color:'#fff', textAlign:'center', fontFamily:'"Montserrat",sans-serif' }}>Нет секретных чатов</div>
            <div style={{ fontSize:13, color:'rgba(255,255,255,0.45)', textAlign:'center', lineHeight:1.65, maxWidth:280, fontFamily:'"Montserrat",sans-serif' }}>
              Секретные чаты имеют сквозное шифрование. Начните новый, найдя собеседника через поиск.
            </div>
            <motion.button whileTap={{ scale:0.96 }} onClick={() => onOpenSearch ? onOpenSearch('people') : (onFindPeople ? onFindPeople() : onBack())}
              style={{ padding:'12px 28px', borderRadius:100, border:'none', background:'linear-gradient(135deg,#22c55e,#16a34a)',
                color:'#fff', fontWeight:900, fontSize:14, cursor:'pointer', fontFamily:'"Montserrat",sans-serif' }}>
              🔍 Найти пользователя
            </motion.button>
          </div>
        )}

        {filtered.map(cv => {
          const isGroupConv  = cv.type === 'group';
          const isBcastConv  = cv.type === 'broadcast';
          const isSecretConv = cv.type === 'secret';
          const displayName  = (isGroupConv||isBcastConv) ? (cv.name || (isGroupConv?'Беседа':'Канал')) : cv.otherInfo.name;
          const subLabel     = isGroupConv ? `${cv.participants.length} участников` : isBcastConv ? `📡 Канал` : isSecretConv ? '🔒 Секретный чат' : (cv.otherInfo.handle ? `@${cv.otherInfo.handle}` : '');
          const avatarIcon   = isBcastConv ? '📡' : '👥';
          return (
            <motion.div key={cv.id} whileTap={{ scale:0.98 }}
              onClick={() => setActiveConv({ id:cv.id, otherHash:cv.otherHash, otherInfo:cv.otherInfo, isGroup:isGroupConv||isBcastConv, isBroadcast:isBcastConv, isSecret:cv.type==='secret', groupName:cv.name??null, participants:cv.participants })}
              style={{ display:'flex', alignItems:'center', gap:14, padding:'14px 16px',
                borderBottom:'1px solid rgba(255,255,255,0.05)', cursor:'pointer', position:'relative' }}>
              {(isGroupConv||isBcastConv) ? (
                <div style={{ width:54, height:54, borderRadius:isBcastConv?14:'50%', flexShrink:0,
                  background:`linear-gradient(135deg,${accent}44,${accent}18)`,
                  border:`2px solid ${accent}55`,
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:24 }}>{avatarIcon}</div>
              ) : isSecretConv ? (
                <div style={{ position:'relative', width:54, height:54, flexShrink:0 }}>
                  <div style={{ width:54, height:54, borderRadius:'50%', overflow:'hidden', border:'2px solid rgba(34,197,94,0.5)' }}>
                    <Avatar32 info={cv.otherInfo} accent="#22c55e" />
                  </div>
                  <div style={{ position:'absolute', bottom:0, right:0, width:18, height:18, borderRadius:'50%',
                    background:'#22c55e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10,
                    border:'2px solid #0a0c14' }}>🔒</div>
                </div>
              ) : (
                <div style={{ width:54, height:54, borderRadius:'50%', overflow:'hidden', flexShrink:0,
                  border:`2px solid ${accent}55` }}>
                  <Avatar32 info={cv.otherInfo} accent={accent} />
                </div>
              )}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:2 }}>
                  <span style={{ fontWeight:800, fontSize:15, color:'#fff', fontFamily:'"Montserrat",sans-serif',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'70%' }}>
                    {displayName}
                  </span>
                  <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)', flexShrink:0 }}>
                    {cv.lastMessage ? formatMsgTime(cv.lastMessage.createdAt) : ''}
                  </span>
                </div>
                {subLabel && (
                  <div style={{ fontSize:11, color:accent, fontFamily:'"Montserrat",sans-serif',
                    marginBottom:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {subLabel}
                  </div>
                )}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:13, color:'rgba(255,255,255,0.4)', overflow:'hidden',
                    textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, fontFamily:'"Montserrat",sans-serif' }}>
                    {getMsgPreview(cv.lastMessage)}
                  </span>
                  {cv.unreadCount > 0 && (
                    <div style={{ background:accent, borderRadius:'50%', minWidth:20, height:20, fontSize:11,
                      display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900,
                      color:'#000', padding:'0 5px', marginLeft:8, flexShrink:0 }}>
                      {cv.unreadCount}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Модал: Создать группу ── */}
      <AnimatePresence>
        {showCreateGroup && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.7)', zIndex:200,
              display:'flex', alignItems:'flex-end', backdropFilter:'blur(4px)' }}
            onClick={e => { if(e.target===e.currentTarget) setShowCreateGroup(false); }}>
            <motion.div initial={{ y:300 }} animate={{ y:0 }} exit={{ y:300 }}
              style={{ width:'100%', background:'#0d1020', borderRadius:'24px 24px 0 0',
                padding:'20px 16px 40px', border:'1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontWeight:900, fontSize:17, color:'#fff', marginBottom:16, fontFamily:'"Montserrat",sans-serif' }}>👥 Создать группу</div>
              <input value={newGroupName} onChange={e=>setNewGroupName(e.target.value)}
                placeholder="Название беседы…" autoFocus
                onKeyDown={e=>{ if(e.key==='Enter') handleCreateGroup(); }}
                style={{ width:'100%', background:'rgba(255,255,255,0.08)', border:`1px solid ${accent}44`,
                  borderRadius:12, padding:'12px 14px', color:'#fff', fontSize:15, outline:'none',
                  fontFamily:'"Montserrat",sans-serif', boxSizing:'border-box', marginBottom:14 }} />
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setShowCreateGroup(false)}
                  style={{ flex:1, padding:'12px', borderRadius:12, border:'1px solid rgba(255,255,255,0.15)',
                    background:'transparent', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontWeight:700, fontSize:14, fontFamily:'"Montserrat",sans-serif' }}>
                  Отмена
                </button>
                <motion.button whileTap={{ scale:0.96 }} onClick={handleCreateGroup} disabled={creatingGroup||!newGroupName.trim()}
                  style={{ flex:2, padding:'12px', borderRadius:12, border:'none',
                    background:`linear-gradient(135deg,${accent},${accent}aa)`,
                    color:'#000', fontWeight:900, fontSize:14, cursor:'pointer', fontFamily:'"Montserrat",sans-serif',
                    opacity: (!newGroupName.trim()||creatingGroup)?0.5:1 }}>
                  {creatingGroup?'Создаём…':'✓ Создать группу'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Модал: Создать канал/эфир ── */}
      <AnimatePresence>
        {showCreateBcast && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.7)', zIndex:200,
              display:'flex', alignItems:'flex-end', backdropFilter:'blur(4px)' }}
            onClick={e => { if(e.target===e.currentTarget) setShowCreateBcast(false); }}>
            <motion.div initial={{ y:300 }} animate={{ y:0 }} exit={{ y:300 }}
              style={{ width:'100%', background:'#0d1020', borderRadius:'24px 24px 0 0',
                padding:'20px 16px 40px', border:'1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ fontWeight:900, fontSize:17, color:'#fff', marginBottom:6, fontFamily:'"Montserrat",sans-serif' }}>📡 Создать канал</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:16, fontFamily:'"Montserrat",sans-serif' }}>Канал позволяет вещать сообщения вашей аудитории</div>
              <input value={newBcastName} onChange={e=>setNewBcastName(e.target.value)}
                placeholder="Название канала…" autoFocus
                onKeyDown={e=>{ if(e.key==='Enter') handleCreateBcast(); }}
                style={{ width:'100%', background:'rgba(255,255,255,0.08)', border:`1px solid ${accent}44`,
                  borderRadius:12, padding:'12px 14px', color:'#fff', fontSize:15, outline:'none',
                  fontFamily:'"Montserrat",sans-serif', boxSizing:'border-box', marginBottom:14 }} />
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setShowCreateBcast(false)}
                  style={{ flex:1, padding:'12px', borderRadius:12, border:'1px solid rgba(255,255,255,0.15)',
                    background:'transparent', color:'rgba(255,255,255,0.6)', cursor:'pointer', fontWeight:700, fontSize:14, fontFamily:'"Montserrat",sans-serif' }}>
                  Отмена
                </button>
                <motion.button whileTap={{ scale:0.96 }} onClick={handleCreateBcast} disabled={creatingBcast||!newBcastName.trim()}
                  style={{ flex:2, padding:'12px', borderRadius:12, border:'none',
                    background:`linear-gradient(135deg,${accent},${accent}aa)`,
                    color:'#000', fontWeight:900, fontSize:14, cursor:'pointer', fontFamily:'"Montserrat",sans-serif',
                    opacity: (!newBcastName.trim()||creatingBcast)?0.5:1 }}>
                  {creatingBcast?'Создаём…':'📡 Создать канал'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Хук для счётчика непрочитанных ── */
export function useUnreadCount(myHash: string): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!myHash) return;
    const check = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/conversations`, { headers: { 'x-session-token': getST() } });
        if (r.ok) {
          const { conversations: cs } = await r.json();
          setCount((cs ?? []).reduce((s: number, c: ConvItem) => s + (c.unreadCount || 0), 0));
        }
      } catch {}
    };
    check();
    const t = setInterval(check, 10000);
    return () => clearInterval(t);
  }, [myHash]);
  return count;
}
