import { Router } from "express";

const router = Router();

/* POST /api/translate
 * body: { text: string, from: string, to: string }
 * from/to = ISO 639-1 / Google Translate codes (ru, zh-CN, ja, en, ...)
 * Прокси к бесплатному Google Translate API — обходит CORS браузера
 * Возвращает { translated: string }
 */
router.post("/translate", async (req, res) => {
  const { text, from, to } = req.body as { text?: string; from?: string; to?: string };

  if (!text?.trim()) return res.status(400).json({ error: "empty text" });
  if (!from || !to)   return res.status(400).json({ error: "from/to required" });
  if (from === to)    return res.json({ translated: text });

  const url =
    `https://translate.googleapis.com/translate_a/single` +
    `?client=gtx&sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}&dt=t` +
    `&q=${encodeURIComponent(text)}`;

  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 12; Pixel 6) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/122.0.0.0 Mobile Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(9000),
    });

    if (!r.ok) {
      return res.status(502).json({ error: `google translate status ${r.status}` });
    }

    const d = await r.json() as any[][];
    /* Ответ: [[[фрагмент_перевода, оригинал, ...], ...], ...] */
    const translated = (d[0] as any[])?.map((x: any) => x?.[0] ?? "").join("").trim();
    return res.json({ translated: translated || text });
  } catch (e: any) {
    req.log.error({ err: e }, "translate error");
    return res.status(502).json({ error: e?.message || "translate failed" });
  }
});

export default router;
