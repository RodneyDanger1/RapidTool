# fixes/285_g4_operator_visibility.md — W38 · LANE G4 · THE OPERATOR/DELEGATOR-VISIBILITY GUARANTOR

**Lane:** W38 G4. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · HEAD `0f85c32` + the W29–W38 uncommitted era.
**Mission:** can the OPERATOR (the human, and any delegator reading outputs) SEE everything they need?
Every printed field traces to a real read; unknown is `null` + 'not measured' (never a fake 0); the run
evidence + checkpoint existence are surfaced by a verb, not by `ls`; every verb's envelope carries what a
machine-reader needs; the telemetry panes' fields come from real event fields; START-HERE/README's run
commands actually run and their status claims match today's bytes.
**Contract:** CODE-ONLY — no test runs, no typecheck, no builds, no gates, no keyed calls. TINY FIXES ONLY.
**Live siblings (never touch their live files — log `for <lane>`):** Y1 (model: `codegen.server.ts` + `llm/**`) ·
Y2 (runtime: `engine.ts`/`store.ts`/`phases.ts`/`dod.ts`/`packet.ts`/`io.ts`/`rt-*.ts`) · G1 (wiring: `console.tsx` +
`src/routes/**` + the seam facades) · G2 (TBD — identified by live mtimes below).

## [t0] Byte-state (this tree, this session)

| File | Bytes/lines | Note |
|---|---|---|
| `scripts/rapidtool-cli.mjs` | 177,352 B / 3,5xx lines | the 36-verb dispatcher; `doctor` @3438, `diagnose` @3458 |
| `src/lib/headless.ts` | 186,532 B | `doctorStatus` producer |
| `src/components/runtime-timeline-pane.tsx` | 10,598 B | telemetry pane |
| `src/lib/rt-client.ts` | (Y2's box) | read-only |
| `src/lib/checkpoint.server.ts` | 18,037 B | N2's module |

## STATUS TABLE (item → file:line → ✓/FIXED/for-<lane> → evidence)

_(rows land below — append-only)_

## Log (append-only)
