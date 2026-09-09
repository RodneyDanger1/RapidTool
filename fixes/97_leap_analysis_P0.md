# 97 — LEAPFROG P0 wrong-product + gate-convergence fix specs (ANALYZER H-A, P0 lane)

- **File:** `fixes/97_leap_analysis_P0.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`).
- **Pass / agent:** 2026-09-06 · Flash **ANALYZER H-A (P0 pipeline lane)** — senior software engineer + code auditor. **Strictly read-only on RapidTool source.** This file is the only output; **append-only, published in chunks** (a Pro sibling applies these specs live — re-grep every anchor before patching; line numbers drift after sibling edits, per 90 §9.7/§11.4-A.2 discipline).
- **Scope:** every **P0 wrong-product-class pipeline item** in LEAPFROG §1–§8/§10 + verdict dossiers 86/87/88 + design-flaw ledger 93 (DF-01…DF-08 + DF-09 approval asymmetry) + the two maker-found convergence bugs (86 §1 finding #2/#3). Per item: (1) exact current code read this pass, (2) senior-engineer reasoning on what the phase SHOULD emit under the deepseek-v4-flash/pro constraint set (90 §12.3), (3) web-verified functional facts (cited ✓TODAY), (4) exact patch/integration spec: target file:line, old → new behavior, prompt/synthesis changes, test plan, gates expected.
- **0-hallucination rule:** every internal claim cites bytes read/grepped THIS pass (`src/lib/{engine,store,dod,sandbox,phases,algorithms,packet,types,prompt-engine,verify.server,headless,scaffold}.ts`, `src/components/console.tsx`). External claims cite pages fetched THIS pass (DeepSeek JSON/thinking guides, MetaGPT paper — §W register). Everything marked **[V]** = verified on disk this pass; **[R]** = reasoned from verified anchors; **[W]** = web-verified ✓TODAY.
- **Corpus map (dossier → defect → this spec):** DF-01 → **P0-01** · DF-02 → **P0-03** · DF-03/04/06 → **P0-04** · DF-05 → **P0-05** · DF-09 (approval asymmetry) → **P0-06** · DF-08 (advisory-gate "sealed" lie) → **P0-07** · maker #3 / 31 §1.2 residual (wild packet re-stamp) → **P0-08** · maker #2 / 31 §1.3 dead `convergeRealRun` (verify --apply gate convergence) → **P0-09** · LEX/dev-tool vocabulary (87 S1/H1, 88 §7.1-1) → **P0-02**.

---

## §0 Current-state truth table (what is REALLY on disk, 2026-09-06 pass)

> Everything the fix specs build on. Anchors re-grepped this pass; do not trust older citations (90 §9.7 drift log applies).

| # | Claim | Verified anchor [V] |
|---|---|---|
| 1 | P6 deterministic module = phase-gate simulator toy; brief never enters | `sandbox.ts:125-161` `buildPhase6Module` (inputs: name/jobs/rejectionNote/variant only); wired at `engine.ts:493-555` (case 6: jobs from lattice, note, `variant = (fnv1a(note)+attempt)%2`, heal-once, `runGenerated`) |
| 2 | `runGenerated` refuses anything but the engine template shape | `sandbox.ts:87-89` (`!source.startsWith("const JOBS = [") || !includes("function test_no_skip")` → `{ok:false, detail:"non-template source requires runSandboxed()"}`); the named worker executor is **deprecated, zero product call sites** (`sandbox.ts:176-189,257-277`) |
| 3 | `healSource` can only inject a `test_happy` that calls `synthesize` | `sandbox.ts:105-110` |
| 4 | P6 DoD criteria = presence/self-test probes, no brief-fit | `dod.ts:126-172`: `p6-test` (lastTest ok + non-empty detail), `p6-source`, `p6-artifact`, `p6-verified` (label "tested"+evidenceHash). No probe consults the brief |
| 5 | P8 "Interface contract" describes RapidTool's own console; HITL asks to confirm it | `engine.ts:585-606` ("Framework: React + Tailwind… Surfaces: intake, phase rail, scorecard, artifact inspector, approval dock"; gate prompt "Confirm the console surfaces…"); `phases.ts:70-75` P8 summary promises "Component-based React + Tailwind generation, live canvas preview" |
| 6 | P1/P2/P3/P10/P11 artifacts state unimplemented capabilities as fact, no B-18 line | P1 topology `engine.ts:347-376` ("failover.LiteLLM", `transfer_to_agent` rules as prose) · P2 "Durable checkpoint key…" `engine.ts:384-386` + "RRF(k=60)… cross-encoder re-rank" `:393-394` (FusionRank header says deliberately NOT RRF, `algorithms.ts:221-231`) · P3 MCP+A2A contracts `search.brave`/`repo.fs`/`sandbox.exec`/`a2a:1.0`/250 ms frames `engine.ts:405-429` · P10 "Primary: grok-4.5 / Edge: Ollama" `engine.ts:653-670` (hydrateModelRoute maps grok-4.5→deterministic, `engine.ts:1209-1213`) · P11 "brave.search… bind_policy… restart_required:false" `engine.ts:674-703` (real research stack Tavily/DDG per `engine.ts:1590-1608`) |
| 7 | P4 artifact HAS the B-18 disclaimer; P4 HITL gate prompt does NOT | artifact `engine.ts:450` ("Implementation today: … policy above is the P4 declaration (B-18 honesty)") vs gate `engine.ts:456-462` ("Confirm 256 MB / 30s isolate, deny-network during exec, and user-scoped OAuth on every tool") while real runtime is `sandbox: {runtime:"sync-template", ramMb:null, timeoutS:30, isolated:true}` (`engine.ts:1104-1111`) |
| 8 | P5 "Self-Learning" is title-only | `phases.ts:45-51` (P5 "Validation, HITL & Self-Learning", no loop behind it); artifact enumerates "Simulated user paths" `engine.ts:464-484` (nothing simulates) |
| 9 | Phase catalog summaries are agent-platform flavored for every domain | `phases.ts:15-19` (P1), `:23-27` (P2 RRF), `:31-35` (P3 MCP/A2A), `:39-43` (P4 cgroups/gVisor/256 MB/OAuth), `:70-75` (P8 React+Tailwind+canvas), `:87-90` (P10 Ollama), `:95-98` (P11 Brave) |
| 10 | Gates advisory by default; "sealed" counts status only | `enforceDod: false` default `engine.ts:1127`; consulted only when `=== true` at `store.ts:303,368`, `engine.ts:2215,2270`; finishPhase auto-advance past FAIL-gated phase `store.ts:360-401`; rail prints `{done}/13 sealed · {pct}%` from status counts `console.tsx:2450-2463`; hard-block copy exists but unreachable by default (`dod.ts:453-466`) |
| 11 | Approve needs no note (even forceHuman override over failed sandbox) | `approveHitl` `engine.ts:900-991` (`note: opts?.note` optional, `:935`); store approve `store.ts:975-1013` passes no note; UI Approve enabled with empty note, override checkbox only `console.tsx:2646-2732`; rejection ≥12 chars triple-guarded (`engine.ts:993-1001`, `store.ts:1015`, `console.tsx:2733-2746`) |
| 12 | LEX register has zero CLI/dev-tool/library vocab | `algorithms.ts:24-111` (actor/job/object/constraint/risk — no rename/cli/regex/undo/dry-run/kanban/library/statistics/mean/median/percentile); fallback `:200-204` (`vague` flag honest, `jobs:["deliver-core-workflow"]`, `entities:["operator","record"]`) |
| 13 | A5/A6/A7/A8 are kind-blind web-app planners | `planSpecGraph(lattice, domain)` `algorithms.ts:398-446` (always schema→api→store→job→ui→tests; `src/ui/console.tsx` for every brief); `synthesizeContracts` `:478-507` (FIELD_BANK `:448-475`, HTTP endpoints only); `buildTestOracle` `:510-535` ("200 + persisted entity + checkpoint written"); crew mandates `:559-602` (architect "Lock schema and routes…", reviewer "A6 endpoints and A7 oracle are green"); `runAlgorithms` callers `:703-705`; kind taxonomy exists LATER in scaffold only (`scaffold.ts:43,62-69,229-246` `projectKindOf`) |
| 14 | Spec graph/contracts/crew ship to downstream agent unlabeled as template | packet sections compiled at `packet.ts:137-205`; spec graph section ~`:259-265` (per 93); UI Spec tab renders order/nodes w/o provenance label `console.tsx:2285-2304`; HITL evidence lists artifact titles only `console.tsx:152-205` |
| 15 | `expandBrief` produces the brief-faithful spec but it is orphaned (never stored on Project) | `prompt-engine.ts:171-196` returns `{ok:true, spec}` (fields requirements/edgeCases/errorHandling/typeSignatures/dataFlow/negativeConstraints, `:222-230`); consumers = CLI `prompt` verb only; `types.ts:249-339` Project has **no** `implementationSpec`/`spec` field [V grep] |
| 16 | Verify loop is real but brief-only; no spec/oracle seeds in prompt; no UI presence | `verify.server.ts:446-501` `generateCases(source, brief)` (spec NOT passed); audit-88 bounded repair retry landed `:480-499`; `verifyAndFixServer` `:503-582` (repair prompt gets brief only `:554-565`); `runCases` guards `:359-443`; harness refuses rejection paths `:463-465`; `withCommonJsExports` `headless.ts:950-959`; oracle-seed seam exists but unused: `dod.ts:416-430` `oracleToCaseSeeds`/`missingOracleCaseIds` (consumers: none in verify path [V grep]) |
| 17 | Wild gate path records gate AFTER packet compile; P12 wild never re-stamps packet | `wildApproveGate` `engine.ts:2229-2235` (`recordGateInto(candidate)` then `wildPatch`/`wildLog` — no `stampPacket` after approveHitl's own compile at `:990`); P12 branch `engine.ts:2418-2420` `wildFinalize(recordGateInto(done, phase), phase)` — gate recorded, packet not re-stamped (compiled pre-gate inside `applyPhaseResult` `:867-868`); non-gate complete path DID get the fix `:2421-2424` `stampPacket(recordGateInto(done, phase))`; packet `gate_passed` reads `PhaseRecord.gate` at `packet.ts:123-128` |
| 18 | `verify --apply` (PASSED) never converges the recorded P6 gate or packet | `applyVerifyOutcome` `headless.ts:980-1034` stamps `lastTest {label:"tested", evidenceHash}` + artifact + log — no `recordGateInto(project,6)`/`stampPacket`; CLI apply `scripts/rapidtool-cli.mjs:543-545` saves the outcome project as-is; `convergeRealRun` `store.ts:217-223` exists, now called by `runModuleReal` `store.ts:866` but is **engine/store-only** — the headless/CLI verify path never converges |
| 19 | Human store approve path IS converged | `store.ts:1004-1008` approve → `recordGate` → `stampPacket` [V]; headless `approve` → `recordGateInto` + `stampPacket` `headless.ts:507-514` [V]; autopilot store path `store.ts:282` (`recordGate(approveHitl(...))`) — packet stamped inside approveHitl BEFORE recordGate appends gate artifact (43 H43-P3-1 residual, P1-level; folded into P0-08 regression net) |
| 20 | Scorecard + research disconnected; scorecard axes canned | `algorithms.ts:639-688` (notes/bottlenecks/attackVectors static); live research lands in `project.research` via `liveLayer` `engine.ts:1654+` but scorecard/competitors never update (DF-19, P1 — not in this lane; noted only) |
| 21 | Scaffold emits honest stubs; kind-aware file flavors exist but codegen targets don't | `scaffold.ts:971+` `scaffoldProject`, kind flavors `:552-668` (library kind → CliContext-style stubs per 88 §2.2); all TODO(E-15) throws — honest skeleton of the WRONG shape for library/cli kinds |
| 22 | DeepSeek model surface (for synthesis specs) | [W ✓TODAY api-docs.deepseek.com] exactly three IDs (`deepseek-v4-flash`/`-pro`/`-flash-vision-exp`); JSON Output needs `response_format:{type:"json_object"}` **+ the word "json" + an example in the prompt + sane `max_tokens`**; "the API may occasionally return empty content" (mitigation = prompt change); thinking ON by default (effort high); `temperature/top_p/presence_penalty/frequency_penalty` **accepted but no effect** in thinking mode; `reasoning_content` round-trip required when request carries `tools` (else 400) — our synthesis calls carry no `tools`, so no round-trip burden |
| 23 | MetaGPT pattern for brief-parameterized factory | [W ✓TODAY arXiv:2308.00352 (ar5iv full text)]: PRD (User Stories + Requirement Pool) → Architect system design (File Lists/Data Structures/Interface Definitions) → Project Manager task list → Engineer implements the named classes/functions → QA writes tests; Engineer iterates on executable feedback ≤3 retries; structured intermediate outputs + intermediate-result verification reduce cascading hallucination; "detailed prompts lead to better software projects" |

---

---

## P0-01 — Kill the P6 phase-gate simulator toy: brief-parameterized P6 + `p6-brief-fit` probe (DF-01, 90 §10.5 Phase-0 #1, 93 §6 #1)

**Rank: P0 · Evidence:** 86 §1/§4.5 (50 artifacts, 0 kanban facts; scaffold hosted the 42-line simulator verbatim), 87 S5 (brief never enters), 88 §5.9/§2.2 (lastTest of the toy satisfied `p6-test`), 93 DF-01/DF-04 §4.7. **Verified current state:** §0 rows 1–4, 15, 16, 21.

### 1. What the phase SHOULD emit (reasoned from constraints)

Under the deepseek-v4-flash/pro one-key text-only constraint (90 §12.3; §0 row 22) the engine cannot honestly emit a *complete product* in one P6 step for any kind — but it **can and must emit brief-faithful, spec-conformant code for the artifacts a factory can produce**: function/library modules, job/domain modules, CLI entry logic with the briefed flags, storage adapters — synthesized against the brief + `ExpandedSpec` (the artifact 86 §4-4/87 S7 proved the pipeline *can* produce: 12 concrete requirements, type signatures, edge cases) and then machine-verified by the existing verify loop (which is real: `verify.server.ts:503`). MetaGPT's factory evidence [W row 23] is exactly this shape: the brief → structured requirements doc (PRD) → interface/file design → Engineer implements named functions → QA verifies; our `expandBrief` output *is* the PRD and `typeSignatures` *are* the interface definitions. The toy stays **only as the deterministic no-key floor, renamed and labeled honestly**, and the new `p6-brief-fit` probe makes the *absence of brief-derived code* a recorded, visible, gate-blocking-when-enforced fact instead of a silent pass.

### 2. Patch spec — Part A (deterministic floor honesty; smallest change, S)

**Targets:** `sandbox.ts`, `engine.ts` case 6, `dod.ts`.

1. **Rename the artifact and module title (no-shape-change):** in `engine.ts:528` change artifact title `"Typed synthesis module"` → `"P6 placeholder module (deterministic template)"` and the case-6 `art(...)` body stays byte-identical. Keep `generatedSource`/`lastTest` semantics (p6-test floor untouched) — this is a **content/label change only**; byte-stable fixture updates in `engine.test.ts`/`gates.test.ts` expected.
2. **Retitle the template function for intent** (`sandbox.ts:125`): keep `buildPhase6Module` export name (dozens of call sites/tests) but add a header comment block stating: *"Deterministic NO-KEY floor module. It validates phase-bookkeeping only — it never implements the brief. A keyed run replaces `generatedSource` via liveP6Synthesis (§P0-01 Part B); `p6-brief-fit` fails for this module by construction."* No behavior change.
3. **New pure helper `briefNounHits(brief, source)`** in `sandbox.ts` (or `algorithms.ts`; zero-dep): extract brief nouns via the existing stemmed tokenizer (`algorithms.ts:125-142` `tokens`/`tokenizeWords` are module-private — export a small `briefTokens(brief)` or re-implement the 8-line filter locally in sandbox.ts to avoid export churn; prefer local copy + a test pinning parity with `phraseHits`). Returns `{ hits: string[], required: string[] }` — `required` = brief tokens that are valid JS identifiers (`/^[A-Za-z_$][A-Za-z0-9_$]*$/`) and NOT in a small stoplist (`app, tool, library, with, and, the, for, using, web, simple, tiny, basic, a, an, of, to, in, on, by, from`). Deterministic; no LLM.
4. **New DoD criterion `p6-brief-fit`** appended to `DOD[6]` (`dod.ts:117-172`), additive AFTER `p6-verified` so evidence-hash ordering of existing pairs is untouched (`runGate` sorts `id:pass|fail` — additive criterion changes every P6 hash **only when the probe list length changes the sorted string**, which it does; that is intended and must be documented in the commit; old recorded gates re-verify as drifted — expected, surfaced by E-19 `verifyPriorPhases` `engine.ts:1893`).
   - `criterion: "Brief-conformance: required brief nouns appear as identifiers in generated source (or spec exists and is honored)"`.
   - `probe: (p) => { const required = briefRequiredIdentifiers(p.brief); if (!required.length) return true; /* vocabulary-free brief: nothing to conform */ return identifierHits(required, p.generatedSource ?? "").length >= Math.max(1, Math.ceil(required.length * 0.5)); }`
   - Where `identifierHits` counts word-boundary identifier occurrences of each required token in `generatedSource` **outside string literals/comments** — reuse the masking approach already proven in `sandbox.ts:26-69` (`maskLiteralsAndComments`; export it or duplicate 10 lines with a test). Rationale [R]: the 86/87/88 runs all had brief nouns (`kanban`, `column`, `card`, `drag`, `rename`, `regex`, `dry-run`, `undo`, `mean`, `median`, `percentile`) that never appeared as code identifiers; this probe makes that a recorded FAIL.
   - **Keyless-runs policy (decision, document in `dod.ts` header):** for the no-key deterministic floor this probe will FAIL (the template never contains brief nouns) → with `enforceDod` ON the P6 advance parks with a `Hard DoD block — P6` artifact (`dod.ts:447-466` machinery exists); with `enforceDod` OFF (default, §P0-07) it is recorded `FAIL` and the rail/UI must say so (§P0-07 changes the presentation, never the probe). **Empty-brief projects** (brief < ~6 tokens after stopword removal) pass vacuously with the honest `(no vocabulary to conform)` note — do NOT force a webapp-template brief to fail itself.
5. **P6 HITL copy** (`engine.ts:543-554`): when `result.ok` and the module is the deterministic placeholder, and `project.brief` has required identifiers — do NOT open an approval gate titled "Approve generated module" on the toy. Instead title the *recorded* artifact and memory honestly (step 1) and let the gate open only via `schedule.extraHitl` as today. (Prevents "green verification of a simulator" 93 §4.7.)

### 3. Patch spec — Part B (keyed P6 real synthesis; the actual fix, M)

**Design principle [R]:** mirror the existing async seams — `runPhaseAsync` → `liveLayer` (`engine.ts:1929-1936, 1654+`) and `runP6Real` (`engine.ts:1950-1980`) — so the deterministic sync path is untouched (pure, test-pinned) and the LLM path is a bounded, honest, always-fall-back upgrade. No new runtime deps (90 §10.4 zero-dep rule).

1. **Persist the spec on Project** (87 H3/88 §7.2, closes the orphan): add to `types.ts` Project (`:249-339`, additive):
   ```ts
   /** Brief-faithful implementation spec (prompt-engine expandBrief output), E-30. */
   implementationSpec?: {
     requirements: string[]; edgeCases: string[]; errorHandling: string[];
     typeSignatures: string[]; dataFlow: string[]; negativeConstraints: string[];
     source: "prompt-verb" | "p6";   // who wrote it
     briefHash: string;              // fnv1a(brief) — staleness guard
     createdAt: number;
   } | null;
   ```
   Hydrate defensively in `hydrateProject` (`engine.ts:1324+`): only accept well-formed string arrays (pattern of `usableLattice` `:1260-1269`), drop otherwise with a `hydrate.repaired` log. `emptyProject` leaves it null.
2. **New module `src/lib/codegen.server.ts`** (server-only; sibling to `verify.server.ts`; zero new deps) exporting `liveP6Synthesis(project): Promise<Project>`:
   - Guard: `!isDeepSeekConfigured()` → return project unchanged (caller falls back to deterministic `applyPhaseResult`) — honest `not-configured` path like `prompt-engine.ts:175`.
   - **Step 1 — spec.** If `project.implementationSpec` is absent or `briefHash !== fnv1a(project.brief)`, call `expandBrief(brief, policies)` (`prompt-engine.ts:171`) once; on `{ok:false}` return unchanged (fall back). Store the spec onto the returned project with `source:"p6"`.
   - **Step 2 — synthesis (the prompt contract, [W row 22-informed]).** ONE `completeDeepSeek` call, `model: deepseek-v4-flash`, `json: true` (per 90 §12.3.3 routing: flash = edit generation), explicit `maxTokens` headroom (module ≤ ~600 lines + JSON envelope; use 12 000), and a system prompt that (a) contains the literal word "json" and a **complete worked example** of the expected envelope; (b) forbids markdown fences; (c) is byte-stable across runs (cache-hit economics, 90 §12.3.2-5). User content: `brief` (full, ≤2 000 chars), `spec.requirements` (numbered, all), `spec.typeSignatures` (verbatim — **these are the interface definitions the module MUST export**, MetaGPT Engineer evidence [W row 23]), `spec.negativeConstraints`, `spec.edgeCases` (as test hints only), plus the deterministic emit rules:
     - Module must be plain function declarations + `module.exports.X = X;` assignments (compatible with `withCommonJsExports` no-op path `headless.ts:950-959` and the verify `with(exports)` harness);
     - **zero imports/requires** (zero-dep rule; the harness has no module loader);
     - full JSDoc on every exported function (brief-mandated for library kind);
     - no `process/window/fetch/WebSocket/eval/Function/import/document/localStorage/indexedDB` identifiers (FORBIDDEN list `sandbox.ts:12-13`);
     - never test rejection paths inside the module (parity with `verify.server.ts:463-465` honesty rule — guards are behavior, not bugs);
     - every requirement from the brief must be traceable to at least one export or a code comment naming it (`req-<n>` comment markers — this makes `p6-brief-fit` and the conformance probe deterministic to grep).
   - Envelope: `{"module": "<one code string, no fences>", "exports": ["name1", ...], "reqTrace": {"req-1": "exportName", ...}}`. Parse with the existing tolerant parser pattern (`parseOracleJson` `verify.server.ts:191`); **one bounded repair re-prompt** on parse failure (audit-88 pattern `:480-499`); then deterministic validation: (a) `exports` ⊆ top-level function names regex-scanned from source (the `headless.ts:951` regex); (b) every `typeSignature`'s function name (parse `^export (declare )?function|^function name` and `name(` prefixes from the signature lines) must appear in `exports` **or** be reported as absent → this check is the *mechanical* brief-fit floor and needs no LLM; (c) FORBIDDEN scan via `maskLiteralsAndComments` (export from sandbox.ts) + regex.
   - **Step 3 — machine verify (reuse, don't build):** run the existing `verifyAndFixServer(withCommonJsExports(module), brief, {maxIterations:3})` (`verify.server.ts:503`); additionally thread `oracleToCaseSeeds(project.oracle)` (`dod.ts:416-421`) and `spec.typeSignatures` into a NEW optional `opts.spec` param of `generateCases` (see P0-01 §5 prompt change) so the oracle is no longer self-referential (87 S6/93 §4.15 — currently closed for brief only, not requirements).
   - **Step 4 — honest state:** return project with `generatedSource = module`, `lastTest = {ok: status==="passed", detail: evidence, label:"tested", evidenceHash}` (same shape `applyVerifyOutcome` mints, `headless.ts:1016-1018`), plus a kind-`"code"` artifact `"Generated module (LLM, machine-verified)"` body = source, and artifact `"Verify outcome"` with cases/iterations/evidence (mirror `applyVerifyOutcome` `:994-1012`). On `status:"failed"|"error"` → return **unchanged** project (deterministic floor stands; log the refusal `RT_E_*` taxonomy — never fabricate a pass).
3. **Engine wiring (async path only):** in `liveLayer` (`engine.ts:1654+`), before the generic overlay when `phase === 6 && llmConfigured`: run `liveP6Synthesis` instead of/in addition to `applyPhaseResult` — concretely: `const done = phase === 6 && (await llmStatus()).configured ? await liveP6Synthesis(project) : applyPhaseResult(project, phase);` (defensive try/catch → deterministic fallback, matching `runPhaseAsync` `:1929-1936`). The store's `synthesizeAsync` (`store.ts:408-420`) already routes configured runs through `runPhaseAsync`, so the UI path inherits the fix with **zero store changes**.
4. **CLI/headless parity:** add headless verb wrapper `liveP6(id)` calling the same seam (or document that `verify` + `ingest` of a report is the headless path); wire `scripts/rapidtool-cli.mjs` `verify --apply` convergence (§P0-09) so a headless run reaches the same recorded state.
5. **Scaffold emit integration (kind-aware):** `scaffoldProject` (`scaffold.ts:971+`) already flavors by `projectKindOf` — when `project.implementationSpec?.typeSignatures` exists, the scaffold's stub files for `library` kind (`:552-668`) should embed the type signatures as the file headers + TODO(E-15) bodies (so the emitted tree *names* the brief's API even before implementation). Out of the strict P6 lane but same change set.

### 4. Prompt changes (exact, for the codegen prompt)

System (byte-stable; first line contains "json"):
```
You are RapidTool's P6 code generator. You implement ONE TypeScript-style CommonJS module
that satisfies the brief and the spec below. Return a single JSON object — the word json,
exactly this envelope, no markdown fences, nothing before or after:
{"module":"...complete module source as one string...","exports":["f1","f2"],"reqTrace":{"req-1":"f1"}}
RULES (all mandatory):
1. Export EXACTLY the functions the spec's typeSignatures name; nothing more, nothing less.
2. Zero imports, zero requires, zero external deps. Plain functions only. Assign module.exports.
3. Full JSDoc on every exported function.
4. Never reference process/window/fetch/WebSocket/eval/Function/import/document/localStorage/indexedDB.
5. Mark each requirement you implement with a "// req-N" comment on the implementing function.
6. Never test rejection paths inside the module; guards are behavior, not bugs.
7. Do not invent features the brief does not state. Do not soften or drop a stated requirement.
```
User: `BRIEF:\n<brief>\nREQUIREMENTS:\n1. …\nTYPE SIGNATURES (must export):\n<each line verbatim>\nNEGATIVE CONSTRAINTS:\n…\nEDGE CASES (behave sensibly; do not add APIs):\n…`

### 5. Verify-loop prompt change (grounds the oracle in requirements — 87 H6/93 §4.15)

`generateCases(source, brief, opts?: {spec?: …; oracleSeeds?: string})` (`verify.server.ts:446`): append to the existing prompt (`:457-473`) — after `Brief:…`:
```
REQUIREMENTS FROM THE SPEC (test these, not the module's own claims):
<each spec.requirement>
REQUIRED EXPORTS FROM THE SPEC (fail the case when absent: typeof name === "function"):
<each typeSignature function name>
PINNED ORACLE ROWS (keep each as one case with its exact id):
<oracleToCaseSeeds(project.oracle)>
```
And in `verifyAndFixServer` (`:503`) require ≥1 case per required export when spec present; a missing required export yields `status:"failed"` with evidence naming the missing name — kills the "module agrees with itself" mode (87 S6). `missingOracleCaseIds` (`dod.ts:427-430`) is the ready-made checker — call it after parse and reject/retry once when non-empty.

### 6. Test plan (regression cases, gates expected)

| # | Test | Location (new) | Asserts |
|---|---|---|---|
| T1 | `brief-fit.test.ts` — pure probe | `src/lib/brief-fit.test.ts` | kanban brief vs toy module → `p6-brief-fit` FAIL; kanban brief vs module declaring `createBoard/Column/Card` identifiers → PASS; empty/vocab-free brief → vacuous PASS; string-literal-only noun ("rename" inside a comment) → FAIL (masking works) |
| T2 | Deterministic-floor byte-stability | extend `sandbox.test.ts` | `buildPhase6Module` output byte-identical for same args (existing fixtures unchanged; only header comment added — update pinned strings if the header is inside the emitted string; prefer comment OUTSIDE the returned string to keep fixtures) |
| T3 | P6 gate hash drift documented | `gates.test.ts` | runGate(project,6) with 5 criteria → evidenceHash includes `p6-brief-fit:pass\|fail`; old 4-criterion hashes no longer match (assert the drift is the ONLY change — additive criterion) |
| T4 | liveP6Synthesis happy path (fake `completeDeepSeek` injectable — the codebase already injects reviewer/worker fakes: `sandbox.test.ts` precedent) | `codegen.server.test.ts` | returns module; exports match typeSignatures; lastTest label "tested"; no network when not configured (returns same reference) |
| T5 | liveP6Synthesis failure path | same | unparseable JSON ×2 → unchanged project (fallback); verify `failed` → unchanged project; FORBIDDEN token in module → rejected before verify |
| T6 | Oracle grounding | `verify.server.test.ts` | generateCases prompt contains spec requirements + pinned oracle rows; missing required export → failed verdict evidence names it |
| T7 | E2E corpus regression (the 86/87/88 briefs) | `npm run eval` (per 90 §10.4/§10.5-5) | kanban brief + fake key → generated module contains `board/column/card` identifiers; renamer brief → `rename`/`dryRun`/`undo` exports; statkit brief → `mean/median/stddev/percentile` exports. **Gate: wrong-product `complete` = 0 on the corpus.** |
| T8 | Keyless floor | existing suites | no-key P6 run still completes deterministically, `p6-brief-fit` recorded FAIL, `p6-test` PASS — and with `enforceDod:true` the advance parks with the hard block artifact (P0-07 UI shows it) |

**Gates expected:** `node --experimental-strip-types --test src/lib/*.test.ts` green; `npm run typecheck` green; determinism fixtures byte-stable; zero new runtime deps. Kill criterion: if T7 cannot pass with a real keyed run on all three corpus briefs within the P0 wave, ship Parts A (honest floor + probe) only and re-open Part B — the probe alone already converts the silent toy pass into a recorded, visible FAIL (93 §6 ordering: "everything else is lipstick until this lands").

---

## P0-02 — LEX dev-tool/library register + vague-brief consequences (87 H1/H2, 88 §7.1-1/2, 90 §10.5 #2)

**Rank: P0 (root-cause layer of the wrong-product class) · Evidence:** 87 S1 (RenamePro: zero CLI vocab → fallback), 88 §5.1 (StatKit: `median/percentile/stddev` absent), 86 §4.2 (kanban vocab absent). **Verified:** `algorithms.ts:24-111`, fallback `:200-204`, honest `vague` flag; test-pinned fallback behavior (`algorithms.test.ts:131,165` per 87 §2-S1).

### 1. Patch spec

1. **Add register entries** to `LEX` (`algorithms.ts`), constrained to *word-boundary stemmed* hits (the `phraseHits`/`tokenizeWords` machinery `:133-142` already handles inflection):
   - `job`: `rename`, `convert`, `parse`, `format`, `analyze`, `summarize`, `validate`, `generate`, `export`, `import`, `sync`, `download`, `aggregate`, `sort`, `filter`  *(keep conservative — each term must not collide with ops-domain senses already present)*
   - `object`: `file`, `files`, `folder`, `directory`, `name`, `glob`, `column`, `card`, `board`, `list`, `todo`, `note`, `document`, `image`, `function`, `api`
   - `constraint`: `dry-run`, `regex`, `undo`, `offline`, `zero-dependency`, `typed`, `cli`, `keyless`, `privacy`, `local-only`
   - `actor`: `user` (already `operator`), `developer`, `analyst`
   - new kind **`kindhint`** — terms that MUST NOT create jobs/entities but MUST feed `projectKindOf`-style kind detection: `library`, `package`, `sdk`, `cli`, `web app`, `dashboard`, `board`, `game`, `api`, `service`. Implementation: extend `IntentLattice` nodes' `kind` union is invasive; cheaper: export a parallel `const KIND_HINT_TERMS` array + pure `kindHints(brief): string[]` from `algorithms.ts` and consume it in `scaffold.projectKindOf` (or its caller) so lattice and kind agree from P0.
2. **Vague-brief knowledge capture (87 H2a):** at the fallback site (`algorithms.ts:200-209`) there is no I/O allowed (pure) — so do the write in the **caller** `runAlgorithms` is not the right seam either (pure). Correct seam: `attachAlgorithms`/`emptyProject` (`engine.ts:1132-1135`) and `applyPhaseResult` already run post-P0 — add one line in `synthesizePhase` case 0 (`engine.ts:~300-345`): when `lattice.vague && brief.trim().length > 0`, push a memory row `{kind:"note", text:"LEX gap: brief matched no job/entity vocabulary — lattice fell back to deliver-core-workflow. Tighten brief or extend LEX.", source:"engine", score:0.5}` and append a `lattice.vague` info log (deterministic, idempotent — same brief → same row; dedupe by the existing `dedupeMemoryIds`).
3. **Vague ⇒ reframe gate stays** (`engine.ts:333-344` forceHuman) but add the DoD criterion `p0-brief-grounded` (87 H7): in `DOD[0]` (`dod.ts:48-66`):
   ```ts
   { id: "p0-brief-grounded",
     criterion: "Non-empty brief produced job/entity vocabulary (lattice.vague must be false when the brief has ≥1 vocabulary-bearing token)",
     probe: (p) => !(p.lattice?.vague === true && briefHasVocabulary(p.brief)) }
   ```
   where `briefHasVocabulary` = the brief contains ≥1 token that `phraseHits` would ever match (cheap proxy: any token not in STOP + length > 2; NOTE: this makes the probe ≈ always true for real briefs → the criterion then *records* whether a real-brief run sailed on fallback vocabulary. Keep the honest semantics: **the reframe HITL's approve-with-note (§P0-06) is the override**; `p0-brief-grounded` unmet on a real-brief run = the 87/88 signature, now recorded).
4. **Tests:** extend `algorithms.test.ts` with three fixture briefs asserting NO fallback fires: renamer brief (87 §4 H1: job `rename`, constraint `dry-run|undo|regex`, object `file`), statkit brief (object... note: `mean/median/stddev` are NOT in LEX objects — statistics functions are *functions*, not objects; add object terms `statistics` only, and let kind=library routing (P0-01 spec + `KIND_HINT_TERMS`) carry the function-level semantics — the lattice's job concept does not model numeric functions, which is exactly why A6/A7 need the function model (88 §7.1-2/3) — fold function-contract synthesis into the P0-01 Part B spec when `kindHints` includes library), kanban brief (object `board|column|card|list`, no fallback).

### 2. Gates expected
Existing lattice tests still pin the OLD fallback for OPS briefs (dispatch etc.) — unchanged. New tests assert no-fallback for the three corpus kinds. Byte-stability: LEX additions change lattice output for matching briefs only; no-key fixtures using ops briefs stay byte-identical (verify via `algorithms.test.ts` run).

---

## P0-03 — P8 must synthesize for the CLIENT or emit a labeled "prototype pending" artifact; P8 gate may not ask approval of RapidTool's own console (DF-02, 93 §6 #3)

**Rank: P0 · Evidence:** 93 §0/§4.9 (Interface contract = RapidTool's console; gate prompt "Confirm the console surfaces"; "Preview: live canvas…" describes a canvas that does not exist), 86 §1 (P8 artifact "Interface contract" `:589` hardcodes RapidTool orchestration description), 88 §5.2/§4.8 P8 note (phase summary promises React+Tailwind generation; P8 emits no client code). **Verified current state:** §0 rows 5, 9.

### 1. What P8 SHOULD emit (reasoned)

The brief says what the CLIENT's product is. For a webapp-kind brief with a real `implementationSpec` (P0-01's persisted spec), P8 should emit a **client-shaped UI contract**: screens the brief names (kanban: board/column/card views; renamepro: CLI has NO UI phase at all — the correct P8 output for cli/library kinds is a short artifact stating "no UI surface in scope (kind=cli-tool)" plus the CLI's flag/help surface spec), each screen bound to the spec's requirements with data flow, and — when the engine has a key and `kind=webapp` — a real React+Tailwind-ish single-file component sketch is NOT feasible inside one flash call at product quality; the honest, achievable deliverable is the **UI contract + interaction map** (screens × requirements trace), labeled exactly as what it is. The design tokens (deterministic, `design.ts:471`) and the scaffold's console shell remain the "look" inputs. For every non-webapp kind, emit the kind-correct artifact listed below instead of the console description. Never emit "Surfaces: intake, phase rail, scorecard, artifact inspector, approval dock" for a client product; those five surfaces are RapidTool's own Run screen.

### 2. Patch spec

1. **`engine.ts` case 8 (`:583-607`) becomes kind-aware** — branch on `projectKindOf(project)` (`scaffold.ts:229`; import scaffold into engine is currently NOT done — engine imports scaffold? [V] engine.ts imports list — re-grep; if absent, duplicate a 6-line kindHints check (P0-02) or move `projectKindOf`-lite into `algorithms.ts` so both consume one source):
   - `kind==="webapp" || "game" || "service"` (UI-bearing): keep an artifact `"Interface contract (client UI)"` whose body is now **derived from the spec/lattice, never from RapidTool's console**: screens = spec requirements filtered to UI-ish verbs + lattice entities; lines: `Screen: <name>` / `Shows: <entities>` / `Binding: req-<n>` / `State: <store field>`. When `implementationSpec` is absent (no key), body ends with the B-18 line: `> prototype pending — no UI code generated; this contract is a declaration (deterministic template), not an implementation (B-18 honesty).` Memory row updated to client wording.
   - `kind==="cli-tool"`: artifact `"CLI surface contract"` = lines from spec requirements + typeSignatures filtered to entry/argv functions (`main`, `parseArgs`, `planRenames`, …) + `Usage: <name> [options] <files>` derived from brief tokens; same B-18 tail when keyless.
   - `kind==="library"`: artifact `"Library API contract"` = the `typeSignatures` verbatim + per-signature `req-<n>` trace; same B-18 tail when keyless.
2. **Gate prompt (`engine.ts:601-606`) becomes kind-true** — replace "Confirm the console surfaces: phase rail, scorecard, artifacts, approval dock" with the kind-specific contract summary, e.g. webapp: `"Confirm the client UI contract: <N> screens derived from the brief (list first 3). Keyless runs: this is a declaration, not implemented UI."` cli: `"Confirm the CLI surface contract (flags + commands derived from the brief)."` library: `"Confirm the library API contract (typeSignatures from the spec)."` Add `forceHuman` stays as-is (P8 is stock HITL; unchanged).
3. **P8 phase summary in `phases.ts:70-75`** becomes honest: `"UI/UX contract synthesis — screens/CLI/library API surfaces derived from the brief; component code only with a live key and only for webapp kind"`. (Do NOT promise "live canvas preview" — nothing renders one.)
4. **Design tab decoupling note (93 §3.12 P1 note):** the P8 gate evidence list (`evidenceForGate` `console.tsx:152-205`) should include the design-token summary line so the human sees the palette artifact near the UI gate; presentation-only, S-effort, same change set.

### 3. Test plan

| # | Test | Asserts |
|---|---|---|
| U1 | `engine.test.ts` fixture per kind | P8 artifact for cli brief contains no "phase rail/scorecard/approval dock" text; for library brief contains `typeSignatures` text; for webapp brief names brief entities, not RapidTool surfaces |
| U2 | keyless B-18 line | every kind's P8 artifact ends with the "declaration, not implementation" line when `implementationSpec` absent; keyed fake (`liveP6Synthesis`-style injection) omits it only when a real spec is present |
| U3 | Gate-prompt fixtures | HITL prompt text per kind pinned (no console wording in any kind) |

**Gates:** existing P8 gate probes (`dod.ts:189-200` `p8-ui` presence + `p8-complete`) unchanged — artifact kind stays `"ui"` for all kinds (rename kind not needed; body content changes only, keep `hasArtifact(p,8,"ui")` green). Byte-stability fixtures for the deterministic keyless P8 body updated once.

---

## P0-04 — Declare-or-strike: no artifact states an unimplemented capability as fact; phase catalog stops selling the agent-platform (DF-03/04/06 + P5 title; 93 §6 #2, 90 §10.2-8 remainder)

**Rank: P0 · Evidence:** 93 DF-03 (P1 topology fixes every build to the agent-harness domain), DF-04 (P3 MCP+A2A contracts; P10 grok-4.5/Ollama; P11 Brave MCP bind), DF-06 (P2 "Durable checkpoint key" claims a persistence layer that is localStorage-only), 86 §4.1/§4.6, 87 §2-S2, 88 §5.3 (phase graph = the tool's own). **Verified current state:** §0 rows 6, 8, 9. P4's B-18 disclaimer (`engine.ts:450`) is the pattern to spread.

### 1. What the phases SHOULD emit (reasoned)

Two separate wrongs are fused here: (a) **domain wrongness** — P1/P2/P3 artifacts describe *building an agent platform* (dispatcher topology, LiteLLM failover, MCP WebSockets, RRF re-rankers, Ollama) regardless of the brief; (b) **truth wrongness** — those descriptions are stated as the *client build's* implemented capabilities when RapidTool itself does not have them. Fix (a) by making each phase's artifact derive from lattice/kind like P0-03 does, or emit a labeled domain-neutral deliverable; fix (b) with the B-18 "declaration, not implementation" tail plus a **capability ledger** the artifact bodies read from, so "what this build will run on" is one source of truth. The phase catalog (`phases.ts`) summaries are prompt context for every downstream agent — they must stop asserting the platform.

### 2. Patch spec

1. **New pure capability ledger `src/lib/capabilities.ts`** (zero-dep; single source of truth; consumed by artifact templates AND the packet):
   ```ts
   export const CAPABILITIES = {
     runtime:  { implemented: ["sync-template"], declared: ["worker-isolate", "node-bounded-runner"], claim: "Engine-template runner (bounded, engine-authored code only); server-side bounded runner; Worker isolate declared, not a product path (E-29)." },
     network:  { implemented: ["tavily-research", "deepseek-llm"], declared: [], claim: "Outbound: DeepSeek API + research providers only. No MCP client, no Brave, no repo.fs, no sandbox.exec servers (P2-3 roadmap)." },
     memory:   { implemented: ["project-memory-80-row", "knowledge-store-file"], declared: ["durable-checkpoints", "cross-encoder-rerank"], claim: "Persistence = browser localStorage + JSON project files. No durable checkpoint layer, no RRF/cross-encoder (FusionRank is lexical, deliberately)." },
     model:    { implemented: ["deepseek-v4-flash", "deepseek-v4-pro"], declared: [], claim: "No grok-4.5, no Ollama, no failover routes. modelRoute honesty enforced (E-14)." },
     concurrency: { implemented: ["sequential-13-phase"], declared: ["parallel-fanout", "websocket-tool-streams"], claim: "Linear graph only (phases.ts:126-132); parallel workflow + WebSocket progress frames do not exist." },
     learning: { implemented: [], declared: ["self-learning-loop"], claim: "P5 self-learning title only — no loop behind it (90 §10); write-back is M-08/G-25 roadmap." },
   } as const;
   export function capabilityLine(area): string  // "- <area>: IMPLEMENTED <…> | DECLARED <…> — <claim>"
   export function b18Tail(): string             // "> Implementation today: <runtime.claim> — the policy above is the P4-style declaration (B-18 honesty)."
   ```
   P4's existing artifact line (`engine.ts:450`) and `sandboxClaim` (`sandbox.ts:163-173`) migrate to read from it (keep their exported names/strings pinned by tests — `sandbox.test.ts` pins messages).
2. **Rewrite artifact bodies in `engine.ts` to template + B-18/capability tail:**
   - **P1 case 1 (`:347-376`):** replace the fixed "Dispatcher topology" artifact with `"Execution topology (this build)"` derived from kind: for agent-ish briefs (lattice hit on dispatch/workflow/agent terms) keep the sequential-graph description BUT delete the invented `workflow.parallel`/`workflow.loop`/`failover.LiteLLM` lines and end with the capability tail "Linear sequential graph only…". For cli/library/webapp briefs the artifact body = `"Sequential pipeline: <brief summary of the client's own module/process flow from spec.dataFlow lines>"` + tail. Memory row `:373` rewrite to the client's flow.
   - **P2 case 2 (`:377-403`):** strike "Durable checkpoint key: project:{id}:phase:{n}" and "Resume policy" — replace with `"Persistence model: <localStorage/JSON export; no durable checkpoint layer (capability ledger)>"`; strike RRF/cross-encoder lines, replace with `"Retrieval: FusionRank lexical ranking (deliberately not RRF — algorithms.ts header)"`. Memory rows `:399-400` updated ("Checkpoint written for X after P1" is a lie — replace with an honest row).
   - **P3 case 3 (`:404-430`):** replace the MCP+A2A JSON with the capability tail + a small JSON: `{"declared_servers": [], "implemented": {"research": ["tavily","duckduckgo"], "llm": ["deepseek"]}, "note": "MCP client is roadmap P2-3 — no servers exist at runtime (B-18)"}` (keep kind `"mcp"` so `p3-mcp` probe `dod.ts:86-92` stays green).
   - **P10 case 10 (`:653-670`):** strike grok-4.5/Ollama/failover lines; body = `"Inference routing: deepseek-v4-flash (draft/gates) / deepseek-v4-pro (verify/architecture) — the only configured routes (E-14; see llm.ts)"`.
   - **P11 case 11 (`:671-704`):** replace the brave.search JSON with `{"implemented": {"research": "tavily/ddg"}, "declared": {"mcp": "roadmap P2-3"}, "note": "No MCP binding, no mid-run API attach, restart_required n/a (B-18)"}`; queries field stays as the research-query template (it is real: `researchQueryFor` `engine.ts:1552-1556`).
   - **P5 case 5 (`:464-492`):** artifact title stays, body's "Simulated user paths" block becomes `"Validation contract (HITL rules the engine actually enforces): <the real rules: ≥12-char rejection, forceHuman bars autopilot, linear graph>"`; strike "adversarial simulation" claims; append capability tail line for learning. **`phases.ts:45-51` P5 summary** → `"Validation & HITL contract — approval gates with mandatory feedback; (self-learning loop is roadmap P0-5, not yet implemented)"`.
3. **Phase-catalog honesty (`phases.ts`) — one change set:** rewrite the *summaries* (never the ids/titles — titles are ledger-stable) of P1 `:15-19`, P2 `:23-27`, P3 `:31-35`, P4 `:39-43`, P6 `:55-59`, P8 `:70-75` (P0-03), P10 `:87-90`, P11 `:95-98` to describe **what the phase produces for the client's build** in kind-neutral terms, e.g. P1: `"Execution flow & state design for the briefed product (topology artifacts are kind-derived; agent-platform content only for agent-platform briefs)"`; P2: `"Context & persistence plan — project memory rows, spec grounding, honest persistence model"`. This is a text change to prompt context; verify no test pins the old summaries verbatim (grep `phases.test.ts`; the packet/UI render `title` only in most places — `console.tsx` uses `p.title`, phase rail shows titles, summaries flow into `synthesizePhase` logs `:258` and crew phaseTitle — no byte-pins expected except where tests snapshot packet bodies; update those fixtures once).
4. **Honesty lint hook (optional but cheap):** add `scripts/check-capability-claims.mjs` (pattern: `check-auth-invariant.mjs`) that greps `engine.ts` case bodies for the retired claim strings (`grok-4.5`, `Ollama`, `brave.search` as a *server binding*, `Durable checkpoint key`, `RRF(k=60)`, `256 MB`) and fails — the postmortem→guardrail pattern (13 §13.6) applied to DF-04 so the lies cannot regress. Wire into `npm run ci` when it exists (90 §13.2).

### 3. Test plan

| # | Test | Asserts |
|---|---|---|
| C1 | `capabilities.test.ts` | capabilityLine/b18Tail output stable; ledger claims match the implementation booleans (self-consistency: `implemented` arrays vs `declared`) |
| C2 | artifact-body contract tests per phase | for each phase in {1,2,3,5,10,11}: deterministic keyless body contains the capability tail; contains NO retired strings (grok-4.5/Ollama/brave.search-binding/Durable checkpoint key/RRF(k=60)/256 MB) |
| C3 | kind-derivation | P1 body for a cli brief differs from P1 body for a webapp brief (derived from dataFlow); both lack "Dispatcher topology" |
| C4 | regression-lint | `check-capability-claims.mjs` passes on the tree; a planted retired string fails it (guardrail test) |
| C5 | phase-summary snapshots | any test/packet fixture pinning old summaries updated once; gate probes (`hasArtifact` kind checks) unaffected |

**Gates:** all P<->DoD presence probes keep their artifact kinds (`graph`/`memory`/`mcp`/`validation`/`edge`/`tools`) — rename nothing; only bodies/labels change. Determinism: new bodies are pure string templates over project fields — byte-stable fixtures updated once. Sequencing: land P0-04 together with P0-03 (same template files), BEFORE P0-01 Part B so the codegen prompt never sees the old platform-flavored packet sections (90 §11.3 cross-ref: DF-03/04/06 feed Phase-0).

---

## P0-05 — P4 gate prompt must state the implemented runtime; no gate may approve an unimplemented policy (DF-05, 93 §6 #3)

**Rank: P0 · Evidence:** 93 DF-05 (HITL asks "Confirm 256 MB / 30s isolate, deny-network during exec, and user-scoped OAuth on every tool" while runtime = `sync-template`, `ramMb:null`; 87/88 drivers approved it in seconds), 93 §4.5. **Verified:** §0 row 7; the artifact already carries the correct B-18 disclaimer (`engine.ts:450`) — the gate prompt is the lie, and the HITL evidence bundle (`console.tsx:152-205`) does not surface the artifact body the human would need to notice it.

### 1. Patch spec

1. **Gate prompt (`engine.ts:456-462`)** → state the implemented boundary verbatim from state + ledger:
   ```
   prompt: `Confirm the implemented execution boundary: ${sandboxClaim(project.sandbox)} (timeout ${project.sandbox.timeoutS}s, ramMb ${project.sandbox.ramMb ?? "unset"}), ${project.sandbox.isolated ? "isolated" : "non-isolated"} flag, and network deny only inside the engine-template runner. Declared-not-implemented (do NOT approve as fact): 256 MB cgroups/gVisor/WASM isolates, OAuth-scoped tool calls, worker sandbox.`
   ```
   Keep title/stakes. This makes the approval honest either way: approving = "I accept this declaration for the build record"; the HITL decision + note lands in the ledger (`engine.ts:900-991`). When `project.sandbox.runtime === "worker"` (future) the prompt auto-flips to the worker claim via `sandboxClaim` — no second code path.
2. **Evidence bundle addition (S, UI):** `evidenceForGate` (`console.tsx:152-205`) — for P4 add a row rendering `sandboxClaim(project.sandbox)` + `runtime`/`ramMb`/`timeoutS` so the human sees the real boundary in the dock, not only in an artifact body. (Same helper reused for the P6 dock row in P0-07.)
3. **Symmetry with P0-06:** because this gate is stock HITL (not forceHuman), the note requirement does not apply to routine approvals — but the §P0-06 note rule DOES apply when the recorded P4 DoD gate fails (`p4-security`/`p4-approved` are presence probes; add no new criterion here — DF-05's fix is the prompt text + the visible boundary).

### 2. Test plan

| # | Test | Asserts |
|---|---|---|
| S1 | gate-prompt fixture | P4 hitl.prompt contains "Engine-template runner" + "ramMb" and does NOT contain "256 MB / 30s isolate … OAuth" as a confirmation ask |
| S2 | sandboxClaim parity | `sandboxClaim({runtime:"sync-template",…})` string unchanged (pinned in `sandbox.test.ts`) — only the gate prompt text changes |
| S3 | UI row | `evidenceForGate` includes the sandbox-boundary row for phase 4 (pure helper test if extracted; console render test per repo's UI-smoke precedent) |

**Gates:** deterministic — pure string changes; keyless fixtures updated once.

---

## P0-06 — Approval-note symmetry: approvals that override a failed/forceHuman gate require a ≥12-char note (DF-09; 87 S2, 88 §4.11/§6.2-5; 90 §10.4/§10.5 #3)

**Rank: P0 (governance half of the wrong-product class — the 15-second null-note reframe approval is how every verdict run sailed on the fallback domain) · Evidence:** 87 S2 (reframe approved 15 s, `note:null`, by a gate-green-seeking driver), 88 §4.3/§5.2 (5/5 approvals `note:null` incl. over failed P6/P0 DoD), 93 DF-09. **Verified current state:** §0 row 11.

### 1. Patch spec (engine law first, UI second, store/headless third — the triple-guard pattern of the rejection path must be mirrored)

1. **`engine.approveHitl` (`engine.ts:900-991`):** add note requirement exactly where the rejection rule lives (`:993-1001`):
   ```ts
   const trimmed = (opts?.note ?? "").trim();
   const needsNote = Boolean(project.hitl?.forceHuman) || forcedOverride;
   if (needsNote && trimmed.length < 12) {
     throw new Error("Approving a human-only gate (forceHuman) or overriding a failing sandbox requires at least 12 characters of qualitative feedback (ADR-002 mirror).");
   }
   ```
   Compute `forcedOverride` before the check (move `:928-929` up). Do **not** require a note for routine stock-HITL approvals (P4/P5/P8/P9 happy-path, gate green) — the 87/88 defect is specifically *approve-over-unmet-DoD*; requiring notes on every approval would drown the ledger in ritual (90 §10.4 keeps the asymmetry fix scoped to override).
2. **`store.approve` (`store.ts:975-1013`):** mirror — when `project.hitl.forceHuman` (incl. the failed-P6 case guarded at `:983-993`) or the recorded gate for the current phase is FAIL and `enforceDod` is on, reject with the same ≥12-char message unless `opts.note` ≥12. Pass `note` through to `approveHitl` (`:1001-1003` call site gains `note: opts?.note`).
3. **`headless.approve` (`headless.ts:502-515`):** add the same guard before `approveHitl` (`:507`); the headless/CLI driver is exactly the actor the verdicts show abusing the null note.
4. **UI (`HitlDock` `console.tsx:2712-2732`):** when `needsOverride` is true, reuse the existing note textarea as **required**: Approve disabled until `note.trim().length >= 12`; helper copy "This approval overrides a failing check — a written reason is required (mirrors the rejection rule)". When `h.forceHuman` and phase ≠ 6 (P0 reframe), the same requirement applies (currently the override checkbox only renders for phase 6; extend `needsOverride` to any `h.forceHuman` gate and render the note-required state).
5. **Wild-mode note:** `wildApproveGate` (`engine.ts:2154-2236`) already routes forceHuman to pause (`:2166-2175`) — unchanged; the classifier's own approvals carry ≥12-char feedback as the note (`:2205`) — unchanged.

### 2. Test plan

| # | Test | Asserts |
|---|---|---|
| N1 | engine approve path | approveHitl(forceHuman gate, note <12) throws; note ≥12 succeeds and lands in the ledger row `note`; routine stock gate with no note still succeeds |
| N2 | store/headless parity | same three cases through `store.approve` and `headless.approve` |
| N3 | UI | Approve disabled with short note when override needed (render/behavior test per repo precedent) |
| N4 | regression corpus | a canned "approve reframe note:null" fixture (87's exact payload) now throws — the verdict-run anti-pattern is a test |

**Gates:** existing approve-path tests that pass no note on non-forceHuman gates stay green (no behavior change there); autopilot tests unaffected (autopilot never reaches forceHuman).

---

## P0-07 — Advisory-gate "sealed" lie: presentation honesty + the enforceDod default decision (DF-08, 90 §10.2 #3, 93 §4.14/§6 #5)

**Rank: P0 (the UI camouflage that makes a FAIL-gated 13/13 run read as governed success — 93 §0) · Evidence:** 86 §1 (13/13 complete, P6 gate `passed:false`), 88 §2.1/§5.10 (2 failed gates, all phases complete), 93 DF-08 (rail/packet say sealed/complete while drill-down admits "advisory — recorded, not blocking"). **Verified current state:** §0 row 10.

### 1. The default decision (make it explicitly, don't let it ride)

**[R] Keep `enforceDod` default OFF (`engine.ts:1127`) in this wave — but ONLY because the keyless floor cannot pass `p6-verified`/`p6-brief-fit` (P0-01) without a key, and flipping the default would park every no-key run at P6 with no escape but the very override the run may not survive.** Document this in the `types.ts:318-327` comment and in Settings, and pair it with the presentation honesty below so the OFF default stops being invisible. Revisit the flip in the P1 wave when `p6-brief-fit` + `p6-verified` have keyless-honest states (the P0-01 Part A probe gives the OFF state something truthful to show).

### 2. Patch spec (presentation — engine/UI/packet, no gate-authority change)

1. **Progress rail (`console.tsx:2450-2463`):** count honestly.
   - `sealedOk` = complete phases whose `rec.gate?.passed === true`; `sealedFail` = complete phases whose `rec.gate` exists and `passed === false`; `sealedUnknown` = complete with no recorded gate (legacy).
   - Replace `{done}/{total} sealed · {pct}%` with `{sealedOk}/{total} sealed{sealedFail ? ` · {sealedFail} FAIL-gated` : ""}{sealedUnknown ? ` · {sealedUnknown} un-gated` : ""}`. Tone: FAIL count in `text-warn`/`text-danger`.
   - Segment tooltips/labels (`.rail-seg`): complete+FAIL segments render the existing `bg-ok` only when gate passed — otherwise `bg-warn` with title `P{n} complete — DoD FAIL recorded (advisory)`; complete+no-gate → `bg-faint` hatched styling (CSS class, no new deps).
2. **Phase-rail "sealed" vocabulary:** engine log strings "All 13 phases sealed" (`engine.ts:752`), `wildFinalize` `"Wild run complete — all 13 phases sealed"` (`engine.ts:2316,2320`), and the delivery memory row — change to the honest conditional: when the run's recorded gates contain any FAIL, emit `"Run complete — {n} phase(s) recorded with FAIL gate (advisory)"` + list ids; only when every recorded gate passed emit "sealed". Pure string change at 3 sites; wire a helper `sealSummary(project)` (in `dod.ts`, tested) so all three sites agree.
3. **Gate drill-down already honest** (`console.tsx:4663` "advisory — recorded, not blocking") — keep, but move a one-line verdict into the rail/`StatusBadge` so it is visible without opening the record.
4. **Packet honesty:** `systemJson` (`packet.ts:123-128`) already exposes `gate_passed` per phase — add one envelope line `gate_summary: "{sealedOk}/{total} gates passed; {failCount} recorded FAIL (advisory unless enforceDod)"` (packet is `gate_passed` consumers' ground truth; the summary kills the "13/13" misread by downstream agents). `PACKET_VERSION` stays 3? The envelope gains one field — additive JSON; per 90 §10.3 format-stability rule, bump only if a consumer validates the shape strictly; check `exportProfiles`/handoff consumers; prefer additive without bump, note in commit.
5. **HITL dock evidence for FAIL-gated approvals:** when the pending approval's phase already has a recorded FAIL gate (`phases.find(p=>p.id===h.phase).gate?.passed===false`), prepend a `text-danger` row to `evidenceForGate` (`console.tsx:152-205`): `"DoD gate for this phase is FAIL (recorded, advisory) — approving records an override of unmet criteria; a ≥12-char note is required (P0-06)."` This is the DF-08 × DF-09 junction — the override becomes visible AND noted.

### 3. Test plan

| # | Test | Asserts |
|---|---|---|
| R1 | `sealSummary` unit | project with P6 gate FAIL + 12 PASS → "complete — 1 phase(s) recorded with FAIL gate (advisory)"; all-PASS → "sealed"; legacy no-gate records counted separately |
| R2 | rail render | FAIL-gated complete phase renders warn tone + count line (render test; console is untested today — extract `sealStats(project)` pure helper to `dod.ts` so R1 covers the logic, UI test optional per 13 §13.3 row 5) |
| R3 | packet gate_summary | compileAgentPacket envelope contains gate_summary matching recorded gates |
| R4 | wild completion log | wildStep to P12 on a FAIL-gated project logs the honest completion string (extend existing wild tests) |

**Gates:** no DoD probe, gate record, or advance logic changes — presentation/log/ledger-copy only; determinism unaffected (pure helpers). Existing fixtures pinning "All 13 phases sealed" log text updated once (grep `engine.test.ts`, `wild*test.ts`).

---

## P0-08 — Packet re-stamp convergence: wild gate path + P12 wild terminal packet (maker #3; 31 §1.2 residual; 43 H43-P3-1 net)

**Rank: P0 (a wild/headless run's exported packet must never claim `gate_passed:null` for a phase whose gate WAS recorded — a downstream agent reads that as ungoverned) · Evidence:** 86 §1 maker finding #3 ("Wild P12 path calls recordGateInto but never re-stamps the packet"), 31 §1.2 (P12 gate never recorded / packet stale), 43 H43-P3-1 (autopilot stamps before recordGate). **Verified current state:** §0 row 17 — partial fix landed (`engine.ts:2421-2424`); two holes remain:
- **Hole A — `wildApproveGate` (`engine.ts:2229-2235`):** `recordGateInto(candidate, phase)` runs AFTER `approveHitl` compiled the packet (`engine.ts:990` via `sealPacketArtifact(attachAlgorithms(withGate))`). The gate *verdict* is inline-recorded (ST-1, so `gate_passed` is non-null), but the packet's artifact window/log tail predate the gate artifact swap + `gate.verdict` log → stale `## Artifacts (trimmed)` and log order on every wild self-approved gate.
- **Hole B — P12 wild (`engine.ts:2418-2420`):** `wildFinalize(recordGateInto(done, phase), phase)` records the gate but the terminal packet was compiled inside `applyPhaseResult` (`:867-868`) BEFORE `recordGateInto` → terminal packet `gate_passed: null` for P12 on wild runs (sync runs stamp after, `store.ts:386`).

### 1. Patch spec (one-line class; 43's own "re-stamp after the final recordGate" prescription)

1. **Hole A:** `engine.ts:2229` `const gated = recordGateInto(candidate, phase);` → `const gated = stampPacket(recordGateInto(candidate, phase));` (stampPacket is already imported in engine.ts — `:222` definition, used at `:2424`).
2. **Hole B:** `engine.ts:2418-2420` → `return wildFinalize(stampPacket(recordGateInto(done, phase)), phase);` — and for belt-and-braces make `wildFinalize` itself re-stamp when the packet's `gate_passed` for P12 is null (optional; prefer the explicit call so the ledger log ordering stays deterministic).
3. **Store autopilot path parity (43 H43-P3-1):** `store.ts:282` `recordGate(approveHitl(project, {decidedBy:"autopilot"}), phase)` → append `stampPacket(...)` (store.ts imports stampPacket already — `:11`). Verify `store.ts:468` (the second autopilot approve branch in `advanceOnceAsync`) has the same pattern and fix it identically.

### 2. Test plan (regression — 31 §1.2's own test, now enforceable)

| # | Test | Asserts |
|---|---|---|
| K1 | wild self-approval packet | wildStep a project through a classifier-approvable gate (injected fake reviewer, `opts.reviewer` seam `engine.ts:2359-2360`); assert exported packet `## System JSON` `gate_passed` for that phase ≠ null AND the packet body contains the `DoD gate — P{n}` artifact title (artifact window fresh) |
| K2 | wild P12 terminal packet | wildStep to P12 (fake reviewer); assert `phases[12].gate !== null` AND packet System JSON `gate_passed` for phase 12 is true/false (not null) |
| K3 | store autopilot | `runUntilHitlAsync`/`execute` with autopilot on through a gate; packet artifact window contains the gate artifact (43's assertion) |
| K4 | byte-stability | existing packet snapshot fixtures unchanged for non-wild paths |

**Gates:** `wild*test.ts` + `store.test.ts` suites; packet determinism fixtures (same input → same packet bytes, since stamping is deterministic over state).

---

## P0-09 — F2 gate convergence: `verify --apply` must converge the recorded P6 gate + packet (maker #2; 31 §1.3 dead `convergeRealRun` for the headless path)

**Rank: P0 (a PASSED machine verify that leaves the stored gate at `passed:false` is the exact "record lies about the check" failure the product sells against — 86 §1 finding #2, 86 §4.5: "P6 stored gate stays passed:false after a PASSED apply… root cause: headless vs recordGate paths disagree; packet reads stored gates") · Evidence:** 86 §1/§4.5/§4.6; 31 §1.3 (convergeRealRun built, was dead; now wired in store `runModuleReal` only); 23_debug_lead CAVEAT-2 (re-apply duplicates artifacts). **Verified current state:** §0 row 18 — the store/UI real-run path converges (`store.ts:866`), the **headless/CLI `verify --apply` path does not** (`headless.ts:980-1034`, `cli.mjs:543-545`).

### 1. Patch spec

1. **`headless.applyVerifyOutcome` (`headless.ts:980-1034`) — converge when the verdict passes and P6 is complete:**
   - After building the returned project, when `passed && project.phases.some(r => r.id === 6 && r.status === "complete")`: apply `recordGateInto(updated, 6)` then `stampPacket(updated)` (both already imported in headless.ts — `:36`, `:32`). `recordGateInto` no-ops unless phase 6 is complete (its guard `dod.ts:366-367`), so pre-P6 or mid-P6 applies stay pure; when phase 6 is still `awaiting_hitl`/`running`, the gate converges later at the approve path (`store.ts:1004-1008`/`headless.ts:507-514`) which re-reads live `lastTest` — no double-convergence risk because `recordGateInto` replaces, never appends, the gate artifact (`dod.ts:401-404`).
   - **Dedupe (23 CAVEAT-2):** before appending the verify artifact/log, no-op when `project.lastTest?.label === "tested" && project.lastTest.evidenceHash === evidenceHash` (same-hash re-apply returns the same reference — kills duplicate `verify.pass` artifacts on repeat `--apply`).
2. **`scripts/rapidtool-cli.mjs:543-545`:** no change needed beyond applyVerifyOutcome's convergence (the CLI saves whatever headless returns) — but add the honest `gate_passed` echo in the verify summary line (`cli.mjs:556` area): `verify passed — P6 gate re-recorded: <true|false>`.
3. **DoD probe note:** `p6-verified` (`dod.ts:153-170`) reads `lastTest.label==="tested"` — after convergence the recorded P6 gate and the probe agree by construction. Add a `gates.test.ts` assertion: project with P6 recorded FAIL + applyVerifyOutcome(passed) → runGate(project,6).pass === true && `phases[6].gate.passed === true` (the "record and reality converge" property — 31 §1.3's intent, now headless-covered).

### 2. Test plan

| # | Test | Asserts |
|---|---|---|
| F1 | converge-on-pass | P6 complete + gate FAIL recorded; applyVerifyOutcome(passed) → `phases[6].gate.passed === true`, gate artifact present exactly once, packet System JSON `gate_passed` true |
| F2 | no-op re-apply | same outcome applied twice → exactly one verify artifact, one `verify.pass` log (dedupe by evidenceHash) |
| F3 | pre-complete no-op | phase 6 awaiting_hitl; apply → gate untouched (recordGateInto guard), lastTest still stamped (verify evidence exists before approval — correct order) |
| F4 | failed verdict | applyVerifyOutcome(failed) → gate NOT converged, no "tested" label minted (existing behavior asserted) |
| F5 | CLI echo | `verify --apply` summary prints the re-recorded gate value |

**Gates:** `verify.server.test.ts`/`headless` suite + existing `gates.test.ts`; packet fixtures updated only if the converged packet is snapshotted (expected — converge changes packet bytes on the apply path; that IS the fix).

---

## §W — Web-verified sources (fetched ✓TODAY 2026-09-06, this pass)

- **[W-JSON]** DeepSeek API Docs — JSON Output: `response_format {type:json_object}` + the word "json" + an example in the prompt + sane `max_tokens`; "the API may occasionally return empty content… try modifying the prompt". https://api-docs.deepseek.com/guides/json_mode
- **[W-THINK]** DeepSeek API Docs — Thinking Mode: enabled by default (effort high); `temperature/top_p/presence_penalty/frequency_penalty` accepted but no effect; `reasoning_content` must be passed back only when the request carries `tools` (400 otherwise) — our synthesis calls carry no tools. https://api-docs.deepseek.com/guides/thinking_mode
- **[W-META]** Hong et al., "MetaGPT: Meta Programming for a Multi-Agent Collaborative Framework" (arXiv:2308.00352, ar5iv full text): PRD (User Stories + Requirement Pool) → Architect (File Lists/Data Structures/Interface Definitions) → PM task list → Engineer implements named classes/functions → QA tests; Engineer iterates on executable feedback, ≤3 retries; structured intermediate outputs + intermediate-result verification reduce cascading hallucinations; "detailed prompts lead to better software projects". https://ar5iv.labs.arxiv.org/html/2308.00352
- Inherited same-day registers (not re-fetched; flagged as inherited per 90 §12): [H1]-[H7] DeepSeek model/pricing surface (90 §12.7) · [H17] Aider edit formats · [F8]/[F9] Anthropic agent/verification practices · [GK] Gemini checkpointing · [CB]/[CP]/[DK]/[CX] competitor UX (93 §7) — cited contextually in P0-03/05/06 reasoning.

## §E — Honest negatives / not verified this pass

- No tests were executed (doc-only deliverable, house convention); every "asserts" cell is a spec for the Pro sibling's test, not a passing result.
- `engine.ts` line numbers in P0-03 §2.1 for the scaffold-import question and `phases.test.ts` pin checks are marked [V re-grep] — **re-grep before patching**; the tree shifted between sibling passes all day (90 §9.7).
- The exact set of `console.tsx` render-test precedents (0 `*.test.tsx` per 13 §13.3) means UI rows in P0-05/06/07 tests should be asserted via the extracted pure helpers (`sealStats`, `evidenceForGate`) rather than DOM tests; DOM coverage stays a documented P2.
- P0-01 Part B's codegen quality ceiling (flash, one-shot + one repair, no multi-file product UI) is stated honestly in §1 — the spec deliberately ships *brief-faithful single-module code + honest contracts*, not full-product claims; anything beyond that is P1+ (multi-file orchestration) and must NOT be implied by artifact labels.

## §F — Sequencing summary (what to land, in what order)

1. **P0-04 + P0-03 + P0-05** (template/artifact honesty; one change set; pure strings; unblocks everything downstream).
2. **P0-06 + P0-07** (approval-note symmetry + presentation honesty + the documented `enforceDod` default decision).
3. **P0-01 Part A + P0-02** (p6-brief-fit + p0-brief-grounded probes + LEX; deterministic floor honesty).
4. **P0-08 + P0-09** (convergence one-liners + regression tests; independent, land anytime).
5. **P0-01 Part B** (keyed synthesis; needs 1–4's honest labels so the LLM path's packet context is truthful); gated on corpus test T7.
6. Re-run the full suite + corpus eval; per-item gate checks per 90 §11.4-C.2 (a–d).

**File created:** `fixes/97_leap_analysis_P0.md` (this file). No source file modified; no test executed.



