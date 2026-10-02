# W49 / 335-1 â€” "Prompter" â€” is every pipeline phase real? (pass 4)

**Actor:** Prompter (synthesis + the phase pipeline). **Owned files (STRICT):**
`src/lib/codegen.server.ts`, `src/lib/phases.ts`, `src/lib/prompt-engine.ts` + their tests; this log.
**HEAD at open:** `9cff073`, tree clean (siblings edit concurrently). **Contract:** `wave_plans/W49/README.md`
+ `GUARDRAILS.md` (read at open). **Runtime:** Node 22.23.2 pinned (`%LOCALAPPDATA%\hermes\node\node.exe`)
**and** host Node v24.15.0; every `node --test` parse uses `--test-reporter=tap`. **Scratch:**
`%TEMP%\rt335_1\` (outside the repo). No keyed call yet, no full gate, no `npm run eval`, no secret, no
repo probe file.

---

## Â§0 Step 0 â€” reconciliation (claimed / on disk / still open)

### Claimed (from `fixes/331_1_keywright.md`, `332_1_prompter.md` + its 333-1 follow-up, `334_1_prompter.md`)
- **331-1** is a *different lane* (Keywright â€” provider/keyed path); it owns none of my files and nothing in
  it is a synthesis claim. Read for the keyed-run context only.
- **332-1 P1 async guard:** `declaredAsyncFunctionNames`, `asyncExportNames`, `asyncNamesInScope`,
  `unawaitedAsyncValueUses`; `ChunkPriorFile.asyncExports`; refusal `RT_E_VALIDATION` in
  `validateSynthesisModule`; one bounded await re-prompt `p6SynthesisAsyncAwaitRepairPrompt`; system-prompt
  rule 9 + chunk-prompt async mark.
- **332-1 P2 coverage:** `treeChunkPlanCensus`; one `p6.tree.shortfall` row.
- **333-1 F-1/F-2 follow-ups:** `memberAccessAfter` (`?.`/computed), `constStringLiterals` (const-key
  resolution), `asyncMethodBodyRanges`/`this.m()`; deleted `treePlanCensusReconciles` + the unreachable row.
- **334-1:** P1a const-key, P1b `this.m()`, P2 shortfall row survives + no debris, P3 byte budget; plus
  **334-1c** the minted evidence hash folds declared-script state.
- **334-0 Â§5.2:** `codegen.server.test.ts` at **170 tests**; `phases.ts` carries the T-14 honest census.

### On disk (bytes read today, 2026-10-02)
- `codegen.server.ts` â€” `p6SynthesisSystemPrompt` `:550` (rules 1â€“9); `p6SynthesisAsyncAwaitRepairPrompt`
  `:1311`; `ChunkPriorFile.asyncExports` `:1493`; chunk mark `:1626`; `declaredAsyncFunctionNames` `:2365`;
  `asyncExportNames` `:2400`; `asyncNamesInScope` `:2410`; `memberAccessAfter` `:2465`;
  `constStringLiterals` `:2515`; `asyncMethodBodyRanges` `:2532`; `unawaitedAsyncValueUses` `:2582`;
  `validateSynthesisModule` `:3018` (async refusal `:3115`); `treeChunkPlanCensus` `:2003`; single
  `p6.tree.shortfall` push `:4174`/`:4175`. `treePlanCensusReconciles` absent (grep â†’ docs only).
- `phases.ts` â€” `PHASE_TAIL_START` `:160`, `PHASE_LAST` `:165`, `phaseCoverage` `:200`,
  `phaseCoverageLine` `:230`; the T-14/F-11 docblock `:152-159`. All present.
- `prompt-engine.ts` â€” `expandBrief` `:263`, `parseExpandedSpecJson` `:101`, `applyPolicies` `:291`,
  budget caps `:66-77`. Present.
- Baseline tests (Node 22, read today): `phases.test.ts` + `prompt-engine.test.ts` +
  `codegen.server.test.ts` = **209 tests / 209 pass / 0 fail / 0 skipped**.

### Still open (with `file:line`)
1. **Async guard lexical limit â€” named receiver `store.m()`** â€” outside the guard, cannot be tied to the
   declaration without type resolution: `codegen.server.ts:2573-2576` (documented).
2. **Async guard lexical limit â€” a Promise-returning callable not spelled `async`** undiscoverable:
   `declaredAsyncFunctionNames` `codegen.server.ts:2365`.
3. **Async guard â€” dynamic computed key `fn(id)[k]`** kept conservative (over-refuses the exotic
   `[someVar]==="then"`): `memberAccessAfter` `codegen.server.ts:2465`.
4. **The register finding F-11 "P7â€“P12 produced 0 artifacts"** (`research/multiagent/106_rapidtool_deep_analysis.md:336-346`)
   is still **unverified in this wave** â€” the T-14 census made the *stopped-run* emptiness honest; whether
   each tail phase produces an artifact in a *driven run* is the mission.

---

## Â§1 Mission plan (checkpoint, per hard rule 9)

1. Per-phase evidence: read `phases.ts` + the deterministic floor (`engine.ts:510 synthesizePhase`) and the
   driver (`headless.ts`) as reference; then run a **real driven keyless run** to P12 and census the
   persisted record.
2. Decide per phase P7â€“P12: artifact present/who writes it; where nothing, implement or declare a reasoned
   gap.
3. P6 residuals: audit `p6SynthesisSystemPrompt` rules vs `validateSynthesisModule`; the async guard's
   documented limits; chunk-planning bounds; sweep owned files.
4. RED-first tests + both runtimes; one bounded keyed call at most, usage reported.

---

## §2 Checkpoint — intended patches (before applying)

**Patch set A — async guard (codegen.server.ts):**
1. `unawaitedAsyncValueUses` call-site discovery: accept the optional-call tail
   `NAME?.(` (and `this.NAME?.(`) — `(?<![\w.$])NAME\s*(?:\?\.\s*)?\(` + `openParen:
   m[0].lastIndexOf("(")`; the `this.` arm gets the same `(?:\?\.\s*)?`.
2. Docblock: name the optional call as covered; state the remaining indirect-callee
   limit (`.call`/`.apply`, `(fn)(id)`, `(0, fn)(id)`).

**Patch set B — system prompt (codegen.server.ts):** rule 2 scopes its
`(validator-enforced)` parenthetical to `Math.random` (the only token
`NONDETERMINISTIC_PRIMITIVE` matches); the broader determinism duty stays a model
instruction, not an over-claim.

**Patch set C — phase table (phases.ts):** P8/P9/P12 summaries declare the named
deliverables no producer emits (component code; GPU script; DB schemas / FE-BE parity),
mirroring the P2/P3 honesty convention.

**Patch set D — prompt-engine.ts:** the policy/lesson COUNT caps silently drop rows
beyond `EXPAND_POLICY_MAX_COUNT` / `EXPAND_LESSON_MAX_COUNT`, contradicting the
module's own header ("a silent slice would hide evidence from the model"). Add an
explicit `…[POLICIES-ELIDED …]` / `…[LESSONS-ELIDED …]` marker line after each list
when the count cap drops rows (character-cap markers unchanged).

**Tests:** codegen.server.test.ts (+2), phases.test.ts (+3), prompt-engine.test.ts
(update the two count-cap assertions to require the marker). All RED-first against
`HEAD` (`%TEMP%\rt335_1\wt` byte-faithful worktree).

---

## §3 Per-phase evidence — what each tail phase produces, who writes it, on-disk proof

**Method (driven, not read).** Keyless advisory run in scratch (`%TEMP%\rt335_1\p.json`), exactly the
CLI the operator drives: `create --brief "<coffeehouse property ledger>" --kind webapp --advisory`,
then `gate --autopilot` + `approve --seat autopilot` loop. The run **reached P12**
(`status:"complete"`, `phaseCounts:{complete:13}`), and the persisted record was censused:

```
P7  artifacts=2 :: research: Competitive analysis matrix | gate: DoD gate — P7
P8  artifacts=2 :: ui: Interface contract (client UI) | gate: DoD gate — P8
P9  artifacts=3 :: cicd: GitHub Actions workflow | cicd: IaC sketch | gate: DoD gate — P9
P10 artifacts=2 :: edge: Local compute & inference | gate: DoD gate — P10
P11 artifacts=2 :: tools: Live data & tool surfaces | gate: DoD gate — P11
P12 artifacts=4 :: docs: Architecture Decision Records | docs: OpenAPI 3.1 | gate | packet
openapi len: 689   adr len: 549
gates: P6=false (p6-verified, p6-brief-fit), P7=false (live research corpus) — advisory advance still sealed all 13
```

| Phase | Artifact(s) | Kind | Who writes it | Driven run on disk |
|---|---|---|---|---|
| **P7** | "Competitive analysis matrix" | `research` | `engine.ts:936` `synthesizePhase` case 7, via `applyPhaseResult` (`engine.ts:1409`); the live path upgrades it with real fetched findings + a corpus entry (`RESEARCH_PHASES` includes 7) | **yes** (2 rows incl gate) |
| **P8** | "Interface contract (client UI)" | `ui` | `engine.ts:963` case 8; parks a HITL gate | **yes** |
| **P9** | "GitHub Actions workflow" + "IaC sketch" | `cicd` ×2 | `engine.ts:1054` case 9; parks a HITL gate | **yes** |
| **P10** | "Local compute & inference" | `edge` | `engine.ts:1101` case 10 | **yes** |
| **P11** | "Live data & tool surfaces" (JSON) | `tools` | `engine.ts:1123` case 11 | **yes** |
| **P12** | "Architecture Decision Records" + "OpenAPI 3.1" | `docs` ×2 | `engine.ts:1153` case 12; also sets `project.adr`/`project.openapi` | **yes** (`adr` 549 chars, `openapi` 689 chars) |

**The F-11 finding's actual shape.** `research/multiagent/106…:336-346` censused a run that **stopped at a
red P6** (the strict/`enforceDod` default), where P7–P12 never execute ? 0 tail artifacts. That is a
*stopped-run* property, not a per-phase producer gap: every tail phase has a writer and, in a driven
advisory run, writes its artifact. The stopped-run emptiness is now the explicit census
`phaseCoverage`/`phaseCoverageLine` (`phases.ts:200/230`) — "N of 13 phases executed / M artifacts from
P7–P12" — wired into the packet (`packet.ts:919`). **Not silent.**

**No phase produces nothing.** `phases.ts` binds no builder (it is a pure data table — the F-11
observation, still true); the writers are the engine floor. Since `engine.ts` is unowned, no new builder
was added there; instead the table's *promises* were made honest (§4C).

## §4 Per-fix before/after

### 4A — async guard: the optional call `?.(` was an undocumented bypass
Real probe output (`%TEMP%\rt335_1\probe-async2.mjs`), pre-fix HEAD source:
```
baseline direct .ok              uses=["property-read"]
optional call ?.() direct .ok    uses=[]          <- bypass
optional call ?.() bound p.ok    uses=[]          <- bypass
optional call destructure        uses=[]          <- bypass
this optional call               uses=[]          <- bypass
```
`getProperty?.(id)` only guards a null/undefined callee — it returns the same Promise, so reading a
property off it is the exact defect. Fix (`codegen.server.ts` `unawaitedAsyncValueUses`): the call-site
regex accepts the optional tail — `(?<![\w.$])NAME\s*(?:\?\.\s*)?\(` (+ the same for `this.NAME`) and
`openParen: m[0].lastIndexOf("(")`. Post-fix (same probe):
```
optional call ?.() bound     uses=["bound-then-read"]
optional call LEGAL .then    uses=[]
optional call LEGAL await    uses=[]
```
Legal consumers through `?.(` stay accepted. The parenthesized/`.call`/`.apply` indirect callees remain
a **stated** limit (reproduced: `uses=[]`), now named in the docblock.

### 4B — system prompt rule 2 over-claimed its enforcement
Rule 2 read "Never use Math.random() **or any other non-deterministic primitive (validator-enforced)**".
The validator's `NONDETERMINISTIC_PRIMITIVE = /\bMath\s*\.\s*random\b/` matches only `Math.random`; a
`Date.now()` timestamp is never refused. Fix: scope the parenthetical — "Never use Math.random()
(validator-enforced), and avoid any other non-deterministic primitive". Byte probes pinned in the test
(`nondeterministicPrimitiveHit("const t = Date.now();") === null`).

### 4C — phase table named three deliverables no producer emits (sweep)
`phases.ts` summaries, before ? after:
- P8 "component code only with a live key" ? "No component code is generated by any path, keyed or keyless: the emitted UI shell is a contract-level scaffold (B-18)." (grep: no P8 component-codegen producer; the shell is `scaffold.ts` contract-level).
- P9 "GPU allocation scripts" ? "GPU allocation is a declaration inside the IaC sketch, not a generated script (B-18)." (grep: GPU appears only in the P9 artifact's IaC line).
- P12 "OpenAPI + database schemas, frontend/backend parity" ? "Database schemas and frontend/backend parity are roadmap declarations, not generated artifacts (B-18)." (grep: no producer).
No test pinned those strings; the new `335-1` phases test pins the honest wording.

### 4D — prompt-engine COUNT caps silently dropped rows (sweep)
The module header promises "Over-budget briefs/policies are cut WITH an explicit truncation marker — a
silent slice would hide evidence from the model", but `expansionPrompt`'s `.slice(0, EXPAND_*_MAX_COUNT)`
dropped the 13th policy / 11th lesson with **no marker**. Fix: an explicit `…[POLICIES-ELIDED: N …]` /
`…[LESSONS-ELIDED: N …]` line after each list (character-cap markers unchanged; =cap inputs are
byte-identical — a 12-policy prompt gains nothing). The two existing cap tests now require the marker.

## §5 P6 residuals audit

**`p6SynthesisSystemPrompt` rules 1–9 vs `validateSynthesisModule`:**

| Rule | Advertised "(validator-enforced)"? | Enforced? |
|---|---|---|
| 1 export exactly the signatures | no | yes for claimed-unbound + missing-signature; extra exports beyond the list are **not** refused (rule makes no enforcement claim) |
| 2 zero imports/requires | no (scoped to Math.random) | `Math.random` yes; "zero imports" and the broader determinism duty are **model instructions, not enforced** (now scoped honestly — 4B) |
| 3 full JSDoc | no | no (not claimed) |
| 4 forbidden primitives | yes | **yes** (`forbiddenPrimitiveHit`; 215b test pins the list parity) |
| 5 `// req-N` comments | no | no (not claimed) |
| 6 no rejection-path tests | no | no (not claimed) |
| 7 no invented features | no | no (prompt-level) |
| 8 code only / no prose | yes | **yes** (`proseLineHits`) |
| 9 `await` async calls | yes | **yes** for bare-name + `this` receiver + (now) optional call; remaining limits documented |

**Async guard documented lexical limits (verified today):** named receiver `store.m()` — accepted, stated;
a Promise-returning callable not spelled `async` — undiscoverable, stated; indirect invocation
(`fn.call`/`fn.apply`, `(fn)(id)`, `(0, fn)(id)`) — accepted, now stated; an unresolvable dynamic
computed key — conservatively refused. The `?.(` form was **not** a limit and is now closed (4A).

**Chunk-planning bounds (probe `%TEMP%\rt335_1\probe-plan.mjs`):** invalid `perChunk` (0/-1/NaN/Infinity)
falls back to `P6_SYNTH_CHUNK_SIZE = 8`; `20 ? 8,8,4`; `3 ? …`; duplicate signatures dedupe; the census
partition holds (`declared [record,flip,show] ? planned [record,flip] + unbound [show]` — the unbound
declared job is counted, never dropped). No defect found.

**Sweep:** 4C (unproduced phase deliverables) + 4D (silent count slice) + 4B (enforcement over-claim).

## §6 Tests added + real results (both runtimes)

| Suite | Before | After | Added |
|---|---|---|---|
| `src/lib/codegen.server.test.ts` | 170 | **172** | +2 (optional-call bypass; rule-2 scoping) |
| `src/lib/phases.test.ts` | 10 | **13** | +3 (honest summaries; driven-run tail; stopped-run census) |
| `src/lib/prompt-engine.test.ts` | 29 | 29 | 2 assertions strengthened (count-cap markers) |

**RED (byte-faithful HEAD worktree `%TEMP%\rt335_1\wt`, pre-fix source + new tests):**
```
335-1 optional CALL `?.(` ...            expected: false  actual: true    -> not ok
335-1 rule 2 scopes ... Math.random      expected: true   actual: false   -> not ok
335-1 P8/P9/P12 summaries declare ...    expected: <re>  actual: "UI/UX contract synthesis — … component code only with a live key …" -> not ok
caps the policy list ...                 expected: true   actual: false   -> not ok
normalizes lessons ...                   expected: true   actual: false   -> not ok
```
(The two `phases` driven-run tests PASS on HEAD — they verify existing behaviour, they are not a fix.)

**GREEN (working tree), all three owned suites:**
```
Node 22.23.2 : # tests 214 · # suites 42 · # pass 214 · # fail 0 · # skipped 0
Node 24.15.0 : # tests 214 · # suites 42 · # pass 214 · # fail 0 · # skipped 0
```
Regression consumers (Node 22): `packet`/`gates`/`dod`/`emitted-honesty` **165/0**; `wild-step`/
`verify.server`/`scaffold` **128/0**. `npx eslint` on all six touched files ? exit 0.

## §7 What I did NOT do / stopped on

1. **No keyed call.** The wave allows =1; the core deliverable (per-phase tail artifacts) is provable
   keylessly and was (the driven run above), and the keyed P6-PASS reference is already recorded in
   `fixes/332_0_parent.md` §4. Spending a billed turn to re-prove it would add no new fact. **Usage
   reported: 0 tokens.**
2. **Did not implement P8 component code / P9 GPU scripts / P12 DB schemas+parity.** Their producers
   would live in `engine.ts`/`scaffold.ts` — unowned. **STOP-and-REPORT suggestion for the parent:** a
   P12 database-schema artifact is derivable from `project.contracts.entities` (the spec carries the
   input); P9 GPU/P8 component code have no brief/spec input and are honest roadmap declarations.
3. **Did not chase the indirect-callee async bypass** (`.call`/`.apply`, `(fn)(id)`, `(0, fn)(id)`) —
   those are not plausible emissions of a bare function call and are now stated limits, matching the
   guard's existing doctrine.
4. **Did not edit `headless.ts`, `engine.ts`, `packet.ts`, `dod.ts`, `scaffold.ts`, or any unowned file.**
5. **STOP-and-REPORT (concurrent sibling edit):** `npx tsc --noEmit` reports exactly one error —
   `src/lib/ui-surface-guards.test.ts(29,30): error TS7006: Parameter 'text' implicitly has an 'any'
   type.` That file is **untracked (`??`), not mine** (a 335-5-era new test); zero diagnostics are in my
   files. The parent should route it to its owner.
6. **No full gate, no `npm run eval`, no repo probe file** — scratch only under `%TEMP%\rt335_1\`
   (probes + `p.json` + the removed worktree); `git worktree list` shows only the main tree.

## §8 Verdict

**The register finding is verified and resolved, not merely reported.** P7–P12 are not silent: each has a
producer in the deterministic floor, and a **real driven run** reaches P12 and shows every tail artifact on
disk (`research`, `ui`, `cicd`×2, `edge`, `tools`, `docs`×2 + non-empty `openapi`/`adr`). The "0 artifacts"
census is the honest signature of a run **stopped at a red P6**, now surfaced by `phaseCoverage`; where the
phase table named deliverables no producer emits (P8/P9/P12), the emptiness is now an explicit reasoned
declaration. P6 residuals: the optional-call async bypass is closed, the system-prompt enforcement claim is
scoped truthfully, the chunk-planning bounds hold, and the prompt-engine count caps no longer slice
silently. 214/214 on both runtimes; lint 0; my files typecheck clean.
