import { Router } from "express";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { logger } from "../lib/logger";

const router = Router();
const DATA_DIR = join("/home/runner/workspace", "data");
const CONFIG_PATH = join(DATA_DIR, "menu-config.json");

interface MenuConfig { order: string[]; hidden: string[]; }

function readConfig(): MenuConfig {
  try { return JSON.parse(readFileSync(CONFIG_PATH, "utf-8")); } catch { return { order: [], hidden: [] }; }
}

function saveConfig(cfg: MenuConfig) {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  } catch (e) { logger.error({ err: e }, "menuConfig: write failed"); }
}

router.get("/menu-config", (_req, res) => {
  res.json(readConfig());
});

router.put("/menu-config", (req, res) => {
  const { order, hidden } = req.body || {};
  if (!Array.isArray(order) || !Array.isArray(hidden)) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }
  const cfg: MenuConfig = {
    order: order.filter((x): x is string => typeof x === "string"),
    hidden: hidden.filter((x): x is string => typeof x === "string"),
  };
  saveConfig(cfg);
  logger.info({ items: cfg.order.length, hidden: cfg.hidden.length }, "menuConfig: saved");
  res.json({ success: true });
});

export default router;
