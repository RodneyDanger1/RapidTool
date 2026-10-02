# W45 / 331-3 — "Transit" — emitted-artifact integrity — landing log

**Lane:** 331-3, persona "Transit" (build-output integrity). **HEAD at open:** `03a6d0b` (`330 wave`).
**Owned files (STRICT):** `src/lib/headless.ts`, `src/lib/scaffold.ts`, `src/lib/compile-check.server.ts`
+ their colocated `*.test.ts`; this log.
**Runtime:** repo-pinned Node **22.23.2** (`%LOCALAPPDATA%\hermes\node\node.exe`); host Node **24.15.0**
recorded for the suites touched. **Scratch (outside the repo):** `%TEMP%\rt331_transit\` — the repo
gained no probe file (`git status` shows only owned-file edits + this log from my lane).
Keyless throughout: `DEEPSEEK_API_KEY` deleted in every probe. No keyed call, no secret printed,
no `npm run eval`, no full gate.

## 0. Verdict in one line

T1 landed: `headless.materializeEmitTree` no longer early-returns on zero tree rows — a **lone
`generatedSource` carrying CommonJS residue now CONVERTS** into an ESM chunk + `src/generated.ts`
barrel through codegen's own `materializeImportableTree`, so the emitted `"type":"module"` product
**loads** (`import()` real, exports recovered round-trip). The T2 sweep found **every production
emit path funnels through `headless.emitProject`** and is now covered; the remaining `--force`
survivor and `repairTreeDir` paths were proven **fail-closed** (an unloadable survivor reds
`tree-run`, never ships green). T3: the keyless `TODO(E-15)` job stub **cannot be honestly filled**
from the keyless floor — recorded decision below (keep the honest refusal; no fabricated body).
One pre-existing, non-T1 defect observed and reported (game-kind core smoke), not fixed (out of
class / cross-lane).

## 1. T1 — reproduce first (scratch, outside the repo)

Probe `%TEMP%\rt331_transit\probe-t1.mjs`: a project record with `generatedTree: []` and
`generatedSource = "function add(a, b) { return a + b; }\nmodule.exports.add = add;\n"`, then a real
`emitProject` + a real `import()` of the emitted module + a real `treeRun`.

### 1a. BEFORE (HEAD module, refusal — the 330 Fix A floor)

```
emit.ok= false
emit.error= RT_E_VALIDATION · assembled generated module body is CommonJS but the emitted package
declares "type":"module" — importing it throws "module is not defined in ES module scope", so the
emitted product could not load (offending file(s): src/jobs/deliver_core_workflow.ts). Materialize
the module to ESM (codegen.materializeImportableTree) before emitting; the emitter refuses rather
than ship an unloadable tree.
```

No module was emitted (no bytes to load). The residue shape itself fails to load in the ESM package
— reproduced as the negative control in §3: injecting `module.exports.add = add;` into an emitted
`"type":"module"` chunk makes the bounded runner report
`TypeError: Cannot set properties of undefined (setting 'add')`.

### 1b. AFTER (my module, conversion — the path now CONVERTS)

```
emit.ok= true
emit.files= [README.md, DEPLOY.md, .env.example, .gitignore, package.json, tsconfig.json,
  .rapidtool/project.json, src/main.ts, src/generated.ts, src/generated/chunk-0.ts,
  src/domain/custom_software.ts, src/api/routes.ts, src/state/store.ts, src/ui/console.tsx,
  tests/oracle.spec.ts]
package.json type= "module"
residue-carrying emitted file: null
---- src/generated.ts ----
export * from "./generated/chunk-0.ts";
---- src/generated/chunk-0.ts ----
function add(a, b) { return a + b; }
export { add };
LOAD src/generated.ts exports= [ 'add' ]
add(2,3)= 5
record.generatedTree paths= [ 'src/generated.ts', 'src/generated/chunk-0.ts' ]
treeRun.ok= true  run= {"kind":"headless","entry":"src/generated.ts","run":"pass","durationMs":339}
```

### 1c. The fix (headless.ts `materializeEmitTree`)

The zero-row early return is dropped; the lone `generatedSource` is treated as a single-row tree
plan at `codegen.TREE_ENTRY_PATH` and run through the SAME `materializeImportableTree` seam the
multi-row branch already uses. The multi-row branch is byte-identical to pre-331; residue in a
`generatedSource` **beside** a non-empty tree is left alone deliberately (tree mode never hosts
`generatedSource`, so that residue never reaches an emitted code file — documented in the fn doc).
No new export, no rename; `codegen.TREE_ENTRY_PATH` is a value import inside the existing dynamic
`import("./codegen.server.ts")`.

## 2. T2 — the emit-path guard sweep (per path)

| Path | Finding | Status |
|---|---|---|
| `headless.emitProject` (the **only** production `scaffoldProject` caller — CLI `emit` :1740, journey seam :2557, `run-eval.mjs` :2053 all funnel here) | T1's conversion + the pre-existing multi-row materialization cover both residue classes before the scaffold runs | **covered** |
| direct `scaffoldProject` callers | production: **none** besides headless. `scaffoldProject` is pure + synchronous and cannot import `codegen.server.ts`, so a direct caller cannot materialize — 330 Fix A's coded refusal stays correct there (and only there) | **refusal retained** (scaffold.test.ts 47/47) |
| `repairTreeDir` re-import path | `repairTreeDir` **never emits** (documented + read: it patches the dir in place and re-runs `treeRun`); `importTreeDir` stores disk bytes into `generatedTree`, and any later `emitProject` materializes tree rows. A residue file in a repaired dir is fail-closed by `treeRun` (entry/core load) | **covered / fail-closed** |
| `--force` survivors | a kept foreign file is never written by us, but if it occupies the record's job-node path it becomes `resolveHeadlessEntry`'s core and is load-smoked. Probe `probe-t2c.mjs`: a stale CJS survivor planted at the unmaterialised job path → `emit.ok:true`, `survivors:["src/jobs/show.ts"]`, then `treeRun.ok:false`, `core.run:"fail"` (`TypeError: Cannot set properties of undefined`). Fail-closed, never green | **covered (fail-closed)** |
| `compile-check.server.ts` loads the product's generated core | Fix B retained. Probe `probe-t2.mjs` (app-kind): converted tree → `run.kind:"ui-shell"` skip + `core { kind:"generated-core", entry:"src/generated.ts", run:"pass" }`, `treeRun.ok:true`. Negative: residue injected into the emitted chunk → `core.run:"fail"`, `treeRun.ok:false`. Added 2 tests pinning the **tree-ENTRY** core (job file unmaterialised, `resolveHeadlessEntry` falls through to `src/generated.ts`) — both loadable-pass and residue-fail | **covered + extended** |

## 3. T3 — the still-throwing `TODO(E-15)` job stub — decision

**Reproduced (keyless, `probe-t3b.mjs`):** a house-flip-manager project at intake / parked at P4 has
`generatedSource` empty and 5 spec-graph job nodes → `emit` writes each as an `emitJobStub`:

```ts
export function runJob_0(input: unknown): { ok: boolean } {
  void input;
  throw new Error("RT_E_VALIDATION · TODO(E-15) stub: implement job flip");
}
```

**What the scaffold can honestly do.** Nothing more than it already does, and it must not fabricate:

- **No recorded surface ⇒ honest coded refusal.** The keyless floor carries no `implementationSpec`
  signatures (probed: `signatures=0`) and no domain rules; the oracle rows are prose expectations
  ("… => 200 + persisted entity + checkpoint"). Any body generated from that would have to *return a
  made-up value while claiming to satisfy the row* — exactly the forbidden fabrication. The stub
  throws a registered `RT_E_VALIDATION` refusal and the emitted `tests/oracle.spec.ts` **asserts the
  coded refusal** (`assert.rejects(..., /RT_E_VALIDATION · TODO\(E-15\) stub/)`), so the tree never
  claims the row is satisfied.
- **A recorded surface ⇒ a real, non-fabricated body already exists.** `emitJobModule` (fixes/328 P2)
  derives a deterministic body from the recorded `typeSignatures`; its own header states it carries
  "no domain rules, so nothing beyond the recorded surface is claimed here", declares unknown
  contract types **opaquely** rather than inventing field shapes. Lane 331-4's log §1c confirms this
  reaches `{stubs:0, reexports:0, real:4}` on the tracked record.
- **The deterministic P6 template** (`sandbox.buildPhase6Module`) is the honest keyless body when P6
  actually runs (probe `probe-t3.mjs`: drained corpus → `src/jobs/flip.ts` hosts the template with a
  scaffold export tail). It is real, executing code — but by its own doc it "does not synthesize the
  brief", so it is honest only when labeled as the placeholder it is.

**Decision:** keep the honest stub; do **not** synthesize a job body from keyless prose. Coordinate
the plan-shape half with **331-4** per C1 as consumer: `scaffold` consumes `(path, source, exports)`
tree rows and binds real job modules from recorded `typeSignatures` via `bindSignaturesToJobTargets`
(`realJobTargets`) and tree-covered job paths via `treeJobModules`. `treeChunkPlan`/`orderTreeChunks`
cannot manufacture keyless job semantics; their honest contribution is to ensure every spec-graph job
node that HAS a recorded signature is covered by a per-job tree file (so the consumer binds it) and
that uncovered job nodes stay counted, never silently dropped (already the scaffold's D3 behaviour).
No scaffold change is required for T3 unless 331-4 changes the plan output shape, in which case I am
the consumer side.

## 4. Tests added + real results

| Test | File | Node 22 | Node 24 |
|---|---|---|---|
| `T1 RED-first: a lone generatedSource with CJS residue CONVERTS … real import` | `headless.test.ts` | pass | pass |
| `T1 control: a CLEAN lone generatedSource is untouched …` | `headless.test.ts` | pass | pass |
| `T1 (331-3): a UI-shell tree whose generated core is the tree ENTRY … is load-smoked` | `compile-check.server.test.ts` | pass | pass |
| `T1 (331-3): a tree ENTRY core carrying CommonJS residue reds the tree` | `compile-check.server.test.ts` | pass | pass |

Suite results (targeted; no full gate — five siblings mid-edit):

| Command | Result |
|---|---|
| Node 22 `--test src/lib/scaffold.test.ts` | **47 / 47 pass / 0 fail** (unchanged) |
| Node 22 `--test src/lib/compile-check.server.test.ts` | **65 tests / 64 pass / 0 fail / 1 skip** (baseline 63/62/0/1 ⇒ **+2**) |
| Node 22 `--test src/lib/headless.test.ts` | **117 tests / 116 pass / 1 fail** — the 2 new tests pass; the 1 failure is a concurrent 331-1 edit (`verify` "not-configured" → exit 4, expected 3), unrelated to this lane (`verify` never calls `emitProject`) |
| Node 24 `--test scaffold.test.ts compile-check.server.test.ts` | **112 tests / 111 pass / 0 fail / 1 skip** |
| Node 22 dependent suites `emitted-honesty + sweep73-fuzz + honesty-guards + maker-score + wild-step` | **179 / 179 pass / 0 fail** |
| `npx eslint` on the 6 owned files | **exit 0** |

**Teeth.** T1 RED-first was run against the pre-fix module (my edit temporarily reverted, then
restored — file verified byte-identical to the fixed copy): the convert test is **RED**
(`not ok 1`), the clean control stays **GREEN**. Post-fix both are GREEN. The two compile-check tests
exercise `treeRun` end-to-end (real bounded spawn), not mocks.

## 5. Reported, not fixed (needs a decision / different class)

1. **Game-kind UI-shell core smoke is a false-red (pre-existing, 330 Fix B over-reach).** Probe
   `probe-t2b.mjs`: a `game`-kind tree (clean source, no residue) → `treeRun.ok:false` because
   `resolveHeadlessEntry` resolves `package.json "main" = src/main.ts` (the **browser** boot, which
   imports `./ui/console` extensionless + DOM) and bare-node cannot load it. Pre-330 (no core smoke)
   the UI-shell skip was green. Not T1-related (reproduces with a clean, non-residue source and with
   my change inert); it is a core-resolver scope question in my owned `compile-check.server.ts`, but
   a different class than residue and potentially cross-cutting with 331-4/331-6, so **reported, not
   changed**. The wave's product kind (webapp/app) is correct (§2).
2. **Concurrent sibling failure, not mine.** `headless.test.ts` `verify … not-configured → exit 3`
   now sees exit 4; `scripts/rapidtool-cli.mjs` + `src/lib/errors.ts` are modified in the working
   tree by lane 331-1. `verify` never calls `emitProject`/`materializeEmitTree`, so this cannot be my
   change. Left for the parent's gate run after all lanes settle.

## 6. What I did NOT do and why

- Did not run the full gate / `npm test` / `npm run eval` — five siblings mid-edit; targeted suites only.
- Did not fabricate or stub-fill the keyless job body (T3) — the honest coded refusal stands.
- Did not edit `research/eval-out/**` stale artifacts (recorded trial evidence; regeneration is not
  byte-faithful — carried forward from the 330 lane's boundary).
- Did not materialize a residue `generatedSource` that sits **beside** a non-empty tree: it is dead
  data (tree mode never hosts it) and reshaping the tree for it would change unrelated bytes.
- Did not touch any file outside my six owned files; no probe file was written inside the repo.

---

# W45 follow-up - parent keyed findings C + D (both in owned files) - 2026-10-02

Read `wave_plans/W45/parent-keyed-findings.md` (boundary owner's live evidence). Scratch:
`%TEMP%\rt331_transit2\`. Keyless (no keyed call); `repair`'s tree-run leg is local.
Files edited this round: `src/lib/headless.ts`, `src/lib/headless.test.ts` (scaffold.ts and
compile-check.server.ts needed no change - Fix B retained; scaffold's `TREE_ALLOWED_FILES` already
admitted the entry, the headless mirror did not).

## 8. Finding C - the tree's own barrel could not round-trip through `repair`

**Root cause (reproduced, probe-d):** `headless.repairTreePathRefusal` (the scaffold
`treePathRefusal` mirror used by BOTH `importTreeDir` and `applySynthesizedTreeToDir`) lacked the
exact-file allowance `scaffold.TREE_ALLOWED_FILES = {"src/generated.ts"}`. `src/generated.ts` is
`codegen.TREE_ENTRY_PATH`; it starts with no allowed root (`src/generated/` needs the trailing
slash), so the emitter's own tree entry was refused on the read AND write sides.

**BEFORE (probe-d, first run):**
```
import: 6 file(s) re-read from ...rt331-d-... (6 changed, 0 unchanged, 1 refused)
applied.refused = ["src/generated.ts"]
applied.warnings = ["repair:apply:refused:\"src/generated.ts\":path \"src/generated.ts\" is outside the scaffold's src/ subdirs and tests/ - nothing written"]
```
**AFTER:**
```
import: 7 file(s) re-read from ... (7 changed, 0 unchanged)      <- 0 refused
applied.refused = ["src/jobs/flip.ts"]                          <- src/generated.ts no longer refused
```
**Fix:** `REPAIR_TREE_ALLOWED_FILES = {"src/generated.ts"}` (parity with scaffold's
`TREE_ALLOWED_FILES`, exact-match so `src/generated.ts.bak` stays refused), applied in
`repairTreePathRefusal`. One change covers both the import and apply sides (they share the fn).

## 9. Finding D - the repair loop never targeted the file named in the failure

**Root cause (reproduced):** the tree-run NAMED `src/jobs/flip.ts` via the generated-core LOAD
shape (`treeRun.core.run = "fail"`, `core.entry = "src/jobs/flip.ts"`), but nothing carried that
as a machine field: `treeRunFailureTail` returns the error string (which embeds the path), yet
codegen only appends `treeFailure` to a repair prompt that some OTHER defect triggered - so the
cycle repaired `create-property.ts` and left `flip.ts` byte-identical. `flip.ts` was in neither
`applied.written` nor `applied.refused` - a silent skip, 2/2 cycles, budget exhausted.

**BEFORE (probe-d, first run):**
```
applied.written = ["src/generated/create-property.ts"]
applied.refused = ["src/generated.ts"]     <- flip.ts in NEITHER list
events: cycle 1/2: tree-run fail - ...(src/jobs/flip.ts): SyntaxError: Identifier 'estimateARV'...
```
**AFTER:**
```
ctx[0] keys = ["cycle","treeFailureTail","repairTargets"] ; ctx[0].repairTargets = ["src/jobs/flip.ts"]
applied.refused = ["src/jobs/flip.ts"]
applied.warnings = ["repair:apply:refused:\"src/jobs/flip.ts\":the tree-run failure names this file but the cycle left it unchanged - the repair did not target it"]
events += "cycle 1: failure-named file not addressed by the repair: src/jobs/flip.ts"
```
**Fixes (all in headless.ts):**
1. `treeRunFailureFiles(o)` - a pure, exported extractor of the repo-relative file(s) the verdict
   NAMES: the generated-core LOAD entry (`o.core`, read EXPLICITLY and distinct from the per-spec
   shape), non-pass compile rows, a non-pass entry smoke, the first non-pass spec. Deduped; the
   scaffold-owned `tests/oracle.spec.ts` is excluded (never invite editing the acceptance contract
   to pass). `repairTreeDir` recomputes it from the pre-cycle verdict and every cycle verdict.
2. New `P6JourneyCycleContext.repairTargets`; `repairCycleLiveDeps` folds it into the EXISTING
   `deps.treeFailure` seam codegen already forwards, as a deterministic block
   `"Repair target file(s) named by the failure - fix these first:\n<paths>"` (capped at 8). No new
   deps key, no dead wire; no targets => deps byte-identical to legacy.
3. `repairTreeDir` accounting: after each apply, a failure-named file that was neither written nor
   already path/parse-refused is recorded as an explicit coded refusal + warning naming the reason
   (unchanged vs no-row), and an event - a silent skip can no longer look like progress.

**Honesty preserved:** `ok` still requires `verdict.ok` + a green gate (no fabricated green); a
red tree never mints; `patchRefusals` are still reported; the failing file is refused, never
overwritten with invented bytes.

## 10. Tests added + real results (W45 C/D)

Four tests in `src/lib/headless.test.ts`:
1. `Finding C: src/generated.ts (the emitter's TREE_ENTRY_PATH) is imported AND written by repair`
   (asserts `TREE_ENTRY_PATH === "src/generated.ts"`, `importTreeDir` admits it, and a repair
   cycle WRITES the changed barrel).
2. `Finding D: a tree-run that names the generated core targets it - an un-addressed file is refused, never skipped`.
3. `treeRunFailureFiles: reads the core LOAD entry explicitly; excludes the scaffold oracle spec`.
4. `repairCycleLiveDeps: folds repairTargets into the treeFailure directive (and only then)`.

| Command (Node 22.23.2) | Result |
|---|---|
| `--test src/lib/headless.test.ts` | **121 tests / 121 pass / 0 fail** (the previous `not ok 23` verify exit-3 case is now GREEN - lane 331-1 fixed it; not mine) |
| `--test scaffold + compile-check + patch-preservation + emitted-honesty + sweep73-fuzz + honesty-guards + maker-score + wild-step` | **292 tests / 291 pass / 0 fail / 1 skip** |

| Command (host Node v24.15.0) | Result |
|---|---|
| `--test src/lib/headless.test.ts` | **121 / 121 / 0** |
| `--test scaffold + compile-check + patch-preservation` | **113 / 112 pass / 0 fail / 1 skip** |

`npx eslint` on the six owned files: **exit 0**. `npx tsc --noEmit`: zero diagnostics in
`headless|scaffold|compile-check|codegen` (working tree).

**Teeth.** With the C/D behavior reverted in place (exports kept so the file still compiles):
Finding C, Finding D, and the directive tests are **RED** (`not ok 1/2/4`); the pure
`treeRunFailureFiles` test stays GREEN. Restored (byte-identical to the fixed copy): all GREEN.

## 11. Stopped on / not done (W45 C/D)

- Did NOT edit `codegen.server.ts` (the patch level's per-chunk targeting): the duplicate
  declaration it must stop emitting is 331-4's file. My half ensures the loop NAMES and does not
  silently skip the failing file; the directive is on the `treeFailure` seam codegen already reads.
- Did NOT change `treeRunFailureTail`'s bytes (its shape is pinned by journey tests); the target is
  carried as a separate field + an appended directive block, so the legacy tail is untouched when
  no targets are present.
- Did NOT treat the scaffold-owned `tests/oracle.spec.ts` as a repair target (filtered) - fixing the
  acceptance contract to pass would game the oracle.
- No keyed call, no `npm run eval`, no full gate; no probe file written inside the repo.
