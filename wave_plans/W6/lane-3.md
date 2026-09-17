# W6 · LANE 3 — registry tail (tests + 216p + doctor provider surfacing)

**Mission.** W5 landed the provider registry (`src/lib/llm/providers/*`: deepseek.ts port +
registry.ts with roles main/reasoning/weak, unknown-id refusal) and switched the three free
seams — but wrote ZERO tests and left `216p` a skeleton. Add the tests, surface the registry in
`doctor`, complete the log.

**Done-when:** registry unit tests + one migration test per switched seam exist and pass;
`doctor` reports the provider team (tiers + model ids + configured state) HONESTLY (keyless ⇒
not-configured, exactly as today); typecheck 0; eslint 0 on new files; `216p` complete with the
deferred-hops list (codegen seam → the TA-15 lane's file; do NOT edit codegen).

**Owned:** `src/lib/llm/providers/*` + NEW `src/lib/llm/providers/registry.test.ts` (or colocated
test per house style), `src/lib/doctor.ts` + test (surfacing), `src/lib/verify.server.test.ts`
(migration pins only), `src/lib/chat.test.ts` / `crew.test.ts` (migration pins only),
`fixes/216p_provider_registry.md`. NOT yours: codegen/scaffold/engine (L1), types/headless/cli/dod (L2),
run-eval (L4), everything else (L5).

**MINI-TASK PLAN:**
1. Read the W5-L4 summary (`subagent-summary-3-20260916_213829_505012.txt`) — it lists every
   landed symbol (DEEPSEEK_MODELS, KNOWN_MODEL_IDS, ROLE_TIERS, roleModelEnvKey, getProvider…)
   and what it verified. Read `src/lib/llm.ts` + `registry.ts` + `providers/deepseek.ts` as
   they now stand.
2. REGISTRY TESTS: lookup by id (known + unknown ⇒ undefined, never a fallback); role
   resolution (main/reasoning/weak + env override keys); explicit-model rule (unknown id ⇒
   coded refusal, never a silent default); the provider descriptor shape.
3. MIGRATION TESTS (one per switched seam in verify/chat/crew): the seam's call reaches the same
   fetch stub with the same shape as before the registry (existing tests likely already stub
   fetch — you are ADDING a pin that the registry path is the one used, not weakening anything).
4. DOCTOR: add the provider-team line/field — tiers + resolved model ids + configured boolean.
   ⚠ DO NOT change existing doctor output strings that tests pin; make it additive. Keyless
   stays honest (not configured). Record the new output in 216p.
5. `fixes/216p` body: work log, commands+results, the deferred hops (codegen seam; anything
   else), not-done.
**Verify:** `npm run typecheck`; `node --experimental-strip-types --test src/lib/doctor.test.ts src/lib/verify.server.test.ts src/lib/chat.test.ts src/lib/crew.test.ts`;
`npx eslint src/lib/llm/providers src/lib/doctor.ts`; baselines: doctor 15, verify.server 19,
chat/crew = their current counts — grow, never drop. Budget death ⇒ plain statement.
