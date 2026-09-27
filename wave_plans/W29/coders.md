# W29 · THE CODER WAVE — Stage-1 (P0 proven repairs) + six disjoint lanes. Briefed FROM §W27-WORKLIST.

**All readers share this file.** Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; `grep`).
```text
READ FIRST, IN ORDER: (1) `research/multiagent/thoroughanalysis.md` §W27-WORKLIST — YOUR rows are there
(sections §W27-A..D): each row = ID · priority · what · file:line · fix shape · done-when · sources. (2) §W27-F
the dedupe map (find your row's sources). (3) For anything deep: the §-spec it cites (§R1/§R3/§R6/§R9/§R11/§R12
etc. — same file; those are coder-grade specs, several with PROVEN repairs). (4) AGENTS.md for the repo contract.
THE MISSION: RapidTool becomes a truly autonomous software factory / best-in-class AI agent harness — GOOD code,
professional quality, no fake wiring, no dishonest claims. FIX, DON'T REDUCE: additive/re-worded/re-ranked only;
never delete a control, tab, pane, or field. DECLARE-OR-STRIKE: every claim you touch must match the bytes.
RULES: write each fix's PIN (RED-first where the spec says) — but RUN ONLY targeted single-file/leg checks;
NO full-gate runs (the boundary comes after ALL lanes land). NO keyed calls (O-1 unfunded). Log-and-continue:
any blocker → `[EXT-FAIL]` line in your log + keep going. Lane log: `fixes/271_lane<N>_<name>.md`, written EARLY
(skeleton in the first ~8 calls), kept current as you land. Shared-file edge: if a file you need is in another
lane's box, DO NOT touch it — record the needed change in your log under "for <lane>" and move on.
```
## LANE E1 (Stage-1 · THE P0s — the three proven repairs; owns engine.ts/headless.ts/store.ts/wild-step.test.ts)
**Rows: W-01 · W-02 · W-03 (+ W-29 sub-items if in your box).**
- **W-01** — wildStep must reach keyed P6 synthesis: R1's exact spec (additive `WildStepOptions.p6Edge` + `wildP6Edge` helper via the `"./head"+"less.ts"` seam → headless `runP6Edge`; `phase===6 && keyedDeepSeekConfigured()` guard; edge-naming log; keyless byte-parity). Files: engine.ts (~:3986 wildStep), store.ts:1105, headless.ts wild macros. §R1-f01 has the full spec + pins.
- **W-02** — the tested mint must be reachable from `run`/`gate`/console (today only eval/repair call `driveP6Journey`/`repairTreeDir`; CLI `runUntilGate→runReady→runPhase(live)→liveLayer→upgradeP6Keyed→liveP6Synthesis` NEVER mints → `p6-verified` fails → RT_E_GATE_PENDING). §R8-f01/f02 + §R10's cross-confirmation.
- **W-03** — emit-time materialization at `headless.ts:1584` emitProject per R3's **PROVEN REPAIR** (§R3-f01: `materializeImportableTree` on differing bytes, `exports:[]`, conditional, the record at :2521 too, the chunk-0 relocation consequence, the RED-first 0-`module.exports` + import-smoke pins). Do NOT statically import codegen.server.ts into scaffold.ts.
- ALSO: R12-f04's watchdog budget must be raised WITH W-01 (a legal 240s keyed step would auto-pause at 90s the moment W-01 goes live — fix in the same commit).
- Done-whens: §R1's pins green; a keyless wild run unchanged (byte-parity); `run --live` on the corpus reaches p6-verified; emit of the stored fixture → 0 module.exports + import smoke green + emit-twice stable.

## LANE S (state/tests — owns store.ts* (coordinate: E1 wins store.ts:1105), packet.ts, dod.ts, io.ts, llm.test.ts, chat.test.ts)
**Rows:** the R2/R9 class. **R9-f01 first** (the 2 RED pins → `RT_E_LLM_NO_BALANCE` + the xAI twin; done-when 96/96 on that leg), then R9-f02 (`:1313` pin → null + the runGate pin), R9-f04 (mint-predicate pins), C1-f01/R2-f01 (**the wipe-class guard — P1**: one `isoFromMs` helper + finite row guard + the `-1e300` case), R2-f02 (the 6 missing wild-run guards via one `keepLiveWildRun()` helper), R2's remaining rows, R9-f05's fixtures-pair test, R9-f06 heuristics if cheap. Full specs: §R2 (lines ~371-429) + §R9.

## LANE P (provider/telemetry — owns llm/**, providers/**, node-runner.server.ts, watch/rt-* telemetry)
**Rows:** R4-f01 (**xAI 402 → NO_BALANCE mirror** — exact spec + done-when in §R4), R4-f02 (the async-tap twin test), R4-f03/A2-f07/R12-f02 (**the per-run token ledger** — one design, thread it), C1-f08/f09 (facade `thinking` + model-id validation), R11-f09 (redaction: registry `apiKeyEnv` iteration + loosen `sk-`), R12-f06 (true tail read). Do not touch run-eval.mjs (H box).

## LANE H (harness — owns scripts/**, package.json, migrations/**)
**Rows:** A2-f02 (**gate.sh exit-condition fix + `scripts/gate-verdict.test.mjs` 4-case fixture** — the live repro is in §R5), A2-f01 (fixtures --approve → `evaluatePolicy`), R11-f04/C2-f02 (human-seat two-channel + the leak test), A2-f03 (14 verbs → exit 4), A2-f04 (the "no writes" claim), A2-f05/f06 (balance vocabulary + `measurement:false`), C2-f03/R5-f13 (35→37 + widen the doc test), R12-f10 (marker crash-clobber), A2-f08/f09/f10/f11, R11-f13. §R5 has every patch shape + verify command.

## LANE U (UI — owns console.tsx, routes/**, styles.css, components/**)
**Rows:** R6-f01 (busy latch + try/catch), **R6-f02 (the 4 autonomy surfaces → the per-surface honest labels; og/site.json included; extend the :262 rule)**, R6-f03 (the 3-path fixtures label), R6-f04 (sandbox wording ×3), R6-f11 (wildPaused one-liner), **R6-f12 (the pane error boundary + ui.pane_crash emitter)**, R6-f13/f14/f15, R6-f07 (Home help entry + hint), R14's UI-side items, A4's remaining actionable. Additive/re-worded only.

## LANE D (docs/corpus — owns README.md, AGENT_GUIDE.md, scripts/README-cli.md, research/eval-corpus/**, the Guide text in console.tsx* (coordinate: U wins console.tsx))
**Rows:** R6-f05 (**the census → {0,4,1} + the reconciled AGENT_GUIDE/Guide text**), A3-f05/R11-f12 (**the graders — per-kind real assertions + the packet `verification` label**), A3-f06/R3-f06 (**the missing-kind fixtures: game/CLI/library/service briefs + expected shapes**), A3-f08, R6-f06/f09, R9-f07 (README counts), A2-f08/f09's doc halves.

## LANE B (builds/hygiene — owns compile-check.server.ts, scaffold.ts* (coordinate: E1 wins it), browser-guard.mjs, write-set.ts, run-eval.mjs)
**Rows:** R11-f02 (`--ignore-scripts` + argv scripts), R11-f03 (the tree-run honest label), R11-f06 (S-04 win32 fail-closed), R11-f07 (realpath containment — one shared helper), R12-f03 (treeRun cpSync filter), R12-f01 (prior-render cap), R12-f05 (coalescer-stable message), R12-f07 (diagnose real counts), R12-f08 (rebase caps), R12-f09 (persist debounce), R12-f11. §R11/§R12 have the specs.

---
**BOUNDARY (after ALL lanes): the parent runs typecheck+lint+the suites, fixes the boundary reds, commits.**
**OWNER items (O-1..O-6) are NOT yours — coded around, never faked.**
