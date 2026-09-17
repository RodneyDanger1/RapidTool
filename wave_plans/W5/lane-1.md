# W5 · LANE 1 — TA-15 REWIRE (the product blocker; design fully prepped by W4)

**Mission.** Land the multi-job emission: the factory currently emits ONE module wearing five
filenames. W4 prepped EVERYTHING: the mapping helpers are on disk, the probe numbers are real,
the two design subtleties are identified with fixes. Your job is the rewire + scaffold half +
oracle ctx + T-13 fin, verified by the census triple.

**Done-when (exact):** a probe (OUTSIDE the repo) on a corpus-shaped fixture shows
`reexports: 0, stubs: 0, real ≥ 3` AND ≥3 job modules each pass their OWN oracle row (no
shared implementation by hash). Plus typecheck 0 and codegen/scaffold/doctor/engine suites
green (counts GROW).

**Owned files:** `src/lib/codegen.server.ts` + test, `src/lib/scaffold.ts` + test,
`src/lib/engine.ts`, `src/lib/doctor.ts` + test, `fixes/216k_multi_job_emission.md` (body owed).
NOT yours: headless/cli/dod (L3), llm/deepseek/verify/chat/crew (L4), run-eval/corpus (L5),
harvest/algorithms-tests/logs (L2).

**MINI-TASK PLAN:**
1. Re-read the W4-L1 summary (`subagent-summary-0-20260916_210427_050695.txt`) + `fixes/216k`
   recon + the helper block (`codegen.server.ts` ~:830-1010: `SpecGraphJobTarget`,
   `specGraphJobTargets`, `bindSignaturesToJobTargets`, `treeChunkPlan`, `jobSiblingPath`).
   The probe facts: corpus binds record=5/flip=2/show=2, track=0/publish=0, leftover 16 →
   `treeChunkPlan` yields 3 job files + 2 `src/generated/` chunks.
2. REWIRE `synthesizeChunkedTree` (~:2118 / `treePathForChunk` at :2176) onto `treeChunkPlan`.
   ⚠ SUBTLETY 1 (W4-L1): the first 8-signature chunk splits at index 8, so `record`'s
   signatures are NOT contiguous in expand order → consume sibling chunks in REVERSE
   signature-index order (no forward call), and NOTE the tension in 216k.
   Keep `materializeImportableTree`'s ESM barrel at `src/generated.ts`; zero-job graphs MUST
   return the exact legacy mapping.
3. SCAFFOLD HALF: `emitTreeBridge` (:792-809) + tree-mode node loop (:2355-2423) bridge ONLY
   genuinely unmapped nodes; count + surface every bridge (warning + README line — never
   silent). Tree-owned job files skip the bridge.
4. ORACLE CTX (:2451-2454): pass job-node paths into tree mode so ≥3 job modules get their OWN
   A7 rows (today: entry-only import → every job row is a visible skip).
   ⚠ SUBTLETY 2 (W4-L1): emitted oracle spec pins bare entry names but tree ESMs export named.
   Planned fix: `const <slug> = treeModule as unknown as Record<string, (...a: never[]) => unknown>;`
   — typed cast only, NO assertion weakened, owner assertion still calls the real function.
5. T-13 FIN: engine `p6.jobs.shortfall` log + printed counted shortfall (declared 10 vs 5
   materialised; doctor's `jobScopeShortfall()` from W4 already computes it — 15/15).
6. TESTS: per-job mapping (codegen); real-emission + bridge-only-when-unmapped + visible
   warning (scaffold); census triple (doctor); shortfall log (engine). Record old→new for any
   pinned byte you must touch.
7. EVIDENCE: probe run + pasted output; complete `fixes/216k` body (work log, commands,
   results, subtleties, not-done).

**Verification:**
```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
npm run typecheck
node --experimental-strip-types --test src/lib/codegen.server.test.ts src/lib/scaffold.test.ts src/lib/doctor.test.ts
```
Baselines: codegen 86, scaffold 36, doctor 15 — grow, never drop.

**Logging:** `fixes/216k_multi_job_emission.md`. Skeleton-first. If budget dies, say so plainly
with the exact state (which of steps 2-5 landed, which didn't).
