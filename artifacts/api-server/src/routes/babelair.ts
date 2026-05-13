import { Router } from "express";
import multer from "multer";
import {
  speechToText,
  textToSpeech,
  ensureCompatibleFormat,
} from "@workspace/integrations-openai-ai-server/audio";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const VOICE_MAP: Record<string, "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"> = {
  alloy: "alloy", echo: "echo", fable: "fable",
  onyx: "onyx", nova: "nova", shimmer: "shimmer",
};

/*
 * POST /api/babelair/process
 * Multipart: audio (Blob), toLang (ISO 639-1), voice (optional openai voice name)
 * Returns: { original, translated, audioBase64 }
 */
router.post("/babelair/process", upload.single("audio"), async (req, res) => {
  const toLang = ((req.body.toLang as string) || "en").trim();
  const voice = VOICE_MAP[(req.body.voice as string) || "nova"] ?? "nova";

  if (!req.file) return res.status(400).json({ error: "no audio" });

  try {
    const { buffer, format } = await ensureCompatibleFormat(req.file.buffer);
    const original = await speechToText(buffer, format);

    if (!original.trim()) {
      return res.json({ original: "", translated: "", audioBase64: "" });
    }

    const trUrl =
      `https://translate.googleapis.com/translate_a/single` +
      `?client=gtx&sl=auto&tl=${encodeURIComponent(toLang)}&dt=t` +
      `&q=${encodeURIComponent(original)}`;

    const trRes = await fetch(trUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 12; Pixel 6) " +
          "AppleWebKit/537.36 (KHTML, like Gecko) " +
          "Chrome/122.0.0.0 Mobile Safari/537.36",
      },
      signal: AbortSignal.timeout(9000),
    });

    const trData = (await trRes.json()) as any[][];
    const translated =
      (trData[0] as any[])?.map((x: any) => x?.[0] ?? "").join("").trim() || original;

    const audioBuffer = await textToSpeech(translated, voice, "mp3");
    const audioBase64 = audioBuffer.toString("base64");

    return res.json({ original, translated, audioBase64 });
  } catch (e: any) {
    req.log.error({ err: e }, "babelair process error");
    return res.status(500).json({ error: e?.message || "processing failed" });
  }
});

export default router;
