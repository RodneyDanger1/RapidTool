# fixes/311_se1_pipeline.md — RESCUED from the auditor's final summary (file write hit the iteration cap; content verbatim)
> **RESCUED-header correction (2026-09-29):** this file is on disk and complete — content verbatim from the auditor's final summary as pasted by the parent; the stale "file not written / not yet on disk" self-references below describe the original iteration-cap moment, not this file's state.
# SE1 — the structural-blocker falsification

**⚠️ Deliverable gap:** I did **not** write `fixes/311_se1_pipeline.md` — I hit the iteration cap while still reading the chain. All findings below are the material that file should contain (parent can paste, or re-dispatch me for the write). Audit-only honored: **zero edits, zero keyed calls** (all reads/greps).

## FALSIFIED, not confirmed: "no structural blocker remains"

The *wiring* is complete (every seam is called, keyless-safe fallbacks everywhere), but an unattended keyed run can stop at **three** code-shaped gates. None are missing code — all are policy/DoD-shaped, which is why they read as "no blocker."

### 1 · The autonomous gate path — the park catalogue (`engine.ts` `wildStep` 4213-4472)
`wildApproveGate` (3934-4019) / `wildLeavePhase` (4025-4089) / `resolveWildReview` (3877-3926):

| Park site (line) | Condition | Keyed clears it? |
|---|---|---|
| `3946` **`gate.forceHuman`** | **P0 reframe / P6 failed sandbox — HUMAN-ONLY class** | **NO** |
| `3957` unconfigured-gate | classifier absent + open gate | yes (keyed) |
| `3967`/`4037` classifier error | LLM error or feedback <12 chars | retry only |
| `3972`/`4042` reject | classifier rejects | **NO auto-retry — parks** |
| `3995-4008` post-approval DoD red | `enforceDod` && gate red | NO |
| `4053-4065` leave DoD red | `enforceDod` && gate red | NO |
| `4070` illegal advance | priors unsealed / `canEnter` false | NO |
| `4306` blocked / `4356` locked / `4365` rejected / `4387` unsealed / `4441` throw | state guards | NO |
| `store.ts:1269` cap | 20 iterations | human resume |

**`forceHuman` set sites:** `engine.ts:694` (P0 reframe — `verdict==="reframe"` i.e. feasibility <6 **or** `lattice.vague`), `engine.ts:915` + `1412` (P6 sandbox `!ok`), guarded at `1668` (`approveHitl` throws for autopilot, R3/B-03).
**Key asymmetry found:** wild mode checks **only** `forceHuman` — it never checks `STOCK_HITL=[4,5,8,9]` (`phases.ts:151`), tightness<7.2, or the DoD pre-check that `canAutopilot` (`headless.ts:533-547`) and store `canAutopilot` (`store.ts:424`) enforce. **wild is strictly MORE autonomous than `unattended`** (which parks at every stock gate).

### 2 · The step budget — store.ts:1231 `for (let step = 0; step < 20; step++)`
`wildStep` resolves **one phase edge per call**; a phase with an open gate costs **2 steps** (execute→gate on 4427-4428, then leave on 4351-4354); a gate-less phase costs **1** (4439-4440, execute+leave fused); P12 finalizes in-call (`4430-4434`).

- 4 stock gates ×2 = 8; 9 gate-less phases ×1 = 9 → **exact minimum = 17 steps.**
- **Cap 20 ⇒ margin 3.** Adding both opt-in `schedule.extraHitl` gates (P6, P11) = **21 → CAP HIT**, and the finalize step is lost.
- There is **no in-loop repair**: a reject *parks* (no auto-retry); the only in-loop retry is `driveP6Journey`'s own budget 3 — **inside one step**, not three.
- CLI is roomier: `wildStartRun`/`wildStartHeadless` default **24** (clamped 1-48, `headless.ts:4125,4291`); `runUntilGate` default 40, run-eval passes 60 (`run-eval.mjs:2107`).
**Verdict: CONDITIONAL-PASS** — 17 ≤ 20 with 3 slack for a clean uninterrupted run.

### 3 · P6→materialize→treeRun→acceptance→mint early-returns
- `liveP6Synthesis` (`codegen.server.ts:2888`): bails on keyless (2889), missing brief/phases (2901), **forceHuman P6 gate (2906-2908)**; `refuse()` (2570-2585) mints `p6.synthesis.refused`.
- `upgradeP6Keyed` (`engine.ts:3028-3064`): **bare catch → silent floor**, no refusal log. `liveP6Synthesis` also has a bare catch (2937-2957 region) — a throw here degrades silently to the floor.
- `runP6Edge` (`headless.ts:2563-2566`): `"keyless"` → floor; **`"failed"` returns the synthesized project as-is** — the wild path doesn't read that verdict, it only reacts to the resulting `hitl`/DoD.
- `materializeEmitTree` (1842-1861): silences import failure.
- `emitProject` (1875-2016): **default `redTree:"refuse"` → `RT_E_TREE_RUN_FAILED`** (1886-1897); `RT_E_FOREIGN_FILES` (1921); `RT_E_BUSY` (1960). The P6 journey's internal candidate emit passes `redTree:"probe"` (2281); run-eval passes `"banner"` (2305).
- **The green-looking strand:** `mintTreeRunTested` (`codegen.server.ts:3766-3805`) mints `lastTest.label="tested"` **only** on a green tree-run with ≥1 passing spec **AND ≥1 assertion**; a no-spec/UI-shell tree emits `p6.tree.tested.skipped` and **never mints** → `p6-verified` (`dod.ts:592-609`) stays red → `driveP6Journey` returns `failed` (2524-2531) → enforceDod blocks leaving P6.
- **`p7-research` (`dod.ts:676-681`)** passes only via `research.length>0 || meta.liveUnavailable===true`. The **wild path never calls `liveLayer`** (non-P6 = plain `applyPhaseResult`, `engine.ts:4417`); `bareNodeLiveOverlay`/the waiver are headless-`runPhase(live)` only. run-eval's keyed trial runs **both** drains with `live:false` (`run-eval.mjs:2254,2260`). ⇒ High-confidence **P7 hard-DoD stop on any keyed+`enforceDod` run** (`enforceDod` defaults to `keyedDeepSeekConfigured()` — `engine.ts:1930-1931`). *Not executed — flag as probe-priority; the only unverified link is whether `attachAlgorithms` seeds `research`.*

### 4 · Driver capability diff
| | store driver (`startWildRun` 1107-1297) | CLI `wild` (4121-4444) | CLI `unattended` (`runUntilGate`) |
|---|---|---|---|
| cap | **20** | 24 | 40/60 |
| liveLayer / p7 waiver | ✗ | ✗ | **✓** |
| stock-gate self-approval | ✓ (forceHuman only) | ✓ | **✗ (parks)** |
| `attachWildPlan` | ✗ | **✓ (keyed)** | ✗ |
| concurrency | `rebaseUserFields`+`rebaseConcurrentEngine` (1207-1218) | single proc + file lock | same |
| on pause | returns, no re-entry | macro-run breaks (`4157,4349`) | terminal |

Neither is a superset: `wild` self-approves gates but has **no live layer** (P7 red); `unattended` has the live layer but **parks at P4/P5/P8/P9**.

### 5 · THE BLOCKER VERDICT
- **Sequential completion:** CONDITIONAL — clears all stock gates keyed; stops on `forceHuman` P0-reframe / P6-failed-sandbox (`engine.ts:3946`) and on any red gate under `enforceDod` (`engine.ts:1930`).
- **Synthesis:** CONDITIONAL-PASS — one real seam (`runP6Edge`→`driveP6Journey`, budget 3) wired for run/gate/wild/console-store (`store.ts:1064`); honest refusals.
- **Tree-green:** CONDITIONAL — depends on compile-check `treeRun` + 3-cycle repair; ship-emit refusals are coded.
- **Acceptance:** CONDITIONAL — honest and strict (`run-eval.mjs:1037-1081`, `passesAcceptance:2604-2612`, `acceptanceFailReason:2624`).
- **Mint:** **CONDITIONAL (narrow)** — requires ≥1 executed spec+assertion; a UI-shell/no-spec green run never mints → `p6-verified` red → P6 hard-stop.

**Bottom line:** wiring = CONFIRMED complete. "No structural blocker" = **FALSIFIED** for the P0-reframe path, the red-gate-under-`enforceDod` path (sharpest: P7's missing live layer in the wild path), and the no-mint → P6-red path. Cheapest falsification test (keyless-safe, no keyed calls): drive a seeded `enforceDod:true` project through injected-reviewer `wildStep` and assert whether it pauses at P7.