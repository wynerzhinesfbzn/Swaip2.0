import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useBackHandler } from './backHandler';

type KidsCat = 'Все' | 'Спорт' | 'Музыка' | 'Танцы' | 'Творчество' | 'IT и Наука' | 'Языки' | 'Онлайн';
const CATS: KidsCat[] = ['Все','Спорт','Музыка','Танцы','Творчество','IT и Наука','Языки','Онлайн'];
const CAT_EMOJI: Record<string,string> = { 'Спорт':'⚽','Музыка':'🎵','Танцы':'💃','Творчество':'🎨','IT и Наука':'💻','Языки':'🌍','Онлайн':'📱' };
const CAT_COLOR: Record<string,string> = { 'Спорт':'#f97316','Музыка':'#8b5cf6','Танцы':'#ec4899','Творчество':'#06b6d4','IT и Наука':'#22c55e','Языки':'#3b82f6','Онлайн':'#a78bfa' };

type City = { name:string; nav:string; };
const CITIES: City[] = [
  {name:'Москва',nav:'р77'},{name:'Санкт-Петербург',nav:'р78'},{name:'Новосибирск',nav:'р54'},
  {name:'Екатеринбург',nav:'р66'},{name:'Казань',nav:'р16'},{name:'Нижний Новгород',nav:'р52'},
  {name:'Красноярск',nav:'р24'},{name:'Челябинск',nav:'р74'},{name:'Самара',nav:'р63'},
  {name:'Уфа',nav:'р02'},{name:'Ростов-на-Дону',nav:'р61'},{name:'Краснодар',nav:'р23'},
  {name:'Омск',nav:'р55'},{name:'Воронеж',nav:'р36'},{name:'Пермь',nav:'р59'},
  {name:'Волгоград',nav:'р34'},{name:'Тюмень',nav:'р72'},{name:'Томск',nav:'р70'},
  {name:'Иркутск',nav:'р38'},{name:'Хабаровск',nav:'р27'},{name:'Владивосток',nav:'р25'},
  {name:'Ярославль',nav:'р76'},{name:'Барнаул',nav:'р22'},{name:'Тула',nav:'р71'},
  {name:'Саратов',nav:'р64'},{name:'Рязань',nav:'р62'},{name:'Тольятти',nav:'р63'},
  {name:'Астрахань',nav:'р30'},{name:'Ижевск',nav:'р18'},{name:'Махачкала',nav:'р05'},
];

type KidsClub = {
  id:string; city:string; name:string; cat:Exclude<KidsCat,'Все'|'Онлайн'>;
  desc:string; age:string; address?:string; url?:string; phone?:string; price?:string; free?:boolean;
};

const CLUBS: KidsClub[] = [
  // МОСКВА
  {id:'m1',city:'Москва',name:'Академия ЦСКА',cat:'Спорт',desc:'Футбол, баскетбол, хоккей, волейбол. Одна из крупнейших спортивных академий страны.',age:'5–18 лет',address:'Ленинградский просп., 39',url:'https://cska.ru',price:'от 3 500 ₽/мес'},
  {id:'m2',city:'Москва',name:'Спорткомплекс Лужники',cat:'Спорт',desc:'Плавание, лёгкая атлетика, художественная гимнастика, теннис.',age:'4–18 лет',address:'Лужнецкая наб., 24',url:'https://luzhniki.ru',price:'от 2 000 ₽/мес'},
  {id:'m3',city:'Москва',name:'ДМШ им. Гнесиных',cat:'Музыка',desc:'Фортепиано, скрипка, виолончель, флейта, гитара. Одна из старейших музыкальных школ Москвы.',age:'6–17 лет',address:'Поварская ул., 30–36',url:'https://gnesin.ru',free:true},
  {id:'m4',city:'Москва',name:'Yamaha Music School',cat:'Музыка',desc:'Японская методика обучения музыке с 4 лет. Ансамблевое и сольное обучение.',age:'4–16 лет',url:'https://yamaha-music.ru',price:'от 4 500 ₽/мес'},
  {id:'m5',city:'Москва',name:'CODDY — школа программирования',cat:'IT и Наука',desc:'Python, Roblox, Minecraft, веб-разработка, игровые движки. 150+ направлений.',age:'5–17 лет',url:'https://coddyschool.com',price:'от 4 000 ₽/мес'},
  {id:'m6',city:'Москва',name:'Робошкола',cat:'IT и Наука',desc:'Робототехника, Arduino, 3D-печать, программирование LEGO Mindstorms.',age:'5–14 лет',url:'https://roboshkola.ru',price:'от 3 500 ₽/мес'},
  {id:'m7',city:'Москва',name:'Школа балета «Лебедь»',cat:'Танцы',desc:'Классический балет, contemporary, народные танцы. Профессиональные педагоги.',age:'3–16 лет',url:'https://lebedschool.ru',price:'от 3 000 ₽/мес'},
  {id:'m8',city:'Москва',name:'Todes Dance Studio',cat:'Танцы',desc:'Hip-hop, jazz funk, contemporary. Подготовка к конкурсам и фестивалям.',age:'5–18 лет',url:'https://todes.ru',price:'от 2 500 ₽/мес'},
  {id:'m9',city:'Москва',name:'BKC-ih Языковая Школа',cat:'Языки',desc:'Английский, немецкий, французский, китайский для детей. Группы по возрасту.',age:'4–17 лет',url:'https://bkc.ru',price:'от 5 000 ₽/мес'},
  {id:'m10',city:'Москва',name:'Студия «Арт-Класс»',cat:'Творчество',desc:'Рисунок, живопись, скульптура, дизайн. Подготовка в художественные вузы.',age:'5–17 лет',price:'от 2 800 ₽/мес'},
  {id:'m11',city:'Москва',name:'Русская шахматная школа',cat:'IT и Наука',desc:'Шахматы от нуля до мастера. Рейтинговые турниры, онлайн-платформа.',age:'4–18 лет',url:'https://russiachess.ru',price:'от 2 500 ₽/мес'},
  {id:'m12',city:'Москва',name:'Кванториум Москва',cat:'IT и Наука',desc:'VR/AR, робототехника, аэроквантум, IT-квантум. Государственная программа.',age:'10–18 лет',url:'https://kvantorium.ru',free:true},
  // СПБ
  {id:'spb1',city:'Санкт-Петербург',name:'Академия «Зенит»',cat:'Спорт',desc:'Футбол. Официальная академия ФК Зенит. Отбор по всем возрастным группам.',age:'5–17 лет',url:'https://fc-zenit.ru/academy',price:'от 2 000 ₽/мес'},
  {id:'spb2',city:'Санкт-Петербург',name:'IT-школа Samsung',cat:'IT и Наука',desc:'Бесплатное обучение программированию, дизайну и мобильным технологиям.',age:'12–18 лет',url:'https://samsung.com/ru/microsite/it-school',free:true},
  {id:'spb3',city:'Санкт-Петербург',name:'ДМШ № 1 им. Римского-Корсакова',cat:'Музыка',desc:'Старейшая музыкальная школа города. Фортепиано, струнные, духовые.',age:'6–17 лет',address:'Загородный просп., 40',free:true},
  {id:'spb4',city:'Санкт-Петербург',name:'Школа танцев Step',cat:'Танцы',desc:'Hip-hop, breakdance, waacking, dancehall. Проф. тренеры, чемпионы России.',age:'6–18 лет',price:'от 2 500 ₽/мес'},
  {id:'spb5',city:'Санкт-Петербург',name:'Точка роста СПб',cat:'IT и Наука',desc:'VR/AR технологии, робототехника, 3D-моделирование. Программы STEM.',age:'7–16 лет',free:true},
  {id:'spb6',city:'Санкт-Петербург',name:'EF English First Kids',cat:'Языки',desc:'Английский язык по международной методике. Подготовка к Cambridge.',age:'5–17 лет',url:'https://ef.ru',price:'от 5 500 ₽/мес'},
  {id:'spb7',city:'Санкт-Петербург',name:'ДХШ № 1 Петербурга',cat:'Творчество',desc:'Рисунок, живопись, декоративно-прикладное искусство. Государственная школа.',age:'7–17 лет',address:'ул. Фурштатская, 54',free:true},
  // НОВОСИБИРСК
  {id:'nsk1',city:'Новосибирск',name:'Хоккейная академия «Сибирь»',cat:'Спорт',desc:'Хоккей. Официальная академия ХК Сибирь. Профессиональный лёд.',age:'5–17 лет',url:'https://hcsiberia.ru',price:'от 3 000 ₽/мес'},
  {id:'nsk2',city:'Новосибирск',name:'Кванториум Новосибирск',cat:'IT и Наука',desc:'IT, аэроквантум, биоквантум, нейроквантум. Бесплатно.',age:'10–18 лет',url:'https://kvantorium.ru',free:true},
  {id:'nsk3',city:'Новосибирск',name:'ДМШ им. Глинки',cat:'Музыка',desc:'Фортепиано, гитара, скрипка, флейта. Один из лучших коллективов региона.',age:'6–17 лет',free:true},
  {id:'nsk4',city:'Новосибирск',name:'Школа танцев Pulse',cat:'Танцы',desc:'Hip-hop, contemporary, jazz funk, cheerleading. Чемпионы СФО.',age:'4–18 лет',price:'от 2 000 ₽/мес'},
  {id:'nsk5',city:'Новосибирск',name:'СДЮШОР по плаванию',cat:'Спорт',desc:'Плавание всех стилей. Подготовка от нуля до уровня КМС.',age:'6–18 лет',free:true},
  {id:'nsk6',city:'Новосибирск',name:'Алгоритмика Новосибирск',cat:'IT и Наука',desc:'Python, Scratch, веб, мобильные приложения. Опытные преподаватели.',age:'5–17 лет',url:'https://algoritmika.org',price:'от 2 500 ₽/мес'},
  // ЕКАТЕРИНБУРГ
  {id:'ekb1',city:'Екатеринбург',name:'Академия ФК «Урал»',cat:'Спорт',desc:'Футбол. Официальная школа ФК Урал. Тренировки на профессиональных полях.',age:'5–17 лет',url:'https://fc-ural.ru',price:'от 2 000 ₽/мес'},
  {id:'ekb2',city:'Екатеринбург',name:'Кванториум Екатеринбург',cat:'IT и Наука',desc:'Аэроквантум, IT-квантум, биоквантум. Бесплатные занятия.',age:'10–18 лет',url:'https://kvantorium.ru',free:true},
  {id:'ekb3',city:'Екатеринбург',name:'ДЮСШ художественной гимнастики',cat:'Спорт',desc:'Художественная гимнастика. Подготовка от начинающих до мастеров спорта.',age:'4–16 лет',free:true},
  {id:'ekb4',city:'Екатеринбург',name:'Центр современного танца',cat:'Танцы',desc:'Contemporary dance, балет, джаз, street dance. Профессиональные постановки.',age:'5–18 лет',price:'от 2 200 ₽/мес'},
  {id:'ekb5',city:'Екатеринбург',name:'Языковой центр Globus',cat:'Языки',desc:'Английский, немецкий, китайский для детей. Международные сертификаты.',age:'4–17 лет',price:'от 3 000 ₽/мес'},
  {id:'ekb6',city:'Екатеринбург',name:'ДМШ № 1 им. Чайковского',cat:'Музыка',desc:'Классическое музыкальное образование. Все инструменты. Госшкола.',age:'6–17 лет',free:true},
  // КАЗАНЬ
  {id:'kzn1',city:'Казань',name:'ХК «Ак Барс» — детская школа',cat:'Спорт',desc:'Хоккей. Школа чемпионов КХЛ. Лучший лёд Татарстана.',age:'5–17 лет',url:'https://akbars.ru',price:'от 2 500 ₽/мес'},
  {id:'kzn2',city:'Казань',name:'IT-парк Казань — дети',cat:'IT и Наука',desc:'Программирование, дизайн, кибербезопасность. Официальный технопарк.',age:'8–18 лет',url:'https://itpark.ru',price:'от 2 000 ₽/мес'},
  {id:'kzn3',city:'Казань',name:'Казанское хореографическое училище',cat:'Танцы',desc:'Классический балет, народные танцы. Подготовительные классы для малышей.',age:'4–10 лет',free:true},
  {id:'kzn4',city:'Казань',name:'Татарская государственная ДМШ',cat:'Музыка',desc:'Фортепиано, скрипка, домра, баян, народные инструменты.',age:'6–17 лет',free:true},
  {id:'kzn5',city:'Казань',name:'Центр «Сэлэт»',cat:'IT и Наука',desc:'Развитие одарённых детей: олимпиадная математика, наука, технологии.',age:'7–16 лет'},
  // КРАСНОДАР
  {id:'krd1',city:'Краснодар',name:'Академия ФК «Краснодар»',cat:'Спорт',desc:'Одна из лучших футбольных академий России. Современная инфраструктура.',age:'5–17 лет',url:'https://fckrasnodar.ru/academy',price:'от 2 000 ₽/мес'},
  {id:'krd2',city:'Краснодар',name:'Кванториум Краснодар',cat:'IT и Наука',desc:'Программирование, VR/AR, робототехника. Бесплатные программы.',age:'10–18 лет',free:true},
  {id:'krd3',city:'Краснодар',name:'Школа танцев «Вегас»',cat:'Танцы',desc:'Восточные танцы, contemporary, hip-hop. Победители краевых конкурсов.',age:'4–17 лет',price:'от 1 800 ₽/мес'},
  {id:'krd4',city:'Краснодар',name:'ДМШ № 1 им. Скаткина',cat:'Музыка',desc:'Классические инструменты. Лучшая музыкальная школа Краснодарского края.',age:'6–17 лет',free:true},
  // РОСТОВ-НА-ДОНУ
  {id:'rst1',city:'Ростов-на-Дону',name:'Академия ФК «Ростов»',cat:'Спорт',desc:'Футбол. Официальная академия. Лучшие условия для юных футболистов юга.',age:'5–17 лет',url:'https://fc-rostov.ru',price:'от 1 500 ₽/мес'},
  {id:'rst2',city:'Ростов-на-Дону',name:'Кванториум Ростов',cat:'IT и Наука',desc:'IT, аэроквантум, геоквантум. Государственная программа.',age:'10–18 лет',free:true},
  {id:'rst3',city:'Ростов-на-Дону',name:'Ростовское хореографическое училище',cat:'Танцы',desc:'Классический балет, народные танцы. Подготовительные классы.',age:'4–10 лет',free:true},
  {id:'rst4',city:'Ростов-на-Дону',name:'ДМШ № 1 Ростова',cat:'Музыка',desc:'Все музыкальные специальности. Лауреаты всероссийских конкурсов.',age:'6–17 лет',free:true},
  // УФА
  {id:'ufa1',city:'Уфа',name:'ХК «Салават Юлаев» — Академия',cat:'Спорт',desc:'Хоккей. Школа легендарного клуба КХЛ. Лучший лёд Башкортостана.',age:'5–17 лет',price:'от 2 000 ₽/мес'},
  {id:'ufa2',city:'Уфа',name:'Кванториум Уфа',cat:'IT и Наука',desc:'Промышленный дизайн, робототехника, IT, виртуальная реальность.',age:'10–18 лет',free:true},
  {id:'ufa3',city:'Уфа',name:'Уфимское хореографическое училище',cat:'Танцы',desc:'Балет, народные и башкирские национальные танцы. Профессиональные педагоги.',age:'5–10 лет',free:true},
  // САМАРА
  {id:'sam1',city:'Самара',name:'Академия ФК «Крылья Советов»',cat:'Спорт',desc:'Футбол. Официальная академия исторического клуба РПЛ.',age:'5–17 лет',url:'https://kc-camara.ru',price:'от 1 500 ₽/мес'},
  {id:'sam2',city:'Самара',name:'Кванториум Самара',cat:'IT и Наука',desc:'IT-квантум, аэроквантум, нейроквантум, робоквантум.',age:'10–18 лет',free:true},
  {id:'sam3',city:'Самара',name:'СДЮШОР по плаванию Самара',cat:'Спорт',desc:'Плавание. Подготовка от оздоровительного до спортивного уровня.',age:'5–16 лет',free:true},
  // ОМСК
  {id:'omsk1',city:'Омск',name:'ХК «Авангард» — Детская школа',cat:'Спорт',desc:'Хоккей. Школа при клубе КХЛ. Профессиональный лёд Омска.',age:'5–17 лет',price:'от 2 000 ₽/мес'},
  {id:'omsk2',city:'Омск',name:'Кванториум Омск',cat:'IT и Наука',desc:'Робототехника, IT, промышленный дизайн. Бесплатно.',age:'10–18 лет',free:true},
  {id:'omsk3',city:'Омск',name:'Портал «После уроков»',cat:'IT и Наука',desc:'Каталог всех секций и кружков Омска. Удобный поиск и бесплатная запись.',age:'Любой',url:'https://krug.omskportal.ru',free:true},
  // ВОРОНЕЖ
  {id:'vrn1',city:'Воронеж',name:'Кванториум Воронеж',cat:'IT и Наука',desc:'IT, VR/AR, аэроквантум. Государственная программа доп. образования.',age:'10–18 лет',free:true},
  {id:'vrn2',city:'Воронеж',name:'СДЮШОР художественной гимнастики',cat:'Спорт',desc:'Художественная гимнастика. Сильнейшая школа региона.',age:'4–14 лет',free:true},
  {id:'vrn3',city:'Воронеж',name:'ДМШ № 1 Воронежа',cat:'Музыка',desc:'Фортепиано, скрипка, гитара, аккордеон, флейта.',age:'6–17 лет',free:true},
  // ПЕРМЬ
  {id:'prm1',city:'Пермь',name:'Академия ХК «Молот-Прикамье»',cat:'Спорт',desc:'Хоккей. Официальная школа клуба ВХЛ Прикамья.',age:'5–17 лет',price:'от 1 800 ₽/мес'},
  {id:'prm2',city:'Пермь',name:'Кванториум Пермь',cat:'IT и Наука',desc:'Промдизайн, IT, аэро, робо, нейроквантум.',age:'10–18 лет',free:true},
  {id:'prm3',city:'Пермь',name:'Пермское хореографическое училище',cat:'Танцы',desc:'Классический балет. Подготовительные группы для детей.',age:'4–10 лет',free:true},
  // ТЮМЕНЬ
  {id:'tmn1',city:'Тюмень',name:'Кванториум Тюмень',cat:'IT и Наука',desc:'IT, робототехника, VR. Одно из лучших оснащений в регионе.',age:'10–18 лет',free:true},
  {id:'tmn2',city:'Тюмень',name:'СДЮШОР «Газовик» — плавание',cat:'Спорт',desc:'Плавание. Чемпионы России и Европы.',age:'5–16 лет',free:true},
  {id:'tmn3',city:'Тюмень',name:'Языковой центр Lingua Kids',cat:'Языки',desc:'Английский для детей с 3 лет. Игровая методика.',age:'3–14 лет',price:'от 2 200 ₽/мес'},
  // КРАСНОЯРСК
  {id:'krs1',city:'Красноярск',name:'ФК «Енисей» — Детская академия',cat:'Спорт',desc:'Футбол. Школа при историческом клубе Сибири.',age:'5–17 лет',price:'от 1 500 ₽/мес'},
  {id:'krs2',city:'Красноярск',name:'Кванториум Красноярск',cat:'IT и Наука',desc:'VR, IT, аэроквантум. Бесплатная программа доп. образования.',age:'10–18 лет',free:true},
  {id:'krs3',city:'Красноярск',name:'СДЮШОР по лыжным гонкам',cat:'Спорт',desc:'Лыжные гонки, биатлон. Красноярск — кузница олимпийских чемпионов.',age:'6–17 лет',free:true},
  // ВОЛГОГРАД
  {id:'vlg1',city:'Волгоград',name:'ФК «Ротор» — Детская школа',cat:'Спорт',desc:'Футбол. Официальная школа легендарного ФК Ротор.',age:'5–17 лет',price:'от 1 200 ₽/мес'},
  {id:'vlg2',city:'Волгоград',name:'Кванториум Волгоград',cat:'IT и Наука',desc:'IT, робоквантум, аэроквантум. Бесплатно для школьников.',age:'10–18 лет',free:true},
  // ИРКУТСК
  {id:'irk1',city:'Иркутск',name:'Кванториум Иркутск',cat:'IT и Наука',desc:'IT-квантум, геоквантум, аэроквантум. Государственная программа.',age:'10–18 лет',free:true},
  {id:'irk2',city:'Иркутск',name:'СДЮШОР по фигурному катанию',cat:'Спорт',desc:'Фигурное катание. Иркутск известен своими звёздами льда.',age:'4–16 лет',price:'от 2 000 ₽/мес'},
  // ХАБАРОВСК
  {id:'hab1',city:'Хабаровск',name:'Кванториум Хабаровск',cat:'IT и Наука',desc:'IT, робоквантум, промышленный дизайн. Дальний Восток.',age:'10–18 лет',free:true},
  {id:'hab2',city:'Хабаровск',name:'СДЮШОР дзюдо и самбо',cat:'Спорт',desc:'Дзюдо, самбо. Воспитали чемпионов России и мира.',age:'6–17 лет',free:true},
  // ВЛАДИВОСТОК
  {id:'vld1',city:'Владивосток',name:'Кванториум Владивосток',cat:'IT и Наука',desc:'IT, аэро, марин-квантум. Уникальный морской модуль.',age:'10–18 лет',free:true},
  {id:'vld2',city:'Владивосток',name:'ДЮСШ по боевым искусствам',cat:'Спорт',desc:'Карате, тхэквондо, ушу. Приморье — центр восточных единоборств.',age:'5–17 лет',price:'от 1 000 ₽/мес'},
  // ЯРОСЛАВЛЬ
  {id:'yar1',city:'Ярославль',name:'Кванториум Ярославль',cat:'IT и Наука',desc:'IT, аэроквантум, нейроквантум. Бесплатные занятия.',age:'10–18 лет',free:true},
  {id:'yar2',city:'Ярославль',name:'ФК «Шинник» — Детская школа',cat:'Спорт',desc:'Футбол. Школа при историческом клубе города.',age:'5–17 лет',price:'от 1 200 ₽/мес'},
  // БАРНАУЛ
  {id:'bar1',city:'Барнаул',name:'Кванториум Барнаул',cat:'IT и Наука',desc:'IT, промышленный дизайн, аэроквантум. Бесплатно.',age:'10–18 лет',free:true},
  {id:'bar2',city:'Барнаул',name:'СДЮШОР по лёгкой атлетике',cat:'Спорт',desc:'Лёгкая атлетика, прыжки, метание. Чемпионы Алтайского края.',age:'6–18 лет',free:true},
  // ТУЛА
  {id:'tul1',city:'Тула',name:'Кванториум Тула',cat:'IT и Наука',desc:'IT, промышленный дизайн, VR. Центр технологий Тульской области.',age:'10–18 лет',free:true},
  {id:'tul2',city:'Тула',name:'ФК «Арсенал» — Детская школа',cat:'Спорт',desc:'Футбол. Официальная школа при ФК Арсенал Тула.',age:'5–17 лет',price:'от 1 200 ₽/мес'},
  // САРАТОВ
  {id:'sar1',city:'Саратов',name:'Кванториум Саратов',cat:'IT и Наука',desc:'IT, аэроквантум, нейроквантум. Государственная программа.',age:'10–18 лет',free:true},
  {id:'sar2',city:'Саратов',name:'ФК «Сокол» — Детская школа',cat:'Спорт',desc:'Футбол. Академия Поволжья.',age:'5–17 лет',price:'от 1 000 ₽/мес'},
  // ЧЕЛЯБИНСК
  {id:'chel1',city:'Челябинск',name:'ХК «Трактор» — Академия',cat:'Спорт',desc:'Хоккей. Одна из лучших академий России. Чемпионы и олимпийцы.',age:'5–17 лет',url:'https://hctraktor.org',price:'от 2 500 ₽/мес'},
  {id:'chel2',city:'Челябинск',name:'Кванториум Челябинск',cat:'IT и Наука',desc:'IT, аэроквантум, нейроквантум, промдизайн. Бесплатно.',age:'10–18 лет',free:true},
  {id:'chel3',city:'Челябинск',name:'СДЮШОР по дзюдо',cat:'Спорт',desc:'Дзюдо. Chelябинск — легенда российского боевого спорта.',age:'6–17 лет',free:true},
];

type OnlinePlatform = { name:string; desc:string; url:string; emoji:string; age:string; free?:boolean; price?:string; };
const ONLINE_PLATFORMS: OnlinePlatform[] = [
  {name:'Учи.ру',desc:'Математика, русский, программирование. 10 млн учеников.',url:'https://uchi.ru',emoji:'📚',age:'1–9 кл.',free:true},
  {name:'Яндекс.Учебник',desc:'Задания по всем школьным предметам.',url:'https://education.yandex.ru',emoji:'🟡',age:'1–9 кл.',free:true},
  {name:'Алгоритмика',desc:'Программирование для детей. 30+ направлений онлайн.',url:'https://algoritmika.org',emoji:'🤖',age:'5–17 лет',price:'от 1 500 ₽/мес'},
  {name:'Skyeng Kids',desc:'Английский язык онлайн. Геймифицированные уроки.',url:'https://skyeng.ru/kids',emoji:'🇬🇧',age:'5–12 лет',price:'от 1 800 ₽/мес'},
  {name:'Foxford',desc:'Все школьные предметы + олимпиадная подготовка.',url:'https://foxford.ru',emoji:'🦊',age:'5–11 кл.',price:'от 990 ₽/мес'},
  {name:'Умназия',desc:'Логика, математика, скорочтение, развивающие курсы.',url:'https://umnazia.ru',emoji:'🧠',age:'4–12 лет',price:'от 790 ₽/мес'},
];

type ClubDetail = KidsClub | null;
type WebView = { url: string; title: string } | null;

function NavBanner({ city }: { city: City }) {
  const navUrl = `https://${city.nav}.навигатор.дети/`;
  return (
    <div style={{ margin:'0 16px 12px', borderRadius:14, overflow:'hidden', background:'linear-gradient(135deg,#1a3a6b 0%,#0d4fa8 100%)', padding:'14px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
      <div style={{ fontSize:28, flexShrink:0 }}>🏛️</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:11, fontWeight:900, color:'rgba(255,255,255,0.6)', textTransform:'uppercase', letterSpacing:1 }}>Государственный каталог</div>
        <div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Навигатор ДОД — {city.name}</div>
        <div style={{ fontSize:11, color:'rgba(255,255,255,0.55)', marginTop:2 }}>Все кружки и секции с записью онлайн</div>
      </div>
      <div style={{ fontSize:18, color:'rgba(255,255,255,0.5)', flexShrink:0 }}>›</div>
    </div>
  );
}

function ClubCard({ club, onClick }: { club: KidsClub; onClick: () => void }) {
  const color = CAT_COLOR[club.cat] || '#6366f1';
  return (
    <motion.div whileTap={{ scale: 0.96 }} onClick={onClick}
      style={{ background:'rgba(255,255,255,0.04)', borderRadius:14, padding:'12px 13px', border:'1px solid rgba(255,255,255,0.07)', cursor:'pointer', display:'flex', flexDirection:'column', gap:6 }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
        <div style={{ fontSize:20, flexShrink:0, marginTop:1 }}>{CAT_EMOJI[club.cat] || '🎯'}</div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:12, fontWeight:800, color:'#fff', lineHeight:1.3 }}>{club.name}</div>
          <div style={{ fontSize:10, fontWeight:700, color:color, marginTop:2 }}>{club.cat}</div>
        </div>
        {club.free && <div style={{ fontSize:9, fontWeight:900, color:'#22c55e', background:'rgba(34,197,94,0.12)', border:'1px solid rgba(34,197,94,0.3)', borderRadius:6, padding:'2px 6px', flexShrink:0 }}>Бесплатно</div>}
      </div>
      <div style={{ fontSize:11, color:'rgba(255,255,255,0.5)', lineHeight:1.4 }}>{club.desc.length > 70 ? club.desc.slice(0,70)+'…' : club.desc}</div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:2 }}>
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', fontWeight:600 }}>👤 {club.age}</div>
        {club.price && <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', fontWeight:700 }}>{club.price}</div>}
      </div>
    </motion.div>
  );
}

function ClubDetailSheet({ club, onClose, onOpenWeb }: { club: KidsClub; onClose: () => void; onOpenWeb: (url: string, title: string) => void }) {
  useBackHandler(onClose);
  const color = CAT_COLOR[club.cat] || '#6366f1';
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position:'fixed', inset:0, zIndex:700, background:'rgba(0,0,0,0.7)', backdropFilter:'blur(4px)', display:'flex', alignItems:'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type:'spring', damping:28, stiffness:280 }}
        style={{ width:'100%', background:'#0f0a1e', borderRadius:'20px 20px 0 0', padding:'20px 20px 40px', maxHeight:'80vh', overflowY:'auto' }}>
        <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.15)', margin:'0 auto 18px' }} />
        <div style={{ display:'flex', gap:12, marginBottom:14 }}>
          <div style={{ width:48, height:48, borderRadius:14, background:`${color}22`, border:`1px solid ${color}44`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, flexShrink:0 }}>{CAT_EMOJI[club.cat]||'🎯'}</div>
          <div>
            <div style={{ fontSize:15, fontWeight:900, color:'#fff', lineHeight:1.3 }}>{club.name}</div>
            <div style={{ fontSize:11, fontWeight:700, color, marginTop:3 }}>{club.cat} · {club.city}</div>
          </div>
        </div>
        <div style={{ fontSize:13, color:'rgba(255,255,255,0.7)', lineHeight:1.6, marginBottom:16 }}>{club.desc}</div>
        <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
          <InfoRow icon="👤" label="Возраст" value={club.age} />
          {club.price && <InfoRow icon="💳" label="Стоимость" value={club.price} />}
          {club.free && <InfoRow icon="✅" label="Стоимость" value="Бесплатно (бюджет)" />}
          {club.address && <InfoRow icon="📍" label="Адрес" value={club.address} />}
          {club.phone && <InfoRow icon="📞" label="Телефон" value={club.phone} />}
        </div>
        <div style={{ display:'flex', gap:10 }}>
          {club.url && (
            <motion.button whileTap={{ scale:0.93 }} onClick={() => onOpenWeb(club.url!, club.name)}
              style={{ flex:1, padding:'12px 0', borderRadius:14, background:`linear-gradient(135deg,${color},${color}bb)`, border:'none', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'"Montserrat",sans-serif' }}>
              🌐 Сайт организации
            </motion.button>
          )}
          <motion.button whileTap={{ scale:0.93 }} onClick={onClose}
            style={{ padding:'12px 16px', borderRadius:14, background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', color:'rgba(255,255,255,0.6)', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'"Montserrat",sans-serif' }}>
            Закрыть
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function InfoRow({ icon, label, value }: { icon:string; label:string; value:string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'rgba(255,255,255,0.04)', borderRadius:10 }}>
      <span style={{ fontSize:14 }}>{icon}</span>
      <span style={{ fontSize:11, color:'rgba(255,255,255,0.4)', fontWeight:700, minWidth:70 }}>{label}</span>
      <span style={{ fontSize:12, color:'rgba(255,255,255,0.8)', fontWeight:600, flex:1 }}>{value}</span>
    </div>
  );
}

function WebViewer({ url, title, onClose }: { url:string; title:string; onClose:()=>void }) {
  const [loaded, setLoaded] = useState(false);
  useBackHandler(onClose);
  return (
    <motion.div initial={{ opacity:0, y:'100%' }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:'100%' }}
      transition={{ type:'spring', damping:28, stiffness:280 }}
      style={{ position:'fixed', inset:0, zIndex:750, background:'#000', display:'flex', flexDirection:'column' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'46px 12px 10px', background:'linear-gradient(135deg,#1a0533,#0d1f3c)', borderBottom:'1px solid rgba(255,255,255,0.1)', flexShrink:0 }}>
        <motion.button whileTap={{ scale:0.85 }} onClick={onClose}
          style={{ width:34, height:34, borderRadius:'50%', background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', fontSize:17, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>←</motion.button>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:9, fontWeight:900, letterSpacing:2, textTransform:'uppercase', background:'linear-gradient(90deg,#a78bfa,#60a5fa)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>🏛️ SWAIP — ДЕТИ</div>
          <div style={{ fontSize:12, fontWeight:800, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{title}</div>
        </div>
      </div>
      <div style={{ flex:1, position:'relative' }}>
        {!loaded && (
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:12, background:'#0a0a0a' }}>
            <motion.div animate={{ rotate:360 }} transition={{ repeat:Infinity, duration:1, ease:'linear' }}
              style={{ width:40, height:40, borderRadius:'50%', border:'3px solid rgba(167,139,250,0.2)', borderTopColor:'#a78bfa' }} />
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', fontWeight:700 }}>Открываем сайт…</div>
          </div>
        )}
        <iframe src={url} title={title} onLoad={() => setLoaded(true)}
          style={{ width:'100%', height:'100%', border:0, display:'block' }}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation" />
      </div>
    </motion.div>
  );
}

export default function KidsClubsScreen({ onBack, accentColor }: { onBack: () => void; accentColor?: string }) {
  const [cityIdx, setCityIdx] = useState(0);
  const [cat, setCat] = useState<KidsCat>('Все');
  const [detail, setDetail] = useState<ClubDetail>(null);
  const [webView, setWebView] = useState<WebView>(null);
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const cityScrollRef = useRef<HTMLDivElement>(null);
  const accent = accentColor || '#a78bfa';
  const city = CITIES[cityIdx];

  useBackHandler(onBack);

  const cityClubs = CLUBS.filter(c => c.city === city.name);
  const filtered = cityClubs.filter(c => {
    const catOk = cat === 'Все' || c.cat === cat;
    const searchOk = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.desc.toLowerCase().includes(search.toLowerCase());
    return catOk && searchOk;
  });

  const openWeb = (url: string, title: string) => setWebView({ url, title });
  const openNavigator = () => openWeb(`https://${city.nav}.навигатор.дети/`, `Навигатор ДОД — ${city.name}`);

  return (
    <>
      <div style={{ position:'fixed', inset:0, background:'#080514', display:'flex', flexDirection:'column', zIndex:300, fontFamily:'"Montserrat",sans-serif' }}>

        {/* Top bar */}
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'46px 14px 10px', background:'linear-gradient(180deg,rgba(10,5,20,0.98) 0%,rgba(10,5,20,0) 100%)', flexShrink:0 }}>
          <motion.button whileTap={{ scale:0.85 }} onClick={onBack}
            style={{ width:36, height:36, borderRadius:'50%', background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.12)', color:'#fff', fontSize:17, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>←</motion.button>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:16, fontWeight:900, color:'#fff', letterSpacing:-0.3 }}>Кружки для детей</div>
            <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', fontWeight:600 }}>{city.name} · {cityClubs.length} организаций</div>
          </div>
          <motion.button whileTap={{ scale:0.85 }} onClick={() => setShowSearch(v => !v)}
            style={{ width:36, height:36, borderRadius:'50%', background:showSearch ? `${accent}33` : 'rgba(255,255,255,0.08)', border:`1px solid ${showSearch ? accent+'55' : 'rgba(255,255,255,0.12)'}`, color:showSearch ? accent : '#fff', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>🔍</motion.button>
        </div>

        {/* Search bar */}
        <AnimatePresence>
          {showSearch && (
            <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
              style={{ overflow:'hidden', flexShrink:0, padding:'0 14px 10px' }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по кружкам…" autoFocus
                style={{ width:'100%', padding:'10px 14px', borderRadius:12, background:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', fontSize:13, fontFamily:'"Montserrat",sans-serif', outline:'none', boxSizing:'border-box' }} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* City chips */}
        <div ref={cityScrollRef} style={{ display:'flex', gap:7, overflowX:'auto', padding:'0 14px 10px', flexShrink:0, scrollbarWidth:'none' }}>
          {CITIES.map((c, i) => (
            <motion.button key={c.name} whileTap={{ scale:0.92 }} onClick={() => { setCityIdx(i); setCat('Все'); }}
              style={{ padding:'6px 14px', borderRadius:20, border:'none', cursor:'pointer', fontSize:11, fontWeight:800, whiteSpace:'nowrap', flexShrink:0, fontFamily:'"Montserrat",sans-serif',
                background: i === cityIdx ? accent : 'rgba(255,255,255,0.07)',
                color: i === cityIdx ? '#fff' : 'rgba(255,255,255,0.55)' }}>
              {c.name}
            </motion.button>
          ))}
        </div>

        {/* Category pills */}
        <div style={{ display:'flex', gap:6, overflowX:'auto', padding:'0 14px 10px', flexShrink:0, scrollbarWidth:'none' }}>
          {CATS.map(c => (
            <button key={c} onClick={() => setCat(c)}
              style={{ padding:'4px 12px', borderRadius:16, border:'none', cursor:'pointer', fontSize:10, fontWeight:700, whiteSpace:'nowrap', flexShrink:0, fontFamily:'"Montserrat",sans-serif',
                background: c === cat ? (CAT_COLOR[c] || accent) : 'rgba(255,255,255,0.06)',
                color: c === cat ? '#fff' : 'rgba(255,255,255,0.5)' }}>
              {CAT_EMOJI[c] ? `${CAT_EMOJI[c]} ` : ''}{c}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflowY:'auto', padding:'0 0 32px' }}>

          {/* Navigator DOD banner */}
          <motion.div whileTap={{ scale:0.97 }} onClick={openNavigator} style={{ margin:'0 14px 12px', borderRadius:14, overflow:'hidden', background:'linear-gradient(135deg,#1a3a6b,#0d4fa8)', padding:'14px 16px', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}>
            <div style={{ fontSize:28, flexShrink:0 }}>🏛️</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:10, fontWeight:900, color:'rgba(255,255,255,0.55)', textTransform:'uppercase', letterSpacing:1 }}>Государственный каталог</div>
              <div style={{ fontSize:13, fontWeight:800, color:'#fff' }}>Навигатор ДОД — {city.name}</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.5)', marginTop:2 }}>Тысячи кружков · Онлайн-запись · Бесплатно</div>
            </div>
            <div style={{ fontSize:20, color:'rgba(255,255,255,0.4)' }}>›</div>
          </motion.div>

          {/* PFDO banner */}
          <motion.div whileTap={{ scale:0.97 }} onClick={() => openWeb('https://pfdo.ru','ПФДО — сертификаты на дополнительное образование')}
            style={{ margin:'0 14px 16px', borderRadius:14, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', padding:'10px 14px', display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}>
            <div style={{ fontSize:22 }}>🎓</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:12, fontWeight:800, color:'#fff' }}>ПФДО — Персональный сертификат</div>
              <div style={{ fontSize:10, color:'rgba(255,255,255,0.45)', marginTop:1 }}>До 50 000 ₽ на обучение · Проверь право на сертификат</div>
            </div>
            <div style={{ fontSize:16, color:'rgba(255,255,255,0.3)' }}>›</div>
          </motion.div>

          {/* Clubs count */}
          {cat !== 'Онлайн' && (
            <div style={{ padding:'0 14px 10px' }}>
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)', fontWeight:700 }}>
                {filtered.length > 0 ? `${filtered.length} организаций в ${city.name}` : `Нет результатов — попробуй другую категорию`}
              </span>
            </div>
          )}

          {/* Club cards grid */}
          {cat !== 'Онлайн' && filtered.length > 0 && (
            <div style={{ padding:'0 14px', display:'grid', gridTemplateColumns:'repeat(1,1fr)', gap:8, marginBottom:20 }}>
              {filtered.map(club => (
                <ClubCard key={club.id} club={club} onClick={() => setDetail(club)} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {cat !== 'Онлайн' && filtered.length === 0 && cityClubs.length === 0 && (
            <div style={{ padding:'20px 14px', textAlign:'center' }}>
              <div style={{ fontSize:40, marginBottom:10 }}>🔍</div>
              <div style={{ fontSize:14, fontWeight:800, color:'rgba(255,255,255,0.7)', marginBottom:6 }}>Данных нет в каталоге</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.4)', marginBottom:16 }}>Открой Навигатор ДОД — там все кружки твоего города</div>
              <motion.button whileTap={{ scale:0.93 }} onClick={openNavigator}
                style={{ padding:'10px 24px', borderRadius:14, background:'linear-gradient(135deg,#1a3a6b,#0d4fa8)', border:'none', color:'#fff', fontSize:13, fontWeight:800, cursor:'pointer', fontFamily:'"Montserrat",sans-serif' }}>
                🏛️ Открыть Навигатор ДОД
              </motion.button>
            </div>
          )}

          {/* Online platforms section */}
          <div style={{ padding:'0 14px', marginTop: cat === 'Онлайн' ? 4 : 8 }}>
            <div style={{ fontSize:11, fontWeight:900, color:'rgba(255,255,255,0.4)', letterSpacing:1.5, textTransform:'uppercase', marginBottom:10 }}>📱 Онлайн-платформы · Вся Россия</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
              {ONLINE_PLATFORMS.map(p => (
                <motion.div key={p.name} whileTap={{ scale:0.94 }} onClick={() => openWeb(p.url, p.name)}
                  style={{ background:'rgba(255,255,255,0.04)', borderRadius:12, padding:'10px 12px', border:'1px solid rgba(255,255,255,0.07)', cursor:'pointer' }}>
                  <div style={{ fontSize:20, marginBottom:4 }}>{p.emoji}</div>
                  <div style={{ fontSize:11, fontWeight:800, color:'#fff', lineHeight:1.2, marginBottom:3 }}>{p.name}</div>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.4)', lineHeight:1.4, marginBottom:4 }}>{p.desc}</div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ fontSize:9, color:'rgba(255,255,255,0.3)', fontWeight:600 }}>👤 {p.age}</span>
                    {p.free && <span style={{ fontSize:9, fontWeight:900, color:'#22c55e' }}>Бесплатно</span>}
                    {p.price && <span style={{ fontSize:9, color:'rgba(255,255,255,0.4)', fontWeight:700 }}>{p.price}</span>}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Sources info */}
          <div style={{ margin:'20px 14px 0', padding:'12px 14px', borderRadius:12, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize:10, fontWeight:800, color:'rgba(255,255,255,0.35)', marginBottom:6 }}>📋 Источники данных</div>
            <div style={{ fontSize:9, color:'rgba(255,255,255,0.25)', lineHeight:1.6 }}>
              Данные взяты из открытых источников: Навигатор ДОД, ПФДО, официальных сайтов организаций. Для актуального расписания и записи переходите на сайт организации или в Навигатор ДОД.
            </div>
          </div>
        </div>
      </div>

      {/* Detail sheet */}
      <AnimatePresence>
        {detail && <ClubDetailSheet club={detail} onClose={() => setDetail(null)} onOpenWeb={openWeb} />}
      </AnimatePresence>

      {/* Web viewer */}
      <AnimatePresence>
        {webView && <WebViewer url={webView.url} title={webView.title} onClose={() => setWebView(null)} />}
      </AnimatePresence>
    </>
  );
}
