# W4 · LANE 1 — TA-15 rewire + T-13 (THE product blocker)

**Mission.** The factory still emits ONE module wearing five filenames. W3 landed the
mapping helpers in `codegen.server.ts` but the pipeline never calls them. Your job: rewire
the chunked driver onto those helpers, fix the scaffold bridge so it can only be a visible
fallback, and persist the declared-vs-materialised job shortfall.

**Done-when (exact):** a corpus-shaped fixture reports `reexports: 0, stubs: 0, real ≥ 3`
via the doctor inventory AND ≥3 job modules each pass their OWN oracle row (no shared
implementation by hash). Plus: `npm run typecheck` 0 and codegen/scaffold/doctor suites green.

**Owned files (yours alone):** `src/lib/codegen.server.ts` + `codegen.server.test.ts`,
`src/lib/scaffold.ts` + `scaffold.test.ts`, `src/lib/doctor.ts` + `doctor.test.ts`,
`src/lib/engine.ts`, `fixes/216k_multi_job_emission.md`.
Neighbors you must NOT touch: headless/compile-check (nobody), verify/report-intake (L3),
console/UI (L4), phases/packet/algorithms/algo-tools/harvest/knowledge (L5).

**MINI-TASK PLAN (follow in order):**
1. Re-read the LANDED helper block `codegen.server.ts` ~:834-1015 (`SpecGraphJobTarget`,
   `jobLabelFromPurpose`, `isJobTreeNodePath`, `specGraphJobTargets`,
   `bindSignaturesToJobTargets`, `TreeChunk`, `jobSiblingPath`, `treeChunkPlan`) and the
   `fixes/216k` skeleton. The helpers are UNUSED; `synthesizeChunkedTree` (~:1940) still
   calls `treePathForChunk`.
2. REWIRE `synthesizeChunkedTree` onto `treeChunkPlan`: each job node's file is written by
   the tree pass (node's own path = its first chunk; `-2/-3` siblings for overflow);
   unbound signatures keep the legacy `src/generated/` family; a graph with zero keyable
   job nodes must return the pre-216k mapping EXACTLY. Keep the ESM barrel at
   `src/generated.ts`, determinism, and the escaping contracts.
3. SCAFFOLD HALF: `emitTreeBridge` (~:792-809) and the node loop (~:2355-2423) may bridge
   ONLY genuinely unmapped nodes, and every bridge must be COUNTED + SURFACED (warning +
   README line — never a silent substitute). Job nodes whose file the tree now owns skip
   the bridge entirely.
4. ORACLE ROWS: pass the job-node paths into the oracle ctx so ≥3 job modules get their
   OWN rows. Today tree mode imports only the entry, so every job row is a visible skip.
5. T-13: persist + PRINT the counted shortfall (declared `lattice.jobs` = 10 vs
   materialised job nodes = 5) — log line + README/packet note. Per dossier: mismatch
   either fails the run or is persisted + printed as a counted shortfall (prefer the report).
6. TESTS: codegen per-job mapping; scaffold real-emission + bridge-only-when-unmapped +
   visible warning; doctor inventory assertion on the fixture; T-13 shortfall. Record any
   pinned-byte change old → new.
7. EVIDENCE: one probe (OUTSIDE the repo) printing the job-file map + the doctor census
   triple; paste real output. Complete `fixes/216k` (skeleton first, extend as you go).

**PARENT FINDINGS & TRAPS:**
- The R3 summary's "JSDoc `*/` bug + 216f tests owed" is STALE — the parent fixed the JSDoc
  at the W2 boundary and codegen.server.test.ts runs 86/86. Do NOT re-fix; do NOT assume breakage.
- Parent removed two unused imports from `codegen.server.test.ts` (`p6SynthesisNondeterministicRepairPrompt` /
  `p6SynthesisProseRepairPrompt`). If you pin those repair prompts, RE-IMPORT them (direct
  builder-content pins would be a nice win, optional).
- `fixes/216e` + `fixes/216l` are already complete (W3-L2). Not yours.
- engine.ts is YOURS ALONE this wave. T-11 and the T4 hops are deferred — do NOT touch them.
- W3-L1's probe showed: declared jobs 10 (track, record, flip, show, publish, sync, lease,
  stage, rent, bid) vs 5 spec-graph job nodes; 20 derived signatures → legacy 8/8/4 chunks
  with no chunk path at any job path.

**Verification (exact commands):**
```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
npm run typecheck
node --experimental-strip-types --test src/lib/codegen.server.test.ts src/lib/scaffold.test.ts src/lib/doctor.test.ts
```
Baselines (grow, never drop): codegen 86, scaffold 36, doctor = count your first run prints.

**Logging:** `fixes/216k_multi_job_emission.md` — skeleton FIRST, extend as you go. You are its only writer.
If you run out of budget mid-edit, say so PLAINLY with the real state on disk.
