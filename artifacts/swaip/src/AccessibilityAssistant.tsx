import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ═══════════ ЯЗЫКИ ═══════════ */
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
type K = 'title'|'recognize'|'write'|'translate'|'sos'|'lock'|'translating'|'listening'|'ph'|'stop'|'speakHere'|'clearDialog'|'myFolder'|'addPhrase'|'phInput'|'emptyFolder';
const UI: Record<string, Record<K,string>> = {
  ru:{ title:'Я СЛЫШУ', recognize:'🎤 Слушать речь', write:'✏️ Написать', translate:'🔊 Перевести и озвучить', sos:'🆘 ПОДАТЬ СИГНАЛ О ПОМОЩИ', lock:'Зафиксировать языки', translating:'Перевод...', listening:'Слушаю...', ph:'Введите текст...', stop:'Стоп', speakHere:'Говорите — текст появится здесь...', clearDialog:'Очистить', myFolder:'📁 Моя папка', addPhrase:'+ Добавить фразу', phInput:'Введите фразу...', emptyFolder:'Пусто — нажмите + чтобы добавить' },
  en:{ title:'I HEAR', recognize:'🎤 Listen', write:'✏️ Write', translate:'🔊 Translate & Speak', sos:"🆘 CALL FOR HELP", lock:'Lock languages', translating:'Translating...', listening:'Listening...', ph:'Type here...', stop:'Stop', speakHere:'Speak — text appears here...', clearDialog:'Clear', myFolder:'📁 My folder', addPhrase:'+ Add phrase', phInput:'Enter phrase...', emptyFolder:'Empty — tap + to add' },
  de:{ title:'ICH HÖRE', recognize:'🎤 Zuhören', write:'✏️ Schreiben', translate:'🔊 Übersetzen', sos:'🆘 HILFERUF', lock:'Sperren', translating:'Übersetze...', listening:'Höre zu...', ph:'Eingeben...', stop:'Stop', speakHere:'Sprechen Sie...', clearDialog:'Löschen', myFolder:'📁 Mein Ordner', addPhrase:'+ Hinzufügen', phInput:'Phrase eingeben...', emptyFolder:'Leer — + drücken' },
  fr:{ title:"J'ENTENDS", recognize:'🎤 Écouter', write:'✏️ Écrire', translate:'🔊 Traduire', sos:"🆘 AIDE", lock:'Verrouiller', translating:'Traduction...', listening:"J'écoute...", ph:'Tapez ici...', stop:'Stop', speakHere:'Parlez...', clearDialog:'Effacer', myFolder:'📁 Mon dossier', addPhrase:'+ Ajouter', phInput:'Entrez la phrase...', emptyFolder:'Vide — appuyer +' },
  es:{ title:'YO ESCUCHO', recognize:'🎤 Escuchar', write:'✏️ Escribir', translate:'🔊 Traducir', sos:'🆘 AYUDA', lock:'Fijar', translating:'Traduciendo...', listening:'Escuchando...', ph:'Escribe...', stop:'Parar', speakHere:'Hable...', clearDialog:'Borrar', myFolder:'📁 Mi carpeta', addPhrase:'+ Agregar', phInput:'Escribir frase...', emptyFolder:'Vacío — toca +' },
  zh:{ title:'我听到了', recognize:'🎤 聆听', write:'✏️ 输入', translate:'🔊 翻译', sos:'🆘 求助', lock:'锁定', translating:'翻译中...', listening:'聆听中...', ph:'在此输入...', stop:'停止', speakHere:'请说话...', clearDialog:'清除', myFolder:'📁 我的文件夹', addPhrase:'+ 添加', phInput:'输入短语...', emptyFolder:'空 — 点+添加' },
  uk:{ title:'Я ЧУЮ', recognize:'🎤 Слухати', write:'✏️ Написати', translate:'🔊 Перекласти', sos:'🆘 ДОПОМОГА', lock:'Зафіксувати', translating:'Переклад...', listening:'Слухаю...', ph:'Введіть текст...', stop:'Стоп', speakHere:'Говоріть...', clearDialog:'Очистити', myFolder:'📁 Моя папка', addPhrase:'+ Додати фразу', phInput:'Введіть фразу...', emptyFolder:'Порожньо — натисніть +' },
  ja:{ title:'聴こえます', recognize:'🎤 聞く', write:'✏️ 書く', translate:'🔊 翻訳', sos:'🆘 助けを呼ぶ', lock:'固定', translating:'翻訳中...', listening:'聞いています...', ph:'入力...', stop:'止まれ', speakHere:'話してください...', clearDialog:'削除', myFolder:'📁 マイフォルダ', addPhrase:'+ 追加', phInput:'フレーズを入力...', emptyFolder:'空 — +を押す' },
  ko:{ title:'들립니다', recognize:'🎤 듣기', write:'✏️ 쓰기', translate:'🔊 번역', sos:'🆘 도움', lock:'고정', translating:'번역 중...', listening:'듣는 중...', ph:'여기에 입력...', stop:'정지', speakHere:'말씀하세요...', clearDialog:'삭제', myFolder:'📁 내 폴더', addPhrase:'+ 추가', phInput:'문구 입력...', emptyFolder:'비어 있음 — +를 누르세요' },
  ar:{ title:'أسمعك', recognize:'🎤 استمع', write:'✏️ اكتب', translate:'🔊 ترجم', sos:'🆘 مساعدة', lock:'تثبيت', translating:'جارٍ الترجمة...', listening:'أستمع...', ph:'اكتب هنا...', stop:'وقف', speakHere:'تحدث...', clearDialog:'مسح', myFolder:'📁 مجلدي', addPhrase:'+ إضافة', phInput:'أدخل عبارة...', emptyFolder:'فارغ — اضغط +' },
  pt:{ title:'EU OUÇO', recognize:'🎤 Ouvir', write:'✏️ Escrever', translate:'🔊 Traduzir', sos:'🆘 SOCORRO', lock:'Fixar', translating:'Traduzindo...', listening:'Ouvindo...', ph:'Digite...', stop:'Parar', speakHere:'Fale...', clearDialog:'Limpar', myFolder:'📁 Minha pasta', addPhrase:'+ Adicionar', phInput:'Digite frase...', emptyFolder:'Vazio — toque +' },
  it:{ title:'SENTO', recognize:'🎤 Ascolta', write:'✏️ Scrivi', translate:'🔊 Traduci', sos:'🆘 AIUTO', lock:'Blocca', translating:'Traduzione...', listening:'Ascolto...', ph:'Scrivi...', stop:'Stop', speakHere:'Parla...', clearDialog:'Cancella', myFolder:'📁 Mia cartella', addPhrase:'+ Aggiungi', phInput:'Inserisci frase...', emptyFolder:'Vuoto — premi +' },
  hi:{ title:'मैं सुनता हूँ', recognize:'🎤 सुनें', write:'✏️ लिखें', translate:'🔊 अनुवाद', sos:'🆘 सहायता', lock:'लॉक', translating:'अनुवाद...', listening:'सुन रहा हूँ...', ph:'यहाँ लिखें...', stop:'रोकें', speakHere:'बोलिए...', clearDialog:'हटाएं', myFolder:'📁 मेरा फ़ोल्डर', addPhrase:'+ जोड़ें', phInput:'वाक्यांश दर्ज करें...', emptyFolder:'खाली — + दबाएं' },
  tr:{ title:'DUYUYORUM', recognize:'🎤 Dinle', write:'✏️ Yaz', translate:'🔊 Çevir', sos:'🆘 YARDIM', lock:'Kilitle', translating:'Çevriliyor...', listening:'Dinliyorum...', ph:'Yaz...', stop:'Dur', speakHere:'Konuşun...', clearDialog:'Temizle', myFolder:'📁 Klasörüm', addPhrase:'+ Ekle', phInput:'İfade girin...', emptyFolder:'Boş — + bas' },
  pl:{ title:'SŁYSZĘ', recognize:'🎤 Słuchaj', write:'✏️ Pisz', translate:'🔊 Tłumacz', sos:'🆘 POMOCY', lock:'Zablokuj', translating:'Tłumaczenie...', listening:'Słucham...', ph:'Pisz...', stop:'Stop', speakHere:'Mów...', clearDialog:'Wyczyść', myFolder:'📁 Mój folder', addPhrase:'+ Dodaj', phInput:'Wpisz frazę...', emptyFolder:'Puste — dotknij +' },
  nl:{ title:'IK HOOR', recognize:'🎤 Luisteren', write:'✏️ Schrijven', translate:'🔊 Vertalen', sos:'🆘 HULP', lock:'Vergrendelen', translating:'Vertaling...', listening:'Luisteren...', ph:'Typ...', stop:'Stop', speakHere:'Spreek...', clearDialog:'Wissen', myFolder:'📁 Mijn map', addPhrase:'+ Toevoegen', phInput:'Frase invoeren...', emptyFolder:'Leeg — druk +' },
  sv:{ title:'JAG HÖR', recognize:'🎤 Lyssna', write:'✏️ Skriv', translate:'🔊 Översätt', sos:'🆘 HJÄLP', lock:'Lås', translating:'Översätter...', listening:'Lyssnar...', ph:'Skriv...', stop:'Stopp', speakHere:'Tala...', clearDialog:'Rensa', myFolder:'📁 Min mapp', addPhrase:'+ Lägg till', phInput:'Ange fras...', emptyFolder:'Tom — tryck +' },
  no:{ title:'JEG HØRER', recognize:'🎤 Lytt', write:'✏️ Skriv', translate:'🔊 Oversett', sos:'🆘 HJELP', lock:'Lås', translating:'Oversetter...', listening:'Lytter...', ph:'Skriv...', stop:'Stopp', speakHere:'Snakk...', clearDialog:'Slett', myFolder:'📁 Min mappe', addPhrase:'+ Legg til', phInput:'Skriv setning...', emptyFolder:'Tom — trykk +' },
  da:{ title:'JEG HØRER', recognize:'🎤 Lyt', write:'✏️ Skriv', translate:'🔊 Oversæt', sos:'🆘 HJÆLP', lock:'Lås', translating:'Oversætter...', listening:'Lytter...', ph:'Skriv...', stop:'Stop', speakHere:'Tal...', clearDialog:'Ryd', myFolder:'📁 Min mappe', addPhrase:'+ Tilføj', phInput:'Indtast sætning...', emptyFolder:'Tom — tryk +' },
  fi:{ title:'KUULEN', recognize:'🎤 Kuuntele', write:'✏️ Kirjoita', translate:'🔊 Käännä', sos:'🆘 APUA', lock:'Lukitse', translating:'Käännetään...', listening:'Kuuntelen...', ph:'Kirjoita...', stop:'Lopeta', speakHere:'Puhu...', clearDialog:'Tyhjennä', myFolder:'📁 Oma kansio', addPhrase:'+ Lisää', phInput:'Anna lause...', emptyFolder:'Tyhjä — paina +' },
  cs:{ title:'SLYŠÍM', recognize:'🎤 Poslouchat', write:'✏️ Psát', translate:'🔊 Přeložit', sos:'🆘 POMOC', lock:'Uzamknout', translating:'Překlad...', listening:'Poslouchám...', ph:'Pište...', stop:'Stop', speakHere:'Mluvte...', clearDialog:'Smazat', myFolder:'📁 Moje složka', addPhrase:'+ Přidat', phInput:'Zadejte frázi...', emptyFolder:'Prázdné — stiskněte +' },
  ro:{ title:'AUD', recognize:'🎤 Ascultă', write:'✏️ Scrie', translate:'🔊 Traduce', sos:'🆘 AJUTOR', lock:'Blochează', translating:'Traducere...', listening:'Ascult...', ph:'Scrie...', stop:'Stop', speakHere:'Vorbiți...', clearDialog:'Șterge', myFolder:'📁 Dosarul meu', addPhrase:'+ Adaugă', phInput:'Introduceți fraza...', emptyFolder:'Gol — apasă +' },
  hu:{ title:'HALLOM', recognize:'🎤 Hallgat', write:'✏️ Írni', translate:'🔊 Fordítás', sos:'🆘 SEGÍTSÉG', lock:'Zárolj', translating:'Fordítás...', listening:'Hallgatom...', ph:'Írj...', stop:'Állj', speakHere:'Beszéljen...', clearDialog:'Töröl', myFolder:'📁 Saját mappa', addPhrase:'+ Hozzáad', phInput:'Írjon mondatot...', emptyFolder:'Üres — nyomja +' },
  th:{ title:'ฉันได้ยิน', recognize:'🎤 ฟัง', write:'✏️ เขียน', translate:'🔊 แปล', sos:'🆘 ขอความช่วยเหลือ', lock:'ล็อค', translating:'กำลังแปล...', listening:'กำลังฟัง...', ph:'พิมพ์...', stop:'หยุด', speakHere:'พูดได้เลย...', clearDialog:'ล้าง', myFolder:'📁 โฟลเดอร์ของฉัน', addPhrase:'+ เพิ่ม', phInput:'ป้อนวลี...', emptyFolder:'ว่าง — กด +' },
  vi:{ title:'TÔI NGHE', recognize:'🎤 Nghe', write:'✏️ Viết', translate:'🔊 Dịch', sos:'🆘 CỨU', lock:'Khóa', translating:'Đang dịch...', listening:'Đang nghe...', ph:'Nhập...', stop:'Dừng', speakHere:'Hãy nói...', clearDialog:'Xóa', myFolder:'📁 Thư mục của tôi', addPhrase:'+ Thêm', phInput:'Nhập cụm từ...', emptyFolder:'Trống — nhấn +' },
  id:{ title:'SAYA DENGAR', recognize:'🎤 Dengarkan', write:'✏️ Tulis', translate:'🔊 Terjemahkan', sos:'🆘 BANTUAN', lock:'Kunci', translating:'Menerjemahkan...', listening:'Mendengarkan...', ph:'Ketik...', stop:'Berhenti', speakHere:'Bicaralah...', clearDialog:'Hapus', myFolder:'📁 Folder saya', addPhrase:'+ Tambah', phInput:'Masukkan frasa...', emptyFolder:'Kosong — tekan +' },
  el:{ title:'ΑΚΟΥΩ', recognize:'🎤 Άκου', write:'✏️ Γράψε', translate:'🔊 Μετάφρασε', sos:'🆘 ΒΟΗΘΕΙΑ', lock:'Κλείδωσε', translating:'Μετάφραση...', listening:'Ακούω...', ph:'Γράψε...', stop:'Στοπ', speakHere:'Μιλήστε...', clearDialog:'Διαγραφή', myFolder:'📁 Ο φάκελός μου', addPhrase:'+ Προσθήκη', phInput:'Εισάγετε φράση...', emptyFolder:'Κενό — πατήστε +' },
  bg:{ title:'ЧУВАМ', recognize:'🎤 Слушай', write:'✏️ Пиши', translate:'🔊 Преведи', sos:'🆘 ПОМОЩ', lock:'Заключи', translating:'Превод...', listening:'Слушам...', ph:'Пишете...', stop:'Стоп', speakHere:'Говорете...', clearDialog:'Изчисти', myFolder:'📁 Моята папка', addPhrase:'+ Добави', phInput:'Въведете фраза...', emptyFolder:'Празно — натиснете +' },
  he:{ title:'אני שומע', recognize:'🎤 הקשב', write:'✏️ כתוב', translate:'🔊 תרגם', sos:'🆘 עזרה', lock:'נעל', translating:'מתרגם...', listening:'מקשיב...', ph:'הקלד...', stop:'עצור', speakHere:'דבר...', clearDialog:'מחק', myFolder:'📁 התיקייה שלי', addPhrase:'+ הוסף', phInput:'הזן משפט...', emptyFolder:'ריק — לחץ +' },
  fa:{ title:'می‌شنوم', recognize:'🎤 گوش کن', write:'✏️ بنویس', translate:'🔊 ترجمه', sos:'🆘 کمک', lock:'قفل', translating:'در حال ترجمه...', listening:'گوش می‌دهم...', ph:'بنویس...', stop:'بایست', speakHere:'صحبت کنید...', clearDialog:'پاک', myFolder:'📁 پوشه من', addPhrase:'+ افزودن', phInput:'عبارت را وارد کنید...', emptyFolder:'خالی — + را بزنید' },
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

/* ═══════════ ПАПКИ ГОТОВЫХ ФРАЗ ═══════════ */
type PhraseFolder = { id: string; icon: string; label: string; phrases: string[] };

const PRESET_FOLDERS: PhraseFolder[] = [
  {
    id: 'basic', icon: '💬', label: 'Дежурные',
    phrases: ['Здравствуйте', 'Спасибо', 'Пожалуйста', 'Подождите', 'Не понимаю', 'Помогите мне', 'До свидания', 'Повторите'],
  },
  {
    id: 'street', icon: '🌳', label: 'На улице',
    phrases: ['Где туалет?', 'Я заблудился', 'Помогите мне найти', 'Вызовите скорую', 'Где ближайшая аптека?', 'Покажите на карте', 'Опасность!', 'Мне плохо'],
  },
  {
    id: 'office', icon: '🏢', label: 'В учреждении',
    phrases: ['Я глухой/глухая', 'Пишите, пожалуйста', 'Я не слышу', 'Мне нужен переводчик', 'Запишите это', 'Где здесь принимают?', 'Дайте талон', 'Сколько ждать?'],
  },
  {
    id: 'shop', icon: '🛒', label: 'В магазине',
    phrases: ['Сколько стоит?', 'Покажите мне', 'Дайте чек', 'Без сдачи', 'Есть скидка?', 'Где касса?', 'Упакуйте, пожалуйста', 'Хочу вернуть товар'],
  },
  {
    id: 'transport', icon: '🚌', label: 'В транспорте',
    phrases: ['Эта остановка?', 'Мне здесь выйти', 'До конечной?', 'Где здесь выход?', 'Помогите с багажом', 'Следующая остановка?', 'Я потерял билет'],
  },
  {
    id: 'hospital', icon: '🏥', label: 'В больнице',
    phrases: ['Мне плохо', 'Нужен врач', 'Где регистратура?', 'У меня аллергия', 'Запишите меня', 'Нужны обезболивающие', 'Потерял сознание', 'Скорую вызвали?'],
  },
  {
    id: 'cafe', icon: '☕', label: 'В кафе',
    phrases: ['Меню, пожалуйста', 'Счёт', 'Без аллергенов', 'Возьму с собой', 'Всё вкусно', 'Воды, пожалуйста', 'Не заказывал это', 'Есть вегетарианское?'],
  },
  {
    id: 'hotel', icon: '🏨', label: 'В отеле',
    phrases: ['Мой номер готов?', 'Ключ не работает', 'Уберите номер', 'Wi-Fi пароль?', 'Разбудите в 8 утра', 'Где лифт?', 'Выезд сегодня'],
  },
];

/* ═══════════ GOOGLE TRANSLATE ═══════════ */
async function translateText(text: string, fromCode: string, toCode: string): Promise<string> {
  if (fromCode===toCode || !text.trim()) return text;
  const sl = getLang(fromCode).gtrans;
  const tl = getLang(toCode).gtrans;
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(9000) });
    const d = await r.json();
    return (d[0] as any[])?.map((x:any)=>x[0]).join('') || text;
  } catch { return text; }
}

/* ═══════════ TTS ═══════════ */
let currentAudio: HTMLAudioElement|null = null;

function speakViaProxy(text: string, ttsLang: string, apiBase: string) {
  if (!text.trim()) return;
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  const audio = new Audio(`${apiBase}/api/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(ttsLang)}`);
  audio.volume = 1.0; currentAudio = audio;
  audio.play().catch(()=>speakWebSpeech(text,ttsLang));
}

function speakWebSpeech(text: string, ttsLang: string, voices: SpeechSynthesisVoice[] = []) {
  if (!('speechSynthesis' in window)||!text.trim()) return;
  const ss = window.speechSynthesis; ss.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang=ttsLang; utter.rate=0.88; utter.volume=1.0; utter.pitch=1.0;
  const prefix = ttsLang.split('-')[0];
  const vList = voices.length>0?voices:ss.getVoices();
  const match = vList.find(v=>v.lang===ttsLang&&!v.localService)||vList.find(v=>v.lang.startsWith(prefix)&&!v.localService)||vList.find(v=>v.lang===ttsLang)||vList.find(v=>v.lang.startsWith(prefix));
  if (match) utter.voice=match;
  if (ss.paused) ss.resume(); ss.speak(utter);
  setTimeout(()=>{ if(ss.paused) ss.resume(); },150);
}

/* ═══════════ BEEP ═══════════ */
function playBeep(ctx: AudioContext, freq: number, start: number, dur: number) {
  const osc=ctx.createOscillator(), gain=ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.frequency.value=freq; osc.type='square';
  gain.gain.setValueAtTime(0,start); gain.gain.linearRampToValueAtTime(0.7,start+0.02);
  gain.gain.setValueAtTime(0.7,start+dur-0.05); gain.gain.linearRampToValueAtTime(0,start+dur);
  osc.start(start); osc.stop(start+dur);
}

/* ═══════════ LANG PICKER ═══════════ */
function LangPicker({ value, onChange, open, onOpen }: {
  value:string; onChange:(c:string)=>void; open:boolean; onOpen:(v:boolean)=>void;
}) {
  const lang=getLang(value);
  const FF='"Montserrat",sans-serif';
  return (
    <div style={{ position:'relative',flex:1 }}>
      <motion.button whileTap={{ scale:0.97 }} onClick={()=>onOpen(!open)}
        style={{ width:'100%',padding:'9px 10px',borderRadius:10,
          background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.12)',
          color:'#e8e8f6',fontSize:12,fontWeight:700,cursor:'pointer',
          display:'flex',alignItems:'center',gap:5,fontFamily:FF }}>
        <span style={{ fontSize:16 }}>{lang.flag}</span>
        <span style={{ flex:1,textAlign:'left',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{lang.name}</span>
        <span style={{ opacity:0.4,fontSize:9 }}>{open?'▲':'▼'}</span>
      </motion.button>
      <AnimatePresence>
        {open&&(
          <motion.div initial={{ opacity:0,y:-4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
            style={{ position:'absolute',top:'100%',left:0,right:0,zIndex:60,
              background:'#0d0d1a',border:'1px solid rgba(255,255,255,0.12)',
              borderRadius:10,maxHeight:200,overflowY:'auto',marginTop:3,
              boxShadow:'0 8px 32px rgba(0,0,0,0.7)' }}>
            {LANGUAGES.map(l=>(
              <motion.button key={l.code} whileTap={{ scale:0.98 }}
                onClick={()=>{ onChange(l.code); onOpen(false); }}
                style={{ width:'100%',padding:'8px 12px',
                  background:l.code===value?'rgba(255,255,255,0.09)':'none',
                  border:'none',color:'#e8e8f6',fontSize:12,fontWeight:600,cursor:'pointer',
                  display:'flex',alignItems:'center',gap:7,textAlign:'left',fontFamily:FF }}>
                <span style={{ fontSize:14 }}>{l.flag}</span>
                <span style={{ flex:1 }}>{l.name}</span>
                {l.code===value&&<span style={{ color:'#22d367',fontSize:10 }}>✓</span>}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════ МАСШТАБ ═══════════ */
const SCALE_MIN=1.0, SCALE_MAX=2.0, SCALE_DEFAULT=1.0;
function clampScale(v:number){ return Math.min(SCALE_MAX,Math.max(SCALE_MIN,Math.round(v*20)/20)); }

/* ═══════════ ТИП СООБЩЕНИЯ ДИАЛОГА ═══════════ */
type DialogMessage = { id:string; side:'theirs'|'mine'; original:string; translated:string; fromLang:string; toLang:string; ts:number; };
function fmtTime(ts:number){ const d=new Date(ts); return d.getHours().toString().padStart(2,'0')+':'+d.getMinutes().toString().padStart(2,'0'); }

/* ═══════════ ГЛАВНЫЙ КОМПОНЕНТ ═══════════ */
interface Props { onBack:()=>void; accent:string; apiBase?:string; }
type SpeechAny = any;

export default function AccessibilityAssistant({ onBack, accent, apiBase='' }: Props) {
  const [myLang,setMyLang]       = useState(()=>{ try{ return localStorage.getItem('acc_myLang')||'ru'; }catch{ return 'ru'; } });
  const [theirLang,setTheirLang] = useState(()=>{ try{ return localStorage.getItem('acc_theirLang')||'en'; }catch{ return 'en'; } });
  const [locked,setLocked]       = useState(false);
  const [openL,setOpenL]         = useState(false);
  const [openR,setOpenR]         = useState(false);

  const [listening,setListening]       = useState(false);
  const [spokenText,setSpokenText]     = useState('');
  const [interim,setInterim]           = useState('');
  const [translSpoken,setTranslSpoken] = useState('');

  const [inputText,setInputText]     = useState('');
  const [outputText,setOutputText]   = useState('');
  const [translating,setTranslating] = useState(false);
  const [sosPending,setSosPending]   = useState(false);
  const [speaking,setSpeaking]       = useState(false);

  /* ── ДИАЛОГ ── */
  const [messages,setMessages] = useState<DialogMessage[]>(()=>{ try{ const s=localStorage.getItem('acc_dialog'); return s?JSON.parse(s):[]; }catch{ return []; } });
  const dialogEndRef = useRef<HTMLDivElement>(null);

  const addMessage = useCallback((msg:Omit<DialogMessage,'id'|'ts'>)=>{
    const newMsg:DialogMessage={ ...msg, id:Math.random().toString(36).slice(2), ts:Date.now() };
    setMessages(prev=>{ const u=[...prev,newMsg].slice(-200); try{ localStorage.setItem('acc_dialog',JSON.stringify(u)); }catch{} return u; });
  },[]);

  const clearDialog=useCallback(()=>{ setMessages([]); try{ localStorage.removeItem('acc_dialog'); }catch{} },[]);

  useEffect(()=>{ dialogEndRef.current?.scrollIntoView({ behavior:'smooth' }); },[messages]);

  /* Фиксируем распознанное когда listening → false */
  const prevListeningRef=useRef(false);
  useEffect(()=>{
    if(prevListeningRef.current&&!listening){
      const spoken=spokenText.trim(), transl=translSpoken.trim();
      if(spoken&&transl){ addMessage({ side:'theirs',original:spoken,translated:transl,fromLang:theirLang,toLang:myLang }); setSpokenText(''); setInterim(''); setTranslSpoken(''); }
    }
    prevListeningRef.current=listening;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[listening]);

  /* ── ПАПКИ ФРАЗ ── */
  const [activeFolder,setActiveFolder] = useState<string>('basic');
  const [myPhrases,setMyPhrases]       = useState<string[]>(()=>{ try{ const s=localStorage.getItem('acc_my_phrases'); return s?JSON.parse(s):[]; }catch{ return []; } });
  const [addingPhrase,setAddingPhrase] = useState(false);
  const [newPhraseText,setNewPhraseText] = useState('');
  const newPhraseRef = useRef<HTMLInputElement>(null);

  useEffect(()=>{ try{ localStorage.setItem('acc_my_phrases',JSON.stringify(myPhrases)); }catch{} },[myPhrases]);

  const saveNewPhrase=useCallback(()=>{
    const v=newPhraseText.trim();
    if(v){ setMyPhrases(p=>[...p,v]); }
    setNewPhraseText(''); setAddingPhrase(false);
  },[newPhraseText]);

  const deleteMyPhrase=useCallback((idx:number)=>{
    setMyPhrases(p=>p.filter((_,i)=>i!==idx));
  },[]);

  /* ── МАСШТАБ ── */
  const [scale,setScale]=useState<number>(()=>{ try{ const s=parseFloat(localStorage.getItem('acc_scale')||''); return isNaN(s)?SCALE_DEFAULT:clampScale(s); }catch{ return SCALE_DEFAULT; } });
  useEffect(()=>{ try{ localStorage.setItem('acc_scale',String(scale)); }catch{} },[scale]);

  /* ── PINCH-TO-ZOOM ── */
  const pinchRef=useRef<{ dist:number;baseScale:number }|null>(null);
  const handleTouchStart=useCallback((e:React.TouchEvent)=>{ if(e.touches.length===2){ const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY; pinchRef.current={ dist:Math.hypot(dx,dy),baseScale:scale }; } },[scale]);
  const handleTouchMove=useCallback((e:React.TouchEvent)=>{ if(e.touches.length===2&&pinchRef.current){ e.preventDefault(); const dx=e.touches[0].clientX-e.touches[1].clientX,dy=e.touches[0].clientY-e.touches[1].clientY; setScale(clampScale(pinchRef.current.baseScale*(Math.hypot(dx,dy)/pinchRef.current.dist))); } },[]);
  const handleTouchEnd=useCallback(()=>{ pinchRef.current=null; },[]);

  const recogRef=useRef<SpeechAny>(null), silenceRef=useRef<ReturnType<typeof setTimeout>|null>(null), translTimerRef=useRef<ReturnType<typeof setTimeout>|null>(null);
  const activeRef=useRef(false), accumRef=useRef(''), inputRef=useRef<HTMLTextAreaElement>(null), voicesRef=useRef<SpeechSynthesisVoice[]>([]);

  useEffect(()=>{
    if(!('speechSynthesis' in window)) return;
    const load=()=>{ const v=window.speechSynthesis.getVoices(); if(v.length>0) voicesRef.current=v; };
    load(); window.speechSynthesis.addEventListener('voiceschanged',load);
    return ()=>window.speechSynthesis.removeEventListener('voiceschanged',load);
  },[]);

  useEffect(()=>{ try{ localStorage.setItem('acc_myLang',myLang); }catch{} },[myLang]);
  useEffect(()=>{ try{ localStorage.setItem('acc_theirLang',theirLang); }catch{} },[theirLang]);

  const FF='\"Montserrat\",sans-serif', BG='#09090f', CARD='rgba(255,255,255,0.05)', LINE='rgba(255,255,255,0.09)', TEXT='#e8e8f6', SUB='rgba(220,220,245,0.4)', GREEN='#0ecb81', RED='#f6465d';
  const t=(k:K)=>ui(myLang,k);

  const reset=()=>{ setSpokenText(''); setInterim(''); setTranslSpoken(''); setInputText(''); setOutputText(''); };
  const swapLangs=()=>{ if(locked) return; setMyLang(theirLang); setTheirLang(myLang); reset(); };

  const speakText=useCallback((text:string,langCode:string)=>{
    if(!text.trim()) return;
    const ttsLang=getLang(langCode).tts;
    if(currentAudio){ currentAudio.pause(); currentAudio=null; }
    setSpeaking(true);
    const audio=new Audio(`${apiBase}/api/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(ttsLang)}`);
    audio.volume=1.0; currentAudio=audio;
    const done=()=>{ setSpeaking(false); if(currentAudio===audio) currentAudio=null; };
    audio.onended=done; audio.onerror=()=>{ done(); speakWebSpeech(text,ttsLang,voicesRef.current); };
    audio.play().catch(()=>{ done(); speakWebSpeech(text,ttsLang,voicesRef.current); });
  },[apiBase]);

  const stopAll=useCallback(()=>{
    activeRef.current=false;
    if(recogRef.current){ try{ recogRef.current.abort(); }catch{} recogRef.current=null; }
    if(silenceRef.current){ clearTimeout(silenceRef.current); silenceRef.current=null; }
    if(translTimerRef.current){ clearTimeout(translTimerRef.current); translTimerRef.current=null; }
    if(currentAudio){ currentAudio.pause(); currentAudio=null; }
    if('speechSynthesis' in window) window.speechSynthesis.cancel();
    setListening(false); setInterim(''); setSpeaking(false);
  },[]);

  const startListening=useCallback(()=>{
    const SR=(window as any).SpeechRecognition||(window as any).webkitSpeechRecognition;
    if(!SR){ alert('Используйте Chrome для распознавания речи'); return; }
    stopAll(); setSpokenText(''); setInterim(''); setTranslSpoken('');
    accumRef.current=''; activeRef.current=true; setListening(true);
    const runSession=()=>{
      if(!activeRef.current) return;
      const r=new SR() as SpeechAny; recogRef.current=r;
      r.lang=getLang(theirLang).tts; r.interimResults=true; r.continuous=false; r.maxAlternatives=1;
      r.onresult=(e:any)=>{
        if(!activeRef.current) return;
        let fin='',tmp='';
        for(let i=0;i<e.results.length;i++){ if(e.results[i].isFinal) fin+=e.results[i][0].transcript; else tmp+=e.results[i][0].transcript; }
        if(tmp) setInterim(tmp);
        if(fin){ const trimmed=fin.trim(); accumRef.current=accumRef.current?accumRef.current+' '+trimmed:trimmed; setSpokenText(accumRef.current); setInterim('');
          if(silenceRef.current) clearTimeout(silenceRef.current);
          silenceRef.current=setTimeout(()=>{ activeRef.current=false; if(recogRef.current){ try{ recogRef.current.abort(); }catch{} recogRef.current=null; } setListening(false); },3000);
        }
      };
      r.onerror=(e:any)=>{ setInterim(''); if(activeRef.current&&(e.error==='no-speech'||e.error==='aborted')) setTimeout(runSession,100); else{ activeRef.current=false; setListening(false); } };
      r.onend=()=>{ setInterim(''); recogRef.current=null; if(activeRef.current) setTimeout(runSession,80); else setListening(false); };
      try{ r.start(); }catch(_){}
    };
    runSession();
  },[theirLang,stopAll]);

  useEffect(()=>{
    if(!spokenText.trim()) return;
    if(translTimerRef.current) clearTimeout(translTimerRef.current);
    translTimerRef.current=setTimeout(()=>{ translateText(spokenText,theirLang,myLang).then(setTranslSpoken); },450);
    return ()=>{ if(translTimerRef.current) clearTimeout(translTimerRef.current); };
  },[spokenText,theirLang,myLang]);

  const handleTranslateAndSpeak=useCallback(async()=>{
    if(!inputText.trim()) return;
    const text=inputText.trim();
    setTranslating(true);
    const tr=await translateText(text,myLang,theirLang);
    setOutputText(tr); setTranslating(false); speakText(tr,theirLang);
    addMessage({ side:'mine',original:text,translated:tr,fromLang:myLang,toLang:theirLang });
    setInputText(''); setOutputText('');
  },[inputText,myLang,theirLang,speakText,addMessage]);

  const handlePhraseClick=useCallback(async(phrase:string)=>{
    setTranslating(true);
    const tr=await translateText(phrase,myLang,theirLang);
    setTranslating(false); speakText(tr,theirLang);
    addMessage({ side:'mine',original:phrase,translated:tr,fromLang:myLang,toLang:theirLang });
  },[myLang,theirLang,speakText,addMessage]);

  const handleSOS=useCallback(()=>{
    if(sosPending) return; setSosPending(true);
    const sosText=getSosMsg(theirLang), ttsLang=getLang(theirLang).tts;
    try{ const ctx=new AudioContext(); [0,0.7,1.4].forEach(t=>{ playBeep(ctx,880,ctx.currentTime+t,0.5); playBeep(ctx,1320,ctx.currentTime+t+0.15,0.35); }); setTimeout(()=>speakViaProxy(sosText,ttsLang,apiBase),2300); }
    catch{ speakViaProxy(sosText,ttsLang,apiBase); }
    setTimeout(()=>setSosPending(false),7000);
  },[theirLang,sosPending,apiBase]);

  const myL=getLang(myLang), theirL=getLang(theirLang);
  const scalePercent=Math.round(scale*100);

  /* Папка для отображения */
  const isMineFolder = activeFolder === 'mine';
  const activeFolderData = PRESET_FOLDERS.find(f=>f.id===activeFolder);

  return (
    <div
      style={{ position:'fixed',inset:0,background:BG,color:TEXT,fontFamily:FF,
        display:'flex',flexDirection:'column',zIndex:300,overflow:'hidden' }}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
      onClick={()=>{ setOpenL(false); setOpenR(false); }}
    >
      {/* ── МАСШТАБИРУЕМАЯ ОБЛАСТЬ ── */}
      <div style={{ flex:1,overflow:'hidden',position:'relative' }}>
        <div style={{ position:'absolute',top:0,left:0,
          width:`${(100/scale).toFixed(4)}%`, height:`${(100/scale).toFixed(4)}%`,
          transform:`scale(${scale})`, transformOrigin:'top left',
          display:'flex', flexDirection:'column' }}>

          {/* ХЕДЕР */}
          <div style={{ padding:'46px 14px 10px',display:'flex',alignItems:'center',gap:10,
            borderBottom:`1px solid ${LINE}`,background:'rgba(9,9,15,0.98)',backdropFilter:'blur(20px)',flexShrink:0 }}>
            <motion.button whileTap={{ scale:0.88 }} onClick={()=>{ stopAll(); onBack(); }}
              style={{ width:34,height:34,borderRadius:'50%',background:'rgba(255,255,255,0.07)',
                border:`1px solid ${LINE}`,color:TEXT,fontSize:15,cursor:'pointer',
                display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>←</motion.button>
            <div style={{ fontSize:16,fontWeight:900,letterSpacing:'0.05em',flex:1 }}>👁 {t('title')}</div>
            {listening&&(
              <motion.div animate={{ opacity:[1,0.2,1] }} transition={{ repeat:Infinity,duration:0.8 }}
                style={{ display:'flex',alignItems:'center',gap:5,padding:'4px 9px',
                  borderRadius:20,background:'rgba(14,203,129,0.12)',border:'1px solid rgba(14,203,129,0.35)',
                  fontSize:10,color:GREEN,fontWeight:800 }}>
                <div style={{ width:7,height:7,borderRadius:'50%',background:GREEN,boxShadow:`0 0 6px ${GREEN}` }}/>{t('listening')}
              </motion.div>
            )}
            {speaking&&!listening&&(
              <motion.div animate={{ opacity:[1,0.2,1] }} transition={{ repeat:Infinity,duration:0.6 }}
                style={{ display:'flex',alignItems:'center',gap:5,padding:'4px 9px',
                  borderRadius:20,background:'rgba(14,203,129,0.12)',border:'1px solid rgba(14,203,129,0.35)',
                  fontSize:10,color:GREEN,fontWeight:800 }}>
                <div style={{ width:7,height:7,borderRadius:'50%',background:GREEN,boxShadow:`0 0 6px ${GREEN}` }}/>🔊
              </motion.div>
            )}
          </div>

          {/* ТЕЛО */}
          <div style={{ flex:1,overflowY:'auto',WebkitOverflowScrolling:'touch' as any,padding:'10px 12px 16px' }}
            onClick={e=>e.stopPropagation()}>

            {/* ВЫБОР ЯЗЫКОВ */}
            <div style={{ display:'flex',gap:6,alignItems:'center',marginBottom:6 }}>
              <div style={{ flex:1 }} onClick={e=>{ e.stopPropagation(); setOpenR(false); }}>
                <LangPicker value={myLang} open={openL} onOpen={setOpenL} onChange={v=>{ if(!locked){ setMyLang(v); reset(); } }}/>
              </div>
              <motion.button whileTap={{ scale:0.82 }} onClick={swapLangs}
                style={{ width:34,height:34,borderRadius:10,
                  background:locked?'rgba(255,255,255,0.03)':`${accent}15`,
                  border:`1px solid ${locked?LINE:accent+'33'}`,
                  color:locked?SUB:accent,fontSize:16,cursor:locked?'not-allowed':'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>⇄</motion.button>
              <div style={{ flex:1 }} onClick={e=>{ e.stopPropagation(); setOpenL(false); }}>
                <LangPicker value={theirLang} open={openR} onOpen={setOpenR} onChange={v=>{ if(!locked){ setTheirLang(v); reset(); } }}/>
              </div>
              <motion.button whileTap={{ scale:0.88 }} onClick={()=>setLocked(v=>!v)}
                style={{ width:34,height:34,borderRadius:10,
                  background:locked?`${accent}18`:'rgba(255,255,255,0.04)',
                  border:`1px solid ${locked?accent+'44':LINE}`,
                  color:locked?accent:SUB,fontSize:14,cursor:'pointer',
                  display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                {locked?'🔒':'🔓'}
              </motion.button>
            </div>

            {/* КНОПКИ РЕЖИМА */}
            <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:8 }}>
              <motion.button whileTap={{ scale:0.96 }}
                onClick={()=>{ if(listening){ stopAll(); } else { startListening(); } }}
                style={{ padding:'11px 8px',borderRadius:10,cursor:'pointer',fontFamily:FF,
                  background:listening?`${RED}20`:`${GREEN}15`,
                  border:`1.5px solid ${listening?RED+'55':GREEN+'44'}`,
                  color:listening?RED:GREEN,fontSize:12,fontWeight:800 }}>
                {listening?`⏹ ${t('stop')}`:t('recognize')}
              </motion.button>
              <motion.button whileTap={{ scale:0.96 }}
                onClick={()=>{ stopAll(); setTimeout(()=>inputRef.current?.focus(),80); }}
                style={{ padding:'11px 8px',borderRadius:10,cursor:'pointer',fontFamily:FF,
                  background:`${accent}12`,border:`1.5px solid ${accent}33`,color:accent,fontSize:12,fontWeight:800 }}>
                {t('write')}
              </motion.button>
            </div>

            {/* ══ ЛЕНТА ДИАЛОГА ══ */}
            {messages.length>0&&(
              <div style={{ marginBottom:8 }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:6 }}>
                  <span style={{ fontSize:9,color:SUB,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase' }}>💬 Диалог</span>
                  <motion.button whileTap={{ scale:0.88 }} onClick={clearDialog}
                    style={{ fontSize:9,color:SUB,background:'none',border:'none',cursor:'pointer',padding:'2px 6px',borderRadius:6,fontFamily:FF }}>
                    {t('clearDialog')} ✕
                  </motion.button>
                </div>
                <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                  <AnimatePresence initial={false}>
                    {messages.map(msg=>{
                      const isMine=msg.side==='mine';
                      const fromL=getLang(msg.fromLang), toL=getLang(msg.toLang);
                      return (
                        <motion.div key={msg.id}
                          initial={{ opacity:0,y:10,scale:0.95 }} animate={{ opacity:1,y:0,scale:1 }} transition={{ duration:0.22 }}
                          style={{ display:'flex',flexDirection:'column',alignItems:isMine?'flex-end':'flex-start' }}>
                          <div style={{ display:'flex',alignItems:'center',gap:4,marginBottom:3,fontSize:9,color:SUB,fontWeight:700,flexDirection:isMine?'row-reverse':'row' }}>
                            <span>{fromL.flag} {fromL.name}</span><span style={{ opacity:0.35 }}>→</span><span>{toL.flag} {toL.name}</span>
                            <span style={{ opacity:0.3,marginLeft:4 }}>{fmtTime(msg.ts)}</span>
                          </div>
                          <div style={{ maxWidth:'82%',borderRadius:isMine?'14px 14px 4px 14px':'14px 14px 14px 4px',padding:'9px 12px',
                            background:isMine?`linear-gradient(135deg,${accent}33,${accent}1a)`:'rgba(255,255,255,0.06)',
                            border:`1px solid ${isMine?accent+'44':LINE}` }}>
                            <div style={{ fontSize:14,fontWeight:800,color:isMine?accent:TEXT,lineHeight:1.5,marginBottom:4 }}>{msg.translated}</div>
                            {msg.original!==msg.translated&&(
                              <div style={{ fontSize:10,color:SUB,fontStyle:'italic',lineHeight:1.4 }}>{fromL.flag} {msg.original}</div>
                            )}
                          </div>
                          <motion.button whileTap={{ scale:0.85 }} onClick={()=>speakText(msg.translated,msg.toLang)}
                            style={{ marginTop:3,width:24,height:24,borderRadius:'50%',background:'rgba(255,255,255,0.05)',border:`1px solid ${LINE}`,color:SUB,fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>🔊</motion.button>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  <div ref={dialogEndRef}/>
                </div>
              </div>
            )}

            {/* ЖИВОЙ БЛОК СЛУШАЮ */}
            {(interim||(listening&&!spokenText))&&(
              <div style={{ borderRadius:12,border:`1px solid ${LINE}`,background:CARD,marginBottom:8,padding:'10px 12px' }}>
                <div style={{ fontSize:9,color:SUB,fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:6 }}>
                  {theirL.flag} {theirL.name} → {myL.flag} {myL.name}
                </div>
                <div style={{ fontSize:13,color:SUB,fontStyle:'italic',lineHeight:1.6 }}>{interim||t('speakHere')}</div>
              </div>
            )}
            {spokenText&&!interim&&(
              <div style={{ borderRadius:12,border:'1px solid rgba(14,203,129,0.25)',background:'rgba(14,203,129,0.05)',marginBottom:8,padding:'10px 12px' }}>
                <div style={{ fontSize:9,color:SUB,fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',marginBottom:6 }}>{theirL.flag} {theirL.name}</div>
                {translSpoken?(
                  <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:16,fontWeight:900,color:GREEN,lineHeight:1.5 }}>{translSpoken}</div>
                      {theirLang!==myLang&&<div style={{ fontSize:10,color:SUB,marginTop:3,fontStyle:'italic' }}>{theirL.flag} {spokenText}</div>}
                    </div>
                    <motion.button whileTap={{ scale:0.88 }} onClick={()=>speakText(translSpoken,myLang)}
                      style={{ width:32,height:32,borderRadius:'50%',background:`${GREEN}20`,border:`1px solid ${GREEN}44`,color:GREEN,fontSize:15,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>🔊</motion.button>
                  </div>
                ):(
                  <div style={{ fontSize:13,color:SUB,fontStyle:'italic' }}>⏳ {spokenText}</div>
                )}
              </div>
            )}

            {/* ПОЛЕ ВВОДА */}
            <div style={{ borderRadius:12,border:`1px solid ${LINE}`,background:CARD,marginBottom:6,overflow:'hidden' }}>
              <div style={{ display:'flex',alignItems:'flex-start' }}>
                <textarea ref={inputRef} value={inputText} onChange={e=>{ setInputText(e.target.value); setOutputText(''); }} placeholder={t('ph')}
                  style={{ flex:1,minHeight:60,padding:'10px 12px',background:'transparent',border:'none',outline:'none',color:TEXT,fontSize:14,fontFamily:FF,resize:'none',lineHeight:1.6,boxSizing:'border-box' }}/>
                {inputText&&(
                  <motion.button whileTap={{ scale:0.88 }} onClick={()=>{ setInputText(''); setOutputText(''); }}
                    style={{ width:26,height:26,margin:'9px 9px 0 0',borderRadius:'50%',background:'rgba(246,70,93,0.12)',border:'1px solid rgba(246,70,93,0.25)',color:RED,fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>✕</motion.button>
                )}
              </div>
              {(outputText||translating)&&(
                <div style={{ borderTop:`1px solid ${LINE}`,padding:'8px 12px',background:'rgba(255,255,255,0.02)',display:'flex',alignItems:'center',gap:8 }}>
                  <div style={{ flex:1 }}>
                    {translating?<div style={{ color:SUB,fontSize:11,fontStyle:'italic' }}>{t('translating')}</div>
                      :<div style={{ fontSize:15,fontWeight:800,color:accent,lineHeight:1.5 }}>{outputText}</div>}
                  </div>
                  {!translating&&outputText&&(
                    <motion.button whileTap={{ scale:0.88 }} onClick={()=>speakText(outputText,theirLang)}
                      style={{ width:32,height:32,borderRadius:'50%',background:`${accent}20`,border:`1px solid ${accent}44`,color:accent,fontSize:15,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>🔊</motion.button>
                  )}
                </div>
              )}
            </div>

            {/* КНОПКА ПЕРЕВЕСТИ */}
            <motion.button whileTap={{ scale:0.97 }} onClick={handleTranslateAndSpeak} disabled={!inputText.trim()||translating}
              style={{ width:'100%',padding:'13px',borderRadius:12,cursor:inputText.trim()?'pointer':'not-allowed',
                background:inputText.trim()?`linear-gradient(135deg,${accent},${accent}bb)`:'rgba(255,255,255,0.04)',
                border:`1.5px solid ${inputText.trim()?accent+'66':LINE}`,color:inputText.trim()?'#fff':SUB,
                fontSize:14,fontWeight:900,fontFamily:FF,letterSpacing:'0.02em',marginBottom:10,
                display:'flex',alignItems:'center',justifyContent:'center',gap:8,
                boxShadow:inputText.trim()?`0 4px 20px ${accent}44`:'none',transition:'all 0.2s' }}>
              {translating?`⏳ ${t('translating')}`:t('translate')}
            </motion.button>

            {/* ══ ПАПКИ ФРАЗ ══ */}
            <div style={{ marginBottom:10 }}>
              {/* Метка */}
              <div style={{ fontSize:9,color:SUB,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase',marginBottom:6 }}>
                📂 Готовые фразы
              </div>

              {/* Табы папок — горизонтальный скролл */}
              <div style={{ display:'flex',gap:5,overflowX:'auto',marginBottom:8,padding:'2px 0',scrollbarWidth:'none' as any }}>
                {PRESET_FOLDERS.map(folder=>(
                  <motion.button key={folder.id} whileTap={{ scale:0.92 }}
                    onClick={()=>setActiveFolder(folder.id)}
                    style={{ padding:'6px 10px',borderRadius:20,flexShrink:0,cursor:'pointer',fontFamily:FF,
                      background:activeFolder===folder.id?`${accent}22`:'rgba(255,255,255,0.05)',
                      border:`1.5px solid ${activeFolder===folder.id?accent+'55':LINE}`,
                      color:activeFolder===folder.id?accent:SUB,fontSize:11,fontWeight:700,
                      whiteSpace:'nowrap',transition:'all 0.15s' }}>
                    {folder.icon} {folder.label}
                  </motion.button>
                ))}
                {/* Моя папка */}
                <motion.button whileTap={{ scale:0.92 }}
                  onClick={()=>setActiveFolder('mine')}
                  style={{ padding:'6px 10px',borderRadius:20,flexShrink:0,cursor:'pointer',fontFamily:FF,
                    background:activeFolder==='mine'?`${accent}22`:'rgba(255,255,255,0.05)',
                    border:`1.5px solid ${activeFolder==='mine'?accent+'55':LINE}`,
                    color:activeFolder==='mine'?accent:SUB,fontSize:11,fontWeight:700,
                    whiteSpace:'nowrap',transition:'all 0.15s' }}>
                  {t('myFolder')}
                </motion.button>
              </div>

              {/* Содержимое папки */}
              <AnimatePresence mode="wait">
                <motion.div key={activeFolder} initial={{ opacity:0,y:4 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }} transition={{ duration:0.15 }}>

                  {!isMineFolder&&activeFolderData&&(
                    <div style={{ display:'flex',flexWrap:'wrap',gap:5 }}>
                      {activeFolderData.phrases.map(phrase=>(
                        <motion.button key={phrase} whileTap={{ scale:0.91 }}
                          onClick={()=>handlePhraseClick(phrase)}
                          style={{ padding:'7px 12px',borderRadius:20,border:`1px solid ${LINE}`,
                            background:'rgba(255,255,255,0.05)',color:TEXT,fontSize:11,fontWeight:700,
                            cursor:'pointer',fontFamily:FF }}>
                          {phrase}
                        </motion.button>
                      ))}
                    </div>
                  )}

                  {isMineFolder&&(
                    <div>
                      {/* Фразы пользователя */}
                      {myPhrases.length===0&&!addingPhrase&&(
                        <div style={{ fontSize:11,color:SUB,fontStyle:'italic',textAlign:'center',padding:'10px 0' }}>
                          {t('emptyFolder')}
                        </div>
                      )}
                      <div style={{ display:'flex',flexWrap:'wrap',gap:5,marginBottom:myPhrases.length>0?8:0 }}>
                        {myPhrases.map((phrase,idx)=>(
                          <div key={idx} style={{ display:'flex',alignItems:'center',gap:0 }}>
                            <motion.button whileTap={{ scale:0.91 }}
                              onClick={()=>handlePhraseClick(phrase)}
                              style={{ padding:'7px 12px',borderRadius:'20px 0 0 20px',border:`1px solid ${LINE}`,borderRight:'none',
                                background:'rgba(255,255,255,0.05)',color:TEXT,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:FF }}>
                              {phrase}
                            </motion.button>
                            <motion.button whileTap={{ scale:0.88 }} onClick={()=>deleteMyPhrase(idx)}
                              style={{ padding:'7px 7px',borderRadius:'0 20px 20px 0',border:`1px solid ${LINE}`,
                                background:'rgba(246,70,93,0.08)',color:RED,fontSize:10,cursor:'pointer' }}>✕</motion.button>
                          </div>
                        ))}
                      </div>

                      {/* Добавление фразы */}
                      {addingPhrase?(
                        <div style={{ display:'flex',gap:5,alignItems:'center' }}>
                          <input ref={newPhraseRef} value={newPhraseText}
                            onChange={e=>setNewPhraseText(e.target.value)}
                            onKeyDown={e=>{ if(e.key==='Enter') saveNewPhrase(); if(e.key==='Escape'){ setAddingPhrase(false); setNewPhraseText(''); } }}
                            placeholder={t('phInput')}
                            style={{ flex:1,padding:'8px 12px',borderRadius:10,background:'rgba(255,255,255,0.06)',
                              border:`1px solid ${accent}55`,color:TEXT,fontSize:12,fontFamily:FF,outline:'none' }}
                            autoFocus/>
                          <motion.button whileTap={{ scale:0.9 }} onClick={saveNewPhrase}
                            style={{ padding:'8px 12px',borderRadius:10,background:`${accent}22`,border:`1px solid ${accent}44`,color:accent,fontSize:12,fontWeight:800,cursor:'pointer' }}>✓</motion.button>
                          <motion.button whileTap={{ scale:0.9 }} onClick={()=>{ setAddingPhrase(false); setNewPhraseText(''); }}
                            style={{ padding:'8px 10px',borderRadius:10,background:'rgba(246,70,93,0.1)',border:`1px solid ${RED}33`,color:RED,fontSize:12,cursor:'pointer' }}>✕</motion.button>
                        </div>
                      ):(
                        <motion.button whileTap={{ scale:0.94 }} onClick={()=>setAddingPhrase(true)}
                          style={{ padding:'7px 14px',borderRadius:20,border:`1.5px dashed ${accent}44`,
                            background:'transparent',color:accent,fontSize:11,fontWeight:700,cursor:'pointer',fontFamily:FF }}>
                          {t('addPhrase')}
                        </motion.button>
                      )}
                    </div>
                  )}

                </motion.div>
              </AnimatePresence>
            </div>

            {/* SOS */}
            <motion.button whileTap={{ scale:0.97 }} onClick={handleSOS}
              animate={{ boxShadow:sosPending?['0 0 0px rgba(246,70,93,0)','0 0 28px rgba(246,70,93,0.9)','0 0 0px rgba(246,70,93,0)']:'0 4px 18px rgba(246,70,93,0.35)' }}
              transition={{ repeat:sosPending?Infinity:0,duration:0.55 }}
              style={{ width:'100%',padding:'15px',borderRadius:14,cursor:'pointer',
                background:`linear-gradient(135deg,${RED},#b01222)`,
                border:`2px solid ${RED}`,color:'#fff',fontSize:15,fontWeight:900,fontFamily:FF,
                letterSpacing:'0.03em',display:'flex',alignItems:'center',justifyContent:'center',gap:8,marginBottom:6 }}>
              {t('sos')}
            </motion.button>
            <div style={{ textAlign:'center',fontSize:10,color:SUB,lineHeight:1.5 }}>3 сигнала → голос на языке собеседника</div>
          </div>
        </div>
      </div>

      {/* ══ БЕГУНОК МАСШТАБА ══ */}
      <div style={{ flexShrink:0,background:'rgba(9,9,15,0.97)',borderTop:`1px solid ${LINE}`,padding:'8px 16px 14px',display:'flex',flexDirection:'column',gap:4 }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:2 }}>
          <span style={{ fontSize:9,color:SUB,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase' }}>🔍 Масштаб</span>
          <span style={{ fontSize:11,color:scale>1?accent:SUB,fontWeight:800 }}>{scalePercent}%</span>
        </div>
        <div style={{ display:'flex',alignItems:'center',gap:8 }}>
          <button onClick={()=>setScale(s=>clampScale(s-0.1))} style={{ width:26,height:26,borderRadius:8,flexShrink:0,background:'rgba(255,255,255,0.06)',border:`1px solid ${LINE}`,color:TEXT,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>−</button>
          <div style={{ flex:1,position:'relative',height:24,display:'flex',alignItems:'center' }}>
            <div style={{ position:'absolute',left:0,right:0,height:4,borderRadius:2,background:'rgba(255,255,255,0.08)' }}/>
            <div style={{ position:'absolute',left:0,width:`${((scale-SCALE_MIN)/(SCALE_MAX-SCALE_MIN))*100}%`,height:4,borderRadius:2,background:`linear-gradient(90deg,${accent}88,${accent})`,transition:'width 0.05s' }}/>
            <input type="range" min={SCALE_MIN} max={SCALE_MAX} step={0.05} value={scale}
              onChange={e=>setScale(clampScale(parseFloat(e.target.value)))}
              style={{ position:'absolute',left:0,right:0,width:'100%',appearance:'none',WebkitAppearance:'none',background:'transparent',cursor:'pointer',height:24,margin:0 }}/>
          </div>
          <button onClick={()=>setScale(s=>clampScale(s+0.1))} style={{ width:26,height:26,borderRadius:8,flexShrink:0,background:'rgba(255,255,255,0.06)',border:`1px solid ${LINE}`,color:TEXT,fontSize:14,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>+</button>
        </div>
        {scale===SCALE_DEFAULT&&<div style={{ textAlign:'center',fontSize:9,color:SUB,marginTop:1 }}>Сдвиньте вправо или раздвиньте пальцами для увеличения</div>}
      </div>
    </div>
  );
}
