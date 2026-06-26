import React,{useState,useRef} from 'react';
import {motion,AnimatePresence} from 'framer-motion';

interface PhoneContact{
  id:string;
  name:string;
  phones:string[];
}

interface Props{
  userHash:string;
  onBack:()=>void;
  isDark?:boolean;
  accentColor?:string;
}

function computeInviteCode(hash:string,mode:'pro'|'scene'|'krug'):string{
  const offsets={pro:0,scene:5,krug:10};
  const offset=offsets[mode];
  const slice=hash.slice(offset,offset+15);
  try{const num=BigInt('0x'+slice)%900_000_000n+100_000_000n;return num.toString();}
  catch{return '000000000';}
}

const INVITE_TEXTS=[
  (l:string)=>`Привет! Я в SWAP — уютная соцсеть без рекламного мусора. Присоединяйся! ${l}`,
  (l:string)=>`Я пользуюсь SWAP. Там классно и приватно. Попробуй! ${l}`,
  (l:string)=>`Регистрация за 10 секунд — придумай 4 слова и общайся. Я уже там. ${l}`,
  (l:string)=>`SWAP — просто, быстро, приватно. Давай общаться там! ${l}`,
  (l:string)=>`Давай переедем в SWAP — там спокойно и без лишнего шума. ${l}`,
  (l:string)=>`Наконец-то нормальная соцсеть 😊 Заходи в SWAP! ${l}`,
  (l:string)=>`Все соцсети одинаковые? А вот и нет. Попробуй SWAP — мне нравится. ${l}`,
  (l:string)=>`Твой аккаунт защищён мастер-ключом из 4 слов — никто не взломает. ${l}`,
  (l:string)=>`Мама/папа, давайте общаться в SWAP — там всё под рукой и удобно. ${l}`,
];

const hasContactsAPI=()=>'contacts' in navigator&&'ContactsManager' in window;
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);

export default function ContactsScreen({userHash,onBack,isDark=true,accentColor='#a855f7'}:Props){
  const [contacts,setContacts]=useState<PhoneContact[]>([]);
  const [selected,setSelected]=useState<Set<string>>(new Set());
  const [loading,setLoading]=useState(false);
  const [loaded,setLoaded]=useState(false);
  const [search,setSearch]=useState('');
  const [sentIds,setSentIds]=useState<Set<string>>(new Set());
  const [copied,setCopied]=useState(false);
  const [msgIdx]=useState(()=>Math.floor(Math.random()*INVITE_TEXTS.length));
  const searchRef=useRef<HTMLInputElement>(null);

  const inviteCode=computeInviteCode(userHash,'pro');
  const inviteLink=`${window.location.origin}/p/${inviteCode}`;
  const inviteText=INVITE_TEXTS[msgIdx](inviteLink);

  const bg=isDark?'#0c0c1a':'#f0f0f8';
  const hdrBg=isDark?'rgba(8,8,20,0.97)':'rgba(248,248,255,0.97)';
  const card=isDark?'rgba(255,255,255,0.05)':'#fff';
  const border=isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.08)';
  const textC=isDark?'#f0f0ff':'#0a0a1a';
  const subC=isDark?'rgba(255,255,255,0.45)':'rgba(0,0,0,0.45)';
  const selBg=isDark?'rgba(168,85,247,0.10)':'rgba(168,85,247,0.06)';

  const loadContacts=async()=>{
    setLoading(true);
    try{
      // @ts-ignore — Contact Picker API
      const raw=await (navigator as any).contacts.select(['name','tel'],{multiple:true});
      const parsed:PhoneContact[]=raw
        .filter((c:any)=>c.tel&&c.tel.length>0)
        .map((c:any,i:number)=>({
          id:`c${i}`,
          name:(c.name&&c.name[0])||'Без имени',
          phones:(c.tel as string[]).map((t:string)=>t.replace(/[\s\-()]/g,'')).filter(Boolean),
        }))
        .filter((c:PhoneContact)=>c.phones.length>0);
      setContacts(parsed);
      setLoaded(true);
    }catch{/* user cancelled */}
    finally{setLoading(false);}
  };

  const toggleSelect=(id:string)=>{
    setSelected(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});
  };

  const filtered=contacts.filter(c=>
    !search||
    c.name.toLowerCase().includes(search.toLowerCase())||
    c.phones.some(p=>p.includes(search))
  );
  const allSel=filtered.length>0&&selected.size===filtered.length;

  const toggleAll=()=>{
    if(allSel)setSelected(new Set());
    else setSelected(new Set(filtered.map(c=>c.id)));
  };

  const openSMS=(phones:string[],ids:string[])=>{
    if(!phones.length)return;
    const nums=phones.join(',');
    const url=`sms:${nums}?body=${encodeURIComponent(inviteText)}`;
    window.open(url,'_self');
    setSentIds(prev=>{const n=new Set(prev);ids.forEach(id=>n.add(id));return n;});
  };

  const sendToSelected=()=>{
    const arr=contacts.filter(c=>selected.has(c.id));
    openSMS(arr.map(c=>c.phones[0]),arr.map(c=>c.id));
  };

  const sendToAll=()=>{
    openSMS(filtered.map(c=>c.phones[0]),filtered.map(c=>c.id));
  };

  const copyInvite=async()=>{
    try{await navigator.clipboard.writeText(inviteText);}catch{}
    setCopied(true);setTimeout(()=>setCopied(false),2200);
  };

  const shareInvite=async()=>{
    if(navigator.share){
      try{await navigator.share({title:'SWAP',text:inviteText,url:inviteLink});return;}catch{}
    }
    await copyInvite();
  };

  return(
    <div style={{position:'fixed',inset:0,zIndex:800,background:bg,display:'flex',flexDirection:'column'}}>

      {/* ── Шапка ── */}
      <div style={{background:hdrBg,backdropFilter:'blur(20px)',borderBottom:`1px solid ${border}`,
        padding:'max(14px,env(safe-area-inset-top)) 16px 12px',
        display:'flex',alignItems:'center',gap:12,flexShrink:0}}>
        <motion.button whileTap={{scale:0.85}} onClick={onBack}
          style={{width:36,height:36,borderRadius:12,background:isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)',
            border:'none',cursor:'pointer',color:textC,fontSize:18,display:'flex',alignItems:'center',
            justifyContent:'center',flexShrink:0}}>
          ←
        </motion.button>
        <div style={{flex:1}}>
          <div style={{fontSize:17,fontWeight:800,color:textC,letterSpacing:'-0.02em'}}>Контакты телефона</div>
          {loaded&&<div style={{fontSize:11,color:subC}}>{contacts.length} контакт{contacts.length%10===1&&contacts.length%100!==11?'':contacts.length%10>=2&&contacts.length%10<=4&&!(contacts.length%100>=12&&contacts.length%100<=14)?'а':'ов'} с номерами</div>}
        </div>
        {loaded&&(
          <motion.button whileTap={{scale:0.85}} onClick={loadContacts}
            style={{padding:'7px 12px',borderRadius:10,background:isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)',
              border:`1px solid ${border}`,cursor:'pointer',color:subC,fontSize:11,fontWeight:700}}>
            Обновить
          </motion.button>
        )}
      </div>

      <div style={{flex:1,overflowY:'auto'}}>

        {/* ── Экран приветствия (контакты ещё не загружены) ── */}
        {!loaded&&(
          <div style={{display:'flex',flexDirection:'column',alignItems:'center',
            padding:'48px 24px 32px',gap:0}}>

            <motion.div initial={{scale:0.7,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',damping:16}}
              style={{fontSize:72,lineHeight:1,marginBottom:20}}>
              📱
            </motion.div>

            <div style={{fontSize:20,fontWeight:900,color:textC,textAlign:'center',
              letterSpacing:'-0.03em',marginBottom:12}}>
              Пригласи друзей в SWAP
            </div>

            {hasContactsAPI()?(
              <>
                <div style={{fontSize:14,color:subC,textAlign:'center',lineHeight:1.65,
                  maxWidth:300,marginBottom:28}}>
                  Загрузи контакты из телефона — выбери кому отправить SMS-приглашение
                  или разошли сразу всем
                </div>
                <motion.button whileTap={{scale:0.95}} onClick={loadContacts} disabled={loading}
                  style={{padding:'14px 32px',borderRadius:16,background:accentColor,
                    border:'none',color:'#fff',fontWeight:800,fontSize:15,cursor:'pointer',
                    marginBottom:32,boxShadow:`0 8px 24px ${accentColor}55`,
                    display:'flex',alignItems:'center',gap:8}}>
                  {loading?(
                    <><motion.span animate={{rotate:360}} transition={{repeat:Infinity,duration:0.8,ease:'linear'}}
                      style={{display:'inline-block'}}>⏳</motion.span> Загрузка...</>
                  ):'📲 Открыть контакты'}
                </motion.button>
              </>
            ):isIOS()?(
              <div style={{fontSize:14,color:subC,textAlign:'center',lineHeight:1.65,
                maxWidth:300,marginBottom:28}}>
                На iPhone загрузка контактов в браузере недоступна.<br/>
                Поделись ссылкой через iMessage, WhatsApp или другой мессенджер
              </div>
            ):(
              <div style={{fontSize:14,color:subC,textAlign:'center',lineHeight:1.65,
                maxWidth:300,marginBottom:28}}>
                Твой браузер не поддерживает загрузку контактов.<br/>
                Поделись ссылкой вручную
              </div>
            )}

            {/* Превью приглашения */}
            <div style={{width:'100%',maxWidth:380,background:card,borderRadius:18,
              border:`1px solid ${border}`,padding:'16px',marginBottom:16}}>
              <div style={{fontSize:10,color:subC,fontWeight:700,letterSpacing:'0.08em',
                textTransform:'uppercase',marginBottom:8}}>
                Текст SMS-приглашения
              </div>
              <div style={{fontSize:13,color:textC,lineHeight:1.65,marginBottom:14}}>
                {inviteText}
              </div>
              <div style={{display:'flex',gap:8}}>
                <motion.button whileTap={{scale:0.93}} onClick={copyInvite}
                  style={{flex:1,padding:'10px 0',borderRadius:12,
                    background:isDark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.05)',
                    border:`1px solid ${border}`,cursor:'pointer',color:textC,
                    fontWeight:700,fontSize:12}}>
                  {copied?'✓ Скопировано':'📋 Копировать'}
                </motion.button>
                <motion.button whileTap={{scale:0.93}} onClick={shareInvite}
                  style={{flex:1,padding:'10px 0',borderRadius:12,background:accentColor,
                    border:'none',cursor:'pointer',color:'#fff',fontWeight:700,fontSize:12}}>
                  ↗ Поделиться
                </motion.button>
              </div>
            </div>

            {/* Инвайт-код */}
            <div style={{width:'100%',maxWidth:380,background:card,borderRadius:18,
              border:`1px solid ${border}`,padding:'14px 16px',
              display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div>
                <div style={{fontSize:10,color:subC,fontWeight:700,letterSpacing:'0.08em',
                  textTransform:'uppercase',marginBottom:4}}>
                  Мой инвайт-код
                </div>
                <div style={{fontSize:22,fontWeight:900,color:textC,letterSpacing:4,
                  fontFamily:'monospace'}}>
                  {inviteCode}
                </div>
              </div>
              <motion.button whileTap={{scale:0.88}} onClick={async()=>{
                try{await navigator.clipboard.writeText(inviteCode);}catch{}
              }} style={{padding:'8px 14px',borderRadius:12,background:isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)',
                border:`1px solid ${border}`,cursor:'pointer',color:subC,fontSize:12,fontWeight:700}}>
                Копировать
              </motion.button>
            </div>
          </div>
        )}

        {/* ── Список контактов ── */}
        {loaded&&(
          <>
            {/* Поиск */}
            <div style={{padding:'12px 16px 6px'}}>
              <div style={{background:card,borderRadius:14,border:`1px solid ${border}`,
                display:'flex',alignItems:'center',gap:8,padding:'8px 12px'}}>
                <span style={{fontSize:15,opacity:0.4}}>🔍</span>
                <input ref={searchRef} value={search} onChange={e=>setSearch(e.target.value)}
                  placeholder="Имя или номер телефона..."
                  style={{flex:1,background:'none',border:'none',outline:'none',
                    color:textC,fontSize:14,fontFamily:'inherit'}}/>
                {search&&(
                  <motion.button whileTap={{scale:0.85}} onClick={()=>setSearch('')}
                    style={{background:'none',border:'none',cursor:'pointer',color:subC,fontSize:14,padding:0}}>
                    ✕
                  </motion.button>
                )}
              </div>
            </div>

            {/* Выбрать всех / счётчик */}
            <div style={{padding:'6px 16px 10px',display:'flex',
              alignItems:'center',justifyContent:'space-between'}}>
              <motion.button whileTap={{scale:0.95}} onClick={toggleAll}
                style={{background:'none',border:'none',cursor:'pointer',
                  color:accentColor,fontWeight:700,fontSize:13,padding:0}}>
                {allSel?'✗ Снять выбор':'✓ Выбрать всех'}
              </motion.button>
              <AnimatePresence>
                {selected.size>0&&(
                  <motion.div initial={{opacity:0,scale:0.8}} animate={{opacity:1,scale:1}} exit={{opacity:0,scale:0.8}}
                    style={{fontSize:12,color:subC,fontWeight:600}}>
                    Выбрано: {selected.size}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Пусто */}
            {filtered.length===0&&(
              <div style={{padding:'40px 24px',textAlign:'center',color:subC,fontSize:14}}>
                Ничего не найдено
              </div>
            )}

            {/* Контакты */}
            {filtered.map(contact=>{
              const isSel=selected.has(contact.id);
              const wasSent=sentIds.has(contact.id);
              const letter=contact.name.trim()[0]?.toUpperCase()||'?';
              const hue=((contact.id.charCodeAt(1)||0)*47)%360;
              return(
                <motion.div key={contact.id} whileTap={{scale:0.99}}
                  onClick={()=>toggleSelect(contact.id)}
                  style={{display:'flex',alignItems:'center',gap:12,padding:'10px 16px',
                    borderBottom:`1px solid ${border}`,cursor:'pointer',
                    background:isSel?selBg:'transparent',transition:'background 0.15s'}}>
                  {/* Аватарка */}
                  <div style={{width:42,height:42,borderRadius:14,flexShrink:0,
                    background:`hsl(${hue},55%,${isDark?'28%':'72%'})`,
                    display:'flex',alignItems:'center',justifyContent:'center',
                    fontSize:17,fontWeight:800,color:isDark?'#fff':'#fff'}}>
                    {letter}
                  </div>
                  {/* Имя и номер */}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:14,fontWeight:700,color:textC,
                      overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {contact.name}
                    </div>
                    <div style={{fontSize:11,color:subC,
                      overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {contact.phones.join(', ')}
                    </div>
                  </div>
                  {/* Метка «отправлено» */}
                  {wasSent&&(
                    <div style={{fontSize:10,color:'#4ade80',fontWeight:700,flexShrink:0}}>
                      ✓ отправлено
                    </div>
                  )}
                  {/* Чекбокс */}
                  <div style={{width:22,height:22,borderRadius:7,flexShrink:0,
                    border:`2px solid ${isSel?accentColor:border}`,
                    background:isSel?accentColor:'transparent',
                    display:'flex',alignItems:'center',justifyContent:'center',
                    transition:'all 0.15s'}}>
                    {isSel&&<span style={{color:'#fff',fontSize:12,fontWeight:900,lineHeight:1}}>✓</span>}
                  </div>
                </motion.div>
              );
            })}
            <div style={{height:110}}/>
          </>
        )}
      </div>

      {/* ── Нижняя панель (только после загрузки) ── */}
      <AnimatePresence>
        {loaded&&(
          <motion.div initial={{y:80,opacity:0}} animate={{y:0,opacity:1}} exit={{y:80,opacity:0}}
            style={{padding:`12px 16px max(16px,env(safe-area-inset-bottom))`,
              background:hdrBg,backdropFilter:'blur(20px)',
              borderTop:`1px solid ${border}`,display:'flex',gap:10,flexShrink:0}}>
            <motion.button whileTap={{scale:0.95}} onClick={sendToSelected}
              disabled={selected.size===0}
              style={{flex:1,padding:'13px 8px',borderRadius:14,
                background:selected.size>0?accentColor:(isDark?'rgba(255,255,255,0.06)':'rgba(0,0,0,0.05)'),
                border:'none',cursor:selected.size>0?'pointer':'default',
                color:selected.size>0?'#fff':subC,fontWeight:800,fontSize:13,
                transition:'all 0.2s',boxShadow:selected.size>0?`0 4px 16px ${accentColor}44`:'none'}}>
              📩 Выбранным{selected.size>0?` (${selected.size})`:''}
            </motion.button>
            <motion.button whileTap={{scale:0.95}} onClick={sendToAll}
              style={{flex:1,padding:'13px 8px',borderRadius:14,
                background:isDark?'rgba(255,255,255,0.08)':'rgba(0,0,0,0.06)',
                border:`1px solid ${border}`,cursor:'pointer',
                color:textC,fontWeight:800,fontSize:13}}>
              📤 Всем ({filtered.length})
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
