# fixes/272 — LANE S4 · FLOOR + GOVERNANCE SHELLS (W30 shell sprint)

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · **HEAD at start:** `0f85c32` + W29/W29b uncommitted edits · **Lane:** S4.
**Brief:** `wave_plans/W30/shell-sprint.md` §S4 · master table + §S4 in `finalsprint.md` · specs in `research/multiagent/thoroughanalysis.md` (§R11-f01/f08, §R6-f12, §R11-f04/C2-f02, §R13-f04).
**Rules honored:** shell contract only (compiles · wired-or-honest-coded-refusal · `TODO(<row-id>)` at the exact gap · no fake behavior · additive only · targeted checks, NO full gates, NO keyed calls). Keyless machine.

## Items + status (filled as work lands)

| Row | P | What | Status |
|---|---|---|---|
| R11-f01 | P1 | dev-server bind: loopback default + `RAPIDTOOL_BIND_ALL=1` opt-in + doc line | IN PROGRESS |
| R11-f08 | P2 | `--force` quarantine-move seam (`.rapidtool-quarantine/<ts>/` + list) | IN PROGRESS |
| R6-f12 | P2 | pane boundary + `ui.pane_crash` (HomeScreen **+ RunScreen**) | IN PROGRESS |
| seat | P1 | console/server-fn hook shape calling the two-channel pattern (no invented store action) | IN PROGRESS |
| R13-f04 | P1 | isolation refusal seam + exact host requirement (never a fake sandbox) | IN PROGRESS |

## LANDING LOG (append-only)

### [1] R11-f01 — `vite.config.ts` host handling
- `vite.config.ts`: `server.host` = `process.env.RAPIDTOOL_BIND_ALL === "1" ? "0.0.0.0" : "127.0.0.1"` + the R11-f01 doc comment (names the deliberate panel/iframe exception).
- `package.json` `dev` script: the hard-coded `--host 0.0.0.0` REMOVED (it overrode the config and would have made the fix dead code); `--port 8080` + `strictPort` stay byte-identical. Opt-in restores the old bind: `RAPIDTOOL_BIND_ALL=1 npm run dev`.
- Doc line: `AGENTS.md` §Reality check updated (declare-or-strike: the old "binds 0.0.0.0:8080 / do not change" sentence is now false).
- Verification: node import of the built config fn under both env values (below).

### [2] R11-f08 — quarantine-move seam
- NEW `src/lib/quarantine.ts` (`QUARANTINE_DIR_NAME = ".rapidtool-quarantine"`, `quarantineFiles()`) — the real move implemented (mkdir + rename, copy+unlink fallback, deterministic `ts` injectable, failures never silent).
- `scripts/rapidtool-cli.mjs` emit arm: after an ok emit with `res.survivors`, the survivors are MOVED to `<dir>/.rapidtool-quarantine/<ts>/` and reported on the envelope (`quarantined`, `quarantineDir`); a failed move flips `ok:false` + `RT_E_FOREIGN_FILES`.
- `src/lib/headless.ts` `EMIT_SKIP_DIRS` += `.rapidtool-quarantine` (1 line) so a repeat emit never re-judges the quarantine as foreign.
- **FOR R11/E1b (window note):** the full fix belongs INSIDE `emitProject` (`headless.ts:1675-1682` refusal / `:1722` in-place `survivors`) so every forced caller quarantines, not just the CLI. TODO(R11-f08) marks it there-adjacent (module + CLI). 'headless.ts is E1b's window; the CLI-side seam is the safe placement this wave.'
- `scripts/README-cli.md` emit docs updated (declare-or-strike: `--force` no longer "keeps" in place).

### [3] R6-f12 — pane boundary + `ui.pane_crash`
- `src/components/console.tsx`: Lane U already landed the `PaneBoundary` class (:1633-1682) + the HomeScreen wrap (:1736-1837); S4 verified it emits `ui.pane_crash` via `reportRt` with componentStack + pane ctx.
- S4 added: the RunScreen wrap + the `markBoundaryError` dedupe seam (rt-client's dev re-bubble guard → exactly ONE row). 'console.tsx is Lane U's file — if a concurrent U write clobbers the two S4 hunks, re-apply: import `markBoundaryError`; `if (!markBoundaryError(error)) return;` inside `componentDidCatch`; `<PaneBoundary label="Run screen">…</PaneBoundary>` around RunScreen's body.'

### [4] seat — console/server-fn two-channel shape
- NEW `src/lib/seat.server.ts` (server: Channel A = `process.env.RT_HUMAN_SEAT_TOKEN`; Channel B = the human's typed re-entry arriving in the request body; verdict from the pure `evaluatePolicy("hitl.approve", "gate:P<n>", …)`) + `src/lib/seat.ts` (client-callable `createServerFn` wrapper + plain async `requestSeatApproval`, fixtures.review.ts pattern).
- NEW code `RT_E_HUMAN_SEAT_UNAVAILABLE` (errors.ts registry + doc): a seat-verified request from a surface that cannot deliver the decision refuses loudly — the console delivery (store/engine wiring) is `TODO(seat)`; **no store action was invented**.
- FOR U / next wave: console wiring = `import { requestSeatApproval } from "@/lib/seat.ts"` at the approve control (prompt for the token → call → render the coded refusal).

### [5] R13-f04 — isolation refusal seam
- NEW `src/lib/isolation.server.ts`: `ISOLATION_REQUIREMENT` (the exact host requirement) + `probeIsolator()` returning the coded `RT_E_ISOLATION_UNAVAILABLE` refusal with a live, cheap, non-throwing docker/bwrap presence check; the executor swap (T-107.8) marked `TODO(R13-f04)`. NEVER a fake sandbox (`kind:"none"`, `sandbox:false` bytes).
- NEW code `RT_E_ISOLATION_UNAVAILABLE` (errors.ts registry + doc).
- Wired: `scripts/rapidtool-cli.mjs` `doctor` arm carries `isolationProbe` (additive key; guarded, never breaks doctor).
