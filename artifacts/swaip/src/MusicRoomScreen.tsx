import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackHandler } from './backHandler';

const API = window.location.origin;
const WS_BASE = API.replace(/^http/, 'ws');
let _tok = '';
const getTok = () => _tok || (typeof localStorage !== 'undefined' ? localStorage.getItem('swaip_session') || localStorage.getItem('swaip_session_token') || '' : '');

/* ─── Popular Russian artists for autocomplete ─── */
const POPULAR_ARTISTS = [
  'Михаил Круг','Михаил Шуфутинский','Михаил Боярский',
  'Алла Пугачёва','Филипп Киркоров','Валерий Меладзе',
  'Григорий Лепс','Дима Билан','Земфира','Ария',
  'Кино','ДДТ','Сплин','Наутилус Помпилиус','Аквариум',
  'Машина времени','Руки Вверх','Иванушки International',
  'Ирина Аллегрова','Лариса Долина','Жанна Агузарова',
  'Виктор Цой','Андрей Макаревич','Юрий Антонов',
  'Тимати','Баста','Oxxxymiron','Ленинград','Noize MC',
  'NILETTO','Jah Khalib','Miyagi','Скриптонит',
  'Монатик','Люся Чеботина','Клава Кока','Artik & Asti',
  'The Beatles','Queen','ABBA','Michael Jackson',
  'Ed Sheeran','Adele','Eminem','Elvis Presley',
];

const ALPHABET = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЭЮЯABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

/* ─── 14 Voice Environment Presets ─── */
interface VoicePreset {
  id: string;
  label: string;
  emoji: string;
  color: string;
  /* Reverb (convolver) */
  reverbDur: number;    // seconds
  reverbDecay: number;  // exponent for decay shape
  reverbWet: number;    // 0–1 mix
  /* Delay/echo */
  delayTime: number;    // seconds
  delayFeedback: number; // 0–1
  delayWet: number;     // 0–1
  /* EQ (biquad) */
  eqType: BiquadFilterType;
  eqFreq: number;
  eqGain: number;
  eqQ: number;
  /* Compressor */
  compThreshold: number;
  compRatio: number;
  /* Dry/wet overall */
  dry: number;
}

const VOICE_PRESETS: VoicePreset[] = [
  { id:'studio',   label:'В студии',          emoji:'🎙',  color:'#22c55e',
    reverbDur:0.25, reverbDecay:5, reverbWet:0.12, delayTime:0.01, delayFeedback:0.05, delayWet:0.05, eqType:'peaking', eqFreq:3000, eqGain:2, eqQ:0.8, compThreshold:-18, compRatio:4, dry:0.92 },
  { id:'room',     label:'Комната',            emoji:'🛋',  color:'#a78bfa',
    reverbDur:0.6,  reverbDecay:4, reverbWet:0.35, delayTime:0.04, delayFeedback:0.15, delayWet:0.12, eqType:'peaking', eqFreq:1000, eqGain:1, eqQ:1,   compThreshold:-20, compRatio:5, dry:0.72 },
  { id:'walls',    label:'4 стены',            emoji:'🧱',  color:'#94a3b8',
    reverbDur:0.4,  reverbDecay:3, reverbWet:0.4,  delayTime:0.03, delayFeedback:0.35, delayWet:0.22, eqType:'lowshelf',eqFreq:500,  eqGain:-3, eqQ:0.7, compThreshold:-22, compRatio:6, dry:0.65 },
  { id:'office',   label:'Офис',               emoji:'🏢',  color:'#38bdf8',
    reverbDur:0.5,  reverbDecay:4, reverbWet:0.28, delayTime:0.04, delayFeedback:0.12, delayWet:0.1,  eqType:'peaking', eqFreq:2000, eqGain:2, eqQ:1.2, compThreshold:-20, compRatio:4, dry:0.75 },
  { id:'hall',     label:'Зал',                emoji:'🏛',  color:'#c084fc',
    reverbDur:2.0,  reverbDecay:2, reverbWet:0.6,  delayTime:0.08, delayFeedback:0.22, delayWet:0.2,  eqType:'peaking', eqFreq:500,  eqGain:-2, eqQ:0.8, compThreshold:-24, compRatio:6, dry:0.48 },
  { id:'auditorium', label:'Актовый зал',      emoji:'🎭',  color:'#f59e0b',
    reverbDur:3.0,  reverbDecay:1.5, reverbWet:0.72, delayTime:0.12, delayFeedback:0.3, delayWet:0.25, eqType:'lowshelf',eqFreq:300,  eqGain:2, eqQ:0.7, compThreshold:-26, compRatio:7, dry:0.38 },
  { id:'tribune',  label:'Трибуна',            emoji:'📣',  color:'#fb923c',
    reverbDur:3.5,  reverbDecay:1.2, reverbWet:0.78, delayTime:0.2,  delayFeedback:0.38, delayWet:0.3,  eqType:'peaking', eqFreq:600,  eqGain:-4, eqQ:0.6, compThreshold:-26, compRatio:8, dry:0.32 },
  { id:'street',   label:'Улица',              emoji:'🌆',  color:'#6ee7b7',
    reverbDur:1.0,  reverbDecay:3.5, reverbWet:0.38, delayTime:0.06, delayFeedback:0.1, delayWet:0.12, eqType:'highpass',eqFreq:200,  eqGain:0, eqQ:0.7,  compThreshold:-20, compRatio:4, dry:0.65 },
  { id:'cave',     label:'В пещере',           emoji:'🕳',  color:'#7dd3fc',
    reverbDur:4.5,  reverbDecay:0.8, reverbWet:0.88, delayTime:0.6,  delayFeedback:0.62, delayWet:0.5,  eqType:'peaking', eqFreq:400,  eqGain:4, eqQ:0.5,  compThreshold:-28, compRatio:9, dry:0.25 },
  { id:'karaoke',  label:'Каракоке зал',       emoji:'🎤',  color:'#f472b6',
    reverbDur:1.2,  reverbDecay:2.5, reverbWet:0.45, delayTime:0.07, delayFeedback:0.18, delayWet:0.15, eqType:'highshelf',eqFreq:4000, eqGain:3, eqQ:0.8, compThreshold:-22, compRatio:5, dry:0.62 },
  { id:'club',     label:'В клубе',            emoji:'🪩',  color:'#e879f9',
    reverbDur:1.5,  reverbDecay:2, reverbWet:0.52, delayTime:0.06, delayFeedback:0.18, delayWet:0.18, eqType:'lowshelf', eqFreq:200,  eqGain:6, eqQ:0.7, compThreshold:-24, compRatio:7, dry:0.55 },
  { id:'stage',    label:'Сцена',              emoji:'🌟',  color:'#fbbf24',
    reverbDur:2.5,  reverbDecay:1.8, reverbWet:0.68, delayTime:0.1,  delayFeedback:0.28, delayWet:0.22, eqType:'peaking', eqFreq:1000, eqGain:2, eqQ:1,   compThreshold:-24, compRatio:6, dry:0.42 },
  { id:'forest',   label:'В лесу',             emoji:'🌲',  color:'#4ade80',
    reverbDur:1.8,  reverbDecay:2.5, reverbWet:0.5, delayTime:0.15, delayFeedback:0.22, delayWet:0.2,  eqType:'highpass',eqFreq:100,  eqGain:0, eqQ:0.7, compThreshold:-22, compRatio:5, dry:0.55 },
  { id:'echo',     label:'Эхо',                emoji:'🔊',  color:'#67e8f9',
    reverbDur:2.5,  reverbDecay:2, reverbWet:0.6,  delayTime:0.3,  delayFeedback:0.58, delayWet:0.55, eqType:'peaking', eqFreq:800,  eqGain:-3, eqQ:0.9, compThreshold:-26, compRatio:7, dry:0.4 },
];

/* ─── ChartTrack type + artist gradient helper ─── */
interface ChartTrack { pos: number; artist: string; title: string; }
const GRAD_PAIRS = [
  ['#7c3aed','#db2777'],['#2563eb','#0891b2'],['#d97706','#dc2626'],
  ['#059669','#0891b2'],['#be185d','#7c3aed'],['#1d4ed8','#7c3aed'],
];
function artistGrad(name: string): string {
  let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % GRAD_PAIRS.length;
  const [a, b] = GRAD_PAIRS[h];
  return `linear-gradient(135deg,${a},${b})`;
}
function artistInitials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || '🎤';
}

/* ─── Generate impulse response algorithmically (no binary files needed) ─── */
function makeIR(ctx: AudioContext, preset: VoicePreset): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.max(256, Math.floor(sr * preset.reverbDur));
  const buf = ctx.createBuffer(2, len, sr);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) {
      const env = Math.pow(1 - i / len, preset.reverbDecay);
      d[i] = (Math.random() * 2 - 1) * env;
      if (c === 1) d[i] += (Math.random() * 0.05 - 0.025);
    }
  }
  return buf;
}

/* ─── Build Web Audio processing graph ───
   Returns a cleanup function and the analyser for visualizer */
interface AudioGraph {
  analyser: AnalyserNode;
  cleanup: () => void;
  processedStream: MediaStream;
}

function buildAudioGraph(ctx: AudioContext, rawStream: MediaStream, preset: VoicePreset): AudioGraph {
  const source = ctx.createMediaStreamSource(rawStream);

  const inputGain = ctx.createGain();
  inputGain.gain.value = 1.4;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;

  const dryGain = ctx.createGain();
  dryGain.gain.value = preset.dry;

  /* Delay / echo */
  const delay = ctx.createDelay(2.0);
  delay.delayTime.value = preset.delayTime;
  const delayFB = ctx.createGain();
  delayFB.gain.value = preset.delayFeedback;
  const delayWet = ctx.createGain();
  delayWet.gain.value = preset.delayWet;
  delay.connect(delayFB);
  delayFB.connect(delay);

  /* Convolution reverb */
  const convolver = ctx.createConvolver();
  convolver.buffer = makeIR(ctx, preset);
  const reverbWet = ctx.createGain();
  reverbWet.gain.value = preset.reverbWet;

  /* EQ */
  const eq = ctx.createBiquadFilter();
  eq.type = preset.eqType;
  eq.frequency.value = preset.eqFreq;
  eq.gain.value = preset.eqGain;
  eq.Q.value = preset.eqQ;

  /* Compressor (auto-gain = voice to music) */
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = preset.compThreshold;
  comp.knee.value = 30;
  comp.ratio.value = preset.compRatio;
  comp.attack.value = 0.003;
  comp.release.value = 0.18;

  const outputGain = ctx.createGain();
  outputGain.gain.value = 1.0;

  /* Destination for recording/relay */
  const destNode = ctx.createMediaStreamDestination();

  /* Wire up: source → inputGain → analyser → dry + delay + reverb → eq → comp → output */
  source.connect(inputGain);
  inputGain.connect(analyser);

  analyser.connect(dryGain);
  analyser.connect(delay);
  analyser.connect(convolver);

  delay.connect(delayWet);
  convolver.connect(reverbWet);

  dryGain.connect(eq);
  delayWet.connect(eq);
  reverbWet.connect(eq);

  eq.connect(comp);
  comp.connect(outputGain);

  /* Only to MediaStreamDestination — NOT to speakers.
     Connecting to ctx.destination causes acoustic feedback when singing without
     headphones: the mic picks up the monitor output and re-records it endlessly.
     Guests hear the singer via singer_audio relay chunks. */
  outputGain.connect(destNode);

  const cleanup = () => {
    try { source.disconnect(); inputGain.disconnect(); analyser.disconnect();
      dryGain.disconnect(); delay.disconnect(); delayFB.disconnect(); delayWet.disconnect();
      convolver.disconnect(); reverbWet.disconnect(); eq.disconnect();
      comp.disconnect(); outputGain.disconnect(); } catch { /* */ }
  };

  return { analyser, cleanup, processedStream: destNode.stream };
}

/* ─── LRC helpers ─── */
interface LrcLine { time: number; text: string; }

function parseLrc(raw: string): LrcLine[] {
  const lines: LrcLine[] = [];
  for (const line of raw.split('\n')) {
    const m = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
    if (m) {
      const t = parseInt(m[1]) * 60 + parseFloat(m[2]);
      const text = m[3].trim();
      if (text) lines.push({ time: t, text });
    }
  }
  return lines.sort((a, b) => a.time - b.time);
}

function curIdx(lines: LrcLine[], t: number): number {
  let idx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].time <= t) idx = i; else break;
  }
  return idx;
}

/* ─── Pitch detection via autocorrelation ─── */
function detectPitch(analyser: AnalyserNode): { freq: number | null; rms: number } {
  const buf = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(buf);
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.012) return { freq: null, rms };
  const SIZE = buf.length;
  const sr = analyser.context.sampleRate;
  const minLag = Math.floor(sr / 1500);
  const maxLag = Math.min(SIZE / 2, Math.floor(sr / 60));
  let bestR = 0, bestT = -1;
  for (let lag = minLag; lag < maxLag; lag++) {
    let r = 0;
    for (let i = 0; i < SIZE - lag; i++) r += buf[i] * buf[i + lag];
    r /= (SIZE - lag);
    if (r > bestR) { bestR = r; bestT = lag; }
  }
  if (bestT < 0 || bestR < 0.012) return { freq: null, rms };
  return { freq: sr / bestT, rms };
}

/* ─── Floating reaction types ─── */
interface FloatReaction { id: string; emoji: string; x: number; }
interface ScoreAnim { id: string; pts: number; x: number; }
const REACTION_EMOJIS = ['❤️','🔥','👏','🎉','⭐','😍','🎤','💯','✨','🫶'];

/* ─── Safe ArrayBuffer → base64 (avoids stack overflow on large chunks) ─── */
function ab2b64(ab: ArrayBuffer): string {
  const u8 = new Uint8Array(ab);
  let bin = '';
  const chunk = 8192;
  for (let i = 0; i < u8.length; i += chunk) {
    bin += String.fromCharCode(...u8.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s) % 60).padStart(2, '0')}`;
}

function Av({ name, size = 32 }: { name: string; size?: number }) {
  const cols = ['#7c3aed','#db2777','#059669','#d97706','#2563eb','#dc2626'];
  const c = cols[(name.charCodeAt(0) || 0) % cols.length];
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', background: c, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900,
      color: '#fff', fontSize: size * 0.4, fontFamily: '"Montserrat",sans-serif' }}>
      {(name[0] || '?').toUpperCase()}
    </div>
  );
}

/* ─── Interfaces ─── */
interface Song { id: number; artist: string; title: string; album: string; duration: number; hasSynced: boolean; thumb?: string | null; }
interface QueueEntry { id: string; userHash: string; userName: string; song: Song; }
interface Member { hash: string; name: string; avatar: string; }

/* ══════════════════════════════════════════════════════
   STAGE VISUALIZER  — frequency bar chart on canvas
══════════════════════════════════════════════════════ */
function StageVisualizer({ analyser, preset, active }: { analyser: AnalyserNode | null; preset: VoicePreset; active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !analyser || !active) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const data = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      const bars = Math.min(data.length, 32);
      const bw = W / bars - 1;
      for (let i = 0; i < bars; i++) {
        const val = data[i] / 255;
        const h = val * H;
        const alpha = 0.4 + val * 0.6;
        ctx.fillStyle = preset.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.roundRect(i * (bw + 1), H - h, bw, h, [3, 3, 0, 0]);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser, active, preset]);

  if (!active) return null;

  return (
    <motion.div initial={{ opacity: 0, scaleY: 0 }} animate={{ opacity: 1, scaleY: 1 }}
      style={{ height: 44, flexShrink: 0, background: 'rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>
      <canvas ref={canvasRef} width={400} height={44} style={{ width: '100%', height: '100%' }} />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg,${preset.color}22,transparent,${preset.color}22)`, pointerEvents: 'none' }} />
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════
   EFFECTS PANEL  — horizontal scroll of 14 presets
══════════════════════════════════════════════════════ */
function EffectsPanel({ current, onChange }: { current: string; onChange: (p: VoicePreset) => void }) {
  return (
    <div style={{ flexShrink: 0, padding: '8px 0 8px 12px', background: 'rgba(5,5,15,0.96)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', marginBottom: 6, paddingRight: 12 }}>ЭФФЕКТ ГОЛОСА</div>
      <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingRight: 12, paddingBottom: 4 }}>
        {VOICE_PRESETS.map(p => {
          const active = p.id === current;
          return (
            <motion.button key={p.id} whileTap={{ scale: 0.9 }} onClick={() => onChange(p)}
              style={{ flexShrink: 0, padding: '6px 11px', borderRadius: 20, border: `1.5px solid ${active ? p.color : 'rgba(255,255,255,0.1)'}`,
                background: active ? `${p.color}22` : 'rgba(255,255,255,0.04)',
                color: active ? p.color : 'rgba(255,255,255,0.5)',
                fontWeight: active ? 800 : 600, fontSize: 11, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif',
                display: 'flex', alignItems: 'center', gap: 4,
                boxShadow: active ? `0 0 10px ${p.color}44` : 'none' }}>
              <span style={{ fontSize: 14 }}>{p.emoji}</span>
              {p.label}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   FLOATING REACTIONS OVERLAY
══════════════════════════════════════════════════════ */
function FloatingReactionsOverlay({ reactions }: { reactions: FloatReaction[] }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 60 }}>
      <AnimatePresence>
        {reactions.map(r => (
          <motion.div key={r.id}
            initial={{ y: 0, opacity: 1, scale: 0.5, x: 0 }}
            animate={{ y: -340, opacity: 0, scale: 1.6, x: (Math.random() - 0.5) * 60 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.6, ease: [0.2, 0.8, 0.4, 1] }}
            style={{ position: 'absolute', bottom: 80, left: `${r.x}%`, fontSize: 34, userSelect: 'none', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.7))' }}>
            {r.emoji}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SCORE FLOATS
══════════════════════════════════════════════════════ */
function ScoreFloats({ anims }: { anims: ScoreAnim[] }) {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 61 }}>
      <AnimatePresence>
        {anims.map(a => (
          <motion.div key={a.id}
            initial={{ y: 0, opacity: 1, scale: 0.7 }}
            animate={{ y: -100, opacity: 0, scale: 1.3 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, ease: 'easeOut' }}
            style={{
              position: 'absolute', bottom: 200, left: `${a.x}%`,
              fontWeight: 900, fontSize: 24,
              color: a.pts >= 85 ? '#fbbf24' : a.pts >= 65 ? '#4ade80' : '#a78bfa',
              fontFamily: '"Montserrat",sans-serif',
              textShadow: '0 0 20px rgba(0,0,0,0.9),0 2px 8px rgba(0,0,0,0.8)',
              userSelect: 'none',
            }}>
            +{a.pts}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   SCORE END MODAL
══════════════════════════════════════════════════════ */
function ScoreEndModal({ total, lines, onClose }: { total: number; lines: number; onClose: () => void }) {
  const avg = lines > 0 ? Math.round(total / lines) : 0;
  const stars = avg >= 85 ? '⭐⭐⭐' : avg >= 65 ? '⭐⭐' : '⭐';
  const label = avg >= 85 ? 'Шикарно!' : avg >= 65 ? 'Хорошо!' : 'Неплохо!';
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }} />
      <motion.div initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 201,
          background: 'linear-gradient(160deg,#0f0820,#1a0a3a)', border: '1px solid rgba(167,139,250,0.3)',
          borderRadius: 28, padding: '36px 32px', minWidth: 280, textAlign: 'center', fontFamily: '"Montserrat",sans-serif' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{stars}</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20 }}>Выступление завершено</div>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#a78bfa' }}>{total}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>всего баллов</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: avg >= 85 ? '#fbbf24' : avg >= 65 ? '#4ade80' : '#c4b5fd' }}>{avg}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>средний балл</div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#38bdf8' }}>{lines}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>строф спето</div>
          </div>
        </div>
        <motion.button whileTap={{ scale: 0.95 }} onClick={onClose}
          style={{ padding: '12px 32px', borderRadius: 100, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#db2777)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif' }}>
          Закрыть
        </motion.button>
      </motion.div>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   SONG CATALOG MODAL
══════════════════════════════════════════════════════ */
function SongCatalog({ onSelect, onClose }: { onSelect: (s: Song) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [artistSug, setArtistSug] = useState<string[]>([]);
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [letterFilter, setLetterFilter] = useState('');
  const [view, setView] = useState<'search'|'alpha'>('search');
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 100); }, []);

  useEffect(() => {
    if (!query.trim()) { setArtistSug([]); return; }
    const q = query.toLowerCase();
    const matches = POPULAR_ARTISTS.filter(a => a.toLowerCase().includes(q)).slice(0, 6);
    setArtistSug(matches);
  }, [query]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/karaoke/search?q=${encodeURIComponent(q)}`);
      const d = await r.json();
      setResults(d.results || []);
    } catch { setResults([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => doSearch(query), 500);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [query, doSearch]);

  const handleAlpha = async (letter: string) => {
    setLetterFilter(letter);
    setView('alpha');
    await doSearch(letter);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#07071a', display: 'flex', flexDirection: 'column', zIndex: 600, fontFamily: '"Montserrat",sans-serif' }}>
      {/* Header */}
      <div style={{ padding: '48px 16px 0', background: 'rgba(8,8,24,0.98)', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
            style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 16, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>←</motion.button>
          <div style={{ flex: 1, fontWeight: 900, fontSize: 17, color: '#fff' }}>🎵 Выбрать песню</div>
        </div>
        <div style={{ position: 'relative' }}>
          <input ref={inputRef} value={query} onChange={e => { setQuery(e.target.value); setView('search'); }}
            placeholder="Исполнитель или название..."
            style={{ width: '100%', padding: '12px 40px 12px 14px', borderRadius: 14, border: '1px solid rgba(124,58,237,0.4)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 15, fontFamily: '"Montserrat",sans-serif', outline: 'none', boxSizing: 'border-box' }} />
          {query && (
            <button onClick={() => { setQuery(''); setResults([]); setArtistSug([]); }} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 18, cursor: 'pointer' }}>×</button>
          )}
        </div>

        <AnimatePresence>
          {artistSug.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ background: 'rgba(20,10,40,0.98)', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 12, marginTop: 4, overflow: 'hidden', zIndex: 10, position: 'relative' }}>
              {artistSug.map(a => (
                <div key={a} onClick={() => { setQuery(a); setArtistSug([]); doSearch(a); }}
                  style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 14, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16 }}>🎤</span> {a}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ overflowX: 'auto', display: 'flex', gap: 4, marginTop: 10, paddingBottom: 4 }}>
          {ALPHABET.slice(0, 33).map(l => (
            <motion.button key={l} whileTap={{ scale: 0.9 }} onClick={() => handleAlpha(l)}
              style={{ minWidth: 28, height: 28, borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 12, fontFamily: '"Montserrat",sans-serif',
                background: letterFilter === l && view === 'alpha' ? 'linear-gradient(135deg,#7c3aed,#db2777)' : 'rgba(255,255,255,0.07)',
                color: letterFilter === l && view === 'alpha' ? '#fff' : 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
              {l}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px 100px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 32, color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>🔍 Ищу...</div>
        )}

        {!loading && results.length === 0 && !query && (
          <div style={{ paddingTop: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', marginBottom: 10 }}>ПОПУЛЯРНЫЕ ИСПОЛНИТЕЛИ</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {POPULAR_ARTISTS.slice(0, 20).map(a => (
                <motion.button key={a} whileTap={{ scale: 0.95 }} onClick={() => { setQuery(a); doSearch(a); }}
                  style={{ padding: '8px 14px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.8)', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif' }}>
                  {a}
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {!loading && results.length === 0 && query && (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>
            <div style={{ fontSize: 40 }}>🎵</div>
            <div style={{ marginTop: 8 }}>Ничего не нашлось.<br />Попробуй другой запрос</div>
          </div>
        )}

        {results.map(song => (
          <motion.div key={song.id} whileTap={{ scale: 0.97 }} onClick={() => onSelect(song)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer' }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'linear-gradient(135deg,#3b1086,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
              {song.hasSynced ? '🎤' : '🎵'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{song.artist}{song.album ? ` · ${song.album}` : ''}</div>
            </div>
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              {song.duration > 0 && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)' }}>{fmtTime(song.duration)}</div>}
              {song.hasSynced && <div style={{ fontSize: 10, color: '#a78bfa', marginTop: 2 }}>синхронно</div>}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   KARAOKE ROOM
══════════════════════════════════════════════════════ */
export function KaraokeRoom({ roomId, myHash, myName, onLeave }: { roomId: string; myHash: string; myName: string; onLeave: () => void }) {
  const wsRef = useRef<WebSocket | null>(null);
  const lyricsRef = useRef<HTMLDivElement | null>(null);
  const lrcRef = useRef<LrcLine[]>([]);
  const rafRef = useRef<number>(0);
  const startTsRef = useRef<number>(0);
  const startCtRef = useRef<number>(0);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  /* Audio graph refs */
  const rawStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const graphCleanupRef = useRef<(() => void) | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recordingRef = useRef(false); /* always-current mirror of `recording` state for closures */
  /* For listeners' audio playback */
  const listenerCtxRef = useRef<AudioContext | null>(null);

  const [room, setRoom] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [connected, setConnected] = useState(false);
  const [lrcLines, setLrcLines] = useState<LrcLine[]>([]);
  const [curLine, setCurLine] = useState(-1);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [song, setSong] = useState<Song | null>(null);
  const [songThumb, setSongThumb] = useState<string | null>(null);
  const [songEmbedUrl, setSongEmbedUrl] = useState<string | null>(null);
  const [songVideoUrl, setSongVideoUrl] = useState<string | null>(null);
  const [loadingSong, setLoadingSong] = useState(false);
  const [noAudio, setNoAudio] = useState(false);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [singerHash, setSingerHash] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recBlobUrl, setRecBlobUrl] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [chatText, setChatText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [voicePreset, setVoicePreset] = useState<VoicePreset>(VOICE_PRESETS[0]);
  const [showEffects, setShowEffects] = useState(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  /* Reactions */
  const [floatReactions, setFloatReactions] = useState<FloatReaction[]>([]);

  /* Pitch scoring */
  const [scoreTotal, setScoreTotal] = useState(0);
  const [scoredLines, setScoredLines] = useState(0);
  const [scoreAnims, setScoreAnims] = useState<ScoreAnim[]>([]);
  const [showScoreEnd, setShowScoreEnd] = useState(false);
  const prevLineRef = useRef(-1);
  const lineRmsRef = useRef<number[]>([]);

  /* Charts */
  const [charts, setCharts] = useState<{ top: ChartTrack[]; newSongs: ChartTrack[] }>({ top: [], newSongs: [] });
  const [chartsLoading, setChartsLoading] = useState(true);

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 3200); };
  const send = (p: unknown) => { if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(p)); };

  const myHash2 = myHash;
  const isHost = room?.hostHash === myHash2;
  const isSinger = singerHash === myHash2;
  const currentSingerName = members.find(m => m.hash === singerHash)?.name || singerHash || '';

  /* ── Listener audio playback (receive processed chunks from singer) ── */
  const playChunk = useCallback(async (b64: string) => {
    if (!listenerCtxRef.current) listenerCtxRef.current = new AudioContext();
    const ctx = listenerCtxRef.current;
    if (ctx.state === 'suspended') await ctx.resume();
    try {
      const bin = atob(b64);
      const ab = new ArrayBuffer(bin.length);
      const u8 = new Uint8Array(ab);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
      const decoded = await ctx.decodeAudioData(ab);
      const src = ctx.createBufferSource();
      src.buffer = decoded;
      src.connect(ctx.destination);
      src.start();
    } catch { /* */ }
  }, []);

  /* ── WebSocket ── */
  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/api/ws/cinema?token=${encodeURIComponent(getTok())}&hash=${encodeURIComponent(myHash)}&room=${roomId}`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'init') {
          setRoom(msg.room);
          setMembers(msg.members || []);
          setMessages((msg.messages || []).filter((m: any) => !m.text?.startsWith('__')));
        }
        if (msg.type === 'member_joined') { setMembers(msg.members); showToast(`👋 ${msg.name} вошёл`); }
        if (msg.type === 'member_left') { setMembers(msg.members); }
        if (msg.type === 'chat') { if (!msg.message?.text?.startsWith('__')) setMessages(p => [...p.slice(-199), msg.message]); }
        if (msg.type === 'play') { startTsRef.current = Date.now() - msg.currentTime * 1000; startCtRef.current = msg.currentTime; setIsPlaying(true); setCurrentTime(msg.currentTime); }
        if (msg.type === 'pause') { setIsPlaying(false); setCurrentTime(msg.currentTime); startCtRef.current = msg.currentTime; }
        if (msg.type === 'seek') { startTsRef.current = Date.now() - msg.currentTime * 1000; startCtRef.current = msg.currentTime; setCurrentTime(msg.currentTime); }
        if (msg.type === 'sync_state') { setCurrentTime(msg.currentTime); setIsPlaying(msg.isPlaying); if (msg.isPlaying) { startTsRef.current = Date.now() - msg.currentTime * 1000; startCtRef.current = msg.currentTime; } }
        if (msg.type === 'relay' && msg.payload) {
          const p = msg.payload;
          if (p.type === 'karaoke_song') {
            setSong(p.song || null);
            setSongVideoUrl(p.videoUrl || null);
            setSongEmbedUrl(p.embedUrl || null);
            setSongThumb(p.thumb || null);
            setNoAudio(!p.videoUrl && !p.embedUrl);
            const lines = parseLrc(p.lrc || '');
            setLrcLines(lines);
            lrcRef.current = lines;
            setCurLine(-1);
            setCurrentTime(0);
          }
          if (p.type === 'karaoke_singer') { setSingerHash(p.singerHash || null); }
          if (p.type === 'karaoke_queue') { setQueue(p.queue || []); }
          if (p.type === 'singer_audio' && p.singerHash !== myHash2) { playChunk(p.data); }
          if (p.type === 'karaoke_reaction') {
            const fr: FloatReaction = { id: `${Date.now()}-${Math.random()}`, emoji: p.emoji, x: 8 + Math.random() * 82 };
            setFloatReactions(prev => [...prev.slice(-30), fr]);
            setTimeout(() => setFloatReactions(prev => prev.filter(r => r.id !== fr.id)), 3000);
          }
        }
        if (msg.type === 'request_sync' && isHost) {
          send({ type: 'sync_state', currentTime, isPlaying });
        }
      } catch { /* */ }
    };
    const ping = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' })); }, 20_000);
    return () => { clearInterval(ping); ws.close(); };
  }, [roomId, myHash2, isHost, currentTime, isPlaying, playChunk]);

  /* ── Lyrics scrubber RAF ── */
  useEffect(() => {
    if (!isPlaying) { cancelAnimationFrame(rafRef.current); return; }
    const tick = () => {
      const elapsed = (Date.now() - startTsRef.current) / 1000;
      const t = startCtRef.current + elapsed;
      setCurrentTime(t);
      setCurLine(curIdx(lrcRef.current, t));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying]);

  /* ── Auto-scroll lyrics ── */
  useEffect(() => {
    if (curLine < 0 || !lyricsRef.current) return;
    const el = lyricsRef.current.querySelector(`[data-l="${curLine}"]`) as HTMLElement | null;
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [curLine]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  /* ── Select song — fetches from karaokehit.ru (primary) + Rutube (fallback) ── */
  const selectSong = async (s: Song) => {
    setShowCatalog(false);
    setSong(s);
    setSingerHash(myHash2);
    setIsPlaying(false);
    setCurrentTime(0);
    setSongEmbedUrl(null);
    setSongVideoUrl(null);
    setSongThumb(null);
    setNoAudio(false);
    setLoadingSong(true);
    setScoreTotal(0); setScoredLines(0); setScoreAnims([]); setShowScoreEnd(false);
    prevLineRef.current = -1; lineRmsRef.current = [];
    showToast(`Загружается песня...`);

    const [lrcData, khitData] = await Promise.allSettled([
      fetch(`${API}/api/karaoke/lyrics/${s.id}`).then(r => r.json()),
      fetch(`${API}/api/karaoke/khit-embed?artist=${encodeURIComponent(s.artist)}&title=${encodeURIComponent(s.title)}`).then(r => r.json()),
    ]);

    const lrc = lrcData.status === 'fulfilled' ? (lrcData.value.syncedLyrics || lrcData.value.plainLyrics || '') : '';
    const lines = parseLrc(lrc);
    setLrcLines(lines);
    lrcRef.current = lines;

    let embedUrl: string | null = null;
    let videoUrl: string | null = null;
    let thumb: string | null = null;

    if (khitData.status === 'fulfilled') {
      videoUrl = khitData.value.videoUrl || null;
      embedUrl = khitData.value.embedUrl || null;
      thumb    = khitData.value.thumb || null;
    }

    setSongVideoUrl(videoUrl);
    setSongEmbedUrl(embedUrl);
    setSongThumb(thumb);
    setNoAudio(!videoUrl && !embedUrl);
    setLoadingSong(false);

    if (videoUrl || embedUrl) showToast(`🎵 ${s.artist} — ${s.title}`);
    else showToast(`🎤 ${s.artist} — ${s.title} · а капелла`);

    const songWithThumb = { ...s, thumb };
    send({ type: 'relay', payload: { type: 'karaoke_song', song: songWithThumb, lrc, embedUrl, videoUrl, thumb, singerHash: myHash2 } });
    send({ type: 'relay', payload: { type: 'karaoke_singer', singerHash: myHash2 } });
  };

  /* ── Select song by artist+title (from charts) ── */
  const selectSongByTitle = async (artist: string, title: string) => {
    /* If someone else is currently singing — add to queue instead of taking over */
    const currentSingerSnap = singerHash;
    if (currentSingerSnap && currentSingerSnap !== myHash2) {
      showToast('🔍 Загружаю для очереди...');
    } else {
      showToast('🔍 Загружаю...');
    }
    try {
      const r = await fetch(`${API}/api/karaoke/search?q=${encodeURIComponent(`${artist} ${title}`)}`);
      const d = await r.json();
      const results: Song[] = d.results || [];
      const a0 = artist.toLowerCase().split(/\s+/)[0];
      const t0 = title.toLowerCase().split(/\s+/)[0];
      const best = results.find(s =>
        s.artist.toLowerCase().includes(a0) && s.title.toLowerCase().includes(t0)
      ) || results.find(s => s.artist.toLowerCase().includes(a0))
        || results[0];
      const songToPlay: Song = best
        ? { ...best, artist, title }
        : { id: 0, artist, title, album: '', duration: 240, hasSynced: false };
      /* Queue if someone else is singing; otherwise sing directly */
      if (currentSingerSnap && currentSingerSnap !== myHash2) {
        addToQueue(songToPlay);
      } else {
        selectSong(songToPlay);
      }
    } catch { showToast('⚠️ Ошибка поиска'); }
  };

  /* ── Add to queue ── */
  const addToQueue = async (s: Song) => {
    setShowCatalog(false);
    const entry: QueueEntry = { id: `${Date.now()}-${Math.random()}`, userHash: myHash2, userName: myName, song: s };
    const newQueue = [...queue, entry];
    setQueue(newQueue);
    send({ type: 'relay', payload: { type: 'karaoke_queue', queue: newQueue } });
    showToast(`📋 ${s.artist} — ${s.title} добавлена в очередь`);
  };

  const singFromQueue = (entry: QueueEntry) => {
    const newQueue = queue.filter(q => q.id !== entry.id);
    setQueue(newQueue);
    send({ type: 'relay', payload: { type: 'karaoke_queue', queue: newQueue } });
    selectSong(entry.song);
  };

  /* ── Teardown audio graph ── */
  const teardownGraph = () => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    graphCleanupRef.current?.();
    graphCleanupRef.current = null;
    rawStreamRef.current?.getTracks().forEach(t => t.stop());
    rawStreamRef.current = null;
    processedStreamRef.current = null;
    analyserRef.current = null;
    setAnalyserNode(null);
  };

  /* ── Mic: start singing with effects ── */
  const startMic = async () => {
    try {
      const rawStream = await navigator.mediaDevices.getUserMedia({
        /* Disable browser-level processing — we handle it in the Web Audio graph.
           echoCancellation MUST be false: if true, the browser hears the monitor
           output through the speaker and cancels it from the mic input, making
           the recording completely silent. */
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
      });
      rawStreamRef.current = rawStream;

      const ctx = new AudioContext({ sampleRate: 44100 });
      if (ctx.state === 'suspended') await ctx.resume();
      audioCtxRef.current = ctx;

      const graph = buildAudioGraph(ctx, rawStream, voicePreset);
      graphCleanupRef.current = graph.cleanup;
      analyserRef.current = graph.analyser;
      processedStreamRef.current = graph.processedStream;
      setAnalyserNode(graph.analyser);

      /* Record the processed stream for relay */
      const mimeTypes = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg','audio/mp4',''];
      const mimeType = mimeTypes.find(t => !t || MediaRecorder.isTypeSupported(t)) ?? '';
      const mrOpts = mimeType ? { mimeType, bitsPerSecond: 128000 } : {};
      const mr = new MediaRecorder(graph.processedStream, mrOpts);
      mr.onerror = () => showToast('⚠️ Ошибка MediaRecorder — обнови браузер');
      mr.ondataavailable = async (ev) => {
        if (!ev.data || ev.data.size < 1) return;
        if (recordingRef.current) recChunksRef.current.push(ev.data);
        try {
          const ab = await ev.data.arrayBuffer();
          const b64 = ab2b64(ab);
          send({ type: 'relay', payload: { type: 'singer_audio', singerHash: myHash2, data: b64 } });
        } catch { /* relay failed, recording still works */ }
      };
      mr.start(250);
      recorderRef.current = mr;

      setMicActive(true);
      setSingerHash(myHash2);
      send({ type: 'relay', payload: { type: 'karaoke_singer', singerHash: myHash2 } });
      showToast(`🎤 Эффект: ${voicePreset.label} · Тебя слышат!`);
    } catch {
      showToast('⚠️ Нет доступа к микрофону');
    }
  };

  const stopMic = () => {
    teardownGraph();
    setMicActive(false);
    send({ type: 'relay', payload: { type: 'karaoke_singer', singerHash: null } });
    if (scoredLines > 0) {
      setShowScoreEnd(true);
    } else {
      showToast('🎤 Микрофон выключен');
    }
  };

  /* ── Rebuild graph when preset changes while mic is on ── */
  const changePreset = async (p: VoicePreset) => {
    setVoicePreset(p);
    if (micActive && rawStreamRef.current && audioCtxRef.current) {
      graphCleanupRef.current?.();
      const graph = buildAudioGraph(audioCtxRef.current, rawStreamRef.current, p);
      graphCleanupRef.current = graph.cleanup;
      analyserRef.current = graph.analyser;
      setAnalyserNode(graph.analyser);
      processedStreamRef.current = graph.processedStream;

      recorderRef.current?.stop();
      const mimeTypes2 = ['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/ogg','audio/mp4',''];
      const mimeType2 = mimeTypes2.find(t => !t || MediaRecorder.isTypeSupported(t)) ?? '';
      const mrOpts2 = mimeType2 ? { mimeType: mimeType2, bitsPerSecond: 128000 } : {};
      const mr = new MediaRecorder(graph.processedStream, mrOpts2);
      mr.onerror = () => showToast('⚠️ Ошибка MediaRecorder — обнови браузер');
      mr.ondataavailable = async (ev) => {
        if (!ev.data || ev.data.size < 1) return;
        if (recordingRef.current) recChunksRef.current.push(ev.data);
        try {
          const ab = await ev.data.arrayBuffer();
          const b64 = ab2b64(ab);
          send({ type: 'relay', payload: { type: 'singer_audio', singerHash: myHash2, data: b64 } });
        } catch { /* relay failed */ }
      };
      mr.start(250);
      recorderRef.current = mr;
      showToast(`✨ ${p.emoji} ${p.label}`);
    }
  };

  /* ── Stable blob URL for audio playback (never recreate on every render) ── */
  useEffect(() => {
    if (!recordingBlob) { setRecBlobUrl(null); return; }
    const url = URL.createObjectURL(recordingBlob);
    setRecBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recordingBlob]);

  /* ── Recording ── */
  const startRecording = async () => {
    if (!micActive) await startMic();
    recChunksRef.current = [];
    recordingRef.current = true;
    setRecording(true);
    setRecordingBlob(null);
    showToast('⏺ Запись началась');
  };

  const stopRecording = () => {
    recordingRef.current = false;
    setRecording(false);
    /* Flush the last buffered chunk before collecting */
    try { recorderRef.current?.requestData(); } catch { /* */ }
    setTimeout(() => {
      const mimeType = recorderRef.current?.mimeType || 'audio/webm';
      const blob = new Blob(recChunksRef.current, { type: mimeType });
      if (blob.size > 0) {
        setRecordingBlob(blob);
        showToast('✅ Запись сохранена');
      } else {
        showToast('⚠️ Запись пуста — убедись что микрофон работает');
      }
      recChunksRef.current = [];
    }, 600);
  };

  const downloadRecording = () => {
    if (!recordingBlob) return;
    const url = URL.createObjectURL(recordingBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${song?.artist || 'karaoke'} - ${song?.title || 'запись'}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    /* Revoke after a delay — synchronous revoke kills download on mobile */
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  /* ── Host playback controls ── */
  const hostPlay = () => {
    const t = currentTime;
    startTsRef.current = Date.now() - t * 1000;
    startCtRef.current = t;
    setIsPlaying(true);
    send({ type: 'play', currentTime: t });
  };
  const hostPause = () => {
    setIsPlaying(false);
    startCtRef.current = currentTime;
    send({ type: 'pause', currentTime });
  };
  const hostSeek = (t: number) => {
    startTsRef.current = Date.now() - t * 1000;
    startCtRef.current = t;
    setCurrentTime(t);
    send({ type: 'seek', currentTime: t });
  };

  const sendChat = () => { const t = chatText.trim(); if (!t) return; send({ type: 'chat', text: t }); setChatText(''); };

  const sendReaction = (emoji: string) => {
    const fr: FloatReaction = { id: `${Date.now()}-${Math.random()}`, emoji, x: 8 + Math.random() * 82 };
    setFloatReactions(prev => [...prev.slice(-30), fr]);
    setTimeout(() => setFloatReactions(prev => prev.filter(r => r.id !== fr.id)), 3000);
    send({ type: 'relay', payload: { type: 'karaoke_reaction', emoji } });
  };

  const totalDur = lrcLines.length > 0 ? lrcLines[lrcLines.length - 1].time + 8 : (song?.duration || 240);

  /* ── Fetch charts on mount ── */
  useEffect(() => {
    fetch(`${API}/api/karaoke/charts`)
      .then(r => r.json())
      .then(d => { setCharts({ top: d.top || [], newSongs: d.new || [] }); setChartsLoading(false); })
      .catch(() => setChartsLoading(false));
  }, []);

  /* ── Cleanup on unmount ── */
  useEffect(() => () => { teardownGraph(); }, []);

  /* ── Auto-advance queue: when singer finishes and my next song is first ── */
  const queueRef = useRef(queue);
  queueRef.current = queue;
  const singFromQueueRef = useRef(singFromQueue);
  singFromQueueRef.current = singFromQueue;
  useEffect(() => {
    if (singerHash) return undefined; /* someone is still singing */
    const q = queueRef.current;
    if (q.length > 0 && q[0].userHash === myHash2) {
      showToast('🎤 Ваша очередь! Начинаю...');
      const t = setTimeout(() => singFromQueueRef.current(queueRef.current[0]), 2200);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [singerHash]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Pitch sampling: collect RMS while mic is on ── */
  useEffect(() => {
    if (!micActive || !analyserNode) return;
    const id = setInterval(() => {
      const { rms } = detectPitch(analyserNode);
      if (rms > 0.015) lineRmsRef.current.push(rms);
    }, 100);
    return () => clearInterval(id);
  }, [micActive, analyserNode]);

  /* ── Score on every LRC line advance (only while singing) ── */
  useEffect(() => {
    if (!micActive || curLine <= 0 || curLine === prevLineRef.current) return;
    prevLineRef.current = curLine;
    const samples = lineRmsRef.current.splice(0);
    if (samples.length < 4) return;
    const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
    const mean = avg;
    const variance = samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length;
    const stability = Math.max(0, 1 - variance * 120);
    const vol = Math.min(1, avg / 0.1);
    const pts = Math.min(100, Math.max(30, Math.round(38 + vol * 37 + stability * 25)));
    const anim: ScoreAnim = { id: `sa-${Date.now()}`, pts, x: 25 + Math.random() * 50 };
    setScoreAnims(prev => [...prev.slice(-6), anim]);
    setTimeout(() => setScoreAnims(prev => prev.filter(a => a.id !== anim.id)), 2000);
    setScoreTotal(prev => prev + pts);
    setScoredLines(prev => prev + 1);
  }, [curLine, micActive]);

  if (showCatalog) {
    return (
      <SongCatalog
        onSelect={(s) => {
          if (!singerHash || singerHash === myHash2) selectSong(s);
          else addToQueue(s);
        }}
        onClose={() => setShowCatalog(false)}
      />
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(ellipse at 30% 0%, #12002a 0%, #04000f 50%, #000812 100%)', display: 'flex', flexDirection: 'column', fontFamily: '"Montserrat",sans-serif', zIndex: 500, overflow: 'hidden' }}>
      {/* Ambient neon blobs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle,rgba(124,58,237,0.12) 0%,transparent 70%)', top: -80, left: -60 }} />
        <div style={{ position: 'absolute', width: 240, height: 240, borderRadius: '50%', background: 'radial-gradient(circle,rgba(219,39,119,0.1) 0%,transparent 70%)', top: 200, right: -40 }} />
        <div style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle,rgba(8,145,178,0.08) 0%,transparent 70%)', bottom: 100, left: 30 }} />
      </div>

      {/* Overlays: floating reactions + score floats + score end modal */}
      <FloatingReactionsOverlay reactions={floatReactions} />
      <ScoreFloats anims={scoreAnims} />
      <AnimatePresence>
        {showScoreEnd && (
          <ScoreEndModal total={scoreTotal} lines={scoredLines} onClose={() => { setShowScoreEnd(false); setScoreTotal(0); setScoredLines(0); }} />
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 10, padding: '48px 16px 12px', background: 'rgba(4,0,15,0.92)', borderBottom: '1px solid rgba(124,58,237,0.18)', flexShrink: 0, backdropFilter: 'blur(12px)' }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onLeave}
          style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(124,58,237,0.35)', background: 'rgba(124,58,237,0.1)', cursor: 'pointer', fontSize: 16, color: '#c4b5fd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>←</motion.button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 14, filter: 'drop-shadow(0 0 6px rgba(219,39,119,0.8))' }}>🎤</span>
            <span style={{ fontWeight: 900, fontSize: 13, background: 'linear-gradient(90deg,#c4b5fd,#f9a8d4)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '0.03em' }}>Дружеское Кара-Оке</span>
          </div>
          <div style={{ fontSize: 10, color: connected ? '#4ade80' : '#f87171', marginTop: 1 }}>● {connected ? `${members.length} в комнате` : 'Подключение...'}</div>
        </div>
        <div style={{ display: 'flex', gap: 3 }}>{members.slice(0, 4).map(m => <Av key={m.hash} name={m.name} size={24} />)}</div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowEffects(v => !v)}
          style={{ width: 34, height: 34, borderRadius: '50%', border: `1.5px solid ${showEffects ? voicePreset.color : 'rgba(124,58,237,0.3)'}`, background: showEffects ? `${voicePreset.color}22` : 'rgba(124,58,237,0.08)', cursor: 'pointer', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {voicePreset.emoji}
        </motion.button>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowCatalog(true)}
          style={{ padding: '8px 16px', borderRadius: 100, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#db2777)', color: '#fff', fontWeight: 900, fontSize: 12, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif', flexShrink: 0, boxShadow: '0 0 16px rgba(124,58,237,0.4)' }}>
          + Выбрать
        </motion.button>
      </div>

      {/* Effects panel — toggled by emoji button */}
      <AnimatePresence>
        {showEffects && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', flexShrink: 0 }}>
            <EffectsPanel current={voicePreset.id} onChange={p => { changePreset(p); }} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backing track — loading / iframe / a cappella notice */}
      {loadingSong && (
        <div style={{ height: 80, flexShrink: 0, background: 'rgba(10,5,25,0.98)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            style={{ width: 22, height: 22, borderRadius: '50%', border: '3px solid rgba(167,139,250,0.2)', borderTopColor: '#a78bfa' }} />
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: '"Montserrat",sans-serif' }}>Загружается песня...</span>
        </div>
      )}
      {!loadingSong && (songVideoUrl || songEmbedUrl) && (
        <div style={{ height: 220, flexShrink: 0, background: '#000', position: 'relative' }}>
          {songVideoUrl ? (
            /* ── Прямой CDN-плеер karaokehit.ru — только видео, без сайта ── */
            <video
              key={songVideoUrl}
              src={songVideoUrl}
              controls
              autoPlay
              playsInline
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', background: '#000' }}
            />
          ) : (
            /* ── Rutube или iframe-fallback ── */
            <iframe key={songEmbedUrl!} src={songEmbedUrl!} allow="autoplay; fullscreen"
              allowFullScreen sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-presentation"
              style={{ width: '100%', height: '100%', border: 'none' }} title="Каракоке" />
          )}
          {/* Stage spotlight overlay */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'radial-gradient(ellipse 70% 60% at 50% 100%,rgba(167,139,250,0.06) 0%,transparent 70%)' }} />
        </div>
      )}
      {!loadingSong && noAudio && song && (
        <div style={{ flexShrink: 0, padding: '8px 16px', background: 'rgba(10,5,25,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🎤</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: '"Montserrat",sans-serif' }}>Видео не найдено — поёте а капелла</span>
        </div>
      )}

      {/* Visualizer — shows when mic is on */}
      <StageVisualizer analyser={analyserNode} preset={voicePreset} active={micActive} />

      {/* Song info + controls */}
      <div style={{ background: 'linear-gradient(180deg,#0f0820 0%,#05050c 100%)', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        {song ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            {/* Thumbnail from karaokehit.ru or gradient fallback */}
            {songThumb ? (
              <img src={songThumb} alt="" style={{ width: 46, height: 46, borderRadius: 12, objectFit: 'cover', flexShrink: 0 }} />
            ) : (
              <div style={{ width: 46, height: 46, borderRadius: 12, background: 'linear-gradient(135deg,#be185d,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🎤</div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 14, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{song.title}</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>{song.artist}</div>
            </div>
            {micActive && scoredLines > 0 && (
              <div style={{ textAlign: 'center', flexShrink: 0, minWidth: 52 }}>
                <div style={{ fontWeight: 900, fontSize: 18, color: scoreTotal / scoredLines >= 85 ? '#fbbf24' : scoreTotal / scoredLines >= 65 ? '#4ade80' : '#a78bfa', lineHeight: 1 }}>{scoreTotal}</div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>баллов</div>
              </div>
            )}
            {singerHash && (
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <Av name={currentSingerName || '?'} size={28} />
                <div style={{ fontSize: 9, color: '#a78bfa', marginTop: 2, fontWeight: 700 }}>поёт</div>
              </div>
            )}
          </div>
        ) : (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
            style={{ textAlign: 'center', padding: '10px 0 6px' }}>
            <div style={{ fontSize: 11, color: 'rgba(167,139,250,0.6)', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Выберите песню и начните петь
            </div>
          </motion.div>
        )}

        {/* Scrubber */}
        {song && lrcLines.length > 0 && (
          <>
            <input type="range" min={0} max={totalDur} value={Math.min(currentTime, totalDur)} onChange={e => isHost && hostSeek(Number(e.target.value))} disabled={!isHost}
              style={{ width: '100%', accentColor: '#a855f7', cursor: isHost ? 'pointer' : 'default', height: 3, display: 'block', marginBottom: 4 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}>
              <span>{fmtTime(currentTime)}</span><span>{fmtTime(totalDur)}</span>
            </div>
          </>
        )}

        {/* Controls row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          {isHost && song && (
            <>
              <motion.button whileTap={{ scale: 0.88 }} onClick={() => hostSeek(0)}
                style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 14, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⏮</motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={isPlaying ? hostPause : hostPlay}
                style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,#be185d,#7c3aed)', cursor: 'pointer', fontSize: 22, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 18px rgba(190,24,93,0.5)' }}>
                {isPlaying ? '⏸' : '▶'}
              </motion.button>
            </>
          )}

          {/* Mic — singer only */}
          {(isSinger || !singerHash) && song && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={micActive ? stopMic : startMic}
              animate={{ boxShadow: micActive ? ['0 0 0px rgba(239,68,68,0)', `0 0 20px ${voicePreset.color}`, '0 0 0px rgba(239,68,68,0)'] : '0 0 0px rgba(0,0,0,0)' }}
              transition={{ repeat: micActive ? Infinity : 0, duration: 1.2 }}
              style={{ width: 52, height: 52, borderRadius: '50%',
                background: micActive ? voicePreset.color : 'rgba(239,68,68,0.15)',
                border: `2px solid ${micActive ? voicePreset.color : 'rgba(239,68,68,0.4)'}`,
                cursor: 'pointer', fontSize: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              🎤
            </motion.button>
          )}

          {/* Record */}
          {(isSinger || micActive) && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={recording ? stopRecording : startRecording}
              style={{ width: 44, height: 44, borderRadius: '50%', border: `2px solid ${recording ? '#f87171' : 'rgba(255,255,255,0.15)'}`, background: recording ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {recording ? '⏹' : '⏺'}
            </motion.button>
          )}

          {!isHost && song && (
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => send({ type: 'request_sync' })}
              style={{ padding: '8px 14px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif' }}>🔄 Синк</motion.button>
          )}
        </div>

        {/* Recording blob */}
        <AnimatePresence>
          {recordingBlob && !recording && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ marginTop: 10, padding: '10px 12px', borderRadius: 12, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>🎙</span>
              <div style={{ flex: 1, fontSize: 12, color: '#4ade80', fontWeight: 700 }}>Запись готова!</div>
              {recBlobUrl && <audio key={recBlobUrl} src={recBlobUrl} controls style={{ height: 28, flex: 1 }} />}
              <motion.button whileTap={{ scale: 0.9 }} onClick={downloadRecording}
                style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#22c55e', color: '#000', fontWeight: 800, fontSize: 11, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif', flexShrink: 0 }}>⬇ Скачать</motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reaction bar — always visible for all users */}
        <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 8, flexWrap: 'nowrap', overflowX: 'auto' }}>
          {REACTION_EMOJIS.map(emoji => (
            <motion.button key={emoji} whileTap={{ scale: 1.5 }} onClick={() => sendReaction(emoji)}
              style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.07)', cursor: 'pointer', fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {emoji}
            </motion.button>
          ))}
        </div>

        <AnimatePresence>
          {toast && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>{toast}</motion.div>}
        </AnimatePresence>

        {/* My queue position banner — visible when I'm waiting */}
        {(() => {
          const myIdx = queue.findIndex((e: QueueEntry) => e.userHash === myHash2);
          if (myIdx === -1 || !singerHash || singerHash === myHash2) return null;
          const pos = myIdx === 0 ? 'следующая — приготовься!' : myIdx === 1 ? 'через одну песню' : `через ${myIdx} ${myIdx < 5 ? 'песни' : 'песен'}`;
          const myEntry = queue[myIdx];
          return (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              style={{ marginTop: 8, padding: '8px 12px', borderRadius: 12,
                background: 'rgba(124,58,237,0.14)', border: '1px solid rgba(167,139,250,0.3)',
                display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15 }}>📍</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#c4b5fd' }}>Ваша очередь: {pos}</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {myEntry.song.artist} — {myEntry.song.title}
                </div>
              </div>
            </motion.div>
          );
        })()}
      </div>

      {/* Lyrics + Queue + Chat + Charts */}
      <LyricsAndChat
        lrcLines={lrcLines} curLine={curLine} lyricsRef={lyricsRef}
        queue={queue} myHash={myHash2} onSingQueue={singFromQueue}
        messages={messages} chatText={chatText} setChatText={setChatText}
        sendChat={sendChat} chatEndRef={chatEndRef}
        members={members} singerHash={singerHash} hasSong={!!song}
        charts={charts} chartsLoading={chartsLoading}
        onSelectChart={selectSongByTitle}
      />
    </div>
  );
}

/* ── Lyrics + Chat + Queue + Charts area ── */
function LyricsAndChat({ lrcLines, curLine, lyricsRef, queue, myHash, onSingQueue, messages, chatText, setChatText, sendChat, chatEndRef, members, singerHash, hasSong, charts, chartsLoading, onSelectChart }: any) {
  const [tab, setTab] = useState<'charts'|'lyrics'|'queue'|'chat'>('charts');
  const [chartsTab, setChartsTab] = useState<'top'|'new'>('top');

  useEffect(() => {
    if (hasSong && lrcLines.length > 0) setTab('lyrics');
    else if (!hasSong) setTab('charts');
  }, [hasSong, lrcLines.length]);

  const tabList = [
    { id: 'charts', label: '🔥 Чарты' },
    { id: 'lyrics', label: `🎤 Текст${lrcLines.length ? '' : ' (нет)'}` },
    { id: 'queue', label: `📋 (${queue.length})` },
    { id: 'chat', label: `💬 Чат` },
  ];

  const trackList: any[] = tab === 'charts' ? (chartsTab === 'top' ? (charts?.top || []) : (charts?.newSongs || [])) : [];

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', zIndex: 2 }}>
      <div style={{ display: 'flex', gap: 4, padding: '8px 12px 0', background: 'rgba(4,0,15,0.94)', flexShrink: 0, borderTop: '1px solid rgba(124,58,237,0.12)' }}>
        {tabList.map(t => (
          <motion.button key={t.id} whileTap={{ scale: 0.95 }} onClick={() => setTab(t.id as any)}
            style={{ flex: 1, padding: '7px 0', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 11, fontFamily: '"Montserrat",sans-serif',
              background: tab === t.id ? 'linear-gradient(135deg,rgba(124,58,237,0.4),rgba(219,39,119,0.25))' : 'rgba(255,255,255,0.04)',
              color: tab === t.id ? '#e9d5ff' : 'rgba(255,255,255,0.35)',
              borderBottom: tab === t.id ? '2px solid #a78bfa' : '2px solid transparent',
              marginBottom: 6, transition: 'all 0.2s' }}>
            {t.label}
          </motion.button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>

        {/* ── CHARTS TAB ── */}
        {tab === 'charts' && (
          <div style={{ padding: '0 0 80px' }}>
            {/* Sub-tabs: Топ / Новинки */}
            <div style={{ display: 'flex', gap: 8, padding: '12px 14px 8px' }}>
              {[{ id: 'top', label: '🏆 Топ за неделю' }, { id: 'new', label: '✨ Новинки' }].map(s => (
                <motion.button key={s.id} whileTap={{ scale: 0.95 }} onClick={() => setChartsTab(s.id as any)}
                  style={{ padding: '6px 14px', borderRadius: 20, border: `1px solid ${chartsTab === s.id ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.1)'}`, background: chartsTab === s.id ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.04)', color: chartsTab === s.id ? '#e9d5ff' : 'rgba(255,255,255,0.4)', fontWeight: 800, fontSize: 11, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif' }}>
                  {s.label}
                </motion.button>
              ))}
            </div>

            {chartsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}
                  style={{ width: 28, height: 28, borderRadius: '50%', border: '3px solid rgba(167,139,250,0.2)', borderTopColor: '#a78bfa', display: 'inline-block' }} />
                <div style={{ marginTop: 10, fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>Загружаю...</div>
              </div>
            ) : trackList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 16px', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎵</div>
                Чарты недоступны
              </div>
            ) : (
              <div style={{ padding: '0 10px' }}>
                {trackList.map((track: any, i: number) => (
                  <motion.div key={`${track.artist}-${track.title}`}
                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {/* Position */}
                    <div style={{ width: 24, textAlign: 'center', fontWeight: 900, fontSize: i < 3 ? 14 : 12,
                      color: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : i === 2 ? '#b45309' : 'rgba(255,255,255,0.3)',
                      flexShrink: 0, fontFamily: '"Montserrat",sans-serif' }}>
                      {i < 3 ? ['🥇','🥈','🥉'][i] : track.pos}
                    </div>
                    {/* Artist avatar */}
                    <div style={{ width: 38, height: 38, borderRadius: '50%', background: artistGrad(track.artist), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 900, fontSize: 13, color: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.4)' }}>
                      {artistInitials(track.artist)}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.title}</div>
                      <div style={{ fontSize: 11, color: 'rgba(167,139,250,0.7)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{track.artist}</div>
                    </div>
                    {/* Sing / Queue button — depends on whether someone is already singing */}
                    <motion.button whileTap={{ scale: 0.88 }} onClick={() => onSelectChart(track.artist, track.title)}
                      style={{ padding: '6px 12px', borderRadius: 20, border: 'none',
                        background: singerHash && singerHash !== myHash
                          ? 'rgba(124,58,237,0.35)' : 'linear-gradient(135deg,#7c3aed,#db2777)',
                        color: '#fff', fontWeight: 800, fontSize: 11, cursor: 'pointer',
                        fontFamily: '"Montserrat",sans-serif', flexShrink: 0,
                        boxShadow: '0 0 10px rgba(124,58,237,0.3)' }}>
                      {singerHash && singerHash !== myHash ? '+ Очередь' : 'Петь'}
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'lyrics' && (
          <div ref={lyricsRef} style={{ padding: '16px 16px 80px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {lrcLines.length === 0 && (
              <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 13, padding: '40px 0' }}>
                {hasSong ? 'Слова не найдены' : 'Выбери песню, чтобы видеть текст'}
              </div>
            )}
            {lrcLines.map((line: LrcLine, i: number) => {
              const isCur = i === curLine;
              const isNxt = i === curLine + 1;
              const isPast = i < curLine;
              return (
                <motion.div key={i} data-l={i}
                  animate={{ scale: isCur ? 1.05 : 1, opacity: isPast ? 0.25 : isCur ? 1 : isNxt ? 0.6 : 0.4 }}
                  transition={{ duration: 0.2 }}
                  style={{ textAlign: 'center', fontWeight: isCur ? 900 : isNxt ? 700 : 600,
                    fontSize: isCur ? 23 : isNxt ? 16 : 14,
                    color: isCur ? '#fff' : '#a78bfa',
                    padding: isCur ? '10px 0' : '3px 0',
                    lineHeight: 1.35,
                    textShadow: isCur ? '0 0 28px rgba(192,132,252,0.8),0 0 56px rgba(167,139,250,0.4)' : 'none',
                    fontFamily: '"Montserrat",sans-serif' }}>
                  {line.text}
                </motion.div>
              );
            })}
            <div style={{ height: 60 }} />
          </div>
        )}

        {tab === 'queue' && (
          <div style={{ padding: '10px 14px 80px' }}>
            {queue.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)', fontSize: 13 }}>
                <div style={{ fontSize: 36 }}>📋</div>
                <div style={{ marginTop: 8 }}>Очередь пуста</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', marginTop: 4 }}>
                  {singerHash ? 'Нажми «+ Очередь» в чартах, чтобы добавить песню' : 'Выбери песню — ты следующий!'}
                </div>
              </div>
            ) : (
              <>
                {/* Now singing + my position banner */}
                {singerHash && (
                  <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 14, background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)' }}>
                    <div style={{ fontSize: 12, color: '#c4b5fd', fontWeight: 700 }}>
                      🎤 Сейчас поёт: <span style={{ color: '#fff' }}>{members.find((m: Member) => m.hash === singerHash)?.name || '...'}</span>
                    </div>
                    {(() => {
                      const myIdx = queue.findIndex((e: QueueEntry) => e.userHash === myHash);
                      if (myIdx === -1) return null;
                      const pos = myIdx === 0 ? 'после этой песни' : myIdx === 1 ? 'через одну песню' : `через ${myIdx} ${myIdx < 5 ? 'песни' : 'песен'}`;
                      return (
                        <div style={{ fontSize: 11, color: 'rgba(167,139,250,0.8)', marginTop: 4, fontWeight: 700 }}>
                          📍 Ваша очередь: {pos}
                        </div>
                      );
                    })()}
                  </div>
                )}
                {queue.map((entry: QueueEntry, i: number) => {
                  const isMe = entry.userHash === myHash;
                  const isNext = i === 0;
                  const posLabel = i === 0 ? 'следующая' : i === 1 ? 'через одну' : `через ${i}`;
                  return (
                    <motion.div key={entry.id} whileTap={{ scale: 0.97 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 8px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        background: isMe ? 'rgba(124,58,237,0.07)' : 'transparent',
                        borderRadius: isMe ? 10 : 0, marginBottom: isMe ? 2 : 0 }}>
                      {/* Position badge */}
                      <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        background: isNext ? 'rgba(219,39,119,0.35)' : 'rgba(124,58,237,0.25)',
                        border: `1.5px solid ${isNext ? 'rgba(249,168,212,0.7)' : 'rgba(167,139,250,0.4)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 900, fontSize: isNext ? 13 : 12,
                        color: isNext ? '#f9a8d4' : '#c4b5fd' }}>
                        {isNext ? '▶' : i + 1}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 13, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.song.title}</div>
                        <div style={{ fontSize: 11, color: isMe ? 'rgba(167,139,250,0.85)' : 'rgba(255,255,255,0.38)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <span>{entry.song.artist}</span>
                          <span>·</span>
                          <span>{isMe ? '👤 Вы' : entry.userName}</span>
                          {singerHash && <><span>·</span><span style={{ color: isNext ? '#f9a8d4' : 'rgba(255,255,255,0.3)', fontWeight: isNext ? 700 : 400 }}>{posLabel}</span></>}
                        </div>
                      </div>
                      {/* Sing now button — only when no one is singing and it's my entry */}
                      {isMe && !singerHash && (
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => onSingQueue(entry)}
                          style={{ padding: '7px 14px', borderRadius: 10, border: 'none',
                            background: 'linear-gradient(135deg,#7c3aed,#db2777)',
                            color: '#fff', fontWeight: 800, fontSize: 11, cursor: 'pointer',
                            fontFamily: '"Montserrat",sans-serif', flexShrink: 0 }}>Петь</motion.button>
                      )}
                    </motion.div>
                  );
                })}
              </>
            )}
          </div>
        )}

        {tab === 'chat' && (
          <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.length === 0 && <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12, padding: '20px 0' }}>Пока тихо — напиши что-нибудь!</div>}
            {messages.map((m: any) => (
              <div key={m.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <Av name={m.userName || '?'} size={26} />
                <div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: m.userHash === myHash ? '#a78bfa' : '#fff', marginRight: 6 }}>{m.userHash === myHash ? 'Ты' : m.userName}</span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{m.text}</span>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {tab === 'chat' && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.07)', paddingBottom: 'calc(8px + env(safe-area-inset-bottom,0px))', display: 'flex', gap: 8, flexShrink: 0, background: 'rgba(5,5,15,0.98)' }}>
          <input value={chatText} onChange={e => setChatText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="Написать..."
            style={{ flex: 1, padding: '10px 14px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, fontFamily: '"Montserrat",sans-serif', outline: 'none' }} />
          <motion.button whileTap={{ scale: 0.88 }} onClick={sendChat} disabled={!chatText.trim()}
            style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: chatText.trim() ? 'linear-gradient(135deg,#7c3aed,#db2777)' : 'rgba(255,255,255,0.08)', color: '#fff', cursor: chatText.trim() ? 'pointer' : 'default', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>➤</motion.button>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   MUSIC ROOM (Listen Together)
══════════════════════════════════════════════════════ */
function MusicRoom({ roomId, myHash, onLeave }: { roomId: string; myHash: string; onLeave: () => void }) {
  const wsRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const startTsRef = useRef(0);
  const startCtRef = useRef(0);

  const [room, setRoom] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatText, setChatText] = useState('');
  const [connected, setConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [newTrackUrl, setNewTrackUrl] = useState('');
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [toast, setToast] = useState('');
  const chatEnd = useRef<HTMLDivElement | null>(null);
  const [embedInfo, setEmbedInfo] = useState<{ type: 'iframe'|'audio'|'video'; url: string } | null>(null);

  const showToast = (t: string) => { setToast(t); setTimeout(() => setToast(''), 3000); };
  const send = (p: unknown) => { if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(p)); };

  function toEmbed(url: string): { type: 'iframe'|'audio'|'video'; url: string } {
    const u = url.trim();
    const yt = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/);
    if (yt) return { type: 'iframe', url: `${API}/api/browser-proxy?url=${encodeURIComponent(`https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=0`)}` };
    const rt = u.match(/rutube\.ru\/(?:video|play\/embed)\/([a-f0-9]+)/i);
    if (rt) return { type: 'iframe', url: `${API}/api/browser-proxy?url=${encodeURIComponent(`https://rutube.ru/play/embed/${rt[1]}/`)}` };
    const vk = u.match(/vk\.com\/video(-?\d+_\d+)/);
    if (vk) { const p = vk[1].split('_'); return { type: 'iframe', url: `${API}/api/browser-proxy?url=${encodeURIComponent(`https://vk.com/video_ext.php?oid=${p[0]}&id=${p[1]}&hd=2`)}` }; }
    if (/\.(mp3|ogg|wav|m4a|aac)(\?|$)/i.test(u)) return { type: 'audio', url: u };
    if (/\.(mp4|webm|ogv)(\?|$)/i.test(u)) return { type: 'video', url: u };
    return { type: 'iframe', url: `${API}/api/browser-proxy?url=${encodeURIComponent(u.startsWith('http') ? u : `https://${u}`)}` };
  }

  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE}/api/ws/cinema?token=${encodeURIComponent(getTok())}&hash=${encodeURIComponent(myHash)}&room=${roomId}`);
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'init') { setRoom(msg.room); setMembers(msg.members || []); setMessages((msg.messages || []).filter((m: any) => !m.text?.startsWith('__'))); setCurrentTime(msg.room.currentTime || 0); if (msg.room.videoUrl) setEmbedInfo(toEmbed(msg.room.videoUrl)); }
        if (msg.type === 'member_joined') { setMembers(msg.members); showToast(`${msg.name} присоединился`); }
        if (msg.type === 'member_left') { setMembers(msg.members); showToast(`${msg.name} вышел`); }
        if (msg.type === 'chat') { if (!msg.message?.text?.startsWith('__')) setMessages(p => [...p.slice(-199), msg.message]); }
        if (msg.type === 'video_changed') { if (msg.url) setEmbedInfo(toEmbed(msg.url)); setIsPlaying(false); setCurrentTime(0); showToast(`${msg.by} добавил трек`); }
        if (msg.type === 'play') { startTsRef.current = Date.now() - msg.currentTime * 1000; startCtRef.current = msg.currentTime; setIsPlaying(true); setCurrentTime(msg.currentTime); if (audioRef.current) { audioRef.current.currentTime = msg.currentTime; audioRef.current.play().catch(() => {}); } showToast('▶'); }
        if (msg.type === 'pause') { setIsPlaying(false); setCurrentTime(msg.currentTime); if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = msg.currentTime; } showToast('⏸'); }
        if (msg.type === 'seek') { setCurrentTime(msg.currentTime); if (audioRef.current) audioRef.current.currentTime = msg.currentTime; }
        if (msg.type === 'sync_state') { setCurrentTime(msg.currentTime); if (audioRef.current) { audioRef.current.currentTime = msg.currentTime; if (msg.isPlaying) audioRef.current.play().catch(() => {}); else audioRef.current.pause(); } }
      } catch { /* */ }
    };
    const ping = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' })); }, 20_000);
    return () => { clearInterval(ping); ws.close(); };
  }, [roomId]);

  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const isHost = room?.hostHash === myHash;
  const hostPlay = () => { const t = audioRef.current?.currentTime ?? currentTime; send({ type: 'play', currentTime: t }); if (audioRef.current) audioRef.current.play().catch(() => {}); setIsPlaying(true); };
  const hostPause = () => { const t = audioRef.current?.currentTime ?? currentTime; send({ type: 'pause', currentTime: t }); if (audioRef.current) audioRef.current.pause(); setIsPlaying(false); };
  const hostSeek = (t: number) => { send({ type: 'seek', currentTime: t }); if (audioRef.current) audioRef.current.currentTime = t; setCurrentTime(t); };
  const addTrack = () => { if (!newTrackUrl.trim()) return; const e = toEmbed(newTrackUrl.trim()); setEmbedInfo(e); send({ type: 'set_video', url: newTrackUrl.trim(), title: newTrackUrl.trim().split('/').pop() || 'Трек' }); setNewTrackUrl(''); setShowAddTrack(false); };
  const sendChat = () => { const t = chatText.trim(); if (!t) return; send({ type: 'chat', text: t }); setChatText(''); };

  const embed = embedInfo;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#05050c', display: 'flex', flexDirection: 'column', fontFamily: '"Montserrat",sans-serif', zIndex: 500 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '48px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(8,8,18,0.98)' }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onLeave} style={{ width: 38, height: 38, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 16, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>←</motion.button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 900, fontSize: 14, color: '#fff' }}>{room?.name || '...'}</div>
          <div style={{ fontSize: 10, color: connected ? '#22c55e' : '#ef4444' }}>● {connected ? `${members.length} слушателей` : 'Подключение...'}</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>{members.slice(0, 5).map(m => <Av key={m.hash} name={m.name} size={26} />)}</div>
      </div>

      {embed && embed.url && (embed.type === 'iframe' ? (
        <div style={{ height: 200, flexShrink: 0, background: '#000' }}>
          <iframe key={embed.url} src={embed.url} allow="autoplay; fullscreen" allowFullScreen sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-presentation" style={{ width: '100%', height: '100%', border: 'none' }} title="Трек" />
        </div>
      ) : embed.type === 'video' ? (
        <div style={{ height: 180, flexShrink: 0, background: '#000' }}>
          <video ref={audioRef as any} src={embed.url} style={{ width: '100%', height: '100%', objectFit: 'contain' }} playsInline />
        </div>
      ) : (
        <audio ref={audioRef} src={embed.url} onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)} onDurationChange={() => setDuration(audioRef.current?.duration ?? 0)} />
      ))}

      <div style={{ background: 'linear-gradient(180deg,#0f0f1a 0%,#05050c 100%)', padding: '14px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#7c3aed,#db2777)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>🎵</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{room?.videoTitle || room?.videoUrl?.split('/').pop() || 'Трек не выбран'}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{isHost ? '🎛 Ты — диджей' : '🎧 Слушаешь'}</div>
          </div>
          {isHost && <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowAddTrack(v => !v)} style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', fontSize: 16, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>📀</motion.button>}
        </div>

        {embed?.type !== 'iframe' && duration > 0 && (
          <>
            <input type="range" min={0} max={duration} value={currentTime} onChange={e => isHost && hostSeek(Number(e.target.value))} disabled={!isHost} style={{ width: '100%', accentColor: '#7c3aed', cursor: isHost ? 'pointer' : 'default', display: 'block', marginBottom: 4, height: 3 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 8 }}><span>{fmtTime(currentTime)}</span><span>{fmtTime(duration)}</span></div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', gap: 14 }}>
          {isHost ? (
            <motion.button whileTap={{ scale: 0.88 }} onClick={isPlaying ? hostPause : hostPlay} style={{ width: 50, height: 50, borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,#7c3aed,#db2777)', cursor: 'pointer', fontSize: 22, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isPlaying ? '⏸' : '▶'}
            </motion.button>
          ) : (
            <motion.button whileTap={{ scale: 0.9 }} onClick={() => send({ type: 'request_sync' })} style={{ padding: '10px 22px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.07)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif' }}>🔄 Синхронизироваться</motion.button>
          )}
        </div>

        {toast && <div style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 8 }}>{toast}</div>}

        <AnimatePresence>
          {showAddTrack && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', marginTop: 10 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newTrackUrl} onChange={e => setNewTrackUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTrack()} placeholder="MP3 · Rutube · VK · YouTube · любой URL..."
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 13, fontFamily: '"Montserrat",sans-serif', outline: 'none' }} />
                <motion.button whileTap={{ scale: 0.95 }} onClick={addTrack} style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#db2777)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif' }}>▶</motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 ? <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12, padding: '20px 0' }}>Пока тихо — напиши что-нибудь!</div>
          : messages.map((m: any) => <div key={m.id} style={{ display: 'flex', gap: 8 }}><Av name={m.userName || '?'} size={26} /><div><span style={{ fontSize: 11, fontWeight: 800, color: m.userHash === myHash ? '#a78bfa' : '#fff', marginRight: 6 }}>{m.userHash === myHash ? 'Ты' : m.userName}</span><span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)' }}>{m.text}</span></div></div>)}
        <div ref={chatEnd} />
      </div>

      <div style={{ padding: '8px 12px', borderTop: '1px solid rgba(255,255,255,0.07)', paddingBottom: 'calc(8px + env(safe-area-inset-bottom,0px))', display: 'flex', gap: 8 }}>
        <input value={chatText} onChange={e => setChatText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendChat()} placeholder="Написать..."
          style={{ flex: 1, padding: '10px 14px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 13, fontFamily: '"Montserrat",sans-serif', outline: 'none' }} />
        <motion.button whileTap={{ scale: 0.88 }} onClick={sendChat} disabled={!chatText.trim()} style={{ width: 38, height: 38, borderRadius: '50%', border: 'none', background: chatText.trim() ? 'linear-gradient(135deg,#7c3aed,#db2777)' : 'rgba(255,255,255,0.08)', color: '#fff', cursor: chatText.trim() ? 'pointer' : 'default', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>➤</motion.button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   LOBBY
══════════════════════════════════════════════════════ */
type RoomMode = 'karaoke' | 'music';

function MusicLobby({ myHash, myName, onJoin, onBack }: { myHash: string; myName: string; onJoin: (id: string, mode: RoomMode) => void; onBack: () => void }) {
  const [tab, setTab] = useState<RoomMode>('karaoke');
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<RoomMode>('karaoke');
  const [roomName, setRoomName] = useState('');
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try { const r = await fetch(`${API}/api/cinema/rooms`); const d = await r.json(); setRooms(d.rooms || []); } catch { /* */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); const t = setInterval(load, 10_000); return () => clearInterval(t); }, [load]);

  const prefix = (m: RoomMode) => m === 'karaoke' ? '🎤' : '🎵';
  const filtered = rooms.filter(r => r.name?.startsWith(prefix(tab)));

  const create = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const r = await fetch(`${API}/api/cinema/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': getTok() },
        body: JSON.stringify({ name: `${prefix(createMode)} ${roomName.trim() || (createMode === 'karaoke' ? 'Каракоке' : 'Музыкальная комната')}`, videoUrl: '', videoTitle: '' }),
      });
      const d = await r.json();
      if (d.success) { onJoin(d.room.id, createMode); setShowCreate(false); setRoomName(''); }
    } catch { /* */ }
    setCreating(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#05050c', display: 'flex', flexDirection: 'column', fontFamily: '"Montserrat",sans-serif', zIndex: 500 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '48px 16px 0', background: 'rgba(8,8,18,0.98)', borderBottom: '1px solid rgba(255,255,255,0.07)', position: 'sticky', top: 0, zIndex: 10, paddingBottom: 12 }}>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onBack} style={{ width: 40, height: 40, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, color: '#fff', flexShrink: 0 }}>←</motion.button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, fontSize: 18, color: '#fff' }}>🎵 Музыкальная комната</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Слушаем вместе · Поём каракоке</div>
        </div>
        <motion.button whileTap={{ scale: 0.92 }} onClick={() => { setCreateMode(tab); setShowCreate(true); }} style={{ padding: '10px 18px', borderRadius: 100, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#db2777)', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif' }}>+ Создать</motion.button>
      </div>

      <div style={{ display: 'flex', padding: '12px 16px 0', gap: 8, background: 'rgba(8,8,18,0.98)', paddingBottom: 12 }}>
        {(['karaoke','music'] as RoomMode[]).map(t => (
          <motion.button key={t} whileTap={{ scale: 0.95 }} onClick={() => setTab(t)} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 13, fontFamily: '"Montserrat",sans-serif', background: tab === t ? 'linear-gradient(135deg,#7c3aed,#db2777)' : 'rgba(255,255,255,0.06)', color: tab === t ? '#fff' : 'rgba(255,255,255,0.5)' }}>
            {t === 'karaoke' ? '🎤 Каракоке' : '🎵 Слушаем'}
          </motion.button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 100px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>Загружаю...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <div style={{ fontSize: 52 }}>{tab === 'karaoke' ? '🎤' : '🎵'}</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', marginTop: 12 }}>Нет активных комнат</div>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setCreateMode(tab); setShowCreate(true); }} style={{ marginTop: 16, padding: '12px 28px', borderRadius: 100, border: 'none', background: 'linear-gradient(135deg,#7c3aed,#db2777)', color: '#fff', fontWeight: 800, fontSize: 14, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif' }}>Создать комнату</motion.button>
          </div>
        ) : filtered.map((r: any) => (
          <motion.div key={r.id} whileTap={{ scale: 0.97 }} onClick={() => onJoin(r.id, tab)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 16, padding: '14px 16px', marginBottom: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: tab === 'karaoke' ? 'linear-gradient(135deg,#be185d,#7c3aed)' : 'linear-gradient(135deg,#1a0a3a,#7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{tab === 'karaoke' ? '🎤' : '🎵'}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>{r.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>👥 {r.memberCount} · {r.isPlaying ? '▶ Играет' : '⏸ Ждёт'}</div>
            </div>
            <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.3)' }}>→</div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreate(false)} style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }} />
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 360, damping: 34 }} style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 301, background: '#0f0f1a', borderRadius: '24px 24px 0 0', border: '1px solid rgba(255,255,255,0.08)', padding: '20px 20px calc(32px + env(safe-area-inset-bottom,0px))' }}>
              <div style={{ width: 40, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 99, margin: '0 auto 18px' }} />
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                {(['karaoke','music'] as RoomMode[]).map(m => (
                  <motion.button key={m} whileTap={{ scale: 0.95 }} onClick={() => setCreateMode(m)} style={{ flex: 1, padding: '10px 0', borderRadius: 12, border: `2px solid ${createMode === m ? '#7c3aed' : 'transparent'}`, cursor: 'pointer', fontWeight: 800, fontSize: 13, fontFamily: '"Montserrat",sans-serif', background: createMode === m ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)', color: createMode === m ? '#c4b5fd' : 'rgba(255,255,255,0.45)' }}>
                    {m === 'karaoke' ? '🎤 Каракоке' : '🎵 Слушаем'}
                  </motion.button>
                ))}
              </div>
              <input value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="Название комнаты..." style={{ width: '100%', padding: '12px 14px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: 14, fontFamily: '"Montserrat",sans-serif', outline: 'none', boxSizing: 'border-box', marginBottom: 14 }} />
              <motion.button whileTap={{ scale: 0.96 }} onClick={create} disabled={creating} style={{ width: '100%', padding: 14, borderRadius: 14, border: 'none', background: creating ? 'rgba(124,58,237,0.4)' : 'linear-gradient(135deg,#7c3aed,#db2777)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: creating ? 'not-allowed' : 'pointer', fontFamily: '"Montserrat",sans-serif' }}>
                {creating ? 'Создаю...' : (createMode === 'karaoke' ? '🎤 Создать каракоке' : '🎵 Создать комнату')}
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ROOT
══════════════════════════════════════════════════════ */
export default function MusicRoomScreen({ myHash, myName, onBack, sessionToken }: { myHash: string; myName?: string; onBack: () => void; sessionToken?: string }) {
  if (sessionToken) _tok = sessionToken;
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomMode, setRoomMode] = useState<RoomMode>('karaoke');
  const name = myName || 'Гость';

  useBackHandler(roomId ? () => setRoomId(null) : onBack);

  if (roomId && roomMode === 'karaoke') return <KaraokeRoom roomId={roomId} myHash={myHash} myName={name} onLeave={() => setRoomId(null)} />;
  if (roomId && roomMode === 'music') return <MusicRoom roomId={roomId} myHash={myHash} onLeave={() => setRoomId(null)} />;
  return <MusicLobby myHash={myHash} myName={name} onJoin={(id, mode) => { setRoomId(id); setRoomMode(mode); }} onBack={onBack} />;
}
