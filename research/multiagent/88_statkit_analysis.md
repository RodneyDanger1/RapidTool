# 88 — StatKit Library Verdict (Flash Analyst A3)

> **Scope**: Honestly score the "StatKit" library output of the RapidTool pipeline against the best OSS stats libraries, dissect *why* the pipeline produced it as it did (engine file:line trace), and specify self-learning-loop improvements with exact module hooks.
> **Read-only analysis.** Evidence files: `C:/Users/mnril/rapidtool-make-3/statkit.json` (final project state, 84,549 B), `C:/Users/mnril/rapidtool-make-3/journey.md` (CLI run log, 403 lines), `C:/Users/mnril/AppData/Local/hermes/cache/delegation/live/deleg_9bd5d956/task-2.log` (delegation driver log), RapidTool engine source under `Desktop/RapidTool Main/src/lib/`.
> **Date**: 2026-09-06. All scores are evidence-traced; nothing below is inferred without a citation.

---

## 0. TL;DR

- The pipeline **never produced a statistics library**. The "StatKit" run (brief: *"a tiny math/statistics library with mean, median, stddev, and percentile functions, zero dependencies, full JSDoc"*) completed all 13 phases with **zero statistics content**: the word `median`/`percentile`/`stddev` appears in the whole 84 KB project state only inside echoes of the brief itself (3 hits each); no math function, no JSDoc, no test of any formula exists anywhere.
- What it *did* produce is a coherent-but-empty **web-job skeleton for the engine's own demo domain**: lattice `jobs:["deliver-core-workflow"]`, entities `operator/record` (`statkit.json → lattice`), a 6-file spec graph of `src/domain/custom_software.ts → src/api/routes.ts → src/state/store.ts → src/jobs/deliver_core_workflow.ts → src/ui/console.tsx → tests/oracle.spec.ts` (`statkit.json → specGraph`), contracts `Operator/Record/DeliverCoreWorkflow {id:ulid, status:enum, updatedAt:datetime}` + `POST /v1/deliver-core-workflow` (`contracts`), an oracle of 2 web-job cases (`oracle`), and a machine-"tested" `synthesize()` stub whose self-tests assert **HITL phase-guard logic, not math** (`generatedSource`, `lastTest`).
- **No scaffold file was ever written to disk** (`rapidtool-make-3/` contains exactly `journey.md`, `rt.sh`, `statkit.json`); the run's own DoD machine-verification probe FAILED (P6 gate), the final `verify --apply` crashed with an engine bug (`journey.md:389-403`), and the delegation driver exhausted its iteration budget before any fix/emit (`task-2.log` 13:23:15 final).
- **Honest scores (as a library deliverable)**: API design **1**, math correctness **0** (nothing exists to be correct), tests **1**, docs **2**, packaging **2** → **overall ≈ 1.2/10, FAIL**. Competitor baseline: simple-statistics **9.6/10**, jStat **6.8/10**.
- **Root cause (one sentence)**: RapidTool's A1–A8 algorithm layer and its single P0–P12 phase catalog are hard-wired to *agent-tool/web-job* semantics (`src/lib/algorithms.ts`, `src/lib/phases.ts`); a brief that yields no job-vocabulary hits trips the honest `vague` flag → canned fallback domain (`algorithms.ts:200-204`) → every downstream stage then spec's, contracts, oracles, researches, crew-mandates and "verifies" the fallback, and a completion-seeking HITL approver approves the reframe instead of tightening the brief.

---

## 1. Method & evidence inventory

| Evidence | Location | What it proves |
|---|---|---|
| Full run state | `rapidtool-make-3/statkit.json` | lattice, scorecard, specGraph, contracts, oracle, crew, generatedSource, lastTest, research, memory, decisions, logs, artifacts |
| CLI log | `rapidtool-make-3/journey.md` | gate PASS/FAIL sequence, crew PASS, `verify --apply` crash |
| Driver log | `…/deleg_9bd5d956/task-2.log` | driver intent, approvals, iteration-cap final |
| Engine source | `Desktop/RapidTool Main/src/lib/*.ts` | A1–A8 implementations, phase graph, scaffold emitters, DoD probes, verify harness |
| Competitor source (fetched 2026-09-06) | GitHub raw `simple-statistics/simple-statistics@main`, `jstat/jstat@1.x` | canonical implementations, tests, package metadata |

**Term-count check on the produced artifact** (evidence that no stats content exists):
```
median/percentile/stddev in statkit.json (case-insensitive): 3 hits each = brief echoes only
statistics: 29 hits — all in phase titles/"custom-software" marketing research, none in code
```

---

## 2. What the pipeline actually produced for "StatKit"

### 2.1 The governance shell (internally coherent, wrong product)

| Field (statkit.json) | Content | Assessment |
|---|---|---|
| `lattice` | `{jobs:[deliver-core-workflow], entities:[operator,record], constraints:[], nodes:[], complexity:3, vague:true}` | The engine honestly flags the brief as **vague** — the *only* place the run admits the brief didn't fit |
| `scorecard` | overall 7.2, verdict **reframe**; axes notes all canned ("Stateless workers + durable checkpoints."…) | Evaluates the *tool's* architecture, not the brief |
| `specGraph` | 6 files: `src/domain/custom_software.ts`, `src/api/routes.ts`, `src/state/store.ts`, `src/jobs/deliver_core_workflow.ts`, `src/ui/console.tsx`, `tests/oracle.spec.ts` | HTTP-app shape; a stats lib needs `src/index.ts` + function modules, not routes/console/store |
| `contracts` | Entities Operator/Record/DeliverCoreWorkflow (`id:ulid status:enum updatedAt:datetime`); endpoint `POST /v1/deliver-core-workflow` | 100 % engine demo-domain; zero relation to `mean/median/stddev/percentile` |
| `oracle` | `orc-1 job.deliver-core-workflow.happy` ("200 + persisted entity + checkpoint written"), `orc-phase graph.no-skip` | Web semantics; no numeric/reference-value oracle exists as a concept |
| `crew` | architect/implementer/reviewer/tester mandates all reference schema/routes/contracts/oracle | Roles and mandates assume a web-job deliverable |
| `research[]` | 3 DuckDuckGo queries — see §4.8 | Market-drivel; one *real* hit (Swift `JimmyMAndersson/StatKit`) ingested and ignored |
| `generatedSource` | `synthesize(spec)` stub: `JOBS=["deliver-core-workflow"]`, `REJECTION=""`, tests `test_happy`/`test_no_skip`/`test_rejection_addressed` | Machine-verified module tests **phase-guard rules**, not statistics |
| `lastTest` | `{ok:true, detail:"tests.pass"}` — **no `label`/`evidenceHash`** | Fails the engine's own E-07 machine-verification probe (`src/lib/dod.ts:150-165`) |
| `memory` | 18 rows, all `source:"engine"` bootstraps about the tool's own rules | Nothing from research/brief ever became packet memory |
| `phases[].gate` | P0 `passed:false` (reframe unmet), P6 `passed:false` (machine-verification unmet) — yet all phases `status:complete` | DoD gates are advisory under the approve path (§4.11) |
| `decisions` | 5 approvals `decidedBy:"human"`, incl. `hitl-0 "Reframe the brief"` with `note:null` | HITL approval carried **no rationale** (§4.3, §6) |

### 2.2 Files on disk after the run

```
rapidtool-make-3/
├── journey.md   (12,908 B — run log)
├── rt.sh        (318 B — env-key wrapper the driver wrote)
└── statkit.json (84,549 B — project state)
```
The scaffold emitter exists (`scaffoldProject`, `src/lib/scaffold.ts:971`, summary says *"write them to disk with the emit command"*, `scaffold.ts:1080`), but the CLI log shows only `gate`/`approve`/`crew`/`verify` commands — **the emit step never ran**. What *would* have been written, per the emitters, is: typed-entity interfaces, an HTTP `route()` that `throw new Error("TODO(E-15 stub): …")`, a `CheckpointStore`, a `runJob0` stub throwing TODO, a `CliContext main()` stub throwing TODO (the `library` kind gets the non-webapp flavor, `src/lib/scaffold.ts:552-633`), and `tests/oracle.spec.ts` with 2 pinned `{todo:true}` tests (`scaffold.ts:634-668`). All stubs are honestly marked — but there is no path from these templates to `mean/median/stddev/percentile`.

---

## 3. Competitor baseline (best OSS stats libraries, cited)

### 3.1 simple-statistics — primary comparison target
- Repo/npm (fetched 2026-09-06): **3,519 ★**, 237 forks, v**7.11.0** published **2026-08-29**, 84 releases, **1,364,895 npm downloads/week**, zero runtime dependencies, ISC, dual CJS/ESM + `.d.ts` + unpkg min (`package.json` @ main branch; `registry.npmjs.org`).
- Shape: 102 src modules (function-per-file) + 81 test files (`api.github.com/…/contents/src` and `/test`).
- Verified implementations:
  - `quantileSorted` — R-7 / numpy-linear: `idx=(n-1)*p`; throws on `p∉[0,1]` and empty input; p==0/1 shortcuts; linear interpolation (`src/quantile_sorted.js`). JSDoc states the convention explicitly ("type=7 in R/numpy… default in numpy.percentile and R's quantile") with a worked example.
  - `median = +quantile(x, 0.5)`; `medianSorted = quantileSorted(x,0.5)`; unsorted path copies + **quickselect partial sort** (O(n) not O(n log n)) (`src/quantile.js`, `src/median.js`, `src/median_sorted.js`).
  - `sampleVariance` — Bessel's correction via `sumNthPowerDeviations` (stable two-pass), throws when `x.length < 2` (`src/sample_variance.js`).
  - Tests: `test/median.test.js` covers empty-list throw, odd/even lengths, numeric (not lexicographic) sort, and **input immutability** via `Object.freeze`; `test/quantile.test.js` has interpolation vectors.
- Docs: JSDoc per function with external references + `@example`; generated docs site; typed signatures throughout.

### 3.2 jStat — secondary comparison target
- Repo/npm (fetched 2026-09-06): **1,806 ★**, v**1.9.6** (published **2022-11-21** — dormant ≈ 3.8 years), **991,649 npm downloads/week**, MIT, UMD.
- Verified implementations (`src/vector.js` @ `1.x`): `mean = sum/len`; `median` = sort + middle average (`!(arrlen & 1) ? (a+b)/2 : middle`); `variance(arr, flag)` divides by `n-(flag?1:0)` (Bessel when `flag=true`); `quantiles` = direct port of scipy.stats.mquantiles with default `alphap=betap=3/8` (a *different* quantile convention than R-7 — defensible but undocumented in-code); `percentile(arr, k, exclusive)` with `k∈[0,1]`, boundary branch drops interpolation (`index+1 < len` else `return _arr[index-1]`).
- Tests: ~115 test files across `test/core` (26), `test/vector` (34), distribution (22), linearalgebra (22), etc. — broad but legacy-style.

---

## 4. Honest scorecard: produced vs competitors

Scoring rule: produced artifact is scored **as a statistics library deliverable**, per the brief it was given. Every score cites evidence.

| Axis (0-10) | **StatKit (produced)** | **simple-statistics** | **jStat** |
|---|---|---|---|
| **API design** | **1** — No library API exists. Only API anywhere = `POST /v1/deliver-core-workflow` (`statkit.json → contracts.endpoints`); only "module" = `synthesize()` phase-guard stub (`generatedSource`). Zero exported stats functions; term-count §1. The would-be scaffold even routes `library` kind to a `CliContext main()` stub (`src/lib/scaffold.ts:552-633`). | **9** — function-per-module, uniform numeric-array signatures, `quantile` accepts scalar or array of p, sorted/unsorted variants, explicit R-7 convention, throws on empty/out-of-range (`src/quantile_sorted.js`). −1: percentile naming absent (quantile in [0,1] only). | **6** — namespaced `jStat.*`, readable mean/median/variance; dated flag-params (`variance(arr, flag)`), `percentile` k∈[0,1]+`exclusive` — API surface is a grab-bag. |
| **Math correctness** | **0** — No formulas exist to spot-check. Mission asked: *are median/percentile implementations correct?* — there is **no implementation**; the only executed "tests" assert `synthesize` phase-guard behavior (`generatedSource: test_happy/test_no_skip/test_rejection_addressed`), which has nothing to do with statistics. Cannot be correct; is absent. | **10** — R-7 interpolation verified line-by-line against numpy/R semantics incl. p∈{0,1} and non-integer index paths (`src/quantile_sorted.js`); median=quantile(0.5) consistent for even n (avg of middle two) (`src/median.js`); sample variance w/ Bessel via two-pass `sumNthPowerDeviations` (`src/sample_variance.js`). | **7** — textbook median correct (`src/vector.js:121`); variance Bessel behind `flag`; quantiles default `a=b=3/8` differs from numpy/R default (R-7) and `percentile`'s boundary branch skips interpolation — conventions never documented → footgun. |
| **Tests** | **1** — `logs: tests.pass` at P6 exists, but it executed the engine-authored `synthesize` stub in the `sync-template` sandbox, not library code (`statkit.json → logs, lastTest`). Oracle spec would be 2 `{todo:true}` stubs (`src/lib/scaffold.ts:634-668`). The run's own DoD machine-verification probe FAILED — `p6-verified` unmet, `lastTest` lacks `label`/`evidenceHash` (`src/lib/dod.ts:150-165`; `statkit.json → phases[6].gate`) — and `verify --apply` crashed before testing anything (`journey.md:389-403`). | **10** — 81 test files; evidence of rigor: empty-throw, even/odd, numeric sort, **input immutability** (`test/median.test.js`), interpolation vectors (`test/quantile.test.js`). | **7** — ~115 test files, broad (dists, linear algebra), but legacy assertion style, no typed property tests, dormant 3.8 y. |
| **Docs** | **2** — Coherent *governance* docs exist: ADR-001..003, OpenAPI, packet, per-phase artifacts, crew P12 review verdict PASS (`statkit.json → adr/openapi/artifacts; journey.md:327-388`). But they document the wrong product: the crew review checked "A6 contracts and A7 oracle" conformance only — no artifact anywhere references the brief's required functions, and **zero JSDoc** exists (brief demanded "full JSDoc"). README/DEPLOY exist only as emitter templates (`src/lib/scaffold.ts` readmeBody/deplyNotes). | **9** — JSDoc w/ @example + Wikipedia/MathWorld references per function, .d.ts, docs site, changelog. | **6** — docs site + API reference; stale in places, conventions undocumented. |
| **Packaging** | **2** — `kind=library` package config is defined (zero runtime deps, `@types/node`+`typescript` dev, `scaffold.ts:297,320`) and `tsconfig`/`.env.example`/`.rapidtool/project.json` templated — but **no file was ever emitted** (`rapidtool-make-3/` = 3 files; emit command never run per `journey.md`). Nothing to install; no ESM/CJS/types artifact exists. | **10** — zero-dep, CJS+ESM+types+unpkg min, ISC, 1.36M weekly downloads, 84 releases over a decade. | **8** — npm UMD, 991K weekly downloads; no official ESM/types. |
| **Overall** | **≈ 1.2 / 10 — FAIL** | **≈ 9.6 / 10** | **≈ 6.8 / 10** |

**Verdict nuance (fairness)**: this is a comparison of a *mature 10-year library* with a *single machine-run state file cut off at iteration cap*. The pipeline never claimed the library was implemented — every stub says `TODO(E-15 stub)`. The damning finding is therefore not "stubs exist" but that **the pipeline is structurally incapable of steering this brief anywhere near a statistics library** (§5), and that its own verification gate — the one mechanism that could have caught the empty result — failed and was bypassed rather than blocking (§4.11).

---

## 5. WHY: which pipeline stages produced what, traced to engine behavior

Stage map (each arrow = concrete file:line evidence in `Desktop/RapidTool Main/src/lib/`):

### 5.1 P0/A1 Intent Lattice — the origin of the wrong frame
- `LEX` vocabulary (`algorithms.ts:24-60`) contains only operations-tool words: actors `shop/tech/dispatcher/nurse/operator/patient…`, jobs `dispatch/quote/invoice/schedule/route/track/bill/scan…`. **`median`, `percentile`, `stddev`, `statistics` are absent.** `phraseHits` requires word-boundary stem matches (`algorithms.ts:133-142`) — so the brief yields **zero nodes**.
- Fallback fires: `vague = jobs.length===0 && entities.length===0` (`algorithms.ts:200`); `jobs: jobs.length ? jobs : ["deliver-core-workflow"]` and `entities: … : ["operator","record"]` (`algorithms.ts:203-204`). The engine's *own demo domain* becomes the project's domain. Design intent is documented at `algorithms.ts:197-199` ("the fallback arrays stay — A5/A6/A7 need ≥1 job; the honesty signal is the flag, not emptied arrays") — the flag is honest, but nothing downstream consumes it to change *what* gets built. **Evidence of output**: `statkit.json → lattice {vague:true, jobs:[deliver-core-workflow], entities:[operator,record]}`.

### 5.2 P0 scorecard — canned content + a verdict nobody can act on
- Axes/notes/bottlenecks/attack-vectors are static strings regardless of brief: `algorithms.ts:655-689` ("Stateless workers + durable checkpoints.", "Prompt injection via ingested competitor pages."…). Scores are formulas over lattice shape only (`feasibility/scale/security/api/delivery`, `delivery = vague ? 4 : …`, `algorithms.ts:652-656`).
- Verdict: `overall ≥7.5 proceed … else reframe`; **HR-1: `vague → reframe`** (`algorithms.ts:669-671`). Output matches: overall 7.2, verdict reframe.
- The reframe path is a HITL prompt: `engine.ts:334-340` — `forceHuman`, stakes "Feasibility below the proceed line", prompt "Scorecard verdict is reframe. Approve only if you accept the risk, or reject with a tighter brief." **In this run the "human" was the delegation driver whose success metric was "keep gates green / drive to complete"** (`task-2.log` kickoff line 7; approvals at 12:56:36). The driver approved (`statkit.json → decisions: hitl-0 "Reframe the brief", note:null`) — and the run proceeded on the fallback domain for all 12 remaining phases. The reframe gate is the right *intent* with the wrong *enforcement*: approval needs no reason, while rejection does (ADR-002, `journey.md:356`; asymmetric).

### 5.3 Phase graph — one catalog, and it's the tool's own
- `src/lib/phases.ts:1-103`: a **single fixed P0–P12 catalog** for every project: "P1 Core Orchestration & State Graph — LlmAgent intent nodes, WorkflowAgents, dispatcher topology, LiteLLM failover, transition validation" (P1 summary, `phases.ts:15-20`); "P3 Tool Integration & Interoperability", "P4 Security, Isolation & Authorization", "P6 Code Generation, Testing & Deployment", "P12 Documentation & Technical Specs". These are chapters of *building an agent platform* — the phase graph is domain-agnostic only in the sense that it applies the agent-tool graph to every domain. No library/package graph exists (`PHASES` fixed; `canEnter` strictly sequential, `phases.ts:110-130`). A math library was marched through 13 agent-tool phases, every one of which emits agent-tool artifacts.

### 5.4 A5 Spec Graph — hard-coded web-app file plan
- `planSpecGraph(lattice, domain)` (`algorithms.ts:398-446`): always `schema → api → store → job-N → ui → tests`, files fixed to `src/domain/<domain>.ts`, `src/api/routes.ts`, `src/state/store.ts`, `src/jobs/<job>.ts`, `src/ui/console.tsx`, `tests/oracle.spec.ts`. Signature has **no `kind` parameter** — `projectKindOf` (which correctly detects `library` from the word "library", `scaffold.ts:51-66,229-246`) runs *later*, only to pick package.json flavor. Output matches `statkit.json → specGraph` exactly.

### 5.5 A6 Contract Synth — field banks with no function concept
- `FIELD_BANK` (`algorithms.ts:448-475`) = `default/job/patient/invoice/order`, all `{id:ulid, status:enum, updatedAt:datetime}`-ish. `synthesizeContracts` names entities from `entities+jobs` and maps unmatched → default (`algorithms.ts:479-500`); endpoints are HTTP `POST /v1/<job>` (`501-505`). There is **no representation for "a function with a numeric signature"** anywhere in the contract model. Output: Operator/Record/DeliverCoreWorkflow + one POST endpoint (`statkit.json → contracts`).

### 5.6 A7 Test Oracle — web expectations only
- `buildTestOracle` (`algorithms.ts:510-535`): `job.<name>.happy` → "200 + persisted entity + checkpoint written"; constraint rows → "403 or 422"; plus a hard-coded `graph.no-skip` row. The oracle vocabulary has no "given input x, expect value f(x)" numeric form — the one oracle kind a stats library needs. Output matches `statkit.json → oracle`.

### 5.7 A8 Crew Router — mandates assume the web shape
- Role mandates reference the wrong product's artifacts: architect "Lock schema and routes for deliver-core-workflow before code" (`algorithms.ts:570`), implementer "Write files in Spec Graph order. Current edge: …" (`578`), reviewer "Approve only if A6 endpoints and A7 oracle are green" (`589`). The P12 crew run then PASSED exactly those checks (`journey.md:327-388`) — **no seat is mandated to diff output against the literal brief**, so a run that never built `mean/median/stddev/percentile` sailed through review.

### 5.8 Research — templated queries ignore brief and kind
- Query builder: ``phase===0 ? `${name} ${domain} architecture feasibility 2026` : phase===7 ? `… competitors market landscape` : `… live tools and API augmentation` `` (`engine.ts:1553-1555`; duplicated `headless.ts:118-119`). No brief words, no kind. Output (`statkit.json → research[]`): custom-software market reports, and — tellingly — the **real existing Swift StatKit** (`JimmyMAndersson/StatKit`) surfaced in result #2 of query 1 and was ingested as an artifact (`artifacts: research-0-1-…`) yet **never influenced the spec**. The engine even has `github-raw`/`github-api` harvest provenance (`harvest.ts:417,436`) — infrastructure for reference-source mining exists but is never pointed at reference implementations.

### 5.9 P6 codegen — deterministic engine stub instead of LLM codegen
- The run's `modelRoute:"deterministic"`, sandbox `"sync-template"`, `meta.liveUnavailable:true` (`statkit.json`): P6 ran the engine-template runner, which produced `generatedSource` = the `synthesize` oracle stub and recorded `lastTest:{ok:true, detail:"tests.pass"}` from its self-tests inside the isolate (`statkit.json → logs: tests.pass @ P6`). The scaffold would have hosted that stub verbatim via `emitGeneratedHost` (`scaffold.ts:535-545`) and TODO-throwing job stubs (`emitJobStub`, `514-533`).

### 5.10 P6 gate — the one honest brake, and it didn't brake
- DoD probe `p6-verified` ("Machine verification promoted a tested verdict (lastTest.label === "tested" with evidenceHash)") correctly FAILED (`src/lib/dod.ts:150-165`; `statkit.json → phases[6].gate {passed:false, unmet:[…]}`). Yet the phase's status is `complete` and P7 proceeded (`logs` P7 enter at +22 ms). Gate verdicts are recorded after completion (`phases[6].completedAt 1788717443255 < gate.checkedAt 1788717443272`) and are advisory under the HITL/approve path (human-only gates per `engine.ts:916,1057`). Same story at P0 (reframe unmet, still complete after approval). **Unmet DoD never blocked the run; it only annotated it.**

### 5.11 Verify crash — final check never ran
- `verify --apply` returned `{"ok":false,"status":"error","iterations":0,"evidence":"model returned an unparseable oracle payload","applied":true,"code":"RT_E_UNKNOWN","exit_code":4}` (`journey.md:389-403`). Root cause: `generateCases` parses the LLM oracle JSON once; on `parseOracleJson === null` it returns the error with **no re-prompt/repair** (`src/lib/verify.server.ts:470-484`), and the caller surfaces it as `RT_E_UNKNOWN` (`verify.server.ts:498-501`). Note `applied:true` alongside an error — an inconsistent verdict-record. A bounded re-prompt pattern already exists elsewhere (`planning.ts:17` "unparseable model JSON gets exactly ONE bounded re-prompt") — verify lacks it. The delegation driver captured the repro but exhausted its iteration budget before landing the fix (`task-2.log` final 13:23:15).
- **Compounding**: the only LLM-in-the-loop steps that ran were `crew` (P12 doc review, PASS — reviewed the wrong contract) and the crashed `verify`. So in the entire 13-phase run, **no LLM ever looked at the brief-to-artifact fit**.

### 5.12 Summary attribution table

| Quality observed | Produced by | Root engine cause |
|---|---|---|
| Honest `vague:true` + reframe verdict | P0/A1/A2 scorecard | `algorithms.ts:200,671` (good) |
| Wrong-domain fallback content | A1 fallback | `algorithms.ts:203-204` (vocabulary gap) |
| Web-app spec/contracts/oracle for a library | A5/A6/A7 | `algorithms.ts:398-446,448-507,510-535` (no kind, no function model) |
| Crew review PASS on wrong product | A8 + P12 crew | mandates `algorithms.ts:570-589`; no brief-conformance seat |
| Irrelevant research | P0/P7 research | `engine.ts:1553-1555` templated queries |
| Empty "tested" code | P6 deterministic run | sync-template runner; LLM codegen never invoked (`meta.liveUnavailable`) |
| Unmet DoD didn't block | P6/P0 gates | advisory gate semantics (`engine.ts:916,1057`; `dod.ts:150`) |
| Final verification absent | verify cmd | `verify.server.ts:482` no-retry parse bug |
| Nothing on disk | orchestration | emit step never reached (iteration cap) |
| Approvals without reasons | HITL | `engine.ts:334-340`; asymmetric note requirement (ADR-002) |

---

## 6. LESSONS

### 6.1 Persist-good (behaviors that worked and should be kept)
1. **Honest vagueness signaling**: HR-1 forces `reframe` on vague briefs (`algorithms.ts:671`) and P0 gates record the unmet criterion (`dod.ts:57`). The engine *knew* the brief didn't fit; the failure was downstream of that knowledge.
2. **Machine-verification DoD exists** (E-07, `dod.ts:150-165`) and correctly FAILED an unverified `lastTest` — the probe design (defensive shape, old payloads stay unmet) is exactly right.
3. **Honest stubs**: every emitted stub is `TODO(E-15)` and throws rather than faking behavior (`scaffold.ts:414-633`); oracle spec rows are pinned ids, never renamed (`scaffold.ts:634-668`). No hallucinated implementations.
4. **Anti-invention prompt discipline**: verify's oracle prompt forbids invented APIs/requirements and demands self-contained boolean expressions (`verify.server.ts:453-475`); sanitization of hostile graph/entity text before emission (`scaffold.ts` safeNodePath/ident).
5. **Bounded re-prompt pattern** exists in planning (`planning.ts:17,242`) — a proven repair strategy to copy elsewhere.
6. **Governance artifacts are coherent**: ADR/OpenAPI/packet/lattice traces are internally consistent and schema-validated — the pipeline's *process* output is high quality; its *product* output is empty.

### 6.2 Prevent-bad (each with its fix target)
1. **Vocabulary → domain fit gate**: a `vague` lattice must not silently inherit the demo job. Fix at the A1/A5 boundary (§7.2).
2. **Kind-blind algorithm layer**: A5/A6/A7 have no `kind`; `projectKindOf` (`scaffold.ts:229`) proves the words exist to detect a library at create time — use them in the planners.
3. **Canned scorecard**: axes/notes/bottlenecks must be kind-aware; a library's risk surface is numerical edge cases & API surface, not "OAuth scopes" (`algorithms.ts:660-689`).
4. **Templated research**: queries must embed brief nouns and kind (library → "API comparison", harvest reference implementations via existing `github-raw` provenance).
5. **Asymmetric HITL**: approving a `forceHuman` reframe/verification-failure gate with `note:null` should be illegal (mirror ADR-002's ≥12-char reason for rejections). `statkit.json → decisions` shows all 5 approvals carried `note:null`.
6. **Advisory DoD**: unmet P0/P6 criteria must hard-stop progress unless overridden with a stored reason — the current run completed with 2 failed gates and no blocker.
7. **Verify parse fragility**: one-shot JSON parse without retry/repair turned a fixable LLM hiccup into `RT_E_UNKNOWN` end-state (`verify.server.ts:482`).
8. **No brief-conformance review**: add a mandatory artifact-vs-brief diff (exports required by the brief exist; zero-dep honored; JSDoc present) before `complete`.
9. **Emit is optional**: scaffold emission is a separate, skippable command; the pipeline should treat *files on disk* as the deliverable and refuse `complete` without an emit+verify cycle against the emitted tree.

---

## 7. IMPROVEMENT PLAN + SELF-LEARNING LOOP (exact module hooks)

RapidTool already has the memory substrate: per-project memory rows ranked into every packet by **A2 `fusionRank`** at packet compile (`src/lib/packet.ts:145`), `KnowledgeStore` (append-only `brief|pattern|fix|note` store, `src/lib/knowledge.ts:31,122`, CLI at `src/lib/headless.ts:1477-1485`), harvest with provenance incl. `github-raw` (`src/lib/harvest.ts:417,588-612`), engine-provenance stamping (`engine.ts:266`), vault search (`src/lib/vault.ts:18-19`), and DoD probe tables (`src/lib/dod.ts`). The loop below reuses all of it — no new subsystems.

### 7.1 Phase 1 — Fixes that make this run's failure impossible (engine, deterministic)
| # | Change | Exact hook |
|---|---|---|
| 1 | **Kind-aware spec planning**: add `kind` to `planSpecGraph(lattice, domain, kind)` and, for `library`, plan function modules (`src/<name>.ts` exporting the brief-named functions) + `tests/<name>.test.ts`, skipping `api/store/ui` nodes | `src/lib/algorithms.ts:398-446`; callers at `algorithms.ts:703` and `engine.ts` runAlgorithms |
| 2 | **Library contract model**: extend A6 to emit `{fn, params, returns}` contracts from brief parse (regex/extraction of "mean, median, stddev, and percentile") instead of HTTP endpoints | `algorithms.ts:448-507` (`FIELD_BANK`/`synthesizeContracts`) |
| 3 | **Numeric reference oracles**: extend A7 with `given: <expression>, expect: <number-or-range>` rows (e.g. `median([1,2,3,4]) ≈ 2.5`) and seed them from reference implementations harvested via github-raw (simple-statistics/jstat) | `algorithms.ts:510-535`; reuse `harvest.ts:417` github-raw fetch + `harvestToMemory` provenance (588-612) |
| 4 | **Library scorecard**: kind-aware axes/notes (API-surface risk, numerical edge cases, zero-dep compliance) | `feasibilityScorecard`, `algorithms.ts:640-690` |
| 5 | **Hard-stop unmet DoD**: P0 reframe & P6 machine-verification FAILs block phase sealing unless a stored override w/ reason exists; gate verdict evaluated *before* `completedAt` | gate sequencing in `src/lib/engine.ts:916,1057` + `dod.ts` probe consumption |
| 6 | **Verify retry/repair**: on `parseOracleJson===null`, ONE bounded re-prompt (copy planning.ts pattern), then deterministic fallback | `src/lib/verify.server.ts:470-484` (`generateCases`) |
| 7 | **Brief-conformance DoD probe** `p6-brief-fit`: required exported names/JSDoc/zero-dep parsed from brief → probe over scaffolded files; add to P6 criteria table | `src/lib/dod.ts` near `p6-artifact`/`p6-verified` (lines ~139-165) |
| 8 | **Emit-before-complete**: `complete` requires `emit` ran and `verify` green on the emitted tree | headless run loop; emit per `scaffold.ts:1080` |
| 9 | **HITL symmetry**: `forceHuman` approvals require ≥12-char note (like rejections) | `engine.ts:334-340` HITL creation; decision records |
| 10 | **Research query templates per kind**: library → `"<brief nouns> javascript statistics library API comparison"` + github-raw harvest of top repos | `engine.ts:1553-1555`, `headless.ts:118-119` |

### 7.2 Phase 2 — Self-learning loop (store → retrieve → apply)
**STORE** (after any run/review — write lessons exactly where memory is stamped):
- Add lesson rows to the project's memory as `source:"engine"`/`"harvest"` rows via the same path that stamps E-18 provenance (`engine.ts:266`) and via `harvest.ts:606` row builder; persist durable lessons with `KnowledgeStore.add` (`knowledge.ts:122`, `NewKnowledgeEntry` `knowledge.ts:48`; kinds `pattern`/`fix` are the natural buckets).
- Concretely, this run should store (examples):
  - `pattern`: "A library brief (words: mean/median/percentile/…, kind detected via scaffold.ts KIND_KEYWORDS library:[sdk,package,library]) must never fall back to jobs=[deliver-core-workflow]; route kind=library to the function spec graph."
  - `fix`: "verify --apply RT_E_UNKNOWN 'unparseable oracle payload' = parseOracleJson null path, no retry (verify.server.ts:482); re-prompt once before failing."
  - `pattern`: "Approving a reframe HITL with note:null continues the run on the engine's fallback demo domain; require a tightened brief instead."
**RETRIEVE** — two exact injection points so lessons reach future prompts automatically:
- Global: seed the memory list passed to `fusionRank` with knowledge-store rows filtered by (domain | kind | LEX overlap) *before* ranking, so A2's existing ranking (`packet.ts:145`, `fusionRank` `algorithms.ts:232`) surfaces them in every future packet — i.e. lesson text lands inside phase prompts that are compiled from the packet (`src/lib/packet.ts` compile path incl. the ```json``` block discipline at `packet.ts:78`).
- Boot: extend `bootstrapMemory` (`algorithms.ts:600-622`) to inject the two highest-ranked lesson rows when `lattice.vague === true` — the exact condition this run tripped.
**APPLY**:
- Crew mandates gain a conformance clause sourced from the packet's brief checklist: append to the reviewer mandate template `"Diff artifacts against the literal brief deliverables list; approve only if every brief-named export exists with JSDoc and zero-dep packaging"` (`algorithms.ts:586-590`).
- P6 codegen for `kind=library` with a live model should run the **existing** `verifyAndFixServer` iterate loop (`verify.server.ts:490+`) against numeric oracle cases — the machinery to LLM-iterate code until oracle-verified exists but was never reached (deterministic run); wire it as the library P6 path.

### 7.3 Phase 3 — Measurement (close the loop)
- Add counters to the DoD/verify records: runs reaching `complete` with `p6-brief-fit` unmet → must trend to 0; verify parse-failure rate; % of packets that retrieved ≥1 lesson row. These are already observable from `statkit.json`-shaped state (`lastTest`, `phases[].gate`, `memory`) — no new telemetry surface needed.

---

## 8. Bottom line

- **Verdict**: FAIL as a statistics library (~1.2/10 vs simple-statistics 9.6, jStat 6.8) — not because of bad math or bad code, but because **no math or library code was ever produced**: the run is a complete, internally consistent, *governed* artifact stream for the wrong product, cut off before emission, with its final verification step crashed.
- **The single most valuable fix**: honor the engine's own `vague` signal by routing kind=library briefs to a library-shaped A5/A6/A7 pipeline and by making the P6 machine-verification + brief-conformance gates *blocking*, so an empty, wrong-shaped result can never again be marked `complete`.
- **Evidence trail**: every claim above resolves to `statkit.json`, `journey.md`, `task-2.log`, one of the cited `src/lib/*.ts` lines, or the fetched competitor sources (raw.githubusercontent.com simple-statistics@main, jstat@1.x; npm registry metadata; fetched 2026-09-06).
