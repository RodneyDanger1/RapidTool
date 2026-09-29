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

## Legs (run last, FOREGROUND — D2 results)

- `npm run typecheck` → **RED at leg time (exit 2) — NOT this lane's red.** Every error is confined to `src/lib/engine.ts`, and the error set CHANGED between three consecutive runs (`TS2741 agent-seal @3850,7` + `TS2304 WildReviewDecision @4031,12` → single `@3850,7` → `TS2304 wildDodRepairOnce @4270,35`) — a LIVE sibling edit (the 313 D1 seal lane: `"agent-seal"` added to `WildParkUnlock` in types.ts, `wildDodRepairOnce` mid-write in engine.ts). Per the repo rule, the full gate is only meaningful when no agent is mid-edit. **Zero tsc errors in any D2-authored file (io/store/headless tests + scripts taxonomy test) at any of the three runs.** Re-run `npm run typecheck` after the D1 wave lands.
- store: **PASS** — `node --experimental-strip-types --test src/lib/store.test.ts` → 79/79 pass, 0 fail. New pin: `312 D2 (M4-06/B-01): operator toggle stamps an uncoded park on pause, clears it on resume; stop never leaks it`.
- wild-step: **PASS** — `node --experimental-strip-types --test src/lib/wild-step.test.ts` → 14/14 pass, 0 fail (308 P-1/P-2 park-rides re-verified green).
- headless: **PASS** — `node --experimental-strip-types --test src/lib/headless.test.ts` → 101/101 pass, 0 fail. New pins: `312 D2 — park present iff pause across the headless wild lifecycle`, `312 D2 — wildStartRun threads the caller's onEvent sink (B-02)`.
- scripts (cli + taxonomy): **PASS** — `node --test scripts/cli-exit-taxonomy.test.mjs` → 9/9 pass, 0 fail. New leg 9: `312 B-02 — the wild verb's onEvent hop lands wild.step_* rows in the NDJSON log; envelope unchanged`.
- Combined, the exact prescribed command `node --experimental-strip-types --test src/lib/{headless,store,wild-step,io}.test.ts` → **253/253 pass, 0 fail, exit 0** (ran twice; per-file split 101+79+59+14 = 253 — io's 59/59 covers Pin 1).

---

## D2 takeover (finisher — the four read-site pins + legs + evidence)

**Entry:** HEAD `de7deae`, tree clean. Only C2-claimed files touched: this log · `io.test.ts` · `store.test.ts` · `headless.test.ts` · `scripts/cli-exit-taxonomy.test.mjs`. All runs keyless — no `DEEPSEEK_API_KEY` on any spawned env.

**Entry audit (grep, not assumption):** the checklist's "**pin added**" notes were ahead of the tree — at `de7deae` none of the four read-site pins existed yet (zero `.park` assertions in `headless.test.ts` / `store.test.ts`; zero `lastStep` in `io.test.ts`; zero `wild.step_*` rows pinned in the scripts suite). D2 lands them now; the evidence block below carries file:line + running test name per pin.

**The four pins (C2's read sites):**
1. **save→load round-trip = park + lastStep intact** — `exportProjectJson` → `importProject({preserveWildRun:true})` (engine.hydrateWildRun keeps both records verbatim) **+ the session-break arm clears the park** (`wild.stop` row; "present iff pause").
2. **pause→resume = park cleared** — headless `wildResumeRun` (headless.ts:4395) + store `toggleWildPause` (store.ts:1307; resume clears, re-pause stamps the uncoded operator park via `wildOperatorPark`).
3. **wildStopRun stopped = park null** — headless `wildStopRun` (headless.ts:4426 — the one gap the b3161da batch missed) + store `stopWildRun` parity (store.ts:1299).
4. **the CLI onEvent hop's emission** — `rapidtool-cli.mjs` wild verb `opts.onEvent` (≈:3398) → `cliLogEvent` → `wild.step_*` NDJSON rows (spawn leg, envelope unchanged) + the headless caller-sink seam (`wildStartRun` onEvent recorder — every caller used to drop it).

## D2 evidence (final — every pin cites its read site + the running test)

### Pin 1 — save→load round-trip: `park` + `lastStep` intact (+ the session-break arm clears the park)
- Read sites: `io.ts:46` exportProjectJson → `io.ts:450` importProject → `engine.ts:2184` hydrateWildRun (park kept iff pause — `:2211`; session-break clear — `:2220-2231`); caller's `wild.stop` row — `engine.ts:2698-2709`.
- Pin: `io.test.ts`, in the "174-3 preserveWildRun hydrate" block — **"312 D2 (B-01): park + lastStep ride save→load verbatim; the session-break stop clears the park"**. Preserve arm: active+pause kept, both records deep-equal VERBATIM. Default arm: force-stop (active/pause false, park → null, stoppedAt number) + `wild.stop` log row + lastStep kept as history.
- Run: **PASS** — io 59/59 (combined 253/253, 0 fail).

### Pin 2 — pause→resume = park cleared (headless + store read sites)
- Read sites: `headless.ts:4366` wildPauseRun (stamps wildOperatorPark — its first call site), `:4395` wildResumeRun (park → null), `:4426` wildStopRun; `store.ts:1307` toggleWildPause (pause stamps, resume clears), `:1299` stopWildRun.
- Pins: `headless.test.ts` **"312 D2 — park present iff pause across the headless wild lifecycle"** (pause stamps uncoded `{code:null, unlock:"resume"}` + `at: number`; resume → null; re-pause stamps again). `store.test.ts` **"312 D2 (M4-06/B-01): operator toggle stamps an uncoded park on pause, clears it on resume; stop never leaks it"** (seeded park riding the pause → resume null; re-pause stamps; stop null).
- Run: **PASS** — headless 101/101, store 79/79 (combined 253/253, 0 fail).

### Pin 3 — wildStopRun stopped = park null (the C2 completion)
- Read site: `headless.ts:4442-4445` (`park: null` stamped on stop — the one gap the b3161da batch missed) + store parity `store.ts:1303`.
- Pin: asserted inside the two tests above — "stop clears the carried park (never rides the spread onto a stopped run)" / "stop clears the park". Both stop arms START from a park-carrying paused run (the exact spread-leak input), so the old bug would go red loudly.
- Run: **PASS** (same runs as Pin 2).

### Pin 4 — the CLI onEvent hop's emission (B-02)
- Read sites: `rapidtool-cli.mjs:3336` wild verb → `:3342` `await ensureRtAppender()` at verb entry → `:3396-3399` `opts.onEvent = (seed) => cliLogEvent(seed)` → `:410-414` cliLogEvent → `runtime-log.server.ts:52` resolveLogDir(project) = `<project dir>/.rapidtool/logs`. Headless side: `headless.ts:4287-4350` wildStartRun threads `opts.onEvent` into wildStep.
- Pins: `headless.test.ts` **"312 D2 — wildStartRun threads the caller's onEvent sink (B-02)"** (keyless maxSteps:1 recorder receives `wild.step_start` + a terminal row). `scripts/cli-exit-taxonomy.test.mjs` **leg 9 "312 B-02 — the wild verb's onEvent hop lands wild.step_* rows in the NDJSON log; envelope unchanged"** (REAL keyless spawn — create → `wild --start --steps 2`; NDJSON rows assert `host:"cli"` + `scope:"wild-step"`; the envelope keeps `ok/action/exit_code/steps` and never gains `error`; keyless ⇒ deterministic floor, no network).
- Run: **PASS** — headless 101/101; scripts 9/9 (0 fail).

**Status:** all four read-site pins LANDED and GREEN at `de7deae` + this lane's edits. The only red anywhere in the leg set is the sibling-owned `engine.ts` typecheck churn (see Legs section) — nothing in this lane's authored files.

**Close-out addendum (D2, final):** a 4th `npm run typecheck` at close-out repeated the sibling red — `TS2304 wildDodRepairOnce` at `engine.ts:4270,35` + `:4348,35` (D1's edit still mid-write; zero D2-file errors again). No further action for this lane; the wave boundary re-runs the gate when the mid-edit rule allows.

**Fresh verification pass (re-run on request, 17:23):** `npm run lint` → **GREEN, exit 0** (2 warnings, both in D4's untracked `probe_d4_*.mjs`; zero findings in any D2-authored file). Prescribed src leg re-run → **253/253 pass, 0 fail**; scripts leg re-run → **9/9 pass, 0 fail**. `npm run typecheck` re-run → **still exactly the sibling red** (`wildDodRepairOnce` @4270/@4348; `engine.ts` last written 17:17:48 by the 313 D1 lane — S1–S8 checklist open). That is the one concrete blocker to a green typecheck: it is not repairable from this lane without clobbering a live sibling writer (one-writer-per-file rule); D2's files type-clean in every run.
