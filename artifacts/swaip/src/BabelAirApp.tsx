import React, { useState, useRef, useCallback, useEffect } from 'react';

/* ─── Languages ─────────────────────────────────────────────── */
const LANGS = [
  { code:'ru', name:'Русский',    flag:'🇷🇺', voice:'alloy'   },
  { code:'en', name:'English',    flag:'🇬🇧', voice:'nova'    },
  { code:'zh', name:'中文',       flag:'🇨🇳', voice:'shimmer' },
  { code:'es', name:'Español',    flag:'🇪🇸', voice:'alloy'   },
  { code:'fr', name:'Français',   flag:'🇫🇷', voice:'fable'   },
  { code:'de', name:'Deutsch',    flag:'🇩🇪', voice:'onyx'    },
  { code:'ar', name:'العربية',    flag:'🇸🇦', voice:'echo'    },
  { code:'tr', name:'Türkçe',     flag:'🇹🇷', voice:'alloy'   },
  { code:'it', name:'Italiano',   flag:'🇮🇹', voice:'fable'   },
  { code:'ja', name:'日本語',     flag:'🇯🇵', voice:'shimmer' },
  { code:'ko', name:'한국어',     flag:'🇰🇷', voice:'nova'    },
  { code:'pt', name:'Português',  flag:'🇵🇹', voice:'alloy'   },
  { code:'uk', name:'Українська', flag:'🇺🇦', voice:'alloy'   },
];
const langOf = (code: string) => LANGS.find(l => l.code === code) ?? LANGS[0];

/* ─── Types ─────────────────────────────────────────────────── */
type Side = 'a' | 'b';
type Status = 'idle' | 'rec_a' | 'rec_b' | 'proc_a' | 'proc_b' | 'play_a' | 'play_b';
interface Msg { id: number; side: Side; original: string; translated: string; }

/* ─── SVG Illustrations ─────────────────────────────────────── */
const HeroIllustration = () => (
  <svg width="220" height="180" viewBox="0 0 220 180" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Glow */}
    <ellipse cx="110" cy="100" rx="90" ry="70" fill="url(#glow)" opacity="0.25"/>
    {/* Globe outline */}
    <circle cx="110" cy="90" r="46" stroke="#4f46e5" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6"/>
    <ellipse cx="110" cy="90" rx="22" ry="46" stroke="#4f46e5" strokeWidth="1" strokeDasharray="3 3" opacity="0.4"/>
    <line x1="64" y1="90" x2="156" y2="90" stroke="#4f46e5" strokeWidth="1" opacity="0.4"/>
    {/* Left person */}
    <circle cx="34" cy="55" r="12" fill="#4f46e5" opacity="0.9"/>
    <path d="M16 85 Q34 72 52 85" stroke="#4f46e5" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    {/* Right person */}
    <circle cx="186" cy="55" r="12" fill="#06b6d4" opacity="0.9"/>
    <path d="M168 85 Q186 72 204 85" stroke="#06b6d4" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
    {/* Sound waves left */}
    <path d="M55 65 Q75 55 95 65" stroke="#4f46e5" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7"/>
    <path d="M60 75 Q75 68 90 75" stroke="#4f46e5" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5"/>
    <path d="M65 85 Q75 80 85 85" stroke="#4f46e5" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.3"/>
    {/* Sound waves right */}
    <path d="M165 65 Q145 55 125 65" stroke="#06b6d4" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7"/>
    <path d="M160 75 Q145 68 130 75" stroke="#06b6d4" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.5"/>
    <path d="M155 85 Q145 80 135 85" stroke="#06b6d4" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.3"/>
    {/* Center arrows */}
    <path d="M98 84 L112 84" stroke="#a5b4fc" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M109 80 L113 84 L109 88" stroke="#a5b4fc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    <path d="M122 96 L108 96" stroke="#67e8f9" strokeWidth="1.5" strokeLinecap="round"/>
    <path d="M111 100 L107 96 L111 92" stroke="#67e8f9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
    {/* Title */}
    <text x="110" y="150" textAnchor="middle" fill="#c4b5fd" fontSize="22" fontWeight="800" fontFamily="system-ui">BabelAir</text>
    <text x="110" y="168" textAnchor="middle" fill="#6366f1" fontSize="10" fontFamily="system-ui">AI · Real-time Translation</text>
    <defs>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#6366f1"/>
        <stop offset="100%" stopColor="#06b6d4" stopOpacity="0"/>
      </radialGradient>
    </defs>
  </svg>
);

const WaveBar = ({ active, color }: { active: boolean; color: string }) => (
  <div style={{ display:'flex', alignItems:'center', gap:3, height:32 }}>
    {[0.4,0.7,1,0.85,0.6,0.9,0.5,0.75,1,0.6].map((h,i)=>(
      <div key={i} style={{
        width:3, borderRadius:2, background:color,
        height: active ? `${h*28}px` : '4px',
        transition:'height 0.15s ease',
        animation: active ? `wave 0.8s ease-in-out ${i*0.08}s infinite alternate` : 'none',
      }}/>
    ))}
    <style>{`@keyframes wave{from{transform:scaleY(0.3)}to{transform:scaleY(1)}}`}</style>
  </div>
);

/* ─── Main Component ─────────────────────────────────────────── */
export default function BabelAirApp({ onBack }: { onBack: () => void }) {
  const [langA, setLangA] = useState('ru');
  const [langB, setLangB] = useState('en');
  const [status, setStatus] = useState<Status>('idle');
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  const [langPicker, setLangPicker] = useState<null | Side>(null);
  const [stereo, setStereo] = useState(true);
  const [error, setError] = useState('');
  const [minutes, setMinutes] = useState(0);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const msgIdRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Timer when session is active
  useEffect(() => {
    if (started) {
      timerRef.current = setInterval(() => setMinutes(m => m + 1), 60000);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setMinutes(0);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [started]);

  // Auto-scroll messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const startRec = useCallback(async (side: Side) => {
    if (status !== 'idle') return;
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : 'audio/webm';
      const rec = new MediaRecorder(stream, { mimeType });
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        processAudio(side, new Blob(chunksRef.current, { type: mimeType }));
      };
      rec.start(200);
      mediaRef.current = rec;
      setStatus(side === 'a' ? 'rec_a' : 'rec_b');
    } catch {
      setError('Нет доступа к микрофону');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, langA, langB]);

  const stopRec = useCallback(() => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
      mediaRef.current = null;
    }
  }, []);

  const processAudio = async (side: Side, blob: Blob) => {
    const toLang = side === 'a' ? langB : langA;
    const voice = langOf(toLang).voice;
    setStatus(side === 'a' ? 'proc_a' : 'proc_b');
    try {
      const fd = new FormData();
      fd.append('audio', blob, 'audio.webm');
      fd.append('toLang', toLang);
      fd.append('voice', voice);
      const r = await fetch('/api/babelair/process', { method: 'POST', body: fd });
      if (!r.ok) throw new Error(`server error ${r.status}`);
      const { original, translated, audioBase64 } = await r.json() as {
        original: string; translated: string; audioBase64: string;
      };
      if (!original.trim()) { setStatus('idle'); return; }
      const id = ++msgIdRef.current;
      setMessages(m => [...m.slice(-19), { id, side, original, translated }]);
      if (audioBase64) {
        setStatus(side === 'a' ? 'play_a' : 'play_b');
        const raw = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
        const ctx = new AudioContext();
        const buf = await ctx.decodeAudioData(raw.buffer.slice(0));
        const src = ctx.createBufferSource();
        src.buffer = buf;
        if (stereo) {
          const pan = ctx.createStereoPanner();
          pan.pan.value = side === 'a' ? 1 : -1;
          src.connect(pan); pan.connect(ctx.destination);
        } else {
          src.connect(ctx.destination);
        }
        await new Promise<void>(res => { src.onended = () => res(); src.start(); });
        ctx.close();
      }
    } catch (e: unknown) {
      setError((e as Error).message || 'Ошибка обработки');
    } finally {
      setStatus('idle');
    }
  };

  const swapLangs = () => { setLangA(langB); setLangB(langA); };

  const isRecA = status === 'rec_a';
  const isRecB = status === 'rec_b';
  const isBusy = status !== 'idle';
  const isProcA = status === 'proc_a' || status === 'play_a';
  const isProcB = status === 'proc_b' || status === 'play_b';

  const statusLabel = {
    idle: started ? 'Готов · держите кнопку чтобы говорить' : '',
    rec_a: `🎤 ${langOf(langA).name}...`,
    rec_b: `🎤 ${langOf(langB).name}...`,
    proc_a: '⚙️ Перевожу...',
    proc_b: '⚙️ Перевожу...',
    play_a: `🔊 ${langOf(langB).name}`,
    play_b: `🔊 ${langOf(langA).name}`,
  }[status];

  /* ─── Person card ─────────────────────────────────────────── */
  const PersonCard = ({
    side, lang, color, accentBg, isRec, isProc, rotate,
  }: {
    side: Side; lang: string; color: string; accentBg: string;
    isRec: boolean; isProc: boolean; rotate: boolean;
  }) => {
    const lg = langOf(lang);
    return (
      <div style={{
        flex: 1, display:'flex', flexDirection:'column', alignItems:'center',
        justifyContent:'center', padding:'12px 16px', gap:10,
        transform: rotate ? 'rotate(180deg)' : 'none',
      }}>
        {/* Language selector */}
        <button
          onClick={() => !started && setLangPicker(side)}
          style={{
            display:'flex', alignItems:'center', gap:8, padding:'8px 18px',
            background: started ? 'rgba(255,255,255,0.04)' : accentBg,
            borderRadius:20, border:`1.5px solid ${started?'rgba(255,255,255,0.1)':color}`,
            cursor: started ? 'default' : 'pointer', color:'#fff', fontSize:14, fontWeight:700,
          }}>
          <span style={{ fontSize:22 }}>{lg.flag}</span>
          <span>{lg.name}</span>
          {!started && <span style={{ color, fontSize:11 }}>▼</span>}
        </button>

        {/* Record button */}
        <div
          onPointerDown={e => { e.preventDefault(); startRec(side); }}
          onPointerUp={stopRec}
          onPointerLeave={stopRec}
          onPointerCancel={stopRec}
          style={{
            width:88, height:88, borderRadius:'50%', cursor: isBusy && !isRec ? 'not-allowed' : 'pointer',
            background: isRec
              ? `radial-gradient(circle, ${color}, ${color}aa)`
              : isProc
              ? 'rgba(255,255,255,0.07)'
              : accentBg,
            border:`3px solid ${isRec ? color : isProc ? 'rgba(255,255,255,0.2)' : color+'66'}`,
            display:'flex', alignItems:'center', justifyContent:'center',
            transition:'all 0.18s', userSelect:'none', touchAction:'none',
            boxShadow: isRec ? `0 0 30px ${color}66, 0 0 60px ${color}33` : 'none',
            opacity: isBusy && !isRec && !isProc ? 0.35 : 1,
          }}>
          {isProc
            ? <div style={{ width:28, height:28, borderRadius:'50%', border:`3px solid ${color}`, borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }}/>
            : isRec
            ? <WaveBar active={isRec} color="#fff"/>
            : <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect x="10" y="4" width="12" height="18" rx="6" fill={color}/>
                <path d="M6 18a10 10 0 0020 0" stroke={color} strokeWidth="2.5" strokeLinecap="round" fill="none"/>
                <line x1="16" y1="28" x2="16" y2="32" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
                <line x1="11" y1="32" x2="21" y2="32" stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
          }
        </div>
        <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.35)', fontWeight:600, letterSpacing:0.5 }}>
          {isRec ? 'ОТПУСТИТЕ ЧТОБЫ ОТПРАВИТЬ' : isProc ? 'ОБРАБАТЫВАЮ...' : 'ДЕРЖИТЕ И ГОВОРИТЕ'}
        </p>
      </div>
    );
  };

  /* ─── Render ─────────────────────────────────────────────── */
  return (
    <div style={{
      position:'fixed', inset:0, background:'#08091a',
      display:'flex', flexDirection:'column', fontFamily:'system-ui,sans-serif',
      color:'#fff', overflow:'hidden',
    }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.06);opacity:0.85}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      `}</style>

      {/* ── Top bar ── */}
      <div style={{
        padding:'12px 16px', display:'flex', alignItems:'center',
        justifyContent:'space-between', borderBottom:'1px solid rgba(255,255,255,0.06)',
        background:'rgba(8,9,26,0.95)', backdropFilter:'blur(12px)', zIndex:10, flexShrink:0,
      }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:22, cursor:'pointer', padding:'4px 8px', lineHeight:1 }}>←</button>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div style={{
            width:30, height:30, borderRadius:8,
            background:'linear-gradient(135deg,#4f46e5,#06b6d4)',
            display:'flex', alignItems:'center', justifyContent:'center', fontSize:16,
          }}>🌐</div>
          <div>
            <div style={{ fontSize:16, fontWeight:800, color:'#fff', letterSpacing:0.5 }}>BabelAir</div>
            <div style={{ fontSize:9, color:'#6366f1', fontWeight:600 }}>AI Real-time Translator</div>
          </div>
        </div>
        <button onClick={() => setShowHelp(true)} style={{
          width:32, height:32, borderRadius:'50%', background:'rgba(99,102,241,0.15)',
          border:'1.5px solid rgba(99,102,241,0.3)', color:'#a5b4fc', fontSize:15,
          fontWeight:800, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
        }}>?</button>
      </div>

      {/* ── Main body ── */}
      {!started ? (
        /* ── IDLE / START SCREEN ── */
        <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'20px 24px', gap:24, overflow:'auto' }}>
          <HeroIllustration/>

          {/* Language pickers */}
          <div style={{ display:'flex', alignItems:'center', gap:12, width:'100%', maxWidth:340 }}>
            <button onClick={() => setLangPicker('a')} style={{
              flex:1, padding:'12px 8px', borderRadius:14,
              background:'rgba(79,70,229,0.15)', border:'1.5px solid rgba(79,70,229,0.4)',
              color:'#fff', cursor:'pointer', textAlign:'center',
            }}>
              <div style={{ fontSize:28 }}>{langOf(langA).flag}</div>
              <div style={{ fontSize:13, fontWeight:700, marginTop:4 }}>{langOf(langA).name}</div>
              <div style={{ fontSize:10, color:'#818cf8', marginTop:2 }}>Собеседник A</div>
            </button>

            <button onClick={swapLangs} style={{
              width:44, height:44, borderRadius:12, background:'rgba(255,255,255,0.06)',
              border:'1.5px solid rgba(255,255,255,0.1)', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0,
            }}>⇄</button>

            <button onClick={() => setLangPicker('b')} style={{
              flex:1, padding:'12px 8px', borderRadius:14,
              background:'rgba(6,182,212,0.15)', border:'1.5px solid rgba(6,182,212,0.4)',
              color:'#fff', cursor:'pointer', textAlign:'center',
            }}>
              <div style={{ fontSize:28 }}>{langOf(langB).flag}</div>
              <div style={{ fontSize:13, fontWeight:700, marginTop:4 }}>{langOf(langB).name}</div>
              <div style={{ fontSize:10, color:'#67e8f9', marginTop:2 }}>Собеседник B</div>
            </button>
          </div>

          {/* Stereo toggle */}
          <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(255,255,255,0.04)', borderRadius:12, padding:'10px 16px', width:'100%', maxWidth:340 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:700 }}>🎧 Стерео-режим</div>
              <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', marginTop:2 }}>A — левое ухо · B — правое ухо</div>
            </div>
            <div onClick={() => setStereo(!stereo)} style={{
              width:44, height:24, borderRadius:12, cursor:'pointer', flexShrink:0,
              background: stereo ? '#4f46e5' : 'rgba(255,255,255,0.1)',
              position:'relative', transition:'background 0.2s',
            }}>
              <div style={{
                position:'absolute', top:3, left: stereo ? 22 : 3,
                width:18, height:18, borderRadius:'50%', background:'#fff',
                transition:'left 0.2s',
              }}/>
            </div>
          </div>

          {/* Start button */}
          <button
            onClick={() => setStarted(true)}
            style={{
              width:'100%', maxWidth:340, padding:'18px', borderRadius:18,
              background:'linear-gradient(135deg,#4f46e5,#06b6d4)',
              border:'none', color:'#fff', fontSize:17, fontWeight:800,
              cursor:'pointer', letterSpacing:0.5,
              boxShadow:'0 8px 32px rgba(79,70,229,0.4)',
              animation:'pulse 2s ease-in-out infinite',
            }}>
            🚀 Начать сеанс перевода
          </button>
        </div>
      ) : (
        /* ── ACTIVE SESSION ── */
        <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
          {/* Person A (top, rotated) */}
          <div style={{
            background: isRecA ? 'rgba(79,70,229,0.12)' : isProcA ? 'rgba(79,70,229,0.07)' : 'rgba(255,255,255,0.02)',
            borderBottom:'1px solid rgba(255,255,255,0.06)',
            transition:'background 0.3s', flexShrink:0,
          }}>
            <PersonCard side="a" lang={langA} color="#818cf8" accentBg="rgba(79,70,229,0.18)" isRec={isRecA} isProc={isProcA} rotate={true}/>
          </div>

          {/* Middle: status + messages */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
            {/* Status bar */}
            <div style={{
              padding:'6px 16px', textAlign:'center', fontSize:11,
              color: isBusy ? '#a5b4fc' : 'rgba(255,255,255,0.3)',
              background:'rgba(8,9,26,0.8)', flexShrink:0,
              borderBottom:'1px solid rgba(255,255,255,0.05)',
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            }}>
              {isBusy && <div style={{ width:6, height:6, borderRadius:'50%', background:'#4f46e5', animation:'pulse 1s ease-in-out infinite' }}/>}
              <span>{statusLabel}</span>
              {started && !isBusy && <span style={{ marginLeft:'auto', color:'rgba(255,255,255,0.2)', fontSize:10 }}>{minutes}мин</span>}
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding:'8px 16px', background:'rgba(239,68,68,0.15)', borderBottom:'1px solid rgba(239,68,68,0.2)', fontSize:12, color:'#fca5a5', textAlign:'center' }}>
                ⚠️ {error}
                <button onClick={() => setError('')} style={{ marginLeft:8, background:'none', border:'none', color:'#fca5a5', cursor:'pointer', fontSize:11 }}>✕</button>
              </div>
            )}

            {/* Messages */}
            <div ref={scrollRef} style={{ flex:1, overflowY:'auto', padding:'8px 12px', display:'flex', flexDirection:'column', gap:8 }}>
              {messages.length === 0 ? (
                <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'rgba(255,255,255,0.2)', fontSize:12, gap:6 }}>
                  <span style={{ fontSize:32 }}>💬</span>
                  <span>Начните разговор — держите кнопку и говорите</span>
                </div>
              ) : (
                messages.map(m => (
                  <div key={m.id} style={{
                    animation:'fadeIn 0.25s ease',
                    alignSelf: m.side === 'a' ? 'flex-start' : 'flex-end',
                    maxWidth:'88%',
                  }}>
                    <div style={{
                      padding:'8px 12px', borderRadius: m.side === 'a' ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                      background: m.side === 'a' ? 'rgba(79,70,229,0.25)' : 'rgba(6,182,212,0.22)',
                      border: `1px solid ${m.side === 'a' ? 'rgba(99,102,241,0.3)' : 'rgba(6,182,212,0.3)'}`,
                    }}>
                      <div style={{ fontSize:11, color: m.side === 'a' ? '#a5b4fc' : '#67e8f9', marginBottom:3, display:'flex', alignItems:'center', gap:6 }}>
                        <span>{langOf(m.side === 'a' ? langA : langB).flag}</span>
                        <span style={{ opacity:0.7 }}>{m.original}</span>
                      </div>
                      <div style={{ fontSize:13, fontWeight:600, color:'#f9fafb' }}>
                        {langOf(m.side === 'a' ? langB : langA).flag} {m.translated}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Person B (bottom, normal) */}
          <div style={{
            background: isRecB ? 'rgba(6,182,212,0.12)' : isProcB ? 'rgba(6,182,212,0.07)' : 'rgba(255,255,255,0.02)',
            borderTop:'1px solid rgba(255,255,255,0.06)',
            transition:'background 0.3s', flexShrink:0,
          }}>
            <PersonCard side="b" lang={langB} color="#67e8f9" accentBg="rgba(6,182,212,0.18)" isRec={isRecB} isProc={isProcB} rotate={false}/>
          </div>

          {/* Stop session */}
          <button onClick={() => { setStarted(false); setMessages([]); setStatus('idle'); setError(''); }} style={{
            padding:'10px', background:'rgba(239,68,68,0.12)', border:'none', borderTop:'1px solid rgba(239,68,68,0.15)',
            color:'rgba(239,68,68,0.8)', fontSize:12, fontWeight:700, cursor:'pointer', letterSpacing:0.5, flexShrink:0,
          }}>
            ✕ Завершить сеанс
          </button>
        </div>
      )}

      {/* ── Language picker modal ── */}
      {langPicker !== null && (
        <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'flex-end' }}>
          <div style={{ width:'100%', background:'#111827', borderRadius:'20px 20px 0 0', padding:'20px 0 32px', maxHeight:'70vh', overflow:'auto' }}>
            <div style={{ textAlign:'center', fontSize:14, fontWeight:800, color:'#fff', marginBottom:16, paddingBottom:12, borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
              Выберите язык — Собеседник {langPicker === 'a' ? 'A' : 'B'}
            </div>
            {LANGS.map(l => (
              <button key={l.code} onClick={() => {
                if (langPicker === 'a') setLangA(l.code); else setLangB(l.code);
                setLangPicker(null);
              }} style={{
                width:'100%', padding:'13px 24px', background:(langPicker === 'a' ? langA : langB) === l.code ? 'rgba(99,102,241,0.18)' : 'none',
                border:'none', borderBottom:'1px solid rgba(255,255,255,0.05)',
                color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', gap:14, fontSize:15, textAlign:'left',
              }}>
                <span style={{ fontSize:26 }}>{l.flag}</span>
                <span style={{ fontWeight:600 }}>{l.name}</span>
                {(langPicker === 'a' ? langA : langB) === l.code && <span style={{ marginLeft:'auto', color:'#818cf8' }}>✓</span>}
              </button>
            ))}
            <button onClick={() => setLangPicker(null)} style={{ width:'100%', padding:'14px', background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', fontSize:14, marginTop:8 }}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* ── Help modal ── */}
      {showHelp && (
        <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
          <div style={{ background:'#111827', borderRadius:20, padding:'24px 20px', maxWidth:380, width:'100%', maxHeight:'85vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <div style={{ fontSize:18, fontWeight:800, color:'#fff' }}>🎧 Как пользоваться BabelAir</div>
              <button onClick={() => setShowHelp(false)} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:22, cursor:'pointer' }}>✕</button>
            </div>
            {[
              { n:'1', icon:'🌐', title:'Выберите языки', desc:'На главном экране выберите язык для каждого собеседника. Нажмите ⇄ чтобы поменять их местами.' },
              { n:'2', icon:'🎧', title:'Включите стерео', desc:'В стерео-режиме перевод для А звучит в левом ухе, для B — в правом. Идеально для наушников TWS.' },
              { n:'3', icon:'🚀', title:'Нажмите «Начать сеанс»', desc:'Откроется экран с двумя панелями — по одной для каждого собеседника.' },
              { n:'4', icon:'📱', title:'Положите телефон между вами', desc:'Верхняя панель (повёрнута) — для собеседника A, нижняя — для B.' },
              { n:'5', icon:'🎤', title:'Держите кнопку и говорите', desc:'Нажмите и удерживайте круглую кнопку пока говорите. Отпустите — система переведёт и озвучит.' },
              { n:'6', icon:'💬', title:'История переговоров', desc:'В центре экрана отображается история: оригинал + перевод каждой реплики.' },
            ].map(s => (
              <div key={s.n} style={{ display:'flex', gap:14, marginBottom:16 }}>
                <div style={{ width:36, height:36, borderRadius:10, background:'rgba(99,102,241,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>{s.icon}</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:'#fff', marginBottom:3 }}>{s.title}</div>
                  <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', lineHeight:1.5 }}>{s.desc}</div>
                </div>
              </div>
            ))}
            <div style={{ padding:'12px 16px', background:'rgba(79,70,229,0.15)', borderRadius:12, marginTop:8, fontSize:12, color:'#a5b4fc', lineHeight:1.6 }}>
              💡 <strong>Совет:</strong> Говорите чётко и завершайте фразу перед тем как отпустить кнопку. Система автоматически распознаёт ваш язык.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
