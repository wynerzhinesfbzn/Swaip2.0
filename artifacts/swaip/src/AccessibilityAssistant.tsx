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

/* ═══════════ ЛОКАЛИЗАЦИЯ UI — все 30 языков ═══════════ */
type K = 'title'|'recognize'|'write'|'translate'|'sos'|'lock'|'translating'|'listening'|'ph'|'hello'|'thanks'|'wait'|'dunno'|'help'|'stop'|'speakHere'|'dialog'|'clear'|'emptyHint'|'myPhrases'|'noPhrases'|'addPhrase'|'writePhrase';
const UI: Record<string, Partial<Record<K,string>>> = {
  ru:{ title:'Я СЛЫШУ',       recognize:'🎤 Слушать речь',         write:'✏️ Написать',          translate:'🔊 Перевести и озвучить',   sos:'🆘 ПОДАТЬ СИГНАЛ О ПОМОЩИ', lock:'Зафиксировать языки',   translating:'Перевод...',         listening:'Слушаю...',       ph:'Введите текст...',      hello:'Здравствуйте', thanks:'Спасибо',       wait:'Подождите',      dunno:'Не понимаю',      help:'Помогите мне',  stop:'Стоп',    speakHere:'Говорите — текст появится здесь...', dialog:'💬 Диалог', clear:'Очистить', emptyHint:'Введите текст или нажмите «Слушать» — перевод появится здесь', myPhrases:'📁 Мои фразы', noPhrases:'Нет сохранённых фраз', addPhrase:'+ Добавить фразу', writePhrase:'Напишите фразу...' },
  en:{ title:'I HEAR',        recognize:'🎤 Listen',                write:'✏️ Write',              translate:'🔊 Translate & Speak',      sos:"🆘 CALL FOR HELP",           lock:'Lock languages',         translating:'Translating...',     listening:'Listening...',    ph:'Type here...',          hello:'Hello',        thanks:'Thank you',     wait:'Please wait',    dunno:"Don't understand", help:'Help me',       stop:'Stop',    speakHere:'Speak — text appears here...',       dialog:'💬 Dialogue', clear:'Clear', emptyHint:'Type text or tap Listen — translation appears here', myPhrases:'📁 My phrases', noPhrases:'No saved phrases', addPhrase:'+ Add phrase', writePhrase:'Write a phrase...' },
  de:{ title:'ICH HÖRE',      recognize:'🎤 Zuhören',               write:'✏️ Schreiben',          translate:'🔊 Übersetzen & Vorlesen',  sos:'🆘 HILFERUF',                lock:'Sprachpaar sperren',     translating:'Übersetze...',       listening:'Höre zu...',      ph:'Text eingeben...',      hello:'Hallo',        thanks:'Danke',         wait:'Bitte warten',   dunno:'Verstehe nicht',   help:'Hilfe',         stop:'Stop',    speakHere:'Sprechen Sie...' },
  fr:{ title:"J'ENTENDS",     recognize:'🎤 Écouter',               write:'✏️ Écrire',             translate:'🔊 Traduire et Lire',       sos:"🆘 APPEL À L'AIDE",          lock:'Verrouiller',            translating:'Traduction...',      listening:"J'écoute...",     ph:'Tapez ici...',          hello:'Bonjour',      thanks:'Merci',         wait:'Attendez',       dunno:'Pas compris',      help:'Aidez-moi',     stop:'Stop',    speakHere:'Parlez...' },
  es:{ title:'YO ESCUCHO',    recognize:'🎤 Escuchar',              write:'✏️ Escribir',           translate:'🔊 Traducir y Leer',        sos:'🆘 PEDIR AYUDA',             lock:'Fijar idiomas',          translating:'Traduciendo...',     listening:'Escuchando...',   ph:'Escribe aquí...',       hello:'Hola',         thanks:'Gracias',       wait:'Espere',         dunno:'No entiendo',      help:'Ayuda',         stop:'Parar',   speakHere:'Hable...' },
  zh:{ title:'我听到了',       recognize:'🎤 聆听',                  write:'✏️ 输入',               translate:'🔊 翻译并朗读',              sos:'🆘 紧急求助',                 lock:'锁定语言对',              translating:'翻译中...',          listening:'聆听中...',       ph:'在此输入...',           hello:'您好',         thanks:'谢谢',          wait:'请等待',         dunno:'不明白',           help:'请帮助',        stop:'停止',    speakHere:'请说话...' },
  uk:{ title:'Я ЧУЮ',         recognize:'🎤 Слухати',               write:'✏️ Написати',           translate:'🔊 Перекласти і озвучити',  sos:'🆘 СИГНАЛ ПРО ДОПОМОГУ',    lock:'Зафіксувати мови',       translating:'Переклад...',        listening:'Слухаю...',       ph:'Введіть текст...',      hello:'Здрастуйте',   thanks:'Дякую',         wait:'Зачекайте',      dunno:'Не розумію',       help:'Допоможіть',    stop:'Стоп',    speakHere:'Говоріть...' },
  ja:{ title:'聴こえます',     recognize:'🎤 聞く',                  write:'✏️ 書く',               translate:'🔊 翻訳して読む',            sos:'🆘 助けを呼ぶ',               lock:'言語を固定',              translating:'翻訳中...',          listening:'聞いています...',  ph:'ここに入力...',        hello:'こんにちは',     thanks:'ありがとう',     wait:'お待ちください',  dunno:'分かりません',     help:'助けてください', stop:'止まれ',  speakHere:'話してください...' },
  ko:{ title:'들립니다',       recognize:'🎤 듣기',                  write:'✏️ 쓰기',               translate:'🔊 번역 및 읽기',            sos:'🆘 도움 요청',               lock:'언어 고정',               translating:'번역 중...',         listening:'듣는 중...',      ph:'여기에 입력...',        hello:'안녕하세요',     thanks:'감사합니다',     wait:'기다려주세요',   dunno:'모르겠습니다',     help:'도와주세요',    stop:'정지',    speakHere:'말씀하세요...' },
  ar:{ title:'أسمعك',         recognize:'🎤 استمع',                 write:'✏️ اكتب',               translate:'🔊 ترجم واقرأ',             sos:'🆘 اطلب المساعدة',           lock:'تثبيت اللغات',           translating:'جارٍ الترجمة...',   listening:'أستمع...',        ph:'اكتب هنا...',           hello:'مرحبا',        thanks:'شكرا',          wait:'انتظر',          dunno:'لا أفهم',          help:'ساعدني',        stop:'وقف',     speakHere:'تحدث...' },
  pt:{ title:'EU OUÇO',       recognize:'🎤 Ouvir',                 write:'✏️ Escrever',           translate:'🔊 Traduzir e Ler',         sos:'🆘 PEDIR SOCORRO',           lock:'Fixar idiomas',          translating:'Traduzindo...',      listening:'Ouvindo...',      ph:'Digite aqui...',        hello:'Olá',          thanks:'Obrigado',      wait:'Aguarde',        dunno:'Não entendo',      help:'Me ajude',      stop:'Parar',   speakHere:'Fale...' },
  it:{ title:'SENTO',         recognize:'🎤 Ascolta',               write:'✏️ Scrivi',             translate:'🔊 Traduci e Leggi',        sos:'🆘 CHIEDI AIUTO',            lock:'Blocca lingue',          translating:'Traduzione...',      listening:'Ascolto...',      ph:'Scrivi qui...',         hello:'Salve',        thanks:'Grazie',        wait:'Attendi',        dunno:'Non capisco',      help:'Aiutami',       stop:'Stop',    speakHere:'Parla...' },
  hi:{ title:'मैं सुनता हूँ', recognize:'🎤 सुनें',                write:'✏️ लिखें',             translate:'🔊 अनुवाद और पढ़ें',        sos:'🆘 सहायता माँगें',           lock:'भाषाएँ लॉक करें',         translating:'अनुवाद हो रहा है...', listening:'सुन रहा हूँ...', ph:'यहाँ लिखें...',       hello:'नमस्ते',       thanks:'धन्यवाद',       wait:'रुकिए',          dunno:'समझ नहीं आया',    help:'मदद करें',      stop:'रोकें',   speakHere:'बोलिए...' },
  tr:{ title:'DUYUYORUM',     recognize:'🎤 Dinle',                 write:'✏️ Yaz',                translate:'🔊 Çevir ve Oku',           sos:'🆘 YARDIM İSTE',             lock:'Dilleri kilitle',        translating:'Çevriliyor...',      listening:'Dinliyorum...',   ph:'Buraya yaz...',         hello:'Merhaba',      thanks:'Teşekkürler',   wait:'Bekleyin',       dunno:'Anlamıyorum',      help:'Bana yardım et', stop:'Dur',    speakHere:'Konuşun...' },
  pl:{ title:'SŁYSZĘ',        recognize:'🎤 Słuchaj',               write:'✏️ Pisz',               translate:'🔊 Tłumacz i Czytaj',       sos:'🆘 WOŁAJ POMOCY',            lock:'Zablokuj języki',        translating:'Tłumaczenie...',     listening:'Słucham...',      ph:'Wpisz tutaj...',        hello:'Dzień dobry',  thanks:'Dziękuję',      wait:'Proszę czekać',  dunno:'Nie rozumiem',     help:'Pomocy',        stop:'Stop',    speakHere:'Mów...' },
  nl:{ title:'IK HOOR',       recognize:'🎤 Luisteren',             write:'✏️ Schrijven',          translate:'🔊 Vertalen & Lezen',       sos:'🆘 ROEP HULP',               lock:'Talen vergrendelen',     translating:'Vertaling...',       listening:'Luisteren...',    ph:'Typ hier...',           hello:'Hallo',        thanks:'Dankjewel',     wait:'Even wachten',   dunno:'Begrijp niet',     help:'Help me',       stop:'Stop',    speakHere:'Spreek...' },
  sv:{ title:'JAG HÖR',       recognize:'🎤 Lyssna',                write:'✏️ Skriv',              translate:'🔊 Översätt & Läs',         sos:'🆘 BE OM HJÄLP',             lock:'Lås språk',              translating:'Översätter...',      listening:'Lyssnar...',      ph:'Skriv här...',          hello:'Hej',          thanks:'Tack',          wait:'Vänta',          dunno:'Förstår inte',     help:'Hjälp mig',     stop:'Stopp',   speakHere:'Tala...' },
  no:{ title:'JEG HØRER',     recognize:'🎤 Lytt',                  write:'✏️ Skriv',              translate:'🔊 Oversett & Les',         sos:'🆘 BE OM HJELP',             lock:'Lås språk',              translating:'Oversetter...',      listening:'Lytter...',       ph:'Skriv her...',          hello:'Hei',          thanks:'Takk',          wait:'Vent',           dunno:'Forstår ikke',     help:'Hjelp meg',     stop:'Stopp',   speakHere:'Snakk...' },
  da:{ title:'JEG HØRER',     recognize:'🎤 Lyt',                   write:'✏️ Skriv',              translate:'🔊 Oversæt & Læs',          sos:'🆘 BED OM HJÆLP',            lock:'Lås sprog',              translating:'Oversætter...',      listening:'Lytter...',       ph:'Skriv her...',          hello:'Hej',          thanks:'Tak',           wait:'Vent',           dunno:'Forstår ikke',     help:'Hjælp mig',     stop:'Stop',    speakHere:'Tal...' },
  fi:{ title:'KUULEN',        recognize:'🎤 Kuuntele',              write:'✏️ Kirjoita',           translate:'🔊 Käännä & Lue',           sos:'🆘 PYYDÄ APUA',              lock:'Lukitse kielet',         translating:'Käännetään...',      listening:'Kuuntelen...',    ph:'Kirjoita tähän...',     hello:'Hei',          thanks:'Kiitos',        wait:'Odota',          dunno:'En ymmärrä',       help:'Auta minua',    stop:'Lopeta',  speakHere:'Puhu...' },
  cs:{ title:'SLYŠÍM',        recognize:'🎤 Poslouchat',            write:'✏️ Psát',               translate:'🔊 Přeložit & Přečíst',     sos:'🆘 ZAVOLAT POMOC',           lock:'Uzamknout jazyky',       translating:'Překlad...',         listening:'Poslouchám...',   ph:'Pište zde...',          hello:'Dobrý den',    thanks:'Děkuji',        wait:'Počkejte',       dunno:'Nerozumím',        help:'Pomozte mi',    stop:'Stop',    speakHere:'Mluvte...' },
  ro:{ title:'AUD',           recognize:'🎤 Ascultă',               write:'✏️ Scrie',              translate:'🔊 Traduce & Citește',      sos:'🆘 CERE AJUTOR',             lock:'Blochează limbi',        translating:'Traducere...',       listening:'Ascult...',       ph:'Scrie aici...',         hello:'Bună ziua',    thanks:'Mulțumesc',     wait:'Așteptați',      dunno:'Nu înțeleg',       help:'Ajutați-mă',    stop:'Stop',    speakHere:'Vorbiți...' },
  hu:{ title:'HALLOM',        recognize:'🎤 Hallgat',               write:'✏️ Írni',               translate:'🔊 Fordítás & Felolvasás',  sos:'🆘 SEGÍTSÉG KÉRÉS',          lock:'Zárolj nyelveket',       translating:'Fordítás...',        listening:'Hallgatom...',    ph:'Írj ide...',            hello:'Jó napot',     thanks:'Köszönöm',      wait:'Várjon',         dunno:'Nem értem',        help:'Segítsen',      stop:'Állj',    speakHere:'Beszéljen...' },
  th:{ title:'ฉันได้ยิน',     recognize:'🎤 ฟัง',                  write:'✏️ เขียน',              translate:'🔊 แปลและอ่าน',             sos:'🆘 ขอความช่วยเหลือ',         lock:'ล็อคภาษา',               translating:'กำลังแปล...',       listening:'กำลังฟัง...',    ph:'พิมพ์ที่นี่...',       hello:'สวัสดี',       thanks:'ขอบคุณ',        wait:'รอสักครู่',      dunno:'ไม่เข้าใจ',        help:'ช่วยด้วย',      stop:'หยุด',    speakHere:'พูดได้เลย...' },
  vi:{ title:'TÔI NGHE',      recognize:'🎤 Nghe',                  write:'✏️ Viết',               translate:'🔊 Dịch & Đọc',             sos:'🆘 KÊU CỨU',                 lock:'Khóa ngôn ngữ',          translating:'Đang dịch...',       listening:'Đang nghe...',    ph:'Nhập tại đây...',       hello:'Xin chào',     thanks:'Cảm ơn',        wait:'Xin chờ',        dunno:'Không hiểu',       help:'Giúp tôi',      stop:'Dừng',    speakHere:'Hãy nói...' },
  id:{ title:'SAYA DENGAR',   recognize:'🎤 Dengarkan',             write:'✏️ Tulis',              translate:'🔊 Terjemahkan & Baca',     sos:'🆘 MINTA BANTUAN',           lock:'Kunci bahasa',           translating:'Menerjemahkan...',   listening:'Mendengarkan...',  ph:'Ketik di sini...',     hello:'Halo',         thanks:'Terima kasih',  wait:'Tunggu',         dunno:'Tidak mengerti',   help:'Tolong saya',   stop:'Berhenti', speakHere:'Bicaralah...' },
  el:{ title:'ΑΚΟΥΩ',         recognize:'🎤 Άκου',                  write:'✏️ Γράψε',              translate:'🔊 Μετάφρασε & Διάβασε',   sos:'🆘 ΖΗΤΗΣΕ ΒΟΗΘΕΙΑ',         lock:'Κλείδωσε γλώσσες',       translating:'Μετάφραση...',       listening:'Ακούω...',        ph:'Γράψε εδώ...',          hello:'Γεια σας',     thanks:'Ευχαριστώ',     wait:'Περιμένετε',     dunno:'Δεν καταλαβαίνω',  help:'Βοηθήστε με',   stop:'Στοπ',    speakHere:'Μιλήστε...' },
  bg:{ title:'ЧУВАМ',         recognize:'🎤 Слушай',                write:'✏️ Пиши',               translate:'🔊 Преведи и Прочети',      sos:'🆘 ИЗВИКАЙ ПОМОЩ',           lock:'Заключи езици',          translating:'Превод...',          listening:'Слушам...',       ph:'Пишете тук...',         hello:'Здравейте',    thanks:'Благодаря',     wait:'Изчакайте',      dunno:'Не разбирам',      help:'Помогнете ми',  stop:'Стоп',    speakHere:'Говорете...' },
  he:{ title:'אני שומע',      recognize:'🎤 הקשב',                  write:'✏️ כתוב',               translate:'🔊 תרגם וקרא',             sos:'🆘 בקש עזרה',                lock:'נעל שפות',               translating:'מתרגם...',           listening:'מקשיב...',        ph:'הקלד כאן...',           hello:'שלום',         thanks:'תודה',          wait:'המתן',           dunno:'לא מבין',          help:'עזור לי',       stop:'עצור',    speakHere:'דבר...' },
  fa:{ title:'می‌شنوم',       recognize:'🎤 گوش کن',               write:'✏️ بنویس',              translate:'🔊 ترجمه و بخوان',          sos:'🆘 درخواست کمک',             lock:'قفل زبان‌ها',            translating:'در حال ترجمه...',   listening:'گوش می‌دهم...', ph:'اینجا بنویس...',       hello:'سلام',         thanks:'ممنون',         wait:'صبر کنید',       dunno:'نمی‌فهمم',         help:'کمکم کنید',     stop:'بایست',   speakHere:'صحبت کنید...' },
};
function ui(lang: string, key: K): string { return UI[lang]?.[key] || UI['en']?.[key] || key; }

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
  pl:'Potrzebuję pomocy! Niepełnosprawność słuchowa i mowy. Proszę podejść!',
  uk:'Мені потрібна допомога! Порушення слуху та мови. Підійдіть, будь ласка!',
  nl:'Let op! Ik heb hulp nodig! Ik heb een gehoor- en spraakbeperking. Kom alstublieft naar mij toe!',
  sv:'OBS! Jag behöver hjälp! Jag har hörsel- och talhandikapp. Snälla kom till mig!',
  no:'OBS! Jeg trenger hjelp! Jeg har hørsel- og talehemming. Kom til meg!',
  da:'OBS! Jeg har brug for hjælp! Jeg har høre- og talehæmning. Kom venligst til mig!',
  fi:'Huomio! Tarvitsen apua! Minulla on kuulo- ja puherajoitus. Tule luokseni!',
  cs:'Pozor! Potřebuji pomoc! Mám sluchové a řečové postižení. Přijďte prosím ke mně!',
  ro:'Atenție! Am nevoie de ajutor! Am deficiențe de auz și vorbire. Veniți la mine!',
  hu:'Figyelem! Segítségre van szükségem! Hallásom és beszédem korlátozott. Kérem jöjjön hozzám!',
  th:'ความสนใจ! ฉันต้องการความช่วยเหลือ! ฉันมีความบกพร่องด้านการได้ยินและการพูด กรุณามาหาฉัน!',
  vi:'Chú ý! Tôi cần giúp đỡ! Tôi bị khiếm thính và khiếm khuyết về lời nói. Xin hãy đến với tôi!',
  id:'Perhatian! Saya butuh bantuan! Saya memiliki gangguan pendengaran dan bicara. Tolong datang ke saya!',
  el:'Προσοχή! Χρειάζομαι βοήθεια! Έχω ακουστική και ομιλητική αναπηρία. Παρακαλώ ελάτε κοντά μου!',
  bg:'Внимание! Имам нужда от помощ! Имам слухово и говорно увреждане. Моля, елате при мен!',
  he:'שימו לב! אני צריך עזרה! יש לי לקות שמיעה ודיבור. בואו אליי בבקשה!',
  fa:'توجه! به کمک نیاز دارم! من مشکل شنوایی و گفتاری دارم. لطفاً بیایید!',
};
function getSosMsg(lang: string): string { return SOS_MSG[lang]||SOS_MSG['en']; }

/* ═══════════ ПЕРЕВОД через /api/translate (OpenAI GPT-4o-mini) ═══════════ */
async function translateText(text: string, fromCode: string, toCode: string, apiBase = ''): Promise<string> {
  if (fromCode===toCode || !text.trim()) return text;
  try {
    const r = await fetch(`${apiBase}/api/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, from: fromCode, to: toCode }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`status ${r.status}`);
    const d = await r.json() as { translated?: string };
    return d.translated?.trim() || text;
  } catch { return text; }
}

/* ═══════════ TTS — Google профессиональный голос через прокси ═══════════ */
let currentAudio: HTMLAudioElement|null = null;

function speakViaProxy(text: string, ttsLang: string, apiBase: string) {
  if (!text.trim()) return;
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  const url = `${apiBase}/api/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(ttsLang)}`;
  const audio = new Audio(url);
  audio.crossOrigin = 'anonymous';
  currentAudio = audio;
  /* Web Audio усилитель: 2.5× громче стационарно */
  audio.addEventListener('canplay', ()=>{
    try {
      const ctx = new AudioContext();
      const src  = ctx.createMediaElementSource(audio);
      const gain = ctx.createGain();
      gain.gain.value = 2.5;
      src.connect(gain); gain.connect(ctx.destination);
    } catch {}
  }, { once: true });
  audio.play().catch(() => { speakWebSpeech(text, ttsLang); });
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
function LangPicker({ value, onChange, open, onOpen, isDark=true }: {
  value:string; onChange:(c:string)=>void; open:boolean; onOpen:(v:boolean)=>void; isDark?:boolean;
}) {
  const lang = getLang(value);
  const FF      = '"Montserrat",sans-serif';
  const btnBg   = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)';
  const btnBdr  = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.18)';
  const btnClr  = isDark ? '#e8e8f6'                : '#0d0d1a';
  const dropBg  = isDark ? '#0d0d1a'                : '#ffffff';
  const dropBdr = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.15)';
  const itemSel = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)';
  return (
    <div style={{ position:'relative', flex:1 }}>
      <motion.button whileTap={{ scale:0.97 }} onClick={()=>onOpen(!open)}
        style={{ width:'100%', padding:'9px 10px', borderRadius:10,
          background:btnBg, border:`1px solid ${btnBdr}`,
          color:btnClr, fontSize:12, fontWeight:700, cursor:'pointer',
          display:'flex', alignItems:'center', gap:5, fontFamily:FF }}>
        <span style={{ fontSize:16 }}>{lang.flag}</span>
        <span style={{ flex:1, textAlign:'left', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lang.name}</span>
        <span style={{ opacity:0.4, fontSize:9 }}>{open?'▲':'▼'}</span>
      </motion.button>
      <AnimatePresence>
        {open&&(
          <motion.div initial={{ opacity:0,y:-4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
            style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:60,
              background:dropBg, border:`1px solid ${dropBdr}`,
              borderRadius:10, maxHeight:200, overflowY:'auto', marginTop:3,
              boxShadow:'0 8px 32px rgba(0,0,0,0.25)' }}>
            {LANGUAGES.map(l=>(
              <motion.button key={l.code} whileTap={{ scale:0.98 }}
                onClick={()=>{ onChange(l.code); onOpen(false); }}
                style={{ width:'100%', padding:'8px 12px',
                  background:l.code===value?itemSel:'none',
                  border:'none', color:btnClr, fontSize:12, fontWeight:600, cursor:'pointer',
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

/* ═══════════ ПАПКИ ФРАЗ ═══════════ */
const PRESET_FOLDERS = [
  { id:'duty',      icon:'🗣',  label:'Дежурные',      phrases:['Здравствуйте','Спасибо','Пожалуйста','Подождите','Не понимаю','Помогите мне','До свидания','Повторите пожалуйста'] },
  { id:'street',    icon:'🌆',  label:'На улице',       phrases:['Где остановка?','Как пройти?','Вызовите скорую','Мне плохо','Я заблудился','Покажите на карте','Помогите найти адрес','Вызовите полицию'] },
  { id:'office',    icon:'🏢',  label:'В учреждении',   phrases:['Мне нужна помощь','Запишите меня','Я не слышу','Напишите пожалуйста','Повторите медленнее','Где приёмная?','Мне нужен переводчик','Дайте документ'] },
  { id:'shop',      icon:'🛒',  label:'В магазине',     phrases:['Где касса?','Сколько стоит?','Есть скидка?','Можно примерить?','Дайте чек','Оплата картой','Упакуйте пожалуйста','Нет сдачи'] },
  { id:'transport', icon:'🚌',  label:'В транспорте',   phrases:['До какой станции?','Скажите где выйти','Правильный маршрут?','Где пересадка?','Помогите с багажом','Где такси?','Вызовите такси','Следующая остановка'] },
  { id:'hospital',  icon:'🏥',  label:'В больнице',     phrases:['Мне больно здесь','Вызовите врача','Аллергия на...','Я принимаю лекарства','Где регистратура?','Запишите меня','Мне нужна помощь','Плохо себя чувствую'] },
  { id:'cafe',      icon:'☕',  label:'В кафе',         phrases:['Меню пожалуйста','Без глютена','Я вегетарианец','Аллергия на орехи','Счёт пожалуйста','Очень вкусно','Упакуйте с собой','Вода пожалуйста'] },
  { id:'hotel',     icon:'🏨',  label:'В отеле',        phrases:['Мой номер...','Ключ не работает','Нет горячей воды','Разбудите в...','Поздний выезд','Вызовите такси','Сдать ключ','Нужна помощь'] },
];

/* ═══════════ ГЛАВНЫЙ КОМПОНЕНТ ═══════════ */
interface Props { onBack:()=>void; accent:string; apiBase?:string; }
type SpeechAny = any;

export default function AccessibilityAssistant({ onBack, accent, apiBase='' }: Props) {
  const [myLang, setMyLang]       = useState(()=>{ try{ return localStorage.getItem('acc_myLang')||'ru'; }catch{ return 'ru'; } });
  const [theirLang, setTheirLang] = useState(()=>{ try{ return localStorage.getItem('acc_theirLang')||'en'; }catch{ return 'en'; } });
  const [locked, setLocked]       = useState(false);
  const [openL, setOpenL]         = useState(false);
  const [openR, setOpenR]         = useState(false);

  const [listening, setListening] = useState(false);
  const [interim, setInterim]     = useState('');

  const [inputText, setInputText]   = useState('');
  const [outputText, setOutputText] = useState('');
  const [translating, setTranslating] = useState(false);
  const [sosPending, setSosPending]   = useState(false);
  const [speaking, setSpeaking]       = useState(false); /* горит зелёная лампочка при TTS */

  type Message = { id:string; side:'mine'|'theirs'; original:string; translated:string; fromLang:string; toLang:string; ts:number; };
  const [messages, setMessages] = useState<Message[]>([]);

  const [activeFolder, setActiveFolder] = useState<string|null>(null);
  const [myPhrases, setMyPhrases]       = useState<string[]>(()=>{ try{ return JSON.parse(localStorage.getItem('acc_my_phrases')||'[]'); }catch{ return []; } });
  const [addingPhrase, setAddingPhrase] = useState(false);
  const [newPhraseText, setNewPhraseText] = useState('');
  const newPhraseRef = useRef<HTMLInputElement>(null);

  const [theme, setTheme] = useState<'dark'|'light'>(()=>{ try{ return (localStorage.getItem('acc_theme')||'dark') as 'dark'|'light'; }catch{ return 'dark'; } });
  const toggleTheme = () => setTheme(p=>{ const n=p==='dark'?'light':'dark'; try{ localStorage.setItem('acc_theme',n); }catch{} return n; });

  const recogRef       = useRef<SpeechAny>(null);
  const silenceRef     = useRef<ReturnType<typeof setTimeout>|null>(null);
  const activeRef      = useRef(false);
  const latestFinalRef = useRef('');
  const listenGenRef   = useRef(0); /* счётчик поколений — защищает от «зомби» onend */
  const inputRef     = useRef<HTMLTextAreaElement>(null);
  const voicesRef    = useRef<SpeechSynthesisVoice[]>([]);
  const dialogEndRef = useRef<HTMLDivElement>(null);

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
  useEffect(()=>{ try{ localStorage.setItem('acc_my_phrases', JSON.stringify(myPhrases)); }catch{} }, [myPhrases]);

  /* Перевод папок фраз при смене языка глухого */
  const folderCacheRef = useRef<Record<string, typeof PRESET_FOLDERS>>({ ru: PRESET_FOLDERS });
  const [localizedFolders, setLocalizedFolders] = useState(PRESET_FOLDERS);
  useEffect(()=>{
    if (myLang === 'ru') { setLocalizedFolders(PRESET_FOLDERS); return; }
    if (folderCacheRef.current[myLang]) { setLocalizedFolders(folderCacheRef.current[myLang]); return; }
    const texts: string[] = [];
    PRESET_FOLDERS.forEach(f => { texts.push(f.label); f.phrases.forEach(p => texts.push(p)); });
    translateText(texts.join('\n'), 'ru', myLang, apiBase).then(result => {
      const lines = result.split('\n');
      let idx = 0;
      const translated = PRESET_FOLDERS.map(f => ({
        ...f,
        label: lines[idx++]?.trim() || f.label,
        phrases: f.phrases.map(() => lines[idx++]?.trim() || ''),
      }));
      folderCacheRef.current[myLang] = translated;
      setLocalizedFolders(translated);
    });
  }, [myLang]);

  const saveNewPhrase = () => {
    const t = newPhraseText.trim();
    if (!t) return;
    setMyPhrases(p=>[...p, t]);
    setNewPhraseText('');
    setAddingPhrase(false);
  };
  const deleteMyPhrase = (idx: number) => setMyPhrases(p=>p.filter((_,i)=>i!==idx));
  const openFolder = (id: string) => setActiveFolder(prev=>prev===id ? null : id);

  const FF   = '"Montserrat",sans-serif';
  const isDark = theme === 'dark';
  const BG    = isDark ? '#09090f'              : '#f0f3fc';
  const CARD  = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
  const LINE  = isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.18)';
  const TEXT  = isDark ? '#e8e8f6'              : '#0d0d1a';
  const SUB   = isDark ? 'rgba(220,220,245,0.4)' : 'rgba(10,10,40,0.72)';
  const GHOST  = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const GHOST2 = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const HANDLE = isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)';
  const GREEN = isDark ? '#0ecb81'              : '#00a060';
  const RED   = isDark ? '#f6465d'              : '#d9182e';
  const HDRBG = isDark ? 'rgba(9,9,15,0.98)'   : 'rgba(240,243,252,0.98)';
  const DLGBG = isDark ? 'rgba(255,255,255,0.02)': 'rgba(0,0,0,0.02)';
  const SHEETBG=isDark ? 'rgba(14,14,22,0.97)' : 'rgba(236,240,255,0.98)';
  const THEIRSBUBBLE = isDark?'rgba(255,255,255,0.07)':'rgba(0,0,0,0.06)';
  const THEIRSTEXT   = isDark?TEXT:'#0d0d1a';
  const SCROLLCLR    = isDark?'rgba(255,255,255,0.08) transparent':'rgba(0,0,0,0.1) transparent';

  const t = (k:K) => ui(myLang, k);

  const reset = () => {
    setInterim('');
    setInputText(''); setOutputText('');
  };
  const swapLangs = () => {
    if (locked) return;
    setMyLang(theirLang); setTheirLang(myLang); reset();
  };

  /* Автоскролл диалога при новых сообщениях */
  useEffect(()=>{ dialogEndRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);


  /* Говорим — бэкенд-прокси Google TTS, fallback Web Speech + зелёная лампочка */
  const speakText = useCallback((text: string, langCode: string) => {
    if (!text.trim()) return;
    const ttsLang = getLang(langCode).tts;
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    setSpeaking(true);
    const url = `${apiBase}/api/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(ttsLang)}`;
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    currentAudio = audio;
    const done = () => { setSpeaking(false); if (currentAudio === audio) currentAudio = null; };
    audio.onended = done;
    audio.onerror = () => { done(); speakWebSpeech(text, ttsLang, voicesRef.current); };
    /* Web Audio усилитель: 2.5× громче стационарно */
    audio.addEventListener('canplay', ()=>{
      try {
        const ctx  = new AudioContext();
        const src  = ctx.createMediaElementSource(audio);
        const gain = ctx.createGain();
        gain.gain.value = 2.5;
        src.connect(gain); gain.connect(ctx.destination);
      } catch {}
    }, { once: true });
    audio.play().catch(() => { done(); speakWebSpeech(text, ttsLang, voicesRef.current); });
  }, [apiBase]);

  const stopAll = useCallback(()=>{
    listenGenRef.current++;          /* инвалидируем все «зомби» onend предыдущего поколения */
    activeRef.current = false;
    if (recogRef.current) { try { recogRef.current.abort(); } catch {} recogRef.current = null; }
    if (silenceRef.current) { clearTimeout(silenceRef.current); silenceRef.current = null; }
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    setListening(false); setInterim(''); setSpeaking(false);
  }, []);

  const startListening = useCallback(()=>{
    const SR = (window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if (!SR) { alert('Используйте Chrome для распознавания речи'); return; }

    stopAll();
    setInterim('');
    latestFinalRef.current = '';
    activeRef.current = true;
    setListening(true);

    const fromL = theirLang, toL = myLang;
    const gen = ++listenGenRef.current; /* поколение сеанса — защита от зомби-onend */

    /* Одна фраза = одна сессия (continuous:false — надёжнее на мобильных).
       После каждого onend немедленно перезапускается.
       Только нажатие «Стоп» (activeRef=false + инкремент gen) останавливает цикл. */
    const runSession = () => {
      if (!activeRef.current || listenGenRef.current !== gen) return;

      const r = new SR() as SpeechAny;
      recogRef.current = r;
      r.lang            = getLang(fromL).tts;
      r.interimResults  = true;
      r.continuous      = false;
      r.maxAlternatives = 1;

      r.onresult = (e: any) => {
        if (listenGenRef.current !== gen) return;
        let fin = '', tmp = '';
        for (let i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) fin += e.results[i][0].transcript;
          else tmp += e.results[i][0].transcript;
        }
        if (tmp) setInterim(tmp);
        if (fin) { latestFinalRef.current = fin.trim(); setInterim(''); }
      };

      r.onerror = () => { /* игнорируем — onend всё равно придёт и перезапустит */ };

      r.onend = () => {
        if (listenGenRef.current !== gen) return; /* зомби — игнорируем */
        recogRef.current = null;
        const text = latestFinalRef.current;
        latestFinalRef.current = '';
        setInterim('');

        if (text) {
          translateText(text, fromL, toL, apiBase).then(translated => {
            if (!translated.trim()) return;
            setMessages(prev => [...prev, {
              id: `${Date.now()}${Math.random()}`, side: 'theirs',
              original: text, translated,
              fromLang: fromL, toLang: toL, ts: Date.now(),
            }]);
          });
        }

        if (activeRef.current && listenGenRef.current === gen) setTimeout(runSession, 80);
        else setListening(false);
      };

      try {
        r.start();
      } catch (_) {
        recogRef.current = null;
        if (activeRef.current && listenGenRef.current === gen) setTimeout(runSession, 300);
      }
    };

    runSession();
  }, [theirLang, myLang, stopAll, apiBase]);


  /* ГЛАВНАЯ КНОПКА: перевести + озвучить → добавляем в диалог */
  const handleTranslateAndSpeak = useCallback(async()=>{
    if (!inputText.trim()) return;
    const orig = inputText.trim();
    setTranslating(true);
    const tr = await translateText(orig, myLang, theirLang, apiBase);
    setTranslating(false);
    speakText(tr, theirLang);
    setMessages(prev=>[...prev, { id:Date.now()+'', side:'mine', original:orig, translated:tr, fromLang:myLang, toLang:theirLang, ts:Date.now() }]);
    setInputText(''); setOutputText('');
  }, [inputText, myLang, theirLang, speakText]);

  /* БЫСТРЫЕ ФРАЗЫ → тоже в диалог */
  const quickPhrase = useCallback(async(phrase:string)=>{
    setTranslating(true);
    const tr = await translateText(phrase, myLang, theirLang, apiBase);
    setTranslating(false);
    speakText(tr, theirLang);
    setMessages(prev=>[...prev, { id:Date.now()+'', side:'mine', original:phrase, translated:tr, fromLang:myLang, toLang:theirLang, ts:Date.now() }]);
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

  return (
    <div style={{ position:'fixed', inset:0, background:BG, color:TEXT, fontFamily:FF,
      display:'flex', flexDirection:'column', zIndex:300, overflow:'hidden' }}
      onClick={()=>{ setOpenL(false); setOpenR(false); }}>

      {/* ХЕДЕР */}
      <div style={{ padding:'46px 14px 10px', display:'flex', alignItems:'center', gap:10,
        borderBottom:`1px solid ${LINE}`, background:HDRBG,
        backdropFilter:'blur(20px)', flexShrink:0 }}>
        <motion.button whileTap={{ scale:0.88 }} onClick={()=>{ stopAll(); onBack(); }}
          style={{ width:34, height:34, borderRadius:'50%', background:CARD,
            border:`1px solid ${LINE}`, color:TEXT, fontSize:15, cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          ←
        </motion.button>
        <div style={{ fontSize:16, fontWeight:900, letterSpacing:'0.05em', flex:1, color:TEXT }}>👁 {t('title')}</div>
        {/* Переключатель темы */}
        <motion.button whileTap={{ scale:0.88 }} onClick={e=>{ e.stopPropagation(); toggleTheme(); }}
          title={isDark?'Светлая тема':'Тёмная тема'}
          style={{ width:36, height:36, borderRadius:10, background:CARD, border:`1px solid ${LINE}`,
            color:TEXT, fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {isDark ? '☀️' : '🌙'}
        </motion.button>

        {/* Зелёная лампочка: идёт распознавание речи */}
        {listening&&(
          <motion.div animate={{ opacity:[1,0.2,1] }} transition={{ repeat:Infinity, duration:0.8 }}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 9px',
              borderRadius:20, background:'rgba(14,203,129,0.12)', border:'1px solid rgba(14,203,129,0.35)',
              fontSize:10, color:GREEN, fontWeight:800 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:GREEN,
              boxShadow:`0 0 6px ${GREEN}` }}/>
            {t('listening')}
          </motion.div>
        )}

        {/* Зелёная лампочка: играет озвучка */}
        {speaking&&!listening&&(
          <motion.div animate={{ opacity:[1,0.2,1] }} transition={{ repeat:Infinity, duration:0.6 }}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 9px',
              borderRadius:20, background:'rgba(14,203,129,0.12)', border:'1px solid rgba(14,203,129,0.35)',
              fontSize:10, color:GREEN, fontWeight:800 }}>
            <div style={{ width:7, height:7, borderRadius:'50%', background:GREEN,
              boxShadow:`0 0 6px ${GREEN}` }}/>
            🔊
          </motion.div>
        )}
      </div>

      {/* ТЕЛО */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', gap:5, padding:'8px 10px 8px' }}
        onClick={e=>e.stopPropagation()}>

        {/* ВЫБОР ЯЗЫКОВ */}
        <div style={{ flexShrink:0, display:'flex', gap:6, alignItems:'center' }}>
          <div style={{ flex:1 }} onClick={e=>{ e.stopPropagation(); setOpenR(false); }}>
            <LangPicker value={myLang} open={openL} onOpen={setOpenL} isDark={isDark}
              onChange={v=>{ if(!locked){ setMyLang(v); reset(); } }}/>
          </div>
          <motion.button whileTap={{ scale:0.82 }} onClick={swapLangs}
            style={{ width:34, height:34, borderRadius:10,
              background:locked?GHOST:`${accent}15`,
              border:`1px solid ${locked?LINE:accent+'33'}`,
              color:locked?SUB:accent, fontSize:16, cursor:locked?'not-allowed':'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>⇄</motion.button>
          <div style={{ flex:1 }} onClick={e=>{ e.stopPropagation(); setOpenL(false); }}>
            <LangPicker value={theirLang} open={openR} onOpen={setOpenR} isDark={isDark}
              onChange={v=>{ if(!locked){ setTheirLang(v); reset(); } }}/>
          </div>
          <motion.button whileTap={{ scale:0.88 }} onClick={()=>setLocked(v=>!v)}
            style={{ width:34, height:34, borderRadius:10,
              background:locked?`${accent}18`:GHOST,
              border:`1px solid ${locked?accent+'44':LINE}`,
              color:locked?accent:SUB, fontSize:14, cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            {locked?'🔒':'🔓'}
          </motion.button>
        </div>

        {/* КНОПКИ РЕЖИМА */}
        <div style={{ flexShrink:0, display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
          <motion.button whileTap={{ scale:0.96 }}
            onClick={()=>{ if(listening){ stopAll(); } else { startListening(); } }}
            style={{ padding:'10px 8px', borderRadius:10, cursor:'pointer', fontFamily:FF,
              background:listening?`${RED}20`:`${GREEN}15`,
              border:`1.5px solid ${listening?RED+'55':GREEN+'44'}`,
              color:listening?RED:GREEN, fontSize:12, fontWeight:800 }}>
            {listening ? `⏹ ${t('stop')}` : t('recognize')}
          </motion.button>
          <motion.button whileTap={{ scale:0.96 }}
            onClick={()=>{ stopAll(); setTimeout(()=>inputRef.current?.focus(),80); }}
            style={{ padding:'10px 8px', borderRadius:10, cursor:'pointer', fontFamily:FF,
              background:`${accent}12`, border:`1.5px solid ${accent}33`,
              color:accent, fontSize:12, fontWeight:800 }}>
            {t('write')}
          </motion.button>
        </div>

        {/* ══ ЕДИНЫЙ ДИАЛОГ — занимает всё свободное место ══ */}
        <div style={{ flex:1, minHeight:0, borderRadius:12, border:`1px solid ${LINE}`,
          background:DLGBG, overflow:'hidden', display:'flex', flexDirection:'column' }}>

          {/* Шапка диалога */}
          <div style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'6px 10px', borderBottom:`1px solid ${LINE}`, background:DLGBG }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:9, color:SUB, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase' }}>{t('dialog')}</span>
              {listening && (
                <motion.span animate={{ opacity:[1,0.3,1] }} transition={{ repeat:Infinity, duration:0.7 }}
                  style={{ fontSize:9, color:GREEN, fontWeight:700 }}>
                  ● {interim || t('speakHere')}
                </motion.span>
              )}
              {translating && (
                <span style={{ fontSize:9, color:accent, fontWeight:700 }}>⏳ {t('translating')}</span>
              )}
            </div>
            {messages.length>0 && (
              <motion.button whileTap={{ scale:0.88 }}
                onClick={()=>setMessages([])}
                style={{ fontSize:9, color:SUB, background:'none', border:'none', cursor:'pointer',
                  padding:'2px 6px', borderRadius:6, fontFamily:FF }}>
                {t('clear')} ✕
              </motion.button>
            )}
          </div>

          {/* Сообщения */}
          <div style={{ flex:1, minHeight:0, overflowY:'auto', WebkitOverflowScrolling:'touch' as any,
            display:'flex', flexDirection:'column', gap:8, padding:'10px',
            scrollbarWidth:'thin' as any, scrollbarColor:SCROLLCLR }}>

            {messages.length===0 && !listening && (
              <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                gap:6, color:SUB, fontSize:11, fontStyle:'italic', opacity:0.5, textAlign:'center', lineHeight:1.7 }}>
                <span style={{ fontSize:28 }}>💬</span>
                <span>{myL.flag} {t('emptyHint')}</span>
              </div>
            )}

            <AnimatePresence initial={false}>
              {messages.map(msg=>{
                const isMine = msg.side==='mine';
                const fromL = getLang(msg.fromLang), toL = getLang(msg.toLang);
                const ts = new Date(msg.ts);
                const timeStr = ts.getHours().toString().padStart(2,'0')+':'+ts.getMinutes().toString().padStart(2,'0');
                return (
                  <motion.div key={msg.id}
                    initial={{ opacity:0, y:8, scale:0.97 }} animate={{ opacity:1, y:0, scale:1 }} transition={{ duration:0.2 }}
                    style={{ display:'flex', flexDirection:'column', alignItems:isMine?'flex-end':'flex-start' }}>
                    <div style={{ fontSize:9, color:SUB, fontWeight:700, marginBottom:3,
                      display:'flex', gap:4, alignItems:'center', flexDirection:isMine?'row-reverse':'row' }}>
                      <span>{fromL.flag}</span><span style={{ opacity:0.35 }}>→</span><span>{toL.flag}</span>
                      <span style={{ opacity:0.3 }}>{timeStr}</span>
                    </div>
                    <div style={{ maxWidth:'86%', borderRadius:isMine?'14px 14px 4px 14px':'14px 14px 14px 4px',
                      padding:'10px 13px',
                      background:isMine?`linear-gradient(135deg,${accent}55,${accent}33)`:THEIRSBUBBLE,
                      border:`1px solid ${isMine?accent+'66':LINE}`,
                      boxShadow:isDark?'none':'0 1px 4px rgba(0,0,0,0.08)' }}>
                      <div style={{ fontSize:15, fontWeight:800, color:isMine?( isDark?accent:'#fff'):THEIRSTEXT, lineHeight:1.5 }}>
                        {msg.translated}
                      </div>
                      {msg.original !== msg.translated && (
                        <div style={{ fontSize:13, color:SUB, fontStyle:'italic', marginTop:4, lineHeight:1.45 }}>
                          {fromL.flag} {msg.original}
                        </div>
                      )}
                    </div>
                    <motion.button whileTap={{ scale:0.85 }}
                      onClick={()=>speakText(msg.translated, msg.toLang)}
                      style={{ marginTop:3, width:24, height:24, borderRadius:'50%',
                        background:GHOST2, border:`1px solid ${LINE}`,
                        color:SUB, fontSize:11, cursor:'pointer',
                        display:'flex', alignItems:'center', justifyContent:'center' }}>🔊</motion.button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            <div ref={dialogEndRef}/>
          </div>
        </div>

        {/* ПОЛЕ ВВОДА */}
        <div style={{ flexShrink:0, borderRadius:12, border:`1px solid ${LINE}`, background:CARD, overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'flex-start' }}>
            <textarea ref={inputRef} value={inputText}
              onChange={e=>setInputText(e.target.value)}
              placeholder={t('ph')}
              style={{ flex:1, height:48, padding:'9px 11px', background:'transparent',
                border:'none', outline:'none', color:TEXT, fontSize:13, fontFamily:FF,
                resize:'none', lineHeight:1.5, boxSizing:'border-box' }}/>
            {inputText&&(
              <motion.button whileTap={{ scale:0.88 }} onClick={()=>setInputText('')}
                style={{ width:24, height:24, margin:'8px 8px 0 0', borderRadius:'50%',
                  background:'rgba(246,70,93,0.12)', border:'1px solid rgba(246,70,93,0.25)',
                  color:RED, fontSize:11, cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>✕</motion.button>
            )}
          </div>
        </div>

        {/* КНОПКА ПЕРЕВЕСТИ */}
        <motion.button whileTap={{ scale:0.97 }} onClick={handleTranslateAndSpeak}
          disabled={!inputText.trim()||translating}
          style={{ flexShrink:0, width:'100%', padding:'11px', borderRadius:12,
            cursor:inputText.trim()?'pointer':'not-allowed',
            background:inputText.trim()?`linear-gradient(135deg,${accent},${accent}bb)`:GHOST,
            border:`1.5px solid ${inputText.trim()?accent+'66':LINE}`,
            color:inputText.trim()?'#fff':SUB,
            fontSize:13, fontWeight:900, fontFamily:FF, letterSpacing:'0.02em',
            display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            boxShadow:inputText.trim()?`0 4px 20px ${accent}44`:'none', transition:'all 0.2s' }}>
          {translating ? `⏳ ${t('translating')}` : t('translate')}
        </motion.button>

        {/* ТАБЫ ПАПОК — горизонтальный скролл, «Мои фразы» первая */}
        <div style={{ flexShrink:0, display:'flex', gap:5, overflowX:'auto', padding:'1px 0', scrollbarWidth:'none' as any }}>
          <motion.button whileTap={{ scale:0.92 }} onClick={()=>openFolder('mine')}
            style={{ padding:'6px 10px', borderRadius:20, flexShrink:0, cursor:'pointer', fontFamily:FF,
              background:activeFolder==='mine'?`${accent}22`:GHOST,
              border:`1.5px solid ${activeFolder==='mine'?accent+'55':LINE}`,
              color:activeFolder==='mine'?accent:TEXT, fontSize:11, fontWeight:700,
              whiteSpace:'nowrap', transition:'all 0.15s' }}>
            {t('myPhrases')}
          </motion.button>
          {localizedFolders.map(folder=>(
            <motion.button key={folder.id} whileTap={{ scale:0.92 }} onClick={()=>openFolder(folder.id)}
              style={{ padding:'6px 10px', borderRadius:20, flexShrink:0, cursor:'pointer', fontFamily:FF,
                background:activeFolder===folder.id?`${accent}22`:GHOST,
                border:`1.5px solid ${activeFolder===folder.id?accent+'55':LINE}`,
                color:activeFolder===folder.id?accent:TEXT, fontSize:11, fontWeight:700,
                whiteSpace:'nowrap', transition:'all 0.15s' }}>
              {folder.icon} {folder.label}
            </motion.button>
          ))}
        </div>

        {/* SOS */}
        <motion.button whileTap={{ scale:0.97 }} onClick={handleSOS}
          animate={{ boxShadow: sosPending
            ? ['0 0 0px rgba(246,70,93,0)','0 0 28px rgba(246,70,93,0.9)','0 0 0px rgba(246,70,93,0)']
            : '0 4px 18px rgba(246,70,93,0.35)' }}
          transition={{ repeat:sosPending?Infinity:0, duration:0.55 }}
          style={{ flexShrink:0, width:'100%', padding:'13px', borderRadius:12, cursor:'pointer',
            background:`linear-gradient(135deg,${RED},#b01222)`,
            border:`2px solid ${RED}`, color:'#fff', fontSize:14, fontWeight:900, fontFamily:FF,
            letterSpacing:'0.03em', display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
          {t('sos')}
        </motion.button>

      </div>

      {/* ══ BOTTOM SHEET: выезжает снизу при выборе папки ══ */}
      <AnimatePresence>
        {activeFolder && (
          <>
            {/* Лёгкий фон — можно кликнуть чтобы закрыть */}
            <motion.div
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              onClick={()=>{ setActiveFolder(null); setAddingPhrase(false); }}
              style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.22)', zIndex:450 }}/>

            {/* Панель — компактная, ~45% высоты */}
            <motion.div
              initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
              transition={{ type:'spring', damping:32, stiffness:360 }}
              style={{ position:'absolute', bottom:0, left:0, right:0, maxHeight:'46%',
                background:SHEETBG, borderTop:`1px solid ${LINE}`,
                borderRadius:'16px 16px 0 0', display:'flex', flexDirection:'column', zIndex:460,
                boxShadow:`0 -6px 30px ${isDark?'rgba(0,0,0,0.55)':'rgba(0,0,0,0.15)'}`, backdropFilter:'blur(12px)' }}>

              {/* Ручка */}
              <div style={{ width:32, height:3, background:HANDLE, borderRadius:2, margin:'8px auto 0' }}/>

              {/* Табы — «Мои фразы» первая, потом папки */}
              <div style={{ flexShrink:0, display:'flex', gap:5, overflowX:'auto', padding:'8px 12px 6px', scrollbarWidth:'none' as any }}>
                <motion.button whileTap={{ scale:0.92 }}
                  onClick={()=>setActiveFolder('mine')}
                  style={{ padding:'4px 9px', borderRadius:20, flexShrink:0, cursor:'pointer', fontFamily:FF,
                    background:activeFolder==='mine'?`${accent}28`:GHOST2,
                    border:`1.5px solid ${activeFolder==='mine'?accent+'66':LINE}`,
                    color:activeFolder==='mine'?accent:SUB, fontSize:10, fontWeight:700,
                    whiteSpace:'nowrap', transition:'all 0.12s' }}>
                  {t('myPhrases')}
                </motion.button>
                {localizedFolders.map(folder=>(
                  <motion.button key={folder.id} whileTap={{ scale:0.92 }}
                    onClick={()=>setActiveFolder(folder.id)}
                    style={{ padding:'4px 9px', borderRadius:20, flexShrink:0, cursor:'pointer', fontFamily:FF,
                      background:activeFolder===folder.id?`${accent}28`:GHOST2,
                      border:`1.5px solid ${activeFolder===folder.id?accent+'66':LINE}`,
                      color:activeFolder===folder.id?accent:SUB, fontSize:10, fontWeight:700,
                      whiteSpace:'nowrap', transition:'all 0.12s' }}>
                    {folder.icon} {folder.label}
                  </motion.button>
                ))}
              </div>

              {/* Разделитель */}
              <div style={{ height:1, background:LINE, flexShrink:0 }}/>

              {/* Список фраз — компактный, вертикальный скролл */}
              <div style={{ flex:1, overflowY:'auto', padding:'6px 12px 16px', scrollbarWidth:'thin' as any, scrollbarColor:SCROLLCLR }}>
                <AnimatePresence mode="wait">
                  {activeFolder !== 'mine' && (
                    <motion.div key={activeFolder}
                      initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }}
                      transition={{ duration:0.14 }}
                      style={{ display:'flex', flexDirection:'column', gap:3 }}>
                      {(localizedFolders.find(f=>f.id===activeFolder)?.phrases||[]).map(phrase=>(
                        <motion.button key={phrase} whileTap={{ scale:0.97 }}
                          onClick={()=>{ quickPhrase(phrase); setActiveFolder(null); }}
                          style={{ width:'100%', padding:'9px 12px', borderRadius:10, cursor:'pointer',
                            background:GHOST, border:`1px solid ${LINE}`,
                            color:TEXT, fontSize:13, fontWeight:600, fontFamily:FF,
                            textAlign:'left', transition:'background 0.1s' }}>
                          {phrase}
                        </motion.button>
                      ))}
                    </motion.div>
                  )}

                  {activeFolder === 'mine' && (
                    <motion.div key="mine"
                      initial={{ opacity:0, x:20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-20 }}
                      transition={{ duration:0.14 }}
                      style={{ display:'flex', flexDirection:'column', gap:3 }}>
                      {myPhrases.length===0 && !addingPhrase && (
                        <div style={{ textAlign:'center', color:SUB, fontSize:11, fontStyle:'italic', padding:'14px 0' }}>
                          {t('noPhrases')}
                        </div>
                      )}
                      {myPhrases.map((phrase,idx)=>(
                        <div key={idx} style={{ display:'flex', gap:3, alignItems:'center' }}>
                          <motion.button whileTap={{ scale:0.97 }}
                            onClick={()=>{ quickPhrase(phrase); setActiveFolder(null); }}
                            style={{ flex:1, padding:'9px 12px', borderRadius:10, cursor:'pointer',
                              background:GHOST, border:`1px solid ${LINE}`,
                              color:TEXT, fontSize:13, fontWeight:600, fontFamily:FF, textAlign:'left' }}>
                            {phrase}
                          </motion.button>
                          <motion.button whileTap={{ scale:0.88 }} onClick={()=>deleteMyPhrase(idx)}
                            style={{ width:30, height:30, borderRadius:8, flexShrink:0, cursor:'pointer',
                              background:'rgba(246,70,93,0.08)', border:`1px solid rgba(246,70,93,0.2)`,
                              color:RED, fontSize:12, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</motion.button>
                        </div>
                      ))}
                      {addingPhrase ? (
                        <div style={{ display:'flex', gap:5, alignItems:'center', marginTop:3 }}>
                          <input ref={newPhraseRef} value={newPhraseText}
                            onChange={e=>setNewPhraseText(e.target.value)}
                            onKeyDown={e=>{ if(e.key==='Enter') saveNewPhrase(); if(e.key==='Escape'){ setAddingPhrase(false); setNewPhraseText(''); } }}
                            placeholder={t('writePhrase')}
                            style={{ flex:1, padding:'9px 11px', borderRadius:10, background:GHOST2,
                              border:`1px solid ${accent}55`, color:TEXT, fontSize:13, fontFamily:FF, outline:'none' }}
                            autoFocus/>
                          <motion.button whileTap={{ scale:0.9 }} onClick={saveNewPhrase}
                            style={{ padding:'9px 13px', borderRadius:10, background:`${accent}22`, border:`1px solid ${accent}44`, color:accent, fontSize:14, fontWeight:900, cursor:'pointer' }}>✓</motion.button>
                          <motion.button whileTap={{ scale:0.9 }} onClick={()=>{ setAddingPhrase(false); setNewPhraseText(''); }}
                            style={{ padding:'9px 10px', borderRadius:10, background:'rgba(246,70,93,0.08)', border:`1px solid ${RED}33`, color:RED, fontSize:13, cursor:'pointer' }}>✕</motion.button>
                        </div>
                      ) : (
                        <motion.button whileTap={{ scale:0.96 }}
                          onClick={()=>{ setAddingPhrase(true); setTimeout(()=>newPhraseRef.current?.focus(),80); }}
                          style={{ marginTop:3, width:'100%', padding:'9px', borderRadius:10, cursor:'pointer',
                            border:`1.5px dashed ${accent}40`, background:'transparent',
                            color:accent, fontSize:12, fontWeight:700, fontFamily:FF }}>
                          {t('addPhrase')}
                        </motion.button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </motion.div>
          </>
        )}
      </AnimatePresence>

    </div>
  );
}
