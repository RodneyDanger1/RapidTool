# fixes/267_lane3_audit_emit.md — W27 R3 · the factory output path (codegen.server.ts, scaffold.ts, compile-check.server.ts)

**Slice:** `src/lib/codegen.server.ts`, `src/lib/scaffold.ts`, `src/lib/compile-check.server.ts` (+ the three colocated tests).
**Status: IN PROGRESS — skeleton first** (write early per the wave brief W27).
**HEAD at lane start:** `e3d3fe4` ("W24-W26: spring-clean + deep audit + bug hunters — gates green on fused bytes") — re-verify per-anchor before any coder edit.
**Mission lens:** truly autonomous software factory / best-in-class harness; GOOD code; **any kind of software (games, websites, programs, applications, tools)**; every unwired/incomplete path is a defect.
**Rules honored:** audit only (no product edits), no keyed calls (account unfunded), no full-gate runs; every claim carries file:line (read today) or real command output.

## Read-first log
- [x] `wave_plans/W27/mass-investigation.md` (full) — R3 box: A3-f01 P0 (emit-time materialization + import-smoke), A3-f02 (prompt vs emitted tsconfig), A3-f03 (partial synthesis semantics), A3-f06 (kind coverage), A3-f07, A3-f09, DV-04/TA-21 legacy.
- [x] `research/multiagent/thoroughanalysis.md` (full, 371 lines) — mission + A1–A4, C1–C6; A3 block L326-336 = the seed findings; end-marker at L371.
- [x] `research/multiagent/thoroughaction.md` (full, 498 lines) — watchdog ledger W24–W26 (what every prior lane did).
- [x] `fixes/263_index.md`, AGENTS.md, `fixes/267_lane1_audit_engine.md` (R1 skeleton — conventions).
- [ ] The bytes: scaffold.ts (READ IN FULL 2026-09-26 16:0x) · codegen.server.ts (in progress) · compile-check.server.ts (pending) · tests (pending).

## DV-04 trace note
`DV-04` has **no home in the repo** (grep across `research/`, `fixes/`, `wave_plans/`, `audit-bugs/`, `src/`, `scripts/`, `.grok/` → 0 hits outside the W27 brief itself; `git log -S"DV-04"` → nothing). Treated as a stale/renamed id; the TA-21-adjacent surface in MY slice (`deplyNotes`/`DEPLOY_HONESTY_STAMP`, `scaffold.ts:124,2174-2268`) is audited in its place. See §R3 finding note.

## Findings (rows also appended to thoroughanalysis.md §R3)
_(pending — evidence collection in progress)_

## Evidence log (running)
- scaffold.ts read in full (2713 lines, 2026-09-26 ~16:10-16:20 local). Key anchors: `treeAccepted` verbatim push `scaffold.ts:2543-2545`; kinds `:84,115-121`; game shell `:914-935`; cli/library/service stub `:936-962`; PKG_SCRIPTS `:552-579`; tsconfig strict `:607-627`; vite.config webapp-only `:2529`; UI name-dump `:873-913`.
- _(codegen.server.ts + compile-check.server.ts evidence pending)_
