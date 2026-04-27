import React,{useState,useEffect,useRef,useCallback} from 'react';
import {motion,AnimatePresence} from 'framer-motion';
import {SERVICE_CATEGORIES} from './ChannelsScreen';

/* ─── Типы ─────────────────────────────────────────────── */
export interface SearchColors {
  deep:string;card:string;cardAlt:string;surface:string;
  light:string;mid:string;sub:string;border:string;borderB:string;
}

interface PersonResult {
  hash:string;name:string;handle:string;bio:string;avatar:string;
  mode:'pro'|'scene';mood?:{emoji:string;text:string};
}
interface ChannelResult {
  id:string;name:string;handle:string;description:string;
  vibe:string;coverGradient:string;coverPhotoUrl:string;avatarPhotoUrl:string;
  tags:string[];subscribers:number;postCount:number;isVerified:boolean;
  posts:any[];employees:any[];priceList:any[];
  _owner:{hash:string;name:string;avatar:string;nick:string};
}
interface GroupResult {
  id:string;name:string;handle:string;description:string;
  emoji:string;color:string;gradient:string;memberCount:number;
  isPrivate:boolean;streak:number;todayMood:string;wordOfDay:string;
  posts:any[];
  _owner:{hash:string;name:string;avatar:string;nick:string};
}

function av(seed:string,size:number=80):string{
  const colors=['4f46e5','7c3aed','db2777','dc2626','d97706','059669','0891b2','4338ca'];
  const i=seed.split('').reduce((a,c)=>a+c.charCodeAt(0),0)%colors.length;
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=${colors[i]}&fontSize=38&size=${size}`;
}

function debounce<F extends(...args:any[])=>any>(fn:F,ms:number){
  let t:ReturnType<typeof setTimeout>;
  return (...args:Parameters<F>)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),ms);};
}

/* ═══════════════════════════════════════════════════════════
   ГЛАВНЫЙ КОМПОНЕНТ
═══════════════════════════════════════════════════════════ */
export interface UnifiedSearchProps {
  apiBase:string;
  c:SearchColors;
  accent:string;
  onClose():void;
  onViewProfile(hash:string,fallback?:{name:string;avatar:string;handle:string;bio:string}):void;
  onOpenChat(hash:string,info:{name:string;avatar:string;handle:string}):void;
  onCall?(hash:string,info:{name:string;avatar:string}):void;
  searchByCode?(code:string):Promise<any>;
}

export function UnifiedSearchScreen({apiBase,c,accent,onClose,onViewProfile,onOpenChat,onCall,searchByCode}:UnifiedSearchProps){
  /* Вкладки */
  const [tab,setTab]=useState<'people'|'channels'|'groups'>('people');

  /* Поиск людей */
  const [peopleQ,setPeopleQ]=useState('');
  const [peopleResults,setPeopleResults]=useState<PersonResult[]>([]);
  const [peopleLoading,setPeopleLoading]=useState(false);

  /* Поиск каналов / групп */
  const [chQ,setChQ]=useState('');
  const [selectedCat,setSelectedCat]=useState<string|null>(null);
  const [catResults,setCatResults]=useState<{channels:ChannelResult[];groups:GroupResult[]}>({channels:[],groups:[]});
  const [catLoading,setCatLoading]=useState(false);

  /* Код приглашения */
  const [codeInput,setCodeInput]=useState('');
  const [codeLoading,setCodeLoading]=useState(false);
  const [codeResult,setCodeResult]=useState<any>(null);

  /* Детальный просмотр канала/группы */
  const [openChannel,setOpenChannel]=useState<ChannelResult|null>(null);
  const [openGroup,setOpenGroup]=useState<GroupResult|null>(null);

  const ac=accent;

  /* ─── Поиск людей ─────────────────────────────────────── */
  const doSearchPeople=useCallback(debounce(async(q:string)=>{
    if(!q.trim()){setPeopleResults([]);return;}
    setPeopleLoading(true);
    try{
      const r=await fetch(`${apiBase}/api/search?q=${encodeURIComponent(q)}&mode=pro`);
      const d=await r.json();
      setPeopleResults(d.results||[]);
    }catch{}finally{setPeopleLoading(false);}
  },400),[apiBase]);

  useEffect(()=>{doSearchPeople(peopleQ);},[peopleQ]);

  /* ─── Поиск каналов/групп ─────────────────────────────── */
  const doSearchChannels=useCallback(debounce(async(q:string,cat:string|null)=>{
    const keywords:string[]=[];
    if(q.trim())keywords.push(q.trim());
    if(cat){
      const catObj=SERVICE_CATEGORIES.find(c=>c.id===cat);
      if(catObj&&catObj.keywords.length)keywords.push(...catObj.keywords.slice(0,8));
    }
    if(!keywords.length){setCatResults({channels:[],groups:[]});return;}
    setCatLoading(true);
    try{
      const r=await fetch(`${apiBase}/api/channels-search?q=${encodeURIComponent(keywords.join(' '))}`);
      const d=await r.json();
      setCatResults({channels:d.channels||[],groups:d.groups||[]});
    }catch{}finally{setCatLoading(false);}
  },350),[apiBase]);

  useEffect(()=>{
    if(tab==='channels'||tab==='groups') doSearchChannels(chQ,selectedCat);
  },[chQ,selectedCat,tab]);

  /* ─── Поиск по коду ───────────────────────────────────── */
  async function handleCodeSearch(){
    if(codeInput.length!==9||!searchByCode)return;
    setCodeLoading(true);setCodeResult(null);
    try{const r=await searchByCode(codeInput);setCodeResult(r);}finally{setCodeLoading(false);}
  }

  /* ─── Кнопка выбора категории ─────────────────────────── */
  function pickCat(id:string){
    setSelectedCat(prev=>prev===id?null:id);
    setChQ('');
  }

  const curCat=SERVICE_CATEGORIES.find(s=>s.id===selectedCat);
  const displayChannels=catResults.channels.filter(()=>tab==='channels');
  const displayGroups=catResults.groups.filter(()=>tab==='groups');

  return(
    <div style={{position:'fixed',inset:0,background:c.deep,display:'flex',flexDirection:'column',zIndex:200,fontFamily:'inherit'}}>
      {/* ── Шапка ─────────────────────────────────────────── */}
      <div style={{background:c.surface,borderBottom:`1px solid ${c.border}`,padding:'10px 12px 0',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
          <motion.button whileTap={{scale:0.88}} onClick={onClose}
            style={{width:34,height:34,borderRadius:10,background:c.cardAlt,border:`1px solid ${c.border}`,
              color:c.mid,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>←</motion.button>
          <div style={{flex:1,position:'relative'}}>
            <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',fontSize:14,pointerEvents:'none'}}>🔍</span>
            <input
              value={tab==='people'?peopleQ:chQ}
              onChange={e=>tab==='people'?setPeopleQ(e.target.value):setChQ(e.target.value)}
              placeholder={tab==='people'?'Поиск людей по имени или нику…':'Поиск каналов и групп…'}
              autoFocus
              style={{width:'100%',boxSizing:'border-box',padding:'9px 12px 9px 34px',
                background:c.cardAlt,border:`1px solid ${c.borderB}`,borderRadius:10,
                color:c.light,fontSize:13,outline:'none',fontFamily:'inherit'}}/>
            {(tab==='people'?peopleLoading:catLoading)&&
              <span style={{position:'absolute',right:10,top:'50%',transform:'translateY(-50%)',fontSize:11,color:c.sub}}>…</span>}
          </div>
        </div>
        {/* Вкладки */}
        <div style={{display:'flex',gap:0,borderBottom:`1px solid ${c.border}`,marginLeft:-12,marginRight:-12,paddingLeft:12}}>
          {([['people','👤 Люди'],['channels','📡 Каналы'],['groups','👥 Группы']] as const).map(([t,label])=>(
            <button key={t} onClick={()=>{setTab(t);}}
              style={{padding:'8px 14px',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',
                fontSize:12,fontWeight:700,color:tab===t?ac:c.sub,
                borderBottom:`2px solid ${tab===t?ac:'transparent'}`,transition:'all 0.18s',
                whiteSpace:'nowrap'}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Содержимое ────────────────────────────────────── */}
      <div style={{flex:1,overflowY:'auto',paddingBottom:24}}>
        <AnimatePresence mode="wait">

          {/* ═══ ЛЮДИ ═══ */}
          {tab==='people'&&(
            <motion.div key="people" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} transition={{duration:0.18}}>
              {/* Результаты поиска */}
              {peopleQ.trim()?(
                <div style={{padding:'10px 12px 0'}}>
                  {!peopleResults.length&&!peopleLoading&&(
                    <div style={{textAlign:'center',padding:'40px 20px',color:c.sub,fontSize:13}}>По запросу «{peopleQ}» ничего не найдено</div>
                  )}
                  {peopleResults.map((r,ri)=>{
                    const ava=r.avatar||av(r.hash.slice(0,14)||'u',80);
                    return(
                      <motion.div key={r.hash} whileTap={{scale:0.98}}
                        style={{borderRadius:14,background:c.card,border:`1px solid ${c.border}`,marginBottom:8,overflow:'hidden'}}>
                        <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',cursor:'pointer'}}
                          onClick={()=>onViewProfile(r.hash,{name:r.name,avatar:ava,handle:r.handle||'',bio:r.bio||''})}>
                          <div style={{width:46,height:46,borderRadius:'50%',overflow:'hidden',flexShrink:0,border:`2px solid ${ac}44`}}>
                            {r.avatar?<img src={ava} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                              :<div style={{width:'100%',height:'100%',background:c.card,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>👤</div>}
                          </div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
                              <span style={{fontSize:14,fontWeight:800,color:c.light}}>{r.name}</span>
                              {r.mood?.emoji&&<span style={{fontSize:10,color:ac,background:ac+'18',border:`1px solid ${ac}33`,borderRadius:12,padding:'1px 6px'}}>{r.mood.emoji} {r.mood.text}</span>}
                            </div>
                            {r.handle&&<div style={{fontSize:11,color:c.sub}}>@{r.handle}</div>}
                            {r.bio&&<div style={{fontSize:11,color:c.sub,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',opacity:0.7}}>{r.bio}</div>}
                          </div>
                          <span style={{fontSize:11,color:ac,fontWeight:700,flexShrink:0}}>→</span>
                        </div>
                        <div style={{display:'flex',gap:6,padding:'0 12px 10px'}}>
                          <button onClick={()=>onOpenChat(r.hash,{name:r.name,avatar:ava,handle:r.handle||''})}
                            style={{flex:1,padding:'7px 0',borderRadius:9,background:ac,border:'none',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer'}}>✏️ Написать</button>
                          {onCall&&<button onClick={()=>onCall!(r.hash,{name:r.name,avatar:ava})}
                            style={{flex:1,padding:'7px 0',borderRadius:9,background:c.card,border:`1px solid ${c.border}`,color:c.mid,fontWeight:700,fontSize:12,cursor:'pointer'}}>📹 Позвонить</button>}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ):(
                /* Поиск по коду */
                <div style={{padding:'14px 12px'}}>
                  <div style={{borderRadius:14,background:c.card,border:`1px solid ${c.border}`,padding:'14px'}}>
                    <div style={{fontSize:11,fontWeight:700,color:c.sub,marginBottom:10,textTransform:'uppercase',letterSpacing:'0.06em'}}>🔢 Поиск по коду приглашения</div>
                    <div style={{display:'flex',gap:8}}>
                      <input value={codeInput} onChange={e=>{setCodeInput(e.target.value.replace(/\D/g,'').slice(0,9));setCodeResult(null);}}
                        onKeyDown={e=>e.key==='Enter'&&handleCodeSearch()} inputMode="numeric" placeholder="9 цифр..."
                        style={{flex:1,padding:'9px 12px',background:c.cardAlt,border:`1px solid ${c.borderB}`,borderRadius:9,color:c.light,fontSize:15,outline:'none',fontFamily:'monospace',letterSpacing:3}}/>
                      <motion.button whileTap={{scale:0.93}} onClick={handleCodeSearch} disabled={codeInput.length!==9||codeLoading}
                        style={{padding:'9px 16px',background:codeInput.length===9?ac:'rgba(160,160,200,0.12)',border:'none',borderRadius:9,color:codeInput.length===9?'#fff':c.sub,fontWeight:700,fontSize:13,cursor:'pointer'}}>
                        {codeLoading?'…':'Найти'}
                      </motion.button>
                    </div>
                    {codeResult&&(
                      <div style={{marginTop:10,borderRadius:10,overflow:'hidden',border:`1px solid ${c.border}`}}>
                        {!codeResult.found
                          ?<div style={{padding:12,fontSize:13,color:c.sub,textAlign:'center'}}>⚠️ Аккаунт не найден</div>
                          :<div>
                            <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px',cursor:'pointer',background:c.cardAlt}}
                              onClick={()=>codeResult.hash&&onViewProfile(codeResult.hash,{name:codeResult.name||'Участник',avatar:codeResult.avatar||av(codeResult.hash.slice(0,14)||'u',80),handle:codeResult.handle||'',bio:''})}>
                              <div style={{width:48,height:48,borderRadius:'50%',overflow:'hidden',flexShrink:0,border:`2px solid ${ac}44`}}>
                                {codeResult.avatar?<img src={codeResult.avatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                                  :<div style={{width:'100%',height:'100%',background:c.card,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>👤</div>}
                              </div>
                              <div style={{flex:1}}>
                                <div style={{fontSize:14,fontWeight:800,color:c.light}}>{codeResult.name||'Участник SWAIP'}</div>
                                {codeResult.handle&&<div style={{fontSize:11,color:c.sub}}>@{codeResult.handle}</div>}
                              </div>
                              {codeResult.hash&&<span style={{fontSize:11,color:ac,fontWeight:700}}>→</span>}
                            </div>
                            {codeResult.hash&&<div style={{display:'flex',gap:6,padding:'0 12px 12px',background:c.cardAlt}}>
                              <button onClick={()=>onOpenChat(codeResult.hash,{name:codeResult.name||'Пользователь',avatar:codeResult.avatar||av(codeResult.hash.slice(0,14)||'u',80),handle:codeResult.handle||''})}
                                style={{flex:1,padding:'7px 0',borderRadius:9,background:ac,border:'none',color:'#fff',fontWeight:700,fontSize:12,cursor:'pointer'}}>✏️ Написать</button>
                            </div>}
                          </div>}
                      </div>
                    )}
                  </div>
                  {/* Подсказка */}
                  <div style={{marginTop:14,textAlign:'center',color:c.sub,fontSize:12,lineHeight:1.6,opacity:0.7}}>
                    Введите имя или ник в строку поиска<br/>чтобы найти людей по SWAIP
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ КАНАЛЫ ═══ */}
          {tab==='channels'&&(
            <motion.div key="channels" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} transition={{duration:0.18}}>
              <CategoryGrid accent={ac} c={c} selected={selectedCat} onPick={pickCat}/>
              {/* Строка выбранной категории */}
              {selectedCat&&!chQ&&curCat&&(
                <div style={{padding:'0 12px 6px',display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:18}}>{curCat.emoji}</span>
                  <span style={{fontSize:13,fontWeight:800,color:c.light}}>{curCat.label}</span>
                  <span style={{fontSize:11,color:c.sub,marginLeft:'auto'}}>
                    {catLoading?'Ищем…':`${displayChannels.length} канал${ru_end(displayChannels.length)}`}
                  </span>
                </div>
              )}
              {chQ&&(
                <div style={{padding:'0 12px 6px',fontSize:11,color:c.sub}}>
                  {catLoading?'Ищем…':`Найдено: ${catResults.channels.length} канал${ru_end(catResults.channels.length)}`}
                </div>
              )}
              {/* Список каналов */}
              <div style={{padding:'0 12px 20px'}}>
                {(selectedCat||chQ)&&!catLoading&&catResults.channels.length===0&&(
                  <div style={{textAlign:'center',padding:'40px 20px',color:c.sub,fontSize:13}}>Каналов в этой категории пока нет</div>
                )}
                {catResults.channels.map(ch=>(
                  <ChannelCard key={ch.id} ch={ch} c={c} ac={ac} onClick={()=>setOpenChannel(ch)} onViewOwner={()=>onViewProfile(ch._owner.hash,{name:ch._owner.name,avatar:ch._owner.avatar||av(ch._owner.hash.slice(0,14)||'u',80),handle:ch._owner.nick||'',bio:''})}/>
                ))}
              </div>
            </motion.div>
          )}

          {/* ═══ ГРУППЫ ═══ */}
          {tab==='groups'&&(
            <motion.div key="groups" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-20}} transition={{duration:0.18}}>
              <CategoryGrid accent={ac} c={c} selected={selectedCat} onPick={pickCat}/>
              {selectedCat&&!chQ&&curCat&&(
                <div style={{padding:'0 12px 6px',display:'flex',alignItems:'center',gap:6}}>
                  <span style={{fontSize:18}}>{curCat.emoji}</span>
                  <span style={{fontSize:13,fontWeight:800,color:c.light}}>{curCat.label}</span>
                  <span style={{fontSize:11,color:c.sub,marginLeft:'auto'}}>
                    {catLoading?'Ищем…':`${displayGroups.length} групп${ru_end_g(displayGroups.length)}`}
                  </span>
                </div>
              )}
              {chQ&&(
                <div style={{padding:'0 12px 6px',fontSize:11,color:c.sub}}>
                  {catLoading?'Ищем…':`Найдено: ${catResults.groups.length} групп${ru_end_g(catResults.groups.length)}`}
                </div>
              )}
              <div style={{padding:'0 12px 20px'}}>
                {(selectedCat||chQ)&&!catLoading&&catResults.groups.length===0&&(
                  <div style={{textAlign:'center',padding:'40px 20px',color:c.sub,fontSize:13}}>Групп в этой категории пока нет</div>
                )}
                {catResults.groups.map(g=>(
                  <GroupCard key={g.id} g={g} c={c} ac={ac} onClick={()=>setOpenGroup(g)} onViewOwner={()=>onViewProfile(g._owner.hash,{name:g._owner.name,avatar:g._owner.avatar||av(g._owner.hash.slice(0,14)||'u',80),handle:g._owner.nick||'',bio:''})}/>
                ))}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Детальный просмотр канала ─────────────────────── */}
      <AnimatePresence>
        {openChannel&&(
          <ChannelDetail ch={openChannel} c={c} ac={ac} onClose={()=>setOpenChannel(null)}
            onViewOwner={()=>{setOpenChannel(null);onViewProfile(openChannel._owner.hash,{name:openChannel._owner.name,avatar:openChannel._owner.avatar||av(openChannel._owner.hash.slice(0,14)||'u',80),handle:openChannel._owner.nick||'',bio:''});}}/>
        )}
      </AnimatePresence>

      {/* ── Детальный просмотр группы ─────────────────────── */}
      <AnimatePresence>
        {openGroup&&(
          <GroupDetail g={openGroup} c={c} ac={ac} onClose={()=>setOpenGroup(null)}
            onViewOwner={()=>{setOpenGroup(null);onViewProfile(openGroup._owner.hash,{name:openGroup._owner.name,avatar:openGroup._owner.avatar||av(openGroup._owner.hash.slice(0,14)||'u',80),handle:openGroup._owner.nick||'',bio:''});}}/>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Сетка категорий ───────────────────────────────────── */
function CategoryGrid({accent,c,selected,onPick}:{accent:string;c:SearchColors;selected:string|null;onPick(id:string):void;}){
  return(
    <div style={{padding:'12px 12px 8px'}}>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
        {SERVICE_CATEGORIES.map(cat=>{
          const active=selected===cat.id;
          return(
            <motion.button key={cat.id} whileTap={{scale:0.9}} onClick={()=>onPick(cat.id)}
              style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,
                padding:'10px 4px',borderRadius:14,border:`1.5px solid ${active?accent:c.border}`,
                background:active?accent+'18':c.card,cursor:'pointer',
                transition:'all 0.15s',outline:'none'}}>
              <span style={{fontSize:22}}>{cat.emoji}</span>
              <span style={{fontSize:9,fontWeight:700,color:active?accent:c.sub,textAlign:'center',lineHeight:1.2,wordBreak:'break-word'}}>{cat.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Карточка канала ───────────────────────────────────── */
function ChannelCard({ch,c,ac,onClick,onViewOwner}:{ch:ChannelResult;c:SearchColors;ac:string;onClick():void;onViewOwner():void;}){
  return(
    <motion.div whileTap={{scale:0.98}} onClick={onClick}
      style={{borderRadius:16,overflow:'hidden',background:c.card,border:`1px solid ${c.border}`,marginBottom:10,cursor:'pointer',boxShadow:'0 2px 12px rgba(0,0,0,0.2)'}}>
      <div style={{height:52,background:ch.coverGradient||`linear-gradient(135deg,${ac}44,#0a0a14)`,overflow:'hidden',position:'relative'}}>
        {ch.coverPhotoUrl&&<img src={ch.coverPhotoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover',opacity:0.7}}/>}
        <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,transparent,rgba(0,0,0,0.5))'}}/>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:10,padding:'6px 12px 8px',marginTop:-18,position:'relative'}}>
        <div style={{width:38,height:38,borderRadius:10,flexShrink:0,overflow:'hidden',
          background:ch.coverGradient||`linear-gradient(135deg,${ac}44,#0a0a14)`,
          border:`2px solid ${c.card}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17}}>
          {ch.avatarPhotoUrl?<img src={ch.avatarPhotoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span>{ch.vibe||'📡'}</span>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <span style={{fontSize:13,fontWeight:900,color:c.light}}>{ch.name}</span>
            {ch.isVerified&&<span style={{fontSize:10,color:'#60a5fa'}}>✓</span>}
          </div>
          <div style={{display:'flex',gap:8}}>
            <span style={{fontSize:10,color:c.sub}}>👥 {ch.subscribers||0}</span>
            <span style={{fontSize:10,color:c.sub}}>📝 {ch.postCount||0}</span>
            {ch.tags?.length>0&&<span style={{fontSize:9,color:ac}}>#{ch.tags[0]}</span>}
          </div>
        </div>
        <span style={{fontSize:11,color:c.sub,flexShrink:0}}>›</span>
      </div>
      {ch.description&&<div style={{padding:'0 12px 8px',fontSize:12,color:c.mid,lineHeight:1.4}}>{ch.description}</div>}
      {/* Автор */}
      <div style={{padding:'0 12px 10px',display:'flex',alignItems:'center',gap:5}}>
        <span style={{fontSize:10,color:c.sub}}>Автор: </span>
        <motion.span whileTap={{scale:0.92}} onClick={e=>{e.stopPropagation();onViewOwner();}}
          style={{fontSize:10,color:ac,fontWeight:700,cursor:'pointer'}}>{ch._owner.name||'@'+ch._owner.nick||'Пользователь'}</motion.span>
      </div>
    </motion.div>
  );
}

/* ─── Карточка группы ───────────────────────────────────── */
function GroupCard({g,c,ac,onClick,onViewOwner}:{g:GroupResult;c:SearchColors;ac:string;onClick():void;onViewOwner():void;}){
  return(
    <motion.div whileTap={{scale:0.98}} onClick={onClick}
      style={{borderRadius:16,overflow:'hidden',border:`1px solid ${g.color?g.color+'44':c.border}`,marginBottom:10,
        background:g.gradient||c.card,cursor:'pointer',boxShadow:'0 2px 12px rgba(0,0,0,0.2)'}}>
      <div style={{padding:'10px 12px'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:44,height:44,borderRadius:12,flexShrink:0,
            background:`linear-gradient(135deg,${g.color||ac}44,${g.color||ac}22)`,
            border:`2px solid ${g.color||ac}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>
            <span>{g.emoji||'👥'}</span>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:13,fontWeight:900,color:'rgba(255,255,255,0.92)'}}>{g.name}</div>
            {g.description&&<div style={{fontSize:11,color:'rgba(255,255,255,0.5)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{g.description}</div>}
            <div style={{display:'flex',gap:8,marginTop:2}}>
              <span style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>👥 {g.memberCount||0}</span>
              {g.streak>0&&<span style={{fontSize:10,color:'#f97316'}}>🔥 {g.streak}</span>}
              {g.todayMood&&<span style={{fontSize:12}}>{g.todayMood}</span>}
            </div>
          </div>
          <span style={{fontSize:11,color:'rgba(255,255,255,0.3)',flexShrink:0}}>›</span>
        </div>
      </div>
      <div style={{padding:'0 12px 10px',display:'flex',alignItems:'center',gap:5}}>
        <span style={{fontSize:10,color:'rgba(255,255,255,0.35)'}}>Создатель: </span>
        <motion.span whileTap={{scale:0.92}} onClick={e=>{e.stopPropagation();onViewOwner();}}
          style={{fontSize:10,color:g.color||ac,fontWeight:700,cursor:'pointer'}}>{g._owner.name||'@'+g._owner.nick||'Пользователь'}</motion.span>
      </div>
    </motion.div>
  );
}

/* ─── Детальный просмотр канала ─────────────────────────── */
function ChannelDetail({ch,c,ac,onClose,onViewOwner}:{ch:ChannelResult;c:SearchColors;ac:string;onClose():void;onViewOwner():void;}){
  return(
    <motion.div key="chd" initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring',damping:30,stiffness:260}}
      style={{position:'absolute',inset:0,background:c.deep,display:'flex',flexDirection:'column',zIndex:10,overflowY:'auto'}}>
      <div style={{position:'relative',flexShrink:0}}>
        <div style={{height:130,background:ch.coverGradient||`linear-gradient(135deg,${ac}44,#0a0a14)`,overflow:'hidden'}}>
          {ch.coverPhotoUrl&&<img src={ch.coverPhotoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>}
          <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,rgba(0,0,0,0.2),rgba(0,0,0,0.7))'}}/>
        </div>
        <motion.button whileTap={{scale:0.9}} onClick={onClose}
          style={{position:'absolute',top:12,left:12,width:36,height:36,borderRadius:12,background:'rgba(0,0,0,0.5)',
            border:'1px solid rgba(255,255,255,0.2)',color:'#fff',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)'}}>←</motion.button>
        <div style={{padding:'0 14px 14px',marginTop:-36,position:'relative'}}>
          <div style={{display:'flex',alignItems:'flex-end',gap:10}}>
            <div style={{width:60,height:60,borderRadius:14,flexShrink:0,overflow:'hidden',
              background:ch.coverGradient||`linear-gradient(135deg,${ac}44,#0a0a14)`,
              border:`3px solid ${c.deep}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:24}}>
              {ch.avatarPhotoUrl?<img src={ch.avatarPhotoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span>{ch.vibe||'📡'}</span>}
            </div>
            <div style={{flex:1,paddingBottom:4}}>
              <div style={{display:'flex',alignItems:'center',gap:5}}>
                <span style={{fontSize:15,fontWeight:900,color:'#fff'}}>{ch.name}</span>
                {ch.isVerified&&<span style={{color:'#60a5fa',fontWeight:700,fontSize:10}}>✓</span>}
              </div>
              {ch.handle&&<div style={{fontSize:11,color:'rgba(255,255,255,0.5)',fontFamily:'monospace'}}>@{ch.handle}</div>}
            </div>
          </div>
          {ch.description&&<div style={{marginTop:8,fontSize:13,color:'rgba(255,255,255,0.75)',lineHeight:1.5}}>{ch.description}</div>}
          <div style={{display:'flex',gap:14,marginTop:10}}>
            <div style={{textAlign:'center'}}><div style={{fontSize:14,fontWeight:900,color:'#fff'}}>{ch.subscribers||0}</div><div style={{fontSize:9,color:'rgba(255,255,255,0.4)',letterSpacing:'0.06em'}}>ПОДПИСЧИКИ</div></div>
            <div style={{textAlign:'center'}}><div style={{fontSize:14,fontWeight:900,color:'#fff'}}>{ch.postCount||0}</div><div style={{fontSize:9,color:'rgba(255,255,255,0.4)',letterSpacing:'0.06em'}}>ПОСТОВ</div></div>
          </div>
          {ch.tags?.length>0&&<div style={{display:'flex',flexWrap:'wrap',gap:5,marginTop:8}}>{ch.tags.map(t=><span key={t} style={{fontSize:10,color:ac,background:ac+'18',border:`1px solid ${ac}33`,borderRadius:20,padding:'2px 8px',fontWeight:700}}>#{t}</span>)}</div>}
          {/* Автор */}
          <div style={{marginTop:10,display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>Автор:</span>
            <motion.span whileTap={{scale:0.93}} onClick={onViewOwner}
              style={{fontSize:12,color:ac,fontWeight:700,cursor:'pointer'}}>{ch._owner.name||'Пользователь'} →</motion.span>
          </div>
        </div>
      </div>
      {/* Сотрудники */}
      {ch.employees?.length>0&&(
        <div style={{padding:'10px 14px',borderTop:`1px solid ${c.border}`}}>
          <div style={{fontSize:10,fontWeight:800,color:c.sub,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:8}}>👤 Команда</div>
          <div style={{display:'flex',gap:10,overflowX:'auto',scrollbarWidth:'none',paddingBottom:4}}>
            {ch.employees.map((emp:any,i:number)=>(
              <div key={i} style={{flexShrink:0,textAlign:'center',minWidth:56}}>
                <div style={{width:42,height:42,borderRadius:'50%',background:ac+'33',border:`2px solid ${ac}55`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,margin:'0 auto 4px',overflow:'hidden'}}>
                  {emp.photo?<img src={emp.photo} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span>👤</span>}
                </div>
                <div style={{fontSize:9,fontWeight:700,color:c.light,maxWidth:56,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{emp.name}</div>
                {emp.role&&<div style={{fontSize:8,color:c.sub}}>{emp.role}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Прайс */}
      {ch.priceList?.length>0&&(
        <div style={{padding:'10px 14px',borderTop:`1px solid ${c.border}`}}>
          <div style={{fontSize:10,fontWeight:800,color:c.sub,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:8}}>💰 Услуги и цены</div>
          {ch.priceList.map((item:any,i:number)=>(
            <div key={i} style={{borderRadius:10,background:c.card,border:`1px solid ${c.border}`,padding:'8px 12px',marginBottom:6,display:'flex',alignItems:'center',gap:10}}>
              <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:c.light}}>{item.name}</div>{item.desc&&<div style={{fontSize:11,color:c.sub,marginTop:1}}>{item.desc}</div>}</div>
              {item.price&&<div style={{fontSize:14,fontWeight:900,color:ac,flexShrink:0}}>{item.price}</div>}
            </div>
          ))}
        </div>
      )}
      {/* Посты */}
      <div style={{padding:'10px 14px 60px',borderTop:`1px solid ${c.border}`}}>
        <div style={{fontSize:10,fontWeight:800,color:c.sub,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:10}}>📝 Публикации</div>
        {Array.isArray(ch.posts)&&ch.posts.length>0
          ?[...ch.posts].reverse().map((p:any)=><PostCard key={p.id} p={p} ch={ch} c={c} ac={ac}/>)
          :<div style={{textAlign:'center',color:c.sub,fontSize:13,paddingTop:30,opacity:0.7}}>Публикаций пока нет</div>}
      </div>
    </motion.div>
  );
}

/* ─── Детальный просмотр группы ─────────────────────────── */
function GroupDetail({g,c,ac,onClose,onViewOwner}:{g:GroupResult;c:SearchColors;ac:string;onClose():void;onViewOwner():void;}){
  return(
    <motion.div key="grd" initial={{x:'100%'}} animate={{x:0}} exit={{x:'100%'}} transition={{type:'spring',damping:30,stiffness:260}}
      style={{position:'absolute',inset:0,background:c.deep,display:'flex',flexDirection:'column',zIndex:10,overflowY:'auto'}}>
      <div style={{flexShrink:0,position:'relative'}}>
        <div style={{height:110,background:g.gradient||`linear-gradient(135deg,${g.color||ac}44,#0a0a14)`,overflow:'hidden',position:'relative'}}>
          <div style={{position:'absolute',inset:0,background:'linear-gradient(to bottom,transparent 20%,rgba(0,0,0,0.75))'}}/>
          <motion.button whileTap={{scale:0.9}} onClick={onClose}
            style={{position:'absolute',top:12,left:12,width:36,height:36,borderRadius:12,background:'rgba(0,0,0,0.5)',
              border:'1px solid rgba(255,255,255,0.2)',color:'#fff',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',backdropFilter:'blur(8px)'}}>←</motion.button>
        </div>
        <div style={{padding:'0 14px 14px',marginTop:-36,position:'relative'}}>
          <div style={{display:'flex',alignItems:'flex-end',gap:10}}>
            <div style={{width:56,height:56,borderRadius:14,flexShrink:0,
              background:`linear-gradient(135deg,${g.color||ac}44,${g.color||ac}22)`,
              border:`3px solid ${c.deep}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26}}>
              <span>{g.emoji||'👥'}</span>
            </div>
            <div style={{flex:1,paddingBottom:4}}>
              <span style={{fontSize:15,fontWeight:900,color:'#fff'}}>{g.name}</span>
              {g.handle&&<div style={{fontSize:11,color:'rgba(255,255,255,0.4)',fontFamily:'monospace'}}>@{g.handle}</div>}
            </div>
          </div>
          {g.description&&<div style={{marginTop:8,fontSize:13,color:'rgba(255,255,255,0.7)',lineHeight:1.5}}>{g.description}</div>}
          <div style={{display:'flex',gap:14,marginTop:10}}>
            <div style={{textAlign:'center'}}><div style={{fontSize:14,fontWeight:900,color:'#fff'}}>{g.memberCount||0}</div><div style={{fontSize:9,color:'rgba(255,255,255,0.4)',letterSpacing:'0.06em'}}>УЧАСТНИКИ</div></div>
            {g.streak>0&&<div style={{textAlign:'center'}}><div style={{fontSize:14,fontWeight:900,color:'#f97316'}}>🔥 {g.streak}</div><div style={{fontSize:9,color:'rgba(255,255,255,0.4)',letterSpacing:'0.06em'}}>СТРИК</div></div>}
            {g.todayMood&&<div style={{textAlign:'center'}}><div style={{fontSize:22}}>{g.todayMood}</div><div style={{fontSize:9,color:'rgba(255,255,255,0.4)',letterSpacing:'0.06em'}}>НАСТРОЕНИЕ</div></div>}
          </div>
          {g.wordOfDay&&<div style={{marginTop:10,padding:'8px 12px',borderRadius:10,background:`${g.color||ac}18`,border:`1px solid ${g.color||ac}33`,fontSize:12,color:'rgba(255,255,255,0.8)'}}>💬 Слово дня: <strong>{g.wordOfDay}</strong></div>}
          <div style={{marginTop:10,display:'flex',alignItems:'center',gap:6}}>
            <span style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>Создатель:</span>
            <motion.span whileTap={{scale:0.93}} onClick={onViewOwner}
              style={{fontSize:12,color:g.color||ac,fontWeight:700,cursor:'pointer'}}>{g._owner.name||'Пользователь'} →</motion.span>
          </div>
        </div>
      </div>
      <div style={{padding:'10px 14px 60px',borderTop:`1px solid ${c.border}`}}>
        <div style={{fontSize:10,fontWeight:800,color:c.sub,letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:10}}>🗨 Обсуждения</div>
        {Array.isArray(g.posts)&&g.posts.length>0
          ?[...g.posts].reverse().map((p:any)=><GrPostCard key={p.id} p={p} g={g} c={c}/>)
          :<div style={{textAlign:'center',color:c.sub,fontSize:13,paddingTop:30,opacity:0.7}}>Публикаций пока нет</div>}
      </div>
    </motion.div>
  );
}

/* ─── Карточка поста канала ─────────────────────────────── */
function PostCard({p,ch,c,ac}:{p:any;ch:ChannelResult;c:SearchColors;ac:string;}){
  return(
    <div style={{borderRadius:14,overflow:'hidden',background:c.card,border:`1px solid ${c.border}`,marginBottom:10}}>
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px 5px'}}>
        <div style={{width:26,height:26,borderRadius:8,overflow:'hidden',flexShrink:0,
          background:ch.coverGradient||ac+'44',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12}}>
          {ch.avatarPhotoUrl?<img src={ch.avatarPhotoUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span>{ch.vibe||'📡'}</span>}
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:800,color:c.light}}>{ch.name}</div>
          <div style={{fontSize:9,color:c.sub}}>{new Date(p.createdAt).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</div>
        </div>
        {p.rubric&&<span style={{marginLeft:'auto',fontSize:9,color:ac,background:ac+'18',padding:'1px 6px',borderRadius:20}}>{p.rubric}</span>}
      </div>
      {p.imageUrl&&<img src={p.imageUrl} alt="" style={{width:'100%',maxHeight:280,objectFit:'cover',display:'block'}}/>}
      {p.text&&<div style={{padding:'5px 12px',fontSize:13,color:c.mid,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{p.text}</div>}
      {p.reactions&&<div style={{display:'flex',gap:6,padding:'4px 12px 8px'}}>
        {[['🔥',p.reactions.fire],['🚀',p.reactions.rocket],['❤️',p.reactions.heart]].filter(([,v])=>Number(v)>0).map(([e,v])=>(
          <span key={String(e)} style={{fontSize:11,color:c.sub,background:c.cardAlt,borderRadius:20,padding:'1px 7px'}}>{e} {v}</span>
        ))}
        {p.views>0&&<span style={{fontSize:9,color:c.sub,marginLeft:'auto'}}>👁 {p.views}</span>}
      </div>}
    </div>
  );
}

/* ─── Карточка поста группы ─────────────────────────────── */
function GrPostCard({p,g,c}:{p:any;g:GroupResult;c:SearchColors;}){
  return(
    <div style={{borderRadius:14,overflow:'hidden',background:c.card,border:`1px solid ${c.border}`,marginBottom:10}}>
      <div style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px 5px'}}>
        <div style={{width:26,height:26,borderRadius:'50%',overflow:'hidden',flexShrink:0,background:g.color||'#444',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12}}>
          {p.authorAvatar?<img src={p.authorAvatar} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>:<span>👤</span>}
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:c.light}}>{p.isAnon?'Анонимно':p.authorName}</div>
          <div style={{fontSize:9,color:c.sub}}>{new Date(p.createdAt).toLocaleDateString('ru-RU',{day:'numeric',month:'short'})}</div>
        </div>
      </div>
      {p.imageUrl&&<img src={p.imageUrl} alt="" style={{width:'100%',maxHeight:260,objectFit:'cover',display:'block'}}/>}
      {p.text&&<div style={{padding:'4px 12px 8px',fontSize:13,color:c.mid,lineHeight:1.6,whiteSpace:'pre-wrap'}}>{p.text}</div>}
      <div style={{display:'flex',gap:10,padding:'2px 12px 8px'}}>
        {p.likes>0&&<span style={{fontSize:11,color:c.sub}}>❤️ {p.likes}</span>}
        {p.comments?.length>0&&<span style={{fontSize:11,color:c.sub}}>💬 {p.comments.length}</span>}
      </div>
    </div>
  );
}

/* ─── Вспомогательные ───────────────────────────────────── */
function ru_end(n:number):string{
  if(n%100>=11&&n%100<=19)return 'ов';
  const r=n%10;if(r===1)return '';if(r>=2&&r<=4)return 'а';return 'ов';
}
function ru_end_g(n:number):string{
  if(n%100>=11&&n%100<=19)return '';
  const r=n%10;if(r===1)return 'а';if(r>=2&&r<=4)return 'ы';return '';
}
