# 191 — Composer: shouldPromoteLesson on write + swarm advisory pin

## Scope
- **185-U1**: Wire `shouldPromoteLesson` into `KnowledgeStore` lesson writes; refuse regression (`eval-gated-regression` / `RT_E_VALIDATION`).
- **185-U5 / D1**: Pin swarm as advisory-only (never dispatches real LLM seats; exported result always `advisory: true`; `ok:true` does not mean phases ran).

## Owned files
- `src/lib/knowledge.ts` (+ `src/lib/knowledge.test.ts`)
- `src/lib/swarm.ts` (+ `src/lib/swarm.test.ts`)
- `fixes/191_composer_promote.md`

## Do not touch
Parent-owned: store/engine/io/headless/codegen/deepseek/brief-fixtures/scaffold/maker-score/compile-check/dod/types/console/cli; wild-mode / node-runner / chat / diagnose / harvest / sandbox.

## Landing log

### 185-U1 — eval-gated lesson promotion on the WRITE path
- Added optional `score?: number` on `KnowledgeEntry` (maker card; **not** in fingerprint).
- Extended `SaveResult` with optional `refused` / `reason` / `code` (`ErrorCode`).
- `savePattern`:
  - **Non-lesson** tags → pre-gate path (byte-identical).
  - **Lesson** (`tags` include `LESSON_TAG`): `saveLessonIfImproved` looks up prior same-id or same-title lesson in the same project; gates with `shouldPromoteLesson(prior?.score, incoming.score)`.
  - Gate false (regression or missing next score) → **no append**, return `{ appended:false, refused:true, reason:"eval-gated-regression", code:"RT_E_VALIDATION" }`; prior rows untouched (append-only).
  - First lesson with a numeric score promotes; equal/better same-title score appends a new row.
- Exported `isLessonTagged(tags)`.
- Supersede-path test now supplies `score: 0.6` (lesson-tagged writes require a maker card).
- Test: `185-U1: savePattern gates lesson writes — regression refuses; first scored lesson promotes; non-lesson unchanged`.

### 185-U5 — swarm advisory pin (no fake dispatch)
- `SwarmPlanResult` / `ParallelDagResult` / `BranchSuggestResult`: document that `ok: true` means the pure function returned — **not** LLM seats / phase advancement / DoD pass.
- All three results now include `llmDispatched: false` (always).
- `swarmPlan` / `parallelDag` / `branchSuggest` return envelopes stamp `advisory: true` + `llmDispatched: false`.
- No LLM dispatch added (still deterministic state analysis only).
- Tests: `185-U5 / fixes/191 — swarm is advisory-only (never dispatches LLM seats)`.

### Tests (owned only)
```
node --experimental-strip-types --test src/lib/knowledge.test.ts src/lib/swarm.test.ts
```
**58/58 pass** (0 fail).
