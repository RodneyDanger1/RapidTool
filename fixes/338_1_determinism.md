# W52 / 338-1 — "Determinism" — P6 plan/coverage determinism

**Actor:** Determinism (P6 plan + coverage). **Owned files (STRICT):** `src/lib/codegen.server.ts`,
`src/lib/algorithms.ts`, `src/lib/phases.ts` + colocated `*.test.ts`; this log.
**Opened:** 2026-10-02 at HEAD `e7da20e`, tree clean (only untracked `wave_plans/W52/`).
**Runtime:** repo-pinned Node 22.23.2 (`%LOCALAPPDATA%\hermes\node\node.exe`) + host Node v24.15.0;
every parse uses `--test-reporter=tap`. **Scratch (outside the repo):** `%TEMP%\rt338_1\`.
Contract: `wave_plans/W52/README.md`; evidence: `fixes/337_0_parent.md` §5.

## Step 0 — claimed / on disk / still open

**Claimed (the gap I own, W52 README §why item 1; `fixes/337_0_parent.md:129-140`,
`fixes/331_0_parent.md:130-140`, `fixes/332_0_parent.md:133-140`):** keyed synthesis coverage is not
deterministic run to run — one keyed P6 run emitted **7** real modules and passed `p6-arch`; the next
emitted **5** and failed it. An unattended factory must reach the same verdict on the same brief twice.

**On disk today (measured by grep/read at HEAD `e7da20e`):**

- `src/lib/algorithms.ts:902` — `deriveTypeSignatures(lattice)` is the pure deterministic capability
  floor ("n jobs ⇒ 2n signatures"), but it is **UNWIRED**: repo-wide its only references are its own
  definition and its own test (`git grep -n deriveTypeSignatures`); no production consumer. The comment
  at `algorithms.ts:886-889` calls it "the pure deterministic floor for that judgment" — the judgment
  happens, the floor never runs.
- `src/lib/codegen.server.ts:3785` builds `specRecord.typeSignatures` **verbatim from the model's
  `expandBrief` reply** (`specRecord` at :3769-3778), and `:4185` plans the whole tree from that list
  (`treeChunkPlan(project, specRecord.typeSignatures)`). The plan is pure *given* that list; the list is
  what varies run to run.
- `src/lib/codegen.server.ts:1825-1843` `bindSignaturesToJobTargets`: a signature binds to a spec-graph
  job node only when `functionName.toLowerCase().includes(label.toLowerCase())` — case-insensitive
  **substring**, so a hyphenated label (`follow-up`, `algorithms.ts:113`) can never bind its own
  `runFollowUp` signature. `treeChunkPlan` (`:1882`) allocates a `src/jobs/<label>.ts` chunk ONLY for a
  bound job.
- `src/lib/codegen.server.ts:4196-4204` counts the unbound declared jobs and persists one
  `p6.tree.shortfall` warn, but **does not plan them** — run B's `track` gets no file
  (`codegen.server.test.ts:4400-4412` pins that recorded shape: 36 signatures, `unbound:["track"]`,
  `src/jobs/track.ts` absent, `p6-arch` FAIL).
- `src/lib/dod.ts:363-388` `archCapabilities` reads `implementationSpec.typeSignatures` directly, so the
  `p6-arch` obligation set is the model's emission too (dod.ts is **unowned** — but the lever is the
  persisted spec, which codegen.server.ts writes, so the judge can be aligned without editing dod.ts).
- `src/lib/phases.ts` — no role in the P6 plan (audited: no `typeSignature`/`lattice`/plan references);
  it is the phase table/DoD-floor consumer.

**Still open:**

- No rule guarantees a declared job maps to a planned file; the model's emission decides.
- No reconciliation of the model spec with the deterministic floor.
- No recorded keyed reproduction of the 7-vs-5 divergence (both parent records cite it; neither re-ran
  it), and no bounded statement of the residual variance.

**Baseline (measured this open, Node 22.23.2):** `codegen.server.test.ts` **180/180**,
`phases.test.ts` **20/20**, `algorithms.test.ts` **80/80**.

---

## §1 The deterministic rule (design)

**Rule (the one derivation):** *the coverage obligation of a P6 tree is the spec graph's declared job
nodes, and every declared job maps to a planned `src/jobs/<label>.ts` file by rule.* The model's
`typeSignatures` fill each job's chunk when one binds to the job's label; a declared job that no
model signature binds gets the deterministic floor pair from `deriveTypeSignatures` (the lattice's
`run<Job>` / `list<Job>Runs`), so it is planned, prompted for, synthesized and judged — never dropped
because the model happened not to name it.

This is deterministic because `project.lattice` and `project.specGraph` are pure functions of the brief
(`intentLattice(brief, domain)` → `planSpecGraph(lattice, domain)`, no LLM, no time — `algorithms.ts:405`,
`:737`), so on the same brief the declared-job set and therefore the planned `src/jobs/*.ts` set are
identical across runs regardless of the model's emitted signature count.

The persisted `implementationSpec.typeSignatures` is the reconciled set, so `p6-arch`
(`archTrace` → `archCapabilities`) judges coverage against the same rule without editing the unowned
`dod.ts`. The census (`treeChunkPlanCensus`) reads the same reconciled set, so its `unbound` is empty by
construction for declared jobs, and the `p6.tree.shortfall` row is replaced by a bounded
`p6.tree.plan.reconciled` row naming what the rule added.

## §2 Keyed reproduction — two REAL expansion calls, same brief (the divergence, then stability)

Probe `%TEMP%\rt338_1\keyed-determinism.mjs` (outside the repo), Node 22.23.2, engine = the real
`expandBrief` over the repo `.env` key; the `project` is the PURE A5 output of the recorded café brief
(`research/eval-out/coffeehouse2home-property-ledger/.rapidtool/project.json`, `brief` 1412 chars,
`domain` real-estate) → declared job nodes `["track","record","flip","show","lease"]`. **Two keyed
calls, one per run; usage reported below. No further keyed calls were made.**

```
declared job nodes: ["track","record","flip","show","lease"]
run 1: signatures=35 calls=1 tokens(prompt=858,completion=2810)
  RAW       unbound=["track"]              jobFiles=["src/jobs/flip.ts","src/jobs/lease.ts","src/jobs/record.ts","src/jobs/show.ts"]
  RECONCILED added=["track"]               unbound=[] jobFiles=["src/jobs/flip.ts","src/jobs/lease.ts","src/jobs/record.ts","src/jobs/show.ts","src/jobs/track.ts"]
run 2: signatures=28 calls=1 tokens(prompt=858,completion=2354)
  RAW       unbound=["track","flip"]       jobFiles=["src/jobs/lease.ts","src/jobs/record.ts","src/jobs/show.ts"]
  RECONCILED added=["track","flip"]        unbound=[] jobFiles=["src/jobs/flip.ts","src/jobs/lease.ts","src/jobs/record.ts","src/jobs/show.ts","src/jobs/track.ts"]
RAW declared-job coverage same across the two runs: false
RECONCILED declared-job coverage same across the two runs: true
RECONCILED unbound empty in both: true
```

**This is the 7-vs-5 divergence reproduced live, on the same brief, in the declared-job shape** (run 1:
5 job files, run 2: 4 — with `track` uncovered once and `track`+`flip` uncovered the next, purely from
the model's variable signature emission). After the rule, both runs plan **the same 5 declared-job
files** and unbound is empty. Keyed usage: **2 calls total, 858 prompt tokens each; 2810 + 2354
completion tokens.**

### The residual variance, named and bounded

The rule fixes the **declared-job file set** to the spec graph. It does NOT make the whole plan
byte-identical, because the model's *own* signature count varies (35 vs 28 here) and those signatures
still fill chunks:
1. **Leftover chunks** (`src/generated/*.ts`) for model signatures binding no declared job — count
   `ceil(unboundModelSigs / P6_SYNTH_CHUNK_SIZE)`, varies with the model.
2. **Per-job overflow** (`src/jobs/<label>-2.ts`, `-3.ts`) when a single declared job's *bound* model
   signatures cross `P6_SYNTH_CHUNK_SIZE` (8) — bounded by `ceil(boundSigs/8)`.

Both are additive breadth: they can never *remove* a declared-job file, so the coverage verdict the
lane owns is stable; the only remaining run-to-run variability is the number of extra implementation
files, bounded by `ceil(totalModelSigs / 8)`.

## §3 What landed (surgical patches; exact sites)

| Site | Change |
|---|---|
| `src/lib/codegen.server.ts:114` | import `deriveTypeSignatures` (the existing deterministic floor) from `algorithms.ts`. |
| `src/lib/codegen.server.ts:1835` | new `normalizedLabelForm` — lowercase alphanumerics; bound `src/lib/codegen.server.ts:1858` `bindSignaturesToJobTargets` through it, so a hyphenated label (`follow-up`) now binds its own `runFollowUp`. |
| `src/lib/codegen.server.ts:2082` | new **`reconcilePlanTypeSignatures(project, typeSignatures)`** — THE rule: per declared job target, model-bound signatures when any bind, else the `deriveTypeSignatures` floor appended after the model's list. No spec graph ⇒ input returned unchanged (byte-identity). Pure. |
| `src/lib/codegen.server.ts:4268-4288` | `synthesizeChunkedTree` reconciles ONCE, uses `treeSpec` for the plan (`:4277`), census (`:4297`) and every chunk prompt (`:4318`), persists `treeSpec` through `treeUpgraded` (`:4393`), and emits one bounded `p6.tree.plan.reconciled` info row naming what the rule added (`:4287`). |
| `src/lib/algorithms.ts:902` | `deriveTypeSignatures` parameter widened to `Pick<IntentLattice,"jobs"&#124;"entities">` (the fields it reads) — the only algorithms.ts change; no behaviour change. |
| `src/lib/phases.ts` | **untouched** (audited: no plan/lattice/typeSignature references). |

`p6-arch` alignment needs no `dod.ts` edit: `archTrace` reads `implementationSpec.typeSignatures`, and
the driver now persists the reconciled set, so the judge demands exactly the rule's capability set.

## §4 Per-fix RED → GREEN

**RED (before the fix, real output).** `%TEMP%\rt338_1\red-plan.mjs`, same brief + two different model
emissions:
```
declared   : ["track","record","lease","rent"]
emission A -> jobs files: ["src/jobs/rent.ts"] unbound: ["track","record","lease"]
emission B -> jobs files: ["src/jobs/record.ts","src/jobs/track.ts"] unbound: ["lease","rent"]
DIVERGENT: same brief, different declared-job coverage      (exit 1)
```
plus the live keyed RED is §2's `RAW ... same: false`.

**GREEN (after).** `%TEMP%\rt338_1\green-plan.mjs`:
```
emission A -> jobs files: ["src/jobs/lease.ts","src/jobs/record.ts","src/jobs/rent.ts","src/jobs/track.ts"] unbound: []
emission B -> jobs files: ["src/jobs/lease.ts","src/jobs/record.ts","src/jobs/rent.ts","src/jobs/track.ts"] unbound: []
DETERMINISTIC: declared-job coverage is a function of the brief, not the emission   (exit 0)
```
and the live keyed GREEN is §2's `RECONCILED ... same: true`.

## §5 Mock / fake census over the owned files

Ran over `codegen.server.ts`, `algorithms.ts`, `phases.ts`:

- `as any` / `@ts-ignore` / `@ts-expect-error` / `: any`: **0**.
- empty or silent `catch {}`: **0** — the two `catch` blocks (`codegen.server.ts:794`, `:3024`) both
  route the failure into the envelope-read `sink` and return a coded null (no swallow).
- `TODO`/`FIXME`/`XXX`/placeholder: 2 pre-existing `TODO(FM-03b)` at `:1030` and `TODO(FM-04b)` at
  `:3640` (documented named limits with FM ids, NOT bodies I introduced; my diff adds none of these
  classes) plus doc-comment uses of the word "placeholder" describing the keyless floor (not code).
- No hardcoded return faking a computation: `reconcilePlanTypeSignatures` derives every added signature
  from `deriveTypeSignatures` over the real lattice/spec graph and returns `added:[]` when nothing is
  needed; the tests assert both the addition and the no-op.
- The new tests cannot pass vacuously: the pure test asserts the actual `src/jobs/*.ts` sets; the
  driver test asserts emitted tree paths + `archTrace(q).missing === []` + `stubFiles === []`.

## §6 Tests added + results (both runtimes)

New permanent tests in `src/lib/codegen.server.test.ts` (owned): the pure `reconcilePlanTypeSignatures`
rule (floor addition + no-job byte-identity), the hyphen-label binding, the two-emission plan stability,
and the driver e2e that every declared job is planned + `p6-arch` judges the same rule; the two prior
shortfall tests were rewritten to the reconciled regime (no declared job dropped; the
`p6.tree.plan.reconciled` row names what was added). Fixture fakes (`chunkedDeps` and the two ad-hoc
chunked fakes) now serve each prompt's own demanded names so they track the spec-driven plan.

| suite | baseline | after | node 22 | node 24 |
|---|---|---|---|---|
| `codegen.server.test.ts` | 180 | **183** | 183/183/0 | 183/183/0 |
| `phases.test.ts` | 20 | **20** | 20/20/0 | 20/20/0 |
| `algorithms.test.ts` | 80 | **80** | 80/80/0 | 80/80/0 |

Downstream consumer suites re-run on Node 22: `gates.test.ts` + `doctor.test.ts` + `engine.test.ts` +
`dod.test.ts` → all pass; `headless.test.ts` showed run-to-run flaky CLI-subprocess failures (1 failure
on one run, 2 different ones on the next: `emit --run` / `lesson --accept`) on code paths that never
call the keyed chunked synthesis — recorded as pre-existing flakes, not attributable to this lane
(no `liveP6Synthesis` without a key). `eslint` on the six owned files → exit 0, 0 warnings;
`npx tsc --noEmit` → exit 0.

## §7 STOP-and-REPORT (not owned — the boundary owner lands it)

**`src/lib/llm/providers/mock.test.ts:341-410`** — the mock E2E drives the REAL chunked pipeline and
pre-queues exactly 3 synthesis envelopes (`groups = chunkTypeSignatures(E2E_SPEC.typeSignatures)`),
asserting `mock.calls().length === 4` (`:399`) and `tree.length === 4` / paths
`[TREE_ENTRY_PATH, src/jobs/rent.ts, rent-2, rent-3]`. Under the spec-driven rule the plan is 6 chunks
(the declared `track`/`record`/`lease` get their floor chunks), so the mock runs out and the test fails
(`5 !== 4` at `:399`). It is not mine to edit (owned by the provider lane). Exact shape of the fix:
import `reconcilePlanTypeSignatures`, `treeChunkPlan`, `orderTreeChunks` from `../../codegen.server.ts`;
after `base` is built (`:392`) compute
`const plan = orderTreeChunks(treeChunkPlan(base, reconcilePlanTypeSignatures(base, E2E_SPEC.typeSignatures).typeSignatures));`
queue one envelope per `plan` row using `signatureFunctionNames(row.signatures)`; and update the four
pins: groups precondition → `plan.length`, `mock.calls().length` → `1 + plan.length`, `tree.length` →
`1 + plan.length`, expected paths → `[TREE_ENTRY_PATH, ...plan.map((c) => c.path)]`. The reconciled plan
is a pure function of `E2E_BRIEF`'s lattice, so the queue stays deterministic.

## §8 Not done / boundaries

- No `npm run eval` against the tracked dir; no full gate; no repo probe file; no secret printed
  (key read in-process from `.env`, never echoed).
- `phases.ts` needed no change (audited).
- Did not touch `dod.ts`, `headless.ts`, `scaffold.ts`, `engine.ts`, `mock.test.ts` or any other
  unowned file. `archTrace` alignment was achieved entirely through the persisted spec.
- The residual variance (§2) is bounded, not eliminated: the declared-job file set is deterministic;
  the number of extra model-driven chunks is not, and closing that would require discarding the model's
  own decomposition — a product decision, reported not taken.

---

# FOLLOW-UP (same lane) — the typed-product fix (W52, the autonomy blocker)

**Task:** the factory's synthesis emitted JS-style untyped code while the emitted tree enforces
TypeScript `strict` (`noImplicitAny`), so a keyed unattended run hard-blocked at P6 (338-3: the tree's
own `npm run typecheck` exit 2, `TS7006` across all 12 generated functions → no green tree-run → no
`tested` mint → `p6-verified`/`p6-test` block delivery; 338-2 reproduced
`src/jobs/dispatch.ts(11,21) TS7006`). Owned file unchanged: `src/lib/codegen.server.ts` + its test.

## §9 The typing fix (prompt) — and the real emitted-tree proof

**Landed** (`p6SynthesisSystemPrompt`, `codegen.server.ts`):
1. The **worked example is now annotated**: `function add(a: number, b: number): number { … }` (was
   `function add(a, b)`), with a header line telling the model every parameter and the return type are
   annotated — the model imitates the example.
2. **Rule 2** now says "Plain, **fully-typed** functions only".
3. **New rule 10**: strict mode is on; annotate every parameter + return type; use only built-ins or
   named types DECLARED in this same module; an unannotated parameter fails the emitted tree's own
   `tsc --noEmit` (TS7006). It deliberately does **not** claim "(validator-enforced)" (the existing
   drift-proof test pins the enforcement-claiming rules to `[2, 4, 8]`; rule 10 is not one).

**Real keyed proof** (`%TEMP%\rt338_1\keyed-typing.mjs`, Node 22.23.2, real `.env` key):
- **1 keyed synthesis call** (the real production system+user prompts), **1223 prompt / 1383
  completion tokens**. The expansion seam was injected (a 2-signature spec) to bound the keyed call
  count inside the contract's ≤2; the SYNTHESIS call is the real path under test.
- The model emitted **fully annotated TypeScript**: it declared `type Board`, `type Column`,
  `type Card`, `type Status`, `type Drag` inline and annotated every parameter/return
  (`function makeId(seed: string, seq: number): string`, `let h1: number`, …).
- Emitted tree (`tree-keyed`, kind "app", 1 chunk): the tree's own declared `npm run typecheck`
  (`tsc --noEmit`) → **exit 0**, **0 tsc error lines**; `treeRun.ok: true`,
  `declaredScriptsVerified: true`; `mintTreeRunTested` →
  `lastTest {"ok":true,"detail":"tree-run green: compile 9/9 file(s) · 1 spec file(s) pass · …","label":"tested","evidenceHash":"2819700965"}`.
  So `tested` mints and P6 can advance on a type-clean tree.
- **Second keyed run (the other allowed call), same probe:** 1 keyed synthesis call, **1223 prompt /
  1048 completion tokens** — the model again emitted annotated TypeScript, the tree's own typecheck
  **exit 0 / 0 error lines**, `treeRun.ok: true`, `declaredScriptsVerified: true`, `tested` minted with
  the same `evidenceHash` (`2819700965`), and **`runGate(minted, 6)` → `pass: true, unmet: []`** — P6
  clears (`p6-verified`/`p6-test` no longer block). Total keyed usage for this follow-up: **2 calls,
  1223 prompt tokens each, 1383 + 1048 completion tokens.**

**RED (the class, on the product's own emitted tsconfig).** Copy of the same emitted tree with one
untyped generated function added (`%TEMP%\rt338_1\tree-untyped/src/jobs/dispatch.ts`:
`export function dispatch(input) { return input; }`), run with the tree's own `tsconfig.json`
(`strict: true`):
```
src/jobs/dispatch.ts(2,26): error TS7006: Parameter 'input' implicitly has an 'any' type.
--- untyped-only tree typecheck exit=2 ---
```
The same tree with the annotated keyed module → exit 0 (§9). No tsconfig strictness was relaxed.

## §10 Deterministic post-processing — investigated, NOT landed (argued, with evidence)

The task offered a deterministic annotation derived from the planned signature. I measured why a
**generative** pass cannot be honest here and did not add one:
- The emitted tree declares **no TS types** (recorded café tree: 0 `type`/`interface` declarations; the
  generated modules carry types only in JSDoc). The planned signatures reference **undeclared named
  domain types** (`PropertyLedgerRecord`, `ContactInput`, `DealStage`, `BuyerFeedback | null`, and the
  floor's `FlipCommand`/`Flip`). Annotating with those names yields `TS2304` (worse), and emitting a
  placeholder declaration for them is guessing a shape.
- `any`/`unknown` fallbacks either mask the non-compliance (`any`) or break property access
  (`unknown`), so neither is a real annotation.
- A **validator refusal** on untyped parameters is possible but would reject the existing fixture
  corpus and, more importantly, *blocks harder* — the wrong direction for a defect whose complaint is
  that the run is blocked. The honest guarantee is model compliance (the prompt) plus the product's
  own gate: the tree's declared typecheck now genuinely runs (338-2) and `mintTreeRunTested` refuses
  `tested` on a non-green run (338-6), so an untyped tree can never masquerade as verified.

**Reported, not taken:** if a future run still sees an untyped stray, the durable guarantee would be a
deterministic refusal routed into the existing bounded repair (`treeFailure`) — that seam is
`headless.ts`/`engine.ts`, not this lane's file.

## §11 Spine folds (both in the same file)

**Fold 1 — `upgraded()` dropped `outcome.lesson`.** The single-module automated pass consumed the
verify outcome but never wrote the L4 verified-procedure row. Now `upgraded()` folds `outcome.lesson`
into `memory` idempotently by row id (an existing twin is never duplicated), mirroring
`verify.ts applyVerifyOutcome`.

**Fold 2 — the evidence-hash twins.** `verifyOutcomeArtifact` and `upgraded` hashed
`fnv1a(source \u0002 evidence)`. Both now call a shared `verifyEvidenceHash(source, outcome)` =
`fnv1a(source \u0002 evidence \u0002 JSON.stringify(cases.map(c => [id, expression])))` — the exact
formula `verify.ts` uses, so one witness covers every input. (Reported known limit, unchanged: codegen
hashes its cleaned `finalModule` while `verify.ts` hashes `outcome.finalSource`; a fence/trim
difference can still make a re-apply miss the dedupe.)

**RED → GREEN (real output).** Temporarily restored the pre-fix bytes, ran the three new tests, then
restored the fix:
- RED: `the worked example annotates every parameter and the return type → false`;
  `a different oracle case set must mint a different evidence hash` — `expected '3484440366'` /
  `actual '3484440366'` (the case-set collision); `the L4 lesson row is persisted → false`. `# pass 0 /
  # fail 3`.
- GREEN: same three tests `# tests 3 / # pass 3 / # fail 0`.

## §12 Tests + gates

New tests in `src/lib/codegen.server.test.ts` (owned): the annotated-example + rule-10 pin; the
case-set hash commitment (+ determinism); the L4 lesson fold (+ idempotence). Updated the two stale
mirrors that recomputed the old hash (the T5.4 provenance `inputHash` mirror and the tested-stamp
boundary test).

| suite | before | after | node 22 | node 24 |
|---|---|---|---|---|
| `codegen.server.test.ts` | 183 | **186** | 186/186/0 | 186/186/0 |
| `phases.test.ts` | 20 | 20 | 20/20/0 | 20/20/0 |
| `algorithms.test.ts` | 80 | 80 | 80/80/0 | 80/80/0 |

Downstream: `gates` + `doctor` + `engine` + `verify.server` + `verify` + `dod` = **218/218/0**;
`npx tsc --noEmit` → exit 0; `eslint` on the owned files → 0 warnings. No full gate, no
`npm run eval`, no secret printed; the key was read in-process from `.env` and never echoed.

## §13 The semantic sentence for lane 338-1b (and what it must know)

**Exact post-fix semantic:**

> **A fresh emitted tree now passes its own declared `npm run typecheck` (`tsc --noEmit`, `strict: true`) whenever its synthesized modules are annotated — the P6 prompt now requires annotations (system rule 10 + an annotated worked example) and the tree's own typecheck is the gate; generated code that is still untyped fails it with `TS7006`.**

What 338-1b must know:
- The floor template `sandbox.buildPhase6Module`'s `synthesize(spec)` is still **untyped** and is
  hosted verbatim by `scaffold.emitGeneratedHost` on the keyless path — annotating it is required for
  a **keyless**-emitted tree to pass the same declared typecheck (the keyed path is fixed by the
  prompt, proven above).
- The emitted `tsconfig.json` is `strict: true`, `noEmit: true`, `allowImportingTsExtensions: true`,
  `types: ["node"]` (webapp adds `vite/client`) — the gate it must satisfy.
- **Evidence-hash formula changed** for the single-module `tested` stamp: `fnv1a(source \u0002 evidence
  \u0002 JSON.stringify(cases.map(c => [id, expression])))`. Any pin of a `verify-passed-…` /
  `6-code-llm-module-…` artifact id or a provenance `inputHash` must recompute with this form (the
  codegen test's T5.4 mirror was updated accordingly).
- **`upgraded()` now folds `outcome.lesson` into `memory`** (idempotent by id) — a single-module pass
  now carries one extra memory row; any test asserting exact memory rows must account for it.
- The KEYLESS floor path was not touched by this lane; 338-1b's `sandbox.ts` fix is the other half.
