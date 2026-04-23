import { Router } from "express";
import { requireSession } from "../lib/sessionAuth.js";
import { db, broadcastsTable, accountsTable } from "@workspace/db";
import { isNotNull, eq, and, sql } from "drizzle-orm";

const router = Router();

/* ── In-memory battle sessions (ephemeral by design) ── */
interface BattleSwipe { direction: "up" | "down"; ts: number; }
interface BattleSession {
  id: string;
  challengerHash: string;
  opponentHash: string;
  status: "pending" | "active" | "completed" | "declined" | "expired";
  postId: number;
  postContent: string;
  postImage: string | null;
  challengerSwipe: BattleSwipe | null;
  opponentSwipe: BattleSwipe | null;
  winner: string | null; /* hash */
  createdAt: number;
  expiresAt: number;
}

const battles = new Map<string, BattleSession>();

function genId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/* Clean up expired sessions every 10 min */
setInterval(() => {
  const now = Date.now();
  for (const [id, b] of battles.entries()) {
    if (b.expiresAt < now) battles.delete(id);
  }
}, 10 * 60 * 1000);

/* Pick a random public post (no image required, just content) */
async function pickPost(): Promise<{ id: number; content: string; image: string | null } | null> {
  try {
    const rows = await db.select({ id: broadcastsTable.id, content: broadcastsTable.content, imageUrl: broadcastsTable.imageUrl })
      .from(broadcastsTable)
      .where(and(
        isNotNull(broadcastsTable.content),
        sql`length(${broadcastsTable.content}) > 20`
      ))
      .orderBy(sql`RANDOM()`)
      .limit(1);
    if (!rows.length) return null;
    const r = rows[0];
    return { id: r.id, content: r.content ?? '', image: r.imageUrl ?? null };
  } catch { return null; }
}

/* GET /api/battle/incoming — check for pending challenges for me */
router.get("/battle/incoming", requireSession, async (req, res) => {
  const me = (req as any).userHash as string;
  const pending = [...battles.values()].find(b =>
    b.opponentHash === me && b.status === "pending" && b.expiresAt > Date.now()
  );
  if (!pending) { res.json({ battle: null }); return; }

  /* Resolve challenger name */
  const acc = await db.select({ name: accountsTable.proName, avatar: accountsTable.proAvatar })
    .from(accountsTable).where(eq(accountsTable.hash, pending.challengerHash)).limit(1);
  const challenger = acc[0] ? { name: acc[0].name || 'Пользователь', avatar: acc[0].avatar || '' } : { name: 'Пользователь', avatar: '' };
  res.json({ battle: { ...pending, challenger } });
});

/* POST /api/battle/challenge — create challenge */
router.post("/battle/challenge", requireSession, async (req, res) => {
  const me = (req as any).userHash as string;
  const { opponentHash } = req.body;
  if (!opponentHash || typeof opponentHash !== 'string') {
    res.status(400).json({ error: "opponentHash required" }); return;
  }
  if (opponentHash === me) { res.status(400).json({ error: "Cannot battle yourself" }); return; }

  const post = await pickPost();
  if (!post) { res.status(503).json({ error: "No posts available" }); return; }

  const id = genId();
  const session: BattleSession = {
    id,
    challengerHash: me,
    opponentHash,
    status: "pending",
    postId: post.id,
    postContent: post.content,
    postImage: post.image,
    challengerSwipe: null,
    opponentSwipe: null,
    winner: null,
    createdAt: Date.now(),
    expiresAt: Date.now() + 5 * 60 * 1000, /* 5 min to accept */
  };
  battles.set(id, session);
  res.json({ battleId: id });
});

/* GET /api/battle/:id — poll battle state */
router.get("/battle/:id", requireSession, async (req, res) => {
  const me = (req as any).userHash as string;
  const b = battles.get(req.params.id);
  if (!b) { res.status(404).json({ error: "Battle not found" }); return; }
  if (b.challengerHash !== me && b.opponentHash !== me) {
    res.status(403).json({ error: "Not your battle" }); return;
  }
  if (b.status === "pending" && b.expiresAt < Date.now()) {
    b.status = "expired";
  }

  /* Resolve names */
  const hashes = [b.challengerHash, b.opponentHash];
  const accs = await db.select({ hash: accountsTable.hash, name: accountsTable.proName, avatar: accountsTable.proAvatar })
    .from(accountsTable).where(sql`${accountsTable.hash} = ANY(${hashes})`);
  const nameMap = Object.fromEntries(accs.map(a => [a.hash, { name: a.name || 'Пользователь', avatar: a.avatar || '' }]));

  res.json({
    ...b,
    challenger: nameMap[b.challengerHash] || { name: 'Пользователь', avatar: '' },
    opponent:   nameMap[b.opponentHash]   || { name: 'Пользователь', avatar: '' },
    myRole: me === b.challengerHash ? 'challenger' : 'opponent',
  });
});

/* POST /api/battle/:id/accept */
router.post("/battle/:id/accept", requireSession, async (req, res) => {
  const me = (req as any).userHash as string;
  const b = battles.get(req.params.id);
  if (!b || b.opponentHash !== me || b.status !== "pending") {
    res.status(400).json({ error: "Cannot accept" }); return;
  }
  b.status = "active";
  b.expiresAt = Date.now() + 30 * 1000; /* 30s to swipe once accepted */
  res.json({ ok: true });
});

/* POST /api/battle/:id/decline */
router.post("/battle/:id/decline", requireSession, async (req, res) => {
  const me = (req as any).userHash as string;
  const b = battles.get(req.params.id);
  if (!b || b.opponentHash !== me) { res.status(400).json({ error: "Cannot decline" }); return; }
  b.status = "declined";
  res.json({ ok: true });
});

/* POST /api/battle/:id/swipe */
router.post("/battle/:id/swipe", requireSession, async (req, res) => {
  const me = (req as any).userHash as string;
  const b = battles.get(req.params.id);
  if (!b || b.status !== "active") { res.status(400).json({ error: "Battle not active" }); return; }
  if (b.challengerHash !== me && b.opponentHash !== me) {
    res.status(403).json({ error: "Not your battle" }); return;
  }
  const { direction } = req.body;
  if (direction !== "up" && direction !== "down") {
    res.status(400).json({ error: "direction must be up or down" }); return;
  }
  const swipe: BattleSwipe = { direction, ts: Date.now() };
  const isChallenger = me === b.challengerHash;
  if (isChallenger) { if (b.challengerSwipe) { res.json({ already: true }); return; } b.challengerSwipe = swipe; }
  else              { if (b.opponentSwipe)   { res.json({ already: true }); return; } b.opponentSwipe = swipe; }

  /* Determine winner if both swiped */
  if (b.challengerSwipe && b.opponentSwipe) {
    /* Winner = faster swipe */
    b.winner = b.challengerSwipe.ts <= b.opponentSwipe.ts ? b.challengerHash : b.opponentHash;
    b.status = "completed";
    b.expiresAt = Date.now() + 60 * 1000; /* keep result for 60s */
  }
  res.json({ ok: true, status: b.status, winner: b.winner });
});

export default router;
