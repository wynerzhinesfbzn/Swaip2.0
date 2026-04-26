import { Router, type IRouter } from "express";
import dns from "node:dns/promises";
import net from "node:net";

const router: IRouter = Router();

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) return true;
    const [a, b] = parts as [number, number, number, number];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === "::1" || lower === "::") return true;
    if (lower.startsWith("fe80:")) return true;
    if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
    if (lower.startsWith("::ffff:")) {
      const v4 = lower.slice(7);
      if (net.isIPv4(v4)) return isPrivateIp(v4);
    }
    return false;
  }
  return true;
}

async function isHostSafe(hostname: string): Promise<boolean> {
  if (!hostname) return false;
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower.endsWith(".localhost")) return false;
  if (lower.endsWith(".internal") || lower.endsWith(".local")) return false;
  if (net.isIP(lower)) return !isPrivateIp(lower);
  try {
    const records = await dns.lookup(lower, { all: true });
    if (!records.length) return false;
    for (const r of records) if (isPrivateIp(r.address)) return false;
    return true;
  } catch {
    return false;
  }
}

const META_RE = (name: string) =>
  new RegExp(
    `<meta\\s+(?:[^>]*?\\s+)?(?:property|name)=["']${name}["']\\s+(?:[^>]*?\\s+)?content=["']([^"']*)["']`,
    "i",
  );
const META_RE_REV = (name: string) =>
  new RegExp(
    `<meta\\s+(?:[^>]*?\\s+)?content=["']([^"']*)["']\\s+(?:[^>]*?\\s+)?(?:property|name)=["']${name}["']`,
    "i",
  );
const TITLE_RE = /<title[^>]*>([^<]+)<\/title>/i;

function pick(html: string, name: string): string | undefined {
  return html.match(META_RE(name))?.[1] || html.match(META_RE_REV(name))?.[1];
}

function decodeEntities(s: string | undefined): string | undefined {
  if (!s) return s;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function absUrl(maybe: string | undefined, base: string): string | undefined {
  if (!maybe) return undefined;
  try {
    return new URL(maybe, base).toString();
  } catch {
    return undefined;
  }
}

router.get("/link-preview", async (req, res) => {
  const url = String(req.query.url || "").trim();
  if (!url || !/^https?:\/\//i.test(url)) {
    res.status(400).json({ error: "invalid url" });
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: "invalid url" });
    return;
  }
  if (!(await isHostSafe(parsed.hostname))) {
    res.status(400).json({ error: "blocked host" });
    return;
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; SwaipBot/1.0; +https://swaip.app)",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });
    clearTimeout(timer);
    if (!r.ok) {
      res.json({ url });
      return;
    }
    const ct = r.headers.get("content-type") || "";
    if (!ct.includes("html")) {
      res.json({ url });
      return;
    }
    const buf = await r.arrayBuffer();
    const html = new TextDecoder("utf-8", { fatal: false })
      .decode(buf)
      .slice(0, 200_000);
    const title =
      decodeEntities(pick(html, "og:title")) ||
      decodeEntities(pick(html, "twitter:title")) ||
      decodeEntities(html.match(TITLE_RE)?.[1]?.trim());
    const description =
      decodeEntities(pick(html, "og:description")) ||
      decodeEntities(pick(html, "twitter:description")) ||
      decodeEntities(pick(html, "description"));
    const image = absUrl(
      pick(html, "og:image") ||
        pick(html, "twitter:image") ||
        pick(html, "twitter:image:src"),
      r.url,
    );
    const siteName = decodeEntities(pick(html, "og:site_name"));
    res.json({
      url: r.url,
      title: title?.slice(0, 200),
      description: description?.slice(0, 400),
      image,
      siteName: siteName?.slice(0, 100),
    });
  } catch {
    res.json({ url });
  }
});

export default router;
