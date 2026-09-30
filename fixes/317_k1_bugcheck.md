# 317 — K1: THE BUG ANALYZER (audit every J-lane task; clean up after them)

Lane: K1 (bugcheck/consolidator). Repo: `C:\Users\mnril\Desktop\RapidTool Main`.
Entry: HEAD=`6a9ff96`, tree clean (verified `git status` empty at 20:04).
Siblings live (deleg_2c97d845, started 20:02): J1 task-0 (oracle caller wire; owns `src/lib/compile-check.server.ts`, `scripts/run-eval.mjs`, `scripts/run-eval.test.mjs`, `src/lib/entry-oracle.ts`), J2 task-1 (keyed-run checklist; owns `fixes/317_j2_preflight.md`), J3 task-2 (leftover tails; owns probes + `wave_plans/W43/COMPLETION-TASKS.md`), J4 task-3 (D1 S-checklist; owns `src/lib/wild-step.test.ts`, `src/lib/wild-seal.test.ts`, CLI legs, `fixes/313_d1_seal.md` append).
Method: ~6 sweeps with waits; audit each lane's landed diffs as it goes quiet (`git diff` on its files), hunt classes (a) call-site wired-never-invoked, (b) spread dropping a key, (c) guard that can't fire, (d) unused import, (e) proxy-pin, (f) stack-leak error path, (g) lying doc/comment. Tiny fixes only in DEAD files (mtime + `git status` + lane ownership checked first); everything else ticketed here. Final: full suite + typecheck + lint on the quiet tree.

## Sweep tracker

| Sweep | Time | J1 | J2 | J3 | J4 | Notes |
|-------|------|----|----|----|----|-------|
| 1 | 20:05 | LIVE (reading code) | LIVE (reading) | LIVE (reading) | LIVE (reading) | baseline: HEAD 6a9ff96, diff empty |
| 2 | 20:13 | LIVE — patching `compile-check.server.ts` (+144 mid-flight) | LIVE — ran typecheck (keyed-run evidence) | LIVE — metering tails landing in `headless.ts`/`wild-mode.server.ts` (CF-SE2-3b) | LIVE — reading engine.ts wild region | new: `src/lib/budget-coverage.test.ts` (J3 pin?); K2 watchdog lane live (`fixes/317_k2_watchdog.md`) |
| 3 | 20:22 | **DEAD (cap @20:13, partial)** | LIVE (gate.sh) | **DEAD (cap @20:15, partial)** | LIVE (patching engine.ts) | J1+J3 cap-dead mid-task; K1 audits their frozen diffs (below) |
| 4 | 20:32 | dead | LIVE (keyed evidence) | dead | **DEAD (cap @20:27, partial)** | J4 closed; L-fleet (L1/L2/L2W closed, L1W live) still writing `store.ts`/`store.test.ts`/`gate-stats.ts` |
| 5 | 20:39 | closed 20:31:47 | **closed 20:31:47 — `completed` (the only clean finish)** | closed 20:31:47 | closed 20:31:47 | ALL J lanes closed; J2's `317_j2_preflight.md` (222 lines) landed |
| 6 | 20:47 | — | — | — | — | **ALL writers quiet** (L1W closed 20:36:51; K2 died 20:10) — tree frozen, diffstat stable ×2 sweeps |
| 7 | ~20:50 | — | — | — | — | K1 landed R9 fix; **FREEZE GATES** run (below) |

## Pre-audit observations (HEAD state, for later verification)

- **J1's I1 dead-import fix owed:** at HEAD, `scripts/run-eval.mjs` imports 9 symbols that appear on import lines only (L112-124): `checkEntryContract`, `manifestFind`, `manifestHas`, `runEntryOracle`, `validateExpectedBehavior`, `isKnownRtEvent`, `appendRtLine`, `makeCliRow`, `resolveLogDir`. J1.3/J1.4 must wire or remove ALL — re-grep after landing (count must be ≥2 for wired ones: import + at least one use).
- **J3's metering hunks (mid-flight, audited at completion):** `headless.ts` `bareNodeLiveOverlay` gains `if (comp && comp.usage) recordSessionSpend(comp.usage);` before the ok-check; `wild-mode.server.ts` `createWildClassifier` gains `if (res && res.usage) recordSessionSpend(res.usage);`. Audit: (i) usage shape matches `TokenSpend` (typecheck), (ii) placement after call / before early-returns that skip metering, (iii) refusal paths metered too (I2 rule: refusal that burned tokens counts).

## Findings (per-task audit table — filled as lanes land)

| # | Lane | Verdict | File:line | Class | Exact fix | Landed? |
|---|------|---------|-----------|-------|-----------|---------|
| K1-R1 | J1 | REMAINDER (owed pin) | `src/lib/compile-check.server.test.ts` (unmodified) | (e) pin-owed — the "wrong output BITES" pin was never written; J1 died at cap before it | Add: good tree + correct declared row ⇒ verdict pass; tree declaring `expectedBehavior` but producing WRONG OUTPUT ⇒ `outcome.ok:false` + error names the failed row; absent-declaration ⇒ no `behavior` key + byte-identical hash. [J1.2] | NO — ticket (file dead; parent/successor) |
| K1-R2 | J1 | REMAINDER (dead imports + duplicates) | `scripts/run-eval.mjs:112-124` (5 of 6 entry-oracle imports + all 4 rt-events/runtime-log imports import-only; eslint flags exactly 9 unused — J2 lint run) + local duplicates `evaluateEntryRunsRow` (:831) / `checkExpectedBehavior` (:920) remain | (d) unused import — J1.3/J1.4 died first (J1's own summary confirms). NOTE: `normalizeEmittedFiles` IS wired (:921/:1016/:1074) — do NOT remove that one. | Wire the 5 entry-oracle + 4 rt-events imports per J1.3/J1.4 (dedup + T5.4 emissions) rather than deleting — the imports are the plan's scaffolding; re-grep must show ≥2 hits per kept symbol. | NO — ticket |
| K1-R3 | J1 | REMAINDER (T5.4) | `scripts/run-eval.mjs` | (d)+(a) — rt-events run-level emissions never landed; imports still dead | Land T5.4 per J1 brief (bounded run-level rows, mirror wildStep seed shape, `grep -c rt-events > 0` pin). [J1.4] | NO — ticket |
| K1-R4 | J3 | REMAINDER | `fixes/316_h2_policy.md` §4 | doc (unlanded item D4) | Append the T3.4 write-path disposition table (§4.0 scan + §4.1 table). | NO — ticket |
| K1-R5 | J3 | REMAINDER (recorded bug, J3-D6) | `src/lib/compile-check.server.ts:75,176` | (c)-adjacent: `MAX_FILES=2000` silent partial walk (`return` — no signal), contrast `MAX_CHECK_BYTES` fails loud | Make the overflow loud (note/flag). J3 recorded "ready-to-apply patch text" in its summary; now unblocked (J1 dead). | NO — ticket (parent/successor) |
| K1-R6 | J3 | REMAINDER (J3-D7) | 5 `probe-*.mjs` at repo root + `C:\Users\mnril\_rt_v1_seal_probe.ts` | hygiene | Move probes → `fixes/317_probe_*.mjs` (MOVED header, runnable preserved); delete outside file. | NO — ticket |
| K1-R7 | J3 | REMAINDER (J3-D8) | `wave_plans/W43/COMPLETION-TASKS.md` | doc | W43 status flips (status + evidence columns only) + count line. | NO — ticket |
| K1-N1 | J1 | NOTE (scope, not a bug) | `src/lib/compile-check.server.ts:1131` | (a)-adjacent — declaration source has ZERO writers: no `expectedBehavior` writer into `.rapidtool/project.json` anywhere in src/scripts (graders carry it eval-side and are leak-scanned out of trees) | Wire is data-reachable only (hand-authored tree). Parent must decide the declaration writer/flow, or accept data-driven trigger; pins J1 owes will construct declarations in-fixture. | recorded |
| K1-N2 | J3 | NOTE | `scripts/rapidtool-cli.mjs:1167` | recorded by J3: `ingest` save is bare `saveProject` (busy hit ⇒ global error net, not coded exit-1 + preserved) | Candidate future tiny swing; unowned now. | recorded |
| K1-J2 | J2 | **AUDIT CLEAN** | `fixes/317_j2_preflight.md` (222 lines) | — | No product edits (correct for a probes lane — verified `git status`). Checklist read in full: every claim stamped with command + verbatim output + date/HEAD; snapshot caveats honest (lint 9 warnings attributed to J1's imports; ±1 TAP accounting noted). §1d 39/39 stamp predates J4's §S5 pin (+1 test — freeze re-run expected 40). | n/a |
| K1-J4 | J4 | **AUDIT CLEAN (landed parts)** | `src/lib/wild-seal.test.ts` §S5 (+46) · `src/lib/engine.ts` (comment-only) | — | §S5 pin is a real behavioral pin (13 steps / status complete / `wild.complete` / 4 seal-tagged rows / margin 7) — not a proxy. engine.ts = doc-only correction (old doc claimed fractions clamp to 0; code floors — 315 V2 #7 resolved; no behavior change). | n/a |
| K1-R8 | J4 | REMAINDER (J4-not-done list, from its own summary) | `fixes/317_j4_pins.md` (t0 skeleton) · `fixes/313_d1_seal.md` (S1–S8 table not appended) · `README.md`/`START-HERE.md` counts (drift MEASURED by J4: tracked 1846→1889, fixes 532→565, src 215→223, src/lib 204→212=120+92, scripts 45→46=24+22, root 45→46, verbs 39 unchanged) · `engine.ts` docstring-edit legs not re-run | doc/remainders | (1) write J4's evidence ledger; (2) append closed S1–S8 table to `313_d1_seal.md`; (3) apply README/START-HERE count edits (numbers already measured, refs listed by J4); (4) re-run wild-step/typecheck (comment-only change — covered by K1 freeze gates). | NO — ticket (parent/successor) |
| K1-R9 | J4 | NIT (class g) | `src/lib/wild-seal.test.ts:274-276` comment cites `store.ts:1239/:1282`; actual now `:1241`/`:1283` (drift from L1W's concurrent store.ts edits) | (g) stale comment refs | Update the two line numbers (K1 lands this tiny fix once L1W stops editing store.ts — re-check numbers at edit time). | PLANNED |
| K1-R10 | — | NOTE (co-edits, non-J) | `src/lib/store.ts` ("317_l1w" classifyError hunks), `src/lib/gate-stats.ts` (round2→round3 rename, L-lane) | — | Not J-lane diffs; included in K1's freeze gates for completeness. store.ts includes 3 classifyError-on-throw hunks; gate-stats rename is behavior-neutral (same math). | n/a |
| K1-R11 | — | NIT | `src/lib/wild-seal.test.ts:71-76` | (d)-cousin: unused local `rejecting` (lint warning #10; pre-existing at HEAD — not a J-diff line) | Delete the `const rejecting: WildReviewer = …` block if no successor reuses it; better, use it in a §S3 retry pin if one lands. | NO — ticket |

### J1 wire audit detail (task-0, cap-dead — "never compiled or tested")

- 7 patches to `src/lib/compile-check.server.ts`, diff read in full: import (3 symbols, all used), `TreeBehaviorVerdict` type, `outcome.behavior` (additive optional), `treeVerdictHash` conditional `behavior` key, `treeRelPath` guard + `treeBehaviorOf` helper, `treeRun` wiring + `ok` fold.
- Classes: (a) `treeRun` is the real funnel (tree-run/emit --run/repair) ✓; (b) spreads clean (all 9 record keys + source/refusal present) ✓; (c) all guards reachable ✓; (d) all imports used ✓; (f) refusal is prose+coded-style, no stack leak, `readJsonIfAny`/`statSync`/spawn all caught ✓; (g) docs match code (incl. byte-stable claim) ✓.
- **Independent verification:** `npm run typecheck` = **exit 0** (I ran it on the frozen bytes); `node --experimental-strip-types --test src/lib/compile-check.server.test.ts` run this sweep (result below).

### J3 audit detail (task-2, cap-dead)

- Landed: `headless.ts:442` + `wild-mode.server.ts:276` metering (placement verified: after the call, before the `!res.ok`/degradation branches; not-configured early-return is ABOVE the provider call → spends nothing, comment accurate); `src/lib/budget-coverage.test.ts` (10/10 re-run by me, exit 0); `fixes/312_c3_lifecycle.md` E2 ledger append (claims byte-checked: 3 recordSessionSpend sites match the grep exactly).
- Independent legs: budget-coverage 10/10 · wild-mode+token-ledger+packet 103/103 (matches J3's 10/31/62 claims).

## Landed fixes

- **K1-R9 (landed ~20:50, class g — lying comment):** `src/lib/wild-seal.test.ts:21,310-311` — the §S5 comment cited `store.ts:1239/:1282`; the refs had drifted +2 under L1W's concurrent store.ts edits. Updated to `:1241`/`:1283` (re-verified against current store.ts bytes at edit time). Comment-only change. **Proof:** `node --experimental-strip-types --test src/lib/wild-seal.test.ts` → **11/11 pass, exit 0** after the edit.
- **Nothing else landed — deliberate, documented.** Every other candidate was either plan-scaffolding (run-eval's 9 dead imports → the successor must WIRE them per J1.3/J1.4, deleting would undo the plan; K1-R2/R3), a semantic change owed a successor + pin (MAX_FILES loud-fail; K1-R5), or not a J-diff line (rejecting; K1-R11). Each ticket row carries the exact fix text so a successor applies in seconds.

## Final gates

**Freeze @ 2026-09-29 ~20:50–20:53.** Tree = committed HEAD `6a9ff96` + uncommitted fleet edits (9 modified + 11 untracked; `git diff --stat` = 242 insertions/18 deletions; all writers closed — quiet re-check: only K1's own transcript moved after 20:37).

| Gate | Command | Result |
|---|---|---|
| typecheck | `npm run typecheck` (unpiped) | **exit 0** |
| lint | `npm run lint` | **exit 0** — 10 problems, **0 errors** (9 = the K1-R2 run-eval dead imports; 1 = pre-existing `wild-seal.test.ts:71` `rejecting` → K1-R11) |
| full suite | `npm test` (both legs) | **exit 0** — scripts leg **355/355** pass; src leg **2461 tests · 2460 pass · 1 skip · 0 fail** |
| build | `npm run build` | **exit 0** (vite + nitro built; `db:migrate` skipped — PGLite fallback, expected) |
| assertion-gaps | `node scripts/check-assertion-gaps.mjs` | **exit 0** — 115 test files, 0 findings |
| gate.sh (cross-ref) | `bash scripts/gate.sh` run by J2 @20:19 on the mid-flight tree | all 6 gates `ok:true` (typecheck 0 / lint 0 / gaps 0 / build 0 / scripts 355 / lib 2459), wallMs 594143 — cite `~/j2_gate.json` |

**Suite delta vs J2's snapshot:** src leg 2459 → 2461 (= +1 J4 §S5 pin +1 L1W store.test.ts pin), 0 fail both times — consistent. These are the FRESHEST numbers (K1 re-ran everything on the frozen tree after the last writer closed).

**Final gate picture: the frozen tree passes all four boundary gates (typecheck 0 · lint 0 errors · suite 0 fail · build 0). No standing red exists; the fleet's unfinished work is the ticket set above (J1.2/J1.3/J1.4, J3's D4/D6/D7/D8, J4's D1-D5, plus nits), none of which is a red on disk.**
