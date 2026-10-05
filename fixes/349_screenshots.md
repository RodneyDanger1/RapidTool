# fixes/349 — LANE 2: a real screenshot proof of the emitted product

Branch: `rt349-shot` (base `e06595d`). Date: 2026-10-05.

## What changed

- **`scripts/run-shot.mjs` (NEW)** — a standalone product-screenshot tool.
  `--dir <emitted-tree>` (required), `--out <dir>` (default `<dir>/../screenshots`),
  `--viewport <WxH>` (default 1280x800), `--wait <ms>` (default 1500).
  It serves the tree over a loopback ephemeral HTTP port (a small `node:http`
  server with MIME types + path-traversal refusal), launches Playwright chromium
  headless, navigates, waits, and — only after confirming the page actually
  rendered visible content — writes two real PNGs (`shot.png` viewport,
  `shot-full.png` full page). Prints ONE JSON object
  `{ ok, dir, entry, shots[], skipped, reason }`. Exit: `0` captured · `3` honest
  skip · `1` capture error · `2` usage error.
  Pure/exported helpers: `parseShotArgs`, `resolveEntry`, `defaultOutDir`,
  `startStaticServer`, `renderedProbe`, `isPng`, `mimeFor`.
- **`scripts/factory-watch.mjs`** — `RUN_SHOT_PATH` (line 96) and the exported
  best-effort `captureDeliveryShots` (line 628, shells out to run-shot.mjs,
  never throws, injectable `spawnShot`). Wired at two sites:
  - fresh delivery: `entry.screenshots = captureDeliveryShots(...)` (line 1011)
    before the state commit, so the record is durable beside the run artifact;
  - already-delivered backfill: line 874, idempotent (skipped once recorded).
  `row()` now carries `screenshots` (line 1077). A skip/failure is recorded and
  never influences the tick's exit code.
- **`scripts/run-shot.test.mjs` (NEW)** and **`scripts/factory-watch.test.mjs`** —
  pure + behavioral coverage (below).

## Browser availability (observed)

Chromium **is installed** for Playwright:
`C:\Users\mnril\AppData\Local\ms-playwright\chromium-1234\chrome-win64\chrome.exe`
(exists; `chromium.executablePath()`). No download was triggered. The tests still
detect this at runtime and assert the coded `RT_SHOT_NO_BROWSER` skip if absent,
so the suite passes either way.

## Commands + real output

```
node --test --test-reporter=tap scripts/run-shot.test.mjs scripts/factory-watch.test.mjs
```
→ `exit=0` · `# tests 30 / # pass 30 / # fail 0 / # skipped 0` (99.4s). Full TAP:
all 30 subtests `ok` (legs include `parseShotArgs` validation, the static server
+ traversal refusal, missing-dir/no-entry/no-browser skips, a real PNG capture,
and the "empty render writes NO blank image" honesty pin; on the factory side,
the best-effort skip recording with unchanged tick exit 0, and the
"never branches the run outcome on the shot" source pin).

```
npx tsc -p tsconfig.scripts.json --noEmit
```
→ `exit=0` (the scripts program is clean; no ratchet budget needed).

```
node node_modules/prettier/bin/prettier.cjs --check "scripts/factory-watch.mjs" \
  "scripts/factory-watch.test.mjs" "scripts/run-shot.mjs" "scripts/run-shot.test.mjs"
```
→ `All matched files use Prettier code style!`

Real invocation against the existing emitted tree:

```
node scripts/run-shot.mjs --dir "../testruns/campaign2/office-scheduler/emitted"
{"ok":false,"dir":"...\\testruns\\campaign2\\office-scheduler\\emitted","entry":"index.html",
 "shots":[],"skipped":true,"reason":"RT_SHOT_EMPTY_RENDER","viewport":{"width":1280,"height":800},
 "consoleErrors":["Unexpected token '<'"],
 "note":"the tree's entry rendered no visible content when served statically; no image written"}
exit=3
```

A renderable tree is captured for real (verified by eye — a 1280x800 PNG of the
page's `<h1>`): a temp static `index.html` yields `exit=0`, `ok:true`,
`shots:[shot.png, shot-full.png]`, each `png:true`, 8580 bytes.

## Honest residual (important)

The campaign2 emitted trees are **Vite/TSX source trees**: `index.html` loads
`/src/main.tsx`, which a browser cannot execute when served statically (bare
imports + JSX). Served statically they render an empty root — so run-shot
correctly returns `RT_SHOT_EMPTY_RENDER` and writes **no** image rather than
keeping a blank frame. Producing a picture of *those* trees requires a build
step (`vite build` / a dev server) before capture, which is outside this lane's
static-serve contract and was deliberately NOT faked. run-shot is fully working
for any tree that renders statically; for Vite source trees the correct, honest
outcome today is the coded skip above.
