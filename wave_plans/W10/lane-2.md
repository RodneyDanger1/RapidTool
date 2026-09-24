# W10 · LANE 2 — T-107.6 token-ledger FUNCTIONAL (finish W9-L4's plan)

**Read FIRST:** `src/lib/token-ledger.ts` header doc-comment (~:22, added W9-L4 — it IS the plan:
cache fields on TokenSpend/TokenLedger accumulating only when reported; TokenBudget seam;
assertBudgetHeadroom; recordBudgetSpend = record-then-signal, spend NEVER clamped; estimateCostUsd
with caller-supplied prices) + `fixes/216w_token_ledger_seams.md` (skeleton + 8-step plan + the
dossier citations) + dossier 107 §T-107.6 (':266-279', row ':331', Codex TokenUsage ':132', cache
prices ':270', Cline output-limits ':274-276').

**Contracts to preserve:** legacy 3-key spend shape + every existing recordSpend call site
byte-identical; `tokenCapFromEnv` shape (doctor.ts imports it type-only at :26-28);
`SessionBudgetExceeded`/`NoMoneyException`/`TokenSpend`/`TokenLedger`/`emptyLedger`/`totalTokens`
exports stable; subagent.ts ':150' "spend kept" rule; the codegen accountSynthUsage pattern
(:1924-1942) is the model for record-then-signal.

**Done-when:** cache-aware fields + helpers land additively; the four seams
(`verify.server.ts`, `crew.server.ts`, `chat.server.ts`, `node-runner.server.ts`) record usage
honestly (+ output caps on tool/runner results per the dossier); their tests green (grow from
20/46/70/current); `fixes/216w` §1-5 filled with REAL output (its own 8-step log checked off);
codegen seam stays DEFERRED (note in 216w §5 — codegen.server.ts is nobody's file this wave).

**Owned:** token-ledger.ts + test; verify.server/crew.server/chat.server/node-runner.server +
tests; fixes/216w. **NOT:** engine/knowledge (L1), compile-check/scripts (L3).
**Verify:** `npm run typecheck`; the four named suites. Budget death ⇒ PLAIN state.
