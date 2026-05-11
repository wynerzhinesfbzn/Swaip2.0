import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFile } from "child_process";
import { promisify } from "util";
import { objectStorageClient } from "../lib/objectStorage";
import { logger } from "../lib/logger";

const execFileAsync = promisify(execFile);

const router = Router();
const AUDIO_DIR = path.join(process.cwd(), "audio_uploads");
if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });

const TMP_DIR = path.join(process.cwd(), "audio_tmp");
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

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

function getInputExt(ct: string, originalName?: string): string {
  const c = ct.toLowerCase();
  if (c.includes("ogg")) return ".ogg";
  if (c.includes("mp4") || c.includes("m4a") || c.includes("aac")) return ".m4a";
  if (c.includes("mpeg") || c.includes("mp3")) return ".mp3";
  if (c.includes("wav") || c.includes("wave")) return ".wav";
  if (c.includes("flac")) return ".flac";
  if (c.includes("opus")) return ".opus";
  if (c.includes("wma") || c.includes("x-ms-wma")) return ".wma";
  if (c.includes("aiff")) return ".aiff";
  if (originalName) {
    const ext = path.extname(originalName).toLowerCase();
    if ([".mp3",".wav",".ogg",".m4a",".aac",".flac",".opus",".wma",".aiff",".webm",
         ".mp4",".mkv",".avi",".mov",".3gp",".amr",".caf"].includes(ext)) return ext;
  }
  return ".tmp";
}

/* Транскодируем любой аудио/видео файл в MP3 через ffmpeg */
async function transcodeToMp3(inputPath: string, outputPath: string): Promise<void> {
  await execFileAsync("ffmpeg", [
    "-y",
    "-i", inputPath,
    "-vn",
    "-acodec", "libmp3lame",
    "-q:a", "2",
    "-ar", "44100",
    "-ac", "2",
    outputPath
  ], { timeout: 120_000 });
}

/* POST /api/audio-upload */
router.post("/audio-upload", async (req: Request, res: Response) => {
  let tmpInput: string | null = null;
  try {
    const buf: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    if (buf.length > 300 * 1024 * 1024) { res.status(413).json({ error: "Файл слишком большой (макс. 300МБ)" }); return; }
    if (buf.length === 0) { res.status(400).json({ error: "Пустой файл" }); return; }

    const ct = (req.headers["content-type"] || "application/octet-stream").split(";")[0].trim();
    const originalName = req.headers["x-filename"] as string | undefined;
    const inputExt = getInputExt(ct, originalName);

    const uid = crypto.randomUUID();
    tmpInput = path.join(TMP_DIR, `${uid}${inputExt}`);
    const mp3Filename = `${uid}.mp3`;
    const mp3Path = path.join(AUDIO_DIR, mp3Filename);

    /* Шаг 1: записываем входной файл во временную папку */
    fs.writeFileSync(tmpInput, buf);
    logger.info({ inputExt, bytes: buf.length }, "audio received, transcoding to mp3");

    /* Шаг 2: транскодируем в MP3 (работает с любым форматом) */
    await transcodeToMp3(tmpInput, mp3Path);
    fs.unlinkSync(tmpInput);
    tmpInput = null;
    logger.info({ mp3Filename }, "audio transcoded to mp3");

    /* Шаг 3: отвечаем URL */
    res.json({ url: `/api/audio/${mp3Filename}` });

    /* Шаг 4: GCS в фоне */
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (bucketId) {
      (async () => {
        try {
          const mp3Buf = fs.readFileSync(mp3Path);
          const bucket = getBucket();
          const file = bucket.file(`audio/${mp3Filename}`);
          await withTimeout(file.save(mp3Buf, { contentType: "audio/mpeg", resumable: false }), 120_000, "gcs.save.audio.bg");
          logger.info({ mp3Filename }, "audio mp3 uploaded to GCS (background)");
        } catch (e) {
          logger.warn({ err: e, mp3Filename }, "GCS audio background upload failed");
        }
      })();
    }
  } catch (err: any) {
    if (tmpInput && fs.existsSync(tmpInput)) { try { fs.unlinkSync(tmpInput); } catch {} }
    logger.error({ err: err?.message || err }, "audioUpload error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Ошибка обработки файла. Проверьте формат." });
    }
  }
});

/* Вспомогательная функция: отдаёт файл с диска с поддержкой Range */
function serveDiskRange(filepath: string, ct: string, req: Request, res: Response) {
  const stat = fs.statSync(filepath);
  const total = stat.size;
  const rangeHeader = req.headers["range"];
  res.setHeader("Content-Type", ct);
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.setHeader("Accept-Ranges", "bytes");
  if (rangeHeader) {
    const m = rangeHeader.match(/bytes=(\d*)-(\d*)/);
    if (m) {
      const start = m[1] ? parseInt(m[1], 10) : 0;
      const end = m[2] ? Math.min(parseInt(m[2], 10), total - 1) : total - 1;
      if (start > total - 1 || start > end) {
        res.setHeader("Content-Range", `bytes */${total}`);
        res.status(416).end();
        return;
      }
      res.setHeader("Content-Range", `bytes ${start}-${end}/${total}`);
      res.setHeader("Content-Length", String(end - start + 1));
      res.status(206);
      fs.createReadStream(filepath, { start, end }).pipe(res);
      return;
    }
  }
  res.setHeader("Content-Length", String(total));
  res.status(200);
  fs.createReadStream(filepath).pipe(res);
}

/* GET /api/audio/:filename */
router.get("/audio/:filename", async (req: Request, res: Response) => {
  const filename = String(req.params["filename"]).replace(/[^a-zA-Z0-9.\-_]/g, "");
  const objectName = `audio/${filename}`;
  const ext = path.extname(filename).toLowerCase();
  const ct = ext === ".mp3" ? "audio/mpeg" : "audio/mpeg";

  /* Сначала проверяем локальный диск (быстро) */
  const diskDirs = [AUDIO_DIR, path.join("/tmp", "swaip_uploads", "audio_uploads")];
  for (const dir of diskDirs) {
    const filepath = path.join(dir, filename);
    if (fs.existsSync(filepath)) {
      serveDiskRange(filepath, ct, req, res);
      return;
    }
  }

  /* Fallback: GCS (файл могли удалить с диска после перезапуска) */
  try {
    const bucket = getBucket();
    const file = bucket.file(objectName);
    const [exists] = await withTimeout(file.exists(), 5_000, "gcs.exists.audio");
    if (exists) {
      const [meta] = await withTimeout(file.getMetadata(), 5_000, "gcs.meta.audio");
      const size = meta?.size ? parseInt(String(meta.size), 10) : 0;
      const rangeHeader = req.headers["range"];
      res.setHeader("Content-Type", ct);
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("Accept-Ranges", "bytes");
      if (rangeHeader && size > 0) {
        const m = rangeHeader.match(/bytes=(\d*)-(\d*)/);
        if (m) {
          const start = m[1] ? parseInt(m[1], 10) : 0;
          const end = m[2] ? Math.min(parseInt(m[2], 10), size - 1) : size - 1;
          if (start > size - 1 || start > end) {
            res.setHeader("Content-Range", `bytes */${size}`);
            res.status(416).end();
            return;
          }
          res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
          res.setHeader("Content-Length", String(end - start + 1));
          res.status(206);
          file.createReadStream({ start, end }).pipe(res);
          return;
        }
      }
      if (size > 0) res.setHeader("Content-Length", String(size));
      res.status(200);
      file.createReadStream().pipe(res);
      return;
    }
  } catch { /* GCS недоступен */ }

  res.status(404).json({ error: "Not found" });
});

export default router;
