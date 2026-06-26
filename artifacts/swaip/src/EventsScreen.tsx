import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackHandler } from './backHandler';

const API = window.location.origin;
const getST = () => { try { return localStorage.getItem('swaip_session') || ''; } catch { return ''; } };

interface SwaipEvent {
  id: string; hostHash: string; hostName: string; hostAvatar: string;
  title: string; description: string; date: string; location: string;
  maxAttendees: number; attendeeCount: number;
  attendees: { hash: string; name: string; avatar: string }[];
  createdAt: number; imageUrl?: string;
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function Av({ name, avatar, size = 36 }: { name: string; avatar?: string; size?: number }) {
  const colors = ['#7c3aed','#db2777','#059669','#d97706','#2563eb','#dc2626'];
  const col = colors[(name.charCodeAt(0)||0)%colors.length];
  if (avatar) return <img src={avatar} style={{width:size,height:size,borderRadius:'50%',objectFit:'cover',flexShrink:0}}/>;
  return <div style={{width:size,height:size,borderRadius:'50%',background:col,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:size*0.4,fontWeight:800,color:'#fff',fontFamily:'"Montserrat",sans-serif'}}>{name[0]?.toUpperCase()||'?'}</div>;
}

export default function EventsScreen({ myHash, onBack }: { myHash: string; onBack: () => void }) {
  const [events, setEvents] = useState<SwaipEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<SwaipEvent | null>(null);
  const [attending, setAttending] = useState<Set<string>>(new Set());
  const [form, setForm] = useState({ title: '', description: '', date: '', location: '', maxAttendees: '100' });
  const [creating, setCreating] = useState(false);

  useBackHandler(detail ? () => setDetail(null) : showCreate ? () => setShowCreate(false) : onBack);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/events`);
      const d = await r.json();
      setEvents(d.events || []);
      const att = new Set<string>();
      (d.events || []).forEach((e: SwaipEvent) => { if (e.attendees?.find(a => a.hash === myHash)) att.add(e.id); });
      setAttending(att);
    } catch { /* */ }
    setLoading(false);
  }, [myHash]);

  useEffect(() => { load(); }, [load]);

  const attend = async (id: string) => {
    const going = attending.has(id);
    setAttending(prev => { const n = new Set(prev); going ? n.delete(id) : n.add(id); return n; });
    setEvents(prev => prev.map(e => e.id !== id ? e : {
      ...e, attendeeCount: going ? e.attendeeCount - 1 : e.attendeeCount + 1,
    }));
    await fetch(`${API}/api/events/${id}/attend`, {
      method: going ? 'DELETE' : 'POST',
      headers: { 'x-session-token': getST() },
    }).catch(() => {});
    if (detail?.id === id) setDetail(prev => prev ? { ...prev, attendeeCount: going ? prev.attendeeCount - 1 : prev.attendeeCount + 1 } : prev);
  };

  const create = async () => {
    if (!form.title.trim() || !form.date) return;
    setCreating(true);
    try {
      const r = await fetch(`${API}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': getST() },
        body: JSON.stringify({ ...form, maxAttendees: parseInt(form.maxAttendees) || 100 }),
      });
      const d = await r.json();
      if (d.success) {
        setEvents(prev => [d.event, ...prev]);
        setAttending(prev => new Set([...prev, d.event.id]));
        setShowCreate(false);
        setForm({ title: '', description: '', date: '', location: '', maxAttendees: '100' });
      }
    } catch { /* */ }
    setCreating(false);
  };

  const delEvent = async (id: string) => {
    await fetch(`${API}/api/events/${id}`, { method: 'DELETE', headers: { 'x-session-token': getST() } }).catch(() => {});
    setEvents(prev => prev.filter(e => e.id !== id));
    if (detail?.id === id) setDetail(null);
  };

  const CATS = ['Все','🎵 Концерт','🎮 Gaming','🎨 Творчество','🏃 Спорт','💼 Бизнес','🎭 Театр','🍕 Еда','📚 Обучение','🎉 Вечеринка','🌿 Другое'];
  const [activeCat, setActiveCat] = useState('Все');
  const filtered = activeCat === 'Все' ? events : events.filter(e => e.title?.startsWith(activeCat.split(' ').slice(1).join(' ')) || e.description?.includes(activeCat));

  return (
    <div style={{position:'fixed',inset:0,background:'#05050c',display:'flex',flexDirection:'column',fontFamily:'"Montserrat",sans-serif',zIndex:500}}>
      {/* Header */}
      <div style={{background:'rgba(8,8,18,0.98)',backdropFilter:'blur(20px)',position:'sticky',top:0,zIndex:10,borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'48px 16px 12px'}}>
          <motion.button whileTap={{scale:0.9}} onClick={onBack} style={{width:40,height:40,borderRadius:'50%',border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.06)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,color:'#fff'}}>←</motion.button>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontWeight:900,fontSize:18,color:'#fff'}}>📅 Мероприятия</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>Создавай события — зови друзей</div>
          </div>
          <motion.button whileTap={{scale:0.92}} onClick={()=>setShowCreate(true)} style={{padding:'8px 14px',borderRadius:100,border:'none',background:'linear-gradient(135deg,#7c3aed,#db2777)',color:'#fff',fontWeight:800,fontSize:12,cursor:'pointer',fontFamily:'"Montserrat",sans-serif',flexShrink:0}}>+ Создать</motion.button>
        </div>
        {/* Category filter */}
        <div style={{display:'flex',gap:6,overflowX:'auto',overflowY:'hidden',padding:'0 16px 10px',scrollbarWidth:'none',WebkitOverflowScrolling:'touch' as any}}>
          {CATS.map(c=>(
            <motion.button key={c} whileTap={{scale:0.92}} onClick={()=>setActiveCat(c)}
              style={{padding:'5px 12px',borderRadius:100,border:'none',cursor:'pointer',fontWeight:700,fontSize:11,fontFamily:'"Montserrat",sans-serif',flexShrink:0,whiteSpace:'nowrap',
                background:activeCat===c?'linear-gradient(135deg,#7c3aed,#db2777)':'rgba(255,255,255,0.07)',
                color:activeCat===c?'#fff':'rgba(255,255,255,0.6)'}}>
              {c}
            </motion.button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{flex:1,overflowY:'auto',padding:'12px 16px 80px'}}>
        {(filtered.length===0&&!loading)&&events.length>0&&<div style={{textAlign:'center',padding:40,color:'rgba(255,255,255,0.4)',fontSize:13}}>Нет событий в этой категории</div>}
        {loading ? <div style={{textAlign:'center',padding:40,color:'rgba(255,255,255,0.3)',fontSize:14}}>Загружаю...</div>
        : events.length === 0 ? (
          <div style={{textAlign:'center',padding:60}}>
            <div style={{fontSize:52,marginBottom:12}}>📅</div>
            <div style={{fontWeight:800,fontSize:16,color:'#fff',marginBottom:6}}>Нет предстоящих событий</div>
            <div style={{fontSize:13,color:'rgba(255,255,255,0.4)'}}>Создай первое мероприятие!</div>
          </div>
        ) : filtered.map(ev => {
          const isPast = new Date(ev.date).getTime() < Date.now();
          const isGoing = attending.has(ev.id);
          return (
            <motion.div key={ev.id} whileTap={{scale:0.98}} onClick={()=>setDetail(ev)}
              style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${isGoing?'rgba(124,58,237,0.4)':'rgba(255,255,255,0.08)'}`,borderRadius:18,padding:16,marginBottom:10,cursor:'pointer'}}>
              {ev.imageUrl && <img src={ev.imageUrl} style={{width:'100%',height:140,objectFit:'cover',borderRadius:12,marginBottom:12}}/>}
              <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                <div style={{width:52,height:52,borderRadius:14,background:'linear-gradient(135deg,#1a0a3a,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,flexShrink:0}}>📅</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:800,fontSize:15,color:'#fff',marginBottom:3}}>{ev.title}</div>
                  <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',marginBottom:4}}>📆 {fmtDate(ev.date)}</div>
                  {ev.location && <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',marginBottom:4}}>📍 {ev.location}</div>}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginTop:6}}>
                    <div style={{fontSize:11,color:'rgba(255,255,255,0.35)'}}>👥 {ev.attendeeCount} / {ev.maxAttendees}</div>
                    <motion.button whileTap={{scale:0.92}} onClick={e=>{e.stopPropagation();attend(ev.id);}}
                      style={{padding:'6px 14px',borderRadius:100,border:'none',cursor:'pointer',fontWeight:800,fontSize:12,fontFamily:'"Montserrat",sans-serif',
                        background:isGoing?'rgba(255,255,255,0.1)':'linear-gradient(135deg,#7c3aed,#db2777)',color:'#fff',
                        opacity:isPast?0.4:1}}>
                      {isGoing?'✓ Иду':'Пойду'}
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {detail && (
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setDetail(null)} style={{position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(8px)'}}/>
            <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',stiffness:360,damping:34}}
              style={{position:'fixed',bottom:0,left:0,right:0,zIndex:301,background:'#0f0f1a',borderRadius:'24px 24px 0 0',maxHeight:'90dvh',overflowY:'auto',padding:'20px 20px calc(32px + env(safe-area-inset-bottom,0px))'}}>
              <div style={{width:40,height:4,background:'rgba(255,255,255,0.15)',borderRadius:99,margin:'0 auto 16px'}}/>
              {detail.imageUrl && <img src={detail.imageUrl} style={{width:'100%',height:180,objectFit:'cover',borderRadius:16,marginBottom:16}}/>}
              <div style={{fontWeight:900,fontSize:20,color:'#fff',marginBottom:8}}>{detail.title}</div>
              <div style={{fontSize:13,color:'rgba(255,255,255,0.6)',marginBottom:6}}>📆 {fmtDate(detail.date)}</div>
              {detail.location && <div style={{fontSize:13,color:'rgba(255,255,255,0.5)',marginBottom:12}}>📍 {detail.location}</div>}
              {detail.description && <div style={{fontSize:14,color:'rgba(255,255,255,0.8)',lineHeight:1.6,marginBottom:16}}>{detail.description}</div>}
              <div style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.5)',marginBottom:10}}>👥 УЧАСТНИКИ ({detail.attendeeCount})</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:20}}>
                {(detail.attendees||[]).slice(0,12).map(a=>(
                  <div key={a.hash} title={a.name}><Av name={a.name} avatar={a.avatar} size={36}/></div>
                ))}
              </div>
              <div style={{display:'flex',gap:10}}>
                <motion.button whileTap={{scale:0.96}} onClick={()=>attend(detail.id)}
                  style={{flex:1,padding:14,borderRadius:14,border:'none',cursor:'pointer',fontWeight:800,fontSize:15,fontFamily:'"Montserrat",sans-serif',
                    background:attending.has(detail.id)?'rgba(255,255,255,0.1)':'linear-gradient(135deg,#7c3aed,#db2777)',color:'#fff'}}>
                  {attending.has(detail.id)?'✓ Я иду':'📅 Пойду'}
                </motion.button>
                {detail.hostHash===myHash && (
                  <motion.button whileTap={{scale:0.96}} onClick={()=>delEvent(detail.id)}
                    style={{padding:'14px 18px',borderRadius:14,border:'1px solid rgba(255,80,80,0.3)',background:'rgba(255,50,50,0.1)',color:'#f87171',cursor:'pointer',fontWeight:800,fontSize:14,fontFamily:'"Montserrat",sans-serif'}}>
                    Удалить
                  </motion.button>
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
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setShowCreate(false)} style={{position:'fixed',inset:0,zIndex:300,background:'rgba(0,0,0,0.75)',backdropFilter:'blur(8px)'}}/>
            <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',stiffness:360,damping:34}}
              style={{position:'fixed',bottom:0,left:0,right:0,zIndex:301,background:'#0f0f1a',borderRadius:'24px 24px 0 0',maxHeight:'92dvh',overflowY:'auto',padding:'20px 20px calc(32px + env(safe-area-inset-bottom,0px))'}}>
              <div style={{width:40,height:4,background:'rgba(255,255,255,0.15)',borderRadius:99,margin:'0 auto 20px'}}/>
              <div style={{fontWeight:900,fontSize:17,color:'#fff',marginBottom:16}}>📅 Новое мероприятие</div>
              {[
                {label:'НАЗВАНИЕ',key:'title',placeholder:'Например: Встреча геймеров',type:'text'},
                {label:'ДАТА И ВРЕМЯ',key:'date',placeholder:'',type:'datetime-local'},
                {label:'МЕСТО',key:'location',placeholder:'Адрес или онлайн',type:'text'},
                {label:'МАКС. УЧАСТНИКОВ',key:'maxAttendees',placeholder:'100',type:'number'},
              ].map(f => (
                <div key={f.key} style={{marginBottom:12}}>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:5,fontWeight:700}}>{f.label}</div>
                  <input type={f.type} value={(form as any)[f.key]} placeholder={f.placeholder}
                    onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
                    style={{width:'100%',padding:'12px 14px',borderRadius:12,border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.06)',color:'#fff',fontSize:14,fontFamily:'"Montserrat",sans-serif',outline:'none',boxSizing:'border-box',colorScheme:'dark'}}/>
                </div>
              ))}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginBottom:5,fontWeight:700}}>ОПИСАНИЕ</div>
                <textarea value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}
                  placeholder="Расскажи о мероприятии..." rows={3}
                  style={{width:'100%',padding:'12px 14px',borderRadius:12,border:'1px solid rgba(255,255,255,0.15)',background:'rgba(255,255,255,0.06)',color:'#fff',fontSize:14,fontFamily:'"Montserrat",sans-serif',outline:'none',resize:'none',boxSizing:'border-box'}}/>
              </div>
              <motion.button whileTap={{scale:0.96}} onClick={create} disabled={creating||!form.title.trim()||!form.date}
                style={{width:'100%',padding:14,borderRadius:14,border:'none',background:(!form.title.trim()||!form.date)?'rgba(124,58,237,0.3)':'linear-gradient(135deg,#7c3aed,#db2777)',color:'#fff',fontWeight:800,fontSize:15,cursor:'pointer',fontFamily:'"Montserrat",sans-serif'}}>
                {creating?'Создаю...':'📅 Создать мероприятие'}
              </motion.button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
