# SWAIP 2.0 — Русскоязычная социальная сеть

## Виджеты постов (PostCard в SwaipHome.tsx)
- **Опросы** — `poll?:Poll` в Post interface, голосование через `/api/broadcasts/:id/poll-vote`, прогресс-бары с анимацией
- **Редактирование поста** — меню ⋯ → "Редактировать", PUT `/api/broadcasts/:id` (только владелец), `localText` обновляется мгновенно
- **Цитата поста** — меню ⋯ → "Процитировать", нижний лист с текстом цитаты + сниппет оригинала, POST с `quoteOf`
- **Репост** — меню ⋯ → "Репостнуть", нижний лист, POST с `repostOf`
- **Новые пропсы PostCard**: `isOwner?:boolean`, `onUpdate?:(p:Post)=>void`, `onNewPost?:(raw:any)=>void`
- **Создание опроса** в PostComposerFull — тоггл "📊 Добавить опрос", вопрос + варианты (2–8), отправляется с полем `poll`
- Все 6 стилей PostCard (классика/синема/газета/неон/пузырь/компакт) поддерживают новые элементы


## Музыкальный плеер (SwaipHome.tsx)
- **MusicPlayerSheet** — полноэкранный нижний лист с 5 дизайнами: 🎵 Classic, 💿 Vinyl, 🌙 Neon, 〰️ Wave, ⬜ Minimal
- Плейлист хранится в `localStorage` под ключом `swaip_playlist_v2`, не исчезает при перезагрузке
- Треки добавляются через устройство (upload + конвертация GCS в MP3) или по URL
- Глобальный аудио-синглтон `_globalAudio` — музыка не прерывается при переходах
- Редактирование названия/исполнителя, удаление треков, навигация (пред/след)
- **Floating mini-player** — всплывает снизу экрана при воспроизведении, показывает прогресс
- **Прикрепить к посту** — кнопка 📀 в PostComposerFull открывает пикер трека; кнопка 📎 в самом плеере прикрепляет и закрывает лист
- **Прикрепить к посту через плеер** — dispatch `swaip-track-picked-for-post` event → PostComposerFull слушает и показывает карточку трека
- Виджет 🎵 Музыка в профиле открывает плеер (через `setShowMusicSheet(true)`)
- Выбор стиля сохраняется в `localStorage` ключ `swaip_music_style`
- **КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ**: MusicPlayerSheet, mini-player и пикер были внутри `MeetingsScreen` (чужой компонент) — переенсены внутрь `SwaipHome` return (строки 7364-7456). Вот почему плеер вообще не открывался.
- **Исправлено**: music добавлен в WIDGET_LIST (L4044) — первым элементом
- **Исправлено**: все 6 стилей профиля обрабатывают `key==='music'` → `setShowMusicSheet(true)`
- **Исправлено**: `custom-ringtone.mp3` перемещён в `artifacts/swaip/public/` (был в `public/public/`)
- **Исправлено**: дублирующийся ключ `borderRight` в стиле 3 профиля

## Обзор проекта

SWAIP 2.0 — полноценная социальная сеть на русском языке с четырьмя режимами профиля («Про», «Круг», «Сцена», «Эфир»), видеозвонками, E2E-зашифрованным мессенджером, историями, отзывами, криптовалютой SWP и системой Каналов.

### Функция Каналы (ChannelsScreen.tsx)
Собственная система публичных каналов, более богатая чем в Telegram/VK:
- **Горизонтальная лента** — подписанные каналы как пузыри со скроллом вверху экрана
- **Вайб канала** — 10 вариантов «энергетики» (🔥 Горим, 💎 Премиум, 🚀 Прорыв…)
- **Пульс канала** — анимированный индикатор активности (0–100%), анимированное кольцо
- **Рубрики** — собственные тематические разделы внутри канала (как категории в журнале)
- **Типы постов**: текст, фото, опрос, анонс с обратным отсчётом ⏳, временная капсула, эпизоды сериала
- **Взвешенные реакции** — 🔥🚀 = 3 балла, 💎❤️ = 2, 🤔 = 1; счёт влияет на рейтинг
- **Мастер создания** — 4 шага: облик → атмосфера → рубрики → финал
- Данные хранятся в localStorage под ключом `swaip_account_{hash}_channels_v2`

## Стек технологий

| Уровень | Технология |
|---------|-----------|
| Монорепозиторий | pnpm workspaces |
| Node.js | v24 |
| Фронтенд | React 19 + Vite 7 + TailwindCSS |
| Бэкенд | Express 5 (TypeScript) |
| БД | PostgreSQL + Drizzle ORM |
| Видеозвонки | LiveKit SDK |
| Хранилище файлов | Google Cloud Storage (GCS) |
| Шифрование | @noble/curves (Ed25519) |
| Push-уведомления | web-push |
| Валидация | Zod v4 + drizzle-zod |
| Сборка | esbuild (ESM bundle) |

## Структура проекта

```
artifacts/
  api-server/       — Express 5 бэкенд (порт 8080)
    src/routes/     — 20+ маршрутов API
    src/lib/        — sessionAuth, objectStorage, GCS, WebSocket
    src/middlewares/ — contentFilter
    src/services/   — callSignaling, meetingChatWs
  swaip/            — React+Vite фронтенд (порт 18921, previewPath: /)
    src/App.tsx     — главный компонент (~15K строк)
    src/SwaipHome.tsx — домашний экран
    src/pages/      — дополнительные страницы
    src/hooks/      — кастомные хуки
lib/
  db/               — схема БД (13 таблиц), Drizzle ORM
  api-spec/         — OpenAPI yaml
  api-client-react/ — сгенерированные React Query хуки
  api-zod/          — сгенерированные Zod схемы
```

## Основные команды

```bash
# Проверка типов
pnpm --filter @workspace/api-server run typecheck

# Пересборка бэкенда
pnpm --filter @workspace/api-server run build

# Применить схему БД
pnpm --filter @workspace/db run push

# Регенерация API хуков (из openapi.yaml)
pnpm --filter @workspace/api-spec run codegen
```

## Воркфлоу

- **API Server** (`artifacts/api-server: API Server`) — Express 5, порт 8080
- **SWAIP Frontend** (`artifacts/swaip: web`) — Vite dev, порт 18921

## TypeScript — статус

Все 17 ошибок TS исправлены (2025-04-22):
- `objectStorage.ts` — приведение типа `response.json() as {signed_url: string}`
- `audioUpload.ts` — исправлена деструктуризация `[meta]` вместо `[[meta]]`
- `broadcasts.ts` — `authorMode` заменён на `'pro'` (нет в схеме comments)
- `chunkUpload.ts` — инициализация `let url = ""`
- `meetings.ts` (7 мест) — `req.params as { meetingId: string }`
- `messaging.ts` — SSE handler: `Promise<void>` + явные `return`
- `reviews.ts` (3 места) — `req.params as { hash: string }`
- `stories.ts` (3 места) — добавлены `return` перед `res.json()`/`res.status()`
- `tts.ts` — добавлен `return` перед `res.send()`

## База данных — схема (13 таблиц)

accounts, sessions, loginLogs, follows, broadcasts, broadcastReactions,
broadcastComments, commentReactions, stories, messaging (conversations,
messages, conversationParticipants, messageReactions), meetings,
meetingParticipants, meetingMessages, meetingLogs, reviews, swpWallets,
moderationReports, moderationBans, moderationLog, pushSubscriptions

## Известные ограничения (из аудита)

- `/api/git-push` — не требует авторизации (risk: code injection)
- `SESSION_SECRET` используется и для сессий и для шифрования сообщений
- Инвайт-коды: поиск без индекса (full table scan при росте)
- Курс SWP — захардкожен, не из реального источника
- `App.tsx` — монстр-компонент (~15K строк), нужен рефакторинг
