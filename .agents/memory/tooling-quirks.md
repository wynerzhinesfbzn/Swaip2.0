---
name: Tooling quirks in this repo
description: Tool output reliability notes
---
The `rg` (ripgrep) tool's content output is mangled/redacted in this environment
(tokens like filenames/paths render as "ln", "/n.png", "n"). Do NOT trust rg match
text for content decisions. Use `cat`/the read tool/GNU `grep` instead, and confirm
with occurrence counts (`grep -c` / `wc -l`).
