# 31 — Functional / Major-Logic Bug Register (logic modules, read-only audit)

**Scope:** `src/lib/engine.ts` (wildStep + hard-DoD + hydrate), `src/lib/store.ts`
(wild actions, persist), `src/lib/dod.ts`, `src/lib/report-intake.ts`,
`src/lib/verify.ts`, `src/lib/crew.ts`, `src/lib/packet.ts`, `src/lib/io.ts`,
`src/lib/wild-mode.server.ts`, `src/lib/headless.ts` + repo-wide wiring grep.
**Method:** full reads of every file above; call-site greps; cross-checked
against `research/multiagent/23_debug_lead.md` + `25_debug_wildmode.md` (their
flagged items re-verified against the CURRENT code — the store wild actions have
since landed). **No files were modified.**

Legend: **P0** = corrupts state or fabricates graph truth in reachable flows ·
**P1** = functional bug / honesty contract broken / feature half-wired ·
**P2** = parity gap / bookkeeping / defensive gap.

---

## P0 — none confirmed in current code

The 23_debug_lead P0s were re-verified and are **FIXED** in the current tree:
- Store wild actions implemented (`store.ts:520-571`), TS2739 gone.
- `parseWildReview` requires the `FEEDBACK:` marker (`wild-mode.server.ts:121-124`
  `if (!feedbackMatch) return null;`) — the bare-`VERDICT: approve` fabrication
  path is closed; engine-side 12-char floor still present (`engine.ts:2103-2108`).
- forceHuman gates can never be machine-approved: checked before the reviewer in
  `wildApproveGate` (`engine.ts:2152-2161`) and `approveHitl` throws on
  autopilot×forceHuman (`engine.ts:917-919`) — double guard, reachable-never.
- Persisted active wild runs ARE force-stopped on hydrate (`engine.ts:1315-1321`,
  wired `:1419`, loud `wild.stop` log `:1508-1518`); partialize persists whole
  projects so wild fields survive to be repaired (`store.ts:1096-1101`).

---

## P1

### 1.1 wildStep can execute + leave a phase whose priors are NOT sealed (guard-skip — debug-lead B3 still open)
**File:line:** `src/lib/engine.ts:2363-2386` (execute fall-through), and the
leave-advance at `:2270-2279`. Compare the sync guards: `store.ts:324-326`
(`runReady`: priorsSealed), `store.ts:306-307` + `headless.ts:411-414`
(`canEnter` + `priorsSealed` before any advance).
**Evidence:** wildStep's execute path calls `applyPhaseResult` with NO
`priorsSealed`/`canEnter`/ready check, and `wildLeavePhase` advances
`currentPhase: phase+1` unconditionally. The invariant "cursor edge ⇒ priors
sealed" holds only for honest flows; hydrate explicitly tolerates the broken
shape: `hydrateProject` repairs a LOCKED edge record by deriving
`highest complete + 1` and promoting it to ready **only when priors are sealed**
(`engine.ts:1356-1372`) — but a payload whose edge record is *ready* while an
earlier phase record is `locked` (dropped record re-inserted by `repairPhases`
`engine.ts:1181-1186`, or a hand-edited/legacy import that passes io.ts shape
checks) is left exactly as-is. In that state the sync store refuses to run
(priorsSealed), but wildStep executes the unsealed edge, and after it completes,
`wildLeavePhase` advances past the never-sealed phase — the "illegal graph jump"
the packet forbids — with no gate ever recorded for the skipped phase.
**Fix spec:** (a) at the top of the wildStep execute fall-through (before
`:2363`), mirror `runReady`:
`if (!priorsSealed(project.phases, phase)) → wildPause(...event "wild.error", detail "priors not sealed — cannot enter P${phase}")` and return
`{outcome:"paused", ran:true}`. (b) In `wildLeavePhase`, before building
`advanced` at `:2270`, add `canEnter(phase, nextPhase)` and
`priorsSealed(next.phases, nextPhase)` checks; on failure
`wildPause(next, phase, "error", "wild.error", ...)` (imports `canEnter`/
`priorsSealed` from `./phases.ts` already present at `engine.ts:1`).

### 1.2 wild-executed phases: DoD gate recorded AFTER packet compile, and never re-stamped — stale/absent `gate_passed`; P12 gate never recorded at all
**File:line:** `src/lib/engine.ts:2375-2386`, `:2270-2279`, `:2283-2296`;
packet consumer `src/lib/packet.ts:102-107` (`gate_passed` read from
`PhaseRecord.gate`).
**Evidence:** `applyPhaseResult` compiles the packet at `:866-867` BEFORE
`recordGateInto(done, phase)` runs at `:2385`; `wildLeavePhase`'s advance
(`:2270-2279`) and `wildFinalize` (`:2283-2296`) never recompile
(`sealPacketArtifact(attachAlgorithms(...))` / `stampPacket`). So every project
snapshot returned by a wild execute/advance step carries a packet whose
`## System JSON` shows `gate_passed: null` for the phase just completed — the
ST-1 parity the sync path deliberately preserves (`store.ts:377` re-stamps AFTER
recordGate; `approveHitl` pre-compiles with `recordGateInline`, `engine.ts:988-989`).
Worse, the P12 branch returns `wildFinalize(done, phase)` at `:2380-2382`
BEFORE the `recordGateInto` at `:2385`, and the `rec.status==="complete"` +
`phase===12` branch at `:2345-2346` skips it too → **a wild-run completion never
records the P12 DoD verdict** (no `PhaseRecord.gate`, no gate artifact, no
`gate.verdict` log), and the terminal packet — never recompiled after
finalize — permanently claims `gate_passed: null` for P12. Sync runs record P12
(`store.ts:356`).
**Fix spec:** in wildStep's execute path order: `applyPhaseResult` →
`recordGateInto` → `stampPacket` (i.e. move `:2385` ahead of the `phase === 12`
branch at `:2380`, then run `wildFinalize`/`wildLeavePhase` on the stamped
project). Optionally recompile once inside `wildFinalize` for belt-and-braces.
Regression test: wildStep a project to P12 completion, assert
`phases[12].gate !== null` and the packet's System JSON embeds `gate_passed`
for P12.

### 1.3 `convergeRealRun` is dead code — a real P6 module run never converges the recorded DoD gate; a failing real run leaves a PASSING recorded verdict
**File:line:** `src/lib/store.ts:208-215` (definition, exported, **zero call
sites** — repo grep) vs `runModuleReal` `:759-806` which appends artifact+log
and commits `base = out.project ?? project` (fresh `lastTest`) but never calls
`recordGate`/`convergeRealRun`/`stampPacket`.
**Evidence:** after P6 completes with a template PASS, a later failing real run
updates `lastTest` (G2 comment `:781-784` claims "gate state must reflect the
REAL run") but `PhaseRecord.gate` (`passed:true`, old `evidenceHash`), the
`gate` artifact and the packet's `gate_passed` all keep claiming PASS — the
live `runGate` probe (`dod.ts:126-133` reads `lastTest.ok`) disagrees with the
recorded verdict. `convergeRealRun` was built exactly to re-evaluate and is
never invoked.
**Fix spec:** in `runModuleReal`'s success branch, replace the manual
artifact/log append with `convergeRealRun(base, artifact, logEntry)`
(or call `recordGate(updated, 6)` + `stampPacket(updated)`), so a real exit
code flips the recorded gate + packet. Note the same convergence is missing in
the gate-approval flow after a `runP6Real` — approval re-records via
`recordGate(approved, ...)` at `store.ts:918`, which re-reads live `lastTest`,
so that path is correct.

### 1.4 `startWildRun` is a single-step driver that violates its own contract: no run loop, no `serialized()` chain, no active-run guard, no `wild.start` ledger entry
**File:line:** `src/lib/store.ts:526-555`; contract types `:39-41`; the ST-6
serialization comment `:105-115`; engine loop header `engine.ts:1978-2004`.
**Evidence:** the documented driver semantics (`WildRunResult` stop reasons
`paused | complete | cap`, and the F-1 spec in 25_debug_wildmode.md) describe a
bounded loop that runs until a natural stop. The implementation calls
`wildStep(started)` exactly ONCE and returns `stoppedReason: null` after any
single step — `"cap"` is unreachable and `ran` is always 0/1. It also: (a) does
not check `p.wildRun?.active` — two overlapping calls (double-click / a step
racing a future driver) both compute from the SAME pre-run snapshot and the
last commit wins, silently dropping one step (the exact ST-6 race
`executeAsync`/`runUntilHitlAsync` are protected against via `serialized()`,
`:671-698`, but `startWildRun` is not); (b) its commit at `:548` applies
`next` without `rebaseUserFields`, so operator edits (rename/notes) made while
the step was in flight are rolled back; (c) never appends the `wild.start`
ledger entry the engine header promises ("Every auto decision is appended to
the ledger (wild.* events)"); (d) restarting a paused run silently resets
`pause:false`/`startedAt` with no log.
**Fix spec:** wrap the body in `serialized(id, async () => {...})`; guard
`if (p.wildRun?.active) return { ok: true, ran: 0, stoppedReason: p.wildRun.pause ? "paused" : null }`
(or make start an explicit resume); loop `wildStep` bounded by
`maxRuns = (13 - currentPhase) * 2 + 2` (parity with `store.ts:618`), pausing
honestly with a `wild.paused_cap` entry on cap; append a `wild.start` info log
when the run begins; commit with `rebaseUserFields(next, live)`.

### 1.5 The Wild Mode autonomous loop is unreachable: `startWildRun`/`wildStep` have no production caller, and wild-mode has zero test coverage
**File:line:** `src/lib/store.ts:96,526-555`; repo grep: `startWildRun`,
`wildStep`, `WildRunResult` appear ONLY in `engine.ts`/`store.ts`/types —
nothing in `src/routes/*`, `src/components/*` (console.tsx only renders state
and wires enable/toggle/pause/resume/stop via its defensive name lists,
`console.tsx:325-373`), `headless.ts` (export list contains no wild surface),
CLI, or any `*.test.ts`.
**Evidence:** enabling Wild Mode in the UI produces `wildRun` state but no
control ever calls the engine loop; the "unattended auto-run loop" (B7/P13)
cannot start from any surface. Engine/store wild code is also untested
(zero `wildStep`/`wildRun`/`wildMode` matches in `src/lib/*.test.ts`).
**Fix spec:** wire one driver: (a) console Run button when `wildMode` is on →
`startWildRun` (with a streaming poll of the returned project), and/or
(b) headless additive export `wildRunOnce(project, opts?)` → loop `wildStep`
with cap (per 23_debug_lead C1/F-1); then add the minimal test set:
classifier parser floor, `wildStep` noop/paused/completed paths,
`hydrateWildRun` force-stop, `hardDodBlockInto` no-dup artifact, full DoD-floor
advance with stubbed reviewer.

---

## P2

### 2.1 wildStep returns `noop` forever when the project completes outside wildStep — `wildRun.active` stays true in-session
**File:line:** `src/lib/engine.ts:2325-2327`.
**Evidence:** if the project reaches `complete` via another surface (sync
`runUntilHitl`/`approve` while a run is active), every later `wildStep` returns
`{outcome:"noop"}` without finalizing — the run is only force-stopped on the
NEXT reload by `hydrateWildRun`. In-session, the console chip reads RUNNING on
a complete project (25_debug_wildmode flagged the same; still open).
**Fix spec:** at `:2325`, when `project.status === "complete" && project.wildRun.active`,
run `wildFinalize(project, phase)` semantics (set `active:false`, `pause:false`,
`stoppedAt`, `wild.complete` log) and return `{outcome:"completed", ran:true}`
instead of noop.

### 2.2 `setWildMode(id, false)` destroys the run object without stop bookkeeping
**File:line:** `src/lib/store.ts:520-525`.
**Evidence:** toggling Wild Mode off mid-run sets `wildRun: null` — no
`stoppedAt`, no `wild.stop` ledger entry — while `stopWildRun` (`:556-563`)
stamps both. The console's enable pill can therefore kill a paused/active run
invisibly (the ledger never shows why the run ended), and toggling back on
loses `lastAutoLog` history.
**Fix spec:** in `setWildMode`, when turning OFF and `p.wildRun?.active`,
delegate to stop semantics (stamp `stoppedAt`, `pause:false`, append
`wild.stop` log "Wild mode disabled") instead of nulling; null only inactive
stale runs.

### 2.3 `stopWildRun` leaves no ledger entry (and no `wildRun.phase` note)
**File:line:** `src/lib/store.ts:556-563`.
**Evidence:** engine pauses always write a `wild.*` ledger row
(`wildPause`, `engine.ts:2043-2052`); the store's stop is a bare field patch.
An operator stop is invisible in the append-only trail that the packet/console
present as the run's history.
**Fix spec:** append a `wild.stop` info log (phase `p.currentPhase`) inside the
updater, plus keep `lastAutoLog` = "Wild run stopped by operator".

### 2.4 `clone()` duplicates an ACTIVE wild run; import force-stops one — inconsistent
**File:line:** `src/lib/store.ts:1003-1031` vs `io.ts:84-86` (import hydrates).
**Evidence:** `clone` copies `wildRun` verbatim (`active:true`, same
`startedAt`) and inserts the copy without `hydrateProject` — two projects then
claim one live run session; only a later reload force-stops the clone. Import
of the same JSON would stop it at the boundary.
**Fix spec:** in `clone`, when `copy.wildRun?.active`, either null it or stamp
`{active:false, pause:false, stoppedAt: Date.now()}` + a `project.cloned` note,
before insertion.

### 2.5 Machine-verify promotion (E-06/E-07) is unwired: `p6-verified` is unreachable in real flows, and dod.ts cites a promotion branch runP6Real never had
**File:line:** `src/lib/headless.ts:942-949` (`verifyGeneratedSource`),
`:961-1015` (`applyVerifyOutcome`) — **no production callers** (tests only);
`src/lib/dod.ts:147-149` + `:153-170` (p6-verified probe); `src/lib/engine.ts:1962-1967`
(`runP6Real`).
**Evidence:** `applyVerifyOutcome` (the only code that mints
`lastTest.label:"tested"` + `evidenceHash`) is referenced only from
`headless.test.ts`; `verifyGeneratedSource` likewise. dod.ts's comment claims
the label is minted by "engine.runP6Real promotion branch / applyVerifyOutcome"
— but `runP6Real` sets `lastTest: { ok, detail }` with NO label
(`engine.ts:1967`), so the engine branch never promoted anything. Consequence:
the `p6-verified` DoD criterion can never pass in any reachable flow; a store
`runModuleReal` that succeeds also downgrades a previously-verified
`lastTest` (label wiped by the unlabeled replace at `store.ts:784`).
**Fix spec:** either wire the verify loop into a real surface (store
`runModuleReal` or the console verify button → `verifyAndFix` →
`applyVerifyOutcome` + `recordGate` convergence) or update the stale comment;
when wiring, have `runP6Real`'s success branch preserve/upgrade the label
(`label:"real-run"`, keep prior `"tested"` fields or re-verify) so a re-run
cannot strip earned machine-verified evidence.

### 2.6 E-19 regression-drift detection (`verifyPriorPhases`) is never called by the intake surfaces that own it
**File:line:** `src/lib/engine.ts:1892-1917` (def); documented callers per the
header comment `:1886-1890` ("callers (store/headless ingest) surface the drift
as a `regression.drift` warn log"); actual call sites: none
(`store.ingestReport` `store.ts:811-840` and `headless.ingest` `headless.ts:544`
never invoke it).
**Evidence:** file-scoped DoD drift detection is fully implemented and dead;
an agent report that touches a prior phase's files cannot invalidate the
recorded gate evidence as designed.
**Fix spec:** call `verifyPriorPhases(live, live.currentPhase, report.files)`
inside `store.ingestReport` (and `headless.ingest`) when the validated report
carries `files`, and append one `regression.drift` warn log per drifted phase
(advisory, no mutation of prior records).

### 2.7 headless CLI surface has NO hard-DoD enforcement (P10 parity gap)
**File:line:** `src/lib/headless.ts:342-419` (`finishPhase`/`advanceOnce` —
grep: zero `enforceDod`/`hardDodBlockInto`/`dodBlocked` occurrences in the
file) vs `store.ts:290-314, 351-392` and `engine.ts:2201-2214, 2256-2269`.
**Evidence:** with `enforceDod:true` (UI toggle), the store and wild paths
block leaving a phase whose gate fails (artifact + `dod.blocked` + honest
stop); the headless CLI advances straight past the same failing gate. Same
project, different governance, depending on surface.
**Fix spec:** port the two guards into `headless.finishPhase` (post-record,
pre-advance: `if (updated.enforceDod === true) { runGate; if (!pass)
hardDodBlockInto + stopped:true }`) and into `headless.advanceOnce`'s
complete-branch, mirroring `store.ts:294-304`.

### 2.8 io.ts import rejects repairable payloads before the repair pass can run
**File:line:** `src/lib/io.ts:67-69` vs `engine.ts:1152-1190` (`repairPhases`
exists precisely to re-insert dropped/missing phase records).
**Evidence:** `importProject` hard-requires `phases.length === 13` BEFORE
`hydrateProject`, so a truncated-but-fully-repairable export (the scenario
`repairPhases`'s insert loop handles for localStorage rehydration) is refused
at the boundary, and the file's own header promise ("shape-validates … then
repair") never applies to short arrays.
**Fix spec:** relax the check to `length > 0 && length <= 13` (validate
records individually via the existing hydrate repair) or, if strictness is
intentional, say so in the header and drop the "repair" claim for imports.

### 2.9 `startWildRun` commit can clobber concurrent operator edits (ST-6)
**File:line:** `src/lib/store.ts:544-551`.
**Evidence:** unlike every other async action (`:694`, `:748`, `:797` use
`rebaseUserFields(next, live)` inside the updater with a live lookup), the
startWildRun commit maps the id unconditionally to the step result. A rename
or notes edit landing between `set(started)` and the step's commit is rolled
back.
**Fix spec:** commit via the same live-lookup + `rebaseUserFields` pattern
(also covers deletion mid-flight).

---

## Checked — no bug found (for the audit trail)

- **Ledger honesty of pauses/reviews:** `wildPause` writes an entry on every
  pause cause; classifier reject logs review + `wild.reject`; approve logs
  `wild.approved`; DoD floor verdicts carry `source:"dod"`; feedback is logged
  verbatim ≥12 chars (`engine.ts:2100-2132, 2135-2137`). Only store-side
  start/stop lack entries (1.4/2.3).
- **hardDodBlockInto/hardDodMessage** (`dod.ts:434-487`): correct — block
  artifact replaces per-phase duplicates, `dod.blocked` log append-only,
  message machine-readable. No no-op path.
- **`hydrateWildRun` + partialize:** wild fields are persisted (whole-project
  partialize), active runs force-stopped with a loud log on every
  rehydration/import; re-stamp occurs on the stop path (`engine.ts:1520-1533`).
- **Report intake idempotency + injection guards:** fingerprint dedupe and
  title/file whitespace-collapse are sound (`report-intake.ts:118, 136, 205-238`);
  duplicate re-apply returns `applied:false` (store returns `ok:true` — by
  contract, retry-after-lost-ack).
- **verify.ts / crew.ts client contracts:** thin config-gated wrappers with
  honest `not-configured`/error fallbacks; no logic defects.
- **packet.ts round-trip:** escaping, truncation honesty, gate_passed envelope
  all consistent with their consumers; the only defect is the wild-path
  staleness of 1.2, not packet.ts itself.
- **Wild pause → resume on a rejected/blocked project** re-pauses honestly
  (no silent advance); classifier re-review on resume of a complete edge is
  the documented "human decides via resume" semantic.
