# W8 · LANE 1 — TA-15 COMPLETION: make the EMIT PATH satisfy the census triple

**Read `fixes/216u_w7_e2e_verification.md` FIRST — it contains the falsification record + every
anchor you need. Then this file.**

**Mission.** The tree half of TA-15 is REAL (codegen rewire: :1981-1984/:2237/:2277; a
directly-written tree censuses `reexports: 0, stubs: 0, real: 3`). The SCAFFOLD half was never
landed: `scaffold.ts` is untouched since 673e349. Make the end-to-end emit path satisfy the
triple, plus the two honesty items L5 found.

**Done-when (all on REAL runs):**
1. A corpus-shaped emit **through the scaffold** (rebuild L5's `probe_scaffold_bridge.ts` from
   `C:\Users\mnril\_w7l5\` or write a new probe OUTSIDE the repo) → `doctor --tree` on the
   scaffold OUTPUT shows `reexports: 0, stubs: 0, real >= 3`.
2. Spec-graph JOB nodes the plan did not map are NEVER bridged — counted + surfaced (warning +
   README line), non-job unmapped nodes keep their (now counted) bridge.
3. Tree-mode oracle ctx gives ≥3 job modules their OWN rows (D2 — real failable assertions, not
   `test.skip`); a job module missing a cross-file binding FAILS its row (the D1 forward-call
   detector).
4. `p6.jobs.shortfall` production log exists (engine caller for `doctor.jobScopeShortfall`) and
   is emitted when declared > materialised.
5. `moduleEmbedded` is FALSE when `generatedSource` is empty (`headless.ts:1467`).
6. typecheck 0; scaffold/headless/engine/doctor suites green (grow); `fixes/216k` gets a W8
   section with real command output.

**Owned:** `src/lib/scaffold.ts` + test, `src/lib/headless.ts` + test, `src/lib/engine.ts`,
`fixes/216k_multi_job_emission.md`. NOT yours: scripts/* (L3), fixes/216o/p/v (L2),
fixes/216t (L4), codegen.server.test.ts + fixes/216r (L5).

**Key anchors:** scaffold tree-mode node loop ~:2370-2384 (unconditional bridge today);
`isJob` :2360/:2392 (non-tree branch only); warnings only treeRefusals :2466; `repairTreePathRefusal`
:2018; headless `moduleEmbedded` :1467; L5 probes + outputs under `C:\Users\mnril\_w7l5\`.
**TRAPS:** keep every bridged-path behavior byte-compatible for NON-job nodes except the added
count/surface; do not regress codegen 86 or headless 90; the corpus census probe path is
`research/eval-out/coffeehouse2home-property-ledger` — use a FRESH scaffold output dir outside
the repo, never the stale committed artifact. Budget death ⇒ plain state of which of 1-6 landed.
