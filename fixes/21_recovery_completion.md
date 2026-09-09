# Recovery + completion — multi-agent wave (parent)

The 5-Flash implementation batch died mid-flight (delegation infra failure) after partial
landings. The parent recovered and completed everything. Final state:

## What landed from the batch (verified + fixed)
- **Crew (M-04/03_crew_design)** — `crew.server.ts` (729 ln: roles, JSON message protocol,
  orchestration loop, context budget, flash-only role tiers) + `crew.ts` (createServerFn client)
  + `crew.test.ts`. Live-verified: "Crew run complete · 3 messages · 14 artifacts ingested".
- **Engine/types/packet (M-01/M-03/M-06/M-07/M-11)** — research corpus (`Project.research`),
  `liveLayer()`, runP6Real→lastTest gate convergence, narrative honesty footers,
  packet "Research sources (live)" block, "P6 template self-test" rename.
- **DoD (M-09/M-11)** — p7-research requires a live research corpus; p6-test probe honest.
- **report-intake (M-05/M-08)** — `tests_run` schema, `currentPhase` validation, blocked→
  rejectionHistory, complete→memory write-back (semantic + episodic rows).
- **Console (M-01-UI/M-12/crew UI)** — Spawn-crew button + result panel, competitor source
  badges, rejection-guidance surfacing in blocked state.

## Parent fixes during recovery
- crew.server.ts splitSections body join (typecheck).
- store.ts: ingestReport passes currentPhase; M-05 warn on complete-without-tests; M-09
  autopilot requires runGate().pass (+ new denial regression test).
- packet.ts: research-sources block + self-test rename.
- dod.ts: p7-research tightened.
- headless.ts: research corpus + narrative footer (M-01/M-07 parity), ResearchSource mapping.
- verify loop (M-04) built from scratch: `verify.server.ts` (harness → runNodeBounded,
  ORACLE_RESULT machine lines, generateCases via DeepSeek json:true, verifyAndFixServer
  bounded fix loop) + `verify.ts` client + `verify.test.ts`.
- Test pins updated for the new honest behavior (gates/handoff/store/report-intake/fixtures).
- ROLE_SPECS → all flash (pro tier 60s-timeouts + billing).

## Live proofs (real DeepSeek key, real machine runs)
- **Verify-fix loop**: correct adder → `passed, 1 iteration, 5/5 machine-run cases`;
  broken `a*b` adder → DeepSeek fixed to `a+b`, machine re-ran → `passed, 2 iterations`.
  The LLM never declares success — only the real runner does.
- **Crew**: flash-only 3-role run completed with 14 ingested artifacts.
- **Research**: free keyless DDG/Wikipedia live (no key needed).

## Final gate
typecheck 0 · lint 0 · build 0 · **345/345 tests (22 files)** · browser smoke 0 errors.
`npm test`'s scripts leg still has the 10 documented Windows env-baseline failures
(symlink privilege + stock-scaffold coupling) — pre-existing, green on platform CI.
