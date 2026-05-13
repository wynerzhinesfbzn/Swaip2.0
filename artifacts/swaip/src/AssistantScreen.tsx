import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { type Specialist } from './specialistsConfig';
import { type ConvState } from './AssistantsHub';
import { useBackHandler } from './backHandler';

interface Answer {
  title: string;
  answer: string;
  voiceScript: string;
  voice: string;
  docType?: string | null;
}

interface SealItem {
  id: string;
  name: string;
  img: string;
  isGenerated: boolean;
}

interface StampInfo {
  companyName?: string | null;
  orgType?: string | null;
  inn?: string | null;
  ogrn?: string | null;
  city?: string | null;
}

function generateStampSvg(info: StampInfo): string {
  const W = 220, H = 220, cx = 110, cy = 110;
  const R = 102, Ri = 91;
  const col = '#1a3282';
  const raw = (info.orgType ? `${info.orgType} ` : '') + (info.companyName || 'ОРГАНИЗАЦИЯ');
  const name = raw.toUpperCase().slice(0, 32);
  const inn  = info.inn  ? `ИНН ${info.inn}`  : '';
  const ogrn = info.ogrn ? `ОГРН ${info.ogrn}` : '';
  const city = (info.city || '').toUpperCase().slice(0, 20);
  const uid  = Math.random().toString(36).slice(2, 7);
  const centerY1 = cy + (inn && ogrn ? -7 : 4);
  const centerY2 = cy + 10;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <circle cx="${cx}" cy="${cy}" r="${R}"  fill="none" stroke="${col}" stroke-width="4"   opacity="0.87"/>
  <circle cx="${cx}" cy="${cy}" r="${Ri}" fill="none" stroke="${col}" stroke-width="1.8" opacity="0.87"/>
  <defs>
    <path id="ta${uid}" d="M ${cx-Ri+6},${cy} A ${Ri-6},${Ri-6} 0 0,1 ${cx+Ri-6},${cy}"/>
    <path id="ba${uid}" d="M ${cx-Ri+6},${cy} A ${Ri-6},${Ri-6} 0 0,0 ${cx+Ri-6},${cy}"/>
  </defs>
  <text font-family="Arial,sans-serif" font-size="11.5" font-weight="bold" fill="${col}" opacity="0.88">
    <textPath href="#ta${uid}" startOffset="50%" text-anchor="middle">${name}</textPath>
  </text>
  ${city ? `<g transform="rotate(180,${cx},${cy})"><text font-family="Arial,sans-serif" font-size="10.5" fill="${col}" opacity="0.85"><textPath href="#ba${uid}" startOffset="50%" text-anchor="middle">${city}</textPath></text></g>` : ''}
  ${inn  ? `<text x="${cx}" y="${centerY1}" text-anchor="middle" font-family="Arial,sans-serif" font-size="9.5" fill="${col}" opacity="0.87">${inn}</text>`  : ''}
  ${ogrn ? `<text x="${cx}" y="${centerY2}" text-anchor="middle" font-family="Arial,sans-serif" font-size="9.5" fill="${col}" opacity="0.87">${ogrn}</text>` : ''}
  ${!inn && !ogrn ? `<text x="${cx}" y="${cy+6}" text-anchor="middle" font-family="Arial,sans-serif" font-size="15" font-weight="bold" fill="${col}" opacity="0.55">М.П.</text>` : ''}
</svg>`;
}

function svgToDataUrl(svg: string): string {
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
}

const DOC_TITLES: Record<string, string> = {
  invoice:        'СЧЁТ НА ОПЛАТУ',
  commercial:     'КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ',
  act:            'АКТ ВЫПОЛНЕННЫХ РАБОТ',
  ndfl2:          'СПРАВКА 2-НДФЛ',
  ndfl3:          'НАЛОГОВАЯ ДЕКЛАРАЦИЯ 3-НДФЛ',
  payment:        'ПЛАТЁЖНОЕ ПОРУЧЕНИЕ',
  report:         'БУХГАЛТЕРСКИЙ ОТЧЁТ',
  galina_doc:     'БУХГАЛТЕРСКИЙ ДОКУМЕНТ',
};

const IGOR_DOC_TITLES: Record<string, string> = {
  lease:            'ДОГОВОР НАЙМА ЖИЛОГО ПОМЕЩЕНИЯ',
  sale_car:         'ДОГОВОР КУПЛИ-ПРОДАЖИ ТРАНСПОРТНОГО СРЕДСТВА',
  sale_apt:         'ДОГОВОР КУПЛИ-ПРОДАЖИ КВАРТИРЫ',
  employment:       'ТРУДОВОЙ ДОГОВОР',
  poa:              'ДОВЕРЕННОСТЬ',
  receipt:          'РАСПИСКА О ПОЛУЧЕНИИ ДЕНЕЖНЫХ СРЕДСТВ',
  claim:            'ПРЕТЕНЗИЯ',
  complaint:        'ЖАЛОБА',
  statement:        'ЗАЯВЛЕНИЕ',
  divorce:          'ЗАЯВЛЕНИЕ О РАСТОРЖЕНИИ БРАКА',
  alimony:          'СОГЛАШЕНИЕ ОБ УПЛАТЕ АЛИМЕНТОВ',
  marriage_contract:'БРАЧНЫЙ ДОГОВОР',
  inheritance:      'ЗАЯВЛЕНИЕ О ПРИНЯТИИ НАСЛЕДСТВА',
  will:             'ЗАВЕЩАНИЕ',
  euro_protocol:    'ИЗВЕЩЕНИЕ О ДТП (ЕВРОПРОТОКОЛ)',
  bankruptcy:       'ЗАЯВЛЕНИЕ О ПРИЗНАНИИ БАНКРОТОМ',
  lawsuit:          'ИСКОВОЕ ЗАЯВЛЕНИЕ',
  loan:             'ДОГОВОР ЗАЙМА',
  gift:             'ДОГОВОР ДАРЕНИЯ',
  service_agreement:'ДОГОВОР ОКАЗАНИЯ УСЛУГ',
  work_contract:    'ДОГОВОР ПОДРЯДА',
  deposit_agreement:'СОГЛАШЕНИЕ О ЗАДАТКЕ',
  resignation:      'ЗАЯВЛЕНИЕ ОБ УВОЛЬНЕНИИ',
  freelance:               'ДОГОВОР С САМОЗАНЯТЫМ',
  legal_doc:               'ЮРИДИЧЕСКИЙ ДОКУМЕНТ',
  rospatent_author_consent:'СОГЛАСИЕ АВТОРА НА УКАЗАНИЕ СВЕДЕНИЙ ОБ АВТОРЕ',
  rospatent_pd_consent:    'СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ',
};

/* ── Form field/config types ── */
interface IgorFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date';
  placeholder?: string;
  options?: string[];
  hint?: string;
  required?: boolean;
}
interface IgorFormSection { heading: string; fields: IgorFormField[]; }
interface IgorDocFormConfig {
  key: string;
  emoji: string;
  title: string;
  docType: string;
  sections: IgorFormSection[];
  buildPrompt: (v: Record<string, string>) => string;
}

const IGOR_FORM_CONFIGS: IgorDocFormConfig[] = [
  /* 1. Договор найма квартиры */
  {
    key: 'lease', emoji: '🏠', title: 'Договор найма квартиры', docType: 'lease',
    sections: [
      { heading: 'Наймодатель (владелец)', fields: [
        { key: 'l_fio', label: 'ФИО', type: 'text', placeholder: 'Иванов Иван Иванович', required: true },
        { key: 'l_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '1234 567890', required: true },
        { key: 'l_passport_by', label: 'Кем и когда выдан', type: 'text', placeholder: 'ОМВД г. Набережные Челны, 01.03.2015' },
        { key: 'l_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 1, кв. 10', required: true },
        { key: 'l_phone', label: 'Телефон', type: 'text', placeholder: '+7 900 000-00-00' },
      ]},
      { heading: 'Наниматель (арендатор)', fields: [
        { key: 't_fio', label: 'ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
        { key: 't_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '4321 098765', required: true },
        { key: 't_passport_by', label: 'Кем и когда выдан', type: 'text', placeholder: 'УМВД г. Казань, 15.06.2018' },
        { key: 't_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5, кв. 3', required: true },
        { key: 't_phone', label: 'Телефон', type: 'text', placeholder: '+7 911 111-11-11' },
      ]},
      { heading: 'Объект найма', fields: [
        { key: 'apt_address', label: 'Адрес квартиры', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 15, кв. 42', required: true },
        { key: 'apt_area', label: 'Площадь (кв. м)', type: 'text', placeholder: '45.6', required: true },
        { key: 'apt_rooms', label: 'Количество комнат', type: 'text', placeholder: '2', required: true },
        { key: 'apt_cadastral', label: 'Кадастровый номер', type: 'text', placeholder: '16:52:040101:123' },
      ]},
      { heading: 'Условия найма', fields: [
        { key: 'rent_from', label: 'Дата начала', type: 'date', required: true },
        { key: 'rent_to', label: 'Дата окончания', type: 'date', required: true },
        { key: 'rent_amount', label: 'Арендная плата (₽/мес)', type: 'text', placeholder: '25 000', required: true },
        { key: 'deposit', label: 'Залог (₽)', type: 'text', placeholder: '25 000' },
        { key: 'payment_day', label: 'День оплаты (число месяца)', type: 'text', placeholder: '10' },
        { key: 'utilities', label: 'Коммунальные услуги', type: 'select', options: ['Входят в стоимость аренды', 'Оплачиваются нанимателем отдельно по счётчикам', 'Фиксированная доплата 3 000 ₽/мес'], required: true },
        { key: 'city', label: 'Город заключения договора', type: 'text', placeholder: 'Набережные Челны' },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ ПОЛНЫЙ ДОГОВОР НАЙМА ЖИЛОГО ПОМЕЩЕНИЯ (не задавай вопросов, используй только предоставленные данные, оформи как готовый юридический документ по нормам ГК РФ гл. 35 со всеми разделами: предмет, права и обязанности сторон, порядок расчётов, ответственность, срок, расторжение, реквизиты и подписи).
НАЙМОДАТЕЛЬ: ${v.l_fio}, паспорт ${v.l_passport}, выдан ${v.l_passport_by||'—'}, адрес: ${v.l_address}${v.l_phone?', тел. '+v.l_phone:''}.
НАНИМАТЕЛЬ: ${v.t_fio}, паспорт ${v.t_passport}, выдан ${v.t_passport_by||'—'}, адрес: ${v.t_address}${v.t_phone?', тел. '+v.t_phone:''}.
ОБЪЕКТ: ${v.apt_address}, площадь ${v.apt_area} кв.м, комнат: ${v.apt_rooms}${v.apt_cadastral?', кадастровый номер: '+v.apt_cadastral:''}.
УСЛОВИЯ: срок с ${v.rent_from} по ${v.rent_to}; арендная плата ${v.rent_amount} ₽/мес, оплата до ${v.payment_day||'10'}-го числа; залог ${v.deposit||'не предусмотрен'}; коммунальные услуги — ${v.utilities}. Город составления: ${v.city||'Набережные Челны'}.`,
  },

  /* 2. ДКП автомобиля */
  {
    key: 'sale_car', emoji: '🚗', title: 'ДКП автомобиля', docType: 'sale_car',
    sections: [
      { heading: 'Продавец', fields: [
        { key: 's_fio', label: 'ФИО', type: 'text', placeholder: 'Иванов Иван Иванович', required: true },
        { key: 's_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '1234 567890', required: true },
        { key: 's_passport_by', label: 'Кем и когда выдан', type: 'text', placeholder: 'ОМВД г. Набережные Челны, 01.01.2015' },
        { key: 's_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 1', required: true },
        { key: 's_phone', label: 'Телефон', type: 'text', placeholder: '+7 900 000-00-00' },
      ]},
      { heading: 'Покупатель', fields: [
        { key: 'b_fio', label: 'ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
        { key: 'b_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '4321 098765', required: true },
        { key: 'b_passport_by', label: 'Кем и когда выдан', type: 'text', placeholder: 'УМВД г. Казань, 15.06.2018' },
        { key: 'b_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5', required: true },
        { key: 'b_phone', label: 'Телефон', type: 'text', placeholder: '+7 911 111-11-11' },
      ]},
      { heading: 'Транспортное средство', fields: [
        { key: 'car_brand', label: 'Марка и модель', type: 'text', placeholder: 'Toyota Camry', required: true },
        { key: 'car_year', label: 'Год выпуска', type: 'text', placeholder: '2020', required: true },
        { key: 'car_color', label: 'Цвет', type: 'text', placeholder: 'Белый', required: true },
        { key: 'car_vin', label: 'VIN (идентификационный номер)', type: 'text', placeholder: 'XTA210993Y2392839', required: true },
        { key: 'car_reg', label: 'Государственный рег. номер', type: 'text', placeholder: 'А123БВ116' },
        { key: 'car_pts', label: 'ПТС (серия и номер)', type: 'text', placeholder: '16 ОТ 123456', required: true },
        { key: 'car_pts_by', label: 'ПТС выдан', type: 'text', placeholder: 'МРЭО ГИБДД МВД по РТ, 15.05.2020' },
        { key: 'car_mileage', label: 'Пробег (км)', type: 'text', placeholder: '45 000' },
      ]},
      { heading: 'Цена и расчёты', fields: [
        { key: 'price', label: 'Стоимость (₽)', type: 'text', placeholder: '1 200 000', required: true },
        { key: 'payment', label: 'Порядок оплаты', type: 'select', options: ['Полностью при подписании договора', 'Аванс 50%, остаток при передаче ТС', 'Безналичный перевод в течение 3 дней'], required: true },
        { key: 'city', label: 'Город составления', type: 'text', placeholder: 'Набережные Челны' },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ ПОЛНЫЙ ДОГОВОР КУПЛИ-ПРОДАЖИ ТРАНСПОРТНОГО СРЕДСТВА (не задавай вопросов, оформи как готовый документ по нормам ГК РФ со всеми разделами: предмет, состояние ТС, цена, порядок расчётов, передача ТС, гарантии продавца, ответственность, реквизиты и подписи).
ПРОДАВЕЦ: ${v.s_fio}, паспорт ${v.s_passport}, выдан ${v.s_passport_by||'—'}, адрес: ${v.s_address}${v.s_phone?', тел. '+v.s_phone:''}.
ПОКУПАТЕЛЬ: ${v.b_fio}, паспорт ${v.b_passport}, выдан ${v.b_passport_by||'—'}, адрес: ${v.b_address}${v.b_phone?', тел. '+v.b_phone:''}.
ТС: ${v.car_brand}, ${v.car_year} г.в., цвет ${v.car_color}, VIN ${v.car_vin}${v.car_reg?', рег. знак '+v.car_reg:''}, ПТС ${v.car_pts}${v.car_pts_by?' ('+v.car_pts_by+')':''}${v.car_mileage?', пробег '+v.car_mileage+' км':''}.
ЦЕНА: ${v.price} ₽; оплата: ${v.payment}. Город: ${v.city||'Набережные Челны'}.`,
  },

  /* 3. ДКП квартиры */
  {
    key: 'sale_apt', emoji: '🏢', title: 'ДКП квартиры', docType: 'sale_apt',
    sections: [
      { heading: 'Продавец', fields: [
        { key: 's_fio', label: 'ФИО', type: 'text', placeholder: 'Иванов Иван Иванович', required: true },
        { key: 's_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '1234 567890', required: true },
        { key: 's_passport_by', label: 'Кем и когда выдан', type: 'text', placeholder: 'ОМВД г. Набережные Челны, 01.01.2015' },
        { key: 's_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 1', required: true },
        { key: 's_phone', label: 'Телефон', type: 'text', placeholder: '+7 900 000-00-00' },
      ]},
      { heading: 'Покупатель', fields: [
        { key: 'b_fio', label: 'ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
        { key: 'b_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '4321 098765', required: true },
        { key: 'b_passport_by', label: 'Кем и когда выдан', type: 'text', placeholder: 'УМВД г. Казань, 15.06.2018' },
        { key: 'b_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5', required: true },
        { key: 'b_phone', label: 'Телефон', type: 'text', placeholder: '+7 911 111-11-11' },
      ]},
      { heading: 'Объект недвижимости', fields: [
        { key: 'apt_address', label: 'Адрес квартиры', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 15, кв. 42', required: true },
        { key: 'apt_area', label: 'Общая площадь (кв. м)', type: 'text', placeholder: '56.3', required: true },
        { key: 'apt_rooms', label: 'Количество комнат', type: 'text', placeholder: '2', required: true },
        { key: 'apt_floor', label: 'Этаж / всего этажей', type: 'text', placeholder: '5/9' },
        { key: 'apt_cadastral', label: 'Кадастровый номер', type: 'text', placeholder: '16:52:040101:123', required: true },
        { key: 'apt_doc', label: 'Правоустанавливающий документ продавца', type: 'text', placeholder: 'Свидетельство о праве собственности от 10.05.2015, или Выписка ЕГРН' },
      ]},
      { heading: 'Цена и расчёты', fields: [
        { key: 'price', label: 'Цена квартиры (₽)', type: 'text', placeholder: '5 500 000', required: true },
        { key: 'payment', label: 'Порядок оплаты', type: 'select', options: ['Полностью при подписании договора', 'Через банковскую ячейку', 'Через аккредитив', 'Ипотека (указать банк)'], required: true },
        { key: 'mortgage_bank', label: 'Банк (если ипотека)', type: 'text', placeholder: 'ПАО Сбербанк' },
        { key: 'city', label: 'Город составления', type: 'text', placeholder: 'Набережные Челны' },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ ПОЛНЫЙ ДОГОВОР КУПЛИ-ПРОДАЖИ КВАРТИРЫ (не задавай вопросов, оформи по нормам ГК РФ ст. 549-558, включи все разделы: предмет, цена, порядок расчётов, передача имущества, права на объект, обременения, ответственность, регистрация перехода права, реквизиты сторон и подписи).
ПРОДАВЕЦ: ${v.s_fio}, паспорт ${v.s_passport}, выдан ${v.s_passport_by||'—'}, адрес: ${v.s_address}${v.s_phone?', тел. '+v.s_phone:''}.
ПОКУПАТЕЛЬ: ${v.b_fio}, паспорт ${v.b_passport}, выдан ${v.b_passport_by||'—'}, адрес: ${v.b_address}${v.b_phone?', тел. '+v.b_phone:''}.
ОБЪЕКТ: ${v.apt_address}, площадь ${v.apt_area} кв.м, комнат ${v.apt_rooms}${v.apt_floor?', этаж '+v.apt_floor:''}, кадастровый номер ${v.apt_cadastral}${v.apt_doc?', основание права: '+v.apt_doc:''}.
ЦЕНА: ${v.price} ₽; расчёт: ${v.payment}${v.mortgage_bank?' ('+v.mortgage_bank+')':''}. Город: ${v.city||'Набережные Челны'}.`,
  },

  /* 4. Доверенность */
  {
    key: 'poa', emoji: '✍️', title: 'Доверенность', docType: 'poa',
    sections: [
      { heading: 'Доверитель (кто выдаёт)', fields: [
        { key: 'd_fio', label: 'ФИО', type: 'text', placeholder: 'Иванов Иван Иванович', required: true },
        { key: 'd_dob', label: 'Дата рождения', type: 'date', required: true },
        { key: 'd_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '1234 567890', required: true },
        { key: 'd_passport_by', label: 'Кем и когда выдан', type: 'text', placeholder: 'ОМВД г. Набережные Челны, 01.01.2015' },
        { key: 'd_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 1', required: true },
      ]},
      { heading: 'Представитель (кому выдают)', fields: [
        { key: 'r_fio', label: 'ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
        { key: 'r_dob', label: 'Дата рождения', type: 'date' },
        { key: 'r_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '4321 098765', required: true },
        { key: 'r_passport_by', label: 'Кем и когда выдан', type: 'text', placeholder: 'УМВД г. Казань, 15.06.2018' },
        { key: 'r_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5', required: true },
      ]},
      { heading: 'Полномочия и срок', fields: [
        { key: 'authority', label: 'Полномочия (что разрешено делать)', type: 'textarea', placeholder: 'Управлять и распоряжаться автомобилем Toyota Camry (VIN …), совершать все необходимые действия по регистрации в ГИБДД, получать и сдавать документы…', required: true },
        { key: 'valid_until', label: 'Действительна до', type: 'date', required: true },
        { key: 'notarial', label: 'Требуется нотариальное заверение?', type: 'select', options: ['Нет (простая письменная форма)', 'Да (нотариально удостоверяемая)'] },
        { key: 'city', label: 'Город составления', type: 'text', placeholder: 'Набережные Челны' },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ ПОЛНУЮ ДОВЕРЕННОСТЬ (не задавай вопросов, оформи по нормам ГК РФ ст. 185-189, с полными реквизитами сторон, конкретными полномочиями и подписью доверителя).
ДОВЕРИТЕЛЬ: ${v.d_fio}, дата рождения ${v.d_dob}, паспорт ${v.d_passport}, выдан ${v.d_passport_by||'—'}, адрес: ${v.d_address}.
ПРЕДСТАВИТЕЛЬ: ${v.r_fio}${v.r_dob?', дата рождения '+v.r_dob:''}, паспорт ${v.r_passport}, выдан ${v.r_passport_by||'—'}, адрес: ${v.r_address}.
ПОЛНОМОЧИЯ: ${v.authority}.
СРОК: по ${v.valid_until}. ${v.notarial||'Простая письменная форма'}. Город: ${v.city||'Набережные Челны'}.`,
  },

  /* 5. Расписка */
  {
    key: 'receipt', emoji: '💵', title: 'Расписка о получении денег', docType: 'receipt',
    sections: [
      { heading: 'Получатель денег', fields: [
        { key: 'r_fio', label: 'ФИО', type: 'text', placeholder: 'Иванов Иван Иванович', required: true },
        { key: 'r_dob', label: 'Дата рождения', type: 'date' },
        { key: 'r_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '1234 567890', required: true },
        { key: 'r_passport_by', label: 'Кем и когда выдан', type: 'text', placeholder: 'ОМВД г. Набережные Челны, 01.01.2015' },
        { key: 'r_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 1', required: true },
      ]},
      { heading: 'Плательщик', fields: [
        { key: 'p_fio', label: 'ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
        { key: 'p_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '4321 098765', required: true },
        { key: 'p_passport_by', label: 'Кем и когда выдан', type: 'text', placeholder: 'УМВД г. Казань, 15.06.2018' },
        { key: 'p_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5' },
      ]},
      { heading: 'Сумма и назначение', fields: [
        { key: 'amount', label: 'Сумма (₽)', type: 'text', placeholder: '150 000', required: true },
        { key: 'purpose', label: 'Назначение (за что)', type: 'text', placeholder: 'в счёт оплаты по договору купли-продажи автомобиля от 10.05.2026', required: true },
        { key: 'date', label: 'Дата получения', type: 'date', required: true },
        { key: 'city', label: 'Город', type: 'text', placeholder: 'Набережные Челны' },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ РАСПИСКУ О ПОЛУЧЕНИИ ДЕНЕЖНЫХ СРЕДСТВ от первого лица (получатель пишет сам), с полными реквизитами обеих сторон (не задавай вопросов).
ПОЛУЧАТЕЛЬ: ${v.r_fio}${v.r_dob?', '+v.r_dob:''}, паспорт ${v.r_passport}, выдан ${v.r_passport_by||'—'}, адрес: ${v.r_address}.
ПЛАТЕЛЬЩИК: ${v.p_fio}, паспорт ${v.p_passport}, выдан ${v.p_passport_by||'—'}${v.p_address?', адрес: '+v.p_address:''}.
СУММА: ${v.amount} ₽ (добавь сумму прописью); назначение: ${v.purpose}. Дата: ${v.date}. Город: ${v.city||'Набережные Челны'}.`,
  },

  /* 6. Претензия */
  {
    key: 'claim', emoji: '📋', title: 'Претензия', docType: 'claim',
    sections: [
      { heading: 'Кому направляется', fields: [
        { key: 'to_name', label: 'Наименование организации / ФИО', type: 'text', placeholder: 'ООО «Альфа», ген. директору Сидорову С.С.', required: true },
        { key: 'to_address', label: 'Юридический / почтовый адрес', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 1', required: true },
      ]},
      { heading: 'От кого (заявитель)', fields: [
        { key: 'from_fio', label: 'ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
        { key: 'from_address', label: 'Адрес', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 5, кв. 12', required: true },
        { key: 'from_phone', label: 'Телефон / e-mail', type: 'text', placeholder: '+7 900 000-00-00' },
      ]},
      { heading: 'Суть претензии', fields: [
        { key: 'contract_info', label: 'Договор / документ-основание', type: 'text', placeholder: 'Договор купли-продажи №123 от 01.04.2026' },
        { key: 'violation', label: 'В чём нарушение / что произошло', type: 'textarea', placeholder: 'Опишите подробно: что было куплено/заказано, когда, что пошло не так, какой ущерб вы понесли', required: true },
        { key: 'requirements', label: 'Ваши требования', type: 'textarea', placeholder: 'Прошу вернуть денежные средства в размере … ₽ / устранить недостатки / заменить товар…', required: true },
        { key: 'deadline', label: 'Срок ответа (дней)', type: 'text', placeholder: '10' },
        { key: 'date', label: 'Дата претензии', type: 'date' },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ ОФИЦИАЛЬНУЮ ПРЕТЕНЗИЮ со ссылками на Закон РФ «О защите прав потребителей» и ГК РФ (не задавай вопросов, оформи полностью).
КОМУ: ${v.to_name}, адрес: ${v.to_address}.
ОТ: ${v.from_fio}, адрес: ${v.from_address}${v.from_phone?', тел. '+v.from_phone:''}.
ОСНОВАНИЕ: ${v.contract_info||'не указан'}.
НАРУШЕНИЕ: ${v.violation}.
ТРЕБОВАНИЯ: ${v.requirements}.
СРОК ОТВЕТА: ${v.deadline||'10'} дней. Дата: ${v.date||new Date().toLocaleDateString('ru-RU')}.`,
  },

  /* 7. Исковое заявление */
  {
    key: 'lawsuit', emoji: '⚖️', title: 'Исковое заявление', docType: 'lawsuit',
    sections: [
      { heading: 'Суд', fields: [
        { key: 'court', label: 'Наименование суда', type: 'text', placeholder: 'Мировой судья судебного участка №1 Набережночелнинского судебного района', required: true },
        { key: 'court_address', label: 'Адрес суда', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 20' },
      ]},
      { heading: 'Истец', fields: [
        { key: 'p_fio', label: 'ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
        { key: 'p_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 5, кв. 12', required: true },
        { key: 'p_phone', label: 'Телефон', type: 'text', placeholder: '+7 900 000-00-00' },
      ]},
      { heading: 'Ответчик', fields: [
        { key: 'd_name', label: 'ФИО / Наименование организации', type: 'text', placeholder: 'ООО «Альфа» / Иванов И.И.', required: true },
        { key: 'd_address', label: 'Адрес', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 1', required: true },
        { key: 'd_phone', label: 'Телефон / ИНН (если известен)', type: 'text', placeholder: '+7 900 111-11-11 / ИНН 1650000000' },
      ]},
      { heading: 'Суть и требования', fields: [
        { key: 'claim_amount', label: 'Цена иска (₽, если имущественный)', type: 'text', placeholder: '150 000' },
        { key: 'circumstances', label: 'Фактические обстоятельства дела', type: 'textarea', placeholder: 'Опишите подробно: что случилось, когда, какие договоры и документы имеются, что нарушил ответчик', required: true },
        { key: 'requirements', label: 'Исковые требования', type: 'textarea', placeholder: 'Прошу суд взыскать с ответчика… / обязать ответчика…', required: true },
        { key: 'evidence', label: 'Прилагаемые документы', type: 'textarea', placeholder: 'Договор, чеки, переписка, претензия и ответ на неё…' },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ ИСКОВОЕ ЗАЯВЛЕНИЕ В СУД со ссылками на нормы права (ГК РФ, ГПК РФ) (не задавай вопросов, оформи полностью с шапкой, описательной частью, мотивировочной частью, просительной частью и перечнем приложений).
СУД: ${v.court}${v.court_address?', адрес: '+v.court_address:''}.
ИСТЕЦ: ${v.p_fio}, адрес: ${v.p_address}${v.p_phone?', тел. '+v.p_phone:''}.
ОТВЕТЧИК: ${v.d_name}, адрес: ${v.d_address}${v.d_phone?', '+v.d_phone:''}.
ЦЕНА ИСКА: ${v.claim_amount||'не определена'} ₽.
ОБСТОЯТЕЛЬСТВА: ${v.circumstances}.
ТРЕБОВАНИЯ: ${v.requirements}.
ПРИЛОЖЕНИЯ: ${v.evidence||'перечислить по тексту'}.`,
  },

  /* 8. Трудовой договор */
  {
    key: 'employment', emoji: '💼', title: 'Трудовой договор', docType: 'employment',
    sections: [
      { heading: 'Работодатель', fields: [
        { key: 'emp_name', label: 'Наименование организации / ФИО ИП', type: 'text', placeholder: 'ООО «Ромашка» / ИП Иванов И.И.', required: true },
        { key: 'emp_inn', label: 'ИНН', type: 'text', placeholder: '1650000000', required: true },
        { key: 'emp_ogrn', label: 'ОГРН / ОГРНИП', type: 'text', placeholder: '1021600000000' },
        { key: 'emp_address', label: 'Юридический адрес', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 1', required: true },
        { key: 'emp_director', label: 'Директор / ИП ФИО', type: 'text', placeholder: 'Иванов Иван Иванович', required: true },
      ]},
      { heading: 'Работник', fields: [
        { key: 'w_fio', label: 'ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
        { key: 'w_dob', label: 'Дата рождения', type: 'date' },
        { key: 'w_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '4321 098765', required: true },
        { key: 'w_passport_by', label: 'Кем и когда выдан', type: 'text', placeholder: 'УМВД г. Казань, 15.06.2018' },
        { key: 'w_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5', required: true },
        { key: 'w_snils', label: 'СНИЛС', type: 'text', placeholder: '123-456-789 00' },
      ]},
      { heading: 'Условия работы', fields: [
        { key: 'position', label: 'Должность', type: 'text', placeholder: 'Менеджер по продажам', required: true },
        { key: 'department', label: 'Отдел / подразделение', type: 'text', placeholder: 'Отдел продаж' },
        { key: 'start_date', label: 'Дата начала работы', type: 'date', required: true },
        { key: 'contract_type', label: 'Вид договора', type: 'select', options: ['Бессрочный (постоянная работа)', 'Срочный (указать срок ниже)'], required: true },
        { key: 'end_date', label: 'Дата окончания (если срочный)', type: 'date' },
        { key: 'salary', label: 'Оклад (₽/мес)', type: 'text', placeholder: '60 000', required: true },
        { key: 'schedule', label: 'Режим работы', type: 'select', options: ['5/2, 9:00–18:00', '2/2, сменный график', 'Свободный / дистанционный'], required: true },
        { key: 'probation', label: 'Испытательный срок', type: 'select', options: ['Не установлен', '1 месяц', '2 месяца', '3 месяца'] },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ ПОЛНЫЙ ТРУДОВОЙ ДОГОВОР по нормам ТК РФ со всеми обязательными условиями (место работы, трудовая функция, дата начала, режим рабочего времени, оплата труда, охрана труда, социальное страхование, реквизиты) (не задавай вопросов).
РАБОТОДАТЕЛЬ: ${v.emp_name}, ИНН ${v.emp_inn}${v.emp_ogrn?', ОГРН '+v.emp_ogrn:''}, адрес: ${v.emp_address}, директор: ${v.emp_director}.
РАБОТНИК: ${v.w_fio}${v.w_dob?', '+v.w_dob:''}, паспорт ${v.w_passport}${v.w_passport_by?' ('+v.w_passport_by+')':''}, адрес: ${v.w_address}${v.w_snils?', СНИЛС '+v.w_snils:''}.
УСЛОВИЯ: должность — ${v.position}${v.department?', отдел '+v.department:''}; с ${v.start_date}; ${v.contract_type}${v.end_date?' по '+v.end_date:''}; оклад ${v.salary} ₽/мес; режим ${v.schedule}; испытание — ${v.probation||'не установлен'}.`,
  },

  /* 9. Жалоба */
  {
    key: 'complaint', emoji: '📢', title: 'Жалоба', docType: 'complaint',
    sections: [
      { heading: 'Кому адресована', fields: [
        { key: 'to_name', label: 'Орган / должностное лицо', type: 'text', placeholder: 'Прокуратура г. Набережные Челны / Роспотребнадзор / ГИТ', required: true },
        { key: 'to_address', label: 'Адрес', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 20' },
      ]},
      { heading: 'Заявитель', fields: [
        { key: 'from_fio', label: 'ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
        { key: 'from_address', label: 'Адрес', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 5, кв. 12', required: true },
        { key: 'from_phone', label: 'Телефон / e-mail', type: 'text', placeholder: '+7 900 000-00-00 / email@mail.ru' },
      ]},
      { heading: 'Суть жалобы', fields: [
        { key: 'on_whom', label: 'На кого жалоба (организация / лицо)', type: 'text', placeholder: 'ООО «Альфа», директор Сидоров С.С.', required: true },
        { key: 'complaint_text', label: 'Подробное описание нарушения', type: 'textarea', placeholder: 'Опишите: что произошло, когда, какие законы/права нарушены, какие доказательства имеются', required: true },
        { key: 'requirements', label: 'Требования / что просите сделать', type: 'textarea', placeholder: 'Прошу провести проверку, привлечь к ответственности, обязать устранить нарушения…', required: true },
        { key: 'date', label: 'Дата жалобы', type: 'date' },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ ОФИЦИАЛЬНУЮ ЖАЛОБУ со ссылками на нормы права (не задавай вопросов, оформи полностью).
КОМУ: ${v.to_name}${v.to_address?', адрес: '+v.to_address:''}.
ОТ: ${v.from_fio}, адрес: ${v.from_address}${v.from_phone?', тел. '+v.from_phone:''}.
НА КОГО: ${v.on_whom}.
ОПИСАНИЕ: ${v.complaint_text}.
ТРЕБОВАНИЯ: ${v.requirements}.
Дата: ${v.date||new Date().toLocaleDateString('ru-RU')}.`,
  },

  /* 10. Заявление о расторжении брака */
  {
    key: 'divorce', emoji: '💔', title: 'Заявление о разводе', docType: 'divorce',
    sections: [
      { heading: 'Заявитель', fields: [
        { key: 'p_fio', label: 'ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
        { key: 'p_dob', label: 'Дата рождения', type: 'date', required: true },
        { key: 'p_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '1234 567890', required: true },
        { key: 'p_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 1, кв. 1', required: true },
        { key: 'p_phone', label: 'Телефон', type: 'text', placeholder: '+7 900 000-00-00' },
      ]},
      { heading: 'Супруг(а)', fields: [
        { key: 's_fio', label: 'ФИО', type: 'text', placeholder: 'Петрова Анна Ивановна', required: true },
        { key: 's_dob', label: 'Дата рождения', type: 'date' },
        { key: 's_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 1, кв. 1' },
      ]},
      { heading: 'Сведения о браке', fields: [
        { key: 'marriage_date', label: 'Дата заключения брака', type: 'date', required: true },
        { key: 'marriage_place', label: 'ЗАГС заключения брака', type: 'text', placeholder: 'Отдел ЗАГС г. Набережные Челны', required: true },
        { key: 'cert_number', label: 'Номер свидетельства о браке', type: 'text', placeholder: 'I-КБ №123456' },
        { key: 'children', label: 'Общие несовершеннолетние дети (ФИО и даты рождения)', type: 'textarea', placeholder: 'Петров Иван Петрович, 15.03.2018 — или «нет»', required: true },
        { key: 'reason', label: 'Основание для расторжения', type: 'select', options: ['Распад семьи, примирение невозможно', 'Взаимное согласие', 'Супруг безвестно отсутствует', 'Супруг осуждён на срок свыше 3 лет'] },
        { key: 'via', label: 'Куда подаётся', type: 'select', options: ['ЗАГС (нет детей и имущественных споров)', 'Мировой суд (дети есть, нет споров об имуществе)', 'Районный суд (спор об имуществе свыше 50 000 ₽)'], required: true },
        { key: 'court_name', label: 'Наименование суда / ЗАГС', type: 'text', placeholder: 'Мировой судья судебного участка №1 / Отдел ЗАГС г. Набережные Челны', required: true },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ ЗАЯВЛЕНИЕ О РАСТОРЖЕНИИ БРАКА по нормам СК РФ и ФЗ «Об актах гражданского состояния» (не задавай вопросов, оформи полностью с шапкой и всеми реквизитами).
КУДА: ${v.court_name} (${v.via||'суд'}).
ЗАЯВИТЕЛЬ: ${v.p_fio}, дата рождения ${v.p_dob}, паспорт ${v.p_passport}, адрес: ${v.p_address}${v.p_phone?', тел. '+v.p_phone:''}.
СУПРУГ(А): ${v.s_fio}${v.s_dob?', дата рождения '+v.s_dob:''}${v.s_address?', адрес: '+v.s_address:''}.
БРАК: зарегистрирован ${v.marriage_date} в ${v.marriage_place}${v.cert_number?', свидетельство '+v.cert_number:''}.
ДЕТИ: ${v.children}. ОСНОВАНИЕ: ${v.reason||'распад семьи'}.`,
  },

  /* 11. Соглашение об алиментах */
  {
    key: 'alimony', emoji: '👶', title: 'Соглашение об алиментах', docType: 'alimony',
    sections: [
      { heading: 'Плательщик алиментов', fields: [
        { key: 'payer_fio', label: 'ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
        { key: 'payer_dob', label: 'Дата рождения', type: 'date' },
        { key: 'payer_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '1234 567890', required: true },
        { key: 'payer_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 1', required: true },
        { key: 'payer_work', label: 'Место работы и должность', type: 'text', placeholder: 'ООО «Ромашка», менеджер' },
      ]},
      { heading: 'Получатель алиментов', fields: [
        { key: 'rcpt_fio', label: 'ФИО', type: 'text', placeholder: 'Петрова Анна Ивановна', required: true },
        { key: 'rcpt_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '4321 098765', required: true },
        { key: 'rcpt_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 5', required: true },
      ]},
      { heading: 'Ребёнок / дети', fields: [
        { key: 'children', label: 'ФИО ребёнка и дата рождения', type: 'textarea', placeholder: 'Петров Иван Петрович, 15.03.2018\nПетрова Мария Петровна, 22.07.2020', required: true },
      ]},
      { heading: 'Условия выплаты', fields: [
        { key: 'amount_type', label: 'Форма алиментов', type: 'select', options: ['Доля от дохода (1/4 на 1 ребёнка, 1/3 на 2, 1/2 на 3+)', 'Твёрдая денежная сумма'], required: true },
        { key: 'amount', label: 'Сумма или доля', type: 'text', placeholder: '1/4 дохода или 15 000 ₽/мес', required: true },
        { key: 'payment_day', label: 'До какого числа месяца платить', type: 'text', placeholder: '15' },
        { key: 'payment_method', label: 'Способ выплаты', type: 'select', options: ['Банковский перевод на карту', 'Наличными с распиской', 'Через бухгалтерию работодателя'] },
        { key: 'bank_details', label: 'Реквизиты карты / счёта получателя', type: 'text', placeholder: 'Сбербанк, карта 4276 …' },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ СОГЛАШЕНИЕ ОБ УПЛАТЕ АЛИМЕНТОВ по нормам СК РФ гл. 16 (требует нотариального удостоверения — укажи это) (не задавай вопросов, оформи полностью).
ПЛАТЕЛЬЩИК: ${v.payer_fio}${v.payer_dob?', '+v.payer_dob:''}, паспорт ${v.payer_passport}, адрес: ${v.payer_address}${v.payer_work?', работает: '+v.payer_work:''}.
ПОЛУЧАТЕЛЬ: ${v.rcpt_fio}, паспорт ${v.rcpt_passport}, адрес: ${v.rcpt_address}.
ДЕТИ: ${v.children}.
УСЛОВИЯ: ${v.amount_type}; сумма/доля: ${v.amount}; до ${v.payment_day||'15'}-го числа; способ: ${v.payment_method||'банковский перевод'}${v.bank_details?', '+v.bank_details:''}.`,
  },

  /* 12. Банкротство физлица */
  {
    key: 'bankruptcy', emoji: '🏦', title: 'Заявление о банкротстве', docType: 'bankruptcy',
    sections: [
      { heading: 'Должник', fields: [
        { key: 'd_fio', label: 'ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
        { key: 'd_dob', label: 'Дата рождения', type: 'date', required: true },
        { key: 'd_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '1234 567890', required: true },
        { key: 'd_passport_by', label: 'Кем и когда выдан', type: 'text', placeholder: 'ОМВД г. Набережные Челны, 01.01.2015' },
        { key: 'd_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 1, кв. 1', required: true },
        { key: 'd_inn', label: 'ИНН', type: 'text', placeholder: '165000000000' },
        { key: 'd_snils', label: 'СНИЛС', type: 'text', placeholder: '123-456-789 00' },
      ]},
      { heading: 'Задолженность', fields: [
        { key: 'total_debt', label: 'Общая сумма долга (₽)', type: 'text', placeholder: '750 000', required: true },
        { key: 'creditors', label: 'Кредиторы и суммы долгов', type: 'textarea', placeholder: 'Сбербанк — кредит 300 000 ₽\nАльфа-Банк — кредитная карта 150 000 ₽\nФНС — налоговая задолженность 50 000 ₽', required: true },
        { key: 'income', label: 'Текущий доход (₽/мес)', type: 'text', placeholder: '0 (безработный) или 25 000' },
        { key: 'property', label: 'Имущество в собственности', type: 'textarea', placeholder: 'Нет / квартира / автомобиль (описать)' },
      ]},
      { heading: 'Способ банкротства', fields: [
        { key: 'via', label: 'Процедура', type: 'select', options: ['Внесудебное через МФЦ (долг 25 000–1 000 000 ₽, нет имущества)', 'Судебное через арбитражный суд (долг от 500 000 ₽ или желание должника)'], required: true },
        { key: 'mfc_address', label: 'Адрес МФЦ (если внесудебное)', type: 'text', placeholder: 'МФЦ г. Набережные Челны, пр. Мира, д. 55' },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ ЗАЯВЛЕНИЕ О ПРИЗНАНИИ БАНКРОТОМ ФИЗИЧЕСКОГО ЛИЦА по нормам ФЗ «О несостоятельности (банкротстве)» №127-ФЗ (не задавай вопросов, оформи полностью с описью кредиторов и приложений).
ДОЛЖНИК: ${v.d_fio}, дата рождения ${v.d_dob}, паспорт ${v.d_passport}${v.d_passport_by?' ('+v.d_passport_by+')':''}, адрес: ${v.d_address}${v.d_inn?', ИНН '+v.d_inn:''}${v.d_snils?', СНИЛС '+v.d_snils:''}.
ДОЛГ: ${v.total_debt} ₽. Кредиторы: ${v.creditors}. Доход: ${v.income||'не указан'}. Имущество: ${v.property||'нет'}.
ПРОЦЕДУРА: ${v.via}${v.mfc_address?'. МФЦ: '+v.mfc_address:''}.`,
  },

  /* 13. Договор займа */
  {
    key: 'loan', emoji: '💳', title: 'Договор займа', docType: 'loan',
    sections: [
      { heading: 'Займодавец (даёт деньги)', fields: [
        { key: 'l_fio', label: 'ФИО', type: 'text', placeholder: 'Иванов Иван Иванович', required: true },
        { key: 'l_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '1234 567890', required: true },
        { key: 'l_passport_by', label: 'Кем и когда выдан', type: 'text', placeholder: 'ОМВД г. Набережные Челны, 01.01.2015' },
        { key: 'l_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 1', required: true },
        { key: 'l_phone', label: 'Телефон', type: 'text', placeholder: '+7 900 000-00-00' },
      ]},
      { heading: 'Заёмщик (берёт деньги)', fields: [
        { key: 'b_fio', label: 'ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
        { key: 'b_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '4321 098765', required: true },
        { key: 'b_passport_by', label: 'Кем и когда выдан', type: 'text', placeholder: 'УМВД г. Казань, 15.06.2018' },
        { key: 'b_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5', required: true },
        { key: 'b_phone', label: 'Телефон', type: 'text', placeholder: '+7 911 111-11-11' },
      ]},
      { heading: 'Условия займа', fields: [
        { key: 'amount', label: 'Сумма займа (₽)', type: 'text', placeholder: '100 000', required: true },
        { key: 'interest', label: 'Процентная ставка', type: 'select', options: ['Беспроцентный заём', '5% годовых', '10% годовых', '15% годовых', 'Указать вручную'], required: true },
        { key: 'interest_custom', label: 'Ставка вручную (если «Указать»)', type: 'text', placeholder: 'напр. 12% годовых' },
        { key: 'return_date', label: 'Срок возврата', type: 'date', required: true },
        { key: 'purpose', label: 'Цель займа (необязательно)', type: 'text', placeholder: 'на личные нужды' },
        { key: 'collateral', label: 'Обеспечение (залог / поручительство)', type: 'text', placeholder: 'нет / залог автомобиля / поручитель Сидоров С.С.' },
        { key: 'city', label: 'Город составления', type: 'text', placeholder: 'Набережные Челны' },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ ПОЛНЫЙ ДОГОВОР ЗАЙМА по нормам ГК РФ ст. 807-818 со всеми разделами (не задавай вопросов, оформи полностью).
ЗАЙМОДАВЕЦ: ${v.l_fio}, паспорт ${v.l_passport}${v.l_passport_by?' ('+v.l_passport_by+')':''}, адрес: ${v.l_address}${v.l_phone?', тел. '+v.l_phone:''}.
ЗАЁМЩИК: ${v.b_fio}, паспорт ${v.b_passport}${v.b_passport_by?' ('+v.b_passport_by+')':''}, адрес: ${v.b_address}${v.b_phone?', тел. '+v.b_phone:''}.
СУММА: ${v.amount} ₽; процентная ставка: ${v.interest_custom||v.interest}; срок возврата: ${v.return_date}${v.purpose?'; цель: '+v.purpose:''}${v.collateral?'; обеспечение: '+v.collateral:''}. Город: ${v.city||'Набережные Челны'}.`,
  },

  /* 14. Договор дарения */
  {
    key: 'gift', emoji: '🎁', title: 'Договор дарения', docType: 'gift',
    sections: [
      { heading: 'Даритель', fields: [
        { key: 'd_fio', label: 'ФИО', type: 'text', placeholder: 'Иванов Иван Иванович', required: true },
        { key: 'd_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '1234 567890', required: true },
        { key: 'd_passport_by', label: 'Кем и когда выдан', type: 'text', placeholder: 'ОМВД г. Набережные Челны, 01.01.2015' },
        { key: 'd_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 1', required: true },
      ]},
      { heading: 'Одаряемый', fields: [
        { key: 'r_fio', label: 'ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
        { key: 'r_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '4321 098765', required: true },
        { key: 'r_passport_by', label: 'Кем и когда выдан', type: 'text', placeholder: 'УМВД г. Казань, 15.06.2018' },
        { key: 'r_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5', required: true },
      ]},
      { heading: 'Предмет дарения', fields: [
        { key: 'gift_type', label: 'Что дарится', type: 'select', options: ['Квартира / доля в квартире', 'Автомобиль', 'Земельный участок', 'Денежные средства', 'Иное имущество'], required: true },
        { key: 'gift_desc', label: 'Описание предмета дарения', type: 'textarea', placeholder: 'Квартира по адресу: г. Набережные Челны, пр. Мира, д. 15, кв. 42, площадь 45 кв.м, кадастровый номер …', required: true },
        { key: 'gift_value', label: 'Кадастровая / рыночная стоимость (₽)', type: 'text', placeholder: '3 500 000' },
        { key: 'city', label: 'Город составления', type: 'text', placeholder: 'Набережные Челны' },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ ПОЛНЫЙ ДОГОВОР ДАРЕНИЯ по нормам ГК РФ гл. 32 (не задавай вопросов, оформи полностью со всеми разделами, укажи необходимость регистрации в Росреестре если даётся недвижимость).
ДАРИТЕЛЬ: ${v.d_fio}, паспорт ${v.d_passport}${v.d_passport_by?' ('+v.d_passport_by+')':''}, адрес: ${v.d_address}.
ОДАРЯЕМЫЙ: ${v.r_fio}, паспорт ${v.r_passport}${v.r_passport_by?' ('+v.r_passport_by+')':''}, адрес: ${v.r_address}.
ПРЕДМЕТ: ${v.gift_type} — ${v.gift_desc}${v.gift_value?', стоимость '+v.gift_value+' ₽':''}. Город: ${v.city||'Набережные Челны'}.`,
  },

  /* 15. Договор оказания услуг */
  {
    key: 'service_agreement', emoji: '🤝', title: 'Договор оказания услуг', docType: 'service_agreement',
    sections: [
      { heading: 'Заказчик', fields: [
        { key: 'c_name', label: 'ФИО или наименование организации', type: 'text', placeholder: 'Иванов И.И. / ООО «Ромашка»', required: true },
        { key: 'c_passport_inn', label: 'Паспорт (физлицо) / ИНН (юрлицо)', type: 'text', placeholder: '1234 567890 / ИНН 1650000000', required: true },
        { key: 'c_address', label: 'Адрес', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 1', required: true },
        { key: 'c_phone', label: 'Телефон / e-mail', type: 'text', placeholder: '+7 900 000-00-00' },
      ]},
      { heading: 'Исполнитель', fields: [
        { key: 'e_name', label: 'ФИО или наименование организации', type: 'text', placeholder: 'Петров П.П. / ИП Петров П.П.', required: true },
        { key: 'e_passport_inn', label: 'Паспорт (физлицо) / ИНН (ИП)', type: 'text', placeholder: '4321 098765 / ИНН 1650111111', required: true },
        { key: 'e_address', label: 'Адрес', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5', required: true },
        { key: 'e_phone', label: 'Телефон / e-mail', type: 'text', placeholder: '+7 911 111-11-11' },
      ]},
      { heading: 'Услуга и оплата', fields: [
        { key: 'service_desc', label: 'Описание услуги', type: 'textarea', placeholder: 'Бухгалтерское обслуживание / юридическая консультация / ремонт помещений / разработка сайта…', required: true },
        { key: 'start_date', label: 'Дата начала оказания услуг', type: 'date', required: true },
        { key: 'end_date', label: 'Дата окончания / срок', type: 'text', placeholder: '30.06.2026 / 30 календарных дней', required: true },
        { key: 'price', label: 'Стоимость (₽)', type: 'text', placeholder: '50 000', required: true },
        { key: 'payment_order', label: 'Порядок оплаты', type: 'select', options: ['100% предоплата', '50% аванс, 50% по завершении', '100% по завершении', 'Ежемесячно по акту'], required: true },
        { key: 'city', label: 'Город составления', type: 'text', placeholder: 'Набережные Челны' },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ ПОЛНЫЙ ДОГОВОР ВОЗМЕЗДНОГО ОКАЗАНИЯ УСЛУГ по нормам ГК РФ гл. 39 (не задавай вопросов, оформи полностью со всеми разделами: предмет, обязанности сторон, порядок сдачи-приёмки, оплата, ответственность, конфиденциальность, реквизиты).
ЗАКАЗЧИК: ${v.c_name}, ${v.c_passport_inn}, адрес: ${v.c_address}${v.c_phone?', тел. '+v.c_phone:''}.
ИСПОЛНИТЕЛЬ: ${v.e_name}, ${v.e_passport_inn}, адрес: ${v.e_address}${v.e_phone?', тел. '+v.e_phone:''}.
УСЛУГА: ${v.service_desc}; срок с ${v.start_date} по/до ${v.end_date}; стоимость ${v.price} ₽; оплата: ${v.payment_order}. Город: ${v.city||'Набережные Челны'}.`,
  },

  /* 16. Договор подряда */
  {
    key: 'work_contract', emoji: '🔧', title: 'Договор подряда', docType: 'work_contract',
    sections: [
      { heading: 'Заказчик', fields: [
        { key: 'c_name', label: 'ФИО или наименование', type: 'text', placeholder: 'Иванов И.И. / ООО «Ромашка»', required: true },
        { key: 'c_inn', label: 'Паспорт / ИНН', type: 'text', placeholder: '1234 567890 / ИНН 1650000000', required: true },
        { key: 'c_address', label: 'Адрес', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 1', required: true },
        { key: 'c_phone', label: 'Телефон', type: 'text', placeholder: '+7 900 000-00-00' },
      ]},
      { heading: 'Подрядчик', fields: [
        { key: 'e_name', label: 'ФИО / ИП / ООО', type: 'text', placeholder: 'ИП Петров П.П. / ООО «Строй»', required: true },
        { key: 'e_inn', label: 'Паспорт / ИНН', type: 'text', placeholder: '4321 098765 / ИНН 1650111111', required: true },
        { key: 'e_address', label: 'Адрес', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5', required: true },
        { key: 'e_phone', label: 'Телефон', type: 'text', placeholder: '+7 911 111-11-11' },
      ]},
      { heading: 'Работы и оплата', fields: [
        { key: 'work_desc', label: 'Описание работ', type: 'textarea', placeholder: 'Ремонт двух комнат (поклейка обоев, покраска потолков, укладка ламината) в квартире по адресу …', required: true },
        { key: 'start_date', label: 'Дата начала работ', type: 'date', required: true },
        { key: 'end_date', label: 'Срок сдачи результата', type: 'date', required: true },
        { key: 'price', label: 'Стоимость работ (₽)', type: 'text', placeholder: '120 000', required: true },
        { key: 'materials', label: 'Кто обеспечивает материалы', type: 'select', options: ['Заказчик обеспечивает все материалы', 'Подрядчик обеспечивает все материалы', 'Материалы заказчика, расходники подрядчика'], required: true },
        { key: 'payment_order', label: 'Порядок оплаты', type: 'select', options: ['100% предоплата', '30% аванс, 70% по завершении', '50% аванс, 50% по завершении', '100% по завершении'] },
        { key: 'city', label: 'Город составления', type: 'text', placeholder: 'Набережные Челны' },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ ПОЛНЫЙ ДОГОВОР ПОДРЯДА по нормам ГК РФ гл. 37 (не задавай вопросов, оформи полностью со всеми разделами: предмет, сроки, материалы, приёмка, цена, ответственность за качество, гарантийный срок, реквизиты).
ЗАКАЗЧИК: ${v.c_name}, ${v.c_inn}, адрес: ${v.c_address}${v.c_phone?', тел. '+v.c_phone:''}.
ПОДРЯДЧИК: ${v.e_name}, ${v.e_inn}, адрес: ${v.e_address}${v.e_phone?', тел. '+v.e_phone:''}.
РАБОТЫ: ${v.work_desc}; с ${v.start_date} по ${v.end_date}; стоимость ${v.price} ₽; материалы: ${v.materials}; оплата: ${v.payment_order||'по завершении'}. Город: ${v.city||'Набережные Челны'}.`,
  },

  /* 17. Соглашение о задатке */
  {
    key: 'deposit_agreement', emoji: '🔑', title: 'Соглашение о задатке', docType: 'deposit_agreement',
    sections: [
      { heading: 'Продавец / Арендодатель', fields: [
        { key: 's_fio', label: 'ФИО', type: 'text', placeholder: 'Иванов Иван Иванович', required: true },
        { key: 's_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '1234 567890', required: true },
        { key: 's_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 1', required: true },
        { key: 's_phone', label: 'Телефон', type: 'text', placeholder: '+7 900 000-00-00' },
      ]},
      { heading: 'Покупатель / Арендатор', fields: [
        { key: 'b_fio', label: 'ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
        { key: 'b_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '4321 098765', required: true },
        { key: 'b_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5', required: true },
        { key: 'b_phone', label: 'Телефон', type: 'text', placeholder: '+7 911 111-11-11' },
      ]},
      { heading: 'Объект и задаток', fields: [
        { key: 'object_desc', label: 'Описание объекта сделки', type: 'textarea', placeholder: 'Квартира по адресу: г. Набережные Челны, пр. Мира, д. 15, кв. 42, площадь 56 кв.м', required: true },
        { key: 'total_price', label: 'Общая стоимость сделки (₽)', type: 'text', placeholder: '5 000 000', required: true },
        { key: 'deposit_amount', label: 'Размер задатка (₽)', type: 'text', placeholder: '100 000', required: true },
        { key: 'main_deal_date', label: 'Срок заключения основного договора', type: 'date', required: true },
        { key: 'city', label: 'Город составления', type: 'text', placeholder: 'Набережные Челны' },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ СОГЛАШЕНИЕ О ЗАДАТКЕ по нормам ГК РФ ст. 380-381 (с последствиями нарушения: продавец возвращает двойной задаток, покупатель теряет задаток) (не задавай вопросов, оформи полностью).
ПРОДАВЕЦ: ${v.s_fio}, паспорт ${v.s_passport}, адрес: ${v.s_address}${v.s_phone?', тел. '+v.s_phone:''}.
ПОКУПАТЕЛЬ: ${v.b_fio}, паспорт ${v.b_passport}, адрес: ${v.b_address}${v.b_phone?', тел. '+v.b_phone:''}.
ОБЪЕКТ: ${v.object_desc}; общая стоимость ${v.total_price} ₽; задаток ${v.deposit_amount} ₽; основной договор до ${v.main_deal_date}. Город: ${v.city||'Набережные Челны'}.`,
  },

  /* 18. Заявление об увольнении */
  {
    key: 'resignation', emoji: '📤', title: 'Заявление об увольнении', docType: 'resignation',
    sections: [
      { heading: 'Работодатель', fields: [
        { key: 'emp_name', label: 'Наименование организации / ФИО ИП', type: 'text', placeholder: 'ООО «Ромашка»', required: true },
        { key: 'emp_director', label: 'Директор (ФИО)', type: 'text', placeholder: 'Директору Иванову Ивану Ивановичу', required: true },
      ]},
      { heading: 'Работник', fields: [
        { key: 'w_fio', label: 'ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
        { key: 'w_position', label: 'Должность', type: 'text', placeholder: 'Менеджер по продажам', required: true },
        { key: 'w_department', label: 'Отдел', type: 'text', placeholder: 'Отдел продаж' },
      ]},
      { heading: 'Условия увольнения', fields: [
        { key: 'reason', label: 'Основание увольнения', type: 'select', options: ['По собственному желанию (ст. 80 ТК РФ)', 'По соглашению сторон (ст. 78 ТК РФ)', 'В связи с выходом на пенсию (без отработки)', 'В связи с зачислением в учебное заведение (без отработки)'], required: true },
        { key: 'last_day', label: 'Просимая дата последнего рабочего дня', type: 'date', required: true },
        { key: 'without_work', label: 'Отработка', type: 'select', options: ['14-дневная отработка (стандарт)', 'Без отработки (причина указана в заявлении)'] },
        { key: 'date', label: 'Дата подачи заявления', type: 'date', required: true },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ ЗАЯВЛЕНИЕ ОБ УВОЛЬНЕНИИ по нормам ТК РФ (не задавай вопросов, оформи полностью в стандартной форме).
РАБОТОДАТЕЛЬ: ${v.emp_name}, директор ${v.emp_director}.
РАБОТНИК: ${v.w_fio}, ${v.w_position}${v.w_department?', '+v.w_department:''}.
ОСНОВАНИЕ: ${v.reason}; просит уволить с ${v.last_day}; ${v.without_work||'14-дневная отработка'}. Дата заявления: ${v.date}.`,
  },

  /* 19. Договор с самозанятым */
  {
    key: 'freelance', emoji: '🧑‍💻', title: 'Договор с самозанятым', docType: 'freelance',
    sections: [
      { heading: 'Заказчик', fields: [
        { key: 'c_name', label: 'Наименование организации / ФИО ИП', type: 'text', placeholder: 'ООО «Ромашка» / ИП Иванов И.И.', required: true },
        { key: 'c_inn', label: 'ИНН', type: 'text', placeholder: '1650000000', required: true },
        { key: 'c_address', label: 'Юридический адрес', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 1', required: true },
        { key: 'c_director', label: 'Директор / ИП ФИО', type: 'text', placeholder: 'Иванов Иван Иванович', required: true },
        { key: 'c_phone', label: 'Телефон / e-mail', type: 'text', placeholder: '+7 900 000-00-00' },
      ]},
      { heading: 'Исполнитель (самозанятый)', fields: [
        { key: 'f_fio', label: 'ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
        { key: 'f_inn', label: 'ИНН самозанятого', type: 'text', placeholder: '165011111111', required: true },
        { key: 'f_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5', required: true },
        { key: 'f_phone', label: 'Телефон / e-mail', type: 'text', placeholder: '+7 911 111-11-11' },
        { key: 'f_bank', label: 'Реквизиты для оплаты (карта / счёт)', type: 'text', placeholder: 'Сбербанк, карта 4276 … / р/с 40802810…' },
      ]},
      { heading: 'Услуга и оплата', fields: [
        { key: 'service_desc', label: 'Описание оказываемых услуг / работ', type: 'textarea', placeholder: 'Разработка логотипа и фирменного стиля / написание текстов / настройка рекламы…', required: true },
        { key: 'deadline', label: 'Срок выполнения', type: 'text', placeholder: '30.06.2026 / 15 рабочих дней', required: true },
        { key: 'price', label: 'Стоимость (₽)', type: 'text', placeholder: '30 000', required: true },
        { key: 'payment_order', label: 'Порядок оплаты', type: 'select', options: ['100% предоплата', '50% аванс, 50% по факту', '100% после приёмки результата'], required: true },
        { key: 'city', label: 'Город составления', type: 'text', placeholder: 'Набережные Челны' },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ ДОГОВОР ГРАЖДАНСКО-ПРАВОВОГО ХАРАКТЕРА (ГПХ) С САМОЗАНЯТЫМ по нормам ГК РФ с обязательным пунктом о статусе самозанятого (НПД), обязанности предоставить чек из приложения «Мой налог», и о том что заказчик не является налоговым агентом (не задавай вопросов, оформи полностью).
ЗАКАЗЧИК: ${v.c_name}, ИНН ${v.c_inn}, адрес: ${v.c_address}, директор/ИП: ${v.c_director}${v.c_phone?', тел. '+v.c_phone:''}.
ИСПОЛНИТЕЛЬ (самозанятый): ${v.f_fio}, ИНН ${v.f_inn}, адрес: ${v.f_address}${v.f_phone?', тел. '+v.f_phone:''}${v.f_bank?', реквизиты: '+v.f_bank:''}.
УСЛУГА: ${v.service_desc}; срок: ${v.deadline}; стоимость ${v.price} ₽; оплата: ${v.payment_order}. Город: ${v.city||'Набережные Челны'}.`,
  },

  /* 20. Роспатент — Согласие автора на указание сведений */
  {
    key: 'rospatent_author_consent', emoji: '📋', title: 'Роспатент: Согласие автора', docType: 'rospatent_author_consent',
    sections: [
      { heading: 'Сведения о заявке', fields: [
        { key: 'app_num', label: 'Номер заявки (если есть)', type: 'text', placeholder: '2026613456' },
        { key: 'rid_type', label: 'Вид результата интеллектуальной деятельности', type: 'select',
          options: ['Программа для ЭВМ', 'База данных (п. 4 ст. 1259 ГК РФ)', 'База данных (п. 3 ст. 1334 ГК РФ)'], required: true },
        { key: 'rid_name', label: 'Название программы для ЭВМ / базы данных', type: 'text', placeholder: 'Система управления задачами «SWAIP Task»', required: true },
      ]},
      { heading: 'Правообладатель (Заявитель)', fields: [
        { key: 'owner_name', label: 'ФИО физ. лица или наименование юр. лица', type: 'text', placeholder: 'ООО «СВАЙП» / Иванов Иван Иванович', required: true },
        { key: 'owner_address', label: 'Место жительства / место нахождения', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 1', required: true },
        { key: 'owner_ogrn', label: 'ОГРН (для юр. лица)', type: 'text', placeholder: '1021600000000' },
        { key: 'owner_inn', label: 'ИНН', type: 'text', placeholder: '1650000000' },
      ]},
      { heading: 'Сведения об авторе (раздел 7А)', fields: [
        { key: 'author_fio', label: 'Фамилия Имя Отчество автора', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
        { key: 'birth_day', label: 'Дата рождения: число', type: 'text', placeholder: '15', required: true },
        { key: 'birth_month', label: 'Месяц рождения', type: 'text', placeholder: 'июня', required: true },
        { key: 'birth_year', label: 'Год рождения', type: 'text', placeholder: '1990', required: true },
        { key: 'citizenship', label: 'Гражданство', type: 'text', placeholder: 'Российская Федерация', required: true },
        { key: 'author_address', label: 'Место постоянного жительства (включая страну)', type: 'textarea', placeholder: 'г. Набережные Челны, ул. Ленина, д. 5, кв. 10, Российская Федерация', required: true },
        { key: 'contribution', label: 'Краткое описание творческого вклада автора', type: 'textarea', placeholder: 'Разработка алгоритмов обработки данных, проектирование архитектуры программы, написание программного кода', required: true },
        { key: 'mention', label: 'При публикации автор просит', type: 'select',
          options: ['упоминать его под своим именем', 'не упоминать его (анонимно)', 'упоминать его под псевдонимом'], required: true },
        { key: 'pseudonym', label: 'Псевдоним (если выбрано «под псевдонимом»)', type: 'text', placeholder: 'P. Petrov' },
        { key: 'sign_date', label: 'Дата подписания', type: 'date', required: true },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ ОФИЦИАЛЬНОЕ «СОГЛАСИЕ АВТОРА НА УКАЗАНИЕ СВЕДЕНИЙ ОБ АВТОРЕ» по официальной форме Федеральной службы по интеллектуальной собственности (Роспатент) в точном соответствии с требованиями. Оформи как официальный документ со всеми реквизитами шапки, всеми полями формы, строками для подписей. Не добавляй ничего лишнего — только официальный текст формы с заполненными данными.

ДАННЫЕ ДЛЯ ЗАПОЛНЕНИЯ:
Заявка №: ${v.app_num || 'не присвоен'}
Вид РИД: ${v.rid_type}
Название: ${v.rid_name}
Правообладатель (Заявитель): ${v.owner_name}, адрес: ${v.owner_address}${v.owner_ogrn ? ', ОГРН: ' + v.owner_ogrn : ''}${v.owner_inn ? ', ИНН: ' + v.owner_inn : ''}
Автор (раздел 7А): ${v.author_fio}
Дата рождения: ${v.birth_day} ${v.birth_month} ${v.birth_year} г.
Гражданство: ${v.citizenship}
Место постоянного жительства: ${v.author_address}
Творческий вклад: ${v.contribution}
При публикации: ${v.mention}${v.pseudonym ? ', псевдоним: ' + v.pseudonym : ''}
Дата: ${v.sign_date}

Документ адресован: В Федеральную службу по интеллектуальной собственности, Бережковская наб., д. 30, корп. 1, г. Москва, Г-59, ГСП-3, 125993.`,
  },

  /* 21. Роспатент — Согласие на обработку персональных данных */
  {
    key: 'rospatent_pd_consent', emoji: '🔏', title: 'Роспатент: Согласие на обработку ПД', docType: 'rospatent_pd_consent',
    sections: [
      { heading: 'Сведения о программе / базе данных', fields: [
        { key: 'rid_name', label: 'Название программы для ЭВМ или базы данных', type: 'text', placeholder: 'Система управления задачами «SWAIP Task»', required: true },
        { key: 'app_num', label: 'Номер заявки (если есть)', type: 'text', placeholder: '2026613456' },
      ]},
      { heading: 'Субъект персональных данных', fields: [
        { key: 'subject_fio', label: 'Фамилия, имя, отчество', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
        { key: 'subject_address', label: 'Адрес места жительства', type: 'textarea', placeholder: 'г. Набережные Челны, ул. Ленина, д. 5, кв. 10', required: true },
        { key: 'doc_type', label: 'Вид документа, удостоверяющего личность', type: 'select',
          options: ['Паспорт гражданина РФ', 'Заграничный паспорт', 'СНИЛС', 'Водительское удостоверение'], required: true },
        { key: 'doc_series', label: 'Серия и номер документа', type: 'text', placeholder: '1234 567890', required: true },
        { key: 'doc_date', label: 'Дата выдачи документа', type: 'date', required: true },
        { key: 'doc_issued_by', label: 'Кем выдан', type: 'text', placeholder: 'ОМВД России по г. Набережные Челны', required: true },
        { key: 'sign_date', label: 'Дата подписания', type: 'date', required: true },
      ]},
    ],
    buildPrompt: v => `СОСТАВЬ ОФИЦИАЛЬНОЕ «СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ» по официальной форме Федеральной службы по интеллектуальной собственности (Роспатент), в соответствии с Федеральным законом от 27 июля 2006 г. № 152-ФЗ «О персональных данных» и Федеральным законом от 27 июля 2010 г. № 210-ФЗ. Воспроизведи официальный текст формы полностью — включая ссылки на законы, строки для подписи и расшифровки. Не добавляй ничего лишнего.

ДАННЫЕ ДЛЯ ЗАПОЛНЕНИЯ:
Название программы для ЭВМ или базы данных: ${v.rid_name}
№ заявки: ${v.app_num || 'не присвоен'}
Ф. И. О. субъекта персональных данных: ${v.subject_fio}
Адрес места жительства: ${v.subject_address}
Документ, удостоверяющий личность: ${v.doc_type}, серия и номер ${v.doc_series}, дата выдачи ${v.doc_date}, выдан: ${v.doc_issued_by}
Дата подписания: ${v.sign_date}

Документ адресован: В Федеральную службу по интеллектуальной собственности, Бережковская наб., д. 30, корп. 1, г. Москва, Г-59, ГСП-3, 125993.`,
  },
];

/* ── Form configs for other specialists ── */
const SPECIALIST_DOC_FORMS: Record<string, IgorDocFormConfig[]> = {

  /* ── МАРИНА (HR) ── */
  marina: [
    {
      key: 'marina_resume', emoji: '📄', title: 'Резюме', docType: 'marina_doc',
      sections: [
        { heading: 'Личные данные', fields: [
          { key: 'fio', label: 'ФИО', type: 'text', placeholder: 'Петрова Анна Ивановна', required: true },
          { key: 'dob', label: 'Дата рождения', type: 'date' },
          { key: 'city', label: 'Город проживания', type: 'text', placeholder: 'Набережные Челны', required: true },
          { key: 'phone', label: 'Телефон', type: 'text', placeholder: '+7 900 000-00-00', required: true },
          { key: 'email', label: 'E-mail', type: 'text', placeholder: 'anna@mail.ru' },
          { key: 'telegram', label: 'Telegram / ВКонтакте', type: 'text', placeholder: '@anna_petrova' },
        ]},
        { heading: 'Цель и должность', fields: [
          { key: 'target_position', label: 'Желаемая должность', type: 'text', placeholder: 'Менеджер по продажам / Бухгалтер / Программист', required: true },
          { key: 'salary', label: 'Желаемая зарплата (₽)', type: 'text', placeholder: '80 000' },
          { key: 'work_format', label: 'Формат работы', type: 'select', options: ['Полная занятость, офис', 'Полная занятость, удалённо', 'Гибридный формат', 'Частичная занятость'] },
        ]},
        { heading: 'Образование', fields: [
          { key: 'education', label: 'Учебное заведение, специальность, год окончания', type: 'textarea', placeholder: 'КНИТУ-КАИ, «Информационные системы», 2018\nКурс «Управление проектами» Нетология, 2021', required: true },
        ]},
        { heading: 'Опыт работы', fields: [
          { key: 'experience', label: 'Места работы (название, должность, период, обязанности)', type: 'textarea', placeholder: 'ООО «Альфа», менеджер по продажам, 2020–2024:\n— увеличил выручку на 35%\n— вёл базу 200+ клиентов\n\nООО «Бета», стажёр, 2018–2019', required: true },
        ]},
        { heading: 'Навыки и прочее', fields: [
          { key: 'skills', label: 'Профессиональные навыки', type: 'textarea', placeholder: '1С: Предприятие, Excel, CRM (Битрикс24), холодные продажи, деловые переговоры', required: true },
          { key: 'languages', label: 'Иностранные языки', type: 'text', placeholder: 'Английский — B2, Татарский — родной' },
          { key: 'about', label: 'О себе (личные качества)', type: 'textarea', placeholder: 'Ответственный, целеустремлённый, быстро обучаюсь…' },
          { key: 'achievements', label: 'Достижения / награды', type: 'textarea', placeholder: 'Лучший сотрудник квартала Q3 2023, победитель конкурса…' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ПРОФЕССИОНАЛЬНОЕ РЕЗЮМЕ в стандартном российском формате, красиво структурированное по разделам (не задавай вопросов, напиши готовое резюме полностью).
ФИО: ${v.fio}${v.dob?', дата рождения: '+v.dob:''}
Город: ${v.city} | Телефон: ${v.phone}${v.email?' | Email: '+v.email:''}${v.telegram?' | '+v.telegram:''}
ЦЕЛЬ: ${v.target_position}${v.salary?', зарплата от '+v.salary+' ₽':''}${v.work_format?', '+v.work_format:''}
ОБРАЗОВАНИЕ: ${v.education}
ОПЫТ РАБОТЫ: ${v.experience}
НАВЫКИ: ${v.skills}${v.languages?'\nЯЗЫКИ: '+v.languages:''}${v.about?'\nО СЕБЕ: '+v.about:''}${v.achievements?'\nДОСТИЖЕНИЯ: '+v.achievements:''}`,
    },
    {
      key: 'marina_cover', emoji: '✉️', title: 'Сопроводительное письмо', docType: 'marina_doc',
      sections: [
        { heading: 'Отправитель', fields: [
          { key: 'fio', label: 'Ваше ФИО', type: 'text', placeholder: 'Петрова Анна Ивановна', required: true },
          { key: 'phone', label: 'Телефон', type: 'text', placeholder: '+7 900 000-00-00', required: true },
          { key: 'email', label: 'E-mail', type: 'text', placeholder: 'anna@mail.ru' },
        ]},
        { heading: 'Куда и на какую должность', fields: [
          { key: 'company', label: 'Компания', type: 'text', placeholder: 'ООО «Альфа»', required: true },
          { key: 'position', label: 'Должность', type: 'text', placeholder: 'Менеджер по продажам', required: true },
          { key: 'recruiter', label: 'Имя рекрутера (если известно)', type: 'text', placeholder: 'Ирина' },
          { key: 'source', label: 'Где нашли вакансию', type: 'text', placeholder: 'hh.ru / Telegram / рекомендация' },
        ]},
        { heading: 'Содержание письма', fields: [
          { key: 'why_company', label: 'Почему хотите работать именно в этой компании', type: 'textarea', placeholder: 'Интересует ваша продукция / репутация / масштаб задач…', required: true },
          { key: 'key_experience', label: 'Ключевой опыт / достижения', type: 'textarea', placeholder: '5 лет в продажах, увеличил выручку на 35%, опыт с CRM…', required: true },
          { key: 'extra', label: 'Дополнительно (что хотите добавить)', type: 'textarea', placeholder: 'Готов к командировкам / переработкам / быстрому старту…' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ПРОФЕССИОНАЛЬНОЕ СОПРОВОДИТЕЛЬНОЕ ПИСЬМО к резюме (не задавай вопросов, напиши готовое письмо, живым профессиональным языком, не более 200 слов).
ОТПРАВИТЕЛЬ: ${v.fio}, тел. ${v.phone}${v.email?', '+v.email:''}
КОМПАНИЯ: ${v.company} | ДОЛЖНОСТЬ: ${v.position}${v.recruiter?'\nРекрутер: '+v.recruiter:''}${v.source?'\nИсточник вакансии: '+v.source:''}
ПОЧЕМУ ЭТА КОМПАНИЯ: ${v.why_company}
КЛЮЧЕВОЙ ОПЫТ: ${v.key_experience}${v.extra?'\nДОПОЛНИТЕЛЬНО: '+v.extra:''}`,
    },
    {
      key: 'marina_job', emoji: '📢', title: 'Описание вакансии', docType: 'marina_doc',
      sections: [
        { heading: 'Компания и должность', fields: [
          { key: 'company', label: 'Название компании', type: 'text', placeholder: 'ООО «Ромашка»', required: true },
          { key: 'position', label: 'Должность', type: 'text', placeholder: 'Менеджер по продажам', required: true },
          { key: 'department', label: 'Отдел', type: 'text', placeholder: 'Отдел продаж' },
          { key: 'city', label: 'Город / удалённо', type: 'text', placeholder: 'Набережные Челны', required: true },
          { key: 'salary', label: 'Зарплата (вилка)', type: 'text', placeholder: 'от 60 000 до 100 000 ₽' },
          { key: 'work_format', label: 'Формат работы', type: 'select', options: ['Офис, полный день', 'Удалённо', 'Гибрид (офис + удалённо)', 'Частичная занятость'] },
        ]},
        { heading: 'Требования и обязанности', fields: [
          { key: 'requirements', label: 'Требования к кандидату', type: 'textarea', placeholder: 'Опыт от 2 лет в продажах, знание 1С, коммуникабельность…', required: true },
          { key: 'responsibilities', label: 'Должностные обязанности', type: 'textarea', placeholder: 'Поиск и привлечение клиентов, проведение переговоров, ведение CRM…', required: true },
          { key: 'conditions', label: 'Условия работы', type: 'textarea', placeholder: 'Официальное трудоустройство, ДМС, корпоративные скидки, обучение…' },
          { key: 'contacts', label: 'Контакты для отклика', type: 'text', placeholder: 'hr@company.ru / +7 900 000-00-00', required: true },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ПРИВЛЕКАТЕЛЬНОЕ ОПИСАНИЕ ВАКАНСИИ для размещения на hh.ru и других платформах (не задавай вопросов, напиши готовое объявление с правильной структурой).
КОМПАНИЯ: ${v.company} | ДОЛЖНОСТЬ: ${v.position}${v.department?', '+v.department:''}
ГОРОД: ${v.city} | ЗАРПЛАТА: ${v.salary||'по договорённости'} | ФОРМАТ: ${v.work_format||'офис'}
ТРЕБОВАНИЯ: ${v.requirements}
ОБЯЗАННОСТИ: ${v.responsibilities}${v.conditions?'\nУСЛОВИЯ: '+v.conditions:''}
КОНТАКТЫ: ${v.contacts}`,
    },
    {
      key: 'marina_ref', emoji: '🏅', title: 'Характеристика с места работы', docType: 'marina_doc',
      sections: [
        { heading: 'Работодатель', fields: [
          { key: 'company', label: 'Организация', type: 'text', placeholder: 'ООО «Ромашка»', required: true },
          { key: 'director', label: 'Директор (ФИО, должность)', type: 'text', placeholder: 'Генеральный директор Иванов Иван Иванович', required: true },
          { key: 'address', label: 'Адрес организации', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 1' },
        ]},
        { heading: 'Сотрудник', fields: [
          { key: 'w_fio', label: 'ФИО сотрудника', type: 'text', placeholder: 'Петрова Анна Ивановна', required: true },
          { key: 'w_dob', label: 'Дата рождения', type: 'date' },
          { key: 'w_position', label: 'Должность', type: 'text', placeholder: 'Менеджер по продажам', required: true },
          { key: 'w_period', label: 'Период работы', type: 'text', placeholder: 'с 01.03.2020 по настоящее время', required: true },
        ]},
        { heading: 'Содержание характеристики', fields: [
          { key: 'duties', label: 'Выполняемые обязанности', type: 'textarea', placeholder: 'Работа с клиентами, ведение переговоров, выполнение планов продаж…' },
          { key: 'qualities', label: 'Профессиональные и личные качества', type: 'textarea', placeholder: 'Ответственный, исполнительный, коммуникабельный, обучаемый…', required: true },
          { key: 'achievements', label: 'Достижения', type: 'textarea', placeholder: 'Выполнял план на 120%, лучший сотрудник квартала…' },
          { key: 'purpose', label: 'Куда выдаётся', type: 'text', placeholder: 'По месту требования / в банк / в суд / для нового работодателя' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ОФИЦИАЛЬНУЮ ХАРАКТЕРИСТИКУ С МЕСТА РАБОТЫ (не задавай вопросов, напиши полный официальный документ).
ОРГАНИЗАЦИЯ: ${v.company}, руководитель: ${v.director}${v.address?', адрес: '+v.address:''}
СОТРУДНИК: ${v.w_fio}${v.w_dob?', '+v.w_dob:''}, должность: ${v.w_position}, период: ${v.w_period}
ОБЯЗАННОСТИ: ${v.duties||'по должностной инструкции'}
КАЧЕСТВА: ${v.qualities}${v.achievements?'\nДОСТИЖЕНИЯ: '+v.achievements:''}
ВЫДАЁТСЯ: ${v.purpose||'по месту требования'}`,
    },
  ],

  /* ── ДИМА (маркетолог) ── */
  dima: [
    {
      key: 'dima_kp', emoji: '💼', title: 'Коммерческое предложение', docType: 'dima_doc',
      sections: [
        { heading: 'Отправитель', fields: [
          { key: 'from_company', label: 'Ваша компания / ИП / имя', type: 'text', placeholder: 'ООО «Ромашка» / ИП Иванов И.И.', required: true },
          { key: 'from_contacts', label: 'Контакты', type: 'text', placeholder: '+7 900 000-00-00, info@romashka.ru', required: true },
          { key: 'from_site', label: 'Сайт / соцсети', type: 'text', placeholder: 'romashka.ru / @romashka' },
        ]},
        { heading: 'Кому адресовано', fields: [
          { key: 'to_company', label: 'Компания-получатель', type: 'text', placeholder: 'ООО «Василёк» / «Дорогой клиент»' },
          { key: 'to_person', label: 'Контактное лицо', type: 'text', placeholder: 'Иванову Ивану Ивановичу' },
        ]},
        { heading: 'Продукт / услуга', fields: [
          { key: 'product', label: 'Что предлагаете', type: 'textarea', placeholder: 'Разработка сайтов / бухгалтерские услуги / поставка оборудования / SMM…', required: true },
          { key: 'usp', label: 'Ваше уникальное преимущество (УТП)', type: 'textarea', placeholder: 'Опыт 10 лет / гарантия 2 года / доставка за 2 дня / 24/7 поддержка…', required: true },
          { key: 'price', label: 'Цена / тарифы', type: 'textarea', placeholder: 'от 50 000 ₽ за разработку / тариф «Базовый» 15 000 ₽/мес…', required: true },
          { key: 'cta', label: 'Призыв к действию', type: 'text', placeholder: 'Позвоните нам до 31 мая и получите скидку 10%' },
          { key: 'tone', label: 'Тон КП', type: 'select', options: ['Официально-деловой', 'Дружелюбный и живой', 'Экспертный и авторитетный'] },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ПРОДАЮЩЕЕ КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ (не задавай вопросов, напиши готовый документ с заголовком, проблемой клиента, решением, преимуществами, ценой, отзывами/кейсами (придумай 2 примера) и призывом к действию. Тон: ${v.tone||'деловой'}).
ОТ: ${v.from_company}${v.from_site?', '+v.from_site:''}, контакты: ${v.from_contacts}
КОМУ: ${v.to_company||'потенциальным клиентам'}${v.to_person?', '+v.to_person:''}
ПРЕДЛОЖЕНИЕ: ${v.product}
УТП: ${v.usp}
ЦЕНЫ: ${v.price}${v.cta?'\nПРИЗЫВ: '+v.cta:''}`,
    },
    {
      key: 'dima_brief', emoji: '📋', title: 'Бриф / техническое задание', docType: 'dima_doc',
      sections: [
        { heading: 'Заказчик', fields: [
          { key: 'client_name', label: 'Компания / ФИО заказчика', type: 'text', placeholder: 'ООО «Альфа»', required: true },
          { key: 'client_contacts', label: 'Контакты', type: 'text', placeholder: '+7 900 000-00-00, info@alpha.ru', required: true },
        ]},
        { heading: 'Проект', fields: [
          { key: 'project_type', label: 'Тип проекта', type: 'select', options: ['Дизайн логотипа', 'Разработка сайта', 'SMM / ведение соцсетей', 'Контекстная реклама', 'Видеопроизводство', 'Полиграфия / брендирование', 'Другое'], required: true },
          { key: 'project_desc', label: 'Описание проекта', type: 'textarea', placeholder: 'Хотим разработать новый сайт для продажи мебели…', required: true },
          { key: 'goal', label: 'Цель проекта', type: 'textarea', placeholder: 'Увеличить продажи на 30%, привлечь новых клиентов…', required: true },
          { key: 'target', label: 'Целевая аудитория', type: 'textarea', placeholder: 'Мужчины и женщины 25–45, Набережные Челны, средний доход…', required: true },
          { key: 'style', label: 'Стиль / пожелания по дизайну', type: 'textarea', placeholder: 'Современный, минималистичный, цвета: синий + белый…' },
          { key: 'competitors', label: 'Конкуренты / примеры нравятся', type: 'textarea', placeholder: 'alpha.ru нравится навигация, beta.ru нравится цветовое решение…' },
          { key: 'budget', label: 'Бюджет (₽)', type: 'text', placeholder: 'до 150 000' },
          { key: 'deadline', label: 'Срок', type: 'text', placeholder: 'к 01.07.2026 / 4 недели', required: true },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ПРОФЕССИОНАЛЬНЫЙ БРИФ / ТЕХНИЧЕСКОЕ ЗАДАНИЕ на проект (не задавай вопросов, оформи структурированный документ со всеми разделами).
ЗАКАЗЧИК: ${v.client_name}, контакты: ${v.client_contacts}
ТИП: ${v.project_type}
ОПИСАНИЕ: ${v.project_desc}
ЦЕЛЬ: ${v.goal}
ЦА: ${v.target}${v.style?'\nСТИЛЬ: '+v.style:''}${v.competitors?'\nПРИМЕРЫ: '+v.competitors:''}
БЮДЖЕТ: ${v.budget||'по договорённости'} | СРОК: ${v.deadline}`,
    },
    {
      key: 'dima_content', emoji: '📅', title: 'Контент-план на месяц', docType: 'dima_doc',
      sections: [
        { heading: 'Платформа и тема', fields: [
          { key: 'platform', label: 'Платформа', type: 'select', options: ['ВКонтакте', 'Telegram-канал', 'Instagram / Reels', 'TikTok', 'YouTube', 'Одноклассники', 'Несколько платформ сразу'], required: true },
          { key: 'niche', label: 'Ниша / тема аккаунта', type: 'text', placeholder: 'Продажа мебели / психологические советы / рецепты…', required: true },
          { key: 'brand_name', label: 'Название бренда / аккаунта', type: 'text', placeholder: 'ООО «Уют» / @psych_tips', required: true },
          { key: 'target', label: 'Целевая аудитория', type: 'text', placeholder: 'Мамы 25–40 / предприниматели / молодёжь…', required: true },
        ]},
        { heading: 'Параметры плана', fields: [
          { key: 'freq', label: 'Частота публикаций', type: 'select', options: ['Ежедневно', '3–4 раза в неделю', '2 раза в неделю', '1 раз в неделю'], required: true },
          { key: 'format', label: 'Форматы контента', type: 'textarea', placeholder: 'Посты с текстом, Reels, сторис, опросы, прямые эфиры…' },
          { key: 'goals', label: 'Цели на месяц', type: 'textarea', placeholder: 'Рост подписчиков на 500, продажи через посты, повышение вовлечённости…', required: true },
          { key: 'tone', label: 'Тон коммуникации', type: 'select', options: ['Дружелюбный и живой', 'Экспертный', 'Продающий', 'Информационный', 'Развлекательный'] },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ПОДРОБНЫЙ КОНТЕНТ-ПЛАН НА МЕСЯЦ для социальных сетей (не задавай вопросов, напиши таблицу по неделям с конкретными темами, форматами и хэштегами для каждой публикации).
ПЛАТФОРМА: ${v.platform} | БРЕНД: ${v.brand_name} | НИША: ${v.niche}
ЦА: ${v.target} | ЧАСТОТА: ${v.freq}
ФОРМАТЫ: ${v.format||'посты и сторис'}
ЦЕЛИ: ${v.goals} | ТОН: ${v.tone||'живой и дружелюбный'}`,
    },
    {
      key: 'dima_press', emoji: '📰', title: 'Пресс-релиз', docType: 'dima_doc',
      sections: [
        { heading: 'Организация', fields: [
          { key: 'company', label: 'Компания', type: 'text', placeholder: 'ООО «Ромашка»', required: true },
          { key: 'contacts', label: 'Контакты пресс-службы', type: 'text', placeholder: 'pr@romashka.ru / +7 900 000-00-00', required: true },
          { key: 'website', label: 'Сайт', type: 'text', placeholder: 'romashka.ru' },
        ]},
        { heading: 'Событие/новость', fields: [
          { key: 'event', label: 'О чём пресс-релиз', type: 'select', options: ['Открытие нового продукта/услуги', 'Открытие офиса/точки', 'Достижение/рекорд компании', 'Партнёрство/сделка', 'Мероприятие/конференция', 'Кризисное заявление'] },
          { key: 'headline', label: 'Заголовок новости', type: 'text', placeholder: 'ООО «Ромашка» открывает производство в Набережных Челнах', required: true },
          { key: 'facts', label: 'Ключевые факты (что, где, когда, цифры)', type: 'textarea', placeholder: '15 мая 2026 года открылся новый цех площадью 2000 кв.м, 150 новых рабочих мест…', required: true },
          { key: 'quote', label: 'Цитата руководителя', type: 'textarea', placeholder: 'Директор Иван Иванов: «Это важный шаг в развитии компании…»' },
          { key: 'bg', label: 'Справка о компании', type: 'textarea', placeholder: 'ООО «Ромашка» основана в 2010 году, лидер рынка мебели в РТ…' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ПРОФЕССИОНАЛЬНЫЙ ПРЕСС-РЕЛИЗ по стандартам российских СМИ (не задавай вопросов, оформи с заголовком, лидом, телом, цитатой, справкой о компании и контактами).
КОМПАНИЯ: ${v.company}${v.website?', '+v.website:''} | КОНТАКТЫ: ${v.contacts}
ТИП: ${v.event||'новость компании'}
ЗАГОЛОВОК: ${v.headline}
ФАКТЫ: ${v.facts}${v.quote?'\nЦИТАТА: '+v.quote:''}${v.bg?'\nСПРАВКА: '+v.bg:''}`,
    },
    {
      key: 'dima_ad', emoji: '✍️', title: 'Рекламный текст / пост', docType: 'dima_doc',
      sections: [
        { heading: 'Продукт', fields: [
          { key: 'product', label: 'Что продвигаем', type: 'text', placeholder: 'Курс по Python / кофейня «Уют» / доставка цветов', required: true },
          { key: 'benefit', label: 'Главная выгода для клиента', type: 'text', placeholder: 'Научишься программировать за 3 месяца / свежие цветы за час', required: true },
          { key: 'pain', label: 'Боль / проблема клиента', type: 'text', placeholder: 'Нет времени ехать в магазин / не знаешь с чего начать', required: true },
        ]},
        { heading: 'Параметры текста', fields: [
          { key: 'format', label: 'Формат', type: 'select', options: ['Пост ВКонтакте / Telegram', 'Объявление в Авито', 'Баннер / листовка', 'Email-рассылка', 'SMS / push-уведомление'], required: true },
          { key: 'cta', label: 'Призыв к действию', type: 'text', placeholder: 'Запишитесь сейчас / пишите в ЛС / звоните', required: true },
          { key: 'offer', label: 'Акция / спецпредложение', type: 'text', placeholder: 'Скидка 20% до конца мая / первый урок бесплатно' },
          { key: 'tone', label: 'Тон', type: 'select', options: ['Продающий', 'Эмоциональный / цепляющий', 'Информационный / нейтральный', 'Дружелюбный'] },
          { key: 'contact', label: 'Контакт для связи', type: 'text', placeholder: '+7 900 000-00-00 / @username', required: true },
        ]},
      ],
      buildPrompt: v => `НАПИШИ ПРОДАЮЩИЙ РЕКЛАМНЫЙ ТЕКСТ (не задавай вопросов, напиши сразу готовый вариант для ${v.format||'поста'}. Тон: ${v.tone||'продающий'}. Структура: внимание → проблема → решение → выгода → призыв к действию).
ПРОДУКТ: ${v.product}
ВЫГОДА: ${v.benefit} | БОЛЬ: ${v.pain}
ПРИЗЫВ: ${v.cta} | КОНТАКТ: ${v.contact}${v.offer?'\nАКЦИЯ: '+v.offer:''}`,
    },
  ],

  /* ── АНТОН (финансист) ── */
  anton: [
    {
      key: 'anton_budget', emoji: '💰', title: 'Семейный бюджет на месяц', docType: 'anton_doc',
      sections: [
        { heading: 'Доходы', fields: [
          { key: 'income1', label: 'Доход 1 (ФИО / источник, сумма)', type: 'text', placeholder: 'Зарплата Антон — 80 000 ₽', required: true },
          { key: 'income2', label: 'Доход 2 (если есть)', type: 'text', placeholder: 'Зарплата Марина — 60 000 ₽' },
          { key: 'income_extra', label: 'Дополнительные доходы', type: 'text', placeholder: 'Фриланс — 15 000 ₽ / аренда — 10 000 ₽' },
        ]},
        { heading: 'Расходы постоянные', fields: [
          { key: 'fixed', label: 'Постоянные расходы (по статьям)', type: 'textarea', placeholder: 'Ипотека — 30 000 ₽\nАренда — 25 000 ₽\nКредит — 12 000 ₽\nКоммунальные — 5 000 ₽', required: true },
        ]},
        { heading: 'Расходы переменные', fields: [
          { key: 'variable', label: 'Переменные расходы', type: 'textarea', placeholder: 'Продукты — 20 000 ₽\nТранспорт — 8 000 ₽\nОбеды на работе — 6 000 ₽\nОдежда — 5 000 ₽\nРазвлечения — 5 000 ₽', required: true },
        ]},
        { heading: 'Цели', fields: [
          { key: 'savings_goal', label: 'Цель накоплений на месяц (₽)', type: 'text', placeholder: '15 000', required: true },
          { key: 'big_goal', label: 'Крупная цель', type: 'text', placeholder: 'Отпуск в июле — 100 000 ₽ / новый холодильник — 40 000 ₽' },
          { key: 'period', label: 'Период (месяц)', type: 'text', placeholder: 'Май 2026' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ПОДРОБНЫЙ СЕМЕЙНЫЙ БЮДЖЕТ на ${v.period||'месяц'} с таблицами доходов и расходов, балансом, аналитикой, рекомендациями по оптимизации и планом накоплений (не задавай вопросов).
ДОХОДЫ: ${v.income1}${v.income2?'\n'+v.income2:''}${v.income_extra?'\nДОП: '+v.income_extra:''}
ПОСТОЯННЫЕ РАСХОДЫ: ${v.fixed}
ПЕРЕМЕННЫЕ РАСХОДЫ: ${v.variable}
ЦЕЛЬ НАКОПЛЕНИЙ: ${v.savings_goal} ₽/мес${v.big_goal?'\nКРУПНАЯ ЦЕЛЬ: '+v.big_goal:''}`,
    },
    {
      key: 'anton_mortgage', emoji: '🏠', title: 'Ипотечный расчёт', docType: 'anton_doc',
      sections: [
        { heading: 'Параметры кредита', fields: [
          { key: 'price', label: 'Стоимость недвижимости (₽)', type: 'text', placeholder: '5 000 000', required: true },
          { key: 'down', label: 'Первоначальный взнос (₽ или %)', type: 'text', placeholder: '1 000 000 (20%)', required: true },
          { key: 'rate', label: 'Процентная ставка (%)', type: 'text', placeholder: '8.5', required: true },
          { key: 'term', label: 'Срок кредита (лет)', type: 'text', placeholder: '20', required: true },
          { key: 'payment_type', label: 'Тип платежей', type: 'select', options: ['Аннуитетный (равные платежи)', 'Дифференцированный (уменьшающиеся платежи)'] },
        ]},
        { heading: 'Дополнительно', fields: [
          { key: 'bank', label: 'Банк (если уже выбрали)', type: 'text', placeholder: 'Сбербанк / ВТБ / Альфа-Банк' },
          { key: 'program', label: 'Программа (если знаете)', type: 'select', options: ['Стандартная ипотека', 'Льготная (6.5%)', 'Семейная ипотека', 'IT-ипотека', 'Дальневосточная', 'Сельская'] },
          { key: 'extra', label: 'Дополнительные вопросы', type: 'textarea', placeholder: 'Сравни 15 и 20 лет / покажи выгоду досрочного погашения на 500 000 ₽ через год' },
        ]},
      ],
      buildPrompt: v => `РАССЧИТАЙ ИПОТЕКУ полностью: ежемесячный платёж, общую переплату, общую сумму выплат, таблицу платежей (первые 12 мес и последние 12 мес), рекомендации по выбору банка и оптимизации. Не задавай вопросов.
ПАРАМЕТРЫ: цена ${v.price} ₽, взнос ${v.down}, ставка ${v.rate}%, срок ${v.term} лет, тип платежей: ${v.payment_type||'аннуитетный'}
${v.bank?'БАНК: '+v.bank:''}${v.program?'\nПРОГРАММА: '+v.program:''}${v.extra?'\nДОП. ВОПРОСЫ: '+v.extra:''}`,
    },
    {
      key: 'anton_finplan', emoji: '📈', title: 'Личный финансовый план', docType: 'anton_doc',
      sections: [
        { heading: 'Текущая ситуация', fields: [
          { key: 'age', label: 'Возраст', type: 'text', placeholder: '32', required: true },
          { key: 'income', label: 'Чистый доход в месяц (₽)', type: 'text', placeholder: '120 000', required: true },
          { key: 'expenses', label: 'Расходы в месяц (₽)', type: 'text', placeholder: '90 000' },
          { key: 'assets', label: 'Текущие активы (сбережения, недвижимость, авто)', type: 'textarea', placeholder: 'Сбережения: 500 000 ₽\nКвартира в ипотеке\nАвтомобиль 2020 года' },
          { key: 'debts', label: 'Долги (кредиты, ипотека)', type: 'textarea', placeholder: 'Ипотека — остаток 3 000 000 ₽, 25 000 ₽/мес\nКредит — 150 000 ₽, 8 000 ₽/мес' },
        ]},
        { heading: 'Цели', fields: [
          { key: 'goal1', label: 'Цель №1 (с суммой и сроком)', type: 'text', placeholder: 'Накопить 500 000 ₽ на машину — 2 года', required: true },
          { key: 'goal2', label: 'Цель №2', type: 'text', placeholder: 'Создать подушку безопасности 6 окладов — 1 год' },
          { key: 'goal3', label: 'Долгосрочная цель', type: 'text', placeholder: 'Пенсионный капитал / пассивный доход 100 000 ₽/мес через 15 лет' },
          { key: 'risk', label: 'Отношение к риску', type: 'select', options: ['Консервативный (только вклады и ОФЗ)', 'Умеренный (вклады + фонды)', 'Агрессивный (акции + фонды + крипто)'] },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ПЕРСОНАЛЬНЫЙ ФИНАНСОВЫЙ ПЛАН НА ГОД с пошаговыми рекомендациями, распределением доходов (50/30/20 или другое), стратегией достижения целей, оптимизацией расходов. Не задавай вопросов, дай конкретный план.
ВОЗРАСТ: ${v.age} лет | ДОХОД: ${v.income} ₽/мес${v.expenses?' | РАСХОДЫ: '+v.expenses+' ₽/мес':''}
АКТИВЫ: ${v.assets||'нет данных'} | ДОЛГИ: ${v.debts||'нет'}
ЦЕЛИ: ${v.goal1}${v.goal2?'\n'+v.goal2:''}${v.goal3?'\n'+v.goal3:''}
РИСК: ${v.risk||'умеренный'}`,
    },
    {
      key: 'anton_invest', emoji: '📊', title: 'Инвестиционный план', docType: 'anton_doc',
      sections: [
        { heading: 'Параметры инвестирования', fields: [
          { key: 'amount', label: 'Начальная сумма (₽)', type: 'text', placeholder: '500 000', required: true },
          { key: 'monthly', label: 'Ежемесячное пополнение (₽)', type: 'text', placeholder: '20 000' },
          { key: 'horizon', label: 'Инвестиционный горизонт', type: 'select', options: ['До 1 года', '1–3 года', '3–5 лет', '5–10 лет', 'Более 10 лет'], required: true },
          { key: 'goal', label: 'Цель инвестирования', type: 'text', placeholder: 'Накопить на квартиру / создать пассивный доход / пенсия', required: true },
          { key: 'risk', label: 'Риск-профиль', type: 'select', options: ['Консервативный — минимум риска', 'Умеренный — баланс риска и доходности', 'Агрессивный — максимум доходности'], required: true },
          { key: 'forbidden', label: 'Что не хотите (если есть ограничения)', type: 'text', placeholder: 'Не хочу акции иностранных компаний / не криптовалюту' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ИНВЕСТИЦИОННЫЙ ПЛАН с распределением по инструментам (конкретные доли в %: ОФЗ, акции РФ, ETF, вклады, и др.), ожидаемой доходностью, рисками, примерным итогом через указанный горизонт. Не задавай вопросов.
СУММА: ${v.amount} ₽${v.monthly?', ежемесячно '+v.monthly+' ₽':''}
ГОРИЗОНТ: ${v.horizon} | ЦЕЛЬ: ${v.goal} | РИСК-ПРОФИЛЬ: ${v.risk}${v.forbidden?'\nОГРАНИЧЕНИЯ: '+v.forbidden:''}`,
    },
  ],

  /* ── ГАЛИНА (бухгалтер) — полный арсенал бухгалтерских документов ── */
  galina: [

    /* 1. Счёт на оплату */
    {
      key: 'galina_invoice', emoji: '🧾', title: 'Счёт на оплату', docType: 'invoice',
      sections: [
        { heading: 'Продавец / Поставщик', fields: [
          { key: 's_name', label: 'Наименование организации / ИП', type: 'text', placeholder: 'ООО «Ромашка» / ИП Иванов И.И.', required: true },
          { key: 's_inn', label: 'ИНН', type: 'text', placeholder: '1650000000', required: true },
          { key: 's_kpp', label: 'КПП (для ООО)', type: 'text', placeholder: '165001001' },
          { key: 's_ogrn', label: 'ОГРН / ОГРНИП', type: 'text', placeholder: '1021600000000' },
          { key: 's_address', label: 'Юридический адрес', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 1', required: true },
          { key: 's_bank', label: 'Банк', type: 'text', placeholder: 'ПАО Сбербанк', required: true },
          { key: 's_account', label: 'Расчётный счёт (р/с)', type: 'text', placeholder: '40702810000000000001', required: true },
          { key: 's_bik', label: 'БИК банка', type: 'text', placeholder: '049205644', required: true },
          { key: 's_corr', label: 'Корр. счёт (к/с)', type: 'text', placeholder: '30101810600000000644', required: true },
          { key: 's_director', label: 'Руководитель', type: 'text', placeholder: 'Генеральный директор Иванов И.И.' },
          { key: 's_phone', label: 'Телефон', type: 'text', placeholder: '+7 855 000-00-00' },
        ]},
        { heading: 'Покупатель / Плательщик', fields: [
          { key: 'b_name', label: 'Наименование организации / ФИО', type: 'text', placeholder: 'ООО «Василёк» / Петров П.П.', required: true },
          { key: 'b_inn', label: 'ИНН', type: 'text', placeholder: '1650111111' },
          { key: 'b_address', label: 'Адрес', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5' },
        ]},
        { heading: 'Товары / Услуги', fields: [
          { key: 'invoice_num', label: 'Номер счёта', type: 'text', placeholder: '1', required: true },
          { key: 'invoice_date', label: 'Дата', type: 'date', required: true },
          { key: 'items', label: 'Позиции (наименование, кол-во, ед., цена за ед.)', type: 'textarea', placeholder: 'Разработка сайта — 1 шт. — 80 000 ₽\nСопровождение 3 мес. — 1 шт. — 15 000 ₽', required: true },
          { key: 'vat', label: 'НДС', type: 'select', options: ['Без НДС', 'НДС 20%', 'НДС 10%'] },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ СЧЁТ НА ОПЛАТУ №${v.invoice_num} от ${v.invoice_date} по всем правилам бухгалтерского учёта (не задавай вопросов, оформи полностью с банковскими реквизитами и таблицей товаров/услуг).
===ПРОДАВЕЦ===
${v.s_name}
ИНН: ${v.s_inn}${v.s_kpp?' / КПП: '+v.s_kpp:''}${v.s_ogrn?' / ОГРН: '+v.s_ogrn:''}
Адрес: ${v.s_address}
Банк: ${v.s_bank}, р/с ${v.s_account}, БИК ${v.s_bik}, к/с ${v.s_corr}
${v.s_director||''}${v.s_phone?'\nТел.: '+v.s_phone:''}
===ПОКУПАТЕЛЬ===
${v.b_name}${v.b_inn?' ИНН '+v.b_inn:''}${v.b_address?'\n'+v.b_address:''}
===ТАБЛИЦА===
Наименование|Кол-во|Ед.|Цена|Сумма
${v.items.split('\n').filter(Boolean).join('\n')}
===ИТОГО===
НДС: ${v.vat||'Без НДС'}
===ПОДВАЛ===
Счёт действителен 5 банковских дней`,
    },

    /* 2. Акт выполненных работ */
    {
      key: 'galina_act', emoji: '📝', title: 'Акт выполненных работ', docType: 'act',
      sections: [
        { heading: 'Исполнитель', fields: [
          { key: 's_name', label: 'Организация / ИП', type: 'text', placeholder: 'ООО «Ромашка» / ИП Иванов И.И.', required: true },
          { key: 's_inn', label: 'ИНН', type: 'text', placeholder: '1650000000', required: true },
          { key: 's_director', label: 'Директор / ИП ФИО', type: 'text', placeholder: 'Иванов Иван Иванович', required: true },
          { key: 's_address', label: 'Адрес', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 1' },
        ]},
        { heading: 'Заказчик', fields: [
          { key: 'b_name', label: 'Организация / ФИО', type: 'text', placeholder: 'ООО «Василёк»', required: true },
          { key: 'b_inn', label: 'ИНН', type: 'text', placeholder: '1650111111' },
          { key: 'b_director', label: 'Директор / ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
          { key: 'b_address', label: 'Адрес', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5' },
        ]},
        { heading: 'Акт', fields: [
          { key: 'act_num', label: 'Номер акта', type: 'text', placeholder: '1', required: true },
          { key: 'act_date', label: 'Дата', type: 'date', required: true },
          { key: 'contract_ref', label: 'Договор-основание', type: 'text', placeholder: 'Договор №1 от 01.04.2026' },
          { key: 'items', label: 'Перечень работ / услуг с суммами', type: 'textarea', placeholder: 'Бухгалтерское сопровождение за апрель 2026 — 30 000 ₽\nНалоговая отчётность — 5 000 ₽', required: true },
          { key: 'vat', label: 'НДС', type: 'select', options: ['Без НДС', 'НДС 20%', 'НДС 10%'] },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ АКТ ВЫПОЛНЕННЫХ РАБОТ №${v.act_num} от ${v.act_date} по всем правилам бухгалтерского учёта (не задавай вопросов, оформи полностью).
===ИСПОЛНИТЕЛЬ===
${v.s_name}, ИНН ${v.s_inn}${v.s_address?'\n'+v.s_address:''}
Директор: ${v.s_director}
===ЗАКАЗЧИК===
${v.b_name}${v.b_inn?' ИНН '+v.b_inn:''}${v.b_address?'\n'+v.b_address:''}
Директор: ${v.b_director}
===ТАБЛИЦА===
Наименование|Кол-во|Ед.|Цена|Сумма
${v.items.split('\n').filter(Boolean).join('\n')}
===ИТОГО===
НДС: ${v.vat||'Без НДС'}${v.contract_ref?'\nОснование: '+v.contract_ref:''}
===ПОДВАЛ===
Работы выполнены в полном объёме, стороны претензий не имеют`,
    },

    /* 3. Коммерческое предложение */
    {
      key: 'galina_kp', emoji: '📊', title: 'Коммерческое предложение (КП)', docType: 'commercial',
      sections: [
        { heading: 'Отправитель', fields: [
          { key: 's_name', label: 'Организация / ИП', type: 'text', placeholder: 'ООО «Ромашка» / ИП Иванов И.И.', required: true },
          { key: 's_inn', label: 'ИНН', type: 'text', placeholder: '1650000000', required: true },
          { key: 's_contacts', label: 'Телефон, e-mail, сайт', type: 'text', placeholder: '+7 855 000-00-00, info@romashka.ru, romashka.ru', required: true },
          { key: 's_director', label: 'Директор', type: 'text', placeholder: 'Иванов Иван Иванович' },
        ]},
        { heading: 'Получатель', fields: [
          { key: 'b_name', label: 'Организация / ФИО', type: 'text', placeholder: 'ООО «Василёк»' },
          { key: 'b_contact', label: 'Контактное лицо', type: 'text', placeholder: 'Директору Петрову П.П.' },
        ]},
        { heading: 'Предложение', fields: [
          { key: 'service', label: 'Услуга / продукт', type: 'textarea', placeholder: 'Бухгалтерское сопровождение ООО на УСН\n— ведение учёта\n— налоговые декларации\n— кадровый учёт', required: true },
          { key: 'price', label: 'Тарифы / стоимость', type: 'textarea', placeholder: 'Тариф «Базовый» — 15 000 ₽/мес\nТариф «Расширенный» — 25 000 ₽/мес', required: true },
          { key: 'why_us', label: 'Почему мы', type: 'textarea', placeholder: '25 лет опыта, 200+ клиентов, гарантия точности…' },
          { key: 'cta', label: 'Призыв к действию', type: 'text', placeholder: 'Позвоните нам для бесплатной консультации' },
          { key: 'date', label: 'Дата КП', type: 'date' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ПРОФЕССИОНАЛЬНОЕ КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ на бухгалтерские/финансовые услуги (не задавай вопросов, оформи с шапкой, описанием услуг, тарифной сеткой, преимуществами и контактами).
===ПРОДАВЕЦ===
${v.s_name}, ИНН ${v.s_inn}${v.s_director?'\nРуководитель: '+v.s_director:''}
Контакты: ${v.s_contacts}
===ПОКУПАТЕЛЬ===
${v.b_name||'Уважаемый партнёр'}${v.b_contact?'\n'+v.b_contact:''}
===ТАБЛИЦА===
Услуга|Стоимость
${(v.price||'').split('\n').filter(Boolean).join('\n')}
===ИТОГО===
УСЛУГИ: ${v.service}${v.why_us?'\nПРЕИМУЩЕСТВА: '+v.why_us:''}
===ПОДВАЛ===
${v.cta||'Свяжитесь с нами для обсуждения деталей'} · Дата: ${v.date||new Date().toLocaleDateString('ru-RU')}`,
    },

    /* 4. Претензия о задолженности */
    {
      key: 'galina_claim', emoji: '📋', title: 'Претензия о задолженности', docType: 'galina_doc',
      sections: [
        { heading: 'Кредитор (от кого)', fields: [
          { key: 's_name', label: 'Организация / ИП', type: 'text', placeholder: 'ООО «Ромашка» / ИП Иванов И.И.', required: true },
          { key: 's_inn', label: 'ИНН', type: 'text', placeholder: '1650000000', required: true },
          { key: 's_address', label: 'Адрес', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 1', required: true },
          { key: 's_director', label: 'Директор / ИП ФИО', type: 'text', placeholder: 'Иванов Иван Иванович', required: true },
          { key: 's_phone', label: 'Телефон / e-mail', type: 'text', placeholder: '+7 855 000-00-00 / info@romashka.ru' },
          { key: 's_bank', label: 'Банковские реквизиты для погашения', type: 'text', placeholder: 'Р/с 40702810…, ПАО Сбербанк, БИК 049205644' },
        ]},
        { heading: 'Должник (кому)', fields: [
          { key: 'b_name', label: 'Организация / ФИО', type: 'text', placeholder: 'ООО «Василёк»', required: true },
          { key: 'b_address', label: 'Юридический адрес', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5', required: true },
          { key: 'b_inn', label: 'ИНН', type: 'text', placeholder: '1650111111' },
          { key: 'b_director', label: 'Директор', type: 'text', placeholder: 'Петров Пётр Петрович' },
        ]},
        { heading: 'Суть требования', fields: [
          { key: 'contract_ref', label: 'Договор / счёт (номер, дата)', type: 'text', placeholder: 'Договор №5 от 01.03.2026 / Счёт №3 от 05.03.2026', required: true },
          { key: 'amount', label: 'Сумма задолженности (₽)', type: 'text', placeholder: '150 000', required: true },
          { key: 'due_date', label: 'Срок оплаты по договору', type: 'date', required: true },
          { key: 'description', label: 'Что было поставлено / выполнено', type: 'textarea', placeholder: 'Оказаны бухгалтерские услуги по договору. Счёт выставлен, акт подписан, оплата не поступила.', required: true },
          { key: 'penalty', label: 'Пени / неустойка (% в день, если предусмотрено)', type: 'text', placeholder: '0.1% за каждый день просрочки' },
          { key: 'deadline', label: 'Срок ответа (дней)', type: 'text', placeholder: '10' },
          { key: 'claim_date', label: 'Дата претензии', type: 'date' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ОФИЦИАЛЬНУЮ ПРЕТЕНЗИЮ О ВЗЫСКАНИИ ЗАДОЛЖЕННОСТИ со ссылками на ГК РФ ст. 309, 310, 395 (не задавай вопросов, оформи полностью с расчётом пени, требованием об оплате и угрозой обращения в суд).
===КРЕДИТОР===
${v.s_name}, ИНН ${v.s_inn}, адрес: ${v.s_address}
Директор: ${v.s_director}${v.s_phone?'\nКонтакты: '+v.s_phone:''}${v.s_bank?'\nРеквизиты: '+v.s_bank:''}
===ДОЛЖНИК===
${v.b_name}${v.b_inn?', ИНН '+v.b_inn:''}, адрес: ${v.b_address}${v.b_director?'\nДиректору: '+v.b_director:''}
===СУТЬ===
ОСНОВАНИЕ: ${v.contract_ref}
СУММА ДОЛГА: ${v.amount} ₽
СРОК ОПЛАТЫ ПО ДОГОВОРУ: ${v.due_date}
ЧТО СДЕЛАНО: ${v.description}
${v.penalty?'ПЕНИ: '+v.penalty:''}
СРОК ОТВЕТА: ${v.deadline||'10'} дней
ДАТА: ${v.claim_date||new Date().toLocaleDateString('ru-RU')}`,
    },

    /* 5. Договор оказания услуг */
    {
      key: 'galina_service', emoji: '🤝', title: 'Договор оказания услуг', docType: 'galina_doc',
      sections: [
        { heading: 'Исполнитель', fields: [
          { key: 'ex_name', label: 'Организация / ИП', type: 'text', placeholder: 'ООО «Ромашка» / ИП Иванов И.И.', required: true },
          { key: 'ex_inn', label: 'ИНН', type: 'text', placeholder: '1650000000', required: true },
          { key: 'ex_ogrn', label: 'ОГРН / ОГРНИП', type: 'text', placeholder: '1021600000000' },
          { key: 'ex_address', label: 'Юридический адрес', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 1', required: true },
          { key: 'ex_director', label: 'Директор / ИП ФИО (действует на основании)', type: 'text', placeholder: 'Директора Иванова И.И., действующего на основании Устава', required: true },
          { key: 'ex_bank', label: 'Банк и р/с', type: 'text', placeholder: 'ПАО Сбербанк, р/с 40702810…, БИК 049205644' },
        ]},
        { heading: 'Заказчик', fields: [
          { key: 'cl_name', label: 'Организация / ИП / ФИО', type: 'text', placeholder: 'ООО «Василёк»', required: true },
          { key: 'cl_inn', label: 'ИНН', type: 'text', placeholder: '1650111111', required: true },
          { key: 'cl_address', label: 'Адрес', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5', required: true },
          { key: 'cl_director', label: 'Директор / ФИО', type: 'text', placeholder: 'Директора Петрова П.П., действующего на основании Устава', required: true },
        ]},
        { heading: 'Предмет и условия', fields: [
          { key: 'contract_num', label: 'Номер договора', type: 'text', placeholder: '1/2026', required: true },
          { key: 'contract_date', label: 'Дата договора', type: 'date', required: true },
          { key: 'services', label: 'Перечень услуг', type: 'textarea', placeholder: 'Бухгалтерское сопровождение: ведение бухгалтерского и налогового учёта, составление и сдача отчётности, консультирование', required: true },
          { key: 'price', label: 'Стоимость услуг (₽)', type: 'text', placeholder: '20 000 ₽ в месяц', required: true },
          { key: 'vat', label: 'НДС', type: 'select', options: ['Без НДС', 'НДС 20% включён', 'НДС 20% сверху'] },
          { key: 'period', label: 'Срок действия договора', type: 'text', placeholder: 'с 01.05.2026 по 31.12.2026 / бессрочный', required: true },
          { key: 'payment_terms', label: 'Порядок оплаты', type: 'select', options: ['Ежемесячно до 10-го числа', 'По факту оказания услуг (акт)', '100% предоплата', 'Поэтапно по актам'], required: true },
          { key: 'city', label: 'Город заключения', type: 'text', placeholder: 'Набережные Челны' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ПОЛНЫЙ ДОГОВОР ВОЗМЕЗДНОГО ОКАЗАНИЯ УСЛУГ №${v.contract_num} от ${v.contract_date} по нормам ГК РФ гл. 39 (не задавай вопросов, оформи со всеми разделами: предмет, права и обязанности, порядок расчётов, ответственность, конфиденциальность, срок, расторжение, реквизиты и подписи).
ИСПОЛНИТЕЛЬ: ${v.ex_name}, ИНН ${v.ex_inn}${v.ex_ogrn?', ОГРН '+v.ex_ogrn:''}, адрес: ${v.ex_address}, в лице ${v.ex_director}${v.ex_bank?'\nРеквизиты: '+v.ex_bank:''}.
ЗАКАЗЧИК: ${v.cl_name}, ИНН ${v.cl_inn}, адрес: ${v.cl_address}, в лице ${v.cl_director}.
ПРЕДМЕТ: ${v.services}.
ЦЕНА: ${v.price}, ${v.vat||'Без НДС'}.
СРОК: ${v.period}.
ОПЛАТА: ${v.payment_terms}.
ГОРОД: ${v.city||'Набережные Челны'}.`,
    },

    /* 6. Договор подряда */
    {
      key: 'galina_contract', emoji: '🔨', title: 'Договор подряда', docType: 'galina_doc',
      sections: [
        { heading: 'Подрядчик', fields: [
          { key: 'ex_name', label: 'Организация / ИП', type: 'text', placeholder: 'ООО «Стройсервис» / ИП Сидоров С.С.', required: true },
          { key: 'ex_inn', label: 'ИНН', type: 'text', placeholder: '1650000001', required: true },
          { key: 'ex_address', label: 'Адрес', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 10', required: true },
          { key: 'ex_director', label: 'Директор / ФИО', type: 'text', placeholder: 'Директора Сидорова С.С.', required: true },
          { key: 'ex_bank', label: 'Банк и р/с', type: 'text', placeholder: 'ПАО Сбербанк, р/с 40702810…, БИК 049205644' },
        ]},
        { heading: 'Заказчик', fields: [
          { key: 'cl_name', label: 'Организация / ИП / ФИО', type: 'text', placeholder: 'ООО «Василёк»', required: true },
          { key: 'cl_inn', label: 'ИНН', type: 'text', placeholder: '1650111111', required: true },
          { key: 'cl_address', label: 'Адрес', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5', required: true },
          { key: 'cl_director', label: 'Директор / ФИО', type: 'text', placeholder: 'Директора Петрова П.П.', required: true },
        ]},
        { heading: 'Предмет и условия', fields: [
          { key: 'contract_num', label: 'Номер договора', type: 'text', placeholder: '2/2026', required: true },
          { key: 'contract_date', label: 'Дата', type: 'date', required: true },
          { key: 'work_scope', label: 'Содержание работ / результат', type: 'textarea', placeholder: 'Ремонт офисного помещения площадью 80 кв.м: демонтаж, стяжка, штукатурка, покраска, укладка ламината', required: true },
          { key: 'object', label: 'Адрес объекта', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 5, оф. 101', required: true },
          { key: 'price', label: 'Цена работ (₽)', type: 'text', placeholder: '350 000', required: true },
          { key: 'vat', label: 'НДС', type: 'select', options: ['Без НДС', 'НДС 20% включён'] },
          { key: 'start_date', label: 'Дата начала работ', type: 'date', required: true },
          { key: 'end_date', label: 'Дата окончания работ', type: 'date', required: true },
          { key: 'payment_terms', label: 'Порядок оплаты', type: 'select', options: ['30% аванс, 70% по акту', '50% аванс, 50% по акту', '100% по акту', 'Поэтапная оплата по актам'] },
          { key: 'materials', label: 'Кто обеспечивает материалы', type: 'select', options: ['Подрядчик (включено в цену)', 'Заказчик предоставляет материалы', 'Смешанно: часть — заказчик, часть — подрядчик'] },
          { key: 'city', label: 'Город заключения', type: 'text', placeholder: 'Набережные Челны' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ПОЛНЫЙ ДОГОВОР ПОДРЯДА №${v.contract_num} от ${v.contract_date} по нормам ГК РФ гл. 37 (не задавай вопросов, оформи со всеми разделами: предмет, порядок выполнения, качество, сроки, цена, порядок расчётов, ответственность, гарантийные обязательства, расторжение, реквизиты).
ПОДРЯДЧИК: ${v.ex_name}, ИНН ${v.ex_inn}, адрес: ${v.ex_address}, в лице ${v.ex_director}${v.ex_bank?'\nРеквизиты: '+v.ex_bank:''}.
ЗАКАЗЧИК: ${v.cl_name}, ИНН ${v.cl_inn}, адрес: ${v.cl_address}, в лице ${v.cl_director}.
РАБОТЫ: ${v.work_scope}.
ОБЪЕКТ: ${v.object}.
ЦЕНА: ${v.price} ₽, ${v.vat||'Без НДС'}.
СРОКИ: с ${v.start_date} по ${v.end_date}.
ОПЛАТА: ${v.payment_terms||'50% аванс, 50% по акту'}.
МАТЕРИАЛЫ: ${v.materials||'подрядчик'}.
ГОРОД: ${v.city||'Набережные Челны'}.`,
    },

    /* 7. Договор с самозанятым */
    {
      key: 'galina_freelance', emoji: '👤', title: 'Договор с самозанятым', docType: 'galina_doc',
      sections: [
        { heading: 'Заказчик (компания)', fields: [
          { key: 'cl_name', label: 'Организация / ИП', type: 'text', placeholder: 'ООО «Ромашка»', required: true },
          { key: 'cl_inn', label: 'ИНН', type: 'text', placeholder: '1650000000', required: true },
          { key: 'cl_address', label: 'Адрес', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 1', required: true },
          { key: 'cl_director', label: 'Директор', type: 'text', placeholder: 'Иванов Иван Иванович', required: true },
        ]},
        { heading: 'Исполнитель (самозанятый)', fields: [
          { key: 'fl_fio', label: 'ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
          { key: 'fl_inn', label: 'ИНН самозанятого', type: 'text', placeholder: '165012345678', required: true },
          { key: 'fl_address', label: 'Адрес', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5', required: true },
          { key: 'fl_phone', label: 'Телефон', type: 'text', placeholder: '+7 900 000-00-00', required: true },
          { key: 'fl_bank', label: 'Реквизиты для оплаты', type: 'text', placeholder: 'Карта Сбербанк 4276…, или р/с 40817810…', required: true },
        ]},
        { heading: 'Задание и оплата', fields: [
          { key: 'contract_num', label: 'Номер договора', type: 'text', placeholder: '3/2026', required: true },
          { key: 'contract_date', label: 'Дата', type: 'date', required: true },
          { key: 'services', label: 'Предмет (что делает самозанятый)', type: 'textarea', placeholder: 'Разработка логотипа и фирменного стиля / Настройка рекламы ВКонтакте / Ведение бухгалтерии на аутсорсе', required: true },
          { key: 'price', label: 'Стоимость (₽)', type: 'text', placeholder: '30 000', required: true },
          { key: 'deadline', label: 'Срок выполнения', type: 'text', placeholder: 'до 31.05.2026 / в течение 14 дней', required: true },
          { key: 'payment_terms', label: 'Порядок оплаты', type: 'select', options: ['По факту выполнения и предоставления чека НПД', '50% аванс — 50% по результату', 'Полная предоплата'] },
          { key: 'city', label: 'Город', type: 'text', placeholder: 'Набережные Челны' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ДОГОВОР ГРАЖДАНСКО-ПРАВОВОГО ХАРАКТЕРА С САМОЗАНЯТЫМ №${v.contract_num} от ${v.contract_date} (по нормам ГК РФ, с учётом ФЗ №422-ФЗ «О НПД»; не задавай вопросов, оформи полностью с пунктом об обязанности самозанятого выдать чек через приложение «Мой налог», подтверждением статуса плательщика НПД, ответственностью за утрату статуса самозанятого).
ЗАКАЗЧИК: ${v.cl_name}, ИНН ${v.cl_inn}, адрес: ${v.cl_address}, директор ${v.cl_director}.
ИСПОЛНИТЕЛЬ (самозанятый): ${v.fl_fio}, ИНН ${v.fl_inn}, адрес: ${v.fl_address}, тел. ${v.fl_phone}, реквизиты: ${v.fl_bank}.
ПРЕДМЕТ: ${v.services}.
ЦЕНА: ${v.price} ₽ (НДС не облагается в соответствии с ФЗ №422-ФЗ).
СРОК: ${v.deadline}.
ОПЛАТА: ${v.payment_terms||'по факту выполнения и предоставления чека НПД'}.
ГОРОД: ${v.city||'Набережные Челны'}.`,
    },

    /* 8. Запрос коммерческого предложения */
    {
      key: 'galina_rfq', emoji: '📩', title: 'Запрос коммерческого предложения', docType: 'galina_doc',
      sections: [
        { heading: 'Организация-заказчик', fields: [
          { key: 'cl_name', label: 'Наименование организации', type: 'text', placeholder: 'ООО «Василёк»', required: true },
          { key: 'cl_inn', label: 'ИНН', type: 'text', placeholder: '1650111111', required: true },
          { key: 'cl_contact', label: 'Контактное лицо', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
          { key: 'cl_phone', label: 'Телефон / e-mail', type: 'text', placeholder: '+7 900 000-00-00 / info@vasilek.ru', required: true },
          { key: 'cl_address', label: 'Адрес', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5' },
        ]},
        { heading: 'Параметры запроса', fields: [
          { key: 'rfq_num', label: 'Номер запроса', type: 'text', placeholder: '1', required: true },
          { key: 'rfq_date', label: 'Дата', type: 'date', required: true },
          { key: 'goods', label: 'Что запрашиваем (товары / услуги)', type: 'textarea', placeholder: 'Бухгалтерское программное обеспечение (1С: Предприятие 8.3)\nЛицензия на 5 рабочих мест\nОбучение пользователей — 3 дня', required: true },
          { key: 'requirements', label: 'Требования к поставщику / условиям', type: 'textarea', placeholder: 'Официальный дилер, гарантия 1 год, доставка в Набережные Челны, НДС 20%' },
          { key: 'deadline_offer', label: 'Срок предоставления КП', type: 'date', required: true },
          { key: 'delivery', label: 'Срок поставки / оказания услуг', type: 'text', placeholder: 'до 30.06.2026' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ОФИЦИАЛЬНЫЙ ЗАПРОС КОММЕРЧЕСКОГО ПРЕДЛОЖЕНИЯ №${v.rfq_num} от ${v.rfq_date} (не задавай вопросов, оформи как деловое письмо-запрос с перечнем необходимых позиций в виде таблицы, требованиями и сроком ответа).
ЗАКАЗЧИК: ${v.cl_name}, ИНН ${v.cl_inn}${v.cl_address?', адрес: '+v.cl_address:''}
Контакт: ${v.cl_contact}, ${v.cl_phone}
ОБЪЕКТ ЗАПРОСА:
${v.goods}
${v.requirements?'ТРЕБОВАНИЯ: '+v.requirements:''}
СРОК ПОДАЧИ КП: ${v.deadline_offer}${v.delivery?'\nЖЕЛАЕМЫЙ СРОК ПОСТАВКИ: '+v.delivery:''}`,
    },

    /* 9. Товарная накладная ТОРГ-12 */
    {
      key: 'galina_torg12', emoji: '📦', title: 'Товарная накладная ТОРГ-12', docType: 'galina_doc',
      sections: [
        { heading: 'Поставщик', fields: [
          { key: 's_name', label: 'Организация', type: 'text', placeholder: 'ООО «Ромашка»', required: true },
          { key: 's_inn', label: 'ИНН / КПП', type: 'text', placeholder: '1650000000 / 165001001', required: true },
          { key: 's_address', label: 'Адрес', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 1', required: true },
          { key: 's_bank', label: 'Банк и р/с', type: 'text', placeholder: 'ПАО Сбербанк, р/с 40702810…, БИК 049205644' },
        ]},
        { heading: 'Покупатель', fields: [
          { key: 'b_name', label: 'Организация', type: 'text', placeholder: 'ООО «Василёк»', required: true },
          { key: 'b_inn', label: 'ИНН / КПП', type: 'text', placeholder: '1650111111 / 165001002' },
          { key: 'b_address', label: 'Адрес доставки', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5', required: true },
        ]},
        { heading: 'Накладная', fields: [
          { key: 'torg_num', label: 'Номер накладной', type: 'text', placeholder: '1', required: true },
          { key: 'torg_date', label: 'Дата', type: 'date', required: true },
          { key: 'contract_ref', label: 'Договор-основание', type: 'text', placeholder: 'Договор №1 от 01.04.2026' },
          { key: 'items', label: 'Товары (наименование, кол-во, ед.изм., цена за ед., сумма)', type: 'textarea', placeholder: 'Бумага офисная А4 — 10 пачек — 500 ₽/пачка — 5 000 ₽\nКанцтовары набор — 5 шт. — 300 ₽/шт. — 1 500 ₽', required: true },
          { key: 'vat', label: 'НДС', type: 'select', options: ['Без НДС', 'НДС 20%', 'НДС 10%'] },
          { key: 'shipper', label: 'Грузоотправитель', type: 'text', placeholder: 'Он же (поставщик) / ООО «Логистик»' },
          { key: 'receiver', label: 'Грузополучатель', type: 'text', placeholder: 'Он же (покупатель)' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ТОВАРНУЮ НАКЛАДНУЮ (форма ТОРГ-12) №${v.torg_num} от ${v.torg_date} по унифицированной форме Госкомстата (не задавай вопросов, оформи полностью с шапкой, таблицей товаров, итогами, подписями).
===ПОСТАВЩИК===
${v.s_name}, ИНН/КПП: ${v.s_inn}, адрес: ${v.s_address}${v.s_bank?'\n'+v.s_bank:''}
Грузоотправитель: ${v.shipper||'он же'}
===ПОКУПАТЕЛЬ===
${v.b_name}${v.b_inn?', ИНН/КПП: '+v.b_inn:''}, адрес: ${v.b_address}
Грузополучатель: ${v.receiver||'он же'}
===ТАБЛИЦА===
Наименование|Ед.|Кол-во|Цена|Сумма
${v.items.split('\n').filter(Boolean).join('\n')}
===ИТОГО===
НДС: ${v.vat||'Без НДС'}${v.contract_ref?'\nОснование: '+v.contract_ref:''}`,
    },

    /* 10. Платёжное поручение */
    {
      key: 'galina_payment', emoji: '💸', title: 'Платёжное поручение', docType: 'payment',
      sections: [
        { heading: 'Плательщик', fields: [
          { key: 's_name', label: 'Наименование организации / ФИО', type: 'text', placeholder: 'ООО «Ромашка»', required: true },
          { key: 's_inn', label: 'ИНН', type: 'text', placeholder: '1650000000', required: true },
          { key: 's_kpp', label: 'КПП', type: 'text', placeholder: '165001001' },
          { key: 's_account', label: 'Расчётный счёт плательщика', type: 'text', placeholder: '40702810000000000001', required: true },
          { key: 's_bank', label: 'Банк плательщика', type: 'text', placeholder: 'ПАО Сбербанк', required: true },
          { key: 's_bik', label: 'БИК', type: 'text', placeholder: '049205644', required: true },
          { key: 's_corr', label: 'Корр. счёт', type: 'text', placeholder: '30101810600000000644', required: true },
        ]},
        { heading: 'Получатель', fields: [
          { key: 'b_name', label: 'Наименование получателя', type: 'text', placeholder: 'ООО «Василёк»', required: true },
          { key: 'b_inn', label: 'ИНН получателя', type: 'text', placeholder: '1650111111', required: true },
          { key: 'b_kpp', label: 'КПП получателя', type: 'text', placeholder: '165001002' },
          { key: 'b_account', label: 'Расчётный счёт получателя', type: 'text', placeholder: '40702810000000000002', required: true },
          { key: 'b_bank', label: 'Банк получателя', type: 'text', placeholder: 'ПАО ВТБ', required: true },
          { key: 'b_bik', label: 'БИК банка получателя', type: 'text', placeholder: '049205787', required: true },
          { key: 'b_corr', label: 'Корр. счёт банка получателя', type: 'text', placeholder: '30101810700000000787', required: true },
        ]},
        { heading: 'Платёж', fields: [
          { key: 'pp_num', label: 'Номер п/п', type: 'text', placeholder: '1', required: true },
          { key: 'pp_date', label: 'Дата', type: 'date', required: true },
          { key: 'amount', label: 'Сумма (₽ цифрами)', type: 'text', placeholder: '150 000.00', required: true },
          { key: 'purpose', label: 'Назначение платежа', type: 'textarea', placeholder: 'Оплата по счёту №5 от 01.05.2026 за бухгалтерские услуги. Без НДС.', required: true },
          { key: 'priority', label: 'Очерёдность платежа', type: 'select', options: ['3 (прочие платежи)', '1', '2', '4', '5'] },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ПЛАТЁЖНОЕ ПОРУЧЕНИЕ №${v.pp_num} от ${v.pp_date} по форме, утверждённой Банком России (не задавай вопросов, оформи полностью со всеми реквизитами как типовое платёжное поручение — добавь сумму прописью).
===ПЛАТЕЛЬЩИК===
${v.s_name}, ИНН ${v.s_inn}${v.s_kpp?', КПП '+v.s_kpp:''}
Р/с ${v.s_account}, ${v.s_bank}, БИК ${v.s_bik}, к/с ${v.s_corr}
===ПОЛУЧАТЕЛЬ===
${v.b_name}, ИНН ${v.b_inn}${v.b_kpp?', КПП '+v.b_kpp:''}
Р/с ${v.b_account}, ${v.b_bank}, БИК ${v.b_bik}, к/с ${v.b_corr}
===ПЛАТЁЖ===
СУММА: ${v.amount} ₽ (добавь прописью)
НАЗНАЧЕНИЕ: ${v.purpose}
ОЧЕРЁДНОСТЬ: ${v.priority||'3'}`,
    },

    /* 11. Справка 2-НДФЛ */
    {
      key: 'galina_ndfl2', emoji: '📑', title: 'Справка 2-НДФЛ', docType: 'ndfl2',
      sections: [
        { heading: 'Работодатель (налоговый агент)', fields: [
          { key: 'emp_name', label: 'Организация / ИП', type: 'text', placeholder: 'ООО «Ромашка»', required: true },
          { key: 'emp_inn', label: 'ИНН', type: 'text', placeholder: '1650000000', required: true },
          { key: 'emp_kpp', label: 'КПП (для ООО)', type: 'text', placeholder: '165001001' },
          { key: 'emp_oktmo', label: 'ОКТМО', type: 'text', placeholder: '92740000001' },
          { key: 'emp_address', label: 'Адрес', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 1' },
          { key: 'emp_phone', label: 'Телефон', type: 'text', placeholder: '+7 855 000-00-00' },
        ]},
        { heading: 'Сотрудник', fields: [
          { key: 'w_fio', label: 'ФИО сотрудника', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
          { key: 'w_inn', label: 'ИНН сотрудника', type: 'text', placeholder: '165012345678', required: true },
          { key: 'w_snils', label: 'СНИЛС', type: 'text', placeholder: '123-456-789 00' },
          { key: 'w_dob', label: 'Дата рождения', type: 'date', required: true },
          { key: 'w_citizenship', label: 'Гражданство', type: 'text', placeholder: 'Российская Федерация' },
          { key: 'w_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5, кв. 12' },
        ]},
        { heading: 'Доходы и налог', fields: [
          { key: 'year', label: 'Год', type: 'text', placeholder: '2025', required: true },
          { key: 'salary', label: 'Оклад в месяц (₽)', type: 'text', placeholder: '80 000', required: true },
          { key: 'bonuses', label: 'Премии и иные доходы (₽, по месяцам)', type: 'textarea', placeholder: 'Январь: бонус 20 000\nАпрель: квартальная премия 30 000' },
          { key: 'deductions', label: 'Налоговые вычеты', type: 'textarea', placeholder: 'Стандартный на ребёнка 1 400 ₽/мес (код 126)\nНет вычетов' },
          { key: 'rate', label: 'Ставка НДФЛ', type: 'select', options: ['13%', '15%', '30%', '35%'] },
          { key: 'period', label: 'Период работы', type: 'text', placeholder: 'весь год / с 01.03.2025 по 31.12.2025', required: true },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ СПРАВКУ 2-НДФЛ за ${v.year} год по актуальной форме ФНС (не задавай вопросов, оформи полностью с таблицей доходов по месяцам, суммами вычетов, исчисленного, удержанного и перечисленного НДФЛ).
===НАЛОГОВЫЙ АГЕНТ===
${v.emp_name}, ИНН ${v.emp_inn}${v.emp_kpp?', КПП '+v.emp_kpp:''}${v.emp_oktmo?', ОКТМО '+v.emp_oktmo:''}
Адрес: ${v.emp_address||'не указан'}${v.emp_phone?', тел. '+v.emp_phone:''}
===СОТРУДНИК===
ФИО: ${v.w_fio}
ИНН: ${v.w_inn}${v.w_snils?', СНИЛС '+v.w_snils:''}
Дата рождения: ${v.w_dob}${v.w_citizenship?', гражданство: '+v.w_citizenship:''}
Адрес: ${v.w_address||'не указан'}
===ДОХОДЫ===
ГОД: ${v.year} | СТАВКА: ${v.rate||'13%'} | ПЕРИОД РАБОТЫ: ${v.period}
ОКЛАД: ${v.salary} ₽/мес
${v.bonuses?'ПРЕМИИ: '+v.bonuses:''}
ВЫЧЕТЫ: ${v.deductions||'не применяются'}`,
    },

    /* 12. Авансовый отчёт */
    {
      key: 'galina_advance', emoji: '🧾', title: 'Авансовый отчёт', docType: 'galina_doc',
      sections: [
        { heading: 'Организация', fields: [
          { key: 'org_name', label: 'Организация', type: 'text', placeholder: 'ООО «Ромашка»', required: true },
          { key: 'org_inn', label: 'ИНН', type: 'text', placeholder: '1650000000', required: true },
          { key: 'director', label: 'Директор', type: 'text', placeholder: 'Иванов Иван Иванович', required: true },
          { key: 'accountant', label: 'Главный бухгалтер', type: 'text', placeholder: 'Сидорова Галина Петровна', required: true },
        ]},
        { heading: 'Подотчётное лицо', fields: [
          { key: 'w_fio', label: 'ФИО подотчётного лица', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
          { key: 'w_position', label: 'Должность', type: 'text', placeholder: 'Менеджер по закупкам', required: true },
          { key: 'w_dept', label: 'Отдел / подразделение', type: 'text', placeholder: 'Отдел снабжения' },
        ]},
        { heading: 'Аванс и расходы', fields: [
          { key: 'report_num', label: 'Номер отчёта', type: 'text', placeholder: '1', required: true },
          { key: 'report_date', label: 'Дата', type: 'date', required: true },
          { key: 'advance_amount', label: 'Получено под отчёт (₽)', type: 'text', placeholder: '15 000', required: true },
          { key: 'advance_date', label: 'Дата выдачи аванса', type: 'date' },
          { key: 'purpose', label: 'Цель командировки / расходов', type: 'text', placeholder: 'Командировка в г. Казань / закупка канцтоваров / представительские расходы', required: true },
          { key: 'expenses', label: 'Фактические расходы (статья, сумма, документ)', type: 'textarea', placeholder: 'Ж/д билет туда — 2 500 ₽ — чек №1\nЖ/д билет обратно — 2 500 ₽ — чек №2\nПроживание гостиница 2 ночи — 5 600 ₽ — счёт №101\nСуточные 2 дня × 700 ₽ — 1 400 ₽', required: true },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ АВАНСОВЫЙ ОТЧЁТ №${v.report_num} от ${v.report_date} по унифицированной форме АО-1 (не задавай вопросов, оформи полностью с таблицей расходов, итогами, остатком/перерасходом и подписями).
===ОРГАНИЗАЦИЯ===
${v.org_name}, ИНН ${v.org_inn}
Директор: ${v.director}
Гл. бухгалтер: ${v.accountant}
===ПОДОТЧЁТНОЕ ЛИЦО===
ФИО: ${v.w_fio}
Должность: ${v.w_position}${v.w_dept?', '+v.w_dept:''}
===АВАНС И РАСХОДЫ===
ПОЛУЧЕНО: ${v.advance_amount} ₽${v.advance_date?' от '+v.advance_date:''}
ЦЕЛЬ: ${v.purpose}
РАСХОДЫ:
${v.expenses}`,
    },

    /* 13. Доверенность на получение ТМЦ (форма М-2) */
    {
      key: 'galina_m2', emoji: '📬', title: 'Доверенность М-2 (на получение ТМЦ)', docType: 'galina_doc',
      sections: [
        { heading: 'Организация-доверитель', fields: [
          { key: 'org_name', label: 'Организация', type: 'text', placeholder: 'ООО «Ромашка»', required: true },
          { key: 'org_inn', label: 'ИНН / КПП', type: 'text', placeholder: '1650000000 / 165001001', required: true },
          { key: 'org_address', label: 'Адрес', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 1' },
          { key: 'org_bank', label: 'Р/с и банк', type: 'text', placeholder: 'Р/с 40702810…, ПАО Сбербанк' },
        ]},
        { heading: 'Уполномоченное лицо', fields: [
          { key: 'r_fio', label: 'ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
          { key: 'r_position', label: 'Должность', type: 'text', placeholder: 'Кладовщик / Менеджер по снабжению', required: true },
          { key: 'r_passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '4321 098765', required: true },
          { key: 'r_passport_by', label: 'Кем и когда выдан', type: 'text', placeholder: 'УМВД г. Казань, 15.06.2018' },
        ]},
        { heading: 'Что получить', fields: [
          { key: 'poa_num', label: 'Номер доверенности', type: 'text', placeholder: '1', required: true },
          { key: 'poa_date', label: 'Дата выдачи', type: 'date', required: true },
          { key: 'valid_until', label: 'Действительна до', type: 'date', required: true },
          { key: 'supplier', label: 'У кого получить (поставщик)', type: 'text', placeholder: 'ООО «Канцмаркет»', required: true },
          { key: 'doc_ref', label: 'На основании (счёт/накладная)', type: 'text', placeholder: 'Счёт №5 от 01.05.2026', required: true },
          { key: 'items', label: 'Перечень ТМЦ (что получить)', type: 'textarea', placeholder: 'Бумага офисная А4 — 10 пачек\nПапки А4 — 20 шт.\nРучки шариковые — 50 шт.', required: true },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ДОВЕРЕННОСТЬ НА ПОЛУЧЕНИЕ ТОВАРНО-МАТЕРИАЛЬНЫХ ЦЕННОСТЕЙ по форме М-2 №${v.poa_num} от ${v.poa_date} (не задавай вопросов, оформи полностью с таблицей ТМЦ).
===ОРГАНИЗАЦИЯ===
${v.org_name}, ИНН/КПП ${v.org_inn}${v.org_address?', адрес: '+v.org_address:''}${v.org_bank?'\n'+v.org_bank:''}
===УПОЛНОМОЧЕННОЕ ЛИЦО===
ФИО: ${v.r_fio}
Должность: ${v.r_position}
Паспорт: ${v.r_passport}, выдан ${v.r_passport_by||'—'}
===ПАРАМЕТРЫ===
ДЕЙСТВИТЕЛЬНА ДО: ${v.valid_until}
ПОЛУЧИТЬ У: ${v.supplier}
ОСНОВАНИЕ: ${v.doc_ref}
ТМЦ:
${v.items}`,
    },

    /* 14. Договор займа */
    {
      key: 'galina_loan', emoji: '💰', title: 'Договор займа', docType: 'galina_doc',
      sections: [
        { heading: 'Займодавец', fields: [
          { key: 'l_name', label: 'Организация / ФИО', type: 'text', placeholder: 'ООО «Ромашка» / Иванов Иван Иванович', required: true },
          { key: 'l_inn', label: 'ИНН', type: 'text', placeholder: '1650000000', required: true },
          { key: 'l_address', label: 'Адрес', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 1', required: true },
          { key: 'l_director', label: 'Директор / ФИО (если организация)', type: 'text', placeholder: 'Директора Иванова И.И.' },
          { key: 'l_bank', label: 'Р/с и банк', type: 'text', placeholder: 'Р/с 40702810…, ПАО Сбербанк, БИК 049205644' },
        ]},
        { heading: 'Заёмщик', fields: [
          { key: 'b_name', label: 'Организация / ФИО', type: 'text', placeholder: 'ООО «Василёк» / Петров Пётр Петрович', required: true },
          { key: 'b_inn', label: 'ИНН', type: 'text', placeholder: '1650111111', required: true },
          { key: 'b_address', label: 'Адрес', type: 'text', placeholder: 'г. Казань, ул. Пушкина, д. 5', required: true },
          { key: 'b_director', label: 'Директор / ФИО (если организация)', type: 'text', placeholder: 'Директора Петрова П.П.' },
        ]},
        { heading: 'Условия займа', fields: [
          { key: 'loan_num', label: 'Номер договора', type: 'text', placeholder: '1/2026' },
          { key: 'loan_date', label: 'Дата договора', type: 'date', required: true },
          { key: 'amount', label: 'Сумма займа (₽)', type: 'text', placeholder: '500 000', required: true },
          { key: 'rate_type', label: 'Тип займа', type: 'select', options: ['Беспроцентный заём', 'Процентный заём (указать ставку)'], required: true },
          { key: 'rate', label: 'Процентная ставка (% годовых, если процентный)', type: 'text', placeholder: '10' },
          { key: 'return_date', label: 'Срок возврата', type: 'date', required: true },
          { key: 'return_order', label: 'Порядок возврата', type: 'select', options: ['Единовременно в дату возврата', 'Ежемесячными платежами', 'По требованию займодавца'] },
          { key: 'purpose', label: 'Целевое назначение (если целевой)', type: 'text', placeholder: 'На пополнение оборотных средств / для расчётов с контрагентами / не указывать' },
          { key: 'city', label: 'Город', type: 'text', placeholder: 'Набережные Челны' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ПОЛНЫЙ ДОГОВОР ЗАЙМА №${v.loan_num||'1/2026'} от ${v.loan_date} по нормам ГК РФ ст. 807-818 (не задавай вопросов, оформи со всеми разделами: предмет, порядок передачи, сроки и порядок возврата, проценты, ответственность, расторжение, реквизиты и подписи).
ЗАЙМОДАВЕЦ: ${v.l_name}, ИНН ${v.l_inn}, адрес: ${v.l_address}${v.l_director?', в лице '+v.l_director:''}${v.l_bank?'\nРеквизиты: '+v.l_bank:''}.
ЗАЁМЩИК: ${v.b_name}, ИНН ${v.b_inn}, адрес: ${v.b_address}${v.b_director?', в лице '+v.b_director:''}.
СУММА: ${v.amount} ₽.
ТИП: ${v.rate_type}${v.rate?', ставка '+v.rate+'% годовых':''}.
СРОК ВОЗВРАТА: ${v.return_date}.
ПОРЯДОК ВОЗВРАТА: ${v.return_order||'единовременно'}.
${v.purpose?'ЦЕЛЬ: '+v.purpose+'.':''}
ГОРОД: ${v.city||'Набережные Челны'}.`,
    },

    /* 15. Акт сверки взаимных расчётов */
    {
      key: 'galina_reconcile', emoji: '🔄', title: 'Акт сверки расчётов', docType: 'galina_doc',
      sections: [
        { heading: 'Сторона 1', fields: [
          { key: 's1_name', label: 'Организация', type: 'text', placeholder: 'ООО «Ромашка»', required: true },
          { key: 's1_inn', label: 'ИНН / КПП', type: 'text', placeholder: '1650000000 / 165001001', required: true },
          { key: 's1_director', label: 'Директор', type: 'text', placeholder: 'Иванов Иван Иванович', required: true },
          { key: 's1_accountant', label: 'Гл. бухгалтер', type: 'text', placeholder: 'Сидорова Галина Петровна', required: true },
        ]},
        { heading: 'Сторона 2', fields: [
          { key: 's2_name', label: 'Организация', type: 'text', placeholder: 'ООО «Василёк»', required: true },
          { key: 's2_inn', label: 'ИНН / КПП', type: 'text', placeholder: '1650111111 / 165001002', required: true },
          { key: 's2_director', label: 'Директор', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
        ]},
        { heading: 'Период и данные', fields: [
          { key: 'period', label: 'Период сверки', type: 'text', placeholder: 'с 01.01.2026 по 31.03.2026', required: true },
          { key: 'contract_ref', label: 'Договор-основание', type: 'text', placeholder: 'Договор №1 от 01.01.2026' },
          { key: 'operations', label: 'Операции по данным стороны 1 (дата, документ, дебет, кредит)', type: 'textarea', placeholder: '01.02.2026 — Счёт №1 (реализация) — 80 000 ₽ (дебет)\n15.02.2026 — п/п №10 (оплата) — 80 000 ₽ (кредит)\n01.03.2026 — Счёт №2 — 50 000 ₽ (дебет)', required: true },
          { key: 'balance_1', label: 'Сальдо по данным стороны 1 (₽)', type: 'text', placeholder: '50 000 (задолженность покупателя)', required: true },
          { key: 'balance_2', label: 'Сальдо по данным стороны 2 (₽)', type: 'text', placeholder: '50 000 (задолженность перед поставщиком)' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ АКТ СВЕРКИ ВЗАИМНЫХ РАСЧЁТОВ за период ${v.period} (не задавай вопросов, оформи полностью с таблицей операций по данным обеих сторон, итоговыми сальдо, строкой «Расхождений нет» или указанием расхождений, подписями директоров и главных бухгалтеров).
===СТОРОНА 1===
${v.s1_name}, ИНН/КПП ${v.s1_inn}
Директор: ${v.s1_director}
Гл. бухгалтер: ${v.s1_accountant}
===СТОРОНА 2===
${v.s2_name}, ИНН/КПП ${v.s2_inn}
Директор: ${v.s2_director}
===ДАННЫЕ===
ПЕРИОД: ${v.period}${v.contract_ref?'\nДОГОВОР: '+v.contract_ref:''}
ОПЕРАЦИИ ПО ДАННЫМ СТОРОНЫ 1:
${v.operations}
САЛЬДО СТОРОНА 1: ${v.balance_1}${v.balance_2?'\nСАЛЬДО СТОРОНА 2: '+v.balance_2:''}`,
    },

    /* 16. Бухгалтерская справка */
    {
      key: 'galina_memo', emoji: '📰', title: 'Бухгалтерская справка', docType: 'galina_doc',
      sections: [
        { heading: 'Организация', fields: [
          { key: 'org_name', label: 'Организация', type: 'text', placeholder: 'ООО «Ромашка»', required: true },
          { key: 'org_inn', label: 'ИНН / КПП', type: 'text', placeholder: '1650000000 / 165001001' },
          { key: 'accountant', label: 'Главный бухгалтер', type: 'text', placeholder: 'Сидорова Галина Петровна', required: true },
        ]},
        { heading: 'Справка', fields: [
          { key: 'memo_num', label: 'Номер справки', type: 'text', placeholder: '1', required: true },
          { key: 'memo_date', label: 'Дата', type: 'date', required: true },
          { key: 'purpose', label: 'Назначение справки', type: 'text', placeholder: 'Исправление ошибки / корректировка данных / пояснение операции / подтверждение сальдо', required: true },
          { key: 'content', label: 'Содержание (что и почему отражается)', type: 'textarea', placeholder: 'В феврале 2026 года допущена техническая ошибка при отражении хозяйственной операции по счёту 76. Исходная проводка: Дт 76 Кт 51 на сумму 50 000 руб. Корректировка: сторно Дт 76 Кт 51 на 50 000 руб.', required: true },
          { key: 'entries', label: 'Бухгалтерские проводки', type: 'textarea', placeholder: 'Дт 76 Кт 51 — 50 000 ₽ (сторно)\nДт 60 Кт 51 — 50 000 ₽ (правильная проводка)' },
          { key: 'docs', label: 'Приложения (документы-основания)', type: 'textarea', placeholder: 'Платёжное поручение №10 от 05.02.2026, Счёт №3 от 04.02.2026' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ БУХГАЛТЕРСКУЮ СПРАВКУ №${v.memo_num} от ${v.memo_date} (первичный бухгалтерский документ; не задавай вопросов, оформи полностью с реквизитами организации, описанием хозяйственной операции, проводками и подписью главного бухгалтера).
===ОРГАНИЗАЦИЯ===
${v.org_name}${v.org_inn?', ИНН/КПП '+v.org_inn:''}
Гл. бухгалтер: ${v.accountant}
===СПРАВКА===
НАЗНАЧЕНИЕ: ${v.purpose}
СОДЕРЖАНИЕ:
${v.content}
${v.entries?'ПРОВОДКИ:\n'+v.entries:''}
${v.docs?'ПРИЛОЖЕНИЯ: '+v.docs:''}`,
    },

    /* 17. Договор аренды помещения */
    {
      key: 'galina_rent', emoji: '🏢', title: 'Договор аренды помещения', docType: 'galina_doc',
      sections: [
        { heading: 'Арендодатель', fields: [
          { key: 'l_name', label: 'Организация / ФИО', type: 'text', placeholder: 'ООО «Недвижимость» / Иванов И.И.', required: true },
          { key: 'l_inn', label: 'ИНН', type: 'text', placeholder: '1650000000', required: true },
          { key: 'l_address', label: 'Адрес', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 1', required: true },
          { key: 'l_director', label: 'Директор / ФИО (действует на основании)', type: 'text', placeholder: 'Директора Иванова И.И., на основании Устава', required: true },
          { key: 'l_bank', label: 'Р/с и банк', type: 'text', placeholder: 'Р/с 40702810…, ПАО Сбербанк, БИК 049205644' },
        ]},
        { heading: 'Арендатор', fields: [
          { key: 'b_name', label: 'Организация / ФИО', type: 'text', placeholder: 'ООО «Бизнес»', required: true },
          { key: 'b_inn', label: 'ИНН', type: 'text', placeholder: '1650111111', required: true },
          { key: 'b_address', label: 'Юридический адрес', type: 'text', placeholder: 'г. Набережные Челны, пр. Победы, д. 5', required: true },
          { key: 'b_director', label: 'Директор (действует на основании)', type: 'text', placeholder: 'Директора Петрова П.П., на основании Устава', required: true },
          { key: 'b_bank', label: 'Р/с и банк', type: 'text', placeholder: 'Р/с 40702810…, ПАО ВТБ, БИК 049205787' },
        ]},
        { heading: 'Объект и условия', fields: [
          { key: 'contract_num', label: 'Номер договора', type: 'text', placeholder: '1/А-2026' },
          { key: 'contract_date', label: 'Дата', type: 'date', required: true },
          { key: 'obj_address', label: 'Адрес помещения', type: 'text', placeholder: 'г. Набережные Челны, пр. Мира, д. 15, оф. 301', required: true },
          { key: 'obj_area', label: 'Площадь (кв. м)', type: 'text', placeholder: '45.6', required: true },
          { key: 'obj_floor', label: 'Этаж', type: 'text', placeholder: '3' },
          { key: 'obj_cadastral', label: 'Кадастровый номер', type: 'text', placeholder: '16:52:040101:555' },
          { key: 'purpose', label: 'Цель использования', type: 'select', options: ['Офис / административное помещение', 'Торговое помещение', 'Склад', 'Производственное помещение'] },
          { key: 'rent', label: 'Арендная плата (₽/мес)', type: 'text', placeholder: '40 000', required: true },
          { key: 'vat', label: 'НДС в арендной плате', type: 'select', options: ['Без НДС', 'НДС 20% включён', 'НДС 20% сверху'] },
          { key: 'utilities', label: 'Коммунальные платежи', type: 'select', options: ['Включены в арендную плату', 'Оплачиваются арендатором отдельно по счётчикам', 'Фиксированная доплата'] },
          { key: 'deposit', label: 'Обеспечительный платёж (₽)', type: 'text', placeholder: '40 000' },
          { key: 'period', label: 'Срок аренды', type: 'text', placeholder: 'с 01.06.2026 по 31.05.2027 / бессрочный (с уведомлением за 30 дней)', required: true },
          { key: 'payment_day', label: 'Срок оплаты', type: 'text', placeholder: 'до 10-го числа текущего месяца' },
          { key: 'city', label: 'Город', type: 'text', placeholder: 'Набережные Челны' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ПОЛНЫЙ ДОГОВОР АРЕНДЫ НЕЖИЛОГО ПОМЕЩЕНИЯ №${v.contract_num||'1/А-2026'} от ${v.contract_date} по нормам ГК РФ гл. 34 (не задавай вопросов, оформи со всеми разделами: предмет, передача, арендная плата и порядок расчётов, права и обязанности, улучшения, ответственность, досрочное расторжение, возврат помещения, реквизиты и подписи).
АРЕНДОДАТЕЛЬ: ${v.l_name}, ИНН ${v.l_inn}, адрес: ${v.l_address}, в лице ${v.l_director}${v.l_bank?'\nРеквизиты: '+v.l_bank:''}.
АРЕНДАТОР: ${v.b_name}, ИНН ${v.b_inn}, адрес: ${v.b_address}, в лице ${v.b_director}${v.b_bank?'\nРеквизиты: '+v.b_bank:''}.
ОБЪЕКТ: ${v.obj_address}, площадь ${v.obj_area} кв.м${v.obj_floor?', этаж '+v.obj_floor:''}${v.obj_cadastral?', кадастровый номер '+v.obj_cadastral:''}.
ЦЕЛЬ: ${v.purpose||'офис'}.
АРЕНДНАЯ ПЛАТА: ${v.rent} ₽/мес, ${v.vat||'Без НДС'}, коммунальные: ${v.utilities||'отдельно'}, оплата до ${v.payment_day||'10-го числа'}.
ДЕПОЗИТ: ${v.deposit||'не предусмотрен'} ₽.
СРОК: ${v.period}.
ГОРОД: ${v.city||'Набережные Челны'}.`,
    },

    /* 18. Приходный кассовый ордер (ПКО) */
    {
      key: 'galina_pko', emoji: '💵', title: 'Приходный кассовый ордер (ПКО)', docType: 'galina_doc',
      sections: [
        { heading: 'Организация', fields: [
          { key: 'org_name', label: 'Организация', type: 'text', placeholder: 'ООО «Ромашка»', required: true },
          { key: 'org_inn', label: 'ИНН / КПП', type: 'text', placeholder: '1650000000 / 165001001' },
          { key: 'struct_unit', label: 'Структурное подразделение', type: 'text', placeholder: 'Касса / Бухгалтерия' },
        ]},
        { heading: 'Реквизиты ПКО', fields: [
          { key: 'pko_num', label: 'Номер ПКО', type: 'text', placeholder: '1', required: true },
          { key: 'pko_date', label: 'Дата', type: 'date', required: true },
          { key: 'debit_acc', label: 'Дебет (счёт)', type: 'text', placeholder: '50 (касса)' },
          { key: 'credit_acc', label: 'Кредит (счёт)', type: 'text', placeholder: '71 (расчёты с подотчётными) / 62 (расчёты с покупателями)' },
          { key: 'amount', label: 'Сумма (₽)', type: 'text', placeholder: '15 000', required: true },
          { key: 'from_whom', label: 'Принято от', type: 'text', placeholder: 'Петрова Петра Петровича / ООО «Василёк»', required: true },
          { key: 'basis', label: 'Основание', type: 'text', placeholder: 'Оплата по счёту №5 от 01.05.2026 / возврат подотчётных средств', required: true },
          { key: 'purpose', label: 'Назначение / в том числе', type: 'text', placeholder: 'НДС — нет / НДС 20% — 2 500 ₽' },
          { key: 'attach', label: 'Приложение', type: 'text', placeholder: 'Квитанция, счёт №5, накладная' },
          { key: 'cashier', label: 'Кассир (ФИО)', type: 'text', placeholder: 'Сидорова Г.П.', required: true },
          { key: 'accountant', label: 'Гл. бухгалтер', type: 'text', placeholder: 'Сидорова Г.П.' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ПРИХОДНЫЙ КАССОВЫЙ ОРДЕР №${v.pko_num} от ${v.pko_date} по унифицированной форме КО-1 (Постановление Госкомстата №88) (не задавай вопросов, оформи полностью — включи основную часть и квитанцию к ПКО с линией отреза).
===ОРГАНИЗАЦИЯ===
${v.org_name}${v.org_inn?', ИНН/КПП '+v.org_inn:''}${v.struct_unit?', подразделение: '+v.struct_unit:''}
===РЕКВИЗИТЫ===
ПКО №${v.pko_num} от ${v.pko_date}
ДЕБЕТ: ${v.debit_acc||'50'} | КРЕДИТ: ${v.credit_acc||'—'}
СУММА: ${v.amount} ₽ (добавь прописью)
ПРИНЯТО ОТ: ${v.from_whom}
ОСНОВАНИЕ: ${v.basis}${v.purpose?'\nВ ТОМ ЧИСЛЕ: '+v.purpose:''}${v.attach?'\nПРИЛОЖЕНИЕ: '+v.attach:''}
КАССИР: ${v.cashier}${v.accountant?'\nГЛ. БУХГАЛТЕР: '+v.accountant:''}`,
    },

    /* 19. Расходный кассовый ордер (РКО) */
    {
      key: 'galina_rko', emoji: '💸', title: 'Расходный кассовый ордер (РКО)', docType: 'galina_doc',
      sections: [
        { heading: 'Организация', fields: [
          { key: 'org_name', label: 'Организация', type: 'text', placeholder: 'ООО «Ромашка»', required: true },
          { key: 'org_inn', label: 'ИНН / КПП', type: 'text', placeholder: '1650000000 / 165001001' },
          { key: 'struct_unit', label: 'Структурное подразделение', type: 'text', placeholder: 'Касса / Бухгалтерия' },
        ]},
        { heading: 'Реквизиты РКО', fields: [
          { key: 'rko_num', label: 'Номер РКО', type: 'text', placeholder: '1', required: true },
          { key: 'rko_date', label: 'Дата', type: 'date', required: true },
          { key: 'debit_acc', label: 'Дебет (счёт)', type: 'text', placeholder: '71 / 60 / 70' },
          { key: 'credit_acc', label: 'Кредит (счёт)', type: 'text', placeholder: '50 (касса)' },
          { key: 'amount', label: 'Сумма (₽)', type: 'text', placeholder: '10 000', required: true },
          { key: 'to_whom', label: 'Выдать', type: 'text', placeholder: 'Петрову Петру Петровичу / сотруднику ФИО', required: true },
          { key: 'w_passport', label: 'Паспорт получателя', type: 'text', placeholder: '4321 098765, выдан УМВД г. Казань 15.06.2018' },
          { key: 'basis', label: 'Основание', type: 'text', placeholder: 'Выдача под отчёт на хозяйственные нужды / зарплата / оплата поставщику', required: true },
          { key: 'attach', label: 'Приложение', type: 'text', placeholder: 'Заявление на выдачу под отчёт / ведомость' },
          { key: 'director', label: 'Директор', type: 'text', placeholder: 'Иванов И.И.', required: true },
          { key: 'cashier', label: 'Кассир', type: 'text', placeholder: 'Сидорова Г.П.', required: true },
          { key: 'accountant', label: 'Гл. бухгалтер', type: 'text', placeholder: 'Сидорова Г.П.' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ РАСХОДНЫЙ КАССОВЫЙ ОРДЕР №${v.rko_num} от ${v.rko_date} по унифицированной форме КО-2 (Постановление Госкомстата №88) (не задавай вопросов, оформи полностью как официальный документ со всеми строками формы, включая подпись получателя и кассира).
===ОРГАНИЗАЦИЯ===
${v.org_name}${v.org_inn?', ИНН/КПП '+v.org_inn:''}${v.struct_unit?', подразделение: '+v.struct_unit:''}
===РЕКВИЗИТЫ===
РКО №${v.rko_num} от ${v.rko_date}
ДЕБЕТ: ${v.debit_acc||'—'} | КРЕДИТ: ${v.credit_acc||'50'}
СУММА: ${v.amount} ₽ (добавь прописью)
ВЫДАТЬ: ${v.to_whom}${v.w_passport?'\nПАСПОРТ: '+v.w_passport:''}
ОСНОВАНИЕ: ${v.basis}${v.attach?'\nПРИЛОЖЕНИЕ: '+v.attach:''}
ДИРЕКТОР: ${v.director}
КАССИР: ${v.cashier}${v.accountant?'\nГЛ. БУХГАЛТЕР: '+v.accountant:''}`,
    },

    /* 20. Налоговая декларация 3-НДФЛ */
    {
      key: 'galina_ndfl3', emoji: '🏛️', title: 'Декларация 3-НДФЛ', docType: 'ndfl3',
      sections: [
        { heading: 'Налогоплательщик', fields: [
          { key: 'fio', label: 'ФИО', type: 'text', placeholder: 'Петров Пётр Петрович', required: true },
          { key: 'inn', label: 'ИНН', type: 'text', placeholder: '165012345678', required: true },
          { key: 'dob', label: 'Дата рождения', type: 'date', required: true },
          { key: 'passport', label: 'Паспорт (серия и номер)', type: 'text', placeholder: '4321 098765', required: true },
          { key: 'passport_by', label: 'Кем и когда выдан', type: 'text', placeholder: 'УМВД г. Казань, 15.06.2018' },
          { key: 'address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 5, кв. 12', required: true },
          { key: 'phone', label: 'Телефон', type: 'text', placeholder: '+7 900 000-00-00' },
          { key: 'oktmo', label: 'ОКТМО (по месту жительства)', type: 'text', placeholder: '92740000001' },
          { key: 'ifns', label: 'Инспекция ФНС (номер)', type: 'text', placeholder: 'ИФНС №14 по г. Набережные Челны', required: true },
        ]},
        { heading: 'Доходы', fields: [
          { key: 'year', label: 'Налоговый период (год)', type: 'text', placeholder: '2025', required: true },
          { key: 'income_type', label: 'Вид декларируемого дохода', type: 'select', options: ['Продажа имущества (квартира, дом, земля)', 'Продажа автомобиля', 'Сдача имущества в аренду', 'Доход от предпринимательской деятельности (ИП на ОСНО)', 'Дивиденды от иностранных компаний', 'Другой доход, с которого не удержан НДФЛ'], required: true },
          { key: 'income_amount', label: 'Сумма дохода (₽)', type: 'text', placeholder: '1 500 000', required: true },
          { key: 'expense_amount', label: 'Расходы / вычет (₽, если есть)', type: 'text', placeholder: '1 200 000 (стоимость покупки)' },
          { key: 'ndfl_withheld', label: 'Уже удержан НДФЛ налоговым агентом (₽)', type: 'text', placeholder: '0' },
        ]},
        { heading: 'Налоговые вычеты (опционально)', fields: [
          { key: 'deductions', label: 'Заявляемые вычеты', type: 'textarea', placeholder: 'Имущественный при покупке квартиры — 2 000 000 ₽ (код 311)\nСоциальный на лечение — 120 000 ₽ (код 319)\nПрофессиональный — фактически понесённые расходы' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ НАЛОГОВУЮ ДЕКЛАРАЦИЮ ПО ФОРМЕ 3-НДФЛ за ${v.year} год (не задавай вопросов; оформи с указанием всех заполняемых листов, строк и кодов по форме, утверждённой ФНС; приведи расчёт налоговой базы, суммы налога к уплате или возврату, перечень прилагаемых документов).
===НАЛОГОПЛАТЕЛЬЩИК===
ФИО: ${v.fio}
ИНН: ${v.inn}
Дата рождения: ${v.dob}
Паспорт: ${v.passport}, выдан ${v.passport_by||'—'}
Адрес: ${v.address}${v.phone?'\nТел.: '+v.phone:''}
ОКТМО: ${v.oktmo||'—'} | ИФНС: ${v.ifns}
===ДОХОДЫ===
ГОД: ${v.year}
ВИД ДОХОДА: ${v.income_type}
СУММА ДОХОДА: ${v.income_amount} ₽
РАСХОДЫ / ВЫЧЕТ: ${v.expense_amount||'нет'}
НДФЛ УДЕРЖАН АГЕНТОМ: ${v.ndfl_withheld||'0'} ₽
${v.deductions?'ВЫЧЕТЫ: '+v.deductions:''}`,
    },

  ],

  /* ── САША (мастер) ── */
  sasha: [
    {
      key: 'sasha_estimate', emoji: '🔧', title: 'Смета на ремонтные работы', docType: 'sasha_doc',
      sections: [
        { heading: 'Исполнитель', fields: [
          { key: 'master_name', label: 'ФИО мастера / организация', type: 'text', placeholder: 'ИП Александров А.А. / Мастер Саша', required: true },
          { key: 'master_phone', label: 'Телефон', type: 'text', placeholder: '+7 900 000-00-00', required: true },
        ]},
        { heading: 'Заказчик и объект', fields: [
          { key: 'client_name', label: 'ФИО заказчика', type: 'text', placeholder: 'Иванов Иван Иванович', required: true },
          { key: 'client_phone', label: 'Телефон заказчика', type: 'text', placeholder: '+7 900 111-11-11', required: true },
          { key: 'object', label: 'Адрес объекта', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 5, кв. 12', required: true },
          { key: 'object_type', label: 'Тип объекта', type: 'select', options: ['Квартира', 'Частный дом', 'Офис', 'Гараж', 'Другое'] },
        ]},
        { heading: 'Перечень работ', fields: [
          { key: 'works', label: 'Работы (описание, единица, кол-во, цена за ед.)', type: 'textarea', placeholder: 'Демонтаж старых обоев — 50 кв.м — 50 ₽/кв.м\nШпаклёвка стен — 50 кв.м — 250 ₽/кв.м\nПоклейка обоев — 50 кв.м — 300 ₽/кв.м\nПокраска потолков — 30 кв.м — 200 ₽/кв.м', required: true },
          { key: 'materials', label: 'Материалы (название, кол-во, цена)', type: 'textarea', placeholder: 'Обои 10 рулонов × 1 500 ₽ = 15 000 ₽\nКлей 5 кг × 400 ₽ = 2 000 ₽\nШпаклёвка 20 кг × 300 ₽ = 6 000 ₽' },
          { key: 'deadline', label: 'Срок выполнения', type: 'text', placeholder: '7 рабочих дней с даты подписания', required: true },
          { key: 'payment', label: 'Порядок оплаты', type: 'select', options: ['50% аванс, 50% по завершении', '100% по завершении', '100% предоплата'] },
          { key: 'date', label: 'Дата сметы', type: 'date' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ДЕТАЛЬНУЮ СМЕТУ НА РЕМОНТНЫЕ РАБОТЫ в табличном формате с итогами по работам, материалам и общей суммой (не задавай вопросов).
ИСПОЛНИТЕЛЬ: ${v.master_name}, тел. ${v.master_phone}
ЗАКАЗЧИК: ${v.client_name}, тел. ${v.client_phone}, объект: ${v.object}${v.object_type?' ('+v.object_type+')':''}
РАБОТЫ: ${v.works}
${v.materials?'МАТЕРИАЛЫ: '+v.materials:''}
СРОК: ${v.deadline} | ОПЛАТА: ${v.payment||'50% аванс'} | ДАТА: ${v.date||new Date().toLocaleDateString('ru-RU')}`,
    },
    {
      key: 'sasha_act', emoji: '✅', title: 'Акт выполненных работ (ремонт)', docType: 'sasha_doc',
      sections: [
        { heading: 'Стороны', fields: [
          { key: 'master_name', label: 'Исполнитель (ФИО / организация)', type: 'text', placeholder: 'ИП Александров А.А.', required: true },
          { key: 'master_phone', label: 'Телефон исполнителя', type: 'text', placeholder: '+7 900 000-00-00', required: true },
          { key: 'client_name', label: 'Заказчик (ФИО)', type: 'text', placeholder: 'Иванов Иван Иванович', required: true },
          { key: 'client_phone', label: 'Телефон заказчика', type: 'text', placeholder: '+7 900 111-11-11', required: true },
          { key: 'object', label: 'Адрес объекта', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 5, кв. 12', required: true },
        ]},
        { heading: 'Работы и оплата', fields: [
          { key: 'works', label: 'Перечень выполненных работ', type: 'textarea', placeholder: 'Поклейка обоев — 50 кв.м — 15 000 ₽\nПокраска потолков — 30 кв.м — 6 000 ₽', required: true },
          { key: 'total', label: 'Итоговая сумма (₽)', type: 'text', placeholder: '21 000', required: true },
          { key: 'contract_ref', label: 'Договор-основание', type: 'text', placeholder: 'Договор подряда от 01.05.2026' },
          { key: 'quality', label: 'Качество и претензии', type: 'select', options: ['Работы выполнены в полном объёме, претензий нет', 'Работы выполнены с замечаниями (описать ниже)'] },
          { key: 'remarks', label: 'Замечания (если есть)', type: 'textarea', placeholder: 'Замечания по качеству: …' },
          { key: 'date', label: 'Дата акта', type: 'date', required: true },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ АКТ ПРИЁМКИ ВЫПОЛНЕННЫХ РЕМОНТНЫХ РАБОТ (не задавай вопросов, оформи полностью как официальный документ с подписями).
ИСПОЛНИТЕЛЬ: ${v.master_name}, тел. ${v.master_phone}
ЗАКАЗЧИК: ${v.client_name}, тел. ${v.client_phone}, объект: ${v.object}
РАБОТЫ: ${v.works}
ИТОГО: ${v.total} ₽${v.contract_ref?'\nОСНОВАНИЕ: '+v.contract_ref:''}
${v.quality}${v.remarks?'\nЗАМЕЧАНИЯ: '+v.remarks:''}
ДАТА: ${v.date}`,
    },
  ],

  /* ── НАТАША (врач) ── */
  natasha: [
    {
      key: 'natasha_symptoms', emoji: '🩺', title: 'Дневник симптомов для врача', docType: 'natasha_doc',
      sections: [
        { heading: 'Пациент', fields: [
          { key: 'fio', label: 'ФИО', type: 'text', placeholder: 'Петрова Анна Ивановна', required: true },
          { key: 'dob', label: 'Дата рождения', type: 'date', required: true },
          { key: 'height_weight', label: 'Рост / Вес', type: 'text', placeholder: '168 см / 65 кг' },
          { key: 'chronic', label: 'Хронические заболевания', type: 'textarea', placeholder: 'Гипертония / сахарный диабет 2 типа / нет' },
          { key: 'meds', label: 'Принимаемые лекарства', type: 'textarea', placeholder: 'Лозартан 50 мг × 1 раз/день / нет' },
          { key: 'allergies', label: 'Аллергии', type: 'text', placeholder: 'Пенициллин / нет' },
        ]},
        { heading: 'Текущие жалобы', fields: [
          { key: 'main_complaint', label: 'Главная жалоба', type: 'text', placeholder: 'Боль в животе / головная боль / температура', required: true },
          { key: 'since_when', label: 'Когда началось', type: 'text', placeholder: '3 дня назад / с утра 10.05.2026', required: true },
          { key: 'description', label: 'Подробное описание симптомов', type: 'textarea', placeholder: 'Боль тупая, справа внизу, усиливается при ходьбе, температура 37.5, тошноты нет…', required: true },
          { key: 'intensity', label: 'Интенсивность боли/дискомфорта (от 1 до 10)', type: 'text', placeholder: '6 из 10' },
          { key: 'triggers', label: 'Что усиливает / ослабляет симптомы', type: 'textarea', placeholder: 'Усиливается при физической нагрузке / ослабляет ибупрофен' },
          { key: 'additional', label: 'Другие симптомы', type: 'textarea', placeholder: 'Слабость, потеря аппетита, нарушение сна…' },
          { key: 'prev_treatment', label: 'Что уже принимали / делали', type: 'textarea', placeholder: 'Ибупрофен 400 мг — частичное улучшение / ничего не принимал' },
        ]},
        { heading: 'Цель обращения', fields: [
          { key: 'goal', label: 'Цель визита к врачу', type: 'select', options: ['Установить диагноз', 'Получить лечение', 'Уточнить результаты анализов', 'Второе мнение', 'Профилактический осмотр'] },
          { key: 'questions', label: 'Вопросы для врача', type: 'textarea', placeholder: 'Нужно ли мне сдать анализы? Опасно ли это? Можно ли продолжать работать?' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ СТРУКТУРИРОВАННЫЙ ДНЕВНИК СИМПТОМОВ для предъявления врачу (оформи как медицинский документ для пациента, который удобно показать доктору на приёме. Включи: анамнез, жалобы, динамику, сопутствующие данные, список вопросов. Не задавай вопросов).
ПАЦИЕНТ: ${v.fio}, дата рождения ${v.dob}${v.height_weight?', '+v.height_weight:''}
ХРОНИЧЕСКИЕ ЗАБОЛЕВАНИЯ: ${v.chronic||'нет'} | ЛЕКАРСТВА: ${v.meds||'нет'} | АЛЛЕРГИИ: ${v.allergies||'нет'}
ЖАЛОБА: ${v.main_complaint} (с ${v.since_when})
ОПИСАНИЕ: ${v.description}
ИНТЕНСИВНОСТЬ: ${v.intensity||'не оценивал'}
ТРИГГЕРЫ: ${v.triggers||'не выявлены'}
ДОП. СИМПТОМЫ: ${v.additional||'нет'}
ЛЕЧЕНИЕ: ${v.prev_treatment||'не проводилось'}
ЦЕЛЬ: ${v.goal||'установить диагноз'}${v.questions?'\nВОПРОСЫ ВРАЧУ: '+v.questions:''}`,
    },
    {
      key: 'natasha_health', emoji: '📋', title: 'Карта здоровья (самоконтроль)', docType: 'natasha_doc',
      sections: [
        { heading: 'Личные данные', fields: [
          { key: 'fio', label: 'ФИО', type: 'text', placeholder: 'Петрова Анна Ивановна', required: true },
          { key: 'dob', label: 'Дата рождения', type: 'date', required: true },
          { key: 'blood_type', label: 'Группа крови / резус', type: 'text', placeholder: 'II (A) положительная' },
          { key: 'height_weight', label: 'Рост / Вес', type: 'text', placeholder: '168 см / 65 кг' },
        ]},
        { heading: 'Медицинская история', fields: [
          { key: 'diagnoses', label: 'Установленные диагнозы', type: 'textarea', placeholder: 'Гипертония I ст. / нет' },
          { key: 'operations', label: 'Операции / госпитализации', type: 'textarea', placeholder: 'Аппендэктомия 2018 г. / нет' },
          { key: 'allergies', label: 'Аллергии (препараты, продукты)', type: 'textarea', placeholder: 'Пенициллин — крапивница / нет' },
          { key: 'heredity', label: 'Наследственные заболевания', type: 'text', placeholder: 'Диабет у матери, гипертония у отца / нет' },
        ]},
        { heading: 'Текущее состояние', fields: [
          { key: 'meds', label: 'Постоянные лекарства', type: 'textarea', placeholder: 'Лозартан 50 мг 1 таб. утром' },
          { key: 'pressure', label: 'АД в покое (обычное)', type: 'text', placeholder: '120/80 мм рт.ст.' },
          { key: 'lifestyle', label: 'Образ жизни', type: 'textarea', placeholder: 'Не курю, алкоголь редко, спорт 2 раза/нед, работа сидячая' },
          { key: 'goals', label: 'Цели по здоровью', type: 'textarea', placeholder: 'Снизить вес на 5 кг, нормализовать давление, больше двигаться' },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ЛИЧНУЮ КАРТУ ЗДОРОВЬЯ для самоконтроля и визитов к врачу (оформи как структурированный медицинский паспорт пациента с разделами, удобный для хранения в телефоне или распечатки. Добавь рекомендации по мониторингу здоровья исходя из данных. Не задавай вопросов).
ПАЦИЕНТ: ${v.fio}, дата рождения ${v.dob}${v.blood_type?', группа крови: '+v.blood_type:''}${v.height_weight?', '+v.height_weight:''}
ДИАГНОЗЫ: ${v.diagnoses||'нет'} | ОПЕРАЦИИ: ${v.operations||'нет'}
АЛЛЕРГИИ: ${v.allergies||'нет'} | НАСЛЕДСТВЕННОСТЬ: ${v.heredity||'нет'}
ЛЕКАРСТВА: ${v.meds||'нет'} | АД: ${v.pressure||'не измерял'}
ОБРАЗ ЖИЗНИ: ${v.lifestyle||'не указан'}${v.goals?'\nЦЕЛИ: '+v.goals:''}`,
    },
  ],

  /* ── СВЕТА (педагог) ── */
  sveta: [
    {
      key: 'sveta_school', emoji: '🏫', title: 'Заявление в школу / детский сад', docType: 'sveta_doc',
      sections: [
        { heading: 'Куда подаётся', fields: [
          { key: 'institution', label: 'Название учреждения', type: 'text', placeholder: 'МБОУ «Средняя школа №57» г. Набережные Челны', required: true },
          { key: 'director', label: 'Директору / заведующей (ФИО)', type: 'text', placeholder: 'Директору Ивановой Ирине Ивановне', required: true },
          { key: 'type', label: 'Тип заявления', type: 'select', options: ['Зачисление в 1 класс', 'Зачисление в детский сад', 'Перевод из другой школы', 'Отчисление', 'Предоставление академического отпуска', 'Другое'], required: true },
        ]},
        { heading: 'Родитель / законный представитель', fields: [
          { key: 'parent_fio', label: 'ФИО родителя', type: 'text', placeholder: 'Петрова Анна Ивановна', required: true },
          { key: 'parent_passport', label: 'Паспорт (серия, номер)', type: 'text', placeholder: '1234 567890' },
          { key: 'parent_address', label: 'Адрес регистрации', type: 'text', placeholder: 'г. Набережные Челны, ул. Ленина, д. 1, кв. 1', required: true },
          { key: 'parent_phone', label: 'Телефон', type: 'text', placeholder: '+7 900 000-00-00', required: true },
        ]},
        { heading: 'Ребёнок', fields: [
          { key: 'child_fio', label: 'ФИО ребёнка', type: 'text', placeholder: 'Петрова Мария Алексеевна', required: true },
          { key: 'child_dob', label: 'Дата рождения', type: 'date', required: true },
          { key: 'child_birth_cert', label: 'Свидетельство о рождении / паспорт', type: 'text', placeholder: 'VII-КБ №123456 от 01.04.2018' },
          { key: 'class_grade', label: 'Класс / группа', type: 'text', placeholder: '1 «А» класс / средняя группа' },
          { key: 'request_text', label: 'Суть просьбы', type: 'textarea', placeholder: 'Прошу зачислить ребёнка в 1 класс с 01.09.2026 / прошу перевести в другую школу в связи со сменой места жительства' },
          { key: 'date', label: 'Дата заявления', type: 'date', required: true },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ОФИЦИАЛЬНОЕ ЗАЯВЛЕНИЕ в образовательное учреждение по нормам ФЗ «Об образовании в РФ» (не задавай вопросов, оформи полностью с шапкой и подписью).
КУДА: ${v.institution}, ${v.director}
ТИП: ${v.type}
РОДИТЕЛЬ: ${v.parent_fio}${v.parent_passport?', паспорт '+v.parent_passport:''}, адрес: ${v.parent_address}, тел. ${v.parent_phone}
РЕБЁНОК: ${v.child_fio}, дата рождения ${v.child_dob}${v.child_birth_cert?', документ: '+v.child_birth_cert:''}${v.class_grade?', '+v.class_grade:''}
СУТЬ: ${v.request_text||v.type}
ДАТА: ${v.date}`,
    },
    {
      key: 'sveta_ref', emoji: '🌟', title: 'Педагогическая характеристика', docType: 'sveta_doc',
      sections: [
        { heading: 'Составляет', fields: [
          { key: 'teacher_fio', label: 'ФИО педагога', type: 'text', placeholder: 'Светлана Васильевна Романова', required: true },
          { key: 'teacher_position', label: 'Должность', type: 'text', placeholder: 'Воспитатель / Классный руководитель 1 «А» класса', required: true },
          { key: 'institution', label: 'Учреждение', type: 'text', placeholder: 'МБДОУ «Детский сад №7» / МБОУ «СШ №57»', required: true },
        ]},
        { heading: 'Ребёнок', fields: [
          { key: 'child_fio', label: 'ФИО ребёнка', type: 'text', placeholder: 'Петрова Мария Алексеевна', required: true },
          { key: 'child_dob', label: 'Дата рождения', type: 'date', required: true },
          { key: 'group_class', label: 'Группа / класс', type: 'text', placeholder: '1 «А» класс / средняя группа' },
          { key: 'period', label: 'Период обучения / посещения', type: 'text', placeholder: 'с сентября 2024 по май 2026', required: true },
        ]},
        { heading: 'Характеристика', fields: [
          { key: 'family', label: 'Сведения о семье', type: 'textarea', placeholder: 'Воспитывается в полной / неполной семье, родители принимают участие в жизни ребёнка…' },
          { key: 'cognitive', label: 'Познавательное развитие', type: 'textarea', placeholder: 'Уровень выше среднего / соответствует возрасту, любознателен, охотно участвует в занятиях…', required: true },
          { key: 'emotional', label: 'Эмоциональное развитие / темперамент', type: 'textarea', placeholder: 'Спокойный, уравновешенный / активный, эмоциональный…', required: true },
          { key: 'social', label: 'Социальные навыки и поведение', type: 'textarea', placeholder: 'Легко устанавливает контакт со сверстниками, бесконфликтен, уважает взрослых…', required: true },
          { key: 'achievements', label: 'Достижения / особые способности', type: 'textarea', placeholder: 'Участник олимпиад, победитель конкурса рисования, занимается в спортивной секции…' },
          { key: 'difficulties', label: 'Трудности / особые потребности', type: 'textarea', placeholder: 'Требует дополнительного внимания при письме / логопедической коррекции' },
          { key: 'recommendations', label: 'Рекомендации', type: 'textarea', placeholder: 'Рекомендуется поощрять самостоятельность, продолжить занятия в кружках…' },
          { key: 'purpose', label: 'Куда выдаётся', type: 'text', placeholder: 'Для предъявления в ПМПК / новую школу / психологу / по месту требования', required: true },
          { key: 'date', label: 'Дата', type: 'date', required: true },
        ]},
      ],
      buildPrompt: v => `СОСТАВЬ ПЕДАГОГИЧЕСКУЮ ХАРАКТЕРИСТИКУ НА РЕБЁНКА (официальный документ по стандартам российского образования, не задавай вопросов, оформи полностью).
ПЕДАГОГ: ${v.teacher_fio}, ${v.teacher_position}, ${v.institution}
РЕБЁНОК: ${v.child_fio}, дата рождения ${v.child_dob}, ${v.group_class||''}, период ${v.period}
СЕМЬЯ: ${v.family||'не указано'}
ПОЗНАВАТЕЛЬНОЕ РАЗВИТИЕ: ${v.cognitive}
ЭМОЦИОНАЛЬНОЕ РАЗВИТИЕ: ${v.emotional}
СОЦИАЛЬНЫЕ НАВЫКИ: ${v.social}${v.achievements?'\nДОСТИЖЕНИЯ: '+v.achievements:''}${v.difficulties?'\nТРУДНОСТИ: '+v.difficulties:''}${v.recommendations?'\nРЕКОМЕНДАЦИИ: '+v.recommendations:''}
ВЫДАЁТСЯ: ${v.purpose} | ДАТА: ${v.date}`,
    },
  ],
};

interface DocOptions {
  stamp?: string | null;
  sig?: string | null;
  forWord?: boolean;
}

function parseTableRow(line: string): string[] {
  return line.replace(/^\|/, '').replace(/\|$/, '').split('|');
}

function renderInvoiceBody(answer: string, sig: string | null, stamp: string | null): string {
  const lines = answer.split('\n').map(l => l.trim());

  type Section = 'header' | 'seller' | 'buyer' | 'table' | 'totals' | 'footer';
  let section: Section = 'header';
  const headerLines: string[] = [];
  const sellerLines: string[] = [];
  const buyerLines: string[] = [];
  const tableRows: string[][] = [];
  const totalLines: string[] = [];
  const footerLines: string[] = [];

  for (const l of lines) {
    if (!l) continue;
    if (l === '===ПРОДАВЕЦ===')  { section = 'seller';  continue; }
    if (l === '===ПОКУПАТЕЛЬ===') { section = 'buyer';   continue; }
    if (l === '===ТАБЛИЦА===')   { section = 'table';   continue; }
    if (l === '===ИТОГО===')     { section = 'totals';  continue; }
    if (l === '===ПОДВАЛ===')    { section = 'footer';  continue; }

    if (section === 'header')  headerLines.push(l);
    else if (section === 'seller')  sellerLines.push(l);
    else if (section === 'buyer')   buyerLines.push(l);
    else if (section === 'table')   tableRows.push(parseTableRow(l));
    else if (section === 'totals')  totalLines.push(l);
    else if (section === 'footer')  footerLines.push(l);
  }

  const headerRow = tableRows[0] ?? [];
  const dataRows  = tableRows.slice(1);

  const theadHtml = headerRow.length
    ? `<thead><tr>${headerRow.map(c => `<th>${c.trim()}</th>`).join('')}</tr></thead>`
    : '';
  const tbodyHtml = dataRows.map(row =>
    `<tr>${row.map((c, i) => `<td style="text-align:${i >= 3 ? 'right' : 'left'}">${c.trim()}</td>`).join('')}</tr>`
  ).join('');

  const isTotalLine = (l: string) => /ИТОГО К ОПЛАТЕ|ИТОГО К ОПЛАТЕ/i.test(l);
  const isPropisyu = (l: string) => /ПРОПИСЬЮ/i.test(l);

  const totalsHtml = totalLines.map(l => {
    if (isTotalLine(l)) return `<p style="font-size:13pt;font-weight:bold;margin-top:4px">${l}</p>`;
    if (isPropisyu(l))  return `<p style="font-style:italic;color:#333">${l}</p>`;
    return `<p>${l}</p>`;
  }).join('');

  const sigHtml = (sig || stamp) ? `
<div style="margin-top:36px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px">
  <div style="flex:1">
    ${sig ? `<img src="${sig}" alt="Подпись" style="max-height:70px;max-width:200px;display:block;margin-bottom:4px">` : '<div style="border-bottom:1.5px solid #333;width:200px;margin-bottom:4px">&nbsp;</div>'}
    <div style="font-size:9pt;color:#555">Подпись / Signature</div>
  </div>
  <div style="flex:1;display:flex;justify-content:flex-end;align-items:flex-end">
    ${stamp ? `<img src="${stamp}" alt="Печать" style="max-height:105px;max-width:105px;opacity:0.82;transform:rotate(-12deg)">` : ''}
  </div>
</div>` : '';

  return `
<div style="font-size:13.5pt;font-weight:bold;text-align:center;letter-spacing:1px;margin-bottom:18px;border-bottom:2px solid #000;padding-bottom:8px">
  ${headerLines.join(' ')}
</div>

<table style="width:100%;border-collapse:collapse;margin-bottom:14px;font-size:10.5pt">
<colgroup><col style="width:50%"><col style="width:50%"></colgroup>
<tbody>
<tr>
<td style="vertical-align:top;padding-right:18px;border-right:1.5px solid #bbb">
  <div style="font-size:9pt;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#444;margin-bottom:6px;border-bottom:1px solid #ddd;padding-bottom:3px">Продавец (Поставщик)</div>
  ${sellerLines.map(l => `<div style="margin-bottom:3px">${l}</div>`).join('')}
</td>
<td style="vertical-align:top;padding-left:18px">
  <div style="font-size:9pt;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:#444;margin-bottom:6px;border-bottom:1px solid #ddd;padding-bottom:3px">Покупатель (Плательщик)</div>
  ${buyerLines.map(l => `<div style="margin-bottom:3px">${l}</div>`).join('')}
</td>
</tr>
</tbody>
</table>

${tableRows.length ? `
<table style="width:100%;border-collapse:collapse;font-size:10.5pt;margin-bottom:14px">
  ${theadHtml}
  <tbody>${tbodyHtml}</tbody>
</table>` : ''}

<div style="text-align:right;margin-bottom:10px;font-size:11pt">
  ${totalsHtml}
</div>

${footerLines.length ? `<div style="margin-top:14px;font-size:9.5pt;color:#444;border-top:1px solid #ccc;padding-top:8px">
  ${footerLines.map(l => `<p style="margin-bottom:4px">${l}</p>`).join('')}
</div>` : ''}

${sigHtml}`;
}

function buildDocumentHtml(a: Answer, q: string, opts: DocOptions = {}): string {
  const { stamp, sig, forWord = false } = opts;
  const docTitle = a.docType ? (DOC_TITLES[a.docType] ?? 'ДОКУМЕНТ') : 'ДОКУМЕНТ';
  const today = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });

  const isInvoice = a.docType === 'invoice';
  const lines = a.answer.split('\n').map(l => l.trim()).filter(Boolean);

  const sigBlock = (!isInvoice && (sig || stamp)) ? `
<div style="margin-top:40px;display:flex;justify-content:space-between;align-items:flex-end;gap:20px">
  <div style="flex:1">
    ${sig ? `<img src="${sig}" alt="Подпись" style="max-height:75px;max-width:220px;display:block;margin-bottom:4px">` : '<div style="border-bottom:1px solid #333;width:200px;margin-bottom:4px">&nbsp;</div>'}
    <div style="font-size:9pt;color:#555">Подпись / Signature</div>
  </div>
  <div style="flex:1;display:flex;justify-content:flex-end;align-items:flex-end">
    ${stamp ? `<img src="${stamp}" alt="Печать" style="max-height:110px;max-width:110px;opacity:0.82;transform:rotate(-12deg)">` : ''}
  </div>
</div>` : '';

  const wordMeta = forWord ? `
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="Microsoft Word 15">
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->` : '';

  const htmlTag = forWord
    ? `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" lang="ru">`
    : `<html lang="ru">`;

  const bodyContent = isInvoice
    ? renderInvoiceBody(a.answer, sig ?? null, stamp ?? null)
    : `<div class="body">${lines.map(l => `<p>${l}</p>`).join('')}</div>${sigBlock}`;

  return `<!DOCTYPE html>${htmlTag}<head><meta charset="utf-8">${wordMeta}<title>${docTitle}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Times New Roman',serif;font-size:11pt;color:#000;padding:16mm 20mm;line-height:1.6}
.hdr{text-align:center;border-bottom:2.5px solid #2d1b6b;padding-bottom:12px;margin-bottom:16px}
.hdr .brand{font-size:8pt;color:#5c35cc;letter-spacing:1.5px;margin-bottom:4px;text-transform:uppercase}
.hdr .title{font-size:15pt;font-weight:bold;letter-spacing:3px;text-transform:uppercase}
.hdr .date{font-size:9pt;color:#555;margin-top:4px}
.req{margin:12px 0;padding:8px 12px;background:#f5f0ff;border-left:4px solid #5c35cc;font-size:10pt;color:#333;font-style:italic}
.body p{margin-bottom:8px;font-size:11pt}
table thead tr th{background:#2d1b6b;color:#fff;padding:6px 8px;text-align:left;font-size:9.5pt;font-weight:700;border:1px solid #2d1b6b}
table tbody tr td{padding:5px 8px;border:1px solid #bbb;font-size:10pt;vertical-align:middle}
table tbody tr:nth-child(even) td{background:#f7f5ff}
.ftr{margin-top:20px;padding-top:10px;border-top:1px solid #bbb;font-size:8pt;color:#888;text-align:center}
@page{margin:10mm}@media print{body{padding:0}}
</style>
</head><body>
<div class="hdr">
  <div class="brand">ВИРТУАЛЬНЫЙ БУХГАЛТЕР ГАЛИНА · ЭКОСИСТЕМА SWAIP</div>
  ${!isInvoice ? `<div class="title">${docTitle}</div>` : ''}
  <div class="date">Дата составления: ${today}</div>
</div>
${q && !isInvoice ? `<div class="req">Запрос: ${q}</div>` : ''}
${bodyContent}
<div class="ftr">Документ подготовлен виртуальным бухгалтером Галиной · Экосистема SWAIP · Набережные Челны<br>Рекомендуется проверка сертифицированным бухгалтером перед использованием</div>
</body></html>`;
}

function buildIgorDocumentHtml(a: Answer, opts: { sig?: string | null; forWord?: boolean } = {}): string {
  const { sig, forWord = false } = opts;
  const docTitle = a.docType ? (IGOR_DOC_TITLES[a.docType] ?? 'ЮРИДИЧЕСКИЙ ДОКУМЕНТ') : 'ЮРИДИЧЕСКИЙ ДОКУМЕНТ';
  const today = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });

  const lines = a.answer.split('\n').map(l => l.trim()).filter(Boolean);

  const sigBlock = sig ? `
<div style="margin-top:52px;display:inline-block">
  <img src="${sig}" alt="Подпись" style="max-height:72px;max-width:220px;display:block;margin-bottom:4px">
  <div style="border-top:1.5px solid #333;width:220px;padding-top:4px;font-size:9pt;color:#444">Подпись / Дата: ________________</div>
</div>` : `
<div style="margin-top:52px">
  <div style="display:inline-block;border-bottom:1.5px solid #333;width:240px;margin-bottom:4px">&nbsp;</div>
  <div style="font-size:9pt;color:#444">Подпись / Дата: ________________</div>
</div>`;

  const wordMeta = forWord ? `
<meta name="ProgId" content="Word.Document">
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->` : '';

  const htmlTag = forWord
    ? `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40" lang="ru">`
    : `<html lang="ru">`;

  return `<!DOCTYPE html>${htmlTag}<head><meta charset="utf-8">${wordMeta}<title>${docTitle}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Times New Roman',serif;font-size:12pt;color:#000;padding:20mm 25mm;line-height:1.75}
.hdr{border-bottom:2px solid #0d1b2a;padding-bottom:14px;margin-bottom:22px;text-align:center}
.hdr .brand{font-size:8pt;color:#555;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px}
.hdr .title{font-size:16pt;font-weight:bold;letter-spacing:2px;text-transform:uppercase}
.hdr .date{font-size:10pt;color:#333;margin-top:6px}
p{margin-bottom:10px;font-size:12pt;text-align:justify}
.section{font-weight:bold;font-size:12pt;margin:18px 0 8px;border-bottom:1px solid #bbb;padding-bottom:3px;text-transform:uppercase;letter-spacing:0.5px}
.ftr{margin-top:36px;padding-top:10px;border-top:1px solid #bbb;font-size:8pt;color:#888;text-align:center}
@page{margin:15mm}@media print{body{padding:0}}
</style>
</head><body>
<div class="hdr">
  <div class="brand">АДВОКАТ ИГОРЬ · ЭКОСИСТЕМА SWAIP · Набережные Челны</div>
  <div class="title">${docTitle}</div>
  <div class="date">Дата составления: ${today}</div>
</div>
${lines.map(l => {
  if (/^(\d+\.\s|§\s|Статья\s|РАЗДЕЛ\s|Глава\s)/i.test(l) && l.length < 80) return `<p class="section">${l}</p>`;
  return `<p>${l}</p>`;
}).join('')}
${sigBlock}
<div class="ftr">Документ подготовлен адвокатом Игорем · Экосистема SWAIP · Набережные Челны<br>Перед подписанием рекомендуется консультация практикующего юриста и нотариальное заверение (при необходимости)</div>
</body></html>`;
}

function SignaturePadModal({ onSave, onClose, headerGradient, accentColor }: {
  onSave: (dataUrl: string) => void;
  onClose: () => void;
  headerGradient: string;
  accentColor: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });
  const hasDrawnRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = Math.floor(rect.width  * devicePixelRatio);
    canvas.height = Math.floor(rect.height * devicePixelRatio);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    hasDrawnRef.current = true;
    lastPosRef.current = getPos(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const pos = getPos(e);
    ctx.strokeStyle = '#0d1b2a';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPosRef.current = pos;
  };

  const onPointerUp = () => { isDrawingRef.current = false; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    hasDrawnRef.current = false;
  };

  const save = () => {
    if (!hasDrawnRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL('image/png'));
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.72)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 20 }}
        style={{ width: '100%', maxWidth: 420, background: '#fff', borderRadius: 22, overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.45)' }}>
        <div style={{ padding: '14px 16px', background: headerGradient, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ color: '#fff', fontWeight: 900, fontSize: 14 }}>✍️ Нарисуйте свою подпись</div>
          <motion.button whileTap={{ scale: 0.88 }} onClick={onClose} style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</motion.button>
        </div>
        <div style={{ padding: '10px 16px 6px', fontSize: 10.5, color: '#666', textAlign: 'center', fontWeight: 600 }}>
          Рисуйте пальцем или стилусом · подпись сохранится в браузере
        </div>
        <div style={{ margin: '4px 14px 0', borderRadius: 12, overflow: 'hidden', border: `2px solid ${accentColor}`, background: '#fff' }}>
          <canvas
            ref={canvasRef}
            style={{ display: 'block', width: '100%', height: 150, touchAction: 'none', cursor: 'crosshair' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          />
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '10px 14px 16px' }}>
          <motion.button whileTap={{ scale: 0.95 }} onClick={clearCanvas}
            style={{ flex: 1, padding: '11px 0', borderRadius: 13, background: '#f5f5f5', border: '1px solid #ddd', color: '#555', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif' }}>
            🗑 Очистить
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={save}
            style={{ flex: 2, padding: '11px 0', borderRadius: 13, background: headerGradient, border: 'none', color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer', fontFamily: '"Montserrat",sans-serif' }}>
            ✅ Сохранить подпись
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

/* ── DocumentFormModal ── */
function DocumentFormModal({ config, onSubmit, onClose, headerGradient, accentColor, inputBorder }: {
  config: IgorDocFormConfig;
  onSubmit: (prompt: string) => void;
  onClose: () => void;
  headerGradient: string;
  accentColor: string;
  inputBorder: string;
}) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const set = (key: string, val: string) => {
    setVals(v => ({ ...v, [key]: val }));
    if (val.trim()) setErrors(e => ({ ...e, [key]: false }));
  };

  const submit = () => {
    const newErr: Record<string, boolean> = {};
    let hasErr = false;
    for (const sec of config.sections) {
      for (const f of sec.fields) {
        if (f.required && !(vals[f.key]||'').trim()) {
          newErr[f.key] = true;
          hasErr = true;
        }
      }
    }
    if (hasErr) { setErrors(newErr); return; }
    onSubmit(config.buildPrompt(vals));
  };

  const fieldStyle = (key: string): React.CSSProperties => ({
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: `1.5px solid ${errors[key] ? '#e53935' : inputBorder}`,
    background: errors[key] ? '#fff5f5' : '#fff',
    fontSize: 13,
    color: '#1a1209',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: '"Montserrat",sans-serif',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.75)', display: 'flex', flexDirection: 'column' }}>
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 26, stiffness: 280 }}
        style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: '#fdf8ee' }}>

        {/* Header */}
        <div style={{ background: headerGradient, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ fontSize: 22 }}>{config.emoji}</div>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#fff', fontWeight: 900, fontSize: 15, lineHeight: 1.2 }}>{config.title}</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 10, marginTop: 2 }}>Заполните все обязательные поля и нажмите «Создать документ»</div>
          </div>
          <motion.button whileTap={{ scale: 0.88 }} onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.18)', border: 'none', color: '#fff', borderRadius: '50%', width: 32, height: 32, fontSize: 15, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            ✕
          </motion.button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 0' }}>
          {config.sections.map(sec => (
            <div key={sec.heading} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: accentColor, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10, paddingBottom: 5, borderBottom: `1.5px solid ${inputBorder}` }}>
                {sec.heading}
              </div>
              {sec.fields.map(f => (
                <div key={f.key} style={{ marginBottom: 10 }}>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: accentColor, marginBottom: 4 }}>
                    {f.label}{f.required && <span style={{ color: '#e53935', marginLeft: 3 }}>*</span>}
                  </label>
                  {f.type === 'textarea' ? (
                    <textarea
                      value={vals[f.key] || ''}
                      onChange={e => set(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      rows={3}
                      style={{ ...fieldStyle(f.key), resize: 'vertical' as const, lineHeight: 1.5 }}
                    />
                  ) : f.type === 'select' ? (
                    <select
                      value={vals[f.key] || ''}
                      onChange={e => set(f.key, e.target.value)}
                      style={{ ...fieldStyle(f.key), appearance: 'auto' as const }}>
                      <option value="">— выберите —</option>
                      {(f.options||[]).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={f.type === 'date' ? 'date' : 'text'}
                      value={vals[f.key] || ''}
                      onChange={e => set(f.key, e.target.value)}
                      placeholder={f.placeholder}
                      style={fieldStyle(f.key)}
                    />
                  )}
                  {errors[f.key] && <div style={{ fontSize: 9.5, color: '#e53935', marginTop: 3, fontWeight: 700 }}>⚠ Обязательное поле</div>}
                  {f.hint && <div style={{ fontSize: 9.5, color: '#888', marginTop: 3 }}>{f.hint}</div>}
                </div>
              ))}
            </div>
          ))}
          {/* bottom padding for submit button */}
          <div style={{ height: 90 }} />
        </div>

        {/* Sticky submit */}
        <div style={{ padding: '12px 14px', background: '#fdf8ee', borderTop: `1.5px solid ${inputBorder}`, flexShrink: 0 }}>
          <motion.button whileTap={{ scale: 0.97 }} onClick={submit}
            style={{ width: '100%', padding: '15px 0', borderRadius: 16, background: headerGradient, border: 'none', color: '#fff', fontSize: 15, fontWeight: 900, cursor: 'pointer', letterSpacing: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <span>📄</span>
            <span>Создать документ</span>
          </motion.button>
          <div style={{ fontSize: 9, color: accentColor, textAlign: 'center', marginTop: 6, opacity: 0.6, fontWeight: 600 }}>
            Поля со * обязательны · документ будет составлен полностью
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ── Generic document HTML builder (for non-Igor, non-Galina specialists) ── */
function buildGenericDocHtml(content: string, title: string, specialistName: string): string {
  const date = new Date().toLocaleDateString('ru-RU');
  const lines = content.split('\n');
  const bodyHtml = lines.map(line => {
    const t = line.trim();
    if (!t) return '<br>';
    if (/^#{1,3}\s/.test(t)) return `<p style="font-size:15px;font-weight:800;margin:14px 0 5px">${t.replace(/^#{1,3}\s/, '')}</p>`;
    if (t.startsWith('**') && t.endsWith('**')) return `<p style="font-weight:700;margin:10px 0 4px">${t.replace(/\*\*/g, '')}</p>`;
    if (/^[А-ЯA-Z\s\d:—–\-\.\/«»"]{6,}$/.test(t) && t.length < 80) return `<p style="font-weight:700;margin:12px 0 4px">${t}</p>`;
    if (t.startsWith('- ') || t.startsWith('• ')) return `<p style="margin:3px 0 3px 16px">• ${t.slice(2)}</p>`;
    if (/^\d+[\.\)]\s/.test(t)) return `<p style="margin:3px 0">${t}</p>`;
    return `<p style="margin:4px 0">${t}</p>`;
  }).join('');
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>${title}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;margin:40px 60px;line-height:1.72}
  .header{text-align:center;margin-bottom:24px;padding-bottom:14px;border-bottom:2px solid #333}
  .sp{font-size:10px;color:#888;margin-bottom:6px;text-transform:uppercase;letter-spacing:1px}
  .title{font-size:18px;font-weight:800;margin-bottom:4px}
  .date{font-size:10px;color:#aaa}
  .footer{margin-top:44px;padding-top:12px;border-top:1px solid #ddd;font-size:10px;color:#bbb;text-align:center}
  @media print{body{margin:20px 40px}}
</style></head><body>
<div class="header">
  <div class="sp">${specialistName} · SWAIP</div>
  <div class="title">${title}</div>
  <div class="date">${date}</div>
</div>
<div>${bodyHtml}</div>
<div class="footer">Составлено с помощью ${specialistName} · SWAIP · ${date}</div>
</body></html>`;
}

interface AssistantScreenProps {
  specialist: Specialist;
  onBack: () => void;
  savedState?: ConvState | null;
  onStateChange?: (s: ConvState) => void;
}

function NotebookLines() {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} preserveAspectRatio="none">
      <defs>
        <pattern id="nb" x="0" y="0" width="100%" height="36" patternUnits="userSpaceOnUse">
          <line x1="0" y1="35" x2="100%" y2="35" stroke="#b8d4f0" strokeWidth="1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#nb)"/>
      <line x1="66" y1="0" x2="66" y2="100%" stroke="#ff8a80" strokeWidth="1.5" opacity="0.7"/>
    </svg>
  );
}

function LegalLines() {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} preserveAspectRatio="none">
      <defs>
        <pattern id="lg" x="0" y="0" width="100%" height="32" patternUnits="userSpaceOnUse">
          <line x1="0" y1="31" x2="100%" y2="31" stroke="#d4c18a" strokeWidth="0.7" opacity="0.5"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#lg)"/>
    </svg>
  );
}

function FishingScene() {
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b3e5fc" stopOpacity="0.55"/>
          <stop offset="100%" stopColor="#e8f5e9" stopOpacity="0.3"/>
        </linearGradient>
        <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#81c784" stopOpacity="0.22"/>
          <stop offset="100%" stopColor="#388e3c" stopOpacity="0.14"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#sky)"/>
      <ellipse cx="88%" cy="14%" rx="9%" ry="5%" fill="#fff9" opacity="0.35"/>
      <ellipse cx="75%" cy="18%" rx="6%" ry="3.5%" fill="#fff9" opacity="0.25"/>
      <circle cx="91%" cy="10%" r="4%" fill="#fffde7" opacity="0.45"/>
      <rect y="62%" width="100%" height="38%" fill="url(#water)"/>
      {[0,14,28,42,56,70,84,98].map((x, i) => (
        <ellipse key={i} cx={`${x}%`} cy={`${65 + (i % 3)}%`} rx="7%" ry="0.8%" fill="#4caf5055" opacity="0.4"/>
      ))}
      <rect x="5%" y="42%" width="2.5%" height="22%" rx="1.2%" fill="#5d4037" opacity="0.6"/>
      <polygon points="5%,42% 8.5%,42% 6.5%,30%" fill="#388e3c" opacity="0.65"/>
      <line x1="7%" y1="42%" x2="55%" y2="59%" stroke="#795548" strokeWidth="1" opacity="0.55"/>
      <circle cx="55%" cy="59.5%" r="1.2%" fill="#ef5350" opacity="0.85"/>
      <circle cx="55%" cy="60.7%" r="1.2%" fill="#fff" opacity="0.82"/>
      <rect x="8%" y="58%" width="1.5%" height="6%" rx="0.7%" fill="#33691e" opacity="0.75"/>
      <rect x="8%" y="54%" width="1%" height="9%" rx="0.5%" fill="#33691e" opacity="0.65"/>
      <rect x="10%" y="60%" width="1.2%" height="5%" rx="0.6%" fill="#2e7d32" opacity="0.7"/>
      <rect x="92%" y="52%" width="1.5%" height="10%" rx="0.7%" fill="#33691e" opacity="0.7"/>
      <rect x="93.5%" y="55%" width="1%" height="8%" rx="0.5%" fill="#388e3c" opacity="0.65"/>
      <circle cx="25%" cy="65%" r="0.8%" fill="#388e3c" opacity="0.55"/>
      <circle cx="72%" cy="64%" r="0.9%" fill="#388e3c" opacity="0.5"/>
    </svg>
  );
}

function BobberButton({ onClick, disabled, children, sinking }: { onClick: () => void; disabled?: boolean; children: React.ReactNode; sinking?: boolean }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      animate={sinking ? { y: [0, 4, 0] } : {}}
      transition={{ duration: 0.4, ease: 'easeInOut' }}
      whileTap={{ scale: 0.9, y: 4 }}
      style={{
        width: 48, height: 48, borderRadius: '50%',
        background: disabled ? '#ccc' : 'linear-gradient(180deg,#ef5350 50%,#fff 50%)',
        border: '3px solid #b71c1c',
        boxShadow: disabled ? 'none' : '0 4px 12px rgba(239,83,80,0.4), inset 0 -2px 4px rgba(0,0,0,0.15)',
        color: '#1a3a1a', fontSize: 20, cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, outline: 'none',
      }}>
      {children}
    </motion.button>
  );
}

function useNatureAmbient(active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);

  useEffect(() => {
    if (!active) {
      gainRef.current?.gain.setTargetAtTime(0, gainRef.current.context.currentTime, 0.5);
      return;
    }
    try {
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 2);
      masterGain.connect(ctx.destination);
      gainRef.current = masterGain;

      const bufferSize = ctx.sampleRate * 3;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 400;
      filter.Q.value = 0.3;

      const filter2 = ctx.createBiquadFilter();
      filter2.type = 'lowpass';
      filter2.frequency.value = 800;

      noise.connect(filter);
      filter.connect(filter2);
      filter2.connect(masterGain);
      noise.start();
      nodesRef.current = [noise, filter, filter2];
    } catch {
      /* silent */
    }
    return () => {
      try { ctxRef.current?.close(); } catch { /* */ }
      ctxRef.current = null;
    };
  }, [active]);
}

function WaveBar({ color }: { color: string }) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
      {[0,1,2,3,4,5,6].map(i => (
        <motion.div key={i}
          animate={{ scaleY: [0.4,1.8,0.6,2,0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i*0.1, ease: 'easeInOut' }}
          style={{ width: 3, height: 16, borderRadius: 2, background: color, transformOrigin: 'bottom' }} />
      ))}
    </div>
  );
}

function getSupportedMimeType(): string {
  const types = ['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

export default function AssistantScreen({ specialist: sp, onBack, savedState, onStateChange }: AssistantScreenProps) {
  const isRestored = useRef(false);
  const greetingFired = useRef(false);

  const [inputText, setInputText] = useState('');
  const [thinking, setThinking] = useState(false);
  const [answer, setAnswer] = useState<Answer | null>(savedState?.answer ?? null);
  const [question, setQuestion] = useState(savedState?.question ?? '');
  const [error, setError] = useState('');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  const [playing, setPlaying] = useState(false);
  const [speakLoading, setSpeakLoading] = useState(false);
  const [audioReady, setAudioReady] = useState(false);

  /* Mic state */
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [pendingTranscript, setPendingTranscript] = useState<string | null>(null);

  /* Greeting state */
  const [greetingPlaying, setGreetingPlaying] = useState(false);

  /* ── Galina: multiple stamps & signatures (persisted in localStorage) ── */
  const loadSeals = (key: string): SealItem[] => { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; } };
  const [stamps, setStamps] = useState<SealItem[]>(() => loadSeals('galina_stamps'));
  const [sigs,   setSigs]   = useState<SealItem[]>(() => loadSeals('galina_sigs'));
  const [activeStampId, setActiveStampId] = useState<string | null>(() => localStorage.getItem('galina_active_stamp'));
  const [activeSigId,   setActiveSigId]   = useState<string | null>(() => localStorage.getItem('galina_active_sig'));
  const [sealLoading, setSealLoading] = useState(false);
  const [showStampAdd, setShowStampAdd] = useState(false);
  const [showSigAdd,   setShowSigAdd]   = useState(false);
  const stampUpRef = useRef<HTMLInputElement>(null);
  const stampAiRef = useRef<HTMLInputElement>(null);
  const sigUpRef   = useRef<HTMLInputElement>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const igorScanFileRef = useRef<HTMLInputElement>(null);
  const igorScanCameraRef = useRef<HTMLInputElement>(null);
  const igorScanBwRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const greetAudioRef = useRef<HTMLAudioElement | null>(null);
  const greetAudioUrlRef = useRef<string | null>(null);
  const answerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  /* ── Generic doc form state (all non-Igor specialists) ── */
  const [genericDocFormKey, setGenericDocFormKey] = useState<string | null>(null);
  const [isDocFormAnswer, setIsDocFormAnswer] = useState(false);
  const [docFormTitle, setDocFormTitle] = useState('');

  /* ── Igor: signature + document form ── */
  const [igorSig, setIgorSig] = useState<string | null>(() => localStorage.getItem('igor_sig'));
  const [showIgorSigPad, setShowIgorSigPad] = useState(false);
  const [igorDocFormKey, setIgorDocFormKey] = useState<string | null>(null);

  const saveIgorSig = (dataUrl: string) => {
    setIgorSig(dataUrl);
    localStorage.setItem('igor_sig', dataUrl);
    setShowIgorSigPad(false);
  };
  const clearIgorSig = () => {
    setIgorSig(null);
    localStorage.removeItem('igor_sig');
  };

  const isPetya = sp.id === 'petya';
  const isIgor = sp.id === 'igor';
  const isGalina = sp.id === 'galina';
  const isDyadyaVanya = sp.id === 'dyadya_vanya';
  const specialistForms = SPECIALIST_DOC_FORMS[sp.id] ?? [];

  /* ── Generic download helpers ── */
  const downloadGenericPdf = useCallback(() => {
    if (!answer) return;
    const title = docFormTitle || answer.title || 'Документ';
    const html = buildGenericDocHtml(answer.answer, title, sp.name);
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
  }, [answer, docFormTitle, sp.name]);

  const downloadGenericWord = useCallback(() => {
    if (!answer) return;
    const title = docFormTitle || answer.title || 'Документ';
    const html = buildGenericDocHtml(answer.answer, title, sp.name);
    const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.doc`;
    a.click();
    URL.revokeObjectURL(url);
  }, [answer, docFormTitle, sp.name]);
  const answerFontSize = isPetya ? 21 : 15;
  const answerLineHeight = isPetya ? 1.72 : 1.8;
  const contentPadLeft = isPetya ? 80 : 20;

  useBackHandler(onBack);

  /* Load Caveat font for Petya */
  useEffect(() => {
    if (!isPetya || document.getElementById('caveat-font')) return;
    const link = document.createElement('link');
    link.id = 'caveat-font';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&display=swap';
    document.head.appendChild(link);
  }, [isPetya]);

  /* Stop audio on unmount */
  useEffect(() => {
    isRestored.current = !!savedState?.answer;
    return () => {
      audioRef.current?.pause();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      greetAudioRef.current?.pause();
      if (greetAudioUrlRef.current) URL.revokeObjectURL(greetAudioUrlRef.current);
      mediaRecorderRef.current?.stop();
    };
  }, []); // eslint-disable-line

  /* ── No auto voice greeting — greeting is shown as text only ── */

  /* Save state whenever answer or question changes */
  useEffect(() => {
    if (answer !== null || question) {
      onStateChange?.({ answer, question });
    }
  }, [answer, question]); // eslint-disable-line

  /* Scroll to answer (only for new answers, not restored) */
  useEffect(() => {
    if (answer && !isRestored.current && answerRef.current) {
      setTimeout(() => answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
    if (answer) isRestored.current = false;
  }, [answer]);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setError('');
    e.target.value = '';
  };

  /* ── Document scan processing ── */
  const applyScanFilter = useCallback((file: File, mode: 'color' | 'bw') => {
    setScanning(true);
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        /* Scale up for better quality — max 2400px on longest side */
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
          /* Color scan: high contrast + vivid colours + whiter background */
          ctx.filter = 'contrast(1.45) saturate(1.3) brightness(1.12)';
          ctx.drawImage(img, 0, 0, width, height);
        } else {
          /* B&W scan: greyscale + high contrast — classic document scanner */
          ctx.filter = 'grayscale(1) contrast(1.9) brightness(1.18)';
          ctx.drawImage(img, 0, 0, width, height);

          /* Second pass: pixel-level threshold to make text crisp */
          const imageData = ctx.getImageData(0, 0, width, height);
          const d = imageData.data;
          for (let i = 0; i < d.length; i += 4) {
            const v = d[i]; /* already grey after first pass */
            const out = v > 172 ? 255 : v < 80 ? 0 : v;
            d[i] = d[i + 1] = d[i + 2] = out;
          }
          ctx.putImageData(imageData, 0, 0);
        }

        canvas.toBlob(blob => {
          if (!blob) { setScanning(false); return; }
          const scanned = new File([blob], 'scan.jpg', { type: 'image/jpeg' });
          setImageFile(scanned);
          setImagePreview(canvas.toDataURL('image/jpeg', 0.95));
          setInputText('Извлеки все данные из этого документа и сообщи мне что ты видишь');
          setScanning(false);
        }, 'image/jpeg', 0.95);
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  /* ── TTS auto-speak ── */
  const speakAuto = useCallback(async (script: string, voice: string) => {
    setSpeakLoading(true);
    try {
      const resp = await fetch('/api/assistants/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: script, voice }),
      });
      if (!resp.ok) throw new Error('TTS error');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = url;
      setAudioReady(true);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlaying(false);
      audio.onerror = () => setPlaying(false);
      await audio.play();
      setPlaying(true);
    } catch {
      /* silent — user can replay */
    } finally {
      setSpeakLoading(false);
    }
  }, []);

  const replay = useCallback(async () => {
    if (speakLoading || !answer) return;
    if (audioUrlRef.current && audioRef.current) {
      audioRef.current.currentTime = 0;
      await audioRef.current.play();
      setPlaying(true);
      return;
    }
    speakAuto(answer.voiceScript, answer.voice);
  }, [answer, speakLoading, speakAuto]);

  const pauseAudio = () => { audioRef.current?.pause(); setPlaying(false); };

  /* ── Ask ── */
  const askWithText = useCallback(async (textOverride?: string) => {
    const q = (textOverride ?? inputText).trim();
    if (!q && !imageFile) return;
    setThinking(true);
    setAnswer(null);
    setQuestion(q);
    setError('');
    setAudioReady(false);
    setPlaying(false);
    setPendingTranscript(null);
    audioRef.current?.pause();
    isRestored.current = false;

    try {
      let imageBase64: string | undefined;
      let imageMime: string | undefined;
      if (imageFile) {
        imageMime = 'image/jpeg';
        imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onerror = reject;
          reader.onload = () => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
              const MAX = 2048;
              let { width, height } = img;
              if (width > MAX || height > MAX) {
                if (width > height) { height = Math.round(height * MAX / width); width = MAX; }
                else { width = Math.round(width * MAX / height); height = MAX; }
              }
              const canvas = document.createElement('canvas');
              canvas.width = width; canvas.height = height;
              const ctx = canvas.getContext('2d')!;
              ctx.drawImage(img, 0, 0, width, height);
              const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
              resolve(dataUrl.split(',')[1]);
            };
            img.src = reader.result as string;
          };
          reader.readAsDataURL(imageFile);
        });
      }

      const resp = await fetch('/api/assistants/solve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistantId: sp.id, text: q || undefined, imageBase64, imageMime }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data: Answer = await resp.json();
      setAnswer(data);
      speakAuto(data.voiceScript, data.voice ?? sp.voice);
    } catch {
      setError('Не удалось получить ответ. Проверь соединение.');
    } finally {
      setThinking(false);
      setInputText('');
      removeImage();
    }
  }, [inputText, imageFile, sp.id, sp.voice, speakAuto]);

  const ask = useCallback(() => askWithText(), [askWithText]);

  /* ── Clear ── */
  const clear = () => {
    setAnswer(null);
    setQuestion('');
    setInputText('');
    setPendingTranscript(null);
    removeImage();
    setAudioReady(false);
    setPlaying(false);
    setError('');
    setIsDocFormAnswer(false);
    setDocFormTitle('');
    audioRef.current?.pause();
    audioUrlRef.current = null;
    onStateChange?.({ answer: null, question: '' });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); }
  };

  /* ── Voice recording ── */
  const startRecording = async () => {
    setPendingTranscript(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = mr;
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        setTranscribing(true);
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        await transcribeBlob(blob);
      };
      mr.start();
      setIsRecording(true);
    } catch {
      setError('Нет доступа к микрофону. Разреши в настройках браузера.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const transcribeBlob = async (blob: Blob) => {
    try {
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      const resp = await fetch('/api/assistants/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: base64 }),
      });
      if (!resp.ok) throw new Error('STT error');
      const { text } = await resp.json();
      if (text) {
        setPendingTranscript(text);
      }
    } catch {
      setError('Не удалось распознать речь. Попробуй снова.');
    } finally {
      setTranscribing(false);
    }
  };

  const handleMicButton = () => {
    if (isRecording) stopRecording();
    else startRecording();
  };

  const sendPendingTranscript = () => {
    if (!pendingTranscript) return;
    askWithText(pendingTranscript);
  };

  const editPendingTranscript = () => {
    if (!pendingTranscript) return;
    setInputText(pendingTranscript);
    setPendingTranscript(null);
    setTimeout(() => textareaRef.current?.focus(), 80);
  };

  /* ── Galina: seal helpers ── */
  const saveStamps = (arr: SealItem[]) => { setStamps(arr); localStorage.setItem('galina_stamps', JSON.stringify(arr)); };
  const saveSigs   = (arr: SealItem[]) => { setSigs(arr);   localStorage.setItem('galina_sigs',   JSON.stringify(arr)); };
  const setActiveStamp = (id: string | null) => { setActiveStampId(id); if (id) localStorage.setItem('galina_active_stamp', id); else localStorage.removeItem('galina_active_stamp'); };
  const setActiveSig   = (id: string | null) => { setActiveSigId(id);   if (id) localStorage.setItem('galina_active_sig',   id); else localStorage.removeItem('galina_active_sig'); };

  const addSig = (file: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const id = Date.now().toString();
      const item: SealItem = { id, name: 'Подпись', img: ev.target?.result as string, isGenerated: false };
      const updated = [...sigs, item].slice(-4);
      saveSigs(updated); setActiveSig(id); setShowSigAdd(false);
    };
    reader.readAsDataURL(file);
  };

  const addStampRaw = (file: File) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const id = Date.now().toString();
      const item: SealItem = { id, name: 'Печать', img: ev.target?.result as string, isGenerated: false };
      const updated = [...stamps, item].slice(-4);
      saveStamps(updated); setActiveStamp(id); setShowStampAdd(false);
    };
    reader.readAsDataURL(file);
  };

  const addStampAI = async (file: File) => {
    setSealLoading(true); setShowStampAdd(false);
    const reader = new FileReader();
    reader.onload = async ev => {
      const dataUrl = ev.target?.result as string;
      const base64  = dataUrl.split(',')[1];
      try {
        const resp = await fetch('/api/assistants/extract-stamp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64 }),
        });
        const info: StampInfo = resp.ok ? await resp.json() : {};
        const svgStr  = generateStampSvg(info);
        const svgUrl  = svgToDataUrl(svgStr);
        const id   = Date.now().toString();
        const name = [info.orgType, info.companyName].filter(Boolean).join(' ') || 'Печать';
        const item: SealItem = { id, name, img: svgUrl, isGenerated: true };
        const updated = [...stamps, item].slice(-4);
        saveStamps(updated); setActiveStamp(id);
      } catch {
        addStampRaw(file);
      } finally { setSealLoading(false); }
    };
    reader.readAsDataURL(file);
  };

  const removeStamp = (id: string) => {
    const updated = stamps.filter(s => s.id !== id);
    saveStamps(updated);
    if (activeStampId === id) setActiveStamp(updated[0]?.id ?? null);
  };
  const removeSig = (id: string) => {
    const updated = sigs.filter(s => s.id !== id);
    saveSigs(updated);
    if (activeSigId === id) setActiveSig(updated[0]?.id ?? null);
  };

  const activeStamp = stamps.find(s => s.id === activeStampId)?.img ?? null;
  const activeSig   = sigs.find(s => s.id === activeSigId)?.img ?? null;

  /* ── PDF / Word generation (Galina only) ── */
  const downloadPdf = useCallback(() => {
    if (!answer) return;
    const html = buildDocumentHtml(answer, question, { stamp: activeStamp, sig: activeSig });
    const win = window.open('', '_blank', 'width=850,height=700');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }, [answer, question, activeStamp, activeSig]);

  const downloadWord = useCallback(() => {
    if (!answer) return;
    const html = buildDocumentHtml(answer, question, { stamp: activeStamp, sig: activeSig, forWord: true });
    const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const docTitle = answer.docType ? (DOC_TITLES[answer.docType] ?? docFormTitle ?? 'Документ') : (docFormTitle ?? 'Документ');
    a.href = url; a.download = `${docTitle}.doc`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [answer, question, activeStamp, activeSig, docFormTitle]);

  /* ── Igor: PDF / Word download ── */
  const downloadIgorPdf = useCallback(() => {
    if (!answer) return;
    const html = buildIgorDocumentHtml(answer, { sig: igorSig });
    const win = window.open('', '_blank', 'width=900,height=720');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }, [answer, igorSig]);

  const downloadIgorWord = useCallback(() => {
    if (!answer) return;
    const html = buildIgorDocumentHtml(answer, { sig: igorSig, forWord: true });
    const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    const docTitle = answer.docType ? (IGOR_DOC_TITLES[answer.docType] ?? 'Документ') : 'Документ';
    a.href = url; a.download = `${docTitle}.doc`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [answer, igorSig]);

  const canSend = !thinking && (!!inputText.trim() || !!imageFile);

  useNatureAmbient(isDyadyaVanya);

  const ContentBg = () => {
    if (isPetya) return <NotebookLines />;
    if (isIgor) return <LegalLines />;
    if (isDyadyaVanya) return <FishingScene />;
    return null;
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      display: 'flex', flexDirection: 'column',
      background: sp.contentBg, fontFamily: '"Montserrat",sans-serif',
    }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '44px 12px 12px',
        background: sp.headerGradient,
        flexShrink: 0, boxShadow: '0 2px 16px rgba(0,0,0,0.35)',
      }}>
        <motion.button whileTap={{ scale: 0.85 }} onClick={onBack}
          style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,0.13)', border: '1px solid rgba(255,255,255,0.22)', color: '#fff', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          ←
        </motion.button>

        <motion.div
          animate={thinking ? { rotate: [0,-10,10,-8,8,0] } : {}}
          transition={thinking ? { duration: 1, repeat: Infinity, repeatDelay: 0.5 } : {}}
          style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>
          {sp.emoji}
        </motion.div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase', color: sp.headerAccent, marginBottom: 1 }}>{sp.role}</div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sp.name}</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>
            {sp.tagline}
          </div>
        </div>

        {answer && (
          <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} whileTap={{ scale: 0.9 }}
            onClick={clear}
            style={{ padding: '5px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.11)', border: '1px solid rgba(255,255,255,0.22)', color: '#fff', fontSize: 10, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>
            🗑 Очистить
          </motion.button>
        )}
      </div>

      {/* ── Scroll area ── */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 210 }}>

        {/* Saved question label */}
        <AnimatePresence>
          {question && answer && (
            <motion.div key="qbadge" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{ margin: '14px 14px 0', padding: '8px 14px', borderRadius: 12, background: sp.accentBg, border: `1px solid ${sp.inputBorder}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 14 }}>💬</div>
              <div style={{ fontSize: 12, color: sp.answerColor, fontWeight: 600, lineHeight: 1.4, flex: 1 }}>{question}</div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={clear}
                style={{ fontSize: 11, fontWeight: 800, color: sp.accentColor, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, padding: '2px 6px' }}>
                ✕
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state / greeting */}
        <AnimatePresence>
          {!answer && !thinking && (
            <motion.div key="empty" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              style={{ margin: '18px 14px' }}>
              <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', boxShadow: `0 4px 24px ${sp.cardGlow}, 0 1px 6px rgba(0,0,0,0.08)`, border: `1px solid ${sp.inputBorder}` }}>
                <div style={{ background: sp.contentBg, padding: `20px 20px 20px ${contentPadLeft}px`, position: 'relative', minHeight: 130 }}>
                  <ContentBg />
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ fontFamily: sp.answerFont, fontSize: isPetya ? 21 : 19, lineHeight: 1.55, color: sp.answerColor, fontWeight: 600, whiteSpace: 'pre-line' }}>
                      {sp.greeting}
                    </div>
                  </div>
                </div>
                <div style={{ background: sp.accentBg, padding: '10px 14px', borderTop: `1px solid ${sp.inputBorder}` }}>
                  <div style={{ fontSize: 9, fontWeight: 800, color: sp.accentColor, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Примеры вопросов:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {sp.examples.map(ex => (
                      <motion.button key={ex} whileTap={{ scale: 0.97 }}
                        onClick={() => { setInputText(ex); textareaRef.current?.focus(); }}
                        style={{ padding: '7px 12px', borderRadius: 10, textAlign: 'left', background: '#fff', border: `1px solid ${sp.inputBorder}`, color: sp.answerColor, fontSize: 12, fontWeight: 600, cursor: 'pointer', lineHeight: 1.4 }}>
                        {ex}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Galina: stamps & signatures */}
                {isGalina && (
                  <div style={{ background: '#f0ebff', padding: '10px 14px', borderTop: `1px solid ${sp.inputBorder}` }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: sp.accentColor, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                      🔏 Печати и подписи для документов
                      {sealLoading && <span style={{ marginLeft: 8, color: '#7c4dff', fontWeight: 700 }}>⏳ Галина анализирует…</span>}
                    </div>

                    {/* STAMPS */}
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 9, color: sp.accentColor, fontWeight: 700, marginBottom: 5, letterSpacing: 0.5 }}>ПЕЧАТИ ({stamps.length}/4)</div>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        {stamps.map(s => (
                          <div key={s.id} onClick={() => setActiveStamp(s.id)}
                            style={{ position: 'relative', cursor: 'pointer', borderRadius: 10, border: `2px solid ${s.id === activeStampId ? sp.accentColor : sp.inputBorder}`, background: '#fff', padding: '5px 7px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 68, boxShadow: s.id === activeStampId ? `0 0 0 2px ${sp.accentColor}44` : 'none' }}>
                            <img src={s.img} alt={s.name} style={{ width: 48, height: 48, objectFit: 'contain', opacity: s.isGenerated ? 0.92 : 0.85 }} />
                            <div style={{ fontSize: 7.5, color: sp.accentColor, fontWeight: 700, textAlign: 'center', maxWidth: 66, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.isGenerated ? '🤖 ' : ''}{s.name.slice(0, 10)}</div>
                            {s.id === activeStampId && <div style={{ fontSize: 7, color: '#2d8a3e', fontWeight: 800 }}>✅ АКТИВНА</div>}
                            <motion.button whileTap={{ scale: 0.9 }} onClick={e => { e.stopPropagation(); removeStamp(s.id); }}
                              style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: '#ef5350', border: 'none', color: '#fff', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>✕</motion.button>
                          </div>
                        ))}
                        {stamps.length < 4 && (
                          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowStampAdd(v => !v)}
                            style={{ width: 68, minHeight: 68, borderRadius: 10, border: `2px dashed ${sp.inputBorder}`, background: '#fff', color: sp.accentColor, fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</motion.button>
                        )}
                      </div>
                      {showStampAdd && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          style={{ marginTop: 7, padding: '9px 10px', background: '#fff', borderRadius: 10, border: `1px solid ${sp.inputBorder}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <div style={{ fontSize: 9, color: sp.accentColor, fontWeight: 800, marginBottom: 2 }}>Добавить печать:</div>
                          <motion.button whileTap={{ scale: 0.95 }} onClick={() => stampAiRef.current?.click()}
                            style={{ padding: '8px 10px', borderRadius: 8, background: sp.headerGradient, border: 'none', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer', textAlign: 'left' }}>
                            🤖 Фото → Галина воссоздаст печать
                          </motion.button>
                          <div style={{ fontSize: 8.5, color: '#888', marginLeft: 2 }}>ИИ прочитает текст и нарисует аккуратный штамп</div>
                          <motion.button whileTap={{ scale: 0.95 }} onClick={() => stampUpRef.current?.click()}
                            style={{ padding: '8px 10px', borderRadius: 8, background: sp.accentBg, border: `1px solid ${sp.inputBorder}`, color: sp.answerColor, fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                            📂 Загрузить фото как есть
                          </motion.button>
                          <input ref={stampAiRef} type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) addStampAI(f); e.target.value = ''; }} style={{ display: 'none' }} />
                          <input ref={stampUpRef} type="file" accept="image/*"                     onChange={e => { const f = e.target.files?.[0]; if (f) addStampRaw(f); e.target.value = ''; }} style={{ display: 'none' }} />
                        </motion.div>
                      )}
                    </div>

                    {/* SIGNATURES */}
                    <div>
                      <div style={{ fontSize: 9, color: sp.accentColor, fontWeight: 700, marginBottom: 5, letterSpacing: 0.5 }}>ПОДПИСИ ({sigs.length}/4)</div>
                      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                        {sigs.map(s => (
                          <div key={s.id} onClick={() => setActiveSig(s.id)}
                            style={{ position: 'relative', cursor: 'pointer', borderRadius: 10, border: `2px solid ${s.id === activeSigId ? sp.accentColor : sp.inputBorder}`, background: '#fff', padding: '5px 7px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 68, boxShadow: s.id === activeSigId ? `0 0 0 2px ${sp.accentColor}44` : 'none' }}>
                            <img src={s.img} alt={s.name} style={{ width: 60, height: 36, objectFit: 'contain' }} />
                            <div style={{ fontSize: 7.5, color: sp.accentColor, fontWeight: 700 }}>{s.name.slice(0, 10)}</div>
                            {s.id === activeSigId && <div style={{ fontSize: 7, color: '#2d8a3e', fontWeight: 800 }}>✅ АКТИВНА</div>}
                            <motion.button whileTap={{ scale: 0.9 }} onClick={e => { e.stopPropagation(); removeSig(s.id); }}
                              style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: '#ef5350', border: 'none', color: '#fff', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900 }}>✕</motion.button>
                          </div>
                        ))}
                        {sigs.length < 4 && (
                          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowSigAdd(v => !v)}
                            style={{ width: 68, minHeight: 52, borderRadius: 10, border: `2px dashed ${sp.inputBorder}`, background: '#fff', color: sp.accentColor, fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</motion.button>
                        )}
                      </div>
                      {showSigAdd && (
                        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          style={{ marginTop: 7, padding: '9px 10px', background: '#fff', borderRadius: 10, border: `1px solid ${sp.inputBorder}` }}>
                          <div style={{ fontSize: 9, color: sp.accentColor, fontWeight: 800, marginBottom: 6 }}>Добавить подпись — сфотографируй или загрузи:</div>
                          <motion.button whileTap={{ scale: 0.95 }} onClick={() => sigUpRef.current?.click()}
                            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, background: sp.accentBg, border: `1px solid ${sp.inputBorder}`, color: sp.answerColor, fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'left' }}>
                            ✍️ Фото / файл подписи
                          </motion.button>
                          <div style={{ fontSize: 8.5, color: '#888', marginTop: 4 }}>Лучше — скан на белом фоне или PNG без фона</div>
                          <input ref={sigUpRef} type="file" accept="image/*" capture="environment" onChange={e => { const f = e.target.files?.[0]; if (f) addSig(f); e.target.value = ''; }} style={{ display: 'none' }} />
                        </motion.div>
                      )}
                    </div>

                    <div style={{ fontSize: 8.5, color: sp.accentColor, fontWeight: 600, opacity: 0.65, textAlign: 'center', marginTop: 8 }}>
                      Хранятся в браузере · Нажми на карточку чтобы выбрать активную
                    </div>
                  </div>
                )}

                {/* Specialist document form shortcuts (all specialists except Igor) */}
                {specialistForms.length > 0 && (
                  <div style={{ background: sp.accentBg, padding: '10px 14px', borderTop: `1px solid ${sp.inputBorder}` }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: sp.accentColor, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                      📄 Составить документ — выберите тип:
                    </div>
                    <div style={{ fontSize: 9, color: sp.accentColor, opacity: 0.7, marginBottom: 8, fontWeight: 600 }}>
                      Нажмите → заполните форму → документ готов (PDF / Word)
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {specialistForms.map(cfg => (
                        <motion.button key={cfg.key} whileTap={{ scale: 0.95 }}
                          onClick={() => setGenericDocFormKey(cfg.key)}
                          style={{ padding: '9px 10px', borderRadius: 10, textAlign: 'left', background: '#fff', border: `1.5px solid ${sp.inputBorder}`, color: sp.answerColor, fontSize: 11, fontWeight: 700, cursor: 'pointer', lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                          <span style={{ fontSize: 17 }}>{cfg.emoji}</span>
                          <span style={{ fontSize: 10.5 }}>{cfg.title}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Igor: document form shortcuts */}
                {isIgor && (
                  <div style={{ background: '#f5edcf', padding: '10px 14px', borderTop: `1px solid ${sp.inputBorder}` }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: sp.accentColor, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                      📄 Составить документ — выберите тип:
                    </div>
                    <div style={{ fontSize: 9, color: sp.accentColor, opacity: 0.7, marginBottom: 8, fontWeight: 600 }}>
                      Нажмите → заполните форму → документ готов
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {IGOR_FORM_CONFIGS.map(cfg => (
                        <motion.button key={cfg.key} whileTap={{ scale: 0.95 }}
                          onClick={() => setIgorDocFormKey(cfg.key)}
                          style={{ padding: '9px 10px', borderRadius: 10, textAlign: 'left', background: '#fff', border: `1.5px solid ${sp.inputBorder}`, color: sp.answerColor, fontSize: 11, fontWeight: 700, cursor: 'pointer', lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: 3, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
                          <span style={{ fontSize: 17 }}>{cfg.emoji}</span>
                          <span style={{ fontSize: 10.5 }}>{cfg.title}</span>
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Igor: scan document */}
                {isIgor && (
                  <div style={{ background: 'linear-gradient(135deg,#0d1b2a,#162032)', padding: '12px 14px', borderTop: `1px solid ${sp.inputBorder}`, position: 'relative', overflow: 'hidden' }}>

                    {/* Scanning animation overlay */}
                    <AnimatePresence>
                      {scanning && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                          style={{ position: 'absolute', inset: 0, background: 'rgba(9,9,15,0.92)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                          {/* Scan line sweeping down */}
                          <div style={{ position: 'relative', width: 120, height: 80, border: '2px solid #e8c97a', borderRadius: 6, overflow: 'hidden', background: 'rgba(0,0,0,0.4)' }}>
                            <motion.div
                              animate={{ y: [0, 76, 0] }}
                              transition={{ duration: 1.4, repeat: Infinity, ease: 'linear' }}
                              style={{ position: 'absolute', left: 0, right: 0, height: 3, background: 'linear-gradient(90deg, transparent, #e8c97a, transparent)', boxShadow: '0 0 8px #e8c97a' }} />
                          </div>
                          <div style={{ color: '#e8c97a', fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>Сканирую…</div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div style={{ fontSize: 9, fontWeight: 800, color: '#e8c97a', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>
                      📸 Скан документа
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(232,201,122,0.75)', marginBottom: 10, fontWeight: 600, lineHeight: 1.4 }}>
                      Паспорт, договор, решение суда, приказ, ПТС — извлеку все данные сам
                    </div>

                    {/* 3 buttons */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
                      <motion.button whileTap={{ scale: 0.95 }} disabled={scanning}
                        onClick={() => igorScanCameraRef.current?.click()}
                        style={{ padding: '11px 6px', borderRadius: 12, background: '#e8c97a', border: 'none', color: '#0d1b2a', fontSize: 11, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: scanning ? 0.5 : 1 }}>
                        🎨 Цветной скан
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.95 }} disabled={scanning}
                        onClick={() => igorScanBwRef.current?.click()}
                        style={{ padding: '11px 6px', borderRadius: 12, background: 'rgba(232,201,122,0.15)', border: '1.5px solid #e8c97a', color: '#e8c97a', fontSize: 11, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: scanning ? 0.5 : 1 }}>
                        🖤 Ч/Б скан
                      </motion.button>
                    </div>
                    <motion.button whileTap={{ scale: 0.95 }} disabled={scanning}
                      onClick={() => igorScanFileRef.current?.click()}
                      style={{ width: '100%', padding: '8px 6px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(232,201,122,0.35)', color: 'rgba(232,201,122,0.6)', fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, opacity: scanning ? 0.5 : 1 }}>
                      🖼 Прикрепить готовое фото из галереи (без обработки)
                    </motion.button>

                    {/* Hidden inputs */}
                    <input ref={igorScanCameraRef} type="file" accept="image/*" capture="environment"
                      onChange={e => { const f = e.target.files?.[0]; if (f) applyScanFilter(f, 'color'); e.target.value = ''; }}
                      style={{ display: 'none' }} />
                    <input ref={igorScanBwRef} type="file" accept="image/*" capture="environment"
                      onChange={e => { const f = e.target.files?.[0]; if (f) applyScanFilter(f, 'bw'); e.target.value = ''; }}
                      style={{ display: 'none' }} />
                    <input ref={igorScanFileRef} type="file" accept="image/*"
                      onChange={e => { const f = e.target.files?.[0]; if (f) { handleFile(e); setInputText('Извлеки все данные из этого документа и сообщи мне что ты видишь'); } e.target.value = ''; }}
                      style={{ display: 'none' }} />
                  </div>
                )}

                {/* Igor: signature section */}
                {isIgor && (
                  <div style={{ background: '#ede8d5', padding: '10px 14px', borderTop: `1px solid ${sp.inputBorder}` }}>
                    <div style={{ fontSize: 9, fontWeight: 800, color: sp.accentColor, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
                      ✍️ Ваша подпись для документов
                    </div>
                    {igorSig ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ background: '#fff', border: `1.5px solid ${sp.inputBorder}`, borderRadius: 10, padding: '6px 10px', flex: 1 }}>
                          <img src={igorSig} alt="Подпись" style={{ maxHeight: 48, maxWidth: 180, display: 'block', objectFit: 'contain' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <motion.button whileTap={{ scale: 0.93 }} onClick={() => setShowIgorSigPad(true)}
                            style={{ padding: '7px 12px', borderRadius: 9, background: sp.headerGradient, border: 'none', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                            ✏️ Изменить
                          </motion.button>
                          <motion.button whileTap={{ scale: 0.93 }} onClick={clearIgorSig}
                            style={{ padding: '7px 12px', borderRadius: 9, background: '#fff', border: `1px solid ${sp.inputBorder}`, color: '#c62828', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                            🗑 Удалить
                          </motion.button>
                        </div>
                      </div>
                    ) : (
                      <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowIgorSigPad(true)}
                        style={{ width: '100%', padding: '12px 10px', borderRadius: 12, background: sp.headerGradient, border: 'none', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        ✍️ Нарисовать подпись пальцем / мышью
                      </motion.button>
                    )}
                    <div style={{ fontSize: 8.5, color: sp.accentColor, marginTop: 6, opacity: 0.65, textAlign: 'center', fontWeight: 600 }}>
                      Подпись хранится в браузере · вставляется в документы при скачивании
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Thinking */}
        <AnimatePresence>
          {thinking && (
            <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ margin: '28px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <motion.div style={{ fontSize: 48 }}
                animate={{ scale: [1,1.1,1], rotate: [0,-5,5,0] }} transition={{ duration: 1.1, repeat: Infinity }}>
                {sp.emoji}
              </motion.div>
              <div style={{ position: 'relative', borderRadius: 16, overflow: 'hidden', width: '100%', maxWidth: 320 }}>
                <div style={{ background: sp.contentBg, padding: `18px 18px 18px ${contentPadLeft}px`, position: 'relative', minHeight: 80 }}>
                  <ContentBg />
                  <motion.div style={{ position: 'relative', zIndex: 1, fontFamily: sp.answerFont, fontSize: isPetya ? 19 : 14, color: sp.answerColor, fontWeight: 600 }}
                    animate={{ opacity: [1,0.35,1] }} transition={{ duration: 1.3, repeat: Infinity }}>
                    {sp.thinkingText}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Answer */}
        <AnimatePresence>
          {answer && (
            <motion.div key="answer" ref={answerRef}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', damping: 22 }}
              style={{ margin: '12px 12px' }}>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7, paddingLeft: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: 2, textTransform: 'uppercase', color: sp.accentColor, background: sp.accentBg, borderRadius: 8, padding: '3px 10px', border: `1px solid ${sp.inputBorder}` }}>
                  {sp.answerLabel}
                </div>
              </div>
              <div style={{ marginBottom: 7, paddingLeft: 5, fontSize: 13, fontWeight: 800, color: sp.answerColor }}>{answer.title}</div>

              <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', boxShadow: `0 6px 32px ${sp.cardGlow}, 0 2px 8px rgba(0,0,0,0.07)`, border: `1px solid ${sp.inputBorder}` }}>
                {(isPetya || isIgor) && (
                  <>
                    <div style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 28px 28px 0', borderColor: `transparent ${sp.accentBg} transparent transparent`, zIndex: 2 }} />
                    <div style={{ position: 'absolute', top: 1, right: 1, width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 26px 26px 0', borderColor: `transparent ${sp.contentBg} transparent transparent`, zIndex: 3 }} />
                  </>
                )}

                <div style={{ background: sp.contentBg, padding: `18px 16px 22px ${contentPadLeft}px`, position: 'relative', minHeight: 140 }}>
                  <ContentBg />
                  {isPetya && (
                    <div style={{ position: 'absolute', left: 0, top: 0, width: 66, height: '100%', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 18, zIndex: 1 }}>
                      <span style={{ fontSize: 16, transform: 'rotate(-90deg)', transformOrigin: 'center' }}>✏️</span>
                    </div>
                  )}
                  {isIgor && (
                    <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 7, background: sp.accentColor, zIndex: 1 }} />
                  )}
                  <div style={{ position: 'relative', zIndex: 1, fontFamily: sp.answerFont, fontSize: answerFontSize, lineHeight: answerLineHeight, color: sp.answerColor, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontWeight: isPetya ? 400 : isIgor ? 400 : 500 }}>
                    {answer.answer}
                  </div>
                </div>

                {/* Voice bar */}
                <div style={{ background: sp.headerGradient, padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                  {speakLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                      <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-block', fontSize: 16 }}>⏳</motion.span>
                      <span style={{ fontSize: 11, color: '#fff', fontWeight: 700 }}>Загружаю голос…</span>
                    </div>
                  ) : playing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                      <span style={{ fontSize: 22 }}>{sp.emoji}</span>
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: sp.headerAccent }}>{sp.name.split(' ')[0]} объясняет…</div>
                        <WaveBar color={sp.headerAccent} />
                      </div>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={pauseAudio}
                        style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.24)', color: '#fff', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                        ⏸ Пауза
                      </motion.button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={replay}
                        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 16px', borderRadius: 18, background: 'rgba(255,255,255,0.17)', border: '1px solid rgba(255,255,255,0.27)', color: '#fff', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>
                        🔁 {audioReady ? 'Повторить' : 'Воспроизвести'}
                      </motion.button>
                      {audioReady && <div style={{ fontSize: 10, color: sp.headerAccent, fontWeight: 700 }}>🔊 Готово</div>}
                    </div>
                  )}
                </div>
              </div>

              {/* PDF / Word download (Galina only) */}
              {isGalina && (answer?.docType || isDocFormAnswer) && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                  style={{ marginTop: 10, padding: '12px 14px', borderRadius: 16, background: sp.accentBg, border: `1.5px solid ${sp.inputBorder}` }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: sp.accentColor, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
                    📄 Документ готов
                  </div>

                  {/* Active seal selectors */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 10 }}>
                    {/* Signature selector */}
                    <div style={{ background: '#fff', borderRadius: 10, padding: '7px 8px', border: `1px solid ${sp.inputBorder}` }}>
                      <div style={{ fontSize: 8, fontWeight: 800, color: sp.accentColor, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>✍️ Подпись</div>
                      {sigs.length === 0 ? (
                        <div style={{ fontSize: 9, color: '#aaa', fontStyle: 'italic' }}>не добавлена</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {sigs.map(s => (
                            <div key={s.id} onClick={() => setActiveSig(s.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', padding: '3px 5px', borderRadius: 6, background: s.id === activeSigId ? sp.accentBg : 'transparent', border: `1px solid ${s.id === activeSigId ? sp.accentColor : 'transparent'}` }}>
                              <img src={s.img} alt={s.name} style={{ width: 36, height: 20, objectFit: 'contain' }} />
                              <span style={{ fontSize: 8, color: sp.answerColor, fontWeight: s.id === activeSigId ? 800 : 500 }}>{s.name.slice(0, 10)}</span>
                              {s.id === activeSigId && <span style={{ fontSize: 8, marginLeft: 'auto', color: '#2d8a3e' }}>✓</span>}
                            </div>
                          ))}
                          {activeSigId && (
                            <div onClick={() => setActiveSig(null)}
                              style={{ fontSize: 8, color: '#aaa', cursor: 'pointer', padding: '2px 5px', borderRadius: 5, border: !activeSigId ? `1px solid ${sp.accentColor}` : '1px solid transparent' }}>
                              ✕ Без подписи
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Stamp selector */}
                    <div style={{ background: '#fff', borderRadius: 10, padding: '7px 8px', border: `1px solid ${sp.inputBorder}` }}>
                      <div style={{ fontSize: 8, fontWeight: 800, color: sp.accentColor, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>🔏 Печать</div>
                      {stamps.length === 0 ? (
                        <div style={{ fontSize: 9, color: '#aaa', fontStyle: 'italic' }}>не добавлена</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {stamps.map(s => (
                            <div key={s.id} onClick={() => setActiveStamp(s.id)}
                              style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', padding: '3px 5px', borderRadius: 6, background: s.id === activeStampId ? sp.accentBg : 'transparent', border: `1px solid ${s.id === activeStampId ? sp.accentColor : 'transparent'}` }}>
                              <img src={s.img} alt={s.name} style={{ width: 26, height: 26, objectFit: 'contain', opacity: 0.88 }} />
                              <span style={{ fontSize: 8, color: sp.answerColor, fontWeight: s.id === activeStampId ? 800 : 500 }}>{(s.isGenerated ? '🤖 ' : '') + s.name.slice(0, 9)}</span>
                              {s.id === activeStampId && <span style={{ fontSize: 8, marginLeft: 'auto', color: '#2d8a3e' }}>✓</span>}
                            </div>
                          ))}
                          {activeStampId && (
                            <div onClick={() => setActiveStamp(null)}
                              style={{ fontSize: 8, color: '#aaa', cursor: 'pointer', padding: '2px 5px', borderRadius: 5 }}>
                              ✕ Без печати
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <motion.button whileTap={{ scale: 0.96 }} onClick={downloadPdf}
                      style={{ padding: '12px 0', borderRadius: 13, background: sp.headerGradient, border: 'none', color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <span>📥</span><span>PDF</span>
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.96 }} onClick={downloadWord}
                      style={{ padding: '12px 0', borderRadius: 13, background: 'linear-gradient(135deg,#1a5276,#2471a3)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <span>📝</span><span>Word</span>
                    </motion.button>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 9.5, color: sp.accentColor, textAlign: 'center', fontWeight: 600, opacity: 0.6 }}>
                    PDF → браузер → Сохранить как PDF &nbsp;·&nbsp; Word → файл .doc
                  </div>
                </motion.div>
              )}

              {/* Igor: document download panel */}
              {isIgor && answer?.docType && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                  style={{ marginTop: 10, padding: '12px 14px', borderRadius: 16, background: sp.accentBg, border: `1.5px solid ${sp.inputBorder}` }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: sp.accentColor, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 }}>
                    📄 Документ готов — скачать
                  </div>

                  {/* Signature preview / add */}
                  <div style={{ marginBottom: 10, padding: '8px 10px', background: '#fff', borderRadius: 10, border: `1px solid ${sp.inputBorder}` }}>
                    <div style={{ fontSize: 8, fontWeight: 800, color: sp.accentColor, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 }}>✍️ Подпись в документе</div>
                    {igorSig ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <img src={igorSig} alt="Подпись" style={{ maxHeight: 38, maxWidth: 150, objectFit: 'contain', flex: 1 }} />
                        <motion.button whileTap={{ scale: 0.93 }} onClick={() => setShowIgorSigPad(true)}
                          style={{ padding: '5px 10px', borderRadius: 8, background: sp.accentBg, border: `1px solid ${sp.inputBorder}`, color: sp.accentColor, fontSize: 10, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                          ✏️ Изменить
                        </motion.button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ fontSize: 9, color: '#aaa', fontStyle: 'italic', flex: 1 }}>Без подписи — будет пустая строка</div>
                        <motion.button whileTap={{ scale: 0.95 }} onClick={() => setShowIgorSigPad(true)}
                          style={{ padding: '6px 12px', borderRadius: 9, background: sp.headerGradient, border: 'none', color: '#fff', fontSize: 10, fontWeight: 800, cursor: 'pointer', flexShrink: 0 }}>
                          ✍️ Добавить
                        </motion.button>
                      </div>
                    )}
                  </div>

                  {/* Signing method note */}
                  <div style={{ marginBottom: 10, padding: '7px 10px', background: '#fff8e1', borderRadius: 8, border: '1px solid #ffe082', fontSize: 9.5, color: '#795548', fontWeight: 600, lineHeight: 1.5 }}>
                    💡 Электронная подпись (выше) — для удобства. Для юридической силы распечатайте и подпишите ручкой.
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <motion.button whileTap={{ scale: 0.96 }} onClick={downloadIgorPdf}
                      style={{ padding: '12px 0', borderRadius: 13, background: sp.headerGradient, border: 'none', color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <span>📥</span><span>PDF</span>
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.96 }} onClick={downloadIgorWord}
                      style={{ padding: '12px 0', borderRadius: 13, background: 'linear-gradient(135deg,#1a5276,#2471a3)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <span>📝</span><span>Word (.doc)</span>
                    </motion.button>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 9, color: sp.accentColor, textAlign: 'center', fontWeight: 600, opacity: 0.6 }}>
                    PDF → браузер → Сохранить как PDF &nbsp;·&nbsp; Word → редактирование в Word
                  </div>
                </motion.div>
              )}

              {/* Generic specialist: document download panel */}
              {isDocFormAnswer && !isIgor && !isGalina && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                  style={{ marginTop: 10, padding: '12px 14px', borderRadius: 16, background: sp.accentBg, border: `1.5px solid ${sp.inputBorder}` }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: sp.accentColor, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8 }}>
                    📄 Документ готов — скачать
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <motion.button whileTap={{ scale: 0.96 }} onClick={downloadGenericPdf}
                      style={{ padding: '12px 0', borderRadius: 13, background: sp.headerGradient, border: 'none', color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <span>📥</span><span>PDF</span>
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.96 }} onClick={downloadGenericWord}
                      style={{ padding: '12px 0', borderRadius: 13, background: 'linear-gradient(135deg,#1a5276,#2471a3)', border: 'none', color: '#fff', fontSize: 13, fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      <span>📝</span><span>Word (.doc)</span>
                    </motion.button>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 9, color: sp.accentColor, textAlign: 'center', fontWeight: 600, opacity: 0.6 }}>
                    PDF → браузер → Сохранить как PDF &nbsp;·&nbsp; Word → редактирование в Word
                  </div>
                </motion.div>
              )}

              {/* New question prompt */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
                style={{ marginTop: 10, textAlign: 'center', fontSize: 11, color: sp.accentColor, fontWeight: 700 }}>
                Задай следующий вопрос или нажми 🗑 Очистить
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ margin: '10px 14px', padding: '11px 14px', borderRadius: 14, background: '#fff3f3', border: '1px solid #ffcdd2', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>😟</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#c62828' }}>Ошибка</div>
                <div style={{ fontSize: 11, color: '#b71c1c', marginTop: 2 }}>{error}</div>
              </div>
              <button onClick={() => setError('')} style={{ background: 'none', border: 'none', color: '#ef5350', fontSize: 15, cursor: 'pointer' }}>✕</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Input area ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 10,
        background: '#fff', borderTop: `2px solid ${sp.inputBorder}`,
        boxShadow: '0 -4px 20px rgba(0,0,0,0.08)',
        paddingBottom: 'env(safe-area-inset-bottom,0px)',
      }}>

        {/* ── Recording indicator strip ── */}
        <AnimatePresence>
          {isRecording && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 0', background: '#fff0f0' }}>
              <motion.div
                animate={{ opacity: [1,0.2,1] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                style={{ width: 12, height: 12, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.8)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: '#ef4444', flex: 1 }}>Запись идёт…</span>
              <WaveBar color="#ef4444" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Transcribing indicator ── */}
        <AnimatePresence>
          {transcribing && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px 0' }}>
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-block', fontSize: 14 }}>⏳</motion.span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>Распознаю речь…</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Pending transcript panel ── */}
        <AnimatePresence>
          {pendingTranscript && !thinking && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              style={{ margin: '8px 10px 0', padding: '10px 12px', borderRadius: 12, background: sp.accentBg, border: `1.5px solid ${sp.inputBorder}` }}>
              <div style={{ fontSize: 10, fontWeight: 800, color: sp.accentColor, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>
                🎙 Распознано:
              </div>
              <div style={{ fontSize: 13, color: sp.answerColor, fontWeight: 600, lineHeight: 1.5, marginBottom: 8 }}>
                {pendingTranscript}
              </div>
              <div style={{ display: 'flex', gap: 7 }}>
                <motion.button whileTap={{ scale: 0.95 }} onClick={sendPendingTranscript}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 10, background: sp.headerGradient, border: 'none', color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  ✉️ Отправить
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={editPendingTranscript}
                  style={{ padding: '9px 14px', borderRadius: 10, background: '#fff', border: `1px solid ${sp.inputBorder}`, color: sp.accentColor, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  ✏️ Изменить
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => setPendingTranscript(null)}
                  style={{ padding: '9px 10px', borderRadius: 10, background: '#fff', border: '1px solid #ffcdd2', color: '#ef5350', fontSize: 13, cursor: 'pointer', fontWeight: 800 }}>
                  ✕
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Image preview ── */}
        <AnimatePresence>
          {imagePreview && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              style={{ padding: '7px 12px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ position: 'relative', width: 50, height: 50, borderRadius: 10, overflow: 'hidden', border: `2px solid ${sp.accentColor}`, flexShrink: 0 }}>
                <img src={imagePreview} alt="фото" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ flex: 1, fontSize: 11, color: sp.accentColor, fontWeight: 700 }}>📷 Фото прикреплено</div>
              <motion.button whileTap={{ scale: 0.9 }} onClick={removeImage}
                style={{ width: 26, height: 26, borderRadius: '50%', background: '#ffcdd2', border: 'none', color: '#c62828', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main input row ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, padding: '8px 10px 10px' }}>

          {/* Camera — gallery */}
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => fileRef.current?.click()}
            title="Прикрепить фото из галереи"
            style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, cursor: 'pointer', background: sp.accentBg, border: `1px solid ${sp.inputBorder}`, color: sp.accentColor, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            🖼
          </motion.button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />

          {/* Camera — shoot */}
          <motion.button whileTap={{ scale: 0.88 }} onClick={() => cameraRef.current?.click()}
            title="Сфотографировать"
            style={{ width: 42, height: 42, borderRadius: 13, flexShrink: 0, cursor: 'pointer', background: sp.accentBg, border: `1px solid ${sp.inputBorder}`, color: sp.accentColor, fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            📷
          </motion.button>
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handleFile} style={{ display: 'none' }} />

          {/* Mic button */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={handleMicButton}
            animate={isRecording ? { scale: [1,1.06,1] } : {}}
            transition={{ duration: 0.5, repeat: Infinity }}
            style={{
              width: isRecording ? 'auto' : 42,
              minWidth: 42,
              height: 42,
              borderRadius: isRecording ? 13 : 13,
              flexShrink: 0,
              cursor: 'pointer',
              background: isRecording ? '#ef4444' : transcribing ? '#f59e0b' : sp.accentBg,
              border: isRecording ? '2px solid #ef4444' : `1px solid ${sp.inputBorder}`,
              color: (isRecording || transcribing) ? '#fff' : sp.accentColor,
              fontSize: isRecording ? 12 : 20,
              fontWeight: 900,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: isRecording ? '0 12px' : '0',
              boxShadow: isRecording ? '0 0 16px rgba(239,68,68,0.6)' : 'none',
              transition: 'background 0.2s, box-shadow 0.2s, width 0.2s',
              overflow: 'hidden',
              fontFamily: '"Montserrat",sans-serif',
            }}>
            {isRecording ? (
              <>
                <motion.div
                  animate={{ opacity: [1,0.1,1] }}
                  transition={{ duration: 0.4, repeat: Infinity }}
                  style={{ width: 9, height: 9, borderRadius: '50%', background: '#fff', flexShrink: 0 }} />
                <span>СТОП СТОП</span>
              </>
            ) : transcribing ? (
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-block', fontSize: 18 }}>⏳</motion.span>
            ) : (
              '🎙️'
            )}
          </motion.button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? 'Говори — я слушаю…' : sp.placeholder}
            rows={1}
            style={{
              flex: 1, border: `1.5px solid ${sp.inputBorder}`, borderRadius: 13,
              padding: '9px 13px', fontSize: 13, fontFamily: '"Montserrat",sans-serif',
              color: sp.answerColor, background: sp.contentBg,
              resize: 'none', outline: 'none', lineHeight: 1.5, maxHeight: 110, overflow: 'auto',
            }}
            onInput={e => {
              const t = e.target as HTMLTextAreaElement;
              t.style.height = 'auto';
              t.style.height = Math.min(t.scrollHeight, 110) + 'px';
            }}
          />

          {/* Send */}
          {isDyadyaVanya ? (
            <BobberButton onClick={ask} disabled={!canSend} sinking={thinking}>
              {thinking
                ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-block', fontSize: 16 }}>🎣</motion.span>
                : '🎣'}
            </BobberButton>
          ) : (
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={ask}
              disabled={!canSend}
              animate={thinking ? { scale: [1,0.93,1] } : {}}
              transition={{ duration: 0.5, repeat: Infinity }}
              style={{
                width: 42, height: 42, borderRadius: 13, flexShrink: 0,
                cursor: canSend ? 'pointer' : 'default',
                background: canSend ? sp.headerGradient : sp.accentBg,
                border: 'none', color: canSend ? '#fff' : sp.inputBorder, fontSize: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              {thinking
                ? <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-block' }}>⚙️</motion.span>
                : '✉️'}
            </motion.button>
          )}
        </div>

        {!answer && !thinking && !isRecording && !transcribing && !pendingTranscript && (
          <div style={{ paddingBottom: 5, paddingLeft: 13, fontSize: 10, color: '#aaa', fontWeight: 600 }}>
            🖼 галерея · 📷 камера · 🎙️ голос · Enter = отправить
          </div>
        )}
      </div>

      {/* Generic specialist: document form modal */}
      <AnimatePresence>
        {genericDocFormKey && (() => {
          const cfg = specialistForms.find(c => c.key === genericDocFormKey);
          if (!cfg) return null;
          return (
            <DocumentFormModal
              key={genericDocFormKey}
              config={cfg}
              onSubmit={prompt => {
                setGenericDocFormKey(null);
                setIsDocFormAnswer(true);
                setDocFormTitle(cfg.title);
                askWithText(prompt);
              }}
              onClose={() => setGenericDocFormKey(null)}
              headerGradient={sp.headerGradient}
              accentColor={sp.accentColor}
              inputBorder={sp.inputBorder}
            />
          );
        })()}
      </AnimatePresence>

      {/* Igor: document form modal */}
      <AnimatePresence>
        {igorDocFormKey && (() => {
          const cfg = IGOR_FORM_CONFIGS.find(c => c.key === igorDocFormKey);
          if (!cfg) return null;
          return (
            <DocumentFormModal
              key={igorDocFormKey}
              config={cfg}
              onSubmit={prompt => {
                setIgorDocFormKey(null);
                askWithText(prompt);
              }}
              onClose={() => setIgorDocFormKey(null)}
              headerGradient={sp.headerGradient}
              accentColor={sp.accentColor}
              inputBorder={sp.inputBorder}
            />
          );
        })()}
      </AnimatePresence>

      {/* Igor: signature pad modal */}
      {showIgorSigPad && (
        <SignaturePadModal
          onSave={saveIgorSig}
          onClose={() => setShowIgorSigPad(false)}
          headerGradient={sp.headerGradient}
          accentColor={sp.accentColor}
        />
      )}
    </div>
  );
}
