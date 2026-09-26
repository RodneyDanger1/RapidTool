# fixes/269_lane10_audit_flow.md — W28 R10 · THE 13-PHASE DATA FLOW END-TO-END (hop-by-hop tracer)

**Slice:** the spaces between the files — brief → intake → lattice → design → codegen → emit → tree-run → verify → packet → handover. Trace ONE journey's data hop-by-hop; at each hop read the ACTUAL structures passed; find where shape/fields/ids are lost, re-mapped wrongly, or never consumed; compare keyed vs keyless journeys; note every packet claim no data supports.
**Status: IN PROGRESS — skeleton first** (write early per the wave brief).
**HEAD at lane start:** `e3d3fe4` ("W24-W26: spring-clean + deep audit + bug hunters — gates green on fused bytes").
**Mission lens:** truly autonomous software factory / best-in-class harness; GOOD code; any software kind; continuously improving; perfect UI/UX; every unwired/incomplete path is a defect.
**Rules honored:** audit only (no product edits), no keyed calls, no full-gate runs; every claim carries file:line (read time) or real command output.
**Deliverables:** §R10 appended to `research/multiagent/thoroughanalysis.md` via the end-marker protocol (re-read before every append) + this log.

## Read-first log
- [x] `wave_plans/W28/extension.md` (full) — my box R10, append protocol, lane-log name, W28 R9–R13 ownership.
- [x] `wave_plans/W27/mass-investigation.md` (full) — mission, READ-FIRST list, R1–R8 (NOT my slice; overlapping findings cross-referenced where met).
- [x] `research/multiagent/thoroughanalysis.md` (full, 371 lines @16:09) — mission + protocol + A1–A4, C1–C6; end-marker `<!-- END-OF-FILE-MARKER-W25 … -->` is the last line; **no §R1–§R13 sections on disk yet** (W27 lanes live).
- [x] `research/multiagent/thoroughaction.md` (full, 498 lines @16:09) — W24–W26 watchdog ledger (145,062 B); END-OF-FILE-MARKER-ACTION intact last line.
- [x] AGENTS.md (repo contract, via folder context + read).
- [ ] `fixes/263_index.md` (index) — skimmed.
- [ ] THE BYTES: phases.ts / engine.ts / store.ts / headless.ts / codegen.server.ts / scaffold.ts / packet.ts / report-intake.ts / design.ts / verify.server.ts / compile-check.server.ts / rapidtool-cli.mjs — IN PROGRESS below.

## Hop table (deliverable D1 — filled as the trace lands)
| # | Hop | in-shape | out-shape | what breaks (file:line) |
|---|-----|----------|-----------|--------------------------|
| 1 | brief → create | brief string (≥12 chars), name | `Project` (emptyProject) | (tracing) |
| 2 | intake | (tracing) | | |
| 3 | lattice | (tracing) | | |
| 4 | design | (tracing) | | |
| 5 | codegen (P6) | (tracing) | | |
| 6 | emit | (tracing) | | |
| 7 | tree-run | (tracing) | | |
| 8 | verify | (tracing) | | |
| 9 | packet | (tracing) | | |
| 10 | handover | (tracing) | | |

## Findings (rows also appended to thoroughanalysis.md §R10)
_(pending — IDs R10-fNN)_

## Wiring-fix specs (deliverable D2)
_(pending — file:line → change → done-when)_
