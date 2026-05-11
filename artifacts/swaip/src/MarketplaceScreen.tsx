import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackHandler } from './backHandler';

const API = window.location.origin;
const getST = () => { try { return localStorage.getItem('swaip_session') || ''; } catch { return ''; } };

interface Listing {
  id: string; sellerHash: string; sellerName: string; sellerAvatar: string;
  title: string; description: string; price: number; currency: string;
  category: string; condition: string; imageUrls: string[];
  location: string; createdAt: number; sold: boolean;
}

const CATEGORIES = ['Все','Электроника','Одежда','Авто','Недвижимость','Игры','Книги','Спорт','Красота','Детское','Другое'];
const CONDITIONS = ['Новое','Отличное','Хорошее','Б/у','На запчасти'];

function fmtPrice(price: number, currency: string) {
  if (price === 0) return 'Бесплатно';
  return new Intl.NumberFormat('ru', { style: 'currency', currency: currency === 'RUB' ? 'RUB' : 'USD', maximumFractionDigits: 0 }).format(price);
}
function Av({ name, avatar, size = 36 }: { name: string; avatar?: string; size?: number }) {
  const colors = ['#7c3aed','#db2777','#059669','#d97706','#2563eb'];
  const col = colors[(name.charCodeAt(0)||0)%colors.length];
  if (avatar) return <img src={avatar} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>;
  return <div style={{width:size,height:size,borderRadius:'50%',background:col,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,color:'#fff',fontSize:size*0.4}}>{name[0]?.toUpperCase()||'?'}</div>;
}

export default function MarketplaceScreen({ myHash, onBack, onOpenChat }: {
  myHash: string; onBack: () => void;
  onOpenChat?: (hash: string, name: string) => void;
}) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState('Все');
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState<Listing | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', price: '', currency: 'RUB', category: 'Электроника', condition: 'Б/у', location: '' });
  const [formImages, setFormImages] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imgIdx, setImgIdx] = useState(0);

  useBackHandler(detail ? () => setDetail(null) : showCreate ? () => setShowCreate(false) : onBack);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (cat !== 'Все') params.set('category', cat);
      if (search.trim()) params.set('q', search.trim());
      const r = await fetch(`${API}/api/marketplace/listings?${params}`);
      const d = await r.json();
      setListings(d.listings || []);
    } catch { /* */ }
    setLoading(false);
  }, [cat, search]);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.title.trim()) return;
    setCreating(true);
    try {
      const r = await fetch(`${API}/api/marketplace/listings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': getST() },
        body: JSON.stringify({ ...form, price: parseFloat(form.price) || 0, imageUrls: formImages }),
      });
      const d = await r.json();
      if (d.success) {
        setListings(prev => [d.listing, ...prev]);
        setShowCreate(false);
        setForm({ title: '', description: '', price: '', currency: 'RUB', category: 'Электроника', condition: 'Б/у', location: '' });
        setFormImages([]);
      }
    } catch { /* */ }
    setCreating(false);
  };

  const markSold = async (id: string) => {
    await fetch(`${API}/api/marketplace/listings/${id}/sold`, { method: 'PATCH', headers: { 'x-session-token': getST() } }).catch(() => {});
    setListings(prev => prev.map(l => l.id === id ? { ...l, sold: true } : l));
    if (detail?.id === id) setDetail(prev => prev ? { ...prev, sold: true } : prev);
  };

  const del = async (id: string) => {
    await fetch(`${API}/api/marketplace/listings/${id}`, { method: 'DELETE', headers: { 'x-session-token': getST() } }).catch(() => {});
    setListings(prev => prev.filter(l => l.id !== id));
    if (detail?.id === id) setDetail(null);
  };

  const uploadImg = async (file: File) => {
    const r = await fetch(`${API}/api/image-upload`, {
      method: 'POST',
      headers: { 'Content-Type': file.type || 'image/jpeg', 'x-session-token': getST() },
      body: file,
    });
    const d = await r.json();
    const url = d.url || d.imageUrl;
    if (url) setFormImages(prev => [...prev, url].slice(0, 8));
  };

  return (
    <div style={{position:'fixed',inset:0,background:'#05050c',display:'flex',flexDirection:'column',fontFamily:'"Montserrat",sans-serif',zIndex:500}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'48px 16px 12px',borderBottom:'1px solid rgba(255,255,255,0.08)',background:'rgba(8,8,18,0.98)',backdropFilter:'blur(20px)',position:'sticky',top:0,zIndex:10}}>
        <motion.button whileTap={{scale:0.9}} onClick={onBack} style={{width:40,height:40,borderRadius:'50%',border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.06)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:'#fff'}}>←</motion.button>
        <div style={{flex:1}}>
          <div style={{fontWeight:900,fontSize:18,color:'#fff'}}>🛍️ Маркетплейс</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>Купи и продай внутри SWAIP</div>
        </div>
        <motion.button whileTap={{scale:0.92}} onClick={()=>setShowCreate(true)} style={{padding:'10px 18px',borderRadius:100,border:'none',background:'linear-gradient(135deg,#7c3aed,#db2777)',color:'#fff',fontWeight:800,fontSize:13,cursor:'pointer',fontFamily:'"Montserrat",sans-serif'}}>+ Продать</motion.button>
      </div>

      {/* Search */}
      <div style={{padding:'10px 16px 0',background:'rgba(8,8,18,0.95)',overflow:'hidden'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Поиск товаров..."
          style={{width:'100%',padding:'10px 14px',borderRadius:100,border:'1px solid rgba(255,255,255,0.1)',background:'rgba(255,255,255,0.05)',color:'#fff',fontSize:13,fontFamily:'"Montserrat",sans-serif',outline:'none',boxSizing:'border-box'}}/>
        {/* Categories */}
        <div style={{display:'flex',gap:6,overflowX:'auto',overflowY:'hidden',padding:'8px 0 6px',scrollbarWidth:'none',WebkitOverflowScrolling:'touch' as any,msOverflowStyle:'none' as any}}>
          {CATEGORIES.map(c => (
            <motion.button key={c} whileTap={{scale:0.92}} onClick={()=>setCat(c)}
              style={{padding:'5px 12px',borderRadius:100,border:'none',cursor:'pointer',fontWeight:700,fontSize:11,fontFamily:'"Montserrat",sans-serif',flexShrink:0,whiteSpace:'nowrap',
                background:cat===c?'linear-gradient(135deg,#7c3aed,#db2777)':'rgba(255,255,255,0.07)',
                color:cat===c?'#fff':'rgba(255,255,255,0.6)'}}>
              {c}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div style={{flex:1,overflowY:'auto',padding:'10px 16px 100px'}}>
        {loading ? <div style={{textAlign:'center',padding:40,color:'rgba(255,255,255,0.3)'}}>Загружаю...</div>
        : listings.length === 0 ? (
          <div style={{textAlign:'center',padding:60}}>
            <div style={{fontSize:52}}>🛍️</div>
            <div style={{fontWeight:800,fontSize:16,color:'#fff',marginTop:12}}>Ничего не найдено</div>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.4)',marginTop:6}}>Стань первым продавцом!</div>
          </div>
        ) : (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {listings.map(l => (
              <motion.div key={l.id} whileTap={{scale:0.97}} onClick={()=>{setDetail(l);setImgIdx(0);}}
                style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:16,overflow:'hidden',cursor:'pointer',position:'relative'}}>
                {l.sold && <div style={{position:'absolute',top:8,right:8,background:'rgba(239,68,68,0.9)',color:'#fff',fontSize:10,fontWeight:800,padding:'3px 8px',borderRadius:100,zIndex:1}}>ПРОДАНО</div>}
                {l.imageUrls[0]
                  ? <img src={l.imageUrls[0]} style={{width:'100%',height:120,objectFit:'cover'}}/>
                  : <div style={{width:'100%',height:120,background:'linear-gradient(135deg,#1a0a3a,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:36}}>📦</div>}
                <div style={{padding:'8px 10px 10px'}}>
                  <div style={{fontWeight:800,fontSize:12,color:'#fff',marginBottom:3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.title}</div>
                  <div style={{fontWeight:900,fontSize:14,color:'#a78bfa',marginBottom:6}}>{fmtPrice(l.price,l.currency)}</div>
                  {l.sellerHash !== myHash && !l.sold ? (
                    <motion.button whileTap={{scale:0.92}} onClick={e=>{e.stopPropagation();onOpenChat?.(l.sellerHash,l.sellerName);}}
                      style={{width:'100%',padding:'6px 0',borderRadius:8,border:'none',background:'linear-gradient(135deg,#7c3aed,#db2777)',color:'#fff',fontWeight:800,fontSize:11,cursor:'pointer',fontFamily:'"Montserrat",sans-serif'}}>
                      💬 Купить
                    </motion.button>
                  ) : (
                    <div style={{fontSize:10,color:'rgba(255,255,255,0.35)'}}>{l.condition}</div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Detail */}
      <AnimatePresence>
        {detail && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setDetail(null)} style={{position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(8px)'}}/>
            <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',stiffness:360,damping:34}}
              style={{position:'fixed',bottom:0,left:0,right:0,zIndex:301,background:'#0f0f1a',borderRadius:'24px 24px 0 0',maxHeight:'92dvh',overflowY:'auto',padding:'20px 20px calc(32px + env(safe-area-inset-bottom,0px))'}}>
              <div style={{width:40,height:4,background:'rgba(255,255,255,0.15)',borderRadius:99,margin:'0 auto 16px'}}/>
              {/* Image carousel */}
              {detail.imageUrls.length > 0 && (
                <div style={{position:'relative',marginBottom:16}}>
                  <img src={detail.imageUrls[imgIdx]} style={{width:'100%',height:220,objectFit:'cover',borderRadius:16}}/>
                  {detail.imageUrls.length > 1 && (
                    <div style={{display:'flex',justifyContent:'center',gap:5,marginTop:8}}>
                      {detail.imageUrls.map((_,i)=>(
                        <div key={i} onClick={()=>setImgIdx(i)} style={{width:i===imgIdx?20:6,height:6,borderRadius:99,background:i===imgIdx?'#a78bfa':'rgba(255,255,255,0.3)',cursor:'pointer',transition:'all 0.2s'}}/>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {detail.sold && <div style={{background:'rgba(239,68,68,0.15)',border:'1px solid rgba(239,68,68,0.3)',borderRadius:10,padding:'8px 14px',marginBottom:12,color:'#f87171',fontWeight:800,fontSize:13,textAlign:'center'}}>Товар уже продан</div>}
              <div style={{fontWeight:900,fontSize:20,color:'#fff',marginBottom:8}}>{detail.title}</div>
              <div style={{fontWeight:900,fontSize:22,color:'#a78bfa',marginBottom:10}}>{fmtPrice(detail.price,detail.currency)}</div>
              <div style={{display:'flex',gap:8,marginBottom:12,flexWrap:'wrap'}}>
                <span style={{padding:'4px 12px',borderRadius:100,background:'rgba(255,255,255,0.07)',fontSize:12,color:'rgba(255,255,255,0.6)'}}>📦 {detail.condition}</span>
                <span style={{padding:'4px 12px',borderRadius:100,background:'rgba(255,255,255,0.07)',fontSize:12,color:'rgba(255,255,255,0.6)'}}>{detail.category}</span>
                {detail.location && <span style={{padding:'4px 12px',borderRadius:100,background:'rgba(255,255,255,0.07)',fontSize:12,color:'rgba(255,255,255,0.6)'}}>📍 {detail.location}</span>}
              </div>
              {detail.description && <div style={{fontSize:14,color:'rgba(255,255,255,0.75)',lineHeight:1.6,marginBottom:16}}>{detail.description}</div>}
              {/* Seller */}
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 0',borderTop:'1px solid rgba(255,255,255,0.08)',marginBottom:16}}>
                <Av name={detail.sellerName} avatar={detail.sellerAvatar}/>
                <div><div style={{fontWeight:800,fontSize:13,color:'#fff'}}>{detail.sellerName}</div><div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>Продавец</div></div>
              </div>
              <div style={{display:'flex',gap:10}}>
                {detail.sellerHash !== myHash && !detail.sold && (
                  <motion.button whileTap={{scale:0.96}} onClick={()=>{onOpenChat?.(detail.sellerHash,detail.sellerName);setDetail(null);}}
                    style={{flex:1,padding:14,borderRadius:14,border:'none',background:'linear-gradient(135deg,#7c3aed,#db2777)',color:'#fff',fontWeight:800,fontSize:15,cursor:'pointer',fontFamily:'"Montserrat",sans-serif'}}>
                    💬 Написать продавцу
                  </motion.button>
                )}
                {detail.sellerHash === myHash && !detail.sold && (
                  <>
                    <motion.button whileTap={{scale:0.96}} onClick={()=>markSold(detail.id)}
                      style={{flex:1,padding:14,borderRadius:14,border:'1px solid rgba(34,197,94,0.4)',background:'rgba(34,197,94,0.1)',color:'#4ade80',fontWeight:800,fontSize:14,cursor:'pointer',fontFamily:'"Montserrat",sans-serif'}}>
                      ✓ Продано
                    </motion.button>
                    <motion.button whileTap={{scale:0.96}} onClick={()=>del(detail.id)}
                      style={{padding:'14px 16px',borderRadius:14,border:'1px solid rgba(239,68,68,0.3)',background:'rgba(239,68,68,0.1)',color:'#f87171',cursor:'pointer',fontWeight:800,fontSize:14,fontFamily:'"Montserrat",sans-serif'}}>
                      Удалить
                    </motion.button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setShowCreate(false)} style={{position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(8px)'}}/>
            <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',stiffness:360,damping:34}}
              style={{position:'fixed',bottom:0,left:0,right:0,zIndex:301,background:'#0f0f1a',borderRadius:'24px 24px 0 0',maxHeight:'92dvh',overflowY:'auto',padding:'20px 20px calc(32px + env(safe-area-inset-bottom,0px))'}}>
              <div style={{width:40,height:4,background:'rgba(255,255,255,0.15)',borderRadius:99,margin:'0 auto 20px'}}/>
              <div style={{fontWeight:900,fontSize:17,color:'#fff',marginBottom:16}}>🛍️ Новое объявление</div>
              {/* Photos */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:6,fontWeight:700}}>ФОТОГРАФИИ (до 8)</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {formImages.map((u,i)=>(
                    <div key={i} style={{position:'relative',width:70,height:70}}>
                      <img src={u} style={{width:70,height:70,objectFit:'cover',borderRadius:10,border:'1px solid rgba(255,255,255,0.1)'}}/>
                      <button onClick={()=>setFormImages(p=>p.filter((_,j)=>j!==i))} style={{position:'absolute',top:-4,right:-4,width:18,height:18,borderRadius:'50%',background:'#ef4444',border:'none',color:'#fff',cursor:'pointer',fontSize:10,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                    </div>
                  ))}
                  {formImages.length < 8 && (
                    <>
                      <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)uploadImg(f);}}/>
                      <button onClick={()=>fileRef.current?.click()} style={{width:70,height:70,borderRadius:10,border:'2px dashed rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.03)',color:'rgba(255,255,255,0.4)',fontSize:24,cursor:'pointer'}}>+</button>
                    </>
                  )}
                </div>
              </div>
              {[
                {label:'НАЗВАНИЕ',key:'title',placeholder:'Что продаёшь?',type:'text'},
                {label:'ЦЕНА (₽)',key:'price',placeholder:'0 = бесплатно',type:'number'},
                {label:'ГОРОД',key:'location',placeholder:'Москва, онлайн...',type:'text'},
              ].map(f=>(
                <div key={f.key} style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:5,fontWeight:700}}>{f.label}</div>
                  <input type={f.type} value={(form as any)[f.key]} placeholder={f.placeholder} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                    style={{width:'100%',padding:'12px 14px',borderRadius:12,border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.06)',color:'#fff',fontSize:14,fontFamily:'"Montserrat",sans-serif',outline:'none',boxSizing:'border-box'}}/>
                </div>
              ))}
              <div style={{marginBottom:12}}>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:5,fontWeight:700}}>ОПИСАНИЕ</div>
                <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} placeholder="Подробное описание..." rows={3}
                  style={{width:'100%',padding:'12px 14px',borderRadius:12,border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.06)',color:'#fff',fontSize:14,fontFamily:'"Montserrat",sans-serif',outline:'none',resize:'none',boxSizing:'border-box'}}/>
              </div>
              <div style={{display:'flex',gap:10,marginBottom:14}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:5,fontWeight:700}}>КАТЕГОРИЯ</div>
                  <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))}
                    style={{width:'100%',padding:'11px 14px',borderRadius:12,border:'1px solid rgba(255,255,255,0.15)',background:'#1a1a2a',color:'#fff',fontSize:13,fontFamily:'"Montserrat",sans-serif',outline:'none'}}>
                    {CATEGORIES.filter(c=>c!=='Все').map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:5,fontWeight:700}}>СОСТОЯНИЕ</div>
                  <select value={form.condition} onChange={e=>setForm(p=>({...p,condition:e.target.value}))}
                    style={{width:'100%',padding:'11px 14px',borderRadius:12,border:'1px solid rgba(255,255,255,0.15)',background:'#1a1a2a',color:'#fff',fontSize:13,fontFamily:'"Montserrat",sans-serif',outline:'none'}}>
                    {CONDITIONS.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <motion.button whileTap={{scale:0.96}} onClick={create} disabled={creating||!form.title.trim()}
                style={{width:'100%',padding:14,borderRadius:14,border:'none',background:!form.title.trim()?'rgba(124,58,237,0.3)':'linear-gradient(135deg,#7c3aed,#db2777)',color:'#fff',fontWeight:800,fontSize:15,cursor:'pointer',fontFamily:'"Montserrat",sans-serif'}}>
                {creating?'Публикую...':'🛍️ Опубликовать'}
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
