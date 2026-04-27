import { Router } from "express";
import fs from "fs";
import path from "path";
import { resolveSession, getSessionToken } from "../lib/sessionAuth.js";
import { db } from "@workspace/db";
import { accounts as accountsTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

const router = Router();

const INVITES_FILE = path.join(process.cwd(), "channel_invites.json");
const HANDLES_FILE = path.join(process.cwd(), "channel_handles.json");

/* ─── helpers ─── */
function loadInvites(): Record<string, {
  code: string; ownerHash: string; channelId: string; channelName: string;
  isGroup: boolean; label: string; clicks: number; createdAt: number;
}> {
  try { if (fs.existsSync(INVITES_FILE)) return JSON.parse(fs.readFileSync(INVITES_FILE,"utf-8")); } catch {}
  return {};
}
function saveInvites(d: ReturnType<typeof loadInvites>) {
  try { fs.writeFileSync(INVITES_FILE, JSON.stringify(d, null, 2)); } catch {}
}

function loadHandles(): Record<string, { ownerHash: string; channelId: string; registeredAt: number }> {
  try { if (fs.existsSync(HANDLES_FILE)) return JSON.parse(fs.readFileSync(HANDLES_FILE,"utf-8")); } catch {}
  return {};
}
function saveHandles(d: ReturnType<typeof loadHandles>) {
  try { fs.writeFileSync(HANDLES_FILE, JSON.stringify(d, null, 2)); } catch {}
}

function randCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/* ═══════════════════════════════════════════════════════
   GET /api/channel-handles/check?handle=xxx
   Проверяет доступность @handle для публичного канала
═══════════════════════════════════════════════════════ */
router.get("/channel-handles/check", async (req, res) => {
  const handle = ((req.query.handle as string) || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!handle || handle.length < 3) return res.json({ available: false, reason: "too_short" });
  if (handle.length > 32) return res.json({ available: false, reason: "too_long" });

  const reserved = ["swaip","admin","support","official","bot","system","null","undefined","root","moderator"];
  if (reserved.includes(handle)) return res.json({ available: false, reason: "reserved" });

  const handles = loadHandles();
  const token = getSessionToken(req);
  const userHash = token ? await resolveSession(token) : null;

  if (handles[handle]) {
    if (userHash && handles[handle].ownerHash === userHash) {
      return res.json({ available: true, own: true });
    }
    return res.json({ available: false, reason: "taken" });
  }

  try {
    const rows = await db.select({ cnt: sql<number>`count(*)::int` })
      .from(accountsTable)
      .where(sql`${accountsTable.data}->>'sw_channels' ILIKE ${`%"handle":"${handle}"%`}`);
    if ((rows[0]?.cnt ?? 0) > 0) {
      return res.json({ available: false, reason: "taken" });
    }
  } catch {}

  return res.json({ available: true });
});

/* ═══════════════════════════════════════════════════════
   POST /api/channel-handles/register
   Регистрирует handle при создании публичного канала
═══════════════════════════════════════════════════════ */
router.post("/channel-handles/register", async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: "Unauthorized" });

  const { handle, channelId } = req.body as { handle: string; channelId: string };
  if (!handle || !channelId) return res.status(400).json({ error: "Missing fields" });

  const h = handle.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (h.length < 3) return res.status(400).json({ error: "Handle too short" });

  const handles = loadHandles();
  if (handles[h] && handles[h].ownerHash !== userHash) {
    return res.status(409).json({ error: "taken" });
  }

  handles[h] = { ownerHash: userHash, channelId, registeredAt: Date.now() };
  saveHandles(handles);
  return res.json({ ok: true, handle: h });
});

/* ═══════════════════════════════════════════════════════
   POST /api/channel-invites
   Создаёт ссылку-приглашение для закрытого канала/группы
   Body: { channelId, channelName, isGroup, label? }
═══════════════════════════════════════════════════════ */
router.post("/channel-invites", async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: "Unauthorized" });

  const { channelId, channelName, isGroup = false, label = "Ссылка" } = req.body as {
    channelId: string; channelName: string; isGroup?: boolean; label?: string;
  };
  if (!channelId) return res.status(400).json({ error: "Missing channelId" });

  const code = randCode();
  const invites = loadInvites();
  invites[code] = { code, ownerHash: userHash, channelId, channelName, isGroup, label, clicks: 0, createdAt: Date.now() };
  saveInvites(invites);

  return res.json({ ok: true, code, link: `${process.env.APP_URL || ""}/invite/${code}` });
});

/* ═══════════════════════════════════════════════════════
   GET /api/channel-invites/:code
   Возвращает информацию о ссылке-приглашении
═══════════════════════════════════════════════════════ */
router.get("/channel-invites/:code", async (req, res) => {
  const { code } = req.params;
  const invites = loadInvites();
  const inv = invites[code.toUpperCase()];
  if (!inv) return res.status(404).json({ found: false });
  return res.json({ found: true, ...inv });
});

/* ═══════════════════════════════════════════════════════
   POST /api/channel-invites/:code/click
   Отмечает переход по ссылке (трекинг)
═══════════════════════════════════════════════════════ */
router.post("/channel-invites/:code/click", async (req, res) => {
  const { code } = req.params;
  const invites = loadInvites();
  const key = code.toUpperCase();
  if (!invites[key]) return res.status(404).json({ error: "Not found" });
  invites[key].clicks += 1;
  saveInvites(invites);
  return res.json({ ok: true, clicks: invites[key].clicks });
});

/* ═══════════════════════════════════════════════════════
   GET /api/channel-invites?channelId=xxx
   Список ссылок для конкретного канала (только владелец)
═══════════════════════════════════════════════════════ */
router.get("/channel-invites", async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: "Unauthorized" });

  const channelId = req.query.channelId as string;
  if (!channelId) return res.status(400).json({ error: "Missing channelId" });

  const invites = loadInvites();
  const list = Object.values(invites).filter(
    i => i.channelId === channelId && i.ownerHash === userHash
  );
  return res.json({ invites: list });
});

/* ═══════════════════════════════════════════════════════
   DELETE /api/channel-invites/:code
   Удаляет ссылку-приглашение
═══════════════════════════════════════════════════════ */
router.delete("/channel-invites/:code", async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: "Unauthorized" });

  const { code } = req.params;
  const invites = loadInvites();
  const key = code.toUpperCase();
  if (!invites[key] || invites[key].ownerHash !== userHash) {
    return res.status(403).json({ error: "Forbidden" });
  }
  delete invites[key];
  saveInvites(invites);
  return res.json({ ok: true });
});

export default router;
