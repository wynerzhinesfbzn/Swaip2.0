import { Router, type IRouter } from "express";
import { getSessionToken, resolveSession } from "../lib/sessionAuth.js";
import { db, messagesTable, conversationsTable, scheduledMessagesTable } from "@workspace/db";
import { eq, and, lte } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { encryptMessage } from "../lib/messageCrypto.js";
import { notifyConvClients } from "./messaging.js";

const router: IRouter = Router();

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

function serializeMsg(m: any) {
  return {
    id: m.id,
    userHash: m.userHash,
    conversationId: m.conversationId,
    content: m.content,
    messageType: m.messageType,
    mediaUrl: m.mediaUrl || null,
    sendAt: m.sendAt instanceof Date ? m.sendAt.getTime() : Number(m.sendAt),
    createdAt: m.createdAt instanceof Date ? m.createdAt.getTime() : Number(m.createdAt),
    sent: m.sent,
  };
}

/* ── Background dispatcher — runs every 30s ── */
async function dispatchDue() {
  const now = new Date();
  try {
    const due = await db.select().from(scheduledMessagesTable)
      .where(and(eq(scheduledMessagesTable.sent, false), lte(scheduledMessagesTable.sendAt, now)));

    for (const msg of due) {
      try {
        const convRows = await db.select().from(conversationsTable)
          .where(eq(conversationsTable.id, msg.conversationId)).limit(1);
        if (!convRows.length) {
          await db.delete(scheduledMessagesTable).where(eq(scheduledMessagesTable.id, msg.id));
          continue;
        }

        const conv = convRows[0];
        const isSecret = conv.type === 'secret';
        /* Encrypt at rest — same as the regular messages endpoint */
        const storedContent = isSecret
          ? msg.content
          : encryptMessage(msg.content, msg.conversationId);

        const [inserted] = await db.insert(messagesTable).values({
          conversationId: msg.conversationId,
          senderHash: msg.userHash,
          content: storedContent,
          messageType: msg.messageType,
          mediaUrl: msg.mediaUrl || null,
        }).returning();

        /* Update conversation's lastMessageAt so the chat list re-orders */
        await db.update(conversationsTable)
          .set({ lastMessageAt: new Date() })
          .where(eq(conversationsTable.id, msg.conversationId));

        /* Notify SSE clients so the message appears in real-time */
        notifyConvClients(msg.conversationId, {
          type: 'new_message',
          message: { ...inserted, content: msg.content },
        });

        await db.update(scheduledMessagesTable)
          .set({ sent: true })
          .where(eq(scheduledMessagesTable.id, msg.id));

        logger.info({ msgId: msg.id }, 'scheduled message dispatched');

        /* Clean up after 5 min */
        setTimeout(async () => {
          await db.delete(scheduledMessagesTable).where(eq(scheduledMessagesTable.id, msg.id));
        }, 5 * 60_000);
      } catch (e) {
        logger.warn({ err: e, msgId: msg.id }, 'scheduled message dispatch failed');
      }
    }
  } catch (e) {
    logger.warn({ err: e }, 'scheduled messages dispatch error');
  }
}
setInterval(dispatchDue, 30_000);

/* POST /api/scheduled-messages */
router.post('/scheduled-messages', async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: 'Unauthorized' });

  const { conversationId, content, messageType, mediaUrl, sendAt } = req.body as any;
  if (!conversationId || !content?.trim() || !sendAt) {
    return res.status(400).json({ error: 'conversationId, content, sendAt required' });
  }
  const sendDate = new Date(sendAt);
  if (isNaN(sendDate.getTime()) || sendDate.getTime() <= Date.now()) {
    return res.status(400).json({ error: 'sendAt must be in the future' });
  }

  const id = genId();
  await db.insert(scheduledMessagesTable).values({
    id,
    userHash,
    conversationId: Number(conversationId),
    content: String(content).trim().slice(0, 10000),
    messageType: String(messageType || 'text'),
    mediaUrl: typeof mediaUrl === 'string' ? mediaUrl : null,
    sendAt: sendDate,
    sent: false,
  });

  const row = (await db.select().from(scheduledMessagesTable)
    .where(eq(scheduledMessagesTable.id, id)).limit(1))[0];
  return res.json({ success: true, scheduledMessage: serializeMsg(row) });
});

/* GET /api/scheduled-messages?conversationId=N */
router.get('/scheduled-messages', async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: 'Unauthorized' });

  const convId = req.query.conversationId ? Number(req.query.conversationId) : null;
  const conditions: any[] = [
    eq(scheduledMessagesTable.userHash, userHash),
    eq(scheduledMessagesTable.sent, false),
  ];
  if (convId) conditions.push(eq(scheduledMessagesTable.conversationId, convId));

  const rows = await db.select().from(scheduledMessagesTable).where(and(...conditions));
  rows.sort((a, b) => {
    const aTs = a.sendAt instanceof Date ? a.sendAt.getTime() : Number(a.sendAt);
    const bTs = b.sendAt instanceof Date ? b.sendAt.getTime() : Number(b.sendAt);
    return aTs - bTs;
  });

  return res.json({ scheduledMessages: rows.map(serializeMsg) });
});

/* DELETE /api/scheduled-messages/:id */
router.delete('/scheduled-messages/:id', async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: 'Unauthorized' });

  const rows = await db.select().from(scheduledMessagesTable)
    .where(eq(scheduledMessagesTable.id, req.params.id)).limit(1);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  if (rows[0].userHash !== userHash) return res.status(403).json({ error: 'Forbidden' });
  if (rows[0].sent) return res.status(400).json({ error: 'Already sent' });

  await db.delete(scheduledMessagesTable).where(eq(scheduledMessagesTable.id, req.params.id));
  return res.json({ success: true });
});

export default router;
