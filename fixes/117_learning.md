# 117 — Wire the L1–L5 lesson writers at engine seal / verify outcome / run completion

Lane: PRO FIXER P-D2C (continuation of P-D2 — the knowledge-store read-back fix).
Date: 2026-09-07 · Host: Windows, `C:\Users\mnril\Desktop\RapidTool Main` (not git).
Scope: the self-learning loop's **runtime call sites** — the L1–L5 builders in
`knowledge.ts` were pure+tested but had exactly one lazy production caller
(`report-intake.ts` L2 on agent-report ingest). Real journeys (CLI/headless
`gate` / `verify --apply`) captured ZERO lesson rows (98_make_1/2/3 W4). This
wave wires the three missing capture sites.

## What was wired

### (1) ENGINE SEAL — `src/lib/engine.ts`
- **L1 vague-brief** — in `synthesizePhase` case 0 (the P0 lattice-seal region):
  when `lattice.vague` is true **or** the lattice sealed empty (no jobs and no
  entities) while the brief still carries real nouns (`absentLexNouns` non-empty),
  mint `vagueBriefLesson(project, absent)` into the phase memory. Emits a
  `lesson.capture` ledger event.
- **L2 template-emission** — in `applyPhaseResult` (the engine seal function that
  every path funnels through: headless `runPhase`, store, `wildStep`,
  `liveLayer`): after a phase seals `complete` (never `awaiting_hitl`), re-run
  `runGate`; if `!pass`, mint `templateEmissionLesson(project, phase,
  unmet.map(g => g.criterion), absentLexNouns, evidenceHash)`. Twin-dropped by id
  before merge (H43-P2-1 replacement) so a re-seal never forks a row.
- `knowledge.ts` is resolved via a lazy `void import()` surface (its static
  `node:fs` import is client-hostile — same seam `report-intake.ts` uses), so the
  client bundle is unchanged (build emits a separate `knowledge-*.mjs` chunk).

### (2) VERIFY OUTCOME — `src/lib/verify.server.ts` + `src/lib/headless.ts`
- `verifyAndFixServer` now mints the lesson **at the outcome point** and returns
  it as `VerifyOutcome.lesson`:
  - `passed` → L4 `verifiedProcedureLesson`;
  - `failed` / `error` (refused oracle/compile, exhausted iterations) → L3
    `verifyFailureLesson`;
  - `not-configured` → no lesson (never a failure signal).
- `headless.applyVerifyOutcome` appends `outcome.lesson` to `project.memory`
  (id-deduped, capped at 80) + a `lesson.capture` log. Deterministic, no keys.

### (3) RUN COMPLETION — `src/lib/headless.ts`
- `runUntilGate` mints **L5 run-summary** at terminal `complete` via
  `runSummaryLesson(project)` when the journey carried gate failures
  (`phases[].gate.passed === false`), rejections, or `verify.fail` logs. Honest
  digest text, content-addressed, dropped on a clean run.

### knowledge.ts (additive factories only)
- `verifyOutcomeLesson(status, phase, evidence, iterations)` — project-free L3/L4
  dispatch reusing the existing builders (they ignore their `project` arg).
- `runSummaryLesson(project)` — L5 run-summary (honest digest, null on clean run).

## Idempotency / provenance / boundedness (98 §0 laws)
- Every row is content-addressed: id `lesson-<class>-<fnv8(text)>` — identical
  text ⇒ identical id ⇒ the append sites' id-dedup makes re-seal/re-apply an
  exact no-op.
- Provenance: all engine/verify writers stamp `source: "engine"` (the
  `MemoryEntry.source` union has no separate "verify" member); human/agent-report
  rows are untouched.
- Bounded: lesson text ≤ 240 chars (`LESSON_TEXT_MAX`); `project.memory` capped
  at 80 rows at every append; `lesson.capture` logs ride the 200-row ledger cap.

## Files touched (ownership-respected)
- `src/lib/engine.ts` — P0 lattice-seal region + `applyPhaseResult` seal tail +
  lazy `LessonSurface`. **Not** the liveLayer P6 seam; **not** the phase-body
  synthesis regions (P-D3).
- `src/lib/verify.server.ts` — `VerifyOutcome.lesson` + outcome-point minting.
- `src/lib/headless.ts` — `applyVerifyOutcome` append seam + `runUntilGate`
  completion (L5). No vault/design/diagram/harvest/etc. edits.
- `src/lib/knowledge.ts` — two additive factories (`verifyOutcomeLesson`,
  `runSummaryLesson`).
- `src/lib/lesson-writers.test.ts` — NEW regression suite.
- Did **not** touch `store.ts` / `io.ts` / `packet.ts` (F-H1 / F-H2 lanes).

## Wiring proof (fixture run → lesson rows)
`node --experimental-strip-types --test src/lib/lesson-writers.test.ts` → 8/8:
- L1: `applyPhaseResult(emptyProject("build a tool for my team please"), 0)`
  ⇒ `lesson-vague-brief-<8hex>` (semantic, phase 0, tags [L1,lesson,vague-brief]).
- L2: `applyPhaseResult(runToGate(seedProject(), 6), 6)` (deterministic
  placeholder, brief nouns absent) ⇒ `lesson-template-emission-<8hex>` (episodic,
  phase 6, tags [L2,lesson,template-emission]).
- L3/L4: `verifyOutcomeLesson("passed"/"failed", …)` ⇒
  `lesson-verified-procedure-*` / `lesson-verify-failure-*`; `applyVerifyOutcome`
  appends the row (and a failed-outcome re-apply stays at exactly 1 row).
- L5: `runSummaryLesson` null on a clean run / row on a failed run; a full
  `runUntilGate` drain-to-complete mints exactly one `lesson-run-summary-<8hex>`.

## Gates
- `npm run typecheck` → 0 errors.
- `npm run lint` → 0 errors (16 pre-existing warnings).
- `npm test` src leg → 1205 pass / 0 fail / 1 skipped (the known grandchild
  timing `.skip`). scripts leg → 195/195.
- `npm run build` → 0 (vite build + db:migrate clean; `knowledge-*.mjs` emitted
  as a separate server chunk, confirming the client bundle is node:fs-free).
