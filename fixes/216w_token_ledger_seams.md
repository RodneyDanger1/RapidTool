# 216w — Token ledger to the free seams (W9 · LANE 4 · T-107.6) — SKELETON

**Status:** IN PROGRESS (skeleton-first; work log + real output appended as steps land).

**Mission.** Dossier 107 **T-107.6** (`research/multiagent/107_competitors_agentic.md:331`, §6
"Budgets that bind" `:266-279`): extend the token ledger (`src/lib/token-ledger.ts`) with the
cache-aware cost fields + helpers the dossier names (Codex `TokenUsage` 5-field shape `:132`;
cache read/write prices `:270`; usage attribution `:268`), then record real usage at the four
FREE LLM seams — `verify.server.ts`, `chat.server.ts`, `crew.server.ts`,
`node-runner.server.ts` — and cap oversized tool/runner output per §6d + §9
(`TOOL_OUTPUT_MAX_CHARS` / Cline `output-limits.ts`) so re-sent text cannot cost quadratically.
The codegen seam (`codegen.server.ts:961-982` precedent) is **DEFERRED — W9-L2 owns that file
this wave**; its existing `accountSynthUsage`/`p6TokenCapFromEnv` behavior is the pattern the
free seams mirror.

**Owned files:**
- `src/lib/token-ledger.ts` (+ `token-ledger.test.ts`) — cache-aware fields + budget/cost helpers
- `src/lib/verify.server.ts` (+ `verify.server.test.ts`) — budgeted `weak` dispatches
- `src/lib/chat.server.ts` (+ `chat.test.ts`) — budgeted `main` dispatch
- `src/lib/crew.server.ts` (+ `crew.test.ts`) — budgeted turn dispatches (both modes)
- `src/lib/node-runner.server.ts` (+ `node-runner.server.test.ts`) — runner output cap
- `fixes/216w_token_ledger_seams.md` (THIS file)

**NOT touched:** `codegen.server.ts` (W9-L2), `engine.ts` (W9-L1), `scripts/*` (W9-L3),
`planning.ts` / `llm/providers/*` / `types.ts` / `doctor.ts` (not owned this wave).

## 1. Work log (append-only)

- [ ] 1. RECON: lane-4 brief + dossier 107 §6 / §9 / §11 limits; codegen `accountSynthUsage`
      (:1924-1942) + `p6TokenCapFromEnv` (:1917) as the pattern; subagent.ts pre-dispatch
      refusal precedent (:135 test); compaction `clampToolOutput` (:220) for the cap layout.
- [ ] 2. Baselines: verify 20 / chat 70 / crew 46 / node-runner 4 (all green) — recorded.
- [ ] 3. token-ledger.ts: cache-aware `TokenSpend`/`TokenLedger` fields + `TokenBudget`,
      `createTokenBudget`/`budgetCap`/`isBudgetExhausted`/`assertBudgetHeadroom`/
      `recordBudgetSpend`, `billableInputTokens`/`estimateCostUsd` + tests.
- [ ] 4. node-runner.server.ts: `RUNNER_OUTPUT_MAX_CHARS` + `clampRunnerOutput` (counted,
      marked, head+tail) wired into the ok envelope + tests.
- [ ] 5. verify.server.ts: budgeted dispatch seam (`generateCases` 6th param,
      `verifyAndFixServer` opts.budget) + tests.
- [ ] 6. chat.server.ts: budgeted dispatch seam (5th param) + tests.
- [ ] 7. crew.server.ts: `CrewRunOptions.budget` on both orchestrators + tests.
- [ ] 8. Verification: typecheck 0; the five named suites (grow); byte-compat spot checks.

## 2. Old→new string/behavior ledger

(fill as deliberate changes land)

## 3. Real command output

(fill with the actual runs — verbatim)

## 4. Cross-file needs (NOT this lane's files)

- `codegen.server.ts` (W9-L2): the P6 seam already records via `accountSynthUsage`; the
  cache-aware helpers landed here (`estimateCostUsd`, cache fields) are available to it
  when L2 touches the file.
- Callers that could THREAD a session budget tomorrow: `headless.ts` / `engine.ts` /
  `codegen.server.ts` `defaultDeps.verify` — deliberately NOT wired this wave (files not owned).

## 5. Not done / deferred

(fill)
