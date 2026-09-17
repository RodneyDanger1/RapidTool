# 195 G1 — audit+fix already-landed honesty (185-194)

Owned files only:
- `src/lib/diagnose.ts` + `diagnose.test.ts`
- `src/lib/harvest.ts` + `harvest.test.ts`
- `src/lib/knowledge.ts` + `knowledge.test.ts`
- `src/lib/swarm.ts` + `swarm.test.ts`
- `src/lib/errors.ts` + `errors.test.ts`
- `src/lib/token-ledger.ts` + `token-ledger.test.ts`

TRUTH: RapidTool is NOT a factory. 4/5 Property Ledger jobs are TODO(E-15) stubs.

## Status

- Done. Owned suite **140/140 pass**, 0 fail.

## Dual-channel `ok:true` + `error` (185-H1)

Owned public envelopes:

| Site | Verdict |
|---|---|
| `diagnose.ts:358` `ok: true` | Honest: means diagnosis JSON built, not project healthy. No `error` field. `unclassified-errors` floor already landed (185). |
| `harvest.ts` `HarvestPacketResult` | Discriminated. `ok:false` + `RT_E_VALIDATION` on empty brief. `ok:true` has rows/notes, no `error`. |
| `swarm.ts` `ok: true` + `advisory: true` + `llmDispatched: false` | Honest (185-U5 / 191). `ok` = pure plan returned. No `error`. |
| `knowledge.ts` `SaveResult` | No `ok` field. Refuse is `appended:false, refused:true, code:RT_E_VALIDATION`. |
| `errors.ts` `codeError` | Always `{ ok: false, error, code }`. |

**Fix landed:** `HarvestOptions.llm` was `{ ok: boolean; text?: string; error?: string }` — dual-channel-capable. Now `HarvestLlmResult` discriminated union. `buildHarvestQueries` fail-closes `{ ok: true, error }` onto the keyword floor (`harvestLlmFailDetail`). `defaultQueryLlm` never stamps both.

## shouldPromoteLesson / savePattern gate (185-U1)

Confirmed still gated: `savePattern` → `isLessonTagged` → `saveLessonIfImproved` → `shouldPromoteLesson(prior?.score, incoming.score)`.

191 tests already covered: non-lesson, first scored, worse same-title, missing score, better score.

**Added:** equal-score promote (same title, different body) + NaN refuse. Predicate pins for NaN prior/next. Did not invent maker scores.

## token-ledger wiring (194)

No numeric token cap in any owned file (harvest fetch/time budgets are not token caps). Did **not** import `recordSpend` into harvest (would look wired while remaining a no-op).

Parent must wire `recordSpend` + `assertWithinBudget` at:

- `src/lib/codegen.server.ts:938` (`synthWithBackoff` `complete()`)
- `src/lib/codegen.server.ts:1024` (`attemptObservedComplete`)
- `src/lib/codegen.server.ts:1210` (`liveP6Synthesis`) — P6 entry
- Other usage-drop sites: `algo-tools.ts:119,237`, `chat.server.ts:483`, `headless.ts:224`, `prompt-engine.ts:231`, `vector.ts:855`, `verify.server.ts:635,645,672,799`, `llm.ts:43`
- Owned drop: `harvest.ts:229` `completeDeepSeek` — no cap in this file

Do not add `Project.tokenCap` (types.ts is parent).

## errors.ts registry (RT_E_BUSY / RT_E_FOREIGN_FILES / orphans)

- `RT_E_BUSY` and `RT_E_FOREIGN_FILES` remain in `ERROR_CODES` + `ERROR_CODE_DOC` (explicit test added).
- Registry ↔ docs already 1:1 (existing test). Additive-only; nothing removed.
- Producer census (outside errors.ts):
  - **LIVE:** BUSY / FOREIGN_FILES in `headless.ts` (parent).
  - **Classify-only:** `RT_E_REPORT_PHASE_MISMATCH` (ReportRejectedError + "phase").
  - **Unproduced:** `RT_E_ABORTED` — registered, no throw/stamp site. Left in place (additive).
- `classifyError` honors `SessionBudgetExceeded.code` (`RT_E_BUDGET_EXHAUSTED`) — test added.

## Owned-test bug hunt

No test pins of dishonest floors found. harvest.test headless-bridge block is pre-existing (imports parent `headless.ts`); not expanded.

## Test run

```
node --experimental-strip-types --test src/lib/diagnose.test.ts src/lib/harvest.test.ts src/lib/knowledge.test.ts src/lib/swarm.test.ts src/lib/errors.test.ts src/lib/token-ledger.test.ts
# tests 140  pass 140  fail 0
```

No full `npm test`. No `node:fs` added to client graphs. No scratch files at repo root.
