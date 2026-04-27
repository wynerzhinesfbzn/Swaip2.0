import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { checkContent, collectPostText } from './contentFilter';
import { BgMusicAutoplay, BgMusicPicker, type BgMusicPreset } from './BgMusic';
import { PostExtrasComposer, PostExtrasRenderer, hasAnyExtras, type PostExtras } from './PostExtras';
import {
  TemplatePicker, ChannelEmployeeRoster, ChannelPriceList, ChannelUSPBanner,
  CHANNEL_TEMPLATES,
  type ChannelTemplate, type ChannelEmployee, type PriceItem,
} from './ChannelTemplates';

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
  bookingSlots?: {time:string;booked:boolean}[];
  bookingLabel?: string;
  /* extras (универсальный «+ Добавить в пост») */
  extras?: PostExtras;
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
  /* бизнес-шаблон */
  templateId?: string;
  usp?: string;
  keywords?: string[];
  employees?: ChannelEmployee[];
  priceList?: PriceItem[];
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
   ТИПЫ ГРУПП
══════════════════════════════════════════════════════ */
interface GroupComment { id:string; text:string; author:string; avatar:string; isAnon:boolean; createdAt:number; }
interface BrainstormIdea { id:string; text:string; author:string; votes:number; }
interface GroupPost {
  id: string;
  type: 'text'|'poll'|'brainstorm'|'challenge'|'confession'|'roulette'|'event'|'capsule'|'mood'|'collab';
  text: string;
  authorName: string;
  authorAvatar: string;
  isAnon: boolean;
  createdAt: number;
  likes: number;
  myLiked: boolean;
  likedBy?: {name:string;avatar:string}[];
  comments: GroupComment[];
  imageUrl?: string;
  /* poll */
  pollQuestion?: string;
  pollOptions?: {text:string;votes:number}[];
  pollVotedIdx?: number;
  /* brainstorm */
  brainstormIdeas?: BrainstormIdea[];
  /* challenge */
  challengeDeadline?: number;
  challengeCompleted?: number;
  /* event */
  eventTitle?: string;
  eventAt?: number;
  eventJoined?: number;
  /* capsule */
  capsuleOpensAt?: number;
  capsuleOpened?: boolean;
  /* collab */
  collabParts?: {author:string;text:string}[];
  /* roulette answer */
  rouletteQuestion?: string;
  rouletteAnswer?: string;
  /* bg music */
  bgMusicUrl?: string;
  bgMusicLabel?: string;
  /* extras (универсальный «+ Добавить в пост») */
  extras?: PostExtras;
}

type GroupRole = 'founder'|'moderator'|'vip'|'activist'|'member';
interface GroupMember { hash:string; name:string; avatar:string; role:GroupRole; score:number; joinedAt:number; }

interface SwaipGroup {
  id: string;
  name: string;
  handle: string;
  description: string;
  emoji: string;
  color: string;
  gradient: string;
  category: string;
  createdAt: number;
  posts: GroupPost[];
  members: GroupMember[];
  wordOfDay: string;
  wordSetAt: number;
  todayMood: string;
  streak: number;
  isPrivate: boolean;
}

/* ══════════════════════════════════════════════════════
   ХРАНИЛИЩЕ ГРУПП
══════════════════════════════════════════════════════ */
function useGroupsStore(userHash:string):[SwaipGroup[],React.Dispatch<React.SetStateAction<SwaipGroup[]>>] {
  const KEY=`swaip_account_${userHash}_groups_v1`;
  const [groups,setGroupsRaw]=useState<SwaipGroup[]>(()=>{
    try{ const s=localStorage.getItem(KEY); return s?JSON.parse(s):[]; }catch{ return []; }
  });
  const setGroups:React.Dispatch<React.SetStateAction<SwaipGroup[]>>=(action)=>{
    setGroupsRaw(prev=>{
      const next=typeof action==='function'?(action as (p:SwaipGroup[])=>SwaipGroup[])(prev):action;
      try{ localStorage.setItem(KEY,JSON.stringify(next)); }catch{}
      return next;
    });
  };
  return [groups,setGroups];
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
  const [groups, setGroups] = useGroupsStore(userHash);
  const [activeTab, setActiveTab] = useState<'channels'|'groups'>('channels');
  const [openId, setOpenId] = useState<string|null>(null);
  const [openGroupId, setOpenGroupId] = useState<string|null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateType, setShowCreateType] = useState<'channel'|'group'|null>(null);
  const [showCompose, setShowCompose] = useState(false);
  const [activeRubric, setActiveRubric] = useState<string|null>(null);
  const [tick, setTick] = useState(0);

  useEffect(()=>{ const t=setInterval(()=>setTick(n=>n+1),1000); return()=>clearInterval(t); },[]);

  const openCh = channels.find(ch=>ch.id===openId)||null;
  const openGr = groups.find(g=>g.id===openGroupId)||null;

  useEffect(()=>{
    if(!isActive)return;
    const handler=(e:PopStateEvent)=>{ e.preventDefault(); if(openId)setOpenId(null); if(openGroupId)setOpenGroupId(null); };
    window.addEventListener('popstate',handler);
    return()=>window.removeEventListener('popstate',handler);
  },[isActive,openId,openGroupId]);

  /* ── Channel mutations ── */
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
    setChannels(cs=>cs.map(ch=>ch.id!==chId?ch:{...ch,posts:ch.posts.map(p=>p.id===postId?{...p,capsuleOpened:true}:p)}));
  };
  const pinPost=(chId:string,postId:string)=>{
    setChannels(cs=>cs.map(ch=>ch.id!==chId?ch:{...ch,pinnedPostId:ch.pinnedPostId===postId?null:postId}));
  };
  const deletePost=(chId:string,postId:string)=>{
    setChannels(cs=>cs.map(ch=>ch.id!==chId?ch:{...ch,posts:ch.posts.filter(p=>p.id!==postId),pinnedPostId:ch.pinnedPostId===postId?null:ch.pinnedPostId}));
  };
  const updateChannel=(chId:string,patch:Partial<SwaipChannel>)=>{
    setChannels(cs=>cs.map(ch=>ch.id!==chId?ch:{...ch,...patch}));
  };
  const bookPost=(chId:string,postId:string,time?:string)=>{
    setChannels(cs=>cs.map(ch=>ch.id!==chId?ch:{...ch,posts:ch.posts.map(p=>{
      if(p.id!==postId||!p.hasBooking||!time||!p.bookingSlots?.length)return p;
      return{...p,bookingSlots:p.bookingSlots.map(s=>s.time===time?{...s,booked:true}:s)};
    })}));
  };
  const editPostBooking=(chId:string,postId:string,patch:{bookingSlots?:{time:string;booked:boolean}[];bookingLabel?:string;hasBooking?:boolean})=>{
    setChannels(cs=>cs.map(ch=>ch.id!==chId?ch:{...ch,posts:ch.posts.map(p=>p.id!==postId?p:{...p,...patch})}));
  };
  const addPost=(chId:string,post:Omit<ChannelPost,'id'|'reactions'|'views'|'createdAt'|'isPinned'>)=>{
    const newPost:ChannelPost={...post,id:uid(),reactions:{fire:0,rocket:0,gem:0,heart:0,think:0},views:0,createdAt:Date.now(),isPinned:false,...(post.hasBooking?{hasBooking:true,bookingLabel:post.bookingLabel||'Записаться',bookingSlots:post.bookingSlots||[]}:{})};
    setChannels(cs=>cs.map(ch=>ch.id!==chId?ch:{...ch,posts:[newPost,...ch.posts]}));
  };

  /* ── Group mutations ── */
  const addGroupPost=(gId:string,post:Omit<GroupPost,'id'|'createdAt'|'likes'|'myLiked'|'comments'>)=>{
    const np:GroupPost={...post,id:uid(),createdAt:Date.now(),likes:0,myLiked:false,likedBy:[],comments:[]};
    setGroups(gs=>gs.map(g=>g.id!==gId?g:{...g,posts:[np,...g.posts],streak:g.streak}));
  };
  const likeGroupPost=(gId:string,postId:string)=>{
    setGroups(gs=>gs.map(g=>g.id!==gId?g:{...g,posts:g.posts.map(p=>{
      if(p.id!==postId)return p;
      const wasLiked=p.myLiked;
      const prevLikedBy=p.likedBy||[];
      const newLikedBy=wasLiked
        ?prevLikedBy.filter(lb=>lb.name!==userName)
        :[...prevLikedBy,{name:userName,avatar:userAvatar||''}];
      return{...p,likes:wasLiked?p.likes-1:p.likes+1,myLiked:!wasLiked,likedBy:newLikedBy};
    })}));
  };
  const addComment=(gId:string,postId:string,text:string,isAnon:boolean)=>{
    const c2:GroupComment={id:uid(),text,author:isAnon?'Аноним':userName,avatar:isAnon?'':userAvatar||'',isAnon,createdAt:Date.now()};
    setGroups(gs=>gs.map(g=>g.id!==gId?g:{...g,posts:g.posts.map(p=>p.id!==postId?p:{...p,comments:[...p.comments,c2]})}));
  };
  const voteGroupPoll=(gId:string,postId:string,idx:number)=>{
    setGroups(gs=>gs.map(g=>g.id!==gId?g:{...g,posts:g.posts.map(p=>{
      if(p.id!==postId||p.pollVotedIdx!==undefined)return p;
      return{...p,pollOptions:(p.pollOptions||[]).map((o,i)=>i===idx?{...o,votes:o.votes+1}:o),pollVotedIdx:idx};
    })}));
  };
  const setWordOfDay=(gId:string,word:string)=>{
    setGroups(gs=>gs.map(g=>g.id!==gId?g:{...g,wordOfDay:word,wordSetAt:Date.now()}));
  };
  const setGroupMood=(gId:string,mood:string)=>{
    setGroups(gs=>gs.map(g=>g.id!==gId?g:{...g,todayMood:mood}));
  };
  const joinEvent=(gId:string,postId:string)=>{
    setGroups(gs=>gs.map(g=>g.id!==gId?g:{...g,posts:g.posts.map(p=>p.id!==postId?p:{...p,eventJoined:(p.eventJoined||0)+1})}));
  };
  const addBrainstormIdea=(gId:string,postId:string,idea:string)=>{
    setGroups(gs=>gs.map(g=>g.id!==gId?g:{...g,posts:g.posts.map(p=>p.id!==postId?p:{...p,brainstormIdeas:[...(p.brainstormIdeas||[]),{id:uid(),text:idea,author:userName,votes:0}]})}));
  };
  const voteIdeaUp=(gId:string,postId:string,ideaId:string)=>{
    setGroups(gs=>gs.map(g=>g.id!==gId?g:{...g,posts:g.posts.map(p=>p.id!==postId?p:{...p,brainstormIdeas:(p.brainstormIdeas||[]).map(i=>i.id===ideaId?{...i,votes:i.votes+1}:i)})}));
  };

  const handleCreate=(type:'channel'|'group')=>{ setShowCreateType(type); };

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',background:c.bg,overflow:'hidden'}}>

      {/* ── Сегментный переключатель Каналы | Группы ── */}
      <div style={{display:'flex',background:c.bg,borderBottom:`1px solid ${c.border}`,flexShrink:0,padding:'10px 16px 0'}}>
        <div style={{display:'flex',background:'rgba(255,255,255,0.06)',borderRadius:12,padding:3,gap:2,width:'100%'}}>
          {([['channels','📡 Каналы'],['groups','👥 Группы']] as const).map(([tab,label])=>(
            <motion.button key={tab} whileTap={{scale:0.97}} onClick={()=>{setActiveTab(tab);setOpenId(null);setOpenGroupId(null);}}
              style={{flex:1,padding:'8px 0',borderRadius:10,border:'none',cursor:'pointer',fontWeight:800,fontSize:13,
                fontFamily:'"Montserrat",sans-serif',transition:'all 0.2s',
                background:activeTab===tab?accent:'transparent',
                color:activeTab===tab?'#000':'rgba(255,255,255,0.5)'}}>
              {label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* ── Горизонтальная лента ── */}
      {activeTab==='channels'&&(
        <div style={{flexShrink:0}}>
          <HorizontalStrip channels={channels} openId={openId} onOpen={setOpenId}
            onCreateNew={()=>handleCreate('channel')} c={c} accent={accent}/>
        </div>
      )}
      {activeTab==='groups'&&(
        <div style={{flexShrink:0}}>
          <GroupsStrip groups={groups} openId={openGroupId} onOpen={setOpenGroupId}
            onCreateNew={()=>handleCreate('group')} c={c} accent={accent}/>
        </div>
      )}

      {/* ── Контент ── */}
      <div style={{flex:1,overflowY:'auto',paddingBottom:80}}>
        {activeTab==='channels'&&(
          !openId?(
            <ChannelsFeed channels={channels} c={c} accent={accent} onOpen={setOpenId}/>
          ):(
            openCh&&(
              <ChannelPage ch={openCh} c={c} accent={accent} isDark={isDark}
                onBack={()=>setOpenId(null)}
                onReact={reactToPost} onVote={voteInPoll}
                onOpenCapsule={openCapsule} onPin={pinPost} onDelete={deletePost}
                onUpdate={(patch)=>updateChannel(openCh.id,patch)}
                onBook={(postId,time)=>bookPost(openCh.id,postId,time)}
                onEditBooking={(postId,patch)=>editPostBooking(openCh.id,postId,patch)}
                activeRubric={activeRubric} onRubric={setActiveRubric}
                onCompose={()=>setShowCompose(true)}
                onAddPost={addPost} tick={tick}/>
            )
          )
        )}
        {activeTab==='groups'&&(
          !openGroupId?(
            <GroupsFeed groups={groups} c={c} accent={accent} onOpen={setOpenGroupId}/>
          ):(
            openGr&&(
              <GroupPage group={openGr} c={c} accent={accent} isDark={isDark}
                userName={userName} userAvatar={userAvatar||''}
                onBack={()=>setOpenGroupId(null)}
                onAddPost={(post)=>addGroupPost(openGr.id,post)}
                onLike={(pid)=>likeGroupPost(openGr.id,pid)}
                onComment={(pid,text,anon)=>addComment(openGr.id,pid,text,anon)}
                onVotePoll={(pid,idx)=>voteGroupPoll(openGr.id,pid,idx)}
                onSetWordOfDay={(w)=>setWordOfDay(openGr.id,w)}
                onSetMood={(m)=>setGroupMood(openGr.id,m)}
                onJoinEvent={(pid)=>joinEvent(openGr.id,pid)}
                onAddIdea={(pid,idea)=>addBrainstormIdea(openGr.id,pid,idea)}
                onVoteIdea={(pid,iid)=>voteIdeaUp(openGr.id,pid,iid)}
                tick={tick}/>
            )
          )
        )}
      </div>

      {/* ── Модалка создать канал ── */}
      <AnimatePresence>
        {showCreateType==='channel'&&(
          <CreateChannelModal c={c} accent={accent} isDark={isDark}
            userName={userName} userAvatar={userAvatar}
            onClose={()=>setShowCreateType(null)}
            onCreate={(ch)=>{ setChannels(cs=>[ch,...cs]); setShowCreateType(null); setActiveTab('channels'); setOpenId(ch.id); }}/>
        )}
        {showCreateType==='group'&&(
          <CreateGroupModal c={c} accent={accent} isDark={isDark}
            userName={userName} userAvatar={userAvatar}
            onClose={()=>setShowCreateType(null)}
            onCreate={(g)=>{ setGroups(gs=>[g,...gs]); setShowCreateType(null); setActiveTab('groups'); setOpenGroupId(g.id); }}/>
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
  onBook:(postId:string,time?:string)=>void;
  onEditBooking:(postId:string,patch:{bookingSlots?:{time:string;booked:boolean}[];bookingLabel?:string;hasBooking?:boolean})=>void;
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

      {/* ── Бизнес-секции шаблона ── */}
      {ch.usp&&<ChannelUSPBanner usp={ch.usp} color={ch.vibeColor||accent} c={c}
        onUpdate={usp=>onUpdate({usp})}/>}
      {ch.employees&&ch.employees.length>0&&(
        <ChannelEmployeeRoster employees={ch.employees} color={ch.vibeColor||accent} c={c}
          onUpdate={emps=>onUpdate({employees:emps})}/>
      )}
      {ch.priceList&&ch.priceList.length>0&&ch.templateId&&(
        <ChannelPriceList
          items={ch.priceList}
          color={ch.vibeColor||accent}
          c={c}
          type={(CHANNEL_TEMPLATES.find(t=>t.id===ch.templateId)?.type)||'services'}
          onUpdate={items=>onUpdate({priceList:items})}
        />
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
            onBook={(time)=>onBook(post.id,time)}
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
function fmtChSlot(slot:string):string{
  try{
    const d=new Date(slot.replace(' ','T'));
    const days=['в воскресенье','в понедельник','во вторник','в среду','в четверг','в пятницу','в субботу'];
    const mons=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    const time=(slot.split(' ')[1]||'').substring(0,5);
    const full=`${days[d.getDay()]}, ${d.getDate()} ${mons[d.getMonth()]} в ${time}`;
    return full.split(',')[1]?.trim()||full;
  }catch{return slot;}
}
const CH_QUICK_TIMES=['9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];

function PostCard({post,ch,c,accent,tick,onReact,onVote,onOpenCapsule,onPin,onDelete,onBook,onEditBooking}:{
  post:ChannelPost;ch:SwaipChannel;c:Props['c'];accent:string;tick:number;
  onReact:(key:ReactionKey)=>void;onVote:(idx:number)=>void;
  onOpenCapsule:()=>void;onPin:()=>void;onDelete:()=>void;
  onBook:(time?:string)=>void;
  onEditBooking:(patch:{bookingSlots?:{time:string;booked:boolean}[];bookingLabel?:string;hasBooking?:boolean})=>void;
}) {
  const [showActions,setShowActions]=useState(false);
  const [showBookEdit,setShowBookEdit]=useState(false);
  const [bookLabelDraft,setBookLabelDraft]=useState(post.bookingLabel||'Записаться');
  const [bookSlotsDraft,setBookSlotsDraft]=useState<{time:string;booked:boolean}[]>(post.bookingSlots||[]);
  const [bookTimeInput,setBookTimeInput]=useState('');
  const [bookedTime,setBookedTime]=useState<string|null>(null);
  const [showChChat,setShowChChat]=useState(false);
  const [chChatMsgs,setChChatMsgs]=useState<{role:'bot'|'user';text:string}[]>([]);
  const [chChatInput,setChChatInput]=useState('');
  const [chChatStep,setChChatStep]=useState<'chat'|'confirm'|'done'>('chat');
  const [chChatSlot,setChChatSlot]=useState('');
  const [chChatName,setChChatName]=useState('');
  const [chChatPhone,setChChatPhone]=useState('');
  const chBotName=(()=>{try{return localStorage.getItem('sw_ai_name')||'Алина';}catch{return'Алина';}})();
  const chSpeak=(text:string)=>{
    if(!('speechSynthesis' in window))return;
    window.speechSynthesis.cancel();
    const clean=text.replace(/[^\u0020-\u007E\u00A0-\u024F\u0400-\u04FF\s]/g,'').trim();
    const utt=new SpeechSynthesisUtterance(clean);
    utt.lang='ru-RU';utt.rate=0.92;utt.pitch=1.05;
    const vs=window.speechSynthesis.getVoices();const rv=vs.find(v=>v.lang.startsWith('ru'));if(rv)utt.voice=rv;
    window.speechSynthesis.speak(utt);
  };
  const getTimeOfDayCh=()=>{const h=new Date().getHours();if(h>=5&&h<12)return'Доброе утро';if(h>=12&&h<17)return'Добрый день';if(h>=17)return'Добрый вечер';return'Доброй ночи';};
  const BOT_HELLOS=['Рада помочь с записью 😊','На связи! Давайте подберём время 🌟','Здравствуйте! Выберем удобный слот ✨'];
  const openChChat=(preSlot?:string)=>{
    const avail=(post.bookingSlots||[]).filter(s=>!s.booked).map(s=>s.time);
    const tg=getTimeOfDayCh();
    const greeting=`${tg}! Я ${chBotName} 😊 ${BOT_HELLOS[Math.floor(Math.random()*BOT_HELLOS.length)]}`+
      (avail.length>0?`\n\nВот свободные окошки:\n${avail.map(s=>'📅 '+fmtChSlot(s)).join('\n')}\n\nВыберите удобное время!`
        :'\n\nК сожалению, свободных слотов нет 😔');
    setChChatMsgs([{role:'bot',text:greeting}]);
    setChChatStep('chat');setChChatSlot(preSlot||'');setChChatName('');setChChatPhone('');setChChatInput('');
    setShowChChat(true);
    chSpeak(`${tg}! Я ${chBotName}. Выберите удобное время для записи!`);
  };
  const isPinned=ch.pinnedPostId===post.id;
  const score=calcPostScore(post.reactions);
  const slots=post.bookingSlots||[];
  const freeSlots=slots.filter(s=>!s.booked);

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

  return (<>
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

      {/* ➕ Extras (карусель/опрос/квиз/вопрос/челлендж/ссылка/активность/букинг) */}
      {post.extras&&<div style={{padding:'0 14px 8px'}}>
        <PostExtrasRenderer extras={post.extras} c={c} accent={accent}/>
      </div>}

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

      {/* ── Блок «Записаться» — временны́е слоты ── */}
      {post.hasBooking&&(
        <div style={{padding:'4px 14px 14px'}}>
          {/* Редактор слотов для автора */}
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
                    <p style={{margin:'0 0 6px',fontSize:11,color:c.sub}}>📅 Слоты для записи:</p>
                    <div style={{display:'flex',gap:6,alignItems:'flex-end',flexWrap:'wrap',marginBottom:6}}>
                      <div style={{flex:'1 1 120px'}}>
                        <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginBottom:3}}>Дата</div>
                        <input type="date" value={bookTimeInput.split(' ')[0]||''} min={new Date().toISOString().split('T')[0]}
                          onChange={e=>{const t=bookTimeInput.split(' ')[1]||'';setBookTimeInput(e.target.value+(t?' '+t:''));}}
                          style={{width:'100%',boxSizing:'border-box',padding:'7px 8px',borderRadius:8,
                            background:c.bg,border:`1px solid ${c.border}`,color:c.light,fontSize:11,outline:'none',colorScheme:'dark'} as React.CSSProperties}/>
                      </div>
                      <div style={{flex:'1 1 80px'}}>
                        <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginBottom:3}}>Время</div>
                        <input type="time" value={bookTimeInput.split(' ')[1]||''}
                          onChange={e=>{const d=bookTimeInput.split(' ')[0]||'';setBookTimeInput(d?d+' '+e.target.value:e.target.value);}}
                          style={{width:'100%',boxSizing:'border-box',padding:'7px 8px',borderRadius:8,
                            background:c.bg,border:`1px solid ${c.border}`,color:c.light,fontSize:11,outline:'none',colorScheme:'dark'} as React.CSSProperties}/>
                      </div>
                      <button onClick={()=>{const v=bookTimeInput.trim();if(!v||!v.includes(' '))return;setBookSlotsDraft(d=>[...d,{time:v,booked:false}].sort((a,b)=>a.time.localeCompare(b.time)));setBookTimeInput('');}}
                        style={{padding:'7px 10px',borderRadius:8,border:'1px solid rgba(59,130,246,0.4)',
                          background:'rgba(59,130,246,0.15)',color:'#93c5fd',fontSize:11,fontWeight:700,cursor:'pointer',flexShrink:0,alignSelf:'flex-end'}}>
                        + Слот
                      </button>
                    </div>
                    {bookSlotsDraft.length>0&&(
                      <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                        {bookSlotsDraft.map(s=>(
                          <div key={s.time} style={{display:'flex',alignItems:'center',gap:3,
                            background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.25)',
                            borderRadius:20,padding:'3px 8px'}}>
                            <span style={{fontSize:10,color:'#93c5fd',fontWeight:600}}>🟢 {fmtChSlot(s.time)}</span>
                            <button onClick={()=>setBookSlotsDraft(d=>d.filter(x=>x.time!==s.time))}
                              style={{background:'none',border:'none',color:'rgba(255,255,255,0.3)',cursor:'pointer',padding:0,fontSize:10}}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <motion.button whileTap={{scale:0.95}} onClick={()=>{
                      onEditBooking({bookingSlots:bookSlotsDraft,bookingLabel:bookLabelDraft||'Записаться'});
                      setShowBookEdit(false);
                    }} style={{flex:1,padding:'9px',borderRadius:10,border:'none',cursor:'pointer',
                      background:accent,color:'#fff',fontWeight:800,fontSize:12}}>Сохранить</motion.button>
                    <motion.button whileTap={{scale:0.95}} onClick={()=>{
                      onEditBooking({hasBooking:false});setShowBookEdit(false);
                    }} style={{padding:'9px 14px',borderRadius:10,border:`1px solid rgba(239,68,68,0.4)`,
                      background:'rgba(239,68,68,0.08)',color:'#ef4444',cursor:'pointer',fontWeight:700,fontSize:12}}>
                      Убрать
                    </motion.button>
                    <motion.button whileTap={{scale:0.95}} onClick={()=>setShowBookEdit(false)}
                      style={{padding:'9px 12px',borderRadius:10,border:`1px solid ${c.border}`,
                        background:c.card,color:c.sub,cursor:'pointer',fontSize:12}}>✕</motion.button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Блок со слотами — стиль прайс-листа, чат Алины */}
          <motion.div style={{background:'linear-gradient(135deg,rgba(29,78,216,0.13),rgba(124,58,237,0.09))',
            border:'1px solid rgba(99,102,241,0.28)',borderRadius:18,padding:'14px'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:slots.length>0&&!bookedTime?10:0}}>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:800,color:'#fff'}}>{post.bookingLabel||'Записаться'}</div>
                {slots.length>0&&<div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:2}}>
                  {freeSlots.length} слот{freeSlots.length===1?'':'ов'} свободно · {chBotName} ответит
                </div>}
              </div>
              {!bookedTime&&(
                <motion.div whileTap={{scale:0.93}} onClick={()=>openChChat()}
                  style={{background:'linear-gradient(135deg,#1d4ed8,#7c3aed)',borderRadius:10,
                    padding:'8px 14px',fontSize:12,fontWeight:800,color:'#fff',cursor:'pointer',flexShrink:0}}>
                  Записаться →
                </motion.div>
              )}
            </div>
            {slots.length>0&&!bookedTime&&(
              <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                {slots.slice(0,3).map(s=>(
                  <div key={s.time} onClick={()=>{if(s.booked)return;openChChat(s.time);}}
                    style={{background:s.booked?'rgba(239,68,68,0.1)':'rgba(34,197,94,0.1)',
                      border:`1px solid ${s.booked?'rgba(239,68,68,0.25)':'rgba(34,197,94,0.25)'}`,
                      borderRadius:8,padding:'4px 10px',fontSize:11,fontWeight:600,
                      color:s.booked?'#f87171':'#4ade80',cursor:s.booked?'default':'pointer'}}>
                    📅 {s.booked?'🔒 ':''}{fmtChSlot(s.time)}
                  </div>
                ))}
                {slots.length>3&&(
                  <div style={{background:'rgba(255,255,255,0.05)',borderRadius:8,padding:'4px 10px',
                    fontSize:11,color:'rgba(255,255,255,0.4)'}}>+{slots.length-3} ещё</div>
                )}
              </div>
            )}
            {bookedTime&&(
              <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}}
                style={{marginTop:4,textAlign:'center',padding:'6px 0'}}>
                <div style={{fontSize:20,marginBottom:4}}>🎉</div>
                <div style={{fontSize:13,fontWeight:800,color:'#6ee7b7',marginBottom:3}}>Заявка отправлена!</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.45)'}}>{bookedTime!=='✓'?fmtChSlot(bookedTime):''}</div>
              </motion.div>
            )}
          </motion.div>
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

    {/* Чат Алины — запись из канала */}
    {showChChat&&(()=>{
      const availCh=(post.bookingSlots||[]).filter(s=>!s.booked).map(s=>s.time);
      const handleChMsg=(text:string)=>{
        const msgs=[...chChatMsgs,{role:'user' as const,text}];
        setChChatMsgs(msgs);setChChatInput('');
        setTimeout(()=>{
          let reply='';let speech='';
          if(chChatStep==='chat'){
            const lower=text.toLowerCase();
            const matched=availCh.find(s=>{const t=s.split(' ')[1];return text.includes(t||'')||fmtChSlot(s).toLowerCase().split(' ').some(w=>lower.includes(w)&&w.length>2);})||
              availCh.find(s=>lower.includes(s.split(' ')[1]?.split(':')[0]||''));
            if(matched){
              setChChatSlot(matched);setChChatStep('confirm');
              reply=`Отлично, ${fmtChSlot(matched)} — свободно! 🎉\n\nКак вас зовут?`;
              speech=`Отлично! ${fmtChSlot(matched)} свободно. Как вас зовут?`;
            }else if(availCh.length===0){
              reply='К сожалению, все слоты заняты 😔';speech='Все слоты заняты.';
            }else{
              reply=`Не нашла такое время 🙈\n\nВот что есть:\n${availCh.map(s=>'📅 '+fmtChSlot(s)).join('\n')}\n\nВыберите! 😊`;
              speech='Не нашла такое время. Выберите один из доступных слотов.';
            }
          }else if(chChatStep==='confirm'){
            if(!chChatName){
              setChChatName(text.trim());
              reply=`${text.trim()}, приятно! 😊\n\nТеперь оставьте телефон 📱`;
              speech=`${text.trim()}, приятно познакомиться! Укажите телефон.`;
            }else if(!chChatPhone){
              setChChatPhone(text.trim());setChChatStep('done');
              const slot=chChatSlot;
              reply=`Всё готово! 🎉\n\n👤 ${chChatName}\n📅 ${fmtChSlot(slot)}\n📱 ${text.trim()}\n\nЖдём вас! — ${chBotName}`;
              speech='Замечательно! Запись подтверждена. Ждём вас!';
              setBookedTime(slot||'✓');setShowChChat(false);onBook(slot||'✓');
              window.dispatchEvent(new CustomEvent('sw-new-booking',{detail:{name:chChatName,phone:text.trim(),slot}}));
              chSpeak(speech);return;
            }
          }
          if(reply){setChChatMsgs(m=>[...m,{role:'bot',text:reply}]);chSpeak(speech||reply.replace(/[📅😊🎉📱👇🌟🙈😔]/g,''));}
        },600);
      };
      return(
        <AnimatePresence key="chcbg">
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            onClick={()=>setShowChChat(false)}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',backdropFilter:'blur(10px)',zIndex:5000}}/>
          <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
            transition={{type:'spring',stiffness:290,damping:30}}
            style={{position:'fixed',bottom:0,left:0,right:0,zIndex:5001,
              background:'linear-gradient(180deg,#0a0d14,#070a10)',borderRadius:'28px 28px 0 0',
              border:'1px solid rgba(99,102,241,0.25)',height:'88vh',display:'flex',flexDirection:'column'}}>
            <div style={{padding:'18px 18px 14px',borderBottom:'1px solid rgba(255,255,255,0.07)',
              display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
              <div style={{width:42,height:42,borderRadius:'50%',background:'linear-gradient(135deg,#1d4ed8,#7c3aed)',
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:800,color:'#fff',flexShrink:0}}>
                {chBotName[0]?.toUpperCase()||'А'}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:800,color:'#fff',fontFamily:'"Montserrat",sans-serif'}}>{chBotName}</div>
                <div style={{fontSize:10,color:'rgba(99,102,241,0.8)',fontFamily:'"Montserrat",sans-serif'}}>
                  {chChatStep==='done'?'✅ Запись подтверждена':`📋 ${post.bookingLabel||'Запись'} · онлайн`}
                </div>
              </div>
              <motion.button whileTap={{scale:0.9}} onClick={()=>setShowChChat(false)}
                style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',
                  borderRadius:'50%',width:32,height:32,cursor:'pointer',color:'rgba(255,255,255,0.5)',
                  fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✕</motion.button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'16px',display:'flex',flexDirection:'column',gap:10}}>
              {chChatMsgs.map((msg,i)=>(
                <div key={i} style={{display:'flex',justifyContent:msg.role==='user'?'flex-end':'flex-start'}}>
                  {msg.role==='bot'&&(
                    <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,marginRight:8,marginTop:2,
                      background:'linear-gradient(135deg,#1d4ed8,#7c3aed)',display:'flex',alignItems:'center',
                      justifyContent:'center',fontSize:12,fontWeight:800,color:'#fff'}}>{chBotName[0]?.toUpperCase()||'А'}</div>
                  )}
                  <motion.div initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}}
                    style={{maxWidth:'75%',padding:'10px 14px',
                      background:msg.role==='user'?'linear-gradient(135deg,#1d4ed8,#2563eb)':'rgba(255,255,255,0.07)',
                      borderRadius:msg.role==='user'?'18px 18px 4px 18px':'4px 18px 18px 18px',
                      border:msg.role==='bot'?'1px solid rgba(255,255,255,0.08)':'none'}}>
                    <p style={{margin:0,fontSize:12,color:'#fff',lineHeight:1.55,fontFamily:'"Montserrat",sans-serif',whiteSpace:'pre-line'}}>{msg.text}</p>
                  </motion.div>
                </div>
              ))}
              {chChatStep==='chat'&&availCh.length>0&&(
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:4}}>
                  {availCh.map(s=>(
                    <motion.button key={s} whileTap={{scale:0.95}} onClick={()=>handleChMsg(s.split(' ')[1]||s)}
                      style={{background:'rgba(99,102,241,0.12)',border:'1px solid rgba(99,102,241,0.3)',
                        borderRadius:20,padding:'7px 14px',cursor:'pointer',color:'#a5b4fc',
                        fontSize:12,fontWeight:600,fontFamily:'"Montserrat",sans-serif'}}>
                      📅 {fmtChSlot(s)}
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
            {chChatStep!=='done'&&(
              <div style={{padding:'12px 14px 28px',borderTop:'1px solid rgba(255,255,255,0.07)',
                display:'flex',gap:8,flexShrink:0}}>
                <input value={chChatInput} onChange={e=>setChChatInput(e.target.value)}
                  onKeyDown={e=>{if(e.key==='Enter'&&chChatInput.trim())handleChMsg(chChatInput.trim());}}
                  placeholder={chChatStep==='confirm'&&!chChatName?'Ваше имя…':chChatStep==='confirm'&&!chChatPhone?'Ваш телефон +7…':'Напишите желаемое время…'}
                  type={chChatStep==='confirm'&&chChatName?'tel':'text'}
                  style={{flex:1,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',
                    borderRadius:22,padding:'11px 16px',color:'#fff',fontSize:13,outline:'none',
                    fontFamily:'"Montserrat",sans-serif'}}/>
                <motion.button whileTap={{scale:0.88}} onClick={()=>{if(chChatInput.trim())handleChMsg(chChatInput.trim());}}
                  style={{background:'linear-gradient(135deg,#1d4ed8,#7c3aed)',border:'none',
                    borderRadius:'50%',width:44,height:44,cursor:'pointer',fontSize:18,flexShrink:0,
                    display:'flex',alignItems:'center',justifyContent:'center'}}>➤</motion.button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      );
    })()}
  </>
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
const _POPULAR_TAGS=['музыка','фото','арт','танцы','стиль','юмор','новости','спорт','путешествия','еда','книги','кино','игры','технологии','мода'];
const _ACTIVITIES=[{k:'movie',e:'🎬',l:'Смотрю'},{k:'music',e:'🎵',l:'Слушаю'},{k:'book',e:'📖',l:'Читаю'},{k:'game',e:'🎮',l:'Играю'},{k:'show',e:'📺',l:'Сериал'}] as const;
const _searchUsers=async(q:string):Promise<any[]>=>{if(!q.trim())return[];try{const r=await fetch(`${window.location.origin}/api/search?q=${encodeURIComponent(q)}&limit=5`,{headers:{'x-session-token':_getTok()}});if(r.ok){const d=await r.json();return d.results||[];}}catch{}return[];};
const _getGeo=async():Promise<{city:string;lat:number;lng:number}|null>=>{try{const pos=await new Promise<GeolocationPosition>((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{timeout:8000}));const{latitude:lat,longitude:lng}=pos.coords;const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);const d=await r.json();const city=d.address?.city||d.address?.town||d.address?.village||d.address?.county||'Ваш город';return{city,lat,lng};}catch{return{city:'Ваш город',lat:0,lng:0};}};

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
  const [contentError,setContentError]=useState('');

  /* ── Запись ── */
  const [hasBooking,setHasBooking]=useState(false);
  const [bookingSlots,setBookingSlots]=useState<{time:string;booked:boolean}[]>([]);
  const [bookingLabel,setBookingLabel]=useState('Записаться');
  const [bookingTimeInput,setBookingTimeInput]=useState('');
  const addBSlot=(t:string)=>{const v=t.trim();if(!v||bookingSlots.some(s=>s.time===v))return;setBookingSlots(d=>[...d,{time:v,booked:false}]);};
  const remBSlot=(t:string)=>setBookingSlots(d=>d.filter(s=>s.time!==t));

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

  /* ── Extras (универсальный «Добавить в пост») ── */
  const [extras,setExtras]=useState<PostExtras>({});

  /* ── Дополнительные настройки ── */
  const [showAddMenu2,setShowAddMenu2]=useState(false);
  /* Коллаб */
  const [showCoAuthor,setShowCoAuthor]=useState(false);
  const [coAuthorQ,setCoAuthorQ]=useState('');
  const [coAuthorRes,setCoAuthorRes]=useState<any[]>([]);
  const [postCoAuthor,setPostCoAuthor]=useState<{hash:string;name:string;avatar:string}|null>(null);
  /* Анонимное голосование */
  const [postIsAnonVoting,setPostIsAnonVoting]=useState(false);
  /* Таймер */
  const [showTimer,setShowTimer]=useState(false);
  const [postPublishAt,setPostPublishAt]=useState('');
  const [postExpiresAt,setPostExpiresAt]=useState('');
  /* Геолокация */
  const [showGeo,setShowGeo]=useState(false);
  const [postGeo,setPostGeo]=useState<{city:string;lat:number;lng:number}|null>(null);
  const [geoLoading,setGeoLoading]=useState(false);
  /* Отметить людей */
  const [showMentions,setShowMentions]=useState(false);
  const [mentionQ,setMentionQ]=useState('');
  const [mentionRes,setMentionRes]=useState<any[]>([]);
  const [postMentions,setPostMentions]=useState<{hash:string;name:string;avatar:string}[]>([]);
  /* Хештеги */
  const [showHashtags,setShowHashtags]=useState(false);
  const [postHashtags,setPostHashtags]=useState<string[]>([]);
  const [hashtagInput,setHashtagInput]=useState('');
  /* Флаги */
  const [postDisableComments,setPostDisableComments]=useState(false);
  const [postDisableRepost,setPostDisableRepost]=useState(false);
  const [postEnableTTS,setPostEnableTTS]=useState(false);
  const [postEnableStats,setPostEnableStats]=useState(false);
  /* Хелперы */
  const searchCoAuthor_ch=async(q:string)=>{setCoAuthorQ(q);setCoAuthorRes(await _searchUsers(q));};
  const searchMention_ch=async(q:string)=>{setMentionQ(q);setMentionRes(await _searchUsers(q));};
  const addMention_ch=(u:any)=>{const name=u.pro_name||u.pro_full||u.scene_name||'Пользователь';if(postMentions.some(m=>m.hash===u.hash)||postMentions.length>=10)return;setPostMentions(p=>[...p,{hash:u.hash,name,avatar:u.pro_avatar||u.scene_avatar||''}]);setMentionQ('');setMentionRes([]);};
  const addHashtag_ch=(t:string)=>{const v=t.trim().replace(/^#/,'').toLowerCase().replace(/\s+/g,'_');if(!v||postHashtags.includes(v)||postHashtags.length>=10)return;setPostHashtags(p=>[...p,v]);};
  const doGetGeo_ch=async()=>{setGeoLoading(true);const g=await _getGeo();setPostGeo(g);setGeoLoading(false);};

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
    if(type==='text'&&!text.trim()&&!imgFile&&!hasBooking&&!hasAnyExtras(extras))return;
    if(type==='poll'&&(!pollQ.trim()||pollOpts.filter(o=>o.trim()).length<2))return;
    const fr=checkContent(collectPostText(text,pollQ,...pollOpts));
    if(!fr.ok){setContentError(fr.reason||'Публикация заблокирована.');return;}
    setContentError('');
    setPublishing(true);
    try{
      const [iUrl,vUrl,mUrl]= await Promise.all([
        (type==='photo'||type==='text'||type==='episode')?uploadImg():Promise.resolve(''),
        (type==='video')?uploadVid():Promise.resolve(''),
        (type==='audio'&&musicFile)?uploadMusic():
          (type==='audio'&&voiceBlob)?uploadVoice(voiceBlob):Promise.resolve(''),
      ]);
      const finalText=text.trim()||(hasBooking?`📅 ${bookingLabel||'Записаться'}`:'');
      const base:any={type,text:finalText,rubric:rubric||undefined,isExclusive};
      if(iUrl)base.imageUrl=iUrl;
      if(vUrl)base.videoUrl=vUrl;
      if(mUrl)base.audioUrl=mUrl;
      if(type==='poll')Object.assign(base,{pollQuestion:pollQ,pollOptions:pollOpts.filter(o=>o.trim()).map(t=>({text:t,votes:0}))});
      if(type==='announce'&&announceAt)base.announceAt=new Date(announceAt).getTime();
      if(type==='capsule'&&opensAt)Object.assign(base,{opensAt:new Date(opensAt).getTime(),capsuleOpened:false});
      if(type==='episode')Object.assign(base,{seriesName,episodeNum});
      if(hasBooking){Object.assign(base,{hasBooking:true,bookingLabel:bookingLabel||'Записaться',bookingSlots:bookingSlots});}
      if(hasAnyExtras(extras)) base.extras=extras;
      if(postCoAuthor) base.coAuthor=postCoAuthor;
      if(postIsAnonVoting) base.isAnonVoting=true;
      if(postPublishAt) base.publishAt=new Date(postPublishAt).toISOString();
      if(postExpiresAt) base.expiresAt=new Date(postExpiresAt).toISOString();
      if(postGeo) base.geo=postGeo;
      if(postMentions.length) base.mentions=postMentions;
      if(postHashtags.length) base.hashtags=postHashtags;
      if(postDisableComments) base.disableComments=true;
      if(postDisableRepost) base.disableRepost=true;
      if(postEnableTTS) base.enableTTS=true;
      if(postEnableStats) base.enableStats=true;
      onPublish(base);
    }finally{setPublishing(false);}
  };

  const fmtSize=(b:number)=>b>=1048576?`${(b/1048576).toFixed(1)} МБ`:b>=1024?`${(b/1024).toFixed(0)} КБ`:`${b} Б`;
  const canPublish=!publishing&&!imgLoading&&!vidLoading&&!musicLoading&&
    (type!=='text'||!!text.trim()||!!imgFile||hasBooking||hasAnyExtras(extras))&&
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
        {contentError&&(
          <div style={{padding:'7px 12px',background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.4)',borderRadius:10,display:'flex',alignItems:'center',gap:6,maxWidth:260}}>
            <span style={{fontSize:14,flexShrink:0}}>🚫</span>
            <span style={{fontSize:11,color:'#fca5a5',lineHeight:1.4}}>{contentError}</span>
          </div>
        )}
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
                      placeholder="Записаться на маникюр"
                      style={{width:'100%',boxSizing:'border-box',padding:'9px 12px',borderRadius:10,
                        background:c.bg,border:`1px solid ${c.border}`,color:c.light,fontSize:13,outline:'none'}}/>
                  </div>
                  <div>
                    <p style={{margin:'0 0 8px',fontSize:11,color:c.sub}}>📅 Слоты для записи:</p>
                    <div style={{display:'flex',gap:6,alignItems:'flex-end',flexWrap:'wrap',marginBottom:8}}>
                      <div style={{flex:'1 1 130px'}}>
                        <div style={{fontSize:10,color:'rgba(255,255,255,0.35)',marginBottom:3}}>Дата</div>
                        <input type="date" value={bookingTimeInput.split(' ')[0]||''} min={new Date().toISOString().split('T')[0]}
                          onChange={e=>{const t=bookingTimeInput.split(' ')[1]||'';setBookingTimeInput(e.target.value+(t?' '+t:''));}}
                          style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,
                            background:c.bg,border:`1px solid ${c.border}`,color:c.light,fontSize:12,outline:'none',colorScheme:'dark'} as React.CSSProperties}/>
                      </div>
                      <div style={{flex:'1 1 90px'}}>
                        <div style={{fontSize:10,color:'rgba(255,255,255,0.35)',marginBottom:3}}>Время</div>
                        <input type="time" value={bookingTimeInput.split(' ')[1]||''}
                          onChange={e=>{const d=bookingTimeInput.split(' ')[0]||'';setBookingTimeInput(d?d+' '+e.target.value:e.target.value);}}
                          style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,
                            background:c.bg,border:`1px solid ${c.border}`,color:c.light,fontSize:12,outline:'none',colorScheme:'dark'} as React.CSSProperties}/>
                      </div>
                      <button onClick={()=>{const v=bookingTimeInput.trim();if(!v||!v.includes(' '))return;addBSlot(v);setBookingTimeInput('');}}
                        style={{padding:'8px 12px',borderRadius:8,border:'1px solid rgba(59,130,246,0.4)',
                          background:'rgba(59,130,246,0.15)',color:'#93c5fd',fontSize:12,fontWeight:700,cursor:'pointer',flexShrink:0,alignSelf:'flex-end'}}>
                        + Слот
                      </button>
                    </div>
                    {bookingSlots.length>0&&(
                      <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                        {bookingSlots.map(s=>(
                          <div key={s.time} style={{display:'flex',alignItems:'center',gap:4,
                            background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.25)',
                            borderRadius:20,padding:'4px 10px'}}>
                            <span style={{fontSize:11,color:'#93c5fd',fontWeight:600}}>🟢 {fmtChSlot(s.time)}</span>
                            <button onClick={()=>remBSlot(s.time)}
                              style={{background:'none',border:'none',color:'rgba(255,255,255,0.3)',cursor:'pointer',padding:0,fontSize:11,lineHeight:1}}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
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

        {/* ── ➕ Добавить в пост (универсальные секции) ── */}
        <PostExtrasComposer extras={extras} onChange={setExtras} c={c} accent={accent}/>

        {/* ── ⚙️ Дополнительные настройки ── */}
        {(()=>{
          const cnt=[showCoAuthor&&!!postCoAuthor,postIsAnonVoting,showTimer&&(!!postPublishAt||!!postExpiresAt),showGeo&&!!postGeo,showMentions||postMentions.length>0,showHashtags||postHashtags.length>0,postDisableComments,postDisableRepost,postEnableTTS,postEnableStats].filter(Boolean).length;
          const menuItems=[
            {id:'coauthor',emo:'🤝',lbl:'Коллаборативный пост',clr:'#a5b4fc',on:showCoAuthor,toggle:()=>setShowCoAuthor(s=>!s)},
            {id:'anon',emo:'🕵️',lbl:'Анонимное голосование',clr:'#c4b5fd',on:postIsAnonVoting,toggle:()=>setPostIsAnonVoting(s=>!s),need:'poll'},
            {id:'timer',emo:'⏰',lbl:'Таймер публикации',clr:'#fbbf24',on:showTimer,toggle:()=>setShowTimer(s=>!s)},
            {id:'geo',emo:'📍',lbl:'Геолокация поста',clr:'#4ade80',on:showGeo,toggle:()=>setShowGeo(s=>!s)},
            {id:'mention',emo:'🏷️',lbl:'Отметить людей',clr:'#a78bfa',on:showMentions||postMentions.length>0,toggle:()=>setShowMentions(s=>!s)},
            {id:'hashtag',emo:'#️⃣',lbl:'Хештеги / темы',clr:'#22d3ee',on:showHashtags||postHashtags.length>0,toggle:()=>setShowHashtags(s=>!s)},
            {id:'tts',emo:'🔊',lbl:'Озвучка текста (TTS)',clr:'#34d399',on:postEnableTTS,toggle:()=>setPostEnableTTS(s=>!s)},
            {id:'stats',emo:'📈',lbl:'Детальная статистика',clr:'#a3e635',on:postEnableStats,toggle:()=>setPostEnableStats(s=>!s)},
            {id:'nocomm',emo:'🚫',lbl:'Запретить комментарии',clr:'#f87171',on:postDisableComments,toggle:()=>setPostDisableComments(s=>!s)},
            {id:'norepost',emo:'♻️',lbl:'Запретить репост',clr:'#f87171',on:postDisableRepost,toggle:()=>setPostDisableRepost(s=>!s)},
          ];
          return (
            <div style={{marginTop:10,borderRadius:12,border:`1px solid rgba(255,255,255,0.08)`,background:'rgba(255,255,255,0.025)',overflow:'hidden'}}>
              <div onClick={()=>setShowAddMenu2(s=>!s)} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',cursor:'pointer'}}>
                <div style={{width:28,height:28,borderRadius:'50%',background:'rgba(99,102,241,0.18)',border:'1px solid rgba(99,102,241,0.4)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:15,color:'#a5b4fc',fontWeight:700,transform:showAddMenu2?'rotate(45deg)':'rotate(0)',transition:'transform 0.2s'}}>+</div>
                <span style={{flex:1,fontSize:13,color:'#fff',fontWeight:600}}>Настройки поста</span>
                {cnt>0&&<span style={{fontSize:11,fontWeight:700,color:'#a5b4fc',background:'rgba(99,102,241,0.15)',borderRadius:10,padding:'2px 8px'}}>{cnt}</span>}
                <span style={{fontSize:11,color:'rgba(255,255,255,0.35)',transform:showAddMenu2?'rotate(180deg)':'rotate(0)',transition:'transform 0.2s'}}>▾</span>
              </div>
              <AnimatePresence>
                {showAddMenu2&&(
                  <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} style={{overflow:'hidden',borderTop:'1px solid rgba(255,255,255,0.06)'}}>
                    <div style={{padding:'10px 14px',display:'flex',flexDirection:'column',gap:2}}>
                      {menuItems.map(item=>{
                        const disabled=item.need==='poll'&&type!=='poll';
                        return (
                          <div key={item.id} onClick={disabled?undefined:item.toggle}
                            style={{display:'flex',alignItems:'center',gap:12,padding:'9px 4px',cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.4:1,borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                            <span style={{fontSize:17,width:24,textAlign:'center',flexShrink:0}}>{item.emo}</span>
                            <span style={{flex:1,fontSize:13,color:item.on?item.clr:'rgba(255,255,255,0.75)',fontWeight:item.on?700:500}}>{item.lbl}</span>
                            <span style={{fontSize:14,color:item.on?item.clr:'rgba(255,255,255,0.25)',fontWeight:700}}>{item.on?'✓':'+'}</span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })()}

        {/* ── Развёрнутые панели настроек ── */}
        {showCoAuthor&&(
          <div style={{marginTop:10,borderRadius:12,border:'1px solid rgba(99,102,241,0.4)',background:'rgba(99,102,241,0.06)',overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
              <span style={{fontSize:14}}>🤝</span>
              <span style={{flex:1,fontSize:12,color:'#a5b4fc',fontWeight:700}}>Коллаборативный пост</span>
              {postCoAuthor&&<span style={{fontSize:10,color:'#a5b4fc',fontWeight:800}}>{postCoAuthor.name}</span>}
              <button onClick={()=>{setShowCoAuthor(false);setCoAuthorQ('');setCoAuthorRes([]);setPostCoAuthor(null);}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',padding:'2px 6px'}}>✕</button>
            </div>
            <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:8}}>
              {postCoAuthor?(
                <div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(99,102,241,0.1)',borderRadius:10,padding:'8px 10px'}}>
                  <div style={{width:28,height:28,borderRadius:'50%',overflow:'hidden',flexShrink:0}}>
                    {postCoAuthor.avatar?<img src={postCoAuthor.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:14}}>👤</span>}
                  </div>
                  <span style={{flex:1,fontSize:12,fontWeight:800,color:'#fff'}}>{postCoAuthor.name}</span>
                  <button onClick={()=>{setPostCoAuthor(null);setCoAuthorQ('');setCoAuthorRes([]);}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.35)',cursor:'pointer',fontSize:14}}>✕</button>
                </div>
              ):(
                <>
                  <input value={coAuthorQ} onChange={e=>searchCoAuthor_ch(e.target.value)} placeholder="Поиск по имени…"
                    style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(99,102,241,0.3)',color:'#fff',fontSize:12,outline:'none'}}/>
                  {coAuthorRes.length>0&&<div style={{display:'flex',flexDirection:'column',gap:4}}>
                    {coAuthorRes.map((u:any,i:number)=>{
                      const uName=u.pro_name||u.pro_full||u.scene_name||'Пользователь';
                      return <button key={i} onClick={()=>{setPostCoAuthor({hash:u.hash,name:uName,avatar:u.pro_avatar||u.scene_avatar||''});setCoAuthorQ('');setCoAuthorRes([]);}}
                        style={{display:'flex',alignItems:'center',gap:8,background:'rgba(255,255,255,0.05)',borderRadius:8,padding:'7px 10px',border:'1px solid rgba(255,255,255,0.08)',cursor:'pointer',width:'100%',textAlign:'left'}}>
                        <span style={{fontSize:12,color:'#fff',fontWeight:700}}>{uName}</span>
                      </button>;
                    })}
                  </div>}
                </>
              )}
            </div>
          </div>
        )}

        {showTimer&&(
          <div style={{marginTop:10,borderRadius:12,border:'1px solid rgba(251,191,36,0.4)',background:'rgba(251,191,36,0.05)',overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
              <span style={{fontSize:14}}>⏰</span>
              <span style={{flex:1,fontSize:12,color:'#fbbf24',fontWeight:700}}>Таймер публикации</span>
              <button onClick={()=>{setShowTimer(false);setPostPublishAt('');setPostExpiresAt('');}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',padding:'2px 6px'}}>✕</button>
            </div>
            <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:10}}>
              <div>
                <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginBottom:4,fontWeight:600}}>📅 Запланировать на:</div>
                <input type="datetime-local" value={postPublishAt} min={new Date().toISOString().slice(0,16)} onChange={e=>setPostPublishAt(e.target.value)}
                  style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(251,191,36,0.3)',color:'#fff',fontSize:12,outline:'none',colorScheme:'dark'} as React.CSSProperties}/>
              </div>
              <div>
                <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginBottom:4,fontWeight:600}}>⏳ Пост исчезнет:</div>
                <input type="datetime-local" value={postExpiresAt} min={postPublishAt||new Date().toISOString().slice(0,16)} onChange={e=>setPostExpiresAt(e.target.value)}
                  style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(251,191,36,0.3)',color:'#fff',fontSize:12,outline:'none',colorScheme:'dark'} as React.CSSProperties}/>
              </div>
            </div>
          </div>
        )}

        {showGeo&&(
          <div style={{marginTop:10,borderRadius:12,border:'1px solid rgba(34,197,94,0.4)',background:'rgba(34,197,94,0.05)'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
              <span style={{fontSize:14}}>📍</span>
              <span style={{flex:1,fontSize:12,color:'#4ade80',fontWeight:700}}>Геолокация поста</span>
              {postGeo&&<span style={{fontSize:10,color:'#4ade80',fontWeight:800}}>{postGeo.city}</span>}
              <button onClick={()=>{setShowGeo(false);setPostGeo(null);}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',padding:'2px 6px'}}>✕</button>
            </div>
            <div style={{padding:'0 12px 12px'}}>
              {postGeo?(
                <div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(34,197,94,0.08)',borderRadius:10,padding:'8px 10px'}}>
                  <span style={{fontSize:18}}>📍</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:800,color:'#4ade80'}}>{postGeo.city}</div>
                    <div style={{fontSize:10,color:'rgba(255,255,255,0.35)'}}>Будет отображаться на посте</div>
                  </div>
                  <button onClick={()=>setPostGeo(null)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.35)',cursor:'pointer',fontSize:14}}>✕</button>
                </div>
              ):(
                <button onClick={doGetGeo_ch} disabled={geoLoading}
                  style={{width:'100%',padding:'9px',borderRadius:8,border:'1px solid rgba(34,197,94,0.3)',background:'rgba(34,197,94,0.06)',color:'#4ade80',fontSize:12,fontWeight:700,cursor:geoLoading?'wait':'pointer'}}>
                  {geoLoading?'⌛ Определяем...':'📍 Определить моё местоположение'}
                </button>
              )}
            </div>
          </div>
        )}

        {(showMentions||postMentions.length>0)&&(
          <div style={{marginTop:10,borderRadius:12,border:'1px solid rgba(167,139,250,0.4)',background:'rgba(167,139,250,0.05)',overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
              <span style={{fontSize:14}}>🏷️</span>
              <span style={{flex:1,fontSize:12,color:'#a78bfa',fontWeight:700}}>Отметить людей ({postMentions.length}/10)</span>
              <button onClick={()=>{setShowMentions(false);setMentionQ('');setMentionRes([]);setPostMentions([]);}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',padding:'2px 6px'}}>✕</button>
            </div>
            <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:8}}>
              {postMentions.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {postMentions.map(m=>(
                  <div key={m.hash} style={{display:'flex',alignItems:'center',gap:4,background:'rgba(167,139,250,0.12)',border:'1px solid rgba(167,139,250,0.3)',borderRadius:20,padding:'4px 8px'}}>
                    <span style={{fontSize:11,color:'#c4b5fd',fontWeight:700}}>{m.name}</span>
                    <button onClick={()=>setPostMentions(p=>p.filter(x=>x.hash!==m.hash))} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',padding:'0 2px',fontSize:11}}>✕</button>
                  </div>
                ))}
              </div>}
              {postMentions.length<10&&<input value={mentionQ} onChange={e=>searchMention_ch(e.target.value)} placeholder="Поиск по имени…"
                style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(167,139,250,0.3)',color:'#fff',fontSize:12,outline:'none'}}/>}
              {mentionRes.length>0&&<div style={{display:'flex',flexDirection:'column',gap:4}}>
                {mentionRes.map((u:any,i:number)=>{
                  const uName=u.pro_name||u.pro_full||u.scene_name||'Пользователь';
                  const already=postMentions.some(m=>m.hash===u.hash);
                  return <button key={i} disabled={already} onClick={()=>addMention_ch(u)}
                    style={{display:'flex',alignItems:'center',gap:8,background:'rgba(255,255,255,0.05)',borderRadius:8,padding:'7px 10px',border:'1px solid rgba(255,255,255,0.08)',cursor:already?'not-allowed':'pointer',width:'100%',textAlign:'left',opacity:already?0.5:1}}>
                    <span style={{fontSize:12,color:'#fff',fontWeight:700,flex:1}}>{uName}</span>
                    {already&&<span style={{fontSize:10,color:'#a78bfa'}}>✓</span>}
                  </button>;
                })}
              </div>}
            </div>
          </div>
        )}

        {(showHashtags||postHashtags.length>0)&&(
          <div style={{marginTop:10,borderRadius:12,border:'1px solid rgba(34,211,238,0.4)',background:'rgba(34,211,238,0.05)',overflow:'hidden'}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
              <span style={{fontSize:14}}>#️⃣</span>
              <span style={{flex:1,fontSize:12,color:'#22d3ee',fontWeight:700}}>Хештеги ({postHashtags.length}/10)</span>
              <button onClick={()=>{setShowHashtags(false);setPostHashtags([]);setHashtagInput('');}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',padding:'2px 6px'}}>✕</button>
            </div>
            <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:8}}>
              {postHashtags.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                {postHashtags.map(t=>(
                  <div key={t} style={{display:'flex',alignItems:'center',gap:4,background:'rgba(34,211,238,0.12)',border:'1px solid rgba(34,211,238,0.3)',borderRadius:20,padding:'4px 8px 4px 10px'}}>
                    <span style={{fontSize:11,color:'#67e8f9',fontWeight:700}}>#{t}</span>
                    <button onClick={()=>setPostHashtags(p=>p.filter(x=>x!==t))} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',padding:'0 2px',fontSize:11}}>✕</button>
                  </div>
                ))}
              </div>}
              {postHashtags.length<10&&<div style={{display:'flex',gap:6}}>
                <input value={hashtagInput} onChange={e=>setHashtagInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addHashtag_ch(hashtagInput);setHashtagInput('');}}} placeholder="Хештег + Enter…"
                  style={{flex:1,boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(34,211,238,0.3)',color:'#fff',fontSize:12,outline:'none'}}/>
                <button onClick={()=>{addHashtag_ch(hashtagInput);setHashtagInput('');}} style={{padding:'8px 13px',borderRadius:8,background:'rgba(34,211,238,0.2)',border:'1px solid rgba(34,211,238,0.4)',color:'#67e8f9',fontSize:12,fontWeight:700,cursor:'pointer'}}>+</button>
              </div>}
              <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                {_POPULAR_TAGS.filter(t=>!postHashtags.includes(t)).slice(0,10).map(t=>(
                  <button key={t} onClick={()=>addHashtag_ch(t)} disabled={postHashtags.length>=10}
                    style={{padding:'4px 9px',borderRadius:14,background:'rgba(34,211,238,0.06)',border:'1px solid rgba(34,211,238,0.2)',color:'#67e8f9',fontSize:10,cursor:'pointer',opacity:postHashtags.length>=10?0.4:1}}>
                    #{t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {(postEnableTTS||postEnableStats||postDisableComments||postDisableRepost)&&(
          <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:6}}>
            {postEnableTTS&&<div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,border:'1px solid rgba(52,211,153,0.35)',background:'rgba(52,211,153,0.06)'}}>
              <span style={{fontSize:13}}>🔊</span>
              <span style={{flex:1,fontSize:11,color:'#34d399',fontWeight:700}}>Озвучка текста (TTS включена)</span>
              <button onClick={()=>setPostEnableTTS(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:13,cursor:'pointer',padding:'2px 6px'}}>✕</button>
            </div>}
            {postEnableStats&&<div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,border:'1px solid rgba(163,230,53,0.35)',background:'rgba(163,230,53,0.06)'}}>
              <span style={{fontSize:13}}>📈</span>
              <span style={{flex:1,fontSize:11,color:'#a3e635',fontWeight:700}}>Детальная статистика (охваты, демография)</span>
              <button onClick={()=>setPostEnableStats(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:13,cursor:'pointer',padding:'2px 6px'}}>✕</button>
            </div>}
            {postDisableComments&&<div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,border:'1px solid rgba(248,113,113,0.35)',background:'rgba(248,113,113,0.06)'}}>
              <span style={{fontSize:13}}>🚫</span>
              <span style={{flex:1,fontSize:11,color:'#f87171',fontWeight:700}}>Комментарии запрещены</span>
              <button onClick={()=>setPostDisableComments(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:13,cursor:'pointer',padding:'2px 6px'}}>✕</button>
            </div>}
            {postDisableRepost&&<div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,border:'1px solid rgba(248,113,113,0.35)',background:'rgba(248,113,113,0.06)'}}>
              <span style={{fontSize:13}}>♻️</span>
              <span style={{flex:1,fontSize:11,color:'#f87171',fontWeight:700}}>Репост запрещён</span>
              <button onClick={()=>setPostDisableRepost(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:13,cursor:'pointer',padding:'2px 6px'}}>✕</button>
            </div>}
          </div>
        )}

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
  const [step,setStep]=useState(-1);
  const [selectedTemplate,setSelectedTemplate]=useState<ChannelTemplate|null>(null);
  const [name,setName]=useState('');
  const [handle,setHandle]=useState('');
  const [desc,setDesc]=useState('');
  const [usp,setUsp]=useState('');
  const [keywords,setKeywords]=useState('');
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
  const [employees,setEmployees]=useState<ChannelEmployee[]>([]);
  const [priceList,setPriceList]=useState<PriceItem[]>([]);
  const coverFileRef=useRef<HTMLInputElement>(null);
  const avatarFileRef=useRef<HTMLInputElement>(null);

  const applyTemplate=(t:ChannelTemplate)=>{
    setSelectedTemplate(t);
    setName(t.exampleName);
    setDesc(t.exampleDesc);
    setUsp(t.usp);
    setKeywords(t.keywords.join(', '));
    setTags(t.tags.join(', '));
    setRubrics(t.rubrics);
    if(t.employees) setEmployees(t.employees);
    if(t.priceItems) setPriceList(t.priceItems);
    const catMatch=CHANNEL_CATEGORIES.find(c=>c.id===t.category);
    if(catMatch) setCatId(catMatch.id);
    setStep(0);
  };

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
      coverGradient:selectedTemplate?`linear-gradient(135deg,${selectedTemplate.color}22,${selectedTemplate.color}08)`:cover.bg,
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
      templateId:selectedTemplate?.id,
      usp:usp.trim()||undefined,
      keywords:keywords.split(',').map(k=>k.trim()).filter(Boolean),
      employees:employees.length>0?employees:undefined,
      priceList:priceList.length>0?priceList:undefined,
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
          <button onClick={step===-1?onClose:()=>setStep(s=>s-1)}
            style={{background:'none',border:'none',cursor:'pointer',fontSize:20,color:c.sub,padding:4}}>
            {step===-1?'✕':'←'}
          </button>
          <div style={{flex:1}}>
            <p style={{margin:0,fontSize:15,fontWeight:900,color:c.light}}>
              {step===-1?'Создать канал':`Создать канал · ${STEPS[step]}`}
            </p>
            <p style={{margin:0,fontSize:11,color:c.sub}}>
              {step===-1
                ? selectedTemplate?`Шаблон: ${selectedTemplate.emoji} ${selectedTemplate.name}`:'Выбери шаблон или начни с нуля'
                : `Шаг ${step+1} из ${STEPS.length}`}
            </p>
          </div>
          {selectedTemplate&&step>=0&&(
            <div style={{display:'flex',alignItems:'center',gap:6,padding:'4px 10px',
              borderRadius:12,background:`${selectedTemplate.color}18`,border:`1px solid ${selectedTemplate.color}40`}}>
              <span style={{fontSize:14}}>{selectedTemplate.emoji}</span>
              <span style={{fontSize:11,color:selectedTemplate.color,fontWeight:700}}>{selectedTemplate.name.split('/')[0].trim()}</span>
            </div>
          )}
        </div>
        {/* Прогресс */}
        {step>=0&&(
          <div style={{marginTop:10,height:3,background:'rgba(255,255,255,0.1)',borderRadius:2,overflow:'hidden'}}>
            <motion.div animate={{width:`${((step+1)/STEPS.length)*100}%`}}
              style={{height:'100%',background:`linear-gradient(90deg,${vibe.color}88,${vibe.color})`,borderRadius:2}}/>
          </div>
        )}
      </div>

      {/* ── ШАГ -1: ВЫБОР ШАБЛОНА ── */}
      {step===-1&&(
        <div style={{padding:'20px 16px',height:'calc(100vh - 80px)',display:'flex',flexDirection:'column'}}>
          <TemplatePicker
            c={c} accent={accent}
            onSelect={applyTemplate}
            onSkip={()=>setStep(0)}
          />
        </div>
      )}

      <div style={{padding:'20px 16px',display:step===-1?'none':'block'}}>

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
            {/* Превью */}
            <div style={{padding:'20px',background:`linear-gradient(135deg,${vibe.color}15,${vibe.color}06)`,
              borderRadius:20,border:`1px solid ${vibe.color}30`,textAlign:'center'}}>
              <motion.div animate={{scale:[1,1.1,1]}} transition={{repeat:Infinity,duration:2}}>
                <span style={{fontSize:48}}>{selectedTemplate?selectedTemplate.emoji:vibe.emoji}</span>
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
                {employees.length>0&&<><span style={{fontSize:12,color:c.sub}}>·</span>
                <span style={{fontSize:12,color:'#34d399'}}>{employees.length} мастеров</span></>}
                {priceList.length>0&&<><span style={{fontSize:12,color:c.sub}}>·</span>
                <span style={{fontSize:12,color:'#fbbf24'}}>{priceList.length} позиций</span></>}
              </div>
            </div>

            {/* УТП (если задано) */}
            <div>
              <p style={{margin:'0 0 6px',fontSize:12,fontWeight:700,color:c.sub}}>✨ УТП (уникальное предложение)</p>
              <textarea value={usp} onChange={e=>setUsp(e.target.value)} placeholder="Опиши главные преимущества твоего бизнеса…"
                style={{width:'100%',background:c.card,border:`1px solid ${c.border}`,borderRadius:12,
                  padding:'10px 12px',color:c.light,fontSize:13,resize:'none',height:70,
                  outline:'none',lineHeight:1.5,boxSizing:'border-box'}}/>
            </div>

            {/* Ключевые слова */}
            <div>
              <p style={{margin:'0 0 6px',fontSize:12,fontWeight:700,color:c.sub}}>🔍 Ключевые слова для поиска (через запятую)</p>
              <input value={keywords} onChange={e=>setKeywords(e.target.value)}
                placeholder="маникюр, педикюр, ногти, красота…"
                style={{width:'100%',background:c.card,border:`1px solid ${c.border}`,borderRadius:12,
                  padding:'10px 12px',color:c.light,fontSize:13,outline:'none',boxSizing:'border-box'}}/>
              {keywords&&(
                <div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:8}}>
                  {keywords.split(',').map(k=>k.trim()).filter(Boolean).map(k=>(
                    <span key={k} style={{padding:'3px 8px',borderRadius:10,background:`${accent}18`,
                      border:`1px solid ${accent}35`,fontSize:11,color:accent}}>{k}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Состав канала */}
            <div style={{padding:'14px',background:c.card,borderRadius:14,border:`1px solid ${c.border}`}}>
              <p style={{margin:'0 0 10px',fontSize:13,fontWeight:800,color:c.light}}>🚀 Твой канал будет включать:</p>
              {[
                selectedTemplate?`${selectedTemplate.emoji} Шаблон «${selectedTemplate.name}»`:null,
                `${vibe.emoji} Вайб «${vibe.label}»`,
                rubrics.length>0?`🎭 ${rubrics.length} рубрик(и): ${rubrics.slice(0,2).join(', ')}${rubrics.length>2?'…':''}`:null,
                employees.length>0?`👥 ${employees.length} специалистов с записью`:null,
                priceList.length>0?`💰 Прайс-лист / меню: ${priceList.length} позиций`:null,
                usp?`✨ УТП и описание преимуществ`:null,
                keywords?`🔍 Ключевые слова для поиска`:null,
                '⏳ Временные капсулы',
                '🔥 Реакции и вовлечённость',
              ].filter(Boolean).map((f,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:vibe.color,flexShrink:0}}/>
                  <span style={{fontSize:13,color:c.mid}}>{f as string}</span>
                </div>
              ))}
            </div>

            <motion.button whileTap={{scale:0.97}} onClick={handleCreate}
              style={{width:'100%',padding:'16px',borderRadius:16,border:'none',cursor:'pointer',
                background:selectedTemplate
                  ?`linear-gradient(135deg,${selectedTemplate.color}dd,${selectedTemplate.color}88)`
                  :`linear-gradient(135deg,${vibe.color}dd,${accent})`,
                color:'#fff',fontSize:16,fontWeight:900,
                boxShadow:`0 6px 24px ${(selectedTemplate?.color||vibe.color)}44`}}>
              {selectedTemplate?selectedTemplate.emoji:vibe.emoji} Создать канал!
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

/* ══════════════════════════════════════════════════════
   ГОРИЗОНТАЛЬНАЯ ЛЕНТА ГРУПП
══════════════════════════════════════════════════════ */
const ROLE_META:Record<GroupRole,{icon:string;color:string;label:string}> = {
  founder:   {icon:'👑',color:'#f59e0b',label:'Основатель'},
  moderator: {icon:'⚡',color:'#a855f7',label:'Модератор'},
  vip:       {icon:'💎',color:'#60a5fa',label:'VIP'},
  activist:  {icon:'🌟',color:'#22c55e',label:'Активист'},
  member:    {icon:'👤',color:'#6b7280',label:'Участник'},
};
const MOOD_OPTIONS=['🔥 Горим','😴 Ленимся','🎉 Тусуемся','🧠 Думаем','😡 Ворчим','💚 В балансе','⚡ Энергия','🌧️ Меланхолия'];
const GROUP_EMOJIS=['🦁','🐉','🌊','⚡','🚀','🎭','🔮','🎯','🌙','🦋','🎪','🏔️','🌺','💥','🎸'];
const GROUP_COLORS=['#f97316','#a855f7','#06b6d4','#f59e0b','#22c55e','#ec4899','#8b5cf6','#ef4444','#3b82f6','#84cc16'];
const GROUP_GRADIENTS=[
  'linear-gradient(135deg,#1a0a3a,#6b21a8)','linear-gradient(135deg,#0a2a1a,#166534)',
  'linear-gradient(135deg,#1a0a0a,#991b1b)','linear-gradient(135deg,#0a1a3a,#1e40af)',
  'linear-gradient(135deg,#1a1a0a,#854d0e)','linear-gradient(135deg,#0a1a1a,#155e75)',
];
const ROULETTE_QUESTIONS=['Что тебя реально бесит?','Признайся: твоя тайная суперсила?','Что бы ты сделал с миллионом прямо сейчас?','Твой самый стыдный поступок за последний год?','Опиши идеальный день в 5 словах.','Какая черта характера тебе стыдиться?','Что ты никогда не скажешь вслух, но думаешь каждый день?'];

function GroupsStrip({groups,openId,onOpen,onCreateNew,c,accent}:{
  groups:SwaipGroup[];openId:string|null;
  onOpen:(id:string)=>void;onCreateNew:()=>void;
  c:Props['c'];accent:string;
}) {
  return (
    <div style={{padding:'14px 0 10px',borderBottom:`1px solid ${c.border}`}}>
      <div style={{display:'flex',gap:14,overflowX:'auto',padding:'2px 16px 6px',scrollbarWidth:'none'}}>
        <motion.button whileTap={{scale:0.9}} onClick={onCreateNew}
          style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:5,background:'none',border:'none',cursor:'pointer'}}>
          <div style={{width:52,height:52,borderRadius:'50%',border:`2px dashed ${accent}`,
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,background:`${accent}18`}}>+</div>
          <span style={{fontSize:10,color:accent,fontWeight:700,whiteSpace:'nowrap'}}>Создать</span>
        </motion.button>
        {groups.map(g=>(
          <motion.button key={g.id} whileTap={{scale:0.9}} onClick={()=>onOpen(g.id)}
            style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:5,background:'none',border:'none',cursor:'pointer'}}>
            <div style={{position:'relative'}}>
              <div style={{width:52,height:52,borderRadius:'50%',overflow:'hidden',background:g.gradient,
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,
                border:openId===g.id?`2.5px solid ${g.color}`:'2px solid rgba(255,255,255,0.15)',
                boxShadow:openId===g.id?`0 0 12px ${g.color}66`:'none'}}>
                <span>{g.emoji}</span>
              </div>
              {g.streak>0&&<div style={{position:'absolute',top:-4,right:-4,background:'#f97316',
                borderRadius:'50%',width:18,height:18,display:'flex',alignItems:'center',justifyContent:'center',
                fontSize:9,fontWeight:900,color:'#fff',border:'1px solid #000'}}>🔥</div>}
            </div>
            <span style={{fontSize:10,color:openId===g.id?g.color:c.mid,fontWeight:openId===g.id?800:600,
              whiteSpace:'nowrap',maxWidth:60,overflow:'hidden',textOverflow:'ellipsis'}}>{g.name}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ЛЕНТА ГРУПП
══════════════════════════════════════════════════════ */
function GroupsFeed({groups,c,accent,onOpen}:{groups:SwaipGroup[];c:Props['c'];accent:string;onOpen:(id:string)=>void}) {
  if(groups.length===0) return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'60px 32px',gap:16,textAlign:'center'}}>
      <div style={{fontSize:56}}>👥</div>
      <p style={{margin:0,fontSize:18,fontWeight:900,color:c.light}}>Твои группы</p>
      <p style={{margin:0,fontSize:14,color:c.sub,lineHeight:1.6}}>Создавай группы, общайся, соревнуйся и твори вместе.</p>
      <div style={{display:'flex',flexDirection:'column',gap:8,width:'100%',maxWidth:300,marginTop:8}}>
        {['🧠 Мозговой штурм — собираем идеи вместе','📋 Задание дня — ежедневные вызовы',
          '🤫 Анонимные признания — без страха','🎲 Рулетка вопросов — неожиданные ответы',
          '🏆 Рейтинг участников — кто самый активный','⏳ Групповая капсула — послание в будущее',
          '🎭 Слово дня — тема от основателя','🌡️ Настроение группы — общий вайб'].map(f=>(
          <div key={f} style={{padding:'8px 12px',background:c.card,borderRadius:10,border:`1px solid ${c.border}`,textAlign:'left',fontSize:12,color:c.mid}}>{f}</div>
        ))}
      </div>
    </div>
  );
  return (
    <div style={{padding:'12px 16px'}}>
      <p style={{margin:'0 0 12px',fontSize:12,color:c.sub,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase'}}>Мои группы</p>
      {groups.map(g=>(
        <motion.div key={g.id} whileTap={{scale:0.98}} onClick={()=>onOpen(g.id)}
          style={{background:c.card,borderRadius:16,padding:'14px',marginBottom:10,cursor:'pointer',border:`1px solid ${c.border}`,overflow:'hidden',position:'relative'}}>
          <div style={{position:'absolute',top:0,left:0,right:0,height:3,background:g.gradient}}/>
          <div style={{display:'flex',gap:12,alignItems:'center'}}>
            <div style={{width:48,height:48,borderRadius:'50%',background:g.gradient,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0}}>
              {g.emoji}
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <span style={{fontSize:15,fontWeight:900,color:c.light}}>{g.name}</span>
                {g.isPrivate&&<span style={{fontSize:10,color:c.sub,background:'rgba(255,255,255,0.08)',padding:'1px 6px',borderRadius:6}}>🔒</span>}
                {g.streak>0&&<span style={{fontSize:11,color:'#f97316',fontWeight:800}}>🔥{g.streak}</span>}
              </div>
              <span style={{fontSize:12,color:c.sub}}>{g.members.length} участн. · {g.posts.length} постов</span>
            </div>
            {g.todayMood&&<span style={{fontSize:20}}>{g.todayMood.split(' ')[0]}</span>}
          </div>
          {g.wordOfDay&&(
            <div style={{marginTop:10,padding:'8px 10px',background:'rgba(255,255,255,0.05)',borderRadius:10,border:`1px solid ${c.border}`}}>
              <span style={{fontSize:11,color:c.sub}}>🎭 Слово дня: </span>
              <span style={{fontSize:12,color:c.light,fontWeight:700}}>{g.wordOfDay}</span>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   ТОП УЧАСТНИКОВ ГРУППЫ — карточки под шапкой
══════════════════════════════════════════════════════ */
const RANK_COLORS=['#f59e0b','#9ca3af','#b45309'];

function TopPersonCard({name,avatar,count,rank,label,color,c}:{name:string;avatar:string;count:number;rank:number;label:string;color:string;c:Props['c']}) {
  const rc=RANK_COLORS[rank-1]||color;
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:5,flexShrink:0,width:68}}>
      <div style={{position:'relative'}}>
        <div style={{width:54,height:54,borderRadius:12,overflow:'hidden',border:`2px solid ${rank<=3?rc:c.border}`,
          background:c.cardAlt,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          {avatar
            ?<img src={avatar} style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>
            :<span style={{fontSize:22,fontWeight:900,color:rc}}>{name.charAt(0).toUpperCase()}</span>}
        </div>
        {rank<=3&&(
          <div style={{position:'absolute',top:-7,right:-7,width:19,height:19,borderRadius:'50%',
            background:rc,border:`2px solid ${c.bg}`,display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:9,fontWeight:900,color:'#000',lineHeight:1}}>
            {rank}
          </div>
        )}
      </div>
      <div style={{textAlign:'center',width:'100%'}}>
        <div style={{fontSize:11,fontWeight:800,color:c.light,overflow:'hidden',textOverflow:'ellipsis',
          whiteSpace:'nowrap',maxWidth:66,lineHeight:1.2}}>
          {name.split(' ')[0]}
        </div>
        <div style={{fontSize:10,color:c.sub,marginTop:1}}>{count} {label}</div>
      </div>
    </div>
  );
}

function GroupTopSection({group,c,accent}:{group:SwaipGroup;c:Props['c'];accent:string}) {
  /* ─ Топ комментаторов ─ */
  const commMap=new Map<string,{name:string;avatar:string;count:number}>();
  for(const post of group.posts){
    for(const cm of post.comments){
      if(cm.isAnon||!cm.author||cm.author==='Аноним')continue;
      const e=commMap.get(cm.author);
      if(e)e.count++;else commMap.set(cm.author,{name:cm.author,avatar:cm.avatar||'',count:1});
    }
  }
  const topCommenters=[...commMap.values()].sort((a,b)=>b.count-a.count).slice(0,5);

  /* ─ Топ лайкеров (кто жал эмодзи/лайк) ─ */
  const likeMap=new Map<string,{name:string;avatar:string;count:number}>();
  for(const post of group.posts){
    for(const lb of (post.likedBy||[])){
      if(!lb.name)continue;
      const e=likeMap.get(lb.name);
      if(e)e.count++;else likeMap.set(lb.name,{name:lb.name,avatar:lb.avatar||'',count:1});
    }
  }
  const topLikers=[...likeMap.values()].sort((a,b)=>b.count-a.count).slice(0,5);

  if(topCommenters.length===0&&topLikers.length===0)return null;

  return (
    <div style={{borderBottom:`1px solid ${c.border}`,paddingBottom:12,paddingTop:4}}>
      {topCommenters.length>0&&(
        <div style={{marginBottom:topLikers.length>0?10:0}}>
          <p style={{margin:'8px 0 8px 16px',fontSize:10,color:c.sub,fontWeight:800,
            textTransform:'uppercase',letterSpacing:'0.07em'}}>💬 Топ комментаторов</p>
          <div style={{display:'flex',gap:10,overflowX:'auto',padding:'0 16px',
            scrollbarWidth:'none',WebkitOverflowScrolling:'touch'} as React.CSSProperties}>
            {topCommenters.map((p,i)=>(
              <TopPersonCard key={p.name} name={p.name} avatar={p.avatar} count={p.count}
                rank={i+1} label="ком." color={accent} c={c}/>
            ))}
          </div>
        </div>
      )}
      {topLikers.length>0&&(
        <div>
          <p style={{margin:'8px 0 8px 16px',fontSize:10,color:c.sub,fontWeight:800,
            textTransform:'uppercase',letterSpacing:'0.07em'}}>❤️ Топ активных</p>
          <div style={{display:'flex',gap:10,overflowX:'auto',padding:'0 16px',
            scrollbarWidth:'none',WebkitOverflowScrolling:'touch'} as React.CSSProperties}>
            {topLikers.map((p,i)=>(
              <TopPersonCard key={p.name} name={p.name} avatar={p.avatar} count={p.count}
                rank={i+1} label="❤️" color={accent} c={c}/>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   СТРАНИЦА ГРУППЫ
══════════════════════════════════════════════════════ */
interface GroupPageProps {
  group:SwaipGroup; c:Props['c']; accent:string; isDark:boolean;
  userName:string; userAvatar:string;
  onBack:()=>void;
  onAddPost:(post:Omit<GroupPost,'id'|'createdAt'|'likes'|'myLiked'|'comments'>)=>void;
  onLike:(pid:string)=>void;
  onComment:(pid:string,text:string,anon:boolean)=>void;
  onVotePoll:(pid:string,idx:number)=>void;
  onSetWordOfDay:(w:string)=>void;
  onSetMood:(m:string)=>void;
  onJoinEvent:(pid:string)=>void;
  onAddIdea:(pid:string,idea:string)=>void;
  onVoteIdea:(pid:string,iid:string)=>void;
  tick:number;
}
function GroupPage({group,c,accent,isDark,userName,userAvatar,onBack,onAddPost,onLike,onComment,onVotePoll,onSetWordOfDay,onSetMood,onJoinEvent,onAddIdea,onVoteIdea,tick}:GroupPageProps) {
  const [subTab,setSubTab]=useState<'feed'|'leaderboard'|'settings'>('feed');
  const [showComposer,setShowComposer]=useState(false);
  const [expandedPost,setExpandedPost]=useState<string|null>(null);
  const [commentText,setCommentText]=useState('');
  const [commentAnon,setCommentAnon]=useState(false);
  const [ideaText,setIdeaText]=useState<{[pid:string]:string}>({});
  const [showMoodPicker,setShowMoodPicker]=useState(false);
  const [showWordInput,setShowWordInput]=useState(false);
  const [wordInput,setWordInput]=useState('');

  const myMember=group.members[0];
  const isFounder=myMember?.role==='founder';

  const sorted=[...group.posts].sort((a,b)=>b.createdAt-a.createdAt);
  const leaderboard=[...group.members].sort((a,b)=>b.score-a.score);

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
      {/* Header */}
      <div style={{background:group.gradient,padding:'0 16px 16px',flexShrink:0,position:'relative',overflow:'hidden'}}>
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'12px 0 16px'}}>
          <motion.button whileTap={{scale:0.9}} onClick={onBack} style={{background:'rgba(255,255,255,0.15)',border:'none',borderRadius:'50%',width:36,height:36,display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:18,cursor:'pointer',flexShrink:0}}>←</motion.button>
          <div style={{width:44,height:44,borderRadius:'50%',background:'rgba(255,255,255,0.2)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:26}}>
            {group.emoji}
          </div>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <span style={{fontSize:17,fontWeight:900,color:'#fff'}}>{group.name}</span>
              {group.isPrivate&&<span style={{fontSize:11,color:'rgba(255,255,255,0.7)'}}>🔒</span>}
            </div>
            <span style={{fontSize:12,color:'rgba(255,255,255,0.7)'}}>@{group.handle} · {group.members.length} участн.</span>
          </div>
          {group.streak>0&&<div style={{background:'rgba(0,0,0,0.3)',borderRadius:20,padding:'4px 10px',display:'flex',alignItems:'center',gap:4}}>
            <span style={{fontSize:14}}>🔥</span>
            <span style={{fontSize:13,color:'#fff',fontWeight:900}}>{group.streak}д</span>
          </div>}
        </div>
        {/* Stats row */}
        <div style={{display:'flex',gap:8}}>
          {[
            {emoji:'👥',val:group.members.length,label:'участн.'},
            {emoji:'📝',val:group.posts.length,label:'постов'},
            {emoji:'🔥',val:group.streak,label:'стрик'},
          ].map(s=>(
            <div key={s.label} style={{flex:1,background:'rgba(255,255,255,0.12)',borderRadius:12,padding:'8px',textAlign:'center'}}>
              <div style={{fontSize:16}}>{s.emoji}</div>
              <div style={{fontSize:14,fontWeight:900,color:'#fff'}}>{s.val}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.6)'}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Топ участников группы */}
      <GroupTopSection group={group} c={c} accent={accent}/>

      {/* Слово дня + Настроение */}
      <div style={{padding:'10px 16px',display:'flex',gap:8,flexShrink:0,borderBottom:`1px solid ${c.border}`}}>
        <motion.button whileTap={{scale:0.97}} onClick={()=>setShowWordInput(v=>!v)}
          style={{flex:1,padding:'8px 12px',background:c.card,borderRadius:12,border:`1px solid ${c.border}`,cursor:'pointer',textAlign:'left'}}>
          <div style={{fontSize:11,color:c.sub,fontWeight:700}}>🎭 СЛОВО ДНЯ</div>
          <div style={{fontSize:13,color:c.light,fontWeight:800,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {group.wordOfDay||'не задано'}
          </div>
        </motion.button>
        <motion.button whileTap={{scale:0.97}} onClick={()=>setShowMoodPicker(v=>!v)}
          style={{flex:1,padding:'8px 12px',background:c.card,borderRadius:12,border:`1px solid ${c.border}`,cursor:'pointer',textAlign:'left'}}>
          <div style={{fontSize:11,color:c.sub,fontWeight:700}}>🌡️ НАСТРОЕНИЕ</div>
          <div style={{fontSize:13,color:c.light,fontWeight:800,marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
            {group.todayMood||'не задано'}
          </div>
        </motion.button>
      </div>

      {/* Word input */}
      <AnimatePresence>
        {showWordInput&&(
          <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}}
            style={{overflow:'hidden',flexShrink:0,borderBottom:`1px solid ${c.border}`}}>
            <div style={{padding:'8px 16px',display:'flex',gap:8}}>
              <input value={wordInput} onChange={e=>setWordInput(e.target.value)} placeholder="Введи слово дня…"
                style={{flex:1,padding:'8px 12px',background:c.cardAlt,border:`1px solid ${c.border}`,borderRadius:10,color:c.light,fontSize:14,outline:'none'}}/>
              <motion.button whileTap={{scale:0.97}} onClick={()=>{if(wordInput.trim()){onSetWordOfDay(wordInput.trim());setWordInput('');setShowWordInput(false);}}}
                style={{padding:'8px 14px',background:accent,borderRadius:10,border:'none',cursor:'pointer',color:'#000',fontWeight:800,fontSize:13}}>ОК</motion.button>
            </div>
          </motion.div>
        )}
        {showMoodPicker&&(
          <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}}
            style={{overflow:'hidden',flexShrink:0,borderBottom:`1px solid ${c.border}`}}>
            <div style={{padding:'8px 16px',display:'flex',flexWrap:'wrap',gap:6}}>
              {MOOD_OPTIONS.map(m=>(
                <motion.button key={m} whileTap={{scale:0.95}} onClick={()=>{onSetMood(m);setShowMoodPicker(false);}}
                  style={{padding:'6px 12px',borderRadius:20,border:`1px solid ${group.todayMood===m?group.color:c.border}`,
                    background:group.todayMood===m?`${group.color}25`:'transparent',cursor:'pointer',
                    fontSize:13,color:c.light,fontWeight:group.todayMood===m?800:500}}>
                  {m}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sub-tabs */}
      <div style={{display:'flex',gap:0,borderBottom:`1px solid ${c.border}`,flexShrink:0}}>
        {([['feed','📰 Лента'],['leaderboard','🏆 Рейтинг'],['settings','⚙️ О группе']] as const).map(([tab,label])=>(
          <button key={tab} onClick={()=>setSubTab(tab)}
            style={{flex:1,padding:'10px 0',background:'none',border:'none',cursor:'pointer',
              fontSize:12,fontWeight:subTab===tab?800:500,color:subTab===tab?group.color:c.sub,
              borderBottom:subTab===tab?`2px solid ${group.color}`:'2px solid transparent'}}>
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{flex:1,overflowY:'auto',paddingBottom:80}}>
        {subTab==='feed'&&(
          <div style={{padding:'12px 16px'}}>
            {sorted.length===0&&(
              <div style={{textAlign:'center',padding:'40px 0',color:c.sub}}>
                <div style={{fontSize:40,marginBottom:12}}>💬</div>
                <p>Пока тихо. Создай первый пост!</p>
              </div>
            )}
            {sorted.map(post=>(
              <GroupPostCard key={post.id} post={post} group={group} c={c} accent={accent}
                isExpanded={expandedPost===post.id}
                onToggleExpand={()=>setExpandedPost(prev=>prev===post.id?null:post.id)}
                onLike={()=>onLike(post.id)}
                onVotePoll={(idx)=>onVotePoll(post.id,idx)}
                onJoinEvent={()=>onJoinEvent(post.id)}
                ideaInput={ideaText[post.id]||''}
                onIdeaChange={(v)=>setIdeaText(p=>({...p,[post.id]:v}))}
                onAddIdea={()=>{if((ideaText[post.id]||'').trim()){onAddIdea(post.id,ideaText[post.id].trim());setIdeaText(p=>({...p,[post.id]:''}));}}}
                onVoteIdea={(iid)=>onVoteIdea(post.id,iid)}
                commentText={expandedPost===post.id?commentText:''}
                commentAnon={commentAnon}
                onCommentAnon={()=>setCommentAnon(v=>!v)}
                onCommentChange={setCommentText}
                onSendComment={()=>{if(commentText.trim()){onComment(post.id,commentText.trim(),commentAnon);setCommentText('');}}}
                tick={tick}/>
            ))}
          </div>
        )}
        {subTab==='leaderboard'&&(
          <div style={{padding:'16px'}}>
            <p style={{margin:'0 0 12px',fontSize:12,color:c.sub,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase'}}>Рейтинг активности</p>
            {leaderboard.map((m,i)=>{
              const role=ROLE_META[m.role];
              return (
                <div key={m.hash} style={{display:'flex',alignItems:'center',gap:12,padding:'12px',background:c.card,borderRadius:14,marginBottom:8,border:`1px solid ${i<3?role.color+'40':c.border}`}}>
                  <div style={{width:32,height:32,borderRadius:'50%',background:i===0?'#f59e0b':i===1?'#9ca3af':i===2?'#b45309':'rgba(255,255,255,0.1)',
                    display:'flex',alignItems:'center',justifyContent:'center',fontSize:i<3?18:14,fontWeight:900,color:i<3?'#000':c.sub,flexShrink:0}}>
                    {i<3?['🥇','🥈','🥉'][i]:i+1}
                  </div>
                  <div style={{width:36,height:36,borderRadius:'50%',background:group.gradient,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
                    {m.avatar||group.emoji}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <span style={{fontSize:14,fontWeight:800,color:c.light}}>{m.name}</span>
                      <span style={{fontSize:11,color:role.color,fontWeight:700}}>{role.icon} {role.label}</span>
                    </div>
                    <span style={{fontSize:12,color:c.sub}}>{m.score} очков</span>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:2}}>
                    <span style={{fontSize:16}}>{role.icon}</span>
                  </div>
                </div>
              );
            })}
            {leaderboard.length===0&&(
              <div style={{textAlign:'center',padding:'40px 0',color:c.sub}}>
                <div style={{fontSize:40}}>🏆</div>
                <p>Пока никого нет в рейтинге</p>
              </div>
            )}
          </div>
        )}
        {subTab==='settings'&&(
          <div style={{padding:'16px'}}>
            <div style={{background:group.gradient,borderRadius:20,padding:'20px',textAlign:'center',marginBottom:16}}>
              <div style={{fontSize:52}}>{group.emoji}</div>
              <p style={{margin:'10px 0 4px',fontSize:18,fontWeight:900,color:'#fff'}}>{group.name}</p>
              <p style={{margin:'0 0 8px',fontSize:13,color:'rgba(255,255,255,0.7)'}}>@{group.handle}</p>
              <p style={{margin:0,fontSize:13,color:'rgba(255,255,255,0.8)',lineHeight:1.5}}>{group.description}</p>
            </div>
            <div style={{background:c.card,borderRadius:16,padding:'16px',border:`1px solid ${c.border}`}}>
              <p style={{margin:'0 0 12px',fontSize:13,fontWeight:800,color:c.light}}>👥 Участники ({group.members.length})</p>
              {group.members.map(m=>{
                const r=ROLE_META[m.role];
                return (
                  <div key={m.hash} style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                    <div style={{width:34,height:34,borderRadius:'50%',background:group.gradient,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{m.avatar||group.emoji}</div>
                    <div style={{flex:1}}>
                      <span style={{fontSize:13,fontWeight:700,color:c.light}}>{m.name}</span>
                      <span style={{marginLeft:6,fontSize:11,color:r.color}}>{r.icon} {r.label}</span>
                    </div>
                    <span style={{fontSize:12,color:c.sub}}>{m.score}оч</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* FAB — создать пост */}
      {subTab==='feed'&&(
        <motion.button whileTap={{scale:0.92}} onClick={()=>setShowComposer(true)}
          style={{position:'fixed',bottom:90,right:20,width:54,height:54,borderRadius:'50%',
            background:`linear-gradient(135deg,${group.color},${accent})`,
            border:'none',cursor:'pointer',fontSize:24,display:'flex',alignItems:'center',justifyContent:'center',
            boxShadow:`0 6px 20px ${group.color}55`,zIndex:100}}>
          ✏️
        </motion.button>
      )}

      {/* Composer */}
      <AnimatePresence>
        {showComposer&&(
          <GroupComposer group={group} c={c} accent={accent} isDark={isDark}
            userName={userName} userAvatar={userAvatar}
            onClose={()=>setShowComposer(false)}
            onPost={(post)=>{onAddPost(post);setShowComposer(false);}}/>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   КАРТОЧКА ПОСТА ГРУППЫ
══════════════════════════════════════════════════════ */
interface GroupPostCardProps {
  post:GroupPost; group:SwaipGroup; c:Props['c']; accent:string;
  isExpanded:boolean; onToggleExpand:()=>void; onLike:()=>void;
  onVotePoll:(idx:number)=>void; onJoinEvent:()=>void;
  ideaInput:string; onIdeaChange:(v:string)=>void; onAddIdea:()=>void;
  onVoteIdea:(iid:string)=>void;
  commentText:string; commentAnon:boolean;
  onCommentAnon:()=>void; onCommentChange:(v:string)=>void; onSendComment:()=>void;
  tick:number;
}

const GROUP_POST_META: Record<GroupPost['type'],{icon:string;label:string;color:string}> = {
  text:       {icon:'📝',label:'Пост',color:'#6b7280'},
  poll:       {icon:'📊',label:'Опрос',color:'#3b82f6'},
  brainstorm: {icon:'🧠',label:'Мозговой штурм',color:'#8b5cf6'},
  challenge:  {icon:'📋',label:'Задание дня',color:'#f97316'},
  confession: {icon:'🤫',label:'Анонимное',color:'#ec4899'},
  roulette:   {icon:'🎲',label:'Рулетка',color:'#f59e0b'},
  event:      {icon:'📅',label:'Событие',color:'#22c55e'},
  capsule:    {icon:'⏳',label:'Капсула',color:'#06b6d4'},
  mood:       {icon:'🌡️',label:'Настроение',color:'#a855f7'},
  collab:     {icon:'🎨',label:'Совместный',color:'#ef4444'},
};

function GroupPostCard({post,group,c,accent,isExpanded,onToggleExpand,onLike,onVotePoll,onJoinEvent,ideaInput,onIdeaChange,onAddIdea,onVoteIdea,commentText,commentAnon,onCommentAnon,onCommentChange,onSendComment,tick}:GroupPostCardProps) {
  const meta=GROUP_POST_META[post.type];
  const totalPollVotes=(post.pollOptions||[]).reduce((s,o)=>s+o.votes,0);

  return (
    <motion.div layout style={{background:c.card,borderRadius:16,marginBottom:10,overflow:'hidden',border:`1px solid ${c.border}`}}>
      {post.bgMusicUrl&&<BgMusicAutoplay url={post.bgMusicUrl} postId={post.id} label={post.bgMusicLabel||''} attach="parent"/>}
      {/* Тип-полоска */}
      <div style={{height:3,background:`linear-gradient(90deg,${meta.color},${meta.color}44)`}}/>

      <div style={{padding:'12px 14px'}}>
        {/* Author row */}
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
          <div style={{width:32,height:32,borderRadius:'50%',background:group.gradient,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
            {post.isAnon?'🎭':post.authorAvatar||group.emoji}
          </div>
          <div style={{flex:1}}>
            <span style={{fontSize:13,fontWeight:800,color:c.light}}>{post.isAnon?'Аноним':post.authorName}</span>
            <span style={{marginLeft:6,fontSize:10,color:meta.color,fontWeight:700,background:`${meta.color}18`,padding:'1px 6px',borderRadius:6}}>{meta.icon} {meta.label}</span>
          </div>
          <span style={{fontSize:11,color:c.sub}}>{fmtAge(post.createdAt)}</span>
        </div>

        {/* Контент по типу */}
        {post.text&&<p style={{margin:'0 0 10px',fontSize:14,color:c.mid,lineHeight:1.5}}>{post.text}</p>}
        {post.imageUrl&&<img src={post.imageUrl} alt="" style={{width:'100%',borderRadius:10,marginBottom:10,objectFit:'cover',maxHeight:240}}/>}

        {/* ➕ Extras (карусель/опрос/квиз/вопрос/челлендж/ссылка/активность/букинг) */}
        {post.extras&&<div style={{marginBottom:10}}>
          <PostExtrasRenderer extras={post.extras} c={c} accent={meta.color}/>
        </div>}

        {/* POLL */}
        {post.type==='poll'&&post.pollOptions&&(
          <div style={{marginBottom:10}}>
            {post.pollQuestion&&<p style={{margin:'0 0 8px',fontSize:14,fontWeight:700,color:c.light}}>{post.pollQuestion}</p>}
            {post.pollOptions.map((opt,i)=>{
              const pct=totalPollVotes>0?Math.round(opt.votes/totalPollVotes*100):0;
              const voted=post.pollVotedIdx===i;
              return (
                <motion.button key={i} whileTap={{scale:0.98}} onClick={()=>post.pollVotedIdx===undefined&&onVotePoll(i)}
                  style={{width:'100%',padding:'8px 12px',background:voted?`${group.color}22`:'rgba(255,255,255,0.05)',
                    borderRadius:10,border:`1px solid ${voted?group.color:c.border}`,cursor:post.pollVotedIdx===undefined?'pointer':'default',
                    marginBottom:6,display:'flex',alignItems:'center',gap:8,position:'relative',overflow:'hidden',textAlign:'left'}}>
                  {post.pollVotedIdx!==undefined&&<div style={{position:'absolute',left:0,top:0,bottom:0,width:`${pct}%`,background:`${group.color}18`,pointerEvents:'none'}}/>}
                  <span style={{flex:1,fontSize:13,color:c.light,fontWeight:voted?800:500,position:'relative'}}>{opt.text}</span>
                  {post.pollVotedIdx!==undefined&&<span style={{fontSize:12,color:group.color,fontWeight:800,position:'relative'}}>{pct}%</span>}
                </motion.button>
              );
            })}
            <p style={{margin:'4px 0 0',fontSize:11,color:c.sub}}>{totalPollVotes} голосов</p>
          </div>
        )}

        {/* BRAINSTORM */}
        {post.type==='brainstorm'&&(
          <div style={{marginBottom:10}}>
            <p style={{margin:'0 0 8px',fontSize:13,color:c.sub,fontWeight:700}}>💡 Идеи участников:</p>
            {(post.brainstormIdeas||[]).sort((a,b)=>b.votes-a.votes).slice(0,5).map(idea=>(
              <div key={idea.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',background:'rgba(255,255,255,0.05)',borderRadius:8,marginBottom:4}}>
                <span style={{flex:1,fontSize:13,color:c.mid}}>{idea.text}</span>
                <span style={{fontSize:11,color:c.sub}}>{idea.author}</span>
                <motion.button whileTap={{scale:0.9}} onClick={()=>onVoteIdea(idea.id)}
                  style={{background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:3}}>
                  <span style={{fontSize:13}}>👍</span>
                  <span style={{fontSize:11,color:c.sub,fontWeight:700}}>{idea.votes}</span>
                </motion.button>
              </div>
            ))}
            <div style={{display:'flex',gap:6,marginTop:6}}>
              <input value={ideaInput} onChange={e=>onIdeaChange(e.target.value)} placeholder="Твоя идея…"
                style={{flex:1,padding:'6px 10px',background:c.cardAlt||'rgba(255,255,255,0.06)',border:`1px solid ${c.border}`,borderRadius:8,color:c.light,fontSize:13,outline:'none'}}/>
              <motion.button whileTap={{scale:0.95}} onClick={onAddIdea}
                style={{padding:'6px 12px',background:group.color,borderRadius:8,border:'none',cursor:'pointer',color:'#000',fontWeight:800,fontSize:12}}>+</motion.button>
            </div>
          </div>
        )}

        {/* CHALLENGE */}
        {post.type==='challenge'&&post.challengeDeadline&&(
          <div style={{marginBottom:10,padding:'10px',background:`${group.color}15`,borderRadius:12,border:`1px solid ${group.color}40`}}>
            <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
              <span style={{fontSize:14}}>⏳</span>
              <span style={{fontSize:13,color:group.color,fontWeight:800}}>До конца: {fmtCountdown(post.challengeDeadline)}</span>
            </div>
            {post.challengeCompleted!==undefined&&<span style={{fontSize:12,color:c.sub}}>{post.challengeCompleted} человек выполнили</span>}
          </div>
        )}

        {/* ROULETTE */}
        {post.type==='roulette'&&(
          <div style={{marginBottom:10,padding:'12px',background:`${group.color}15`,borderRadius:12,border:`1px solid ${group.color}40`}}>
            <p style={{margin:'0 0 4px',fontSize:14,fontWeight:800,color:c.light}}>🎲 Вопрос рулетки:</p>
            <p style={{margin:'0 0 8px',fontSize:13,color:group.color,fontWeight:700}}>{post.rouletteQuestion}</p>
            {post.rouletteAnswer&&<p style={{margin:0,fontSize:13,color:c.mid,lineHeight:1.5,fontStyle:'italic'}}>"{post.rouletteAnswer}"</p>}
          </div>
        )}

        {/* EVENT */}
        {post.type==='event'&&(
          <div style={{marginBottom:10}}>
            {post.eventTitle&&<p style={{margin:'0 0 4px',fontSize:15,fontWeight:900,color:c.light}}>📅 {post.eventTitle}</p>}
            {post.eventAt&&<p style={{margin:'0 0 8px',fontSize:12,color:group.color,fontWeight:700}}>{new Date(post.eventAt).toLocaleString('ru')}</p>}
            <motion.button whileTap={{scale:0.97}} onClick={onJoinEvent}
              style={{padding:'8px 16px',background:`${group.color}22`,border:`1px solid ${group.color}`,borderRadius:10,cursor:'pointer',fontSize:13,color:group.color,fontWeight:800}}>
              ✅ Пойду ({post.eventJoined||0})
            </motion.button>
          </div>
        )}

        {/* CAPSULE */}
        {post.type==='capsule'&&(
          <div style={{marginBottom:10,padding:'12px',background:'rgba(6,182,212,0.1)',borderRadius:12,border:'1px solid rgba(6,182,212,0.3)'}}>
            {post.capsuleOpened?(
              <div>
                <p style={{margin:'0 0 4px',fontSize:12,color:'#06b6d4',fontWeight:700}}>📦 Капсула открыта!</p>
                <p style={{margin:0,fontSize:14,color:c.light}}>{post.text}</p>
              </div>
            ):(
              <div style={{textAlign:'center'}}>
                <p style={{margin:'0 0 4px',fontSize:12,color:'#06b6d4',fontWeight:700}}>⏳ Откроется:</p>
                {post.capsuleOpensAt&&<p style={{margin:0,fontSize:16,fontWeight:900,color:'#06b6d4',fontVariantNumeric:'tabular-nums'}}>{fmtCountdown(post.capsuleOpensAt)}</p>}
              </div>
            )}
          </div>
        )}

        {/* COLLAB */}
        {post.type==='collab'&&post.collabParts&&(
          <div style={{marginBottom:10}}>
            <p style={{margin:'0 0 8px',fontSize:13,color:c.sub,fontWeight:700}}>🎨 Совместный пост:</p>
            {post.collabParts.map((part,i)=>(
              <div key={i} style={{padding:'8px 12px',background:'rgba(255,255,255,0.05)',borderRadius:10,marginBottom:6,borderLeft:`3px solid ${group.color}`}}>
                <p style={{margin:'0 0 2px',fontSize:11,color:group.color,fontWeight:700}}>{part.author}:</p>
                <p style={{margin:0,fontSize:13,color:c.mid}}>{part.text}</p>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div style={{display:'flex',alignItems:'center',gap:12,paddingTop:8,borderTop:`1px solid ${c.border}`}}>
          <motion.button whileTap={{scale:0.85}} onClick={onLike}
            style={{display:'flex',alignItems:'center',gap:4,background:'none',border:'none',cursor:'pointer'}}>
            <span style={{fontSize:18,filter:post.myLiked?'saturate(2)':'saturate(0.3)'}}>{post.myLiked?'❤️':'🤍'}</span>
            <span style={{fontSize:12,color:post.myLiked?'#ec4899':c.sub,fontWeight:700}}>{post.likes}</span>
          </motion.button>
          <motion.button whileTap={{scale:0.9}} onClick={onToggleExpand}
            style={{display:'flex',alignItems:'center',gap:4,background:'none',border:'none',cursor:'pointer'}}>
            <span style={{fontSize:16}}>💬</span>
            <span style={{fontSize:12,color:c.sub,fontWeight:700}}>{post.comments.length}</span>
          </motion.button>
        </div>

        {/* Comments */}
        <AnimatePresence>
          {isExpanded&&(
            <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} style={{overflow:'hidden'}}>
              <div style={{marginTop:10,borderTop:`1px solid ${c.border}`,paddingTop:10}}>
                {post.comments.map(com=>(
                  <div key={com.id} style={{display:'flex',gap:8,marginBottom:8}}>
                    <div style={{width:28,height:28,borderRadius:'50%',background:group.gradient,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
                      {com.isAnon?'🎭':com.avatar||group.emoji}
                    </div>
                    <div style={{background:'rgba(255,255,255,0.05)',borderRadius:10,padding:'6px 10px',flex:1}}>
                      <div style={{fontSize:11,color:c.sub,marginBottom:2,fontWeight:700}}>{com.author}</div>
                      <div style={{fontSize:13,color:c.mid}}>{com.text}</div>
                    </div>
                  </div>
                ))}
                <div style={{display:'flex',gap:6,alignItems:'center',marginTop:8}}>
                  <motion.button whileTap={{scale:0.9}} onClick={onCommentAnon}
                    style={{width:32,height:32,borderRadius:'50%',background:commentAnon?`${group.color}30`:'rgba(255,255,255,0.06)',
                      border:`1px solid ${commentAnon?group.color:c.border}`,cursor:'pointer',fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    🎭
                  </motion.button>
                  <input value={commentText} onChange={e=>onCommentChange(e.target.value)} placeholder="Комментарий…"
                    style={{flex:1,padding:'7px 10px',background:'rgba(255,255,255,0.06)',border:`1px solid ${c.border}`,borderRadius:10,color:c.light,fontSize:13,outline:'none'}}/>
                  <motion.button whileTap={{scale:0.9}} onClick={onSendComment}
                    style={{width:32,height:32,borderRadius:'50%',background:group.color,border:'none',cursor:'pointer',fontSize:15,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    ↑
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════
   COMPOSER ГРУППЫ
══════════════════════════════════════════════════════ */
interface GroupComposerProps {
  group:SwaipGroup; c:Props['c']; accent:string; isDark:boolean;
  userName:string; userAvatar:string;
  onClose:()=>void;
  onPost:(post:Omit<GroupPost,'id'|'createdAt'|'likes'|'myLiked'|'comments'>)=>void;
}

const POST_TYPES: {type:GroupPost['type'];icon:string;label:string;color:string;desc:string}[] = [
  {type:'text',      icon:'📝',label:'Пост',       color:'#6b7280',desc:'Обычный текст'},
  {type:'poll',      icon:'📊',label:'Опрос',      color:'#3b82f6',desc:'Голосование'},
  {type:'brainstorm',icon:'🧠',label:'Штурм',      color:'#8b5cf6',desc:'Идеи команды'},
  {type:'challenge', icon:'📋',label:'Задание',    color:'#f97316',desc:'Вызов участникам'},
  {type:'confession',icon:'🤫',label:'Анонимно',   color:'#ec4899',desc:'Без имени'},
  {type:'roulette',  icon:'🎲',label:'Рулетка',    color:'#f59e0b',desc:'Случайный вопрос'},
  {type:'event',     icon:'📅',label:'Событие',    color:'#22c55e',desc:'Встреча/активность'},
  {type:'capsule',   icon:'⏳',label:'Капсула',    color:'#06b6d4',desc:'Послание в будущее'},
  {type:'collab',    icon:'🎨',label:'Совместный', color:'#ef4444',desc:'Пишем вместе'},
];

function GroupComposer({group,c,accent,isDark,userName,userAvatar,onClose,onPost}:GroupComposerProps) {
  const [postType,setPostType]=useState<GroupPost['type']>('text');
  const [text,setText]=useState('');
  const [isAnon,setIsAnon]=useState(false);
  const [groupContentError,setGroupContentError]=useState('');
  /* poll */
  const [pollQ,setPollQ]=useState('');
  const [pollOpts,setPollOpts]=useState(['','']);
  /* challenge */
  const [challengeH,setChallengeH]=useState(24);
  /* event */
  const [eventTitle,setEventTitle]=useState('');
  const [eventDate,setEventDate]=useState('');
  /* capsule */
  const [capsuleH,setCapsuleH]=useState(72);
  /* collab */
  const [collabText,setCollabText]=useState('');
  /* roulette — auto-pick */
  const [rouletteQ]=useState(ROULETTE_QUESTIONS[Math.floor(Math.random()*ROULETTE_QUESTIONS.length)]);
  /* bg music */
  const [showBgMusic,setShowBgMusic]=useState(false);
  const [postBgMusic,setPostBgMusic]=useState<BgMusicPreset|null>(null);
  /* extras */
  const [extras,setExtras]=useState<PostExtras>({});
  /* ── Дополнительные настройки (группы) ── */
  const [showAddMenu2g,setShowAddMenu2g]=useState(false);
  const [showCoAuthorG,setShowCoAuthorG]=useState(false);
  const [coAuthorQG,setCoAuthorQG]=useState('');
  const [coAuthorResG,setCoAuthorResG]=useState<any[]>([]);
  const [postCoAuthorG,setPostCoAuthorG]=useState<{hash:string;name:string;avatar:string}|null>(null);
  const [postIsAnonVotingG,setPostIsAnonVotingG]=useState(false);
  const [showTimerG,setShowTimerG]=useState(false);
  const [postPublishAtG,setPostPublishAtG]=useState('');
  const [postExpiresAtG,setPostExpiresAtG]=useState('');
  const [showGeoG,setShowGeoG]=useState(false);
  const [postGeoG,setPostGeoG]=useState<{city:string;lat:number;lng:number}|null>(null);
  const [geoLoadingG,setGeoLoadingG]=useState(false);
  const [showMentionsG,setShowMentionsG]=useState(false);
  const [mentionQG,setMentionQG]=useState('');
  const [mentionResG,setMentionResG]=useState<any[]>([]);
  const [postMentionsG,setPostMentionsG]=useState<{hash:string;name:string;avatar:string}[]>([]);
  const [showHashtagsG,setShowHashtagsG]=useState(false);
  const [postHashtagsG,setPostHashtagsG]=useState<string[]>([]);
  const [hashtagInputG,setHashtagInputG]=useState('');
  const [postDisableCommentsG,setPostDisableCommentsG]=useState(false);
  const [postDisableRepostG,setPostDisableRepostG]=useState(false);
  const [postEnableTTSG,setPostEnableTTSG]=useState(false);
  const [postEnableStatsG,setPostEnableStatsG]=useState(false);
  const searchCoAuthorG=async(q:string)=>{setCoAuthorQG(q);setCoAuthorResG(await _searchUsers(q));};
  const searchMentionG=async(q:string)=>{setMentionQG(q);setMentionResG(await _searchUsers(q));};
  const addMentionG=(u:any)=>{const name=u.pro_name||u.pro_full||u.scene_name||'Пользователь';if(postMentionsG.some(m=>m.hash===u.hash)||postMentionsG.length>=10)return;setPostMentionsG(p=>[...p,{hash:u.hash,name,avatar:u.pro_avatar||u.scene_avatar||''}]);setMentionQG('');setMentionResG([]);};
  const addHashtagG=(t:string)=>{const v=t.trim().replace(/^#/,'').toLowerCase().replace(/\s+/g,'_');if(!v||postHashtagsG.includes(v)||postHashtagsG.length>=10)return;setPostHashtagsG(p=>[...p,v]);};
  const doGetGeoG=async()=>{setGeoLoadingG(true);const g=await _getGeo();setPostGeoG(g);setGeoLoadingG(false);};

  const meta=GROUP_POST_META[postType];

  const handleSubmit=()=>{
    const allText=collectPostText(text,pollQ,collabText,eventTitle,...pollOpts);
    const fr=checkContent(allText);
    if(!fr.ok){setGroupContentError(fr.reason||'Публикация заблокирована.');return;}
    setGroupContentError('');
    let base: Omit<GroupPost,'id'|'createdAt'|'likes'|'myLiked'|'comments'>={
      type:postType,text,authorName:userName,authorAvatar:userAvatar,isAnon:isAnon||postType==='confession',
    };
    if(postType==='poll') base={...base,pollQuestion:pollQ,pollOptions:pollOpts.filter(o=>o.trim()).map(t=>({text:t,votes:0}))};
    if(postType==='brainstorm') base={...base,brainstormIdeas:[]};
    if(postType==='challenge') base={...base,challengeDeadline:Date.now()+challengeH*3600000,challengeCompleted:0};
    if(postType==='roulette') base={...base,rouletteQuestion:rouletteQ,rouletteAnswer:text};
    if(postType==='event') base={...base,eventTitle,eventAt:eventDate?new Date(eventDate).getTime():undefined,eventJoined:0};
    if(postType==='capsule') base={...base,text:'',capsuleOpensAt:Date.now()+capsuleH*3600000};
    if(postType==='collab') base={...base,text:'',collabParts:[{author:userName,text:collabText}]};
    if(postBgMusic) base={...base,bgMusicUrl:postBgMusic.url,bgMusicLabel:`${postBgMusic.emoji} ${postBgMusic.label}`};
    if(hasAnyExtras(extras)) base={...base,extras};
    if(postCoAuthorG) (base as any).coAuthor=postCoAuthorG;
    if(postIsAnonVotingG) (base as any).isAnonVoting=true;
    if(postPublishAtG) (base as any).publishAt=new Date(postPublishAtG).toISOString();
    if(postExpiresAtG) (base as any).expiresAt=new Date(postExpiresAtG).toISOString();
    if(postGeoG) (base as any).geo=postGeoG;
    if(postMentionsG.length) (base as any).mentions=postMentionsG;
    if(postHashtagsG.length) (base as any).hashtags=postHashtagsG;
    if(postDisableCommentsG) (base as any).disableComments=true;
    if(postDisableRepostG) (base as any).disableRepost=true;
    if(postEnableTTSG) (base as any).enableTTS=true;
    if(postEnableStatsG) (base as any).enableStats=true;
    onPost(base);
  };

  const canSubmit=(()=>{
    const anyExtras=hasAnyExtras(extras);
    if(postType==='poll') return (pollQ.trim()&&pollOpts.filter(o=>o.trim()).length>=2)||anyExtras;
    if(postType==='event') return eventTitle.trim()||anyExtras;
    if(postType==='capsule') return text.trim();
    if(postType==='collab') return collabText.trim();
    if(postType==='roulette') return text.trim();
    if(postType==='brainstorm') return text.trim()||anyExtras;
    if(postType==='challenge') return text.trim()||anyExtras;
    return text.trim()||anyExtras;
  })();

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:200,display:'flex',flexDirection:'column'}}>
      <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',damping:30,stiffness:300}}
        style={{marginTop:'auto',background:c.bg,borderRadius:'24px 24px 0 0',maxHeight:'90vh',display:'flex',flexDirection:'column'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'16px 16px 0'}}>
          <div style={{width:36,height:36,borderRadius:'50%',background:group.gradient,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>{group.emoji}</div>
          <div style={{flex:1}}>
            <p style={{margin:0,fontSize:15,fontWeight:900,color:c.light}}>Новый пост в {group.name}</p>
            <p style={{margin:0,fontSize:12,color:c.sub}}>Выбери тип и заполни</p>
          </div>
          <motion.button whileTap={{scale:0.9}} onClick={onClose} style={{background:'rgba(255,255,255,0.1)',border:'none',borderRadius:'50%',width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:c.light,fontSize:18}}>✕</motion.button>
        </div>

        {/* Type picker */}
        <div style={{padding:'12px 16px',overflowX:'auto',flexShrink:0}}>
          <div style={{display:'flex',gap:8}}>
            {POST_TYPES.map(pt=>(
              <motion.button key={pt.type} whileTap={{scale:0.93}} onClick={()=>setPostType(pt.type)}
                style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'8px 10px',
                  borderRadius:12,border:`1.5px solid ${postType===pt.type?pt.color:c.border}`,cursor:'pointer',
                  background:postType===pt.type?`${pt.color}20`:'transparent'}}>
                <span style={{fontSize:20}}>{pt.icon}</span>
                <span style={{fontSize:10,color:postType===pt.type?pt.color:c.sub,fontWeight:700,whiteSpace:'nowrap'}}>{pt.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Form */}
        <div style={{flex:1,overflowY:'auto',padding:'0 16px 16px'}}>
          <div style={{height:2,background:`linear-gradient(90deg,${meta.color},transparent)`,borderRadius:2,marginBottom:14}}/>

          {/* Анонимный toggle */}
          {postType!=='confession'&&(
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
              <motion.button whileTap={{scale:0.9}} onClick={()=>setIsAnon(v=>!v)}
                style={{width:40,height:22,borderRadius:11,background:isAnon?meta.color:'rgba(255,255,255,0.1)',border:'none',cursor:'pointer',position:'relative',transition:'all 0.2s',flexShrink:0}}>
                <div style={{position:'absolute',top:2,left:isAnon?20:2,width:18,height:18,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/>
              </motion.button>
              <span style={{fontSize:13,color:c.sub}}>🎭 Анонимно</span>
            </div>
          )}

          {/* TEXT area */}
          {postType!=='collab'&&postType!=='capsule'&&(
            <textarea value={postType==='roulette'?text:postType==='confession'?text:text}
              onChange={e=>setText(e.target.value)}
              placeholder={
                postType==='roulette'?`${rouletteQ}\n\nТвой ответ…`:
                postType==='confession'?'Признайся анонимно…':
                postType==='challenge'?'Опиши задание…':
                postType==='brainstorm'?'Тема для мозгового штурма…':
                postType==='poll'?'Дополнительный текст (необязательно)…':
                'Что хочешь сказать?'
              }
              style={{width:'100%',minHeight:100,padding:'12px',background:c.cardAlt||'rgba(255,255,255,0.06)',
                border:`1px solid ${c.border}`,borderRadius:12,color:c.light,fontSize:14,
                lineHeight:1.6,resize:'vertical',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
          )}

          {/* ROULETTE question preview */}
          {postType==='roulette'&&(
            <div style={{marginTop:10,padding:'10px',background:`${meta.color}15`,borderRadius:10,border:`1px solid ${meta.color}40`}}>
              <p style={{margin:0,fontSize:12,color:meta.color,fontWeight:700}}>🎲 Случайный вопрос:</p>
              <p style={{margin:'4px 0 0',fontSize:14,color:c.light}}>{rouletteQ}</p>
            </div>
          )}

          {/* POLL options */}
          {postType==='poll'&&(
            <div style={{marginTop:12}}>
              <input value={pollQ} onChange={e=>setPollQ(e.target.value)} placeholder="Вопрос опроса…"
                style={{width:'100%',padding:'10px',background:c.cardAlt||'rgba(255,255,255,0.06)',border:`1px solid ${c.border}`,borderRadius:10,color:c.light,fontSize:14,outline:'none',marginBottom:8,boxSizing:'border-box'}}/>
              {pollOpts.map((opt,i)=>(
                <input key={i} value={opt} onChange={e=>setPollOpts(o=>{const n=[...o];n[i]=e.target.value;return n;})} placeholder={`Вариант ${i+1}`}
                  style={{width:'100%',padding:'9px',background:c.cardAlt||'rgba(255,255,255,0.06)',border:`1px solid ${c.border}`,borderRadius:10,color:c.light,fontSize:13,outline:'none',marginBottom:6,boxSizing:'border-box'}}/>
              ))}
              {pollOpts.length<6&&(
                <button onClick={()=>setPollOpts(o=>[...o,''])}
                  style={{background:'none',border:`1px dashed ${c.border}`,borderRadius:10,color:c.sub,fontSize:13,padding:'6px 12px',cursor:'pointer',width:'100%'}}>+ Добавить вариант</button>
              )}
            </div>
          )}

          {/* CHALLENGE deadline */}
          {postType==='challenge'&&(
            <div style={{marginTop:10}}>
              <p style={{margin:'0 0 6px',fontSize:12,color:c.sub,fontWeight:700}}>Дедлайн:</p>
              <div style={{display:'flex',gap:6}}>
                {[12,24,48,72].map(h=>(
                  <button key={h} onClick={()=>setChallengeH(h)}
                    style={{flex:1,padding:'6px',borderRadius:8,border:`1px solid ${challengeH===h?meta.color:c.border}`,background:challengeH===h?`${meta.color}20`:'transparent',cursor:'pointer',fontSize:12,color:challengeH===h?meta.color:c.sub,fontWeight:700}}>
                    {h}ч
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* EVENT */}
          {postType==='event'&&(
            <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:8}}>
              <input value={eventTitle} onChange={e=>setEventTitle(e.target.value)} placeholder="Название события…"
                style={{padding:'10px',background:c.cardAlt||'rgba(255,255,255,0.06)',border:`1px solid ${c.border}`,borderRadius:10,color:c.light,fontSize:14,outline:'none'}}/>
              <input type="datetime-local" value={eventDate} onChange={e=>setEventDate(e.target.value)}
                style={{padding:'10px',background:c.cardAlt||'rgba(255,255,255,0.06)',border:`1px solid ${c.border}`,borderRadius:10,color:c.light,fontSize:14,outline:'none'}}/>
            </div>
          )}

          {/* CAPSULE */}
          {postType==='capsule'&&(
            <div style={{marginTop:4}}>
              <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Послание в будущее…"
                style={{width:'100%',minHeight:100,padding:'12px',background:c.cardAlt||'rgba(255,255,255,0.06)',border:`1px solid ${c.border}`,borderRadius:12,color:c.light,fontSize:14,lineHeight:1.6,resize:'vertical',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
              <p style={{margin:'8px 0 4px',fontSize:12,color:c.sub,fontWeight:700}}>Откроется через:</p>
              <div style={{display:'flex',gap:6}}>
                {[24,48,72,168,720].map(h=>(
                  <button key={h} onClick={()=>setCapsuleH(h)}
                    style={{flex:1,padding:'5px 2px',borderRadius:8,border:`1px solid ${capsuleH===h?meta.color:c.border}`,background:capsuleH===h?`${meta.color}20`:'transparent',cursor:'pointer',fontSize:11,color:capsuleH===h?meta.color:c.sub,fontWeight:700}}>
                    {h>=168?`${h/24}д`:h+'ч'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* COLLAB */}
          {postType==='collab'&&(
            <div style={{marginTop:4}}>
              <p style={{margin:'0 0 8px',fontSize:12,color:c.sub}}>Твоя часть совместного поста:</p>
              <textarea value={collabText} onChange={e=>setCollabText(e.target.value)} placeholder="Начни пост, другие продолжат…"
                style={{width:'100%',minHeight:100,padding:'12px',background:c.cardAlt||'rgba(255,255,255,0.06)',border:`1px solid ${c.border}`,borderRadius:12,color:c.light,fontSize:14,lineHeight:1.6,resize:'vertical',outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
            </div>
          )}

          {/* Bg music toggle */}
          <div style={{marginTop:14}}>
            <motion.button whileTap={{scale:0.96}} onClick={()=>setShowBgMusic(s=>!s)}
              style={{display:'flex',alignItems:'center',gap:8,padding:'9px 12px',borderRadius:10,
                border:`1.5px solid ${showBgMusic||postBgMusic?'#ec4899':c.border}`,cursor:'pointer',
                background:showBgMusic||postBgMusic?'rgba(236,72,153,0.1)':'transparent',width:'100%'}}>
              <span style={{fontSize:16}}>🎵</span>
              <span style={{flex:1,textAlign:'left',fontSize:13,fontWeight:700,color:postBgMusic?'#ec4899':c.light}}>
                Фоновая музыка{postBgMusic?` · ${postBgMusic.label}`:''}
              </span>
              <span style={{fontSize:11,color:c.sub}}>{showBgMusic?'▴':'▾'}</span>
            </motion.button>
            {showBgMusic&&(
              <div style={{marginTop:8,padding:10,background:c.cardAlt||'rgba(255,255,255,0.04)',borderRadius:10,border:`1px solid ${c.border}`}}>
                <BgMusicPicker selected={postBgMusic} onChange={setPostBgMusic}
                  textColor={c.light} subColor={c.sub} borderColor={c.border}/>
              </div>
            )}
          </div>

          {/* ── ➕ Добавить в пост (универсальные секции) ── */}
          <PostExtrasComposer extras={extras} onChange={setExtras} c={c} accent={meta.color}/>

          {/* ── ⚙️ Настройки поста (группы) ── */}
          {(()=>{
            const cntG=[showCoAuthorG&&!!postCoAuthorG,postIsAnonVotingG,showTimerG&&(!!postPublishAtG||!!postExpiresAtG),showGeoG&&!!postGeoG,showMentionsG||postMentionsG.length>0,showHashtagsG||postHashtagsG.length>0,postDisableCommentsG,postDisableRepostG,postEnableTTSG,postEnableStatsG].filter(Boolean).length;
            const menuG=[
              {id:'coauthor',emo:'🤝',lbl:'Коллаборативный пост',clr:'#a5b4fc',on:showCoAuthorG,toggle:()=>setShowCoAuthorG(s=>!s)},
              {id:'anon',emo:'🕵️',lbl:'Анонимное голосование',clr:'#c4b5fd',on:postIsAnonVotingG,toggle:()=>setPostIsAnonVotingG(s=>!s),need:'poll'},
              {id:'timer',emo:'⏰',lbl:'Таймер публикации',clr:'#fbbf24',on:showTimerG,toggle:()=>setShowTimerG(s=>!s)},
              {id:'geo',emo:'📍',lbl:'Геолокация поста',clr:'#4ade80',on:showGeoG,toggle:()=>setShowGeoG(s=>!s)},
              {id:'mention',emo:'🏷️',lbl:'Отметить людей',clr:'#a78bfa',on:showMentionsG||postMentionsG.length>0,toggle:()=>setShowMentionsG(s=>!s)},
              {id:'hashtag',emo:'#️⃣',lbl:'Хештеги / темы',clr:'#22d3ee',on:showHashtagsG||postHashtagsG.length>0,toggle:()=>setShowHashtagsG(s=>!s)},
              {id:'tts',emo:'🔊',lbl:'Озвучка текста (TTS)',clr:'#34d399',on:postEnableTTSG,toggle:()=>setPostEnableTTSG(s=>!s)},
              {id:'stats',emo:'📈',lbl:'Детальная статистика',clr:'#a3e635',on:postEnableStatsG,toggle:()=>setPostEnableStatsG(s=>!s)},
              {id:'nocomm',emo:'🚫',lbl:'Запретить комментарии',clr:'#f87171',on:postDisableCommentsG,toggle:()=>setPostDisableCommentsG(s=>!s)},
              {id:'norepost',emo:'♻️',lbl:'Запретить репост',clr:'#f87171',on:postDisableRepostG,toggle:()=>setPostDisableRepostG(s=>!s)},
            ];
            return (
              <div style={{marginTop:10,borderRadius:12,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.025)',overflow:'hidden'}}>
                <div onClick={()=>setShowAddMenu2g(s=>!s)} style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',cursor:'pointer'}}>
                  <div style={{width:28,height:28,borderRadius:'50%',background:'rgba(99,102,241,0.18)',border:'1px solid rgba(99,102,241,0.4)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:15,color:'#a5b4fc',fontWeight:700,transform:showAddMenu2g?'rotate(45deg)':'rotate(0)',transition:'transform 0.2s'}}>+</div>
                  <span style={{flex:1,fontSize:13,color:'#fff',fontWeight:600}}>Настройки поста</span>
                  {cntG>0&&<span style={{fontSize:11,fontWeight:700,color:'#a5b4fc',background:'rgba(99,102,241,0.15)',borderRadius:10,padding:'2px 8px'}}>{cntG}</span>}
                  <span style={{fontSize:11,color:'rgba(255,255,255,0.35)',transform:showAddMenu2g?'rotate(180deg)':'rotate(0)',transition:'transform 0.2s'}}>▾</span>
                </div>
                <AnimatePresence>
                  {showAddMenu2g&&(
                    <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} style={{overflow:'hidden',borderTop:'1px solid rgba(255,255,255,0.06)'}}>
                      <div style={{padding:'10px 14px',display:'flex',flexDirection:'column',gap:2}}>
                        {menuG.map(item=>{
                          const disabled=item.need==='poll'&&postType!=='poll';
                          return (
                            <div key={item.id} onClick={disabled?undefined:item.toggle}
                              style={{display:'flex',alignItems:'center',gap:12,padding:'9px 4px',cursor:disabled?'not-allowed':'pointer',opacity:disabled?0.4:1,borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                              <span style={{fontSize:17,width:24,textAlign:'center',flexShrink:0}}>{item.emo}</span>
                              <span style={{flex:1,fontSize:13,color:item.on?item.clr:'rgba(255,255,255,0.75)',fontWeight:item.on?700:500}}>{item.lbl}</span>
                              <span style={{fontSize:14,color:item.on?item.clr:'rgba(255,255,255,0.25)',fontWeight:700}}>{item.on?'✓':'+'}</span>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })()}

          {showCoAuthorG&&(
            <div style={{marginTop:10,borderRadius:12,border:'1px solid rgba(99,102,241,0.4)',background:'rgba(99,102,241,0.06)',overflow:'hidden'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
                <span style={{fontSize:14}}>🤝</span>
                <span style={{flex:1,fontSize:12,color:'#a5b4fc',fontWeight:700}}>Коллаборативный пост</span>
                {postCoAuthorG&&<span style={{fontSize:10,color:'#a5b4fc',fontWeight:800}}>{postCoAuthorG.name}</span>}
                <button onClick={()=>{setShowCoAuthorG(false);setCoAuthorQG('');setCoAuthorResG([]);setPostCoAuthorG(null);}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',padding:'2px 6px'}}>✕</button>
              </div>
              <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:8}}>
                {postCoAuthorG?(
                  <div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(99,102,241,0.1)',borderRadius:10,padding:'8px 10px'}}>
                    <span style={{flex:1,fontSize:12,fontWeight:800,color:'#fff'}}>{postCoAuthorG.name}</span>
                    <button onClick={()=>{setPostCoAuthorG(null);setCoAuthorQG('');setCoAuthorResG([]);}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.35)',cursor:'pointer',fontSize:14}}>✕</button>
                  </div>
                ):(
                  <>
                    <input value={coAuthorQG} onChange={e=>searchCoAuthorG(e.target.value)} placeholder="Поиск по имени…"
                      style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(99,102,241,0.3)',color:'#fff',fontSize:12,outline:'none'}}/>
                    {coAuthorResG.length>0&&<div style={{display:'flex',flexDirection:'column',gap:4}}>
                      {coAuthorResG.map((u:any,i:number)=>{
                        const uName=u.pro_name||u.pro_full||u.scene_name||'Пользователь';
                        return <button key={i} onClick={()=>{setPostCoAuthorG({hash:u.hash,name:uName,avatar:u.pro_avatar||u.scene_avatar||''});setCoAuthorQG('');setCoAuthorResG([]);}}
                          style={{display:'flex',alignItems:'center',gap:8,background:'rgba(255,255,255,0.05)',borderRadius:8,padding:'7px 10px',border:'1px solid rgba(255,255,255,0.08)',cursor:'pointer',width:'100%',textAlign:'left'}}>
                          <span style={{fontSize:12,color:'#fff',fontWeight:700}}>{uName}</span>
                        </button>;
                      })}
                    </div>}
                  </>
                )}
              </div>
            </div>
          )}

          {showTimerG&&(
            <div style={{marginTop:10,borderRadius:12,border:'1px solid rgba(251,191,36,0.4)',background:'rgba(251,191,36,0.05)',overflow:'hidden'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
                <span style={{fontSize:14}}>⏰</span>
                <span style={{flex:1,fontSize:12,color:'#fbbf24',fontWeight:700}}>Таймер публикации</span>
                <button onClick={()=>{setShowTimerG(false);setPostPublishAtG('');setPostExpiresAtG('');}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',padding:'2px 6px'}}>✕</button>
              </div>
              <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:10}}>
                <div>
                  <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginBottom:4,fontWeight:600}}>📅 Запланировать на:</div>
                  <input type="datetime-local" value={postPublishAtG} min={new Date().toISOString().slice(0,16)} onChange={e=>setPostPublishAtG(e.target.value)}
                    style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(251,191,36,0.3)',color:'#fff',fontSize:12,outline:'none',colorScheme:'dark'} as React.CSSProperties}/>
                </div>
                <div>
                  <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginBottom:4,fontWeight:600}}>⏳ Пост исчезнет:</div>
                  <input type="datetime-local" value={postExpiresAtG} min={postPublishAtG||new Date().toISOString().slice(0,16)} onChange={e=>setPostExpiresAtG(e.target.value)}
                    style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(251,191,36,0.3)',color:'#fff',fontSize:12,outline:'none',colorScheme:'dark'} as React.CSSProperties}/>
                </div>
              </div>
            </div>
          )}

          {showGeoG&&(
            <div style={{marginTop:10,borderRadius:12,border:'1px solid rgba(34,197,94,0.4)',background:'rgba(34,197,94,0.05)'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
                <span style={{fontSize:14}}>📍</span>
                <span style={{flex:1,fontSize:12,color:'#4ade80',fontWeight:700}}>Геолокация поста</span>
                {postGeoG&&<span style={{fontSize:10,color:'#4ade80',fontWeight:800}}>{postGeoG.city}</span>}
                <button onClick={()=>{setShowGeoG(false);setPostGeoG(null);}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',padding:'2px 6px'}}>✕</button>
              </div>
              <div style={{padding:'0 12px 12px'}}>
                {postGeoG?(
                  <div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(34,197,94,0.08)',borderRadius:10,padding:'8px 10px'}}>
                    <span style={{fontSize:18}}>📍</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:800,color:'#4ade80'}}>{postGeoG.city}</div>
                      <div style={{fontSize:10,color:'rgba(255,255,255,0.35)'}}>Будет отображаться на посте</div>
                    </div>
                    <button onClick={()=>setPostGeoG(null)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.35)',cursor:'pointer',fontSize:14}}>✕</button>
                  </div>
                ):(
                  <button onClick={doGetGeoG} disabled={geoLoadingG}
                    style={{width:'100%',padding:'9px',borderRadius:8,border:'1px solid rgba(34,197,94,0.3)',background:'rgba(34,197,94,0.06)',color:'#4ade80',fontSize:12,fontWeight:700,cursor:geoLoadingG?'wait':'pointer'}}>
                    {geoLoadingG?'⌛ Определяем...':'📍 Определить моё местоположение'}
                  </button>
                )}
              </div>
            </div>
          )}

          {(showMentionsG||postMentionsG.length>0)&&(
            <div style={{marginTop:10,borderRadius:12,border:'1px solid rgba(167,139,250,0.4)',background:'rgba(167,139,250,0.05)',overflow:'hidden'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
                <span style={{fontSize:14}}>🏷️</span>
                <span style={{flex:1,fontSize:12,color:'#a78bfa',fontWeight:700}}>Отметить людей ({postMentionsG.length}/10)</span>
                <button onClick={()=>{setShowMentionsG(false);setMentionQG('');setMentionResG([]);setPostMentionsG([]);}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',padding:'2px 6px'}}>✕</button>
              </div>
              <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:8}}>
                {postMentionsG.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                  {postMentionsG.map(m=>(
                    <div key={m.hash} style={{display:'flex',alignItems:'center',gap:4,background:'rgba(167,139,250,0.12)',border:'1px solid rgba(167,139,250,0.3)',borderRadius:20,padding:'4px 8px'}}>
                      <span style={{fontSize:11,color:'#c4b5fd',fontWeight:700}}>{m.name}</span>
                      <button onClick={()=>setPostMentionsG(p=>p.filter(x=>x.hash!==m.hash))} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',padding:'0 2px',fontSize:11}}>✕</button>
                    </div>
                  ))}
                </div>}
                {postMentionsG.length<10&&<input value={mentionQG} onChange={e=>searchMentionG(e.target.value)} placeholder="Поиск по имени…"
                  style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(167,139,250,0.3)',color:'#fff',fontSize:12,outline:'none'}}/>}
                {mentionResG.length>0&&<div style={{display:'flex',flexDirection:'column',gap:4}}>
                  {mentionResG.map((u:any,i:number)=>{
                    const uName=u.pro_name||u.pro_full||u.scene_name||'Пользователь';
                    const already=postMentionsG.some(m=>m.hash===u.hash);
                    return <button key={i} disabled={already} onClick={()=>addMentionG(u)}
                      style={{display:'flex',alignItems:'center',gap:8,background:'rgba(255,255,255,0.05)',borderRadius:8,padding:'7px 10px',border:'1px solid rgba(255,255,255,0.08)',cursor:already?'not-allowed':'pointer',width:'100%',textAlign:'left',opacity:already?0.5:1}}>
                      <span style={{fontSize:12,color:'#fff',fontWeight:700,flex:1}}>{uName}</span>
                      {already&&<span style={{fontSize:10,color:'#a78bfa'}}>✓</span>}
                    </button>;
                  })}
                </div>}
              </div>
            </div>
          )}

          {(showHashtagsG||postHashtagsG.length>0)&&(
            <div style={{marginTop:10,borderRadius:12,border:'1px solid rgba(34,211,238,0.4)',background:'rgba(34,211,238,0.05)',overflow:'hidden'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
                <span style={{fontSize:14}}>#️⃣</span>
                <span style={{flex:1,fontSize:12,color:'#22d3ee',fontWeight:700}}>Хештеги ({postHashtagsG.length}/10)</span>
                <button onClick={()=>{setShowHashtagsG(false);setPostHashtagsG([]);setHashtagInputG('');}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',padding:'2px 6px'}}>✕</button>
              </div>
              <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:8}}>
                {postHashtagsG.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                  {postHashtagsG.map(t=>(
                    <div key={t} style={{display:'flex',alignItems:'center',gap:4,background:'rgba(34,211,238,0.12)',border:'1px solid rgba(34,211,238,0.3)',borderRadius:20,padding:'4px 8px 4px 10px'}}>
                      <span style={{fontSize:11,color:'#67e8f9',fontWeight:700}}>#{t}</span>
                      <button onClick={()=>setPostHashtagsG(p=>p.filter(x=>x!==t))} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',padding:'0 2px',fontSize:11}}>✕</button>
                    </div>
                  ))}
                </div>}
                {postHashtagsG.length<10&&<div style={{display:'flex',gap:6}}>
                  <input value={hashtagInputG} onChange={e=>setHashtagInputG(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addHashtagG(hashtagInputG);setHashtagInputG('');}}} placeholder="Хештег + Enter…"
                    style={{flex:1,boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(34,211,238,0.3)',color:'#fff',fontSize:12,outline:'none'}}/>
                  <button onClick={()=>{addHashtagG(hashtagInputG);setHashtagInputG('');}} style={{padding:'8px 13px',borderRadius:8,background:'rgba(34,211,238,0.2)',border:'1px solid rgba(34,211,238,0.4)',color:'#67e8f9',fontSize:12,fontWeight:700,cursor:'pointer'}}>+</button>
                </div>}
                <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                  {_POPULAR_TAGS.filter(t=>!postHashtagsG.includes(t)).slice(0,10).map(t=>(
                    <button key={t} onClick={()=>addHashtagG(t)} disabled={postHashtagsG.length>=10}
                      style={{padding:'4px 9px',borderRadius:14,background:'rgba(34,211,238,0.06)',border:'1px solid rgba(34,211,238,0.2)',color:'#67e8f9',fontSize:10,cursor:'pointer',opacity:postHashtagsG.length>=10?0.4:1}}>
                      #{t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {(postEnableTTSG||postEnableStatsG||postDisableCommentsG||postDisableRepostG)&&(
            <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:6}}>
              {postEnableTTSG&&<div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,border:'1px solid rgba(52,211,153,0.35)',background:'rgba(52,211,153,0.06)'}}>
                <span style={{fontSize:13}}>🔊</span>
                <span style={{flex:1,fontSize:11,color:'#34d399',fontWeight:700}}>Озвучка текста (TTS включена)</span>
                <button onClick={()=>setPostEnableTTSG(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:13,cursor:'pointer',padding:'2px 6px'}}>✕</button>
              </div>}
              {postEnableStatsG&&<div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,border:'1px solid rgba(163,230,53,0.35)',background:'rgba(163,230,53,0.06)'}}>
                <span style={{fontSize:13}}>📈</span>
                <span style={{flex:1,fontSize:11,color:'#a3e635',fontWeight:700}}>Детальная статистика (охваты, демография)</span>
                <button onClick={()=>setPostEnableStatsG(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:13,cursor:'pointer',padding:'2px 6px'}}>✕</button>
              </div>}
              {postDisableCommentsG&&<div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,border:'1px solid rgba(248,113,113,0.35)',background:'rgba(248,113,113,0.06)'}}>
                <span style={{fontSize:13}}>🚫</span>
                <span style={{flex:1,fontSize:11,color:'#f87171',fontWeight:700}}>Комментарии запрещены</span>
                <button onClick={()=>setPostDisableCommentsG(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:13,cursor:'pointer',padding:'2px 6px'}}>✕</button>
              </div>}
              {postDisableRepostG&&<div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,border:'1px solid rgba(248,113,113,0.35)',background:'rgba(248,113,113,0.06)'}}>
                <span style={{fontSize:13}}>♻️</span>
                <span style={{flex:1,fontSize:11,color:'#f87171',fontWeight:700}}>Репост запрещён</span>
                <button onClick={()=>setPostDisableRepostG(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:13,cursor:'pointer',padding:'2px 6px'}}>✕</button>
              </div>}
            </div>
          )}

          {/* Submit */}
          {groupContentError&&(
            <div style={{marginTop:10,padding:'10px 12px',background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.4)',borderRadius:12,display:'flex',alignItems:'flex-start',gap:8}}>
              <span style={{fontSize:16,flexShrink:0}}>🚫</span>
              <span style={{fontSize:13,color:'#fca5a5',lineHeight:1.4}}>{groupContentError}</span>
            </div>
          )}
          <motion.button whileTap={{scale:0.97}} onClick={handleSubmit} disabled={!canSubmit}
            style={{width:'100%',padding:'15px',borderRadius:16,border:'none',cursor:canSubmit?'pointer':'not-allowed',marginTop:16,
              background:canSubmit?`linear-gradient(135deg,${meta.color},${accent})`:'rgba(255,255,255,0.08)',
              color:canSubmit?'#000':'rgba(255,255,255,0.3)',fontSize:15,fontWeight:900,fontFamily:'"Montserrat",sans-serif'}}>
            {meta.icon} Опубликовать
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════
   МОДАЛКА СОЗДАТЬ ГРУППУ
══════════════════════════════════════════════════════ */
interface CreateGroupModalProps {
  c:Props['c']; accent:string; isDark:boolean;
  userName:string; userAvatar?:string;
  onClose:()=>void;
  onCreate:(g:SwaipGroup)=>void;
}
function CreateGroupModal({c,accent,isDark,userName,userAvatar,onClose,onCreate}:CreateGroupModalProps) {
  const [step,setStep]=useState(0);
  const [name,setName]=useState('');
  const [handle,setHandle]=useState('');
  const [desc,setDesc]=useState('');
  const [emoji,setEmoji]=useState(GROUP_EMOJIS[0]);
  const [color,setColor]=useState(GROUP_COLORS[0]);
  const [gradient,setGradient]=useState(GROUP_GRADIENTS[0]);
  const [isPrivate,setIsPrivate]=useState(false);

  const handleCreate=()=>{
    const founder:GroupMember={hash:'me',name:userName,avatar:userAvatar||'',role:'founder',score:100,joinedAt:Date.now()};
    const g:SwaipGroup={
      id:uid(),name:name.trim(),handle:handle.trim()||name.trim().toLowerCase().replace(/\s+/g,'_'),
      description:desc.trim(),emoji,color,gradient,category:'general',
      createdAt:Date.now(),posts:[],members:[founder],
      wordOfDay:'',wordSetAt:0,todayMood:'',streak:0,isPrivate,
    };
    onCreate(g);
  };

  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:200,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
      <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',damping:28,stiffness:280}}
        style={{background:c.bg,borderRadius:'24px 24px 0 0',maxHeight:'88vh',display:'flex',flexDirection:'column'}}>

        {/* Grip */}
        <div style={{width:36,height:4,background:'rgba(255,255,255,0.2)',borderRadius:2,margin:'12px auto 0'}}/>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',padding:'14px 20px 0'}}>
          <div style={{flex:1}}>
            <p style={{margin:0,fontSize:17,fontWeight:900,color:c.light}}>👥 Создать группу</p>
            <p style={{margin:0,fontSize:12,color:c.sub}}>Шаг {step+1} из 3</p>
          </div>
          <motion.button whileTap={{scale:0.9}} onClick={onClose} style={{background:'rgba(255,255,255,0.1)',border:'none',borderRadius:'50%',width:34,height:34,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:c.light,fontSize:18}}>✕</motion.button>
        </div>

        {/* Steps */}
        <div style={{flex:1,overflowY:'auto',padding:'16px 20px 24px'}}>

          {/* ШАГ 0: Название + handle */}
          {step===0&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{display:'flex',justifyContent:'center',marginBottom:8}}>
                <div style={{width:80,height:80,borderRadius:'50%',background:gradient,display:'flex',alignItems:'center',justifyContent:'center',fontSize:40,border:`2px solid ${color}55`}}>
                  {emoji}
                </div>
              </div>
              <div>
                <label style={{fontSize:12,color:c.sub,fontWeight:700,display:'block',marginBottom:6}}>НАЗВАНИЕ ГРУППЫ*</label>
                <input value={name} onChange={e=>{setName(e.target.value);setHandle(e.target.value.toLowerCase().replace(/\s+/g,'_'));}}
                  placeholder="Моя крутая группа"
                  style={{width:'100%',padding:'12px',background:c.card,border:`1.5px solid ${name?color:c.border}`,borderRadius:12,color:c.light,fontSize:15,outline:'none',boxSizing:'border-box'}}/>
              </div>
              <div>
                <label style={{fontSize:12,color:c.sub,fontWeight:700,display:'block',marginBottom:6}}>HANDLE</label>
                <div style={{display:'flex',alignItems:'center',background:c.card,border:`1px solid ${c.border}`,borderRadius:12,padding:'0 12px'}}>
                  <span style={{fontSize:15,color:c.sub}}>@</span>
                  <input value={handle} onChange={e=>setHandle(e.target.value)} placeholder="my_group"
                    style={{flex:1,padding:'12px 6px',background:'none',border:'none',color:c.light,fontSize:15,outline:'none'}}/>
                </div>
              </div>
              <div>
                <label style={{fontSize:12,color:c.sub,fontWeight:700,display:'block',marginBottom:6}}>ОПИСАНИЕ</label>
                <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="О чём ваша группа?"
                  style={{width:'100%',padding:'12px',background:c.card,border:`1px solid ${c.border}`,borderRadius:12,color:c.light,fontSize:14,outline:'none',minHeight:80,resize:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
              </div>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <motion.button whileTap={{scale:0.9}} onClick={()=>setIsPrivate(v=>!v)}
                  style={{width:44,height:24,borderRadius:12,background:isPrivate?color:'rgba(255,255,255,0.1)',border:'none',cursor:'pointer',position:'relative',flexShrink:0}}>
                  <div style={{position:'absolute',top:2,left:isPrivate?22:2,width:20,height:20,borderRadius:'50%',background:'#fff',transition:'left 0.2s'}}/>
                </motion.button>
                <span style={{fontSize:14,color:c.mid}}>🔒 Закрытая группа</span>
              </div>
            </div>
          )}

          {/* ШАГ 1: Эмодзи + цвет */}
          {step===1&&(
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              <div style={{display:'flex',justifyContent:'center',marginBottom:4}}>
                <div style={{width:80,height:80,borderRadius:'50%',background:gradient,display:'flex',alignItems:'center',justifyContent:'center',fontSize:44,border:`3px solid ${color}55`}}>
                  {emoji}
                </div>
              </div>
              <div>
                <label style={{fontSize:12,color:c.sub,fontWeight:700,display:'block',marginBottom:8}}>ЭМОДЗИ ГРУППЫ</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {GROUP_EMOJIS.map(e=>(
                    <motion.button key={e} whileTap={{scale:0.9}} onClick={()=>setEmoji(e)}
                      style={{width:44,height:44,borderRadius:12,border:`2px solid ${emoji===e?color:'transparent'}`,background:emoji===e?`${color}22`:'rgba(255,255,255,0.06)',cursor:'pointer',fontSize:24,display:'flex',alignItems:'center',justifyContent:'center'}}>
                      {e}
                    </motion.button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{fontSize:12,color:c.sub,fontWeight:700,display:'block',marginBottom:8}}>ЦВЕТ АКЦЕНТА</label>
                <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
                  {GROUP_COLORS.map(col=>(
                    <motion.button key={col} whileTap={{scale:0.9}} onClick={()=>setColor(col)}
                      style={{width:36,height:36,borderRadius:'50%',background:col,border:`3px solid ${color===col?'#fff':'transparent'}`,cursor:'pointer',boxShadow:color===col?`0 0 10px ${col}`:'none'}}/>
                  ))}
                </div>
              </div>
              <div>
                <label style={{fontSize:12,color:c.sub,fontWeight:700,display:'block',marginBottom:8}}>ГРАДИЕНТ</label>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  {GROUP_GRADIENTS.map((gr,i)=>(
                    <motion.button key={i} whileTap={{scale:0.9}} onClick={()=>setGradient(gr)}
                      style={{width:52,height:52,borderRadius:14,background:gr,border:`2.5px solid ${gradient===gr?'#fff':'transparent'}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>
                      {gradient===gr?emoji:''}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ШАГ 2: ФИНАЛ */}
          {step===2&&(
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{padding:'20px',background:gradient,borderRadius:20,textAlign:'center'}}>
                <div style={{fontSize:56}}>{emoji}</div>
                <p style={{margin:'12px 0 4px',fontSize:19,fontWeight:900,color:'#fff'}}>{name||'Твоя группа'}</p>
                <p style={{margin:'0 0 4px',fontSize:13,color:'rgba(255,255,255,0.7)'}}>@{handle||'handle'}</p>
                {desc&&<p style={{margin:'0 0 12px',fontSize:13,color:'rgba(255,255,255,0.8)',lineHeight:1.5}}>{desc}</p>}
                <span style={{fontSize:12,color:'rgba(255,255,255,0.7)',background:'rgba(0,0,0,0.2)',padding:'3px 10px',borderRadius:20}}>
                  {isPrivate?'🔒 Закрытая':'🌐 Открытая'}
                </span>
              </div>
              <div style={{background:c.card,borderRadius:16,padding:'16px',border:`1px solid ${c.border}`}}>
                <p style={{margin:'0 0 10px',fontSize:13,fontWeight:800,color:c.light}}>🚀 Фишки твоей группы:</p>
                {['🧠 Мозговой штурм — идеи всей команды','📋 Задание дня — ежедневные вызовы','🤫 Анонимные посты — без страха','🎲 Рулетка вопросов — неожиданные ответы','🏆 Рейтинг активности — кто самый крутой','⏳ Групповые капсулы — послания в будущее','🎭 Слово дня — тема от основателя','🌡️ Настроение группы — общий вайб','🎨 Совместный пост — пишем вместе'].map(f=>(
                  <div key={f} style={{display:'flex',gap:8,alignItems:'center',marginBottom:6}}>
                    <div style={{width:5,height:5,borderRadius:'50%',background:color,flexShrink:0}}/>
                    <span style={{fontSize:12,color:c.mid}}>{f}</span>
                  </div>
                ))}
              </div>
              <motion.button whileTap={{scale:0.97}} onClick={handleCreate}
                style={{width:'100%',padding:'16px',borderRadius:16,border:'none',cursor:'pointer',
                  background:`linear-gradient(135deg,${color},${accent})`,
                  color:'#000',fontSize:16,fontWeight:900,boxShadow:`0 6px 24px ${color}44`}}>
                {emoji} Создать группу!
              </motion.button>
            </div>
          )}

          {step<2&&(
            <motion.button whileTap={{scale:0.97}} onClick={()=>setStep(s=>s+1)}
              disabled={step===0&&!name.trim()}
              style={{width:'100%',padding:'15px',borderRadius:16,border:'none',cursor:'pointer',marginTop:20,
                background:step===0&&!name.trim()?'rgba(255,255,255,0.08)':`linear-gradient(135deg,${color},${accent})`,
                color:step===0&&!name.trim()?c.sub:'#000',fontSize:15,fontWeight:900}}>
              Далее →
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
