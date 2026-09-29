# fixes/303_c1_accept.md — LANE L1 · ACCEPTANCE/EVAL TRUTH TAIL (CODER C1)

> Wave W42 · cards L1-E1…E-6 per `wave_plans/W42/SPEC.md` §2. File box: `scripts/run-eval.mjs` ·
> `scripts/run-eval.test.mjs` · `src/lib/scorecard.ts` (+ NEW `src/lib/scorecard.test.ts`) ·
> `src/lib/fixtures.ts` · `src/lib/fixtures.server.ts` · `src/lib/fixtures.test.ts`.
> Opened EARLY, append-only. One evidence line per card: `file:line · before → after · proof`.

## Status board (updated as cards land)

| Card | What | Status |
|---|---|---|
| L1-E1 | `endClass` on results.json `entries` rows + crash row [S] | IN PROGRESS |
| L1-E2 | scorecard reader: verification + endClass + census + NEW scorecard.test.ts [M] | TODO |
| L1-E3 | missing pins (U1 + Q4-b/c) in run-eval.test.mjs [M] | TODO |
| L1-E4 | fixtures: no fake review rows (`f.ok` gate) [S] | TODO |
| L1-E5 | dead fixture-decision exports disposition [S] | TODO |
| L1-E6 | run-eval hygiene cluster (atomic writes, history cap, main-check) [S-M] | TODO |

## Evidence

### L1-E1 — endClass on entries rows + crash row [LANDED]
- `scripts/run-eval.mjs:2566-2576` · entryRow literal gained `entryRow.endClass = historyEndClass(entryRow, mode);` (after the literal; the object already carries `acceptance` + `notes.noBalance`; placeholder `pass:false` classifies identically to either final boolean verdict) · `node --check scripts/run-eval.mjs` → OK.
- `scripts/run-eval.mjs:3265-3268` · crash-fallback row gained `endClass: "unmeasured"` + comment citing the classifier doc · same check.
- End-to-end proof (keyless scratch `EVAL_OUT_DIR` smoke) → see E-6 evidence line (single smoke covers both).

### L1-E2 — scorecard reader: verification + endClass + census + NEW scorecard.test.ts [LANDED]
- `src/lib/scorecard.ts` · `EvalAcceptance.verification` (+ `readAcceptance` reads it); `EvalEntry.behaviorOk/kindOk/endClass` (+ `readEntry` reads them from `raw.acceptance`/`raw.endClass`); `EvalHistoryRow.endClass` (+ `parseEvalHistory`); `derived.endClass {funded,unfunded,unmeasured,absent}` + `derived.acceptance {pass,fail,unscored}` + two census notes lines.
- NEW `src/lib/scorecard.test.ts` (5 tests) · `node --experimental-strip-types --test src/lib/scorecard.test.ts` → **5/5 pass, 0 fail** (legacy-nulls+absent, populated-rides, census arithmetic incl. bogus-value→absent, hostile shapes, slug-filter census).
- CLI `eval` responds the scorecard verbatim (`rapidtool-cli.mjs:1523` `respond({ ...scorecard, notes, trends })`) — no cli.mjs edit; `derived.endClass` renders free.

### L1-E3 — missing pins (U1 + Q4-b/c) [LANDED]
- `scripts/run-eval.test.mjs` · imports += `checkExpectedBehavior`, `historyEndClass`; 4 new tests (REAL spawn via the exported seam: exit-0→pass w/ detail `exit 0 in Nms`, exit-1→fail w/ `exit 1 ≠ declared exit 0 (exec of …)` + `behaviorOk:false` + reason naming the code; coded-detail bound 120 chars; `historyEndClass` tri-state + synthetic entries-shaped row; wiring guard for E-1).
- `node --check scripts/run-eval.test.mjs` → OK · `node --experimental-strip-types --test scripts/run-eval.test.mjs` → **39/39 pass, 0 fail** (baseline 35 untouched + 4 new).

