# 216k — W3 · Lane 1: multi-job emission (TA-15) + job-scope reconciliation (T-13)

**Lane:** W3 · L1 of the W3 "product wave" (taskuniverselog.md §4) · **Status: in-progress**
**Owned files:** `src/lib/codegen.server.ts` (+ `.test.ts`), `src/lib/engine.ts`,
`src/lib/scaffold.ts` (+ `.test.ts`), `src/lib/doctor.ts` (+ `.test.ts`), this log.
**Task:** P0-04 (TA-15 + T-13) — the factory emits ONE module wearing five filenames:
`doctor --tree research/eval-out/coffeehouse2home-property-ledger` → `{stubs:0, reexports:5, real:0}`.
**Spec:** `research/multiagent/105_plan_critique.md` TA-15 (`:610`), `106_rapidtool_deep_analysis.md`
F-03/F-06/F-10 + §6 T-13/T-15; `100:184` ("the chunk→file mapping must emit real per-job modules,
or the job names must stop being advertised as jobs").

## Done-when (from the brief)

- A corpus-shaped fixture reports `reexports: 0, stubs: 0, real ≥ 3`.
- ≥3 job modules each pass their own oracle row; no shared implementation by hash.
- `npm run typecheck` 0; codegen/scaffold/doctor suites green (counts grow, never drop).
- `fixes/216f_synthesis_honesty.md` completed from the R3 summary; this log written.
- Probe (.sh/.ts OUTSIDE the repo) reproduces the old map and the new map; real output pasted here.

## Recon (what the bug actually is)

Verified on disk 2026-09-16 (W4-L1):

- The mapping helpers are LANDED and UNWIRED: `specGraphJobTargets` /
  `bindSignaturesToJobTargets` / `treeChunkPlan` / `jobSiblingPath` /
  `genericTreePath` live at `codegen.server.ts:830-1010`; the only callers are
  none — `synthesizeChunkedTree` (`:2118`) still computes
  `treePathForChunk(i, chunkNames[i], taken)` at `:2176` (index-keyed only),
  so no chunk can ever land at a `src/jobs/*.ts` spec-graph node path.
- Real corpus binding census (probe 1, OUTSIDE the repo, real
  `research/eval-out/coffeehouse2home-property-ledger/.rapidtool/project.json`):
  `lattice.jobs` = 10 (`track,record,flip,show,publish,sync,lease,stage,rent,bid`),
  spec-graph job nodes = 5 (`src/jobs/{track,record,flip,show,publish}.ts`),
  and the 25 recorded `typeSignatures` bind as
  `record`=5, `flip`=2, `show`=2, `track`=0, `publish`=0, leftover=16
  → `treeChunkPlan` yields `src/jobs/{record,flip,show}.ts` + 2
  `src/generated/*` chunks. (First-match label binding is graph order, so
  `publishShowingSlots` binds to `show`; `track` has no matching signature.)
- Scaffold tree-mode node loop (`scaffold.ts:2355-2423`): tree-owned paths are
  skipped (`:2369`), every other non-`ui` node is silently bridged to the tree
  entry (`emitTreeBridge`, `:792-809`) — uncounted, unsurfaced.
- Tree-mode oracle ctx (`:2451-2454`) passes only `treeEntryPath` + `treePaths`,
  so `oracleRowSurface` has `apiOk=false, hostOk=false` and every A7 row —
  including the job rows — is a `test.skip("<id> — NOT IMPLEMENTED")`
  (`scaffold.ts:1508-1524`).
- Deterministic-floor census (probe 2): kanban 1/1, ledger 4/4, corpus 10/5 —
  so a "declared > materialised" README line renders only for corpus-shaped
  briefs (no byte drift for the existing pinned scaffold fixtures).
- `doctor --tree` reads `src/jobs/*.ts` bytes (`headless.collectJobSources`
  `:2892`) and classifies with `classifyJobSource` (doctor.ts) — a
  `export * from` bridge is a `reexport`, so the census triple follows the
  emitted files' real content.

## What changed

_(per-file, with line refs, as patches land)_

## Pinned-behaviour changes (old → new, deliberate)

_(each one with the reason; never weaken an assertion)_

## Evidence (commands + real observed output)

_(filled as I go — no invented output)_

## T-13 counted shortfall (declared lattice.jobs vs materialised job nodes)

_(where persisted + where printed)_

## Verification

_(commands + real observed output; filled at the end)_
