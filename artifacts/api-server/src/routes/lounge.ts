import { Router, RequestHandler } from "express";
import { db, accountsTable, loungeRoomsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireSession } from "../lib/sessionAuth.js";

const router = Router();

function genRoomId(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}
function genInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

async function getDisplayName(userHash: string): Promise<string> {
  try {
    const rows = await db.select({ data: accountsTable.data }).from(accountsTable)
      .where(eq(accountsTable.hash, userHash)).limit(1);
    if (rows.length) {
      const d = rows[0].data as Record<string, unknown>;
      return (d.pro_fullName || d.pro_displayName || d.scene_artistName || d.krug_displayName || 'Гость') as string;
    }
  } catch {}
  return 'Гость';
}

/* GET /api/lounge/rooms — list active rooms */
router.get('/lounge/rooms', async (_req, res): Promise<void> => {
  try {
    const rows = await db.select().from(loungeRoomsTable)
      .where(eq(loungeRoomsTable.isActive, true))
      .orderBy(desc(loungeRoomsTable.lastActivity))
      .limit(50);
    res.json({ rooms: rows });
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* POST /api/lounge/rooms — create room */
router.post('/lounge/rooms', requireSession as RequestHandler, async (req, res): Promise<void> => {
  const userHash: string = req.userHash;
  const { name, theme = 'cozy', maxPlayers = 20 } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'Название комнаты обязательно' });
    return;
  }

  const creatorName = await getDisplayName(userHash);
  let roomId = genRoomId();
  let inviteCode = genInviteCode();

  for (let i = 0; i < 5; i++) {
    const existing = await db.select({ roomId: loungeRoomsTable.roomId }).from(loungeRoomsTable)
      .where(eq(loungeRoomsTable.roomId, roomId)).limit(1);
    if (!existing.length) break;
    roomId = genRoomId();
  }
  for (let i = 0; i < 5; i++) {
    const existing = await db.select({ inviteCode: loungeRoomsTable.inviteCode }).from(loungeRoomsTable)
      .where(eq(loungeRoomsTable.inviteCode, inviteCode)).limit(1);
    if (!existing.length) break;
    inviteCode = genInviteCode();
  }

  await db.insert(loungeRoomsTable).values({
    roomId,
    name: name.trim().slice(0, 40),
    theme,
    creatorHash: userHash,
    creatorName,
    inviteCode,
    maxPlayers: Math.min(Math.max(Number(maxPlayers) || 20, 2), 20),
    isActive: true,
  });

  res.json({ roomId, inviteCode, name: name.trim(), theme });
});

/* GET /api/lounge/join/:code — get room info by invite code */
router.get('/lounge/join/:code', async (req, res): Promise<void> => {
  const { code } = req.params;
  try {
    const rows = await db.select().from(loungeRoomsTable)
      .where(and(eq(loungeRoomsTable.inviteCode, code.toUpperCase()), eq(loungeRoomsTable.isActive, true)))
      .limit(1);
    if (!rows.length) {
      res.status(404).json({ error: 'Комната не найдена' });
      return;
    }
    const r = rows[0];
    res.json({ roomId: r.roomId, name: r.name, theme: r.theme, inviteCode: r.inviteCode });
  } catch {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

/* DELETE /api/lounge/rooms/:roomId — delete room (creator only) */
router.delete('/lounge/rooms/:roomId', requireSession as RequestHandler, async (req, res): Promise<void> => {
  const userHash: string = req.userHash;
  const roomId = req.params.roomId as string;
  const rows = await db.select().from(loungeRoomsTable)
    .where(eq(loungeRoomsTable.roomId, roomId)).limit(1);
  if (!rows.length || rows[0].creatorHash !== userHash) {
    res.status(403).json({ error: 'Нет прав' });
    return;
  }
  await db.update(loungeRoomsTable).set({ isActive: false })
    .where(eq(loungeRoomsTable.roomId, roomId));
  res.json({ ok: true });
});

export default router;
