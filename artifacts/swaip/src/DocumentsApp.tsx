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
const RED    = '#f87171';

/* ─── Types ─────────────────────────────────────────────────── */
interface DocFields {
  fullName:string; passportSeries:string; passportNumber:string;
  passportIssuedBy:string; passportIssuedDate:string;
  birthDate:string; birthPlace:string; regAddress:string;
  phone:string; inn:string; snils:string; city:string; today:string;
  amount:string; amountWords:string; returnDate:string;
  counterFullName:string; counterPassport:string; counterAddress:string;
  subject:string; rentAddress:string; rentAmount:string; rentPeriod:string;
  carBrand:string; carYear:string; carVin:string; carPrice:string;
  workDesc:string; workPrice:string; workDeadline:string;
  position:string; employer:string; dismissDate:string;
  claimSubject:string; claimAmount:string;
  childName:string; childBirthDate:string; childPassport:string;
  courtName:string; defendant:string; defendantAddress:string;
  claimText:string; evidenceList:string;
  orgName:string; orgAddress:string; orgInn:string; orgOgrn:string;
  giftObject:string; apartmentAddress:string; apartmentArea:string; apartmentPrice:string;
  vacationStart:string; vacationEnd:string; vacationDays:string;
  complaintText:string; requestText:string;
  doctorName:string; hospitalName:string;
  bankName:string; bankBik:string; bankAccount:string; corrAccount:string;
  contractNumber:string; contractDate:string;
  propertyAddress:string; sharePercent:string;
  maternityAmount:string; pensionType:string;
  vehiclePlate:string; accidentDate:string;
  leaveType:string; leaveStart:string;
  workDays:string; ndsRate:string; paymentTerms:string;
  orderNumber:string; orderDate:string;
  actNumber:string; actDate:string;
  invoiceNumber:string;
  selfEmployedInn:string; selfEmployedSnils:string;
  postalAddress:string; kpp:string; ogrn:string;
  /* Роспатент / ИС */
  softwareName:string; applicationNumber:string; citizenship:string;
  authorContribution:string; publishMode:string; pseudonym:string;
  rightHolder:string;
}

const EMPTY: DocFields = {
  fullName:'', passportSeries:'', passportNumber:'', passportIssuedBy:'',
  passportIssuedDate:'', birthDate:'', birthPlace:'', regAddress:'',
  phone:'', inn:'', snils:'', city:'', today:new Date().toLocaleDateString('ru-RU'),
  amount:'', amountWords:'', returnDate:'', counterFullName:'', counterPassport:'',
  counterAddress:'', subject:'', rentAddress:'', rentAmount:'', rentPeriod:'',
  carBrand:'', carYear:'', carVin:'', carPrice:'', workDesc:'', workPrice:'',
  workDeadline:'', position:'', employer:'', dismissDate:'', claimSubject:'', claimAmount:'',
  childName:'', childBirthDate:'', childPassport:'',
  courtName:'', defendant:'', defendantAddress:'', claimText:'', evidenceList:'',
  orgName:'', orgAddress:'', orgInn:'', orgOgrn:'',
  giftObject:'', apartmentAddress:'', apartmentArea:'', apartmentPrice:'',
  vacationStart:'', vacationEnd:'', vacationDays:'',
  complaintText:'', requestText:'',
  doctorName:'', hospitalName:'',
  bankName:'', bankBik:'', bankAccount:'', corrAccount:'',
  contractNumber:'', contractDate:'',
  propertyAddress:'', sharePercent:'',
  maternityAmount:'', pensionType:'',
  vehiclePlate:'', accidentDate:'',
  leaveType:'', leaveStart:'',
  workDays:'', ndsRate:'без НДС', paymentTerms:'',
  orderNumber:'', orderDate:'',
  actNumber:'', actDate:'',
  invoiceNumber:'',
  selfEmployedInn:'', selfEmployedSnils:'',
  postalAddress:'', kpp:'', ogrn:'',
  softwareName:'', applicationNumber:'', citizenship:'Российская Федерация',
  authorContribution:'', publishMode:'упоминать под своим именем', pseudonym:'',
  rightHolder:'',
};

const FL: Partial<Record<keyof DocFields,string>> = {
  fullName:'ФИО полностью', passportSeries:'Серия паспорта', passportNumber:'Номер паспорта',
  passportIssuedBy:'Кем выдан', passportIssuedDate:'Дата выдачи',
  birthDate:'Дата рождения', birthPlace:'Место рождения', regAddress:'Адрес регистрации',
  phone:'Телефон', inn:'ИНН', snils:'СНИЛС', city:'Город', today:'Дата',
  amount:'Сумма (цифрами)', amountWords:'Сумма (прописью)', returnDate:'Срок возврата/оплаты',
  counterFullName:'ФИО / наим. второй стороны', counterPassport:'Паспорт / ИНН второй стороны',
  counterAddress:'Адрес второй стороны', subject:'Предмет / описание',
  rentAddress:'Адрес объекта аренды', rentAmount:'Аренд. плата (руб/мес)', rentPeriod:'Срок',
  carBrand:'Марка/модель ТС', carYear:'Год выпуска', carVin:'VIN-номер', carPrice:'Цена ТС',
  workDesc:'Описание работ/услуг', workPrice:'Стоимость', workDeadline:'Срок выполнения',
  position:'Должность', employer:'Организация', dismissDate:'Дата увольнения',
  claimSubject:'Предмет претензии', claimAmount:'Сумма требования',
  childName:'ФИО ребёнка', childBirthDate:'Дата рождения ребёнка',
  childPassport:'Св-во о рождении / паспорт ребёнка',
  courtName:'Наименование суда', defendant:'ФИО/наим. ответчика',
  defendantAddress:'Адрес ответчика', claimText:'Суть требования', evidenceList:'Перечень доказательств',
  orgName:'Наименование орг.', orgAddress:'Адрес орг.', orgInn:'ИНН орг.', orgOgrn:'ОГРН орг.',
  giftObject:'Предмет дарения', apartmentAddress:'Адрес квартиры',
  apartmentArea:'Площадь (кв.м)', apartmentPrice:'Стоимость',
  vacationStart:'Дата начала отпуска', vacationEnd:'Дата окончания', vacationDays:'Кол-во дней',
  complaintText:'Текст жалобы/претензии', requestText:'Ваши требования',
  doctorName:'ФИО врача', hospitalName:'Больница/поликлиника',
  bankName:'Банк', bankBik:'БИК', bankAccount:'Р/с', corrAccount:'К/с',
  contractNumber:'Номер договора', contractDate:'Дата договора',
  propertyAddress:'Адрес объекта', sharePercent:'Доля (%)',
  maternityAmount:'Сумма маткапитала', pensionType:'Вид пенсии',
  vehiclePlate:'Гос. номер ТС', accidentDate:'Дата ДТП',
  leaveType:'Вид отпуска', leaveStart:'Дата начала',
  workDays:'Кол-во дней/часов', ndsRate:'Ставка НДС', paymentTerms:'Срок оплаты',
  orderNumber:'Номер приказа', orderDate:'Дата приказа',
  actNumber:'Номер акта', actDate:'Дата акта',
  invoiceNumber:'Номер счёта',
  selfEmployedInn:'ИНН самозанятого', selfEmployedSnils:'СНИЛС самозанятого',
  postalAddress:'Почтовый адрес', kpp:'КПП', ogrn:'ОГРН',
  softwareName:'Название программы/БД', applicationNumber:'Номер заявки (если есть)',
  citizenship:'Гражданство', authorContribution:'Творческий вклад автора',
  publishMode:'Режим публикации', pseudonym:'Псевдоним (если нужен)',
  rightHolder:'Правообладатель (Заявитель)',
};

/* ─── Template type ─────────────────────────────────────────── */
interface Template {
  id:string; icon:string; name:string; desc:string; category:string;
  extras:(keyof DocFields)[];
  build:(f:DocFields)=>string;
}

const fill = (tpl:string, f:DocFields) =>
  tpl.replace(/\{\{(\w+)\}\}/g, (_,k) => (f as unknown as Record<string,string>)[k] || `[${FL[k as keyof DocFields]??k}]`);

/* ─── TEMPLATES ─────────────────────────────────────────────── */
const TEMPLATES: Template[] = [

  /* ══════════ ФИЗИЧЕСКИМ ЛИЦАМ ══════════ */

  /* — Расписки и займы — */
  { id:'receipt', icon:'🤝', category:'Расписки и займы', name:'Расписка о получении денег',
    desc:'Подтверждение получения денежных средств с обязательством возврата',
    extras:['amount','amountWords','returnDate','counterFullName'],
    build:f=>fill(`РАСПИСКА

г. {{city}}, {{today}}

Я, {{fullName}}, {{birthDate}} г.р., паспорт серии {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}}, зарегистрированный(ая) по адресу: {{regAddress}},

получил(а) от {{counterFullName}} денежные средства в размере {{amount}} ({{amountWords}}) рублей 00 копеек.

Обязуюсь вернуть указанную сумму в полном объёме в срок до {{returnDate}}.

Деньги получены, претензий не имею.

{{today}}
_________________________ / {{fullName}} /`, f) },

  { id:'loan', icon:'💰', category:'Расписки и займы', name:'Договор займа денег',
    desc:'ГК РФ ст.807-812: передача денег в долг с условиями возврата',
    extras:['amount','amountWords','returnDate','counterFullName','counterPassport','counterAddress'],
    build:f=>fill(`ДОГОВОР ЗАЙМА № ___
г. {{city}}, {{today}}

Гражданин(ка) {{fullName}}, {{birthDate}} г.р., паспорт серии {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}}, адрес: {{regAddress}}, именуемый(ая) «Займодавец»,

и гражданин(ка) {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}}, именуемый(ая) «Заёмщик»,

заключили настоящий договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА
1.1. Займодавец передаёт Заёмщику денежные средства в размере {{amount}} ({{amountWords}}) рублей (далее — «Займ»), а Заёмщик обязуется возвратить Займ в срок, предусмотренный настоящим договором.

2. УСЛОВИЯ ЗАЙМА
2.1. Займ предоставляется на срок до {{returnDate}}.
2.2. За пользование Займом проценты не начисляются (беспроцентный займ) / начисляются из расчёта ___% в год (нужное указать).
2.3. Возврат производится единовременно в срок, указанный в п. 2.1.

3. ОТВЕТСТВЕННОСТЬ
3.1. В случае нарушения срока возврата Заёмщик уплачивает неустойку в размере 0,1% от суммы долга за каждый день просрочки (ст. 811 ГК РФ).

4. ПРОЧИЕ УСЛОВИЯ
4.1. Настоящий договор составлен в двух экземплярах, по одному для каждой из сторон.
4.2. Споры разрешаются в судебном порядке по месту жительства Займодавца.

ЗАЙМОДАВЕЦ:                    ЗАЁМЩИК:
{{fullName}}                   {{counterFullName}}
_________________              _________________`, f) },

  { id:'receipt_apt', icon:'🏠', category:'Расписки и займы', name:'Расписка от собственника о проживании',
    desc:'Подтверждение права проживания в квартире (для ГУВМ МВД)',
    extras:['counterFullName','counterPassport','rentAddress'],
    build:f=>fill(`РАСПИСКА

Я, {{fullName}}, паспорт серии {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}}, являюсь собственником жилого помещения, расположенного по адресу: {{rentAddress}},

настоящей распиской подтверждаю, что разрешаю гражданину(ке) {{counterFullName}}, паспорт {{counterPassport}}, проживать по указанному адресу.

Претензий не имею.

{{today}}
_________________________ / {{fullName}} /`, f) },

  /* — Доверенности — */
  { id:'poa_gen', icon:'📋', category:'Доверенности', name:'Генеральная доверенность',
    desc:'ГК РФ ст.185-189: полные полномочия на представление интересов',
    extras:['counterFullName','counterPassport','counterAddress','subject'],
    build:f=>fill(`ДОВЕРЕННОСТЬ

г. {{city}}, {{today}}

Я, {{fullName}}, {{birthDate}} г.р., паспорт серии {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}}, зарегистрированный(ая) по адресу: {{regAddress}},

настоящей доверенностью уполномочиваю

гражданина(ку) {{counterFullName}}, {{counterPassport}}, проживающего(ую) по адресу: {{counterAddress}},

{{subject}}

представлять мои интересы во всех компетентных органах и организациях, с правом подписи всех необходимых документов, получения документов и справок, совершения иных юридически значимых действий, связанных с выполнением данного поручения.

Доверенность выдана сроком на три года с правом (без права) передоверия.

_________________________ / {{fullName}} /
(подпись удостоверена нотариусом)`, f) },

  { id:'poa_car', icon:'🚗', category:'Доверенности', name:'Доверенность на управление авто',
    desc:'Право управления, постановки на учёт, прохождения техосмотра',
    extras:['counterFullName','counterPassport','carBrand','carYear','vehiclePlate','carVin'],
    build:f=>fill(`ДОВЕРЕННОСТЬ

г. {{city}}, {{today}}

Я, {{fullName}}, паспорт серии {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}},

доверяю гражданину(ке) {{counterFullName}}, паспорт {{counterPassport}},

управлять принадлежащим мне транспортным средством:
Марка/модель: {{carBrand}}, год выпуска: {{carYear}} г.,
государственный регистрационный номер: {{vehiclePlate}}, VIN: {{carVin}},

а также совершать все необходимые действия, связанные с данным поручением (постановка/снятие с учёта, прохождение технического осмотра, страхование, получение и представление документов и т.д.).

Доверенность выдана сроком на один год.

_________________________ / {{fullName}} /`, f) },

  { id:'poa_ip_tax', icon:'🏛️', category:'Доверенности', name:'Доверенность ИП для налоговой',
    desc:'Представление интересов ИП в ИФНС (форма по практике ФНС)',
    extras:['counterFullName','counterPassport','orgName'],
    build:f=>fill(`ДОВЕРЕННОСТЬ
(ИП на представление интересов в налоговом органе)

г. {{city}}, {{today}}

Индивидуальный предприниматель {{fullName}}, ИНН: {{inn}}, ОГРНИП: {{ogrn}}, адрес: {{regAddress}},

настоящей доверенностью уполномочиваю

{{counterFullName}}, паспорт {{counterPassport}},

представлять мои интересы в Федеральной налоговой службе и её территориальных органах, в том числе: подавать и получать декларации, заявления, справки, уведомления и иные документы, расписываться от моего имени, совершать иные необходимые действия, связанные с налоговым учётом и отчётностью.

Доверенность выдана сроком на один год без права передоверия.

ИП {{fullName}}
ИНН: {{inn}}
_________________`, f) },

  /* — Недвижимость — */
  { id:'sale_apt', icon:'🏢', category:'Недвижимость', name:'Договор купли-продажи квартиры',
    desc:'ГК РФ гл.30: продажа жилого помещения между физическими лицами',
    extras:['apartmentAddress','apartmentArea','apartmentPrice','amountWords','counterFullName','counterPassport','counterAddress'],
    build:f=>fill(`ДОГОВОР КУПЛИ-ПРОДАЖИ КВАРТИРЫ

г. {{city}}, {{today}}

Гражданин(ка) {{fullName}}, {{birthDate}} г.р., паспорт серии {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}}, адрес: {{regAddress}}, именуемый(ая) «Продавец»,

и гражданин(ка) {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}}, именуемый(ая) «Покупатель»,

заключили настоящий договор о нижеследующем:

1. Продавец продаёт, а Покупатель покупает квартиру, расположенную по адресу: {{apartmentAddress}}, общей площадью {{apartmentArea}} кв.м.

2. Цена квартиры составляет {{apartmentPrice}} ({{amountWords}}) рублей. Расчёт производится в полном объёме до подписания настоящего договора / в течение 3 дней с момента подписания (нужное указать).

3. Продавец гарантирует, что квартира свободна от прав третьих лиц, обременений, арестов, запретов и иных ограничений.

4. Передача квартиры производится по передаточному акту, подписанному обеими сторонами.

5. Расходы по государственной регистрации перехода права собственности несёт Покупатель.

6. Настоящий договор составлен в 3 экземплярах: по одному для каждой из сторон и один — для органа государственной регистрации.

ПРОДАВЕЦ:                          ПОКУПАТЕЛЬ:
{{fullName}}                       {{counterFullName}}
_________________                  _________________`, f) },

  { id:'rent', icon:'🏠', category:'Недвижимость', name:'Договор найма жилого помещения',
    desc:'ГК РФ гл.35: сдача квартиры физическому лицу',
    extras:['rentAddress','rentAmount','rentPeriod','counterFullName','counterPassport','counterAddress','amount'],
    build:f=>fill(`ДОГОВОР НАЙМА ЖИЛОГО ПОМЕЩЕНИЯ № ___

г. {{city}}, {{today}}

Гражданин(ка) {{fullName}}, паспорт серии {{passportSeries}} № {{passportNumber}}, адрес: {{regAddress}}, именуемый(ая) «Наймодатель»,

и гражданин(ка) {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}}, именуемый(ая) «Наниматель»,

заключили настоящий договор о нижеследующем:

1. Наймодатель предоставляет Нанимателю жилое помещение по адресу: {{rentAddress}} для проживания.
2. Срок найма: {{rentPeriod}}.
3. Плата за найм составляет {{rentAmount}} рублей в месяц. Оплата производится не позднее ___ числа каждого месяца.
4. Страховой депозит (залог): {{amount}} рублей — возвращается Нанимателю после окончания срока при отсутствии повреждений.
5. Наниматель обязан содержать помещение в надлежащем состоянии, своевременно вносить плату.
6. Наймодатель обязан передать помещение в пригодном для проживания состоянии.
7. По соглашению сторон договор может быть расторгнут досрочно с уведомлением за 30 дней.

НАЙМОДАТЕЛЬ:                       НАНИМАТЕЛЬ:
{{fullName}}                       {{counterFullName}}
_________________                  _________________`, f) },

  { id:'gift', icon:'🎁', category:'Недвижимость', name:'Договор дарения',
    desc:'ГК РФ гл.32: безвозмездная передача имущества',
    extras:['giftObject','counterFullName','counterPassport','counterAddress'],
    build:f=>fill(`ДОГОВОР ДАРЕНИЯ

г. {{city}}, {{today}}

Гражданин(ка) {{fullName}}, {{birthDate}} г.р., паспорт серии {{passportSeries}} № {{passportNumber}}, адрес: {{regAddress}}, именуемый(ая) «Даритель»,

и гражданин(ка) {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}}, именуемый(ая) «Одаряемый»,

заключили настоящий договор о нижеследующем:

1. Даритель безвозмездно передаёт в собственность Одаряемому: {{giftObject}}.
2. Одаряемый принимает дар в том состоянии, в котором он находится на момент подписания договора.
3. Даритель гарантирует, что передаваемое имущество не обременено правами третьих лиц, не заложено, под арестом не состоит.
4. Переход права собственности подлежит государственной регистрации (для недвижимости).

ДАРИТЕЛЬ:                          ОДАРЯЕМЫЙ:
{{fullName}}                       {{counterFullName}}
_________________                  _________________`, f) },

  /* — Транспорт — */
  { id:'sale_car', icon:'🚗', category:'Транспорт', name:'Договор купли-продажи ТС (ДКП)',
    desc:'Продажа автомобиля между физическими лицами',
    extras:['carBrand','carYear','vehiclePlate','carVin','carPrice','amountWords','counterFullName','counterPassport','counterAddress'],
    build:f=>fill(`ДОГОВОР КУПЛИ-ПРОДАЖИ ТРАНСПОРТНОГО СРЕДСТВА

г. {{city}}, {{today}}

Гражданин(ка) {{fullName}}, паспорт серии {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}}, адрес: {{regAddress}}, именуемый(ая) «Продавец»,

и гражданин(ка) {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}}, именуемый(ая) «Покупатель»,

заключили настоящий договор о нижеследующем:

1. Продавец продаёт, а Покупатель покупает транспортное средство:
   Марка, модель: {{carBrand}}
   Год выпуска: {{carYear}}
   Идентификационный номер (VIN): {{carVin}}
   Государственный регистрационный знак: {{vehiclePlate}}
   Паспорт ТС (ПТС): серия ___ № ___

2. Продавец гарантирует, что ТС до заключения настоящего договора никому не продано, не заложено, не является предметом спора, под арестом не состоит.

3. Цена ТС составляет {{carPrice}} ({{amountWords}}) рублей. Расчёт произведён полностью до подписания настоящего договора.

4. Техническое состояние ТС — удовлетворительное / хорошее, претензий по состоянию Покупатель не имеет.

5. Настоящий договор составлен в двух экземплярах, имеющих равную юридическую силу.

ПРОДАВЕЦ:                          ПОКУПАТЕЛЬ:
{{fullName}}                       {{counterFullName}}
_________________                  _________________`, f) },

  { id:'osago_claim', icon:'💥', category:'Транспорт', name:'Претензия в страховую (ОСАГО/КАСКО)',
    desc:'ФЗ об ОСАГО ст.16.1: требование страхового возмещения',
    extras:['orgName','orgAddress','vehiclePlate','accidentDate','amount','contractNumber'],
    build:f=>fill(`ПРЕТЕНЗИЯ

Руководителю {{orgName}}
{{orgAddress}}

От: {{fullName}}, {{regAddress}}, тел.: {{phone}}

{{today}}

Уважаемый руководитель!

В результате ДТП, произошедшего {{accidentDate}}, было повреждено моё транспортное средство государственный регистрационный знак {{vehiclePlate}}. Страховой полис ОСАГО/КАСКО № {{contractNumber}}.

Страховая организация выплатила страховое возмещение в размере, не соответствующем действительному ущербу / отказала в выплате страхового возмещения, что является нарушением ФЗ «Об обязательном страховании гражданской ответственности владельцев транспортных средств».

На основании ст. 16.1 ФЗ «Об ОСАГО», ст. 12 ЗоЗПП РФ, требую в течение 10 рабочих дней с момента получения настоящей претензии:
— произвести страховую выплату в размере {{amount}} рублей;
— перечислить денежные средства по реквизитам: __________________.

При неудовлетворении требований в установленный срок буду вынужден(а) обратиться в суд с иском о взыскании страхового возмещения, неустойки (1% от суммы за каждый день просрочки), штрафа 50%, компенсации морального вреда и судебных расходов.

_________________________ / {{fullName}} /`, f) },

  /* — Семья и дети — */
  { id:'matcap', icon:'👨‍👩‍👧', category:'Семья и дети', name:'Заявление на маткапитал (СФР)',
    desc:'Приказ Минтруда №889н: распоряжение средствами МСК',
    extras:['childName','childBirthDate','childPassport','maternityAmount','subject','snils'],
    build:f=>fill(`Государственное учреждение — Отделение
Социального фонда Российской Федерации
по ________________ области/республике

От: {{fullName}},
СНИЛС: {{snils}},
адрес: {{regAddress}},
тел.: {{phone}}

ЗАЯВЛЕНИЕ
о распоряжении средствами (частью средств) материнского (семейного) капитала

Прошу направить средства МСК в размере {{maternityAmount}} рублей на:
{{subject}}

Сведения о ребёнке, рождение (усыновление) которого дало право на МСК:
ФИО: {{childName}}
Дата рождения: {{childBirthDate}}
Документ: {{childPassport}}

Подтверждаю достоверность представленных сведений.

{{today}}
_________________________ / {{fullName}} /

Приложение:
1. Паспорт заявителя
2. Сертификат на МСК
3. СНИЛС заявителя
4. Документы, подтверждающие цель использования средств`, f) },

  { id:'alimony', icon:'⚖️', category:'Семья и дети', name:'Исковое заявление на алименты',
    desc:'ГПК РФ ст.131, СК РФ ст.80-81: взыскание алиментов на ребёнка',
    extras:['courtName','counterFullName','counterAddress','childName','childBirthDate','amount'],
    build:f=>fill(`В {{courtName}}
Истец: {{fullName}},
{{regAddress}}, тел.: {{phone}}
Ответчик: {{counterFullName}},
{{counterAddress}}

ИСКОВОЕ ЗАЯВЛЕНИЕ
о взыскании алиментов на содержание несовершеннолетнего ребёнка

Я являюсь матерью/отцом несовершеннолетнего(ей) {{childName}}, {{childBirthDate}} г.р.

Ответчик {{counterFullName}} является отцом/матерью ребёнка и уклоняется от его содержания. Соглашение об уплате алиментов не заключалось.

В соответствии со ст. 80, 81 СК РФ прошу суд:

Взыскать с {{counterFullName}} в мою пользу алименты на содержание {{childName}} в размере {{amount}} рублей ежемесячно (или в доле заработка: 1/4 на одного ребёнка) начиная с даты подачи настоящего заявления и до совершеннолетия ребёнка.

Приложение:
1. Свидетельство о рождении ребёнка
2. Свидетельство о браке / его расторжении
3. Справка о составе семьи
4. Документы о доходах

{{today}}
_________________________ / {{fullName}} /`, f) },

  { id:'divorce', icon:'💔', category:'Семья и дети', name:'Исковое заявление о расторжении брака',
    desc:'СК РФ ст.21-23, ГПК РФ ст.131: развод через суд',
    extras:['courtName','counterFullName','counterAddress','contractDate'],
    build:f=>fill(`В {{courtName}}
Истец: {{fullName}}, {{regAddress}}, тел.: {{phone}}
Ответчик: {{counterFullName}}, {{counterAddress}}

ИСКОВОЕ ЗАЯВЛЕНИЕ
о расторжении брака

Между мной и {{counterFullName}} {{contractDate}} был зарегистрирован брак (свидетельство о регистрации брака серия ___ № ___).

Совместная жизнь и сохранение семьи невозможны ввиду: __________________.

На основании ст. 21 СК РФ прошу суд:

1. Расторгнуть брак между {{fullName}} и {{counterFullName}}.

Приложение:
1. Свидетельство о заключении брака
2. Квитанция об уплате госпошлины (650 руб.)
3. Копия искового заявления для ответчика

{{today}}
_________________________ / {{fullName}} /`, f) },

  { id:'child_travel', icon:'✈️', category:'Семья и дети', name:'Согласие на выезд ребёнка за рубеж',
    desc:'ФЗ №114-ФЗ ст.20: нотариальное согласие родителя на выезд',
    extras:['childName','childBirthDate','childPassport','counterFullName','subject'],
    build:f=>fill(`СОГЛАСИЕ НА ВЫЕЗД НЕСОВЕРШЕННОЛЕТНЕГО ЗА ПРЕДЕЛЫ РФ

г. {{city}}, {{today}}

Я, {{fullName}}, {{birthDate}} г.р., паспорт серии {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}}, зарегистрированный(ая) по адресу: {{regAddress}},

являясь матерью/отцом (законным представителем) несовершеннолетнего(ей):
ФИО: {{childName}}, дата рождения: {{childBirthDate}},
документ: {{childPassport}},

даю своё согласие на выезд несовершеннолетнего за пределы Российской Федерации в сопровождении {{counterFullName}} в страну(ы): {{subject}}.

Срок выезда: с ___________ по ___________.

Основание: ст. 20 Федерального закона от 15.08.1996 № 114-ФЗ.

_________________________ / {{fullName}} /
(подпись нотариально удостоверяется)`, f) },

  /* — ЖКХ — */
  { id:'jkh_complaint', icon:'🏗️', category:'ЖКХ', name:'Жалоба на управляющую компанию',
    desc:'ЖК РФ, Правила № 416: нарушения содержания жилого фонда',
    extras:['orgName','orgAddress','propertyAddress','complaintText','requestText'],
    build:f=>fill(`В Государственную жилищную инспекцию
_________________ области/республики

Также: в Управляющую организацию {{orgName}}, {{orgAddress}}

От: {{fullName}}, {{regAddress}}, тел.: {{phone}}

ЖАЛОБА

Я являюсь собственником / нанимателем жилого помещения по адресу: {{propertyAddress}}.

Управление многоквартирным домом осуществляет {{orgName}}, которая ненадлежащим образом исполняет обязанности по содержанию и ремонту общего имущества МКД.

{{complaintText}}

Данные нарушения противоречат требованиям ЖК РФ, Правил содержания общего имущества в МКД (Постановление Правительства РФ № 491), Правил осуществления деятельности по управлению МКД (Постановление № 416).

На основании ст. 20 ЖК РФ прошу:
{{requestText}}

{{today}}
_________________________ / {{fullName}} /`, f) },

  { id:'jkh_recalc', icon:'💧', category:'ЖКХ', name:'Заявление о перерасчёте ЖКУ',
    desc:'Постановление Правительства №354 п.86,90: перерасчёт за период отсутствия',
    extras:['orgName','vacationStart','vacationEnd','complaintText'],
    build:f=>fill(`Руководителю
{{orgName}}

От: {{fullName}},
{{regAddress}}, тел.: {{phone}}

ЗАЯВЛЕНИЕ о перерасчёте платы за коммунальные услуги

Прошу произвести перерасчёт платы за коммунальные услуги (холодное/горячее водоснабжение, водоотведение) за период с {{vacationStart}} по {{vacationEnd}} в связи с временным отсутствием по адресу: {{regAddress}}.

Основание: {{complaintText}} (п. 86, 90, 91 Правил предоставления коммунальных услуг, утв. Постановлением Правительства РФ № 354 от 06.05.2011).

Приложение: документы, подтверждающие временное отсутствие.

{{today}}
_________________________ / {{fullName}} /`, f) },

  { id:'ddu_claim', icon:'🏚️', category:'ЖКХ', name:'Претензия застройщику по ДДУ',
    desc:'ФЗ №214-ФЗ ст.6,7: нарушение сроков, качество строительства',
    extras:['orgName','orgAddress','contractNumber','contractDate','apartmentAddress','amount','complaintText'],
    build:f=>fill(`Генеральному директору {{orgName}}
{{orgAddress}}

От: {{fullName}},
{{regAddress}}, тел.: {{phone}}

ПРЕТЕНЗИЯ

Между мной и {{orgName}} заключён договор участия в долевом строительстве № {{contractNumber}} от {{contractDate}} в отношении квартиры по адресу: {{apartmentAddress}}.

{{complaintText}}

В соответствии с ч. 2 ст. 6, ч. 1 ст. 7 Федерального закона № 214-ФЗ «Об участии в долевом строительстве» требую в течение 10 рабочих дней:

1. Выплатить неустойку (пеню) / устранить выявленные недостатки на сумму {{amount}} рублей.
2. Предоставить письменный ответ на настоящую претензию.

В случае неудовлетворения претензии обращусь в суд с требованием о взыскании суммы, штрафа 50%, морального вреда и судебных расходов.

{{today}}
_________________________ / {{fullName}} /`, f) },

  /* — Суд и иски — */
  { id:'claim_gen', icon:'⚖️', category:'Суд и иски', name:'Исковое заявление (общий шаблон)',
    desc:'ГПК РФ ст.131-132: универсальный иск в суд общей юрисдикции',
    extras:['courtName','defendant','defendantAddress','claimText','claimAmount','evidenceList'],
    build:f=>fill(`В {{courtName}}
Истец: {{fullName}},
{{regAddress}}, тел.: {{phone}}
Ответчик: {{defendant}},
{{defendantAddress}}
Цена иска: {{claimAmount}} рублей
Госпошлина: _______ рублей

ИСКОВОЕ ЗАЯВЛЕНИЕ

{{claimText}}

На основании изложенного, руководствуясь ст. 131–132 ГПК РФ, прошу суд:

1. Взыскать с {{defendant}} в пользу {{fullName}} денежные средства в размере {{claimAmount}} рублей.
2. Взыскать с {{defendant}} расходы по уплате государственной пошлины.

Приложение:
1. {{evidenceList}}
2. Квитанция об уплате госпошлины
3. Копии искового заявления по числу ответчиков

{{today}}
_________________________ / {{fullName}} /`, f) },

  { id:'appeal', icon:'📜', category:'Суд и иски', name:'Апелляционная жалоба',
    desc:'ГПК РФ ст.320-322: обжалование решения суда первой инстанции',
    extras:['courtName','defendant','claimText','claimAmount'],
    build:f=>fill(`В {{courtName}}
(через суд, вынесший решение)

Апеллянт (истец/ответчик): {{fullName}},
{{regAddress}}, тел.: {{phone}}

АПЕЛЛЯЦИОННАЯ ЖАЛОБА
на решение __________________ суда от «___» __________ 20__ г. по делу № ___

Решением __________________ суда от «___» __________ 20__ г. постановлено: __________________.

Считаю данное решение незаконным и необоснованным по следующим основаниям:
{{claimText}}

На основании ст. 320, 321, 328 ГПК РФ прошу:

Решение __________________ суда от «___» __________ 20__ г. отменить и принять новое решение, удовлетворив исковые требования на сумму {{claimAmount}} рублей.

Приложение:
1. Копия обжалуемого решения
2. Документы, обосновывающие доводы жалобы
3. Квитанция об оплате госпошлины (150 руб. для физлиц)

{{today}}
_________________________ / {{fullName}} /`, f) },

  /* — Жалобы в органы — */
  { id:'prosecutor', icon:'🏛️', category:'Жалобы в органы', name:'Жалоба в прокуратуру',
    desc:'ФЗ «О прокуратуре РФ» ст.10: обращение по факту нарушения закона',
    extras:['orgName','complaintText','requestText'],
    build:f=>fill(`Прокурору {{orgName}}

От: {{fullName}},
{{regAddress}}, тел.: {{phone}}, e-mail: ___________

ЖАЛОБА

{{complaintText}}

Считаю, что указанными действиями (бездействием) нарушены мои права, предусмотренные: __________________.

На основании ст. 10 Федерального закона «О прокуратуре Российской Федерации» прошу:
{{requestText}}

О результатах рассмотрения прошу сообщить в письменном виде по указанному адресу.

Приложение: копии документов, подтверждающих изложенные факты.

{{today}}
_________________________ / {{fullName}} /`, f) },

  { id:'rospotreb', icon:'🧪', category:'Жалобы в органы', name:'Жалоба в Роспотребнадзор',
    desc:'ФЗ «О защите прав потребителей», ФЗ «О санитарно-эпидемиологическом благополучии»',
    extras:['orgName','orgAddress','complaintText','requestText'],
    build:f=>fill(`В Управление Роспотребнадзора
по _________________ области/республике

От: {{fullName}},
{{regAddress}}, тел.: {{phone}}

ЖАЛОБА

На действия (бездействие): {{orgName}}, {{orgAddress}}

{{complaintText}}

Мои права нарушены в соответствии с нормами Закона РФ «О защите прав потребителей», санитарными правилами и нормами.

Прошу:
{{requestText}}

Приложение: документы, подтверждающие изложенные факты.

{{today}}
_________________________ / {{fullName}} /`, f) },

  { id:'police', icon:'👮', category:'Жалобы в органы', name:'Заявление в полицию',
    desc:'УПК РФ ст.141: заявление о преступлении или правонарушении',
    extras:['complaintText','evidenceList'],
    build:f=>fill(`Начальнику ОП (ОМВД России) по ____________
От: {{fullName}},
{{regAddress}}, тел.: {{phone}}

ЗАЯВЛЕНИЕ о совершении преступления (правонарушения)

Прошу зарегистрировать настоящее заявление и принять меры к установлению и привлечению к ответственности виновных лиц.

{{complaintText}}

Доказательства и свидетели: {{evidenceList}}.

Об уголовной ответственности по ст. 306 УК РФ за заведомо ложный донос предупреждён(а).

{{today}}
_________________________ / {{fullName}} /`, f) },

  { id:'fns_complaint', icon:'🧾', category:'Жалобы в органы', name:'Жалоба на действия налоговой (ФНС)',
    desc:'НК РФ ст.139: обжалование действий/решений налогового органа',
    extras:['orgName','orgAddress','complaintText','requestText'],
    build:f=>fill(`В УФНС России по ____________________
(через {{orgName}}, {{orgAddress}})

От: {{fullName}}, ИНН: {{inn}},
{{regAddress}}, тел.: {{phone}}

ЖАЛОБА
на действия (бездействие) {{orgName}}

{{complaintText}}

На основании ст. 137, 139 НК РФ прошу:
{{requestText}}

Приложения: копии обжалуемых документов.

{{today}}
_________________________ / {{fullName}} /`, f) },

  /* — Финансы и налоги — */
  { id:'ndfl_return', icon:'💳', category:'Финансы и налоги', name:'Заявление на возврат НДФЛ',
    desc:'НК РФ ст.78,220: налоговый вычет на имущество/лечение/обучение',
    extras:['orgName','amount','bankName','bankAccount','bankBik','corrAccount','subject'],
    build:f=>fill(`В ИФНС России № ___ по ________________
(через {{orgName}})

От: {{fullName}}, ИНН: {{inn}},
{{regAddress}}, тел.: {{phone}}

ЗАЯВЛЕНИЕ
о возврате суммы излишне уплаченного налога

На основании ст. 78 НК РФ прошу возвратить сумму излишне уплаченного налога на доходы физических лиц в размере {{amount}} рублей в связи с: {{subject}}.

Реквизиты для перечисления:
Банк: {{bankName}}, БИК: {{bankBik}}
Расчётный счёт: {{bankAccount}}
Корреспондентский счёт: {{corrAccount}}

К заявлению прилагаю:
1. Налоговая декларация по форме 3-НДФЛ
2. Документы, подтверждающие право на вычет

{{today}}
_________________________ / {{fullName}} /`, f) },

  { id:'bank_claim', icon:'🏦', category:'Финансы и налоги', name:'Претензия в банк',
    desc:'ФЗ «О банках» ст.29, ЗоЗПП: незаконные комиссии, отказ в выплате',
    extras:['bankName','orgAddress','contractNumber','contractDate','complaintText','amount','requestText'],
    build:f=>fill(`Председателю Правления
{{bankName}}
{{orgAddress}}

От: {{fullName}},
{{regAddress}}, тел.: {{phone}}

ПРЕТЕНЗИЯ

Между мной и {{bankName}} заключён договор № {{contractNumber}} от {{contractDate}}.

{{complaintText}}

На основании Федерального закона «О банках и банковской деятельности», Закона РФ «О защите прав потребителей», в течение 10 рабочих дней прошу:
{{requestText}} (на сумму {{amount}} рублей).

При неудовлетворении претензии обращусь с жалобой в Банк России, финансовому уполномоченному и в суд.

{{today}}
_________________________ / {{fullName}} /`, f) },

  /* — Медицина — */
  { id:'med_complaint', icon:'🏥', category:'Медицина', name:'Жалоба на действия медработника',
    desc:'ФЗ №323-ФЗ ст.19,79: некачественная медицинская помощь',
    extras:['hospitalName','doctorName','complaintText','requestText'],
    build:f=>fill(`Главному врачу {{hospitalName}}

Копии: Министерство здравоохранения _______________,
Росздравнадзор

От: {{fullName}},
{{regAddress}}, тел.: {{phone}}

ЖАЛОБА

{{complaintText}}

Данные действия (бездействие) {{doctorName}} нарушают мои права, предусмотренные ст. 19 Федерального закона от 21.11.2011 № 323-ФЗ «Об основах охраны здоровья граждан в Российской Федерации».

Прошу:
{{requestText}}

О результатах рассмотрения прошу сообщить в установленный законом срок.

{{today}}
_________________________ / {{fullName}} /`, f) },

  { id:'med_consent', icon:'💊', category:'Медицина', name:'Согласие на медицинское вмешательство',
    desc:'ФЗ №323-ФЗ ст.20: информированное добровольное согласие',
    extras:['hospitalName','doctorName','subject'],
    build:f=>fill(`ИНФОРМИРОВАННОЕ ДОБРОВОЛЬНОЕ СОГЛАСИЕ
на медицинское вмешательство

Я, {{fullName}}, {{birthDate}} г.р., паспорт серии {{passportSeries}} № {{passportNumber}},

даю добровольное согласие на проведение мне медицинского вмешательства: {{subject}}, в медицинской организации {{hospitalName}}, лечащим врачом (специалистом) {{doctorName}}.

Мне в доступной форме разъяснены: сущность, цели и методы вмешательства; ожидаемые результаты и их вероятность; риски и осложнения; альтернативные методы лечения.

Все вопросы мне разъяснены. С перечисленными сведениями ознакомлен(а) и согласен(а).

Дата: {{today}}
_________________________ / {{fullName}} /`, f) },

  /* — Потребитель — */
  { id:'claim_consumer', icon:'🛒', category:'Потребитель', name:'Претензия на некачественный товар',
    desc:'ЗоЗПП ст.18: возврат, замена или ремонт некачественного товара',
    extras:['orgName','orgAddress','claimSubject','amount','contractDate'],
    build:f=>fill(`Директору {{orgName}}
{{orgAddress}}

От: {{fullName}},
{{regAddress}}, тел.: {{phone}}

ПРЕТЕНЗИЯ

«{{contractDate}}» я приобрёл(а) в {{orgName}} товар: {{claimSubject}} стоимостью {{amount}} рублей (кассовый/товарный чек, гарантийный талон прилагаются).

В ходе использования товара был обнаружен(ы) следующий(е) существенный(е) недостаток(и), возникший(е) не по моей вине: __________________.

На основании ст. 18 Закона РФ «О защите прав потребителей» требую в течение 10 дней с момента получения настоящей претензии:
□ вернуть уплаченную сумму {{amount}} рублей;
□ заменить товар на аналогичный надлежащего качества;
□ безвозмездно устранить недостатки товара.

При отказе в удовлетворении требований буду вынужден(а) обратиться в суд с дополнительными требованиями о взыскании неустойки и штрафа 50%.

{{today}}
_________________________ / {{fullName}} /`, f) },

  /* — Договоры (личные) — */
  { id:'contractor', icon:'🔧', category:'Договоры (личные)', name:'Договор подряда',
    desc:'ГК РФ гл.37 ст.702: выполнение строительных и бытовых работ',
    extras:['workDesc','workPrice','amountWords','workDeadline','counterFullName','counterPassport','counterAddress'],
    build:f=>fill(`ДОГОВОР БЫТОВОГО ПОДРЯДА № ___

г. {{city}}, {{today}}

Гражданин(ка) {{fullName}}, паспорт серии {{passportSeries}} № {{passportNumber}}, адрес: {{regAddress}}, именуемый(ая) «Подрядчик»,

и гражданин(ка) {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}}, именуемый(ая) «Заказчик»,

заключили настоящий договор о нижеследующем:

1. ПРЕДМЕТ ДОГОВОРА
Подрядчик обязуется выполнить по заданию Заказчика следующие работы: {{workDesc}}.

2. СРОКИ И СТОИМОСТЬ
2.1. Срок выполнения работ: {{workDeadline}}.
2.2. Стоимость работ составляет {{workPrice}} ({{amountWords}}) рублей.
2.3. Оплата производится: __% аванса при подписании; остаток — после подписания акта.

3. ОБЯЗАННОСТИ СТОРОН
3.1. Подрядчик выполняет работы из своих материалов / из материалов Заказчика (нужное указать), надлежащего качества.
3.2. Заказчик обязан принять и оплатить выполненные работы.

4. ОТВЕТСТВЕННОСТЬ
4.1. За нарушение сроков Подрядчик уплачивает неустойку 0,1% в день от стоимости просроченных работ.

ПОДРЯДЧИК:                         ЗАКАЗЧИК:
{{fullName}}                       {{counterFullName}}
_________________                  _________________`, f) },

  { id:'pd_consent', icon:'🔒', category:'Договоры (личные)', name:'Согласие на обработку персональных данных',
    desc:'ФЗ №152-ФЗ ст.9: стандартное согласие субъекта ПД',
    extras:['employer','subject'],
    build:f=>fill(`СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ

Я, {{fullName}}, {{birthDate}} г.р., паспорт серии {{passportSeries}} № {{passportNumber}}, зарегистрированный(ая) по адресу: {{regAddress}},

в соответствии с требованиями Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» даю своё согласие {{employer}} (далее — Оператор) на обработку моих персональных данных:

Состав ПД: фамилия, имя, отчество, дата и место рождения, паспортные данные, адрес, номер телефона, адрес электронной почты, иные данные, указанные в документах.

Цель обработки: {{subject}}.
Способы обработки: сбор, систематизация, накопление, хранение, уточнение, использование, передача (поручение обработки), обезличивание, блокирование, уничтожение.

Срок действия согласия: до достижения цели обработки или до отзыва согласия.

Согласие может быть отозвано путём подачи письменного заявления Оператору.

{{today}}
_________________________ / {{fullName}} /`, f) },

  { id:'transfer_act', icon:'📋', category:'Договоры (личные)', name:'Акт приёма-передачи имущества',
    desc:'Двусторонний акт о передаче имущества/объекта',
    extras:['subject','counterFullName','counterPassport','contractNumber','contractDate'],
    build:f=>fill(`АКТ ПРИЁМА-ПЕРЕДАЧИ ИМУЩЕСТВА

г. {{city}}, {{today}}

Составлен во исполнение договора № {{contractNumber}} от {{contractDate}}.

{{fullName}}, именуемый(ая) «Передающая сторона»,
и {{counterFullName}}, паспорт {{counterPassport}}, именуемый(ая) «Принимающая сторона»,

составили настоящий акт о том, что Передающая сторона передала, а Принимающая сторона приняла в надлежащем состоянии следующее имущество:

{{subject}}

Стороны не имеют взаимных претензий. Имущество передано в удовлетворительном техническом и визуальном состоянии.

ПЕРЕДАЛ:                           ПРИНЯЛ:
{{fullName}}                       {{counterFullName}}
_________________                  _________________`, f) },

  /* — Прочее (личное) — */
  { id:'explanation', icon:'📝', category:'Прочее', name:'Объяснительная записка',
    desc:'Объяснение ситуации на работе или в иных обстоятельствах',
    extras:['employer','position','complaintText'],
    build:f=>fill(`{{employer}}
Руководителю

от {{fullName}},
должность: {{position}}

ОБЪЯСНИТЕЛЬНАЯ ЗАПИСКА

{{complaintText}}

{{today}}
_________________________ / {{fullName}} /`, f) },

  { id:'will', icon:'📜', category:'Прочее', name:'Завещание (шаблон)',
    desc:'ГК РФ гл.62 ст.1118: распоряжение имуществом — нотариальное удостоверение обязательно',
    extras:['subject','counterFullName'],
    build:f=>fill(`ЗАВЕЩАНИЕ

г. {{city}}, {{today}}

Я, {{fullName}}, {{birthDate}} г.р., паспорт серии {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}}, проживающий(ая) по адресу: {{regAddress}},

находясь в здравом уме и твёрдой памяти, действуя добровольно, настоящим завещанием делаю следующее распоряжение:

Всё моё имущество, которое ко дню моей смерти окажется мне принадлежащим, в чём бы оно ни заключалось и где бы ни находилось, завещаю {{counterFullName}}.

В частности: {{subject}}.

Настоящее завещание составлено и подписано в двух экземплярах, один из которых хранится в делах нотариуса, второй — выдан завещателю.

_________________________ / {{fullName}} /
(подписывается в присутствии нотариуса)`, f) },

  { id:'pension', icon:'👴', category:'Прочее', name:'Заявление в СФР о назначении пенсии',
    desc:'ФЗ №400-ФЗ: назначение страховой/социальной/накопительной пенсии',
    extras:['pensionType','snils'],
    build:f=>fill(`В Отделение Социального фонда Российской Федерации
по _________________ области/республике

От: {{fullName}}, {{birthDate}} г.р.,
СНИЛС: {{snils}}, ИНН: {{inn}},
{{regAddress}}, тел.: {{phone}}

ЗАЯВЛЕНИЕ о назначении пенсии

Прошу назначить мне: {{pensionType}}.

Прилагаю:
1. Паспорт гражданина РФ (копия)
2. СНИЛС (копия)
3. Трудовая книжка / сведения о трудовой деятельности (форма СТД-Р или СТД-ПФР)
4. Справки о заработке за 60 месяцев до 01.01.2002 (при наличии)
5. Иные документы (военный билет, справки о льготном стаже и т.д.)

{{today}}
_________________________ / {{fullName}} /`, f) },

  /* ══════════ БИЗНЕС (ИП / ООО) ══════════ */

  /* — Партнёры и клиенты — */
  { id:'act_work', icon:'✅', category:'Партнёры и клиенты', name:'Акт выполненных работ / услуг',
    desc:'Универсальный акт приёмки — самый популярный деловой документ (tochka.com)',
    extras:['actNumber','actDate','contractNumber','contractDate','workDesc','workPrice','amountWords','ndsRate','counterFullName','counterAddress','orgInn','counterPassport'],
    build:f=>fill(`АКТ № {{actNumber}}
о приёмке выполненных работ (оказанных услуг)

г. {{city}}, «___» __________ {{actDate}}

Исполнитель: {{fullName}} (ИП), ИНН: {{inn}}, адрес: {{regAddress}}
Заказчик: {{counterFullName}}, ИНН: {{orgInn}}, адрес: {{counterAddress}}
Основание: Договор № {{contractNumber}} от {{contractDate}}

Исполнитель выполнил(а), а Заказчик принял(а) следующие работы (услуги):

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Наименование                   Ед.  Кол-во  Цена      Сумма
 {{workDesc}}                   усл.   1    {{workPrice}}  {{workPrice}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Итого: {{workPrice}} ({{amountWords}}) рублей, {{ndsRate}}.

Работы (услуги) выполнены в полном объёме, в установленные сроки, с надлежащим качеством. Заказчик претензий по объёму, качеству и срокам не имеет.

ИСПОЛНИТЕЛЬ:                       ЗАКАЗЧИК:
ИП {{fullName}}                    {{counterFullName}}
_________________                  _________________`, f) },

  { id:'invoice', icon:'🧾', category:'Партнёры и клиенты', name:'Счёт на оплату',
    desc:'Бланк счёта для выставления оплаты контрагенту',
    extras:['invoiceNumber','actDate','counterFullName','counterAddress','orgInn','workDesc','workPrice','amountWords','ndsRate','bankName','bankBik','bankAccount','corrAccount'],
    build:f=>fill(`СЧЁТ НА ОПЛАТУ № {{invoiceNumber}}
от «___» __________ {{actDate}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Поставщик (Исполнитель):
{{fullName}} (ИП), ИНН: {{inn}}
Адрес: {{regAddress}}, тел.: {{phone}}
Банк: {{bankName}}, БИК: {{bankBik}}
Р/с: {{bankAccount}}, К/с: {{corrAccount}}

Покупатель (Заказчик):
{{counterFullName}}, ИНН: {{orgInn}}
Адрес: {{counterAddress}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 №  Наименование              Ед.изм.  Кол-во  Цена     Сумма
 1  {{workDesc}}              услуга      1   {{workPrice}}  {{workPrice}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Итого: {{workPrice}} руб.  {{ndsRate}}
К оплате: {{workPrice}} ({{amountWords}}) рублей

Оплатить до: {{returnDate}}

ИП {{fullName}} _________________`, f) },

  { id:'supply_contract', icon:'📦', category:'Партнёры и клиенты', name:'Договор поставки',
    desc:'ГК РФ ст.506: поставка товара (tochka.com — ТОП скачиваний)',
    extras:['orgName','orgInn','ogrn','orgAddress','counterFullName','counterAddress','orgOgrn','subject','amount','amountWords','workDeadline','paymentTerms'],
    build:f=>fill(`ДОГОВОР ПОСТАВКИ № ___

г. {{city}}, {{today}}

{{fullName}} (ИП/ООО «{{orgName}}»), ИНН: {{orgInn}}, ОГРН: {{ogrn}}, адрес: {{orgAddress}}, именуемый(ая) «Поставщик»,

и {{counterFullName}}, адрес: {{counterAddress}}, именуемый(ая) «Покупатель»,

заключили настоящий договор о нижеследующем:

1. ПРЕДМЕТ: Поставщик обязуется передать, а Покупатель принять и оплатить следующий товар: {{subject}}.
2. ЦЕНА: {{amount}} ({{amountWords}}) рублей, {{ndsRate}}.
3. СРОК ПОСТАВКИ: {{workDeadline}}.
4. ОПЛАТА: {{paymentTerms}}.
5. Качество товара должно соответствовать требованиям ГОСТ/ТУ/спецификации.
6. Ответственность: за просрочку поставки — 0,1% от стоимости в день; за просрочку оплаты — 0,1% в день.
7. Споры — в арбитражном суде по месту нахождения Поставщика.

ПОСТАВЩИК:                         ПОКУПАТЕЛЬ:
{{fullName}} ({{orgName}})         {{counterFullName}}
_________________                  _________________`, f) },

  { id:'schot_dogovor', icon:'📄', category:'Партнёры и клиенты', name:'Счёт-договор',
    desc:'Бланк счёта-договора для разовых сделок (tochka.com)',
    extras:['invoiceNumber','actDate','counterFullName','counterAddress','orgInn','workDesc','workPrice','amountWords','ndsRate','paymentTerms','bankName','bankBik','bankAccount','corrAccount'],
    build:f=>fill(`СЧЁТ-ДОГОВОР № {{invoiceNumber}}
от {{actDate}}

Продавец/Исполнитель: {{fullName}} (ИП), ИНН: {{inn}}
Адрес: {{regAddress}}, тел.: {{phone}}
Банк: {{bankName}}, БИК: {{bankBik}}, Р/с: {{bankAccount}}, К/с: {{corrAccount}}

Покупатель/Заказчик: {{counterFullName}}, ИНН: {{orgInn}}
Адрес: {{counterAddress}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 №  Наименование товара/услуги   Кол-во  Цена      Сумма
 1  {{workDesc}}                    1   {{workPrice}} {{workPrice}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Итого: {{workPrice}} ({{amountWords}}) рублей, {{ndsRate}}.

Срок оплаты: {{paymentTerms}}.

Оплата счёта-договора означает согласие с условиями поставки/оказания услуг.

ИП {{fullName}} _________________`, f) },

  { id:'act_sverki', icon:'🔄', category:'Партнёры и клиенты', name:'Акт сверки взаиморасчётов',
    desc:'Взаимная сверка денежных расчётов между контрагентами',
    extras:['counterFullName','orgInn','contractNumber','contractDate','amount','actDate'],
    build:f=>fill(`АКТ СВЕРКИ ВЗАИМОРАСЧЁТОВ
за период: ________________

г. {{city}}, {{actDate}}

Составлен между:
— {{fullName}} (ИП), ИНН: {{inn}}, адрес: {{regAddress}} («Сторона 1»)
— {{counterFullName}}, ИНН: {{orgInn}}, адрес: {{counterAddress}} («Сторона 2»)

по договору № {{contractNumber}} от {{contractDate}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
По данным Стороны 1:

 Дата     Документ              Дебет       Кредит
 ___      Нач. сальдо          {{amount}}
 ___      Счёт/Акт № ___       {{workPrice}}
 ___      Оплата               -              {{workPrice}}
────────────────────────────────────────────────────
 Сальдо конечное (задолженность {{counterFullName}}): {{amount}} руб.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

По данным Стороны 1 задолженность {{counterFullName}} составляет {{amount}} рублей.
По данным Стороны 2: __________________.

СТОРОНА 1:                         СТОРОНА 2:
ИП {{fullName}}                    {{counterFullName}}
_________________                  _________________`, f) },

  { id:'nda_biz', icon:'🔐', category:'Партнёры и клиенты', name:'Соглашение о конфиденциальности (NDA)',
    desc:'Защита коммерческой тайны и конфиденциальной информации (tochka.com)',
    extras:['counterFullName','counterAddress','orgInn','subject','workDeadline'],
    build:f=>fill(`СОГЛАШЕНИЕ О КОНФИДЕНЦИАЛЬНОСТИ (NDA) № ___

г. {{city}}, {{today}}

{{fullName}} (ИП), ИНН: {{inn}}, адрес: {{regAddress}}, — «Сторона 1»,
и {{counterFullName}}, ИНН: {{orgInn}}, адрес: {{counterAddress}}, — «Сторона 2»,

именуемые совместно «Стороны», заключили настоящее соглашение о нижеследующем:

1. Конфиденциальная информация: любые данные, связанные с: {{subject}}, переданные одной Стороной другой.
2. Стороны обязуются не разглашать конфиденциальную информацию третьим лицам без письменного согласия раскрывающей Стороны.
3. Режим конфиденциальности не распространяется на общедоступную информацию.
4. Срок действия соглашения: {{workDeadline}}.
5. За нарушение — возмещение убытков в полном объёме и неустойка __________ рублей.

Сторона 1: {{fullName}} _________________
Сторона 2: {{counterFullName}} _________________`, f) },

  /* — Найм и кадры — */
  { id:'labor_contract_ip', icon:'📃', category:'Найм и кадры', name:'Трудовой договор (ИП — работник)',
    desc:'ТК РФ ст.57: трудовой договор ИП с сотрудником',
    extras:['counterFullName','counterPassport','counterAddress','position','amount','workDeadline','leaveStart'],
    build:f=>fill(`ТРУДОВОЙ ДОГОВОР № ___

г. {{city}}, {{today}}

Индивидуальный предприниматель {{fullName}}, ИНН: {{inn}}, ОГРНИП: {{ogrn}}, адрес: {{regAddress}}, именуемый(ая) «Работодатель»,

и гражданин(ка) {{counterFullName}}, паспорт {{counterPassport}}, адрес: {{counterAddress}}, именуемый(ая) «Работник»,

заключили настоящий трудовой договор о нижеследующем:

1. ПРЕДМЕТ: Работник принимается на работу на должность: {{position}}.
2. ДАТА НАЧАЛА: {{workDeadline}}.
3. ВИД ДОГОВОРА: Бессрочный / Срочный (до {{leaveStart}}) (нужное указать).
4. МЕСТО РАБОТЫ: {{regAddress}}.
5. РЕЖИМ РАБОТЫ: 40 часов в неделю, пн–пт, 09:00–18:00.
6. ОПЛАТА: Должностной оклад {{amount}} рублей в месяц, выплачивается 2 раза: __ и __ числа.
7. ИСПЫТАТЕЛЬНЫЙ СРОК: 3 месяца (ст. 70 ТК РФ).
8. ОТПУСК: 28 календарных дней ежегодно (ст. 115 ТК РФ).
9. СТРАХОВАНИЕ: Работодатель уплачивает страховые взносы в установленном законом порядке.

РАБОТОДАТЕЛЬ:                      РАБОТНИК:
ИП {{fullName}}                    {{counterFullName}}
_________________                  _________________`, f) },

  { id:'gph_selfemployed', icon:'🤳', category:'Найм и кадры', name:'Договор ГПХ с самозанятым',
    desc:'НК РФ ст.422, ФЗ №422-ФЗ: договор с плательщиком НПД (tochka.com ТОП)',
    extras:['counterFullName','selfEmployedInn','selfEmployedSnils','counterAddress','workDesc','workPrice','amountWords','workDeadline','returnDate'],
    build:f=>fill(`ДОГОВОР ГРАЖДАНСКО-ПРАВОВОГО ХАРАКТЕРА
(с физическим лицом, применяющим режим НПД)

г. {{city}}, {{today}}

{{fullName}} (ИП/ООО), ИНН: {{inn}}, адрес: {{regAddress}}, — «Заказчик»,
и {{counterFullName}}, ИНН: {{selfEmployedInn}}, СНИЛС: {{selfEmployedSnils}}, адрес: {{counterAddress}}, — «Исполнитель» (плательщик НПД / самозанятый),

заключили настоящий договор:

1. ПРЕДМЕТ: Исполнитель оказывает следующие услуги: {{workDesc}}.
2. СРОК: с {{workDeadline}} по {{returnDate}}.
3. ВОЗНАГРАЖДЕНИЕ: {{workPrice}} ({{amountWords}}) рублей.
4. СТАТУС ИСПОЛНИТЕЛЯ: Исполнитель является плательщиком НПД на дату заключения договора. Заказчик не является налоговым агентом.
5. Исполнитель обязан предоставить Заказчику чек из приложения «Мой налог» не позднее 9-го числа месяца, следующего за расчётным.
6. При утрате Исполнителем статуса самозанятого он уведомляет Заказчика не позднее 3 рабочих дней. В этом случае Заказчик вправе расторгнуть договор без компенсации.
7. Договор не является трудовым. Исполнитель самостоятельно организует своё рабочее место и режим работы.

ЗАКАЗЧИК:                          ИСПОЛНИТЕЛЬ:
{{fullName}}                       {{counterFullName}}
_________________                  _________________`, f) },

  { id:'dismiss', icon:'🚪', category:'Найм и кадры', name:'Заявление об увольнении',
    desc:'ТК РФ ст.80: увольнение по собственному желанию',
    extras:['employer','position','dismissDate'],
    build:f=>fill(`{{employer}}
Директору / Руководителю

от {{fullName}},
должность: {{position}}

ЗАЯВЛЕНИЕ

Прошу уволить меня по собственному желанию {{dismissDate}} в соответствии со ст. 80 Трудового кодекса Российской Федерации.

{{today}}
_________________________ / {{fullName}} /`, f) },

  { id:'vacation_app', icon:'🌴', category:'Найм и кадры', name:'Заявление на отпуск',
    desc:'ТК РФ ст.114-128: ежегодный оплачиваемый или иной отпуск',
    extras:['employer','position','leaveType','vacationStart','vacationEnd','vacationDays'],
    build:f=>fill(`{{employer}}
Руководителю

от {{fullName}},
должность: {{position}}

ЗАЯВЛЕНИЕ

Прошу предоставить мне {{leaveType}} отпуск
с {{vacationStart}} по {{vacationEnd}} включительно,
продолжительностью {{vacationDays}} календарных дней.

{{today}}
_________________________ / {{fullName}} /`, f) },

  { id:'maternity_leave', icon:'👶', category:'Найм и кадры', name:'Заявление на декретный отпуск',
    desc:'ТК РФ ст.255,256: отпуск по БиР и по уходу за ребёнком',
    extras:['employer','position','childName','childBirthDate','leaveStart'],
    build:f=>fill(`{{employer}}
Руководителю

от {{fullName}},
должность: {{position}}

ЗАЯВЛЕНИЕ

Прошу предоставить мне отпуск по уходу за ребёнком {{childName}}, {{childBirthDate}} г.р., с {{leaveStart}} до достижения ребёнком возраста 3-х лет (ст. 256 ТК РФ).

Прошу назначить и выплачивать ежемесячное пособие по уходу за ребёнком до достижения им 1,5 лет (ст. 14 ФЗ №255-ФЗ).

К заявлению прилагаю: свидетельство о рождении ребёнка, справку с места работы (учёбы) другого родителя о неиспользовании отпуска.

{{today}}
_________________________ / {{fullName}} /`, f) },

  { id:'order_hire', icon:'📋', category:'Найм и кадры', name:'Приказ о приёме на работу',
    desc:'ТК РФ ст.68, унифицированная форма Т-1',
    extras:['counterFullName','position','amount','leaveStart','workDeadline','orderNumber','orderDate'],
    build:f=>fill(`ПРИКАЗ (РАСПОРЯЖЕНИЕ)
о приёме работника на работу

№ {{orderNumber}}                              {{orderDate}}

Принять на работу: {{counterFullName}}
Дата приёма: {{leaveStart}}
Структурное подразделение: ________________
Должность (профессия): {{position}}
Условия приёма: постоянно / по срочному договору до {{workDeadline}} (нужное указать)
Оклад: {{amount}} рублей
Испытательный срок: 3 месяца
Основание: трудовой договор № ___ от {{orderDate}}

Руководитель организации:
_________________________ / {{fullName}} /

С приказом ознакомлен(а):
«___» ________ 20__ г. _________________________ / {{counterFullName}} /`, f) },

  { id:'labor_complaint', icon:'⚠️', category:'Найм и кадры', name:'Жалоба в трудовую инспекцию (ГИТ)',
    desc:'ТК РФ ст.356: нарушение трудовых прав работодателем',
    extras:['orgName','orgAddress','position','complaintText','requestText'],
    build:f=>fill(`В Государственную инспекцию труда
в _________________ (субъект РФ)

От: {{fullName}},
{{regAddress}}, тел.: {{phone}}
Работодатель: {{orgName}}, {{orgAddress}}

ЖАЛОБА

Я работаю (работал(а)) в {{orgName}} на должности {{position}}.

{{complaintText}}

Указанные действия (бездействие) работодателя нарушают следующие нормы ТК РФ: __________________.

На основании ст. 356 ТК РФ прошу:
{{requestText}}

Приложение: копии трудового договора, приказов, расчётных листков и иных документов.

{{today}}
_________________________ / {{fullName}} /`, f) },

  /* — Налоги и бизнес — */
  { id:'usn_notice', icon:'📊', category:'Налоги и бизнес', name:'Уведомление о переходе на УСН',
    desc:'НК РФ ст.346.13: форма 26.2-1 (заявление на УСН)',
    extras:['orgName','orgInn','ogrn','subject'],
    build:f=>fill(`Форма № 26.2-1 (КНД 1150001)

В ИФНС России № ___ по _________________

УВЕДОМЛЕНИЕ
о переходе на упрощённую систему налогообложения

Полное наименование / ФИО: {{fullName}} (ИП/ООО «{{orgName}}»)
ИНН: {{inn}} / {{orgInn}}, ОГРН: {{ogrn}}
Адрес: {{regAddress}}

Уведомляю о переходе на упрощённую систему налогообложения с 1 января ______ года.

Объект налогообложения: {{subject}} (доходы / доходы минус расходы).

Получено доходов за 9 месяцев ______ года: ________ рублей.
Остаточная стоимость ОС: ________ рублей.
Средняя численность работников: ______ чел.

{{today}}
Подпись: _________________________ / {{fullName}} /`, f) },

  { id:'patent_app', icon:'🏷️', category:'Налоги и бизнес', name:'Заявление на получение патента',
    desc:'НК РФ гл.26.5: форма 26.5-1 для ИП на патентной системе',
    extras:['orgInn','subject','leaveStart','returnDate'],
    build:f=>fill(`Форма № 26.5-1

В ИФНС России № ___ по _________________

ЗАЯВЛЕНИЕ
на получение патента

Индивидуальный предприниматель: {{fullName}}
ИНН: {{inn}}, СНИЛС: {{snils}}
Адрес места жительства: {{regAddress}}, тел.: {{phone}}

Прошу выдать патент на право применения патентной системы налогообложения.

Вид предпринимательской деятельности: {{subject}}
Срок действия патента: с {{leaveStart}} по {{returnDate}} (не более 12 месяцев).
Субъект РФ: _________________.
Количество работников: ____ чел.

{{today}}
_________________________ / {{fullName}} /`, f) },

  { id:'enp_payment', icon:'💵', category:'Налоги и бизнес', name:'Уведомление об исчисленных суммах налогов (ЕНП)',
    desc:'НК РФ ст.58 п.9: уведомление по ЕНП до срока сдачи декларации',
    extras:['orgInn','kpp','amount','actDate'],
    build:f=>fill(`УВЕДОМЛЕНИЕ
об исчисленных суммах налогов, авансовых платежей по налогам,
страховых взносов (форма по КНД 1110355)

ИНН: {{inn}} / {{orgInn}}  КПП: {{kpp}}

Налогоплательщик: {{fullName}} / {{orgName}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 КБК           ОКТМО       Отч. период  Год    Сумма (руб.)
 ____________  ________    ___________  ____   {{amount}}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Срок уплаты: {{actDate}}

Достоверность и полноту сведений подтверждаю:
{{today}}
_________________________ / {{fullName}} /`, f) },

  { id:'pd_policy', icon:'🔒', category:'Налоги и бизнес', name:'Политика обработки персональных данных',
    desc:'ФЗ №152-ФЗ ст.18.1: обязательный документ для организаций',
    extras:['orgName','orgInn','orgAddress','subject'],
    build:f=>fill(`ПОЛИТИКА
в отношении обработки персональных данных

{{orgName}} (ИП {{fullName}}), ИНН: {{orgInn}}, адрес: {{orgAddress}},

1. ОБЩИЕ ПОЛОЖЕНИЯ
Настоящая Политика разработана во исполнение требований Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных».

2. КАТЕГОРИИ ОБРАБАТЫВАЕМЫХ ПД
Оператор обрабатывает: фамилию, имя, отчество; дату рождения; паспортные данные; адрес; контактные данные.

3. ЦЕЛИ ОБРАБОТКИ
{{subject}}

4. ПРАВОВОЕ ОСНОВАНИЕ
Обработка осуществляется с согласия субъекта ПД, а также на иных законных основаниях (ст. 6 ФЗ №152-ФЗ).

5. ПРАВА СУБЪЕКТОВ ПД
Субъект вправе: отозвать согласие; требовать уточнения, блокировки или уничтожения ПД; обратиться в Роскомнадзор.

6. МЕРЫ ЗАЩИТЫ
Оператор принимает необходимые организационные и технические меры для защиты ПД от несанкционированного доступа.

{{today}}
ИП {{fullName}} / {{orgName}} _________________`, f) },

  /* ══════════ ИНТЕЛЛЕКТУАЛЬНАЯ СОБСТВЕННОСТЬ (РОСПАТЕНТ) ══════════ */

  { id:'rospatent_author_consent', icon:'💻', category:'Интеллектуальная собственность',
    name:'Согласие автора на указание сведений (Приложение 4 Роспатент)',
    desc:'Официальная форма Роспатента: согласие автора при регистрации программы для ЭВМ или базы данных (пп. 4 ст. 1259 ГК РФ)',
    extras:['softwareName','applicationNumber','rightHolder','citizenship','authorContribution','publishMode'],
    build:f=>fill(`                                           В Федеральную службу
                                           по интеллектуальной собственности
                                           Бережковская наб., д. 30, корп. 1,
                                           г. Москва, Г-59, ГСП-3, 125993,
                                           Российская Федерация

   СОГЛАСИЕ АВТОРА НА УКАЗАНИЕ СВЕДЕНИЙ ОБ АВТОРЕ,
   УКАЗАННЫХ В ЗАЯВЛЕНИИ

Заявка № {{applicationNumber}}
на государственную регистрацию Программы для ЭВМ / Базы данных
(государственная регистрация осуществляется в соответствии с п. 4 ст. 1259 ГК РФ)

Название: {{softwareName}}

Правообладатель (Заявитель): {{rightHolder}}

Подтверждаю согласие на указание обо мне, как авторе, следующих сведений в графе 7А заявления на государственную регистрацию данной программы для ЭВМ или базы данных.

7А. СВЕДЕНИЯ ОБ АВТОРЕ:

Фамилия, имя, отчество: {{fullName}}
Дата рождения: {{birthDate}}
Гражданство: {{citizenship}}

Автор согласен с обработкой указанных персональных данных, необходимой для исполнения полномочий федеральных органов исполнительной власти, участвующих в предоставлении государственных услуг, предусмотренных Федеральным законом от 27 июля 2010 года № 210-ФЗ «Об организации предоставления государственных и муниципальных услуг», включая регистрацию субъекта персональных данных на едином портале государственных и муниципальных услуг и (или) региональных порталах государственных и муниципальных услуг и в течение срока действия исключительного права на регистрируемый объект.

Место постоянного жительства, включая указание страны:
{{regAddress}}

Краткое описание творческого вклада автора при создании регистрируемой программы для ЭВМ или базы данных:
{{authorContribution}}

При публикации сведений о государственной регистрации программы для ЭВМ или базы данных автор просит:
[X] {{publishMode}}

Подпись автора: _________________ / {{fullName}} /        {{today}}

Подпись(и) правообладателя(ей) или его (их) представителя(ей):
_________________ / {{rightHolder}} /                      {{today}}
(от имени юридического лица — руководитель организации или уполномоченное лицо; подпись удостоверяется печатью при наличии)`, f) },

  { id:'rospatent_pd_consent', icon:'📋', category:'Интеллектуальная собственность',
    name:'Согласие на обработку персональных данных (Приложение 3 Роспатент)',
    desc:'Официальная форма Роспатента: согласие на обработку ПД при подаче заявки (ФЗ №152-ФЗ ч.3 ст.3, ФЗ №210-ФЗ)',
    extras:['softwareName','applicationNumber'],
    build:f=>fill(`                                           В Федеральную службу
                                           по интеллектуальной собственности
                                           Бережковская наб., д. 30, корп. 1,
                                           г. Москва, Г-59, ГСП-3, 125993,
                                           Российская Федерация

   СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ

Название программы для ЭВМ или базы данных:
{{softwareName}}

№ заявки: {{applicationNumber}}

Ф.И.О. субъекта персональных данных: {{fullName}}

Адрес места жительства: {{regAddress}}

Документ, удостоверяющий личность субъекта персональных данных, дата его выдачи и выдавший орган:
Паспорт серии {{passportSeries}} № {{passportNumber}}, выдан {{passportIssuedBy}} {{passportIssuedDate}}

Подтверждаю согласие на обработку моих персональных данных, предусмотренную частью 3 статьи 3 Федерального закона от 27 июля 2006 г. № 152-ФЗ «О персональных данных», в целях предоставления Федеральной службой по интеллектуальной собственности государственной услуги в соответствии с Федеральным законом от 27 июля 2010 г. № 210-ФЗ «Об организации предоставления государственных и муниципальных услуг».

Мне известно, что в случае отзыва согласия на обработку персональных данных Федеральная служба по интеллектуальной собственности вправе продолжить обработку персональных данных без моего согласия в соответствии с частью 2 статьи 9, пунктом 4 части 1 статьи 6 Федерального закона от 27 июля 2006 г. № 152-ФЗ «О персональных данных».


Подпись _________________ / {{fullName}} /

Дата: {{today}}`, f) },
];

/* ─── Scan filter ────────────────────────────────────────────── */
const applyScanFilter = (file:File, mode:'color'|'bw'): Promise<{dataUrl:string;blob:Blob}> =>
  new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const MAX=2400; let {width,height}=img;
        if(width>MAX||height>MAX){ if(width>height){height=Math.round(height*MAX/width);width=MAX;}else{width=Math.round(width*MAX/height);height=MAX;} }
        // A4 canvas (portrait): scale image to fill A4 proportions
        const A4W=1240,A4H=1754;
        const c=document.createElement('canvas'); c.width=A4W; c.height=A4H;
        const ctx=c.getContext('2d')!;
        ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,A4W,A4H);
        const scale=Math.max(A4W/width,A4H/height);
        const dw=width*scale,dh=height*scale;
        if(mode==='color'){ ctx.filter='contrast(1.45) saturate(1.3) brightness(1.12)'; ctx.drawImage(img,(A4W-dw)/2,(A4H-dh)/2,dw,dh); }
        else { ctx.filter='grayscale(1) contrast(1.9) brightness(1.18)'; ctx.drawImage(img,(A4W-dw)/2,(A4H-dh)/2,dw,dh); const id=ctx.getImageData(0,0,A4W,A4H); const d=id.data; for(let i=0;i<d.length;i+=4){const v=d[i];const o=v>172?255:v<80?0:v;d[i]=d[i+1]=d[i+2]=o;} ctx.putImageData(id,0,0); }
        const dataUrl=c.toDataURL('image/jpeg',0.95);
        c.toBlob(b=>b?resolve({dataUrl,blob:b}):reject(new Error('blob')),'image/jpeg',0.95);
      };
      img.onerror=reject; img.src=ev.target?.result as string;
    };
    reader.onerror=reject; reader.readAsDataURL(file);
  });

const compressThumb=(dataUrl:string):Promise<string>=>new Promise(res=>{
  const img=new Image(); img.onload=()=>{const MAX=300;let{width,height}=img;if(width>MAX){height=Math.round(height*MAX/width);width=MAX;}const c=document.createElement('canvas');c.width=width;c.height=height;c.getContext('2d')!.drawImage(img,0,0,width,height);res(c.toDataURL('image/jpeg',0.55));};img.onerror=()=>res('');img.src=dataUrl;
});

/* ─── Download helpers ───────────────────────────────────────── */
const downloadBlob=(blob:Blob,name:string)=>{
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(()=>URL.revokeObjectURL(a.href),1000);
};

const dlTxt=(text:string,name:string)=>{
  downloadBlob(new Blob(['\ufeff'+text],{type:'text/plain;charset=utf-8'}),name+'.txt');
};

const dlDocx=async(text:string,name:string)=>{
  const {Document,Packer,Paragraph,TextRun}=await import('docx');
  const paras=text.split('\n').map(line=>new Paragraph({
    children:[new TextRun({text:line,font:'Times New Roman',size:24})],
    spacing:{after:0},
  }));
  const doc=new Document({sections:[{properties:{},children:paras}]});
  const blob=await Packer.toBlob(doc);
  downloadBlob(blob,name+'.docx');
};

const dlRtf=(text:string,name:string)=>{
  const body=text.replace(/[^\x00-\x7F]/g,ch=>`\\u${ch.charCodeAt(0)}?`).replace(/\n/g,'\\par\n');
  const rtf=`{\\rtf1\\ansi\\ansicpg1251\\deff0\n{\\fonttbl{\\f0\\froman\\fcharset204 Times New Roman;}}\n\\f0\\fs24\\lang1049\\pard\\sa0\\sl240\\slmult1 ${body}}`;
  downloadBlob(new Blob([rtf],{type:'application/rtf'}),name+'.rtf');
};

const openPrintWindow=(text:string,name:string)=>{
  const win=window.open('','_blank');if(!win)return;
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${name}</title><style>body{font-family:"Times New Roman",serif;margin:2cm;font-size:14pt;line-height:1.9;color:#000;white-space:pre-wrap;} @media print{body{margin:2cm;}}</style></head><body>${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</body></html>`);
  win.document.close();setTimeout(()=>{win.focus();win.print();},400);
};

const dlPdf=async(text:string,name:string)=>{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfMake=(await import('pdfmake/build/pdfmake')) as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfFonts=(await import('pdfmake/build/vfs_fonts')) as any;
  const pm=pdfMake.default??pdfMake;const pf=pdfFonts.default??pdfFonts;
  pm.vfs=pf.vfs;
  const lines=text.split('\n');
  const content=lines.map((line:string)=>({text:line||' ',fontSize:11,lineHeight:1.6}));
  pm.createPdf({content,defaultStyle:{fontSize:11},pageMargins:[57,57,57,57]}).download(name+'.pdf');
};

/* ─── File helpers ───────────────────────────────────────────── */
type DocKind='pdf'|'docx'|'image'|'text'|'csv'|'xlsx'|'unknown';
const detectKind=(name:string,mime:string):DocKind=>{
  const ext=name.split('.').pop()?.toLowerCase()??'';
  if(mime==='application/pdf'||ext==='pdf')return 'pdf';
  if(mime.includes('wordprocessingml')||ext==='docx'||ext==='doc')return 'docx';
  if(mime.startsWith('image/')||['jpg','jpeg','png','gif','webp','bmp'].includes(ext))return 'image';
  if(ext==='csv')return 'csv';
  if(mime.includes('spreadsheetml')||['xlsx','xls'].includes(ext))return 'xlsx';
  if(['txt','md','log','json','xml','html','ini'].includes(ext))return 'text';
  return 'unknown';
};
const kindIcon=(k:string)=>k==='pdf'?'📄':k==='docx'?'📝':(k==='xlsx'||k==='csv')?'📊':k==='image'?'🖼️':'📃';
const kindLabel=(k:string)=>k==='pdf'?'PDF':k==='docx'?'Word':k==='xlsx'?'Excel':k==='csv'?'CSV':k==='image'?'Изображение':'Текст';
const fmtSize=(b:number)=>b<1024?b+' Б':b<1048576?(b/1024).toFixed(1)+' КБ':(b/1048576).toFixed(1)+' МБ';
const fmtDate=(ts:number)=>new Date(ts).toLocaleDateString('ru-RU',{day:'2-digit',month:'short',year:'numeric'});

interface ScanHistoryItem{id:string;thumb:string;full:string;date:number;mode:string;}
interface RecentDoc{id:string;name:string;kind:string;size:number;date:number;mimeType?:string;}

const CATS=[...new Set(TEMPLATES.map(t=>t.category))];

/* ─── Scanner Modal ──────────────────────────────────────────── */
type ScannerInfo={imgSrc:string;file:File;docId:string;prompt:string};
type ScanCrop={x:number;y:number;w:number;h:number};

/* Free OCR field parser (regex, no API) */
function parseDocText(text:string):Record<string,string>{
  const r:Record<string,string>={};
  const clean=(s:string)=>s.replace(/\s+/g,' ').trim();

  // ФИО: три слова из кириллицы подряд, каждое с заглавной
  const fioRe=/[А-ЯЁ][а-яёА-ЯЁ]+\s+[А-ЯЁ][а-яёА-ЯЁ]+\s+[А-ЯЁ][а-яёА-ЯЁ]+/g;
  const fioMatches=[...text.matchAll(fioRe)];
  if(fioMatches.length>0)r.fullName=clean(fioMatches[0][0]);
  if(fioMatches.length>1)r.counterFullName=clean(fioMatches[1][0]);

  // Серия и номер паспорта: 4 + 6 цифр
  const passRe=/(\d{2}\s?\d{2})\s+(\d{6})/g;
  const passMatches=[...text.matchAll(passRe)];
  if(passMatches.length>0){r.passportSeries=passMatches[0][1].replace(/\s/,'');r.passportNumber=passMatches[0][2];}
  if(passMatches.length>1)r.counterPassport=`${passMatches[1][1].replace(/\s/,'')} ${passMatches[1][2]}`;

  // Даты DD.MM.YYYY или DD/MM/YYYY
  const dateRe=/\b(\d{2}[./]\d{2}[./]\d{4})\b/g;
  const dates=[...text.matchAll(dateRe)].map(m=>m[1].replace(/\//g,'.'));
  // Дата рождения — ищем контекст
  const bdMatch=text.match(/(?:дата\s+рождения|рождения|р\.)[:\s]+(\d{2}[./]\d{2}[./]\d{4})/i);
  if(bdMatch)r.birthDate=bdMatch[1].replace(/\//g,'.');
  else if(dates.length>0)r.birthDate=dates[0];
  // Дата выдачи
  const issMatch=text.match(/(?:дата\s+выдачи|выдан[аоы]*)[:\s]+(\d{2}[./]\d{2}[./]\d{4})/i);
  if(issMatch)r.passportIssuedDate=issMatch[1].replace(/\//g,'.');
  else if(dates.length>1)r.passportIssuedDate=dates[1];

  // Кем выдан
  const issByMatch=text.match(/(?:кем\s+выдан|выдан(?:о)?)[:\s]+([^\n\d]{5,80})/i);
  if(issByMatch)r.passportIssuedBy=clean(issByMatch[1]);

  // Место рождения
  const bpMatch=text.match(/(?:место\s+рождения|м\.р\.)[:\s]+([^\n]{3,100})/i);
  if(bpMatch)r.birthPlace=clean(bpMatch[1]);

  // Адрес регистрации
  const addrMatch=text.match(/(?:адрес|место\s+жительства|зарегистрирован[а]?\s+по\s+адресу|проживает)[:\s]+([^\n]{5,150})/i);
  if(addrMatch)r.regAddress=clean(addrMatch[1]);

  // ИНН (12 цифр = физлицо, 10 = юрлицо)
  const innMatch=text.match(/ИНН[:\s]*(\d{10,12})/i);
  if(innMatch){
    const v=innMatch[1];
    if(v.length===12)r.inn=v;
    else{r.orgInn=v;}
  }

  // СНИЛС: XXX-XXX-XXX XX или 11 цифр
  const snilsMatch=text.match(/(\d{3}-\d{3}-\d{3}\s?\d{2})/);
  if(snilsMatch)r.snils=snilsMatch[1];

  // Телефон
  const phoneMatch=text.match(/(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}/);
  if(phoneMatch)r.phone=phoneMatch[0];

  // Наименование организации
  const orgMatch=text.match(/(?:наименование|организация|ООО|ОАО|ЗАО|АО|ИП)[:\s"«]+([А-ЯЁа-яё\w\s"«»\-]{3,80})/i);
  if(orgMatch)r.orgName=clean(orgMatch[1]);

  // ОГРН
  const ogrnMatch=text.match(/ОГРН[:\s]*(\d{13,15})/i);
  if(ogrnMatch)r.ogrn=ogrnMatch[1];

  // КПП
  const kppMatch=text.match(/КПП[:\s]*(\d{9})/i);
  if(kppMatch)r.kpp=kppMatch[1];

  // БИК
  const bikMatch=text.match(/БИК[:\s]*(\d{9})/i);
  if(bikMatch)r.bankBik=bikMatch[1];

  // Расчётный счёт
  const accMatch=text.match(/(?:р[\/]?с|счёт)[:\s]*(\d{20})/i);
  if(accMatch)r.bankAccount=accMatch[1];

  return r;
}

function ScannerModal({info,onExtract,onFieldsSet,onClose}:{info:ScannerInfo;onExtract:(b64:string,mime:string,docId:string,prompt:string)=>Promise<void>;onFieldsSet:(fields:Record<string,string>)=>void;onClose:()=>void}){
  const A4R=Math.SQRT2; // A4 portrait aspect ratio h/w = √2
  const [crop,setCrop]=useState<ScanCrop>({x:0.03,y:0.03,w:0.94,h:0.94});
  const [a4Lock,setA4Lock]=useState(false);
  const [activeHandle,setActiveHandle]=useState<null|'move'|'tl'|'tr'|'bl'|'br'>(null);
  const [startPos,setStartPos]=useState({cx:0,cy:0,crop:{x:0,y:0,w:0,h:0}});
  const [scanning,setScanning]=useState(false);
  const [dlLoading,setDlLoading]=useState(false);
  const imgRef=useRef<HTMLImageElement>(null);
  const containerRef=useRef<HTMLDivElement>(null);
  const [ir,setIr]=useState({left:0,top:0,width:0,height:0}); // image rect in container px

  const updateIr=useCallback(()=>{
    if(!imgRef.current||!containerRef.current)return;
    const c=containerRef.current.getBoundingClientRect();
    const i=imgRef.current.getBoundingClientRect();
    setIr({left:i.left-c.left,top:i.top-c.top,width:i.width,height:i.height});
  },[]);

  useEffect(()=>{
    window.addEventListener('resize',updateIr);
    return()=>window.removeEventListener('resize',updateIr);
  },[updateIr]);

  const norm=(e:{clientX:number;clientY:number})=>{
    if(!containerRef.current||ir.width===0)return{x:0,y:0};
    const c=containerRef.current.getBoundingClientRect();
    return{
      x:Math.max(0,Math.min(1,(e.clientX-c.left-ir.left)/ir.width)),
      y:Math.max(0,Math.min(1,(e.clientY-c.top-ir.top)/ir.height)),
    };
  };

  const onPtrDown=(e:React.PointerEvent,h:'move'|'tl'|'tr'|'bl'|'br'|'bg')=>{
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const pos=norm(e);
    if(h==='bg'){
      const nc={x:pos.x,y:pos.y,w:0.001,h:0.001};
      setCrop(nc);setActiveHandle('br');
      setStartPos({cx:pos.x,cy:pos.y,crop:nc});
    }else{setActiveHandle(h);setStartPos({cx:pos.x,cy:pos.y,crop:{...crop}});}
  };

  // When a4Lock: enforce portrait A4 aspect ratio (h = w * √2), adjusted by image pixel ratio
  const snapA4=(nc:{x:number;y:number;w:number;h:number},force=false):{x:number;y:number;w:number;h:number}=>{
    if((!a4Lock&&!force)||!imgRef.current)return nc;
    // Image natural dimensions determine pixel ratio
    const {naturalWidth:nw,naturalHeight:nh}=imgRef.current;
    // In normalised coords: actual pixel ratio of w vs h
    const pixRatio=nw/nh; // px per unit-x / px per unit-y
    const targetH=nc.w*A4R/pixRatio; // h in normalised units for A4 portrait
    const h2=Math.min(targetH,1-nc.y);
    const w2=h2*pixRatio/A4R;
    return{...nc,w:Math.max(0.05,Math.min(w2,1-nc.x)),h:Math.max(0.05,h2)};
  };

  const onPtrMove=(e:React.PointerEvent)=>{
    if(!activeHandle)return;
    const pos=norm(e);
    const dx=pos.x-startPos.cx,dy=pos.y-startPos.cy,sc=startPos.crop;
    let nc={...sc};
    const MIN=0.04;
    if(activeHandle==='move'){nc.x=Math.max(0,Math.min(1-sc.w,sc.x+dx));nc.y=Math.max(0,Math.min(1-sc.h,sc.y+dy));}
    else if(activeHandle==='tl'){const nx=Math.max(0,Math.min(sc.x+sc.w-MIN,sc.x+dx));const ny=Math.max(0,Math.min(sc.y+sc.h-MIN,sc.y+dy));nc.w=sc.w-(nx-sc.x);nc.h=sc.h-(ny-sc.y);nc.x=nx;nc.y=ny;}
    else if(activeHandle==='tr'){const ny=Math.max(0,Math.min(sc.y+sc.h-MIN,sc.y+dy));nc.w=Math.max(MIN,Math.min(1-sc.x,sc.w+dx));nc.h=sc.h-(ny-sc.y);nc.y=ny;}
    else if(activeHandle==='bl'){const nx=Math.max(0,Math.min(sc.x+sc.w-MIN,sc.x+dx));nc.w=sc.w-(nx-sc.x);nc.x=nx;nc.h=Math.max(MIN,Math.min(1-sc.y,sc.h+dy));}
    else if(activeHandle==='br'){nc.w=Math.max(MIN,Math.min(1-sc.x,sc.w+dx));nc.h=Math.max(MIN,Math.min(1-sc.y,sc.h+dy));}
    setCrop(snapA4(nc));
  };

  const cropToBase64=async(c:ScanCrop):Promise<string>=>{
    const img=imgRef.current!;
    const nW=img.naturalWidth,nH=img.naturalHeight;
    const px=Math.round(c.x*nW),py=Math.round(c.y*nH);
    const pw=Math.round(c.w*nW),ph=Math.round(c.h*nH);
    const cv=document.createElement('canvas');cv.width=pw;cv.height=ph;
    cv.getContext('2d')!.drawImage(img,px,py,pw,ph,0,0,pw,ph);
    return cv.toDataURL('image/jpeg',0.93).split(',')[1];
  };

  const fullToBase64=():string=>{
    const img=imgRef.current!;
    const cv=document.createElement('canvas');cv.width=img.naturalWidth;cv.height=img.naturalHeight;
    cv.getContext('2d')!.drawImage(img,0,0);
    return cv.toDataURL('image/jpeg',0.93).split(',')[1];
  };

  const [mode,setMode]=useState<'free'|'ai'>('free');
  const [ocrProgress,setOcrProgress]=useState(0); // 0-100
  const [ocrText,setOcrText]=useState<string|null>(null);

  const doScan=async(full:boolean)=>{
    setScanning(true);
    const b64=full?fullToBase64():await cropToBase64(crop);
    if(mode==='free'){
      try{
        setOcrProgress(5);
        const {createWorker}=await import('tesseract.js');
        const worker=await createWorker('rus',1,{
          logger:(m:{status:string;progress:number})=>{
            if(m.status==='recognizing text')setOcrProgress(Math.round(5+m.progress*90));
          },
        });
        const dataUrl=`data:image/jpeg;base64,${b64}`;
        const {data:{text}}=await worker.recognize(dataUrl);
        await worker.terminate();
        setOcrProgress(100);
        const parsed=parseDocText(text);
        setOcrText(text);
        onFieldsSet(parsed);
        onClose();
      }catch(err){
        console.error(err);
        // Fallback to AI on OCR failure
        onClose();
        await onExtract(b64,'image/jpeg',info.docId,info.prompt);
      }
    }else{
      onClose();
      await onExtract(b64,'image/jpeg',info.docId,info.prompt);
    }
    setScanning(false);
  };

  const doPdf=async(full:boolean)=>{
    setDlLoading(true);
    try{
      const b64=full?fullToBase64():await cropToBase64(crop);
      const pm=(await import('pdfmake/build/pdfmake')).default;
      const pf=(await import('pdfmake/build/vfs_fonts')).default;
      (pm as {vfs?:unknown}).vfs=pf.vfs;
      const ts=new Date().toISOString().slice(0,10);
      // Resize image canvas to A4 proportions (595×842 pts at 2x)
      const A4W=1240,A4H=1754;
      const srcImg=new Image();
      await new Promise<void>(res=>{srcImg.onload=()=>res();srcImg.src=`data:image/jpeg;base64,${b64}`;});
      const cv2=document.createElement('canvas');cv2.width=A4W;cv2.height=A4H;
      const ctx2=cv2.getContext('2d')!;
      ctx2.fillStyle='#ffffff';ctx2.fillRect(0,0,A4W,A4H);
      // contain: preserve proportions, white margins where document doesn't reach
      const scale=Math.min(A4W/srcImg.width,A4H/srcImg.height);
      const sw=srcImg.width*scale,sh=srcImg.height*scale;
      ctx2.drawImage(srcImg,(A4W-sw)/2,(A4H-sh)/2,sw,sh);
      const a4b64=cv2.toDataURL('image/jpeg',0.95).split(',')[1];
      pm.createPdf({pageSize:'A4',pageMargins:[0,0,0,0],content:[{image:`data:image/jpeg;base64,${a4b64}`,width:595.28,absolutePosition:{x:0,y:0}}]} as Parameters<typeof pm.createPdf>[0]).download(`скан_${ts}.pdf`);
    }finally{setDlLoading(false);}
  };

  /* render helpers */
  const px=(v:number,base:number,off:number)=>`${off+v*base}px`;
  const selL=px(crop.x,ir.width,ir.left),selT=px(crop.y,ir.height,ir.top);
  const selW=px(crop.w,ir.width,0),selH=px(crop.h,ir.height,0);

  const Handle=({h,lx,ly}:{h:'tl'|'tr'|'bl'|'br';lx:number;ly:number})=>(
    <div onPointerDown={e=>{e.stopPropagation();onPtrDown(e,h);}}
      style={{position:'absolute',left:px(lx,ir.width,ir.left),top:px(ly,ir.height,ir.top),width:24,height:24,background:'#4f8ef7',borderRadius:5,transform:'translate(-50%,-50%)',touchAction:'none',cursor:'nwse-resize',zIndex:12,border:'2px solid #fff'}}/>
  );

  const BtnA=({disabled:d,onClick:oc,col,children:ch}:{disabled:boolean;onClick:()=>void;col:string;children:React.ReactNode})=>(
    <button disabled={d} onClick={oc} style={{padding:'13px 0',borderRadius:12,background:col,border:'none',color:'#fff',fontSize:12,fontWeight:800,cursor:d?'default':'pointer',opacity:d?0.6:1}}>{ch}</button>
  );

  return(
    <div style={{position:'fixed',inset:0,zIndex:9999,background:'#080808',display:'flex',flexDirection:'column',fontFamily:'system-ui,sans-serif'}}>
      <div style={{padding:'10px 16px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #1a1a1a',flexShrink:0,gap:8}}>
        <button onClick={onClose} style={{background:'none',border:'none',color:'#888',fontSize:13,cursor:'pointer',padding:'4px 8px',flexShrink:0}}>✕</button>
        <div style={{fontSize:12,fontWeight:700,color:'#fff',flex:1,textAlign:'center'}}>📷 Выберите область</div>
        {/* A4 frame lock toggle */}
        <button
          onClick={()=>{
            const next=!a4Lock;
            setA4Lock(next);
            if(next) setCrop(c=>snapA4({...c},true));
          }}
          style={{padding:'6px 10px',borderRadius:8,background:a4Lock?'#7c3aed':'#1f1f1f',border:`1.5px solid ${a4Lock?'#a855f7':'#333'}`,color:a4Lock?'#fff':'#777',fontSize:11,fontWeight:800,cursor:'pointer',flexShrink:0,transition:'all 0.2s'}}>
          📄 A4
        </button>
      </div>

      <div ref={containerRef} style={{flex:1,position:'relative',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center',background:'#111',touchAction:'none'}}
        onPointerDown={e=>{if(e.target===e.currentTarget||(e.target as HTMLElement).tagName==='DIV')onPtrDown(e,'bg');}}
        onPointerMove={onPtrMove} onPointerUp={()=>setActiveHandle(null)}>

        <img ref={imgRef} src={info.imgSrc}
          style={{maxWidth:'100%',maxHeight:'100%',display:'block',userSelect:'none',pointerEvents:'none'}}
          onLoad={updateIr}/>

        {/* Dark mask */}
        {ir.width>0&&<svg style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}>
          <defs><mask id="shole"><rect width="100%" height="100%" fill="white"/>
            <rect x={selL} y={selT} width={selW} height={selH} fill="black"/></mask></defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.62)" mask="url(#shole)"/>
          <rect x={selL} y={selT} width={selW} height={selH} fill="none" stroke={a4Lock?'#a855f7':'#4f8ef7'} strokeWidth={a4Lock?3:2.5} strokeDasharray={a4Lock?"none":"8,4"}/>
          {/* A4 badge when locked */}
          {a4Lock&&<>
            <rect x={`${ir.left+crop.x*ir.width+4}px`} y={`${ir.top+crop.y*ir.height+4}px`} width="34" height="18" rx="4" fill="#7c3aed" opacity="0.92"/>
            <text x={`${ir.left+crop.x*ir.width+21}px`} y={`${ir.top+crop.y*ir.height+16}px`} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="800">A4</text>
          </>}
          {/* Grid lines */}
          <line x1={`${ir.left+crop.x*ir.width+crop.w*ir.width/3}px`} y1={selT} x2={`${ir.left+crop.x*ir.width+crop.w*ir.width/3}px`} y2={`${ir.top+crop.y*ir.height+crop.h*ir.height}px`} stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
          <line x1={`${ir.left+crop.x*ir.width+crop.w*ir.width*2/3}px`} y1={selT} x2={`${ir.left+crop.x*ir.width+crop.w*ir.width*2/3}px`} y2={`${ir.top+crop.y*ir.height+crop.h*ir.height}px`} stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
          <line x1={selL} y1={`${ir.top+crop.y*ir.height+crop.h*ir.height/3}px`} x2={`${ir.left+crop.x*ir.width+crop.w*ir.width}px`} y2={`${ir.top+crop.y*ir.height+crop.h*ir.height/3}px`} stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
          <line x1={selL} y1={`${ir.top+crop.y*ir.height+crop.h*ir.height*2/3}px`} x2={`${ir.left+crop.x*ir.width+crop.w*ir.width}px`} y2={`${ir.top+crop.y*ir.height+crop.h*ir.height*2/3}px`} stroke="rgba(255,255,255,0.2)" strokeWidth="1"/>
        </svg>}

        {/* Move overlay */}
        {ir.width>0&&<div onPointerDown={e=>{e.stopPropagation();onPtrDown(e,'move');}}
          style={{position:'absolute',left:px(crop.x,ir.width,ir.left),top:px(crop.y,ir.height,ir.top),width:selW,height:selH,touchAction:'none',cursor:'move',zIndex:8}}/>}

        {/* Corners */}
        {ir.width>0&&<>
          <Handle h="tl" lx={crop.x} ly={crop.y}/>
          <Handle h="tr" lx={crop.x+crop.w} ly={crop.y}/>
          <Handle h="bl" lx={crop.x} ly={crop.y+crop.h}/>
          <Handle h="br" lx={crop.x+crop.w} ly={crop.y+crop.h}/>
        </>}
      </div>

      <div style={{textAlign:'center',padding:'5px 12px',fontSize:10,color:'#444',flexShrink:0}}>
        Перетащите угловые маркеры · Внутри рамки — перемещение · Вне рамки — новая область
      </div>

      {/* Mode toggle */}
      <div style={{padding:'0 16px 8px',flexShrink:0}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,background:'#161616',borderRadius:12,padding:4}}>
          <button onClick={()=>setMode('free')} style={{padding:'9px',borderRadius:9,background:mode==='free'?'#059669':'transparent',border:'none',color:mode==='free'?'#fff':'#666',fontSize:11,fontWeight:800,cursor:'pointer',transition:'all 0.2s'}}>
            🆓 Бесплатно (OCR)
          </button>
          <button onClick={()=>setMode('ai')} style={{padding:'9px',borderRadius:9,background:mode==='ai'?'#4f8ef7':'transparent',border:'none',color:mode==='ai'?'#fff':'#666',fontSize:11,fontWeight:800,cursor:'pointer',transition:'all 0.2s'}}>
            🤖 ИИ (точнее)
          </button>
        </div>
        <div style={{fontSize:9,color:'#444',textAlign:'center',marginTop:4}}>
          {mode==='free'?'Распознавание прямо в браузере · без интернета · данные не покидают устройство':'Отправляет фото на ИИ · точнее для сложных документов'}
        </div>
      </div>

      {/* OCR progress bar */}
      {scanning&&mode==='free'&&ocrProgress>0&&ocrProgress<100&&(
        <div style={{padding:'0 16px 8px',flexShrink:0}}>
          <div style={{height:4,background:'#1a1a1a',borderRadius:4,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${ocrProgress}%`,background:'#059669',borderRadius:4,transition:'width 0.3s'}}/>
          </div>
          <div style={{fontSize:10,color:'#059669',textAlign:'center',marginTop:4}}>Распознаю текст… {ocrProgress}%</div>
        </div>
      )}

      <div style={{padding:'0 16px 20px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,borderTop:'1px solid #1a1a1a',paddingTop:12,flexShrink:0}}>
        <BtnA disabled={scanning||dlLoading} onClick={()=>doScan(false)} col={mode==='free'?'#059669':'#4f8ef7'}>
          {scanning?(mode==='free'?'OCR…':'ИИ анализирует…'):(mode==='free'?'🆓 Распознать область':'🔍 ИИ: область')}
        </BtnA>
        <BtnA disabled={scanning||dlLoading} onClick={()=>doScan(true)} col="#374151">
          {mode==='free'?'🆓 Весь документ':'🤖 ИИ: весь'}
        </BtnA>
        <BtnA disabled={scanning||dlLoading} onClick={()=>doPdf(false)} col="#7c3aed">⬇️ PDF A4 (область)</BtnA>
        <BtnA disabled={scanning||dlLoading} onClick={()=>doPdf(true)} col="#374151">📑 PDF A4 (весь)</BtnA>
      </div>
    </div>
  );
}

/* ─── Component ─────────────────────────────────────────────── */
export default function DocumentsApp({onBack,myHash:_h}:{onBack:()=>void;myHash?:string}){
  const [tab,setTab]=useState<'data'|'templates'|'reader'>('data');
  /* data */
  const [fields,setFields]=useState<DocFields>({...EMPTY});
  const [extracting,setExtracting]=useState(false);
  const [extractDone,setExtractDone]=useState(false);
  const [scanPreview,setScanPreview]=useState<string|null>(null);
  const [scanning,setScanning]=useState(false);
  const [dataError,setDataError]=useState<string|null>(null);
  const [scanHistory,setScanHistory]=useState<ScanHistoryItem[]>([]);
  const [previewImg,setPreviewImg]=useState<string|null>(null);
  /* templates */
  const [catFilter,setCatFilter]=useState('Все');
  const [search,setSearch]=useState('');
  const [selectedTpl,setSelectedTpl]=useState<Template|null>(null);
  const [result,setResult]=useState<string|null>(null);
  const [showDlModal,setShowDlModal]=useState(false);
  const [dlLoading,setDlLoading]=useState<string|null>(null);
  /* analyse */
  const [analysing,setAnalysing]=useState(false);
  const [analysisResult,setAnalysisResult]=useState<string|null>(null);
  /* reader */
  const [recentDocs,setRecentDocs]=useState<RecentDoc[]>([]);
  const [rLoading,setRLoading]=useState(false);
  const [rDocName,setRDocName]=useState('');
  const [rDocKind,setRDocKind]=useState<DocKind>('unknown');
  const [rPdfUrl,setRPdfUrl]=useState<string|null>(null);
  const [rDocHtml,setRDocHtml]=useState<string|null>(null);
  const [rDocText,setRDocText]=useState<string|null>(null);
  const [rDocTable,setRDocTable]=useState<unknown[][]|null>(null);
  const [rImageUrl,setRImageUrl]=useState<string|null>(null);
  const [rImgZoom,setRImgZoom]=useState(1);
  const [rViewing,setRViewing]=useState(false);
  const [rError,setRError]=useState<string|null>(null);
  /* converter */
  const [convFile,setConvFile]=useState<{name:string;kind:DocKind;dataUrl?:string;text?:string;buffer?:ArrayBuffer}|null>(null);
  const [converting,setConverting]=useState(false);
  const [convDone,setConvDone]=useState<string|null>(null);
  /* misc */
  const [toast,setToast]=useState<string|null>(null);

  const scanColorRef=useRef<HTMLInputElement>(null);
  const scanBwRef=useRef<HTMLInputElement>(null);
  const photoRef=useRef<HTMLInputElement>(null);
  const fileRef=useRef<HTMLInputElement>(null);
  const analyseRef=useRef<HTMLInputElement>(null);
  const convRef=useRef<HTMLInputElement>(null);
  /* collect-screen */
  const [collectingTpl,setCollectingTpl]=useState<Template|null>(null);
  const [collectExtracting,setCollectExtracting]=useState<string|null>(null);
  const [showCollectPreview,setShowCollectPreview]=useState(false);
  const collectPhotoRef=useRef<HTMLInputElement>(null);
  const collectDocIdRef=useRef<string>('');
  const collectPromptRef=useRef<string>('');
  const [scanner,setScanner]=useState<ScannerInfo|null>(null);

  useEffect(()=>{
    try{const s=localStorage.getItem('swaip_docs_recent');if(s)setRecentDocs(JSON.parse(s));}catch{}
    try{const s=localStorage.getItem('swaip_scan_history');if(s)setScanHistory(JSON.parse(s));}catch{}
  },[]);

  const showToast=(m:string)=>{setToast(m);setTimeout(()=>setToast(null),2500);};
  const setField=(k:keyof DocFields,v:string)=>setFields(f=>({...f,[k]:v}));

  const baseKeys:Array<keyof DocFields>=['fullName','passportSeries','passportNumber','passportIssuedBy','passportIssuedDate','birthDate','regAddress'];
  const filledCount=baseKeys.filter(k=>fields[k]).length;

  /* Extract free OCR (Tesseract.js, no AI) */
  const [ocrDataProgress,setOcrDataProgress]=useState(0);
  const extractFromImage=useCallback(async(imageBase64:string,_imageMime:string)=>{
    setExtracting(true);setDataError(null);setOcrDataProgress(5);
    try{
      const {createWorker}=await import('tesseract.js');
      const worker=await createWorker('rus',1,{
        logger:(m:{status:string;progress:number})=>{
          if(m.status==='recognizing text')setOcrDataProgress(Math.round(5+m.progress*90));
        },
      });
      const {data:{text}}=await worker.recognize(`data:image/jpeg;base64,${imageBase64}`);
      await worker.terminate();
      setOcrDataProgress(100);
      const parsed=parseDocText(text);
      const count=Object.values(parsed).filter(Boolean).length;
      if(count>0){
        setFields(f=>({...f,...Object.fromEntries(Object.entries(parsed).filter(([,v])=>v).map(([k,v])=>([k,f[k as keyof DocFields]||v as string])))}));
        setExtractDone(true);
        showToast(`✅ Распознано ${count} полей (OCR)`);
      }else{
        setDataError('Текст не распознан. Попробуйте фото лучше или введите вручную.');
      }
    }catch{setDataError('Ошибка OCR. Введите данные вручную.');}
    finally{setExtracting(false);setOcrDataProgress(0);}
  },[]);

  const handleScan=useCallback(async(file:File,mode:'color'|'bw')=>{
    setScanning(true);setDataError(null);
    try{
      const{dataUrl}=await applyScanFilter(file,mode);
      setScanPreview(dataUrl);
      const thumb=await compressThumb(dataUrl);
      setScanHistory(prev=>{const updated=[{id:Date.now().toString(),thumb,full:dataUrl,date:Date.now(),mode},...prev].slice(0,15);try{localStorage.setItem('swaip_scan_history',JSON.stringify(updated));}catch{}return updated;});
      setScanning(false);
      await extractFromImage(dataUrl.split(',')[1],'image/jpeg');
    }catch{setScanning(false);setDataError('Ошибка при обработке изображения');}
  },[extractFromImage]);

  const handlePhoto=useCallback(async(file:File)=>{
    setDataError(null);
    const reader=new FileReader();
    reader.onload=async ev=>{
      const dataUrl=ev.target?.result as string;
      setScanPreview(dataUrl);
      const thumb=await compressThumb(dataUrl);
      setScanHistory(prev=>{const updated=[{id:Date.now().toString(),thumb,full:dataUrl,date:Date.now(),mode:'photo'},...prev].slice(0,15);try{localStorage.setItem('swaip_scan_history',JSON.stringify(updated));}catch{}return updated;});
      await extractFromImage(dataUrl.split(',')[1],file.type||'image/jpeg');
    };
    reader.readAsDataURL(file);
  },[extractFromImage]);

  /* AI analyse uploaded doc */
  const analyseDoc=useCallback(async(file:File)=>{
    setAnalysing(true);setAnalysisResult(null);
    try{
      const token=localStorage.getItem('session_token')||'';
      const kind=detectKind(file.name,file.type);
      let imageBase64='',imageMime='',textContent='';
      if(kind==='image'){const dr=new FileReader();const du=await new Promise<string>(res=>{dr.onload=e=>res(e.target?.result as string);dr.readAsDataURL(file);});imageBase64=du.split(',')[1];imageMime=file.type||'image/jpeg';}
      else if(kind==='docx'){const mammoth=await import('mammoth');const buf=await file.arrayBuffer();const r=await(mammoth as unknown as{convertToHtml:(o:{arrayBuffer:ArrayBuffer})=>Promise<{value:string}>}).convertToHtml({arrayBuffer:buf});textContent=r.value.replace(/<[^>]+>/g,' ').slice(0,3000);}
      else{textContent=(await file.text()).slice(0,3000);}
      const body:Record<string,string>={assistantId:'igor',text:imageBase64?'Это документ. Определи: 1) тип и название документа, 2) что уже заполнено (перечисли поля), 3) чего не хватает для полного оформления, 4) какой шаблон из списка подходит. Ответь структурированно на русском.':`Текст документа:\n\n${textContent}\n\nОпредели: 1) тип документа, 2) что заполнено, 3) чего не хватает, 4) какой шаблон подходит.`};
      if(imageBase64){body.imageBase64=imageBase64;body.imageMime=imageMime;}
      const resp=await fetch('/api/assistants/solve',{method:'POST',headers:{'Content-Type':'application/json','x-session-token':token},body:JSON.stringify(body)});
      if(!resp.ok)throw new Error('err');
      const data=await resp.json();setAnalysisResult(data.answer??data.text??'Не удалось проанализировать');
    }catch{setAnalysisResult('Ошибка при анализе. Попробуйте ещё раз.');}
    finally{setAnalysing(false);}
  },[]);

  const buildDoc=(tpl:Template)=>{setSelectedTpl(tpl);setResult(tpl.build(fields));setCollectingTpl(null);setShowCollectPreview(false);setTab('templates');};

  /* Build preview with placeholder labels for empty fields */
  const buildPreview=(tpl:Template):string=>{
    const pf={...EMPTY,...fields} as DocFields;
    Object.keys(EMPTY).forEach(k=>{
      const key=k as keyof DocFields;
      if(!pf[key]){pf[key]=FL[key]?`[${FL[key]}]`:'[___________]';}
    });
    return tpl.build(pf);
  };

  const COLLECT_JSON_SCHEMA=`{"fullName":"","passportSeries":"","passportNumber":"","passportIssuedBy":"","passportIssuedDate":"","birthDate":"","birthPlace":"","regAddress":"","inn":"","snils":"","phone":"","orgName":"","orgInn":"","orgAddress":"","bankName":"","bankBik":"","bankAccount":"","corrAccount":"","kpp":"","ogrn":"","postalAddress":"","childName":"","childBirthDate":"","childPassport":"","carBrand":"","carYear":"","carVin":"","vehiclePlate":"","counterFullName":"","counterAddress":"","counterPhone":"","selfEmployedInn":"","selfEmployedSnils":""}`;

  /* Extract from IMAGE in collect screen */
  const collectExtract=useCallback(async(imageBase64:string,imageMime:string,docId:string,prompt:string)=>{
    setCollectExtracting(docId);
    try{
      const token=localStorage.getItem('session_token')||'';
      const resp=await fetch('/api/assistants/solve',{method:'POST',headers:{'Content-Type':'application/json','x-session-token':token},body:JSON.stringify({assistantId:'igor',text:`Извлеки данные из документа. Верни ТОЛЬКО JSON без пояснений, комментариев и markdown. ${prompt} JSON-поля: ${COLLECT_JSON_SCHEMA}. Незнакомые или нераспознанные — пустая строка.`,imageBase64,imageMime})});
      if(!resp.ok)throw new Error('err');
      const data=await resp.json();const text:string=data.answer??data.text??'';
      const m=text.match(/\{[\s\S]*?\}/);
      if(m){const p=JSON.parse(m[0]);setFields(f=>({...f,...Object.fromEntries(Object.entries(p).filter(([,v])=>v).map(([k,v])=>([k,f[k as keyof DocFields]||v as string])))}));showToast('✅ Данные распознаны');}
      else showToast('⚠️ Не удалось распознать — заполните вручную');
    }catch{showToast('⚠️ Ошибка распознавания — заполните вручную');}
    finally{setCollectExtracting(null);}
  },[COLLECT_JSON_SCHEMA]);

  /* Extract from TEXT DOCUMENT (DOCX/TXT/CSV etc.) — free, no AI */
  const collectExtractText=useCallback(async(textContent:string,docId:string,_prompt:string)=>{
    setCollectExtracting(docId);
    try{
      const parsed=parseDocText(textContent);
      const count=Object.values(parsed).filter(Boolean).length;
      if(count>0){
        setFields(f=>({...f,...Object.fromEntries(Object.entries(parsed).filter(([,v])=>v).map(([k,v])=>([k,f[k as keyof DocFields]||v as string])))}));
        showToast(`✅ Извлечено ${count} полей из документа`);
      }else{
        showToast('⚠️ Поля не найдены — заполните вручную');
      }
    }catch{showToast('⚠️ Не удалось прочитать — заполните вручную');}
    finally{setCollectExtracting(null);}
  },[]);

  /* Universal file handler for collect screen — routes by type */
  const collectProcessFile=useCallback(async(file:File)=>{
    const docId=collectDocIdRef.current;const prompt=collectPromptRef.current;
    const kind=detectKind(file.name,file.type);
    if(kind==='image'){
      /* Open scanner modal so user can crop before extraction */
      const reader=new FileReader();
      reader.onload=ev=>{
        setScanner({imgSrc:ev.target?.result as string,file,docId,prompt});
      };
      reader.readAsDataURL(file);
      return;
    }else if(kind==='docx'){
      try{const mammoth=await import('mammoth');const buf=await file.arrayBuffer();const r=await(mammoth as unknown as{extractRawText:(o:{arrayBuffer:ArrayBuffer})=>Promise<{value:string}>}).extractRawText({arrayBuffer:buf});await collectExtractText(r.value,docId,prompt);}
      catch{showToast('⚠️ Не удалось прочитать DOCX');}
    }else{
      try{const t=await file.text();await collectExtractText(t,docId,prompt);}
      catch{showToast('⚠️ Не удалось прочитать файл');}
    }
  },[collectExtract,collectExtractText]);

  /* Download result */
  const doDownload=async(fmt:'txt'|'docx'|'pdf'|'rtf')=>{
    if(!result||!selectedTpl)return;
    setDlLoading(fmt);
    try{
      if(fmt==='txt')dlTxt(result,selectedTpl.name);
      else if(fmt==='docx')await dlDocx(result,selectedTpl.name);
      else if(fmt==='rtf')dlRtf(result,selectedTpl.name);
      else if(fmt==='pdf')await dlPdf(result,selectedTpl.name);
      showToast('✅ Файл скачан');
    }finally{setDlLoading(null);setShowDlModal(false);}
  };

  /* Reader */
  const processReaderFile=useCallback(async(file:File)=>{
    setRLoading(true);setRError(null);setTab('reader');
    if(rPdfUrl)URL.revokeObjectURL(rPdfUrl);
    if(rImageUrl?.startsWith('blob:'))URL.revokeObjectURL(rImageUrl);
    setRPdfUrl(null);setRDocHtml(null);setRDocText(null);setRDocTable(null);setRImageUrl(null);
    const kind=detectKind(file.name,file.type);
    setRDocName(file.name);setRDocKind(kind);
    try{
      if(kind==='pdf'){setRPdfUrl(URL.createObjectURL(file));setRViewing(true);}
      else if(kind==='image'){setRImageUrl(URL.createObjectURL(file));setRViewing(true);}
      else if(kind==='docx'){const mammoth=await import('mammoth');const buf=await file.arrayBuffer();const res=await(mammoth as unknown as{convertToHtml:(o:{arrayBuffer:ArrayBuffer})=>Promise<{value:string}>}).convertToHtml({arrayBuffer:buf});setRDocHtml(res.value||'<p><em>Пусто</em></p>');setRViewing(true);}
      else if(kind==='text'){setRDocText(await file.text());setRViewing(true);}
      else if(kind==='csv'){const t=await file.text();const rows=t.split('\n').filter(r=>r.trim()).map(r=>{const cells:string[]=[]; let cur='',inQ=false; for(const ch of r){if(ch==='"')inQ=!inQ;else if(ch===','&&!inQ){cells.push(cur);cur='';}else cur+=ch;} cells.push(cur); return cells;});setRDocTable(rows);setRViewing(true);}
      else if(kind==='xlsx'){const XLSX=await import('xlsx');const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];setRDocTable(XLSX.utils.sheet_to_json<unknown[]>(ws,{header:1,defval:''}));setRViewing(true);}
      else setRError('Формат не поддерживается');
      /* Save to recent list + cache content if small enough */
      const newId=Date.now().toString();
      setRecentDocs(prev=>{
        const removed=prev.filter(d=>d.name===file.name);
        removed.forEach(d=>{try{localStorage.removeItem('swaip_doc_c_'+d.id);}catch{}});
        const u=[{id:newId,name:file.name,kind,size:file.size,date:Date.now(),mimeType:file.type},...prev.filter(d=>d.name!==file.name)].slice(0,15);
        try{localStorage.setItem('swaip_docs_recent',JSON.stringify(u));}catch{}
        return u;
      });
      if(file.size<1.2*1024*1024){
        const dr=new FileReader();
        dr.onload=ev=>{try{localStorage.setItem('swaip_doc_c_'+newId,ev.target?.result as string);}catch{}};
        dr.readAsDataURL(file);
      }
    }catch(e){setRError('Ошибка: '+(e instanceof Error?e.message:String(e)));}
    finally{setRLoading(false);}
  },[rPdfUrl,rImageUrl]);

  /* Open recent doc from cache */
  const openRecentDoc=useCallback(async(d:RecentDoc)=>{
    const stored=localStorage.getItem('swaip_doc_c_'+d.id);
    if(stored){
      const arr=stored.split(',');const mimeMatch=arr[0].match(/:(.*?);/);
      const mime=mimeMatch?mimeMatch[1]:(d.mimeType||'application/octet-stream');
      const bstr=atob(arr[1]);const n=bstr.length;const u8=new Uint8Array(n);
      for(let i=0;i<n;i++)u8[i]=bstr.charCodeAt(i);
      const file=new File([u8],d.name,{type:mime});
      await processReaderFile(file);
    }else{
      showToast('⚠️ Кэш истёк — выберите файл снова');
      fileRef.current?.click();
    }
  },[processReaderFile]);

  /* Converter */
  const loadConvFile=useCallback(async(file:File)=>{
    const kind=detectKind(file.name,file.type);
    setConvDone(null);
    if(kind==='image'){const dr=new FileReader();const du=await new Promise<string>(res=>{dr.onload=e=>res(e.target?.result as string);dr.readAsDataURL(file);});setConvFile({name:file.name,kind,dataUrl:du});}
    else if(kind==='docx'||kind==='xlsx'||kind==='csv'){const buf=await file.arrayBuffer();setConvFile({name:file.name,kind,buffer:buf});}
    else if(kind==='text'||kind==='pdf'){const t=await file.text();setConvFile({name:file.name,kind,text:t});}
    else setConvFile({name:file.name,kind});
  },[]);

  const doConvert=useCallback(async(target:'pdf'|'docx'|'txt'|'csv'|'xlsx'|'img')=>{
    if(!convFile)return;
    setConverting(true);setConvDone(null);
    try{
      const baseName=convFile.name.replace(/\.[^.]+$/,'');
      if(target==='txt'){
        if(convFile.kind==='docx'&&convFile.buffer){const mammoth=await import('mammoth');const r=await(mammoth as unknown as{extractRawText:(o:{arrayBuffer:ArrayBuffer})=>Promise<{value:string}>}).extractRawText({arrayBuffer:convFile.buffer});dlTxt(r.value,baseName);}
        else if(convFile.text)dlTxt(convFile.text,baseName);
      }else if(target==='docx'){
        if(convFile.kind==='text'&&convFile.text){await dlDocx(convFile.text,baseName);}
        else if(convFile.kind==='image'&&convFile.dataUrl){
          const{Document,Packer,Paragraph,ImageRun}=await import('docx');
          const resp=await fetch(convFile.dataUrl);const buf=await resp.arrayBuffer();
          const img=new Image();
          await new Promise<void>(res=>{img.onload=()=>res();img.src=convFile.dataUrl!;});
          const w=Math.min(img.width,600);const h=Math.round(img.height*w/img.width);
          const rawExt=convFile.name.split('.').pop()?.toLowerCase()??'jpg';
          const imgType: 'jpg'|'png'|'gif' = rawExt==='png'?'png':rawExt==='gif'?'gif':'jpg';
          const imgDoc=new Document({sections:[{children:[new Paragraph({children:[new ImageRun({data:buf,transformation:{width:w,height:h},type:imgType})]})]}]});
          downloadBlob(await Packer.toBlob(imgDoc),baseName+'.docx');
        }
      }else if(target==='pdf'){
        if(convFile.kind==='image'&&convFile.dataUrl){
          /* Image → PDF: embed as single-page via pdfmake */
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pm=(await import('pdfmake/build/pdfmake')) as any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pf=(await import('pdfmake/build/vfs_fonts')) as any;
          const pmk=pm.default??pm;pmk.vfs=(pf.default??pf).vfs;
          pmk.createPdf({content:[{image:convFile.dataUrl,fit:[500,700]}],pageMargins:[20,20,20,20]}).download(baseName+'.pdf');
        }else if(convFile.kind==='docx'&&convFile.buffer){
          const mammoth=await import('mammoth');
          const r=await(mammoth as unknown as{extractRawText:(o:{arrayBuffer:ArrayBuffer})=>Promise<{value:string}>}).extractRawText({arrayBuffer:convFile.buffer});
          await dlPdf(r.value,baseName);
        }else if(convFile.text){await dlPdf(convFile.text,baseName);}
        setConvDone('pdf');
      }else if(target==='csv'&&convFile.kind==='xlsx'&&convFile.buffer){
        const XLSX=await import('xlsx');const wb=XLSX.read(convFile.buffer,{type:'array'});const ws=wb.Sheets[wb.SheetNames[0]];const csv=XLSX.utils.sheet_to_csv(ws);dlTxt(csv,baseName);
      }else if(target==='xlsx'&&convFile.kind==='csv'&&convFile.text){
        const XLSX=await import('xlsx');const ws=XLSX.utils.aoa_to_sheet(convFile.text.split('\n').map(r=>r.split(',')));const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Sheet1');const buf=XLSX.write(wb,{type:'array',bookType:'xlsx'});downloadBlob(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),baseName+'.xlsx');
      }
      if(target!=='pdf')setConvDone(target);
      showToast('✅ Конвертировано и скачано');
    }catch(e){showToast('Ошибка: '+(e instanceof Error?e.message:String(e)));}
    finally{setConverting(false);}
  },[convFile]);

  const printReader=()=>{
    const win=window.open('','_blank');if(!win)return;
    let body='';
    if(rDocHtml)body=`<style>body{font-family:Arial;margin:40px;font-size:14px;line-height:1.7;color:#000;}</style>${rDocHtml}`;
    else if(rDocText)body=`<style>body{font-family:monospace;margin:40px;font-size:12px;white-space:pre-wrap;color:#000;}</style>${rDocText.replace(/&/g,'&amp;').replace(/</g,'&lt;')}`;
    else if(rImageUrl)body=`<style>body{margin:10px;}img{max-width:100%;}</style><img src="${rImageUrl}"/>`;
    else if(rDocTable){const rows=(rDocTable as string[][]).map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('');body=`<style>body{font-family:Arial;margin:20px;}table{border-collapse:collapse;width:100%;}td,th{border:1px solid #ccc;padding:5px;font-size:11px;}</style><table>${rows}</table>`;}
    win.document.write(`<!DOCTYPE html><html><head><title>${rDocName}</title></head><body>${body}</body></html>`);
    win.document.close();setTimeout(()=>{win.focus();win.print();},500);
  };

  const visibleTemplates=TEMPLATES.filter(t=>(catFilter==='Все'||t.category===catFilter)&&(search===''||t.name.toLowerCase().includes(search.toLowerCase())||t.desc.toLowerCase().includes(search.toLowerCase())));

  /* Determine which image-doc upload cards to show for a given template */
  interface CollectDoc{id:string;icon:string;label:string;sublabel:string;prompt:string;done:boolean;}
  const getCollectDocs=(tpl:Template):CollectDoc[]=>{
    const ex=new Set(tpl.extras);
    const docs:CollectDoc[]=[];
    const ORG_EXTRAS:Array<keyof DocFields>=['orgName','orgInn','orgAddress','bankBik','bankAccount','bankName','corrAccount','kpp','ogrn','postalAddress','selfEmployedInn','selfEmployedSnils'];
    const needsOrg=ORG_EXTRAS.some(f=>ex.has(f));
    docs.push({id:'passport',icon:'🪪',label:'Паспорт',sublabel:'Фото, скан или файл — ФИО, серия/номер, дата выдачи, ИНН, СНИЛС, адрес заполнятся сами',prompt:'Данные паспорта: ФИО, серия и номер, кем выдан, дата выдачи, дата рождения, место рождения, адрес регистрации, ИНН, СНИЛС.',done:!!(fields.fullName&&fields.passportNumber)});
    if(needsOrg)docs.push({id:'orgcard',icon:'🏢',label:'Карточка предприятия / Реквизиты',sublabel:'Загрузи любой файл с реквизитами — ИНН, КПП, ОГРН, банк, счёт, адрес заполнятся автоматически',prompt:'Это карточка предприятия или реквизиты компании. Извлеки: orgName, orgInn, orgAddress, bankName, bankBik, bankAccount, corrAccount, kpp, ogrn, postalAddress, phone.',done:!!(fields.orgName&&fields.orgInn)});
    if(ex.has('childName')||ex.has('childBirthDate'))docs.push({id:'child',icon:'👶',label:'Свидетельство о рождении ребёнка',sublabel:'Фото, скан или файл — ФИО и дата рождения ребёнка заполнятся сами',prompt:'Свидетельство о рождении. Извлеки: childName (ФИО ребёнка), childBirthDate (дата рождения), childPassport.',done:!!(fields.childName)});
    if(ex.has('carBrand')||ex.has('carVin')||ex.has('vehiclePlate'))docs.push({id:'car',icon:'🚗',label:'ПТС или СТС',sublabel:'Фото или файл — марка, VIN, год выпуска, госномер заполнятся сами',prompt:'ПТС или СТС. Извлеки: carBrand (марка), carYear (год), carVin (VIN), vehiclePlate (госномер).',done:!!(fields.carBrand&&fields.carVin)});
    if(ex.has('counterFullName'))docs.push({id:'counter',icon:'👤',label:'Паспорт второй стороны',sublabel:'Данные контрагента, арендатора или заёмщика заполнятся автоматически',prompt:'Паспорт второй стороны сделки. Извлеки: counterFullName, counterAddress, counterPhone.',done:!!(fields.counterFullName)});
    docs.push({id:'other',icon:'📄',label:'Любой другой документ',sublabel:'Загрузи любой файл — фото, PDF, DOCX, TXT — бот извлечёт все возможные данные',prompt:'Это может быть любой документ. Извлеки максимум данных: ФИО, паспортные данные, адрес, ИНН, СНИЛС, реквизиты организации, банковские данные.',done:false});
    return docs;
  };

  const Field=({k,placeholder}:{k:keyof DocFields;placeholder?:string})=>(
    <div style={{marginBottom:10}}>
      <div style={{fontSize:10,fontWeight:700,color:SUB,marginBottom:4,textTransform:'uppercase',letterSpacing:0.5}}>{FL[k]}</div>
      <input value={fields[k]} onChange={e=>setField(k,e.target.value)} placeholder={placeholder??FL[k]??k}
        style={{width:'100%',padding:'10px 12px',borderRadius:10,background:CARD2,border:`1px solid ${fields[k]?'rgba(79,142,247,0.5)':BORDER}`,color:TEXT,fontSize:13,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}} />
    </div>
  );

  /* Target formats for converter */
  const convTargets=(kind:DocKind):Array<{fmt:'pdf'|'docx'|'txt'|'csv'|'xlsx'|'img';label:string;icon:string}>=>{
    if(kind==='image')return [{fmt:'pdf',label:'PDF',icon:'📄'},{fmt:'docx',label:'DOCX',icon:'📝'}];
    if(kind==='docx')return [{fmt:'txt',label:'TXT',icon:'📃'},{fmt:'pdf',label:'PDF',icon:'📄'}];
    if(kind==='text')return [{fmt:'docx',label:'DOCX',icon:'📝'},{fmt:'pdf',label:'PDF',icon:'📄'}];
    if(kind==='xlsx')return [{fmt:'csv',label:'CSV',icon:'📊'},{fmt:'pdf',label:'PDF',icon:'📄'}];
    if(kind==='csv')return [{fmt:'xlsx',label:'XLSX',icon:'📊'},{fmt:'pdf',label:'PDF',icon:'📄'}];
    if(kind==='pdf')return [{fmt:'txt',label:'TXT',icon:'📃'}];
    return [];
  };

  /* ────── RENDER ────── */
  return (
    <div style={{position:'fixed',inset:0,zIndex:800,background:BG,display:'flex',flexDirection:'column',fontFamily:'"Montserrat",sans-serif',overflow:'hidden'}}>

      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:12,padding:'48px 16px 12px',borderBottom:`1px solid ${BORDER}`,background:'rgba(9,9,15,0.98)',flexShrink:0,backdropFilter:'blur(16px)'}}>
        <motion.button whileTap={{scale:0.88}} onClick={()=>{
          if(tab==='templates'&&result){setResult(null);setSelectedTpl(null);setShowDlModal(false);}
          else if(tab==='templates'&&collectingTpl){setCollectingTpl(null);}
          else if(tab==='templates'&&analysisResult){setAnalysisResult(null);}
          else if(tab==='reader'&&rViewing){setRViewing(false);}
          else onBack();
        }} style={{width:36,height:36,borderRadius:'50%',background:CARD,border:`1px solid ${BORDER}`,color:TEXT,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>←</motion.button>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:15,fontWeight:900,color:TEXT}}>
            {tab==='templates'&&result?(selectedTpl?.name??'Документ'):tab==='templates'&&collectingTpl?collectingTpl.name:tab==='templates'&&analysisResult?'Анализ документа':'📂 Документы'}
          </div>
          {tab==='data'&&filledCount>0&&<div style={{fontSize:10,color:GREEN,marginTop:1,fontWeight:700}}>✓ {filledCount}/{baseKeys.length} основных полей</div>}
        </div>
        {tab==='templates'&&result&&(
          <div style={{display:'flex',gap:6}}>
            <motion.button whileTap={{scale:0.9}} onClick={()=>setShowDlModal(true)} style={{padding:'8px 14px',borderRadius:12,background:ACCENT,border:'none',color:'#fff',fontSize:12,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>⬇ Скачать</motion.button>
            <motion.button whileTap={{scale:0.9}} onClick={async()=>{if(navigator.share)try{await navigator.share({title:selectedTpl?.name??'',text:result??''});return;}catch{}await navigator.clipboard.writeText(result??'');showToast('📋 Скопировано');}} style={{width:34,height:34,borderRadius:10,background:CARD,border:`1px solid ${BORDER}`,color:TEXT,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>📤</motion.button>
          </div>
        )}
        {tab==='reader'&&rViewing&&(
          <div style={{display:'flex',gap:6}}>
            <motion.button whileTap={{scale:0.9}} onClick={printReader} style={{width:34,height:34,borderRadius:10,background:CARD,border:`1px solid ${BORDER}`,color:TEXT,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>🖨️</motion.button>
            {rDocKind==='image'&&<>
              <motion.button whileTap={{scale:0.9}} onClick={()=>setRImgZoom(z=>Math.min(z+0.25,4))} style={{width:34,height:34,borderRadius:10,background:CARD,border:`1px solid ${BORDER}`,color:TEXT,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>＋</motion.button>
              <motion.button whileTap={{scale:0.9}} onClick={()=>setRImgZoom(z=>Math.max(z-0.25,0.25))} style={{width:34,height:34,borderRadius:10,background:CARD,border:`1px solid ${BORDER}`,color:TEXT,fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>－</motion.button>
            </>}
          </div>
        )}
      </div>

      {/* Tab bar */}
      {!(tab==='templates'&&(result||analysisResult||collectingTpl))&&!(tab==='reader'&&rViewing)&&(
        <div style={{display:'flex',borderBottom:`1px solid ${BORDER}`,flexShrink:0,background:'rgba(9,9,15,0.98)'}}>
          {([{id:'data',icon:'👤',label:'Мои данные'},{id:'templates',icon:'📝',label:'Шаблоны'},{id:'reader',icon:'📂',label:'Читалка + Конвертер'}] as const).map(t=>(
            <motion.button key={t.id} whileTap={{scale:0.95}} onClick={()=>setTab(t.id)} style={{flex:1,padding:'12px 4px',background:'transparent',border:'none',color:tab===t.id?ACCENT:SUB,fontSize:10,fontWeight:800,cursor:'pointer',borderBottom:tab===t.id?`2px solid ${ACCENT}`:'2px solid transparent',display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
              <span style={{fontSize:15}}>{t.icon}</span>{t.label}
            </motion.button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{flex:1,overflow:'hidden',position:'relative'}}>
        <AnimatePresence mode="wait">

          {/* ═══ ДАННЫЕ ═══ */}
          {tab==='data'&&(
            <motion.div key="data" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{height:'100%',overflowY:'auto',padding:'16px 16px 120px'}}>
              <div style={{background:'linear-gradient(135deg,#0d1b38,#0d2230)',borderRadius:16,padding:16,marginBottom:16,border:`1px solid rgba(79,142,247,0.2)`,position:'relative',overflow:'hidden'}}>
                <div style={{fontSize:11,fontWeight:800,color:ACCENT,marginBottom:4,textTransform:'uppercase',letterSpacing:1}}>📷 Распознать данные из документа</div>
                <div style={{fontSize:11,color:SUB,marginBottom:12,lineHeight:1.5}}>Сфотографируйте паспорт, СНИЛС, ИНН, выписку — данные заполнятся автоматически</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:6}}>
                  <motion.button whileTap={{scale:0.95}} disabled={scanning||extracting} onClick={()=>scanColorRef.current?.click()} style={{padding:'11px 6px',borderRadius:12,background:ACCENT,border:'none',color:'#fff',fontSize:11,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5,opacity:(scanning||extracting)?0.5:1}}>🎨 Скан цветной</motion.button>
                  <motion.button whileTap={{scale:0.95}} disabled={scanning||extracting} onClick={()=>scanBwRef.current?.click()} style={{padding:'11px 6px',borderRadius:12,background:'transparent',border:`1.5px solid ${ACCENT}`,color:ACCENT,fontSize:11,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5,opacity:(scanning||extracting)?0.5:1}}>🖤 Скан Ч/Б</motion.button>
                </div>
                <motion.button whileTap={{scale:0.95}} disabled={scanning||extracting} onClick={()=>photoRef.current?.click()} style={{width:'100%',padding:'9px 6px',borderRadius:10,background:'transparent',border:`1px solid rgba(79,142,247,0.3)`,color:'rgba(79,142,247,0.7)',fontSize:11,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5,opacity:(scanning||extracting)?0.5:1,boxSizing:'border-box'}}>🖼 Фото из галереи</motion.button>
                {scanPreview&&<div style={{marginTop:12,borderRadius:10,overflow:'hidden',border:`1px solid ${BORDER}`}}><img src={scanPreview} alt="" style={{width:'100%',height:'auto',display:'block'}}/></div>}
                <AnimatePresence>
                  {(scanning||extracting)&&<motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{position:'absolute',inset:0,background:'rgba(9,9,15,0.92)',borderRadius:16,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:12}}>
                    {scanning?<>
                      <div style={{position:'relative',width:130,height:80,border:`2px solid ${ACCENT}`,borderRadius:8,overflow:'hidden'}}>
                        <motion.div animate={{y:[0,76,0]}} transition={{duration:1.2,repeat:Infinity,ease:'linear'}} style={{position:'absolute',left:0,right:0,height:3,background:`linear-gradient(90deg,transparent,${ACCENT},transparent)`,boxShadow:`0 0 8px ${ACCENT}`}}/>
                        <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:28}}>📄</div>
                      </div>
                      <div style={{color:ACCENT,fontSize:12,fontWeight:800}}>Сканирую…</div>
                    </>:<>
                      <div style={{width:160,textAlign:'center'}}>
                        <div style={{fontSize:22,marginBottom:8}}>🔍</div>
                        <div style={{height:5,background:'rgba(79,142,247,0.15)',borderRadius:4,overflow:'hidden',marginBottom:6}}>
                          <motion.div animate={{width:`${ocrDataProgress||5}%`}} transition={{duration:0.3}} style={{height:'100%',background:'#059669',borderRadius:4}}/>
                        </div>
                        <div style={{color:'#059669',fontSize:11,fontWeight:800}}>
                          {ocrDataProgress>0&&ocrDataProgress<100?`OCR ${ocrDataProgress}%…`:'Распознаю текст…'}
                        </div>
                        <div style={{color:'rgba(255,255,255,0.3)',fontSize:9,marginTop:3}}>бесплатно · данные не покидают устройство</div>
                      </div>
                    </>}
                  </motion.div>}
                </AnimatePresence>
              </div>

              {scanHistory.length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:800,color:SUB,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>🕐 История сканов — нажмите для просмотра</div>
                  <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4}}>
                    {scanHistory.map(item=>(
                      <motion.div key={item.id} whileTap={{scale:0.95}} onClick={()=>setPreviewImg(item.full)} style={{flexShrink:0,width:72,borderRadius:10,overflow:'hidden',border:`2px solid ${BORDER}`,cursor:'pointer',background:'#111'}}>
                        <img src={item.thumb} alt="" style={{width:'100%',height:90,objectFit:'cover',display:'block'}}/>
                        <div style={{padding:'3px 5px',fontSize:9,color:SUB,background:'rgba(0,0,0,0.7)'}}>
                          {item.mode==='color'?'🎨':item.mode==='bw'?'🖤':'📷'} {new Date(item.date).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {extractDone&&<div style={{padding:'10px 14px',borderRadius:12,background:'rgba(52,211,153,0.1)',border:`1px solid rgba(52,211,153,0.25)`,color:GREEN,fontSize:12,fontWeight:700,marginBottom:14}}>✅ Данные распознаны! Проверьте поля ниже.</div>}
              {dataError&&<div style={{padding:'10px 14px',borderRadius:12,background:'rgba(255,80,80,0.1)',border:'1px solid rgba(255,80,80,0.25)',color:RED,fontSize:12,fontWeight:600,marginBottom:14}}>⚠️ {dataError}</div>}

              <div style={{fontSize:11,fontWeight:800,color:SUB,textTransform:'uppercase',letterSpacing:1,marginBottom:12}}>✏️ Личные данные</div>
              <Field k="fullName" placeholder="Иванов Иван Иванович"/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><Field k="passportSeries" placeholder="92 07"/><Field k="passportNumber" placeholder="341626"/></div>
              <Field k="passportIssuedBy" placeholder="УФМС России по РТ..."/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><Field k="passportIssuedDate" placeholder="04.12.2008"/><Field k="birthDate" placeholder="26.07.1987"/></div>
              <Field k="birthPlace" placeholder="г. Казань"/>
              <Field k="regAddress" placeholder="РТ, Набережные Челны, пр. Мира, 23-162"/>
              <Field k="city" placeholder="Набережные Челны"/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><Field k="phone" placeholder="+7 (999) 000-00-00"/><Field k="inn" placeholder="162812345678"/></div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><Field k="snils" placeholder="123-456-789 00"/><Field k="ogrn" placeholder="ОГРН/ОГРНИП"/></div>
              <div style={{fontSize:11,fontWeight:800,color:SUB,textTransform:'uppercase',letterSpacing:1,marginBottom:12,marginTop:6}}>🏢 Для бизнеса (ИП/ООО)</div>
              <Field k="orgName" placeholder="Название организации"/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><Field k="orgInn" placeholder="ИНН орг."/><Field k="kpp" placeholder="КПП"/></div>
              <Field k="orgAddress" placeholder="Юридический адрес"/>
              <Field k="bankName" placeholder="Банк (Сбер/Тинькофф...)"/>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}><Field k="bankBik" placeholder="БИК"/><Field k="bankAccount" placeholder="Расчётный счёт"/></div>
              <Field k="corrAccount" placeholder="Корреспондентский счёт"/>
              <motion.button whileTap={{scale:0.97}} onClick={()=>setTab('templates')} style={{width:'100%',marginTop:8,padding:'14px',borderRadius:14,background:ACCENT,border:'none',color:'#fff',fontSize:14,fontWeight:900,cursor:'pointer'}}>Выбрать шаблон →</motion.button>
              <motion.button whileTap={{scale:0.97}} onClick={()=>{setFields({...EMPTY,today:fields.today});setScanPreview(null);setExtractDone(false);showToast('Очищено');}} style={{width:'100%',marginTop:8,padding:'12px',borderRadius:14,background:'transparent',border:`1px solid ${BORDER}`,color:SUB,fontSize:12,fontWeight:700,cursor:'pointer'}}>Очистить данные</motion.button>
            </motion.div>
          )}

          {/* ═══ ШАБЛОНЫ — список ═══ */}
          {tab==='templates'&&!result&&!analysisResult&&!collectingTpl&&(
            <motion.div key="tpl-list" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{height:'100%',overflowY:'auto',padding:'14px 14px 120px'}}>
              <motion.button whileTap={{scale:0.97}} disabled={analysing} onClick={()=>analyseRef.current?.click()}
                style={{width:'100%',padding:'14px',borderRadius:14,background:'linear-gradient(135deg,#0d2230,#0d1b38)',border:`1px solid rgba(79,142,247,0.3)`,color:TEXT,fontSize:13,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',gap:12,marginBottom:14,boxSizing:'border-box',opacity:analysing?0.6:1}}>
                <span style={{fontSize:22,flexShrink:0}}>📎</span>
                <div style={{textAlign:'left'}}>
                  <div style={{color:ACCENT}}>Вставить свой документ</div>
                  <div style={{fontSize:10,color:SUB,fontWeight:500,marginTop:2}}>Загрузи фото/скан/DOCX — бот скажет чего не хватает</div>
                </div>
                {analysing&&<motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}} style={{width:20,height:20,borderRadius:'50%',border:`2px solid rgba(79,142,247,0.2)`,borderTopColor:ACCENT,flexShrink:0,marginLeft:'auto'}}/>}
              </motion.button>
              {filledCount<3&&<div style={{padding:'10px 14px',borderRadius:12,background:`rgba(251,191,36,0.1)`,border:`1px solid rgba(251,191,36,0.25)`,color:AMBER,fontSize:11,fontWeight:700,marginBottom:12}}>⚠️ Заполнено {filledCount}/{baseKeys.length} полей. <span style={{textDecoration:'underline',cursor:'pointer'}} onClick={()=>setTab('data')}>Добавить →</span></div>}
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по шаблонам…" style={{width:'100%',padding:'10px 14px',borderRadius:12,background:CARD2,border:`1px solid ${BORDER}`,color:TEXT,fontSize:13,outline:'none',boxSizing:'border-box',marginBottom:10,fontFamily:'inherit'}}/>
              <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:8,marginBottom:12}}>
                {['Все',...CATS].map(c=>(
                  <motion.button key={c} whileTap={{scale:0.95}} onClick={()=>setCatFilter(c)} style={{flexShrink:0,padding:'5px 12px',borderRadius:20,background:catFilter===c?ACCENT:CARD,border:`1px solid ${catFilter===c?ACCENT:BORDER}`,color:catFilter===c?'#fff':SUB,fontSize:10,fontWeight:800,cursor:'pointer'}}>
                    {c}
                  </motion.button>
                ))}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {visibleTemplates.map(tpl=>(
                  <motion.button key={tpl.id} whileTap={{scale:0.97}} onClick={()=>setCollectingTpl(tpl)} style={{padding:'13px',borderRadius:14,background:CARD,border:`1px solid ${BORDER}`,color:TEXT,cursor:'pointer',textAlign:'left',display:'flex',alignItems:'center',gap:12}}>
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

          {/* ═══ СБОР ДАННЫХ ДЛЯ ШАБЛОНА ═══ */}
          {tab==='templates'&&collectingTpl&&!result&&!analysisResult&&(
            <motion.div key="collect" initial={{opacity:0,x:30}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-30}} style={{height:'100%',overflowY:'auto',padding:'16px 16px 120px'}}>

              {/* Template card */}
              <div style={{borderRadius:16,background:'linear-gradient(135deg,#0d1b38,#0d2230)',border:`1px solid rgba(79,142,247,0.3)`,marginBottom:20,overflow:'hidden'}}>
                <div style={{display:'flex',alignItems:'center',gap:12,padding:'14px'}}>
                  <div style={{width:52,height:52,borderRadius:14,background:'rgba(79,142,247,0.15)',border:`1px solid rgba(79,142,247,0.25)`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,flexShrink:0}}>{collectingTpl.icon}</div>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:900,color:TEXT,lineHeight:1.3}}>{collectingTpl.name}</div>
                    <div style={{fontSize:10,color:ACCENT,fontWeight:700,marginTop:3}}>{collectingTpl.category}</div>
                    <div style={{fontSize:10,color:SUB,marginTop:2,lineHeight:1.4}}>{collectingTpl.desc}</div>
                  </div>
                </div>
                <motion.button whileTap={{scale:0.97}} onClick={()=>setShowCollectPreview(true)}
                  style={{width:'100%',padding:'10px 14px',background:'rgba(79,142,247,0.1)',border:'none',borderTop:`1px solid rgba(79,142,247,0.2)`,color:ACCENT,fontSize:12,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6,boxSizing:'border-box'}}>
                  👁 Предпросмотр документа
                </motion.button>
              </div>

              {/* ─── Helper: upload button ─── */}
              {(()=>{
                const UploadBtn=({docId,prompt,done}:{docId:string;prompt:string;done:boolean})=>(
                  <motion.button whileTap={{scale:0.97}} disabled={collectExtracting===docId}
                    onClick={()=>{collectDocIdRef.current=docId;collectPromptRef.current=prompt;collectPhotoRef.current?.click();}}
                    style={{width:'100%',padding:'10px',borderRadius:10,background:done?'rgba(52,211,153,0.08)':'rgba(79,142,247,0.08)',border:`1px solid ${done?'rgba(52,211,153,0.5)':ACCENT}`,color:done?GREEN:ACCENT,fontSize:11,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:7,boxSizing:'border-box',marginBottom:12,opacity:collectExtracting===docId?0.7:1}}>
                    {collectExtracting===docId?<><motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}} style={{width:14,height:14,borderRadius:'50%',border:`2px solid rgba(79,142,247,0.2)`,borderTopColor:ACCENT}}/>Распознаю…</>:done?<>✅ Данные загружены · обновить фото</>:<>📷 Загрузить фото / скан / PDF / DOCX</>}
                  </motion.button>
                );
                const InputRows=({rows}:{rows:Array<Array<keyof DocFields>>})=><>{rows.map((row,ri)=>(
                  <div key={ri} style={{display:'grid',gridTemplateColumns:row.length===1?'1fr':`repeat(${row.length},1fr)`,gap:7,marginBottom:8}}>
                    {row.map(k=>(
                      <div key={k}>
                        <div style={{fontSize:9,fontWeight:700,color:fields[k]?ACCENT:SUB,marginBottom:3,textTransform:'uppercase',letterSpacing:0.5}}>{FL[k]??k}</div>
                        <input value={fields[k]} onChange={e=>setField(k,e.target.value)} placeholder={FL[k]??k}
                          style={{width:'100%',padding:'9px 10px',borderRadius:8,background:CARD2,border:`1.5px solid ${fields[k]?'rgba(79,142,247,0.45)':BORDER}`,color:TEXT,fontSize:12,outline:'none',boxSizing:'border-box',fontFamily:'inherit'}}/>
                      </div>
                    ))}
                  </div>
                ))}</>;

                const ex=new Set(collectingTpl.extras);
                const COUNTER_FIELDS:Array<keyof DocFields>=['counterFullName','counterPassport','counterAddress'];
                const ORG_FIELDS_LIST:Array<keyof DocFields>=['orgName','orgInn','orgAddress','bankName','bankBik','bankAccount','corrAccount','kpp','ogrn','postalAddress'];
                const CHILD_FIELDS:Array<keyof DocFields>=['childName','childBirthDate','childPassport'];
                const CAR_FIELDS:Array<keyof DocFields>=['carBrand','carYear','carVin','vehiclePlate'];
                const needsCounter=COUNTER_FIELDS.some(f=>ex.has(f));
                const needsOrg=ORG_FIELDS_LIST.some(f=>ex.has(f));
                const needsChild=CHILD_FIELDS.some(f=>ex.has(f));
                const needsCar=CAR_FIELDS.some(f=>ex.has(f));
                const usedSpecial=new Set([...COUNTER_FIELDS,...ORG_FIELDS_LIST,...CHILD_FIELDS,...CAR_FIELDS] as Array<keyof DocFields>);
                const otherExtras=collectingTpl.extras.filter(k=>!usedSpecial.has(k));

                const SectionHeader=({num,icon,title,sub}:{num:number;icon:string;title:string;sub?:string})=>(
                  <div style={{display:'flex',alignItems:'center',gap:8,marginTop:18,marginBottom:10}}>
                    <div style={{width:26,height:26,borderRadius:'50%',background:ACCENT,display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:900,color:'#fff',flexShrink:0}}>{num}</div>
                    <div>
                      <div style={{fontSize:12,fontWeight:900,color:TEXT}}>{icon} {title}</div>
                      {sub&&<div style={{fontSize:10,color:SUB,marginTop:1}}>{sub}</div>}
                    </div>
                  </div>
                );

                const boxStyle={borderRadius:14,background:CARD,border:`1px solid ${BORDER}`,padding:'14px',marginBottom:4};

                return <>
                  {/* УЧАСТНИК 1 */}
                  <SectionHeader num={1} icon="👤" title="Участник 1 — Вы (первая сторона)" sub="Загрузите паспорт или заполните вручную"/>
                  <div style={boxStyle}>
                    <UploadBtn docId="passport" prompt="Данные паспорта: ФИО, серия и номер, кем выдан, дата выдачи, дата рождения, место рождения, адрес регистрации, ИНН, СНИЛС." done={!!(fields.fullName&&fields.passportNumber)}/>
                    <InputRows rows={[['fullName'],['passportSeries','passportNumber'],['passportIssuedBy'],['passportIssuedDate','birthDate'],['birthPlace'],['regAddress'],['inn','snils'],['phone']]}/>
                  </div>

                  {/* ОРГАНИЗАЦИЯ */}
                  {needsOrg&&<>
                    <SectionHeader num={2} icon="🏢" title="Организация / Реквизиты" sub="Загрузите карточку предприятия или введите вручную"/>
                    <div style={boxStyle}>
                      <UploadBtn docId="orgcard" prompt="Карточка предприятия или реквизиты: orgName, orgInn, orgAddress, bankName, bankBik, bankAccount, corrAccount, kpp, ogrn, postalAddress, phone." done={!!(fields.orgName&&fields.orgInn)}/>
                      <InputRows rows={[['orgName'],['orgInn','kpp'],['ogrn'],['orgAddress'],['bankName'],['bankBik','bankAccount'],['corrAccount'],['postalAddress']]}/>
                    </div>
                  </>}

                  {/* УЧАСТНИК 2 */}
                  {needsCounter&&<>
                    <SectionHeader num={needsOrg?3:2} icon="👥" title="Участник 2 — Контрагент (вторая сторона)" sub="Загрузите паспорт контрагента или введите вручную"/>
                    <div style={boxStyle}>
                      <UploadBtn docId="counter" prompt="Паспорт второй стороны сделки. Извлеки: counterFullName (ФИО), counterPassport (серия/номер паспорта), counterAddress (адрес)." done={!!(fields.counterFullName)}/>
                      <InputRows rows={[['counterFullName'],['counterPassport'],['counterAddress']]}/>
                    </div>
                  </>}

                  {/* РЕБЁНОК */}
                  {needsChild&&<>
                    <SectionHeader num={[needsOrg,needsCounter].filter(Boolean).length+2} icon="👶" title="Данные ребёнка" sub="Загрузите свидетельство о рождении или введите вручную"/>
                    <div style={boxStyle}>
                      <UploadBtn docId="child" prompt="Свидетельство о рождении. Извлеки: childName (ФИО ребёнка), childBirthDate (дата рождения), childPassport." done={!!(fields.childName)}/>
                      <InputRows rows={[['childName'],['childBirthDate'],['childPassport']]}/>
                    </div>
                  </>}

                  {/* АВТОМОБИЛЬ */}
                  {needsCar&&<>
                    <SectionHeader num={[needsOrg,needsCounter,needsChild].filter(Boolean).length+2} icon="🚗" title="Данные автомобиля" sub="Загрузите ПТС/СТС или введите вручную"/>
                    <div style={boxStyle}>
                      <UploadBtn docId="car" prompt="ПТС или СТС. Извлеки: carBrand (марка), carYear (год), carVin (VIN), vehiclePlate (госномер)." done={!!(fields.carBrand&&fields.carVin)}/>
                      <InputRows rows={[['carBrand','carYear'],['carVin'],['vehiclePlate']]}/>
                    </div>
                  </>}

                  {/* ДАННЫЕ ДОКУМЕНТА */}
                  {otherExtras.length>0&&<>
                    <SectionHeader num={[needsOrg,needsCounter,needsChild,needsCar].filter(Boolean).length+2} icon="📋" title="Данные документа" sub="Специфичные для этого шаблона"/>
                    <div style={boxStyle}>
                      <InputRows rows={otherExtras.map(k=>[k])}/>
                    </div>
                  </>}

                  {/* ЛЮБОЙ ДРУГОЙ ДОК */}
                  <div style={{marginTop:14,padding:'12px 14px',borderRadius:12,background:'rgba(79,142,247,0.05)',border:`1px dashed rgba(79,142,247,0.3)`}}>
                    <div style={{fontSize:10,fontWeight:700,color:ACCENT,marginBottom:6}}>📄 Загрузить любой другой документ</div>
                    <div style={{fontSize:10,color:SUB,marginBottom:8}}>Выписка ЕГРН, договор, справка, ИНН, СНИЛС — бот извлечёт все данные</div>
                    <UploadBtn docId="other" prompt="Извлеки максимум данных: ФИО, паспорт, адрес, ИНН, СНИЛС, реквизиты организации, банковские данные." done={false}/>
                  </div>
                </>;
              })()}

              {/* Create button */}
              <motion.button whileTap={{scale:0.97}} onClick={()=>buildDoc(collectingTpl)}
                style={{width:'100%',marginTop:20,padding:'17px',borderRadius:16,background:`linear-gradient(135deg,${ACCENT},#5b21b6)`,border:'none',color:'#fff',fontSize:15,fontWeight:900,cursor:'pointer',boxSizing:'border-box',boxShadow:`0 4px 24px rgba(79,142,247,0.35)`}}>
                ✨ Создать документ
              </motion.button>
              <div style={{textAlign:'center',fontSize:10,color:SUB,marginTop:8,lineHeight:1.5}}>Документ будет готов мгновенно · Скачайте в PDF, DOCX, RTF или TXT</div>
            </motion.div>
          )}

          {/* ═══ Анализ ═══ */}
          {tab==='templates'&&analysisResult&&!result&&(
            <motion.div key="analysis" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0}} style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden'}}>
              <div style={{flex:1,overflowY:'auto',padding:'20px 16px 100px'}}>
                <div style={{padding:'14px',borderRadius:14,background:'rgba(79,142,247,0.08)',border:`1px solid rgba(79,142,247,0.2)`,marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:800,color:ACCENT,marginBottom:6,textTransform:'uppercase',letterSpacing:1}}>📊 Анализ документа</div>
                  <div style={{fontSize:13,color:TEXT,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{analysisResult}</div>
                </div>
                <motion.button whileTap={{scale:0.97}} onClick={()=>{setAnalysisResult(null);}} style={{width:'100%',padding:'13px',borderRadius:14,background:ACCENT,border:'none',color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer'}}>Выбрать шаблон →</motion.button>
              </div>
            </motion.div>
          )}

          {/* ═══ Заполненный документ ═══ */}
          {tab==='templates'&&result&&(
            <motion.div key="result" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0}} style={{height:'100%',display:'flex',flexDirection:'column',overflow:'hidden'}}>
              {selectedTpl&&selectedTpl.extras.some(k=>!fields[k])&&(
                <div style={{padding:'12px 16px',borderBottom:`1px solid ${BORDER}`,background:'rgba(9,9,15,0.98)',flexShrink:0,maxHeight:'220px',overflowY:'auto'}}>
                  <div style={{fontSize:10,fontWeight:800,color:AMBER,marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>✏️ Дополните данные для этого документа</div>
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    {selectedTpl.extras.filter(k=>!fields[k]).map(k=>(
                      <input key={k} value={fields[k]} onChange={e=>{setField(k,e.target.value);if(selectedTpl)setResult(selectedTpl.build({...fields,[k]:e.target.value}));}}
                        placeholder={FL[k]??k} style={{padding:'9px 12px',borderRadius:10,background:CARD2,border:`1px solid rgba(251,191,36,0.4)`,color:TEXT,fontSize:12,outline:'none',fontFamily:'inherit'}}/>
                    ))}
                  </div>
                </div>
              )}
              <div style={{flex:1,overflowY:'auto',background:'#fff'}}>
                <pre style={{fontFamily:'"Times New Roman",serif',fontSize:14,lineHeight:1.9,color:'#111',whiteSpace:'pre-wrap',wordBreak:'break-word',margin:0,padding:'28px 24px'}}>{result}</pre>
              </div>
              <div style={{display:'flex',gap:8,padding:'12px 16px',borderTop:`1px solid ${BORDER}`,background:'rgba(9,9,15,0.98)',flexShrink:0}}>
                <motion.button whileTap={{scale:0.95}} onClick={()=>setShowDlModal(true)} style={{flex:2,padding:'12px',borderRadius:12,background:ACCENT,border:'none',color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>⬇ Скачать</motion.button>
                <motion.button whileTap={{scale:0.95}} onClick={async()=>{if(navigator.share)try{await navigator.share({title:selectedTpl?.name??'',text:result??''});return;}catch{}await navigator.clipboard.writeText(result??'');showToast('📋 Скопировано');}} style={{flex:1,padding:'12px',borderRadius:12,background:CARD,border:`1px solid ${BORDER}`,color:TEXT,fontSize:13,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>📤</motion.button>
                <motion.button whileTap={{scale:0.95}} onClick={()=>openPrintWindow(result??'',selectedTpl?.name??'Документ')} style={{width:46,padding:'12px',borderRadius:12,background:CARD,border:`1px solid ${BORDER}`,color:TEXT,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>🖨️</motion.button>
              </div>
            </motion.div>
          )}

          {/* ═══ ЧИТАЛКА + КОНВЕРТЕР — home ═══ */}
          {tab==='reader'&&!rViewing&&(
            <motion.div key="reader-home" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{height:'100%',overflowY:'auto',padding:'16px 16px 120px'}}>

              {/* Scanner */}
              <div style={{background:'linear-gradient(135deg,#0d1b38,#0d2230)',borderRadius:16,padding:14,marginBottom:14,border:`1px solid rgba(79,142,247,0.2)`}}>
                <div style={{fontSize:11,fontWeight:800,color:ACCENT,marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>📷 Сканер</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  <motion.button whileTap={{scale:0.95}} onClick={()=>scanColorRef.current?.click()} style={{padding:'10px 6px',borderRadius:12,background:ACCENT,border:'none',color:'#fff',fontSize:11,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>🎨 Цветной</motion.button>
                  <motion.button whileTap={{scale:0.95}} onClick={()=>scanBwRef.current?.click()} style={{padding:'10px 6px',borderRadius:12,background:'transparent',border:`1.5px solid ${ACCENT}`,color:ACCENT,fontSize:11,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5}}>🖤 Ч/Б</motion.button>
                </div>
              </div>

              {/* Open file */}
              <motion.button whileTap={{scale:0.97}} onClick={()=>fileRef.current?.click()} style={{width:'100%',padding:16,borderRadius:16,background:CARD,border:`2px dashed ${BORDER}`,color:TEXT,fontSize:13,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:12,marginBottom:14,boxSizing:'border-box'}}>
                <span style={{fontSize:24}}>📂</span>
                <div style={{textAlign:'left'}}>
                  <div>Открыть файл</div>
                  <div style={{fontSize:10,color:SUB,fontWeight:500,marginTop:2}}>PDF · DOCX · TXT · XLSX · CSV · JPG · PNG</div>
                </div>
              </motion.button>

              {rError&&<div style={{padding:'12px',borderRadius:12,background:'rgba(255,80,80,0.1)',border:'1px solid rgba(255,80,80,0.25)',color:RED,fontSize:12,marginBottom:14}}>⚠️ {rError}</div>}

              {/* Scan history */}
              {scanHistory.length>0&&(
                <div style={{marginBottom:16}}>
                  <div style={{fontSize:11,fontWeight:800,color:SUB,textTransform:'uppercase',letterSpacing:1,marginBottom:8}}>🕐 История сканов</div>
                  <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:4}}>
                    {scanHistory.map(item=>(
                      <motion.div key={item.id} whileTap={{scale:0.95}} onClick={()=>setPreviewImg(item.full)} style={{flexShrink:0,width:72,borderRadius:10,overflow:'hidden',border:`2px solid ${BORDER}`,cursor:'pointer',background:'#111'}}>
                        <img src={item.thumb} alt="" style={{width:'100%',height:90,objectFit:'cover',display:'block'}}/>
                        <div style={{padding:'3px 5px',fontSize:9,color:SUB,background:'rgba(0,0,0,0.7)'}}>{item.mode==='color'?'🎨':item.mode==='bw'?'🖤':'📷'} {new Date(item.date).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit'})}</div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent files */}
              {recentDocs.length>0&&(
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:11,fontWeight:800,color:SUB,textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>📄 Последние файлы</div>
                  {recentDocs.map(d=>(
                    <div key={d.id} style={{display:'flex',alignItems:'center',gap:12,padding:'11px 14px',borderRadius:14,background:CARD,border:`1px solid ${BORDER}`,marginBottom:8}}>
                      <div style={{fontSize:22}}>{kindIcon(d.kind)}</div>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,fontWeight:700,color:TEXT,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{d.name}</div>
                        <div style={{fontSize:10,color:SUB,marginTop:1}}>{kindLabel(d.kind)} · {fmtSize(d.size)} · {fmtDate(d.date)}</div>
                      </div>
                      <motion.button whileTap={{scale:0.9}} onClick={()=>openRecentDoc(d)} style={{padding:'6px 10px',borderRadius:8,background:'rgba(79,142,247,0.12)',border:`1px solid rgba(79,142,247,0.2)`,color:ACCENT,fontSize:10,fontWeight:700,cursor:'pointer',flexShrink:0}}>{localStorage.getItem('swaip_doc_c_'+d.id)?'📂 Открыть':'Найти файл'}</motion.button>
                    </div>
                  ))}
                </div>
              )}

              {/* Converter section */}
              <div style={{borderTop:`1px solid ${BORDER}`,paddingTop:16}}>
                <div style={{fontSize:13,fontWeight:900,color:TEXT,marginBottom:4}}>🔄 Конвертер форматов</div>
                <div style={{fontSize:11,color:SUB,marginBottom:12}}>Загрузи файл → выбери формат → скачай. Поддерживаются: Изображение↔PDF, Изображение→DOCX, DOCX↔TXT, DOCX→PDF, XLSX↔CSV</div>
                <motion.button whileTap={{scale:0.97}} onClick={()=>convRef.current?.click()} style={{width:'100%',padding:14,borderRadius:14,background:CARD,border:`2px dashed rgba(52,211,153,0.3)`,color:GREEN,fontSize:13,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:12,marginBottom:12,boxSizing:'border-box'}}>
                  <span style={{fontSize:22}}>⬆️</span>
                  <div style={{textAlign:'left'}}>
                    <div>{convFile?`Файл: ${convFile.name}`:'Загрузить файл для конвертации'}</div>
                    <div style={{fontSize:10,fontWeight:500,marginTop:2,color:SUB}}>PDF · DOCX · TXT · XLSX · CSV · JPG · PNG</div>
                  </div>
                </motion.button>
                {convFile&&(
                  <div>
                    <div style={{fontSize:11,color:SUB,marginBottom:8,fontWeight:700}}>Конвертировать в:</div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                      {convTargets(convFile.kind).length===0?(
                        <div style={{fontSize:11,color:SUB}}>Нет доступных конвертаций для этого формата</div>
                      ):convTargets(convFile.kind).map(({fmt,label,icon})=>(
                        <motion.button key={fmt} whileTap={{scale:0.95}} disabled={converting} onClick={()=>doConvert(fmt)}
                          style={{padding:'10px 16px',borderRadius:12,background:convDone===fmt?GREEN:'transparent',border:`2px solid ${convDone===fmt?GREEN:BORDER}`,color:convDone===fmt?'#000':TEXT,fontSize:12,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',gap:6,opacity:converting?0.6:1}}>
                          {converting?<motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}} style={{width:14,height:14,borderRadius:'50%',border:'2px solid rgba(79,142,247,0.2)',borderTopColor:ACCENT}}/>:<span>{icon}</span>}
                          {label}
                        </motion.button>
                      ))}
                    </div>
                    {convFile.kind==='pdf'&&<div style={{fontSize:11,color:AMBER,marginTop:8}}>⚠️ PDF→DOCX требует специализированных сервисов, доступна только конвертация в TXT.</div>}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ═══ ЧИТАЛКА — viewer ═══ */}
          {tab==='reader'&&rViewing&&(
            <motion.div key="viewer" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} exit={{opacity:0}} style={{height:'100%',overflow:'hidden',display:'flex',flexDirection:'column',position:'relative'}}>
              {rDocKind==='pdf'&&rPdfUrl&&<iframe src={rPdfUrl} style={{flex:1,width:'100%',border:'none',background:'#fff'}} title={rDocName}/>}
              {rDocKind==='docx'&&rDocHtml&&<div style={{flex:1,overflowY:'auto',background:'#fff'}}><div style={{maxWidth:800,margin:'0 auto',padding:'32px 24px',fontFamily:'Arial,sans-serif',fontSize:14,lineHeight:1.7,color:'#111'}} dangerouslySetInnerHTML={{__html:rDocHtml}}/></div>}
              {rDocKind==='text'&&rDocText!==null&&<div style={{flex:1,overflowY:'auto',background:'#fafafa',padding:24}}><pre style={{fontFamily:'"Courier New",monospace',fontSize:13,lineHeight:1.7,color:'#111',whiteSpace:'pre-wrap',wordBreak:'break-word',margin:0}}>{rDocText}</pre></div>}
              {rDocKind==='image'&&rImageUrl&&<div style={{flex:1,overflow:'auto',background:'#111',display:'flex',alignItems:'flex-start',justifyContent:'center',padding:16}}><img src={rImageUrl} alt={rDocName} style={{transform:`scale(${rImgZoom})`,transformOrigin:'top center',maxWidth:'100%',height:'auto',transition:'transform 0.2s'}}/></div>}
              {(rDocKind==='xlsx'||rDocKind==='csv')&&rDocTable&&(
                <div style={{flex:1,overflow:'auto',background:'#fff'}}>
                  <table style={{borderCollapse:'collapse',width:'100%',fontSize:12,fontFamily:'Arial,sans-serif'}}>
                    <thead><tr>{(rDocTable[0] as string[]).map((h,i)=><th key={i} style={{border:'1px solid #d0d0d0',padding:'7px 10px',background:'#f5f5f5',fontWeight:700,color:'#222',whiteSpace:'nowrap',position:'sticky',top:0}}>{String(h)}</th>)}</tr></thead>
                    <tbody>{(rDocTable.slice(1) as string[][]).map((row,ri)=><tr key={ri} style={{background:ri%2===0?'#fff':'#f9f9f9'}}>{row.map((cell,ci)=><td key={ci} style={{border:'1px solid #e8e8e8',padding:'6px 10px',color:'#222'}}>{String(cell??'')}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              )}
              {rLoading&&<div style={{position:'absolute',inset:0,background:'rgba(9,9,15,0.85)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:14}}><motion.div animate={{rotate:360}} transition={{duration:1,repeat:Infinity,ease:'linear'}} style={{width:42,height:42,borderRadius:'50%',border:`3px solid rgba(79,142,247,0.2)`,borderTopColor:ACCENT}}/><div style={{color:TEXT,fontSize:13,fontWeight:700}}>Открываю…</div></div>}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ═══ Download modal ═══ */}
      <AnimatePresence>
        {showDlModal&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setShowDlModal(false)} style={{position:'fixed',inset:0,zIndex:1100,background:'rgba(0,0,0,0.72)',display:'flex',alignItems:'flex-end'}}>
            <motion.div initial={{y:340}} animate={{y:0}} exit={{y:340}} transition={{type:'spring',damping:28}} onClick={e=>e.stopPropagation()} style={{width:'100%',background:'#12121a',borderRadius:'24px 24px 0 0',padding:'24px 20px 48px',border:`1px solid ${BORDER}`}}>
              {/* Handle */}
              <div style={{width:40,height:4,borderRadius:2,background:'rgba(255,255,255,0.12)',margin:'0 auto 20px'}}/>
              {/* Download section */}
              <div style={{fontSize:11,fontWeight:800,color:SUB,textTransform:'uppercase',letterSpacing:1,marginBottom:10}}>⬇ Скачать как</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:20}}>
                {([
                  {fmt:'pdf',icon:'📄',label:'PDF'},
                  {fmt:'docx',icon:'📝',label:'DOCX'},
                  {fmt:'rtf',icon:'📑',label:'RTF'},
                  {fmt:'txt',icon:'📃',label:'TXT'},
                ] as const).map(({fmt,icon,label})=>(
                  <motion.button key={fmt} whileTap={{scale:0.92}} disabled={!!dlLoading} onClick={()=>doDownload(fmt)}
                    style={{padding:'14px 6px',borderRadius:14,background:dlLoading===fmt?ACCENT:CARD,border:`1px solid ${dlLoading===fmt?ACCENT:BORDER}`,color:TEXT,cursor:'pointer',textAlign:'center',opacity:dlLoading&&dlLoading!==fmt?0.45:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6}}>
                    <div style={{fontSize:24}}>{dlLoading===fmt?<motion.div animate={{rotate:360}} transition={{duration:0.8,repeat:Infinity,ease:'linear'}} style={{display:'inline-block',width:22,height:22,borderRadius:'50%',border:'2px solid rgba(255,255,255,0.2)',borderTopColor:'#fff'}}/>:icon}</div>
                    <div style={{fontSize:11,fontWeight:900}}>{label}</div>
                  </motion.button>
                ))}
              </div>
              {/* Print + Share row */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <motion.button whileTap={{scale:0.95}} onClick={()=>{setShowDlModal(false);openPrintWindow(result??'',selectedTpl?.name??'Документ');}} style={{padding:'13px',borderRadius:14,background:CARD,border:`1px solid ${BORDER}`,color:TEXT,fontSize:13,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                  🖨️ Печать
                </motion.button>
                <motion.button whileTap={{scale:0.95}} onClick={async()=>{setShowDlModal(false);if(navigator.share)try{await navigator.share({title:selectedTpl?.name??'',text:result??''});return;}catch{}await navigator.clipboard.writeText(result??'');showToast('📋 Скопировано в буфер');}} style={{padding:'13px',borderRadius:14,background:CARD,border:`1px solid ${BORDER}`,color:TEXT,fontSize:13,fontWeight:800,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
                  📤 Поделиться
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Предпросмотр шаблона ═══ */}
      <AnimatePresence>
        {showCollectPreview&&collectingTpl&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} style={{position:'fixed',inset:0,zIndex:900,background:'rgba(0,0,0,0.7)',display:'flex',flexDirection:'column',backdropFilter:'blur(4px)'}}>
            <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}} transition={{type:'spring',damping:28,stiffness:280}} style={{position:'absolute',bottom:0,left:0,right:0,top:'5%',borderRadius:'20px 20px 0 0',background:'rgba(9,9,15,0.98)',display:'flex',flexDirection:'column',overflow:'hidden',border:`1px solid ${BORDER}`}}>
              {/* Preview header */}
              <div style={{display:'flex',alignItems:'center',gap:12,padding:'16px 16px 12px',borderBottom:`1px solid ${BORDER}`,flexShrink:0}}>
                <motion.button whileTap={{scale:0.88}} onClick={()=>setShowCollectPreview(false)} style={{width:36,height:36,borderRadius:'50%',background:CARD,border:`1px solid ${BORDER}`,color:TEXT,fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>←</motion.button>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:900,color:TEXT}}>{collectingTpl.icon} {collectingTpl.name}</div>
                  <div style={{fontSize:10,color:AMBER,marginTop:2,fontWeight:700}}>👁 Образец — поля в [скобках] нужно заполнить</div>
                </div>
                <motion.button whileTap={{scale:0.95}} onClick={()=>{setShowCollectPreview(false);buildDoc(collectingTpl);}} style={{padding:'8px 14px',borderRadius:12,background:ACCENT,border:'none',color:'#fff',fontSize:11,fontWeight:800,cursor:'pointer',flexShrink:0}}>✨ Создать</motion.button>
              </div>
              {/* Preview content */}
              <div style={{flex:1,overflowY:'auto',background:'#fff'}}>
                <pre style={{fontFamily:'"Times New Roman",serif',fontSize:13,lineHeight:1.9,color:'#111',whiteSpace:'pre-wrap',wordBreak:'break-word',margin:0,padding:'24px 20px'}}>{buildPreview(collectingTpl)}</pre>
              </div>
              {/* Preview footer */}
              <div style={{padding:'12px 16px',borderTop:`1px solid ${BORDER}`,background:'rgba(9,9,15,0.98)',display:'flex',gap:8,flexShrink:0}}>
                <motion.button whileTap={{scale:0.97}} onClick={()=>setShowCollectPreview(false)} style={{flex:1,padding:'13px',borderRadius:12,background:CARD,border:`1px solid ${BORDER}`,color:TEXT,fontSize:13,fontWeight:800,cursor:'pointer'}}>← Вернуться к заполнению</motion.button>
                <motion.button whileTap={{scale:0.97}} onClick={()=>{setShowCollectPreview(false);buildDoc(collectingTpl);}} style={{flex:1,padding:'13px',borderRadius:12,background:ACCENT,border:'none',color:'#fff',fontSize:13,fontWeight:800,cursor:'pointer'}}>✨ Создать документ</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Scan preview modal ═══ */}
      <AnimatePresence>
        {previewImg&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} onClick={()=>setPreviewImg(null)} style={{position:'fixed',inset:0,zIndex:1000,background:'rgba(0,0,0,0.93)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20}}>
            <motion.div initial={{scale:0.8}} animate={{scale:1}} exit={{scale:0.8}} onClick={e=>e.stopPropagation()} style={{maxWidth:'100%',maxHeight:'80vh',borderRadius:12,overflow:'hidden'}}>
              <img src={previewImg} alt="" style={{maxWidth:'100vw',maxHeight:'80vh',objectFit:'contain',display:'block'}}/>
            </motion.div>
            <div style={{display:'flex',gap:10,marginTop:16}}>
              <motion.button whileTap={{scale:0.9}} onClick={()=>{const b64=previewImg.split(',')[1];const bin=atob(b64);const arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);downloadBlob(new Blob([arr],{type:'image/jpeg'}),`scan_${Date.now()}.jpg`);showToast('✅ Скачано');}} style={{padding:'10px 20px',borderRadius:12,background:GREEN,border:'none',color:'#000',fontSize:13,fontWeight:800,cursor:'pointer'}}>⬇ Скачать JPG</motion.button>
              <motion.button whileTap={{scale:0.9}} onClick={()=>setPreviewImg(null)} style={{padding:'10px 20px',borderRadius:12,background:'rgba(255,255,255,0.1)',border:`1px solid ${BORDER}`,color:TEXT,fontSize:13,fontWeight:700,cursor:'pointer'}}>Закрыть</motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast&&<motion.div initial={{opacity:0,y:30}} animate={{opacity:1,y:0}} exit={{opacity:0,y:30}} style={{position:'fixed',bottom:90,left:'50%',transform:'translateX(-50%)',background:'rgba(20,30,60,0.97)',border:`1px solid ${BORDER}`,color:TEXT,padding:'10px 20px',borderRadius:40,fontSize:13,fontWeight:700,zIndex:999,whiteSpace:'nowrap',backdropFilter:'blur(10px)'}}>{toast}</motion.div>}
      </AnimatePresence>

      {/* Hidden inputs */}
      <input ref={scanColorRef} type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files?.[0];if(f)handleScan(f,'color');e.target.value='';}} style={{display:'none'}}/>
      <input ref={scanBwRef} type="file" accept="image/*" capture="environment" onChange={e=>{const f=e.target.files?.[0];if(f)handleScan(f,'bw');e.target.value='';}} style={{display:'none'}}/>
      <input ref={photoRef} type="file" accept="image/*" onChange={e=>{const f=e.target.files?.[0];if(f)handlePhoto(f);e.target.value='';}} style={{display:'none'}}/>
      <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.md,.csv,.xlsx,.xls,.jpg,.jpeg,.png,.gif,.webp" onChange={e=>{const f=e.target.files?.[0];if(f)processReaderFile(f);e.target.value='';}} style={{display:'none'}}/>
      <input ref={analyseRef} type="file" accept="image/*,.pdf,.docx,.doc,.txt" onChange={e=>{const f=e.target.files?.[0];if(f)analyseDoc(f);e.target.value='';}} style={{display:'none'}}/>
      <input ref={convRef} type="file" accept=".pdf,.docx,.doc,.txt,.md,.csv,.xlsx,.xls,.jpg,.jpeg,.png,.gif,.webp" onChange={e=>{const f=e.target.files?.[0];if(f)loadConvFile(f);e.target.value='';}} style={{display:'none'}}/>
      <input ref={collectPhotoRef} type="file" accept="image/*,.pdf,.docx,.doc,.txt,.rtf,.odt,.csv,.xlsx,.xls" onChange={e=>{
        const f=e.target.files?.[0];if(!f)return;
        collectProcessFile(f);
        e.target.value='';
      }} style={{display:'none'}}/>

      {/* ─── Scanner modal ─── */}
      {scanner&&<ScannerModal
        info={scanner}
        onExtract={async(b64,mime,docId,prompt)=>{await collectExtract(b64,mime,docId,prompt);}}
        onFieldsSet={(parsed)=>{setFields(prev=>{const next={...prev};Object.entries(parsed).forEach(([k,v])=>{if(v&&k in next)(next as Record<string,string>)[k]=v;});return next;});}}
        onClose={()=>setScanner(null)}
      />}
    </div>
  );
}
