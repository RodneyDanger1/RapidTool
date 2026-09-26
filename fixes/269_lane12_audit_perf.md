# 269 · LANE R12 — PERFORMANCE · RELIABILITY on the real box (8GB RAM)

**Wave:** W28 · **Lane:** R12 · **Section:** thoroughanalysis.md §R12 · **Started:** 2026-09-26
**Box:** timeouts/backoffs/retries (`synthWithBackoff`, node-runner limits, budget caps) · unbounded growth
(arrays/maps/timers/subscriptions in console/store/telemetry) · watchdog/timer patterns · the run-marker
lifecycle · UI subscription leaks · the 8GB RAM wall (what paths can OOM or starve).
**NO keyed calls. NO full-gate runs. NO product edits.**
**Method:** for each finding: ① failure mode NAMED (when does it bite, on what input/size) · ② evidence
(file:line read today, or a real command's output) · ③ severity by real-world reachability · ④ coder-ready
fix spec (change → done-when) · ⑤ READY/BLOCKED/OWNER-ONLY.

## STATUS
- [x] Mandatory reads: `wave_plans/W28/extension.md`, `wave_plans/W27/mass-investigation.md` (in full)
- [x] `research/multiagent/thoroughanalysis.md` (mission + A1–A4/C1–C6 read) + `AGENTS.md`
- [x] `thoroughaction.md` ledger (read; W25/W26 history + W27 handover)
- [x] Skeleton (this file)
- [ ] Code pass: codegen.server.ts synth/backoff/budget
- [ ] Code pass: node-runner.server.ts limits
- [ ] Code pass: telemetry (rt-ring/rt-events/runtime-log/diagnose)
- [ ] Code pass: store.ts + console.tsx growth/subscriptions
- [ ] Code pass: watchdog.ts timers
- [ ] Code pass: run-eval.mjs marker lifecycle
- [ ] §R12 append via end-marker (re-read before EVERY append)
- [ ] Cross-check against A2-f07 (token cap), C4/H2 marker fixes (no duplication — cite them)

## PITFALLS / NOTES
- Repo path has a SPACE → ripgrep-style tools fail; use `cd "/c/Users/mnril/Desktop/RapidTool Main" && grep …`.
- HEAD `e3d3fe4`; append protocol = end-marker `<!-- END-OF-FILE-MARKER-W25 · every lane appends ABOVE this line · never edit or delete this line -->`; RE-READ before EVERY append.
- The 8GB box is the REAL deployment target (AGENTS.md constraint); every memory claim must be sized.
- Prior lanes own: engine/phases (R1), store/io/packet (R2), codegen/scaffold (R3), llm/server/telemetry (R4),
  scripts/CLI (R5), UI/routes (R6), docs/corpus (R7), mission-gap (R8). My slice = PERF/RELIABILITY
  (timeouts · growth · leaks · OOM). Cite their IDs; don't repeat their bugs unless the perf angle is new.

## EVIDENCE LOG (read times, file:line)

_(append as I verify)_

## FINDINGS (draft → final order)

_(to fill; IDs R12-f01…)_
