# fixes/310_b1_locks.md — B1 · stale-lock reclamation + CLI Node global nets (M6-01/02/05/06)

**Lane:** B1 (locks/nets). **Box:** `src/lib/headless.ts` (both O_EXCL lock sites) + `scripts/rapidtool-cli.mjs` (main() catch + process nets); pins in `src/lib/headless.test.ts` + `scripts/cli-exit-taxonomy.test.mjs` (its declared purpose).
**Source map:** `fixes/308_map6_time.md` — rescued TRACER-5 rows M6-01/02/05/06 (M6-01 emit lock · M6-02 saveProject lock · M6-05 bare `main();` · M6-06 no Node global handlers). **HEAD at start:** `1af7f88`.
**Rules honored:** bugs only; no keyed calls; patch-first; legs foreground; one writer per file.

## Status (initial)

| Row | Fix | State |
|---|---|---|
| M6-01 | `emitProject` `.rapidtool-emit.lock` — stale-lock reclamation (pid-liveness + bounded age; rename-aside atomic reclaim; one `wx` retry) | IN PROGRESS |
| M6-02 | `saveProject` `<project>.lock` — same shared claim helper | IN PROGRESS |
| M6-05 | `main();` → `main().catch(exitInternalError)` — single-JSON envelope on an escaped rejection | IN PROGRESS |
| M6-06 | `process.on("unhandledRejection")` + `process.on("uncaughtException")` — same envelope/exit-4 shape | IN PROGRESS |
| Pins | dead-pid stale → acquires; live lock → still `RT_E_BUSY` (incl. `--force`); legacy identityless → fresh refuses / aged reclaims; CLI nets source+behavioral | IN PROGRESS |

**Note (coordination):** `fixes/310_b3_boundary.md` (B3) claims `headless.ts` (emit/save throws) too — my hunks touch ONLY the two lock-acquire blocks + the new helper block above `saveProject`; if B3 lands in the same file, re-check both landed (patch-first, non-overlapping regions).

(Evidence per row appended below as each lands.)
