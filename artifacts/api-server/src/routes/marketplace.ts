import { Router, type IRouter } from "express";
import { getSessionToken, resolveSession } from "../lib/sessionAuth.js";
import { db, accountsTable, marketplaceListingsTable } from "@workspace/db";
import { eq, and, desc, ilike, or, sql } from "drizzle-orm";

const router: IRouter = Router();

function genId() { return Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase(); }

async function resolveUser(hash: string) {
  try {
    const rows = await db.select({ data: accountsTable.data })
      .from(accountsTable).where(eq(accountsTable.hash, hash)).limit(1);
    if (rows[0]) {
      const d = (rows[0].data as any) || {};
      const name = d.pro_name || d.krug_name || d.scene_artistName || 'Продавец';
      const avatar = d.pro_avatarUrl || d.krug_avatarUrl || d.scene_avatarUrl || '';
      return { name, avatar };
    }
  } catch { /* ignore */ }
  return { name: 'Продавец', avatar: '' };
}

function serializeListing(row: any, sellerName: string, sellerAvatar: string) {
  return {
    id: row.id,
    sellerHash: row.sellerHash,
    sellerName,
    sellerAvatar,
    title: row.title,
    description: row.description,
    price: row.price,
    currency: row.currency,
    category: row.category,
    condition: row.condition,
    imageUrls: Array.isArray(row.imageUrls) ? row.imageUrls : [],
    location: row.location,
    sold: row.sold,
    createdAt: row.createdAt instanceof Date ? row.createdAt.getTime() : row.createdAt,
  };
}

/* POST /api/marketplace/listings */
router.post("/marketplace/listings", async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: "Unauthorized" });

  const { title, description, price, currency, category, condition, imageUrls, location } = req.body as any;
  if (!title?.trim()) return res.status(400).json({ error: "title required" });

  const { name, avatar } = await resolveUser(userHash);
  const id = genId();

  await db.insert(marketplaceListingsTable).values({
    id,
    sellerHash: userHash,
    title: String(title).trim().slice(0, 120),
    description: String(description || '').trim().slice(0, 2000),
    price: Math.max(0, Number(price) || 0),
    currency: String(currency || 'RUB').slice(0, 5),
    category: String(category || 'Другое').slice(0, 50),
    condition: String(condition || 'Б/у').slice(0, 30),
    imageUrls: Array.isArray(imageUrls) ? imageUrls.slice(0, 8).map(String) : [],
    location: String(location || '').trim().slice(0, 100),
    sold: false,
  });

  const row = (await db.select().from(marketplaceListingsTable).where(eq(marketplaceListingsTable.id, id)).limit(1))[0];
  return res.json({ success: true, listing: serializeListing(row, name, avatar) });
});

/* GET /api/marketplace/listings */
router.get("/marketplace/listings", async (req, res) => {
  const category = req.query.category as string | undefined;
  const search = (req.query.q as string || '').trim();
  const sellerHash = req.query.seller as string | undefined;
  const showSold = req.query.sold === 'true';

  let query = db.select().from(marketplaceListingsTable).$dynamic();

  const conditions = [];
  if (!showSold) conditions.push(eq(marketplaceListingsTable.sold, false));
  if (category && category !== 'Все') conditions.push(eq(marketplaceListingsTable.category, category));
  if (sellerHash) conditions.push(eq(marketplaceListingsTable.sellerHash, sellerHash));
  if (search) conditions.push(
    or(
      ilike(marketplaceListingsTable.title, `%${search}%`),
      ilike(marketplaceListingsTable.description, `%${search}%`)
    )!
  );

  if (conditions.length) query = query.where(and(...conditions));
  const rows = await query.orderBy(desc(marketplaceListingsTable.createdAt));

  const sellerHashes = [...new Set(rows.map(r => r.sellerHash))];
  const sellerMap: Record<string, { name: string; avatar: string }> = {};
  for (const h of sellerHashes) { sellerMap[h] = await resolveUser(h); }

  const listings = rows.map(r => serializeListing(r, sellerMap[r.sellerHash].name, sellerMap[r.sellerHash].avatar));
  return res.json({ listings });
});

/* GET /api/marketplace/listings/:id */
router.get("/marketplace/listings/:id", async (req, res) => {
  const rows = await db.select().from(marketplaceListingsTable).where(eq(marketplaceListingsTable.id, req.params.id)).limit(1);
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  const r = rows[0];
  const seller = await resolveUser(r.sellerHash);
  return res.json({ listing: serializeListing(r, seller.name, seller.avatar) });
});

/* PATCH /api/marketplace/listings/:id/sold */
router.patch("/marketplace/listings/:id/sold", async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: "Unauthorized" });

  const rows = await db.select().from(marketplaceListingsTable).where(eq(marketplaceListingsTable.id, req.params.id)).limit(1);
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  if (rows[0].sellerHash !== userHash) return res.status(403).json({ error: "Forbidden" });

  await db.update(marketplaceListingsTable).set({ sold: true }).where(eq(marketplaceListingsTable.id, req.params.id));
  return res.json({ success: true });
});

/* DELETE /api/marketplace/listings/:id */
router.delete("/marketplace/listings/:id", async (req, res) => {
  const token = getSessionToken(req);
  const userHash = await resolveSession(token);
  if (!userHash) return res.status(401).json({ error: "Unauthorized" });

  const rows = await db.select().from(marketplaceListingsTable).where(eq(marketplaceListingsTable.id, req.params.id)).limit(1);
  if (!rows.length) return res.status(404).json({ error: "Not found" });
  if (rows[0].sellerHash !== userHash) return res.status(403).json({ error: "Forbidden" });

  await db.delete(marketplaceListingsTable).where(eq(marketplaceListingsTable.id, req.params.id));
  return res.json({ success: true });
});

export default router;
