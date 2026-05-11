import http from "http";
import app from "./app";
import { logger } from "./lib/logger";
import { attachCallSignaling } from "./lib/callSignaling";
import { attachMeetingChatWs } from "./lib/meetingChatWs";
import { attachLoungeWs } from "./lib/loungeWs";
import { attachCinemaWs } from "./lib/cinemaWs";
import { db, accountsTable, sessionsTable, broadcastsTable, broadcastCommentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/*
 * ONE-TIME МИГРАЦИИ (идемпотентны — безопасно запускать многократно)
 *
 * История: у пользователя "ДАН МАЛИ" было два аккаунта:
 *   OLD = cbf476db... (старый, создан через устаревший /api/sessions без Ed25519)
 *   NEW = 20e0dbfa... (рабочий, create через Ed25519, тема tokyo/silk)
 * Гость видел профиль OLD → синий дефолт вместо реального дизайна.
 *
 * Миграция 1: удаляем дублирующий аккаунт OLD из accounts и sessions
 * Миграция 2: переносим broadcasts и комментарии с OLD → NEW
 *   (посты были созданы когда пользователь был залогинен как OLD)
 */
const OLD_HASH = "cbf476db46b1b092d4947493fe527ee1ba62d62286fb4e44684aad07790fc907";
const NEW_HASH = "20e0dbfaa350282ecb2cdc1931a43d0c3d3a05ab523540742df91813affb4a3d";

(async () => {
  /* ── Миграция 1: удалить дублирующий аккаунт ── */
  try {
    await db.delete(sessionsTable).where(eq(sessionsTable.userHash, OLD_HASH));
    await db.delete(accountsTable).where(eq(accountsTable.hash, OLD_HASH));
    logger.info({ hash: OLD_HASH.slice(0,16) }, "MIG-1: duplicate account cleaned");
  } catch (e) {
    logger.warn({ err: e }, "MIG-1: skipped (already done or error)");
  }

  /* ── Миграция 2: перенести broadcasts OLD → NEW ── */
  try {
    const moved = await db
      .update(broadcastsTable)
      .set({ authorHash: NEW_HASH })
      .where(eq(broadcastsTable.authorHash, OLD_HASH));
    logger.info({ count: moved.rowCount ?? 0, from: OLD_HASH.slice(0,16), to: NEW_HASH.slice(0,16) },
      "MIG-2: broadcasts transferred to new account");
  } catch (e) {
    logger.warn({ err: e }, "MIG-2: broadcasts transfer skipped");
  }

  /* ── Миграция 3: перенести комментарии OLD → NEW ── */
  try {
    const moved = await db
      .update(broadcastCommentsTable)
      .set({ authorHash: NEW_HASH })
      .where(eq(broadcastCommentsTable.authorHash, OLD_HASH));
    logger.info({ count: moved.rowCount ?? 0 }, "MIG-3: comments transferred to new account");
  } catch (e) {
    logger.warn({ err: e }, "MIG-3: comments transfer skipped");
  }
})();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = http.createServer(app);

const callWss    = attachCallSignaling();
const meetingWss = attachMeetingChatWs();
const loungeWss  = attachLoungeWs();
const cinemaWss  = attachCinemaWs();

/* ── Central WebSocket upgrade router ──
 * Using noServer:true on all WS servers + manual routing avoids the
 * ws@8 bug where multiple WebSocketServers on the same httpServer
 * each register an 'upgrade' listener and the first non-matching one
 * can return 400 before the correct handler sees the request.
 */
httpServer.on('upgrade', (req, socket, head) => {
  const rawUrl = req.url || '';
  const qIdx   = rawUrl.indexOf('?');
  const path   = qIdx >= 0 ? rawUrl.slice(0, qIdx) : rawUrl;

  if (path === '/api/ws/calls') {
    callWss.handleUpgrade(req, socket, head, ws => callWss.emit('connection', ws, req));
  } else if (path === '/api/ws/meeting-chat') {
    meetingWss.handleUpgrade(req, socket, head, ws => meetingWss.emit('connection', ws, req));
  } else if (path === '/api/ws/lounge') {
    loungeWss.handleUpgrade(req, socket, head, ws => loungeWss.emit('connection', ws, req));
  } else if (path === '/api/ws/cinema') {
    cinemaWss.handleUpgrade(req, socket, head, ws => cinemaWss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

httpServer.on("error", (err) => {
  logger.error({ err }, "Error starting server");
  process.exit(1);
});

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening (HTTP + WebSocket /ws/calls)");
});

function shutdown() {
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT",  shutdown);
