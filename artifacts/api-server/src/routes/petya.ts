import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { textToSpeech } from "@workspace/integrations-openai-ai-server/audio";

const router = Router();

const PETYA_SYSTEM = `Ты — Петя, добрый и весёлый репетитор-отличник. Помогаешь школьникам любого класса с домашними заданиями по всем предметам: математика, алгебра, геометрия, физика, химия, биология, русский язык, литература, история, обществознание, география, английский язык, информатика, астрономия и другим.

Решай задание ПОЛНОСТЬЮ. Все шаги, все вычисления, правила, теоремы — ничего не пропускай.

Верни ТОЛЬКО JSON (без markdown, без комментариев, без кода):
{
  "subject": "название предмета (например: Математика, Русский язык)",
  "solution": "Полное пошаговое решение. Оформи как в школьной тетради. Каждое действие с новой строки. Используй \\n для переносов. Для математики: показывай каждое действие. Для языков: правила + примеры. Ответ выдели в самом конце строкой 'Ответ: ...'",
  "voiceScript": "Объяснение вслух — тёплым, дружелюбным голосом, как любящий репетитор ученику. Без формул — только словами. Начни с ободряющего приветствия типа 'Привет, давай разберём эту задачку вместе!' Объясни ПОЧЕМУ именно так, не просто что. Полностью, подробно, по-русски."
}`;

router.post("/petya/solve", async (req, res) => {
  const { text, imageBase64 } = req.body as { text?: string; imageBase64?: string };

  if (!text && !imageBase64) {
    res.status(400).json({ error: "text или imageBase64 обязательны" });
    return;
  }

  const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];

  if (imageBase64) {
    userContent.push({
      type: "image_url",
      image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
    });
  }

  userContent.push({
    type: "text",
    text: text || "Посмотри на фотографию задания и реши его полностью, шаг за шагом.",
  });

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 8192,
      messages: [
        { role: "system", content: PETYA_SYSTEM },
        { role: "user", content: userContent as any },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";

    let parsed: { subject?: string; solution?: string; voiceScript?: string } = {};
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    } catch {
      parsed = { solution: raw, voiceScript: raw };
    }

    res.json({
      subject: parsed.subject ?? "Задание",
      solution: parsed.solution ?? raw,
      voiceScript: parsed.voiceScript ?? parsed.solution ?? raw,
    });
  } catch (err: any) {
    req.log?.error(err, "petya solve error");
    res.status(502).json({ error: "Ошибка AI. Попробуй ещё раз." });
  }
});

router.post("/petya/speak", async (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text) { res.status(400).json({ error: "text обязателен" }); return; }

  try {
    const buffer = await textToSpeech(text.slice(0, 4096), "nova", "mp3");
    res.set("Content-Type", "audio/mpeg");
    res.set("Content-Length", String(buffer.length));
    res.set("Cache-Control", "no-store");
    res.send(buffer);
  } catch (err: any) {
    req.log?.error(err, "petya speak error");
    res.status(502).json({ error: "Ошибка озвучки." });
  }
});

export default router;
