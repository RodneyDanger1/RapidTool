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

---

# W5 · L1 landing (TA-15 rewire — this session)

**Status: in-progress.** Skeleton-first (rule 8). Section bodies are filled as edits land;
every claim below is a command actually run this session.

## W5-L1 design decisions (deliberate, with the two subtleties)

### D1 — consumption order (subtlety 1: "reverse signature-index chunk consumption")

- `treeChunkPlan` (W4) maps job-keyed chunks first (graph order), then the unbound leftover
  chunks. The corpus fixture binds record=[0,7,14,21,23], flip=[8,11], show=[5,6],
  leftoverA=[1,2,3,4,9,10,12,13], leftoverB=[15..20,22,24] (expand indices).
- The chunk-prompt contract is "a later file may call an earlier file's exports by name"
  (bound as IIFE parameters on the assembled entry, imported on the materialized ESM).
  Consuming the plan in graph order would synthesize `src/jobs/record.ts` FIRST (no prior
  context) while the leftovers containing the earlier signatures (1..13) — the ledger
  helpers record's job functions legitimately wrap — materialize AFTER it. A call from
  record's functions into those helpers would then be a FORWARD CALL: not imported by
  record.ts, ReferenceError when the oracle row calls the real function.
- **Decision:** `orderTreeChunks()` — in a job-keyed plan, consume the unbound leftover
  chunks FIRST (their plan/expand order kept), then the job chunks in REVERSE PLAN ORDER
  (latest-bound first … earliest last). Every job module is thus synthesized with every
  earlier-signature chunk already in its prior context; the module whose signatures span
  the widest range (record) gets the fullest context. Within one job, sibling chunks
  (`-2/-3`) keep signature order (k=0 first) — that is the order in which "sibling chunks
  import earlier files IN ORDER" holds. Zero-job plans keep their exact plan order
  (pre-216k byte parity).
- **Recorded residual tension:** with label-keyed binding no total order can make every
  interleaved pair call-safe (record's set {0,…,23} interleaves with every other chunk).
  The chosen order is the best-achievable for the fixture's three job modules
  (record/flip/show all fully precede-contexted); the residual risk is confined to
  leftover chunks whose signatures interleave with later job chunks (LB), and to
  hypothetical calls from a job module into a chunk bound AFTER it under the reversal
  (flip → record's 0/7). Documented, not hidden.

### D2 — oracle spec cast (subtlety 2: typed-cast, no assertion weakened)

- Tree ESMs export NAMED symbols (`export { a, b };`); a namespace import has a statically
  known key set, so indexing it with a spec-derived name fails the emitted tsconfig's
  typecheck (TS7053) and the pre-216k row set could not pin function names at all.
- **Decision:** job rows import the JOB module namespace and cast it once —
  `const <slug> = <module> as unknown as Record<string, (...a: never[]) => unknown>;` —
  then assert the module's real export names resolve to functions and CALL the real
  function in a guarded probe; a ReferenceError (a missing cross-file binding = exactly the
  forward-call class D1 removes) fails the row. No assertion is weakened: the old state was
  `test.skip("<id> — NOT IMPLEMENTED")`; the new state is a real, failable assertion.

### D3 — no re-export substitute at job paths (bridge policy)

- A tree-mode node file the tree does not own is a bridge (re-export of the tree entry).
  For a **job** path that is fatal to TA-15's own acceptance: `doctor --tree` counts any
  `src/jobs/*.ts` re-export as a leftover job, so a bridged `src/jobs/track.ts` would keep
  `reexports > 0` (and the factory latch false) no matter how real the other job modules
  are — exactly the artifact TA-15 removes.
- **Decision:** in tree mode a spec-graph JOB node the plan did not map gets NO file: it is
  counted + surfaced (warning + README line) as an unmaterialised job node. Non-job nodes
  (schema/api/store/…) keep the (now counted + surfaced) bridge. Never silent.

## W5-L1 work log

_(per-file, with line refs, as patches land — this session)_

## W5-L1 pinned-byte changes (old → new, deliberate)

_(each one with the reason)_

## W5-L1 evidence (commands + real observed output)

_(probe OUTSIDE the repo + suites; no invented output)_

## W5-L1 not-done

_(honest list if budget dies)_
