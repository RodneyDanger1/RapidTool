# fixes/310_b2_state.md — B2 lane log (B-01 hydrate · M4-05 cap park · M4-06 operator park · B-02 onEvent pair)

**Lane:** B2 (state completions). **Box:** `engine.ts` hydrateWildRun + `store.ts` park lifecycle + `headless.ts` wild state paths (its wildStep callers `:4008`/`:4195` + operator pause `:4228`; B1 owns the lock sites).
**Baseline:** HEAD `1af7f88`; suite green at entry. **Bugs only. No keyed calls.** Legs FOREGROUND.
**Sources:** `fixes/308_bugmap.md` (§6 FIX-A: B-01/B-02) · `fixes/308_map4_claims.md` (M4-05/M4-06) · A4 summary `subagent-summary-3-20260929_111227_595932.txt`.
**Siblings live (one writer per file, disjoint regions):** B1 (headless locks), B3 (`headless.ts` emit/save, errors.ts), B4 (`engine.ts` hydrate/import/normalizers outside hydrateWildRun + `headless.ts` serialize), B6 (rt-client/console/rail UI). B4's log explicitly defers hydrateWildRun to me.

## Status

- [ ] B-01 — `hydrateWildRun` preserve `park` + `lastStep` (merge not drop; save→load round-trip) + clear stale park on the session-break arm
- [ ] M4-05 — store 20-step cap stamps `{code:null, unlock:"operator"}` (uncoded park)
- [ ] M4-06 — `headless.wildPauseRun` wires `wildOperatorPark` (first customer; `{code:null, unlock:"resume"}`)
- [ ] B-02 — thread `opts.onEvent` through `wildStartHeadless` + `wildStartRun` into `wildStep`
- [ ] In-family completions (see Decision 3): store `toggleWildPause` park stamp/clear; CLI/store resume+stop park clears
- [ ] Pins + legs (typecheck 0; wild-step/store/headless/io foreground)

## Decisions (stamped EARLY, before edits)

1. **M4-05 unlock class — brief literal wins.** Brief says stamp `{code:null, unlock:"operator"}` for the cap ("per types.ts's own naming"; the class literal types.ts:147 reads *"operator: the run state itself looks wrong — inspect, repair, resume"* — the right instruction for a defensive loop cap). A4's one-liner proposed `unlock:"resume"` (what `wildOperatorPark` stamps). Landed the **brief's literal `"operator"`**; typed.ts's ParkUnlock union allows it. Flag: if the parent intended resume (A4 parity), it's a one-token change.
2. **B-02 headless sink — decision stamped.** `headless.ts` has **no in-file rt/log writer** (verified: no `onEvent`/`reportRt`/`runtime-log`/`logDir` refs). Parent's decision applied: thread `opts.onEvent` from the caller with a no-op default; **no fake sink** (no cwd-default NDJSON writes from headless — would split logs and pollute every test cwd). The **real sink for the CLI leg** is `cliLogEvent` (`scripts/rapidtool-cli.mjs:410` → NDJSON via `resolveLogDir(CLI_PROJECT)`; seed shape matches `wildStep`'s emits 1:1). The CLI hop is **outside my box** → follow-up stamped for its owner: in the `wild` verb (rapidtool-cli.mjs:~3385) pass `onEvent: (seed) => cliLogEvent(seed)` (with `await ensureRtAppender()` once at verb entry — `cliLogEvent` no-ops while `rtServer` is null).
3. **In-family completions landed (same bug family, same invariant).** Bugmap B-01's own FIX-A row names the **3 operator paths** (CLI pause + store cap + store toggle), and M4-06's done-when is *"CLI pause/operator toggle → non-null park with unlock:'resume'"*. So: `toggleWildPause` stamps `wildOperatorPark` on pause / clears on resume; and resume/stop in both `headless.ts` and `store.ts` clear a stale `park` — **required** because once hydrate preserves `park`, a resume that leaves `pause:false + park` would persist a stale park ("park present iff pause", types.ts:239). All one-liners except the toggle.
4. **M4-05 pin reality.** The 20-step cap needs 20 consecutive executed steps; keyless tests cannot grind past the linear 13-phase graph (`wildLeavePhase` advances `phase+1`; P12 finalizes; open gates pause keyless). Pin = the cap park composition (engine-level) + honest comment; branch reachability noted (keyed/grind only). Not faked.

(append-only; evidence filled as items land)
