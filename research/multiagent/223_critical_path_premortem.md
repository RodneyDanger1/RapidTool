# 223 · AUDITOR 1 — Critical-path pre-mortem (keyed run / Step 0)

**Wave W13 · written 2026-09-24 · READ-ONLY except this file.**
**Plan followed:** `wave_plans/W13/aud-1.md` (read in full, first).
**Host truth:** no model key (`llm.configured:false`) — the keyed path was **not executed**. Every keyed
behaviour below is labelled `TRACED` (read in code today), `RAN-keyless` (executed keyless on a scratch
project), or `EVIDENCE` (read from the last keyed run's surviving artifacts on disk, 2026-09-10).
Nothing in this file claims a keyed execution.

**The two artefacts that made this pre-mortem decidable**
1. The **last keyed run's own project ledger** survives on disk:
   `research/eval-out/coffeehouse2home-property-ledger/.rapidtool/project.json` (2026-09-10) — I read it
   today. It shows `enforceDod:true`, P0–P5 gates green, **P6 complete with no green gate, 50+ identical
   `dod.blocked` rows, `currentPhase:6`** — i.e. the last keyed run died *exactly* where the code below
   says the next one will.
2. A keyless scratch probe I wrote and ran today (`C:/Users/mnril/w13a1_scratch/probeA.mjs`,
   `RAN-keyless`) that reproduced the floor gates on today's bytes and **proved the enforceDod stall
   shape** with a real `runUntilGate` call.

---

## 1. Pre-mortem verdict

**Predicted keyed outcome for `npm run eval -- --keyed` (Step 0, coffeehouse2home entry, webapp→`kind:"app"`):**

> **5/9, honest range 3–6/9, score centred on 4–5/9, with `status:"dod"` — the run will NOT crash and will
> NOT lose its number, but the P6 journey cannot converge on this tree, the post-journey drain will stall
> in an 80-round hard-DoD spin, and the score will be composed of three near-certain greens (M5, M6, M8),
> three near-certain zeros (M3, M4, M9) and two coupled coin-flips (M1, M2 — M7 rides on them).**

Code reasons, in execution order:

| # | What happens | Where | Why it is near-certain |
|---|---|---|---|
| 1 | Pre-drain reaches the P6 gate and both stock gates are approved | `scripts/run-eval.mjs:769-774`; `headless.ts:661-705` | `RAN-keyless`: floor gates **P0–P5 all `passed:true`** on today's bytes (probe A), approvals by the harness seat are policy-allowed; the last keyed run shows the same five green gates |
| 2 | The keyed journey runs **one** chunked synthesis cycle and fails | `headless.ts:1860-1991`; `codegen.server.ts:2803-2915` | For a declared-kind project the synthesis is chunked (`codegen.server.ts:2517-2525`), which sets `lastTest:null` (`:3142`). On a green tree-run the journey records the P6 gate **before** it mints `lastTest:"tested"` (`headless.ts:1916-1917` then `:1958`), so `p6-verified` (`dod.ts:500-517`) and `p6-test` (`:473-480`) can never pass at gate time → `gate.passed:false` → `return "failed"` (`:1968-1986`). **The chunked tree's convergence is deadlocked by construction.** |
| 3 | The post-journey drain stalls | `headless.ts:587-600` (`outcome:"dod"`); `run-eval.mjs:692-696` (terminal set omits `"dod"`) → `:697-704` (80 rounds → `stalled`) | `RAN-keyless` probe A: `enforceDod:true` at a P6-complete-red-gate → `outcome:"dod", stopped:true`, repeatable; the 2026-09-10 ledger shows the same 50+ `dod.blocked` rows at P6 with `currentPhase:6` |
| 4 | Emit + tree-run + scoring still run; `results.json` is written; exit 0 | `run-eval.mjs:809,839,1177,1320-1323` | The driver is engineered so results are data — no crash path loses the number (the stale-file caveat is WB-6) |

**Single most likely "no new number" point.** There is no crash-and-no-number point in the driver: every
per-entry throw is recorded as a 0/9 `status:"error"` row and the process exits 0 (`run-eval.mjs:1286-1313`,
`:1336-1347`). The realistic no-new-number risk is **external**: the keyed leg needs many minutes of model
wall-clock (3 cycles × N chunk calls × up to 240 s each — `codegen.server.ts:132`), `results.json` is only
written at the very end (`:1177`), and this host is 8 GB with five agents. If the process is killed, the
**stale 2026-09-17 keyless `results.json` (6/9) stays in place** and can be misread as the keyed result —
the driver does not mark or clear it at run start. `TRACED`. (WB-6.)

---

## 2. Will-break table (ranked by damage to Step 0)

Legend — verified-how: `RAN-keyless` = I executed it today (keyless, scratch); `TRACED` = read in today's
bytes; `EVIDENCE` = read from the 2026-09-10 keyed artifacts; `COULD-NOT-TRACE` where noted.

| id | where (file:line) | what happens | why | cost | fix shape (1 line) | verified-how |
|---|---|---|---|---|---|---|
| **WB-1** | `headless.ts:1916-1917` (record gate) → `:1927` (require `gate.passed`) → `:1958` (mint); `codegen.server.ts:3142` (`lastTest:null`); `dod.ts:473-480`, `:500-517`; mirror seam `headless.ts:2493-2510` | **P6 gate is recorded before the tree-run can promote `lastTest:"tested"`; for any chunked tree the gate can therefore never pass → the journey returns `failed` even on a green tree-run, and `repairTreeDir` has the identical deadlock at `:2508`.** | `p6-verified` needs `lastTest.label==="tested"`+hash; the only mint for chunked trees is `mintTreeRunTested` (`codegen.server.ts:3209-3248`), called only *after* `gate.passed===true`. Circular. | M3 + M4 are unsatisfiable for every webapp/tool/game keyed run; kills convergence itself. | Mint the tested-equivalent from the real green tree-run **before** recording the P6 gate (both seams). | `TRACED` (+ `EVIDENCE`: ledger shows P6 complete, `lastTest {"ok":true,"detail":"tests.pass"}` never `"tested"`, no green P6 gate) |
| **WB-2** | `run-eval.mjs:692-696` (terminal set `{complete,blocked,error}`, not `"dod"`) → `:697-704` (stall); `headless.ts:587-606`; `maker-score.ts:607-609` | After WB-1 fails the journey, the drain re-enters the same hard-DoD block for its full 80-round guard, appending ~80 `dod.blocked` rows, then returns `position:"stalled", onTime:false` → **M9=0** and a status the owner must decode. | `dod` is `stopped:true` but not in the driver's terminal set, so the drain treats a hard stop as "progress, keep looping". | M9 certain 0; ~80 no-op rounds; the run *looks* alive while it can never advance. | Treat `"dod"` as terminal with `stall = hardDodMessage(...)` and a coded stop (the code M9 needs). | `RAN-keyless` (probe A: outcome `dod`, stopped, repeat), `TRACED`, `EVIDENCE` (50+ identical rows, `status:"dod"`, M9=0 on 2026-09-10) |
| **WB-3** | `engine.ts:1884-1885` (`enforceDod` defaults to the keyed state); `headless.ts:437-447`, `:504-514` | With a key present, every advance out of a red-gated phase is hard-blocked — this is what converts WB-1 from "one red criterion" into a full stop at P6 (keyless runs seal past it and score M9=1; the keyed run cannot reach P7–P12). | Keyed default `enforceDod:true` is deliberate (AGENTS.md honesty #5), but it makes the WB-1 deadlock fatal rather than merely costly. | The whole downstream pipeline (P7–P12, census rows, `run.complete.with.failed.gates`) never runs; the keyed score can be *lower* than the keyless 6/9. | (Not a fix by itself — fixing WB-1 removes the red gate; optionally allow the drain to record a coded DoD stop and continue to P12 under an explicit operator flag.) | `TRACED` + `EVIDENCE` (`enforceDod:true` in the 09-10 ledger) + `RAN-keyless` (probe A block only fired once `enforceDod` was set) |
| **WB-4** | `codegen.server.ts:2789-2790` (chunked path: "No machine verify here"); `:3160-3169` | For a declared-kind project `verifyAndFixServer` is **never reached** — M4's only possible source is the post-tree-run mint, which WB-1 blocks. | Chunked trees rely on per-file deterministic validation + tree-run; the machine verify loop is single-module-only. | M4 unsatisfiable for chunked runs *even after* WB-1; the "machine verification promoted a tested verdict" claim has no path for the flagship webapp case. | Same seam as WB-1 (the mint IS the promotion); no separate verify call needed. | `TRACED` |
| **WB-5** | `headless.ts:2654-2656`, `:2704-2710` (repair converge/exhaust) | `repair` on an already-green chunked dir hits the WB-1 mirror (`:2493-2510`): tree-run green, gate red → `repair FAILED`, dir left as-is. Output is honest ("the edited dir stands as-is") but the loop cannot converge. | Same because the repair seam's `recordGreen` repeats the gate-before-mint order. | The obvious recovery verb for a stalled P6 dir also cannot converge → no machine path out of the WB-1 state. | Fix WB-1's seam once and have both seams share it. | `TRACED` |
| **WB-6** | `run-eval.mjs:1177` (persist at end), `:1336-1347` (crash → exit 0), `:1267` (keyed cap = 1 entry) | If the process is killed before the end (8 GB host; up to hours of model calls), **nothing new is written** — the stale 2026-09-17 keyless `results.json` (6/9) remains and can be misread; the driver never marks a run in-progress. | `results.json` is written once, at the end; `_keyed-run.log` is a launcher-side `tee` (`research/eval-out/_keyed-launcher.sh:10`), not a tool output. | Owner misreads a stale number; re-spend of the keyed run. | Write a run-start marker (mode + startedAt) before the first entry; or have the launcher move the old results aside. | `TRACED` (launcher read; no `_keyed-run` writer exists in `scripts/` or `package.json`) |
| **WB-7** | `codegen.server.ts:121` (32k max), `:132` (240 s/call), `:2103-2104` (2 attempts), `:2844-2890` (per-chunk loop); `run-eval.mjs` (no overall deadline) | Wall clock: per cycle = 1 expansion + N chunk calls (+ up to 5 repair classes per chunk) × up to 240 s; up to 3 cycles. Realistic hundreds of seconds (the 09-10 run: 756 s; it failed early), worst case hours; no overall deadline in the driver. | Bounded per call, unbounded per run. | Owner time; a run that "looks hung". | Add a driver-level wall-clock guard that stops cleanly with a code (feeds M9). | `TRACED` |
| **WB-8** | `codegen.server.ts:2106-2164` + `token-ledger.ts:44-62` | A budget throw is NOT a keyed-run risk today: `RAPIDTOOL_TOKEN_CAP` is unset (`doctor → tokenCap:null`), so `p6TokenCapFromEnv()`→undefined and `accountSynthUsage` never throws (`:2118-2136`); nothing in production calls `assertBudgetHeadroom`/`recordBudgetSpend` (grep: 0 non-test callers). | The `SessionBudgetExceeded` class is landed but unwired on the default path (`W14-L2` will wire it). | None for Step 0 — *contrary to the plan's hypothesis, a budget throw is not a plausible silent "4/9" cause.* | Wire the four free seams (W14-L2) so the cap becomes real before it is advertised. | `TRACED` (greps + constants) |

> [IMPROVER · 2026-09-24] WB-6 ADDENDUM (read today): both artifacts are written by ONE `persist()` call (`run-eval.mjs:1162-1207`) — `results.json` first (`:1177`), `history.json` second (`:1206`) — so a kill inside `persist` leaves a fresh results.json beside a history row that never landed (M7's priors read history, `priorFor` `:371`). The run-start-marker fix should also name this pair. — evidence: `sed -n '1160,1215p' scripts/run-eval.mjs`. (by PLAN-IMPROVER)
> [IMPROVER · 2026-09-24] CONFIRMING TRACE (WB-1 + WB-5; no falsification found): the gate-before-mint order is literal in both seams today — journey comment `headless.ts:1908-1912` ("record the P6 DoD gate honestly FIRST … NEVER mint lastTest:\"tested\" (T0.6 — mint-after-gate)"), `recordGate` call `:1917`, mint `:1958`; repair mirror `recordGreen` `:2491` (comment `:2493` "record the P6 gate FIRST", `recordGateInto` `:2498`, mint gated on `gate.passed` `:2509`). Both seams need the same C-1 fix. — evidence: `sed -n '1908,1975p'` + `sed -n '2490,2518p' src/lib/headless.ts`. (by PLAN-IMPROVER)

**What will NOT break (checked, honestly green):**

| Check | Evidence |
|---|---|
| P0–P5 floor gates on the corpus brief — all `passed:true` | `RAN-keyless` probe A (coffeehouse brief, `kind:"app"`): gates 0–5 green; the 09-10 keyed ledger agrees |
| Pre-drain reachability of the P6 edge (`p6Gate:true` returns right after approving P5) | `TRACED` `run-eval.mjs:687-689`; `RAN-keyless` probe A reached `position p6-gate`, approved P4+P5 |
| Harness-seat approvals pass the one policy seam | `RAN-keyless` probe A (both approvals succeeded; `headless.ts:818-836` routes through `evaluatePolicy`) |
| The G6 unreadable-envelope sink is wired on the success path (no silent-null on chunk parse failures) | `TRACED` `codegen.server.ts:2952-2958` (+ `:2605-2612` single-module); sink logs `p6.synthesis.envelope.unreadable` |
| `verifyAndFixServer` never lets the model declare the pass | `TRACED` `verify.server.ts:975-993`, `:1015` |
| Emit survives a red trail under `redTree:"banner"` (driver) — no refusal aborting the benchmark | `TRACED` `headless.ts:1397-1418`; `run-eval.mjs:809` |
| The eval driver cannot exit non-zero | `TRACED` `run-eval.mjs:1322-1323`, `:1347` |
| Journey/gate unit suite is green (the deadlock is simply untested) | `RAN`: `node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts` → **90/90 pass, 0 fail**. The green-branch test at `headless.test.ts:492-510` injects a **fake** `recordGate: greenGateRecord` and therefore cannot catch WB-1 |

---

## 3. Per-criterion table (M1–M9)

Predicted = today's expected value for the Step 0 keyed run (coffeehouse2home, chunked path).
"Flip requires" names the smallest code change on this tree that would change the value.

| # | Deciding code | Predicted | Why (code reason) | Flip requires |
|---|---|---|---|---|
| **M1** substance | `maker-score.ts:335-403` (tree branch: real files + per-capability identifier coverage, stopword-tightened at `:241-253` since the only prior keyed M1=1) | **0–1 (coin-flip)** | Rides on the model's tree: ≥1 real file and every one of the 7 expected capabilities must have a stemmed identifier somewhere. The 09-10 keyed run scored 1 — but the probe was tightened after it (fixes/215c), so today's bar is stricter. | No code change: a good synthesis pass (or a coverage-alarm review if the alarm fires) |
| **M2** runs | `maker-score.ts:406-446` + `run-eval.mjs:388-416` (`treeRun` TAP) + `compile-check.server.ts:1029-1036` (`ok = compile && specsGreen && entryGreen && projectScripts`) | **0 (0–1)** | The keyed emitted tree must pass its own compile + specs + entry + declared scripts. The only prior keyed datum is M2=0 (09-10), and the tree-run leg has grown stricter since (T-18 project-scripts leg). | Make the emitted keyed tree pass its own tests (Phase C target 3) |
| **M3** iterates | `maker-score.ts:448-472` (journey converged, or gate.passed + `lastTest.ok`) | **0 — certain** | WB-1: the chunked journey can never converge (gate recorded before the only mint); the derived path also needs a green gate. | Fix WB-1 → a green tree-run then converges in-cycle |
| **M4** verifiable | `maker-score.ts:474-488` (`lastTest.label==="tested"` + hash) | **0 — certain** | The mint is gated on `gate.passed` (WB-1) and the chunked path has no other promotion (WB-4). | Same as M3 (the mint is the promotion) |
| **M5** honest | `maker-score.ts:490-541` (red gate must surface loudly) | **1** | Two branches, same value: (a) if the journey reached the green-tree branch, the P6 gate is recorded red and `recordGateInto` writes a warn `gate.verdict` row (`dod.ts:793-801`) → loud → 1; (b) if no cycle ever went green, P6 has **no gate record** at all → `red.length===0` → M5 passes vacuously ("nothing to hide") → also 1 (this is exactly the 09-10 shape: P6 gate null, M5=1). The hard stop itself is surfaced only as the `dod.blocked` log + the "Hard DoD block — P6" docs artifact, which M5 does not read. | — |
| **M6** handover | `maker-score.ts:543-564` + `headless.ts:1388-1484` | **1 (probable)** | The driver always emits after the drain (banner policy); scaffold emits `DEPLOY.md` + `tests/oracle.spec.ts`; the keyless run scores M6=1 on the same emission path. | — |
| **M7** learning | `maker-score.ts:566-584`; prior = last same-slug history row (`run-eval.mjs:priorFor`) = 2026-09-17 keyless `(m1 0, m2 1, m3 0)` → priorSum **1** | **=1 iff (M1 or M2) is 1** | `m7` compares this run's *raw* M1+M2+M3 (M3=0) against 1. Both 0 → "regression", M7=0. | Any single M1/M2 green flips it |
| **M8** bounded | `maker-score.ts:586-601`; `run-eval.mjs:907` | **1** | The journey returns `cycles ≤ budget` always (3), including exhausted/failed (cycles = budget). | — |
| **M9** on-time | `maker-score.ts:603-617`; `run-eval.mjs:908-913` | **0 — certain** | WB-2: the drain stalls → `onTime:false` → `"run did not stop on time"`. The loud-coded branch exists but is unreachable when the drain never terminates. | Fix WB-2 (dod = coded terminal stop) |

**Score arithmetic** (so the range is auditable): M5+M6+M8 = 3. M3=M4=M9 = 0. If neither M1 nor M2 →
**3/9**; exactly one → **5/9**; both → **6/9**. Most likely: M1=1, M2=0 → **5/9**. (M7 rides along as
described.) The keyless baseline on this tree is 6/9 — a keyed run scoring below its keyless floor is a
*code* outcome, not a model-quality outcome.

---

## 4. The three highest-value Phase C targets

Each: file, seam, the ONE test that would prove the fix. All three fix criteria the plan's "four zeros"
names, in the order the code makes them reachable.

**C-1 — Break the gate-before-mint deadlock (unlocks M3 + M4).**
- Files/seams: `src/lib/headless.ts:1916-1958` (journey green branch) **and** `:2493-2515` (`repairTreeDir`
  `recordGreen`) — the same ordering twice; `src/lib/codegen.server.ts:3142` / `:3209-3248` (the mint).
- Fix shape: on a green tree-run, apply `mintTreeRunTested(project, verdict)` **first** (the tree actually
  executed — the evidence is real), then `recordGateInto(…, 6)`; keep "no mint on red" untouched. One
  shared helper for both seams.
- The one test: a new case in `src/lib/headless.test.ts` that uses the **default** `recordGate` (this is
  the part today's suite misses — `:492` injects a fake green gate) with a synthesized project whose
  tree-run is green and whose brief-fit passes; assert `outcome==="converged"`, `gate.passed===true`,
  `lastTest.label==="tested"` + non-empty evidenceHash. Run:
  `node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts`.
  (RED on today's tree — `failed` with `gate.passed:false` — GREEN after.)

**C-2 — Make a hard-DoD stop a coded terminal stop (unlocks M9; kills the 80-round spin).**
- Files/seams: `scripts/run-eval.mjs:692-704` (`drainPipeline` terminal set) + `:908-913` (stop block) +
  `src/lib/headless.ts:587-606` (`"dod"` outcome). Optionally export the pure predicate
  `isTerminalDrainOutcome(outcome)` for direct unit testing.
- Fix shape: treat `"dod"` as terminal; set `position:"dod"`, `stall = <hardDodMessage>`, and map it to a
  code (e.g. `RT_E_GATE_PENDING`, the wild path's own code) so M9's loud-stop branch applies.
- The one test: a case in `scripts/run-eval.test.mjs` pinning the predicate (and hence the drain's exit)
  for all seven `RunOutcome` values, plus a scratch probe (same shape as `probeA.mjs` step 3) asserting
  exactly ONE drain round returns `dod`. Run:
  `node --experimental-strip-types --test --test-concurrency=2 scripts/run-eval.test.mjs`.

**C-3 — Make the emitted keyed tree pass its own tests (M2's only source on the driver path).**
- Files/seams: `src/lib/compile-check.server.ts:939-1047` (treeRun verdict: `compile.ok && specsGreen &&
  entryGreen && projectScripts`) + `src/lib/scaffold.ts` spec/package emission for keyed trees.
- Fix shape: reproduce the 2026-09-10 artifact shape (`src/generated/*.ts` + `src/jobs/*.ts` bridges +
  `tests/oracle.spec.ts` + `tsconfig.json` + `package.json`) as a checked-in fixture and make `treeRun`
  return `ok:true` with `testsPass>0` on it without installing anything; register the honest
  "unverified ≠ fabricated" wording for any leg that cannot run.
- The one test: add the fixture + one case to `src/lib/compile-check.server.test.ts` asserting
  `treeRun(dir).ok === true` and `tests pass ≥ 1`, then run
  `node --experimental-strip-types --test --test-concurrency=2 src/lib/compile-check.server.test.ts`.
  The test IS the diagnosis: if it cannot be made green, the emitted keyed tree — not the score — is the bug.

---

## 5. Honest coverage

**Read today (2026-09-24), all in the repo, read-only:** `scripts/run-eval.mjs` (the whole keyed flow:
`runTrial` 750-1000, `drainPipeline` 661-705, `evaluateEntry`/`persist`/`main` 1018-1347); `src/lib/headless.ts`
(`runReady`/`finishPhase`/`advanceOnce` 398-523, `runUntilGate` 550-717, `approve` 796-870, `emitProject`
1388-1498, `driveP6Journey` 1829-2006, `repairTreeDir` 2440-2727 incl. `recordGreen` 2491-2515);
`src/lib/engine.ts` (`sealHonesty` 1233, `applyPhaseResult` 1371-1500, `upgradeP6Keyed` 2851-2887,
`liveLayer` 2889-2905); `src/lib/codegen.server.ts` (constants 118-148, budget/backoff 2075-2174,
`liveP6Synthesis` 2423-2526, single-module 2541-2775, chunked 2803-2915, chunk envelope 2925-3045,
`treeUpgraded`/`mintTreeRunTested` 3057-3248); `src/lib/dod.ts` (gate registry incl. P6 464-557,
`runGate` 632-676, `recordGateInto` 764-808, hard-DoD 894-956); `src/lib/maker-score.ts` (all 658 lines);
`src/lib/verify.server.ts:918-1055`; `src/lib/token-ledger.ts:1-135`; `src/lib/compile-check.server.ts:820-1047`.

**Executed today (labels):**
- `RAN-keyless` — `C:/Users/mnril/w13a1_scratch/probeA.mjs` (keyless scratch, corpus brief, `kind:"app"`):
  floor drain → P0–P5 gates green → approved P4/P5 → `position p6-gate`; floor P6 gate red
  (`p6-verified`, `p6-brief-fit`); `enforceDod:true` at P6-complete → `outcome:"dod"`, `stopped:true`,
  `dod.blocked` row, repeat on round 2.
- `RAN` — `node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts` → 90/90 pass.
- `RAN` — read-only `node -e` over `research/eval-out/results.json`, `history.json`, and the 2026-09-10
  keyed ledger `research/eval-out/coffeehouse2home-property-ledger/.rapidtool/project.json`.
- `EVIDENCE` — `research/eval-out/_keyed-run.log` + `_keyed-launcher.sh` (the 09-10 keyed run: `dod · 4/9 ·
  756.2s`; M1,M5,M6,M8=1; M2,M3,M4,M7,M9=0).

**Not done / could-not-trace (honest):**
- **No keyed execution** — impossible here. Every keyed statement is code-traced or read from the 09-10
  artifacts; where I say "certain", it means "certain from the code path", not "observed keyed".
- **COULD-NOT-TRACE (a):** which synthesis failure (if any) preceded the 09-10 P6 stall — the surviving
  ledger's logs are capped (200 rows, mostly `dod.blocked`) and predate W5–W12. I stopped at the ledger's
  phase/log view; the full 09-10 transcript is not on disk.
- **COULD-NOT-TRACE (b):** the chunk count / token cost Step 0 will actually incur — it depends on the
  model's `expandBrief` output (no key, cannot measure; the code path is `codegen.server.ts:2445-2525`).
- **COULD-NOT-TRACE (c):** why M2 was 0 on 09-10 (which treeRun leg failed). I did not execute the emitted
  tree's specs (memory-tight host; webapp deps uninstalled), so M2's "0" is judgement + the prior datum,
  not a proof.
- **Read but not executed:** `repairTreeDir` (needs a key for its synthesis seam); the CLI `emit` exit
  branch (`rapidtool-cli.mjs:781-1015`, `RT_E_TREE_RUN_FAILED` anchors only — the driver path makes it
  moot for Step 0 because `npm run eval` always exits 0).
- **Budget:** 1 of ≤3 targeted test runs used (headless.test.ts) + 1 scratch probe; no
  `npm run typecheck/test/build` was run (forbidden).

---

*Provenance: W13 auditor-1 subagent. Probe kept at `C:/Users/mnril/w13a1_scratch/probeA.mjs`. Every
`file:line` above was read in this session; every output quoted was returned by a command run in this
session. The verdict is a prediction from code — Step 0 itself is the only falsifier.*
