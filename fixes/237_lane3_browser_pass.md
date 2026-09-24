# 237 · W14 LANE 3 — OV-2: first real browser pass on the console (guard fixed; smoke GREEN)

**Status: DONE** (one registered host constraint; one residual not-yet-observed UI list kept honest below).

**Bottom line:**
- **The Windows-unsatisfiable guard is FIXED** (`scripts/browser-guard.mjs` `checkedOutputPath`): allowed dirs are
  now resolved the same way the target is — the WD-C repro (`C:/workspace/...` against `["/workspace"]`) passes,
  while the `..`-escape, outside-dir, and strict-inside refusals still hold (all four cases re-run below);
  `npx eslint scripts/browser-guard.mjs` → exit 0.
- **The first real browser pass RAN and is GREEN**: `node scripts/browser-smoke.mjs http://localhost:8090/
  C:/workspace/screenshots/w14.png` against the live app → exit 0, both viewports HTTP 200, title
  `"RapidTool — autonomous software agency"`, **0 console errors, 0 page errors, no horizontal overflow**.
  Artifacts: `C:/workspace/screenshots/w14.png` · `w14-mobile.png` · `w14.json` (sha256 + sizes below).
- **What the pixels show** (§3): the RapidTool landing/console-intake page renders clean on desktop 1280×800
  and mobile 390×844 (header, hero, brief intake, example chips, empty-state Builds panel) — no defects found.
  **Not yet observed** (needs a build-open state): the tiered tab strip, Export menu, focus ring, current-step
  line that `fixes/218` §4:116–119 asks a browser pass to confirm — registered, not claimed (§4 R6).
- **Host constraint (registered, R1)**: port **8080 was occupied by a foreign dev server** (`contractorapp`, PID
  14140, up since 09:43 — not this lane's process). Plain `npm run dev` failed with
  `Error: Port 8080 is already in use` (vite.config.ts:152 `strictPort:true`). The app was therefore served with
  `npm run dev -- --port 8090` (same wrapper/env; only the port differs) and smoked there.

## §0 Baseline + RED of record
- HEAD `7582771` (W12 close) + uncommitted W14 tree. Lane touched: `scripts/browser-guard.mjs` (fix) and this log
  only. `scripts/browser-smoke.mjs` arg handling inspected — **positional args are correct, nothing changed there**.
- Pre-fix repro, real module, scratch harness `C:/Users/mnril/w14l3_scratch/guard-check.mjs`
  (`node guard-check.mjs` from the scratch dir):
  ```
  {"mode":"accept-windows-scratch","exit":1,"output":"{ \"ok\": false, \"error\": \"screenshot path must be under /workspace, got C:\\\\workspace\\\\screenshots\\\\w14.png\" }"}
  {"mode":"reject-escape","exit":1, ...}
  {"mode":"reject-outside","exit":1, ...}
  {"mode":"strict-dir-itself","exit":1, ...}
  ```
  Accept-case refusal = the WD-C message, reproduced verbatim → **RED confirmed** (`fixes/219_wdC` C7).

## §1 Guard fix (`scripts/browser-guard.mjs`) — FIXED, with its own verify
Diff (the only change in the file):
```diff
 export function checkedOutputPath(target, allowedDirs, label = "screenshot") {
   // Resolve first so `..` cannot slip past the prefix check.
   const abs = resolve(target);
-  const allowed = allowedDirs.some((dir) => abs.startsWith(dir.endsWith(sep) ? dir : dir + sep));
+  // Resolve each allowed dir the same way: callers pass POSIX-style literals
+  // (e.g. "/workspace"), which on Windows resolve to a `C:\...` shape — without
+  // this the prefix test against a resolved `abs` could never pass there.
+  const allowed = allowedDirs.some((dir) => {
+    const dirAbs = resolve(dir);
+    return abs.startsWith(dirAbs.endsWith(sep) ? dirAbs : dirAbs + sep);
+  });
```
Post-fix verify (same harness, both runs shown because the fix's acceptance is exactly "same input, message gone"):
```
{"mode":"accept-windows-scratch","exit":0,"result":"C:\\workspace\\screenshots\\w14.png"}   ← WD-C repro now passes
{"mode":"reject-escape","exit":1, output:"...screenshot path must be under /workspace, got C:\\secret\\x.png"}   ← `..` protection intact
{"mode":"reject-outside","exit":1, output:"...got C:\\Users\\mnril\\x.png"}                  ← outside dir still refused
{"mode":"strict-dir-itself","exit":1, output:"...got C:\\workspace"}                          ← "strictly inside" semantics preserved
```
`npx eslint scripts/browser-guard.mjs` → `eslint exit: 0`; `node --check` → syntax OK.
Targeted repo test for this surface (allowed form): `node --test --test-concurrency=2 scripts/browser-smoke-verdict.test.mjs`
→ **40/40 pass, exit 0** (`browser-smoke wires the guard and verdict helpers` + `browser-smoke file I/O only touches
guarded paths`; these are source-level pins — there is still **no behavioral pin on `checkedOutputPath` itself: R2 stands**).
Full-gate boundary: `npm run typecheck` / `npm test` / `npm run build` are **boundary/parent-only and forbidden to this
lane** (lanes.md rules; memory-tight host with concurrent agents) — not run, not claimed. Runtime evidence for this file
is the live smoke (§2), which executed the changed function through all four call paths (outPng/mobile/verdict/baseline
guards) with exit 0.
Not weakened into pass-through: only the allowed-dir side gained `resolve()`; the target was already resolved.
Third consumer: `preview-thumbnail.mjs` also calls `checkedOutputPath(…, ["/workspace"-style])` and inherits the fix;
not run this pass (it needs a live target — out of scope).

## §2 The smoke run (first real browser pass)
Environment steps and their evidence:
1. Attempted `npm run dev` (spec shape) in background → **failed, correct failure**:
   `dev.log` (scratch): `error when starting dev server: Error: Port 8080 is already in use` — because
   `vite.config.ts:149–153` sets `port: 8080, strictPort: true` and **PID 14140** holds 8080:
   `wmic ... CommandLine = "node" "C:\Users\mnril\Desktop\contractorapp\node_modules\.bin\..\vite\bin\vite.js" dev --host 0.0.0.0 --port 8080`
   (a sibling workspace clone with `.grok/`, `wave_plans/`, `probe*-lane-a.ts` — another agent's live server,
   started 09:43:45, **not mine to kill** → registered R1 instead).
2. Environment traps hit while retrying (registered R7): terminal `node` is aliased to `winpty node.exe`, so a
   background `node …` prints `stdin is not a tty` and dies; and `node_modules/.bin` is not on PATH outside npm,
   so `with-app-env`'s cmd resolution of `vite` fails with `'vite' is not recognized` (probe in
   `env-probe.log`). Resolution: launch through npm (npm supplies both).
3. Working launch: `npm run dev -- --port 8090` (npm appends to the script → `vite dev --host 0.0.0.0 --port
   8080 --port 8090`; last `--port` wins; same `with-app-env` wrapper, same host contract on a free port):
   `VITE v8.2.2  ready in 7978 ms` · `Local: http://localhost:8090/`.
   `/__app-env` → `{"VITE_AUTH_ENABLED":"false","BASE_URL":"/","MODE":"development","DEV":true,"PROD":false}`.
4. **The smoke command** (repo cwd, chromium from `%LOCALAPPDATA%\ms-playwright`):
   `node scripts/browser-smoke.mjs http://localhost:8090/ C:/workspace/screenshots/w14.png` → **SMOKE_EXIT=0**.
   Verdict (full JSON at `C:/workspace/screenshots/w14.json`; scratch copy
   `w14-verdict-RAPIDTOOL-8090.json`), key fields:
   - desktop 1280×800: `status 200`, `title "RapidTool — autonomous software agency"`, `bodyTextLen 554`,
     `bodyTextPrefix "RapidTool autonomous software agency phases 0–12 · graph locked"`,
     `horizontalOverflow false`, `consoleErrors []`, `pageErrors []`.
   - mobile 390×844: `status 200`, same title, `bodyTextLen 527`, prefix `"...GOVERNED DELIVERY Research ..."`,
     `horizontalOverflow false`, `consoleErrors []`, `pageErrors []`.
   - `authWarnings: []` → dev `/__app-env` (off) agrees with `.grok/app-env.json` `VITE_AUTH_ENABLED:"false"`
     (off). (The earlier smoke attempt against 8080 carried `authWarnings: [diverged]` — **an artifact of
     smoking the foreign app**: contractorapp's dev env (on) vs this repo's build env (off). Preserved at
     `w14-verdict-CONTRACTORAPP-8080.json`; do not cite it as a RapidTool finding.)
   - exact-contract note: the success verdict has no literal `ok:true` field — the script's success contract
     is exit 0 + verdict object; only the failure path writes `{ok:false, error}`. Exit was 0.
   - Output PNGs (written by the smoke; `mkdirSync` created the dir): `w14.png` 68 200 B
     sha256 `02b817f2701507199f052cf3a9c02cf16886e6b3d49397f10cada7ad94390d17`; `w14-mobile.png` 49 584 B
     sha256 `e175b8c28a246f14b538f8a9d273dd27a4149f690132ce948b2a872bb64c37af`; `w14.json` 1 662 B
     sha256 `b542a3f453c46de2523770640f82def67c9385bccfcd08495914c1ba45684eb5`.
5. **Server killed right after**: npm session killed; the win32-orphaned vite child (PID 13508, verified
   cmdline `…RapidTool Main\node_modules\…\vite.js … --port 8090`) terminated with
   `MSYS_NO_PATHCONV=1 taskkill /F /PID 13508` → `netstat` greps 8090 clear; no stray RapidTool node procs.

## §3 What the pixels show (viewed via vision on the actual PNGs)
**Desktop 1280×800** — a dark, unstyled-free console landing page: top bar with a small logo mark + wordmark
`RapidTool / autonomous software agency` (left) and mono `phases 0–12 · graph locked` (right); left column:
eyebrow `GOVERNED DELIVERY`, serif hero `Research first. Code second. Ship with a paper trail.`, paragraph
`RapidTool runs a deterministic 13-phase graph with four onboard algorithms: Intent Lattice, FusionRank memory,
Constraint Scheduler, and an Agent Packet compiler that turns the run into a paste-ready prompt for other agents.
Illegal jumps are rejected.`; a `Client brief` textarea with placeholder `Describe the system to build — who it
is for, the jobs it must do, and any hard constraints.`; amber `Open intake →` button with mono note `Phase 0
starts locked to the brief`; four example chips `Field dispatch · Shop quoting · Clinic ops · Marketplace`.
Right: `Builds 0` panel with dashed empty-state `No builds yet. Paste a brief to open Phase 0.` Layout clean —
no overlap/clipping, type crisp, spacing consistent; below the fold the page continues (screenshot is
viewport-only, `fullPage:false` — that is by design, not a truncation bug).
**Mobile 390×844** — same header (compact; the phases lock-note is hidden), hero wraps to 3 lines, paragraph,
textarea, button, note, chips wrap 3+1; no horizontal overflow; nothing overlapping; clean.
**Verdict: no visual defects found on this view** (and the machine-visible surface agrees: 0 console errors,
0 page errors, status 200 both viewports, no overflow).
**Scope honesty**: this is the landing/intake state of a fresh dev server (`Builds 0`). No build was opened,
so console tabs/panels states were not rendered — see R6.

## §4 Findings ledger (declare-or-strike)
- **FIXED (1)** — `checkedOutputPath` unsatisfiable on Windows → resolve-both-sides fix, verified by pre/post
  harness runs (§1) + eslint 0 + the smoke itself now writing under `C:/workspace`.
- **REGISTERED (7)**:
  - **R1 · Port 8080 held by a foreign dev server** (`contractorapp`, PID 14140 since 09:43; sibling clone,
    another agent's). `npm run dev` as written fails (`strictPort:true`); the pass ran on 8090. Re-run of the
    literal `http://localhost:8080/` smoke is possible once that process frees the port — do not kill it from
    this lane. (Evidence: dev.log + wmic cmdline above.)
  - **R2 · No unit pin for the guard**: there is no `scripts/browser-guard.test.mjs`; the 4-case harness lives in
    scratch (`C:/Users/mnril/w14l3_scratch/guard-check.mjs`, contents tiny — port it as a pin in a lane that owns
    new files; creating it was outside this lane's file box).
  - **R3 · `brandWarnings`: no custom `public/og.jpg`** → platform serves the og.grok.me placeholder (true
    statement about this repo; RapidTool is not a "plain utility" per the note). Brand-asset pass pending — not
    a console.tsx/styles.css defect, so not fixed here (out of box).
  - **R4 · Cross-app smoke artifact explained** (see §2.4): the diverged auth warning in the first attempt came
    from probing the foreign app's env; the real run has `authWarnings: []`.
  - **R5 · Dev-server log noise (low)**: `Error: aborted … ECONNRESET, status:500, unhandled:true`
    (`node:_http_server abortIncoming`) logged at 1:04:41/1:05:13 PM, plus `[vite] (ssr/client) warning:
    dynamic import cannot be analyzed` for the **by-design** server-only seams (`store.ts:776`, `engine.ts:2580/
    :2604/:3446` — the string-concat dynamic imports AGENTS.md mandates), plus post-smoke optimizer/HMR lines
    (`dependencies optimized … reloading`, `hmr update /src/styles.css?direct`). None is browser-visible
    (verdict errors are empty); classification: client-abort noise (curl `--max-time` probes + page closes) +
    intentional import seams. No action taken; recorded so nobody re-derives it as new.
  - **R6 · Residual pixels NOT yet looked at**: `fixes/218` §4:116–119 names the **tiered tab strip, the Export
    menu, the focus ring, and the current-step line** for a browser pass; those need a build-open console state
    (fresh server shows `Builds 0`). This pass retires "nobody has looked at these pixels" **for the landing
    view only**; a follow-up smoke with a loaded build (or a guided intake run) is the remaining observation.
  - **R7 · Host environment traps for future lanes**: background `node` = `winpty node.exe` alias → dies with
    `stdin is not a tty`; `node_modules/.bin` absent from PATH outside npm → `with-app-env` cmd lookup fails;
    `//F`-style taskkill args must go through `MSYS_NO_PATHCONV=1`. Launch dev via npm in background, and kill
    the **vite child PID** (npm kill alone orphans it on win32).

## §5 Honest limits of this pass
- The smoke ran on **8090** (R1), not 8080; nothing about the app changes with the port, but the literal
  command in the lane spec could not be run against RapidTool while the foreign server holds 8080.
- `allowedDirs` resolution note: `resolve("/workspace")` resolves against the current drive (C: here) — same as
  the resolved target on this host; drive-relative POSIX inputs on another drive would still refuse (unchanged
  semantics, documented, not a defect).
- No baseline comparison was run (no `--baseline` requested) and no keyed run (no key on host) — verdict is
  unkeyed/dev only, as expected.
- Only `scripts/browser-guard.mjs` was edited; all other `M` entries in `git status` belong to other lanes.
