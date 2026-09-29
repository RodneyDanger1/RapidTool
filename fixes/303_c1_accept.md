# fixes/303_c1_accept.md — LANE L1 · ACCEPTANCE/EVAL TRUTH TAIL (CODER C1)

> Wave W42 · cards L1-E1…E-6 per `wave_plans/W42/SPEC.md` §2. File box: `scripts/run-eval.mjs` ·
> `scripts/run-eval.test.mjs` · `src/lib/scorecard.ts` (+ NEW `src/lib/scorecard.test.ts`) ·
> `src/lib/fixtures.ts` · `src/lib/fixtures.server.ts` · `src/lib/fixtures.test.ts`.
> Opened EARLY, append-only. One evidence line per card: `file:line · before → after · proof`.

## Status board (updated as cards land)

| Card | What | Status |
|---|---|---|
| L1-E1 | `endClass` on results.json `entries` rows + crash row [S] | DONE (R1; R2 smoke-verified) |
| L1-E2 | scorecard reader: verification + endClass + census + NEW scorecard.test.ts [M] | DONE (R1; R2 render-verified) |
| L1-E3 | missing pins (U1 + Q4-b/c) in run-eval.test.mjs [M] | DONE (R1; R2 run 41/41) |
| L1-E4 | fixtures: no fake review rows (`f.ok` gate) [S] | DONE (R1; R2 bytes re-verified) |
| L1-E5 | dead fixture-decision exports disposition [S] | DONE (R1; R2 grep re-verified) |
| L1-E6 | run-eval hygiene cluster (atomic writes, history cap, main-check) [S-M] | DONE (R2 — pins run 41/41) |

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

---

## Round-2 close-out (D1 — full evidence in `fixes/304_d1_accept.md`)

- **E-4** [LANDED, R1] `fixtures.ts:239` `reviewState: f.ok && graderOk ? "awaiting-decision" : "bar-missing"`; `fixtureProblem` `:223`/`:237`; `fixtures.test.ts` 8/8. R2: bytes re-read ✓.
- **E-5** [LANDED, R1] `@de-scoped` blocks `fixtures.ts:23-31` (above `FixtureVerdict` `:36`) + `:252-262` (above `fixtureDecisionEntry` `:256`). R2 repo-wide grep → `src/lib/fixtures.ts` (definitions) + `src/components/console.tsx:465-466` (W24 comment reach — not a consumer) — zero code consumers stands.
- **E-6** [LANDED, R1 code; R2 pins RUN] `writeJsonAtomic` `run-eval.mjs:2885` + both persists `:2912`/`:2948`; `MAX_HISTORY_ROWS = 200` `:2871`; `isMainModule` `:3372-3378` already the target idiom (E-6(c) struck R1 ✓). **Pins: `node --experimental-strip-types --test scripts/run-eval.test.mjs` → 41/41 pass, 0 fail** (plain `node --test` → 41/41 too).
- **R1 tails closed (this file's ⚠1–3):** pins run ✓ (above) · E-4/E-5/E-6 evidence written ✓ (this section + board above) · **keyless `EVAL_OUT_DIR` scratch smoke** ✓ — Temp scratch, `--limit=2`, exit 0 → entries + history rows carry `endClass`; then CLI `eval` render (exit 0) carries `derived.endClass`/`derived.acceptance` + entry `behaviorOk`/`kindOk`/`endClass`/`acceptance.verification` verbatim (cli.mjs untouched: grep `endClass|verification` = 0/0). Pre-existing F4#3 `meanAtLeast:1` unreachability fired as expected — recorded, not fixed.


