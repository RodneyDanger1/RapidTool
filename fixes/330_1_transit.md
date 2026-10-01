# 330 · Transit (agent 1/6) — emitted-artifact integrity — landing log

Lane: 330 wave, persona 1/6 ("Transit"). Repo `C:\Users\mnril\Desktop\RapidTool Main`,
branch `main`, HEAD `c024503` at open (tree clean). Owned files: **only**
`src/lib/scaffold.ts`, `src/lib/scaffold.test.ts`, `src/lib/compile-check.server.ts`,
`src/lib/compile-check.server.test.ts`. This log is mine alone; append-only.
Runtime: repo-pinned Node 22.23.2 (`%LOCALAPPDATA%\hermes\node\node.exe`). Scratch:
`C:\Users\mnril\rt330_transit` (outside the repo; nothing in the repo was written by a probe).

## 0. Verdict in one line

The parent's premise — "the current emitter writes CommonJS while the emitted `package.json`
declares `"type":"module"`" — **does not reproduce on a fresh emit**: the current emitter
materializes CommonJS to ESM on both the `generatedTree` and `generatedSource` paths, so the
tracked `research/eval-out/…get-property.ts` artifact is **stale (pre-fixes/258 · FM-01)**.
The **real, reproducible defect** is adjacent: the **legacy `generatedSource`-only path is
unguarded** (headless's residue guard early-returns on zero tree rows) **and no gate loads the
product's generated core**, so an unloadable module ships while `compile` / the emitted spec /
`tree-run` all read green. Both are closed below, with teeth.

## 1. Fresh-emit bytes (the probe)

### 1a. Fresh keyless emit — the format/premise check

`create` → `gate --autopilot` (keyless) → `emit --out <scratch>/tree` on
`research/eval-corpus/house-flip-manager.md`. Result (recorded bytes): `package.json` carries
`"type": "module"` and `rapidtool.producer: "template"`; `src/jobs/flip.ts` ends
`export { JOBS, REJECTION, synthesize };` — **ESM matching the ESM package**. The tree's own
spec runs green. ⇒ the keyless floor is format-consistent; the parent's premise is refuted here.

### 1b. Fresh emit FROM the tracked record (the CJS artifact)

Copying the tracked `research/eval-out/coffeehouse2home-property-ledger/.rapidtool/project.json`
and emitting it (`--red-tree banner`, since its stored trail is red) produced `src/generated/get-property.ts`
ending `export { getProperty, updateProperty, … _internals };` with **no `module.exports`** — the
emit-time materializer rewrote it. Its own spec then runs `# tests 43 / # pass 25 / # fail 0`.
⇒ **the tracked tree on disk is stale**; the current emitter fixes it.

### 1c. The actual unloadable shape (reproducible, current emitter)

The `generatedSource`-only path (no tree). Project record:
`generatedTree: []`, `generatedSource = "function add…\nmodule.exports.add = add;\n"`.

- `emit` → **ok:true**, writes `src/jobs/flip.ts` byte-for-byte containing `module.exports.add = add;`
  into the `"type":"module"` package.
- Direct load: `import('./src/jobs/flip.ts')` → **`TypeError: Cannot set properties of undefined
  (setting 'add')`** (the module never loads).
- The tree's own spec → **`# tests 7 / # pass 5 / # fail 0`** — green, because the emitted spec
  imports only `store.ts` + `routes.ts`, never the generated core.
- `tree-run` (pre-fix) → **`ok: true`** — the webapp kind's entry smoke is a UI-shell skip.
  **A green factory shipped a product that cannot load.**

Root cause: `headless.materializeEmitTree` (headless.ts:2037) rewrites `generatedTree` residue and
**early-returns when `rows.length === 0`** (headless.ts:2038-2039), so a lone `generatedSource` and
any direct `scaffoldProject` caller are unguarded; `compileCheckDir` is syntactic (a CJS body parses);
and `resolveEntry` returns a UI-shell skip for `index.html` trees, so the core was never load-smoked.

## 2. Fixes (both inside owned files)

### Fix A — the emitter refuses to ship an unloadable module (`scaffold.ts`)

- `CJS_MODULE_RESIDUE_RE` + `EMITTED_CODE_EXT_RE` (scaffold.ts:204-217) — same residue shape as
  headless.ts's guard.
- The assembled-body check + coded refusal (scaffold.ts:3328-3358): after the tree/source set is
  known and before assembly, any emitted code body (a `generatedTree` row, or the lone
  `generatedSource` hosted when `!treeMode`) carrying CommonJS residue is a **refusal** —
  `{ ok:false, error: 'RT_E_VALIDATION · assembled generated module body is CommonJS but the
  emitted package declares "type":"module" … (offending file(s): …)' }`. Declare-or-strike: the
  emitter never emits bytes that contradict the package it declares. (`headless.emitProject`
  already handles `ok:false` by aborting the write, so no partial tree lands.)

Rationale for refusing rather than materializing *here*: materialization is
`codegen.materializeImportableTree` — a server-side seam. The sanctioned "make the format match"
fix for the lone-`generatedSource` path is to extend `headless.materializeEmitTree` past its
`rows.length === 0` early return; that is **headless.ts, not an owned file** (report §6). The
emitter-side refusal closes the same hole for every caller without duplicating the materializer.

### Fix B — the gate loads the product's generated core (`compile-check.server.ts`)

- `resolveEntry` refactored: the record-first headless resolution is now `resolveHeadlessEntry`
  (compile-check.server.ts:1218), shared by `resolveEntry` (compiled kinds) and the new core smoke.
- New optional `TreeRunOutcome.core` (compile-check.server.ts:406-416).
- In `treeRun`, when the kind entry is a structural UI-shell skip, the tree's generated core is
  resolved and smoke-loaded under the same bounded runner (compile-check.server.ts:1534-1543);
  an unloadable core reds the tree (compile-check.server.ts:1604-1614) and joins `verdictHash`
  only when present (compile-check.server.ts:699-702, conditional key → no-core trees keep their
  byte-identical hash). A UI shell with no generated substance is unchanged.

## 3. Sweep of the four files (step 3)

| Swept target | Finding |
|---|---|
| emitted paths written but never referenced | **None**: every `src/**` file in the fresh tree is referenced from another emitted file (`src/domain/construction.ts` via routes, `ui/console.tsx` via main.tsx, etc.). |
| silent drops | The CJS-residue gap was effectively a silent drop (unloadable core, no warning) — **now a coded refusal (Fix A) and a red core verdict (Fix B)**. |
| refusals that no longer match disk | The `TODO(E-15)` service/console entry refusals (scaffold.ts `emitKindEntry`, ~:1345/:1354) and the emitted capability-row `TODO(R3-f03)` skips remain **honest**: no recorded surface exists to implement them (a keyless/service fixture with recorded endpoints does not exist to verify against). Left as coded refusals — not faked (328 P2's boundary). |
| TODO(row) shells implementable now | The one shell that WAS implementable from disk evidence is the `generatedSource` guard above; there is no recorded data that makes the service/console entries or capability mapping real. Struck, not invented. |
| tracked artifact | `research/eval-out/coffeehouse2home-property-ledger/src/generated/get-property.ts:250` is `module.exports.getProperty = …` in a `"type":"module"` package; `tree-run` on it (read-only) is **ok:false** with `ReferenceError: module is not defined in ES module scope` — 328 P2's observation is real, and the artifact is **stale**. NOT edited (recorded trial evidence). A keyless `emit` from its own record yields *different* (materialized) bytes, so regeneration would not be byte-faithful to the recorded trial ⇒ **report only** (per the brief). |

## 4. Teeth (RESUME §13.3)

Scratch trees outside the repo, each with `package.json {"type":"module"}` + junctions to the
repo's `node_modules` and `scripts`:

| Module | Pre-fix result (HEAD module + new tests) | Post-fix (repo module + new tests) |
|---|---|---|
| `compile-check.server.ts` (`git show HEAD:… > teeth_cc/…`) | **63 tests / 60 pass / 2 fail / 1 skip** — both new core tests RED (`not ok 15`, `not ok 16`) | **63 / 62 pass / 0 fail / 1 skip** |
| `scaffold.ts` (`git show HEAD:… > teeth_sc/…`) | **47 tests / 45 pass / 2 fail / 0 skip** — both refusal tests RED (`not ok 1`, `not ok 2`) | **47 / 47 pass / 0 fail / 0 skip** |

The controls stayed green in both reverted runs (the no-core skip test and the clean-ESM control).
⇒ the new assertions detect exactly the missing behavior, not incidental state.

End-to-end with the fixed code (real CLI, real bytes):

- `emit --project proj-cjs-source.json` → **ok:false**, `RT_E_VALIDATION`, error names
  `src/jobs/flip.ts` (Fix A).
- `tree-run --dir tree-cjs-source` (the pre-fix unloadable tree) → **ok:false**, `core.kind:
  "generated-core"`, `core.run: "fail"` (Fix B).
- Clean keyless `emit` → **ok:true** (17 files); `tree-run` on it → **ok:true**, `core.run:"pass"`
  (no regression).
- `tree-run --dir tree-from-tracked` → **ok:true**, `core.run:"pass"` (the tracked RECORD still
  emits a loadable tree).

## 5. Verification (targeted — no full gate; five siblings mid-edit)

| Command | Result |
|---|---|
| `npm run typecheck` | **exit 0** |
| `& pinned-node --experimental-strip-types --test --test-reporter=tap src/lib/scaffold.test.ts` | **47 tests / 47 pass / 0 fail / 0 skip** (baseline 44 ⇒ **+3**) |
| `& pinned-node --experimental-strip-types --test --test-reporter=tap src/lib/compile-check.server.test.ts` | **63 tests / 62 pass / 0 fail / 1 skip** (baseline 60 ⇒ **+3**) |
| `npx eslint` on the four owned files | **exit 0** |

Only comments changed after the suite runs above (compile-check docstrings); no behavior change.

**Suites that import my files** (for the parent to re-run) — measured by grep:
`scaffold.test.ts` + `emitted-honesty.test.ts` + `sweep73-fuzz.test.ts` (import `scaffold.ts`);
`compile-check.server.test.ts` + `honesty-guards.test.ts` (import `compile-check.server.ts` values);
`headless.test.ts` + `maker-score.test.ts` + `wild-step.test.ts` (type-only `TreeRunOutcome`, so
affected only if the type changes). Runtime importers: `headless.ts`, `codegen.server.ts` (type),
`maker-score.ts`.

## 6. Reported, not fixed (needs a file I do not own)

1. `headless.ts:2038-2039` — `materializeEmitTree` early-returns when
   `Array.isArray(project.generatedTree) ? … : []` has zero rows, so a lone `generatedSource` with
   CommonJS residue is never materialized. **Ideal fix:** drop the zero-row early return and
   materialize `generatedSource` too (path `TREE_ENTRY_PATH`/the planned host), so every path
   matches Fix A's intent by *converting* rather than refusing. Blast radius: `headless.ts` only;
   it would turn Fix A's refusal into a successful (materialized) emit for this input.
2. `research/eval-out/**` stale artifacts — recorded trial evidence; regeneration is not
   byte-faithful, so left untouched (report §3).

## 7. Honest limits

Fix A refuses an unloadable lone `generatedSource` rather than repairing it in place (the repair
belongs in `headless.ts` — §6.1); the emitted product therefore does not emit from that record
until the record is materialized. No claim is made that the brief's business logic is implemented
elsewhere — the 328 P2 boundary on job bodies, service/console entries and capability rows is
unchanged and remains an honest refusal.
