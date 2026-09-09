# 149 — A2 CODEBASE AUDIT: per-criterion verdicts + seam states (transcribed from the capped analyst)

Evidence basis: on-disk state at 17:48, pre-148-log (the fixes/148 F-wave was mid-flight; seams
below attributed accordingly). Suite green 1353/1353 at 147 landing.

## Per-criterion verdicts (file:line evidence)

| Req | Verdict | Evidence | One-line reason |
|---|---|---|---|
| Produce multi-file software from brief | PARTIAL | codegen.server.ts:1046-1050 | Tree fires only >8 typeSignatures; ≤8-sig multi-capability webapp → single-module; F1 kind/cap fix NOT landed; keyed run produced 0 generatedTree files (results.json: "no generatedTree (0 file(s)) and 7 expectedCapabilities uncovered", journey:failed, p6Refused:true) |
| Verify the generated thing runs | PARTIAL | compile-check.server.ts:603-624 | treeRun genuinely executes specs (spawns node --test under runNodeBounded :335-409) + entry smoke; UI-shell honest skip; BUT M2=1 in the 6/9 proof ran over the deterministic floor (p6Refused), not LLM code |
| Iterate until pass (budgeted repair) | PARTIAL | headless.ts:1270-1378 | treeFailure threading LANDED end-to-end (p6CycleLiveDeps :1068-1072 → defaultP6Synthesize :1172-1186 → LiveLayerDeps engine.ts:2615-2617 → deps?.treeFailure codegen :972 into all repair prompts); applyTreeRunTestedMint → mintTreeRunTested (codegen :1493-1532) mints tested only when specs actually executed; convergence = treeRun.ok ONLY — capability coverage ungated (divergence #1 open) |
| Gates/stop-loudly | TRUE | engine.ts:1183-86; dod.ts:586; headless.ts:625; cli:413-432 | Red seal can never be byte-identical clean; RT_E_GATES_FAILED exit-1 + census; HITL parks (phases.ts hitl:true at P4/P5/P8/P9; reframe forceHuman); wild human park engine.ts:3239 |
| Learning that compounds | PARTIAL | engine.ts:1369-90; codegen:1005-16; wild-mode.server.ts:28-29 | L2 content-rich landed (unmet·class·tail ≤300 digest); P6 expansion tier-2 wired; P0 reframe wired (engine.ts:591-630) but UNTESTED (no test warms the lesson-bearing prompt); wild classifier imports selectLessons/lessonLinesForBrief with ZERO consumers (dead imports); packet tier-1 = CLI-only (engine-side compile seeds nothing); lesson verbs code present in cli but unlogged/untested (in-flight F4) |
| Eval harness measures it | TRUE | maker-score.ts:491-505; run-eval.mjs:343-480 | Corpus (6 fixtures) + pure M1-M9 rubric + single-synthesis keyed flow + history/M7; results corroborated |
| M1-M9 (own bar) | M1 0 · M2 1(scaffold) · M3 0 · M4 0 · M5-9 1 | results.json | First real keyed run = loud refusal + green floor; no LLM-emitted tree has EVER been minted-tested end-to-end |

## Verify-run mechanics (the TRUE part)
- treeRun: compile per-file parse (:112-198); specs execute for real — specRunnerCode spawns
  `node --test <file>` (:335-361) under bounded runNodeBounded; TAP parsed (:399-409); entry smoke
  dynamic import (:366-381); UI-shell kinds honest skip ("UI shell — not executable headless",
  resolveEntry :526-528); headless entry = pkg.main → first job-* node → src/generated.ts (:522-566);
  30s default timeout (:286); bounded runner: 1MB stdout cap, scrubbed env, tmpdir cwd, no shell
  (node-runner.server.ts:135-182). CLI emit --run exit-1 on red (rapidtool-cli.mjs:712-737).
- NO npm install; repo node + strip-types only.

## Iterate mechanics
- driveP6Journey (headless.ts:1270-1378): budget default 3 (:1112); keyless no-op same-ref
  (:1280-1291); convergence = verdict.ok (:1339) → applyTreeRunTestedMint (:1346) → recordGateInto
  real probes, never force-green (:1350); no-tree cycle = context not convergence (:1313-1324);
  exhaustion → honest failed + p6.journey.exhausted, floor stands (:1368-1377). Fake-deps driver
  tests landed (headless.test.ts:369-447: converge/FAILED/keyless).

## Open items flagged for adjudication
1. Keyless runs on the same floor scored M2=0 while the keyed run scored M2=1 — asymmetry not
   investigated (likely full-drain terminal-state difference) — flag.
2. E2 UI-shell-no-mint regression presence not fully closed by the analyst — verify.
3. The E4 lesson verb family + packet tier-1 CLI consumer exist on disk but lack the 148 log +
   CLI test coverage (in-flight F4).
