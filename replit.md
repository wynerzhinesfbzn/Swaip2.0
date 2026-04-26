# SWAIP 2.0 — Русскоязычная социальная сеть

## Встроенный браузер SWAIP (SwaipHome.tsx)
- Вкладка 🌐 **Браузер** в нижней навигации (navTab='browser')
- Также доступен из бокового меню (SideMenu) первым пунктом
- **Адресная строка**: ввод URL или поискового запроса, кнопки ← › ↺ ↗ ⤤
- **Стартовая страница**: поиск + speed dial (Google, YouTube, Яндекс, VK, ChatGPT, Wikipedia, WB, Яндекс.Карты)
- **Блокировка iframe**: если сайт запрещает встраивание, показывается экран с кнопкой "Открыть в системном браузере"
- **Глобальный перехватчик ссылок**: все `<a href="http...">` в приложении перехватываются и открываются в браузере SWAIP (document click capture handler)
- История навигации с кнопками назад/вперёд

## Треды и Закладки в постах (SwaipHome.tsx)
- **Кнопка 🧵 Треды**: все 6 стилей PostCard, открывает ветку ответов под постом
- **Кнопка 🔖 Закладки**: все 6 стилей PostCard, сохраняет/убирает пост
- **Экран Закладки** (🔖 в нижнем профильном таббаре): загружает сохранённые посты через `GET /api/bookmarks`
- API: `POST /bookmarks/:id` (toggle), `GET /bookmarks`, `GET /broadcasts/:id/replies`, `POST /broadcasts` с `parentId`

## Анимированный статус-настроение (SwaipHome.tsx)
- 16 настроений (😊 Отлично, 🔥 В потоке, 💡 Вдохновлён, 😴 Устал...)
- Пикер открывается кнопкой "+ Статус настроения" под ником в профиле
- Эмодзи анимированно «качается» в бейдже (framer-motion rotate loop)
- Сохраняется как `pro_mood` в localStorage → автосинхронизируется с сервером
- Отображается у других пользователей в поисковых результатах
- `searchResults` обогащён полем `mood?:{emoji,text}` из API (JSONB `data->'pro_mood'`)

## Видеосообщения-кружки (ProMessaging.tsx)
- Видео в чате отображается кружком 200×200px (`border-radius:50%`, `object-fit:cover`)
- Запись: предпросмотр 260×260px с пульсирующей красной рамкой (`border: 3px solid red`)
- Длительность видео отображается бейджем поверх кружка

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

Исправления после клонирования (2026-04-26):
- `routes/battle.ts` — заменены несуществующие колонки `accountsTable.proName/proAvatar` на SQL-выражения `data->>'pro_displayName'` и `data->>'pro_avatarUrl'`; `req.params['id'] as string`.
- `routes/broadcasts.ts` (DELETE /broadcasts/:id) — убран сломанный поиск по `accountsTable.sessionToken`; используется `userHash` из `requireSession`.
- `pnpm --filter @workspace/api-server run typecheck` проходит без ошибок.

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

## Композер постов: расширение «Добавить в пост» (2026-04-26)

В единое меню `+ Добавить в пост` (SwaipHome.tsx ~9012) добавлены 12 новых блоков:
- 🖼️ Карусель / галерея (до 10 фото, parallel upload через `/api/image-upload`, поле `additionalImageUrls`)
- 🔗 Превью ссылки (новый эндпоинт `GET /api/link-preview` парсит OG-метаданные, поле `linkPreview`)
- ❓ Вопрос подписчикам (поле `question`, ответы планируются в личку)
- 🎯 Викторина / квиз (требует включённый опрос, поле `quiz.correctIndex`)
- 🏆 Челлендж (название + хештег + дедлайн, поле `challenge`)
- 🎬 Активность (5 типов: фильм/музыка/книга/игра/сериал, поле `activity`)
- 🏷️ Отметить людей (до 10 пользователей через `/api/search`, поле `mentions`)
- #️⃣ Хештеги / темы (до 10, popular tags подсказки, поле `hashtags`)
- 🔊 Озвучка текста / TTS (флаг `enableTTS`)
- 📈 Детальная статистика (флаг `enableStats`)
- 🚫 Запретить комментарии (флаг `disableComments`)
- ♻️ Запретить репост (флаг `disableRepost`)

Каждый блок:
- Появляется только при включении в меню
- Имеет шапку с эмодзи + название + кнопкой ✕ для удаления
- Состояния очищаются в `reset()`

Backend: добавлен `routes/linkPreview.ts` — fetch URL → парсинг `og:title/description/image/site_name` через regex (с timeout 6s, лимит 200KB HTML, абсолютные image URLs). Зарегистрирован в `routes/index.ts`.

Все новые поля идут в `extras`-объекты при POST `/api/broadcasts` — backend сохраняет их в `data` JSONB колонку без явной валидации (отображение в ленте — отдельная задача).

## Фоновая музыка постов (2026-04-26)

В композер добавлен пресет `🎵 Фоновая музыка` (15-я опция в меню «➕ Добавить в пост»).

### 14 встроенных пресетов (3 категории)
- **Кинематограф**: Саспенс терминала, Тёмный удар, Битва в центре, Зловещий I, Зловещий II
- **Детектив**: Неон в допросной, Имя зачёркнутое чернилами, Заброшенная глушь
- **Природа**: Лесные птицы, Светлячки, Птицы у реки, Маленький ручей, Тихий поток (loop), Лёгкий дождь

Импорт через `@assets/*.mp3` (Vite alias `attached_assets/`). В композере — превью (▶ кнопка) + выбор галочкой.

### Авто-плеер в ленте
- Компонент `BgMusicAutoplay` (SwaipHome.tsx ~1949) рендерится в каждом из 5 стилей `PostCard` (через `bgMusicAutoplayEl`).
- Использует `IntersectionObserver` на самой post-wrapper div (находится через `sentinelRef.nextElementSibling.nextElementSibling`).
- При intersection >= 0.4 → автозапуск (loop, volume 0.45).
- **Глобальный singleton**: `window._swaipBgAudio` + `_swaipBgPostId` — одновременно играет только одна дорожка; новый пост в зоне видимости останавливает предыдущий.
- Если браузер блокирует autoplay → показывается кнопка `▶ Включить звук` (после первого user-gesture работает).
- Mute-настройка `swaip_bg_muted` в localStorage (кнопка 🔔/🔕 в шапке).

### Передача с поста
- Поля `bgMusicUrl` + `bgMusicLabel` в `Post`-интерфейсе и `rawToPost()`.
- Отправляются в обоих body POST `/api/broadcasts` (postData + JSON).
- Backend сохраняет в `data` JSONB (без явной схемной валидации).

## Фоновая музыка — расширено на каналы и чаты (2026-04-26)

Создан общий модуль `src/BgMusic.tsx` с:
- 14 пресетов (3 категории), импорт mp3 из `@assets/`.
- `BgMusicAutoplay` (singleton-плеер с IO-наблюдателем). Принимает `attach: 'sibling'|'parent'` (по умолчанию `'sibling'` — для совместимости с PostCard).
- `BgMusicPicker` — компактная сетка пресетов с превью (▶/⏸) и выбором (✓).

### Где доступно
- **Лента (PostCard)** — `bgmusic` в меню «➕ Добавить в пост».
- **Каналы/Группы (`GroupComposer` в ChannelsScreen)** — кнопка «🎵 Фоновая музыка» в композере, сохранение в `GroupPost.bgMusicUrl/bgMusicLabel`. `GroupPostCard` рендерит `<BgMusicAutoplay attach="parent"/>` в начале карточки.
- **Чаты (1:1, групповые, broadcast)** — кнопка «🎵» рядом с 😊 в input-bar. Открывает шит с пикером + кнопкой «Отправить». Отправляется как сообщение `messageType='bgmusic'` (`mediaUrl`=URL, `mediaName`=label). В рендере: `<BgMusicAutoplay attach="parent"/>`. Превью в списке чатов: `🎵 [label]`.
- **Секретные E2E-чаты** — кнопка `🎵` скрыта (URL не шифруется через E2E, чтобы не разглашать дорожку).

### Архитектура singleton'а
`window._swaipBgAudio` + `_swaipBgPostId` — один плеер на всё приложение. Музыка из ленты, канала и чата конкурирует за одну активную дорожку. localStorage `swaip_bg_muted` глобален.
