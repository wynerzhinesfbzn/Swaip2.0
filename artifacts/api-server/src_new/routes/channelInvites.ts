import { Router } from "express";
import fs from "fs";
import path from "path";
import { resolveSession, getSessionToken } from "../lib/sessionAuth.js";
import { db } from "@workspace/db";
import { accountsTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";

const router = Router();

const INVITES_FILE = path.join(process.cwd(), "channel_invites.json");
const HANDLES_FILE = path.join(process.cwd(), "channel_handles.json");

/* ─── types ─── */
interface InviteRecord {
  code: string;
  ownerHash: string;
  channelId: string;
  channelName: string;
  isGroup: boolean;
  label: string;
  clicks: number;
  createdAt: number;
}
interface HandleRecord {
  ownerHash: string;
  channelId: string;
  registeredAt: number;
}

/* ─── helpers ─── */
function loadInvites(): Record<string, InviteRecord> {
  if (!fs.existsSync(INVITES_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(INVITES_FILE, "utf-8")) as Record<string, InviteRecord>;
  } catch {
    return {};
  }
}
function saveInvites(d: Record<string, InviteRecord>): void {
  try {
    fs.writeFileSync(INVITES_FILE, JSON.stringify(d, null, 2));
  } catch (err) {
    console.error("[channelInvites] saveInvites failed:", err);
  }
}

function loadHandles(): Record<string, HandleRecord> {
  if (!fs.existsSync(HANDLES_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(HANDLES_FILE, "utf-8")) as Record<string, HandleRecord>;
  } catch {
    return {};
  }
}
function saveHandles(d: Record<string, HandleRecord>): void {
  try {
    fs.writeFileSync(HANDLES_FILE, JSON.stringify(d, null, 2));
  } catch (err) {
    console.error("[channelInvites] saveHandles failed:", err);
  }
}

function randCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

const RESERVED = new Set(["swaip","admin","support","official","bot","system","null","undefined","root","moderator"]);

/* ═══════════════════════════════════════════════════════
   GET /api/channel-handles/check?handle=xxx
   Проверяет доступность @handle для публичного канала
═══════════════════════════════════════════════════════ */
router.get("/channel-handles/check", async (req, res) => {
  const handle = (typeof req.query.handle === "string" ? req.query.handle : "")
    .toLowerCase().replace(/[^a-z0-9_]/g, "");

  if (!handle || handle.length < 3) return res.json({ available: false, reason: "too_short" });
  if (handle.length > 32) return res.json({ available: false, reason: "too_long" });
  if (RESERVED.has(handle)) return res.json({ available: false, reason: "reserved" });

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
  } catch (err) {
    console.error("[channelInvites] DB handle check failed:", err);
  }

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

  const body = req.body as Record<string, unknown>;
  const handle = typeof body.handle === "string" ? body.handle : "";
  const channelId = typeof body.channelId === "string" ? body.channelId : "";
  if (!handle || !channelId) return res.status(400).json({ error: "Missing fields" });

  const h = handle.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (h.length < 3) return res.status(400).json({ error: "Handle too short" });
  if (RESERVED.has(h)) return res.status(400).json({ error: "Handle reserved" });

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

  const body = req.body as Record<string, unknown>;
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";
  const channelName = typeof body.channelName === "string" ? body.channelName.trim() : "Unnamed";
  const isGroup = body.isGroup === true;
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 80) : "Ссылка";

  if (!channelId) return res.status(400).json({ error: "Missing channelId" });

  const code = randCode();
  const invites = loadInvites();
  invites[code] = { code, ownerHash: userHash, channelId, channelName, isGroup, label, clicks: 0, createdAt: Date.now() };
  saveInvites(invites);

  return res.json({ ok: true, code, link: `${process.env["APP_URL"] ?? ""}/invite/${code}` });
});

/* ═══════════════════════════════════════════════════════
   GET /api/channel-invites/:code
   Возвращает информацию о ссылке-приглашении
═══════════════════════════════════════════════════════ */
router.get("/channel-invites/:code", (req, res) => {
  const code = req.params.code?.toUpperCase() ?? "";
  const invites = loadInvites();
  const inv = invites[code];
  if (!inv) return res.status(404).json({ found: false });
  return res.json({ found: true, ...inv });
});

/* ═══════════════════════════════════════════════════════
   POST /api/channel-invites/:code/click
   Отмечает переход по ссылке (трекинг)
═══════════════════════════════════════════════════════ */
router.post("/channel-invites/:code/click", (req, res) => {
  const key = req.params.code?.toUpperCase() ?? "";
  const invites = loadInvites();
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

  const channelId = typeof req.query.channelId === "string" ? req.query.channelId : "";
  if (!channelId) return res.status(400).json({ error: "Missing channelId" });

  const invites = loadInvites();
  const list = Object.values(invites).filter(i => i.channelId === channelId && i.ownerHash === userHash);
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

  const key = req.params.code?.toUpperCase() ?? "";
  const invites = loadInvites();
  if (!invites[key]) return res.status(404).json({ error: "Not found" });
  if (invites[key].ownerHash !== userHash) return res.status(403).json({ error: "Forbidden" });

  delete invites[key];
  saveInvites(invites);
  return res.json({ ok: true });
});

export default router;
