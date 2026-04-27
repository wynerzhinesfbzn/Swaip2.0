import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════
   ТЕМЫ ВИДЕОПЛЕЕРА — 5 ПРЕМИУМ СКИНОВ
═══════════════════════════════════════════════════════════ */
export type VideoSkin = 'swaip' | 'noir' | 'aurora' | 'titanium' | 'crimson';

interface SkinConfig {
  name: string;
  emoji: string;
  bg: string;
  panelBg: string;
  panelBorder: string;
  progressBg: string;
  progressFill: string;
  progressGlow: string;
  btnColor: string;
  btnBg: string;
  textColor: string;
  subColor: string;
  timeColor: string;
  scrubberThumb: string;
  bottomGradient: string;
  brandText: string;
  brandGradient: string;
}

const SKINS: Record<VideoSkin, SkinConfig> = {
  swaip: {
    name: 'SWAIP Dark',
    emoji: '🟣',
    bg: 'linear-gradient(160deg,#06061A 0%,#0D0A24 50%,#07091F 100%)',
    panelBg: 'rgba(12,10,30,0.92)',
    panelBorder: 'rgba(124,111,255,0.18)',
    progressBg: 'rgba(124,111,255,0.18)',
    progressFill: 'linear-gradient(90deg,#4F3FFF,#7C6FFF,#A78BFA)',
    progressGlow: '0 0 12px rgba(124,111,255,0.6)',
    btnColor: '#A78BFA',
    btnBg: 'rgba(124,111,255,0.12)',
    textColor: '#E8E8F8',
    subColor: '#6060AA',
    timeColor: '#C4B5FD',
    scrubberThumb: '#7C6FFF',
    bottomGradient: 'linear-gradient(0deg,rgba(4,3,18,0.98) 0%,rgba(7,5,25,0.8) 40%,transparent 100%)',
    brandText: 'SWAIP',
    brandGradient: 'linear-gradient(135deg,#7C6FFF,#A78BFA)',
  },
  noir: {
    name: 'Noir Gold',
    emoji: '⬛',
    bg: 'linear-gradient(160deg,#000000 0%,#0A0800 50%,#050300 100%)',
    panelBg: 'rgba(5,4,0,0.94)',
    panelBorder: 'rgba(212,175,55,0.2)',
    progressBg: 'rgba(212,175,55,0.12)',
    progressFill: 'linear-gradient(90deg,#8B6914,#D4AF37,#F7E98E,#D4AF37)',
    progressGlow: '0 0 14px rgba(212,175,55,0.5)',
    btnColor: '#D4AF37',
    btnBg: 'rgba(212,175,55,0.08)',
    textColor: '#F5F0E0',
    subColor: '#6B5B2A',
    timeColor: '#D4AF37',
    scrubberThumb: '#D4AF37',
    bottomGradient: 'linear-gradient(0deg,rgba(0,0,0,0.99) 0%,rgba(2,1,0,0.85) 40%,transparent 100%)',
    brandText: 'SWAIP',
    brandGradient: 'linear-gradient(135deg,#8B6914,#D4AF37,#F7E98E)',
  },
  aurora: {
    name: 'Aurora',
    emoji: '🌌',
    bg: 'linear-gradient(160deg,#020514 0%,#040C1F 40%,#020B12 100%)',
    panelBg: 'rgba(2,6,20,0.93)',
    panelBorder: 'rgba(0,230,200,0.15)',
    progressBg: 'rgba(0,220,180,0.1)',
    progressFill: 'linear-gradient(90deg,#0AFFE8,#00BFFF,#9B59B6,#E040FB)',
    progressGlow: '0 0 16px rgba(0,255,220,0.45)',
    btnColor: '#00E5CC',
    btnBg: 'rgba(0,230,200,0.08)',
    textColor: '#D8F5FF',
    subColor: '#2A5A60',
    timeColor: '#00E5CC',
    scrubberThumb: '#00E5CC',
    bottomGradient: 'linear-gradient(0deg,rgba(2,4,16,0.98) 0%,rgba(3,7,20,0.8) 40%,transparent 100%)',
    brandText: 'SWAIP',
    brandGradient: 'linear-gradient(135deg,#0AFFE8,#00BFFF,#E040FB)',
  },
  titanium: {
    name: 'Titanium',
    emoji: '🔘',
    bg: 'linear-gradient(160deg,#0C0C10 0%,#141418 40%,#0A0A0E 100%)',
    panelBg: 'rgba(10,10,14,0.95)',
    panelBorder: 'rgba(180,180,200,0.14)',
    progressBg: 'rgba(150,150,180,0.1)',
    progressFill: 'linear-gradient(90deg,#3A3A50,#7A7A9A,#C0C0D8,#E0E0F0,#9090B0)',
    progressGlow: '0 0 10px rgba(180,180,220,0.4)',
    btnColor: '#C0C0D8',
    btnBg: 'rgba(160,160,200,0.07)',
    textColor: '#EAEAF8',
    subColor: '#505068',
    timeColor: '#B0B0D0',
    scrubberThumb: '#C0C0E0',
    bottomGradient: 'linear-gradient(0deg,rgba(8,8,12,0.98) 0%,rgba(12,12,18,0.8) 40%,transparent 100%)',
    brandText: 'SWAIP',
    brandGradient: 'linear-gradient(135deg,#5A5A78,#C0C0E0,#FFFFFF)',
  },
  crimson: {
    name: 'Crimson',
    emoji: '🔴',
    bg: 'linear-gradient(160deg,#0E0205 0%,#140308 50%,#0A0204 100%)',
    panelBg: 'rgba(12,2,5,0.94)',
    panelBorder: 'rgba(220,40,60,0.18)',
    progressBg: 'rgba(200,30,50,0.14)',
    progressFill: 'linear-gradient(90deg,#7F0014,#DC143C,#FF4560,#FF6B35)',
    progressGlow: '0 0 14px rgba(220,20,60,0.55)',
    btnColor: '#FF4560',
    btnBg: 'rgba(220,20,60,0.1)',
    textColor: '#FFE8E8',
    subColor: '#6A2030',
    timeColor: '#FF6080',
    scrubberThumb: '#DC143C',
    bottomGradient: 'linear-gradient(0deg,rgba(8,1,4,0.98) 0%,rgba(12,2,6,0.82) 40%,transparent 100%)',
    brandText: 'SWAIP',
    brandGradient: 'linear-gradient(135deg,#7F0014,#DC143C,#FF6B35)',
  },
};

/* ═══════════════════════════════════════════════════════════
   УТИЛИТЫ
═══════════════════════════════════════════════════════════ */
function fmt(s: number) {
  if (!isFinite(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/* ═══════════════════════════════════════════════════════════
   ИКОНКИ SVG (inline, без зависимостей)
═══════════════════════════════════════════════════════════ */
const IconPlay = ({ color }: { color: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={color}><path d="M8 5v14l11-7z"/></svg>
);
const IconPause = ({ color }: { color: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill={color}><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
);
const IconVolume = ({ color, muted }: { color: string; muted: boolean }) => muted
  ? <svg width="18" height="18" viewBox="0 0 24 24" fill={color}><path d="M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>
  : <svg width="18" height="18" viewBox="0 0 24 24" fill={color}><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>;
const IconFullscreen = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={color}><path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
);
const IconRewind = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={color}><path d="M11 18V6l-8.5 6 8.5 6zm.5-6l8.5 6V6l-8.5 6z"/></svg>
);
const IconForward = ({ color }: { color: string }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill={color}><path d="M4 18l8.5-6L4 6v12zm9-12v12l8.5-6L13 6z"/></svg>
);

/* ═══════════════════════════════════════════════════════════
   ВЫБОР СКИНА
═══════════════════════════════════════════════════════════ */
export function SkinSelector({ skin, onChange }: { skin: VideoSkin; onChange: (s: VideoSkin) => void }) {
  return (
    <div style={{ display:'flex',gap:6,flexWrap:'wrap' }}>
      {(Object.keys(SKINS) as VideoSkin[]).map(s => {
        const sk = SKINS[s];
        const active = skin === s;
        return (
          <button key={s} onClick={() => onChange(s)}
            style={{ padding:'6px 10px',borderRadius:10,border:`1.5px solid ${active?sk.scrubberThumb:'rgba(255,255,255,0.1)'}`,
              background:active?sk.panelBg:'rgba(255,255,255,0.04)',cursor:'pointer',fontFamily:'inherit',
              display:'flex',alignItems:'center',gap:5,transition:'all 0.15s' }}>
            <span style={{ fontSize:14 }}>{sk.emoji}</span>
            <span style={{ fontSize:11,fontWeight:700,color:active?sk.btnColor:'rgba(255,255,255,0.4)' }}>{sk.name}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ГЛАВНЫЙ КОМПОНЕНТ ПЛЕЕРА
═══════════════════════════════════════════════════════════ */
export default function SwaipVideoPlayer({
  src,
  skin = 'swaip',
  title,
  autoPlay = false,
  style,
}: {
  src: string;
  skin?: VideoSkin;
  title?: string;
  autoPlay?: boolean;
  style?: React.CSSProperties;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [buffered, setBuffered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showVol, setShowVol] = useState(false);

  const sk = SKINS[skin];

  /* Авто-скрытие контролов */
  const resetHide = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3200);
    }
  }, [playing]);

  useEffect(() => { resetHide(); }, [playing, resetHide]);
  useEffect(() => () => clearTimeout(hideTimer.current), []);

  /* Обновление состояния */
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onDur = () => setDuration(v.duration);
    const onPlay = () => setPlaying(true);
    const onPause = () => { setPlaying(false); setShowControls(true); };
    const onEnd = () => { setPlaying(false); setShowControls(true); };
    const onWait = () => setLoading(true);
    const onCanPlay = () => setLoading(false);
    const onProgress = () => {
      if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
    };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('durationchange', onDur);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onEnd);
    v.addEventListener('waiting', onWait);
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('progress', onProgress);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('durationchange', onDur);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onEnd);
      v.removeEventListener('waiting', onWait);
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('progress', onProgress);
    };
  }, []);

  /* Fullscreen change */
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
    resetHide();
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
    resetHide();
  };

  const skip = (sec: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + sec));
    resetHide();
  };

  const changeVolume = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    const clamped = Math.max(0, Math.min(1, val));
    v.volume = clamped;
    setVolume(clamped);
    setMuted(clamped === 0);
    v.muted = clamped === 0;
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  const toggleFullscreen = async () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) await el.requestFullscreen?.();
    else await document.exitFullscreen?.();
  };

  const progress = duration > 0 ? currentTime / duration : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;

  const CTL_BTN: React.CSSProperties = {
    width: 40, height: 40, borderRadius: 12, background: sk.btnBg,
    border: `1px solid ${sk.panelBorder}`, display:'flex', alignItems:'center', justifyContent:'center',
    cursor:'pointer', flexShrink: 0, transition:'all 0.15s',
  };

  return (
    <div ref={containerRef}
      style={{ position:'relative', width:'100%', aspectRatio:'16/9', background:sk.bg,
        borderRadius: isFullscreen?0:18, overflow:'hidden', userSelect:'none', ...style }}
      onMouseMove={resetHide} onTouchStart={resetHide}
      onClick={e=>{ if(e.target===e.currentTarget||e.currentTarget.contains(e.target as Node))togglePlay(); }}>

      {/* Видео */}
      <video ref={videoRef} src={src} style={{ width:'100%',height:'100%',objectFit:'contain',display:'block' }}
        autoPlay={autoPlay} playsInline preload="metadata"/>

      {/* Спиннер загрузки */}
      <AnimatePresence>
        {loading && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none' }}>
            <div style={{ width:48,height:48,borderRadius:'50%',border:`3px solid ${sk.btnColor}22`,borderTop:`3px solid ${sk.btnColor}`,animation:'spin 0.9s linear infinite' }}/>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Большая кнопка play в центре (только при паузе) */}
      <AnimatePresence>
        {!playing && !loading && (
          <motion.div initial={{opacity:0,scale:0.7}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.7}}
            style={{ position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none' }}>
            <div style={{ width:72,height:72,borderRadius:'50%',background:`${sk.panelBg}`,border:`2px solid ${sk.panelBorder}`,
              backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',
              boxShadow:`0 0 40px ${sk.progressGlow}, inset 0 1px 0 rgba(255,255,255,0.08)` }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill={sk.btnColor}><path d="M8 5v14l11-7z"/></svg>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Нижний градиент + контролы */}
      <AnimatePresence>
        {showControls && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.25}}
            style={{ position:'absolute',bottom:0,left:0,right:0,background:sk.bottomGradient,padding:'40px 14px 14px' }}
            onClick={e=>e.stopPropagation()}>

            {/* SWAIP бренд */}
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8 }}>
              {title && (
                <div style={{ fontSize:12,fontWeight:700,color:sk.textColor,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,marginRight:10 }}>
                  {title}
                </div>
              )}
              <div style={{ display:'flex',alignItems:'center',gap:4,flexShrink:0,marginLeft:'auto' }}>
                <div style={{ fontSize:10,fontWeight:900,background:sk.brandGradient,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',letterSpacing:'0.12em' }}>
                  {sk.brandText}
                </div>
                <div style={{ width:1,height:10,background:sk.panelBorder,margin:'0 2px' }}/>
                <div style={{ fontSize:9,fontWeight:600,color:sk.subColor,letterSpacing:'0.08em' }}>PLAYER</div>
              </div>
            </div>

            {/* Прогресс-бар */}
            <div style={{ position:'relative',marginBottom:10,cursor:'pointer',paddingTop:4,paddingBottom:4 }}
              onClick={seek}>
              {/* Трек */}
              <div style={{ height:3,borderRadius:99,background:sk.progressBg,position:'relative',overflow:'hidden' }}>
                {/* Буффер */}
                <div style={{ position:'absolute',left:0,top:0,height:'100%',width:`${bufferedPct}%`,background:'rgba(255,255,255,0.12)',borderRadius:99,transition:'width 0.3s' }}/>
                {/* Прогресс */}
                <div style={{ position:'absolute',left:0,top:0,height:'100%',width:`${progress*100}%`,background:sk.progressFill,borderRadius:99,boxShadow:sk.progressGlow,transition:'width 0.08s linear' }}/>
              </div>
              {/* Ползунок */}
              <div style={{ position:'absolute',top:'50%',left:`${progress*100}%`,transform:'translate(-50%,-50%)',width:13,height:13,borderRadius:'50%',background:sk.scrubberThumb,
                boxShadow:`0 0 8px ${sk.progressGlow},0 2px 4px rgba(0,0,0,0.5)`,border:`2px solid rgba(255,255,255,0.25)`,transition:'left 0.08s linear' }}/>
            </div>

            {/* Время + контролы */}
            <div style={{ display:'flex',alignItems:'center',gap:6 }}>
              {/* ← -10с */}
              <motion.button whileTap={{scale:0.85}} onClick={()=>skip(-10)} style={CTL_BTN}>
                <IconRewind color={sk.btnColor}/>
              </motion.button>

              {/* Play/Pause */}
              <motion.button whileTap={{scale:0.85}} onClick={togglePlay}
                style={{ ...CTL_BTN,width:48,height:48,borderRadius:14,background:sk.progressFill,border:'none',
                  boxShadow:sk.progressGlow }}>
                {playing ? <IconPause color="#fff"/> : <IconPlay color="#fff"/>}
              </motion.button>

              {/* +10с */}
              <motion.button whileTap={{scale:0.85}} onClick={()=>skip(10)} style={CTL_BTN}>
                <IconForward color={sk.btnColor}/>
              </motion.button>

              {/* Время */}
              <div style={{ fontSize:11,fontWeight:700,color:sk.timeColor,fontVariantNumeric:'tabular-nums',marginLeft:2,flexShrink:0 }}>
                {fmt(currentTime)} / {fmt(duration)}
              </div>

              <div style={{ flex:1 }}/>

              {/* Громкость */}
              <div style={{ position:'relative',display:'flex',alignItems:'center' }}
                onMouseEnter={()=>setShowVol(true)} onMouseLeave={()=>setShowVol(false)}>
                <AnimatePresence>
                  {showVol && (
                    <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:8}}
                      style={{ position:'absolute',bottom:'100%',left:'50%',transform:'translateX(-50%)',marginBottom:8,
                        background:sk.panelBg,border:`1px solid ${sk.panelBorder}`,borderRadius:12,padding:'10px 8px',
                        display:'flex',flexDirection:'column',alignItems:'center',gap:6,backdropFilter:'blur(12px)' }}>
                      <input type="range" min={0} max={1} step={0.02} value={muted?0:volume}
                        onChange={e=>changeVolume(Number(e.target.value))}
                        style={{ writingMode:'vertical-lr',direction:'rtl',height:80,cursor:'pointer',accentColor:sk.scrubberThumb }}/>
                      <div style={{ fontSize:9,color:sk.subColor,fontWeight:700 }}>{Math.round((muted?0:volume)*100)}%</div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <motion.button whileTap={{scale:0.85}} onClick={toggleMute} style={CTL_BTN}>
                  <IconVolume color={sk.btnColor} muted={muted||volume===0}/>
                </motion.button>
              </div>

              {/* Полноэкранный */}
              <motion.button whileTap={{scale:0.85}} onClick={toggleFullscreen} style={CTL_BTN}>
                <IconFullscreen color={sk.btnColor}/>
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Верхний градиент */}
      <div style={{ position:'absolute',top:0,left:0,right:0,height:60,
        background:'linear-gradient(180deg,rgba(0,0,0,0.35) 0%,transparent 100%)',pointerEvents:'none' }}/>
    </div>
  );
}
