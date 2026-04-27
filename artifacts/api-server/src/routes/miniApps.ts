import { Router, type IRouter } from "express";
import { db, miniAppsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireSession } from "../lib/sessionAuth.js";
import { randomBytes } from "crypto";

const router: IRouter = Router();

function genId(): string {
  return randomBytes(8).toString("hex");
}

/* GET /api/mini-apps — мини-аппы текущего пользователя */
router.get("/mini-apps", requireSession, async (req, res) => {
  try {
    const { userHash } = req as any;
    const rows = await db
      .select()
      .from(miniAppsTable)
      .where(eq(miniAppsTable.ownerHash, userHash))
      .orderBy(desc(miniAppsTable.createdAt));
    return res.json(rows);
  } catch { return res.status(500).json({ error: "Server error" }); }
});

/* GET /api/mini-apps/public — публичные мини-аппы */
router.get("/mini-apps/public", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(miniAppsTable)
      .where(eq(miniAppsTable.isPublic, "true"))
      .orderBy(desc(miniAppsTable.viewCount))
      .limit(50);
    return res.json(rows);
  } catch { return res.status(500).json({ error: "Server error" }); }
});

/* GET /api/mini-apps/:id — получить мини-апп */
router.get("/mini-apps/:id", async (req, res) => {
  try {
    const { id } = req.params as { id: string };
    const [app] = await db.select().from(miniAppsTable).where(eq(miniAppsTable.id, id));
    if (!app) return res.status(404).json({ error: "Mini app not found" });
    // Увеличить счётчик просмотров
    await db.update(miniAppsTable)
      .set({ viewCount: (app.viewCount || 0) + 1 })
      .where(eq(miniAppsTable.id, id));
    return res.json(app);
  } catch { return res.status(500).json({ error: "Server error" }); }
});

/* POST /api/mini-apps — создать мини-апп */
router.post("/mini-apps", requireSession, async (req, res) => {
  try {
    const { userHash } = req as any;
    const { name, description, icon, config, isPublic } = req.body as any;
    const defaultConfig = {
      accentColor: "#8b5cf6",
      darkMode: false,
      blocks: [
        {
          id: randomBytes(4).toString("hex"),
          type: "hero",
          title: name || "Мой мини-апп",
          subtitle: "Добро пожаловать!",
          bgColor: "#8b5cf6",
          textColor: "#ffffff",
          buttonLabel: "",
          buttonUrl: "",
        },
      ],
    };
    const [app] = await db.insert(miniAppsTable).values({
      id: genId(),
      ownerHash: userHash,
      name: name || "Новый мини-апп",
      description: description || "",
      icon: icon || "✨",
      config: config || defaultConfig,
      isPublic: isPublic ? "true" : "false",
    }).returning();
    return res.json(app);
  } catch (e) { return res.status(500).json({ error: "Server error" }); }
});

/* PUT /api/mini-apps/:id — обновить мини-апп */
router.put("/mini-apps/:id", requireSession, async (req, res) => {
  try {
    const { userHash } = req as any;
    const { id } = req.params as { id: string };
    const { name, description, icon, config, isPublic } = req.body as any;
    const [existing] = await db.select().from(miniAppsTable).where(eq(miniAppsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.ownerHash !== userHash) return res.status(403).json({ error: "Forbidden" });
    const [updated] = await db.update(miniAppsTable)
      .set({
        name: name ?? existing.name,
        description: description ?? existing.description,
        icon: icon ?? existing.icon,
        config: config ?? existing.config,
        isPublic: isPublic !== undefined ? String(isPublic) : existing.isPublic,
        updatedAt: new Date(),
      })
      .where(eq(miniAppsTable.id, id))
      .returning();
    return res.json(updated);
  } catch { return res.status(500).json({ error: "Server error" }); }
});

/* DELETE /api/mini-apps/:id — удалить мини-апп */
router.delete("/mini-apps/:id", requireSession, async (req, res) => {
  try {
    const { userHash } = req as any;
    const { id } = req.params as { id: string };
    const [existing] = await db.select().from(miniAppsTable).where(eq(miniAppsTable.id, id));
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.ownerHash !== userHash) return res.status(403).json({ error: "Forbidden" });
    await db.delete(miniAppsTable).where(eq(miniAppsTable.id, id));
    return res.json({ ok: true });
  } catch { return res.status(500).json({ error: "Server error" }); }
});

export default router;
