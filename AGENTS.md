# SWAIP — Инструкция для агентов

> Этот документ описывает архитектуру проекта, все принятые решения, используемые сервисы и инструменты. Читай его перед началом любой работы с SWAIP.

---

## Что такое SWAIP

SWAIP — русскоязычная социальная сеть в формате PWA (Progressive Web App), разработанная в **Набережных Челнах**. Включает мессенджер, ленту, клипы, маркетплейс, мероприятия, опросы, игры, виртуальных AI-ассистентов и многое другое.

---

## Структура монорепозитория

```
/home/runner/workspace/
├── artifacts/
│   ├── swaip/              — Фронтенд (React + Vite, PWA)
│   ├── api-server/         — Бэкенд (Express + TypeScript + Drizzle ORM)
│   └── mockup-sandbox/     — Canvas/дизайн-превью
├── lib/
│   ├── db/                 — Drizzle схемы + миграции + клиент Postgres
│   ├── integrations-openai-ai-server/  — OpenAI интеграция (TTS, STT, Chat)
│   └── api-spec/           — OpenAPI спецификация и кодген
├── scripts/                — Утилиты
├── pnpm-workspace.yaml
└── AGENTS.md               — этот файл
```

**Пакетный менеджер:** `pnpm` (workspace)
**Запуск:** через Replit Workflows (не `pnpm dev` в корне!)

---

## Workflows (как запускаются сервисы)

| Workflow | Команда | Порт |
|----------|---------|------|
| `artifacts/api-server: API Server` | `pnpm --filter @workspace/api-server run dev` | 8080 |
| `artifacts/swaip: web` | `pnpm --filter @workspace/swaip run dev` | из `PORT` env |
| `artifacts/mockup-sandbox: Component Preview Server` | `pnpm --filter @workspace/mockup-sandbox run dev` | — |

Прокси маршрутизирует:
- `/api/*` → API Server (порт 8080)
- `/` → SWAIP фронтенд

**Для перезапуска используй** `restart_workflow`, а не shell-команды.

---

## База данных

- **PostgreSQL** через Replit built-in DB
- **ORM:** Drizzle ORM
- **Схемы:** `lib/db/src/schema/schema/`
- **Клиент:** `lib/db/src/index.ts` → `export { db, pool }`
- **Миграции:** `pnpm --filter @workspace/db run migrate`

### Таблицы (полный список)

| Файл | Таблицы |
|------|---------|
| `accounts.ts` | `accountsTable` |
| `sessions.ts` | `sessionsTable` |
| `messaging.ts` | `conversationsTable`, `messagesTable`, `conversationMembersTable` |
| `broadcasts.ts` | `broadcastsTable`, `broadcastLikesTable`, `broadcastCommentsTable` |
| `stories.ts` | `storiesTable` |
| `meetings.ts` | `meetingsTable`, `meetingParticipantsTable` |
| `meetingMessages.ts` | `meetingMessagesTable` |
| `meetingLogs.ts` | `meetingLogsTable` |
| `loginLogs.ts` | `loginLogsTable` |
| `reviews.ts` | `reviewsTable` |
| `moderation.ts` | `moderationTable` |
| `exchange.ts` | `exchangeTable` |
| `bots.ts` | `botsTable`, `botCommandsTable` |
| `miniApps.ts` | `miniAppsTable` |
| `loungeRooms.ts` | `loungeRoomsTable` |
| `loungeMessages.ts` | `loungeMessagesTable` |
| `events.ts` | `eventsTable`, `eventAttendeesTable` |
| `marketplace.ts` | `marketplaceListingsTable` |
| `capsules.ts` | `capsulesTable` |
| `polls.ts` | `pollsTable`, `pollOptionsTable`, `pollVotesTable` |
| `scheduledMessages.ts` | `scheduledMessagesTable` |

Все таблицы экспортируются через `lib/db/src/schema/schema/index.ts` → `lib/db/src/index.ts`.

---

## Аутентификация

- **Сессии:** токен хранится в `localStorage` как `swaip_session` или `swaip_session_token`
- **Заголовок:** `x-session-token: <token>`
- **Серверная проверка:** `resolveSession(token)` из `lib/sessionAuth.js` → возвращает `userHash | null`
- **UserHash:** уникальный идентификатор пользователя (hex строка, например `20e0dbfaa350282e`)

```typescript
import { getSessionToken, resolveSession } from "../lib/sessionAuth.js";

router.get("/some-route", async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: "Unauthorized" });
  // ...
});
```

---

## AI / OpenAI интеграция

**Важно:** Replit-прокси поддерживает НЕ все OpenAI endpoints. Используй только следующие подходы:

### TTS (Text-to-Speech)

**НЕ используй** `openai.audio.speech.create()` — endpoint `/audio/speech` не поддерживается прокси.

**Используй** `textToSpeech()` из `lib/integrations-openai-ai-server/src/audio/client.ts`:

```typescript
import { textToSpeech } from "@workspace/integrations-openai-ai-server/audio";

const audioBuffer = await textToSpeech({
  text: "Привет!",
  voice: "alloy", // alloy | echo | fable | onyx | nova | shimmer
  model: "gpt-audio", // специальная модель для Replit прокси
});
// audioBuffer — Buffer с mp3/opus данными
```

Реализация использует `/v1/chat/completions` с `modalities: ["text","audio"]` и `audio: { voice, format: "mp3" }`.

### STT (Speech-to-Text)

```typescript
import { speechToText } from "@workspace/integrations-openai-ai-server/audio";

const transcript = await speechToText({
  audioBuffer: buffer,    // Buffer
  mimeType: "audio/webm", // тип файла
  model: "gpt-4o-mini-transcribe",
});
```

### Chat Completions

```typescript
import { openai } from "@workspace/integrations-openai-ai-server";

const response = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [{ role: "user", content: "..." }],
});
```

### Где находится реализация

- `lib/integrations-openai-ai-server/src/audio/client.ts` — `textToSpeech`, `speechToText`
- `lib/integrations-openai-ai-server/src/index.ts` — `openai` клиент
- `artifacts/api-server/src/routes/assistants.ts` — маршруты `/api/assistants/*`

---

## Виртуальные ассистенты

### Конфигурация ассистентов

`artifacts/swaip/src/specialistsConfig.ts` — содержит массив `SPECIALISTS` с 11 ассистентами:

| id | Имя | Роль |
|----|-----|------|
| `petya` | Отличник Петя | Репетитор |
| `igor` | Адвокат Игорь | Юрист |
| `natasha` | Доктор Наташа | Врач-терапевт |
| `anton` | Финансист Антон | Финансовый консультант |
| `marina` | HR Марина | HR-директор |
| `viktor` | Шеф-повар Виктор | Шеф-повар |
| `sasha` | Мастер Саша | Мастер на все руки |
| `alina` | Психолог Алина | Психолог-консультант |
| `dima` | Маркетолог Дима | Маркетолог и копирайтер |
| `lena` | Переводчик Лена | Переводчик-лингвист |
| `sveta` | Педагог Света | Педагог и детский психолог |
| `galina` | Бухгалтер Галина | Главный бухгалтер |
| `vasya` | Механик Вася | Автомеханик |

### Поля ассистента

```typescript
interface Specialist {
  id: string;
  name: string;
  emoji: string;
  role: string;
  tagline: string;
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  greeting: string;      // ТЕКСТОВОЕ приветствие (показывается при открытии)
  voiceGreeting: string; // устарело, оставлено пустым — голос НЕ воспроизводится
  hasPhoto: boolean;     // true для всех
  // ...цвета, примеры, placeholder, шрифты
}
```

### Важно: текстовое приветствие

Приветствие — **только текст**, голос при открытии НЕ воспроизводится автоматически.
Каждое приветствие должно включать:
1. Упоминание **экосистемы SWAIP**
2. Упоминание **Набережных Челнов**
3. Стиль: строгий для юридических/медицинских, дружелюбный для остальных

Голос TTS работает только при явном нажатии кнопки 🔊 (запрос к `/api/assistants/speak`).

### Маршруты ассистентов

```
POST /api/assistants/ask        — задать вопрос (chat completion)
POST /api/assistants/speak      — TTS (текст → аудио)
POST /api/assistants/transcribe — STT (аудио → текст)
POST /api/assistants/analyze-image — анализ изображения
```

Файл: `artifacts/api-server/src/routes/assistants.ts`

---

## 12 социальных функций (все реализованы)

| # | Функция | Фронтенд | Бэкенд |
|---|---------|----------|--------|
| 1 | Клипы (TikTok-feed) | `ClipsScreen.tsx` | `/api/broadcasts` (фильтр по videoUrl) |
| 2 | Видеокружки | `App.tsx:openVideoCircle` | `/api/messages` (messageType: videoCircle) |
| 3 | Опросы | `PollsScreen.tsx` | `/api/polls` + DB polls* |
| 4 | Исчезающие сообщения | `App.tsx` burn-timer UI | `/api/conversations/:id/burn-timer` |
| 5 | Настроение дня | `MoodScreen.tsx` | `/api/moods` (in-memory Map, 24h TTL) |
| 6 | Капсула времени | `TimeCapsuleScreen.tsx` | `/api/capsules` + DB capsules |
| 7 | Мероприятия | `EventsScreen.tsx` | `/api/events` + DB events* |
| 8 | Маркетплейс | `MarketplaceScreen.tsx` | `/api/marketplace/listings` + DB |
| 9 | Расписание сообщений | `App.tsx` datetime picker | `/api/scheduled-messages` + dispatcher 30s |
| 10 | Слушаем вместе | `ListenTogetherScreen.tsx` | cinema WebSocket `/api/ws/cinema` + relay |
| 11 | Портфолио в профиле | `SwaipHome.tsx` portfolio tab | нет отдельного API |
| 12 | Ежедневный челлендж | `SwaipHome.tsx` виджет | `/api/daily-challenge` |

Все экраны импортируются и рендерятся в `SwaipHome.tsx`.

---

## WebSocket серверы

| Путь | Файл | Назначение |
|------|------|-----------|
| `/api/ws/lounge` | `lib/loungeWs.ts` | Чат-комнаты (Lounge) |
| `/api/ws/cinema` | `lib/cinemaWs.ts` | Кино/Слушаем вместе |
| `/ws/calls` | `index.ts` | WebRTC сигналинг (звонки) |

**Аутентификация WS:** только через токен в query param `?token=<session_token>`. НЕ принимать raw hash — это уязвимость.

---

## Загрузка файлов

| Маршрут | Назначение | Хранилище |
|---------|-----------|-----------|
| `POST /api/image-upload` | Изображения | Object Storage |
| `POST /api/audio-upload` | Аудиофайлы | Object Storage |
| `POST /api/video-upload` | Видео | Object Storage |
| `POST /api/document-upload` | Документы | Object Storage |
| `POST /api/greeting-upload` | Приветственные аудио | Object Storage |
| `POST /api/chunk-upload` | Чанковая загрузка больших файлов | Object Storage |

---

## Логирование

**Никогда не используй `console.log` в серверном коде.**

```typescript
import { logger } from "../lib/logger.js";

// В route handlers:
req.log.info({ userId }, "событие");

// Вне handlers:
logger.info({ data }, "событие");
logger.error({ err }, "ошибка");
```

---

## Безопасность — что было исправлено

### cinemaWs.ts — обход аутентификации (исправлено)
Была ошибка: WS принимал `?hash=userHash` в query param как удостоверение личности, если токен сессии отсутствовал. Это позволяло выдавать себя за любого пользователя. **Исправлено: только `resolveSession(token)`, hash-fallback убран.**

### gitPush.ts — привилегированный endpoint
`/api/git-push` — утилита разработчика для пуша в GitHub. Токен передаётся **только в теле POST-запроса** (не в URL), чтобы не попасть в логи сервера.

---

## Push в GitHub

Страница: `https://<replit-domain>/api/git-push`

Работает так:
1. Открой страницу в браузере
2. Вставь GitHub Personal Access Token (нужно право `Contents: Write`)
3. Нажми кнопку — произойдёт `git push origin main --force`

Токен создаётся здесь: https://github.com/settings/tokens/new?scopes=repo&description=SWAIP+push

Репозиторий: `github.com/wynerzhinesfbzn/Swaip2.0`

---

## Переменные окружения

| Переменная | Назначение |
|------------|-----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Секрет для сессий |
| `GITHUB_TOKEN` | GitHub PAT (опционально, для CI) |
| `PORT` | Порт сервиса (выставляется Replit автоматически) |

Для управления используй **environment-secrets skill**, не хардкодь в код.

---

## Ключевые файлы

```
artifacts/swaip/src/
  App.tsx                  — Главный компонент (25k+ строк): чат, звонки, видеокружки
  SwaipHome.tsx            — Лента, навигация, все экраны (11k+ строк)
  specialistsConfig.ts     — Конфиг 11 AI-ассистентов
  AssistantScreen.tsx      — Экран ассистента (чат + TTS + STT)
  ClipsScreen.tsx          — TikTok-клипы
  PollsScreen.tsx          — Опросы
  EventsScreen.tsx         — Мероприятия
  MarketplaceScreen.tsx    — Маркетплейс
  TimeCapsuleScreen.tsx    — Капсула времени
  MoodScreen.tsx           — Настроение дня
  ListenTogetherScreen.tsx — Слушаем вместе (WebSocket)

artifacts/api-server/src/
  routes/index.ts          — Регистрация всех маршрутов
  routes/assistants.ts     — AI ассистенты (ask, speak, transcribe, analyze-image)
  routes/polls.ts          — Опросы
  routes/events.ts         — Мероприятия
  routes/marketplace.ts    — Маркетплейс
  routes/capsules.ts       — Капсулы времени
  routes/moods.ts          — Настроение дня (in-memory)
  routes/scheduledMessages.ts — Расписание сообщений
  routes/dailyChallenge.ts — Ежедневный челлендж
  routes/gitPush.ts        — Утилита push в GitHub
  lib/cinemaWs.ts          — Cinema/ListenTogether WebSocket
  lib/loungeWs.ts          — Lounge WebSocket
  lib/sessionAuth.ts       — resolveSession()

lib/integrations-openai-ai-server/src/
  audio/client.ts          — textToSpeech(), speechToText()
  index.ts                 — openai клиент
```

---

## Типичные задачи

### Добавить нового AI-ассистента
1. Добавить объект в `SPECIALISTS` в `specialistsConfig.ts`
2. Заполнить `greeting` с упоминанием SWAIP и Набережных Челнов
3. Выбрать голос: `alloy | echo | fable | onyx | nova | shimmer`
4. Система сама покажет его в AssistantsHub

### Добавить новый маршрут API
1. Создать `artifacts/api-server/src/routes/myRoute.ts`
2. Импортировать и зарегистрировать в `routes/index.ts`
3. Если нужна DB таблица — создать схему в `lib/db/src/schema/schema/`, экспортировать из `index.ts`, запустить `pnpm --filter @workspace/db run migrate`

### Изменить приветствие ассистента
Только поле `greeting` в `specialistsConfig.ts`. `voiceGreeting` — пустая строка, не трогать.

### Починить TTS
Убедиться что используется `textToSpeech()` из `@workspace/integrations-openai-ai-server/audio` с `model: "gpt-audio"`. НЕ использовать `openai.audio.speech.create()`.

---

*Документ создан в мае 2026. Обновляй при значимых архитектурных изменениях.*
