# fixes/288_b4_backends.md — W39 · LANE B4 · THE BACKEND-EDGES BUG SWEEP

**Lane:** W39 B4. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE in path → shell `grep`/`wc` only).
**Mission:** full bug sweep + real-time fixes through the backend edges — `src/lib/llm/providers/openai-compatible.ts`, `probe.ts`, `mock.ts`, the cassette seam, the research/verify/exec layers, `rt-client.ts` minus Z3's items. CODE-ONLY — no tests, no gates, no keyed calls; real-time patches + evidence line each; `node --check` every edited file.
**Baseline HEAD:** `0f85c32` + the W29–W39 uncommitted era.
**LIVE SIBLINGS read at t0:** Z1 `fixes/287_z1_boundary_close.md` · Z2 `fixes/287_z2_contracts.md` · Z3 `fixes/287_z3_tinyfixes.md` · Z4 `fixes/287_z4_records2.md` · Z5 `fixes/287_z5_runtime_tail.md` · B1 `fixes/288_b1_components.md`. Z3 owns `rt-client.ts:693` (`projectFile: 0`/`logDirBytes: 0` → `null`) — NOT mine; left alone.

## Item ledger (append-only — one evidence line per fix, file:line → before → after)

| # | file | item | status |
|---|---|---|---|
| 1 | openai-compatible.ts | response parsing edge cases (empty choices, missing usage, non-JSON) | PENDING |
| 2 | openai-compatible.ts | vendor error → RIGHT RT_E_ class (402 divergence class) | PENDING |
| 3 | openai-compatible.ts | timeout/abort handling | PENDING |
| 4 | openai-compatible.ts | header construction | PENDING |
| 5 | probe.ts + mock.ts | probe honesty (never ok on junk); mock ≡ real provider shape | PENDING |
| 6 | research/verify/exec | input validation, coded refusals, fetch aborts, output caps, argv-only, fail-closed | PENDING |
| 7 | rt-client.ts | sweep minus Z3's items | PENDING |

## Log (append-only)

### [t0] lane start — byte-state + sibling logs read

- Sibling logs read fresh (names above). Z3's `rt-client.ts:693` item confirmed as theirs.
- This log written EARLY (before any edit).
