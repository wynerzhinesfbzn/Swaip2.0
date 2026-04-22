import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const router = Router();
const DOC_DIR = path.join(process.cwd(), "doc_uploads");
if (!fs.existsSync(DOC_DIR)) fs.mkdirSync(DOC_DIR, { recursive: true });

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

const ALLOWED_EXTS = new Set([
  ".pdf", ".txt", ".doc", ".docx", ".ppt", ".pptx",
  ".xls", ".xlsx", ".csv", ".html", ".htm", ".md",
  ".rtf", ".odt", ".odp", ".ods", ".json", ".xml",
]);

function safeExt(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return ALLOWED_EXTS.has(ext) ? ext : ".bin";
}

function mimeForExt(ext: string): string {
  switch (ext) {
    case ".pdf":  return "application/pdf";
    case ".txt":  return "text/plain; charset=utf-8";
    case ".html": case ".htm": return "text/html; charset=utf-8";
    case ".md":   return "text/markdown; charset=utf-8";
    case ".csv":  return "text/csv; charset=utf-8";
    case ".json": return "application/json";
    case ".xml":  return "application/xml";
    case ".doc":  return "application/msword";
    case ".docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".ppt":  return "application/vnd.ms-powerpoint";
    case ".pptx": return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case ".xls":  return "application/vnd.ms-excel";
    case ".xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case ".odt":  return "application/vnd.oasis.opendocument.text";
    case ".odp":  return "application/vnd.oasis.opendocument.presentation";
    case ".ods":  return "application/vnd.oasis.opendocument.spreadsheet";
    case ".rtf":  return "application/rtf";
    default:      return "application/octet-stream";
  }
}

/* POST /api/doc-upload */
router.post("/doc-upload", async (req: Request, res: Response) => {
  try {
    const buf: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || "");
    if (buf.length > 100 * 1024 * 1024) { res.status(413).json({ error: "File too large (max 100MB)" }); return; }
    if (buf.length === 0) { res.status(400).json({ error: "Empty file" }); return; }

    const rawName = String(req.headers["x-filename"] || "document").replace(/[^a-zA-Z0-9.\-_ ]/g, "");
    const ext = safeExt(rawName);
    const filename = crypto.randomUUID() + ext;
    const objectName = `docs/${filename}`;
    const mime = mimeForExt(ext);

    /* Шаг 1: сохраняем на диск моментально */
    fs.writeFileSync(path.join(DOC_DIR, filename), buf);
    logger.info({ filename, bytes: buf.length }, "doc saved to local disk (fast path)");

    /* Шаг 2: отвечаем сразу */
    res.json({ url: `/api/doc/${filename}` });

    /* Шаг 3: GCS в фоне */
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (bucketId) {
      (async () => {
        try {
          const bucket = getBucket();
          const file = bucket.file(objectName);
          await withTimeout(file.save(buf, { contentType: mime, resumable: false }), 60_000, "gcs.save.doc.bg");
          logger.info({ filename }, "doc uploaded to GCS (background)");
        } catch (e) {
          logger.warn({ err: e, filename }, "GCS doc background upload failed — stays on local disk");
        }
      })();
    }
  } catch (err) {
    logger.error({ err }, "docUpload unexpected error");
    res.status(500).json({ error: "Upload failed" });
  }
});

/* GET /api/doc/:filename */
router.get("/doc/:filename", async (req: Request, res: Response) => {
  const filename = String(req.params["filename"]).replace(/[^a-zA-Z0-9.\-_]/g, "");
  const objectName = `docs/${filename}`;
  const ext  = path.extname(filename).toLowerCase();
  const mime = mimeForExt(ext);

  /* Попытка из GCS */
  try {
    const bucket = getBucket();
    const file = bucket.file(objectName);
    const [exists] = await withTimeout(file.exists(), 5_000, "gcs.exists.doc");
    if (exists) {
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
      res.setHeader("Content-Type", mime);
      res.setHeader("Cache-Control", "public, max-age=86400");
      file.createReadStream().pipe(res);
      return;
    }
  } catch { /* GCS недоступен */ }

  /* Fallback: локальный диск */
  const diskDirs = [DOC_DIR, path.join("/tmp", "swaip_uploads", "doc_uploads")];
  for (const dir of diskDirs) {
    const filepath = path.join(dir, filename);
    if (fs.existsSync(filepath)) {
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
      res.setHeader("Content-Type", mime);
      res.setHeader("Cache-Control", "public, max-age=86400");
      fs.createReadStream(filepath).pipe(res);
      return;
    }
  }

  res.status(404).json({ error: "Not found" });
});

export default router;
