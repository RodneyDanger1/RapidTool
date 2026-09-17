# W5 · LANE 3 — policy integration (Wave H · T-107.3 routing)

**Mission.** The one-seam policy engine exists (`src/lib/policy.ts`, 27 tests) but nothing
routes through it. Route EVERY approval through `evaluatePolicy(action, resource, ctx)` and pin
that a denial cannot be bypassed.

**Done-when:** every approval path (headless seam, CLI, DoD probes) consults the policy seam;
default-deny respected; `hitl.force` cannot be self-approved; denied actions stay denied under
BOTH seats; typecheck 0; suites green (counts grow).

**Owned files:** `src/lib/headless.ts` (approval seam ~:734 — re-grep), `scripts/rapidtool-cli.mjs`
(approval site ~:517 — re-grep; ONLY the approval hunks, not verb-count changes),
`src/lib/dod.ts` (:337-483 area — re-grep), plus tests in `src/lib/headless.test.ts` /
other suites you must touch for pins; `fixes/216o_policy_integration.md` (NEW).
NOT yours: codegen/scaffold/engine/doctor (L1), harvest/docs (L2), llm/deepseek/verify/chat/crew (L4),
run-eval/corpus (L5).

**MINI-TASK PLAN:**
1. Read `src/lib/policy.ts` fully (the contract: discriminated verdict `{decision, reason,
   fallback?}`, default-deny on unknown action/resource/seat, uniform seat rule, force rule)
   + `wave_plans/W4/lane-2.md` (its design intent) + the TA-2 seat shape in `headless.ts`
   (`ApproveActor`, `HARNESS_APPROVE_ACTOR`, `RT_HUMAN_SEAT_TOKEN`).
2. `headless.ts` ~:734: replace the ad-hoc approval decision with `evaluatePolicy(...)`; keep
   the existing `ApproveActor` shape and `[seat <label>]` note tags byte-identical where pinned
   (record old→new if a string must change — this repo pins many).
3. `scripts/rapidtool-cli.mjs` ~:517: the approve verb path consults the same seam; keep exit
   codes/JSON contract unchanged (README-cli is doc-contract tested — do NOT touch counts).
4. `dod.ts` :337-483: DoD probe approvals route through the seam too (the dossier names this
   as P0-06's point: ONE seam).
5. PINS: a denied action (a) cannot be approved by the autopilot seat, (b) cannot be approved
   by the human seat without the token, (c) `hitl.force` cannot self-approve; positive paths
   (autopilot allows the normal set; human+token allows force) stay green.
6. `fixes/216o_policy_integration.md` — skeleton first; work log + commands + results.

**TRAPS:**
- W2 pinned `ApproveActor` strings + 9 headless tests (83→ your run's count) — do not regress
  them; record any deliberate change old→new.
- The CLI verb-count doc contract (`scripts/README-cli.test.mjs`) must stay green — you are
  not adding verbs, only routing.

**Verification:**
```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
npm run typecheck
node --experimental-strip-types --test src/lib/headless.test.ts src/lib/dod.test.ts
node --test scripts/README-cli.test.mjs
```
Baselines: headless 83, dod = your first run's count; grow, never drop.

**Logging:** `fixes/216o_policy_integration.md`. Budget death ⇒ plain statement of what landed.
