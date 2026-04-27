import { Router, type IRouter } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";

const execAsync = promisify(exec);
const router: IRouter = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../../");
const SCRIPTS_DIR = path.join(PROJECT_ROOT, "scripts");

router.post("/git-push", async (req, res) => {
  const token = process.env["GITHUB_TOKEN"];
  if (!token) {
    return res.status(400).json({
      success: false,
      error: "GITHUB_TOKEN is not set. Add it in Replit Secrets.",
    });
  }

  const commitMsg = (req.body?.message as string | undefined)?.trim()
    || `chore: update ${new Date().toISOString()}`;

  const env = { ...process.env, GITHUB_TOKEN: token };
  const opts = { cwd: PROJECT_ROOT, env, timeout: 60000 };

  try {
    /* 1. Настроить git remote с токеном */
    const setupHelper = path.join(SCRIPTS_DIR, "setup-git-auth.sh");
    await execAsync(`bash "${setupHelper}"`, opts);

    /* 2. Проверить статус без индекса (git diff не трогает index.lock) */
    let hasUncommitted = false;
    let commitOutput = "(nothing to commit — pushed existing commits)";

    try {
      /* git diff HEAD -- работает без index.lock */
      const { stdout: diffOut } = await execAsync("git diff HEAD --name-only", opts);
      /* Незакоммиченные новые файлы */
      const { stdout: lsFiles } = await execAsync("git ls-files --others --exclude-standard", opts);
      hasUncommitted = (diffOut.trim().length > 0) || (lsFiles.trim().length > 0);
    } catch {
      /* Если и это не работает — продолжаем, просто пушим то что есть */
    }

    /* 3. Если есть незакоммиченные изменения — пробуем закоммитить */
    if (hasUncommitted) {
      try {
        await execAsync("git add -A", opts);
        const { stdout: co } = await execAsync(
          `git commit -m "${commitMsg.replace(/"/g, '\\"')}"`,
          opts
        );
        commitOutput = co.trim();
      } catch (commitErr: any) {
        /* Если commit провалился из-за lock — просто пушим существующие коммиты */
        commitOutput = `commit skipped (${commitErr?.stderr?.split('\n')[0] || 'lock conflict'})`;
      }
    }

    /* 4. Push — не требует index.lock */
    const { stdout: pushOut, stderr: pushErr } = await execAsync(
      "git push origin main",
      opts
    );

    /* git push пишет в stderr даже при успехе */
    const pushMsg = (pushOut + pushErr).trim() || "Already up to date.";

    return res.json({
      success: true,
      hasUncommitted,
      commit: commitOutput,
      push: pushMsg,
    });
  } catch (err: any) {
    const errMsg = err?.stderr || err?.stdout || err?.message || "Unknown error";
    return res.status(500).json({ success: false, error: errMsg });
  }
});

export default router;
