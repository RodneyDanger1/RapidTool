# fixes/314_f1_iterate.md — F1 · THE BOUNDED ITERATE-UNTIL-SATISFACTION DRIVER (SE2 §4a)

**Lane:** F1 (314 wave; fleet deleg_0c2424e6 task-0). **HEAD at start:** 54c6649 (+ E-wave in-flight edits — read fresh). **Mode:** keyless only — NO keyed calls, no live firing. **Source mandate:** `fixes/311_se2_surfaces.md` §4a (the concrete iterate design) + `wave_plans/W43/COMPLETION-TASKS.md` T2.2/T2.3 ("score < threshold → bounded critique+regenerate" + "pins + a keyless dry of the driver's decision logic").
**Scope (the smallest REAL first component):** (1) `src/lib/iterate.ts` — NEW pure module: env/config gate (OFF unless `RAPIDTOOL_ITERATE_THRESHOLD` is set — the parked owner decision made explicit), pure `decideIterate` (fire/no-fire, bounded count, budget stop), bounded `iterateToSatisfaction` driver with injected score/regen/budget/emit seams, coded `run.iterate.*` events, repair/re-synth outcome mapper (p6 repair machinery + re-synth path reused via injection, no new provider surface). (2) Pins `src/lib/iterate.test.ts` — keyless, injected fakes: fire/no-fire, bounded N, budget stop, honest refusals, OFF default. (3) Eval-side record: `scripts/run-eval.mjs` stamps the per-trial iterate DECISION on every row (additive `iterate` block; `engaged:false` always — the live arm is owner-gated) + pins in `scripts/run-eval.test.mjs`. (4) Scorecard read-side: `src/lib/scorecard.ts` reads + censes the block (pins in `scorecard.test.ts`).
**Deliberately NOT landed:** the LIVE keyed firing. Wiring `regenerate()` to the live seam inside a keyed run is the owner-gated step (F1 PROVE's run) — this lane ships the driver + its fully-pinned decision logic and records the decision, never a fake iteration.

## File claims (F1 — disjoint from E1's engine.ts/policy.ts/CLI-seal regions; verified against `313_d1_seal.md` E1 section)
- `src/lib/iterate.ts` — **NEW, F1 only.**
- `src/lib/iterate.test.ts` — **NEW, F1 only.**
- `scripts/run-eval.mjs` — F1 additions only: import line, exported `iterateFactsFor`, runTrial row block, evaluateEntry console line.
- `scripts/run-eval.test.mjs` — F1 additive test block at the end.
- `src/lib/scorecard.ts` — F1 additions only: `EvalIterateFacts`, `readEntry` arm, `derived.iterate` census, notes line.
- `src/lib/scorecard.test.ts` — F1 additive describe block at the end.
- `fixes/314_f1_iterate.md` — this log.
- **Untouched (E1's lane):** `engine.ts`, `policy.ts`, `rapidtool-cli.mjs` seal regions, `headless.ts` wild opts, `wild-seal.test.ts`, `scripts/README-cli.md`, `cli-exit-taxonomy.test.mjs`.

## Status board
- [ ] S1 — module `src/lib/iterate.ts` (config / decide / driver / events / mapper)
- [ ] S2 — pins `src/lib/iterate.test.ts` (keyless, injected fakes)
- [ ] S3 — `run-eval.mjs` per-trial decision record + `iterateFactsFor` pin in `run-eval.test.mjs`
- [ ] S4 — scorecard read/census + pins
- [ ] S5 — legs foreground (iterate / scorecard / maker-score / run-eval) + typecheck + lint
- [ ] S6 — keyless scratch eval run: a real row carries the `iterate` block (default OFF + armed)
- [ ] S7 — E1 collision check + close-out (verdicts, gates)

## Design record (locked before implementation)
- **Where the driver lives:** SE2 §4a "eval/scorecard ↔ wild-step" — the satisfaction read is the eval/scorecard side (maker-score `MakerScoreCard.mean`, 0..1 — the same scale as run-eval's `grader.passWhen.meanAtLeast`), the regeneration composes the existing phase-edge machinery (`repairTreeDir` = the p6 repair path; `driveP6Journey` = the re-synth path) through ONE injected `regenerate()` seam. `mapRepairOutcome()` maps either seam's `{outcome, cycles, refusal}` envelope without importing them — `iterate.ts` stays pure/host-free (no fs, no network, no env reads of its own).
- **Config/env (honest default = OFF):** `RAPIDTOOL_ITERATE_THRESHOLD` (strict parse, (0,1]; junk/unset ⇒ driver OFF + a note — a junk spelling never arms spending) and `RAPIDTOOL_ITERATE_MAX_CYCLES` (strict int, clamped to 1..2 — the first component is bounded; out-of-range clamps with a note, never silently). Arming = setting the threshold; the parked owner decision is named in every skip note.
- **Decision order (pinned):** disabled → no-score → satisfied → budget-exhausted (`RT_E_BUDGET_EXHAUSTED`, the token-ledger seam) → bounded (cycle ≥ maxCycles) → no-seam → fire (`iterate.below-threshold`). Satisfaction outranks budget (never spend against a satisfied score); budget outranks the cycle count (the deeper stop is reported).
- **Events:** `run.iterate.armed` (once, enabled), `run.iterate.fire` (per cycle attempt), `run.iterate.cycle` (per completed cycle), `run.iterate.satisfied` / `run.iterate.skipped` (OFF) / `run.iterate.stopped` (coded terminal) — event NAME ∈ the fixed catalogue; the code rides the `code` field. NOT added to `RT_EVENT_NAMES` (that catalogue is for RtEvent telemetry rows; these are project-log/journal rows like `p6.journey.exhausted` — precedent: no `p6.*`/`run.*` journal name lives there).
- **Codes:** the driver's own vocabulary is `iterate.*` (`ITERATE_DECISION_CODES`); seam failures/refusals propagate their own RT_E code verbatim (e.g. `RT_E_REPAIR_FAILED`, `RT_E_LLM_NOT_CONFIGURED`, `RT_E_BUDGET_EXHAUSTED`). No new RT_E registry codes — `errors.ts` untouched.
- **No-throw doctrine:** the driver (and every safe read inside it) never throws into its caller; a throwing `emit`/`score`/`budgetExhausted` degrades to a coded outcome, never a crash. `emit` failures never abort the loop (telemetry doctrine, `rt-events.ts`).
- **The live arm:** F1 explicitly does not fire keyed regeneration (no keyed calls this lane). `run-eval.mjs` records the decision per trial (`wouldFire` = the decision IF the seam were attached; `seamAttached:false`, `engaged:false` — explicit). Owner step to arm: set `RAPIDTOOL_ITERATE_THRESHOLD` and attach `regenerate()` = the repair/re-synth seam in the keyed run.
- **Collision check vs E1:** E1 owns `engine.ts`/`policy.ts`/`rapidtool-cli.mjs` seal regions/`headless.ts` wild opts/`wild-seal.test.ts`; F1 touches none of them (file list above). My only shared-file adjacency: `run-eval.mjs`/`scorecard.ts` are untouched by all E/F lanes (git status at start: clean apart from the E-wave set) — re-verified at close.

---

## S1 — `src/lib/iterate.ts` (evidence)
*(appended below as it lands)*

## S2 — pins `src/lib/iterate.test.ts`
*(appended)*

## S3 — run-eval record + pin
*(appended)*

## S4 — scorecard read/census + pins
*(appended)*

## S5 — legs + gates
*(appended)*

## S6 — keyless scratch eval run
*(appended)*

## S7 — collision check + close-out
*(appended)*
