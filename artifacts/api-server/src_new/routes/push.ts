import { Router, type IRouter } from "express";
import webpush from "web-push";
import { db, accountsTable, pushSubscriptionsTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireSession } from "../lib/sessionAuth.js";

const router: IRouter = Router();

/* ── Настраиваем VAPID ── */
const VAPID_PUBLIC  = process.env['VAPID_PUBLIC_KEY']  ?? '';
const VAPID_PRIVATE = process.env['VAPID_PRIVATE_KEY'] ?? '';
const VAPID_EMAIL   = process.env['VAPID_EMAIL']       ?? 'mailto:admin@swaip.app';

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

/* ── Экспортируем публичный VAPID-ключ ── */
router.get("/push/vapid-public-key", (_req, res) => {
  return res.json({ publicKey: VAPID_PUBLIC });
});

/* ── Подписаться / обновить подписку ── */
router.post("/push/subscribe", requireSession, async (req, res) => {
  const me = (req as any).userHash as string;
  const { endpoint, keys } = req.body ?? {};

  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "Invalid subscription" });
  }

  try {
    await db
      .insert(pushSubscriptionsTable)
      .values({ userHash: me, endpoint, p256dh: keys.p256dh, auth: keys.auth })
      .onConflictDoUpdate({
        target: [pushSubscriptionsTable.userHash, pushSubscriptionsTable.endpoint],
        set: { p256dh: keys.p256dh, auth: keys.auth },
      });
    return res.json({ success: true });
  } catch (e) {
    console.error("[push] subscribe error", e);
    return res.status(500).json({ error: "Server error" });
  }
});

/* ── Отписаться ── */
router.delete("/push/subscribe", requireSession, async (req, res) => {
  const me = (req as any).userHash as string;
  const { endpoint } = req.body ?? {};

  try {
    if (endpoint) {
      await db.delete(pushSubscriptionsTable).where(
        and(eq(pushSubscriptionsTable.userHash, me), eq(pushSubscriptionsTable.endpoint, endpoint))
      );
    } else {
      await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userHash, me));
    }
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

/* ── Утилита: отправить push одному или нескольким пользователям ── */
export async function sendPushToUsers(
  userHashes: string[],
  payload: { title: string; body: string; tag?: string; url?: string; icon?: string }
): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;
  if (!userHashes.length) return;

  try {
    const subs = await db
      .select()
      .from(pushSubscriptionsTable)
      .where(inArray(pushSubscriptionsTable.userHash, userHashes));

    if (!subs.length) return;

    const payloadStr = JSON.stringify(payload);

    await Promise.allSettled(
      subs.map(sub =>
        webpush
          .sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payloadStr
          )
          .catch(async err => {
            /* Подписка устарела (410 Gone) — удаляем */
            if (err.statusCode === 410 || err.statusCode === 404) {
              await db
                .delete(pushSubscriptionsTable)
                .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint))
                .catch(() => {});
            }
          })
      )
    );
  } catch (e) {
    console.error("[push] sendPushToUsers error", e);
  }
}

export default router;
