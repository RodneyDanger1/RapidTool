# fixes/308_map7_boundary.md — TRACER-6 · BOUNDARY/ADVERSARIAL BUG MAP (RESCUED)

**Rescued by:** the parent (commander lane) from TRACER-6's final summary — its file write never landed (iteration cap).
**Method:** 33 fs-hostility cases (`~/rt6/probes/p1_fs.mjs`), 14 CLI-boundary cases (`p1_cli.sh`), emit-consistency (`p2_emit.mjs`), round-trip byte audit (`p3_roundtrip.mjs`). All re-runnable for verbatim evidence.
**Baseline:** HEAD `800a40d`. Zero product edits.

| ID | class | file:line | recipe → output | sev | box |
|---|---|---|---|---|---|
| **M7-01** | round-trip NOT byte-exact (additive drift) | `engine.ts:1979` (`kept.push({...r, rejectionHistory: r.rejectionHistory ?? [], gate: r.gate ?? null})`) + `:2311` research + `:2339` implementationSpec + `:1983` inserted rows | `importProject(exportProjectJson(p))` on a real keyless run: `R2 {"equal":false,"len1":46603,"len2":47221}`; 24 structured diffs, **all "key ADDED"**: `rejectionHistory:[]` ×13, `gate:null` ×9, `research:[]`, `implementationSpec:null`. `hydrateProject(p)` alone = same drift (`R4`). Fixed point after one hop (`R3 equal:true`) → no unbounded growth. `packet()` stable across reload (`R6 equal:true`). **Consequence:** persisted bytes ≠ re-serialized bytes → detectably different `project.json` when emitting a reloaded clone. | medium | A |
| **M7-02** | uncoded throw escaping `emitProject`'s `{ok:false}` contract | `headless.ts:1818` `mkdirSync(target,{recursive:true})` | `emitProject(proj, "<path-where-parent-is-a-FILE>/out")` → **THREW** `ENOTDIR`; CLI `emit --out afile/out` → `exit=4, code RT_E_INTERNAL`. Every other emit failure is coded (`RT_E_FOREIGN_FILES`/`RT_E_BUSY`). | low-med | A |
| **M7-03** | uncoded throw — read-only target dir | `headless.ts:1818/1822` | `emitProject(proj, roDir)` (icacls-deny) → **THREW** `EPERM ...open '.rapidtool-emit.lock'`; CLI maps it correctly (`exit=4 RT_E_PERMISSION_DENIED`) but the API-level throw bypasses the emit contract. | low | A |
| **M7-04** | uncoded throw — `saveProject` path hostility | `headless.ts:102`/`:106` | parent-is-a-FILE → `EEXIST ... mkdir`; read-only dir → `EPERM ...open '*.lock'`. `saveProject` has no coded-refusal contract (throws by design) — **recorded so it isn't re-hunted.** | low | A |
| **M7-05** | wrong error class on a directory-as-file read | `errors.ts:236-262` (`EISDIR` matches no matcher → caller fallback) | `loadProject(<dir>)` → `EISDIR`; CLI `run --project .` → `exit=1 RT_E_VALIDATION`. A wrong-KIND path reads as a validation failure, not a path-class refusal. | low | C/A |
| **M7-06** | env failure reported as "missing" | `checkpoint.server.ts:239` (`if (!existsSync(path)) return RT_E_CHECKPOINT_MISSING`) | `.rapidtool` is a **FILE** → `readCheckpoint` returns `RT_E_CHECKPOINT_MISSING` when the truth is `ENOTDIR`; `clearCheckpoint` on the same shape correctly returns `RT_E_VALIDATION` → **inconsistent class between siblings.** | low | A |
| **M7-07** | force-emit rolls the whole emit back on file-where-dir-expected | `headless.ts:1836-1870` (write loop → `rollback`) | `.rapidtool` is a FILE + `force:true` → `{ok:false, code:"RT_E_INTERNAL", error:"emit rolled back: EEXIST ..."}`. Default policy correctly coded (`RT_E_FOREIGN_FILES`). Coded + safely rolled back, but the code is the generic INTERNAL for a boundary condition. | low | A |
| **M7-08** | env-cap hostility: permissive spellings | `token-ledger.ts:138-145` (`tokenCapFromEnv`) | `"0"/"-1"/"NaN"/""/"  "/"Infinity"` = **unmetered** ✅; but `"0x10"` → **16**, `"1e99"` → **1e99** (accepted; `isUnmetered(1e99)===false`); `"12.9"` → 12. A `1e99` cap silently can never trigger while the envelope reports a cap in force. | low | B |
| **M7-09** | **COVERAGE GAP (honesty row, not a defect)** | — | **Scale probes NOT executed**: 1,000-artifact/5,000-log project, O(n²) timing, ring at 10k rows, `readRtTail` at 256KB±1, `RAPIDTOOL_BIND_ALL=1` runtime. | — | — |

**Probe scripts on disk (re-runnable):** `~/rt6/probes/{p1_fs.mjs,p1_cli.sh,p2_emit.mjs,p3_roundtrip.mjs}`.
**Note:** `emitProject` leaves a stray `.rapidtool-quarantine/` reference path only for `force` emits (E1f) — not exercised beyond.

**END OF MAP7 (rescued verbatim from the summarizer's row set).**
