import { Router } from "express";
import { Readable } from "stream";

const router = Router();

const CORE_MAP: Record<string, string> = {
  mupen64plus2: "n64",
  "mupen64plus-nx": "n64",
  mupen64plus_next: "n64",
  mame0243: "mame2003",
  "mame0.243": "mame2003",
  mesen: "nes",
  melonds: "nds",
};

function mapCore(core: string): string {
  return CORE_MAP[core] ?? core;
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

router.get("/game-player", async (req, res): Promise<void> => {
  const id = req.query.id as string;
  if (!id || !/^\d+$/.test(id)) {
    res.status(400).send("Invalid game ID");
    return;
  }

  try {
    const embedRes = await fetch(
      `https://www.retrogames.cc/embed/${id}-x.html`,
      {
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
          "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
          Referer: "https://www.retrogames.cc/",
        },
      }
    );

    if (!embedRes.ok) {
      res.status(404).send("Game not found");
      return;
    }

    const html = await embedRes.text();

    const gameUrlMatch = html.match(/EJS_gameUrl\s*=\s*['"]([^'"]+)['"]/);
    const coreMatch = html.match(/EJS_core\s*=\s*['"]([^'"]+)['"]/);

    if (!gameUrlMatch || !coreMatch) {
      res.status(404).send("Game config not found");
      return;
    }

    const romUrl = gameUrlMatch[1];
    const rawCore = coreMatch[1];
    const core = mapCore(rawCore);
    const encodedRomUrl = encodeURIComponent(romUrl);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("X-Frame-Options", "ALLOWALL");
    res.setHeader(
      "Content-Security-Policy",
      [
        "default-src 'self' https://cdn.emulatorjs.org",
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.emulatorjs.org",
        "style-src 'self' 'unsafe-inline' https://cdn.emulatorjs.org",
        "img-src 'self' data: blob: https:",
        "media-src 'self' blob: https:",
        "connect-src 'self' https://cdn.emulatorjs.org https://filesus3.retrogames.cc https://filesus.retrogames.cc https:",
        "worker-src 'self' blob: https://cdn.emulatorjs.org",
        "frame-ancestors *",
      ].join("; ")
    );
    res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:100%;height:100%;background:#000;overflow:hidden}
  #game{width:100%;height:100%}
</style>
</head>
<body>
<div id="game"></div>
<script>
  window.EJS_player = '#game';
  window.EJS_core = '${core}';
  window.EJS_gameUrl = '/api/game-rom-proxy?url=${encodedRomUrl}';
  window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
  window.EJS_startOnLoaded = true;
  window.EJS_volume = 0.5;
  window.EJS_Buttons = {
    loadState: false,
    saveState: false,
    screenRecord: false,
    gamepad: true,
    mute: true,
    settings: true,
    fullscreen: true,
    cheat: false
  };
</script>
<script src="https://cdn.emulatorjs.org/stable/data/loader.js"></script>
</body>
</html>`);
  } catch (err) {
    req.log.error({ err }, "game-player: fetch error");
    res.status(500).send("Error loading game");
  }
});

router.get("/game-rom-proxy", async (req, res): Promise<void> => {
  const url = req.query.url as string;
  if (!url) {
    res.status(400).send("Missing url");
    return;
  }

  let decodedUrl: string;
  try {
    decodedUrl = decodeURIComponent(url);
    new URL(decodedUrl);
  } catch {
    res.status(400).send("Invalid URL");
    return;
  }

  try {
    const romRes = await fetch(decodedUrl, {
      headers: {
        "User-Agent": BROWSER_UA,
        Referer: "https://www.retrogames.cc/",
        Origin: "https://www.retrogames.cc",
        Accept: "*/*",
      },
    });

    if (!romRes.ok) {
      res.status(romRes.status).send("ROM unavailable");
      return;
    }

    const ct = romRes.headers.get("content-type") ?? "application/octet-stream";
    const cl = romRes.headers.get("content-length");

    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (cl) res.setHeader("Content-Length", cl);

    if (romRes.body) {
      Readable.fromWeb(romRes.body as Parameters<typeof Readable.fromWeb>[0]).pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    req.log.error({ err }, "game-rom-proxy: fetch error");
    res.status(500).send("Error fetching ROM");
  }
});

export default router;
