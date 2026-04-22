import { Router } from "express";

const router = Router();

/* GET /api/tts?text=...&lang=ru-RU
 * Прокси к Google Translate TTS — обходит CORS, отдаёт MP3 */
router.get("/api/tts", async (req, res) => {
  const text = String(req.query["text"] || "").slice(0, 500);
  const lang = String(req.query["lang"] || "ru-RU").slice(0, 20);

  if (!text.trim()) return res.status(400).json({ error: "empty text" });

  const url =
    `https://translate.google.com/translate_tts` +
    `?ie=UTF-8` +
    `&q=${encodeURIComponent(text)}` +
    `&tl=${encodeURIComponent(lang)}` +
    `&client=tw-ob` +
    `&ttsspeed=0.9`;

  try {
    const upstream = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 12; Pixel 6) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/122.0.0.0 Mobile Safari/537.36",
        "Referer": "https://translate.google.com/",
        "Accept": "audio/mpeg, audio/*; q=0.9, */*; q=0.5",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      return res.status(502).json({ error: "google tts failed", status: upstream.status });
    }

    const ct = upstream.headers.get("content-type") || "audio/mpeg";
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const buf = await upstream.arrayBuffer();
    return res.send(Buffer.from(buf));
  } catch (e: any) {
    return res.status(502).json({ error: e?.message || "upstream error" });
  }
});

export default router;
