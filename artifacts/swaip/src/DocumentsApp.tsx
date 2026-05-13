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
  fullName: string; passportSeries: string; passportNumber: string;
  passportIssuedBy: string; passportIssuedDate: string;
  birthDate: string; birthPlace: string; regAddress: string;
  phone: string; inn: string; snils: string; city: string; today: string;
  amount: string; amountWords: string; returnDate: string;
  counterFullName: string; counterPassport: string; counterAddress: string;
  subject: string; rentAddress: string; rentAmount: string; rentPeriod: string;
  carBrand: string; carYear: string; carVin: string; carPrice: string;
  workDesc: string; workPrice: string; workDeadline: string;
  position: string; employer: string; dismissDate: string;
  claimSubject: string; claimAmount: string;
  childName: string; childBirthDate: string; childPassport: string;
  courtName: string; defendant: string; defendantAddress: string;
  claimText: string; evidenceList: string;
  orgName: string; orgAddress: string; orgInn: string;
  giftObject: string; apartmentAddress: string; apartmentArea: string; apartmentPrice: string;
  vacationStart: string; vacationEnd: string; vacationDays: string;
  complaintText: string; requestText: string;
  doctorName: string; hospitalName: string;
  bankName: string; contractNumber: string; contractDate: string;
  propertyAddress: string; sharePercent: string;
  maternityAmount: string; pensionType: string;
  vehiclePlate: string; accidentDate: string;
  leaveType: string; leaveStart: string;
}

const EMPTY: DocFields = {
  fullName:'', passportSeries:'', passportNumber:'', passportIssuedBy:'',
  passportIssuedDate:'', birthDate:'', birthPlace:'', regAddress:'',
  phone:'', inn:'', snils:'', city:'', today: new Date().toLocaleDateString('ru-RU'),
  amount:'', amountWords:'', returnDate:'', counterFullName:'', counterPassport:'',
  counterAddress:'', subject:'', rentAddress:'', rentAmount:'', rentPeriod:'',
  carBrand:'', carYear:'', carVin:'', carPrice:'', workDesc:'', workPrice:'',
  workDeadline:'', position:'', employer:'', dismissDate:'', claimSubject:'', claimAmount:'',
  childName:'', childBirthDate:'', childPassport:'',
  courtName:'', defendant:'', defendantAddress:'', claimText:'', evidenceList:'',
  orgName:'', orgAddress:'', orgInn:'',
  giftObject:'', apartmentAddress:'', apartmentArea:'', apartmentPrice:'',
  vacationStart:'', vacationEnd:'', vacationDays:'',
  complaintText:'', requestText:'',
  doctorName:'', hospitalName:'',
  bankName:'', contractNumber:'', contractDate:'',
  propertyAddress:'', sharePercent:'',
  maternityAmount:'', pensionType:'',
  vehiclePlate:'', accidentDate:'',
  leaveType:'', leaveStart:'',
};

const FL: Partial<Record<keyof DocFields, string>> = {
  fullName:'ФИО полностью', passportSeries:'Серия паспорта', passportNumber:'Номер паспорта',
  passportIssuedBy:'Кем выдан', passportIssuedDate:'Дата выдачи',
  birthDate:'Дата рождения', birthPlace:'Место рождения', regAddress:'Адрес регистрации',
  phone:'Телефон', inn:'ИНН', snils:'СНИЛС', city:'Город', today:'Дата',
  amount:'Сумма (цифрами)', amountWords:'Сумма (прописью)', returnDate:'Срок возврата',
  counterFullName:'ФИО второй стороны', counterPassport:'Паспорт второй стороны',
  counterAddress:'Адрес второй стороны', subject:'Предмет/описание',
  rentAddress:'Адрес квартиры', rentAmount:'Аренд. плата (руб/мес)', rentPeriod:'Срок аренды',
  carBrand:'Марка/модель авто', carYear:'Год выпуска', carVin:'VIN-номер', carPrice:'Цена авто',
  workDesc:'Описание работ/услуг', workPrice:'Стоимость', workDeadline:'Срок выполнения',
  position:'Должность', employer:'Организация (работодатель)', dismissDate:'Дата увольнения',
  claimSubject:'Предмет претензии', claimAmount:'Сумма требования',
  childName:'ФИО ребёнка', childBirthDate:'Дата рождения ребёнка', childPassport:'Свидетельство о рождении / паспорт ребёнка',
  courtName:'Наименование суда', defendant:'ФИО / наименование ответчика',
  defendantAddress:'Адрес ответчика', claimText:'Суть требования', evidenceList:'Перечень доказательств',
  orgName:'Наименование организации', orgAddress:'Адрес организации', orgInn:'ИНН организации',
  giftObject:'Предмет дарения', apartmentAddress:'Адрес квартиры',
  apartmentArea:'Площадь (кв.м)', apartmentPrice:'Стоимость квартиры',
  vacationStart:'Дата начала отпуска', vacationEnd:'Дата окончания', vacationDays:'Кол-во дней',
  complaintText:'Текст жалобы', requestText:'Ваши требования',
  doctorName:'ФИО врача', hospitalName:'Наименование больницы/поликлиники',
  bankName:'Наименование банка', contractNumber:'Номер договора', contractDate:'Дата договора',
  propertyAddress:'Адрес объекта', sharePercent:'Доля (%)',
  maternityAmount:'Сумма маткапитала', pensionType:'Вид пенсии',
  vehiclePlate:'Гос. номер ТС', accidentDate:'Дата ДТП',
  leaveType:'Вид отпуска', leaveStart:'Дата начала',
};

/* ─── Template ────────────────────────────────────────────── */
interface Template {
  id: string; icon: string; name: string; desc: string; category: string;
  extras: (keyof DocFields)[];
  build: (f: DocFields) => string;
}

const fill = (tpl: string, f: DocFields) =>
  tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => (f as unknown as Record<string,string>)[k] || `[${FL[k as keyof DocFields] ?? k}]`);

/* ─── ALL TEMPLATES ───────────────────────────────────────── */
const TEMPLATES: Template[] = [
  /* ── РАСПИСКИ И ЗАЙМЫ ── */
  { id:'receipt', icon:'🤝', category:'Расписки и займы', name:'Расписка о получении денег', desc:'Подтверждение получения денежных средств',
    extras:['amount','amountWords','returnDate','counterFullName'],
    build: f => fill(`РАСПИСКА

Я, {{fullName}}, {{birthDate}} г.р., паспорт серия {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}}, зарегистрированный(ая): {{regAddress}},

получил(а) от {{counterFullName}} денежные средства в размере {{amount}} ({{amountWords}}) рублей.

Обязуюсь вернуть указанную сумму в срок до {{returnDate}}.

г. {{city}}, {{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'loan', icon:'💰', category:'Расписки и займы', name:'Договор займа денег', desc:'Передача денег в долг с условиями возврата',
    extras:['amount','amountWords','returnDate','counterFullName','counterPassport','counterAddress'],
    build: f => fill(`ДОГОВОР ЗАЙМА
г. {{city}}, {{today}}

{{fullName}}, паспорт серия {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}}, адрес: {{regAddress}}, — «Займодавец»,

и {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}}, — «Заёмщик»,

заключили настоящий договор:

1. Займодавец передаёт Заёмщику {{amount}} ({{amountWords}}) рублей.
2. Заёмщик обязуется возвратить сумму в срок до {{returnDate}}.
3. Займ беспроцентный.
4. При просрочке — пеня 0,1% в день.

ЗАЙМОДАВЕЦ: {{fullName}} _____________
ЗАЁМЩИК: {{counterFullName}} _____________`, f) },

  /* ── ДОВЕРЕННОСТИ ── */
  { id:'poa_gen', icon:'📋', category:'Доверенности', name:'Генеральная доверенность', desc:'Полные полномочия на представление интересов',
    extras:['counterFullName','counterPassport','counterAddress','subject'],
    build: f => fill(`ДОВЕРЕННОСТЬ
г. {{city}}, {{today}}

Я, {{fullName}}, {{birthDate}} г.р., паспорт серия {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}}, адрес: {{regAddress}},

уполномочиваю {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}},

{{subject}}

Доверенность выдана сроком на 3 года, без права передоверия.

_________________________ / {{fullName}} /`, f) },

  { id:'poa_car', icon:'🚗', category:'Доверенности', name:'Доверенность на авто', desc:'Право управления и распоряжения транспортным средством',
    extras:['counterFullName','counterPassport','carBrand','carYear','vehiclePlate','carVin'],
    build: f => fill(`ДОВЕРЕННОСТЬ НА УПРАВЛЕНИЕ ТРАНСПОРТНЫМ СРЕДСТВОМ
г. {{city}}, {{today}}

Я, {{fullName}}, паспорт серия {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}},

доверяю {{counterFullName}}, паспорт {{counterPassport}},

управлять принадлежащим мне транспортным средством:
Марка/модель: {{carBrand}}, год выпуска: {{carYear}}, г/н: {{vehiclePlate}}, VIN: {{carVin}},

с правом управления, постановки на учёт, прохождения техосмотра.

Доверенность выдана сроком на 1 год.

_________________________ / {{fullName}} /`, f) },

  { id:'poa_apt', icon:'🏠', category:'Доверенности', name:'Доверенность на квартиру', desc:'Право продажи/оформления недвижимости',
    extras:['counterFullName','counterPassport','apartmentAddress'],
    build: f => fill(`ДОВЕРЕННОСТЬ НА РАСПОРЯЖЕНИЕ НЕДВИЖИМОСТЬЮ
г. {{city}}, {{today}}

Я, {{fullName}}, паспорт серия {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}}, адрес: {{regAddress}},

уполномочиваю {{counterFullName}}, паспорт {{counterPassport}},

представлять мои интересы по вопросам, связанным с квартирой, расположенной по адресу: {{apartmentAddress}}, в том числе подписывать договоры, получать документы, сдавать на регистрацию.

Доверенность выдана сроком на 1 год, без права передоверия.

_________________________ / {{fullName}} /`, f) },

  /* ── НЕДВИЖИМОСТЬ ── */
  { id:'sale_apt', icon:'🏢', category:'Недвижимость', name:'Договор купли-продажи квартиры', desc:'Продажа жилого помещения между физическими лицами',
    extras:['apartmentAddress','apartmentArea','apartmentPrice','amountWords','counterFullName','counterPassport','counterAddress'],
    build: f => fill(`ДОГОВОР КУПЛИ-ПРОДАЖИ КВАРТИРЫ
г. {{city}}, {{today}}

{{fullName}}, паспорт серия {{passportSeries}} № {{passportNumber}}, адрес: {{regAddress}}, — «Продавец»,
и {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}}, — «Покупатель»,

заключили настоящий договор:
1. Продавец продаёт квартиру по адресу: {{apartmentAddress}}, площадью {{apartmentArea}} кв.м.
2. Цена: {{apartmentPrice}} ({{amountWords}}) рублей.
3. Квартира свободна от прав третьих лиц, обременений нет.
4. Передача квартиры — по акту приёма-передачи.
5. Расходы на гос. регистрацию — за счёт Покупателя.

ПРОДАВЕЦ: {{fullName}} _____________
ПОКУПАТЕЛЬ: {{counterFullName}} _____________`, f) },

  { id:'rent', icon:'🏠', category:'Недвижимость', name:'Договор аренды квартиры', desc:'Сдача жилого помещения в найм',
    extras:['rentAddress','rentAmount','rentPeriod','counterFullName','counterPassport','counterAddress'],
    build: f => fill(`ДОГОВОР НАЙМА ЖИЛОГО ПОМЕЩЕНИЯ
г. {{city}}, {{today}}

{{fullName}}, паспорт серия {{passportSeries}} № {{passportNumber}}, адрес: {{regAddress}}, — «Наймодатель»,
и {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}}, — «Наниматель»,

1. Наймодатель предоставляет помещение по адресу: {{rentAddress}}.
2. Плата: {{rentAmount}} руб./мес.
3. Срок: {{rentPeriod}}.
4. Наниматель обязан своевременно вносить плату и содержать помещение в порядке.

НАЙМОДАТЕЛЬ: {{fullName}} _____________
НАНИМАТЕЛЬ: {{counterFullName}} _____________`, f) },

  { id:'gift', icon:'🎁', category:'Недвижимость', name:'Договор дарения', desc:'Безвозмездная передача имущества',
    extras:['giftObject','counterFullName','counterPassport','counterAddress'],
    build: f => fill(`ДОГОВОР ДАРЕНИЯ
г. {{city}}, {{today}}

{{fullName}}, паспорт серия {{passportSeries}} № {{passportNumber}}, адрес: {{regAddress}}, — «Даритель»,
и {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}}, — «Одаряемый»,

1. Даритель безвозмездно передаёт Одаряемому: {{giftObject}}.
2. Даритель гарантирует, что имущество не обременено правами третьих лиц.
3. Одаряемый принимает дар в состоянии, которое его удовлетворяет.

ДАРИТЕЛЬ: {{fullName}} _____________
ОДАРЯЕМЫЙ: {{counterFullName}} _____________`, f) },

  { id:'share_apt', icon:'📐', category:'Недвижимость', name:'Соглашение о долях в квартире', desc:'Определение долей в праве общей собственности',
    extras:['apartmentAddress','sharePercent','counterFullName','counterPassport'],
    build: f => fill(`СОГЛАШЕНИЕ ОБ ОПРЕДЕЛЕНИИ ДОЛЕЙ
г. {{city}}, {{today}}

{{fullName}}, паспорт серия {{passportSeries}} № {{passportNumber}}, адрес: {{regAddress}},
и {{counterFullName}}, паспорт {{counterPassport}},

являясь сособственниками квартиры по адресу: {{apartmentAddress}},

определили доли в праве общей собственности:
— {{fullName}}: {{sharePercent}}%
— {{counterFullName}}: ________%

_________________________ / {{fullName}} /
_________________________ / {{counterFullName}} /`, f) },

  /* ── ТРАНСПОРТ ── */
  { id:'sale_car', icon:'🚗', category:'Транспорт', name:'ДКП автомобиля', desc:'Продажа ТС между физическими лицами',
    extras:['carBrand','carYear','vehiclePlate','carVin','carPrice','amountWords','counterFullName','counterPassport','counterAddress'],
    build: f => fill(`ДОГОВОР КУПЛИ-ПРОДАЖИ ТРАНСПОРТНОГО СРЕДСТВА
г. {{city}}, {{today}}

{{fullName}}, паспорт серия {{passportSeries}} № {{passportNumber}}, адрес: {{regAddress}}, — «Продавец»,
и {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}}, — «Покупатель»,

1. ТС: {{carBrand}}, {{carYear}} г.в., г/н: {{vehiclePlate}}, VIN: {{carVin}}.
2. Цена: {{carPrice}} ({{amountWords}}) рублей.
3. ТС не заложено, не в угоне, не под арестом.
4. Расчёт — при подписании.

ПРОДАВЕЦ: {{fullName}} _____________
ПОКУПАТЕЛЬ: {{counterFullName}} _____________`, f) },

  { id:'osago_claim', icon:'💥', category:'Транспорт', name:'Претензия в страховую (ОСАГО/КАСКО)', desc:'Требование выплаты страхового возмещения',
    extras:['orgName','orgAddress','vehiclePlate','accidentDate','amount','contractNumber'],
    build: f => fill(`ПРЕТЕНЗИЯ
Директору {{orgName}}, {{orgAddress}}
От: {{fullName}}, {{regAddress}}, тел.: {{phone}}

{{today}}

В результате ДТП, произошедшего {{accidentDate}}, пострадало моё ТС г/н {{vehiclePlate}} по договору ОСАГО/КАСКО № {{contractNumber}}.

Страховая компания не произвела выплату (или выплатила неполную сумму) в размере {{amount}} рублей.

На основании ФЗ «Об ОСАГО», ст. 16.1, прошу в течение 10 дней выплатить страховое возмещение в указанном размере.

В противном случае обращусь в суд с требованием взыскать сумму, штраф 50%, неустойку и судебные расходы.

_________________________ / {{fullName}} /`, f) },

  /* ── ТРУДОВЫЕ ── */
  { id:'dismiss', icon:'🚪', category:'Трудовые', name:'Заявление об увольнении', desc:'Увольнение по собственному желанию',
    extras:['employer','position','dismissDate'],
    build: f => fill(`Директору / Руководителю {{employer}}
от {{fullName}}, должность: {{position}}

ЗАЯВЛЕНИЕ

Прошу уволить меня по собственному желанию {{dismissDate}} (ст. 80 ТК РФ).

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'vacation', icon:'🌴', category:'Трудовые', name:'Заявление на отпуск', desc:'Ежегодный оплачиваемый или иной отпуск',
    extras:['employer','position','leaveType','leaveStart','vacationDays'],
    build: f => fill(`Директору / Руководителю {{employer}}
от {{fullName}}, должность: {{position}}

ЗАЯВЛЕНИЕ

Прошу предоставить мне {{leaveType}} отпуск с {{leaveStart}} продолжительностью {{vacationDays}} календарных дней.

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'maternity_leave', icon:'👶', category:'Трудовые', name:'Заявление на декретный отпуск', desc:'Отпуск по беременности и родам / по уходу за ребёнком',
    extras:['employer','position','childName','childBirthDate','leaveStart'],
    build: f => fill(`Директору / Руководителю {{employer}}
от {{fullName}}, должность: {{position}}

ЗАЯВЛЕНИЕ о предоставлении отпуска по уходу за ребёнком

Прошу предоставить мне отпуск по уходу за ребёнком {{childName}}, {{childBirthDate}} г.р., с {{leaveStart}} до достижения ребёнком возраста 3 лет, а также назначить ежемесячное пособие по уходу за ребёнком до 1,5 лет.

Прилагаю: свидетельство о рождении ребёнка.

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'labor_complaint', icon:'⚠️', category:'Трудовые', name:'Жалоба в трудовую инспекцию', desc:'ГИТ: нарушение трудовых прав работодателем',
    extras:['employer','orgAddress','position','complaintText','requestText'],
    build: f => fill(`В Государственную инспекцию труда
От: {{fullName}}, {{regAddress}}, тел.: {{phone}}
Работодатель: {{employer}}, {{orgAddress}}

ЖАЛОБА

Я работаю (работал(а)) в {{employer}} на должности {{position}}.

{{complaintText}}

На основании ст. 356 ТК РФ прошу:
{{requestText}}

Приложение: документы, подтверждающие изложенные факты.

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'labor_contract', icon:'📃', category:'Трудовые', name:'Трудовой договор (ИП-работник)', desc:'ИП нанимает сотрудника',
    extras:['orgName','orgInn','counterFullName','counterPassport','counterAddress','position','amount','workDeadline'],
    build: f => fill(`ТРУДОВОЙ ДОГОВОР № ___
г. {{city}}, {{today}}

ИП {{fullName}}, ИНН {{inn}}, — «Работодатель»,
и {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}}, — «Работник»,

1. Работник принимается на должность: {{position}}.
2. Место работы: {{city}}.
3. Дата начала: {{workDeadline}}.
4. Оклад: {{amount}} руб./мес.
5. Режим работы: пн–пт, 09:00–18:00.
6. Испытательный срок: 3 месяца.

РАБОТОДАТЕЛЬ: ИП {{fullName}} _____________
РАБОТНИК: {{counterFullName}} _____________`, f) },

  /* ── СЕМЬЯ И ДЕТИ ── */
  { id:'matcap', icon:'👨‍👩‍👧', category:'Семья и дети', name:'Заявление на маткапитал (СФР)', desc:'Заявление о распоряжении средствами МСК',
    extras:['childName','childBirthDate','childPassport','maternityAmount','subject'],
    build: f => fill(`В Социальный фонд России (СФР)
От: {{fullName}}, СНИЛС: {{snils}}
{{regAddress}}, тел.: {{phone}}

ЗАЯВЛЕНИЕ о распоряжении средствами (частью средств) материнского (семейного) капитала

Прошу направить средства материнского (семейного) капитала в размере {{maternityAmount}} рублей на:
{{subject}}

Сведения о ребёнке, с рождением которого возникло право на МСК:
ФИО ребёнка: {{childName}}, дата рождения: {{childBirthDate}}, {{childPassport}}.

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'alimony', icon:'💔', category:'Семья и дети', name:'Исковое заявление на алименты', desc:'Взыскание алиментов на ребёнка',
    extras:['courtName','counterFullName','counterAddress','childName','childBirthDate','amount'],
    build: f => fill(`В {{courtName}}
Истец: {{fullName}}, {{regAddress}}, тел.: {{phone}}
Ответчик: {{counterFullName}}, {{counterAddress}}

ИСКОВОЕ ЗАЯВЛЕНИЕ о взыскании алиментов

Прошу взыскать с {{counterFullName}} алименты на содержание ребёнка {{childName}}, {{childBirthDate}} г.р., в размере 1/4 заработка (или {{amount}} руб./мес.) ежемесячно, начиная с даты подачи заявления до совершеннолетия ребёнка.

Основание: ст. 80, 81 СК РФ.

Приложение: свидетельство о рождении ребёнка, свидетельство о браке/разводе, справка о доходах.

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'divorce', icon:'⚖️', category:'Семья и дети', name:'Исковое заявление о расторжении брака', desc:'Развод через суд',
    extras:['courtName','counterFullName','counterAddress','contractDate','childName'],
    build: f => fill(`В {{courtName}}
Истец: {{fullName}}, {{regAddress}}, тел.: {{phone}}
Ответчик: {{counterFullName}}, {{counterAddress}}

ИСКОВОЕ ЗАЯВЛЕНИЕ о расторжении брака

Прошу расторгнуть брак, заключённый {{contractDate}} между мной и {{counterFullName}}.

Дальнейшее совместное проживание и сохранение семьи невозможны.
Споры о разделе имущества и детях: {{childName}} — проживает со мной.

Основание: ст. 21 СК РФ.

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'child_travel', icon:'✈️', category:'Семья и дети', name:'Согласие на выезд ребёнка за рубеж', desc:'Нотариально удостоверяемое согласие родителя',
    extras:['childName','childBirthDate','childPassport','counterFullName','subject'],
    build: f => fill(`СОГЛАСИЕ НА ВЫЕЗД НЕСОВЕРШЕННОЛЕТНЕГО РЕБЁНКА

г. {{city}}, {{today}}

Я, {{fullName}}, паспорт серия {{passportSeries}} № {{passportNumber}},

даю согласие на выезд за пределы Российской Федерации своего несовершеннолетнего ребёнка:
ФИО: {{childName}}, дата рождения: {{childBirthDate}}, {{childPassport}},

в сопровождении {{counterFullName}},
в страну(ы): {{subject}}.

Основание: ст. 20 ФЗ «О порядке выезда из РФ и въезда в РФ».

_________________________ / {{fullName}} /

(подпись удостоверена нотариусом)`, f) },

  { id:'spouse_consent', icon:'💍', category:'Семья и дети', name:'Согласие супруга на сделку', desc:'Нотариальное согласие на продажу/покупку',
    extras:['counterFullName','counterPassport','subject','giftObject'],
    build: f => fill(`СОГЛАСИЕ СУПРУГА(И) НА СОВЕРШЕНИЕ СДЕЛКИ

г. {{city}}, {{today}}

Я, {{fullName}}, паспорт серия {{passportSeries}} № {{passportNumber}},

даю своё согласие супруге(у) — {{counterFullName}}, паспорт {{counterPassport}},

на совершение сделки: {{subject}} в отношении: {{giftObject}}.

_________________________ / {{fullName}} /

(подпись удостоверена нотариусом)`, f) },

  /* ── ЖКХ ── */
  { id:'jkh_complaint', icon:'🏗️', category:'ЖКХ', name:'Жалоба на управляющую компанию', desc:'Нарушения содержания жилого фонда',
    extras:['orgName','orgAddress','complaintText','requestText'],
    build: f => fill(`В Государственную жилищную инспекцию / {{orgName}}
{{orgAddress}}
От: {{fullName}}, {{regAddress}}, тел.: {{phone}}

ЖАЛОБА

{{complaintText}}

На основании ЖК РФ и Правил содержания общего имущества прошу:
{{requestText}}

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'jkh_recalc', icon:'💧', category:'ЖКХ', name:'Заявление о перерасчёте ЖКУ', desc:'Перерасчёт платы за период отсутствия или некачественные услуги',
    extras:['orgName','complaintText','vacationStart','vacationEnd'],
    build: f => fill(`Руководителю {{orgName}}
От: {{fullName}}, {{regAddress}}

ЗАЯВЛЕНИЕ о перерасчёте платы за коммунальные услуги

Прошу произвести перерасчёт платы за коммунальные услуги за период с {{vacationStart}} по {{vacationEnd}}.

Основание: {{complaintText}} (п. 86, 90 Правил № 354).

Прилагаю: документы, подтверждающие отсутствие / некачественное оказание услуг.

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'ddu_claim', icon:'🏚️', category:'ЖКХ', name:'Претензия застройщику по ДДУ', desc:'Нарушение сроков / качества строительства',
    extras:['orgName','orgAddress','contractNumber','contractDate','apartmentAddress','amount','complaintText'],
    build: f => fill(`Директору {{orgName}}, {{orgAddress}}
От: {{fullName}}, {{regAddress}}, тел.: {{phone}}

ПРЕТЕНЗИЯ

Между мной и {{orgName}} заключён ДДУ № {{contractNumber}} от {{contractDate}} на квартиру по адресу: {{apartmentAddress}}.

{{complaintText}}

На основании ФЗ № 214-ФЗ, ст. 6, 7 прошу в течение 10 рабочих дней:
— выплатить неустойку/устранить недостатки на сумму {{amount}} рублей.

При неудовлетворении претензии обращусь в суд.

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'privatize', icon:'🏠', category:'ЖКХ', name:'Заявление о приватизации жилья', desc:'Передача муниципального жилья в собственность',
    extras:['orgName','rentAddress'],
    build: f => fill(`В {{orgName}} / Администрацию муниципального образования
От: {{fullName}}, паспорт серия {{passportSeries}} № {{passportNumber}}, адрес: {{regAddress}}

ЗАЯВЛЕНИЕ о приватизации жилого помещения

Прошу передать в мою собственность в порядке приватизации жилое помещение, расположенное по адресу: {{rentAddress}}, которое я занимаю на основании договора социального найма.

Основание: Закон РФ «О приватизации жилищного фонда» от 04.07.1991 № 1541-1.

Приложение: паспорт, договор соц. найма, технический паспорт, выписка из домовой книги.

{{today}}

_________________________ / {{fullName}} /`, f) },

  /* ── СУД И ИСКИ ── */
  { id:'claim_gen', icon:'⚖️', category:'Суд и иски', name:'Исковое заявление (общий шаблон)', desc:'Универсальный иск в мировой или районный суд',
    extras:['courtName','defendant','defendantAddress','claimText','claimAmount','evidenceList'],
    build: f => fill(`В {{courtName}}
Истец: {{fullName}}, {{regAddress}}, тел.: {{phone}}
Ответчик: {{defendant}}, {{defendantAddress}}
Цена иска: {{claimAmount}} руб.

ИСКОВОЕ ЗАЯВЛЕНИЕ

{{claimText}}

На основании изложенного, руководствуясь ст. 131–132 ГПК РФ, прошу:
— взыскать с Ответчика в мою пользу {{claimAmount}} рублей;
— возместить судебные расходы.

Доказательства: {{evidenceList}}.

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'appeal', icon:'📜', category:'Суд и иски', name:'Апелляционная жалоба', desc:'Обжалование решения суда первой инстанции',
    extras:['courtName','defendant','claimText','claimAmount'],
    build: f => fill(`В {{courtName}}
Апеллянт: {{fullName}}, {{regAddress}}, тел.: {{phone}}

АПЕЛЛЯЦИОННАЯ ЖАЛОБА
на решение ________________ суда от «___» _______ 20__ г.

Обжалуемое решение: {{claimText}}

На основании ст. 320–322 ГПК РФ прошу:
— отменить решение суда и принять новое решение, удовлетворив требования на сумму {{claimAmount}} руб.

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'peace_agreement', icon:'🕊️', category:'Суд и иски', name:'Мировое соглашение', desc:'Урегулирование спора между сторонами',
    extras:['courtName','counterFullName','counterAddress','claimText','amount'],
    build: f => fill(`МИРОВОЕ СОГЛАШЕНИЕ
г. {{city}}, {{today}}

{{fullName}}, {{regAddress}}, — «Истец»,
и {{counterFullName}}, {{counterAddress}}, — «Ответчик»,

в целях устранения спора в суде {{courtName}} по делу о {{claimText}},

договорились:
1. Ответчик выплачивает Истцу {{amount}} рублей в срок до {{returnDate}}.
2. Истец отказывается от иска.
3. Стороны не имеют друг к другу претензий.

Истец: {{fullName}} _____________
Ответчик: {{counterFullName}} _____________`, f) },

  { id:'counter_claim', icon:'🔄', category:'Суд и иски', name:'Встречный иск', desc:'Иск ответчика против истца в рамках того же дела',
    extras:['courtName','counterFullName','claimText','claimAmount','evidenceList'],
    build: f => fill(`В {{courtName}}
Истец по встречному иску: {{fullName}}, {{regAddress}}
Ответчик по встречному иску: {{counterFullName}}
Цена встречного иска: {{claimAmount}} руб.

ВСТРЕЧНОЕ ИСКОВОЕ ЗАЯВЛЕНИЕ

{{claimText}}

Прошу взыскать с {{counterFullName}} {{claimAmount}} рублей.

Доказательства: {{evidenceList}}.

{{today}}

_________________________ / {{fullName}} /`, f) },

  /* ── ЖАЛОБЫ В ОРГАНЫ ── */
  { id:'prosecutor', icon:'🏛️', category:'Жалобы в органы', name:'Жалоба в прокуратуру', desc:'Обращение по факту нарушения закона',
    extras:['orgName','complaintText','requestText'],
    build: f => fill(`Прокурору _________________ района / города
От: {{fullName}}, {{regAddress}}, тел.: {{phone}}

ЖАЛОБА

{{complaintText}}

На основании ФЗ «О прокуратуре Российской Федерации» прошу:
{{requestText}}

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'rospotreb', icon:'🧪', category:'Жалобы в органы', name:'Жалоба в Роспотребнадзор', desc:'Нарушения прав потребителей, санитарных норм',
    extras:['orgName','orgAddress','complaintText','requestText'],
    build: f => fill(`В Управление Роспотребнадзора
От: {{fullName}}, {{regAddress}}, тел.: {{phone}}

ЖАЛОБА на действия {{orgName}}, {{orgAddress}}

{{complaintText}}

На основании ФЗ «О защите прав потребителей» прошу:
{{requestText}}

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'police', icon:'👮', category:'Жалобы в органы', name:'Заявление в полицию', desc:'Заявление о преступлении или правонарушении',
    extras:['complaintText','evidenceList'],
    build: f => fill(`Начальнику ОП МВД России по ____________
От: {{fullName}}, {{regAddress}}, тел.: {{phone}}

ЗАЯВЛЕНИЕ

Прошу возбудить уголовное/административное дело по следующим обстоятельствам:

{{complaintText}}

Доказательства: {{evidenceList}}.

Предупреждён об уголовной ответственности по ст. 306 УК РФ за заведомо ложный донос.

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'fns_complaint', icon:'🧾', category:'Жалобы в органы', name:'Жалоба в ФНС', desc:'Обжалование действий налогового органа',
    extras:['orgName','orgAddress','contractNumber','complaintText','requestText'],
    build: f => fill(`В УФНС России по ____________
(через {{orgName}}, {{orgAddress}})
От: {{fullName}}, ИНН: {{inn}}, {{regAddress}}

ЖАЛОБА

{{complaintText}}

На основании ст. 139 НК РФ прошу:
{{requestText}}

Прилагаю: документы, подтверждающие доводы жалобы.

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'gji', icon:'🏘️', category:'Жалобы в органы', name:'Жалоба в жилищную инспекцию (ГЖИ)', desc:'Нарушения в сфере ЖКХ, управление домом',
    extras:['orgName','orgAddress','complaintText','requestText','propertyAddress'],
    build: f => fill(`В Государственную жилищную инспекцию _____________
От: {{fullName}}, {{regAddress}}, тел.: {{phone}}

ЖАЛОБА на {{orgName}}, {{orgAddress}}

Адрес объекта: {{propertyAddress}}

{{complaintText}}

На основании ЖК РФ прошу провести проверку и:
{{requestText}}

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'mediator', icon:'🤝', category:'Жалобы в органы', name:'Обращение в финансовый омбудсмен', desc:'Финансовый уполномоченный: банки, страховые',
    extras:['orgName','contractNumber','contractDate','claimText','amount'],
    build: f => fill(`Уполномоченному по правам потребителей финансовых услуг
От: {{fullName}}, {{regAddress}}, тел.: {{phone}}

ОБРАЩЕНИЕ

Финансовая организация: {{orgName}}, договор № {{contractNumber}} от {{contractDate}}.

{{claimText}}

Прошу рассмотреть моё обращение и обязать организацию выплатить {{amount}} рублей.

{{today}}

_________________________ / {{fullName}} /`, f) },

  /* ── ФИНАНСЫ И НАЛОГИ ── */
  { id:'ndfl_return', icon:'💳', category:'Финансы и налоги', name:'Заявление на возврат НДФЛ (налоговый вычет)', desc:'Возврат подоходного налога: имущество, лечение, обучение',
    extras:['contractNumber','contractDate','amount','bankName','subject'],
    build: f => fill(`В ИФНС России № ___ по ____________
От: {{fullName}}, ИНН: {{inn}}, {{regAddress}}, тел.: {{phone}}

ЗАЯВЛЕНИЕ о возврате суммы излишне уплаченного налога

На основании ст. 78 НК РФ и п. 6 ст. 78 НК РФ прошу вернуть сумму излишне уплаченного НДФЛ в размере {{amount}} рублей в связи с: {{subject}}.

Банковские реквизиты для перечисления:
Банк: {{bankName}}, {{contractNumber}}, {{contractDate}}.

Приложение: декларация 3-НДФЛ, документы на вычет.

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'bank_claim', icon:'🏦', category:'Финансы и налоги', name:'Претензия в банк', desc:'Незаконные комиссии, отказ в выплате, ошибки',
    extras:['bankName','contractNumber','contractDate','complaintText','amount','requestText'],
    build: f => fill(`Руководителю {{bankName}}
От: {{fullName}}, {{regAddress}}, тел.: {{phone}}

ПРЕТЕНЗИЯ

Между мной и {{bankName}} заключён договор № {{contractNumber}} от {{contractDate}}.

{{complaintText}}

На основании ФЗ «О банках и банковской деятельности», ЗоЗПП прошу в течение 10 рабочих дней:
{{requestText}} (на сумму {{amount}} руб.)

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'bankruptcy', icon:'📉', category:'Финансы и налоги', name:'Заявление о личном банкротстве', desc:'Банкротство физического лица через АС или МФЦ',
    extras:['courtName','amount','evidenceList'],
    build: f => fill(`В {{courtName}}
Должник: {{fullName}}, ИНН: {{inn}}, СНИЛС: {{snils}}, {{regAddress}}, тел.: {{phone}}

ЗАЯВЛЕНИЕ о признании гражданина банкротом

Я имею задолженность перед кредиторами на сумму {{amount}} рублей, которую не способен погасить.

Обстоятельства: {{evidenceList}}.

На основании ст. 213.4 ФЗ «О несостоятельности (банкротстве)» прошу:
— признать меня банкротом;
— ввести процедуру реализации имущества.

{{today}}

_________________________ / {{fullName}} /`, f) },

  /* ── МЕДИЦИНА ── */
  { id:'med_complaint', icon:'🏥', category:'Медицина', name:'Жалоба на действия врача/больницы', desc:'Некачественная медицинская помощь',
    extras:['hospitalName','doctorName','complaintText','requestText'],
    build: f => fill(`Главному врачу {{hospitalName}} / В Министерство здравоохранения
От: {{fullName}}, {{regAddress}}, тел.: {{phone}}

ЖАЛОБА на действия {{doctorName}} ({{hospitalName}})

{{complaintText}}

На основании ФЗ «Об основах охраны здоровья граждан» (ст. 19, 20, 79) прошу:
{{requestText}}

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'med_consent', icon:'💊', category:'Медицина', name:'Согласие на медицинское вмешательство', desc:'Добровольное согласие пациента',
    extras:['hospitalName','doctorName','subject'],
    build: f => fill(`ИНФОРМИРОВАННОЕ ДОБРОВОЛЬНОЕ СОГЛАСИЕ
на медицинское вмешательство

Я, {{fullName}}, {{birthDate}} г.р., паспорт серия {{passportSeries}} № {{passportNumber}},

даю добровольное согласие на проведение мне: {{subject}}

в {{hospitalName}}, лечащим врачом — {{doctorName}}.

Мне разъяснены цель, характер и возможные последствия вмешательства.

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'med_refusal', icon:'🚫', category:'Медицина', name:'Отказ от медицинского вмешательства', desc:'Отказ пациента от лечения/процедуры',
    extras:['hospitalName','doctorName','subject'],
    build: f => fill(`ОТКАЗ ОТ МЕДИЦИНСКОГО ВМЕШАТЕЛЬСТВА

Я, {{fullName}}, {{birthDate}} г.р., паспорт серия {{passportSeries}} № {{passportNumber}},

отказываюсь от: {{subject}}

в {{hospitalName}}. Мне разъяснены возможные последствия отказа.

{{today}}

_________________________ / {{fullName}} /`, f) },

  /* ── ПОТРЕБИТЕЛЬ ── */
  { id:'claim_consumer', icon:'🛒', category:'Потребитель', name:'Претензия на некачественный товар', desc:'Возврат товара, замена, компенсация',
    extras:['orgName','orgAddress','claimSubject','amount','contractDate'],
    build: f => fill(`Директору {{orgName}}, {{orgAddress}}
От: {{fullName}}, {{regAddress}}, тел.: {{phone}}

ПРЕТЕНЗИЯ

{{contractDate}} я приобрёл(а) товар: {{claimSubject}} на сумму {{amount}} рублей.

В ходе использования выявлен(ы) следующий(е) недостаток(и): ________________________.

На основании ст. 18 ЗоЗПП РФ прошу в течение 10 дней:
— вернуть {{amount}} рублей / заменить товар / устранить недостатки.

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'service_claim', icon:'🔨', category:'Потребитель', name:'Претензия на некачественную услугу', desc:'Возврат оплаты за услугу ненадлежащего качества',
    extras:['orgName','orgAddress','subject','amount','contractDate','complaintText'],
    build: f => fill(`Директору {{orgName}}, {{orgAddress}}
От: {{fullName}}, {{regAddress}}, тел.: {{phone}}

ПРЕТЕНЗИЯ

{{contractDate}} между мной и {{orgName}} заключён договор оказания услуг: {{subject}} на сумму {{amount}} рублей.

{{complaintText}}

На основании ст. 29, 31 ЗоЗПП прошу в течение 10 дней вернуть {{amount}} рублей.

{{today}}

_________________________ / {{fullName}} /`, f) },

  /* ── ДОГОВОРЫ ── */
  { id:'contractor', icon:'🔧', category:'Договоры', name:'Договор подряда', desc:'Выполнение строительных или иных работ',
    extras:['workDesc','workPrice','amountWords','workDeadline','counterFullName','counterPassport','counterAddress'],
    build: f => fill(`ДОГОВОР ПОДРЯДА № ___
г. {{city}}, {{today}}

{{fullName}}, паспорт серия {{passportSeries}} № {{passportNumber}}, адрес: {{regAddress}}, — «Подрядчик»,
и {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}}, — «Заказчик»,

1. Подрядчик выполняет: {{workDesc}}.
2. Стоимость: {{workPrice}} ({{amountWords}}) руб.
3. Срок: {{workDeadline}}.
4. Оплата — после подписания акта приёмки.

ПОДРЯДЧИК: {{fullName}} _____________
ЗАКАЗЧИК: {{counterFullName}} _____________`, f) },

  { id:'service_contract', icon:'💼', category:'Договоры', name:'Договор оказания услуг', desc:'Консультации, обучение, иные услуги',
    extras:['subject','workPrice','amountWords','workDeadline','counterFullName','counterPassport','counterAddress'],
    build: f => fill(`ДОГОВОР ВОЗМЕЗДНОГО ОКАЗАНИЯ УСЛУГ № ___
г. {{city}}, {{today}}

{{fullName}}, — «Исполнитель»,
и {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}}, — «Заказчик»,

1. Исполнитель оказывает: {{subject}}.
2. Стоимость: {{workPrice}} ({{amountWords}}) руб.
3. Срок: {{workDeadline}}.
4. Оплата — в течение 3 дней после акта.

ИСПОЛНИТЕЛЬ: {{fullName}} _____________
ЗАКАЗЧИК: {{counterFullName}} _____________`, f) },

  { id:'nda', icon:'🔐', category:'Договоры', name:'Соглашение о конфиденциальности (NDA)', desc:'Защита коммерческой тайны между сторонами',
    extras:['counterFullName','counterPassport','counterAddress','subject','workDeadline'],
    build: f => fill(`СОГЛАШЕНИЕ О КОНФИДЕНЦИАЛЬНОСТИ
г. {{city}}, {{today}}

{{fullName}}, — «Сторона 1»,
и {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}}, — «Сторона 2»,

1. Стороны обязуются не разглашать конфиденциальную информацию, связанную с: {{subject}}.
2. Срок действия: {{workDeadline}}.
3. За нарушение — возмещение убытков в полном объёме.

Сторона 1: {{fullName}} _____________
Сторона 2: {{counterFullName}} _____________`, f) },

  { id:'supply', icon:'📦', category:'Договоры', name:'Договор поставки', desc:'Поставка товара от продавца к покупателю',
    extras:['subject','amount','amountWords','workDeadline','counterFullName','counterAddress','orgName'],
    build: f => fill(`ДОГОВОР ПОСТАВКИ № ___
г. {{city}}, {{today}}

{{fullName}} (ИП/ООО {{orgName}}), — «Поставщик»,
и {{counterFullName}}, адрес: {{counterAddress}}, — «Покупатель»,

1. Поставщик обязуется поставить: {{subject}}.
2. Цена: {{amount}} ({{amountWords}}) руб.
3. Срок поставки: {{workDeadline}}.
4. Оплата — в течение 5 дней с момента поставки.

ПОСТАВЩИК: {{fullName}} _____________
ПОКУПАТЕЛЬ: {{counterFullName}} _____________`, f) },

  /* ── ПРОЧЕЕ ── */
  { id:'pd_consent', icon:'🔒', category:'Прочее', name:'Согласие на обработку персональных данных', desc:'152-ФЗ: стандартное согласие на ОПД',
    extras:['employer'],
    build: f => fill(`СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ

Я, {{fullName}}, {{birthDate}} г.р., паспорт серия {{passportSeries}} № {{passportNumber}}, адрес: {{regAddress}},

в соответствии с ФЗ № 152-ФЗ «О персональных данных» даю согласие {{employer}} на обработку: ФИО, даты рождения, паспортных данных, адреса, телефона, e-mail.

Цель: исполнение договора. Срок: до отзыва согласия.

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'transfer_act', icon:'📋', category:'Прочее', name:'Акт приёма-передачи имущества', desc:'Передача имущества от одной стороны другой',
    extras:['subject','counterFullName','counterPassport'],
    build: f => fill(`АКТ ПРИЁМА-ПЕРЕДАЧИ ИМУЩЕСТВА
г. {{city}}, {{today}}

{{fullName}}, — «Передающая сторона»,
и {{counterFullName}}, паспорт {{counterPassport}}, — «Принимающая сторона»,

составили настоящий акт о том, что Передающая сторона передала, а Принимающая сторона приняла следующее имущество:
{{subject}}

Стороны претензий не имеют. Имущество передано в удовлетворительном состоянии.

Передал: {{fullName}} _____________
Принял: {{counterFullName}} _____________`, f) },

  { id:'explanation', icon:'📝', category:'Прочее', name:'Объяснительная записка', desc:'Объяснение на работе по факту нарушения/ситуации',
    extras:['employer','position','complaintText'],
    build: f => fill(`Директору / Руководителю {{employer}}
от {{fullName}}, должность: {{position}}

ОБЪЯСНИТЕЛЬНАЯ ЗАПИСКА

{{complaintText}}

{{today}}

_________________________ / {{fullName}} /`, f) },

  { id:'will', icon:'📜', category:'Прочее', name:'Завещание (шаблон)', desc:'Распоряжение имуществом на случай смерти (подлежит нотариальному удостоверению)',
    extras:['subject','counterFullName'],
    build: f => fill(`ЗАВЕЩАНИЕ

г. {{city}}, {{today}}

Я, {{fullName}}, {{birthDate}} г.р., паспорт серия {{passportSeries}} № {{passportNumber}}, адрес: {{regAddress}},

настоящим завещаю всё моё имущество, которое окажется мне принадлежащим к дню смерти, следующему лицу:

{{counterFullName}}

В частности: {{subject}}.

Завещание составлено в трёх экземплярах.

_________________________ / {{fullName}} /

(удостоверено нотариусом)`, f) },

  { id:'pension', icon:'👴', category:'Прочее', name:'Заявление в СФР о назначении пенсии', desc:'Назначение страховой / накопительной / социальной пенсии',
    extras:['pensionType'],
    build: f => fill(`В Социальный фонд России (СФР)
От: {{fullName}}, {{birthDate}} г.р., СНИЛС: {{snils}}, ИНН: {{inn}}, {{regAddress}}, тел.: {{phone}}

ЗАЯВЛЕНИЕ о назначении пенсии

Прошу назначить мне пенсию: {{pensionType}}.

Приложение: паспорт, СНИЛС, трудовая книжка (или сведения о трудовой деятельности), справки о заработке (при необходимости).

{{today}}

_________________________ / {{fullName}} /`, f) },
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
          for (let i = 0; i < d.length; i += 4) { const v = d[i]; const o = v>172?255:v<80?0:v; d[i]=d[i+1]=d[i+2]=o; }
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

/* Compress to thumbnail for localStorage */
const compressThumb = (dataUrl: string): Promise<string> =>
  new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const MAX = 300;
      let { width, height } = img;
      if (width > MAX) { height = Math.round(height * MAX / width); width = MAX; }
      const c = document.createElement('canvas'); c.width = width; c.height = height;
      c.getContext('2d')!.drawImage(img, 0, 0, width, height);
      resolve(c.toDataURL('image/jpeg', 0.55));
    };
    img.onerror = () => resolve('');
    img.src = dataUrl;
  });

/* ─── File reader helpers ──────────────────────────────────── */
type DocKind = 'pdf' | 'docx' | 'image' | 'text' | 'csv' | 'xlsx' | 'scan' | 'unknown';
const detectKind = (name: string, mime: string): DocKind => {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (mime==='application/pdf'||ext==='pdf') return 'pdf';
  if (mime.includes('wordprocessingml')||ext==='docx'||ext==='doc') return 'docx';
  if (mime.startsWith('image/')||['jpg','jpeg','png','gif','webp','bmp','svg'].includes(ext)) return 'image';
  if (ext==='csv') return 'csv';
  if (mime.includes('spreadsheetml')||['xlsx','xls'].includes(ext)) return 'xlsx';
  if (['txt','md','log','json','xml','html','htm','ini'].includes(ext)) return 'text';
  return 'unknown';
};
const kindIcon = (k: string) => k==='pdf'?'📄':k==='docx'?'📝':(k==='xlsx'||k==='csv')?'📊':(k==='image'||k==='scan')?'🖼️':'📃';
const kindLabel = (k: string) => k==='pdf'?'PDF':k==='docx'?'Word':k==='xlsx'?'Excel':k==='csv'?'CSV':k==='image'?'Изображение':k==='scan'?'Скан':'Текст';
const fmtSize = (b: number) => b<1024?b+' Б':b<1048576?(b/1024).toFixed(1)+' КБ':(b/1048576).toFixed(1)+' МБ';
const fmtDate = (ts: number) => new Date(ts).toLocaleDateString('ru-RU',{day:'2-digit',month:'short',year:'numeric'});

interface ScanHistoryItem { id: string; thumb: string; full: string; date: number; mode: string; }
interface RecentDoc { id: string; name: string; kind: string; size: number; date: number; }

const CATS = [...new Set(TEMPLATES.map(t => t.category))];

/* ─── Component ────────────────────────────────────────────── */
export default function DocumentsApp({ onBack, myHash: _myHash }: { onBack: () => void; myHash?: string }) {
  const [tab, setTab]           = useState<'data'|'templates'|'reader'>('data');
  /* data tab */
  const [fields, setFields]     = useState<DocFields>({ ...EMPTY });
  const [extracting, setExtracting] = useState(false);
  const [extractDone, setExtractDone] = useState(false);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  /* templates tab */
  const [catFilter, setCatFilter] = useState<string>('Все');
  const [search, setSearch]     = useState('');
  const [selectedTpl, setSelectedTpl] = useState<Template | null>(null);
  const [result, setResult]     = useState<string | null>(null);
  /* analyse uploaded doc */
  const [analysing, setAnalysing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  /* reader tab */
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

  const scanColorRef  = useRef<HTMLInputElement>(null);
  const scanBwRef     = useRef<HTMLInputElement>(null);
  const photoRef      = useRef<HTMLInputElement>(null);
  const fileRef       = useRef<HTMLInputElement>(null);
  const analyseRef    = useRef<HTMLInputElement>(null);
  const iframeRef     = useRef<HTMLIFrameElement>(null);

  /* Load persisted state */
  useEffect(() => {
    try { const s=localStorage.getItem('swaip_docs_recent'); if(s) setRecentDocs(JSON.parse(s)); } catch {}
    try { const s=localStorage.getItem('swaip_scan_history'); if(s) setScanHistory(JSON.parse(s)); } catch {}
  }, []);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };
  const setField  = (k: keyof DocFields, v: string) => setFields(f => ({ ...f, [k]: v }));

  const baseKeys: (keyof DocFields)[] = ['fullName','passportSeries','passportNumber','passportIssuedBy','passportIssuedDate','birthDate','regAddress'];
  const filledCount = baseKeys.filter(k => fields[k]).length;

  /* ── AI: extract data from image ── */
  const extractFromImage = useCallback(async (imageBase64: string, imageMime: string) => {
    setExtracting(true); setDataError(null);
    try {
      const token = localStorage.getItem('session_token') || '';
      const resp = await fetch('/api/assistants/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-session-token': token },
        body: JSON.stringify({
          specialistId: 'igor',
          question: 'Извлеки данные из документа. Верни ТОЛЬКО JSON без пояснений: { "fullName":"", "passportSeries":"", "passportNumber":"", "passportIssuedBy":"", "passportIssuedDate":"", "birthDate":"", "birthPlace":"", "regAddress":"", "inn":"", "snils":"" }. Пустые поля — пустая строка.',
          imageBase64, imageMime,
        }),
      });
      if (!resp.ok) throw new Error('API error');
      const data = await resp.json();
      const text: string = data.answer ?? data.text ?? '';
      const m = text.match(/\{[\s\S]*?\}/);
      if (m) {
        const p = JSON.parse(m[0]);
        setFields(f => ({ ...f,
          fullName:f.fullName||p.fullName||'', passportSeries:f.passportSeries||p.passportSeries||'',
          passportNumber:f.passportNumber||p.passportNumber||'', passportIssuedBy:f.passportIssuedBy||p.passportIssuedBy||'',
          passportIssuedDate:f.passportIssuedDate||p.passportIssuedDate||'', birthDate:f.birthDate||p.birthDate||'',
          birthPlace:f.birthPlace||p.birthPlace||'', regAddress:f.regAddress||p.regAddress||'',
          inn:f.inn||p.inn||'', snils:f.snils||p.snils||'',
        }));
        setExtractDone(true);
        showToast('✅ Данные распознаны');
      } else { setDataError('Не удалось разобрать ответ. Попробуйте фото лучшего качества.'); }
    } catch { setDataError('Ошибка распознавания. Введите данные вручную или повторите.'); }
    finally { setExtracting(false); }
  }, []);

  /* ── Scan ── */
  const handleScan = useCallback(async (file: File, mode: 'color' | 'bw') => {
    setScanning(true); setDataError(null);
    try {
      const { dataUrl, blob } = await applyScanFilter(file, mode);
      setScanPreview(dataUrl);
      /* save to history */
      const thumb = await compressThumb(dataUrl);
      setScanHistory(prev => {
        const updated = [{ id: Date.now().toString(), thumb, full: dataUrl, date: Date.now(), mode }, ...prev].slice(0, 15);
        try { localStorage.setItem('swaip_scan_history', JSON.stringify(updated)); } catch {}
        return updated;
      });
      setScanning(false);
      const base64 = dataUrl.split(',')[1];
      await extractFromImage(base64, 'image/jpeg');
      void blob;
    } catch { setScanning(false); setDataError('Ошибка при обработке изображения'); }
  }, [extractFromImage]);

  /* ── Photo (no filter) ── */
  const handlePhoto = useCallback(async (file: File) => {
    setDataError(null);
    const reader = new FileReader();
    reader.onload = async ev => {
      const dataUrl = ev.target?.result as string;
      setScanPreview(dataUrl);
      const thumb = await compressThumb(dataUrl);
      setScanHistory(prev => {
        const updated = [{ id: Date.now().toString(), thumb, full: dataUrl, date: Date.now(), mode: 'photo' }, ...prev].slice(0, 15);
        try { localStorage.setItem('swaip_scan_history', JSON.stringify(updated)); } catch {}
        return updated;
      });
      await extractFromImage(dataUrl.split(',')[1], file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  }, [extractFromImage]);

  /* ── AI: analyse uploaded doc ── */
  const analyseDoc = useCallback(async (file: File) => {
    setAnalysing(true); setAnalysisResult(null);
    try {
      const token = localStorage.getItem('session_token') || '';
      let imageBase64 = ''; let imageMime = ''; let textContent = '';
      const kind = detectKind(file.name, file.type);
      if (kind === 'image' || kind === 'scan') {
        const dr = new FileReader();
        const dataUrl = await new Promise<string>(res => { dr.onload = e => res(e.target?.result as string); dr.readAsDataURL(file); });
        imageBase64 = dataUrl.split(',')[1]; imageMime = file.type || 'image/jpeg';
      } else if (kind === 'docx') {
        const mammoth = await import('mammoth');
        const buf = await file.arrayBuffer();
        const r = await (mammoth as unknown as { convertToHtml: (o:{arrayBuffer:ArrayBuffer}) => Promise<{value:string}> }).convertToHtml({ arrayBuffer: buf });
        textContent = r.value.replace(/<[^>]+>/g, ' ').slice(0, 3000);
      } else { textContent = (await file.text()).slice(0, 3000); }

      const body: Record<string,string> = {
        specialistId: 'igor',
        question: imageBase64
          ? 'Это документ. Определи: 1) тип документа (что это), 2) какие поля уже заполнены, 3) какие данные отсутствуют и нужны для оформления. Ответь на русском, структурированно.'
          : `Вот текст документа:\n\n${textContent}\n\nОпредели: 1) тип документа, 2) что уже заполнено, 3) каких данных не хватает для правильного оформления. Ответь структурированно.`,
      };
      if (imageBase64) { body.imageBase64 = imageBase64; body.imageMime = imageMime; }

      const resp = await fetch('/api/assistants/solve', { method:'POST', headers:{'Content-Type':'application/json','x-session-token':token}, body: JSON.stringify(body) });
      if (!resp.ok) throw new Error('API error');
      const data = await resp.json();
      setAnalysisResult(data.answer ?? data.text ?? 'Не удалось проанализировать документ');
    } catch { setAnalysisResult('Ошибка при анализе. Попробуйте снова.'); }
    finally { setAnalysing(false); }
  }, []);

  /* ── Build template ── */
  const buildDoc = (tpl: Template) => { setSelectedTpl(tpl); setResult(tpl.build(fields)); setTab('templates'); };

  /* ── Print ── */
  const printResult = () => {
    if (!result) return;
    const win = window.open('','_blank'); if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${selectedTpl?.name??'Документ'}</title><style>body{font-family:Arial,sans-serif;margin:50px;font-size:14px;line-height:1.9;color:#111;white-space:pre-wrap;}</style></head><body>${result.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</body></html>`);
    win.document.close(); setTimeout(()=>{win.focus();win.print();},500);
  };

  /* ── Share ── */
  const shareResult = async () => {
    if (!result) return;
    if (navigator.share) { try { await navigator.share({ title: selectedTpl?.name??'Документ', text: result }); return; } catch {} }
    await navigator.clipboard.writeText(result);
    showToast('📋 Скопировано в буфер обмена');
  };

  /* ── Reader file ── */
  const processReaderFile = useCallback(async (file: File) => {
    setRLoading(true); setRError(null);
    if (rPdfUrl) URL.revokeObjectURL(rPdfUrl);
    if (rImageUrl?.startsWith('blob:')) URL.revokeObjectURL(rImageUrl);
    setRPdfUrl(null); setRDocHtml(null); setRDocText(null); setRDocTable(null); setRImageUrl(null);
    const kind = detectKind(file.name, file.type);
    setRDocName(file.name); setRDocKind(kind);
    try {
      if (kind==='pdf') { setRPdfUrl(URL.createObjectURL(file)); setRViewing(true); }
      else if (kind==='image') { setRImageUrl(URL.createObjectURL(file)); setRViewing(true); }
      else if (kind==='docx') {
        const mammoth = await import('mammoth');
        const buf = await file.arrayBuffer();
        const res = await (mammoth as unknown as { convertToHtml: (o:{arrayBuffer:ArrayBuffer}) => Promise<{value:string}> }).convertToHtml({ arrayBuffer: buf });
        setRDocHtml(res.value||'<p><em>Пусто</em></p>'); setRViewing(true);
      } else if (kind==='text') { setRDocText(await file.text()); setRViewing(true); }
      else if (kind==='csv') {
        const t = await file.text();
        const rows = t.split('\n').filter(r=>r.trim()).map(r=>{const cells:string[]=[]; let cur='',inQ=false; for(const ch of r){if(ch==='"')inQ=!inQ;else if(ch===','&&!inQ){cells.push(cur);cur='';}else cur+=ch;} cells.push(cur); return cells;});
        setRDocTable(rows); setRViewing(true);
      } else if (kind==='xlsx') {
        const XLSX=await import('xlsx'); const buf=await file.arrayBuffer();
        const wb=XLSX.read(buf,{type:'array'}); const ws=wb.Sheets[wb.SheetNames[0]];
        setRDocTable(XLSX.utils.sheet_to_json<unknown[]>(ws,{header:1,defval:''})); setRViewing(true);
      } else { setRError('Формат не поддерживается'); }
      setRecentDocs(prev=>{const u=[{id:Date.now().toString(),name:file.name,kind,size:file.size,date:Date.now()},...prev.filter(d=>d.name!==file.name)].slice(0,20);try{localStorage.setItem('swaip_docs_recent',JSON.stringify(u));}catch{}return u;});
    } catch(e){setRError('Ошибка: '+(e instanceof Error?e.message:String(e)));}
    finally{setRLoading(false);}
  }, [rPdfUrl, rImageUrl]);

  const printReader = () => {
    if (rDocKind==='pdf'&&rPdfUrl){window.open(rPdfUrl,'_blank')?.addEventListener('load',e=>(e.target as Window).print());return;}
    const win=window.open('','_blank');if(!win)return;
    let body='';
    if(rDocHtml)body=`<style>body{font-family:Arial,sans-serif;margin:40px;font-size:14px;line-height:1.7;color:#111;}</style>${rDocHtml}`;
    else if(rDocText)body=`<style>body{font-family:monospace;margin:40px;font-size:12px;white-space:pre-wrap;color:#111;}</style>${rDocText.replace(/&/g,'&amp;').replace(/</g,'&lt;')}`;
    else if(rImageUrl)body=`<style>body{margin:20px;}img{max-width:100%;}</style><img src="${rImageUrl}"/>`;
    else if(rDocTable){const rows=(rDocTable as string[][]).map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('');body=`<style>body{font-family:Arial;margin:20px;}table{border-collapse:collapse;width:100%;}td,th{border:1px solid #ccc;padding:5px;font-size:11px;}</style><table>${rows}</table>`;}
    win.document.write(`<!DOCTYPE html><html><head><title>${rDocName}</title></head><body>${body}</body></html>`);
    win.document.close();setTimeout(()=>{win.focus();win.print();},500);
  };

  /* ── Filter templates ── */
  const visibleTemplates = TEMPLATES.filter(t =>
    (catFilter==='Все' || t.category===catFilter) &&
    (search==='' || t.name.toLowerCase().includes(search.toLowerCase()) || t.desc.toLowerCase().includes(search.toLowerCase()))
  );

  /* ── Input field ── */
  const Field = ({ k, placeholder }: { k: keyof DocFields; placeholder?: string }) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: SUB, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>{FL[k]}</div>
      <input value={fields[k]} onChange={e=>setField(k,e.target.value)} placeholder={placeholder??FL[k]??k}
        style={{ width:'100%', padding:'10px 12px', borderRadius:10, background:CARD2, border:`1px solid ${fields[k]?'rgba(79,142,247,0.5)':BORDER}`, color:TEXT, fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit' }} />
    </div>
  );

  /* ────────────────── RENDER ────────────────── */
  return (
    <div style={{ position:'fixed', inset:0, zIndex:800, background:BG, display:'flex', flexDirection:'column', fontFamily:'"Montserrat",sans-serif', overflow:'hidden' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'48px 16px 12px', borderBottom:`1px solid ${BORDER}`, background:'rgba(9,9,15,0.98)', flexShrink:0, backdropFilter:'blur(16px)' }}>
        <motion.button whileTap={{scale:0.88}} onClick={() => {
          if(tab==='templates'&&result){setResult(null);setSelectedTpl(null);}
          else if(tab==='reader'&&rViewing){setRViewing(false);}
          else if(tab==='templates'&&analysisResult){setAnalysisResult(null);}
          else onBack();
        }} style={{ width:36, height:36, borderRadius:'50%', background:CARD, border:`1px solid ${BORDER}`, color:TEXT, fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>←</motion.button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:15, fontWeight:900, color:TEXT }}>
            {tab==='templates'&&result ? (selectedTpl?.name??'Документ') : tab==='templates'&&analysisResult ? 'Анализ документа' : '📂 Документы'}
          </div>
          {tab==='data'&&filledCount>0&&<div style={{fontSize:10,color:GREEN,marginTop:1,fontWeight:700}}>✓ {filledCount}/{baseKeys.length} основных полей</div>}
        </div>
        {tab==='templates'&&result&&(
          <div style={{display:'flex',gap:6}}>
            <motion.button whileTap={{scale:0.9}} onClick={printResult} style={{width:34,height:34,borderRadius:10,background:CARD,border:`1px solid ${BORDER}`,color:TEXT,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>🖨️</motion.button>
            <motion.button whileTap={{scale:0.9}} onClick={shareResult} style={{width:34,height:34,borderRadius:10,background:CARD,border:`1px solid ${BORDER}`,color:TEXT,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>📤</motion.button>
          </div>
        )}
        {tab==='reader'&&rViewing&&(
          <div style={{display:'flex',gap:6}}>
            <motion.button whileTap={{scale:0.9}} onClick={printReader} style={{width:34,height:34,borderRadius:10,background:CARD,border:`1px solid ${BORDER}`,color:TEXT,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>🖨️</motion.button>
            {(rDocKind==='image'||rDocKind==='scan')&&<>
              <motion.button whileTap={{scale:0.9}} onClick={()=>setRImgZoom(z=>Math.min(z+0.25,4))} style={{width:34,height:34,borderRadius:10,background:CARD,border:`1px solid ${BORDER}`,color:TEXT,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>＋</motion.button>
              <motion.button whileTap={{scale:0.9}} onClick={()=>setRImgZoom(z=>Math.max(z-0.25,0.25))} style={{width:34,height:34,borderRadius:10,background:CARD,border:`1px solid ${BORDER}`,color:TEXT,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>－</motion.button>
            </>}
          </div>
        )}
      </div>

      {/* Tab bar */}
      {!(tab==='templates'&&(result||analysisResult))&&!(tab==='reader'&&rViewing)&&(
        <div style={{display:'flex',borderBottom:`1px solid ${BORDER}`,flexShrink:0,background:'rgba(9,9,15,0.98)'}}>
          {([{id:'data',icon:'👤',label:'Данные'},{id:'templates',icon:'📝',label:'Шаблоны'},{id:'reader',icon:'📂',label:'Читалка'}] as const).map(t=>(
            <motion.button key={t.id} whileTap={{scale:0.95}} onClick={()=>setTab(t.id)} style={{flex:1,padding:'12px 4px',background:'transparent',border:'none',color:tab===t.id?ACCENT:SUB,fontSize:11,fontWeight:800,cursor:'pointer',borderBottom:tab===t.id?`2px solid ${ACCENT}`:'2px solid transparent',display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
              <span style={{fontSize:16}}>{t.icon}</span>{t.label}
            </motion.button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{flex:1,overflow:'hidden',position:'relative'}}>
        <AnimatePresence mode="wait">

          {/* ═══ TAB: ДАННЫЕ ═══ */}
          {tab==='data'&&(
            <motion.div key="data" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{height:'100%',overflowY:'auto',padding:'16px 16px 120px'}}>

              {/* Scan block */}
              <div style={{background:'linear-gradient(135deg,#0d1b38,#0d2230)',borderRadius:16,padding:16,marginBottom:16,border:`1px solid rgba(79,142,247,0.2)`,position:'relative',overflow:'hidden'}}>
                <div style={{fontSize:11,fontWeight:800,color:ACCENT,marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>📷 Загрузить документ для распознавания</div>
                <div style={{fontSize:11,color:SUB,marginBottom:12,lineHeight:1.5}}>Сфотографируйте паспорт или другой документ — данные заполнятся автоматически</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:6}}>
                  <motion.button whileTap={{scale:0.95}} disabled={scanning||extracting} onClick={()=>scanColorRef.current?.click()}
                    style={{padding:'11px 6px',borderRadius:12,background:ACCENT,border:'none',color:'#fff',fontSize:11,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5,opacity:(scanning||extracting)?0.5:1}}>
                    🎨 Скан цветной
                  </motion.button>
                  <motion.button whileTap={{scale:0.95}} disabled={scanning||extracting} onClick={()=>scanBwRef.current?.click()}
                    style={{padding:'11px 6px',borderRadius:12,background:'transparent',border:`1.5px solid ${ACCENT}`,color:ACCENT,fontSize:11,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5,opacity:(scanning||extracting)?0.5:1}}>
                    🖤 Скан ч/б
                  </motion.button>
                </div>
                <motion.button whileTap={{scale:0.95}} disabled={scanning||extracting} onClick={()=>photoRef.current?.click()}
                  style={{width:'100%',padding:'9px 6px',borderRadius:10,background:'transparent',border:`1px solid rgba(79,142,247,0.3)`,color:'rgba(79,142,247,0.7)',fontSize:11,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5,opacity:(scanning||extracting)?0.5:1,boxSizing:'border-box'}}>
                  🖼 Фото из галереи (без обработки)
                </motion.button>

                {/* Current scan preview */}
                {scanPreview&&(
                  <div style={{marginTop:12,borderRadius:10,overflow:'hidden',border:`1px solid ${BORDER}`}}>
                    <img src={scanPreview} alt="Скан" style={{width:'100%',height:'auto',display:'block'}} />
                  </div>
                )}

                {/* Overlays */}
                <AnimatePresence>
                  {(scanning||extracting)&&(
                    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{position:'absolute',inset:0,background:'rgba(9,9,15,0.92)',borderRadius:16,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12}}>
                      {scanning?(
                        <>
                          <div style={{position:'relative',width:130,height:80,border:`2px solid ${ACCENT}`,borderRadius:8,overflow:'hidden'}}>
                            <motion.div animate={{y:[0,76,0]}} transition={{duration:1.2,repeat:Infinity,ease:'linear'}} style={{position:'absolute',left:0,right:0,height:3,background:`linear-gradient(90deg,transparent,${ACCENT},transparent)`,boxShadow:`0 0 8px ${ACCENT}`}} />
                            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>📄</div>
                          </div>
                          <div style={{color:ACCENT,fontSize:12,fontWeight:800}}>Сканирую…</div>
                        </>
                      ):(
                        <>
                          <motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}} style={{width:40,height:40,borderRadius:'50%',border:`3px solid rgba(79,142,247,0.2)`,borderTopColor:ACCENT}} />
                          <div style={{color:ACCENT,fontSize:12,fontWeight:800}}>Распознаю данные…</div>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Scan history */}
              {scanHistory.length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:800,color:SUB,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>🕐 История сканов</div>
                  <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4}}>
                    {scanHistory.map(item=>(
                      <motion.div key={item.id} whileTap={{scale:0.95}} onClick={()=>setPreviewImg(item.full)}
                        style={{flexShrink:0,width:70,borderRadius:10,overflow:'hidden',border:`2px solid ${BORDER}`,cursor:'pointer',background:'#111',position:'relative'}}>
                        <img src={item.thumb} alt="Скан" style={{width:'100%',height:90,objectFit:'cover',display:'block'}} />
                        <div style={{padding:'3px 5px',fontSize:9,color:SUB,background:'rgba(0,0,0,0.7)'}}>
                          {item.mode==='color'?'🎨':item.mode==='bw'?'🖤':'📷'}
                          {' '}{new Date(item.date).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {extractDone&&<div style={{padding:'10px 14px',borderRadius:12,background:'rgba(52,211,153,0.1)',border:`1px solid rgba(52,211,153,0.25)`,color:GREEN,fontSize:12,fontWeight:700,marginBottom:14}}>✅ Данные распознаны! Проверьте поля ниже.</div>}
              {dataError&&<div style={{padding:'10px 14px',borderRadius:12,background:'rgba(255,80,80,0.1)',border:'1px solid rgba(255,80,80,0.25)',color:'#ff6060',fontSize:12,fontWeight:600,marginBottom:14}}> ⚠️ {dataError}</div>}

              <div style={{fontSize:11,fontWeight:800,color:SUB,textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>✏️ Личные данные</div>
              <Field k="fullName" placeholder="Иванов Иван Иванович" />
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <Field k="passportSeries" placeholder="92 07" /><Field k="passportNumber" placeholder="341626" />
              </div>
              <Field k="passportIssuedBy" placeholder="УФМС России по РТ..." />
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <Field k="passportIssuedDate" placeholder="04.12.2008" /><Field k="birthDate" placeholder="26.07.1987" />
              </div>
              <Field k="birthPlace" placeholder="г. Казань" />
              <Field k="regAddress" placeholder="РТ, Набережные Челны, пр. Мира, 23, кв. 162" />
              <Field k="city" placeholder="Набережные Челны" />
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                <Field k="phone" placeholder="+7 (999) 000-00-00" /><Field k="inn" placeholder="162812345678" />
              </div>
              <Field k="snils" placeholder="123-456-789 00" />

              <motion.button whileTap={{scale:0.97}} onClick={()=>setTab('templates')} style={{width:'100%',marginTop:8,padding:'14px',borderRadius:14,background:ACCENT,border:'none',color:'#fff',fontSize:14,fontWeight:900,cursor:'pointer'}}>
                Выбрать шаблон →
              </motion.button>
              <motion.button whileTap={{scale:0.97}} onClick={()=>{setFields({...EMPTY,today:fields.today});setScanPreview(null);setExtractDone(false);showToast('Очищено');}} style={{width:'100%',marginTop:8,padding:'12px',borderRadius:14,background:'transparent',border:`1px solid ${BORDER}`,color:SUB,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                Очистить данные
              </motion.button>
            </motion.div>
          )}

          {/* ═══ TAB: ШАБЛОНЫ — list ═══ */}
          {tab==='templates'&&!result&&!analysisResult&&(
            <motion.div key="templates" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{height:'100%',overflowY:'auto',padding:'14px 14px 120px'}}>

              {/* Analyse document button */}
              <motion.button whileTap={{scale:0.97}} disabled={analysing} onClick={()=>analyseRef.current?.click()}
                style={{width:'100%',padding:'14px',borderRadius:14,background:'linear-gradient(135deg,#0d2230,#0d1b38)',border:`1px solid rgba(79,142,247,0.3)`,color:TEXT,fontSize:13,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',gap:12,marginBottom:14,boxSizing:'border-box',opacity:analysing?0.6:1}}>
                <span style={{fontSize:22,flexShrink:0}}>📎</span>
                <div style={{textAlign:'left'}}>
                  <div style={{color:ACCENT}}>Вставить свой документ</div>
                  <div style={{fontSize:10,color:SUB,fontWeight:500,marginTop:2}}>Загрузи скан/фото/DOCX — бот скажет чего не хватает</div>
                </div>
                {analysing&&<motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}} style={{width:20,height:20,borderRadius:'50%',border:`2px solid rgba(79,142,247,0.2)`,borderTopColor:ACCENT,flexShrink:0}} />}
              </motion.button>

              {filledCount<3&&<div style={{padding:'10px 14px',borderRadius:12,background:`rgba(251,191,36,0.1)`,border:`1px solid rgba(251,191,36,0.25)`,color:AMBER,fontSize:11,fontWeight:700,marginBottom:12}}>⚠️ Заполнено {filledCount}/{baseKeys.length} полей. <span style={{textDecoration:'underline',cursor:'pointer'}} onClick={()=>setTab('data')}>Добавить →</span></div>}

              {/* Search */}
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по шаблонам…"
                style={{width:'100%',padding:'10px 14px',borderRadius:12,background:CARD2,border:`1px solid ${BORDER}`,color:TEXT,fontSize:13,outline:'none',boxSizing:'border-box',marginBottom:10,fontFamily:'inherit'}} />

              {/* Category filter */}
              <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:8,marginBottom:12}}>
                {['Все',...CATS].map(c=>(
                  <motion.button key={c} whileTap={{scale:0.95}} onClick={()=>setCatFilter(c)}
                    style={{flexShrink:0,padding:'5px 12px',borderRadius:20,background:catFilter===c?ACCENT:CARD,border:`1px solid ${catFilter===c?ACCENT:BORDER}`,color:catFilter===c?'#fff':SUB,fontSize:10,fontWeight:800,cursor:'pointer'}}>
                    {c}
                  </motion.button>
                ))}
              </div>

              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {visibleTemplates.map(tpl=>(
                  <motion.button key={tpl.id} whileTap={{scale:0.97}} onClick={()=>buildDoc(tpl)}
                    style={{padding:'13px',borderRadius:14,background:CARD,border:`1px solid ${BORDER}`,color:TEXT,cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:12}}>
                    <div style={{width:42,height:42,borderRadius:11,background:'rgba(79,142,247,0.12)',border:`1px solid rgba(79,142,247,0.2)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>{tpl.icon}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:12,fontWeight:800,color:TEXT}}>{tpl.name}</div>
                      <div style={{fontSize:10,color:SUB,marginTop:2,lineHeight:1.35}}>{tpl.desc}</div>
                      <div style={{fontSize:9,color:'rgba(79,142,247,0.6)',marginTop:3,fontWeight:700}}>{tpl.category}</div>
                    </div>
                    <div style={{color:ACCENT,fontSize:16,flexShrink:0}}>→</div>
                  </motion.button>
                ))}
                {visibleTemplates.length===0&&<div style={{textAlign:'center',padding:'40px 0',color:SUB,fontSize:13}}>Ничего не найдено</div>}
              </div>
            </motion.div>
          )}

          {/* ═══ Analysis result ═══ */}
          {tab==='templates'&&analysisResult&&!result&&(
            <motion.div key="analysis" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0}} style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden'}}>
              <div style={{flex:1,overflowY:'auto',padding:'20px 16px 100px'}}>
                <div style={{padding:'14px',borderRadius:14,background:'rgba(79,142,247,0.08)',border:`1px solid rgba(79,142,247,0.2)`,marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:800,color:ACCENT,marginBottom:6,textTransform:'uppercase',letterSpacing:1}}>📊 Анализ документа</div>
                  <div style={{fontSize:13,color:TEXT,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{analysisResult}</div>
                </div>
                <motion.button whileTap={{scale:0.97}} onClick={()=>{setAnalysisResult(null);}}
                  style={{width:'100%',padding:'13px',borderRadius:14,background:ACCENT,border:'none',color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer'}}>
                  Выбрать шаблон документа →
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ═══ Filled document ═══ */}
          {tab==='templates'&&result&&(
            <motion.div key="result" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0}} style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden'}}>
              {selectedTpl&&selectedTpl.extras.some(k=>!fields[k])&&(
                <div style={{padding:'12px 16px',borderBottom:`1px solid ${BORDER}`,background:'rgba(9,9,15,0.98)',flexShrink:0}}>
                  <div style={{fontSize:10,fontWeight:800,color:AMBER,marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>✏️ Дополните данные</div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {selectedTpl.extras.filter(k=>!fields[k]).map(k=>(
                      <input key={k} value={fields[k]} onChange={e=>{setField(k,e.target.value);setResult(selectedTpl.build({...fields,[k]:e.target.value}));}}
                        placeholder={FL[k]??k}
                        style={{padding:'9px 12px',borderRadius:10,background:CARD2,border:`1px solid rgba(251,191,36,0.4)`,color:TEXT,fontSize:12,outline:'none',fontFamily:'inherit'}} />
                    ))}
                  </div>
                </div>
              )}
              <div style={{flex:1,overflowY:'auto',background:'#fff'}}>
                <pre style={{fontFamily:'Arial,sans-serif',fontSize:14,lineHeight:1.9,color:'#111',whiteSpace:'pre-wrap',wordBreak:'break-word',margin:0,padding:'28px 24px'}}>{result}</pre>
              </div>
              <div style={{display:'flex',gap:8,padding:'12px 16px',borderTop:`1px solid ${BORDER}`,background:'rgba(9,9,15,0.98)',flexShrink:0}}>
                <motion.button whileTap={{scale:0.95}} onClick={printResult} style={{flex:1,padding:'12px',borderRadius:12,background:ACCENT,border:'none',color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>🖨️ Печать</motion.button>
                <motion.button whileTap={{scale:0.95}} onClick={shareResult} style={{flex:1,padding:'12px',borderRadius:12,background:CARD,border:`1px solid ${BORDER}`,color:TEXT,fontSize:13,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>📤 Поделиться</motion.button>
                <motion.button whileTap={{scale:0.95}} onClick={async()=>{await navigator.clipboard.writeText(result??'');showToast('📋 Скопировано');}} style={{width:46,padding:'12px',borderRadius:12,background:CARD,border:`1px solid ${BORDER}`,color:TEXT,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>📋</motion.button>
              </div>
            </motion.div>
          )}

          {/* ═══ TAB: ЧИТАЛКА — home ═══ */}
          {tab==='reader'&&!rViewing&&(
            <motion.div key="reader-home" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{height:'100%',overflowY:'auto',padding:'16px 16px 120px'}}>
              <div style={{background:'linear-gradient(135deg,#0d1b38,#0d2230)',borderRadius:16,padding:14,marginBottom:14,border:`1px solid rgba(79,142,247,0.2)`}}>
                <div style={{fontSize:11,fontWeight:800,color:ACCENT,marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>📷 Сканер</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <motion.button whileTap={{scale:0.95}} onClick={()=>scanColorRef.current?.click()} style={{padding:'10px 6px',borderRadius:12,background:ACCENT,border:'none',color:'#fff',fontSize:11,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>🎨 Цветной</motion.button>
                  <motion.button whileTap={{scale:0.95}} onClick={()=>scanBwRef.current?.click()} style={{padding:'10px 6px',borderRadius:12,background:'transparent',border:`1.5px solid ${ACCENT}`,color:ACCENT,fontSize:11,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>🖤 Ч/Б</motion.button>
                </div>
              </div>
              <motion.button whileTap={{scale:0.97}} onClick={()=>fileRef.current?.click()} style={{width:'100%',padding:16,borderRadius:16,background:CARD,border:`2px dashed ${BORDER}`,color:TEXT,fontSize:13,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:12,marginBottom:18,boxSizing:'border-box'}}>
                <span style={{fontSize:24}}>📂</span>
                <div style={{textAlign:'left'}}>
                  <div>Открыть файл</div>
                  <div style={{fontSize:10,color:SUB,fontWeight:500,marginTop:2}}>PDF · DOCX · TXT · XLSX · CSV · JPG · PNG</div>
                </div>
              </motion.button>
              {rError&&<div style={{padding:'12px',borderRadius:12,background:'rgba(255,80,80,0.1)',border:'1px solid rgba(255,80,80,0.25)',color:'#ff6060',fontSize:12,marginBottom:14}}>⚠️ {rError}</div>}

              {/* Scan history in reader tab too */}
              {scanHistory.length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:800,color:SUB,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>🕐 История сканов</div>
                  <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4}}>
                    {scanHistory.map(item=>(
                      <motion.div key={item.id} whileTap={{scale:0.95}} onClick={()=>setPreviewImg(item.full)} style={{flexShrink:0,width:70,borderRadius:10,overflow:'hidden',border:`2px solid ${BORDER}`,cursor:'pointer',background:'#111'}}>
                        <img src={item.thumb} alt="Скан" style={{width:'100%',height:90,objectFit:'cover',display:'block'}} />
                        <div style={{padding:'3px 5px',fontSize:9,color:SUB,background:'rgba(0,0,0,0.7)'}}>{item.mode==='color'?'🎨':item.mode==='bw'?'🖤':'📷'} {new Date(item.date).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {recentDocs.length>0&&(
                <>
                  <div style={{fontSize:11,fontWeight:800,color:SUB,textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>📄 Файлы</div>
                  {recentDocs.map(d=>(
                    <div key={d.id} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',borderRadius:14,background:CARD,border:`1px solid ${BORDER}`,marginBottom:8}}>
                      <div style={{fontSize:22}}>{kindIcon(d.kind)}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,color:TEXT,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.name}</div>
                        <div style={{fontSize:10,color:SUB,marginTop:1}}>{kindLabel(d.kind)} · {fmtSize(d.size)} · {fmtDate(d.date)}</div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </motion.div>
          )}

          {/* Reader: viewer */}
          {tab==='reader'&&rViewing&&(
            <motion.div key="reader-view" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}} style={{height:'100%',overflow:'hidden',display:'flex',flexDirection:'column',position:'relative'}}>
              {rDocKind==='pdf'&&rPdfUrl&&<iframe ref={iframeRef} src={rPdfUrl} style={{flex:1,width:'100%',border:'none',background:'#fff'}} title={rDocName} />}
              {rDocKind==='docx'&&rDocHtml&&<div style={{flex:1,overflowY:'auto',background:'#fff'}}><div style={{maxWidth:800,margin:'0 auto',padding:'32px 24px',fontFamily:'Arial,sans-serif',fontSize:14,lineHeight:1.7,color:'#111'}} dangerouslySetInnerHTML={{__html:rDocHtml}} /></div>}
              {rDocKind==='text'&&rDocText!==null&&<div style={{flex:1,overflowY:'auto',background:'#fafafa',padding:24}}><pre style={{fontFamily:'"Courier New",monospace',fontSize:13,lineHeight:1.7,color:'#111',whiteSpace:'pre-wrap',wordBreak:'break-word',margin:0}}>{rDocText}</pre></div>}
              {(rDocKind==='image'||rDocKind==='scan')&&rImageUrl&&<div style={{flex:1,overflow:'auto',background:'#111',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:16}}><img src={rImageUrl} alt={rDocName} style={{transform:`scale(${rImgZoom})`,transformOrigin:'top center',maxWidth:'100%',height:'auto',transition:'transform 0.2s'}} /></div>}
              {(rDocKind==='xlsx'||rDocKind==='csv')&&rDocTable&&(
                <div style={{flex:1,overflow:'auto',background:'#fff'}}>
                  <table style={{borderCollapse:'collapse',width:'100%',fontSize:12,fontFamily:'Arial,sans-serif'}}>
                    <thead><tr>{(rDocTable[0] as string[]).map((h,i)=><th key={i} style={{border:'1px solid #d0d0d0',padding:'7px 10px',background:'#f5f5f5',fontWeight:700,color:'#222',whiteSpace:'nowrap',position:'sticky',top:0}}>{String(h)}</th>)}</tr></thead>
                    <tbody>{(rDocTable.slice(1) as string[][]).map((row,ri)=><tr key={ri} style={{background:ri%2===0?'#fff':'#f9f9f9'}}>{row.map((cell,ci)=><td key={ci} style={{border:'1px solid #e8e8e8',padding:'6px 10px',color:'#222'}}>{String(cell??'')}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
              {rLoading&&<div style={{position:'absolute',inset:0,background:'rgba(9,9,15,0.85)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14}}><motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}} style={{width:42,height:42,borderRadius:'50%',border:`3px solid rgba(79,142,247,0.2)`,borderTopColor:ACCENT}} /><div style={{color:TEXT,fontSize:13,fontWeight:700}}>Открываю…</div></div>}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Scan preview modal */}
      <AnimatePresence>
        {previewImg&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            onClick={()=>setPreviewImg(null)}
            style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.9)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
            <motion.div initial={{scale:0.8}} animate={{scale:1}} exit={{scale:0.8}} onClick={e=>e.stopPropagation()}
              style={{maxWidth:'100%',maxHeight:'100%',borderRadius:12,overflow:'hidden',boxShadow:'0 0 60px rgba(0,0,0,0.8)'}}>
              <img src={previewImg} alt="Предпросмотр" style={{maxWidth:'100vw',maxHeight:'85vh',objectFit:'contain',display:'block'}} />
            </motion.div>
            <motion.button whileTap={{scale:0.9}} onClick={()=>setPreviewImg(null)}
              style={{position:'absolute',top:50,right:20,width:40,height:40,borderRadius:'50%',background:'rgba(255,255,255,0.15)',border:'none',color:'#fff',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</motion.button>
            <div style={{position:'absolute',bottom:30,left:'50%',transform:'translateX(-50%)',color:'rgba(255,255,255,0.5)',fontSize:12}}>Нажмите вне изображения, чтобы закрыть</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast&&(
          <motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} exit={{opacity:0,y:30}}
            style={{position:'fixed',bottom:90,left:'50%',transform:'translateX(-50%)',background:'rgba(20,30,60,0.97)',border:`1px solid ${BORDER}`,color:TEXT,padding:'10px 20px',borderRadius:40,fontSize:13,fontWeight:700,zIndex:999,whiteSpace:'nowrap',backdropFilter:'blur(10px)'}}>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hidden inputs */}
      <input ref={scanColorRef} type="file" accept="image/*" capture="environment"
        onChange={e=>{const f=e.target.files?.[0];if(f)handleScan(f,'color');e.target.value='';}} style={{display:'none'}} />
      <input ref={scanBwRef} type="file" accept="image/*" capture="environment"
        onChange={e=>{const f=e.target.files?.[0];if(f)handleScan(f,'bw');e.target.value='';}} style={{display:'none'}} />
      <input ref={photoRef} type="file" accept="image/*"
        onChange={e=>{const f=e.target.files?.[0];if(f)handlePhoto(f);e.target.value='';}} style={{display:'none'}} />
      <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.md,.csv,.xlsx,.xls,.jpg,.jpeg,.png,.gif,.webp"
        onChange={e=>{const f=e.target.files?.[0];if(f)processReaderFile(f);e.target.value='';}} style={{display:'none'}} />
      <input ref={analyseRef} type="file" accept="image/*,.pdf,.docx,.doc,.txt"
        onChange={e=>{const f=e.target.files?.[0];if(f)analyseDoc(f);e.target.value='';}} style={{display:'none'}} />
    </div>
  );
}
