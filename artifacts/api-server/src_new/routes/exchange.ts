import { Router, type IRouter } from "express";
import { db, swpWalletsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { resolveSession, getSessionToken } from "../lib/sessionAuth.js";

const router: IRouter = Router();

/* ── Детерминированный генератор цены SWP ─────────────────── */
function seededRand(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function buildPriceHistory(days: number) {
  const rand = seededRand(0x5741_9001);
  const now = Date.now();
  const MS_DAY = 86_400_000;
  const startMs = now - days * MS_DAY;
  const points: { ts: number; open: number; high: number; low: number; close: number }[] = [];

  let price = 1.0;
  for (let i = 0; i <= days; i++) {
    const ts = startMs + i * MS_DAY;
    const trend = 0.0018;
    const noise = (rand() - 0.44) * 0.024;
    const open = price;
    const change = price * (trend + noise);
    price = Math.max(0.98, price + change);
    const high = price + price * rand() * 0.009;
    const low  = open  - open  * rand() * 0.009;
    points.push({ ts, open, high, low, close: price });
  }
  return points;
}

/* ── Получить тикер (текущая цена) ── */
router.get("/exchange/ticker", (_req, res) => {
  const history = buildPriceHistory(180);
  const last = history[history.length - 1];
  const prev = history[history.length - 2];
  const change24h = ((last.close - prev.close) / prev.close) * 100;
  const priceRub = last.close;
  res.json({
    symbol: "SWP",
    name: "SWAIP Token",
    prices: {
      RUB: +priceRub.toFixed(4),
      USD: +priceRub.toFixed(4),
      EUR: +priceRub.toFixed(4),
      GBP: +priceRub.toFixed(4),
      CNY: +priceRub.toFixed(4),
    },
    change24h: +change24h.toFixed(2),
    volume24h: +(820000 + Math.abs(Math.sin(Date.now() / 1e8)) * 180000).toFixed(0),
    marketCap: +(last.close * 10_000_000).toFixed(0),
    launchDate: new Date(Date.now() - 180 * 86_400_000).toISOString(),
  });
});

/* ── Получить историю цен для графика ── */
router.get("/exchange/chart", (req, res) => {
  const period = (req.query['period'] as string) || '1M';
  const periodDays: Record<string, number> = {
    '1D': 1, '1W': 7, '1M': 30, '3M': 90, 'ALL': 180,
  };
  const days = periodDays[period] ?? 30;
  const history = buildPriceHistory(180);
  const slice = history.slice(-days - 1);
  res.json({ period, candles: slice });
});

/* ── Получить кошелёк пользователя ── */
router.get("/exchange/wallet", async (req, res) => {
  const token = getSessionToken(req);
  if (!token) return res.status(401).json({ ok: false });
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ ok: false });

  try {
    const rows = await db.select().from(swpWalletsTable).where(eq(swpWalletsTable.userHash, userHash)).limit(1);
    if (!rows.length) {
      const [wallet] = await db.insert(swpWalletsTable).values({ userHash }).returning();
      return res.json({ ok: true, wallet });
    }
    return res.json({ ok: true, wallet: rows[0] });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

/* ── Симулированный стакан ── */
router.get("/exchange/orderbook", (_req, res) => {
  const history = buildPriceHistory(180);
  const mid = history[history.length - 1].close;
  const rand = seededRand(Math.floor(Date.now() / 30000));
  const asks = Array.from({ length: 8 }, (_, i) => ({
    price: +(mid + 0.001 * (i + 1) + rand() * 0.002).toFixed(4),
    amount: +(500 + rand() * 4500).toFixed(2),
  }));
  const bids = Array.from({ length: 8 }, (_, i) => ({
    price: +(mid - 0.001 * (i + 1) - rand() * 0.002).toFixed(4),
    amount: +(500 + rand() * 4500).toFixed(2),
  }));
  res.json({ asks, bids, mid: +mid.toFixed(4) });
});

export default router;
