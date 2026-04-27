import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

/* ══════════════════════════════════════════════════════
   БИЗНЕС-ШАБЛОНЫ ДЛЯ КАНАЛОВ
   Типы, данные, компоненты: выбор шаблона, сотрудники, прайс
══════════════════════════════════════════════════════ */

export interface ChannelEmployee {
  id: string;
  name: string;
  role: string;
  emoji: string;
  photoUrl?: string;
  bio?: string;
  rating?: number;
  bookingSlots?: string[];
}

export interface PriceItem {
  id: string;
  category?: string;
  name: string;
  description?: string;
  price: string;
  unit?: string;
  emoji?: string;
  inStock?: boolean;
}

export type TemplateType = 'services' | 'retail' | 'food' | 'general';

export interface ChannelTemplate {
  id: string;
  emoji: string;
  name: string;
  type: TemplateType;
  category: string;
  color: string;
  gradient: string;
  exampleName: string;
  exampleDesc: string;
  usp: string;
  tags: string[];
  keywords: string[];
  rubrics: string[];
  employees?: ChannelEmployee[];
  priceItems?: PriceItem[];
}

/* ══════════ ДАННЫЕ ШАБЛОНОВ ══════════ */
export const CHANNEL_TEMPLATES: ChannelTemplate[] = [
  {
    id: 'barbershop',
    emoji: '💈',
    name: 'Барбершоп / Парикмахерская',
    type: 'services',
    category: 'beauty',
    color: '#c4a35a',
    gradient: 'linear-gradient(135deg,#1a1006 0%,#3d2b0e 100%)',
    exampleName: 'Barbershop Royal',
    exampleDesc: 'Классические мужские стрижки, бритьё опасной бритвой и уход за бородой. Мастера с 5+ лет опыта.',
    usp: '✂️ Мастера высшего класса · ⚡ Запись без ожидания · 💸 Честные цены',
    tags: ['стрижка','борода','барбершоп','мужской стиль','уход'],
    keywords: ['барбершоп','парикмахерская','стрижка мужская','борода','бритьё','fade','запись','мастер-барбер'],
    rubrics: ['Работы мастеров','Акции','До и После','Новинки'],
    employees: [
      { id:'e1', name:'Алексей', role:'Старший барбер', emoji:'✂️', rating:4.9, bio:'5 лет опыта. Специализация: fade, текстурные стрижки, уход за бородой.', bookingSlots:['10:00','11:30','13:00','15:30','17:00'] },
      { id:'e2', name:'Дмитрий', role:'Барбер', emoji:'💈', rating:4.7, bio:'Работаю с любыми типами волос. Люблю классику и современные стили.', bookingSlots:['09:00','11:00','14:00','16:00'] },
      { id:'e3', name:'Роман', role:'Барбер-колорист', emoji:'🎨', rating:4.8, bio:'Окрашивание, осветление, камуфляж седины. Авторские техники.', bookingSlots:['12:00','14:30','16:00','18:00'] },
    ],
    priceItems: [
      { id:'p1', category:'Стрижки', name:'Мужская стрижка', price:'700 ₽', emoji:'✂️' },
      { id:'p2', category:'Стрижки', name:'Детская стрижка', price:'500 ₽', emoji:'👦' },
      { id:'p3', category:'Борода', name:'Оформление бороды', price:'400 ₽', emoji:'🧔' },
      { id:'p4', category:'Борода', name:'Стрижка + борода', price:'950 ₽', emoji:'💈' },
      { id:'p5', category:'Уход', name:'Горячее бритьё', price:'600 ₽', emoji:'🪒' },
      { id:'p6', category:'Уход', name:'Камуфляж седины', price:'900 ₽', emoji:'🎨' },
    ],
  },
  {
    id: 'beauty',
    emoji: '💅',
    name: 'Салон красоты',
    type: 'services',
    category: 'beauty',
    color: '#f472b6',
    gradient: 'linear-gradient(135deg,#1a0614 0%,#3d0a2b 100%)',
    exampleName: 'Beauty Studio Luna',
    exampleDesc: 'Комплексный уход за красотой: маникюр, педикюр, ресницы, брови, волосы. Первоклассные мастера.',
    usp: '✨ Всё для красоты в одном месте · 📅 Онлайн-запись · 🎁 Скидки постоянным клиентам',
    tags: ['маникюр','педикюр','волосы','брови','ресницы'],
    keywords: ['салон красоты','маникюр','педикюр','наращивание ресниц','покраска волос','брови','укладка','стрижка женская'],
    rubrics: ['Работы мастеров','Акции','Уходы','Советы по красоте'],
    employees: [
      { id:'e1', name:'Мария', role:'Мастер ногтевого сервиса', emoji:'💅', rating:5.0, bio:'Маникюр, педикюр, наращивание. Работаю с 2018 г. Победитель региональных чемпионатов.', bookingSlots:['10:00','12:00','14:00','16:00'] },
      { id:'e2', name:'Алина', role:'Мастер бровей и ресниц', emoji:'👁️', rating:4.9, bio:'Ламинирование, наращивание, архитектура бровей. Работаю с натуральными материалами.', bookingSlots:['09:00','11:00','13:00','15:00','17:00'] },
      { id:'e3', name:'Кристина', role:'Парикмахер-стилист', emoji:'✂️', rating:4.8, bio:'Окрашивание всех техник, стрижки, укладки. Работала в топовых московских салонах.', bookingSlots:['11:00','13:30','16:00'] },
    ],
    priceItems: [
      { id:'p1', category:'Ногти', name:'Маникюр с покрытием', price:'1 200 ₽', emoji:'💅' },
      { id:'p2', category:'Ногти', name:'Педикюр с покрытием', price:'1 500 ₽', emoji:'👣' },
      { id:'p3', category:'Ресницы', name:'Наращивание ресниц', price:'2 500 ₽', emoji:'👁️' },
      { id:'p4', category:'Брови', name:'Оформление + окраска', price:'800 ₽', emoji:'✍️' },
      { id:'p5', category:'Волосы', name:'Окрашивание волос', price:'от 2 000 ₽', emoji:'🎨' },
      { id:'p6', category:'Волосы', name:'Женская стрижка', price:'1 000 ₽', emoji:'✂️' },
    ],
  },
  {
    id: 'fitness',
    emoji: '💪',
    name: 'Фитнес / Тренажёрный зал',
    type: 'services',
    category: 'sport',
    color: '#f97316',
    gradient: 'linear-gradient(135deg,#1a0800 0%,#3d1a00 100%)',
    exampleName: 'IronZone Fitness',
    exampleDesc: 'Современный тренажёрный зал с профессиональными тренерами. Персональные тренировки, групповые занятия, диетология.',
    usp: '🏆 Сертифицированные тренеры · 💪 Оборудование мирового класса · 📊 Онлайн-трекинг прогресса',
    tags: ['фитнес','тренировки','похудение','спорт','тренер'],
    keywords: ['фитнес','тренажёрный зал','персональный тренер','похудение','мышцы','групповые тренировки','здоровье'],
    rubrics: ['Результаты клиентов','Тренировки','Питание','Акции'],
    employees: [
      { id:'e1', name:'Андрей', role:'Персональный тренер', emoji:'🏋️', rating:4.9, bio:'10 лет в спорте. Специализация: силовые тренировки, набор мышечной массы, похудение.', bookingSlots:['07:00','09:00','11:00','18:00','20:00'] },
      { id:'e2', name:'Ольга', role:'Тренер по йоге и пилатесу', emoji:'🧘', rating:5.0, bio:'RYT-200. Групповые и индивидуальные занятия. Работаю с беременными и восстановлением после родов.', bookingSlots:['08:00','10:00','12:00','17:00'] },
      { id:'e3', name:'Максим', role:'Тренер по боксу', emoji:'🥊', rating:4.8, bio:'КМС по боксу. Обучаю технике для всех уровней подготовки. Кардио-боксинг для похудения.', bookingSlots:['09:00','11:00','19:00','21:00'] },
    ],
    priceItems: [
      { id:'p1', category:'Абонементы', name:'Месячный абонемент', price:'2 500 ₽', unit:'мес', emoji:'📅' },
      { id:'p2', category:'Абонементы', name:'Годовой абонемент', price:'20 000 ₽', unit:'год', emoji:'🗓️' },
      { id:'p3', category:'Посещение', name:'Разовый визит', price:'400 ₽', emoji:'1️⃣' },
      { id:'p4', category:'Тренировки', name:'Персональная тренировка', price:'1 500 ₽', unit:'час', emoji:'👤' },
      { id:'p5', category:'Тренировки', name:'Групповое занятие', price:'500 ₽', emoji:'👥' },
    ],
  },
  {
    id: 'medical',
    emoji: '🏥',
    name: 'Медицинский центр',
    type: 'services',
    category: 'health',
    color: '#06b6d4',
    gradient: 'linear-gradient(135deg,#001520 0%,#002d3d 100%)',
    exampleName: 'МедЦентр «Здоровье»',
    exampleDesc: 'Частная клиника с современным оборудованием. Консультации специалистов, диагностика, лечение без очередей.',
    usp: '🩺 Врачи высшей категории · ⏱️ Приём без очереди · 🔬 Точная диагностика в день обращения',
    tags: ['медицина','врач','клиника','здоровье','диагностика'],
    keywords: ['клиника','врач','консультация','медицина','запись к врачу','диагностика','анализы','терапевт','педиатр'],
    rubrics: ['Специалисты','Услуги','Акции','Здоровый образ жизни'],
    employees: [
      { id:'e1', name:'Иванова А.С.', role:'Терапевт · высшая категория', emoji:'🩺', rating:4.9, bio:'Терапевт с 15-летним стажем. Комплексная диагностика и лечение внутренних органов.', bookingSlots:['09:00','10:00','11:00','14:00','15:00'] },
      { id:'e2', name:'Петров В.Н.', role:'Кардиолог', emoji:'❤️', rating:4.8, bio:'Кандидат медицинских наук. Специализация: ИБС, аритмии, гипертония.', bookingSlots:['10:00','12:00','14:00','16:00'] },
      { id:'e3', name:'Сидорова М.А.', role:'Педиатр', emoji:'👶', rating:5.0, bio:'10 лет работы с детьми от 0 до 18 лет. Профилактика, лечение, вакцинация.', bookingSlots:['09:00','10:30','12:00','15:00'] },
      { id:'e4', name:'Козлов И.П.', role:'Невролог', emoji:'🧠', rating:4.7, bio:'Лечение головных болей, нарушений сна, остеохондроза. Детская и взрослая неврология.', bookingSlots:['11:00','13:00','15:00','17:00'] },
    ],
    priceItems: [
      { id:'p1', category:'Консультации', name:'Приём терапевта', price:'1 500 ₽', emoji:'🩺' },
      { id:'p2', category:'Консультации', name:'Приём специалиста', price:'2 000 ₽', emoji:'👨‍⚕️' },
      { id:'p3', category:'Диагностика', name:'УЗИ органов', price:'1 200 ₽', emoji:'🔬' },
      { id:'p4', category:'Диагностика', name:'Анализ крови общий', price:'800 ₽', emoji:'🩸' },
      { id:'p5', category:'Физиотерапия', name:'Сеанс физиотерапии', price:'700 ₽', emoji:'⚡' },
    ],
  },
  {
    id: 'spa',
    emoji: '🧖',
    name: 'Массаж / СПА / Wellness',
    type: 'services',
    category: 'beauty',
    color: '#a78bfa',
    gradient: 'linear-gradient(135deg,#0d0020 0%,#1a0040 100%)',
    exampleName: 'SPA Studio Relax',
    exampleDesc: 'Профессиональный массаж, спа-программы и уходы для тела. Место силы и полного восстановления.',
    usp: '🌿 Профессиональные техники · 🕯️ Атмосфера релакса · ✨ Премиум-косметика',
    tags: ['массаж','спа','релакс','wellness','уход за телом'],
    keywords: ['массаж','спа','расслабление','wellness','тайский массаж','антицеллюлитный','обёртывание','релаксация'],
    rubrics: ['Наши процедуры','Акции','Советы по уходу','Отзывы'],
    employees: [
      { id:'e1', name:'Наталья', role:'Массажист · тайский массаж', emoji:'🌿', rating:5.0, bio:'Сертифицированный мастер тайского массажа. 8 лет практики. Работала в Таиланде и на Бали.', bookingSlots:['10:00','12:00','14:00','16:00','18:00'] },
      { id:'e2', name:'Виктория', role:'СПА-мастер · обёртывания', emoji:'✨', rating:4.9, bio:'Специалист по уходам для тела. Горячий шоколад, водоросли, бамбук.', bookingSlots:['09:00','11:00','13:00','15:00'] },
      { id:'e3', name:'Елена', role:'Массажист · антицеллюлитный', emoji:'💆', rating:4.8, bio:'Антицеллюлитный, лимфодренаж, классический. Результат виден уже после 3 сеансов.', bookingSlots:['10:00','12:30','15:00','17:30'] },
    ],
    priceItems: [
      { id:'p1', category:'Массаж', name:'Классический массаж тела', price:'1 800 ₽', unit:'60 мин', emoji:'💆' },
      { id:'p2', category:'Массаж', name:'Тайский массаж', price:'2 500 ₽', unit:'90 мин', emoji:'🌿' },
      { id:'p3', category:'Массаж', name:'Антицеллюлитный', price:'2 000 ₽', unit:'60 мин', emoji:'🔥' },
      { id:'p4', category:'СПА', name:'Горячие камни', price:'2 800 ₽', unit:'90 мин', emoji:'🪨' },
      { id:'p5', category:'СПА', name:'Шоколадное обёртывание', price:'2 200 ₽', unit:'60 мин', emoji:'🍫' },
    ],
  },
  {
    id: 'education',
    emoji: '🎓',
    name: 'Курсы / Обучение',
    type: 'services',
    category: 'education',
    color: '#3b82f6',
    gradient: 'linear-gradient(135deg,#000820 0%,#001640 100%)',
    exampleName: 'ProSkills Academy',
    exampleDesc: 'Онлайн и офлайн курсы по востребованным профессиям. Практика с первого дня, трудоустройство 85% выпускников.',
    usp: '🎯 Практические знания · 💼 Помощь в трудоустройстве · 📜 Официальные сертификаты',
    tags: ['обучение','курсы','навыки','профессия','онлайн'],
    keywords: ['курсы','обучение','репетитор','онлайн курсы','профессия','сертификат','навыки','дополнительное образование'],
    rubrics: ['Курсы','Истории успеха','Преподаватели','Новости'],
    employees: [
      { id:'e1', name:'Дарья', role:'Преподаватель дизайна', emoji:'🎨', rating:4.9, bio:'UX/UI и графический дизайн. Работала в Яндексе. 200+ выпускников трудоустроены.', bookingSlots:['09:00','11:00','14:00','16:00'] },
      { id:'e2', name:'Сергей', role:'Преподаватель программирования', emoji:'💻', rating:4.8, bio:'Senior-разработчик. Python, JS, React. Веду курсы 5 лет. Методика быстрого старта.', bookingSlots:['10:00','12:00','18:00','20:00'] },
      { id:'e3', name:'Инна', role:'Преподаватель маркетинга', emoji:'📊', rating:4.9, bio:'10 лет в digital-маркетинге. SMM, таргет, контент. Кейсы с ROI 500%.', bookingSlots:['11:00','13:00','15:00','17:00'] },
    ],
    priceItems: [
      { id:'p1', category:'Курсы', name:'Курс дизайна (3 месяца)', price:'18 000 ₽', emoji:'🎨' },
      { id:'p2', category:'Курсы', name:'Курс программирования', price:'25 000 ₽', emoji:'💻' },
      { id:'p3', category:'Курсы', name:'Курс маркетинга', price:'15 000 ₽', emoji:'📊' },
      { id:'p4', category:'Занятия', name:'Индивидуальное занятие', price:'1 500 ₽', unit:'час', emoji:'👤' },
      { id:'p5', category:'Занятия', name:'Групповое занятие', price:'600 ₽', unit:'час', emoji:'👥' },
    ],
  },
  {
    id: 'repair',
    emoji: '🔨',
    name: 'Ремонт и отделка',
    type: 'services',
    category: 'construction',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg,#150b00 0%,#2d1800 100%)',
    exampleName: 'МастерСтрой',
    exampleDesc: 'Качественный ремонт квартир и офисов. Замер бесплатно, дизайн-проект, строительство под ключ.',
    usp: '📐 Дизайн-проект бесплатно · 🔧 Опытная бригада · ✅ Гарантия на все работы 2 года',
    tags: ['ремонт','строительство','отделка','квартира','дизайн'],
    keywords: ['ремонт квартиры','строительство','отделочные работы','дизайн интерьера','под ключ','шпатлёвка','плитка','электрик','сантехник'],
    rubrics: ['Портфолио','Прайс','Команда','Советы по ремонту'],
    employees: [
      { id:'e1', name:'Иван', role:'Прораб · бригадир', emoji:'📐', rating:4.9, bio:'15 лет в строительстве. Контролирую качество на каждом этапе. Работаем под ключ.', bookingSlots:['09:00','12:00','15:00'] },
      { id:'e2', name:'Николай', role:'Плиточник · электрик', emoji:'⚡', rating:4.7, bio:'Укладка плитки любой сложности, проводка, распределительные щиты.', bookingSlots:['08:00','11:00','14:00','17:00'] },
      { id:'e3', name:'Артём', role:'Маляр-отделочник', emoji:'🖌️', rating:4.8, bio:'Шпатлёвка, покраска, обои. Ровные стены — моя гордость. Стаж 10 лет.', bookingSlots:['09:00','13:00','16:00'] },
    ],
    priceItems: [
      { id:'p1', category:'Отделка', name:'Шпатлёвка стен', price:'от 300 ₽', unit:'м²', emoji:'🖌️' },
      { id:'p2', category:'Отделка', name:'Укладка плитки', price:'от 700 ₽', unit:'м²', emoji:'🧱' },
      { id:'p3', category:'Электрика', name:'Замена розетки/выключателя', price:'от 500 ₽', emoji:'🔌' },
      { id:'p4', category:'Сантехника', name:'Замена смесителя', price:'от 800 ₽', emoji:'🚰' },
      { id:'p5', category:'Ремонт', name:'Ремонт квартиры под ключ', price:'по договору', emoji:'🏠' },
    ],
  },
  {
    id: 'autoservice',
    emoji: '🔧',
    name: 'Автосервис / СТО',
    type: 'services',
    category: 'auto',
    color: '#64748b',
    gradient: 'linear-gradient(135deg,#080a0e 0%,#141820 100%)',
    exampleName: 'АвтоСервис Pro',
    exampleDesc: 'Профессиональный ремонт автомобилей всех марок. Диагностика, ТО, шиномонтаж, кузовные работы.',
    usp: '🔍 Бесплатная диагностика · 🛡️ Гарантия на работы · ⚡ Срочный ремонт от 2 часов',
    tags: ['автосервис','ремонт авто','то','шиномонтаж','диагностика'],
    keywords: ['автосервис','ремонт автомобиля','ТО','техническое обслуживание','шиномонтаж','замена масла','ходовая','кузов','СТО'],
    rubrics: ['Наши работы','Прайс','Советы автовладельцам','Акции'],
    employees: [
      { id:'e1', name:'Владимир', role:'Механик · 15 лет стажа', emoji:'🔧', rating:4.9, bio:'Специализация: двигатели, КПП, ходовая. Работаю со всеми марками.', bookingSlots:['09:00','11:00','13:00','15:00','17:00'] },
      { id:'e2', name:'Геннадий', role:'Диагност · электрик', emoji:'⚡', rating:4.8, bio:'Компьютерная диагностика любых систем. Находю неисправность быстро и точно.', bookingSlots:['10:00','12:00','14:00','16:00'] },
      { id:'e3', name:'Пётр', role:'Кузовной мастер', emoji:'🚗', rating:4.7, bio:'Покраска, рихтовка, локальный ремонт. Цвет в цвет, без видимых следов.', bookingSlots:['09:00','14:00','16:00'] },
    ],
    priceItems: [
      { id:'p1', category:'ТО', name:'Замена масла + фильтр', price:'от 600 ₽', emoji:'🛢️' },
      { id:'p2', category:'ТО', name:'Диагностика ходовой', price:'бесплатно', emoji:'🔍' },
      { id:'p3', category:'Шины', name:'Шиномонтаж (4 колеса)', price:'от 800 ₽', emoji:'🔩' },
      { id:'p4', category:'Тормоза', name:'Замена тормозных колодок', price:'от 1 200 ₽', emoji:'🛑' },
      { id:'p5', category:'Кузов', name:'Покраска элемента', price:'от 3 000 ₽', emoji:'🎨' },
    ],
  },
  {
    id: 'autoparts',
    emoji: '🚗',
    name: 'Магазин запчастей',
    type: 'retail',
    category: 'auto',
    color: '#ef4444',
    gradient: 'linear-gradient(135deg,#150000 0%,#2d0000 100%)',
    exampleName: 'АвтоДеталь 777',
    exampleDesc: 'Продажа оригинальных и аналоговых запчастей для всех марок авто. Доставка в день заказа. Бесплатный подбор.',
    usp: '📦 Доставка в день заказа · ✅ Оригиналы и качественные аналоги · 💰 Гарантия цены',
    tags: ['запчасти','автозапчасти','авто','детали','магазин'],
    keywords: ['запчасти','автозапчасти','магазин запчастей','авторынок','детали авто','оригинал','аналог','доставка запчастей'],
    rubrics: ['Новинки','Акции','Советы по ТО','Каталог'],
    priceItems: [
      { id:'p1', category:'Двигатель', name:'Масляный фильтр', price:'от 150 ₽', emoji:'🔧', inStock:true },
      { id:'p2', category:'Двигатель', name:'Воздушный фильтр', price:'от 200 ₽', emoji:'💨', inStock:true },
      { id:'p3', category:'Тормоза', name:'Тормозные колодки', price:'от 800 ₽', emoji:'🛑', inStock:true },
      { id:'p4', category:'Подвеска', name:'Амортизатор', price:'от 1 200 ₽', emoji:'⬆️', inStock:true },
      { id:'p5', category:'Электрика', name:'Аккумулятор', price:'от 3 500 ₽', emoji:'🔋', inStock:true },
      { id:'p6', category:'Кузов', name:'Фара передняя', price:'от 2 000 ₽', emoji:'💡', inStock:true },
    ],
  },
  {
    id: 'restaurant',
    emoji: '🍽️',
    name: 'Кафе / Ресторан',
    type: 'food',
    category: 'food',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg,#150a00 0%,#2d1500 100%)',
    exampleName: 'Кафе «Тепло»',
    exampleDesc: 'Уютное кафе с авторской кухней, домашней атмосферой и живой музыкой по выходным. Бизнес-ланч 350 ₽.',
    usp: '🍳 Авторская кухня · 🎵 Живая музыка пт-вс · 🌿 Свежие продукты ежедневно',
    tags: ['кафе','ресторан','еда','доставка','кухня'],
    keywords: ['кафе','ресторан','обед','ужин','меню','еда','бизнес-ланч','банкет','доставка','резервация стола'],
    rubrics: ['Меню','Акции','События','Отзывы'],
    priceItems: [
      { id:'p1', category:'Завтраки', name:'Каша на молоке', price:'180 ₽', emoji:'🥣' },
      { id:'p2', category:'Завтраки', name:'Яичница с беконом', price:'250 ₽', emoji:'🍳' },
      { id:'p3', category:'Обеды', name:'Бизнес-ланч (суп + 2 блюда)', price:'350 ₽', emoji:'🍱' },
      { id:'p4', category:'Горячее', name:'Стейк из говядины', price:'650 ₽', emoji:'🥩' },
      { id:'p5', category:'Горячее', name:'Паста карбонара', price:'420 ₽', emoji:'🍝' },
      { id:'p6', category:'Десерты', name:'Чизкейк домашний', price:'220 ₽', emoji:'🍰' },
      { id:'p7', category:'Напитки', name:'Кофе (эспрессо/капуч)', price:'от 120 ₽', emoji:'☕' },
    ],
  },
  {
    id: 'delivery',
    emoji: '🛵',
    name: 'Доставка еды',
    type: 'food',
    category: 'food',
    color: '#22c55e',
    gradient: 'linear-gradient(135deg,#001a00 0%,#003000 100%)',
    exampleName: 'Вкусно Быстро',
    exampleDesc: 'Доставка горячей еды за 30 минут. Пицца, роллы, бургеры, сеты. Ежедневно 10:00–23:00.',
    usp: '⚡ Доставка за 30 минут · 🎁 Каждый 5-й заказ бесплатно · 🔥 Всегда горячо',
    tags: ['доставка','пицца','роллы','бургеры','быстро'],
    keywords: ['доставка еды','пицца на дом','роллы заказать','бургеры','суши','доставка быстро','заказать еду онлайн'],
    rubrics: ['Меню','Акции','Новинки','Отзывы'],
    priceItems: [
      { id:'p1', category:'Пицца', name:'Маргарита 30 см', price:'450 ₽', emoji:'🍕', inStock:true },
      { id:'p2', category:'Пицца', name:'Пепперони 30 см', price:'550 ₽', emoji:'🍕', inStock:true },
      { id:'p3', category:'Роллы', name:'Сет «Классика» 32 шт', price:'890 ₽', emoji:'🍣', inStock:true },
      { id:'p4', category:'Бургеры', name:'Чизбургер', price:'280 ₽', emoji:'🍔', inStock:true },
      { id:'p5', category:'Бургеры', name:'Дабл Смэш Бургер', price:'380 ₽', emoji:'🍔', inStock:true },
      { id:'p6', category:'Напитки', name:'Coca-Cola 0.5л', price:'90 ₽', emoji:'🥤', inStock:true },
    ],
  },
  {
    id: 'coffee',
    emoji: '☕',
    name: 'Кофейня',
    type: 'food',
    category: 'food',
    color: '#d97706',
    gradient: 'linear-gradient(135deg,#100800 0%,#201000 100%)',
    exampleName: 'Coffee & Joy',
    exampleDesc: 'Авторский кофе на зерне из лучших регионов мира, домашняя выпечка и уютная атмосфера для работы и встреч.',
    usp: '☕ Specialty-кофе · 🥐 Выпечка каждое утро · 💻 Wi-Fi и розетки на каждом месте',
    tags: ['кофе','кофейня','выпечка','десерты','завтрак'],
    keywords: ['кофейня','кофе','капучино','латте','десерт','выпечка','завтрак','кофе с собой','specialty кофе'],
    rubrics: ['Меню','Сезонные напитки','Акции','Атмосфера'],
    priceItems: [
      { id:'p1', category:'Кофе', name:'Эспрессо', price:'90 ₽', emoji:'☕' },
      { id:'p2', category:'Кофе', name:'Капучино', price:'160 ₽', emoji:'☕' },
      { id:'p3', category:'Кофе', name:'Раф кофе', price:'190 ₽', emoji:'☕' },
      { id:'p4', category:'Кофе', name:'Матча латте', price:'200 ₽', emoji:'🍵' },
      { id:'p5', category:'Выпечка', name:'Круассан', price:'120 ₽', emoji:'🥐' },
      { id:'p6', category:'Выпечка', name:'Брауни', price:'150 ₽', emoji:'🍫' },
      { id:'p7', category:'Десерты', name:'Торт (кусок)', price:'200 ₽', emoji:'🎂' },
    ],
  },
  {
    id: 'fashion',
    emoji: '👗',
    name: 'Магазин одежды / Бутик',
    type: 'retail',
    category: 'fashion',
    color: '#ec4899',
    gradient: 'linear-gradient(135deg,#150010 0%,#300025 100%)',
    exampleName: 'Boutique Moda',
    exampleDesc: 'Трендовая одежда для женщин и мужчин. Новые коллекции каждую неделю. Доставка по всей России.',
    usp: '👗 Новинки каждую неделю · 🚚 Бесплатная доставка от 3 000 ₽ · ↩️ Возврат 30 дней',
    tags: ['одежда','мода','стиль','бутик','тренды'],
    keywords: ['магазин одежды','бутик','мода','платья','джинсы','пальто','женская одежда','мужская одежда','тренды'],
    rubrics: ['Новинки','Луки','Скидки','Советы стилиста'],
    priceItems: [
      { id:'p1', category:'Верхняя одежда', name:'Пальто', price:'от 3 500 ₽', emoji:'🧥', inStock:true },
      { id:'p2', category:'Платья', name:'Летнее платье', price:'от 1 200 ₽', emoji:'👗', inStock:true },
      { id:'p3', category:'Джинсы', name:'Прямые джинсы', price:'от 1 800 ₽', emoji:'👖', inStock:true },
      { id:'p4', category:'Кофты', name:'Оверсайз худи', price:'от 1 400 ₽', emoji:'👕', inStock:true },
      { id:'p5', category:'Аксессуары', name:'Сумка', price:'от 1 500 ₽', emoji:'👜', inStock:true },
    ],
  },
  {
    id: 'electronics',
    emoji: '📱',
    name: 'Магазин техники',
    type: 'retail',
    category: 'tech',
    color: '#0ea5e9',
    gradient: 'linear-gradient(135deg,#000a15 0%,#001a30 100%)',
    exampleName: 'TechStore',
    exampleDesc: 'Смартфоны, ноутбуки, гаджеты и аксессуары. Лучшие цены, официальная гарантия, собственный сервис.',
    usp: '✅ Официальная гарантия · 💰 Трейд-ин по лучшей цене · 🔧 Сервис в том же месте',
    tags: ['техника','гаджеты','телефон','ноутбук','электроника'],
    keywords: ['магазин техники','смартфон','ноутбук','планшет','наушники','электроника','гаджеты','apple','samsung'],
    rubrics: ['Новинки','Акции','Обзоры','Сравнения'],
    priceItems: [
      { id:'p1', category:'Смартфоны', name:'iPhone 15', price:'от 79 990 ₽', emoji:'📱', inStock:true },
      { id:'p2', category:'Смартфоны', name:'Samsung Galaxy S24', price:'от 59 990 ₽', emoji:'📱', inStock:true },
      { id:'p3', category:'Ноутбуки', name:'MacBook Air M2', price:'от 89 990 ₽', emoji:'💻', inStock:true },
      { id:'p4', category:'Аксессуары', name:'AirPods Pro 2', price:'от 19 990 ₽', emoji:'🎧', inStock:true },
      { id:'p5', category:'Планшеты', name:'iPad 10', price:'от 39 990 ₽', emoji:'📲', inStock:true },
    ],
  },
  {
    id: 'photography',
    emoji: '📸',
    name: 'Фотостудия / Фотограф',
    type: 'services',
    category: 'creative',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg,#080015 0%,#150030 100%)',
    exampleName: 'Фотостудия «Кадр»',
    exampleDesc: 'Профессиональные фотосессии: портретные, семейные, свадебные, корпоративные. Обработка за 3 дня.',
    usp: '📸 Профессиональное оборудование · ✂️ Обработка за 3 дня · 🎨 Авторский стиль',
    tags: ['фотограф','фотосессия','свадьба','портрет','фотостудия'],
    keywords: ['фотограф','фотосессия','свадебный фотограф','портретная фотография','семейная фотосессия','корпоративное фото'],
    rubrics: ['Портфолио','Пакеты','Backstage','Советы'],
    employees: [
      { id:'e1', name:'Артём', role:'Свадебный и портретный фотограф', emoji:'📸', rating:5.0, bio:'Фотограф с 2015 года. Свадьбы, помолвки, романтические истории. Авторский светлый стиль.', bookingSlots:['09:00','12:00','15:00','18:00'] },
      { id:'e2', name:'Юлия', role:'Семейный и детский фотограф', emoji:'👨‍👩‍👧', rating:4.9, bio:'Специализация на детях от 0 до 12 лет. Умею найти подход к самым непоседливым.', bookingSlots:['10:00','13:00','16:00'] },
    ],
    priceItems: [
      { id:'p1', category:'Фотосессии', name:'Студийная портретная', price:'от 3 000 ₽', unit:'час', emoji:'🖼️' },
      { id:'p2', category:'Фотосессии', name:'Семейная (выездная)', price:'от 5 000 ₽', unit:'2 часа', emoji:'👨‍👩‍👧' },
      { id:'p3', category:'Фотосессии', name:'Свадебная', price:'от 15 000 ₽', unit:'день', emoji:'💍' },
      { id:'p4', category:'Фотосессии', name:'Лавстори', price:'от 7 000 ₽', unit:'2 часа', emoji:'❤️' },
      { id:'p5', category:'Обработка', name:'Ретушь 10 фото', price:'от 1 500 ₽', emoji:'✨' },
    ],
  },
  {
    id: 'vet',
    emoji: '🐾',
    name: 'Ветеринарная клиника',
    type: 'services',
    category: 'health',
    color: '#34d399',
    gradient: 'linear-gradient(135deg,#001510 0%,#002a20 100%)',
    exampleName: 'Ветклиника «Лапа»',
    exampleDesc: 'Профессиональная ветеринарная помощь для кошек, собак, экзотических животных. Круглосуточно.',
    usp: '🕐 Работаем 24/7 · 🏥 Опытные врачи · 💉 Полное оснащение на месте',
    tags: ['ветеринар','животные','кошки','собаки','ветклиника'],
    keywords: ['ветеринар','ветклиника','животные','кошки','собаки','прививки','кастрация','лечение животных','груминг'],
    rubrics: ['Наши питомцы','Советы','Акции','Вопрос ветеринару'],
    employees: [
      { id:'e1', name:'Светлана', role:'Терапевт · хирург', emoji:'🩺', rating:5.0, bio:'Ветеринарный врач высшей категории. 12 лет практики. Специализация: хирургия, внутренние болезни.', bookingSlots:['09:00','11:00','13:00','15:00','17:00'] },
      { id:'e2', name:'Игорь', role:'Стоматолог · дерматолог', emoji:'🦷', rating:4.8, bio:'Ветеринарная стоматология, лечение кожных заболеваний, аллергии.', bookingSlots:['10:00','12:00','14:00','16:00'] },
    ],
    priceItems: [
      { id:'p1', category:'Консультации', name:'Первичный приём', price:'700 ₽', emoji:'🩺' },
      { id:'p2', category:'Процедуры', name:'Прививка комплексная', price:'500 ₽', emoji:'💉' },
      { id:'p3', category:'Операции', name:'Стерилизация (кошка)', price:'от 3 500 ₽', emoji:'⚕️' },
      { id:'p4', category:'Диагностика', name:'УЗИ', price:'1 000 ₽', emoji:'🔬' },
      { id:'p5', category:'Уход', name:'Груминг (собака)', price:'от 1 500 ₽', emoji:'🛁' },
    ],
  },
];

/* ══════════ ВЫБОР ШАБЛОНА ══════════ */
const TYPE_LABELS: Record<TemplateType|'all', string> = {
  all: 'Все',
  services: '🤝 Услуги',
  retail: '🛒 Торговля',
  food: '🍽️ Еда',
  general: '🌟 Другое',
};

export function TemplatePicker({
  c, accent, onSelect, onSkip,
}: {
  c: any; accent: string;
  onSelect: (t: ChannelTemplate) => void;
  onSkip: () => void;
}) {
  const [filter, setFilter] = useState<TemplateType|'all'>('all');
  const [preview, setPreview] = useState<ChannelTemplate | null>(null);

  const filtered = filter === 'all' ? CHANNEL_TEMPLATES : CHANNEL_TEMPLATES.filter(t => t.type === filter);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Заголовок */}
      <div style={{ padding:'0 0 16px' }}>
        <p style={{ margin:'0 0 4px', fontSize:22, fontWeight:900, color:c.light }}>📋 Выбери шаблон</p>
        <p style={{ margin:0, fontSize:13, color:c.sub }}>Готовая структура под твой бизнес. Всё можно изменить.</p>
      </div>

      {/* Фильтр по типу */}
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap' }}>
        {(['all','services','retail','food'] as const).map(f => (
          <button key={f} onClick={()=>setFilter(f)}
            style={{ padding:'6px 14px', borderRadius:20, border:`1.5px solid ${filter===f?accent:'rgba(255,255,255,0.12)'}`,
              background: filter===f?`${accent}22`:'transparent', color: filter===f?accent:c.sub,
              fontSize:12, fontWeight:700, cursor:'pointer' }}>
            {TYPE_LABELS[f]}
          </button>
        ))}
      </div>

      {/* Сетка шаблонов */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, overflowY:'auto', flex:1, paddingBottom:8 }}>
        {filtered.map(t => (
          <motion.button key={t.id} whileTap={{ scale:0.96 }} onClick={()=>setPreview(t)}
            style={{ padding:14, borderRadius:16, background:t.gradient, border:`2px solid transparent`,
              cursor:'pointer', textAlign:'left', position:'relative', overflow:'hidden' }}>
            <div style={{ fontSize:28, lineHeight:1, marginBottom:6 }}>{t.emoji}</div>
            <div style={{ fontSize:12, fontWeight:800, color:'#fff', marginBottom:3, lineHeight:1.3 }}>{t.name}</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', fontWeight:600 }}>
              {t.type==='services'?'Услуги · Запись':t.type==='retail'?'Торговля · Каталог':t.type==='food'?'Еда · Меню':'Общее'}
            </div>
            {t.employees && (
              <div style={{ position:'absolute', top:10, right:10, fontSize:10, color:t.color,
                background:`${t.color}22`, borderRadius:8, padding:'2px 6px', fontWeight:700 }}>
                {t.employees.length} мастера
              </div>
            )}
          </motion.button>
        ))}
      </div>

      {/* Пропустить */}
      <button onClick={onSkip}
        style={{ marginTop:14, padding:'12px', borderRadius:14, border:`1px solid rgba(255,255,255,0.12)`,
          background:'transparent', color:c.sub, fontSize:13, cursor:'pointer', fontWeight:600 }}>
        Начать с чистого листа →
      </button>

      {/* Превью шаблона */}
      <AnimatePresence>
        {preview && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:10,
              display:'flex', flexDirection:'column', overflowY:'auto' }}>
            <div style={{ maxWidth:480, width:'100%', margin:'0 auto', padding:'20px 16px 40px' }}>

              {/* Шапка превью */}
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
                <button onClick={()=>setPreview(null)}
                  style={{ background:'rgba(255,255,255,0.1)', border:'none', borderRadius:12,
                    width:36, height:36, fontSize:16, cursor:'pointer', color:'#fff' }}>←</button>
                <div style={{ flex:1 }}>
                  <p style={{ margin:0, fontSize:16, fontWeight:900, color:'#fff' }}>{preview.emoji} {preview.name}</p>
                  <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.5)' }}>Предпросмотр шаблона</p>
                </div>
              </div>

              {/* Карточка-пример канала */}
              <div style={{ borderRadius:20, overflow:'hidden', marginBottom:16, border:'1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ height:120, background:preview.gradient, display:'flex', alignItems:'flex-end', padding:'16px' }}>
                  <div style={{ width:56, height:56, borderRadius:18, background:`${preview.color}33`,
                    border:`2px solid ${preview.color}`, display:'flex', alignItems:'center',
                    justifyContent:'center', fontSize:26, marginRight:12 }}>{preview.emoji}</div>
                  <div>
                    <p style={{ margin:0, fontSize:16, fontWeight:900, color:'#fff' }}>{preview.exampleName}</p>
                    <p style={{ margin:0, fontSize:11, color:`${preview.color}` }}>@{preview.id}_example</p>
                  </div>
                </div>
                <div style={{ background:'#111', padding:'14px' }}>
                  <p style={{ margin:'0 0 10px', fontSize:13, color:'rgba(255,255,255,0.75)', lineHeight:1.4 }}>{preview.exampleDesc}</p>
                  {/* USP */}
                  <div style={{ padding:'10px 12px', borderRadius:12, background:`${preview.color}15`,
                    border:`1px solid ${preview.color}40`, marginBottom:10 }}>
                    <p style={{ margin:0, fontSize:11, color:preview.color, fontWeight:700, lineHeight:1.5 }}>{preview.usp}</p>
                  </div>
                  {/* Теги */}
                  <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:10 }}>
                    {preview.tags.map(t => (
                      <span key={t} style={{ padding:'3px 8px', borderRadius:12, background:'rgba(255,255,255,0.07)',
                        border:'1px solid rgba(255,255,255,0.1)', fontSize:11, color:'rgba(255,255,255,0.6)' }}>#{t}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Сотрудники (если есть) */}
              {preview.employees && preview.employees.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <p style={{ margin:'0 0 10px', fontSize:13, fontWeight:800, color:'#fff' }}>👥 Наша команда</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {preview.employees.map(e => (
                      <div key={e.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px',
                        borderRadius:14, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)' }}>
                        <div style={{ width:44, height:44, borderRadius:14, background:`${preview.color}22`,
                          border:`1.5px solid ${preview.color}55`, display:'flex', alignItems:'center',
                          justifyContent:'center', fontSize:20, flexShrink:0 }}>{e.emoji}</div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ margin:0, fontSize:13, fontWeight:800, color:'#fff' }}>{e.name}</p>
                          <p style={{ margin:'2px 0 0', fontSize:11, color:preview.color, fontWeight:600 }}>{e.role}</p>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                          <span style={{ fontSize:12 }}>⭐</span>
                          <span style={{ fontSize:12, fontWeight:800, color:'#fbbf24' }}>{e.rating?.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Прайс (если есть) */}
              {preview.priceItems && preview.priceItems.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <p style={{ margin:'0 0 10px', fontSize:13, fontWeight:800, color:'#fff' }}>
                    {preview.type==='food'?'📋 Меню':preview.type==='retail'?'🛒 Каталог':'💰 Прайс-лист'}
                  </p>
                  <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                    {preview.priceItems.slice(0,5).map(item => (
                      <div key={item.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px',
                        borderRadius:12, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)' }}>
                        <span style={{ fontSize:18, flexShrink:0 }}>{item.emoji}</span>
                        <span style={{ flex:1, fontSize:13, color:'rgba(255,255,255,0.85)', fontWeight:600 }}>{item.name}</span>
                        <span style={{ fontSize:13, fontWeight:800, color:preview.color, flexShrink:0 }}>{item.price}</span>
                      </div>
                    ))}
                    {preview.priceItems.length > 5 && (
                      <p style={{ margin:0, fontSize:11, color:'rgba(255,255,255,0.35)', textAlign:'center' }}>
                        +{preview.priceItems.length-5} позиций
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Ключевые слова */}
              <div style={{ marginBottom:24, padding:'12px', borderRadius:14,
                background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)' }}>
                <p style={{ margin:'0 0 8px', fontSize:12, fontWeight:700, color:preview.color }}>🔍 Ключевые слова для поиска</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                  {preview.keywords.map(k => (
                    <span key={k} style={{ padding:'3px 8px', borderRadius:10, background:`${preview.color}15`,
                      border:`1px solid ${preview.color}30`, fontSize:11, color:'rgba(255,255,255,0.6)' }}>{k}</span>
                  ))}
                </div>
              </div>

              {/* Кнопка выбора */}
              <motion.button whileTap={{ scale:0.96 }} onClick={()=>{ onSelect(preview); setPreview(null); }}
                style={{ width:'100%', padding:'16px', borderRadius:18, border:'none', cursor:'pointer',
                  background:`linear-gradient(135deg,${preview.color}cc,${preview.color})`,
                  color:'#000', fontSize:16, fontWeight:900, fontFamily:'inherit' }}>
                Использовать этот шаблон {preview.emoji}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════ БЛОК СОТРУДНИКОВ В КАНАЛЕ ══════════ */
export function ChannelEmployeeRoster({
  employees, color, c,
}: {
  employees: ChannelEmployee[]; color: string; c: any;
}) {
  const [selected, setSelected] = useState<ChannelEmployee | null>(null);
  const [bookedSlot, setBookedSlot] = useState<string | null>(null);

  return (
    <div style={{ padding:'14px 16px', borderBottom:`1px solid ${c.border}` }}>
      <p style={{ margin:'0 0 12px', fontSize:14, fontWeight:900, color:c.light }}>👥 Наша команда</p>
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {employees.map(e => (
          <motion.button key={e.id} whileTap={{ scale:0.97 }} onClick={()=>{ setSelected(e); setBookedSlot(null); }}
            style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:16,
              background:c.card||'rgba(255,255,255,0.05)', border:`1px solid ${c.border}`,
              cursor:'pointer', textAlign:'left', width:'100%' }}>
            <div style={{ width:48, height:48, borderRadius:16, background:`${color}22`,
              border:`2px solid ${color}55`, display:'flex', alignItems:'center',
              justifyContent:'center', fontSize:22, flexShrink:0 }}>
              {e.photoUrl ? <img src={e.photoUrl} alt={e.name} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:14 }}/> : e.emoji}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ margin:0, fontSize:14, fontWeight:800, color:c.light }}>{e.name}</p>
              <p style={{ margin:'2px 0 0', fontSize:12, color, fontWeight:600 }}>{e.role}</p>
              {e.rating && (
                <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:4 }}>
                  {[1,2,3,4,5].map(i=>(
                    <span key={i} style={{ fontSize:10, opacity: i<=Math.round(e.rating!) ? 1 : 0.25 }}>⭐</span>
                  ))}
                  <span style={{ fontSize:11, color:'#fbbf24', fontWeight:700, marginLeft:2 }}>{e.rating.toFixed(1)}</span>
                </div>
              )}
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
              {e.bookingSlots && e.bookingSlots.length > 0 && (
                <span style={{ fontSize:10, fontWeight:700, color, background:`${color}18`,
                  borderRadius:8, padding:'3px 7px' }}>📅 Записаться</span>
              )}
            </div>
          </motion.button>
        ))}
      </div>

      {/* Модал сотрудника */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:300,
              display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
            <motion.div initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}
              transition={{type:'spring',damping:28,stiffness:280}}
              style={{ background:c.bg, borderRadius:'24px 24px 0 0', padding:'24px 20px 40px',
                maxHeight:'85vh', overflowY:'auto' }}>

              {/* Кнопка закрытия */}
              <button onClick={()=>setSelected(null)}
                style={{ position:'absolute', top:16, right:16, background:'rgba(255,255,255,0.1)',
                  border:'none', borderRadius:12, width:34, height:34, fontSize:16, cursor:'pointer', color:c.light }}>✕</button>

              {/* Аватар и инфо */}
              <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:16 }}>
                <div style={{ width:72, height:72, borderRadius:20, background:`${color}22`,
                  border:`3px solid ${color}`, display:'flex', alignItems:'center',
                  justifyContent:'center', fontSize:34, flexShrink:0 }}>
                  {selected.photoUrl
                    ? <img src={selected.photoUrl} alt={selected.name} style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:17 }}/>
                    : selected.emoji}
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ margin:0, fontSize:20, fontWeight:900, color:c.light }}>{selected.name}</p>
                  <p style={{ margin:'4px 0 0', fontSize:13, color, fontWeight:700 }}>{selected.role}</p>
                  {selected.rating && (
                    <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:6 }}>
                      <span style={{ fontSize:16 }}>⭐</span>
                      <span style={{ fontSize:16, fontWeight:900, color:'#fbbf24' }}>{selected.rating.toFixed(1)}</span>
                      <span style={{ fontSize:12, color:c.sub }}>рейтинг</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Биография */}
              {selected.bio && (
                <div style={{ padding:'12px 14px', borderRadius:14, background:c.card||'rgba(255,255,255,0.05)',
                  border:`1px solid ${c.border}`, marginBottom:16 }}>
                  <p style={{ margin:0, fontSize:13, color:c.sub, lineHeight:1.5 }}>{selected.bio}</p>
                </div>
              )}

              {/* Слоты записи */}
              {selected.bookingSlots && selected.bookingSlots.length > 0 && (
                <div>
                  <p style={{ margin:'0 0 10px', fontSize:14, fontWeight:800, color:c.light }}>📅 Выбери удобное время</p>
                  <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                    {selected.bookingSlots.map(slot => {
                      const isBooked = bookedSlot === slot;
                      return (
                        <motion.button key={slot} whileTap={{ scale:0.94 }} onClick={()=>setBookedSlot(isBooked?null:slot)}
                          style={{ padding:'10px 16px', borderRadius:12,
                            border:`2px solid ${isBooked?color:'rgba(255,255,255,0.15)'}`,
                            background: isBooked?`${color}22`:'transparent',
                            color: isBooked?color:c.light, fontSize:14, fontWeight:700, cursor:'pointer' }}>
                          {isBooked?'✓ ':''}{slot}
                        </motion.button>
                      );
                    })}
                  </div>
                  {bookedSlot && (
                    <motion.button initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
                      style={{ width:'100%', marginTop:16, padding:'15px', borderRadius:18, border:'none',
                        background:`linear-gradient(135deg,${color}cc,${color})`, color:'#000',
                        fontSize:15, fontWeight:900, cursor:'pointer', fontFamily:'inherit' }}>
                      📅 Записаться на {bookedSlot} к {selected.name}
                    </motion.button>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ══════════ ПРАЙС-ЛИСТ / МЕНЮ / КАТАЛОГ ══════════ */
export function ChannelPriceList({
  items, color, c, type,
}: {
  items: PriceItem[]; color: string; c: any;
  type: TemplateType;
}) {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = ['all', ...Array.from(new Set(items.map(i => i.category||'').filter(Boolean)))];
  const filtered = activeCategory === 'all' ? items : items.filter(i => i.category === activeCategory);

  const title = type === 'food' ? '📋 Меню' : type === 'retail' ? '🛒 Каталог' : '💰 Прайс-лист';

  return (
    <div style={{ padding:'14px 16px' }}>
      <p style={{ margin:'0 0 12px', fontSize:14, fontWeight:900, color:c.light }}>{title}</p>

      {/* Категории */}
      {categories.length > 2 && (
        <div style={{ display:'flex', gap:6, marginBottom:12, overflowX:'auto', paddingBottom:4 }}>
          {categories.map(cat => (
            <button key={cat} onClick={()=>setActiveCategory(cat)}
              style={{ padding:'5px 12px', borderRadius:14, flexShrink:0,
                border:`1.5px solid ${activeCategory===cat?color:'rgba(255,255,255,0.1)'}`,
                background: activeCategory===cat?`${color}18`:'transparent',
                color: activeCategory===cat?color:c.sub, fontSize:12, fontWeight:700, cursor:'pointer' }}>
              {cat === 'all' ? 'Всё' : cat}
            </button>
          ))}
        </div>
      )}

      {/* Позиции */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {filtered.map(item => (
          <div key={item.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 14px',
            borderRadius:14, background:c.card||'rgba(255,255,255,0.04)',
            border:`1px solid ${c.border}`, position:'relative', overflow:'hidden' }}>
            {item.emoji && (
              <span style={{ fontSize:22, flexShrink:0 }}>{item.emoji}</span>
            )}
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ margin:0, fontSize:13, fontWeight:700, color:c.light }}>{item.name}</p>
              {item.description && (
                <p style={{ margin:'2px 0 0', fontSize:11, color:c.sub, lineHeight:1.3 }}>{item.description}</p>
              )}
              {item.unit && (
                <p style={{ margin:'2px 0 0', fontSize:11, color:c.sub }}>{item.unit}</p>
              )}
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:4, flexShrink:0 }}>
              <span style={{ fontSize:14, fontWeight:900, color }}>{item.price}</span>
              {item.inStock !== undefined && (
                <span style={{ fontSize:10, fontWeight:700,
                  color: item.inStock?'#22c55e':'#ef4444' }}>
                  {item.inStock?'● В наличии':'○ Нет'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ══════════ USP БАННЕР ══════════ */
export function ChannelUSPBanner({ usp, color, c }: { usp:string; color:string; c:any }) {
  return (
    <div style={{ padding:'10px 16px', borderBottom:`1px solid ${c.border}` }}>
      <div style={{ padding:'12px 14px', borderRadius:14, background:`${color}12`,
        border:`1px solid ${color}35` }}>
        <p style={{ margin:0, fontSize:12, fontWeight:700, color, lineHeight:1.6 }}>{usp}</p>
      </div>
    </div>
  );
}
