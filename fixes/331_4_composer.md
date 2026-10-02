# W45 / 331-4 — "Composer" — codegen plan & census

**Actor:** Composer (code-synthesis + product-census). **Owned files (STRICT):**
`src/lib/codegen.server.ts`, `src/lib/doctor.ts` + colocated `*.test.ts`; this log.
**HEAD at open:** `03a6d0b` (`330 wave`). **Runtime:** repo-pinned Node 22.23.2
(`%LOCALAPPDATA%\hermes\node\node.exe`); host Node v24.15.0 recorded where suites ran.
**Scratch (outside the repo):** `%TEMP%\rt331_composer\`.

## Citation note (read first)

The brief cites register rows **AR3 / AR10** in `research/multiagent/thoroughanalysis.md`.
Those ids do **not exist** in that file, nor anywhere under `research/` or `fixes/`
(`grep -r "AR3|AR10"` → 0 hits; `\bAR\b` → 0 hits). The concrete rows that DO exist and
match the mission are `R10-f01/R10-f02` and `R12-f01` (verified below). Proceeding on the
concrete content; AR3/AR10 are reported as a stale/unresolvable citation, not guessed at.

## §1 Reproduction (keyless, scratch only — the repo gained no probe file)

All runs: `%LOCALAPPDATA%\hermes\node\node.exe scripts/rapidtool-cli.mjs …` from
`%TEMP%\rt331_composer\…`, with `DEEPSEEK_API_KEY` removed for the run (the machine's
User-scope key is the invalid `…42ff`; see W45 README §why). **No keyed call was made.**

### 1a. Parent's baseline reproduced — `gate --autopilot` parks at P4, then emit

`create --brief @research/eval-corpus/house-flip-manager.md` →
`gate --project … --autopilot` → exit **2**, `currentPhase: 4`, `awaiting_hitl` →
`emit --project … --out … --red-tree banner` → 16 files, one job file:

```
   734  \src\jobs\flip.ts          ← TODO(E-15) throwing stub
  1462  \src\domain\real_estate.ts
  1604  \src\api\routes.ts
   ...
```

`doctor --tree <abs dir>` on that tree:
`leftoverJobsAreReexportsOrStubs: true`, `inventory {stubs:1, reexports:0, real:0}`.
This is exactly the census the W45 README records. **Before = `{stubs:1,reexports:0,real:0}`.**

### 1b. Driven to P6 (approve the P4/P5 HITL gates), then emit

`gate` → approve(autopilot) → `gate` → approve → `gate` reaches P6 (`fix-gate`, DoD red,
`sealedWithFailures:true`). `emit … --red-tree banner` → 16 files; `src/jobs/flip.ts` is now
the **deterministic keyless template** (`const JOBS` + `synthesize` + `test_no_skip` +
`test_happy`, 1859 B) hosted verbatim from `project.generatedSource`.

`doctor --tree` → `inventory {stubs:0, reexports:0, real:1}`, `leftover…: false`.
**This is dishonest**: the file is `sandbox.buildPhase6Module`'s phase-bookkeeping
placeholder, which by its own doc "never implements the brief" and fails `p6-brief-fit` by
construction. The census counts the one placeholder as `real` and clears `leftover`.

### 1c. The genuine multi-job case — tracked café export re-emitted by CURRENT code

`research/eval-out/coffeehouse2home-property-ledger/.rapidtool/project.json` (10 declared
lattice jobs, 5 materialised spec-graph job nodes, 36 recorded signatures) re-emitted
read-only to scratch:

```
  2988  \src\jobs\flip.ts     ← REAL
  3292  \src\jobs\lease.ts    ← REAL
  3469  \src\jobs\record.ts   ← REAL
  5089  \src\jobs\show.ts     ← REAL
  7821  \src\generated\get-property.ts
```

`doctor --tree` → `inventory {stubs:0, reexports:0, real:4}` — the M-A bar
`{reexports:0, stubs:0, real>=3}` is **already met here** (fixes/328 P2 lands real per-job
modules from the recorded spec). Emit summary: `2 files assembled, 1 job node
unmaterialised (never bridged — see warnings), 3 non-job bridges`.

**The remaining C1 shortfall:** the 5th declared job node, label **`track`**, has **no
signature whose function name contains its label**, so it is materialised as **no file at
all** — it is counted only in the scaffold's in-process `warnings` array, and the
`doctor --tree` census `{0,0,4}` + `gaps` do **not** surface it. That is the silent drop.

## §2 C2 — `doctor --tree` invocation (measured)

| invocation | `factory.inventory` |
|---|---|
| `doctor --tree` (no value) | `null` ← the probe shape the brief saw |
| `doctor --tree <abs dir>` (quoted) | `{scanned, stubs, reexports, real, files[]}` |
| `doctor --tree=<abs dir>` | same real census |

Correct reproducible form: **`doctor --tree "<absolute dir>"`** (PowerShell: quote the
path). The census **does** run there. `inventory: null` is only the *no-value* form — an
unscanned pre-flight, not a failed scan. The `doctor` verb itself lives in
`scripts/rapidtool-cli.mjs` (331-1's file) so any invocation-level change is theirs.
Scoping limit (documented, not a bug): `headless.collectJobSources` scans only
`src/jobs/*` + `jobs/*`.

## §3 C1 — what actually landed

Two honest halves; **no model text was invented, no keyed call was made.**

### 3.1 `doctor.ts` — the census stopped calling a placeholder `real` (measured)

`classifyJobSource` now detects the deterministic keyless P6 template shape
(`sandbox.buildPhase6Module`: `const JOBS` + `function synthesize(` + `function test_no_skip(`)
and classifies it **`stub`**. It is the keyless placeholder that "never implements the brief"
(sandbox.ts:195), and `scaffold.emitGeneratedHost` hosts it verbatim under the first job path.
Before this change the census reported the placeholder as `real:1` and cleared `leftover`, i.e.
the doctor claimed a job body where the bytes carry phase bookkeeping.

**Real command + output (P6-driven keyless house-flip tree, `doctor --tree "<dir>"`):**

| | stubs | reexports | real | `leftoverJobsAreReexportsOrStubs` |
|---|---|---|---|---|
| before | 0 | 0 | 1 | `false` (untrue) |
| after | 1 | 0 | 0 | `true` |

Negative control (the café multi-job tree, real job modules): unchanged
`{stubs:0, reexports:0, real:4}`, `leftover:false` — the template test does not fire on
recorded per-job modules.

### 3.2 `codegen.server.ts` — the plan-side shortfall is counted and persisted

New exported pure `treeChunkPlanCensus(project, typeSignatures, perChunk?)`
(derived FROM `treeChunkPlan`, so there is no second path rule to drift): it returns
`{declared, planned, unbound, paths, legacy}`, with the `deliver-core-workflow` lattice
sentinel excluded (mirrors `deriveTypeSignatures`). `synthesizeChunkedTree` now persists
**one** bounded `p6.tree.shortfall` warn when `unbound.length > 0`, naming the declared jobs
that get no chunk and no file — so the shortfall rides the exported project/packet instead of
dying in the scaffold's in-process `warnings` array. Zero-unbound plans append nothing
(byte-identity).

**This is not hypothetical:** the standard LEDGER fixture (`codegen.server.test.ts`) declares
**4** capabilities (`track/record/lease/rent`) whose spec graph materialises 4 job nodes, yet
every `collectRent<i>` signature names only `rent` — the other **three** were silently absent
from the plan and no existing test noticed. The new test asserts one `p6.tree.shortfall` row
naming `track`, `record`, `lease` (and not `rent`).

### 3.3 The multi-job emit is ALREADY real for bound jobs (measured)

Re-emitting the tracked café project with current code produces
`src/jobs/{flip,lease,record,show}.ts` as REAL modules and
`doctor --tree` → `{stubs:0, reexports:0, real:4}` — the M-A bar
`{0, 0, >=3}` **is met** on that case (fixes/328 P2). The one remaining shortfall there is
the `track` node (no signature names it) → **no file at all**, counted only in the scaffold
`warnings`; §4 lands the consumer contract so the tree-level census surfaces it.

## §4 Consumer contract for lane 331-3 (C1 / C2 — `treeChunkPlan`/`orderTreeChunks` + census)

Lane 331-3 owns `headless.ts` / `scaffold.ts`. **I did not edit them.** The exact contract to
consume:

1. **Plan shape (unchanged, codegen-owned).**
   - `treeChunkPlan(project, typeSignatures, perChunk = P6_SYNTH_CHUNK_SIZE): TreeChunk[]`
     where `TreeChunk = { path: string; signatures: string[]; nodeId?: string; label?: string }`.
     Job-keyed chunks carry `nodeId` + `label` and `path === <spec-graph job file>`
     (`src/jobs/<label>.ts`, overflow `-2/-3`); leftover chunks carry neither and live under
     `src/generated/`. A plan with **no** job-keyed chunk is the byte-identical legacy mapping.
   - `orderTreeChunks(plan): TreeChunk[]` is the sole consumption order: leftovers first
     (plan order), then job GROUPS in reverse plan order, each group in plan order.
   - The plan NEVER carries a chunk for a declared job with no bound signature; that job is
     the counted shortfall, not a fabricated chunk.
2. **New census for the emitted tree (doctor.ts, codegen-independent).**
   - `treeEmissionCensus(declaredJobs, inv: JobInventory): TreeEmissionCensus`
     → `{declared, declaredNames, materialised, missing, stubs, reexports, real, loud}`.
     `missing` are the declared jobs with **no REAL job file** in the scan (stub/reexport/
     template files never count; the `-2` sibling overflow does). Pure.
   - Consumer rule: `headless.doctorStatus({treeDir})` should read the emitted tree's own
     `.rapidtool/project.json` (`lattice.jobs`), call `treeEmissionCensus(declared, inv)`, and
     surface `missing` as (a) a `factory.gaps`-style line and (b) a field on the census
     envelope — **only when `loud` is true**, so byte-identity holds for full-coverage trees.
   - The emitted-tree README should print the same `missing` list beside the existing
     `unmaterialisedJobs` warnings (scaffold.ts already computes that array — it just needs
     to reach the emitted README the way the bridge census does).
3. **Synthesis-side census (codegen, already landed).** `treeChunkPlanCensus` names the same
   shortfall at plan time and `synthesizeChunkedTree` persists the `p6.tree.shortfall` warn.
   A consumer wanting one vocabulary can read that row off the packaged project.

## §5 C3 — do contracts reach emitted code? (register R10-f01)

**Yes — on disk, both ways:**
- Deterministic (every emit, keyless included): `project.contracts.entities` renders
  `src/domain/real_estate.ts` (`export interface Manager/User/Flipper/House/Flip …`) and
  `project.contracts.endpoints` renders `src/api/routes.ts`
  (`ENDPOINTS = [{ method: "POST", path: "/v1/flip", job: "flip" }]`). R10-f01's done-when
  ("the contract entity name appears in emitted tree code") is **met by these bytes**.
- Advisory (keyed synthesis): `p6SynthesisContractsLines` is wired into both prompt builders
  (`codegen.server.ts:3146` single-module, `:3519` per chunk). It had **zero test coverage**;
  I added tests pinning the render, the non-empty gate (absent ⇒ legacy bytes, additive
  prefix), the 12-row cap marker, and that the block reaches `p6SynthesisChunkUserPrompt`.
- The synthesized **module body** (keyless floor) does not carry contract names — by
  construction (no model call). A keyed proof that the model *uses* the block in a module body
  is **owed** (keyed path under repair by 331-1; not run in a loop).

## §6 C4 — sweep of my two files

- **R12-f01 (O(chunks²) prompt growth): already landed** (`P6_SYNTH_PRIOR_MAX_FILES = 12` +
  visible `[PRIOR-ELIDED …]` marker + a per-chunk byte budget). It had **no test**; added one
  asserting ≤12 `exports:` lines, the elision marker naming 8 dropped files, and that the
  newest files are the ones kept.
- **Contracts render** capped at 12 rows with a visible marker (tested, §5).
- **Brief** capped at 2 000 chars with a marker; **lessons** capped by `limit`; **prior**
  capped. Remaining spec sections (`requirements`/`edgeCases`/`errorHandling`/`dataFlow`/
  `negativeConstraints`) are rendered in full but are **bounded by construction** — one
  `expandBrief` reply — so they are not the R12-f01 O(n²) class. Reported, not "fixed" (a cap
  would cut the spec the model must implement; no evidence of a live runaway).
- **Claims the bytes do not support:** fixed the census's `real` over-claim for the keyless
  template (§3.1) and the stale header claim that `headless.doctorStatus` "hardcodes
  `autonomousSoftwareFactory: false`" (it derives it through `factoryClaim`). No silent catches
  or dead code introduced.

## §7 Tests added (real results)

Node 22.23.2 (`--experimental-strip-types --test --test-reporter=tap`):

| suite | before | after | added |
|---|---|---|---|
| `src/lib/codegen.server.test.ts` | 137/137 | **142/142** | 5 |
| `src/lib/doctor.test.ts` | 20/20 | **23/23** | 3 |

New tests:
1. `treeChunkPlanCensus` — declared/planned/unbound/legacy/paths, incl. the no-bind legacy case.
2. Sentinel exclusion (`deliver-core-workflow` is never a coverage obligation).
3. `p6SynthesisContractsLines` render + prompt-carries-it + non-empty gate + 12-row cap.
4. R12-f01 prior-render cap + visible elision + newest-kept.
5. Driver persists one `p6.tree.shortfall` row; negative control (only-job-bound base) is silent.
6. `classifyJobSource`: keyless template → `stub` (and the same shape without the template
   functions stays `real`).
7. `treeEmissionCensus`: café-shaped 5-declared/4-real → `missing:["track"], loud:true`; full
   coverage → silent; stub at the job path never materialises; `-2` sibling does.
8. `treeEmissionCensus` over the **real tracked** `coffeehouse2home-property-ledger.run-2026-09-10`
   bytes → 10 declared, 0 materialised, 5 reexport bridges, `loud:true`.

Host Node v24.15.0: **not run** — the two suites are Node-22-pinned by the brief; the wave
parent runs the dual-leg gate. `npx tsc --noEmit` on the working tree reports only
`src/lib/llm/providers/key-rejected.test.ts` (331-1's concurrent edit); zero errors in my four
files. `eslint` on my four files → exit 0.

## §8 What I did NOT do / stopped on

- **Did NOT edit `scaffold.ts`/`headless.ts`/`engine.ts`/`sandbox.ts`/`rapidtool-cli.mjs`**
  (other lanes). The keyless per-job materialisation and the emitted-tree census surfacing are
  contracts in §4 — 331-3 implements them.
- **Did NOT fabricate per-job signatures.** Where the recorded spec has no signature naming a
  declared job, the plan must not invent one; the shortfall is counted (§3.2). This is the
  literal "or count and surface the shortfall loudly" branch of C1.
- **Did NOT move the headline census for the 1-job keyless house-flip to `real>=3`** — that is
  not reachable honestly from a 1-job lattice, and the placeholder is now correctly counted as
  a stub, not inflated to a real module. The `real>=3` bar IS met on the genuine multi-job
  café case (`real:4`, measured §3.3).
- **AR3/AR10 register rows are unresolvable** (0 hits repo-wide); reported, not guessed.
- **No keyed call run** (331-1 owns key resolution; C3's module-body proof is owed).
- **No full gate, no `npm run eval`, no repo probe file** — all scratch work lives under
  `%TEMP%\rt331_composer\`.

## Verdict

**C1 — landed (honest half).** The plan now counts and persists every declared job it cannot
key (`treeChunkPlanCensus` + `p6.tree.shortfall`), the census stops calling the keyless
placeholder `real`, and the real multi-job emit is confirmed at `{stubs:0, reexports:0,
real:4}`. The remaining emitted-tree surfacing is a written contract for 331-3.
**C2 — verified, not broken.** `doctor --tree "<abs dir>"` already yields a real
`{stubs, reexports, real}` census; `inventory:null` is only the *no-value* form. Correct form
cited (§2).
**C3 — verified on disk.** Contracts reach emitted code deterministically (schema/api) and the
synthesis prompt (now test-pinned); the keyed module-body proof is owed.
**C4 — swept.** R12-f01 cap exists and is now test-pinned; contracts cap pinned; the census
over-claim and a stale header claim fixed. All my suites green (142/142, 23/23); lint exit 0;
my files typecheck clean.

---

# Follow-up (W45 · parent-keyed-findings) — Finding A + Finding B

**Scope:** only `src/lib/codegen.server.ts` + `src/lib/codegen.server.test.ts` touched in this pass.
Scratch: `%TEMP%\rt331_composer2\` (outside the repo). No keyed call, no full gate, no `npm run eval`.

## §9 Finding A — `proseLineHits` false positives (class fix)

**Reproduced RED (direct call of the real exported function, `probe-prose.mjs`):**

```
FAIL want=ok    got=PROSE :: "return a.index - b.index;"
FAIL want=ok    got=PROSE :: "arvNote: arvAvailable ? undefined : 'ARV unavailable: no comparables',"
OK   want=PROSE got=PROSE :: "I will write the code now and make sure it works."
2 MISMATCH
```

**Root cause (the class, not the strings):**
- `PROSE_ARITH_MINUS` operands were `[A-Za-z_$0-9][\w$]+`, which cannot cross a `.` — so a
  member-expression operand (`a.index`) was invisible and the line stayed sentence-shaped.
- `PROSE_TERNARY` required a token after `:` — a quoted arm is masked to a whitespace run, so the
  false arm vanished and the end-anchored ternary exclusion could not match.

**Fix:** operands/arms are now built from a shared class — a dotted member expression
(`a.index`, `this.total`), a number, or a >=2-char identifier for the arithmetic-minus rule; and a
ternary arm may additionally be a whitespace run (the masked remnant of a quoted literal). Prefix
keywords (`return`/`const`/…) need no special case once the operand may contain `.` — `return
a.index - b.index;` matches on its own left operand.

**GREEN (same probe, full run):** all 11 cases pass — both real shapes now `ok`, the three
deliberation controls (`I will write…`, `We should really…`, `I'll write…`) still PROSE, and the
previously-working exclusions (`balance: amountDue - amountPaid`, `return negative ? -cents :
cents;`, `const total = subtotal - discounts;`) unchanged. `LEGAL_PROSE_LOOKALIKES` gained the 5 new
legal shapes, so the existing control loop pins them too.

## §10 Finding B — a later chunk redeclaring an earlier chunk's export

**Reproduced RED on the parent's REAL recorded keyed bytes**
(`%LOCALAPPDATA%\Temp\rt331_parent_keyed2\tree\src\jobs\flip.ts`, `probe-real-bytes.mjs` +
direct `import()`):

```
flip.ts line 2:  import { … estimateARV … } from "../generated/list-line-items.ts";
flip.ts line 546: async function estimateARV(propertyId) {
detector → cross-chunk duplicate declarations: estimateARV @ line 546
import('…/flip.ts') → LOAD ERROR: SyntaxError Identifier 'estimateARV' has already been declared
```

(Also reproduced synthetically end-to-end: `materializeImportableTree` with a later chunk that
redeclares a prior export emits `import { estimateARV } …` over `function estimateARV` and
`node --check` exits 1 — the exact shipped `SyntaxError`. Note: `node --check` on the real `.ts`
copy under `--experimental-strip-types` returned 0, a strip-types/--check quirk; executing the same
bytes via `import()` reproduces the error. Not over-claimed.)

**Decision — refusal before materialization, not a prompt-side rule and not a silent import drop.**
The materializer imports *every* earlier chunk's exports into a later file by design (that is how
the cross-file call contract is honored), so a same-named local binding is a load-time SyntaxError
inherent to the materialized shape. A prompt-side rule would still let a model slip through and ship
an unloadable tree; silently skipping the conflicting import would change the module's semantics.
The honest defense is a deterministic refusal at synthesis time, which the existing bounded repair
re-prompt then gets one chance to fix.

**Landed:**
- `localBindingLines(module)` — top-level binding names → 1-based declaration lines (same shapes as
  `localBindingNames`, line-preserving; comments/strings never report).
- `crossChunkDuplicateDeclarations(module, priorChunks)` — the ONE detector of the class.
- `validateSynthesisModule(module, claimedExports, signatureNames, priorChunks?)` — new optional
  4th arg; when prior chunks are supplied and the module declares one of their exports, it returns
  `RT_E_VALIDATION` naming the identifier, its declaration line, and the exporting sibling file, plus
  the `SyntaxError: Identifier '…' has already been declared` consequence. Checked LAST so the
  export-surface repairs keep priority. Absent/null ⇒ single-module path byte-identical (pinned).
- `p6SynthesisDuplicateDeclRepairPrompt(duplicates, treeFailure?)` — the one bounded repair re-prompt
  (delete-and-call-by-name, or rename; never import).
- The chunked driver passes its live `prior` list into `synthesizeChunkEnvelope`, which validates and
  (on a repeat) refuses.

**GREEN:** the direct probe now refuses the real shape; the driver e2e test injects a chunk 1 that
redeclares chunk 0's export, observes exactly one duplicate-declaration repair, and the repaired tree
assembles (barrel + 3 chunks) with no `p6.synthesis.refused` and no redeclaration of the prior export
on disk.

## §11 Tests added + gate results

| suite | before | after | added |
|---|---|---|---|
| `codegen.server.test.ts` | 142/142 | **148/148** | 6 |
| `doctor.test.ts` | 23/23 | **23/23** | 0 (untouched) |

New codegen tests: prose class exclusion + controls; `localBindingLines` line accuracy;
`crossChunkDuplicateDeclarations` determinism/multi-conflict; the validator refusal (+ single-module
unchanged + non-conflicting prior accepted); the repair-prompt bytes; the chunked-driver e2e
(redeclare → one repair → accepted, loadable).

**Gate legs (both Node 22 and host Node 24):** `codegen.server.test.ts` 148/148 and
`doctor.test.ts` 23/23 on `%LOCALAPPDATA%\hermes\node\node.exe` (v22.23.2) **and** `node`
(v24.15.0). `npx eslint` on my four files → exit 0. `npx tsc --noEmit` → no diagnostics in my files
(the only tree error remains 331-1's `key-rejected.test.ts`).

## §12 Not fixed / boundaries

- This is a **synthesis-time** guard: it prevents the unloadable file from being emitted by a future
  keyed run. It cannot retroactively repair the parent's already-materialized tree, and it does not
  touch the tree-repair-loop targeting defect (`flip.ts` never written — `headless.ts`, lane 331-3).
- I did not add the duplicate class to the patch-repair (`str_replace`) level — the legacy full-rewrite
  repair handles it; extending patch here would widen the diff without evidence.
- `AR3/AR10` remain unresolvable citations (unchanged). No keyed calls were needed or run.

