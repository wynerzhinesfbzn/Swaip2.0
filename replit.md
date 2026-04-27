# SWAIP 2.0 — Полная инструкция для агента

> **Для будущего агента:** Читай этот файл ПЕРВЫМ делом. Здесь описано всё, что нужно знать о проекте, чтобы не сломать уже работающий код.

---

## 1. Что такое SWAIP

SWAIP 2.0 — русскоязычная социальная сеть (аналог VK + Telegram + Авито-услуги).

**Четыре режима профиля:**
- `pro` — деловой профиль (имя, фото, должность, компания)
- `classic` — классическая лента постов
- `scene` — сцена/артист
- `krug` — семейный/приватный круг

**Ключевые функции:**
- Каналы (ChannelsScreen) — публичные/приватные с постами, рубриками, прайсами
- Группы (ChannelsScreen) — публичные/приватные сообщества
- Мессенджер E2E (ProMessaging) — шифрование через Ed25519 + Diffie-Hellman
- Видеозвонки (LiveKit SDK)
- Музыкальный плеер (SwaipHome + BgMusic.tsx)
- Поиск людей / каналов / групп (ProSearch.tsx)
- Криптовалюта SWP (SwpExchange.tsx)

---

## 2. Стек технологий

| Уровень         | Технология                              |
|-----------------|----------------------------------------|
| Монорепо        | pnpm workspaces                        |
| Node.js         | v24                                    |
| Фронтенд        | React 19 + Vite 7 + TypeScript         |
| Бэкенд          | Express 5 (TypeScript)                 |
| БД              | PostgreSQL + Drizzle ORM               |
| Видеозвонки     | LiveKit SDK                            |
| Хранилище файлов| Google Cloud Storage (GCS)             |
| Шифрование      | @noble/curves (Ed25519)                |
| Push-уведомления| web-push                               |
| Валидация       | Zod v4 + drizzle-zod                   |
| Сборка бэкенда  | esbuild (ESM bundle)                   |

---

## 3. Структура репозитория

```
artifacts/
  api-server/             ← Express 5 бэкенд (порт 8080)
    src/
      routes/             ← 20+ маршрутов API (см. раздел 8)
      lib/                ← sessionAuth, objectStorage, GCS, WebSocket
      middlewares/        ← contentFilter
      services/           ← callSignaling, meetingChatWs
      index.ts            ← точка входа, подключает все роуты

  swaip/                  ← React+Vite фронтенд (порт 18921, previewPath: /)
    src/
      App.tsx             ← корневой компонент (~15K строк)
      SwaipHome.tsx       ← главный экран (~10K строк)
      ChannelsScreen.tsx  ← каналы и группы (~4.5K строк)
      ProSearch.tsx       ← поиск людей/каналов/групп (~700 строк)
      ProMessaging.tsx    ← мессенджер + E2E
      BgMusic.tsx         ← фоновая музыка (singleton-плеер)
      SwpExchange.tsx     ← крипто SWP
      ChannelTemplates.tsx← шаблоны каналов
      PostExtras.tsx      ← расширения постов (карусель, ссылка, опрос...)
      ChatGames.tsx       ← игры в чате
      GamesArcade.tsx     ← аркадные игры
      secretCrypto.ts     ← E2E шифрование Ed25519
      i18n.ts             ← локализация
      hooks/              ← кастомные хуки
      pages/              ← дополнительные страницы
      assets/             ← mp3 треки фоновой музыки
    public/
      custom-ringtone.mp3 ← рингтон (ВАЖНО: именно здесь, не в public/public/)

lib/
  db/                     ← схема БД (Drizzle ORM), 13 таблиц
    src/schema.ts         ← таблицы + экспорт
  api-spec/               ← OpenAPI yaml
  api-client-react/       ← сгенерированные React Query хуки
  api-zod/                ← сгенерированные Zod схемы
```

---

## 4. Запуск проекта (воркфлоу)

Три воркфлоу, все должны быть RUNNING:

| Имя воркфлоу                         | Команда                                         | Порт  |
|--------------------------------------|-------------------------------------------------|-------|
| `artifacts/api-server: API Server`  | `pnpm --filter @workspace/api-server run dev`   | 8080  |
| `artifacts/swaip: web`              | `pnpm --filter @workspace/swaip run dev`        | 18921 |
| `artifacts/mockup-sandbox: ...`     | `pnpm --filter @workspace/mockup-sandbox run dev`| 8081  |

**Как перезапустить воркфлоу:**
Через инструмент `restart_workflow` с именем воркфлоу.

**Основные команды:**
```bash
# Проверка типов бэкенда
pnpm --filter @workspace/api-server run typecheck

# Сборка бэкенда
pnpm --filter @workspace/api-server run build

# Применить схему БД
pnpm --filter @workspace/db run push

# Регенерация API хуков (после изменения openapi.yaml)
pnpm --filter @workspace/api-spec run codegen
```

---

## 5. Переменные окружения и секреты

Доступны через Replit Secrets (НЕ хардкоди значения в коде!):

| Ключ              | Где используется                          |
|-------------------|-------------------------------------------|
| `DATABASE_URL`    | Drizzle ORM, подключение к PostgreSQL     |
| `SESSION_SECRET`  | JWT-подобные токены сессий + E2E ключи    |
| `GITHUB_TOKEN`    | push в GitHub через `/api/git-push`       |
| `GCS_*`           | Google Cloud Storage (загрузка файлов)    |
| `LIVEKIT_*`       | LiveKit видеозвонки                       |
| `VAPID_*`         | Web Push уведомления                      |

Чтобы добавить новый секрет — используй инструмент `environment-secrets` (читай skill перед использованием).

---

## 6. База данных (PostgreSQL + Drizzle ORM)

### Схема — 13 таблиц

```
accounts              ← пользователи (hash, data JSONB, sessionToken)
sessions              ← сессии
loginLogs             ← история входов
follows               ← подписки/друзья
broadcasts            ← посты/трансляции
broadcastReactions    ← реакции на посты
broadcastComments     ← комментарии
commentReactions      ← реакции на комментарии
stories               ← истории (24ч)
conversations         ← чаты (1:1 и групповые)
messages              ← сообщения в чатах
conversationParticipants
messageReactions
meetings              ← видеовстречи
meetingParticipants
meetingMessages
meetingLogs
reviews               ← отзывы
swpWallets            ← крипто-кошельки SWP
moderationReports
moderationBans
moderationLog
pushSubscriptions     ← Web Push подписки
```

### Ключевое: таблица `accounts`

```typescript
// JSONB поле data содержит ВСЕ данные профиля
// Примеры ключей в data:
// pro_displayName   ← имя пользователя
// pro_avatarUrl     ← аватар
// pro_bio           ← биография
// pro_position      ← должность
// pro_company       ← компания
// sw_nick           ← @ник
// sw_channels       ← JSON-массив каналов пользователя
// sw_groups         ← JSON-массив групп пользователя
// sw_highlights     ← хайлайты профиля
// pro_mood          ← текущее настроение {emoji, text}
// swaip_playlist_v2 ← плейлист (НЕ синхронизируется на сервер)
```

**ВАЖНО:** Ключи с префиксами `pro_|classic_|scene_|krug_|sw_|priv_` синхронизируются с сервером через `PUT /api/account`. Ключи без этих префиксов остаются только в localStorage.

### Как делать запросы

```typescript
import { db } from '../lib/db';
import { accountsTable } from '../lib/db/schema';
import { eq, sql } from 'drizzle-orm';

// Получить аккаунт по hash
const [account] = await db.select()
  .from(accountsTable)
  .where(eq(accountsTable.hash, userHash));

// Получить поле из JSONB
const [row] = await db.select({
  name: sql<string>`${accountsTable.data}->>'pro_displayName'`,
}).from(accountsTable).where(eq(accountsTable.hash, hash));

// ILIKE поиск в JSONB
const rows = await db.select()
  .from(accountsTable)
  .where(sql`${accountsTable.data}->>'sw_channels' ILIKE ${`%${keyword}%`}`);
```

---

## 7. Аутентификация и сессии

### Как работает

1. **Регистрация/вход** — `POST /api/sessions` → сервер генерирует `sessionToken` (случайная строка), сохраняет в `accounts.sessionToken`
2. **Хранение на клиенте** — токен в localStorage под ключом `swaip_session_token`
3. **Каждый запрос** — заголовок `x-session-token: <token>`
4. **Проверка на сервере** — middleware `requireSession` в `lib/sessionAuth.ts`

### requireSession middleware

```typescript
import { requireSession } from '../lib/sessionAuth';

// Защищённый роут:
router.post('/api/something', requireSession, async (req, res) => {
  const { userHash } = req; // доступен после requireSession
  // ...
});
```

### Получить токен на клиенте

```typescript
function getSessionToken(): string {
  return localStorage.getItem('swaip_session_token') || '';
}

// Пример запроса с авторизацией
fetch(`${window.location.origin}/api/something`, {
  method: 'POST',
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
    'x-session-token': getSessionToken(),
  },
  body: JSON.stringify(data),
});
```

---

## 8. API маршруты (краткий справочник)

Все роуты регистрируются в `artifacts/api-server/src/routes/index.ts`.

| Файл роута          | Основные эндпоинты                                                |
|---------------------|------------------------------------------------------------------|
| `accounts.ts`       | `GET /api/account/:hash`, `PUT /api/account`, `GET /api/search`, `GET /api/channels-search` |
| `sessions.ts`       | `POST /api/sessions` (логин/регистрация), `DELETE /api/sessions` |
| `broadcasts.ts`     | `GET/POST /api/broadcasts`, `PUT/DELETE /api/broadcasts/:id`, poll-vote, bookmarks |
| `messaging.ts`      | `GET/POST /api/conversations`, `/api/messages`, SSE для real-time |
| `meetings.ts`       | `POST /api/meetings`, LiveKit токены                             |
| `stories.ts`        | `GET/POST /api/stories`                                          |
| `reviews.ts`        | `GET/POST /api/reviews/:hash`                                    |
| `imageUpload.ts`    | `POST /api/image-upload` → GCS                                   |
| `audioUpload.ts`    | `POST /api/audio-upload` → GCS + конвертация в MP3              |
| `videoUpload.ts`    | `POST /api/video-upload` → GCS                                   |
| `chunkUpload.ts`    | Чанковая загрузка больших файлов                                 |
| `linkPreview.ts`    | `GET /api/link-preview?url=...` → OG-метаданные                 |
| `referral.ts`       | `GET /api/referral/stats`, реферальная система + монеты          |
| `exchange.ts`       | Криптовалюта SWP                                                 |
| `push.ts`           | Web Push подписки                                                |
| `moderation.ts`     | Жалобы и баны                                                    |
| `gitPush.ts`        | `POST /api/git-push` → push в GitHub (использует GITHUB_TOKEN)  |
| `health.ts`         | `GET /api/health`                                                |
| `tts.ts`            | Text-to-speech                                                   |

### Как добавить новый роут

```typescript
// 1. Создать файл artifacts/api-server/src/routes/myfeature.ts
import { Router } from 'express';
import { db } from '../lib/db';
import { requireSession } from '../lib/sessionAuth';

const router = Router();

router.get('/api/myfeature', requireSession, async (req, res) => {
  try {
    // ...
    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Server error' });
  }
});

export default router;

// 2. Добавить в artifacts/api-server/src/routes/index.ts:
import myfeature from './myfeature';
// ...
app.use(myfeature);
```

---

## 9. Фронтенд: ключевые паттерны

### useSaved хук (localStorage ↔ React state)

```typescript
// Автоматически читает из localStorage и пишет при изменении
const [value, setValue] = useSaved('pro_displayName', 'Моё имя');
```

### Синхронизация localStorage → сервер

Происходит автоматически при:
- Логине (GET из БД → заполняет localStorage → PUT обратно)
- Изменении каналов/групп (кастомные события `sw:channels-updated`, `sw:groups-updated`)
- Сохранении профиля

```typescript
// Диспатч события при изменении каналов (в ChannelsScreen.tsx):
window.dispatchEvent(new CustomEvent('sw:channels-updated'));

// SwaipHome.tsx слушает и делает PUT /api/account:
window.addEventListener('sw:channels-updated', () => pushSnap());
```

PREFIX_RE = `/^(pro_|classic_|scene_|krug_|sw_|priv_)/` — только эти ключи синхронизируются.

### Темы / цвета

```typescript
// SwaipHome.tsx использует c = colorScheme объект:
const c = {
  deep: '#0A0A14',       // фон приложения
  surface: '#12121E',    // поверхность панелей
  card: '#1A1A2E',       // карточки
  cardAlt: '#14142A',    // альтернативные карточки
  border: '#2A2A4A',     // границы
  borderB: '#1E1E3A',
  light: '#E8E8F8',      // основной текст
  mid: '#9090B8',        // вторичный текст
  sub: '#5A5A8A',        // третичный текст
};
const ac = '#7C6FFF'; // акцентный цвет (фиолетовый)
```

### Анимации (Framer Motion)

```typescript
import { motion, AnimatePresence } from 'framer-motion';

// Кнопка с тапом:
<motion.button whileTap={{ scale: 0.88 }} onClick={...}>

// Анимированное появление:
<motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>

// Переходы между экранами:
<AnimatePresence mode="wait">
  {showScreen && (
    <motion.div key="screen" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}>
```

---

## 10. Каналы и группы (ChannelsScreen.tsx)

### Хранение данных

```typescript
// Ключи localStorage:
const KEY = `swaip_account_${userHash}_channels_v2`;   // полные данные каналов
const SYNC_KEY = 'sw_channels';                         // синк-снимок → сервер
const KEY_G = `swaip_account_${userHash}_groups_v2`;   // полные данные групп
const SYNC_KEY_G = 'sw_groups';                         // синк-снимок → сервер
```

### Структура канала (SwaipChannel)

```typescript
interface SwaipChannel {
  id: string;
  name: string;
  handle: string;
  description: string;
  vibe: string;            // энергетика (🔥 Горим, 💎 Премиум...)
  vibeColor: string;
  coverGradient: string;
  category: string;        // категория из SERVICE_CATEGORIES
  tags: string[];
  subscribers: number;
  posts: ChannelPost[];    // последние 20 постов
  employees: Employee[];   // сотрудники
  priceList: PriceItem[];  // прайс-лист
  rubrics: string[];       // рубрики
  isVerified: boolean;
  pulse: number;           // 0–100 активность
  energyLevel: number;
  authorName: string;
  templateId?: string;
  usp?: string;
  createdAt: string;
}
```

### SERVICE_CATEGORIES (22 категории услуг, Авито-стиль)

```typescript
// В ProSearch.tsx и ChannelsScreen.tsx:
// Красота, Ремонт, IT и технологии, Здоровье, Образование,
// Юридические услуги, Бухгалтерия, Дизайн, Доставка и логистика,
// Туризм и отдых, Авто, Животные, Мероприятия, Фото и видео,
// Музыка, Спорт, Кулинария, Строительство, Клининг, Недвижимость,
// Рукоделие, Разное
```

---

## 11. Поиск (ProSearch.tsx)

### Архитектура поиска

```
Пользователь вводит текст
         ↓
ProSearch.tsx doSearchChannels()
         ↓
1. Ищет в localStorage (sw_channels, sw_groups) мгновенно
         ↓
2. Запрос GET /api/channels-search?q=...
   (ILIKE по JSONB в таблице accounts)
         ↓
3. Объединяет результаты, дедупликация по id
         ↓
Показывает карточки каналов/групп
```

### API /api/channels-search

```
GET /api/channels-search?q=парикмахерская&tags=красота

Логика:
1. Разбивает q на слова (split по пробелам)
2. Добавляет теги из параметра tags
3. ILIKE по data->>'sw_channels' и data->>'sw_groups'
4. JS-фильтрация по name+description+handle+tags
5. Возвращает { channels: [...], groups: [...] }
```

### Поиск людей

```
GET /api/search?q=Иван&mode=pro

Ищет по pro_displayName, pro_fullName, sw_nick в JSONB
Возвращает список профилей с аватаром, ником, биографией, настроением
```

---

## 12. Мессенджер E2E (ProMessaging.tsx)

### Алгоритм шифрования

1. У каждого пользователя — пара Ed25519 ключей (публичный хранится в `pro_publicKey` в БД)
2. Для E2E чата: ECDH на X25519 (конвертация из Ed25519) → общий секрет
3. Шифрование: AES-256-GCM
4. Ключи генерируются в `secretCrypto.ts` через `@noble/curves`

**ВАЖНО:** Секретный ключ хранится ТОЛЬКО в localStorage (`priv_secretKey`). На сервер не попадает. Если пользователь сменит устройство — переписка недоступна.

### Видео-кружки в чате

- Запись: предпросмотр 260×260px с пульсирующей красной рамкой
- Отображение: кружок 200×200px (`border-radius: 50%`, `object-fit: cover`)
- Длительность — бейдж поверх кружка

---

## 13. Музыкальный плеер (SwaipHome.tsx + BgMusic.tsx)

### Архитектура

```
window._globalAudio       ← глобальный singleton Audio объект
window._swaipBgAudio      ← singleton для фоновой музыки в постах
window._swaipBgPostId     ← id текущего играющего поста

localStorage:
  swaip_playlist_v2       ← плейлист пользователя (треки)
  swaip_music_style       ← выбранный стиль плеера (0–4)
  swaip_bg_muted          ← замьючена ли фоновая музыка
```

### MusicPlayerSheet — 5 стилей

| ID | Стиль     | Описание          |
|----|-----------|-------------------|
| 0  | Classic   | Стандартный       |
| 1  | Vinyl     | Вращающаяся vinyl |
| 2  | Neon      | Неоновый          |
| 3  | Wave      | Волна             |
| 4  | Minimal   | Минималистичный   |

### Фоновая музыка постов (BgMusicAutoplay)

Компонент `BgMusicAutoplay` (в `BgMusic.tsx`):
- Использует `IntersectionObserver` — автозапуск при 40% видимости
- При intersection нового поста → останавливает предыдущий
- Параметр `attach: 'sibling' | 'parent'` — где искать пост-контейнер

**КРИТИЧЕСКИ:** Не дублировать `MusicPlayerSheet`, `mini-player` — они должны быть ТОЛЬКО внутри SwaipHome return, не внутри MeetingsScreen или других компонентов.

---

## 14. Браузер внутри SWAIP

Вкладка 🌐 в нижней навигации (`navTab='browser'`).

- Адресная строка: URL или поисковый запрос → Яндекс
- Speed dial: Google, YouTube, Яндекс, VK, ChatGPT, Wikipedia, WB, Яндекс.Карты
- **Глобальный перехватчик:** все `<a href="http...">` перехватываются → открываются в браузере SWAIP
- Если сайт запрещает встраивание → экран с кнопкой "Открыть в системном браузере"

---

## 15. Система постов

### Интерфейс Post

```typescript
interface Post {
  id: string;
  authorHash: string;
  authorName: string;
  authorAvatar: string;
  text: string;
  imageUrl?: string;
  additionalImageUrls?: string[];  // карусель
  bgMusicUrl?: string;             // фоновая музыка
  bgMusicLabel?: string;
  poll?: Poll;                     // опрос
  quiz?: { correctIndex: number }; // квиз
  challenge?: { title, hashtag, deadline }; // челлендж
  activity?: { type, title };      // активность (фильм/книга...)
  mentions?: string[];             // @упомянутые
  hashtags?: string[];
  linkPreview?: OGData;           // превью ссылки
  question?: string;               // вопрос подписчикам
  quoteOf?: string;               // цитата поста
  repostOf?: string;              // репост
  parentId?: string;               // ответ в треде
  enableTTS?: boolean;
  disableComments?: boolean;
  disableRepost?: boolean;
  createdAt: string;
}
```

### 6 стилей PostCard

| Стиль     | Ключ        | Описание         |
|-----------|-------------|------------------|
| Классика  | `classic`   | Стандартный      |
| Синема    | `cinema`    | Широкоформатный  |
| Газета    | `newspaper` | Текстовый        |
| Неон      | `neon`      | Неоновый         |
| Пузырь    | `bubble`    | Мессенджер-стиль |
| Компакт   | `compact`   | Компактный       |

Все 6 стилей реализуют: опросы, закладки, треды, квоты, репосты, видео-кружки, фоновую музыку.

---

## 16. Как делать изменения — чек-лист

### Перед началом работы

1. Прочитай этот файл полностью
2. Проверь, все ли воркфлоу RUNNING (через `refresh_all_logs`)
3. Если нет — запусти через `restart_workflow`

### Изменение бэкенда

1. Найди нужный файл в `artifacts/api-server/src/routes/`
2. Проверь типы: `pnpm --filter @workspace/api-server run typecheck`
3. Если ошибки TS — исправь перед коммитом
4. Перезапусти воркфлоу `artifacts/api-server: API Server`

### Изменение фронтенда

1. Ищи компонент по функции — ориентируйся на раздел 9
2. Используй `grep` для поиска по коду
3. Не создавай новые файлы если можно изменить существующий
4. Перезапусти воркфлоу `artifacts/swaip: web`

### Добавление новой страницы/экрана

1. Создай компонент в `artifacts/swaip/src/`
2. Добавь навигацию в SwaipHome.tsx (через `navTab` или отдельный стейт)
3. Импортируй и рендери внутри SwaipHome return

### Добавление нового API

1. Создай файл в `artifacts/api-server/src/routes/`
2. Зарегистрируй в `artifacts/api-server/src/routes/index.ts`
3. При необходимости добавь в OpenAPI spec (`lib/api-spec/openapi.yaml`)
4. Regenerate хуки: `pnpm --filter @workspace/api-spec run codegen`

### Изменение схемы БД

1. Отредактируй `lib/db/src/schema.ts`
2. Выполни: `pnpm --filter @workspace/db run push`
3. Обнови типы в роутах если нужно

---

## 17. Известные ограничения (не ломай это!)

### Критические

- `SwaipHome.tsx` и `App.tsx` — ОГРОМНЫЕ файлы (~10–15K строк). При редактировании всегда читай окружающий контекст (offset/limit), не редактируй вслепую.
- `MusicPlayerSheet` + `mini-player` — ТОЛЬКО в SwaipHome return, не переносить в другие компоненты
- `custom-ringtone.mp3` — в `artifacts/swaip/public/` (НЕ в `public/public/`)
- E2E секретный ключ — ТОЛЬКО в localStorage `priv_secretKey`, никогда на сервер
- `sw_channels` / `sw_groups` в localStorage → синхронизируются на сервер через `PUT /api/account`

### Безопасность (известные проблемы, не исправляй без задачи)

- `/api/git-push` — не требует авторизации (потенциальный риск)
- `SESSION_SECRET` используется и для сессий и для E2E ключей (не меняй без понимания последствий)
- Инвайт-коды: поиск без индекса (full table scan)

### TypeScript

- Используй `as const` и конкретные типы. Избегай `any` без крайней необходимости
- `req.params['id'] as string` — нужен cast для Express 5
- Все роуты должны явно возвращать `return res.json(...)` или `return res.status(...).json(...)`

---

## 18. GitHub и деплой

### Push в GitHub

```bash
# Через API эндпоинт (рекомендуется — использует GITHUB_TOKEN секрет):
POST /api/git-push
Body: { "message": "feat: описание изменений" }

# ИЛИ через фоновую задачу (project task) — для прямого git push
# Прямые git push команды в main agent не разрешены
```

### Deploy на Replit

Используй `suggest_deploy` инструмент когда приложение готово к публикации.

---

## 19. Частые ошибки и их решения

| Ошибка | Причина | Решение |
|--------|---------|---------|
| Плеер не открывается | MusicPlayerSheet вне SwaipHome return | Перенести в SwaipHome return |
| Файл не воспроизводится | mp3 не в `public/` | Проверить путь `artifacts/swaip/public/` |
| Каналы не находятся поиском | sw_channels не синхронизированы | Проверить диспатч `sw:channels-updated` |
| TS ошибка в роуте | req.params без каста | Добавить `req.params as { id: string }` |
| Пустой результат API | Нет `return` перед `res.json()` | Добавить `return res.json(...)` |
| Белый экран | Воркфлоу упал | Запусти `restart_workflow` |
| Vite BABEL warning | Файл > 500KB | Ожидаемо для App.tsx и SwaipHome.tsx — не критично |
| localStorage не синхронизируется | Ключ без PREFIX_RE | Назови ключ с `pro_`/`sw_`/`krug_` и т.д. |

---

## 20. История важных изменений

| Дата       | Изменение                                                        |
|------------|------------------------------------------------------------------|
| 2026-04-27 | Поиск: локальный поиск + авто-синк каналов/групп; UX улучшения  |
| 2026-04-27 | Поиск каналов/групп: ProSearch.tsx + /api/channels-search       |
| 2026-04-26 | Каналы: кликабельные карточки, полноэкранный просмотр           |
| 2026-04-26 | SERVICE_CATEGORIES (22 категории услуг с keywords)              |
| 2026-04-26 | Фоновая музыка в постах, каналах и чатах (BgMusic.tsx)          |
| 2026-04-26 | Музыкальный плеер: 5 стилей, floating mini-player               |
| 2026-04-26 | PostComposerFull: 15 типов вложений (карусель, квиз, OG...)     |
| 2026-04-26 | TS исправления: 17 ошибок в роутах api-server                   |
| 2026-04-25 | E2E мессенджер, видео-кружки, встроенный браузер                |
| 2026-04-24 | Базовая социальная сеть: посты, профили, подписки               |
