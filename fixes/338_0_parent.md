# 338 wave (W52) — parent / boundary record

**Boundary owner:** parent. **Opened** 2026-10-02 at HEAD `e7da20e`, tree clean. **Six lanes + two
follow-ups.** Contract: `wave_plans/W52/README.md`. Logs: `fixes/338_1_determinism.md` …
`fixes/338_6_learning.md`.

## 1. Boundary gates

| Gate | Result |
|---|---|
| typecheck | **exit 0** (both legs) |
| lint | **exit 0**, 0 warnings |
| assertions | **exit 0** |
| tests | **scripts 411 / lib 2942 / 0 fail / 2 skipped**, exit 0 |
| build | **exit 0** |
| `gate.sh` | **`ok:true`, exit 0**, `flakes: []`, `hardFails: []` |

Baseline: 411 scripts + 2889 lib → **+53 tests**. No tracked file deleted.

## 2. What the six lanes settled

- **338-1 Determinism (gap 1) — the coverage divergence is CLOSED.** Reproduced with **two real keyed
  runs on the same brief**: the raw declared-job coverage differed (`unbound:["track"]` vs
  `unbound:["track","flip"]`). Root cause on bytes: `deriveTypeSignatures` was an **unwired deterministic
  floor** — repo-wide it had exactly two references, its definition and its own test — so the P6 plan was
  built purely from the model's emission. The plan is now reconciled against the lattice/spec graph
  (`reconcilePlanTypeSignatures`), which are pure functions of the brief, so the declared-job file set is
  **identical across both runs** (`RECONCILED … same: true`), with the residual variance bounded to
  additive extra chunks that can never remove a declared file. `p6-arch` reads the same persisted spec, so
  it judges the same rule with no `dod.ts` edit. (2 keyed calls, 858 prompt tokens each.)
- **338-2 Completion (gap 2) — the tree's declared toolchain now RUNS.** `treeRun` now links the repo's own
  `node_modules` as a fallback toolchain root (bounded, offline: +3.1 s per tree-run, measured) instead of
  skipping `tsc`/`build`. `declaredScriptsVerified` goes **false → true when the toolchain genuinely runs
  and passes**, stays false with a **genuine red** when the tree fails it, and keeps the named skip when the
  tool cannot resolve. **Critically, making it run exposed a real product defect the skip had been hiding:
  the emitted code was untyped while the emitted `tsconfig` enforces `strict`** (`TS7006` on every generated
  parameter).
- **338-3 Autonomy (gap 3) — the journey is driven and the parks are classified.** A keyed run with
  `--seat autopilot` (zero human input) cleared P4 and P5 and reached P6, where it hard-blocked. It also
  found that `doctor`'s `productComplete`/`humanFixtures` signals had **no producer at all** (a constant
  `false`) and wired them to the persisted project record — real-bytes proof: `doctor --project` now reports
  three gaps with the product-complete gap gone for a genuinely complete tree. Classification: P4/P5/P8/P9
  stock parks are **machine-resolvable** (the autopilot seat clears them via policy); `forceHuman` parks are
  **genuine human decisions**; the P6 DoD block is machine-resolvable in principle and was blocked by the
  typing defect.
- **338-4 Acceptance (gap 4) — decided honestly as "stays human, made machine-CHECKABLE".** Option A (let
  the machine approve fixtures) was rejected on three on-disk facts, the strongest being that the *machine
  drafts the bar* (`brief-fixtures.ts`): a machine allowed to approve would set the bar it is graded
  against, and `policy.ts:141` already registers `requiresHumanSeat:true` — pinned by a scripts test. The
  genuinely broken half was the other one: the criterion was neither satisfiable nor explainable. It now
  derives six states (`no-fixtures / unreadable / pending / machine-decided / unattributed /
  human-approved`) and **one honest sentence**, so `doctor` can distinguish "waiting on a human" from
  "broken". `maker-score` M1/M2 use the same vocabulary (absent ⇒ legacy line, byte-identical).
- **338-5 Product (gap 2's emitted half) — the emitted product is wired and runnable.** `@tailwindcss/vite`
  and `tailwindcss` were **orphan devDependencies** (nothing wired them) — now wired, proved by a real build
  emitting a 4.6 kB compiled CSS asset; `tsx` was struck as an orphan; the **game tree's declared
  `tsc --noEmit` genuinely failed** (`TS6142`) — fixed, real `tsc` exit 0; emitted docs no longer table a
  nonexistent `src/main`. And the **packet was missing a runnable command**: every export profile said "run
  the oracle tests from the packet" while nothing named the command or the spec path — now it names
  `tests/oracle.spec.ts` and the tree's declared `npm test`.
- **338-6 Learning — the loop is REAL and load-bearing, and two more spine holes closed.** A deterministic
  probe (0 keyed calls) shows a real `runCases` failure anchoring an L3 lesson row, persisted to
  `project.memory`, and passed into the **actual** expansion site's `lessons` argument (`CHANGED = true`).
  Whether the model then emits a *better* spec needs a keyed A/B, which it did not run — stated as a
  boundary. It also found and fixed two verification holes: `entry-oracle.ts`'s `validateExpectedBehavior`
  **accepted a row field its check never evaluates** (a row could read green while the thing it declared was
  ignored — the "verifier that cannot fail" class one layer down), and the evidence hash omitted the oracle
  **case set**, so two outcomes differing only in cases collided into one stamp.

## 3. The typing fix (both follow-ups) — the autonomy blocker

Lane 338-1b fixed the root: the P6 system prompt's **worked example was untyped JS**, so the model imitated
it. The example is now annotated, rule 2 says "fully-typed functions only", and a new rule 10 states the
strict-mode requirement (deliberately *not* claiming validator-enforcement, since none exists — the drift-proof
test pins enforcement claims to rules `[2,4,8]`). It also folded the two spine items 338-6 reported (the L4
lesson row is no longer dropped by the automated pass; the evidence-hash twins now share `verify.ts`'s
three-part formula). Lane 338-2b did the **floor template** (`sandbox.ts`) — resolving a real tension:
`engine.ts` executes those same bytes through `new Function`, so a TS-only annotation would be a SyntaxError;
a *default-typed* parameter is valid JS **and** types correctly under `strict`. The emitted tsconfig's
strictness was **not** relaxed.

**Proved on real keyed runs:** the emitted tree's own `npm run typecheck` → **exit 0, 0 errors**, and
`lastTest.label: "tested"` minted in **both** runs with `runGate(p,6) → pass:true, unmet:[]`.

It also reconciled the four gate tests its changes invalidated (`headless.test.ts`'s E-25/emit pins,
`scripts/cli-exit-taxonomy.test.mjs`, `llm/providers/mock.test.ts`'s plan-shape, the scaffold README banner)
**to the real post-fix behaviour, keeping every pin's teeth by constructing the condition honestly** — e.g. a
tree whose declared `typecheck` names a nonexistent tool still yields `unverified:true` and exit 5 under
`--require-verified`.

## 4. THE DECISIVE EVIDENCE — the unattended journey (parent-run, after the fixes)

The owner's question was *"does RapidTool truly work as an autonomous software factory?"*, so the boundary
owner drove the documented agent loop itself with **no human input**, a real `.env` key, and the machine
seat (`--seat autopilot`):

```
step 1 : exit=2 phase=4 status=awaiting_hitl             # stock park, cleared by the autopilot seat
step 2 : exit=2 phase=5 status=awaiting_hitl             # stock park, cleared
step 3 : exit=1 phase=6 status=running unmet=[
           "Machine verification promoted a tested verdict (lastTest.label === \"tested\" with evidenceHash)",
           "Brief-conformance: required brief nouns appear as identifiers in the generated source" ]
approve → exit 1 (correct: a hard DoD block is repaired, not approved — no HITL door for a red gate)
```

**So: not yet.** The run reached P6 and stopped there. Reading the project's logs shows exactly why, and it
is three named defects — not fog:

1. **The keyed P6 synthesis ran three cycles and each was refused by the machine-verification oracle
   harness** (`p6.synthesis.refused`, `RT_E_RUNNER_FAILED`), so `p6.journey.exhausted` ("3 cycle(s) without
   a green tree-run") and the project kept the deterministic floor template — hence `generatedTree: 0` and
   `lastTest: {ok:true, detail:"tests.pass"}` with no `tested` label.
   - Cycle 1: `case-2: false; … case-6: error ReferenceError: me…`
   - Cycle 2: `case-2: error ReferenceError: computeMean is not defined; case-3: …`
   - Cycle 3: **`case-1: not run — case payload rejected by harness safety check`** for every case.
2. **A name-binding gap**: the oracle cases call `computeMean` (and siblings) that the generated module does
   not define — the oracle's expected identifiers and the synthesised module's exports disagree.
3. **`p6-brief-fit` cannot pass on a floor project**: the required brief nouns must appear as identifiers in
   the generated source, and the placeholder module contains none — so the two criteria are coupled: fix
   synthesis, and brief-fit follows; leave synthesis on the floor, and it can never pass.
   Plus the operator-visibility defect lane 338-3 already named: in cycle 3 the sanitizer's own reason is
   **clipped out of the 186-char refusal detail**, so "case payload rejected by harness safety check" tells a
   human nothing about which expression was rejected or why.

**Also relevant, from the web research the owner authorised** (a `deep-research` run, cited report in the
session's workflow scratch): the converged practitioner answer is exactly the direction this wave took —
*keep the control plane in deterministic code (spec-derived skeleton, declared write set, machine-checkable
plan output, acceptance-test-driven repair, tamper-evident stamps that fail closed)* rather than in the
prompt. It names one lever RapidTool has **not** used: **provider-level constrained decoding** (strict
JSON-schema / grammar-constrained output) for the machine-checked envelopes (spec graph, plan, oracle case
set), which would make those structures conformant by construction instead of by prompt.

## 5. Remaining work (the next round's brief, precisely)

1. **Align the oracle-case grammar with what the synthesis is asked to emit** (`verify.server.ts`'s case
   sanitizer vs the oracle prompt in `codegen.server.ts`) — today the sanitizer rejects the model's own case
   payloads outright, which forces a refusal **regardless of code quality**. Then surface the rejection
   reason verbatim (un-clip the 186-char detail).
2. **Bind the oracle's called identifiers to the synthesised module's exports** — either the oracle must be
   generated from the module's real export surface, or the prompt must guarantee the declared names. This is
   the `computeMean is not defined` class.
3. **`p6-brief-fit` on the floor**: decide honestly whether a floor project can ever pass it, or whether the
   criterion should name the floor state.
4. **Use constrained decoding** for the spec/plan/oracle envelopes (research-backed; the largest untouched
   determinism lever).
5. Everything from the prior round's §5 that still stands: `.t4scratch/` + dead modules (awaiting sign-off),
   `npm run eval --keyed` unrun, `R11-f01`, the stale machine key, and the UI proposals.
