import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router = Router();
const VID_DIR = path.join(process.cwd(), "video_uploads");
const TMP_DIR = path.join(process.cwd(), "video_uploads_tmp");
if (!fs.existsSync(VID_DIR)) fs.mkdirSync(VID_DIR, { recursive: true });
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

const uploads = new Map<string, { ext: string; mime: string; totalChunks: number; received: Set<number> }>();

function getBucket() {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID not set");
  return objectStorageClient.bucket(bucketId);
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout(${ms}ms): ${label}`)), ms)
    ),
  ]);
}

function resolveVideo(ct: string, filename = ""): { ext: string; mime: string } {
  const nameExt = path.extname(filename).toLowerCase();
  if (nameExt === ".webm") return { ext: ".webm", mime: "video/webm" };
  if (nameExt === ".ogv")  return { ext: ".ogv",  mime: "video/ogg" };
  if (nameExt === ".avi")  return { ext: ".avi",  mime: "video/x-msvideo" };
  if (nameExt === ".mkv")  return { ext: ".mkv",  mime: "video/x-matroska" };
  if (nameExt === ".3gp")  return { ext: ".3gp",  mime: "video/3gpp" };
  if (nameExt === ".mov")  return { ext: ".mov",  mime: "video/mp4" };
  if (nameExt === ".mp4")  return { ext: ".mp4",  mime: "video/mp4" };

  const t = ct.toLowerCase();
  if (t.includes("webm"))                             return { ext: ".webm", mime: "video/webm" };
  if (t.includes("ogg"))                              return { ext: ".ogv",  mime: "video/ogg" };
  if (t.includes("quicktime") || t.includes("mov"))   return { ext: ".mov",  mime: "video/mp4" };
  if (t.includes("x-msvideo") || t.includes("avi"))   return { ext: ".avi",  mime: "video/x-msvideo" };
  if (t.includes("x-matroska") || t.includes("mkv"))  return { ext: ".mkv",  mime: "video/x-matroska" };
  if (t.includes("3gp"))                              return { ext: ".3gp",  mime: "video/3gpp" };
  return { ext: ".mp4", mime: "video/mp4" };
}

function mimeByExt(ext: string): string {
  switch (ext) {
    case ".webm": return "video/webm";
    case ".ogv":  return "video/ogg";
    case ".avi":  return "video/x-msvideo";
    case ".mkv":  return "video/x-matroska";
    case ".3gp":  return "video/3gpp";
    default:      return "video/mp4";
  }
}

async function saveVideoToStorage(buf: Buffer, filename: string, mime: string): Promise<void> {
  const objectName = `videos/${filename}`;
  try {
    const bucket = getBucket();
    const file = bucket.file(objectName);
    await withTimeout(
      file.save(buf, { contentType: mime, resumable: false }),
      60_000,
      "gcs.save.video"
    );
    logger.info({ filename, bytes: buf.length }, "video saved to GCS");
  } catch (gcsErr) {
    logger.warn({ err: gcsErr, filename }, "GCS video upload failed, falling back to local disk");
    const dirs = [VID_DIR, path.join("/tmp", "swaip_uploads", "video_uploads")];
    for (const dir of dirs) {
      try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, filename), buf);
        logger.info({ dir, filename }, "video saved to local disk");
        return;
      } catch (e) {
        logger.warn({ dir, err: e }, "local disk write failed");
      }
    }
    throw new Error("All video storage paths failed");
  }
}

/* POST /api/video-upload/init */
router.post("/video-upload/init", (req: Request, res: Response) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString("utf8")) : req.body;
    const { filename = "", totalChunks = 1 } = rawBody as { filename?: string; totalChunks?: number };
    const rawCt = (req.headers["content-type"] || "video/mp4").split(";")[0].trim();
    const { ext, mime } = resolveVideo(rawCt, filename);
    const uploadId = crypto.randomUUID();
    uploads.set(uploadId, { ext, mime, totalChunks: Number(totalChunks), received: new Set() });
    fs.mkdirSync(path.join(TMP_DIR, uploadId), { recursive: true });
    res.json({ uploadId });
  } catch {
    res.status(500).json({ error: "init failed" });
  }
});

/* POST /api/video-upload/chunk */
router.post("/video-upload/chunk", (req: Request, res: Response) => {
  try {
    const uploadId   = String(req.headers["x-upload-id"]    || "");
    const chunkIndex = parseInt(String(req.headers["x-chunk-index"] || "0"), 10);
    const info = uploads.get(uploadId);
    if (!info) { res.status(400).json({ error: "unknown uploadId" }); return; }

    const buf: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
    if (buf.length === 0) { res.status(400).json({ error: "empty chunk" }); return; }

    const chunkPath = path.join(TMP_DIR, uploadId, `chunk_${String(chunkIndex).padStart(6, "0")}`);
    fs.writeFileSync(chunkPath, buf);
    info.received.add(chunkIndex);
    res.json({ ok: true, received: info.received.size });
  } catch {
    res.status(500).json({ error: "chunk failed" });
  }
});

/* POST /api/video-upload/finalize */
router.post("/video-upload/finalize", async (req: Request, res: Response) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString("utf8")) : req.body;
    const { uploadId } = rawBody as { uploadId: string };
    if (!uploadId) { res.status(400).json({ error: "missing uploadId" }); return; }

    const chunkDir = path.join(TMP_DIR, uploadId);
    const info = uploads.get(uploadId) ?? (
      fs.existsSync(chunkDir)
        ? { ext: ".webm", mime: "video/webm", totalChunks: 0, received: new Set<number>() }
        : null
    );
    if (!info) { res.status(400).json({ error: "unknown uploadId" }); return; }
    if (!fs.existsSync(chunkDir)) { res.status(400).json({ error: "chunks directory missing" }); return; }

    const chunks = fs.readdirSync(chunkDir).filter(f => f.startsWith("chunk_")).sort();
    if (chunks.length === 0) { res.status(400).json({ error: "no chunks" }); return; }

    const filename = crypto.randomUUID() + info.ext;

    /* Собираем чанки в буфер */
    const parts: Buffer[] = [];
    for (const chunk of chunks) {
      parts.push(fs.readFileSync(path.join(chunkDir, chunk)));
    }
    const assembled = Buffer.concat(parts);

    /* Cleanup temp */
    try { fs.rmSync(chunkDir, { recursive: true, force: true }); } catch {}
    uploads.delete(uploadId);

    /* Шаг 1: сразу сохраняем на локальный диск (быстро) */
    const localPath = path.join(VID_DIR, filename);
    fs.writeFileSync(localPath, assembled);
    logger.info({ filename, bytes: assembled.length }, "video saved to local disk (fast path)");

    /* Шаг 2: отвечаем клиенту немедленно — не ждём GCS */
    res.json({ url: `/api/video/${filename}`, mime: info.mime });

    /* Шаг 3: загружаем в GCS в фоне (не блокирует ответ) */
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (bucketId) {
      (async () => {
        try {
          const bucket = objectStorageClient.bucket(bucketId);
          const file = bucket.file(`videos/${filename}`);
          await withTimeout(
            file.save(assembled, { contentType: info.mime, resumable: false }),
            120_000,
            "gcs.save.video.bg"
          );
          logger.info({ filename, bytes: assembled.length }, "video uploaded to GCS (background)");
        } catch (e) {
          logger.warn({ err: e, filename }, "GCS background video upload failed — file stays on local disk");
        }
      })();
    }
  } catch (err) {
    logger.error({ err }, "finalize error");
    res.status(500).json({ error: "finalize failed" });
  }
});

/* POST /api/video-upload — прямая загрузка (≤ 200MB) */
router.post("/video-upload", async (req: Request, res: Response) => {
  try {
    const buf: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
    if (buf.length > 200 * 1024 * 1024) { res.status(413).json({ error: "File too large (max 200MB)" }); return; }
    if (buf.length === 0) { res.status(400).json({ error: "Empty file" }); return; }

    const rawCt = (req.headers["content-type"] || "video/mp4").split(";")[0].trim();
    const clientFilename = String(req.headers["x-filename"] || "").replace(/[^a-zA-Z0-9.\-_ ]/g, "");
    const { ext, mime } = resolveVideo(rawCt, clientFilename);
    const filename = crypto.randomUUID() + ext;

    /* Шаг 1: диск → ответ немедленно */
    fs.writeFileSync(path.join(VID_DIR, filename), buf);
    logger.info({ filename, bytes: buf.length }, "video saved to local disk (direct, fast path)");
    res.json({ url: `/api/video/${filename}`, mime });

    /* Шаг 2: GCS в фоне */
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (bucketId) {
      (async () => {
        try {
          const bucket = objectStorageClient.bucket(bucketId);
          const file = bucket.file(`videos/${filename}`);
          await withTimeout(file.save(buf, { contentType: mime, resumable: false }), 120_000, "gcs.save.video.direct.bg");
          logger.info({ filename }, "video uploaded to GCS (direct, background)");
        } catch (e) {
          logger.warn({ err: e, filename }, "GCS direct video background upload failed");
        }
      })();
    }
  } catch {
    res.status(500).json({ error: "Upload failed" });
  }
});

/* GET /api/video/:filename — с Range-поддержкой */
router.get("/video/:filename", async (req: Request, res: Response) => {
  const filename = String(req.params["filename"]).replace(/[^a-zA-Z0-9.\-_]/g, "");
  const objectName = `videos/${filename}`;
  const ext  = path.extname(filename).toLowerCase();
  const mime = mimeByExt(ext);

  /* Попытка из GCS */
  try {
    const bucket = getBucket();
    const file = bucket.file(objectName);
    const [exists] = await withTimeout(file.exists(), 5_000, "gcs.exists.video");
    if (exists) {
      const [meta] = await file.getMetadata();
      const total = Number(meta.size) || 0;
      const rangeHeader = req.headers["range"];
      res.setHeader("Content-Type", mime);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=86400");
      if (rangeHeader && total > 0) {
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end   = parts[1] ? parseInt(parts[1], 10) : total - 1;
        res.status(206);
        res.setHeader("Content-Range",  `bytes ${start}-${end}/${total}`);
        res.setHeader("Content-Length", end - start + 1);
        file.createReadStream({ start, end }).pipe(res);
      } else {
        if (total > 0) res.setHeader("Content-Length", total);
        file.createReadStream().pipe(res);
      }
      return;
    }
  } catch { /* GCS недоступен — fallback */ }

  /* Fallback: локальный диск */
  const diskDirs = [VID_DIR, path.join("/tmp", "swaip_uploads", "video_uploads")];
  for (const dir of diskDirs) {
    const filepath = path.join(dir, filename);
    if (fs.existsSync(filepath)) {
      const stat  = fs.statSync(filepath);
      const total = stat.size;
      res.setHeader("Content-Type", mime);
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=86400");
      const rangeHeader = req.headers["range"];
      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end   = parts[1] ? parseInt(parts[1], 10) : total - 1;
        res.status(206);
        res.setHeader("Content-Range",  `bytes ${start}-${end}/${total}`);
        res.setHeader("Content-Length", end - start + 1);
        fs.createReadStream(filepath, { start, end }).pipe(res);
      } else {
        res.setHeader("Content-Length", total);
        fs.createReadStream(filepath).pipe(res);
      }
      return;
    }
  }

  res.status(404).json({ error: "Not found" });
});

export default router;
