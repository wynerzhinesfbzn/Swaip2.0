---
name: SWAIP upload testing pitfall
description: Non-obvious gotcha when testing SWAIP media upload endpoints
---

SWAIP media upload routes (audio/image/video/doc) read the **raw binary request body**, not `multipart/form-data`. Format comes from the `Content-Type` header, original name from `x-filename`.

**Why:** The frontend posts a raw Blob/File as the body. Nothing parses multipart, so a multipart-wrapped payload is written to disk verbatim (boundary bytes and all).

**How to apply:** When manually testing uploads with curl, use `--data-binary "@file" -H "Content-Type: audio/wav"`. Do NOT use `-F "audio=@file"` — the boundary bytes corrupt the file and ffmpeg fails with "Invalid data found when processing input" → HTTP 500. A 500 from audio-upload during a curl test almost always means the test used multipart, not a real server bug.
