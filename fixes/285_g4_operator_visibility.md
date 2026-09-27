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

## [W40 K8 · 2026-09-27] THE OWED STATUS-TABLE ROWS — appended from the lane's delegation summary

**Why here:** G4 (W38) "landed zero code fixes — still in the trace phase when I ran out"; its STATUS TABLE stayed empty ("⚠️ No rows appended — the STATUS TABLE in that file is still empty"). The delegation summary (`~/AppData/Local/hermes/cache/delegation/subagent-summary-2-20260926_203820_900651.txt`) is the only persisted record — re-landed below verbatim. Byte-verified at lane time (tree `0f85c32` + W29–W38 era; **later waves may have landed some — re-verify before acting**). Appended by W40 K8 as the Z4 payout's G-map record.

### G4 · EDGE 1 — doctor/diagnose field truth
- `scripts/rapidtool-cli.mjs:3458-3562` (`diagnose`): `growth.bytes.projectFile`, `growth.rows.ledger/chatLog` all trace to real reads (`statSync` :3487, `p.decisions`/`p.chatLog` :3488-3489) ✓. `watchdog` (:3532-3538) is hardcoded all-null with an honest budget-sync comment — honest, not a fake read.
- **FIX CANDIDATE (fake-0 class):** `src/lib/rt-client.ts:693` hardcodes `projectFile: 0` and `logDirBytes: 0` on the UI path. A browser genuinely *cannot* measure these — the honest value is `null` + "not measured", not `0`. `console.tsx:4426-4429` calls `buildClientDiagnosis` with no `counts`, so `growth.counts` is `{}` despite `rt-client.ts:590` documenting it as "Growth counts from the store (artifacts/memory/decisions/projects)" — the producer is never wired.
- **FIX CANDIDATE (invisible field):** `doctor.ts:571-590` defines `DoctorSpend` and `factoryClaim` fills it (`:298 spend: doctorSpend(spend)`), but `DoctorStatus` (`headless.ts:3455-3479`) **has no `spend` key** and `doctorStatus` (`:3619-3653`) never copies it. So `doctor` can never surface measured token spend — the operator's one spend read is invisible. (Honest: absent, not forged.)

### G4 · EDGE 2 — run evidence + checkpoint visibility
- `run-in-progress.json`: producer/consumer fields match exactly — `run-eval.mjs:2432/2455-2468/2483-2489/2812-2819` vs `scorecard.ts:338-354` (`markerVersion…pid, meanOfNine, decision, resultsWritten, historyWritten`) ✓. Surfaced by `eval` (`rapidtool-cli.mjs:1401,1461-1488`) ✓.
- Checkpoint: **`resume`/`unattended` surface it** (`rapidtool-cli.mjs:706`, `:731-736` → `checkpoint:{path,savedAt,ageMs,resumedFrom}`) ✓, documented at `scripts/README-cli.md:853-866` ✓.
- **THE NAMED GAP CONFIRMED:** `doctor` / `diagnose` / `summary` do **not** surface the checkpoint's *existence* — an operator must `ls <dir>/.rapidtool/checkpoint.json` or attempt a resume to discover it. Smallest tiny fix: `diagnose` already resolves the project dir; add a `checkpoint: {present, path, savedAt}` field.

### G4 · EDGE 3 — envelope completeness
- `respond()` (`rapidtool-cli.mjs:130-148`) stamps `schema_version`+`cmd`+`exit_code` on every envelope ✓. `check` (:2148), `scan` (:2179) clean ✓.
- **FIX CANDIDATE (the JSON.stringify-drop class):** `rapidtool-cli.mjs:3417` (`deepen`) — `path: res.changed ? path : undefined`. On an unchanged no-op the key vanishes entirely from the envelope; a machine-reader cannot distinguish "no write" from "field absent". Fix: `path: res.changed ? path : null`.

### G4 · EDGE 4 — telemetry pane inputs
- `runtime-timeline-pane.tsx` renders only fields that exist on `rt-timeline.ts:50-73` `TimelineRow`, which maps 1:1 onto `rt-events.ts:59-92` `RtEvent` (`ts/level/scope/event/phase/code/message/capture/count`) ✓. No invented accessor.
- Honest empty/degraded states verified ✓: pane `:175-178` "honest silence", `rt-timeline.ts:135-153` `rawRow` keeps unparseable lines verbatim, `statusMeta` `:53-55` "still running" for unclosed spans.
- **UNRESOLVED:** the pane reads `rtSnapshot().tail` (`rt-client.ts:580` = `rtTail(r, RT_ERROR_TAIL)`) but its copy says "the ring rows above" — `RT_ERROR_TAIL` full-ring vs error-conditioned filter was not verified.

### G4 · EDGE 5 — START-HERE.md / README promises
**NOT STARTED.** No read, no read-only command runs.

### G4 · RECOMMENDED NEXT ACTIONS (all tiny — verbatim)
1. `rt-client.ts:693-694` → `null` + not-measured wording; wire `console.tsx:4426` `counts` or strike the `rt-client.ts:590` doc claim.
2. `headless.ts:3455-3479` + `:3644-3653` → add `spend` to `DoctorStatus` and copy `claim.spend`.
3. `rapidtool-cli.mjs:3417` → `: null` instead of `: undefined`.
4. Surface `checkpoint: {present, path, savedAt}` in the `diagnose` envelope.
5. Read `START-HERE.md`/`README.md`, run the read-only run-commands, spot-check claims.
6. Append the STATUS TABLE rows to `fixes/285_g4_operator_visibility.md` (currently skeleton-only). ← _done by this append_

### G4 · ISSUES ENCOUNTERED (verbatim)
- Two Bash calls were hard-blocked by the parser (long `sed -n "$(grep …)"` one-liners) — switched to `read_file`/short greps.
- **No technical blocker to the fixes** — every candidate above is a 1–3 line honest patch. Only the iteration budget stopped me.

_— appended by W40 K8, 2026-09-27 (markerless append at EOF; the lane's own sections above were not edited)._
