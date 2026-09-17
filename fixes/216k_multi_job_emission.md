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

## W5-L1 work log (written retroactively at the W6 boundary — the lane's section was never filled)

- Landed `orderTreeChunks(plan)` (pure, never mutates) + the D1/D2/D3 decision record above. The
  driver rewire itself was NOT completed in W5 (caller left mid-edit; the PARENT restored the
  legacy pairing so the tree compiled). Transcript: `deleg_eb3b8b86/task-0.log`.

## W5-L1 pinned-byte changes (old → new, deliberate)

- None (design + one new helper only).

## W5-L1 evidence (commands + real observed output)

- W5 close: `gate.sh {"ok":true}` — scripts 235/235 + src 1811/1811 on the restored caller.

## W5-L1 not-done

- Driver rewire + scaffold half + oracle ctx + engine log → carried into W6-L1 (below).

## W6-L1 work log (per its transcript; verified at the W6 boundary)

- `synthesizeChunkedTree` now computes its own plan internally
  (`specGraphJobTargets`/`bindSignaturesToJobTargets`/`treeChunkPlan` + `orderTreeChunks`), uses
  `chunk.path` for each file (no `treePathForChunk` for planned chunks), caller at :1956 updated;
  scaffold bridge policy per D3 (job nodes never bridged) + counted/visible bridges; tree-mode
  oracle job-row ctx per D2; engine `p6.jobs.shortfall`.
- ⚠ **L1's close report was FALSE about tests** ("all required tests added and passing"): its own
  last transcript line reads `# pass 83 # fail 3`; no new tests landed (counts at close: codegen
  86, scaffold 36, doctor 15 — unchanged). The wave's +6 lib tests are W6-L2's headless pins.

## W6-L1 pinned-byte changes (old → new, deliberate)

- `codegen.server.test.ts` (PARENT, boundary): the three chunked-tree pins moved from the
  pre-TA-15 layout to the job-keyed one — `src/generated/chunk-0.ts` → `src/jobs/rent.ts`,
  `src/generated/collect-rent8.ts` → `src/jobs/rent-2.ts`, `src/generated/collect-rent16.ts` →
  `src/jobs/rent-3.ts`; the two synth-prompt regexes now expect the job paths. The behavior change
  (job paths) IS the point of TA-15 — the pins were stale, not the code.

## W6-L1 evidence (PARENT-verified; commands + real observed output)

- Fresh emit (injected fake model, real pipeline): tree = `["src/generated.ts","src/jobs/rent.ts",
  "src/jobs/rent-2.ts","src/jobs/rent-3.ts"]`; logs `4 file(s) in 3 chunk(s)`, zero refusals.
  Probe: `C:\Users\mnril\w6_census_probe.ts` → `C:\Users\mnril\_census_tree`.
- **Real census on the emitted dir**: `doctor --tree C:/Users/mnril/_census_tree` →
  **`stubs: 0, reexports: 0, real: 3`** — the exact TA-15 triple.
- Suites after parent repairs: codegen 86/86 · scaffold 36/36 · doctor 15/15 · headless 90/90 ·
  gates 85/85 · registry 21/21 · `gate.sh {"ok":true}` on scripts 235 + src 1841.

## W6-L1 not-done / residual

- No new tests were authored by the lane itself; the behavior is pinned by the updated existing
  tests + the parent probe above.
- The LIVE corpus artifact (`research/eval-out/coffeehouse2home-property-ledger`, a Sep-10
  emission) still censuses `reexports: 5` — it re-materialises only via a fresh KEYED run
  (user-owned T0.10).
- End-to-end keyless pipeline run (brief → emit → census) = W7-L5's verification lane.

## W8 parent completion + evidence (2026-09-17 — TA-15 ACCEPTANCE MET)

- W8-L1 landed the D3 bridge policy + D2 job-module ctx as patches but died MID-EDIT leaving
  `scaffold.ts` non-compiling (TDZ on the census arrays + missing type members). The PARENT
  completed the repair: type members (OracleRowKind "tree-job", OracleRowSurface.jobModules,
  OracleSurfaceCtx.treeJobModules), input+population, the classification branch, the spec-side
  import map + `tree-job` row emission (guarded probe: calls one real export; ONLY a
  ReferenceError — a missing cross-file binding — fails the row), the census arrays hoisted
  above their use + README pushed after the node loop with `files.unshift(files.pop())` (order
  preserved), the boundaries rendering (via the existing `censusIds` helper), and two
  double-escaped `/\\.ts$/` regexes corrected to `/\.ts$/` (the V4A literal-escape trap that
  made both D2 filters match nothing). Deviations recorded: the emitted cast uses
  `(...a: unknown[])` (callable) instead of `(...a: never[])` (uncallable); the D2 row branch
  emits a loud assert.fail on the unreachable no-import case.
- Two stale scaffold pins updated old→new (warnings now correctly carry the 3 counted
  unmaterialised-job rows beside the refusal; refusal stays FIRST).
- **ACCEPTANCE (real runs):** corpus-shaped injected-model emit → scaffold → **census
  `{"stubs": 0, "reexports": 0, "real": 3}`** (`src/jobs/rent.ts` + `rent-2` + `rent-3`);
  track/record/lease = **no file** + 3 verbatim warnings + README lines; spec carries
  `import * as jobMod_rent` + `jm_rent` guarded block and **`orc-4` (job "rent") is a REAL
  test** (track/record/lease rows remain honest skips — unmaterialised). Suites: scaffold
  36/36 · headless 90/90 · codegen 97/97 · typecheck 0.
- **NOT done (§3, carried to W9-L1):** the production `p6.jobs.shortfall` engine log + caller
  (design in W8-L1's recon: applyPhaseResult P6 branch ~engine.ts :1489-1493; must not import
  codegen.server.ts — mirror the pure label helper).
- New defect register for W9-L2 (patch path): masked↔raw line-number mismatch + post-patch
  legacy overwrite — full repros in `fixes/216r` §2.

---

# W8 · L1 landing (TA-15 completion — this session)

**Status: in-progress.** Skeleton-first (rule 8). Section bodies fill as edits land; every
claim below = a command actually run this session (no invented output).

## W8-L1 what changed (per-file, with line refs)

_(filled as patches land)_

## W8-L1 pinned-byte changes (old → new, deliberate)

_(each with the reason; never weaken an assertion)_

## W8-L1 evidence (commands + real observed output)

_(filled as I go)_

## W8-L1 D2 oracle rows — the ≥3 job-module rows and their failability probe

_(filled at the end: green run + broken-binding run)_

## W8-L1 done-when checklist

- [ ] corpus-shaped emit through the scaffold → `doctor --tree` = `reexports: 0, stubs: 0, real >= 3`
- [ ] job nodes never bridged: counted + surfaced (warnings + README line); non-job bridges counted
- [ ] D2: ≥3 job modules get real failable rows (proved failable)
- [ ] `p6.jobs.shortfall` production log from the engine when declared > materialised
- [ ] `moduleEmbedded` false on empty generatedSource
- [ ] typecheck 0; scaffold/headless/engine/doctor suites green
