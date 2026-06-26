---
name: Brand rename on a live app
description: How to rename a published app's brand without breaking existing users, incl. transliterations
---
Renaming a *visible* brand (e.g. SWAIP→SWAP) on an already-published app:

**Preserve (invisible, breaking if changed):** localStorage keys, IndexedDB DB names,
crypto salts used in key derivation, service-worker cache names, server temp paths,
internal variable/component/file names, and i18n KEY names (change the VALUES only).
**Why:** changing any of these orphans existing users' sessions, accounts, or E2E keys.

**Catch all visible spellings, not just the Latin one.** A plain ASCII `sed s/SWAIP/SWAP/`
misses transliterations. Russian copy had the brand as Cyrillic `СВАИП` (letters С-В-А-И-П).
Beware false friends: the swipe *gesture* is `свайп` (with **й**), the brand transliteration is
`СВАИП/Сваип` (with **и**) — distinguishable by й vs и. Audit with grep for the Cyrillic forms.
Also check non-`src` surfaces: `public/sw.js` push-notification fallback titles, manifest.json,
index.html title/apple-title, opengraph image text, favicon.
**How to apply:** after the Latin sed, grep for every script's transliteration + every public/ file
before declaring done; then have architect review with includeGitDiff.
