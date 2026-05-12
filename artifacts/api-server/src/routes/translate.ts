import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

/* POST /api/translate
 * body: { text: string, from: string, to: string }
 * from/to = ISO 639-1 codes (ru, zh, ja, en, ...)
 * Возвращает { translated: string }
 */
router.post("/translate", async (req, res) => {
  const { text, from, to } = req.body as { text?: string; from?: string; to?: string };

  if (!text?.trim()) return res.status(400).json({ error: "empty text" });
  if (!from || !to)   return res.status(400).json({ error: "from/to required" });
  if (from === to)    return res.json({ translated: text });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            `You are a professional translator. Translate the text from language code "${from}" to language code "${to}". ` +
            `Return ONLY the translation, no explanations, no quotes, no extra text.`,
        },
        { role: "user", content: text },
      ],
      max_tokens: 1000,
      temperature: 0.2,
    });

    const translated = completion.choices[0]?.message?.content?.trim() || text;
    return res.json({ translated });
  } catch (e: any) {
    req.log.error({ err: e }, "translate error");
    return res.status(502).json({ error: e?.message || "translate failed" });
  }
});

export default router;
