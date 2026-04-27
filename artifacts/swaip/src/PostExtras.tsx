import { useState, useRef } from 'react';

/* ══════════════════════════════════════════════════════
   ЕДИНЫЙ МОДУЛЬ «ДОБАВИТЬ В ПОСТ» для постов / каналов / групп.
   Содержит 8 секций со скриншота:
   📸 Карусель/галерея, 📅 Кнопка «Записаться», 📊 Опрос,
   🎯 Викторина/квиз, ❓ Вопрос подписчикам, 🏆 Челлендж,
   🔗 Превью ссылки, 🎬 Активность.
══════════════════════════════════════════════════════ */

export interface PostExtras {
  carousel?: { urls: string[] };
  booking?: { label: string; slots: string[] };
  poll?: { question: string; options: string[] };
  quiz?: { question: string; options: string[]; correctIdx: number };
  question?: { text: string };
  challenge?: { text: string; deadlineH: number };
  link?: { url: string; title?: string; description?: string };
  activity?: { type: string; label: string; emoji: string };
}

export const ACTIVITY_PRESETS: Array<{ type: string; emoji: string; label: string }> = [
  { type:'run',      emoji:'🏃', label:'Пробежка' },
  { type:'gym',      emoji:'🏋️', label:'Тренировка' },
  { type:'yoga',     emoji:'🧘', label:'Йога / медитация' },
  { type:'walk',     emoji:'🚶', label:'Прогулка' },
  { type:'bike',     emoji:'🚴', label:'Велосипед' },
  { type:'swim',     emoji:'🏊', label:'Плавание' },
  { type:'coffee',   emoji:'☕', label:'Кофе' },
  { type:'food',     emoji:'🍽️', label:'Еда' },
  { type:'read',     emoji:'📚', label:'Чтение' },
  { type:'study',    emoji:'🎓', label:'Учёба' },
  { type:'work',     emoji:'💼', label:'Работа' },
  { type:'movie',    emoji:'🎬', label:'Кино' },
  { type:'music',    emoji:'🎧', label:'Музыка' },
  { type:'travel',   emoji:'✈️', label:'Путешествие' },
  { type:'party',    emoji:'🎉', label:'Тусовка' },
  { type:'sleep',    emoji:'😴', label:'Сон' },
];

function _getTok(): string { try { return localStorage.getItem('swaip_session_token') || ''; } catch { return ''; } }

/* ── Композер всех секций. Раскрывает/сворачивает каждую,
   пишет результат в `extras` через `onChange`. ── */
export function PostExtrasComposer({
  extras, onChange, c, accent,
}: {
  extras: PostExtras;
  onChange: (next: PostExtras) => void;
  c: { light: string; sub: string; mid?: string; border: string; card?: string; cardAlt?: string; bg?: string };
  accent: string;
}) {
  const [open, setOpen] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const upd = (patch: Partial<PostExtras>) => onChange({ ...extras, ...patch });
  const remove = (key: keyof PostExtras) => { const n = { ...extras }; delete n[key]; onChange(n); };
  const inputBg = c.cardAlt || 'rgba(255,255,255,0.06)';
  const baseInput: React.CSSProperties = {
    width: '100%', padding: '9px 10px', background: inputBg,
    border: `1px solid ${c.border}`, borderRadius: 9, color: c.light,
    fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  };

  /* Дефолтные значения при первом открытии секции */
  const DEFAULTS: Partial<Record<keyof PostExtras, any>> = {
    booking:   { label: 'Записаться', slots: [] },
    poll:      { question: '', options: ['', ''] },
    quiz:      { question: '', options: ['', ''], correctIdx: 0 },
    question:  { text: '' },
    challenge: { text: '', deadlineH: 24 },
    link:      { url: '', title: '', description: '' },
  };

  const toggleSection = (key: keyof PostExtras) => {
    const opening = expanded !== key;
    setExpanded(opening ? key : null);
    /* Автоматически инициализируем секцию дефолтом при первом открытии */
    if (opening && !extras[key] && DEFAULTS[key] !== undefined) {
      upd({ [key]: DEFAULTS[key] });
    }
  };

  const SECTIONS: Array<{ key: keyof PostExtras; emoji: string; label: string; color: string }> = [
    { key:'carousel',  emoji:'🖼️', label:'Карусель / галерея',     color:'#3b82f6' },
    { key:'booking',   emoji:'📅', label:'Кнопка «Записаться»',    color:'#22c55e' },
    { key:'poll',      emoji:'📊', label:'Опрос',                  color:'#06b6d4' },
    { key:'quiz',      emoji:'🎯', label:'Викторина / квиз',       color:'#a855f7' },
    { key:'question',  emoji:'❓', label:'Вопрос подписчикам',     color:'#ef4444' },
    { key:'challenge', emoji:'🏆', label:'Челлендж',               color:'#f59e0b' },
    { key:'link',      emoji:'🔗', label:'Превью ссылки',          color:'#0ea5e9' },
    { key:'activity',  emoji:'🎬', label:'Активность',             color:'#ec4899' },
  ];

  const activeCount = SECTIONS.filter(s => !!extras[s.key]).length;

  return (
    <div style={{ marginTop: 14, border: `1px solid ${c.border}`, borderRadius: 14, overflow: 'hidden', background: c.cardAlt || 'rgba(255,255,255,0.03)' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
          background: 'transparent', border: 'none', cursor: 'pointer', color: c.light, fontSize: 14, fontWeight: 800 }}>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: `${accent}33`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>+</div>
        <span style={{ flex: 1, textAlign: 'left' }}>Добавить в пост</span>
        {activeCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: accent, background: `${accent}22`, borderRadius: 10, padding: '2px 8px' }}>{activeCount}</span>}
        <span style={{ fontSize: 11, color: c.sub }}>{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div style={{ paddingBottom: 12 }}>
          {/* ── Горизонтальная карусель иконок ── */}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 12px 10px', scrollbarWidth: 'none' }}>
            {SECTIONS.map(s => {
              const on = !!extras[s.key];
              const isOpen = expanded === s.key;
              return (
                <button key={s.key} type="button" onClick={() => toggleSection(s.key)}
                  style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0, width: 62 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 16, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 22, position: 'relative', transition: 'all 0.15s',
                    background: on ? `${s.color}22` : 'rgba(255,255,255,0.06)',
                    border: `2px solid ${isOpen ? s.color : on ? s.color + '77' : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: isOpen ? `0 0 12px ${s.color}55` : 'none' }}>
                    {s.emoji}
                    {on && (
                      <div style={{ position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: '50%',
                        background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 900, color: '#fff' }}>✓</div>
                    )}
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, color: on ? s.color : isOpen ? s.color : 'rgba(255,255,255,0.5)',
                    textAlign: 'center', lineHeight: 1.2, maxWidth: 60,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {s.label.split(' /')[0].split(' «')[0]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Редактор выбранной секции ── */}
          {expanded && (
            <div style={{ margin: '0 12px', padding: '12px', borderRadius: 12,
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${SECTIONS.find(s=>s.key===expanded)?.color||accent}40` }}>
              {expanded === 'carousel' && (
                <CarouselEditor value={extras.carousel} onChange={v => v ? upd({ carousel: v }) : remove('carousel')} c={c} input={baseInput} accent={SECTIONS.find(s=>s.key==='carousel')!.color} />
              )}
              {expanded === 'booking' && (
                <BookingEditor value={extras.booking} onChange={v => v ? upd({ booking: v }) : remove('booking')} c={c} input={baseInput} accent={SECTIONS.find(s=>s.key==='booking')!.color} />
              )}
              {expanded === 'poll' && (
                <PollEditor value={extras.poll} onChange={v => v ? upd({ poll: v }) : remove('poll')} c={c} input={baseInput} accent={SECTIONS.find(s=>s.key==='poll')!.color} />
              )}
              {expanded === 'quiz' && (
                <QuizEditor value={extras.quiz} onChange={v => v ? upd({ quiz: v }) : remove('quiz')} c={c} input={baseInput} accent={SECTIONS.find(s=>s.key==='quiz')!.color} />
              )}
              {expanded === 'question' && (
                <QuestionEditor value={extras.question} onChange={v => v ? upd({ question: v }) : remove('question')} c={c} input={baseInput} />
              )}
              {expanded === 'challenge' && (
                <ChallengeEditor value={extras.challenge} onChange={v => v ? upd({ challenge: v }) : remove('challenge')} c={c} input={baseInput} accent={SECTIONS.find(s=>s.key==='challenge')!.color} />
              )}
              {expanded === 'link' && (
                <LinkEditor value={extras.link} onChange={v => v ? upd({ link: v }) : remove('link')} c={c} input={baseInput} accent={SECTIONS.find(s=>s.key==='link')!.color} />
              )}
              {expanded === 'activity' && (
                <ActivityEditor value={extras.activity} onChange={v => v ? upd({ activity: v }) : remove('activity')} c={c} accent={SECTIONS.find(s=>s.key==='activity')!.color} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CarouselEditor({ value, onChange, c, input, accent }:{
  value?: PostExtras['carousel']; onChange:(v: PostExtras['carousel']|null)=>void;
  c: any; input: React.CSSProperties; accent: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const urls = value?.urls || [];
  const upload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setBusy(true);
    const next: string[] = [...urls];
    for (let i = 0; i < files.length && next.length < 10; i++) {
      const f = files[i]; if (!f) continue;
      try {
        const r = await fetch(`${window.location.origin}/api/image-upload`, {
          method: 'POST', headers: { 'Content-Type': f.type, 'x-session-token': _getTok() }, body: f,
        });
        if (r.ok) { const { url } = await r.json(); next.push(url); }
        else next.push(URL.createObjectURL(f));
      } catch { next.push(URL.createObjectURL(f)); }
    }
    setBusy(false);
    onChange({ urls: next });
  };
  const removeAt = (i: number) => {
    const n = urls.filter((_, j) => j !== i);
    onChange(n.length ? { urls: n } : null);
  };
  return (
    <div>
      <p style={{ margin:'0 0 8px', fontSize:11, color:c.sub }}>До 10 фото в карусели</p>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
        {urls.map((u, i) => (
          <div key={i} style={{ position:'relative', width:64, height:64, borderRadius:10, overflow:'hidden', border:`1px solid ${c.border}` }}>
            <img src={u} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            <button type="button" onClick={() => removeAt(i)} style={{ position:'absolute', top:2, right:2,
              width:18, height:18, borderRadius:'50%', border:'none', background:'rgba(0,0,0,0.7)', color:'#fff',
              fontSize:11, cursor:'pointer', lineHeight:1 }}>✕</button>
          </div>
        ))}
        <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || urls.length >= 10}
          style={{ width:64, height:64, borderRadius:10, border:`1.5px dashed ${accent}`, background:'transparent',
            color:accent, cursor: busy ? 'wait' : 'pointer', fontSize:24, lineHeight:1 }}>{busy ? '…' : '+'}</button>
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display:'none' }}
        onChange={e => upload(e.target.files)}/>
      {urls.length > 0 && (
        <button type="button" onClick={() => onChange(null)}
          style={{ ...input, color:'#ef4444', borderColor:'rgba(239,68,68,0.4)', cursor:'pointer', textAlign:'center' }}>
          Удалить карусель
        </button>
      )}
    </div>
  );
}

function BookingEditor({ value, onChange, c, input, accent }:{
  value?: PostExtras['booking']; onChange:(v: PostExtras['booking']|null)=>void;
  c: any; input: React.CSSProperties; accent: string;
}) {
  const v = value || { label:'Записаться', slots:[] };
  const [slot, setSlot] = useState('');
  const setLabel = (s: string) => onChange({ ...v, label: s });
  const addSlot = () => {
    const t = slot.trim(); if (!t) return;
    if (v.slots.includes(t)) return;
    onChange({ ...v, slots: [...v.slots, t] }); setSlot('');
  };
  const remSlot = (t: string) => onChange({ ...v, slots: v.slots.filter(x => x !== t) });
  return (
    <div>
      <input value={v.label} onChange={e => setLabel(e.target.value)} placeholder="Текст кнопки (Записаться)"
        style={{ ...input, marginBottom: 8 }}/>
      <div style={{ display:'flex', gap:6, marginBottom:6 }}>
        <input value={slot} onChange={e => setSlot(e.target.value)} placeholder="Например: Пн 14:00"
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSlot(); } }}
          style={{ ...input, flex:1 }}/>
        <button type="button" onClick={addSlot}
          style={{ padding:'0 12px', borderRadius:9, border:`1px solid ${accent}`, background:`${accent}22`,
            color:accent, fontSize:13, fontWeight:700, cursor:'pointer' }}>+</button>
      </div>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {v.slots.map(t => (
          <span key={t} style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'4px 8px',
            background:`${accent}1a`, border:`1px solid ${accent}55`, borderRadius:8, fontSize:12, color:c.light }}>
            🕐 {t}
            <button type="button" onClick={() => remSlot(t)}
              style={{ background:'none', border:'none', color:c.sub, cursor:'pointer', fontSize:13, padding:0, lineHeight:1 }}>✕</button>
          </span>
        ))}
      </div>
      <button type="button" onClick={() => onChange(null)}
        style={{ ...input, marginTop:8, color:'#ef4444', borderColor:'rgba(239,68,68,0.4)', cursor:'pointer', textAlign:'center' }}>
        Удалить
      </button>
    </div>
  );
}

function PollEditor({ value, onChange, c, input, accent }:{
  value?: PostExtras['poll']; onChange:(v: PostExtras['poll']|null)=>void;
  c: any; input: React.CSSProperties; accent: string;
}) {
  const v = value || { question:'', options:['',''] };
  return (
    <div>
      <input value={v.question} onChange={e => onChange({ ...v, question: e.target.value })}
        placeholder="Вопрос опроса…" style={{ ...input, marginBottom:8 }}/>
      {v.options.map((opt, i) => (
        <input key={i} value={opt}
          onChange={e => { const n = [...v.options]; n[i] = e.target.value; onChange({ ...v, options: n }); }}
          placeholder={`Вариант ${i+1}`} style={{ ...input, marginBottom:6 }}/>
      ))}
      {v.options.length < 6 && (
        <button type="button" onClick={() => onChange({ ...v, options:[...v.options, ''] })}
          style={{ ...input, color: accent, borderStyle:'dashed', cursor:'pointer', textAlign:'center', marginBottom:6 }}>
          + Добавить вариант
        </button>
      )}
      <button type="button" onClick={() => onChange(null)}
        style={{ ...input, color:'#ef4444', borderColor:'rgba(239,68,68,0.4)', cursor:'pointer', textAlign:'center' }}>
        Удалить
      </button>
    </div>
  );
}

function QuizEditor({ value, onChange, c, input, accent }:{
  value?: PostExtras['quiz']; onChange:(v: PostExtras['quiz']|null)=>void;
  c: any; input: React.CSSProperties; accent: string;
}) {
  const v = value || { question:'', options:['',''], correctIdx:0 };
  return (
    <div>
      <input value={v.question} onChange={e => onChange({ ...v, question: e.target.value })}
        placeholder="Вопрос викторины…" style={{ ...input, marginBottom:8 }}/>
      <p style={{ margin:'0 0 4px', fontSize:11, color:c.sub }}>Отметь правильный ответ ✓</p>
      {v.options.map((opt, i) => (
        <div key={i} style={{ display:'flex', gap:6, marginBottom:6 }}>
          <button type="button" onClick={() => onChange({ ...v, correctIdx: i })}
            style={{ width:34, borderRadius:9, border:`1.5px solid ${v.correctIdx===i?accent:c.border}`,
              background: v.correctIdx===i ? `${accent}22` : 'transparent', color: v.correctIdx===i ? accent : c.sub,
              cursor:'pointer', fontSize:14, fontWeight:800 }}>{v.correctIdx===i ? '✓' : '○'}</button>
          <input value={opt}
            onChange={e => { const n = [...v.options]; n[i] = e.target.value; onChange({ ...v, options: n }); }}
            placeholder={`Вариант ${i+1}`} style={{ ...input, flex:1 }}/>
        </div>
      ))}
      {v.options.length < 6 && (
        <button type="button" onClick={() => onChange({ ...v, options:[...v.options, ''] })}
          style={{ ...input, color: accent, borderStyle:'dashed', cursor:'pointer', textAlign:'center', marginBottom:6 }}>
          + Добавить вариант
        </button>
      )}
      <button type="button" onClick={() => onChange(null)}
        style={{ ...input, color:'#ef4444', borderColor:'rgba(239,68,68,0.4)', cursor:'pointer', textAlign:'center' }}>
        Удалить
      </button>
    </div>
  );
}

function QuestionEditor({ value, onChange, c, input }:{
  value?: PostExtras['question']; onChange:(v: PostExtras['question']|null)=>void;
  c: any; input: React.CSSProperties;
}) {
  const v = value || { text:'' };
  return (
    <div>
      <input value={v.text} onChange={e => onChange({ text: e.target.value })}
        placeholder="Спроси подписчиков…" style={{ ...input, marginBottom:8 }}/>
      <button type="button" onClick={() => onChange(null)}
        style={{ ...input, color:'#ef4444', borderColor:'rgba(239,68,68,0.4)', cursor:'pointer', textAlign:'center' }}>
        Удалить
      </button>
      <p style={{ margin:'8px 2px 0', fontSize:11, color:c.sub }}>Подписчики смогут отвечать в комментариях.</p>
    </div>
  );
}

function ChallengeEditor({ value, onChange, c, input, accent }:{
  value?: PostExtras['challenge']; onChange:(v: PostExtras['challenge']|null)=>void;
  c: any; input: React.CSSProperties; accent: string;
}) {
  const v = value || { text:'', deadlineH:24 };
  return (
    <div>
      <textarea value={v.text} onChange={e => onChange({ ...v, text: e.target.value })}
        placeholder="Опиши челлендж…" rows={3}
        style={{ ...input, resize:'vertical', minHeight:60, marginBottom:8 }}/>
      <p style={{ margin:'0 0 4px', fontSize:11, color:c.sub }}>Дедлайн:</p>
      <div style={{ display:'flex', gap:6 }}>
        {[12,24,48,72,168].map(h => (
          <button key={h} type="button" onClick={() => onChange({ ...v, deadlineH: h })}
            style={{ flex:1, padding:'7px', borderRadius:8,
              border:`1px solid ${v.deadlineH===h?accent:c.border}`,
              background: v.deadlineH===h?`${accent}22`:'transparent',
              color: v.deadlineH===h?accent:c.sub, fontSize:12, fontWeight:700, cursor:'pointer' }}>
            {h>=168?`${h/24}д`:`${h}ч`}
          </button>
        ))}
      </div>
      <button type="button" onClick={() => onChange(null)}
        style={{ ...input, marginTop:8, color:'#ef4444', borderColor:'rgba(239,68,68,0.4)', cursor:'pointer', textAlign:'center' }}>
        Удалить
      </button>
    </div>
  );
}

function LinkEditor({ value, onChange, c, input, accent }:{
  value?: PostExtras['link']; onChange:(v: PostExtras['link']|null)=>void;
  c: any; input: React.CSSProperties; accent: string;
}) {
  const v = value || { url:'', title:'', description:'' };
  return (
    <div>
      <input value={v.url} onChange={e => onChange({ ...v, url: e.target.value })}
        placeholder="https://…" style={{ ...input, marginBottom:6 }}/>
      <input value={v.title || ''} onChange={e => onChange({ ...v, title: e.target.value })}
        placeholder="Заголовок (необязательно)" style={{ ...input, marginBottom:6 }}/>
      <textarea value={v.description || ''} onChange={e => onChange({ ...v, description: e.target.value })}
        placeholder="Описание (необязательно)" rows={2}
        style={{ ...input, resize:'vertical', minHeight:50, marginBottom:6 }}/>
      <p style={{ margin:'0 0 6px 2px', fontSize:11, color:c.sub }}>Ссылка будет показана карточкой под постом.</p>
      <button type="button" onClick={() => onChange(null)}
        style={{ ...input, color:'#ef4444', borderColor:'rgba(239,68,68,0.4)', cursor:'pointer', textAlign:'center' }}>
        Удалить
      </button>
      {v.url && <PostExtrasLinkPreview link={{ url:v.url, title:v.title, description:v.description }} c={c} accent={accent}/>}
    </div>
  );
}

function ActivityEditor({ value, onChange, c, accent }:{
  value?: PostExtras['activity']; onChange:(v: PostExtras['activity']|null)=>void;
  c: any; accent: string;
}) {
  return (
    <div>
      <p style={{ margin:'0 0 6px', fontSize:11, color:c.sub }}>Что ты делаешь:</p>
      <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
        {ACTIVITY_PRESETS.map(a => {
          const on = value?.type === a.type;
          return (
            <button key={a.type} type="button" onClick={() => onChange(on ? null : a)}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 10px', borderRadius:18,
                border:`1.5px solid ${on?accent:c.border}`, background: on?`${accent}22`:'transparent',
                color: on?accent:c.light, fontSize:12, fontWeight:700, cursor:'pointer' }}>
              <span>{a.emoji}</span>{a.label}
            </button>
          );
        })}
      </div>
      {value && (
        <button type="button" onClick={() => onChange(null)}
          style={{ width:'100%', marginTop:8, padding:'9px', borderRadius:9,
            border:'1px solid rgba(239,68,68,0.4)', background:'transparent',
            color:'#ef4444', fontSize:13, cursor:'pointer' }}>
          Удалить
        </button>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   Renderer для отображения extras внутри карточки поста
══════════════════════════════════════════════════════ */
export function PostExtrasRenderer({ extras, c, accent }:{
  extras?: PostExtras | null; c: any; accent: string;
}) {
  if (!extras) return null;
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:8 }}>
      {extras.carousel && extras.carousel.urls.length > 0 && (
        <ExtraCarousel urls={extras.carousel.urls} c={c}/>
      )}
      {extras.booking && (
        <ExtraBooking booking={extras.booking} c={c} accent={accent}/>
      )}
      {extras.poll && (
        <ExtraPoll poll={extras.poll} c={c} accent={accent}/>
      )}
      {extras.quiz && (
        <ExtraQuiz quiz={extras.quiz} c={c} accent={accent}/>
      )}
      {extras.question && (
        <ExtraQuestion question={extras.question} c={c} accent={accent}/>
      )}
      {extras.challenge && (
        <ExtraChallenge challenge={extras.challenge} c={c} accent={accent}/>
      )}
      {extras.link && extras.link.url && (
        <PostExtrasLinkPreview link={extras.link} c={c} accent={accent}/>
      )}
      {extras.activity && (
        <ExtraActivity activity={extras.activity} c={c} accent={accent}/>
      )}
    </div>
  );
}

function ExtraCarousel({ urls, c }:{ urls: string[]; c: any }) {
  const [idx, setIdx] = useState(0);
  if (!urls.length) return null;
  return (
    <div style={{ position:'relative', width:'100%', aspectRatio:'4/3', borderRadius:14, overflow:'hidden',
      background:'#000', border:`1px solid ${c.border}` }}>
      <img src={urls[idx]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
      {urls.length > 1 && (
        <>
          <button type="button" onClick={() => setIdx(i => (i - 1 + urls.length) % urls.length)}
            style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)',
              width:36, height:36, borderRadius:'50%', border:'none', background:'rgba(0,0,0,0.55)',
              color:'#fff', fontSize:18, cursor:'pointer' }}>‹</button>
          <button type="button" onClick={() => setIdx(i => (i + 1) % urls.length)}
            style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)',
              width:36, height:36, borderRadius:'50%', border:'none', background:'rgba(0,0,0,0.55)',
              color:'#fff', fontSize:18, cursor:'pointer' }}>›</button>
          <div style={{ position:'absolute', bottom:8, left:0, right:0, display:'flex',
            justifyContent:'center', gap:5 }}>
            {urls.map((_, i) => (
              <div key={i} style={{ width: i===idx?18:6, height:6, borderRadius:3,
                background: i===idx ? '#fff' : 'rgba(255,255,255,0.5)', transition:'all 0.2s' }}/>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ExtraBooking({ booking, c, accent }:{
  booking: NonNullable<PostExtras['booking']>; c: any; accent: string;
}) {
  const [bookedTimes, setBookedTimes] = useState<string[]>([]);
  const toggle = (t: string) => setBookedTimes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  return (
    <div style={{ padding:'12px', borderRadius:12, background:`${accent}10`, border:`1px solid ${accent}40` }}>
      <p style={{ margin:'0 0 8px', fontSize:13, fontWeight:800, color:c.light }}>📅 {booking.label || 'Записаться'}</p>
      {booking.slots.length === 0 ? (
        <button type="button"
          style={{ width:'100%', padding:'10px', borderRadius:10, border:'none',
            background: accent, color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer' }}>
          {booking.label || 'Записаться'} →
        </button>
      ) : (
        <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
          {booking.slots.map(t => {
            const on = bookedTimes.includes(t);
            return (
              <button key={t} type="button" onClick={() => toggle(t)}
                style={{ padding:'7px 12px', borderRadius:10, border:`1.5px solid ${on?accent:c.border}`,
                  background: on?`${accent}33`:'transparent', color: on?accent:c.light,
                  fontSize:12, fontWeight:700, cursor:'pointer' }}>
                {on ? '✓ ' : '🕐 '}{t}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ExtraPoll({ poll, c, accent }:{
  poll: NonNullable<PostExtras['poll']>; c: any; accent: string;
}) {
  const [voted, setVoted] = useState<number | null>(null);
  const [counts, setCounts] = useState<number[]>(poll.options.map(() => 0));
  const total = counts.reduce((a, b) => a + b, 0);
  const vote = (i: number) => {
    if (voted !== null) return;
    setVoted(i);
    setCounts(prev => prev.map((v, j) => v + (j === i ? 1 : 0)));
  };
  return (
    <div style={{ padding:'12px', borderRadius:12, background:`${accent}10`, border:`1px solid ${accent}40` }}>
      <p style={{ margin:'0 0 8px', fontSize:13, fontWeight:800, color:c.light }}>📊 {poll.question}</p>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {poll.options.map((opt, i) => {
          const pct = total ? Math.round((counts[i]! / total) * 100) : 0;
          const on = voted === i;
          return (
            <button key={i} type="button" onClick={() => vote(i)} disabled={voted !== null}
              style={{ position:'relative', padding:'9px 12px', borderRadius:10, border:`1px solid ${on?accent:c.border}`,
                background:'transparent', color:c.light, fontSize:13, fontWeight:600,
                cursor: voted === null ? 'pointer' : 'default', overflow:'hidden', textAlign:'left' }}>
              {voted !== null && (
                <div style={{ position:'absolute', inset:0, width:`${pct}%`,
                  background:`${accent}26`, transition:'width 0.4s' }}/>
              )}
              <span style={{ position:'relative' }}>{opt}{voted !== null ? ` · ${pct}%` : ''}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ExtraQuiz({ quiz, c, accent }:{
  quiz: NonNullable<PostExtras['quiz']>; c: any; accent: string;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const correct = picked !== null && picked === quiz.correctIdx;
  return (
    <div style={{ padding:'12px', borderRadius:12, background:`${accent}10`, border:`1px solid ${accent}40` }}>
      <p style={{ margin:'0 0 8px', fontSize:13, fontWeight:800, color:c.light }}>🎯 {quiz.question}</p>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {quiz.options.map((opt, i) => {
          const isPicked = picked === i;
          const isRight = picked !== null && i === quiz.correctIdx;
          const isWrong = isPicked && i !== quiz.correctIdx;
          const color = isRight ? '#22c55e' : isWrong ? '#ef4444' : (isPicked ? accent : c.border);
          return (
            <button key={i} type="button" onClick={() => picked === null && setPicked(i)} disabled={picked !== null}
              style={{ padding:'9px 12px', borderRadius:10, border:`1.5px solid ${color}`,
                background: isRight ? 'rgba(34,197,94,0.15)' : isWrong ? 'rgba(239,68,68,0.15)' : 'transparent',
                color: c.light, fontSize:13, fontWeight:600,
                cursor: picked === null ? 'pointer' : 'default', textAlign:'left' }}>
              {isRight ? '✓ ' : isWrong ? '✕ ' : ''}{opt}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <p style={{ margin:'8px 0 0', fontSize:12, color: correct ? '#22c55e' : '#ef4444', fontWeight:700 }}>
          {correct ? '✓ Правильно!' : '✕ Неправильно. Правильный ответ выделен зелёным.'}
        </p>
      )}
    </div>
  );
}

function ExtraQuestion({ question, c, accent }:{
  question: NonNullable<PostExtras['question']>; c: any; accent: string;
}) {
  return (
    <div style={{ padding:'12px', borderRadius:12, background:`${accent}10`, border:`1px solid ${accent}40` }}>
      <p style={{ margin:0, fontSize:11, color:accent, fontWeight:800, letterSpacing:0.4 }}>❓ ВОПРОС ПОДПИСЧИКАМ</p>
      <p style={{ margin:'4px 0 0', fontSize:14, color:c.light, lineHeight:1.4 }}>{question.text}</p>
      <p style={{ margin:'6px 0 0', fontSize:11, color:c.sub }}>Ответьте в комментариях ↓</p>
    </div>
  );
}

function ExtraChallenge({ challenge, c, accent }:{
  challenge: NonNullable<PostExtras['challenge']>; c: any; accent: string;
}) {
  return (
    <div style={{ padding:'12px', borderRadius:12, background:`${accent}10`, border:`1px solid ${accent}40` }}>
      <p style={{ margin:0, fontSize:11, color:accent, fontWeight:800, letterSpacing:0.4 }}>🏆 ЧЕЛЛЕНДЖ</p>
      <p style={{ margin:'4px 0 0', fontSize:14, color:c.light, lineHeight:1.4 }}>{challenge.text}</p>
      <p style={{ margin:'6px 0 0', fontSize:11, color:c.sub }}>
        Дедлайн: {challenge.deadlineH >= 168 ? `${challenge.deadlineH/24} дн.` : `${challenge.deadlineH} ч.`}
      </p>
    </div>
  );
}

export function PostExtrasLinkPreview({ link, c, accent }:{
  link: NonNullable<PostExtras['link']>; c: any; accent: string;
}) {
  let host = '';
  let safeUrl = '';
  try {
    const u = new URL(link.url);
    if (u.protocol === 'http:' || u.protocol === 'https:') { host = u.host; safeUrl = u.href; }
  } catch {}
  const Tag: any = safeUrl ? 'a' : 'div';
  const tagProps: any = safeUrl ? { href: safeUrl, target: '_blank', rel: 'noreferrer noopener' } : {};
  return (
    <Tag {...tagProps}
      style={{ display:'flex', gap:10, padding:'10px', borderRadius:12, cursor: safeUrl?'pointer':'default',
        background:`${accent}10`, border:`1px solid ${accent}40`, textDecoration:'none' }}>
      <div style={{ width:42, height:42, borderRadius:10, background:`${accent}33`,
        display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>🔗</div>
      <div style={{ flex:1, minWidth:0 }}>
        <p style={{ margin:0, fontSize:13, fontWeight:800, color:c.light,
          whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {link.title || host || link.url}
        </p>
        {link.description && (
          <p style={{ margin:'2px 0 0', fontSize:12, color:c.sub, lineHeight:1.3,
            display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
            {link.description}
          </p>
        )}
        {host && (link.title || link.description) && (
          <p style={{ margin:'2px 0 0', fontSize:11, color:accent }}>{host}</p>
        )}
      </div>
    </Tag>
  );
}

function ExtraActivity({ activity, c, accent }:{
  activity: NonNullable<PostExtras['activity']>; c: any; accent: string;
}) {
  return (
    <div style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'8px 12px', borderRadius:24,
      background:`${accent}1a`, border:`1px solid ${accent}55`, alignSelf:'flex-start' }}>
      <span style={{ fontSize:18 }}>{activity.emoji}</span>
      <span style={{ fontSize:13, fontWeight:700, color:c.light }}>{activity.label}</span>
    </div>
  );
}

/* Утилита: «есть ли что-то в extras» */
export function hasAnyExtras(e?: PostExtras | null): boolean {
  if (!e) return false;
  return !!(e.carousel?.urls?.length || e.booking || e.poll || e.quiz || e.question || e.challenge || (e.link && e.link.url) || e.activity);
}
