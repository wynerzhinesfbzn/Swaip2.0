import { Router, type IRouter } from "express";
import { getSessionToken, resolveSession } from "../lib/sessionAuth.js";
import { db, accountsTable, capsulesTable } from "@workspace/db";
import { eq, and, lte, or } from "drizzle-orm";

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

function viewCapsule(c: any, authorName: string, authorAvatar: string, userHash: string) {
  const revealTs = c.revealAt instanceof Date ? c.revealAt.getTime() : Number(c.revealAt);
  const createdTs = c.createdAt instanceof Date ? c.createdAt.getTime() : Number(c.createdAt);
  const ready = Date.now() >= revealTs;
  const canRead = c.authorHash === userHash || c.recipientHash === userHash;
  return {
    id: c.id,
    authorHash: c.authorHash,
    authorName,
    authorAvatar,
    revealAt: revealTs,
    createdAt: createdTs,
    revealed: ready,
    recipientHash: c.recipientHash || null,
    content: (ready && canRead) ? c.content : null,
    imageUrl: (ready && canRead) ? (c.imageUrl || null) : null,
    preview: ready ? null : `🔒 Откроется ${new Date(revealTs).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}`,
  };
}

/* POST /api/capsules */
router.post('/capsules', async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: 'Unauthorized' });

  const { content, revealAt, imageUrl, recipientHash } = req.body as any;
  if (!content?.trim() || !revealAt) return res.status(400).json({ error: 'content and revealAt required' });

  const revealDate = new Date(revealAt);
  if (isNaN(revealDate.getTime()) || revealDate.getTime() <= Date.now()) {
    return res.status(400).json({ error: 'revealAt must be in the future' });
  }

  const { name, avatar } = await resolveUser(userHash);
  const id = genId();

  await db.insert(capsulesTable).values({
    id,
    authorHash: userHash,
    content: String(content).trim().slice(0, 5000),
    imageUrl: typeof imageUrl === 'string' ? imageUrl : null,
    revealAt: revealDate,
    recipientHash: typeof recipientHash === 'string' ? recipientHash : null,
  });

  const row = (await db.select().from(capsulesTable).where(eq(capsulesTable.id, id)).limit(1))[0];
  return res.json({ success: true, capsule: viewCapsule(row, name, avatar, userHash) });
});

/* GET /api/capsules/my */
router.get('/capsules/my', async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: 'Unauthorized' });

  const rows = await db.select().from(capsulesTable).where(
    or(eq(capsulesTable.authorHash, userHash), eq(capsulesTable.recipientHash, userHash))
  );

  const result = await Promise.all(rows.map(async c => {
    const author = await resolveUser(c.authorHash);
    return viewCapsule(c, author.name, author.avatar, userHash);
  }));

  result.sort((a, b) => a.revealAt - b.revealAt);
  return res.json({ capsules: result });
});

/* GET /api/capsules/ready */
router.get('/capsules/ready', async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: 'Unauthorized' });

  const now = new Date();
  const rows = await db.select().from(capsulesTable).where(
    and(
      or(eq(capsulesTable.authorHash, userHash), eq(capsulesTable.recipientHash, userHash)),
      lte(capsulesTable.revealAt, now)
    )
  );

  const result = await Promise.all(rows.map(async c => {
    const author = await resolveUser(c.authorHash);
    return viewCapsule(c, author.name, author.avatar, userHash);
  }));

  result.sort((a, b) => b.revealAt - a.revealAt);
  return res.json({ capsules: result });
});

/* GET /api/capsules/:id */
router.get('/capsules/:id', async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: 'Unauthorized' });

  const rows = await db.select().from(capsulesTable).where(eq(capsulesTable.id, req.params.id)).limit(1);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  const c = rows[0];
  if (c.authorHash !== userHash && c.recipientHash !== userHash) return res.status(403).json({ error: 'Forbidden' });

  const author = await resolveUser(c.authorHash);
  return res.json({ capsule: viewCapsule(c, author.name, author.avatar, userHash) });
});

/* DELETE /api/capsules/:id */
router.delete('/capsules/:id', async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: 'Unauthorized' });

  const rows = await db.select().from(capsulesTable).where(eq(capsulesTable.id, req.params.id)).limit(1);
  if (!rows.length) return res.status(404).json({ error: 'Not found' });
  const c = rows[0];
  if (c.authorHash !== userHash) return res.status(403).json({ error: 'Forbidden' });

  const revealTs = c.revealAt instanceof Date ? c.revealAt.getTime() : Number(c.revealAt);
  if (Date.now() >= revealTs) return res.status(400).json({ error: 'Already revealed, cannot delete' });

  await db.delete(capsulesTable).where(eq(capsulesTable.id, req.params.id));
  return res.json({ success: true });
});

export default router;
