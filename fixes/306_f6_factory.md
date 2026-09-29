# fixes/306_f6_factory.md — F6 · THE FACTORY-VIEW ENGINEER (what it built · how well · what it learned)

> Wave 306 · F-lane. HEAD `79f35b1`. Box (sole writer): `scripts/run-eval.mjs` (read/report side) ·
> `src/lib/scorecard.ts` · `src/lib/diagnose.ts` + the docs sections ONLY for surfaces this lane ships.
> Sibling boxes NOT touched: `rapidtool-cli.mjs`/`headless.ts` (F1/F5) · `console.tsx` (F2) ·
> `packet.ts`/`handoff.ts`/`AGENT_GUIDE.md` (F3) · `rt-*` (F4) · `engine.ts`/`store.ts` (F5).
> Rules: PATCH-FIRST, additive-only · NO keyed calls · legs FOREGROUND · professional quality only.
> (Log opened pre-edit per the wave brief — 2026-09-29, F6.)

## 0 — Status board

| Item | Status |
|---|---|
| Early log | DONE (this file) |
| Study: run-eval outputs · diagnose causes engine · graders · eval-out history (t0 byte-truth) | DONE (§1) |
| R1 · run-eval: factory report (build + render + `report.md` per run + `--report` re-render) | TODO |
| R2 · scorecard: read the NEW fields (usage/cache/servedModels/behavior rows) + byKind/spend derived | TODO |
| R3 · diagnose: causes/fixes read the new fields (budget-stop class + budget-boundary/checkpoint actions) | TODO |
| R4 · cache-chase: fold tap cache fields (run-eval) + forward at the tap emit (k6 handoff #4) | TODO |
| R5 · docs: README/START-HERE sections for what SHIPS (read sibling logs first) | TODO |
| R6 · legs: run-eval.test · scorecard.test · diagnose.test · README-cli parity (foreground) | TODO |

## 1 — t0 byte-truth (verified before edits)

- **The real eval-out on disk is a LEGACY artifact**: `research/eval-out/results.json` (2026-09-25 keyed, 1 entry) carries NO `endClass`, NO `usage`, NO `acceptance.verification`; `history.json` (40 rows) rows carry NO `endClass`. So the report/reader must render absences honestly ("absent — legacy artifact predating the key"), never invent.
- `run-eval.mjs` row shape (fresh-run bytes): entry-level `servedModels`/`usage`/`estimatedCostUsd`/`costBasis` (W23-L1, :2503-2515), `acceptance` (incl. `behavior` rows + `verification`, :1069-1080), `endClass` (:2575), `notes` {treeRunOk, journey, stall, stopCode, p6Refused, synthesisSucceeded, llmCalls, emitDirClean} (:2536-2564), per-trial `usage` block (:2731-2735).
- `diagnose.ts` = the causes engine (buildDiagnosis: ranked matches + evidence row refs + actions + codes). New-field gaps found: `wild-paused-error`'s `codeClass` map lacks `RT_E_BUDGET_EXHAUSTED` (falls to "unknown"); no ranked rule for a budget stop; no action line citing the packet budget boundary (`{spent, cap, stopReason}`) or the checkpoint.
- **Cache chain gap (k6 handoff #4, fixes/290:50/#4)**: `LlmCallTapRecord` TYPE carries `cachedPromptTokens`/`cacheMissTokens` but the emit site (`deepseek.ts:708-717`) DROPS them, and `llmEvidenceFromCallRecords` (run-eval) folds 2 keys → cache spend is invisible end-to-end. Fix = 2 additive conditional spreads at the emit + a cache-aware fold in run-eval (consume `recordSpend`'s cache merge; `estimateCostUsd` already prices cache hits).
- CLI `eval` arm renders the scorecard VERBATIM (`respond({...scorecard, notes, trends})` — re-verified 304_d1 §T3: cli.mjs `grep endClass` → 0). So enriching `scorecard.ts` reaches the CLI render with **zero cli.mjs edits** — the coordination-safe path while F1 owns the CLI file.
- `README-cli.test.mjs` parity constraints (read FIRST, per brief): `**N subcommands**` == real `case "` arm count; verb-list ↔ arms both ways; every arm has a USAGE key. Not touched this lane (no cli.mjs edit) — run at the end to prove parity stays green.

## 2 — Plan (smallest honest shape)

1. **run-eval.mjs**: `buildFactoryReport(facts)` + `renderFactoryReport(report)` (markdown) + `readEvalOutDocs(outDir)` + `--report` mode; `main()` writes `<OUT_DIR>/report.md` after persist (atomic, via `writeJsonAtomic`-style text writer). Report = won/lost + per-kind coverage + acceptance labels + endClass + token/cache spend + mint/reachability state + ranked causes (diagnose-shaped, every claim carrying an evidence line).
2. **scorecard.ts** (pure): parse `servedModels`/`usage`(+cache)/`estimatedCostUsd`/`costBasis`/`acceptance.behavior`; derived `byKind` + `spend` (+ notes line). CLI render picks it up free.
3. **diagnose.ts**: `RT_E_BUDGET_EXHAUSTED` code-class + new `budget-stop` ranked rule (evidence rows + code-class) + action lines citing the budget boundary + checkpoint re-entry.
4. **deepseek.ts tap emit**: 2 conditional spreads (completes k6 #4 — the only file touched outside the box; unclaimed by every sibling lane; additive + byte-identical when the vendor omits the fields).
5. Docs + legs.

(Evals below are appended as they land.)
