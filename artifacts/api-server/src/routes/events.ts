import { Router, type IRouter } from "express";
import { getSessionToken, resolveSession } from "../lib/sessionAuth.js";
import { db, accountsTable, eventsTable, eventAttendeesTable } from "@workspace/db";
import { eq, and, desc, gte } from "drizzle-orm";

const router: IRouter = Router();

function genId() { return Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(); }

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
  } catch { /* ignore */ }
  return { name: 'Пользователь', avatar: '' };
}

async function getAttendees(eventId: string) {
  const rows = await db.select({
    userHash: eventAttendeesTable.userHash,
    data: accountsTable.data,
  }).from(eventAttendeesTable)
    .leftJoin(accountsTable, eq(eventAttendeesTable.userHash, accountsTable.hash))
    .where(eq(eventAttendeesTable.eventId, eventId));
  return rows.map(r => {
    const d = (r.data as any) || {};
    return {
      hash: r.userHash,
      name: d.pro_name || d.krug_name || d.scene_artistName || 'Пользователь',
      avatar: d.pro_avatarUrl || d.krug_avatarUrl || d.scene_avatarUrl || '',
    };
  });
}

/* POST /api/events */
router.post("/events", async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: "Unauthorized" });

  const { name: hostName, avatar: hostAvatar } = await resolveUser(userHash);
  const { title, description, date, location, maxAttendees, imageUrl } = req.body as any;

  if (!title?.trim() || !date) return res.status(400).json({ error: "title and date required" });

  const id = genId();
  await db.insert(eventsTable).values({
    id,
    hostHash: userHash,
    title: String(title).trim().slice(0, 120),
    description: String(description || '').trim().slice(0, 1000),
    date: String(date),
    location: String(location || '').trim().slice(0, 200),
    maxAttendees: Math.max(2, Math.min(10000, Number(maxAttendees) || 100)),
    imageUrl: typeof imageUrl === 'string' ? imageUrl : null,
  });

  /* Host auto-attends */
  await db.insert(eventAttendeesTable).values({ eventId: id, userHash });

  const attendees = await getAttendees(id);
  const ev = (await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1))[0];
  return res.json({
    success: true,
    event: { ...ev, hostName, hostAvatar, attendees, attendeeCount: attendees.length },
  });
});

/* GET /api/events */
router.get("/events", async (_req, res) => {
  const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const rows = await db.select().from(eventsTable)
    .where(gte(eventsTable.date, cutoff))
    .orderBy(eventsTable.date);

  const result = await Promise.all(rows.map(async ev => {
    const host = await resolveUser(ev.hostHash);
    const attendees = await getAttendees(ev.id);
    return { ...ev, hostName: host.name, hostAvatar: host.avatar, attendees, attendeeCount: attendees.length };
  }));

  return res.json({ events: result });
});

/* GET /api/events/:id */
router.get("/events/:id", async (req, res) => {
  const rows = await db.select().from(eventsTable).where(eq(eventsTable.id, req.params.id)).limit(1);
  if (!rows.length) return res.status(404).json({ error: "Event not found" });
  const ev = rows[0];
  const host = await resolveUser(ev.hostHash);
  const attendees = await getAttendees(ev.id);
  return res.json({ event: { ...ev, hostName: host.name, hostAvatar: host.avatar, attendees, attendeeCount: attendees.length } });
});

/* POST /api/events/:id/attend */
router.post("/events/:id/attend", async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: "Unauthorized" });

  const rows = await db.select().from(eventsTable).where(eq(eventsTable.id, req.params.id)).limit(1);
  if (!rows.length) return res.status(404).json({ error: "Event not found" });
  const ev = rows[0];

  const attendees = await getAttendees(ev.id);
  if (attendees.find(a => a.hash === userHash)) return res.json({ success: true, attending: true, attendeeCount: attendees.length });
  if (ev.maxAttendees && attendees.length >= ev.maxAttendees) return res.status(400).json({ error: "Event is full" });

  await db.insert(eventAttendeesTable).values({ eventId: ev.id, userHash }).onConflictDoNothing();
  const updated = await getAttendees(ev.id);
  return res.json({ success: true, attending: true, attendeeCount: updated.length });
});

/* DELETE /api/events/:id/attend */
router.delete("/events/:id/attend", async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: "Unauthorized" });

  await db.delete(eventAttendeesTable)
    .where(and(eq(eventAttendeesTable.eventId, req.params.id), eq(eventAttendeesTable.userHash, userHash)));

  const attendees = await getAttendees(req.params.id);
  return res.json({ success: true, attending: false, attendeeCount: attendees.length });
});

/* DELETE /api/events/:id */
router.delete("/events/:id", async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: "Unauthorized" });

  const rows = await db.select().from(eventsTable).where(eq(eventsTable.id, req.params.id)).limit(1);
  if (!rows.length) return res.status(404).json({ error: "Event not found" });
  if (rows[0].hostHash !== userHash) return res.status(403).json({ error: "Forbidden" });

  await db.delete(eventAttendeesTable).where(eq(eventAttendeesTable.eventId, req.params.id));
  await db.delete(eventsTable).where(eq(eventsTable.id, req.params.id));
  return res.json({ success: true });
});

export default router;
