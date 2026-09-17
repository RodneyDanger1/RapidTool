# W6 · LANE 1 — TA-15 COMPLETION (THE product blocker; design + helpers already landed)

**Mission.** Finish the rewire W4 designed and W5 began. The parent restored the caller to the
legacy pairing so the tree compiles — your job: make the chunked driver ACTUALLY emit
per-job files and prove the census triple.

**Done-when (exact):** probe (OUTSIDE repo) on a corpus-shaped fixture → `reexports: 0,
stubs: 0, real ≥ 3` AND ≥3 job modules each pass their OWN oracle row (no shared hash);
typecheck 0; codegen/scaffold/doctor/engine suites green (grow); `fixes/216k` body complete.

**Owned:** `src/lib/codegen.server.ts` + test, `src/lib/scaffold.ts` + test, `src/lib/engine.ts`,
`fixes/216k_multi_job_emission.md`. NOT yours: headless/cli (L2), llm/doctor (L3), run-eval (L4),
everything else (L5).

**MINI-TASK PLAN (the exact edit list):**
1. READ `fixes/216k` (D1/D2/D3 decisions) + `wave_plans/W5/lane-1.md` + the W5-L1 summary
   (`subagent-summary-0-20260916_213829_497020.txt`). Facts: `orderTreeChunks` is LANDED at
   `codegen.server.ts` ~:1016-1056 (pure); `treeChunkPlan(project, typeSignatures, groups)`
   + `TreeChunk` type in the ~:830-1010 block; caller at :1956 currently passes `chunkGroups`
   (legacy — replace it in step 3).
2. D1 = `orderTreeChunks` consumption order: leftover chunks FIRST, then job chunks in REVERSE
   plan order (siblings keep signature order; zero-job plans keep exact plan order for pre-216k
   byte parity). `synthesizeChunkedTree` must iterate the ORDERED plan and use `chunk.path`
   directly (no `treePathForChunk` for planned chunks).
3. REWIRE: change the definition (:2164) to the W5-intended signature
   `(project, brief, specRecord, complete, treeFailure)` — compute
   `const groups = chunkTypeSignatures(specRecord.typeSignatures);` + `const plan =
   orderTreeChunks(treeChunkPlan(project, specRecord.typeSignatures, groups));` INSIDE, and
   update the caller at :1956 to match (drop `chunkGroups` from the call). Zero-job/no-plan
   graphs must produce the EXACT legacy paths/behavior (byte parity for single-module projects
   stays via the `singleModuleLibraryKind` branch above — don't disturb it).
4. SCAFFOLD HALF (`scaffold.ts`): tree-mode node loop (:2355-2423) + `emitTreeBridge`
   (:792-809) — bridge ONLY genuinely-unmapped nodes; every bridge counted + surfaced
   (warning + README line); tree-owned job files (`src/jobs/*.ts` the plan maps) skip the
   bridge. Check `TREE_ALLOWED_ROOTS` covers the job paths (T-04's work allowed the entry;
   verify `src/jobs/` shapes are allowed — if not, extend the allow-list where the tree writer
   already accepts generated paths, recording the change).
5. ORACLE CTX (:2451-2454): pass tree-mode job-node paths so ≥3 job modules get their OWN A7
   rows. D2 = the emitted oracle spec may use the typed cast
   `const <slug> = treeModule as unknown as Record<string, (...a: never[]) => unknown>;` —
   typed cast only; the owner assertion still calls the real function.
6. ENGINE (T-13 fin): `p6.jobs.shortfall` log + printed counted shortfall (declared 10 vs 5
   materialised; `doctor.jobScopeShortfall` exists).
7. TESTS: per-job mapping (codegen: path keying, order, sibling `-2/-3`, zero-job parity);
   scaffold: real emission + bridge-only-when-unmapped + counted/visible bridges; doctor:
   census triple on the fixture; engine: shortfall log. Record old→new for any pinned byte.
8. EVIDENCE: probe run pasted into `216k` + the full census triple output.

**TWO RECORDED TRAPS (from W4-L1):** (a) the corpus's first 8-sig chunk splits non-contiguously
(`record`'s signatures not contiguous in expand order) — `orderTreeChunks` handles the order,
but VERIFY no forward call survives; (b) never silently bridge a job node (a bridged
`src/jobs/track.ts` keeps `reexports > 0` forever — D3).

**Verify:** `npm run typecheck`; `node --experimental-strip-types --test src/lib/codegen.server.test.ts src/lib/scaffold.test.ts src/lib/doctor.test.ts`;
baselines: codegen 86, scaffold 36, doctor 15 — grow, never drop. Log: `fixes/216k`.
Budget death ⇒ plain statement of which steps landed.
