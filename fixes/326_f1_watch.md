# 326 — F1 · STANDBY FIXER A — watch log (engine/wild/io lane)

Run: W44 FINAL RUN (keyed). Repo `C:\Users\mnril\Desktop\RapidTool Main` frozen at HEAD `6924dde` during the keyed builds — **this lane applies NOTHING this wave; NO keyed calls; NO repo edits beyond this log.**
Trial dir: `C:/Users/mnril/w44_trial`; campaign root: `C:/Users/mnril/w44_trial/exp2/` (absent at t0). Scratch: `C:/Users/mnril/f1_scratch/`.
Watching (~3–4 min cadence): `fixes/326_t1_run.md` (operator) · `fixes/326_t2_monitor.md` · `fixes/326_t3_backend.md` · `exp2/*/` states. Ops: T1 drives `exp2/01..10` via `rt.sh` (keyed; monitors never invoke keyed verbs).
Box (things I may prep patch TEXT for — text only this wave; parent opens a window post-run): `src/lib/{engine.ts, wild-mode.server.ts, wild-*.ts, io.ts, store.ts, headless.ts, diagnose.ts, phases.ts, types.ts}` + their test files (F2 owns `scripts/**`, `research/eval-corpus/**`).
Spot-checks (read-only, live-run): (a) sealed-park hydrate carries a live park — `acceptedParkUnlock`/`usableWildPark` (the 325 A1-1 fix); (b) review-flip guard on a real classifier reply — `parseWildReview` (the 325 A2 B1 fix) once a reply is logged.

## Status

- [~] Log opened (log-first, before any watcher action) 2026-09-30 ~20:2x CDT. t0: `exp2/` absent; node procs 0; repo clean @6924dde; T1/T2 logs absent; T3 log OPEN ("awaiting exp2 creation"); F2 log open.
- [~] Watch cycles running (P1.. below). Campaign shape confirmed from `exp2/drive_exp.py`: per exp — create → `gate --live --autopilot` loop w/ `approve --seat autopilot` on non-forceHuman parks (max 8 cycles) → P6 keyed synthesis → emit --run → emitted `npm test` → `doctor` → `diagnose`.
- [x] Harness prep (keyless, on the landed tree): `sp_a_live_park.ts` selfcheck **PASS** (sealed park + lastStep ride VERBATIM through a JSON disk round-trip + `hydrateProject(preserveWildRun:true)`; payload `f1_scratch/sp_a_selfcheck_payload.json`); `sp_b_parse_review.ts` selfcheck **PASS** 4/4 (quoted-flip stays reject; format echo; plain approve; echo-only null).
- [ ] Spot-check A — sealed-park hydrate under a LIVE payload (waits for an exp2 park record)
- [ ] Spot-check B — review-flip guard on a REAL classifier reply (waits for a logged keyed reply)
- [ ] Prep patches + pins for every reproduced finding

## Poll log

| # | time | T1 run log | T2 monitor | T3 backend | exp2 state | node procs | notes |
|---|------|------------|------------|------------|------------|------------|-------|
| P0 | 20:25 | absent | absent | OPEN (baseline 20:25:25) | absent | 0 | standing up; repo clean @6924dde |
| P1 | 20:26 | opened 20:26 (22 lines: method + exp plan 01..10) | opened 20:26 (baseline t0) | OPEN | `drive_exp.py` only | 0 | T1 driver staged; both monitors open; my log + harnesses standing up |
| P2 | 20:27 | same | same | same | `drive_exp.py` | 0 | both spot-check harnesses selfcheck-PASS on landed tree (A: sealed park verbatim; B: 4/4) |
| P3 | 20:28 | IN PROGRESS | OPEN | OPEN | 01_website created 20:27; first legs OK (2 parks approved) | 1 | campaign started; fast legs (~2s); P6 synthesis leg in flight |
| P4 | 20:28 | IN PROGRESS | OPEN | OPEN | 01_website stopped 20:28: **STOP_RED** — P6 `p6-brief-fit` unmet | 0 | see W-event 1 below; no emit for 01 |
| P5 | 20:30 | IN PROGRESS | monitor logs not yet updated | OPEN | `exp2/check_fit.mjs` added by T1 (same recheck as my `sp_c`) | 0 | T1 analyzing the brief-fit stop; next exp not started |

## Findings (per [NEW-BUG] flag / stall, in order seen)

_(no [NEW-BUG] flags raised by any monitor at P5)_

### W-event 1 — 01_website STOP_RED at P6 (watched; reproduced keylessly; NOT a bug as landed)
- **When**: 20:28, legs `06_gate_c2` (EXIT=1, 36.5s, spent 11,901) → `07_approve_on_red` (RT_E_GATE_PENDING, "No pending gate to approve (status: running)") → `08_diagnose_stop` (ok=true, errors=4, cause=unclassified-errors). `summary.txt` VERDICT: **STOP_RED** — `P6 DoD unmet — hard gate blocks advance: p6-brief-fit`.
- **My keyless repro** (`f1_scratch/sp_c_brief_fit.ts`, real `sandbox.briefNounHits`/`identifierHits`, run at 20:29 against the frozen payload):
  `required=22, need=ceil(22×0.35)=8, hits=7 → FAIL`; missing=[static, marketing, website, coffee, shop, visitors, browse, plain, css, files, no, external, services, works, offline]. Hits that landed: [menu, subscribe, updates, admin, edits, publishes, html]. **Identical to the gate's recorded verdict.**
- **Recorded path in `build.json` logs** (byte-anchored): `p6.synthesis.attempt chunk 1/2 · attempt 1 · 240000ms · ok`; `p6.synthesis.attempt chunk 2/2 … ok`; **`p6.synthesis.refused RT_E_VALIDATION · tree 2/2 chunks accepted · assembled tree does not implement the brief's required vocabulary (missing: static, marketing, website, coffee, sho…`**; then `dod.reqtrace p6-arch PASS · tree (3 files)`, `p6.tree.tested tested-equivalent minted after green tree-run`, `gate.verdict FAIL · 1 unmet`, `dod.blocked P6 advance blocked — unmet: p6-brief-fit`, `lesson.capture L2 … (keyed P6 synthesis refused — red gate on a live run)`.
- **Verdict**: the engine REFUSED the assembled tree at its own pre-acceptance check (the codegen counterpart of the gate probe) and the run stopped on the hard gate — the designed honesty path, not a silent failure. No patch prepared; awaiting monitor framing. **Observation only (not claimed as a bug)**: this run's measured coverage 7/22 = **31.8% < the 35% bar** and below the 322 X1 comment's "40–50% measured" band — a stochastic keyed-run miss of the marginal kind the 0.35 recalibration exists to tolerate; flag raised only if a monitor claims a defect.

## Spot-checks (read-only against the live run)

_(none yet)_

## PREPPED PATCHES (index — filled as patches are prepared)

| # | file | bug | patch anchor | pin home | state |
|---|------|-----|--------------|----------|-------|
| — | — | — | — | — | — |

## F1b continuation — STANDBY FIXER A (resumed watch; host-suspend gap documented)

Lane truth carried forward: repo frozen @`6924dde`, READ-ONLY except THIS log; no keyed calls; **PREP ONLY** (apply only if `w44_trial/fix_go5.md` opens with an APPLY list — checked every poll; absent as of P7). Predecessor capped mid-P5; this section continues the same watch/cadence/rules.

### Poll log (continued — F1b)

| # | time | T1 run log | T2 monitor | T3 backend | exp2 state | node procs | notes |
|---|------|------------|------------|------------|------------|------------|-------|
| P6 | 10:05 | last write 20:31 Sep 30 (exp02 block not yet written by T1) | updated 10:01 (exp01 full QA + OBS-326-1/2) | updated 10:04:56 (P2/P3 + ENV-T3-1 + OBS-T3-1..3) | `02_game` CLOSED **STOP_RED** @10:01; no `03_cli` dir yet | 0 | post-resume; host suspended ≈13h29m (Sep 30 ~20:32 → Oct 1 ~10:01). My byte-check confirms T3's ENV-T3-1: NDJSON ts jump Δ=48,617,089 ms; `06_gate_c2.out` mtime 10:01:37 vs legs 01–05 @20:31. Campaign paused between exps |
| P7 | 10:11 | unchanged (33 lines; exp02 block still owed by T1) | updated 10:07 (exp02 full QA + OBS-326-3/4) | unchanged since 10:04:56 | unchanged; no new legs; `fix_go5.md` ABSENT | 0 | all monitor lanes alive; T1 idle between exps; no [NEW-BUG] product flags anywhere |

No stalls attributable to the product: the only wall anomaly (`02_game` leg06 WALL=48,617.1s) is the host-suspension artifact (ENV-T3-1/OBS-326-3), and leg 06's real active compute ≈90s. No silent failures: both exps' envelopes 8/8 clean, NDJSON rows clean (`create` row lives in the repo-CWD log — OBS-T3-1, consistent 2/2, row EXISTS).

### EXP 02 `02_game` — STOP_RED @P6, **2 unmet** (`p6-brief-fit` + `p6-arch`) — watched + KEYLESS-REPRODUCED

- **Legs** (`summary.txt`): 01_create EXIT0 → 02_gate_c0 EXIT2 P4 park (626 tok) → 03/05 autopilot approvals → 06_gate_c2 **EXIT1** RT_E_GATE_PENDING `P6 DoD unmet — hard gate blocks advance: p6-brief-fit, p6-arch` (spent 23,242) → 07_approve_on_red EXIT1 (no door, standard path) → 08_diagnose ok (4 errors). Spend Σ=23,868. `hitl=None`; decisions 2× autopilot; zero human claims.
- **build.json P6 trail (byte-anchored)**: `p6.seal.unmet red seal — 2 unmet [p6-verified, p6-brief-fit]` → cycle1: `p6.synthesis.attempt chunk 1/4 t1 ok, t2 ok` → `p6.synthesis.refused RT_E_VALIDATION · chunk 1/4 refused · typeSignature functions not exported: createGame, renderBoard, clearLines, startGame, restartGame, updateScore, getScore, loadHighScore` → `p6.tree.failure` → cycle2: same class refusal (`… initGame, saveHighScore, handleKeyDown, render, isGameOver`) → cycle3: `chunk 1/5 t1 ok` (20:32:34) … host suspend … `chunk 2/5 refused · DeepSeek returned a non-JSON 200 response` (10:01:20, RT_E_INTERNAL — post-resume stale-connection artifact, OBS-326-4) → `dod.reqtrace p6-arch FAIL · tree (2 files) · missing: track, drag, drop, persist` → `p6.tree.tested tested-equivalent minted after green tree-run · compile 9/9 · 1 spec pass · fnv1a 14863388` → `gate.verdict FAIL · 2 unmet · 34901165` → **`p6.journey.failed · tree-run ok after 3/3 cycle(s) but P6 gate FAIL · 2 unmet … — journey FAILED, not converged (converged requires treeRun ok AND gate.passed)`** → `dod.blocked` → `lesson.capture L2 (keyed P6 synthesis refused — red gate on a live run)`.
- **My keyless recheck** (`f1_scratch/sp_d_02_recheck.ts`, real modules `sandbox.briefNounHits/identifierHits` + `dod.archTrace` over the recorded build.json; no key/network):
  - p6-brief-fit: required=18, need=ceil(18×0.35)=7, **hits=6 → FAIL by ONE**; hits=[game, blocks, clear, board, score, high]; missing=[browser, arcade, player, drags, drops, tracks, persists, sessions, keyboard, controls, as, fallback]. Per-file: barrel 0 hits, `src/generated/create-initial-game.ts` (3,446 B) carries all 6.
  - p6-arch: `archTrace` missing=[track, drag, drop, persist], stubFiles=[] — **byte-identical to the recorded reqtrace row** (`missing: track, drag, drop, persist`).
  - **Verdict: both unmet GENUINE, not checker artifacts** (matches T2's independent replication 6/7 and the E1-era comparison). Same stochastic near-miss class as exp01 (7/8) — this wave's fresh keyed trees run one noun short of the 0.35 bar; old-era trees clear it (T2/T1 cross-check).
- **Repairability note (feeds PREP-1)**: here the journey budget was FULLY consumed (2 tree refusals + 1 non-JSON refusal) before the green tree-run — so even a gate-repair cycle had no budget left this time. The class PREP-1 addresses is exp01's shape: green tree + red fit class at cycle 1/3, budget unspent.

### Spot-checks (read-only, live-run)

- **(a) sealed-park hydrate carries a live park** — still NO qualifying payload: 01/02 carry only stock P4/P5 parks (approved; pre-P6), no sealed park. **Carried** (predecessor's selfcheck sp_a remains the standing evidence).
- **(b) review-flip guard on a REAL classifier reply** — no wild/review seat fired in 01/02 (driver loop is gate/approve/synthesis only). **Carried** (sp_b 4/4 selfcheck stands).

---

## PREPPED PATCH PROFILES (F1b)

_(status — CLOSED by parent after window #5: PREP-1 **APPLIED** (F1c) · PREP-2 **S APPLIED**, W deferred/ticketed · PREP-3 **APPLIED** (F2c, trial tooling). See the apply-closure section at the end.)_

### PREP-1 — [REQUESTED] Green-tree + red-gate: ONE bounded gate-repair cycle (design-honest; cannot fake a pass)

**Class**: exp01 (`p6.journey.failed · tree-run ok after 1/3 cycle(s) but P6 gate FAIL`) and now exp02 (3/3 — differed only in that budget was already spent). When the tree-run is green but the P6 gate is red on a fit-class unmet, `driveP6Journey` returns `failed` **unconditionally** (headless.ts:2776–2794) and never offers the remaining budget as a repair attempt — even though the artifact compiles/executes and the red criteria name exactly what the synthesis missed. Location note: the arm is in `src/lib/headless.ts` (**not** engine.ts; engine.ts hosts `LiveLayerDeps`/`liveLayer`/`upgradeP6Keyed`, which the new context rides through).

**Proposed behavior**: on green-tree+red-gate with `gate.unmet.length > 0` and `cycle < budget` — at most **once per journey** — divert one cycle: re-synthesize with the recorded unmet requirements as cycle context (`ctx.gateRepair` → `deps.gateRepair` → a bounded `P6 GATE REPAIR CONTEXT` block on the PRIMARY synthesis prompts). All other outcomes unchanged.

**Why it cannot fake a pass (design-honesty argument)**:
1. Convergence still requires `gate.passed === true` from the REAL `recordGateInto` probes re-run over the repaired tree — the repair cycle gets no gate shortcut, no forced green, no new mint path (tested-equivalent minting unchanged: green tree-run + executed spec only).
2. The fed context is **recorded evidence only** — the gate's own unmet criteria + the missing lists already logged by `p6.synthesis.refused`/`dod.reqtrace`. The engine adds no requirement the brief never had (zero fabrication; no re-probing, no invented nouns).
3. Bounded: exactly ONE diversion per journey, inside the existing budget; a second red gate still FAILS immediately (never a silent seal — fixes/159 F4 intent preserved: "converged requires treeRun ok AND gate.passed" is untouched).
4. A cosmetic name-stuffing attempt would still have to pass the same tree-run specs + p6-arch reqtrace; the block text itself directs real implementation. Precedent: the single-module path already performs exactly this repair (`p6SynthesisBriefFitRepairPrompt`, fixes/121) — this brings the journey to parity for trees.

**Patch text (3 files, minimal, additive; absent-context ⇒ byte-identical legacy paths):**

`src/lib/headless.ts` — (1) type + (2) cap + (3) shape + (4) mapping + (5) helper + (6) loop vars/ctx + (7) the arm:
```diff
@@ P6JourneyCycleContext (headless.ts:2229-2237)
   /** Codegen refusal detail (p6.synthesis.refused log), if any. … */
   refusal?: string;
+  /** fixes/326 F1b: the ONE bounded gate-repair cycle's context — the recorded
+   *  unmet P6 DoD requirements (criteria + missing lists) from a green
+   *  tree-run/red-gate cycle, fed to the next synthesis as deps.gateRepair.
+   *  Present ONLY on a diverted repair cycle (at most one per journey). */
+  gateRepair?: string;
 };

@@ after P6_JOURNEY_TAIL_MAX = 1500 (headless.ts:2340)
 const P6_JOURNEY_TAIL_MAX = 1500;
+/** fixes/326 F1b: cap for the one-shot gate-repair context (parity with the
+ *  refusal cap discipline — a long unmet list can never blow the prompt). */
+const P6_JOURNEY_GATE_REPAIR_MAX = 700;

@@ P6CycleLiveDepsShape (headless.ts:2257-2267) — after patchRepairs?
   patchRepairs?: boolean;
+  /** fixes/326 F1b: bounded unmet-requirements context for the ONE
+   *  gate-repair cycle (see P6JourneyCycleContext.gateRepair). */
+  gateRepair?: string;
 };

@@ p6CycleLiveDeps (headless.ts:2269-2277)
 export function p6CycleLiveDeps(ctx: P6JourneyCycleContext): P6CycleLiveDepsShape | undefined {
   const tail = typeof ctx.treeFailureTail === "string" ? ctx.treeFailureTail : "";
   const refusal = typeof ctx.refusal === "string" ? ctx.refusal : "";
-  if (tail.length === 0 && refusal.length === 0) return undefined;
+  const gateRepair = typeof ctx.gateRepair === "string" ? ctx.gateRepair : "";
+  if (tail.length === 0 && refusal.length === 0 && gateRepair.length === 0) return undefined;
   const deps: P6CycleLiveDepsShape = {};
   if (tail.length > 0) deps.treeFailure = tail;
   if (refusal.length > 0) deps.synthesisRefusal = refusal.slice(0, P6_JOURNEY_REFUSAL_MAX);
+  if (gateRepair.length > 0) deps.gateRepair = gateRepair.slice(0, P6_JOURNEY_GATE_REPAIR_MAX);
   return deps;
 }

@@ after p6JourneyLog (headless.ts:2379-2387) — new helper
+/** fixes/326 F1b PREP: the bounded context for the ONE gate-repair cycle —
+ *  the recorded unmet criteria + the concrete missing lists already on the
+ *  record (latest p6.synthesis.refused / dod.reqtrace rows). Recorded
+ *  evidence only; the engine adds no requirement the brief never had. */
+function gateRepairContextOf(project: Project, unmet: readonly string[]): string {
+  const logs = project.logs ?? [];
+  const scraped: string[] = [];
+  for (let i = logs.length - 1; i >= 0 && scraped.length < 3; i--) {
+    const l = logs[i];
+    if ((l.event === "p6.synthesis.refused" || l.event === "dod.reqtrace") && typeof l.detail === "string") {
+      const at = l.detail.indexOf("missing:");
+      if (at >= 0) scraped.push(l.detail.slice(at, at + 300));
+    }
+  }
+  return [
+    `P6 DoD unmet: ${unmet.join(" | ")}`,
+    scraped.length > 0 ? `Recorded missing requirements: ${scraped.join(" · ")}` : "",
+  ]
+    .filter(Boolean)
+    .join("\n")
+    .slice(0, P6_JOURNEY_GATE_REPAIR_MAX);
+}

@@ driveP6Journey loop head (headless.ts:2653-2659)
   let p = project;
   let treeTail: string | null = null;
   let refusal: string | null = null;
+  // fixes/326 F1b: at most ONE gate-repair diversion per journey.
+  let gateRepair: string | null = null;
+  let gateRepairUsed = false;
   for (let cycle = 1; cycle <= budget; cycle++) {
     const ctx: P6JourneyCycleContext = { cycle };
     if (treeTail !== null) ctx.treeFailureTail = treeTail;
     if (refusal !== null) ctx.refusal = refusal;
+    if (gateRepair !== null) {
+      ctx.gateRepair = gateRepair;
+      gateRepair = null; // consume-once: the diversion is exactly one cycle
+    }

@@ green-tree + red-gate arm — insert BEFORE `const gateReason =` (headless.ts:2781)
+      // fixes/326 F1b: ONE bounded gate-repair cycle. A green tree-run with a
+      // red fit-class gate is REPAIRABLE within the existing budget — the
+      // artifact runs; the red criteria name the brief's own unmet
+      // vocabulary/capabilities. Spend exactly one cycle re-synthesizing WITH
+      // those recorded requirements as context. Honesty is untouched: the
+      // repaired tree faces the SAME tree-run + real gate probes; convergence
+      // still requires gate.passed === true, and a second red gate FAILS.
+      if (!gateRepairUsed && gate !== null && gate.unmet.length > 0 && cycle < budget) {
+        gateRepairUsed = true;
+        gateRepair = gateRepairContextOf(finalProject, gate.unmet);
+        p = p6JourneyLog(
+          finalProject,
+          "warn",
+          "p6.journey.gate-repair",
+          `tree-run ok but P6 gate FAIL (${gate.unmet.length} unmet) — one bounded gate-repair cycle with the unmet requirements as context`,
+        );
+        events.push(
+          `cycle ${cycle}: tree-run ok but P6 gate FAIL — one bounded gate-repair cycle (unmet requirements fed as context)`,
+        );
+        continue;
+      }
       const gateReason = …  // existing FAILED path unchanged
```

`src/lib/engine.ts` — the deps type + the codegen call type (runtime already forwards the object verbatim):
```diff
@@ LiveLayerDeps (engine.ts:3062-3064)
 export type LiveLayerDeps = {
   treeFailure?: string;
+  /** fixes/326 F1b: the journey's one-shot gate-repair context (recorded
+   *  unmet P6 DoD requirements) — forwarded verbatim to codegen
+   *  liveP6Synthesis alongside treeFailure. Absent ⇒ legacy call unchanged. */
+  gateRepair?: string;
 };
@@ upgradeP6Keyed codegen type (engine.ts:3121-3123)
     const codegen = (await import(codegenSpec)) as {
-      liveP6Synthesis?: (p: Project, deps?: { treeFailure?: string }) => Promise<Project>;
+      liveP6Synthesis?: (p: Project, deps?: { treeFailure?: string; gateRepair?: string }) => Promise<Project>;
     };
```

`src/lib/codegen.server.ts` — deps field, reader, prompt block + wraps (single-module primary `user` @3076 and every chunk's `user` @3409):
```diff
@@ P6SynthesisDeps (codegen.server.ts:2461) — after treeFailure field
   treeFailure?: string;
+  /** fixes/326 F1b: the journey's one-shot gate-repair context — recorded
+   *  unmet P6 DoD requirements (criteria + missing lists) from a
+   *  green-tree-run/red-gate cycle. When present, the PRIMARY synthesis
+   *  prompt (single-module and every tree chunk) carries it as a bounded
+   *  "P6 GATE REPAIR CONTEXT" block; absent/blank ⇒ byte-identical legacy. */
+  gateRepair?: string;

@@ near repairTreeFailureTail (~codegen.server.ts:1059-1076) — new helper
+/** fixes/326 F1b PREP: bounded gate-repair context block for the PRIMARY
+ *  synthesis prompt. Deterministic + whitespace-collapsed; absent/blank ⇒
+ *  the prompt is byte-identical to the legacy text. */
+const REPAIR_GATE_CONTEXT_MAX = 700;
+function withGateRepairContext(user: string, gateRepair?: string): string {
+  const t = typeof gateRepair === "string" ? gateRepair.replace(/\s+/g, " ").trim() : "";
+  if (!t) return user;
+  return user +
+    `\n\nP6 GATE REPAIR CONTEXT (the previous cycle's tree-run was GREEN; the P6 DoD gate weighed it and REFUSED — implement these recorded unmet requirements with real working code, not renames or padding):\n${t.slice(0, REPAIR_GATE_CONTEXT_MAX)}`;
+}

@@ liveP6Synthesis (codegen.server.ts:2944)
   const treeFailure = deps?.treeFailure;
+  // fixes/326 F1b: the one-shot gate-repair context (journey PREP-1).
+  const gateRepair = deps?.gateRepair;

@@ call sites (codegen.server.ts:3031, :3038)
-    return synthesizeSingleModule(project, brief, specRecord, signatureNames, complete, verify, treeFailure, patchRepairs);
+    return synthesizeSingleModule(project, brief, specRecord, signatureNames, complete, verify, treeFailure, patchRepairs, gateRepair);
-  return synthesizeChunkedTree(project, brief, specRecord, complete, treeFailure, patchRepairs);
+  return synthesizeChunkedTree(project, brief, specRecord, complete, treeFailure, patchRepairs, gateRepair);

@@ signatures (codegen.server.ts:3057-3066 / :3355-3363) — add trailing param
   patchRepairs = false,
+  gateRepair?: string,
 ): Promise<Project> {

@@ primary prompt wraps (codegen.server.ts:3076 / :3409)
-  const user = p6SynthesisUserPrompt(brief, specRecord, lessonLines, project.contracts);
+  const user = withGateRepairContext(p6SynthesisUserPrompt(brief, specRecord, lessonLines, project.contracts), gateRepair);
-    const user = p6SynthesisChunkUserPrompt(brief, specRecord, chunk.signatures, prior, lessonLines, project.contracts);
+    const user = withGateRepairContext(p6SynthesisChunkUserPrompt(brief, specRecord, chunk.signatures, prior, lessonLines, project.contracts), gateRepair);
```

**Pin plan**: `src/lib/headless.test.ts` — extend the fixes/159 F4 describe: (i) NEW “red gate on cycle 1/3 → ONE diversion”: stateful fake `recordGate` (red then green) + fake synthesize/runTree; assert converged @cycles=2, cycle-2 ctx `gateRepair` contains the unmet text + recorded `missing:` excerpt, a `p6.journey.gate-repair` warn row exists, gate recorded twice (no shortcut); (ii) NEW “red twice → still FAILED”: assert synthesize called exactly 2×, no second diversion, `p6.journey.failed` present, never `converged`; (iii) NEW “no budget ⇒ no diversion” (red on cycle==budget; existing test :646 already exercises 3/3 — re-verify its `runCalls===3` still holds under the `cycle < budget` guard; its message should be updated to budget semantics); (iv) extend the `p6CycleLiveDeps` unit tests (~:1200-1229): gateRepair-only ⇒ `{gateRepair}`; all-three keys; ≤700 cap; existing key-set assertions must NOT change when ctx lacks gateRepair (guards byte-identity). `gate===null` path (test :901) unaffected. `src/lib/codegen.server.test.ts`: prompt-capture test — `deps.gateRepair` present ⇒ captured `user` prompt contains the block once (single-module + chunk paths); absent ⇒ byte-identical to legacy prompt snapshots. **Ripple check**: `repairTreeDir` (headless.ts:3263+) has the SAME green-red-terminal shape (`tree ops)` :3491-3520) — PREP-1 scopes to `driveP6Journey` ONLY (keyed gate path hit by exp01/02); mirroring there would change the `res.cycles===0` pin at headless.test.ts:998 — flagged as an OPEN parent decision, not silently included.

### PREP-2 — [self-found, adjudicate] `deps.synthesisRefusal` is produced but read by NOTHING

- **Evidence**: producer only — `headless.ts` (`P6CycleLiveDepsShape.synthesisRefusal` :2262, mapping :2275, docs :2249-2255/:2423-2425). Repo-wide `grep -rn synthesisRefusal src/ scripts/` ⇒ **zero readers**; `git log --all -S synthesisRefusal -- src/lib/codegen.server.ts` ⇒ **never existed at any commit**. `fixes/153_p2.md:28-29` explicitly deferred the reader (“codegen-side reading of the new key is the codegen lane’s contract”) — that lane artifact never landed — while headless.ts comments still CLAIM codegen “reads deps?.synthesisRefusal for refusal-aware re-prompts” (stale claim; P0-04 declare-or-strike class).
- **Impact (live)**: exp02 cycles 2/3 re-synthesized after `typeSignature … not exported` refusals; the promised refusal context never reached the model (only the no-tree branch’s fold into `treeFailure` partially covers it — the partial-tree+fit-refusal path, exp01/02’s actual shape, reaches codegen as NOTHING). Modest quality/waste impact, not a fabrication issue.
- **Prep — OPTION S (strike, ready)** `headless.ts` comments :2249-2255 & :2423-2425: replace the “reads …” clause with “is CARRIED on deps for the codegen seam; the codegen-side reader is still owed (fixes/153 P2 deferred it — no reader in tree as of 326)”. OPTION W (wire, needs a dedicated lane — NOT fully prepped): codegen reads `deps?.synthesisRefusal` and appends it via the bounded-context helper near `treeFailure`; surface = ~10 prompt builders + call sites (treeFailure threading today) — do NOT half-wire. **Recommendation**: land S now, schedule W with a codegen owner.

### PREP-3 — [trial tooling, hand to T1] `drive_exp.py` summary VERDICT `unmet=None`

- **Evidence** (T2 OBS-326-1, confirmed by me): `w44_trial/exp2/drive_exp.py:145` reads `env.get("failedGates")` top-level, but CLI envelopes nest it under `summary` (`06_gate_c2.out`: `"summary": { … "failedGates": [ … ] }`) ⇒ `summary.txt` prints `unmet=None` while the P6 block below carries the criteria. Cosmetic/harness-only (T1’s own tooling; not a repo file; T2’s scanners already read the right path).
```diff
@@ drive_exp.py:145
-            fg = (env or {}).get("failedGates") or []
+            fg = (env.get("summary") or {}).get("failedGates") or (env or {}).get("failedGates") or []
```

### PREPPED PATCHES — index (updated)

| # | file(s) | bug / class | patch anchor | pin home | state |
|---|---------|-------------|--------------|----------|-------|
| PREP-1 | `src/lib/headless.ts` · `src/lib/engine.ts` · `src/lib/codegen.server.ts` | green-tree+red-gate burns remaining budget with no repair attempt (exp01 1/3; class confirmed exp02 3/3-no-budget) — parent-requested proposal | headless.ts:2229/2257/2269/2379/2653-2659/2776-2794; engine.ts:3062/3122; codegen.server.ts:2461/2944/3031/3038/3057/3355/3076/3409 | headless.test.ts (F4 describe + p6CycleLiveDeps unit); codegen.server.test.ts (prompt-capture) | **APPLIED (F1c)** — headless.test 113/113 (110+3); codegen+engine 139/139; wild 49/49; eslint clean; `:998 res.cycles===0` pin untouched |
| PREP-2 | `src/lib/headless.ts` (comments); codegen if wired | `deps.synthesisRefusal` produced-but-unread; stale “codegen reads it” claims (fixes/153 P2 deferral never landed) | :2249-2255 · :2423-2425 (strike) | existing headless.test.ts mapping tests unaffected | **S APPLIED (F1c; doc-only)** — W DEFERRED (ticketed) |
| PREP-3 | `w44_trial/exp2/drive_exp.py` (trial tooling, T1-owned) | summary VERDICT prints `unmet=None` (failedGates nesting) | :145 | T1 re-run of 03+ | **APPLIED (F2c)** — reads `summary.failedGates` first w/ legacy fallback; `py_compile` OK |

`fix_go5.md` checked at P6/P7 — **absent**. Nothing applied this cycle; repo untouched (only this log + `f1_scratch/sp_d_02_recheck.ts` written, both allowed).

## Apply closure (window #5 — F1c applies + parent close)

- **PREP-1 APPLIED (F1c)** — the ONE bounded gate-repair cycle, `driveP6Journey` ONLY (`repairTreeDir` deliberately NOT mirrored; its `res.cycles===0` pin untouched; mirror ticketed):
  - `headless.ts` (7 hunks): `P6JourneyCycleContext.gateRepair`; `P6_JOURNEY_GATE_REPAIR_MAX = 700`; `p6CycleLiveDeps` mapping (absent/blank ⇒ legacy key-sets byte-identical); `gateRepairContextOf()` (recorded `missing:` scrape from the latest `p6.synthesis.refused`/`dod.reqtrace` rows, ≤3 × 300 chars); consume-once diversion arm guarded `!gateRepairUsed && gate !== null && gate.unmet.length > 0 && cycle < budget`.
  - `engine.ts` (2 hunks): `LiveLayerDeps.gateRepair`; `upgradeP6Keyed` codegen call type `{ treeFailure?; gateRepair? }`.
  - `codegen.server.ts` (8 hunks): `withGateRepairContext()` + `REPAIR_GATE_CONTEXT_MAX = 700`; live reader; both call sites; both signatures; both primary prompt wraps.
  - Honesty: the gate re-runs on the repaired tree (no shortcut/forced green); only recorded unmet evidence fed; exactly ONE diversion; a second red still FAILS.
  - Caveat (recorded): exp02's journey had budget spent pre-green (no diversion possible there); exp01's shape (green @1/3, budget remaining) is the target class.
- **PREP-2 OPTION S APPLIED (F1c)** — stale "codegen reads deps?.synthesisRefusal" claims struck at both headless.ts comment sites; the codegen-side reader (W) remains deferred/ticketed.
- **PREP-3 APPLIED (F2c)** — `drive_exp.py:145` now reads `summary.failedGates` first (legacy top-level fallback kept).
- **Proofs (F1c, actual):** `node --check` ×3 OK · headless.test **113/113** · codegen.server.test + engine.test **139/139** · wild-seal + wild-step **49/49** · eslint ×5 files exit 0. No keyed calls; no boundary runs (parent runs the gate).
- Trail: `fixes/326_t1_run.md` (campaign) · `326_f2_watch.md` (F2 closure) · `fix_go5.md` (window) · transcripts `deleg_b9aff95f`.

=== END 326_f1_watch — COMPLETE (parent-closed; F1b prep → F1c applies with fresh counts) ===
