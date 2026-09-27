# fixes/276_f2_integrator.md — W33 · LANE F2 — THE INTEGRATOR + VERIFIER

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · **HEAD:** `0f85c32` + ~2,700 uncommitted insertions (W29–W32 era).
**Job:** verify every F1/F3 "REAL" claim against bytes (seam exists · real call site exists · refusal fires with its coded reason); land the missing cross-wires (the seams needing a THIRD connector); sweep TODO honesty; run the wave's key legs and report reds precisely; append §F2 to `finalsprint.md`.
**Rules:** smallest honest patches · additive only · `TODO(<id>)` at the exact logic line · no fake wiring · targeted checks only · NO full gates · NO keyed calls · log-and-continue · re-read finalsprint.md before EVERY append (its END marker = `<!-- END-OF-FILE-MARKER-SPRINT · every lane appends ABOVE this line · never edit or delete this line -->`, line 244).

## [t0 ~19:02] Lane start — reads + t0 truth probe (bytes, not logs)

Reads done: `wave_plans/W33/unlanded-block.md` · `START-HERE.md` · `finalsprint.md` (tail + marker) · register §R8/§R13 · `fixes/272_s1_autonomy.md` · `fixes/272_s2_universality.md` · `fixes/272_s5_finish_ui.md` · `fixes/274_wdx2.md` · `fixes/274_wdx3.md` · `fixes/276_f3_ui_close.md` (F3's t0 probe — same conclusions, independently reproduced below).

**Sibling state at t0:** F3's log exists (`fixes/276_f3_ui_close.md`, 19:02:07; box = console.tsx UI surfacing + E-25 red + headless.test.ts red + finalsprint appends). **F1's log NOT on disk yet.** No product-file mtime newer than 18:28:45 → as of t0, NEITHER sibling has landed bytes into src/scripts yet.

## [t0] RUNNING AUDIT TABLE — item → claimed → verified-wired? → action

| # | Item | Claimed where | t0 verified state (bytes) | Verdict | Action |
|---|---|---|---|---|---|
| A1 | R14-f01 wild-review wire | `272_s1` log "3 real call sites" | `src/lib/wild-review.ts` exists (5,712 B, 18:02) with `createNodeWildReviewer`; **0 call sites** — grep `WildReviewer\|opts.reviewer` in store.ts/headless.ts = only engine.ts type decls | **UNWIRED** | for F1 (store.ts:1105 + headless wild macros) / F2 land if F1 absent |
| A2 | T-107.7 checkpoint.server.ts | `272_s1` log "NEW" | **NOT ON DISK** (`ls` fails) | **ABSENT** | for F1 |
| A3 | `resume` CLI verb | U2 item | **NOT in CLI** (grep: only `wild --resume` action; 37 verbs) | **ABSENT** | for F1 |
| A4 | W-47 unattended command | U2 item | **NOT ON DISK** (`scripts/unattended-shell.mjs` fails); no `unattended` verb | **ABSENT** | for F1 |
| A5 | R13-f02 `readWildPlan` | U2 item | **NOT in engine.ts** (only the 2 doc-comments in types.ts:163/:429; `WildPlan` type + `Project.wildPlan` DO exist, types.ts:172/:433) | **ABSENT** | for F1 |
| A6 | U1 scaffold per-kind (game vite.config; cli/library/service pkg fields) | U1 item | `vite.config.ts` push still `kind==="webapp"` only (scaffold.ts:2576); `kindHandoff` at :2195 (spread :2288) — partially present, verify depth | **PARTIAL** | for F1/F3 |
| A7 | U1 uiGeneration hook | U1 item | grep scaffold.ts `uiGeneration` = 0 hits | **ABSENT** | for F1/F3 |
| A8 | U1 codegen R3-f02 reword | U1 item | codegen.server.ts:503 still "Assign module.exports." (rule 2 CJS) | **ABSENT** | for F1/F3 |
| A9 | U1 run-eval expectedBehavior + verification label | U1 item | run-eval.mjs (16:00 mtime) — grep `expectedBehavior\|verification` = 0 product hits | **ABSENT** | for F1/F3 |
| A10 | U1 redTree/partial + capability.N skip | U1 item | `redTree` exists in run-eval envelope use (`{redTree:"banner"}` :1803) — check capScan `capability.N` skip-with-reason | **CHECK** | F2 audit |
| A11 | UI panes (plan/checkpoint/resume/unattended/stream/cassette/seat) | U3 | console.tsx: no wildPlan/checkpoint/unattended/cassette hits; seat + isolation refusal labels partially exist (S5-era :458/:573/:3954) | **ABSENT** | for F3 |
| A12 | `headless.test.ts` 3 reds (keyless parity · M4-2 driveP6Journey · E-25) | CF-3/WDX-1 | not yet re-run | **TBD** | F2 baseline leg + F3 fix |
| A13 | finalsprint §S1–§S5/§T1–§T5/§WDX-2/§WDX-3 appends + §MASTER-CORRECTIONS | U4 | only §WDX-1 live; marker line 244 intact | **ABSENT** | for F3 |
| A14 | §F2 append (this lane) | F2 duty | — | — | F2 |

## [t0] CROSS-WIRES — the seams needing a THIRD connector (both ends read)

| # | Wire | End A | End B | t0 verdict | Action |
|---|---|---|---|---|---|
| CW-1 | `resume` verb ← checkpoint reader ← engine writer | resume verb: ABSENT | writer: ABSENT (checkpoint.server.ts not on disk) | both ends missing | for F1; F2 re-verify |
| CW-2 | UI pane ← F1's accessor | console pane: ABSENT | accessor: ABSENT | both ends missing | for F1+F3; F2 land if unwired at close |
| CW-3 | `stream` flag ← provider `onToken?` | CLI `--stream`: ABSENT (grep 0); `chatStreamNdjson` lib leg EXISTS (chat.ts:410 + pins) | provider `onToken`: ABSENT (grep deepseek.ts/openai-compatible.ts = 0) | both ends missing | F2 assess + land or for F1/F3 |
| CW-4 | cassette wrapper point ← provider seam | `cassette.ts` module EXISTS (28,876 B); ZERO consumers (registry.ts grep clean); no run-eval `--record/--replay` | `callModel` seam exists (registry.ts:662) | connector missing | F2 assess + land or for F1/F3 |
| CW-5 | `wild.paused_policy` ← F4 consult | `wild.paused_policy` NOT registered (rt-events.ts grep: only step_paused/driver_paused_auto) | `wildApproveGate` (engine.ts:3668) consults NOTHING (no applyPolicyOverlay hits in engine.ts) | both ends missing | F2 assess + land or for F1/F3 |
| CW-6 | `getWildPlan` ← `store` ← console | store.ts: no WildPlan hits | console: no pane | both ends missing | for F1(accessor)+F3(pane); F2 wire store→console if both exist at close |

## Log (append-only)

- [t0 ~19:03] Log written EARLY (contract). Next: baseline legs (errors · wild-step · registry · run-eval · E-25 · honesty-guards · README-cli) → cross-wire end reads → land smallest honest wires.
