# 157 — SYNTHESIS: the honest plan for a factory that produces 100% functional software

Parent synthesis · 2026-09-09 · merges my own code reads + fixes/155_structural_audit.md +
fixes/155_web_functional.md + fixes/154_direction.md + the run ledger. Every claim is
file:line-evidenced or source-cited; no speculation.

## 1. Root cause (one paragraph)

RapidTool's pipeline is functionally self-referential: the brief is reduced to prose capabilities
and prose A7 oracle rows that are never compiled into executable expectations; the LLM is asked
for a name-compliant envelope validated on export-binding, forbidden tokens, and identifier
substrings — never on what its functions compute; the one behavioral runner (verify.server's
LLM-authored boolean cases) is A7-unseeded and structurally bypassed for every declared delivery
kind; and "machine-verified" is minted by a tree-run whose green comes from compile-parity plus
the scaffold's own stub self-tests, with webapp entries skipped outright (155_structural_audit
§6-§8). The floor (sandbox.ts:135-171) is a no-op whose oracle asserts the no-op; green literally
means "stub still intact" (oracle.spec.ts asserts `TODO(E-15) stub` REJECTS). So every stage
truthfully certified the stage below it, and no stage ever asked whether the shipped artifact
performs the brief's job. The empty-content refusals (LLM returned nothing on every pro-tier
synthesis call) are a SEPARATE, shallower bug on top of this — fixing the API interaction alone
will not make the factory produce functional software.

## 2. The honest bar: what "100% functional, excellent software" actually requires

The web evidence (155_web_functional) is unambiguous and I will not soften it:
- Functional correctness = **run the artifact against executable tests the producer never wrote
  and never saw**, applied by an external harness (HumanEval/SWE-bench/SWE-bench-Live/
  Terminal-Bench all define it this way).
- **Self-authored tests are a measured overfitting liability** — refining code against auto-
  generated tests RAISES overfitting (Claude 21.8%→25.5%, GPT-4o 33.0%→35.9%, arXiv 2511.16858).
- **A brief alone cannot be the oracle** — OpenAI's human annotation of SWE-bench filtered 68.3%
  of instances for underspecified statements / unfair tests. Intent is underspecified in real
  briefs.
- Therefore: **the honest minimal human input is ONE review-and-approve of a machine-DRAFTED
  acceptance suite** (input→output fixtures per requirement), before the autonomous run-to-green
  loop may claim "functional." This is not a research gap — it is the correct architecture:
  machine drafts, human approves, machine executes, human signs off the final artifact.

This means "100% functional, fully autonomous, zero human input" is not achievable honestly for
under-specified briefs. What IS achievable: a factory where the human's single, cheap act is
approving acceptance fixtures, and everything after that — synthesize → execute → fail → repair →
re-run → verify → ship — is autonomous and HONEST (no green without behavioral pass, no floor
masquerading as software).

## 3. Already fixed (immediate blockers — verify on disk, don't rebuild)

- Scorer vacuity: `synthesisSucceeded=false` → M1-M4 = 0 (9/9-on-a-refused-run now 5/9).
  maker-score.ts + run-eval.mjs (fixes/154 F1).
- Empty-content diagnostics: reasoning_content/finish_reason surfaced (deepseek.server.ts:378-392).
- Test-env leak: store full-pipeline pinned `enforceDod:false` (the `keyedDeepSeekConfigured()`
  default was flipping the P6 hard-block under a stray key). Green 1395/1395.
- Kind-scoped tree trigger + liveLayer kind stamp, E-15 canonical stub markers, resilient LLM
  retry (steal #1), claim gates (steal #2), diff-aware reviewer context (steal #3).
- IN FLIGHT (156): E1 empty-content mechanism fix · E2 chat/instruction path · E3 wild P6 parity.

## 4. The ranked build plan (the keystone is the behavioral oracle)

### P0-1 — Build an executable brief oracle and make it the keystone (the whole ballgame)
Convert corpus `expectedCapabilities`/`acceptance` + A7 `given ⇒ expect` rows into REAL fixture
cases: concrete input → expected output per requirement (e.g. `createProperty({address,owner})
⇒ {id, history:[]}`; `bookShowing(pid, slot, buyer) ⇒ showing + email stub + history row`;
`addWorkOrderHours(woId, 3) ⇒ jobCost + payroll accrual`). Emit them as `tests/fixtures.brief.json`
+ a runner spec that IMPORTS THE TREE ENTRY and asserts outputs. Wire the dead E-08 seam
(dod.ts:714 `oracleToCaseSeeds`) so verify/generateCases are SEEDED with these cases instead of
asking the model to invent them. Every kind gets this — including webapp (import the entry, call
the functions headless; a "UI shell" is then no longer a skip, because the DATA layer is
executable even when the DOM isn't).
Steps: (a) a fixture-case data model + a deterministic drafter that turns capability prose + A7
rows into candidate cases (LLM-assisted, machine-reviewed for shape); (b) the human approve gate
(`lesson accept`-style: the corpus/acceptance fixture is a human-gated write); (c) scaffold emits
the fixture + the behavioral runner spec; (d) treeRun runs it; (e) the M1 criterion keys on
"behavioral cases passed", not identifier presence.

### P0-2 — Execute the artifact; behavioral green is the ONLY convergence
(a) treeRun executes the webapp entry (import the assembled entry + run the data layer; vite-build
+ node smoke for the UI shell) instead of "honest skip"; (b) fix headless.ts:1397 — the journey
records the P6 gate then returns `converged` WITHOUT reading `gate.passed`; converged must require
the brief-fixture suite green AND gate.passed; (c) M2/M3/M4 key on behavioral-case counts.

### P0-3 — Make the floor un-representable as a keyed success
`partialTreeRefuse` must drop (not assemble) a partial when the fixture suite can't run green;
`gate.journey` + emit/DEPLOY claim surface carry the synthesisSucceeded discriminator so floor
and LLM-software never share a green path.

### P1-1 — Behavioral synthesis ask + per-chunk self-run
Put the fixtures IN `p6SynthesisChunkUserPrompt` (per-req example I/O); require `reqTrace` to map
req-N → the function the fixture exercises; add a deterministic per-chunk fixture self-run (parity
with the single-module verify the chunked path currently skips by design) so repair feedback is
behavioral failure text.

### P1-2 — Demote the identifier-stem gates
p6-brief-fit, p6-arch, M1 capabilityCoverage, and the scaffold capability-presence rows are
sub-identifier proxies that disagree with each other and certify nothing. Replace with the P0-1
fixture runner as the substance gate; keep stem reports as advisory coverage telemetry only.

### P1-3 — Close the empty-content hole with a fallback, not just diagnostics
Before stranding a chunk, retry on the flash tier or with `thinking:disabled`; the 156-E1 lane is
already on this — adopt its verified mechanism.

### P2-1 — emit→edit→re-emit WITH behavior + the build gate (C7)
Extend the repair/tree-run seam so an edit is re-verified against the brief fixture suite, and the
emitted webapp actually builds (`npm install && vite build`) — no webapp emission has ever built
(149_a5 C7).

## 5. Sequencing + the honest acceptance of the human gate

1. Land 156 (empty-content fix, chat, wild P6) → gate.
2. P0-1 (the oracle) is the next build wave — it is the only fix that changes the meaning of
   "green." Dispatch it with the machine-drafter + the human-approve gate.
3. P0-2/P0-3 land WITH P0-1 (the convergence fix and the floor-un-representability depend on the
   fixture runner existing).
4. Then re-run the keyed Property Ledger: with the empty-content fallback (real content) AND the
   behavioral oracle (real verification), the scorecard finally measures the brief's job.
5. The final honest claim is NOT "9/9" — it is "the shipped artifact passes human-approved
   acceptance fixtures for the brief, executed by a harness the producer never authored."

## 6. The single most important sentence

Green must be redefined to mean "the produced functions satisfy human-approved, brief-derived
input→output fixtures, executed by the harness" — every other fix (empty-content, chunking, DoD
honesty, scorecard discipline) is necessary but does not move the bar until that keystone exists.

## 7. Extension sections (158 study wave — merge-ready, fully cited)

Three deep-study agents produced code-grounded + web-cited extensions, each a self-contained
section file (read them in full; anchors + citations verified):

- **fixes/158_s1.md — Governance & orchestration** (265 lines): deterministic state-machine owns
  transitions (ahead of MetaGPT/ChatDev/SSSF/OpenHands); gaps + ranked additions on gate semantics
  (phase-complete should require gate.passed like SSSF's `run.finish(accepted)`), HITL placement,
  orchestrator-workers for crews, trace/audit.
- **fixes/158_s2.md — Codegen + execution + the oracle** (377 lines): advances the P0-1 keystone —
  the fixture-case data model + drafter, seeding verify.generateCases from A7 rows (the dead E-08
  seam), the behavioral runner spec, the empty-content fallback (already landed by 156-E1), the
  self-authored-test overfitting guard.
- **fixes/158_s3.md — Agent loop + self-improvement + production readiness** (370 lines): turning
  the write-only lesson store into a behavior-changing loop with a falsification kill-criterion,
  eval-gated promotion (M6), provenance stamps so a floor/refused run can never ship as software,
  SLSA-style deploy/build gate (C7), human-approve acceptance wiring.

These supersede/refine the P1/P2 items above where they overlap (e.g. S2's oracle data model is
the concrete P0-1 design; S3's provenance stamp refines P0-3; S1's gate-semantics refines P0-2).

## 8. Keyed-run reality check (2026-09-09, post empty-content fix)

The 156-E1 empty-content fix WORKED: the keyed run finally produced real LLM code — a ~38 KB
module with genuine domain logic (`lease`/`workOrder`/`payroll`/`showings`/`PropertyLedger`),
`synthesisSucceeded:true`, `p6Refused:false`, the no-op floor absent. BUT the brief's 7
capabilities still collapsed to ≤8 type signatures → 1 chunk → 1 entry hosted on ONE job node
(`src/jobs/track.ts`), while the other 4 jobs (`flip`/`record`/`show`/`publish`) remain `TODO(E-15)`
template stubs. The 9/9 is therefore "the LLM produced a module that runs and carries the right
nouns, while 4/5 jobs are still stubs" — NOT functional correctness. Two concrete follow-ups
emerge ahead of the oracle build: (a) the expansion must turn capability scope into enough
type-signatures to force a real multi-file tree (the single-chunk collapse is the new M1 gap);
(b) the behavioral oracle remains the only thing that can turn "produces code" into "produces
functional software."
