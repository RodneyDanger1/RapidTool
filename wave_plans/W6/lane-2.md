# W6 · LANE 2 — policy tail (bypass pins + ledger provenance + 216o)

**Mission.** W5 routed every approval through `src/lib/policy.ts` (headless/cli/dod) with seats
byte-identical. Add the missing PINS and the ledger provenance field, then write the 216o body.

**Done-when:** bypass pins exist and pass (a denied action is un-bypassable by BOTH seats;
`hitl.force` cannot self-approve); the ledger row records WHERE a decision came from
(seat label + token-path bool) via a NEW optional field on the HitlDecision shape in
`types.ts`, threaded from `headless.ts` + the CLI; typecheck 0; suites green; `216o` complete.

**Owned:** `types.ts` (one additive field), `src/lib/headless.ts` + its test, `scripts/rapidtool-cli.mjs`
(approve-path hunks only), `src/lib/dod.ts` (+ test pins), `fixes/216o_policy_integration.md`.
NOT yours: codegen/scaffold/engine (L1), llm/doctor (L3), run-eval (L4), everything else (L5).

**MINI-TASK PLAN:**
1. Read the W5-L3 summary (`subagent-summary-2-20260916_213829_505012.txt`) — it lists the exact
   patches (headless ~:750-800 with `evaluatePolicy`, cli ~:534-566 seam consult, dod) and the
   cross-file need it flagged (ledger row records only decidedBy+note; 216n §4.3 wants a
   provenance field). Read `src/lib/policy.ts` + the `ApproveActor`/seat code.
2. PINS (headless.test.ts + dod.test.ts): (a) a policy DENY (unknown action) is refused for the
   autopilot seat AND for the human seat (with token) — no bypass; (b) `hitl.force` via the
   autopilot seat is refused; (c) human+token allows force (positive control). Keep every
   existing seat-string assertion byte-identical.
3. PROVENANCE: add an OPTIONAL field to the HitlDecision shape in `types.ts` (e.g.
   `decidedVia?: { action: string; resource: string; reason: string; label: string; tokenPath: boolean }` —
   name it per house style; additive + optional so old rows parse). Thread it at the three
   decision-mint sites (headless approve + cli + dod) from the `evaluatePolicy` verdict.
   Record the shape in 216o.
4. CLI: keep the approve verb's exit codes + JSON contract + verb count UNCHANGED (doc-contract
   test scripts/README-cli.test.mjs must stay green).
5. `fixes/216o` body: work log, commands+results, old→new (if any), the provenance contract,
   not-done list.
**Verify:** `npm run typecheck`; `node --experimental-strip-types --test src/lib/headless.test.ts src/lib/dod.test.ts`;
`node --test scripts/README-cli.test.mjs`; baselines headless 84, dod 85(+?), README-cli 5 —
grow, never drop. Budget death ⇒ plain statement.
