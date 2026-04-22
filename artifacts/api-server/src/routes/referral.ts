import { Router } from "express";
import fs from "fs";
import path from "path";
import { resolveSession, getSessionToken } from "../lib/sessionAuth.js";

const router = Router();
const DATA_FILE = path.join(process.cwd(), "referral_data.json");

type ReferralRecord = {
  coinBalance: number;
  referralsCount: number;
  referredUsers: string[];
};

function loadData(): Record<string, ReferralRecord> {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    }
  } catch {}
  return {};
}

function saveData(data: Record<string, ReferralRecord>) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch {}
}

/* GET /api/referral/stats */
router.get("/stats", async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: "Unauthorized" });

  const data = loadData();
  const record = data[userHash] || { coinBalance: 0, referralsCount: 0, referredUsers: [] };
  return res.json({ coinBalance: record.coinBalance, referralsCount: record.referralsCount });
});

/* POST /api/referral/claim?ref=<refHash> — начислить монеты реферреру */
router.post("/claim", async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: "Unauthorized" });

  const refHash = (req.query.ref as string || "").slice(0, 32);
  if (!refHash || refHash === userHash.slice(0, 12)) {
    return res.status(400).json({ error: "Invalid referral" });
  }

  const data = loadData();

  // Проверка: уже был ли засчитан этот пользователь
  const referrerEntry = Object.entries(data).find(([, v]) => v.referredUsers?.includes(userHash));
  if (referrerEntry) return res.json({ ok: true, alreadyClaimed: true });

  // Найти реферрера по первым 12 символам хэша
  const referrerHash = Object.keys(data).find(k => k.startsWith(refHash));
  if (!referrerHash) {
    // Создать запись для реферрера и начислить
    const matchHash = refHash;
    if (!data[matchHash]) data[matchHash] = { coinBalance: 0, referralsCount: 0, referredUsers: [] };
    data[matchHash].coinBalance += 50;
    data[matchHash].referralsCount += 1;
    data[matchHash].referredUsers.push(userHash);
    saveData(data);
    return res.json({ ok: true, awarded: 50 });
  }

  if (!data[referrerHash]) data[referrerHash] = { coinBalance: 0, referralsCount: 0, referredUsers: [] };
  data[referrerHash].coinBalance += 50;
  data[referrerHash].referralsCount += 1;
  data[referrerHash].referredUsers.push(userHash);
  saveData(data);
  return res.json({ ok: true, awarded: 50 });
});

export default router;
