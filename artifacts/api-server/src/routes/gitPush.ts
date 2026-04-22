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

  const message = (req.body?.message as string | undefined)?.trim()
    || `chore: update ${new Date().toISOString()}`;

  const env = { ...process.env, GITHUB_TOKEN: token };
  const opts = { cwd: PROJECT_ROOT, env };

  try {
    const setupHelper = path.join(SCRIPTS_DIR, "setup-git-auth.sh");
    await execAsync(`bash "${setupHelper}"`, opts);

    const { stdout: statusOut } = await execAsync("git status --porcelain", opts);
    const hasChanges = statusOut.trim().length > 0;

    let commitOutput = "";
    if (hasChanges) {
      await execAsync("git add -A", opts);
      const { stdout: commitOut } = await execAsync(
        `git commit -m "${message.replace(/"/g, '\\"')}"`,
        opts
      );
      commitOutput = commitOut.trim();
    }

    const { stdout: pushOut } = await execAsync("git push origin main", opts);

    return res.json({
      success: true,
      hasChanges,
      commit: commitOutput || "(nothing to commit)",
      push: pushOut.trim() || "Already up to date.",
    });
  } catch (err: any) {
    const message = err?.stderr || err?.stdout || err?.message || "Unknown error";
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
