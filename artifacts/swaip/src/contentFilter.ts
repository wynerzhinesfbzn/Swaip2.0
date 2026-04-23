/* ═══════════════════════════════════════════════════════
   CONTENT GUARD — фильтр запрещённого контента SWAIP
   Проверяет текст перед публикацией на любой платформе.
   Возвращает { ok: true } или { ok: false, reason: string }
═══════════════════════════════════════════════════════ */

interface FilterResult {
  ok: boolean;
  reason?: string;
  category?: 'adult' | 'drugs' | 'violence' | 'illegal';
}

/* ── Паттерны по категориям ── */

const ADULT_PATTERNS = [
  /* Русский */
  /порн/i, /эротик/i, /секс-ролик/i, /онлифанс/i, /onlyfans/i,
  /голый\s+фото/i, /голое\s+фото/i, /интим\s+фото/i, /интимное\s+фото/i,
  /обнажён/i, /18\+\s*видео/i, /xxx/i, /hentai/i, /хентай/i,
  /эскорт\s+услуги/i, /проститут/i, /шлюх/i, /лолит/i, /педофил/i,
  /детская\s+порнограф/i, /child\s*porn/i, /cp\s+porn/i, /csam/i,
  /nude\s+teen/i, /underage\s+sex/i, /bestiality/i, /зоофил/i,
];

const DRUG_PATTERNS = [
  /* Русский */
  /купить\s+наркотик/i, /наркотик[и|ов]?\s+(?:продаю|куплю|заказ|доставк)/i,
  /кокаин/i, /героин/i, /метамфетамин/i, /мефедрон/i, /экстази/i,
  /курительн[ые]\s+смес/i, /соль\s+наркотик/i, /амфетамин/i,
  /кристалл[ы]?\s+(?:продаю|куплю|мет)/i, /спайс\s+(?:купить|продать|заказ)/i,
  /марихуан[а|у]?\s+(?:купить|продать|доставк)/i,
  /гашиш\s+(?:купить|продать)/i, /lsd\s+(?:купить|продать)/i,
  /закладк[а|и]?\s+нарк/i, /телеграм\s+нарк/i,
  /* English */
  /buy\s+cocaine/i, /sell\s+heroin/i, /meth\s+for\s+sale/i,
  /drug\s+dealer/i, /score\s+drugs/i, /mdma\s+for\s+sale/i,
  /crystal\s+meth\s+(?:buy|sell)/i, /fentanyl\s+(?:buy|sell)/i,
  /darknet\s+drugs/i, /drug\s+stash/i,
];

const VIOLENCE_ILLEGAL_PATTERNS = [
  /* Терроризм */
  /террористическ/i, /взорвать\s+(?:школу|здание|метро|автобус)/i,
  /теракт\s+(?:план|готов|совершить)/i, /джихад\s+(?:объявляю|вступаю)/i,
  /isis|игил|даеш/i, /bomb\s+threat/i, /terroris[mt]/i,
  /* Оружие (незаконный оборот) */
  /купить\s+(?:пистолет|оружие|автомат|нож)\s+без\s+документов/i,
  /нелегальн[оы][ей]?\s+оружи/i, /illegal\s+(?:weapon|gun|firearm)/i,
  /* Насилие / угрозы */
  /убью\s+(?:тебя|вас|его|её)/i, /хочу\s+убить\s+(?:себя|людей)/i,
  /план\s+убийства/i, /заказать\s+убийство/i, /hire\s+a\s+(?:hitman|killer)/i,
  /murder\s+for\s+hire/i,
  /* Дискриминация (разжигание ненависти) */
  /смерть\s+(?:евреям|черным|нграм|геям|мусульманам)/i,
  /kill\s+all\s+(?:jews|blacks|muslims|gays)/i,
  /genocide\s+(?:of|against)/i, /genocide\s+(?:jews|blacks)/i,
  /* Мошенничество / незаконная торговля */
  /продаю\s+(?:паспорт|документы)\s+(?:поддельн|фейк)/i,
  /купить\s+(?:поддельн|фальшив)\s+(?:паспорт|права|диплом)/i,
  /fake\s+(?:passport|id|documents)\s+for\s+sale/i,
  /carding\s+(?:shop|tutorial)/i,
  /* Суицид-контент */
  /как\s+(?:правильно\s+)?(?:покончить|убить\s+себя|вздернуться|застрелиться)/i,
  /suicide\s+(?:method|how\s+to|tutorial)/i, /how\s+to\s+kill\s+yourself/i,
];

/* ── Единая точка входа ── */
export function checkContent(text: string): FilterResult {
  if (!text || !text.trim()) return { ok: true };

  const t = text;

  for (const re of ADULT_PATTERNS) {
    if (re.test(t)) {
      return {
        ok: false,
        category: 'adult',
        reason: 'Обнаружен контент для взрослых или сексуальный контент. Публикация заблокирована.',
      };
    }
  }

  for (const re of DRUG_PATTERNS) {
    if (re.test(t)) {
      return {
        ok: false,
        category: 'drugs',
        reason: 'Обнаружен контент, связанный с наркотиками или запрещёнными веществами. Публикация заблокирована.',
      };
    }
  }

  for (const re of VIOLENCE_ILLEGAL_PATTERNS) {
    if (re.test(t)) {
      return {
        ok: false,
        category: 'illegal',
        reason: 'Обнаружен контент, связанный с незаконными действиями, насилием или экстремизмом. Публикация заблокирована.',
      };
    }
  }

  return { ok: true };
}

/* ── Хелпер: собрать весь текст из поста ── */
export function collectPostText(...parts: (string | undefined | null)[]): string {
  return parts.filter(Boolean).join(' ');
}
