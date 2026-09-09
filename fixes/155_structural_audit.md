# 155 — STRUCTURAL AUDIT (155-AUDITOR-A): why the factory cannot produce FUNCTIONAL software

Analyst: 155-AUDITOR-A · lane: deep structural audit, READ-ONLY (this file is the only write) ·
Date: 2026-09-08/09 · Evidence basis: disk state at audit time — `src/lib/{sandbox,scaffold,dod,codegen.server,maker-score,verify.server,compile-check.server,algorithms}.ts`,
`scripts/run-eval.mjs`, and the keyed run's own ledger `research/eval-out/coffeehouse2home-property-ledger/.rapidtool/project.json` + `research/eval-out/results.json`.
Prior logs read and referenced: fixes/145 (M7 proof), fixes/149_a5 (factory verdict), fixes/154_direction v1.2 (9/9 post-mortem, RC1-RC3).

**Concurrency attribution:** a 6-agent wave (154 F1-F4 + W) edits `src/scripts` while this audit runs; anchors below were read at audit time and may be mid-edit.
Where the disk already shows a post-9/9 fix (maker-score F1 floor gate, run-eval `synthesisSucceeded`) it is marked **FIXED-on-disk**; where a defect from fixes/154 is still live at read time it is marked **OPEN**.
`research/eval-out/coffeehouse2home-property-ledger/` on disk is a later emission (mtimes 09-08 19:59; `src/api/routes.ts` missing while `tests/oracle.spec.ts` still imports it) — the run's own persisted ledger (project.json) is used as the run-time record, not the volatile dir.

---

## 1. THE CENTRAL QUESTION, ANSWERED IN ONE LINE

Every machine gate on the brief→shipped path checks **bookkeeping, shape, or identifier presence** — no gate executes the shipped artifact against a **brief-derived behavior expectation** — so the minimal artifact that satisfies every green light is the deterministic no-op floor + scaffold stubs, and the LLM is asked only for a shape-compliant envelope whose content is never exercised end-to-end. Functionality is therefore unrepresentable in the loop's success predicate.

---

## 2. THE FLOOR — sandbox.ts `buildPhase6Module` — CONFIRMED no-op; oracle asserts the no-op

`src/lib/sandbox.ts:128-134` says it outright: *"Deterministic P0-01 NO-KEY floor module. It validates phase-bookkeeping only — it never implements the brief."*

The module it emits (sandbox.ts:135-171) is a self-consistent no-op:

```ts
// sandbox.ts:145-150
`function synthesize(spec) {`,
`  if (spec.phase < 0 || spec.phase > 12) throw new Error("invalid phase");`,
`  if (JOBS.indexOf(spec.job) === -1) throw new Error("unknown job");`,
`  if (REJECTION && spec.phase === 9) throw new Error("deploy blocked until rejection addressed");`,
`  return { ok: true, name: spec.name, job: spec.job, addressed: REJECTION ? true : false };`,
`}`,
```

Its own tests (sandbox.ts:151-169) round-trip the same predicate: `test_happy` asserts `synthesize({phase:6, job:JOBS[0]}).ok === true`; `test_no_skip` asserts an out-of-range phase throws. The **oracle for the keyless run asserts exactly this no-op**: scaffold.ts:1122-1151 emits `module.synthesize — a valid phase + known job returns ok` (`assert.equal(out.ok, true)`, `assert.equal(out.addressed, typeof boolean)`), `an out-of-range phase is rejected` (`assert.throws(… /invalid phase/)`), `an unknown job is rejected`, `the rejection note blocks phase 9`.

**What the floor deterministically CANNOT do** (characterization, from the emitted surface):
- **No domain logic** — the only inputs it inspects are `phase` (0..12) and `job` (membership in ≤5 lattice-job strings); the brief's nouns never appear as identifiers, so p6-brief-fit is *supposed* to fail it by construction (sandbox.ts:131-133) — but see §5: identifier gates are satisfiable by accident (job labels ARE brief-derived: `flip`/`record`/`track`/`show` are both lattice jobs and brief vocabulary).
- **No computation** — it returns constant-shaped `{ok:true, addressed:…}`; there is no arithmetic, no transform, no branch on any brief datum.
- **No persistence** — no store interaction, no checkpoint write (the CheckpointStore it is tested against is the scaffold's own in-memory `Map` stub, §3).
- **No I/O** — no network, no filesystem, no DOM; `runGenerated` (sandbox.ts:91) refuses any source that isn't the engine-authored template shape (`startsWith("const JOBS = [")` && `includes("function test_no_skip")`), so *only* the floor is executable in the sync sandbox; worker isolates are deprecated with zero product call sites (sandbox.ts:344-349).

**Structural consequence:** the floor is a valid *bookkeeping* oracle but an **anti-oracle for the brief**. A pipeline whose terminal green state is reachable by this module has no functional bar at all.

---

## 3. THE ORACLE — scaffold `emitOracleSpec` + A7 row authorship — self-truth, never brief-truth

**Row authorship (A7)** — `algorithms.ts:762-788 buildTestOracle(lattice)`. Rows are prose shapes, not executable expectations:

```ts
// algorithms.ts:764-770
id: `orc-${i + 1}`,  name: `job.${job}.happy`,
given: `Authorized operator submits “${job}” with a valid ${lattice.entities[0] ?? "record"}`,
expect: `200 + persisted entity + checkpoint written`,
// algorithms.ts:772-778  (constraint rows, only when lattice.constraints exist)
id: `orc-c-${c}`, given: `Request violates ${c}`, expect: `403 or 422; no side effect; diagnostic JSON`,
```

No row anywhere carries a **real input → expected output** for a brief requirement. The property-ledger run's persisted rows (project.json `oracle`, all 6) are exactly this: `orc-1 job.track.happy — … submits "track" with a valid buyer => 200 + persisted entity + checkpoint written` … and `orc-phase … => Illegal transition; no deploy artifacts`.

**What the emitted tests ACTUALLY assert** — `emitOracleSpec` (scaffold.ts:986-1328). The header comment (scaffold.ts:972-985) is admirably honest: *"nothing here pretends a stub satisfies its brief."* The four branches:
1. **Store truth** (scaffold.ts:1154-1184): `CheckpointStore` round-trips — write/read/replace of `{phase, status, updatedAt}`. This asserts the scaffold's own in-memory Map (eval-out `src/state/store.ts`), *not* the brief.
2. **Endpoint truth** (scaffold.ts:1186-1200): `assert.deepEqual(ENDPOINTS, <A6 contract>)` — table equality against the pipeline's own A6 output.
3. **A7 rows against a job endpoint** (scaffold.ts:1231-1249): for `orc-1..5` the emitted test is `await assert.rejects(route(ep.method, ep.path, {}), /TODO\(E-15\) stub/)` plus a `CheckpointStore` phase-6 round-trip. **The acceptance test for "operator submits track ⇒ 200 + persisted entity" asserts that the route REJECTS** — and that is the *green* expectation. Quoted verbatim from the run's shipped suite (`tests/oracle.spec.ts:59-73`):
   ```ts
   test("orc-1", async () => {
     // A7 row "orc-1" "job.track.happy" — Authorized operator submits “track” with a valid buyer => 200 + persisted entity + checkpoint written
     // Target seam: track (GET /v1/track). Today it is a TODO(E-15) stub — … this test FAILS the moment track is implemented, …
     const ep = ENDPOINTS.find((e) => e.job === "track");
     assert.ok(ep, "endpoint for the row's job must exist (contract drift)");
     await assert.rejects(route(ep.method, ep.path, {}), /TODO\(E-15\) stub/);
     const s = new CheckpointStore();
     s.write({ phase: 6, status: "sealed", updatedAt: "2026-01-01T00:00:00.000Z" });
     assert.equal(s.read(6)?.status, "sealed");
   });
   ```
   The suite goes green **because** the brief is unimplemented, and the emitter says so in a comment (scaffold.ts:1235-1236: *"Asserting that real current behavior: this test FAILS the moment ${job} is implemented"*). Green therefore means *stub still intact*.
4. **Rows with no surface** (scaffold.ts:1258-1266): `assert.ok(id.length > 0, "row id is pinned"); assert.ok(prose.length >= 0, "row prose recorded")` — asserting the pin, not the requirement (`orc-phase` in the run's suite, tests/oracle.spec.ts:139-146).

**The dead E-08 seam:** `dod.ts:713-719 oracleToCaseSeeds()` renders rows as `# orc-<id> <name> — <given> ⇒ <expect>` seed lines and dod.ts:706-711 documents that the verify loop *"prepend[s] oracleToCaseSeeds() to the generation prompt, then reject[s]/retr[ies] whenever missingOracleCaseIds() is non-empty"* — but **no production caller exists** (grep: defined in dod.ts, referenced only in `gates.test.ts`). `verify.server.ts generateCases` (512-588) builds its prompt (533-553) with the brief + source + grounding line and **never sees the A7 rows**. The emitted spec's own header (scaffold.ts:1030-1031, *"the verify harness seeds + pins orc-* ids across runs (E-08)"*) describes a seam the code does not wire. The A7 oracle is decoration: it feeds comments into stub files (scaffold.ts:681-688) and test names — never an executed expectation.

**No row asserts a brief requirement with a real input → expected output.** Confirmed by reading every emit branch.

---

## 4. THE SYNTHESIS ASK — codegen `p6SynthesisChunkUserPrompt` / envelope — shapes, not behavior

**The prompt's core instruction** (codegen.server.ts:394-404):

```
REQUIREMENTS (implement every one; mark the implementing function with the matching // req-N comment):
1. <requirement prose>
TYPE SIGNATURES (must export — exactly these names, nothing more, nothing less):
- function createProperty(…)
…
EDGE CASES (behave sensibly inside existing functions; do NOT add APIs for them)
```

Behavior is *requested* in prose ("implement every one") but the **machine-readable contract is a shape contract**: the model must return an envelope of `module` (source string) + `exports` (names) + `reqTrace` — a `Record<req-N → exported name>` (codegen.server.ts:548-556). `reqTrace` maps a requirement id to a **name**, never to an input→output pair; nothing in the envelope can express "createProperty({address}) returns a record with id/ownership/history". The requirement prose itself is never operationalized into assertions anywhere in the prompt — no example inputs, no expected outputs, no acceptance fixtures. The follow-up prompts repair only *shape* defects: export-binding, soft-forbidden primitives, missing signature names, brief-vocabulary identifiers (codegen.server.ts:201-335; 1238-1252, 1255-1272).

**What the model output must survive (all shape-level):**
- `validateSynthesisModule` (codegen.server.ts:661-702): non-empty module, ≤60k chars, no fences, no forbidden primitive in code, **every claimed export bound** (`module.exports.x =` or top-level declaration — regex-scanned, codegen.server.ts:613-624), every typeSignature function name present in the exports list.
- `briefFitSatisfied` (codegen.server.ts:709-714): ≥ half (min 1) of the brief's required nouns appear **as sub-identifiers in code**.
- **Single-module path only** (kind-absent, ≤8 sigs — codegen.server.ts:1156-1158): machine verify via `verifyAndFixServer` (codegen.server.ts:1300-1303). **The chunked tree path has NO machine verify at all** — declared at codegen.server.ts:1339-1341: *"No machine verify here — per-file deterministic validation is the mechanical floor; the tree machine-run is the tree-run lane's step (never a fabricated pass)."*

**Consequence:** a model may return functions whose bodies are `throw new Error("todo")`, empty stubs, or hallucinated semantics — as long as the names bind, no forbidden token appears, and ≥half of the brief's nouns occur as identifier substrings (achievable by naming parameters/helpers after brief nouns), **every deterministic gate passes**. The only behavioral net (verify.server's LLM-written boolean expressions over exports, §6) is (a) skipped entirely for chunked trees, and (b) for the single-module path is authored by the same model family from the same source it is testing, grounded only by identifier presence (`oracleBriefGrounded`, verify.server.ts:487-510).

**The empty-content refusal (the run's actual behavior):** pro-tier calls send `thinking:{enabled} + reasoning_effort:"high"` **and** `response_format:{json_object}` (deepseek.server.ts:333-334) with, at run time, `max_tokens: 8192`; an empty `content` becomes `RT_E_LLM_REJECTED · DeepSeek returned no text content` with reasoning/finish_reason diagnostics (deepseek.server.ts:378-392). The run's ledger: cycle 1 `chunk 1/2 refused`, cycle 2 `chunk 2/3 refused` — both `DeepSeek returned no text content` (project.json logs, quoted in fixes/154_direction §1). So on the keyed runs the LLM produced **no complete content**; the refusal path then *left a runnable partial/floor 1-file tree on the project* (codegen.server.ts:1488-1507 `partialTreeRefuse` keeps accepted chunks real; the cycle-2 partial entry was the assembled 1-file `src/generated.ts` that later "ran green") — the refusal-to-floor leak RC3 of fixes/154.

---

## 5. THE CORPUS→TEST GAP — capability coverage is identifier-presence only, never executed behavior

**Corpus expectations are prose.** The eval corpus entry (`research/eval-corpus/coffeehouse2home-property-ledger.md`) carries 7 `expectedCapabilities`, each a prose paragraph (e.g. *"Flip manager: acquisitions, renovation budgets with line items, contractor bids, flip project phases, job costing per property"*), plus `expectedNouns` and a prose `acceptance`. Nothing in the corpus is executable.

**The machine probe is a stem search.** `maker-score.ts capabilityCoverage` (235-257): for each capability, `formsForCapability` (183-193) = the full label + its tokens + canonical stems; a file "covers" a capability when `identifierHits(forms, source)` — case-insensitive **sub-identifier** match in masked code (sandbox.ts:251-260) — or the **file path** contains a form. M1 in tree mode (maker-score.ts:281-299) is 1 when no capability is missing; the vacuous case is even explicit (284-289): *"no expectedCapabilities demanded — substance vacuously satisfied."*

**The scaffold's own capability rows admit the proxy** (fixes/150 G2 — scaffold.ts:1270-1326). Section 5 of the oracle spec re-reads emitted files with `readFileSync` and asserts any demanded form appears in path or raw text (scaffold.ts:1296-1306); the emitted assert message (scaffold.ts:1320) says verbatim: *"Identifier presence is a PROXY: this row checks name/source-text presence only, never behavior."* Two structural facts:
- **Corpus capabilities never reach the emitted spec.** The rows exist only when the project carries an `implementationSpec` with demanded capabilities (scaffold.ts:1010-1014 byte-parity pin when absent; `capabilityDemands` scaffold.ts:943-969). The property-ledger run's ledger has **no implementationSpec at all** (`hasImplSpec: false` in project.json) — so corpus expectations were never in any gate; M1 was computed **post-hoc** by run-eval over the persisted tree (run-eval.mjs §5, `capabilityCoverage(finalProject, entry.expectedCapabilities)`).
- **Where they do exist, they're stems.** `contains-identifier` is also the only "claim" kind the fixes/152 post-hoc gate can verify (sandbox.ts:496-507).

**Proof of vacuity from the run itself:** the 9/9 scorecard's M1 claims all 7 capabilities → `src/generated.ts` (results.json `coverage.covered`), while the machine's own stricter p6-arch probe on the same run recorded `dod.reqtrace: p6-arch FAIL · tree (1 file) · missing: track, flip, publish, sync, rent, bid` (project.json logs; fixes/154 §1). One shared noun (`property`/`record`) satisfices the permissive eval probe; the strict DoD probe disagrees. Two identifier probes, two verdicts, neither executed anything.

---

## 6. THE VERIFY — "machine-verified" today = compile + self-truth tests; not behavioral

**The p6-verified criterion** (dod.ts:337-355) is met by `lastTest.label === "tested"` + a non-empty `evidenceHash`. The mint `applyTreeRunTestedMint` (headless.ts:1381) fires from a **green treeRun** verdict.

**What treeRun actually executes** (compile-check.server.ts:205-242): (a) per-file parse (`compileCheckDir`, "does every emitted file PARSE" — :207), (b) each `tests/*.spec.ts` under the real `node --test` runner (:332-362), (c) a kind-entry smoke that for **webapp/game is an honest SKIP** (:232-236, 517-521: *"a root index.html means webapp/game (vite boot shell — "UI shell — not executable headless", an honest skip)"*).

The property-ledger run's own mint evidence (project.json lastTest): `"tree-run green: compile 12/12 file(s) · 1 spec file(s) pass · 10 assertion(s) · entry webapp skip"`. Decompose the "10 assertions": 3 CheckpointStore round-trips + 1 ENDPOINTS-table equality + 6 A7 rows that assert **stub-rejects and pin-strings** (tests/oracle.spec.ts:25-146, §3). So:
- The shipped webapp's **entry never executed** ("entry webapp skip") — the app was never run.
- The 10 green assertions certify the scaffold's own stub infrastructure against itself.
- **No assertion referenced the generated tree's content**, let alone the brief's ledger/showing/payroll semantics. In tree mode the only tree-content test is `tree.entry — … loads and cross-file imports resolve` + `exports real names` (scaffold.ts:1096-1101): loadability, not behavior.

**Machine-verified = compile + module-truth + stub-truth.** The one genuinely behavioral machine runner that exists — verify.server `runCases` evaluating LLM-authored boolean expressions over exports (verify.server.ts:381-451, e.g. `add(2,3) === 5`) — is (a) never seeded by A7 rows (dead E-08 seam, §3), (b) skipped on the chunked-tree path by design (§4), and (c) reachable only through the kind-absent single-module path that the property-ledger run's codegen dispatch would not even use for a declared webapp (codegen.server.ts:1156-1160). **And the journey never required it**: `driveP6Journey` converged on `verdict.ok === true` (headless.ts:1374-1397) and returned `outcome:"converged"` **unconditionally** — while recording an honestly-red P6 gate (`gate.verdict: FAIL · 2 unmet`, then `p6.journey.converged` — the return at :1397 never reads `gate.passed`). OPEN at audit time (fixes/154 RC3; headless.ts may be mid-edit by the F-wave).

**Scorer floor-indistinguishability:** FIXED-on-disk — maker-score.ts:122-131 documents `synthesisSucceeded`, the card-level floor gate (maker-score.ts:530-550) forces M1-M4 = 0 with one shared qualifier (`FLOOR_QUALIFIER_EVIDENCE`, :151-152) when it is false, and run-eval.mjs:436-477 computes and passes it. The 9/9-on-a-refused-run artifact would now score 5/9. **But** M1/M2/M3/M4 remain identifier/compile/self-test criteria for *genuinely keyed* runs — the structural gap is not the scorecard, it is that no criterion measures brief behavior even when the LLM succeeds.

---

## 7. END STATE — the property-ledger chain, link by link

Chain for the real keyed run (coffeehouse2home-property-ledger, ledger + results.json + code anchors). **TRUE = fully performs the brief's job at that link; STUB = performs bookkeeping/shape only; ABSENT = does not exist or never ran.**

| # | Link brief → shipped software | Mark | Evidence (what it actually did) |
|---|---|---|---|
| 1 | Brief authored (corpus) | TRUE | Real 5-domain property-services brief w/ shared Property Ledger semantics (eval-corpus .md). |
| 2 | Intent lattice (domain/jobs) | STUB | Domain classified real-estate ✓; but jobs = `track/record/flip/show/publish/sync` + 6 endpoints — a `sync` job the brief never names, Property Ledger never a concept (corpus provenance); one entity bank ("buyer") reused for all jobs (algorithms.ts:731-760). |
| 3 | A6 contracts | STUB | Field-bank copies + auto method/path per job (algorithms.ts:731-760) — generic shapes, no ledger/CRM/showing/rental/field-ops schema. |
| 4 | Spec expand (implementationSpec) | ABSENT | Run ledger `hasImplSpec:false`, 0 typeSignatures — the 7 corpus capabilities never entered any machine spec. |
| 5 | A7 oracle rows | STUB | 6 prose rows `given/expect` (project.json); no executable input→output pair (algorithms.ts:762-788). |
| 6 | Synthesis (pro LLM) | ABSENT | Cycle 1 `chunk 1/2 refused · DeepSeek returned no text content`; cycle 2 `chunk 2/3 refused` (project.json logs). No complete LLM module ever existed. |
| 7 | Module validation | STUB (n/a) | Shape checks only (exports bound, sig names, no forbidden primitives, brief-noun substrings) — codegen.server.ts:661-714. |
| 8 | Machine verify (behavioral cases) | ABSENT | Never reached a real module: chunked path has none by design (codegen.server.ts:1339-1341); single-module verify path unused (kind webapp → chunked dispatch, :1156-1160). |
| 9 | Tree assembly | STUB | Cycle-2 partial: refused chunk left a 1-file assembled partial `src/generated.ts` (codegen.server.ts:1488-1507) — floor-ish by construction. |
| 10 | Emit (dir + DEPLOY.md + package.json) | TRUE (mechanical) | Files emitted at paths; DEPLOY.md + oracle spec 9054b present (M6 evidence). |
| 11 | treeRun | STUB | `compile 12/12 · 1 spec pass · 10 assertions · entry webapp skip` — entry never executed; 10 assertions = stub self-truth (project.json lastTest; §6). |
| 12 | Emitted oracle spec green | STUB | Green **because** routes reject `TODO(E-15)` and CheckpointStore round-trips itself (tests/oracle.spec.ts:59-146). |
| 13 | "tested" mint / p6-verified | STUB | `label:"tested"` + hash minted from the stub-suite treeRun (headless.ts:1381). |
| 14 | P6 DoD gate | TRUE (honest red, then ignored) | `p6-arch FAIL · missing 6/7`; `gate.verdict FAIL · 2 unmet` recorded — then journey returned converged anyway (headless.ts:1385-1397 OPEN). |
| 15 | Journey convergence | ABSENT | "converged" = stub-suite green, not brief functionality (headless.ts:1395-1397). |
| 16 | Seal/delivery | TRUE (mechanical) | 13 phases sealed, `delivery.complete: … 2 failed gates: P6, P7`, sealedWithFailures flag (run.complete.with.failed.gates). |
| 17 | Scorecard | STUB | Run-time artifact: 9/9 incl. M1=1 "coverage" over the partial tree + M9 "refused parked LOUDLY" for a run that sealed complete (results.json; fixes/154 §1). FIXED-on-disk for refused runs (F1 gate → 5/9), but M1-M4 still never measure behavior on genuinely keyed runs. |
| 18 | Shipped artifact performs the brief's job | **ABSENT** | `src/jobs/*.ts` throw `TODO(E-15) stub: implement job flip…`; `route()` rejects every endpoint; UI shell renders the project title only (scaffold.ts:691-709, 765-793); no property ledger, CRM, showings, rentals, payroll, or cross-domain flow exists anywhere. |

**Only links 1, 10, 14, 16 are TRUE, and each TRUE link is true about process/bookkeeping — not one TRUE link delivers brief functionality.** The chain is green end-to-end while link 18 is ABSENT.

---

## 8. ROOT-CAUSE VERDICT (one paragraph)

RapidTool's governed pipeline is functionally **self-referential**: the brief is reduced to prose capabilities and prose oracle rows that are never compiled into executable expectations; the LLM is asked for a name-compliant envelope and is validated on export binding, forbidden tokens, and identifier substrings — never on what its functions compute; the only behavioral runner is LLM-authored, A7-unseeded, and structurally bypassed for every declared delivery kind; and the "machine-verified" stamp is minted by a tree-run whose green comes from compile-parity and the scaffold's own stub self-tests, with webapp entries skipped outright. Every honesty mechanism in the loop (loud refusals, red gate records, floor qualifiers, honest emitter comments) is real — and that is exactly why the run's ledger *correctly recorded* all-LLM-refused, gate-FAIL, floor-tree-green, converged, sealed, and was then scored 9/9: each stage truthfully certified the stage below it, and the one thing no stage ever certified — because no stage ever asked — is whether the shipped artifact performs the brief's job. The floor is a no-op, the oracle is self-truth, the synthesis ask is shapes-not-behavior, the corpus is identifier-only, and "verified" is compile-plus-self-tests; until a brief-derived **executable** expectation exists and its execution gates convergence, no amount of model quality, chunking, DoD honesty, or scorecard discipline can make the factory produce functional software — green is defined to exclude it.

---

## 9. RANKED STRUCTURAL FIXES (for "100% functional, excellent software", not green self-tests)

**P0-1 — Build an executable brief oracle and make it the keystone.** Convert corpus `expectedCapabilities`/`acceptance` and A7 rows into real fixture cases — concrete input → expected-output per requirement (e.g. property-ledger: "createProperty({address,owner}) ⇒ record with id + empty history; bookShowing(propertyId, slot, buyer) ⇒ showing + email stub + history row; addWorkOrderHours(woId, 3) ⇒ jobCost + payroll accrual"). Emit them as a JSON fixture the scaffold writes into the tree (`tests/fixtures.brief.json` + a runner spec that imports the tree entry and asserts outputs), and wire the dead E-08 seam (dod.ts:714) so `verifyAndFixServer`/`generateCases` are **seeded** with these cases instead of asking the model to invent them. Every kind (webapp included) gets this.

**P0-2 — Execute the artifact; make behavioral green the only convergence.** (a) treeRun must execute the webapp entry (headless import of the assembled entry, or vite-build + node smoke) instead of "UI shell — honest skip"; (b) the journey's converged return must require the brief-fixture suite green **and** `gate.passed === true` (fix headless.ts:1397 — the gate is recorded then ignored); (c) M2/M3/M4 must key on "behavioral cases passed", not on a stub-suite treeRun.

**P0-3 — Make the floor un-representable as a keyed success.** A refused synthesis must leave *no* runnable tree (partialTreeRefuse should drop rather than assemble a partial when the brief-fixture suite cannot run green over it), and the synthesisSucceeded discriminator (FIXED in scorer) must also gate the journey outcome and the emit/DEPLOY claim surface so "floor" and "LLM software" can never share a green path.

**P1-1 — Behavioral synthesis ask + feedback.** Put the executable fixtures *in* `p6SynthesisChunkUserPrompt` (per-req examples: "req-2: createProperty({address:'1 Main',owner:'A'}) must return {id, history:[]}") and require the envelope's `reqTrace` to map req-N → the function the fixture exercises; add a deterministic per-chunk fixture self-run (single-module verify parity for the chunked path — currently absent by design, codegen.server.ts:1339-1341) so repair feedback is behavioral failure text, not shape text.

**P1-2 — Demote or replace every identifier-stem gate.** p6-brief-fit (dod.ts:364-373), p6-arch (385-392), M1 `capabilityCoverage` (maker-score.ts:235-257), and the scaffold capability-presence rows (scaffold.ts:1270-1326) are all sub-identifier presence proxies that disagree with each other and certify nothing executable. Replace with the P0-1 fixture runner as the substance gate; keep stem reports as advisory coverage telemetry only.

**P1-3 — Close the provider empty-content hole with a fallback, not just diagnostics.** Post-run instrumentation (deepseek.server.ts:378-392; maxTokens 32k / 240s) is in place but fixes/154 D5 (thinking+json_object+token-budget interplay) is undiagnosed — an empty refusal returns promptly, so a timeout fix cannot cure it. Add a bounded retry on the flash tier or with `thinking:disabled` before stranding a chunk, and make the refusal path log enough (reasoning_content length, finish_reason) to finally diagnose it.

**P2-1 — Close the emit→edit→re-emit loop with behavior.** The 149 P0-1 dir→ledger seam (tree-run/repair CLI) exists; extend it so a human/agent edit is re-verified against the brief fixture suite (P0-1) and the emitted webapp actually builds (`npm install && vite build` as a C7 gate — today no webapp emission has ever built, fixes/149_a5 C7), turning "shipped software" from an emitted stub dir into a runnable, tested artifact.
