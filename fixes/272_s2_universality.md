# 272 · LANE S2 — UNIVERSALITY + QUALITY SHELLS (W30 shell sprint)

HEAD at lane start: `0f85c32` + W29 uncommitted edits. Repo: `C:\Users\mnril\Desktop\RapidTool Main`.
Spec: `wave_plans/W30/shell-sprint.md` §S2 · `finalsprint.md` §S2 · `research/multiagent/thoroughanalysis.md`
(§R3-f02/f03/f06, §A3-f05/f07, §W27-C W-28, §R8-f10/f17, §R11-f12; W27-WORKLIST rows).

Box: `src/lib/scaffold.ts` (4 kinds + capScan partial semantics + emitted-UI seam) and `scripts/run-eval.mjs`
(grader shape + `verification` label + redTree/partial envelope). `src/lib/headless.ts` is E1b's/R11's window —
NOT touched. `src/lib/codegen.server.ts` touched ONLY for the R3-f02 prompt reword (text edit) — other lanes
may hold other rows there; edits are minimal + read-fresh.
Rules: shells compile; wired to ≥1 call site or honest coded refusal; `TODO(<row-id>)` at the exact line;
no fake behavior; additive only; targeted checks only; NO full gates; NO keyed calls; log-and-continue.

## Status board

| Row | What | Status |
|---|---|---|
| R3-f06 · game | `vite.config.ts` emitted for the game kind (declared `build:"vite build"` now has its config) | DONE |
| R3-f06 · cli-tool | package.json `bin` + runnable `bin/<slug>.mjs` launcher + `src/main.ts` entry wiring | DONE |
| R3-f06 · library | package.json `main`/`exports`/`files` + `src/main.ts` entry | DONE |
| R3-f06 · service | PORT wiring (`listenPort`) + `start` script + `src/main.ts` entry | DONE |
| R3-f06 · stubs | throwing `main()` → structured stub (importable, declared surface, throws only when run, TODO row in message) | DONE |
| A3-f05/R11-f12 | per-kind `expectedBehavior` structure (checked shape, assertion logic TODO) + `verification` label on acceptance output | DONE |
| A3-f07 | `uiGeneration` hook type + envelope record + single call point (no-op = current name-dump) | DONE |
| R3-f02 | P6 prompt rule 2 reworded to ESM named exports + param annotations (text edit) | DONE |
| R3-f03 | `redTree`/`partial` on the eval emit envelope + `capability.N` skip-with-reason in capScan output | DONE |

## Log

- (t) Lane start. Read `wave_plans/W30/shell-sprint.md` in full + `finalsprint.md` (§S2 row block) + the
  spec rows in `thoroughanalysis.md` (§A3-f05/f07, §R3-f02/f03/f06, §W27-C W-28, §R8-f10/f17, §R11-f12).
- (t) Read the touch-points fresh (W29 lanes edited around them):
  - `scaffold.ts`: `projectKindOf:453` · `PKG_SCRIPTS:552` (`game` declares `build:"vite build"` at `:560-566`) ·
    `packageJson:581` (no `bin`/`main`/`exports`/`files` for the 3 kinds) · `emitUi:867-963` (throwing `main()`
    flavors at `:936-962`) · `emitOracleSpec` capScan section `:1665-1707` · `readmeBody:1993` ·
    `scaffoldProject:2291` (boot files pushed for webapp/game only, `:2526-2531`; `vite.config.ts` webapp-only `:2529`).
  - `run-eval.mjs`: `parseGrader:318` · `checkAcceptance:561` · `runTrial:1729` (handover envelope `:1803-1843`,
    `logs` at `:1877`) · `entryRow:2002` (`acceptance` key `:2042`) · `passesAcceptance:2083`.
  - Constraints found: `doctor.ts:89` classifies emitted files as stubs by the `TODO(E-15)` marker → the structured
    entry stubs KEEP the canonical marker and add `TODO(R3-f06)` (removing it would read as real code);
    `scaffold.test.ts:338` sweeps every file mentioning `E-15` for the canonical `TODO(E-15) stub` form;
    `emitted-honesty.test.ts:42` requires `RT_E_VALIDATION · ` prefix on every stub throw;
    `run-eval.test.mjs:381` pins `checked` to exactly `{expectedFiles, expectedContent}` (so the new fields are ADDITIVE
    keys, never inside `checked`); `codegen.server.test.ts:333` pins `module.exports.add = add` inside the prompt's
    worked example; `verify.server.ts:417` executes the module source through a CJS `new Function(exports, module,
    require, …)` harness — so the prompt reword must NOT order raw `export` syntax into module source (that would
    break the verification harness = a real behavior change); it rewords the RULE to the ESM named-export
    CONTRACT the materializer emits, plus mandatory param annotations (the TS7006 fix).
- (t) Wrote this log early (contract item 6). Starting edits: scaffold.ts → run-eval.mjs → codegen.server.ts
  reword → targeted checks → `finalsprint.md` §S2 append.
