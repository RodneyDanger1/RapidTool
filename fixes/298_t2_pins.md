# fixes/298 — T2: the six contract-collision reds (per-red diagnosis + re-point/fix)

HEAD at open: `3ebea43` (tree clean on entry). Task: fix the six remaining reds from the
2251/2242/8 FAIL barrage. Method per red: run its file FOREGROUND, read actual-vs-expected,
decide staleness-vs-real-bug by the era's law (new contract wins → re-point the pin asserting
MORE; real bug → fix product at cause). Evidence line per change. Final table at the bottom.

Scope (tap-verbatim failing names):
1. `fixes/144 (M4-2) — driveP6Journey (fake-deps: deterministic...)` — src/lib/headless.test.ts
2. `fixes/144 M5-1 + T-11 — the red-seal evidence digest` — src/lib/lesson-writers.test.ts
3. `applyReport` (nested: blocked-report note + rejection-history) — src/lib/report-intake.test.ts
4. `scaffoldProject — leftover job-* nodes (fixes/196)` — src/lib/scaffold.test.ts
5. `wildStep onEvent telemetry (109 CAP-5)` — src/lib/wild-step.test.ts
6. `W-01 (fixes/271 · §R1-f01) — the wild P6 keyed edge seam` — src/lib/wild-step.test.ts

Status: CLOSED — all six reds landed by V1 (fixes/300, HEAD `4af061a` + working tree); every
implicated file re-run foreground green. T2's line anchors held within ±2.

## Final table (V1 landing)

| # | red | file | diagnosis | landed fix | re-run |
|---|-----|------|-----------|------------|--------|
| 1 | W-02 keyless floor | src/lib/headless.test.ts | STALE PIN — fixes/295 F2-03 envelope `input_hash` (wall-clock fold; zero behavior change) | mask `"input_hash"` in `stripVolatiles` (:639) | 96/96 ✓ |
| 2 | red-seal evidence digest | src/lib/lesson-writers.test.ts | REAL BUG — `fitLessonEvidence` discarded the atomic `class:` clause behind a 249-char head, then `.slice(0,240)` trampled | engine.ts:1318-1331 — room guard into branches; exact-fit `keep = max("unmet: ".length, budget - 3 - seg.length)` trim | 25/25 ✓ |
| 3 | blocked-report note | src/lib/report-intake.test.ts | SANCTIONED STALE PIN — F2-21 stamps `REPORT_BLOCK_MARKER` | re-point :208/:212 to the marked bytes (asserting MORE) | 23/23 ✓ |
| 4 | leftover job-* oracle rows | src/lib/scaffold.test.ts | STALE PIN — W16+W17 coded-refusal (`RT_E_VALIDATION`) superseded the bare `TODO+(E-15+)` form (probe: `matches: false`) | re-point :743/:761 — byte-verified escaped regex | 37/37 ✓ |
| 5 | sink parity | src/lib/wild-step.test.ts | STALE PIN — fixes/295 F2-03 `input_hash` | mask in `normalize` (:195) | 14/14 ✓ |
| 6 | W-01 seam parity | src/lib/wild-step.test.ts | STALE PIN — fixes/295 F2-03 `input_hash` | mask in `stripVolatiles` (:285) | 14/14 ✓ |

Cross-checks: `src/lib/exec.test.ts` **19/19 ✓** (T1's file — stayed green);
`src/lib/honesty-guards.test.ts` **13/13 ✓** (second `p6.seal.unmet` pin — no collateral from
the engine fix). Full per-red evidence: `fixes/300_v1_sixpins.md`.

