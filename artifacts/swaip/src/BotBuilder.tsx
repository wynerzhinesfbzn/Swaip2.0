import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SwaipVideoPlayer, { SkinSelector, type VideoSkin } from './SwaipVideoPlayer';

/* ═══════════════════════════════════════════════════════════
   ТИПЫ
═══════════════════════════════════════════════════════════ */
export interface BotButton {
  id: string;
  label: string;
  nextScreen: string;
}
export type ScreenType = 'text' | 'image' | 'video';
export interface BotScreen {
  id: string;
  name: string;
  text: string;
  imageUrl: string;
  videoUrl: string;
  videoSkin: VideoSkin;
  type: ScreenType;
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
const ORANGE = '#F59E0B';

function uid() { return Math.random().toString(36).slice(2,10); }
function getSessionToken() { return localStorage.getItem('swaip_session_token') || ''; }

function makeScreen(overrides: Partial<BotScreen> = {}): BotScreen {
  return { id: uid(), name: 'Новый экран', text: '', imageUrl: '', videoUrl: '', videoSkin: 'swaip', type: 'text', buttons: [], x: 0, y: 0, ...overrides };
}

function getYouTubeId(url: string) {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/* ═══════════════════════════════════════════════════════════
   БОТ-ЧАТ — предпросмотр
═══════════════════════════════════════════════════════════ */
export function BotChat({ bot, onClose }: { bot: SwBot; onClose: () => void }) {
  const cfg = bot.config || { startScreen: '', screens: {} };
  const [screenId, setScreenId] = useState(cfg.startScreen || Object.keys(cfg.screens)[0] || '');
  const [history, setHistory] = useState<string[]>([]);
  const [counted, setCounted] = useState(false);

  const screen = cfg.screens[screenId];

  const go = (nextId: string) => {
    if (!nextId || !cfg.screens[nextId]) return;
    setHistory(h => [...h, screenId]);
    setScreenId(nextId);
    if (!counted) {
      setCounted(true);
      fetch(`${window.location.origin}/api/bots/${bot.id}/start`, { method: 'POST' }).catch(() => {});
    }
  };

  const goBack = () => {
    const prev = history[history.length - 1];
    if (prev) { setHistory(h => h.slice(0,-1)); setScreenId(prev); }
  };

  if (!screen) return (
    <div style={{ position:'fixed',inset:0,background:C.deep,display:'flex',alignItems:'center',justifyContent:'center',zIndex:1100,flexDirection:'column',gap:16 }}>
      <div style={{fontSize:48}}>🤖</div>
      <div style={{color:C.mid,fontSize:14}}>Нет экранов. Добавьте хотя бы один.</div>
      <button onClick={onClose} style={{padding:'10px 28px',background:AC,border:'none',borderRadius:12,color:'#fff',fontWeight:700,cursor:'pointer',fontSize:14}}>← Назад</button>
    </div>
  );

  const ytId = screen.type==='video' ? getYouTubeId(screen.videoUrl||'') : null;

  return (
    <div style={{position:'fixed',inset:0,background:C.deep,display:'flex',flexDirection:'column',zIndex:1100,fontFamily:'inherit'}}>
      {/* Шапка */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'12px 16px',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
        {history.length > 0
          ? <motion.button whileTap={{scale:0.88}} onClick={goBack}
              style={{width:36,height:36,borderRadius:10,background:C.cardAlt,border:`1px solid ${C.border}`,color:C.mid,fontSize:18,cursor:'pointer',flexShrink:0}}>←</motion.button>
          : <motion.button whileTap={{scale:0.88}} onClick={onClose}
              style={{width:36,height:36,borderRadius:10,background:C.cardAlt,border:`1px solid ${C.border}`,color:C.mid,fontSize:18,cursor:'pointer',flexShrink:0}}>✕</motion.button>}
        <div style={{flex:1}}>
          <div style={{fontSize:15,fontWeight:800,color:C.light}}>{bot.name}</div>
          <div style={{fontSize:11,color:C.sub}}>🤖 SWAIP Бот · {screen.name}</div>
        </div>
        <div style={{fontSize:10,color:C.sub,background:C.cardAlt,border:`1px solid ${C.border}`,borderRadius:8,padding:'4px 8px'}}>
          {Object.keys(cfg.screens).indexOf(screenId)+1}/{Object.keys(cfg.screens).length}
        </div>
      </div>

      {/* Контент */}
      <AnimatePresence mode="wait">
        <motion.div key={screenId} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}} transition={{duration:0.2}}
          style={{flex:1,overflowY:'auto',padding:'20px 16px',display:'flex',flexDirection:'column',gap:14}}>

          {/* Сообщение бота */}
          <div style={{display:'flex',gap:10,alignItems:'flex-start'}}>
            <div style={{width:40,height:40,borderRadius:'50%',background:AC+'33',border:`2px solid ${AC}66`,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,overflow:'hidden'}}>
              {bot.avatarUrl ? <img src={bot.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : '🤖'}
            </div>
            <div style={{maxWidth:'85%',flex:1}}>
              {/* Видео */}
              {screen.type==='video' && screen.videoUrl && (
                <div style={{marginBottom:10}}>
                  {ytId
                    ? <div style={{borderRadius:14,overflow:'hidden',background:'#000'}}>
                        <iframe src={`https://www.youtube.com/embed/${ytId}`} style={{width:'100%',height:200,border:'none',display:'block'}} allowFullScreen title="video"/>
                      </div>
                    : <SwaipVideoPlayer src={screen.videoUrl} skin={screen.videoSkin||'swaip'} title={screen.name}/>}
                </div>
              )}
              {/* Фото */}
              {screen.type==='image' && screen.imageUrl && (
                <div style={{borderRadius:14,overflow:'hidden',marginBottom:10}}>
                  <img src={screen.imageUrl} alt="" style={{width:'100%',display:'block',maxHeight:240,objectFit:'cover'}}/>
                </div>
              )}
              {/* Текст */}
              {screen.text && (
                <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:'4px 16px 16px 16px',padding:'12px 14px'}}>
                  <div style={{fontSize:14,color:C.light,lineHeight:1.65,whiteSpace:'pre-wrap'}}>{screen.text}</div>
                </div>
              )}
            </div>
          </div>

          {/* Кнопки ответа */}
          {screen.buttons.length > 0 && (
            <div style={{display:'flex',flexDirection:'column',gap:8,paddingLeft:50}}>
              {screen.buttons.map(btn => (
                <motion.button key={btn.id} whileTap={{scale:0.96}}
                  onClick={() => go(btn.nextScreen)}
                  disabled={!btn.nextScreen || !cfg.screens[btn.nextScreen]}
                  style={{padding:'12px 18px',borderRadius:12,
                    background:btn.nextScreen?AC:'rgba(124,111,255,0.1)',
                    border:`1.5px solid ${btn.nextScreen?AC:C.border}`,
                    color:btn.nextScreen?'#fff':C.sub,fontWeight:700,fontSize:14,
                    cursor:btn.nextScreen?'pointer':'not-allowed',textAlign:'left',
                    fontFamily:'inherit',transition:'all 0.15s'}}>
                  {btn.label || '—'}
                  {!btn.nextScreen && <span style={{fontSize:11,opacity:0.5,marginLeft:6}}>(не подключена)</span>}
                </motion.button>
              ))}
            </div>
          )}

          {screen.buttons.length === 0 && (
            <div style={{textAlign:'center',padding:'20px 0',color:C.sub,fontSize:13}}>
              <div style={{fontSize:24,marginBottom:6}}>🏁</div>
              <div>Конец сценария</div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ВЫБОР СЛЕДУЮЩЕГО ЭКРАНА (модалка)
═══════════════════════════════════════════════════════════ */
function ConnectPicker({
  screens, currentId, value, onPick, onClose
}: {
  screens: Record<string, BotScreen>;
  currentId: string;
  value: string;
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const list = Object.values(screens).filter(s => s.id !== currentId);
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(6px)',zIndex:1200,display:'flex',flexDirection:'column'}}
      onClick={onClose}>
      <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',stiffness:380,damping:34}}
        style={{marginTop:'auto',background:C.surface,borderRadius:'20px 20px 0 0',border:`1px solid ${C.border}`,borderBottom:'none',maxHeight:'70dvh',display:'flex',flexDirection:'column'}}
        onClick={e=>e.stopPropagation()}>
        <div style={{padding:'16px 16px 10px',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
          <div style={{flex:1,fontSize:15,fontWeight:800,color:C.light}}>↪ Куда ведёт эта кнопка?</div>
          <button onClick={onClose} style={{width:30,height:30,borderRadius:'50%',background:C.cardAlt,border:`1px solid ${C.border}`,color:C.mid,fontSize:16,cursor:'pointer'}}>✕</button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'0 12px 24px',display:'flex',flexDirection:'column',gap:8}}>
          {/* Убрать связь */}
          <motion.button whileTap={{scale:0.97}} onClick={()=>{onPick('');onClose();}}
            style={{padding:'12px 14px',borderRadius:12,background:value===''?RED+'22':C.cardAlt,border:`1.5px solid ${value===''?RED:C.border}`,color:value===''?RED:C.mid,fontWeight:700,fontSize:13,cursor:'pointer',textAlign:'left',fontFamily:'inherit'}}>
            🚫 Никуда — кнопка без действия
          </motion.button>
          {list.length === 0 && (
            <div style={{textAlign:'center',padding:'20px 0',color:C.sub,fontSize:13}}>
              Нет других экранов. Создайте новый экран.
            </div>
          )}
          {list.map(sc => {
            const active = value === sc.id;
            const icon = sc.type==='video'?'🎥':sc.type==='image'?'📷':'📋';
            return (
              <motion.button key={sc.id} whileTap={{scale:0.97}} onClick={()=>{onPick(sc.id);onClose();}}
                style={{padding:'12px 14px',borderRadius:12,background:active?AC+'22':C.card,border:`1.5px solid ${active?AC:C.border}`,color:active?AC:C.light,fontWeight:active?800:600,fontSize:13,cursor:'pointer',textAlign:'left',fontFamily:'inherit',display:'flex',alignItems:'center',gap:10}}>
                <div style={{fontSize:22,flexShrink:0}}>{icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:800,marginBottom:2}}>{sc.name||'Без названия'}</div>
                  <div style={{fontSize:11,color:C.sub,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{sc.text||'—'}</div>
                </div>
                {active && <div style={{fontSize:16,color:AC}}>✓</div>}
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   РЕДАКТОР ОДНОГО ЭКРАНА (правая панель)
═══════════════════════════════════════════════════════════ */
function ScreenEditor({
  screen, screens, isStart, onUpdate, onDelete, onSetStart, onAddScreen, apiBase
}: {
  screen: BotScreen;
  screens: Record<string, BotScreen>;
  isStart: boolean;
  onUpdate: (s: BotScreen) => void;
  onDelete: () => void;
  onSetStart: () => void;
  onAddScreen: () => void;
  apiBase: string;
}) {
  const set = (patch: Partial<BotScreen>) => onUpdate({ ...screen, ...patch });
  const fileRef = useRef<HTMLInputElement>(null);
  const videoFileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [connectingBtnId, setConnectingBtnId] = useState<string|null>(null);

  const addBtn = () => set({ buttons: [...screen.buttons, { id: uid(), label: 'Кнопка', nextScreen: '' }] });
  const delBtn = (id: string) => set({ buttons: screen.buttons.filter(b => b.id !== id) });
  const setBtn = (id: string, patch: Partial<BotButton>) =>
    set({ buttons: screen.buttons.map(b => b.id === id ? { ...b, ...patch } : b) });

  const uploadImg = async (file: File) => {
    setUploading(true);
    try {
      const tok = getSessionToken();
      const fd = new FormData(); fd.append('image', file);
      const r = await fetch(`${apiBase}/api/image-upload`, { method:'POST', headers:{'x-session-token':tok}, body:fd });
      const d = await r.json();
      if (d.url) set({ imageUrl: d.url, type:'image' });
    } catch {} finally { setUploading(false); }
  };

  const uploadVideo = async (file: File) => {
    setUploadingVideo(true);
    try {
      const tok = getSessionToken();
      const r = await fetch(`${apiBase}/api/video-upload`, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'video/mp4', 'x-session-token': tok, 'x-filename': file.name },
        body: file,
      });
      const d = await r.json();
      if (d.url) set({ videoUrl: d.url, type: 'video' });
    } catch {} finally { setUploadingVideo(false); }
  };

  const inp = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    width:'100%', boxSizing:'border-box', padding:'9px 12px',
    background:C.cardAlt, border:`1px solid ${C.borderB}`,
    borderRadius:9, color:C.light, fontSize:13, outline:'none', fontFamily:'inherit', ...extra
  });

  const TYPE_OPTS: { type: ScreenType; icon: string; label: string }[] = [
    { type:'text',  icon:'📝', label:'Текст' },
    { type:'image', icon:'📷', label:'Фото' },
    { type:'video', icon:'🎥', label:'Видео' },
  ];

  const connectingBtn = connectingBtnId ? screen.buttons.find(b=>b.id===connectingBtnId) : null;

  return (
    <div style={{flex:1,overflowY:'auto',padding:'14px',display:'flex',flexDirection:'column',gap:14}}>

      {/* Название экрана */}
      <div>
        <div style={{fontSize:10,fontWeight:700,color:C.sub,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>Название экрана</div>
        <input value={screen.name} onChange={e=>set({name:e.target.value})} style={inp()} placeholder="Например: Главное меню"/>
      </div>

      {/* Тип контента */}
      <div>
        <div style={{fontSize:10,fontWeight:700,color:C.sub,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em'}}>Тип контента</div>
        <div style={{display:'flex',gap:6}}>
          {TYPE_OPTS.map(o=>(
            <button key={o.type} onClick={()=>set({type:o.type})}
              style={{flex:1,padding:'9px 4px',borderRadius:9,background:screen.type===o.type?AC:C.cardAlt,
                border:`1.5px solid ${screen.type===o.type?AC:C.border}`,
                color:screen.type===o.type?'#fff':C.mid,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
              {o.icon}<br/>{o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Текст сообщения */}
      <div>
        <div style={{fontSize:10,fontWeight:700,color:C.sub,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>Текст сообщения</div>
        <textarea value={screen.text} onChange={e=>set({text:e.target.value})} rows={screen.type==='text'?5:3}
          style={{...inp(),resize:'vertical',lineHeight:1.6}} placeholder="Привет! Я бот. Выберите действие:"/>
      </div>

      {/* Фото */}
      {screen.type==='image' && (
        <div>
          <div style={{fontSize:10,fontWeight:700,color:C.sub,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em'}}>Фотография</div>
          {screen.imageUrl && (
            <div style={{position:'relative',borderRadius:10,overflow:'hidden',marginBottom:8}}>
              <img src={screen.imageUrl} alt="" style={{width:'100%',maxHeight:160,objectFit:'cover',display:'block'}}/>
              <button onClick={()=>set({imageUrl:''})}
                style={{position:'absolute',top:6,right:6,width:28,height:28,borderRadius:'50%',background:'rgba(0,0,0,0.7)',border:'none',color:'#fff',fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files?.[0]&&uploadImg(e.target.files[0])}/>
          <motion.button whileTap={{scale:0.95}} onClick={()=>fileRef.current?.click()} disabled={uploading}
            style={{width:'100%',padding:'10px',borderRadius:9,background:C.cardAlt,border:`1px dashed ${C.border}`,color:C.mid,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
            {uploading?'⏳ Загрузка...':'📷 Загрузить фото'}
          </motion.button>
        </div>
      )}

      {/* Видео */}
      {screen.type==='video' && (
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          <div style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:'uppercase',letterSpacing:'0.06em'}}>Видео</div>

          {/* URL ввод */}
          <input value={screen.videoUrl||''} onChange={e=>set({videoUrl:e.target.value})}
            style={inp()} placeholder="YouTube ссылка или URL видео"/>

          {/* Загрузка файла */}
          <input ref={videoFileRef} type="file" accept="video/*" style={{display:'none'}}
            onChange={e=>e.target.files?.[0]&&uploadVideo(e.target.files[0])}/>
          <motion.button whileTap={{scale:0.95}} onClick={()=>videoFileRef.current?.click()} disabled={uploadingVideo}
            style={{width:'100%',padding:'10px',borderRadius:9,background:C.cardAlt,border:`1px dashed ${C.border}`,color:C.mid,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
            {uploadingVideo?'⏳ Загрузка видео...':'🎬 Загрузить видео-файл (mp4, webm)'}
          </motion.button>

          {/* Статус */}
          {screen.videoUrl && getYouTubeId(screen.videoUrl) && (
            <div style={{borderRadius:10,overflow:'hidden',background:'#000'}}>
              <img src={`https://img.youtube.com/vi/${getYouTubeId(screen.videoUrl)}/hqdefault.jpg`}
                alt="" style={{width:'100%',maxHeight:130,objectFit:'cover',display:'block'}}/>
              <div style={{padding:'6px 10px',fontSize:11,color:GREEN}}>✓ YouTube видео распознано</div>
            </div>
          )}
          {screen.videoUrl && !getYouTubeId(screen.videoUrl) && (
            <div style={{fontSize:11,color:GREEN}}>✓ Видео-файл загружен</div>
          )}

          {/* Выбор скина */}
          {screen.videoUrl && !getYouTubeId(screen.videoUrl) && (
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.sub,marginBottom:8,textTransform:'uppercase',letterSpacing:'0.06em'}}>Скин плеера</div>
              <SkinSelector
                skin={screen.videoSkin||'swaip'}
                onChange={s=>set({videoSkin:s})}
              />
            </div>
          )}

          {/* Превью плеера */}
          {screen.videoUrl && !getYouTubeId(screen.videoUrl) && (
            <SwaipVideoPlayer src={screen.videoUrl} skin={screen.videoSkin||'swaip'} title={screen.name}/>
          )}
        </div>
      )}

      {/* Кнопки */}
      <div>
        <div style={{fontSize:10,fontWeight:700,color:C.sub,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.06em'}}>
          Кнопки ({screen.buttons.length}) — нажав на кнопку, пользователь перейдёт на другой экран
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {screen.buttons.map((btn, i) => {
            const target = btn.nextScreen ? screens[btn.nextScreen] : null;
            const tIcon = target?.type==='video'?'🎥':target?.type==='image'?'📷':'📋';
            return (
              <div key={btn.id} style={{background:C.cardAlt,border:`1.5px solid ${btn.nextScreen?AC+'55':C.border}`,borderRadius:12,overflow:'hidden'}}>
                {/* Поле названия кнопки */}
                <div style={{display:'flex',gap:6,padding:'10px 10px 6px'}}>
                  <div style={{fontSize:14,color:C.sub,paddingTop:6,flexShrink:0}}>{i+1}.</div>
                  <input value={btn.label} onChange={e=>setBtn(btn.id,{label:e.target.value})}
                    style={{...inp({flex:1}),padding:'7px 10px'}} placeholder={`Текст кнопки ${i+1}`}/>
                  <button onClick={()=>delBtn(btn.id)}
                    style={{width:32,height:32,borderRadius:8,background:RED+'18',border:`1px solid ${RED}33`,color:RED,fontSize:16,cursor:'pointer',flexShrink:0,alignSelf:'flex-start',marginTop:2}}>✕</button>
                </div>
                {/* Куда ведёт */}
                <motion.button whileTap={{scale:0.98}} onClick={()=>setConnectingBtnId(btn.id)}
                  style={{width:'100%',padding:'8px 12px',background:'none',border:'none',borderTop:`1px solid ${C.border}`,
                    display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontFamily:'inherit',textAlign:'left'}}>
                  <div style={{width:28,height:28,borderRadius:8,background:target?AC+'22':C.card,border:`1.5px solid ${target?AC:C.border}`,
                    display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>
                    {target ? '↪' : '↪'}
                  </div>
                  <div style={{flex:1,minWidth:0}}>
                    {target ? (
                      <span style={{fontSize:12,color:AC,fontWeight:700}}>{tIcon} → {target.name||'Без названия'}</span>
                    ) : (
                      <span style={{fontSize:12,color:C.sub}}>Нажмите, чтобы выбрать экран</span>
                    )}
                  </div>
                  <div style={{fontSize:11,color:C.sub}}>✎</div>
                </motion.button>
              </div>
            );
          })}
          <motion.button whileTap={{scale:0.96}} onClick={addBtn}
            style={{padding:'10px',borderRadius:10,background:AC+'14',border:`1.5px dashed ${AC}55`,color:AC,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
            + Добавить кнопку
          </motion.button>
        </div>
      </div>

      {/* Если нет кнопок — предложить добавить или создать экран */}
      {screen.buttons.length === 0 && (
        <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:'12px',fontSize:12,color:C.sub,lineHeight:1.6}}>
          💡 Без кнопок этот экран завершает диалог. Добавьте кнопки, чтобы пользователь мог выбрать действие.
        </div>
      )}

      {/* Быстрое создание следующего экрана */}
      <motion.button whileTap={{scale:0.97}} onClick={onAddScreen}
        style={{padding:'10px',borderRadius:10,background:GREEN+'14',border:`1.5px dashed ${GREEN}55`,color:GREEN,fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
        + Создать следующий экран
      </motion.button>

      {/* Действия */}
      <div style={{display:'flex',gap:8,marginTop:4,paddingBottom:8}}>
        {!isStart ? (
          <button onClick={onSetStart}
            style={{flex:1,padding:'9px',borderRadius:9,background:GREEN+'16',border:`1px solid ${GREEN}44`,color:GREEN,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
            ⭐ Сделать стартовым
          </button>
        ) : (
          <div style={{flex:1,padding:'9px',borderRadius:9,background:GREEN+'10',color:GREEN,fontSize:11,fontWeight:700,textAlign:'center'}}>⭐ Стартовый экран</div>
        )}
        <button onClick={onDelete}
          style={{padding:'9px 14px',borderRadius:9,background:RED+'16',border:`1px solid ${RED}44`,color:RED,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
          🗑 Удалить
        </button>
      </div>

      {/* ConnectPicker */}
      <AnimatePresence>
        {connectingBtnId && connectingBtn && (
          <ConnectPicker
            screens={screens}
            currentId={screen.id}
            value={connectingBtn.nextScreen}
            onPick={id=>setBtn(connectingBtnId,{nextScreen:id})}
            onClose={()=>setConnectingBtnId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   КАРТОЧКА ЭКРАНА В ЛЕВОМ СПИСКЕ
═══════════════════════════════════════════════════════════ */
function ScreenCard({
  screen, isSelected, isStart, screens, onClick
}: {
  screen: BotScreen; isSelected: boolean; isStart: boolean;
  screens: Record<string, BotScreen>; onClick: () => void;
}) {
  const icon = screen.type==='video'?'🎥':screen.type==='image'?'📷':'📝';
  return (
    <motion.div whileTap={{scale:0.98}} onClick={onClick}
      style={{background:isSelected?AC+'18':C.card,border:`1.5px solid ${isSelected?AC:isStart?GREEN:C.border}`,
        borderRadius:12,padding:'10px 12px',cursor:'pointer',userSelect:'none',transition:'all 0.15s',position:'relative'}}>
      {isStart && <div style={{position:'absolute',top:-8,left:8,fontSize:9,fontWeight:800,color:GREEN,background:C.deep,padding:'1px 7px',borderRadius:8,border:`1px solid ${GREEN}44`}}>СТАРТ</div>}
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
        <span style={{fontSize:14}}>{icon}</span>
        <span style={{fontSize:12,fontWeight:800,color:isSelected?AC:C.light,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{screen.name||'Без названия'}</span>
      </div>
      {screen.type==='image' && screen.imageUrl && (
        <div style={{width:'100%',height:50,borderRadius:6,overflow:'hidden',marginBottom:4}}>
          <img src={screen.imageUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
        </div>
      )}
      {screen.type==='video' && screen.videoUrl && (
        <div style={{fontSize:10,color:ORANGE,marginBottom:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          🎥 {screen.videoUrl}
        </div>
      )}
      {screen.text && (
        <div style={{fontSize:10,color:C.mid,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',lineHeight:1.4,marginBottom:4}}>
          {screen.text}
        </div>
      )}
      {screen.buttons.length > 0 && (
        <div style={{display:'flex',flexDirection:'column',gap:3}}>
          {screen.buttons.slice(0,3).map(btn=>{
            const target = btn.nextScreen ? screens[btn.nextScreen] : null;
            return (
              <div key={btn.id} style={{display:'flex',alignItems:'center',gap:4}}>
                <div style={{fontSize:9,padding:'2px 7px',borderRadius:6,background:btn.nextScreen?AC+'28':C.cardAlt,border:`1px solid ${btn.nextScreen?AC+'44':C.border}`,color:btn.nextScreen?AC:C.sub,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {btn.label||'Кнопка'}
                </div>
                {target && <div style={{fontSize:9,color:GREEN,flexShrink:0}}>→ {target.name}</div>}
                {!btn.nextScreen && <div style={{fontSize:9,color:C.sub,flexShrink:0}}>—</div>}
              </div>
            );
          })}
          {screen.buttons.length > 3 && <div style={{fontSize:9,color:C.sub}}>+{screen.buttons.length-3} ещё</div>}
        </div>
      )}
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ИНСТРУКЦИЯ
═══════════════════════════════════════════════════════════ */
const HELP_STEPS = [
  { icon:'🤖', title:'Что такое SWAIP-бот?',
    text:'Это интерактивный бот без кода. Он состоит из экранов — каждый экран показывает сообщение (текст, фото или видео) и кнопки. Пользователь нажимает кнопку — переходит на следующий экран.' },
  { icon:'📋', title:'Добавить экран',
    text:'Нажмите «+ Добавить экран» в левой колонке. Каждый экран — это один «шаг» диалога. Дайте ему понятное название: например «Главное меню», «О нас», «Контакты».' },
  { icon:'📝', title:'Тип контента',
    text:'Каждый экран может быть: 📝 Текст (обычное сообщение), 📷 Фото (картинка + текст), 🎥 Видео (YouTube или прямая ссылка + текст). Выберите тип вверху редактора.' },
  { icon:'🔘', title:'Добавить кнопки',
    text:'Нажмите «+ Добавить кнопку». Введите текст кнопки — это то, что увидит пользователь. Затем нажмите строку «Нажмите, чтобы выбрать экран» — откроется список всех экранов.' },
  { icon:'↪', title:'Соединить кнопку с экраном',
    text:'После нажатия на строку соединения — выберите экран из списка. Кнопка будет отмечена «↪ → Название экрана». Так и строится весь сценарий.' },
  { icon:'⭐', title:'Стартовый экран',
    text:'Первый экран, с которого начинается бот. Нажмите «⭐ Сделать стартовым» в редакторе нужного экрана. Он отображается с меткой СТАРТ в левой колонке.' },
  { icon:'▶️', title:'Тест бота',
    text:'Нажмите «▶ Тест» в шапке. Вы увидите бота глазами пользователя. Кнопки работают — можно нажимать и проверять весь сценарий.' },
  { icon:'💾', title:'Сохранить',
    text:'Нажмите «💾 Сохранить». На вкладке «⚙️ Бот» можно включить «Публичный бот» — тогда он появится в каталоге SWAIP.' },
];

function HelpModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const cur = HELP_STEPS[step];
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(8px)',zIndex:1300,display:'flex',alignItems:'center',justifyContent:'center',padding:16}}
      onClick={onClose}>
      <motion.div initial={{scale:0.88,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.88,opacity:0}}
        style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:20,width:'100%',maxWidth:360,overflow:'hidden',maxHeight:'90dvh',display:'flex',flexDirection:'column'}}
        onClick={e=>e.stopPropagation()}>
        <div style={{background:AC,padding:'16px 20px',display:'flex',alignItems:'center',gap:10}}>
          <div style={{fontSize:28}}>{cur.icon}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:900,color:'#fff'}}>{cur.title}</div>
            <div style={{fontSize:10,color:'rgba(255,255,255,0.65)',marginTop:2}}>Шаг {step+1} из {HELP_STEPS.length}</div>
          </div>
          <button onClick={onClose} style={{width:28,height:28,borderRadius:'50%',background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',fontSize:14,cursor:'pointer'}}>✕</button>
        </div>
        <div style={{display:'flex',gap:4,padding:'12px 20px 0'}}>
          {HELP_STEPS.map((_,i)=>(
            <div key={i} onClick={()=>setStep(i)} style={{flex:1,height:3,borderRadius:99,background:i<=step?AC:C.border,cursor:'pointer',transition:'background 0.2s'}}/>
          ))}
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'20px'}}>
          <AnimatePresence mode="wait">
            <motion.p key={step} initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} transition={{duration:0.18}}
              style={{fontSize:14,color:C.light,lineHeight:1.75,margin:0}}>
              {cur.text}
            </motion.p>
          </AnimatePresence>
        </div>
        <div style={{display:'flex',gap:8,padding:'12px 20px 20px'}}>
          {step > 0 && <button onClick={()=>setStep(s=>s-1)} style={{flex:1,padding:'11px',borderRadius:12,background:C.cardAlt,border:`1px solid ${C.border}`,color:C.mid,fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>← Назад</button>}
          {step < HELP_STEPS.length-1
            ? <motion.button whileTap={{scale:0.96}} onClick={()=>setStep(s=>s+1)} style={{flex:1,padding:'11px',borderRadius:12,background:AC,border:'none',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Далее →</motion.button>
            : <motion.button whileTap={{scale:0.96}} onClick={onClose} style={{flex:1,padding:'11px',borderRadius:12,background:AC,border:'none',color:'#fff',fontWeight:800,fontSize:13,cursor:'pointer',fontFamily:'inherit'}}>Понятно! 🚀</motion.button>}
        </div>
      </motion.div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   СПИСОК БОТОВ
═══════════════════════════════════════════════════════════ */
function BotListView({ bots, loading, onOpen, onCreate, onChat }: {
  bots: SwBot[]; loading: boolean; onOpen: (b:SwBot)=>void; onCreate: ()=>void; onChat: (b:SwBot)=>void;
}) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:10,padding:'12px 0'}}>
      <motion.button whileTap={{scale:0.96}} onClick={onCreate}
        style={{padding:'12px',borderRadius:12,background:AC,border:'none',color:'#fff',fontWeight:800,fontSize:14,cursor:'pointer',fontFamily:'inherit'}}>
        🤖 + Создать нового бота
      </motion.button>
      {loading && <div style={{textAlign:'center',padding:20,color:C.sub,fontSize:13}}>Загрузка...</div>}
      {!loading && bots.length===0 && (
        <div style={{textAlign:'center',padding:'36px 0',color:C.sub,fontSize:13}}>
          <div style={{fontSize:40,marginBottom:10}}>🤖</div>
          <div style={{fontWeight:700,color:C.mid,marginBottom:4}}>Ботов пока нет</div>
          <div>Создайте первого бота — без кода!</div>
        </div>
      )}
      {bots.map(bot=>{
        const screenCount = Object.keys(bot.config?.screens||{}).length;
        return (
          <div key={bot.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:14,overflow:'hidden'}}>
            <div style={{display:'flex',gap:10,padding:'12px 12px 8px',alignItems:'center'}}>
              <div style={{width:44,height:44,borderRadius:'50%',background:AC+'33',border:`2px solid ${AC}44`,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,overflow:'hidden'}}>
                {bot.avatarUrl?<img src={bot.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:'🤖'}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:14,fontWeight:800,color:C.light}}>{bot.name}</div>
                <div style={{fontSize:11,color:C.sub}}>{screenCount} экр. · {bot.startCount||0} запусков</div>
              </div>
              {bot.isPublic==='true'&&<div style={{fontSize:9,fontWeight:700,color:GREEN,background:GREEN+'18',border:`1px solid ${GREEN}33`,borderRadius:8,padding:'2px 7px'}}>Публичный</div>}
            </div>
            {bot.description&&<div style={{padding:'0 12px 8px',fontSize:11,color:C.sub}}>{bot.description}</div>}
            <div style={{display:'flex',gap:6,padding:'0 12px 10px'}}>
              <button onClick={()=>onOpen(bot)} style={{flex:1,padding:'9px',borderRadius:9,background:AC,border:'none',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>✏️ Редактировать</button>
              <button onClick={()=>onChat(bot)} style={{flex:1,padding:'9px',borderRadius:9,background:C.cardAlt,border:`1px solid ${C.border}`,color:C.mid,fontWeight:700,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>▶️ Запустить</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   ГЛАВНЫЙ КОМПОНЕНТ — BotBuilder
═══════════════════════════════════════════════════════════ */
export default function BotBuilder({ onClose, apiBase }: { onClose: () => void; apiBase: string }) {
  const [bots, setBots] = useState<SwBot[]>([]);
  const [botsLoading, setBotsLoading] = useState(true);
  const [editBot, setEditBot] = useState<SwBot | null>(null);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string|null>(null);
  const [chatBot, setChatBot] = useState<SwBot|null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [sideTab, setSideTab] = useState<'screens'|'settings'>('screens');
  /* мобильная раскладка: левая панель или редактор */
  const [mobileView, setMobileView] = useState<'list'|'editor'>('list');

  /* Загрузка ботов */
  useEffect(()=>{
    const tok = getSessionToken();
    if (!tok){setBotsLoading(false);return;}
    fetch(`${apiBase}/api/bots`,{headers:{'x-session-token':tok}})
      .then(r=>r.ok?r.json():[])
      .then(data=>{
        const list:SwBot[]=Array.isArray(data)?data:[];
        setBots(list.map(b=>({...b,config:typeof b.config==='string'?JSON.parse(b.config):b.config})));
      }).catch(()=>{}).finally(()=>setBotsLoading(false));
  },[apiBase]);

  /* Создать бота */
  const createBot = async () => {
    const tok = getSessionToken();
    const r = await fetch(`${apiBase}/api/bots`,{method:'POST',headers:{'Content-Type':'application/json','x-session-token':tok},body:JSON.stringify({name:'Новый бот'})});
    const bot = await r.json();
    const parsed={...bot,config:typeof bot.config==='string'?JSON.parse(bot.config):bot.config};
    setBots(prev=>[parsed,...prev]);
    openEdit(parsed);
  };

  /* Открыть редактор */
  const openEdit = (bot:SwBot) => {
    const cfg=typeof bot.config==='string'?JSON.parse(bot.config as unknown as string):bot.config;
    const patched:BotConfig={...cfg,screens:Object.fromEntries(Object.entries(cfg.screens).map(([k,s])=>[k,{videoUrl:'',type:'text',...(s as object)}]))};
    setEditBot({...bot,config:patched});
    const firstId=patched.startScreen||Object.keys(patched.screens)[0]||null;
    setSelectedId(firstId);
    setSideTab('screens');
    setMobileView('list');
  };

  /* Сохранить */
  const saveBot = async () => {
    if (!editBot) return;
    setSaving(true);
    try {
      const tok=getSessionToken();
      const r=await fetch(`${apiBase}/api/bots/${editBot.id}`,{
        method:'PUT',headers:{'Content-Type':'application/json','x-session-token':tok},
        body:JSON.stringify({name:editBot.name,description:editBot.description,avatarUrl:editBot.avatarUrl,config:editBot.config,isPublic:editBot.isPublic==='true'})
      });
      const saved=await r.json();
      const parsed={...saved,config:typeof saved.config==='string'?JSON.parse(saved.config):saved.config};
      setBots(prev=>prev.map(b=>b.id===parsed.id?parsed:b));
      setEditBot(parsed);
    }catch{}finally{setSaving(false);}
  };

  /* Удалить бота */
  const deleteBot = async (id:string) => {
    if (!confirm('Удалить этого бота?')) return;
    const tok=getSessionToken();
    await fetch(`${apiBase}/api/bots/${id}`,{method:'DELETE',headers:{'x-session-token':tok}});
    setBots(prev=>prev.filter(b=>b.id!==id));
    setEditBot(null);
  };

  /* Обновить config */
  const setConfig=(cfg:BotConfig)=>{ if(editBot) setEditBot({...editBot,config:cfg}); };

  /* Обновить экран */
  const updateScreen=(sc:BotScreen)=>{
    if(!editBot)return;
    setConfig({...editBot.config,screens:{...editBot.config.screens,[sc.id]:sc}});
  };

  /* Удалить экран */
  const deleteScreen=(id:string)=>{
    if(!editBot)return;
    const screens={...editBot.config.screens};
    delete screens[id];
    Object.values(screens).forEach(sc=>{
      sc.buttons=sc.buttons.map(b=>b.nextScreen===id?{...b,nextScreen:''}:b);
    });
    const startScreen=editBot.config.startScreen===id?(Object.keys(screens)[0]||''):editBot.config.startScreen;
    setConfig({startScreen,screens});
    setSelectedId(Object.keys(screens)[0]||null);
    setMobileView('list');
  };

  /* Добавить экран */
  const addScreen=()=>{
    if(!editBot)return;
    const id=uid();
    const sc:BotScreen=makeScreen({id,name:'Новый экран',x:0,y:0});
    setConfig({...editBot.config,screens:{...editBot.config.screens,[id]:sc}});
    setSelectedId(id);
    setMobileView('editor');
  };

  /* ── РЕЖИМ ЧАТА ── */
  if (chatBot) return <BotChat bot={chatBot} onClose={()=>setChatBot(null)}/>;

  /* ── РЕДАКТОР БОТА ── */
  if (editBot) {
    const screens=editBot.config.screens;
    const screenList=Object.values(screens);
    const selScreen=selectedId?screens[selectedId]:null;
    const isWide=window.innerWidth>=640;

    const leftPanel=(
      <div style={{width:isWide?260:undefined,flexShrink:0,background:C.surface,borderRight:isWide?`1px solid ${C.border}`:'none',display:'flex',flexDirection:'column',height:'100%'}}>
        {/* Вкладки */}
        <div style={{display:'flex',borderBottom:`1px solid ${C.border}`,flexShrink:0}}>
          {([['screens','📋 Экраны'],['settings','⚙️ Бот']] as const).map(([t,label])=>(
            <button key={t} onClick={()=>setSideTab(t)}
              style={{flex:1,padding:'10px 0',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',fontSize:11,fontWeight:700,color:sideTab===t?AC:C.sub,borderBottom:`2px solid ${sideTab===t?AC:'transparent'}`,transition:'all 0.15s'}}>
              {label}
            </button>
          ))}
        </div>

        {sideTab==='screens' && (
          <div style={{flex:1,overflowY:'auto',padding:'10px'}}>
            <motion.button whileTap={{scale:0.96}} onClick={addScreen}
              style={{width:'100%',padding:'9px',borderRadius:10,background:AC,border:'none',color:'#fff',fontWeight:800,fontSize:12,cursor:'pointer',fontFamily:'inherit',marginBottom:8}}>
              + Добавить экран
            </motion.button>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {screenList.length===0&&(
                <div style={{textAlign:'center',padding:'24px 0',color:C.sub,fontSize:12}}>
                  <div style={{fontSize:28,marginBottom:6}}>📋</div>
                  <div>Нажмите «+ Добавить экран»</div>
                </div>
              )}
              {screenList.map(sc=>(
                <ScreenCard key={sc.id} screen={sc} isSelected={selectedId===sc.id} isStart={editBot.config.startScreen===sc.id}
                  screens={screens}
                  onClick={()=>{setSelectedId(sc.id);if(!isWide)setMobileView('editor');}}/>
              ))}
            </div>
          </div>
        )}

        {sideTab==='settings' && (
          <div style={{flex:1,overflowY:'auto',padding:'12px',display:'flex',flexDirection:'column',gap:12}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.sub,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>Название бота</div>
              <input value={editBot.name} onChange={e=>setEditBot({...editBot,name:e.target.value})}
                style={{width:'100%',boxSizing:'border-box',padding:'9px 12px',background:C.cardAlt,border:`1px solid ${C.borderB}`,borderRadius:9,color:C.light,fontSize:13,outline:'none',fontFamily:'inherit'}}/>
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.sub,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>Описание</div>
              <textarea value={editBot.description||''} onChange={e=>setEditBot({...editBot,description:e.target.value})} rows={3}
                style={{width:'100%',boxSizing:'border-box',padding:'9px 12px',background:C.cardAlt,border:`1px solid ${C.borderB}`,borderRadius:9,color:C.light,fontSize:13,outline:'none',fontFamily:'inherit',resize:'vertical'}} placeholder="Что умеет этот бот?"/>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:C.cardAlt,border:`1px solid ${C.border}`,borderRadius:10}}>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:700,color:C.light}}>Публичный бот</div>
                <div style={{fontSize:10,color:C.sub}}>Виден в каталоге SWAIP</div>
              </div>
              <div onClick={()=>setEditBot({...editBot,isPublic:editBot.isPublic==='true'?'false':'true'})}
                style={{width:42,height:24,borderRadius:12,background:editBot.isPublic==='true'?GREEN:C.border,cursor:'pointer',position:'relative',transition:'background 0.2s',flexShrink:0}}>
                <div style={{position:'absolute',top:2,left:editBot.isPublic==='true'?20:2,width:20,height:20,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/>
              </div>
            </div>
            <div style={{padding:'9px 12px',background:GREEN+'12',border:`1px solid ${GREEN}22`,borderRadius:10,fontSize:11,color:GREEN}}>
              📊 Запущен {editBot.startCount||0} раз
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:C.sub,marginBottom:4,textTransform:'uppercase',letterSpacing:'0.06em'}}>ID бота</div>
              <div style={{padding:'9px 12px',background:C.cardAlt,border:`1px solid ${C.border}`,borderRadius:9,fontSize:11,color:C.mid,wordBreak:'break-all'}}>swaip://bot/{editBot.id}</div>
            </div>
          </div>
        )}
      </div>
    );

    const rightPanel=selScreen?(
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:C.deep}}>
        {/* Заголовок экрана */}
        <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'10px 12px',display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
          {!isWide&&(
            <button onClick={()=>setMobileView('list')} style={{width:32,height:32,borderRadius:9,background:C.cardAlt,border:`1px solid ${C.border}`,color:C.mid,fontSize:16,cursor:'pointer',flexShrink:0}}>←</button>
          )}
          <div style={{flex:1,fontSize:13,fontWeight:800,color:C.light,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {selScreen.type==='video'?'🎥':selScreen.type==='image'?'📷':'📝'} {selScreen.name||'Без названия'}
          </div>
          <div style={{fontSize:10,color:C.sub,background:C.cardAlt,border:`1px solid ${C.border}`,borderRadius:7,padding:'3px 8px',flexShrink:0}}>
            {selScreen.buttons.length} кнопок
          </div>
        </div>
        <ScreenEditor
          screen={selScreen}
          screens={screens}
          isStart={editBot.config.startScreen===selScreen.id}
          onUpdate={updateScreen}
          onDelete={()=>deleteScreen(selScreen.id)}
          onSetStart={()=>setConfig({...editBot.config,startScreen:selScreen.id})}
          onAddScreen={addScreen}
          apiBase={apiBase}
        />
      </div>
    ):(
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,color:C.sub,background:C.deep}}>
        <div style={{fontSize:40}}>👈</div>
        <div style={{fontSize:14,color:C.mid,fontWeight:700}}>Выберите экран слева</div>
        <div style={{fontSize:12}}>или создайте новый</div>
        <motion.button whileTap={{scale:0.96}} onClick={addScreen}
          style={{padding:'10px 20px',borderRadius:10,background:AC,border:'none',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer',fontFamily:'inherit',marginTop:4}}>
          + Добавить экран
        </motion.button>
      </div>
    );

    return (
      <div style={{position:'fixed',inset:0,background:C.deep,display:'flex',flexDirection:'column',zIndex:900,fontFamily:'inherit'}}>
        {/* Шапка редактора */}
        <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'8px 10px',display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
          <motion.button whileTap={{scale:0.88}} onClick={()=>setEditBot(null)}
            style={{width:32,height:32,borderRadius:9,background:C.cardAlt,border:`1px solid ${C.border}`,color:C.mid,fontSize:16,cursor:'pointer',flexShrink:0}}>←</motion.button>
          <div style={{flex:1,minWidth:0}}>
            <input value={editBot.name} onChange={e=>setEditBot({...editBot,name:e.target.value})}
              style={{background:'none',border:'none',color:C.light,fontSize:14,fontWeight:800,outline:'none',fontFamily:'inherit',width:'100%'}}/>
          </div>
          <motion.button whileTap={{scale:0.93}} onClick={()=>setChatBot(editBot)}
            style={{padding:'6px 10px',borderRadius:8,background:GREEN+'22',border:`1px solid ${GREEN}44`,color:GREEN,fontWeight:700,fontSize:11,cursor:'pointer',flexShrink:0}}>
            ▶ Тест
          </motion.button>
          <motion.button whileTap={{scale:0.93}} onClick={saveBot} disabled={saving}
            style={{padding:'6px 12px',borderRadius:8,background:AC,border:'none',color:'#fff',fontWeight:700,fontSize:11,cursor:'pointer',flexShrink:0}}>
            {saving?'…':'💾'}
          </motion.button>
          <motion.button whileTap={{scale:0.88}} onClick={()=>setShowHelp(true)}
            style={{width:30,height:30,borderRadius:8,background:AC+'22',border:`1px solid ${AC}44`,color:AC,fontSize:13,fontWeight:900,cursor:'pointer',flexShrink:0}}>?</motion.button>
          <button onClick={()=>deleteBot(editBot.id)}
            style={{width:30,height:30,borderRadius:8,background:RED+'18',border:`1px solid ${RED}33`,color:RED,fontSize:14,cursor:'pointer',flexShrink:0}}>🗑</button>
        </div>

        {/* Тело */}
        {isWide ? (
          <div style={{flex:1,display:'flex',overflow:'hidden'}}>
            {leftPanel}
            {rightPanel}
          </div>
        ) : (
          <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
            {mobileView==='list' ? leftPanel : rightPanel}
          </div>
        )}

        <AnimatePresence>
          {showHelp && <HelpModal onClose={()=>setShowHelp(false)}/>}
        </AnimatePresence>
      </div>
    );
  }

  /* ── СПИСОК БОТОВ ── */
  return (
    <div style={{position:'fixed',inset:0,background:C.deep,display:'flex',flexDirection:'column',zIndex:900,fontFamily:'inherit'}}>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'12px 16px',display:'flex',alignItems:'center',gap:10,flexShrink:0}}>
        <motion.button whileTap={{scale:0.88}} onClick={onClose}
          style={{width:34,height:34,borderRadius:10,background:C.cardAlt,border:`1px solid ${C.border}`,color:C.mid,fontSize:18,cursor:'pointer',flexShrink:0}}>←</motion.button>
        <div style={{fontSize:16,fontWeight:800,color:C.light,flex:1}}>🤖 Мои боты</div>
        <motion.button whileTap={{scale:0.88}} onClick={()=>setShowHelp(true)}
          style={{width:34,height:34,borderRadius:10,background:AC+'22',border:`1px solid ${AC}44`,color:AC,fontSize:15,fontWeight:900,cursor:'pointer',flexShrink:0}}>?</motion.button>
      </div>
      <div style={{flex:1,overflowY:'auto',padding:'0 12px 24px'}}>
        <BotListView bots={bots} loading={botsLoading} onOpen={openEdit} onCreate={createBot} onChat={setChatBot}/>
      </div>
      <AnimatePresence>
        {showHelp && <HelpModal onClose={()=>setShowHelp(false)}/>}
      </AnimatePresence>
    </div>
  );
}
