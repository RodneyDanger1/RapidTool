# Wave-3 integration — parent

## Landed & verified
- planning.ts (planSteps/reflect/backtrack/createPlanning DI, 15 tests) + crew plan-act mode
- algo-tools.ts (spec→algorithm, complexity heuristic, property tests, benchmark harness; 16 tests) + arch-tools.ts (dep graph, ADR, codebase map; 13 tests)
- vector.ts — LLM-as-designer logos/icon sets with fail-closed SVG sanitizer (script/on*/foreignObject/data:/url() all stripped), deterministic badges; live-verified with the real key: generateLogo → source:"llm", sanitized SVG
- tracing.ts (23 tests) + vault traceNote (5 tests)
- Chat tab (9th tab) + CLI RT_E_* codes via classifyError at the respond choke point + README error-code table
- errors.ts/chat.server.ts/chat.ts (Pro) + server-layer hardening (research/websearch/tavily/exec/node-runner/phases codes)

## Parent fixes (wave-3 leftovers)
- vector.ts:358 map-narrowing (R1), vector.test.ts:625 source-narrowing (R2) — the verifier's specs
- lint: vector.ts no-regex-spaces/no-useless-escape ×2, arch-tools.test.ts {2} regex fix

## Known remaining item (honest)
- Chat tab interaction polish: forceMount/tab-activation detail unfinished by W1 — the pane
  renders (configured status + input) but the browser a11y tree doesn't switch to it;
  chat core (chatOnceServer/buildChatContext) is unit-tested and shares the live-proven
  DeepSeek path. One small console.tsx fix remains (tab-panel activation).

## Final gate (after all edits)
typecheck 0 · lint 0 · **702/702 tests** · build 0 · live: vector logo + planSteps + badge.
