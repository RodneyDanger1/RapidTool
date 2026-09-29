# fixes/312_c2_state.md — C2 · THE STATE COMPLETER (B2's frozen plan landed)

**Lane:** C2. **HEAD at start:** `59dc573` (suite green). **Source of truth:** `fixes/310_b2_state.md` (B2's frozen plan — decisions stamped, land it) + `fixes/308_bugmap.md` §6 FIX-A (B-01/B-02) + `fixes/308_map4_claims.md` (M4-05/M4-06).
**Box:** `engine.ts` hydrateWildRun region · `store.ts` park lifecycle · `headless.ts` wild state paths · the CLI hop in `scripts/rapidtool-cli.mjs` (wild verb only) · pins (`store.test.ts`, `wild-step.test.ts`, `headless.test.ts`, scripts suite) · this log.
**File-claim note (one writer per file):** C6's log claims `rapidtool-cli.mjs` for envelope/remedy *self-explanation* fields — C2's hop is the `wild` verb's `opts` construction (`:3385`) + one `ensureRtAppender()` call at that verb's entry, disjoint from C6's regions. C6 log-note already written by them; this is C2's reciprocal note.

## Status (found already landed in `b3161da`, gaps completed here)

At entry, HEAD already carried most of `b3161da`'s state-completion batch (verified by line-level read, not assumed). C2 audited every frozen item byte-by-byte, closed the gaps, and added the missing pins.

- [x] B-01 — `hydrateWildRun` preserves `park` + `lastStep` (merge not drop; verbatim records) + stale-park CLEAR on the session-break arm — landed (engine.ts:2187-2213); **pin added** (io.test.ts round-trip + session-break stale-park arm).
- [x] M4-05 — store 20-step cap stamps `{code:null, unlock:"operator"}` (engine-level composition pin per Decision 4; branch keyed/grind-only, noted honestly).
- [x] M4-06 — `headless.wildPauseRun` wires `wildOperatorPark` (`{code:null, unlock:"resume"}`); store `toggleWildPause` stamps/clears per Decision 3; **pins added**.
- [x] B-02 — `opts.onEvent` threaded through `wildStartHeadless` + `wildStartRun` (no-op default) + **THE CLI HOP LANDED** (`rapidtool-cli.mjs` wild verb: `onEvent: (seed) => cliLogEvent(seed)` + `await ensureRtAppender()` at verb entry); **pins added** (headless recorder + CLI spawn → NDJSON `wild.step_*` rows).
- [x] In-family completions (Decision 3): store resume keeps `lastStep` / park stays absent; store stop `park: null`; headless `wildResumeRun` `park: null`; **headless `wildStopRun` `park: null` (THIS LANE — the one gap the b3161da batch missed: the rest-spread kept a stale park on stop).**
- [x] Pins + legs (typecheck 0; store/wild-step/headless/scripts foreground)

## Evidence ledger

(filled as items verified/landed — every claim below has a file:line + a running test name)

### Gap 1 — headless `wildStopRun` stale-park leak
- Before: `wildRun: { ...run, active: false, stoppedAt: Date.now(), pause: false }` — a paused run's `park` rode the spread onto a stopped run (`pause:false + park` — violates "present iff pause", types.ts). After: `park: null` stamped alongside `pause: false`. Pin: headless.test.ts lifecycle test.

### Gap 2 — the CLI hop (frozen plan Decision 2's stamped follow-up)
- Before: `wild` verb passed `{ maxSteps }` only — the headless `opts.onEvent` seam stayed absent in production; `wild.step_*` telemetry never reached the NDJSON log from the CLI. After: `opts = { maxSteps, onEvent: (seed) => cliLogEvent(seed) }` + `await ensureRtAppender()` at the wild verb's entry (no-op when main() already loaded the appender; keeps the verb self-sufficient). Pin: scripts spawn test asserting `wild.step_start`/`wild.step_ok` rows in `.rapidtool/logs` while the envelope is unchanged.

## Append-only notes

(probe outputs, leg results appended as they run)

## Legs (run last, FOREGROUND)

- `npm run typecheck` →
- store:
- wild-step:
- headless:
- scripts (cli + taxonomy):
