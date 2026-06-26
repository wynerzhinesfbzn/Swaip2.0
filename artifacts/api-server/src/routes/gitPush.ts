import { Router } from "express";
import { execFile } from "child_process";
import { promisify } from "util";
import { logger } from "../lib/logger.js";

const execFileAsync = promisify(execFile);
const router = Router();

/* POST /api/git-push — accepts token in JSON body (never in URL to avoid log exposure) */
router.post("/git-push", async (req, res) => {
  const token = (typeof req.body?.token === "string" ? req.body.token : "").trim();

  if (!token) {
    res.status(400).json({ error: "Укажи github_token в теле запроса" });
    return;
  }

  /* Never log the token itself */
  const repoUrl = `https://x-access-token:${token}@github.com/wynerzhinesfbzn/Swaip2.0.git`;

  try {
    const { stdout, stderr } = await execFileAsync(
      "git",
      ["push", repoUrl, "main", "--force"],
      { cwd: "/home/runner/workspace", timeout: 90_000 }
    );
    logger.info({ stdout: stdout.slice(0, 200), stderr: stderr.slice(0, 200) }, "git-push: success");
    res.json({ success: true, output: (stdout + stderr).trim() });
  } catch (err: any) {
    logger.error({ err: err.message, stderr: (err.stderr || "").slice(0, 300) }, "git-push: failed");
    res.status(500).json({ error: "Push failed", detail: err.stderr || err.message });
  }
});

/* GET /api/git-push — HTML form (token sent via POST body, not URL) */
router.get("/git-push", (_req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>SWAIP → GitHub Push</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',system-ui,sans-serif;background:linear-gradient(135deg,#0d0d1a 0%,#1a0a2e 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
  .card{background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:36px 32px;width:100%;max-width:440px;backdrop-filter:blur(20px)}
  .logo{text-align:center;margin-bottom:28px}
  .logo .brand{font-size:28px;font-weight:900;background:linear-gradient(135deg,#a78bfa,#ec4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;letter-spacing:2px}
  .logo .sub{font-size:12px;color:rgba(255,255,255,0.35);margin-top:4px;letter-spacing:1px}
  label{display:block;font-size:11px;font-weight:700;color:rgba(255,255,255,0.45);letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px}
  input[type=password]{width:100%;padding:13px 16px;border-radius:12px;border:1.5px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);color:#fff;font-size:14px;outline:none;transition:border-color 0.2s;font-family:monospace}
  input[type=password]:focus{border-color:rgba(167,139,250,0.6)}
  input[type=password]::placeholder{color:rgba(255,255,255,0.2);font-family:system-ui}
  .hint{font-size:11px;color:rgba(255,255,255,0.25);margin-top:7px;line-height:1.5}
  .hint a{color:rgba(167,139,250,0.7);text-decoration:none}
  .hint a:hover{color:#a78bfa}
  button{width:100%;margin-top:20px;padding:14px;border-radius:14px;border:none;background:linear-gradient(135deg,#7c3aed,#db2777);color:#fff;font-size:15px;font-weight:800;cursor:pointer;letter-spacing:0.5px;transition:opacity 0.2s}
  button:disabled{opacity:0.45;cursor:default}
  button:not(:disabled):hover{opacity:0.88}
  .status{margin-top:18px;padding:13px 16px;border-radius:12px;font-size:13px;white-space:pre-wrap;line-height:1.5;display:none}
  .status.ok{background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.25);color:#4ade80}
  .status.err{background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.25);color:#f87171}
  .spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;animation:spin 0.7s linear infinite;vertical-align:middle;margin-right:8px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .divider{height:1px;background:rgba(255,255,255,0.07);margin:24px 0}
  .info{font-size:11px;color:rgba(255,255,255,0.2);line-height:1.6}
  .info strong{color:rgba(255,255,255,0.4)}
</style>
</head>
<body>
<div class="card">
  <div class="logo">
    <div class="brand">SWAIP</div>
    <div class="sub">GitHub Push Utility</div>
  </div>

  <label for="tok">GitHub Personal Access Token</label>
  <input id="tok" type="password" placeholder="ghp_xxxxxxxxxxxxxxxxxxxx" autocomplete="off" />
  <div class="hint">
    Нужен токен с правом <strong style="color:rgba(255,255,255,0.4)">Contents: Write</strong>.<br>
    <a href="https://github.com/settings/tokens/new?scopes=repo&description=SWAIP+push" target="_blank">Создать токен на GitHub →</a>
  </div>

  <button id="btn" onclick="doPush()">🚀 Push main → GitHub</button>
  <div id="status" class="status"></div>

  <div class="divider"></div>
  <div class="info">
    <strong>Репозиторий:</strong> wynerzhinesfbzn/Swaip2.0<br>
    <strong>Ветка:</strong> main (force push)<br>
    <strong>Безопасность:</strong> токен передаётся только в теле POST-запроса, не в URL
  </div>
</div>

<script>
async function doPush() {
  const btn = document.getElementById('btn');
  const st  = document.getElementById('status');
  const tok = document.getElementById('tok').value.trim();

  if (!tok) { flash('err', '⚠️ Вставь GitHub Token'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Pushing…';
  st.style.display = 'none';

  try {
    const r = await fetch('/api/git-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tok }),
    });
    const d = await r.json();
    if (d.success) {
      flash('ok', '✅ Push выполнен успешно!\\n\\n' + (d.output || ''));
    } else {
      flash('err', '❌ ' + (d.error || 'Ошибка') + (d.detail ? '\\n\\n' + d.detail : ''));
    }
  } catch (e) {
    flash('err', '❌ Ошибка сети: ' + e);
  }

  btn.disabled = false;
  btn.innerHTML = '🚀 Push main → GitHub';
}

function flash(type, text) {
  const el = document.getElementById('status');
  el.className = 'status ' + type;
  el.textContent = text;
  el.style.display = 'block';
}

document.getElementById('tok').addEventListener('keydown', e => {
  if (e.key === 'Enter') doPush();
});
</script>
</body>
</html>`);
});

export default router;
