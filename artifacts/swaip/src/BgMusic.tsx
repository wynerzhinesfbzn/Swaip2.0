import React, { useEffect, useRef, useState } from 'react';
import bgMusSuspense   from '@assets/alban_gogh-quot-suspense-in-container-terminal-quot-sound-effe_1777229921746.mp3';
import bgMusDarkImpact from '@assets/zehendrew-dark-impact-sound-403094_1777229921821.mp3';
import bgMusBattle     from '@assets/alexis_gaming_cam-the-thing-battle-in-dow-334297_1777229921850.mp3';
import bgMusSinister1  from '@assets/fronbondi_skegs-sfx-up-to-no-good-sinister-cinematic-sound-eff_1777229921878.mp3';
import bgMusSinister2  from '@assets/fronbondi_skegs-sfx-up-to-no-good-sinister-cinematic-sound-eff_1777229921907.mp3';
import bgMusNeonInterr from '@assets/openmindaudio-crime-detective-neon-reflections-on-the-interrog_1777229921931.mp3';
import bgMusCrimeName  from '@assets/openmindaudio-true-crime-a-name-crossed-out-in-black-ink-short_1777229921961.mp3';
import bgMusOutlawAmb  from '@assets/fronbondi_skegs-amb-lonely-desolate-outlaw-remote-ambient-soun_1777229921988.mp3';
import bgMusBirdsForest from '@assets/u_thlvfy3fsc-birds-forrest-457845_1777229922015.mp3';
import bgMusFireflies  from '@assets/svetlychok--433987_1777229922043.mp3';
import bgMusRiverBirds from '@assets/baranova_n-river-birds-siskin-394210_1777229922072.mp3';
import bgMusCreek      from '@assets/mountaindweller-the-sound-of-a-small-creek-268778_1777229922098.mp3';
import bgMusStream     from '@assets/blendertimer-small-gentle-stream-loop-514373_1777229922125.mp3';
import bgMusRain       from '@assets/eryliaa-gentle-rain-for-relaxation-and-sleep-337279_1777229922150.mp3';

export type BgMusicPreset = { id:string; label:string; emoji:string; cat:string; url:string };

export const BG_MUSIC_PRESETS: BgMusicPreset[] = [
  {id:'suspense',  label:'Саспенс терминала',      emoji:'🎬', cat:'Кинематограф', url:bgMusSuspense},
  {id:'dark',      label:'Тёмный удар',            emoji:'🌑', cat:'Кинематограф', url:bgMusDarkImpact},
  {id:'battle',    label:'Битва в центре',         emoji:'⚔️', cat:'Кинематограф', url:bgMusBattle},
  {id:'sinister1', label:'Зловещий I',             emoji:'🕷️', cat:'Кинематограф', url:bgMusSinister1},
  {id:'sinister2', label:'Зловещий II',            emoji:'👻', cat:'Кинематограф', url:bgMusSinister2},
  {id:'neon',      label:'Неон в допросной',       emoji:'🚓', cat:'Детектив',     url:bgMusNeonInterr},
  {id:'crime',     label:'Имя, зачёркнутое чернилами', emoji:'🖋️', cat:'Детектив', url:bgMusCrimeName},
  {id:'outlaw',    label:'Заброшенная глушь',      emoji:'🏜️', cat:'Детектив',     url:bgMusOutlawAmb},
  {id:'birds',     label:'Лесные птицы',           emoji:'🐦', cat:'Природа',      url:bgMusBirdsForest},
  {id:'fireflies', label:'Светлячки',              emoji:'✨', cat:'Природа',      url:bgMusFireflies},
  {id:'river',     label:'Птицы у реки',           emoji:'🐤', cat:'Природа',      url:bgMusRiverBirds},
  {id:'creek',     label:'Маленький ручей',        emoji:'💧', cat:'Природа',      url:bgMusCreek},
  {id:'stream',    label:'Тихий поток (loop)',     emoji:'🌊', cat:'Природа',      url:bgMusStream},
  {id:'rain',      label:'Лёгкий дождь',           emoji:'🌧️', cat:'Природа',      url:bgMusRain},
];

declare global { interface Window { _swaipBgAudio?: HTMLAudioElement|null; _swaipBgPostId?: string|null } }

/* ══ Авто-плеер: при попадании в зону видимости стартует loop, останавливая другие.
   Глобальный singleton — одновременно играет только одна дорожка. ══ */
export function BgMusicAutoplay({ url, postId, label, attach='sibling' }:{ url:string; postId:string; label:string; attach?: 'sibling'|'parent' }) {
  const sentinelRef = useRef<HTMLDivElement|null>(null);
  const audioRef    = useRef<HTMLAudioElement|null>(null);
  const claimToken  = useRef(0);
  const [muted, setMuted] = useState(() => { try { return localStorage.getItem('swaip_bg_muted') === '1'; } catch { return false; } });
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);

  useEffect(() => {
    const a = new Audio(url); a.loop = true; a.preload = 'none'; a.volume = 0.45;
    audioRef.current = a;
    return () => {
      try { a.pause(); } catch {}
      if (window._swaipBgPostId === postId) { window._swaipBgAudio = null; window._swaipBgPostId = null; }
      audioRef.current = null;
      claimToken.current++; // invalidate any pending play().then()
    };
  }, [url, postId]);

  useEffect(() => {
    const el = sentinelRef.current; if (!el) return;
    const target = attach === 'parent'
      ? (el.parentElement as HTMLElement|null)
      : ((el.nextElementSibling?.nextElementSibling as HTMLElement|null) || el.parentElement);
    if (!target) return;
    const io = new IntersectionObserver(entries => {
      const e = entries[0]; if (!e) return;
      setVisible(e.intersectionRatio >= 0.4);
    }, { threshold:[0,0.2,0.4,0.6,0.8,1] });
    io.observe(target);
    return () => io.disconnect();
  }, [attach]);

  useEffect(() => {
    const a = audioRef.current; if (!a) return;
    if (visible && !muted) {
      // First-come-first-served: если кто-то другой уже активно играет — не перебиваем,
      // дождёмся пока он сам уйдёт из видимости (его useEffect выполнит pause).
      if (window._swaipBgAudio && window._swaipBgAudio !== a && !window._swaipBgAudio.paused) {
        return;
      }
      const myToken = ++claimToken.current;
      a.play().then(() => {
        if (myToken !== claimToken.current) return; // stale: компонент unmount или состояние изменилось
        // Только после успеха — тушим прежнего владельца и забираем singleton.
        if (window._swaipBgAudio && window._swaipBgAudio !== a) {
          try { window._swaipBgAudio.pause(); } catch {}
        }
        window._swaipBgAudio = a; window._swaipBgPostId = postId;
        setPlaying(true); setAutoplayBlocked(false);
      }).catch(() => {
        if (myToken !== claimToken.current) return;
        // На rejection: глобальный singleton НЕ трогаем (ничего не паузили заранее).
        setAutoplayBlocked(true); setPlaying(false);
      });
    } else {
      claimToken.current++; // отменяем «in-flight» play promise
      try { a.pause(); } catch {}
      setPlaying(false);
      if (window._swaipBgPostId === postId) { window._swaipBgAudio = null; window._swaipBgPostId = null; }
    }
  }, [visible, muted, postId]);

  const toggleMute = () => {
    const next = !muted; setMuted(next);
    try { localStorage.setItem('swaip_bg_muted', next ? '1' : '0'); } catch {}
  };
  const tryUnblock = () => {
    const a = audioRef.current; if (!a) return;
    const myToken = ++claimToken.current;
    a.play().then(() => {
      if (myToken !== claimToken.current) return;
      if (window._swaipBgAudio && window._swaipBgAudio !== a) { try { window._swaipBgAudio.pause(); } catch {} }
      window._swaipBgAudio = a; window._swaipBgPostId = postId;
      setPlaying(true); setAutoplayBlocked(false);
    }).catch(() => {});
  };

  return (
    <>
      <div ref={sentinelRef} aria-hidden style={{ width:'100%', height:1, opacity:0, pointerEvents:'none' }} />
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px',
        background:'rgba(236,72,153,0.08)', borderBottom:'1px solid rgba(236,72,153,0.2)' }}>
        <span style={{ fontSize:11 }}>{playing ? '🔊' : (autoplayBlocked ? '🔇' : '🎵')}</span>
        <span style={{ flex:1, fontSize:10.5, color:'#ec4899', fontWeight:600,
          fontFamily:'"Montserrat",sans-serif', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {label || 'Фоновая музыка'} {playing ? '· играет' : (visible ? '' : '· пауза')}
        </span>
        {autoplayBlocked && (
          <button onClick={tryUnblock} style={{ background:'rgba(236,72,153,0.2)',
            border:'1px solid rgba(236,72,153,0.5)', color:'#ec4899', fontSize:10,
            padding:'3px 8px', borderRadius:6, cursor:'pointer',
            fontFamily:'"Montserrat",sans-serif', fontWeight:700 }}>▶ Включить звук</button>
        )}
        <button onClick={toggleMute} title={muted ? 'Включить' : 'Отключить'}
          style={{ background:'none', border:'none', color: muted ? 'rgba(255,255,255,0.4)' : '#ec4899',
            fontSize:13, cursor:'pointer', padding:'2px 4px', lineHeight:1 }}>{muted ? '🔕' : '🔔'}</button>
      </div>
    </>
  );
}

/* ══ Универсальный пикер пресетов с превью (▶) и выбором (✓) ══ */
export function BgMusicPicker({ selected, onChange, accent='#ec4899', textColor='#fff', subColor='rgba(255,255,255,0.6)', borderColor='rgba(255,255,255,0.12)' }:{
  selected: BgMusicPreset|null;
  onChange: (p: BgMusicPreset|null) => void;
  accent?: string;
  textColor?: string;
  subColor?: string;
  borderColor?: string;
}) {
  const previewRef = useRef<HTMLAudioElement|null>(null);
  const [previewId, setPreviewId] = useState<string|null>(null);
  useEffect(() => () => { if (previewRef.current) { previewRef.current.pause(); previewRef.current = null; } }, []);
  const playPreview = (p: BgMusicPreset) => {
    if (previewRef.current) { previewRef.current.pause(); previewRef.current = null; }
    if (previewId === p.id) { setPreviewId(null); return; }
    const a = new Audio(p.url); a.volume = 0.5; a.play().catch(() => {});
    previewRef.current = a; setPreviewId(p.id);
  };
  const cats = Array.from(new Set(BG_MUSIC_PRESETS.map(p => p.cat)));
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {cats.map(cat => (
        <div key={cat}>
          <p style={{ margin:'0 0 6px', fontSize:11, color:subColor, fontWeight:700,
            fontFamily:'"Montserrat",sans-serif', textTransform:'uppercase', letterSpacing:0.4 }}>{cat}</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))', gap:6 }}>
            {BG_MUSIC_PRESETS.filter(p => p.cat === cat).map(p => {
              const sel = selected?.id === p.id;
              const prev = previewId === p.id;
              return (
                <div key={p.id} style={{ display:'flex', alignItems:'center', gap:4,
                  padding:'6px 8px', borderRadius:8,
                  border: `1.5px solid ${sel ? accent : borderColor}`,
                  background: sel ? `${accent}22` : 'transparent' }}>
                  <button onClick={() => playPreview(p)} title={prev ? 'Стоп' : 'Слушать'}
                    style={{ background:'none', border:'none', cursor:'pointer', color:accent,
                      fontSize:13, padding:0, lineHeight:1 }}>{prev ? '⏸' : '▶'}</button>
                  <button onClick={() => onChange(sel ? null : p)}
                    style={{ flex:1, background:'none', border:'none', cursor:'pointer',
                      display:'flex', alignItems:'center', gap:5, color:textColor, padding:0,
                      fontSize:11, fontFamily:'"Montserrat",sans-serif', textAlign:'left' }}>
                    <span style={{ fontSize:13 }}>{p.emoji}</span>
                    <span style={{ flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{p.label}</span>
                    {sel && <span style={{ color:accent, fontSize:11 }}>✓</span>}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
