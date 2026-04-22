import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ══════════════════════════════════════════════════════
   ТИПЫ
══════════════════════════════════════════════════════ */
interface Reaction { fire:number; rocket:number; gem:number; heart:number; think:number; }
type ReactionKey = keyof Reaction;

interface ChannelPost {
  id: string;
  type: 'text'|'photo'|'video'|'poll'|'announce'|'capsule'|'episode';
  text: string;
  imageUrl?: string;
  videoUrl?: string;
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
function ChanAvatar({ch,size=44}:{ch:SwaipChannel;size?:number}) {
  return (
    <div style={{width:size,height:size,borderRadius:'50%',overflow:'hidden',flexShrink:0,
      background:ch.coverGradient,display:'flex',alignItems:'center',justifyContent:'center',
      fontSize:size*0.42,border:'2px solid rgba(255,255,255,0.15)',position:'relative'}}>
      {ch.coverPhotoUrl
        ?<img src={ch.coverPhotoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
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
function ChannelPage({ch,c,accent,isDark,onBack,onReact,onVote,onOpenCapsule,onPin,onDelete,activeRubric,onRubric,onCompose,onAddPost,tick}:{
  ch:SwaipChannel;c:Props['c'];accent:string;isDark:boolean;
  onBack:()=>void;
  onReact:(chId:string,postId:string,key:ReactionKey)=>void;
  onVote:(chId:string,postId:string,idx:number)=>void;
  onOpenCapsule:(chId:string,postId:string)=>void;
  onPin:(chId:string,postId:string)=>void;
  onDelete:(chId:string,postId:string)=>void;
  activeRubric:string|null;onRubric:(r:string|null)=>void;
  onCompose:()=>void;
  onAddPost:(chId:string,post:Omit<ChannelPost,'id'|'reactions'|'views'|'createdAt'|'isPinned'>)=>void;
  tick:number;
}) {
  const [showCompose,setShowCompose]=useState(false);
  const cat=CHANNEL_CATEGORIES.find(x=>x.id===ch.category);

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
      <div style={{position:'relative',height:160,overflow:'hidden',background:ch.coverGradient}}>
        {ch.coverPhotoUrl&&<img src={ch.coverPhotoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover',opacity:0.6}}/>}
        {/* Анимированный пульс-фон */}
        <motion.div animate={{opacity:[0.15,0.3,0.15]}} transition={{repeat:Infinity,duration:3}}
          style={{position:'absolute',inset:0,background:`radial-gradient(circle at 30% 50%,${ch.vibeColor}44,transparent 70%)`}}/>
        <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.7))'}}/>
        <button onClick={onBack} style={{position:'absolute',top:14,left:14,width:36,height:36,borderRadius:'50%',
          background:'rgba(0,0,0,0.4)',border:'1px solid rgba(255,255,255,0.2)',
          color:'#fff',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)'}}>
          ←
        </button>
        {/* Пульс-индикатор справа */}
        <div style={{position:'absolute',top:16,right:14,display:'flex',alignItems:'center',gap:6,
          background:'rgba(0,0,0,0.45)',borderRadius:20,padding:'5px 10px',backdropFilter:'blur(8px)'}}>
          <motion.div animate={{scale:[1,1.3,1]}} transition={{repeat:Infinity,duration:1.5}}
            style={{width:8,height:8,borderRadius:'50%',background:ch.vibeColor}}/>
          <span style={{fontSize:11,color:'#fff',fontWeight:700}}>ПУЛЬС {ch.energyLevel}%</span>
        </div>
        {/* Инфо */}
        <div style={{position:'absolute',bottom:12,left:14,right:14}}>
          <div style={{display:'flex',alignItems:'flex-end',gap:10}}>
            <ChanAvatar ch={ch} size={52}/>
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
            onDelete={()=>onDelete(ch.id,post.id)}/>
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
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   КАРТОЧКА ПОСТА
══════════════════════════════════════════════════════ */
function PostCard({post,ch,c,accent,tick,onReact,onVote,onOpenCapsule,onPin,onDelete}:{
  post:ChannelPost;ch:SwaipChannel;c:Props['c'];accent:string;tick:number;
  onReact:(key:ReactionKey)=>void;onVote:(idx:number)=>void;
  onOpenCapsule:()=>void;onPin:()=>void;onDelete:()=>void;
}) {
  const [showActions,setShowActions]=useState(false);
  const isPinned=ch.pinnedPostId===post.id;
  const score=calcPostScore(post.reactions);

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
        <div style={{display:'flex',gap:6,padding:'0 14px 10px'}}>
          <button onClick={()=>{onPin();setShowActions(false);}}
            style={{flex:1,padding:'7px',borderRadius:10,background:'rgba(255,255,255,0.06)',border:isPinned?`1px solid rgba(234,179,8,0.5)`:`1px solid ${c.border}`,
              color:isPinned?'#fbbf24':c.mid,fontSize:11,fontWeight:700,cursor:'pointer'}}>
            {isPinned?'📌 Снять':'📌 Закрепить'}
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
function ComposePost({ch,c,accent,isDark,onClose,onPublish}:{
  ch:SwaipChannel;c:Props['c'];accent:string;isDark:boolean;
  onClose:()=>void;
  onPublish:(post:Omit<ChannelPost,'id'|'reactions'|'views'|'createdAt'|'isPinned'>)=>void;
}) {
  const [type,setType]=useState<ChannelPost['type']>('text');
  const [text,setText]=useState('');
  const [imageUrl,setImageUrl]=useState('');
  const [rubric,setRubric]=useState('');
  const [isExclusive,setIsExclusive]=useState(false);
  const [pollQ,setPollQ]=useState('');
  const [pollOpts,setPollOpts]=useState(['','']);
  const [announceAt,setAnnounceAt]=useState('');
  const [opensAt,setOpensAt]=useState('');
  const [seriesName,setSeriesName]=useState('');
  const [episodeNum,setEpisodeNum]=useState(1);
  const [uploading,setUploading]=useState(false);
  const imgRef=useRef<HTMLInputElement>(null);

  const POST_TYPES:[ChannelPost['type'],string,string][]=[
    ['text','✍️','Текст'],['photo','📸','Фото'],['poll','📊','Опрос'],
    ['announce','📣','Анонс'],['capsule','⏳','Капсула'],['episode','📺','Эпизод'],
  ];

  const handlePublish=()=>{
    if(type==='text'&&!text.trim())return;
    if(type==='poll'&&(!pollQ.trim()||pollOpts.filter(o=>o.trim()).length<2))return;
    const base={type,text:text.trim(),rubric:rubric||undefined,isExclusive};
    if(type==='poll')Object.assign(base,{pollQuestion:pollQ,pollOptions:pollOpts.filter(o=>o.trim()).map(t=>({text:t,votes:0}))});
    if(type==='announce'&&announceAt)Object.assign(base,{announceAt:new Date(announceAt).getTime()});
    if(type==='capsule'&&opensAt)Object.assign(base,{opensAt:new Date(opensAt).getTime(),capsuleOpened:false});
    if(type==='episode')Object.assign(base,{seriesName,episodeNum});
    if(imageUrl)Object.assign(base,{imageUrl});
    onPublish(base as Omit<ChannelPost,'id'|'reactions'|'views'|'createdAt'|'isPinned'>);
  };

  const uploadImage=async(f:File)=>{
    const url=URL.createObjectURL(f);
    setUploading(true);
    try{
      const r=await fetch(`${window.location.origin}/api/image-upload`,{
        method:'POST',headers:{'Content-Type':f.type},body:f});
      if(r.ok){const{url:u}=await r.json();setImageUrl(u);}
      else setImageUrl(url);
    }catch{setImageUrl(url);}finally{setUploading(false);}
  };

  return (
    <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
      transition={{type:'spring',damping:28,stiffness:280}}
      style={{position:'fixed',inset:0,zIndex:900,background:c.bg,overflowY:'auto',paddingBottom:40}}>

      {/* Заголовок */}
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'16px 16px 12px',
        borderBottom:`1px solid ${c.border}`,position:'sticky',top:0,background:c.bg,zIndex:2}}>
        <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',
          fontSize:16,color:c.sub,padding:4}}>✕</button>
        <div style={{flex:1}}>
          <p style={{margin:0,fontSize:15,fontWeight:800,color:c.light}}>Новый пост</p>
          <p style={{margin:0,fontSize:11,color:c.sub}}>{ch.name}</p>
        </div>
        <motion.button whileTap={{scale:0.95}} onClick={handlePublish}
          style={{padding:'9px 20px',borderRadius:20,border:'none',cursor:'pointer',
            background:`linear-gradient(135deg,${ch.vibeColor}cc,${accent})`,
            color:'#fff',fontSize:13,fontWeight:800}}>
          Опубликовать
        </motion.button>
      </div>

      <div style={{padding:'16px'}}>
        {/* Тип поста */}
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

        {/* Рубрика */}
        {ch.rubrics.length>0&&(
          <div style={{marginBottom:14}}>
            <p style={{margin:'0 0 6px',fontSize:11,color:c.sub,fontWeight:700}}>РУБРИКА</p>
            <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
              <button onClick={()=>setRubric('')}
                style={{padding:'5px 12px',borderRadius:20,border:`1px solid ${rubric===''?accent:c.border}`,
                  background:rubric===''?`${accent}25`:'transparent',color:rubric===''?accent:c.sub,
                  fontSize:11,fontWeight:700,cursor:'pointer'}}>Без рубрики</button>
              {ch.rubrics.map(r=>(
                <button key={r} onClick={()=>setRubric(r)}
                  style={{padding:'5px 12px',borderRadius:20,border:`1px solid ${rubric===r?accent:c.border}`,
                    background:rubric===r?`${accent}25`:'transparent',color:rubric===r?accent:c.sub,
                    fontSize:11,fontWeight:700,cursor:'pointer'}}>{r}</button>
              ))}
            </div>
          </div>
        )}

        {/* Текст */}
        <textarea value={text} onChange={e=>setText(e.target.value)}
          placeholder={type==='capsule'?'Подсказка (будет видна до открытия)…':'Что хочешь рассказать?'}
          style={{width:'100%',minHeight:120,background:c.card,border:`1px solid ${c.border}`,
            borderRadius:14,padding:'12px 14px',color:c.light,fontSize:15,lineHeight:1.6,
            resize:'none',outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}/>

        {/* Фото */}
        {(type==='text'||type==='photo'||type==='episode')&&(
          <div style={{marginTop:12}}>
            {imageUrl
              ?<div style={{position:'relative'}}>
                <img src={imageUrl} alt="" style={{width:'100%',borderRadius:12,objectFit:'cover',maxHeight:200}}/>
                <button onClick={()=>setImageUrl('')} style={{position:'absolute',top:6,right:6,
                  width:28,height:28,borderRadius:'50%',background:'rgba(0,0,0,0.7)',
                  border:'none',color:'#fff',cursor:'pointer',fontSize:14}}>✕</button>
              </div>
              :<motion.button whileTap={{scale:0.97}} onClick={()=>imgRef.current?.click()}
                style={{width:'100%',padding:'14px',borderRadius:12,border:`1.5px dashed ${c.border}`,
                  background:'transparent',color:c.sub,fontSize:13,cursor:'pointer'}}>
                {uploading?'⬆️ Загружаем…':'📸 Добавить фото'}
              </motion.button>}
            <input ref={imgRef} type="file" accept="image/*" style={{display:'none'}}
              onChange={e=>{const f=e.target.files?.[0];if(f)uploadImage(f);e.target.value='';}}/>
          </div>
        )}

        {/* Опрос */}
        {type==='poll'&&(
          <div style={{marginTop:12,display:'flex',flexDirection:'column',gap:8}}>
            <input value={pollQ} onChange={e=>setPollQ(e.target.value)}
              placeholder="Вопрос опроса…"
              style={{padding:'10px 14px',borderRadius:10,background:c.card,
                border:`1px solid ${c.border}`,color:c.light,fontSize:14,outline:'none'}}/>
            {pollOpts.map((o,i)=>(
              <div key={i} style={{display:'flex',gap:6}}>
                <input value={o} onChange={e=>setPollOpts(os=>os.map((v,j)=>j===i?e.target.value:v))}
                  placeholder={`Вариант ${i+1}`}
                  style={{flex:1,padding:'9px 12px',borderRadius:10,background:c.card,
                    border:`1px solid ${c.border}`,color:c.light,fontSize:13,outline:'none'}}/>
                {i>1&&<button onClick={()=>setPollOpts(os=>os.filter((_,j)=>j!==i))}
                  style={{background:'none',border:'none',color:c.sub,cursor:'pointer',fontSize:18}}>✕</button>}
              </div>
            ))}
            {pollOpts.length<6&&<button onClick={()=>setPollOpts(os=>[...os,''])}
              style={{padding:'8px',borderRadius:10,border:`1.5px dashed ${c.border}`,
                background:'transparent',color:c.sub,fontSize:12,cursor:'pointer'}}>
              + Добавить вариант
            </button>}
          </div>
        )}

        {/* Анонс */}
        {type==='announce'&&(
          <div style={{marginTop:12}}>
            <p style={{margin:'0 0 6px',fontSize:11,color:c.sub,fontWeight:700}}>ДАТА И ВРЕМЯ СОБЫТИЯ</p>
            <input type="datetime-local" value={announceAt} onChange={e=>setAnnounceAt(e.target.value)}
              style={{width:'100%',padding:'10px 12px',borderRadius:10,background:c.card,
                border:`1px solid ${c.border}`,color:c.light,fontSize:13,outline:'none',boxSizing:'border-box'}}/>
          </div>
        )}

        {/* Капсула */}
        {type==='capsule'&&(
          <div style={{marginTop:12}}>
            <p style={{margin:'0 0 6px',fontSize:11,color:'rgba(251,191,36,0.7)',fontWeight:700}}>ОТКРЫТЬ КАПСУЛУ:</p>
            <input type="datetime-local" value={opensAt} onChange={e=>setOpensAt(e.target.value)}
              style={{width:'100%',padding:'10px 12px',borderRadius:10,background:'rgba(251,191,36,0.08)',
                border:'1px solid rgba(251,191,36,0.3)',color:'#fbbf24',fontSize:13,outline:'none',boxSizing:'border-box'}}/>
          </div>
        )}

        {/* Эпизод */}
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

        {/* Эксклюзив */}
        <div style={{marginTop:14,display:'flex',alignItems:'center',gap:10}}>
          <button onClick={()=>setIsExclusive(s=>!s)}
            style={{width:40,height:24,borderRadius:12,border:'none',cursor:'pointer',
              background:isExclusive?accent:'rgba(255,255,255,0.15)',transition:'all 0.2s',position:'relative'}}>
            <div style={{position:'absolute',top:3,width:18,height:18,borderRadius:'50%',
              background:'#fff',transition:'left 0.2s',left:isExclusive?19:3}}/>
          </button>
          <span style={{fontSize:13,color:isExclusive?'#fbbf24':c.sub,fontWeight:isExclusive?700:400}}>
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

  const vibe=CHANNEL_VIBES[vibeIdx];
  const cover=CHANNEL_GRADIENTS[coverIdx];
  const cat=CHANNEL_CATEGORIES.find(x=>x.id===catId)!;

  const handleCreate=()=>{
    if(!name.trim())return;
    const ch:SwaipChannel={
      id:uid(),
      name:name.trim(),
      handle:handle.trim()||name.toLowerCase().replace(/\s+/g,'_').replace(/[^a-z0-9_]/g,''),
      description:desc.trim(),
      vibe:vibe.emoji,vibeColor:vibe.color,
      coverGradient:cover.bg,
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
          background:cover.bg,position:'relative',height:120}}>
          <motion.div animate={{opacity:[0.2,0.4,0.2]}} transition={{repeat:Infinity,duration:3}}
            style={{position:'absolute',inset:0,background:`radial-gradient(circle at 30% 50%,${vibe.color}55,transparent 70%)`}}/>
          <div style={{position:'absolute',bottom:12,left:14,display:'flex',alignItems:'flex-end',gap:10}}>
            <div style={{width:48,height:48,borderRadius:'50%',background:`${vibe.color}33`,
              border:`2px solid ${vibe.color}66`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>
              {vibe.emoji}
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

        {/* ─────────────── ШАГ 0: ОБЛИК ─────────────── */}
        {step===0&&(
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
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
              <p style={{margin:'0 0 10px',fontSize:13,fontWeight:800,color:c.light}}>🎨 Тема обложки</p>
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
