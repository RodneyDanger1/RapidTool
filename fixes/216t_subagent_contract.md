# fixes/216t — T-107.10 sub-agent contract + mock-LLM provider + E2E (W7 · L4)

**Status:** SKELETON FIRST (lane rule 8) — body filled from real command output before the lane stops.

**Lane:** W7-L4 · `wave_plans/W7/lane-4.md` · task `T-107.10`
(`research/multiagent/107_competitors_agentic.md:335`: "Sub-agent contract + claim lifecycle for `crew`;
deterministic mock-LLM E2E in CI"; steal §:311 "Sub-agent contracts, not just spawn calls" +
§:316 "Deterministic LLM-free E2E").
**Owned files:** NEW `src/lib/subagent.ts` + `src/lib/subagent.test.ts`, NEW
`src/lib/llm/providers/mock.ts` + `src/lib/llm/providers/mock.test.ts`, `src/lib/crew.server.ts` +
`src/lib/crew.test.ts` (seam hunks only), `src/lib/llm/providers/registry.ts` (additive explicit-provider
seam — required by the mock's "its own provider, not a deepseek model id" rule; recorded here because the
lane's Owned list does not name it), this log (NEW).

## 1. Mission (from the lane plan)

TBD — filled with the body.

## 2. Recon (facts with refs)

TBD.

## 3. What landed (files + line refs)

TBD.

## 4. Commands + real results

TBD.

## 5. Old → new

TBD.

## 6. Not done / deferred

**W7 boundary status (parent, 2026-09-17):** ALL four modules verified — typecheck 0 (after the
parent fixed `../` → `./` import slips in mock.ts/mock.test.ts), subagent 22/22, mock 12/12,
registry 21/21, eslint clean. Parent repairs also: `LlmResult.model` on okEnvelope, `error ?? ""`
guards, NormalizedTask `role: null` → absent mapping at the completer seam. Sections 1-6
(work log + real-output evidence) STILL OWED → W8-L4.
