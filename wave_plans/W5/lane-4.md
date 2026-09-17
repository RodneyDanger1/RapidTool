# W5 · LANE 4 — T-107.2 provider registry + role tiers (Wave H)

**Mission.** One registry for every model call: providers + role tiers (main / reasoning /
weak) + the explicit-model rule. DeepSeek migrates behind it. Keyless behavior is unchanged
(honest skips). The `codegen.server.ts` seam hop is DEFERRED (L1 owns that file) — list it in
the log for W6.

**Done-when:** registry exists with unit tests; the three free seams (verify/chat/crew) call
through it; all existing seam tests green with their fetch stubs; keyless runs still skip
honestly; typecheck 0.

**Owned files:** NEW `src/lib/llm/providers/*.ts` (one file per provider), `src/lib/llm.ts`,
`src/lib/deepseek.server.ts` (migrated behind the registry — keep file path exports working),
seam switches in `src/lib/verify.server.ts`, `src/lib/chat.server.ts`, `src/lib/crew.server.ts`
(minimal hunks), their tests as needed; `fixes/216p_provider_registry.md` (NEW).
DEFERRED (list, don't touch): `codegen.server.ts` seam (L1), `doctor.ts` surfacing (next wave).
NOT yours: headless/cli/dod (L3), harvest/docs (L2), run-eval/corpus (L5).

**MINI-TASK PLAN:**
1. RECON: read dossier `research/multiagent/107_competitors_agentic.md` T-107.2 row + any
   101_provider_integration.md context; grep every model-call site (`completeDeepSeek`, `fetch`
   seams, `isDeepSeekConfigured`) across src/. Read the `rapidtool-development` skill reference
   path in RESUME if present for provider guidance.
2. Design (in 216p first): `Providers` registry API — e.g. `getProvider(id)`,
   `callModel(role, messages, opts) -> Promise<LlmResult>`, role tiers with
   `RapidToolModelRole = "main" | "reasoning" | "weak"`, explicit-model override rule
   (an env/config model id must be EXACTLY one the registry knows; unknown ⇒ coded refusal,
   never a silent default).
3. `src/lib/llm/providers/deepseek.ts`: port the existing DeepSeek logic (base URL, key from
   env, error mapping) — behavior byte-compatible. ⚠ Model IDs: the API accepts
   `deepseek-flash`; **version-tagged ids are rejected by api.deepseek.com**; keep whatever
   ids the current code uses unless pinned otherwise.
4. Migrate `llm.ts` + `deepseek.server.ts` to thin wrappers over the registry (keep exports +
   signatures stable so ~N importers don't change).
5. Switch the three free seams (verify/chat/crew) to `callModel(role, …)` — minimal hunks;
   keyless paths must still produce the same honest skips.
6. Tests: registry unit tests (lookup, unknown-id refusal, role resolution); one migration
   test per switched seam proving the same call shape reaches the same fetch stub.
7. `fixes/216p` work log + the deferred-hops list (codegen seam; doctor surfacing).

**TRAPS:** many tests stub `globalThis.fetch` (verify.server.test.ts comment says so) — keep
that stubbing surface identical. `crew.server.ts` has parallel-delegation paths — don't change
concurrency. Never print/env-leak the key.

**Verification:**
```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
npm run typecheck
node --experimental-strip-types --test src/lib/verify.server.test.ts src/lib/chat.test.ts src/lib/crew.test.ts
npx eslint src/lib/llm.ts src/lib/deepseek.server.ts src/lib/llm/providers/
```
Baselines: verify.server 19, chat/crew = your first-run counts; grow, never drop.

**Logging:** `fixes/216p_provider_registry.md`. Budget death ⇒ plain statement of what landed.
