import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ═══════════════════════════════════════════════════════════
   ТИПЫ
═══════════════════════════════════════════════════════════ */
export interface BotButton {
  id: string;
  label: string;
  nextScreen: string;
}
export interface BotScreen {
  id: string;
  name: string;
  text: string;
  imageUrl: string;
  buttons: BotButton[];
  x: number;
  y: number;
}
export interface BotConfig {
  startScreen: string;
  screens: Record<string, BotScreen>;
}
export interface SwBot {
  id: string;
  ownerHash?: string;
  name: string;
  avatarUrl?: string;
  description?: string;
  config: BotConfig;
  isPublic?: string;
  startCount?: number;
  createdAt?: string;
}

/* ═══════════════════════════════════════════════════════════
   ЦВЕТА
═══════════════════════════════════════════════════════════ */
const C = {
  deep:'#0A0A14', surface:'#12121E', card:'#1A1A2E', cardAlt:'#14142A',
  border:'#2A2A4A', borderB:'#1E1E3A', light:'#E8E8F8', mid:'#9090B8', sub:'#5A5A8A',
};
const AC = '#7C6FFF';
const GREEN = '#22C55E';
const RED = '#EF4444';

function uid() { return Math.random().toString(36).slice(2,10); }

function getSessionToken() { return localStorage.getItem('swaip_session_token') || ''; }

/* ═══════════════════════════════════════════════════════════
   БОТ-ЧАТ — интерфейс взаимодействия с ботом
═══════════════════════════════════════════════════════════ */
export function BotChat({ bot, onClose }: { bot: SwBot; onClose: () => void }) {
  const cfg = bot.config || { startScreen: 'start', screens: {} };
  const [screenId, setScreenId] = useState(cfg.startScreen || 'start');
  const [history, setHistory] = useState<string[]>([]);

  const screen = cfg.screens[screenId];

  const go = (nextId: string) => {
    if (!nextId || !cfg.screens[nextId]) return;
    setHistory(h => [...h, screenId]);
    setScreenId(nextId);
    /* счётчик */
    if (history.length === 0) {
      fetch(`${window.location.origin}/api/bots/${bot.id}/start`, { method: 'POST' }).catch(() => {});
    }
  };

  const goBack = () => {
    const prev = history[history.length - 1];
    if (prev) { setHistory(h => h.slice(0, -1)); setScreenId(prev); }
  };

  if (!screen) return (
    <div style={{ position:'fixed',inset:0,background:C.deep,display:'flex',alignItems:'center',justifyContent:'center',zIndex:500,flexDirection:'column',gap:16 }}>
      <div style={{ fontSize:40 }}>🤖</div>
      <div style={{ color:C.mid }}>Экран не найден</div>
      <button onClick={onClose} style={{ padding:'10px 24px',background:AC,border:'none',borderRadius:12,color:'#fff',cursor:'pointer' }}>Закрыть</button>
    </div>
  );

  return (
    <div style={{ position:'fixed',inset:0,background:C.deep,display:'flex',flexDirection:'column',zIndex:500,fontFamily:'inherit' }}>
      {/* Шапка */}
      <div style={{ background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'12px 16px',display:'flex',alignItems:'center',gap:10,flexShrink:0 }}>
        {history.length > 0
          ? <motion.button whileTap={{scale:0.88}} onClick={goBack}
              style={{ width:34,height:34,borderRadius:10,background:C.cardAlt,border:`1px solid ${C.border}`,color:C.mid,fontSize:18,cursor:'pointer',flexShrink:0 }}>←</motion.button>
          : <motion.button whileTap={{scale:0.88}} onClick={onClose}
              style={{ width:34,height:34,borderRadius:10,background:C.cardAlt,border:`1px solid ${C.border}`,color:C.mid,fontSize:18,cursor:'pointer',flexShrink:0 }}>✕</motion.button>}
        <div style={{ flex:1 }}>
          <div style={{ fontSize:15,fontWeight:800,color:C.light }}>{bot.name}</div>
          <div style={{ fontSize:11,color:C.sub }}>🤖 Бот SWAIP</div>
        </div>
      </div>

      {/* Контент */}
      <AnimatePresence mode="wait">
        <motion.div key={screenId} initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} transition={{duration:0.22}}
          style={{ flex:1,overflowY:'auto',padding:'20px 16px',display:'flex',flexDirection:'column',gap:14 }}>

          {/* Сообщение бота */}
          <div style={{ display:'flex',gap:10,alignItems:'flex-start' }}>
            <div style={{ width:38,height:38,borderRadius:'50%',background:AC+'33',border:`2px solid ${AC}66`,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,overflow:'hidden' }}>
              {bot.avatarUrl ? <img src={bot.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : '🤖'}
            </div>
            <div style={{ maxWidth:'80%' }}>
              {screen.imageUrl && (
                <div style={{ borderRadius:14,overflow:'hidden',marginBottom:8,maxWidth:280 }}>
                  <img src={screen.imageUrl} alt="" style={{ width:'100%',display:'block',maxHeight:200,objectFit:'cover' }}/>
                </div>
              )}
              <div style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:'4px 16px 16px 16px',padding:'12px 14px' }}>
                <div style={{ fontSize:14,color:C.light,lineHeight:1.6,whiteSpace:'pre-wrap' }}>{screen.text || '...'}</div>
              </div>
            </div>
          </div>

          {/* Кнопки */}
          {screen.buttons.length > 0 && (
            <div style={{ display:'flex',flexDirection:'column',gap:8,paddingLeft:48 }}>
              {screen.buttons.map(btn => (
                <motion.button key={btn.id} whileTap={{scale:0.96}}
                  onClick={() => go(btn.nextScreen)}
                  disabled={!btn.nextScreen}
                  style={{ padding:'12px 18px',borderRadius:12,background:btn.nextScreen?AC:'rgba(124,111,255,0.15)',
                    border:`1.5px solid ${btn.nextScreen?AC:C.border}`,
                    color:btn.nextScreen?'#fff':C.sub,fontWeight:700,fontSize:14,cursor:btn.nextScreen?'pointer':'not-allowed',
                    textAlign:'left',fontFamily:'inherit',transition:'all 0.15s' }}>
                  {btn.label || '—'}
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   РЕДАКТОР ЭКРАНА
═══════════════════════════════════════════════════════════ */
function ScreenEditor({
  screen, screens, onUpdate, onDelete, onSetStart, isStart, apiBase
}: {
  screen: BotScreen;
  screens: Record<string, BotScreen>;
  onUpdate: (s: BotScreen) => void;
  onDelete: () => void;
  onSetStart: () => void;
  isStart: boolean;
  apiBase: string;
}) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<BotScreen>) => onUpdate({ ...screen, ...patch });

  const addBtn = () => set({ buttons: [...screen.buttons, { id: uid(), label: 'Кнопка', nextScreen: '' }] });
  const delBtn = (id: string) => set({ buttons: screen.buttons.filter(b => b.id !== id) });
  const setBtn = (id: string, patch: Partial<BotButton>) => set({
    buttons: screen.buttons.map(b => b.id === id ? { ...b, ...patch } : b)
  });

  const uploadImg = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('image', file);
      const tok = getSessionToken();
      const r = await fetch(`${apiBase}/api/image-upload`, { method:'POST', headers:{'x-session-token':tok}, body:fd });
      const d = await r.json();
      if (d.url) set({ imageUrl: d.url });
    } catch {} finally { setUploading(false); }
  };

  const otherScreens = Object.values(screens).filter(s => s.id !== screen.id);

  const inp = (style?:React.CSSProperties): React.CSSProperties => ({
    width:'100%', boxSizing:'border-box', padding:'9px 12px',
    background:C.cardAlt, border:`1px solid ${C.borderB}`, borderRadius:9,
    color:C.light, fontSize:13, outline:'none', fontFamily:'inherit', ...style
  });

  return (
    <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
      {/* Название экрана */}
      <div>
        <div style={{ fontSize:10,fontWeight:700,color:C.sub,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em' }}>Название экрана</div>
        <input value={screen.name} onChange={e=>set({name:e.target.value})} style={inp()} placeholder="Главное меню"/>
      </div>

      {/* Текст сообщения */}
      <div>
        <div style={{ fontSize:10,fontWeight:700,color:C.sub,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em' }}>Текст сообщения</div>
        <textarea value={screen.text} onChange={e=>set({text:e.target.value})} rows={4}
          style={{...inp(),resize:'vertical',lineHeight:1.6}} placeholder="Привет! Выберите раздел:"/>
      </div>

      {/* Изображение */}
      <div>
        <div style={{ fontSize:10,fontWeight:700,color:C.sub,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em' }}>Изображение</div>
        {screen.imageUrl && (
          <div style={{ position:'relative',borderRadius:10,overflow:'hidden',marginBottom:8 }}>
            <img src={screen.imageUrl} alt="" style={{ width:'100%',maxHeight:140,objectFit:'cover',display:'block' }}/>
            <button onClick={()=>set({imageUrl:''})}
              style={{ position:'absolute',top:6,right:6,width:26,height:26,borderRadius:'50%',background:'rgba(0,0,0,0.7)',border:'none',color:'#fff',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>✕</button>
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files?.[0]&&uploadImg(e.target.files[0])}/>
        <motion.button whileTap={{scale:0.95}} onClick={()=>fileRef.current?.click()} disabled={uploading}
          style={{ width:'100%',padding:'9px',borderRadius:9,background:C.cardAlt,border:`1px dashed ${C.border}`,color:C.mid,fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>
          {uploading?'Загрузка...':'📷 Загрузить фото'}
        </motion.button>
      </div>

      {/* Кнопки */}
      <div>
        <div style={{ fontSize:10,fontWeight:700,color:C.sub,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em' }}>Кнопки ({screen.buttons.length})</div>
        <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
          {screen.buttons.map((btn, i) => (
            <div key={btn.id} style={{ background:C.cardAlt,border:`1px solid ${C.border}`,borderRadius:10,padding:10 }}>
              <div style={{ display:'flex',gap:6,marginBottom:6 }}>
                <input value={btn.label} onChange={e=>setBtn(btn.id,{label:e.target.value})}
                  style={{...inp({flex:1}),padding:'7px 10px'}} placeholder={`Кнопка ${i+1}`}/>
                <button onClick={()=>delBtn(btn.id)}
                  style={{ width:30,height:30,borderRadius:8,background:RED+'22',border:`1px solid ${RED}44`,color:RED,fontSize:14,cursor:'pointer',flexShrink:0 }}>✕</button>
              </div>
              <select value={btn.nextScreen} onChange={e=>setBtn(btn.id,{nextScreen:e.target.value})}
                style={{...inp(),fontSize:12}}>
                <option value="">— не подключена —</option>
                {otherScreens.map(s => <option key={s.id} value={s.id}>{s.name || s.id}</option>)}
              </select>
              {btn.nextScreen && <div style={{fontSize:10,color:GREEN,marginTop:4}}>→ {screens[btn.nextScreen]?.name || btn.nextScreen}</div>}
            </div>
          ))}
          <motion.button whileTap={{scale:0.96}} onClick={addBtn}
            style={{ padding:'8px',borderRadius:9,background:AC+'18',border:`1px dashed ${AC}66`,color:AC,fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>
            + Добавить кнопку
          </motion.button>
        </div>
      </div>

      {/* Действия */}
      <div style={{ display:'flex',gap:8,marginTop:4 }}>
        {!isStart && (
          <button onClick={onSetStart}
            style={{ flex:1,padding:'8px',borderRadius:9,background:GREEN+'18',border:`1px solid ${GREEN}44`,color:GREEN,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>
            ⭐ Сделать стартовым
          </button>
        )}
        {isStart && <div style={{ flex:1,padding:'8px',borderRadius:9,background:GREEN+'12',color:GREEN,fontSize:11,fontWeight:700,textAlign:'center' }}>⭐ Стартовый экран</div>}
        {screen.id !== 'start' && (
          <button onClick={onDelete}
            style={{ padding:'8px 12px',borderRadius:9,background:RED+'18',border:`1px solid ${RED}44`,color:RED,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit' }}>
            🗑 Удалить
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   КАНВАС — визуальный редактор
═══════════════════════════════════════════════════════════ */
function FlowCanvas({
  config, onConfigChange, selectedId, onSelect, apiBase
}: {
  config: BotConfig;
  onConfigChange: (c: BotConfig) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  apiBase: string;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<{ id: string; ox: number; oy: number } | null>(null);

  const screens = Object.values(config.screens);

  /* Перемещение экрана */
  const onMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    onSelect(id);
    dragging.current = { id, ox: e.clientX - config.screens[id].x, oy: e.clientY - config.screens[id].y };
  };

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging.current) return;
    const { id, ox, oy } = dragging.current;
    const x = Math.max(0, e.clientX - ox);
    const y = Math.max(0, e.clientY - oy);
    onConfigChange({
      ...config,
      screens: { ...config.screens, [id]: { ...config.screens[id], x, y } }
    });
  }, [config, onConfigChange]);

  const onMouseUp = useCallback(() => { dragging.current = null; }, []);

  useEffect(() => {
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => { window.removeEventListener('mousemove', onMouseMove); window.removeEventListener('mouseup', onMouseUp); };
  }, [onMouseMove, onMouseUp]);

  /* Добавить экран */
  const addScreen = () => {
    const id = uid();
    const newScreen: BotScreen = {
      id, name: 'Новый экран', text: 'Текст сообщения',
      imageUrl: '', buttons: [], x: 80 + Math.random() * 200, y: 80 + Math.random() * 150
    };
    onConfigChange({ ...config, screens: { ...config.screens, [id]: newScreen } });
    onSelect(id);
  };

  /* SVG стрелки */
  const CARD_W = 160, CARD_H = 90;

  const arrows: { x1:number;y1:number;x2:number;y2:number;label:string;btnIdx:number }[] = [];
  for (const sc of screens) {
    sc.buttons.forEach((btn, bi) => {
      const target = btn.nextScreen ? config.screens[btn.nextScreen] : null;
      if (!target) return;
      const x1 = sc.x + CARD_W;
      const y1 = sc.y + 36 + bi * 22;
      const x2 = target.x;
      const y2 = target.y + CARD_H / 2;
      arrows.push({ x1, y1, x2, y2, label: btn.label, btnIdx: bi });
    });
  }

  return (
    <div style={{ flex:1,position:'relative',overflow:'auto',background:`radial-gradient(circle at 50% 50%, #1A1A30 0%, ${C.deep} 70%)` }}>
      {/* Кнопка добавить */}
      <button onClick={addScreen}
        style={{ position:'absolute',top:12,left:12,zIndex:10,padding:'8px 16px',borderRadius:10,background:AC,border:'none',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer' }}>
        + Экран
      </button>

      {/* SVG стрелки */}
      <svg style={{ position:'absolute',inset:0,pointerEvents:'none',width:'100%',height:'100%',zIndex:1 }}>
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill={AC}/>
          </marker>
        </defs>
        {arrows.map((a, i) => {
          const cx1 = a.x1 + 60, cx2 = a.x2 - 60;
          const path = `M${a.x1},${a.y1} C${cx1},${a.y1} ${cx2},${a.y2} ${a.x2},${a.y2}`;
          const mx = (a.x1 + a.x2) / 2;
          const my = (a.y1 + a.y2) / 2;
          return (
            <g key={i}>
              <path d={path} fill="none" stroke={AC} strokeWidth="1.5" strokeDasharray="4 3" markerEnd="url(#arrow)" opacity="0.7"/>
              <rect x={mx-28} y={my-9} width={56} height={16} rx={6} fill={C.surface} stroke={AC+'44'} strokeWidth={1}/>
              <text x={mx} y={my+4} textAnchor="middle" fontSize="9" fill={AC} fontFamily="sans-serif">
                {a.label.length > 10 ? a.label.slice(0,10)+'…' : a.label}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Карточки экранов */}
      {screens.map(sc => {
        const isSelected = selectedId === sc.id;
        const isStart = config.startScreen === sc.id;
        return (
          <div key={sc.id}
            onMouseDown={e => onMouseDown(e, sc.id)}
            style={{
              position:'absolute', left:sc.x, top:sc.y, width:CARD_W, zIndex:isSelected?5:2,
              background:isSelected?AC+'22':C.card,
              border:`2px solid ${isSelected?AC:isStart?GREEN:C.border}`,
              borderRadius:14, padding:'10px 12px', cursor:'grab', userSelect:'none',
              boxShadow:isSelected?`0 0 0 3px ${AC}44`:'none', transition:'box-shadow 0.15s'
            }}>
            {isStart && <div style={{ position:'absolute',top:-10,left:8,fontSize:9,fontWeight:800,color:GREEN,background:C.deep,padding:'1px 6px',borderRadius:8,border:`1px solid ${GREEN}44` }}>СТАРТ</div>}
            <div style={{ fontSize:12,fontWeight:800,color:C.light,marginBottom:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
              {sc.name || 'Экран'}
            </div>
            {sc.imageUrl && <div style={{ width:'100%',height:36,borderRadius:6,overflow:'hidden',marginBottom:4 }}>
              <img src={sc.imageUrl} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
            </div>}
            <div style={{ fontSize:10,color:C.mid,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',lineHeight:1.4 }}>
              {sc.text || '—'}
            </div>
            {sc.buttons.length > 0 && (
              <div style={{ marginTop:6,display:'flex',flexDirection:'column',gap:3 }}>
                {sc.buttons.slice(0,3).map(btn => (
                  <div key={btn.id} style={{ fontSize:9,padding:'3px 7px',borderRadius:6,background:btn.nextScreen?AC+'33':C.cardAlt,border:`1px solid ${btn.nextScreen?AC+'55':C.border}`,color:btn.nextScreen?AC:C.sub,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                    {btn.label}
                    {btn.nextScreen && <span style={{color:GREEN}}> →</span>}
                  </div>
                ))}
                {sc.buttons.length > 3 && <div style={{fontSize:9,color:C.sub}}>+{sc.buttons.length-3} ещё</div>}
              </div>
            )}
          </div>
        );
      })}

      {/* Пустой холст */}
      {screens.length === 0 && (
        <div style={{ position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',textAlign:'center',color:C.sub }}>
          <div style={{ fontSize:40,marginBottom:12 }}>🤖</div>
          <div style={{ fontSize:14,fontWeight:700,color:C.mid,marginBottom:6 }}>Нажмите «+ Экран», чтобы начать</div>
          <div style={{ fontSize:12 }}>Каждый экран — это одно сообщение бота с кнопками</div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ИНСТРУКЦИЯ
═══════════════════════════════════════════════════════════ */
const HELP_STEPS = [
  {
    icon: '🤖',
    title: 'Что такое SWAIP-бот?',
    text: 'Это интерактивный бот без кода — как Telegram-бот. Он состоит из экранов: каждый экран показывает сообщение и кнопки. Пользователь нажимает кнопку — переходит на следующий экран.',
  },
  {
    icon: '➕',
    title: 'Шаг 1 — Создайте бота',
    text: 'Нажмите «+ Создать бота». Откроется редактор. По умолчанию уже есть первый экран «Старт» — это начало разговора.',
  },
  {
    icon: '📋',
    title: 'Шаг 2 — Настройте экран',
    text: 'Нажмите на карточку экрана слева. Справа появится редактор: введите название, текст сообщения, добавьте фото. Это то, что увидит пользователь.',
  },
  {
    icon: '🔘',
    title: 'Шаг 3 — Добавьте кнопки',
    text: 'В редакторе нажмите «+ Добавить кнопку». Введите текст кнопки и выберите, на какой экран она переводит. Стрелки на канвасе покажут связи между экранами.',
  },
  {
    icon: '➕',
    title: 'Шаг 4 — Добавьте экраны',
    text: 'Нажмите «+ Экран» в левом верхнем углу редактора, чтобы добавить новый экран. Экраны можно перетаскивать по канвасу.',
  },
  {
    icon: '⭐',
    title: 'Стартовый экран',
    text: 'Первый экран, с которого начинается бот — стартовый (отмечен звёздочкой). Чтобы сменить стартовый экран: выберите нужный экран → нажмите «⭐ Сделать стартовым» в редакторе.',
  },
  {
    icon: '▶️',
    title: 'Шаг 5 — Протестируйте',
    text: 'Нажмите кнопку «▶ Тест» в шапке. Откроется режим чата — вы увидите бота глазами пользователя и сможете кликать по кнопкам.',
  },
  {
    icon: '💾',
    title: 'Шаг 6 — Сохраните',
    text: 'Нажмите «💾 Сохранить». Бот сохранится в SWAIP. На вкладке «⚙️ Бот» можно включить публичный режим — тогда бот появится в общем каталоге.',
  },
];

function HelpModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const cur = HELP_STEPS[step];

  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(8px)',zIndex:1100,display:'flex',alignItems:'center',justifyContent:'center',padding:16 }}
      onClick={onClose}>
      <motion.div initial={{scale:0.88,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.88,opacity:0}}
        style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,width:'100%',maxWidth:360,overflow:'hidden',maxHeight:'90dvh',display:'flex',flexDirection:'column' }}
        onClick={e=>e.stopPropagation()}>

        {/* Шапка */}
        <div style={{ background:AC,padding:'16px 20px',display:'flex',alignItems:'center',gap:10 }}>
          <div style={{ fontSize:28 }}>{cur.icon}</div>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:13,fontWeight:900,color:'#fff' }}>{cur.title}</div>
            <div style={{ fontSize:10,color:'rgba(255,255,255,0.65)',marginTop:2 }}>Шаг {step+1} из {HELP_STEPS.length}</div>
          </div>
          <button onClick={onClose} style={{ width:28,height:28,borderRadius:'50%',background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',fontSize:14,cursor:'pointer' }}>✕</button>
        </div>

        {/* Прогресс */}
        <div style={{ display:'flex',gap:4,padding:'12px 20px 0' }}>
          {HELP_STEPS.map((_,i) => (
            <div key={i} onClick={()=>setStep(i)} style={{ flex:1,height:3,borderRadius:99,background:i<=step?AC:C.border,cursor:'pointer',transition:'background 0.2s' }}/>
          ))}
        </div>

        {/* Контент */}
        <div style={{ flex:1,overflowY:'auto',padding:'20px' }}>
          <AnimatePresence mode="wait">
            <motion.div key={step} initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} transition={{duration:0.18}}>
              <p style={{ fontSize:14,color:C.light,lineHeight:1.7,margin:0 }}>{cur.text}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Кнопки навигации */}
        <div style={{ display:'flex',gap:8,padding:'12px 20px 20px' }}>
          {step > 0 && (
            <button onClick={()=>setStep(s=>s-1)}
              style={{ flex:1,padding:'11px',borderRadius:12,background:C.cardAlt,border:`1px solid ${C.border}`,color:C.mid,fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'inherit' }}>
              ← Назад
            </button>
          )}
          {step < HELP_STEPS.length - 1 ? (
            <motion.button whileTap={{scale:0.96}} onClick={()=>setStep(s=>s+1)}
              style={{ flex:1,padding:'11px',borderRadius:12,background:AC,border:'none',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'inherit' }}>
              Далее →
            </motion.button>
          ) : (
            <motion.button whileTap={{scale:0.96}} onClick={onClose}
              style={{ flex:1,padding:'11px',borderRadius:12,background:AC,border:'none',color:'#fff',fontWeight:800,fontSize:13,cursor:'pointer',fontFamily:'inherit' }}>
              Понятно! 🚀
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   СПИСОК БОТОВ
═══════════════════════════════════════════════════════════ */
function BotList({ bots, onOpen, onCreate, onChat, loading }: {
  bots: SwBot[];
  onOpen: (b: SwBot) => void;
  onCreate: () => void;
  onChat: (b: SwBot) => void;
  loading: boolean;
}) {
  return (
    <div style={{ display:'flex',flexDirection:'column',gap:10,padding:'12px 0' }}>
      <motion.button whileTap={{scale:0.96}} onClick={onCreate}
        style={{ margin:'0 0 4px',padding:'12px',borderRadius:12,background:AC,border:'none',color:'#fff',fontWeight:800,fontSize:14,cursor:'pointer',fontFamily:'inherit' }}>
        + Создать бота
      </motion.button>

      {loading && <div style={{ textAlign:'center',padding:20,color:C.sub,fontSize:13 }}>Загрузка...</div>}

      {!loading && bots.length === 0 && (
        <div style={{ textAlign:'center',padding:'30px 0',color:C.sub,fontSize:13 }}>
          <div style={{ fontSize:32,marginBottom:8 }}>🤖</div>
          <div>У вас нет ботов. Создайте первого!</div>
        </div>
      )}

      {bots.map(bot => (
        <div key={bot.id} style={{ background:C.card,border:`1px solid ${C.border}`,borderRadius:14,overflow:'hidden' }}>
          <div style={{ display:'flex',gap:10,padding:'12px 12px 8px',alignItems:'center' }}>
            <div style={{ width:42,height:42,borderRadius:'50%',background:AC+'33',border:`2px solid ${AC}44`,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,overflow:'hidden' }}>
              {bot.avatarUrl ? <img src={bot.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : '🤖'}
            </div>
            <div style={{ flex:1,minWidth:0 }}>
              <div style={{ fontSize:14,fontWeight:800,color:C.light }}>{bot.name}</div>
              <div style={{ fontSize:11,color:C.sub }}>{Object.keys(bot.config?.screens||{}).length} экр. · {bot.startCount||0} запусков</div>
            </div>
            {bot.isPublic==='true' && <div style={{ fontSize:9,fontWeight:700,color:GREEN,background:GREEN+'18',border:`1px solid ${GREEN}33`,borderRadius:8,padding:'2px 7px' }}>Публичный</div>}
          </div>
          {bot.description && <div style={{ padding:'0 12px 8px',fontSize:11,color:C.sub }}>{bot.description}</div>}
          <div style={{ display:'flex',gap:6,padding:'0 12px 10px' }}>
            <button onClick={()=>onOpen(bot)}
              style={{ flex:1,padding:'8px',borderRadius:9,background:AC,border:'none',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>✏️ Редактировать</button>
            <button onClick={()=>onChat(bot)}
              style={{ flex:1,padding:'8px',borderRadius:9,background:C.cardAlt,border:`1px solid ${C.border}`,color:C.mid,fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>▶️ Запустить</button>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ГЛАВНЫЙ КОМПОНЕНТ — BotBuilder
═══════════════════════════════════════════════════════════ */
export default function BotBuilder({ onClose, apiBase }: { onClose: () => void; apiBase: string }) {
  /* Список ботов */
  const [bots, setBots] = useState<SwBot[]>([]);
  const [botsLoading, setBotsLoading] = useState(true);

  /* Редактируемый бот */
  const [editBot, setEditBot] = useState<SwBot | null>(null);
  const [saving, setSaving] = useState(false);

  /* Выбранный экран */
  const [selectedScreenId, setSelectedScreenId] = useState<string | null>(null);

  /* Режим чата */
  const [chatBot, setChatBot] = useState<SwBot | null>(null);

  /* Вкладка боковой панели */
  const [sideTab, setSideTab] = useState<'screen'|'settings'>('screen');

  /* Инструкция */
  const [showHelp, setShowHelp] = useState(false);

  /* Загрузка ботов */
  useEffect(() => {
    const tok = getSessionToken();
    if (!tok) { setBotsLoading(false); return; }
    setBotsLoading(true);
    fetch(`${apiBase}/api/bots`, { headers: { 'x-session-token': tok } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const list: SwBot[] = Array.isArray(data) ? data : [];
        /* Парсим config если он строка */
        setBots(list.map(b => ({ ...b, config: typeof b.config === 'string' ? JSON.parse(b.config) : b.config })));
      })
      .catch(() => {})
      .finally(() => setBotsLoading(false));
  }, [apiBase]);

  /* Создать бота */
  const createBot = async () => {
    const tok = getSessionToken();
    const r = await fetch(`${apiBase}/api/bots`, { method:'POST', headers:{ 'Content-Type':'application/json','x-session-token':tok }, body:JSON.stringify({ name:'Новый бот' }) });
    const bot = await r.json();
    const parsed = { ...bot, config: typeof bot.config==='string'?JSON.parse(bot.config):bot.config };
    setBots(prev => [parsed, ...prev]);
    openEdit(parsed);
  };

  /* Открыть редактор */
  const openEdit = (bot: SwBot) => {
    const cfg = typeof bot.config === 'string' ? JSON.parse(bot.config as unknown as string) : bot.config;
    setEditBot({ ...bot, config: cfg });
    setSelectedScreenId(cfg.startScreen || Object.keys(cfg.screens)[0] || null);
    setSideTab('screen');
  };

  /* Сохранить */
  const saveBot = async () => {
    if (!editBot) return;
    setSaving(true);
    try {
      const tok = getSessionToken();
      const r = await fetch(`${apiBase}/api/bots/${editBot.id}`, {
        method:'PUT', headers:{'Content-Type':'application/json','x-session-token':tok},
        body:JSON.stringify({ name:editBot.name, description:editBot.description, avatarUrl:editBot.avatarUrl, config:editBot.config, isPublic:editBot.isPublic==='true' })
      });
      const saved = await r.json();
      const parsed = { ...saved, config: typeof saved.config==='string'?JSON.parse(saved.config):saved.config };
      setBots(prev => prev.map(b => b.id === parsed.id ? parsed : b));
      setEditBot(parsed);
    } catch {} finally { setSaving(false); }
  };

  /* Удалить бота */
  const deleteBot = async (id: string) => {
    if (!confirm('Удалить этого бота?')) return;
    const tok = getSessionToken();
    await fetch(`${apiBase}/api/bots/${id}`, { method:'DELETE', headers:{'x-session-token':tok} });
    setBots(prev => prev.filter(b => b.id !== id));
    if (editBot?.id === id) setEditBot(null);
  };

  /* Обновить config */
  const setConfig = (cfg: BotConfig) => {
    if (!editBot) return;
    setEditBot({ ...editBot, config: cfg });
  };

  /* Обновить экран */
  const updateScreen = (screen: BotScreen) => {
    if (!editBot) return;
    setConfig({ ...editBot.config, screens: { ...editBot.config.screens, [screen.id]: screen } });
  };

  /* Удалить экран */
  const deleteScreen = (id: string) => {
    if (!editBot) return;
    const screens = { ...editBot.config.screens };
    delete screens[id];
    /* Убрать ссылки на удалённый экран */
    Object.values(screens).forEach(sc => {
      sc.buttons = sc.buttons.map(b => b.nextScreen === id ? { ...b, nextScreen: '' } : b);
    });
    const startScreen = editBot.config.startScreen === id ? (Object.keys(screens)[0] || '') : editBot.config.startScreen;
    setConfig({ screens, startScreen });
    setSelectedScreenId(null);
  };

  const selectedScreen = editBot && selectedScreenId ? editBot.config.screens[selectedScreenId] : null;

  /* ── Режим чата ─── */
  if (chatBot) return <BotChat bot={chatBot} onClose={() => setChatBot(null)} />;

  /* ── Редактор ─── */
  if (editBot) return (
    <div style={{ position:'fixed',inset:0,background:C.deep,display:'flex',flexDirection:'column',zIndex:900,fontFamily:'inherit' }}>
      {/* Шапка редактора */}
      <div style={{ background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'10px 12px',display:'flex',alignItems:'center',gap:8,flexShrink:0 }}>
        <motion.button whileTap={{scale:0.88}} onClick={()=>setEditBot(null)}
          style={{ width:34,height:34,borderRadius:10,background:C.cardAlt,border:`1px solid ${C.border}`,color:C.mid,fontSize:18,cursor:'pointer',flexShrink:0 }}>←</motion.button>
        <div style={{ flex:1,minWidth:0 }}>
          <input value={editBot.name} onChange={e=>setEditBot({...editBot,name:e.target.value})}
            style={{ background:'none',border:'none',color:C.light,fontSize:15,fontWeight:800,outline:'none',fontFamily:'inherit',width:'100%' }}/>
        </div>
        <motion.button whileTap={{scale:0.93}} onClick={()=>setChatBot(editBot)}
          style={{ padding:'7px 12px',borderRadius:9,background:GREEN+'22',border:`1px solid ${GREEN}44`,color:GREEN,fontWeight:700,fontSize:12,cursor:'pointer' }}>
          ▶ Тест
        </motion.button>
        <motion.button whileTap={{scale:0.93}} onClick={saveBot} disabled={saving}
          style={{ padding:'7px 16px',borderRadius:9,background:AC,border:'none',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer' }}>
          {saving?'…':'💾 Сохранить'}
        </motion.button>
        <motion.button whileTap={{scale:0.88}} onClick={()=>setShowHelp(true)}
          style={{ width:30,height:30,borderRadius:8,background:AC+'22',border:`1px solid ${AC}44`,color:AC,fontSize:13,fontWeight:900,cursor:'pointer',flexShrink:0 }}>?</motion.button>
        <button onClick={()=>deleteBot(editBot.id)}
          style={{ width:30,height:30,borderRadius:8,background:RED+'18',border:`1px solid ${RED}33`,color:RED,fontSize:14,cursor:'pointer',flexShrink:0 }}>🗑</button>
      </div>

      {/* Инструкция */}
      <AnimatePresence>
        {showHelp && <HelpModal onClose={()=>setShowHelp(false)}/>}
      </AnimatePresence>

      {/* Рабочая область */}
      <div style={{ flex:1,display:'flex',overflow:'hidden' }}>
        {/* Канвас */}
        <div style={{ flex:1,overflow:'hidden',display:'flex' }} onClick={e=>{if(e.currentTarget===e.target)setSelectedScreenId(null);}}>
          <FlowCanvas
            config={editBot.config}
            onConfigChange={setConfig}
            selectedId={selectedScreenId}
            onSelect={setSelectedScreenId}
            apiBase={apiBase}
          />
        </div>

        {/* Боковая панель */}
        <div style={{ width:280,flexShrink:0,background:C.surface,borderLeft:`1px solid ${C.border}`,display:'flex',flexDirection:'column',overflow:'hidden' }}>
          {/* Вкладки */}
          <div style={{ display:'flex',borderBottom:`1px solid ${C.border}`,flexShrink:0 }}>
            {([['screen','📋 Экран'],['settings','⚙️ Бот']] as const).map(([t,label])=>(
              <button key={t} onClick={()=>setSideTab(t)}
                style={{ flex:1,padding:'10px 0',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',
                  fontSize:11,fontWeight:700,color:sideTab===t?AC:C.sub,borderBottom:`2px solid ${sideTab===t?AC:'transparent'}`,transition:'all 0.15s' }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ flex:1,overflowY:'auto',padding:'12px' }}>
            {sideTab==='screen' && (
              selectedScreen
                ? <ScreenEditor
                    screen={selectedScreen}
                    screens={editBot.config.screens}
                    onUpdate={updateScreen}
                    onDelete={()=>deleteScreen(selectedScreen.id)}
                    onSetStart={()=>setConfig({...editBot.config,startScreen:selectedScreen.id})}
                    isStart={editBot.config.startScreen===selectedScreen.id}
                    apiBase={apiBase}
                  />
                : <div style={{ textAlign:'center',padding:'30px 0',color:C.sub,fontSize:13 }}>
                    <div style={{fontSize:28,marginBottom:8}}>👆</div>
                    <div>Выберите экран на канвасе</div>
                    <div style={{fontSize:11,marginTop:4}}>или нажмите «+ Экран»</div>
                  </div>
            )}

            {sideTab==='settings' && (
              <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                <div>
                  <div style={{ fontSize:10,fontWeight:700,color:C.sub,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em' }}>Описание</div>
                  <textarea value={editBot.description||''} onChange={e=>setEditBot({...editBot,description:e.target.value})} rows={3}
                    style={{ width:'100%',boxSizing:'border-box',padding:'9px 12px',background:C.cardAlt,border:`1px solid ${C.borderB}`,borderRadius:9,color:C.light,fontSize:13,outline:'none',fontFamily:'inherit',resize:'vertical' }}
                    placeholder="Что умеет этот бот?"/>
                </div>
                <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:C.cardAlt,border:`1px solid ${C.border}`,borderRadius:10 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12,fontWeight:700,color:C.light }}>Публичный бот</div>
                    <div style={{ fontSize:10,color:C.sub }}>Виден в каталоге SWAIP Ботов</div>
                  </div>
                  <div onClick={()=>setEditBot({...editBot,isPublic:editBot.isPublic==='true'?'false':'true'})}
                    style={{ width:40,height:22,borderRadius:12,background:editBot.isPublic==='true'?GREEN:C.border,cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0 }}>
                    <div style={{ position:'absolute',top:2,left:editBot.isPublic==='true'?20:2,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left 0.2s' }}/>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize:10,fontWeight:700,color:C.sub,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em' }}>Ссылка на бота</div>
                  <div style={{ padding:'9px 12px',background:C.cardAlt,border:`1px solid ${C.border}`,borderRadius:9,fontSize:11,color:C.mid,wordBreak:'break-all' }}>
                    swaip://bot/{editBot.id}
                  </div>
                </div>
                <div style={{ padding:'10px 12px',background:GREEN+'12',border:`1px solid ${GREEN}22`,borderRadius:10,fontSize:11,color:GREEN }}>
                  📊 Запущен {editBot.startCount||0} раз
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  /* ── Список ботов ─── */
  return (
    <div style={{ position:'fixed',inset:0,background:C.deep,display:'flex',flexDirection:'column',zIndex:900,fontFamily:'inherit' }}>
      <div style={{ background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'12px 16px',display:'flex',alignItems:'center',gap:10,flexShrink:0 }}>
        <motion.button whileTap={{scale:0.88}} onClick={onClose}
          style={{ width:34,height:34,borderRadius:10,background:C.cardAlt,border:`1px solid ${C.border}`,color:C.mid,fontSize:18,cursor:'pointer',flexShrink:0 }}>←</motion.button>
        <div style={{ fontSize:16,fontWeight:800,color:C.light,flex:1 }}>🤖 Мои боты</div>
        <motion.button whileTap={{scale:0.88}} onClick={()=>setShowHelp(true)}
          style={{ width:34,height:34,borderRadius:10,background:AC+'22',border:`1px solid ${AC}44`,color:AC,fontSize:15,fontWeight:900,cursor:'pointer',flexShrink:0 }}>?</motion.button>
      </div>
      <div style={{ flex:1,overflowY:'auto',padding:'0 12px 24px' }}>
        <BotList
          bots={bots}
          loading={botsLoading}
          onOpen={openEdit}
          onCreate={createBot}
          onChat={setChatBot}
        />
      </div>
      <AnimatePresence>
        {showHelp && <HelpModal onClose={()=>setShowHelp(false)}/>}
      </AnimatePresence>
    </div>
  );
}
