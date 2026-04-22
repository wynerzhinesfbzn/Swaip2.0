import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ═══════════ ЯЗЫКИ ═══════════ */
/* gtrans = код для Google Translate API, tts = код для Google TTS */
const LANGUAGES = [
  { code:'ru', name:'Русский',     flag:'🇷🇺', gtrans:'ru',    tts:'ru-RU' },
  { code:'en', name:'English',     flag:'🇬🇧', gtrans:'en',    tts:'en-GB' },
  { code:'zh', name:'中文',         flag:'🇨🇳', gtrans:'zh-CN', tts:'zh-CN' },
  { code:'es', name:'Español',     flag:'🇪🇸', gtrans:'es',    tts:'es-ES' },
  { code:'fr', name:'Français',    flag:'🇫🇷', gtrans:'fr',    tts:'fr-FR' },
  { code:'de', name:'Deutsch',     flag:'🇩🇪', gtrans:'de',    tts:'de-DE' },
  { code:'ja', name:'日本語',       flag:'🇯🇵', gtrans:'ja',    tts:'ja-JP' },
  { code:'ko', name:'한국어',       flag:'🇰🇷', gtrans:'ko',    tts:'ko-KR' },
  { code:'ar', name:'العربية',     flag:'🇸🇦', gtrans:'ar',    tts:'ar-SA' },
  { code:'pt', name:'Português',   flag:'🇧🇷', gtrans:'pt',    tts:'pt-BR' },
  { code:'it', name:'Italiano',    flag:'🇮🇹', gtrans:'it',    tts:'it-IT' },
  { code:'hi', name:'हिंदी',       flag:'🇮🇳', gtrans:'hi',    tts:'hi-IN' },
  { code:'tr', name:'Türkçe',      flag:'🇹🇷', gtrans:'tr',    tts:'tr-TR' },
  { code:'pl', name:'Polski',      flag:'🇵🇱', gtrans:'pl',    tts:'pl-PL' },
  { code:'uk', name:'Українська',  flag:'🇺🇦', gtrans:'uk',    tts:'uk-UA' },
  { code:'nl', name:'Nederlands',  flag:'🇳🇱', gtrans:'nl',    tts:'nl-NL' },
  { code:'sv', name:'Svenska',     flag:'🇸🇪', gtrans:'sv',    tts:'sv-SE' },
  { code:'no', name:'Norsk',       flag:'🇳🇴', gtrans:'no',    tts:'nb-NO' },
  { code:'da', name:'Dansk',       flag:'🇩🇰', gtrans:'da',    tts:'da-DK' },
  { code:'fi', name:'Suomi',       flag:'🇫🇮', gtrans:'fi',    tts:'fi-FI' },
  { code:'cs', name:'Čeština',     flag:'🇨🇿', gtrans:'cs',    tts:'cs-CZ' },
  { code:'ro', name:'Română',      flag:'🇷🇴', gtrans:'ro',    tts:'ro-RO' },
  { code:'hu', name:'Magyar',      flag:'🇭🇺', gtrans:'hu',    tts:'hu-HU' },
  { code:'th', name:'ภาษาไทย',     flag:'🇹🇭', gtrans:'th',    tts:'th-TH' },
  { code:'vi', name:'Tiếng Việt',  flag:'🇻🇳', gtrans:'vi',    tts:'vi-VN' },
  { code:'id', name:'Indonesia',   flag:'🇮🇩', gtrans:'id',    tts:'id-ID' },
  { code:'el', name:'Ελληνικά',    flag:'🇬🇷', gtrans:'el',    tts:'el-GR' },
  { code:'bg', name:'Български',   flag:'🇧🇬', gtrans:'bg',    tts:'bg-BG' },
  { code:'he', name:'עברית',       flag:'🇮🇱', gtrans:'iw',    tts:'he-IL' },
  { code:'fa', name:'فارسی',       flag:'🇮🇷', gtrans:'fa',    tts:'fa-IR' },
];
type Lang = typeof LANGUAGES[0];
function getLang(code: string): Lang { return LANGUAGES.find(l=>l.code===code)||LANGUAGES[0]; }

/* ═══════════ ЛОКАЛИЗАЦИЯ UI ═══════════ */
type K = 'title'|'recognize'|'write'|'translate'|'sos'|'lock'|'translating'|'listening'|'ph'|'hello'|'thanks'|'wait'|'dunno'|'help'|'stop'|'speakHere';
const UI: Record<string, Record<K,string>> = {
  ru:{ title:'Я СЛЫШУ', recognize:'🎤 Слушать речь', write:'✏️ Написать', translate:'🔊 Перевести и озвучить', sos:'🆘 ПОДАТЬ СИГНАЛ О ПОМОЩИ', lock:'Зафиксировать языки', translating:'Перевод...', listening:'Слушаю...', ph:'Введите текст...', hello:'Здравствуйте', thanks:'Спасибо', wait:'Подождите', dunno:'Не понимаю', help:'Помогите мне', stop:'Стоп', speakHere:'Говорите — текст появится здесь...' },
  en:{ title:'I HEAR', recognize:'🎤 Listen', write:'✏️ Write', translate:'🔊 Translate & Speak', sos:'🆘 CALL FOR HELP', lock:'Lock languages', translating:'Translating...', listening:'Listening...', ph:'Type here...', hello:'Hello', thanks:'Thank you', wait:'Please wait', dunno:"Don't understand", help:'Help me', stop:'Stop', speakHere:'Speak — text appears here...' },
  de:{ title:'ICH HÖRE', recognize:'🎤 Zuhören', write:'✏️ Schreiben', translate:'🔊 Übersetzen & Vorlesen', sos:'🆘 HILFERUF', lock:'Sprachpaar sperren', translating:'Übersetze...', listening:'Höre zu...', ph:'Text eingeben...', hello:'Hallo', thanks:'Danke', wait:'Bitte warten', dunno:'Verstehe nicht', help:'Hilfe', stop:'Stop', speakHere:'Sprechen Sie...' },
  fr:{ title:"J'ENTENDS", recognize:'🎤 Écouter', write:'✏️ Écrire', translate:'🔊 Traduire et Lire', sos:"🆘 APPEL À L'AIDE", lock:'Verrouiller', translating:'Traduction...', listening:"J'écoute...", ph:'Tapez ici...', hello:'Bonjour', thanks:'Merci', wait:'Attendez', dunno:'Pas compris', help:'Aidez-moi', stop:'Stop', speakHere:'Parlez...' },
  es:{ title:'YO ESCUCHO', recognize:'🎤 Escuchar', write:'✏️ Escribir', translate:'🔊 Traducir y Leer', sos:'🆘 PEDIR AYUDA', lock:'Fijar idiomas', translating:'Traduciendo...', listening:'Escuchando...', ph:'Escribe aquí...', hello:'Hola', thanks:'Gracias', wait:'Espere', dunno:'No entiendo', help:'Ayuda', stop:'Parar', speakHere:'Hable...' },
  zh:{ title:'我听到了', recognize:'🎤 聆听', write:'✏️ 输入', translate:'🔊 翻译并朗读', sos:'🆘 紧急求助', lock:'锁定语言对', translating:'翻译中...', listening:'聆听中...', ph:'在此输入...', hello:'您好', thanks:'谢谢', wait:'请等待', dunno:'不明白', help:'请帮助', stop:'停止', speakHere:'请说话...' },
  uk:{ title:'Я ЧУЮ', recognize:'🎤 Слухати', write:'✏️ Написати', translate:'🔊 Перекласти і озвучити', sos:'🆘 СИГНАЛ ПРО ДОПОМОГУ', lock:'Зафіксувати мови', translating:'Переклад...', listening:'Слухаю...', ph:'Введіть текст...', hello:'Здрастуйте', thanks:'Дякую', wait:'Зачекайте', dunno:'Не розумію', help:'Допоможіть', stop:'Стоп', speakHere:'Говоріть...' },
};
function ui(lang: string, key: K): string { return (UI[lang]||UI['en'])[key]||UI['en'][key]; }

/* ═══════════ SOS ═══════════ */
const SOS_MSG: Record<string,string> = {
  ru:'Внимание! Мне нужна помощь! Я человек с ограниченными возможностями, с нарушением слуха и речи. Подойдите ко мне, пожалуйста!',
  en:'Attention! I need help! I am a person with hearing and speech impairment. Please come to me!',
  de:'Achtung! Ich brauche Hilfe! Ich bin eine Person mit Hör- und Sprachbehinderung. Bitte kommen Sie zu mir!',
  fr:"Attention! J'ai besoin d'aide! Handicap auditif et de la parole. Venez vers moi!",
  es:'¡Atención! ¡Necesito ayuda! Discapacidad auditiva y del habla. ¡Por favor acércate!',
  zh:'注意！我需要帮助！我有听力和言语障碍。请过来帮助我！',
  ja:'助けが必要です！聴覚と言語障害があります。来てください！',
  ko:'도움이 필요합니다! 청각 및 언어 장애가 있습니다. 와 주세요!',
  ar:'أحتاج مساعدة! إعاقة سمعية وكلامية. من فضلك تعال!',
  pt:'Preciso de ajuda! Deficiência auditiva e de fala. Por favor venha!',
  it:'Ho bisogno di aiuto! Disabilità uditive e del linguaggio. Venga da me!',
  hi:'मुझे मदद चाहिए! श्रवण और वाणी दोष हूँ। कृपया आएं!',
  tr:'Yardıma ihtiyacım var! Duyma ve konuşma engelliyim. Lütfen gelin!',
  pl:'Potrzebuję pomocy! Niepełnosprawność słuchowa. Proszę podejść!',
  uk:'Мені потрібна допомога! Порушення слуху та мови. Підійдіть, будь ласка!',
};
function getSosMsg(lang: string): string { return SOS_MSG[lang]||SOS_MSG['en']; }

/* ═══════════ GOOGLE TRANSLATE — все языковые пары ═══════════ */
async function translateText(text: string, fromCode: string, toCode: string): Promise<string> {
  if (fromCode===toCode || !text.trim()) return text;
  const sl = getLang(fromCode).gtrans;
  const tl = getLang(toCode).gtrans;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(9000) });
    const d = await r.json();
    /* Ответ: [[[фрагмент, оригинал, ...], ...], ...] */
    const translated = (d[0] as any[])?.map((x:any)=>x[0]).join('') || '';
    return translated || text;
  } catch { return text; }
}

/* ═══════════ TTS — Google профессиональный голос через прокси ═══════════ */
let currentAudio: HTMLAudioElement|null = null;

function speakViaProxy(text: string, ttsLang: string, apiBase: string) {
  if (!text.trim()) return;
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  const url = `${apiBase}/api/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(ttsLang)}`;
  const audio = new Audio(url);
  audio.volume = 1.0;
  currentAudio = audio;
  audio.play().catch(() => {
    /* Fallback: Web Speech API */
    speakWebSpeech(text, ttsLang);
  });
}

function speakWebSpeech(text: string, ttsLang: string, voices: SpeechSynthesisVoice[] = []) {
  if (!('speechSynthesis' in window) || !text.trim()) return;
  const ss = window.speechSynthesis;
  ss.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = ttsLang;
  utter.rate = 0.88;
  utter.volume = 1.0;
  utter.pitch = 1.0;
  const prefix = ttsLang.split('-')[0];
  const vList = voices.length > 0 ? voices : ss.getVoices();
  const match =
    vList.find(v=>v.lang===ttsLang && !v.localService) ||
    vList.find(v=>v.lang.startsWith(prefix) && !v.localService) ||
    vList.find(v=>v.lang===ttsLang) ||
    vList.find(v=>v.lang.startsWith(prefix));
  if (match) utter.voice = match;
  if (ss.paused) ss.resume();
  ss.speak(utter);
  setTimeout(()=>{ if (ss.paused) ss.resume(); }, 150);
}

/* ═══════════ BEEP ═══════════ */
function playBeep(ctx: AudioContext, freq: number, start: number, dur: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.frequency.value = freq; osc.type = 'square';
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.7, start+0.02);
  gain.gain.setValueAtTime(0.7, start+dur-0.05);
  gain.gain.linearRampToValueAtTime(0, start+dur);
  osc.start(start); osc.stop(start+dur);
}

/* ═══════════ LANG PICKER ═══════════ */
function LangPicker({ value, onChange, exclude, open, onOpen }: {
  value:string; onChange:(c:string)=>void; exclude:string; open:boolean; onOpen:(v:boolean)=>void;
}) {
  const lang = getLang(value);
  const FF = '"Montserrat",sans-serif';
  return (
    <div style={{ position:'relative', flex:1 }}>
      <motion.button whileTap={{ scale:0.97 }} onClick={()=>onOpen(!open)}
        style={{ width:'100%', padding:'9px 10px', borderRadius:10,
          background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)',
          color:'#e8e8f6', fontSize:12, fontWeight:700, cursor:'pointer',
          display:'flex', alignItems:'center', gap:5, fontFamily:FF }}>
        <span style={{ fontSize:16 }}>{lang.flag}</span>
        <span style={{ flex:1, textAlign:'left', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lang.name}</span>
        <span style={{ opacity:0.4, fontSize:9 }}>{open?'▲':'▼'}</span>
      </motion.button>
      <AnimatePresence>
        {open&&(
          <motion.div initial={{ opacity:0,y:-4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
            style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:60,
              background:'#0d0d1a', border:'1px solid rgba(255,255,255,0.12)',
              borderRadius:10, maxHeight:200, overflowY:'auto', marginTop:3,
              boxShadow:'0 8px 32px rgba(0,0,0,0.7)' }}>
            {LANGUAGES.filter(l=>l.code!==exclude).map(l=>(
              <motion.button key={l.code} whileTap={{ scale:0.98 }}
                onClick={()=>{ onChange(l.code); onOpen(false); }}
                style={{ width:'100%', padding:'8px 12px',
                  background:l.code===value?'rgba(255,255,255,0.09)':'none',
                  border:'none', color:'#e8e8f6', fontSize:12, fontWeight:600, cursor:'pointer',
                  display:'flex', alignItems:'center', gap:7, textAlign:'left', fontFamily:FF }}>
                <span style={{ fontSize:14 }}>{l.flag}</span>
                <span style={{ flex:1 }}>{l.name}</span>
                {l.code===value&&<span style={{ color:'#22d367', fontSize:10 }}>✓</span>}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════ ГЛАВНЫЙ КОМПОНЕНТ ═══════════ */
interface Props { onBack:()=>void; accent:string; apiBase?:string; }
type SpeechAny = any;

export default function AccessibilityAssistant({ onBack, accent, apiBase='' }: Props) {
  const [myLang, setMyLang]       = useState(()=>{ try{ return localStorage.getItem('acc_myLang')||'ru'; }catch{ return 'ru'; } });
  const [theirLang, setTheirLang] = useState(()=>{ try{ return localStorage.getItem('acc_theirLang')||'en'; }catch{ return 'en'; } });
  const [locked, setLocked]       = useState(false);
  const [openL, setOpenL]         = useState(false);
  const [openR, setOpenR]         = useState(false);

  const [listening, setListening]     = useState(false);
  const [spokenText, setSpokenText]   = useState('');
  const [interim, setInterim]         = useState('');
  const [translSpoken, setTranslSpoken] = useState('');

  const [inputText, setInputText]   = useState('');
  const [outputText, setOutputText] = useState('');
  const [translating, setTranslating] = useState(false);
  const [sosPending, setSosPending]   = useState(false);

  const recogRef      = useRef<SpeechAny>(null);
  const silenceRef    = useRef<ReturnType<typeof setTimeout>|null>(null);
  const translTimerRef = useRef<ReturnType<typeof setTimeout>|null>(null);
  const activeRef     = useRef(false);   /* флаг: нужно ли продолжать слушать */
  const accumRef      = useRef('');      /* накопленный финальный текст (мутируемый) */
  const inputRef      = useRef<HTMLTextAreaElement>(null);
  const voicesRef     = useRef<SpeechSynthesisVoice[]>([]);

  /* Предзагрузка Web Speech голосов (fallback) */
  useEffect(()=>{
    if (!('speechSynthesis' in window)) return;
    const load = () => { const v=window.speechSynthesis.getVoices(); if(v.length>0) voicesRef.current=v; };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return ()=>window.speechSynthesis.removeEventListener('voiceschanged', load);
  }, []);

  useEffect(()=>{ try{ localStorage.setItem('acc_myLang', myLang); }catch{} }, [myLang]);
  useEffect(()=>{ try{ localStorage.setItem('acc_theirLang', theirLang); }catch{} }, [theirLang]);

  const FF   = '"Montserrat",sans-serif';
  const BG   = '#09090f';
  const CARD = 'rgba(255,255,255,0.05)';
  const LINE = 'rgba(255,255,255,0.09)';
  const TEXT = '#e8e8f6';
  const SUB  = 'rgba(220,220,245,0.4)';
  const GREEN = '#0ecb81';
  const RED   = '#f6465d';

  const t = (k:K) => ui(myLang, k);

  const reset = () => {
    setSpokenText(''); setInterim(''); setTranslSpoken('');
    setInputText(''); setOutputText('');
  };
  const swapLangs = () => {
    if (locked) return;
    setMyLang(theirLang); setTheirLang(myLang); reset();
  };

  /* Говорим — используем бэкенд-прокси Google TTS, fallback на Web Speech */
  const speakText = useCallback((text: string, langCode: string) => {
    const ttsLang = getLang(langCode).tts;
    speakViaProxy(text, ttsLang, apiBase);
  }, [apiBase]);

  const stopAll = useCallback(()=>{
    /* Сначала выставляем флаг — onend не будет перезапускать сессию */
    activeRef.current = false;
    if (recogRef.current) {
      try { recogRef.current.abort(); } catch {}
      recogRef.current = null;
    }
    if (silenceRef.current) { clearTimeout(silenceRef.current); silenceRef.current = null; }
    if (translTimerRef.current) { clearTimeout(translTimerRef.current); translTimerRef.current = null; }
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setListening(false); setInterim('');
  }, []);

  const startListening = useCallback(()=>{
    const SR = (window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if (!SR) { alert('Используйте Chrome для распознавания речи'); return; }

    stopAll();
    setSpokenText(''); setInterim(''); setTranslSpoken('');
    accumRef.current = '';
    activeRef.current = true;
    setListening(true);

    /* ── Запускаем ОДНУ сессию. onend → перезапустит, если activeRef.current ── */
    const runSession = () => {
      if (!activeRef.current) return;
      const r = new SR() as SpeechAny;
      recogRef.current = r;

      r.lang            = getLang(theirLang).tts; /* язык СОБЕСЕДНИКА */
      r.interimResults  = true;
      r.continuous      = false;  /* НЕ continuous — Android ведёт себя правильно */
      r.maxAlternatives = 1;

      r.onresult = (e: any) => {
        if (!activeRef.current) return;
        let fin = '', tmp = '';
        for (let i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) fin += e.results[i][0].transcript;
          else tmp += e.results[i][0].transcript;
        }
        if (tmp) setInterim(tmp);
        if (fin) {
          /* Добавляем только новый финальный фрагмент через ref (без накопления в замыкании) */
          const trimmed = fin.trim();
          accumRef.current = accumRef.current
            ? accumRef.current + ' ' + trimmed
            : trimmed;
          setSpokenText(accumRef.current);
          setInterim('');

          /* Таймер тишины: 3 сек без новой речи → остановить */
          if (silenceRef.current) clearTimeout(silenceRef.current);
          silenceRef.current = setTimeout(()=>{
            activeRef.current = false;
            if (recogRef.current) { try { recogRef.current.abort(); } catch {} recogRef.current = null; }
            setListening(false);
          }, 3000);
        }
      };

      r.onerror = (e: any) => {
        setInterim('');
        /* no-speech / aborted — просто перезапускаем сессию */
        if (activeRef.current && (e.error === 'no-speech' || e.error === 'aborted')) {
          setTimeout(runSession, 100);
        } else {
          activeRef.current = false;
          setListening(false);
        }
      };

      r.onend = () => {
        setInterim('');
        recogRef.current = null;
        /* Перезапускаем сессию, если ещё нужно слушать */
        if (activeRef.current) setTimeout(runSession, 80);
        else setListening(false);
      };

      try { r.start(); } catch (_) {}
    };

    runSession();
  }, [theirLang, stopAll]);

  /* ── Перевод с дебаунсом 450 мс (ждём паузу в речи, а не каждое слово) ── */
  useEffect(()=>{
    if (!spokenText.trim()) return;
    if (translTimerRef.current) clearTimeout(translTimerRef.current);
    translTimerRef.current = setTimeout(()=>{
      translateText(spokenText, theirLang, myLang).then(setTranslSpoken);
    }, 450);
    return ()=>{ if (translTimerRef.current) clearTimeout(translTimerRef.current); };
  }, [spokenText, theirLang, myLang]);

  /* ГЛАВНАЯ КНОПКА: перевести + озвучить */
  const handleTranslateAndSpeak = useCallback(async()=>{
    if (!inputText.trim()) return;
    setTranslating(true);
    const tr = await translateText(inputText, myLang, theirLang);
    setOutputText(tr);
    setTranslating(false);
    speakText(tr, theirLang);
  }, [inputText, myLang, theirLang, speakText]);

  /* БЫСТРЫЕ ФРАЗЫ → язык собеседника */
  const quickPhrase = useCallback(async(phrase:string)=>{
    setInputText(phrase); setOutputText('');
    setTranslating(true);
    const tr = await translateText(phrase, myLang, theirLang);
    setOutputText(tr);
    setTranslating(false);
    speakText(tr, theirLang);
  }, [myLang, theirLang, speakText]);

  /* SOS */
  const handleSOS = useCallback(()=>{
    if (sosPending) return;
    setSosPending(true);
    const sosText = getSosMsg(theirLang);
    const ttsLang = getLang(theirLang).tts;
    try {
      const ctx = new AudioContext();
      [0,0.7,1.4].forEach(t=>{
        playBeep(ctx, 880, ctx.currentTime+t, 0.5);
        playBeep(ctx, 1320, ctx.currentTime+t+0.15, 0.35);
      });
      setTimeout(()=>speakViaProxy(sosText, ttsLang, apiBase), 2300);
    } catch { speakViaProxy(sosText, ttsLang, apiBase); }
    setTimeout(()=>setSosPending(false), 7000);
  }, [theirLang, sosPending, apiBase]);

  const myL    = getLang(myLang);
  const theirL = getLang(theirLang);
  const quickPhrases = [t('hello'), t('thanks'), t('wait'), t('dunno'), t('help')];

  return (
    <div style={{ position:'fixed', inset:0, background:BG, color:TEXT, fontFamily:FF,
      display:'flex', flexDirection:'column', zIndex:300, overflow:'hidden' }}
      onClick={()=>{ setOpenL(false); setOpenR(false); }}>

      {/* ХЕДЕР */}
      <div style={{ padding:'46px 14px 10px', display:'flex', alignItems:'center', gap:10,
        borderBottom:`1px solid ${LINE}`, background:'rgba(9,9,15,0.98)',
        backdropFilter:'blur(20px)', flexShrink:0 }}>
        <motion.button whileTap={{ scale:0.88 }} onClick={()=>{ stopAll(); onBack(); }}
          style={{ width:34, height:34, borderRadius:'50%', background:'rgba(255,255,255,0.07)',
            border:`1px solid ${LINE}`, color:TEXT, fontSize:15, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          ←
        </motion.button>
        <div style={{ fontSize:16, fontWeight:900, letterSpacing:'0.05em', flex:1 }}>👁 {t('title')}</div>
        {listening&&(
          <motion.div animate={{ opacity:[1,0.3,1] }} transition={{ repeat:Infinity, duration:0.9 }}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 9px',
              borderRadius:20, background:`${RED}20`, border:`1px solid ${RED}44`,
              fontSize:10, color:RED, fontWeight:800 }}>
            <div style={{ width:6, height:6, borderRadius:'50%', background:RED }}/>
            {t('listening')}
          </motion.div>
        )}
      </div>

      {/* ТЕЛО */}
      <div style={{ flex:1, overflowY:'auto', WebkitOverflowScrolling:'touch' as any, padding:'10px 12px 16px' }}
        onClick={e=>e.stopPropagation()}>

        {/* ВЫБОР ЯЗЫКОВ */}
        <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:6 }}>
          <div style={{ flex:1 }} onClick={e=>{ e.stopPropagation(); setOpenR(false); }}>
            <LangPicker value={myLang} exclude={theirLang} open={openL} onOpen={setOpenL}
              onChange={v=>{ if(!locked){ setMyLang(v); reset(); } }}/>
          </div>
          <motion.button whileTap={{ scale:0.82 }} onClick={swapLangs}
            style={{ width:34, height:34, borderRadius:10,
              background:locked?'rgba(255,255,255,0.03)':`${accent}15`,
              border:`1px solid ${locked?LINE:accent+'33'}`,
              color:locked?SUB:accent, fontSize:16, cursor:locked?'not-allowed':'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            ⇄
          </motion.button>
          <div style={{ flex:1 }} onClick={e=>{ e.stopPropagation(); setOpenL(false); }}>
            <LangPicker value={theirLang} exclude={myLang} open={openR} onOpen={setOpenR}
              onChange={v=>{ if(!locked){ setTheirLang(v); reset(); } }}/>
          </div>
          <motion.button whileTap={{ scale:0.88 }} onClick={()=>setLocked(v=>!v)}
            style={{ width:34, height:34, borderRadius:10,
              background:locked?`${accent}18`:'rgba(255,255,255,0.04)',
              border:`1px solid ${locked?accent+'44':LINE}`,
              color:locked?accent:SUB, fontSize:14, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            {locked?'🔒':'🔓'}
          </motion.button>
        </div>

        {/* КНОПКИ РЕЖИМА */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, marginBottom:8 }}>
          <motion.button whileTap={{ scale:0.96 }}
            onClick={()=>{ if(listening){ stopAll(); } else { startListening(); } }}
            style={{ padding:'11px 8px', borderRadius:10, cursor:'pointer', fontFamily:FF,
              background:listening?`${RED}20`:`${GREEN}15`,
              border:`1.5px solid ${listening?RED+'55':GREEN+'44'}`,
              color:listening?RED:GREEN, fontSize:12, fontWeight:800 }}>
            {listening ? `⏹ ${t('stop')}` : t('recognize')}
          </motion.button>
          <motion.button whileTap={{ scale:0.96 }}
            onClick={()=>{ stopAll(); setTimeout(()=>inputRef.current?.focus(),80); }}
            style={{ padding:'11px 8px', borderRadius:10, cursor:'pointer', fontFamily:FF,
              background:`${accent}12`, border:`1.5px solid ${accent}33`,
              color:accent, fontSize:12, fontWeight:800 }}>
            {t('write')}
          </motion.button>
        </div>

        {/* БЛОК СЛУШАЮ */}
        {(spokenText||interim||listening) && (
          <div style={{ borderRadius:12, border:`1px solid ${LINE}`, background:CARD,
            marginBottom:8, padding:'10px 12px' }}>
            {/* Метка: слушаем речь на языке собеседника */}
            <div style={{ fontSize:9, color:SUB, fontWeight:700, letterSpacing:'0.07em',
              textTransform:'uppercase', marginBottom:6 }}>
              {theirL.flag} {theirL.name} → {myL.flag} {myL.name}
            </div>

            {/* Промежуточный текст (пока говорят) */}
            {interim && !translSpoken && (
              <div style={{ fontSize:13, color:SUB, fontStyle:'italic', lineHeight:1.6 }}>
                {interim}
              </div>
            )}

            {/* Если перевод готов — показываем ТОЛЬКО его крупно */}
            {translSpoken ? (
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:17, fontWeight:900, color:accent, lineHeight:1.5 }}>
                    {translSpoken}
                  </div>
                  {/* Оригинал — мелко, для справки */}
                  {spokenText && theirLang !== myLang && (
                    <div style={{ fontSize:10, color:SUB, marginTop:3, fontStyle:'italic' }}>
                      {theirL.name}: {spokenText}
                    </div>
                  )}
                </div>
                <motion.button whileTap={{ scale:0.88 }}
                  onClick={()=>speakText(translSpoken, myLang)}
                  style={{ width:32, height:32, borderRadius:'50%', background:`${accent}20`,
                    border:`1px solid ${accent}44`, color:accent, fontSize:15, cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  🔊
                </motion.button>
              </div>
            ) : (
              /* Перевод ещё грузится — показываем оригинал */
              !interim && (
                <div style={{ fontSize:13, color:TEXT, lineHeight:1.6 }}>
                  {spokenText
                    ? <span style={{ color:SUB, fontStyle:'italic' }}>⏳ {spokenText}</span>
                    : <span style={{ color:SUB, fontStyle:'italic' }}>{t('speakHere')}</span>
                  }
                </div>
              )
            )}
          </div>
        )}

        {/* ПОЛЕ ВВОДА */}
        <div style={{ borderRadius:12, border:`1px solid ${LINE}`, background:CARD,
          marginBottom:6, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'flex-start' }}>
            <textarea ref={inputRef} value={inputText}
              onChange={e=>{ setInputText(e.target.value); setOutputText(''); }}
              placeholder={t('ph')}
              style={{ flex:1, minHeight:64, padding:'10px 12px', background:'transparent',
                border:'none', outline:'none', color:TEXT, fontSize:14, fontFamily:FF,
                resize:'none', lineHeight:1.6, boxSizing:'border-box' }}/>
            {inputText&&(
              <motion.button whileTap={{ scale:0.88 }}
                onClick={()=>{ setInputText(''); setOutputText(''); }}
                style={{ width:26, height:26, margin:'9px 9px 0 0', borderRadius:'50%',
                  background:'rgba(246,70,93,0.12)', border:'1px solid rgba(246,70,93,0.25)',
                  color:RED, fontSize:11, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                ✕
              </motion.button>
            )}
          </div>
          {(outputText||translating)&&(
            <div style={{ borderTop:`1px solid ${LINE}`, padding:'8px 12px',
              background:'rgba(255,255,255,0.02)', display:'flex', alignItems:'center', gap:8 }}>
              <div style={{ flex:1 }}>
                {translating
                  ? <div style={{ color:SUB, fontSize:11, fontStyle:'italic' }}>{t('translating')}</div>
                  : <div style={{ fontSize:15, fontWeight:800, color:accent, lineHeight:1.5 }}>{outputText}</div>
                }
              </div>
              {!translating&&outputText&&(
                <motion.button whileTap={{ scale:0.88 }}
                  onClick={()=>speakText(outputText, theirLang)}
                  style={{ width:32, height:32, borderRadius:'50%', background:`${accent}20`,
                    border:`1px solid ${accent}44`, color:accent, fontSize:15, cursor:'pointer',
                    display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  🔊
                </motion.button>
              )}
            </div>
          )}
        </div>

        {/* КНОПКА ПЕРЕВЕСТИ И ОЗВУЧИТЬ */}
        <motion.button whileTap={{ scale:0.97 }} onClick={handleTranslateAndSpeak}
          disabled={!inputText.trim()||translating}
          style={{ width:'100%', padding:'13px', borderRadius:12,
            cursor:inputText.trim()?'pointer':'not-allowed',
            background:inputText.trim()
              ?`linear-gradient(135deg,${accent},${accent}bb)`
              :'rgba(255,255,255,0.04)',
            border:`1.5px solid ${inputText.trim()?accent+'66':LINE}`,
            color:inputText.trim()?'#fff':SUB,
            fontSize:14, fontWeight:900, fontFamily:FF, letterSpacing:'0.02em',
            marginBottom:10, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            boxShadow:inputText.trim()?`0 4px 20px ${accent}44`:'none', transition:'all 0.2s' }}>
          {translating ? `⏳ ${t('translating')}` : t('translate')}
        </motion.button>

        {/* БЫСТРЫЕ ФРАЗЫ */}
        <div style={{ display:'flex', gap:5, overflowX:'auto', marginBottom:10,
          padding:'1px 0', scrollbarWidth:'none' as any }}>
          {quickPhrases.map(phrase=>(
            <motion.button key={phrase} whileTap={{ scale:0.92 }} onClick={()=>quickPhrase(phrase)}
              style={{ padding:'6px 11px', borderRadius:20, border:`1px solid ${LINE}`,
                background:'rgba(255,255,255,0.05)', color:TEXT, fontSize:11, fontWeight:700,
                cursor:'pointer', whiteSpace:'nowrap', flexShrink:0, fontFamily:FF }}>
              {phrase}
            </motion.button>
          ))}
        </div>

        {/* SOS */}
        <motion.button whileTap={{ scale:0.97 }} onClick={handleSOS}
          animate={{ boxShadow: sosPending
            ? ['0 0 0px rgba(246,70,93,0)','0 0 28px rgba(246,70,93,0.9)','0 0 0px rgba(246,70,93,0)']
            : '0 4px 18px rgba(246,70,93,0.35)' }}
          transition={{ repeat:sosPending?Infinity:0, duration:0.55 }}
          style={{ width:'100%', padding:'15px', borderRadius:14, cursor:'pointer',
            background:`linear-gradient(135deg,${RED},#b01222)`,
            border:`2px solid ${RED}`, color:'#fff', fontSize:15, fontWeight:900, fontFamily:FF,
            letterSpacing:'0.03em', display:'flex', alignItems:'center', justifyContent:'center',
            gap:8, marginBottom:6 }}>
          <span style={{ fontSize:20 }}>🆘</span>
          {t('sos')}
        </motion.button>
        <div style={{ textAlign:'center', fontSize:10, color:SUB, lineHeight:1.5 }}>
          3 сигнала → голос на языке собеседника
        </div>
      </div>
    </div>
  );
}
