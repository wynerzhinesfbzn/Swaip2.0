import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SwaipVideoPlayer, { SkinSelector, type VideoSkin } from './SwaipVideoPlayer';

/* ════════════════════════════ ТИПЫ ════════════════════════════ */
export type BlockType = 'hero' | 'text' | 'image' | 'video' | 'buttons' | 'price' | 'divider' | 'contacts' | 'code';

export interface MiniAppButton {
  id: string;
  label: string;
  url: string;
  style: 'primary' | 'secondary' | 'outline';
}

export interface MiniAppBlock {
  id: string;
  type: BlockType;
  /* hero */
  title?: string;
  subtitle?: string;
  bgColor?: string;
  textColor?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  /* text */
  content?: string;
  align?: 'left' | 'center' | 'right';
  /* image */
  imageUrl?: string;
  caption?: string;
  fullWidth?: boolean;
  /* video */
  videoUrl?: string;
  videoSkin?: VideoSkin;
  /* buttons */
  buttons?: MiniAppButton[];
  /* price */
  priceName?: string;
  price?: string;
  currency?: string;
  period?: string;
  features?: string[];
  ctaLabel?: string;
  accentColor?: string;
  /* divider */
  divStyle?: 'line' | 'space' | 'dots';
  divSize?: 'sm' | 'md' | 'lg';
  /* code */
  htmlCode?: string;
  codeHeight?: number;
  /* contacts */
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
}

export interface MiniAppConfig {
  accentColor: string;
  darkMode: boolean;
  blocks: MiniAppBlock[];
}

export interface SwMiniApp {
  id: string;
  ownerHash: string;
  name: string;
  description: string;
  icon: string;
  config: MiniAppConfig;
  isPublic: string;
  viewCount: number;
  createdAt: string;
}

/* ════════════════════════ КОНСТАНТЫ ════════════════════════════ */
const ACCENT = '#8b5cf6';
const C = {
  bg: '#0a0a0f',
  card: '#12121a',
  cardAlt: '#1a1a26',
  border: '#2a2a3d',
  borderB: '#353550',
  light: '#f0f0ff',
  mid: '#9090b0',
  sub: '#606080',
};

const BLOCK_TYPES: { type: BlockType; icon: string; label: string; desc: string }[] = [
  { type: 'hero',     icon: '🌟', label: 'Обложка',   desc: 'Заголовок + описание + кнопка' },
  { type: 'text',     icon: '📝', label: 'Текст',     desc: 'Абзац или заметка' },
  { type: 'image',    icon: '📷', label: 'Фото',      desc: 'Изображение с подписью' },
  { type: 'video',    icon: '🎥', label: 'Видео',     desc: 'Файл или YouTube' },
  { type: 'buttons',  icon: '🔗', label: 'Кнопки',   desc: 'Ссылки и действия' },
  { type: 'price',    icon: '💎', label: 'Цена',      desc: 'Карточка с тарифом' },
  { type: 'contacts', icon: '📞', label: 'Contacts',   desc: 'Телефон, email, адрес' },
  { type: 'divider',  icon: '➖', label: 'Divider',    desc: 'Линия или отступ' },
  { type: 'code',     icon: '💻', label: 'Code',       desc: 'HTML / CSS / JavaScript' },
];

const ACCENT_COLORS = ['#8b5cf6','#6366f1','#ec4899','#f59e0b','#10b981','#0ea5e9','#ef4444','#14b8a6'];
const ICONS = ['✨','🚀','💡','🎯','🎨','🛍️','🎵','📱','💼','🌿','🔥','⚡','🏆','💎','🌟','🎪'];

/* ════════════════════════ УТИЛИТЫ ════════════════════════════ */
function uid() { return Math.random().toString(36).slice(2, 10); }
function btnUid() { return Math.random().toString(36).slice(2, 8); }
function getSessionToken() { return localStorage.getItem('swaip_session_token') || ''; }

function makeBlock(type: BlockType): MiniAppBlock {
  const id = uid();
  switch (type) {
    case 'hero':     return { id, type, title: 'Добро пожаловать!', subtitle: 'Опишите, что здесь происходит', bgColor: ACCENT, textColor: '#ffffff', buttonLabel: 'Начать', buttonUrl: '' };
    case 'text':     return { id, type, content: 'Введите текст вашего блока здесь. Расскажите о продукте, услуге или идее.', align: 'left' };
    case 'image':    return { id, type, imageUrl: '', caption: '', fullWidth: true };
    case 'video':    return { id, type, videoUrl: '', videoSkin: 'swaip' };
    case 'buttons':  return { id, type, buttons: [{ id: btnUid(), label: 'Кнопка', url: '', style: 'primary' }] };
    case 'price':    return { id, type, priceName: 'Стандарт', price: '990', currency: '₽', period: 'мес', features: ['Функция 1','Функция 2','Функция 3'], ctaLabel: 'Выбрать', accentColor: ACCENT };
    case 'contacts': return { id, type, phone: '', email: '', address: '', website: '' };
    case 'divider':  return { id, type, divStyle: 'line', divSize: 'md' };
    case 'code':     return { id, type, codeHeight: 200, htmlCode: `<!DOCTYPE html>
<html>
<head>
  <style>
    body { margin: 0; font-family: sans-serif; background: #0a0a1a; color: #fff; }
    .box { padding: 20px; text-align: center; }
    h2 { color: #8b5cf6; }
  </style>
</head>
<body>
  <div class="box">
    <h2>Hello, SWAIP Mini App! 👋</h2>
    <p>Edit this HTML/CSS/JS code</p>
  </div>
</body>
</html>` };
  }
}

/* ════════════════════════ РЕНДЕР БЛОКА ════════════════════════ */
function BlockRenderer({ block, accent, dark, compact = false }: { block: MiniAppBlock; accent: string; dark: boolean; compact?: boolean }) {
  const bg = dark ? '#0a0a0f' : '#ffffff';
  const fg = dark ? '#f0f0ff' : '#1a1a2e';
  const sub = dark ? '#9090b0' : '#606080';

  switch (block.type) {
    case 'hero': return (
      <div style={{ background: `linear-gradient(135deg, ${block.bgColor||accent} 0%, ${block.bgColor||accent}cc 100%)`, padding: compact?'24px 16px':'32px 20px', textAlign: 'center' }}>
        <div style={{ fontSize: compact?22:28, fontWeight: 800, color: block.textColor||'#fff', marginBottom: 8, lineHeight: 1.2 }}>{block.title||'Заголовок'}</div>
        {block.subtitle && <div style={{ fontSize: compact?13:15, color: (block.textColor||'#fff')+'cc', marginBottom: block.buttonLabel?16:0, lineHeight: 1.5 }}>{block.subtitle}</div>}
        {block.buttonLabel && (
          <div style={{ display:'inline-block', background:'rgba(255,255,255,0.25)', backdropFilter:'blur(8px)', border:'1.5px solid rgba(255,255,255,0.4)', borderRadius:100, padding: compact?'8px 20px':'10px 28px', fontSize: compact?13:15, color:'#fff', fontWeight:700, cursor:'pointer' }}>
            {block.buttonLabel}
          </div>
        )}
      </div>
    );
    case 'text': return (
      <div style={{ padding: compact?'14px 16px':'18px 20px', background: bg }}>
        <div style={{ fontSize: compact?13:15, color: fg, lineHeight: 1.7, textAlign: block.align||'left', whiteSpace:'pre-wrap' }}>{block.content||'Текст'}</div>
      </div>
    );
    case 'image': return (
      <div style={{ background: bg }}>
        {block.imageUrl ? (
          <img src={block.imageUrl} alt="" style={{ width:'100%', display:'block', maxHeight: compact?160:240, objectFit:'cover' }}/>
        ) : (
          <div style={{ height: compact?80:120, background: dark?'#1a1a26':'#f0f0f8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, color:sub }}>📷</div>
        )}
        {block.caption && <div style={{ padding:'8px 16px', fontSize:12, color:sub, textAlign:'center' }}>{block.caption}</div>}
      </div>
    );
    case 'video': return (
      <div style={{ background: bg, padding:'8px 0' }}>
        {block.videoUrl ? (
          (() => {
            const m = (block.videoUrl||'').match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
            const ytId = m?m[1]:null;
            return ytId
              ? <div style={{borderRadius:0,overflow:'hidden'}}><iframe src={`https://www.youtube.com/embed/${ytId}`} style={{width:'100%',height:compact?120:200,border:'none',display:'block'}} allowFullScreen title="video"/></div>
              : <SwaipVideoPlayer src={block.videoUrl} skin={block.videoSkin||'swaip'} title={block.title}/>;
          })()
        ) : (
          <div style={{ height: compact?80:120, background: dark?'#1a1a26':'#f0f0f8', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, color:sub }}>🎥</div>
        )}
      </div>
    );
    case 'buttons': return (
      <div style={{ padding: compact?'12px 14px':'16px 18px', background: bg, display:'flex', flexDirection:'column', gap:8 }}>
        {(block.buttons||[]).map(btn=>(
          <div key={btn.id} style={{
            padding: compact?'9px 16px':'11px 20px',
            borderRadius:100,
            textAlign:'center',
            fontSize: compact?13:14,
            fontWeight:600,
            cursor:'pointer',
            background: btn.style==='primary'?accent:btn.style==='secondary'?accent+'22':'transparent',
            color: btn.style==='primary'?'#fff':accent,
            border: btn.style==='outline'?`1.5px solid ${accent}`:'none',
          }}>{btn.label||'Кнопка'}</div>
        ))}
        {(!block.buttons||block.buttons.length===0)&&<div style={{color:sub,fontSize:12,textAlign:'center'}}>Нет кнопок</div>}
      </div>
    );
    case 'price': return (
      <div style={{ padding: compact?'16px':'20px', background: bg }}>
        <div style={{ background: dark?'#12121a':'#f7f7ff', border:`1.5px solid ${block.accentColor||accent}33`, borderRadius:16, padding: compact?'16px':'20px', textAlign:'center' }}>
          <div style={{ fontSize: compact?13:14, color: block.accentColor||accent, fontWeight:700, marginBottom:4 }}>{block.priceName||'Тариф'}</div>
          <div style={{ fontSize: compact?26:32, fontWeight:900, color:fg, marginBottom:2 }}>
            {block.price||'0'}<span style={{fontSize:compact?14:16,fontWeight:400,color:sub}}>{block.currency||'₽'}</span>
          </div>
          <div style={{ fontSize:11, color:sub, marginBottom:12 }}>/ {block.period||'мес'}</div>
          <div style={{ display:'flex',flexDirection:'column',gap:5,marginBottom:14 }}>
            {(block.features||[]).map((f,i)=>(
              <div key={i} style={{fontSize:compact?11:13,color:sub,display:'flex',alignItems:'center',gap:6,justifyContent:'center'}}>
                <span style={{color:block.accentColor||accent,fontSize:10}}>✓</span>{f}
              </div>
            ))}
          </div>
          <div style={{background:block.accentColor||accent,color:'#fff',borderRadius:100,padding:compact?'8px 20px':'10px 24px',fontSize:compact?12:14,fontWeight:700,cursor:'pointer'}}>
            {block.ctaLabel||'Выбрать'}
          </div>
        </div>
      </div>
    );
    case 'contacts': return (
      <div style={{ padding: compact?'14px 16px':'18px 20px', background: bg, display:'flex', flexDirection:'column', gap:10 }}>
        {block.phone&&<div style={{display:'flex',alignItems:'center',gap:10,fontSize:compact?13:14,color:fg}}><span style={{fontSize:18}}>📞</span>{block.phone}</div>}
        {block.email&&<div style={{display:'flex',alignItems:'center',gap:10,fontSize:compact?13:14,color:fg}}><span style={{fontSize:18}}>✉️</span>{block.email}</div>}
        {block.address&&<div style={{display:'flex',alignItems:'center',gap:10,fontSize:compact?13:14,color:fg}}><span style={{fontSize:18}}>📍</span>{block.address}</div>}
        {block.website&&<div style={{display:'flex',alignItems:'center',gap:10,fontSize:compact?13:14,color:fg}}><span style={{fontSize:18}}>🌐</span>{block.website}</div>}
        {!block.phone&&!block.email&&!block.address&&!block.website&&<div style={{color:sub,fontSize:12,textAlign:'center'}}>Контакты не заполнены</div>}
      </div>
    );
    case 'divider':
      if (block.divStyle==='space') return <div style={{height:block.divSize==='sm'?16:block.divSize==='lg'?48:32,background:bg}}/>;
      if (block.divStyle==='dots') return <div style={{background:bg,padding:'12px 0',textAlign:'center',fontSize:18,color:sub,letterSpacing:8}}>···</div>;
      return <div style={{background:bg,padding:block.divSize==='sm'?'8px 20px':block.divSize==='lg'?'24px 20px':'16px 20px'}}><div style={{height:1,background:dark?'#2a2a3d':'#e0e0f0'}}/></div>;
    case 'code':
      if (!block.htmlCode) return (
        <div style={{background:bg,padding:'16px',textAlign:'center',color:sub,fontSize:12}}>
          <span style={{fontSize:24}}>💻</span><br/>Вставьте HTML/CSS/JS код
        </div>
      );
      return (
        <iframe
          srcDoc={block.htmlCode}
          sandbox="allow-scripts"
          style={{width:'100%',height:compact?Math.min(block.codeHeight||200,180):block.codeHeight||200,border:'none',display:'block',background:'#000'}}
          title="code-block"
        />
      );
    default: return null;
  }
}

/* ════════════════════════ РЕДАКТОР БЛОКА ════════════════════════ */
function BlockEditor({
  block, onChange, onDelete, apiBase, accent,
}: {
  block: MiniAppBlock;
  onChange: (b: MiniAppBlock) => void;
  onDelete: () => void;
  apiBase: string;
  accent: string;
}) {
  const set = (patch: Partial<MiniAppBlock>) => onChange({ ...block, ...patch });
  const [uploadingImg, setUploadingImg] = useState(false);
  const [uploadingVid, setUploadingVid] = useState(false);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);

  const inp = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    width: '100%', boxSizing: 'border-box', padding: '9px 12px',
    background: C.cardAlt, border: `1px solid ${C.borderB}`,
    borderRadius: 9, color: C.light, fontSize: 13, outline: 'none',
    fontFamily: 'inherit', ...extra,
  });

  const uploadImg = async (file: File) => {
    setUploadingImg(true);
    try {
      const tok = getSessionToken();
      const fd = new FormData(); fd.append('image', file);
      const r = await fetch(`${apiBase}/api/image-upload`, { method: 'POST', headers: { 'x-session-token': tok }, body: fd });
      const d = await r.json();
      if (d.url) set({ imageUrl: d.url });
    } catch {} finally { setUploadingImg(false); }
  };

  const uploadVid = async (file: File) => {
    setUploadingVid(true);
    try {
      const tok = getSessionToken();
      const r = await fetch(`${apiBase}/api/video-upload`, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'video/mp4', 'x-session-token': tok, 'x-filename': file.name },
        body: file,
      });
      const d = await r.json();
      if (d.url) set({ videoUrl: d.url });
    } catch {} finally { setUploadingVid(false); }
  };

  const label = (text: string) => (
    <div style={{ fontSize: 10, fontWeight: 700, color: '#606080', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{text}</div>
  );

  const row = (children: React.ReactNode, gap = 8) => (
    <div style={{ display: 'flex', gap, alignItems: 'center' }}>{children}</div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Удалить */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onDelete} style={{ background: '#ef444422', border: '1px solid #ef444433', color: '#ef4444', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
          🗑 Удалить блок
        </button>
      </div>

      {block.type === 'hero' && (<>
        {label('Заголовок')}
        <input value={block.title||''} onChange={e=>set({title:e.target.value})} style={inp()} placeholder="Ваш заголовок"/>
        {label('Описание')}
        <textarea value={block.subtitle||''} onChange={e=>set({subtitle:e.target.value})} style={{...inp(),minHeight:60,resize:'vertical'}} placeholder="Подзаголовок или описание"/>
        {label('Кнопка')}
        {row(<>
          <input value={block.buttonLabel||''} onChange={e=>set({buttonLabel:e.target.value})} style={{...inp(),flex:1}} placeholder="Текст кнопки"/>
          <input value={block.buttonUrl||''} onChange={e=>set({buttonUrl:e.target.value})} style={{...inp(),flex:1}} placeholder="URL (https://...)"/>
        </>)}
        {label('Фон блока')}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ACCENT_COLORS.map(c => (
            <div key={c} onClick={()=>set({bgColor:c})} style={{ width:28,height:28,borderRadius:'50%',background:c,cursor:'pointer',border:(block.bgColor||accent)===c?`3px solid #fff`:'3px solid transparent',boxShadow:(block.bgColor||accent)===c?`0 0 0 2px ${c}`:'none' }}/>
          ))}
          <input type="color" value={block.bgColor||accent} onChange={e=>set({bgColor:e.target.value})} style={{width:28,height:28,borderRadius:'50%',border:'none',cursor:'pointer',background:'none',padding:0}}/>
        </div>
        {label('Цвет текста')}
        <div style={{ display: 'flex', gap: 8 }}>
          {['#ffffff','#000000','#f0f0ff','#1a1a2e'].map(c=>(
            <div key={c} onClick={()=>set({textColor:c})} style={{width:28,height:28,borderRadius:'50%',background:c,cursor:'pointer',border:(block.textColor||'#fff')===c?`3px solid ${accent}`:'3px solid #333',boxSizing:'border-box'}}/>
          ))}
        </div>
      </>)}

      {block.type === 'text' && (<>
        {label('Текст')}
        <textarea value={block.content||''} onChange={e=>set({content:e.target.value})} style={{...inp(),minHeight:100,resize:'vertical'}} placeholder="Введите текст..."/>
        {label('Выравнивание')}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['left','center','right'] as const).map(a=>(
            <button key={a} onClick={()=>set({align:a})} style={{flex:1,padding:'7px 4px',borderRadius:8,background:block.align===a?accent:C.cardAlt,border:`1.5px solid ${block.align===a?accent:C.border}`,color:block.align===a?'#fff':C.mid,cursor:'pointer',fontSize:16,fontFamily:'inherit'}}>
              {a==='left'?'⬅️':a==='center'?'⬆️':'➡️'}
            </button>
          ))}
        </div>
      </>)}

      {block.type === 'image' && (<>
        {label('Фото')}
        <input ref={imgRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>e.target.files?.[0]&&uploadImg(e.target.files[0])}/>
        <motion.button whileTap={{scale:0.95}} onClick={()=>imgRef.current?.click()} disabled={uploadingImg}
          style={{width:'100%',padding:'10px',borderRadius:9,background:C.cardAlt,border:`1px dashed ${C.border}`,color:C.mid,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
          {uploadingImg?'⏳ Загрузка...':'📷 Загрузить фото'}
        </motion.button>
        {block.imageUrl && <img src={block.imageUrl} alt="" style={{width:'100%',borderRadius:10,maxHeight:140,objectFit:'cover'}}/>}
        {label('Подпись')}
        <input value={block.caption||''} onChange={e=>set({caption:e.target.value})} style={inp()} placeholder="Подпись к фото (необязательно)"/>
      </>)}

      {block.type === 'video' && (<>
        {label('Видео URL или YouTube')}
        <input value={block.videoUrl||''} onChange={e=>set({videoUrl:e.target.value})} style={inp()} placeholder="YouTube ссылка или URL видео"/>
        <input ref={vidRef} type="file" accept="video/*" style={{display:'none'}} onChange={e=>e.target.files?.[0]&&uploadVid(e.target.files[0])}/>
        <motion.button whileTap={{scale:0.95}} onClick={()=>vidRef.current?.click()} disabled={uploadingVid}
          style={{width:'100%',padding:'10px',borderRadius:9,background:C.cardAlt,border:`1px dashed ${C.border}`,color:C.mid,fontSize:12,cursor:'pointer',fontFamily:'inherit'}}>
          {uploadingVid?'⏳ Загрузка видео...':'🎬 Загрузить видео-файл'}
        </motion.button>
        {block.videoUrl && !block.videoUrl.match(/youtube|youtu\.be/) && (<>
          {label('Скин плеера')}
          <SkinSelector skin={block.videoSkin||'swaip'} onChange={s=>set({videoSkin:s})}/>
        </>)}
      </>)}

      {block.type === 'buttons' && (<>
        {label('Кнопки')}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(block.buttons||[]).map((btn, i) => (
            <div key={btn.id} style={{ background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: 10, display:'flex',flexDirection:'column',gap:7 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input value={btn.label} onChange={e=>{const bs=[...(block.buttons||[])];bs[i]={...btn,label:e.target.value};set({buttons:bs});}}
                  style={{...inp(),flex:1}} placeholder="Текст кнопки"/>
                <button onClick={()=>set({buttons:(block.buttons||[]).filter((_,j)=>j!==i)})}
                  style={{background:'#ef444420',border:'none',color:'#ef4444',borderRadius:7,width:30,height:30,cursor:'pointer',fontSize:14}}>✕</button>
              </div>
              <input value={btn.url} onChange={e=>{const bs=[...(block.buttons||[])];bs[i]={...btn,url:e.target.value};set({buttons:bs});}}
                style={inp()} placeholder="URL (https://... или пусто)"/>
              <div style={{ display: 'flex', gap: 5 }}>
                {(['primary','secondary','outline'] as const).map(s=>(
                  <button key={s} onClick={()=>{const bs=[...(block.buttons||[])];bs[i]={...btn,style:s};set({buttons:bs});}}
                    style={{flex:1,padding:'5px 4px',borderRadius:7,background:btn.style===s?accent:C.bg,border:`1px solid ${btn.style===s?accent:C.border}`,color:btn.style===s?'#fff':C.mid,cursor:'pointer',fontSize:11,fontFamily:'inherit'}}>
                    {s==='primary'?'Основная':s==='secondary'?'Вторая':'Контур'}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={()=>set({buttons:[...(block.buttons||[]),{id:btnUid(),label:'Кнопка',url:'',style:'primary'}]})}
            style={{padding:'8px',borderRadius:9,background:C.cardAlt,border:`1px dashed ${C.border}`,color:accent,cursor:'pointer',fontSize:13,fontFamily:'inherit'}}>
            + Добавить кнопку
          </button>
        </div>
      </>)}

      {block.type === 'price' && (<>
        {label('Название тарифа')}
        <input value={block.priceName||''} onChange={e=>set({priceName:e.target.value})} style={inp()} placeholder="Стандарт"/>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{flex:2}}>
            {label('Цена')}
            <input value={block.price||''} onChange={e=>set({price:e.target.value})} style={inp()} placeholder="990"/>
          </div>
          <div style={{flex:1}}>
            {label('Валюта')}
            <input value={block.currency||''} onChange={e=>set({currency:e.target.value})} style={inp()} placeholder="₽"/>
          </div>
          <div style={{flex:1}}>
            {label('Период')}
            <input value={block.period||''} onChange={e=>set({period:e.target.value})} style={inp()} placeholder="мес"/>
          </div>
        </div>
        {label('Преимущества (по одному на строку)')}
        <textarea value={(block.features||[]).join('\n')} onChange={e=>set({features:e.target.value.split('\n')})}
          style={{...inp(),minHeight:80,resize:'vertical'}} placeholder="Функция 1&#10;Функция 2&#10;Функция 3"/>
        {label('Текст кнопки')}
        <input value={block.ctaLabel||''} onChange={e=>set({ctaLabel:e.target.value})} style={inp()} placeholder="Выбрать"/>
        {label('Цвет акцента')}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ACCENT_COLORS.map(c=>(
            <div key={c} onClick={()=>set({accentColor:c})} style={{width:24,height:24,borderRadius:'50%',background:c,cursor:'pointer',border:(block.accentColor||accent)===c?`3px solid #fff`:'3px solid transparent',boxShadow:(block.accentColor||accent)===c?`0 0 0 2px ${c}`:'none'}}/>
          ))}
        </div>
      </>)}

      {block.type === 'contacts' && (<>
        {label('Телефон')}
        <input value={block.phone||''} onChange={e=>set({phone:e.target.value})} style={inp()} placeholder="+7 999 000-00-00"/>
        {label('Email')}
        <input value={block.email||''} onChange={e=>set({email:e.target.value})} style={inp()} placeholder="hello@example.com"/>
        {label('Адрес')}
        <input value={block.address||''} onChange={e=>set({address:e.target.value})} style={inp()} placeholder="Москва, ул. Примерная, 1"/>
        {label('Сайт')}
        <input value={block.website||''} onChange={e=>set({website:e.target.value})} style={inp()} placeholder="https://example.com"/>
      </>)}

      {block.type === 'divider' && (<>
        {label('Стиль')}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['line','space','dots'] as const).map(s=>(
            <button key={s} onClick={()=>set({divStyle:s})} style={{flex:1,padding:'7px 4px',borderRadius:8,background:block.divStyle===s?accent:C.cardAlt,border:`1.5px solid ${block.divStyle===s?accent:C.border}`,color:block.divStyle===s?'#fff':C.mid,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>
              {s==='line'?'Линия':s==='space'?'Отступ':'Точки'}
            </button>
          ))}
        </div>
        {label('Размер')}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['sm','md','lg'] as const).map(s=>(
            <button key={s} onClick={()=>set({divSize:s})} style={{flex:1,padding:'7px 4px',borderRadius:8,background:block.divSize===s?accent:C.cardAlt,border:`1.5px solid ${block.divSize===s?accent:C.border}`,color:block.divSize===s?'#fff':C.mid,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>
              {s==='sm'?'S':s==='md'?'M':'L'}
            </button>
          ))}
        </div>
      </>)}

      {block.type === 'code' && (<>
        <div style={{background:'#8b5cf622',border:'1px solid #8b5cf644',borderRadius:10,padding:'10px 12px',marginBottom:4}}>
          <div style={{fontSize:12,fontWeight:700,color:'#a78bfa',marginBottom:4}}>💻 Developer Code Block</div>
          <div style={{fontSize:11,color:C.mid,lineHeight:1.5}}>
            Поддерживается <strong style={{color:C.light}}>HTML</strong>, <strong style={{color:C.light}}>CSS</strong>, <strong style={{color:C.light}}>JavaScript</strong>.<br/>
            Код запускается в изолированном iframe (sandbox).<br/>
            Можно использовать любые фреймворки через CDN.
          </div>
        </div>
        {label('Высота блока (px)')}
        <input type="number" min={80} max={800} value={block.codeHeight||200} onChange={e=>set({codeHeight:Number(e.target.value)||200})} style={{...inp(),width:120}}/>
        {label('HTML / CSS / JavaScript код')}
        <textarea
          value={block.htmlCode||''}
          onChange={e=>set({htmlCode:e.target.value})}
          spellCheck={false}
          style={{...inp(),minHeight:260,resize:'vertical',fontFamily:'"Fira Code","Cascadia Code","Courier New",monospace',fontSize:12,lineHeight:1.6,tabSize:2}}
          placeholder={`<!DOCTYPE html>\n<html>\n<head>\n  <style>\n    body { margin:0; background:#0a0a1a; color:#fff; }\n  </style>\n</head>\n<body>\n  <h1>Hello World!</h1>\n  <script>\n    console.log('Mini App loaded!');\n  </script>\n</body>\n</html>`}
        />
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>set({htmlCode:`<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: sans-serif; background: #0a0a1a; color: #fff; padding: 20px; }
    h1 { color: #8b5cf6; margin-bottom: 12px; }
    .btn { background: #8b5cf6; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; }
    .btn:hover { background: #7c3aed; }
  </style>
</head>
<body>
  <h1>Hello, SWAIP Mini App! 🚀</h1>
  <p style="margin-bottom:16px;color:#aaa">Custom HTML/CSS/JS block</p>
  <button class="btn" onclick="alert('SWAIP!')">Click me</button>
</body></html>`})}
            style={{flex:1,padding:'7px 10px',borderRadius:8,background:C.cardAlt,border:`1px solid ${C.border}`,color:C.mid,cursor:'pointer',fontSize:11,fontFamily:'inherit'}}>
            📋 Сброс к примеру
          </button>
          <button onClick={()=>set({htmlCode:`<!DOCTYPE html>
<html><head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>body{margin:0;background:#0a0a1a;display:flex;align-items:center;justify-content:center;height:100vh;}</style>
</head>
<body>
  <canvas id="c" width="260" height="160"></canvas>
  <script>
    new Chart(document.getElementById('c'),{type:'doughnut',data:{labels:['React','Vue','JS'],datasets:[{data:[40,30,30],backgroundColor:['#8b5cf6','#6366f1','#ec4899']}]},options:{plugins:{legend:{labels:{color:'#fff'}}}}});
  </script>
</body></html>`})}
            style={{flex:1,padding:'7px 10px',borderRadius:8,background:C.cardAlt,border:`1px solid ${C.border}`,color:'#10b981',cursor:'pointer',fontSize:11,fontFamily:'inherit'}}>
            📊 Пример Chart.js
          </button>
        </div>
      </>)}
    </div>
  );
}

/* ════════════════════════ ТЕЛЕФОН-ПРЕВЬЮ ════════════════════════ */
function PhonePreview({ config, accent, selectedId, onSelect }: {
  config: MiniAppConfig; accent: string; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const dark = config.darkMode;
  const bg = dark ? '#0a0a0f' : '#f8f8ff';

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-start', padding: '20px 0', height: '100%', overflowY: 'auto' }}>
      <div style={{ width: 320, background: '#1a1a2e', borderRadius: 40, padding: '10px', boxShadow: '0 32px 80px rgba(0,0,0,0.8)' }}>
        {/* Notch */}
        <div style={{ background: '#000', borderRadius: 30, overflow: 'hidden', position: 'relative' }}>
          <div style={{ position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)', width: 80, height: 6, background: '#1a1a2e', borderRadius: 3, zIndex: 2 }}/>
          <div style={{ background: bg, minHeight: 540, maxHeight: 600, overflowY: 'auto', borderRadius: 30 }}>
            {config.blocks.length === 0 ? (
              <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12, color: '#606080' }}>
                <div style={{ fontSize: 40 }}>✨</div>
                <div style={{ fontSize: 13, textAlign: 'center' }}>Add blocks<br/>to see preview</div>
              </div>
            ) : config.blocks.map(block => (
              <div key={block.id} onClick={() => onSelect(block.id)} style={{
                cursor: 'pointer',
                outline: selectedId === block.id ? `2px solid ${accent}` : '2px solid transparent',
                outlineOffset: -2,
                transition: 'outline 0.15s',
              }}>
                <BlockRenderer block={block} accent={accent} dark={dark} compact/>
              </div>
            ))}
          </div>
        </div>
        {/* Home indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
          <div style={{ width: 80, height: 4, background: '#ffffff30', borderRadius: 2 }}/>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════ СПИСОК МИНИ-АППОВ ════════════════════════ */
function MiniAppList({ apps, selectedId, onSelect, onCreate, onDelete, loading }: {
  apps: SwMiniApp[]; selectedId: string | null; onSelect: (a: SwMiniApp) => void;
  onCreate: () => void; onDelete: (id: string) => void; loading: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <motion.button whileTap={{ scale: 0.96 }} onClick={onCreate}
        style={{ width: '100%', padding: '11px', borderRadius: 12, background: `linear-gradient(135deg, ${ACCENT}, #6366f1)`, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        ✨ New Mini App
      </motion.button>
      {loading && <div style={{ textAlign: 'center', color: C.mid, padding: '20px 0', fontSize: 13 }}>⏳ Загрузка...</div>}
      {!loading && apps.length === 0 && (
        <div style={{ textAlign: 'center', color: C.mid, padding: '24px 0', fontSize: 13 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>✨</div>
          No Mini Apps yet. Create your first!
        </div>
      )}
      {apps.map(app => (
        <motion.div key={app.id} whileTap={{ scale: 0.98 }} onClick={() => onSelect(app)}
          style={{ background: selectedId === app.id ? ACCENT + '22' : C.cardAlt, border: `1.5px solid ${selectedId === app.id ? ACCENT + '55' : C.border}`, borderRadius: 12, padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 26, flexShrink: 0 }}>{app.icon || '✨'}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: C.light, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.name}</div>
            <div style={{ fontSize: 11, color: C.mid, marginTop: 2 }}>
              {(app.config?.blocks?.length || 0)} блоков · {app.viewCount || 0} просмотров
            </div>
          </div>
          <button onClick={e => { e.stopPropagation(); onDelete(app.id); }}
            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14, padding: '4px 6px', borderRadius: 6, flexShrink: 0 }}>
            🗑
          </button>
        </motion.div>
      ))}
    </div>
  );
}

/* ════════════════════════ ГЛАВНЫЙ КОМПОНЕНТ ════════════════════════ */
export default function SwaipMiniAppBuilder({ apiBase }: { apiBase: string }) {
  const [apps, setApps] = useState<SwMiniApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [editApp, setEditApp] = useState<SwMiniApp | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddBlock, setShowAddBlock] = useState(false);
  const [mobileTab, setMobileTab] = useState<'blocks' | 'preview' | 'editor'>('blocks');
  const [showShare, setShowShare] = useState(false);

  const config: MiniAppConfig = editApp?.config || { accentColor: ACCENT, darkMode: false, blocks: [] };
  const accent = config.accentColor || ACCENT;
  const selectedBlock = selectedBlockId ? config.blocks.find(b => b.id === selectedBlockId) || null : null;

  /* Загрузка */
  useEffect(() => {
    const tok = getSessionToken();
    if (!tok) { setLoading(false); return; }
    fetch(`${apiBase}/api/mini-apps`, { headers: { 'x-session-token': tok } })
      .then(r => r.ok ? r.json() : [])
      .then((data: SwMiniApp[]) => {
        const list = Array.isArray(data) ? data : [];
        setApps(list.map(a => ({ ...a, config: typeof a.config === 'string' ? JSON.parse(a.config as unknown as string) : a.config })));
      }).catch(() => {}).finally(() => setLoading(false));
  }, [apiBase]);

  /* Создать */
  const createApp = async () => {
    const tok = getSessionToken();
    const r = await fetch(`${apiBase}/api/mini-apps`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session-token': tok },
      body: JSON.stringify({ name: 'New Mini App' }),
    });
    const app: SwMiniApp = await r.json();
    const parsed = { ...app, config: typeof app.config === 'string' ? JSON.parse(app.config as unknown as string) : app.config };
    setApps(prev => [parsed, ...prev]);
    openEdit(parsed);
  };

  /* Открыть редактор */
  const openEdit = (app: SwMiniApp) => {
    const cfg = typeof app.config === 'string' ? JSON.parse(app.config as unknown as string) : app.config;
    setEditApp({ ...app, config: cfg });
    setSelectedBlockId(cfg.blocks?.[0]?.id || null);
    setMobileTab('preview');
  };

  /* Удалить */
  const deleteApp = async (id: string) => {
    if (!confirm('Delete this Mini App?')) return;
    const tok = getSessionToken();
    await fetch(`${apiBase}/api/mini-apps/${id}`, { method: 'DELETE', headers: { 'x-session-token': tok } });
    setApps(prev => prev.filter(a => a.id !== id));
    if (editApp?.id === id) setEditApp(null);
  };

  /* Сохранить */
  const save = async () => {
    if (!editApp) return;
    setSaving(true);
    try {
      const tok = getSessionToken();
      const r = await fetch(`${apiBase}/api/mini-apps/${editApp.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'x-session-token': tok },
        body: JSON.stringify({ name: editApp.name, description: editApp.description, icon: editApp.icon, config: editApp.config, isPublic: editApp.isPublic === 'true' }),
      });
      const saved: SwMiniApp = await r.json();
      const parsed = { ...saved, config: typeof saved.config === 'string' ? JSON.parse(saved.config as unknown as string) : saved.config };
      setApps(prev => prev.map(a => a.id === parsed.id ? parsed : a));
      setEditApp(parsed);
    } catch {} finally { setSaving(false); }
  };

  /* Обновить конфиг */
  const setConfig = (patch: Partial<MiniAppConfig>) => {
    if (!editApp) return;
    setEditApp(prev => prev ? { ...prev, config: { ...prev.config, ...patch } } : prev);
  };

  /* Операции с блоками */
  const addBlock = (type: BlockType) => {
    const block = makeBlock(type);
    setConfig({ blocks: [...config.blocks, block] });
    setSelectedBlockId(block.id);
    setShowAddBlock(false);
    setMobileTab('editor');
  };

  const updateBlock = (updated: MiniAppBlock) => {
    setConfig({ blocks: config.blocks.map(b => b.id === updated.id ? updated : b) });
  };

  const deleteBlock = (id: string) => {
    setConfig({ blocks: config.blocks.filter(b => b.id !== id) });
    setSelectedBlockId(null);
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    const idx = config.blocks.findIndex(b => b.id === id);
    if (idx < 0) return;
    const arr = [...config.blocks];
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= arr.length) return;
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    setConfig({ blocks: arr });
  };

  const shareUrl = editApp ? `${window.location.origin}/mini/${editApp.id}` : '';

  /* ── UI ── */
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, color: C.light, fontFamily: '"Inter", system-ui, sans-serif', overflow: 'hidden' }}>

      {/* ═══ СПИСОК: нет редактора ═══ */}
      {!editApp && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>My Mini Apps</div>
          <MiniAppList apps={apps} selectedId={null} onSelect={openEdit} onCreate={createApp} onDelete={deleteApp} loading={loading}/>
        </div>
      )}

      {/* ═══ РЕДАКТОР ═══ */}
      {editApp && (<>
        {/* Шапка редактора */}
        <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button onClick={() => { setEditApp(null); setSelectedBlockId(null); }}
            style={{ background: 'none', border: 'none', color: C.mid, cursor: 'pointer', fontSize: 18, padding: '2px 6px', borderRadius: 7, flexShrink: 0 }}>
            ←
          </button>
          <input value={editApp.name} onChange={e => setEditApp(prev => prev ? { ...prev, name: e.target.value } : prev)}
            style={{ flex: 1, background: 'none', border: 'none', color: C.light, fontSize: 15, fontWeight: 700, outline: 'none', fontFamily: 'inherit', minWidth: 0 }}/>
          <button onClick={() => setShowShare(true)}
            style={{ background: editApp.isPublic === 'true' ? '#10b98122' : C.cardAlt, border: `1px solid ${editApp.isPublic === 'true' ? '#10b981' : C.border}`, color: editApp.isPublic === 'true' ? '#10b981' : C.mid, borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            🔗 Поделиться
          </button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={save} disabled={saving}
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}cc)`, border: 'none', color: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
            {saving ? '⏳' : '💾 Сохранить'}
          </motion.button>
        </div>

        {/* Мобильные вкладки */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          {(['blocks','preview','editor'] as const).map(tab => (
            <button key={tab} onClick={() => setMobileTab(tab)}
              style={{ flex: 1, padding: '9px 4px', background: 'none', border: 'none', borderBottom: mobileTab === tab ? `2px solid ${accent}` : '2px solid transparent', color: mobileTab === tab ? accent : C.mid, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              {tab === 'blocks' ? '📋 Blocks' : tab === 'preview' ? '📱 Preview' : '✏️ Editor'}
            </button>
          ))}
        </div>

        {/* Контент */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>

          {/* ─── БЛОКИ ─── */}
          {mobileTab === 'blocks' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
              {/* Настройки аппа */}
              <div style={{ background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.mid, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Настройки</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontSize: 10, color: C.mid }}>Иконка</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {ICONS.map(ic => (
                      <div key={ic} onClick={() => setEditApp(prev => prev ? { ...prev, icon: ic } : prev)}
                        style={{ width: 28, height: 28, borderRadius: 7, background: editApp.icon === ic ? accent + '33' : C.bg, border: `1.5px solid ${editApp.icon === ic ? accent : C.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                        {ic}
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontSize: 10, color: C.mid, flexShrink: 0 }}>Акцент</div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {ACCENT_COLORS.map(c => (
                      <div key={c} onClick={() => setConfig({ accentColor: c })} style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', border: accent === c ? '3px solid #fff' : '3px solid transparent', boxShadow: accent === c ? `0 0 0 2px ${c}` : 'none' }}/>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontSize: 10, color: C.mid }}>Тема</div>
                  <button onClick={() => setConfig({ darkMode: !config.darkMode })}
                    style={{ padding: '5px 12px', borderRadius: 8, background: config.darkMode ? '#6366f133' : C.bg, border: `1px solid ${C.border}`, color: C.mid, cursor: 'pointer', fontSize: 12, fontFamily: 'inherit' }}>
                    {config.darkMode ? '🌙 Тёмная' : '☀️ Светлая'}
                  </button>
                </div>
              </div>

              {/* Список блоков */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                {config.blocks.length === 0 && (
                  <div style={{ textAlign: 'center', color: C.mid, padding: '20px 0', fontSize: 12 }}>No blocks yet — add the first one ↓</div>
                )}
                {config.blocks.map((block, i) => {
                  const bt = BLOCK_TYPES.find(b => b.type === block.type);
                  return (
                    <div key={block.id} onClick={() => { setSelectedBlockId(block.id); setMobileTab('editor'); }}
                      style={{ background: selectedBlockId === block.id ? accent + '22' : C.cardAlt, border: `1.5px solid ${selectedBlockId === block.id ? accent + '55' : C.border}`, borderRadius: 10, padding: '9px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 18 }}>{bt?.icon}</span>
                      <div style={{ flex: 1, fontSize: 13, color: C.light, fontWeight: 500 }}>
                        {block.title || block.content?.slice(0, 30) || block.priceName || bt?.label || 'Блок'}
                      </div>
                      <div style={{ display: 'flex', gap: 3 }}>
                        <button onClick={e=>{e.stopPropagation();moveBlock(block.id,-1)}} style={{background:'none',border:'none',color:C.mid,cursor:'pointer',fontSize:12,padding:'2px 4px'}}>↑</button>
                        <button onClick={e=>{e.stopPropagation();moveBlock(block.id,1)}} style={{background:'none',border:'none',color:C.mid,cursor:'pointer',fontSize:12,padding:'2px 4px'}}>↓</button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Добавить блок */}
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowAddBlock(!showAddBlock)}
                style={{ width: '100%', padding: '10px', borderRadius: 10, background: showAddBlock ? accent + '22' : C.cardAlt, border: `1px dashed ${showAddBlock ? accent : C.border}`, color: showAddBlock ? accent : C.mid, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>
                {showAddBlock ? '✕ Close' : '+ Add Block'}
              </motion.button>
              <AnimatePresence>
                {showAddBlock && (
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginTop: 8 }}>
                    {BLOCK_TYPES.map(bt => (
                      <motion.button key={bt.type} whileTap={{ scale: 0.96 }} onClick={() => addBlock(bt.type)}
                        style={{ padding: '10px 8px', borderRadius: 10, background: C.cardAlt, border: `1px solid ${C.border}`, color: C.light, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 22 }}>{bt.icon}</span>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{bt.label}</span>
                        <span style={{ fontSize: 10, color: C.mid, textAlign: 'center' }}>{bt.desc}</span>
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* ─── ПРЕВЬЮ ─── */}
          {mobileTab === 'preview' && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <PhonePreview config={config} accent={accent} selectedId={selectedBlockId} onSelect={id => { setSelectedBlockId(id); setMobileTab('editor'); }}/>
            </div>
          )}

          {/* ─── РЕДАКТОР БЛОКА ─── */}
          {mobileTab === 'editor' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '14px' }}>
              {selectedBlock ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 20 }}>{BLOCK_TYPES.find(b => b.type === selectedBlock.type)?.icon}</span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: C.light }}>{BLOCK_TYPES.find(b => b.type === selectedBlock.type)?.label}</span>
                  </div>
                  <BlockEditor
                    block={selectedBlock} accent={accent} apiBase={apiBase}
                    onChange={updated => updateBlock(updated)}
                    onDelete={() => deleteBlock(selectedBlock.id)}
                  />
                </>
              ) : (
                <div style={{ textAlign: 'center', color: C.mid, padding: '40px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>👆</div>
                  <div style={{ fontSize: 13 }}>Select a block in Preview<br/>or in the Blocks list</div>
                </div>
              )}
            </div>
          )}
        </div>
      </>)}

      {/* ═══ МОДАЛ: ПОДЕЛИТЬСЯ ═══ */}
      <AnimatePresence>
        {showShare && editApp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 16 }}
            onClick={() => setShowShare(false)}>
            <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 24, padding: '24px 20px', width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 18, color: C.light }}>🔗 Share Mini App</div>
              <div>
                <div style={{ fontSize: 11, color: C.mid, marginBottom: 6, textTransform: 'uppercase' }}>Make public</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div onClick={() => { setEditApp(prev => prev ? { ...prev, isPublic: prev.isPublic === 'true' ? 'false' : 'true' } : prev); }}
                    style={{ width: 44, height: 24, borderRadius: 12, background: editApp.isPublic === 'true' ? accent : C.cardAlt, border: `1.5px solid ${editApp.isPublic === 'true' ? accent : C.border}`, cursor: 'pointer', position: 'relative', transition: 'all 0.2s' }}>
                    <div style={{ position: 'absolute', top: 2, left: editApp.isPublic === 'true' ? 22 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }}/>
                  </div>
                  <span style={{ fontSize: 13, color: C.mid }}>{editApp.isPublic === 'true' ? 'Public — visible to everyone' : 'Private — only you'}</span>
                </div>
              </div>
              {editApp.isPublic === 'true' && (
                <div>
                  <div style={{ fontSize: 11, color: C.mid, marginBottom: 6, textTransform: 'uppercase' }}>Link</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ flex: 1, background: C.cardAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 12px', fontSize: 12, color: C.mid, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {shareUrl}
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(shareUrl); alert('Link copied!'); }}
                      style={{ background: accent, border: 'none', color: '#fff', borderRadius: 10, padding: '9px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                      Copy
                    </button>
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={async () => { await save(); setShowShare(false); }}
                  style={{ flex: 1, padding: '11px', borderRadius: 12, background: `linear-gradient(135deg,${accent},${accent}cc)`, border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                  💾 Save & Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
