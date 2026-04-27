import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import SwpExchange from './SwpExchange';
import AccessibilityAssistant from './AccessibilityAssistant';
import GamesArcade from './GamesArcade';
import ChannelsScreen from './ChannelsScreen';
import {UnifiedSearchScreen} from './ProSearch';
import { motion, AnimatePresence } from 'framer-motion';
import { checkContent, collectPostText } from './contentFilter';
import { MessagesScreen, CallCtx, useUnreadCount } from './ProMessaging';
import { useCallSignaling, RINGTONE_OPTIONS, RINGTONE_PREF_KEY } from './useCallSignaling';
import type { RingtoneId } from './useCallSignaling';
import { usePushNotifications } from './usePushNotifications';
import type { ConvUser } from './ProMessaging';
import { useBackHandler } from './backHandler';
import { BG_MUSIC_PRESETS, BgMusicAutoplay, type BgMusicPreset } from './BgMusic';
declare global{interface Window{_sqTimer:ReturnType<typeof setTimeout>;}}

/* ══ Хук установки PWA ══ */
function usePWAInstall() {
  const [prompt, setPrompt] = useState<Event & {prompt:()=>Promise<void>}|null>(null);
  const [isInstalled, setIsInstalled] = useState(
    window.matchMedia('(display-mode: standalone)').matches || (window.navigator as {standalone?:boolean}).standalone === true
  );
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isYandex = /YaBrowser/i.test(navigator.userAgent);

  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setPrompt(e as Event & {prompt:()=>Promise<void>}); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setIsInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => { if (!prompt) return; await prompt.prompt(); setPrompt(null); };
  return { prompt, isIOS, isYandex, isInstalled, install };
}

/* ══ Палитры ══ */
const DARK = {
  bg:'#05050c', surface:'#0e0e16', deep:'#09090f', card:'#14141c', cardAlt:'#1a1a24',
  light:'#e8e8f0', mid:'#b0b0c0', sub:'#666676',
  border:'rgba(200,200,220,0.1)', borderB:'rgba(200,200,220,0.28)',
  red:'#FF2D55', knob:'#b0b0c0', trackBg:'rgba(200,200,220,0.15)',
  chromeGrad:'linear-gradient(180deg,#e8e8f0 0%,#ffffff 35%,#b0b0c0 60%,#d8d8e8 80%,#9090a8 100%)',
  frameBorder:'rgba(200,200,255,0.45)',
};
const LIGHT = {
  bg:'#d8d8e4', surface:'#f4f4fa', deep:'#eaeaf2', card:'#ffffff', cardAlt:'#f0f0f8',
  light:'#141420', mid:'#3a3a4c', sub:'#9090a8',
  border:'rgba(80,80,120,0.12)', borderB:'rgba(80,80,120,0.28)',
  red:'#FF2D55', knob:'#3a3a4c', trackBg:'rgba(80,80,120,0.15)',
  chromeGrad:'linear-gradient(180deg,#3a3a4a 0%,#111118 35%,#6a6a7a 60%,#3a3a4a 80%,#9090a8 100%)',
  frameBorder:'rgba(80,80,150,0.45)',
};
type Pal = typeof DARK;

const COVER_TEMPLATES = [
  {id:1,  bg:'linear-gradient(135deg,#0f0c29,#302b63,#24243e)'},
  {id:2,  bg:'linear-gradient(135deg,#000428,#004e92)'},
  {id:3,  bg:'linear-gradient(135deg,#0f2027,#203a43,#2c5364)'},
  {id:4,  bg:'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)'},
  {id:5,  bg:'linear-gradient(135deg,#2d1b69,#11998e)'},
  {id:6,  bg:'linear-gradient(135deg,#1e3c72,#2a5298)'},
  {id:7,  bg:'linear-gradient(135deg,#2c003e,#8a0e8a)'},
  {id:8,  bg:'linear-gradient(135deg,#0a0a0f,#1a0a3a,#3a0060)'},
  {id:9,  bg:'linear-gradient(135deg,#1c1c1c,#3a3a3a,#1c1c1c)'},
  {id:10, bg:'linear-gradient(135deg,#0d0d0d,#003322,#005533)'},
  {id:11, bg:'linear-gradient(135deg,#3d0000,#6b0000,#3d0000)'},
  {id:12, bg:'linear-gradient(135deg,#1a0f00,#5c3a00,#1a0f00)'},
];

function CSpan({c,children,style}:{c:Pal;children:React.ReactNode;style?:React.CSSProperties}) {
  if (c===DARK) return <span style={{background:c.chromeGrad,WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',color:'transparent',...style} as React.CSSProperties}>{children}</span>;
  return <span style={{color:c.light,...style}}>{children}</span>;
}

function useSaved<T>(key:string,def:T):[T,(v:T)=>void]{
  const [v,sv]=useState<T>(()=>{try{const s=localStorage.getItem(key);return s?JSON.parse(s):def;}catch{return def;}});
  return [v,(val:T)=>{localStorage.setItem(key,JSON.stringify(val));sv(val);}];
}

/* Вычисление номера приглашения (из старого App) */
function computeInviteCode(hash:string, mode:'pro'|'scene'|'krug'):string {
  if (!hash||hash.length<15) return '000000000';
  const offset=mode==='pro'?0:mode==='scene'?15:30;
  const slice=hash.slice(offset,offset+15);
  try { const num=BigInt('0x'+slice)%900_000_000n+100_000_000n; return num.toString(); }
  catch { return '000000000'; }
}

const INVITE_TEXTS = [
  (link:string)=>`Присоединяйся ко мне в SWAIP — здесь уютно и без лишнего шума. ${link}`,
  (link:string)=>`Я в SWAIP. Там классно. ${link}`,
  (link:string)=>`Твой аккаунт защищён мастер-ключом из 4 слов — только ты знаешь код. ${link}`,
  (link:string)=>`Коллеги, отличная платформа для общения и рабочих встреч. ${link}`,
  (link:string)=>`Обожаю SWAIP! Живое общение, никакого рекламного мусора. ${link}`,
  (link:string)=>`SWAIP. Просто. Быстро. Приватно. ${link}`,
  (link:string)=>`Сваливаем из старых соцсетей? В SWAIP спокойно и чисто. ${link}`,
  (link:string)=>`Создал приватный круг — будем общаться только своими. ${link}`,
  (link:string)=>`Мастер-ключ из 4 слов — надёжная защита твоего аккаунта. ${link}`,
  (link:string)=>`SWAIP — отличное место! ${link}`,
  (link:string)=>`Платформа для идей и вдохновения. Публикуй посты, эфиры, музыку. ${link}`,
  (link:string)=>`Никаких лишних форм — мастер-ключ, и ты в системе. Удобно. ${link}`,
  (link:string)=>`Ты знал, что можно общаться без номера телефона и почты? SWAIP. ${link}`,
  (link:string)=>`SWAIP летает даже на старых телефонах. ${link}`,
  (link:string)=>`Давай общаться там, где нас никто не отвлекает. Я в SWAIP. ${link}`,
  (link:string)=>`Ты уже в SWAIP? Уверен, понравится. ${link}`,
  (link:string)=>`Запись клиентов, слоты, чат-бот — всё в одном профиле. Владельцам бизнеса точно стоит попробовать. ${link}`,
  (link:string)=>`Твой мастер-ключ — только твой. Никто не получит доступ без него. ${link}`,
  (link:string)=>`Создаём новое комьюнити. Удобные чаты, круги по интересам, эфиры. ${link}`,
  (link:string)=>`Твои данные под надёжной защитой — только ты управляешь доступом через 4 слова. ${link}`,
  (link:string)=>`Мама, папа, давайте перейдём в SWAIP — там спокойно и всё под рукой. ${link}`,
  (link:string)=>`Чистый интерфейс, никакого мусора. SWAIP как старый добрый друг. ${link}`,
  (link:string)=>`Наконец-то нормальная соцсеть 😊 ${link}`,
  (link:string)=>`Регистрация за 10 секунд — придумай 4 слова и общайся. ${link}`,
  (link:string)=>`В SWAIP есть аудио-конференции с доской, чат-бот для записи и даже перевод для глухих. ${link}`,
  (link:string)=>`Все соцсети одинаковые? А вот и нет. Попробуй SWAIP. ${link}`,
  (link:string)=>`Что-то свежее на рынке общения. Твой новый цифровой дом. ${link}`,
  (link:string)=>`Мастер-ключ на 4 слова — надёжнее любого пароля. ${link}`,
  (link:string)=>`Твой аккаунт не взломают — только ты знаешь свои 4 слова. ${link}`,
  (link:string)=>`SWAIP — то, что нужно. ${link}`,
];

/* ══ Шит поделиться ══ */
/* ── Генератор случайного английского никнейма ── */
const _HADJ=['cool','fast','dark','bold','wild','swift','calm','keen','pure','rare','silk','wise','blue','gold','iron','epic','icy','neon','nova','zinc','jade','lime','mint','vivid','sleek','stark','sharp','deep','free','odd','raw','rich','soft','warm','wavy','lazy','nice','urban','bright'];
const _HNOUN=['owl','fox','wolf','bear','hawk','lion','raven','crane','eagle','falcon','gecko','lynx','otter','shark','tiger','viper','whale','bison','cobra','finch','ibis','koala','lemur','mink','pike','wren','puma','kite','moose','dingo','elk','jay','vole','toad','crab','dove','hound'];
const genHandle=()=>`${_HADJ[Math.floor(Math.random()*_HADJ.length)]}_${_HNOUN[Math.floor(Math.random()*_HNOUN.length)]}`;

function ShareSheet({userHash,name,onClose}:{userHash:string;name:string;onClose:()=>void}) {
  const inviteCode=computeInviteCode(userHash,'pro');
  const link=`${window.location.origin}/p/${inviteCode}`;
  const [tplIdx,setTplIdx]=useState(()=>Math.floor(Math.random()*INVITE_TEXTS.length));
  const [copied,setCopied]=useState(false);
  const [codeCopied,setCodeCopied]=useState(false);
  const [shuffled,setShuffled]=useState(false);
  const inviteText=INVITE_TEXTS[tplIdx](link);

  const shuffle=()=>{
    let next=Math.floor(Math.random()*INVITE_TEXTS.length);
    if(next===tplIdx&&INVITE_TEXTS.length>1)next=(next+1)%INVITE_TEXTS.length;
    setTplIdx(next);setShuffled(true);setTimeout(()=>setShuffled(false),600);
  };

  const copyAll=async()=>{
    await navigator.clipboard?.writeText(inviteText).catch(()=>{});
    setCopied(true);setTimeout(()=>setCopied(false),2200);
  };

  const copyCode=async()=>{
    await navigator.clipboard?.writeText(inviteCode).catch(()=>{});
    setCodeCopied(true);setTimeout(()=>setCodeCopied(false),1800);
  };

  const shareNative=async()=>{
    if(navigator.share){try{await navigator.share({title:'SWAIP',text:inviteText,url:link});return;}catch{}}
    await copyAll();
  };

  const shareUrls:{[k:string]:string}={
    telegram:`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(inviteText)}`,
    vk:`https://vk.com/share.php?url=${encodeURIComponent(link)}&title=${encodeURIComponent(inviteText)}`,
    whatsapp:`https://api.whatsapp.com/send?text=${encodeURIComponent(inviteText)}`,
  };

  return(
    <>
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}
        style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.82)',backdropFilter:'blur(8px)',zIndex:1000}}/>
      <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
        transition={{type:'spring',stiffness:360,damping:34}}
        style={{position:'fixed',bottom:0,left:0,right:0,zIndex:1001,
          background:'rgba(12,12,20,0.99)',backdropFilter:'blur(28px)',
          borderRadius:'24px 24px 0 0',border:'1px solid rgba(255,255,255,0.09)',
          paddingBottom:'env(safe-area-inset-bottom,16px)',overflowY:'auto',maxHeight:'92dvh'}}>

        {/* Ручка */}
        <div style={{width:40,height:4,background:'rgba(255,255,255,0.15)',borderRadius:99,margin:'14px auto 0'}}/>

        {/* Заголовок */}
        <div style={{padding:'14px 20px 0',display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:44,height:44,borderRadius:'50%',flexShrink:0,
            background:'linear-gradient(135deg,#0a0a0f,#1a0a3a)',
            border:'2px solid rgba(180,180,255,0.3)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>👤</div>
          <div style={{flex:1}}>
            <div style={{fontWeight:900,fontSize:15,color:'#fff',fontFamily:'"Montserrat",sans-serif'}}>{name||'Мой профиль'}</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>Поделиться аккаунтом SWAIP</div>
          </div>
          <motion.button whileTap={{scale:0.93}} onClick={onClose}
            style={{display:'flex',alignItems:'center',gap:5,padding:'7px 14px',
              background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',
              borderRadius:50,cursor:'pointer',color:'rgba(255,255,255,0.7)',fontSize:12,fontWeight:700}}>
            ← Назад
          </motion.button>
        </div>

        {/* Превью текста */}
        <motion.div key={tplIdx} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}
          style={{margin:'14px 20px 0',borderRadius:16,padding:'14px 16px',
            background:'rgba(180,180,255,0.06)',border:'1px solid rgba(180,180,255,0.18)'}}>
          <div style={{fontSize:13,lineHeight:1.7,color:'rgba(255,255,255,0.88)'}}>{inviteText}</div>
        </motion.div>

        {/* Кнопка другой текст */}
        <div style={{padding:'10px 20px 0',display:'flex',justifyContent:'center'}}>
          <motion.button whileTap={{scale:0.93}} animate={shuffled?{scale:[1,1.07,1]}:{}} onClick={shuffle}
            style={{display:'flex',alignItems:'center',gap:8,padding:'9px 22px',borderRadius:50,
              background:'rgba(180,180,255,0.1)',border:'1.5px solid rgba(180,180,255,0.3)',
              color:'rgba(200,200,255,0.9)',cursor:'pointer',fontWeight:800,fontSize:12}}>
            🔀 Другой текст
            <span style={{opacity:0.5,fontSize:10}}>{tplIdx+1}/{INVITE_TEXTS.length}</span>
          </motion.button>
        </div>

        {/* Кнопки шэринга */}
        <div style={{padding:'12px 20px 0',display:'flex',flexDirection:'column',gap:10}}>
          {/* Системный шэр или Telegram/VK/WA */}
          <motion.button whileTap={{scale:0.97}} onClick={shareNative}
            style={{width:'100%',padding:'14px',borderRadius:16,fontSize:14,fontWeight:800,
              cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10,
              background:'linear-gradient(135deg,rgba(180,180,255,0.2),rgba(180,180,255,0.1))',
              border:'1px solid rgba(180,180,255,0.35)',color:'#fff',
              boxShadow:'0 4px 20px rgba(100,100,255,0.2)'}}>
            <span style={{fontSize:20}}>↗️</span> Поделиться
          </motion.button>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            {[{k:'telegram',lbl:'Telegram',icon:'✈️',clr:'#29b6f6'},
              {k:'vk',lbl:'ВКонтакте',icon:'🔵',clr:'#5181b8'},
              {k:'whatsapp',lbl:'WhatsApp',icon:'💬',clr:'#25d366'}]
              .map(p=>(
              <motion.button key={p.k} whileTap={{scale:0.91}}
                onClick={()=>window.open(shareUrls[p.k],'_blank')}
                style={{padding:'12px 6px',borderRadius:14,background:`${p.clr}18`,
                  border:`1px solid ${p.clr}33`,color:p.clr,cursor:'pointer',fontWeight:700,fontSize:11,
                  display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
                <span style={{fontSize:22}}>{p.icon}</span>{p.lbl}
              </motion.button>
            ))}
          </div>

          {/* Копировать */}
          <motion.button whileTap={{scale:0.97}} onClick={copyAll}
            style={{width:'100%',padding:'13px',borderRadius:16,fontSize:13,fontWeight:700,
              cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:10,
              background:copied?'rgba(34,197,94,0.15)':'rgba(255,255,255,0.06)',
              border:`1px solid ${copied?'rgba(34,197,94,0.4)':'rgba(255,255,255,0.12)'}`,
              color:copied?'#4ade80':'rgba(255,255,255,0.8)'}}>
            <span style={{fontSize:18}}>{copied?'✅':'🔗'}</span>
            {copied?'Скопировано!':'Скопировать текст и ссылку'}
          </motion.button>
        </div>

        {/* Блок номера приглашения */}
        <div style={{margin:'12px 20px 20px',background:'rgba(180,180,255,0.06)',
          border:'1px solid rgba(180,180,255,0.28)',borderRadius:16,padding:'14px 16px'}}>
          <div style={{fontSize:11,fontWeight:700,color:'rgba(180,180,255,0.8)',marginBottom:10,
            textTransform:'uppercase',letterSpacing:'0.06em'}}>
            🔢 Номер приглашения
          </div>
          <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:8}}>
            <div style={{flex:1,fontFamily:'monospace',fontSize:26,fontWeight:900,
              letterSpacing:5,color:'#fff',userSelect:'all'}}>{inviteCode}</div>
            <motion.button whileTap={{scale:0.93}} onClick={copyCode}
              style={{padding:'8px 14px',background:codeCopied?'rgba(34,197,94,0.2)':'rgba(180,180,255,0.15)',
                border:`1px solid ${codeCopied?'rgba(34,197,94,0.4)':'rgba(180,180,255,0.3)'}`,
                borderRadius:10,color:codeCopied?'#4ade80':'rgba(180,180,255,0.9)',
                fontWeight:700,fontSize:12,cursor:'pointer',flexShrink:0}}>
              {codeCopied?'✓ Скопирован':'Копировать'}
            </motion.button>
          </div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',lineHeight:1.6}}>
            Поделитесь своим номером приглашения — по нему вас найдут в SWAIP
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ══ Полный список языков ══ */
const LANGUAGES=[
  {code:'af',flag:'🇿🇦',name:'Afrikaans',native:'Afrikaans'},
  {code:'ar',flag:'🇸🇦',name:'Arabic',native:'العربية'},
  {code:'az',flag:'🇦🇿',name:'Azerbaijani',native:'Azərbaycan'},
  {code:'be',flag:'🇧🇾',name:'Belarusian',native:'Беларуская'},
  {code:'bg',flag:'🇧🇬',name:'Bulgarian',native:'Български'},
  {code:'bn',flag:'🇧🇩',name:'Bengali',native:'বাংলা'},
  {code:'ca',flag:'🏳️',name:'Catalan',native:'Català'},
  {code:'cs',flag:'🇨🇿',name:'Czech',native:'Čeština'},
  {code:'da',flag:'🇩🇰',name:'Danish',native:'Dansk'},
  {code:'de',flag:'🇩🇪',name:'German',native:'Deutsch'},
  {code:'el',flag:'🇬🇷',name:'Greek',native:'Ελληνικά'},
  {code:'en',flag:'🇬🇧',name:'English',native:'English'},
  {code:'es',flag:'🇪🇸',name:'Spanish',native:'Español'},
  {code:'et',flag:'🇪🇪',name:'Estonian',native:'Eesti'},
  {code:'eu',flag:'🏳️',name:'Basque',native:'Euskara'},
  {code:'fa',flag:'🇮🇷',name:'Persian',native:'فارسی'},
  {code:'fi',flag:'🇫🇮',name:'Finnish',native:'Suomi'},
  {code:'fr',flag:'🇫🇷',name:'French',native:'Français'},
  {code:'gl',flag:'🏳️',name:'Galician',native:'Galego'},
  {code:'gu',flag:'🇮🇳',name:'Gujarati',native:'ગુજરાતી'},
  {code:'he',flag:'🇮🇱',name:'Hebrew',native:'עברית'},
  {code:'hi',flag:'🇮🇳',name:'Hindi',native:'हिन्दी'},
  {code:'hr',flag:'🇭🇷',name:'Croatian',native:'Hrvatski'},
  {code:'hu',flag:'🇭🇺',name:'Hungarian',native:'Magyar'},
  {code:'hy',flag:'🇦🇲',name:'Armenian',native:'Հայerен'},
  {code:'id',flag:'🇮🇩',name:'Indonesian',native:'Bahasa Indonesia'},
  {code:'is',flag:'🇮🇸',name:'Icelandic',native:'Íslenska'},
  {code:'it',flag:'🇮🇹',name:'Italian',native:'Italiano'},
  {code:'ja',flag:'🇯🇵',name:'Japanese',native:'日本語'},
  {code:'ka',flag:'🇬🇪',name:'Georgian',native:'ქართული'},
  {code:'kk',flag:'🇰🇿',name:'Kazakh',native:'Қазақ тілі'},
  {code:'km',flag:'🇰🇭',name:'Khmer',native:'ខ្មែរ'},
  {code:'kn',flag:'🇮🇳',name:'Kannada',native:'ಕನ್ನಡ'},
  {code:'ko',flag:'🇰🇷',name:'Korean',native:'한국어'},
  {code:'lt',flag:'🇱🇹',name:'Lithuanian',native:'Lietuvių'},
  {code:'lv',flag:'🇱🇻',name:'Latvian',native:'Latviešu'},
  {code:'mk',flag:'🇲🇰',name:'Macedonian',native:'Македонски'},
  {code:'ml',flag:'🇮🇳',name:'Malayalam',native:'മലയാളം'},
  {code:'mn',flag:'🇲🇳',name:'Mongolian',native:'Монгол'},
  {code:'mr',flag:'🇮🇳',name:'Marathi',native:'मराठी'},
  {code:'ms',flag:'🇲🇾',name:'Malay',native:'Bahasa Melayu'},
  {code:'my',flag:'🇲🇲',name:'Burmese',native:'မြန်မာ'},
  {code:'nb',flag:'🇳🇴',name:'Norwegian',native:'Norsk'},
  {code:'nl',flag:'🇳🇱',name:'Dutch',native:'Nederlands'},
  {code:'pa',flag:'🇮🇳',name:'Punjabi',native:'ਪੰਜਾਬੀ'},
  {code:'pl',flag:'🇵🇱',name:'Polish',native:'Polski'},
  {code:'pt',flag:'🇵🇹',name:'Portuguese',native:'Português'},
  {code:'pt_BR',flag:'🇧🇷',name:'Portuguese (Brazil)',native:'Português (Brasil)'},
  {code:'ro',flag:'🇷🇴',name:'Romanian',native:'Română'},
  {code:'ru',flag:'🇷🇺',name:'Russian',native:'Русский'},
  {code:'si',flag:'🇱🇰',name:'Sinhala',native:'සිංහල'},
  {code:'sk',flag:'🇸🇰',name:'Slovak',native:'Slovenčina'},
  {code:'sl',flag:'🇸🇮',name:'Slovenian',native:'Slovenščina'},
  {code:'sq',flag:'🇦🇱',name:'Albanian',native:'Shqip'},
  {code:'sr',flag:'🇷🇸',name:'Serbian',native:'Српски'},
  {code:'sv',flag:'🇸🇪',name:'Swedish',native:'Svenska'},
  {code:'sw',flag:'🇰🇪',name:'Swahili',native:'Kiswahili'},
  {code:'ta',flag:'🇮🇳',name:'Tamil',native:'தமிழ்'},
  {code:'te',flag:'🇮🇳',name:'Telugu',native:'తెలుగు'},
  {code:'th',flag:'🇹🇭',name:'Thai',native:'ภาษาไทย'},
  {code:'tr',flag:'🇹🇷',name:'Turkish',native:'Türkçe'},
  {code:'tt',flag:'🇷🇺',name:'Tatar',native:'Татарча'},
  {code:'uk',flag:'🇺🇦',name:'Ukrainian',native:'Українська'},
  {code:'ur',flag:'🇵🇰',name:'Urdu',native:'اردو'},
  {code:'uz',flag:'🇺🇿',name:'Uzbek',native:'Oʻzbekcha'},
  {code:'vi',flag:'🇻🇳',name:'Vietnamese',native:'Tiếng Việt'},
  {code:'zh',flag:'🇨🇳',name:'Chinese (Simplified)',native:'中文简体'},
  {code:'zh_TW',flag:'🇹🇼',name:'Chinese (Traditional)',native:'中文繁體'},
];

/* ══ Боковое меню (слайд слева) ══ */
function SideMenu({open,onClose,onOldMode,onLogout,onMeetings,onDesign,onExchange,onAssistant,onBrowser,onGames,c,ringtoneId,onRingtoneChange}:{open:boolean;onClose:()=>void;onOldMode?:()=>void;onLogout:()=>void;onMeetings?:()=>void;onDesign?:()=>void;onExchange?:()=>void;onAssistant?:()=>void;onBrowser?:()=>void;onGames?:()=>void;c:Pal;ringtoneId?:string;onRingtoneChange?:(id:string)=>void}){
  const {prompt,isIOS,isYandex,isInstalled,install}=usePWAInstall();
  type Modal='language'|'privacy'|'about'|'docs'|'ringtone';
  const [modal,setModal]=useState<Modal|null>(null);
  const [docType,setDocType]=useState<'privacy'|'terms'|'pd'|'cookies'>('privacy');
  const [langSearch,setLangSearch]=useState('');
  const [curLang,setCurLang]=useState(()=>{
    try{return localStorage.getItem('swaip_lang')||'ru';}catch{return 'ru';}
  });
  // Приватность
  const [privWho,setPrivWho]=useSaved('priv_who','all');
  const [privSearch,setPrivSearch]=useSaved('priv_search','1');
  const [privPhone,setPrivPhone]=useSaved('priv_phone','invite');
  const [privOnline,setPrivOnline]=useSaved('priv_online','1');

  const filteredLangs=langSearch.trim()
    ?LANGUAGES.filter(l=>l.name.toLowerCase().includes(langSearch.toLowerCase())||l.native.toLowerCase().includes(langSearch.toLowerCase())||l.code.toLowerCase().includes(langSearch.toLowerCase()))
    :LANGUAGES;

  const pickLang=(code:string)=>{
    setCurLang(code);
    try{localStorage.setItem('swaip_lang',code);}catch{}
    setModal(null);setLangSearch('');
  };

  const curLangInfo=LANGUAGES.find(l=>l.code===curLang)||LANGUAGES.find(l=>l.code==='ru')!;

  /* Название текущего рингтона */
  const curRingName = RINGTONE_OPTIONS.find(r=>r.id===ringtoneId)?.name ?? 'Классический';

  const SETTINGS=[
    {icon:'🎮',label:'Игры',sub:'20 игр — одиночные и мультиплеер',fn:()=>{onGames?.();onClose();}},
    {icon:'🌐',label:'Браузер SWAIP',sub:'Открыть встроенный браузер',fn:()=>{onBrowser?.();onClose();}},
    {icon:'👁',label:'Я слышу',sub:'Ассистент для людей с нарушением слуха и речи',fn:()=>{onAssistant?.();onClose();}},
    {icon:'📊',label:'Биржа SWP',sub:'Монета SWAIP · График · Кошелёк',fn:()=>{onExchange?.();onClose();}},
    {icon:'🎨',label:'Оформление',sub:'Тема, обложка, аватар',fn:()=>{onDesign?.();onClose();}},
    {icon:'🔔',label:'Рингтон звонка',sub:curRingName,fn:()=>setModal('ringtone')},
    {icon:'🔒',label:'Приватность',sub:'Кто видит мой профиль',fn:()=>setModal('privacy')},
    {icon:'🌏',label:'Язык',sub:curLangInfo.flag+' '+curLangInfo.native,fn:()=>setModal('language')},
    {icon:'💬',label:'Поддержка',sub:'Написать в SWAIP',fn:()=>window.open('mailto:support@swaip.ru','_blank')},
    {icon:'📄',label:'Документы',sub:'Конфиденциальность, условия, 152-ФЗ',fn:()=>setModal('docs')},
    {icon:'📖',label:'О приложении',sub:'SWAIP v2.0',fn:()=>setModal('about')},
  ];

  const isDark=c===DARK;
  const bg=isDark?'rgba(8,8,18,0.99)':'rgba(245,245,252,0.99)';
  const overlayBg='rgba(0,0,0,0.85)';

  /* ─ Модальные экраны ─ */
  const modalStyle:React.CSSProperties={
    position:'fixed',inset:0,zIndex:600,display:'flex',flexDirection:'column',
    background:isDark?'#090910':'#f8f8fc',fontFamily:'"Montserrat",sans-serif'
  };
  const mHead=(title:string,onBack:()=>void)=>(
    <div style={{display:'flex',alignItems:'center',gap:12,padding:'48px 16px 14px',
      borderBottom:`1px solid ${c.border}`,background:isDark?'rgba(10,10,22,0.98)':'rgba(248,248,252,0.98)',
      position:'sticky',top:0,zIndex:2,backdropFilter:'blur(16px)'}}>
      <motion.button whileTap={{scale:0.88}} onClick={onBack}
        style={{width:36,height:36,borderRadius:'50%',background:c.cardAlt,border:`1px solid ${c.borderB}`,
          color:c.mid,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>←</motion.button>
      <span style={{fontSize:16,fontWeight:900,color:c.light,letterSpacing:'0.02em'}}>{title}</span>
    </div>
  );

  /* Блок выбора приватности */
  const PRIV_OPTS=[
    {v:'all',   ico:'🌍',lbl:'Все',              sub:'Любой пользователь SWAIP'},
    {v:'except',ico:'🚫',lbl:'Все, кроме...',    sub:'Все, кроме заблокированных вами'},
    {v:'invite',ico:'🔢',lbl:'По номеру приглашения',sub:'Только тот, кто знает ваш 9-значный код'},
    {v:'chat',  ico:'💬',lbl:'С кем переписывался',sub:'Только те, с кем уже общался в чате'},
  ];
  const PrivSelect=({label,value,onChange,opts}:{label:string;value:string;onChange:(v:string)=>void;opts?:typeof PRIV_OPTS})=>{
    const options=opts||PRIV_OPTS;
    return(
      <div style={{marginBottom:18}}>
        <div style={{fontSize:11,fontWeight:700,color:c.sub,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:8}}>{label}</div>
        <div style={{display:'flex',flexDirection:'column',gap:5}}>
          {options.map(({v,ico,lbl,sub})=>(
            <motion.button key={v} whileTap={{scale:0.98}} onClick={()=>onChange(v)}
              style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',borderRadius:12,
                border:`1.5px solid ${value===v?c.mid:c.border}`,
                background:value===v?`rgba(160,160,200,0.12)`:'transparent',cursor:'pointer',textAlign:'left'}}>
              <span style={{fontSize:18,flexShrink:0}}>{ico}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:value===v?800:600,color:value===v?c.light:c.mid}}>{lbl}</div>
                <div style={{fontSize:10,color:c.sub,marginTop:1,lineHeight:1.3}}>{sub}</div>
              </div>
              {value===v&&<span style={{color:c.mid,fontSize:15,flexShrink:0}}>✓</span>}
            </motion.button>
          ))}
        </div>
      </div>
    );
  };

  const Toggle=({label,sub,value,onChange}:{label:string;sub?:string;value:string;onChange:(v:string)=>void})=>(
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'13px 0',borderBottom:`1px solid ${c.border}`}}>
      <div>
        <div style={{fontSize:14,fontWeight:700,color:c.light}}>{label}</div>
        {sub&&<div style={{fontSize:11,color:c.sub,marginTop:2,lineHeight:1.4}}>{sub}</div>}
      </div>
      <motion.button whileTap={{scale:0.9}} onClick={()=>onChange(value==='1'?'0':'1')}
        style={{width:48,height:26,borderRadius:13,background:value==='1'?c.mid:`rgba(160,160,200,0.15)`,
          border:`1px solid ${value==='1'?c.mid:c.border}`,cursor:'pointer',position:'relative',flexShrink:0,transition:'background 0.2s'}}>
        <motion.div animate={{x:value==='1'?22:2}} transition={{type:'spring',stiffness:400,damping:28}}
          style={{position:'absolute',top:3,width:20,height:20,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 4px rgba(0,0,0,0.4)'}}/>
      </motion.button>
    </div>
  );

  const DocText=({type}:{type:string})=>{
    const now=new Date().getFullYear();
    if(type==='privacy') return(
      <div style={{fontSize:13,color:c.mid,lineHeight:1.8}}>
        <h3 style={{color:c.light,fontSize:15,fontWeight:900,margin:'0 0 16px'}}>Политика конфиденциальности SWAIP</h3>
        <p style={{margin:'0 0 12px'}}><strong style={{color:c.light}}>Дата вступления в силу:</strong> 1 января {now} года</p>
        <p style={{margin:'0 0 16px'}}>Настоящая Политика конфиденциальности описывает, как ООО «СВАЙП» (далее — «SWAIP», «мы», «нас») собирает, использует, хранит и защищает персональные данные пользователей социальной сети SWAIP в соответствии с требованиями Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных».</p>
        <p style={{margin:'0 0 8px',fontWeight:800,color:c.light}}>1. Какие данные мы собираем</p>
        <p style={{margin:'0 0 16px'}}>• Имя и никнейм, указанные при регистрации{'\n'}• Хэш-идентификатор аккаунта (не содержит персональных данных напрямую){'\n'}• Фотография профиля и обложка (по желанию пользователя){'\n'}• Номер телефона и контакты (только если пользователь добавил){'\n'}• Публикации, виджеты и медиафайлы, размещённые пользователем{'\n'}• Технические данные: IP-адрес, тип устройства, браузер, операционная система{'\n'}• Данные о сессиях и активности в приложении</p>
        <p style={{margin:'0 0 8px',fontWeight:800,color:c.light}}>2. Цели обработки данных</p>
        <p style={{margin:'0 0 16px'}}>Мы обрабатываем данные для: обеспечения работы сервиса и аутентификации; персонализации контента; безопасности платформы и предотвращения мошенничества; технической поддержки пользователей; соблюдения требований российского законодательства.</p>
        <p style={{margin:'0 0 8px',fontWeight:800,color:c.light}}>3. Хранение данных</p>
        <p style={{margin:'0 0 16px'}}>Все персональные данные пользователей хранятся исключительно на серверах, расположенных на территории Российской Федерации, в соответствии с требованиями ст. 18.1 Федерального закона № 152-ФЗ.</p>
        <p style={{margin:'0 0 8px',fontWeight:800,color:c.light}}>4. Передача данных третьим лицам</p>
        <p style={{margin:'0 0 16px'}}>Мы не передаём персональные данные третьим лицам без согласия пользователя, за исключением случаев, предусмотренных законодательством Российской Федерации (по запросу уполномоченных органов власти).</p>
        <p style={{margin:'0 0 8px',fontWeight:800,color:c.light}}>5. Права пользователей</p>
        <p style={{margin:'0 0 16px'}}>Вы имеете право: получить информацию об обработке ваших данных; потребовать исправления недостоверных данных; потребовать удаления данных («право на забвение»); отозвать согласие на обработку данных; обратиться с жалобой в Роскомнадзор (rkn.gov.ru).</p>
        <p style={{margin:'0 0 8px',fontWeight:800,color:c.light}}>6. Контакты</p>
        <p style={{margin:'0 0 16px'}}>По вопросам, связанным с обработкой персональных данных: <strong>privacy@swaip.ru</strong></p>
        <p style={{margin:'0 0 0',color:c.sub,fontSize:11}}>© {now} ООО «СВАЙП». Все права защищены.</p>
      </div>
    );
    if(type==='terms') return(
      <div style={{fontSize:13,color:c.mid,lineHeight:1.8}}>
        <h3 style={{color:c.light,fontSize:15,fontWeight:900,margin:'0 0 16px'}}>Пользовательское соглашение SWAIP</h3>
        <p style={{margin:'0 0 12px'}}><strong style={{color:c.light}}>Редакция от:</strong> 1 января {now} года</p>
        <p style={{margin:'0 0 8px',fontWeight:800,color:c.light}}>1. Общие положения</p>
        <p style={{margin:'0 0 16px'}}>Настоящее Пользовательское соглашение (далее — «Соглашение») регулирует отношения между ООО «СВАЙП» и пользователями социальной сети SWAIP. Используя SWAIP, вы соглашаетесь с условиями настоящего Соглашения.</p>
        <p style={{margin:'0 0 8px',fontWeight:800,color:c.light}}>2. Регистрация и аккаунт</p>
        <p style={{margin:'0 0 16px'}}>Для использования SWAIP необходимо создать аккаунт. Вы несёте ответственность за сохранность ключа доступа (мастер-ключа) и за все действия, совершённые с вашего аккаунта. Передача аккаунта третьим лицам запрещена.</p>
        <p style={{margin:'0 0 8px',fontWeight:800,color:c.light}}>3. Правила поведения</p>
        <p style={{margin:'0 0 16px'}}>Запрещается: размещение контента, нарушающего законодательство РФ; распространение спама, вредоносных программ; публикация материалов, дискредитирующих государственные органы РФ; призывы к экстремизму и терроризму; нарушение прав несовершеннолетних.</p>
        <p style={{margin:'0 0 8px',fontWeight:800,color:c.light}}>4. Интеллектуальная собственность</p>
        <p style={{margin:'0 0 16px'}}>Контент, размещённый пользователем, остаётся его собственностью. Пользователь предоставляет SWAIP неисключительную лицензию на использование контента в рамках работы сервиса.</p>
        <p style={{margin:'0 0 8px',fontWeight:800,color:c.light}}>5. Ответственность</p>
        <p style={{margin:'0 0 16px'}}>SWAIP не несёт ответственности за контент, созданный пользователями. Пользователь несёт полную ответственность за соответствие размещаемых материалов требованиям законодательства Российской Федерации.</p>
        <p style={{margin:'0 0 8px',fontWeight:800,color:c.light}}>6. Применимое право</p>
        <p style={{margin:'0 0 16px'}}>Соглашение регулируется законодательством Российской Федерации. Споры разрешаются в судебном порядке по месту нахождения ООО «СВАЙП».</p>
        <p style={{margin:'0 0 0',color:c.sub,fontSize:11}}>По вопросам: <strong>legal@swaip.ru</strong></p>
      </div>
    );
    if(type==='pd') return(
      <div style={{fontSize:13,color:c.mid,lineHeight:1.8}}>
        <h3 style={{color:c.light,fontSize:15,fontWeight:900,margin:'0 0 16px'}}>Согласие на обработку персональных данных</h3>
        <p style={{margin:'0 0 12px'}}>В соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных», используя приложение SWAIP, вы выражаете свободное, конкретное, информированное и сознательное согласие на обработку ваших персональных данных.</p>
        <p style={{margin:'0 0 8px',fontWeight:800,color:c.light}}>Оператор персональных данных:</p>
        <p style={{margin:'0 0 16px'}}>ООО «СВАЙП»<br/>ИНН: указан в реестре операторов ПД Роскомнадзора<br/>Адрес: Российская Федерация<br/>Email: privacy@swaip.ru</p>
        <p style={{margin:'0 0 8px',fontWeight:800,color:c.light}}>Цели обработки:</p>
        <p style={{margin:'0 0 16px'}}>• Идентификация и аутентификация пользователей{'\n'}• Обеспечение работы социальной сети{'\n'}• Персонализация контента{'\n'}• Обеспечение безопасности платформы{'\n'}• Исполнение требований законодательства РФ</p>
        <p style={{margin:'0 0 8px',fontWeight:800,color:c.light}}>Перечень персональных данных:</p>
        <p style={{margin:'0 0 16px'}}>Имя, фотография, контакты (по желанию), публикуемый контент, технические данные устройства.</p>
        <p style={{margin:'0 0 8px',fontWeight:800,color:c.light}}>Срок хранения:</p>
        <p style={{margin:'0 0 16px'}}>Данные хранятся в течение срока действия аккаунта и 3 лет после его удаления в соответствии с требованиями НК РФ.</p>
        <p style={{margin:'0 0 8px',fontWeight:800,color:c.light}}>Отзыв согласия:</p>
        <p style={{margin:'0 0 16px'}}>Вы вправе отозвать согласие, направив заявление на <strong>privacy@swaip.ru</strong>. Отзыв согласия влечёт удаление аккаунта.</p>
        <p style={{margin:'0 0 0',color:c.sub,fontSize:11}}>Данные не передаются за пределы РФ. Хранение: серверы РФ.</p>
      </div>
    );
    return(
      <div style={{fontSize:13,color:c.mid,lineHeight:1.8}}>
        <h3 style={{color:c.light,fontSize:15,fontWeight:900,margin:'0 0 16px'}}>Политика использования Cookie</h3>
        <p style={{margin:'0 0 16px'}}>SWAIP использует технологии локального хранилища (localStorage, IndexedDB) и сессионные токены для обеспечения работы приложения.</p>
        <p style={{margin:'0 0 8px',fontWeight:800,color:c.light}}>Что мы сохраняем на устройстве:</p>
        <p style={{margin:'0 0 16px'}}>• <strong>swaip_session</strong> — токен текущей сессии (удаляется при выходе){'\n'}• <strong>swaip_lang</strong> — выбранный язык интерфейса{'\n'}• <strong>pro_*</strong> — данные Про-профиля (имя, аватар, виджеты){'\n'}• <strong>sw_*</strong> — пользовательские настройки (тема, никнейм){'\n'}• <strong>priv_*</strong> — настройки приватности</p>
        <p style={{margin:'0 0 8px',fontWeight:800,color:c.light}}>Данные не передаются третьим лицам.</p>
        <p style={{margin:'0 0 16px'}}>Все данные хранятся только на вашем устройстве или на серверах SWAIP в России. Мы не используем сторонние аналитические сервисы (Google Analytics, Яндекс.Метрика не применяются без явного согласия).</p>
        <p style={{margin:'0 0 0',color:c.sub,fontSize:11}}>Для очистки данных: Выйти из аккаунта → очистить данные сайта в браузере.</p>
      </div>
    );
  };

  return(
    <>
    <AnimatePresence>
      {open&&(
        <>
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}
            style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(4px)'}}/>
          <motion.div initial={{x:'-100%'}} animate={{x:0}} exit={{x:'-100%'}}
            transition={{type:'spring',stiffness:340,damping:32}}
            style={{position:'fixed',top:0,left:0,bottom:0,width:290,zIndex:501,
              background:bg,backdropFilter:'blur(24px)',
              borderRight:`1.5px solid ${c.borderB}`,
              boxShadow:`6px 0 48px rgba(0,0,0,0.7)`,
              display:'flex',flexDirection:'column',overflowY:'auto'}}>

            {/* Шапка */}
            <div style={{padding:'52px 20px 16px',borderBottom:`1px solid ${c.border}`,
              display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <span style={{fontSize:20}}>☰</span>
                <CSpan c={c} style={{fontSize:14,fontWeight:900,letterSpacing:'0.1em',fontFamily:'"Montserrat",sans-serif'}}>МЕНЮ</CSpan>
              </div>
              <motion.button whileTap={{scale:0.88}} onClick={onClose}
                style={{background:'none',border:'none',cursor:'pointer',color:c.sub,fontSize:22,padding:0}}>✕</motion.button>
            </div>


            {/* Настройки */}
            <div style={{padding:'8px 0'}}>
              <div style={{margin:'0 20px 8px',fontSize:10,fontWeight:700,color:c.sub,
                letterSpacing:'0.15em',fontFamily:'"Montserrat",sans-serif'}}>НАСТРОЙКИ</div>
              {SETTINGS.map((s,idx)=>(
                <motion.button key={s.label}
                  initial={{x:-20,opacity:0}} animate={{x:0,opacity:1}}
                  transition={{delay:0.25+idx*0.04}}
                  whileTap={{scale:0.96}}
                  onClick={s.fn}
                  style={{width:'100%',display:'flex',alignItems:'center',gap:14,
                    padding:'10px 20px',background:'none',border:'none',cursor:'pointer',textAlign:'left'}}>
                  <span style={{fontSize:20}}>{s.icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:700,color:c.mid,fontFamily:'"Montserrat",sans-serif'}}>{s.label}</div>
                    <div style={{fontSize:10,color:c.sub,marginTop:1,lineHeight:1.3,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.sub}</div>
                  </div>
                  <span style={{color:c.sub,fontSize:12,flexShrink:0}}>›</span>
                </motion.button>
              ))}
            </div>

            {/* Разделитель */}
            <div style={{margin:'4px 20px',height:1,background:c.border}}/>

            {/* Доп. пункты */}
            <div style={{padding:'8px 0',flex:1}}>
              {onOldMode&&(
                <motion.button whileTap={{scale:0.96}} onClick={()=>{onClose();onOldMode();}}
                  style={{width:'100%',display:'flex',alignItems:'center',gap:14,
                    padding:'10px 20px',background:'none',border:'none',cursor:'pointer',textAlign:'left'}}>
                  <span style={{fontSize:20}}>🔄</span>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:c.mid}}>Старый вид</div>
                    <div style={{fontSize:10,color:c.sub,marginTop:1}}>Вернуться к классическому интерфейсу</div>
                  </div>
                </motion.button>
              )}
              <motion.button whileTap={{scale:0.96}} onClick={()=>{onClose();onLogout();}}
                style={{width:'100%',display:'flex',alignItems:'center',gap:14,
                  padding:'10px 20px',background:'none',border:'none',cursor:'pointer',textAlign:'left'}}>
                <span style={{fontSize:20}}>🚪</span>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:c.red}}>Выйти</div>
                  <div style={{fontSize:10,color:c.sub,marginTop:1}}>Выход из аккаунта</div>
                </div>
              </motion.button>
            </div>

            {/* Цветная полоска */}
            <div style={{height:4,background:'linear-gradient(90deg,rgba(180,180,255,0.5),transparent)'}}/>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    {/* ── Модал: Рингтон ── */}
    <AnimatePresence>
      {open&&modal==='ringtone'&&(
        <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}}
          transition={{type:'spring',stiffness:340,damping:32}}
          style={{...modalStyle,zIndex:610}}>
          {mHead('Мелодия звонка',()=>setModal(null))}
          <div style={{flex:1,overflowY:'auto',padding:'20px 16px'}}>
            <div style={{fontSize:12,color:c.sub,marginBottom:16,lineHeight:1.5}}>
              Выберите мелодию входящего звонка. Синтезированные мелодии не требуют файлов — звук формируется устройством.
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {RINGTONE_OPTIONS.map(r=>(
                <motion.button key={r.id} whileTap={{scale:0.97}} onClick={()=>{onRingtoneChange?.(r.id);}}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:14,
                    border:`1.5px solid ${ringtoneId===r.id?c.mid:c.border}`,
                    background:ringtoneId===r.id?`rgba(160,160,200,0.13)`:'transparent',cursor:'pointer',textAlign:'left'}}>
                  <span style={{fontSize:22,flexShrink:0}}>{r.emoji}</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:ringtoneId===r.id?800:600,color:ringtoneId===r.id?c.light:c.mid}}>{r.name}</div>
                    <div style={{fontSize:10,color:c.sub,marginTop:2}}>
                      {r.id==='custom'?'Файл: /custom-ringtone.mp3':'Синтезированная мелодия'}
                    </div>
                  </div>
                  {ringtoneId===r.id&&<span style={{fontSize:18,color:c.mid}}>✓</span>}
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* ── Модал: Язык ── */}
    <AnimatePresence>
      {open&&modal==='language'&&(
        <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}}
          transition={{type:'spring',stiffness:340,damping:32}}
          style={{...modalStyle,zIndex:610}}>
          {mHead('Язык интерфейса',()=>{setModal(null);setLangSearch('');})}
          {/* Поиск */}
          <div style={{padding:'10px 16px',background:isDark?'rgba(10,10,22,0.98)':'rgba(248,248,252,0.98)',
            position:'sticky',top:66,zIndex:1,backdropFilter:'blur(16px)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,background:c.cardAlt,
              border:`1px solid ${c.borderB}`,borderRadius:12,padding:'0 12px'}}>
              <span style={{fontSize:16,opacity:0.5}}>🔍</span>
              <input autoFocus value={langSearch} onChange={e=>setLangSearch(e.target.value)}
                placeholder="Поиск / Search / 搜索..."
                style={{flex:1,background:'transparent',border:'none',outline:'none',
                  color:c.light,fontSize:14,padding:'11px 0',fontFamily:'inherit'}}/>
              {langSearch&&<button onClick={()=>setLangSearch('')}
                style={{background:'none',border:'none',color:c.sub,fontSize:18,cursor:'pointer',padding:'0 4px'}}>×</button>}
            </div>
          </div>
          {/* Список */}
          <div style={{flex:1,overflowY:'auto'}}>
            {filteredLangs.length===0
              ?<div style={{textAlign:'center',padding:40,color:c.sub,fontSize:14}}>Ничего не найдено</div>
              :filteredLangs.map(lang=>(
                <motion.div key={lang.code} whileTap={{backgroundColor:isDark?'rgba(160,160,200,0.1)':'rgba(0,0,0,0.05)'}}
                  onClick={()=>pickLang(lang.code)}
                  style={{display:'flex',alignItems:'center',gap:14,padding:'12px 18px',cursor:'pointer',
                    borderBottom:`1px solid ${c.border}`,
                    background:curLang===lang.code?`rgba(160,160,200,0.1)`:'transparent',transition:'background 0.15s'}}>
                  <span style={{fontSize:28,flexShrink:0,lineHeight:1}}>{lang.flag}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{color:c.light,fontWeight:700,fontSize:15}}>{lang.native}</div>
                    <div style={{color:c.sub,fontSize:12,marginTop:1}}>{lang.name}</div>
                  </div>
                  {curLang===lang.code&&<span style={{color:c.mid,fontSize:18,fontWeight:900}}>✓</span>}
                </motion.div>
              ))
            }
          </div>
          <div style={{padding:'12px 16px calc(16px + env(safe-area-inset-bottom,0px))',borderTop:`1px solid ${c.border}`}}>
            <motion.button whileTap={{scale:0.97}} onClick={()=>{setModal(null);setLangSearch('');}}
              style={{width:'100%',padding:'13px',background:c.cardAlt,border:`1px solid ${c.borderB}`,
                borderRadius:14,color:c.mid,fontWeight:700,fontSize:14,cursor:'pointer'}}>Закрыть</motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* ── Модал: Приватность ── */}
    <AnimatePresence>
      {open&&modal==='privacy'&&(
        <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}}
          transition={{type:'spring',stiffness:340,damping:32}}
          style={{...modalStyle,zIndex:610}}>
          {mHead('Приватность',()=>setModal(null))}
          <div style={{flex:1,overflowY:'auto',padding:'20px 16px'}}>
            <PrivSelect label="Кто видит мой профиль" value={privWho} onChange={setPrivWho}/>
            <PrivSelect label="Кто видит мой номер телефона" value={privPhone} onChange={setPrivPhone}/>
            <div style={{marginTop:8}}>
              <Toggle label="Показывать меня в поиске" sub="Другие пользователи смогут найти ваш профиль по имени и нику" value={privSearch} onChange={setPrivSearch}/>
              <Toggle label="Показывать статус «онлайн»" sub="Другие видят, когда вы были активны" value={privOnline} onChange={setPrivOnline}/>
            </div>
            <div style={{marginTop:20,padding:'14px',background:c.cardAlt,borderRadius:14,border:`1px solid ${c.border}`}}>
              <div style={{fontSize:11,fontWeight:700,color:c.sub,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:6}}>Управление данными</div>
              <motion.button whileTap={{scale:0.96}}
                onClick={()=>{if(confirm('Удалить все данные профиля? Это действие необратимо.')){}}}
                style={{width:'100%',padding:'11px',borderRadius:12,background:'rgba(239,68,68,0.07)',
                  border:'1.5px solid rgba(239,68,68,0.2)',color:'#f87171',fontWeight:700,fontSize:13,cursor:'pointer',marginBottom:8}}>
                🗑️ Запросить удаление данных
              </motion.button>
              <motion.button whileTap={{scale:0.96}}
                onClick={()=>{alert('Запрос на скачивание данных отправлен. Ожидайте письмо на вашем email.');}}
                style={{width:'100%',padding:'11px',borderRadius:12,background:c.cardAlt,
                  border:`1px solid ${c.borderB}`,color:c.mid,fontWeight:700,fontSize:13,cursor:'pointer'}}>
                📥 Скачать мои данные
              </motion.button>
            </div>
            <div style={{marginTop:12,fontSize:11,color:c.sub,lineHeight:1.6,textAlign:'center'}}>
              Настройки соответствуют требованиям 152-ФЗ «О персональных данных».<br/>
              Роскомнадзор: <a href="https://rkn.gov.ru" target="_blank" rel="noreferrer" style={{color:c.mid}}>rkn.gov.ru</a>
            </div>
            <div style={{height:32}}/>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* ── Модал: Документы ── */}
    <AnimatePresence>
      {open&&modal==='docs'&&(
        <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}}
          transition={{type:'spring',stiffness:340,damping:32}}
          style={{...modalStyle,zIndex:610}}>
          {mHead('Правовые документы',()=>setModal(null))}
          <div style={{padding:'12px 16px',borderBottom:`1px solid ${c.border}`,display:'flex',gap:6,flexWrap:'wrap'}}>
            {([
              {k:'privacy',lbl:'Конфиденциальность'},
              {k:'terms',lbl:'Соглашение'},
              {k:'pd',lbl:'152-ФЗ / ПД'},
              {k:'cookies',lbl:'Cookies'},
            ] as const).map(({k,lbl})=>(
              <motion.button key={k} whileTap={{scale:0.96}} onClick={()=>setDocType(k)}
                style={{padding:'7px 14px',borderRadius:99,
                  background:docType===k?c.mid:'transparent',
                  border:`1.5px solid ${docType===k?c.mid:c.borderB}`,
                  color:docType===k?'#000':c.mid,fontWeight:700,fontSize:11,cursor:'pointer',letterSpacing:'0.02em'}}>
                {lbl}
              </motion.button>
            ))}
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'20px 16px'}}>
            <DocText type={docType}/>
            <div style={{height:32}}/>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* ── Модал: О приложении ── */}
    <AnimatePresence>
      {open&&modal==='about'&&(
        <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}}
          transition={{type:'spring',stiffness:340,damping:32}}
          style={{...modalStyle,zIndex:610}}>
          {mHead('О приложении',()=>setModal(null))}
          <div style={{flex:1,overflowY:'auto'}}>
            {/* Логотип */}
            <div style={{padding:'32px 20px 20px',textAlign:'center',borderBottom:`1px solid ${c.border}`}}>
              <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',
                width:80,height:80,borderRadius:20,
                background:'linear-gradient(135deg,#e0e0f0 0%,#f8f8ff 40%,#c8c8dc 100%)',
                boxShadow:'0 8px 32px rgba(0,0,0,0.25)',marginBottom:14}}>
                <span style={{fontSize:12,fontWeight:900,letterSpacing:'0.18em',color:'#1a1a2a'}}>SWAIP</span>
              </div>
              <div style={{fontSize:22,fontWeight:900,color:c.light,letterSpacing:'0.05em',marginBottom:4}}>SWAIP</div>
              <div style={{fontSize:13,color:c.sub,marginBottom:8}}>Социальная сеть с четырьмя жизнями</div>
              <div style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 14px',
                borderRadius:99,background:c.cardAlt,border:`1px solid ${c.borderB}`}}>
                <span style={{fontSize:11,color:c.sub}}>Версия</span>
                <span style={{fontSize:12,fontWeight:800,color:c.mid}}>2.0</span>
              </div>
            </div>
            <div style={{padding:'20px 16px',display:'flex',flexDirection:'column',gap:1}}>
              {/* О продукте */}
              <div style={{background:c.card,borderRadius:14,overflow:'hidden',border:`1px solid ${c.border}`,marginBottom:16}}>
                <div style={{padding:'14px 16px',borderBottom:`1px solid ${c.border}`}}>
                  <div style={{fontSize:11,fontWeight:700,color:c.sub,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:10}}>О продукте</div>
                  <p style={{fontSize:13,color:c.mid,lineHeight:1.7,margin:0}}>
                    SWAIP — российская социальная сеть нового поколения, объединяющая четыре ключевых аспекта жизни: профессиональный (ПРО), публичный (ПОТОК), приватный (КОМПАС) и корпоративный (КОНФЕРЕНЦИИ).
                  </p>
                </div>
                <div style={{padding:'14px 16px'}}>
                  <p style={{fontSize:13,color:c.mid,lineHeight:1.7,margin:0}}>
                    Приложение создано для тех, кто ценит приватность, профессионализм и удобство. Мы не продаём ваши данные и работаем исключительно на серверах в России.
                  </p>
                </div>
              </div>
              {/* Разработчик */}
              <div style={{background:c.card,borderRadius:14,overflow:'hidden',border:`1px solid ${c.border}`,marginBottom:16}}>
                <div style={{padding:'14px 16px',borderBottom:`1px solid ${c.border}`}}>
                  <div style={{fontSize:11,fontWeight:700,color:c.sub,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:10}}>Разработчик</div>
                  {[
                    {icon:'🏢',label:'Компания',value:'ООО «СВАЙП»'},
                    {icon:'🇷🇺',label:'Страна',value:'Российская Федерация'},
                    {icon:'📧',label:'Поддержка',value:'support@swaip.ru'},
                    {icon:'⚖️',label:'По правовым вопросам',value:'legal@swaip.ru'},
                    {icon:'🔒',label:'Персональные данные',value:'privacy@swaip.ru'},
                  ].map(row=>(
                    <div key={row.label} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'8px 0',borderBottom:`1px solid ${c.border}`}}>
                      <span style={{fontSize:16,flexShrink:0,lineHeight:1.5}}>{row.icon}</span>
                      <div style={{flex:1}}>
                        <div style={{fontSize:10,color:c.sub,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.04em'}}>{row.label}</div>
                        <div style={{fontSize:13,color:c.mid,marginTop:1}}>{row.value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Стек и соответствие */}
              <div style={{background:c.card,borderRadius:14,overflow:'hidden',border:`1px solid ${c.border}`,marginBottom:16}}>
                <div style={{padding:'14px 16px'}}>
                  <div style={{fontSize:11,fontWeight:700,color:c.sub,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:10}}>Соответствие</div>
                  {[
                    {badge:'152-ФЗ',text:'Обработка персональных данных на серверах РФ'},
                    {badge:'PWA',text:'Прогрессивное веб-приложение — работает офлайн'},
                    {badge:'E2E',text:'Сессионные ключи генерируются на устройстве'},
                    {badge:'РКН',text:'Включён в реестр операторов персональных данных'},
                  ].map(row=>(
                    <div key={row.badge} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:`1px solid ${c.border}`}}>
                      <div style={{padding:'2px 8px',borderRadius:6,background:c.cardAlt,border:`1px solid ${c.borderB}`,
                        fontSize:10,fontWeight:900,color:c.mid,flexShrink:0,letterSpacing:'0.05em'}}>{row.badge}</div>
                      <div style={{fontSize:12,color:c.mid}}>{row.text}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Ссылки на документы */}
              <div style={{background:c.card,borderRadius:14,overflow:'hidden',border:`1px solid ${c.border}`,marginBottom:16}}>
                <div style={{padding:'14px 16px'}}>
                  <div style={{fontSize:11,fontWeight:700,color:c.sub,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:10}}>Документы</div>
                  {([
                    {k:'privacy' as const,lbl:'Политика конфиденциальности'},
                    {k:'terms' as const,lbl:'Пользовательское соглашение'},
                    {k:'pd' as const,lbl:'Согласие на обработку ПД (152-ФЗ)'},
                    {k:'cookies' as const,lbl:'Политика Cookie'},
                  ]).map(({k,lbl})=>(
                    <motion.button key={k} whileTap={{scale:0.97}} onClick={()=>{setModal('docs');setDocType(k);}}
                      style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',
                        padding:'10px 0',border:'none',background:'none',cursor:'pointer',
                        borderBottom:`1px solid ${c.border}`,textAlign:'left'}}>
                      <span style={{fontSize:13,color:c.mid,fontWeight:600}}>{lbl}</span>
                      <span style={{color:c.sub,fontSize:14}}>›</span>
                    </motion.button>
                  ))}
                </div>
              </div>
              <div style={{textAlign:'center',padding:'8px 0 16px',color:c.sub,fontSize:11,lineHeight:1.6}}>
                © {new Date().getFullYear()} ООО «СВАЙП»<br/>Все права защищены
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}

/* ══ Bottom Sheet виджета (полный экран) ══ */
function Sheet({open,onClose,title,c,children}:{open:boolean;onClose:()=>void;title:string;c:Pal;children:React.ReactNode}){
  return(
    <AnimatePresence>
      {open&&(
        <>
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={onClose}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.65)',zIndex:300}}/>
          <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
            transition={{type:'spring',damping:30,stiffness:300}}
            style={{position:'fixed',bottom:0,left:0,right:0,height:'88dvh',
              background:c.card,borderRadius:'20px 20px 0 0',
              border:`1px solid ${c.borderB}`,zIndex:301,
              display:'flex',flexDirection:'column',overflow:'hidden'}}>
            <div style={{display:'flex',justifyContent:'center',padding:'10px 0 4px',flexShrink:0}}>
              <div style={{width:40,height:4,borderRadius:2,background:c.borderB}}/>
            </div>
            <div style={{display:'flex',alignItems:'center',padding:'4px 16px 12px',borderBottom:`1px solid ${c.border}`,flexShrink:0}}>
              <div style={{flex:1,fontSize:16,fontWeight:900,color:c.light}}>{title}</div>
              <button onClick={onClose} style={{background:'none',border:'none',color:c.sub,fontSize:20,cursor:'pointer'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'12px 16px 32px'}}>{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

/* ══ Типы ══ */
interface SwaipHomeProps{userHash:string;apiBase:string;sessionToken?:string;onLogout:()=>void;onOldMode?:()=>void;}
interface DocAtt{url:string;name:string;size:number;mime:string;}
interface BookingSlot{time:string;booked:boolean;}
interface PollOption{id:string;text:string;votes:number;}
interface Poll{question:string;options:PollOption[];totalVotes:number;}
interface QuoteSnap{id:string;authorName:string;authorAvatar:string;text:string;ts:string;}
interface Post{id:string;text:string;img?:string;videoUrl?:string;audioUrl?:string;docUrls?:DocAtt[];likes:number;liked:boolean;comments:number;ts:string;hasBooking?:boolean;bookingSlots?:BookingSlot[];bookingLabel?:string;poll?:Poll;myVote?:string|null;quoteOf?:QuoteSnap;repostOf?:QuoteSnap;coAuthorData?:{hash:string;name:string;avatar:string};isAnonVoting?:boolean;publishAt?:string;expiresAt?:string;location?:{city:string;lat:number;lng:number};bgMusicUrl?:string;bgMusicLabel?:string;}
type Track={id:string;title:string;artist:string;url:string;cover?:string;duration?:number};
const SWAIP_PLAYLIST_KEY='swaip_playlist_v2';
function loadPlaylist():Track[]{try{const all:Track[]=JSON.parse(localStorage.getItem(SWAIP_PLAYLIST_KEY)||'[]');/* blob: URL действительны только в текущей сессии браузера — фильтруем их при загрузке */return all.filter(t=>t.url&&!t.url.startsWith('blob:'));}catch{return[];}}
function savePlaylist(t:Track[]){try{localStorage.setItem(SWAIP_PLAYLIST_KEY,JSON.stringify(t));}catch{}}
let _globalAudio:HTMLAudioElement|null=null;
function getGlobalAudio():HTMLAudioElement{if(!_globalAudio){_globalAudio=new Audio();_globalAudio.preload='metadata';}return _globalAudio;}
interface ClassicWork{id:string;imageUrl:string;title:string;desc:string;}
interface ClassicReview{id:string;imageUrl:string;caption?:string;date:string;}
interface PriceItem{id:string;name:string;price:string;desc:string;photo:string;unit:string;slots:string[];}
interface BookingRecord{id:string;itemId:string;itemName:string;slot:string;clientName:string;clientPhone:string;createdAt:string;}
interface ClassicCert{id:string;imageUrl:string;title:string;}
interface ClassicFaq{id:string;q:string;a:string;}
interface ClassicCase{id:string;imageUrl:string;title:string;desc:string;result:string;}
interface ClassicLink{id:string;label:string;url:string;icon:string;}

/* ═══ ХЕЛПЕРЫ АЛИНЫ ═══ */
function formatSlotRu(slot:string):string{
  const d=new Date(slot.replace(' ','T'));
  const inDay=['в воскресенье','в понедельник','во вторник','в среду','в четверг','в пятницу','в субботу'];
  const months=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const time=(slot.split(' ')[1]||'').substring(0,5);
  return `${inDay[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} в ${time}`;
}
function getTimeOfDay():string{
  const h=new Date().getHours();
  if(h>=5&&h<12)return'Доброе утро';
  if(h>=12&&h<17)return'Добрый день';
  if(h>=17)return'Добрый вечер';
  return'Доброй ночи';
}
const GREEN_SLOT_GREETINGS:((t:string,a:string)=>string)[]=[
  (t,a)=>`${t}! Это ${a} 😊 У нас есть свободные окошки — давайте выберем удобное время. Как вас зовут?`,
  (t,a)=>`Привет! Я ${a} 🌸 Вижу, вы хотите записаться — отлично! Скажите ваше имя, начнём.`,
  (t,a)=>`${t}! ${a} на связи ✨ Есть несколько свободных слотов, подберём лучший для вас. Как вас зовут?`,
  (t,a)=>`Здравствуйте! Меня зовут ${a} 🙂 Помогу выбрать время быстро. Как к вам обращаться?`,
  (t,a)=>`${t}! Я ${a} — рада помочь с записью 💙 Есть свободное время, посмотрим вместе. Как вас зовут?`,
  (t,a)=>`Добро пожаловать! ${a} здесь 🌟 Несколько слотов ещё свободны. Напишите ваше имя — и подберём!`,
];
type _BotTpl={gr(t:string,a:string):string;an(n:string):string;ap(n:string,ph:string,w:string,s:string):string;ac(n:string,w:string,s:string):string;};
const BOT_SCRIPTS:_BotTpl[]=[
  {gr:(t,a)=>`${t}! Это ${a} 😊 Рада помочь с записью. Как вас зовут?`,an:n=>`${n}, привет! Оставьте номер — пришлю напоминание.`,ap:(n,ph,w,s)=>`${n}, всё верно: ${ph}${s?`, «${s}»`:''}${w?` ${w}`:''}. Подтверждаем?`,ac:(n,w,s)=>`${n}, 🎉 Записала!${s?` «${s}»`:''}${w?` Ждём вас ${w}.`:''}`,},
  {gr:(t,a)=>`${t}! Я ${a} 🌸 За минуту запишем вас. Как вас зовут?`,an:n=>`${n}, приятно! Напишите номер телефона 📱`,ap:(n,ph,w,s)=>`${n}, записала: ${ph}${s?`, «${s}»`:''}${w?` ${w}`:''}. Всё правильно?`,ac:(n,w,s)=>`${n}, 💫 Готово!${s?` «${s}»`:''}${w?` До встречи ${w}!`:' До встречи!'}`,},
  {gr:(t,a)=>`Привет! Меня зовут ${a} ✨ Давайте запишем вас. Как к вам обращаться?`,an:n=>`${n}, здорово! Нужен номер для напоминания — только это!`,ap:(n,ph,w,s)=>`${n}, вижу всё: ${ph}${s?`, «${s}»`:''}${w?` ${w}`:''}. Сохраняю?`,ac:(n,w,s)=>`${n}, всё! 💙${s?` «${s}»`:''}${w?` Ждём вас ${w}.`:' Ждём!'}`,},
  {gr:(t,a)=>`Добро пожаловать! ${a} здесь 🌟 Как вас зовут?`,an:n=>`${n}, рада познакомиться! Оставьте телефон — напомню заранее.`,ap:(n,ph,w,s)=>`${n}, отлично: ${ph}${s?`, «${s}»`:''}${w?` ${w}`:''}. Подтверждаете?`,ac:(n,w,s)=>`${n}, 🙏 Записала!${s?` «${s}»`:''}${w?` Ждём вас ${w}.`:'.'}`,},
  {gr:(t,a)=>`${t}! ${a} на связи 😊 Как вас зовут? Хочу обращаться по имени.`,an:n=>`${n}, приятно! Напишите номер телефона — никакого спама!`,ap:(n,ph,w,s)=>`${n}, принято: ${ph}${s?`, «${s}»`:''}${w?` ${w}`:''}. Всё верно?`,ac:(n,w,s)=>`${n}, 💫 Записала! Жду вас${s?` на «${s}»`:''}${w?` ${w}.`:'.'}`,},
];

const STORIES=[
  {id:'me',name:'Добавить',seed:'me',new:false},
  {id:'s1',name:'Ника',seed:'nika',new:true},
  {id:'s2',name:'Алекс',seed:'alex',new:true},
  {id:'s3',name:'Маша',seed:'masha',new:false},
  {id:'s4',name:'Юля',seed:'yulya',new:true},
  {id:'s5',name:'Артём',seed:'artem',new:false},
];

const INIT_POSTS:Post[]=[
  {id:'p1',text:'Сегодня выступал на конференции — зал был полный. Это то, ради чего я работаю 🔥',likes:47,liked:false,comments:12,ts:'2 ч назад'},
  {id:'p2',text:'Новый трек почти готов. Запись идёт в студии уже третий день подряд.',img:'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=600&q=80',likes:93,liked:true,comments:31,ts:'5 ч назад'},
  {id:'p3',text:'Настоящий нетворкинг — это не обмен визитками, а совместно созданный смысл.',likes:28,liked:false,comments:7,ts:'вчера'},
];

function av(seed:string,s=80){return `https://api.dicebear.com/7.x/thumbs/svg?seed=${encodeURIComponent(seed)}&size=${s}`;}

/* ══ История ══ */
function Story({s,isMe,c}:{s:typeof STORIES[0];isMe?:boolean;c:Pal}){
  return(
    <div style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:4}}>
      <div style={{width:60,height:68,borderRadius:12,overflow:'hidden',position:'relative',flexShrink:0,
        outline:s.new?`2.5px solid rgba(180,180,255,0.8)`:`2px solid ${c.border}`,outlineOffset:1,background:c.card}}>
        <img src={av(s.seed)} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
        {/* Хром-полоска SWAIP с чёрными читаемыми буквами */}
        <div style={{position:'absolute',bottom:0,left:0,right:0,height:16,
          background:'linear-gradient(90deg,#8a8a9a 0%,#c8c8d8 20%,#f0f0f8 50%,#c8c8d8 80%,#8a8a9a 100%)',
          display:'flex',alignItems:'center',justifyContent:'center',
          boxShadow:'0 -1px 4px rgba(0,0,0,0.4)'}}>
          <span style={{fontSize:6.5,fontWeight:900,letterSpacing:'0.22em',textTransform:'uppercase',
            color:'#1a1a2a',textShadow:'0 0 4px rgba(255,255,255,0.6)',userSelect:'none'}}>SWAIP</span>
        </div>
        {isMe&&<div style={{position:'absolute',bottom:18,right:4,width:14,height:14,
          borderRadius:'50%',background:c.mid,border:`1.5px solid ${c.light}`,
          display:'flex',alignItems:'center',justifyContent:'center',
          fontSize:9,fontWeight:900,lineHeight:1,color:'#000'}}>+</div>}
      </div>
      <span style={{fontSize:9,color:c.sub,fontWeight:600,maxWidth:60,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',lineHeight:1}}>{s.name}</span>
    </div>
  );
}

/* ══ Виджет-квадрат ══ */
function WidgetSquare({icon,label,count,c,onClick,previewUrl,onPreviewChange,onLabelSave}:{
  icon:string;label:string;count?:number;c:Pal;onClick:()=>void;
  previewUrl?:string;onPreviewChange?:()=>void;onLabelSave?:(v:string)=>void;
}){
  const [editing,setEditing]=useState(false);
  const [draft,setDraft]=useState(label);
  const inputRef=useRef<HTMLInputElement>(null);
  const startEdit=(e:React.MouseEvent)=>{
    e.stopPropagation();setDraft(label);setEditing(true);
    setTimeout(()=>{inputRef.current?.focus();inputRef.current?.select();},40);
  };
  const saveEdit=()=>{
    setEditing(false);const v=draft.trim();
    if(v&&v!==label)onLabelSave?.(v);
  };
  return(
    <div style={{flexShrink:0,width:80,height:90,borderRadius:14,
      background:previewUrl?'transparent':c.card,
      border:`1px solid ${c.borderB}`,
      position:'relative',overflow:'hidden',cursor:editing?'default':'pointer',
      boxShadow:`0 2px 8px rgba(0,0,0,${c===DARK?'0.3':'0.08'})`}}
      onClick={editing?undefined:onClick}>
      {previewUrl
        ?<img src={previewUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
        :<div style={{width:'100%',height:'100%',display:'flex',flexDirection:'column',
            alignItems:'center',justifyContent:'center'}}>
          <span style={{fontSize:22}}>{icon}</span>
        </div>
      }
      <div style={{position:'absolute',bottom:0,left:0,right:0,
        background:'linear-gradient(to top,rgba(0,0,0,0.78) 0%,transparent 100%)',
        padding:'14px 4px 5px',textAlign:'center'}}>
        {editing?(
          <input ref={inputRef} value={draft}
            onChange={e=>setDraft(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={e=>{if(e.key==='Enter')saveEdit();if(e.key==='Escape')setEditing(false);}}
            onClick={e=>e.stopPropagation()}
            style={{background:'rgba(0,0,0,0.5)',border:'1px solid rgba(255,255,255,0.4)',borderRadius:4,
              color:'#fff',fontSize:8,fontWeight:700,padding:'2px 4px',width:'calc(100% - 4px)',
              outline:'none',boxSizing:'border-box',textAlign:'center',fontFamily:'inherit'}}
          />
        ):(
          <div style={{fontSize:7.5,fontWeight:800,textTransform:'uppercase',
            letterSpacing:'0.03em',lineHeight:1.1,color:'#fff'}}>{label}</div>
        )}
        {count!==undefined&&count>0&&!editing&&(
          <div style={{fontSize:7,color:'rgba(255,255,255,0.55)',marginTop:1,fontWeight:700}}>{count}</div>
        )}
      </div>
      {onPreviewChange&&!editing&&(
        <button onClick={e=>{e.stopPropagation();onPreviewChange();}}
          style={{position:'absolute',top:3,right:3,width:18,height:18,borderRadius:'50%',
            background:'rgba(0,0,0,0.6)',border:'1px solid rgba(255,255,255,0.2)',
            fontSize:8,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>
          🖼
        </button>
      )}
      {onLabelSave&&!editing&&(
        <button onClick={startEdit}
          style={{position:'absolute',top:3,right:onPreviewChange?24:3,width:18,height:18,borderRadius:'50%',
            background:'rgba(0,0,0,0.6)',border:'1px solid rgba(255,255,255,0.2)',
            fontSize:9,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>
          ✏️
        </button>
      )}
    </div>
  );
}

/* ══ Карточка поста ══ */
const POST_CARD_STYLE_META=[
  {id:1,name:'Классика',emoji:'🔲',desc:'Округлые кнопки'},
  {id:2,name:'Синема',emoji:'🎬',desc:'Полный кадр'},
  {id:3,name:'Газета',emoji:'📰',desc:'Акцентная полоса'},
  {id:4,name:'Неон',emoji:'🟣',desc:'Тёмный + свечение'},
  {id:5,name:'Чат',emoji:'💬',desc:'Пузырь сообщения'},
  {id:6,name:'Компакт',emoji:'▦',desc:'Горизонталь'},
];

/* ════════════════════════════════════════════════
   DocViewerModal — внутренний просмотрщик всех типов документов
   Без внешних сервисов (Яндекс, Google, Microsoft).
════════════════════════════════════════════════ */
function DocViewerModal({doc,onClose,c}:{doc:{url:string;name:string;mime:string};onClose:()=>void;c:Pal}){
  const ext=(doc.name.split('.').pop()||'').toLowerCase();
  const absUrl=doc.url.startsWith('http')||doc.url.startsWith('blob')?doc.url:`${window.location.origin}${doc.url}`;
  const [status,setStatus]=useState<'loading'|'ok'|'error'>('loading');
  const [html,setHtml]=useState('');
  const [table,setTable]=useState<string[][]>([]);
  const [text,setText]=useState('');
  const pdfRef=useRef<HTMLDivElement>(null);

  const loadScript=(src:string,globalKey:string)=>new Promise<void>((res,rej)=>{
    if((window as any)[globalKey]){res();return;}
    const s=document.createElement('script');s.src=src;s.onload=()=>res();s.onerror=rej;document.head.appendChild(s);
  });

  useEffect(()=>{
    let cancelled=false;
    setStatus('loading');setHtml('');setTable([]);setText('');
    if(pdfRef.current)pdfRef.current.innerHTML='';
    (async()=>{
      try{
        /* ── PDF ── */
        if(ext==='pdf'){
          const buf=await fetch(absUrl,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`${r.status}`);return r.arrayBuffer();});
          if(cancelled)return;
          const pdfjs=await import('pdfjs-dist');
          pdfjs.GlobalWorkerOptions.workerSrc=import.meta.env.BASE_URL+'pdf.worker.min.mjs';
          const pdf=await pdfjs.getDocument({data:buf}).promise;
          if(cancelled)return;
          const container=pdfRef.current;if(!container)return;
          const vpw=container.clientWidth||window.innerWidth;
          for(let i=1;i<=pdf.numPages;i++){
            if(cancelled)return;
            const page=await pdf.getPage(i);
            const scale=(vpw*window.devicePixelRatio)/page.getViewport({scale:1}).width;
            const vp=page.getViewport({scale});
            const canvas=document.createElement('canvas');
            canvas.width=vp.width;canvas.height=vp.height;
            canvas.style.width='100%';canvas.style.height='auto';
            canvas.style.display='block';canvas.style.marginBottom='4px';canvas.style.background='#fff';
            await page.render({canvasContext:canvas.getContext('2d')!,viewport:vp,canvas}).promise;
            if(cancelled)return;
            container.appendChild(canvas);
          }
          if(!cancelled)setStatus('ok');
          return;
        }
        /* ── Word (.docx/.doc) ── */
        if(['doc','docx'].includes(ext)){
          const buf=await fetch(absUrl,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`${r.status}`);return r.arrayBuffer();});
          if(cancelled)return;
          await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js','mammoth');
          const res=await (window as any).mammoth.convertToHtml({arrayBuffer:buf});
          if(!cancelled){setHtml(res.value||'<p>—</p>');setStatus('ok');}
          return;
        }
        /* ── Excel (.xlsx/.xls) / CSV ── */
        if(['xls','xlsx','csv'].includes(ext)){
          await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js','XLSX');
          const buf=await fetch(absUrl,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`${r.status}`);return r.arrayBuffer();});
          if(cancelled)return;
          const X=(window as any).XLSX;
          const wb=X.read(buf,{type:'array'});
          const ws=wb.Sheets[wb.SheetNames[0]];
          const data:string[][]=X.utils.sheet_to_json(ws,{header:1,defval:''});
          if(!cancelled){setTable(data);setStatus('ok');}
          return;
        }
        /* ── Текстовые: txt, md, json, xml, html, csv, js, ts, css и т.д. ── */
        if(['txt','md','markdown','json','xml','html','htm','csv','log','yaml','yml','ini','cfg','js','ts','css','py','sh','bash','rtf'].includes(ext)||doc.mime.startsWith('text/')){
          const raw=await fetch(absUrl,{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`${r.status}`);return r.text();});
          if(!cancelled){setText(raw);setStatus('ok');}
          return;
        }
        /* ── PPT/PPTX и всё остальное — только скачивание ── */
        if(!cancelled)setStatus('error');
      }catch{if(!cancelled)setStatus('error');}
    })();
    return()=>{cancelled=true;};
  },[absUrl,ext]);

  const download=async()=>{
    try{
      const buf=await fetch(absUrl,{cache:'no-store'}).then(r=>r.arrayBuffer());
      const blob=new Blob([buf]);const a=document.createElement('a');
      a.href=URL.createObjectURL(blob);a.download=doc.name;
      document.body.appendChild(a);a.click();document.body.removeChild(a);
    }catch{}
  };

  const isPptx=['ppt','pptx'].includes(ext);
  const ico=ext==='pdf'?'📕':['doc','docx'].includes(ext)?'📘':['xls','xlsx','csv'].includes(ext)?'📗':['ppt','pptx'].includes(ext)?'📙':['txt','md'].includes(ext)?'📄':'📎';

  return(
    <div style={{position:'fixed',inset:0,zIndex:9999,background:'rgba(0,0,0,0.96)',display:'flex',flexDirection:'column',overflowY:'hidden'}}>
      {/* Шапка */}
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',background:'rgba(255,255,255,0.04)',borderBottom:'1px solid rgba(255,255,255,0.08)',flexShrink:0}}>
        <span style={{fontSize:24,flexShrink:0}}>{ico}</span>
        <span style={{flex:1,fontSize:13,fontWeight:700,color:'#e2e2e8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{doc.name}</span>
        <button onClick={download} style={{background:'rgba(59,130,246,0.15)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:20,padding:'6px 14px',color:'#60a5fa',fontSize:12,fontWeight:700,cursor:'pointer',flexShrink:0}}>⬇ Скачать</button>
        <button onClick={onClose} style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.15)',color:'#fff',fontSize:18,cursor:'pointer',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
      </div>
      {/* Контент */}
      <div style={{flex:1,overflow:'hidden',display:'flex',flexDirection:'column',position:'relative'}}>
        {status==='loading'&&(
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12,color:'rgba(255,255,255,0.5)'}}>
            <div style={{width:40,height:40,borderRadius:'50%',border:'3px solid rgba(167,139,250,0.2)',borderTop:'3px solid #a78bfa',animation:'spin 1s linear infinite'}}/>
            <span style={{fontSize:13}}>Загрузка документа…</span>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
        {status==='error'&&(
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,color:'rgba(255,255,255,0.5)',padding:32}}>
            <span style={{fontSize:52}}>{isPptx?'📽':'📎'}</span>
            <span style={{fontSize:14,textAlign:'center'}}>{isPptx?'PowerPoint не поддерживает предварительный просмотр.\nСкачайте файл чтобы открыть его.':'Не удалось открыть файл'}</span>
            <button onClick={download} style={{padding:'12px 32px',borderRadius:50,border:'none',background:'rgba(59,130,246,0.2)',color:'#60a5fa',fontWeight:700,fontSize:14,cursor:'pointer'}}>⬇ Скачать файл</button>
          </div>
        )}
        {/* PDF */}
        {ext==='pdf'&&<div ref={pdfRef} style={{flex:1,overflowY:'auto',padding:'0 2px',WebkitOverflowScrolling:'touch'}}/>}
        {/* Word HTML */}
        {status==='ok'&&['doc','docx'].includes(ext)&&(
          <div style={{flex:1,overflowY:'auto',background:'#fff',padding:'24px 32px',color:'#111',fontSize:14,lineHeight:1.8}} dangerouslySetInnerHTML={{__html:html}}/>
        )}
        {/* Excel/CSV таблица */}
        {status==='ok'&&['xls','xlsx','csv'].includes(ext)&&(
          <div style={{flex:1,overflowY:'auto',overflowX:'auto',padding:8}}>
            <table style={{borderCollapse:'collapse',fontSize:12,minWidth:'100%'}}>
              <tbody>
                {table.map((row,ri)=>(
                  <tr key={ri} style={{background:ri===0?'rgba(59,130,246,0.12)':ri%2===0?'transparent':'rgba(255,255,255,0.03)'}}>
                    {row.map((cell,ci)=>ri===0
                      ?<th key={ci} style={{padding:'8px 10px',color:'#93c5fd',textAlign:'left',fontWeight:700,whiteSpace:'nowrap',border:'1px solid rgba(255,255,255,0.1)'}}>{String(cell)}</th>
                      :<td key={ci} style={{padding:'7px 10px',color:'rgba(255,255,255,0.85)',border:'1px solid rgba(255,255,255,0.06)',verticalAlign:'top'}}>{String(cell)}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* Текст */}
        {status==='ok'&&['txt','md','markdown','json','xml','html','htm','csv','log','yaml','yml','ini','cfg','js','ts','css','py','sh','bash','rtf'].includes(ext)&&(
          <div style={{flex:1,overflowY:'auto',padding:16}}>
            {(['html','htm'].includes(ext))
              ?<iframe srcDoc={text} style={{width:'100%',height:'100%',border:'none',background:'#fff',flex:1,minHeight:'60vh'}} sandbox="allow-same-origin"/>
              :<pre style={{margin:0,fontSize:12,lineHeight:1.7,color:'#e2e8f0',fontFamily:'monospace',whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{text}</pre>
            }
          </div>
        )}
      </div>
    </div>
  );
}

/* ══ UserProfileSheet — полный профиль пользователя из поиска (1-в-1 как у хозяина) ══ */
function fmtTsGlobal(iso:string){const now=Date.now();const d=new Date(iso);const s=(now-d.getTime())/1000;if(s<60)return'только что';if(s<3600)return`${Math.floor(s/60)} мин назад`;if(s<86400)return`${Math.floor(s/3600)} ч назад`;if(s<604800)return`${Math.floor(s/86400)} дн назад`;return d.toLocaleDateString('ru');}
function UserProfileSheet({hash,fallback,c,accent,apiBase,onClose,onMessage,onCall,onSecretChat}:{hash:string;fallback?:{name:string;avatar:string;handle:string;bio:string};c:Pal;accent:string;apiBase:string;onClose:()=>void;onMessage:(hash:string,name:string)=>void;onCall:(hash:string,name:string)=>void;onSecretChat?:(hash:string,name:string)=>void;}){
  const ac=accent||'#60a5fa';
  const [d,setD]=useState<Record<string,any>>({});
  const [posts,setPosts]=useState<Post[]>([]);
  const [loading,setLoading]=useState(true);
  const [widgetModal,setWidgetModal]=useState<string|null>(null);
  const [commentPostId,setCommentPostId]=useState<string|null>(null);
  const [bookingItem,setBookingItem]=useState<PriceItem|null>(null);
  const [bkName,setBkName]=useState('');
  const [bkPhone,setBkPhone]=useState('');
  const [bkStatus,setBkStatus]=useState<'idle'|'sending'|'done'|'error'>('idle');
  const [bkError,setBkError]=useState('');
  const [guestTab,setGuestTab]=useState<'feed'|'widgets'>('feed');
  const [openGuestChannel,setOpenGuestChannel]=useState<any|null>(null);
  const [openGuestGroup,setOpenGuestGroup]=useState<any|null>(null);
  const submitBooking=async(item:PriceItem)=>{
    if(!bkName.trim()||!bkPhone.trim()){setBkError('Заполните имя и телефон');return;}
    setBkStatus('sending');setBkError('');
    try{
      const r=await fetch(`${apiBase}/api/booking-request`,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({targetHash:hash,clientName:bkName.trim(),clientPhone:bkPhone.trim(),service:item.name,text:`Запись на: ${item.name}. ${item.price}${item.unit?' / '+item.unit:''}`,})});
      if(r.ok){setBkStatus('done');}else{const e=await r.json().catch(()=>({}));setBkStatus('error');setBkError(e.error||'Ошибка отправки');}
    }catch{setBkStatus('error');setBkError('Нет соединения');}
  };

  /* ── Лайк — реальный API ── */
  const toggleLike=(id:string)=>{
    setPosts(prev=>prev.map(p=>p.id===id?{...p,liked:!p.liked,likes:p.liked?p.likes-1:p.likes+1}:p));
    try{fetch(`${apiBase}/api/interactions/${id}/like`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:getSessionToken()||''})}).catch(()=>{});}catch{}
  };
  const handleBook=(id:string,time?:string)=>{
    setPosts(prev=>prev.map(p=>{
      if(p.id!==id||!p.hasBooking)return p;
      if(!time||!p.bookingSlots?.length)return p;
      return {...p,bookingSlots:p.bookingSlots.map(s=>s.time===time?{...s,booked:true}:s)};
    }));
  };

  useEffect(()=>{
    setLoading(true);setD({});setPosts([]);setWidgetModal(null);setCommentPostId(null);
    Promise.all([
      fetch(`${apiBase}/api/account/${hash}`).then(r=>r.json()).catch(()=>({data:{}})),
      fetch(`${apiBase}/api/broadcasts?author=${hash}&authorMode=pro&limit=50`).then(r=>r.json()).catch(()=>[]),
    ]).then(([acct,bcast])=>{
      const raw=(acct.data||{}) as Record<string,any>;
      const jp=(v:any)=>{if(v===null||v===undefined)return v;if(typeof v==='string'){try{return JSON.parse(v);}catch{return v;}}return v;};
      const parsed:Record<string,any>={};
      for(const k of Object.keys(raw)){parsed[k]=jp(raw[k]);}
      setD(parsed);
      const bcastItems:any[]=Array.isArray(bcast)?bcast:(bcast.data||[]);
      const bcastPosts:Post[]=bcastItems.map((b:any)=>({
        id:String(b.id),text:b.content||'',img:b.imageUrl||undefined,
        videoUrl:b.videoUrl||undefined,audioUrl:b.audioUrl||undefined,
        docUrls:b.docUrls||undefined,
        likes:(b.reactions||[]).reduce((s:number,r:any)=>s+r.count,0),
        liked:(b.myReactions||[]).length>0,comments:b.commentCount||0,
        ts:b.createdAt?fmtTsGlobal(b.createdAt):'давно',
        ...(b.hasBooking?{hasBooking:true,bookingLabel:b.bookingLabel||'Записаться',bookingSlots:Array.isArray(b.bookingSlots)?b.bookingSlots:[]}:{}),
        ...(b.poll?{poll:b.poll}:{}),
        ...(b.myVote!==undefined?{myVote:b.myVote}:{}),
        ...(b.quoteOf?{quoteOf:b.quoteOf}:{}),
        ...(b.repostOf?{repostOf:b.repostOf}:{}),
      }));
      const proPosts:any[]=Array.isArray(jp(raw.pro_posts))?jp(raw.pro_posts):[];
      const localPosts:Post[]=proPosts.map((p:any,i:number)=>({
        id:p.id||`lp_${i}`,text:p.text||p.content||'',img:p.img||p.imageUrl||undefined,
        videoUrl:p.videoUrl||undefined,audioUrl:p.audioUrl||undefined,docUrls:undefined,
        likes:p.likes||0,liked:false,comments:p.comments||0,
        ts:(p.ts||p.createdAt)?fmtTsGlobal(String(p.ts||p.createdAt)):'давно',
      }));
      const bcastIds=new Set(bcastPosts.map(p=>p.id));
      setPosts([...bcastPosts,...localPosts.filter(p=>!bcastIds.has(p.id))]);
    }).catch(()=>{}).finally(()=>setLoading(false));
  },[hash,apiBase]);

  /* ── Данные профиля (из fetched d, 1-в-1 с useSaved хозяина) ── */
  const name:string=d.pro_displayName||d.pro_fullName||fallback?.name||'Пользователь';
  const profNick:string=d.sw_nick||'';
  const bio:string=d.pro_bio||fallback?.bio||'';
  const avatarSrc:string=d.pro_avatarUrl||(fallback?.avatar||av(hash.slice(0,14)||'user',100));
  const coverPhoto:string=d.pro_coverImageUrl||d.pro_coverPhotoUrl||d.pro_bgPhotoUrl||'';
  const coverPos:string=d.pro_coverPosition||'50% 50%';
  const coverGrad:string=d.pro_coverGradient||`linear-gradient(135deg,${ac}44,${ac}22,#0a0a14)`;
  const feedBg:string=d.sw_feedBg||d.pro_feedBgGradient||'';
  const position:string=d.pro_position||'';
  const company:string=d.pro_company||'';
  const website:string=d.pro_website||'';
  const contacts:any=d.pro_contacts||{};
  const pcs:number=Number(d.sw_postCardStyle||1);
  const vizitkaUrl:string=d.sw_vizitka||'';
  const works:ClassicWork[]=Array.isArray(d.classic_works)?d.classic_works:[];
  const reviews:ClassicReview[]=Array.isArray(d.classic_reviews)?d.classic_reviews:[];
  const certs:ClassicCert[]=Array.isArray(d.classic_certs)?d.classic_certs:[];
  const faqs:ClassicFaq[]=Array.isArray(d.classic_faq)?d.classic_faq:[];
  const cases:ClassicCase[]=Array.isArray(d.classic_cases)?d.classic_cases:[];
  const priceItems:PriceItem[]=Array.isArray(d.pro_priceItems)?d.pro_priceItems:[];
  const links:any[]=Array.isArray(d.classic_links)?d.classic_links:[];
  const highlights:any[]=Array.isArray(d.sw_highlights)?d.sw_highlights:[];
  const widgetLabels:Record<string,string>=d.sw_widget_labels_v2||{};
  const widgetPreviews:Record<string,string>=d.sw_widget_previews_v2||{};
  const profMood:{emoji:string;text:string}=typeof d.pro_mood==='object'&&d.pro_mood!==null?d.pro_mood:{emoji:'',text:''};
  const wLabel=(key:string,fb:string)=>widgetLabels[key]??fb;
  const wPreview=(key:string)=>widgetPreviews[key]??'';

  /* ── WIDGET_LIST идентичен хозяйскому (все виджеты, включая booking) ── */
  const WIDGET_LIST=[
    {key:'works',   icon:'🎨',label:'Работы',    count:works.length},
    {key:'reviews', icon:'⭐',label:'Отзывы',    count:reviews.length},
    {key:'booking', icon:'📅',label:'Записаться',count:priceItems.length},
    {key:'prices',  icon:'💰',label:'Прайс',     count:priceItems.length},
    {key:'certs',   icon:'📜',label:'Дипломы',   count:certs.length},
    {key:'cases',   icon:'📂',label:'Кейсы',     count:cases.length},
    {key:'faqs',    icon:'❓',label:'FAQ',        count:faqs.length},
    {key:'links',   icon:'🔗',label:'Ссылки',    count:links.length},
  ];

  /* ── Вспомогательные компоненты ── */
  const swaipAvatarCard=(w:number,h:number,r:number)=>(
    <div style={{position:'relative',flexShrink:0}}>
      {vizitkaUrl&&<div style={{position:'absolute',inset:-3,borderRadius:r+3,background:'linear-gradient(135deg,#ff6b6b,#f8a100,#ff6b6b)',zIndex:0}}/>}
      <div style={{width:w,height:h,borderRadius:r,overflow:'hidden',border:`3px solid ${c.card}`,background:c.cardAlt,position:'relative',cursor:'pointer',boxShadow:`0 4px 16px rgba(0,0,0,0.5)`,zIndex:1}}
        onClick={vizitkaUrl?()=>setWidgetModal('_vizitka'):undefined}>
        <img src={avatarSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
        <div style={{position:'absolute',bottom:0,left:0,right:0,height:16,background:'linear-gradient(90deg,#8a8a9a 0%,#c8c8d8 20%,#f0f0f8 50%,#c8c8d8 80%,#8a8a9a 100%)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 -1px 4px rgba(0,0,0,0.4)'}}>
          <span style={{fontSize:5.5,fontWeight:900,letterSpacing:'0.22em',textTransform:'uppercase',color:'#1a1a2a',userSelect:'none'}}>SWAIP</span>
        </div>
        {vizitkaUrl&&<motion.button whileTap={{scale:0.9}} onClick={e=>{e.stopPropagation();setWidgetModal('_vizitka');}} style={{position:'absolute',top:4,right:4,width:22,height:22,borderRadius:'50%',background:'rgba(0,0,0,0.7)',border:'1.5px solid rgba(255,255,255,0.5)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',zIndex:2,fontSize:10}}>▶</motion.button>}
      </div>
    </div>
  );

  /* Кнопки гостя: Написать | Звонок | Видео */
  const guestBtns=[
    {ico:'✏️',lbl:'Написать',fn:()=>onMessage(hash,name)},
    ...(onSecretChat?[{ico:'🔒',lbl:'Секретно',fn:()=>onSecretChat!(hash,name)}]:[]),
    {ico:'📞',lbl:'Звонок',  fn:()=>onCall(hash,name)},
    {ico:'📹',lbl:'Видео',   fn:()=>onCall(hash,name)},
  ];

  /* Виджеты — ВСЕ без фильтра, как у хозяина */
  const widgetBar=(gap=8,py='2px 0 4px')=>(
    <div style={{display:'flex',gap,overflowX:'auto',padding:py,scrollbarWidth:'none',msOverflowStyle:'none' as any}}>
      {WIDGET_LIST.map(w=>(
        <WidgetSquare key={w.key} icon={w.icon} label={wLabel(w.key,w.label)} count={w.count} c={c}
          previewUrl={wPreview(w.key)} onPreviewChange={()=>{}} onClick={()=>setWidgetModal(w.key)}/>
      ))}
    </div>
  );

  /* Обложка — копия хозяйской (без кнопки редактирования) */
  const coverSection=(
    pcs===3?<div style={{height:4,background:`linear-gradient(90deg,${ac},${ac}88)`}}/>:
    pcs===5?<div style={{height:6,background:`linear-gradient(90deg,${ac}66,${ac},${ac}66)`}}/>:
    <div style={{position:'relative',
      height:pcs===2?150:pcs===4?100:pcs===6?56:80,
      overflow:'hidden',
      background:pcs===4?(coverPhoto?'#000':'#07070f'):coverPhoto?'#000':coverGrad}}>
      {coverPhoto&&<img src={coverPhoto} alt="" style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:coverPos}}/>}
      {pcs===4&&!coverPhoto&&<div style={{position:'absolute',inset:0,background:`linear-gradient(135deg,${ac}18,transparent)`}}/>}
      {pcs===4&&<div style={{position:'absolute',bottom:0,left:0,right:0,height:2,background:ac,boxShadow:`0 0 12px ${ac}`}}/>}
    </div>
  );

  return(
    <div style={{position:'fixed',inset:0,zIndex:10000,display:'flex',flexDirection:'column'}}>
      <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring',damping:30,stiffness:260}}
        style={{position:'absolute',inset:0,background:c.deep,display:'flex',flexDirection:'column',overflowY:'auto'}}>

        {/* ── Навбар ── */}
        <div style={{position:'sticky',top:0,zIndex:20,display:'flex',alignItems:'center',gap:10,padding:'12px 16px',background:c.deep+'f0',backdropFilter:'blur(12px)',borderBottom:`1px solid ${c.border}`}}>
          <motion.button whileTap={{scale:0.9}} onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:22,color:c.mid,padding:0,lineHeight:1}}>←</motion.button>
          <span style={{fontSize:15,fontWeight:800,color:c.light,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</span>
        </div>

        {loading?(
          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:c.sub,fontSize:13}}>Загрузка профиля…</div>
        ):(
          <>
            {/* ══ ПРОФИЛЬ КАРТОЧКА — точная копия хозяина ══ */}
            <div style={{flexShrink:0,
              background:pcs===4?'#07070f':c.card,
              borderBottom:`1px solid ${pcs===4?ac+'44':c.border}`,
              boxShadow:pcs===4?`0 0 24px ${ac}22`:'none',
              position:'relative'}}>

              {/* Обложка */}
              {coverSection}

              {/* ═══ СТИЛЬ 1: КЛАССИКА ═══ */}
              {(pcs===1||pcs===0)&&(
                <div style={{padding:'0 12px 10px'}}>
                  <div style={{display:'flex',gap:12,marginBottom:8,marginTop:-30}}>
                    {swaipAvatarCard(78,90,14)}
                    <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:3,paddingTop:32}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontSize:15,fontWeight:900,color:c.light,letterSpacing:'-0.03em',flex:1}}>{name}</span>
                        <motion.button whileTap={{scale:0.88}} onClick={()=>onMessage(hash,name)} style={{flexShrink:0,padding:'4px 10px',borderRadius:8,height:28,background:'rgba(160,160,200,0.12)',border:`1px solid ${c.border}`,cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontSize:10,color:c.mid,fontWeight:800,whiteSpace:'nowrap'}}>↗ Поделиться</motion.button>
                      </div>
                      {profNick&&<div style={{display:'flex',alignItems:'center',gap:4}}><span style={{fontSize:12,color:c.sub,fontFamily:'monospace'}}>@{profNick}</span></div>}
                      {(position||company)&&<div style={{fontSize:11,color:c.sub}}>{position}{position&&company?' · ':''}{company}</div>}
                      {profMood.emoji&&<div style={{display:'inline-flex',alignItems:'center',gap:4,background:`${ac}18`,border:`1px solid ${ac}44`,borderRadius:20,padding:'2px 8px',marginTop:2,width:'fit-content'}}><span style={{fontSize:13}}>{profMood.emoji}</span><span style={{fontSize:11,color:ac,fontWeight:700}}>{profMood.text}</span></div>}
                      <div style={{display:'flex',gap:5,marginTop:4}}>
                        {guestBtns.map(btn=>(
                          <motion.button key={btn.lbl} whileTap={{scale:0.93}} onClick={btn.fn} style={{width:54,height:48,borderRadius:10,background:'rgba(160,160,200,0.1)',border:`1px solid ${c.border}`,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,flexShrink:0}}>
                            <span style={{fontSize:16}}>{btn.ico}</span><span style={{fontSize:8,color:c.sub,fontWeight:700,letterSpacing:'0.02em'}}>{btn.lbl}</span>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{marginBottom:8,fontSize:13,color:bio?c.mid:c.sub,lineHeight:1.5}}>{bio||''}</div>
                  <div style={{display:'flex',gap:6,marginBottom:8}}>
                    {website
                      ?<a href={website.startsWith('http')?website:`https://${website}`} target="_blank" rel="noopener noreferrer" style={{flex:1,fontSize:12,padding:'5px 8px',borderRadius:7,background:c.cardAlt,border:`1px solid ${c.border}`,color:'#6060cc',textDecoration:'none',display:'flex',alignItems:'center',gap:4,overflow:'hidden'}}>
                          <span>🌐</span><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:600}}>{website.replace(/^https?:\/\//,'')}</span>
                        </a>
                      :<div style={{flex:1,fontSize:12,color:c.sub,padding:'5px 8px',borderRadius:7,background:c.cardAlt,border:`1px solid ${c.border}`}}>🌐 Добавить сайт</div>
                    }
                    {contacts.phone
                      ?<a href={`tel:${contacts.phone}`} style={{flex:1,fontSize:12,padding:'5px 8px',borderRadius:7,background:c.cardAlt,border:`1px solid ${c.border}`,color:'#60aa60',textDecoration:'none',display:'flex',alignItems:'center',gap:4}}><span>📞</span><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{contacts.phone}</span></a>
                      :<div style={{flex:1,fontSize:12,color:c.sub,padding:'5px 8px',borderRadius:7,background:c.cardAlt,border:`1px solid ${c.border}`}}>📞 Телефон</div>
                    }
                  </div>
                  {widgetBar(8,'2px 0 4px')}
                </div>
              )}

              {/* ═══ СТИЛЬ 2: СИНЕМА ═══ */}
              {pcs===2&&(
                <div style={{paddingBottom:14}}>
                  <div style={{display:'flex',justifyContent:'center',marginTop:-46,position:'relative',zIndex:2}}>
                    <div style={{width:92,height:92,borderRadius:'50%',overflow:'hidden',border:`4px solid ${c.card}`,boxShadow:`0 4px 24px rgba(0,0,0,0.5)`,background:c.cardAlt}}>
                      <img src={avatarSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    </div>
                  </div>
                  <div style={{textAlign:'center',padding:'10px 16px 0'}}>
                    <span style={{fontSize:18,fontWeight:900,color:c.light,letterSpacing:'-0.02em'}}>{name}</span>
                    {profNick&&<div style={{marginTop:2}}><span style={{fontSize:12,color:c.sub,fontFamily:'monospace'}}>@{profNick}</span></div>}
                    {(position||company)&&<div style={{fontSize:11,color:c.sub,marginTop:3}}>{position}{position&&company?' · ':''}{company}</div>}
                    <div style={{marginTop:8,fontSize:13,color:bio?c.mid:c.sub,lineHeight:1.5,padding:'0 12px'}}>{bio||''}</div>
                    {website&&<a href={website.startsWith('http')?website:`https://${website}`} target="_blank" rel="noreferrer" style={{display:'block',marginTop:6,fontSize:12,color:'#6060cc',textDecoration:'none'}}>🌐 {website.replace(/^https?:\/\//,'')}</a>}
                    {profMood.emoji&&<div style={{display:'flex',justifyContent:'center',marginTop:8}}><div style={{display:'inline-flex',alignItems:'center',gap:4,background:`${ac}18`,border:`1px solid ${ac}44`,borderRadius:20,padding:'3px 10px'}}><span style={{fontSize:15}}>{profMood.emoji}</span><span style={{fontSize:12,color:ac,fontWeight:700}}>{profMood.text}</span></div></div>}
                  </div>
                  <div style={{display:'flex',margin:'12px 16px 0',borderRadius:12,background:c.cardAlt,border:`1px solid ${c.border}`,overflow:'hidden'}}>
                    {[{n:'Посты',v:posts.length},{n:'Друзья',v:0},{n:'Подписки',v:0}].map((s,i)=>(
                      <div key={s.n} style={{flex:1,textAlign:'center',padding:'10px 0',borderRight:i<2?`1px solid ${c.border}`:'none'}}>
                        <div style={{fontSize:17,fontWeight:900,color:c.light}}>{s.v}</div>
                        <div style={{fontSize:9,color:c.sub,marginTop:1,letterSpacing:'0.04em'}}>{s.n}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:8,padding:'12px 16px 0'}}>
                    <motion.button whileTap={{scale:0.96}} onClick={()=>onMessage(hash,name)} style={{flex:1,padding:'11px 0',borderRadius:12,background:ac,border:'none',color:'#fff',fontWeight:800,fontSize:13,cursor:'pointer'}}>✏️ Написать</motion.button>
                    {onSecretChat&&<motion.button whileTap={{scale:0.96}} onClick={()=>onSecretChat(hash,name)} style={{flex:1,padding:'11px 0',borderRadius:12,background:'rgba(34,197,94,0.15)',border:'1px solid rgba(34,197,94,0.4)',color:'#22c55e',fontWeight:800,fontSize:13,cursor:'pointer'}} title="Секретный чат со сквозным шифрованием">🔒 Секретно</motion.button>}
                    <motion.button whileTap={{scale:0.96}} onClick={()=>onCall(hash,name)} style={{flex:1,padding:'11px 0',borderRadius:12,background:c.cardAlt,border:`1px solid ${c.border}`,color:c.mid,fontWeight:800,fontSize:13,cursor:'pointer'}}>📞 Звонок</motion.button>
                  </div>
                  {widgetBar(8,'12px 16px 2px')}
                </div>
              )}

              {/* ═══ СТИЛЬ 3: РЕДАКЦИОННЫЙ ═══ */}
              {pcs===3&&(
                <div style={{padding:'12px'}}>
                  <div style={{display:'flex',gap:12,alignItems:'flex-start',marginBottom:10}}>
                    <div style={{flexShrink:0}}>
                      <div style={{width:82,height:82,overflow:'hidden',borderRadius:0,outline:`3px solid ${ac}`,outlineOffset:2}}>
                        <img src={avatarSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                      </div>
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <span style={{fontSize:22,fontWeight:900,color:c.light,letterSpacing:'-0.04em',lineHeight:1.1,display:'block'}}>{name}</span>
                      {profNick&&<div style={{marginTop:2}}><span style={{fontSize:10,color:`${ac}bb`,fontFamily:'monospace',letterSpacing:'0.1em'}}>@{profNick}</span></div>}
                      {(position||company)&&<div style={{fontSize:11,color:c.sub,marginTop:2,letterSpacing:'0.03em'}}>{position}{position&&company?' / ':''}{company}</div>}
                      {profMood.emoji&&<div style={{display:'inline-flex',alignItems:'center',gap:4,background:`${ac}18`,border:`1px solid ${ac}44`,borderRadius:20,padding:'2px 8px',marginTop:4,width:'fit-content'}}><span style={{fontSize:13}}>{profMood.emoji}</span><span style={{fontSize:11,color:ac,fontWeight:700}}>{profMood.text}</span></div>}
                      <div style={{fontSize:12,color:bio?c.mid:c.sub,marginTop:5,lineHeight:1.4}}>{bio||''}</div>
                      {website&&<a href={website.startsWith('http')?website:`https://${website}`} target="_blank" rel="noreferrer" style={{display:'block',marginTop:4,fontSize:11,color:'#6060cc',textDecoration:'none'}}>🌐 {website.replace(/^https?:\/\//,'')}</a>}
                    </div>
                  </div>
                  <div style={{height:2,background:`${ac}55`,marginBottom:8}}/>
                  <div style={{display:'flex',borderRadius:8,overflow:'hidden',border:`1px solid ${c.border}`}}>
                    {guestBtns.map((b,i)=>(
                      <motion.button key={b.lbl} whileTap={{scale:0.94}} onClick={b.fn}
                        style={{flex:1,padding:'9px 4px',background:c.card,border:'none',borderRight:i<guestBtns.length-1?`1px solid ${c.border}`:'none',cursor:'pointer',fontSize:10,color:c.sub,fontWeight:700,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                        <span style={{fontSize:14}}>{b.ico}</span><span>{b.lbl}</span>
                      </motion.button>
                    ))}
                  </div>
                  {widgetBar(8,'10px 0 2px')}
                </div>
              )}

              {/* ═══ СТИЛЬ 4: НЕОН ═══ */}
              {pcs===4&&(
                <div style={{padding:'0 12px 12px'}}>
                  <div style={{display:'flex',gap:12,marginBottom:10,marginTop:-28}}>
                    <div style={{flexShrink:0,position:'relative',zIndex:1}}>
                      <div style={{width:80,height:80,borderRadius:8,overflow:'hidden',border:`2px solid ${ac}`,boxShadow:`0 0 16px ${ac}66`,position:'relative'}}>
                        <img src={avatarSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                        <div style={{position:'absolute',bottom:0,left:0,right:0,height:14,background:'linear-gradient(90deg,#8a8a9a 0%,#c8c8d8 20%,#f0f0f8 50%,#c8c8d8 80%,#8a8a9a 100%)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          <span style={{fontSize:5,fontWeight:900,letterSpacing:'0.22em',textTransform:'uppercase',color:'#1a1a2a'}}>SWAIP</span>
                        </div>
                      </div>
                    </div>
                    <div style={{flex:1,paddingTop:30,minWidth:0}}>
                      <span style={{fontSize:16,fontWeight:900,color:ac,textShadow:`0 0 12px ${ac}88`,letterSpacing:'-0.01em'}}>{name}</span>
                      {profNick&&<div style={{marginTop:1}}><span style={{fontSize:10,color:`${ac}88`,fontFamily:'monospace'}}>@{profNick}</span></div>}
                      {profMood.emoji&&<div style={{marginTop:5,display:'inline-flex',alignItems:'center',gap:4,background:`${ac}18`,border:`1px solid ${ac}44`,borderRadius:20,padding:'2px 8px'}}><span style={{fontSize:12}}>{profMood.emoji}</span><span style={{fontSize:10,color:ac,fontWeight:700}}>{profMood.text}</span></div>}
                      <div style={{display:'flex',gap:4,marginTop:6,flexWrap:'wrap'}}>
                        {[{l:'ПОСТОВ',v:posts.length},{l:'FRIENDS',v:0}].map(s=>(
                          <div key={s.l} style={{padding:'2px 7px',borderRadius:3,border:`1px solid ${ac}44`,background:`${ac}11`,fontSize:9,fontWeight:900,color:ac,letterSpacing:'0.1em'}}>{s.v} {s.l}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{fontSize:12,color:'rgba(200,210,255,0.7)',lineHeight:1.5,margin:'0 0 10px',fontFamily:'monospace'}}>{bio||''}</div>
                  <div style={{display:'flex',gap:6,marginBottom:10}}>
                    {guestBtns.map(b=>(
                      <motion.button key={b.lbl} whileTap={{scale:0.93}} onClick={b.fn} style={{flex:1,padding:'8px 0',borderRadius:6,background:'transparent',border:`1px solid ${ac}55`,color:ac,cursor:'pointer',fontSize:8,fontWeight:800,display:'flex',flexDirection:'column',alignItems:'center',gap:2,boxShadow:`inset 0 0 10px ${ac}0a`}}>
                        <span style={{fontSize:14}}>{b.ico}</span><span style={{letterSpacing:'0.06em'}}>{b.lbl.toUpperCase()}</span>
                      </motion.button>
                    ))}
                  </div>
                  {widgetBar(8,'0')}
                </div>
              )}

              {/* ═══ СТИЛЬ 5: МИНИМАЛ ═══ */}
              {pcs===5&&(
                <div style={{padding:'20px 12px 16px',textAlign:'center'}}>
                  <div style={{display:'inline-block',marginBottom:12}}>
                    <div style={{width:76,height:76,borderRadius:'50%',overflow:'hidden',border:`3px solid ${c.card}`,outline:`2px solid ${ac}55`,boxShadow:`0 2px 18px rgba(0,0,0,0.25)`,margin:'0 auto'}}>
                      <img src={avatarSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                    </div>
                  </div>
                  <div><span style={{fontSize:18,fontWeight:900,color:c.light,letterSpacing:'-0.03em'}}>{name}</span></div>
                  {profNick&&<div style={{marginTop:2}}><span style={{fontSize:11,color:c.sub,fontFamily:'monospace'}}>@{profNick}</span></div>}
                  {(position||company)&&<div style={{fontSize:11,color:c.sub,marginTop:3}}>{position}{position&&company?' · ':''}{company}</div>}
                  {profMood.emoji&&<div style={{display:'flex',justifyContent:'center',marginTop:8}}><div style={{display:'inline-flex',alignItems:'center',gap:4,background:`${ac}18`,border:`1px solid ${ac}44`,borderRadius:20,padding:'2px 8px'}}><span style={{fontSize:13}}>{profMood.emoji}</span><span style={{fontSize:11,color:ac,fontWeight:700}}>{profMood.text}</span></div></div>}
                  <div style={{marginTop:8,fontSize:13,color:bio?c.mid:c.sub,lineHeight:1.5,padding:'0 20px'}}>{bio||''}</div>
                  {website&&<a href={website.startsWith('http')?website:`https://${website}`} target="_blank" rel="noreferrer" style={{display:'block',marginTop:6,fontSize:12,color:'#6060cc',textDecoration:'none'}}>🌐 {website.replace(/^https?:\/\//,'')}</a>}
                  <div style={{display:'flex',justifyContent:'center',gap:28,marginTop:16}}>
                    {guestBtns.map(b=>(
                      <motion.button key={b.lbl} whileTap={{scale:0.9}} onClick={b.fn} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,background:'none',border:'none',cursor:'pointer'}}>
                        <div style={{width:46,height:46,borderRadius:'50%',background:c.cardAlt,border:`1px solid ${c.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{b.ico}</div>
                        <span style={{fontSize:10,color:c.sub,fontWeight:700}}>{b.lbl}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* ═══ СТИЛЬ 6: КОМПАКТ ═══ */}
              {pcs===6&&(
                <div style={{padding:'0 12px 10px'}}>
                  <div style={{display:'flex',gap:10,alignItems:'flex-start',marginTop:-16}}>
                    <div style={{flexShrink:0,zIndex:1,position:'relative'}}>
                      <div style={{width:62,height:62,borderRadius:10,overflow:'hidden',border:`2px solid ${c.card}`,boxShadow:`0 2px 10px rgba(0,0,0,0.3)`}}>
                        <img src={avatarSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                      </div>
                    </div>
                    <div style={{flex:1,minWidth:0,paddingTop:18}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontSize:14,fontWeight:900,color:c.light,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',display:'block',flex:1}}>{name}</span>
                      </div>
                      {profNick&&<div style={{marginTop:1}}><span style={{fontSize:10,color:c.sub,fontFamily:'monospace'}}>@{profNick}</span></div>}
                      <div style={{fontSize:11,color:bio?c.mid:c.sub,marginTop:2,lineHeight:1.3,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2 as any,WebkitBoxOrient:'vertical' as any}}>{bio||''}</div>
                      {profMood.emoji&&<div style={{marginTop:4,display:'inline-flex',alignItems:'center',gap:4,background:`${ac}18`,border:`1px solid ${ac}44`,borderRadius:20,padding:'2px 7px'}}><span style={{fontSize:11}}>{profMood.emoji}</span><span style={{fontSize:10,color:ac,fontWeight:700}}>{profMood.text}</span></div>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:5,marginTop:8}}>
                    {guestBtns.map(btn=>(
                      <motion.button key={btn.lbl} whileTap={{scale:0.93}} onClick={btn.fn} style={{flex:1,height:44,borderRadius:8,background:c.cardAlt,border:`1px solid ${c.border}`,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:1,flexShrink:0}}>
                        <span style={{fontSize:14}}>{btn.ico}</span><span style={{fontSize:7,color:c.sub,fontWeight:700}}>{btn.lbl}</span>
                      </motion.button>
                    ))}
                  </div>
                  {website&&<a href={website.startsWith('http')?website:`https://${website}`} target="_blank" rel="noreferrer" style={{display:'block',marginTop:6,fontSize:11,color:'#6060cc',textDecoration:'none'}}>🌐 {website.replace(/^https?:\/\//,'')}</a>}
                  {widgetBar(8,'8px 0 2px')}
                </div>
              )}
            </div>

            {/* ── Хайлайты (точная копия хозяина) ── */}
            {highlights.length>0&&(
              <div style={{background:c.card,borderBottom:`1px solid ${c.border}`,padding:'10px 12px'}}>
                <div style={{display:'flex',gap:12,overflowX:'auto',paddingBottom:2,scrollbarWidth:'none'}}>
                  {highlights.map((hl:any)=>(
                    <div key={hl.id} style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:5}}>
                      <div style={{width:54,height:54,borderRadius:'50%',overflow:'hidden',
                        background:hl.coverUrl?'transparent':`linear-gradient(135deg,${ac},#818cf8)`,
                        border:`2px solid ${ac}55`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>
                        {hl.coverUrl?<img src={hl.coverUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span>{hl.emoji||'✨'}</span>}
                      </div>
                      <span style={{fontSize:9,color:c.sub,fontWeight:600,maxWidth:56,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textAlign:'center'}}>{hl.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Каналы хозяина (полный список, кликабельный) ── */}
            {(()=>{
              const guestChannels:any[]=Array.isArray(d.sw_channels)?d.sw_channels:[];
              if(!guestChannels.length)return null;
              return(
                <div style={{background:c.card,borderBottom:`1px solid ${c.border}`,padding:'14px 12px 10px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                    <span style={{fontSize:16}}>📡</span>
                    <span style={{fontSize:14,fontWeight:900,color:c.light}}>Каналы</span>
                    <span style={{fontSize:11,color:c.sub,marginLeft:'auto',background:c.cardAlt,borderRadius:20,padding:'1px 8px',border:`1px solid ${c.border}`}}>{guestChannels.length}</span>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {guestChannels.map((ch:any)=>(
                      <motion.div key={ch.id} whileTap={{scale:0.98}} onClick={()=>setOpenGuestChannel(ch)}
                        style={{borderRadius:16,overflow:'hidden',background:c.cardAlt,border:`1px solid ${c.border}`,cursor:'pointer',
                          boxShadow:`0 2px 12px rgba(0,0,0,0.25)`}}>
                        {/* Мини-шапка канала */}
                        <div style={{height:56,background:ch.coverGradient||`linear-gradient(135deg,${ac}44,#0a0a14)`,position:'relative',overflow:'hidden'}}>
                          {ch.coverPhotoUrl&&<img src={ch.coverPhotoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover',opacity:0.7}}/>}
                          <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,transparent 30%,rgba(0,0,0,0.6))'}}/>
                        </div>
                        <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 12px 10px',marginTop:-20,position:'relative'}}>
                          <div style={{width:40,height:40,borderRadius:10,flexShrink:0,
                            background:ch.coverGradient||`linear-gradient(135deg,${ac}44,#0a0a14)`,
                            border:`2px solid ${c.card}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,overflow:'hidden'}}>
                            {ch.avatarPhotoUrl?<img src={ch.avatarPhotoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span>{ch.vibe||'📡'}</span>}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:'flex',alignItems:'center',gap:5}}>
                              <span style={{fontSize:13,fontWeight:900,color:c.light}}>{ch.name}</span>
                              {ch.isVerified&&<span style={{fontSize:10,color:'#60a5fa',fontWeight:700}}>✓</span>}
                            </div>
                            <div style={{display:'flex',gap:8,marginTop:1}}>
                              <span style={{fontSize:10,color:c.sub}}>👥 {ch.subscribers||0}</span>
                              <span style={{fontSize:10,color:c.sub}}>📝 {ch.postCount||0}</span>
                              {ch.tags?.length>0&&<span style={{fontSize:9,color:ac,fontWeight:700}}>#{ch.tags[0]}</span>}
                            </div>
                          </div>
                          <span style={{fontSize:12,color:c.sub,flexShrink:0}}>›</span>
                        </div>
                        {ch.description&&<div style={{padding:'0 12px 8px',fontSize:12,color:c.mid,lineHeight:1.4}}>{ch.description}</div>}
                        {/* Превью последних постов */}
                        {Array.isArray(ch.posts)&&ch.posts.length>0&&(
                          <div style={{borderTop:`1px solid ${c.border}`,padding:'8px 12px',display:'flex',flexDirection:'column',gap:6}}>
                            {ch.posts.slice(-3).reverse().map((p:any)=>(
                              <div key={p.id} style={{fontSize:12,color:c.mid,lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2 as any,WebkitBoxOrient:'vertical' as any,overflow:'hidden'}}>
                                {p.imageUrl&&<span style={{marginRight:4}}>🖼</span>}
                                {p.text||''}
                              </div>
                            ))}
                            <div style={{fontSize:10,color:ac,fontWeight:700,marginTop:2}}>Читать всё →</div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── Группы хозяина (полный список, кликабельный) ── */}
            {(()=>{
              const guestGroups:any[]=Array.isArray(d.sw_groups)?d.sw_groups:[];
              if(!guestGroups.length)return null;
              return(
                <div style={{background:c.card,borderBottom:`1px solid ${c.border}`,padding:'14px 12px 10px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                    <span style={{fontSize:16}}>👥</span>
                    <span style={{fontSize:14,fontWeight:900,color:c.light}}>Группы</span>
                    <span style={{fontSize:11,color:c.sub,marginLeft:'auto',background:c.cardAlt,borderRadius:20,padding:'1px 8px',border:`1px solid ${c.border}`}}>{guestGroups.length}</span>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {guestGroups.map((g:any)=>(
                      <motion.div key={g.id} whileTap={{scale:0.98}} onClick={()=>!g.isPrivate&&setOpenGuestGroup(g)}
                        style={{borderRadius:16,overflow:'hidden',border:`1px solid ${g.color?g.color+'44':c.border}`,cursor:g.isPrivate?'default':'pointer',
                          background:g.gradient||c.cardAlt,boxShadow:`0 2px 12px rgba(0,0,0,0.2)`}}>
                        <div style={{padding:'10px 12px'}}>
                          <div style={{display:'flex',alignItems:'center',gap:10}}>
                            <div style={{width:44,height:44,borderRadius:12,flexShrink:0,
                              background:`linear-gradient(135deg,${g.color||ac}44,${g.color||ac}22)`,
                              display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,
                              border:`2px solid ${g.color||ac}44`}}>
                              <span>{g.emoji||'👥'}</span>
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:'flex',alignItems:'center',gap:6}}>
                                <span style={{fontSize:13,fontWeight:900,color:'rgba(255,255,255,0.92)'}}>{g.name}</span>
                                {g.isPrivate&&<span style={{fontSize:9,color:c.sub,background:'rgba(255,255,255,0.08)',borderRadius:20,padding:'1px 6px'}}>🔒 Закрытая</span>}
                              </div>
                              {g.description&&<div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{g.description}</div>}
                              <div style={{display:'flex',gap:8,marginTop:3}}>
                                <span style={{fontSize:10,color:'rgba(255,255,255,0.45)'}}>👥 {g.memberCount||0}</span>
                                {g.streak>0&&<span style={{fontSize:10,color:'#f97316'}}>🔥 {g.streak} дн.</span>}
                                {g.todayMood&&<span style={{fontSize:12}}>{g.todayMood}</span>}
                                {g.wordOfDay&&<span style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>💬 «{g.wordOfDay}»</span>}
                              </div>
                            </div>
                            {!g.isPrivate&&<span style={{fontSize:12,color:'rgba(255,255,255,0.3)',flexShrink:0}}>›</span>}
                          </div>
                        </div>
                        {/* Превью последних постов (только публичные) */}
                        {!g.isPrivate&&Array.isArray(g.posts)&&g.posts.length>0&&(
                          <div style={{borderTop:`1px solid rgba(255,255,255,0.08)`,padding:'8px 12px',display:'flex',flexDirection:'column',gap:5}}>
                            {g.posts.slice(-2).reverse().map((p:any)=>(
                              <div key={p.id} style={{fontSize:12,color:'rgba(255,255,255,0.6)',lineHeight:1.4,display:'-webkit-box',WebkitLineClamp:2 as any,WebkitBoxOrient:'vertical' as any,overflow:'hidden'}}>
                                <span style={{color:'rgba(255,255,255,0.35)',marginRight:4}}>{p.authorName?.split(' ')[0]||'Участник'}:</span>{p.text}
                              </div>
                            ))}
                            <div style={{fontSize:10,color:g.color||ac,fontWeight:700,marginTop:2}}>Открыть группу →</div>
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── Табы Лента | Виджеты (как у хозяина) ── */}
            <div style={{flexShrink:0,display:'flex',background:c.card,borderBottom:`1px solid ${c.border}`}}>
              {([['feed','Лента'],['widgets','Виджеты']] as [string,string][]).map(([k,lbl])=>{
                const active=guestTab===k;
                return <button key={k} onClick={()=>setGuestTab(k as 'feed'|'widgets')}
                  style={{flex:1,padding:'9px 0',border:'none',background:'none',cursor:'pointer',
                    fontWeight:active?900:500,fontSize:12,color:active?c.light:c.sub,
                    borderBottom:active?`2.5px solid ${ac}`:'2.5px solid transparent',transition:'all 0.15s'}}>{lbl}</button>;
              })}
            </div>

            {/* ── Лента ── */}
            {guestTab==='feed'&&(
              <div style={{padding:'10px 10px 80px',background:feedBg||c.deep,backgroundAttachment:'fixed',minHeight:300}}>
                {posts.length>0
                  ?posts.map(p=><PostCard key={p.id} p={p} name={name} avatarSrc={avatarSrc} onLike={toggleLike} onComment={id=>setCommentPostId(id)} onBook={handleBook} onUpdate={upd=>setPosts(prev=>prev.map(q=>q.id===upd.id?upd:q))} onNewPost={raw=>{const b=raw as any;const np:Post={id:String(b.id||`p_${Date.now()}`),text:b.content||'',img:b.imageUrl||undefined,videoUrl:b.videoUrl||undefined,audioUrl:b.audioUrl||undefined,likes:0,liked:false,comments:0,ts:'только что',...(b.quoteOf?{quoteOf:b.quoteOf}:{}),...(b.repostOf?{repostOf:b.repostOf}:{})};setPosts(prev=>[np,...prev]);}} isOwner={true} c={c} accent={ac} style={pcs||1}/>)
                  :<div style={{textAlign:'center',color:c.sub,fontSize:13,paddingTop:60,opacity:0.7}}>Публикаций пока нет</div>}
              </div>
            )}

            {/* ── Виджеты (как у хозяина, только без кнопок редактирования) ── */}
            {guestTab==='widgets'&&(
              <div style={{padding:'12px 12px 80px',background:feedBg||c.deep,backgroundAttachment:'fixed',minHeight:300}}>
                <div style={{fontSize:9,fontWeight:800,color:c.sub,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:8}}>Блоки профиля</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:16}}>
                  {WIDGET_LIST.map(w=><WidgetSquare key={w.key} icon={w.icon} label={wLabel(w.key,w.label)} count={w.count} c={c} previewUrl={wPreview(w.key)} onPreviewChange={()=>{}} onClick={()=>setWidgetModal(w.key)}/>)}
                </div>
                {/* Работы */}
                {works.length>0&&(<div style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:800,color:c.sub,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:8}}>🎨 Работы</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                    {works.map((w:any)=>(
                      <div key={w.id} style={{borderRadius:14,overflow:'hidden',background:c.card,border:`1px solid ${c.border}`}}>
                        {w.imageUrl?<img src={w.imageUrl} alt={w.title} style={{width:'100%',aspectRatio:'1/1',objectFit:'cover',display:'block'}}/>
                          :<div style={{width:'100%',aspectRatio:'1/1',background:c.cardAlt,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>🎨</div>}
                        <div style={{padding:8}}>
                          <div style={{fontSize:12,fontWeight:800,color:c.light}}>{w.title}</div>
                          {w.desc&&<div style={{fontSize:10,color:c.sub,marginTop:2,lineHeight:1.4}}>{w.desc.slice(0,60)}{w.desc.length>60?'…':''}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>)}
                {/* Прайс */}
                {priceItems.length>0&&(<div style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:800,color:c.sub,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:8}}>💰 Услуги и цены</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {priceItems.map((item:any)=>(
                      <div key={item.id} style={{borderRadius:14,overflow:'hidden',background:c.card,border:`1px solid ${c.border}`,display:'flex',alignItems:'center',gap:0}}>
                        {item.photo&&<img src={item.photo} alt={item.name} style={{width:80,height:80,objectFit:'cover',flexShrink:0}}/>}
                        <div style={{padding:'10px 12px',flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:800,color:c.light}}>{item.name}</div>
                          {item.desc&&<div style={{fontSize:11,color:c.sub,marginTop:2,lineHeight:1.4}}>{item.desc}</div>}
                          <div style={{fontSize:15,fontWeight:900,color:ac,marginTop:4}}>{item.price}{item.unit?` / ${item.unit}`:''}</div>
                        </div>
                        <motion.button whileTap={{scale:0.95}} onClick={()=>{setBookingItem(item);setBkName('');setBkPhone('');setBkStatus('idle');setBkError('');setWidgetModal('booking');}} style={{flexShrink:0,margin:10,padding:'8px 14px',borderRadius:10,background:ac,border:'none',color:'#fff',fontWeight:800,fontSize:11,cursor:'pointer'}}>Записаться</motion.button>
                      </div>
                    ))}
                  </div>
                </div>)}
                {/* Отзывы */}
                {reviews.length>0&&(<div style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:800,color:c.sub,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:8}}>⭐ Отзывы</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {reviews.map((r:any)=>(
                      <div key={r.id} style={{borderRadius:14,overflow:'hidden',background:c.card,border:`1px solid ${c.border}`}}>
                        {r.imageUrl&&<img src={r.imageUrl} alt="" style={{width:'100%',display:'block',objectFit:'contain',maxHeight:260}}/>}
                        {r.caption&&<div style={{padding:'10px 12px',fontSize:13,color:c.mid,lineHeight:1.5}}>{r.caption}</div>}
                        {r.date&&<div style={{padding:'0 12px 10px',fontSize:10,color:c.sub}}>{r.date}</div>}
                      </div>
                    ))}
                  </div>
                </div>)}
                {/* Сертификаты */}
                {certs.length>0&&(<div style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:800,color:c.sub,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:8}}>📜 Сертификаты</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {certs.map((cert:any)=>(
                      <div key={cert.id} style={{borderRadius:14,overflow:'hidden',background:c.card,border:`1px solid ${c.border}`}}>
                        {cert.imageUrl&&<img src={cert.imageUrl} alt={cert.title} style={{width:'100%',display:'block',objectFit:'contain',maxHeight:220}}/>}
                        {cert.title&&<div style={{padding:'10px 12px',fontSize:13,fontWeight:700,color:c.light}}>{cert.title}</div>}
                        {cert.desc&&<div style={{padding:'0 12px 10px',fontSize:11,color:c.sub,lineHeight:1.4}}>{cert.desc}</div>}
                      </div>
                    ))}
                  </div>
                </div>)}
                {/* Кейсы */}
                {cases.length>0&&(<div style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:800,color:c.sub,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:8}}>📁 Кейсы</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {cases.map((cs:any)=>(
                      <div key={cs.id} style={{borderRadius:14,background:c.card,border:`1px solid ${c.border}`,padding:'12px 14px'}}>
                        <div style={{fontSize:13,fontWeight:800,color:c.light,marginBottom:4}}>{cs.title}</div>
                        {cs.desc&&<div style={{fontSize:12,color:c.mid,lineHeight:1.5}}>{cs.desc}</div>}
                        {cs.result&&<div style={{marginTop:6,fontSize:11,color:ac,fontWeight:700}}>Результат: {cs.result}</div>}
                      </div>
                    ))}
                  </div>
                </div>)}
                {/* FAQ */}
                {faqs.length>0&&(<div style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:800,color:c.sub,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:8}}>❓ FAQ</div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {faqs.map((f:any)=>(
                      <div key={f.id} style={{borderRadius:12,background:c.card,border:`1px solid ${c.border}`,padding:'10px 14px'}}>
                        <div style={{fontSize:13,fontWeight:700,color:c.light,marginBottom:4}}>Q: {f.question}</div>
                        <div style={{fontSize:12,color:c.mid,lineHeight:1.5}}>A: {f.answer}</div>
                      </div>
                    ))}
                  </div>
                </div>)}
                {/* Ссылки */}
                {links.length>0&&(<div style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:800,color:c.sub,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:8}}>🔗 Ссылки</div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {links.map((lnk:any,i:number)=>(
                      <a key={i} href={lnk.url?.startsWith('http')?lnk.url:`https://${lnk.url}`} target="_blank" rel="noreferrer"
                        style={{borderRadius:12,background:c.card,border:`1px solid ${c.border}`,padding:'10px 14px',display:'flex',alignItems:'center',gap:10,textDecoration:'none'}}>
                        {lnk.icon&&<span style={{fontSize:20}}>{lnk.icon}</span>}
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:700,color:c.light,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lnk.label||lnk.url}</div>
                          {lnk.url&&<div style={{fontSize:10,color:c.sub,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lnk.url}</div>}
                        </div>
                        <span style={{fontSize:12,color:c.sub,flexShrink:0}}>↗</span>
                      </a>
                    ))}
                  </div>
                </div>)}
                {works.length===0&&priceItems.length===0&&reviews.length===0&&certs.length===0&&cases.length===0&&faqs.length===0&&links.length===0&&(
                  <div style={{textAlign:'center',color:c.sub,fontSize:13,paddingTop:40,opacity:0.7}}>Виджеты не заполнены</div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── Полный просмотр канала (гость) ── */}
        <AnimatePresence>
          {openGuestChannel&&(
            <motion.div key="gch" initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring',damping:30,stiffness:260}}
              style={{position:'absolute',inset:0,background:c.deep,display:'flex',flexDirection:'column',zIndex:50,overflowY:'auto'}}>
              {/* Шапка с обложкой */}
              <div style={{position:'relative',flexShrink:0}}>
                <div style={{height:140,background:openGuestChannel.coverGradient||`linear-gradient(135deg,${ac}44,#0a0a14)`,overflow:'hidden'}}>
                  {openGuestChannel.coverPhotoUrl&&<img src={openGuestChannel.coverPhotoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>}
                  <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,rgba(0,0,0,0.2),rgba(0,0,0,0.7))'}}/>
                </div>
                <motion.button whileTap={{scale:0.9}} onClick={()=>setOpenGuestChannel(null)}
                  style={{position:'absolute',top:12,left:12,width:36,height:36,borderRadius:12,background:'rgba(0,0,0,0.5)',
                    border:'1px solid rgba(255,255,255,0.2)',color:'#fff',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)'}}>←</motion.button>
                <div style={{padding:'0 14px 14px',marginTop:-40,position:'relative'}}>
                  <div style={{display:'flex',alignItems:'flex-end',gap:12}}>
                    <div style={{width:64,height:64,borderRadius:14,flexShrink:0,overflow:'hidden',
                      background:openGuestChannel.coverGradient||`linear-gradient(135deg,${ac}44,#0a0a14)`,
                      border:`3px solid ${c.deep}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26}}>
                      {openGuestChannel.avatarPhotoUrl?<img src={openGuestChannel.avatarPhotoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span>{openGuestChannel.vibe||'📡'}</span>}
                    </div>
                    <div style={{flex:1,minWidth:0,paddingBottom:4}}>
                      <div style={{display:'flex',alignItems:'center',gap:6}}>
                        <span style={{fontSize:16,fontWeight:900,color:'#fff'}}>{openGuestChannel.name}</span>
                        {openGuestChannel.isVerified&&<span style={{fontSize:11,color:'#60a5fa',fontWeight:700}}>✓</span>}
                      </div>
                      {openGuestChannel.handle&&<div style={{fontSize:11,color:'rgba(255,255,255,0.5)',fontFamily:'monospace'}}>@{openGuestChannel.handle}</div>}
                    </div>
                  </div>
                  {openGuestChannel.description&&<div style={{marginTop:10,fontSize:13,color:'rgba(255,255,255,0.75)',lineHeight:1.5}}>{openGuestChannel.description}</div>}
                  {/* Статистика */}
                  <div style={{display:'flex',gap:14,marginTop:10}}>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:15,fontWeight:900,color:'#fff'}}>{openGuestChannel.subscribers||0}</div>
                      <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',letterSpacing:'0.06em'}}>ПОДПИСЧИКИ</div>
                    </div>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:15,fontWeight:900,color:'#fff'}}>{openGuestChannel.postCount||0}</div>
                      <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',letterSpacing:'0.06em'}}>ПОСТОВ</div>
                    </div>
                    {openGuestChannel.energyLevel>0&&<div style={{textAlign:'center'}}>
                      <div style={{fontSize:15,fontWeight:900,color:ac}}>{openGuestChannel.energyLevel}%</div>
                      <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',letterSpacing:'0.06em'}}>ЭНЕРГИЯ</div>
                    </div>}
                  </div>
                  {/* Теги */}
                  {openGuestChannel.tags?.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:8}}>
                    {openGuestChannel.tags.map((t:string)=>(
                      <span key={t} style={{fontSize:10,color:ac,background:ac+'18',border:`1px solid ${ac}33`,borderRadius:20,padding:'2px 8px',fontWeight:700}}>#{t}</span>
                    ))}
                  </div>}
                  {/* USP */}
                  {openGuestChannel.usp&&<div style={{marginTop:10,padding:'10px 12px',borderRadius:12,background:ac+'18',border:`1px solid ${ac}33`,fontSize:12,color:'rgba(255,255,255,0.8)',lineHeight:1.5,fontStyle:'italic'}}>✨ {openGuestChannel.usp}</div>}
                </div>
              </div>
              {/* Сотрудники */}
              {openGuestChannel.employees?.length>0&&(
                <div style={{padding:'12px 14px',borderTop:`1px solid ${c.border}`,flexShrink:0}}>
                  <div style={{fontSize:11,fontWeight:800,color:c.sub,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:8}}>👤 Команда</div>
                  <div style={{display:'flex',gap:10,overflowX:'auto',scrollbarWidth:'none',paddingBottom:4}}>
                    {openGuestChannel.employees.map((emp:any,i:number)=>(
                      <div key={i} style={{flexShrink:0,textAlign:'center',minWidth:60}}>
                        <div style={{width:44,height:44,borderRadius:'50%',background:ac+'33',border:`2px solid ${ac}55`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,margin:'0 auto 4px',overflow:'hidden'}}>
                          {emp.photo?<img src={emp.photo} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span>👤</span>}
                        </div>
                        <div style={{fontSize:10,fontWeight:700,color:c.light,maxWidth:60,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{emp.name}</div>
                        {emp.role&&<div style={{fontSize:8,color:c.sub}}>{emp.role}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Прайс-лист */}
              {openGuestChannel.priceList?.length>0&&(
                <div style={{padding:'12px 14px',borderTop:`1px solid ${c.border}`,flexShrink:0}}>
                  <div style={{fontSize:11,fontWeight:800,color:c.sub,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:8}}>💰 Услуги</div>
                  <div style={{display:'flex',flexDirection:'column',gap:8}}>
                    {openGuestChannel.priceList.map((item:any,i:number)=>(
                      <div key={i} style={{borderRadius:12,background:c.card,border:`1px solid ${c.border}`,padding:'10px 12px',display:'flex',alignItems:'center',gap:10}}>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:13,fontWeight:700,color:c.light}}>{item.name}</div>
                          {item.desc&&<div style={{fontSize:11,color:c.sub,marginTop:2}}>{item.desc}</div>}
                        </div>
                        {item.price&&<div style={{fontSize:14,fontWeight:900,color:ac,flexShrink:0}}>{item.price}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Посты канала */}
              <div style={{padding:'12px 14px 80px',borderTop:`1px solid ${c.border}`}}>
                <div style={{fontSize:11,fontWeight:800,color:c.sub,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:10}}>📝 Публикации</div>
                {Array.isArray(openGuestChannel.posts)&&openGuestChannel.posts.length>0?(
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {[...openGuestChannel.posts].reverse().map((p:any)=>(
                      <div key={p.id} style={{borderRadius:16,overflow:'hidden',background:c.card,border:`1px solid ${c.border}`}}>
                        {/* Шапка поста */}
                        <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px 6px'}}>
                          <div style={{width:28,height:28,borderRadius:8,overflow:'hidden',flexShrink:0,
                            background:openGuestChannel.coverGradient||ac+'44',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>
                            {openGuestChannel.avatarPhotoUrl?<img src={openGuestChannel.avatarPhotoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span>{openGuestChannel.vibe||'📡'}</span>}
                          </div>
                          <div>
                            <div style={{fontSize:11,fontWeight:800,color:c.light}}>{openGuestChannel.name}</div>
                            <div style={{fontSize:9,color:c.sub}}>{new Date(p.createdAt).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</div>
                          </div>
                          {p.isPinned&&<span style={{marginLeft:'auto',fontSize:10,color:ac}}>📌</span>}
                          {p.rubric&&<span style={{marginLeft:'auto',fontSize:9,color:ac,background:ac+'18',padding:'1px 6px',borderRadius:20}}>{p.rubric}</span>}
                        </div>
                        {/* Контент */}
                        {p.imageUrl&&<img src={p.imageUrl} alt="" style={{width:'100%',maxHeight:320,objectFit:'cover',display:'block'}}/>}
                        {p.text&&<div style={{padding:'6px 12px',fontSize:13,color:c.mid,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{p.text}</div>}
                        {/* Poll */}
                        {p.pollQuestion&&(
                          <div style={{padding:'6px 12px 10px'}}>
                            <div style={{fontSize:13,fontWeight:700,color:c.light,marginBottom:6}}>📊 {p.pollQuestion}</div>
                            {p.pollOptions?.map((opt:any,i:number)=>(
                              <div key={i} style={{marginBottom:4,borderRadius:8,background:c.cardAlt,border:`1px solid ${c.border}`,padding:'6px 10px',fontSize:12,color:c.mid}}>
                                {opt.text} · {opt.votes} гол.
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Реакции */}
                        {p.reactions&&(Object.values(p.reactions) as number[]).some(v=>v>0)&&(
                          <div style={{display:'flex',gap:8,padding:'4px 12px 10px'}}>
                            {[['🔥',p.reactions.fire],['🚀',p.reactions.rocket],['💎',p.reactions.gem],['❤️',p.reactions.heart],['🤔',p.reactions.think]].filter(([,v])=>Number(v)>0).map(([e,v])=>(
                              <span key={String(e)} style={{fontSize:11,color:c.sub,background:c.cardAlt,borderRadius:20,padding:'2px 7px'}}>{e} {v}</span>
                            ))}
                            {p.views>0&&<span style={{fontSize:10,color:c.sub,marginLeft:'auto'}}>👁 {p.views}</span>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ):(
                  <div style={{textAlign:'center',color:c.sub,fontSize:13,paddingTop:40,opacity:0.7}}>Публикаций пока нет</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Полный просмотр группы (гость) ── */}
        <AnimatePresence>
          {openGuestGroup&&(
            <motion.div key="ggrp" initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring',damping:30,stiffness:260}}
              style={{position:'absolute',inset:0,background:c.deep,display:'flex',flexDirection:'column',zIndex:50,overflowY:'auto'}}>
              {/* Шапка группы */}
              <div style={{flexShrink:0,position:'relative'}}>
                <div style={{height:120,background:openGuestGroup.gradient||`linear-gradient(135deg,${openGuestGroup.color||ac}44,#0a0a14)`,overflow:'hidden'}}>
                  <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,transparent 20%,rgba(0,0,0,0.75))'}}/>
                  <motion.button whileTap={{scale:0.9}} onClick={()=>setOpenGuestGroup(null)}
                    style={{position:'absolute',top:12,left:12,width:36,height:36,borderRadius:12,background:'rgba(0,0,0,0.5)',
                      border:'1px solid rgba(255,255,255,0.2)',color:'#fff',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)'}}>←</motion.button>
                </div>
                <div style={{padding:'0 14px 14px',marginTop:-40,position:'relative'}}>
                  <div style={{display:'flex',alignItems:'flex-end',gap:12}}>
                    <div style={{width:60,height:60,borderRadius:16,flexShrink:0,
                      background:`linear-gradient(135deg,${openGuestGroup.color||ac}44,${openGuestGroup.color||ac}22)`,
                      border:`3px solid ${c.deep}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>
                      <span>{openGuestGroup.emoji||'👥'}</span>
                    </div>
                    <div style={{flex:1,paddingBottom:4}}>
                      <span style={{fontSize:16,fontWeight:900,color:'#fff'}}>{openGuestGroup.name}</span>
                      {openGuestGroup.handle&&<div style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontFamily:'monospace'}}>@{openGuestGroup.handle}</div>}
                    </div>
                  </div>
                  {openGuestGroup.description&&<div style={{marginTop:8,fontSize:13,color:'rgba(255,255,255,0.7)',lineHeight:1.5}}>{openGuestGroup.description}</div>}
                  <div style={{display:'flex',gap:14,marginTop:10}}>
                    <div style={{textAlign:'center'}}>
                      <div style={{fontSize:15,fontWeight:900,color:'#fff'}}>{openGuestGroup.memberCount||0}</div>
                      <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',letterSpacing:'0.06em'}}>УЧАСТНИКИ</div>
                    </div>
                    {openGuestGroup.streak>0&&<div style={{textAlign:'center'}}>
                      <div style={{fontSize:15,fontWeight:900,color:'#f97316'}}>🔥 {openGuestGroup.streak}</div>
                      <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',letterSpacing:'0.06em'}}>ДНЕЙ СТРИК</div>
                    </div>}
                    {openGuestGroup.todayMood&&<div style={{textAlign:'center'}}>
                      <div style={{fontSize:22}}>{openGuestGroup.todayMood}</div>
                      <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',letterSpacing:'0.06em'}}>НАСТРОЕНИЕ</div>
                    </div>}
                  </div>
                  {openGuestGroup.wordOfDay&&<div style={{marginTop:10,padding:'8px 12px',borderRadius:12,background:`${openGuestGroup.color||ac}18`,border:`1px solid ${openGuestGroup.color||ac}33`,fontSize:12,color:'rgba(255,255,255,0.8)'}}>💬 Слово дня: <strong>{openGuestGroup.wordOfDay}</strong></div>}
                </div>
              </div>
              {/* Посты группы */}
              <div style={{padding:'12px 14px 80px',borderTop:`1px solid ${c.border}`}}>
                <div style={{fontSize:11,fontWeight:800,color:c.sub,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:10}}>🗨 Обсуждения</div>
                {Array.isArray(openGuestGroup.posts)&&openGuestGroup.posts.length>0?(
                  <div style={{display:'flex',flexDirection:'column',gap:10}}>
                    {[...openGuestGroup.posts].reverse().map((p:any)=>(
                      <div key={p.id} style={{borderRadius:16,overflow:'hidden',background:c.card,border:`1px solid ${c.border}`}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px 6px'}}>
                          <div style={{width:28,height:28,borderRadius:'50%',overflow:'hidden',flexShrink:0,background:openGuestGroup.color||ac+'44',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>
                            {p.authorAvatar?<img src={p.authorAvatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span>👤</span>}
                          </div>
                          <div>
                            <div style={{fontSize:11,fontWeight:700,color:c.light}}>{p.isAnon?'Анонимно':p.authorName}</div>
                            <div style={{fontSize:9,color:c.sub}}>{new Date(p.createdAt).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</div>
                          </div>
                          {p.type&&p.type!=='text'&&<span style={{marginLeft:'auto',fontSize:9,color:c.sub,background:c.cardAlt,borderRadius:20,padding:'1px 6px'}}>{p.type}</span>}
                        </div>
                        {p.imageUrl&&<img src={p.imageUrl} alt="" style={{width:'100%',maxHeight:280,objectFit:'cover',display:'block'}}/>}
                        {p.text&&<div style={{padding:'4px 12px 8px',fontSize:13,color:c.mid,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{p.text}</div>}
                        {p.pollQuestion&&(
                          <div style={{padding:'4px 12px 10px'}}>
                            <div style={{fontSize:13,fontWeight:700,color:c.light,marginBottom:5}}>📊 {p.pollQuestion}</div>
                            {p.pollOptions?.map((opt:any,i:number)=>(
                              <div key={i} style={{marginBottom:4,borderRadius:8,background:c.cardAlt,padding:'5px 10px',fontSize:12,color:c.mid}}>{opt.text} · {opt.votes} гол.</div>
                            ))}
                          </div>
                        )}
                        <div style={{display:'flex',gap:12,padding:'4px 12px 8px'}}>
                          {p.likes>0&&<span style={{fontSize:11,color:c.sub}}>❤️ {p.likes}</span>}
                          {p.comments?.length>0&&<span style={{fontSize:11,color:c.sub}}>💬 {p.comments.length}</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ):(
                  <div style={{textAlign:'center',color:c.sub,fontSize:13,paddingTop:40,opacity:0.7}}>Публикаций пока нет</div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── CommentsSheet для постов гостевого профиля ── */}
        <AnimatePresence>
          {commentPostId&&(
            <CommentsSheet postId={commentPostId} session={getSessionToken()||''} authorHash={hash} authorName={name} authorNick={profNick} authorAvatar={avatarSrc} apiBase={apiBase} c={c} accent={ac} onClose={()=>setCommentPostId(null)} onCountChange={(id,cnt)=>setPosts(prev=>prev.map(p=>p.id===id?{...p,comments:cnt}:p))} onOpenProfile={h=>{setProfileViewHash(h);setCommentPostId(null);}}/>
          )}
        </AnimatePresence>

        {/* ── Модальное окно виджета ── */}
        <AnimatePresence>
          {widgetModal&&(
            <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',damping:30,stiffness:260}}
              style={{position:'absolute',inset:0,background:c.card,display:'flex',flexDirection:'column',zIndex:30}}>
              <div style={{display:'flex',alignItems:'center',gap:12,padding:'18px 16px 12px',borderBottom:`1px solid ${c.border}`,flexShrink:0}}>
                <motion.button whileTap={{scale:0.9}} onClick={()=>setWidgetModal(null)} style={{background:'none',border:'none',cursor:'pointer',fontSize:22,color:c.mid,padding:0,lineHeight:1}}>←</motion.button>
                <span style={{fontSize:15,fontWeight:800,color:c.light}}>
                  {widgetModal==='_vizitka'?'Видео-визитка':wLabel(widgetModal,WIDGET_LIST.find(w=>w.key===widgetModal)?.label||'')}
                </span>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'14px 12px 40px'}}>
                {/* ВИДЕО-ВИЗИТКА */}
                {widgetModal==='_vizitka'&&vizitkaUrl&&<video src={vizitkaUrl} controls playsInline autoPlay style={{width:'100%',maxWidth:400,borderRadius:16,background:'#000'}}/>}
                {/* РАБОТЫ */}
                {widgetModal==='works'&&(works.length>0?<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  {works.map(w=>(
                    <div key={w.id} style={{borderRadius:16,overflow:'hidden',background:c.cardAlt,border:`1px solid ${c.border}`}}>
                      {w.imageUrl?<img src={w.imageUrl} alt={w.title} style={{width:'100%',aspectRatio:'1/1',objectFit:'cover',display:'block'}}/>
                        :<div style={{width:'100%',aspectRatio:'1/1',background:c.card,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>🎨</div>}
                      <div style={{padding:'10px'}}>
                        <div style={{fontSize:13,fontWeight:800,color:c.light,marginBottom:3}}>{w.title}</div>
                        {w.desc&&<div style={{fontSize:11,color:c.sub,lineHeight:1.4}}>{w.desc.slice(0,80)}{w.desc.length>80?'…':''}</div>}
                      </div>
                    </div>
                  ))}
                </div>:<div style={{textAlign:'center',color:c.sub,paddingTop:40,fontSize:13}}>Работы ещё не добавлены</div>)}
                {/* ОТЗЫВЫ */}
                {widgetModal==='reviews'&&(reviews.length>0?<div style={{display:'flex',flexDirection:'column',gap:12}}>
                  {reviews.map(r=>(
                    <div key={r.id} style={{borderRadius:16,overflow:'hidden',background:c.cardAlt,border:`1px solid ${c.border}`}}>
                      {r.imageUrl&&<img src={r.imageUrl} alt="" style={{width:'100%',display:'block',objectFit:'contain',maxHeight:260}}/>}
                      {r.caption&&<div style={{padding:'10px 12px',fontSize:13,color:c.mid,lineHeight:1.5}}>{r.caption}</div>}
                      {r.date&&<div style={{padding:'0 12px 10px',fontSize:10,color:c.sub}}>{r.date}</div>}
                    </div>
                  ))}
                </div>:<div style={{textAlign:'center',color:c.sub,paddingTop:40,fontSize:13}}>Отзывов пока нет</div>)}
                {/* ЗАПИСАТЬСЯ */}
                {widgetModal==='booking'&&(priceItems.length>0?<div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {priceItems.map(item=>(
                    <div key={item.id} style={{borderRadius:16,overflow:'hidden',background:c.cardAlt,border:`1px solid ${c.border}`}}>
                      <div style={{display:'flex'}}>
                        {item.photo&&<img src={item.photo} alt={item.name} style={{width:90,objectFit:'cover',flexShrink:0}}/>}
                        <div style={{padding:'12px',flex:1,minWidth:0}}>
                          <div style={{fontSize:14,fontWeight:800,color:c.light}}>{item.name}</div>
                          {item.desc&&<div style={{fontSize:12,color:c.sub,marginTop:3,lineHeight:1.4}}>{item.desc}</div>}
                          <div style={{fontSize:16,fontWeight:900,color:ac,marginTop:6}}>{item.price}{item.unit?` / ${item.unit}`:''}</div>
                          {bookingItem?.id!==item.id&&bkStatus!=='done'&&(
                            <motion.button whileTap={{scale:0.95}} onClick={()=>{setBookingItem(item);setBkName('');setBkPhone('');setBkStatus('idle');setBkError('');}} style={{marginTop:8,padding:'8px 16px',borderRadius:10,background:ac,border:'none',color:'#fff',fontWeight:800,fontSize:12,cursor:'pointer'}}>Записаться</motion.button>
                          )}
                        </div>
                      </div>
                      {bookingItem?.id===item.id&&(
                        bkStatus==='done'?(
                          <div style={{padding:'12px 16px 14px',textAlign:'center',fontSize:13,color:'#6ee7b7',fontWeight:700}}>✅ Заявка отправлена! Хозяин профиля свяжется с вами.</div>
                        ):(
                          <div style={{padding:'4px 14px 14px',display:'flex',flexDirection:'column',gap:8}}>
                            <input value={bkName} onChange={e=>setBkName(e.target.value)} placeholder="Ваше имя *"
                              style={{padding:'10px 14px',borderRadius:10,background:c.bg,border:`1px solid ${c.border}`,color:c.light,fontSize:13,outline:'none'}}/>
                            <input value={bkPhone} onChange={e=>setBkPhone(e.target.value)} placeholder="Телефон *" type="tel"
                              style={{padding:'10px 14px',borderRadius:10,background:c.bg,border:`1px solid ${c.border}`,color:c.light,fontSize:13,outline:'none'}}/>
                            {bkError&&<div style={{fontSize:12,color:'#f87171'}}>{bkError}</div>}
                            <div style={{display:'flex',gap:8}}>
                              <motion.button whileTap={{scale:0.96}} onClick={()=>submitBooking(item)} disabled={bkStatus==='sending'}
                                style={{flex:1,padding:'10px',borderRadius:10,background:ac,border:'none',color:'#fff',fontWeight:800,fontSize:13,cursor:'pointer',opacity:bkStatus==='sending'?0.6:1}}>
                                {bkStatus==='sending'?'Отправка…':'✅ Отправить заявку'}
                              </motion.button>
                              <motion.button whileTap={{scale:0.96}} onClick={()=>setBookingItem(null)}
                                style={{padding:'10px 16px',borderRadius:10,background:c.cardAlt,border:`1px solid ${c.border}`,color:c.mid,fontWeight:700,fontSize:13,cursor:'pointer'}}>
                                Отмена
                              </motion.button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ))}
                </div>:<div style={{textAlign:'center',color:c.sub,paddingTop:40,fontSize:13}}>Нет доступных услуг</div>)}
                {/* ПРАЙС */}
                {widgetModal==='prices'&&(priceItems.length>0?<div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {priceItems.map(item=>(
                    <div key={item.id} style={{borderRadius:16,overflow:'hidden',background:c.cardAlt,border:`1px solid ${c.border}`,display:'flex'}}>
                      {item.photo&&<img src={item.photo} alt={item.name} style={{width:90,objectFit:'cover',flexShrink:0}}/>}
                      <div style={{padding:'12px',flex:1,minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:800,color:c.light}}>{item.name}</div>
                        {item.desc&&<div style={{fontSize:12,color:c.sub,marginTop:3,lineHeight:1.4}}>{item.desc}</div>}
                        <div style={{fontSize:16,fontWeight:900,color:ac,marginTop:6}}>{item.price}{item.unit?` / ${item.unit}`:''}</div>
                      </div>
                    </div>
                  ))}
                </div>:<div style={{textAlign:'center',color:c.sub,paddingTop:40,fontSize:13}}>Прайс не заполнен</div>)}
                {/* ДИПЛОМЫ */}
                {widgetModal==='certs'&&(certs.length>0?<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                  {certs.map(cert=>(
                    <div key={cert.id} style={{borderRadius:16,overflow:'hidden',background:c.cardAlt,border:`1px solid ${c.border}`}}>
                      {cert.imageUrl&&<img src={cert.imageUrl} alt={cert.title} style={{width:'100%',aspectRatio:'4/3',objectFit:'cover',display:'block'}}/>}
                      {cert.title&&<div style={{padding:'8px 10px',fontSize:12,fontWeight:700,color:c.light,textAlign:'center'}}>{cert.title}</div>}
                    </div>
                  ))}
                </div>:<div style={{textAlign:'center',color:c.sub,paddingTop:40,fontSize:13}}>Дипломов пока нет</div>)}
                {/* КЕЙСЫ */}
                {widgetModal==='cases'&&(cases.length>0?<div style={{display:'flex',flexDirection:'column',gap:14}}>
                  {cases.map(cs=>(
                    <div key={cs.id} style={{borderRadius:16,overflow:'hidden',background:c.cardAlt,border:`1px solid ${c.border}`}}>
                      {cs.imageUrl&&<img src={cs.imageUrl} alt={cs.title} style={{width:'100%',display:'block',objectFit:'cover',maxHeight:220}}/>}
                      <div style={{padding:'12px'}}>
                        <div style={{fontSize:14,fontWeight:900,color:c.light,marginBottom:5}}>{cs.title}</div>
                        {cs.desc&&<div style={{fontSize:12,color:c.mid,lineHeight:1.5,marginBottom:6}}>{cs.desc}</div>}
                        {cs.result&&<div style={{fontSize:12,color:ac,fontWeight:700,background:ac+'18',borderRadius:8,padding:'6px 10px'}}>✅ {cs.result}</div>}
                      </div>
                    </div>
                  ))}
                </div>:<div style={{textAlign:'center',color:c.sub,paddingTop:40,fontSize:13}}>Кейсов пока нет</div>)}
                {/* FAQ */}
                {widgetModal==='faqs'&&(faqs.length>0?<div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {faqs.map(f=>(
                    <details key={f.id} style={{borderRadius:14,overflow:'hidden',background:c.cardAlt,border:`1px solid ${c.border}`}}>
                      <summary style={{padding:'14px 16px',fontSize:14,fontWeight:700,color:c.light,cursor:'pointer',listStyle:'none',display:'flex',justifyContent:'space-between',alignItems:'center',gap:10}}>
                        <span>{f.q}</span><span style={{color:c.sub,fontSize:16,flexShrink:0}}>›</span>
                      </summary>
                      <div style={{padding:'0 16px 14px',fontSize:13,color:c.mid,lineHeight:1.6,borderTop:`1px solid ${c.border}`}}>{f.a}</div>
                    </details>
                  ))}
                </div>:<div style={{textAlign:'center',color:c.sub,paddingTop:40,fontSize:13}}>FAQ не заполнен</div>)}
                {/* ССЫЛКИ */}
                {widgetModal==='links'&&(links.length>0?<div style={{display:'flex',flexDirection:'column',gap:10}}>
                  {links.map((lnk:any,i:number)=>(
                    <a key={i} href={lnk.url||lnk.href||'#'} target="_blank" rel="noopener noreferrer"
                      style={{display:'flex',alignItems:'center',gap:12,borderRadius:14,background:c.cardAlt,border:`1px solid ${c.border}`,padding:'12px 16px',textDecoration:'none'}}>
                      <span style={{fontSize:22}}>{lnk.icon||'🔗'}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:800,color:c.light,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{lnk.label||lnk.title||lnk.url}</div>
                        {lnk.desc&&<div style={{fontSize:11,color:c.sub,marginTop:2}}>{lnk.desc}</div>}
                      </div>
                      <span style={{fontSize:12,color:ac,flexShrink:0}}>→</span>
                    </a>
                  ))}
                </div>:<div style={{textAlign:'center',color:c.sub,paddingTop:40,fontSize:13}}>Ссылок пока нет</div>)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
}

/* ══ CommentsSheet ══ */
type Cmt={id:string;authorHash:string;authorName:string;authorNick?:string;authorAvatar:string;authorMode:string;text:string;audioUrl?:string;ts:string;likesCount:number;myLike:boolean;replies:{id:string;authorHash:string;authorName:string;authorNick?:string;authorAvatar:string;text:string;ts:string;likesCount:number;myLike:boolean}[]};
function CommentsSheet({postId,session,authorHash,authorName,authorNick,authorAvatar,apiBase,c,accent,onClose,onCountChange,onOpenProfile}:{postId:string;session:string;authorHash:string;authorName:string;authorNick?:string;authorAvatar:string;apiBase:string;c:Pal;accent:string;onClose:()=>void;onCountChange:(postId:string,count:number)=>void;onOpenProfile?:(hash:string)=>void;}){
  const ac=accent||'#60a5fa';
  const [cmts,setCmts]=useState<Cmt[]>([]);
  const [loading,setLoading]=useState(true);
  const [text,setText]=useState('');
  const [sending,setSending]=useState(false);
  const inputRef=useRef<HTMLInputElement>(null);
  useEffect(()=>{
    setLoading(true);
    fetch(`${apiBase}/api/interactions/${postId}?session=${encodeURIComponent(session)}`)
      .then(r=>r.json()).then(d=>{setCmts(d.comments||[]);}).catch(()=>{}).finally(()=>setLoading(false));
  },[postId]);
  const sendComment=async()=>{
    if(!text.trim()||sending)return;
    setSending(true);
    try{
      const r=await fetch(`${apiBase}/api/interactions/${postId}/comment`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session,authorHash,authorName,authorNick:authorNick||'',authorAvatar,text:text.trim()})});
      if(r.ok){const d=await r.json();setCmts(d.comments||[]);onCountChange(postId,(d.comments||[]).length);setText('');}
    }finally{setSending(false);}
  };
  return(
    <div style={{position:'fixed',inset:0,zIndex:9999,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
      <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.55)',backdropFilter:'blur(5px)'}} onClick={onClose}/>
      <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',damping:32,stiffness:280}}
        style={{position:'relative',background:c.card,borderRadius:'22px 22px 0 0',maxHeight:'82vh',display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 -4px 40px rgba(0,0,0,0.35)'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 20px 12px',borderBottom:`1px solid ${c.border}`}}>
          <span style={{fontSize:15,fontWeight:800,color:c.light}}>Комментарии {cmts.length>0&&<span style={{fontSize:12,fontWeight:600,color:c.sub}}>({cmts.length})</span>}</span>
          <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',fontSize:22,color:c.sub,lineHeight:1,padding:'0 4px'}}>×</button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:'12px 16px'}}>
          {loading&&<div style={{textAlign:'center',padding:'40px 0',color:c.sub,fontSize:13}}>Загрузка…</div>}
          {!loading&&cmts.length===0&&<div style={{textAlign:'center',padding:'40px 0',color:c.sub,fontSize:13}}>Пока нет комментариев. Будьте первым! 💬</div>}
          {cmts.map(cm=>(
            <div key={cm.id} style={{display:'flex',gap:10,marginBottom:14}}>
              <div onClick={()=>cm.authorHash&&onOpenProfile&&onOpenProfile(cm.authorHash)}
                style={{width:34,height:34,borderRadius:'50%',overflow:'hidden',flexShrink:0,border:`1.5px solid ${ac}44`,background:c.cardAlt,display:'flex',alignItems:'center',justifyContent:'center',cursor:cm.authorHash&&onOpenProfile?'pointer':'default'}}>
                {cm.authorAvatar?<img src={cm.authorAvatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:14}}>👤</span>}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:'flex',alignItems:'baseline',gap:5,marginBottom:3,flexWrap:'wrap'}}>
                  <span onClick={()=>cm.authorHash&&onOpenProfile&&onOpenProfile(cm.authorHash)}
                    style={{fontSize:12,fontWeight:800,color:c.light,cursor:cm.authorHash&&onOpenProfile?'pointer':'default'}}>{cm.authorName||'Участник SWAIP'}</span>
                  {cm.authorNick&&<span onClick={()=>cm.authorHash&&onOpenProfile&&onOpenProfile(cm.authorHash)}
                    style={{fontSize:10,color:ac,fontFamily:'monospace',cursor:cm.authorHash&&onOpenProfile?'pointer':'default'}}>@{cm.authorNick}</span>}
                  <span style={{fontSize:10,color:c.sub}}>{cm.ts}</span>
                </div>
                <div style={{fontSize:13,color:c.mid,lineHeight:1.55,wordBreak:'break-word'}}>{cm.text}</div>
                <div style={{marginTop:5}}>
                  <motion.button whileTap={{scale:0.88}} onClick={async()=>{
                    const r=await fetch(`${apiBase}/api/interactions/${postId}/comment/${cm.id}/like`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session})});
                    if(r.ok){const d=await r.json();setCmts(prev=>prev.map(x=>x.id===cm.id?{...x,likesCount:d.likesCount,myLike:d.myLike}:x));}
                  }} style={{background:'none',border:'none',cursor:'pointer',fontSize:11,fontWeight:700,color:cm.myLike?ac:c.sub,display:'flex',alignItems:'center',gap:3,padding:0}}>
                    {cm.myLike?'❤️':'🤍'}{cm.likesCount>0?<span style={{marginLeft:2}}>{cm.likesCount}</span>:null}
                  </motion.button>
                </div>
                {cm.replies.length>0&&<div style={{marginTop:8,paddingLeft:8,borderLeft:`2px solid ${c.border}`}}>
                  {cm.replies.map(r=>(
                    <div key={r.id} style={{display:'flex',gap:7,marginBottom:8}}>
                      <div style={{width:24,height:24,borderRadius:'50%',overflow:'hidden',flexShrink:0,background:c.cardAlt,display:'flex',alignItems:'center',justifyContent:'center'}}>
                        {r.authorAvatar?<img src={r.authorAvatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:11}}>👤</span>}
                      </div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'baseline',gap:5,marginBottom:2,flexWrap:'wrap'}}>
                          <span onClick={()=>r.authorHash&&onOpenProfile&&onOpenProfile(r.authorHash)}
                            style={{fontSize:11,fontWeight:800,color:c.light,cursor:r.authorHash&&onOpenProfile?'pointer':'default'}}>{r.authorName||'Участник SWAIP'}</span>
                          {r.authorNick&&<span style={{fontSize:9,color:ac,fontFamily:'monospace'}}>@{r.authorNick}</span>}
                          <span style={{fontSize:9,color:c.sub}}>{r.ts}</span>
                        </div>
                        <div style={{fontSize:12,color:c.mid,lineHeight:1.5,wordBreak:'break-word'}}>{r.text}</div>
                      </div>
                    </div>
                  ))}
                </div>}
              </div>
            </div>
          ))}
        </div>
        <div style={{padding:'10px 14px 14px',borderTop:`1px solid ${c.border}`,display:'flex',gap:9,alignItems:'center',background:c.card}}>
          <div style={{width:32,height:32,borderRadius:'50%',overflow:'hidden',flexShrink:0,border:`1.5px solid ${ac}44`,background:c.cardAlt,display:'flex',alignItems:'center',justifyContent:'center'}}>
            {authorAvatar?<img src={authorAvatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:14}}>👤</span>}
          </div>
          <div style={{flex:1,background:c.cardAlt,borderRadius:20,border:`1px solid ${c.border}`,display:'flex',alignItems:'center',padding:'8px 14px',gap:8}}>
            <input ref={inputRef} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&sendComment()}
              placeholder="Написать комментарий…"
              style={{flex:1,background:'none',border:'none',outline:'none',color:c.light,fontSize:13,fontFamily:'"Montserrat",sans-serif'}}/>
            <motion.button whileTap={{scale:0.9}} onClick={sendComment} disabled={!text.trim()||sending}
              style={{background:text.trim()?ac:c.border,border:'none',borderRadius:'50%',width:30,height:30,cursor:text.trim()?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,transition:'background 0.2s',color:'#fff',fontSize:16,fontWeight:900}}>
              ↑
            </motion.button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function rawToPost(b:any):Post{
  return {
    id:String(b.id),
    text:b.content||'',
    img:b.imageUrl||undefined,
    videoUrl:b.videoUrl||undefined,
    audioUrl:b.audioUrl||undefined,
    docUrls:b.docUrls||undefined,
    likes:(b.reactions||[]).reduce((s:number,r:any)=>s+(r.count||0),0),
    liked:(b.myReactions||[]).length>0,
    comments:b.commentCount||0,
    ts:b.createdAt?fmtTsGlobal(b.createdAt):'только что',
    ...(b.hasBooking?{hasBooking:true,bookingLabel:b.bookingLabel||'Записаться',bookingSlots:Array.isArray(b.bookingSlots)?b.bookingSlots:[]}:{}),
    ...(b.poll?{poll:b.poll}:{}),
    ...(b.myVote!==undefined?{myVote:b.myVote}:{}),
    ...(b.quoteOf?{quoteOf:b.quoteOf}:{}),
    ...(b.repostOf?{repostOf:b.repostOf}:{}),
    ...(b.coAuthorData?{coAuthorData:b.coAuthorData}:{}),
    ...(b.isAnonVoting?{isAnonVoting:true}:{}),
    ...(b.publishAt?{publishAt:b.publishAt}:{}),
    ...(b.expiresAt?{expiresAt:b.expiresAt}:{}),
    ...(b.location?{location:b.location}:{}),
    ...(b.bgMusicUrl?{bgMusicUrl:b.bgMusicUrl,bgMusicLabel:b.bgMusicLabel||''}:{}),
  };
}

function PostCard({p,name,avatarSrc,onLike,onComment,onBook,onUpdate,onNewPost,isOwner,c,accent,style=1}:{p:Post;name:string;avatarSrc:string;onLike:(id:string)=>void;onComment?:(id:string)=>void;onBook?:(id:string,time?:string)=>void;onUpdate?:(updated:Post)=>void;onNewPost?:(raw:any)=>void;isOwner?:boolean;c:Pal;accent?:string;style?:number}){
  const bgMusicAutoplayEl=p.bgMusicUrl?<BgMusicAutoplay url={p.bgMusicUrl} postId={p.id} label={p.bgMusicLabel||''}/>:null;
  const ac=accent||'#60a5fa';
  const [lb,setLb]=useState(false);
  const [docViewer,setDocViewer]=useState<{url:string;name:string;mime:string}|null>(null);
  const [bookedTime,setBookedTime]=useState<string|null>(null);
  const [showPostChat,setShowPostChat]=useState(false);
  /* ── Меню / Редактирование / Опрос / Цитата / Репост / Доп.действия ── */
  const [showMenu,setShowMenu]=useState(false);
  const [editing,setEditing]=useState(false);
  const [editText,setEditText]=useState(p.text);
  const [editSaving,setEditSaving]=useState(false);
  const [showQuoteSheet,setShowQuoteSheet]=useState(false);
  const [quoteCaption,setQuoteCaption]=useState('');
  const [quoteSending,setQuoteSending]=useState(false);
  const [showRepostSheet,setShowRepostSheet]=useState(false);
  const [repostSending,setRepostSending]=useState(false);
  const [repostDone,setRepostDone]=useState(false);
  const [localPoll,setLocalPoll]=useState<Poll|null>(p.poll||null);
  const [localMyVote,setLocalMyVote]=useState<string|null>(p.myVote||null);
  const [localText,setLocalText]=useState(p.text);
  /* Доп. состояния */
  const [pinned,setPinned]=useState(()=>{ try{const k=`swaip_pinned_${p.id}`;return localStorage.getItem(k)==='1';}catch{return false;}});
  const [bookmarked,setBookmarked]=useState(()=>{ try{const k=`swaip_bm_${p.id}`;return localStorage.getItem(k)==='1';}catch{return false;}});
  const [showThread,setShowThread]=useState(false);
  const [threadReplies,setThreadReplies]=useState<Post[]>([]);
  const [threadText,setThreadText]=useState('');
  const [threadSending,setThreadSending]=useState(false);
  const [threadLoaded,setThreadLoaded]=useState(false);
  const [commentsOff,setCommentsOff]=useState(false);
  const [showStats,setShowStats]=useState(false);
  const [showPromote,setShowPromote]=useState(false);
  const [deleted,setDeleted]=useState(false);
  const [archived,setArchived]=useState(false);
  const [toast,setToast]=useState<string|null>(null);
  const [deleting,setDeleting]=useState(false);
  const showToast=(msg:string)=>{setToast(msg);setTimeout(()=>setToast(null),2200);};
  const handlePin=()=>{const next=!pinned;setPinned(next);try{next?localStorage.setItem(`swaip_pinned_${p.id}`,'1'):localStorage.removeItem(`swaip_pinned_${p.id}`);}catch{}setShowMenu(false);showToast(next?'📌 Пост закреплён':'📌 Пост откреплён');};
  const handleBookmark=()=>{
    const next=!bookmarked;setBookmarked(next);
    try{next?localStorage.setItem(`swaip_bm_${p.id}`,'1'):localStorage.removeItem(`swaip_bm_${p.id}`);}catch{}
    setShowMenu(false);showToast(next?'🔖 Добавлено в закладки':'🔖 Убрано из закладок');
    const numId=parseInt(p.id);if(!isNaN(numId)){fetch(`${window.location.origin}/api/bookmarks/${numId}`,{method:'POST',headers:{'x-session-token':getSessionToken()||''}}).catch(()=>null);}
  };
  const loadThreadReplies=async()=>{
    const numId=parseInt(p.id);if(isNaN(numId))return;
    try{
      const r=await fetch(`${window.location.origin}/api/broadcasts/${numId}/replies`,{headers:{'x-session-token':getSessionToken()||''}});
      if(r.ok){const data=await r.json();setThreadReplies(data.map((b:any)=>rawToPost(b)));}
    }catch{}
    setThreadLoaded(true);
  };
  const handleOpenThread=async()=>{
    const next=!showThread;setShowThread(next);
    if(next&&!threadLoaded)await loadThreadReplies();
  };
  const handleSendThread=async()=>{
    if(!threadText.trim())return;
    const numId=parseInt(p.id);if(isNaN(numId))return;
    setThreadSending(true);
    try{
      const r=await fetch(`${window.location.origin}/api/broadcasts`,{method:'POST',headers:{'Content-Type':'application/json','x-session-token':getSessionToken()||''},body:JSON.stringify({content:threadText.trim(),authorMode:'pro',parentId:numId})});
      if(r.ok){const d=await r.json();setThreadReplies(prev=>[...prev,rawToPost(d)]);setThreadText('');showToast('🧵 Ответ добавлен в тред');}
    }catch{}
    setThreadSending(false);
  };
  const handleCopyLink=()=>{const url=`${window.location.origin}/?post=${p.id}`;try{navigator.clipboard.writeText(url);}catch{}setShowMenu(false);showToast('🔗 Ссылка скопирована');};
  const handleCommentsToggle=()=>{setCommentsOff(v=>!v);setShowMenu(false);showToast(commentsOff?'💬 Комментарии включены':'💬 Комментарии отключены');};
  const handleArchive=()=>{setArchived(true);setShowMenu(false);showToast('📦 Пост архивирован');};
  const handleDelete=async()=>{
    if(!window.confirm('Удалить пост? Это действие нельзя отменить.'))return;
    setDeleting(true);setShowMenu(false);
    const numId=parseInt(p.id);
    if(!isNaN(numId)){await fetch(`${window.location.origin}/api/broadcasts/${numId}`,{method:'DELETE',headers:{'x-session-token':getSessionToken()||''}}).catch(()=>null);}
    setDeleted(true);setDeleting(false);
  };
  const handleVote=async(optionId:string)=>{
    const numId=parseInt(p.id);if(isNaN(numId))return;
    const r=await fetch(`${window.location.origin}/api/broadcasts/${numId}/poll-vote`,{method:'POST',headers:{'Content-Type':'application/json','x-session-token':getSessionToken()||''},body:JSON.stringify({optionId})}).catch(()=>null);
    if(r?.ok){const d=await r.json();setLocalPoll(d.poll);setLocalMyVote(d.myVote);}
  };
  const handleSaveEdit=async()=>{
    const numId=parseInt(p.id);if(isNaN(numId)||!editText.trim())return;
    setEditSaving(true);
    const r=await fetch(`${window.location.origin}/api/broadcasts/${numId}`,{method:'PUT',headers:{'Content-Type':'application/json','x-session-token':getSessionToken()||''},body:JSON.stringify({content:editText.trim()})}).catch(()=>null);
    setEditSaving(false);
    if(r?.ok){setLocalText(editText.trim());setEditing(false);onUpdate?.({...p,text:editText.trim()});}
  };
  const handleRepost=async()=>{
    setRepostSending(true);
    const snap:QuoteSnap={id:p.id,authorName:name,authorAvatar:avatarSrc,text:(localText||p.text).slice(0,150),ts:p.ts};
    const r=await fetch(`${window.location.origin}/api/broadcasts`,{method:'POST',headers:{'Content-Type':'application/json','x-session-token':getSessionToken()||''},body:JSON.stringify({content:'🔁 Репост',authorMode:'pro',repostOf:snap})}).catch(()=>null);
    setRepostSending(false);
    if(r?.ok){setRepostDone(true);const d=await r.json();onNewPost?.(d);setTimeout(()=>setShowRepostSheet(false),1200);}
  };
  const handleSendQuote=async()=>{
    if(!quoteCaption.trim())return;setQuoteSending(true);
    const snap:QuoteSnap={id:p.id,authorName:name,authorAvatar:avatarSrc,text:(localText||p.text).slice(0,150),ts:p.ts};
    const r=await fetch(`${window.location.origin}/api/broadcasts`,{method:'POST',headers:{'Content-Type':'application/json','x-session-token':getSessionToken()||''},body:JSON.stringify({content:quoteCaption.trim(),authorMode:'pro',quoteOf:snap})}).catch(()=>null);
    setQuoteSending(false);
    if(r?.ok){const d=await r.json();onNewPost?.(d);setShowQuoteSheet(false);setQuoteCaption('');}
  };
  const [postChatMsgs,setPostChatMsgs]=useState<{role:'bot'|'user';text:string}[]>([]);
  const [postChatInput,setPostChatInput]=useState('');
  const [postChatStep,setPostChatStep]=useState<'chat'|'confirm'|'done'>('chat');
  const [postChatSlot,setPostChatSlot]=useState('');
  const [postChatName,setPostChatName]=useState('');
  const [postChatPhone,setPostChatPhone]=useState('');
  const postBotName=typeof window!=='undefined'?(()=>{try{return localStorage.getItem('sw_ai_name')||'Алина';}catch{return'Алина';}})():'Алина';
  const postSpeak=useCallback((text:string)=>{
    if(!('speechSynthesis' in window))return;
    window.speechSynthesis.cancel();
    const clean=text.replace(/[^\u0020-\u007E\u00A0-\u024F\u0400-\u04FF\s]/g,'').trim();
    const utt=new SpeechSynthesisUtterance(clean);
    utt.lang='ru-RU';utt.rate=0.92;utt.pitch=1.05;
    const vs=window.speechSynthesis.getVoices();
    const rv=vs.find(v=>v.lang.startsWith('ru'));if(rv)utt.voice=rv;
    window.speechSynthesis.speak(utt);
  },[]);
  const openPostChat=(preSlot?:string)=>{
    const avail=(p.bookingSlots||[]).filter(s=>!s.booked).map(s=>s.time);
    const tg=getTimeOfDay();
    const botTpl=BOT_SCRIPTS[Math.floor(Math.random()*BOT_SCRIPTS.length)];
    const greeting=botTpl.gr(tg,postBotName)+(avail.length>0
      ?`\n\nВот свободные окошки:\n${avail.map(s=>'📅 '+formatSlotRu(s)).join('\n')}\n\nВыберите удобное время — и всё оформлю!`
      :'\n\nК сожалению, свободных слотов сейчас нет 😔\nСвяжитесь напрямую с владельцем!');
    setPostChatMsgs([{role:'bot',text:greeting}]);
    setPostChatStep('chat');
    setPostChatSlot(preSlot||'');
    setPostChatName('');setPostChatPhone('');setPostChatInput('');
    setShowPostChat(true);
    postSpeak(`${tg}! Я ${postBotName}. Выберите удобное время для записи!`);
  };

  const handleShare=async()=>{
    const text=p.text||'';
    const shareData={title:name,text:text.length>120?text.slice(0,120)+'…':text,url:window.location.href};
    if(navigator.share){try{await navigator.share(shareData);return;}catch{}}
    try{await navigator.clipboard.writeText(`${name}: ${text}\n${window.location.href}`);}catch{}
  };

  /* ── Закреплено ── */
  const pinnedEl=pinned?(
    <div style={{display:'flex',alignItems:'center',gap:6,padding:'5px 12px',background:`rgba(255,255,255,0.04)`,borderBottom:`1px solid ${c.border}`}}>
      <span style={{fontSize:12}}>📌</span>
      <span style={{fontSize:11,fontWeight:700,color:c.sub}}>Закреплённый пост</span>
    </div>
  ):null;

  /* ── Опрос ── */
  const pollEl=localPoll?(
    <div style={{background:'rgba(99,102,241,0.07)',border:'1px solid rgba(99,102,241,0.22)',borderRadius:16,padding:'14px',margin:'4px 0 8px'}}>
      <div style={{fontSize:14,fontWeight:800,color:c.light,marginBottom:12}}>{localPoll.question}</div>
      {localPoll.options.map(opt=>{
        const pct=localPoll.totalVotes>0?Math.round((opt.votes/localPoll.totalVotes)*100):0;
        const voted=localMyVote===opt.id;
        return(
          <motion.button key={opt.id} whileTap={{scale:0.97}} onClick={()=>handleVote(opt.id)}
            style={{width:'100%',marginBottom:8,background:'none',border:`1.5px solid ${voted?ac+'88':'rgba(255,255,255,0.1)'}`,borderRadius:10,padding:'9px 12px',cursor:'pointer',position:'relative',overflow:'hidden',textAlign:'left',display:'block'}}>
            <div style={{position:'absolute',left:0,top:0,bottom:0,width:`${localMyVote?pct:0}%`,background:voted?`${ac}22`:'rgba(255,255,255,0.04)',transition:'width 0.5s ease',borderRadius:9}}/>
            <div style={{position:'relative',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:13,fontWeight:700,color:voted?ac:c.mid}}>{voted?'✅ ':''}{opt.text}</span>
              {localMyVote&&<span style={{fontSize:12,fontWeight:800,color:voted?ac:c.sub}}>{pct}%</span>}
            </div>
          </motion.button>
        );
      })}
      <div style={{fontSize:11,color:c.sub,marginTop:4}}>{localPoll.totalVotes} {localPoll.totalVotes===1?'голос':localPoll.totalVotes<5?'голоса':'голосов'}{localMyVote?' · вы проголосовали':' · нажмите для голосования'}</div>
    </div>
  ):null;

  /* ── Цитата (когда пост цитирует другой) ── */
  const quoteEl=p.quoteOf?(
    <div style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${c.border}`,borderLeft:`3px solid ${ac}`,borderRadius:12,padding:'8px 12px',margin:'4px 0 8px'}}>
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
        <div style={{width:16,height:16,borderRadius:'50%',overflow:'hidden',flexShrink:0}}>
          {p.quoteOf.authorAvatar?<img src={p.quoteOf.authorAvatar} style={{width:'100%',height:'100%',objectFit:'cover'}} alt=""/>:<span style={{fontSize:10}}>👤</span>}
        </div>
        <span style={{fontSize:11,fontWeight:800,color:ac}}>{p.quoteOf.authorName}</span>
        <span style={{fontSize:10,color:c.sub}}>· {p.quoteOf.ts}</span>
      </div>
      <div style={{fontSize:12,color:c.mid,lineHeight:1.5,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:3,WebkitBoxOrient:'vertical'}}>{p.quoteOf.text}</div>
    </div>
  ):null;

  /* ── Репост (когда пост является репостом) ── */
  const repostEl=p.repostOf?(
    <div style={{marginBottom:2}}>
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:6}}>
        <span style={{fontSize:13}}>🔁</span>
        <span style={{fontSize:11,color:c.sub}}>Репост от <span style={{color:ac,fontWeight:700}}>{p.repostOf.authorName}</span></span>
      </div>
      <div style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${c.border}`,borderLeft:`3px solid ${ac}55`,borderRadius:12,padding:'8px 12px'}}>
        <div style={{fontSize:12,color:c.mid,lineHeight:1.5}}>{p.repostOf.text}</div>
      </div>
    </div>
  ):null;

  /* Скрываем пост если удалён или архивирован */
  if(deleted||archived)return null as any;

  /* ── Три точки меню ── */
  const menuBtn=(
    <button style={{background:'none',border:'none',color:c.sub,fontSize:18,cursor:'pointer',padding:'0 4px',lineHeight:1}} onClick={e=>{e.stopPropagation();setShowMenu(v=>!v);}}>⋯</button>
  );

  type MenuItem={ico:string;lbl:string;fn:()=>void;red?:boolean;hide?:boolean};
  const ownerItems:MenuItem[]=[
    {ico:'📈',lbl:'Статистика',fn:()=>{setShowStats(true);setShowMenu(false);}},
    {ico:pinned?'📍':'📌',lbl:pinned?'Открепить':'Закрепить',fn:handlePin},
    {ico:'✏️',lbl:'Редактировать',fn:()=>{setEditing(true);setEditText(localText||p.text);setShowMenu(false);}},
    {ico:commentsOff?'💬':'🚫',lbl:commentsOff?'Включить комментарии':'Отключить комментарии',fn:handleCommentsToggle},
    {ico:bookmarked?'🔖':'🔖',lbl:bookmarked?'Убрать из закладок':'Сохранить в закладках',fn:handleBookmark},
    {ico:'🔗',lbl:'Скопировать ссылку',fn:handleCopyLink},
    {ico:'💬',lbl:'Процитировать',fn:()=>{setShowQuoteSheet(true);setShowMenu(false);}},
    {ico:'🔁',lbl:'Репостнуть',fn:()=>{setShowRepostSheet(true);setShowMenu(false);}},
    {ico:'📢',lbl:'Продвигать',fn:()=>{setShowPromote(true);setShowMenu(false);}},
    {ico:'📦',lbl:'Архивировать',fn:handleArchive},
    {ico:'🗑️',lbl:'Удалить',fn:handleDelete,red:true},
  ];
  const guestItems:MenuItem[]=[
    {ico:'💬',lbl:'Процитировать',fn:()=>{setShowQuoteSheet(true);setShowMenu(false);}},
    {ico:'🔁',lbl:'Репостнуть',fn:()=>{setShowRepostSheet(true);setShowMenu(false);}},
    {ico:bookmarked?'🔖':'🔖',lbl:bookmarked?'Убрать из закладок':'Сохранить в закладках',fn:handleBookmark},
    {ico:'🔗',lbl:'Скопировать ссылку',fn:handleCopyLink},
  ];
  const menuItems=isOwner?ownerItems:guestItems;

  const menuEl=showMenu?(
    <>
      <div onClick={()=>setShowMenu(false)} style={{position:'fixed',inset:0,zIndex:7000}}/>
      <motion.div initial={{opacity:0,scale:0.92,y:-8}} animate={{opacity:1,scale:1,y:0}} transition={{duration:0.15}}
        style={{position:'absolute',top:32,right:0,zIndex:7001,background:'rgba(18,18,30,0.98)',backdropFilter:'blur(20px)',
          border:`1px solid ${c.border}`,borderRadius:18,boxShadow:'0 12px 40px rgba(0,0,0,0.7)',minWidth:220,overflow:'hidden'}}>
        {menuItems.map((item,i)=>(
          <button key={i} onClick={item.fn}
            style={{width:'100%',padding:'13px 18px',background:'none',border:'none',
              borderBottom:i<menuItems.length-1?`1px solid rgba(255,255,255,0.05)`:'none',
              color:item.red?'#f87171':c.mid,fontSize:13,fontWeight:700,cursor:'pointer',
              textAlign:'left',display:'flex',alignItems:'center',gap:12,fontFamily:'"Montserrat",sans-serif',
              transition:'background 0.12s'}}
            onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,0.05)')}
            onMouseLeave={e=>(e.currentTarget.style.background='none')}>
            <span style={{fontSize:16,width:20,textAlign:'center'}}>{item.ico}</span>
            {item.lbl}
          </button>
        ))}
      </motion.div>
    </>
  ):null;

  /* ── Тост-уведомление ── */
  const toastEl=toast?(
    <motion.div initial={{opacity:0,y:20,scale:0.92}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0}}
      style={{position:'fixed',bottom:90,left:'50%',transform:'translateX(-50%)',zIndex:9999,
        background:'rgba(20,20,35,0.96)',backdropFilter:'blur(12px)',border:`1px solid ${c.border}`,
        borderRadius:50,padding:'10px 22px',fontSize:13,fontWeight:700,color:c.light,
        boxShadow:'0 4px 20px rgba(0,0,0,0.5)',whiteSpace:'nowrap',pointerEvents:'none'}}>
      {toast}
    </motion.div>
  ):null;

  /* ── Статистика ── */
  const statsEl=showStats?(
    <AnimatePresence>
      <motion.div key="stbg" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setShowStats(false)}
        style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(8px)',zIndex:7500}}/>
      <motion.div key="stwin" initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',stiffness:290,damping:30}}
        style={{position:'fixed',bottom:0,left:0,right:0,zIndex:7501,background:'#0d0d18',borderRadius:'24px 24px 0 0',border:`1px solid ${c.border}`,padding:'20px 16px 40px'}}>
        <div style={{width:40,height:4,borderRadius:2,background:'rgba(255,255,255,0.15)',margin:'0 auto 20px'}}/>
        <div style={{fontSize:16,fontWeight:800,color:c.light,marginBottom:20,fontFamily:'"Montserrat",sans-serif'}}>📈 Статистика поста</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {[
            {ico:'❤️',lbl:'Лайки',val:p.likes},
            {ico:'💬',lbl:'Комментарии',val:p.comments},
            {ico:'👀',lbl:'Просмотры',val:Math.max(p.likes*12+p.comments*5,1)},
            {ico:'🔁',lbl:'Репосты',val:Math.max(Math.floor(p.likes*0.08),0)},
            {ico:'🔗',lbl:'Переходы',val:Math.max(Math.floor(p.likes*0.15),0)},
            {ico:'🔖',lbl:'Закладки',val:Math.max(Math.floor(p.likes*0.05),0)},
          ].map(s=>(
            <div key={s.lbl} style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${c.border}`,borderRadius:14,padding:'14px 16px',textAlign:'center'}}>
              <div style={{fontSize:24,marginBottom:4}}>{s.ico}</div>
              <div style={{fontSize:22,fontWeight:900,color:c.light,fontFamily:'"Montserrat",sans-serif'}}>{s.val.toLocaleString('ru')}</div>
              <div style={{fontSize:11,color:c.sub,fontWeight:600,marginTop:2}}>{s.lbl}</div>
            </div>
          ))}
        </div>
        <div style={{marginTop:16,padding:'12px 16px',background:'rgba(99,102,241,0.08)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:12}}>
          <div style={{fontSize:12,color:'#a5b4fc',fontWeight:700}}>💡 Совет</div>
          <div style={{fontSize:12,color:c.sub,marginTop:4,lineHeight:1.5}}>Публикуйте в 18–21:00 для максимального охвата вашей аудитории</div>
        </div>
      </motion.div>
    </AnimatePresence>
  ):null;

  /* ── Продвижение ── */
  const promoteEl=showPromote?(
    <AnimatePresence>
      <motion.div key="prbg" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setShowPromote(false)}
        style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(8px)',zIndex:7500}}/>
      <motion.div key="prwin" initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',stiffness:290,damping:30}}
        style={{position:'fixed',bottom:0,left:0,right:0,zIndex:7501,background:'#0d0d18',borderRadius:'24px 24px 0 0',border:`1px solid ${c.border}`,padding:'20px 16px 40px'}}>
        <div style={{width:40,height:4,borderRadius:2,background:'rgba(255,255,255,0.15)',margin:'0 auto 20px'}}/>
        <div style={{fontSize:16,fontWeight:800,color:c.light,marginBottom:6,fontFamily:'"Montserrat",sans-serif'}}>📢 Продвигать пост</div>
        <div style={{fontSize:13,color:c.sub,marginBottom:24}}>Увеличьте охват аудитории</div>
        {[
          {ico:'🚀',name:'Старт',price:'99 ₽',reach:'~500–1 000',days:'3 дня'},
          {ico:'⚡',name:'Буст',price:'299 ₽',reach:'~2 000–5 000',days:'7 дней'},
          {ico:'💎',name:'Премиум',price:'899 ₽',reach:'~10 000–25 000',days:'14 дней'},
        ].map(plan=>(
          <motion.button key={plan.name} whileTap={{scale:0.97}}
            style={{width:'100%',marginBottom:10,padding:'14px 16px',background:'rgba(255,255,255,0.04)',
              border:`1.5px solid ${c.border}`,borderRadius:16,cursor:'pointer',
              display:'flex',alignItems:'center',gap:14,textAlign:'left'}}
            onClick={()=>{showToast(`${plan.ico} Скоро будет доступно!`);setShowPromote(false);}}>
            <span style={{fontSize:28}}>{plan.ico}</span>
            <div style={{flex:1}}>
              <div style={{fontSize:14,fontWeight:800,color:c.light}}>{plan.name}</div>
              <div style={{fontSize:11,color:c.sub}}>Охват {plan.reach} · {plan.days}</div>
            </div>
            <div style={{fontSize:15,fontWeight:900,color:ac}}>{plan.price}</div>
          </motion.button>
        ))}
      </motion.div>
    </AnimatePresence>
  ):null;

  /* ── Тред ── */
  const threadEl=showThread?(
    <div style={{borderTop:`1px solid ${c.border}`,padding:'12px 14px 8px',background:'rgba(255,255,255,0.02)'}}>
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:10}}>
        <span style={{fontSize:14}}>🧵</span>
        <span style={{fontSize:12,fontWeight:800,color:ac,fontFamily:'"Montserrat",sans-serif'}}>Тред</span>
        <span style={{fontSize:11,color:c.sub,marginLeft:2}}>{threadReplies.length} {threadReplies.length===1?'ответ':threadReplies.length<5?'ответа':'ответов'}</span>
      </div>
      {threadReplies.length===0&&threadLoaded&&(
        <div style={{fontSize:12,color:c.sub,textAlign:'center',padding:'8px 0 4px',fontFamily:'"Montserrat",sans-serif'}}>Пока нет ответов. Будь первым!</div>
      )}
      {threadReplies.map((reply,i)=>(
        <div key={reply.id} style={{display:'flex',gap:8,marginBottom:8,alignItems:'flex-start'}}>
          <div style={{width:28,height:28,borderRadius:'50%',background:ac+'22',border:`1.5px solid ${ac}44`,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13}}>👤</div>
          <div style={{flex:1}}>
            <div style={{background:'rgba(255,255,255,0.06)',border:`1px solid ${c.border}`,borderRadius:14,padding:'8px 12px'}}>
              <div style={{fontSize:13,color:c.mid,lineHeight:1.5,fontFamily:'"Montserrat",sans-serif'}}>{reply.text}</div>
            </div>
            <div style={{fontSize:10,color:c.sub,marginTop:3,paddingLeft:4}}>{reply.ts}</div>
          </div>
        </div>
      ))}
      <div style={{display:'flex',gap:8,alignItems:'center',marginTop:6}}>
        <input value={threadText} onChange={e=>setThreadText(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();handleSendThread();}}}
          placeholder="Ответить в тред…"
          style={{flex:1,background:'rgba(255,255,255,0.07)',border:`1px solid ${c.border}`,borderRadius:20,padding:'8px 14px',color:c.light,fontSize:13,outline:'none',fontFamily:'"Montserrat",sans-serif'}}/>
        <motion.button whileTap={{scale:0.88}} onClick={handleSendThread} disabled={!threadText.trim()||threadSending}
          style={{background:threadText.trim()?ac:'rgba(255,255,255,0.1)',border:'none',borderRadius:'50%',width:34,height:34,cursor:threadText.trim()?'pointer':'default',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,transition:'background 0.2s',flexShrink:0,color:'#fff',opacity:threadSending?0.5:1}}>
          {threadSending?'…':'↑'}
        </motion.button>
      </div>
    </div>
  ):null;

  /* ── Модал редактирования ── */
  const editEl=editing?(
    <AnimatePresence>
      <motion.div key="editbg" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setEditing(false)}
        style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(8px)',zIndex:7500}}/>
      <motion.div key="editwin" initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',stiffness:290,damping:30}}
        style={{position:'fixed',bottom:0,left:0,right:0,zIndex:7501,background:'#0d0d18',borderRadius:'24px 24px 0 0',border:`1px solid ${c.border}`,padding:'20px 16px 32px'}}>
        <div style={{width:40,height:4,borderRadius:2,background:'rgba(255,255,255,0.15)',margin:'0 auto 20px'}}/>
        <div style={{fontSize:16,fontWeight:800,color:c.light,marginBottom:14,fontFamily:'"Montserrat",sans-serif'}}>✏️ Редактировать пост</div>
        <textarea value={editText} onChange={e=>setEditText(e.target.value)} rows={5}
          style={{width:'100%',boxSizing:'border-box',background:'rgba(255,255,255,0.06)',border:`1px solid ${c.border}`,borderRadius:12,padding:'12px',color:c.light,fontSize:14,resize:'vertical',outline:'none',fontFamily:'"Montserrat",sans-serif',lineHeight:1.55}}/>
        <div style={{display:'flex',gap:10,marginTop:12}}>
          <motion.button whileTap={{scale:0.95}} onClick={()=>setEditing(false)}
            style={{flex:1,padding:'12px',background:'rgba(255,255,255,0.06)',border:`1px solid ${c.border}`,borderRadius:12,color:c.sub,fontSize:13,fontWeight:700,cursor:'pointer'}}>
            Отмена
          </motion.button>
          <motion.button whileTap={{scale:0.95}} onClick={handleSaveEdit} disabled={editSaving||!editText.trim()}
            style={{flex:2,padding:'12px',background:`linear-gradient(135deg,${ac},${ac}aa)`,border:'none',borderRadius:12,color:'#fff',fontSize:13,fontWeight:900,cursor:'pointer'}}>
            {editSaving?'Сохранение…':'💾 Сохранить'}
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  ):null;

  /* ── Лист цитирования ── */
  const quoteSheetEl=showQuoteSheet?(
    <AnimatePresence>
      <motion.div key="qbg" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setShowQuoteSheet(false)}
        style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(8px)',zIndex:7500}}/>
      <motion.div key="qwin" initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',stiffness:290,damping:30}}
        style={{position:'fixed',bottom:0,left:0,right:0,zIndex:7501,background:'#0d0d18',borderRadius:'24px 24px 0 0',border:`1px solid ${c.border}`,padding:'20px 16px 32px'}}>
        <div style={{width:40,height:4,borderRadius:2,background:'rgba(255,255,255,0.15)',margin:'0 auto 20px'}}/>
        <div style={{fontSize:16,fontWeight:800,color:c.light,marginBottom:14,fontFamily:'"Montserrat",sans-serif'}}>💬 Процитировать пост</div>
        <div style={{background:'rgba(255,255,255,0.04)',border:`1px solid ${c.border}`,borderLeft:`3px solid ${ac}`,borderRadius:12,padding:'8px 12px',marginBottom:12}}>
          <div style={{fontSize:11,fontWeight:700,color:ac,marginBottom:4}}>{name}</div>
          <div style={{fontSize:12,color:c.mid,lineHeight:1.5}}>{(localText||p.text).slice(0,120)}{(localText||p.text).length>120?'…':''}</div>
        </div>
        <textarea value={quoteCaption} onChange={e=>setQuoteCaption(e.target.value)} placeholder="Ваш комментарий к цитате…" rows={4}
          style={{width:'100%',boxSizing:'border-box',background:'rgba(255,255,255,0.06)',border:`1px solid ${c.border}`,borderRadius:12,padding:'12px',color:c.light,fontSize:14,resize:'none',outline:'none',fontFamily:'"Montserrat",sans-serif',lineHeight:1.55}}/>
        <div style={{display:'flex',gap:10,marginTop:12}}>
          <motion.button whileTap={{scale:0.95}} onClick={()=>setShowQuoteSheet(false)}
            style={{flex:1,padding:'12px',background:'rgba(255,255,255,0.06)',border:`1px solid ${c.border}`,borderRadius:12,color:c.sub,fontSize:13,fontWeight:700,cursor:'pointer'}}>
            Отмена
          </motion.button>
          <motion.button whileTap={{scale:0.95}} onClick={handleSendQuote} disabled={quoteSending||!quoteCaption.trim()}
            style={{flex:2,padding:'12px',background:`linear-gradient(135deg,${ac},${ac}aa)`,border:'none',borderRadius:12,color:'#fff',fontSize:13,fontWeight:900,cursor:'pointer'}}>
            {quoteSending?'Публикация…':'📤 Опубликовать'}
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  ):null;

  /* ── Лист репоста ── */
  const repostSheetEl=showRepostSheet?(
    <AnimatePresence>
      <motion.div key="rbg" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setShowRepostSheet(false)}
        style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(8px)',zIndex:7500}}/>
      <motion.div key="rwin" initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',stiffness:290,damping:30}}
        style={{position:'fixed',bottom:0,left:0,right:0,zIndex:7501,background:'#0d0d18',borderRadius:'24px 24px 0 0',border:`1px solid ${c.border}`,padding:'20px 16px 32px'}}>
        <div style={{width:40,height:4,borderRadius:2,background:'rgba(255,255,255,0.15)',margin:'0 auto 20px'}}/>
        <div style={{fontSize:16,fontWeight:800,color:c.light,marginBottom:6,fontFamily:'"Montserrat",sans-serif'}}>🔁 Репостнуть</div>
        <div style={{fontSize:12,color:c.sub,marginBottom:16}}>Выберите куда репостнуть</div>
        {repostDone?(
          <div style={{textAlign:'center',padding:'20px 0'}}>
            <div style={{fontSize:36,marginBottom:8}}>✅</div>
            <div style={{fontSize:15,fontWeight:800,color:'#4ade80'}}>Репост опубликован!</div>
          </div>
        ):(
          <motion.button whileTap={{scale:0.96}} onClick={handleRepost} disabled={repostSending}
            style={{width:'100%',padding:'16px',background:'rgba(255,255,255,0.06)',border:`1.5px solid ${c.border}`,borderRadius:16,cursor:'pointer',display:'flex',alignItems:'center',gap:14,marginBottom:10}}>
            <div style={{width:44,height:44,borderRadius:12,background:`${ac}22`,border:`1px solid ${ac}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>👤</div>
            <div style={{textAlign:'left'}}>
              <div style={{fontSize:14,fontWeight:800,color:c.light}}>{name}</div>
              <div style={{fontSize:12,color:c.sub}}>Мой профиль</div>
            </div>
            <span style={{marginLeft:'auto',fontSize:13,color:ac,fontWeight:700}}>{repostSending?'…':'→'}</span>
          </motion.button>
        )}
      </motion.div>
    </AnimatePresence>
  ):null;

  /* ── Соавтор, таймер, геолокация, анонимность ── */
  const coAuthorBadge=p.coAuthorData?(
    <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:5}}>
      <div style={{width:18,height:18,borderRadius:'50%',overflow:'hidden',border:`1.5px solid ${ac}55`,flexShrink:0,background:'rgba(255,255,255,0.06)'}}>
        {p.coAuthorData.avatar?<img src={p.coAuthorData.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={(e:any)=>{(e.target as HTMLImageElement).style.display='none';}}/>:<span style={{fontSize:9,color:'#fff'}}>👤</span>}
      </div>
      <span style={{fontSize:10,color:c.sub,fontFamily:'"Montserrat",sans-serif',fontWeight:600}}>🤝&nbsp;и&nbsp;<span style={{color:ac,fontWeight:800}}>{p.coAuthorData.name}</span></span>
    </div>
  ):null;
  const nowMs=Date.now();
  const expiresMs=p.expiresAt?new Date(p.expiresAt).getTime():null;
  const publishMs=p.publishAt?new Date(p.publishAt).getTime():null;
  const timeLeftMs=expiresMs&&expiresMs>nowMs?expiresMs-nowMs:null;
  const isPending=publishMs&&publishMs>nowMs;
  const fmtLeft=(ms:number)=>{const h=Math.floor(ms/3600000);const m=Math.floor((ms%3600000)/60000);return h>0?`${h}ч ${m}м`:`${m}м`;};
  const timerBadge=(timeLeftMs||isPending)?(
    <span style={{display:'inline-flex',alignItems:'center',gap:4,background:'rgba(251,191,36,0.12)',border:'1px solid rgba(251,191,36,0.32)',borderRadius:8,padding:'3px 8px',marginRight:6,marginBottom:5,fontSize:10,color:'#fbbf24',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>
      ⏰&nbsp;{timeLeftMs?`Исчезает через ${fmtLeft(timeLeftMs)}`:`Запланировано`}
    </span>
  ):null;
  const geoBadge=p.location?.city?(
    <span style={{display:'inline-flex',alignItems:'center',gap:3,background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.28)',borderRadius:8,padding:'3px 8px',marginRight:6,marginBottom:5,fontSize:10,color:'#4ade80',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>
      📍&nbsp;{p.location.city}
    </span>
  ):null;
  const anonBadge=p.isAnonVoting?(
    <span style={{display:'inline-flex',alignItems:'center',gap:3,background:'rgba(139,92,246,0.1)',border:'1px solid rgba(139,92,246,0.28)',borderRadius:8,padding:'3px 8px',marginRight:6,marginBottom:5,fontSize:10,color:'#c4b5fd',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>
      🕵️&nbsp;Анонимное голосование
    </span>
  ):null;
  const metaBadgesEl=(coAuthorBadge||timerBadge||geoBadge||anonBadge)?(
    <div style={{display:'flex',flexWrap:'wrap',alignItems:'center',gap:2,margin:'4px 0 2px'}}>
      {coAuthorBadge}{timerBadge}{geoBadge}{anonBadge}
    </div>
  ):null;

  /* Превью фото в ленте — полное, без обрезки, но ограничено по высоте */
  const imgFeed=p.img?(
    <div style={{width:'100%',background:c.deep,cursor:'pointer',overflow:'hidden'}} onClick={()=>setLb(true)}>
      <img src={p.img} alt="" style={{width:'100%',height:'auto',maxHeight:270,display:'block',objectFit:'contain'}}
        onError={e=>{(e.target as HTMLImageElement).parentElement!.style.display='none';}}/>
    </div>
  ):null;

  /* Видео в ленте */
  const videoSrc=p.videoUrl?(p.videoUrl.startsWith('http')||p.videoUrl.startsWith('blob')?p.videoUrl:`${window.location.origin}${p.videoUrl}`):null;
  const selfieFrameId=p.text?.startsWith('🎥:')?p.text.replace('🎥:','').split('\n')[0].trim():null;
  const videoEl=videoSrc?(
    selfieFrameId?(
      <div style={{width:'100%',display:'flex',justifyContent:'center',padding:'8px 0',background:'#111'}}>
        <SelfieFrameWrapper frameId={selfieFrameId}>
          <video src={videoSrc} controls playsInline preload="metadata"
            style={{width:'100%',height:'100%',objectFit:'cover',background:'#000'}}
            onError={e=>{(e.target as HTMLVideoElement).parentElement!.style.display='none';}}/>
        </SelfieFrameWrapper>
      </div>
    ):(
      <div style={{width:'100%',background:'#000',borderRadius:0,overflow:'hidden'}}>
        <video src={videoSrc} controls playsInline preload="metadata"
          style={{width:'100%',maxHeight:320,display:'block',objectFit:'contain',background:'#000'}}
          onError={e=>{(e.target as HTMLVideoElement).parentElement!.style.display='none';}}/>
      </div>
    )
  ):null;

  /* Аудио/музыка в ленте */
  const audioSrc=p.audioUrl?(p.audioUrl.startsWith('http')||p.audioUrl.startsWith('blob')?p.audioUrl:`${window.location.origin}${p.audioUrl}`):null;
  const audioEl=audioSrc?(
    <AudioWavePlayer src={audioSrc} accent={ac}/>
  ):null;

  /* Документы в ленте */
  const docEl=p.docUrls&&p.docUrls.length?(
    <div style={{display:'flex',flexDirection:'column',gap:4,padding:'4px 8px'}}>
      {p.docUrls.map((d,i)=>{
        const ext=(d.name.split('.').pop()||'').toLowerCase();
        const ico=ext==='pdf'?'📕':['doc','docx','odt','rtf'].includes(ext)?'📘':['xls','xlsx','csv'].includes(ext)?'📗':['ppt','pptx'].includes(ext)?'📙':ext==='txt'?'📄':'📎';
        const size=d.size>1024*1024?`${(d.size/1024/1024).toFixed(1)} МБ`:d.size>1024?`${Math.round(d.size/1024)} КБ`:`${d.size} Б`;
        return(
          <button key={i} onClick={()=>setDocViewer({url:d.url,name:d.name,mime:d.mime})}
            style={{display:'flex',alignItems:'center',gap:8,background:`${c.cardAlt}`,borderRadius:8,padding:'6px 10px',border:`1px solid ${c.border}`,width:'100%',cursor:'pointer',textAlign:'left'}}>
            <span style={{fontSize:20,flexShrink:0}}>{ico}</span>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:700,color:c.light,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.name}</div>
              <div style={{fontSize:10,color:c.sub}}>{size}</div>
            </div>
            <span style={{fontSize:13,color:ac,flexShrink:0}}>👁</span>
          </button>
        );
      })}
    </div>
  ):null;

  /* Лайтбокс — полноэкранный просмотр */
  const lbEl=lb?(
    <div onClick={()=>setLb(false)} style={{position:'fixed',inset:0,zIndex:9900,background:'rgba(0,0,0,0.97)',display:'flex',alignItems:'center',justifyContent:'center',padding:12}}>
      <button onClick={e=>{e.stopPropagation();setLb(false);}} style={{position:'absolute',top:16,right:16,width:38,height:38,borderRadius:'50%',background:'rgba(255,255,255,0.12)',border:'1px solid rgba(255,255,255,0.25)',color:'#fff',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1}}>✕</button>
      <img src={p.img} alt="" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain',borderRadius:6}}/>
    </div>
  ):null;

  /* ── Блок «Записаться» — стиль прайс-листа, чат Алины ── */
  const slots=p.bookingSlots||[];
  const fmtSlotShort=(s:string)=>{try{const r=formatSlotRu(s);return r.split(',')[1]?.trim()||r;}catch{return s;}};
  const bookEl=p.hasBooking?(
    <motion.div style={{background:'linear-gradient(135deg,rgba(29,78,216,0.13),rgba(124,58,237,0.09))',
      border:'1px solid rgba(99,102,241,0.28)',borderRadius:18,padding:'14px',margin:'4px 0 8px'}}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:slots.length>0&&!bookedTime?10:0}}>
        <div style={{flex:1}}>
          <div style={{fontSize:14,fontWeight:800,color:'#fff'}}>{p.bookingLabel||'Записаться'}</div>
          {slots.length>0&&<div style={{fontSize:11,color:'rgba(255,255,255,0.45)',marginTop:2}}>
            {slots.filter(s=>!s.booked).length} слот{slots.filter(s=>!s.booked).length===1?'':'ов'} свободно · {postBotName} ответит
          </div>}
        </div>
        {!bookedTime&&(
          <motion.div whileTap={{scale:0.93}} onClick={()=>openPostChat()}
            style={{background:'linear-gradient(135deg,#1d4ed8,#7c3aed)',borderRadius:10,
              padding:'8px 14px',fontSize:12,fontWeight:800,color:'#fff',cursor:'pointer',flexShrink:0}}>
            Записаться →
          </motion.div>
        )}
      </div>
      {slots.length>0&&!bookedTime&&(
        <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
          {slots.slice(0,3).map(s=>(
            <div key={s.time} onClick={()=>{if(s.booked)return;openPostChat(s.time);}}
              style={{background:s.booked?'rgba(239,68,68,0.1)':'rgba(34,197,94,0.1)',
                border:`1px solid ${s.booked?'rgba(239,68,68,0.25)':'rgba(34,197,94,0.25)'}`,
                borderRadius:8,padding:'4px 10px',fontSize:11,fontWeight:600,
                color:s.booked?'#f87171':'#4ade80',cursor:s.booked?'default':'pointer'}}>
              📅 {s.booked?'🔒 ':''}{fmtSlotShort(s.time)}
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
          <div style={{fontSize:11,color:'rgba(255,255,255,0.45)'}}>{bookedTime!=='✓'?fmtSlotShort(bookedTime):''}</div>
        </motion.div>
      )}
    </motion.div>
  ):null;

  /* ── Чат Алины — запись из поста ── */
  const avail=(p.bookingSlots||[]).filter(s=>!s.booked).map(s=>s.time);
  const handlePostChatMsg=(text:string)=>{
    const msgs=[...postChatMsgs,{role:'user' as const,text}];
    setPostChatMsgs(msgs);setPostChatInput('');
    setTimeout(()=>{
      let reply='';let speech='';
      if(postChatStep==='chat'){
        const lower=text.toLowerCase();
        const matched=avail.find(s=>{const t=s.split(' ')[1];return text.includes(t)||formatSlotRu(s).toLowerCase().split(' ').some(w=>lower.includes(w)&&w.length>2);})||
          avail.find(s=>lower.includes(s.split(' ')[1]?.split(':')[0]||''));
        if(matched){
          setPostChatSlot(matched);setPostChatStep('confirm');
          reply=`Отлично, ${fmtSlotShort(matched)} — свободно! 🎉\n\nКак вас зовут?`;
          speech=`Отлично! ${fmtSlotShort(matched)} свободно. Как вас зовут?`;
        }else if(avail.length===0){
          reply='К сожалению, все слоты заняты 😔\nСвяжитесь с владельцем напрямую!';
          speech='Все слоты заняты.';
        }else{
          reply=`Не нашла такое время 🙈\n\nВот что есть:\n${avail.map(s=>'📅 '+formatSlotRu(s)).join('\n')}\n\nВыберите любое! 😊`;
          speech='Не нашла такое время. Выберите один из доступных слотов.';
        }
      }else if(postChatStep==='confirm'){
        if(!postChatName){
          setPostChatName(text.trim());
          reply=`${text.trim()}, приятно познакомиться! 😊\n\nТеперь укажите телефон для связи 📱`;
          speech=`${text.trim()}, приятно познакомиться! Укажите телефон.`;
        }else if(!postChatPhone){
          setPostChatPhone(text.trim());
          setPostChatStep('done');
          const slot=postChatSlot;
          reply=`Всё готово! 🎉\n\n👤 ${postChatName}\n📅 ${fmtSlotShort(slot)}\n📱 ${text.trim()}\n\nЖдём вас! — ${postBotName}`;
          speech=`Замечательно! Запись подтверждена. Ждём вас!`;
          setBookedTime(slot||'✓');
          setShowPostChat(false);
          onBook?.(p.id,slot||'✓');
          window.dispatchEvent(new CustomEvent('sw-new-booking',{detail:{name:postChatName,phone:text.trim(),slot}}));
          postSpeak(speech);return;
        }
      }
      if(reply){setPostChatMsgs(m=>[...m,{role:'bot',text:reply}]);postSpeak(speech||reply.replace(/[📅😊🎉📱👇🌟🙈😔]/g,''));}
    },600);
  };
  const postChatEl=showPostChat?(
    <AnimatePresence>
      <motion.div key="pcbg" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
        onClick={()=>setShowPostChat(false)}
        style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',backdropFilter:'blur(10px)',zIndex:5000}}/>
      <motion.div key="pcwin" initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
        transition={{type:'spring',stiffness:290,damping:30}}
        style={{position:'fixed',bottom:0,left:0,right:0,zIndex:5001,
          background:'linear-gradient(180deg,#0a0d14,#070a10)',
          borderRadius:'28px 28px 0 0',border:'1px solid rgba(99,102,241,0.25)',
          height:'88vh',display:'flex',flexDirection:'column'}}>
        {/* Шапка */}
        <div style={{padding:'18px 18px 14px',borderBottom:'1px solid rgba(255,255,255,0.07)',
          display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
          <div style={{width:42,height:42,borderRadius:'50%',background:'linear-gradient(135deg,#1d4ed8,#7c3aed)',
            display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:800,color:'#fff',flexShrink:0}}>
            {postBotName[0]?.toUpperCase()||'А'}
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:14,fontWeight:800,color:'#fff',fontFamily:'"Montserrat",sans-serif'}}>{postBotName}</div>
            <div style={{fontSize:10,color:'rgba(99,102,241,0.8)',fontFamily:'"Montserrat",sans-serif'}}>
              {postChatStep==='done'?'✅ Запись подтверждена':`📋 ${p.bookingLabel||'Запись'} · онлайн`}
            </div>
          </div>
          <motion.button whileTap={{scale:0.9}} onClick={()=>setShowPostChat(false)}
            style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',
              borderRadius:'50%',width:32,height:32,cursor:'pointer',color:'rgba(255,255,255,0.5)',
              fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✕</motion.button>
        </div>
        {/* Сообщения */}
        <div style={{flex:1,overflowY:'auto',padding:'16px',display:'flex',flexDirection:'column',gap:10}}>
          {postChatMsgs.map((msg,i)=>(
            <div key={i} style={{display:'flex',justifyContent:msg.role==='user'?'flex-end':'flex-start'}}>
              {msg.role==='bot'&&(
                <div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,marginRight:8,marginTop:2,
                  background:'linear-gradient(135deg,#1d4ed8,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:12,fontWeight:800,color:'#fff'}}>{postBotName[0]?.toUpperCase()||'А'}</div>
              )}
              <motion.div initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}}
                style={{maxWidth:'75%',padding:'10px 14px',
                  background:msg.role==='user'?'linear-gradient(135deg,#1d4ed8,#2563eb)':'rgba(255,255,255,0.07)',
                  borderRadius:msg.role==='user'?'18px 18px 4px 18px':'4px 18px 18px 18px',
                  border:msg.role==='bot'?'1px solid rgba(255,255,255,0.08)':'none'}}>
                <p style={{margin:0,fontSize:12,color:'#fff',lineHeight:1.55,
                  fontFamily:'"Montserrat",sans-serif',whiteSpace:'pre-line'}}>{msg.text}</p>
              </motion.div>
            </div>
          ))}
          {/* Быстрые кнопки слотов */}
          {postChatStep==='chat'&&avail.length>0&&(
            <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:4}}>
              {avail.map(s=>(
                <motion.button key={s} whileTap={{scale:0.95}} onClick={()=>handlePostChatMsg(s.split(' ')[1]||s)}
                  style={{background:'rgba(99,102,241,0.12)',border:'1px solid rgba(99,102,241,0.3)',
                    borderRadius:20,padding:'7px 14px',cursor:'pointer',color:'#a5b4fc',
                    fontSize:12,fontWeight:600,fontFamily:'"Montserrat",sans-serif'}}>
                  📅 {formatSlotRu(s)}
                </motion.button>
              ))}
            </div>
          )}
        </div>
        {/* Поле ввода */}
        {postChatStep!=='done'&&(
          <div style={{padding:'12px 14px 28px',borderTop:'1px solid rgba(255,255,255,0.07)',
            display:'flex',gap:8,flexShrink:0}}>
            <input value={postChatInput} onChange={e=>setPostChatInput(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&postChatInput.trim())handlePostChatMsg(postChatInput.trim());}}
              placeholder={postChatStep==='confirm'&&!postChatName?'Ваше имя…':postChatStep==='confirm'&&!postChatPhone?'Ваш телефон +7…':'Напишите желаемое время…'}
              type={postChatStep==='confirm'&&postChatName?'tel':'text'}
              style={{flex:1,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',
                borderRadius:22,padding:'11px 16px',color:'#fff',fontSize:13,outline:'none',
                fontFamily:'"Montserrat",sans-serif'}}/>
            <motion.button whileTap={{scale:0.88}} onClick={()=>{if(postChatInput.trim())handlePostChatMsg(postChatInput.trim());}}
              style={{background:'linear-gradient(135deg,#1d4ed8,#7c3aed)',border:'none',
                borderRadius:'50%',width:44,height:44,cursor:'pointer',fontSize:18,flexShrink:0,
                display:'flex',alignItems:'center',justifyContent:'center'}}>➤</motion.button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  ):null;

  /* ── Стиль 1: Классика ── */
  if(style===1) return(
    <>{bgMusicAutoplayEl}<div style={{background:c.card,borderRadius:14,overflow:'hidden',border:`1px solid ${pinned?ac+`88`:c.border}`,marginBottom:8,boxShadow:pinned?`0 0 0 2px ${ac}22,0 2px 12px ${c.deep}44`:`0 2px 12px ${c.deep}44`}}>
      {pinnedEl}{imgFeed}
      {videoEl}
      <div style={{padding:'10px 12px'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <div style={{width:32,height:32,borderRadius:'50%',overflow:'hidden',background:c.cardAlt,flexShrink:0,border:`2px solid ${ac}44`}}>
            <img src={avatarSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:800,color:c.light,lineHeight:1.1}}>{name}</div>
            <div style={{fontSize:10,color:c.sub}}>{p.ts}</div>
          </div>
          <div style={{position:'relative'}}>{menuBtn}{menuEl}</div>
        </div>
        {metaBadgesEl}
        {repostEl}
        {audioEl}
        {docEl&&<div style={{paddingBottom:4}}>{docEl}</div>}
        {localText&&<p style={{fontSize:13,color:c.mid,lineHeight:1.55,margin:'0 0 10px'}}>{localText}</p>}
        {quoteEl}{pollEl}{bookEl}
        <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
          <motion.button whileTap={{scale:0.85}} onClick={()=>onLike(p.id)}
            style={{display:'flex',alignItems:'center',gap:4,padding:'6px 12px',borderRadius:50,
              background:p.liked?`${ac}22`:c.cardAlt,color:p.liked?ac:c.sub,
              border:`1.5px solid ${p.liked?ac+'66':c.border}`,cursor:'pointer',fontWeight:800,fontSize:12,transition:'all 0.18s'}}>
            {p.liked?'❤️':'🤍'} {p.likes}
          </motion.button>
          <motion.button whileTap={{scale:0.93}} onClick={()=>onComment?.(p.id)} style={{display:'flex',alignItems:'center',gap:4,padding:'6px 12px',
            borderRadius:50,background:c.cardAlt,color:c.sub,border:`1px solid ${c.border}`,cursor:'pointer',fontWeight:700,fontSize:12}}>
            💬 {p.comments}
          </motion.button>
          <motion.button whileTap={{scale:0.93}} onClick={handleOpenThread} style={{display:'flex',alignItems:'center',gap:4,padding:'6px 12px',
            borderRadius:50,background:showThread?`${ac}18`:c.cardAlt,color:showThread?ac:c.sub,border:`1px solid ${showThread?ac+'44':c.border}`,cursor:'pointer',fontWeight:700,fontSize:12}}>
            🧵 Тред
          </motion.button>
          <motion.button whileTap={{scale:0.93}} onClick={handleBookmark} style={{display:'flex',alignItems:'center',gap:4,padding:'6px 12px',
            borderRadius:50,background:bookmarked?`${ac}18`:c.cardAlt,color:bookmarked?ac:c.sub,border:`1.5px solid ${bookmarked?ac+'55':c.border}`,cursor:'pointer',fontWeight:700,fontSize:12,transition:'all 0.18s'}}>
            {bookmarked?'🔖':'🔖'}
          </motion.button>
          <motion.button whileTap={{scale:0.95}} onClick={handleShare} style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:5,padding:'6px 12px',borderRadius:50,
            background:`${ac}11`,border:`1px solid ${ac}33`,cursor:'pointer',fontWeight:800,fontSize:12,color:ac}}>
            <span style={{fontSize:15}}>📤</span>
          </motion.button>
        </div>
        {threadEl}
      </div>
    </div>{lbEl}{docViewer&&<DocViewerModal doc={docViewer} onClose={()=>setDocViewer(null)} c={c}/>}{postChatEl}{editEl}{quoteSheetEl}{repostSheetEl}{statsEl}{promoteEl}{toastEl}</>
  );

  /* ── Стиль 2: Синема — полный кадр ── */
  if(style===2) return(
    <>{bgMusicAutoplayEl}<div style={{background:c.card,borderRadius:20,overflow:'hidden',marginBottom:12,boxShadow:pinned?`0 0 0 2px ${ac}44,0 6px 28px ${c.deep}88`:`0 6px 28px ${c.deep}88`}}>
      {pinnedEl}<div style={{position:'relative'}}>
        {p.img&&<div style={{width:'100%',background:c.deep,cursor:'pointer',overflow:'hidden'}} onClick={()=>setLb(true)}>
          <img src={p.img} alt="" style={{width:'100%',height:'auto',maxHeight:270,display:'block',objectFit:'contain'}}
            onError={e=>{(e.target as HTMLImageElement).parentElement!.parentElement!.style.display='none';}}/>
        </div>}
        {p.img&&<div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.75) 100%)',pointerEvents:'none'}}/>}
        {p.img&&<div style={{position:'absolute',bottom:12,left:12,display:'flex',alignItems:'center',gap:8}}>
          <div style={{width:30,height:30,borderRadius:'50%',overflow:'hidden',border:'2px solid rgba(255,255,255,0.9)',flexShrink:0}}>
            <img src={avatarSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          </div>
          <div>
            <div style={{fontSize:13,fontWeight:900,color:'#fff',textShadow:'0 1px 4px rgba(0,0,0,0.8)'}}>{name}</div>
            <div style={{fontSize:9,color:'rgba(255,255,255,0.65)'}}>{p.ts}</div>
          </div>
        </div>}
      </div>
      {videoEl}
      {!p.img&&<div style={{display:'flex',alignItems:'center',gap:8,padding:'12px 14px 0'}}>
        <div style={{width:32,height:32,borderRadius:'50%',overflow:'hidden',border:`2px solid ${ac}55`,flexShrink:0}}>
          <img src={avatarSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
        </div>
        <div>
          <div style={{fontSize:13,fontWeight:800,color:c.light}}>{name}</div>
          <div style={{fontSize:10,color:c.sub}}>{p.ts}</div>
        </div>
      </div>}
      {audioEl&&<div style={{padding:'8px 14px 0'}}>{audioEl}</div>}
      {docEl&&<div style={{padding:'4px 14px 0'}}>{docEl}</div>}
      {metaBadgesEl&&<div style={{padding:'6px 14px 0'}}>{metaBadgesEl}</div>}
      <div style={{padding:'12px 14px 0'}}>{repostEl}</div>
      {localText&&<p style={{fontSize:14,color:c.mid,lineHeight:1.6,margin:0,padding:'8px 14px 0'}}>{localText}</p>}
      <div style={{padding:'0 14px'}}>{quoteEl}{pollEl}</div>
      {bookEl}
      <div style={{display:'flex',borderTop:`1px solid ${c.border}`,marginTop:12}}>
        {([
          {ico:p.liked?'❤️':'🤍',cnt:p.likes,fn:()=>onLike(p.id),hi:p.liked},
          {ico:'💬',cnt:p.comments,fn:()=>onComment?.(p.id),hi:false},
          {ico:'🧵',cnt:'',fn:handleOpenThread,hi:showThread},
          {ico:bookmarked?'🔖':'🔖',cnt:'',fn:handleBookmark,hi:bookmarked},
          {ico:'📤',cnt:'',fn:handleShare,hi:false},
          {ico:'⋯',cnt:'',fn:()=>setShowMenu(v=>!v),hi:false},
        ] as {ico:string;cnt:number|string;fn:()=>void;hi:boolean}[]).map((b,i)=>(
          <motion.button key={i} whileTap={{scale:0.88}} onClick={b.fn}
            style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:5,padding:'12px 0',
              background:'none',border:'none',borderRight:i<5?`1px solid ${c.border}`:'none',
              cursor:'pointer',fontSize:13,fontWeight:700,color:b.hi?ac:c.sub}}>
            {b.ico}{b.cnt!==''?<span style={{marginLeft:3}}>{b.cnt}</span>:null}
          </motion.button>
        ))}
      </div>
      {threadEl}
      <div style={{position:'relative'}}>{menuEl}</div>
    </div>{lbEl}{docViewer&&<DocViewerModal doc={docViewer} onClose={()=>setDocViewer(null)} c={c}/>}{postChatEl}{editEl}{quoteSheetEl}{repostSheetEl}{statsEl}{promoteEl}{toastEl}</>
  );

  /* ── Стиль 3: Газета — акцентная полоса ── */
  if(style===3) return(
    <>{bgMusicAutoplayEl}<div style={{borderLeft:`4px solid ${pinned?ac:ac}`,marginBottom:16,paddingLeft:13,paddingRight:4}}>
      {pinnedEl&&<div style={{marginLeft:-13,marginRight:-4,marginBottom:8}}>{pinnedEl}</div>}
      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
        <div style={{width:20,height:20,borderRadius:'50%',overflow:'hidden',flexShrink:0,opacity:0.85}}>
          <img src={avatarSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
        </div>
        <span style={{fontSize:10,fontWeight:900,color:c.sub,letterSpacing:'0.14em',textTransform:'uppercase'}}>{name}</span>
        <span style={{fontSize:10,color:c.sub,opacity:0.4,marginLeft:2}}>· {p.ts}</span>
        <div style={{marginLeft:'auto',position:'relative'}}>{menuBtn}{menuEl}</div>
      </div>
      {repostEl}
      {imgFeed&&<div style={{borderRadius:6,overflow:'hidden',marginBottom:8}}>{imgFeed}</div>}
      {videoEl&&<div style={{borderRadius:6,overflow:'hidden',marginBottom:8}}>{videoEl}</div>}
      {audioEl&&<div style={{marginBottom:8}}>{audioEl}</div>}
      {docEl&&<div style={{marginBottom:8}}>{docEl}</div>}
      {localText&&<p style={{fontSize:15,fontWeight:600,color:c.light,lineHeight:1.5,margin:'0 0 10px',letterSpacing:'-0.01em'}}>{localText}</p>}
      {quoteEl}{pollEl}{bookEl}
      <div style={{display:'flex',alignItems:'center',gap:16}}>
        <motion.button whileTap={{scale:0.9}} onClick={()=>onLike(p.id)}
          style={{display:'flex',alignItems:'center',gap:5,background:'none',border:'none',cursor:'pointer',
            fontSize:12,color:p.liked?ac:c.sub,fontWeight:800,padding:0}}>
          <span style={{fontSize:15}}>{p.liked?'❤️':'♡'}</span> {p.likes}
        </motion.button>
        <motion.button whileTap={{scale:0.93}} onClick={()=>onComment?.(p.id)} style={{display:'flex',alignItems:'center',gap:5,background:'none',border:'none',cursor:'pointer',fontSize:12,color:c.sub,fontWeight:700,padding:0}}>
          <span style={{fontSize:15}}>💬</span> {p.comments}
        </motion.button>
        <motion.button whileTap={{scale:0.93}} onClick={handleOpenThread} style={{display:'flex',alignItems:'center',gap:4,background:'none',border:'none',cursor:'pointer',fontSize:12,color:showThread?ac:c.sub,fontWeight:700,padding:0}}>
          <span style={{fontSize:15}}>🧵</span>
        </motion.button>
        <motion.button whileTap={{scale:0.93}} onClick={handleBookmark} style={{display:'flex',alignItems:'center',gap:4,background:'none',border:'none',cursor:'pointer',fontSize:12,color:bookmarked?ac:c.sub,fontWeight:700,padding:0}}>
          <span style={{fontSize:15}}>🔖</span>
        </motion.button>
        <motion.button whileTap={{scale:0.93}} onClick={handleShare} style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:4,background:'none',border:'none',cursor:'pointer',fontSize:11,fontWeight:900,color:ac,letterSpacing:'0.04em',padding:0}}>
          <span style={{fontSize:14}}>📤</span>
        </motion.button>
      </div>
      {threadEl}
      <div style={{height:1,background:c.border,marginTop:12}}/>
    </div>{lbEl}{docViewer&&<DocViewerModal doc={docViewer} onClose={()=>setDocViewer(null)} c={c}/>}{postChatEl}{editEl}{quoteSheetEl}{repostSheetEl}{statsEl}{promoteEl}{toastEl}</>
  );

  /* ── Стиль 4: Неон — тёмный с подсветкой ── */
  if(style===4) return(
    <>{bgMusicAutoplayEl}<div style={{background:'#07070f',borderRadius:14,overflow:'hidden',marginBottom:10,
      border:`1px solid ${pinned?ac:ac+'66'}`,boxShadow:pinned?`0 0 0 2px ${ac}44,0 0 20px ${ac}33`:`0 0 20px ${ac}22,inset 0 0 30px ${ac}04`}}>
      {pinnedEl}{imgFeed&&<div style={{position:'relative'}}>
        {imgFeed}
        <div style={{position:'absolute',inset:0,background:`linear-gradient(135deg,${ac}18,transparent)`,pointerEvents:'none'}}/>
      </div>}
      {videoEl}
      <div style={{padding:'11px 13px'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
          <div style={{width:28,height:28,borderRadius:6,overflow:'hidden',border:`1.5px solid ${ac}88`,flexShrink:0}}>
            <img src={avatarSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          </div>
          <span style={{fontSize:12,fontWeight:900,color:ac,textShadow:`0 0 10px ${ac}99`,letterSpacing:'0.05em'}}>{name}</span>
          <span style={{marginLeft:'auto',fontSize:9,color:`${ac}66`,fontFamily:'monospace'}}>{p.ts}</span>
        </div>
        {audioEl&&<div style={{marginBottom:8}}>{audioEl}</div>}
        {docEl&&<div style={{marginBottom:8}}>{docEl}</div>}
        {repostEl}
        {localText&&<p style={{fontSize:12,color:'rgba(210,220,255,0.8)',lineHeight:1.6,margin:'0 0 12px',fontFamily:'monospace'}}>{localText}</p>}
        {quoteEl}{pollEl}{bookEl}
        <div style={{display:'flex',gap:6,alignItems:'center',flexWrap:'wrap'}}>
          <motion.button whileTap={{scale:0.88}} onClick={()=>onLike(p.id)}
            style={{display:'flex',flexDirection:'column',alignItems:'center',gap:1,padding:'7px 14px',
              background:p.liked?`${ac}28`:'transparent',border:`1px solid ${p.liked?ac:ac+'44'}`,borderRadius:8,cursor:'pointer',
              boxShadow:p.liked?`0 0 14px ${ac}55`:'none',transition:'all 0.2s'}}>
            <span style={{fontSize:17,lineHeight:1}}>{p.liked?'❤️':'🤍'}</span>
            <span style={{fontSize:10,fontWeight:900,color:p.liked?ac:'rgba(180,190,230,0.5)'}}>{p.likes}</span>
          </motion.button>
          <motion.button whileTap={{scale:0.88}} onClick={()=>onComment?.(p.id)} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:1,padding:'7px 14px',
            background:'transparent',border:`1px solid ${ac}33`,borderRadius:8,cursor:'pointer'}}>
            <span style={{fontSize:17,lineHeight:1}}>💬</span>
            <span style={{fontSize:10,fontWeight:900,color:'rgba(180,190,230,0.5)'}}>{p.comments}</span>
          </motion.button>
          <motion.button whileTap={{scale:0.88}} onClick={handleOpenThread} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:1,padding:'7px 12px',
            background:showThread?`${ac}18`:'transparent',border:`1px solid ${showThread?ac:ac+'33'}`,borderRadius:8,cursor:'pointer',
            boxShadow:showThread?`0 0 10px ${ac}44`:'none',transition:'all 0.2s'}}>
            <span style={{fontSize:17,lineHeight:1}}>🧵</span>
          </motion.button>
          <motion.button whileTap={{scale:0.88}} onClick={handleBookmark} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:1,padding:'7px 12px',
            background:bookmarked?`${ac}28`:'transparent',border:`1px solid ${bookmarked?ac:ac+'33'}`,borderRadius:8,cursor:'pointer',
            boxShadow:bookmarked?`0 0 10px ${ac}44`:'none',transition:'all 0.2s'}}>
            <span style={{fontSize:17,lineHeight:1}}>🔖</span>
          </motion.button>
          <motion.button whileTap={{scale:0.95}} onClick={handleShare} style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:6,padding:'8px 14px',
            border:`1px solid ${ac}66`,borderRadius:8,background:`${ac}18`,cursor:'pointer',
            fontSize:13,color:ac,fontWeight:900,boxShadow:`0 0 12px ${ac}44`}}>
            <span style={{fontSize:16}}>📤</span>
          </motion.button>
          <div style={{position:'relative'}}>{menuBtn}{menuEl}</div>
        </div>
        {threadEl}
      </div>
    </div>{lbEl}{docViewer&&<DocViewerModal doc={docViewer} onClose={()=>setDocViewer(null)} c={c}/>}{postChatEl}{editEl}{quoteSheetEl}{repostSheetEl}{statsEl}{promoteEl}{toastEl}</>
  );

  /* ── Стиль 5: Чат — пузырь ── */
  if(style===5) return(
    <>{bgMusicAutoplayEl}<div style={{marginBottom:14,display:'flex',flexDirection:'column',alignItems:'flex-start',paddingLeft:2}}>
      <div style={{display:'flex',alignItems:'flex-end',gap:8,maxWidth:'90%'}}>
        <div style={{width:36,height:36,borderRadius:'50%',overflow:'hidden',flexShrink:0,border:`2px solid ${ac}44`,alignSelf:'flex-end'}}>
          <img src={avatarSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:900,color:ac,marginLeft:4,marginBottom:3,letterSpacing:'0.03em'}}>{name}</div>
          <div style={{background:`linear-gradient(135deg,${ac}20,${ac}08)`,
            borderRadius:'16px 16px 16px 3px',border:`1.5px solid ${ac}40`,
            padding:'10px 14px',maxWidth:'100%',position:'relative'}}>
            {imgFeed&&<div style={{maxWidth:280,borderRadius:10,overflow:'hidden',marginBottom:8}}>{imgFeed}</div>}
            {videoEl&&<div style={{maxWidth:280,borderRadius:10,overflow:'hidden',marginBottom:8}}>{videoEl}</div>}
            {audioEl&&<div style={{marginBottom:8}}>{audioEl}</div>}
            {docEl&&<div style={{marginBottom:8}}>{docEl}</div>}
            {repostEl}
            {localText&&<p style={{fontSize:13,color:c.mid,lineHeight:1.5,margin:0}}>{localText}</p>}
            {quoteEl&&<div style={{marginTop:4}}>{quoteEl}</div>}
            {pollEl&&<div style={{marginTop:4}}>{pollEl}</div>}
            <div style={{display:'flex',justifyContent:'flex-end',marginTop:5}}>
              <span style={{fontSize:9,color:c.sub}}>{p.ts} ✓✓</span>
            </div>
          </div>
        </div>
      </div>
      {bookEl&&<div style={{marginLeft:44,marginTop:6}}>{bookEl}</div>}
      <div style={{display:'flex',gap:5,marginLeft:50,marginTop:5,flexWrap:'wrap'}}>
        {([
          {ico:p.liked?'❤️':'🤍',cnt:p.likes,fn:()=>onLike(p.id),hi:p.liked},
          {ico:'💬',cnt:p.comments,fn:()=>onComment?.(p.id),hi:false},
          {ico:'🧵',cnt:'',fn:handleOpenThread,hi:showThread},
          {ico:'🔖',cnt:'',fn:handleBookmark,hi:bookmarked},
          {ico:'📤',cnt:'',fn:handleShare,hi:false},
          {ico:'⋯',cnt:'',fn:()=>setShowMenu(v=>!v),hi:false},
        ] as {ico:string;cnt:number|string;fn:()=>void;hi:boolean}[]).map((b,i)=>(
          <motion.button key={i} whileTap={{scale:0.85}} onClick={b.fn}
            style={{display:'flex',alignItems:'center',gap:3,padding:'4px 10px',borderRadius:50,
              background:b.hi?`${ac}22`:c.cardAlt,border:`1px solid ${b.hi?ac+'55':c.border}`,
              cursor:'pointer',fontSize:11,fontWeight:700,color:b.hi?ac:c.sub}}>
            {b.ico}{b.cnt!==''?` ${b.cnt}`:''}
          </motion.button>
        ))}
        <div style={{position:'relative'}}>{menuEl}</div>
      </div>
      {showThread&&<div style={{marginLeft:50,marginTop:4}}>{threadEl}</div>}
    </div>{lbEl}{docViewer&&<DocViewerModal doc={docViewer} onClose={()=>setDocViewer(null)} c={c}/>}{postChatEl}{editEl}{quoteSheetEl}{repostSheetEl}{statsEl}{promoteEl}{toastEl}</>
  );

  /* ── Стиль 6: Компакт — горизонталь ── */
  return(
    <>{bgMusicAutoplayEl}<div style={{background:c.card,borderRadius:12,overflow:'hidden',marginBottom:7,border:`1px solid ${c.border}`,
      display:'flex',flexDirection:'column'}}>
      <div style={{display:'flex',minHeight:p.img?96:undefined}}>
      {p.img&&<div style={{width:96,flexShrink:0,overflow:'hidden',alignSelf:'stretch',display:'flex',alignItems:'center',background:c.deep,cursor:'pointer'}} onClick={()=>setLb(true)}>
        <img src={p.img} alt="" style={{width:'100%',height:'auto',display:'block'}}
          onError={e=>{(e.target as HTMLImageElement).parentElement!.style.display='none';}}/>
      </div>}
      <div style={{flex:1,padding:'9px 11px',display:'flex',flexDirection:'column',justifyContent:'space-between',minWidth:0}}>
        <div>
          <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:3}}>
            <div style={{width:20,height:20,borderRadius:'50%',overflow:'hidden',flexShrink:0,border:`1px solid ${ac}44`}}>
              <img src={avatarSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
            </div>
            <span style={{fontSize:11,fontWeight:800,color:c.light,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{name}</span>
            <span style={{fontSize:9,color:c.sub,marginLeft:'auto',flexShrink:0}}>{p.ts}</span>
          </div>
          {repostEl}
          {localText&&<p style={{fontSize:12,color:c.mid,lineHeight:1.4,margin:0,
            display:'-webkit-box',WebkitLineClamp:3 as any,WebkitBoxOrient:'vertical' as any,overflow:'hidden'}}>{localText}</p>}
          {quoteEl}{pollEl}
        </div>
        {bookEl}
        <div style={{display:'flex',alignItems:'center',gap:6,marginTop:7}}>
          <motion.button whileTap={{scale:0.88}} onClick={()=>onLike(p.id)}
            style={{display:'flex',alignItems:'center',gap:3,background:'none',border:'none',
              cursor:'pointer',fontSize:11,fontWeight:800,color:p.liked?ac:c.sub,padding:0}}>
            <span style={{fontSize:13}}>{p.liked?'❤️':'♡'}</span>{p.likes}
          </motion.button>
          <motion.button whileTap={{scale:0.93}} onClick={()=>onComment?.(p.id)} style={{display:'flex',alignItems:'center',gap:3,background:'none',border:'none',
            cursor:'pointer',fontSize:11,fontWeight:700,color:c.sub,padding:0}}>
            <span style={{fontSize:13}}>💬</span>{p.comments}
          </motion.button>
          <motion.button whileTap={{scale:0.93}} onClick={handleOpenThread} style={{display:'flex',alignItems:'center',gap:3,background:'none',border:'none',
            cursor:'pointer',fontSize:11,fontWeight:700,color:showThread?ac:c.sub,padding:0}}>
            <span style={{fontSize:13}}>🧵</span>
          </motion.button>
          <motion.button whileTap={{scale:0.93}} onClick={handleBookmark} style={{display:'flex',alignItems:'center',gap:3,background:'none',border:'none',
            cursor:'pointer',fontSize:11,fontWeight:700,color:bookmarked?ac:c.sub,padding:0}}>
            <span style={{fontSize:13}}>🔖</span>
          </motion.button>
          <motion.button whileTap={{scale:0.95}} onClick={handleShare} style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:4,background:`${ac}18`,
            border:`1px solid ${ac}44`,borderRadius:6,padding:'3px 9px',cursor:'pointer',fontSize:11,fontWeight:800,color:ac}}>
            <span style={{fontSize:13}}>📤</span>
          </motion.button>
          <div style={{position:'relative'}}>{menuBtn}{menuEl}</div>
        </div>
      </div>
      </div>
      {videoEl}
      {audioEl&&<div style={{padding:'0 8px 8px'}}>{audioEl}</div>}
      {docEl&&<div style={{padding:'0 8px 8px'}}>{docEl}</div>}
      {threadEl}
    </div>{lbEl}{docViewer&&<DocViewerModal doc={docViewer} onClose={()=>setDocViewer(null)} c={c}/>}{postChatEl}{editEl}{quoteSheetEl}{repostSheetEl}{statsEl}{promoteEl}{toastEl}</>
  );
}

/* ── Фоны для текстовых историй ── */
const STORY_TEXT_BG=[
  'linear-gradient(135deg,#1e003f,#5b21b6)',
  'linear-gradient(135deg,#003d1f,#065f46)',
  'linear-gradient(135deg,#3d0012,#7f1d1d)',
  'linear-gradient(135deg,#001a3d,#1d4ed8)',
  'linear-gradient(135deg,#1a001a,#6d28d9)',
];
const STICKER_DEFS=[
  /* ── Эмодзи-стикеры ── */
  {emoji:'☀️',label:'Доброе утро!'},
  {emoji:'🌙',label:'Добрый вечер!'},
  {emoji:'🌟',label:'Доброй ночи!'},
  {emoji:'👋',label:'Привет!'},
  {emoji:'💪',label:'Здоровье'},
  {emoji:'❤️',label:'С любовью'},
  {emoji:'🎉',label:'Ура!'},
  {emoji:'🥰',label:'Обнимаю!'},
  {emoji:'😂',label:'Ха-ха!'},
  {emoji:'😍',label:'Восхитительно!'},
  {emoji:'🙏',label:'Спасибо!'},
  {emoji:'😢',label:'Грустно...'},
  {emoji:'🤔',label:'Думаю...'},
  {emoji:'🎂',label:'ДР!'},
  {emoji:'🎄',label:'Праздник!'},
  {emoji:'🌺',label:'Красота!'},
  {emoji:'🚀',label:'Вперёд!'},
  {emoji:'💰',label:'Удача!'},
  {emoji:'🍕',label:'Поедим?'},
  {emoji:'☕',label:'Кофе'},
  {emoji:'🎵',label:'Музыка!'},
  {emoji:'🏆',label:'Победа!'},
  {emoji:'😎',label:'Крутяк!'},
  {emoji:'🌈',label:'Радуга!'},
  {emoji:'🐾',label:'Лапочка!'},
  {emoji:'💫',label:'Волшебство!'},
  {emoji:'🔥',label:'Огонь!'},
  /* ── Текстовые стикеры (со словами) ── */
  {emoji:'💬',label:'Как дела?',textContent:'Как дела? 😊'},
  {emoji:'🔥',label:'Огонь!',textContent:'Огонь 🔥'},
  {emoji:'😍',label:'Обожаю',textContent:'Обожаю 😍'},
  {emoji:'🤩',label:'Вау!',textContent:'Вау! 🤩'},
  {emoji:'💪',label:'Красавчик',textContent:'Красавчик 💪'},
  {emoji:'✨',label:'Шикарно',textContent:'Шикарно ✨'},
  {emoji:'🥰',label:'Обнимаю',textContent:'Обнимаю 🥰'},
  {emoji:'🎉',label:'Поздравляю',textContent:'Поздравляю! 🎉'},
  {emoji:'💯',label:'Сотка',textContent:'Сотка! 💯'},
  {emoji:'❤️',label:'Люблю',textContent:'Люблю 💕'},
  {emoji:'😂',label:'Ха-ха',textContent:'Ха-ха! 😂'},
  {emoji:'🌙',label:'Спокойной',textContent:'Спокойной ночи 🌙'},
];
interface StoryOverlayItem{
  id:string;
  type:'sticker'|'text';
  emoji?:string;
  label?:string;
  text?:string;
  color?:string;
  bg?:string;
  x:number;
  y:number;
  scale:number;
  rotate?:number;
}

const FEED_BG_OPTIONS=[
  {label:'Без фона',bg:''},
  {label:'Космос',bg:'linear-gradient(160deg,#0f0c29 0%,#302b63 50%,#24243e 100%)'},
  {label:'Аврора',bg:'linear-gradient(160deg,#0d0d1a 0%,#0a3d2b 50%,#0d0d1a 100%)'},
  {label:'Пурпур',bg:'linear-gradient(160deg,#1a0533 0%,#6b21a8 50%,#ec4899 100%)'},
  {label:'Океан',bg:'linear-gradient(160deg,#000428 0%,#004e92 100%)'},
  {label:'Рубин',bg:'linear-gradient(160deg,#200122 0%,#6f0000 100%)'},
  {label:'Джунгли',bg:'linear-gradient(160deg,#0a2e0a 0%,#134e13 50%,#1f6b1f 100%)'},
  {label:'Антрацит',bg:'linear-gradient(160deg,#141414 0%,#2a2a2a 50%,#1c1c1c 100%)'},
  {label:'Морская волна',bg:'linear-gradient(160deg,#0f2027 0%,#203a43 50%,#2c5364 100%)'},
  {label:'Янтарь',bg:'linear-gradient(160deg,#1a0900 0%,#4a1500 50%,#8b3a00 100%)'},
  {label:'Бездна',bg:'linear-gradient(160deg,#0a1628 0%,#1e3a5f 50%,#0d2137 100%)'},
  {label:'Слива',bg:'linear-gradient(160deg,#13001e 0%,#3d0060 50%,#13001e 100%)'},
  {label:'Полночь',bg:'linear-gradient(160deg,#1c1c1c 0%,#2d2d2d 40%,#111 100%)'},
];

/* ════ Оверлей активного/входящего звонка ════ */
function CallOverlayUI({call,peerInfo,apiBase}:{call:ReturnType<typeof useCallSignaling>;peerInfo:{name:string;avatar:string}|null;apiBase:string}){
  if(!call||call.callState==='idle')return null;
  const localRef=React.useRef<HTMLVideoElement>(null);
  const remoteRef=React.useRef<HTMLVideoElement>(null);
  const [resolvedPeer,setResolvedPeer]=useState<{name:string;avatar:string}|null>(peerInfo);

  /* Авто-загрузка профиля при входящем звонке */
  useEffect(()=>{
    if(peerInfo){setResolvedPeer(peerInfo);return;}
    if(!call.callPeer?.hash)return;
    let alive=true;
    fetch(`${apiBase}/api/account/${call.callPeer.hash}`)
      .then(r=>r.ok?r.json():null)
      .then(d=>{if(alive&&d)setResolvedPeer({name:d.pro_displayName||d.pro_fullName||'Пользователь',avatar:d.pro_avatarUrl||''});})
      .catch(()=>{});
    return()=>{alive=false;};
  },[call.callPeer?.hash,peerInfo,apiBase]);

  useEffect(()=>{if(localRef.current&&call.localStream)localRef.current.srcObject=call.localStream;},[call.localStream]);
  useEffect(()=>{if(remoteRef.current&&call.remoteStream)remoteRef.current.srcObject=call.remoteStream;},[call.remoteStream]);
  const isVideo=call.callPeer?.type==='video';
  const dur=call.callDuration;
  const durStr=`${String(Math.floor(dur/60)).padStart(2,'0')}:${String(dur%60).padStart(2,'0')}`;
  const displayName=resolvedPeer?.name||call.callPeer?.hash?.slice(0,12)||'Звонок';
  const displayAvatar=resolvedPeer?.avatar||'';

  return(
    <div style={{position:'fixed',inset:0,zIndex:10000,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',backdropFilter:'blur(30px)'}}>
      {/* Фоновый блюр */}
      <div style={{position:'absolute',inset:0,background:'linear-gradient(160deg,rgba(10,10,40,0.98) 0%,rgba(20,10,50,0.97) 100%)'}}/>
      {/* Видеопоток собеседника — на весь экран */}
      {isVideo&&call.remoteStream&&<video ref={remoteRef} autoPlay playsInline style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover',opacity:0.85,zIndex:1}}/>}
      {/* Локальное видео (PiP) */}
      {isVideo&&call.localStream&&(
        <div style={{position:'absolute',top:56,right:16,width:108,height:152,borderRadius:16,overflow:'hidden',border:'2px solid rgba(255,255,255,0.35)',zIndex:10,boxShadow:'0 8px 30px rgba(0,0,0,0.6)'}}>
          <video ref={localRef} autoPlay playsInline muted style={{width:'100%',height:'100%',objectFit:'cover',transform:'scaleX(-1)'}}/>
        </div>
      )}
      {/* Центральная панель */}
      <div style={{position:'relative',zIndex:12,display:'flex',flexDirection:'column',alignItems:'center',gap:14,padding:'40px 28px',width:'100%'}}>
        {/* Аватар */}
        {!isVideo||!call.remoteStream?(
          <motion.div initial={{scale:0.7,opacity:0}} animate={{scale:1,opacity:1}} style={{width:100,height:100,borderRadius:'50%',overflow:'hidden',border:'3px solid rgba(255,255,255,0.35)',boxShadow:'0 0 0 12px rgba(255,255,255,0.06)',flexShrink:0}}>
            {displayAvatar
              ?<img src={displayAvatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              :<div style={{width:'100%',height:'100%',background:'linear-gradient(135deg,#3b82f6,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:40}}>👤</div>}
          </motion.div>
        ):null}
        {/* Имя */}
        <motion.div initial={{y:10,opacity:0}} animate={{y:0,opacity:1}} style={{color:'#fff',fontWeight:900,fontSize:24,fontFamily:'"Montserrat",sans-serif',textAlign:'center',textShadow:'0 2px 12px rgba(0,0,0,0.8)'}}>
          {displayName}
        </motion.div>
        {/* Статус */}
        <motion.div initial={{opacity:0}} animate={{opacity:1}} style={{color:'rgba(255,255,255,0.65)',fontSize:14,fontFamily:'"Montserrat",sans-serif',textAlign:'center',textShadow:'0 1px 6px rgba(0,0,0,0.6)'}}>
          {call.callState==='incoming'?(isVideo?'📹 Входящий видеозвонок…':'📞 Входящий звонок…'):call.callState==='calling'?'📡 Вызов…':`${isVideo?'🎥 Видеозвонок':'🎙 Аудиозвонок'} · ${durStr}`}
        </motion.div>
        {/* Кнопки */}
        <div style={{display:'flex',gap:24,marginTop:20}}>
          {call.callState==='incoming'&&(<>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
              <motion.button whileTap={{scale:0.85}} onClick={call.acceptCall}
                style={{width:68,height:68,borderRadius:'50%',background:'#22c55e',border:'none',cursor:'pointer',fontSize:28,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 0 10px rgba(34,197,94,0.2)'}}>{isVideo?'📹':'📞'}</motion.button>
              <span style={{color:'rgba(255,255,255,0.55)',fontSize:11}}>Принять</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
              <motion.button whileTap={{scale:0.85}} onClick={call.declineCall}
                style={{width:68,height:68,borderRadius:'50%',background:'#ef4444',border:'none',cursor:'pointer',fontSize:28,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 0 10px rgba(239,68,68,0.2)'}}>📵</motion.button>
              <span style={{color:'rgba(255,255,255,0.55)',fontSize:11}}>Отклонить</span>
            </div>
          </>)}
          {call.callState==='calling'&&(
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
              <motion.button whileTap={{scale:0.85}} onClick={call.endCall}
                style={{width:68,height:68,borderRadius:'50%',background:'#ef4444',border:'none',cursor:'pointer',fontSize:28,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 0 10px rgba(239,68,68,0.2)'}}>📵</motion.button>
              <span style={{color:'rgba(255,255,255,0.55)',fontSize:11}}>Отмена</span>
            </div>
          )}
          {call.callState==='active'&&(<>
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
              <motion.button whileTap={{scale:0.85}} onClick={call.toggleMute}
                style={{width:56,height:56,borderRadius:'50%',background:call.isMuted?'rgba(239,68,68,0.3)':'rgba(255,255,255,0.15)',border:`1.5px solid ${call.isMuted?'rgba(239,68,68,0.6)':'rgba(255,255,255,0.25)'}`,cursor:'pointer',fontSize:22,display:'flex',alignItems:'center',justifyContent:'center'}}>
                {call.isMuted?'🔇':'🎙'}
              </motion.button>
              <span style={{color:'rgba(255,255,255,0.5)',fontSize:10}}>{call.isMuted?'Вкл. звук':'Без звука'}</span>
            </div>
            {isVideo&&(
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
                <motion.button whileTap={{scale:0.85}} onClick={call.toggleCam}
                  style={{width:56,height:56,borderRadius:'50%',background:call.isCamOff?'rgba(239,68,68,0.3)':'rgba(255,255,255,0.15)',border:`1.5px solid ${call.isCamOff?'rgba(239,68,68,0.6)':'rgba(255,255,255,0.25)'}`,cursor:'pointer',fontSize:22,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {call.isCamOff?'📷':'🎥'}
                </motion.button>
                <span style={{color:'rgba(255,255,255,0.5)',fontSize:10}}>{call.isCamOff?'Вкл. камеру':'Выкл. камеру'}</span>
              </div>
            )}
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
              <motion.button whileTap={{scale:0.85}} onClick={call.endCall}
                style={{width:68,height:68,borderRadius:'50%',background:'#ef4444',border:'none',cursor:'pointer',fontSize:28,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 0 0 10px rgba(239,68,68,0.2)'}}>📵</motion.button>
              <span style={{color:'rgba(255,255,255,0.55)',fontSize:11}}>Завершить</span>
            </div>
          </>)}
        </div>
        {call.callState==='active'&&call.iceState&&call.iceState!=='connected'&&(
          <div style={{fontSize:11,color:'rgba(255,165,0,0.7)',fontFamily:'"Montserrat",sans-serif',marginTop:8}}>
            ⚠️ Соединение: {call.iceState}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════ ГЛАВНЫЙ КОМПОНЕНТ ════════════════════════ */
export default function SwaipHome({userHash,apiBase,sessionToken:propToken,onLogout,onOldMode}:SwaipHomeProps){
  const [isDark,setIsDark]=useState(true);
  let c:Pal=isDark?DARK:LIGHT;
  const [currentScreen,setCurrentScreen]=useState<'home'|'meetings'|'exchange'|'assistant'|'games'>('home');

  /* ── Навигация и звонки (до условных возвратов!) ── */
  const [navTab,setNavTab]=useState<'home'|'messages'|'channels'|'browser'>('home');
  const [browserUrl,setBrowserUrl]=useState('');
  const [browserInput,setBrowserInput]=useState('');
  const [browserHistory,setBrowserHistory]=useState<string[]>([]);
  const [browserHistIdx,setBrowserHistIdx]=useState(-1);
  const [browserLoading,setBrowserLoading]=useState(false);
  const browserRef=useRef<HTMLIFrameElement>(null);
  const browserInputRef=useRef<HTMLInputElement>(null);

  const mkProxyUrl=(url:string)=>`${window.location.origin}/api/browser-proxy?url=${encodeURIComponent(url)}`;

  const openBrowser=(url:string)=>{
    const full=url.startsWith('http')?url:`https://${url}`;
    setBrowserUrl(full);setBrowserInput('');setBrowserLoading(true);
    setBrowserHistory(h=>{const trimmed=h.slice(0,browserHistIdx+1);return [...trimmed,full];});
    setBrowserHistIdx(i=>i+1);
    setNavTab('browser');
  };
  const browserNav=(url:string)=>{
    setBrowserUrl(url);setBrowserInput('');setBrowserLoading(true);
  };
  const browserGo=(raw:string)=>{
    const q=raw.trim();if(!q)return;
    const url=q.match(/^https?:\/\/|^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/)?q.startsWith('http')?q:`https://${q}`:`https://www.google.com/search?q=${encodeURIComponent(q)}`;
    setBrowserHistory(h=>{const trimmed=h.slice(0,browserHistIdx+1);return [...trimmed,url];});
    setBrowserHistIdx(i=>i+1);
    browserNav(url);
  };

  const openBrowserRef=useRef(openBrowser);
  useEffect(()=>{openBrowserRef.current=openBrowser;});

  /* Глобальный перехватчик ссылок → открыть во встроенном браузере */
  useEffect(()=>{
    const handler=(e:MouseEvent)=>{
      let target=e.target as HTMLElement|null;
      while(target&&target.tagName!=='A')target=target.parentElement;
      if(!target)return;
      const href=(target as HTMLAnchorElement).href;
      if(!href)return;
      if(href.startsWith('mailto:')||href.startsWith('tel:'))return;
      if(!href.startsWith('http'))return;
      if((target as HTMLAnchorElement).closest('iframe'))return;
      e.preventDefault();
      e.stopPropagation();
      openBrowserRef.current(href);
    };
    document.addEventListener('click',handler,true);
    return()=>document.removeEventListener('click',handler,true);
  },[]);
  const [chatTarget,setChatTarget]=useState<{hash:string;info:ConvUser}|null>(null);
  const [secretChatTarget,setSecretChatTarget]=useState<{hash:string;info:ConvUser}|null>(null);
  const [ringtoneId, setRingtoneId] = useSaved<RingtoneId>(RINGTONE_PREF_KEY, 'classic');
  const call=useCallSignaling(userHash, getSessionToken()||'', ringtoneId);
  const unreadCount=useUnreadCount(userHash);
  usePushNotifications(userHash);

  /* ── Пинг присутствия — онлайн-статус ── */
  useEffect(()=>{
    const ping=()=>{
      const tok=getSessionToken();
      if(!tok||!userHash)return;
      fetch(`${apiBase}/api/presence/ping`,{method:'POST',headers:{'x-session-token':tok}}).catch(()=>{});
    };
    ping();
    const id=setInterval(ping,30_000);
    const onVisible=()=>{if(document.visibilityState==='visible')ping();};
    document.addEventListener('visibilitychange',onVisible);
    return()=>{clearInterval(id);document.removeEventListener('visibilitychange',onVisible);};
  },[userHash,apiBase]);

  /* ── Дизайн / Оформление ── */
  const [showDesignModal,setShowDesignModal]=useState(false);
  const [showFeedBgPicker,setShowFeedBgPicker]=useState(false);
  const [showCardStylePicker,setShowCardStylePicker]=useState(false);
  const [postCardStyle,setPostCardStyle]=useSaved('sw_postCardStyle',1);
  const [showVizitkaModal,setShowVizitkaModal]=useState(false);
  const [showHlEditor,setShowHlEditor]=useState(false);
  const [showReferralModal,setShowReferralModal]=useState(false);
  const [feedBgGradient,setFeedBgGradient]=useSaved('sw_feedBg','');
  const [proVizitkaUrl,setProVizitkaUrl]=useSaved('sw_vizitka','');
  const [vizitkaUploading,setVizitkaUploading]=useState(false);
  const vizitkaFileRef=useRef<HTMLInputElement>(null);
  type HlItem={id:string;title:string;emoji:string;coverUrl:string};
  const [proHighlights,setProHighlights]=useSaved<HlItem[]>('sw_highlights',[]);
  const [hlNewTitle,setHlNewTitle]=useState('');
  const [hlNewEmoji,setHlNewEmoji]=useState('✨');
  const [hlNewCoverUrl,setHlNewCoverUrl]=useState('');
  const [hlUploadingCover,setHlUploadingCover]=useState(false);
  const [hlEditingId,setHlEditingId]=useState<string|null>(null);
  const hlCoverRef=useRef<HTMLInputElement>(null);
  const [coinBalance,setCoinBalance]=useState(0);
  const [referralCount,setReferralCount]=useState(0);
  const [referralCopied,setReferralCopied]=useState(false);
  const activeAccent=c.accent;

  /* ── СИНХРОНИЗАЦИЯ ПРИ СТАРТЕ: GET → восстановить из DB → PUT ──
     ВАЖНО: НЕ писать в DB сразу при монтировании с пустым localStorage!
     Это уничтожало бы сохранённые данные пользователя при открытии с нового устройства.
     Правильный порядок: сначала GET из DB → восстановить пустые LS-ключи → потом PUT. */
  useEffect(()=>{
    const tok=propToken||getSessionToken()||'';
    if(!userHash||!tok)return;
    const PREFIX_RE=/^(pro_|classic_|scene_|krug_|sw_|priv_)/;
    const snapshotLS=():Record<string,unknown>=>{
      const d:Record<string,unknown>={};
      try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';if(!PREFIX_RE.test(k))continue;try{const r=localStorage.getItem(k);if(r!==null)d[k]=JSON.parse(r);}catch{}}}catch{}
      return d;
    };
    const ensureLS=(k:string,v:unknown)=>{try{if(localStorage.getItem(k)===null)localStorage.setItem(k,JSON.stringify(v));}catch{}};
    fetch(`${window.location.origin}/api/account/${userHash}`,{headers:{'x-session-token':tok}})
      .then(r=>r.ok?r.json():null)
      .then((result:{data:Record<string,unknown>}|null)=>{
        const dbData=result?.data||{};
        /* Восстанавливаем из DB в localStorage если LS пуст */
        const restoreIfEmpty=(key:string,setter:(v:any)=>void)=>{
          try{
            const lsRaw=localStorage.getItem(key);
            const lsVal=lsRaw!==null?JSON.parse(lsRaw):null;
            const lsEmpty=lsVal===null||lsVal===''||(Array.isArray(lsVal)&&lsVal.length===0);
            if(lsEmpty&&dbData[key]!==undefined){
              const dbVal=dbData[key];
              const dbHasData=dbVal!==''&&dbVal!==null&&!(Array.isArray(dbVal)&&(dbVal as unknown[]).length===0);
              if(dbHasData){localStorage.setItem(key,JSON.stringify(dbVal));setter(dbVal as any);}
            }
          }catch{}
        };
        restoreIfEmpty('classic_works',setClassicWorks);
        restoreIfEmpty('classic_reviews',setClassicReviews);
        restoreIfEmpty('pro_priceItems',setPriceItems);
        restoreIfEmpty('classic_certs',setClassicCerts);
        restoreIfEmpty('classic_faq',setClassicFaq);
        restoreIfEmpty('classic_cases',setClassicCases);
        restoreIfEmpty('classic_links',setClassicLinks);
        restoreIfEmpty('pro_displayName',setProfName);
        restoreIfEmpty('pro_bio',setProfBio);
        restoreIfEmpty('sw_nick',setProfNick);
        restoreIfEmpty('pro_avatarUrl',setAvatarUrl);
        restoreIfEmpty('pro_coverGradient',setCoverGrad);
        restoreIfEmpty('pro_coverImageUrl',setCoverImageUrl);
        restoreIfEmpty('sw_postCardStyle',setPostCardStyle);
        restoreIfEmpty('sw_feedBg',setFeedBgGradient);
        restoreIfEmpty('sw_vizitka',setProVizitkaUrl);
        restoreIfEmpty('sw_highlights',setProHighlights);
        /* Гарантируем дефолты и пишем объединённый снимок в DB */
        ensureLS('pro_displayName',profName);ensureLS('pro_coverGradient',coverGrad);
        ensureLS('sw_feedBg',feedBgGradient);ensureLS('pro_avatarUrl',avatarUrl);
        ensureLS('pro_bio',profBio);ensureLS('pro_website',profSite);
        ensureLS('pro_position',profPosition);ensureLS('pro_company',profCompany);
        ensureLS('sw_nick',profNick);ensureLS('sw_highlights',proHighlights);
        ensureLS('pro_coverImageUrl','');ensureLS('pro_coverPosition','50% 50%');
        fetch(`${window.location.origin}/api/account`,{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json','x-session-token':tok},body:JSON.stringify({data:snapshotLS()})}).catch(()=>{});
      })
      .catch(()=>{
        /* GET не удался (новый пользователь?) — всё равно регистрируем аккаунт */
        ensureLS('pro_displayName',profName);ensureLS('pro_coverGradient',coverGrad);
        ensureLS('sw_feedBg',feedBgGradient);ensureLS('pro_avatarUrl',avatarUrl);
        ensureLS('pro_bio',profBio);ensureLS('pro_website',profSite);
        ensureLS('pro_position',profPosition);ensureLS('pro_company',profCompany);
        ensureLS('sw_nick',profNick);ensureLS('sw_highlights',proHighlights);
        ensureLS('pro_coverImageUrl','');ensureLS('pro_coverPosition','50% 50%');
        fetch(`${window.location.origin}/api/account`,{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json','x-session-token':tok},body:JSON.stringify({data:snapshotLS()})}).catch(()=>{});
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[userHash,propToken]);

  /* Авто-синк каналов/групп на сервер при изменении в localStorage */
  useEffect(()=>{
    const tok=propToken||getSessionToken()||'';
    if(!userHash||!tok)return;
    const PREFIX_RE=/^(pro_|classic_|scene_|krug_|sw_|priv_)/;
    const pushSnap=()=>{
      const d:Record<string,unknown>={};
      try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';if(!PREFIX_RE.test(k))continue;try{const r=localStorage.getItem(k);if(r!==null)d[k]=JSON.parse(r);}catch{}}}catch{}
      fetch(`${window.location.origin}/api/account`,{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json','x-session-token':tok},body:JSON.stringify({data:d})}).catch(()=>{});
    };
    const onStorage=(e:StorageEvent)=>{
      if(e.key==='sw_channels'||e.key==='sw_groups')pushSnap();
    };
    const onSwEvent=()=>pushSnap();
    window.addEventListener('storage',onStorage);
    window.addEventListener('sw:channels-updated',onSwEvent);
    window.addEventListener('sw:groups-updated',onSwEvent);
    return()=>{
      window.removeEventListener('storage',onStorage);
      window.removeEventListener('sw:channels-updated',onSwEvent);
      window.removeEventListener('sw:groups-updated',onSwEvent);
    };
  },[userHash,propToken]);

  /* Загрузка баланса монет */
  useEffect(()=>{
    const token=getSessionToken();
    if(!token||!userHash)return;
    fetch(`${window.location.origin}/api/referral/stats`,{headers:{'x-session-token':token}})
      .then(r=>r.ok?r.json():null).then(d=>{if(d){setCoinBalance(d.coinBalance??0);setReferralCount(d.referralsCount??0);}}).catch(()=>{});
  },[userHash]);

  /* Данные из Про */
  const [profName,setProfName]=useSaved('pro_displayName','Моё имя');
  const [profNick,setProfNick]=useSaved('sw_nick',genHandle());
  const [profBio,setProfBio]=useSaved('pro_bio','');
  const [profSite,setProfSite]=useSaved('pro_website','');
  const [profPosition,]=useSaved('pro_position','');
  const [profCompany,]=useSaved('pro_company','');
  const [avatarUrl,setAvatarUrl]=useSaved('pro_avatarUrl','');
  const [coverGrad,setCoverGrad]=useSaved('pro_coverGradient',COVER_TEMPLATES[7].bg);
  const [proContacts,]=useSaved<{phone:string;whatsapp:string;telegram:string;vk:string}>('pro_contacts',{phone:'',whatsapp:'',telegram:'',vk:''});


  const [profMood,setProfMood]=useSaved<{emoji:string;text:string}>('pro_mood',{emoji:'',text:''});
  const [showMoodPicker,setShowMoodPicker]=useState(false);

  const MOOD_OPTIONS=[
    {emoji:'😊',text:'Отлично'},
    {emoji:'🔥',text:'В потоке'},
    {emoji:'💡',text:'Вдохновлён'},
    {emoji:'😴',text:'Устал'},
    {emoji:'🎮',text:'Играю'},
    {emoji:'🎵',text:'Слушаю'},
    {emoji:'💪',text:'Работаю'},
    {emoji:'✈️',text:'В дороге'},
    {emoji:'🏖️',text:'Отдыхаю'},
    {emoji:'📚',text:'Учусь'},
    {emoji:'🤔',text:'Думаю'},
    {emoji:'❤️',text:'Влюблён'},
    {emoji:'😎',text:'Спокойно'},
    {emoji:'🌙',text:'Ночной'},
    {emoji:'☕',text:'Кофе'},
    {emoji:'🎯',text:'Фокус'},
  ];

  const [editField,setEditField]=useState<'name'|'nick'|'bio'|'site'|null>(null);
  const avatarRef=useRef<HTMLInputElement>(null);
  const [showCoverPicker,setShowCoverPicker]=useState(false);

  /* Состояния UI */
  const [posts,setPosts]=useState<Post[]>([]);
  useEffect(()=>{
    const tok=getSessionToken();
    fetch(`${window.location.origin}/api/broadcasts?limit=50`,{headers:tok?{'x-session-token':tok}:{}})
      .then(r=>r.ok?r.json():null)
      .then((data:any[])=>{
        if(!data||!data.length){setPosts(INIT_POSTS);return;}
        const now=Date.now();
        const fmtTs=(iso:string)=>{const d=new Date(iso);const s=(now-d.getTime())/1000;if(s<60)return'только что';if(s<3600)return`${Math.floor(s/60)} мин назад`;if(s<86400)return`${Math.floor(s/3600)} ч назад`;if(s<604800)return`${Math.floor(s/86400)} дн назад`;return d.toLocaleDateString('ru');};
        setPosts(data.map((b:any)=>({id:String(b.id),text:b.content||'',img:b.imageUrl||undefined,videoUrl:b.videoUrl||undefined,audioUrl:b.audioUrl||undefined,docUrls:b.docUrls||undefined,likes:(b.reactions||[]).reduce((s:number,r:any)=>s+r.count,0),liked:(b.myReactions||[]).length>0,comments:b.commentCount||0,ts:fmtTs(b.createdAt),...(b.hasBooking?{hasBooking:true,bookingLabel:b.bookingLabel||'Записаться',bookingSlots:Array.isArray(b.bookingSlots)?b.bookingSlots:[]}:{}),...(b.poll?{poll:b.poll}:{}),...(b.myVote!==undefined?{myVote:b.myVote}:{}),...(b.quoteOf?{quoteOf:b.quoteOf}:{}),...(b.repostOf?{repostOf:b.repostOf}:{})})));
      }).catch(()=>{setPosts(INIT_POSTS);});
  },[]);
  const [draft,setDraft]=useState('');
  const [showInput,setShowInput]=useState(false);
  const [tab,setTab]=useState<'feed'|'widgets'>('feed');
  const [showSideMenu,setShowSideMenu]=useState(false);
  const [showShare,setShowShare]=useState(false);
  const [commentPostId,setCommentPostId]=useState<string|null>(null);
  const [profileViewHash,setProfileViewHash]=useState<string|null>(null);
  const [profileViewFallback,setProfileViewFallback]=useState<{name:string;avatar:string;handle:string;bio:string}|null>(null);
  const [callPeerInfo,setCallPeerInfo]=useState<{name:string;avatar:string}|null>(null);
  useEffect(()=>{if(call.callState==='idle')setCallPeerInfo(null);},[call.callState]);
  const [showSearch,setShowSearch]=useState(false);
  const [searchQ,setSearchQ]=useState('');
  const [codeInput,setCodeInput]=useState('');
  const [codeResult,setCodeResult]=useState<{found:boolean;hash?:string;name?:string;handle?:string;avatar?:string;mode?:string}|null>(null);
  const [codeLoading,setCodeLoading]=useState(false);
  const [searchResults,setSearchResults]=useState<{hash:string;name:string;handle:string;avatar:string;bio:string;mood?:{emoji:string;text:string}}[]>([]);
  const [searchLoading,setSearchLoading]=useState(false);

  /* ── Обработчик кнопки «Назад» (аппаратная / браузерная) ──────────
     Приоритет: сайдменю → модалы → экраны → вкладки навбара.
     Единый хук с fnRef-паттерном — всегда вызывает актуальное действие. */
  useBackHandler(
    showSideMenu       ? () => setShowSideMenu(false)
    : showDesignModal  ? () => setShowDesignModal(false)
    : showFeedBgPicker ? () => setShowFeedBgPicker(false)
    : showCardStylePicker ? () => setShowCardStylePicker(false)
    : showVizitkaModal ? () => setShowVizitkaModal(false)
    : showHlEditor     ? () => setShowHlEditor(false)
    : showReferralModal? () => setShowReferralModal(false)
    : showMoodPicker   ? () => setShowMoodPicker(false)
    : showCoverPicker  ? () => setShowCoverPicker(false)
    : showShare        ? () => setShowShare(false)
    : showSearch       ? () => setShowSearch(false)
    : profileViewHash  ? () => setProfileViewHash(null)
    : currentScreen !== 'home' ? () => setCurrentScreen('home')
    : navTab !== 'home'        ? () => setNavTab('home')
    : null
  );

  /* ── Обложка: загрузка своего фото ── */
  const [coverImageUrl,setCoverImageUrl]=useSaved('pro_coverImageUrl','');
  const [coverPosition,setCoverPosition]=useSaved('pro_coverPosition','50% 50%');

  /* ── АВТО-СИНХРОНИЗАЦИЯ В DB при изменении любого поля профиля ──
     useSaved пишет только в localStorage. При смене обложки/имени/био/ника/стиля
     нужно немедленно записать в DB чтобы гости видели актуальные данные. */
  const _syncTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const _syncMounted=useRef(false);
  useEffect(()=>{
    if(!_syncMounted.current){_syncMounted.current=true;return;}
    const tok=propToken||getSessionToken()||'';
    if(!userHash||!tok)return;
    if(_syncTimer.current)clearTimeout(_syncTimer.current);
    _syncTimer.current=setTimeout(()=>{
      const profileData:Record<string,unknown>={};
      const PREFIX_RE=/^(pro_|classic_|scene_|krug_|sw_|priv_)/;
      try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';if(!PREFIX_RE.test(k))continue;try{const raw=localStorage.getItem(k);if(raw!==null)profileData[k]=JSON.parse(raw);}catch{}}}catch{}
      fetch(`${window.location.origin}/api/account`,{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json','x-session-token':tok},body:JSON.stringify({data:profileData})}).catch(()=>{});
    },800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[profName,profBio,profNick,avatarUrl,coverGrad,coverImageUrl,coverPosition,postCardStyle,userHash,profMood]);

  const [showCoverCrop,setShowCoverCrop]=useState(false);
  const [coverCropSrc,setCoverCropSrc]=useState('');
  const [coverCropFinal,setCoverCropFinal]=useState('');
  const [cropY,setCropY]=useState(50);
  const coverFileRef=useRef<HTMLInputElement>(null);

  /* ── Редактор историй (полный Pro-вариант) ── */
  type MyStory={id:string;text:string;bgColor:string;mediaUrl:string;mediaType:'photo'|'video'|'';ts:number;overlayItems?:StoryOverlayItem[]};
  const [myStories,setMyStories]=useSaved<MyStory[]>('sw_myStories',[]);
  const [showStoryEditor,setShowStoryEditor]=useState(false);
  const [storyTab,setStoryTab]=useState<'record'|'video'|'image'|'text'>('image');
  const [storyText,setStoryText]=useState('');
  const [storyBgIdx,setStoryBgIdx]=useState(0);
  const [storyUploading,setStoryUploading]=useState(false);
  const [uploadProgress,setUploadProgress]=useState(0);
  const [storyError,setStoryError]=useState<string|null>(null);
  const [storySuccess,setStorySuccess]=useState(false);
  const videoFileRef=useRef<HTMLInputElement>(null);
  const imageFileRef=useRef<HTMLInputElement>(null);
  /* ── Overlay: стикеры + текст ── */
  const [ovItems,setOvItems]=useState<StoryOverlayItem[]>([]);
  const [ovSelId,setOvSelId]=useState<string|null>(null);
  const ovPinchRef=useRef<{id:string;startDist:number;startScale:number;startAngle:number;startRotate:number}|null>(null);
  const [ovShowText,setOvShowText]=useState(false);
  const [ovTxtDraft,setOvTxtDraft]=useState('');
  const [ovTxtColor,setOvTxtColor]=useState('#ffffff');
  const [ovShowStickers,setOvShowStickers]=useState(false);
  /* ── Галерея: предпросмотр перед публикацией ── */
  const [galFile,setGalFile]=useState<File|null>(null);
  const [galBuffer,setGalBuffer]=useState<ArrayBuffer|null>(null);
  const [galUrl,setGalUrl]=useState<string|null>(null);
  const [galType,setGalType]=useState<'video'|'image'|null>(null);
  const ovContainerRef=useRef<HTMLDivElement>(null);
  const ovDragRef=useRef<{id:string;sx:number;sy:number;ox:number;oy:number}|null>(null);
  /* Камера */
  const camVideoRef=useRef<HTMLVideoElement>(null);
  const camStreamRef=useRef<MediaStream|null>(null);
  const camRecorderRef=useRef<MediaRecorder|null>(null);
  const camChunksRef=useRef<BlobPart[]>([]);
  const camTimerRef=useRef<ReturnType<typeof setInterval>|null>(null);
  const camStartTimeRef=useRef<number>(0);
  const [camFacing,setCamFacing]=useState<'user'|'environment'>('environment');
  const [camMode,setCamMode]=useState<'photo'|'video'>('photo');
  const [camRecording,setCamRecording]=useState(false);
  const [camBlob,setCamBlob]=useState<Blob|null>(null);
  const [camPreviewUrl,setCamPreviewUrl]=useState<string|null>(null);
  const [camPhotoBlob,setCamPhotoBlob]=useState<Blob|null>(null);
  const [camPhotoUrl,setCamPhotoUrl]=useState<string|null>(null);
  const [camSeconds,setCamSeconds]=useState(0);
  const [camError,setCamError]=useState<string|null>(null);
  const [camZoom,setCamZoom]=useState(1);
  const [camMaxZoom,setCamMaxZoom]=useState(5);
  const camPinchRef=useRef<{dist:number;zoom:number}|null>(null);

  /* ── Пост с медиа ── */
  const [postMediaUrl,setPostMediaUrl]=useState('');
  const [postMediaType,setPostMediaType]=useState<'photo'|'video'|''>('');
  const [postUploading,setPostUploading]=useState(false);
  const postPhotoRef=useRef<HTMLInputElement>(null);
  const postVideoRef=useRef<HTMLInputElement>(null);

  /* ── Виджеты (ключи синхронизированы с Про) ── */
  const [classicWorks,setClassicWorks]=useSaved<ClassicWork[]>('classic_works',[]);
  const [classicReviews,setClassicReviews]=useSaved<ClassicReview[]>('classic_reviews',[]);
  const [priceItems,setPriceItems]=useSaved<PriceItem[]>('pro_priceItems',[]);
  const [bookings,setBookings]=useSaved<BookingRecord[]>('pro_bookings',[]);
  const [freeSlots,setFreeSlots]=useSaved<string[]>('pro_freeSlots',[]);
  const [classicCerts,setClassicCerts]=useSaved<ClassicCert[]>('classic_certs',[]);
  const [classicFaq,setClassicFaq]=useSaved<ClassicFaq[]>('classic_faq',[]);
  const [classicCases,setClassicCases]=useSaved<ClassicCase[]>('classic_cases',[]);
  const [classicLinks,setClassicLinks]=useSaved<ClassicLink[]>('classic_links',[]);

  /* ── АВТО-СИНХРОНИЗАЦИЯ ВИДЖЕТОВ В DB ──
     Следим за изменением массивов виджетов и пишем в DB с debounce 800мс */
  const _widgetKey=useMemo(()=>JSON.stringify([classicWorks,classicReviews,priceItems,classicCerts,classicFaq,classicCases,classicLinks]),
    [classicWorks,classicReviews,priceItems,classicCerts,classicFaq,classicCases,classicLinks]);
  const _widgetSyncTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const _widgetSyncMounted=useRef(false);
  useEffect(()=>{
    if(!_widgetSyncMounted.current){_widgetSyncMounted.current=true;return;}
    const tok=propToken||getSessionToken()||'';
    if(!userHash||!tok)return;
    if(_widgetSyncTimer.current)clearTimeout(_widgetSyncTimer.current);
    _widgetSyncTimer.current=setTimeout(()=>{
      const profileData:Record<string,unknown>={};
      const PREFIX_RE=/^(pro_|classic_|scene_|krug_|sw_|priv_)/;
      try{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';if(!PREFIX_RE.test(k))continue;try{const raw=localStorage.getItem(k);if(raw!==null)profileData[k]=JSON.parse(raw);}catch{}}}catch{}
      fetch(`${window.location.origin}/api/account`,{method:'PUT',credentials:'include',headers:{'Content-Type':'application/json','x-session-token':tok},body:JSON.stringify({data:profileData})}).catch(()=>{});
    },800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[_widgetKey,userHash]);

  const [openSheet,setOpenSheet]=useState<string|null>(null);

  /* ── Музыкальный плеер ── */
  const [playlist,setPlaylist]=useState<Track[]>(loadPlaylist);
  const [musicIdx,setMusicIdx]=useState(-1);
  const [musicPlaying,setMusicPlaying]=useState(false);
  const [musicProgress,setMusicProgress]=useState(0);
  const [musicDuration,setMusicDuration]=useState(0);
  const [showMusicSheet,setShowMusicSheet]=useState(false);
  const [musicPlayerStyle,setMusicPlayerStyle]=useState(()=>Number(localStorage.getItem('swaip_music_style')||1));
  const [showMusicPicker,setShowMusicPicker]=useState(false);
  const [musicPickerCb,setMusicPickerCb]=useState<((t:Track)=>void)|null>(null);
  const musicFileRef=useRef<HTMLInputElement>(null);
  const musicUploadingRef=useRef(false);

  const playTrack=useCallback((idx:number,list?:Track[])=>{
    const pl=list||playlist;
    if(idx<0||idx>=pl.length)return;
    const audio=getGlobalAudio();
    const t=pl[idx];
    if(audio.src!==t.url){audio.src=t.url;audio.load();}
    audio.play().catch(()=>{});
    setMusicIdx(idx);
    setMusicPlaying(true);
  },[playlist]);

  const pauseTrack=useCallback(()=>{
    getGlobalAudio().pause();
    setMusicPlaying(false);
  },[]);

  const togglePlayTrack=useCallback((idx:number)=>{
    if(musicIdx===idx&&musicPlaying){pauseTrack();}
    else{playTrack(idx);}
  },[musicIdx,musicPlaying,pauseTrack,playTrack]);

  const nextTrack=useCallback(()=>{
    if(!playlist.length)return;
    const next=(musicIdx+1)%playlist.length;
    playTrack(next);
  },[musicIdx,playlist,playTrack]);

  const prevTrack=useCallback(()=>{
    if(!playlist.length)return;
    const prev=(musicIdx-1+playlist.length)%playlist.length;
    playTrack(prev);
  },[musicIdx,playlist,playTrack]);

  const removeTrack=useCallback((id:string)=>{
    setPlaylist(pl=>{
      const next=pl.filter(t=>t.id!==id);
      savePlaylist(next);
      const removed=pl.findIndex(t=>t.id===id);
      if(removed===musicIdx){getGlobalAudio().pause();setMusicPlaying(false);setMusicIdx(-1);}
      else if(removed<musicIdx){setMusicIdx(i=>i-1);}
      return next;
    });
  },[musicIdx]);

  const addTracksToPlaylist=useCallback((tracks:Track[])=>{
    setPlaylist(pl=>{
      const next=[...pl,...tracks.filter(t=>!pl.some(e=>e.id===t.id))];
      savePlaylist(next);
      return next;
    });
  },[]);

  useEffect(()=>{
    const audio=getGlobalAudio();
    const onTime=()=>setMusicProgress(audio.currentTime);
    const onDur=()=>setMusicDuration(audio.duration||0);
    const onEnd=()=>{
      setMusicPlaying(false);
      setPlaylist(pl=>{
        const next=(musicIdx+1)%pl.length;
        if(pl.length>1){playTrack(next,pl);}
        return pl;
      });
    };
    audio.addEventListener('timeupdate',onTime);
    audio.addEventListener('durationchange',onDur);
    audio.addEventListener('ended',onEnd);
    return()=>{audio.removeEventListener('timeupdate',onTime);audio.removeEventListener('durationchange',onDur);audio.removeEventListener('ended',onEnd);};
  },[musicIdx,playTrack]);

  const handleMusicFilePick=useCallback(async(files:FileList|null)=>{
    if(!files||!files.length)return;
    musicUploadingRef.current=true;
    const st=()=>{try{return localStorage.getItem('swaip_session');}catch{return null;}};
    for(let i=0;i<files.length;i++){
      const f=files[i];
      const localUrl=URL.createObjectURL(f);
      const title=f.name.replace(/\.[^.]+$/,'');
      const trackId=`tr_${Date.now()}_${i}`;
      /* Добавляем трек немедленно с локальным blob-URL */
      addTracksToPlaylist([{id:trackId,title,artist:'',url:localUrl}]);
      /* Загружаем на сервер в фоне — без блокировки UI */
      (async()=>{
        try{
          const r=await fetch(`${window.location.origin}/api/audio-upload`,{
            method:'POST',
            headers:{'Content-Type':f.type||'audio/mpeg','x-session-token':st()||'','x-filename':f.name},
            body:f
          });
          const json=r.ok?await r.json().catch(()=>null):null;
          if(json?.url){
            setPlaylist(pl=>{
              const next=pl.map(t=>t.id===trackId?{...t,url:json.url}:t);
              savePlaylist(next);
              return next;
            });
          }
        }catch{ /* локальный blob продолжает работать */ }
      })();
    }
    musicUploadingRef.current=false;
    if(musicFileRef.current)musicFileRef.current.value='';
  },[addTracksToPlaylist]);

  const seekTrack=useCallback((t:number)=>{const a=getGlobalAudio();a.currentTime=t;},[]);

  useEffect(()=>{
    const onAddTracks=(e:Event)=>{const tracks=(e as CustomEvent<Track[]>).detail;addTracksToPlaylist(tracks);};
    const onEditTrack=(e:Event)=>{
      const {id,title,artist}=(e as CustomEvent<{id:string;title:string;artist:string}>).detail;
      setPlaylist(pl=>{const next=pl.map(t=>t.id===id?{...t,title,artist}:t);savePlaylist(next);return next;});
    };
    window.addEventListener('swaip-add-tracks',onAddTracks);
    window.addEventListener('swaip-edit-track',onEditTrack);
    return()=>{window.removeEventListener('swaip-add-tracks',onAddTracks);window.removeEventListener('swaip-edit-track',onEditTrack);};
  },[addTracksToPlaylist]);

  /* ── Состояния редактирования Работ ── */
  const [worksEditId,setWorksEditId]=useState<string|null>(null);
  const [worksEditTitle,setWorksEditTitle]=useState('');
  const [worksEditDesc,setWorksEditDesc]=useState('');
  const [worksEditImageUrl,setWorksEditImageUrl]=useState('');
  const [worksEditImageFile,setWorksEditImageFile]=useState<File|null>(null);
  const [worksEditImagePrev,setWorksEditImagePrev]=useState('');
  const [worksEditUploading,setWorksEditUploading]=useState(false);
  const worksEditImgRef=useRef<HTMLInputElement>(null);

  /* ── Состояния редактирования Отзывов ── */
  const [reviewEditId,setReviewEditId]=useState<string|null>(null);
  const [reviewEditImageUrl,setReviewEditImageUrl]=useState('');
  const [reviewEditImageFile,setReviewEditImageFile]=useState<File|null>(null);
  const [reviewEditImagePrev,setReviewEditImagePrev]=useState('');
  const [reviewEditCaption,setReviewEditCaption]=useState('');
  const [reviewEditUploading,setReviewEditUploading]=useState(false);
  const reviewEditImgRef=useRef<HTMLInputElement>(null);
  const [showReviewInfoPro,setShowReviewInfoPro]=useState(false);
  const [proApiReviews,setProApiReviews]=useState<{id:string;authorName:string;rating:number;text:string;createdAt:string}[]>([]);
  const proApiReviewsLoaded=true;
  const getST=()=>{try{return localStorage.getItem('swaip_session');}catch{return null;}};

  /* ── Отдельные модалы виджетов (как в Про) ── */
  const [showWorksModal,setShowWorksModal]=useState(false);
  const [showReviewsModal,setShowReviewsModal]=useState(false);
  const [showPriceWidgetModal,setShowPriceWidgetModal]=useState(false);
  const [showCertsModal,setShowCertsModal]=useState(false);
  const [showBookmarksModal,setShowBookmarksModal]=useState(false);
  const [bookmarkedPosts,setBookmarkedPosts]=useState<Post[]>([]);
  const [bookmarksLoading,setBookmarksLoading]=useState(false);

  const loadBookmarks=async()=>{
    setBookmarksLoading(true);
    try{
      const res=await fetch(`${window.location.origin}/api/bookmarks`,{headers:{'x-session-token':getSessionToken()||''}});
      if(res.ok){
        const data=await res.json();
        setBookmarkedPosts((data.posts||[]).map(rawToPost));
      }
    }catch(e){console.error(e);}
    setBookmarksLoading(false);
  };
  const [showFaqModal,setShowFaqModal]=useState(false);
  const [showCasesModal,setShowCasesModal]=useState(false);
  const [showLinksModal,setShowLinksModal]=useState(false);

  /* ── Состояния редактирования Прайса ── */
  const [showPriceEditor,setShowPriceEditor]=useState(false);
  const [editingPrice,setEditingPrice]=useState<PriceItem|null>(null);
  const [priceEditName,setPriceEditName]=useState('');
  const [priceEditPrice,setPriceEditPrice]=useState('');
  const [priceEditDesc,setPriceEditDesc]=useState('');
  const [priceEditUnit,setPriceEditUnit]=useState('');
  const [priceEditPhoto,setPriceEditPhoto]=useState('');
  const [priceEditSlots,setPriceEditSlots]=useState<string[]>([]);
  const [slotDateInput,setSlotDateInput]=useState('');
  const [slotTimeInput,setSlotTimeInput]=useState('');
  const pricePhotoRef=useRef<HTMLInputElement>(null);

  /* ── Состояния Записи (Booking) ── */
  const [showBookingChat,setShowBookingChat]=useState(false);
  const [bookingItem,setBookingItem]=useState<PriceItem|null>(null);
  const [chatMessages,setChatMessages]=useState<{role:'bot'|'user';text:string}[]>([]);
  const [chatInput,setChatInput]=useState('');
  const [bookingStep,setBookingStep]=useState<'select'|'chat'|'confirm'|'done'>('select');
  const [selectedSlot,setSelectedSlot]=useState('');
  const [bClientName,setBClientName]=useState('');
  const [bClientPhone,setBClientPhone]=useState('');
  const [fSlotDate,setFSlotDate]=useState('');
  const [fSlotTime,setFSlotTime]=useState('');
  const [showFreeSlotsEditor,setShowFreeSlotsEditor]=useState(false);
  const [showFreeBookingChat,setShowFreeBookingChat]=useState(false);
  const [freeBookingStep,setFreeBookingStep]=useState<'chat'|'confirm'|'done'>('chat');
  const [freeSelectedSlot,setFreeSelectedSlot]=useState('');
  const [fbClientName,setFbClientName]=useState('');
  const [fbClientPhone,setFbClientPhone]=useState('');
  const [freeChatMessages,setFreeChatMessages]=useState<{role:'bot'|'user';text:string}[]>([]);
  const [freeChatInput,setFreeChatInput]=useState('');
  const [freeBookings,setFreeBookings]=useSaved<BookingRecord[]>('pro_freeBookings',[]);
  const [aiName,setAiName]=useSaved<string>('classic_aiName','Алина');
  const [showAiNameEdit,setShowAiNameEdit]=useState(false);
  const [aiNameDraft,setAiNameDraft]=useState('');
  const ttsVoicesRef=useRef<SpeechSynthesisVoice[]>([]);
  const botTplIdxRef=useRef(Math.floor(Math.random()*BOT_SCRIPTS.length));

  /* ── Состояния редактирования Сертификатов ── */
  const [certEditId,setCertEditId]=useState<string|null>(null);
  const [certEditTitle,setCertEditTitle]=useState('');
  const [certEditImageUrl,setCertEditImageUrl]=useState('');
  const [certEditImagePrev,setCertEditImagePrev]=useState('');
  const [certEditUploading,setCertEditUploading]=useState(false);
  const certEditImgRef=useRef<HTMLInputElement>(null);

  /* ── Состояния редактирования FAQ ── */
  const [faqEditId,setFaqEditId]=useState<string|null>(null);
  const [faqEditQ,setFaqEditQ]=useState('');
  const [faqEditA,setFaqEditA]=useState('');

  /* ── Состояния редактирования Кейсов ── */
  const [caseEditId,setCaseEditId]=useState<string|null>(null);
  const [caseEditTitle,setCaseEditTitle]=useState('');
  const [caseEditDesc,setCaseEditDesc]=useState('');
  const [caseEditResult,setCaseEditResult]=useState('');
  const [caseEditImageUrl,setCaseEditImageUrl]=useState('');
  const [caseEditImagePrev,setCaseEditImagePrev]=useState('');
  const [caseEditUploading,setCaseEditUploading]=useState(false);
  const caseEditImgRef=useRef<HTMLInputElement>(null);

  /* ── Состояния редактирования Ссылок ── */
  const [linkEditId,setLinkEditId]=useState<string|null>(null);
  const [linkEditLabel,setLinkEditLabel]=useState('');
  const [linkEditUrl,setLinkEditUrl]=useState('');
  const [linkEditIcon,setLinkEditIcon]=useState('🔗');

  const seed=userHash.slice(0,14)||'default';
  const avatarSrc=avatarUrl||av(seed,100);

  const handleAvatarFile=(e:React.ChangeEvent<HTMLInputElement>)=>{
    const f=e.target.files?.[0];if(!f)return;
    const reader=new FileReader();
    reader.onload=ev=>setAvatarUrl(ev.target?.result as string);
    reader.readAsDataURL(f);e.target.value='';
  };

  const searchByCode=async()=>{
    if(!/^\d{9}$/.test(codeInput))return;
    setCodeLoading(true);setCodeResult(null);
    try{const res=await fetch(`${apiBase}/api/invite-code/${codeInput}`);setCodeResult(await res.json());}
    catch{setCodeResult({found:false});}
    setCodeLoading(false);
  };

  const toggleLike=async(id:string)=>{
    setPosts(prev=>prev.map(p=>p.id===id?{...p,liked:!p.liked,likes:p.liked?p.likes-1:p.likes+1}:p));
    try{
      await fetch(`${apiBase}/api/interactions/${id}/like`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session:userHash})});
    }catch{}
  };

  /* Публикация поста с медиа */
  const publish=async()=>{
    if(!draft.trim()&&!postMediaUrl)return;
    setPostUploading(true);
    try{
      let finalMedia='';let finalType:'photo'|'video'|''='';
      if(postMediaUrl){finalMedia=postMediaUrl;finalType=postMediaType;}
      const body:Record<string,string>={content:draft.trim()||'📝',authorMode:'pro'};
      if(finalType==='photo'&&finalMedia)body.imageUrl=finalMedia;
      const tok=getSessionToken()||'';
      let serverId:string|null=null;
      try{
        const r=await fetch(`${window.location.origin}/api/broadcasts`,{method:'POST',headers:{'Content-Type':'application/json','x-session-token':tok},body:JSON.stringify(body)});
        if(r.ok){const d=await r.json().catch(()=>null);if(d?.id)serverId=String(d.id);}
      }catch{}
      const newPost:Post={id:serverId||`p_${Date.now()}`,text:draft.trim(),likes:0,liked:false,comments:0,ts:'только что',img:finalType==='photo'?finalMedia:undefined};
      setPosts(prev=>[newPost,...prev]);
    }finally{
      setDraft('');setPostMediaUrl('');setPostMediaType('');setShowInput(false);setPostUploading(false);
    }
  };

  /* Загрузка медиа для поста */
  const handlePostMedia=async(e:React.ChangeEvent<HTMLInputElement>,type:'photo'|'video')=>{
    const f=e.target.files?.[0];if(!f)return;
    setPostUploading(true);
    const localUrl=URL.createObjectURL(f);setPostMediaUrl(localUrl);setPostMediaType(type);
    try{
      const endpoint=type==='video'?`${apiBase}/api/video-upload`:`${apiBase}/api/image-upload`;
      const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':f.type},body:f});
      if(r.ok){const d=await r.json();setPostMediaUrl(d.url||localUrl);}
    }catch{}
    setPostUploading(false);e.target.value='';
  };

  /* Загрузка обложки профиля */
  const handleCoverFile=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    const f=e.target.files?.[0];if(!f)return;
    const localUrl=URL.createObjectURL(f);
    const curY=parseInt((coverPosition||'50% 50%').split(' ')[1]||'50');
    setCropY(curY);
    setCoverCropSrc(localUrl);
    setCoverCropFinal('');
    setShowCoverCrop(true);
    setShowCoverPicker(false);
    try{
      const r=await fetch(`${apiBase}/api/image-upload`,{method:'POST',headers:{'Content-Type':f.type},body:f});
      if(r.ok){const d=await r.json();if(d.url)setCoverCropFinal(d.url);}
    }catch{}
    e.target.value='';
  };

  const applyCoverCrop=()=>{
    setCoverImageUrl(coverCropFinal||coverCropSrc);
    setCoverPosition(`50% ${cropY}%`);
    setShowCoverCrop(false);
  };

  /* Поиск по имени/нику */
  const searchByQuery=async(q:string)=>{
    if(!q.trim()){setSearchResults([]);return;}
    setSearchLoading(true);
    const cleanQ=q.startsWith('@')?q.slice(1):q;
    try{
      const r=await fetch(`${apiBase}/api/search?q=${encodeURIComponent(cleanQ)}&mode=pro`);
      const d=await r.json();
      setSearchResults((d.results||[]).map((x:any)=>({hash:x.hash,name:x.name||'Пользователь',handle:x.handle||'',avatar:x.avatar||'',bio:x.bio||''})));
    }catch{setSearchResults([]);}
    setSearchLoading(false);
  };

  /* Просмотр историй */
  const [viewingStoryIdx,setViewingStoryIdx]=useState<number|null>(null);
  const [storyProgress,setStoryProgress]=useState(0);
  const storyTimerRef=useRef<ReturnType<typeof setInterval>|null>(null);
  const storyVideoRef=useRef<HTMLVideoElement|null>(null);
  const storySwipeRef=useRef<{x:number;y:number}|null>(null);
  const viewingStory=viewingStoryIdx!==null?myStories[viewingStoryIdx]:null;

  const storyGo=(idx:number)=>{
    if(storyTimerRef.current){clearInterval(storyTimerRef.current);storyTimerRef.current=null;}
    if(idx<0||idx>=myStories.length){setViewingStoryIdx(null);setStoryProgress(0);return;}
    setViewingStoryIdx(idx);setStoryProgress(0);
  };
  const storyClose=()=>{
    if(storyTimerRef.current){clearInterval(storyTimerRef.current);storyTimerRef.current=null;}
    setViewingStoryIdx(null);setStoryProgress(0);
  };

  /* Запуск таймера для фото-историй */
  useEffect(()=>{
    if(viewingStoryIdx===null||!viewingStory)return;
    if(viewingStory.mediaType==='video')return; /* видео управляется onTimeUpdate */
    const DURATION=10000;
    const TICK=80;
    let elapsed=0;
    const iv=setInterval(()=>{
      elapsed+=TICK;
      setStoryProgress(Math.min(100,elapsed/DURATION*100));
      if(elapsed>=DURATION){
        clearInterval(iv);
        storyTimerRef.current=null;
        storyGo(viewingStoryIdx+1);
      }
    },TICK);
    storyTimerRef.current=iv;
    return ()=>{clearInterval(iv);storyTimerRef.current=null;};
  },[viewingStoryIdx]);/* eslint-disable-line */

  /* ── Камера для историй ── */
  useEffect(()=>{
    if(storyTab==='record'&&showStoryEditor){
      setCamBlob(null);setCamPreviewUrl(null);setCamSeconds(0);setCamError(null);
      if(camPhotoUrl){URL.revokeObjectURL(camPhotoUrl);}
      setCamPhotoBlob(null);setCamPhotoUrl(null);
      (async()=>{
        try{
          if(camStreamRef.current){camStreamRef.current.getTracks().forEach(t=>t.stop());}
          const stream=await navigator.mediaDevices.getUserMedia({
            video:{
              facingMode:camFacing,
              width:{ideal:1920},
              height:{ideal:1080},
              frameRate:{ideal:30},
            },
            audio:{
              echoCancellation:true,
              noiseSuppression:false,
              autoGainControl:false,
            }
          });
          camStreamRef.current=stream;
          if(camVideoRef.current){camVideoRef.current.srcObject=stream;}
          // Определяем диапазон зума
          const track=stream.getVideoTracks()[0];
          if(track){
            const caps=track.getCapabilities?.() as Record<string,unknown>|undefined;
            if(caps?.zoom&&typeof caps.zoom==='object'&&caps.zoom!==null){
              const z=caps.zoom as {max?:number};
              if(z.max&&z.max>1) setCamMaxZoom(Math.min(z.max,10));
            }
          }
          setCamZoom(1);
        }catch(e){setCamError('Нет доступа к камере. Разреши доступ в браузере.');}
      })();
    }else{
      if(camStreamRef.current){camStreamRef.current.getTracks().forEach(t=>t.stop());camStreamRef.current=null;}
      if(camTimerRef.current){clearInterval(camTimerRef.current);camTimerRef.current=null;}
      setCamRecording(false);setCamSeconds(0);
    }
  },[storyTab,showStoryEditor,camFacing]);// eslint-disable-line react-hooks/exhaustive-deps

  const flipCamera=()=>{ if(!camRecording){ setCamFacing(f=>f==='user'?'environment':'user'); setCamZoom(1); }};

  const applyZoom=(z:number)=>{
    const clamped=Math.max(1,Math.min(z,camMaxZoom));
    setCamZoom(clamped);
    // Нативный зум через applyConstraints (Chrome Android — нет потери качества)
    const track=camStreamRef.current?.getVideoTracks()[0];
    if(track){
      try{
        (track.applyConstraints as Function)({advanced:[{zoom:clamped}]}).catch(()=>{});
      }catch{}
    }
    // CSS scale как fallback — применяем ТОЛЬКО если zoom > 1
    // При zoom=1 убираем transform полностью (иначе браузер рендерит через GPU-текстуру → размытие)
    if(camVideoRef.current){
      if(clamped>1.01){
        camVideoRef.current.style.transform=`scale(${clamped})`;
        camVideoRef.current.style.transformOrigin='center center';
        camVideoRef.current.style.transition='transform 0.05s';
      }else{
        camVideoRef.current.style.transform='';
        camVideoRef.current.style.transformOrigin='';
        camVideoRef.current.style.transition='';
      }
    }
  };

  const onCamTouchStart=(e:React.TouchEvent)=>{
    if(e.touches.length===2){
      const dx=e.touches[0].clientX-e.touches[1].clientX;
      const dy=e.touches[0].clientY-e.touches[1].clientY;
      camPinchRef.current={dist:Math.hypot(dx,dy),zoom:camZoom};
    }
  };
  const onCamTouchMove=(e:React.TouchEvent)=>{
    if(e.touches.length===2&&camPinchRef.current){
      e.preventDefault();
      const dx=e.touches[0].clientX-e.touches[1].clientX;
      const dy=e.touches[0].clientY-e.touches[1].clientY;
      const dist=Math.hypot(dx,dy);
      const ratio=dist/camPinchRef.current.dist;
      applyZoom(camPinchRef.current.zoom*ratio);
    }
  };
  const onCamTouchEnd=()=>{ camPinchRef.current=null; };

  const capturePhoto=()=>{
    const video=camVideoRef.current;
    if(!video){setCamError('Камера не готова');return;}
    const canvas=document.createElement('canvas');
    canvas.width=video.videoWidth||1280;
    canvas.height=video.videoHeight||720;
    const ctx=canvas.getContext('2d');
    if(!ctx){setCamError('Ошибка снимка');return;}
    ctx.drawImage(video,0,0,canvas.width,canvas.height);
    canvas.toBlob(blob=>{
      if(!blob){setCamError('Не удалось сделать снимок');return;}
      if(camPhotoUrl)URL.revokeObjectURL(camPhotoUrl);
      setCamPhotoBlob(blob);
      setCamPhotoUrl(URL.createObjectURL(blob));
    },'image/jpeg',0.92);
  };

  /* ────── Overlay helpers ────── */
  const resetOverlays=()=>{setOvItems([]);setOvSelId(null);setOvShowText(false);setOvTxtDraft('');setOvShowStickers(false);};

  const ovAddSticker=(def:{emoji:string;label:string;textContent?:string})=>{
    const id=Math.random().toString(36).slice(2);
    if(def.textContent){
      /* Текстовый стикер — добавляем как text overlay с фоном-пиллом */
      setOvItems(prev=>[...prev,{id,type:'text',text:def.textContent!,color:'#ffffff',bg:'rgba(0,0,0,0.55)',x:50,y:50,scale:1}]);
    }else{
      setOvItems(prev=>[...prev,{id,type:'sticker',emoji:def.emoji,label:def.label,x:50,y:50,scale:1}]);
    }
    setOvSelId(id);
    setOvShowStickers(false);
  };

  const ovAddText=()=>{
    if(!ovTxtDraft.trim())return;
    const id=Math.random().toString(36).slice(2);
    setOvItems(prev=>[...prev,{id,type:'text',text:ovTxtDraft.trim(),color:ovTxtColor,x:50,y:50,scale:1}]);
    setOvSelId(id);
    setOvShowText(false);setOvTxtDraft('');
  };

  const ovResize=(id:string,delta:number)=>{
    setOvItems(prev=>prev.map(it=>it.id===id?{...it,scale:Math.max(0.5,Math.min(4,it.scale+delta))}:it));
  };

  const ovDelete=(id:string)=>{
    setOvItems(prev=>prev.filter(it=>it.id!==id));
    setOvSelId(null);
  };

  const ovTouchStart=(e:React.TouchEvent,id:string,ox:number,oy:number)=>{
    e.stopPropagation();
    const t=e.touches[0];
    ovDragRef.current={id,sx:t.clientX,sy:t.clientY,ox,oy};
    setOvSelId(id);
  };

  const ovTouchMove=(e:React.TouchEvent)=>{
    /* ── Pinch-to-zoom + rotate: два пальца масштабируют и поворачивают ── */
    if(e.touches.length>=2&&ovSelId){
      const t0=e.touches[0],t1=e.touches[1];
      const dist=Math.hypot(t1.clientX-t0.clientX,t1.clientY-t0.clientY);
      const angle=Math.atan2(t1.clientY-t0.clientY,t1.clientX-t0.clientX)*(180/Math.PI);
      if(!ovPinchRef.current||ovPinchRef.current.id!==ovSelId){
        const item=ovItems.find(it=>it.id===ovSelId);
        if(item)ovPinchRef.current={id:ovSelId,startDist:dist,startScale:item.scale,startAngle:angle,startRotate:item.rotate||0};
      }else{
        const sc=ovPinchRef.current.startScale*(dist/Math.max(1,ovPinchRef.current.startDist));
        const rot=ovPinchRef.current.startRotate+(angle-ovPinchRef.current.startAngle);
        setOvItems(prev=>prev.map(it=>it.id===ovSelId?{...it,scale:Math.max(0.3,Math.min(5,sc)),rotate:rot}:it));
      }
      ovDragRef.current=null;
      return;
    }
    /* ── Single-finger drag ── */
    const drag=ovDragRef.current;if(!drag||!ovContainerRef.current)return;
    const rect=ovContainerRef.current.getBoundingClientRect();
    const t=e.touches[0];
    const nx=drag.ox+(t.clientX-drag.sx)/rect.width*100;
    const ny=drag.oy+(t.clientY-drag.sy)/rect.height*100;
    setOvItems(prev=>prev.map(it=>it.id===drag.id?{...it,x:Math.max(5,Math.min(95,nx)),y:Math.max(5,Math.min(95,ny))}:it));
  };

  const ovTouchEnd=()=>{ovDragRef.current=null;ovPinchRef.current=null;};

  /* Compositing для фото: сжигаем текст и стикеры в изображение */
  const compositePhoto=async(imgUrl:string):Promise<Blob>=>{
    return new Promise((resolve,reject)=>{
      const img=new Image();
      /* НЕ ставим crossOrigin для blob: URL — это вызывает canvas taint в некоторых браузерах */
      if(!imgUrl.startsWith('blob:'))img.crossOrigin='anonymous';
      img.onload=()=>{
        try{
          /* Ограничиваем размер холста — 2048px на длинную сторону */
          const MAX=2048;
          let w=img.width,h=img.height;
          if(w>MAX||h>MAX){const r=Math.min(MAX/w,MAX/h);w=Math.round(w*r);h=Math.round(h*r);}
          const canvas=document.createElement('canvas');
          canvas.width=w;canvas.height=h;
          const ctx=canvas.getContext('2d');
          if(!ctx){reject(new Error('no ctx'));return;}
          ctx.drawImage(img,0,0,w,h);
          /* Рендерим оверлеи */
          ovItems.forEach(it=>{
            const px=it.x/100*w;
            const py=it.y/100*h;
            ctx.save();
            ctx.translate(px,py);
            if(it.rotate)ctx.rotate(it.rotate*Math.PI/180);
            if(it.type==='sticker'&&it.emoji){
              const sz=Math.round(80*it.scale*(w/390));
              ctx.font=`${sz}px serif`;
              ctx.textAlign='center';ctx.textBaseline='middle';
              ctx.fillText(it.emoji,0,0);
            }else if(it.type==='text'&&it.text){
              const sz=Math.round(32*it.scale*(w/390));
              ctx.font=`bold ${sz}px sans-serif`;
              ctx.textAlign='center';ctx.textBaseline='middle';
              const mw=ctx.measureText(it.text).width;
              /* Фон-пилл */
              const pad=Math.round(10*it.scale);
              const rh=sz*1.4+pad;
              if(it.bg){
                ctx.fillStyle=it.bg;
                ctx.beginPath();
                const rx=-mw/2-pad,ry=-rh/2;
                const rw2=mw+pad*2,rr=rh/2;
                ctx.roundRect?ctx.roundRect(rx,ry,rw2,rh,rr):(ctx.fillRect(rx,ry,rw2,rh));
                ctx.fill();
              }else{
                ctx.fillStyle='rgba(0,0,0,0.45)';
                ctx.beginPath();
                const rx=-mw/2-pad,ry=-rh/2;
                const rw2=mw+pad*2,rr=rh/2;
                ctx.roundRect?ctx.roundRect(rx,ry,rw2,rh,rr):(ctx.fillRect(rx,ry,rw2,rh));
                ctx.fill();
              }
              ctx.fillStyle=it.color||'#fff';
              ctx.fillText(it.text,0,0);
            }
            ctx.restore();
          });
          try{
            canvas.toBlob(b=>{if(b)resolve(b);else reject(new Error('blob null'));},'image/jpeg',0.92);
          }catch(blobErr){reject(blobErr);}
        }catch(drawErr){reject(drawErr);}
      };
      img.onerror=reject;
      img.src=imgUrl;
    });
  };
  /* ────────────────────────────── */

  const uploadCamPhoto=async()=>{
    if(!camPhotoBlob)return;
    let blob:Blob=camPhotoBlob;
    /* Сжигаем стикеры/текст в изображение (canvas composite) */
    if(ovItems.length>0&&camPhotoUrl){
      try{blob=await compositePhoto(camPhotoUrl);}catch{/* fallback to original */}
    }
    const file=new File([blob],`photo_${Date.now()}.jpg`,{type:'image/jpeg'});
    const txt=ovItems.filter(it=>it.type==='text').map(it=>it.text).join(' ').trim();
    await submitStory('image',file,txt||undefined);
  };

  const resetCamPhoto=()=>{
    if(camPhotoUrl)URL.revokeObjectURL(camPhotoUrl);
    setCamPhotoBlob(null);setCamPhotoUrl(null);setCamError(null);
  };

  const startCamRecording=()=>{
    const stream=camStreamRef.current;if(!stream){setCamError('Камера не запущена');return;}
    setCamError(null);camChunksRef.current=[];

    /* Выбираем лучший поддерживаемый кодек */
    const mimeTypes=[
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/mp4;codecs=avc1,mp4a',
      'video/webm',
      '',
    ];
    const mime=mimeTypes.find(t=>t===''||MediaRecorder.isTypeSupported(t))||'';

    /* Высокий битрейт: 8 Мбит/с видео + 192 кбит/с аудио */
    const opts:MediaRecorderOptions={};
    if(mime) opts.mimeType=mime;
    opts.videoBitsPerSecond=4_000_000;
    opts.audioBitsPerSecond=128_000;

    let mr:MediaRecorder;
    try{mr=new MediaRecorder(stream,opts);}
    catch{
      /* Fallback без битрейта — хотя бы запишем */
      try{mr=new MediaRecorder(stream,mime?{mimeType:mime}:{});}
      catch{setCamError('Браузер не поддерживает запись видео');return;}
    }

    mr.ondataavailable=(e:BlobEvent)=>{if(e.data&&e.data.size>0)camChunksRef.current.push(e.data);};
    mr.onerror=()=>{setCamError('Ошибка записи');setCamRecording(false);if(camTimerRef.current){clearInterval(camTimerRef.current);camTimerRef.current=null;}};
    mr.onstop=()=>{
      if(camTimerRef.current){clearInterval(camTimerRef.current);camTimerRef.current=null;}
      setCamRecording(false);setCamSeconds(0);
      const chunks=camChunksRef.current;
      if(chunks.length===0){setCamError('Не удалось записать видео — попробуй снова');return;}
      const blobType=mr.mimeType||mime||'video/webm';
      const rawBlob=new Blob(chunks,{type:blobType});
      if(rawBlob.size===0){setCamError('Запись пустая, попробуй снова');return;}
      /* Останавливаем стрим только ПОСЛЕ создания blob */
      if(camStreamRef.current){camStreamRef.current.getTracks().forEach(t=>t.stop());camStreamRef.current=null;}
      setCamBlob(rawBlob);setCamPreviewUrl(URL.createObjectURL(rawBlob));
    };

    /* timeslice=250ms — данные чаще, надёжнее на мобиле */
    camRecorderRef.current=mr;
    camStartTimeRef.current=Date.now();
    mr.start(250);
    setCamRecording(true);setCamSeconds(0);
    camTimerRef.current=setInterval(()=>setCamSeconds(s=>s+1),1000);
  };
  const stopCamRecording=()=>{
    const mr=camRecorderRef.current;if(!mr||mr.state==='inactive')return;
    if(camTimerRef.current){clearInterval(camTimerRef.current);camTimerRef.current=null;}
    mr.requestData();mr.stop();
  };
  const resetCamRecording=()=>{
    if(camPreviewUrl)URL.revokeObjectURL(camPreviewUrl);
    setCamBlob(null);setCamPreviewUrl(null);setCamRecording(false);setCamSeconds(0);setCamError(null);
    (async()=>{
      try{
        if(camStreamRef.current){camStreamRef.current.getTracks().forEach(t=>t.stop());}
        const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:camFacing},audio:true});
        camStreamRef.current=stream;if(camVideoRef.current){camVideoRef.current.srcObject=stream;}
      }catch{setCamError('Нет доступа к камере');}
    })();
  };

  /* Отправка истории (все типы) */
  const submitStory=async(mediaType:'video'|'image'|'text',file?:File,overlayText?:string,overlayItemsArg?:StoryOverlayItem[])=>{
    setStoryUploading(true);
    setStoryError(null);
    setUploadProgress(0);
    try{
      let mediaUrl:string|undefined;
      if(file){
        const base=window.location.origin;
        const tok=getSessionToken()||'';
        if(mediaType==='video'){
          /* Прямая загрузка видео одним запросом */
          setUploadProgress(20);
          let vr:Response;
          try{
            vr=await fetch(`${base}/api/video-upload`,{
              method:'POST',
              headers:{
                'Content-Type':file.type||'video/mp4',
                'x-filename':file.name.replace(/[^a-zA-Z0-9.\-_ ]/g,'_'),
                'x-session-token':tok,
              },
              body:file,
            });
          }catch(e){
            throw new Error('Нет связи с сервером. Попробуй ещё раз.');
          }
          setUploadProgress(90);
          if(!vr.ok){let m='Ошибка загрузки видео';try{const d=await vr.json();if(d.error)m=d.error;}catch{}throw new Error(m);}
          const{url}=await vr.json();mediaUrl=url;
          setUploadProgress(100);
        }else{
          const up=await fetch(`${base}/api/image-upload`,{method:'POST',headers:{'Content-Type':file.type||'image/jpeg','x-session-token':tok},body:file});
          if(!up.ok){
            let msg='Ошибка загрузки фото';
            try{const d=await up.json();if(d.error)msg=d.error;}catch{}
            throw new Error(msg);
          }
          const{url}=await up.json();mediaUrl=url;
        }
      }
      /* Сохраняем в localStorage (offline-first) */
      const savedText=mediaType==='text'?storyText.trim():(overlayText||'');
      const savedOverlays=overlayItemsArg&&overlayItemsArg.length>0?overlayItemsArg:undefined;
      const newS:MyStory={
        id:`s_${Date.now()}`,
        text:savedText,
        bgColor:STORY_TEXT_BG[storyBgIdx],
        mediaUrl:mediaUrl||'',
        mediaType:mediaType==='text'?'':mediaType==='video'?'video':'photo',
        ts:Date.now(),
        overlayItems:savedOverlays,
      };
      setMyStories(prev=>[newS,...prev.slice(0,19)]);
      /* Попытка записать на сервер (не блокирует) */
      try{
        const body:Record<string,string>={mediaType};
        if(mediaUrl)body.mediaUrl=mediaUrl;
        if(savedText)body.textContent=savedText;
        if(mediaType==='text')body.bgGradient=STORY_TEXT_BG[storyBgIdx];
        if(savedOverlays)body.overlayItems=JSON.stringify(savedOverlays);
        await fetch(`${window.location.origin}/api/stories`,{method:'POST',headers:{'content-type':'application/json','x-session-token':getSessionToken()||''},body:JSON.stringify(body)});
      }catch{}
      setStoryText('');setStoryBgIdx(0);
      resetOverlays();setGalFile(null);setGalBuffer(null);if(galUrl){URL.revokeObjectURL(galUrl);setGalUrl(null);}setGalType(null);
      setStorySuccess(true);
      setTimeout(()=>{setStorySuccess(false);setShowStoryEditor(false);},1200);
    }catch(err){
      setStoryError(err instanceof Error?err.message:'Не удалось опубликовать историю');
    }
    finally{setStoryUploading(false);}
  };

  const uploadCamStory=async()=>{
    if(!camBlob)return;
    const blobType=camBlob.type||'video/webm';
    const ext=blobType.includes('mp4')?'mp4':'webm';
    const file=new File([camBlob],`story_${Date.now()}.${ext}`,{type:blobType});
    const txt=ovItems.filter(it=>it.type==='text').map(it=>it.text).join(' ').trim();
    await submitStory('video',file,txt||undefined,ovItems.length>0?ovItems:undefined);
  };

  /* ── TTS Голос Алины ── */
  useEffect(()=>{
    if(!('speechSynthesis' in window))return;
    const load=()=>{ttsVoicesRef.current=window.speechSynthesis.getVoices();};
    load();
    window.speechSynthesis.addEventListener('voiceschanged',load);
    return()=>window.speechSynthesis.removeEventListener('voiceschanged',load);
  },[]);
  const speakGreeting=useCallback((text:string)=>{
    if(!('speechSynthesis' in window))return;
    window.speechSynthesis.cancel();
    const clean=text.replace(/[^\u0020-\u007E\u00A0-\u024F\u0400-\u04FF\s]/g,'').trim();
    const utt=new SpeechSynthesisUtterance(clean);
    utt.lang='ru-RU';utt.rate=0.92;utt.pitch=1.05;
    const voices=ttsVoicesRef.current.length>0?ttsVoicesRef.current:window.speechSynthesis.getVoices();
    const ruVoice=voices.find(v=>v.lang.startsWith('ru'));
    if(ruVoice)utt.voice=ruVoice;
    window.speechSynthesis.speak(utt);
  },[]);

  /* ── Кастомизация виджетов ── */
  const [widgetLabels,setWidgetLabels]=useSaved<Record<string,string>>('sw_widget_labels_v2',{});
  const [widgetPreviews,setWidgetPreviews]=useSaved<Record<string,string>>('sw_widget_previews_v2',{});
  const [uploadingWKey,setUploadingWKey]=useState<string|null>(null);
  const widgetPreviewRef=useRef<HTMLInputElement>(null);

  const WIDGET_LIST=[
    {key:'music',   icon:'🎵',label:'Музыка',    count:playlist.length},
    {key:'works',   icon:'🎨',label:'Работы',    count:classicWorks.length},
    {key:'reviews', icon:'⭐',label:'Отзывы',    count:classicReviews.length},
    {key:'booking', icon:'📅',label:'Записаться',count:priceItems.reduce((s,p)=>s+p.slots.filter(sl=>!bookings.some(b=>b.slot===sl&&b.itemId===p.id)).length,0)+freeSlots.length},
    {key:'prices',  icon:'💰',label:'Прайс',     count:priceItems.length},
    {key:'certs',   icon:'📜',label:'Дипломы',   count:classicCerts.length},
    {key:'cases',   icon:'📂',label:'Кейсы',     count:classicCases.length},
    {key:'faqs',    icon:'❓',label:'FAQ',        count:classicFaq.length},
    {key:'links',   icon:'🔗',label:'Ссылки',    count:classicLinks.length},
  ];

  const wLabel=(key:string,fallback:string)=>widgetLabels[key]??fallback;
  const wPreview=(key:string)=>widgetPreviews[key]??'';
  const wOnPreview=(key:string)=>{setUploadingWKey(key);widgetPreviewRef.current?.click();};
  const wOnLabel=(key:string)=>(v:string)=>setWidgetLabels({...widgetLabels,[key]:v});

  return(
    <CallCtx.Provider value={call}>

    {/* ═══ ЭКРАН: ИГРЫ ═══ */}
    {currentScreen==='games'&&(
      <GamesArcade accentColor={activeAccent} onBack={()=>setCurrentScreen('home')}/>
    )}

    {/* ═══ ЭКРАН: МИТИНГИ ═══ */}
    {currentScreen==='meetings'&&(
      <div style={{position:'fixed',inset:0,zIndex:800}}>
        <MeetingsScreen apiBase={apiBase} userHash={userHash} onBack={()=>setCurrentScreen('home')}/>
      </div>
    )}

    {/* ═══ ЭКРАН: БИРЖА SWP ═══ */}
    {currentScreen==='exchange'&&(
      <SwpExchange
        apiBase={apiBase}
        userHash={userHash}
        sessionToken={getSessionToken()||''}
        accent={activeAccent}
        onBack={()=>setCurrentScreen('home')}
      />
    )}

    {/* ═══ ЭКРАН: Я СЛЫШУ ═══ */}
    {currentScreen==='assistant'&&(
      <AccessibilityAssistant
        accent={activeAccent}
        onBack={()=>setCurrentScreen('home')}
        apiBase={apiBase}
      />
    )}

    {/* ═══ ЭКРАН: СООБЩЕНИЯ ═══ */}
    {navTab==='messages'&&currentScreen==='home'&&(
      <div style={{position:'fixed',inset:0,zIndex:800}}>
        <MessagesScreen myHash={userHash} accent="#3b82f6"
          onBack={()=>{setNavTab('home');setChatTarget(null);setSecretChatTarget(null);}}
          openChatWith={chatTarget||undefined}
          openSecretChatWith={secretChatTarget||undefined}
          onViewProfile={hash=>{ setProfileViewHash(hash); }}
          onFindPeople={()=>{ setNavTab('home'); setTimeout(()=>{ setShowSearch(true); setSearchQ(''); setCodeInput(''); setCodeResult(null); },120); }}/>
        <CallOverlayUI call={call} peerInfo={callPeerInfo} apiBase={apiBase}/>
      </div>
    )}

    {/* ═══ ЭКРАН: КАНАЛЫ ═══ */}
    {navTab==='channels'&&currentScreen==='home'&&(
      <div style={{position:'fixed',inset:0,zIndex:800,overflowY:'auto',
        background:c.bg,display:'flex',flexDirection:'column'}}>
        <ChannelsScreen
          userHash={userHash}
          isDark={isDark}
          c={c}
          accent={activeAccent}
          userName={profName}
          userAvatar={avatarSrc||undefined}
          isActive={navTab==='channels'}
        />
      </div>
    )}

    {/* ═══ ЭКРАН: БРАУЗЕР SWAIP ═══ */}
    {navTab==='browser'&&currentScreen==='home'&&(()=>{
      const SPEED_DIAL=[
        {ico:'🔍',label:'Google',url:'https://www.google.com'},
        {ico:'📹',label:'YouTube',url:'https://www.youtube.com'},
        {ico:'📰',label:'Яндекс',url:'https://yandex.ru'},
        {ico:'📡',label:'VK',url:'https://vk.com'},
        {ico:'🤖',label:'ChatGPT',url:'https://chatgpt.com'},
        {ico:'🌍',label:'Wikipedia',url:'https://ru.wikipedia.org'},
        {ico:'🛒',label:'Wildberries',url:'https://wildberries.ru'},
        {ico:'🗺️',label:'Я.Карты',url:'https://maps.yandex.ru'},
      ];
      const canBack=browserHistIdx>0;
      const canFwd=browserHistIdx<browserHistory.length-1;
      const displayHost=()=>{if(!browserUrl)return '';try{return new URL(browserUrl).hostname;}catch{return browserUrl;}};
      return(
        <div style={{position:'fixed',inset:0,zIndex:800,display:'flex',flexDirection:'column',
          background:isDark?'#08080f':'#f0f0f8'}}>

          {/* Адресная строка */}
          <div style={{background:isDark?'rgba(12,12,24,0.97)':'rgba(248,248,255,0.97)',
            backdropFilter:'blur(20px)',borderBottom:`1px solid ${c.border}`,
            padding:'max(14px,env(safe-area-inset-top)) 10px 8px',display:'flex',alignItems:'center',gap:6,flexShrink:0}}>

            {/* Назад */}
            <motion.button whileTap={{scale:0.85}} disabled={!canBack}
              onClick={()=>{if(canBack){const ni=browserHistIdx-1;setBrowserHistIdx(ni);browserNav(browserHistory[ni]);}}}
              style={{width:34,height:34,borderRadius:10,background:'none',border:'none',cursor:canBack?'pointer':'default',
                color:canBack?c.mid:'transparent',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              ‹
            </motion.button>

            {/* Вперёд */}
            <motion.button whileTap={{scale:0.85}} disabled={!canFwd}
              onClick={()=>{if(canFwd){const ni=browserHistIdx+1;setBrowserHistIdx(ni);browserNav(browserHistory[ni]);}}}
              style={{width:34,height:34,borderRadius:10,background:'none',border:'none',cursor:canFwd?'pointer':'default',
                color:canFwd?c.mid:'transparent',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              ›
            </motion.button>

            {/* URL bar */}
            <div style={{flex:1,background:isDark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)',
              borderRadius:12,border:`1px solid ${c.border}`,display:'flex',alignItems:'center',overflow:'hidden'}}>
              <span style={{fontSize:13,paddingLeft:10,flexShrink:0,opacity:0.5}}>🔒</span>
              <input ref={browserInputRef}
                value={browserInput!==''?browserInput:displayHost()}
                onChange={e=>setBrowserInput(e.target.value)}
                onFocus={()=>setBrowserInput(browserUrl||'')}
                onBlur={()=>setBrowserInput('')}
                onKeyDown={e=>{if(e.key==='Enter'){browserInputRef.current?.blur();browserGo(browserInput);}}}
                style={{flex:1,background:'none',border:'none',outline:'none',color:c.light,
                  fontSize:13,padding:'8px 6px',fontFamily:'monospace',minWidth:0}}
                placeholder="Поиск или адрес сайта..."
                spellCheck={false} autoCapitalize="none"
              />
              {browserLoading&&<motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:0.8,ease:'linear'}}
                style={{width:16,height:16,borderRadius:'50%',border:`2px solid ${activeAccent}`,borderTopColor:'transparent',
                  marginRight:8,flexShrink:0}}/>}
              {!browserLoading&&<motion.button whileTap={{scale:0.85}} onClick={()=>browserNav(browserUrl)}
                style={{background:'none',border:'none',cursor:'pointer',color:c.sub,fontSize:16,padding:'4px 8px',flexShrink:0}}>↺</motion.button>}
            </div>

            {/* Поделиться */}
            <motion.button whileTap={{scale:0.88}} onClick={()=>{try{navigator.share?.({url:browserUrl,title:displayHost()});}catch{}}}
              style={{width:34,height:34,borderRadius:10,background:'none',border:'none',cursor:'pointer',
                color:c.mid,fontSize:17,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              ↗
            </motion.button>

            {/* Открыть в реальном браузере */}
            <motion.button whileTap={{scale:0.88}} onClick={()=>window.open(browserUrl,'_blank')}
              style={{width:34,height:34,borderRadius:10,background:'none',border:'none',cursor:'pointer',
                color:c.sub,fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              ⤤
            </motion.button>
          </div>

          {/* Прогресс-бар */}
          <AnimatePresence>
            {browserLoading&&(
              <motion.div initial={{scaleX:0}} animate={{scaleX:1}} exit={{opacity:0}} transition={{duration:2,ease:'linear'}}
                style={{height:2,background:`linear-gradient(90deg,${activeAccent},${activeAccent}88)`,transformOrigin:'left',flexShrink:0}}
                onAnimationComplete={()=>setBrowserLoading(false)}/>
            )}
          </AnimatePresence>

          {/* Контент */}
          {browserUrl?(
            <iframe
              ref={browserRef}
              key={browserUrl}
              src={mkProxyUrl(browserUrl)}
              style={{flex:1,border:'none',background:isDark?'#111':'#fff'}}
              onLoad={()=>setBrowserLoading(false)}
              onError={()=>setBrowserLoading(false)}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals"
              title="SWAIP Browser"
            />
          ):(
            <div style={{flex:1}}/>
          )}

          {/* Стартовая страница — показывается когда url пустой */}
          {!browserUrl&&!browserLoading&&(
            <div style={{position:'absolute',inset:0,top:72,background:isDark?'#08080f':'#f4f4fc',
              display:'flex',flexDirection:'column',alignItems:'center',padding:'40px 20px 100px',overflowY:'auto'}}>
              <div style={{fontSize:40,marginBottom:4}}>🌐</div>
              <div style={{fontSize:22,fontWeight:900,color:c.light,marginBottom:4,letterSpacing:'-0.02em'}}>SWAIP Browser</div>
              <div style={{fontSize:12,color:c.sub,marginBottom:28}}>Быстрый · Безопасный · Встроенный</div>
              {/* Строка поиска на главной */}
              <div style={{width:'100%',maxWidth:360,background:isDark?'rgba(255,255,255,0.08)':'#fff',
                borderRadius:24,border:`1.5px solid ${c.border}`,display:'flex',alignItems:'center',
                padding:'8px 16px',gap:8,boxShadow:'0 4px 24px rgba(0,0,0,0.12)',marginBottom:32}}>
                <span style={{fontSize:18}}>🔍</span>
                <input style={{flex:1,background:'none',border:'none',outline:'none',color:c.light,fontSize:15,fontFamily:'inherit'}}
                  placeholder="Поиск в интернете..."
                  onKeyDown={e=>{if(e.key==='Enter')browserGo((e.target as HTMLInputElement).value);}}/>
              </div>
              {/* Speed dial */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,width:'100%',maxWidth:360}}>
                {SPEED_DIAL.map(s=>(
                  <motion.button key={s.url} whileTap={{scale:0.88}} onClick={()=>browserGo(s.url)}
                    style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,padding:'14px 8px',
                      borderRadius:16,background:isDark?'rgba(255,255,255,0.06)':'#fff',
                      border:`1px solid ${c.border}`,cursor:'pointer',boxShadow:'0 2px 12px rgba(0,0,0,0.08)'}}>
                    <span style={{fontSize:26}}>{s.ico}</span>
                    <span style={{fontSize:10,fontWeight:700,color:c.mid,letterSpacing:'0.01em'}}>{s.label}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    })()}


    <div style={{minHeight:'100dvh',background:c.bg,display:'flex',alignItems:'flex-start',justifyContent:'center',
      fontFamily:"'Inter','Helvetica Neue',Arial,sans-serif",transition:'background 0.3s'}}>

    {/* Рамка на весь экран */}
    <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:999,
      border:`2.5px solid ${c.frameBorder}`,
      boxShadow:`inset 0 0 0 1px ${isDark?'rgba(255,255,255,0.03)':'rgba(0,0,0,0.03)'}`}}/>

    {/* Боковое меню */}
    <SideMenu open={showSideMenu} onClose={()=>setShowSideMenu(false)} onOldMode={onOldMode} onLogout={onLogout} onMeetings={()=>setCurrentScreen('meetings')} onDesign={()=>setShowDesignModal(true)} onExchange={()=>setCurrentScreen('exchange')} onAssistant={()=>setCurrentScreen('assistant')} onBrowser={()=>setNavTab('browser')} onGames={()=>setCurrentScreen('games')} c={c} ringtoneId={ringtoneId} onRingtoneChange={(id)=>setRingtoneId(id as RingtoneId)}/>

    {/* Шит поделиться */}
    <AnimatePresence>
      {showShare&&<ShareSheet userHash={userHash} name={profName} onClose={()=>setShowShare(false)}/>}
    </AnimatePresence>

    {/* ═══ ПОЛНЫЙ ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ ИЗ ПОИСКА ═══ */}
    <AnimatePresence>
      {profileViewHash&&<UserProfileSheet
        hash={profileViewHash}
        fallback={profileViewFallback||undefined}
        c={c}
        accent={activeAccent}
        apiBase={apiBase}
        onClose={()=>{setProfileViewHash(null);setProfileViewFallback(null);}}
        onMessage={(h,n)=>{
          const foundResult=searchResults.find(r=>r.hash===h);
          const avatar=foundResult?.avatar||av(h.slice(0,14)||'u',80);
          setChatTarget({hash:h,info:{name:n,avatar,handle:foundResult?.handle||''}});
          setSecretChatTarget(null);
          setNavTab('messages');
          setProfileViewHash(null);
        }}
        onSecretChat={(h,n)=>{
          const foundResult=searchResults.find(r=>r.hash===h);
          const avatar=foundResult?.avatar||av(h.slice(0,14)||'u',80);
          setSecretChatTarget({hash:h,info:{name:n,avatar,handle:foundResult?.handle||''}});
          setChatTarget(null);
          setNavTab('messages');
          setProfileViewHash(null);
        }}
        onCall={(h,n)=>{
          const foundResult=searchResults.find(r=>r.hash===h);
          const avatar=foundResult?.avatar||av(h.slice(0,14)||'u',80);
          setCallPeerInfo({name:n,avatar});
          call.startCall(h,'video');
          setProfileViewHash(null);
        }}
      />}
    </AnimatePresence>

    {/* ═══ ШИТ КОММЕНТАРИЕВ ═══ */}
    <AnimatePresence>
      {commentPostId&&<CommentsSheet
        postId={commentPostId}
        session={userHash}
        authorHash={userHash}
        authorName={profName}
        authorNick={profNick}
        authorAvatar={avatarSrc}
        apiBase={apiBase}
        c={c}
        accent={activeAccent}
        onClose={()=>setCommentPostId(null)}
        onCountChange={(pid,count)=>setPosts(prev=>prev.map(p=>p.id===pid?{...p,comments:count}:p))}
        onOpenProfile={h=>{setProfileViewHash(h);setCommentPostId(null);}}
      />}
    </AnimatePresence>

    {/* ═══ МОДАЛ: НОВАЯ ИСТОРИЯ ═══ */}
    <AnimatePresence>
      {showStoryEditor&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          style={{position:'fixed',inset:0,zIndex:1100,background:'rgba(0,0,0,0.92)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-start'}}>
          {/* Шапка */}
          <div style={{width:'100%',maxWidth:430,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 16px 10px',background:'rgba(0,0,0,0.4)',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
            <motion.button whileTap={{scale:0.88}} onClick={()=>{setShowStoryEditor(false);setStoryText('');setStoryBgIdx(0);}}
              style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.7)',fontSize:20,lineHeight:1,padding:'2px 4px'}}>✕</motion.button>
            <span style={{fontWeight:900,fontSize:14,color:'#fff',letterSpacing:'0.12em',textTransform:'uppercase'}}>Новая история</span>
            <div style={{width:32}}/>
          </div>

          {/* Табы */}
          <div style={{width:'100%',maxWidth:430,display:'flex',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
            {([['record','📹 Камера'],['video','🎬 Видео'],['image','🖼 Фото'],['text','✍️ Текст']] as [typeof storyTab,string][]).map(([t,label])=>(
              <button key={t} onClick={()=>{setStoryTab(t);setStoryError(null);setStorySuccess(false);}}
                style={{flex:1,padding:'10px 0',background:'none',border:'none',cursor:'pointer',fontSize:10,fontWeight:700,
                  color:storyTab===t?'#fff':'rgba(255,255,255,0.35)',borderBottom:storyTab===t?'2px solid #fff':'2px solid transparent',
                  letterSpacing:'0.03em',transition:'color 0.15s'}}>
                {label}
              </button>
            ))}
          </div>

          {/* Тело */}
          <div style={{flex:1,width:'100%',maxWidth:430,
            overflowY:storyTab==='record'?'hidden':'auto',
            display:'flex',flexDirection:'column',minHeight:0}}>

            {/* ─── Камера ─── */}
            {storyTab==='record'&&(
              <div style={{flex:1,position:'relative',overflow:'hidden',background:'#000',minHeight:0}}>

                {/* ── Режим просмотра ФОТО-превью ── */}
                {camPhotoUrl&&!storySuccess&&(
                  <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column'}}>
                    <div ref={ovContainerRef} style={{flex:1,position:'relative',overflow:'hidden',minHeight:0,background:'#000',touchAction:'none'}}
                      onTouchMove={ovTouchMove as React.TouchEventHandler<HTMLDivElement>}
                      onTouchEnd={ovTouchEnd}
                      onClick={()=>setOvSelId(null)}>
                      <img src={camPhotoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'contain'}}/>
                      {/* Оверлеи */}
                      {ovItems.map(it=>(
                        <div key={it.id}
                          onTouchStart={e=>ovTouchStart(e,it.id,it.x,it.y)}
                          onClick={e=>{e.stopPropagation();setOvSelId(it.id);}}
                          style={{position:'absolute',left:`${it.x}%`,top:`${it.y}%`,
                            transform:`translate(-50%,-50%) scale(${it.scale}) rotate(${it.rotate||0}deg)`,
                            cursor:'grab',zIndex:5,userSelect:'none',touchAction:'none',
                            border:ovSelId===it.id?'2px dashed rgba(255,255,255,0.7)':'2px solid transparent',
                            borderRadius:8,padding:4}}>
                          {it.type==='sticker'
                            ?<span style={{fontSize:52,lineHeight:1,display:'block'}}>{it.emoji}</span>
                            :<div style={{background:it.bg||'transparent',borderRadius:99,padding:it.bg?'5px 14px':'0',display:'inline-block'}}>
                              <span style={{fontSize:22,fontWeight:900,color:it.color||'#fff',textShadow:it.bg?'none':'0 2px 8px rgba(0,0,0,0.8)',whiteSpace:'nowrap',display:'block'}}>{it.text}</span>
                             </div>
                          }
                          {ovSelId===it.id&&(
                            <div style={{position:'absolute',top:-40,left:'50%',transform:'translateX(-50%)',
                              display:'flex',gap:4,background:'rgba(0,0,0,0.85)',borderRadius:99,padding:'5px 8px',whiteSpace:'nowrap'}}>
                              <button onClick={e=>{e.stopPropagation();ovResize(it.id,-0.25);}}
                                style={{background:'none',border:'none',color:'#fff',fontSize:18,cursor:'pointer',padding:'0 4px',lineHeight:1}}>−</button>
                              <button onClick={e=>{e.stopPropagation();ovResize(it.id,+0.25);}}
                                style={{background:'none',border:'none',color:'#fff',fontSize:18,cursor:'pointer',padding:'0 4px',lineHeight:1}}>+</button>
                              <button onClick={e=>{e.stopPropagation();ovDelete(it.id);}}
                                style={{background:'none',border:'none',color:'#f87171',fontSize:16,cursor:'pointer',padding:'0 4px',lineHeight:1}}>🗑</button>
                            </div>
                          )}
                        </div>
                      ))}
                      {/* Кнопки: текст + стикеры */}
                      <div style={{position:'absolute',right:10,top:10,display:'flex',flexDirection:'column',gap:8,zIndex:10}}>
                        <button onClick={e=>{e.stopPropagation();setOvShowText(true);}}
                          style={{width:42,height:42,borderRadius:12,background:'rgba(0,0,0,0.65)',
                            border:'1.5px solid rgba(255,255,255,0.35)',color:'#fff',fontSize:16,fontWeight:900,
                            cursor:'pointer',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          T
                        </button>
                        <button onClick={e=>{e.stopPropagation();setOvShowStickers(s=>!s);}}
                          style={{width:42,height:42,borderRadius:12,background:'rgba(0,0,0,0.65)',
                            border:'1.5px solid rgba(255,255,255,0.35)',color:'#fff',fontSize:22,
                            cursor:'pointer',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                          😊
                        </button>
                      </div>
                    </div>
                    <div style={{flexShrink:0,display:'flex',gap:12,alignItems:'center',justifyContent:'center',
                      padding:'14px 20px',background:'rgba(0,0,0,0.9)'}}>
                      <motion.button whileTap={{scale:0.9}} onClick={()=>{resetCamPhoto();resetOverlays();}}
                        style={{padding:'12px 24px',borderRadius:99,background:'rgba(255,255,255,0.12)',
                          border:'1px solid rgba(255,255,255,0.25)',color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>
                        ↺ Заново
                      </motion.button>
                      {!storyUploading&&(
                        <motion.button whileTap={{scale:0.9}} onClick={uploadCamPhoto}
                          style={{padding:'12px 28px',borderRadius:99,background:'linear-gradient(135deg,#059669,#10b981)',
                            border:'none',cursor:'pointer',color:'#fff',fontSize:14,fontWeight:900,
                            boxShadow:'0 4px 20px rgba(5,150,105,0.5)'}}>
                          ✓ Опубликовать
                        </motion.button>
                      )}
                      {storyUploading&&<div style={{color:'rgba(255,255,255,0.7)',fontSize:14,fontWeight:600}}>Загрузка…</div>}
                    </div>
                  </div>
                )}

                {/* ── Режим просмотра ВИДЕО-превью ── */}
                {camPreviewUrl&&!storySuccess&&(
                  <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column'}}>
                    <div ref={camPhotoUrl?undefined:ovContainerRef} style={{flex:1,position:'relative',overflow:'hidden',minHeight:0,background:'#000',touchAction:'none'}}
                      onTouchMove={ovTouchMove as React.TouchEventHandler<HTMLDivElement>}
                      onTouchEnd={ovTouchEnd}
                      onClick={()=>setOvSelId(null)}>
                      <video src={camPreviewUrl} style={{width:'100%',height:'100%',objectFit:'contain'}} controls autoPlay loop/>
                      {/* Оверлеи поверх видео */}
                      {ovItems.map(it=>(
                        <div key={it.id}
                          onTouchStart={e=>ovTouchStart(e,it.id,it.x,it.y)}
                          onClick={e=>{e.stopPropagation();setOvSelId(it.id);}}
                          style={{position:'absolute',left:`${it.x}%`,top:`${it.y}%`,
                            transform:`translate(-50%,-50%) scale(${it.scale}) rotate(${it.rotate||0}deg)`,
                            cursor:'grab',zIndex:5,userSelect:'none',touchAction:'none',
                            border:ovSelId===it.id?'2px dashed rgba(255,255,255,0.7)':'2px solid transparent',
                            borderRadius:8,padding:4}}>
                          {it.type==='sticker'
                            ?<span style={{fontSize:52,lineHeight:1,display:'block'}}>{it.emoji}</span>
                            :<div style={{background:it.bg||'transparent',borderRadius:99,padding:it.bg?'5px 14px':'0',display:'inline-block'}}>
                              <span style={{fontSize:22,fontWeight:900,color:it.color||'#fff',textShadow:it.bg?'none':'0 2px 8px rgba(0,0,0,0.8)',whiteSpace:'nowrap',display:'block'}}>{it.text}</span>
                             </div>
                          }
                          {ovSelId===it.id&&(
                            <div style={{position:'absolute',top:-40,left:'50%',transform:'translateX(-50%)',
                              display:'flex',gap:4,background:'rgba(0,0,0,0.85)',borderRadius:99,padding:'5px 8px',whiteSpace:'nowrap'}}>
                              <button onClick={e=>{e.stopPropagation();ovResize(it.id,-0.25);}}
                                style={{background:'none',border:'none',color:'#fff',fontSize:18,cursor:'pointer',padding:'0 4px',lineHeight:1}}>−</button>
                              <button onClick={e=>{e.stopPropagation();ovResize(it.id,+0.25);}}
                                style={{background:'none',border:'none',color:'#fff',fontSize:18,cursor:'pointer',padding:'0 4px',lineHeight:1}}>+</button>
                              <button onClick={e=>{e.stopPropagation();ovDelete(it.id);}}
                                style={{background:'none',border:'none',color:'#f87171',fontSize:16,cursor:'pointer',padding:'0 4px',lineHeight:1}}>🗑</button>
                            </div>
                          )}
                        </div>
                      ))}
                      {/* Кнопки: текст + стикеры */}
                      <div style={{position:'absolute',right:10,top:10,display:'flex',flexDirection:'column',gap:8,zIndex:10}}>
                        <button onClick={e=>{e.stopPropagation();setOvShowText(true);}}
                          style={{width:42,height:42,borderRadius:12,background:'rgba(0,0,0,0.65)',
                            border:'1.5px solid rgba(255,255,255,0.35)',color:'#fff',fontSize:16,fontWeight:900,
                            cursor:'pointer',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center'}}>T</button>
                        <button onClick={e=>{e.stopPropagation();setOvShowStickers(s=>!s);}}
                          style={{width:42,height:42,borderRadius:12,background:'rgba(0,0,0,0.65)',
                            border:'1.5px solid rgba(255,255,255,0.35)',color:'#fff',fontSize:22,
                            cursor:'pointer',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center'}}>😊</button>
                      </div>
                    </div>
                    <div style={{flexShrink:0,display:'flex',flexDirection:'column',gap:8,alignItems:'center',justifyContent:'center',
                      padding:'12px 20px 14px',background:'rgba(0,0,0,0.9)'}}>
                      {storyError&&(
                        <div style={{color:'#f87171',fontSize:12,fontWeight:600,textAlign:'center',
                          padding:'8px 16px',background:'rgba(239,68,68,0.15)',borderRadius:10,width:'100%'}}>
                          {storyError}
                        </div>
                      )}
                      <div style={{display:'flex',gap:12,alignItems:'center',justifyContent:'center',width:'100%'}}>
                        <motion.button whileTap={{scale:0.9}} onClick={()=>{resetCamRecording();resetOverlays();}}
                          disabled={storyUploading}
                          style={{padding:'12px 20px',borderRadius:99,background:'rgba(255,255,255,0.1)',
                            border:'1px solid rgba(255,255,255,0.2)',color:storyUploading?'rgba(255,255,255,0.3)':'#fff',
                            fontSize:13,fontWeight:700,cursor:storyUploading?'default':'pointer'}}>
                          ↺ Заново
                        </motion.button>
                        {!storyUploading&&(
                          <motion.button whileTap={{scale:0.9}} onClick={()=>{setStoryError(null);uploadCamStory();}}
                            style={{flex:1,padding:'12px 20px',borderRadius:99,
                              background:'linear-gradient(135deg,#059669,#10b981)',
                              border:'none',cursor:'pointer',color:'#fff',fontSize:14,fontWeight:900,
                              boxShadow:'0 4px 20px rgba(5,150,105,0.5)'}}>
                            {storyError?'↺ Повторить':'✓ Опубликовать'}
                          </motion.button>
                        )}
                        {storyUploading&&(
                          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                            <div style={{width:16,height:16,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.3)',
                              borderTopColor:'#fff',animation:'spin 0.8s linear infinite'}}/>
                            <span style={{color:'rgba(255,255,255,0.8)',fontSize:13,fontWeight:600}}>Загрузка…</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Успех ── */}
                {storySuccess&&(
                  <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <div style={{color:'#4ade80',fontSize:20,fontWeight:800}}>✓ История опубликована!</div>
                  </div>
                )}

                {/* ── Живой видоискатель ── */}
                {!camPreviewUrl&&!camPhotoUrl&&!storySuccess&&(
                  <>
                    {/* Видео-поток на весь контейнер */}
                    <video ref={camVideoRef} autoPlay muted playsInline
                      style={{position:'absolute',inset:0,width:'100%',height:'100%',
                        objectFit:'cover',
                        /* НЕТ transform/transition здесь — управляются через applyZoom() */
                        /* Убираем compositing layer при zoom=1 для максимального качества превью */
                      }}
                      onCanPlay={e=>{(e.target as HTMLVideoElement).play().catch(()=>{}); }}/>
                    {/* Pinch-to-zoom — невидимый слой (без z-index, кнопки с большим z-index выше) */}
                    <div style={{position:'absolute',inset:0}}
                      onTouchStart={onCamTouchStart}
                      onTouchMove={onCamTouchMove as React.TouchEventHandler<HTMLDivElement>}
                      onTouchEnd={onCamTouchEnd}/>

                    {/* Ошибка */}
                    {camError&&(
                      <div style={{position:'absolute',top:12,left:0,right:0,margin:'0 16px',
                        color:'#f87171',fontSize:12,fontWeight:600,textAlign:'center',
                        padding:'8px 16px',background:'rgba(0,0,0,0.7)',borderRadius:10}}>
                        {camError}
                      </div>
                    )}

                    {/* Переключатель режима — сверху по центру */}
                    <div style={{position:'absolute',top:12,left:'50%',transform:'translateX(-50%)',
                      display:'flex',borderRadius:99,background:'rgba(0,0,0,0.55)',
                      padding:3,gap:0,backdropFilter:'blur(8px)'}}>
                      {(['photo','video'] as const).map(m=>(
                        <button key={m} onClick={()=>{setCamMode(m);setCamError(null);}}
                          style={{padding:'6px 18px',borderRadius:99,border:'none',cursor:'pointer',fontSize:12,fontWeight:800,
                            background:camMode===m?'rgba(255,255,255,0.25)':'transparent',
                            color:camMode===m?'#fff':'rgba(255,255,255,0.5)',transition:'all 0.15s'}}>
                          {m==='photo'?'📷 Фото':'🎬 Видео'}
                        </button>
                      ))}
                    </div>

                    {/* Таймер при записи */}
                    {camRecording&&(
                      <div style={{position:'absolute',top:12,left:12,display:'flex',alignItems:'center',gap:6,
                        background:'rgba(0,0,0,0.65)',padding:'4px 10px',borderRadius:99,backdropFilter:'blur(6px)'}}>
                        <div style={{width:8,height:8,borderRadius:'50%',background:'#ef4444',animation:'pulse 1s infinite'}}/>
                        <span style={{color:'#fff',fontSize:12,fontWeight:700}}>
                          {String(Math.floor(camSeconds/60)).padStart(2,'0')}:{String(camSeconds%60).padStart(2,'0')}
                        </span>
                      </div>
                    )}

                    {/* Перевернуть — справа сверху */}
                    <motion.button whileTap={{scale:0.88}} onClick={flipCamera} disabled={camRecording}
                      style={{position:'absolute',top:12,right:12,width:44,height:44,borderRadius:'50%',
                        background:'rgba(0,0,0,0.55)',border:'1px solid rgba(255,255,255,0.25)',
                        cursor:'pointer',color:'#fff',fontSize:20,display:'flex',
                        alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)'}}>
                      🔄
                    </motion.button>

                    {/* ── ЗУМЕР — слайдер + значение ── */}
                    <div style={{position:'absolute',bottom:110,left:0,right:0,zIndex:10,
                      display:'flex',flexDirection:'column',alignItems:'center',gap:4,padding:'0 32px'}}>
                      {/* Значение зума */}
                      <div style={{background:'rgba(0,0,0,0.55)',backdropFilter:'blur(6px)',
                        padding:'3px 10px',borderRadius:99,color:'#fff',fontSize:13,fontWeight:700}}>
                        {camZoom.toFixed(1)}×
                      </div>
                      {/* Слайдер */}
                      <input type="range" min={1} max={camMaxZoom} step={0.1}
                        value={camZoom}
                        onChange={e=>applyZoom(Number(e.target.value))}
                        style={{width:'100%',height:3,accentColor:'#fff',cursor:'pointer',opacity:0.85}}/>
                    </div>

                    {/* ── КНОПКА СЪЁМКИ — внизу по центру ── */}
                    <div style={{position:'absolute',bottom:24,left:0,right:0,zIndex:10,
                      display:'flex',alignItems:'center',justifyContent:'center'}}>

                      {/* Фото: белая круглая кнопка */}
                      {camMode==='photo'&&(
                        <motion.button whileTap={{scale:0.85}} onClick={capturePhoto}
                          style={{width:76,height:76,borderRadius:'50%',
                            border:'4px solid #fff',
                            background:'rgba(255,255,255,0.2)',
                            cursor:'pointer',backdropFilter:'blur(4px)',
                            boxShadow:'0 0 0 3px rgba(255,255,255,0.35), 0 4px 24px rgba(0,0,0,0.5)',
                            display:'flex',alignItems:'center',justifyContent:'center',fontSize:30}}>
                          📷
                        </motion.button>
                      )}

                      {/* Видео: красная кнопка */}
                      {camMode==='video'&&!camRecording&&(
                        <motion.button whileTap={{scale:0.85}} onClick={startCamRecording}
                          style={{width:76,height:76,borderRadius:'50%',
                            border:'4px solid #ef4444',
                            background:'rgba(239,68,68,0.2)',
                            cursor:'pointer',backdropFilter:'blur(4px)',
                            boxShadow:'0 0 0 3px rgba(239,68,68,0.4), 0 4px 24px rgba(0,0,0,0.5)',
                            display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>
                          ⏺
                        </motion.button>
                      )}

                      {/* Стоп при записи */}
                      {camMode==='video'&&camRecording&&(
                        <motion.button whileTap={{scale:0.85}} onClick={stopCamRecording}
                          style={{width:76,height:76,borderRadius:'50%',
                            border:'4px solid #ef4444',
                            background:'#ef4444',
                            cursor:'pointer',
                            boxShadow:'0 0 24px rgba(239,68,68,0.7)',
                            display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,color:'#fff'}}>
                          ⏹
                        </motion.button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ─── Видео из галереи ─── */}
            {storyTab==='video'&&(
              <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0}}>
                <input ref={videoFileRef} type="file" accept="video/*" style={{display:'none'}} onChange={e=>{
                  const f=e.target.files?.[0];if(!f)return;
                  if(galUrl)URL.revokeObjectURL(galUrl);
                  resetOverlays();setGalBuffer(null);
                  /* objectURL держит ссылку на данные даже после e.target.value=''; не отзывается при очистке input */
                  const blobUrl=URL.createObjectURL(f);
                  setGalFile(f);setGalUrl(blobUrl);setGalType('video');
                  e.target.value='';
                }}/>
                {!galUrl&&!storySuccess?(
                  <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,padding:24}}>
                    <div style={{fontSize:48}}>🎬</div>
                    <p style={{color:'rgba(255,255,255,0.5)',fontSize:13,textAlign:'center',margin:0}}>Выбери видео из галереи</p>
                    {storyError&&<div style={{color:'#f87171',fontSize:13,fontWeight:600,textAlign:'center',padding:'8px 16px',background:'rgba(239,68,68,0.15)',borderRadius:10,maxWidth:280}}>{storyError}</div>}
                    <motion.button whileTap={{scale:0.9}} onClick={()=>videoFileRef.current?.click()}
                      style={{padding:'12px 28px',borderRadius:99,background:'linear-gradient(135deg,#7c3aed,#a78bfa)',border:'none',cursor:'pointer',color:'#fff',fontSize:14,fontWeight:900}}>
                      Выбрать видео
                    </motion.button>
                  </div>
                ):storySuccess?(
                  <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <div style={{color:'#4ade80',fontSize:15,fontWeight:800}}>✓ История опубликована!</div>
                  </div>
                ):(
                  <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0}}>
                    <div ref={galType==='video'?ovContainerRef:undefined}
                      style={{flex:1,position:'relative',overflow:'hidden',minHeight:0,background:'#000',touchAction:'none'}}
                      onTouchMove={ovTouchMove as React.TouchEventHandler<HTMLDivElement>}
                      onTouchEnd={ovTouchEnd}
                      onClick={()=>setOvSelId(null)}>
                      <video src={galUrl!} style={{width:'100%',height:'100%',objectFit:'contain'}} controls autoPlay loop/>
                      {ovItems.map(it=>(
                        <div key={it.id}
                          onTouchStart={e=>ovTouchStart(e,it.id,it.x,it.y)}
                          onClick={e=>{e.stopPropagation();setOvSelId(it.id);}}
                          style={{position:'absolute',left:`${it.x}%`,top:`${it.y}%`,
                            transform:`translate(-50%,-50%) scale(${it.scale}) rotate(${it.rotate||0}deg)`,
                            cursor:'grab',zIndex:5,userSelect:'none',touchAction:'none',
                            border:ovSelId===it.id?'2px dashed rgba(255,255,255,0.7)':'2px solid transparent',
                            borderRadius:8,padding:4}}>
                          {it.type==='sticker'?<span style={{fontSize:52,lineHeight:1,display:'block'}}>{it.emoji}</span>
                            :<div style={{background:it.bg||'transparent',borderRadius:99,padding:it.bg?'5px 14px':'0',display:'inline-block'}}><span style={{fontSize:22,fontWeight:900,color:it.color||'#fff',textShadow:it.bg?'none':'0 2px 8px rgba(0,0,0,0.8)',whiteSpace:'nowrap',display:'block'}}>{it.text}</span></div>}
                          {ovSelId===it.id&&(
                            <div style={{position:'absolute',top:-40,left:'50%',transform:'translateX(-50%)',display:'flex',gap:4,background:'rgba(0,0,0,0.85)',borderRadius:99,padding:'5px 8px',whiteSpace:'nowrap'}}>
                              <button onClick={e=>{e.stopPropagation();ovResize(it.id,-0.25);}} style={{background:'none',border:'none',color:'#fff',fontSize:18,cursor:'pointer',padding:'0 4px',lineHeight:1}}>−</button>
                              <button onClick={e=>{e.stopPropagation();ovResize(it.id,+0.25);}} style={{background:'none',border:'none',color:'#fff',fontSize:18,cursor:'pointer',padding:'0 4px',lineHeight:1}}>+</button>
                              <button onClick={e=>{e.stopPropagation();ovDelete(it.id);}} style={{background:'none',border:'none',color:'#f87171',fontSize:16,cursor:'pointer',padding:'0 4px',lineHeight:1}}>🗑</button>
                            </div>
                          )}
                        </div>
                      ))}
                      <div style={{position:'absolute',right:10,top:10,display:'flex',flexDirection:'column',gap:8,zIndex:10}}>
                        <button onClick={e=>{e.stopPropagation();setOvShowText(true);}} style={{width:42,height:42,borderRadius:12,background:'rgba(0,0,0,0.65)',border:'1.5px solid rgba(255,255,255,0.35)',color:'#fff',fontSize:16,fontWeight:900,cursor:'pointer',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center'}}>T</button>
                        <button onClick={e=>{e.stopPropagation();setOvShowStickers(s=>!s);}} style={{width:42,height:42,borderRadius:12,background:'rgba(0,0,0,0.65)',border:'1.5px solid rgba(255,255,255,0.35)',color:'#fff',fontSize:22,cursor:'pointer',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center'}}>😊</button>
                      </div>
                    </div>
                    <div style={{flexShrink:0,display:'flex',flexDirection:'column',gap:8,padding:'12px 16px',background:'rgba(0,0,0,0.9)'}}>
                      {storyError&&<div style={{color:'#f87171',fontSize:12,fontWeight:600,textAlign:'center',padding:'8px 16px',background:'rgba(239,68,68,0.15)',borderRadius:10}}>{storyError}</div>}
                      <div style={{display:'flex',gap:10}}>
                        <motion.button whileTap={{scale:0.9}} onClick={()=>{if(galUrl)URL.revokeObjectURL(galUrl);setGalFile(null);setGalBuffer(null);setGalUrl(null);setGalType(null);resetOverlays();setStoryError(null);}}
                          style={{padding:'11px 18px',borderRadius:99,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                          ↺ Заново
                        </motion.button>
                        {!storyUploading?(
                          <motion.button whileTap={{scale:0.9}} onClick={async()=>{
                            if(!galFile||!galUrl)return;
                            const txt=ovItems.filter(it=>it.type==='text').map(it=>it.text).join(' ').trim();
                            setStoryError(null);
                            /* Читаем данные из объектного URL — он гарантированно жив, в отличие от File после очистки input */
                            let safeFile:File=galFile;
                            try{
                              const res=await fetch(galUrl);
                              const blob=await res.blob();
                              safeFile=new File([blob],galFile.name,{type:blob.type||galFile.type||'video/mp4'});
                            }catch{
                              if(galBuffer)safeFile=new File([galBuffer],galFile.name,{type:galFile.type||'video/mp4'});
                            }
                            submitStory('video',safeFile,txt||undefined,ovItems.length>0?ovItems:undefined);
                          }} style={{flex:1,padding:'11px',borderRadius:99,background:'linear-gradient(135deg,#059669,#10b981)',border:'none',cursor:'pointer',color:'#fff',fontSize:14,fontWeight:900,boxShadow:'0 4px 16px rgba(5,150,105,0.5)'}}>
                            ✓ Опубликовать
                          </motion.button>
                        ):(
                          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:5}}>
                            <div style={{display:'flex',alignItems:'center',gap:6}}>
                              <div style={{width:14,height:14,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',animation:'spin 0.8s linear infinite'}}/>
                              <span style={{color:'rgba(255,255,255,0.8)',fontSize:13}}>{uploadProgress>0?`Загрузка ${uploadProgress}%…`:'Загрузка…'}</span>
                            </div>
                            {uploadProgress>0&&<div style={{width:'80%',height:3,borderRadius:99,background:'rgba(255,255,255,0.15)'}}><div style={{height:'100%',borderRadius:99,background:'#10b981',width:`${uploadProgress}%`,transition:'width 0.3s'}}/></div>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── Фото из галереи ─── */}
            {storyTab==='image'&&(
              <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0}}>
                <input ref={imageFileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{
                  const f=e.target.files?.[0];if(!f)return;
                  if(galUrl)URL.revokeObjectURL(galUrl);
                  resetOverlays();setGalBuffer(null);
                  f.arrayBuffer().then(buf=>{setGalBuffer(buf);}).catch(()=>{});
                  setGalFile(f);setGalUrl(URL.createObjectURL(f));setGalType('image');
                  e.target.value='';
                }}/>
                {!galUrl&&!storySuccess?(
                  <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:16,padding:24}}>
                    <div style={{fontSize:48}}>🖼</div>
                    <p style={{color:'rgba(255,255,255,0.5)',fontSize:13,textAlign:'center',margin:0}}>Выбери фото из галереи</p>
                    {storyError&&<div style={{color:'#f87171',fontSize:13,fontWeight:600,textAlign:'center',padding:'8px 16px',background:'rgba(239,68,68,0.15)',borderRadius:10,maxWidth:280}}>{storyError}</div>}
                    <motion.button whileTap={{scale:0.9}} onClick={()=>imageFileRef.current?.click()}
                      style={{padding:'12px 28px',borderRadius:99,background:'linear-gradient(135deg,#7c3aed,#a78bfa)',border:'none',cursor:'pointer',color:'#fff',fontSize:14,fontWeight:900}}>
                      Выбрать фото
                    </motion.button>
                  </div>
                ):storySuccess?(
                  <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <div style={{color:'#4ade80',fontSize:15,fontWeight:800}}>✓ История опубликована!</div>
                  </div>
                ):(
                  <div style={{flex:1,display:'flex',flexDirection:'column',minHeight:0}}>
                    <div ref={galType==='image'?ovContainerRef:undefined}
                      style={{flex:1,position:'relative',overflow:'hidden',minHeight:0,background:'#000',touchAction:'none'}}
                      onTouchMove={ovTouchMove as React.TouchEventHandler<HTMLDivElement>}
                      onTouchEnd={ovTouchEnd}
                      onClick={()=>setOvSelId(null)}>
                      <img src={galUrl!} alt="" style={{width:'100%',height:'100%',objectFit:'contain'}}/>
                      {ovItems.map(it=>(
                        <div key={it.id}
                          onTouchStart={e=>ovTouchStart(e,it.id,it.x,it.y)}
                          onClick={e=>{e.stopPropagation();setOvSelId(it.id);}}
                          style={{position:'absolute',left:`${it.x}%`,top:`${it.y}%`,
                            transform:`translate(-50%,-50%) scale(${it.scale}) rotate(${it.rotate||0}deg)`,
                            cursor:'grab',zIndex:5,userSelect:'none',touchAction:'none',
                            border:ovSelId===it.id?'2px dashed rgba(255,255,255,0.7)':'2px solid transparent',
                            borderRadius:8,padding:4}}>
                          {it.type==='sticker'?<span style={{fontSize:52,lineHeight:1,display:'block'}}>{it.emoji}</span>
                            :<div style={{background:it.bg||'transparent',borderRadius:99,padding:it.bg?'5px 14px':'0',display:'inline-block'}}><span style={{fontSize:22,fontWeight:900,color:it.color||'#fff',textShadow:it.bg?'none':'0 2px 8px rgba(0,0,0,0.8)',whiteSpace:'nowrap',display:'block'}}>{it.text}</span></div>}
                          {ovSelId===it.id&&(
                            <div style={{position:'absolute',top:-40,left:'50%',transform:'translateX(-50%)',display:'flex',gap:4,background:'rgba(0,0,0,0.85)',borderRadius:99,padding:'5px 8px',whiteSpace:'nowrap'}}>
                              <button onClick={e=>{e.stopPropagation();ovResize(it.id,-0.25);}} style={{background:'none',border:'none',color:'#fff',fontSize:18,cursor:'pointer',padding:'0 4px',lineHeight:1}}>−</button>
                              <button onClick={e=>{e.stopPropagation();ovResize(it.id,+0.25);}} style={{background:'none',border:'none',color:'#fff',fontSize:18,cursor:'pointer',padding:'0 4px',lineHeight:1}}>+</button>
                              <button onClick={e=>{e.stopPropagation();ovDelete(it.id);}} style={{background:'none',border:'none',color:'#f87171',fontSize:16,cursor:'pointer',padding:'0 4px',lineHeight:1}}>🗑</button>
                            </div>
                          )}
                        </div>
                      ))}
                      <div style={{position:'absolute',right:10,top:10,display:'flex',flexDirection:'column',gap:8,zIndex:10}}>
                        <button onClick={e=>{e.stopPropagation();setOvShowText(true);}} style={{width:42,height:42,borderRadius:12,background:'rgba(0,0,0,0.65)',border:'1.5px solid rgba(255,255,255,0.35)',color:'#fff',fontSize:16,fontWeight:900,cursor:'pointer',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center'}}>T</button>
                        <button onClick={e=>{e.stopPropagation();setOvShowStickers(s=>!s);}} style={{width:42,height:42,borderRadius:12,background:'rgba(0,0,0,0.65)',border:'1.5px solid rgba(255,255,255,0.35)',color:'#fff',fontSize:22,cursor:'pointer',backdropFilter:'blur(6px)',display:'flex',alignItems:'center',justifyContent:'center'}}>😊</button>
                      </div>
                    </div>
                    <div style={{flexShrink:0,display:'flex',flexDirection:'column',gap:8,padding:'12px 16px',background:'rgba(0,0,0,0.9)'}}>
                      {storyError&&<div style={{color:'#f87171',fontSize:12,fontWeight:600,textAlign:'center',padding:'8px 16px',background:'rgba(239,68,68,0.15)',borderRadius:10}}>{storyError}</div>}
                      <div style={{display:'flex',gap:10}}>
                        <motion.button whileTap={{scale:0.9}} onClick={()=>{if(galUrl)URL.revokeObjectURL(galUrl);setGalFile(null);setGalBuffer(null);setGalUrl(null);setGalType(null);resetOverlays();setStoryError(null);}}
                          style={{padding:'11px 18px',borderRadius:99,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                          ↺ Заново
                        </motion.button>
                        {!storyUploading?(
                          <motion.button whileTap={{scale:0.9}} onClick={async()=>{
                            if(!galFile||!galUrl)return;
                            let uploadFile:File;
                            if(ovItems.length>0){
                              /* compositePhoto рисует на canvas — работает напрямую с galUrl (blob URL) */
                              try{const cb=await compositePhoto(galUrl);uploadFile=new File([cb],galFile.name,{type:'image/jpeg'});}
                              catch{
                                /* Fallback: читаем blob из объектного URL */
                                try{const res=await fetch(galUrl);const b=await res.blob();uploadFile=new File([b],galFile.name,{type:b.type||galFile.type||'image/jpeg'});}
                                catch{uploadFile=galBuffer?new File([galBuffer],galFile.name,{type:galFile.type||'image/jpeg'}):galFile;}
                              }
                            }else{
                              /* Читаем blob из объектного URL — гарантированно жив после e.target.value='' */
                              try{const res=await fetch(galUrl);const b=await res.blob();uploadFile=new File([b],galFile.name,{type:b.type||galFile.type||'image/jpeg'});}
                              catch{uploadFile=galBuffer?new File([galBuffer],galFile.name,{type:galFile.type||'image/jpeg'}):galFile;}
                            }
                            const txt=ovItems.filter(it=>it.type==='text').map(it=>it.text).join(' ').trim();
                            setStoryError(null);submitStory('image',uploadFile,txt||undefined);
                          }} style={{flex:1,padding:'11px',borderRadius:99,background:'linear-gradient(135deg,#059669,#10b981)',border:'none',cursor:'pointer',color:'#fff',fontSize:14,fontWeight:900,boxShadow:'0 4px 16px rgba(5,150,105,0.5)'}}>
                            ✓ Опубликовать
                          </motion.button>
                        ):(
                          <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                            <div style={{width:14,height:14,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.3)',borderTopColor:'#fff',animation:'spin 0.8s linear infinite'}}/>
                            <span style={{color:'rgba(255,255,255,0.8)',fontSize:13}}>Загрузка…</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── Текст ─── */}
            {storyTab==='text'&&(
              <div style={{flex:1,display:'flex',flexDirection:'column',padding:16,gap:16}}>
                {/* Превью */}
                <div style={{borderRadius:16,overflow:'hidden',aspectRatio:'9/16',maxHeight:300,position:'relative',display:'flex',alignItems:'center',justifyContent:'center',background:STORY_TEXT_BG[storyBgIdx]}}>
                  {storyText.trim()?(
                    <p style={{color:'#fff',fontSize:18,fontWeight:800,textAlign:'center',padding:'0 20px',margin:0,wordBreak:'break-word',textShadow:'0 2px 8px rgba(0,0,0,0.6)'}}>{storyText}</p>
                  ):(
                    <p style={{color:'rgba(255,255,255,0.3)',fontSize:14,fontWeight:600,margin:0}}>Введи текст…</p>
                  )}
                </div>
                {/* Палитра фонов */}
                <div style={{display:'flex',gap:8,justifyContent:'center'}}>
                  {STORY_TEXT_BG.map((bg,i)=>(
                    <div key={i} onClick={()=>setStoryBgIdx(i)}
                      style={{width:32,height:32,borderRadius:8,cursor:'pointer',background:bg,
                        border:storyBgIdx===i?'3px solid #fff':'3px solid transparent',boxSizing:'border-box'}}/>
                  ))}
                </div>
                {/* Ввод текста */}
                <textarea value={storyText} onChange={e=>setStoryText(e.target.value)} placeholder="Напиши что-нибудь…"
                  style={{flex:1,minHeight:100,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:12,
                    color:'#fff',fontSize:15,fontWeight:600,padding:'12px 14px',resize:'none',outline:'none',fontFamily:'inherit'}}/>
                {/* Успех/ошибка */}
                {storySuccess&&<div style={{color:'#4ade80',fontSize:15,fontWeight:800,textAlign:'center'}}>✓ История опубликована!</div>}
                {storyError&&<div style={{color:'#f87171',fontSize:13,fontWeight:600,textAlign:'center',padding:'8px 16px',background:'rgba(239,68,68,0.15)',borderRadius:10}}>{storyError}</div>}
                {/* Кнопка */}
                {!storySuccess&&(
                <motion.button whileTap={{scale:0.9}} disabled={!storyText.trim()||storyUploading}
                  onClick={()=>submitStory('text')}
                  style={{padding:'13px',borderRadius:12,background:storyText.trim()&&!storyUploading?'linear-gradient(135deg,#7c3aed,#a78bfa)':'rgba(255,255,255,0.1)',
                    border:'none',cursor:storyText.trim()&&!storyUploading?'pointer':'default',color:'#fff',fontSize:14,fontWeight:900}}>
                  {storyUploading?'Публикация…':'Опубликовать историю'}
                </motion.button>
                )}
              </div>
            )}
          </div>

          {/* ─── Панель стикеров (slide-in справа) ─── */}
          <AnimatePresence>
            {ovShowStickers&&(
              <motion.div initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}}
                transition={{type:'spring',damping:28,stiffness:300}}
                onClick={e=>e.stopPropagation()}
                style={{position:'absolute',right:0,top:0,bottom:0,width:240,
                  background:'rgba(10,10,25,0.97)',borderLeft:'1px solid rgba(255,255,255,0.1)',
                  zIndex:500,display:'flex',flexDirection:'column',overflow:'hidden'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                  padding:'14px 14px 10px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
                  <span style={{color:'#fff',fontWeight:800,fontSize:14}}>Стикеры</span>
                  <button onClick={()=>setOvShowStickers(false)}
                    style={{background:'rgba(255,255,255,0.08)',border:'none',borderRadius:8,
                      color:'#fff',fontSize:18,cursor:'pointer',width:30,height:30,
                      display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
                </div>
                {/* Разделитель секций */}
                <div style={{padding:'6px 10px 2px',fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.35)',letterSpacing:1}}>ЭМОДЗИ</div>
                <div style={{flex:1,overflow:'auto',padding:'0 10px 10px',
                  display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5,alignContent:'start'}}>
                  {STICKER_DEFS.filter(s=>!s.textContent).map((s,i)=>(
                    <button key={i} onClick={()=>{ovAddSticker(s);setOvShowStickers(false);}}
                      style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                        gap:3,padding:'8px 4px',borderRadius:10,
                        background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.08)',
                        cursor:'pointer',aspectRatio:'1'}}>
                      <span style={{fontSize:32,lineHeight:1}}>{s.emoji}</span>
                      <span style={{fontSize:9,color:'rgba(255,255,255,0.55)',textAlign:'center',
                        wordBreak:'break-word',lineHeight:1.2}}>{s.label}</span>
                    </button>
                  ))}
                </div>
                {/* Текстовые стикеры */}
                <div style={{padding:'6px 10px 4px',fontSize:10,fontWeight:700,color:'rgba(255,255,255,0.35)',letterSpacing:1,borderTop:'1px solid rgba(255,255,255,0.06)'}}>ТЕКСТ</div>
                <div style={{padding:'0 10px 10px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                  {STICKER_DEFS.filter(s=>s.textContent).map((s,i)=>(
                    <button key={i} onClick={()=>{ovAddSticker(s);setOvShowStickers(false);}}
                      style={{display:'flex',alignItems:'center',justifyContent:'center',
                        padding:'8px 10px',borderRadius:99,
                        background:'rgba(0,0,0,0.6)',border:'1px solid rgba(255,255,255,0.15)',
                        cursor:'pointer',minHeight:36}}>
                      <span style={{fontSize:13,fontWeight:800,color:'#fff',textAlign:'center',lineHeight:1.2}}>{s.textContent}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ─── Текстовый попап ─── */}
          <AnimatePresence>
            {ovShowText&&(
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                onClick={()=>{setOvShowText(false);setOvTxtDraft('');}}
                style={{position:'absolute',inset:0,zIndex:600,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  background:'rgba(0,0,0,0.75)',backdropFilter:'blur(4px)'}}>
                <motion.div initial={{scale:0.88,opacity:0}} animate={{scale:1,opacity:1}}
                  exit={{scale:0.88,opacity:0}}
                  onClick={e=>e.stopPropagation()}
                  style={{width:300,background:'rgba(18,18,38,0.98)',borderRadius:20,
                    padding:20,display:'flex',flexDirection:'column',gap:14,
                    border:'1px solid rgba(255,255,255,0.1)',
                    boxShadow:'0 20px 60px rgba(0,0,0,0.6)'}}>
                  <span style={{color:'#fff',fontWeight:800,fontSize:15}}>Добавить текст</span>
                  <textarea value={ovTxtDraft} onChange={e=>setOvTxtDraft(e.target.value)}
                    placeholder="Напиши что-нибудь…" autoFocus
                    style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.15)',
                      borderRadius:12,color:'#fff',fontSize:16,padding:'10px 12px',
                      resize:'none',height:80,outline:'none',fontFamily:'inherit'}}/>
                  {/* Цвета */}
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    {['#ffffff','#ffcc00','#ff4d4d','#44ff88','#44aaff','#ff44ff','#ff8800','#00ffee'].map(c=>(
                      <div key={c} onClick={()=>setOvTxtColor(c)}
                        style={{width:28,height:28,borderRadius:'50%',background:c,cursor:'pointer',
                          border:ovTxtColor===c?'3px solid rgba(255,255,255,0.9)':'3px solid transparent',
                          boxSizing:'border-box',flexShrink:0}}/>
                    ))}
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={()=>{setOvShowText(false);setOvTxtDraft('');}}
                      style={{flex:1,padding:'11px',borderRadius:12,background:'rgba(255,255,255,0.08)',
                        border:'none',color:'#fff',cursor:'pointer',fontWeight:700,fontSize:14}}>
                      Отмена
                    </button>
                    <button onClick={ovAddText} disabled={!ovTxtDraft.trim()}
                      style={{flex:1,padding:'11px',borderRadius:12,
                        background:ovTxtDraft.trim()?'linear-gradient(135deg,#7c3aed,#a78bfa)':'rgba(255,255,255,0.08)',
                        border:'none',color:'#fff',cursor:ovTxtDraft.trim()?'pointer':'default',
                        fontWeight:900,fontSize:14}}>
                      Добавить
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </motion.div>
      )}
    </AnimatePresence>

    {/* ═══ МОДАЛ: ПРОСМОТР ИСТОРИИ ═══ */}
    <AnimatePresence>
      {viewingStory&&viewingStoryIdx!==null&&(
        <motion.div key="story-viewer" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          style={{position:'fixed',inset:0,zIndex:210,background:'#000',display:'flex',alignItems:'center',justifyContent:'center',touchAction:'none'}}
          onTouchStart={e=>{storySwipeRef.current={x:e.touches[0].clientX,y:e.touches[0].clientY};}}
          onTouchEnd={e=>{
            if(!storySwipeRef.current)return;
            const dx=e.changedTouches[0].clientX-storySwipeRef.current.x;
            const dy=Math.abs(e.changedTouches[0].clientY-storySwipeRef.current.y);
            storySwipeRef.current=null;
            if(Math.abs(dx)<20||dy>Math.abs(dx))return;
            if(dx<0)storyGo(viewingStoryIdx+1);
            else storyGo(viewingStoryIdx-1);
          }}>
          <div style={{width:'100%',maxWidth:390,height:'100dvh',position:'relative',background:viewingStory.bgColor||'#111',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
            {/* Прогресс-бары */}
            <div style={{position:'absolute',top:0,left:0,right:0,zIndex:10,
              display:'flex',gap:3,padding:'10px 10px 0'}}>
              {myStories.slice(0,8).map((_,i)=>(
                <div key={i} style={{flex:1,height:3,borderRadius:99,background:'rgba(255,255,255,0.3)',overflow:'hidden'}}>
                  <div style={{height:'100%',borderRadius:99,background:'#fff',
                    width:i<viewingStoryIdx?'100%':i===viewingStoryIdx?`${storyProgress}%`:'0%',
                    transition:i===viewingStoryIdx?'none':'none'}}/>
                </div>
              ))}
            </div>
            {/* Медиа */}
            {viewingStory.mediaType==='video'&&viewingStory.mediaUrl
              ?<video key={viewingStory.id} ref={storyVideoRef} src={viewingStory.mediaUrl}
                  style={{width:'100%',height:'100%',objectFit:'cover',position:'absolute',inset:0}}
                  autoPlay playsInline
                  onTimeUpdate={e=>{
                    const v=e.currentTarget;
                    if(v.duration>0)setStoryProgress(v.currentTime/v.duration*100);
                  }}
                  onEnded={()=>storyGo(viewingStoryIdx+1)}/>
              :viewingStory.mediaType==='photo'&&viewingStory.mediaUrl
              ?<img key={viewingStory.id} src={viewingStory.mediaUrl} alt=""
                  style={{width:'100%',height:'100%',objectFit:'cover',position:'absolute',inset:0}}/>
              :<p style={{color:'#fff',fontSize:22,fontWeight:800,textAlign:'center',padding:'0 28px',textShadow:'0 2px 12px rgba(0,0,0,0.6)',position:'relative',zIndex:2}}>{viewingStory.text}</p>
            }
            {/* Оверлеи стикеров и текста поверх видео/фото */}
            {viewingStory.overlayItems&&viewingStory.overlayItems.length>0&&(viewingStory.mediaType==='video'||viewingStory.mediaType==='photo')&&(
              viewingStory.overlayItems.map(it=>(
                <div key={it.id} style={{position:'absolute',left:`${it.x}%`,top:`${it.y}%`,transform:`translate(-50%,-50%) scale(${it.scale})`,transformOrigin:'center',pointerEvents:'none',userSelect:'none',zIndex:5}}>
                  {it.type==='sticker'
                    ?<span style={{fontSize:52,lineHeight:1,display:'block',filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.5))'}}>{it.emoji}</span>
                    :<div style={{background:'rgba(0,0,0,0.55)',borderRadius:10,padding:'6px 12px',maxWidth:200}}>
                      <span style={{color:it.color||'#fff',fontSize:18,fontWeight:800,textShadow:'0 1px 4px rgba(0,0,0,0.8)',whiteSpace:'pre-wrap',wordBreak:'break-word'}}>{it.text}</span>
                    </div>
                  }
                </div>
              ))
            )}
            {/* Текст поверх медиа (если нет overlay-элементов) */}
            {viewingStory.text&&!viewingStory.overlayItems?.length&&viewingStory.mediaType!==''&&(
              <div style={{position:'absolute',bottom:56,left:0,right:0,padding:'0 20px',zIndex:5,pointerEvents:'none'}}>
                <p style={{color:'#fff',fontSize:15,fontWeight:700,textAlign:'center',
                  textShadow:'0 2px 8px rgba(0,0,0,0.9)',margin:0,
                  background:'rgba(0,0,0,0.3)',borderRadius:12,padding:'8px 14px',display:'inline-block'}}>{viewingStory.text}</p>
              </div>
            )}
            {/* Tap zones: лево — назад, право — вперёд */}
            <div style={{position:'absolute',left:0,top:0,bottom:0,width:'35%',zIndex:6,cursor:'pointer'}}
              onClick={e=>{e.stopPropagation();storyGo(viewingStoryIdx-1);}}/>
            <div style={{position:'absolute',right:0,top:0,bottom:0,width:'35%',zIndex:6,cursor:'pointer'}}
              onClick={e=>{e.stopPropagation();storyGo(viewingStoryIdx+1);}}/>
            {/* Кнопка закрыть */}
            <button onClick={storyClose}
              style={{position:'absolute',top:22,right:12,zIndex:15,background:'rgba(0,0,0,0.5)',
                border:'none',borderRadius:'50%',width:36,height:36,cursor:'pointer',
                color:'#fff',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Основной контейнер */}
    <div style={{width:'100%',maxWidth:430,minHeight:'100dvh',display:'flex',flexDirection:'column',background:c.deep}}>

      {/* ══ ШАПКА ══ */}
      <div style={{flexShrink:0,background:c.surface,borderBottom:`1px solid ${c.border}`,
        position:'sticky',top:0,zIndex:50}}>
        <div style={{height:48,display:'flex',alignItems:'center',padding:'0 12px',gap:8}}>
          <div style={{flex:1}}>
            <CSpan c={c} style={{fontSize:20,letterSpacing:6,fontWeight:900,
              fontFamily:'"Montserrat","Arial Black",sans-serif',textTransform:'uppercase',paddingLeft:6}}>SWAIP</CSpan>
          </div>
          <motion.button whileTap={{scale:0.88}} onClick={()=>setIsDark(v=>!v)}
            style={{width:36,height:20,borderRadius:10,background:c.trackBg,border:`1.5px solid ${c.borderB}`,
              cursor:'pointer',position:'relative',display:'flex',alignItems:'center',padding:'0 2px',flexShrink:0}}>
            <motion.div animate={{x:isDark?0:16}} transition={{type:'spring',stiffness:500,damping:30}}
              style={{width:14,height:14,borderRadius:'50%',background:c.knob,boxShadow:'0 1px 4px rgba(0,0,0,0.4)'}}/>
          </motion.button>
          <motion.button whileTap={{scale:0.88}} onClick={()=>{setShowSearch(v=>!v);setCodeResult(null);setCodeInput('');setSearchQ('');}}
            style={{width:32,height:32,borderRadius:'50%',background:showSearch?c.borderB:c.cardAlt,border:`1px solid ${c.border}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>
            {showSearch?'✕':'🔍'}
          </motion.button>
          <motion.button whileTap={{scale:0.88}}
            style={{width:32,height:32,borderRadius:'50%',background:c.cardAlt,border:`1px solid ${c.border}`,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>🔔</motion.button>
          <motion.button whileTap={{scale:0.88}} onClick={()=>setShowSideMenu(true)}
            style={{width:32,height:32,borderRadius:'50%',overflow:'hidden',border:`2px solid ${c.borderB}`,cursor:'pointer',flexShrink:0}}>
            <img src={avatarSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
          </motion.button>
        </div>

        {/* Кнопка Меню */}
        <div style={{borderTop:`1px solid ${c.border}`,padding:'5px 12px'}}>
          <motion.button whileTap={{scale:0.95}} onClick={()=>setShowSideMenu(true)}
            style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 14px',
              borderRadius:99,background:`rgba(160,160,200,0.08)`,border:`1px solid ${c.borderB}`,
              cursor:'pointer',fontSize:11,color:c.mid,fontWeight:800}}>
            <span style={{fontSize:13}}>≡</span>
            <CSpan c={c} style={{fontSize:11,fontWeight:800,letterSpacing:'0.04em'}}>Меню</CSpan>
          </motion.button>
        </div>

      </div>

      {/* ══ ИСТОРИИ ══ */}
      <div style={{flexShrink:0,background:c.surface,borderBottom:`1px solid ${c.border}`}}>
        <div style={{display:'flex',gap:8,overflowX:'auto',padding:'8px 12px 10px',scrollbarWidth:'none',msOverflowStyle:'none'}}>
          {/* Кнопка добавить историю */}
          <div onClick={()=>{setShowStoryEditor(true);setStoryError(null);setStorySuccess(false);setStoryTab('image');}} style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:4,cursor:'pointer'}}>
            <div style={{width:60,height:68,borderRadius:12,overflow:'hidden',position:'relative',flexShrink:0,
              outline:`2px dashed ${c.borderB}`,outlineOffset:1,background:c.card,
              display:'flex',alignItems:'center',justifyContent:'center'}}>
              {myStories.length>0&&myStories[0].mediaUrl
                ?(myStories[0].mediaType==='video'
                  ?<video src={myStories[0].mediaUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} muted/>
                  :<img src={myStories[0].mediaUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                ):<div style={{width:'100%',height:'100%',background:myStories.length>0?myStories[0].bgColor:c.cardAlt,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  {myStories.length===0&&<span style={{fontSize:24,opacity:0.4}}>＋</span>}
                  {myStories.length>0&&myStories[0].text&&<span style={{fontSize:10,color:'#fff',textAlign:'center',padding:'0 4px',lineHeight:1.2,fontWeight:600}}>{myStories[0].text.slice(0,20)}</span>}
                </div>
              }
              <div style={{position:'absolute',bottom:0,left:0,right:0,height:16,
                background:'linear-gradient(90deg,#8a8a9a 0%,#c8c8d8 20%,#f0f0f8 50%,#c8c8d8 80%,#8a8a9a 100%)',
                display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 -1px 4px rgba(0,0,0,0.4)'}}>
                <span style={{fontSize:5.5,fontWeight:900,letterSpacing:'0.22em',textTransform:'uppercase',color:'#1a1a2a',userSelect:'none'}}>SWAIP</span>
              </div>
              <div style={{position:'absolute',bottom:18,right:4,width:14,height:14,
                borderRadius:'50%',background:c.mid,border:`1.5px solid ${c.light}`,
                display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:900,lineHeight:1,color:'#000'}}>+</div>
            </div>
            <span style={{fontSize:9,color:c.sub,fontWeight:600,maxWidth:60,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',lineHeight:1}}>Добавить</span>
          </div>
          {/* Мои истории */}
          {myStories.slice(0,8).map((s,i)=>(
            <div key={s.id} onClick={()=>storyGo(i)} style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:4,cursor:'pointer'}}>
              <div style={{width:60,height:68,borderRadius:12,overflow:'hidden',position:'relative',
                outline:`2.5px solid rgba(180,180,255,0.8)`,outlineOffset:1,background:c.card}}>
                {s.mediaUrl
                  ?(s.mediaType==='video'
                    ?<video src={s.mediaUrl} style={{width:'100%',height:'100%',objectFit:'cover'}} muted/>
                    :<img src={s.mediaUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>)
                  :<div style={{width:'100%',height:'100%',background:s.bgColor,display:'flex',alignItems:'center',justifyContent:'center',padding:4}}>
                    <span style={{fontSize:10,color:'#fff',textAlign:'center',fontWeight:600,lineHeight:1.2}}>{s.text.slice(0,30)}</span>
                  </div>
                }
                <div style={{position:'absolute',bottom:0,left:0,right:0,height:16,
                  background:'linear-gradient(90deg,#8a8a9a 0%,#c8c8d8 20%,#f0f0f8 50%,#c8c8d8 80%,#8a8a9a 100%)',
                  display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 -1px 4px rgba(0,0,0,0.4)'}}>
                  <span style={{fontSize:5.5,fontWeight:900,letterSpacing:'0.22em',textTransform:'uppercase',color:'#1a1a2a',userSelect:'none'}}>SWAIP</span>
                </div>
              </div>
              <span style={{fontSize:9,color:c.sub,fontWeight:600,maxWidth:60,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',lineHeight:1}}>Я</span>
            </div>
          ))}
          {/* Статичные демо-истории */}
          {STORIES.slice(1).map((s)=><Story key={s.id} s={s} c={c}/>)}
        </div>
      </div>

      {/* ══ ПРОФИЛЬ ══ */}
      <div style={{flexShrink:0,
        background:postCardStyle===4?'#07070f':c.card,
        borderBottom:`1px solid ${postCardStyle===4?activeAccent+'44':c.border}`,
        boxShadow:postCardStyle===4?`0 0 24px ${activeAccent}22`:'none',
        position:'relative'}}>
        <input ref={coverFileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleCoverFile}/>
        <input ref={avatarRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleAvatarFile}/>

        {/* ОБЛОЖКА — есть во всех стилях кроме 3 и 5 */}
        {postCardStyle!==3&&postCardStyle!==5&&(
          <div style={{position:'relative',
            height:postCardStyle===2?150:postCardStyle===4?100:postCardStyle===6?56:80,
            overflow:'hidden',
            background:postCardStyle===4?(coverImageUrl?'#000':'#07070f'):coverImageUrl?'#000':coverGrad}}>
            {coverImageUrl&&<img src={coverImageUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:coverPosition}}/>}
            {postCardStyle===4&&!coverImageUrl&&<div style={{position:'absolute',inset:0,background:`linear-gradient(135deg,${activeAccent}18,transparent)`}}/>}
            {postCardStyle===4&&<div style={{position:'absolute',bottom:0,left:0,right:0,height:2,background:activeAccent,boxShadow:`0 0 12px ${activeAccent}`}}/>}
            {coverImageUrl&&(
              <motion.button whileTap={{scale:0.93}}
                onClick={()=>{const curY=parseInt((coverPosition||'50% 50%').split(' ')[1]||'50');setCropY(curY);setCoverCropSrc(coverImageUrl);setCoverCropFinal(coverImageUrl);setShowCoverCrop(true);}}
                style={{position:'absolute',bottom:6,left:8,padding:'3px 8px',borderRadius:99,
                  background:'rgba(0,0,0,0.55)',border:'1px solid rgba(255,255,255,0.2)',
                  color:'rgba(255,255,255,0.9)',fontSize:9,fontWeight:700,cursor:'pointer',backdropFilter:'blur(6px)',letterSpacing:'0.04em'}}>
                ✂️ Позиция
              </motion.button>
            )}
            <motion.button whileTap={{scale:0.93}} onClick={()=>setShowCoverPicker(v=>!v)}
              style={{position:'absolute',bottom:6,right:8,padding:'3px 8px',borderRadius:99,
                background:'rgba(0,0,0,0.55)',border:'1px solid rgba(255,255,255,0.2)',
                color:'rgba(255,255,255,0.9)',fontSize:9,fontWeight:700,cursor:'pointer',backdropFilter:'blur(6px)',letterSpacing:'0.04em'}}>
              🎨 Сменить
            </motion.button>
          </div>
        )}
        {postCardStyle===3&&<div style={{height:4,background:`linear-gradient(90deg,${activeAccent},${activeAccent}88)`}}/>}
        {postCardStyle===5&&<div style={{height:6,background:`linear-gradient(90deg,${activeAccent}66,${activeAccent},${activeAccent}66)`}}/>}

        {/* Меню выбора обложки */}
        <AnimatePresence>
          {showCoverPicker&&(
            <>
              {/* Закрыть при клике мимо */}
              <div style={{position:'fixed',inset:0,zIndex:19}} onClick={()=>setShowCoverPicker(false)}/>
              <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
                style={{position:'absolute',top:8,right:8,background:'rgba(10,10,20,0.96)',borderRadius:14,padding:10,
                  backdropFilter:'blur(16px)',minWidth:210,zIndex:20,boxShadow:'0 8px 32px rgba(0,0,0,0.6)',
                  border:'1px solid rgba(255,255,255,0.1)'}}>
                {/* Загрузка своего фото */}
                <div onClick={()=>{coverFileRef.current?.click();setShowCoverPicker(false);}}
                  style={{cursor:'pointer',padding:'8px 12px',borderRadius:10,background:'rgba(255,255,255,0.1)',marginBottom:8,
                    fontSize:12,fontWeight:700,color:'#fff',display:'flex',alignItems:'center',gap:8}}>
                  📷 Загрузить фото
                  <span style={{fontSize:9,color:'rgba(255,255,255,0.45)',marginLeft:'auto',fontWeight:400}}>900 × 240 пикс.</span>
                </div>
                {/* Изменить позицию существующего фото */}
                {coverImageUrl&&<div onClick={()=>{const curY=parseInt((coverPosition||'50% 50%').split(' ')[1]||'50');setCropY(curY);setCoverCropSrc(coverImageUrl);setCoverCropFinal(coverImageUrl);setShowCoverCrop(true);setShowCoverPicker(false);}}
                  style={{cursor:'pointer',padding:'8px 12px',borderRadius:10,background:'rgba(255,255,255,0.07)',marginBottom:8,
                    fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.85)',display:'flex',alignItems:'center',gap:8}}>
                  ✂️ Изменить позицию
                </div>}
                {/* Опция: убрать фото */}
                {coverImageUrl&&<div onClick={()=>{setCoverImageUrl('');setCoverPosition('50% 50%');setShowCoverPicker(false);}}
                  style={{cursor:'pointer',padding:'5px 12px',borderRadius:8,marginBottom:8,
                    fontSize:12,color:'rgba(255,90,90,0.9)',fontWeight:600,display:'flex',alignItems:'center',gap:8}}>
                  ✕ Убрать фото
                </div>}
                {/* Разделитель */}
                <div style={{height:1,background:'rgba(255,255,255,0.1)',margin:'4px 0 8px'}}/>
                {/* Градиенты */}
                <div style={{fontSize:9,color:'rgba(255,255,255,0.4)',marginBottom:6,letterSpacing:'0.06em',textTransform:'uppercase',fontWeight:700}}>Градиент</div>
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                  {COVER_TEMPLATES.map(tmpl=>(
                    <div key={tmpl.id} onClick={()=>{setCoverGrad(tmpl.bg);setCoverImageUrl('');setCoverPosition('50% 50%');setShowCoverPicker(false);}}
                      style={{width:34,height:22,borderRadius:6,cursor:'pointer',background:tmpl.bg,
                        border:`2px solid ${!coverImageUrl&&tmpl.bg===coverGrad?'rgba(255,255,255,0.9)':'rgba(255,255,255,0.12)'}`}}/>
                  ))}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Кроп-модалка выбора фрагмента обложки ── */}
        <AnimatePresence>
          {showCoverCrop&&(
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              style={{position:'fixed',inset:0,zIndex:9000,background:'rgba(0,0,0,0.97)',display:'flex',flexDirection:'column',overscrollBehavior:'contain'}}>
              {/* Шапка модалки */}
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px 8px',borderBottom:'1px solid rgba(255,255,255,0.1)',flexShrink:0}}>
                <motion.button whileTap={{scale:0.92}} onClick={()=>setShowCoverCrop(false)}
                  style={{background:'rgba(255,255,255,0.1)',border:'none',color:'#fff',fontSize:16,width:34,height:34,borderRadius:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                  ✕
                </motion.button>
                <div style={{flex:1}}>
                  <div style={{color:'#fff',fontWeight:800,fontSize:14}}>Выбери область шапки</div>
                  <div style={{color:'rgba(255,255,255,0.4)',fontSize:10}}>Рекомендуемый размер: 900 × 240 пикс.</div>
                </div>
                <motion.button whileTap={{scale:0.94}} onClick={applyCoverCrop}
                  style={{background:'linear-gradient(135deg,#7c3aed,#a855f7)',border:'none',color:'#fff',fontWeight:800,fontSize:13,borderRadius:20,padding:'7px 18px',cursor:'pointer'}}>
                  Применить
                </motion.button>
              </div>

              {/* Превью шапки */}
              <div style={{margin:'10px 14px 6px',borderRadius:10,overflow:'hidden',height:72,flexShrink:0,
                border:'2px solid rgba(255,255,255,0.25)',position:'relative',background:'#000'}}>
                <img src={coverCropSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:`50% ${cropY}%`,userSelect:'none',pointerEvents:'none'}}/>
                <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',pointerEvents:'none'}}>
                  <span style={{color:'rgba(255,255,255,0.35)',fontSize:9,letterSpacing:'0.12em',textTransform:'uppercase',fontWeight:700}}>Превью шапки профиля</span>
                </div>
              </div>

              {/* Полное изображение с маркером области */}
              <div style={{flex:1,overflow:'hidden',position:'relative',margin:'0 14px 0'}}>
                <img src={coverCropSrc} alt="" style={{width:'100%',height:'100%',objectFit:'contain',objectPosition:'center',userSelect:'none',pointerEvents:'none',display:'block'}}/>
                {/* Затемнение + маркер полосы */}
                <div style={{position:'absolute',inset:0,pointerEvents:'none'}}>
                  {/* Верхнее затемнение */}
                  <div style={{position:'absolute',top:0,left:0,right:0,height:`calc(${cropY}% - 12%)`,background:'rgba(0,0,0,0.55)'}}/>
                  {/* Нижнее затемнение */}
                  <div style={{position:'absolute',bottom:0,left:0,right:0,height:`calc(${100-cropY}% - 12%)`,background:'rgba(0,0,0,0.55)'}}/>
                  {/* Рамка видимой зоны */}
                  <div style={{position:'absolute',top:`calc(${cropY}% - 12%)`,left:0,right:0,height:'24%',
                    border:'2px solid rgba(255,255,255,0.7)',boxShadow:'0 0 0 1px rgba(0,0,0,0.4)',
                    display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <span style={{color:'rgba(255,255,255,0.6)',fontSize:9,fontWeight:700,letterSpacing:'0.1em',textTransform:'uppercase',background:'rgba(0,0,0,0.5)',padding:'2px 8px',borderRadius:4}}>видимая область</span>
                  </div>
                </div>
              </div>

              {/* Ползунок позиции */}
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

              {/* Кнопки быстрой позиции */}
              <div style={{display:'flex',gap:6,padding:'0 20px 16px',flexShrink:0}}>
                {([['Сверху',0],['Центр',50],['Снизу',100]] as [string,number][]).map(([lbl,val])=>(
                  <motion.button key={lbl} whileTap={{scale:0.94}} onClick={()=>setCropY(val)}
                    style={{flex:1,padding:'7px 0',borderRadius:10,border:`1px solid ${cropY===val?'#a855f7':'rgba(255,255,255,0.15)'}`,
                      background:cropY===val?'rgba(168,85,247,0.2)':'rgba(255,255,255,0.05)',
                      color:cropY===val?'#c084fc':'rgba(255,255,255,0.7)',fontSize:11,fontWeight:700,cursor:'pointer'}}>
                    {lbl}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ СТИЛЬ 1: КЛАССИКА ═══ */}
        {postCardStyle===1&&(
          <div style={{padding:'0 12px 10px'}}>
            <div style={{display:'flex',gap:12,marginBottom:8,marginTop:-30}}>
              <div style={{position:'relative',flexShrink:0}}>
                {proVizitkaUrl&&(<div style={{position:'absolute',inset:-3,borderRadius:17,background:'linear-gradient(135deg,#ff6b6b,#f8a100,#ff6b6b)',zIndex:0,animation:'spin 3s linear infinite'}}/>)}
                <div onClick={()=>avatarRef.current?.click()}
                  style={{width:78,height:90,borderRadius:14,overflow:'hidden',border:`3px solid ${c.card}`,background:c.cardAlt,position:'relative',cursor:'pointer',boxShadow:`0 4px 16px rgba(0,0,0,${isDark?'0.5':'0.2'})`,zIndex:1}}>
                  <img src={avatarSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  <div style={{position:'absolute',bottom:0,left:0,right:0,height:16,background:'linear-gradient(90deg,#8a8a9a 0%,#c8c8d8 20%,#f0f0f8 50%,#c8c8d8 80%,#8a8a9a 100%)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 -1px 4px rgba(0,0,0,0.4)'}}>
                    <span style={{fontSize:5.5,fontWeight:900,letterSpacing:'0.22em',textTransform:'uppercase',color:'#1a1a2a',userSelect:'none'}}>SWAIP</span>
                  </div>
                  {proVizitkaUrl&&(<motion.button whileTap={{scale:0.9}} onClick={e=>{e.stopPropagation();setShowVizitkaModal(true);}} style={{position:'absolute',top:4,right:4,width:22,height:22,borderRadius:'50%',background:'rgba(0,0,0,0.7)',border:'1.5px solid rgba(255,255,255,0.5)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',zIndex:2,fontSize:10}}>▶</motion.button>)}
                </div>
              </div>
              <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column',gap:3,paddingTop:32}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  {editField==='name'?<input autoFocus value={profName} onChange={e=>setProfName(e.target.value)} onBlur={()=>setEditField(null)} style={{flex:1,fontSize:15,fontWeight:900,color:c.light,borderRadius:8,border:`1.5px solid ${c.borderB}`,padding:'4px 8px',outline:'none',background:c.cardAlt,fontFamily:'inherit'}}/>
                    :<div onClick={()=>setEditField('name')} style={{cursor:'pointer',flex:1}}><span style={{fontSize:15,fontWeight:900,color:c.light,letterSpacing:'-0.03em'}}>{profName||'Введи имя'}</span></div>}
                  <motion.button whileTap={{scale:0.88}} onClick={()=>setShowShare(true)} style={{flexShrink:0,padding:'4px 10px',borderRadius:8,height:28,background:'rgba(160,160,200,0.12)',border:`1px solid ${c.borderB}`,cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontSize:10,color:c.mid,fontWeight:800,whiteSpace:'nowrap'}}>↗ Поделиться</motion.button>
                </div>
                {editField==='nick'
                  ?<div style={{display:'flex',alignItems:'center',gap:4}}>
                      <input autoFocus value={profNick} onChange={e=>setProfNick(e.target.value.replace(/\s/g,'_').replace(/[^a-zA-Z0-9_]/g,'').toLowerCase())} onBlur={()=>setEditField(null)} placeholder="cool_owl" style={{fontSize:12,color:c.sub,borderRadius:7,border:`1.5px solid ${c.borderB}`,padding:'3px 8px',outline:'none',background:c.cardAlt,fontFamily:'monospace',width:130}}/>
                      <motion.button whileTap={{scale:0.88}} onMouseDown={e=>{e.preventDefault();setProfNick(genHandle());}} title="Случайный ник" style={{background:'none',border:'none',fontSize:14,cursor:'pointer',padding:'2px 4px',lineHeight:1}}>🔀</motion.button>
                    </div>
                  :<div style={{display:'flex',alignItems:'center',gap:4,cursor:'pointer'}} onClick={()=>setEditField('nick')}><span style={{fontSize:12,color:c.sub,fontFamily:'monospace'}}>{profNick?`@${profNick}`:'@никнейм'}</span></div>
                }
                {(profPosition||profCompany)&&(<div style={{fontSize:11,color:c.sub}}>{profPosition}{profPosition&&profCompany?' · ':''}{profCompany}</div>)}
                {profMood.emoji&&(
                  <motion.div initial={{scale:0.7,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',stiffness:400,damping:18}}
                    style={{display:'inline-flex',alignItems:'center',gap:4,background:`${c.accent}18`,border:`1px solid ${c.accent}44`,borderRadius:20,padding:'2px 8px',marginTop:2,cursor:'pointer',width:'fit-content'}}
                    onClick={()=>setShowMoodPicker(v=>!v)}>
                    <motion.span animate={{rotate:[0,10,-10,0]}} transition={{repeat:Infinity,duration:3,ease:'easeInOut'}} style={{fontSize:14}}>{profMood.emoji}</motion.span>
                    <span style={{fontSize:11,color:c.accent,fontWeight:700}}>{profMood.text}</span>
                  </motion.div>
                )}
                {!profMood.emoji&&(
                  <div onClick={()=>setShowMoodPicker(v=>!v)} style={{cursor:'pointer',fontSize:11,color:c.sub,opacity:0.6,marginTop:2}}>+ Статус настроения</div>
                )}
                <div style={{display:'flex',gap:5,marginTop:4}}>
                  {[{ico:'✏️',lbl:'Написать',fn:()=>setShowInput(v=>!v)},{ico:'📞',lbl:'Звонок',fn:()=>{}},{ico:'📹',lbl:'Видео',fn:()=>{}}].map(btn=>(
                    <motion.button key={btn.lbl} whileTap={{scale:0.93}} onClick={btn.fn} style={{width:54,height:48,borderRadius:10,background:'rgba(160,160,200,0.1)',border:`1px solid ${c.borderB}`,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:2,flexShrink:0}}>
                      <span style={{fontSize:16}}>{btn.ico}</span><span style={{fontSize:8,color:c.sub,fontWeight:700,letterSpacing:'0.02em'}}>{btn.lbl}</span>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
            {editField==='bio'
              ?<div style={{marginBottom:8}}><textarea autoFocus value={profBio} onChange={e=>setProfBio(e.target.value)} rows={3} placeholder="Расскажи о себе..." style={{width:'100%',boxSizing:'border-box',borderRadius:8,border:`1.5px solid ${c.borderB}`,padding:'8px 10px',fontSize:13,color:c.light,resize:'none',outline:'none',fontFamily:'inherit',background:c.cardAlt,lineHeight:1.5}} onBlur={()=>setEditField(null)}/></div>
              :<div onClick={()=>setEditField('bio')} style={{cursor:'pointer',marginBottom:8,fontSize:13,color:profBio?c.mid:c.sub,lineHeight:1.5,fontStyle:profBio?'normal':'italic'}}>{profBio||'Расскажи о себе...'}</div>
            }
            {showMoodPicker&&(
              <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}
                style={{background:c.card,borderRadius:14,border:`1px solid ${c.borderB}`,padding:10,marginBottom:10,boxShadow:'0 8px 32px rgba(0,0,0,0.25)'}}>
                <div style={{fontSize:11,fontWeight:800,color:c.sub,marginBottom:6,letterSpacing:'0.06em',textTransform:'uppercase'}}>Статус настроения</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                  {MOOD_OPTIONS.map(m=>(
                    <motion.button key={m.emoji} whileTap={{scale:0.87}} onClick={()=>{setProfMood({emoji:m.emoji,text:m.text});setShowMoodPicker(false);}}
                      style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:20,cursor:'pointer',
                        background:profMood.emoji===m.emoji?`${c.accent}25`:c.cardAlt,
                        border:`1px solid ${profMood.emoji===m.emoji?c.accent+'77':c.borderB}`,
                        fontSize:12,fontWeight:700,color:profMood.emoji===m.emoji?c.accent:c.mid}}>
                      <span style={{fontSize:15}}>{m.emoji}</span> {m.text}
                    </motion.button>
                  ))}
                  {profMood.emoji&&(
                    <motion.button whileTap={{scale:0.87}} onClick={()=>{setProfMood({emoji:'',text:''});setShowMoodPicker(false);}}
                      style={{display:'flex',alignItems:'center',gap:4,padding:'5px 10px',borderRadius:20,cursor:'pointer',
                        background:'rgba(180,60,60,0.12)',border:'1px solid rgba(180,60,60,0.35)',
                        fontSize:12,fontWeight:700,color:'#cc6060'}}>
                      ✕ Убрать
                    </motion.button>
                  )}
                </div>
              </motion.div>
            )}
            <div style={{display:'flex',gap:6,marginBottom:8}}>
              {editField==='site'
                ?<input autoFocus value={profSite} onChange={e=>setProfSite(e.target.value)} onBlur={()=>setEditField(null)} placeholder="https://ваш-сайт.ru" style={{flex:1,borderRadius:7,border:`1.5px solid ${c.borderB}`,padding:'5px 8px',fontSize:12,color:c.light,outline:'none',fontFamily:'inherit',background:c.cardAlt}}/>
                :profSite
                  ?<div style={{flex:1,display:'flex',gap:0}}>
                    <a href={profSite.startsWith('http')?profSite:`https://${profSite}`} target="_blank" rel="noreferrer" style={{flex:1,fontSize:12,padding:'5px 8px',borderRadius:'7px 0 0 7px',background:c.cardAlt,border:`1px solid ${c.borderB}`,color:'#6060cc',textDecoration:'none',display:'flex',alignItems:'center',gap:4,overflow:'hidden'}}>
                      <span>🌐</span><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:600}}>{profSite.replace(/^https?:\/\//,'')}</span><span style={{marginLeft:'auto',opacity:0.6,flexShrink:0}}>↗</span>
                    </a>
                    <div onClick={()=>setEditField('site')} style={{padding:'5px 8px',borderRadius:'0 7px 7px 0',border:`1px solid ${c.borderB}`,borderLeft:'none',background:c.cardAlt,cursor:'pointer',fontSize:11,color:c.sub,display:'flex',alignItems:'center'}}>✎</div>
                  </div>
                  :<div onClick={()=>setEditField('site')} style={{flex:1,cursor:'pointer',fontSize:12,color:c.sub,padding:'5px 8px',borderRadius:7,background:c.cardAlt,border:`1px solid ${c.border}`}}>🌐 Добавить сайт</div>
              }
              {proContacts.phone
                ?<a href={`tel:${proContacts.phone}`} style={{flex:1,fontSize:12,padding:'5px 8px',borderRadius:7,background:c.cardAlt,border:`1px solid ${c.borderB}`,color:'#60aa60',textDecoration:'none',display:'flex',alignItems:'center',gap:4}}><span>📞</span><span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{proContacts.phone}</span></a>
                :<div style={{flex:1,fontSize:12,color:c.sub,padding:'5px 8px',borderRadius:7,background:c.cardAlt,border:`1px solid ${c.border}`}}>📞 Телефон</div>
              }
            </div>
            <div style={{display:'flex',gap:8,overflowX:'auto',padding:'2px 0 4px',scrollbarWidth:'none',msOverflowStyle:'none'}}>
              {WIDGET_LIST.map(w=><WidgetSquare key={w.key} icon={w.icon} label={wLabel(w.key,w.label)} count={w.count} c={c} previewUrl={wPreview(w.key)} onPreviewChange={()=>wOnPreview(w.key)} onLabelSave={wOnLabel(w.key)} onClick={()=>{if(w.key==='works')setShowWorksModal(true);else if(w.key==='reviews')setShowReviewsModal(true);else if(w.key==='prices')setShowPriceWidgetModal(true);else if(w.key==='booking')setOpenSheet('booking');else if(w.key==='certs')setShowCertsModal(true);else if(w.key==='cases')setShowCasesModal(true);else if(w.key==='faqs')setShowFaqModal(true);else if(w.key==='links')setShowLinksModal(true);else if(w.key==='music')setShowMusicSheet(true);else setOpenSheet(w.key);}}/>)}
            </div>
          </div>
        )}

        {/* ═══ СТИЛЬ 2: СИНЕМА ═══ */}
        {postCardStyle===2&&(
          <div style={{paddingBottom:14}}>
            <div style={{display:'flex',justifyContent:'center',marginTop:-46,position:'relative',zIndex:2}}>
              <div onClick={()=>avatarRef.current?.click()} style={{cursor:'pointer'}}>
                <div style={{width:92,height:92,borderRadius:'50%',overflow:'hidden',border:`4px solid ${c.card}`,boxShadow:`0 4px 24px rgba(0,0,0,0.5)`,background:c.cardAlt}}>
                  <img src={avatarSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                </div>
              </div>
            </div>
            <div style={{textAlign:'center',padding:'10px 16px 0'}}>
              <div onClick={()=>setEditField('name')} style={{cursor:'pointer',display:'inline-block'}}>
                {editField==='name'?<input autoFocus value={profName} onChange={e=>setProfName(e.target.value)} onBlur={()=>setEditField(null)} style={{fontSize:18,fontWeight:900,color:c.light,borderRadius:8,border:`1.5px solid ${c.borderB}`,padding:'4px 8px',outline:'none',background:c.cardAlt,fontFamily:'inherit',textAlign:'center'}}/>
                  :<span style={{fontSize:18,fontWeight:900,color:c.light,letterSpacing:'-0.02em'}}>{profName||'Введи имя'}</span>}
              </div>
              <div onClick={()=>setEditField('nick')} style={{cursor:'pointer',marginTop:2}}>
                <span style={{fontSize:12,color:c.sub,fontFamily:'monospace'}}>{profNick?`@${profNick}`:'@ник'}</span>
              </div>
              {(profPosition||profCompany)&&<div style={{fontSize:11,color:c.sub,marginTop:3}}>{profPosition}{profPosition&&profCompany?' · ':''}{profCompany}</div>}
              {editField==='bio'
                ?<textarea autoFocus value={profBio} onChange={e=>setProfBio(e.target.value)} rows={2} placeholder="Расскажи о себе..." style={{width:'100%',boxSizing:'border-box',marginTop:8,borderRadius:8,border:`1.5px solid ${c.borderB}`,padding:'6px 10px',fontSize:13,color:c.light,resize:'none',outline:'none',fontFamily:'inherit',background:c.cardAlt,textAlign:'left'}} onBlur={()=>setEditField(null)}/>
                :<div onClick={()=>setEditField('bio')} style={{cursor:'pointer',marginTop:8,fontSize:13,color:profBio?c.mid:c.sub,lineHeight:1.5,fontStyle:profBio?'normal':'italic',padding:'0 12px'}}>{profBio||'Расскажи о себе...'}</div>
              }
              {profSite&&<a href={profSite.startsWith('http')?profSite:`https://${profSite}`} target="_blank" rel="noreferrer" style={{display:'block',marginTop:6,fontSize:12,color:'#6060cc',textDecoration:'none'}}>🌐 {profSite.replace(/^https?:\/\//,'')}</a>}
              <div style={{display:'flex',justifyContent:'center',marginTop:8}}>
                {profMood.emoji?(
                  <motion.div initial={{scale:0.7,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',stiffness:400,damping:18}}
                    onClick={()=>setShowMoodPicker(v=>!v)}
                    style={{display:'inline-flex',alignItems:'center',gap:4,background:`${activeAccent}18`,border:`1px solid ${activeAccent}44`,borderRadius:20,padding:'3px 10px',cursor:'pointer'}}>
                    <motion.span animate={{rotate:[0,10,-10,0]}} transition={{repeat:Infinity,duration:3,ease:'easeInOut'}} style={{fontSize:15}}>{profMood.emoji}</motion.span>
                    <span style={{fontSize:12,color:activeAccent,fontWeight:700}}>{profMood.text}</span>
                  </motion.div>
                ):(
                  <div onClick={()=>setShowMoodPicker(v=>!v)} style={{cursor:'pointer',fontSize:11,color:c.sub,opacity:0.5}}>+ Статус настроения</div>
                )}
              </div>
            </div>
            <div style={{display:'flex',margin:'14px 16px 0',borderRadius:12,background:c.cardAlt,border:`1px solid ${c.border}`,overflow:'hidden'}}>
              {[{n:'Посты',v:posts.length},{n:'Друзья',v:0},{n:'Подписки',v:0}].map((s,i)=>(
                <div key={s.n} style={{flex:1,textAlign:'center',padding:'10px 0',borderRight:i<2?`1px solid ${c.border}`:'none'}}>
                  <div style={{fontSize:17,fontWeight:900,color:c.light}}>{s.v}</div>
                  <div style={{fontSize:9,color:c.sub,marginTop:1,letterSpacing:'0.04em'}}>{s.n}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:10,padding:'12px 16px 0'}}>
              <motion.button whileTap={{scale:0.96}} onClick={()=>setShowInput(v=>!v)} style={{flex:1,padding:'11px 0',borderRadius:12,background:activeAccent,border:'none',color:'#fff',fontWeight:800,fontSize:13,cursor:'pointer'}}>✏️ Написать</motion.button>
              <motion.button whileTap={{scale:0.96}} onClick={()=>setShowShare(true)} style={{flex:1,padding:'11px 0',borderRadius:12,background:c.cardAlt,border:`1px solid ${c.border}`,color:c.mid,fontWeight:800,fontSize:13,cursor:'pointer'}}>↗ Поделиться</motion.button>
              <motion.button whileTap={{scale:0.96}} onClick={()=>setShowCoverPicker(v=>!v)} style={{width:46,padding:'11px 0',borderRadius:12,background:c.cardAlt,border:`1px solid ${c.border}`,color:c.mid,fontWeight:800,fontSize:16,cursor:'pointer'}}>🎨</motion.button>
            </div>
            <div style={{display:'flex',gap:8,overflowX:'auto',padding:'12px 16px 2px',scrollbarWidth:'none'}}>
              {WIDGET_LIST.map(w=><WidgetSquare key={w.key} icon={w.icon} label={wLabel(w.key,w.label)} count={w.count} c={c} previewUrl={wPreview(w.key)} onPreviewChange={()=>wOnPreview(w.key)} onLabelSave={wOnLabel(w.key)} onClick={()=>{if(w.key==='works')setShowWorksModal(true);else if(w.key==='reviews')setShowReviewsModal(true);else if(w.key==='prices')setShowPriceWidgetModal(true);else if(w.key==='booking')setOpenSheet('booking');else if(w.key==='certs')setShowCertsModal(true);else if(w.key==='cases')setShowCasesModal(true);else if(w.key==='faqs')setShowFaqModal(true);else if(w.key==='links')setShowLinksModal(true);else if(w.key==='music')setShowMusicSheet(true);else setOpenSheet(w.key);}}/>)}
            </div>
          </div>
        )}

        {/* ═══ СТИЛЬ 3: РЕДАКЦИОННЫЙ ═══ */}
        {postCardStyle===3&&(
          <div style={{padding:'12px'}}>
            <div style={{display:'flex',gap:12,alignItems:'flex-start',marginBottom:10}}>
              <div onClick={()=>avatarRef.current?.click()} style={{cursor:'pointer',flexShrink:0}}>
                <div style={{width:82,height:82,overflow:'hidden',borderRadius:0,outline:`3px solid ${activeAccent}`,outlineOffset:2}}>
                  <img src={avatarSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                </div>
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div onClick={()=>setEditField('name')} style={{cursor:'pointer'}}>
                  {editField==='name'?<input autoFocus value={profName} onChange={e=>setProfName(e.target.value)} onBlur={()=>setEditField(null)} style={{width:'100%',fontSize:20,fontWeight:900,color:c.light,borderRadius:4,border:`1.5px solid ${c.borderB}`,padding:'2px 6px',outline:'none',background:c.cardAlt,fontFamily:'inherit'}}/>
                    :<span style={{fontSize:22,fontWeight:900,color:c.light,letterSpacing:'-0.04em',lineHeight:1.1,display:'block'}}>{profName||'Введи имя'}</span>}
                </div>
                <div onClick={()=>setEditField('nick')} style={{cursor:'pointer',marginTop:2}}>
                  <span style={{fontSize:10,color:`${activeAccent}bb`,fontFamily:'monospace',letterSpacing:'0.1em'}}>{profNick?`@${profNick}`:'@ник'}</span>
                </div>
                {(profPosition||profCompany)&&<div style={{fontSize:11,color:c.sub,marginTop:2,letterSpacing:'0.03em'}}>{profPosition}{profPosition&&profCompany?' / ':''}{profCompany}</div>}
                <div onClick={()=>setEditField('bio')} style={{cursor:'pointer',fontSize:12,color:profBio?c.mid:c.sub,marginTop:5,lineHeight:1.4,fontStyle:profBio?'normal':'italic'}}>{profBio||'Расскажи о себе...'}</div>
                {profSite&&<a href={profSite.startsWith('http')?profSite:`https://${profSite}`} target="_blank" rel="noreferrer" style={{display:'block',marginTop:4,fontSize:11,color:'#6060cc',textDecoration:'none'}}>🌐 {profSite.replace(/^https?:\/\//,'')}</a>}
              </div>
            </div>
            <div style={{height:2,background:`${activeAccent}55`,marginBottom:8}}/>
            <div style={{display:'flex',borderRadius:8,overflow:'hidden',border:`1px solid ${c.border}`}}>
              {[{ico:'✏️',lbl:'Написать',fn:()=>setShowInput(v=>!v)},{ico:'📞',lbl:'Звонок',fn:()=>{}},{ico:'↗',lbl:'Поделиться',fn:()=>setShowShare(true)},{ico:'🎨',lbl:'Дизайн',fn:()=>setShowCoverPicker(v=>!v)}].map((b,i,arr)=>(
                <motion.button key={b.lbl} whileTap={{scale:0.94}} onClick={b.fn}
                  style={{flex:1,padding:'9px 4px',background:c.card,border:'none',borderRight:i<arr.length-1?`1px solid ${c.border}`:'none',cursor:'pointer',fontSize:10,color:c.sub,fontWeight:700,display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                  <span style={{fontSize:14}}>{b.ico}</span><span>{b.lbl}</span>
                </motion.button>
              ))}
            </div>
            <div style={{display:'flex',gap:8,overflowX:'auto',padding:'10px 0 2px',scrollbarWidth:'none'}}>
              {WIDGET_LIST.map(w=><WidgetSquare key={w.key} icon={w.icon} label={wLabel(w.key,w.label)} count={w.count} c={c} previewUrl={wPreview(w.key)} onPreviewChange={()=>wOnPreview(w.key)} onLabelSave={wOnLabel(w.key)} onClick={()=>{if(w.key==='works')setShowWorksModal(true);else if(w.key==='reviews')setShowReviewsModal(true);else if(w.key==='prices')setShowPriceWidgetModal(true);else if(w.key==='booking')setOpenSheet('booking');else if(w.key==='certs')setShowCertsModal(true);else if(w.key==='cases')setShowCasesModal(true);else if(w.key==='faqs')setShowFaqModal(true);else if(w.key==='links')setShowLinksModal(true);else if(w.key==='music')setShowMusicSheet(true);else setOpenSheet(w.key);}}/>)}
            </div>
          </div>
        )}

        {/* ═══ СТИЛЬ 4: НЕОН ═══ */}
        {postCardStyle===4&&(
          <div style={{padding:'0 12px 12px'}}>
            <div style={{display:'flex',gap:12,marginBottom:10,marginTop:-28}}>
              <div onClick={()=>avatarRef.current?.click()} style={{cursor:'pointer',flexShrink:0,position:'relative',zIndex:1}}>
                <div style={{width:80,height:80,borderRadius:8,overflow:'hidden',border:`2px solid ${activeAccent}`,boxShadow:`0 0 16px ${activeAccent}66`,position:'relative'}}>
                  <img src={avatarSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  <div style={{position:'absolute',bottom:0,left:0,right:0,height:14,background:'linear-gradient(90deg,#8a8a9a 0%,#c8c8d8 20%,#f0f0f8 50%,#c8c8d8 80%,#8a8a9a 100%)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    <span style={{fontSize:5,fontWeight:900,letterSpacing:'0.22em',textTransform:'uppercase',color:'#1a1a2a'}}>SWAIP</span>
                  </div>
                </div>
              </div>
              <div style={{flex:1,paddingTop:30,minWidth:0}}>
                <div onClick={()=>setEditField('name')} style={{cursor:'pointer'}}>
                  {editField==='name'?<input autoFocus value={profName} onChange={e=>setProfName(e.target.value)} onBlur={()=>setEditField(null)} style={{width:'100%',fontSize:15,fontWeight:900,borderRadius:4,border:`1px solid ${activeAccent}`,padding:'2px 6px',outline:'none',background:'#07070f',color:activeAccent,fontFamily:'monospace'}}/>
                    :<span style={{fontSize:16,fontWeight:900,color:activeAccent,textShadow:`0 0 12px ${activeAccent}88`,letterSpacing:'-0.01em'}}>{profName||'Введи имя'}</span>}
                </div>
                <div onClick={()=>setEditField('nick')} style={{cursor:'pointer',marginTop:1}}>
                  <span style={{fontSize:10,color:`${activeAccent}88`,fontFamily:'monospace'}}>{profNick?`@${profNick}`:'@ник'}</span>
                </div>
                <div style={{display:'flex',gap:4,marginTop:6,flexWrap:'wrap'}}>
                  {[{l:'ПОСТОВ',v:posts.length},{l:'FOLLOWERS',v:0}].map(s=>(
                    <div key={s.l} style={{padding:'2px 7px',borderRadius:3,border:`1px solid ${activeAccent}44`,background:`${activeAccent}11`,fontSize:9,fontWeight:900,color:activeAccent,letterSpacing:'0.1em'}}>{s.v} {s.l}</div>
                  ))}
                </div>
              </div>
              <motion.button whileTap={{scale:0.88}} onClick={()=>setShowShare(true)} style={{flexShrink:0,alignSelf:'flex-start',marginTop:32,padding:'5px 10px',borderRadius:5,background:`${activeAccent}18`,border:`1px solid ${activeAccent}66`,color:activeAccent,fontSize:11,fontWeight:800,cursor:'pointer'}}>↗</motion.button>
            </div>
            {editField==='bio'
              ?<textarea autoFocus value={profBio} onChange={e=>setProfBio(e.target.value)} rows={2} placeholder="Расскажи о себе..." style={{width:'100%',boxSizing:'border-box',marginBottom:10,borderRadius:6,border:`1px solid ${activeAccent}55`,padding:'6px 10px',fontSize:12,color:'rgba(200,210,255,0.9)',resize:'none',outline:'none',fontFamily:'monospace',background:'#07070f'}} onBlur={()=>setEditField(null)}/>
              :<div onClick={()=>setEditField('bio')} style={{cursor:'pointer',fontSize:12,color:'rgba(200,210,255,0.7)',lineHeight:1.5,margin:'0 0 10px',fontFamily:'monospace',fontStyle:profBio?'normal':'italic'}}>{profBio||'// Расскажи о себе...'}</div>
            }
            <div style={{display:'flex',gap:6,marginBottom:10}}>
              {[{ico:'✏️',lbl:'Написать',fn:()=>setShowInput(v=>!v)},{ico:'📞',lbl:'Звонок',fn:()=>{}},{ico:'📹',lbl:'Видео',fn:()=>{}},{ico:'🎨',lbl:'Дизайн',fn:()=>setShowCoverPicker(v=>!v)}].map(b=>(
                <motion.button key={b.lbl} whileTap={{scale:0.93}} onClick={b.fn} style={{flex:1,padding:'8px 0',borderRadius:6,background:'transparent',border:`1px solid ${activeAccent}55`,color:activeAccent,cursor:'pointer',fontSize:8,fontWeight:800,display:'flex',flexDirection:'column',alignItems:'center',gap:2,boxShadow:`inset 0 0 10px ${activeAccent}0a`}}>
                  <span style={{fontSize:14}}>{b.ico}</span><span style={{letterSpacing:'0.06em'}}>{b.lbl.toUpperCase()}</span>
                </motion.button>
              ))}
            </div>
            <div style={{display:'flex',gap:8,overflowX:'auto',scrollbarWidth:'none'}}>
              {WIDGET_LIST.map(w=><WidgetSquare key={w.key} icon={w.icon} label={wLabel(w.key,w.label)} count={w.count} c={c} previewUrl={wPreview(w.key)} onPreviewChange={()=>wOnPreview(w.key)} onLabelSave={wOnLabel(w.key)} onClick={()=>{if(w.key==='works')setShowWorksModal(true);else if(w.key==='reviews')setShowReviewsModal(true);else if(w.key==='prices')setShowPriceWidgetModal(true);else if(w.key==='booking')setOpenSheet('booking');else if(w.key==='certs')setShowCertsModal(true);else if(w.key==='cases')setShowCasesModal(true);else if(w.key==='faqs')setShowFaqModal(true);else if(w.key==='links')setShowLinksModal(true);else if(w.key==='music')setShowMusicSheet(true);else setOpenSheet(w.key);}}/>)}
            </div>
          </div>
        )}

        {/* ═══ СТИЛЬ 5: МИНИМАЛ ═══ */}
        {postCardStyle===5&&(
          <div style={{padding:'20px 12px 16px',textAlign:'center'}}>
            <div onClick={()=>avatarRef.current?.click()} style={{cursor:'pointer',display:'inline-block',marginBottom:12}}>
              <div style={{width:76,height:76,borderRadius:'50%',overflow:'hidden',border:`3px solid ${c.card}`,outline:`2px solid ${activeAccent}55`,boxShadow:`0 2px 18px rgba(0,0,0,0.25)`,margin:'0 auto'}}>
                <img src={avatarSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              </div>
            </div>
            <div onClick={()=>setEditField('name')} style={{cursor:'pointer'}}>
              {editField==='name'?<input autoFocus value={profName} onChange={e=>setProfName(e.target.value)} onBlur={()=>setEditField(null)} style={{fontSize:18,fontWeight:900,color:c.light,borderRadius:8,border:`1.5px solid ${c.borderB}`,padding:'4px 12px',outline:'none',background:c.cardAlt,fontFamily:'inherit',textAlign:'center'}}/>
                :<span style={{fontSize:18,fontWeight:900,color:c.light,letterSpacing:'-0.03em'}}>{profName||'Введи имя'}</span>}
            </div>
            <div onClick={()=>setEditField('nick')} style={{cursor:'pointer',marginTop:2}}>
              <span style={{fontSize:11,color:c.sub,fontFamily:'monospace'}}>{profNick?`@${profNick}`:'@никнейм'}</span>
            </div>
            {(profPosition||profCompany)&&<div style={{fontSize:11,color:c.sub,marginTop:3}}>{profPosition}{profPosition&&profCompany?' · ':''}{profCompany}</div>}
            <div onClick={()=>setEditField('bio')} style={{cursor:'pointer',marginTop:8,fontSize:13,color:profBio?c.mid:c.sub,lineHeight:1.5,fontStyle:profBio?'normal':'italic',padding:'0 20px'}}>{profBio||'Расскажи о себе...'}</div>
            {profSite&&<a href={profSite.startsWith('http')?profSite:`https://${profSite}`} target="_blank" rel="noreferrer" style={{display:'block',marginTop:6,fontSize:12,color:'#6060cc',textDecoration:'none'}}>🌐 {profSite.replace(/^https?:\/\//,'')}</a>}
            <div style={{display:'flex',justifyContent:'center',gap:28,marginTop:16}}>
              {[{ico:'✏️',lbl:'Написать',fn:()=>setShowInput(v=>!v)},{ico:'↗',lbl:'Поделиться',fn:()=>setShowShare(true)},{ico:'🎨',lbl:'Дизайн',fn:()=>setShowCoverPicker(v=>!v)}].map(b=>(
                <motion.button key={b.lbl} whileTap={{scale:0.9}} onClick={b.fn} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,background:'none',border:'none',cursor:'pointer'}}>
                  <div style={{width:46,height:46,borderRadius:'50%',background:c.cardAlt,border:`1px solid ${c.border}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>{b.ico}</div>
                  <span style={{fontSize:10,color:c.sub,fontWeight:700}}>{b.lbl}</span>
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* ═══ СТИЛЬ 6: КОМПАКТ ═══ */}
        {postCardStyle===6&&(
          <div style={{padding:'0 12px 10px'}}>
            <div style={{display:'flex',gap:10,alignItems:'flex-start',marginTop:-16}}>
              <div onClick={()=>avatarRef.current?.click()} style={{cursor:'pointer',flexShrink:0,zIndex:1,position:'relative'}}>
                <div style={{width:62,height:62,borderRadius:10,overflow:'hidden',border:`2px solid ${c.card}`,boxShadow:`0 2px 10px rgba(0,0,0,0.3)`}}>
                  <img src={avatarSrc} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                </div>
              </div>
              <div style={{flex:1,minWidth:0,paddingTop:18}}>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <div onClick={()=>setEditField('name')} style={{cursor:'pointer',flex:1,overflow:'hidden'}}>
                    {editField==='name'?<input autoFocus value={profName} onChange={e=>setProfName(e.target.value)} onBlur={()=>setEditField(null)} style={{width:'100%',fontSize:14,fontWeight:900,borderRadius:6,border:`1.5px solid ${c.borderB}`,padding:'2px 6px',outline:'none',background:c.cardAlt,fontFamily:'inherit',color:c.light}}/>
                      :<span style={{fontSize:14,fontWeight:900,color:c.light,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',display:'block'}}>{profName||'Введи имя'}</span>}
                  </div>
                  <motion.button whileTap={{scale:0.88}} onClick={()=>setShowShare(true)} style={{flexShrink:0,padding:'3px 8px',borderRadius:6,background:c.cardAlt,border:`1px solid ${c.borderB}`,cursor:'pointer',fontSize:10,color:c.sub,fontWeight:800}}>↗</motion.button>
                </div>
                <div onClick={()=>setEditField('nick')} style={{cursor:'pointer',marginTop:1}}>
                  <span style={{fontSize:10,color:c.sub,fontFamily:'monospace'}}>{profNick?`@${profNick}`:'@ник'}</span>
                </div>
                {editField==='bio'
                  ?<input autoFocus value={profBio} onChange={e=>setProfBio(e.target.value)} onBlur={()=>setEditField(null)} placeholder="Расскажи о себе..." style={{width:'100%',fontSize:11,borderRadius:6,border:`1.5px solid ${c.borderB}`,padding:'2px 6px',outline:'none',background:c.cardAlt,fontFamily:'inherit',color:c.light,marginTop:3}}/>
                  :<div onClick={()=>setEditField('bio')} style={{cursor:'pointer',fontSize:11,color:profBio?c.mid:c.sub,marginTop:2,lineHeight:1.3,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2 as any,WebkitBoxOrient:'vertical' as any}}>{profBio||'Добавить биографию...'}</div>
                }
              </div>
            </div>
            <div style={{display:'flex',gap:5,marginTop:8}}>
              {[{ico:'✏️',lbl:'Написать',fn:()=>setShowInput(v=>!v)},{ico:'📞',lbl:'Звонок',fn:()=>{}},{ico:'📹',lbl:'Видео',fn:()=>{}},{ico:'🎨',lbl:'Дизайн',fn:()=>setShowCoverPicker(v=>!v)}].map(btn=>(
                <motion.button key={btn.lbl} whileTap={{scale:0.93}} onClick={btn.fn} style={{flex:1,height:44,borderRadius:8,background:c.cardAlt,border:`1px solid ${c.borderB}`,cursor:'pointer',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:1,flexShrink:0}}>
                  <span style={{fontSize:14}}>{btn.ico}</span><span style={{fontSize:7,color:c.sub,fontWeight:700}}>{btn.lbl}</span>
                </motion.button>
              ))}
            </div>
            {profSite&&<a href={profSite.startsWith('http')?profSite:`https://${profSite}`} target="_blank" rel="noreferrer" style={{display:'block',marginTop:6,fontSize:11,color:'#6060cc',textDecoration:'none'}}>🌐 {profSite.replace(/^https?:\/\//,'')}</a>}
            <div style={{display:'flex',gap:8,overflowX:'auto',padding:'8px 0 2px',scrollbarWidth:'none'}}>
              {WIDGET_LIST.map(w=><WidgetSquare key={w.key} icon={w.icon} label={wLabel(w.key,w.label)} count={w.count} c={c} previewUrl={wPreview(w.key)} onPreviewChange={()=>wOnPreview(w.key)} onLabelSave={wOnLabel(w.key)} onClick={()=>{if(w.key==='works')setShowWorksModal(true);else if(w.key==='reviews')setShowReviewsModal(true);else if(w.key==='prices')setShowPriceWidgetModal(true);else if(w.key==='booking')setOpenSheet('booking');else if(w.key==='certs')setShowCertsModal(true);else if(w.key==='cases')setShowCasesModal(true);else if(w.key==='faqs')setShowFaqModal(true);else if(w.key==='links')setShowLinksModal(true);else if(w.key==='music')setShowMusicSheet(true);else setOpenSheet(w.key);}}/>)}
            </div>
          </div>
        )}
      </div>

      {/* ══ ХАЙЛАЙТЫ ══ */}
      {proHighlights.length>0&&(
        <div style={{background:c.card,borderBottom:`1px solid ${c.border}`,padding:'10px 12px'}}>
          <div style={{display:'flex',gap:12,overflowX:'auto',paddingBottom:2}}>
            {proHighlights.map(hl=>(
              <motion.div key={hl.id} whileTap={{scale:0.94}} onClick={()=>{setHlEditingId(hl.id);setHlNewTitle(hl.title);setHlNewEmoji(hl.emoji);setHlNewCoverUrl(hl.coverUrl);setShowHlEditor(true);}}
                style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:5,cursor:'pointer'}}>
                <div style={{width:54,height:54,borderRadius:'50%',overflow:'hidden',
                  background:hl.coverUrl?`url(${hl.coverUrl}) center/cover`:`linear-gradient(135deg,${activeAccent},#818cf8)`,
                  border:`2px solid ${activeAccent}55`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>
                  {!hl.coverUrl&&hl.emoji}
                </div>
                <span style={{fontSize:9,color:c.sub,fontWeight:600,maxWidth:56,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textAlign:'center'}}>{hl.title}</span>
              </motion.div>
            ))}
            <motion.div whileTap={{scale:0.94}} onClick={()=>{setHlEditingId(null);setHlNewTitle('');setHlNewEmoji('✨');setHlNewCoverUrl('');setShowHlEditor(true);}}
              style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:5,cursor:'pointer'}}>
              <div style={{width:54,height:54,borderRadius:'50%',border:`2px dashed ${c.borderB}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,color:c.sub}}>+</div>
              <span style={{fontSize:9,color:c.sub,fontWeight:600}}>Добавить</span>
            </motion.div>
          </div>
        </div>
      )}

      {/* ══ ПОЛНЫЙ COMPOSER ПОСТА ══ */}
      <div style={{padding:'8px 10px 0',background:c.card,borderBottom:`1px solid ${c.border}`}}>
        <PostComposerFull
          authorMode="pro"
          avatarUrl={avatarSrc}
          c={c}
          accent={activeAccent}
          onPickFromPlaylist={()=>{
            setMusicPickerCb(()=>(t:Track)=>{window.dispatchEvent(new CustomEvent('swaip-track-picked-for-post',{detail:t}));});
            setShowMusicPicker(true);
          }}
          onPostCreated={(p)=>{
            const raw=p as any;
            const docUrls:DocAtt[]|undefined=raw.docUrls&&raw.docUrls.length?raw.docUrls:undefined;
            const newPost:Post={id:`p_${Date.now()}`,text:p.content||'',img:p.imageUrl||undefined,videoUrl:p.videoUrl||undefined,audioUrl:p.audioUrl||undefined,docUrls,likes:0,liked:false,comments:0,ts:'только что',
              ...(raw.hasBooking?{hasBooking:true,bookingLabel:raw.bookingLabel||'Записаться',bookingSlots:Array.isArray(raw.bookingSlots)?raw.bookingSlots:[]}:{})};
            setPosts(prev=>[newPost,...prev]);
          }}
        />
      </div>

      {/* ══ ТАБЫ ══ */}
      <div style={{flexShrink:0,display:'flex',background:c.card,borderBottom:`1px solid ${c.border}`}}>
        {([['feed','Лента'],['widgets','Виджеты']] as ['feed'|'widgets',string][]).map(([k,lbl])=>{
          const active=tab===k;
          return <button key={k} onClick={()=>setTab(k)}
            style={{flex:1,padding:'9px 0',border:'none',background:'none',cursor:'pointer',
              fontWeight:active?900:500,fontSize:12,color:active?c.light:c.sub,
              borderBottom:active?`2.5px solid ${c.mid}`:'2.5px solid transparent',transition:'all 0.15s'}}>{lbl}</button>;
        })}
      </div>

      {/* ══ КОНТЕНТ ══ */}
      <div style={{padding:'10px 10px 0',background:feedBgGradient||c.deep,backgroundAttachment:'fixed'}}>
        {tab==='feed'?(
          <>
            {posts.map(p=><PostCard key={p.id} p={p} name={profName} avatarSrc={avatarSrc} onLike={toggleLike} onComment={id=>setCommentPostId(id)} onBook={(id,time)=>setPosts(prev=>prev.map(q=>{if(q.id!==id||!q.hasBooking||!time||!q.bookingSlots?.length)return q;return{...q,bookingSlots:q.bookingSlots.map(s=>s.time===time?{...s,booked:true}:s)};}))} onUpdate={upd=>setPosts(prev=>prev.map(q=>q.id===upd.id?upd:q))} onNewPost={raw=>{const b=raw as any;const np:Post={id:String(b.id||`p_${Date.now()}`),text:b.content||'',img:b.imageUrl||undefined,videoUrl:b.videoUrl||undefined,audioUrl:b.audioUrl||undefined,likes:0,liked:false,comments:0,ts:'только что',...(b.quoteOf?{quoteOf:b.quoteOf}:{}),...(b.repostOf?{repostOf:b.repostOf}:{})};setPosts(prev=>[np,...prev]);}} isOwner={true} c={c} accent={activeAccent} style={postCardStyle}/>)}
            <motion.button whileTap={{scale:0.97}}
              style={{width:'100%',padding:'11px',borderRadius:12,background:`rgba(160,160,200,0.07)`,
                border:`1px solid ${c.borderB}`,cursor:'pointer',fontWeight:800,fontSize:12,marginBottom:12,color:c.mid}}>
              Загрузить ещё
            </motion.button>
          </>
        ):(
          <>
            <div style={{fontSize:9,fontWeight:800,color:c.sub,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:8}}>Мои блоки</div>
            <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}}>
              {WIDGET_LIST.map(w=><WidgetSquare key={w.key} icon={w.icon} label={wLabel(w.key,w.label)} count={w.count} c={c} previewUrl={wPreview(w.key)} onPreviewChange={()=>wOnPreview(w.key)} onLabelSave={wOnLabel(w.key)} onClick={()=>{
              if(w.key==='works')setShowWorksModal(true);
              else if(w.key==='reviews')setShowReviewsModal(true);
              else if(w.key==='prices')setShowPriceWidgetModal(true);
              else if(w.key==='booking')setOpenSheet('booking');
              else if(w.key==='certs')setShowCertsModal(true);
              else if(w.key==='cases')setShowCasesModal(true);
              else if(w.key==='faqs')setShowFaqModal(true);
              else if(w.key==='links')setShowLinksModal(true);
              else if(w.key==='music')setShowMusicSheet(true);
              else setOpenSheet(w.key);
            }}/>)}
            </div>
          </>
        )}
        <div style={{height:72}}/>
      </div>

      {/* ══ НИЖНЯЯ НАВИГАЦИЯ ══ */}
      <div style={{position:'fixed',bottom:0,left:0,right:0,
        background:c.surface,borderTop:`1px solid ${c.border}`,display:'flex',justifyContent:'space-around',
        padding:`8px 0 max(8px,env(safe-area-inset-bottom))`,zIndex:100}}>
        {[{e:'👤',l:'Профиль',on:true,fn:()=>{}},{e:'💬',l:'Чаты',on:false,fn:()=>{}},{e:'🔎',l:'Поиск',on:false,fn:()=>{setShowSearch(v=>!v);setCodeResult(null);setCodeInput('');setSearchQ('');}},{e:'🔖',l:'Закладки',on:false,fn:()=>{loadBookmarks();setShowBookmarksModal(true);}},{e:'📡',l:'Поток',on:false,fn:()=>{}}]
          .map(item=>(
          <motion.button key={item.l} whileTap={{scale:0.82}} onClick={item.fn}
            style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2,background:'none',border:'none',cursor:'pointer',padding:'0 8px',flex:1}}>
            <span style={{fontSize:18,opacity:item.on?1:0.35}}>{item.e}</span>
            <span style={{fontSize:8,letterSpacing:'0.05em',textTransform:'uppercase',fontWeight:item.on?900:500,color:item.on?c.light:c.sub}}>{item.l}</span>
          </motion.button>
        ))}
      </div>

      {/* ══ ВИДЖЕТ-МОДАЛКИ (полноэкранные, как в Про) ══ */}

      {/* ══ МОДАЛ: МОИ РАБОТЫ ══ */}
      <AnimatePresence>
        {showWorksModal && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:3000,
              display:'flex', flexDirection:'column', backdropFilter:'blur(8px)' }}>
            {worksEditId !== null ? (
              <motion.div initial={{ y:80, opacity:0 }} animate={{ y:0, opacity:1 }}
                style={{ position:'absolute', inset:0, background:'#0f0f1a', display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 16px 12px',
                  borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                  <motion.button whileTap={{ scale:0.93 }} onClick={() => {
                    setWorksEditId(null); setWorksEditTitle(''); setWorksEditDesc('');
                    setWorksEditImageUrl(''); setWorksEditImageFile(null); setWorksEditImagePrev('');
                  }} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:22, cursor:'pointer', padding:0 }}>←</motion.button>
                  <div style={{ fontSize:17, fontWeight:800, color:'#fff', flex:1 }}>
                    {worksEditId === 'new' ? 'Добавить работу' : 'Редактировать работу'}
                  </div>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'20px 16px', display:'flex', flexDirection:'column', gap:18 }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.5)', marginBottom:8, letterSpacing:'0.06em', textTransform:'uppercase' }}>Фото работы</div>
                    <motion.div whileTap={{ scale:0.97 }} onClick={() => worksEditImgRef.current?.click()}
                      style={{ width:'100%', height:200, borderRadius:16, overflow:'hidden', cursor:'pointer',
                        background:'rgba(255,255,255,0.05)', border:'2px dashed rgba(255,255,255,0.15)',
                        display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                      {worksEditImagePrev
                        ? <img src={worksEditImagePrev} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        : worksEditImageUrl
                          ? <img src={worksEditImageUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : <div style={{ textAlign:'center' }}>
                              <div style={{ fontSize:36, marginBottom:8 }}>📸</div>
                              <div style={{ fontSize:13, color:'rgba(255,255,255,0.35)' }}>Нажмите чтобы выбрать фото</div>
                              <div style={{ fontSize:11, color:'rgba(255,255,255,0.2)', marginTop:4 }}>Рекомендуется 1:1 или 4:3</div>
                            </div>
                      }
                      {worksEditUploading && (
                        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.6)',
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'#60a5fa' }}>⏳ Загрузка...</div>
                      )}
                    </motion.div>
                    <input ref={worksEditImgRef} type="file" accept="image/*" style={{ display:'none' }}
                      onChange={async e => {
                        const f = e.target.files?.[0]; if (!f) return;
                        setWorksEditImageFile(f);
                        setWorksEditImagePrev(URL.createObjectURL(f));
                        e.target.value = '';
                      }} />
                    {(worksEditImagePrev || worksEditImageUrl) && (
                      <motion.button whileTap={{ scale:0.95 }} onClick={() => {
                        setWorksEditImageFile(null); setWorksEditImagePrev(''); setWorksEditImageUrl('');
                      }} style={{ marginTop:8, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)',
                        borderRadius:8, padding:'6px 14px', color:'#f87171', fontSize:12, cursor:'pointer' }}>
                        🗑️ Удалить фото
                      </motion.button>
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.5)', marginBottom:8, letterSpacing:'0.06em', textTransform:'uppercase' }}>Название работы *</div>
                    <input value={worksEditTitle} onChange={e=>setWorksEditTitle(e.target.value)}
                      placeholder="Например: Сайт для кофейни &quot;Уют&quot;"
                      style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1.5px solid rgba(255,255,255,0.12)',
                        borderRadius:12, padding:'14px', color:'#fff', fontSize:15, outline:'none',
                        boxSizing:'border-box', fontFamily:'inherit' }} />
                  </div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.5)', marginBottom:8, letterSpacing:'0.06em', textTransform:'uppercase' }}>Описание (необязательно)</div>
                    <textarea value={worksEditDesc} onChange={e=>setWorksEditDesc(e.target.value)}
                      placeholder="Расскажите подробнее: что делали, какой результат, сроки..."
                      rows={4}
                      style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1.5px solid rgba(255,255,255,0.12)',
                        borderRadius:12, padding:'14px', color:'#fff', fontSize:14, outline:'none',
                        boxSizing:'border-box', fontFamily:'inherit', resize:'none', lineHeight:1.5 }} />
                  </div>
                  <motion.button whileTap={{ scale:0.97 }} onClick={async () => {
                    if (!worksEditTitle.trim()) return;
                    setWorksEditUploading(true);
                    let finalImageUrl = worksEditImageUrl;
                    if (worksEditImageFile) {
                      const r = await fetch(`${apiBase}/api/image-upload`,{method:'POST',headers:{'Content-Type':worksEditImageFile.type},body:worksEditImageFile});
                      if(r.ok){const{url}=await r.json();finalImageUrl=url;}
                    }
                    setWorksEditUploading(false);
                    const newWork: ClassicWork = { id: worksEditId==='new' ? Date.now().toString() : worksEditId!, imageUrl:finalImageUrl, title:worksEditTitle.trim(), desc:worksEditDesc.trim() };
                    if (worksEditId==='new') setClassicWorks(prev=>[newWork,...prev]);
                    else setClassicWorks(prev=>prev.map(w=>w.id===worksEditId?newWork:w));
                    setWorksEditId(null); setWorksEditTitle(''); setWorksEditDesc('');
                    setWorksEditImageUrl(''); setWorksEditImageFile(null); setWorksEditImagePrev('');
                  }}
                    style={{ width:'100%', padding:'16px', background: worksEditTitle.trim() ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'rgba(255,255,255,0.06)',
                      border:'none', borderRadius:14, color: worksEditTitle.trim() ? '#fff' : 'rgba(255,255,255,0.25)',
                      fontSize:16, fontWeight:800, cursor: worksEditTitle.trim() ? 'pointer' : 'default', letterSpacing:'0.04em' }}>
                    {worksEditUploading ? '⏳ Загрузка...' : worksEditId==='new' ? '✅ Добавить работу' : '✅ Сохранить изменения'}
                  </motion.button>
                  <div style={{ height:40 }} />
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ y:60, opacity:0 }} animate={{ y:0, opacity:1 }}
                style={{ position:'absolute', inset:0, background:'#0f0f1a', display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex', alignItems:'center', padding:'18px 16px 14px',
                  borderBottom:'1px solid rgba(255,255,255,0.08)', gap:12 }}>
                  <div style={{ fontSize:22, fontWeight:900, color:'#fff', flex:1 }}>🎨 Мои работы</div>
                  <motion.button whileTap={{ scale:0.93 }} onClick={() => {
                    setWorksEditId('new'); setWorksEditTitle(''); setWorksEditDesc('');
                    setWorksEditImageUrl(''); setWorksEditImageFile(null); setWorksEditImagePrev('');
                  }} style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', borderRadius:12,
                    padding:'10px 16px', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', flexShrink:0 }}>
                    + Добавить
                  </motion.button>
                  <motion.button whileTap={{ scale:0.93 }} onClick={() => setShowWorksModal(false)}
                    style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)',
                      borderRadius:10, width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:18, cursor:'pointer', flexShrink:0 }}>✕</motion.button>
                </div>
                <div style={{ margin:'12px 16px 0', padding:'10px 14px', background:'rgba(99,102,241,0.08)',
                  border:'1px solid rgba(99,102,241,0.2)', borderRadius:12 }}>
                  <div style={{ fontSize:12, color:'rgba(99,102,241,0.9)', lineHeight:1.5 }}>
                    💡 Нажмите 🖼️ на виджет-карточке, чтобы задать превью-фото раздела
                  </div>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'14px 16px' }}>
                  {classicWorks.length === 0 ? (
                    <div style={{ textAlign:'center', paddingTop:60 }}>
                      <div style={{ fontSize:56, marginBottom:16 }}>🎨</div>
                      <div style={{ fontSize:18, fontWeight:800, color:'#fff', marginBottom:8 }}>Добавьте свои работы</div>
                      <div style={{ fontSize:14, color:'rgba(255,255,255,0.4)', lineHeight:1.6, maxWidth:260, margin:'0 auto' }}>
                        Покажите потенциальным клиентам примеры ваших проектов — с фото, названием и описанием
                      </div>
                    </div>
                  ) : (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                      {classicWorks.map(work => (
                        <div key={work.id} style={{ borderRadius:16, overflow:'hidden', background:'rgba(255,255,255,0.05)',
                          border:'1px solid rgba(255,255,255,0.09)', position:'relative' }}>
                          {work.imageUrl
                            ? <img src={work.imageUrl} alt={work.title}
                                style={{ width:'100%', aspectRatio:'1/1', objectFit:'cover', display:'block' }} />
                            : <div style={{ width:'100%', aspectRatio:'1/1', background:'rgba(255,255,255,0.04)',
                                display:'flex', alignItems:'center', justifyContent:'center', fontSize:30 }}>🎨</div>
                          }
                          <div style={{ padding:'10px 10px 12px' }}>
                            <div style={{ fontSize:13, fontWeight:800, color:'#fff', marginBottom:4, lineHeight:1.3 }}>{work.title}</div>
                            {work.desc && <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', lineHeight:1.4 }}>{work.desc.slice(0,60)}{work.desc.length>60?'…':''}</div>}
                          </div>
                          <div style={{ display:'flex', gap:6, padding:'0 10px 10px' }}>
                            <motion.button whileTap={{ scale:0.93 }} onClick={() => {
                              setWorksEditId(work.id); setWorksEditTitle(work.title);
                              setWorksEditDesc(work.desc); setWorksEditImageUrl(work.imageUrl);
                              setWorksEditImageFile(null); setWorksEditImagePrev('');
                            }} style={{ flex:1, background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.25)',
                              borderRadius:8, padding:'7px', color:'#a5b4fc', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                              ✏️ Изменить
                            </motion.button>
                            <motion.button whileTap={{ scale:0.93 }} onClick={() => setClassicWorks(prev=>prev.filter(w=>w.id!==work.id))}
                              style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
                                borderRadius:8, padding:'7px 10px', color:'#f87171', fontSize:13, cursor:'pointer' }}>
                              🗑️
                            </motion.button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ height:40 }} />
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ МОДАЛ: ОТЗЫВЫ ══ */}
      <AnimatePresence>
        {showReviewsModal && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:3000,
              display:'flex', flexDirection:'column', backdropFilter:'blur(8px)' }}>
            {reviewEditId !== null ? (
              <motion.div initial={{ y:80, opacity:0 }} animate={{ y:0, opacity:1 }}
                style={{ position:'absolute', inset:0, background:'#0f0f1a', display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 16px 12px',
                  borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                  <motion.button whileTap={{ scale:0.93 }} onClick={() => {
                    setReviewEditId(null); setReviewEditImageUrl(''); setReviewEditImageFile(null);
                    setReviewEditImagePrev(''); setReviewEditCaption('');
                  }} style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:22, cursor:'pointer', padding:0 }}>←</motion.button>
                  <div style={{ fontSize:17, fontWeight:800, color:'#fff', flex:1 }}>О нас пишут</div>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'20px 16px', display:'flex', flexDirection:'column', gap:18 }}>
                  <div style={{ background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:14, padding:'14px' }}>
                    <div style={{ fontSize:13, fontWeight:800, color:'rgba(100,160,255,0.9)', marginBottom:6 }}>📲 Прикрепите скриншот или фото</div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,0.5)', lineHeight:1.6 }}>
                      Загрузите скриншот из WhatsApp, Telegram, Instagram или любого другого источника, где о вас отзываются. Никаких оценок и имён — только реальный документ.
                    </div>
                  </div>
                  <input ref={reviewEditImgRef} type="file" accept="image/*" style={{ display:'none' }}
                    onChange={e => {
                      const f = e.target.files?.[0]; if (!f) return;
                      setReviewEditImageFile(f);
                      const url = URL.createObjectURL(f); setReviewEditImagePrev(url);
                    }} />
                  {(reviewEditImagePrev || reviewEditImageUrl) ? (
                    <div style={{ position:'relative', borderRadius:16, overflow:'hidden', border:'2px solid rgba(59,130,246,0.4)', cursor:'pointer' }}
                      onClick={() => reviewEditImgRef.current?.click()}>
                      <img src={reviewEditImagePrev || reviewEditImageUrl} alt=""
                        style={{ width:'100%', maxHeight:400, objectFit:'contain', background:'#111', display:'block' }} />
                      <div style={{ position:'absolute', bottom:8, right:8, background:'rgba(0,0,0,0.75)', borderRadius:8, padding:'5px 10px',
                        fontSize:11, color:'#fff', fontWeight:700 }}>🔄 Заменить</div>
                    </div>
                  ) : (
                    <motion.button whileTap={{ scale:0.96 }} onClick={() => reviewEditImgRef.current?.click()}
                      style={{ width:'100%', aspectRatio:'16/9', background:'rgba(255,255,255,0.04)', border:'2px dashed rgba(59,130,246,0.35)',
                        borderRadius:16, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                        gap:10, cursor:'pointer', color:'rgba(255,255,255,0.5)' }}>
                      <div style={{ fontSize:40 }}>📎</div>
                      <div style={{ fontSize:14, fontWeight:700 }}>Нажмите, чтобы прикрепить</div>
                      <div style={{ fontSize:12, color:'rgba(255,255,255,0.35)' }}>JPG, PNG, WEBP · до 10 МБ</div>
                    </motion.button>
                  )}
                  <div>
                    <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.4)', marginBottom:8, letterSpacing:'0.06em', textTransform:'uppercase' }}>Подпись (необязательно)</div>
                    <input value={reviewEditCaption} onChange={e => setReviewEditCaption(e.target.value)}
                      placeholder="Например: Из WhatsApp · Инна, постоянный клиент"
                      style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1.5px solid rgba(255,255,255,0.12)',
                        borderRadius:12, padding:'13px 14px', color:'#fff', fontSize:14, outline:'none',
                        boxSizing:'border-box', fontFamily:'inherit' }} />
                  </div>
                  <motion.button whileTap={{ scale:0.97 }} disabled={reviewEditUploading || (!reviewEditImagePrev && !reviewEditImageUrl)}
                    onClick={async () => {
                      if (reviewEditUploading) return;
                      const hasImg = reviewEditImagePrev || reviewEditImageUrl;
                      if (!hasImg) return;
                      setReviewEditUploading(true);
                      try {
                        let finalUrl = reviewEditImageUrl;
                        if (reviewEditImageFile) {
                          const r = await fetch(`${apiBase}/api/image-upload`, {
                            method:'POST', headers:{'Content-Type': reviewEditImageFile.type}, body: reviewEditImageFile
                          });
                          const d = await r.json(); finalUrl = d.url || d.imageUrl || '';
                        }
                        const today = new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'});
                        const rv: ClassicReview = { id: reviewEditId==='new' ? Date.now().toString() : reviewEditId!, imageUrl: finalUrl, caption: reviewEditCaption.trim() || undefined, date: today };
                        if (reviewEditId==='new') setClassicReviews(prev=>[rv,...prev]);
                        else setClassicReviews(prev=>prev.map(r=>r.id===reviewEditId?rv:r));
                        setReviewEditId(null); setReviewEditImageUrl(''); setReviewEditImageFile(null);
                        setReviewEditImagePrev(''); setReviewEditCaption('');
                      } finally { setReviewEditUploading(false); }
                    }}
                    style={{ width:'100%', padding:'16px', borderRadius:14, border:'none', fontSize:16, fontWeight:800, letterSpacing:'0.04em',
                      background: (reviewEditImagePrev || reviewEditImageUrl) && !reviewEditUploading ? 'linear-gradient(135deg,#3b82f6,#6366f1)' : 'rgba(255,255,255,0.06)',
                      color: (reviewEditImagePrev || reviewEditImageUrl) && !reviewEditUploading ? '#fff' : 'rgba(255,255,255,0.25)',
                      cursor: (reviewEditImagePrev || reviewEditImageUrl) && !reviewEditUploading ? 'pointer' : 'default' }}>
                    {reviewEditUploading ? '⏳ Загружаем...' : '✅ Добавить'}
                  </motion.button>
                  <div style={{ height:40 }} />
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ y:60, opacity:0 }} animate={{ y:0, opacity:1 }}
                style={{ position:'absolute', inset:0, background:'#0f0f1a', display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex', alignItems:'center', padding:'18px 16px 14px',
                  borderBottom:'1px solid rgba(255,255,255,0.08)', gap:10 }}>
                  <div style={{ fontSize:18, fontWeight:900, color:'#fff', flex:1 }}>⭐ Отзывы</div>
                  <motion.button whileTap={{ scale:0.9 }} onClick={() => setShowReviewInfoPro(true)}
                    style={{ width:32, height:32, borderRadius:'50%', background:'rgba(255,255,255,0.08)', border:'1.5px solid rgba(255,255,255,0.2)',
                      color:'rgba(255,255,255,0.7)', fontSize:15, fontWeight:800, cursor:'pointer',
                      display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'"Montserrat",sans-serif', flexShrink:0 }}>?</motion.button>
                  <motion.button whileTap={{ scale:0.93 }} onClick={() => {
                    setReviewEditId('new'); setReviewEditImageUrl(''); setReviewEditImageFile(null);
                    setReviewEditImagePrev(''); setReviewEditCaption('');
                  }} style={{ background:'linear-gradient(135deg,#3b82f6,#6366f1)', border:'none', borderRadius:12,
                    padding:'10px 16px', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', flexShrink:0 }}>
                    + Добавить
                  </motion.button>
                  <motion.button whileTap={{ scale:0.93 }} onClick={() => setShowReviewsModal(false)}
                    style={{ background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)',
                      borderRadius:10, width:38, height:38, display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:18, cursor:'pointer', flexShrink:0 }}>✕</motion.button>
                </div>
                <div style={{ margin:'12px 16px 0', display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ padding:'10px 14px', background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:12 }}>
                    <div style={{ fontSize:12, color:'rgba(245,158,11,0.9)', lineHeight:1.5 }}>
                      💡 Нажмите 🖼️ на виджет-карточке, чтобы задать превью-фото раздела
                    </div>
                  </div>
                  <div style={{ padding:'10px 14px', background:'rgba(59,130,246,0.07)', border:'1px solid rgba(59,130,246,0.2)', borderRadius:12 }}>
                    <div style={{ fontSize:12, color:'rgba(59,130,246,0.9)', lineHeight:1.6 }}>
                      <b>«+ Добавить»</b> — для ваших ручных отзывов (скриншоты, письма от клиентов с других платформ). Вы управляете ими сами.<br/>
                      <span style={{ color:'rgba(255,255,255,0.45)' }}>Реальные гостевые отзывы от других участников SWAIP появятся ниже автоматически.</span>
                    </div>
                  </div>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'14px 16px' }}>
                  {classicReviews.filter(r => r.imageUrl).length > 0 && (
                    <>
                      <div style={{ fontSize:11, fontWeight:700, color:'rgba(59,130,246,0.6)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:10 }}>📎 Прикреплённые материалы</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:16 }}>
                        {classicReviews.filter(r => r.imageUrl).map(rv => (
                          <div key={rv.id} style={{ background:'rgba(59,130,246,0.05)', border:'1px solid rgba(59,130,246,0.18)',
                            borderRadius:16, overflow:'hidden' }}>
                            <img src={rv.imageUrl} alt={rv.caption || 'О нас пишут'}
                              style={{ width:'100%', maxHeight:380, objectFit:'contain', background:'#0a0a15', display:'block' }} />
                            <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:8 }}>
                              <div style={{ flex:1 }}>
                                {rv.caption && <div style={{ fontSize:13, color:'rgba(255,255,255,0.7)', fontWeight:600, marginBottom:2 }}>{rv.caption}</div>}
                                <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>{rv.date}</div>
                              </div>
                              <motion.button whileTap={{ scale:0.93 }} onClick={() => {
                                setReviewEditId(rv.id); setReviewEditImageUrl(rv.imageUrl);
                                setReviewEditImagePrev(''); setReviewEditCaption(rv.caption || '');
                              }} style={{ background:'rgba(59,130,246,0.12)', border:'1px solid rgba(59,130,246,0.25)',
                                borderRadius:8, padding:'6px 10px', color:'#93c5fd', fontSize:12, fontWeight:700, cursor:'pointer' }}>
                                ✏️
                              </motion.button>
                              <motion.button whileTap={{ scale:0.93 }} onClick={() => setClassicReviews(prev=>prev.filter(r=>r.id!==rv.id))}
                                style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
                                  borderRadius:8, padding:'6px 10px', color:'#f87171', fontSize:12, cursor:'pointer' }}>🗑️</motion.button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {!proApiReviewsLoaded && <div style={{ fontSize:13, color:'rgba(255,255,255,0.3)', textAlign:'center', padding:'12px 0' }}>Загружаем гостевые отзывы...</div>}
                  {proApiReviewsLoaded && proApiReviews.length > 0 && (
                    <>
                      <div style={{ fontSize:11, fontWeight:700, color:'rgba(34,197,94,0.7)', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:8 }}>🌟 Реальные отзывы гостей</div>
                      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                        {proApiReviews.map(rv => (
                          <div key={rv.id} style={{ background:'rgba(34,197,94,0.05)', border:'1px solid rgba(34,197,94,0.2)',
                            borderRadius:16, padding:'16px', position:'relative' }}>
                            <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:10 }}>
                              <div style={{ width:40, height:40, borderRadius:'50%', background:'linear-gradient(135deg,#22c55e,#16a34a)',
                                display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                                {rv.authorName.charAt(0).toUpperCase()}
                              </div>
                              <div style={{ flex:1, minWidth:0 }}>
                                <div style={{ fontSize:14, fontWeight:800, color:'#fff', marginBottom:2 }}>{rv.authorName}</div>
                                <div style={{ display:'flex', gap:2 }}>
                                  {[1,2,3,4,5].map(s => (
                                    <span key={s} style={{ fontSize:13, filter:s<=rv.rating?'none':'grayscale(1) opacity(0.25)' }}>⭐</span>
                                  ))}
                                </div>
                              </div>
                              <div style={{ fontSize:10, color:'rgba(255,255,255,0.3)', flexShrink:0 }}>
                                {new Date(rv.createdAt).toLocaleDateString('ru-RU', {day:'numeric',month:'short'})}
                              </div>
                            </div>
                            <div style={{ fontSize:14, color:'rgba(255,255,255,0.8)', lineHeight:1.6, marginBottom:8 }}>«{rv.text}»</div>
                            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                              <span style={{ fontSize:10, color:'rgba(34,197,94,0.6)', fontWeight:600 }}>✅ Верифицированный участник SWAIP</span>
                              <motion.button whileTap={{ scale:0.93 }}
                                onClick={async () => {
                                  if (!confirm('Удалить этот отзыв?')) return;
                                  const r = await fetch(`${apiBase}/api/accounts/${userHash}/reviews/${rv.id}`, {
                                    method:'DELETE', headers:{'x-session-token':getST()||''},
                                  });
                                  if (r.ok) setProApiReviews(prev => prev.filter(r => r.id !== rv.id));
                                }}
                                style={{ marginLeft:'auto', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)',
                                  borderRadius:8, padding:'5px 8px', color:'#f87171', fontSize:12, cursor:'pointer' }}>🗑️</motion.button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                  {classicReviews.filter(r=>r.imageUrl).length === 0 && proApiReviewsLoaded && proApiReviews.length === 0 && (
                    <div style={{ textAlign:'center', paddingTop:40 }}>
                      <div style={{ fontSize:56, marginBottom:16 }}>📎</div>
                      <div style={{ fontSize:18, fontWeight:800, color:'#fff', marginBottom:8 }}>Пока ничего нет</div>
                      <div style={{ fontSize:14, color:'rgba(255,255,255,0.4)', lineHeight:1.6, maxWidth:260, margin:'0 auto' }}>
                        Нажмите «+ Добавить» и прикрепите скриншот из WhatsApp, Telegram или другого источника, где о вас пишут
                      </div>
                    </div>
                  )}
                  <div style={{ height:40 }} />
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ МОДАЛ: INFO — КАК РАБОТАЮТ ОТЗЫВЫ ══ */}
      <AnimatePresence>
        {showReviewInfoPro && (
          <motion.div initial={{ opacity:0, y:30 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:30 }}
            style={{ position:'fixed', inset:0, zIndex:4000, background:'rgba(0,0,0,0.97)', display:'flex', flexDirection:'column', overflowY:'auto' }}>
            <div style={{ display:'flex', alignItems:'center', padding:'18px 16px 14px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
              <motion.button whileTap={{ scale:0.9 }} onClick={() => setShowReviewInfoPro(false)}
                style={{ width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', marginRight:12 }}>←</motion.button>
              <span style={{ fontSize:16, fontWeight:800, color:'#fff', fontFamily:'"Montserrat",sans-serif' }}>О нас пишут — как это работает?</span>
            </div>
            <div style={{ padding:'20px 20px 48px', display:'flex', flexDirection:'column', gap:16 }}>
              <div style={{ background:'rgba(59,130,246,0.08)', border:'1px solid rgba(59,130,246,0.25)', borderRadius:18, padding:18 }}>
                <div style={{ fontSize:28, marginBottom:10 }}>📎</div>
                <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:6, fontFamily:'"Montserrat",sans-serif' }}>Прикрепляйте реальные скриншоты</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.6 }}>
                  Нажмите <b style={{ color:'rgba(255,255,255,0.8)' }}>«+ Добавить»</b> и загрузите скриншот из WhatsApp, Telegram, Instagram, Google или любого другого места, где о вас отзываются. Никаких выдуманных имён и звёзд — только реальный документ.
                </div>
              </div>
              <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:18, padding:18 }}>
                <div style={{ fontSize:28, marginBottom:10 }}>✍️</div>
                <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:6, fontFamily:'"Montserrat",sans-serif' }}>Добавьте подпись (необязательно)</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.6 }}>
                  К каждому скриншоту можно добавить короткую пояснительную подпись — например <i>«Из WhatsApp · постоянный клиент»</i>. Поле необязательное.
                </div>
              </div>
              <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:18, padding:18 }}>
                <div style={{ fontSize:28, marginBottom:10 }}>🌟</div>
                <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:6, fontFamily:'"Montserrat",sans-serif' }}>Реальные отзывы участников SWAIP</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.6 }}>
                  Другие пользователи SWAIP могут оставить вам верифицированный отзыв прямо с вашего профиля. Они отображаются отдельно — защищены от накрутки на уровне базы данных.
                </div>
              </div>
              <div style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:18, padding:18 }}>
                <div style={{ fontSize:28, marginBottom:10 }}>🗑️</div>
                <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:6, fontFamily:'"Montserrat",sans-serif' }}>Управление</div>
                <div style={{ fontSize:13, color:'rgba(255,255,255,0.55)', lineHeight:1.6 }}>
                  Свои скриншоты: добавлять, редактировать, удалять в любое время.<br/>
                  Гостевые отзывы: только удалять при необходимости.
                </div>
              </div>
              <motion.button whileTap={{ scale:0.96 }} onClick={() => setShowReviewInfoPro(false)}
                style={{ marginTop:4, background:'linear-gradient(135deg,#1d4ed8,#3b82f6)', border:'none', borderRadius:16, color:'#fff', fontWeight:800, fontSize:15, padding:'14px', cursor:'pointer', fontFamily:'"Montserrat",sans-serif' }}>
                Понятно ✓
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ МОДАЛ: ПРАЙС-ЛИСТ ══ */}
      <AnimatePresence>
        {showPriceWidgetModal && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:3000, display:'flex', flexDirection:'column', backdropFilter:'blur(8px)' }}>
            <motion.div initial={{ y:60, opacity:0 }} animate={{ y:0, opacity:1 }}
              style={{ position:'absolute', inset:0, background:'#0f0f1a', display:'flex', flexDirection:'column' }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                <motion.button whileTap={{ scale:0.93 }} onClick={() => setShowPriceWidgetModal(false)}
                  style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:22, cursor:'pointer', padding:0 }}>←</motion.button>
                <div style={{ fontSize:22, fontWeight:900, color:'#fff', flex:1 }}>💰 Прайс-лист</div>
                <motion.button whileTap={{ scale:0.95 }} onClick={() => { setShowPriceWidgetModal(false); setShowPriceEditor(true); }}
                  style={{ background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:10, padding:'8px 14px', color:'#fbbf24', fontSize:13, fontWeight:700, cursor:'pointer' }}>
                  + Добавить
                </motion.button>
              </div>
              <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
                {priceItems.length === 0 ? (
                  <div style={{ textAlign:'center', padding:'60px 20px' }}>
                    <div style={{ fontSize:48, marginBottom:16 }}>💰</div>
                    <div style={{ fontSize:16, fontWeight:700, color:'#fff', marginBottom:8 }}>Прайс-лист пока пуст</div>
                    <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>Нажмите «+ Добавить», чтобы создать позицию</div>
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    {priceItems.map(item => (
                      <div key={item.id} style={{ background:'rgba(255,255,255,0.05)', borderRadius:14, padding:'14px 16px', border:'1px solid rgba(255,255,255,0.08)' }}>
                        {item.photo && <img src={item.photo} alt="" style={{ width:'100%', height:140, objectFit:'cover', borderRadius:10, marginBottom:10 }} />}
                        <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:4 }}>{item.name}</div>
                        {item.desc && <div style={{ fontSize:13, color:'rgba(255,255,255,0.55)', marginBottom:8, lineHeight:1.5 }}>{item.desc}</div>}
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          <div style={{ fontSize:18, fontWeight:900, color:'#fbbf24' }}>{item.price}{item.unit ? ` / ${item.unit}` : ''}</div>
                          <motion.button whileTap={{ scale:0.95 }} onClick={() => {
                            setShowPriceWidgetModal(false);
                            setEditingPrice(item); setPriceEditName(item.name); setPriceEditPrice(item.price);
                            setPriceEditDesc(item.desc||''); setPriceEditUnit(item.unit||'');
                            setPriceEditPhoto(item.photo||''); setShowPriceEditor(true);
                          }} style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.2)', borderRadius:8, padding:'6px 12px', color:'#fbbf24', fontSize:11, fontWeight:700, cursor:'pointer' }}>✏️ Изменить</motion.button>
                        </div>
                      </div>
                    ))}
                    <div style={{ height:40 }} />
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── РЕДАКТОР ПРАЙСА ── */}
      <AnimatePresence>
        {showPriceEditor&&(
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setShowPriceEditor(false)}
              style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',backdropFilter:'blur(8px)',zIndex:3100}}/>
            <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',stiffness:300,damping:32}}
              style={{position:'fixed',bottom:0,left:0,right:0,zIndex:3101,background:'#0e0e16',borderRadius:'24px 24px 0 0',border:'1px solid rgba(255,255,255,0.1)',padding:'20px 20px 48px',maxHeight:'90vh',overflowY:'auto'}}>
              <div style={{width:40,height:4,borderRadius:99,background:'rgba(255,255,255,0.15)',margin:'0 auto 20px'}}/>
              <p style={{margin:'0 0 18px',fontWeight:800,fontSize:17,color:'#fff'}}>{editingPrice?'✏️ Редактировать позицию':'➕ Новая позиция'}</p>
              <div style={{marginBottom:16,textAlign:'center'}}>
                <motion.div whileTap={{scale:0.96}} onClick={()=>pricePhotoRef.current?.click()}
                  style={{width:96,height:96,borderRadius:18,margin:'0 auto 8px',background:priceEditPhoto?'transparent':'rgba(59,130,246,0.08)',border:priceEditPhoto?'none':'2px dashed rgba(59,130,246,0.3)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',overflow:'hidden',position:'relative'}}>
                  {priceEditPhoto?<img src={priceEditPhoto} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:32}}>📷</span>}
                </motion.div>
                <div style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>Фото товара/услуги (необязательно)</div>
                {priceEditPhoto&&<motion.button whileTap={{scale:0.9}} onClick={()=>setPriceEditPhoto('')} style={{marginTop:4,background:'none',border:'none',color:'rgba(239,68,68,0.6)',fontSize:11,cursor:'pointer'}}>✕ убрать фото</motion.button>}
                <input ref={pricePhotoRef} type="file" accept="image/*" style={{display:'none'}}
                  onChange={async e=>{const f=e.target.files?.[0];if(!f)return;try{const r=await fetch(`${apiBase}/api/image-upload`,{method:'POST',headers:{'Content-Type':f.type},body:f});if(r.ok){const{url}=await r.json();setPriceEditPhoto(url);}}catch{setPriceEditPhoto(URL.createObjectURL(f));}e.target.value='';}}/>
              </div>
              <label style={{fontSize:11,color:'rgba(255,255,255,0.4)',display:'block',marginBottom:4}}>Название *</label>
              <input value={priceEditName} onChange={e=>setPriceEditName(e.target.value)} placeholder="Стрижка, Консультация, Дизайн..."
                style={{width:'100%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:12,padding:'10px 14px',color:'#fff',fontSize:14,outline:'none',boxSizing:'border-box',marginBottom:12,fontFamily:'inherit'}}/>
              <div style={{display:'flex',gap:10,marginBottom:12}}>
                <div style={{flex:2}}>
                  <label style={{fontSize:11,color:'rgba(255,255,255,0.4)',display:'block',marginBottom:4}}>Цена *</label>
                  <input value={priceEditPrice} onChange={e=>setPriceEditPrice(e.target.value)} placeholder="1 500 ₽ / от 500 ₽ / Бесплатно"
                    style={{width:'100%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:12,padding:'10px 14px',color:'#fff',fontSize:14,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}/>
                </div>
                <div style={{flex:1}}>
                  <label style={{fontSize:11,color:'rgba(255,255,255,0.4)',display:'block',marginBottom:4}}>Единица</label>
                  <input value={priceEditUnit} onChange={e=>setPriceEditUnit(e.target.value)} placeholder="час / шт"
                    style={{width:'100%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:12,padding:'10px 14px',color:'#fff',fontSize:14,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}/>
                </div>
              </div>
              <label style={{fontSize:11,color:'rgba(255,255,255,0.4)',display:'block',marginBottom:4}}>Описание</label>
              <textarea value={priceEditDesc} onChange={e=>setPriceEditDesc(e.target.value)} rows={3} placeholder="Что включено, детали..."
                style={{width:'100%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:12,padding:'10px 14px',color:'#fff',fontSize:13,outline:'none',boxSizing:'border-box',marginBottom:20,resize:'none',fontFamily:'inherit'}}/>
              <div style={{borderTop:'1px solid rgba(255,255,255,0.07)',paddingTop:16,marginBottom:20}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                  <span style={{fontSize:16}}>📅</span>
                  <span style={{fontSize:13,fontWeight:700,color:'rgba(255,255,255,0.7)'}}>Слоты для записи</span>
                </div>
                <div style={{display:'flex',gap:8,marginBottom:10,alignItems:'flex-end'}}>
                  <div style={{flex:1.2}}>
                    <label style={{fontSize:10,color:'rgba(255,255,255,0.35)',display:'block',marginBottom:3}}>Дата</label>
                    <input type="date" value={slotDateInput} onChange={e=>setSlotDateInput(e.target.value)} min={new Date().toISOString().split('T')[0]}
                      style={{width:'100%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:10,padding:'9px 10px',color:'#fff',fontSize:13,outline:'none',boxSizing:'border-box',colorScheme:'dark'} as React.CSSProperties}/>
                  </div>
                  <div style={{flex:0.8}}>
                    <label style={{fontSize:10,color:'rgba(255,255,255,0.35)',display:'block',marginBottom:3}}>Время</label>
                    <input type="time" value={slotTimeInput} onChange={e=>setSlotTimeInput(e.target.value)}
                      style={{width:'100%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:10,padding:'9px 10px',color:'#fff',fontSize:13,outline:'none',boxSizing:'border-box',colorScheme:'dark'} as React.CSSProperties}/>
                  </div>
                  <motion.button whileTap={{scale:0.9}} onClick={()=>{if(!slotDateInput||!slotTimeInput)return;const slot=`${slotDateInput} ${slotTimeInput}`;if(!priceEditSlots.includes(slot))setPriceEditSlots([...priceEditSlots,slot].sort());setSlotTimeInput('');}}
                    style={{background:'rgba(59,130,246,0.2)',border:'1px solid rgba(59,130,246,0.4)',borderRadius:10,padding:'9px 12px',cursor:'pointer',color:'#93c5fd',fontSize:12,fontWeight:700,flexShrink:0}}>+ Слот</motion.button>
                </div>
                {priceEditSlots.length===0?(
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.2)',textAlign:'center',padding:'8px 0'}}>Слоты не добавлены — клиенты не смогут записаться</div>
                ):(
                  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                    {priceEditSlots.map(slot=>{
                      const d=new Date(slot.replace(' ','T'));
                      const dayStr=d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'});
                      const time=slot.split(' ')[1];
                      const isBooked=bookings.some(b=>b.slot===slot&&b.itemId===(editingPrice?.id||'__new'));
                      return(
                        <div key={slot} style={{display:'flex',alignItems:'center',gap:4,background:isBooked?'rgba(239,68,68,0.1)':'rgba(59,130,246,0.1)',border:`1px solid ${isBooked?'rgba(239,68,68,0.25)':'rgba(59,130,246,0.25)'}`,borderRadius:20,padding:'4px 10px'}}>
                          <span style={{fontSize:11,color:isBooked?'#f87171':'#93c5fd',fontWeight:600}}>{isBooked?'🔴':'🟢'} {dayStr} {time}</span>
                          {!isBooked&&<motion.button whileTap={{scale:0.85}} onClick={()=>setPriceEditSlots(priceEditSlots.filter(s=>s!==slot))}
                            style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.3)',fontSize:11,padding:'0 0 0 2px',lineHeight:1}}>✕</motion.button>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <motion.button whileTap={{scale:0.95}} onClick={()=>{
                if(!priceEditName.trim()||!priceEditPrice.trim())return;
                if(editingPrice){
                  setPriceItems(prev=>prev.map(p=>p.id===editingPrice.id?{...p,name:priceEditName.trim(),price:priceEditPrice.trim(),desc:priceEditDesc.trim(),unit:priceEditUnit.trim(),photo:priceEditPhoto,slots:priceEditSlots}:p));
                }else{
                  setPriceItems(prev=>[...prev,{id:Date.now().toString(),name:priceEditName.trim(),price:priceEditPrice.trim(),desc:priceEditDesc.trim(),unit:priceEditUnit.trim(),photo:priceEditPhoto,slots:priceEditSlots}]);
                }
                setShowPriceEditor(false);
              }} style={{width:'100%',background:'linear-gradient(135deg,#1d4ed8,#3b82f6)',border:'none',borderRadius:14,color:'#fff',fontWeight:800,fontSize:15,padding:'13px',cursor:'pointer',marginBottom:10,fontFamily:'inherit'}}>
                {editingPrice?'Сохранить изменения ✓':'Добавить в прайс ✓'}
              </motion.button>
              {editingPrice&&(
                <motion.button whileTap={{scale:0.95}} onClick={()=>{setPriceItems(prev=>prev.filter(p=>p.id!==editingPrice.id));setShowPriceEditor(false);}}
                  style={{width:'100%',background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:14,color:'#f87171',fontWeight:700,fontSize:14,padding:'12px',cursor:'pointer',fontFamily:'inherit'}}>🗑 Удалить позицию</motion.button>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── ЗАПИСАТЬСЯ — главный экран выбора ── */}
      <AnimatePresence>
        {openSheet==='booking'&&!showBookingChat&&!showFreeBookingChat&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:3000,backdropFilter:'blur(8px)'}}>
            <motion.div initial={{y:60,opacity:0}} animate={{y:0,opacity:1}}
              style={{position:'absolute',inset:0,background:'#0f0f1a',display:'flex',flexDirection:'column'}}>
              {/* Шапка */}
              <div style={{display:'flex',alignItems:'center',padding:'18px 16px 14px',borderBottom:'1px solid rgba(255,255,255,0.08)',gap:10,flexShrink:0}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:18,fontWeight:900,color:'#fff'}}>📅 Записаться</div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:2}}>Бот {aiName} поможет выбрать время</div>
                </div>
                <motion.button whileTap={{scale:0.93}} onClick={()=>setShowAiNameEdit(true)}
                  style={{background:'rgba(99,102,241,0.12)',border:'1px solid rgba(99,102,241,0.25)',borderRadius:8,padding:'6px 10px',color:'#a5b4fc',fontSize:11,fontWeight:700,cursor:'pointer',flexShrink:0}}>✏️ {aiName}</motion.button>
                <motion.button whileTap={{scale:0.93}} onClick={()=>setOpenSheet(null)}
                  style={{background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:10,width:38,height:38,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,cursor:'pointer',flexShrink:0}}>✕</motion.button>
              </div>

              <div style={{flex:1,overflowY:'auto',padding:'14px 16px'}}>
                {priceItems.length===0&&freeSlots.length===0?(
                  <div style={{textAlign:'center',paddingTop:60}}>
                    <div style={{fontSize:60,marginBottom:16}}>🤖</div>
                    <div style={{fontSize:16,fontWeight:800,color:'#fff',marginBottom:8}}>Слоты не добавлены</div>
                    <div style={{fontSize:13,color:'rgba(255,255,255,0.4)',lineHeight:1.6,maxWidth:260,margin:'0 auto'}}>Добавьте слоты в прайсе или свободные слоты — и {aiName} начнёт принимать заявки</div>
                    <motion.button whileTap={{scale:0.95}} onClick={()=>setOpenSheet('prices')}
                      style={{marginTop:20,padding:'12px 24px',background:'linear-gradient(135deg,#1d4ed8,#3b82f6)',border:'none',borderRadius:12,color:'#fff',fontWeight:800,fontSize:14,cursor:'pointer'}}>Перейти в Прайс</motion.button>
                  </div>
                ):(
                  <>
                    {/* Карточки услуг со слотами */}
                    {priceItems.filter(p=>p.slots.some(s=>!bookings.some(b=>b.slot===s&&b.itemId===p.id))).map(item=>(
                      <motion.div key={item.id} whileTap={{scale:0.98}}
                        style={{background:'linear-gradient(135deg,rgba(29,78,216,0.12),rgba(124,58,237,0.08))',border:'1px solid rgba(99,102,241,0.25)',borderRadius:18,padding:'16px',marginBottom:12,cursor:'pointer'}}
                        onClick={()=>{
                          const avail=item.slots.filter(s=>!bookings.some(b=>b.slot===s&&b.itemId===item.id));
                          if(avail.length===0)return;
                          const tpl=BOT_SCRIPTS[botTplIdxRef.current%BOT_SCRIPTS.length];
                          const tg=getTimeOfDay();
                          const greeting=tpl.gr(tg,aiName)+`\n\nВот свободные окошки для «${item.name}»:\n${avail.map(s=>'📅 '+formatSlotRu(s)).join('\n')}\n\nВыберите удобное время — и всё оформлю!`;
                          setBookingItem(item);
                          setChatMessages([{role:'bot',text:greeting}]);
                          setBookingStep('chat');
                          setSelectedSlot('');
                          setBClientName('');
                          setBClientPhone('');
                          setShowBookingChat(true);
                          speakGreeting(`${tg}! Я ${aiName}. Выберите удобное время для записи на ${item.name}!`);
                        }}>
                        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                          {item.photo&&<img src={item.photo} alt="" style={{width:44,height:44,borderRadius:10,objectFit:'cover',flexShrink:0}}/>}
                          <div style={{flex:1}}>
                            <div style={{fontSize:15,fontWeight:800,color:'#fff'}}>{item.name}</div>
                            <div style={{fontSize:14,fontWeight:900,color:'#93c5fd'}}>{item.price}</div>
                          </div>
                          <div style={{background:'linear-gradient(135deg,#1d4ed8,#7c3aed)',borderRadius:10,padding:'8px 14px',fontSize:12,fontWeight:800,color:'#fff'}}>Записаться →</div>
                        </div>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                          {item.slots.filter(s=>!bookings.some(b=>b.slot===s&&b.itemId===item.id)).slice(0,3).map(s=>(
                            <div key={s} style={{background:'rgba(34,197,94,0.1)',border:'1px solid rgba(34,197,94,0.25)',borderRadius:8,padding:'4px 10px',fontSize:11,color:'#4ade80',fontWeight:600}}>
                              📅 {formatSlotRu(s).split(',')[1]?.trim()||formatSlotRu(s)}
                            </div>
                          ))}
                          {item.slots.filter(s=>!bookings.some(b=>b.slot===s&&b.itemId===item.id)).length>3&&(
                            <div style={{background:'rgba(255,255,255,0.05)',borderRadius:8,padding:'4px 10px',fontSize:11,color:'rgba(255,255,255,0.4)'}}>
                              +{item.slots.filter(s=>!bookings.some(b=>b.slot===s&&b.itemId===item.id)).length-3} ещё
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}

                    {/* Свободные слоты без услуги */}
                    {freeSlots.filter(s=>!freeBookings.some(b=>b.slot===s)).length>0&&(
                      <motion.div whileTap={{scale:0.98}}
                        style={{background:'linear-gradient(135deg,rgba(16,185,129,0.1),rgba(5,150,105,0.06))',border:'1px solid rgba(16,185,129,0.25)',borderRadius:18,padding:'16px',marginBottom:12,cursor:'pointer'}}
                        onClick={()=>{
                          const avail=freeSlots.filter(s=>!freeBookings.some(b=>b.slot===s));
                          const idx=Math.floor(Math.random()*GREEN_SLOT_GREETINGS.length);
                          const tg=getTimeOfDay();
                          const greeting=GREEN_SLOT_GREETINGS[idx](tg,aiName)+`\n\nДоступные слоты:\n${avail.map(s=>'📅 '+formatSlotRu(s)).join('\n')}`;
                          setFreeChatMessages([{role:'bot',text:greeting}]);
                          setFreeBookingStep('chat');
                          setFreeSelectedSlot('');
                          setFbClientName('');
                          setFbClientPhone('');
                          setShowFreeBookingChat(true);
                          speakGreeting(`${tg}! Я ${aiName}. Рада помочь вам с записью! Как вас зовут?`);
                        }}>
                        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                          <div style={{width:44,height:44,borderRadius:10,background:'rgba(16,185,129,0.15)',border:'1px solid rgba(16,185,129,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>✅</div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:15,fontWeight:800,color:'#fff'}}>Свободная запись</div>
                            <div style={{fontSize:12,color:'rgba(16,185,129,0.8)'}}>{freeSlots.filter(s=>!freeBookings.some(b=>b.slot===s)).length} слота доступно</div>
                          </div>
                          <div style={{background:'linear-gradient(135deg,rgba(16,185,129,0.3),rgba(5,150,105,0.2))',border:'1px solid rgba(16,185,129,0.4)',borderRadius:10,padding:'8px 14px',fontSize:12,fontWeight:800,color:'#6ee7b7'}}>Записаться →</div>
                        </div>
                        <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                          {freeSlots.filter(s=>!freeBookings.some(b=>b.slot===s)).slice(0,3).map(s=>(
                            <div key={s} style={{background:'rgba(16,185,129,0.08)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:8,padding:'4px 10px',fontSize:11,color:'#6ee7b7',fontWeight:600}}>
                              📅 {formatSlotRu(s).split(',')[1]?.trim()||formatSlotRu(s)}
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Редактор свободных слотов */}
                    <div style={{background:'rgba(255,255,255,0.03)',border:'1px dashed rgba(255,255,255,0.1)',borderRadius:14,padding:'14px 16px',marginBottom:12}}>
                      <div style={{fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.4)',marginBottom:10}}>⚙️ Свободные слоты (без услуги)</div>
                      <div style={{display:'flex',gap:8,marginBottom:10,flexWrap:'wrap'}}>
                        <input type="date" value={fSlotDate} onChange={e=>setFSlotDate(e.target.value)} min={new Date().toISOString().split('T')[0]}
                          style={{flex:1,minWidth:130,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:10,padding:'8px 10px',color:'#fff',fontSize:13,outline:'none',colorScheme:'dark'} as React.CSSProperties}/>
                        <input type="time" value={fSlotTime} onChange={e=>setFSlotTime(e.target.value)}
                          style={{flex:1,minWidth:100,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:10,padding:'8px 10px',color:'#fff',fontSize:13,outline:'none',colorScheme:'dark'} as React.CSSProperties}/>
                        <motion.button whileTap={{scale:0.9}} onClick={()=>{if(!fSlotDate||!fSlotTime)return;const slot=`${fSlotDate} ${fSlotTime}`;if(!freeSlots.includes(slot))setFreeSlots([...freeSlots,slot].sort());setFSlotDate('');setFSlotTime('');}}
                          style={{background:'rgba(16,185,129,0.2)',border:'1px solid rgba(16,185,129,0.35)',borderRadius:10,padding:'8px 12px',cursor:'pointer',color:'#6ee7b7',fontSize:12,fontWeight:700,flexShrink:0}}>+ Слот</motion.button>
                      </div>
                      {freeSlots.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                        {freeSlots.sort().map(s=>{
                          const taken=freeBookings.some(b=>b.slot===s);
                          return(
                            <div key={s} style={{display:'flex',alignItems:'center',gap:4,background:taken?'rgba(239,68,68,0.08)':'rgba(16,185,129,0.08)',border:`1px solid ${taken?'rgba(239,68,68,0.2)':'rgba(16,185,129,0.2)'}`,borderRadius:20,padding:'4px 10px'}}>
                              <span style={{fontSize:11,color:taken?'#f87171':'#6ee7b7',fontWeight:600}}>{taken?'🔴':'🟢'} {formatSlotRu(s).split(',')[1]?.trim()||s}</span>
                              {!taken&&<motion.button whileTap={{scale:0.85}} onClick={()=>setFreeSlots(prev=>prev.filter(x=>x!==s))} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,0.3)',fontSize:10,padding:0,lineHeight:1,marginLeft:2}}>✕</motion.button>}
                            </div>
                          );
                        })}
                      </div>}
                    </div>

                    {/* Список всех записей */}
                    {(bookings.length>0||freeBookings.length>0)&&(
                      <div style={{marginTop:8}}>
                        <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:10}}>Записавшиеся</div>
                        {[...bookings,...freeBookings].sort((a,b)=>a.slot.localeCompare(b.slot)).map(b=>(
                          <div key={b.id} style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:12,padding:'12px 14px',marginBottom:8,display:'flex',alignItems:'center',gap:8}}>
                            <div style={{width:36,height:36,borderRadius:8,background:'linear-gradient(135deg,#1d4ed8,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,color:'#fff',flexShrink:0}}>{b.clientName?b.clientName[0].toUpperCase():'👤'}</div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:13,fontWeight:700,color:'#fff'}}>{b.clientName}</div>
                              <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.itemName} · {formatSlotRu(b.slot)}</div>
                              {b.clientPhone&&<div style={{fontSize:11,color:'rgba(34,197,94,0.8)',fontWeight:600}}>{b.clientPhone}</div>}
                            </div>
                            <motion.button whileTap={{scale:0.9}} onClick={()=>{setBookings(prev=>prev.filter(x=>x.id!==b.id));setFreeBookings(prev=>prev.filter(x=>x.id!==b.id));}}
                              style={{background:'rgba(239,68,68,0.1)',border:'none',borderRadius:8,padding:'5px 8px',color:'#f87171',fontSize:12,cursor:'pointer',flexShrink:0}}>✕</motion.button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <div style={{height:40}}/>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── ЧАТ АЛИНЫ — бронирование по прайсу ── */}
      <AnimatePresence>
        {showBookingChat&&bookingItem&&(()=>{
          const fmtS=(s:string)=>formatSlotRu(s);
          const bookedSlots=bookings.filter(b=>b.itemId===bookingItem.id).map(b=>b.slot);
          const avail=(bookingItem.slots||[]).filter(s=>!bookedSlots.includes(s));
          const handleMsg=(text:string)=>{
            const msgs=[...chatMessages,{role:'user' as const,text}];
            setChatMessages(msgs);
            setChatInput('');
            setTimeout(()=>{
              const lower=text.toLowerCase();
              let reply='';let speech='';
              if(bookingStep==='chat'){
                const matched=avail.find(s=>{const t=s.split(' ')[1];return text.includes(t)||fmtS(s).toLowerCase().split(' ').some(w=>lower.includes(w)&&w.length>2);})||
                  avail.find(s=>lower.includes(s.split(' ')[1].split(':')[0]));
                const takenMatch=bookedSlots.find(s=>text.includes(s.split(' ')[1]));
                if(takenMatch){
                  reply=avail.length>0?`Ой, ${takenMatch.split(' ')[1]} уже занято 😄\n\nЕсть другие:\n${avail.map(s=>'📅 '+fmtS(s)).join('\n')}\n\nВыберите!`:`К сожалению, ${takenMatch.split(' ')[1]} занято, и свободных слотов больше нет 😔`;
                  speech=avail.length>0?'Это время уже занято. Но есть другие слоты!':'К сожалению, все слоты заняты.';
                }else if(matched){
                  setSelectedSlot(matched);setBookingStep('confirm');
                  reply=`Отлично, ${fmtS(matched)} — свободно! 🎉\n\nНапишите ваше имя и телефон 👇`;
                  speech=`Отлично! ${fmtS(matched)} свободно. Напишите ваше имя.`;
                }else if(avail.length===0){
                  reply=`Все слоты заняты 😔\n\nСвяжитесь с владельцем напрямую — он что-нибудь придумает!`;
                  speech='К сожалению, все слоты заняты.';
                }else{
                  reply=`Не нашла такое время 🙈\n\nВот что есть:\n${avail.map(s=>'📅 '+fmtS(s)).join('\n')}\n\nВыберите любое! 😊`;
                  speech='Не нашла такое время. Выберите один из доступных слотов.';
                }
              }else if(bookingStep==='confirm'){
                reply='Заполните форму ниже — и всё зафиксирую! 😊';
                speech='Пожалуйста, заполните имя и телефон.';
              }
              if(reply){setChatMessages(m=>[...m,{role:'bot',text:reply}]);speakGreeting(speech||reply.replace(/[📅😊🎉😔🙈👇🌟]/g,''));}
            },600);
          };
          return(
            <>
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                onClick={()=>{setShowBookingChat(false);setBookingStep('chat');}}
                style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',backdropFilter:'blur(10px)',zIndex:4000}}/>
              <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',stiffness:290,damping:30}}
                style={{position:'fixed',bottom:0,left:0,right:0,zIndex:4001,background:'linear-gradient(180deg,#0a0d14,#070a10)',borderRadius:'28px 28px 0 0',border:'1px solid rgba(99,102,241,0.25)',height:'88vh',display:'flex',flexDirection:'column'}}>
                {/* Шапка */}
                <div style={{padding:'18px 18px 14px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
                  <div style={{width:42,height:42,borderRadius:'50%',background:'linear-gradient(135deg,#1d4ed8,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,fontWeight:800,color:'#fff',flexShrink:0}}>{aiName[0]?.toUpperCase()||'А'}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:800,color:'#fff',fontFamily:'"Montserrat",sans-serif'}}>{aiName}</div>
                    <div style={{fontSize:10,color:'rgba(99,102,241,0.8)',fontFamily:'"Montserrat",sans-serif'}}>{bookingStep==='done'?'✅ Запись подтверждена':`📋 ${bookingItem.name} · онлайн`}</div>
                  </div>
                  <motion.button whileTap={{scale:0.9}} onClick={()=>{setShowBookingChat(false);setBookingStep('chat');}}
                    style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'50%',width:32,height:32,cursor:'pointer',color:'rgba(255,255,255,0.5)',fontSize:14,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>✕</motion.button>
                </div>
                {/* Сообщения */}
                <div style={{flex:1,overflowY:'auto',padding:'16px',display:'flex',flexDirection:'column',gap:10}}>
                  {chatMessages.map((msg,i)=>(
                    <div key={i} style={{display:'flex',justifyContent:msg.role==='user'?'flex-end':'flex-start'}}>
                      {msg.role==='bot'&&<div style={{width:28,height:28,borderRadius:'50%',flexShrink:0,marginRight:8,marginTop:2,background:'linear-gradient(135deg,#1d4ed8,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:800,color:'#fff'}}>{aiName[0]?.toUpperCase()||'А'}</div>}
                      <motion.div initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}}
                        style={{maxWidth:'75%',padding:'10px 14px',background:msg.role==='user'?'linear-gradient(135deg,#1d4ed8,#2563eb)':'rgba(255,255,255,0.07)',borderRadius:msg.role==='user'?'18px 18px 4px 18px':'4px 18px 18px 18px',border:msg.role==='bot'?'1px solid rgba(255,255,255,0.08)':'none'}}>
                        <p style={{margin:0,fontSize:12,color:'#fff',lineHeight:1.55,fontFamily:'"Montserrat",sans-serif',whiteSpace:'pre-line'}}>{msg.text}</p>
                      </motion.div>
                    </div>
                  ))}
                  {/* Быстрые кнопки слотов */}
                  {bookingStep==='chat'&&avail.length>0&&(
                    <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:4}}>
                      {avail.map(s=>(
                        <motion.button key={s} whileTap={{scale:0.95}} onClick={()=>handleMsg(s.split(' ')[1])}
                          style={{background:'rgba(99,102,241,0.12)',border:'1px solid rgba(99,102,241,0.3)',borderRadius:20,padding:'7px 14px',cursor:'pointer',color:'#a5b4fc',fontSize:12,fontWeight:600,fontFamily:'"Montserrat",sans-serif'}}>
                          📅 {fmtS(s)}
                        </motion.button>
                      ))}
                    </div>
                  )}
                  {/* Форма подтверждения */}
                  {bookingStep==='confirm'&&(
                    <motion.div initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
                      style={{background:'rgba(99,102,241,0.07)',border:'1px solid rgba(99,102,241,0.2)',borderRadius:18,padding:'16px'}}>
                      <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',fontFamily:'"Montserrat",sans-serif',marginBottom:10}}>
                        Слот: <strong style={{color:'#a5b4fc'}}>{fmtS(selectedSlot)}</strong>
                      </div>
                      <input value={bClientName} onChange={e=>setBClientName(e.target.value)} placeholder="Ваше имя"
                        style={{width:'100%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:12,padding:'10px 14px',color:'#fff',fontSize:14,outline:'none',fontFamily:'"Montserrat",sans-serif',boxSizing:'border-box',marginBottom:8}}/>
                      <input value={bClientPhone} onChange={e=>setBClientPhone(e.target.value)} placeholder="Телефон +7..." type="tel"
                        style={{width:'100%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:12,padding:'10px 14px',color:'#fff',fontSize:14,outline:'none',fontFamily:'"Montserrat",sans-serif',boxSizing:'border-box',marginBottom:12}}/>
                      <motion.button whileTap={{scale:0.95}} onClick={()=>{
                        if(!bClientName.trim())return;
                        const rec:BookingRecord={id:Date.now().toString(),itemId:bookingItem.id,itemName:bookingItem.name,slot:selectedSlot,clientName:bClientName.trim(),clientPhone:bClientPhone.trim(),createdAt:new Date().toISOString()};
                        setBookings(prev=>[...prev,rec]);
                        setBookingStep('done');
                        const tg=getTimeOfDay();
                        const done=`${tg}! 🎉 Всё готово!\n\n👤 ${bClientName.trim()}\n📅 ${fmtS(selectedSlot)}\n📋 ${bookingItem.name}\n\nЖдём вас! 🌟\n\n— ${aiName}`;
                        setChatMessages(m=>[...m,{role:'bot',text:done}]);
                        speakGreeting(`Замечательно, ${bClientName.trim()}! Ваша запись подтверждена. Ждём вас! ${tg}!`);
                      }} style={{width:'100%',background:'linear-gradient(135deg,#1d4ed8,#7c3aed)',border:'none',borderRadius:12,color:'#fff',fontWeight:800,fontSize:14,padding:'12px',cursor:'pointer',fontFamily:'"Montserrat",sans-serif'}}>
                        Подтвердить запись ✓
                      </motion.button>
                    </motion.div>
                  )}
                  {/* Готово */}
                  {bookingStep==='done'&&(
                    <motion.div initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}} style={{textAlign:'center',padding:'24px 0'}}>
                      <div style={{fontSize:56,marginBottom:12}}>🎉</div>
                      <div style={{fontSize:16,fontWeight:800,color:'#fff',fontFamily:'"Montserrat",sans-serif',marginBottom:6}}>Вы записаны!</div>
                      <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',fontFamily:'"Montserrat",sans-serif'}}>{fmtS(selectedSlot)}</div>
                      <motion.button whileTap={{scale:0.95}} onClick={()=>{setShowBookingChat(false);setBookingStep('chat');}}
                        style={{marginTop:20,background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:20,padding:'10px 24px',cursor:'pointer',color:'rgba(255,255,255,0.7)',fontSize:13,fontFamily:'"Montserrat",sans-serif'}}>Закрыть</motion.button>
                    </motion.div>
                  )}
                </div>
                {/* Поле ввода */}
                {bookingStep==='chat'&&(
                  <div style={{padding:'12px 14px 24px',borderTop:'1px solid rgba(255,255,255,0.07)',display:'flex',gap:8,flexShrink:0}}>
                    <input value={chatInput} onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&chatInput.trim())handleMsg(chatInput.trim());}}
                      placeholder="Напиши желаемое время..."
                      style={{flex:1,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:22,padding:'11px 16px',color:'#fff',fontSize:13,outline:'none',fontFamily:'"Montserrat",sans-serif'}}/>
                    <motion.button whileTap={{scale:0.88}} onClick={()=>{if(chatInput.trim())handleMsg(chatInput.trim());}}
                      style={{background:'linear-gradient(135deg,#1d4ed8,#7c3aed)',border:'none',borderRadius:'50%',width:44,height:44,cursor:'pointer',fontSize:18,flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center'}}>➤</motion.button>
                  </div>
                )}
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      {/* ── ЧАТ АЛИНЫ — свободная запись ── */}
      <AnimatePresence>
        {showFreeBookingChat&&(()=>{
          const availFree=freeSlots.filter(s=>!freeBookings.some(b=>b.slot===s));
          const handleFreeSend=()=>{
            const input=freeChatInput.trim();if(!input)return;
            setFreeChatInput('');
            const msgs=[...freeChatMessages,{role:'user' as const,text:input}];
            setFreeChatMessages(msgs);
            setTimeout(()=>{
              let reply='';let speech='';
              const low=input.toLowerCase();
              if(freeBookingStep==='chat'&&!freeSelectedSlot){
                const found=availFree.find(s=>{const d=new Date(s.replace(' ','T'));const dd=d.getDate().toString();const hh=s.split(' ')[1];return low.includes(dd)||low.includes(hh);});
                if(found){
                  setFreeSelectedSlot(found);
                  reply=`Отлично! 📅 Вы выбрали: **${formatSlotRu(found)}**\n\nКак вас зовут?`;
                  speech=`Отлично! Вы выбрали ${formatSlotRu(found)}. Как вас зовут?`;
                }else{
                  reply=`Доступные слоты:\n${availFree.map(s=>'📅 '+formatSlotRu(s)).join('\n')||'Нет свободных слотов.'}\n\nВыберите удобное время!`;
                  speech=availFree.length>0?'Выберите удобное время.':'Свободных слотов пока нет.';
                }
              }else if(freeSelectedSlot&&!fbClientName){
                setFbClientName(input);
                reply=`Приятно познакомиться, ${input}! 📱 Укажите ваш номер телефона:`;
                speech=`Приятно, ${input}! Пожалуйста, назовите ваш телефон.`;
              }else if(freeSelectedSlot&&fbClientName&&!fbClientPhone){
                setFbClientPhone(input);
                reply=`Всё готово! Проверьте:\n\n👤 ${fbClientName}\n📅 ${formatSlotRu(freeSelectedSlot)}\n\nПодтверждаете запись?`;
                speech=`Замечательно! ${fbClientName}, запись ${formatSlotRu(freeSelectedSlot)}. Всё верно?`;
                setFreeBookingStep('confirm');
              }else{
                reply='Нажмите кнопку ниже для подтверждения.';speech='Нажмите кнопку для подтверждения.';
              }
              if(reply){setFreeChatMessages(m=>[...m,{role:'bot',text:reply}]);speakGreeting(speech||reply.replace(/[📅😊🎉📱👇🌟]/g,'').replace(/\*\*/g,''));}
            },600);
          };
          return(
            <>
              <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
                onClick={()=>{setShowFreeBookingChat(false);setFreeBookingStep('chat');}}
                style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',backdropFilter:'blur(12px)',zIndex:4100}}/>
              <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',stiffness:280,damping:30}}
                style={{position:'fixed',bottom:0,left:0,right:0,zIndex:4101,background:'linear-gradient(180deg,#06090a,#040708)',borderRadius:'28px 28px 0 0',border:'1px solid rgba(16,185,129,0.25)',maxHeight:'92vh',display:'flex',flexDirection:'column'}}>
                {/* Шапка */}
                <div style={{padding:'18px 18px 14px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:40,height:40,borderRadius:20,background:'linear-gradient(135deg,rgba(16,185,129,0.3),rgba(5,150,105,0.2))',border:'1px solid rgba(16,185,129,0.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,fontWeight:800,color:'#6ee7b7'}}>{aiName[0]?.toUpperCase()||'А'}</div>
                    <div>
                      <div style={{fontSize:13,fontWeight:800,color:'#fff',fontFamily:'"Montserrat",sans-serif'}}>{aiName}</div>
                      <div style={{fontSize:10,color:'#6ee7b7',fontFamily:'"Montserrat",sans-serif'}}>онлайн · помогаю записаться</div>
                    </div>
                  </div>
                  <motion.button whileTap={{scale:0.9}} onClick={()=>{setShowFreeBookingChat(false);setFreeBookingStep('chat');}}
                    style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:20,padding:'6px 14px',cursor:'pointer',color:'rgba(255,255,255,0.4)',fontSize:12,fontFamily:'"Montserrat",sans-serif'}}>✕</motion.button>
                </div>
                {/* Сообщения */}
                <div style={{flex:1,overflowY:'auto',padding:'14px 16px',display:'flex',flexDirection:'column',gap:10}}>
                  {freeChatMessages.map((msg,i)=>(
                    <div key={i} style={{display:'flex',justifyContent:msg.role==='bot'?'flex-start':'flex-end'}}>
                      <div style={{maxWidth:'80%',padding:'10px 14px',borderRadius:msg.role==='bot'?'4px 18px 18px 18px':'18px 4px 18px 18px',background:msg.role==='bot'?'rgba(16,185,129,0.12)':'rgba(99,102,241,0.18)',border:`1px solid ${msg.role==='bot'?'rgba(16,185,129,0.25)':'rgba(99,102,241,0.3)'}`,fontSize:13,color:'rgba(255,255,255,0.9)',lineHeight:1.5,fontFamily:'"Montserrat",sans-serif',whiteSpace:'pre-wrap'}}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {/* Слоты-кнопки */}
                  {freeBookingStep==='chat'&&!freeSelectedSlot&&availFree.length>0&&(
                    <div style={{display:'flex',flexDirection:'column',gap:6,marginTop:4}}>
                      {availFree.map(s=>(
                        <motion.button key={s} whileTap={{scale:0.96}}
                          onClick={()=>{
                            setFreeSelectedSlot(s);
                            const txt=formatSlotRu(s);
                            setFreeChatMessages(m=>[...m,{role:'user',text:txt},{role:'bot',text:`Отлично! 📅 **${txt}**\n\nКак вас зовут?`}]);
                            speakGreeting(`Отлично! Вы выбрали ${txt}. Как вас зовут?`);
                          }}
                          style={{background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:14,padding:'9px 16px',cursor:'pointer',textAlign:'left',color:'#6ee7b7',fontSize:12,fontWeight:600,fontFamily:'"Montserrat",sans-serif'}}>
                          📅 {formatSlotRu(s)}
                        </motion.button>
                      ))}
                    </div>
                  )}
                  {/* Подтверждение */}
                  {freeBookingStep==='confirm'&&(
                    <div style={{display:'flex',gap:8,marginTop:4,flexWrap:'wrap'}}>
                      <motion.button whileTap={{scale:0.95}}
                        onClick={()=>{
                          const rec:BookingRecord={id:Date.now().toString(),itemId:'free',itemName:'Запись',slot:freeSelectedSlot,clientName:fbClientName,clientPhone:fbClientPhone,createdAt:new Date().toISOString()};
                          setFreeBookings(prev=>[...prev,rec]);
                          setFreeBookingStep('done');
                          const tg=getTimeOfDay();
                          const done=`Запись подтверждена! 🎉\n\n👤 ${fbClientName}\n📅 ${formatSlotRu(freeSelectedSlot)}\n\nЖдём вас! ${tg}! 👋\n\n— ${aiName}`;
                          setFreeChatMessages(m=>[...m,{role:'bot',text:done}]);
                          speakGreeting(`Замечательно, ${fbClientName}! Ваша запись подтверждена. Ждём вас! ${tg}!`);
                        }}
                        style={{flex:1,background:'rgba(16,185,129,0.2)',border:'1px solid rgba(16,185,129,0.4)',borderRadius:16,padding:'11px',cursor:'pointer',color:'#6ee7b7',fontSize:13,fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>✅ Подтвердить</motion.button>
                      <motion.button whileTap={{scale:0.95}}
                        onClick={()=>{setFreeBookingStep('chat');setFreeSelectedSlot('');setFbClientName('');setFbClientPhone('');setFreeChatMessages(m=>[...m,{role:'bot',text:'Хорошо, давайте выберем другое время.'}]);speakGreeting('Хорошо, давайте выберем другое время.');}}
                        style={{flex:1,background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:16,padding:'11px',cursor:'pointer',color:'rgba(239,68,68,0.8)',fontSize:13,fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>✕ Отмена</motion.button>
                    </div>
                  )}
                  {/* Готово */}
                  {freeBookingStep==='done'&&(
                    <motion.button whileTap={{scale:0.95}} initial={{opacity:0,scale:0.9}} animate={{opacity:1,scale:1}}
                      onClick={()=>{setShowFreeBookingChat(false);setFreeBookingStep('chat');}}
                      style={{background:'linear-gradient(135deg,rgba(16,185,129,0.25),rgba(5,150,105,0.15))',border:'1px solid rgba(16,185,129,0.4)',borderRadius:18,padding:'12px 24px',cursor:'pointer',color:'#6ee7b7',fontSize:13,fontWeight:700,fontFamily:'"Montserrat",sans-serif',marginTop:6}}>🎉 Закрыть</motion.button>
                  )}
                </div>
                {/* Ввод */}
                {freeBookingStep==='chat'&&(
                  <div style={{padding:'12px 16px',borderTop:'1px solid rgba(255,255,255,0.07)',display:'flex',gap:8,alignItems:'center',flexShrink:0}}>
                    <input value={freeChatInput} onChange={e=>setFreeChatInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleFreeSend()}
                      placeholder="Написать..."
                      style={{flex:1,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:20,padding:'11px 16px',color:'#fff',fontSize:13,outline:'none',fontFamily:'"Montserrat",sans-serif'}}/>
                    <motion.button whileTap={{scale:0.9}} onClick={handleFreeSend}
                      style={{width:40,height:40,borderRadius:20,flexShrink:0,background:'linear-gradient(135deg,rgba(16,185,129,0.3),rgba(5,150,105,0.2))',border:'1px solid rgba(16,185,129,0.4)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>➤</motion.button>
                  </div>
                )}
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      {/* ── РЕДАКТОР ИМЕНИ БОТА ── */}
      <AnimatePresence>
        {showAiNameEdit&&(
          <>
            <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setShowAiNameEdit(false)}
              style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',backdropFilter:'blur(6px)',zIndex:5000}}/>
            <motion.div initial={{opacity:0,scale:0.9,y:20}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.9}}
              style={{position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',zIndex:5001,background:'#0f0f1a',border:'1px solid rgba(99,102,241,0.3)',borderRadius:20,padding:'24px',width:'min(320px,90vw)'}}>
              <div style={{fontSize:16,fontWeight:800,color:'#fff',marginBottom:16}}>✏️ Имя бота</div>
              <input value={aiNameDraft||aiName} onChange={e=>setAiNameDraft(e.target.value)} placeholder="Алина" autoFocus
                style={{width:'100%',background:'rgba(255,255,255,0.07)',border:'1px solid rgba(99,102,241,0.3)',borderRadius:12,padding:'12px 14px',color:'#fff',fontSize:15,outline:'none',boxSizing:'border-box',fontFamily:'inherit',marginBottom:12}}/>
              <div style={{display:'flex',gap:8}}>
                <motion.button whileTap={{scale:0.95}} onClick={()=>{if(aiNameDraft.trim())setAiName(aiNameDraft.trim());setAiNameDraft('');setShowAiNameEdit(false);}}
                  style={{flex:1,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',border:'none',borderRadius:10,padding:'11px',color:'#fff',fontWeight:800,fontSize:14,cursor:'pointer'}}>Сохранить</motion.button>
                <motion.button whileTap={{scale:0.95}} onClick={()=>{setAiNameDraft('');setShowAiNameEdit(false);}}
                  style={{flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:10,padding:'11px',color:'rgba(255,255,255,0.5)',fontSize:14,cursor:'pointer'}}>Отмена</motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ══ МОДАЛ: СЕРТИФИКАТЫ ══ */}
      <AnimatePresence>
        {showCertsModal && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:3000, display:'flex', flexDirection:'column', backdropFilter:'blur(8px)' }}>
            {certEditId !== null ? (
              <motion.div initial={{ y:80, opacity:0 }} animate={{ y:0, opacity:1 }}
                style={{ position:'absolute', inset:0, background:'#0f0f1a', display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                  <motion.button whileTap={{ scale:0.93 }} onClick={() => { setCertEditId(null); setCertEditTitle(''); setCertEditImageUrl(''); setCertEditImagePrev(''); }}
                    style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:22, cursor:'pointer', padding:0 }}>←</motion.button>
                  <div style={{ fontSize:17, fontWeight:800, color:'#fff', flex:1 }}>{certEditId==='new'?'Добавить сертификат':'Редактировать'}</div>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'20px 16px', display:'flex', flexDirection:'column', gap:16 }}>
                  <motion.div whileTap={{ scale:0.97 }} onClick={() => certEditImgRef.current?.click()}
                    style={{ width:'100%', height:200, borderRadius:16, overflow:'hidden', cursor:'pointer', background:'rgba(255,255,255,0.05)', border:'2px dashed rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                    {certEditImagePrev ? <img src={certEditImagePrev} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                     : certEditImageUrl ? <img src={certEditImageUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                     : <div style={{ textAlign:'center' }}><div style={{ fontSize:36, marginBottom:8 }}>📜</div><div style={{ fontSize:13, color:'rgba(255,255,255,0.35)' }}>Нажмите чтобы выбрать фото</div></div>}
                    {certEditUploading && <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'#60a5fa' }}>⏳ Загрузка...</div>}
                  </motion.div>
                  <input ref={certEditImgRef} type="file" accept="image/*" style={{ display:'none' }}
                    onChange={e => { const f=e.target.files?.[0]; if(!f) return; setCertEditImagePrev(URL.createObjectURL(f)); e.target.value=''; }} />
                  <input placeholder="Название (напр. «Диплом психолога»)" value={certEditTitle} onChange={e=>setCertEditTitle(e.target.value)}
                    style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:'12px 14px', color:'#fff', fontSize:15, outline:'none' }} />
                  <motion.button whileTap={{ scale:0.97 }} onClick={async () => {
                    setCertEditUploading(true);
                    let imgUrl = certEditImageUrl;
                    if (certEditImagePrev && certEditImgRef.current?.files?.[0]) {
                      const f = certEditImgRef.current.files[0];
                      const r = await fetch(`${apiBase}/api/image-upload`,{method:'POST',headers:{'Content-Type':f.type},body:f});
                      if(r.ok){const{url}=await r.json(); imgUrl=url;}
                    }
                    const cert: ClassicCert = { id: certEditId==='new'?Date.now().toString():certEditId!, imageUrl:imgUrl, title:certEditTitle };
                    setClassicCerts(prev => certEditId==='new' ? [...prev, cert] : prev.map(c=>c.id===certEditId?cert:c));
                    setCertEditId(null); setCertEditTitle(''); setCertEditImageUrl(''); setCertEditImagePrev('');
                    setCertEditUploading(false);
                  }} style={{ background:'linear-gradient(135deg,#7c3aed,#4f46e5)', border:'none', borderRadius:14, padding:'14px', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer' }}>
                    {certEditUploading ? '⏳ Сохраняем...' : '✅ Сохранить'}
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ y:60, opacity:0 }} animate={{ y:0, opacity:1 }}
                style={{ position:'absolute', inset:0, background:'#0f0f1a', display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                  <motion.button whileTap={{ scale:0.93 }} onClick={() => setShowCertsModal(false)}
                    style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:22, cursor:'pointer', padding:0 }}>←</motion.button>
                  <div style={{ fontSize:22, fontWeight:900, color:'#fff', flex:1 }}>📜 Сертификаты</div>
                  <motion.button whileTap={{ scale:0.95 }} onClick={() => { setCertEditId('new'); setCertEditTitle(''); setCertEditImageUrl(''); setCertEditImagePrev(''); }}
                    style={{ background:'rgba(124,58,237,0.15)', border:'1px solid rgba(124,58,237,0.35)', borderRadius:10, padding:'8px 14px', color:'#a78bfa', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ Добавить</motion.button>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'16px' }}>
                  {classicCerts.length===0 ? (
                    <div style={{ textAlign:'center', padding:'60px 20px' }}>
                      <div style={{ fontSize:48, marginBottom:16 }}>📜</div>
                      <div style={{ fontSize:16, fontWeight:700, color:'#fff', marginBottom:8 }}>Сертификаты не добавлены</div>
                      <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>Добавьте дипломы, удостоверения и сертификаты</div>
                    </div>
                  ) : (
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                      {classicCerts.map(cert => (
                        <div key={cert.id} style={{ borderRadius:14, overflow:'hidden', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', position:'relative' }}>
                          {cert.imageUrl ? <img src={cert.imageUrl} alt="" style={{ width:'100%', height:120, objectFit:'cover' }} /> : <div style={{ width:'100%', height:120, display:'flex', alignItems:'center', justifyContent:'center', fontSize:40 }}>📜</div>}
                          <div style={{ padding:'8px 10px 10px' }}>
                            <div style={{ fontSize:12, fontWeight:700, color:'#fff', lineHeight:1.3 }}>{cert.title||'Без названия'}</div>
                          </div>
                          <div style={{ position:'absolute', top:6, right:6, display:'flex', gap:4 }}>
                            <motion.button whileTap={{ scale:0.9 }} onClick={() => { setCertEditId(cert.id); setCertEditTitle(cert.title); setCertEditImageUrl(cert.imageUrl); setCertEditImagePrev(''); }}
                              style={{ background:'rgba(0,0,0,0.6)', border:'none', borderRadius:6, padding:'4px 6px', color:'#fff', fontSize:10, cursor:'pointer' }}>✏️</motion.button>
                            <motion.button whileTap={{ scale:0.9 }} onClick={() => setClassicCerts(prev=>prev.filter(c=>c.id!==cert.id))}
                              style={{ background:'rgba(239,68,68,0.7)', border:'none', borderRadius:6, padding:'4px 6px', color:'#fff', fontSize:10, cursor:'pointer' }}>🗑️</motion.button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ МОДАЛ: FAQ ══ */}
      <AnimatePresence>
        {showFaqModal && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:3000, display:'flex', flexDirection:'column', backdropFilter:'blur(8px)' }}>
            {faqEditId !== null ? (
              <motion.div initial={{ y:80, opacity:0 }} animate={{ y:0, opacity:1 }}
                style={{ position:'absolute', inset:0, background:'#0f0f1a', display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                  <motion.button whileTap={{ scale:0.93 }} onClick={() => { setFaqEditId(null); setFaqEditQ(''); setFaqEditA(''); }}
                    style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:22, cursor:'pointer', padding:0 }}>←</motion.button>
                  <div style={{ fontSize:17, fontWeight:800, color:'#fff', flex:1 }}>{faqEditId==='new'?'Добавить вопрос':'Редактировать'}</div>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'20px 16px', display:'flex', flexDirection:'column', gap:14 }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.5)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>Вопрос</div>
                    <textarea rows={2} placeholder="Как долго длится консультация?" value={faqEditQ} onChange={e=>setFaqEditQ(e.target.value)}
                      style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:'12px 14px', color:'#fff', fontSize:14, outline:'none', resize:'none', boxSizing:'border-box' }} />
                  </div>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.5)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.06em' }}>Ответ</div>
                    <textarea rows={4} placeholder="Консультация длится 60 минут..." value={faqEditA} onChange={e=>setFaqEditA(e.target.value)}
                      style={{ width:'100%', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:'12px 14px', color:'#fff', fontSize:14, outline:'none', resize:'none', boxSizing:'border-box' }} />
                  </div>
                  <motion.button whileTap={{ scale:0.97 }} onClick={() => {
                    if(!faqEditQ.trim()||!faqEditA.trim()) return;
                    const item: ClassicFaq = { id: faqEditId==='new'?Date.now().toString():faqEditId!, q:faqEditQ.trim(), a:faqEditA.trim() };
                    setClassicFaq(prev => faqEditId==='new' ? [...prev, item] : prev.map(f=>f.id===faqEditId?item:f));
                    setFaqEditId(null); setFaqEditQ(''); setFaqEditA('');
                  }} style={{ background:'linear-gradient(135deg,#7c3aed,#4f46e5)', border:'none', borderRadius:14, padding:'14px', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer' }}>✅ Сохранить</motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ y:60, opacity:0 }} animate={{ y:0, opacity:1 }}
                style={{ position:'absolute', inset:0, background:'#0f0f1a', display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                  <motion.button whileTap={{ scale:0.93 }} onClick={() => setShowFaqModal(false)}
                    style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:22, cursor:'pointer', padding:0 }}>←</motion.button>
                  <div style={{ fontSize:22, fontWeight:900, color:'#fff', flex:1 }}>❓ FAQ</div>
                  <motion.button whileTap={{ scale:0.95 }} onClick={() => { setFaqEditId('new'); setFaqEditQ(''); setFaqEditA(''); }}
                    style={{ background:'rgba(124,58,237,0.15)', border:'1px solid rgba(124,58,237,0.35)', borderRadius:10, padding:'8px 14px', color:'#a78bfa', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ Добавить</motion.button>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:12 }}>
                  {classicFaq.length===0 ? (
                    <div style={{ textAlign:'center', padding:'60px 20px' }}>
                      <div style={{ fontSize:48, marginBottom:16 }}>❓</div>
                      <div style={{ fontSize:16, fontWeight:700, color:'#fff', marginBottom:8 }}>Вопросов пока нет</div>
                      <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>Добавьте частые вопросы и ответы на них</div>
                    </div>
                  ) : classicFaq.map((item) => (
                    <div key={item.id} style={{ background:'rgba(255,255,255,0.05)', borderRadius:14, padding:'14px 16px', border:'1px solid rgba(255,255,255,0.08)' }}>
                      <div style={{ fontSize:13, fontWeight:800, color:'#a78bfa', marginBottom:4 }}>❓ {item.q}</div>
                      <div style={{ fontSize:13, color:'rgba(255,255,255,0.7)', lineHeight:1.6, marginBottom:10 }}>{item.a}</div>
                      <div style={{ display:'flex', gap:6 }}>
                        <motion.button whileTap={{ scale:0.93 }} onClick={() => { setFaqEditId(item.id); setFaqEditQ(item.q); setFaqEditA(item.a); }}
                          style={{ flex:1, background:'rgba(124,58,237,0.08)', border:'1px solid rgba(124,58,237,0.2)', borderRadius:8, padding:'7px', color:'#a78bfa', fontSize:11, fontWeight:700, cursor:'pointer' }}>✏️ Изменить</motion.button>
                        <motion.button whileTap={{ scale:0.93 }} onClick={() => setClassicFaq(prev=>prev.filter(f=>f.id!==item.id))}
                          style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'7px 10px', color:'#f87171', fontSize:13, cursor:'pointer' }}>🗑️</motion.button>
                      </div>
                    </div>
                  ))}
                  <div style={{ height:40 }} />
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ МОДАЛ: КЕЙСЫ ══ */}
      <AnimatePresence>
        {showCasesModal && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:3000, display:'flex', flexDirection:'column', backdropFilter:'blur(8px)' }}>
            {caseEditId !== null ? (
              <motion.div initial={{ y:80, opacity:0 }} animate={{ y:0, opacity:1 }}
                style={{ position:'absolute', inset:0, background:'#0f0f1a', display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                  <motion.button whileTap={{ scale:0.93 }} onClick={() => { setCaseEditId(null); setCaseEditTitle(''); setCaseEditDesc(''); setCaseEditResult(''); setCaseEditImageUrl(''); setCaseEditImagePrev(''); }}
                    style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:22, cursor:'pointer', padding:0 }}>←</motion.button>
                  <div style={{ fontSize:17, fontWeight:800, color:'#fff', flex:1 }}>{caseEditId==='new'?'Добавить кейс':'Редактировать'}</div>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'20px 16px', display:'flex', flexDirection:'column', gap:14 }}>
                  <motion.div whileTap={{ scale:0.97 }} onClick={() => caseEditImgRef.current?.click()}
                    style={{ width:'100%', height:180, borderRadius:16, overflow:'hidden', cursor:'pointer', background:'rgba(255,255,255,0.05)', border:'2px dashed rgba(255,255,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
                    {caseEditImagePrev ? <img src={caseEditImagePrev} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                     : caseEditImageUrl ? <img src={caseEditImageUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                     : <div style={{ textAlign:'center' }}><div style={{ fontSize:36, marginBottom:8 }}>📂</div><div style={{ fontSize:13, color:'rgba(255,255,255,0.35)' }}>Фото кейса (необязательно)</div></div>}
                    {caseEditUploading && <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, color:'#60a5fa' }}>⏳ Загрузка...</div>}
                  </motion.div>
                  <input ref={caseEditImgRef} type="file" accept="image/*" style={{ display:'none' }}
                    onChange={e => { const f=e.target.files?.[0]; if(!f) return; setCaseEditImagePrev(URL.createObjectURL(f)); e.target.value=''; }} />
                  <input placeholder="Название кейса" value={caseEditTitle} onChange={e=>setCaseEditTitle(e.target.value)}
                    style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:'12px 14px', color:'#fff', fontSize:14, outline:'none' }} />
                  <textarea rows={3} placeholder="Описание — что было сделано" value={caseEditDesc} onChange={e=>setCaseEditDesc(e.target.value)}
                    style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:'12px 14px', color:'#fff', fontSize:14, outline:'none', resize:'none' }} />
                  <input placeholder="Результат (напр. «+300% к выручке за 3 мес»)" value={caseEditResult} onChange={e=>setCaseEditResult(e.target.value)}
                    style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:'12px 14px', color:'#fff', fontSize:14, outline:'none' }} />
                  <motion.button whileTap={{ scale:0.97 }} onClick={async () => {
                    setCaseEditUploading(true);
                    let imgUrl = caseEditImageUrl;
                    if (caseEditImagePrev && caseEditImgRef.current?.files?.[0]) {
                      const f = caseEditImgRef.current.files[0];
                      const r = await fetch(`${apiBase}/api/image-upload`,{method:'POST',headers:{'Content-Type':f.type},body:f});
                      if(r.ok){const{url}=await r.json(); imgUrl=url;}
                    }
                    const c: ClassicCase = { id: caseEditId==='new'?Date.now().toString():caseEditId!, imageUrl:imgUrl, title:caseEditTitle, desc:caseEditDesc, result:caseEditResult };
                    setClassicCases(prev => caseEditId==='new' ? [...prev, c] : prev.map(x=>x.id===caseEditId?c:x));
                    setCaseEditId(null); setCaseEditTitle(''); setCaseEditDesc(''); setCaseEditResult(''); setCaseEditImageUrl(''); setCaseEditImagePrev('');
                    setCaseEditUploading(false);
                  }} style={{ background:'linear-gradient(135deg,#7c3aed,#4f46e5)', border:'none', borderRadius:14, padding:'14px', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer' }}>
                    {caseEditUploading ? '⏳ Сохраняем...' : '✅ Сохранить'}
                  </motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ y:60, opacity:0 }} animate={{ y:0, opacity:1 }}
                style={{ position:'absolute', inset:0, background:'#0f0f1a', display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                  <motion.button whileTap={{ scale:0.93 }} onClick={() => setShowCasesModal(false)}
                    style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:22, cursor:'pointer', padding:0 }}>←</motion.button>
                  <div style={{ fontSize:22, fontWeight:900, color:'#fff', flex:1 }}>📂 Кейсы</div>
                  <motion.button whileTap={{ scale:0.95 }} onClick={() => { setCaseEditId('new'); setCaseEditTitle(''); setCaseEditDesc(''); setCaseEditResult(''); setCaseEditImageUrl(''); setCaseEditImagePrev(''); }}
                    style={{ background:'rgba(124,58,237,0.15)', border:'1px solid rgba(124,58,237,0.35)', borderRadius:10, padding:'8px 14px', color:'#a78bfa', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ Добавить</motion.button>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:14 }}>
                  {classicCases.length===0 ? (
                    <div style={{ textAlign:'center', padding:'60px 20px' }}>
                      <div style={{ fontSize:48, marginBottom:16 }}>📂</div>
                      <div style={{ fontSize:16, fontWeight:700, color:'#fff', marginBottom:8 }}>Кейсы не добавлены</div>
                      <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>Покажите реальные истории успеха</div>
                    </div>
                  ) : classicCases.map(c => (
                    <div key={c.id} style={{ background:'rgba(255,255,255,0.05)', borderRadius:16, overflow:'hidden', border:'1px solid rgba(255,255,255,0.08)' }}>
                      {c.imageUrl && <img src={c.imageUrl} alt="" style={{ width:'100%', height:160, objectFit:'cover' }} />}
                      <div style={{ padding:'14px 16px' }}>
                        <div style={{ fontSize:15, fontWeight:800, color:'#fff', marginBottom:6 }}>{c.title}</div>
                        {c.desc && <div style={{ fontSize:13, color:'rgba(255,255,255,0.6)', lineHeight:1.6, marginBottom:8 }}>{c.desc}</div>}
                        {c.result && <div style={{ fontSize:13, fontWeight:700, color:'#4ade80', padding:'6px 10px', background:'rgba(74,222,128,0.1)', borderRadius:8, marginBottom:10 }}>📈 {c.result}</div>}
                        <div style={{ display:'flex', gap:6 }}>
                          <motion.button whileTap={{ scale:0.93 }} onClick={() => { setCaseEditId(c.id); setCaseEditTitle(c.title); setCaseEditDesc(c.desc); setCaseEditResult(c.result); setCaseEditImageUrl(c.imageUrl); setCaseEditImagePrev(''); }}
                            style={{ flex:1, background:'rgba(124,58,237,0.08)', border:'1px solid rgba(124,58,237,0.2)', borderRadius:8, padding:'7px', color:'#a78bfa', fontSize:11, fontWeight:700, cursor:'pointer' }}>✏️ Изменить</motion.button>
                          <motion.button whileTap={{ scale:0.93 }} onClick={() => setClassicCases(prev=>prev.filter(x=>x.id!==c.id))}
                            style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'7px 10px', color:'#f87171', fontSize:13, cursor:'pointer' }}>🗑️</motion.button>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div style={{ height:40 }} />
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ МОДАЛ: ССЫЛКИ ══ */}
      <AnimatePresence>
        {showLinksModal && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:3000, display:'flex', flexDirection:'column', backdropFilter:'blur(8px)' }}>
            {linkEditId !== null ? (
              <motion.div initial={{ y:80, opacity:0 }} animate={{ y:0, opacity:1 }}
                style={{ position:'absolute', inset:0, background:'#0f0f1a', display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                  <motion.button whileTap={{ scale:0.93 }} onClick={() => { setLinkEditId(null); setLinkEditLabel(''); setLinkEditUrl(''); setLinkEditIcon('🔗'); }}
                    style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:22, cursor:'pointer', padding:0 }}>←</motion.button>
                  <div style={{ fontSize:17, fontWeight:800, color:'#fff', flex:1 }}>{linkEditId==='new'?'Добавить ссылку':'Редактировать'}</div>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'20px 16px', display:'flex', flexDirection:'column', gap:14 }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.5)', marginBottom:8, textTransform:'uppercase' }}>Иконка</div>
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                      {['🔗','📸','▶️','💬','📱','🌐','📧','💼','🎵','📺','🐦','💻'].map(ic => (
                        <motion.button key={ic} whileTap={{ scale:0.9 }} onClick={() => setLinkEditIcon(ic)}
                          style={{ width:40, height:40, borderRadius:10, background: linkEditIcon===ic ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.06)', border: linkEditIcon===ic ? '2px solid #a78bfa' : '1px solid rgba(255,255,255,0.1)', fontSize:20, cursor:'pointer' }}>
                          {ic}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                  <input placeholder="Название (напр. «Instagram»)" value={linkEditLabel} onChange={e=>setLinkEditLabel(e.target.value)}
                    style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:'12px 14px', color:'#fff', fontSize:14, outline:'none' }} />
                  <input placeholder="URL (https://...)" value={linkEditUrl} onChange={e=>setLinkEditUrl(e.target.value)} type="url"
                    style={{ background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:12, padding:'12px 14px', color:'#fff', fontSize:14, outline:'none' }} />
                  <motion.button whileTap={{ scale:0.97 }} onClick={() => {
                    if(!linkEditLabel.trim()||!linkEditUrl.trim()) return;
                    const link: ClassicLink = { id: linkEditId==='new'?Date.now().toString():linkEditId!, label:linkEditLabel.trim(), url:linkEditUrl.trim(), icon:linkEditIcon };
                    setClassicLinks(prev => linkEditId==='new' ? [...prev, link] : prev.map(l=>l.id===linkEditId?link:l));
                    setLinkEditId(null); setLinkEditLabel(''); setLinkEditUrl(''); setLinkEditIcon('🔗');
                  }} style={{ background:'linear-gradient(135deg,#7c3aed,#4f46e5)', border:'none', borderRadius:14, padding:'14px', color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer' }}>✅ Сохранить</motion.button>
                </div>
              </motion.div>
            ) : (
              <motion.div initial={{ y:60, opacity:0 }} animate={{ y:0, opacity:1 }}
                style={{ position:'absolute', inset:0, background:'#0f0f1a', display:'flex', flexDirection:'column' }}>
                <div style={{ display:'flex', alignItems:'center', gap:12, padding:'18px 16px 12px', borderBottom:'1px solid rgba(255,255,255,0.08)' }}>
                  <motion.button whileTap={{ scale:0.93 }} onClick={() => setShowLinksModal(false)}
                    style={{ background:'none', border:'none', color:'rgba(255,255,255,0.5)', fontSize:22, cursor:'pointer', padding:0 }}>←</motion.button>
                  <div style={{ fontSize:22, fontWeight:900, color:'#fff', flex:1 }}>🔗 Ссылки</div>
                  <motion.button whileTap={{ scale:0.95 }} onClick={() => { setLinkEditId('new'); setLinkEditLabel(''); setLinkEditUrl(''); setLinkEditIcon('🔗'); }}
                    style={{ background:'rgba(124,58,237,0.15)', border:'1px solid rgba(124,58,237,0.35)', borderRadius:10, padding:'8px 14px', color:'#a78bfa', fontSize:13, fontWeight:700, cursor:'pointer' }}>+ Добавить</motion.button>
                </div>
                <div style={{ flex:1, overflowY:'auto', padding:'16px', display:'flex', flexDirection:'column', gap:10 }}>
                  {classicLinks.length===0 ? (
                    <div style={{ textAlign:'center', padding:'60px 20px' }}>
                      <div style={{ fontSize:48, marginBottom:16 }}>🔗</div>
                      <div style={{ fontSize:16, fontWeight:700, color:'#fff', marginBottom:8 }}>Ссылок пока нет</div>
                      <div style={{ fontSize:13, color:'rgba(255,255,255,0.4)' }}>Добавьте соцсети, сайт, мессенджеры</div>
                    </div>
                  ) : classicLinks.map(link => (
                    <div key={link.id} style={{ display:'flex', alignItems:'center', gap:12, background:'rgba(255,255,255,0.05)', borderRadius:14, padding:'14px 16px', border:'1px solid rgba(255,255,255,0.08)' }}>
                      <span style={{ fontSize:24, flexShrink:0 }}>{link.icon}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'#fff' }}>{link.label}</div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.4)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{link.url}</div>
                      </div>
                      <motion.button whileTap={{ scale:0.9 }} onClick={() => window.open(link.url,'_blank')}
                        style={{ background:'rgba(124,58,237,0.15)', border:'1px solid rgba(124,58,237,0.3)', borderRadius:8, padding:'6px 10px', color:'#a78bfa', fontSize:11, fontWeight:700, cursor:'pointer', flexShrink:0 }}>↗️</motion.button>
                      <motion.button whileTap={{ scale:0.9 }} onClick={() => { setLinkEditId(link.id); setLinkEditLabel(link.label); setLinkEditUrl(link.url); setLinkEditIcon(link.icon); }}
                        style={{ background:'rgba(255,255,255,0.07)', border:'none', borderRadius:8, padding:'6px 8px', color:'rgba(255,255,255,0.6)', fontSize:12, cursor:'pointer', flexShrink:0 }}>✏️</motion.button>
                      <motion.button whileTap={{ scale:0.9 }} onClick={() => setClassicLinks(prev=>prev.filter(l=>l.id!==link.id))}
                        style={{ background:'rgba(239,68,68,0.1)', border:'none', borderRadius:8, padding:'6px 8px', color:'#f87171', fontSize:12, cursor:'pointer', flexShrink:0 }}>🗑️</motion.button>
                    </div>
                  ))}
                  <div style={{ height:40 }} />
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    {/* ═══ МОДАЛ: ЗАКЛАДКИ ═══ */}
    <AnimatePresence>
      {showBookmarksModal&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:3000,display:'flex',flexDirection:'column',backdropFilter:'blur(10px)'}}>
          <motion.div initial={{y:60,opacity:0}} animate={{y:0,opacity:1}}
            style={{position:'absolute',inset:0,background:'#0c0c18',display:'flex',flexDirection:'column'}}>
            <div style={{display:'flex',alignItems:'center',gap:12,padding:'18px 16px 12px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
              <motion.button whileTap={{scale:0.93}} onClick={()=>setShowBookmarksModal(false)}
                style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',fontSize:22,cursor:'pointer',padding:0}}>←</motion.button>
              <div style={{fontSize:22,fontWeight:900,color:'#fff',flex:1}}>🔖 Закладки</div>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.35)'}}>{bookmarkedPosts.length} сохранено</div>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'12px 12px 80px'}}>
              {bookmarksLoading?(
                <div style={{display:'flex',justifyContent:'center',padding:60}}>
                  <motion.div animate={{rotate:360}} transition={{repeat:Infinity,duration:1,ease:'linear'}} style={{width:32,height:32,borderRadius:'50%',border:'3px solid rgba(255,255,255,0.15)',borderTopColor:activeAccent}}/>
                </div>
              ):bookmarkedPosts.length===0?(
                <div style={{textAlign:'center',padding:'60px 20px'}}>
                  <div style={{fontSize:56,marginBottom:16}}>🔖</div>
                  <div style={{fontSize:17,fontWeight:700,color:'#fff',marginBottom:8}}>Закладок пока нет</div>
                  <div style={{fontSize:13,color:'rgba(255,255,255,0.4)'}}>Нажми 🔖 на любом посте, чтобы сохранить</div>
                </div>
              ):bookmarkedPosts.map(p=>(
                <PostCard key={p.id} p={p} c={c} accent={activeAccent}
                  onLike={id=>{
                    fetch(`${window.location.origin}/api/broadcasts/${id}/like`,{method:'POST',headers:{'x-session-token':getSessionToken()||''}}).catch(()=>null);
                    setBookmarkedPosts(prev=>prev.map(x=>x.id===id?{...x,liked:!x.liked,likes:x.liked?x.likes-1:x.likes+1}:x));
                  }}
                  style={postCardStyle} avatarSrc={avatarSrc} name={profName}
                />
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* ═══ МОДАЛ: ОФОРМЛЕНИЕ (Дизайн) ═══ */}
    <AnimatePresence>
      {showDesignModal&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.92)',display:'flex',flexDirection:'column',backdropFilter:'blur(12px)'}}>
          <div style={{width:'100%',maxWidth:430,margin:'0 auto',display:'flex',flexDirection:'column',height:'100%',background:isDark?'#090912':'#f5f5fc'}}>
            {/* Шапка */}
            <div style={{display:'flex',alignItems:'center',gap:12,padding:'52px 16px 14px',borderBottom:`1px solid ${c.border}`,background:isDark?'rgba(10,10,20,0.98)':'rgba(248,248,252,0.98)',position:'sticky',top:0,zIndex:2,backdropFilter:'blur(16px)'}}>
              <motion.button whileTap={{scale:0.88}} onClick={()=>setShowDesignModal(false)}
                style={{width:36,height:36,borderRadius:'50%',background:c.cardAlt,border:`1px solid ${c.borderB}`,color:c.mid,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>←</motion.button>
              <span style={{fontSize:17,fontWeight:900,color:c.light,letterSpacing:'0.02em'}}>🎨 Оформление</span>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'16px'}}>
              <div style={{fontSize:10,fontWeight:700,color:c.sub,letterSpacing:'0.1em',textTransform:'uppercase',marginBottom:8,marginTop:4}}>Профиль</div>
              {[
                {icon:'🃏',label:'Стиль карточек',desc:POST_CARD_STYLE_META.find(s=>s.id===postCardStyle)?.name||'Классика',fn:()=>setShowCardStylePicker(true)},
                {icon:'📷',label:'Обложка профиля',desc:'Фото или градиент шапки',fn:()=>{setShowDesignModal(false);setShowCoverPicker(true);}},
                {icon:'🎨',label:'Фон ленты',desc:'Цвет или градиент позади постов',fn:()=>setShowFeedBgPicker(true)},
                {icon:'🎬',label:'Видео-визитка',desc:proVizitkaUrl?'Видео загружено ✓':'Короткое видео у аватара',fn:()=>setShowVizitkaModal(true)},
                {icon:'💫',label:'Хайлайты',desc:proHighlights.length>0?`${proHighlights.length} хайлайт(ов)`:'Закреплённые истории у профиля',fn:()=>{setHlNewEmoji('✨');setHlNewTitle('');setHlNewCoverUrl('');setHlEditingId(null);setShowHlEditor(true);}},
                {icon:'🪙',label:'Свайп-монеты',desc:`${coinBalance} монет · ${referralCount} приглашено · Реферальная программа`,fn:()=>setShowReferralModal(true)},
              ].map(item=>(
                <motion.button key={item.label} whileTap={{scale:0.97}} onClick={item.fn}
                  style={{width:'100%',display:'flex',alignItems:'center',gap:14,padding:'14px 16px',background:c.card,border:`1px solid ${c.border}`,borderRadius:16,cursor:'pointer',marginBottom:8,textAlign:'left'}}>
                  <span style={{fontSize:24,flexShrink:0}}>{item.icon}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:800,color:c.light}}>{item.label}</div>
                    <div style={{fontSize:11,color:c.sub,marginTop:2}}>{item.desc}</div>
                  </div>
                  <span style={{color:c.sub,fontSize:18}}>›</span>
                </motion.button>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* ═══ ПОДЭКРАН: СТИЛЬ КАРТОЧЕК ═══ */}
    <AnimatePresence>
      {showCardStylePicker&&(
        <motion.div initial={{opacity:0,x:'100%'}} animate={{opacity:1,x:0}} exit={{opacity:0,x:'100%'}} transition={{type:'tween',duration:0.22}}
          style={{position:'fixed',inset:0,zIndex:600,background:isDark?'#090912':'#f5f5fc',display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',alignItems:'center',gap:12,padding:'52px 16px 14px',borderBottom:`1px solid ${c.border}`}}>
            <motion.button whileTap={{scale:0.88}} onClick={()=>setShowCardStylePicker(false)}
              style={{width:36,height:36,borderRadius:'50%',background:c.cardAlt,border:`1px solid ${c.borderB}`,color:c.mid,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>←</motion.button>
            <span style={{fontSize:17,fontWeight:900,color:c.light}}>🃏 Стиль карточек</span>
          </div>
          <div style={{flex:1,overflowY:'auto',padding:'16px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
            {POST_CARD_STYLE_META.map(s=>{
              const active=postCardStyle===s.id;
              return(
                <motion.button key={s.id} whileTap={{scale:0.95}} onClick={()=>{setPostCardStyle(s.id);setShowCardStylePicker(false);}}
                  style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8,
                    padding:'20px 12px',borderRadius:18,cursor:'pointer',textAlign:'center',
                    background:active?`linear-gradient(135deg,${activeAccent}28,${activeAccent}0a)`:c.card,
                    border:`2px solid ${active?activeAccent:c.border}`,
                    boxShadow:active?`0 0 16px ${activeAccent}33`:'none',transition:'all 0.18s'}}>
                  <span style={{fontSize:34}}>{s.emoji}</span>
                  <div style={{fontSize:14,fontWeight:900,color:active?activeAccent:c.light}}>{s.name}</div>
                  <div style={{fontSize:11,color:c.sub,lineHeight:1.3}}>{s.desc}</div>
                  {active&&<span style={{fontSize:12,color:activeAccent,fontWeight:800}}>✓ Активен</span>}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* ═══ БОТОМ-ШИТ: ФОН ЛЕНТЫ ═══ */}
    <AnimatePresence>
      {showFeedBgPicker&&(
        <>
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setShowFeedBgPicker(false)}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',backdropFilter:'blur(6px)',zIndex:700}}/>
          <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',stiffness:340,damping:36}}
            style={{position:'fixed',bottom:0,left:0,right:0,zIndex:701,background:'#111118',borderRadius:'22px 22px 0 0',border:'1px solid rgba(255,255,255,0.1)',padding:'20px 16px 40px',maxHeight:'70vh',overflowY:'auto'}}>
            <div style={{width:40,height:4,borderRadius:99,background:'rgba(255,255,255,0.2)',margin:'0 auto 18px'}}/>
            <div style={{fontSize:18,fontWeight:800,color:'#fff',marginBottom:18}}>Фон ленты 🎨</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
              {FEED_BG_OPTIONS.map(({label,bg})=>(
                <motion.div key={label} whileTap={{scale:0.96}} onClick={()=>{setFeedBgGradient(bg);setShowFeedBgPicker(false);}}
                  style={{height:bg?64:52,borderRadius:14,background:bg||'rgba(255,255,255,0.04)',cursor:'pointer',position:'relative',
                    border:feedBgGradient===bg?'2.5px solid #3b82f6':'2px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden'}}>
                  <div style={{position:'absolute',bottom:6,left:0,right:0,textAlign:'center',fontSize:11,color:bg?'rgba(255,255,255,0.8)':'rgba(255,255,255,0.5)',fontWeight:600,textShadow:'0 1px 4px rgba(0,0,0,0.9)'}}>
                    {!bg?'Без фона':label}
                  </div>
                  {feedBgGradient===bg&&<div style={{position:'absolute',top:6,right:8,fontSize:14}}>✓</div>}
                </motion.div>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>

    {/* ═══ МОДАЛ: ВИДЕО-ВИЗИТКА ═══ */}
    <AnimatePresence>
      {showVizitkaModal&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:700,display:'flex',flexDirection:'column',backdropFilter:'blur(8px)'}}>
          <motion.div initial={{y:60,opacity:0}} animate={{y:0,opacity:1}}
            style={{position:'absolute',inset:0,background:'#0f0f1a',display:'flex',flexDirection:'column'}}>
            <div style={{display:'flex',alignItems:'center',gap:12,padding:'18px 16px 12px',borderBottom:'1px solid rgba(255,255,255,0.08)'}}>
              <motion.button whileTap={{scale:0.93}} onClick={()=>setShowVizitkaModal(false)}
                style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',fontSize:22,cursor:'pointer',padding:0}}>←</motion.button>
              <div style={{fontSize:20,fontWeight:900,color:'#fff',flex:1}}>🎬 Видео-визитка</div>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'20px 16px',display:'flex',flexDirection:'column',gap:16,alignItems:'center'}}>
              {proVizitkaUrl?(
                <>
                  <video src={proVizitkaUrl} controls playsInline style={{width:'100%',maxWidth:400,borderRadius:16,background:'#000',maxHeight:'55vh'}}/>
                  <div style={{display:'flex',gap:10,flexWrap:'wrap',justifyContent:'center'}}>
                    <motion.button whileTap={{scale:0.95}} onClick={()=>vizitkaFileRef.current?.click()}
                      style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:12,padding:'11px 22px',color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>🔄 Заменить</motion.button>
                    <motion.button whileTap={{scale:0.95}} onClick={()=>{setProVizitkaUrl('');setShowVizitkaModal(false);}}
                      style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:12,padding:'11px 22px',color:'#f87171',fontSize:13,fontWeight:700,cursor:'pointer'}}>🗑️ Удалить</motion.button>
                  </div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',textAlign:'center'}}>Посетители увидят кольцо ▶ на вашем аватаре</div>
                </>
              ):(
                <div style={{textAlign:'center',padding:'40px 20px'}}>
                  <div style={{fontSize:64,marginBottom:16}}>🎬</div>
                  <div style={{fontSize:16,fontWeight:700,color:'#fff',marginBottom:8}}>Видео-визитка не загружена</div>
                  <div style={{fontSize:13,color:'rgba(255,255,255,0.4)',marginBottom:24,lineHeight:1.5}}>Загрузите короткое видео-приветствие.<br/>Оно появится как кольцо ▶ вокруг аватара.</div>
                  <motion.button whileTap={{scale:0.95}} onClick={()=>vizitkaFileRef.current?.click()}
                    style={{background:'linear-gradient(135deg,#ff6b6b,#f8a100)',border:'none',borderRadius:14,padding:'14px 32px',color:'#fff',fontSize:15,fontWeight:800,cursor:'pointer'}}>
                    {vizitkaUploading?'⏳ Загрузка...':'📤 Загрузить видео'}
                  </motion.button>
                </div>
              )}
              <input ref={vizitkaFileRef} type="file" accept="video/*" style={{display:'none'}}
                onChange={async e=>{
                  const f=e.target.files?.[0]; if(!f)return;
                  setVizitkaUploading(true);
                  const r=await fetch(`${window.location.origin}/api/video-upload`,{method:'POST',headers:{'Content-Type':f.type||'video/mp4','x-session-token':getSessionToken()||'','x-filename':f.name},body:f});
                  if(r.ok){const{url}=await r.json();setProVizitkaUrl(url);}
                  setVizitkaUploading(false); e.target.value='';
                }}/>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* ═══ МОДАЛ: ХАЙЛАЙТЫ ═══ */}
    <AnimatePresence>
      {showHlEditor&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:700,display:'flex',flexDirection:'column',backdropFilter:'blur(8px)'}}>
          <motion.div initial={{y:60,opacity:0}} animate={{y:0,opacity:1}}
            style={{position:'absolute',inset:0,background:'#0f0f1a',display:'flex',flexDirection:'column'}}>
            <div style={{display:'flex',alignItems:'center',gap:12,padding:'18px 16px 12px',borderBottom:'1px solid rgba(255,255,255,0.08)',flexShrink:0}}>
              <motion.button whileTap={{scale:0.93}} onClick={()=>{setShowHlEditor(false);setHlEditingId(null);}}
                style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',fontSize:22,cursor:'pointer',padding:0}}>←</motion.button>
              <div style={{fontSize:18,fontWeight:900,color:'#fff',flex:1}}>💫 {hlEditingId?'Редактировать хайлайт':'Новый хайлайт'}</div>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'20px 16px',display:'flex',flexDirection:'column',gap:16}}>
              {/* Список существующих хайлайтов */}
              {proHighlights.length>0&&(
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.4)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:10}}>Мои хайлайты</div>
                  <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                    {proHighlights.map(hl=>(
                      <motion.button key={hl.id} whileTap={{scale:0.92}} onClick={()=>{setHlEditingId(hl.id);setHlNewTitle(hl.title);setHlNewEmoji(hl.emoji);setHlNewCoverUrl(hl.coverUrl);}}
                        style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,background:'rgba(255,255,255,0.04)',border:`1.5px solid ${hlEditingId===hl.id?activeAccent:'rgba(255,255,255,0.12)'}`,borderRadius:16,padding:'10px 12px',cursor:'pointer',minWidth:72}}>
                        <div style={{width:48,height:48,borderRadius:'50%',background:hl.coverUrl?`url(${hl.coverUrl}) center/cover`:activeAccent,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,overflow:'hidden'}}>
                          {!hl.coverUrl&&hl.emoji}
                        </div>
                        <div style={{fontSize:10,color:'rgba(255,255,255,0.6)',fontWeight:600,textAlign:'center',maxWidth:72,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{hl.title}</div>
                      </motion.button>
                    ))}
                    <motion.button whileTap={{scale:0.92}} onClick={()=>{setHlEditingId(null);setHlNewTitle('');setHlNewEmoji('✨');setHlNewCoverUrl('');}}
                      style={{display:'flex',flexDirection:'column',alignItems:'center',gap:6,background:'rgba(255,255,255,0.04)',border:'1.5px dashed rgba(255,255,255,0.2)',borderRadius:16,padding:'10px 12px',cursor:'pointer',minWidth:72}}>
                      <div style={{width:48,height:48,borderRadius:'50%',background:'rgba(255,255,255,0.06)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>+</div>
                      <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',fontWeight:600}}>Новый</div>
                    </motion.button>
                  </div>
                </div>
              )}
              {/* Форма */}
              <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.10)',borderRadius:16,padding:16}}>
                <div style={{fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.45)',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.06em'}}>Название и эмодзи</div>
                <div style={{display:'flex',gap:10,alignItems:'center'}}>
                  <input value={hlNewEmoji} onChange={e=>setHlNewEmoji(e.target.value.slice(-2)||'✨')}
                    style={{width:52,height:52,borderRadius:'50%',background:activeAccent,border:'none',outline:'none',textAlign:'center',fontSize:26,cursor:'pointer',color:'#fff'}}/>
                  <input value={hlNewTitle} onChange={e=>setHlNewTitle(e.target.value)} placeholder="Название хайлайта"
                    style={{flex:1,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',borderRadius:10,padding:'12px 14px',color:'#fff',fontSize:14,outline:'none'}}/>
                </div>
              </div>
              {/* Обложка */}
              <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.10)',borderRadius:16,padding:16}}>
                <div style={{fontSize:12,fontWeight:700,color:'rgba(255,255,255,0.45)',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.06em'}}>Обложка (необязательно)</div>
                <div style={{display:'flex',gap:12,alignItems:'center'}}>
                  <div style={{width:60,height:60,borderRadius:'50%',flexShrink:0,background:hlNewCoverUrl?`url(${hlNewCoverUrl}) center/cover no-repeat`:activeAccent,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,overflow:'hidden'}}>
                    {!hlNewCoverUrl&&hlNewEmoji}
                  </div>
                  <motion.button whileTap={{scale:0.95}} onClick={()=>hlCoverRef.current?.click()}
                    style={{background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.15)',borderRadius:10,padding:'10px 18px',color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                    {hlUploadingCover?'⏳...':hlNewCoverUrl?'🔄 Заменить':'📷 Загрузить'}
                  </motion.button>
                  {hlNewCoverUrl&&<motion.button whileTap={{scale:0.95}} onClick={()=>setHlNewCoverUrl('')}
                    style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:10,padding:'10px 14px',color:'#f87171',fontSize:13,cursor:'pointer'}}>🗑️</motion.button>}
                </div>
                <input ref={hlCoverRef} type="file" accept="image/*" style={{display:'none'}}
                  onChange={async e=>{
                    const f=e.target.files?.[0];if(!f)return;
                    setHlUploadingCover(true);
                    const r=await fetch(`${window.location.origin}/api/image-upload`,{method:'POST',headers:{'Content-Type':f.type,'x-session-token':getSessionToken()||''},body:f});
                    if(r.ok){const{url}=await r.json();setHlNewCoverUrl(url);}
                    setHlUploadingCover(false);e.target.value='';
                  }}/>
              </div>
              {/* Сохранить / Удалить */}
              <motion.button whileTap={{scale:0.96}} onClick={()=>{
                if(!hlNewTitle.trim())return;
                if(hlEditingId){
                  setProHighlights(prev=>prev.map(h=>h.id===hlEditingId?{...h,title:hlNewTitle.trim(),emoji:hlNewEmoji,coverUrl:hlNewCoverUrl}:h));
                  setShowHlEditor(false);setHlEditingId(null);
                }else{
                  const newHl:HlItem={id:Date.now().toString(),title:hlNewTitle.trim(),emoji:hlNewEmoji,coverUrl:hlNewCoverUrl};
                  setProHighlights(prev=>[...prev,newHl]);
                  setHlNewTitle('');setHlNewEmoji('✨');setHlNewCoverUrl('');
                }
              }} style={{background:`linear-gradient(135deg,${activeAccent},#818cf8)`,border:'none',borderRadius:14,padding:'14px 24px',color:'#fff',fontSize:15,fontWeight:800,cursor:'pointer'}}>
                {hlEditingId?'✓ Сохранить':'+ Создать хайлайт'}
              </motion.button>
              {hlEditingId&&(
                <motion.button whileTap={{scale:0.96}} onClick={()=>{setProHighlights(prev=>prev.filter(h=>h.id!==hlEditingId));setShowHlEditor(false);setHlEditingId(null);}}
                  style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.25)',borderRadius:14,padding:'12px 24px',color:'#f87171',fontSize:14,fontWeight:700,cursor:'pointer'}}>
                  🗑️ Удалить хайлайт
                </motion.button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* ═══ МОДАЛ: СВАЙП-МОНЕТЫ ═══ */}
    <AnimatePresence>
      {showReferralModal&&(()=>{
        const invCode=computeInviteCode(userHash,'pro');
        const refLink=`${window.location.origin}/p/${invCode}?ref=${userHash.slice(0,12)}`;
        return(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.88)',zIndex:700,display:'flex',flexDirection:'column',backdropFilter:'blur(12px)'}}
            onClick={()=>setShowReferralModal(false)}>
            <motion.div initial={{y:80,opacity:0}} animate={{y:0,opacity:1}} exit={{y:80,opacity:0}}
              onClick={e=>e.stopPropagation()}
              style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(160deg,#0d0d1a 0%,#10101f 100%)',borderRadius:'24px 24px 0 0',maxHeight:'85vh',display:'flex',flexDirection:'column',border:'1px solid rgba(255,200,0,0.2)',borderBottom:'none',boxShadow:'0 -10px 40px rgba(255,180,0,0.1)'}}>
              <div style={{display:'flex',alignItems:'center',padding:'18px 16px 14px',borderBottom:'1px solid rgba(255,200,0,0.12)'}}>
                <motion.button whileTap={{scale:0.9}} onClick={()=>setShowReferralModal(false)}
                  style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.08)',border:'none',color:'#fff',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',marginRight:12}}>←</motion.button>
                <div style={{flex:1}}>
                  <div style={{fontSize:17,fontWeight:900,color:'#fff'}}>🪙 Свайп-монеты</div>
                  <div style={{fontSize:11,color:'rgba(255,200,0,0.6)',marginTop:1}}>Реферальная программа</div>
                </div>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'20px 16px',display:'flex',flexDirection:'column',gap:16}}>
                {/* Баланс */}
                <div style={{background:'linear-gradient(135deg,rgba(255,180,0,0.12),rgba(255,120,0,0.08))',border:'1.5px solid rgba(255,180,0,0.3)',borderRadius:20,padding:20,display:'flex',alignItems:'center',gap:16}}>
                  <div style={{fontSize:48,lineHeight:1,filter:'drop-shadow(0 0 12px rgba(255,180,0,0.5))'}}>🪙</div>
                  <div>
                    <div style={{fontSize:42,fontWeight:900,color:'#fbbf24',fontFamily:'monospace',lineHeight:1}}>{coinBalance.toLocaleString('ru-RU')}</div>
                    <div style={{fontSize:13,color:'rgba(255,180,0,0.6)',marginTop:4,fontWeight:600}}>Свайп-монет на балансе</div>
                  </div>
                </div>
                {/* Статистика */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                  <div style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,padding:16,textAlign:'center'}}>
                    <div style={{fontSize:28,fontWeight:900,color:'#a5b4fc',lineHeight:1}}>{referralCount}</div>
                    <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:4,lineHeight:1.4}}>Приглашено<br/>пользователей</div>
                  </div>
                  <div style={{background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:16,padding:16,textAlign:'center'}}>
                    <div style={{fontSize:28,fontWeight:900,color:'#fbbf24',lineHeight:1}}>50</div>
                    <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:4,lineHeight:1.4}}>Монет за каждого<br/>приглашённого</div>
                  </div>
                </div>
                {/* Реф-ссылка */}
                <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,200,0,0.15)',borderRadius:16,padding:16}}>
                  <div style={{fontSize:12,fontWeight:700,color:'rgba(255,200,0,0.6)',marginBottom:10,textTransform:'uppercase',letterSpacing:'0.06em'}}>Ваша реферальная ссылка</div>
                  <div style={{fontFamily:'monospace',fontSize:12,color:'rgba(255,255,255,0.7)',background:'rgba(0,0,0,0.3)',borderRadius:10,padding:'10px 14px',marginBottom:10,wordBreak:'break-all'}}>{refLink}</div>
                  <div style={{display:'flex',gap:10}}>
                    <motion.button whileTap={{scale:0.95}} onClick={()=>{navigator.clipboard.writeText(refLink).catch(()=>{});setReferralCopied(true);setTimeout(()=>setReferralCopied(false),2500);}}
                      style={{flex:1,padding:12,background:'rgba(255,200,0,0.12)',border:'1.5px solid rgba(255,200,0,0.3)',borderRadius:12,color:'#fbbf24',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                      {referralCopied?'✓ Скопировано!':'📋 Скопировать'}
                    </motion.button>
                    <motion.button whileTap={{scale:0.95}} onClick={()=>{if(navigator.share){navigator.share({title:'Зарегистрируйся в SWAIP',url:refLink}).catch(()=>{});}else{navigator.clipboard.writeText(refLink).catch(()=>{});}}}
                      style={{flex:1,padding:12,background:'linear-gradient(135deg,rgba(255,200,0,0.2),rgba(255,120,0,0.15))',border:'1.5px solid rgba(255,200,0,0.3)',borderRadius:12,color:'#fbbf24',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                      ↗️ Поделиться
                    </motion.button>
                  </div>
                </div>
                {/* Условия */}
                <div style={{fontSize:12,color:'rgba(255,255,255,0.35)',lineHeight:1.6,textAlign:'center'}}>
                  Приглашайте друзей в SWAIP по вашей ссылке.<br/>
                  За каждого зарегистрированного — 50 Свайп-монет.<br/>
                  Монеты можно использовать для PRO-функций.
                </div>
              </div>
            </motion.div>
          </motion.div>
        );
      })()}
    </AnimatePresence>

    {/* ═══ НИЖНЯЯ НАВИГАЦИЯ ═══ */}
    {(()=>{
      const NAV=[
        {id:'home',   emo:'🏠', label:'Главная',  active:navTab==='home',    fn:()=>setNavTab('home')},
        {id:'msg',    emo:'💬', label:'Чаты',     active:navTab==='messages', fn:()=>setNavTab('messages'), badge:unreadCount},
        {id:'chan',   emo:'📡', label:'Каналы',   active:navTab==='channels', fn:()=>setNavTab('channels')},
        {id:'search', emo:'🔍', label:'Поиск',    active:showSearch,           fn:()=>setShowSearch(v=>!v)},
        {id:'browser',emo:'🌐', label:'Браузер',  active:navTab==='browser',  fn:()=>setNavTab(v=>v==='browser'?'home':'browser')},
      ] as const;
      return(
        <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:430,zIndex:400,
          background:isDark?'rgba(8,8,16,0.95)':'rgba(245,245,250,0.95)',backdropFilter:'blur(20px)',
          borderTop:`1px solid ${isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.08)'}`,
          display:'flex',alignItems:'stretch',padding:'0 0 max(6px,env(safe-area-inset-bottom))'}}>
          {NAV.map(n=>(
            <motion.button key={n.id} whileTap={{scale:0.85}} onClick={n.fn}
              style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'flex-end',gap:3,
                background:'none',border:'none',cursor:'pointer',position:'relative',padding:'10px 4px 8px',
                color:n.active?c.accent:c.sub}}>
              {/* Активный индикатор сверху */}
              {n.active&&(
                <motion.div layoutId="nav_pill"
                  style={{position:'absolute',top:0,left:'50%',transform:'translateX(-50%)',
                    width:32,height:2.5,borderRadius:2,background:c.accent}}/>
              )}
              {/* Бейдж непрочитанных */}
              {'badge' in n && (n.badge as number)>0&&(
                <span style={{position:'absolute',top:6,right:'calc(50% - 18px)',minWidth:16,height:16,borderRadius:8,
                  background:'#ef4444',color:'#fff',fontSize:9,fontWeight:900,
                  display:'flex',alignItems:'center',justifyContent:'center',padding:'0 3px'}}>
                  {(n.badge as number)>99?'99+':(n.badge as number)}
                </span>
              )}
              <span style={{fontSize:21,lineHeight:1,transition:'transform 0.15s',
                transform:n.active?'scale(1.12)':'scale(1)'}}>{n.emo}</span>
              <span style={{fontSize:9,fontWeight:n.active?800:600,letterSpacing:'0.04em',
                textTransform:'uppercase',transition:'all 0.15s'}}>{n.label}</span>
            </motion.button>
          ))}
        </div>
      );
    })()}

    {/* ═══ ОВЕРЛЕЙ ЗВОНКА ═══ */}
    <CallOverlayUI call={call} peerInfo={callPeerInfo} apiBase={apiBase}/>

    {/* ═══ СКРЫТЫЙ INPUT ДЛЯ ПРЕВЬЮ ВИДЖЕТОВ ═══ */}
    <input ref={widgetPreviewRef} type="file" accept="image/*" style={{display:'none'}}
      onChange={async e=>{
        const f=e.target.files?.[0];if(!f||!uploadingWKey)return;
        try{
          const r=await fetch(`${window.location.origin}/api/image-upload`,{method:'POST',headers:{'Content-Type':f.type},body:f});
          if(r.ok){const{url}=await r.json();setWidgetPreviews({...widgetPreviews,[uploadingWKey]:url});}
        }catch{}
        e.target.value='';setUploadingWKey(null);
      }}/>

    {/* ══ МУЗЫКАЛЬНЫЙ ПЛЕЕР (полный шит) ══ */}
    <AnimatePresence>
      {showMusicSheet&&(
        <MusicPlayerSheet
          playlist={playlist}
          musicIdx={musicIdx}
          musicPlaying={musicPlaying}
          musicProgress={musicProgress}
          musicDuration={musicDuration}
          playerStyle={musicPlayerStyle}
          setPlayerStyle={setMusicPlayerStyle}
          onPlay={playTrack}
          onPause={pauseTrack}
          onNext={nextTrack}
          onPrev={prevTrack}
          onSeek={seekTrack}
          onRemove={removeTrack}
          onAddFiles={handleMusicFilePick}
          onClose={()=>setShowMusicSheet(false)}
          c={c}
          accent={activeAccent}
          fileRef={musicFileRef}
          onPickForPost={(t:Track)=>{window.dispatchEvent(new CustomEvent('swaip-track-picked-for-post',{detail:t}));setShowMusicSheet(false);}}
        />
      )}
    </AnimatePresence>

    {/* ══ FLOATING MINI-PLAYER ══ */}
    <AnimatePresence>
      {playlist[musicIdx]&&!showMusicSheet&&(
        <motion.div
          initial={{y:80,opacity:0}} animate={{y:0,opacity:1}} exit={{y:80,opacity:0}}
          transition={{type:'spring',damping:24,stiffness:260}}
          style={{position:'fixed',bottom:72,left:12,right:12,zIndex:2900,
            background:'rgba(10,10,20,0.97)',backdropFilter:'blur(20px)',
            border:`1px solid ${activeAccent}44`,borderRadius:18,
            padding:'10px 14px',boxShadow:`0 4px 32px rgba(0,0,0,0.6),0 0 20px ${activeAccent}33`}}>
          {/* Строка: обложка + инфо + кнопки */}
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:36,height:36,borderRadius:10,background:`linear-gradient(135deg,${activeAccent},#818cf8)`,
              display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0,cursor:'pointer'}}
              onClick={()=>setShowMusicSheet(true)}>🎵</div>
            <div style={{flex:1,minWidth:0,cursor:'pointer'}} onClick={()=>setShowMusicSheet(true)}>
              <div style={{fontSize:13,fontWeight:700,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{playlist[musicIdx].title}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>{playlist[musicIdx].artist||'Неизвестный'}</div>
            </div>
            <button onClick={prevTrack} style={{background:'none',border:'none',color:'rgba(255,255,255,0.55)',fontSize:20,cursor:'pointer',padding:'4px 5px',lineHeight:1}}>⏮</button>
            <button onClick={()=>musicPlaying?pauseTrack():playTrack(musicIdx)}
              style={{width:40,height:40,borderRadius:'50%',background:activeAccent,border:'none',color:'#fff',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:`0 0 12px ${activeAccent}66`}}>
              {musicPlaying?'⏸':'▶'}
            </button>
            <button onClick={nextTrack} style={{background:'none',border:'none',color:'rgba(255,255,255,0.55)',fontSize:20,cursor:'pointer',padding:'4px 5px',lineHeight:1}}>⏭</button>
            <button onClick={()=>{pauseTrack();}} style={{background:'rgba(255,255,255,0.07)',border:'none',color:'rgba(255,255,255,0.4)',fontSize:12,cursor:'pointer',borderRadius:8,padding:'5px 9px',lineHeight:1}}>✕</button>
          </div>
          {/* Прогресс-бар с перемоткой */}
          <div style={{marginTop:8,height:28,display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:9,color:'rgba(255,255,255,0.35)',minWidth:28,textAlign:'right'}}>{Math.floor(musicProgress/60)}:{String(Math.floor(musicProgress%60)).padStart(2,'0')}</span>
            <div
              style={{flex:1,height:4,borderRadius:2,background:'rgba(255,255,255,0.12)',position:'relative',cursor:'pointer',touchAction:'none'}}
              onClick={e=>{const r=(e.currentTarget as HTMLDivElement).getBoundingClientRect();const x=e.clientX-r.left;seekTrack((x/r.width)*musicDuration);}}
              onTouchStart={e=>{e.preventDefault();const r=(e.currentTarget as HTMLDivElement).getBoundingClientRect();const x=e.touches[0].clientX-r.left;seekTrack(Math.max(0,Math.min(1,x/r.width))*musicDuration);}}
              onTouchMove={e=>{e.preventDefault();const r=(e.currentTarget as HTMLDivElement).getBoundingClientRect();const x=e.touches[0].clientX-r.left;seekTrack(Math.max(0,Math.min(1,x/r.width))*musicDuration);}}>
              <div style={{position:'absolute',left:0,top:0,height:'100%',borderRadius:2,background:activeAccent,
                width:`${musicDuration>0?(musicProgress/musicDuration)*100:0}%`,transition:'width 0.1s linear'}}/>
              <div style={{position:'absolute',top:'50%',transform:'translate(-50%,-50%)',width:14,height:14,borderRadius:'50%',
                background:'#fff',boxShadow:`0 0 6px ${activeAccent}`,
                left:`${musicDuration>0?(musicProgress/musicDuration)*100:0}%`,transition:'left 0.1s linear'}}/>
            </div>
            <span style={{fontSize:9,color:'rgba(255,255,255,0.35)',minWidth:28}}>{Math.floor(musicDuration/60)}:{String(Math.floor(musicDuration%60)).padStart(2,'0')}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* ══ ПИКЕР ТРЕКА ДЛЯ ПОСТА ══ */}
    <AnimatePresence>
      {showMusicPicker&&(
        <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
          style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:4500,backdropFilter:'blur(10px)'}}
          onClick={()=>setShowMusicPicker(false)}>
          <motion.div initial={{y:60,opacity:0}} animate={{y:0,opacity:1}} exit={{y:60,opacity:0}}
            style={{position:'absolute',bottom:0,left:0,right:0,maxHeight:'70vh',background:'#0f0f1a',
              borderRadius:'20px 20px 0 0',border:'1px solid rgba(255,255,255,0.1)',overflow:'hidden',display:'flex',flexDirection:'column'}}
            onClick={e=>e.stopPropagation()}>
            <div style={{padding:'14px 16px 10px',borderBottom:'1px solid rgba(255,255,255,0.07)',display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1,fontSize:15,fontWeight:800,color:'#fff'}}>🎵 Выбери трек для поста</div>
              <button onClick={()=>setShowMusicPicker(false)} style={{background:'rgba(255,255,255,0.08)',border:'none',borderRadius:'50%',width:30,height:30,color:'rgba(255,255,255,0.6)',fontSize:15,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
            <div style={{flex:1,overflowY:'auto',padding:'8px 12px 16px'}}>
              {playlist.length===0?<div style={{textAlign:'center',padding:'40px 0',color:'rgba(255,255,255,0.4)',fontSize:13}}>Плейлист пуст — добавь треки в плеере</div>:
                playlist.map((t,i)=>(
                  <motion.div key={t.id} whileTap={{scale:0.97}}
                    onClick={()=>{if(musicPickerCb)musicPickerCb(t);setShowMusicPicker(false);setMusicPickerCb(null);}}
                    style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',marginBottom:4,borderRadius:12,
                      background:i===musicIdx?`${activeAccent}22`:'rgba(255,255,255,0.04)',
                      border:`1px solid ${i===musicIdx?activeAccent+'66':'rgba(255,255,255,0.07)'}`,cursor:'pointer'}}>
                    <div style={{width:34,height:34,borderRadius:8,background:`linear-gradient(135deg,${activeAccent},#818cf8)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,flexShrink:0}}>🎵</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:700,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</div>
                      <div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>{t.artist||'Неизвестный'}</div>
                    </div>
                  </motion.div>
                ))
              }
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>

    </div>
    </div>
    </CallCtx.Provider>
  );
}

function EmptyState({icon,text,sub,c}:{icon:string;text:string;sub?:string;c:Pal}){
  return(
    <div style={{textAlign:'center',color:c.sub,padding:'40px 0'}}>
      <div style={{fontSize:52,marginBottom:12}}>{icon}</div>
      <div style={{fontSize:15,fontWeight:700,color:c.light}}>{text}</div>
      {sub&&<div style={{fontSize:12,marginTop:6}}>{sub}</div>}
    </div>
  );
}


/* ════════════════════════ УТИЛИТЫ ════════════════════════ */
const getSessionToken=()=>{try{return localStorage.getItem('swaip_session');}catch{return null;}};

/* ════════════════════════ РАМКИ СЕЛФИ ════════════════════════ */
const SELFIE_FRAMES=[
  {id:'retro_tv',emoji:'📺',label:'Ретро ТВ'},{id:'modern_tv',emoji:'🖥️',label:'Совр. ТВ'},
  {id:'car_mirror',emoji:'🚗',label:'Автозеркало'},{id:'wall_mirror',emoji:'🪞',label:'Зеркало'},
  {id:'microwave',emoji:'📡',label:'Микроволн.'},{id:'apt_window',emoji:'🏢',label:'Окно квартиры'},
  {id:'village_window',emoji:'🏡',label:'Деревня'},{id:'camcorder',emoji:'🎥',label:'Камкордер'},
  {id:'dslr',emoji:'📷',label:'Фотокамера'},{id:'phone',emoji:'📱',label:'Телефон'},
  {id:'monitor',emoji:'🖥️',label:'Монитор'},{id:'laptop',emoji:'💻',label:'Ноутбук'},
];

/* ════ АУДИО ПЛЕЕР С АНИМАЦИЕЙ ════ */
function AudioWavePlayer({src,accent='#a855f7'}:{src:string;accent?:string}){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const analyserRef=useRef<AnalyserNode|null>(null);
  const actxRef=useRef<AudioContext|null>(null);
  const rafRef=useRef<number>(0);
  const playingRef=useRef(false);
  const phaseRef=useRef({walk:0,flag:0,exiting:false,exitStart:0,charX:0.12,opacity:1.0});
  const [playing,setPlaying]=useState(false);
  const [curT,setCurT]=useState(0);
  const [dur,setDur]=useState(0);
  const [errored,setErrored]=useState(false);

  useEffect(()=>{
    const a=new Audio();
    a.src=src;
    a.crossOrigin='anonymous';
    a.preload='metadata';
    a.onloadedmetadata=()=>{if(isFinite(a.duration))setDur(a.duration);};
    a.ontimeupdate=()=>setCurT(a.currentTime);
    a.onended=()=>{
      setPlaying(false);playingRef.current=false;
      const p=phaseRef.current;
      p.exiting=true;p.exitStart=Date.now();
    };
    a.onerror=()=>setErrored(true);
    audioRef.current=a;
    return()=>{cancelAnimationFrame(rafRef.current);a.pause();a.src='';actxRef.current?.close();};
  },[src]);

  useEffect(()=>{
    const canvas=canvasRef.current;
    if(!canvas)return;
    const ctx=canvas.getContext('2d')!;
    const W=canvas.width,H=canvas.height;
    const freqBuf=new Uint8Array(256);

    const getY=(x:number,amp:number,scroll:number,midY:number)=>{
      if(amp<0.03)return midY+Math.sin(x/55+Date.now()/2200)*2.5;
      const tx=(x+scroll)/W;
      const cycle=(tx*2.8)%1;
      if(cycle<0.07)return midY-Math.sin(cycle/0.07*Math.PI)*amp*H*0.07;
      if(cycle>=0.26&&cycle<0.30)return midY+amp*H*0.10;
      if(cycle>=0.30&&cycle<0.36){const t=(cycle-0.30)/0.06;return midY-Math.sin(t*Math.PI)*amp*H*0.52;}
      if(cycle>=0.36&&cycle<0.40)return midY+amp*H*0.08;
      if(cycle>=0.47&&cycle<0.64)return midY-Math.sin((cycle-0.47)/0.17*Math.PI)*amp*H*0.13;
      return midY;
    };

    const drawWave=(amp:number,now:number,midY:number)=>{
      const scroll=(now/1000*85)%(W*2);
      ctx.beginPath();
      for(let x=0;x<=W;x++){const y=getY(x,amp,scroll,midY);x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}
      ctx.shadowBlur=amp>0.06?14:4;ctx.shadowColor=accent;
      ctx.strokeStyle=accent;ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke();ctx.shadowBlur=0;
      ctx.beginPath();
      for(let x=0;x<=W;x++){const y=getY(x,amp,scroll,midY);x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}
      ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();
      const g=ctx.createLinearGradient(0,midY-H*0.4,0,H);
      g.addColorStop(0,accent+'3a');g.addColorStop(1,accent+'00');
      ctx.fillStyle=g;ctx.fill();
    };

    const drawChar=(cx:number,baseY:number,ph:number,fp:number)=>{
      ctx.lineCap='round';ctx.lineJoin='round';
      ctx.beginPath();ctx.ellipse(cx,baseY+3,10,3,0,0,Math.PI*2);
      ctx.fillStyle='rgba(0,0,0,0.18)';ctx.fill();
      const l1=Math.sin(ph)*7,l2=Math.sin(ph+Math.PI)*7;
      ctx.lineWidth=2.5;
      ctx.beginPath();ctx.moveTo(cx,baseY-8);ctx.lineTo(cx+l1*0.5,baseY+2);ctx.strokeStyle='#fbbf24';ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx,baseY-8);ctx.lineTo(cx+l2*0.5,baseY+2);ctx.strokeStyle='#f59e0b';ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx,baseY-8);ctx.lineTo(cx,baseY-22);ctx.lineWidth=3;ctx.strokeStyle=accent;ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx,baseY-18);ctx.lineTo(cx-8+Math.sin(ph+Math.PI)*2,baseY-24+Math.cos(ph)*2);ctx.lineWidth=2;ctx.strokeStyle='#fbbf24';ctx.stroke();
      const faX=cx+10,faY=baseY-26;
      ctx.beginPath();ctx.moveTo(cx,baseY-18);ctx.lineTo(faX,faY);ctx.strokeStyle='#fbbf24';ctx.stroke();
      // Флагшток — высокий
      ctx.beginPath();ctx.moveTo(faX,faY);ctx.lineTo(faX+1,faY-30);ctx.lineWidth=1.5;ctx.strokeStyle='#e5e7eb';ctx.stroke();
      // Полотно флага — широкое, развевается
      const fw=Math.sin(fp)*7;
      const stx=faX+1,sty=faY-30;
      ctx.beginPath();
      ctx.moveTo(stx,sty);
      ctx.quadraticCurveTo(stx+18+fw*0.7,sty+1+fw*0.2,stx+36+fw,sty+fw*0.5);
      ctx.lineTo(stx+36+fw*0.8,sty+15+fw*0.3);
      ctx.quadraticCurveTo(stx+18+fw*0.5,sty+16,stx,sty+14);
      ctx.closePath();
      const fg=ctx.createLinearGradient(stx,sty,stx+36,sty+15);
      fg.addColorStop(0,'#5b21b6');fg.addColorStop(0.5,'#7c3aed');fg.addColorStop(1,'#a855f7');
      ctx.fillStyle=fg;ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,0.2)';ctx.lineWidth=0.5;ctx.stroke();
      // Надпись SWAIP
      ctx.save();
      ctx.fillStyle='#fff';
      ctx.font='bold 7.5px Arial';
      ctx.textAlign='center';
      ctx.shadowBlur=3;ctx.shadowColor='rgba(0,0,0,0.6)';
      ctx.fillText('SWAIP',stx+18+fw*0.35,sty+10);
      ctx.restore();
      ctx.textAlign='start';
      ctx.beginPath();ctx.arc(cx,baseY-29,7,0,Math.PI*2);ctx.fillStyle='#fcd34d';ctx.fill();
      ctx.lineWidth=1.5;ctx.strokeStyle='#d97706';ctx.stroke();
      ctx.fillStyle='#1f2937';
      ctx.beginPath();ctx.arc(cx-2.5,baseY-30,1.3,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(cx+2.5,baseY-30,1.3,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.arc(cx,baseY-27,3,0.3,Math.PI-0.3);ctx.lineWidth=1;ctx.strokeStyle='#92400e';ctx.stroke();
    };

    const loop=()=>{
      rafRef.current=requestAnimationFrame(loop);
      ctx.clearRect(0,0,W,H);
      let amp=0;
      if(analyserRef.current&&playingRef.current){
        analyserRef.current.getByteFrequencyData(freqBuf);
        for(let i=0;i<48;i++)amp+=freqBuf[i];
        amp=amp/48/255;
      }
      const now=Date.now();
      const midY=H*0.68;
      drawWave(amp,now,midY);
      const p=phaseRef.current;
      if(playingRef.current||p.exiting){p.walk+=0.22;p.flag+=0.14;}
      else p.flag+=0.05;
      if(p.exiting){
        const el=(Date.now()-p.exitStart)/1000;
        p.charX=0.12+el*0.20;
        p.opacity=Math.max(0,1-Math.max(0,el-1.2)/0.9);
      }
      const cx=p.charX*W;
      if(p.opacity>0&&cx<W+45){
        ctx.save();ctx.globalAlpha=p.opacity;
        drawChar(cx,midY,p.walk,p.flag);
        ctx.restore();
      }
    };
    loop();
    return()=>cancelAnimationFrame(rafRef.current);
  },[accent]);

  const setupAudio=()=>{
    if(analyserRef.current)return;
    const a=audioRef.current;if(!a)return;
    try{
      const actx=new (window.AudioContext||((window as any).webkitAudioContext))();
      const analyser=actx.createAnalyser();analyser.fftSize=512;analyser.smoothingTimeConstant=0.78;
      const src2=actx.createMediaElementSource(a);
      src2.connect(analyser);analyser.connect(actx.destination);
      actxRef.current=actx;analyserRef.current=analyser;
    }catch{}
  };

  const togglePlay=async()=>{
    const a=audioRef.current;if(!a||errored)return;
    setupAudio();
    if(actxRef.current?.state==='suspended')await actxRef.current.resume();
    if(playing){a.pause();setPlaying(false);playingRef.current=false;}
    else{
      try{
        await a.play();setPlaying(true);playingRef.current=true;
        const p=phaseRef.current;
        if(p.exiting){p.exiting=false;p.charX=0.12;p.opacity=1;}
      }catch{setErrored(true);}
    }
  };

  const seek=(e:React.MouseEvent<HTMLDivElement>)=>{
    const a=audioRef.current;if(!a||!dur)return;
    const r=e.currentTarget.getBoundingClientRect();
    const t=((e.clientX-r.left)/r.width)*dur;
    a.currentTime=t;setCurT(t);
  };

  const fmt=(s:number)=>isFinite(s)&&!isNaN(s)?`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`:'--:--';

  if(errored)return<div style={{padding:'8px 12px',display:'flex',alignItems:'center',gap:6,color:'#f87171',fontSize:12}}><span>⚠️</span><span>Аудио недоступно</span></div>;

  return(
    <div style={{borderRadius:12,overflow:'hidden',background:'rgba(0,0,0,0.28)',border:`1px solid ${accent}35`,margin:'4px 0'}}>
      <canvas ref={canvasRef} width={360} height={110} style={{width:'100%',height:'auto',display:'block'}}/>
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'5px 10px 7px'}}>
        <button onClick={togglePlay} style={{width:30,height:30,borderRadius:'50%',border:`1.5px solid ${accent}`,background:`${accent}22`,color:accent,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontFamily:'sans-serif'}}>
          {playing?'⏸':'▶'}
        </button>
        <div style={{flex:1,cursor:'pointer',padding:'6px 0'}} onClick={seek}>
          <div style={{height:4,background:'rgba(255,255,255,0.12)',borderRadius:4,overflow:'hidden'}}>
            <div style={{width:`${dur?curT/dur*100:0}%`,height:'100%',background:accent,borderRadius:4,transition:'width 0.15s linear'}}/>
          </div>
        </div>
        <span style={{fontSize:10,color:'rgba(255,255,255,0.45)',flexShrink:0,minWidth:72,textAlign:'right',fontFamily:'monospace'}}>
          {fmt(curT)} / {fmt(dur)}
        </span>
      </div>
    </div>
  );
}

function SelfieFrameWrapper({frameId,children}:{frameId:string;children:React.ReactNode}){
  /* Упрощённая обёртка — просто рамка поверх видео в абсолютном позиционировании */
  const frames:Record<string,{fw:number;fh:number;sx:number;sy:number;sw:number;sh:number;br?:string}> = {
    retro_tv:    {fw:300,fh:420,sx:22, sy:22, sw:220,sh:275},
    modern_tv:   {fw:300,fh:350,sx:6,  sy:6,  sw:288,sh:314},
    car_mirror:  {fw:320,fh:200,sx:48, sy:30, sw:224,sh:116,br:'50%'},
    wall_mirror: {fw:280,fh:440,sx:46, sy:52, sw:188,sh:330},
    microwave:   {fw:300,fh:360,sx:20, sy:64, sw:183,sh:200},
    apt_window:  {fw:300,fh:420,sx:26, sy:56, sw:110,sh:310},
    village_window:{fw:300,fh:460,sx:42,sy:80,sw:106,sh:256},
    camcorder:   {fw:320,fh:240,sx:213,sy:54, sw:98, sh:128},
    dslr:        {fw:320,fh:240,sx:212,sy:54, sw:98, sh:120},
    phone:       {fw:280,fh:520,sx:16, sy:16, sw:248,sh:468},
    monitor:     {fw:300,fh:370,sx:18, sy:14, sw:264,sh:280},
    laptop:      {fw:360,fh:440,sx:18, sy:16, sw:324,sh:208},
  };
  const f=frames[frameId]||frames.phone;
  const scale=Math.min(1,(window.innerWidth-32)/f.fw);
  const W=Math.round(f.fw*scale),H=Math.round(f.fh*scale);
  const sx=Math.round(f.sx*scale),sy=Math.round(f.sy*scale);
  const sw=Math.round(f.sw*scale),sh=Math.round(f.sh*scale);
  return(
    <div style={{position:'relative',width:W,height:H,flexShrink:0,background:'#111',borderRadius:12,overflow:'hidden'}}>
      <div style={{position:'absolute',left:sx,top:sy,width:sw,height:sh,overflow:'hidden',borderRadius:f.br||8,background:'#000'}}>{children}</div>
      <div style={{position:'absolute',inset:0,pointerEvents:'none',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <span style={{position:'absolute',bottom:8,left:'50%',transform:'translateX(-50%)',fontSize:9,fontWeight:900,letterSpacing:'0.2em',color:'rgba(255,255,255,0.3)',textTransform:'uppercase'}}>SWAIP</span>
      </div>
    </div>
  );
}

/* ════════════════════════ МУЗЫКАЛЬНЫЙ ПЛЕЕР ════════════════════════ */
function fmtDur(s:number):string{if(!s||!isFinite(s))return'0:00';const m=Math.floor(s/60);const ss=Math.floor(s%60);return`${m}:${ss<10?'0':''}${ss}`;}

function MusicPlayerSheet({
  playlist,musicIdx,musicPlaying,musicProgress,musicDuration,
  playerStyle,setPlayerStyle,
  onPlay,onPause,onNext,onPrev,onSeek,onRemove,
  onAddFiles,onClose,c,accent,fileRef,
  onPickForPost,
}:{
  playlist:Track[];musicIdx:number;musicPlaying:boolean;musicProgress:number;musicDuration:number;
  playerStyle:number;setPlayerStyle:(n:number)=>void;
  onPlay:(i:number)=>void;onPause:()=>void;onNext:()=>void;onPrev:()=>void;
  onSeek:(t:number)=>void;onRemove:(id:string)=>void;onAddFiles:(f:FileList|null)=>void;
  onClose:()=>void;c:Pal;accent:string;fileRef:React.RefObject<HTMLInputElement|null>;
  onPickForPost?:((t:Track)=>void)|null;
}){
  const [uploading,setUploading]=useState(false);
  const [editId,setEditId]=useState<string|null>(null);
  const [editTitle,setEditTitle]=useState('');
  const [editArtist,setEditArtist]=useState('');
  const [urlInput,setUrlInput]=useState('');
  const [showUrlInput,setShowUrlInput]=useState(false);
  const cur=playlist[musicIdx]||null;
  const pct=musicDuration>0?(musicProgress/musicDuration)*100:0;

  const STYLES=[
    {n:'Classic',ico:'🎵'},
    {n:'Vinyl',ico:'💿'},
    {n:'Neon',ico:'🌙'},
    {n:'Wave',ico:'〰️'},
    {n:'Minimal',ico:'⬜'},
  ];

  const handleFileChange=async(e:React.ChangeEvent<HTMLInputElement>)=>{
    setUploading(true);
    await onAddFiles(e.target.files);
    setUploading(false);
  };

  const addFromUrl=()=>{
    const u=urlInput.trim();
    if(!u)return;
    const title=u.split('/').pop()?.replace(/\?.*$/,'').replace(/\.[^.]+$/,'')||'Трек';
    onAddFiles(null);
    const t:Track={id:`tr_url_${Date.now()}`,title,artist:'',url:u};
    const ev=new CustomEvent('swaip-add-tracks',{detail:[t]});
    window.dispatchEvent(ev);
    setUrlInput('');setShowUrlInput(false);
  };

  const bg1='#0f0f1a';
  const bg2='#13131f';
  const safeAccent=(typeof accent==='string'&&accent.startsWith('#')&&accent.length>=7)?accent:'#a855f7';
  accent=safeAccent;
  const accentRgb=safeAccent.replace('#','').match(/.{2}/g)?.map(x=>parseInt(x,16)).join(',')||'168,85,247';
  const glowStyle=(active:boolean)=>active?`0 0 18px ${safeAccent}99`:'none';

  const TrackRow=({t,i}:{t:Track;i:number})=>{
    const active=i===musicIdx;
    const playing=active&&musicPlaying;
    if(editId===t.id)return(
      <div style={{padding:'8px 12px',background:'rgba(99,102,241,0.1)',border:'1px solid rgba(99,102,241,0.3)',borderRadius:12,marginBottom:6}}>
        <input value={editTitle} onChange={e=>setEditTitle(e.target.value)} placeholder="Название" style={{width:'100%',boxSizing:'border-box',marginBottom:6,padding:'6px 10px',borderRadius:8,border:'1px solid rgba(99,102,241,0.3)',background:'rgba(255,255,255,0.06)',color:'#fff',fontSize:13,outline:'none',fontFamily:'"Montserrat",sans-serif'}}/>
        <input value={editArtist} onChange={e=>setEditArtist(e.target.value)} placeholder="Исполнитель" style={{width:'100%',boxSizing:'border-box',marginBottom:8,padding:'6px 10px',borderRadius:8,border:'1px solid rgba(99,102,241,0.3)',background:'rgba(255,255,255,0.06)',color:'#fff',fontSize:12,outline:'none',fontFamily:'"Montserrat",sans-serif'}}/>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>{
            const ev=new CustomEvent('swaip-edit-track',{detail:{id:t.id,title:editTitle,artist:editArtist}});
            window.dispatchEvent(ev);setEditId(null);
          }} style={{flex:1,padding:'7px',borderRadius:8,background:accent,border:'none',color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>✅ Сохранить</button>
          <button onClick={()=>setEditId(null)} style={{padding:'7px 12px',borderRadius:8,background:'rgba(255,255,255,0.08)',border:'none',color:'rgba(255,255,255,0.5)',fontSize:12,cursor:'pointer'}}>Отмена</button>
        </div>
      </div>
    );

    if(playerStyle===1)return(
      <motion.div key={t.id} whileTap={{scale:0.98}}
        style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',marginBottom:4,
          borderRadius:12,background:active?`rgba(${accentRgb},0.12)`:'rgba(255,255,255,0.04)',
          border:`1px solid ${active?accent+'66':'rgba(255,255,255,0.06)'}`,cursor:'pointer',transition:'all 0.2s',
          boxShadow:glowStyle(active)}}>
        <div onClick={()=>playing?onPause():onPlay(i)}
          style={{width:36,height:36,borderRadius:'50%',background:active?accent:'rgba(255,255,255,0.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,cursor:'pointer',fontSize:15}}>
          {playing?'⏸':'▶️'}
        </div>
        <div style={{flex:1,minWidth:0}} onClick={()=>playing?onPause():onPlay(i)}>
          <div style={{fontSize:13,fontWeight:700,color:active?'#fff':'rgba(255,255,255,0.85)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title||'Без названия'}</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:1}}>{t.artist||'Неизвестный исполнитель'}</div>
        </div>
        {onPickForPost&&<button onClick={()=>onPickForPost(t)} style={{padding:'4px 8px',borderRadius:8,background:'rgba(99,102,241,0.15)',border:'1px solid rgba(99,102,241,0.3)',color:'#a5b4fc',fontSize:10,fontWeight:700,cursor:'pointer',flexShrink:0}}>📎</button>}
        <button onClick={()=>{setEditId(t.id);setEditTitle(t.title);setEditArtist(t.artist);}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.3)',fontSize:14,cursor:'pointer',padding:'0 4px',flexShrink:0}}>✏️</button>
        <button onClick={()=>onRemove(t.id)} style={{background:'none',border:'none',color:'rgba(255,59,59,0.5)',fontSize:16,cursor:'pointer',padding:'0 4px',flexShrink:0}}>✕</button>
      </motion.div>
    );

    if(playerStyle===2)return(
      <motion.div whileTap={{scale:0.97}} onClick={()=>playing?onPause():onPlay(i)}
        style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',marginBottom:6,
          borderRadius:16,background:active?'rgba(255,255,255,0.06)':'transparent',
          border:`1.5px solid ${active?'rgba(255,255,255,0.2)':'rgba(255,255,255,0.05)'}`,cursor:'pointer'}}>
        <div style={{width:48,height:48,borderRadius:'50%',background:`conic-gradient(${accent} ${pct}%, transparent ${pct}%)`,
          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,
          boxShadow:active?`0 0 20px ${accent}55`:'none',
          animation:playing?'spin 4s linear infinite':'none'}}>
          <div style={{width:36,height:36,borderRadius:'50%',background:bg1,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>
            {playing?'⏸':'▶'}
          </div>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:14,fontWeight:800,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title||'Без названия'}</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>{t.artist||'Неизвестный'}</div>
        </div>
        {onPickForPost&&<button onClick={e=>{e.stopPropagation();onPickForPost(t);}} style={{padding:'4px 8px',borderRadius:8,background:'rgba(99,102,241,0.15)',border:'1px solid rgba(99,102,241,0.3)',color:'#a5b4fc',fontSize:10,fontWeight:700,cursor:'pointer'}}>📎</button>}
        <button onClick={e=>{e.stopPropagation();onRemove(t.id);}} style={{background:'none',border:'none',color:'rgba(255,60,60,0.4)',fontSize:15,cursor:'pointer'}}>✕</button>
      </motion.div>
    );

    if(playerStyle===3)return(
      <motion.div whileTap={{scale:0.97}} onClick={()=>playing?onPause():onPlay(i)}
        style={{display:'flex',alignItems:'center',gap:10,padding:'9px 14px',marginBottom:3,
          borderRadius:0,borderBottom:'1px solid rgba(255,255,255,0.06)',cursor:'pointer',
          background:active?`linear-gradient(90deg,${accent}22,transparent)`:'transparent'}}>
        <div style={{fontSize:11,color:'rgba(255,255,255,0.25)',width:22,textAlign:'center',fontWeight:700,flexShrink:0}}>{i+1}</div>
        <div style={{width:3,height:32,borderRadius:2,background:active?accent:'rgba(255,255,255,0.1)',flexShrink:0,transition:'all 0.3s'}}/>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:active?800:600,color:active?'#fff':'rgba(255,255,255,0.7)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title||'Без названия'}</div>
          <div style={{fontSize:10,color:'rgba(255,255,255,0.35)'}}>{t.artist||'—'}</div>
        </div>
        <div style={{fontSize:16,color:active?accent:'rgba(255,255,255,0.15)',flexShrink:0}}>{playing?'♬':'♩'}</div>
        {onPickForPost&&<button onClick={e=>{e.stopPropagation();onPickForPost(t);}} style={{padding:'3px 7px',borderRadius:6,background:'rgba(99,102,241,0.15)',border:'1px solid rgba(99,102,241,0.3)',color:'#a5b4fc',fontSize:10,fontWeight:700,cursor:'pointer'}}>📎</button>}
        <button onClick={e=>{e.stopPropagation();onRemove(t.id);}} style={{background:'none',border:'none',color:'rgba(255,60,60,0.4)',fontSize:14,cursor:'pointer'}}>✕</button>
      </motion.div>
    );

    if(playerStyle===4)return(
      <motion.div whileTap={{scale:0.98}} onClick={()=>playing?onPause():onPlay(i)}
        style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',marginBottom:5,
          borderRadius:14,
          background:active?'rgba(0,0,0,0.5)':'rgba(255,255,255,0.02)',
          border:`1px solid ${active?accent:'rgba(255,255,255,0.06)'}`,
          boxShadow:active?`0 0 24px ${accent}44,inset 0 0 12px ${accent}11`:'none',
          cursor:'pointer',transition:'all 0.3s'}}>
        <div style={{width:38,height:38,borderRadius:10,background:active?`linear-gradient(135deg,${accent},#818cf8)`:'rgba(255,255,255,0.08)',
          display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>
          {playing?'⏸':'▶'}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:active?'#fff':'rgba(255,255,255,0.7)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',
            textShadow:active?`0 0 10px ${accent}88`:'none'}}>{t.title||'Без названия'}</div>
          <div style={{fontSize:10,color:active?`${accent}cc`:'rgba(255,255,255,0.35)'}}>{t.artist||'Неизвестный'}</div>
        </div>
        {onPickForPost&&<button onClick={e=>{e.stopPropagation();onPickForPost(t);}} style={{padding:'4px 8px',borderRadius:8,background:'rgba(99,102,241,0.15)',border:'1px solid rgba(99,102,241,0.3)',color:'#a5b4fc',fontSize:10,fontWeight:700,cursor:'pointer'}}>📎</button>}
        <button onClick={e=>{e.stopPropagation();onRemove(t.id);}} style={{background:'none',border:'none',color:'rgba(255,60,60,0.4)',fontSize:15,cursor:'pointer'}}>✕</button>
      </motion.div>
    );

    return(
      <motion.div whileTap={{scale:0.98}} onClick={()=>playing?onPause():onPlay(i)}
        style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,0.05)',cursor:'pointer'}}>
        <span style={{fontSize:10,color:'rgba(255,255,255,0.2)',minWidth:18,textAlign:'center'}}>{i+1}</span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:12,fontWeight:active?700:500,color:active?'#fff':'rgba(255,255,255,0.6)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title||'Без названия'}</div>
          {t.artist&&<div style={{fontSize:10,color:'rgba(255,255,255,0.3)'}}>{t.artist}</div>}
        </div>
        {active&&<span style={{fontSize:11,color:accent}}>{playing?'▶':'⏸'}</span>}
        {onPickForPost&&<button onClick={e=>{e.stopPropagation();onPickForPost(t);}} style={{padding:'3px 7px',borderRadius:6,background:'rgba(99,102,241,0.12)',border:'1px solid rgba(99,102,241,0.25)',color:'#a5b4fc',fontSize:10,cursor:'pointer'}}>📎</button>}
        <button onClick={e=>{e.stopPropagation();onRemove(t.id);}} style={{background:'none',border:'none',color:'rgba(255,60,60,0.35)',fontSize:14,cursor:'pointer'}}>✕</button>
      </motion.div>
    );
  };

  return(
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',zIndex:3500,backdropFilter:'blur(12px)'}}>
      <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',damping:28,stiffness:280}}
        style={{position:'absolute',bottom:0,left:0,right:0,maxHeight:'92vh',display:'flex',flexDirection:'column',
          background:bg1,borderRadius:'24px 24px 0 0',overflow:'hidden',boxShadow:'0 -8px 60px rgba(0,0,0,0.6)'}}>

        {/* Шапка */}
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'16px 16px 12px',borderBottom:'1px solid rgba(255,255,255,0.07)',flexShrink:0}}>
          <div style={{flex:1}}>
            <div style={{fontSize:17,fontWeight:900,color:'#fff',fontFamily:'"Montserrat",sans-serif'}}>🎵 Музыкальный плеер</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.35)',marginTop:1}}>{playlist.length} треков в плейлисте</div>
          </div>
          <button onClick={onClose} style={{width:34,height:34,borderRadius:'50%',background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.12)',color:'rgba(255,255,255,0.6)',fontSize:17,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
        </div>

        {/* Выбор стиля */}
        <div style={{display:'flex',gap:6,padding:'10px 16px 8px',overflowX:'auto',scrollbarWidth:'none',flexShrink:0}}>
          {STYLES.map((s,i)=>(
            <button key={i} onClick={()=>{setPlayerStyle(i+1);localStorage.setItem('swaip_music_style',String(i+1));}}
              style={{padding:'5px 12px',borderRadius:20,border:`1.5px solid ${playerStyle===i+1?accent:'rgba(255,255,255,0.1)'}`,
                background:playerStyle===i+1?`${accent}22`:'rgba(255,255,255,0.04)',
                color:playerStyle===i+1?accent:'rgba(255,255,255,0.5)',
                fontSize:11,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',fontFamily:'"Montserrat",sans-serif',flexShrink:0}}>
              {s.ico} {s.n}
            </button>
          ))}
        </div>

        {/* Большой плеер (текущий трек) */}
        {cur&&(
          <div style={{padding:'12px 16px',background:playerStyle===3?`linear-gradient(135deg,${bg2},#0a0a14)`:playerStyle===4?`radial-gradient(ellipse at 50% 0%,${accent}22,${bg2})`:'rgba(255,255,255,0.02)',flexShrink:0,borderBottom:'1px solid rgba(255,255,255,0.06)'}}>
            {playerStyle===2?(
              <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:8}}>
                <div style={{width:90,height:90,borderRadius:'50%',
                  background:`conic-gradient(${accent} ${pct}%, rgba(255,255,255,0.08) ${pct}%)`,
                  display:'flex',alignItems:'center',justifyContent:'center',
                  boxShadow:`0 0 30px ${accent}66`,animation:musicPlaying?'spin 6s linear infinite':'none'}}>
                  <div style={{width:70,height:70,borderRadius:'50%',background:bg1,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>🎵</div>
                </div>
                <div style={{textAlign:'center'}}>
                  <div style={{fontSize:16,fontWeight:900,color:'#fff'}}>{cur.title}</div>
                  <div style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>{cur.artist||'Неизвестный'}</div>
                </div>
              </div>
            ):(
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div style={{width:52,height:52,borderRadius:playerStyle===1?'50%':14,
                  background:`linear-gradient(135deg,${accent}66,#818cf8aa)`,
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0,
                  boxShadow:musicPlaying?`0 0 20px ${accent}88`:'none'}}>🎵</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:800,color:'#fff',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{cur.title}</div>
                  <div style={{fontSize:12,color:'rgba(255,255,255,0.45)'}}>{cur.artist||'Неизвестный исполнитель'}</div>
                </div>
              </div>
            )}
            {/* Прогресс */}
            <div style={{marginTop:12}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                <span style={{fontSize:10,color:'rgba(255,255,255,0.35)'}}>{fmtDur(musicProgress)}</span>
                <span style={{fontSize:10,color:'rgba(255,255,255,0.35)'}}>{fmtDur(musicDuration)}</span>
              </div>
              <div style={{height:4,borderRadius:2,background:'rgba(255,255,255,0.12)',cursor:'pointer',position:'relative'}}
                onClick={e=>{const r=(e.currentTarget as HTMLDivElement).getBoundingClientRect();const x=e.clientX-r.left;onSeek((x/r.width)*musicDuration);}}>
                <div style={{position:'absolute',left:0,top:0,height:'100%',borderRadius:2,background:accent,width:`${pct}%`,transition:'width 0.1s linear'}}/>
                <div style={{position:'absolute',top:'50%',transform:'translate(-50%,-50%)',width:12,height:12,borderRadius:'50%',background:'#fff',boxShadow:`0 0 6px ${accent}`,left:`${pct}%`,transition:'left 0.1s linear'}}/>
              </div>
            </div>
            {/* Управление */}
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:20,marginTop:12}}>
              <button onClick={onPrev} style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',fontSize:22,cursor:'pointer'}}>⏮</button>
              <button onClick={()=>musicPlaying?onPause():onPlay(musicIdx>=0?musicIdx:0)}
                style={{width:52,height:52,borderRadius:'50%',background:accent,border:'none',color:'#fff',fontSize:22,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 0 20px ${accent}88`}}>
                {musicPlaying?'⏸':'▶'}
              </button>
              <button onClick={onNext} style={{background:'none',border:'none',color:'rgba(255,255,255,0.5)',fontSize:22,cursor:'pointer'}}>⏭</button>
            </div>
          </div>
        )}

        {/* Список треков */}
        <div style={{flex:1,overflowY:'auto',padding:playerStyle===5?'8px 16px':'8px 12px',paddingBottom:16}}>
          {playlist.length===0?(
            <div style={{textAlign:'center',paddingTop:40}}>
              <div style={{fontSize:52,marginBottom:12}}>🎧</div>
              <div style={{fontSize:15,fontWeight:800,color:'rgba(255,255,255,0.6)',marginBottom:6}}>Плейлист пуст</div>
              <div style={{fontSize:12,color:'rgba(255,255,255,0.3)'}}>Добавь треки — и они всегда будут под рукой</div>
            </div>
          ):(
            playlist.map((t,i)=><React.Fragment key={t.id}>{TrackRow({t,i})}</React.Fragment>)
          )}
        </div>

        {/* Футер: добавить треки */}
        <div style={{padding:'10px 12px',borderTop:'1px solid rgba(255,255,255,0.07)',flexShrink:0,display:'flex',gap:8,flexWrap:'wrap'}}>
          <motion.button whileTap={{scale:0.95}} onClick={()=>fileRef.current?.click()}
            style={{flex:1,padding:'11px',borderRadius:12,background:`linear-gradient(135deg,${accent},#818cf8)`,border:'none',color:'#fff',fontWeight:800,fontSize:13,cursor:'pointer',fontFamily:'"Montserrat",sans-serif'}}>
            {uploading?'⏳ Загружаю...':'+ Добавить треки'}
          </motion.button>
          <motion.button whileTap={{scale:0.95}} onClick={()=>setShowUrlInput(s=>!s)}
            style={{padding:'11px 16px',borderRadius:12,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.1)',color:'rgba(255,255,255,0.6)',fontWeight:700,fontSize:12,cursor:'pointer'}}>
            🔗 URL
          </motion.button>
        </div>
        {showUrlInput&&(
          <div style={{padding:'0 12px 12px',flexShrink:0,display:'flex',gap:8}}>
            <input value={urlInput} onChange={e=>setUrlInput(e.target.value)} placeholder="https://... ссылка на аудио"
              style={{flex:1,padding:'9px 12px',borderRadius:10,border:'1px solid rgba(99,102,241,0.3)',background:'rgba(255,255,255,0.06)',color:'#fff',fontSize:13,outline:'none',fontFamily:'"Montserrat",sans-serif'}}/>
            <button onClick={addFromUrl} style={{padding:'9px 14px',borderRadius:10,background:accent,border:'none',color:'#fff',fontWeight:700,fontSize:13,cursor:'pointer'}}>ОК</button>
          </div>
        )}
      </motion.div>
      <input ref={fileRef} type="file" accept="audio/*" multiple style={{display:'none'}} onChange={handleFileChange}/>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </motion.div>
  );
}

/* ════════════════════════ ПОЛНЫЙ COMPOSER ПОСТА ════════════════════════ */
function PostComposerFull({authorMode,onPostCreated,avatarUrl='',c,accent='#a855f7',onPickFromPlaylist}:{authorMode:string;onPostCreated:(p:any)=>void;avatarUrl?:string;c:Pal;accent?:string;onPickFromPlaylist?:()=>void;}){
  type DocAtt={url:string;name:string;size:number;mime:string};
  const [open,setOpen]=useState(false);
  const [text,setText]=useState('');
  const [submitting,setSubmitting]=useState(false);
  const [contentError,setContentError]=useState('');
  /* Голос */
  const [voiceRec,setVoiceRec]=useState(false);
  const [voiceBlob,setVoiceBlob]=useState<Blob|null>(null);
  const [voiceUrl,setVoiceUrl]=useState<string|null>(null);
  const [voiceSending,setVoiceSending]=useState(false);
  const voiceRecRef=useRef<MediaRecorder|null>(null);
  /* Фото */
  const [imgFile,setImgFile]=useState<File|null>(null);
  const [imgPrev,setImgPrev]=useState<string|null>(null);
  const [imgLoading,setImgLoading]=useState(false);
  const imgRef=useRef<HTMLInputElement|null>(null);
  /* Видео */
  const [vidFile,setVidFile]=useState<File|null>(null);
  const [vidPrev,setVidPrev]=useState<string|null>(null);
  const [vidLoading,setVidLoading]=useState(false);
  const [vidProgress,setVidProgress]=useState(0);
  const vidRef=useRef<HTMLInputElement|null>(null);
  /* Документы */
  const [docFiles,setDocFiles]=useState<File[]>([]);
  const [docLoading,setDocLoading]=useState(false);
  const docRef=useRef<HTMLInputElement|null>(null);
  /* Музыка */
  const [musicFile,setMusicFile]=useState<File|null>(null);
  const [musicName,setMusicName]=useState('');
  const [musicLoading,setMusicLoading]=useState(false);
  const [musicError,setMusicError]=useState<string|null>(null);
  const musicRef=useRef<HTMLInputElement|null>(null);
  /* Трек из плейлиста */
  const [playlistTrack,setPlaylistTrack]=useState<Track|null>(null);
  useEffect(()=>{
    const onPick=(e:Event)=>{setPlaylistTrack((e as CustomEvent<Track>).detail);};
    window.addEventListener('swaip-track-picked-for-post',onPick);
    return()=>window.removeEventListener('swaip-track-picked-for-post',onPick);
  },[]);
  /* Селфи */
  const [selfieOpen,setSelfieOpen]=useState(false);
  const [selfieFrame,setSelfieFrame]=useState('phone');
  const [selfieRec,setSelfieRec]=useState(false);
  const [selfieBlob,setSelfieBlob]=useState<Blob|null>(null);
  const [selfiePrev,setSelfiePrev]=useState<string|null>(null);
  const [selfieLoading,setSelfieLoading]=useState(false);
  const [selfieProgress,setSelfieProgress]=useState(0);
  const [selfieCamera,setSelfieCamera]=useState<'user'|'environment'>('user');
  const selfieVidRef=useRef<HTMLVideoElement|null>(null);
  const selfieStreamRef=useRef<MediaStream|null>(null);
  const selfieRecRef=useRef<MediaRecorder|null>(null);
  /* Запись */
  const [postHasBooking,setPostHasBooking]=useState(false);
  const [postBookingSlots,setPostBookingSlots]=useState<BookingSlot[]>([]);
  const [postBookingLabel,setPostBookingLabel]=useState('Записаться');
  const [postBookingTimeInput,setPostBookingTimeInput]=useState('');
  const addBookingSlot=(t:string)=>{const v=t.trim();if(!v||postBookingSlots.some(s=>s.time===v))return;setPostBookingSlots(p=>[...p,{time:v,booked:false}]);};
  const removeBookingSlot=(t:string)=>setPostBookingSlots(p=>p.filter(s=>s.time!==t));
  /* Опрос */
  const [postHasPoll,setPostHasPoll]=useState(false);
  const [pollQuestion,setPollQuestion]=useState('');
  const [pollOptions,setPollOptions]=useState(['','']);
  const addPollOption=()=>{if(pollOptions.length<8)setPollOptions(p=>[...p,'']);};
  const removePollOption=(i:number)=>{if(pollOptions.length>2)setPollOptions(p=>p.filter((_,j)=>j!==i));};
  const setPollOption=(i:number,v:string)=>setPollOptions(p=>p.map((o,j)=>j===i?v:o));
  /* Коллаб */
  const [showCoAuthor,setShowCoAuthor]=useState(false);
  const [coAuthorQ,setCoAuthorQ]=useState('');
  const [coAuthorRes,setCoAuthorRes]=useState<any[]>([]);
  const [postCoAuthor,setPostCoAuthor]=useState<{hash:string;name:string;avatar:string}|null>(null);
  const searchCoAuthor=async(q:string)=>{setCoAuthorQ(q);if(!q.trim()){setCoAuthorRes([]);return;}try{const r=await fetch(`${window.location.origin}/api/search?q=${encodeURIComponent(q)}&limit=5`,{headers:{'x-session-token':getSessionToken()||''}});if(r.ok){const d=await r.json();setCoAuthorRes(d.results||[]);}}catch{}};
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
  /* Фоновая музыка поста */
  const [showBgMusic,setShowBgMusic]=useState(false);
  const [postBgMusic,setPostBgMusic]=useState<BgMusicPreset|null>(null);
  const bgMusPreviewRef=useRef<HTMLAudioElement|null>(null);
  const [bgMusPreviewId,setBgMusPreviewId]=useState<string|null>(null);
  const previewBgMusic=(p:BgMusicPreset)=>{
    if(bgMusPreviewRef.current){bgMusPreviewRef.current.pause();bgMusPreviewRef.current=null;}
    if(bgMusPreviewId===p.id){setBgMusPreviewId(null);return;}
    const a=new Audio(p.url);a.volume=0.5;a.play().catch(()=>{});bgMusPreviewRef.current=a;setBgMusPreviewId(p.id);
    a.addEventListener('ended',()=>setBgMusPreviewId(null));
  };
  useEffect(()=>()=>{if(bgMusPreviewRef.current){bgMusPreviewRef.current.pause();bgMusPreviewRef.current=null;}},[]);
  /* Карусель / галерея */
  const [showCarousel,setShowCarousel]=useState(false);
  const [postImages,setPostImages]=useState<{file:File;url:string}[]>([]);
  const carouselRef=useRef<HTMLInputElement|null>(null);
  const postImagesRef=useRef<{file:File;url:string}[]>([]);
  useEffect(()=>{postImagesRef.current=postImages;},[postImages]);
  useEffect(()=>()=>{postImagesRef.current.forEach(x=>URL.revokeObjectURL(x.url));},[]);
  const addCarouselImages=(files:FileList|null)=>{
    if(!files)return;
    const arr=Array.from(files).slice(0,10-postImages.length);
    const next=arr.map(f=>({file:f,url:URL.createObjectURL(f)}));
    setPostImages(p=>[...p,...next].slice(0,10));
  };
  const removeCarouselImage=(i:number)=>setPostImages(p=>{const x=p[i];if(x)URL.revokeObjectURL(x.url);return p.filter((_,j)=>j!==i);});
  /* Превью ссылки */
  const [showLinkPreview,setShowLinkPreview]=useState(false);
  const [linkUrl,setLinkUrl]=useState('');
  const [linkPreview,setLinkPreview]=useState<{title?:string;description?:string;image?:string;url:string}|null>(null);
  const [linkLoading,setLinkLoading]=useState(false);
  const fetchLinkPreview=async(u:string)=>{
    const url=u.trim();if(!url)return;setLinkLoading(true);
    try{
      const r=await fetch(`${window.location.origin}/api/link-preview?url=${encodeURIComponent(url)}`,{headers:{'x-session-token':getSessionToken()||''}});
      if(r.ok){const d=await r.json();setLinkPreview({title:d.title,description:d.description,image:d.image,url});}
      else{setLinkPreview({url});}
    }catch{setLinkPreview({url});}
    finally{setLinkLoading(false);}
  };
  /* Вопрос подписчикам */
  const [showQuestion,setShowQuestion]=useState(false);
  const [postQuestion,setPostQuestion]=useState('');
  /* Викторина */
  const [showQuiz,setShowQuiz]=useState(false);
  const [quizCorrect,setQuizCorrect]=useState(0);
  /* Челлендж */
  const [showChallenge,setShowChallenge]=useState(false);
  const [challengeTitle,setChallengeTitle]=useState('');
  const [challengeDeadline,setChallengeDeadline]=useState('');
  const [challengeHashtag,setChallengeHashtag]=useState('');
  /* Хештеги */
  const [showHashtags,setShowHashtags]=useState(false);
  const [postHashtags,setPostHashtags]=useState<string[]>([]);
  const [hashtagInput,setHashtagInput]=useState('');
  const POPULAR_TAGS=['музыка','фото','арт','танцы','стиль','юмор','новости','спорт','путешествия','еда','книги','кино','игры','технологии','мода'];
  const addHashtag=(t:string)=>{const v=t.trim().replace(/^#/,'').toLowerCase().replace(/\s+/g,'_');if(!v||postHashtags.includes(v)||postHashtags.length>=10)return;setPostHashtags(p=>[...p,v]);};
  const removeHashtag=(t:string)=>setPostHashtags(p=>p.filter(x=>x!==t));
  /* Отметить людей */
  const [showMentions,setShowMentions]=useState(false);
  const [mentionQ,setMentionQ]=useState('');
  const [mentionRes,setMentionRes]=useState<any[]>([]);
  const [postMentions,setPostMentions]=useState<{hash:string;name:string;avatar:string}[]>([]);
  const searchMention=async(q:string)=>{setMentionQ(q);if(!q.trim()){setMentionRes([]);return;}try{const r=await fetch(`${window.location.origin}/api/search?q=${encodeURIComponent(q)}&limit=5`,{headers:{'x-session-token':getSessionToken()||''}});if(r.ok){const d=await r.json();setMentionRes(d.results||[]);}}catch{}};
  const addMention=(u:any)=>{const name=u.pro_name||u.pro_full||u.scene_name||'Пользователь';if(postMentions.some(m=>m.hash===u.hash)||postMentions.length>=10)return;setPostMentions(p=>[...p,{hash:u.hash,name,avatar:u.pro_avatar||u.scene_avatar||''}]);setMentionQ('');setMentionRes([]);};
  const removeMention=(h:string)=>setPostMentions(p=>p.filter(m=>m.hash!==h));
  /* Активность */
  const [showActivity,setShowActivity]=useState(false);
  const ACTIVITIES=[{k:'movie',e:'🎬',l:'Смотрю'},{k:'music',e:'🎵',l:'Слушаю'},{k:'book',e:'📖',l:'Читаю'},{k:'game',e:'🎮',l:'Играю'},{k:'show',e:'📺',l:'Сериал'}] as const;
  const [activityType,setActivityType]=useState<'movie'|'music'|'book'|'game'|'show'>('movie');
  const [activityTitle,setActivityTitle]=useState('');
  /* Запретить комментарии / репост */
  const [postDisableComments,setPostDisableComments]=useState(false);
  const [postDisableRepost,setPostDisableRepost]=useState(false);
  /* TTS озвучка */
  const [postEnableTTS,setPostEnableTTS]=useState(false);
  /* Детальная статистика */
  const [postEnableStats,setPostEnableStats]=useState(false);
  /* Меню «Добавить в пост» */
  const [showAddMenu,setShowAddMenu]=useState(false);
  const getGeo=async()=>{
    setGeoLoading(true);
    try{
      const pos=await new Promise<GeolocationPosition>((res,rej)=>navigator.geolocation.getCurrentPosition(res,rej,{timeout:8000}));
      const{latitude:lat,longitude:lng}=pos.coords;
      const r=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
      const d=await r.json();
      const city=d.address?.city||d.address?.town||d.address?.village||d.address?.county||'Ваш город';
      setPostGeo({city,lat,lng});
    }catch{setPostGeo({city:'Ваш город',lat:0,lng:0});}
    finally{setGeoLoading(false);}
  };

  useEffect(()=>{
    if(!selfieOpen||selfieBlob)return;
    let cancelled=false;
    selfieStreamRef.current?.getTracks().forEach(t=>t.stop());
    selfieStreamRef.current=null;
    const t=setTimeout(async()=>{
      if(cancelled)return;
      try{
        const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:selfieCamera,width:{ideal:1280},height:{ideal:720}},audio:true});
        if(cancelled){stream.getTracks().forEach(t=>t.stop());return;}
        selfieStreamRef.current=stream;
        if(selfieVidRef.current){selfieVidRef.current.srcObject=stream;await selfieVidRef.current.play().catch(()=>{});}
      }catch{}
    },200);
    return()=>{cancelled=true;clearTimeout(t);};
  },[selfieOpen,selfieBlob,selfieCamera]);

  const docIcon=(mime:string,name:string)=>{
    const ext=name.toLowerCase().split('.').pop()||'';
    if(ext==='pdf')return'📕';if(['doc','docx','odt','rtf'].includes(ext))return'📘';
    if(['ppt','pptx','odp'].includes(ext))return'📙';if(['xls','xlsx','ods','csv'].includes(ext))return'📗';
    if(['txt','md'].includes(ext))return'📃';if(mime.startsWith('text/'))return'📄';return'📁';
  };
  const fmtSize=(b:number)=>b>=1048576?`${(b/1048576).toFixed(1)} МБ`:b>=1024?`${(b/1024).toFixed(0)} КБ`:`${b} Б`;

  const uploadImg=async():Promise<string|null>=>{
    if(!imgFile)return null;setImgLoading(true);
    try{const r=await fetch(`${window.location.origin}/api/image-upload`,{method:'POST',headers:{'Content-Type':imgFile.type||'image/jpeg','x-session-token':getSessionToken()||''},body:imgFile});if(!r.ok)return null;const{url}=await r.json();return url;}
    catch{return null;}finally{setImgLoading(false);}
  };
  const clearImg=()=>{if(imgPrev)URL.revokeObjectURL(imgPrev);setImgFile(null);setImgPrev(null);};

  const uploadVid=async():Promise<string|null>=>{
    if(!vidFile)return null;setVidLoading(true);setVidProgress(20);
    const base=window.location.origin;const tok=getSessionToken()||'';
    try{
      const r=await fetch(`${base}/api/video-upload`,{
        method:'POST',
        headers:{'Content-Type':vidFile.type||'video/mp4','x-filename':vidFile.name.replace(/[^a-zA-Z0-9.\-_ ]/g,'_'),'x-session-token':tok},
        body:vidFile,
      });
      setVidProgress(90);
      if(!r.ok)return null;
      setVidProgress(100);const{url}=await r.json();return url;
    }catch{return null;}finally{setVidLoading(false);}
  };
  const clearVid=()=>{if(vidPrev)URL.revokeObjectURL(vidPrev);setVidFile(null);setVidPrev(null);setVidProgress(0);};

  const uploadDocs=async():Promise<DocAtt[]>=>{
    if(!docFiles.length)return[];setDocLoading(true);
    const tok=getSessionToken()||'';
    try{
      const res=await Promise.all(docFiles.map(async f=>{
        const r=await fetch(`${window.location.origin}/api/doc-upload`,{method:'POST',headers:{'Content-Type':f.type||'application/octet-stream','x-filename':f.name.replace(/[^a-zA-Z0-9.\-_ ]/g,'_'),'x-session-token':tok},body:f});
        if(!r.ok)return null;const{url}=await r.json();return{url,name:f.name,size:f.size,mime:f.type||'application/octet-stream'} as DocAtt;
      }));
      return res.filter((r):r is DocAtt=>r!==null);
    }catch{return[];}finally{setDocLoading(false);}
  };

  const uploadMusic=async():Promise<string|null>=>{
    if(!musicFile)return null;
    setMusicLoading(true);setMusicError(null);
    try{
      const ct=musicFile.type||'application/octet-stream';
      const r=await fetch(`${window.location.origin}/api/audio-upload`,{
        method:'POST',
        headers:{'Content-Type':ct,'x-session-token':getSessionToken()||'','x-filename':musicFile.name},
        body:musicFile
      });
      if(!r.ok){
        const errData=await r.json().catch(()=>({error:'Ошибка сервера'}));
        const msg=errData?.error||`Ошибка ${r.status}`;
        setMusicError(msg);
        return null;
      }
      const{url}=await r.json();
      return url;
    }catch(e:any){
      const msg=e?.message||'Ошибка сети';
      setMusicError(msg);
      return null;
    }finally{setMusicLoading(false);}
  };
  const clearMusic=()=>{setMusicFile(null);setMusicName('');setMusicError(null);if(musicRef.current)musicRef.current.value='';};

  const startVoice=async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mime=['audio/webm;codecs=opus','audio/webm','audio/ogg;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t))||'';
      const mr=mime?new MediaRecorder(stream,{mimeType:mime}):new MediaRecorder(stream);
      const chunks:BlobPart[]=[];
      mr.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
      mr.onstop=()=>{stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:mr.mimeType});setVoiceBlob(blob);setVoiceUrl(URL.createObjectURL(blob));setVoiceRec(false);};
      mr.start();voiceRecRef.current=mr;setVoiceRec(true);setVoiceBlob(null);setVoiceUrl(null);
    }catch{}
  };
  const stopVoice=()=>{voiceRecRef.current?.stop();};

  const openSelfie=()=>{setSelfieBlob(null);if(selfiePrev){URL.revokeObjectURL(selfiePrev);setSelfiePrev(null);}setSelfieOpen(true);};
  const closeSelfie=()=>{selfieStreamRef.current?.getTracks().forEach(t=>t.stop());selfieStreamRef.current=null;selfieRecRef.current=null;setSelfieRec(false);setSelfieOpen(false);};
  const startSelfieRec=()=>{
    if(!selfieStreamRef.current)return;
    const chunks:BlobPart[]=[];
    const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(m=>MediaRecorder.isTypeSupported(m))||'';
    const mr=mime?new MediaRecorder(selfieStreamRef.current,{mimeType:mime}):new MediaRecorder(selfieStreamRef.current);
    mr.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
    mr.onstop=()=>{const blob=new Blob(chunks,{type:mr.mimeType||'video/webm'});setSelfieBlob(blob);setSelfiePrev(URL.createObjectURL(blob));selfieStreamRef.current?.getTracks().forEach(t=>t.stop());};
    mr.start();selfieRecRef.current=mr;setSelfieRec(true);
  };
  const stopSelfieRec=()=>{selfieRecRef.current?.stop();setSelfieRec(false);};
  const discardSelfie=()=>{selfieStreamRef.current?.getTracks().forEach(t=>t.stop());selfieStreamRef.current=null;if(selfiePrev){URL.revokeObjectURL(selfiePrev);setSelfiePrev(null);}setSelfieBlob(null);};

  const reset=()=>{setText('');setVoiceBlob(null);setVoiceUrl(null);setVoiceRec(false);clearImg();clearVid();setDocFiles([]);clearMusic();setPlaylistTrack(null);setPostHasBooking(false);setPostBookingSlots([]);setPostBookingLabel('Записаться');setPostBookingTimeInput('');setPostHasPoll(false);setPollQuestion('');setPollOptions(['','']);setShowCoAuthor(false);setCoAuthorQ('');setCoAuthorRes([]);setPostCoAuthor(null);setPostIsAnonVoting(false);setShowTimer(false);setPostPublishAt('');setPostExpiresAt('');setShowGeo(false);setPostGeo(null);postImages.forEach(x=>URL.revokeObjectURL(x.url));setPostImages([]);setShowCarousel(false);setShowLinkPreview(false);setLinkUrl('');setLinkPreview(null);setShowQuestion(false);setPostQuestion('');setShowQuiz(false);setQuizCorrect(0);setShowChallenge(false);setChallengeTitle('');setChallengeDeadline('');setChallengeHashtag('');setShowHashtags(false);setPostHashtags([]);setHashtagInput('');setShowMentions(false);setMentionQ('');setMentionRes([]);setPostMentions([]);setShowActivity(false);setActivityType('movie');setActivityTitle('');setPostDisableComments(false);setPostDisableRepost(false);setPostEnableTTS(false);setPostEnableStats(false);setShowAddMenu(false);setShowBgMusic(false);setPostBgMusic(null);if(bgMusPreviewRef.current){bgMusPreviewRef.current.pause();bgMusPreviewRef.current=null;}setBgMusPreviewId(null);};

  const handlePost=async()=>{
    const validPoll=postHasPoll&&pollQuestion.trim()&&pollOptions.filter(o=>o.trim()).length>=2;
    const hasAnyContent=!!(text.trim()||imgFile||vidFile||docFiles.length||musicFile||postHasBooking||validPoll);
    if(!hasAnyContent||submitting)return;
    const filterResult=checkContent(collectPostText(text,pollQuestion,...(pollOptions||[])));
    if(!filterResult.ok){setContentError(filterResult.reason||'Публикация заблокирована.');return;}
    setContentError('');
    setSubmitting(true);
    try{
      const[imgUrl,vidUrl,docs,musUrl]=await Promise.all([uploadImg(),uploadVid(),uploadDocs(),uploadMusic()]);
      const defaultContent=vidUrl?'🎬':imgUrl?'📷':musUrl?'🎵':docs.length?'📎':vidFile?'🎬':imgFile?'📷':musicFile?'🎵':docFiles.length?'📎'
        :postHasBooking?`📅 ${postBookingLabel||'Записаться'}`:validPoll?`📊 ${pollQuestion.trim()}`:'';
      const bookingExtra=postHasBooking?{hasBooking:true,bookingLabel:postBookingLabel||'Записаться',bookingSlots:postBookingSlots.length?postBookingSlots:[]}:{};
      const pollExtra=validPoll?{poll:{question:pollQuestion.trim(),options:pollOptions.filter(o=>o.trim()).map((o,i)=>({id:`opt${i}`,text:o.trim(),votes:0})),totalVotes:0}}:{};
      const apiContent=text.trim()||defaultContent;
      const coAuthorExtra=postCoAuthor?{coAuthorHash:postCoAuthor.hash,coAuthorData:postCoAuthor}:{};
      const anonExtra=postIsAnonVoting?{isAnonVoting:true}:{};
      const timerExtra=postPublishAt?{publishAt:new Date(postPublishAt).toISOString(),...(postExpiresAt?{expiresAt:new Date(postExpiresAt).toISOString()}:{})}:{};
      const geoExtra=postGeo?{location:postGeo}:{};
      // Загрузка карусели параллельно
      let carouselUrls:string[]=[];
      if(postImages.length>0){
        try{
          const ups=await Promise.all(postImages.map(im=>{
            return fetch(`${window.location.origin}/api/image-upload`,{method:'POST',headers:{'Content-Type':im.file.type||'image/jpeg','x-session-token':getSessionToken()||''},body:im.file})
              .then(r=>r.ok?r.json():null).catch(()=>null);
          }));
          carouselUrls=ups.map(u=>u?.url).filter(Boolean) as string[];
        }catch{}
      }
      const carouselExtra=carouselUrls.length?{additionalImageUrls:carouselUrls}:{};
      const linkExtra=(showLinkPreview&&linkPreview)?{linkPreview}:{};
      const questionExtra=(showQuestion&&postQuestion.trim())?{question:postQuestion.trim()}:{};
      const quizExtra=(showQuiz&&validPoll)?{quiz:{correctIndex:quizCorrect}}:{};
      const challengeExtra=(showChallenge&&challengeTitle.trim())?{challenge:{title:challengeTitle.trim(),deadline:challengeDeadline||null,hashtag:challengeHashtag||null}}:{};
      const hashtagExtra=postHashtags.length?{hashtags:postHashtags}:{};
      const mentionExtra=postMentions.length?{mentions:postMentions.map(m=>({hash:m.hash,name:m.name}))}:{};
      const activityExtra=(showActivity&&activityTitle.trim())?{activity:{type:activityType,title:activityTitle.trim()}}:{};
      const flagsExtra={
        ...(postDisableComments?{disableComments:true}:{}),
        ...(postDisableRepost?{disableRepost:true}:{}),
        ...(postEnableTTS?{enableTTS:true}:{}),
        ...(postEnableStats?{enableStats:true}:{}),
      };
      const bgMusicExtra=postBgMusic?{bgMusicUrl:postBgMusic.url,bgMusicLabel:`${postBgMusic.emoji} ${postBgMusic.label}`}:{};
      const postData={content:apiContent,imageUrl:imgUrl||undefined,videoUrl:vidUrl||undefined,audioUrl:musUrl||(playlistTrack?.url)||undefined,docUrls:docs.length?docs:undefined,...bookingExtra,...pollExtra,...carouselExtra,...linkExtra,...questionExtra,...quizExtra,...challengeExtra,...hashtagExtra,...mentionExtra,...activityExtra,...flagsExtra,...bgMusicExtra};
      try{
        const r=await fetch(`${window.location.origin}/api/broadcasts`,{
          method:'POST',headers:{'Content-Type':'application/json','x-session-token':getSessionToken()||''},
          body:JSON.stringify({content:apiContent,authorMode,...(imgUrl?{imageUrl:imgUrl}:{}),...(vidUrl?{videoUrl:vidUrl}:{}),...(docs.length?{docUrls:docs}:{}),...((musUrl||playlistTrack?.url)?{audioUrl:musUrl||playlistTrack!.url}:{}),...(postHasBooking?{hasBooking:true,bookingLabel:postBookingLabel||'Записаться',bookingSlots:postBookingSlots}:{}),...pollExtra,...coAuthorExtra,...anonExtra,...timerExtra,...geoExtra,...carouselExtra,...linkExtra,...questionExtra,...quizExtra,...challengeExtra,...hashtagExtra,...mentionExtra,...activityExtra,...flagsExtra,...bgMusicExtra}),
        });
        if(r.ok){const created=await r.json().catch(()=>null);setOpen(false);reset();onPostCreated({...postData,...created});return;}
      }catch{}
      setOpen(false);reset();onPostCreated(postData);
    }finally{setSubmitting(false);}
  };

  const sendVoice=async()=>{
    if(!voiceBlob||voiceSending)return;setVoiceSending(true);
    try{
      const[audioUp,imgUrl,vidUrl,docs]=await Promise.all([
        fetch(`${window.location.origin}/api/audio-upload`,{method:'POST',headers:{'Content-Type':voiceBlob.type||'audio/webm'},body:voiceBlob}).catch(()=>null),
        uploadImg(),uploadVid(),uploadDocs(),
      ]);
      const audioUrl=audioUp?.ok?(await audioUp.json().catch(()=>null))?.url:null;
      const postData={content:text.trim()||'🎙️',audioUrl:audioUrl||URL.createObjectURL(voiceBlob),imageUrl:imgUrl||undefined,videoUrl:vidUrl||undefined};
      try{
        if(audioUrl){
          const r=await fetch(`${window.location.origin}/api/broadcasts`,{method:'POST',headers:{'Content-Type':'application/json','x-session-token':getSessionToken()||''},body:JSON.stringify({content:text.trim()||'🎙️',audioUrl,authorMode,...(imgUrl?{imageUrl:imgUrl}:{}),...(vidUrl?{videoUrl:vidUrl}:{}),...(docs.length?{docUrls:docs}:{})})});
          if(r.ok){const created=await r.json().catch(()=>null);setOpen(false);reset();onPostCreated({...postData,...created});return;}
        }
      }catch{}
      setOpen(false);reset();onPostCreated(postData);
    }finally{setVoiceSending(false);}
  };

  const uploadSelfiePost=async()=>{
    if(!selfieBlob)return;setSelfieLoading(true);setSelfieProgress(20);
    const base=window.location.origin;
    try{
      const file=new File([selfieBlob],'selfie.webm',{type:selfieBlob.type||'video/webm'});
      const r=await fetch(`${base}/api/video-upload`,{
        method:'POST',
        headers:{'Content-Type':file.type,'x-filename':'selfie.webm','x-session-token':getSessionToken()||''},
        body:file,
      });
      setSelfieProgress(80);
      if(!r.ok)return;
      setSelfieProgress(90);const{url:videoUrl}=await r.json();
      const postRes=await fetch(`${base}/api/broadcasts`,{method:'POST',headers:{'Content-Type':'application/json','x-session-token':getSessionToken()||''},body:JSON.stringify({content:`🎥:${selfieFrame}`,authorMode,videoUrl})});
      if(postRes.ok){const created=await postRes.json().catch(()=>null);closeSelfie();if(selfiePrev){URL.revokeObjectURL(selfiePrev);setSelfiePrev(null);}setSelfieBlob(null);onPostCreated({content:`🎥:${selfieFrame}`,videoUrl,...created});}
    }finally{setSelfieLoading(false);}
  };

  const canPost=(text.trim()||!!imgFile||!!vidFile||docFiles.length>0||!!musicFile||!!playlistTrack)&&!submitting&&!imgLoading&&!vidLoading&&!docLoading&&!musicLoading;

  const isDarkComp=c.card==='#0a0a14'||c.card.startsWith('#0')||c.card.startsWith('#1');
  return(
    <>
      {open?(
        <div style={{background:c.cardAlt,border:`1px solid ${c.border}`,borderRadius:20,padding:'14px 16px',display:'flex',flexDirection:'column',gap:12}}>
          {voiceRec?(
            <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(239,68,68,0.1)',borderRadius:14,padding:'10px 14px',border:'1px solid rgba(239,68,68,0.25)'}}>
              <motion.div animate={{scale:[1,1.25,1]}} transition={{repeat:Infinity,duration:0.9}} style={{width:12,height:12,borderRadius:'50%',background:'#ef4444',flexShrink:0}}/>
              <span style={{color:'#f87171',fontSize:14,flex:1}}>Запись голосового поста...</span>
              <motion.button whileTap={{scale:0.88}} onClick={stopVoice} style={{background:'#ef4444',border:'none',borderRadius:'50%',width:34,height:34,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span style={{color:'#fff',fontSize:15}}>■</span>
              </motion.button>
            </div>
          ):voiceUrl?(
            <div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(59,130,246,0.1)',borderRadius:14,padding:'8px 12px',border:'1px solid rgba(59,130,246,0.25)'}}>
              <span style={{fontSize:18}}>🎙️</span>
              <audio controls src={voiceUrl} style={{flex:1,height:32,maxWidth:200}}/>
              <motion.button whileTap={{scale:0.88}} onClick={()=>{setVoiceBlob(null);setVoiceUrl(null);}} style={{background:'rgba(255,255,255,0.08)',border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span style={{fontSize:12,color:'rgba(255,255,255,0.5)'}}>✕</span>
              </motion.button>
            </div>
          ):(
            <textarea autoFocus value={text} onChange={e=>setText(e.target.value)} placeholder="Что у вас нового?" rows={3}
              style={{background:'transparent',border:'none',color:c.light,fontSize:16,fontFamily:'"Montserrat",sans-serif',resize:'none',outline:'none',lineHeight:1.6,width:'100%'}}/>
          )}
          {/* Превью фото */}
          {imgPrev&&(
            <div style={{position:'relative',borderRadius:16,overflow:'hidden',background:'#000'}}>
              <img src={imgPrev} alt="" style={{display:'block',width:'100%',maxHeight:360,objectFit:'contain'}}/>
              <motion.button whileTap={{scale:0.85}} onClick={clearImg} style={{position:'absolute',top:8,right:8,width:30,height:30,borderRadius:'50%',background:'rgba(0,0,0,0.65)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <span style={{color:'#fff',fontSize:15}}>✕</span>
              </motion.button>
            </div>
          )}
          {/* Превью видео */}
          {vidPrev&&(
            <div style={{position:'relative',borderRadius:16,overflow:'hidden',background:'#000'}}>
              <video src={vidPrev} controls style={{display:'block',width:'100%',maxHeight:360,objectFit:'contain'}}/>
              {vidLoading&&(
                <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'6px 10px',background:'rgba(0,0,0,0.7)'}}>
                  <span style={{color:'#fff',fontSize:12}}>🎬 Загрузка {vidProgress}%</span>
                  <div style={{height:4,background:'rgba(255,255,255,0.15)',borderRadius:2,marginTop:4}}>
                    <div style={{width:`${vidProgress}%`,height:'100%',background:'linear-gradient(90deg,#3b82f6,#8b5cf6)',borderRadius:2,transition:'width 0.3s'}}/>
                  </div>
                </div>
              )}
              {!vidLoading&&<motion.button whileTap={{scale:0.85}} onClick={clearVid} style={{position:'absolute',top:8,right:8,width:30,height:30,borderRadius:'50%',background:'rgba(0,0,0,0.65)',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{color:'#fff',fontSize:15}}>✕</span></motion.button>}
            </div>
          )}
          {/* Скрытые inputs */}
          <input ref={imgRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(imgPrev)URL.revokeObjectURL(imgPrev);setImgFile(f);setImgPrev(URL.createObjectURL(f));e.target.value='';}}/>
          <input ref={vidRef} type="file" accept="video/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(vidPrev)URL.revokeObjectURL(vidPrev);setVidFile(f);setVidPrev(URL.createObjectURL(f));e.target.value='';}}/>
          <input ref={docRef} type="file" multiple style={{display:'none'}} accept=".pdf,.txt,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.html,.htm,.md,.rtf,.odt,.odp,.ods,.json,.xml" onChange={e=>{const files=Array.from(e.target.files||[]);if(!files.length)return;setDocFiles(prev=>[...prev,...files]);e.target.value='';}}/>
          <input ref={musicRef} type="file" style={{display:'none'}} accept="audio/*,video/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus,.wma,.aiff,.aif,.caf,.amr,.3gp,.mp4,.mkv,.webm,.avi,.mov" onChange={e=>{const f=e.target.files?.[0];if(!f)return;setMusicFile(f);setMusicName(f.name);setMusicError(null);e.target.value='';}}/>
          {/* Список документов */}
          {docFiles.length>0&&(
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {docFiles.map((f,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:8,background:c.cardAlt,borderRadius:10,padding:'8px 12px',border:`1px solid ${c.border}`}}>
                  <span style={{fontSize:18,flexShrink:0}}>{docIcon(f.type,f.name)}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,fontWeight:700,color:c.light,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.name}</div>
                    <div style={{fontSize:10,color:c.sub}}>{fmtSize(f.size)}</div>
                  </div>
                  <motion.button whileTap={{scale:0.85}} onClick={()=>setDocFiles(prev=>prev.filter((_,j)=>j!==i))} style={{background:c.card,border:'none',borderRadius:'50%',width:24,height:24,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    <span style={{fontSize:11,color:c.sub}}>✕</span>
                  </motion.button>
                </div>
              ))}
            </div>
          )}
          {/* Карточка музыки */}
          {musicFile&&(
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(16,185,129,0.08)',borderRadius:12,padding:'10px 14px',border:`1px solid ${musicError?'rgba(239,68,68,0.5)':'rgba(16,185,129,0.2)'}`}}>
                <span style={{fontSize:20,flexShrink:0}}>{musicLoading?'⏳':'🎵'}</span>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:700,color:c.light,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{musicName}</div>
                  <div style={{fontSize:11,color:musicLoading?'#a78bfa':c.sub}}>{musicLoading?'Конвертирую в MP3...':fmtSize(musicFile.size)}</div>
                </div>
                <motion.button whileTap={{scale:0.85}} onClick={clearMusic} style={{background:c.card,border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <span style={{fontSize:12,color:c.sub}}>✕</span>
                </motion.button>
              </div>
              {musicError&&<div style={{fontSize:12,color:'#f87171',padding:'2px 4px'}}>⚠️ {musicError}</div>}
            </div>
          )}
          {/* Карточка трека из плейлиста */}
          {playlistTrack&&(
            <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(99,102,241,0.1)',borderRadius:12,padding:'10px 14px',border:'1px solid rgba(99,102,241,0.3)'}}>
              <span style={{fontSize:20,flexShrink:0}}>🎵</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:700,color:c.light,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{playlistTrack.title}</div>
                <div style={{fontSize:11,color:'#a5b4fc'}}>{playlistTrack.artist||'Неизвестный'} · Из плейлиста</div>
              </div>
              <motion.button whileTap={{scale:0.85}} onClick={()=>setPlaylistTrack(null)} style={{background:c.card,border:'none',borderRadius:'50%',width:28,height:28,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <span style={{fontSize:12,color:c.sub}}>✕</span>
              </motion.button>
            </div>
          )}

          {/* ══ Меню «➕ Добавить в пост» ══ */}
          {(() => {
            const ADDONS=[
              {id:'carousel', emo:'🖼️', lbl:'Карусель / галерея',   clr:'#fb923c', on:postImages.length>0||showCarousel, toggle:()=>setShowCarousel(s=>!s)},
              {id:'booking',  emo:'📅', lbl:'Кнопка «Записаться»', clr:'#34d399', on:postHasBooking,    toggle:()=>setPostHasBooking(s=>!s)},
              {id:'poll',     emo:'📊', lbl:'Опрос',                clr:'#a5b4fc', on:postHasPoll,        toggle:()=>setPostHasPoll(s=>!s)},
              {id:'quiz',     emo:'🎯', lbl:'Викторина / квиз',     clr:'#fde047', on:showQuiz,          toggle:()=>setShowQuiz(s=>!s), need:'poll' as const},
              {id:'question', emo:'❓', lbl:'Вопрос подписчикам',   clr:'#f472b6', on:showQuestion,      toggle:()=>setShowQuestion(s=>!s)},
              {id:'challenge',emo:'🏆', lbl:'Челлендж',            clr:'#f97316', on:showChallenge,     toggle:()=>setShowChallenge(s=>!s)},
              {id:'link',     emo:'🔗', lbl:'Превью ссылки',        clr:'#60a5fa', on:showLinkPreview,   toggle:()=>setShowLinkPreview(s=>!s)},
              {id:'activity', emo:'🎬', lbl:'Активность',          clr:'#fbbf24', on:showActivity,      toggle:()=>setShowActivity(s=>!s)},
              {id:'mention',  emo:'🏷️', lbl:'Отметить людей',       clr:'#a78bfa', on:showMentions||postMentions.length>0, toggle:()=>setShowMentions(s=>!s)},
              {id:'hashtag',  emo:'#️⃣', lbl:'Хештеги / темы',       clr:'#22d3ee', on:showHashtags||postHashtags.length>0, toggle:()=>setShowHashtags(s=>!s)},
              {id:'coauthor', emo:'🤝', lbl:'Коллаборативный пост', clr:'#a5b4fc', on:showCoAuthor,       toggle:()=>setShowCoAuthor(s=>!s)},
              {id:'anon',     emo:'🕵️', lbl:'Анонимное голосование',clr:'#c4b5fd', on:postIsAnonVoting,   toggle:()=>setPostIsAnonVoting(s=>!s), need:'poll' as const},
              {id:'timer',    emo:'⏰', lbl:'Таймер публикации',    clr:'#fbbf24', on:showTimer,          toggle:()=>setShowTimer(s=>!s)},
              {id:'geo',      emo:'📍', lbl:'Геолокация поста',     clr:'#4ade80', on:showGeo,            toggle:()=>setShowGeo(s=>!s)},
              {id:'tts',      emo:'🔊', lbl:'Озвучка текста (TTS)', clr:'#34d399', on:postEnableTTS,      toggle:()=>setPostEnableTTS(s=>!s)},
              {id:'stats',    emo:'📈', lbl:'Детальная статистика', clr:'#a3e635', on:postEnableStats,    toggle:()=>setPostEnableStats(s=>!s)},
              {id:'nocomm',   emo:'🚫', lbl:'Запретить комментарии',clr:'#f87171', on:postDisableComments,toggle:()=>setPostDisableComments(s=>!s)},
              {id:'norepost', emo:'♻️', lbl:'Запретить репост',     clr:'#f87171', on:postDisableRepost,  toggle:()=>setPostDisableRepost(s=>!s)},
              {id:'bgmusic',  emo:'🎵', lbl:'Фоновая музыка',       clr:'#ec4899', on:showBgMusic||!!postBgMusic, toggle:()=>setShowBgMusic(s=>!s)},
            ];
            const onCount=ADDONS.filter(a=>a.on).length;
            return (
              <div style={{borderRadius:12,border:'1px solid rgba(255,255,255,0.08)',background:'rgba(255,255,255,0.025)',overflow:'hidden'}}>
                <div onClick={()=>setShowAddMenu(s=>!s)}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'11px 14px',cursor:'pointer'}}>
                  <div style={{width:28,height:28,borderRadius:'50%',background:'rgba(99,102,241,0.18)',
                    border:'1px solid rgba(99,102,241,0.4)',display:'flex',alignItems:'center',justifyContent:'center',
                    flexShrink:0,fontSize:15,color:'#a5b4fc',fontWeight:700,
                    transform:showAddMenu?'rotate(45deg)':'rotate(0)',transition:'transform 0.2s'}}>+</div>
                  <span style={{flex:1,fontSize:13,color:'#fff',fontWeight:600,fontFamily:'"Montserrat",sans-serif'}}>
                    Добавить в пост
                  </span>
                  {onCount>0&&(
                    <span style={{fontSize:11,fontWeight:700,color:'#a5b4fc',background:'rgba(99,102,241,0.15)',
                      borderRadius:10,padding:'2px 8px'}}>{onCount}</span>
                  )}
                  <span style={{fontSize:11,color:'rgba(255,255,255,0.35)',transform:showAddMenu?'rotate(180deg)':'rotate(0)',transition:'transform 0.2s'}}>▾</span>
                </div>
                <AnimatePresence>
                  {showAddMenu&&(
                    <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}}
                      style={{overflow:'hidden',borderTop:'1px solid rgba(255,255,255,0.06)'}}>
                      {/* ── горизонтальная карусель иконок ── */}
                      <div style={{display:'flex',gap:8,overflowX:'auto',padding:'12px 10px 14px',scrollbarWidth:'none'}}>
                        {ADDONS.map(a=>{
                          const disabled=a.need==='poll'&&!postHasPoll;
                          return (
                            <button key={a.id} disabled={disabled} onClick={()=>{ if(!disabled) a.toggle(); }}
                              style={{flexShrink:0,display:'flex',flexDirection:'column',alignItems:'center',gap:5,
                                background:'none',border:'none',cursor:disabled?'not-allowed':'pointer',
                                padding:0,width:60,opacity:disabled?0.35:1}}>
                              <div style={{width:50,height:50,borderRadius:15,display:'flex',alignItems:'center',
                                justifyContent:'center',fontSize:21,position:'relative',transition:'all 0.15s',
                                background:a.on?`${a.clr}22`:'rgba(255,255,255,0.06)',
                                border:`2px solid ${a.on?a.clr:'rgba(255,255,255,0.1)'}`,
                                boxShadow:a.on?`0 0 10px ${a.clr}44`:'none'}}>
                                {a.emo}
                                {a.on&&(
                                  <div style={{position:'absolute',top:-4,right:-4,width:15,height:15,borderRadius:'50%',
                                    background:a.clr,display:'flex',alignItems:'center',justifyContent:'center',
                                    fontSize:8,fontWeight:900,color:'#000'}}>✓</div>
                                )}
                              </div>
                              <span style={{fontSize:9,fontWeight:700,color:a.on?a.clr:'rgba(255,255,255,0.45)',
                                textAlign:'center',lineHeight:1.2,maxWidth:58,
                                display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>
                                {a.lbl.split(' /')[0].split(' «')[0]}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })()}

          {/* ── Кнопка «Записаться» ── */}
          {postHasBooking&&(
            <div style={{borderRadius:12,border:'1px solid rgba(16,185,129,0.4)',
              background:'rgba(16,185,129,0.06)',overflow:'hidden',transition:'all 0.25s'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
                <span style={{fontSize:14}}>📅</span>
                <span style={{flex:1,fontSize:12,color:'#34d399',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>
                  Кнопка «Записаться»
                </span>
                <button onClick={()=>setPostHasBooking(false)} style={{background:'none',border:'none',
                  color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',lineHeight:1,padding:'2px 6px'}}>✕</button>
              </div>
              <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:10}}>
                {/* Название кнопки */}
                <input value={postBookingLabel} onChange={e=>setPostBookingLabel(e.target.value)}
                  placeholder="Текст кнопки: Записаться на маникюр"
                  style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,
                    background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',
                    color:'#fff',fontSize:12,outline:'none',fontFamily:'"Montserrat",sans-serif'}}/>
                {/* Добавить слот — дата + время, как в редакторе прайса */}
                <div>
                  <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginBottom:6,fontWeight:600}}>📅 Слоты для записи:</div>
                  <div style={{display:'flex',gap:6,alignItems:'flex-end',flexWrap:'wrap'}}>
                    <div style={{flex:'1 1 130px'}}>
                      <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginBottom:3}}>Дата</div>
                      <input type="date" value={postBookingTimeInput.split(' ')[0]||''} min={new Date().toISOString().split('T')[0]}
                        onChange={e=>{const t=postBookingTimeInput.split(' ')[1]||'';setPostBookingTimeInput(e.target.value+(t?' '+t:''));}}
                        style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,
                          background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',
                          color:'#fff',fontSize:12,outline:'none',colorScheme:'dark'} as React.CSSProperties}/>
                    </div>
                    <div style={{flex:'1 1 90px'}}>
                      <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginBottom:3}}>Время</div>
                      <input type="time" value={postBookingTimeInput.split(' ')[1]||''}
                        onChange={e=>{const d=postBookingTimeInput.split(' ')[0]||'';setPostBookingTimeInput(d?d+' '+e.target.value:e.target.value);}}
                        style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,
                          background:'rgba(255,255,255,0.07)',border:'1px solid rgba(255,255,255,0.12)',
                          color:'#fff',fontSize:12,outline:'none',colorScheme:'dark'} as React.CSSProperties}/>
                    </div>
                    <button onClick={()=>{
                      const v=postBookingTimeInput.trim();
                      if(!v||!v.includes(' '))return;
                      addBookingSlot(v);setPostBookingTimeInput('');
                    }} style={{padding:'8px 13px',borderRadius:8,
                      background:'rgba(59,130,246,0.2)',border:'1px solid rgba(59,130,246,0.4)',
                      color:'#93c5fd',fontSize:12,fontWeight:700,cursor:'pointer',flexShrink:0,alignSelf:'flex-end'}}>
                      + Слот
                    </button>
                  </div>
                </div>
                {/* Добавленные слоты */}
                {postBookingSlots.length>0&&(
                  <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                    {postBookingSlots.map(s=>{
                      let lbl=s.time;
                      try{const r=formatSlotRu(s.time);lbl=r.split(',')[1]?.trim()||r;}catch{}
                      return(
                        <div key={s.time} style={{display:'flex',alignItems:'center',gap:4,
                          background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.25)',
                          borderRadius:20,padding:'4px 10px'}}>
                          <span style={{fontSize:11,color:'#93c5fd',fontWeight:600}}>🟢 {lbl}</span>
                          <button onClick={()=>removeBookingSlot(s.time)}
                            style={{background:'none',border:'none',color:'rgba(255,255,255,0.3)',cursor:'pointer',padding:0,fontSize:11,lineHeight:1}}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Опрос ── */}
          {postHasPoll&&(
            <div style={{borderRadius:12,border:'1px solid rgba(99,102,241,0.4)',
              background:'rgba(99,102,241,0.06)',overflow:'hidden',transition:'all 0.25s'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
                <span style={{fontSize:14}}>📊</span>
                <span style={{flex:1,fontSize:12,color:'#a5b4fc',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>Опрос</span>
                <button onClick={()=>{setPostHasPoll(false);setPostIsAnonVoting(false);}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',lineHeight:1,padding:'2px 6px'}}>✕</button>
              </div>
              <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:8}}>
                <input value={pollQuestion} onChange={e=>setPollQuestion(e.target.value)}
                  placeholder="Вопрос для опроса…"
                  style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,
                    background:'rgba(255,255,255,0.06)',border:'1px solid rgba(99,102,241,0.3)',
                    color:'#fff',fontSize:13,fontWeight:700,outline:'none',fontFamily:'"Montserrat",sans-serif'}}/>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontWeight:600}}>Варианты ответов:</div>
                {pollOptions.map((opt,i)=>(
                  <div key={i} style={{display:'flex',gap:6,alignItems:'center'}}>
                    <span style={{fontSize:11,color:'rgba(255,255,255,0.3)',fontWeight:700,minWidth:14}}>{i+1}</span>
                    <input value={opt} onChange={e=>setPollOption(i,e.target.value)}
                      placeholder={`Вариант ${i+1}`}
                      style={{flex:1,padding:'7px 10px',borderRadius:8,background:'rgba(255,255,255,0.06)',
                        border:'1px solid rgba(255,255,255,0.1)',color:'#fff',fontSize:12,outline:'none',fontFamily:'"Montserrat",sans-serif'}}/>
                    {pollOptions.length>2&&(
                      <button onClick={()=>removePollOption(i)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.3)',cursor:'pointer',fontSize:13,lineHeight:1,padding:'0 2px'}}>✕</button>
                    )}
                  </div>
                ))}
                {pollOptions.length<8&&(
                  <button onClick={addPollOption} style={{background:'rgba(99,102,241,0.1)',border:'1px dashed rgba(99,102,241,0.4)',borderRadius:8,padding:'7px',
                    color:'#a5b4fc',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'"Montserrat",sans-serif'}}>
                    + Добавить вариант
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Коллаборативный пост ── */}
          {showCoAuthor&&(
            <div style={{borderRadius:12,border:'1px solid rgba(99,102,241,0.4)',background:'rgba(99,102,241,0.06)',overflow:'hidden',transition:'all 0.25s'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
                <span style={{fontSize:14}}>🤝</span>
                <span style={{flex:1,fontSize:12,color:'#a5b4fc',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>Коллаборативный пост</span>
                {postCoAuthor&&<span style={{fontSize:10,color:'#a5b4fc',fontWeight:800}}>{postCoAuthor.name}</span>}
                <button onClick={()=>{setShowCoAuthor(false);setCoAuthorQ('');setCoAuthorRes([]);setPostCoAuthor(null);}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',lineHeight:1,padding:'2px 6px'}}>✕</button>
              </div>
              <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:8}}>
                {postCoAuthor?(
                  <div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(99,102,241,0.1)',borderRadius:10,padding:'8px 10px'}}>
                    <div style={{width:28,height:28,borderRadius:'50%',overflow:'hidden',flexShrink:0}}>
                      {postCoAuthor.avatar?<img src={postCoAuthor.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:14}}>👤</span>}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:800,color:'#fff'}}>{postCoAuthor.name}</div>
                      <div style={{fontSize:10,color:'rgba(255,255,255,0.45)'}}>Соавтор</div>
                    </div>
                    <button onClick={()=>{setPostCoAuthor(null);setCoAuthorQ('');setCoAuthorRes([]);}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.35)',cursor:'pointer',fontSize:14,lineHeight:1}}>✕</button>
                  </div>
                ):(
                  <>
                    <input value={coAuthorQ} onChange={e=>searchCoAuthor(e.target.value)} placeholder="Поиск по имени или нику…"
                      style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(99,102,241,0.3)',color:'#fff',fontSize:12,outline:'none',fontFamily:'"Montserrat",sans-serif'}}/>
                    {coAuthorRes.length>0&&(
                      <div style={{display:'flex',flexDirection:'column',gap:4}}>
                        {coAuthorRes.map((u:any,i:number)=>{
                          const uName=u.pro_name||u.pro_full||u.scene_name||'Пользователь';
                          const uAv=u.pro_avatar||u.scene_avatar||'';
                          return(
                            <button key={i} onClick={()=>{setPostCoAuthor({hash:u.hash,name:uName,avatar:uAv});setCoAuthorQ('');setCoAuthorRes([]);}}
                              style={{display:'flex',alignItems:'center',gap:8,background:'rgba(255,255,255,0.05)',borderRadius:8,padding:'7px 10px',border:'1px solid rgba(255,255,255,0.08)',cursor:'pointer',width:'100%',textAlign:'left'}}>
                              <div style={{width:24,height:24,borderRadius:'50%',overflow:'hidden',flexShrink:0}}>
                                {uAv?<img src={uAv} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:12}}>👤</span>}
                              </div>
                              <span style={{fontSize:12,color:'#fff',fontWeight:700}}>{uName}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Анонимное голосование ── */}
          {postHasPoll&&postIsAnonVoting&&(
            <div style={{borderRadius:12,border:'1px solid rgba(139,92,246,0.4)',background:'rgba(139,92,246,0.06)',transition:'all 0.25s'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
                <span style={{fontSize:14}}>🕵️</span>
                <span style={{flex:1,fontSize:12,color:'#c4b5fd',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>Анонимное голосование</span>
                <button onClick={()=>setPostIsAnonVoting(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',lineHeight:1,padding:'2px 6px'}}>✕</button>
              </div>
            </div>
          )}

          {/* ── Таймер публикации ── */}
          {showTimer&&(
            <div style={{borderRadius:12,border:'1px solid rgba(251,191,36,0.4)',background:'rgba(251,191,36,0.05)',overflow:'hidden',transition:'all 0.25s'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
                <span style={{fontSize:14}}>⏰</span>
                <span style={{flex:1,fontSize:12,color:'#fbbf24',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>Таймер публикации</span>
                <button onClick={()=>{setShowTimer(false);setPostPublishAt('');setPostExpiresAt('');}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',lineHeight:1,padding:'2px 6px'}}>✕</button>
              </div>
              <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:10}}>
                <div>
                  <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginBottom:4,fontWeight:600}}>📅 Запланировать на (необязательно):</div>
                  <input type="datetime-local" value={postPublishAt} min={new Date().toISOString().slice(0,16)}
                    onChange={e=>setPostPublishAt(e.target.value)}
                    style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(251,191,36,0.3)',color:'#fff',fontSize:12,outline:'none',colorScheme:'dark'} as React.CSSProperties}/>
                </div>
                <div>
                  <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginBottom:4,fontWeight:600}}>⏳ Пост исчезнет (необязательно):</div>
                  <input type="datetime-local" value={postExpiresAt} min={postPublishAt||new Date().toISOString().slice(0,16)}
                    onChange={e=>setPostExpiresAt(e.target.value)}
                    style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(251,191,36,0.3)',color:'#fff',fontSize:12,outline:'none',colorScheme:'dark'} as React.CSSProperties}/>
                </div>
                {(postPublishAt||postExpiresAt)&&(
                  <button onClick={()=>{setPostPublishAt('');setPostExpiresAt('');}} style={{background:'none',border:'1px solid rgba(255,255,255,0.1)',borderRadius:8,padding:'6px',color:'rgba(255,255,255,0.35)',fontSize:11,cursor:'pointer',fontFamily:'"Montserrat",sans-serif'}}>
                    Очистить
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Геолокация ── */}
          {showGeo&&(
            <div style={{borderRadius:12,border:'1px solid rgba(34,197,94,0.4)',background:'rgba(34,197,94,0.05)',transition:'all 0.25s'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
                <span style={{fontSize:14}}>📍</span>
                <span style={{flex:1,fontSize:12,color:'#4ade80',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>Геолокация поста</span>
                {postGeo&&<span style={{fontSize:10,color:'#4ade80',fontWeight:800}}>{postGeo.city}</span>}
                <button onClick={()=>{setShowGeo(false);setPostGeo(null);}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',lineHeight:1,padding:'2px 6px'}}>✕</button>
              </div>
              <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:8}}>
                {postGeo?(
                  <div style={{display:'flex',alignItems:'center',gap:8,background:'rgba(34,197,94,0.08)',borderRadius:10,padding:'8px 10px'}}>
                    <span style={{fontSize:18}}>📍</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:12,fontWeight:800,color:'#4ade80'}}>{postGeo.city}</div>
                      <div style={{fontSize:10,color:'rgba(255,255,255,0.35)'}}>Будет отображаться на посте</div>
                    </div>
                    <button onClick={()=>setPostGeo(null)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.35)',cursor:'pointer',fontSize:14,lineHeight:1}}>✕</button>
                  </div>
                ):(
                  <motion.button whileTap={{scale:0.95}} onClick={getGeo} disabled={geoLoading}
                    style={{padding:'9px',borderRadius:8,border:'1px solid rgba(34,197,94,0.3)',background:'rgba(34,197,94,0.06)',color:'#4ade80',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'"Montserrat",sans-serif'}}>
                    {geoLoading?'⌛ Определяем...':'📍 Определить моё местоположение'}
                  </motion.button>
                )}
              </div>
            </div>
          )}

          {/* ── Карусель / галерея ── */}
          {(showCarousel||postImages.length>0)&&(
            <div style={{borderRadius:12,border:'1px solid rgba(251,146,60,0.4)',background:'rgba(251,146,60,0.05)',overflow:'hidden',transition:'all 0.25s'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
                <span style={{fontSize:14}}>🖼️</span>
                <span style={{flex:1,fontSize:12,color:'#fb923c',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>Карусель ({postImages.length}/10)</span>
                <button onClick={()=>{postImages.forEach(x=>URL.revokeObjectURL(x.url));setPostImages([]);setShowCarousel(false);}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',lineHeight:1,padding:'2px 6px'}}>✕</button>
              </div>
              <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:8}}>
                <input ref={carouselRef} type="file" accept="image/*" multiple style={{display:'none'}} onChange={e=>{addCarouselImages(e.target.files);if(e.target)e.target.value='';}}/>
                {postImages.length>0&&(
                  <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:4}}>
                    {postImages.map((im,i)=>(
                      <div key={i} style={{position:'relative',width:64,height:64,borderRadius:8,overflow:'hidden',flexShrink:0,border:'1px solid rgba(251,146,60,0.3)'}}>
                        <img src={im.url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                        <button onClick={()=>removeCarouselImage(i)} style={{position:'absolute',top:2,right:2,width:18,height:18,borderRadius:'50%',background:'rgba(0,0,0,0.7)',border:'none',color:'#fff',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',padding:0}}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {postImages.length<10&&(
                  <button onClick={()=>carouselRef.current?.click()} style={{padding:'9px',borderRadius:8,border:'1px dashed rgba(251,146,60,0.4)',background:'rgba(251,146,60,0.06)',color:'#fb923c',fontSize:12,fontWeight:700,cursor:'pointer',fontFamily:'"Montserrat",sans-serif'}}>
                    + Добавить фото ({10-postImages.length} осталось)
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ── Превью ссылки ── */}
          {showLinkPreview&&(
            <div style={{borderRadius:12,border:'1px solid rgba(96,165,250,0.4)',background:'rgba(96,165,250,0.05)',overflow:'hidden',transition:'all 0.25s'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
                <span style={{fontSize:14}}>🔗</span>
                <span style={{flex:1,fontSize:12,color:'#60a5fa',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>Превью ссылки</span>
                <button onClick={()=>{setShowLinkPreview(false);setLinkUrl('');setLinkPreview(null);}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',lineHeight:1,padding:'2px 6px'}}>✕</button>
              </div>
              <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:8}}>
                <div style={{display:'flex',gap:6}}>
                  <input value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} placeholder="https://..."
                    style={{flex:1,boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(96,165,250,0.3)',color:'#fff',fontSize:12,outline:'none',fontFamily:'"Montserrat",sans-serif'}}/>
                  <button onClick={()=>fetchLinkPreview(linkUrl)} disabled={linkLoading||!linkUrl.trim()} style={{padding:'8px 13px',borderRadius:8,background:'rgba(96,165,250,0.2)',border:'1px solid rgba(96,165,250,0.4)',color:'#93c5fd',fontSize:12,fontWeight:700,cursor:linkLoading?'wait':'pointer',flexShrink:0}}>
                    {linkLoading?'⌛':'Загрузить'}
                  </button>
                </div>
                {linkPreview&&(
                  <div style={{display:'flex',gap:8,padding:8,background:'rgba(96,165,250,0.08)',borderRadius:10,border:'1px solid rgba(96,165,250,0.25)'}}>
                    {linkPreview.image&&<img src={linkPreview.image} alt="" style={{width:60,height:60,borderRadius:6,objectFit:'cover',flexShrink:0}}/>}
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:800,color:'#fff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{linkPreview.title||linkPreview.url}</div>
                      {linkPreview.description&&<div style={{fontSize:10,color:'rgba(255,255,255,0.5)',marginTop:2,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden'}}>{linkPreview.description}</div>}
                      <div style={{fontSize:9,color:'#60a5fa',marginTop:3,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{linkPreview.url}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Вопрос подписчикам ── */}
          {showQuestion&&(
            <div style={{borderRadius:12,border:'1px solid rgba(244,114,182,0.4)',background:'rgba(244,114,182,0.05)',overflow:'hidden',transition:'all 0.25s'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
                <span style={{fontSize:14}}>❓</span>
                <span style={{flex:1,fontSize:12,color:'#f472b6',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>Вопрос подписчикам</span>
                <button onClick={()=>{setShowQuestion(false);setPostQuestion('');}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',lineHeight:1,padding:'2px 6px'}}>✕</button>
              </div>
              <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:6}}>
                <input value={postQuestion} onChange={e=>setPostQuestion(e.target.value)} placeholder="Задайте вопрос (ответы придут в личку)…" maxLength={140}
                  style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(244,114,182,0.3)',color:'#fff',fontSize:12,outline:'none',fontFamily:'"Montserrat",sans-serif'}}/>
                <div style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>💬 Подписчики смогут ответить в чат, ответы видны только вам</div>
              </div>
            </div>
          )}

          {/* ── Викторина / квиз ── */}
          {showQuiz&&postHasPoll&&pollOptions.filter(o=>o.trim()).length>=2&&(
            <div style={{borderRadius:12,border:'1px solid rgba(253,224,71,0.4)',background:'rgba(253,224,71,0.05)',overflow:'hidden',transition:'all 0.25s'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
                <span style={{fontSize:14}}>🎯</span>
                <span style={{flex:1,fontSize:12,color:'#fde047',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>Викторина — отметьте правильный ответ</span>
                <button onClick={()=>setShowQuiz(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',lineHeight:1,padding:'2px 6px'}}>✕</button>
              </div>
              <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:5}}>
                {pollOptions.filter(o=>o.trim()).map((o,i)=>(
                  <button key={i} onClick={()=>setQuizCorrect(i)}
                    style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',borderRadius:8,
                      background:quizCorrect===i?'rgba(253,224,71,0.15)':'rgba(255,255,255,0.04)',
                      border:`1px solid ${quizCorrect===i?'rgba(253,224,71,0.5)':'rgba(255,255,255,0.08)'}`,
                      cursor:'pointer',textAlign:'left',color:'#fff',fontSize:12,fontFamily:'"Montserrat",sans-serif'}}>
                    <span style={{fontSize:14}}>{quizCorrect===i?'✅':'⚪'}</span>
                    <span style={{flex:1}}>{o}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Челлендж ── */}
          {showChallenge&&(
            <div style={{borderRadius:12,border:'1px solid rgba(249,115,22,0.4)',background:'rgba(249,115,22,0.05)',overflow:'hidden',transition:'all 0.25s'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
                <span style={{fontSize:14}}>🏆</span>
                <span style={{flex:1,fontSize:12,color:'#f97316',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>Челлендж</span>
                <button onClick={()=>{setShowChallenge(false);setChallengeTitle('');setChallengeDeadline('');setChallengeHashtag('');}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',lineHeight:1,padding:'2px 6px'}}>✕</button>
              </div>
              <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:8}}>
                <input value={challengeTitle} onChange={e=>setChallengeTitle(e.target.value)} placeholder="Название челленджа: например, 7 дней без сахара" maxLength={80}
                  style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(249,115,22,0.3)',color:'#fff',fontSize:12,fontWeight:700,outline:'none',fontFamily:'"Montserrat",sans-serif'}}/>
                <input value={challengeHashtag} onChange={e=>setChallengeHashtag(e.target.value.replace(/^#/,'').replace(/\s+/g,'_'))} placeholder="Хештег для участников: #7днейбезсахара" maxLength={40}
                  style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(249,115,22,0.3)',color:'#fff',fontSize:12,outline:'none',fontFamily:'"Montserrat",sans-serif'}}/>
                <div>
                  <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginBottom:4,fontWeight:600}}>⏳ Дедлайн (когда подвести итоги):</div>
                  <input type="datetime-local" value={challengeDeadline} min={new Date().toISOString().slice(0,16)} onChange={e=>setChallengeDeadline(e.target.value)}
                    style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.07)',border:'1px solid rgba(249,115,22,0.3)',color:'#fff',fontSize:12,outline:'none',colorScheme:'dark'} as React.CSSProperties}/>
                </div>
              </div>
            </div>
          )}

          {/* ── Активность ── */}
          {showActivity&&(
            <div style={{borderRadius:12,border:'1px solid rgba(251,191,36,0.4)',background:'rgba(251,191,36,0.05)',overflow:'hidden',transition:'all 0.25s'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
                <span style={{fontSize:14}}>🎬</span>
                <span style={{flex:1,fontSize:12,color:'#fbbf24',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>Активность</span>
                <button onClick={()=>{setShowActivity(false);setActivityTitle('');}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',lineHeight:1,padding:'2px 6px'}}>✕</button>
              </div>
              <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:8}}>
                <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                  {ACTIVITIES.map(a=>(
                    <button key={a.k} onClick={()=>setActivityType(a.k)}
                      style={{display:'flex',alignItems:'center',gap:5,padding:'6px 10px',borderRadius:20,
                        background:activityType===a.k?'rgba(251,191,36,0.18)':'rgba(255,255,255,0.04)',
                        border:`1px solid ${activityType===a.k?'rgba(251,191,36,0.5)':'rgba(255,255,255,0.08)'}`,
                        color:activityType===a.k?'#fbbf24':'rgba(255,255,255,0.6)',fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:'"Montserrat",sans-serif'}}>
                      <span>{a.e}</span><span>{a.l}</span>
                    </button>
                  ))}
                </div>
                <input value={activityTitle} onChange={e=>setActivityTitle(e.target.value)} placeholder="Название…" maxLength={80}
                  style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(251,191,36,0.3)',color:'#fff',fontSize:12,outline:'none',fontFamily:'"Montserrat",sans-serif'}}/>
              </div>
            </div>
          )}

          {/* ── Отметить людей ── */}
          {(showMentions||postMentions.length>0)&&(
            <div style={{borderRadius:12,border:'1px solid rgba(167,139,250,0.4)',background:'rgba(167,139,250,0.05)',overflow:'hidden',transition:'all 0.25s'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
                <span style={{fontSize:14}}>🏷️</span>
                <span style={{flex:1,fontSize:12,color:'#a78bfa',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>Отметить людей ({postMentions.length}/10)</span>
                <button onClick={()=>{setShowMentions(false);setMentionQ('');setMentionRes([]);setPostMentions([]);}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',lineHeight:1,padding:'2px 6px'}}>✕</button>
              </div>
              <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:8}}>
                {postMentions.length>0&&(
                  <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                    {postMentions.map(m=>(
                      <div key={m.hash} style={{display:'flex',alignItems:'center',gap:5,background:'rgba(167,139,250,0.12)',border:'1px solid rgba(167,139,250,0.3)',borderRadius:20,padding:'4px 4px 4px 4px'}}>
                        <div style={{width:18,height:18,borderRadius:'50%',overflow:'hidden',flexShrink:0}}>
                          {m.avatar?<img src={m.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:10}}>👤</span>}
                        </div>
                        <span style={{fontSize:11,color:'#c4b5fd',fontWeight:700,paddingRight:4}}>{m.name}</span>
                        <button onClick={()=>removeMention(m.hash)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',padding:'0 4px',fontSize:11,lineHeight:1}}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {postMentions.length<10&&(
                  <input value={mentionQ} onChange={e=>searchMention(e.target.value)} placeholder="Поиск по имени или нику…"
                    style={{width:'100%',boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(167,139,250,0.3)',color:'#fff',fontSize:12,outline:'none',fontFamily:'"Montserrat",sans-serif'}}/>
                )}
                {mentionRes.length>0&&(
                  <div style={{display:'flex',flexDirection:'column',gap:4}}>
                    {mentionRes.map((u:any,i:number)=>{
                      const uName=u.pro_name||u.pro_full||u.scene_name||'Пользователь';
                      const uAv=u.pro_avatar||u.scene_avatar||'';
                      const already=postMentions.some(m=>m.hash===u.hash);
                      return(
                        <button key={i} disabled={already} onClick={()=>addMention(u)}
                          style={{display:'flex',alignItems:'center',gap:8,background:already?'rgba(167,139,250,0.05)':'rgba(255,255,255,0.05)',borderRadius:8,padding:'7px 10px',border:'1px solid rgba(255,255,255,0.08)',cursor:already?'not-allowed':'pointer',width:'100%',textAlign:'left',opacity:already?0.5:1}}>
                          <div style={{width:24,height:24,borderRadius:'50%',overflow:'hidden',flexShrink:0}}>
                            {uAv?<img src={uAv} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:12}}>👤</span>}
                          </div>
                          <span style={{fontSize:12,color:'#fff',fontWeight:700,flex:1}}>{uName}</span>
                          {already&&<span style={{fontSize:10,color:'#a78bfa'}}>✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Хештеги / темы ── */}
          {(showHashtags||postHashtags.length>0)&&(
            <div style={{borderRadius:12,border:'1px solid rgba(34,211,238,0.4)',background:'rgba(34,211,238,0.05)',overflow:'hidden',transition:'all 0.25s'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px'}}>
                <span style={{fontSize:14}}>#️⃣</span>
                <span style={{flex:1,fontSize:12,color:'#22d3ee',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>Хештеги ({postHashtags.length}/10)</span>
                <button onClick={()=>{setShowHashtags(false);setPostHashtags([]);setHashtagInput('');}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',lineHeight:1,padding:'2px 6px'}}>✕</button>
              </div>
              <div style={{padding:'0 12px 12px',display:'flex',flexDirection:'column',gap:8}}>
                {postHashtags.length>0&&(
                  <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                    {postHashtags.map(t=>(
                      <div key={t} style={{display:'flex',alignItems:'center',gap:4,background:'rgba(34,211,238,0.12)',border:'1px solid rgba(34,211,238,0.3)',borderRadius:20,padding:'4px 8px 4px 10px'}}>
                        <span style={{fontSize:11,color:'#67e8f9',fontWeight:700}}>#{t}</span>
                        <button onClick={()=>removeHashtag(t)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.4)',cursor:'pointer',padding:'0 2px',fontSize:11,lineHeight:1}}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                {postHashtags.length<10&&(
                  <div style={{display:'flex',gap:6}}>
                    <input value={hashtagInput} onChange={e=>setHashtagInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();addHashtag(hashtagInput);setHashtagInput('');}}} placeholder="Добавить хештег и Enter…"
                      style={{flex:1,boxSizing:'border-box',padding:'8px 10px',borderRadius:8,background:'rgba(255,255,255,0.06)',border:'1px solid rgba(34,211,238,0.3)',color:'#fff',fontSize:12,outline:'none',fontFamily:'"Montserrat",sans-serif'}}/>
                    <button onClick={()=>{addHashtag(hashtagInput);setHashtagInput('');}} disabled={!hashtagInput.trim()} style={{padding:'8px 13px',borderRadius:8,background:'rgba(34,211,238,0.2)',border:'1px solid rgba(34,211,238,0.4)',color:'#67e8f9',fontSize:12,fontWeight:700,cursor:'pointer',flexShrink:0}}>+</button>
                  </div>
                )}
                <div>
                  <div style={{fontSize:10,color:'rgba(255,255,255,0.35)',marginBottom:4,fontWeight:600}}>🔥 Популярные:</div>
                  <div style={{display:'flex',flexWrap:'wrap',gap:4}}>
                    {POPULAR_TAGS.filter(t=>!postHashtags.includes(t)).slice(0,10).map(t=>(
                      <button key={t} onClick={()=>addHashtag(t)} disabled={postHashtags.length>=10} style={{padding:'4px 9px',borderRadius:14,background:'rgba(34,211,238,0.06)',border:'1px solid rgba(34,211,238,0.2)',color:'#67e8f9',fontSize:10,cursor:postHashtags.length>=10?'not-allowed':'pointer',fontFamily:'"Montserrat",sans-serif',opacity:postHashtags.length>=10?0.4:1}}>
                        #{t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Фоновая музыка ── */}
          {(showBgMusic||postBgMusic)&&(
            <div style={{borderRadius:12,border:'1px solid rgba(236,72,153,0.35)',background:'rgba(236,72,153,0.05)',overflow:'hidden'}}>
              <div style={{display:'flex',alignItems:'center',gap:8,padding:'9px 12px',borderBottom:'1px solid rgba(236,72,153,0.18)'}}>
                <span style={{fontSize:14}}>🎵</span>
                <span style={{flex:1,fontSize:12,color:'#ec4899',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>Фоновая музыка{postBgMusic?` · ${postBgMusic.label}`:''}</span>
                <button onClick={()=>{if(bgMusPreviewRef.current){bgMusPreviewRef.current.pause();bgMusPreviewRef.current=null;}setBgMusPreviewId(null);setPostBgMusic(null);setShowBgMusic(false);}} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:14,cursor:'pointer',lineHeight:1,padding:'2px 6px'}}>✕</button>
              </div>
              <div style={{padding:10,display:'flex',flexDirection:'column',gap:10}}>
                <div style={{fontSize:10.5,color:'rgba(255,255,255,0.55)',fontFamily:'"Montserrat",sans-serif',lineHeight:1.4}}>
                  Музыка автоматически включится у читателя, когда пост попадёт в зону видимости. Нажмите ▶ для предпрослушивания.
                </div>
                {(['Кинематограф','Детектив','Природа'] as const).map(cat=>(
                  <div key={cat}>
                    <div style={{fontSize:10,color:'rgba(255,255,255,0.45)',fontWeight:700,letterSpacing:0.5,textTransform:'uppercase',marginBottom:6,fontFamily:'"Montserrat",sans-serif'}}>{cat}</div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:6}}>
                      {BG_MUSIC_PRESETS.filter(p=>p.cat===cat).map(p=>{
                        const sel=postBgMusic?.id===p.id;
                        const playing=bgMusPreviewId===p.id;
                        return (
                          <div key={p.id} style={{display:'flex',alignItems:'center',gap:6,padding:'8px 9px',borderRadius:9,border:`1px solid ${sel?'#ec4899':'rgba(255,255,255,0.1)'}`,background:sel?'rgba(236,72,153,0.12)':'rgba(255,255,255,0.025)'}}>
                            <button onClick={()=>previewBgMusic(p)} style={{width:24,height:24,borderRadius:'50%',border:'none',background:playing?'#ec4899':'rgba(255,255,255,0.12)',color:'#fff',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{playing?'■':'▶'}</button>
                            <div onClick={()=>setPostBgMusic(p)} style={{flex:1,cursor:'pointer',minWidth:0}}>
                              <div style={{fontSize:11,color:sel?'#ec4899':'#fff',fontWeight:600,fontFamily:'"Montserrat",sans-serif',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.emoji} {p.label}</div>
                            </div>
                            {sel&&<span style={{fontSize:11,color:'#ec4899'}}>✓</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Простые флаги: TTS / Stats / NoComm / NoRepost ── */}
          {(postEnableTTS||postEnableStats||postDisableComments||postDisableRepost)&&(
            <div style={{display:'flex',flexDirection:'column',gap:6}}>
              {postEnableTTS&&(
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,border:'1px solid rgba(52,211,153,0.35)',background:'rgba(52,211,153,0.06)'}}>
                  <span style={{fontSize:13}}>🔊</span>
                  <span style={{flex:1,fontSize:11,color:'#34d399',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>Озвучка текста (TTS включена)</span>
                  <button onClick={()=>setPostEnableTTS(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:13,cursor:'pointer',lineHeight:1,padding:'2px 6px'}}>✕</button>
                </div>
              )}
              {postEnableStats&&(
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,border:'1px solid rgba(163,230,53,0.35)',background:'rgba(163,230,53,0.06)'}}>
                  <span style={{fontSize:13}}>📈</span>
                  <span style={{flex:1,fontSize:11,color:'#a3e635',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>Детальная статистика (охваты, демография)</span>
                  <button onClick={()=>setPostEnableStats(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:13,cursor:'pointer',lineHeight:1,padding:'2px 6px'}}>✕</button>
                </div>
              )}
              {postDisableComments&&(
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,border:'1px solid rgba(248,113,113,0.35)',background:'rgba(248,113,113,0.06)'}}>
                  <span style={{fontSize:13}}>🚫</span>
                  <span style={{flex:1,fontSize:11,color:'#f87171',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>Комментарии запрещены</span>
                  <button onClick={()=>setPostDisableComments(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:13,cursor:'pointer',lineHeight:1,padding:'2px 6px'}}>✕</button>
                </div>
              )}
              {postDisableRepost&&(
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:10,border:'1px solid rgba(248,113,113,0.35)',background:'rgba(248,113,113,0.06)'}}>
                  <span style={{fontSize:13}}>♻️</span>
                  <span style={{flex:1,fontSize:11,color:'#f87171',fontWeight:700,fontFamily:'"Montserrat",sans-serif'}}>Репост запрещён</span>
                  <button onClick={()=>setPostDisableRepost(false)} style={{background:'none',border:'none',color:'rgba(255,255,255,0.45)',fontSize:13,cursor:'pointer',lineHeight:1,padding:'2px 6px'}}>✕</button>
                </div>
              )}
            </div>
          )}

          {/* Нижняя панель */}
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
              {!voiceRec&&<motion.button whileTap={{scale:0.88}} onClick={()=>imgRef.current?.click()} style={{width:38,height:38,borderRadius:'50%',border:`1px solid ${c.border}`,background:imgFile?'rgba(59,130,246,0.2)':c.card,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontSize:17}}>📷</span></motion.button>}
              {!voiceRec&&<motion.button whileTap={{scale:0.88}} onClick={()=>vidRef.current?.click()} style={{width:38,height:38,borderRadius:'50%',border:`1px solid ${c.border}`,background:vidFile?'rgba(168,85,247,0.2)':c.card,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontSize:17}}>🎬</span></motion.button>}
              {!voiceRec&&<motion.button whileTap={{scale:0.88}} onClick={()=>docRef.current?.click()} style={{width:38,height:38,borderRadius:'50%',border:`1px solid ${c.border}`,background:docFiles.length?'rgba(234,179,8,0.2)':c.card,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontSize:17}}>📎</span></motion.button>}
              {!voiceRec&&!musicFile&&<motion.button whileTap={{scale:0.88}} onClick={openSelfie} style={{width:38,height:38,borderRadius:'50%',border:`1px solid ${c.border}`,background:c.card,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontSize:17}}>🎥</span></motion.button>}
              {!voiceRec&&!musicFile&&<motion.button whileTap={{scale:0.88}} onClick={()=>musicRef.current?.click()} style={{width:38,height:38,borderRadius:'50%',border:`1px solid ${c.border}`,background:c.card,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontSize:17}}>🎵</span></motion.button>}
              {!voiceRec&&onPickFromPlaylist&&!playlistTrack&&<motion.button whileTap={{scale:0.88}} onClick={onPickFromPlaylist} style={{width:38,height:38,borderRadius:'50%',border:`1px solid rgba(99,102,241,0.4)`,background:'rgba(99,102,241,0.1)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}} title="Трек из плейлиста"><span style={{fontSize:15}}>📀</span></motion.button>}
              {!voiceUrl&&!voiceRec&&!musicFile&&<motion.button whileTap={{scale:0.88}} onClick={startVoice} style={{width:38,height:38,borderRadius:'50%',border:`1px solid ${c.border}`,background:c.card,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><span style={{fontSize:17}}>🎙️</span></motion.button>}
            </div>
            {contentError&&(
              <div style={{margin:'6px 0',padding:'8px 12px',background:'rgba(239,68,68,0.12)',border:'1px solid rgba(239,68,68,0.4)',borderRadius:10,display:'flex',alignItems:'flex-start',gap:8}}>
                <span style={{fontSize:15,flexShrink:0}}>🚫</span>
                <span style={{fontSize:12,color:'#fca5a5',lineHeight:1.4}}>{contentError}</span>
              </div>
            )}
            <div style={{display:'flex',gap:8,alignItems:'center',justifyContent:'flex-end'}}>
              <button onClick={()=>{setOpen(false);reset();}} style={{padding:'9px 18px',borderRadius:22,border:`1px solid ${c.border}`,background:'transparent',color:c.sub,fontSize:13,fontFamily:'"Montserrat",sans-serif',cursor:'pointer',flexShrink:0}}>Отмена</button>
              {voiceUrl?(
                <motion.button whileTap={{scale:0.95}} onClick={sendVoice} disabled={voiceSending} style={{padding:'9px 22px',borderRadius:22,border:'none',background:voiceSending?c.cardAlt:'#3b82f6',color:voiceSending?c.sub:'#fff',fontSize:13,fontWeight:700,fontFamily:'"Montserrat",sans-serif',cursor:'pointer',flexShrink:0}}>
                  {voiceSending?'...':'🎙️ Опубликовать'}
                </motion.button>
              ):(
                <button onClick={handlePost} disabled={!canPost} style={{padding:'9px 22px',borderRadius:22,border:'none',background:canPost?accent:c.cardAlt,color:canPost?'#fff':c.sub,fontSize:13,fontWeight:700,fontFamily:'"Montserrat",sans-serif',cursor:canPost?'pointer':'default',flexShrink:0}}>
                  {vidLoading?`🎬 ${vidProgress}%`:docLoading?'📎 ...':musicLoading?'🎵 MP3...':submitting||imgLoading?'...':'Опубликовать'}
                </button>
              )}
            </div>
          </div>
        </div>
      ):(
        <button onClick={()=>setOpen(true)} style={{width:'100%',background:c.cardAlt,border:`1px solid ${c.border}`,borderRadius:26,padding:'14px 20px',display:'flex',alignItems:'center',gap:14,cursor:'pointer',textAlign:'left'}}>
          <div style={{width:36,height:36,borderRadius:'50%',overflow:'hidden',flexShrink:0,background:c.border,display:'flex',alignItems:'center',justifyContent:'center'}}>
            {avatarUrl?<img src={avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span style={{fontSize:16,color:c.sub}}>👤</span>}
          </div>
          <span style={{color:c.sub,fontSize:15,fontFamily:'"Montserrat",sans-serif'}}>Что у вас нового?</span>
        </button>
      )}
      {/* Селфи-модал */}
      <AnimatePresence>
        {selfieOpen&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{position:'fixed',inset:0,zIndex:5900,background:'#080810',display:'flex',flexDirection:'column',fontFamily:"'Montserrat',sans-serif"}}>
            <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 14px',borderBottom:'1px solid rgba(255,255,255,0.08)',flexShrink:0,background:'rgba(0,0,0,0.5)'}}>
              <button onClick={closeSelfie} style={{width:34,height:34,borderRadius:'50%',border:'1px solid rgba(255,255,255,0.18)',background:'rgba(255,255,255,0.06)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>✕</button>
              <span style={{flex:1,color:'#fff',fontWeight:700,fontSize:14}}>Видео-селфи</span>
              {!selfieRec&&!selfieBlob&&<button onClick={()=>setSelfieCamera(c=>c==='user'?'environment':'user')} style={{width:36,height:36,borderRadius:'50%',border:'1px solid rgba(255,255,255,0.18)',background:'rgba(255,255,255,0.06)',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>🔄</button>}
            </div>
            {!selfieBlob&&(
              <div style={{display:'flex',gap:8,padding:'8px 12px',overflowX:'auto',flexShrink:0,borderBottom:'1px solid rgba(255,255,255,0.06)',scrollbarWidth:'none'}}>
                {SELFIE_FRAMES.map(f=>(
                  <button key={f.id} onClick={()=>setSelfieFrame(f.id)} style={{flexShrink:0,padding:'5px 10px',borderRadius:20,border:`1px solid ${selfieFrame===f.id?'#7c3aed':'rgba(255,255,255,0.15)'}`,background:selfieFrame===f.id?'rgba(124,58,237,0.25)':'rgba(255,255,255,0.05)',color:selfieFrame===f.id?'#c084fc':'rgba(255,255,255,0.6)',fontSize:12,fontWeight:600,cursor:'pointer'}}>
                    {f.emoji} {f.label}
                  </button>
                ))}
              </div>
            )}
            <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',overflow:'hidden',padding:'8px 10px'}}>
              <SelfieFrameWrapper frameId={selfieFrame}>
                {selfieBlob?(
                  <video src={selfiePrev||''} autoPlay loop muted playsInline style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                ):(
                  <video ref={selfieVidRef} autoPlay muted playsInline style={{width:'100%',height:'100%',objectFit:'cover',transform:selfieCamera==='user'?'scaleX(-1)':undefined}}/>
                )}
              </SelfieFrameWrapper>
            </div>
            <div style={{flexShrink:0,padding:'12px 16px',borderTop:'1px solid rgba(255,255,255,0.08)',background:'rgba(0,0,0,0.5)'}}>
              {selfieBlob?(
                <div style={{display:'flex',gap:10}}>
                  <button onClick={discardSelfie} style={{flex:1,padding:'12px 0',borderRadius:14,border:'1px solid rgba(255,255,255,0.2)',background:'rgba(255,255,255,0.07)',color:'rgba(255,255,255,0.8)',fontWeight:600,fontSize:14,cursor:'pointer'}}>🔄 Переснять</button>
                  <button onClick={uploadSelfiePost} disabled={selfieLoading} style={{flex:1,padding:'12px 0',borderRadius:14,border:'none',background:selfieLoading?'rgba(124,58,237,0.4)':'linear-gradient(135deg,#7c3aed,#a855f7)',color:'#fff',fontWeight:700,fontSize:14,cursor:selfieLoading?'not-allowed':'pointer'}}>
                    {selfieLoading?`⬆️ ${selfieProgress}%`:'📤 Опубликовать'}
                  </button>
                </div>
              ):(
                <div style={{display:'flex',justifyContent:'center'}}>
                  <button onClick={selfieRec?stopSelfieRec:startSelfieRec} style={{width:72,height:72,borderRadius:'50%',border:selfieRec?'3px solid #ff3333':'3px solid rgba(255,255,255,0.3)',background:selfieRec?'rgba(255,51,51,0.15)':'rgba(255,255,255,0.1)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                    {selfieRec?<span style={{width:20,height:20,borderRadius:4,background:'#ff3333',display:'block'}}/>:<span style={{width:48,height:48,borderRadius:'50%',background:'#ff3333',display:'block'}}/>}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ════════════════════════ ЭКРАН КОНФЕРЕНЦИЙ ════════════════════════ */
function MeetingsScreen({apiBase,userHash,onBack}:{apiBase:string;userHash:string;onBack:()=>void}){
  type Meeting={
    id:number;meetingId:string;name:string;startTime:number|null;
    tokenType:string;commonToken:string|null;codeWord:string|null;
    tokenExpiry:number|null;allowAnonymous:boolean;anonymousToken:string|null;createdAt:string;
  };
  type CreateResult={meetingId:string;commonToken:string|null;inviteLink:string;anonymousToken:string|null;anonLink:string|null};

  const [meetings,setMeetings]=useState<Meeting[]>([]);
  const [creatorName,setCreatorName]=useState('');
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(true);
  const [showCreate,setShowCreate]=useState(false);
  const [creating,setCreating]=useState(false);
  const [result,setResult]=useState<CreateResult|null>(null);
  const [copied,setCopied]=useState<string|null>(null);
  const [lockedCard,setLockedCard]=useState<string|null>(null);
  const [fName,setFName]=useState('');
  const [fStartTime,setFStartTime]=useState('');
  const [fTokenType,setFTokenType]=useState<'open'|'common'|'individual'>('open');
  const [fCodeWord,setFCodeWord]=useState('');
  const [fTokenExpiry,setFTokenExpiry]=useState<'none'|'1h'|'1d'>('none');
  const [fAllowAnon,setFAllowAnon]=useState(false);
  const [fAnonGuest,setFAnonGuest]=useState(false);

  const API=window.location.origin;
  const getST=()=>{try{return localStorage.getItem('swaip_session');}catch{return null;}};

  const loadMeetings=async()=>{
    setLoading(true);
    try{
      const r=await fetch(`${API}/api/meetings/my`,{headers:{'x-session-token':getST()||''}});
      if(r.ok){const d=await r.json();setMeetings(d.meetings||[]);setCreatorName(d.creatorName||'');}
    }finally{setLoading(false);}
  };
  useEffect(()=>{loadMeetings();},[]);// eslint-disable-line

  const handleCreate=async()=>{
    if(!fName.trim()||creating)return;
    setCreating(true);
    try{
      const r=await fetch(`${API}/api/meetings/create`,{
        method:'POST',
        headers:{'Content-Type':'application/json','x-session-token':getST()||''},
        body:JSON.stringify({name:fName.trim(),startTime:fStartTime||undefined,tokenType:fTokenType,
          codeWord:fCodeWord.trim()||undefined,tokenExpiry:fTokenExpiry==='none'?undefined:fTokenExpiry,
          allowAnonymous:fAllowAnon,anonymousGuest:fAnonGuest}),
      });
      const d=await r.json();
      if(!r.ok){alert(d.error||'Ошибка создания');return;}
      setResult(d);setShowCreate(false);
      setFName('');setFStartTime('');setFTokenType('open');setFCodeWord('');setFTokenExpiry('none');setFAllowAnon(false);setFAnonGuest(false);
      await loadMeetings();
    }finally{setCreating(false);}
  };

  const handleDelete=async(meetingId:string)=>{
    if(!confirm('Удалить эту конференцию?'))return;
    await fetch(`${API}/api/meetings/${meetingId}`,{method:'DELETE',headers:{'x-session-token':getST()||''}});
    setMeetings(prev=>prev.filter(m=>m.meetingId!==meetingId));
  };

  const copyLink=(link:string,key?:string)=>{
    navigator.clipboard.writeText(link).catch(()=>{});
    const k=key||link;
    setCopied(k);setTimeout(()=>setCopied(prev=>prev===k?null:prev),2000);
  };
  const shareLink=async(link:string,name:string)=>{
    if(navigator.share){try{await navigator.share({title:name,url:link});}catch{}}
    else{copyLink(link);}
  };
  const fmtDate=(ts:number|null)=>{
    if(!ts)return null;
    return new Date(ts*1000).toLocaleString('ru-RU',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
  };
  const playDoorLocked=()=>{
    try{
      const AC=(window as any).AudioContext||(window as any).webkitAudioContext;
      const ctx=new AC();
      ([[523,0],[349,0.28]] as [number,number][]).forEach(([freq,delay])=>{
        const osc=ctx.createOscillator();const gain=ctx.createGain();
        osc.type='sine';osc.frequency.value=freq;
        gain.gain.setValueAtTime(0.28,ctx.currentTime+delay);
        gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+delay+0.22);
        osc.connect(gain);gain.connect(ctx.destination);
        osc.start(ctx.currentTime+delay);osc.stop(ctx.currentTime+delay+0.22);
      });
    }catch{}
  };
  const handleEnter=(m:Meeting)=>{
    const nowSec=Math.floor(Date.now()/1000);
    if(m.startTime&&nowSec<m.startTime){
      playDoorLocked();setLockedCard(m.meetingId);
      setTimeout(()=>setLockedCard(prev=>prev===m.meetingId?null:prev),3500);return;
    }
    window.location.href=`/meet/${m.meetingId}`;
  };

  const ACCENT='#6366f1';
  const DOOR_PALETTES=[
    {door:'linear-gradient(160deg,#1e1635 0%,#2a1f50 40%,#1a1230 100%)',frame:'#3d2e7a',nameplate:'rgba(255,255,255,0.07)',accent:'#a78bfa'},
    {door:'linear-gradient(160deg,#0f2318 0%,#1a3828 40%,#0b1a12 100%)',frame:'#1e5c38',nameplate:'rgba(255,255,255,0.07)',accent:'#4ade80'},
    {door:'linear-gradient(160deg,#1e0f0f 0%,#3a1818 40%,#150808 100%)',frame:'#7a2020',nameplate:'rgba(255,255,255,0.07)',accent:'#f87171'},
    {door:'linear-gradient(160deg,#101828 0%,#162034 40%,#0a1220 100%)',frame:'#1e3a6a',nameplate:'rgba(255,255,255,0.07)',accent:'#60a5fa'},
    {door:'linear-gradient(160deg,#1a160a 0%,#2e280e 40%,#120f08 100%)',frame:'#5c4a14',nameplate:'rgba(255,255,255,0.07)',accent:'#fbbf24'},
  ];
  const filteredMeetings=meetings.filter(m=>!search.trim()||m.name.toLowerCase().includes(search.toLowerCase())||m.meetingId.includes(search));

  return(
    <div style={{minHeight:'100dvh',background:'#080810',display:'flex',flexDirection:'column',fontFamily:'"Montserrat",sans-serif'}}>

      {/* Шапка */}
      <div style={{display:'flex',alignItems:'center',padding:'14px 16px 12px',gap:12,
        borderBottom:'1px solid rgba(255,255,255,0.06)',background:'rgba(10,10,20,0.9)',
        position:'sticky',top:0,zIndex:10,backdropFilter:'blur(16px)'}}>
        <motion.button whileTap={{scale:0.88}} onClick={onBack}
          style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',
            color:'#fff',fontSize:17,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>←</motion.button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:17,fontWeight:900,color:'#fff',letterSpacing:'0.02em'}}>Конференции</div>
          <div style={{fontSize:11,color:'rgba(255,255,255,0.3)',marginTop:1}}>
            {meetings.length>0?`${meetings.length} конференци${meetings.length===1?'я':meetings.length<5?'и':'й'}`:'Презентации · Планёрки · Обсуждение'}
          </div>
        </div>
        <motion.button whileTap={{scale:0.93}} onClick={()=>setShowCreate(true)}
          style={{background:`linear-gradient(135deg,${ACCENT},#818cf8)`,border:'none',borderRadius:12,
            padding:'8px 15px',color:'#fff',fontSize:12,fontWeight:800,cursor:'pointer',letterSpacing:'0.04em',flexShrink:0}}>
          + Создать
        </motion.button>
      </div>

      {/* Поиск */}
      {meetings.length>0&&(
        <div style={{padding:'10px 16px 0',background:'rgba(10,10,20,0.9)',backdropFilter:'blur(16px)'}}>
          <div style={{position:'relative'}}>
            <span style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',fontSize:14,color:'rgba(255,255,255,0.25)',pointerEvents:'none'}}>🔍</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по названию или ID..."
              style={{width:'100%',boxSizing:'border-box',padding:'9px 12px 9px 36px',
                background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.08)',borderRadius:12,
                color:'#fff',fontSize:13,fontFamily:'"Montserrat",sans-serif',outline:'none'}}/>
          </div>
          <div style={{height:10}}/>
        </div>
      )}

      {/* Список */}
      <div style={{flex:1,overflowY:'auto',padding:'16px'}}>
        {loading?(
          <div style={{textAlign:'center',paddingTop:80,color:'rgba(255,255,255,0.25)',fontSize:14}}>
            <div style={{fontSize:32,marginBottom:12}}>🚪</div>Открываем двери...
          </div>
        ):meetings.length===0?(
          <div style={{textAlign:'center',paddingTop:80}}>
            <div style={{fontSize:64,marginBottom:16}}>🚪</div>
            <div style={{fontSize:18,fontWeight:800,color:'#fff',marginBottom:8}}>Пока пусто</div>
            <div style={{fontSize:14,color:'rgba(255,255,255,0.35)',lineHeight:1.6,maxWidth:260,margin:'0 auto 24px'}}>
              Создайте конференцию — выберите тип доступа и пригласите участников
            </div>
            <motion.button whileTap={{scale:0.93}} onClick={()=>setShowCreate(true)}
              style={{background:`linear-gradient(135deg,${ACCENT},#818cf8)`,border:'none',borderRadius:14,
                padding:'12px 24px',color:'#fff',fontSize:14,fontWeight:800,cursor:'pointer'}}>
              + Создать конференцию
            </motion.button>
          </div>
        ):filteredMeetings.length===0?(
          <div style={{textAlign:'center',paddingTop:60,color:'rgba(255,255,255,0.3)',fontSize:14}}>Ничего не найдено по «{search}»</div>
        ):(
          <div style={{display:'flex',flexDirection:'column',gap:20}}>
            {filteredMeetings.map((m,idx)=>{
              const link=m.commonToken?`${API}/meet/${m.meetingId}?token=${m.commonToken}`:`${API}/meet/${m.meetingId}`;
              const pal=DOOR_PALETTES[idx%DOOR_PALETTES.length];
              const isCopied=copied===m.meetingId;
              const isLocked=lockedCard===m.meetingId;
              const nowSec=Math.floor(Date.now()/1000);
              const doorClosed=!!(m.startTime&&nowSec<m.startTime);
              return(
                <motion.div key={m.meetingId} layout
                  initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} transition={{delay:idx*0.04}}
                  style={{borderRadius:18,overflow:'hidden',border:`2px solid ${pal.frame}`,
                    background:pal.door,boxShadow:'0 8px 32px rgba(0,0,0,0.55)'}}>
                  {/* Табличка */}
                  <div style={{padding:'18px 18px 14px',position:'relative'}}>
                    <div style={{position:'absolute',top:0,left:0,right:0,height:2,
                      background:`linear-gradient(90deg,transparent,${pal.accent}50,transparent)`}}/>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
                      <div style={{display:'inline-flex',alignItems:'center',gap:6,
                        background:'rgba(0,0,0,0.45)',border:`1.5px solid ${pal.frame}`,borderRadius:8,padding:'5px 12px'}}>
                        <span style={{fontSize:9,color:'rgba(255,255,255,0.4)',fontWeight:700,letterSpacing:'0.2em',textTransform:'uppercase'}}>КАБ.</span>
                        <span style={{fontSize:15,fontWeight:900,color:pal.accent,letterSpacing:'0.12em',fontFamily:'monospace'}}>
                          {m.meetingId.toUpperCase()}
                        </span>
                      </div>
                      {m.startTime&&(
                        <span style={{fontSize:11,color:doorClosed?'#fca5a5':'rgba(255,255,255,0.4)',fontWeight:doorClosed?700:400,display:'flex',alignItems:'center',gap:4}}>
                          {doorClosed?'🔒':'📅'} {fmtDate(m.startTime)}
                        </span>
                      )}
                    </div>
                    <div style={{fontSize:19,fontWeight:900,color:'#fff',lineHeight:1.2,wordBreak:'break-word',marginBottom:6}}>{m.name}</div>
                    {creatorName&&<div style={{fontSize:12,color:'rgba(255,255,255,0.38)',display:'flex',alignItems:'center',gap:5}}>👤 {creatorName}</div>}
                  </div>
                  <div style={{height:1,background:`linear-gradient(90deg,transparent,${pal.frame},transparent)`,margin:'0 18px'}}/>
                  {/* Кнопка войти */}
                  <div style={{padding:'14px 18px'}}>
                    <AnimatePresence mode="wait">
                      {isLocked?(
                        <motion.div key="locked" initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.95}}
                          style={{background:'rgba(239,68,68,0.1)',border:'1.5px solid rgba(239,68,68,0.35)',borderRadius:13,padding:'13px 16px',display:'flex',alignItems:'center',gap:12}}>
                          <motion.span animate={{opacity:[1,0.2,1,0.2,1]}} transition={{duration:0.6,repeat:3}} style={{fontSize:22}}>❌</motion.span>
                          <div>
                            <div style={{fontSize:13,color:'#fca5a5',fontWeight:800}}>Вход закрыт</div>
                            <div style={{fontSize:11,color:'rgba(252,165,165,0.6)',marginTop:2}}>Откроется: {fmtDate(m.startTime)}</div>
                          </div>
                        </motion.div>
                      ):(
                        <motion.button key="enter" whileTap={{scale:0.97}} onClick={()=>handleEnter(m)}
                          style={{width:'100%',boxSizing:'border-box',padding:'14px 0',cursor:'pointer',borderRadius:13,
                            background:doorClosed?'rgba(107,114,128,0.15)':`linear-gradient(135deg,${ACCENT} 0%,#818cf8 100%)`,
                            border:`2px solid ${doorClosed?'rgba(107,114,128,0.3)':pal.accent}`,
                            display:'flex',alignItems:'center',justifyContent:'center',gap:10,
                            fontFamily:'"Montserrat",sans-serif',color:'#fff',fontWeight:900,fontSize:16,letterSpacing:'0.12em',
                            boxShadow:doorClosed?'none':`0 5px 20px ${ACCENT}55`,transition:'all 0.2s'}}>
                          <span style={{fontSize:20}}>{doorClosed?'🔒':'🚪'}</span>ВОЙТИ
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>
                  {/* Нижняя панель */}
                  <div style={{borderTop:`1px solid ${pal.frame}50`,padding:'10px 18px 14px',display:'flex',alignItems:'center',gap:8}}>
                    <div style={{flex:1,fontSize:11,color:'rgba(255,255,255,0.3)',fontWeight:700,letterSpacing:'0.04em'}}>
                      {m.tokenType==='open'?'🚪 Вход общий':'🔑 Вход по токену'}
                    </div>
                    <div style={{display:'flex',gap:6,flexShrink:0}}>
                      <motion.button whileTap={{scale:0.85}} onClick={()=>copyLink(link,m.meetingId)} title="Скопировать ссылку"
                        style={{width:36,height:36,borderRadius:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                          background:isCopied?'rgba(74,222,128,0.15)':'rgba(255,255,255,0.07)',
                          border:`1.5px solid ${isCopied?'rgba(74,222,128,0.5)':pal.frame}`,
                          color:isCopied?'#4ade80':'rgba(255,255,255,0.45)',fontSize:15,transition:'all 0.2s'}}>
                        {isCopied?'✓':'📋'}
                      </motion.button>
                      <motion.button whileTap={{scale:0.85}} onClick={()=>shareLink(link,m.name)} title="Поделиться"
                        style={{width:36,height:36,borderRadius:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                          background:'rgba(255,255,255,0.07)',border:`1.5px solid ${pal.frame}`,color:'rgba(255,255,255,0.45)',fontSize:15}}>↗</motion.button>
                      <motion.button whileTap={{scale:0.85}} onClick={()=>handleDelete(m.meetingId)} title="Удалить"
                        style={{width:36,height:36,borderRadius:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
                          background:'rgba(239,68,68,0.07)',border:'1.5px solid rgba(239,68,68,0.2)',color:'rgba(248,113,113,0.6)',fontSize:15}}>🗑️</motion.button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        <div style={{height:32}}/>
      </div>

      {/* Модал создания */}
      <AnimatePresence>
        {showCreate&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:5000,display:'flex',flexDirection:'column',backdropFilter:'blur(8px)'}}>
            <motion.div initial={{y:60,opacity:0}} animate={{y:0,opacity:1}} exit={{y:60,opacity:0}}
              style={{position:'absolute',bottom:0,left:0,right:0,background:'#0f0f1a',
                borderRadius:'24px 24px 0 0',maxHeight:'92dvh',display:'flex',flexDirection:'column',
                border:'1px solid rgba(99,102,241,0.25)',borderBottom:'none'}}>
              <div style={{display:'flex',alignItems:'center',padding:'18px 16px 14px',borderBottom:'1px solid rgba(255,255,255,0.07)'}}>
                <motion.button whileTap={{scale:0.9}} onClick={()=>setShowCreate(false)}
                  style={{width:36,height:36,borderRadius:'50%',background:'rgba(255,255,255,0.08)',border:'none',color:'#fff',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',marginRight:12}}>←</motion.button>
                <div style={{fontSize:16,fontWeight:800,color:'#fff',flex:1}}>Создать конференцию</div>
              </div>
              <div style={{flex:1,overflowY:'auto',padding:'18px 16px',display:'flex',flexDirection:'column',gap:18}}>
                {/* Название */}
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.45)',marginBottom:8,letterSpacing:'0.06em',textTransform:'uppercase'}}>Название *</div>
                  <input value={fName} onChange={e=>setFName(e.target.value)} placeholder="Например: Еженедельная планёрка"
                    style={{width:'100%',background:'rgba(255,255,255,0.06)',border:`1.5px solid ${fName.trim()?'rgba(99,102,241,0.5)':'rgba(255,255,255,0.12)'}`,
                      borderRadius:12,padding:'13px 14px',color:'#fff',fontSize:15,outline:'none',boxSizing:'border-box',fontFamily:'inherit',transition:'border-color 0.2s'}}/>
                </div>
                {/* Дата */}
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.45)',marginBottom:8,letterSpacing:'0.06em',textTransform:'uppercase'}}>Дата и время начала</div>
                  <input type="datetime-local" value={fStartTime} onChange={e=>setFStartTime(e.target.value)}
                    style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1.5px solid rgba(255,255,255,0.12)',
                      borderRadius:12,padding:'13px 14px',color:'#fff',fontSize:14,outline:'none',boxSizing:'border-box',fontFamily:'inherit',colorScheme:'dark'}}/>
                </div>
                {/* Тип доступа */}
                <div>
                  <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.45)',marginBottom:10,letterSpacing:'0.06em',textTransform:'uppercase'}}>Тип доступа</div>
                  <div style={{display:'flex',gap:6,flexDirection:'column'}}>
                    {([
                      {t:'open',icon:'🚪',label:'Общий вход',desc:'Любой, кто видит кабинет, заходит без токена'},
                      {t:'common',icon:'🔑',label:'Общий токен',desc:'Один код для всех — вы сами раздаёте его нужным людям'},
                      {t:'individual',icon:'👤',label:'Индивидуальный',desc:'Каждому участнику — свой персональный токен'},
                    ] as const).map(({t,icon,label,desc})=>(
                      <motion.button key={t} whileTap={{scale:0.98}} onClick={()=>setFTokenType(t)}
                        style={{display:'flex',alignItems:'center',gap:12,padding:'12px 14px',borderRadius:12,
                          border:`1.5px solid ${fTokenType===t?ACCENT:'rgba(255,255,255,0.10)'}`,
                          background:fTokenType===t?`${ACCENT}18`:'rgba(255,255,255,0.03)',cursor:'pointer',textAlign:'left'}}>
                        <span style={{fontSize:20,flexShrink:0}}>{icon}</span>
                        <div>
                          <div style={{fontSize:13,fontWeight:800,color:fTokenType===t?'#a5b4fc':'rgba(255,255,255,0.6)'}}>{label}</div>
                          <div style={{fontSize:11,color:'rgba(255,255,255,0.28)',marginTop:1,lineHeight:1.4}}>{desc}</div>
                        </div>
                        {fTokenType===t&&<span style={{marginLeft:'auto',color:ACCENT,fontSize:16,flexShrink:0}}>✓</span>}
                      </motion.button>
                    ))}
                  </div>
                </div>
                {/* Кодовое слово */}
                {fTokenType!=='open'&&(
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.45)',marginBottom:8,letterSpacing:'0.06em',textTransform:'uppercase'}}>Кодовое слово (необязательно)</div>
                    <input value={fCodeWord} onChange={e=>setFCodeWord(e.target.value)} placeholder="Например: планёрка2025"
                      style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1.5px solid rgba(255,255,255,0.12)',
                        borderRadius:12,padding:'13px 14px',color:'#fff',fontSize:14,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}/>
                  </div>
                )}
                {/* Срок действия */}
                {fTokenType!=='open'&&(
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:'rgba(255,255,255,0.45)',marginBottom:8,letterSpacing:'0.06em',textTransform:'uppercase'}}>Срок действия токена</div>
                    <select value={fTokenExpiry} onChange={e=>setFTokenExpiry(e.target.value as 'none'|'1h'|'1d')}
                      style={{width:'100%',background:'rgba(255,255,255,0.06)',border:'1.5px solid rgba(255,255,255,0.12)',
                        borderRadius:12,padding:'13px 14px',color:'#fff',fontSize:14,outline:'none',boxSizing:'border-box',fontFamily:'inherit',cursor:'pointer',colorScheme:'dark'}}>
                      <option value="none">Бессрочно</option>
                      <option value="1h">1 час</option>
                      <option value="1d">1 день</option>
                    </select>
                  </div>
                )}
                {/* Тайные гости */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                  background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:14,padding:'14px'}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:'#fff',marginBottom:2}}>👻 Разрешить тайных гостей</div>
                    <div style={{fontSize:12,color:'rgba(255,255,255,0.4)'}}>Анонимные участники без аккаунта</div>
                  </div>
                  <motion.button whileTap={{scale:0.9}} onClick={()=>setFAllowAnon(!fAllowAnon)}
                    style={{width:48,height:26,borderRadius:13,background:fAllowAnon?ACCENT:'rgba(255,255,255,0.12)',
                      border:'none',cursor:'pointer',position:'relative',flexShrink:0,transition:'background 0.2s'}}>
                    <motion.div animate={{x:fAllowAnon?22:2}} transition={{type:'spring',stiffness:400,damping:28}}
                      style={{position:'absolute',top:3,width:20,height:20,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 4px rgba(0,0,0,0.4)'}}/>
                  </motion.button>
                </div>
                {/* Анонимный гость */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                  background:fAnonGuest?'rgba(99,102,241,0.06)':'rgba(255,255,255,0.04)',
                  border:`1px solid ${fAnonGuest?'rgba(99,102,241,0.35)':'rgba(255,255,255,0.09)'}`,borderRadius:14,padding:'14px',transition:'all 0.2s'}}>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:fAnonGuest?'#a5b4fc':'#fff',marginBottom:2}}>🎭 Анонимный гость</div>
                    <div style={{fontSize:12,color:'rgba(255,255,255,0.4)',lineHeight:1.4}}>
                      Отдельный токен для входа без имени.<br/>Гость не может рисовать и отправлять файлы.
                    </div>
                  </div>
                  <motion.button whileTap={{scale:0.9}} onClick={()=>setFAnonGuest(!fAnonGuest)}
                    style={{width:48,height:26,borderRadius:13,background:fAnonGuest?ACCENT:'rgba(255,255,255,0.12)',
                      border:'none',cursor:'pointer',position:'relative',flexShrink:0,transition:'background 0.2s'}}>
                    <motion.div animate={{x:fAnonGuest?22:2}} transition={{type:'spring',stiffness:400,damping:28}}
                      style={{position:'absolute',top:3,width:20,height:20,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 4px rgba(0,0,0,0.4)'}}/>
                  </motion.button>
                </div>
                {/* Кнопки */}
                <div style={{display:'flex',gap:10}}>
                  <motion.button whileTap={{scale:0.95}} onClick={()=>setShowCreate(false)}
                    style={{flex:1,padding:'14px',background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',
                      borderRadius:14,color:'rgba(255,255,255,0.6)',fontSize:14,fontWeight:700,cursor:'pointer'}}>Отмена</motion.button>
                  <motion.button whileTap={{scale:0.95}} onClick={handleCreate} disabled={!fName.trim()||creating}
                    style={{flex:2,padding:'14px',
                      background:fName.trim()&&!creating?`linear-gradient(135deg,${ACCENT},#818cf8)`:'rgba(255,255,255,0.06)',
                      border:'none',borderRadius:14,color:fName.trim()&&!creating?'#fff':'rgba(255,255,255,0.3)',
                      fontSize:15,fontWeight:800,cursor:fName.trim()&&!creating?'pointer':'default'}}>
                    {creating?'⏳ Создаём...':'✅ Создать'}
                  </motion.button>
                </div>
                <div style={{height:20}}/>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Модал результата */}
      <AnimatePresence>
        {result&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.9)',zIndex:5100,
              display:'flex',alignItems:'center',justifyContent:'center',padding:20,backdropFilter:'blur(10px)'}}>
            <motion.div initial={{scale:0.85,opacity:0}} animate={{scale:1,opacity:1}}
              style={{background:'#0f0f1a',border:'1px solid rgba(99,102,241,0.4)',borderRadius:24,
                padding:24,width:'100%',maxWidth:380,boxShadow:'0 20px 60px rgba(99,102,241,0.25)'}}>
              <div style={{textAlign:'center',marginBottom:20}}>
                <div style={{fontSize:48,marginBottom:10}}>🎉</div>
                <div style={{fontSize:18,fontWeight:900,color:'#fff',marginBottom:4}}>Конференция создана!</div>
                <div style={{fontSize:13,color:'rgba(255,255,255,0.45)'}}>Поделитесь ссылкой с участниками</div>
              </div>
              <div style={{background:'rgba(99,102,241,0.08)',border:'1px solid rgba(99,102,241,0.25)',borderRadius:14,padding:'14px',marginBottom:14}}>
                <div style={{fontSize:11,color:'rgba(165,180,252,0.8)',fontWeight:700,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.08em'}}>Комната</div>
                <div style={{fontSize:22,fontWeight:900,color:'#c7d2fe',letterSpacing:'0.12em'}}>#{result.meetingId}</div>
              </div>
              {result.commonToken&&(
                <div style={{background:'rgba(34,197,94,0.08)',border:'1px solid rgba(34,197,94,0.25)',borderRadius:14,padding:'14px',marginBottom:14}}>
                  <div style={{fontSize:11,color:'rgba(134,239,172,0.8)',fontWeight:700,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.08em'}}>Общий токен</div>
                  <div style={{fontSize:24,fontWeight:900,color:'#86efac',letterSpacing:'0.15em',fontFamily:'monospace'}}>{result.commonToken}</div>
                </div>
              )}
              {result.anonymousToken&&result.anonLink&&(
                <div style={{background:'rgba(99,102,241,0.07)',border:'1px solid rgba(99,102,241,0.3)',borderRadius:14,padding:'14px',marginBottom:14}}>
                  <div style={{fontSize:11,color:'rgba(165,180,252,0.8)',fontWeight:700,marginBottom:6,textTransform:'uppercase',letterSpacing:'0.08em'}}>🎭 Анонимный гость</div>
                  <div style={{fontSize:20,fontWeight:900,color:'#a5b4fc',letterSpacing:'0.15em',fontFamily:'monospace',marginBottom:6}}>{result.anonymousToken}</div>
                  <div style={{fontSize:10,color:'rgba(165,180,252,0.5)',fontFamily:'monospace',wordBreak:'break-all',lineHeight:1.4,marginBottom:8}}>{result.anonLink}</div>
                  <motion.button whileTap={{scale:0.94}} onClick={()=>copyLink(result.anonLink!)}
                    style={{width:'100%',padding:'9px',background:'rgba(99,102,241,0.12)',border:'1px solid rgba(99,102,241,0.3)',
                      borderRadius:10,color:'#a5b4fc',fontSize:12,fontWeight:700,cursor:'pointer'}}>📋 Копировать ссылку для гостя</motion.button>
                </div>
              )}
              <div style={{background:'rgba(255,255,255,0.04)',border:'1px solid rgba(255,255,255,0.09)',borderRadius:12,padding:'10px 14px',marginBottom:16}}>
                <div style={{fontSize:10,color:'rgba(255,255,255,0.35)',marginBottom:4,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em'}}>Ссылка-приглашение</div>
                <div style={{fontSize:11,color:'rgba(255,255,255,0.6)',wordBreak:'break-all',fontFamily:'monospace',lineHeight:1.5}}>{result.inviteLink}</div>
              </div>
              <div style={{display:'flex',gap:8,marginBottom:12}}>
                <motion.button whileTap={{scale:0.93}} onClick={()=>copyLink(result.inviteLink)}
                  style={{flex:1,padding:'12px',background:copied?'rgba(34,197,94,0.2)':'rgba(99,102,241,0.12)',
                    border:`1px solid ${copied?'rgba(34,197,94,0.4)':'rgba(99,102,241,0.3)'}`,borderRadius:12,
                    color:copied?'#86efac':'#a5b4fc',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                  {copied?'✅ Скопировано!':'📋 Копировать'}
                </motion.button>
                <motion.button whileTap={{scale:0.93}} onClick={()=>shareLink(result.inviteLink,`Конференция #${result.meetingId}`)}
                  style={{flex:1,padding:'12px',background:`linear-gradient(135deg,${ACCENT},#818cf8)`,
                    border:'none',borderRadius:12,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>↗ Поделиться</motion.button>
              </div>
              <motion.button whileTap={{scale:0.95}} onClick={()=>setResult(null)}
                style={{width:'100%',padding:'13px',background:'rgba(255,255,255,0.06)',
                  border:'1px solid rgba(255,255,255,0.1)',borderRadius:14,color:'rgba(255,255,255,0.5)',fontSize:14,fontWeight:700,cursor:'pointer'}}>Закрыть</motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ ЕДИНЫЙ ПОИСК (полноэкранный) ═══ */}
      <AnimatePresence>
        {showSearch&&(
          <motion.div key="unified-search" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.15}}
            style={{position:'fixed',inset:0,zIndex:300}}>
            <UnifiedSearchScreen
              apiBase={apiBase}
              c={c as any}
              accent={activeAccent}
              onClose={()=>{setShowSearch(false);}}
              onViewProfile={(hash,fallback)=>{
                setProfileViewHash(hash);
                if(fallback)setProfileViewFallback(fallback);
                setShowSearch(false);
              }}
              onOpenChat={(hash,info)=>{
                setChatTarget({hash,info});
                setNavTab('messages');
                setShowSearch(false);
              }}
              onCall={(hash,info)=>{
                setCallPeerInfo({name:info.name,avatar:info.avatar});
                call.startCall(hash,'video');
                setShowSearch(false);
              }}
              searchByCode={async(code:string)=>{
                try{
                  const res=await fetch(`${apiBase}/api/invite-code/${code}`);
                  return await res.json();
                }catch{return{found:false};}
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
