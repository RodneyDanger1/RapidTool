# fixes/305_e1_boundary.md — CODER E1 · LANE L1 ROUND 3 (boundary-prep) · the boundary leg sweep

> W42 · SPEC §3 boundary plan evidence. File box: **this log only** — verify-only round, no product edits.
> Opened EARLY, append-only. Base HEAD: `0deca1e` (`git status --porcelain` → empty at t0; 3 sibling coders live — re-checked per chunk).
> Every leg **FOREGROUND, one at a time**, exit code + `# pass`/`# fail` captured per leg; raw logs kept OUTSIDE the repo at
> `C:/Users/mnril/AppData/Local/Temp/e1_boundary/<id>.log` (+ `results.txt` append). No keyed calls. No pipes on legs (exit codes read directly).
> Rule for any RED: diagnose precisely (which lane's card could touch it · real regression?); **no cross-box fixes** — hand off "for E2/E3/E4" or "for the parent" with the exact file.

## Status board

| Item | What | Status |
|---|---|---|
| S1 | SPEC §3 + 304_d1_accept.md read; leg list mapped to files | DONE |
| S2 | Named leg sweep (22 legs: L1/L2/L4 gates + F2-era baseline legs + E-25 leg) | **DONE — 22/22 GREEN**, 0 fail everywhere; drift-affected legs re-run on fresh sibling bytes |
| S3 | Full-suite boundary globs (`scripts/**/*.test.mjs` + `src/lib/**/*.test.ts`) | **DONE — scripts 337/337 · src 2274 tests / 2273 pass / 0 fail / 1 skip** |
| S4 | Diagnosis of any RED (no cross-box fixes) | **N/A — ZERO reds; nothing to diagnose; no handoffs owed** |
| S5 | Closing block + evidence table | **DONE** |

## Leg mapping (parent list → files)

| # | Parent name | File | Iface |
|---|---|---|---|
| 01 | run-eval.test | `scripts/run-eval.test.mjs` | plain `node --test` |
| 02 | scorecard.test | `src/lib/scorecard.test.ts` | strip-types |
| 03 | fixtures.test | `src/lib/fixtures.test.ts` | strip-types |
| 04 | gate-verdict | `scripts/gate-verdict.test.mjs` | plain |
| 05 | migration-plan | `scripts/migration-plan.test.mjs` | plain |
| 06 | write-atomic | `scripts/write-atomic.test.mjs` | plain |
| 07 | browser-guard | `scripts/browser-guard.test.mjs` | plain |
| 08 | README-cli | `scripts/README-cli.test.mjs` | plain |
| 09 | io.test | `src/lib/io.test.ts` | strip-types |
| 10 | packet.test | `src/lib/packet.test.ts` | strip-types |
| 11 | crew.test | `src/lib/crew.test.ts` | strip-types |
| 12 | store.test | `src/lib/store.test.ts` | strip-types |
| 13 | runtime-log.server.test | `src/lib/runtime-log.server.test.ts` | strip-types |
| 14 | cli-exit-taxonomy | `scripts/cli-exit-taxonomy.test.mjs` | plain |
| 15 | rapidtool-cli-edit | `scripts/rapidtool-cli-edit.test.mjs` | plain |
| 16 | rapidtool-cli-fixtures | `scripts/rapidtool-cli-fixtures.test.mjs` | plain |
| 17 | errors | `src/lib/errors.test.ts` | strip-types |
| 18 | wild-step | `src/lib/wild-step.test.ts` | strip-types |
| 19 | registry | `src/lib/llm/providers/registry.test.ts` (F2-era baseline "registry"; round-2 "registry 34-row" = README-cli error table, covered by leg 08) | strip-types |
| 20 | honesty-guards | `src/lib/honesty-guards.test.ts` | strip-types |
| 21 | checkpoint.server | `src/lib/checkpoint.server.test.ts` | strip-types |
| 22 | the E-25 leg | `src/lib/headless.test.ts` (E-25 = CLI-harness `emit --run` case, fixes/144 M4-1, suite 19) | strip-types |
| G1 | §3 step-3 leg | `node --test "scripts/**/*.test.mjs"` (grand total) | plain |
| G2 | §3 step-3 leg | `node --experimental-strip-types --test "src/lib/**/*.test.ts"` (grand total) | strip-types |

## Leg results (evidence table)

Sweep window 2026-09-29 07:26–07:36 local. `strip` = `node --experimental-strip-types`; `plain` = `node --test`. All runs cwd = repo root, foreground, one at a time, exit code read directly (no pipes). Verdict column shows the LATEST run per leg; `(re-run …)` = sibling WIP moved an input file mid-sweep and the leg was re-run on the fresh bytes.

| # | Leg (parent name) | Command | exit | tests | pass | fail | skip | Verdict |
|---|---|---|---|---|---|---|---|---|
| 01 | run-eval.test | `plain scripts/run-eval.test.mjs` | 0 | 41 | 41 | 0 | 0 | **GREEN** |
| 02 | scorecard.test | `strip src/lib/scorecard.test.ts` | 0 | 5 | 5 | 0 | 0 | **GREEN** |
| 03 | fixtures.test | `strip src/lib/fixtures.test.ts` | 0 | 8 | 8 | 0 | 0 | **GREEN** |
| 04 | gate-verdict | `plain scripts/gate-verdict.test.mjs` | 0 | 6 | 6 | 0 | 0 | **GREEN** |
| 05 | migration-plan | `plain scripts/migration-plan.test.mjs` | 0 | 20 | 20 | 0 | 0 | **GREEN** |
| 06 | write-atomic | `plain scripts/write-atomic.test.mjs` | 0 | 12 | 12 | 0 | 0 | **GREEN** |
| 07 | browser-guard | `plain scripts/browser-guard.test.mjs` | 0 | 6 | 6 | 0 | 0 | **GREEN** |
| 08 | README-cli | `plain scripts/README-cli.test.mjs` | 0 | 12 | 12 | 0 | 0 | **GREEN** (re-run 07:31 after `README-cli.md` edit) |
| 09 | io.test | `strip src/lib/io.test.ts` | 0 | 55 | 55 | 0 | 0 | **GREEN** |
| 10 | packet.test | `strip src/lib/packet.test.ts` | 0 | 57 | 57 | 0 | 0 | **GREEN** |
| 11 | crew.test | `strip src/lib/crew.test.ts` | 0 | 51 | 51 | 0 | 0 | **GREEN** |
| 12 | store.test | `strip src/lib/store.test.ts` | 0 | 77 | 77 | 0 | 0 | **GREEN** (74 → 77 sibling pins; re-run ×3 until bytes stable @07:33:28) |
| 13 | runtime-log.server.test | `strip src/lib/runtime-log.server.test.ts` | 0 | 9 | 9 | 0 | 0 | **GREEN** |
| 14 | cli-exit-taxonomy | `plain scripts/cli-exit-taxonomy.test.mjs` | 0 | 3 | 3 | 0 | 0 | **GREEN** (re-run after `rapidtool-cli.mjs` edit) |
| 15 | rapidtool-cli-edit | `plain scripts/rapidtool-cli-edit.test.mjs` | 0 | 10 | 10 | 0 | 0 | **GREEN** (re-run after `rapidtool-cli.mjs` edit) |
| 16 | rapidtool-cli-fixtures | `plain scripts/rapidtool-cli-fixtures.test.mjs` | 0 | 4 | 4 | 0 | 0 | **GREEN** (re-run after `rapidtool-cli.mjs` edit) |
| 17 | errors | `strip src/lib/errors.test.ts` | 0 | 37 | 37 | 0 | 0 | **GREEN** |
| 18 | wild-step | `strip src/lib/wild-step.test.ts` | 0 | 14 | 14 | 0 | 0 | **GREEN** |
| 19 | registry (provider registry; round-2 "registry 34-row" = error-code table inside leg 08) | `strip src/lib/llm/providers/registry.test.ts` | 0 | 40 | 40 | 0 | 0 | **GREEN** |
| 20 | honesty-guards | `strip src/lib/honesty-guards.test.ts` | 0 | 13 | 13 | 0 | 0 | **GREEN** |
| 21 | checkpoint.server | `strip src/lib/checkpoint.server.test.ts` | 0 | 7 | 7 | 0 | 0 | **GREEN** |
| 22 | **the E-25 leg** | `strip src/lib/headless.test.ts` | 0 | 96 | 96 | 0 | 0 | **GREEN** (re-run after `headless.ts` edit; TAP: `ok 19 - E-25 — CLI machine contract (exit codes + envelope + doctor)`) |
| G1 | §3 step-3 grand leg 1 | `plain "scripts/**/*.test.mjs"` | 0 | 337 | 337 | 0 | 0 | **GREEN** (final run 07:33) |
| G2 | §3 step-3 grand leg 2 | `strip "src/lib/**/*.test.ts"` | 0 | 2274 | 2273 | 0 | 1 | **GREEN** (final run 07:34; 1 legit skip) |

## Notes / diagnoses

- **Tree under test:** HEAD pinned `0deca1e` the whole sweep (no new commits); working tree = `0deca1e` + sibling WIP. 3 siblings live: they landed `README.md` · `RESUME.md` · `START-HERE.md` · `docs-FOLDER-MAP.md` · `remainingwaves.md` · `taskuniverselog.md` · `scripts/README-cli.md` · `scripts/rapidtool-cli.mjs` · `src/lib/headless.ts` · `src/lib/store.test.ts` (+ untracked `fixes/305_e{1,2,3,4}*.md`) during the window. Final `git status --porcelain` = 14 paths (10 M tracked + 4 ?? logs).
- **Drift protocol (why some legs show re-runs):** any leg whose input file mtime moved after its run was re-run before the record froze: `store.test.ts` 74→77 (+3 sibling pins, re-run until mtime stable at 07:33:28): `README-cli.md`+`rapidtool-cli.mjs`→legs 08/14/15/16 re-run 07:31; `headless.ts`→leg 22 re-run 07:32; both grand globs re-run last (G1 07:33:58-end, G2 07:34–07:36).
- **E-25 tooth:** the F2-era red (`fixes/276` A12 / `fixes/251` rows #39–40) is live-green today — subtest `ok 19 - E-25 — CLI machine contract (exit codes + envelope + doctor)` inside the 96/96 headless leg.
- **Count growth vs context baseline** is all sibling-WIP: src glob 2271 → 2274 (+3 E2 store pins), store leg 74 → 77. No regressions; every pre-existing count (337 scripts, crew 51, packet 57, io 55, run-eval 41, etc.) unchanged.
- **ZERO reds** → no diagnosis needed, no cross-box fixes made, nothing owed to E2/E3/E4 or the parent from this sweep.
- No keyed calls anywhere. Raw per-leg logs + append-only `results.txt` (32 rows): `C:/Users/mnril/AppData/Local/Temp/e1_boundary/`.

## Closing block

**BOUNDARY LEG SWEEP GREEN on 0deca1e + siblings' WIP** — 2026-09-29 07:36 local.

- Named legs **22/22 GREEN** (exit 0, `# fail 0` on every leg), incl. the E-25 leg (`headless.test.ts` 96/96; `ok 19 - E-25 — CLI machine contract`).
- §3 step-3 grand legs: **scripts 337/337** (exit 0) · **src 2274 tests / 2273 pass / 0 fail / 1 legit skip** (exit 0).
- Zero reds → nothing to diagnose, nothing handed off; tree-state caveat recorded above (sibling WIP counts 74→77 / 2271→2274, all re-run fresh).
- Evidence table above is the record the W42 close-out rides on.
