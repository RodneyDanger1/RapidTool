# 271 · LANE B — BUILDS + HYGIENE (W29 coder wave)

HEAD at lane start: `0f85c32`. Repo: `C:\Users\mnril\Desktop\RapidTool Main`.
Specs: `research/multiagent/thoroughanalysis.md` §R11/§R12 (+§W27 worklist rows). Box: `compile-check.server.ts`,
`browser-guard.mjs` (+browser-smoke/preview-*), `write-atomic.mjs`, `write-set.ts`, `run-eval.mjs`,
`rapidtool-cli.mjs` (EXCEPT seat/exit-taxonomy items — LANE H); `codegen.server.ts` for R12-f01 (unclaimed by other lanes);
`store.ts`/`io.ts` rows (R12-f08/f09/f11) — S owns store.ts, coordinate: read-fresh + append-only-safe edits.
Rules: targeted checks only; NO full gates; NO keyed calls; log-and-continue.

## Status board

| Row | What | Status |
|---|---|---|
| R11-f02 | `--ignore-scripts` on install leg + declared scripts via resolved `.bin` argv (no shell) | TODO |
| R11-f03 | tree-run "read-only" → honest operator label (+ check/repair --dir, emit --verify-kind) | TODO |
| R11-f06 | S-04: browser-guard win32 fail-closed | TODO |
| R11-f07 | S-05: realpath containment — ONE shared helper (write-atomic/write-set/CLI edit) | TODO |
| R11-f08 | `--force` → quarantine foreign files (move aside + report), not keep-in-place | TODO |
| R12-f03 | treeRun cpSync filter (mirror :1458) + honest UNVERIFIED note if deps absent | TODO |
| R12-f01 | prior-render cap + elision marker + per-chunk byte budget (codegen.server.ts) | TODO |
| R12-f05 | coalescer-stable message (seconds → payload) | TODO |
| R12-f07 | diagnose real counts via statSync | TODO |
| R12-f08 | rebase caps + salvageTrim inclusion (store.ts) | TODO |
| R12-f09 | persist debounce + existing crash-flush seam (store.ts) | TODO |
| R12-f11 | import cap / `tooLargeToPersist` (io.ts + consumer) | TODO |

## Log

- (t) Lane start: read `wave_plans/W29/coders.md` + §R11/§R12 rows. Mapped sites:
  - R11-f02 → `compile-check.server.ts:518-546` (`shell:true` scripts) + `:1278-1306` (npm install leg)
  - R12-f03 → `compile-check.server.ts:946-948` cpSync no filter (contrast `:1458`)
  - R12-f01 → `codegen.server.ts:3053/3117/3078` (prior unbounded)
  - R12-f11 → `src/lib/io.ts:32` `IMPORT_MAX_CHARS = 10_000_000`
  - R12-f08/f09 → `src/lib/store.ts` (`rebaseConcurrentEngine:284`, `salvageTrim:719`)
  - R12-f07 → `rapidtool-cli.mjs:3119` `projectFile: 0` hardcoded
  - R11-f03 → `rapidtool-cli.mjs:25` + verbs map + README-cli
  - R12-f05 → producer of `stale Ns` message (rt-client/rt-events or store) — TBD
