# 65 — Pillars 4+12 (agent B4): verify-loop lint-failure heuristics + synthetic dry-run benchmarking (bench.ts)

**Status:** LIVE. `src/lib/verify.server.ts` gains `lintFailures()` (Pillar 4
self-healing extension — advisory lint heuristics appended to verify evidence;
the existing test-and-repair loop remains the ONLY repair mechanism) and the
new pure module `src/lib/bench.ts` + `src/lib/bench.test.ts` ship Pillar 12
(synthetic dry-run estimates: tokens / complexity / failure points / time).
bench.test.ts: **22 tests, 0 fail** · verify.test.ts: **24 tests, 0 fail**
(+6 lintFailures). This slice's gates: targeted strict `tsc` over the 4
touched files **0 errors**; `npm run build` **exit 0**; `npm test` src/lib
phase shows **0 failures** in bench/verify suites. Project-wide `npm run
typecheck`/`npm test` also run clean of this slice — the only remaining
project-wide failures at write time are NON-owned files in flight from
parallel agents (`src/components/console.tsx` typecheck, knowledge/swarm/
ast-mine/watcher test files — crew.test.ts already converged) plus 10
pre-existing `scripts/*.test.mjs` environment failures (symlink/og tests,
template-baked Sep 4, Windows host).

## Pillar 4 — lint-failure heuristics on the verify loop (verify.server.ts)

The machine-run verify loop declares pass/fail from the runner alone. What the
oracle cases cannot express is *style-level* failure risk (console.log
leakage, `var`, loose `==`) — none of which changes behavior, so a module can
pass every case while still shipping a smell. This slice adds:

- **`lintFailures(source)`** — pure, deterministic, linter-adjacent heuristic
  (NOT eslint, NOT a parser): scans for `console.<method>(` leakage,
  `var` declarations, and loose `==` (excluding `===`/`!==`) over
  `stripStringsAndComments()` output so strings/comments cannot false-positive.
  Returns advisory `LintFailure[]` in fixed rule order
  (`no-console`, `no-var`, `eqeqeq`), each with occurrences + first line.
- **Evidence append, not a new gate:** `verifyAndFixServer()` computes
  findings per iteration and appends `; lint advisory: no-console x1; …` to
  the evidence of the passed/failed/exhausted outcomes, plus an optional
  `VerifyOutcome.lint` field. Findings NEVER block a machine pass — a source
  with lint findings can still earn `status: "passed"` (the honest contract:
  the machine-run pass is about behavior; the advisory travels with the
  evidence). The DeepSeek test-and-repair loop is untouched and remains the
  repair mechanism.
- Shared text primitives (`stripStringsAndComments`, `countLooseEquals`) live
  in bench.ts and are imported here so both heuristics cannot drift apart.

## Pillar 12 — synthetic dry-run benchmarking (bench.ts, NEW)

Pure, deterministic, zero-dep module answering "how expensive / risky is this
project's build?" from static Project signals BEFORE it runs. Input is a
structural subset of the store `Project`
(`{ brief, generatedSource, artifacts, phases }`) so a real Project object can
be passed directly. **No LLM, no timers, no randomness, no filesystem.** Every
result carries `estimate: true`, an exact `method` string and an honest
`label` (`synthetic dry-run estimate — heuristic, not a measured run`) — these
are heuristics, never measured values.

- **`estimateTokenCost(project)`** — `ceil(totalChars/4)` (brief + generated
  source + artifact bodies in the char pool) plus per-phase overhead:
  `Σ round(250 × PHASE_TOKEN_MULTIPLIERS[id] × statusWeight)` over
  participated phase records.
- **`complexityScore(project)`** — branch/loop heuristics over the scrubbed
  generated source + artifact weight:
  `score = 2×if + 3×loop + 2×switch + catch + ternary + logical(&&/||) +
  2×artifact`, banded low (<8) / medium (<20) / high, with a full metric
  breakdown.
- **`failurePointScan(project)`** — advisory list of where the module is
  LIKELY to fail machine verification: `missing-exports` (high), `long-function`
  (medium, bodies > 40 lines between consecutive openers, line reported),
  `eqeqeq` (low), `no-unused-decl` (low).
- **`projectedTime(project)`** — phase-weighted minutes over participated
  phases (PHASE_MINUTES table keyed by PhaseId 0–12, default 30 for unknown
  ids); statuses: complete/rejected = full weight, running/awaiting_hitl =
  half, ready/locked/unknown = 0.

Phase vocabulary mirrors the store (`PhaseStatus`); weight tables are exported
constants pinned by tests — tuning is a deliberate, test-visible change.

## Exact export surface — compile against these

`src/lib/bench.ts`: `BenchProject`, `BenchPhaseLike`, `BenchArtifactLike`,
`TokenCostEstimate`, `ComplexityEstimate`, `ComplexityDetail`,
`FailurePointScan`, `FailureAdvisory`, `TimeEstimate`, `PhaseParticipation`,
`estimateTokenCost`, `complexityScore`, `failurePointScan`, `projectedTime`,
`stripStringsAndComments`, `countLooseEquals`, `phaseStatusWeight`,
`participatedPhases`, `minutesForPhase`, `multiplierForPhase`, labels
(`TOKEN_ESTIMATE_LABEL` … `FAILURE_POINT_LABEL`, `ESTIMATE_DISCLAIMER`) and
weight tables (`PHASE_MINUTES`, `PHASE_TOKEN_MULTIPLIERS`, …).

`src/lib/verify.server.ts` (additive only): `LintFailure`,
`lintFailures(source)`; `VerifyOutcome` gains optional `lint?: LintFailure[]`.
All pre-existing exports unchanged (sanitizeOracleExpression, parseOracleJson,
runCases, generateCases, verifyAndFixServer, VerifyCase, CaseResult).

## Files touched

- NEW `src/lib/bench.ts` — Pillar 12 estimators + shared text primitives.
- NEW `src/lib/bench.test.ts` — 22 tests (token estimates incl. multiplier/
  status-weight absolutes; complexity formula + level boundaries; failure-point
  advisories; time projection; scrubber/loose-eq primitives).
- `src/lib/verify.server.ts` — patched: lintFailures + evidence append
  (+2 imports, +3 return sites). No renamed/removed exports.
- `src/lib/verify.test.ts` — patched: 6 lintFailures tests appended.
