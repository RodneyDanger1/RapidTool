# fixes/216q — T-107.5 run-side acceptance fixtures + trials/pass@k (Wave H, L5)

**Status:** IN PROGRESS (skeleton-first — body filled as work lands)

**Lane:** W5-L5 · `wave_plans/W5/lane-5.md` · task `T-107.5` (`research/multiagent/107_competitors_agentic.md:330`,
steal §5/:95 "freeze the grader outside the agent, then score across trials").
**Owned files:** `scripts/run-eval.mjs`, `research/eval-corpus/**`, `src/lib/brief-fixtures.ts`
(path constants only), `scripts/run-eval.test.mjs` (NEW), this log (NEW).

## 1. Mission (from the lane plan)

Make acceptance testing agent-proof: the per-case acceptance bar moves OUT of the
agent-writable corpus fixture into RUN-SIDE grader files read only by `scripts/run-eval.mjs`,
and the harness scores across configurable trials with honest pass@k / flakiness accounting.
`redTreeBanner` + the CLI contract stay intact (additive only).

## 2. Recon (facts with refs)

- FIXME

## 3. What landed (files + line refs)

- FIXME

## 4. Real command output

- FIXME (typecheck · scripts leg · keyless `npm run eval`)

## 5. Not done / residual limits

- FIXME
