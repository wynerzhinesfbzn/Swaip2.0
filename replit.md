# SWAIP

Русскоязычная социальная сеть в формате PWA, разработанная в Набережных Челнах. Включает мессенджер, ленту, клипы, маркетплейс, мероприятия, опросы, игры, виртуальных AI-ассистентов и многое другое.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — запустить API сервер (порт 8080)
- `pnpm --filter @workspace/swaip run dev` — запустить фронтенд (порт 18921)
- `pnpm run typecheck` — полная проверка типов всех пакетов
- `pnpm run build` — typecheck + сборка всех пакетов
- `pnpm --filter @workspace/api-spec run codegen` — регенерация API hooks и Zod-схем из OpenAPI spec
- `pnpm --filter @workspace/db run push` — применить изменения схемы БД (только dev)
- Required env: `DATABASE_URL`, `SESSION_SECRET`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React 19 + Vite 7 + Tailwind CSS 4 (PWA)
- Backend: Express 5 + WebSocket (ws)
- DB: PostgreSQL 16 + Drizzle ORM
- AI: OpenAI через Replit AI Integrations proxy
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (из OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

```
artifacts/
  swaip/               — Фронтенд (React + Vite, PWA), порт 18921
  api-server/          — Бэкенд (Express + TS + Drizzle), порт 8080
  mockup-sandbox/      — Canvas/дизайн-превью
lib/
  db/                  — Drizzle схемы + миграции + клиент Postgres
  api-spec/            — OpenAPI спецификация (источник истины)
  api-zod/             — Сгенерированные Zod схемы
  api-client-react/    — Сгенерированные React Query hooks
  integrations-openai-ai-server/ — OpenAI интеграция (TTS, STT, Chat)
  integrations-openai-ai-react/  — React hooks для OpenAI
scripts/               — Утилиты (post-merge.sh)
attached_assets/       — Медиафайлы (фото, аудио) — @assets alias
```

## Architecture decisions

- **Аутентификация через Ed25519**: пользователи идентифицируются по `userHash` (hex), токены хранятся в `localStorage` и передаются в заголовке `x-session-token`
- **WebSocket через единый HTTP сервер**: все WS (`/api/ws/calls`, `/api/ws/meeting-chat`, `/api/ws/lounge`, `/api/ws/cinema`) обрабатываются через ручной `upgrade`-роутер на одном httpServer — обходит баг ws@8
- **OpenAI TTS через chat completions**: `/audio/speech` не поддерживается Replit AI proxy, поэтому TTS реализован через `modalities: ["text","audio"]` в chat completions с `model: "gpt-audio"`
- **Контент-фильтрация**: middleware `contentFilter.ts` фильтрует запрещённые слова и NSFW-контент
- **Object Storage**: файлы (фото, видео, аудио, документы) хранятся в Replit Object Storage

## Product

SWAIP — полнофункциональная русскоязычная социальная сеть:
- 💬 Мессенджер с шифрованием, видеокружками, исчезающими сообщениями
- 📡 Лента (broadcasts), клипы (TikTok-формат), истории
- 🎮 12 встроенных игр (шахматы, шашки, домино, дурак, мафия, крокодил и др.)
- 🤖 13 AI-ассистентов (юрист, врач, бухгалтер, психолог и др.)
- 🛒 Маркетплейс, мероприятия, опросы, капсулы времени
- 📞 Аудио/видеозвонки (WebRTC), Lounge-комнаты, Cinema (совместный просмотр)
- 🎤 Karaoke, настроение дня, ежедневные челленджи

## User preferences

- Никогда не использовать `console.log` в серверном коде — только `req.log` / `logger`
- Не использовать `openai.audio.speech.create()` — только `textToSpeech()` из интеграции
- WS аутентификация только через `resolveSession(token)`, не через raw hash
- Токен GitHub PAT передавать только в теле POST-запроса (не в URL)

## Gotchas

- `@assets` alias → `/home/runner/workspace/attached_assets/` (не `src/assets/`)
- App.tsx и SwaipHome.tsx — очень большие файлы (25k+ и 11k+ строк), Babel предупреждает о deoptimisation — это нормально
- `pnpm-workspace.yaml` включает `lib/integrations/*` для вложенных lib-пакетов интеграций
- При добавлении нового маршрута — импортировать и зарегистрировать в `routes/index.ts`
- При изменении схемы БД — запустить `pnpm --filter @workspace/db run push`

## Pointers

- AGENTS.md — подробная архитектурная документация для агентов
- `lib/db/src/schema/schema/` — все Drizzle-схемы таблиц
- `artifacts/swaip/src/specialistsConfig.ts` — конфиг 13 AI-ассистентов
- `artifacts/api-server/src/routes/index.ts` — регистрация всех маршрутов
