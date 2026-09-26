# 262 — LANE 3 (W23) · the two P6 probes: p6-brief-fit (§P1) + p6-arch (§P2)

**Status:** LANDED — both probe clauses edited per `fixes/255_lane2_probe_truth.md` §P1/§P2.
**Lane box (stated per brief):** `src/lib/dod.ts`, `src/lib/gates.ts` (probe regions ONLY). CODE ONLY — no test/typecheck/build/lint runs this wave (owner instruction). Verification happens at the parent boundary.
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` — only file touched: `src/lib/dod.ts` (108 inserted / 26 removed net over the 5 hunks).

> **BOX MAPPING NOTE (named exactly):** `src/lib/gates.ts` **does not exist** in this repo. The P6 DoD
> gate registry + probes live in `src/lib/dod.ts` (header comment: "Machine-checkable Definition-of-Done
> gate registry (T8) — dod.ts"; the file's own run line is `node --experimental-strip-types --test
> src/lib/gates.test.ts`). `src/lib/gates.test.ts` is the *test* file and is outside this lane's "probe
> regions ONLY" box — no test edits were made (per §P1 the pins are re-run later: brief-fit suite
> `gates.test.ts:541-576`, arch suite `:878-1035`).

## §P1 — p6-brief-fit (LANDED)

**Clause:** `DOD[6]` item `p6-brief-fit` — `src/lib/dod.ts` (item brace was `:520`, now `:602`; item spans `:602-633`).
**Defect (255 §P1):** the probe read `p.generatedSource` only. In tree mode that field is the
**ESM barrel** (`export * from "./generated/chunk-0.ts"` …), so a fully-synthesized tree measured
**0 hits vs bar 49** on the 2026-09-10 artifact (63 hits on the tree union). The engine's own
pre-acceptance fit check measures `assembleTreeEntry(accepted)` — this phase gate measured a different,
empty artifact.

**Before (dod.ts:530-535 pre-edit):**
```ts
probe: (p) => {
  const { required } = briefNounHits(p.brief);
  if (required.length === 0) return true;
  const hits = identifierHits(required, p.generatedSource ?? "");
  return hits.length >= Math.max(1, Math.ceil(required.length * 0.5));
},
```

**After (probe body dod.ts:613-632; criterion :611-612):**
```ts
probe: (p) => {
  const { required } = briefNounHits(p.brief);
  if (required.length === 0) return true;
  // fixes/255 §P1: in tree mode generatedSource is the ESM BARREL … Read the
  // union of the barrel + every generatedTree file … union can only ADD hits,
  // so no verdict flips PASS→FAIL.
  const tree = Array.isArray(p.generatedTree) ? p.generatedTree : [];
  const source =
    tree.length > 0
      ? [p.generatedSource ?? "", ...tree.map((f) => (f && typeof f.source === "string" ? f.source : ""))].join("\n")
      : p.generatedSource ?? "";
  const hits = identifierHits(required, source);
  return hits.length >= Math.max(1, Math.ceil(required.length * 0.5));
},
```
- Legacy/keyless path (no `generatedTree`) is byte-identical in behaviour: reads `generatedSource` alone.
- Tree path reads barrel + every tree file (same artifact the engine's pre-acceptance check reads).
- Monotone in hits ⇒ **no PASS→FAIL flip possible**; run #2's partial tree stays 16 hits < 49 (honest: a refused run is not rescued).
- **Declare-or-strike companion (same hunk):** criterion text `"(or spec exists and is honored)"` removed — the probe never evaluated it (honesty contract #3; grep showed the string existed only at this line; evidence hash is over `id:pass|fail` pairs, not criterion text — hash-stable change). New text: *"Brief-conformance: required brief nouns appear as identifiers in the generated source (single-module, or the union of the tree files in tree mode)"* (dod.ts:601-602).

## §P2 — p6-arch (LANDED, in-tree-target barrel exemption)

**Clause:** `archTrace()` stubFiles computation + `DOD[6]` item `p6-arch` — `src/lib/dod.ts`.
**Defect (255 §P2):** the engine's own assembled entry barrel (`src/generated.ts`,
`export * from "./generated/chunk-0.ts"`) is a pure reexport file → `isStubSource→isReexportOnlySource`
flagged it in `stubFiles` → the probe failed **even at `missing=0`** (measured 2026-09-10 full tree:
`missing 0 / stubFiles ["src/generated.ts"]`). A machine-emitted barrel is not a leftover job.

**Edits (file:line, current):**
1. `ArchTrace.stubFiles` doc comment `:194-197` — now says reexport-only **jobs whose targets point
   OUTSIDE the tree** are stubs; the in-tree-target barrel is exempt (§P2).
2. **New pure helpers / refactors** `:208-299` — `hasTodoMarker()` (`:215-221`, the two E-15 marker
   declarations, extracted so the exemption can consult them); `isStubSource` `:208-213` refactored onto
   it (behaviour byte-identical); `stripCommentsAndCollapse()` (`:223-231`; `isReexportOnlySource`
   `:233-245` refactored to use it — behaviour byte-identical); `reexportSpecifiers()` (`:249-258`),
   `resolveTreeSpecifier()` (`:260-274`), `reexportTargetsAllInTree()` (`:276-299`, node-style
   candidates: exact / extensionless→`.ts/.tsx//index.ts` / `.js→.ts`, relative-only; bare specifiers
   return false).
   **Refinement of the literal §P2 reading (declared, not silent):** an explicit `TODO(E-15)` /
   `throw-TODO` marker DOMINATES the exemption — a file that declares itself unfinished is never
   rescued, even when every reexport target resolves in-tree. Rationale: §P2 exempts the barrel because
   it is "machine assembly, not a leftover job"; a TODO-marked file IS a leftover job. Both §P2-named
   fixtures behave exactly as specified (clean barrel exempt; `./host.ts` leftover stub), and the engine
   barrel never carries a marker. Found by the scratch litmus vector V4e (below), fixed before logging.
3. **`archTrace` stubFiles** `:407-426`:
```ts
const paths = new Set(files.map((f) => f.path));
const stubFiles = files
  .filter((f) => {
    if (stubs.has(f.source)) return true;            // deterministic template floor
    if (isReexportOnlySource(f.source) && !hasTodoMarker(f.source)) {
      return !reexportTargetsAllInTree(f, paths);    // in-tree barrel: exempt
    }
    return isStubSource(f.source);                   // real code / TODO / out-of-tree
  })
  .map((f) => f.path);
```
4. **p6-arch comment + criterion text** `:634-657` (comment addendum `:644-648`, criterion `:651-652`) —
   "no tree file is a template stub **or an out-of-tree reexport-only leftover** (an assembly barrel
   whose targets all resolve in-tree is exempt; absent tree = single-module legacy path)"; the addendum
   also declares that TODO markers always stand as stubs.

**Pins deliberately preserved (verified by reading the fixtures):**
- `gates.test.ts:1018-1029` E-15 leftover `'export { createBoard, addColumn } from "./host.ts";'` at
  `src/jobs/leftover.ts` → target `src/jobs/host.ts` ∉ single-file tree ⇒ **stays a stub**, probe still fails. ✓
- `gates.test.ts:1003-1016` TODO(E-15) stub ⇒ not reexport-only ⇒ **stays a stub**. ✓
- `gates.test.ts:908-923` template-stub tree ⇒ first branch, unchanged. ✓
- `isStubSource`/`isReexportOnlySource` exported semantics UNCHANGED (maker-score.ts:300,354-355 and
  doctor.ts's `archProductComplete(archTrace(...))` consumers see only the intended archTrace change).

## CROSS-BOX NEEDS (named exactly)

1. **LANE 6's box — `src/lib/doctor.test.ts:383-395` (+ the OV-9 narrative).** REQUIRED companion edit per
   255 §P2: the pin `assert.deepEqual(t.stubFiles, ["src/generated.ts"])` (W18-OV-9's "the leftover IS
   the reason" reading) encodes the OPPOSITE of the landed exemption. With §P2 landed, a full tree's
   barrel is exempt ⇒ that expectation must be corrected to the in-tree-target semantics (and the OV-9
   narrative updated) or the test goes red for the right reason. **LANE 6 owns `doctor.test.ts` — not
   touched here.** (Also already noted in 255 `[EXT-FAIL]` row 1: that test currently reads a LIVE eval
   artifact; LANE 6's fix should pin a committed fixture copy.)
2. **No emitter-side widening needed.** Both fixes read fields the artifact already carries
   (`generatedSource`, `generatedTree[].path/.source` — types.ts:355-364, `GeneratedTreeFile` :285-292).
   `codegen.server.ts` untouched (LANE 2's box); the §P2 alternative (stop recording the barrel) was NOT
   taken — the §P2 preferred branch (exemption) was landed as specified.
3. **For the record (not a blocker):** `src/components/console.tsx:6047` cites `dod.ts:192-208` for the
   p6-brief-fit wording — that line ref was already stale before this wave; console reads criteria
   dynamically by id (`:5864-5881`), so no console edit is required for the criterion-text change.

## Verification performed (free checks only — no suite runs)

The wave brief allows "plain `node --check`-class syntax sanity ONLY if free"; two zero-side-effect checks
were run (no `npm test`/typecheck/build/lint, no repo test file, no repo module executed):
1. `node --experimental-strip-types --check src/lib/dod.ts` → **exit 0** (parse-only).
2. Scratch logic litmus `C:\Users\mnril\w23l3_scratch\probe.mjs` — OUTSIDE the repo, helper functions
   copied VERBATIM from the landed `dod.ts`, no imports/writes/test files: **14/14 vectors pass** —
   clean barrel exempt (V1), E-15 `./host.ts` leftover stays stub (V2), multi-target with one target
   outside stays stub (V3), `../` / extensionless / bare-specifier / TODO-marker edges (V4a-f), §P1
   union monotonicity proxy (V5). The first run caught the marker-ordering edge (V4e) that produced the
   `hasTodoMarker` guard in §P2 — the litmus drove a real fix, not just a smoke test. (One litmus
   assertion of my own was malformed and corrected; that failure was in the harness, not in `dod.ts`.)

## Claims vs bytes (self-check)

- Every edit above is present on disk; line numbers re-read after landing (`grep -n` output in session). ✅
- `git status`: the only file this lane modified is `src/lib/dod.ts` (worktree otherwise dirty from
  concurrent lanes — untouched by me). ✅
- No `npm test` / typecheck / build / lint / repo-suite run this wave (CODE ONLY per the wave brief).
  The auto-lint note on each patch (`TS6053 file not found`) is the space-in-path artifact of the patch
  tool's checker, not a real diagnostic. Full-suite verification is deferred to the parent boundary as
  the brief schedules. ✅
- No stubs, no TODOs added, no eslint-disable. Two commented refusals carry `fixes/255 §P1/§P2` codes. ✅
