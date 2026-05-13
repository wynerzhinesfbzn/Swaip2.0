import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─── Palette ─────────────────────────────────────────────── */
const BG     = '#09090f';
const CARD   = 'rgba(255,255,255,0.05)';
const CARD2  = 'rgba(255,255,255,0.08)';
const BORDER = 'rgba(255,255,255,0.10)';
const ACCENT = '#4f8ef7';
const TEXT   = '#e8eaf0';
const SUB    = 'rgba(232,234,240,0.5)';
const GREEN  = '#34d399';
const AMBER  = '#fbbf24';

/* ─── Field definitions ───────────────────────────────────── */
interface DocFields {
  fullName:          string;
  passportSeries:    string;
  passportNumber:    string;
  passportIssuedBy:  string;
  passportIssuedDate:string;
  birthDate:         string;
  birthPlace:        string;
  regAddress:        string;
  phone:             string;
  inn:               string;
  city:              string;
  today:             string;
  /* extras used in specific templates */
  amount:            string;
  amountWords:       string;
  returnDate:        string;
  counterFullName:   string;
  counterPassport:   string;
  counterAddress:    string;
  subject:           string;
  rentAddress:       string;
  rentAmount:        string;
  rentPeriod:        string;
  carBrand:          string;
  carYear:           string;
  carVin:            string;
  carPrice:          string;
  workDesc:          string;
  workPrice:         string;
  workDeadline:      string;
  position:          string;
  employer:          string;
  dismissDate:       string;
  claimSubject:      string;
  claimAmount:       string;
}

const EMPTY: DocFields = {
  fullName:'', passportSeries:'', passportNumber:'', passportIssuedBy:'',
  passportIssuedDate:'', birthDate:'', birthPlace:'', regAddress:'',
  phone:'', inn:'', city:'', today: new Date().toLocaleDateString('ru-RU'),
  amount:'', amountWords:'', returnDate:'', counterFullName:'', counterPassport:'',
  counterAddress:'', subject:'', rentAddress:'', rentAmount:'', rentPeriod:'',
  carBrand:'', carYear:'', carVin:'', carPrice:'', workDesc:'', workPrice:'',
  workDeadline:'', position:'', employer:'', dismissDate:'', claimSubject:'', claimAmount:'',
};

const FIELD_LABELS: Partial<Record<keyof DocFields, string>> = {
  fullName: 'ФИО полностью', passportSeries: 'Серия паспорта', passportNumber: 'Номер паспорта',
  passportIssuedBy: 'Кем выдан', passportIssuedDate: 'Дата выдачи', birthDate: 'Дата рождения',
  birthPlace: 'Место рождения', regAddress: 'Адрес регистрации', phone: 'Телефон',
  inn: 'ИНН', city: 'Город', today: 'Дата',
  amount: 'Сумма (цифрами)', amountWords: 'Сумма (прописью)', returnDate: 'Срок возврата',
  counterFullName: 'ФИО второй стороны', counterPassport: 'Паспорт второй стороны',
  counterAddress: 'Адрес второй стороны', subject: 'Предмет документа',
  rentAddress: 'Адрес квартиры', rentAmount: 'Арендная плата', rentPeriod: 'Срок аренды',
  carBrand: 'Марка/модель авто', carYear: 'Год выпуска', carVin: 'VIN-номер', carPrice: 'Цена авто',
  workDesc: 'Описание работ', workPrice: 'Стоимость работ', workDeadline: 'Срок выполнения',
  position: 'Должность', employer: 'Организация (работодатель)', dismissDate: 'Дата увольнения',
  claimSubject: 'Предмет претензии', claimAmount: 'Сумма требования',
};

/* ─── Templates ───────────────────────────────────────────── */
interface Template {
  id: string;
  icon: string;
  name: string;
  desc: string;
  extras: (keyof DocFields)[];
  build: (f: DocFields) => string;
}

const fill = (tpl: string, f: DocFields) =>
  tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (f as unknown as Record<string, string>)[k] || `[${FIELD_LABELS[k as keyof DocFields] ?? k}]`);

const TEMPLATES: Template[] = [
  {
    id: 'receipt',
    icon: '🤝',
    name: 'Расписка о получении денег',
    desc: 'Подтверждение получения денежных средств с обязательством возврата',
    extras: ['amount','amountWords','returnDate','counterFullName'],
    build: f => fill(`РАСПИСКА

Я, {{fullName}}, {{birthDate}} г.р., паспорт серия {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}}, зарегистрированный(ая) по адресу: {{regAddress}},

получил(а) от {{counterFullName}} денежные средства в размере {{amount}} ({{amountWords}}) рублей.

Обязуюсь вернуть указанную сумму в полном объёме в срок до {{returnDate}}.

г. {{city}}, «___» ____________ {{today}} г.

___________________________ / {{fullName}} /`, f),
  },
  {
    id: 'loan',
    icon: '💰',
    name: 'Договор займа денег',
    desc: 'Передача денег в долг с условиями возврата',
    extras: ['amount','amountWords','returnDate','counterFullName','counterPassport','counterAddress'],
    build: f => fill(`ДОГОВОР ЗАЙМА № ___
г. {{city}}, {{today}}

{{fullName}}, паспорт серия {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}}, проживающий(ая) по адресу: {{regAddress}}, именуемый(ая) в дальнейшем «Займодавец», с одной стороны,

и {{counterFullName}}, паспорт {{counterPassport}}, проживающий(ая) по адресу: {{counterAddress}}, именуемый(ая) в дальнейшем «Заёмщик», с другой стороны,

заключили настоящий договор о нижеследующем:

1. Займодавец передаёт Заёмщику денежные средства в размере {{amount}} ({{amountWords}}) рублей, а Заёмщик обязуется возвратить указанную сумму в срок до {{returnDate}}.

2. Займ предоставляется беспроцентно.

3. В случае нарушения срока возврата Заёмщик уплачивает пеню в размере 0,1% от суммы займа за каждый день просрочки.

4. Настоящий договор составлен в двух экземплярах, имеющих равную юридическую силу.

ЗАЙМОДАВЕЦ:                          ЗАЁМЩИК:
{{fullName}}                         {{counterFullName}}
_________________                    _________________`, f),
  },
  {
    id: 'poa',
    icon: '📋',
    name: 'Доверенность',
    desc: 'Передача полномочий на представление интересов',
    extras: ['counterFullName','counterPassport','counterAddress','subject'],
    build: f => fill(`ДОВЕРЕННОСТЬ

г. {{city}}, {{today}}

Я, {{fullName}}, {{birthDate}} г.р., паспорт серия {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}}, зарегистрированный(ая) по адресу: {{regAddress}},

настоящей доверенностью уполномочиваю

{{counterFullName}}, паспорт {{counterPassport}}, проживающего(ую) по адресу: {{counterAddress}},

{{subject}}

Доверенность выдана без права передоверия, сроком на один год.

______________________ / {{fullName}} /`, f),
  },
  {
    id: 'sale_car',
    icon: '🚗',
    name: 'Договор купли-продажи авто (ДКП)',
    desc: 'Продажа транспортного средства между физическими лицами',
    extras: ['carBrand','carYear','carVin','carPrice','amountWords','counterFullName','counterPassport','counterAddress'],
    build: f => fill(`ДОГОВОР КУПЛИ-ПРОДАЖИ ТРАНСПОРТНОГО СРЕДСТВА

г. {{city}}, {{today}}

{{fullName}}, паспорт серия {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}}, адрес: {{regAddress}}, именуемый(ая) «Продавец»,

и {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}}, именуемый(ая) «Покупатель»,

заключили настоящий договор:

1. Продавец продаёт, а Покупатель покупает транспортное средство:
   Марка/модель: {{carBrand}}
   Год выпуска: {{carYear}}
   VIN: {{carVin}}

2. Цена транспортного средства составляет {{carPrice}} ({{amountWords}}) рублей.

3. Расчёт производится в момент подписания договора.

4. Продавец гарантирует, что ТС не заложено, не в угоне, не под арестом.

ПРОДАВЕЦ:                            ПОКУПАТЕЛЬ:
{{fullName}}                         {{counterFullName}}
_________________                    _________________`, f),
  },
  {
    id: 'rent',
    icon: '🏠',
    name: 'Договор аренды квартиры',
    desc: 'Сдача жилого помещения в аренду (найм)',
    extras: ['rentAddress','rentAmount','rentPeriod','counterFullName','counterPassport','counterAddress'],
    build: f => fill(`ДОГОВОР НАЙМА ЖИЛОГО ПОМЕЩЕНИЯ

г. {{city}}, {{today}}

{{fullName}}, паспорт серия {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}}, адрес: {{regAddress}}, именуемый(ая) «Наймодатель»,

и {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}}, именуемый(ая) «Наниматель»,

заключили настоящий договор:

1. Наймодатель предоставляет Нанимателю жилое помещение, расположенное по адресу: {{rentAddress}}.

2. Плата за пользование помещением составляет {{rentAmount}} рублей в месяц.

3. Срок найма: {{rentPeriod}}.

4. Нанимать обязуется своевременно вносить плату и содержать помещение в надлежащем состоянии.

НАЙМОДАТЕЛЬ:                         НАНИМАТЕЛЬ:
{{fullName}}                         {{counterFullName}}
_________________                    _________________`, f),
  },
  {
    id: 'work_contract',
    icon: '🔧',
    name: 'Договор подряда',
    desc: 'Выполнение конкретных работ за вознаграждение',
    extras: ['workDesc','workPrice','amountWords','workDeadline','counterFullName','counterPassport','counterAddress'],
    build: f => fill(`ДОГОВОР ПОДРЯДА № ___

г. {{city}}, {{today}}

{{fullName}}, паспорт серия {{passportSeries}} № {{passportNumber}}, адрес: {{regAddress}}, именуемый(ая) «Подрядчик»,

и {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}}, именуемый(ая) «Заказчик»,

заключили настоящий договор:

1. Подрядчик обязуется выполнить следующие работы: {{workDesc}}.

2. Стоимость работ составляет {{workPrice}} ({{amountWords}}) рублей.

3. Срок выполнения работ: {{workDeadline}}.

4. Оплата производится после подписания акта приёмки выполненных работ.

ПОДРЯДЧИК:                           ЗАКАЗЧИК:
{{fullName}}                         {{counterFullName}}
_________________                    _________________`, f),
  },
  {
    id: 'dismiss',
    icon: '🚪',
    name: 'Заявление об увольнении',
    desc: 'Заявление об увольнении по собственному желанию',
    extras: ['employer','position','dismissDate'],
    build: f => fill(`Директору / Руководителю
{{employer}}

от {{fullName}},
должность: {{position}},
паспорт серия {{passportSeries}} № {{passportNumber}},
адрес: {{regAddress}}

ЗАЯВЛЕНИЕ

Прошу уволить меня по собственному желанию {{dismissDate}}.

{{today}}

_________________________ / {{fullName}} /`, f),
  },
  {
    id: 'claim',
    icon: '⚖️',
    name: 'Претензия',
    desc: 'Досудебная претензия по любому поводу',
    extras: ['counterFullName','counterAddress','claimSubject','claimAmount'],
    build: f => fill(`ПРЕТЕНЗИЯ

г. {{city}}, {{today}}

От: {{fullName}}, {{regAddress}}, тел.: {{phone}}

Кому: {{counterFullName}}, {{counterAddress}}

ПРЕДМЕТ ПРЕТЕНЗИИ:
{{claimSubject}}

В связи с изложенным прошу в течение 10 (десяти) рабочих дней с момента получения настоящей претензии:
— выплатить денежные средства в размере {{claimAmount}} рублей;
— либо устранить нарушение иным способом.

В случае неудовлетворения претензии буду вынужден(а) обратиться в суд с исковым заявлением о взыскании указанных сумм, а также судебных расходов.

_________________________ / {{fullName}} /`, f),
  },
  {
    id: 'pd_consent',
    icon: '🔒',
    name: 'Согласие на обработку ПД',
    desc: 'Согласие на обработку персональных данных (152-ФЗ)',
    extras: ['employer'],
    build: f => fill(`СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ

Я, {{fullName}}, {{birthDate}} г.р., паспорт серия {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}}, зарегистрированный(ая) по адресу: {{regAddress}},

настоящим даю своё согласие {{employer}} на обработку моих персональных данных в соответствии с Федеральным законом № 152-ФЗ «О персональных данных», включая сбор, систематизацию, накопление, хранение, уточнение, использование, распространение, обезличивание, блокирование, уничтожение персональных данных.

Согласие даётся на срок выполнения обязательств и может быть отозвано путём направления письменного уведомления.

{{today}}

_________________________ / {{fullName}} /`, f),
  },
  {
    id: 'service',
    icon: '💼',
    name: 'Договор оказания услуг',
    desc: 'Возмездное оказание услуг (консультации, обучение, и т.д.)',
    extras: ['subject','workPrice','amountWords','workDeadline','counterFullName','counterPassport','counterAddress'],
    build: f => fill(`ДОГОВОР ВОЗМЕЗДНОГО ОКАЗАНИЯ УСЛУГ № ___

г. {{city}}, {{today}}

{{fullName}}, паспорт серия {{passportSeries}} № {{passportNumber}}, адрес: {{regAddress}}, именуемый(ая) «Исполнитель»,

и {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}}, именуемый(ая) «Заказчик»,

заключили настоящий договор:

1. Исполнитель обязуется оказать следующие услуги: {{subject}}.

2. Стоимость услуг: {{workPrice}} ({{amountWords}}) рублей.

3. Срок оказания услуг: {{workDeadline}}.

4. Заказчик оплачивает услуги в течение 3 банковских дней после подписания акта.

ИСПОЛНИТЕЛЬ:                         ЗАКАЗЧИК:
{{fullName}}                         {{counterFullName}}
_________________                    _________________`, f),
  },
];

/* ─── Scan filter ──────────────────────────────────────────── */
const applyScanFilter = (file: File, mode: 'color' | 'bw'): Promise<{ dataUrl: string; blob: Blob }> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const MAX = 2400;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
          else { width = Math.round(width * MAX / height); height = MAX; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        if (mode === 'color') {
          ctx.filter = 'contrast(1.45) saturate(1.3) brightness(1.12)';
          ctx.drawImage(img, 0, 0, width, height);
        } else {
          ctx.filter = 'grayscale(1) contrast(1.9) brightness(1.18)';
          ctx.drawImage(img, 0, 0, width, height);
          const id = ctx.getImageData(0, 0, width, height);
          const d = id.data;
          for (let i = 0; i < d.length; i += 4) { const v = d[i]; const o = v > 172 ? 255 : v < 80 ? 0 : v; d[i] = d[i+1] = d[i+2] = o; }
          ctx.putImageData(id, 0, 0);
        }
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
        canvas.toBlob(b => b ? resolve({ dataUrl, blob: b }) : reject(new Error('blob')), 'image/jpeg', 0.95);
      };
      img.onerror = reject;
      img.src = ev.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/* ─── File reader helpers ──────────────────────────────────── */
type DocKind = 'pdf' | 'docx' | 'image' | 'text' | 'csv' | 'xlsx' | 'scan' | 'unknown';
const detectKind = (name: string, mime: string): DocKind => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (mime.includes('wordprocessingml') || ext === 'docx' || ext === 'doc') return 'docx';
  if (mime.startsWith('image/') || ['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext)) return 'image';
  if (ext === 'csv') return 'csv';
  if (mime.includes('spreadsheetml') || ['xlsx','xls'].includes(ext)) return 'xlsx';
  if (['txt','md','log','json','xml','html','htm','ini'].includes(ext)) return 'text';
  return 'unknown';
};
const kindIcon = (k: string) => k==='pdf'?'📄':k==='docx'?'📝':(k==='xlsx'||k==='csv')?'📊':(k==='image'||k==='scan')?'🖼️':'📃';
const kindLabel = (k: string) => k==='pdf'?'PDF':k==='docx'?'Word':k==='xlsx'?'Excel':k==='csv'?'CSV':k==='image'?'Изображение':k==='scan'?'Скан':'Текст';
const fmtSize = (b: number) => b < 1024 ? b+' Б' : b < 1048576 ? (b/1024).toFixed(1)+' КБ' : (b/1048576).toFixed(1)+' МБ';
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('ru-RU', {day:'2-digit',month:'short',year:'numeric'});

interface RecentDoc { id: string; name: string; kind: string; size: number; date: number; }

/* ─── Component ────────────────────────────────────────────── */
export default function DocumentsApp({ onBack, myHash }: { onBack: () => void; myHash?: string }) {
  const [tab, setTab]         = useState<'data' | 'templates' | 'reader'>('data');

  /* --- Data tab state --- */
  const [fields, setFields]   = useState<DocFields>({ ...EMPTY });
  const [extracting, setExtracting] = useState(false);
  const [extractDone, setExtractDone] = useState(false);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  /* --- Templates tab state --- */
  const [selectedTpl, setSelectedTpl] = useState<Template | null>(null);
  const [result, setResult]   = useState<string | null>(null);

  /* --- Reader tab state --- */
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);
  const [rLoading, setRLoading] = useState(false);
  const [rDocName, setRDocName] = useState('');
  const [rDocKind, setRDocKind] = useState<DocKind>('unknown');
  const [rPdfUrl, setRPdfUrl]   = useState<string | null>(null);
  const [rDocHtml, setRDocHtml] = useState<string | null>(null);
  const [rDocText, setRDocText] = useState<string | null>(null);
  const [rDocTable, setRDocTable] = useState<unknown[][] | null>(null);
  const [rImageUrl, setRImageUrl] = useState<string | null>(null);
  const [rImgZoom, setRImgZoom] = useState(1);
  const [rViewing, setRViewing] = useState(false);
  const [rError, setRError]     = useState<string | null>(null);

  const [toast, setToast]       = useState<string | null>(null);

  /* Refs */
  const scanColorRef  = useRef<HTMLInputElement>(null);
  const scanBwRef     = useRef<HTMLInputElement>(null);
  const photoRef      = useRef<HTMLInputElement>(null);
  const fileRef       = useRef<HTMLInputElement>(null);
  const iframeRef     = useRef<HTMLIFrameElement>(null);

  /* Load recent */
  useEffect(() => {
    try { const s = localStorage.getItem('swaip_docs_recent'); if (s) setRecentDocs(JSON.parse(s)); } catch {}
  }, []);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const setField = (k: keyof DocFields, v: string) => setFields(f => ({ ...f, [k]: v }));

  /* ── Filled fields count ── */
  const baseKeys: (keyof DocFields)[] = ['fullName','passportSeries','passportNumber','passportIssuedBy','passportIssuedDate','birthDate','regAddress'];
  const filledCount = baseKeys.filter(k => fields[k]).length;

  /* ── Extract data from image via AI ── */
  const extractFromImage = useCallback(async (imageBase64: string, imageMime: string) => {
    setExtracting(true);
    setDataError(null);
    try {
      const token = localStorage.getItem('session_token') || '';
      const resp = await fetch('/api/assistants/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': token },
        body: JSON.stringify({
          specialistId: 'igor',
          question: 'Извлеки все данные из этого документа и верни ТОЛЬКО JSON-объект (без пояснений, без markdown). Поля: fullName (ФИО полностью), passportSeries (серия 4 цифры), passportNumber (номер 6 цифр), passportIssuedBy (кем выдан), passportIssuedDate (дата выдачи дд.мм.гггг), birthDate (дата рождения дд.мм.гггг), birthPlace (место рождения), regAddress (адрес регистрации), inn (ИНН если есть). Отсутствующие поля — пустая строка.',
          imageBase64,
          imageMime,
        }),
      });
      if (!resp.ok) throw new Error('API error');
      const data = await resp.json();
      const text: string = data.answer ?? data.text ?? '';
      /* parse JSON from response */
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setFields(f => ({
          ...f,
          fullName:           parsed.fullName           ?? f.fullName,
          passportSeries:     parsed.passportSeries     ?? f.passportSeries,
          passportNumber:     parsed.passportNumber     ?? f.passportNumber,
          passportIssuedBy:   parsed.passportIssuedBy   ?? f.passportIssuedBy,
          passportIssuedDate: parsed.passportIssuedDate ?? f.passportIssuedDate,
          birthDate:          parsed.birthDate          ?? f.birthDate,
          birthPlace:         parsed.birthPlace         ?? f.birthPlace,
          regAddress:         parsed.regAddress         ?? f.regAddress,
          inn:                parsed.inn                ?? f.inn,
        }));
        setExtractDone(true);
        showToast('✅ Данные извлечены — проверьте и при необходимости исправьте');
      } else {
        setDataError('Не удалось извлечь данные. Убедитесь что документ хорошо виден.');
      }
    } catch {
      setDataError('Ошибка при распознавании. Попробуйте ещё раз или введите данные вручную.');
    } finally {
      setExtracting(false);
    }
  }, []);

  /* ── Handle scan (apply filter + extract) ── */
  const handleScan = useCallback(async (file: File, mode: 'color' | 'bw') => {
    setScanning(true);
    setDataError(null);
    try {
      const { dataUrl, blob } = await applyScanFilter(file, mode);
      setScanPreview(dataUrl);
      setScanning(false);
      /* convert to base64 */
      const base64 = dataUrl.split(',')[1];
      await extractFromImage(base64, 'image/jpeg');
    } catch {
      setScanning(false);
      setDataError('Ошибка при обработке изображения');
    }
  }, [extractFromImage]);

  /* ── Handle photo (no filter) ── */
  const handlePhoto = useCallback(async (file: File) => {
    setDataError(null);
    const reader = new FileReader();
    reader.onload = async ev => {
      const dataUrl = ev.target?.result as string;
      setScanPreview(dataUrl);
      const base64 = dataUrl.split(',')[1];
      await extractFromImage(base64, file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  }, [extractFromImage]);

  /* ── Build filled document ── */
  const buildDoc = (tpl: Template) => {
    setSelectedTpl(tpl);
    setResult(tpl.build(fields));
    setTab('templates');
  };

  /* ── Print result ── */
  const printResult = () => {
    if (!result) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${selectedTpl?.name ?? 'Документ'}</title><style>body{font-family:Arial,sans-serif;margin:50px;font-size:14px;line-height:1.9;color:#111;white-space:pre-wrap;}</style></head><body>${result.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 500);
  };

  /* ── Native share ── */
  const shareResult = async () => {
    if (!result) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: selectedTpl?.name ?? 'Документ', text: result });
      } catch {}
    } else {
      await navigator.clipboard.writeText(result);
      showToast('📋 Текст скопирован в буфер обмена');
    }
  };

  /* ── Reader: process file ── */
  const processReaderFile = useCallback(async (file: File) => {
    setRLoading(true); setRError(null);
    if (rPdfUrl) URL.revokeObjectURL(rPdfUrl);
    if (rImageUrl?.startsWith('blob:')) URL.revokeObjectURL(rImageUrl);
    setRPdfUrl(null); setRDocHtml(null); setRDocText(null); setRDocTable(null); setRImageUrl(null);
    const kind = detectKind(file.name, file.type);
    setRDocName(file.name); setRDocKind(kind);
    try {
      if (kind === 'pdf') {
        setRPdfUrl(URL.createObjectURL(file)); setRViewing(true);
      } else if (kind === 'image') {
        setRImageUrl(URL.createObjectURL(file)); setRViewing(true);
      } else if (kind === 'docx') {
        const mammoth = await import('mammoth');
        const buf = await file.arrayBuffer();
        const res = await (mammoth as unknown as { convertToHtml: (o:{arrayBuffer:ArrayBuffer}) => Promise<{value:string}> }).convertToHtml({ arrayBuffer: buf });
        setRDocHtml(res.value || '<p><em>Документ пуст</em></p>'); setRViewing(true);
      } else if (kind === 'text') {
        setRDocText(await file.text()); setRViewing(true);
      } else if (kind === 'csv') {
        const text = await file.text();
        const rows = text.split('\n').filter(r=>r.trim()).map(r => {
          const cells: string[] = []; let cur='', inQ=false;
          for (const ch of r) { if (ch==='"') inQ=!inQ; else if (ch===','&&!inQ) { cells.push(cur); cur=''; } else cur+=ch; }
          cells.push(cur); return cells;
        });
        setRDocTable(rows); setRViewing(true);
      } else if (kind === 'xlsx') {
        const XLSX = await import('xlsx');
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        setRDocTable(XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' }));
        setRViewing(true);
      } else {
        setRError('Формат не поддерживается. Поддерживается: PDF, DOCX, TXT, XLSX, CSV, JPG, PNG');
      }
      /* save recent */
      setRecentDocs(prev => {
        const updated = [{ id: Date.now().toString(), name: file.name, kind, size: file.size, date: Date.now() }, ...prev.filter(d => d.name !== file.name)].slice(0, 20);
        try { localStorage.setItem('swaip_docs_recent', JSON.stringify(updated)); } catch {}
        return updated;
      });
    } catch (e) { setRError('Не удалось открыть: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setRLoading(false); }
  }, [rPdfUrl, rImageUrl]);

  /* ── Print reader doc ── */
  const printReaderDoc = () => {
    if (rDocKind==='pdf' && rPdfUrl) { window.open(rPdfUrl,'_blank')?.addEventListener('load', e => (e.target as Window).print()); return; }
    const win = window.open('', '_blank'); if (!win) return;
    let body = '';
    if (rDocHtml) body = `<style>body{font-family:Arial,sans-serif;margin:40px;font-size:14px;line-height:1.7;color:#111;}</style>${rDocHtml}`;
    else if (rDocText) body = `<style>body{font-family:monospace;margin:40px;font-size:12px;white-space:pre-wrap;color:#111;}</style>${rDocText.replace(/&/g,'&amp;').replace(/</g,'&lt;')}`;
    else if (rImageUrl) body = `<style>body{margin:20px;}img{max-width:100%;}</style><img src="${rImageUrl}"/>`;
    else if (rDocTable) { const rows = (rDocTable as string[][]).map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join(''); body=`<style>body{font-family:Arial;margin:20px;}table{border-collapse:collapse;width:100%;}td,th{border:1px solid #ccc;padding:5px;font-size:11px;}</style><table>${rows}</table>`; }
    win.document.write(`<!DOCTYPE html><html><head><title>${rDocName}</title></head><body>${body}</body></html>`);
    win.document.close(); setTimeout(()=>{win.focus();win.print();},500);
  };

  /* ── Input field component ── */
  const Field = ({ k, placeholder }: { k: keyof DocFields; placeholder?: string }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: SUB, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{FIELD_LABELS[k]}</div>
      <input value={fields[k]} onChange={e => setField(k, e.target.value)}
        placeholder={placeholder ?? FIELD_LABELS[k] ?? k}
        style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: CARD2, border: `1px solid ${fields[k] ? 'rgba(79,142,247,0.5)' : BORDER}`, color: TEXT, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
    </div>
  );

  /* ───────────────────────── RENDER ───────────────────────── */
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 800, background: BG, display: 'flex', flexDirection: 'column', fontFamily: '"Montserrat",sans-serif', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '48px 16px 12px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(9,9,15,0.98)', flexShrink: 0, backdropFilter: 'blur(16px)' }}>
        <motion.button whileTap={{ scale: 0.88 }}
          onClick={() => { if (tab === 'templates' && result) { setResult(null); setSelectedTpl(null); } else if (tab === 'reader' && rViewing) { setRViewing(false); } else onBack(); }}
          style={{ width: 36, height: 36, borderRadius: '50%', background: CARD, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>←</motion.button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 900, color: TEXT }}>
            {tab === 'templates' && result ? (selectedTpl?.name ?? 'Документ') : '📂 Документы'}
          </div>
          {tab === 'data' && filledCount > 0 && (
            <div style={{ fontSize: 10, color: GREEN, marginTop: 1, fontWeight: 700 }}>✓ Заполнено {filledCount}/{baseKeys.length} основных полей</div>
          )}
        </div>
        {tab === 'templates' && result && (
          <div style={{ display: 'flex', gap: 6 }}>
            <motion.button whileTap={{ scale: 0.9 }} onClick={printResult}
              style={{ width: 34, height: 34, borderRadius: 10, background: CARD, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🖨️</motion.button>
            <motion.button whileTap={{ scale: 0.9 }} onClick={shareResult}
              style={{ width: 34, height: 34, borderRadius: 10, background: CARD, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>📤</motion.button>
          </div>
        )}
        {tab === 'reader' && rViewing && (
          <div style={{ display: 'flex', gap: 6 }}>
            <motion.button whileTap={{ scale: 0.9 }} onClick={printReaderDoc}
              style={{ width: 34, height: 34, borderRadius: 10, background: CARD, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🖨️</motion.button>
            {(rDocKind==='image'||rDocKind==='scan') && <>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setRImgZoom(z=>Math.min(z+0.25,4))}
                style={{ width: 34, height: 34, borderRadius: 10, background: CARD, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>＋</motion.button>
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => setRImgZoom(z=>Math.max(z-0.25,0.25))}
                style={{ width: 34, height: 34, borderRadius: 10, background: CARD, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>－</motion.button>
            </>}
          </div>
        )}
      </div>

      {/* ── Tab bar ── */}
      {!(tab === 'templates' && result) && !(tab === 'reader' && rViewing) && (
        <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}`, flexShrink: 0, background: 'rgba(9,9,15,0.98)' }}>
          {([
            { id: 'data',      icon: '👤', label: 'Мои данные' },
            { id: 'templates', icon: '📝', label: 'Шаблоны' },
            { id: 'reader',    icon: '📂', label: 'Читалка' },
          ] as const).map(t => (
            <motion.button key={t.id} whileTap={{ scale: 0.95 }} onClick={() => setTab(t.id)}
              style={{ flex: 1, padding: '12px 4px', background: 'transparent', border: 'none', color: tab === t.id ? ACCENT : SUB, fontSize: 11, fontWeight: 800, cursor: 'pointer', borderBottom: tab === t.id ? `2px solid ${ACCENT}` : '2px solid transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <span style={{ fontSize: 16 }}>{t.icon}</span>
              {t.label}
            </motion.button>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <AnimatePresence mode="wait">

          {/* ═══ TAB: ДАННЫЕ ═══ */}
          {tab === 'data' && (
            <motion.div key="data" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ height: '100%', overflowY: 'auto', padding: '16px 16px 120px' }}>

              {/* Scan / photo buttons */}
              <div style={{ background: 'linear-gradient(135deg,#0d1b38,#0d2230)', borderRadius: 16, padding: 16, marginBottom: 16, border: `1px solid rgba(79,142,247,0.2)`, position: 'relative', overflow: 'hidden' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                  📷 Загрузить данные из документа
                </div>
                <div style={{ fontSize: 11, color: SUB, marginBottom: 12, lineHeight: 1.5 }}>
                  Сфотографируйте паспорт или другой документ — бот сам считает все данные
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 6 }}>
                  <motion.button whileTap={{ scale: 0.95 }} disabled={scanning || extracting}
                    onClick={() => scanColorRef.current?.click()}
                    style={{ padding: '11px 6px', borderRadius: 12, background: ACCENT, border: 'none', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: (scanning||extracting)?0.5:1 }}>
                    🎨 Скан цветной
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} disabled={scanning || extracting}
                    onClick={() => scanBwRef.current?.click()}
                    style={{ padding: '11px 6px', borderRadius: 12, background: 'transparent', border: `1.5px solid ${ACCENT}`, color: ACCENT, fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: (scanning||extracting)?0.5:1 }}>
                    🖤 Скан ч/б
                  </motion.button>
                </div>
                <motion.button whileTap={{ scale: 0.95 }} disabled={scanning || extracting}
                  onClick={() => photoRef.current?.click()}
                  style={{ width: '100%', padding: '9px 6px', borderRadius: 10, background: 'transparent', border: `1px solid rgba(79,142,247,0.3)`, color: 'rgba(79,142,247,0.7)', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: (scanning||extracting)?0.5:1, boxSizing: 'border-box' }}>
                  🖼 Фото из галереи
                </motion.button>

                {/* Scan preview */}
                {scanPreview && (
                  <div style={{ marginTop: 10, borderRadius: 10, overflow: 'hidden', border: `1px solid ${BORDER}` }}>
                    <img src={scanPreview} alt="Скан" style={{ width: '100%', height: 'auto', display: 'block' }} />
                  </div>
                )}

                {/* Overlays */}
                <AnimatePresence>
                  {(scanning || extracting) && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ position: 'absolute', inset: 0, background: 'rgba(9,9,15,0.92)', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                      {scanning ? (
                        <>
                          <div style={{ position: 'relative', width: 130, height: 80, border: `2px solid ${ACCENT}`, borderRadius: 8, overflow: 'hidden' }}>
                            <motion.div animate={{ y: [0, 76, 0] }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                              style={{ position: 'absolute', left: 0, right: 0, height: 3, background: `linear-gradient(90deg,transparent,${ACCENT},transparent)`, boxShadow: `0 0 8px ${ACCENT}` }} />
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📄</div>
                          </div>
                          <div style={{ color: ACCENT, fontSize: 12, fontWeight: 800 }}>Сканирую…</div>
                        </>
                      ) : (
                        <>
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                            style={{ width: 40, height: 40, borderRadius: '50%', border: `3px solid rgba(79,142,247,0.2)`, borderTopColor: ACCENT }} />
                          <div style={{ color: ACCENT, fontSize: 12, fontWeight: 800 }}>Распознаю данные…</div>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {extractDone && (
                <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(52,211,153,0.1)', border: `1px solid rgba(52,211,153,0.25)`, color: GREEN, fontSize: 12, fontWeight: 700, marginBottom: 14 }}>
                  ✅ Данные распознаны! Проверьте поля ниже и при необходимости исправьте.
                </div>
              )}

              {dataError && (
                <div style={{ padding: '10px 14px', borderRadius: 12, background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.25)', color: '#ff6060', fontSize: 12, fontWeight: 600, marginBottom: 14, whiteSpace: 'pre-line' }}>
                  ⚠️ {dataError}
                </div>
              )}

              {/* Fields */}
              <div style={{ fontSize: 11, fontWeight: 800, color: SUB, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                ✏️ Личные данные
              </div>
              <Field k="fullName" placeholder="Иванов Иван Иванович" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Field k="passportSeries" placeholder="92 07" />
                <Field k="passportNumber" placeholder="341626" />
              </div>
              <Field k="passportIssuedBy" placeholder="УФМС России по РТ..." />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Field k="passportIssuedDate" placeholder="04.12.2008" />
                <Field k="birthDate" placeholder="26.07.1987" />
              </div>
              <Field k="birthPlace" placeholder="г. Казань" />
              <Field k="regAddress" placeholder="РТ, Набережные Челны, пр. Мира, 23, кв. 162" />
              <Field k="city" placeholder="Набережные Челны" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <Field k="phone" placeholder="+7 (999) 000-00-00" />
                <Field k="inn" placeholder="162812345678" />
              </div>

              <motion.button whileTap={{ scale: 0.97 }}
                onClick={() => setTab('templates')}
                style={{ width: '100%', marginTop: 8, padding: '14px', borderRadius: 14, background: ACCENT, border: 'none', color: '#fff', fontSize: 14, fontWeight: 900, cursor: 'pointer' }}>
                Выбрать шаблон документа →
              </motion.button>

              <motion.button whileTap={{ scale: 0.97 }}
                onClick={() => { setFields({ ...EMPTY, today: fields.today }); setScanPreview(null); setExtractDone(false); showToast('Данные очищены'); }}
                style={{ width: '100%', marginTop: 8, padding: '12px', borderRadius: 14, background: 'transparent', border: `1px solid ${BORDER}`, color: SUB, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Очистить все данные
              </motion.button>
            </motion.div>
          )}

          {/* ═══ TAB: ШАБЛОНЫ ═══ */}
          {tab === 'templates' && !result && (
            <motion.div key="templates" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ height: '100%', overflowY: 'auto', padding: '16px 16px 120px' }}>

              {filledCount < 3 && (
                <div style={{ padding: '12px 14px', borderRadius: 12, background: `rgba(251,191,36,0.1)`, border: `1px solid rgba(251,191,36,0.25)`, color: AMBER, fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
                  ⚠️ Заполнено только {filledCount} из {baseKeys.length} основных полей. Документ будет иметь незаполненные места. <span style={{ textDecoration: 'underline', cursor: 'pointer' }} onClick={() => setTab('data')}>Заполнить данные →</span>
                </div>
              )}

              <div style={{ fontSize: 11, fontWeight: 800, color: SUB, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
                Выберите шаблон
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {TEMPLATES.map(tpl => (
                  <motion.button key={tpl.id} whileTap={{ scale: 0.97 }}
                    onClick={() => buildDoc(tpl)}
                    style={{ padding: '14px', borderRadius: 14, background: CARD, border: `1px solid ${BORDER}`, color: TEXT, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(79,142,247,0.12)', border: `1px solid rgba(79,142,247,0.2)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>{tpl.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: TEXT }}>{tpl.name}</div>
                      <div style={{ fontSize: 10, color: SUB, marginTop: 3, lineHeight: 1.4 }}>{tpl.desc}</div>
                    </div>
                    <div style={{ color: ACCENT, fontSize: 18, flexShrink: 0 }}>→</div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ═══ RESULT: Filled document ═══ */}
          {tab === 'templates' && result && (
            <motion.div key="result" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

              {/* Extra fields if any missing */}
              {selectedTpl && selectedTpl.extras.some(k => !fields[k]) && (
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(9,9,15,0.98)', flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: AMBER, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                    ✏️ Дополнительные данные для этого документа
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {selectedTpl.extras.filter(k => !fields[k]).map(k => (
                      <input key={k} value={fields[k]} onChange={e => { setField(k, e.target.value); setResult(selectedTpl.build({ ...fields, [k]: e.target.value })); }}
                        placeholder={FIELD_LABELS[k] ?? k}
                        style={{ padding: '9px 12px', borderRadius: 10, background: CARD2, border: `1px solid rgba(251,191,36,0.4)`, color: TEXT, fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
                    ))}
                  </div>
                </div>
              )}

              {/* Document text */}
              <div style={{ flex: 1, overflowY: 'auto', background: '#fff', padding: '0' }}>
                <pre style={{ fontFamily: 'Arial,sans-serif', fontSize: 14, lineHeight: 1.9, color: '#111', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: '0', padding: '28px 24px' }}>
                  {result}
                </pre>
              </div>

              {/* Action bar */}
              <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: `1px solid ${BORDER}`, background: 'rgba(9,9,15,0.98)', flexShrink: 0 }}>
                <motion.button whileTap={{ scale: 0.95 }} onClick={printResult}
                  style={{ flex: 1, padding: '12px', borderRadius: 12, background: ACCENT, border: 'none', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  🖨️ Распечатать
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={shareResult}
                  style={{ flex: 1, padding: '12px', borderRadius: 12, background: CARD, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  📤 Поделиться
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={async () => { await navigator.clipboard.writeText(result ?? ''); showToast('📋 Скопировано'); }}
                  style={{ width: 46, padding: '12px', borderRadius: 12, background: CARD, border: `1px solid ${BORDER}`, color: TEXT, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  📋
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ═══ TAB: ЧИТАЛКА ═══ */}
          {tab === 'reader' && !rViewing && (
            <motion.div key="reader-home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ height: '100%', overflowY: 'auto', padding: '16px 16px 120px' }}>

              {/* Scan buttons in reader */}
              <div style={{ background: 'linear-gradient(135deg,#0d1b38,#0d2230)', borderRadius: 16, padding: 14, marginBottom: 16, border: `1px solid rgba(79,142,247,0.2)`, position: 'relative', overflow: 'hidden' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: ACCENT, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>📷 Сканер</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => scanColorRef.current?.click()}
                    style={{ padding: '10px 6px', borderRadius: 12, background: ACCENT, border: 'none', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    🎨 Цветной
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.95 }}
                    onClick={() => scanBwRef.current?.click()}
                    style={{ padding: '10px 6px', borderRadius: 12, background: 'transparent', border: `1.5px solid ${ACCENT}`, color: ACCENT, fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                    🖤 Ч/Б
                  </motion.button>
                </div>
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={() => fileRef.current?.click()}
                style={{ width: '100%', padding: 16, borderRadius: 16, background: CARD, border: `2px dashed ${BORDER}`, color: TEXT, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, boxSizing: 'border-box' }}>
                <span style={{ fontSize: 24 }}>📂</span>
                <div style={{ textAlign: 'left' }}>
                  <div>Открыть файл</div>
                  <div style={{ fontSize: 10, color: SUB, fontWeight: 500, marginTop: 2 }}>PDF · DOCX · TXT · XLSX · CSV · JPG · PNG</div>
                </div>
              </motion.button>

              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
                {['PDF','DOCX','TXT','XLSX','CSV','JPG','PNG'].map(f => (
                  <div key={f} style={{ padding: '3px 9px', borderRadius: 20, background: 'rgba(79,142,247,0.1)', color: ACCENT, fontSize: 10, fontWeight: 700, border: `1px solid rgba(79,142,247,0.2)` }}>{f}</div>
                ))}
              </div>

              {rError && <div style={{ padding: '12px', borderRadius: 12, background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.25)', color: '#ff6060', fontSize: 12, marginBottom: 14 }}>⚠️ {rError}</div>}

              {recentDocs.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 800, color: SUB, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>🕐 Последние</div>
                  {recentDocs.map(d => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 14, background: CARD, border: `1px solid ${BORDER}`, marginBottom: 8 }}>
                      <div style={{ fontSize: 22 }}>{kindIcon(d.kind)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                        <div style={{ fontSize: 10, color: SUB, marginTop: 1 }}>{kindLabel(d.kind)} · {fmtSize(d.size)} · {fmtDate(d.date)}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </motion.div>
          )}

          {/* Reader: viewer */}
          {tab === 'reader' && rViewing && (
            <motion.div key="reader-view" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {rDocKind === 'pdf' && rPdfUrl && <iframe ref={iframeRef} src={rPdfUrl} style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }} title={rDocName} />}
              {rDocKind === 'docx' && rDocHtml && <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}><div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px', fontFamily: 'Arial,sans-serif', fontSize: 14, lineHeight: 1.7, color: '#111' }} dangerouslySetInnerHTML={{ __html: rDocHtml }} /></div>}
              {rDocKind === 'text' && rDocText !== null && <div style={{ flex: 1, overflowY: 'auto', background: '#fafafa', padding: 24 }}><pre style={{ fontFamily: '"Courier New",monospace', fontSize: 13, lineHeight: 1.7, color: '#111', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>{rDocText}</pre></div>}
              {(rDocKind === 'image' || rDocKind === 'scan') && rImageUrl && <div style={{ flex: 1, overflow: 'auto', background: '#111', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 16 }}><img src={rImageUrl} alt={rDocName} style={{ transform: `scale(${rImgZoom})`, transformOrigin: 'top center', maxWidth: '100%', height: 'auto', transition: 'transform 0.2s' }} /></div>}
              {(rDocKind === 'xlsx' || rDocKind === 'csv') && rDocTable && (
                <div style={{ flex: 1, overflow: 'auto', background: '#fff' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12, fontFamily: 'Arial,sans-serif' }}>
                    <thead><tr>{(rDocTable[0] as string[]).map((h,i) => <th key={i} style={{ border: '1px solid #d0d0d0', padding: '7px 10px', background: '#f5f5f5', fontWeight: 700, color: '#222', whiteSpace: 'nowrap', position: 'sticky', top: 0 }}>{String(h)}</th>)}</tr></thead>
                    <tbody>{(rDocTable.slice(1) as string[][]).map((row,ri) => <tr key={ri} style={{ background: ri%2===0?'#fff':'#f9f9f9' }}>{row.map((cell,ci) => <td key={ci} style={{ border: '1px solid #e8e8e8', padding: '6px 10px', color: '#222' }}>{String(cell??'')}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
              {rLoading && <div style={{ position: 'absolute', inset: 0, background: 'rgba(9,9,15,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} style={{ width: 42, height: 42, borderRadius: '50%', border: `3px solid rgba(79,142,247,0.2)`, borderTopColor: ACCENT }} /><div style={{ color: TEXT, fontSize: 13, fontWeight: 700 }}>Открываю…</div></div>}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
            style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: 'rgba(20,30,60,0.97)', border: `1px solid ${BORDER}`, color: TEXT, padding: '10px 20px', borderRadius: 40, fontSize: 13, fontWeight: 700, zIndex: 999, whiteSpace: 'nowrap', backdropFilter: 'blur(10px)' }}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden inputs */}
      <input ref={scanColorRef} type="file" accept="image/*" capture="environment"
        onChange={e => { const f = e.target.files?.[0]; if (f) { if (tab==='reader') { handleScan(f,'color').then(() => setRViewing(false)); processReaderFile(f); } else handleScan(f,'color'); } e.target.value=''; }} style={{ display: 'none' }} />
      <input ref={scanBwRef} type="file" accept="image/*" capture="environment"
        onChange={e => { const f = e.target.files?.[0]; if (f) { if (tab==='reader') { processReaderFile(f); } else handleScan(f,'bw'); } e.target.value=''; }} style={{ display: 'none' }} />
      <input ref={photoRef} type="file" accept="image/*"
        onChange={e => { const f = e.target.files?.[0]; if (f) handlePhoto(f); e.target.value=''; }} style={{ display: 'none' }} />
      <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.md,.csv,.xlsx,.xls,.jpg,.jpeg,.png,.gif,.webp"
        onChange={e => { const f = e.target.files?.[0]; if (f) processReaderFile(f); e.target.value=''; }} style={{ display: 'none' }} />
    </div>
  );
}
