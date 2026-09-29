# fixes/307_b3_telemetry.md — B3 · TELEMETRY WIRING SWEEP (rt-events / runtime-log / diagnose reads)

> Wave 307 · B-lane · HEAD `84784b5` · box (sole writer): `src/lib/rt-events.ts` · `src/lib/runtime-log.server.ts`
> (+ their colocated tests) · the CLI `diagnose` arm ONLY for its event reads (coordinate: B4 may read CLI —
> record 'for B4' if editing). Siblings live: B1 engine/store/headless · B2 packet/handoff/crew/llm · B4 diagnose/
> scorecard/run-eval read-sides + battery · U1 console.tsx · U2 routes + rt-client/rt-timeline/rt-ring.
> **MANDATE: bugs / non-wired / partial only.** NO keyed calls. Legs FOREGROUND.
> Source of truth for this sweep: F4's recon (fixes/306_f4_live.md skeleton + subagent-summary-3-20260929_081800_734961.txt).

## 0 — Status board

| Item | Status |
|---|---|
| Early log | DONE (this file) |
| Recon: F4 summary recovered (3 real seams + census 38/56) | DONE |
| Reverse audit: every emit site → registry membership | TODO |
| Registry additions (additive-only) for unregistered emits | TODO |
| Emissions at real seams in-box + handoffs for siblings | TODO |
| runtime-log.server.ts row enrichment (stable-backwards) | TODO |
| diagnose event reads still valid | TODO |
| Pins + re-census (38 must DROP, evidence) | TODO |

## 1 — Reverse audit (emit sites → registry)

- (pending)

## 2 — Emissions at real seams

- (pending)

## 3 — Row enrichment

- (pending)

## 4 — Re-census

- (pending)
