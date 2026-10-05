# 350 · F2 — screenshot the REAL emitted product (build a Vite-source tree) + lint

Branch `rt350-shot`, base `3436866`.

## The gap

`scripts/run-shot.mjs` served an emitted tree statically, but emitted trees are
Vite/TSX **source** (`index.html` → `/src/main.tsx`). A static serve loads raw
TSX that the browser cannot execute, the root stays empty, and run-shot returned
the honest `RT_SHOT_EMPTY_RENDER` skip with **no image** — so a real run could
not produce a picture of what it built.

## What changed

### `scripts/run-shot.mjs`
- **Bounded build fallback** (`buildTreeToDist`, line 307): when the static
  serve renders nothing and the build step is enabled, a **temp copy** of the
  tree is built with `vite build`, then `dist/` is served and captured. The
  input tree is **never mutated**: the copy excludes `node_modules`/`.git` and
  gains a JUNCTION to the tree's own (else the repo's shared) toolchain root —
  the same symlink seam `compile-check.server.ts` uses (`linkSharedToolchain`,
  `src/lib/compile-check.server.ts:1781`). `vite build` runs bounded
  (`DEFAULT_BUILD_TIMEOUT_MS = 90_000`, `killSignal: SIGKILL`) with an offline
  env (`CI=1`, `npm_config_offline=true`) — no network, no dependency fetched.
- **`repoSharedToolchainRoot`** (line 286): `<repo>/node_modules` iff it ships
  `.bin`, else null (a toolchain is never fabricated).
- **CLI opt-out** `--no-build`: boolean flag in `parseShotArgs` (lines 122, 126,
  179); keeps the static-only path.
- **Refactor** `capture()` → `captureRoot()` (line 406) so the tree as-emitted
  and the built `dist/` are probed by the exact same render rule. PNGs are
  written by NEITHER path unless the render is confirmed non-empty.
- **Honest coded skips** (never a blank/fabricated image):
  `RT_SHOT_BUILD_UNAVAILABLE`, `RT_SHOT_BUILD_FAILED`, `RT_SHOT_BUILD_TIMEOUT`,
  `RT_SHOT_NO_DIST` — all exit 3, `shots: []`.
- Removed the unused `writeFileSync` import (lint warning fixed; line 35).
- Success payload gains `servedDir` + `build { attempted, ok, reason, command,
  detail, dist }` (additive).

### `scripts/run-shot.test.mjs`
- Removed the unused `mkdirSync` warning by using it in the new `writeViteTree`
  fixture helper (line 75) — a minimal Vite-source tree whose TS annotation is a
  syntax error to a raw static serve but compiles under vite.
- New pure leg: `buildTreeToDist` with no reachable toolchain ⇒
  `RT_SHOT_BUILD_UNAVAILABLE` (line 311).
- New behavioral legs (all honest, gated on browser/toolchain presence):
  - Vite-source tree ⇒ built in a temp copy, real PNGs, **input untouched**
    (line 326);
  - failed build ⇒ `RT_SHOT_BUILD_FAILED`, exit 3, zero PNGs (line 362);
  - build with redirected `outDir` ⇒ `RT_SHOT_NO_DIST`, exit 3 (line 387);
  - `--no-build` ⇒ `RT_SHOT_EMPTY_RENDER`, no build record, no mutation
    (line 409).
- Existing static empty-render leg now pins `--no-build` (line 289); the
  emitted-tree e2e accepts the new coded build skips.

### `scripts/factory-watch.mjs`
- `captureDeliveryShots` default `timeoutMs` 120_000 → 180_000 (one line,
  line 635) so the best-effort tick capture is not killed mid-build. The wiring
  itself is unchanged and stays non-fatal (a skip/failure is recorded, never
  gates the tick).

## Exact commands + results

```
node --test --test-reporter=tap scripts/run-shot.test.mjs scripts/factory-watch.test.mjs
# tests 35 · pass 35 · fail 0 · skipped 0 · todo 0 · duration_ms 120031

npx tsc -p tsconfig.scripts.json --noEmit
# exit 0

npx eslint scripts/run-shot.mjs scripts/run-shot.test.mjs scripts/factory-watch.mjs scripts/factory-watch.test.mjs
# 0 problems
```

## Real invocation on an emitted tree (`../testruns`)

Tree: `../testruns/campaign1/flower-shop-website/emitted` (Vite source:
`index.html` → `/src/main.tsx`, no `node_modules`).

```
node scripts/run-shot.mjs --dir "..\testruns\campaign1\flower-shop-website\emitted" \
                          --out "%TEMP%\f2-log-shot"
```

Result — **a real PNG WAS produced** (exit 0):

```json
{"ok":true,"servedDir":"%TEMP%\\rt-shot-7iLA8L\\dist","entry":"index.html",
 "shots":[{"name":"shot.png","path":"%TEMP%\\f2-log-shot\\shot.png","png":true,"bytes":12156},
          {"name":"shot-full.png","path":"…\\shot-full.png","png":true,"bytes":12156}],
 "skipped":false,
 "build":{"attempted":true,"ok":true,"command":"vite build (…\\shot\\node_modules\\vite\\bin\\vite.js)",
          "dist":"%TEMP%\\rt-shot-7iLA8L\\dist"},
 "rendered":{"rendered":true,"textLen":125}}
```

The PNG shows the emitted product itself — “Wildstem Florist” + its generated
shell notice (the tree renders a real shell message). The input tree gained no
`dist/` or `node_modules/` (temp copy only).

Second real tree (`../testruns/campaign2/office-scheduler/emitted`) builds
cleanly but its `Console` passes a generated object as a React child (React
error #31), so the built page is genuinely empty ⇒ honest coded skip
`RT_SHOT_EMPTY_RENDER`, **no image written**. That is a product defect surfaced
by the tool, not a tooling failure.

## Blockers

None. Lint warnings gone, `tsc` exits 0, 35/35 tests pass with a real browser
and the repo toolchain.
