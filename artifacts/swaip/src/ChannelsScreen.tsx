import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ══════════════════════════════════════════════════════
   ТИПЫ
══════════════════════════════════════════════════════ */
interface Reaction { fire:number; rocket:number; gem:number; heart:number; think:number; }
type ReactionKey = keyof Reaction;

interface ChannelPost {
  id: string;
  type: 'text'|'photo'|'video'|'audio'|'poll'|'announce'|'capsule'|'episode';
  text: string;
  imageUrl?: string;
  videoUrl?: string;
  audioUrl?: string;
  rubric?: string;
  reactions: Reaction;
  myReaction?: ReactionKey;
  createdAt: number;
  views: number;
  isPinned: boolean;
  isExclusive: boolean;
  /* poll */
  pollQuestion?: string;
  pollOptions?: { text:string; votes:number }[];
  pollVotedIdx?: number;
  /* announce */
  announceAt?: number;
  /* capsule */
  opensAt?: number;
  capsuleOpened?: boolean;
  /* episode */
  seriesName?: string;
  episodeNum?: number;
  /* booking */
  hasBooking?: boolean;
  bookingSlots?: number;
  bookingBooked?: number;
  bookingLabel?: string;
}

interface SwaipChannel {
  id: string;
  name: string;
  handle: string;
  description: string;
  vibe: string;
  vibeColor: string;
  coverGradient: string;
  coverPhotoUrl?: string;
  coverPosition?: string;
  avatarPhotoUrl?: string;
  category: string;
  tags: string[];
  subscribers: number;
  posts: ChannelPost[];
  pinnedPostId: string|null;
  createdAt: number;
  rubrics: string[];
  energyLevel: number;
  isVerified: boolean;
  pulse: string;
  authorName: string;
  authorAvatar?: string;
}

/* ══════════════════════════════════════════════════════
   КОНСТАНТЫ
══════════════════════════════════════════════════════ */
const CHANNEL_GRADIENTS = [
  { bg:'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', label:'Космос' },
  { bg:'linear-gradient(135deg,#000428,#004e92)',          label:'Океан' },
  { bg:'linear-gradient(135deg,#2d1b69,#11998e)',          label:'Аврора' },
  { bg:'linear-gradient(135deg,#2c003e,#8a0e8a)',          label:'Пурпур' },
  { bg:'linear-gradient(135deg,#0a0a0f,#1a0a3a,#3a0060)', label:'SWAIP' },
  { bg:'linear-gradient(135deg,#0d0d0d,#003322,#005533)', label:'Матрица' },
  { bg:'linear-gradient(135deg,#3d0000,#6b0000,#3d0000)', label:'Рубин' },
  { bg:'linear-gradient(135deg,#1a0f00,#5c3a00,#a06000)', label:'Янтарь' },
  { bg:'linear-gradient(135deg,#003050,#006090,#00a0c0)', label:'Лёд' },
  { bg:'linear-gradient(135deg,#1a2a00,#4a7000,#2a5000)', label:'Джунгли' },
  { bg:'linear-gradient(135deg,#200000,#600020,#200040)', label:'Закат' },
  { bg:'linear-gradient(135deg,#001030,#002060,#003090)', label:'Сапфир' },
];

const CHANNEL_VIBES = [
  { emoji:'🔥', color:'#f97316', label:'Горим' },
  { emoji:'💎', color:'#60a5fa', label:'Премиум' },
  { emoji:'🚀', color:'#a855f7', label:'Прорыв' },
  { emoji:'🌊', color:'#06b6d4', label:'Поток' },
  { emoji:'⚡', color:'#fbbf24', label:'Энергия' },
  { emoji:'🎯', color:'#22c55e', label:'Точность' },
  { emoji:'🌟', color:'#f59e0b', label:'Звезда' },
  { emoji:'🎭', color:'#ec4899', label:'Арт' },
  { emoji:'🧠', color:'#8b5cf6', label:'Мысль' },
  { emoji:'🎪', color:'#f43f5e', label:'Шоу' },
];

const CHANNEL_CATEGORIES = [
  { id:'tech',     emoji:'💻', label:'Технологии' },
  { id:'art',      emoji:'🎨', label:'Искусство' },
  { id:'music',    emoji:'🎵', label:'Музыка' },
  { id:'business', emoji:'💼', label:'Бизнес' },
  { id:'lifestyle',emoji:'✨', label:'Лайфстайл' },
  { id:'humor',    emoji:'😂', label:'Юмор' },
  { id:'science',  emoji:'🔬', label:'Наука' },
  { id:'sport',    emoji:'⚽', label:'Спорт' },
  { id:'travel',   emoji:'✈️', label:'Путешествия' },
  { id:'food',     emoji:'🍳', label:'Еда' },
  { id:'film',     emoji:'🎬', label:'Кино' },
  { id:'fashion',  emoji:'👗', label:'Мода' },
];

const REACTION_META: { key:ReactionKey; emoji:string; weight:number; label:string }[] = [
  { key:'fire',   emoji:'🔥', weight:3, label:'Огонь' },
  { key:'rocket', emoji:'🚀', weight:3, label:'Ракета' },
  { key:'gem',    emoji:'💎', weight:2, label:'Алмаз' },
  { key:'heart',  emoji:'❤️', weight:2, label:'Сердце' },
  { key:'think',  emoji:'🤔', weight:1, label:'Думаю' },
];

const SAMPLE_RUBRICS = ['📸 Фото дня','💡 Советы','🎬 Обзоры','🔥 Горячее','📊 Статистика','🎯 Лайфхаки','🌍 События'];

/* ══════════════════════════════════════════════════════
   УТИЛИТЫ
══════════════════════════════════════════════════════ */
function fmtNum(n:number):string { return n>=1000?`${(n/1000).toFixed(1)}K`:String(n); }
function fmtAge(ts:number):string {
  const s=Math.floor((Date.now()-ts)/1000);
  if(s<60)return'только что';if(s<3600)return`${Math.floor(s/60)}м`;
  if(s<86400)return`${Math.floor(s/3600)}ч`;return`${Math.floor(s/86400)}д`;
}
function fmtCountdown(ts:number):string {
  const s=Math.max(0,Math.floor((ts-Date.now())/1000));
  if(s<=0)return'Уже сейчас!';
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sc=s%60;
  if(h>24)return`${Math.floor(h/24)}д ${h%24}ч`;
  return`${h>0?h+'ч ':''} ${m}м ${sc}с`;
}
function calcPostScore(r:Reaction):number {
  return r.fire*3+r.rocket*3+r.gem*2+r.heart*2+r.think*1;
}
function uid():string { return Math.random().toString(36).slice(2,10); }

/* ══════════════════════════════════════════════════════
   ХРАНИЛИЩЕ
══════════════════════════════════════════════════════ */
function useChannelsStore(userHash:string):[SwaipChannel[],React.Dispatch<React.SetStateAction<SwaipChannel[]>>] {
  const KEY=`swaip_account_${userHash}_channels_v2`;
  const [channels,setChannelsRaw]=useState<SwaipChannel[]>(()=>{
    try{ const s=localStorage.getItem(KEY); return s?JSON.parse(s):[]; }catch{ return []; }
  });
  const setChannels:React.Dispatch<React.SetStateAction<SwaipChannel[]>>=(action)=>{
    setChannelsRaw(prev=>{
      const next=typeof action==='function'?(action as (p:SwaipChannel[])=>SwaipChannel[])(prev):action;
      try{ localStorage.setItem(KEY,JSON.stringify(next)); }catch{}
      return next;
    });
  };
  return [channels,setChannels];
}

/* ══════════════════════════════════════════════════════
   ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ
══════════════════════════════════════════════════════ */

/* Аватар канала */
function ChanAvatar({ch,size=44,onClick}:{ch:SwaipChannel;size?:number;onClick?:()=>void}) {
  const photo=ch.avatarPhotoUrl||ch.coverPhotoUrl;
  return (
    <div onClick={onClick} style={{width:size,height:size,borderRadius:'50%',overflow:'hidden',flexShrink:0,
      background:ch.coverGradient,display:'flex',alignItems:'center',justifyContent:'center',
      fontSize:size*0.42,border:'2px solid rgba(255,255,255,0.15)',position:'relative',
      cursor:onClick?'pointer':'default'}}>
      {photo
        ?<img src={photo} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
        :<span>{ch.vibe}</span>}
      {ch.isVerified&&<span style={{position:'absolute',bottom:-2,right:-2,
        background:'#1d4ed8',borderRadius:'50%',width:size*0.38,height:size*0.38,
        display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.max(8,size*0.25)}}>✓</span>}
    </div>
  );
}

/* Пульс-индикатор канала */
function PulseBar({energy,color}:{energy:number;color:string}) {
  return (
    <div style={{height:3,background:'rgba(255,255,255,0.1)',borderRadius:2,overflow:'hidden'}}>
      <motion.div initial={{width:0}} animate={{width:`${energy}%`}}
        transition={{duration:1.2,ease:'easeOut'}}
        style={{height:'100%',background:`linear-gradient(90deg,${color}88,${color})`,borderRadius:2}}/>
    </div>
  );
}

/* Таймер обратного отсчёта */
function CountdownTimer({ts,label}:{ts:number;label?:string}) {
  const [text,setText]=useState(fmtCountdown(ts));
  useEffect(()=>{
    const t=setInterval(()=>setText(fmtCountdown(ts)),1000);
    return()=>clearInterval(t);
  },[ts]);
  return (
    <div style={{display:'flex',alignItems:'center',gap:6,padding:'8px 14px',
      background:'rgba(251,191,36,0.12)',borderRadius:10,border:'1px solid rgba(251,191,36,0.3)'}}>
      <span style={{fontSize:16}}>⏳</span>
      <div>
        {label&&<p style={{margin:0,fontSize:11,color:'rgba(251,191,36,0.7)',fontWeight:600}}>{label}</p>}
        <p style={{margin:0,fontSize:14,color:'#fbbf24',fontWeight:800,fontVariantNumeric:'tabular-nums'}}>{text}</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ГЛАВНЫЙ КОМПОНЕНТ
══════════════════════════════════════════════════════ */
interface Props {
  userHash: string;
  isDark: boolean;
  c: { bg:string; card:string; cardAlt:string; border:string; light:string; mid:string; sub:string; };
  accent: string;
  userName: string;
  userAvatar?: string;
  isActive: boolean;
  onBack?: ()=>void;
}

export default function ChannelsScreen({ userHash, isDark, c, accent, userName, userAvatar, isActive }: Props) {
  const [channels, setChannels] = useChannelsStore(userHash);
  const [openId, setOpenId] = useState<string|null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [activeRubric, setActiveRubric] = useState<string|null>(null);
  const [tick, setTick] = useState(0); // для обновления таймеров

  /* обновляем таймеры */
  useEffect(()=>{
    const t=setInterval(()=>setTick(n=>n+1),1000);
    return()=>clearInterval(t);
  },[]);

  const openCh = channels.find(c=>c.id===openId)||null;

  /* Обработчик кнопки назад */
  useEffect(()=>{
    if(!isActive)return;
    const handler=(e:PopStateEvent)=>{ e.preventDefault(); if(openId)setOpenId(null); };
    window.addEventListener('popstate',handler);
    return()=>window.removeEventListener('popstate',handler);
  },[isActive,openId]);

  /* ── Мутации ── */
  const reactToPost=(chId:string,postId:string,key:ReactionKey)=>{
    setChannels(cs=>cs.map(ch=>ch.id!==chId?ch:{...ch,posts:ch.posts.map(p=>{
      if(p.id!==postId)return p;
      const already=p.myReaction===key;
      const r={...p.reactions};
      if(!already){ r[key]=(r[key]||0)+1; if(p.myReaction)r[p.myReaction]=Math.max(0,r[p.myReaction]-1); }
      else { r[key]=Math.max(0,r[key]-1); }
      return{...p,reactions:r,myReaction:already?undefined:key};
    })}));
  };

  const voteInPoll=(chId:string,postId:string,idx:number)=>{
    setChannels(cs=>cs.map(ch=>ch.id!==chId?ch:{...ch,posts:ch.posts.map(p=>{
      if(p.id!==postId||p.pollVotedIdx!==undefined)return p;
      const opts=(p.pollOptions||[]).map((o,i)=>i===idx?{...o,votes:o.votes+1}:o);
      return{...p,pollOptions:opts,pollVotedIdx:idx};
    })}));
  };

  const openCapsule=(chId:string,postId:string)=>{
    setChannels(cs=>cs.map(ch=>ch.id!==chId?ch:{...ch,posts:ch.posts.map(p=>
      p.id===postId?{...p,capsuleOpened:true}:p
    )}));
  };

  const pinPost=(chId:string,postId:string)=>{
    setChannels(cs=>cs.map(ch=>ch.id!==chId?ch:{...ch,
      pinnedPostId:ch.pinnedPostId===postId?null:postId}));
  };

  const deletePost=(chId:string,postId:string)=>{
    setChannels(cs=>cs.map(ch=>ch.id!==chId?ch:{...ch,
      posts:ch.posts.filter(p=>p.id!==postId),
      pinnedPostId:ch.pinnedPostId===postId?null:ch.pinnedPostId}));
  };

  const updateChannel=(chId:string,patch:Partial<SwaipChannel>)=>{
    setChannels(cs=>cs.map(ch=>ch.id!==chId?ch:{...ch,...patch}));
  };

  const bookPost=(chId:string,postId:string)=>{
    setChannels(cs=>cs.map(ch=>ch.id!==chId?ch:{...ch,posts:ch.posts.map(p=>
      p.id!==postId||!p.hasBooking||(p.bookingSlots!==undefined&&(p.bookingBooked||0)>=p.bookingSlots)?p
      :{...p,bookingBooked:(p.bookingBooked||0)+1}
    )}));
  };

  const editPostBooking=(chId:string,postId:string,patch:{bookingSlots?:number;bookingLabel?:string;hasBooking?:boolean})=>{
    setChannels(cs=>cs.map(ch=>ch.id!==chId?ch:{...ch,posts:ch.posts.map(p=>
      p.id!==postId?p:{...p,...patch}
    )}));
  };

  /* ── Создание поста ── */
  const addPost=(chId:string,post:Omit<ChannelPost,'id'|'reactions'|'views'|'createdAt'|'isPinned'>)=>{
    const newPost:ChannelPost={
      ...post,id:uid(),reactions:{fire:0,rocket:0,gem:0,heart:0,think:0},
      views:0,createdAt:Date.now(),isPinned:false
    };
    setChannels(cs=>cs.map(ch=>ch.id!==chId?ch:{...ch,posts:[newPost,...ch.posts]}));
  };

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:c.bg,overflowY:'auto',
      paddingBottom:80}}>

      {/* ── Горизонтальная лента каналов ── */}
      <HorizontalStrip channels={channels} openId={openId} onOpen={setOpenId}
        onCreateNew={()=>setShowCreate(true)} c={c} accent={accent}/>

      {/* ── Контент ── */}
      {!openId?(
        <ChannelsFeed channels={channels} c={c} accent={accent} onOpen={setOpenId}/>
      ):(
        openCh&&(
          <ChannelPage ch={openCh} c={c} accent={accent} isDark={isDark}
            onBack={()=>setOpenId(null)}
            onReact={reactToPost} onVote={voteInPoll}
            onOpenCapsule={openCapsule} onPin={pinPost} onDelete={deletePost}
            onUpdate={(patch)=>updateChannel(openCh.id,patch)}
            onBook={(postId)=>bookPost(openCh.id,postId)}
            onEditBooking={(postId,patch)=>editPostBooking(openCh.id,postId,patch)}
            activeRubric={activeRubric} onRubric={setActiveRubric}
            onCompose={()=>setShowCompose(true)}
            onAddPost={addPost} tick={tick}/>
        )
      )}

      {/* ── Создание канала ── */}
      <AnimatePresence>
        {showCreate&&(
          <CreateChannelModal c={c} accent={accent} isDark={isDark}
            userName={userName} userAvatar={userAvatar}
            onClose={()=>setShowCreate(false)}
            onCreate={(ch)=>{ setChannels(cs=>[ch,...cs]); setShowCreate(false); setOpenId(ch.id); }}/>
        )}
      </AnimatePresence>

    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ГОРИЗОНТАЛЬНАЯ ЛЕНТА
══════════════════════════════════════════════════════ */
function HorizontalStrip({channels,openId,onOpen,onCreateNew,c,accent}:{
  channels:SwaipChannel[];openId:string|null;
  onOpen:(id:string)=>void;onCreateNew:()=>void;
  c:Props['c'];accent:string;
}) {
  return (
    <div style={{padding:'14px 0 10px',borderBottom:`1px solid ${c.border}`}}>
      <div style={{display:'flex',gap:14,overflowX:'auto',padding:'2px 16px 6px',scrollbarWidth:'none'}}>

        {/* Кнопка создать */}
        <motion.button whileTap={{scale:0.9}} onClick={onCreateNew}
          style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:5,
            background:'none',border:'none',cursor:'pointer'}}>
          <div style={{width:52,height:52,borderRadius:'50%',border:`2px dashed ${accent}`,
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,
            background:`${accent}18`}}>+</div>
          <span style={{fontSize:10,color:accent,fontWeight:700,whiteSpace:'nowrap'}}>Создать</span>
        </motion.button>

        {channels.map(ch=>(
          <motion.button key={ch.id} whileTap={{scale:0.9}} onClick={()=>onOpen(ch.id)}
            style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:5,
              background:'none',border:'none',cursor:'pointer'}}>
            <div style={{position:'relative'}}>
              <div style={{width:52,height:52,borderRadius:'50%',overflow:'hidden',
                background:ch.coverGradient,display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:24,border:openId===ch.id?`2.5px solid ${accent}`:'2px solid rgba(255,255,255,0.15)',
                boxShadow:openId===ch.id?`0 0 10px ${accent}66`:'none'}}>
                {ch.coverPhotoUrl
                  ?<img src={ch.coverPhotoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  :<span>{ch.vibe}</span>}
              </div>
              {/* Пульс-кольцо */}
              {ch.energyLevel>60&&(
                <motion.div animate={{scale:[1,1.15,1],opacity:[0.7,0.3,0.7]}}
                  transition={{repeat:Infinity,duration:2}}
                  style={{position:'absolute',inset:-3,borderRadius:'50%',
                    border:`1.5px solid ${ch.vibeColor}`,pointerEvents:'none'}}/>
              )}
            </div>
            <span style={{fontSize:10,color:openId===ch.id?accent:c.mid,fontWeight:openId===ch.id?800:600,
              whiteSpace:'nowrap',maxWidth:60,overflow:'hidden',textOverflow:'ellipsis'}}>
              {ch.name}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ЛЕНТА ВСЕХ КАНАЛОВ (если ни один не открыт)
══════════════════════════════════════════════════════ */
function ChannelsFeed({channels,c,accent,onOpen}:{
  channels:SwaipChannel[];c:Props['c'];accent:string;onOpen:(id:string)=>void;
}) {
  if(channels.length===0) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
      padding:'60px 32px',gap:16,textAlign:'center'}}>
      <div style={{fontSize:56}}>📡</div>
      <p style={{margin:0,fontSize:18,fontWeight:900,color:c.light}}>Твои каналы</p>
      <p style={{margin:0,fontSize:14,color:c.sub,lineHeight:1.6}}>
        Создавай каналы, выкладывай контент и собирай аудиторию.{'\n'}
        Это круче, чем Telegram — обещаем.
      </p>
      <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%',maxWidth:280,marginTop:8}}>
        {[
          '⏳ Временные капсулы — посты из будущего',
          '🎭 Рубрики — своя структура контента',
          '🚀 Взвешенные реакции — 🔥 = 3 балла',
          '📺 Серии/Эпизоды — сезонный контент',
          '⚡ Пульс канала — живая энергетика',
        ].map(f=>(
          <div key={f} style={{padding:'8px 12px',background:c.card,borderRadius:10,
            border:`1px solid ${c.border}`,textAlign:'left',fontSize:12,color:c.mid}}>{f}</div>
        ))}
      </div>
    </div>
  );

  /* Последние посты из всех каналов */
  type PostWithCh = { post:ChannelPost; ch:SwaipChannel };
  const allPosts:PostWithCh[] = channels.flatMap(ch=>ch.posts.map(post=>({post,ch})))
    .sort((a,b)=>b.post.createdAt-a.post.createdAt).slice(0,30);

  return (
    <div style={{padding:'12px 16px'}}>
      <p style={{margin:'0 0 12px',fontSize:12,color:c.sub,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase'}}>
        Последнее в каналах
      </p>
      {allPosts.map(({post,ch})=>(
        <FeedPostPreview key={post.id} post={post} ch={ch} c={c} accent={accent} onOpen={()=>onOpen(ch.id)}/>
      ))}
    </div>
  );
}

function FeedPostPreview({post,ch,c,accent,onOpen}:{post:ChannelPost;ch:SwaipChannel;c:Props['c'];accent:string;onOpen:()=>void}) {
  const score=calcPostScore(post.reactions);
  return (
    <motion.div whileTap={{scale:0.98}} onClick={onOpen}
      style={{background:c.card,borderRadius:14,padding:'12px 14px',marginBottom:10,cursor:'pointer',
        border:`1px solid ${ch.pinnedPostId===post.id?'rgba(234,179,8,0.4)':c.border}`}}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
        <div style={{width:28,height:28,borderRadius:'50%',background:ch.coverGradient,
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>
          {ch.vibe}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <span style={{fontSize:13,fontWeight:800,color:c.light,display:'block',
            overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {ch.name}
            {ch.isVerified&&<span style={{marginLeft:4,color:'#60a5fa',fontSize:11}}>✓</span>}
          </span>
          <span style={{fontSize:10,color:c.sub}}>{fmtAge(post.createdAt)}</span>
        </div>
        {post.rubric&&(
          <span style={{fontSize:10,color:accent,background:`${accent}18`,borderRadius:6,padding:'2px 7px',fontWeight:700,whiteSpace:'nowrap'}}>
            {post.rubric}
          </span>
        )}
      </div>
      {post.text&&<p style={{margin:'0 0 8px',fontSize:14,color:c.mid,lineHeight:1.5,
        display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
        {post.text}
      </p>}
      {post.imageUrl&&<img src={post.imageUrl} alt="" style={{width:'100%',height:120,objectFit:'cover',borderRadius:10,marginBottom:8}}/>}
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <span style={{fontSize:11,color:c.sub}}>👁 {fmtNum(post.views+Math.floor(Math.random()*50))}</span>
        {score>0&&<span style={{fontSize:11,color:ch.vibeColor,fontWeight:700}}>⚡ {score}пт</span>}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════
   СТРАНИЦА КАНАЛА
══════════════════════════════════════════════════════ */
function ChannelPage({ch,c,accent,isDark,onBack,onReact,onVote,onOpenCapsule,onPin,onDelete,onUpdate,onBook,onEditBooking,activeRubric,onRubric,onCompose,onAddPost,tick}:{
  ch:SwaipChannel;c:Props['c'];accent:string;isDark:boolean;
  onBack:()=>void;
  onReact:(chId:string,postId:string,key:ReactionKey)=>void;
  onVote:(chId:string,postId:string,idx:number)=>void;
  onOpenCapsule:(chId:string,postId:string)=>void;
  onPin:(chId:string,postId:string)=>void;
  onDelete:(chId:string,postId:string)=>void;
  onUpdate:(patch:Partial<SwaipChannel>)=>void;
  onBook:(postId:string)=>void;
  onEditBooking:(postId:string,patch:{bookingSlots?:number;bookingLabel?:string;hasBooking?:boolean})=>void;
  activeRubric:string|null;onRubric:(r:string|null)=>void;
  onCompose:()=>void;
  onAddPost:(chId:string,post:Omit<ChannelPost,'id'|'reactions'|'views'|'createdAt'|'isPinned'>)=>void;
  tick:number;
}) {
  const [showCompose,setShowCompose]=useState(false);
  const [coverUploading,setCoverUploading]=useState(false);
  const [avatarUploading,setAvatarUploading]=useState(false);
  const coverFileRef=useRef<HTMLInputElement>(null);
  const avatarFileRef=useRef<HTMLInputElement>(null);
  const cat=CHANNEL_CATEGORIES.find(x=>x.id===ch.category);

  /* ── Кроп обложки ── */
  const [showCoverCrop,setShowCoverCrop]=useState(false);
  const [coverCropSrc,setCoverCropSrc]=useState('');
  const [coverCropFinal,setCoverCropFinal]=useState('');
  const [cropY,setCropY]=useState(50);

  const openCoverCrop=(f:File)=>{
    const local=URL.createObjectURL(f);
    const curY=parseInt((ch.coverPosition||'50% 50%').split(' ')[1]||'50');
    setCropY(curY);
    setCoverCropSrc(local);
    setCoverCropFinal('');
    setShowCoverCrop(true);
    /* Фоновая загрузка на сервер */
    setCoverUploading(true);
    fetch(`${window.location.origin}/api/image-upload`,{
      method:'POST',headers:{'Content-Type':f.type},body:f})
      .then(r=>r.ok?r.json():null)
      .then(d=>{if(d?.url)setCoverCropFinal(d.url);})
      .catch(()=>{})
      .finally(()=>setCoverUploading(false));
  };

  const applyCoverCrop=()=>{
    onUpdate({coverPhotoUrl:coverCropFinal||coverCropSrc, coverPosition:`50% ${cropY}%`});
    setShowCoverCrop(false);
  };

  const uploadAvatar=async(f:File)=>{
    const local=URL.createObjectURL(f);
    onUpdate({avatarPhotoUrl:local});
    setAvatarUploading(true);
    try{
      const r=await fetch(`${window.location.origin}/api/image-upload`,{
        method:'POST',headers:{'Content-Type':f.type},body:f});
      if(r.ok){const{url}=await r.json();onUpdate({avatarPhotoUrl:url});}
    }catch{}finally{setAvatarUploading(false);}
  };

  const filteredPosts=activeRubric
    ?ch.posts.filter(p=>p.rubric===activeRubric)
    :ch.posts;

  /* Pinned сначала */
  const sortedPosts=[
    ...filteredPosts.filter(p=>p.id===ch.pinnedPostId),
    ...filteredPosts.filter(p=>p.id!==ch.pinnedPostId)
  ];

  return (
    <div style={{flex:1}}>
      {/* ── Шапка ── */}
      <div style={{position:'relative',height:160,overflow:'visible',background:ch.coverGradient}}>
        <div style={{position:'absolute',inset:0,overflow:'hidden'}}>
          {ch.coverPhotoUrl&&<img src={ch.coverPhotoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:ch.coverPosition||'50% 50%'}}/>}
          {/* Анимированный пульс-фон */}
          <motion.div animate={{opacity:[0.15,0.3,0.15]}} transition={{repeat:Infinity,duration:3}}
            style={{position:'absolute',inset:0,background:`radial-gradient(circle at 30% 50%,${ch.vibeColor}44,transparent 70%)`}}/>
          <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.75))'}}/>
        </div>

        <button onClick={onBack} style={{position:'absolute',top:14,left:14,zIndex:2,width:36,height:36,borderRadius:'50%',
          background:'rgba(0,0,0,0.4)',border:'1px solid rgba(255,255,255,0.2)',
          color:'#fff',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)'}}>
          ←
        </button>

        {/* Кнопки обложки */}
        <div style={{position:'absolute',top:14,right:14,zIndex:2,display:'flex',gap:6}}>
          {ch.coverPhotoUrl&&<button onClick={()=>{
              const curY=parseInt((ch.coverPosition||'50% 50%').split(' ')[1]||'50');
              setCropY(curY);setCoverCropSrc(ch.coverPhotoUrl!);setCoverCropFinal(ch.coverPhotoUrl!);setShowCoverCrop(true);}}
            style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:20,
              background:'rgba(168,85,247,0.45)',border:'1px solid rgba(168,85,247,0.6)',
              color:'#fff',cursor:'pointer',backdropFilter:'blur(8px)',fontSize:11,fontWeight:700}}>
            📐 Фрагмент
          </button>}
          <button onClick={()=>coverFileRef.current?.click()}
            style={{display:'flex',alignItems:'center',gap:5,padding:'5px 10px',borderRadius:20,
              background:coverUploading?'rgba(0,0,0,0.6)':'rgba(0,0,0,0.45)',
              border:'1px solid rgba(255,255,255,0.2)',color:'#fff',cursor:'pointer',backdropFilter:'blur(8px)',
              fontSize:11,fontWeight:700}}>
            {coverUploading?<><motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:0.8,ease:'linear'}}
              style={{width:12,height:12,border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',borderRadius:'50%'}}/> …</>
              :<>🖼 Обложка</>}
          </button>
        </div>
        <input ref={coverFileRef} type="file" accept="image/*" style={{display:'none'}}
          onChange={e=>{const f=e.target.files?.[0];if(f)openCoverCrop(f);e.target.value='';}}/>

        {/* Скрытый input для аватара */}
        <input ref={avatarFileRef} type="file" accept="image/*" style={{display:'none'}}
          onChange={e=>{const f=e.target.files?.[0];if(f)uploadAvatar(f);e.target.value='';}}/>

        {/* Пульс-индикатор — теперь чуть левее */}
        <div style={{position:'absolute',bottom:52,right:14,zIndex:2,display:'flex',alignItems:'center',gap:6,
          background:'rgba(0,0,0,0.45)',borderRadius:20,padding:'4px 10px',backdropFilter:'blur(8px)'}}>
          <motion.div animate={{scale:[1,1.3,1]}} transition={{repeat:Infinity,duration:1.5}}
            style={{width:8,height:8,borderRadius:'50%',background:ch.vibeColor}}/>
          <span style={{fontSize:11,color:'#fff',fontWeight:700}}>ПУЛЬС {ch.energyLevel}%</span>
        </div>

        {/* Инфо */}
        <div style={{position:'absolute',bottom:12,left:14,right:14,zIndex:2}}>
          <div style={{display:'flex',alignItems:'flex-end',gap:10}}>
            {/* Аватар кликабелен */}
            <div style={{position:'relative',flexShrink:0}}>
              <ChanAvatar ch={ch} size={52} onClick={()=>avatarFileRef.current?.click()}/>
              {!avatarUploading&&<div style={{position:'absolute',bottom:-2,right:-2,
                width:18,height:18,borderRadius:'50%',background:accent,
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,cursor:'pointer'}}
                onClick={()=>avatarFileRef.current?.click()}>📷</div>}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <p style={{margin:0,fontSize:18,fontWeight:900,color:'#fff',lineHeight:1.1,
                textShadow:'0 2px 8px rgba(0,0,0,0.6)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                {ch.name}
                {ch.isVerified&&<span style={{marginLeft:6,fontSize:13,color:'#60a5fa'}}>✓</span>}
              </p>
              <p style={{margin:0,fontSize:11,color:'rgba(255,255,255,0.65)'}}>
                @{ch.handle} · {fmtNum(ch.subscribers)} подписчиков
                {cat&&<span style={{marginLeft:6}}>{cat.emoji} {cat.label}</span>}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Пульс-бар ── */}
      <div style={{padding:'8px 16px 0',background:c.card,borderBottom:`1px solid ${c.border}`}}>
        <PulseBar energy={ch.energyLevel} color={ch.vibeColor}/>
      </div>

      {/* ── Описание ── */}
      {ch.description&&(
        <div style={{padding:'10px 16px',background:c.card,borderBottom:`1px solid ${c.border}`}}>
          <p style={{margin:0,fontSize:13,color:c.mid,lineHeight:1.6}}>{ch.description}</p>
          {ch.tags.length>0&&(
            <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:8}}>
              {ch.tags.map(t=>(
                <span key={t} style={{fontSize:11,color:accent,background:`${accent}18`,
                  borderRadius:6,padding:'2px 8px',fontWeight:600}}>#{t}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Рубрики ── */}
      {ch.rubrics.length>0&&(
        <div style={{padding:'8px 0',borderBottom:`1px solid ${c.border}`,overflowX:'auto',display:'flex',gap:6,paddingLeft:16,scrollbarWidth:'none'}}>
          <motion.button whileTap={{scale:0.9}}
            onClick={()=>onRubric(null)}
            style={{flexShrink:0,padding:'6px 14px',borderRadius:20,border:'none',cursor:'pointer',fontSize:12,fontWeight:700,
              background:activeRubric===null?accent:'rgba(255,255,255,0.07)',
              color:activeRubric===null?'#fff':c.sub}}>
            Все
          </motion.button>
          {ch.rubrics.map(r=>(
            <motion.button key={r} whileTap={{scale:0.9}}
              onClick={()=>onRubric(activeRubric===r?null:r)}
              style={{flexShrink:0,padding:'6px 14px',borderRadius:20,border:'none',cursor:'pointer',fontSize:12,fontWeight:700,
                background:activeRubric===r?accent:'rgba(255,255,255,0.07)',
                color:activeRubric===r?'#fff':c.sub}}>
              {r}
            </motion.button>
          ))}
        </div>
      )}

      {/* ── Кнопка публикации ── */}
      <div style={{padding:'10px 16px',display:'flex',gap:8,borderBottom:`1px solid ${c.border}`}}>
        <motion.button whileTap={{scale:0.95}} onClick={()=>setShowCompose(true)}
          style={{flex:1,padding:'11px 0',borderRadius:14,border:'none',cursor:'pointer',
            background:`linear-gradient(135deg,${ch.vibeColor}cc,${accent})`,
            color:'#fff',fontSize:14,fontWeight:900,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          <span>{ch.vibe}</span> Опубликовать
        </motion.button>
      </div>

      {/* ── Посты ── */}
      <div style={{padding:'12px 16px'}}>
        {sortedPosts.length===0&&(
          <div style={{textAlign:'center',padding:'40px 0',color:c.sub,fontSize:14}}>
            {activeRubric?`В рубрике «${activeRubric}» пока нет постов`:'Ещё нет публикаций. Создай первую!'}
          </div>
        )}
        {sortedPosts.map(post=>(
          <PostCard key={post.id} post={post} ch={ch} c={c} accent={accent} tick={tick}
            onReact={(key)=>onReact(ch.id,post.id,key)}
            onVote={(idx)=>onVote(ch.id,post.id,idx)}
            onOpenCapsule={()=>onOpenCapsule(ch.id,post.id)}
            onPin={()=>onPin(ch.id,post.id)}
            onDelete={()=>onDelete(ch.id,post.id)}
            onBook={()=>onBook(post.id)}
            onEditBooking={(patch)=>onEditBooking(post.id,patch)}/>
        ))}
      </div>

      {/* ── Compose ── */}
      <AnimatePresence>
        {showCompose&&(
          <ComposePost ch={ch} c={c} accent={accent} isDark={isDark}
            onClose={()=>setShowCompose(false)}
            onPublish={(post)=>{ onAddPost(ch.id,post); setShowCompose(false); }}/>
        )}
      </AnimatePresence>

      {/* ── Кроп-модалка обложки ── */}
      <AnimatePresence>
        {showCoverCrop&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{position:'fixed',inset:0,zIndex:9200,background:'rgba(0,0,0,0.97)',
              display:'flex',flexDirection:'column',overscrollBehavior:'contain'}}>
            {/* Шапка */}
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px 8px',
              borderBottom:'1px solid rgba(255,255,255,0.1)',flexShrink:0}}>
              <motion.button whileTap={{scale:0.92}} onClick={()=>setShowCoverCrop(false)}
                style={{background:'rgba(255,255,255,0.1)',border:'none',color:'#fff',fontSize:16,
                  width:34,height:34,borderRadius:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                ✕
              </motion.button>
              <div style={{flex:1}}>
                <div style={{color:'#fff',fontWeight:800,fontSize:14}}>Выбери область обложки</div>
                <div style={{color:'rgba(255,255,255,0.4)',fontSize:10}}>
                  {coverUploading?'⬆️ Загружаем фото…':'Тяни ползунок или выбери область'}
                </div>
              </div>
              <motion.button whileTap={{scale:0.94}} onClick={applyCoverCrop}
                disabled={coverUploading}
                style={{background:coverUploading?'rgba(255,255,255,0.1)':'linear-gradient(135deg,#7c3aed,#a855f7)',
                  border:'none',color:'#fff',fontWeight:800,fontSize:13,borderRadius:20,
                  padding:'7px 18px',cursor:coverUploading?'wait':'pointer',opacity:coverUploading?0.5:1}}>
                {coverUploading?'…':'Применить'}
              </motion.button>
            </div>
            {/* Превью шапки канала */}
            <div style={{margin:'10px 14px 6px',borderRadius:10,overflow:'hidden',height:72,flexShrink:0,
              border:'2px solid rgba(255,255,255,0.25)',position:'relative',background:ch.coverGradient}}>
              <img src={coverCropSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover',
                objectPosition:`50% ${cropY}%`,userSelect:'none',pointerEvents:'none'}}/>
              <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',
                pointerEvents:'none'}}>
                <span style={{color:'rgba(255,255,255,0.35)',fontSize:9,letterSpacing:'0.12em',
                  textTransform:'uppercase',fontWeight:700}}>Превью обложки канала</span>
              </div>
            </div>
            {/* Полное фото с маркером */}
            <div style={{flex:1,overflow:'hidden',position:'relative',margin:'0 14px 0'}}>
              <img src={coverCropSrc} alt="" style={{width:'100%',height:'100%',objectFit:'contain',
                objectPosition:'center',userSelect:'none',pointerEvents:'none',display:'block'}}/>
              <div style={{position:'absolute',inset:0,pointerEvents:'none'}}>
                <div style={{position:'absolute',top:0,left:0,right:0,height:`calc(${cropY}% - 12%)`,background:'rgba(0,0,0,0.55)'}}/>
                <div style={{position:'absolute',bottom:0,left:0,right:0,height:`calc(${100-cropY}% - 12%)`,background:'rgba(0,0,0,0.55)'}}/>
                <div style={{position:'absolute',top:`calc(${cropY}% - 12%)`,left:0,right:0,height:'24%',
                  border:'2px solid rgba(255,255,255,0.7)',boxShadow:'0 0 0 1px rgba(0,0,0,0.4)',
                  display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <span style={{color:'rgba(255,255,255,0.6)',fontSize:9,fontWeight:700,letterSpacing:'0.1em',
                    textTransform:'uppercase',background:'rgba(0,0,0,0.5)',padding:'2px 8px',borderRadius:4}}>
                    видимая область
                  </span>
                </div>
              </div>
            </div>
            {/* Ползунок */}
            <div style={{padding:'12px 20px 8px',flexShrink:0}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                <span style={{color:'rgba(255,255,255,0.5)',fontSize:10}}>⬆ сверху</span>
                <span style={{color:'rgba(255,255,255,0.8)',fontSize:11,fontWeight:700}}>{cropY}%</span>
                <span style={{color:'rgba(255,255,255,0.5)',fontSize:10}}>снизу ⬇</span>
              </div>
              <input type="range" min={0} max={100} step={1} value={cropY}
                onChange={e=>setCropY(Number(e.target.value))}
                style={{width:'100%',accentColor:'#a855f7',cursor:'pointer'}}/>
            </div>
            {/* Быстрые кнопки */}
            <div style={{display:'flex',gap:6,padding:'0 20px 16px',flexShrink:0}}>
              {([['Сверху',0],['Центр',50],['Снизу',100]] as [string,number][]).map(([lbl,val])=>(
                <motion.button key={lbl} whileTap={{scale:0.94}} onClick={()=>setCropY(val)}
                  style={{flex:1,padding:'7px 0',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:11,
                    border:`1px solid ${cropY===val?'#a855f7':'rgba(255,255,255,0.15)'}`,
                    background:cropY===val?'rgba(168,85,247,0.2)':'rgba(255,255,255,0.05)',
                    color:cropY===val?'#c084fc':'rgba(255,255,255,0.7)'}}>
                  {lbl}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   КАРТОЧКА ПОСТА
══════════════════════════════════════════════════════ */
function PostCard({post,ch,c,accent,tick,onReact,onVote,onOpenCapsule,onPin,onDelete,onBook,onEditBooking}:{
  post:ChannelPost;ch:SwaipChannel;c:Props['c'];accent:string;tick:number;
  onReact:(key:ReactionKey)=>void;onVote:(idx:number)=>void;
  onOpenCapsule:()=>void;onPin:()=>void;onDelete:()=>void;
  onBook:()=>void;
  onEditBooking:(patch:{bookingSlots?:number;bookingLabel?:string;hasBooking?:boolean})=>void;
}) {
  const [showActions,setShowActions]=useState(false);
  const [showBookEdit,setShowBookEdit]=useState(false);
  const [bookSlotsDraft,setBookSlotsDraft]=useState(post.bookingSlots??5);
  const [bookLabelDraft,setBookLabelDraft]=useState(post.bookingLabel||'Записаться');
  const [booked,setBooked]=useState(false);
  const isPinned=ch.pinnedPostId===post.id;
  const score=calcPostScore(post.reactions);
  const slotsLeft=post.bookingSlots!==undefined?(post.bookingSlots-(post.bookingBooked||0)):null;

  /* Закрытая капсула */
  if(post.type==='capsule'&&!post.capsuleOpened&&post.opensAt&&Date.now()<post.opensAt) {
    return (
      <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}
        style={{background:c.card,borderRadius:18,overflow:'hidden',marginBottom:12,
          border:'1px solid rgba(251,191,36,0.3)'}}>
        <div style={{padding:'16px 16px 14px',display:'flex',flexDirection:'column',alignItems:'center',gap:10,
          background:'linear-gradient(135deg,rgba(251,191,36,0.08),rgba(234,179,8,0.04))'}}>
          <motion.div animate={{rotate:[0,5,-5,0]}} transition={{repeat:Infinity,duration:3}}>
            <span style={{fontSize:40}}>⏳</span>
          </motion.div>
          <p style={{margin:0,fontSize:15,fontWeight:800,color:'#fbbf24',textAlign:'center'}}>
            Временная капсула
          </p>
          {post.text&&<p style={{margin:0,fontSize:13,color:c.sub,textAlign:'center'}}>{post.text}</p>}
          <CountdownTimer ts={post.opensAt} label="Откроется через:"/>
        </div>
      </motion.div>
    );
  }

  /* Анонс (если ещё не пришло время) */
  if(post.type==='announce'&&post.announceAt&&Date.now()<post.announceAt) {
    return (
      <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}
        style={{background:c.card,borderRadius:18,overflow:'hidden',marginBottom:12,
          border:`1px solid ${ch.vibeColor}55`}}>
        <div style={{padding:'16px',background:`linear-gradient(135deg,${ch.vibeColor}12,${ch.vibeColor}06)`}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
            <span style={{fontSize:20}}>📣</span>
            <span style={{fontSize:13,fontWeight:800,color:ch.vibeColor,textTransform:'uppercase',letterSpacing:'0.05em'}}>Анонс</span>
          </div>
          {post.text&&<p style={{margin:'0 0 12px',fontSize:15,fontWeight:700,color:c.light,lineHeight:1.5}}>{post.text}</p>}
          <CountdownTimer ts={post.announceAt} label="До события:"/>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{opacity:0,y:12}} animate={{opacity:1,y:0}}
      style={{background:c.card,borderRadius:18,overflow:'hidden',marginBottom:12,
        border:isPinned?'1px solid rgba(234,179,8,0.4)':'1px solid '+c.border}}>

      {/* Пин */}
      {isPinned&&(
        <div style={{display:'flex',alignItems:'center',gap:5,padding:'5px 14px 0',marginBottom:-4}}>
          <span style={{fontSize:11}}>📌</span>
          <span style={{fontSize:10,color:'rgba(234,179,8,0.8)',fontWeight:700}}>Закреплено</span>
        </div>
      )}

      {/* Шапка */}
      <div style={{padding:'12px 14px 8px',display:'flex',alignItems:'center',gap:10}}>
        <ChanAvatar ch={ch} size={32}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:13,fontWeight:800,color:c.light}}>{ch.name}</span>
            {ch.isVerified&&<span style={{fontSize:11,color:'#60a5fa'}}>✓</span>}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:11,color:c.sub}}>{fmtAge(post.createdAt)}</span>
            {post.rubric&&<span style={{fontSize:10,color:accent,background:`${accent}18`,borderRadius:5,padding:'1px 6px',fontWeight:600}}>{post.rubric}</span>}
            {post.type==='episode'&&post.seriesName&&(
              <span style={{fontSize:10,color:'#a78bfa',background:'rgba(167,139,250,0.12)',borderRadius:5,padding:'1px 6px',fontWeight:600}}>
                📺 {post.seriesName} E{post.episodeNum}
              </span>
            )}
            {post.isExclusive&&<span style={{fontSize:10,color:'#fbbf24',fontWeight:700}}>🔒 Эксклюзив</span>}
          </div>
        </div>
        <button onClick={()=>setShowActions(s=>!s)}
          style={{background:'none',border:'none',cursor:'pointer',fontSize:18,color:c.sub,padding:4}}>⋯</button>
      </div>

      {showActions&&(
        <div style={{display:'flex',gap:6,padding:'0 14px 10px',flexWrap:'wrap'}}>
          <button onClick={()=>{onPin();setShowActions(false);}}
            style={{flex:1,minWidth:90,padding:'7px',borderRadius:10,background:'rgba(255,255,255,0.06)',border:isPinned?`1px solid rgba(234,179,8,0.5)`:`1px solid ${c.border}`,
              color:isPinned?'#fbbf24':c.mid,fontSize:11,fontWeight:700,cursor:'pointer'}}>
            {isPinned?'📌 Снять':'📌 Закрепить'}
          </button>
          <button onClick={()=>{setShowBookEdit(s=>!s);setShowActions(false);}}
            style={{flex:1,minWidth:90,padding:'7px',borderRadius:10,
              background:post.hasBooking?'rgba(16,185,129,0.1)':'rgba(255,255,255,0.06)',
              border:post.hasBooking?'1px solid rgba(16,185,129,0.4)':`1px solid ${c.border}`,
              color:post.hasBooking?'#34d399':c.mid,fontSize:11,fontWeight:700,cursor:'pointer'}}>
            📅 {post.hasBooking?'Запись':'+ Запись'}
          </button>
          <button onClick={()=>{onDelete();setShowActions(false);}}
            style={{padding:'7px 14px',borderRadius:10,background:'rgba(239,68,68,0.1)',
              border:'1px solid rgba(239,68,68,0.3)',color:'#ef4444',fontSize:11,fontWeight:700,cursor:'pointer'}}>
            🗑 Удалить
          </button>
        </div>
      )}

      {/* Текст */}
      {post.text&&<p style={{margin:'0 14px 10px',fontSize:15,lineHeight:1.65,
        color:'rgba(255,255,255,0.9)',whiteSpace:'pre-wrap'}}>{post.text}</p>}

      {/* Фото */}
      {post.imageUrl&&<img src={post.imageUrl} alt="" style={{width:'100%',objectFit:'cover',marginBottom:2}}/>}

      {/* Видео */}
      {post.videoUrl&&<video src={post.videoUrl} controls playsInline preload="metadata"
        style={{width:'100%',maxHeight:360,objectFit:'contain',background:'#000',display:'block'}}/>}

      {/* Аудио */}
      {post.audioUrl&&(
        <div style={{padding:'0 14px 10px',display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:20,flexShrink:0}}>{post.type==='audio'?'🎵':'🎙️'}</span>
          <audio controls src={post.audioUrl} style={{flex:1,height:36}}/>
        </div>
      )}

      {/* Опрос */}
      {post.type==='poll'&&post.pollOptions&&(
        <PollBlock opts={post.pollOptions} votedIdx={post.pollVotedIdx}
          question={post.pollQuestion} onVote={onVote} c={c}/>
      )}

      {/* Открытая капсула */}
      {post.type==='capsule'&&post.capsuleOpened&&(
        <div style={{margin:'0 14px 10px',padding:'10px 12px',borderRadius:12,
          background:'linear-gradient(135deg,rgba(251,191,36,0.12),rgba(234,179,8,0.06))',
          border:'1px solid rgba(251,191,36,0.3)',display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:18}}>🎉</span>
          <span style={{fontSize:13,color:'#fbbf24',fontWeight:700}}>Капсула открыта!</span>
        </div>
      )}

      {/* ── Кнопка «Записаться» ── */}
      {post.hasBooking&&(
        <div style={{padding:'4px 14px 14px'}}>
          {/* Мини-редактор слотов (для автора, через ⋯ меню) */}
          <AnimatePresence>
            {showBookEdit&&(
              <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
                style={{padding:'12px 14px',marginBottom:10,borderRadius:14,
                  background:'rgba(255,255,255,0.06)',border:`1px solid ${c.border}`}}>
                <p style={{margin:'0 0 10px',fontSize:12,color:c.sub,fontWeight:700}}>⚙️ НАСТРОЙКИ ЗАПИСИ</p>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  <div>
                    <p style={{margin:'0 0 4px',fontSize:11,color:c.sub}}>Текст кнопки</p>
                    <input value={bookLabelDraft} onChange={e=>setBookLabelDraft(e.target.value)}
                      style={{width:'100%',boxSizing:'border-box',padding:'8px 12px',borderRadius:10,
                        background:c.bg,border:`1px solid ${c.border}`,color:c.light,fontSize:13,outline:'none'}}/>
                  </div>
                  <div>
                    <p style={{margin:'0 0 4px',fontSize:11,color:c.sub}}>Количество мест (0 = без лимита)</p>
                    <input type="number" min={0} max={999} value={bookSlotsDraft}
                      onChange={e=>setBookSlotsDraft(Number(e.target.value))}
                      style={{width:'100%',boxSizing:'border-box',padding:'8px 12px',borderRadius:10,
                        background:c.bg,border:`1px solid ${c.border}`,color:c.light,fontSize:13,outline:'none',textAlign:'center'}}/>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <motion.button whileTap={{scale:0.95}} onClick={()=>{
                      onEditBooking({bookingSlots:bookSlotsDraft||undefined,bookingLabel:bookLabelDraft||'Записаться'});
                      setShowBookEdit(false);
                    }} style={{flex:1,padding:'9px',borderRadius:10,border:'none',cursor:'pointer',
                      background:accent,color:'#fff',fontWeight:800,fontSize:12}}>Сохранить</motion.button>
                    <motion.button whileTap={{scale:0.95}} onClick={()=>{
                      onEditBooking({hasBooking:false});setShowBookEdit(false);
                    }} style={{padding:'9px 14px',borderRadius:10,border:`1px solid rgba(239,68,68,0.4)`,
                      background:'rgba(239,68,68,0.08)',color:'#ef4444',cursor:'pointer',fontWeight:700,fontSize:12}}>
                      Убрать кнопку
                    </motion.button>
                    <motion.button whileTap={{scale:0.95}} onClick={()=>setShowBookEdit(false)}
                      style={{padding:'9px 12px',borderRadius:10,border:`1px solid ${c.border}`,
                        background:c.card,color:c.sub,cursor:'pointer',fontSize:12}}>✕</motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Строка с анимированными стрелками + кнопкой */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
            {/* Левые стрелки */}
            <div style={{display:'flex',gap:2}}>
              {[0,1].map(i=>(
                <motion.span key={i} style={{fontSize:14,color:ch.vibeColor,display:'block'}}
                  animate={{x:[4,0,4],opacity:[0.4,1,0.4]}}
                  transition={{repeat:Infinity,duration:1.1,delay:i*0.2,ease:'easeInOut'}}>
                  →
                </motion.span>
              ))}
            </div>

            {/* Кнопка «Записаться» */}
            {booked?(
              <motion.div initial={{scale:0.9}} animate={{scale:1}}
                style={{display:'flex',alignItems:'center',gap:6,padding:'9px 22px',borderRadius:24,
                  background:'linear-gradient(135deg,rgba(16,185,129,0.2),rgba(5,150,105,0.15))',
                  border:'1.5px solid rgba(16,185,129,0.5)'}}>
                <motion.span animate={{scale:[1,1.3,1]}} transition={{repeat:1,duration:0.4}}>✅</motion.span>
                <span style={{fontSize:13,fontWeight:800,color:'#34d399'}}>Вы записаны!</span>
                {slotsLeft!==null&&slotsLeft>0&&(
                  <span style={{fontSize:11,color:'rgba(52,211,153,0.7)'}}>· осталось {slotsLeft}</span>
                )}
              </motion.div>
            ):(
              <motion.button
                whileTap={{scale:0.93}}
                whileHover={{scale:1.04}}
                onClick={()=>{
                  if(slotsLeft===0)return;
                  setBooked(true);
                  onBook();
                }}
                style={{display:'flex',alignItems:'center',gap:7,padding:'10px 24px',borderRadius:24,
                  border:'none',cursor:slotsLeft===0?'default':'pointer',
                  background:slotsLeft===0
                    ?'rgba(255,255,255,0.07)'
                    :`linear-gradient(135deg,${ch.vibeColor}ee,${accent}cc)`,
                  color:slotsLeft===0?c.sub:'#fff',
                  boxShadow:slotsLeft===0?'none':`0 3px 16px ${ch.vibeColor}55`,
                  fontSize:14,fontWeight:800}}>
                <motion.span animate={{y:[0,-2,0]}} transition={{repeat:Infinity,duration:1.4,ease:'easeInOut'}}>
                  📅
                </motion.span>
                {post.bookingLabel||'Записаться'}
                {slotsLeft!==null&&(
                  <span style={{fontSize:10,fontWeight:600,
                    padding:'2px 7px',borderRadius:20,
                    background:'rgba(0,0,0,0.25)',color:slotsLeft===0?'#ef4444':'rgba(255,255,255,0.85)'}}>
                    {slotsLeft===0?'мест нет':`${slotsLeft} мест`}
                  </span>
                )}
              </motion.button>
            )}

            {/* Правые стрелки */}
            <div style={{display:'flex',gap:2,transform:'scaleX(-1)'}}>
              {[0,1].map(i=>(
                <motion.span key={i} style={{fontSize:14,color:ch.vibeColor,display:'block'}}
                  animate={{x:[4,0,4],opacity:[0.4,1,0.4]}}
                  transition={{repeat:Infinity,duration:1.1,delay:i*0.2,ease:'easeInOut'}}>
                  →
                </motion.span>
              ))}
            </div>
          </div>

          {/* Счётчик записавшихся */}
          {(post.bookingBooked||0)>0&&(
            <p style={{margin:'6px 0 0',textAlign:'center',fontSize:11,color:c.sub}}>
              Уже записались: <strong style={{color:ch.vibeColor}}>{post.bookingBooked}</strong>
              {post.bookingSlots?` из ${post.bookingSlots}`:''}
            </p>
          )}
        </div>
      )}

      {/* Реакции и счётчики */}
      <div style={{padding:'8px 14px 12px',display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
        {REACTION_META.map(({key,emoji,weight})=>{
          const count=post.reactions[key]||0;
          const active=post.myReaction===key;
          return (
            <motion.button key={key} whileTap={{scale:0.8}} onClick={()=>onReact(key)}
              style={{display:'flex',alignItems:'center',gap:3,padding:'5px 10px',borderRadius:20,
                border:`1px solid ${active?ch.vibeColor:'rgba(255,255,255,0.1)'}`,
                background:active?`${ch.vibeColor}25`:'rgba(255,255,255,0.04)',
                cursor:'pointer',transition:'all 0.15s'}}>
              <span style={{fontSize:15}}>{emoji}</span>
              {count>0&&<span style={{fontSize:11,color:active?ch.vibeColor:c.sub,fontWeight:700}}>{count}</span>}
            </motion.button>
          );
        })}
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
          {score>0&&<span style={{fontSize:11,color:ch.vibeColor,fontWeight:700}}>⚡{score}пт</span>}
          <span style={{fontSize:11,color:c.sub}}>👁 {fmtNum(post.views+142)}</span>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════
   БЛОК ОПРОСА
══════════════════════════════════════════════════════ */
function PollBlock({opts,votedIdx,question,onVote,c}:{
  opts:{text:string;votes:number}[];votedIdx?:number;question?:string;
  onVote:(idx:number)=>void;c:Props['c'];
}) {
  const total=opts.reduce((s,o)=>s+o.votes,0);
  return (
    <div style={{margin:'0 14px 12px',padding:'12px',borderRadius:14,
      background:'rgba(124,58,237,0.1)',border:'1px solid rgba(124,58,237,0.25)'}}>
      {question&&<p style={{margin:'0 0 10px',fontWeight:800,fontSize:14,color:'#fff'}}>{question}</p>}
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {opts.map((o,i)=>{
          const pct=total>0?Math.round((o.votes/total)*100):0;
          const voted=votedIdx===i;
          const shown=votedIdx!==undefined;
          return (
            <motion.button key={i} whileTap={{scale:0.97}}
              onClick={()=>votedIdx===undefined&&onVote(i)}
              style={{position:'relative',padding:'10px 14px',borderRadius:10,textAlign:'left',
                border:`1px solid ${voted?'rgba(124,58,237,0.6)':'rgba(124,58,237,0.2)'}`,
                background:'rgba(0,0,0,0.3)',cursor:shown?'default':'pointer',overflow:'hidden'}}>
              {shown&&<div style={{position:'absolute',top:0,left:0,height:'100%',width:`${pct}%`,
                background:voted?'rgba(124,58,237,0.3)':'rgba(255,255,255,0.06)',transition:'width 0.5s ease'}}/>}
              <div style={{position:'relative',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{fontSize:13,color:voted?'#c084fc':'rgba(255,255,255,0.8)',fontWeight:voted?800:600}}>{o.text}</span>
                {shown&&<span style={{fontSize:12,fontWeight:800,color:voted?'#c084fc':c.sub}}>{pct}%</span>}
              </div>
            </motion.button>
          );
        })}
      </div>
      {total>0&&<p style={{margin:'8px 0 0',fontSize:11,color:'rgba(124,58,237,0.6)',textAlign:'right'}}>
        {total} {total===1?'голос':total<5?'голоса':'голосов'}
      </p>}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   СОЗДАНИЕ ПОСТА
══════════════════════════════════════════════════════ */
const _getTok=()=>{try{return localStorage.getItem('swaip_session')||'';}catch{return '';}};

function ComposePost({ch,c,accent,onClose,onPublish}:{
  ch:SwaipChannel;c:Props['c'];accent:string;isDark:boolean;
  onClose:()=>void;
  onPublish:(post:Omit<ChannelPost,'id'|'reactions'|'views'|'createdAt'|'isPinned'>)=>void;
}) {
  const [type,setType]=useState<ChannelPost['type']>('text');
  const [text,setText]=useState('');
  const [rubric,setRubric]=useState('');
  const [isExclusive,setIsExclusive]=useState(false);
  const [pollQ,setPollQ]=useState('');
  const [pollOpts,setPollOpts]=useState(['','']);
  const [announceAt,setAnnounceAt]=useState('');
  const [opensAt,setOpensAt]=useState('');
  const [seriesName,setSeriesName]=useState('');
  const [episodeNum,setEpisodeNum]=useState(1);
  const [publishing,setPublishing]=useState(false);

  /* ── Запись ── */
  const [hasBooking,setHasBooking]=useState(false);
  const [bookingSlots,setBookingSlots]=useState(5);
  const [bookingLabel,setBookingLabel]=useState('Записаться');

  /* ── Фото ── */
  const [imgFile,setImgFile]=useState<File|null>(null);
  const [imgPrev,setImgPrev]=useState('');
  const [imgLoading,setImgLoading]=useState(false);
  const imgRef=useRef<HTMLInputElement>(null);
  const clearImg=()=>{if(imgPrev)URL.revokeObjectURL(imgPrev);setImgFile(null);setImgPrev('');};

  /* ── Видео ── */
  const [vidFile,setVidFile]=useState<File|null>(null);
  const [vidPrev,setVidPrev]=useState('');
  const [vidLoading,setVidLoading]=useState(false);
  const [vidProgress,setVidProgress]=useState(0);
  const vidRef=useRef<HTMLInputElement>(null);
  const clearVid=()=>{if(vidPrev)URL.revokeObjectURL(vidPrev);setVidFile(null);setVidPrev('');setVidProgress(0);};

  /* ── Голос ── */
  const [voiceRec,setVoiceRec]=useState(false);
  const [voiceBlob,setVoiceBlob]=useState<Blob|null>(null);
  const [voiceUrl,setVoiceUrl]=useState('');
  const voiceRecRef=useRef<MediaRecorder|null>(null);

  /* ── Музыка ── */
  const [musicFile,setMusicFile]=useState<File|null>(null);
  const [musicName,setMusicName]=useState('');
  const [musicLoading,setMusicLoading]=useState(false);
  const [musicError,setMusicError]=useState('');
  const musicRef=useRef<HTMLInputElement>(null);
  const clearMusic=()=>{setMusicFile(null);setMusicName('');setMusicError('');if(musicRef.current)musicRef.current.value='';};

  const POST_TYPES:[ChannelPost['type'],string,string][]=[
    ['text','✍️','Текст'],['photo','📸','Фото'],['video','🎬','Видео'],
    ['audio','🎵','Аудио'],['poll','📊','Опрос'],
    ['announce','📣','Анонс'],['capsule','⏳','Капсула'],['episode','📺','Эпизод'],
  ];

  /* ── Загрузка ── */
  const uploadImg=async():Promise<string>=>{
    if(!imgFile)return'';setImgLoading(true);
    try{
      const r=await fetch(`${window.location.origin}/api/image-upload`,{
        method:'POST',headers:{'Content-Type':imgFile.type,'x-session-token':_getTok()},body:imgFile});
      if(r.ok){const{url}=await r.json();return url;}
      return imgPrev;
    }catch{return imgPrev;}finally{setImgLoading(false);}
  };

  const uploadVid=async():Promise<string>=>{
    if(!vidFile)return'';setVidLoading(true);setVidProgress(20);
    try{
      const r=await fetch(`${window.location.origin}/api/video-upload`,{
        method:'POST',
        headers:{'Content-Type':vidFile.type||'video/mp4','x-filename':vidFile.name,'x-session-token':_getTok()},
        body:vidFile});
      setVidProgress(90);
      if(r.ok){setVidProgress(100);const{url}=await r.json();return url;}
      return vidPrev;
    }catch{return vidPrev;}finally{setVidLoading(false);}
  };

  const uploadVoice=async(blob:Blob):Promise<string>=>{
    try{
      const r=await fetch(`${window.location.origin}/api/audio-upload`,{
        method:'POST',headers:{'Content-Type':blob.type||'audio/webm'},body:blob});
      if(r.ok){const{url}=await r.json();return url;}
    }catch{}
    return URL.createObjectURL(blob);
  };

  const uploadMusic=async():Promise<string>=>{
    if(!musicFile)return'';setMusicLoading(true);setMusicError('');
    try{
      const r=await fetch(`${window.location.origin}/api/audio-upload`,{
        method:'POST',headers:{'Content-Type':musicFile.type||'audio/mpeg','x-filename':musicFile.name,'x-session-token':_getTok()},
        body:musicFile});
      if(r.ok){const{url}=await r.json();return url;}
      setMusicError('Ошибка загрузки');return'';
    }catch{setMusicError('Ошибка сети');return'';}finally{setMusicLoading(false);}
  };

  /* ── Голос MediaRecorder ── */
  const startVoice=async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mime=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t))||'';
      const mr=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
      const chunks:BlobPart[]=[];
      mr.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
      mr.onstop=()=>{stream.getTracks().forEach(t=>t.stop());const b=new Blob(chunks,{type:mr.mimeType});setVoiceBlob(b);setVoiceUrl(URL.createObjectURL(b));setVoiceRec(false);};
      mr.start();voiceRecRef.current=mr;setVoiceRec(true);setVoiceBlob(null);setVoiceUrl('');
    }catch(e:any){alert('Нет доступа к микрофону: '+e.message);}
  };
  const stopVoice=()=>voiceRecRef.current?.stop();

  /* ── Публикация ── */
  const handlePublish=async()=>{
    if(publishing)return;
    if(type==='text'&&!text.trim()&&!imgFile)return;
    if(type==='poll'&&(!pollQ.trim()||pollOpts.filter(o=>o.trim()).length<2))return;
    setPublishing(true);
    try{
      const [iUrl,vUrl,mUrl]= await Promise.all([
        (type==='photo'||type==='text'||type==='episode')?uploadImg():Promise.resolve(''),
        (type==='video')?uploadVid():Promise.resolve(''),
        (type==='audio'&&musicFile)?uploadMusic():
          (type==='audio'&&voiceBlob)?uploadVoice(voiceBlob):Promise.resolve(''),
      ]);
      const base:any={type,text:text.trim(),rubric:rubric||undefined,isExclusive};
      if(iUrl)base.imageUrl=iUrl;
      if(vUrl)base.videoUrl=vUrl;
      if(mUrl)base.audioUrl=mUrl;
      if(type==='poll')Object.assign(base,{pollQuestion:pollQ,pollOptions:pollOpts.filter(o=>o.trim()).map(t=>({text:t,votes:0}))});
      if(type==='announce'&&announceAt)base.announceAt=new Date(announceAt).getTime();
      if(type==='capsule'&&opensAt)Object.assign(base,{opensAt:new Date(opensAt).getTime(),capsuleOpened:false});
      if(type==='episode')Object.assign(base,{seriesName,episodeNum});
      if(hasBooking){Object.assign(base,{hasBooking:true,bookingBooked:0,bookingLabel:bookingLabel||'Записаться',bookingSlots:bookingSlots||undefined});}
      onPublish(base);
    }finally{setPublishing(false);}
  };

  const fmtSize=(b:number)=>b>=1048576?`${(b/1048576).toFixed(1)} МБ`:b>=1024?`${(b/1024).toFixed(0)} КБ`:`${b} Б`;
  const canPublish=!publishing&&!imgLoading&&!vidLoading&&!musicLoading&&
    (type!=='text'||!!text.trim()||!!imgFile)&&
    (type!=='poll'||(!!pollQ.trim()&&pollOpts.filter(o=>o.trim()).length>=2))&&
    (type!=='video'||!!vidFile||!!vidPrev)&&
    (type!=='audio'||!!musicFile||!!voiceBlob);

  return (
    <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
      transition={{type:'spring',damping:28,stiffness:280}}
      style={{position:'fixed',inset:0,zIndex:900,background:c.bg,overflowY:'auto',paddingBottom:40}}>

      {/* ── Заголовок ── */}
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px 16px 12px',
        borderBottom:`1px solid ${c.border}`,position:'sticky',top:0,background:c.bg,zIndex:2}}>
        <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:16,color:c.sub,padding:4}}>✕</button>
        <div style={{flex:1}}>
          <p style={{margin:0,fontSize:15,fontWeight:800,color:c.light}}>Новый пост</p>
          <p style={{margin:0,fontSize:11,color:c.sub}}>{ch.name} · {ch.vibe}</p>
        </div>
        <motion.button whileTap={{scale:0.95}} onClick={handlePublish} disabled={!canPublish}
          style={{padding:'9px 20px',borderRadius:20,border:'none',cursor:canPublish?'pointer':'default',
            background:canPublish?`linear-gradient(135deg,${ch.vibeColor}cc,${accent})`:'rgba(255,255,255,0.1)',
            color:canPublish?'#fff':'rgba(255,255,255,0.3)',fontSize:13,fontWeight:800,transition:'all 0.2s'}}>
          {publishing?'⬆️ …':vidLoading?`🎬 ${vidProgress}%`:musicLoading?'🎵 …':'Опубликовать'}
        </motion.button>
      </div>

      <div style={{padding:'16px'}}>

        {/* ── Тип поста ── */}
        <div style={{display:'flex',gap:6,overflowX:'auto',marginBottom:16,scrollbarWidth:'none',paddingBottom:4}}>
          {POST_TYPES.map(([t,emoji,label])=>(
            <motion.button key={t} whileTap={{scale:0.9}} onClick={()=>setType(t)}
              style={{flexShrink:0,padding:'7px 14px',borderRadius:20,border:'none',cursor:'pointer',
                fontSize:12,fontWeight:700,display:'flex',alignItems:'center',gap:5,
                background:type===t?accent:'rgba(255,255,255,0.07)',
                color:type===t?'#fff':c.sub}}>
              <span>{emoji}</span>{label}
            </motion.button>
          ))}
        </div>

        {/* ── Рубрика ── */}
        {ch.rubrics.length>0&&(
          <div style={{marginBottom:14}}>
            <p style={{margin:'0 0 6px',fontSize:11,color:c.sub,fontWeight:700}}>РУБРИКА</p>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <button onClick={()=>setRubric('')}
                style={{padding:'5px 12px',borderRadius:20,border:`1px solid ${rubric===''?accent:c.border}`,
                  background:rubric===''?`${accent}25`:'transparent',color:rubric===''?accent:c.sub,fontSize:11,fontWeight:700,cursor:'pointer'}}>Без рубрики</button>
              {ch.rubrics.map(r=>(
                <button key={r} onClick={()=>setRubric(r)}
                  style={{padding:'5px 12px',borderRadius:20,border:`1px solid ${rubric===r?accent:c.border}`,
                    background:rubric===r?`${accent}25`:'transparent',color:rubric===r?accent:c.sub,fontSize:11,fontWeight:700,cursor:'pointer'}}>{r}</button>
              ))}
            </div>
          </div>
        )}

        {/* ── Текстовое поле ── */}
        {type!=='poll'&&(
          <textarea value={text} onChange={e=>setText(e.target.value)} autoFocus
            placeholder={
              type==='capsule'?'Подсказка (будет видна до открытия)…':
              type==='video'?'Подпись к видео (необязательно)…':
              type==='audio'?'Описание трека (необязательно)…':
              'Что хочешь рассказать?'}
            style={{width:'100%',minHeight:100,background:c.card,border:`1px solid ${c.border}`,
              borderRadius:14,padding:'12px 14px',color:c.light,fontSize:15,lineHeight:1.6,
              resize:'none',outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}/>
        )}

        {/* ── Фото (для text/photo/episode) ── */}
        {(type==='text'||type==='photo'||type==='episode')&&(
          <div style={{marginTop:12}}>
            {imgPrev
              ?<div style={{position:'relative',borderRadius:12,overflow:'hidden'}}>
                <img src={imgPrev} alt="" style={{width:'100%',maxHeight:240,objectFit:'contain',background:'#000',display:'block'}}/>
                {imgLoading&&<div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(0,0,0,0.5)'}}>
                  <motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:0.8,ease:'linear'}}
                    style={{width:28,height:28,border:'3px solid rgba(255,255,255,0.2)',borderTopColor:'#fff',borderRadius:'50%'}}/>
                </div>}
                {!imgLoading&&<button onClick={clearImg} style={{position:'absolute',top:8,right:8,width:30,height:30,
                  borderRadius:'50%',background:'rgba(0,0,0,0.7)',border:'none',color:'#fff',cursor:'pointer',fontSize:15}}>✕</button>}
              </div>
              :<motion.button whileTap={{scale:0.97}} onClick={()=>imgRef.current?.click()}
                style={{width:'100%',marginTop:8,padding:'16px',borderRadius:12,border:`1.5px dashed ${c.border}`,
                  background:'transparent',color:c.sub,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                <span style={{fontSize:22}}>📸</span> Добавить фото
              </motion.button>}
            <input ref={imgRef} type="file" accept="image/*" style={{display:'none'}}
              onChange={e=>{const f=e.target.files?.[0];if(!f)return;clearImg();setImgFile(f);setImgPrev(URL.createObjectURL(f));e.target.value='';}}/>
          </div>
        )}

        {/* ── Видео ── */}
        {type==='video'&&(
          <div style={{marginTop:12}}>
            {vidPrev
              ?<div style={{position:'relative',borderRadius:12,overflow:'hidden',background:'#000'}}>
                <video src={vidPrev} controls style={{width:'100%',maxHeight:300,display:'block'}}/>
                {vidLoading&&(
                  <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'8px 12px',background:'rgba(0,0,0,0.75)'}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:5}}>
                      <span style={{color:'#fff',fontSize:12,fontWeight:700}}>🎬 Загрузка {vidProgress}%</span>
                    </div>
                    <div style={{height:4,background:'rgba(255,255,255,0.15)',borderRadius:2}}>
                      <div style={{width:`${vidProgress}%`,height:'100%',background:'linear-gradient(90deg,#3b82f6,#8b5cf6)',borderRadius:2,transition:'width 0.4s'}}/>
                    </div>
                  </div>
                )}
                {!vidLoading&&<button onClick={clearVid} style={{position:'absolute',top:8,right:8,width:30,height:30,
                  borderRadius:'50%',background:'rgba(0,0,0,0.7)',border:'none',color:'#fff',cursor:'pointer',fontSize:15}}>✕</button>}
              </div>
              :<motion.button whileTap={{scale:0.97}} onClick={()=>vidRef.current?.click()}
                style={{width:'100%',padding:'24px',borderRadius:12,border:`1.5px dashed ${c.border}`,
                  background:'transparent',color:c.sub,fontSize:13,cursor:'pointer',
                  display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                <span style={{fontSize:36}}>🎬</span>
                <span style={{fontWeight:700}}>Выбрать видео</span>
                <span style={{fontSize:11}}>MP4, MOV, WEBM · до 200 МБ</span>
              </motion.button>}
            <input ref={vidRef} type="file" accept="video/*" style={{display:'none'}}
              onChange={e=>{const f=e.target.files?.[0];if(!f)return;clearVid();setVidFile(f);setVidPrev(URL.createObjectURL(f));e.target.value='';}}/>
          </div>
        )}

        {/* ── Аудио / Голос / Музыка ── */}
        {type==='audio'&&(
          <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:12}}>
            {/* Голосовая запись */}
            {!musicFile&&(
              <div>
                <p style={{margin:'0 0 8px',fontSize:11,color:c.sub,fontWeight:700}}>🎙️ ГОЛОСОВОЕ СООБЩЕНИЕ</p>
                {voiceRec?(
                  <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(239,68,68,0.1)',
                    borderRadius:14,padding:'12px 16px',border:'1px solid rgba(239,68,68,0.3)'}}>
                    <motion.div animate={{scale:[1,1.3,1]}} transition={{repeat:Infinity,duration:0.9}}
                      style={{width:12,height:12,borderRadius:'50%',background:'#ef4444',flexShrink:0}}/>
                    <span style={{color:'#f87171',fontSize:14,flex:1,fontWeight:700}}>Запись идёт…</span>
                    <motion.button whileTap={{scale:0.88}} onClick={stopVoice}
                      style={{background:'#ef4444',border:'none',borderRadius:'50%',width:36,height:36,
                        cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <span style={{color:'#fff',fontSize:16}}>■</span>
                    </motion.button>
                  </div>
                ):voiceUrl?(
                  <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(59,130,246,0.1)',
                    borderRadius:14,padding:'10px 14px',border:'1px solid rgba(59,130,246,0.25)'}}>
                    <span style={{fontSize:20,flexShrink:0}}>🎙️</span>
                    <audio controls src={voiceUrl} style={{flex:1,height:34}}/>
                    <button onClick={()=>{setVoiceBlob(null);setVoiceUrl('');}}
                      style={{background:'rgba(255,255,255,0.1)',border:'none',borderRadius:'50%',
                        width:28,height:28,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <span style={{fontSize:12,color:c.sub}}>✕</span>
                    </button>
                  </div>
                ):(
                  <motion.button whileTap={{scale:0.97}} onClick={startVoice}
                    style={{width:'100%',padding:'16px',borderRadius:12,border:`1.5px dashed ${c.border}`,
                      background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
                    <span style={{fontSize:24}}>🎙️</span>
                    <span style={{color:c.sub,fontSize:13,fontWeight:700}}>Записать голосовое</span>
                  </motion.button>
                )}
              </div>
            )}

            {/* Разделитель */}
            {!voiceBlob&&!voiceUrl&&<div style={{display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1,height:1,background:c.border}}/>
              <span style={{fontSize:11,color:c.sub}}>или</span>
              <div style={{flex:1,height:1,background:c.border}}/>
            </div>}

            {/* Музыкальный файл */}
            {!voiceBlob&&!voiceUrl&&(
              <div>
                <p style={{margin:'0 0 8px',fontSize:11,color:c.sub,fontWeight:700}}>🎵 ФАЙЛ ТРЕКА</p>
                {musicFile?(
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(16,185,129,0.08)',
                      borderRadius:12,padding:'10px 14px',border:`1px solid ${musicError?'rgba(239,68,68,0.5)':'rgba(16,185,129,0.2)'}`}}>
                      <span style={{fontSize:22,flexShrink:0}}>{musicLoading?'⏳':'🎵'}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:700,color:c.light,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{musicName}</div>
                        <div style={{fontSize:11,color:musicLoading?'#a78bfa':c.sub}}>{musicLoading?'Загружаем…':fmtSize(musicFile.size)}</div>
                      </div>
                      <button onClick={clearMusic}
                        style={{background:c.card,border:'none',borderRadius:'50%',width:28,height:28,
                          cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                        <span style={{fontSize:12,color:c.sub}}>✕</span>
                      </button>
                    </div>
                    {musicError&&<p style={{margin:0,fontSize:12,color:'#f87171'}}>⚠️ {musicError}</p>}
                  </div>
                ):(
                  <motion.button whileTap={{scale:0.97}} onClick={()=>musicRef.current?.click()}
                    style={{width:'100%',padding:'16px',borderRadius:12,border:`1.5px dashed ${c.border}`,
                      background:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10}}>
                    <span style={{fontSize:24}}>🎵</span>
                    <div style={{textAlign:'left'}}>
                      <div style={{color:c.sub,fontSize:13,fontWeight:700}}>Загрузить трек</div>
                      <div style={{color:c.sub,fontSize:10,opacity:0.7}}>MP3, WAV, OGG, M4A, FLAC…</div>
                    </div>
                  </motion.button>
                )}
                <input ref={musicRef} type="file" style={{display:'none'}}
                  accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus"
                  onChange={e=>{const f=e.target.files?.[0];if(!f)return;setMusicFile(f);setMusicName(f.name);setMusicError('');e.target.value='';}}/>
              </div>
            )}
          </div>
        )}

        {/* ── Опрос ── */}
        {type==='poll'&&(
          <div style={{marginTop:4,display:'flex',flexDirection:'column',gap:8}}>
            <input value={pollQ} onChange={e=>setPollQ(e.target.value)} autoFocus
              placeholder="Вопрос опроса…"
              style={{padding:'12px 14px',borderRadius:10,background:c.card,
                border:`1px solid ${c.border}`,color:c.light,fontSize:14,outline:'none'}}/>
            {pollOpts.map((o,i)=>(
              <div key={i} style={{display:'flex',gap:6}}>
                <input value={o} onChange={e=>setPollOpts(os=>os.map((v,j)=>j===i?e.target.value:v))}
                  placeholder={`Вариант ${i+1}`}
                  style={{flex:1,padding:'10px 12px',borderRadius:10,background:c.card,
                    border:`1px solid ${c.border}`,color:c.light,fontSize:13,outline:'none'}}/>
                {i>1&&<button onClick={()=>setPollOpts(os=>os.filter((_,j)=>j!==i))}
                  style={{background:'none',border:'none',color:c.sub,cursor:'pointer',fontSize:18}}>✕</button>}
              </div>
            ))}
            {pollOpts.length<6&&<button onClick={()=>setPollOpts(os=>[...os,''])}
              style={{padding:'9px',borderRadius:10,border:`1.5px dashed ${c.border}`,
                background:'transparent',color:c.sub,fontSize:12,cursor:'pointer'}}>
              + Добавить вариант
            </button>}
          </div>
        )}

        {/* ── Анонс ── */}
        {type==='announce'&&(
          <div style={{marginTop:12}}>
            <p style={{margin:'0 0 6px',fontSize:11,color:c.sub,fontWeight:700}}>📅 ДАТА И ВРЕМЯ СОБЫТИЯ</p>
            <input type="datetime-local" value={announceAt} onChange={e=>setAnnounceAt(e.target.value)}
              style={{width:'100%',padding:'10px 12px',borderRadius:10,background:c.card,
                border:`1px solid ${c.border}`,color:c.light,fontSize:13,outline:'none',boxSizing:'border-box'}}/>
          </div>
        )}

        {/* ── Капсула ── */}
        {type==='capsule'&&(
          <div style={{marginTop:12}}>
            <p style={{margin:'0 0 6px',fontSize:11,color:'rgba(251,191,36,0.7)',fontWeight:700}}>⏳ ОТКРЫТЬ КАПСУЛУ:</p>
            <input type="datetime-local" value={opensAt} onChange={e=>setOpensAt(e.target.value)}
              style={{width:'100%',padding:'10px 12px',borderRadius:10,background:'rgba(251,191,36,0.08)',
                border:'1px solid rgba(251,191,36,0.3)',color:'#fbbf24',fontSize:13,outline:'none',boxSizing:'border-box'}}/>
          </div>
        )}

        {/* ── Эпизод ── */}
        {type==='episode'&&(
          <div style={{marginTop:12,display:'flex',gap:8}}>
            <input value={seriesName} onChange={e=>setSeriesName(e.target.value)}
              placeholder="Название серии…"
              style={{flex:2,padding:'10px 12px',borderRadius:10,background:c.card,
                border:`1px solid ${c.border}`,color:c.light,fontSize:13,outline:'none'}}/>
            <input type="number" min={1} value={episodeNum} onChange={e=>setEpisodeNum(Number(e.target.value))}
              placeholder="Эп."
              style={{flex:1,padding:'10px 8px',borderRadius:10,background:c.card,
                border:`1px solid ${c.border}`,color:c.light,fontSize:13,outline:'none',textAlign:'center'}}/>
          </div>
        )}

        {/* ── Панель медиа-кнопок (для text/photo) ── */}
        {(type==='text'||type==='photo')&&(
          <div style={{display:'flex',gap:8,marginTop:14,flexWrap:'wrap'}}>
            <motion.button whileTap={{scale:0.88}} onClick={()=>imgRef.current?.click()}
              style={{width:42,height:42,borderRadius:'50%',border:`1px solid ${c.border}`,
                background:imgFile?'rgba(59,130,246,0.2)':c.card,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>
              📷
            </motion.button>
            <motion.button whileTap={{scale:0.88}} onClick={()=>{setType('video');}}
              style={{width:42,height:42,borderRadius:'50%',border:`1px solid ${c.border}`,
                background:c.card,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>
              🎬
            </motion.button>
            <motion.button whileTap={{scale:0.88}} onClick={()=>{setType('audio');}}
              style={{width:42,height:42,borderRadius:'50%',border:`1px solid ${c.border}`,
                background:c.card,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>
              🎵
            </motion.button>
          </div>
        )}

        {/* ── Кнопка «Записаться» ── */}
        <div style={{marginTop:14,borderRadius:14,border:`1px solid ${hasBooking?'rgba(16,185,129,0.4)':c.border}`,
          background:hasBooking?'rgba(16,185,129,0.05)':c.card,overflow:'hidden',transition:'all 0.25s'}}>
          <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',cursor:'pointer'}}
            onClick={()=>setHasBooking(s=>!s)}>
            <div style={{width:40,height:24,borderRadius:12,border:'none',cursor:'pointer',
              background:hasBooking?'#10b981':'rgba(255,255,255,0.15)',transition:'all 0.2s',position:'relative',flexShrink:0}}>
              <div style={{position:'absolute',top:3,width:18,height:18,borderRadius:'50%',
                background:'#fff',transition:'left 0.2s',left:hasBooking?19:3}}/>
            </div>
            <span style={{fontSize:13,color:hasBooking?'#34d399':c.sub,fontWeight:hasBooking?700:500}}>
              📅 Добавить кнопку «Записаться»
            </span>
          </div>
          <AnimatePresence>
            {hasBooking&&(
              <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}}
                style={{overflow:'hidden'}}>
                <div style={{padding:'0 14px 14px',display:'flex',flexDirection:'column',gap:8}}>
                  <div>
                    <p style={{margin:'0 0 5px',fontSize:11,color:c.sub}}>Текст кнопки</p>
                    <input value={bookingLabel} onChange={e=>setBookingLabel(e.target.value)}
                      placeholder="Записаться"
                      style={{width:'100%',boxSizing:'border-box',padding:'9px 12px',borderRadius:10,
                        background:c.bg,border:`1px solid ${c.border}`,color:c.light,fontSize:13,outline:'none'}}/>
                  </div>
                  <div>
                    <p style={{margin:'0 0 5px',fontSize:11,color:c.sub}}>Количество мест (0 = без лимита)</p>
                    <input type="number" min={0} max={999} value={bookingSlots}
                      onChange={e=>setBookingSlots(Number(e.target.value))}
                      style={{width:'100%',boxSizing:'border-box',padding:'9px 12px',borderRadius:10,
                        background:c.bg,border:`1px solid ${c.border}`,color:c.light,fontSize:13,outline:'none',textAlign:'center'}}/>
                  </div>
                  {/* Превью кнопки */}
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,padding:'10px 0 2px'}}>
                    <span style={{fontSize:12,color:c.sub}}>→→</span>
                    <div style={{padding:'9px 22px',borderRadius:24,
                      background:'linear-gradient(135deg,rgba(16,185,129,0.7),rgba(5,150,105,0.6))',
                      color:'#fff',fontWeight:800,fontSize:13,display:'flex',alignItems:'center',gap:6}}>
                      <span>📅</span>
                      {bookingLabel||'Записаться'}
                      {bookingSlots>0&&<span style={{fontSize:10,padding:'2px 7px',borderRadius:20,
                        background:'rgba(0,0,0,0.25)'}}>{bookingSlots} мест</span>}
                    </div>
                    <span style={{fontSize:12,color:c.sub}}>←←</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Эксклюзив ── */}
        <div style={{marginTop:10,display:'flex',alignItems:'center',gap:10,
          padding:'12px 14px',background:isExclusive?'rgba(251,191,36,0.06)':c.card,
          borderRadius:14,border:`1px solid ${isExclusive?'rgba(251,191,36,0.3)':c.border}`,
          transition:'all 0.2s',cursor:'pointer'}} onClick={()=>setIsExclusive(s=>!s)}>
          <div style={{width:40,height:24,borderRadius:12,border:'none',cursor:'pointer',
            background:isExclusive?accent:'rgba(255,255,255,0.15)',transition:'all 0.2s',position:'relative',flexShrink:0}}>
            <div style={{position:'absolute',top:3,width:18,height:18,borderRadius:'50%',
              background:'#fff',transition:'left 0.2s',left:isExclusive?19:3}}/>
          </div>
          <span style={{fontSize:13,color:isExclusive?'#fbbf24':c.sub,fontWeight:isExclusive?700:500}}>
            🔒 Эксклюзивный пост (только для подписчиков)
          </span>
        </div>

      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════
   СОЗДАНИЕ КАНАЛА
══════════════════════════════════════════════════════ */
function CreateChannelModal({c,accent,isDark,userName,userAvatar,onClose,onCreate}:{
  c:Props['c'];accent:string;isDark:boolean;
  userName:string;userAvatar?:string;
  onClose:()=>void;
  onCreate:(ch:SwaipChannel)=>void;
}) {
  const [step,setStep]=useState(0);
  const [name,setName]=useState('');
  const [handle,setHandle]=useState('');
  const [desc,setDesc]=useState('');
  const [coverIdx,setCoverIdx]=useState(4);
  const [vibeIdx,setVibeIdx]=useState(0);
  const [catId,setCatId]=useState('tech');
  const [tags,setTags]=useState('');
  const [rubrics,setRubrics]=useState<string[]>([]);
  const [customRubric,setCustomRubric]=useState('');
  const [isVerified]=useState(false);
  const [coverPhotoUrl,setCoverPhotoUrl]=useState('');
  const [coverPosition,setCoverPosition]=useState('50% 50%');
  const [avatarPhotoUrl,setAvatarPhotoUrl]=useState('');
  const [coverUploading,setCoverUploading]=useState(false);
  const [avatarUploading,setAvatarUploading]=useState(false);
  const coverFileRef=useRef<HTMLInputElement>(null);
  const avatarFileRef=useRef<HTMLInputElement>(null);

  /* Кроп обложки */
  const [showCoverCrop,setShowCoverCrop]=useState(false);
  const [coverCropSrc,setCoverCropSrc]=useState('');
  const [coverCropFinal,setCoverCropFinal]=useState('');
  const [cropY,setCropY]=useState(50);

  const vibe=CHANNEL_VIBES[vibeIdx];
  const cover=CHANNEL_GRADIENTS[coverIdx];
  const cat=CHANNEL_CATEGORIES.find(x=>x.id===catId)!;

  const openCoverCrop=(f:File)=>{
    const local=URL.createObjectURL(f);
    setCropY(50);setCoverCropSrc(local);setCoverCropFinal('');setShowCoverCrop(true);
    setCoverUploading(true);
    fetch(`${window.location.origin}/api/image-upload`,{method:'POST',headers:{'Content-Type':f.type},body:f})
      .then(r=>r.ok?r.json():null).then(d=>{if(d?.url)setCoverCropFinal(d.url);})
      .catch(()=>{}).finally(()=>setCoverUploading(false));
  };

  const applyCoverCrop=()=>{
    setCoverPhotoUrl(coverCropFinal||coverCropSrc);
    setCoverPosition(`50% ${cropY}%`);
    setShowCoverCrop(false);
  };

  const uploadAvatar=async(f:File)=>{
    const local=URL.createObjectURL(f);
    setAvatarPhotoUrl(local);setAvatarUploading(true);
    try{
      const r=await fetch(`${window.location.origin}/api/image-upload`,{
        method:'POST',headers:{'Content-Type':f.type},body:f});
      if(r.ok){const{url}=await r.json();setAvatarPhotoUrl(url);}
    }catch{}finally{setAvatarUploading(false);}
  };

  const handleCreate=()=>{
    if(!name.trim())return;
    const ch:SwaipChannel={
      id:uid(),
      name:name.trim(),
      handle:handle.trim()||name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''),
      description:desc.trim(),
      vibe:vibe.emoji,vibeColor:vibe.color,
      coverGradient:cover.bg,
      coverPhotoUrl:coverPhotoUrl||undefined,
      coverPosition:coverPhotoUrl?coverPosition:undefined,
      avatarPhotoUrl:avatarPhotoUrl||undefined,
      category:catId,
      tags:tags.split(',').map(t=>t.trim()).filter(Boolean),
      subscribers:0,
      posts:[],
      pinnedPostId:null,
      createdAt:Date.now(),
      rubrics,
      energyLevel:Math.floor(Math.random()*40)+20,
      isVerified,
      pulse:`${vibe.emoji} ${vibe.label}`,
      authorName:userName,
      authorAvatar:userAvatar,
    };
    onCreate(ch);
  };

  const STEPS=['Облик','Атмосфера','Рубрики','Финал'];

  return (
    <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
      transition={{type:'spring',damping:26,stiffness:260}}
      style={{position:'fixed',inset:0,zIndex:950,background:c.bg,overflowY:'auto',paddingBottom:40}}>

      {/* Шапка */}
      <div style={{position:'sticky',top:0,background:c.bg,zIndex:2,
        borderBottom:`1px solid ${c.border}`,padding:'16px 16px 12px'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <button onClick={step===0?onClose:()=>setStep(s=>s-1)}
            style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:c.sub,padding:4}}>
            {step===0?'✕':'←'}
          </button>
          <div style={{flex:1}}>
            <p style={{margin:0,fontSize:15,fontWeight:900,color:c.light}}>
              Создать канал · {STEPS[step]}
            </p>
            <p style={{margin:0,fontSize:11,color:c.sub}}>Шаг {step+1} из {STEPS.length}</p>
          </div>
        </div>
        {/* Прогресс */}
        <div style={{marginTop:10,height:3,background:'rgba(255,255,255,0.1)',borderRadius:2,overflow:'hidden'}}>
          <motion.div animate={{width:`${((step+1)/STEPS.length)*100}%`}}
            style={{height:'100%',background:`linear-gradient(90deg,${vibe.color}88,${vibe.color})`,borderRadius:2}}/>
        </div>
      </div>

      <div style={{padding:'20px 16px'}}>

        {/* ── Превью канала ── */}
        <motion.div layout style={{borderRadius:20,overflow:'hidden',marginBottom:20,
          background:cover.bg,position:'relative',height:130}}>
          {coverPhotoUrl&&<img src={coverPhotoUrl} alt="" style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',objectPosition:coverPosition}}/>}
          <motion.div animate={{opacity:[0.2,0.4,0.2]}} transition={{repeat:Infinity,duration:3}}
            style={{position:'absolute',inset:0,background:`radial-gradient(circle at 30% 50%,${vibe.color}55,transparent 70%)`}}/>
          <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,transparent 30%,rgba(0,0,0,0.7))'}}/>
          <div style={{position:'absolute',bottom:12,left:14,display:'flex',alignItems:'flex-end',gap:10}}>
            <div style={{width:52,height:52,borderRadius:'50%',overflow:'hidden',
              background:avatarPhotoUrl?'transparent':`${vibe.color}33`,
              border:`2px solid ${vibe.color}88`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,flexShrink:0}}>
              {avatarPhotoUrl
                ?<img src={avatarPhotoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                :<span>{vibe.emoji}</span>}
            </div>
            <div>
              <p style={{margin:0,fontSize:16,fontWeight:900,color:'#fff',textShadow:'0 2px 8px rgba(0,0,0,0.5)'}}>
                {name||'Название канала'}
              </p>
              <p style={{margin:0,fontSize:11,color:'rgba(255,255,255,0.6)'}}>
                @{handle||(name.toLowerCase().replace(/\s+/g,'_').slice(0,16)||'handle')}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Скрытые инпуты для загрузки фото */}
        <input ref={coverFileRef} type="file" accept="image/*" style={{display:'none'}}
          onChange={e=>{const f=e.target.files?.[0];if(f)openCoverCrop(f);e.target.value='';}}/>
        <input ref={avatarFileRef} type="file" accept="image/*" style={{display:'none'}}
          onChange={e=>{const f=e.target.files?.[0];if(f)uploadAvatar(f);e.target.value='';}}/>

        {/* ─────────────── КРОП-МОДАЛКА ─────────────── */}
        <AnimatePresence>
          {showCoverCrop&&(
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              style={{position:'fixed',inset:0,zIndex:9300,background:'rgba(0,0,0,0.97)',
                display:'flex',flexDirection:'column',overscrollBehavior:'contain'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px 8px',
                borderBottom:'1px solid rgba(255,255,255,0.1)',flexShrink:0}}>
                <motion.button whileTap={{scale:0.92}} onClick={()=>setShowCoverCrop(false)}
                  style={{background:'rgba(255,255,255,0.1)',border:'none',color:'#fff',fontSize:16,
                    width:34,height:34,borderRadius:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  ✕
                </motion.button>
                <div style={{flex:1}}>
                  <div style={{color:'#fff',fontWeight:800,fontSize:14}}>Выбери область обложки</div>
                  <div style={{color:'rgba(255,255,255,0.4)',fontSize:10}}>
                    {coverUploading?'⬆️ Загружаем фото…':'Тяни ползунок или жми кнопки'}
                  </div>
                </div>
                <motion.button whileTap={{scale:0.94}} onClick={applyCoverCrop}
                  disabled={coverUploading}
                  style={{background:coverUploading?'rgba(255,255,255,0.1)':'linear-gradient(135deg,#7c3aed,#a855f7)',
                    border:'none',color:'#fff',fontWeight:800,fontSize:13,borderRadius:20,
                    padding:'7px 18px',cursor:coverUploading?'wait':'pointer',opacity:coverUploading?0.5:1}}>
                  {coverUploading?'…':'Применить'}
                </motion.button>
              </div>
              <div style={{margin:'10px 14px 6px',borderRadius:10,overflow:'hidden',height:72,flexShrink:0,
                border:'2px solid rgba(255,255,255,0.25)',position:'relative',background:cover.bg}}>
                <img src={coverCropSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover',
                  objectPosition:`50% ${cropY}%`,userSelect:'none',pointerEvents:'none'}}/>
                <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                  <span style={{color:'rgba(255,255,255,0.35)',fontSize:9,letterSpacing:'0.12em',textTransform:'uppercase',fontWeight:700}}>
                    Превью обложки канала
                  </span>
                </div>
              </div>
              <div style={{flex:1,overflow:'hidden',position:'relative',margin:'0 14px 0'}}>
                <img src={coverCropSrc} alt="" style={{width:'100%',height:'100%',objectFit:'contain',
                  objectPosition:'center',userSelect:'none',pointerEvents:'none',display:'block'}}/>
                <div style={{position:'absolute',inset:0,pointerEvents:'none'}}>
                  <div style={{position:'absolute',top:0,left:0,right:0,height:`calc(${cropY}% - 12%)`,background:'rgba(0,0,0,0.55)'}}/>
                  <div style={{position:'absolute',bottom:0,left:0,right:0,height:`calc(${100-cropY}% - 12%)`,background:'rgba(0,0,0,0.55)'}}/>
                  <div style={{position:'absolute',top:`calc(${cropY}% - 12%)`,left:0,right:0,height:'24%',
                    border:'2px solid rgba(255,255,255,0.7)',boxShadow:'0 0 0 1px rgba(0,0,0,0.4)',
                    display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <span style={{color:'rgba(255,255,255,0.6)',fontSize:9,fontWeight:700,letterSpacing:'0.1em',
                      textTransform:'uppercase',background:'rgba(0,0,0,0.5)',padding:'2px 8px',borderRadius:4}}>
                      видимая область
                    </span>
                  </div>
                </div>
              </div>
              <div style={{padding:'12px 20px 8px',flexShrink:0}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6}}>
                  <span style={{color:'rgba(255,255,255,0.5)',fontSize:10}}>⬆ сверху</span>
                  <span style={{color:'rgba(255,255,255,0.8)',fontSize:11,fontWeight:700}}>{cropY}%</span>
                  <span style={{color:'rgba(255,255,255,0.5)',fontSize:10}}>снизу ⬇</span>
                </div>
                <input type="range" min={0} max={100} step={1} value={cropY}
                  onChange={e=>setCropY(Number(e.target.value))}
                  style={{width:'100%',accentColor:'#a855f7',cursor:'pointer'}}/>
              </div>
              <div style={{display:'flex',gap:6,padding:'0 20px 16px',flexShrink:0}}>
                {([['Сверху',0],['Центр',50],['Снизу',100]] as [string,number][]).map(([lbl,val])=>(
                  <motion.button key={lbl} whileTap={{scale:0.94}} onClick={()=>setCropY(val)}
                    style={{flex:1,padding:'7px 0',borderRadius:10,cursor:'pointer',fontWeight:700,fontSize:11,
                      border:`1px solid ${cropY===val?'#a855f7':'rgba(255,255,255,0.15)'}`,
                      background:cropY===val?'rgba(168,85,247,0.2)':'rgba(255,255,255,0.05)',
                      color:cropY===val?'#c084fc':'rgba(255,255,255,0.7)'}}>
                    {lbl}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─────────────── ШАГ 0: ОБЛИК ─────────────── */}
        {step===0&&(
          <div style={{display:'flex',flexDirection:'column',gap:16}}>

            {/* Загрузка обложки + аватара */}
            <div style={{display:'flex',gap:10}}>
              <motion.button whileTap={{scale:0.96}} onClick={()=>coverFileRef.current?.click()}
                style={{flex:1,padding:'11px 0',borderRadius:14,border:`1.5px dashed ${coverPhotoUrl?accent:c.border}`,
                  background:coverPhotoUrl?`${accent}15`:'transparent',cursor:'pointer',
                  display:'flex',flexDirection:'column',alignItems:'center',gap:5,
                  color:coverPhotoUrl?accent:c.sub}}>
                {coverUploading
                  ?<motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:0.8,ease:'linear'}}
                    style={{width:20,height:20,border:`2px solid ${c.border}`,borderTopColor:accent,borderRadius:'50%'}}/>
                  :coverPhotoUrl
                    ?<img src={coverPhotoUrl} alt="" style={{width:40,height:28,objectFit:'cover',borderRadius:6}}/>
                    :<span style={{fontSize:24}}>🖼</span>}
                <span style={{fontSize:11,fontWeight:700}}>{coverPhotoUrl?'Обложка ✓':'Фото обложки'}</span>
              </motion.button>

              <motion.button whileTap={{scale:0.96}} onClick={()=>avatarFileRef.current?.click()}
                style={{flex:1,padding:'11px 0',borderRadius:14,border:`1.5px dashed ${avatarPhotoUrl?accent:c.border}`,
                  background:avatarPhotoUrl?`${accent}15`:'transparent',cursor:'pointer',
                  display:'flex',flexDirection:'column',alignItems:'center',gap:5,
                  color:avatarPhotoUrl?accent:c.sub}}>
                {avatarUploading
                  ?<motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:0.8,ease:'linear'}}
                    style={{width:20,height:20,border:`2px solid ${c.border}`,borderTopColor:accent,borderRadius:'50%'}}/>
                  :avatarPhotoUrl
                    ?<img src={avatarPhotoUrl} alt="" style={{width:32,height:32,objectFit:'cover',borderRadius:'50%'}}/>
                    :<span style={{fontSize:24}}>🤳</span>}
                <span style={{fontSize:11,fontWeight:700}}>{avatarPhotoUrl?'Аватар ✓':'Фото аватара'}</span>
              </motion.button>
            </div>

            <div>
              <p style={{margin:'0 0 6px',fontSize:11,color:c.sub,fontWeight:700}}>НАЗВАНИЕ КАНАЛА *</p>
              <input value={name} onChange={e=>setName(e.target.value)}
                placeholder="Как назовёшь свой канал?"
                style={{width:'100%',padding:'12px 14px',borderRadius:12,background:c.card,
                  border:`1px solid ${c.border}`,color:c.light,fontSize:15,outline:'none',boxSizing:'border-box'}}/>
            </div>
            <div>
              <p style={{margin:'0 0 6px',fontSize:11,color:c.sub,fontWeight:700}}>АДРЕС КАНАЛА (@handle)</p>
              <div style={{display:'flex',alignItems:'center',gap:0,background:c.card,
                border:`1px solid ${c.border}`,borderRadius:12,overflow:'hidden'}}>
                <span style={{padding:'12px 10px 12px 14px',fontSize:15,color:c.sub,flexShrink:0}}>@</span>
                <input value={handle} onChange={e=>setHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))}
                  placeholder="my_channel"
                  style={{flex:1,padding:'12px 14px 12px 0',background:'transparent',border:'none',
                    color:c.light,fontSize:15,outline:'none'}}/>
              </div>
            </div>
            <div>
              <p style={{margin:'0 0 6px',fontSize:11,color:c.sub,fontWeight:700}}>ОПИСАНИЕ</p>
              <textarea value={desc} onChange={e=>setDesc(e.target.value)}
                placeholder="О чём твой канал?"
                style={{width:'100%',minHeight:80,padding:'12px 14px',borderRadius:12,background:c.card,
                  border:`1px solid ${c.border}`,color:c.light,fontSize:14,outline:'none',
                  resize:'none',boxSizing:'border-box',fontFamily:'inherit'}}/>
            </div>
            <div>
              <p style={{margin:'0 0 8px',fontSize:11,color:c.sub,fontWeight:700}}>КАТЕГОРИЯ</p>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {CHANNEL_CATEGORIES.map(cat=>(
                  <motion.button key={cat.id} whileTap={{scale:0.9}}
                    onClick={()=>setCatId(cat.id)}
                    style={{padding:'7px 14px',borderRadius:20,border:'none',cursor:'pointer',
                      fontSize:12,fontWeight:700,
                      background:catId===cat.id?accent:'rgba(255,255,255,0.07)',
                      color:catId===cat.id?'#fff':c.sub}}>
                    {cat.emoji} {cat.label}
                  </motion.button>
                ))}
              </div>
            </div>
            <div>
              <p style={{margin:'0 0 6px',fontSize:11,color:c.sub,fontWeight:700}}>ТЕГИ (через запятую)</p>
              <input value={tags} onChange={e=>setTags(e.target.value)}
                placeholder="дизайн, UX, продукт"
                style={{width:'100%',padding:'12px 14px',borderRadius:12,background:c.card,
                  border:`1px solid ${c.border}`,color:c.light,fontSize:14,outline:'none',boxSizing:'border-box'}}/>
            </div>
          </div>
        )}

        {/* ─────────────── ШАГ 1: АТМОСФЕРА ─────────────── */}
        {step===1&&(
          <div style={{display:'flex',flexDirection:'column',gap:20}}>
            <div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <p style={{margin:0,fontSize:13,fontWeight:800,color:c.light}}>🎨 Обложка</p>
                <div style={{display:'flex',gap:6}}>
                  {coverPhotoUrl&&<motion.button whileTap={{scale:0.9}}
                    onClick={()=>{setCropY(parseInt(coverPosition.split(' ')[1]||'50'));setCoverCropSrc(coverPhotoUrl);setCoverCropFinal(coverPhotoUrl);setShowCoverCrop(true);}}
                    style={{padding:'5px 10px',borderRadius:20,border:'1px solid rgba(168,85,247,0.5)',
                      background:'rgba(168,85,247,0.15)',cursor:'pointer',fontSize:11,fontWeight:700,color:'#c084fc'}}>
                    📐 Фрагмент
                  </motion.button>}
                  <motion.button whileTap={{scale:0.9}} onClick={()=>coverFileRef.current?.click()}
                    style={{padding:'5px 12px',borderRadius:20,border:`1px solid ${coverPhotoUrl?accent:c.border}`,
                      background:coverPhotoUrl?`${accent}20`:'transparent',cursor:'pointer',
                      fontSize:11,fontWeight:700,color:coverPhotoUrl?accent:c.sub}}>
                    {coverUploading?'⬆️ …':(coverPhotoUrl?'🖼 Заменить':'🖼 Загрузить фото')}
                  </motion.button>
                  {coverPhotoUrl&&<motion.button whileTap={{scale:0.9}} onClick={()=>setCoverPhotoUrl('')}
                    style={{padding:'5px 10px',borderRadius:20,border:'1px solid rgba(239,68,68,0.3)',
                      background:'rgba(239,68,68,0.1)',cursor:'pointer',fontSize:11,fontWeight:700,color:'#ef4444'}}>
                    ✕
                  </motion.button>}
                </div>
              </div>
              {coverPhotoUrl&&(
                <div style={{borderRadius:12,overflow:'hidden',height:60,marginBottom:8,position:'relative'}}>
                  <img src={coverPhotoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:coverPosition}}/>
                  <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',
                    background:'rgba(0,0,0,0.3)'}}>
                    <span style={{fontSize:11,color:'rgba(255,255,255,0.8)',fontWeight:700}}>Твоя обложка активна · {coverPosition}</span>
                  </div>
                </div>
              )}
              <p style={{margin:'0 0 8px',fontSize:11,color:c.sub}}>{coverPhotoUrl?'Градиент будет фоном под фото:':'Или выбери градиент:'}</p>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                {CHANNEL_GRADIENTS.map((g,i)=>(
                  <motion.button key={i} whileTap={{scale:0.9}} onClick={()=>setCoverIdx(i)}
                    style={{height:52,borderRadius:12,border:coverIdx===i?`2.5px solid ${accent}`:'2px solid rgba(255,255,255,0.1)',
                      background:g.bg,cursor:'pointer',display:'flex',alignItems:'flex-end',
                      justifyContent:'center',padding:'0 0 5px',
                      boxShadow:coverIdx===i?`0 0 10px ${accent}66`:'none'}}>
                    <span style={{fontSize:9,color:'rgba(255,255,255,0.7)',fontWeight:700}}>{g.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>
            <div>
              <p style={{margin:'0 0 10px',fontSize:13,fontWeight:800,color:c.light}}>⚡ Вайб канала</p>
              <p style={{margin:'0 0 10px',fontSize:12,color:c.sub}}>
                Вайб — это энергетика твоего канала. Появляется в лентах и подсвечивает активность.
              </p>
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8}}>
                {CHANNEL_VIBES.map((v,i)=>(
                  <motion.button key={i} whileTap={{scale:0.9}} onClick={()=>setVibeIdx(i)}
                    style={{padding:'10px 4px',borderRadius:12,border:vibeIdx===i?`2px solid ${v.color}`:'1px solid rgba(255,255,255,0.1)',
                      background:vibeIdx===i?`${v.color}20`:'rgba(255,255,255,0.04)',
                      cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',gap:4,
                      boxShadow:vibeIdx===i?`0 0 10px ${v.color}44`:'none'}}>
                    <span style={{fontSize:22}}>{v.emoji}</span>
                    <span style={{fontSize:9,color:vibeIdx===i?v.color:c.sub,fontWeight:700}}>{v.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>
            <div style={{padding:'14px',background:`${vibe.color}12`,borderRadius:14,
              border:`1px solid ${vibe.color}33`}}>
              <p style={{margin:0,fontSize:13,color:vibe.color,fontWeight:800}}>
                {vibe.emoji} {vibe.label} — что это значит?
              </p>
              <p style={{margin:'6px 0 0',fontSize:12,color:c.sub,lineHeight:1.6}}>
                {vibeIdx===0&&'Твой контент горит! Высокая активность и вовлечённость аудитории.'}
                {vibeIdx===1&&'Только качественный контент. Премиум-ощущение для подписчиков.'}
                {vibeIdx===2&&'Ты всегда первый. Инновации, тренды и прорывные идеи.'}
                {vibeIdx===3&&'Постоянный поток контента. Регулярные публикации, органический рост.'}
                {vibeIdx===4&&'Высокая энергия каждого поста. Заряжаешь аудиторию.'}
                {vibeIdx===5&&'Точно в цель. Конкретный, полезный контент без воды.'}
                {vibeIdx===6&&'Ты звезда этой сферы. Статусный канал с узнаваемым голосом.'}
                {vibeIdx===7&&'Искусство и творчество. Эстетика, визуал, вдохновение.'}
                {vibeIdx===8&&'Глубокие мысли и инсайты. Для думающей аудитории.'}
                {vibeIdx===9&&'Шоу-формат! Яркий, захватывающий, непредсказуемый контент.'}
              </p>
            </div>

            {/* Аватар канала */}
            <div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <p style={{margin:0,fontSize:13,fontWeight:800,color:c.light}}>🤳 Аватар канала</p>
                <div style={{display:'flex',gap:6}}>
                  <motion.button whileTap={{scale:0.9}} onClick={()=>avatarFileRef.current?.click()}
                    style={{padding:'5px 12px',borderRadius:20,border:`1px solid ${avatarPhotoUrl?accent:c.border}`,
                      background:avatarPhotoUrl?`${accent}20`:'transparent',cursor:'pointer',
                      fontSize:11,fontWeight:700,color:avatarPhotoUrl?accent:c.sub}}>
                    {avatarUploading?'⬆️ …':(avatarPhotoUrl?'🤳 Заменить':'🤳 Загрузить фото')}
                  </motion.button>
                  {avatarPhotoUrl&&<motion.button whileTap={{scale:0.9}} onClick={()=>setAvatarPhotoUrl('')}
                    style={{padding:'5px 10px',borderRadius:20,border:'1px solid rgba(239,68,68,0.3)',
                      background:'rgba(239,68,68,0.1)',cursor:'pointer',fontSize:11,fontWeight:700,color:'#ef4444'}}>
                    ✕
                  </motion.button>}
                </div>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px',
                background:c.card,borderRadius:14,border:`1px solid ${c.border}`}}>
                <div style={{width:52,height:52,borderRadius:'50%',overflow:'hidden',flexShrink:0,
                  background:vibe.color+'22',border:`2px solid ${vibe.color}66`,
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>
                  {avatarPhotoUrl
                    ?<img src={avatarPhotoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    :<span>{vibe.emoji}</span>}
                </div>
                <div style={{flex:1}}>
                  <p style={{margin:0,fontSize:13,color:c.light,fontWeight:700}}>
                    {avatarPhotoUrl?'Твоя фото как аватар':'Аватар = вайб-эмодзи'}
                  </p>
                  <p style={{margin:'3px 0 0',fontSize:11,color:c.sub,lineHeight:1.4}}>
                    {avatarPhotoUrl?'Нажми «Заменить» чтобы загрузить другую':'Загрузи фото логотипа или любое изображение'}
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ─────────────── ШАГ 2: РУБРИКИ ─────────────── */}
        {step===2&&(
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{padding:'14px',background:`${accent}10`,borderRadius:14,border:`1px solid ${accent}28`}}>
              <p style={{margin:0,fontSize:14,fontWeight:800,color:accent}}>🎭 Что такое рубрики?</p>
              <p style={{margin:'6px 0 0',fontSize:13,color:c.sub,lineHeight:1.6}}>
                Рубрики — это твои собственные разделы внутри канала. Как категории в журнале.
                Подписчики смогут фильтровать контент по рубрикам.
              </p>
            </div>
            <div>
              <p style={{margin:'0 0 8px',fontSize:11,color:c.sub,fontWeight:700}}>ПОПУЛЯРНЫЕ РУБРИКИ</p>
              <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                {SAMPLE_RUBRICS.map(r=>(
                  <motion.button key={r} whileTap={{scale:0.9}}
                    onClick={()=>setRubrics(rs=>rs.includes(r)?rs.filter(x=>x!==r):[...rs,r])}
                    style={{padding:'7px 14px',borderRadius:20,fontSize:12,fontWeight:700,cursor:'pointer',border:'none',
                      background:rubrics.includes(r)?accent:'rgba(255,255,255,0.07)',
                      color:rubrics.includes(r)?'#fff':c.sub}}>
                    {r}
                  </motion.button>
                ))}
              </div>
            </div>
            <div>
              <p style={{margin:'0 0 6px',fontSize:11,color:c.sub,fontWeight:700}}>СВОЯ РУБРИКА</p>
              <div style={{display:'flex',gap:8}}>
                <input value={customRubric} onChange={e=>setCustomRubric(e.target.value)}
                  placeholder="Например: 🎵 Треки недели"
                  onKeyDown={e=>{if(e.key==='Enter'&&customRubric.trim()){setRubrics(rs=>[...rs,customRubric.trim()]);setCustomRubric('');}}}
                  style={{flex:1,padding:'10px 12px',borderRadius:10,background:c.card,
                    border:`1px solid ${c.border}`,color:c.light,fontSize:13,outline:'none'}}/>
                <button onClick={()=>{if(customRubric.trim()){setRubrics(rs=>[...rs,customRubric.trim()]);setCustomRubric('');}}}
                  style={{padding:'10px 16px',borderRadius:10,background:accent,border:'none',
                    color:'#fff',fontWeight:800,cursor:'pointer',fontSize:13}}>+</button>
              </div>
            </div>
            {rubrics.length>0&&(
              <div>
                <p style={{margin:'0 0 8px',fontSize:11,color:c.sub,fontWeight:700}}>ТВОИ РУБРИКИ ({rubrics.length})</p>
                <div style={{display:'flex',flexDirection:'column',gap:6}}>
                  {rubrics.map(r=>(
                    <div key={r} style={{display:'flex',alignItems:'center',padding:'9px 12px',
                      background:c.card,borderRadius:10,border:`1px solid ${c.border}`}}>
                      <span style={{flex:1,fontSize:13,color:c.light}}>{r}</span>
                      <button onClick={()=>setRubrics(rs=>rs.filter(x=>x!==r))}
                        style={{background:'none',border:'none',cursor:'pointer',color:c.sub,fontSize:16}}>✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─────────────── ШАГ 3: ФИНАЛ ─────────────── */}
        {step===3&&(
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div style={{padding:'20px',background:`linear-gradient(135deg,${vibe.color}15,${vibe.color}06)`,
              borderRadius:20,border:`1px solid ${vibe.color}30`,textAlign:'center'}}>
              <motion.div animate={{scale:[1,1.1,1]}} transition={{repeat:Infinity,duration:2}}>
                <span style={{fontSize:48}}>{vibe.emoji}</span>
              </motion.div>
              <p style={{margin:'12px 0 4px',fontSize:18,fontWeight:900,color:c.light}}>{name||'Твой канал'}</p>
              <p style={{margin:'0 0 4px',fontSize:12,color:c.sub}}>@{handle||'handle'}</p>
              <p style={{margin:'0 0 12px',fontSize:13,color:c.mid,lineHeight:1.5}}>{desc||'Без описания'}</p>
              <div style={{display:'flex',justifyContent:'center',gap:12,flexWrap:'wrap'}}>
                <span style={{fontSize:12,color:vibe.color,fontWeight:700}}>{vibe.emoji} {vibe.label}</span>
                <span style={{fontSize:12,color:c.sub}}>·</span>
                <span style={{fontSize:12,color:c.sub}}>{cat.emoji} {cat.label}</span>
                {rubrics.length>0&&<><span style={{fontSize:12,color:c.sub}}>·</span>
                <span style={{fontSize:12,color:accent}}>{rubrics.length} рубрик</span></>}
              </div>
            </div>

            <div style={{padding:'14px',background:c.card,borderRadius:14,border:`1px solid ${c.border}`}}>
              <p style={{margin:'0 0 10px',fontSize:13,fontWeight:800,color:c.light}}>🚀 Что тебя ждёт:</p>
              {[
                `${vibe.emoji} Вайб «${vibe.label}» — твоя энергетика`,
                `🎨 Обложка «${cover.label}»`,
                rubrics.length>0?`🎭 ${rubrics.length} рубрик(и): ${rubrics.slice(0,2).join(', ')}${rubrics.length>2?'…':''}`:null,
                '⏳ Временные капсулы — посты из будущего',
                '📺 Серии и эпизоды — сезонный контент',
                '🔥 Взвешенные реакции — вовлечённость аудитории',
              ].filter(Boolean).map((f,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:vibe.color,flexShrink:0}}/>
                  <span style={{fontSize:13,color:c.mid}}>{f as string}</span>
                </div>
              ))}
            </div>

            <motion.button whileTap={{scale:0.97}} onClick={handleCreate}
              style={{width:'100%',padding:'16px',borderRadius:16,border:'none',cursor:'pointer',
                background:`linear-gradient(135deg,${vibe.color}dd,${accent})`,
                color:'#fff',fontSize:16,fontWeight:900,
                boxShadow:`0 6px 24px ${vibe.color}44`}}>
              {vibe.emoji} Создать канал!
            </motion.button>
          </div>
        )}

        {/* Кнопка Далее */}
        {step<3&&(
          <motion.button whileTap={{scale:0.97}} onClick={()=>setStep(s=>s+1)}
            disabled={step===0&&!name.trim()}
            style={{width:'100%',padding:'15px',borderRadius:16,border:'none',cursor:'pointer',
              marginTop:20,
              background:step===0&&!name.trim()?'rgba(255,255,255,0.08)':`linear-gradient(135deg,${vibe.color}cc,${accent})`,
              color:step===0&&!name.trim()?c.sub:'#fff',
              fontSize:15,fontWeight:900}}>
            Далее →
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
