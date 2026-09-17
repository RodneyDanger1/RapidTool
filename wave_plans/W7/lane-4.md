# W7 · LANE 4 — T-107.10 sub-agent contract + mock-LLM E2E

**Mission.** Give the factory a real sub-agent contract (bounded delegation with coded refusals +
ledger attribution) and a MOCK-LLM provider so the full pipeline can run end-to-end in tests
with zero network — the dossier names both.

**Done-when:** the contract module exists with unit tests (caps, refusal codes, attribution);
a mock LLM provider exists and is EXPLICITLY selectable (never a default — keyless honesty
stays); one E2E test runs brief → (mock) synthesis → emitted tree files with assertions;
typecheck 0; suites green (grow); `fixes/216t_subagent_contract.md` written.

**Owned:** NEW `src/lib/subagent.ts` (or the dossier's name) + test, NEW mock provider under
`src/lib/llm/providers/` + test, `src/lib/crew.server.ts` + test (seam hunks only),
`fixes/216t_subagent_contract.md` (NEW).
NOT yours: codegen/headless (L1), engine (L2), cli/scripts (L3), verification (L5).

**MINI-TASK PLAN:**
1. Read dossier `research/multiagent/107_competitors_agentic.md` T-107.10 row (the exact contract
   spec) + `src/lib/crew.server.ts` (the existing parallel-delegation shape) + the registry
   (`src/lib/llm/providers/registry.ts` — how providers register; read `getProvider`).
2. Contract: max concurrency, per-agent budget, structured result {ok, code, note}, ledger
   attribution; refusals coded, never silent.
3. Mock provider: id e.g. `mock`; returns canned envelopes from a queue; works only when
   EXPLICITLY selected (env/param); never satisfies `isDeepSeekConfigured`; add to
   KNOWN_MODEL_IDS handling as its own provider (not a deepseek model id).
4. E2E: with the mock provider injected, run the P6 path (liveP6Synthesis or the headless flow —
   pick what the dossier targets) and assert emitted tree files exist with expected paths.
5. `fixes/216t` skeleton first; real output.
**TRAPS:** do NOT touch `deepseek.ts` request shapes; do not weaken keyless behavior; one of the
W6 lessons — never let a mock satisfy a "configured" probe.
**Verify:** `npm run typecheck`; your suites + `src/lib/crew.test.ts`;
`npx eslint src/lib/subagent.ts src/lib/llm/providers/`.
