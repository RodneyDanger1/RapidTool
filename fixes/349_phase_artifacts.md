# 349 L3 — per-phase artifacts + plain-English phase descriptions

Branch `rt349-phases` (base `e06595d`), isolated worktree
`C:\Users\mnril\AppData\Local\Temp\rt_final_wt\phases`. Owned files touched:
`src/lib/phases.ts`, `src/lib/phases.test.ts`, `src/lib/engine.test.ts`.

## 1. AUDIT — does every phase 0–12 record ≥1 artifact with a non-empty body?

Method: parsed every persisted `build.json` under
`../testruns` (71 files) and, for each run, counted artifact rows per
`Artifact.phase` and flagged any row whose `body.trim()` was empty. Then ran
the REAL keyless engine both through the shared fixtures
(`testing/fixtures.ts → applyPhaseResult`) and through the real headless driver
(`headless.ts createProject/runUntilGate/approve`).

### Persisted runs (cited paths)

`C:\Users\mnril\AppData\Local\Temp\rt_final_wt\testruns\campaign2\*\build.json`

| run | status | phases complete | artifacts | per-phase count 0..12 |
|---|---|---|---|---|
| bakery-florist-orders | running | 0–6 | 25 | 9,2,2,2,2,2,6,0,0,0,0,0,0 |
| bakery-website | running | 0–6 | 25 | 9,2,2,2,2,2,6,0,0,0,0,0,0 |
| flower-shop-website | **complete** | 0–12 | 50 | 9,2,2,2,2,2,3,8,2,3,2,8,5 |
| held-out-community-tool-library | running | 0–6 | 25 | 9,2,2,2,2,2,6,0,0,0,0,0,0 |
| mobile-companion | running | 0–6 | 25 | 9,2,2,2,2,2,6,0,0,0,0,0,0 |
| office-invoice-tracker | awaiting_hitl | 0–5 | 23 | 9,2,2,2,2,2,4,0,0,0,0,0,0 |
| office-scheduler | **complete** | 0–12 | 50 | 9,2,2,2,2,2,3,8,2,3,2,8,5 |
| office-stock-tracker | running | 0–6 | 25 | 9,2,2,2,2,2,6,0,0,0,0,0,0 |

`C:\Users\mnril\AppData\Local\Temp\rt_final_wt\testruns\default-check\*\build.json`

| run | status | phases complete | artifacts | per-phase count 0..12 |
|---|---|---|---|---|
| bakery-florist-orders | running | 0–6 | 25 | 9,2,2,2,2,2,6,0,0,0,0,0,0 |
| bakery-website | **complete** | 0–12 | 50 | 9,2,2,2,2,2,3,8,2,3,2,8,5 |
| mobile-companion | **complete** | 0–12 | 50 | 9,2,2,2,2,2,3,8,2,3,2,8,5 |
| office-stock-tracker | **complete** | 0–12 | 50 | 9,2,2,2,2,2,3,8,2,3,2,8,5 |

**Result: every phase 0–12 in every COMPLETE run records ≥1 artifact with a
non-empty body.** Zero empty-body rows in any of the 71 persisted runs. The
`0` columns are phases that never ran (the run stopped at P6 / P5) — their
records are `locked`/`ready`, never `complete`, so they are not "a completed
phase that produced nothing".

### Live confirmation (real keyless engine, no key, no network)

Real headless drain (`createProject` → `runUntilGate` → `approve`, P12 sealed):

```
status complete currentPhase 12
P0  rows=3 nonEmpty=3 scorecard,algorithm,gate
P1  rows=2 nonEmpty=2 graph,gate
P2  rows=2 nonEmpty=2 memory,gate
P3  rows=2 nonEmpty=2 mcp,gate
P4  rows=2 nonEmpty=2 security,gate
P5  rows=2 nonEmpty=2 validation,gate
P6  rows=3 nonEmpty=3 code,code,gate
P7  rows=2 nonEmpty=2 research,gate
P8  rows=2 nonEmpty=2 ui,gate
P9  rows=3 nonEmpty=3 cicd,cicd,gate
P10 rows=2 nonEmpty=2 edge,gate
P11 rows=2 nonEmpty=2 tools,gate
P12 rows=5 nonEmpty=5 docs,docs,docs,gate,packet
```

`gate`/`packet` are bookkeeping rows (excluded by `phaseCoverage`); each phase
also has ≥1 deliverable row with a real body (`synthesizePhase` cases 0–12,
`engine.ts:863–1528`). **No phase records none, so deliverable 2 (an honest
"no output produced" artifact) has no target — reported, not forced.**

## 2. Changes

- `src/lib/phases.ts` — added `PHASE_DESCRIPTIONS: Readonly<Record<PhaseId,
  string>>` (13 plain-English one-liners, keyed by id, compile-time exhaustive)
  and `phaseDescription(id)`. Additive; `PhaseDef.summary`/`title` untouched so
  every existing pin (packet/crew/diagram/phases.test) is byte-stable.
- `src/lib/phases.test.ts` — new describe asserting every phase 0–12 has a
  non-empty `title` + a non-empty, single-line, plain-English description, and
  that the map is exhaustive over the real graph.
- `src/lib/engine.test.ts` — new keyless describe driving
  `runHeadless(seedProject(), ALL_PHASES)` and asserting each phase 0–12 records
  ≥1 artifact with a non-empty body (plus the run really sealed P12).

## 3. Commands + output

```
> node --experimental-strip-types --test --test-reporter=tap src/lib/engine.test.ts src/lib/phases.test.ts
1..31
# tests 88
# suites 31
# pass 88
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2069.738887
```

```
> node_modules\.bin\tsc.cmd --noEmit
tsc exit=0
```

## 4. Residuals

- The problem statement's premise ("some phases produce none") did not
  reproduce: every complete phase in every persisted run and in both real
  keyless drivers already records a real artifact. Recorded here instead of
  landing a fabricated producer.
- `PHASE_DESCRIPTIONS` is exported but has no in-tree consumer yet (the sibling
  report/documents lane reads it); wiring it into a report surface is outside
  this lane's owned files.
