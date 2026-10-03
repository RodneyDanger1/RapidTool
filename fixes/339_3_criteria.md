# fixes/339_3_criteria.md — W53 · lane 339-3 · CRITERIA (p6-brief-fit floor honesty + satisfiability)

**Lane:** 339-3 ("criteria"). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (space in path — PowerShell,
`Select-String`/`git grep` only).
**HEAD at open:** `c4348f4` (`338 wave: closing the autonomous-factory gap …`); tree NOT fully clean at open —
sibling WIP `M src/lib/prompt-engine.ts` (another lane; I did not touch it).
**Runtime:** repo-pinned Node **22.23.2** (`%LOCALAPPDATA%\hermes\node\node.exe`) and host Node **v24.15.0**;
every parsed `node --test` run uses `--test-reporter=tap`.
**Owned (STRICT):** `src/lib/dod.ts`, `src/lib/judgment.ts`, `src/lib/phases.ts` + colocated tests
(`dod.test.ts`, `judgment.test.ts`, `phases.test.ts` — all three exist).
**Scratch (outside the repo):** `%TEMP%\rt339_3\`. No probe file left in the repo.
**Rules obeyed:** patch-only, no full gate (`npm test`/`build`/`gate.sh` never run), targeted suites only, no
keyed calls, no tracked file deleted, no secret printed, append-only log.

---

## 0. Step 0 — reconciliation (claimed / on disk / still open)

Read this pass: `AGENTS.md`, `fixes/338_0_parent.md` (§4/§5), `fixes/337_0_parent.md` (§5),
`fixes/338_3_autonomy.md` (§3 classification, §5/§6), `wave_plans/W52/README.md`, and the live bytes of my
three files + `sandbox.ts` (`buildPhase6Module`/`briefNounHits`/`identifierHits`), `codegen.server.ts`
(`briefFitSatisfied`, READ ONLY), `headless.ts`/`policy.ts` (park/seat reading, READ ONLY).

### claimed (prior waves)

- **338-0 §4/§5 item 3:** `p6-brief-fit` cannot pass on a keyless floor project — the criterion demands the
  brief's required nouns as source identifiers and the deterministic placeholder module contains none — so the
  criterion is permanently red on the floor and coupled to synthesis. Decide honestly whether a floor project
  can ever pass it, or make the criterion **name the floor state**.
- **338-3 §3 classification:** P4/P5/P8/P9 stock parks are **machine-resolvable** (the autopilot seat clears
  them via policy); `forceHuman` parks (P0 reframe, failed P6 sandbox) are **genuine human decisions**; the P6
  DoD block is machine-resolvable in principle but was blocked by sibling defects.

### on disk (measured today at `c4348f4`)

- `src/lib/dod.ts:650-679` (`HEAD`) — `p6-brief-fit` probe reads `briefNounHits(brief)` over
  `generatedSource` ∪ `generatedTree`; bar `max(1, ceil(required × 0.35))`. **The unmet message was the bare
  static criterion** — no state, no nouns — so a red floor told a human nothing about *why*.
- `src/lib/sandbox.ts:199-241` — `buildPhase6Module`: the floor opens `const JOBS = [`, defines `synthesize`
  / `test_happy` / `test_no_skip`. Those identifiers never carry brief vocabulary ⇒ `p6-brief-fit` is **red by
  construction** on every keyless floor (confirming the 338-0 claim on bytes).
- `src/lib/phases.ts:150-151` — `HITL_PHASES` / `STOCK_HITL = [4,5,8,9]`; pinned equal to the `PHASES` hitl
  flags by `phases.test.ts`.
- `src/lib/policy.ts:129-131` — `hitl.approve` `requiresHumanSeat:false`; `:134-136` `hitl.force` `true`;
  `:153-160` `fixtures.approve` `true`.
- `src/lib/headless.ts:612-626` — `canAutopilot` refuses `forceHuman`, `STOCK_HITL`, an unmet DoD gate, and a
  tight schedule (so the `gate --autopilot` walk **parks** at every stock gate); `:1397-1470` `approve()`
  defaults to `HARNESS_APPROVE_ACTOR` (`autopilot/harness`), routes through `evaluatePolicy("hitl.approve")`,
  and stamps `[seat harness]` + `decidedVia`.
- `src/lib/engine.ts:1762-1764` `approveHitl` throws for an autopilot seat on a `forceHuman` gate; CLI
  `scripts/rapidtool-cli.mjs:1567-1577` refuses `--seat autopilot` on a forceHuman gate with coded
  `RT_E_VALIDATION` before the driver.
- `src/lib/doctor.ts` — **no DoD-criterion surface**: it reads `archProductComplete`/`archTrace` and the
  fixtures census; it never prints `runGate` unmet criteria or `p6-brief-fit`.
- `src/lib/packet.ts:894-896` and `src/lib/handoff.ts:75-78,159` — both render the DoD checklist from the
  **static** `DOD[...]` criterion and use `gate.unmet` only for the `[x]/[ ]` flag.

### still open (before my edits)

1. `dod.ts` `p6-brief-fit` unmet message was stateless — no floor/model distinction. **MY file.**
2. `judgment.ts` rung 2 printed only probe ids (`P6 gate unmet (2 probe(s)): p6-verified, p6-brief-fit.`), so
   the verdict ladder did not carry the state either. **MY file.**
3. `packet.ts`/`handoff.ts` DoD checklist rows render the static criterion — outside my ownership.
4. `maker-score.ts:293` `p6BriefFitPasses` uses a **0.5** bar while `dod.ts`/`codegen.server.ts` use **0.35**
   (and its own comment at `:286-288` claims "verbatim: ≥ half"). Outside my ownership.

---

## 1. THE HONEST FLOOR DECISION (one paragraph)

**A keyless floor project can never pass `p6-brief-fit`, and it must not.** The criterion's subject is
brief-faithfulness of generated code; the deterministic placeholder implements phase bookkeeping only
(`sandbox.buildPhase6Module`), so it is *correct* that it fails — the defect was never the verdict, it was the
**message**. The prior bytes returned the bare static criterion, so a human staring at a red P6 could not tell
"no model synthesis ever ran" from "the model ran and dropped the nouns". I therefore made the criterion **name
the state**: on failure the unmet item now carries a state line distinguishing (a) the deterministic floor
with no keyed synthesis attempted, (b) the floor kept after a keyed synthesis refusal (model ran, no cycle
accepted — read from the `p6.synthesis.refused`/`p6.journey.exhausted` log rows), (c) a real single module, or
(d) a real tree whose union dropped the nouns — each with the missing nouns appended. The probe logic and the
0.35 bar are unchanged (parity with `codegen.server.ts:briefFitSatisfied` preserved), the evidence hash is
unaffected (it hashes `id:pass|fail`), and a legitimate brief-faithful module still passes (proven below). The
floor's red is now *explainable*, not vague.

---

## 2. FIX — `p6-brief-fit` names the floor state

**Files:** `src/lib/dod.ts`, `src/lib/judgment.ts`. Mechanism: `GateItem` gains optional
`unmetReason?: (p) => string` and result-only `reason?: string`; `runGate` evaluates `unmetReason` for each
FAILED item, appends it to the returned `criterion`, and exposes it as `reason`. Every consumer that prints
the recorded criterion (gate artifact `gateArtifact`, hard-DoD block `hardDodBlockInto`, red-seal digest in
`engine.ts`, CLI `summary.failedGates`) now carries the state automatically; `judgment.ts` rung 2 reads
`reason` explicitly.

### RED-first (Node 22.23.2, pre-fix bytes, final tests)

```
$ & "$env:LOCALAPPDATA\hermes\node\node.exe" --experimental-strip-types --test --test-reporter=tap src/lib/dod.test.ts src/lib/judgment.test.ts
    not ok 1 - the deterministic floor can never pass p6-brief-fit, and the unmet criterion NAMES that state
    not ok 2 - a refused keyed synthesis that kept the floor says the model ran but no cycle was accepted
    not ok 3 - a non-floor module that dropped the brief's nouns names THAT state, never the floor
    not ok 4 - keyed tree synthesis that dropped the nouns names the tree state
    not ok 6 - the recorded gate verdict and its artifact carry the same floor-state vocabulary
    not ok 1 - rung 2 names the deterministic floor state, not just the probe id
# tests 18 / pass 12 / fail 6
```
(The park-classification test passes pre-fix — it is an audit proof of existing disk behaviour, not a fix.)
Representative actual (pre-fix): `error: 'the verdict detail names the state'`
`actual: 'P6 gate unmet (3 probe(s)): p6-artifact, p6-verified, p6-brief-fit.'`

### GREEN (post-fix, both runtimes)

| suite | Node 22.23.2 | Node 24.15.0 |
|---|---|---|
| `dod.test.ts` + `judgment.test.ts` + `phases.test.ts` | **38 / 38 / 0 fail** | **38 / 38 / 0 fail** |

Baseline before this lane: 30 tests (all three files). **+8 tests**, all green.

### Real-bytes proof (scratch probe, `%TEMP%\rt339_3\probe.mjs`, no repo file)

```
P6 unmet ids: p6-artifact, p6-verified, p6-brief-fit
p6-brief-fit criterion: Brief-conformance: required brief nouns appear as identifiers in the generated source
  (single-module, or the union of the tree files in tree mode) — deterministic floor state — no keyed model
  synthesis ran; the P6 placeholder implements phase bookkeeping only and carries none of the brief's required
  nouns (missing: dispatch, board, service, techs, parts)
packet includes state string: true
gate artifact body includes state: true
```

So `judgment` (verdict detail), the recorded `PhaseRecord.gate.unmet`, the gate artifact, the hard-DoD block,
the red-seal digest, and the **packet** (via the gate artifact body) all read the state vocabulary. `packet.includes(...)` is `true`.

---

## 3. PARK / DoD CLASSIFICATION (read of the classification, not a keyed run)

| stop | kind | class | on-disk evidence |
|---|---|---|---|
| P4 `awaiting_hitl` | stock HITL (`STOCK_HITL=[4,5,8,9]`, `phases.ts:151`) | **machine-resolvable** | `policy.ts:129` `hitl.approve requiresHumanSeat:false`; `headless.approve` default `autopilot/harness` (`:1337`) → row `[seat harness]`; `dod.approved(p,4)` reads the ledger via `policyConsistentApproval`. Proven by the new test (below). |
| P5 `awaiting_hitl` | stock HITL | **machine-resolvable** | same seam; `p5-complete` reads `approvalActor()`. |
| P8 `awaiting_hitl` | stock HITL | **machine-resolvable** | same seam; `p8-complete`. |
| P9 `awaiting_hitl` | stock HITL | **machine-resolvable** | same seam; `p9-complete`. |
| P0 reframe park | `forceHuman` (engine.ts:772) | **genuine human decision** | `policy.ts:135` `hitl.force requiresHumanSeat:true`; `approveHitl` throws for autopilot (`engine.ts:1762`); CLI refuses coded (`rapidtool-cli.mjs:1567`). |
| P6 failed-sandbox park | `forceHuman` (engine.ts:990-996) | **genuine human decision** | same three guards. |
| P6 DoD block `p6-test` / `p6-source` / `p6-artifact` | deterministic floor proof | **met on the floor** (honest self-test) | `runGate(floor,6)` passes these; only `p6-verified` + `p6-brief-fit` stay red. |
| P6 DoD block `p6-verified` | needs a GREEN tree-run `tested` mint | **machine-resolvable IN PRINCIPLE**; blocked in W52 by the typing/oracle sibling defects (now fixed by 338-1b/338-2b per `338_0_parent.md` §3) | `dod.ts` p6-verified probe; `codegen.mintTreeRunTested`. |
| P6 DoD block `p6-brief-fit` | brief conformance of real code | **machine-resolvable by legitimate synthesis; unsatisfiable on the floor BY DESIGN** — now NAMED (§2) | `sandbox.buildPhase6Module` carries no brief identifiers. |
| P7 `p7-research` | live corpus or documented waiver | **machine-resolvable** (live) / waiver on the keyless floor | `dod.ts` probe `research>0 \|\| meta.liveUnavailable===true`. |

**Every machine-resolvable park is genuinely cleared by the machine door:** `approve --seat autopilot` maps to
`{decidedBy:"autopilot", seat:"harness"}` (`rapidtool-cli.mjs:1614-1618`), identical to `headless.approve`'s
default, and the resulting `[seat harness]` row is policy-consistent and satisfies the `*-approved`/`*-complete`
DoD criteria. `canAutopilot` (`headless.ts:612-626`) deliberately does **not** auto-clear a stock gate inside
the walk — that is *governed* autonomy (an explicit machine decision per gate), not a bug. **No `headless.ts`
change is required for this classification.** The `forceHuman` parks cannot be cleared by any machine seat.

### Test proving the classification (new, `judgment.test.ts`)

`339-3 (W53) — a stock park is cleared by the machine seat; a forceHuman park is not`: executes P4
(`applyPhaseResult(runToGate(seedProject(),4), 4)`), calls `approve(parked)` (default autopilot/harness),
asserts `p4-approved` is met, the ledger row is `decidedBy:"autopilot"` with note `[seat harness]`, and that
`approve` on a `forceHuman` gate throws `/forceHuman/`. Passes on both runtimes.

---

## 4. SATISFIABILITY AUDIT (every criterion I own)

Method: `runGate` probes over real engine-produced projects; `gates.test.ts`'s "gate P${phase} should pass on
a promoted full run" already proves **every** phase 0–12 DoD is satisfied by a legitimate run (re-run green
today, §5). The defect class ("can never pass" / "passes vacuously") audit:

| criterion | legit run can satisfy | floor/fake can satisfy | verdict |
|---|---|---|---|
| `p6-brief-fit` | **yes** (test #5: identifiers `dispatchBoard`/`fieldService` ≥ 0.35) | **no** — the placeholder has no brief identifiers (test #1) | **FIXED STATE MESSAGE** (§2) |
| `p6-verified` | yes (green tree-run mints `label:"tested"` + hash) | no (`self-test`/hashless/hollow stay red; `dod.test.ts` + `judgment.test.ts` rung 3) | sound (pre-existing) |
| `p6-arch` | yes (a real tree mapping every spec capability) | **passes vacuously when the tree is ABSENT** — a documented SKIP, explicitly *not* product-complete (`archProductComplete` = false; `dod.ts` probe comment) | **named, intentional skip** — NOT changed: making it fail would hard-break the keyless floor and is pinned by `gates.test.ts`/lesson-writers budget tests outside my ownership |
| `p0-brief-grounded`, `p6-brief-fit` (vocab-free brief), `p7-research` (waiver) | yes | vacuous pass documented as intended | sound (pre-existing, documented) |
| all other structural criteria (`p0-*`,`p1-graph`,`p2-*`,`p3-mcp`,`p4-*`,`p5-*`,`p6-test/-source/-artifact`,`p7-competitors`,`p8/p9/p10/p11/p12`) | yes (promoted full run passes every phase) | a deterministic floor also satisfies them because the floor genuinely produces the artifact — that is the honest floor, not a fake | sound |

**No criterion I own is unsatisfiable by any run**, and none is vacuous beyond the documented cases.
`p6-brief-fit` was the one with a broken *message*, now fixed; its anti-vacuity is proven by test #1 (floor)
and its satisfiability by test #5 (real module).

---

## 5. REGRESSION EVIDENCE (read-only runs, no edits)

Targeted extra runs to confirm the `runGate` change did not disturb consumers (Node 22.23.2):

| suite | result |
|---|---|
| `gates.test.ts` + `lesson-writers.test.ts` + `honesty-guards.test.ts` + `packet.test.ts` + `handoff.test.ts` | **217 / 217 / 0 fail** |
| `wild-step.test.ts` + `knowledge.test.ts` + `store.test.ts` + `maker-score.test.ts` + `engine.test.ts` | **275 / 275 / 0 fail** |
| `npx tsc --noEmit` filtered to my files | **0 errors** (repo-wide: 1 error, `prompt-engine.test.ts(89,9) TS7022` — sibling WIP on `prompt-engine.ts`, not mine) |
| `npx eslint` on my 6 files | **exit 0, 0 warnings** |

---

## 6. MOCK / FAKE CENSUS (owned files + tests)

Pattern scan `TODO|FIXME|@ts-ignore|@ts-expect-error|@ts-nocheck|as any|catch {}|placeholder|mock|fake` over
`dod.ts`, `judgment.ts`, `dod.test.ts`, `judgment.test.ts`:
**0 prohibited constructs added.** Every hit is pre-existing and honest: the product's `TODO(E-15)` contract
markers (`dod.ts:224/240/248/250/448/449/451/748/752`), the deterministic-floor "placeholder" doc prose
(including my new accurate comments), and one "no mocks" test-header comment. No `as any`, no `@ts-ignore`, no
silent `catch {}`, no hardcoded fake computation, no unfalsifiable test (the six new message tests fail on
pre-fix bytes — §2).

---

## 7. STOP-and-REPORT (outside my ownership — exact shape)

1. **`src/lib/packet.ts:894-896`** (owner: packet lane 338-5). The DoD checklist rows render the **static**
   `DOD[...].criterion`, using `gate.unmet` only for the `[x]/[ ]` flag, so a red row does not itself name the
   state (the state currently reaches the packet only via the trimmed gate-artifact body). Exact shape:
   ```ts
   const unmetById = new Map(gate.unmet.map((g) => [g.id, g]));
   const dodRows = (DOD[phase.id] ?? []).map((item) => {
     const u = unmetById.get(item.id);
     return `- [${u ? " " : "x"}] ${u?.criterion ?? item.criterion}`;
   });
   ```
2. **`src/lib/handoff.ts:75-78,159`** (owner: handoff/packet lane). Same static-criterion rendering; same
   shape: prefer the unmet item's augmented `criterion` for red rows.
3. **`src/lib/maker-score.ts:287-294`** (owner: 338-4 / maker-score). **PARITY DEFECT:** `p6BriefFitPasses`
   uses `Math.ceil(required.length * 0.5)` while `dod.ts:736` and `codegen.server.ts:3258` use `* 0.35`, and
   its comment claims "verbatim: ≥ half". A module with 0.35–0.49 coverage passes `p6-brief-fit` and the
   codegen pre-acceptance but is scored M1 "fails p6-brief-fit". Fix: `* 0.35` (keep `max(1, …)`) and correct
   the comment. **Not edited — not my file.**
4. **`src/lib/doctor.ts`** (owner: 338-3). The doctor has **no DoD-criterion surface** — its factory gaps are
   a different vocabulary (leftover jobs / human fixtures / product-complete bar). If the doctor is to name
   the floor, it needs a new read of `runGate(p,6).unmet.find(id==="p6-brief-fit")?.reason` (or
   `failedGates`). Observation, not a defect in my scope.

---

## 8. WHAT I DID NOT DO, AND WHY

- Did not touch `codegen.server.ts` / `briefFitSatisfied` (READ ONLY, 339-2) — my probe keeps the 0.35 bar and
  the `identifierHits` semantics byte-compatible, so no cross-lane parity change was needed.
- Did not change `p6-arch`'s absent-tree skip, `p7-research`'s waiver, or any other documented vacuous pass —
  changing them would hard-break the keyless floor and is pinned by suites outside my ownership.
- Did not edit `packet.ts` / `handoff.ts` / `doctor.ts` / `maker-score.ts` / `headless.ts` — §7 reports them.
- Did not run the full gate (`npm test` / `npm run build` / `bash scripts/gate.sh`), no keyed calls, no
  `npm run eval`; all scratch under `%TEMP%\rt339_3\`; no tracked file deleted; no secret printed.
- Did not edit `src/lib/prompt-engine.ts` (sibling WIP) or the repo-wide `prompt-engine.test.ts` TS7022.

**Coordination note (parity):** `dod.ts`'s `p6-brief-fit` probe and `codegen.server.ts`'s `briefFitSatisfied`
remain in parity on the decisive numbers (`max(1, ceil(required × 0.35))`, `identifierHits`). Only the *unmet
message* is new, and it lives in `dod.ts` — `codegen.server.ts` is untouched.

---

## 9. RESUME (one-time maker-score ownership grant) — STOP-and-REPORT §7 item 3 RESOLVED

**Resume scope (STRICT):** `src/lib/maker-score.ts` + `src/lib/maker-score.test.ts` only (both confirmed to
exist). `dod.ts` / `judgment.ts` / `phases.ts` untouched — no test I touched required a change. At resume start
`git status --short` showed BOTH owned files unmodified (only this log is untracked).

### 9.1 Decision — SHARED criterion; the 0.5 bar was a real divergence (not a distinct bar)

Evidence on bytes:

| site | bar | bytes |
|---|---|---|
| `dod.ts` `p6-brief-fit` probe | **0.35** | `hits.length >= Math.max(1, Math.ceil(required.length * 0.35))`; comment "322 X1 (P6-C, parent pick): ½ → 0.35" |
| `codegen.server.ts` `briefFitSatisfied` | **0.35** | `need = Math.max(1, Math.ceil(required.length * 0.35))`; doc "KEEP IN PARITY with dod.ts's p6-brief-fit probe" |
| `maker-score.ts` `p6BriefFitPasses` | ~~0.5~~ → **0.35** | comment claimed "(dod.ts), verbatim: ≥ half"; bytes used `Math.ceil(required.length * 0.5)` |

All three sites read the SAME helpers (`briefNounHits(...).required`, `identifierHits`) and the SAME predicate
shape `hits >= max(1, ceil(required × bar))`; only the constant differed, and maker-score's own header states the
intent ("the SAME helpers dod.ts probes use, so the rubric never drifts from the engine's own p6-brief-fit …
semantics"). `codegen.server.test.ts:390-402` pins the shared boundary (`ceil(20×0.35)=7 — six hits are one
short`) with "KEEP IN PARITY with dod.ts's p6-brief-fit probe (same 0.35 bar)". maker-score's 0.5 was therefore
the stale pre-322-X1 half-bar and its "verbatim: ≥ half" comment was the false half of the story.
**Option chosen: real divergence — align to 0.35 and correct the comment** (no distinct-bar pin needed).

### 9.2 RED-first (pre-fix bytes, both runtimes)

New boundary test — 20 required brief nouns, sources carrying exactly 7 vs 6 as code identifiers:

```
$ node --experimental-strip-types --test --test-reporter=tap src/lib/maker-score.test.ts     # Node v24.15.0
not ok 7 - single-module bar is the shared p6-brief-fit 0.35 bar — ceil(20×0.35)=7, six hits fail / seven pass
      error: 'seven hits meet the 0.35 bar'
      expected: true
      actual: false
# tests 80 / pass 79 / fail 1

$ & "$env:LOCALAPPDATA\hermes\node\node.exe" --experimental-strip-types --test --test-reporter=tap src/lib/maker-score.test.ts
not ok 7 - single-module bar is the shared p6-brief-fit 0.35 bar — ceil(20×0.35)=7, six hits fail / seven pass
      error: 'seven hits meet the 0.35 bar'   expected: true   actual: false
# tests 80 / pass 79 / fail 1
```

### 9.3 Fix (exact bytes)

`src/lib/maker-score.ts` — constant + comment:

```diff
-/** The p6-brief-fit probe semantics (dod.ts), verbatim: ≥ half (min 1) of the
- *  brief's required nouns appear as identifiers in `source`. Vocabulary-free
- *  briefs pass vacuously. */
+/** The p6-brief-fit probe semantics (dod.ts's probe and codegen.server.ts's
+ *  briefFitSatisfied), verbatim: ≥ 0.35 (min 1) of the brief's required nouns
+ *  appear as identifiers in `source`. 322 X1 (P6-C) recalibrated the bar ½ →
+ *  0.35 on all three sites; this function previously kept the stale half-bar
+ *  while claiming parity. Vocabulary-free briefs pass vacuously. */
 export function p6BriefFitPasses(brief: string, source: string): boolean {
   const required = briefNounHits(brief).required;
   if (required.length === 0) return true;
   const hits = identifierHits(required, typeof source === "string" ? source : "");
-  return hits.length >= Math.max(1, Math.ceil(required.length * 0.5));
+  return hits.length >= Math.max(1, Math.ceil(required.length * 0.35));
 }
```

`src/lib/maker-score.test.ts` — added `p6BriefFitPasses` to the maker-score import and one test asserting
`p6BriefFitPasses(brief, 7-noun src) === true` / `(…6-noun src) === false` plus `m1Substance` M1=1 and the
`scoreMaker` card M1=1 at the boundary (mirrors the codegen parity fixture's 20-noun list). `git diff` is
confined to these two files.

### 9.4 GREEN (post-fix, both runtimes)

| runtime | result |
|---|---|
| Node v24.15.0 | **80 / 80 / 0 fail**, exit 0 |
| Hermes Node v22.23.2 | **80 / 80 / 0 fail**, exit 0 |

### 9.5 What I did NOT do

- Did not touch `dod.ts` / `codegen.server.ts` / `judgment.ts` / `phases.ts` or any other file; `git diff`
  is confined to `maker-score.ts` + `maker-score.test.ts`.
- Did not change the 0.35 constants in `dod.ts` / `codegen.server.ts` (other lanes own them).
- Did not run the full gate — only `src/lib/maker-score.test.ts` on both runtimes (no other suite touched).
- No mock/fake/placeholder code; no keyed calls; no tracked-file deletion; no scratch files needed (none
  written outside `%TEMP%\rt339_3\`).
