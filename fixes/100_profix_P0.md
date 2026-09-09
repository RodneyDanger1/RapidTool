# 100 — P0 pipeline fixes: PRO FIXER P-A application log (fixes/97 consumers)

- **File:** `fixes/100_profix_P0.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`).
- **Fixer:** PRO FIXER P-A (P0 pipeline lane) · 2026-09-06. Consumes `fixes/97_leap_analysis_P0.md` (ANALYZER H-A) LIVE.
- **Ownership (strict):** `src/lib/engine.ts`, `src/lib/sandbox.ts`, `src/lib/dod.ts`, `src/lib/phases.ts` + their tests + this file. **Out-of-lane (sibling fixers):** store.ts, headless.ts, console.tsx, packet.ts, algorithms.ts, types.ts, scaffold.ts, scripts/*, src/lib/codegen.server.ts (new).
- **Discipline:** reason → verify anchors → patch → regression test → typecheck + lane suites. Every fix logged here with file:line after landing.

---

## Spec map (from 97 §F sequencing) — this lane's scope

| Spec | Defect | In-lane parts (applied here) | Out-of-lane parts (logged, not applied) |
|---|---|---|---|
| P0-01 | DF-01 P6 simulator toy | Part A: sandbox.ts helpers + header, dod.ts `p6-brief-fit`, engine.ts P6 artifact title + HITL copy | Part B: codegen.server.ts, types.ts `implementationSpec`, headless/CLI wiring, scaffold embed |
| P0-02 | LEX dev-tool vocab | dod.ts `p0-brief-grounded` probe + `briefHasVocabulary`, engine.ts case-0 vague memory row/log | LEX entries + `kindHints` (algorithms.ts) |
| P0-03 | DF-02 P8 wrong product | engine.ts case 8 kind-aware + gate prompt, phases.ts P8 summary | console.tsx evidence bundle |
| P0-04 | DF-03/04/06 unimplemented-as-fact | capability ledger in dod.ts, engine.ts cases 1/2/3/5/10/11, phases.ts summaries | scripts/check-capability-claims.mjs |
| P0-05 | DF-05 P4 gate fiction | engine.ts P4 gate prompt | console.tsx evidence row |
| P0-06 | DF-09 approval-note asymmetry | engine.ts approveHitl note guard | store.ts / headless.ts / console.tsx mirrors |
| P0-07 | DF-08 advisory "sealed" lie | dod.ts `sealSummary`, engine.ts delivery/wild copy | console.tsx rail, packet.ts gate_summary, types.ts comment |
| P0-08 | wild packet re-stamp | engine.ts wildApproveGate + P12 wild | store.ts autopilot branches |
| P0-09 | verify --apply convergence | dod-side converge property test (gates.test.ts) | headless.ts applyVerifyOutcome, cli.mjs echo |

---

## Corrections to 97 (logged as I reason; each: what the spec said → what I did → why)

1. **P0-02 vague memory row kind "note" does not exist** — `MemoryEntry.kind` is `"episodic" | "semantic" | "procedural"` (`types.ts:99`); a `{kind:"note"}` row would fail typecheck. Used `kind:"semantic"` with the LEX-gap text, `source:"engine"`.
2. **P0-04 capability ledger location** — spec wants NEW `src/lib/capabilities.ts`; that file is outside my strict ownership (no new src files in this lane). Ledger + `capabilityLine`/`b18Tail` exported from `dod.ts` (pure, zero-dep); a future lane may move it verbatim.
3. **P0-04 P1 title vs handoff pin** — spec: replace title with "Execution topology (this build)" unconditionally. `handoff.test.ts:49` (handoff lane, not mine) pins `P1 · graph · Dispatcher topology` on a fixture brief that genuinely hits the LEX `dispatch` vocabulary ("field-service dispatch board"). Keeping "Dispatcher topology" for dispatch/workflow-vocabulary briefs is honest AND preserves the sibling fixture; other kinds get "Execution topology (this build)". (See FIX-P0-04-1.)
4. **P0-06 engine throw breaks store/headless tests until mirrors land** — `store.test.ts:195-227` calls `approve(id, {force:true})` with no note on a forceHuman gate; `store.ts:998` passes no note to `approveHitl`. The engine guard (spec item 1, "engine law first") throws → those two tests fail until the store lane lands 97 P0-06 item 2 (pass `note` through). Disclosed, not worked around: a violated approval rule must throw, never silently pass.
5. **P0-07 P12 `delivery.complete` timing** — the case-12 log fires during `synthesizePhase`, before P12's own gate can be recorded (`recordGateInto` runs after). `sealSummary` therefore reports the recorded-gate truth at that instant (P12 counted un-gated); honest, and the wild terminal copy (post-record) shows the final count.

---

## Fix log (appended per batch)

<!-- FIXES -->
