# fixes/267_lane1_audit_engine.md — W27 R1 · the phase engine core (engine.ts, phases.ts)

**Slice:** `src/lib/engine.ts`, `src/lib/phases.ts` (+ tests). **Status: COMPLETE** (audit only — no product edits, no keyed calls, no full-gate runs).
**HEAD at lane time:** `e3d3fe4` ("W24-W26: spring-clean + deep audit + bug hunters — gates green on fused bytes"). Read window 2026-09-26 16:00–16:15 CDT. Re-grep anchors before any coder edit (10 writers share the tree).
**Mission lens:** truly autonomous software factory / best-in-class harness; GOOD code; every unwired/incomplete path is a defect. Every claim below: file:line (read today) or a real command's output.

## Read-first log
- [x] `wave_plans/W27/mass-investigation.md` (full) — mission + READ-FIRST + append protocol; R1 box.
- [x] `research/multiagent/thoroughanalysis.md` (full, 371 lines then; A1–A4 + C1–C6 rows).
- [x] `research/multiagent/thoroughaction.md` (full, 498 lines) — W24–W26 watchdog ledger.
- [x] `fixes/263_index.md`, AGENTS.md, plus `fixes/154_direction.md` §D7 + `fixes/149_a5` (the recorded wild-P6 intent).
- [x] The bytes: engine.ts (4033 lines — full chain read: wild 3456–4033, live layer 2763–3410, applyPhaseResult 1375–1598, create/hydrate 1820–2539, HITL 1629–1810); phases.ts (230 lines, full); `wild-step.test.ts` (full); headless.ts 340–760 + 1660–2219; store.ts 115–190, 550–640, 920–1110, 1355–1400; CLI run/gate/wild arms; llm-tasks.ts 1–200; provider/registry key lines.

## Deliverable 1 — §R1 block appended to `research/multiagent/thoroughanalysis.md`
Landed 16:16 (verified: marker intact = last line, 10 `**R1-fNN` rows, `grep -c` = 10). One concurrent sibling (R2) appended above the marker in the same window — protocol held, no cross-edit (R2's block even cites "C1-f03/C1-f07 live in engine.ts — R1's slice", consistent with these rows).

| ID | Sev | One-liner | Home file |
|---|---|---|---|
| R1-f01 | **P0** | `wildStep` never calls the keyed P6 seam (A1-f01 re-verified on e3d3fe4) — exact fix: `p6Edge` option + `wildP6Edge` helper (`"./head"+"less.ts"` idiom) + `phase === 6 && keyedDeepSeekConfigured()` guard + edge-naming log | engine.ts |
| R1-f02 | **P0** | tested mint unreachable from `run --live`/`gate --live`/wild (A1-f02 re-verified) — one seam `runP6Edge` (headless) = `driveP6Journey` + keyless floor fallback; `runPhase` delegates for P6; wild + runPhaseAsync call the same seam | headless.ts (+engine) |
| R1-f03 | P2 | modelRoute leak: llm-tasks requests pro (127/157/188), provider serves pro (deepseek.ts:343-394), engine stamps flash (2960-68) — thread served model, don't guess | engine.ts + llm-tasks.ts + llm.ts |
| R1-f04 | P2 | P0/P7/P11 silent catches (2790-92, 2813-15) vs the OV-13 rows elsewhere — `fetchResearch` DI seam + coded `liveDegradeRow`s on the research branch | engine.ts |
| R1-f05 | P1 [NEW] | `store.runP6Journey` — zero callers repo-wide; the console's only mint-reaching action is unwired | store.ts (+R6 UI) |
| R1-f06 | P3 | dead disjunct `p.kind === null` (2883) — producers can't emit null (1849 / 2425-27 / types.ts:323) | engine.ts |
| R1-f07 | P2 | `wellFormedDecisionRow` accepts non-finite `decidedAt` (2021-37) → packet toISOString RangeError class (C1-f01 engine half) | engine.ts |
| R1-f08 | P3 | engine/io scorecard validator divergence (C1-f04 engine half) — extract `usableScorecard`, one validator | engine.ts + io.ts (R2) |
| R1-f09 | P3 [NEW] | `upgradeP6Keyed` catch silent on keyed throw (2901-04) — coded row + `"synthesis"` LiveDegradeKind | engine.ts |
| R1-f10 | P3 [NEW] | `runP6Real` catch silent: thrown runner ≡ not-configured (3449-53) — return a G2 row; store appends it | engine.ts + store.ts (R2) |

Cross-refs recorded in the block (no separate rows): A1-f05 STANDS (`partialTreeRefuse` doesn't null `lastTest`, only `treeUpgraded:3383` does — R3's box); A1-f09 STANDS engine-side (enforceDod default can't be true in the browser — `emptyProject:1902-03` + `hydrate:2379`; fix is the console/create wire, R6/R2).

## Key evidence trail (commands actually run today; abridged)
- `grep -rn upgradeP6Keyed src/ scripts/` → def `engine.ts:2869` · comment `:2917` · call `:2920` — **one caller**; the seam comment at 2852-2856 ("shared by liveLayer AND the wild P6 step") is drift. `fixes/154_direction.md:233-241` (D7 step 2) records the owed wiring; `fixes/149_a5:195` says the same.
- `wildStep` execute call = `applyPhaseResult(running, phase)` — `engine.ts:3986`; no async keyed call anywhere in 3820-4033.
- Mint census: `grep -rn mintTreeRunTested|applyTreeRunTestedMint` → callers only `headless.ts:2100/:2142` (driveP6Journey) and `:2681/:2687/:2699` (repairTreeDir). `headless.ts:350-380` runPhase live → `liveLayer` only. CLI run/gate → `runUntilGate` (`rapidtool-cli.mjs:467-470`).
- `grep -rn runP6Journey src/ scripts/` → only its own decl (`store.ts:130`) + impl (`:923`); 0 hits in `console.tsx`.
- modelRoute: `llm-tasks.ts:127/157/188` request `deepseek-v4-pro`; `deepseek.ts:343-347` + `:388-394` serve pro; `engine.ts:2960-2968` stamps flash; surfaces `packet.ts:121`, `console.tsx:2540`; `phases.ts:89` documents the true mapping.
- Catch inventory (engine.ts): 2790 (silent, research), 2813 (silent, narrative), 2901 (silent, keyed upgrade), 3037/3063 (Coded — OV-13 good), 3363 (deliberate), 3403 (coded G2), 3451 (silent, runner), 3598 (→coded pause), 4002 (coded pause).
- `wild-step.test.ts` (202 lines): pins pause codes + telemetry only — **zero coverage of the execute branch** (the R1-f01 pin gap; fixture harness :14-40 + normalizer :184-197 ready to extend).

## Deliverable 2 — lane log (this file)
Complete. No product file was modified by this lane (`git status` clean except my two deliverable logs (`research/multiagent/thoroughanalysis.md` append + this file) and peer outputs).

## Trace limits / honest stops
1. No keyed calls (account unfunded — per wave rules): all funded "done-when"s in §R1 are coder-wave follow-ups.
2. Browser-runtime behavior of lazy `import("./headless." + "ts")` inside store actions: self-documented (`store.ts:928-934` — "in the browser the import itself fails … honest refusal") but NOT run-verified here (would need a dev-server run; not permitted this wave).
3. `synthesizePhase` (engine.ts:479-1192) read selectively (P6 :836-903, P8 :932-1009) + grep-swept (no TODO/FIXME markers) — not line-by-line; residual risk low.
4. `fixes/267_lane2_audit_state.md` (R2) owns packet.ts/store.ts/io.ts/dod.ts halves — R1-f07/f08/f10 name the engine side of those seams so the two lanes' fixes interlock rather than collide.
