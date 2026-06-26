import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface PetaScreenProps {
  onBack: () => void;
}

interface Solution {
  subject: string;
  solution: string;
  voiceScript: string;
}

const SUBJECTS = [
  'Математика','Алгебра','Геометрия','Физика','Химия','Биология',
  'Русский язык','Литература','История','Обществознание','География',
  'Английский язык','Информатика','Астрономия',
];

const GREETINGS = [
  'Привет! Я Петя — твой репетитор-отличник. 📚\nНапиши задание или сфотографируй его, и я всё объясню!',
  'Здравствуй! Готов помочь с любым заданием. 🎓\nФотографируй или пиши — решим вместе!',
  'Привет! Петя на связи. 🧑‍🎓\nПросто напиши задачу или прикрепи фото — справимся!',
];

function NotebookLines() {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} preserveAspectRatio="none">
      <defs>
        <pattern id="nb-lines" x="0" y="0" width="100%" height="36" patternUnits="userSpaceOnUse">
          <line x1="0" y1="35" x2="100%" y2="35" stroke="#b8d4f0" strokeWidth="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#nb-lines)"/>
      <line x1="66" y1="0" x2="66" y2="100%" stroke="#ff8a80" strokeWidth="1.5" opacity="0.7"/>
    </svg>
  );
}

function PetyaAvatar({ animate: doAnim }: { animate?: boolean }) {
  return (
    <motion.div
      animate={doAnim ? { rotate: [0, -8, 8, -5, 5, 0], y: [0, -4, 0] } : {}}
      transition={{ duration: 1.2, repeat: doAnim ? Infinity : 0, repeatDelay: 2 }}
      style={{ fontSize: 44, lineHeight: 1, userSelect: 'none', flexShrink: 0 }}>
      🧑‍🎓
    </motion.div>
  );
}

export default function PetaScreen({ onBack }: PetaScreenProps) {
  const [inputText, setInputText] = useState('');
  const [solving, setSolving] = useState(false);
  const [solution, setSolution] = useState<Solution | null>(null);
  const [error, setError] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [speakLoading, setSpeakLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);

  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const solutionRef = useRef<HTMLDivElement>(null);

  /* Load handwriting font */
  useEffect(() => {
    const existing = document.getElementById('caveat-font');
    if (existing) return;
    const link = document.createElement('link');
    link.id = 'caveat-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&display=swap';
    document.head.appendChild(link);
  }, []);

  /* Scroll to solution when ready */
  useEffect(() => {
    if (solution && solutionRef.current) {
      setTimeout(() => solutionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    }
  }, [solution]);

  /* Stop audio on unmount */
  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setAudioUrl(null);
    setSolution(null);
    setError('');
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const solve = useCallback(async () => {
    if (!inputText.trim() && !imageFile) return;
    setSolving(true);
    setSolution(null);
    setError('');
    setAudioUrl(null);
    setPlaying(false);

    try {
      let imageBase64: string | undefined;
      if (imageFile) {
        const buf = await imageFile.arrayBuffer();
        const binary = String.fromCharCode(...new Uint8Array(buf));
        imageBase64 = btoa(binary);
      }

      const resp = await fetch('/api/petya/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText.trim() || undefined, imageBase64 }),
      });

      if (!resp.ok) throw new Error(await resp.text());
      const data: Solution = await resp.json();
      setSolution(data);
    } catch {
      setError('Не удалось получить ответ. Проверь соединение и попробуй снова.');
    } finally {
      setSolving(false);
    }
  }, [inputText, imageFile]);

  const speak = useCallback(async () => {
    if (!solution?.voiceScript || speakLoading) return;
    setSpeakLoading(true);

    if (audioUrl) {
      /* Already have audio — just play/pause */
      setSpeakLoading(false);
      if (audioRef.current) {
        if (playing) {
          audioRef.current.pause();
          setPlaying(false);
        } else {
          audioRef.current.play().catch(() => {});
          setPlaying(true);
        }
      }
      return;
    }

    try {
      const resp = await fetch('/api/petya/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: solution.voiceScript }),
      });
      if (!resp.ok) throw new Error('TTS error');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onerror = () => { setPlaying(false); setError('Ошибка воспроизведения аудио.'); };
      await audio.play();
      setPlaying(true);
    } catch {
      setError('Не удалось озвучить объяснение.');
    } finally {
      setSpeakLoading(false);
    }
  }, [solution, speakLoading, audioUrl, playing]);

  const stopAudio = () => {
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    setPlaying(false);
  };

  const reset = () => {
    setSolution(null);
    setInputText('');
    removeImage();
    setAudioUrl(null);
    setPlaying(false);
    setError('');
    stopAudio();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      solve();
    }
  };

  /* ─── Render ─── */
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', flexDirection: 'column',
      background: '#fefef4', fontFamily: '"Montserrat", sans-serif',
    }}>

      {/* ── Top Bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '44px 12px 10px',
        background: 'linear-gradient(135deg, #1a237e 0%, #283593 60%, #1565c0 100%)',
        flexShrink: 0, boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
      }}>
        <motion.button whileTap={{ scale: 0.85 }} onClick={onBack}
          style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', fontSize: 17, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          ←
        </motion.button>

        <PetyaAvatar animate={solving} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', color: '#90caf9' }}>РЕПЕТИТОР</div>
          <div style={{ fontSize: 17, fontWeight: 900, color: '#fff' }}>Отличник Петя</div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.55)' }}>Все предметы · Любой класс</div>
        </div>

        {solution && (
          <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} whileTap={{ scale: 0.9 }} onClick={reset}
            style={{ padding: '6px 12px', borderRadius: 14, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', color: '#fff', fontSize: 10, fontWeight: 800, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif' }}>
            Новое
          </motion.button>
        )}
      </div>

      {/* ── Subjects strip ── */}
      <div style={{ flexShrink: 0, overflowX: 'auto', display: 'flex', gap: 6, padding: '8px 12px', background: '#1a237e', borderBottom: '2px solid #0d47a1' }}>
        {SUBJECTS.map(s => (
          <motion.button key={s} whileTap={{ scale: 0.9 }}
            onClick={() => setInputText(prev => prev ? prev : `Предмет: ${s}\n`)}
            style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#90caf9', fontSize: 10, fontWeight: 700, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif', whiteSpace: 'nowrap' }}>
            {s}
          </motion.button>
        ))}
      </div>

      {/* ── Main notebook area ── */}
      <div style={{ flex: 1, overflowY: 'auto', position: 'relative', paddingBottom: 160 }}>

        {/* Empty state — Petya greeting */}
        <AnimatePresence>
          {!solution && !solving && (
            <motion.div key="greeting" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ position: 'relative', margin: '20px 16px', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
              <div style={{ position: 'relative', background: '#fefef4', minHeight: 160, padding: '20px 20px 20px 80px' }}>
                <NotebookLines />
                <div style={{ position: 'relative', zIndex: 1, fontFamily: '"Caveat", cursive', fontSize: 22, lineHeight: 1.6, color: '#1565c0', whiteSpace: 'pre-line' }}>
                  {greeting}
                </div>
              </div>
              <div style={{ background: '#e3f2fd', padding: '10px 16px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {['Реши уравнение: 2x + 5 = 17', 'Правило написания -тся/-ться', 'Закон Ньютона (примеры)'].map(ex => (
                  <motion.button key={ex} whileTap={{ scale: 0.95 }}
                    onClick={() => { setInputText(ex); textareaRef.current?.focus(); }}
                    style={{ padding: '4px 10px', borderRadius: 12, background: '#bbdefb', border: 'none', color: '#1565c0', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif' }}>
                    {ex}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Solving loader */}
        <AnimatePresence>
          {solving && (
            <motion.div key="solving" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ margin: '32px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <motion.div style={{ fontSize: 52 }}
                animate={{ rotate: [0, -10, 10, -8, 8, 0] }} transition={{ duration: 1, repeat: Infinity, repeatDelay: 0.5 }}>
                🧑‍🎓
              </motion.div>
              <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', width: '100%', maxWidth: 340 }}>
                <div style={{ background: '#fefef4', padding: '20px 20px 20px 80px', position: 'relative', minHeight: 100 }}>
                  <NotebookLines />
                  <motion.div style={{ fontFamily: '"Caveat", cursive', fontSize: 20, color: '#1565c0', position: 'relative', zIndex: 1 }}
                    animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                    Петя решает задание…
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Solution */}
        <AnimatePresence>
          {solution && (
            <motion.div key="solution" ref={solutionRef}
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', damping: 24 }}
              style={{ margin: '16px 12px' }}>

              {/* Subject badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 4 }}>
                <span style={{ fontSize: 18 }}>📚</span>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#1a237e', textTransform: 'uppercase', letterSpacing: 1 }}>{solution.subject}</span>
              </div>

              {/* Notebook sheet */}
              <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', boxShadow: '0 6px 28px rgba(0,0,0,0.1)', border: '1px solid #e3f2fd' }}>

                {/* Corner fold decoration */}
                <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 32px 32px 0', borderColor: 'transparent #c5cae9 transparent transparent', zIndex: 2 }} />
                <div style={{ position: 'absolute', top: 1, right: 1, width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 30px 30px 0', borderColor: 'transparent #fefef4 transparent transparent', zIndex: 3 }} />

                <div style={{ background: '#fefef4', padding: '20px 18px 24px 80px', position: 'relative', minHeight: 200 }}>
                  <NotebookLines />

                  {/* Red margin label */}
                  <div style={{ position: 'absolute', left: 0, top: 0, width: 66, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', paddingTop: 20, gap: 4, zIndex: 1 }}>
                    <span style={{ fontSize: 18, transform: 'rotate(-90deg)', transformOrigin: 'center' }}>✏️</span>
                  </div>

                  {/* Solution text */}
                  <div style={{ position: 'relative', zIndex: 1, fontFamily: '"Caveat", cursive', fontSize: 21, lineHeight: 1.72, color: '#0d47a1', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {solution.solution}
                  </div>
                </div>

                {/* Bottom bar — audio controls */}
                <div style={{ background: 'linear-gradient(135deg, #1a237e, #1565c0)', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={speak}
                    disabled={speakLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 18px', borderRadius: 20, background: speakLoading ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: 13, fontWeight: 800, cursor: speakLoading ? 'default' : 'pointer', fontFamily: '"Montserrat",sans-serif' }}>
                    {speakLoading ? (
                      <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-block' }}>⏳</motion.span>
                    ) : playing ? '⏸' : '▶️'}
                    <span>{speakLoading ? 'Загружаю...' : playing ? 'Пауза' : 'Послушать объяснение'}</span>
                  </motion.button>

                  {playing && (
                    <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileTap={{ scale: 0.9 }} onClick={stopAudio}
                      style={{ padding: '6px 12px', borderRadius: 14, background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', fontSize: 11, fontWeight: 700, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif' }}>
                      ⏹ Стоп
                    </motion.button>
                  )}

                  {audioUrl && !playing && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 700 }}>
                      🔊 Объяснение готово
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Playing animation */}
              <AnimatePresence>
                {playing && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    style={{ marginTop: 12, padding: '12px 16px', borderRadius: 14, background: '#e8eaf6', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 28 }}>🧑‍🎓</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 800, color: '#1a237e' }}>Петя объясняет…</div>
                      <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                        {[0, 1, 2, 3, 4].map(i => (
                          <motion.div key={i}
                            animate={{ scaleY: [1, 2.5, 1] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.1 }}
                            style={{ width: 4, height: 12, borderRadius: 2, background: '#1565c0', transformOrigin: 'bottom' }} />
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ margin: '12px 16px', padding: '12px 16px', borderRadius: 14, background: '#fff3f3', border: '1px solid #ffcdd2', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>😟</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: '#c62828' }}>Упс…</div>
                <div style={{ fontSize: 11, color: '#b71c1c', marginTop: 2 }}>{error}</div>
              </div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setError('')}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef5350', fontSize: 16, cursor: 'pointer' }}>✕</motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Input area ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10,
        background: '#fff', borderTop: '1px solid #e3f2fd',
        boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}>
        {/* Image preview */}
        <AnimatePresence>
          {imagePreview && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              style={{ padding: '8px 12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative', width: 56, height: 56, borderRadius: 10, overflow: 'hidden', border: '2px solid #1565c0', flexShrink: 0 }}>
                <img src={imagePreview} alt="задание" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ flex: 1, fontSize: 11, color: '#1565c0', fontWeight: 700 }}>📷 Фото прикреплено</div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={removeImage}
                style={{ width: 28, height: 28, borderRadius: '50%', background: '#ffcdd2', border: 'none', color: '#c62828', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '8px 10px 10px' }}>
          {/* Camera button */}
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => fileRef.current?.click()}
            style={{ width: 44, height: 44, borderRadius: 14, background: '#e8eaf6', border: '1px solid #c5cae9', color: '#3949ab', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            📷
          </motion.button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />

          {/* Text area */}
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Напиши задание или условие задачи…"
            rows={1}
            style={{
              flex: 1, border: '1.5px solid #c5cae9', borderRadius: 14, padding: '10px 14px',
              fontSize: 14, fontFamily: '"Montserrat",sans-serif', color: '#1a237e', background: '#f8f9ff',
              resize: 'none', outline: 'none', lineHeight: 1.5, maxHeight: 120, overflow: 'auto',
            }}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 120) + 'px';
            }}
          />

          {/* Send button */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={solve}
            disabled={solving || (!inputText.trim() && !imageFile)}
            animate={solving ? { scale: [1, 0.95, 1] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
            style={{
              width: 44, height: 44, borderRadius: 14, flexShrink: 0, cursor: 'pointer',
              background: solving || (!inputText.trim() && !imageFile)
                ? '#e8eaf6'
                : 'linear-gradient(135deg, #1a237e, #1565c0)',
              border: 'none', color: '#fff', fontSize: 20,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            {solving ? (
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-block' }}>⚙️</motion.span>
            ) : '✏️'}
          </motion.button>
        </div>

        {/* Subject hint */}
        {!solution && !solving && (
          <div style={{ paddingBottom: 6, paddingLeft: 14, fontSize: 10, color: '#9fa8da', fontWeight: 600 }}>
            📌 Укажи предмет и класс для точного ответа · Enter = отправить
          </div>
        )}
      </div>
    </div>
  );
}
