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

Status: OPEN.

