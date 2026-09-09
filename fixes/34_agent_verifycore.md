# 34_agent_verifycore — Wave B verification-core lane (agent A, Flash)

E-02 (pure gate recorder), E-07 (p6-verified probe), E-08 (pure oracle-pinning
seam), E-26 (DoD property tests), E-29 (`runSandboxed` deprecation, choice b).

**Ownership honored:** edited ONLY `src/lib/dod.ts`, `src/lib/sandbox.ts`,
`src/lib/gates.test.ts`. No other source file touched. Specs:
`research/multiagent/08_enhancement_register.md` E-02/E-07/E-08/E-26/E-29.

## Files changed

| File | Change |
|---|---|
| `src/lib/dod.ts` | +`recordGateInto(project, phase)` (E-02 export contract); +DOD[6] `p6-verified` additive probe (E-07); +`oracleToCaseSeeds()` / `missingOracleCaseIds()` (E-08 pure core); header comment updated |
| `src/lib/sandbox.ts` | E-29 (b): `runSandboxed` + worker-isolate section declared DEPRECATED; all "only legal executor"/"real boundary" claims removed from comments. **Comments only — zero behavior change** (sandbox.test.ts pins every returned string) |
| `src/lib/gates.test.ts` | +recordGateInto suite (5 tests), +p6-verified tests (3), +E-26 property tests (5), +E-08 seam tests (3); all-green invariant now asserted on a *promoted* full run; +DOD-length property |

## What each entry did (and the consumable contract)

- **E-02 — `recordGateInto` exported from `dod.ts`** (pure, mirrors
  `store.recordGate` `store.ts:133-174` byte-for-byte: no-op same-reference
  unless the phase record is `complete`; stamps `PhaseRecord.gate`
  `{passed, unmet(criteria), evidenceHash, checkedAt}`; appends the capped
  `gate.verdict` log `{PASS|FAIL · n unmet · hash8}`; swaps the kind-`gate`
  artifact — replaced, never duplicated). `store.recordGate` can now become a
  one-line delegate. **Live sibling consumption confirmed:** the headless lane
  already imports it (`src/lib/headless.ts:36`, calls at :313/:324/:350/:410)
  and headless.test.ts is green with it. Store-side delegation is still
  pending in the store lane (`store.ts:136` still has the inline body);
  `store.test.ts` stays green unmodified as required (its current failures are
  the store lane's own mid-flight refactor, below).
- **E-07 (dod slice) — `p6-verified` probe.** Pass iff
  `lastTest.label === "tested" && evidenceHash?.length > 0`; `p6-test` remains
  the deterministic floor. `lastTest` fields are read through a defensive
  cast, so the probe compiles and runs whether or not types.ts has landed the
  E-07 fields yet (agent B's `label?: "self-test"|"real-run"|"tested"` is on
  disk at `types.ts:282-288`; `evidenceHash?` is still coming — no dependency
  on its timing).
- **E-08 (pure core only) — oracle pinning seam.** `oracleToCaseSeeds(oracle)`
  renders every A7 row as a `# orc-<id> <name> — <given> ⇒ <expect>` seed line
  (deterministic, empty for `[]`); `missingOracleCaseIds(returnedIds, oracle)`
  returns dropped seeded ids in seed order. The generateCases prompt-prepend +
  retry-once + honest-error wiring lives in `verify.server.ts` (out of lane) —
  the verify lane should import these two from `dod.ts`. If the verify lane
  implements its own copy in verify.server.ts per the register's "e.g.",
  dedupe at integration (pure, tiny).
- **E-26 — property tests** (all in gates.test.ts, already in the npm test
  list): (1) `Object.keys(DOD).length === 13`, keys 0..12, ids unique; (2) no
  probe throws across a prefix-walk of all 13 phases (probes invoked
  DIRECTLY, so `evaluate`'s catch cannot mask a throw) + adversarial shapes
  (`{}`, `{lastTest:null}`, stripped full run) never throw; (3)
  `runGate(p).evidenceHash === runGate(JSON.parse(exportProjectJson(p)))`
  per phase over floor/promoted/mid-run samples; (4) every GateItem has a
  non-empty criterion.
- **E-29 — choice (b): deprecate honestly.** Section header + `@deprecated`
  JSDoc + claim-comment rewrites in `sandbox.ts`; grep for "only legal
  executor" now returns only historical research docs. `sandboxClaim()` text
  was NOT changed: `packet.test.ts:242` pins the exact worker-branch string
  (out-of-lane file). `02_capability_audit.md` §A6/B4 doc update not done
  (research/ out of lane — recommend the parent or E-30 lane).

## Gate status at hand-off (snapshot 01:5x)

- My files: **gates.test.ts 48/48, sandbox.test.ts 25/25** (prettier-clean).
- Typecheck: my files introduce **zero** errors. Whole-tree `tsc --noEmit`
  shows ~49 errors, all from sibling mid-flight edits: agent B's types.ts
  churn has temporarily removed `Project.scorecard` (breaks pre-existing
  probes in dod.ts:52/59/83 + packet/vault/console/engine, incl. one
  pre-existing gates.test line) and `ModelRoute` already changed to the E-14
  set; store.ts is mid-refactor (`applyReport`/`rawReportCarriesTests` gone);
  console.tsx/scaffold/CLI lanes mid-edit. Re-run after siblings land.
- Full suite: 10 failures — 8 are siblings' mid-flight work (store M-05 x2,
  store autopilot journal, CLI lane E-25 ingest x2, scaffold/E-15 x3,
  report-intake applyReport). **Two are direct consequences of my spec'd
  E-07 probe and need an owner (NOT in my lane):**

## Cross-file consequences of p6-verified (need one of these owners)

1. `src/lib/handoff.test.ts:52-60` "marks all DoD criteria met ([x]) on a
   completed project" — a plain deterministic `fullRun()` now legitimately
   shows `- [ ]` for p6-verified on P6. Fix (1 line in their local
   `fullRun()` helper or `fixtures.ts runHeadless`): stamp the promoted
   `lastTest` `{...lt, label:"tested", evidenceHash:"…"}` on fixture full
   runs, or exempt p6-verified from that assertion. Register E-07's own DoD
   ("existing suites green") implies this fixture promotion was expected.
2. `src/lib/store.test.ts:312` "autopilot approvals are journaled with the
   autopilot actor" — the `projectAtGate(6, …)` fixture's `lastTest`
   `{ok:true, detail:"fixture self-test pass"}` no longer passes M-09's
   `canAutopilot` DoD check (runGate now includes p6-verified), so P6 parks
   (currentPhase 6, not 7). Store lane: give the fixture a promoted
   `lastTest` (`label:"tested"` + `evidenceHash`) or keep canAutopilot on a
   floor-only evaluation. This is the intended E-07 semantics: deterministic
   floors are not machine-"tested".

## Notes for integration

- `recordGateInto` is the exact store/headless seam; when the store lane
  delegates, the duplicated body at `store.ts:133-174` should become
  `return recordGateInto(project, phase);` (imports of `runGate`/
  `gateArtifact` at store.ts:15 then drop).
- My gates.test uses `promote()`/`withLastTest()` helpers (cast through
  `unknown`) so the suite is immune to the timing of agent B's types.ts
  `lastTest` field additions.
- Files verified byte-identical in behavior: dod.ts runGate/readyFor/
  gateArtifact untouched; sandbox.ts strings untouched.
