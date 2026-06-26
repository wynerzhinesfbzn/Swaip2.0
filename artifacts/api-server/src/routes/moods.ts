import { Router, type IRouter } from "express";
import { getSessionToken, resolveSession } from "../lib/sessionAuth.js";
import { db, accountsTable, followsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

interface MoodEntry {
  userHash: string; userName: string; userAvatar: string;
  emoji: string; text: string; setAt: number;
}

/* One mood per user, resets after 24h */
const moods = new Map<string, MoodEntry>();

/* Cleanup stale moods every hour */
setInterval(() => {
  const cutoff = Date.now() - 24 * 3600_000;
  for (const [hash, m] of moods) { if (m.setAt < cutoff) moods.delete(hash); }
}, 3600_000);

async function resolveUser(hash: string) {
  try {
    const rows = await db.select({ data: accountsTable.data })
      .from(accountsTable).where(eq(accountsTable.hash, hash)).limit(1);
    if (rows[0]) {
      const d = (rows[0].data as any) || {};
      return { name: d.pro_name || d.krug_name || d.scene_artistName || 'Пользователь', avatar: d.pro_avatarUrl || d.krug_avatarUrl || d.scene_avatarUrl || '' };
    }
  } catch { /* */ }
  return { name: 'Пользователь', avatar: '' };
}

/* POST /api/moods — set or update my mood */
router.post('/moods', async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: 'Unauthorized' });

  const { emoji, text } = req.body as any;
  if (!emoji) return res.status(400).json({ error: 'emoji required' });

  const { name, avatar } = await resolveUser(userHash);
  const entry: MoodEntry = {
    userHash, userName: name, userAvatar: avatar,
    emoji: String(emoji).slice(0, 8),
    text: String(text || '').trim().slice(0, 100),
    setAt: Date.now(),
  };
  moods.set(userHash, entry);
  return res.json({ success: true, mood: entry });
});

/* DELETE /api/moods — clear my mood */
router.delete('/moods', async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: 'Unauthorized' });
  moods.delete(userHash);
  return res.json({ success: true });
});

/* GET /api/moods/my */
router.get('/moods/my', async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: 'Unauthorized' });
  const mood = moods.get(userHash) || null;
  return res.json({ mood });
});

/* GET /api/moods/friends — moods of people I follow */
router.get('/moods/friends', async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const follows = await db.select({ followingHash: followsTable.followingHash })
      .from(followsTable).where(eq(followsTable.followerHash, userHash));
    const followingHashes = follows.map(f => f.followingHash);

    const cutoff = Date.now() - 24 * 3600_000;
    const result = [...moods.values()]
      .filter(m => followingHashes.includes(m.userHash) && m.setAt > cutoff)
      .sort((a, b) => b.setAt - a.setAt);

    return res.json({ moods: result });
  } catch (e) {
    logger.warn({ err: e }, "moods/friends error");
    return res.json({ moods: [] });
  }
});

/* GET /api/moods/all — all active moods (public feed) */
router.get('/moods/all', (_req, res) => {
  const cutoff = Date.now() - 24 * 3600_000;
  const result = [...moods.values()]
    .filter(m => m.setAt > cutoff)
    .sort((a, b) => b.setAt - a.setAt)
    .slice(0, 50);
  return res.json({ moods: result });
});

export default router;
