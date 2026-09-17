# 216u — W7-L5 E2E verification (assembled by the PARENT from the lane's evidence)

**Lane:** W7-L5 (`deleg_ce19b316` task-4). The lane ran every check against live bytes but ran out
of iterations before authoring this file; the parent assembles its verdicts VERBATIM from the
lane's summary + on-disk evidence under `C:\Users\mnril\_w7l5\`. Every claim below = a command the
lane actually ran (or is explicitly marked as not run).

## 1. Keyless E2E (brief → gate → approve → emit → doctor) — PASS, with one honesty defect

Real CLI flow with `DEEPSEEK_API_KEY=` (empty):
- `create --brief 'A kanban board tool with columns, cards and drag.'` → exit 0, `{ok:true, phaseCounts:{ready:1, locked:12}}`
- `gate --autopilot` → **exit 2, `awaiting_hitl` at P4** (honest park — a forceHuman HITL gate)
- `approve` (agent seat) → **exit 1** `RT_E_VALIDATION` — "approve from a non-TTY requires --i-am-human"; nothing written
- `approve --i-am-human` (no out-of-band token) → **exit 1** `RT_E_VALIDATION` — "human-seat-unverified"; nothing written
- `emit --run` → exit 0; 15 files; `treeRun.ok: true`; `tests/oracle.spec.ts` 5 pass / 0 fail;
  compile 8 pass / 0 fail / 7 skip; the emitted project's own typecheck **honestly "UNVERIFIED"**
  (never a fabricated pass); `src/jobs/drag.ts` = TODO(E-15) throw stub
- `doctor --tree` on the emit → `{stubs: 1, reexports: 0, real: 0}`, `autonomousSoftwareFactory: false`
- `diagnose` → 3 error events incl. both approve refusals + the gate exit 2

**DEFECT (found, unfixed):** `headless.ts:1467` — `moduleEmbedded` compares with
`f.body.includes(project.generatedSource ?? "")`; an EMPTY `generatedSource` makes this `true`, so
a purely-stubbed keyless emit reports `moduleEmbedded: true` while emitting no generated module.
Repro: the keyless emit above (generatedSource len 0, generatedTree rows 0) → `moduleEmbedded: true`.

## 2. Scaffold-bridge claims vs bytes — **FALSIFIED**

- `grep -n '216k' src/lib/scaffold.ts` → **exit 1, ZERO hits**.
- `grep -n 'isJob' src/lib/scaffold.ts` → only :2360 and :2392 — the **non-tree** branch.
- `grep -n 'warning' src/lib/scaffold.ts` → warnings only ever carry treeRefusals (:2466); no
  bridge counting, no bridge warning, no README bridge line.
- `git log --oneline -8 -- src/lib/scaffold.ts` → **last change = 673e349 (W1–W4)**; scaffold.ts
  untouched by the W5 (e97e72d) and W6 (994b201) close commits → *both* W5-L1's and W6-L1's
  "scaffold half landed" claims were never real.
- Live probe (corpus project): all 5 spec-graph job nodes emitted as
  `export * from "../generated.ts"` bridges; `warnings: []`; `doctor --tree` on it →
  **`{stubs: 0, reexports: 5, real: 0}`** — the end-to-end product path still fails TA-15.
- Probe2 (injected model): of 4 job nodes only `src/jobs/rent.ts` got the verbatim tree;
  track/record/lease bridged; the oracle ctx carries no job surface → **5/5 oracle rows are
  `test.skip("NOT IMPLEMENTED")`** — D2's "≥3 job rows get their own row" is unachievable as wired.

## 3. Determinism — path/log identity PASS; per-file sha1 NOT RUN

probe1 (`_census_tree`) and probe2 (`census_tree_b`) both emitted exactly
`[src/generated.ts, src/jobs/rent.ts, src/jobs/rent-2.ts, src/jobs/rent-3.ts]` with identical
p6 logs (`4 file(s) in 3 chunk(s)`). Per-file sha1 comparison was NOT executed — **do not read
determinism as fully verified** (withheld).

## 4. Related honesty items (found while verifying)

- `grep -rn 'p6\.jobs' src/` → only `doctor.ts:109` (a comment); **no production
  `p6.jobs.shortfall` log exists**. `jobScopeShortfall` has NO production caller
  (`doctor.ts:126` + its test only). → W6-L1's "engine emits p6.jobs.shortfall" claim: UNSUPPORTED.
- The codegen TREE rewire itself DID land and is real (`orderTreeChunks`/`treeChunkPlan` at
  codegen.server.ts :1981-1984, :2237, :2277; the W6 parent census probe reproduced the triple on
  a directly-written tree). TA-15 status = **tree half REAL; scaffold half + D2 oracle ctx +
  T-13 log NOT LANDED** → handed to W8-L1.

## 5. Not done / handed off

- fixes/216u authorship (this file), per-file sha1 determinism, `doctor --tree` re-run on
  `C:\Users\mnril\_census_tree`.
- W8-L1 owns: scaffold D3 bridge policy (job nodes never bridged; counted + surfaced),
  D2 oracle job-row ctx, `p6.jobs.shortfall` production log + caller, moduleEmbedded empty-string
  defect fix.
- Evidence index: `C:\Users\mnril\_w7l5\` (drive-log.txt, s2-corpus-scaffold-census.json,
  s3-probe1.out, s3-probe2.out, corpus_scaffold/, census_tree_b/).
