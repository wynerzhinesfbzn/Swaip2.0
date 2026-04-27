import { Router, type IRouter, type Response as ExpressRes } from "express";
import { db, accountsTable, conversationsTable, messagesTable, followsTable, conversationParticipantsTable, messageReactionsTable } from "@workspace/db";
import { eq, and, or, desc, sql, inArray, asc } from "drizzle-orm";
import { requireSession, resolveSession, getSessionToken } from "../lib/sessionAuth.js";
import { encryptMessage, decryptMessage } from "../lib/messageCrypto.js";
import { contentFilter } from "../middlewares/contentFilter.js";
import { sendPushToUsers } from "./push.js";

const router: IRouter = Router();

/* ── SSE pub-sub: convId → Set<res> ── */
const sseClients = new Map<number, Set<ExpressRes>>();

export function notifyConvClients(convId: number, event: Record<string, unknown>) {
  const clients = sseClients.get(convId);
  if (!clients || clients.size === 0) return;
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  const dead: ExpressRes[] = [];
  for (const r of clients) {
    try { r.write(payload); } catch { dead.push(r); }
  }
  for (const r of dead) clients.delete(r);
  if (clients.size === 0) sseClients.delete(convId);
}

/* ── Rate limiting: 30 сообщений/мин на пользователя ── */
const msgRateMap = new Map<string, { count: number; resetAt: number }>();
function msgRateLimit(userHash: string, max = 30): boolean {
  const now = Date.now();
  const entry = msgRateMap.get(userHash);
  if (!entry || entry.resetAt < now) { msgRateMap.set(userHash, { count: 1, resetAt: now + 60_000 }); return true; }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of msgRateMap) if (v.resetAt < now) msgRateMap.delete(k); }, 5 * 60_000);

const MAX_MSG_LENGTH = 10_000;

async function getAuthorInfo(hash: string) {
  if (!hash) return { name: 'Пользователь', avatar: '', handle: '' };
  try {
    const rows = await db.select().from(accountsTable).where(eq(accountsTable.hash, hash)).limit(1);
    if (!rows.length) return { name: 'Пользователь', avatar: '', handle: '' };
    const data = (rows[0].data as Record<string, unknown>) ?? {};
    const parse = (v: unknown) => {
      if (!v) return '';
      if (typeof v === 'string') { try { const p = JSON.parse(v); return typeof p === 'string' ? p : ''; } catch { return v; } }
      return '';
    };
    const name = parse(data['pro_displayName']) || parse(data['scene_artistName']) || 'Пользователь';
    const avatar = parse(data['pro_avatarUrl']) || parse(data['scene_avatarUrl']) || '';
    const handle = parse(data['pro_fullName']) || parse(data['scene_handle']) || '';
    return { name, avatar, handle };
  } catch { return { name: 'Пользователь', avatar: '', handle: '' }; }
}

async function canAccess(convId: number, userHash: string): Promise<boolean> {
  const conv = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId)).limit(1);
  if (!conv.length) return false;
  const c = conv[0];
  if (c.type === 'dm' || c.type === 'secret') return c.participant1 === userHash || c.participant2 === userHash;
  const p = await db.select().from(conversationParticipantsTable)
    .where(and(eq(conversationParticipantsTable.conversationId, convId), eq(conversationParticipantsTable.userHash, userHash))).limit(1);
  return p.length > 0;
}

async function getParticipantHashes(conv: { id: number; type: string; participant1: string; participant2: string }): Promise<string[]> {
  if (conv.type === 'dm') return [conv.participant1, conv.participant2];
  const rows = await db.select().from(conversationParticipantsTable)
    .where(eq(conversationParticipantsTable.conversationId, conv.id));
  return rows.map(r => r.userHash);
}

/* ─────────────────────────── FOLLOWS ─────────────────────────── */

router.get("/follows/:hash", async (req, res) => {
  const { hash } = req.params;
  /* Optional session — needed for isFollowing check */
  const token = getSessionToken(req);
  const me = token ? await resolveSession(token) : null;

  try {
    const [followers, following, myFollow, theirFollow] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(followsTable).where(eq(followsTable.followingHash, hash)),
      db.select({ count: sql<number>`count(*)::int` }).from(followsTable).where(eq(followsTable.followerHash, hash)),
      me ? db.select().from(followsTable).where(and(eq(followsTable.followerHash, me), eq(followsTable.followingHash, hash))).limit(1) : Promise.resolve([]),
      me ? db.select().from(followsTable).where(and(eq(followsTable.followerHash, hash), eq(followsTable.followingHash, me))).limit(1) : Promise.resolve([]),
    ]);
    const isFollowing = myFollow.length > 0;
    return res.json({
      followers: followers[0]?.count ?? 0,
      following: following[0]?.count ?? 0,
      isFollowing,
      isMutual: isFollowing && theirFollow.length > 0,
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/follows", requireSession, async (req, res) => {
  const me = req.userHash as string;
  const { targetHash } = req.body;
  if (!targetHash || targetHash === me) return res.status(400).json({ error: "Bad request" });
  try {
    const existing = await db.select().from(followsTable)
      .where(and(eq(followsTable.followerHash, me), eq(followsTable.followingHash, targetHash))).limit(1);
    if (existing.length > 0) {
      await db.delete(followsTable)
        .where(and(eq(followsTable.followerHash, me), eq(followsTable.followingHash, targetHash)));
      return res.json({ isFollowing: false });
    } else {
      await db.insert(followsTable).values({ followerHash: me, followingHash: targetHash });
      return res.json({ isFollowing: true });
    }
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

/* GET /follows/:hash/list?type=followers|following|friends
   Returns enriched list of users (hash + name + avatar + handle) */
router.get("/follows/:hash/list", async (req, res) => {
  const { hash } = req.params;
  const type = (req.query.type as string) || 'followers';
  try {
    let hashes: string[] = [];
    if (type === 'followers') {
      /* People who follow hash */
      const rows = await db.select({ h: followsTable.followerHash })
        .from(followsTable).where(eq(followsTable.followingHash, hash));
      hashes = rows.map(r => r.h);
    } else if (type === 'following') {
      /* People that hash follows */
      const rows = await db.select({ h: followsTable.followingHash })
        .from(followsTable).where(eq(followsTable.followerHash, hash));
      hashes = rows.map(r => r.h);
    } else if (type === 'friends') {
      /* Mutual: hash follows them AND they follow hash */
      const [following, followers] = await Promise.all([
        db.select({ h: followsTable.followingHash }).from(followsTable).where(eq(followsTable.followerHash, hash)),
        db.select({ h: followsTable.followerHash }).from(followsTable).where(eq(followsTable.followingHash, hash)),
      ]);
      const followingSet = new Set(following.map(r => r.h));
      hashes = followers.filter(r => followingSet.has(r.h)).map(r => r.h);
    }
    if (!hashes.length) return res.json({ users: [] });
    const accounts = await db.select().from(accountsTable).where(inArray(accountsTable.hash, hashes));
    const users = accounts.map(a => {
      const d = (a.data as Record<string, unknown>) ?? {};
      const parse = (v: unknown) => {
        if (!v) return '';
        if (typeof v === 'string') { try { const p = JSON.parse(v); return typeof p === 'string' ? p : ''; } catch { return v; } }
        return '';
      };
      return {
        hash: a.hash,
        name: parse(d['pro_displayName']) || parse(d['scene_artistName']) || 'Участник SWAIP',
        avatar: parse(d['pro_avatarUrl']) || parse(d['scene_avatarUrl']) || '',
        handle: parse(d['pro_fullName']) || parse(d['scene_handle']) || '',
        mode: parse(d['pro_displayName']) ? 'pro' : 'scene',
      };
    });
    return res.json({ users });
  } catch { return res.status(500).json({ error: "Server error" }); }
});

/* POST /follows/mutual  — обе стороны становятся подписчиками друг друга */
router.post("/follows/mutual", requireSession, async (req, res) => {
  const me = req.userHash as string;
  const { targetHash } = req.body;
  if (!targetHash || targetHash === me) return res.status(400).json({ error: "Bad request" });
  try {
    /* me → target */
    const meToTarget = await db.select().from(followsTable)
      .where(and(eq(followsTable.followerHash, me), eq(followsTable.followingHash, targetHash))).limit(1);
    if (!meToTarget.length) await db.insert(followsTable).values({ followerHash: me, followingHash: targetHash });
    /* target → me */
    const targetToMe = await db.select().from(followsTable)
      .where(and(eq(followsTable.followerHash, targetHash), eq(followsTable.followingHash, me))).limit(1);
    if (!targetToMe.length) await db.insert(followsTable).values({ followerHash: targetHash, followingHash: me });
    return res.json({ mutual: true });
  } catch { return res.status(500).json({ error: "Server error" }); }
});

/* ─────────────────────────── CONVERSATIONS ─────────────────────────── */

router.get("/conversations", requireSession, async (req, res) => {
  const me = req.userHash as string;
  try {
    const dmConvs = await db.select().from(conversationsTable)
      .where(and(
        or(eq(conversationsTable.participant1, me), eq(conversationsTable.participant2, me)),
        or(eq(conversationsTable.type, 'dm'), eq(conversationsTable.type, 'secret'))
      ))
      .orderBy(desc(conversationsTable.lastMessageAt));

    const myGroupParticipations = await db.select().from(conversationParticipantsTable)
      .where(eq(conversationParticipantsTable.userHash, me));
    const groupIds = myGroupParticipations.map(p => p.conversationId);
    const groupAndBcastConvs = groupIds.length > 0
      ? await db.select().from(conversationsTable)
          .where(and(inArray(conversationsTable.id, groupIds), or(eq(conversationsTable.type, 'group'), eq(conversationsTable.type, 'broadcast'))))
          .orderBy(desc(conversationsTable.lastMessageAt))
      : [];
    const groupConvs = groupAndBcastConvs;

    const allConvs = [...dmConvs, ...groupConvs].sort(
      (a, b) => new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime()
    );

    const result = await Promise.all(allConvs.map(async c => {
      const [lastMsg, unread] = await Promise.all([
        db.select().from(messagesTable)
          .where(eq(messagesTable.conversationId, c.id))
          .orderBy(desc(messagesTable.createdAt)).limit(1),
        db.select({ count: sql<number>`count(*)::int` }).from(messagesTable)
          .where(and(
            eq(messagesTable.conversationId, c.id),
            eq(messagesTable.isRead, false),
            sql`${messagesTable.senderHash} != ${me}`
          )),
      ]);

      if (c.type === 'dm' || c.type === 'secret') {
        const otherHash = c.participant1 === me ? c.participant2 : c.participant1;
        const otherInfo = await getAuthorInfo(otherHash);
        /* Для секретных чатов последнее сообщение НЕ расшифровываем на сервере */
        const lastMsgContent = lastMsg[0]
          ? (lastMsg[0].messageType === 'system'
              ? lastMsg[0].content
              : c.type === 'secret'
                ? '🔒 Зашифровано'
                : decryptMessage(lastMsg[0].content, c.id))
          : null;
        return {
          id: c.id,
          type: c.type,
          otherHash,
          otherInfo,
          name: null,
          participants: [],
          isSecret: c.isSecret ?? false,
          pubKey1: c.pubKey1 ?? null,
          pubKey2: c.pubKey2 ?? null,
          burnTimer: c.burnTimer ?? 0,
          lastMessage: lastMsg[0] ? { ...lastMsg[0], content: lastMsgContent } : null,
          unreadCount: unread[0]?.count ?? 0,
          lastMessageAt: c.lastMessageAt,
        };
      } else {
        const participantRows = await db.select().from(conversationParticipantsTable)
          .where(eq(conversationParticipantsTable.conversationId, c.id));
        const participantHashes = participantRows.map(p => p.userHash);
        const participantInfos = await Promise.all(participantHashes.map(h => getAuthorInfo(h)));
        return {
          id: c.id,
          type: c.type, /* 'group' | 'broadcast' */
          otherHash: '',
          otherInfo: { name: c.name ?? (c.type === 'broadcast' ? 'Канал' : 'Беседа'), avatar: '', handle: '' },
          name: c.name,
          participants: participantHashes.map((h, i) => ({ hash: h, info: participantInfos[i] })),
          lastMessage: lastMsg[0] ? { ...lastMsg[0], content: lastMsg[0].messageType === 'system' ? lastMsg[0].content : decryptMessage(lastMsg[0].content, c.id) } : null,
          unreadCount: unread[0]?.count ?? 0,
          lastMessageAt: c.lastMessageAt,
        };
      }
    }));

    return res.json({ conversations: result });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/conversations", requireSession, async (req, res) => {
  const me = req.userHash as string;
  const { otherHash, type: reqType, name: reqName } = req.body;

  /* ── Создание группы или канала-эфира напрямую ── */
  if (reqType === 'group' || reqType === 'broadcast') {
    const convName = (typeof reqName === 'string' && reqName.trim()) ? reqName.trim() : (reqType === 'broadcast' ? 'Канал' : 'Беседа');
    try {
      const [created] = await db.insert(conversationsTable)
        .values({ participant1: me, participant2: me, type: reqType, name: convName }).returning();
      await db.insert(conversationParticipantsTable)
        .values({ conversationId: created.id, userHash: me }).onConflictDoNothing();
      await db.insert(messagesTable).values({
        conversationId: created.id, senderHash: '__system__',
        content: reqType === 'broadcast' ? `Канал "${convName}" создан` : `Беседа "${convName}" создана`,
        messageType: 'system',
      });
      await db.update(conversationsTable).set({ lastMessageAt: new Date() }).where(eq(conversationsTable.id, created.id));
      return res.json({ conversation: { ...created, type: reqType } });
    } catch (e) {
      return res.status(500).json({ error: "Server error" });
    }
  }

  /* ── Секретный чат ── */
  if (reqType === 'secret') {
    if (!otherHash || otherHash === me) return res.status(400).json({ error: "Bad request" });
    const p1 = [me, otherHash].sort()[0];
    const p2 = [me, otherHash].sort()[1];
    try {
      const existing = await db.select().from(conversationsTable)
        .where(and(eq(conversationsTable.participant1, p1), eq(conversationsTable.participant2, p2), eq(conversationsTable.type, 'secret'))).limit(1);
      if (existing.length > 0) return res.json({ conversation: existing[0] });
      const [created] = await db.insert(conversationsTable)
        .values({ participant1: p1, participant2: p2, type: 'secret', isSecret: true }).returning();
      return res.json({ conversation: created });
    } catch (e) {
      return res.status(500).json({ error: "Server error" });
    }
  }

  /* ── Личный (DM) чат ── */
  if (!otherHash || otherHash === me) return res.status(400).json({ error: "Bad request" });

  const p1 = [me, otherHash].sort()[0];
  const p2 = [me, otherHash].sort()[1];

  try {
    const existing = await db.select().from(conversationsTable)
      .where(and(eq(conversationsTable.participant1, p1), eq(conversationsTable.participant2, p2), eq(conversationsTable.type, 'dm'))).limit(1);
    if (existing.length > 0) return res.json({ conversation: existing[0] });

    const [created] = await db.insert(conversationsTable)
      .values({ participant1: p1, participant2: p2, type: 'dm' }).returning();
    return res.json({ conversation: created });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/conversations/:id/participants", requireSession, async (req, res) => {
  const me = req.userHash as string;
  const convId = parseInt(req.params['id'] as string);
  const { addHash } = req.body;
  if (!addHash) return res.status(400).json({ error: "addHash required" });

  try {
    const conv = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId)).limit(1);
    if (!conv.length) return res.status(404).json({ error: "Conversation not found" });
    const c = conv[0];

    const hasAccess = await canAccess(convId, me);
    if (!hasAccess) return res.status(403).json({ error: "Access denied" });

    const alreadyIn = await canAccess(convId, addHash);
    if (alreadyIn) return res.json({ success: true, message: 'already_member' });

    if (c.type === 'dm') {
      const existingParticipants = [c.participant1, c.participant2];
      const autoName = await buildGroupName([...existingParticipants, addHash]);

      await db.update(conversationsTable)
        .set({ type: 'group', name: autoName })
        .where(eq(conversationsTable.id, convId));

      for (const h of existingParticipants) {
        await db.insert(conversationParticipantsTable)
          .values({ conversationId: convId, userHash: h })
          .onConflictDoNothing();
      }
    }

    await db.insert(conversationParticipantsTable)
      .values({ conversationId: convId, userHash: addHash })
      .onConflictDoNothing();

    const updatedConv = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId)).limit(1);
    const participantRows = await db.select().from(conversationParticipantsTable)
      .where(eq(conversationParticipantsTable.conversationId, convId));
    const participantInfos = await Promise.all(participantRows.map(p => getAuthorInfo(p.userHash)));

    const addedInfo = await getAuthorInfo(addHash);
    await db.insert(messagesTable).values({
      conversationId: convId,
      senderHash: '__system__',
      content: `${addedInfo.name} добавлен(а) в беседу`,
      messageType: 'system',
    });
    await db.update(conversationsTable).set({ lastMessageAt: new Date() }).where(eq(conversationsTable.id, convId));

    return res.json({
      success: true,
      conversation: {
        ...updatedConv[0],
        participants: participantRows.map((r, i) => ({ hash: r.userHash, info: participantInfos[i] })),
      },
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

async function buildGroupName(hashes: string[]): Promise<string> {
  const infos = await Promise.all(hashes.slice(0, 3).map(h => getAuthorInfo(h)));
  const names = infos.map(i => i.name.split(' ')[0]).join(', ');
  return `Беседа: ${names}${hashes.length > 3 ? ' и ещё...' : ''}`;
}

router.patch("/conversations/:id", requireSession, async (req, res) => {
  const me = req.userHash as string;
  const convId = parseInt(req.params['id'] as string);
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "Name required" });

  try {
    const hasAccess = await canAccess(convId, me);
    if (!hasAccess) return res.status(403).json({ error: "Access denied" });

    const [updated] = await db.update(conversationsTable)
      .set({ name: name.trim() })
      .where(eq(conversationsTable.id, convId))
      .returning();
    return res.json({ conversation: updated });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/conversations/:id/participants", requireSession, async (req, res) => {
  const me = req.userHash as string;
  const convId = parseInt(req.params['id'] as string);

  try {
    const hasAccess = await canAccess(convId, me);
    if (!hasAccess) return res.status(403).json({ error: "Access denied" });

    await db.delete(conversationParticipantsTable)
      .where(and(
        eq(conversationParticipantsTable.conversationId, convId),
        eq(conversationParticipantsTable.userHash, me)
      ));

    const info = await getAuthorInfo(me);
    await db.insert(messagesTable).values({
      conversationId: convId,
      senderHash: '__system__',
      content: `${info.name} покинул(а) беседу`,
      messageType: 'system',
    });
    await db.update(conversationsTable).set({ lastMessageAt: new Date() }).where(eq(conversationsTable.id, convId));

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

/* ─────────────────────────── MESSAGES ─────────────────────────── */

/* ── SSE — мгновенные обновления чата ── */
router.get("/conversations/:id/sse", async (req, res): Promise<void> => {
  const convId = parseInt(req.params['id'] as string);
  const token = (req.query['token'] as string) || '';
  if (!token) { res.status(401).json({ error: 'Auth required' }); return; }

  const me = await resolveSession(token);
  if (!me) { res.status(401).json({ error: 'Invalid token' }); return; }

  const hasAccess = await canAccess(convId, me);
  if (!hasAccess) { res.status(403).json({ error: 'Access denied' }); return; }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(`data: {"type":"connected","convId":${convId}}\n\n`);

  if (!sseClients.has(convId)) sseClients.set(convId, new Set());
  sseClients.get(convId)!.add(res as unknown as ExpressRes);

  const pingTimer = setInterval(() => {
    try { res.write('data: {"type":"ping"}\n\n'); } catch { clearInterval(pingTimer); }
  }, 20_000);

  req.on('close', () => {
    clearInterval(pingTimer);
    sseClients.get(convId)?.delete(res as unknown as ExpressRes);
    if ((sseClients.get(convId)?.size ?? 0) === 0) sseClients.delete(convId);
  });
});

router.get("/conversations/:id/messages", requireSession, async (req, res) => {
  const me = req.userHash as string;
  const convId = parseInt(req.params['id'] as string);
  const limit = parseInt(req.query.limit as string) || 50;
  const before = req.query.before ? parseInt(req.query.before as string) : undefined;

  try {
    const hasAccess = await canAccess(convId, me);
    if (!hasAccess) return res.status(403).json({ error: "Access denied" });

    /* Удаляем сгоревшие сообщения */
    await db.delete(messagesTable).where(
      and(eq(messagesTable.conversationId, convId), sql`${messagesTable.burnAt} IS NOT NULL AND ${messagesTable.burnAt} < NOW()`)
    );

    const conv = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId)).limit(1);
    const isSecret = conv[0]?.type === 'secret';

    const msgs = await db.select().from(messagesTable)
      .where(and(
        eq(messagesTable.conversationId, convId),
        before ? sql`${messagesTable.id} < ${before}` : sql`1=1`
      ))
      .orderBy(desc(messagesTable.createdAt)).limit(limit);

    await db.update(messagesTable)
      .set({ isRead: true })
      .where(and(
        eq(messagesTable.conversationId, convId),
        eq(messagesTable.isRead, false),
        sql`${messagesTable.senderHash} != ${me}`
      ));

    const reversed = msgs.reverse();
    const msgIds = reversed.map(m => m.id);

    /* Загружаем реакции для всех сообщений батчем */
    const allReactions = msgIds.length
      ? await db.select().from(messageReactionsTable).where(inArray(messageReactionsTable.messageId, msgIds))
      : [];
    const reactionsMap: Record<number, Record<string, string[]>> = {};
    for (const r of allReactions) {
      if (!reactionsMap[r.messageId]) reactionsMap[r.messageId] = {};
      if (!reactionsMap[r.messageId][r.emoji]) reactionsMap[r.messageId][r.emoji] = [];
      reactionsMap[r.messageId][r.emoji].push(r.userHash);
    }

    /* Загружаем replyTo для сообщений с replyToId */
    const replyIds = [...new Set(reversed.filter(m => m.replyToId).map(m => m.replyToId!))];
    const replyMsgs = replyIds.length
      ? await db.select().from(messagesTable).where(inArray(messagesTable.id, replyIds))
      : [];
    const replyMap: Record<number, typeof replyMsgs[0]> = {};
    for (const r of replyMsgs) replyMap[r.id] = r;
    const replyAuthors: Record<string, { name: string; avatar: string; handle: string }> = {};
    for (const r of replyMsgs) {
      if (!replyAuthors[r.senderHash]) replyAuthors[r.senderHash] = await getAuthorInfo(r.senderHash);
    }

    const withInfo = await Promise.all(reversed.map(async m => {
      const info = m.senderHash === '__system__' ? { name: 'Система', avatar: '', handle: '' } : await getAuthorInfo(m.senderHash);
      /* Для секретных чатов контент НЕ расшифровываем — только клиент может */
      const content = m.deletedForAll
        ? '__deleted__'
        : m.messageType === 'system'
          ? m.content
          : isSecret
            ? m.content
            : decryptMessage(m.content, convId);

      const replyTo = m.replyToId && replyMap[m.replyToId] ? {
        id: replyMap[m.replyToId].id,
        content: replyMap[m.replyToId].deletedForAll ? '__deleted__' : (isSecret ? replyMap[m.replyToId].content : decryptMessage(replyMap[m.replyToId].content, convId)),
        messageType: replyMap[m.replyToId].messageType,
        author: replyAuthors[replyMap[m.replyToId].senderHash] ?? { name: 'Пользователь', avatar: '', handle: '' },
        senderHash: replyMap[m.replyToId].senderHash,
      } : null;

      return {
        ...m,
        content,
        author: info,
        reactions: reactionsMap[m.id] ?? {},
        replyTo,
      };
    }));

    return res.json({ messages: withInfo, isSecret, burnTimer: conv[0]?.burnTimer ?? 0 });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.post("/conversations/:id/messages", requireSession, contentFilter("message", ["content"]), async (req, res) => {
  const me = req.userHash as string;
  const convId = parseInt(req.params['id'] as string);
  const { content = '', messageType = 'text', mediaUrl, mediaName, duration, replyToId, burnInMs } = req.body;

  if (!msgRateLimit(me)) return res.status(429).json({ error: "Слишком много сообщений. Подождите минуту." });
  if (typeof content === 'string' && content.length > MAX_MSG_LENGTH) return res.status(400).json({ error: "Сообщение слишком длинное" });

  try {
    const hasAccess = await canAccess(convId, me);
    if (!hasAccess) return res.status(403).json({ error: "Access denied" });

    const conv = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId)).limit(1);
    const isSecret = conv[0]?.type === 'secret';
    const burnTimer = conv[0]?.burnTimer ?? 0;

    /* Для секретных чатов: клиент сам зашифровал контент, сервер хранит blob as-is */
    const storedContent = messageType === 'system'
      ? content
      : isSecret
        ? content  // уже зашифровано клиентом (e2e: prefix)
        : encryptMessage(content, convId);

    /* Вычисляем время сгорания */
    const burnMs = typeof burnInMs === 'number' && burnInMs > 0 ? burnInMs : burnTimer > 0 ? burnTimer * 1000 : 0;
    const burnAt = burnMs > 0 ? new Date(Date.now() + burnMs) : null;

    const [msg] = await db.insert(messagesTable).values({
      conversationId: convId,
      senderHash: me,
      content: storedContent,
      messageType,
      mediaUrl: mediaUrl ?? null,
      mediaName: mediaName ?? null,
      duration: duration ?? null,
      burnAt,
      replyToId: replyToId ?? null,
    }).returning();

    await db.update(conversationsTable)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversationsTable.id, convId));

    const author = await getAuthorInfo(me);
    /* Для секретных чатов возвращаем контент как есть (клиент расшифрует), для обычных — расшифровываем */
    const returnContent = msg.messageType === 'system'
      ? msg.content
      : isSecret
        ? msg.content
        : decryptMessage(msg.content, convId);

    /* ── SSE: мгновенно уведомляем всех участников открытого чата ── */
    notifyConvClients(convId, { type: 'new_message', message: { ...msg, content: returnContent, author } });

    /* ── Push-уведомления получателям ── */
    try {
      const recipients = (await getParticipantHashes(conv[0] as { id: number; type: string; participant1: string; participant2: string }))
        .filter(h => h !== me && h !== '__system__');
      if (recipients.length) {
        const pushBody = isSecret
          ? '🔒 Зашифрованное сообщение'
          : messageType === 'audio'
            ? '🎵 Голосовое сообщение'
            : messageType === 'image'
              ? '🖼 Фото'
              : messageType === 'video'
                ? '🎬 Видео'
                : messageType === 'document'
                  ? '📎 Документ'
                  : (typeof returnContent === 'string' && returnContent.length > 80)
                    ? returnContent.slice(0, 80) + '…'
                    : (returnContent as string);
        sendPushToUsers(recipients, {
          title: author.name || 'SWAIP',
          body: pushBody,
          tag: `msg-conv-${convId}`,
          url: `/messages/${convId}`,
          icon: author.avatar || '/swaip-logo.png',
        }).catch(() => {});
      }
    } catch { /* push не блокирует ответ */ }

    return res.json({ ...msg, content: returnContent, author });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

/* ── Обмен публичными ключами для E2E ── */
router.patch("/conversations/:id/public-key", requireSession, async (req, res) => {
  const me = req.userHash as string;
  const convId = parseInt(req.params['id'] as string);
  const { publicKey } = req.body;
  if (!publicKey) return res.status(400).json({ error: "publicKey required" });

  try {
    const conv = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId)).limit(1);
    if (!conv.length || conv[0].type !== 'secret') return res.status(403).json({ error: "Not a secret chat" });
    const c = conv[0];
    if (c.participant1 !== me && c.participant2 !== me) return res.status(403).json({ error: "Access denied" });

    const isP1 = c.participant1 === me;
    await db.update(conversationsTable)
      .set(isP1 ? { pubKey1: publicKey } : { pubKey2: publicKey })
      .where(eq(conversationsTable.id, convId));

    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/conversations/:id/peer-key", requireSession, async (req, res) => {
  const me = req.userHash as string;
  const convId = parseInt(req.params['id'] as string);

  try {
    const conv = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId)).limit(1);
    if (!conv.length) return res.status(404).json({ error: "Not found" });
    const c = conv[0];
    if (c.participant1 !== me && c.participant2 !== me) return res.status(403).json({ error: "Access denied" });

    const myKey = c.participant1 === me ? c.pubKey1 : c.pubKey2;
    const peerKey = c.participant1 === me ? c.pubKey2 : c.pubKey1;

    return res.json({ myKey, peerKey, burnTimer: c.burnTimer ?? 0 });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

/* ── Таймер сгорания ── */
router.patch("/conversations/:id/burn-timer", requireSession, async (req, res) => {
  const me = req.userHash as string;
  const convId = parseInt(req.params['id'] as string);
  const { burnTimer } = req.body;
  if (typeof burnTimer !== 'number') return res.status(400).json({ error: "burnTimer required" });

  try {
    const hasAccess = await canAccess(convId, me);
    if (!hasAccess) return res.status(403).json({ error: "Access denied" });
    await db.update(conversationsTable).set({ burnTimer }).where(eq(conversationsTable.id, convId));
    return res.json({ success: true, burnTimer });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.delete("/conversations/:convId/messages/:msgId", requireSession, async (req, res) => {
  const me = req.userHash as string;
  const msgId = parseInt(req.params['msgId'] as string);
  const { deleteForAll } = req.body ?? {};
  try {
    const msg = await db.select().from(messagesTable).where(eq(messagesTable.id, msgId)).limit(1);
    if (!msg.length) return res.status(404).json({ error: "Not found" });
    if (msg[0].senderHash !== me) return res.status(403).json({ error: "Forbidden" });
    if (deleteForAll) {
      /* Помечаем сообщение как удалённое для всех (tombstone) */
      await db.update(messagesTable)
        .set({ deletedForAll: true, content: '', mediaUrl: null, mediaName: null })
        .where(eq(messagesTable.id, msgId));
    } else {
      await db.delete(messagesTable).where(eq(messagesTable.id, msgId));
    }
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

/* ── Редактировать сообщение ── */
router.patch("/conversations/:convId/messages/:msgId", requireSession, contentFilter("message", ["content"]), async (req, res) => {
  const me = req.userHash as string;
  const convId = parseInt(req.params['convId'] as string);
  const msgId = parseInt(req.params['msgId'] as string);
  const { content } = req.body;
  if (!content || typeof content !== 'string' || !content.trim()) return res.status(400).json({ error: "content required" });
  if (content.length > MAX_MSG_LENGTH) return res.status(400).json({ error: "Сообщение слишком длинное" });

  try {
    const msg = await db.select().from(messagesTable).where(eq(messagesTable.id, msgId)).limit(1);
    if (!msg.length) return res.status(404).json({ error: "Not found" });
    if (msg[0].senderHash !== me) return res.status(403).json({ error: "Только автор может редактировать" });
    if (msg[0].deletedForAll) return res.status(400).json({ error: "Нельзя редактировать удалённое сообщение" });
    if (msg[0].messageType !== 'text') return res.status(400).json({ error: "Только текстовые сообщения" });

    const hasAccess = await canAccess(convId, me);
    if (!hasAccess) return res.status(403).json({ error: "Access denied" });

    const conv = await db.select().from(conversationsTable).where(eq(conversationsTable.id, convId)).limit(1);
    const isSecret = conv[0]?.type === 'secret';
    const storedContent = isSecret ? content : encryptMessage(content.trim(), convId);

    const [updated] = await db.update(messagesTable)
      .set({ content: storedContent, editedAt: new Date() })
      .where(eq(messagesTable.id, msgId))
      .returning();

    const returnContent = isSecret ? updated.content : decryptMessage(updated.content, convId);
    return res.json({ ...updated, content: returnContent });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

/* ── Реакция на сообщение (toggle) ── */
router.post("/conversations/:convId/messages/:msgId/reactions", requireSession, async (req, res) => {
  const me = req.userHash as string;
  const convId = parseInt(req.params['convId'] as string);
  const msgId = parseInt(req.params['msgId'] as string);
  const { emoji } = req.body;
  if (!emoji || typeof emoji !== 'string') return res.status(400).json({ error: "emoji required" });

  try {
    const hasAccess = await canAccess(convId, me);
    if (!hasAccess) return res.status(403).json({ error: "Access denied" });

    /* Toggle: если уже есть такая реакция — убираем, нет — добавляем */
    const existing = await db.select().from(messageReactionsTable)
      .where(and(eq(messageReactionsTable.messageId, msgId), eq(messageReactionsTable.userHash, me)))
      .limit(1);

    if (existing.length && existing[0].emoji === emoji) {
      await db.delete(messageReactionsTable)
        .where(and(eq(messageReactionsTable.messageId, msgId), eq(messageReactionsTable.userHash, me)));
    } else if (existing.length) {
      await db.update(messageReactionsTable)
        .set({ emoji })
        .where(and(eq(messageReactionsTable.messageId, msgId), eq(messageReactionsTable.userHash, me)));
    } else {
      await db.insert(messageReactionsTable).values({ messageId: msgId, userHash: me, emoji });
    }

    /* Возвращаем обновлённые реакции для этого сообщения */
    const reactions = await db.select().from(messageReactionsTable).where(eq(messageReactionsTable.messageId, msgId));
    const grouped: Record<string, string[]> = {};
    for (const r of reactions) {
      if (!grouped[r.emoji]) grouped[r.emoji] = [];
      grouped[r.emoji].push(r.userHash);
    }
    return res.json({ reactions: grouped });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

router.get("/contacts", requireSession, async (req, res) => {
  const me = req.userHash as string;
  try {
    const [following, followers] = await Promise.all([
      db.select({ hash: followsTable.followingHash }).from(followsTable).where(eq(followsTable.followerHash, me)),
      db.select({ hash: followsTable.followerHash }).from(followsTable).where(eq(followsTable.followingHash, me)),
    ]);
    const hashes = [...new Set([...following.map(f => f.hash), ...followers.map(f => f.hash)])];
    const infos = await Promise.all(hashes.map(h => getAuthorInfo(h)));
    return res.json({ contacts: hashes.map((h, i) => ({ hash: h, info: infos[i] })) });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

/* ── Список связей Круга: friends / followers / following ── */
router.get("/circle-connections", requireSession, async (req, res) => {
  const me = req.userHash as string;
  try {
    const [followingRows, followerRows] = await Promise.all([
      db.select({ hash: followsTable.followingHash }).from(followsTable).where(eq(followsTable.followerHash, me)),
      db.select({ hash: followsTable.followerHash }).from(followsTable).where(eq(followsTable.followingHash, me)),
    ]);
    const followingSet = new Set(followingRows.map(f => f.hash));
    const followerSet  = new Set(followerRows.map(f => f.hash));

    const friendHashes    = [...followingSet].filter(h => followerSet.has(h));
    const followingOnly   = [...followingSet].filter(h => !followerSet.has(h));
    const followersOnly   = [...followerSet].filter(h => !followingSet.has(h));

    const allHashes = [...friendHashes, ...followingOnly, ...followersOnly];
    const infos = await Promise.all(allHashes.map(h => getAuthorInfo(h)));
    const infoMap = Object.fromEntries(allHashes.map((h, i) => [h, infos[i]]));

    return res.json({
      friends:    friendHashes.map(h => ({ hash: h, info: infoMap[h] })),
      following:  followingOnly.map(h => ({ hash: h, info: infoMap[h] })),
      followers:  followersOnly.map(h => ({ hash: h, info: infoMap[h] })),
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
