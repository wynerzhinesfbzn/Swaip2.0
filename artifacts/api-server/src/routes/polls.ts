import { Router, type IRouter } from "express";
import { getSessionToken, resolveSession } from "../lib/sessionAuth.js";
import { db, accountsTable, pollsTable, pollOptionsTable, pollVotesTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";

const router: IRouter = Router();

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

async function resolveUser(hash: string) {
  try {
    const rows = await db.select({ data: accountsTable.data })
      .from(accountsTable).where(eq(accountsTable.hash, hash)).limit(1);
    if (rows[0]) {
      const d = (rows[0].data as any) || {};
      const name = d.pro_name || d.krug_name || d.scene_artistName || 'Пользователь';
      const avatar = d.pro_avatarUrl || d.krug_avatarUrl || d.scene_avatarUrl || '';
      return { name, avatar };
    }
  } catch { /* */ }
  return { name: 'Пользователь', avatar: '' };
}

async function buildPollView(pollId: string, userHash?: string) {
  const pollRows = await db.select().from(pollsTable).where(eq(pollsTable.id, pollId)).limit(1);
  if (!pollRows.length) return null;
  const p = pollRows[0];

  const options = await db.select().from(pollOptionsTable)
    .where(eq(pollOptionsTable.pollId, pollId))
    .orderBy(pollOptionsTable.position);

  const votes = await db.select().from(pollVotesTable).where(eq(pollVotesTable.pollId, pollId));

  const myVotes = userHash ? votes.filter(v => v.userHash === userHash).map(v => v.optionId) : [];
  const total = votes.length;

  const author = await resolveUser(p.authorHash);
  const expiresTs = p.expiresAt instanceof Date ? p.expiresAt.getTime() : (p.expiresAt ? Number(p.expiresAt) : null);
  const createdTs = p.createdAt instanceof Date ? p.createdAt.getTime() : Number(p.createdAt);

  return {
    id: p.id,
    authorHash: p.authorHash,
    authorName: author.name,
    authorAvatar: author.avatar,
    question: p.question,
    allowMultiple: p.allowMultiple,
    expiresAt: expiresTs,
    createdAt: createdTs,
    contextType: p.contextType,
    contextId: p.contextId || null,
    expired: expiresTs ? Date.now() > expiresTs : false,
    total,
    myVotes,
    options: options.map(o => ({
      id: o.id,
      text: o.text,
      voteCount: votes.filter(v => v.optionId === o.id).length,
    })),
  };
}

/* POST /api/polls */
router.post('/polls', async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: 'Unauthorized' });

  const { question, options, allowMultiple, expiresInHours, contextType, contextId } = req.body as any;
  if (!question?.trim() || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: 'question and at least 2 options required' });
  }

  const id = genId();
  const expiresAt = expiresInHours ? new Date(Date.now() + Number(expiresInHours) * 3600_000) : null;

  await db.insert(pollsTable).values({
    id,
    authorHash: userHash,
    question: String(question).trim().slice(0, 300),
    allowMultiple: Boolean(allowMultiple),
    expiresAt,
    contextType: contextType === 'chat' ? 'chat' : 'feed',
    contextId: contextId ? String(contextId) : null,
  });

  const opts = options.slice(0, 10).map((t: string, i: number) => ({
    id: genId() + i,
    pollId: id,
    text: String(t).trim().slice(0, 120),
    position: i,
  }));
  await db.insert(pollOptionsTable).values(opts);

  const view = await buildPollView(id, userHash);
  return res.json({ success: true, poll: view });
});

/* GET /api/polls */
router.get('/polls', async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  const contextType = req.query.contextType as string | undefined;
  const contextId = req.query.contextId as string | undefined;

  let query = db.select().from(pollsTable).$dynamic();
  const conditions = [];
  if (contextType) conditions.push(eq(pollsTable.contextType, contextType));
  if (contextId) conditions.push(eq(pollsTable.contextId, contextId));
  if (conditions.length) query = query.where(and(...conditions));

  const rows = await query.orderBy(desc(pollsTable.createdAt));
  const views = await Promise.all(rows.map(p => buildPollView(p.id, userHash || undefined)));
  return res.json({ polls: views.filter(Boolean) });
});

/* GET /api/polls/:id */
router.get('/polls/:id', async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  const view = await buildPollView(req.params.id, userHash || undefined);
  if (!view) return res.status(404).json({ error: 'Not found' });
  return res.json({ poll: view });
});

/* POST /api/polls/:id/vote */
router.post('/polls/:id/vote', async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: 'Unauthorized' });

  const pollRows = await db.select().from(pollsTable).where(eq(pollsTable.id, req.params.id)).limit(1);
  if (!pollRows.length) return res.status(404).json({ error: 'Not found' });
  const p = pollRows[0];

  const expiresTs = p.expiresAt instanceof Date ? p.expiresAt.getTime() : (p.expiresAt ? Number(p.expiresAt) : null);
  if (expiresTs && Date.now() > expiresTs) return res.status(400).json({ error: 'Poll expired' });

  const options = await db.select().from(pollOptionsTable).where(eq(pollOptionsTable.pollId, p.id));
  const { optionIds } = req.body as any;
  const ids: string[] = Array.isArray(optionIds) ? optionIds : [String(optionIds)];
  const toVote = p.allowMultiple ? ids : [ids[0]];
  const validIds = toVote.filter(id => options.find(o => o.id === id));

  /* Remove previous votes */
  await db.delete(pollVotesTable).where(and(eq(pollVotesTable.pollId, p.id), eq(pollVotesTable.userHash, userHash)));

  /* Add new votes */
  if (validIds.length) {
    await db.insert(pollVotesTable).values(
      validIds.map(optionId => ({ pollId: p.id, optionId, userHash }))
    ).onConflictDoNothing();
  }

  const view = await buildPollView(p.id, userHash);
  return res.json({ success: true, poll: view });
});

/* DELETE /api/polls/:id */
router.delete('/polls/:id', async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: 'Unauthorized' });

  const rows = await db.select().from(pollsTable).where(eq(pollsTable.id, req.params.id)).limit(1);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  if (rows[0].authorHash !== userHash) return res.status(403).json({ error: 'Forbidden' });

  await db.delete(pollVotesTable).where(eq(pollVotesTable.pollId, req.params.id));
  await db.delete(pollOptionsTable).where(eq(pollOptionsTable.pollId, req.params.id));
  await db.delete(pollsTable).where(eq(pollsTable.id, req.params.id));
  return res.json({ success: true });
});

export default router;
