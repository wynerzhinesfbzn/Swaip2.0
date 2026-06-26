import { Router } from "express";
import { logger } from "../lib/logger.js";

const router = Router();

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchHtml(url: string, timeout = 10000): Promise<string> {
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'ru-RU,ru;q=0.9', 'Accept': 'text/html,*/*;q=0.8' },
    signal: AbortSignal.timeout(timeout),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.text();
}

/* ── Embed builder for Rutube ── */
function rtEmbed(id: string): string {
  return `https://rutube.ru/play/embed/${id}/?autoplay=true`;
}

/* ─────────────────────────────────────────────────────────
   RUSSIAN → LATIN TRANSLITERATION (matches karaokehit.ru)
   Based on observed URL patterns:
     ДДТ → ddt, Михаил Круг → mikhail-krug,
     Это всё → eto-vse (ё→e), Девочка-пай → devochka-pai
   ──────────────────────────────────────────────────────── */
const TRANSLIT: Record<string, string> = {
  'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh',
  'з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o',
  'п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts',
  'ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
};

function ruToSlug(s: string): string {
  return s.toLowerCase()
    .split('').map(c => {
      if (TRANSLIT[c] !== undefined) return TRANSLIT[c];
      if (/[a-z0-9]/.test(c)) return c;
      if (c === ' ' || c === '-' || c === '_') return '-';
      return '';
    })
    .join('')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/* ─────────────────────────────────────────────────────────
   KARAOKEHIT.RU SITEMAP CACHE
   Loads catalog sitemap once per hour.
   URLs like: https://karaokehit.ru/catalog/rock/ddt-eto-vse/
   ──────────────────────────────────────────────────────── */
let sitemapUrls: string[] = [];
let sitemapLoadedAt = 0;
const SITEMAP_TTL = 3600_000; // 1 hour

async function loadSitemap(): Promise<void> {
  const now = Date.now();
  if (sitemapUrls.length > 0 && now - sitemapLoadedAt < SITEMAP_TTL) return;
  try {
    const r = await fetch('https://karaokehit.ru/sitemap-iblock-33.xml', {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok) throw new Error(`sitemap HTTP ${r.status}`);
    const xml = await r.text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map(m => m[1])
      .filter(u => u.includes('/catalog/'));
    if (urls.length > 0) {
      sitemapUrls = urls;
      sitemapLoadedAt = Date.now();
      logger.info({ count: urls.length }, 'karaokehit.ru sitemap cached');
    }
  } catch (e) {
    logger.warn({ err: e }, 'Failed to load karaokehit.ru sitemap');
  }
}

// Kick off sitemap load on server start (non-blocking)
loadSitemap().catch(() => {});

/* ── Extract direct CDN video URL from karaokehit.ru song page ── */
async function extractKaraokehitVideoUrl(pageUrl: string): Promise<string | null> {
  try {
    const html = await fetchHtml(pageUrl, 14000);
    // <source src="https://cdn.karaokehit.ru/ДДТ - Это всё.mp4" type="video/mp4">
    const m = html.match(/<source[^>]+src="(https?:\/\/cdn\.karaokehit\.ru\/[^"]+)"/i);
    if (m?.[1]) return m[1];
    // fallback: any cdn.karaokehit.ru mp4 link
    const m2 = html.match(/"(https?:\/\/cdn\.karaokehit\.ru\/[^"]+\.mp4[^"]*)"/i);
    if (m2?.[1]) return m2[1];
    return null;
  } catch {
    return null;
  }
}

/* ── Search karaokehit.ru sitemap for matching song page URL ── */
async function searchKaraokehit(artist: string, title: string): Promise<string | null> {
  await loadSitemap();
  if (!sitemapUrls.length) return null;

  const artistSlug = ruToSlug(artist);
  const titleSlug  = ruToSlug(title);

  // Split into words; artist words weighted 2x, title words 1x
  const artistWords = artistSlug.split('-').filter(w => w.length > 1);
  const titleWords  = titleSlug.split('-').filter(w => w.length > 2).slice(0, 4);

  let best: string | null = null;
  let bestScore = 0;

  for (const url of sitemapUrls) {
    // path segment after /catalog/genre/ e.g. "ddt-eto-vse"
    const pathParts = url.split('/catalog/');
    if (pathParts.length < 2) continue;
    const seg = pathParts[1]; // "rock/ddt-eto-vse/"

    let score = 0;
    for (const w of artistWords) {
      if (seg.includes(w)) score += 2;
    }
    for (const w of titleWords) {
      if (seg.includes(w)) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      best = url;
    }
  }

  // Require at least the artist's first word to match
  const minScore = artistWords.length > 0 ? 2 : 1;
  return bestScore >= minScore ? best : null;
}

/* ── Rutube search — strict artist-aware matching ── */
async function searchRutube(artist: string, title: string): Promise<{ embedUrl: string; thumb: string | null } | null> {
  const artistLow = artist.toLowerCase();
  // Use first two words of artist for matching (handles "Михаил Круг" → ["михаил","круг"])
  const artistWords = artistLow.split(/\s+/).slice(0, 2).filter(w => w.length > 1);

  const queries = [
    `${artist} ${title} каракоке`,
    `${artist} ${title} минус`,
    `${artist} ${title}`,
  ];

  for (const q of queries) {
    try {
      const r = await fetch(
        `https://rutube.ru/api/search/video/?query=${encodeURIComponent(q)}&format=json&page=1`,
        { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) }
      );
      if (!r.ok) continue;
      const data: any = await r.json();
      const results: any[] = data.results || [];
      if (!results.length) continue;

      // Must contain at least one artist word in the video title
      const best = results.find((v: any) => {
        const t = (v.title || '').toLowerCase();
        return artistWords.some(w => t.includes(w));
      }) || null;

      if (!best) continue;
      const vid = best.id || best.video_id || '';
      if (!vid) continue;
      return { embedUrl: rtEmbed(vid), thumb: best.thumbnail_url || null };
    } catch { /* try next */ }
  }
  return null;
}

/* ── Static fallback charts ── */
const STATIC_CHARTS = [
  { pos: 1,  artist: 'Михаил Шуфутинский', title: '3-е сентября' },
  { pos: 2,  artist: 'Алла Пугачёва',      title: 'Миллион алых роз' },
  { pos: 3,  artist: 'Руки Вверх',         title: 'Крошка Моя' },
  { pos: 4,  artist: 'Ирина Аллегрова',    title: 'Императрица' },
  { pos: 5,  artist: 'Виктор Цой',         title: 'Группа крови' },
  { pos: 6,  artist: 'Земфира',            title: 'Прости меня моя любовь' },
  { pos: 7,  artist: 'Григорий Лепс',      title: 'Рюмка водки на столе' },
  { pos: 8,  artist: 'Дима Билан',         title: 'Невозможное возможно' },
  { pos: 9,  artist: 'Филипп Киркоров',    title: 'Цвет настроения синий' },
  { pos: 10, artist: 'Валерий Меладзе',    title: 'Красиво' },
  { pos: 11, artist: 'Ария',               title: 'Герой асфальта' },
  { pos: 12, artist: 'Кино',               title: 'Звезда по имени Солнце' },
  { pos: 13, artist: 'Наутилус Помпилиус', title: 'Скованные одной цепью' },
  { pos: 14, artist: 'Синяя Птица',        title: 'Там Где Клён Шумит' },
  { pos: 15, artist: 'Тимати',             title: 'Лондон' },
  { pos: 16, artist: 'Люся Чеботина',      title: 'Солнце' },
  { pos: 17, artist: 'NILETTO',            title: 'Любимка' },
  { pos: 18, artist: 'Клава Кока',         title: 'Привет' },
  { pos: 19, artist: 'Artik & Asti',       title: 'Тебя любить' },
  { pos: 20, artist: 'Баста',              title: 'Моя игра' },
];

/* ═════════════════════════════════════════════════════
   GET /api/karaoke/charts
   ═════════════════════════════════════════════════════ */
router.get('/charts', async (_req, res) => {
  try {
    const [topHtml, newHtml] = await Promise.all([
      fetchHtml('https://karaosha.ru/karaoke/top/', 10000),
      fetchHtml('https://karaosha.ru/karaoke/new/', 10000),
    ]);

    const parseTracks = (html: string, limit = 20) => {
      const out: { pos: number; artist: string; title: string }[] = [];
      const blockRe = /<div class="track">([\s\S]*?)(?=<div class="track"|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/section|$)/g;
      let m: RegExpExecArray | null;
      while ((m = blockRe.exec(html)) !== null && out.length < limit) {
        const block = m[1];
        const posM    = block.match(/class="index[^"]*"[^>]*>(\d+)/);
        const artistM = block.match(/class="[^"]*performer[^"]*"[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
        const titleM  = block.match(/class="[^"]*song[^"]*"[\s\S]*?<a[^>]*>([^<]+)<\/a>/);
        if (artistM && titleM) {
          out.push({
            pos: posM ? parseInt(posM[1]) : out.length + 1,
            artist: artistM[1].trim(),
            title: titleM[1].trim(),
          });
        }
      }
      return out;
    };

    const top = parseTracks(topHtml, 20);
    const newSongs = parseTracks(newHtml, 10);
    res.json(top.length > 0 ? { top, new: newSongs } : { top: STATIC_CHARTS, new: [] });
  } catch (e) {
    logger.warn({ err: e }, 'charts fetch failed, using static');
    res.json({ top: STATIC_CHARTS, new: [] });
  }
});

/* ═════════════════════════════════════════════════════
   GET /api/karaoke/khit-embed?artist=X&title=Y
   1. karaokehit.ru sitemap → embed their page directly (JS renders video)
   2. Rutube                → strict artist-matched fallback
   No YouTube. No karaopa2.ru (always returned wrong video).
   ═════════════════════════════════════════════════════ */
router.get('/khit-embed', async (req, res) => {
  const artist = String(req.query.artist || '').trim();
  const title  = String(req.query.title  || '').trim();
  if (!artist && !title) { res.json({ embedUrl: null, thumb: null }); return; }

  logger.info({ artist, title }, 'karaoke embed search');

  /* 1. karaokehit.ru — find song page URL from sitemap, then extract direct CDN video URL */
  const khitUrl = await searchKaraokehit(artist, title);
  if (khitUrl) {
    const videoUrl = await extractKaraokehitVideoUrl(khitUrl);
    if (videoUrl) {
      logger.info({ artist, title, videoUrl, src: 'karaokehit-cdn' }, 'direct video URL extracted from karaokehit.ru');
      res.json({ videoUrl, embedUrl: null, thumb: null, source: 'karaokehit' });
      return;
    }
    /* Fallback: page extraction failed — embed page as iframe */
    logger.info({ artist, title, url: khitUrl, src: 'karaokehit-iframe' }, 'embed found via karaokehit.ru (iframe fallback)');
    res.json({ videoUrl: null, embedUrl: khitUrl, thumb: null, source: 'karaokehit' });
    return;
  }

  /* 2. Rutube — artist-strict fallback */
  const rt = await searchRutube(artist, title);
  if (rt?.embedUrl) {
    logger.info({ artist, title, src: 'rutube' }, 'embed found via Rutube');
    res.json({ embedUrl: rt.embedUrl, thumb: rt.thumb, source: 'rutube' });
    return;
  }

  logger.info({ artist, title }, 'no embed found');
  res.json({ embedUrl: null, thumb: null });
});

/* ── GET /api/karaoke/search?q=query ── */
router.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) { res.json({ results: [] }); return; }
  try {
    const r = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`,
      { headers: { 'Lrclib-Client': 'SWAP/2.0' }, signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) { res.json({ results: [] }); return; }
    const data = await r.json() as any[];
    const results = (data || [])
      .filter((t: any) => t.syncedLyrics || t.plainLyrics)
      .slice(0, 30)
      .map((t: any) => ({
        id: t.id, artist: t.artistName || '', title: t.trackName || '',
        album: t.albumName || '', duration: t.duration || 0,
        hasSynced: Boolean(t.syncedLyrics),
      }));
    res.json({ results });
  } catch { res.json({ results: [] }); }
});

/* ── GET /api/karaoke/lyrics/:id ── */
router.get('/lyrics/:id', async (req, res) => {
  const id = encodeURIComponent(req.params.id);
  try {
    const r = await fetch(`https://lrclib.net/api/get/${id}`, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) { res.status(404).json({ error: 'not found' }); return; }
    const data: any = await r.json();
    res.json({
      id: data.id, artist: data.artistName, title: data.trackName,
      album: data.albumName, duration: data.duration,
      syncedLyrics: data.syncedLyrics || '', plainLyrics: data.plainLyrics || '',
    });
  } catch { res.status(500).json({ error: 'server error' }); }
});

/* ── GET /api/karaoke/artists?q=prefix ── */
router.get('/artists', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q || q.length < 2) { res.json({ artists: [] }); return; }
  try {
    const r = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(q)}`,
      { headers: { 'Lrclib-Client': 'SWAP/2.0' }, signal: AbortSignal.timeout(6000) }
    );
    const data = (r.ok ? await r.json() : []) as any[];
    const seen = new Set<string>();
    const artists: string[] = [];
    for (const t of data) {
      const a = (t.artistName || '').trim();
      if (a && !seen.has(a.toLowerCase()) && a.toLowerCase().includes(q.toLowerCase())) {
        seen.add(a.toLowerCase()); artists.push(a);
        if (artists.length >= 8) break;
      }
    }
    res.json({ artists });
  } catch { res.json({ artists: [] }); }
});

/* ── GET /api/karaoke/audio (Rutube fallback for listen-together) ── */
router.get('/audio', async (req, res) => {
  const artist = String(req.query.artist || '').trim();
  const title  = String(req.query.title  || '').trim();
  const result = await searchRutube(artist, title);
  res.json({ embedUrl: result?.embedUrl || null });
});

export default router;
