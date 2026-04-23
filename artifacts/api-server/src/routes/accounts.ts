import { Router, type IRouter } from "express";
import { db, accountsTable, followsTable, conversationParticipantsTable, messagesTable, broadcastsTable, broadcastReactionsTable, broadcastCommentsTable, commentReactionsTable } from "@workspace/db";
import { eq, inArray, sql } from "drizzle-orm";
import { requireSession, resolveSession, getSessionToken, deleteAllUserSessions } from "../lib/sessionAuth.js";
import { contentFilter } from "../middlewares/contentFilter.js";

const router: IRouter = Router();

function getField(data: Record<string, unknown>, key: string): string {
  const raw = data[key];
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); return typeof p === 'string' ? p : ''; } catch { return raw; }
  }
  return typeof raw === 'string' ? raw : '';
}

interface SearchResult {
  hash: string;
  name: string;
  handle: string;
  bio: string;
  avatar: string;
  mode: 'pro' | 'scene';
}

/*
 * GET /api/search
 * Query params:
 *   q    — search text (optional)
 *   mode — caller's section: 'pro' | 'scene' | 'krug' | 'flow'
 *
 * Isolation rules:
 *   mode=pro   → only Pro accounts visible
 *   mode=scene → only Scene accounts visible
 *   mode=krug  → no text results (krug accounts only via invite code / direct link)
 *   mode=flow  → falls back to pro (Поток is public content, search shows Pro by default)
 *   (no mode)  → all accounts (legacy / fallback)
 */
router.get("/search", async (req, res) => {
  const q    = (typeof req.query.q    === 'string' ? req.query.q    : '').trim().toLowerCase();
  const mode = (typeof req.query.mode === 'string' ? req.query.mode : '').trim() as 'pro' | 'scene' | 'krug' | 'flow' | '';

  /* Круг accounts are private — no text search allowed */
  if (mode === 'krug') {
    return res.json({ results: [], total: 0, krug_locked: true });
  }

  try {
    const wantPro   = !mode || mode === 'pro'   || mode === 'flow';
    const wantScene = !mode || mode === 'scene';

    /* Экранируем спецсимволы ILIKE */
    const safe = q.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const like = safe ? `%${safe}%` : '%';

    /* Серверная фильтрация через JSONB — не загружаем весь стол в память */
    const modeWhere = wantPro && wantScene
      ? sql`(${accountsTable.data}->>'pro_displayName' IS NOT NULL
          OR ${accountsTable.data}->>'pro_fullName' IS NOT NULL
          OR ${accountsTable.data}->>'scene_artistName' IS NOT NULL
          OR ${accountsTable.data}->>'scene_handle' IS NOT NULL)`
      : wantPro
      ? sql`(${accountsTable.data}->>'pro_displayName' IS NOT NULL
          OR ${accountsTable.data}->>'pro_fullName' IS NOT NULL
          OR ${accountsTable.data}->>'sw_nick' IS NOT NULL)`
      : sql`(${accountsTable.data}->>'scene_artistName' IS NOT NULL
          OR ${accountsTable.data}->>'scene_handle' IS NOT NULL)`;

    const textWhere = q
      ? sql`AND (${accountsTable.data}->>'pro_displayName' ILIKE ${like}
              OR ${accountsTable.data}->>'pro_fullName'     ILIKE ${like}
              OR ${accountsTable.data}->>'sw_nick'          ILIKE ${like}
              OR ${accountsTable.data}->>'scene_artistName' ILIKE ${like}
              OR ${accountsTable.data}->>'scene_handle'     ILIKE ${like})`
      : sql``;

    const rows = await db.select({
      hash:         accountsTable.hash,
      pro_name:     sql<string>`${accountsTable.data}->>'pro_displayName'`,
      pro_full:     sql<string>`${accountsTable.data}->>'pro_fullName'`,
      pro_nick:     sql<string>`${accountsTable.data}->>'sw_nick'`,
      pro_bio:      sql<string>`${accountsTable.data}->>'pro_bio'`,
      pro_avatar:   sql<string>`${accountsTable.data}->>'pro_avatarUrl'`,
      pro_mood:     sql<string>`${accountsTable.data}->'pro_mood'`,
      scene_name:   sql<string>`${accountsTable.data}->>'scene_artistName'`,
      scene_handle: sql<string>`${accountsTable.data}->>'scene_handle'`,
      scene_bio:    sql<string>`${accountsTable.data}->>'scene_bio'`,
      scene_avatar: sql<string>`${accountsTable.data}->>'scene_avatarUrl'`,
    })
    .from(accountsTable)
    .where(sql`${modeWhere} ${textWhere}`)
    .limit(50);

    const results: SearchResult[] = [];
    for (const row of rows) {
      if (wantPro && (row.pro_name || row.pro_full || row.pro_nick)) {
        let moodObj:{emoji:string;text:string}|undefined;
        try{if(row.pro_mood)moodObj=typeof row.pro_mood==='string'?JSON.parse(row.pro_mood):row.pro_mood;}catch{}
        results.push({
          hash: row.hash, name: row.pro_name || row.pro_full || row.pro_nick || '',
          handle: row.pro_nick || (row.pro_full && row.pro_full !== row.pro_name ? row.pro_full : ''),
          bio: row.pro_bio || '', avatar: row.pro_avatar || '', mode: 'pro',
          mood: moodObj?.emoji?moodObj:undefined,
        } as any);
      } else if (wantScene && (row.scene_name || row.scene_handle)) {
        results.push({
          hash: row.hash, name: row.scene_name || row.scene_handle || '',
          handle: row.scene_handle || '', bio: row.scene_bio || '',
          avatar: row.scene_avatar || '', mode: 'scene',
        });
      }
    }

    results.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    return res.json({ results, total: results.length });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

/*
 * GET /api/account/stats
 * Returns quick stats for the current user (post counts, follow counts, messages)
 * IMPORTANT: must be registered BEFORE /account/:hash to avoid route collision
 */
router.get("/account/stats", requireSession, async (req, res) => {
  const hash = (req as any).userHash as string;
  try {
    const [
      broadcastRows,
      followersRow,
      followingRow,
      inboxRow,
    ] = await Promise.all([
      db.select().from(broadcastsTable).where(eq(broadcastsTable.authorHash, hash)),
      db.select().from(followsTable).where(eq(followsTable.followingHash, hash)),
      db.select().from(followsTable).where(eq(followsTable.followerHash, hash)),
      db.select().from(messagesTable).where(eq(messagesTable.senderHash, hash)),
    ]);

    const proPosts   = broadcastRows.filter(b => b.authorMode === 'pro').length;
    const scenePosts = broadcastRows.filter(b => b.authorMode === 'scene').length;
    const followers  = followersRow.length;
    const following  = followingRow.length;
    const sentMsgs   = inboxRow.length;

    // Mutual follows = friends (I follow them AND they follow me)
    const followingSet = new Set(followingRow.map(f => f.followingHash));
    const friends = followersRow.filter(f => followingSet.has(f.followerHash)).length;

    return res.json({ proPosts, scenePosts, followers, following, sentMessages: sentMsgs, friends });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

/* Детерминированный код-приглашения — та же формула что в клиенте */
function computeInviteCode(hash: string, mode: 'pro' | 'scene' | 'krug'): string {
  const offset = mode === 'pro' ? 0 : mode === 'scene' ? 15 : 30;
  const slice  = hash.slice(offset, offset + 15);
  const num    = BigInt('0x' + slice) % 900_000_000n + 100_000_000n;
  return num.toString();
}

/*
 * GET /api/invite-code/:code  — поиск аккаунта по 9-значному коду-приглашению
 * Возвращает { found, hash, mode, name, avatar, handle }
 */
router.get("/invite-code/:code", async (req, res) => {
  const code = req.params.code;
  if (!/^\d{9}$/.test(code)) return res.status(400).json({ error: "Invalid code" });

  /* Унифицированный парсер двойного JSON-кодирования (usePersistedState хранит как JSON-строку) */
  const parse = (v: unknown): string => {
    if (v === null || v === undefined || v === false || v === 0) return '';
    if (typeof v === 'string') {
      if (!v) return '';
      try { const p = JSON.parse(v); return typeof p === 'string' ? p : ''; } catch { return v; }
    }
    return '';
  };

  try {
    const allAccounts = await db.select({ hash: accountsTable.hash, data: accountsTable.data }).from(accountsTable);
    for (const row of allAccounts) {
      /* Пропускаем аккаунты с невалидным хешем — они роняют BigInt() */
      if (!row.hash || typeof row.hash !== 'string' || row.hash.length < 30) continue;
      if (!/^[0-9a-fA-F]+$/.test(row.hash)) continue;

      try {
        const d = (row.data as Record<string, unknown>) ?? {};

        /* 1. Кастомный код-приглашение (устанавливается администратором) */
        const rawCustom = d['pro_customInviteCode'];
        /* Поддерживаем оба формата: строка как есть и JSON-строка (двойное кодирование) */
        const customCode = typeof rawCustom === 'string'
          ? (rawCustom.startsWith('"') ? parse(rawCustom) : rawCustom)
          : '';
        if (customCode && customCode === code) {
          return res.json({
            found: true, hash: row.hash, mode: 'pro',
            name:   parse(d['pro_displayName'])  || 'Участник SWAIP',
            avatar: parse(d['pro_avatarUrl']),
            handle: parse(d['pro_fullName']),
          });
        }

        /* 2. Автовычисленный код по хешу (все три режима) */
        for (const mode of ['pro', 'scene', 'krug'] as const) {
          if (computeInviteCode(row.hash, mode) === code) {
            const name = mode === 'scene'
              ? (parse(d['scene_artistName']) || parse(d['scene_handle']) || 'Артист SWAIP')
              : mode === 'krug'
              ? (parse(d['krug_displayName']) || 'Участник Круга')
              : (parse(d['pro_displayName'])  || 'Участник SWAIP');
            const avatar = mode === 'scene'
              ? parse(d['scene_avatarUrl'])
              : mode === 'krug'
              ? parse(d['krug_avatarUrl'])
              : parse(d['pro_avatarUrl']);
            const handle = mode === 'scene'
              ? parse(d['scene_handle'])
              : parse(d['pro_fullName']);
            return res.json({ found: true, hash: row.hash, mode, name, avatar, handle });
          }
        }
      } catch {
        /* Ошибка в одном аккаунте не должна прерывать поиск по всем остальным */
        continue;
      }
    }
    return res.json({ found: false });
  } catch (err) {
    console.error('[invite-code] search error:', err);
    return res.status(500).json({ error: "Server error" });
  }
});

/*
 * GET /api/account/booking-requests  — MUST be before /:hash to avoid collision
 * Владелец получает все заявки от гостей.
 */
router.get("/account/booking-requests", requireSession, async (req, res) => {
  const hash = (req as any).userHash as string;
  try {
    const rows = await db.select().from(accountsTable).where(eq(accountsTable.hash, hash)).limit(1);
    if (rows.length === 0) return res.json({ requests: [] });
    const fullData = (rows[0].data as Record<string, unknown>) || {};
    const requests = Array.isArray(fullData['booking_requests']) ? fullData['booking_requests'] : [];
    return res.json({ requests });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

/*
 * PATCH /api/account/booking-requests/:id  — MUST be before /:hash
 * Владелец меняет статус заявки.
 */
router.patch("/account/booking-requests/:id", requireSession, async (req, res) => {
  const hash = (req as any).userHash as string;
  const { id } = req.params;
  const { status } = req.body as { status?: string };
  /* Белый список допустимых статусов */
  const VALID = ['new', 'confirmed', 'cancelled', 'completed'];
  if (!status || !VALID.includes(status)) {
    return res.status(400).json({ error: "Invalid or missing status", allowed: VALID });
  }
  try {
    const rows = await db.select().from(accountsTable).where(eq(accountsTable.hash, hash)).limit(1);
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    const fullData = (rows[0].data as Record<string, unknown>) || {};
    const existing = Array.isArray(fullData['booking_requests']) ? fullData['booking_requests'] as Record<string,unknown>[] : [];
    const target = existing.find(r => r['id'] === id) as Record<string,unknown>|undefined;
    if (!target) return res.status(404).json({ error: "Booking request not found" });
    const prevStatus = target['status'] as string;
    const updated = existing.map(r => r['id'] === id ? { ...r, status } : r);
    let updatedData: Record<string, unknown> = { ...fullData, booking_requests: updated };

    /* При отмене — возвращаем слот обратно в pro_freeSlots (если не уже там) */
    if (status === 'cancelled' && prevStatus !== 'cancelled') {
      const slotToReturn = target['slot'] as string | undefined;
      if (slotToReturn) {
        const currentSlots = Array.isArray(fullData['pro_freeSlots']) ? (fullData['pro_freeSlots'] as string[]) : [];
        if (!currentSlots.includes(slotToReturn)) {
          updatedData['pro_freeSlots'] = [...currentSlots, slotToReturn].sort();
        }
      }
    }

    await db.insert(accountsTable)
      .values({ hash, data: updatedData })
      .onConflictDoUpdate({ target: accountsTable.hash, set: { data: updatedData, updatedAt: new Date() } });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

/*
 * GET /api/account/:hash
 * - Own profile (session matches hash): full data
 * - Public profile (other user, no session needed): only public fields
 */
router.get("/account/:hash", async (req, res) => {
  const { hash } = req.params;

  const token = getSessionToken(req);
  const callerHash = token ? await resolveSession(token) : null;
  const isOwner = callerHash === hash;

  try {
    const rows = await db.select().from(accountsTable).where(eq(accountsTable.hash, hash)).limit(1);
    if (rows.length === 0) return res.status(404).json({ data: null });

    const fullData = rows[0].data as Record<string, unknown>;

    if (isOwner) {
      /* Owner gets full data */
      return res.json({ data: fullData });
    }

    /* Public fields — все три аккаунта полностью открыты для гостей */
    const publicFields = [
      /* ── PRO — всё публичное ── */
      'pro_displayName', 'pro_fullName', 'pro_bio', 'pro_avatarUrl', 'pro_website',
      'pro_socials', 'pro_bioFont', 'pro_dnFont', 'pro_fnFont', 'pro_nameColor',
      'pro_coverPhotoUrl', 'pro_coverImageUrl', 'pro_coverPosition', 'pro_coverGradient', 'pro_bgPhotoUrl',
      'pro_feedBgGradient', 'pro_coverType', 'pro_coverPosX', 'pro_coverPosY',
      'pro_posts', 'pro_shopItems', 'pro_ethers',
      /* Бизнес-визитка и тема — критически важны для гостевого вида */
      'pro_biz_theme', 'pro_extra_theme', 'pro_classic_theme',
      'pro_position', 'pro_company', 'pro_utp',
      'pro_metrics', 'pro_contacts', 'pro_priceItems',
      'pro_aiName', 'pro_freeSlots', 'pro_greetingAudioUrl',
      /* Разделы профиля — портфолио, отзывы, сертификаты, FAQ, кейсы, ссылки */
      'classic_works', 'classic_reviews', 'classic_certs', 'classic_faq', 'classic_cases', 'classic_links',
      /* ── SW — настройки вида профиля, видимые гостям ── */
      'sw_feedBg', 'sw_highlights', 'sw_widget_labels_v2', 'sw_widget_previews_v2', 'sw_myStories',
      'sw_nick', 'sw_postCardStyle', 'sw_vizitka',
      /* ── SCENE — всё публичное ── */
      'scene_artistName', 'scene_handle', 'scene_bio', 'scene_avatarUrl', 'scene_genre',
      'scene_coverPhotoUrl', 'scene_coverGradient', 'scene_bgPhotoUrl',
      'scene_coverType', 'scene_coverFitMode', 'scene_coverPosX', 'scene_coverPosY',
      'scene_socials', 'scene_website',
      'scene_nameFont', 'scene_bioFont', 'scene_nameColor',
      'scene_posts', 'scene_shopItems', 'scene_ethers', 'scene_greetingAudioUrl',
      /* ── KRUG — видно всем, у кого есть ссылка ── */
      'krug_displayName', 'krug_bio', 'krug_avatarUrl', 'krug_nameColor',
      'krug_coverGradient', 'krug_coverPhotoUrl', 'krug_bgPhotoUrl',
      'krug_cover1', 'krug_cover2', 'krug_cover3',
      'krug_posts',
    ];
    const publicData: Record<string, unknown> = {};
    for (const f of publicFields) {
      if (fullData[f] !== undefined) publicData[f] = fullData[f];
    }
    return res.json({ data: publicData });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

/*
 * POST /api/booking-request
 * Гость отправляет заявку на запись к владельцу профиля.
 * Сохраняется в данных аккаунта владельца в поле booking_requests.
 */
router.post("/booking-request", async (req, res) => {
  const { targetHash, text, clientName, clientPhone, service, slot } = req.body as {
    targetHash?: string; text?: string; clientName?: string; clientPhone?: string; service?: string; slot?: string;
  };
  if (!targetHash || !text || !clientName || !clientPhone) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  try {
    /* ─── Транзакция + PostgreSQL advisory lock ───────────────────────────────
     * pg_advisory_xact_lock гарантирует: только один процесс одновременно
     * может бронировать слот у данного аккаунта. Lock снимается автоматически
     * в конце транзакции. Это исключает race condition двойного бронирования.
     * ─────────────────────────────────────────────────────────────────────── */
    let newRequestId = '';
    let slotsRemaining = 0;

    await db.transaction(async (tx) => {
      /* Advisory lock по числовому ключу из хэша targetHash */
      await tx.execute(
        sql`SELECT pg_advisory_xact_lock(('x' || substr(md5(${targetHash}), 1, 16))::bit(64)::bigint)`
      );

      /* Читаем данные внутри транзакции — гарантированно актуальные */
      const rows = await tx.select().from(accountsTable).where(eq(accountsTable.hash, targetHash)).limit(1);
      if (rows.length === 0) throw Object.assign(new Error('not_found'), { status: 404 });

      const fullData = (rows[0].data as Record<string, unknown>) || {};
      const existing = Array.isArray(fullData['booking_requests']) ? fullData['booking_requests'] as unknown[] : [];
      let updatedSlots = Array.isArray(fullData['pro_freeSlots']) ? (fullData['pro_freeSlots'] as string[]) : [];

      /* Если слот указан — проверяем внутри lock что он ВСЁЩЁ доступен */
      if (slot) {
        const alreadyBooked = (existing as {slot?:string;status?:string}[])
          .some(r => r.slot === slot && r.status !== 'cancelled');
        if (!updatedSlots.includes(slot) || alreadyBooked) {
          throw Object.assign(new Error('slot_unavailable'), { status: 409 });
        }
        updatedSlots = updatedSlots.filter(s => s !== slot);
      }

      const newRequest = {
        id: `br_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
        clientName, clientPhone, service: service || '', slot: slot || '', text,
        status: 'new', createdAt: new Date().toISOString(),
      };

      const updatedData = {
        ...fullData,
        booking_requests: [...existing, newRequest],
        pro_freeSlots: updatedSlots,
      };

      await tx.insert(accountsTable)
        .values({ hash: targetHash, data: updatedData })
        .onConflictDoUpdate({ target: accountsTable.hash, set: { data: updatedData, updatedAt: new Date() } });

      newRequestId = newRequest.id;
      slotsRemaining = updatedSlots.length;
    });

    return res.json({ success: true, id: newRequestId, slotsRemaining });
  } catch (err: any) {
    if (err?.message === 'not_found')        return res.status(404).json({ error: "Account not found" });
    if (err?.message === 'slot_unavailable') return res.status(409).json({ error: "slot_unavailable", message: "Этот слот уже занят или недоступен" });
    return res.status(500).json({ error: "Server error" });
  }
});

/*
 * PUT /api/account
 * Requires valid session — user can only update their own profile.
 * Hash is derived from session, NOT from URL (prevents impersonation).
 */
router.put("/account", requireSession, contentFilter("profile", ["pro_bio","pro_displayName","pro_fullName","pro_utp","scene_bio","krug_bio"]), async (req, res) => {
  const hash = (req as any).userHash as string;
  const { data } = req.body;
  if (!data || typeof data !== "object") return res.status(400).json({ error: "Bad request" });
  try {
    /* Защита от перезаписи забронированных слотов:
       owner-клиент каждые 8с шлёт весь localStorage, включая pro_freeSlots.
       Если гость успел забронировать слот, на сервере он уже удалён из pro_freeSlots.
       Но client синхронизирует старую версию из localStorage — слот "воскресает".
       Решение: читаем с сервера уже подтверждённые бронирования и фильтруем входящие слоты. */
    const mergedData = { ...(data as Record<string, unknown>) };
    const existing = await db.select().from(accountsTable).where(eq(accountsTable.hash, hash)).limit(1);
    if (existing.length > 0) {
      const serverData = (existing[0].data as Record<string, unknown>) || {};
      const serverRequests = Array.isArray(serverData['booking_requests'])
        ? (serverData['booking_requests'] as {slot?: string; status?: string}[])
        : [];
      const bookedSlots = new Set(
        serverRequests
          .filter(r => r.slot && r.status !== 'cancelled')
          .map(r => r.slot as string)
      );
      if (bookedSlots.size > 0) {
        const incomingSlots = Array.isArray(mergedData['pro_freeSlots'])
          ? (mergedData['pro_freeSlots'] as string[])
          : [];
        mergedData['pro_freeSlots'] = incomingSlots.filter(s => !bookedSlots.has(s));
      }
      /* Сохраняем booking_requests с сервера — чтобы не потерять заявки от гостей */
      mergedData['booking_requests'] = serverData['booking_requests'] ?? mergedData['booking_requests'];
      /* Сохраняем кастомный инвайт-код — устанавливается только через admin-маршрут */
      if (serverData['pro_customInviteCode'] && !mergedData['pro_customInviteCode']) {
        mergedData['pro_customInviteCode'] = serverData['pro_customInviteCode'];
      }
    }
    await db.insert(accountsTable)
      .values({ hash, data: mergedData })
      .onConflictDoUpdate({
        target: accountsTable.hash,
        set: { data: mergedData, updatedAt: new Date() },
      });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

/* Legacy route: kept for backward compatibility. Applies same slot-protection as PUT /api/account */
router.put("/account/:hash", requireSession, contentFilter("profile", ["pro_bio","pro_displayName","pro_fullName","pro_utp","scene_bio","krug_bio"]), async (req, res) => {
  const hash = (req as any).userHash as string;
  const { data } = req.body;
  if (!data || typeof data !== "object") return res.status(400).json({ error: "Bad request" });
  try {
    const mergedData = { ...(data as Record<string, unknown>) };
    const existing = await db.select().from(accountsTable).where(eq(accountsTable.hash, hash)).limit(1);
    if (existing.length > 0) {
      const serverData = (existing[0].data as Record<string, unknown>) || {};
      const serverRequests = Array.isArray(serverData['booking_requests'])
        ? (serverData['booking_requests'] as {slot?:string;status?:string}[]) : [];
      const bookedSlots = new Set(
        serverRequests.filter(r => r.slot && r.status !== 'cancelled').map(r => r.slot as string)
      );
      if (bookedSlots.size > 0) {
        const incomingSlots = Array.isArray(mergedData['pro_freeSlots']) ? (mergedData['pro_freeSlots'] as string[]) : [];
        mergedData['pro_freeSlots'] = incomingSlots.filter(s => !bookedSlots.has(s));
      }
      mergedData['booking_requests'] = serverData['booking_requests'] ?? mergedData['booking_requests'];
      if (serverData['pro_customInviteCode'] && !mergedData['pro_customInviteCode']) {
        mergedData['pro_customInviteCode'] = serverData['pro_customInviteCode'];
      }
    }
    await db.insert(accountsTable)
      .values({ hash, data: mergedData })
      .onConflictDoUpdate({ target: accountsTable.hash, set: { data: mergedData, updatedAt: new Date() } });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

/*
 * DELETE /api/account
 * Permanently deletes the account, all sessions, broadcasts, follows, messages.
 * Requires session token. Double-confirm required on client side.
 */
router.delete("/account", requireSession, async (req, res) => {
  const hash = (req as any).userHash as string;
  const { confirm } = req.body as { confirm?: string };

  if (confirm !== "УДАЛИТЬ НАВСЕГДА") {
    return res.status(400).json({ error: "Требуется подтверждение" });
  }

  try {
    /* Delete in dependency order */

    /* 1. Собираем ID всех постов этого пользователя (нужны для удаления сирот) */
    const ownBroadcasts = await db.select({ id: broadcastsTable.id })
      .from(broadcastsTable).where(eq(broadcastsTable.authorHash, hash));
    const ownIds = ownBroadcasts.map(b => b.id);

    /* 2. Реакции этого пользователя на чужие комментарии и посты */
    await db.delete(commentReactionsTable).where(eq(commentReactionsTable.userHash, hash));
    await db.delete(broadcastReactionsTable).where(eq(broadcastReactionsTable.userHash, hash));

    /* 3. Реакции/комментарии ДРУГИХ пользователей на посты этого пользователя — сироты */
    if (ownIds.length > 0) {
      await db.delete(broadcastReactionsTable).where(inArray(broadcastReactionsTable.broadcastId, ownIds));
      /* Собираем ID комментариев к постам этого пользователя для удаления реакций на них */
      const ownComments = await db.select({ id: broadcastCommentsTable.id })
        .from(broadcastCommentsTable).where(inArray(broadcastCommentsTable.broadcastId, ownIds));
      const ownCmtIds = ownComments.map(c => c.id);
      if (ownCmtIds.length > 0) {
        await db.delete(commentReactionsTable).where(inArray(commentReactionsTable.commentId, ownCmtIds));
      }
      await db.delete(broadcastCommentsTable).where(inArray(broadcastCommentsTable.broadcastId, ownIds));
    }

    /* 4. Собственные комментарии этого пользователя на чужих постах */
    await db.delete(broadcastCommentsTable).where(eq(broadcastCommentsTable.authorHash, hash));

    /* 5. Собственные посты */
    await db.delete(broadcastsTable).where(eq(broadcastsTable.authorHash, hash));

    /* 6. Социальные связи */
    await db.delete(followsTable).where(eq(followsTable.followerHash, hash));
    await db.delete(followsTable).where(eq(followsTable.followingHash, hash));
    await db.delete(messagesTable).where(eq(messagesTable.senderHash, hash));
    await db.delete(conversationParticipantsTable).where(eq(conversationParticipantsTable.userHash, hash));

    /* 7. Аккаунт и сессии */
    await db.delete(accountsTable).where(eq(accountsTable.hash, hash));
    await deleteAllUserSessions(hash);

    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

/* ═══════════════════════════════════════════════════════════════════
 * РЕФЕРАЛЬНАЯ ПРОГРАММА + СВАЙП-МОНЕТЫ
 * ═══════════════════════════════════════════════════════════════════ */

const COINS_PER_REFERRAL = 50;   // реферер получает
const COINS_WELCOME       = 25;  // новый пользователь получает
const MAX_COINS           = 9999;

function safeCoins(raw: unknown): number {
  const n = Number(raw);
  return isNaN(n) || n < 0 ? 0 : Math.min(Math.floor(n), MAX_COINS);
}

/*
 * GET /api/referral/stats
 * Возвращает балланс монет и количество приглашённых для текущего пользователя.
 */
router.get("/referral/stats", requireSession, async (req, res) => {
  const hash = (req as any).userHash as string;
  try {
    const rows = await db.select().from(accountsTable).where(eq(accountsTable.hash, hash)).limit(1);
    if (!rows.length) return res.status(404).json({ error: "Account not found" });
    const d = (rows[0].data as Record<string, unknown>) || {};
    return res.json({
      coinBalance:     safeCoins(d['swaip_coins']),
      referralsCount:  Number(d['referrals_count']) || 0,
      referrerHash:    d['referrer_hash'] ? String(d['referrer_hash']).slice(0, 8) + '...' : null,
    });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

/*
 * POST /api/referral/claim
 * Вызывается один раз после регистрации, если пользователь пришёл по реферальной ссылке.
 * Body: { referrerHashPrefix: string }  — первые 8+ символов хэша реферера
 *
 * Логика:
 *   1. Проверяем что текущий пользователь ещё не имеет реферера
 *   2. Находим аккаунт реферера по префиксу хэша
 *   3. Реферер не может быть самим собой
 *   4. Начисляем COINS_PER_REFERRAL рефереру + COINS_WELCOME новому пользователю
 *   5. Записываем referrer_hash в данные нового пользователя
 */
router.post("/referral/claim", requireSession, async (req, res) => {
  const claimerHash = (req as any).userHash as string;
  const { referrerHashPrefix } = req.body as { referrerHashPrefix?: string };
  if (!referrerHashPrefix || referrerHashPrefix.length < 8) {
    return res.status(400).json({ error: "Invalid referral prefix" });
  }
  if (claimerHash.startsWith(referrerHashPrefix)) {
    return res.status(400).json({ error: "Cannot refer yourself" });
  }
  try {
    /* Ищем реферера по префиксу хэша */
    const referrerRows = await db.select().from(accountsTable)
      .where(sql`${accountsTable.hash} LIKE ${referrerHashPrefix + '%'}`)
      .limit(2);
    if (!referrerRows.length) return res.status(404).json({ error: "Referrer not found" });
    if (referrerRows.length > 1) return res.status(409).json({ error: "Ambiguous referrer prefix" });

    const referrerHash = referrerRows[0].hash;
    if (referrerHash === claimerHash) return res.status(400).json({ error: "Cannot refer yourself" });

    /* Проверяем что у claimer ещё нет реферера */
    const claimerRows = await db.select().from(accountsTable)
      .where(eq(accountsTable.hash, claimerHash)).limit(1);
    if (!claimerRows.length) return res.status(404).json({ error: "Claimer not found" });

    const claimerData = (claimerRows[0].data as Record<string, unknown>) || {};
    if (claimerData['referrer_hash']) {
      return res.status(409).json({ error: "Referral already claimed" });
    }

    /* Транзакция: обновляем обоих */
    await db.transaction(async (tx) => {
      /* Обновляем реферера */
      const refData = (referrerRows[0].data as Record<string, unknown>) || {};
      const newRefCoins  = Math.min(safeCoins(refData['swaip_coins']) + COINS_PER_REFERRAL, MAX_COINS);
      const newRefCount  = (Number(refData['referrals_count']) || 0) + 1;
      await tx.insert(accountsTable)
        .values({ hash: referrerHash, data: { ...refData, swaip_coins: newRefCoins, referrals_count: newRefCount } })
        .onConflictDoUpdate({ target: accountsTable.hash, set: {
          data: { ...refData, swaip_coins: newRefCoins, referrals_count: newRefCount },
          updatedAt: new Date(),
        }});

      /* Обновляем нового пользователя */
      const newClaimerCoins = Math.min(safeCoins(claimerData['swaip_coins']) + COINS_WELCOME, MAX_COINS);
      const updClaimerData  = {
        ...claimerData,
        referrer_hash: referrerHash,
        swaip_coins:   newClaimerCoins,
      };
      await tx.insert(accountsTable)
        .values({ hash: claimerHash, data: updClaimerData })
        .onConflictDoUpdate({ target: accountsTable.hash, set: {
          data: updClaimerData,
          updatedAt: new Date(),
        }});
    });

    return res.json({
      success: true,
      coinsEarned: COINS_WELCOME,
      message: `+${COINS_WELCOME} Свайп-монет начислено!`,
    });
  } catch (e: any) {
    return res.status(500).json({ error: "Server error", detail: e?.message });
  }
});

/*
 * POST /api/coins/award
 * Internal: начисляет монеты текущему пользователю за действие (лайк, пост, и т.д.)
 * Body: { amount: number, reason: string }
 */
router.post("/coins/award", requireSession, async (req, res) => {
  const hash = (req as any).userHash as string;
  const { amount, reason } = req.body as { amount?: number; reason?: string };
  if (!amount || amount <= 0 || amount > 500) {
    return res.status(400).json({ error: "Invalid amount" });
  }
  try {
    const rows = await db.select().from(accountsTable).where(eq(accountsTable.hash, hash)).limit(1);
    if (!rows.length) return res.status(404).json({ error: "Account not found" });
    const d = (rows[0].data as Record<string, unknown>) || {};
    const newCoins = Math.min(safeCoins(d['swaip_coins']) + amount, MAX_COINS);
    const updData = { ...d, swaip_coins: newCoins };
    await db.insert(accountsTable)
      .values({ hash, data: updData })
      .onConflictDoUpdate({ target: accountsTable.hash, set: { data: updData, updatedAt: new Date() } });
    return res.json({ success: true, coinBalance: newCoins, reason });
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
});

/* ── Пинг присутствия — обновляет last_seen_at ── */
router.post("/presence/ping", async (req, res) => {
  const token = getSessionToken(req);
  if (!token) return res.status(401).json({ ok: false });
  try {
    const userHash = await resolveSession(token);
    if (!userHash) return res.status(401).json({ ok: false });
    await db.update(accountsTable)
      .set({ lastSeenAt: new Date() })
      .where(eq(accountsTable.hash, userHash));
    return res.json({ ok: true });
  } catch { return res.status(500).json({ ok: false }); }
});

/* ── Онлайн-статус пользователей ── */
router.get("/online-status", async (req, res) => {
  const raw = req.query['hashes'] as string | undefined;
  if (!raw) return res.json({ statuses: {} });
  const hashes = raw.split(',').map(h => h.trim()).filter(Boolean).slice(0, 50);
  if (!hashes.length) return res.json({ statuses: {} });
  try {
    const rows = await db
      .select({ hash: accountsTable.hash, lastSeenAt: accountsTable.lastSeenAt })
      .from(accountsTable)
      .where(inArray(accountsTable.hash, hashes));
    const now = Date.now();
    const statuses: Record<string, { online: boolean; lastSeenAt: string | null }> = {};
    for (const r of rows) {
      const ls = r.lastSeenAt ? new Date(r.lastSeenAt).getTime() : null;
      const online = ls !== null && (now - ls) < 3 * 60 * 1000; /* онлайн если активен < 3 мин назад */
      statuses[r.hash] = { online, lastSeenAt: r.lastSeenAt ? new Date(r.lastSeenAt).toISOString() : null };
    }
    return res.json({ statuses });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
