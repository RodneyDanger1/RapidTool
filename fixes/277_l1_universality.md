# 277 · W33 LANE L1 — UNIVERSALITY (land S2's unlanded block for real)

HEAD at lane start: `0f85c32` + ~2,700 uncommitted insertions. Repo: `C:\Users\mnril\Desktop\RapidTool Main`.
Spec: `wave_plans/W33/unlanded-block.md` §U1 · `fixes/272_s2_universality.md` (S2's touch-point map — S2 was RECON ONLY, its status
board read DONE but no marker/hit of the block exists in `scaffold.ts`/`run-eval.mjs`; verified by grep at lane start) ·
`wave_plans/W30/shell-sprint.md` §S2 · `thoroughanalysis.md` §R3-f06/§A3-f05/§A3-f07/§R3-f02/§R3-f03/§R11-f12.

Box: `src/lib/scaffold.ts` · `scripts/run-eval.mjs` · `src/lib/codegen.server.ts` (the R3-f02 prompt text ONLY).
Rule: CODE ONLY — no test runs / typecheck / builds / gates (owner's sprint rule). No keyed calls. Log-and-continue.

## The two test contracts kept (re-read at lane start)

- `scaffold.test.ts:338` — every emitted file mentioning `E-15` must contain the canonical `TODO(E-15) stub` (and never `TODO(E-15 stub`).
- `emitted-honesty.test.ts:42` — every emitted `throw new Error` line carrying `TODO(E-15)` must match `/RT_E_VALIDATION · /`;
  `sawEntryThrow` needs an `implement the (service|console) entry` throw to survive → the existing `emitUi` stub text is NOT reworded.
- Extra pins honored: `run-eval.test.mjs:381` pins `acceptance.checked` to exactly `{expectedFiles, expectedContent}` (new keys additive elsewhere);
  `codegen.server.test.ts:333` pins `module.exports.add = add` in the prompt's worked example (untouched); `verify.server.ts:417` executes
  module source through a CJS `new Function(exports, module, require, …)` harness → the R3-f02 reword states the ESM **contract**, never raw `export` syntax in module source.

## Status board

| Row | What | Status |
|---|---|---|
| R3-f06 · game | `vite.config.ts` pushed for game (plain config — game devDeps carry no react plugin) + package.json `main` → the real `src/main.ts` | DONE |
| R3-f06 · cli-tool | package.json `bin` + runnable `bin/<slug>.mjs` launcher (spawns the entry, argv passthrough) + `src/main.ts` entry (parses argv, `--help` real, refusal only when RUN) | DONE |
| R3-f06 · library | package.json `main`/`exports`/`files` + `src/main.ts` entry (importable, refusal only when RUN) | DONE |
| R3-f06 · service | PORT wiring (`resolvePort` in the entry, real+pure) + `start` script + `src/main.ts` entry | DONE |
| R3-f06 · stubs | structured entry stubs: importable, declared surface exported, `RT_E_VALIDATION · …` + `TODO(E-15) stub` + `TODO(R3-f06)` marker, throws only on execution (argv guard = standard ESM main check) | DONE |
| A3-f05/R11-f12 | per-kind `expectedBehavior` structure in `parseGrader`/`checkAcceptance` (shape-checked; static bin/start rows evaluated; runtime rows `pending` + TODO) + `verification: "files+content only"` label on the acceptance record | DONE |
| A3-f07 | `UiGenerationHook` type + `defaultUiGeneration` no-op (= current name-dump, byte-identical) + single call point in `emitUi` + `uiGeneration` record on `ScaffoldResult` | DONE |
| R3-f02 | P6 prompt rule 2 reworded (ESM named-export contract + mandatory param annotations); every other line byte-identical | DONE |
| R3-f03 | `redTree`/`partial` on the emit envelopes (`ScaffoldResult` + run-eval handover/notes) + `capability.N` skip-with-reason path in the capScan output (partial only — non-partial bytes unchanged) | DONE |

## Log

- (t) Lane start. Read `W33/unlanded-block.md`, `fixes/272_s2_universality.md`, W30 §S2, §R3-f02/f03/f06 + §A3-f05/f07 + §R11-f12 in
  `thoroughanalysis.md`, and the live code at every touch-point. Confirmed S2's block is unlanded (grep: 0 hits for `R3-f06`/`A3-f07`/`redTree` in `scaffold.ts`).
- (t) Constraints mapped (see above). Wrote this log EARLY. Starting edits: scaffold.ts → run-eval.mjs → codegen.server.ts reword.
