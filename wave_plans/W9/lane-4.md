# W9 · LANE 4 — T-107.6: token ledger to the free seams

**Mission.** 107:331 — extend the token ledger (cost accounting) to the LLM seams. The codegen
seam is DEFERRED (W9-L2 owns that file this wave); do the four free ones.

**Done-when:** `src/lib/token-ledger.ts` gains the cache-aware cost fields + helpers the dossier
names (read 107 §T-107.6 first); the seams `verify.server.ts`, `crew.server.ts`, `chat.server.ts`,
`node-runner.server.ts` record usage honestly (additive: existing envelopes byte-compatible);
output caps on tool/runner results per the dossier; keyless paths unchanged; typecheck 0; those
suites green (grow); `fixes/216w_token_ledger_seams.md` NEW with real output.

**Owned:** `src/lib/token-ledger.ts` (+ test), `verify.server.ts` + test, `crew.server.ts` +
test, `chat.server.ts`/`chat.test.ts`, `node-runner.server.ts` + test, NEW `fixes/216w_…`.
NOT: codegen.server.ts (L2), engine (L1), scripts (L3).
**Baselines:** verify.server 20, chat 70, crew 46, node-runner (current count) — grow.
**TRAPS:** token-ledger.ts exports SessionBudgetExceeded / NoMoneyException / TokenSpend /
TokenLedger / emptyLedger / totalTokens / tokenCapFromEnv / isUnmetered — keep them stable;
`tokenCapFromEnv` is imported by doctor.ts (client-safe, type-only at :26-28 — don't break it).
**Verify:** `npm run typecheck`; `node --experimental-strip-types --test src/lib/verify.server.test.ts src/lib/chat.test.ts src/lib/crew.test.ts src/lib/node-runner.server.test.ts`.
