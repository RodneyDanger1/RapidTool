# 318_a6_watch — W44 lane A6 · THE WATCHDOG (six-lane wave guard)

- **Role**: recorder + accuracy net + zero-loss guard for the W44 Phase-1 wave (lanes A1..A6). **AUDIT-ONLY — I edit NOTHING except this file.** Foreground reads only; no piped gates; no keyed calls; no `git add/commit`.
- **Repo**: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash `/c/Users/mnril/Desktop/RapidTool Main`) @ HEAD `091b389eeb305f043ff0aefdea61461a979bfd1b` (tree CLEAN at dispatch).
- **Fleet under guard** (6 lanes):
  - A1 = coder (oracle tests: `src/lib/compile-check.server.test.ts`, `scripts/run-eval.mjs`, `scripts/run-eval.test.mjs`, `src/lib/rt-events.ts`, `src/lib/rt-events.test.ts`; log `fixes/318_a1_oracle.md`)
  - A2 = coder (`src/lib/store.ts`, `src/lib/store.test.ts`; log `fixes/318_a2_silent.md`)
  - A3 = coder (`src/lib/compile-check.server.ts`, `scripts/write-atomic.mjs`, `scripts/docs-module-parity.mjs`, `scripts/browser-smoke.mjs`, `README.md`, `START-HERE.md`, `src/lib/wild-seal.test.ts`, `fixes/316_h2_policy.md`; log `fixes/318_a3_standard.md`)
  - A4 = coder (`wave_plans/W43/COMPLETION-TASKS.md`, `fixes/318_probe_*.mjs`, `.gitignore`; log `fixes/318_a4_hygiene.md`)
  - A5 = verifier (log `fixes/318_a5_verify.md` only)
  - A6 = me (log `fixes/318_a6_watch.md` only)
- **Transcripts**: `~/AppData/Local/hermes/cache/delegation/live/<deleg>/task-N.log`.

## GUARD CONTRACT (duties)
1. **~8 spaced sweeps**: lane-log mtimes/sizes; `git status --short` vs one-writer map; key artifact growth (`wc -c` of the six logs + touched files); W43 hash-guard; phantom tripwire; damage watch.
2. **One-writer map enforcement** every sweep — flag ANY cross-box write with exact bytes.
3. **W43 hash-guard**: expect constant `d25010bc…487a` / 32573 B until A4 flips; after: `git diff --stat wave_plans/W43/COMPLETION-TASKS.md` + confirm only status/evidence cells moved. RECOVERY line if damaged (NOT to be run by me — for owner/parent): `git show 091b389:wave_plans/W43/COMPLETION-TASKS.md > C:/Users/mnril/w44_w43_recovery.md`.
4. **Phantom tripwire**: grep `stdin is not a tty` across lane logs AND live transcripts (newest dirs); also `exit 1` with zero TAP output. Hit ⇒ append ONE `[PARENT CORRECTION]` block into offending lane log (sanctioned; byte-note here).
5. **≥5 self-run spot-checks** (S1..S5 mandatory + S6 optional): S1 = A1 negative case (run test + hand-repro wrong `entry-runs` row via strip-types scratch script, expect verdict FAIL); S2 = store.ts deepenResearch catch bytes; S3 = crew `--max-steps` read; S4 = moved-probe `node --check` each; S5 = W43 flips vs live bytes.
6. **ZERO-LOSS RESCUE (end)**: scan state.db messages + delegation summary files for findings never landed in lane logs; append verbatim with lane/source/why-it-matters; honest loss count.

## ONE-WRITER MAP (enforced)
| Writer | Owns |
|---|---|
| A1 | `src/lib/compile-check.server.test.ts` · `scripts/run-eval.mjs` · `scripts/run-eval.test.mjs` · `src/lib/rt-events.ts` · `src/lib/rt-events.test.ts` · `fixes/318_a1_oracle.md` |
| A2 | `src/lib/store.ts` · `src/lib/store.test.ts` · `fixes/318_a2_silent.md` |
| A3 | `src/lib/compile-check.server.ts` · `scripts/write-atomic.mjs` · `scripts/docs-module-parity.mjs` · `scripts/browser-smoke.mjs` · `README.md` · `START-HERE.md` · `src/lib/wild-seal.test.ts` · `fixes/316_h2_policy.md` · `fixes/318_a3_standard.md` |
| A4 | `wave_plans/W43/COMPLETION-TASKS.md` · `fixes/318_probe_*.mjs` · `.gitignore` · `fixes/318_a4_hygiene.md` |
| A5 | `fixes/318_a5_verify.md` only |
| A6 | `fixes/318_a6_watch.md` only |

## BASELINE (sweep 0 @ dispatch-check)
- `git rev-parse HEAD` = `091b389eeb305f043ff0aefdea61461a979bfd1b` ✓ (matches dispatch).
- `git status --short` = **EMPTY** (tree clean at baseline).
- W43 doc: **32573 bytes**, sha256 `d25010bca77339c783da8ef56b526b870ba36c218e782a0bcd1394224da1487a` ✓ (matches expected `d25010bc…487a / 32573 B`).
- 318 lane files present at baseline: **none** (`ls fixes/318_*` → no match). I am first to write.
- Recovery line recorded above (guard clause 3).

## TIMELINE / SWEEPS
- **S1 @10:07:12** — Wave = `deleg_4ddea074` (6 tasks: t0=A1 t1=A2 t2=A3 t3=A4 t4=A5 t5=me). HEAD `091b389`. `git status --short`: 5 untracked lane logs (`318_a1_oracle`, `318_a3_standard`, `318_a4_hygiene`, `318_a5_verify`, `318_a6_watch`) — **`318_a2_silent.md` NOT yet present** (A2 mid-recon; watch). No product edits yet. W43 sha `d25010bc…487a` / 32573 B intact ✓. Root still has 5 probe*.mjs (A4 not moved yet). Phantom tripwire: transcripts 0 hits; lane-log grep self-matched only on MY instruction text (my grep pattern matched my own log — harmless; script now excludes a6). Transcript bytes: t0=10236 t1=10290 t2=11490 t3=9190 t4=4594 (mtime 10:06) t5=7268. **Artifact byte-baseline** (wc -c): compile-check.server.test.ts=63436 · run-eval.mjs=167475 · run-eval.test.mjs=73969 · rt-events.ts=19260 · rt-events.test.ts=6953 · store.ts=91843 · store.test.ts=91306 · compile-check.server.ts=94444 · write-atomic.mjs=4888 · docs-module-parity.mjs=4805 · browser-smoke.mjs=6042 · README.md=56349 · START-HERE.md=9346 · wild-seal.test.ts=15114 · 316_h2_policy.md=7146.

- **S2 @10:09:43** — **A4 MOVED all 5 probes via `git mv`** → `fixes/318_probe_{h1_p7,h6_lessonchain,i4_busy,k9_kinds,n2_f316}.mjs` (porcelain `RM` rows); root `ls *.mjs` = `eslint.config.mjs` ONLY ✓. **A3 landed `M src/lib/compile-check.server.ts` 94444→94581 B (+137 B — MAX_FILES loud-truncation)**. **A2's log STILL ABSENT** (`fixes/318_a2_silent.md` not in git status) — A2 transcript largest grower (10290→21052 B), active on err-string sweep; log-first watch ON. Lane logs: a1=2695@10:06 · a3=1917@10:07 · a4=3070@10:06 · a5=898@10:06 · a6=5337. Transcripts: t0=16356 t1=21052 t2=18068 t3=19502 t4=20442 t5=11538 — all fresh (≤90s). W43 sha intact ✓. Phantom tripwire: 0 hits (lane logs + transcripts). One-writer check: touched files = probes (A4 ✓) + compile-check.server.ts (A3 ✓); no cross-box writes.
- **S3 (crew `--max-steps`) — VERIFIED @10:08 (self-run).** Bytes: `scripts/rapidtool-cli.mjs:2332-2336` crew arm reads `args[\"max-steps\"]` (`typeof === \"string\"` + `/^\\d+$/` + `parseInt`) with comment `316 H7 (carried by I4)`; usage string `:4049` documents `[--max-steps <n>]`; pin text `scripts/cli-run-busy.test.mjs:216-219` asserts `CLI_TEXT.includes('typeof args[\"max-steps\"] === \"string\"')`. I re-ran `node --test scripts/cli-run-busy.test.mjs` → `# pass 4 · # fail 0` (incl. `ok 4 - 316 H7 — crew reads the documented --max-steps key`), exit 0.
- **S4 (moved probes) — VERIFIED @10:10 (self-run).** Root: only `eslint.config.mjs` remains. All 5 moved probes `node --check` → SYNTAX OK (`fixes/318_probe_h1_p7.mjs`, `_h6_lessonchain`, `_i4_busy`, `_k9_kinds`, `_n2_f316`).
- **SW4 @10:16:21** — **W43 FLIPPED (first pass)**: sha `d25010bc…` → **`f3e4349f…` / 33430 B** (+857). Diff = 4 rows only: T8.1 LANDING→LANDED (cites 317_j2_preflight §1; committed `71154b1`/`f270b38`) · T8.4 LANDING→LANDED (`rapidtool-cli.mjs:289-297` remedy seam `4e50d26`; pin `cli-exit-taxonomy.test.mjs:616`) · T10.1 OWED→LANDED `f270b38` (grep=0) · T10.2 LANDING→LANDED. **Count line :134 NOT yet touched** (A4 final sweep pending — WATCH). Diffstat 4+/4−, no structural deletions. **A1 landed `M src/lib/compile-check.server.test.ts` 63436→70627 B (+7191)** — wrong-output pin landing. **A3 landed nits**: `browser-smoke.mjs` 6042→6182 (+140) · `docs-module-parity.mjs` 4805→5102 (+297) · `wild-seal.test.ts` 15114→**14984 (−130** — item-6 `rejecting` cleanup; shrink explained, sanctioned owner). `write-atomic.mjs` UNCHANGED (why-not item pending). A2 log 12261→14202. No cross-box writes (all touched files within owner boxes). 0 phantoms. Transcripts: t0=28555 t1=37492 t2=36198 t3=43444 t4=30621 t5=24738.
- **SW4-b (S5 first-pass flips vs live bytes) @10:18 — VERIFIED (4/4).** T10.1: `grep -c "text-\[11px\]\|text-\[10px\]" runtime-timeline-pane.tsx cmd-palette.tsx` → **0/0** ✓. T10.2: `probe_c1_arith.mjs` absent ✓ + root probes empty ✓. T8.4: remedy seam bytes at `rapidtool-cli.mjs:289-297` (`remedyFor(code)` → `entry.agentAction`) ✓ + pin `:616` asserts `remedy` includes `"wild --start --agent-seal"` ✓. T8.1: `--agent-seal` wired in CLI (`:116-130` refuse block, `:693/:828/:874` guards, usage `:44`) ✓.
- **SW5 @10:20:06** — **A1 landed `M scripts/run-eval.mjs` 167475→153031 B (−14444; diffstat 46+/355− = the entry-oracle DEDUP: local `packageTargetPaths`/`entryRunTail`/`entryRunBudget`/`entryRunEnv`/`evaluateEntryRunsRow` bodies removed; imports now `checkEntryContract, manifestFind, manifestHas, normalizeEmittedFiles, runEntryOracle, validateExpectedBehavior` from `../src/lib/entry-oracle.ts` (:103-117) + `isKnownRtEvent` from rt-events (:122) + runtime-log imports (:123))** + **`M src/lib/rt-events.ts` +3 (new scope `"eval-run"` in RT_SCOPES :48-50)**. **A3 appended `fixes/316_h2_policy.md` 7146→15319 (+8173 — T3.4 disposition table)**. **W43 SECOND PASS**: 33430 → **36476 B / sha `d88f347d…`; diffstat 17+/17−** (13 rows now flipped: T1.4/T7.1 probe-path notes; T2.2 LANDED `f270b38`; T2.3 LANDED-core (remainders kept OWED); T3.2 LANDED (CLI mount kept OWED); T3.4 in-flight note; T4.4 LANDED+kept caveat; T5.1/T5.3 LANDED `ba5a392`; T5.4 in-flight note (letter-only); T6.2 LANDED ((c) kept OWED); T8.2 LANDED; T9.3 LANDED-slice). **Count line :135-136 STILL reads 14 LANDED/12 LANDING/17 OWED — final-sweep update OWED (WATCH).** **A1's log still 2695 B @10:06** (no append since; transcript live 37241 — cap-risk watch ON). No cross-box writes. 0 phantoms. Transcripts: t0=37241 t1=41535 t2=45379 t3=52955 t4=33851.
- **SW5-b (S5 second pass vs live bytes) @10:22 — VERIFIED (4/4).** T5.1: `grep -rn recordSessionSpend src/lib` → call sites **exactly** `engine.ts:2997` · `headless.ts:442` · `wild-mode.server.ts:276` ✓. T2.2: `iterate.ts`=20496 B · `iterate.test.ts`=20167 B — exact byte match to the W43 claim ✓. T3.2: `selfmod.ts`=28528 · `selfmod.server.ts`=28388 · `selfmod.test.ts`=20374 · `selfmod.server.test.ts`=23816 all on disk ✓. T9.3: `treeVerdictHash` at `compile-check.server.ts:663` + call `:1560` ✓ (matches cited lines).

## ANOMALIES / LANE NOTES
(pending)

## SPOT-CHECKS (labels: SC1=A1 neg case · SC2=store.ts bytes · SC3=crew max-steps · SC4=moved probes · SC5=W43 flips · SC6=MAX_FILES re-run; distinct from sweeps S1..S8)
- **SC1 (A1 wrong-output pin) — VERIFIED @10:21 (self-run, own repro).** (1) Read the pin block `compile-check.server.test.ts:1375-1509` (+ helpers `treeRunAsConsumer` :194-205 — scrubs `NODE_TEST_CONTEXT` to avoid the nested-runner phantom class; `writeEmittedTree` :168-174; `PASSING_SPEC` :176). (2) **Own repro** at `~/a6_scratch/repro.mjs` (outside repo): built two scratch emitted trees (`.rapidtool/project.json` declaring `entry-runs` rows; entry prints `emit-ok`); imported the real `treeRun` via absolute file URL; GOOD tree (1 satisfied row) → `ok:true, behavior.ok:true, passed:1`. WRONG tree (adds row `r-wrong` expecting `NEVER-PRINTED`) → **`ok:false`** while compile/specs/entry smoke all pass; behavior.failed=1; row detail `exit 0 in 153ms, but stdout lacks "NEVER-PRINTED" · stdout: "emit-ok"`; error `the tree's declared expectedBehavior contract FAILED (.rapidtool/project.json): r-wrong — …`. SC1_EXIT=0. (3) **Self-ran A1's full suite** `node --experimental-strip-types --test src/lib/compile-check.server.test.ts` → `# tests 60 · # pass 59 · # fail 0 · # skipped 1` (skip = pre-existing opt-in npm-install leg), exit 0.
- **SC2 (store.ts) — VERIFIED @10:14 (full).** A2 diff byte-read: `store.ts:1004-1005` deepenResearch catch now `code: classifyError(err, "RT_E_INTERNAL")` + `// 318_a2:` comment; declaration widened `code?: string` → `code?: ErrorCode` (:127). L1W's **three intact**: comments+returns at `:1041-42` (runVerifyAsync) · `:1095-96` (runP6Journey) · `:1607-08` (runModuleReal F3-08) — post-+1-shift, matching A2's §1 shift note. Pins: `store.test.ts` +21 lines, 2 tests incl. REAL throw induction (`phases: {}` → engine `.find` TypeError → `RT_E_INTERNAL` + `/is not a function/`); **self-ran** `--test-name-pattern 318_a2` → `ok 1`, `ok 2`, `# pass 2 · # fail 0`, exit 0.
- **SC3 (crew --max-steps) — VERIFIED @10:08** (see SW2). **SC4 (moved probes) — VERIFIED @10:10** (see SW2).
- **SC5 (W43 flips) — first pass VERIFIED @10:18** (see SW4-b); second pass VERIFIED @10:22 (see SW5-b); final pass pending A4 close.
- **SC6 (MAX_FILES probe re-run) — VERIFIED @10:24 (self-run).** `node --experimental-strip-types ~/a3_maxfiles_probe.mjs` on current tree: `PROBE files on disk: 2006` → `{"ok": false, "checked": 2, "passed": 1, "failed": 1, "skipped": 1999, "error": null, "verdictsPreview": [{"file":"a-ok.ts","verdict":"pass"}, {"file":".","verdict":"fail","detail":"tree exceeds the 2000-file compile-check budget — walk truncated, results incomplete"}]}` — exact match to A3's claimed AFTER bytes; SC6_EXIT=0. Silent partial walk is dead.

## RESCUES (APPENDED BY PARENT from A6's capped summary — A6 capped mid-rescue; quotes below are A6's captured text)

### RESCUE — A1's stranded evidence (A1 capped @10:20:55 with a skeleton log, 2,695 B; this transcript tail was captured by A6 before its own cap)
- A1(1) wrong-output pin — COMPLETE (`compile-check.server.test.ts` +138/146 lines, cases a/b/c).
- A1(2) run-eval dedup — LANDED + proven: self-proof `BYTE-IDENTICAL — checks=36 fails=0` (36/36); scaffolding `a1_byte_diff.mjs` / `scripts/a1_old_run_eval.mjs` created then removed; imports now `entry-oracle.ts` + `isKnownRtEvent`; −355/+46 lines.
- A1(3) T5.4 — PARTIAL: rt-events.ts catalogue additions landed (scope `"eval-run"` + event map), but run-eval.mjs emission bodies NOT landed (`grep -c rt-events` = 2 → comment+import only, `isKnownRtEvent` never called); run-eval.test.mjs untouched; rt-events.test.ts census pin (sorted event list :80-103) NOT updated → would break when the refactor lands.
- **RESOLUTION (parent):** item 3 completed end-to-end (emitter + 4 bounded sites; census pin fixed; +2 behavioral/wiring pins; a real empty-corpus run emits `eval.run_end`), A1's log filled S1–S4 → `=== END 318_a1_oracle — COMPLETE ===`. The stranded evidence now lives in `fixes/318_a1_oracle.md` (see also `fixes/318_parent_complete.md`). Nothing lost.

## NO-LOSS AUDIT (end) — PARENT COMPLETION, 2026-09-30
- A1: rescued + closed (S1–S4 + item 3 by parent). Standing loss: NONE.
- A2: closed itself (`=== END … COMPLETE ===`); A5-verified; A6 self-ran its 2 pins. NONE.
- A3: capped mid-item-5; item 5 + close landed by parent (`318_a3_standard.md` closed). NONE.
- A4: closed COMPLETE (hash-guard broke only as scheduled; count line updated in its own final sweep — A6's SW5 snapshot predates it; sha trail `d25010bc → d88f347d → dc308ddf` + the parent's 2-cell cite refresh → `4dfd561b`). NONE.
- A5: capped; A2 + partial-A3/partial-A4 verdicts recorded; parent re-runs A1's done-whens + the full gate at the boundary and appends the rest (A3/A4 tables + gate JSON) to `318_a5_verify.md`. NONE standing at close.
- A6: this append closes it. NONE.
- Final loss count: **0** (interim provisional was ≥1 — A1's unlanded evidence — resolved by the rescue above).

=== END 318_a6_watch — COMPLETE (A6: baseline + 6 sweeps + 6/6 spot-checks; rescue + no-loss + END appended by parent from A6's capped summary) ===
