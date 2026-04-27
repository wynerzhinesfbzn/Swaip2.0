import { Router, type IRouter } from "express";
import { db, botsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireSession } from "../lib/sessionAuth.js";
import { randomBytes } from "crypto";

const router: IRouter = Router();

function genId(): string {
  return randomBytes(8).toString("hex");
}

/* ── GET /api/bots — боты текущего пользователя ─────────── */
router.get("/bots", requireSession, async (req, res) => {
  try {
    const { userHash } = req as any;
    const rows = await db
      .select()
      .from(botsTable)
      .where(eq(botsTable.ownerHash, userHash))
      .orderBy(desc(botsTable.createdAt));
    return res.json(rows);
  } catch { return res.status(500).json({ error: "Server error" }); }
});

/* ── GET /api/bots/public — публичные боты (каталог) ─────── */
router.get("/bots/public", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(botsTable)
      .where(eq(botsTable.isPublic, "true"))
      .orderBy(desc(botsTable.startCount))
      .limit(50);
    return res.json(rows);
  } catch { return res.status(500).json({ error: "Server error" }); }
});

/* ── GET /api/bots/:id — получить бота ───────────────────── */
router.get("/bots/:id", async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const [bot] = await db.select().from(botsTable).where(eq(botsTable.id, id));
    if (!bot) return res.status(404).json({ error: "Bot not found" });
    return res.json(bot);
  } catch { return res.status(500).json({ error: "Server error" }); }
});

/* ── POST /api/bots — создать бота ───────────────────────── */
router.post("/bots", requireSession, async (req, res) => {
  try {
    const { userHash } = req as any;
    const { name, description, avatarUrl, isPublic } = req.body || {};
    const id = genId();
    /* Стартовый экран по умолчанию */
    const defaultConfig = {
      startScreen: "start",
      screens: {
        start: {
          id: "start",
          name: "Старт",
          text: "Привет! Я бот. Выберите действие:",
          imageUrl: "",
          buttons: [
            { id: "btn1", label: "👋 Начать", nextScreen: "" }
          ],
          x: 80,
          y: 80,
        }
      }
    };
    const [bot] = await db.insert(botsTable).values({
      id,
      ownerHash: userHash,
      name: name || "Мой бот",
      description: description || "",
      avatarUrl: avatarUrl || "",
      config: defaultConfig,
      isPublic: isPublic ? "true" : "false",
    }).returning();
    return res.json(bot);
  } catch { return res.status(500).json({ error: "Server error" }); }
});

/* ── PUT /api/bots/:id — обновить бота ───────────────────── */
router.put("/bots/:id", requireSession, async (req, res) => {
  try {
    const { userHash } = req as any;
    const { id } = req.params as { id: string };
    const [existing] = await db.select().from(botsTable).where(eq(botsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Bot not found" });
    if (existing.ownerHash !== userHash) return res.status(403).json({ error: "Forbidden" });
    const { name, description, avatarUrl, config, isPublic } = req.body || {};
    const updates: Partial<typeof botsTable.$inferInsert> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
    if (config !== undefined) updates.config = config;
    if (isPublic !== undefined) updates.isPublic = isPublic ? "true" : "false";
    const [bot] = await db.update(botsTable).set(updates).where(eq(botsTable.id, id)).returning();
    return res.json(bot);
  } catch { return res.status(500).json({ error: "Server error" }); }
});

/* ── DELETE /api/bots/:id ─────────────────────────────────── */
router.delete("/bots/:id", requireSession, async (req, res) => {
  try {
    const { userHash } = req as any;
    const { id } = req.params as { id: string };
    const [existing] = await db.select().from(botsTable).where(eq(botsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Bot not found" });
    if (existing.ownerHash !== userHash) return res.status(403).json({ error: "Forbidden" });
    await db.delete(botsTable).where(eq(botsTable.id, id));
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: "Server error" }); }
});

/* ── POST /api/bots/:id/start — счётчик запусков ────────── */
router.post("/bots/:id/start", async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    await db.update(botsTable)
      .set({ startCount: sql`${botsTable.startCount} + 1` })
      .where(eq(botsTable.id, id));
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: "Server error" }); }
});

export default router;
