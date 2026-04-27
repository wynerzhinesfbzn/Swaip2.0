import { Router, type IRouter } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import path from "path";
import { fileURLToPath } from "url";
import { getSessionToken, resolveSession } from "../lib/sessionAuth.js";

const execFileAsync = promisify(execFile);
const router: IRouter = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "../../../");
const SCRIPTS_DIR = path.join(PROJECT_ROOT, "scripts");

router.post("/git-push", async (req, res) => {
  /* Require authenticated session */
  const sessionToken = getSessionToken(req);
  const userHash = await resolveSession(sessionToken);
  if (!userHash) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  const token = process.env["GITHUB_TOKEN"];
  if (!token) {
    return res.status(400).json({
      success: false,
      error: "GITHUB_TOKEN is not set. Add it in Replit Secrets.",
    });
  }

  const rawMsg = (req.body?.message as unknown);
  const commitMsg = (typeof rawMsg === "string" ? rawMsg.trim() : "")
    || `chore: update ${new Date().toISOString()}`;

  const env = { ...process.env, GITHUB_TOKEN: token };
  const opts = { cwd: PROJECT_ROOT, env, timeout: 60_000 };

  try {
    /* 1. Configure git remote with token */
    const setupHelper = path.join(SCRIPTS_DIR, "setup-git-auth.sh");
    await execFileAsync("bash", [setupHelper], opts);

    /* 2. Check uncommitted state */
    let hasUncommitted = false;
    let commitOutput = "(nothing to commit — pushed existing commits)";

    try {
      const { stdout: diffOut } = await execFileAsync("git", ["diff", "HEAD", "--name-only"], opts);
      const { stdout: lsFiles } = await execFileAsync("git", ["ls-files", "--others", "--exclude-standard"], opts);
      hasUncommitted = diffOut.trim().length > 0 || lsFiles.trim().length > 0;
    } catch {
      /* Continue — just push existing commits */
    }

    /* 3. Commit if there are uncommitted changes — safe arg array, no shell interpolation */
    if (hasUncommitted) {
      try {
        await execFileAsync("git", ["add", "-A"], opts);
        const { stdout: co } = await execFileAsync("git", ["commit", "-m", commitMsg], opts);
        commitOutput = co.trim();
      } catch (commitErr: unknown) {
        const msg = commitErr instanceof Error ? commitErr.message : String(commitErr);
        commitOutput = `commit skipped (${msg.split("\n")[0]})`;
      }
    }

    /* 4. Push */
    const { stdout: pushOut, stderr: pushErr } = await execFileAsync(
      "git", ["push", "origin", "main"], opts
    );

    const pushMsg = (pushOut + pushErr).trim() || "Already up to date.";

    return res.json({ success: true, hasUncommitted, commit: commitOutput, push: pushMsg });
  } catch (err: unknown) {
    const e = err as Record<string, unknown>;
    const errMsg = (e?.["stderr"] || e?.["stdout"] || (err instanceof Error ? err.message : "Unknown error")) as string;
    return res.status(500).json({ success: false, error: errMsg });
  }
});

export default router;
