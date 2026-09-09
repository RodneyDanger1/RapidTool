# 110 — PRO AUDITOR A: pipeline + agentic-AI usage surface (live fix specs)

- **File:** `fixes/110_pro_audit_pipeline.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`).
- **Role:** PRO AUDITOR A (pipeline + agentic-AI usage lane). **STRICT READ-ONLY on source** — no source file was or will be edited by this lane. The ONLY artifact is this file.
- **Date:** 2026-09-06. Mission: audit (1) engine.ts phase/gate flow incl. the liveLayer P6 seam + packet re-stamp convergence (verify earlier fixes landed), (2) headless.ts + scripts/rapidtool-cli.mjs verb envelopes/exit codes/diagnose/persistence, (3) agentic surface packet.ts/swarm.ts/crew.server.ts/wild-mode.server.ts, (4) io.ts import/export fidelity, (5) runtime-log wiring (CLI appender, store capture, watchdog).
- **Protocol for Flash executors:** POLL this file; every `## PA-XX` block is a COMPLETE self-contained patch spec. Apply as you read; the trailing `<!-- APPEND -->` marker moves when the next chunk lands. Re-grep anchors at patch time (line drift is expected same-day). Every block carries `Priority` and `Tag: functionality | performance`.
- **Verification marks:** `[V]` verified on disk this pass · `[L]` live-run this pass (real node execution, output quoted) · `[R]` reasoned from verified anchors. 0 false positives: items that are NOT bugs are listed in §N (negatives), not as findings.

---

## §0 — Verified-state truth table (built this pass)

| # | Claim | Anchor (current tree) | Mark |
|---|---|---|---|
| 1 | Packet re-stamp fix (P0-08 Hole A) landed: wildApproveGate re-stamps AFTER recordGateInto | engine.ts:2430-2433 | [V][L] — live wildStep run: envelope `gate_passed` P1/P2/P3 = true after leave |
| 2 | P0-08 Hole B landed: P12 terminal wild packet re-stamped with recorded gate | engine.ts:2705-2709 | [V][L] — live run to P12: `phases[12].gate={passed:true,…}` AND envelope `P12=true` |
| 3 | P0-09 (F1-F5) landed: applyVerifyOutcome converges P6 gate via recordGateInto + stampPacket, dedupes by evidenceHash, no-op while P6 incomplete | headless.ts:991-1062 | [V] + green headless.test.ts |
| 4 | store.advanceOnce autopilot path records gate after approveHitl (st-7) | store.ts:277-285 | [V] |
| 5 | store.finishPhase re-stamps AFTER gate verdict on both branches | store.ts:363-399 | [V] |
| 6 | store.approve records gate + re-stamps (ST-1) | store.ts:1186-1196 | [V] |
| 7 | runP6Real quiet-exit guard + convergeRealRun wired in store.runModuleReal | engine.ts:2138-2168, store.ts:1017-1062 | [V] |
| 8 | liveLayer P6 seam (keyed liveP6Synthesis, dynamic import, catch → floor) | engine.ts:1818-1844 | [V] |
| 9 | wildStep onEvent seam (CAP-5) exists and is purity-safe | engine.ts:2229-2232, 2538-2592, 2720-2732 | [V] + wild-step.test.ts:179 "project result is identical with and without the sink" |
| 10 | Runtime-log pure core complete: rt-events/rt-ring/watchdog/diagnose/runtime-log.server + client ring + crash snapshot | src/lib/rt-*.ts, runtime-log.server.ts | [V] + 296 pipeline tests green (wild-step, store, headless, io, packet, phases, gates, watchdog, diagnose, rt-ring, rt-events, rt-client, runtime-log.server) |
| 11 | Global capture + boundary report + hydrate/persist quota emit + CLI appender + diagnose verb + UI RuntimeLogPane exist | router.tsx:3,8 · error-component.tsx:51-68 · store.ts:633 · rapidtool-cli.mjs:1122-1182 · console.tsx:3252-3290 | [V] |
| 12 | store driver loop bounded at 20 steps, pauses carried, commits rebased | store.ts:723-813 | [V] |
| 13 | headless wild lifecycle verbs complete (start/pause/resume/stop/step) | headless.ts:1527-1807 | [V] |
| 14 | io.ts import/export round-trip + hydration parity | io.ts:34-111 | [L] — live round-trip: `ok:true, phases=13, packet preserved:true` |
| 15 | packet.ts budget-aware truncation preserves Required-output-schema; 14K cap enforced | packet.ts:14-21, 400-446 | [V] + packet.test.ts |
| 16 | Engine wildStep guard paths (blocked/locked/rejected/missing-record/priors) all pause with machine codes | engine.ts:2594-2691 | [V] |

## §1 — What is BROKEN (headline)

The 109 runtime-log **pure core is fully landed** (row 10), but its **host-glue capture network is mostly unwired**: the watchdog step-budget/pause-on-resolve layer has **zero callers**, the client heartbeat has no registered busy probe, the store driver passes no sink to wildStep, the client LLM deadline (the actual freeze root cause, G-8) was never implemented, and the CLI appender emits free-form event names with a wrong level for parked gates. Additionally the wild **pause→resume loop is broken by construction** in the UI driver. Findings PA-01…PA-13 below.

## PA-01 — Wild pause→resume is broken: paused runs can never resume; resume leaves a zombie "running" surface

**Priority: P0 · Tag: functionality · Evidence: [V] file:line + [R] call-path walk**

**The bug (two halves, one root cause — the driver loop dies on pause and nothing restarts it):**

1. `store.startWildRun` (store.ts:723-813) drives the loop and **returns** the moment a step parks the run (`if (cur.wildRun?.pause) return {ok:true, ran, stoppedReason:"paused"}` store.ts:788-791). The loop is gone.
2. The UI resume handler (console.tsx:776-795 `onPauseToggle`) only calls `wildSetPaused(projectId, false)` → `toggleWildPause` (store.ts:822-829) which flips `wildRun.pause` to `false` while `active` stays `true`. **No driver is restarted.**
3. Re-starting the driver is impossible: `startWildRun` refuses any project with `p.wildRun?.active` (store.ts:741-748 "A wild run is already active."). `wildMode` stays on, so the toggle path (console.tsx:542 `void wildStart(...)`) is only reachable on re-enable.
4. Result: after any pause (classifier error, human gate, DoD block, rejected phase, error pause) the strip computes `running = active===true && !paused` (console.tsx:612) → after "resume" it renders **RUNNING with nothing advancing** — a zombie run that stalls forever, and the WildConsole watchdog (console.tsx:748-760) will only then start emitting `wild.step_timeout` rows every 11s with no path to recovery except full stop→re-enable→start (which resets the run).

The CLI lifecycle verbs (headless.ts:1743-1784) have the same shape: `wildResumeRun` flips pause:false and the agent must call `wild` (step) again — workable there, but the `wild --resume` + repeated `wild` dance is undocumented in the USAGE line and the store path is fully dead.

**Patch spec (store is the choke point; console + tests follow):**

- `src/lib/store.ts` — replace the refusal at 741-748:
  ```ts
  if (p.wildRun?.active) {
    // PA-01: a PAUSED active run is a run whose driver exited — re-entering the
    // loop here is exactly the resume path (toggleWildPause cleared pause).
    if (p.wildRun.pause !== true) {
      return { ok:false, ran:0, stoppedReason:null,
               error: "A wild run is already active.", code: "RT_E_PHASE_ILLEGAL" };
    }
    // fall through: resumed run — re-stamp active surface, keep startedAt/lastAutoAt
  }
  ```
  and make the `started` block at 750-761 preserve a pre-existing paused run's `startedAt` (don't mint a new epoch — keep runRef stability for the telemetry correlation, rt-events runRef = String(wildRun.startedAt)):
  ```ts
  const started: Project = {
    ...p,
    wildRun: {
      active: true,
      phase: p.currentPhase,
      startedAt: p.wildRun?.startedAt ?? Date.now(),
      lastAutoLog: p.wildRun?.pause ? `Wild run resumed at P${p.currentPhase}` : `Wild run started at P${p.currentPhase}`,
      lastAutoAt: Date.now(),
      stoppedAt: null,
      pause: false,
    },
  };
  ```
  Also emit the driver rows this lane's PA-02/PA-08 add (see those blocks — the resumed run must get `wild.driver_resumed`).
- `src/components/console.tsx` — `onPauseToggle` (776-795): when the target is **resume** (paused→running), after `wildSetPaused(projectId, false)` succeeds, fire `wildStart(projectId)` instead of returning; keep the note "Wild run resumed." only when the start call returns ok (the start call now legitimately re-enters the loop for a paused run). The `wildSetPaused(false)` + start ordering matters: pause must be false before startWildRun's new guard reads it (or the guard above handles the still-paused case).
- `src/lib/headless.ts` — `wildResumeRun` (1761-1784): document + keep the flip (CLI contract stays step-based); no code change required, but add the `wild.driver_resumed` NDJSON row via the PA-08 sink if threaded.

**Regression tests (spec for the applier):**

| # | Test | Asserts |
|---|---|---|
| R1 | store.test: start a wild run with an injected reviewer that pauses on first step (existing pause fixtures) → driver returns `paused`; call `toggleWildPause(id)` (pause→false); call `startWildRun(id)` again → must return ok with `ran>0` and continue stepping, `wildRun.startedAt` unchanged, `wildRun.pause` false |
| R2 | store.test: double-start still refused — startWildRun on an ACTIVE UNPAUSED run returns ok:false RT_E_PHASE_ILLEGAL (existing behavior preserved) |
| R3 | store.test: resume after `stopWildRun` still refused correctly (active:false + pause:false → falls through to a FRESH start — assert fresh startedAt) |
| R4 | UI smoke (scripts/browser-smoke.mjs pattern): enable wild → auto-pause on the P4 human gate → click Resume → strip must show new `wild.*` feed rows (loop actually advanced), not a frozen RUNNING badge |

**Gates:** `npm run typecheck`; `node --experimental-strip-types --test src/lib/store.test.ts src/lib/wild-step.test.ts` green plus R1-R3; no byte change to any non-wild store test.

## PA-02 — 109 §5 watchdog (step budget, stall latch, pause-on-resolve) is dead code: no caller anywhere

**Priority: P0 · Tag: functionality · Evidence: [L] grep (zero hits outside watchdog.ts/watchdog.test.ts) + [V] store.ts:782-784, headless.ts:1720-1722**

**The bug:** `boundedStepWatch`, `watchdogDecision`, `shouldAutopause`, `requiresHumanResume`, `overdueRowSeed`, `timeoutRowSeed` (watchdog.ts:35-145) have **zero non-test callers**. The store driver awaits `wildStep(cur)` bare (store.ts:783) and the headless driver too (headless.ts:1721). Consequences, per the 109 design this wave implemented:
- No tier-1 `sys.step_overdue` / tier-2 `wild.step_timeout` rows from the drivers (the only timeout row today is the UI poll's post-hoc one, console.tsx:750).
- No stall latch set, no `shouldAutopause` check on resolve — a step that resolves at ≥2× budget **commits as normal and the loop keeps going** (109 §5.2/§5.5 contract: pause-on-resolve + never-auto-resume).
- `requiresHumanResume` semantics are unreachable; the freeze class the whole 109 wave exists for is only *observed*, never *contained*.

**Patch spec:**

- `src/lib/store.ts` `startWildRun` loop (782-799): wrap the step:
  ```ts
  const { boundedStepWatch, shouldAutopause, overdueRowSeed, timeoutRowSeed } = await import("./watchdog.ts");
  const { setStallLatch, clearStall } = await import("./rt-client.ts");
  ...
  const t0 = Date.now();
  const watched = await boundedStepWatch(
    () => wildStep(cur, { onEvent: sink }),   // sink per PA-08
    {
      budgetMs: WILD_STEP_BUDGET_MS,
      autopauseMs: WILD_STEP_AUTOPAUSE_MS,
      onOverdue: (el) => reportRt(overdueRowSeed("src/lib/store.ts:startWildRun", id, String(cur.wildRun?.startedAt ?? t0), el)),
      onTimeout: (el) => { reportRt(timeoutRowSeed("src/lib/store.ts:startWildRun", id, String(cur.wildRun?.startedAt ?? t0), el)); setStallLatch({ projectId: id, since: Date.now(), stepElapsedMs: Math.round(el), class: "step-timeout" }); },
    },
  );
  const res = watched.result;
  if (watched.elapsedMs >= WILD_STEP_AUTOPAUSE_MS && res.outcome !== "paused") {
    // pause-on-resolve: the late step's pause must win (109 §5.1.2)
    cur = wildPause(res.project, res.project.currentPhase, "error", "wild.timeout_autopause",
      `Wild step exceeded 2× budget (${Math.round(watched.elapsedMs)}ms) — auto-paused; resume is a human act.`);
    clearStall();
    commitWild(cur);
    return { ok: true, ran: ran + 1, stoppedReason: "paused", code: "RT_E_LLM_TIMEOUT" };
  }
  if (watched.elapsedMs < WILD_STEP_AUTOPAUSE_MS && peekStall()?.class === "step-timeout") clearStall();
  ```
  (lazy `await import` keeps store.ts pure in node:test — rt-client/window are already guarded; or use the injected-recorder pattern the store tests use. Keep the existing `cur = res.project; commitWild(cur)` order for the healthy path.)
- `src/lib/headless.ts` `wildStartRun` (1720-1727) and `wildStartHeadless` (1540-1547): same wrap via a shared local helper; headless rows go to the CLI NDJSON sink from PA-08 (`makeCliRow` + `appendRtLine`), stall latch is client-only (skip).
- Constants already exist in rt-events.ts (209-211) — import, don't re-declare.

**Regression tests:**

| # | Test | Asserts |
|---|---|---|
| W1 | store.test: injected reviewer that resolves after a real delay > injected budget (pass tiny budgetMs via a DI seam — expose `startWildRun`'s budget as an optional test-only param or read from an injected module-level override) → returns `stoppedReason:"paused"`, code RT_E_LLM_TIMEOUT, `wildRun.pause===true`, ledger has `wild.timeout_autopause`, project phases NOT advanced past the pre-step state beyond the step's own commit |
| W2 | store.test: healthy fast step (budget huge) → no latch, no autopause, loop continues (existing 20-step suites stay green) |
| W3 | watchdog.test: existing tier math stays green (already covered); add driver-level integration: boundedStepWatch fires onOverdue exactly once and onTimeout exactly once for a 2×-budget step |
| W4 | headless.test: wildStartRun with injected slow reviewer → envelope ok:true, outcome "paused", error mentions auto-pause, NDJSON (temp log dir) contains `wild.step_timeout` critical row |

**Gates:** typecheck; store.test/wild-step.test/headless.test/watchdog.test green; **no auto-resume ever** (assert resumed runs require the PA-01 path).

## PA-03 — Client heartbeat/stall telemetry never runs: `setBusyProbe` has no caller; poll watchdog never sets the latch

**Priority: P0 · Tag: functionality · Evidence: [L] grep (setBusyProbe: zero non-test callers) + [V] rt-client.ts:355-357, console.tsx:735-765**

**The bug:** rt-client.ts's heartbeat interval only ticks when `busyProbe` (rt-client.ts:84, 484-485) returns a busy run, and **nothing ever registers one**. So `sys.heartbeat`/`sys.heartbeat_lag`/`sys.mainthread_stall` rows, the `lastHeartbeat` sidecar, and the stall latch (§5.3/§5.4 — the crash-tail mechanism that was supposed to survive the freeze) are all inert in the live app. The only live stall detector is the WildConsole's own poll (console.tsx:735-765), and it: (a) only reports, never sets a latch / never pauses; (b) emits `sys.heartbeat` under **scope "wild-driver"** (console.tsx:742) which violates the §2.4 scope↔event catalogue mapping (`sys.heartbeat` → scope `sys`) and breaks machine consumers; (c) runs only while the WildConsole component is mounted (project-scoped), so a stall with the strip unmounted is invisible.

**Patch spec:**

- `src/components/console.tsx` — register the probe once at app-shell level (inside the top-level `HomeScreen`/`RunScreen` mount, console.tsx:1015/1140 region):
  ```ts
  useEffect(() => {
    setBusyProbe(() => {
      const s = useRapid.getState();
      for (const p of s.projects) {
        const r = p.wildRun;
        if (r && r.active) return { projectId: p.id, phase: r.phase, active: true, pause: r.pause === true, startedAt: r.startedAt, lastAutoAt: r.lastAutoAt };
      }
      return null;
    });
    return () => setBusyProbe(null);
  }, []);
  ```
  (import `setBusyProbe` from `@/lib/rt-client`; idempotent — one global probe.)
- `src/components/console.tsx:742` — fix the row: `scope: "sys"` (keep event `sys.heartbeat`); and after the stale-run branch at 749-760 ALSO `setStallLatch({projectId, since: Date.now(), stepElapsedMs: Math.round(Date.now()-run.lastAutoAt), class: "step-overdue"})` and `clearStall()` when the run recovers (new `lastAutoAt` advances). This makes the poll watchdog visible to `diagnose`'s watchdog section and to PA-02's pause-on-resolve check.
- Optional (spec'd, low-risk): move the poll watchdog's `hb` interval registration into the same shell effect so it survives panel switches (keep the existing per-project interval too — additive, coalescing dedupes).

**Regression tests:**

| # | Test | Asserts |
|---|---|---|
| H1 | rt-client.test (existing recorder pattern): register a busy probe via setBusyProbe, tick the heartbeat with injected timers → `sys.heartbeat` rows land, `lastHeartbeat` sidecar updated, lag > STALL_CRITICAL_MS produces `sys.mainthread_stall` + latch |
| H2 | catalogue pin (rt-events.test style): assert every emitted row's event is `isKnownRtEvent` and matches its scope — add a sweep over console.tsx's two reportRt sites (739-745, 750-759) with the corrected scope |
| H3 | UI smoke: with wild active, after 5s the runtime-log pane shows heartbeat rows; pause the run → heartbeats stop |

**Gates:** typecheck; rt-client.test/rt-events.test green; browser smoke green.

## PA-04 — CLI `respond()` emits free-form event names AND stamps normal parked gates (exit 2) as error-level telemetry

**Priority: P1 · Tag: functionality · Evidence: [L] live CLI run — `gate` parked at P4 HITL wrote NDJSON row `{"level":"error","scope":"cli-command","event":"cli.gate.exit","message":"exit 2","payload":{"exitCode":2}}`, which then appears in `diagnose`'s `errors[]` · [V] rapidtool-cli.mjs:122-135**

**The bug (reproduced):** `respond()` (rapidtool-cli.mjs:101-138) appends one row per command with:
- `event: \`cli.${CMD}.${exitCode === 0 ? "ok" : "exit"}\`` — a FREE-FORM event namespace (`cli.create.ok`, `cli.gate.exit`, `cli.diagnose.ok`, …). The §2.4 catalogue has exactly `cli.invocation` (scope cli-command) and `cli.error` (scope cli-log); `isKnownRtEvent` is false for every row the CLI writes, so any consumer filtering on catalogue names (the design's machine-grep contract, 109 §4.2/README-cli "Diagnostics") misses the entire CLI trail.
- `level: exitCode === 0 ? "info" : "error"` — exit 2 is the **documented normal parked state** (`gate` reached a HITL gate) and exit 3 is the honest not-configured answer; both are logged as `error`-level. Live proof: the smoke `gate` run parked at P4 and `diagnose` then listed `cli.gate.exit` in its **errors** array, feeding false error evidence into the `mostLikelyCause` ranking (llm-unavailable / runner-failing classes key off error rows).
- `message: "exit 2"` (or the error text) with no `cmd`/`durationMs`/`ok` payload — 109 §3.7 CAP-7 spec'd `cli.invocation` with `payload:{exit_code, durationMs, cmd, ok}`.

**Patch spec — `scripts/rapidtool-cli.mjs`:**

1. Replace the block at 122-132:
   ```js
   try {
     if (typeof cliLogEvent === "function") {
       const level = exitCode === 0 || exitCode === 2 || exitCode === 3 ? "info" : exitCode === 1 ? "warn" : "error";
       await cliLogEvent({
         level,
         scope: "cli-command",
         event: "cli.invocation",
         message: out.ok === false && typeof out.error === "string" ? out.error.slice(0, 200) : "ok",
         code: typeof out.code === "string" ? out.code : undefined,
         payload: { exitCode, cmd: CMD ?? undefined, ok: out.ok === true, durationMs: Date.now() - T0 },
       });
       if (exitCode === 4 && typeof out.error === "string") {
         await cliLogEvent({ level: "error", scope: "cli-log", event: "cli.error", message: out.error.slice(0, 200), code: typeof out.code === "string" ? out.code : undefined });
       }
     }
   } catch { /* never break the exit path */ }
   ```
2. Add `const T0 = Date.now();` at the top of `main()` (next to `CMD = cmd ?? null`, rapidtool-cli.mjs:262).
3. Leave the existing catalogue untouched (`cli.invocation`/`cli.error` already exist in rt-events.ts:181-182). Do NOT add `cli.<cmd>.*` names — the per-command dimension rides in `payload.cmd`.

**Regression tests (scripts/*.test.mjs style, node --test):**

| # | Test | Asserts |
|---|---|---|
| C1 | run `gate` on a fresh project until parked (exit 2) → last NDJSON row is `{event:"cli.invocation", level:"info", payload:{exitCode:2, cmd:"gate"}}`; NO error-level row for the park |
| C2 | run `crew` without a key (exit 3) → info-level `cli.invocation` with code RT_E_LLM_NOT_CONFIGURED; no error-level row |
| C3 | force an internal failure (bad --project path with a corrupt file → exit 1/4) → `cli.invocation` warn/error + one `cli.error` (scope cli-log) row when exit 4 |
| C4 | catalogue pin: every line in the produced NDJSON satisfies `isKnownRtEvent(row.event)` and scope matches `RT_EVENT_NAMES[event]` |

**Gates:** scripts tests green (`node --test "scripts/**/*.test.mjs"`); runtime-log.server.test.ts unchanged; manual: `diagnose` after a parked gate shows no `cli.*` row in `errors[]`.

## PA-05 — `executeAsync` returns ok:true on a hard-DoD block (sync `execute` returns ok:false — async parity break)

**Priority: P1 · Tag: functionality · Evidence: [V] store.ts:850 vs store.ts:935-946 + advanceOnceAsync dodBlocked branch store.ts:487-498**

**The bug:** sync `execute` refuses with `ok:false` when the advance is blocked by the P10 hard-DoD gate — condition `next.error && (next.project === project || next.gateDenied || next.dodBlocked)` (store.ts:850). The async mirror `executeAsync` checks only `next.project === project || next.gateDenied` (store.ts:935). When `advanceOnceAsync` returns a dodBlocked stop, `next.project` IS modified (`hardDodBlockInto` appended the "Hard DoD block" artifact + `dod.blocked` log, store.ts:491-494), so the condition is false and the block falls through to the commit + **`return { ok: true }`** (store.ts:955) — with the `error` text dropped. An agent caller sees success for a run the engine refused to advance. (`runUntilHitlAsync` handles dodBlocked correctly at 969-973 — only `executeAsync` has the gap.)

**Patch spec — `src/lib/store.ts` `executeAsync` (929-956):** mirror the sync condition exactly:

```ts
if (next.error && (next.project === project || next.gateDenied || next.dodBlocked)) {
  // E-20/P10 parity (see execute): persist the denial/block trail, still a 0-progress stop.
  if ((next.gateDenied || next.dodBlocked) && next.project !== project) {
    set((s) => {
      const live = byId(s.projects, id);
      if (!live) return s;
      return { projects: s.projects.map((p) => (p.id === id ? next.project : p)) };
    });
  }
  return { ok: false, error: next.error };
}
```

**Regression tests:**

| # | Test | Asserts |
|---|---|---|
| A1 | store.test async: project with `enforceDod:true` on a complete phase whose gate fails (existing dod fixtures from the sync tests) → `await executeAsync(id)` returns ok:false with the hard-DoD error text, AND the committed project carries the "Hard DoD block" artifact + `dod.blocked` log |
| A2 | store.test sync/async parity: the same fixture through `execute` and `executeAsync` returns the same `{ok, error}` shape (ok:false + same error string) |

**Gates:** typecheck; store.test green + A1/A2.

## PA-06 — `diagnose --project <file>` never reads the project: envelope project block is all-null

**Priority: P1 · Tag: functionality · Evidence: [L] live run — `diagnose --project /tmp/.../p.json` returned `"project": {"ref":"/tmp/...","name":null,"status":null,"currentPhase":null,"wildRun":null}` while the file was mid-run at P4 awaiting_hitl · [V] rapidtool-cli.mjs:1122-1182**

**The bug:** the implemented `diagnose` verb reads only the NDJSON tail (rapidtool-cli.mjs:1128-1130) and hard-codes a null project block (1135-1141). 109 §6.3 spec'd `headless.diagnoseProject(path)` reading the project file so the agent gets `project.name/status/currentPhase/wildRun` in one call. Today an agent must run `summary` separately — and the diagnose `wild-step-timeout` ranking rule (#1 in diagnose.ts:11-14) can never fire for a project-scoped diagnose because `project.wildRun` is always null.

**Patch spec:**

- `scripts/rapidtool-cli.mjs` `diagnose` case (1122-1182): when `CLI_PROJECT` is set, load the project RAW (never `loadProject` — that hydrates and would force-stop an active wildRun in the read snapshot; read JSON + extract scalars directly):
  ```js
  let projBlock = { ref: CLI_PROJECT, name: null, status: null, currentPhase: null, wildRun: null };
  let persistHealth = { ok: true, lastError: null };
  let projFileBytes = 0;
  if (CLI_PROJECT) {
    try {
      const raw = JSON.parse(fs.readFileSync(resolve(CLI_PROJECT), "utf8"));
      projFileBytes = Buffer.byteLength(JSON.stringify(raw), "utf8");
      if (raw && typeof raw === "object") {
        const wr = raw.wildRun;
        projBlock = {
          ref: CLI_PROJECT,
          name: typeof raw.name === "string" ? raw.name : null,
          status: typeof raw.status === "string" ? raw.status : null,
          currentPhase: typeof raw.currentPhase === "number" ? raw.currentPhase : null,
          wildRun: wr && typeof wr === "object"
            ? { active: wr.active === true, pause: wr.pause === true, phase: typeof wr.phase === "number" ? wr.phase : null,
                startedAt: typeof wr.startedAt === "number" ? wr.startedAt : null,
                lastAutoAt: typeof wr.lastAutoAt === "number" ? wr.lastAutoAt : null,
                lastAutoLog: typeof wr.lastAutoLog === "string" ? wr.lastAutoLog : null,
                stoppedAt: typeof wr.stoppedAt === "number" ? wr.stoppedAt : null, overdueMs: null }
            : null,
        };
      }
    } catch { /* keep the null block; diagnose still runs */ }
  }
  ```
  Pass `projBlock` as `project`, `persistHealth`, and `growth.bytes.projectFile = projFileBytes` into `buildDiagnosis`. Also read the project's ledger: `growth.rows.ledger = Array.isArray(raw.logs) ? raw.logs.length : 0` and append up to 30 ledger rows into `timeline` (kind "ledger", scope "engine-phase") per §6.1.
- `--all` flag (109 §6.3): accept and ignore-or-expand later; do NOT block this fix on it.

**Regression tests:**

| # | Test | Asserts |
|---|---|---|
| D1 | scripts test: `diagnose --project <temp build.json>` parked at P4 → envelope `project.name/status/currentPhase` match the file; `wildRun` null or mirrors the file's wildRun verbatim; `growth.bytes.projectFile > 0` |
| D2 | scripts test: `diagnose` (no --project) → project block stays all-null, exit 0 |
| D3 | scripts test: `diagnose --project <missing path>` → still exit 0 with ok:true and the null project block (diagnose must not fail on a bad path — it diagnoses the log dir) |

**Gates:** scripts tests green; diagnose.test.ts untouched.

## PA-07 — Boundary crash telemetry uses an off-catalogue event name and wrong scope

**Priority: P1 · Tag: functionality · Evidence: [V] error-component.tsx:56-64 (`event: "ui.boundary_crash"`, `scope: "ui-render"`) vs rt-events.ts:139 (`"boundary.crash": "boundary"`)**

**The bug:** the AppErrorComponent report seam (CAP-2) emits `ui.boundary_crash` under scope `ui-render`. The catalogue's only boundary event is `boundary.crash` with scope `boundary` (109 §2.4 + §3.2, which the seam itself cites). Consequences: `isKnownRtEvent("ui.boundary_crash") === false`; diagnose/UI consumers that filter or badge by catalogue names never classify boundary crashes; the event namespace now has two spellings of one fact.

**Patch spec — `src/lib/error-component.tsx:56-64`:** change `scope: "ui-render"` → `scope: "boundary"` and `event: "ui.boundary_crash"` → `event: "boundary.crash"`. Nothing else in the block changes (level critical, err passthrough, dedupe stay).

**Regression tests:**

| # | Test | Asserts |
|---|---|---|
| E1 | error-component test (existing render-with-recorder fixture, rt-client.test pattern): thrown Error → recorder captured exactly one row with `{scope:"boundary", event:"boundary.crash", level:"critical"}` and a non-null code |
| E2 | catalogue sweep: add a one-line assertion in the rt-events sync test that every literal event string in src/components + src/lib source (grep-driven list) is `isKnownRtEvent` — pins this bug class permanently |

**Gates:** typecheck; rt-events.test/rt-client.test green.

## PA-08 — Store + headless wild drivers never pass the CAP-5 `onEvent` sink: zero wild-step telemetry from real runs

**Priority: P1 · Tag: functionality · Evidence: [V] store.ts:783 `await wildStep(cur)` (no opts) · headless.ts:1541, 1721 (same) · engine seam exists engine.ts:2229-2232, 2538-2592**

**The bug:** the engine's purity-preserving `WildStepOptions.onEvent` seam (verified working — wild-step.test.ts "zero behavior change" + emission-sequence subtests) is never supplied by any production driver. Result: `wild.step_start/ok/paused/error` rows never reach the client ring (UI) nor the CLI NDJSON, so a post-incident `diagnose` timeline shows ledger rows only, and the §6.2 ranking rules that cite wild-step rows (`wild-step-timeout`, `wild-paused-error`) starve for evidence. The CLI's `wild` verbs write zero NDJSON rows beyond the single `cli.invocation` (PA-04).

**Patch spec (both drivers, additive):**

- `src/lib/store.ts` `startWildRun` — build a sink once before the loop and pass it to every `wildStep` call (plus the resumed path from PA-01):
  ```ts
  const sink = (seed: RtEventSeed): void => {
    try { reportRt({ ...seed, phase: seed.phase ?? cur.currentPhase, projectId: id, runRef: String(cur.wildRun?.startedAt ?? "") }); } catch { /* never break a step */ }
  };
  const res = await wildStep(cur, { onEvent: sink });   // PA-02 wraps this call
  ```
  (keep the lazy-import purity note from PA-02 if the store test runner is node-only; `reportRt` is already top-level imported at store.ts:22 and window-guarded.)
- `src/lib/headless.ts` — thread an optional CLI sink into `wildStartRun`/`wildStartHeadless` (new optional param `sink?: (seed: RtEventSeed) => void`, default no-op) and pass `{ onEvent: sink }` at 1541/1721. `scripts/rapidtool-cli.mjs` `wild` case (903-987): pass
  ```js
  const sink = (seed) => { try { cliLogEvent(seed); } catch { /* best effort */ } };
  ```
  into both `h.wildStartRun(project, { ...opts, sink })` and `h.wildStartHeadless(project, { ...opts, sink })` — `cliLogEvent` stamps the row with the CLI host/sessionId and appends NDJSON (rapidtool-cli.mjs:231-239). (The wildStep seeds carry `code`/`stack`/`payload`; makeCliRow sanitizes.)
- Driver rows (CAP-6): in store `startWildRun` emit `wild.driver_cap` at the cap branch (store.ts:799) and `wild.driver_error` in the catch (802-811); in `wildResumeRun`/UI resume emit `wild.driver_resumed` (catalogue entries already exist, rt-events.ts:155-160).

**Regression tests:**

| # | Test | Asserts |
|---|---|---|
| S1 | store.test with a recorder injected via a test seam (existing sink-recorder pattern from wild-step.test): a 3-step run emits ≥3 `wild.step_start` + matching `wild.step_ok` rows, all with `projectId`/`runRef` set |
| S2 | scripts test: `wild --start` on a temp keyless project (deterministic floor) → NDJSON contains `wild.step_start`/`wild.step_ok` rows with host "cli" |
| S3 | catalogue pin: every emitted event is in RT_EVENT_NAMES with matching scope |

**Gates:** typecheck; store.test/wild-step.test/headless.test green + S1-S3.

## PA-09 — CAP-10 client LLM deadline (the freeze root cause, G-8) was never implemented: no budget, no `llm.*` rows

**Priority: P1 · Tag: functionality · Evidence: [L] grep — llm.ts and chat.ts contain no reportRt / no Promise.race / no budget constant · [V] llm.ts:53-72, chat.ts:58-73 · 109 §3.10 (G-8: "No client-side LLM deadline")**

**The bug:** every wild-step classifier call awaits `complete()` (llm.ts:53-72) — a TanStack server-fn POST with **no client-side abort** — so a wedged server fn holds the awaited wildStep forever; this is exactly the freeze class the 109 wave was chartered on (109 §1.2/§5.1-1, G-8). The design's fix (Promise.race with a client budget + `llm.timeout` critical row + `llm.late_settle` warn on the abandoned promise) was never built: llm.ts/chat.ts are byte-identical to the pre-109 wrappers. The PA-02/PA-03 driver work detects the stall; this item gives the model call itself a deadline so a single wedged turn cannot hold the awaited step past 2× the server abort.

**Patch spec — `src/lib/llm.ts` `complete()` and `src/lib/chat.ts` `chatOnce()` (mirror both):**

```ts
const LLM_CLIENT_BUDGET_MS = 120_000; // above the server aborts (20s flash/60s pro); a client outliving this is a transport wedge
const pending = createServerFn(...)(...);          // existing call
let timer: ReturnType<typeof setTimeout> | undefined;
try {
  const res = await Promise.race([
    pending,
    new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("LLM client budget exceeded")), LLM_CLIENT_BUDGET_MS); }),
  ]);
  // existing ok path unchanged (usage/model passthrough)
  try { reportRt({ level: "info", scope: "llm-call", event: "llm.ok", message: "LLM completion ok", capture: "src/lib/llm.ts:complete", payload: { ms: Math.round(elapsed), model: res.model ?? null } }); } catch {}
  return res;
} catch (err) {
  const timedOut = err instanceof Error && /budget exceeded/.test(err.message);
  try {
    reportRt({ level: timedOut ? "critical" : "warn", scope: "llm-call",
               event: timedOut ? "llm.timeout" : "llm.transport_error",
               message: timedOut ? "LLM client budget exceeded — wedged server fn" : (err instanceof Error ? err.message : String(err)),
               capture: "src/lib/llm.ts:complete", code: timedOut ? "RT_E_LLM_TIMEOUT" : undefined, err: timedOut ? undefined : err });
  } catch {}
  if (timedOut) {
    void pending.then(() => { try { reportRt({ level: "warn", scope: "llm-call", event: "llm.late_settle", message: "A previously abandoned LLM call settled late", capture: "src/lib/llm.ts:complete" }); } catch {} }).catch(() => {});
    return { ok: false, reason: "error", error: "LLM client budget exceeded — retry or check connectivity", code: "RT_E_LLM_TIMEOUT" } as LlmResult;
  }
  // existing classify path unchanged
} finally { if (timer) clearTimeout(timer); }
```

Rules to preserve: envelope shape unchanged for non-timeout paths; `reportRt` imported lazily or top-level (llm.ts is client-safe — rt-client is window-guarded, same pattern as store.ts:22); chat.ts mirrors with `CHAT_STEP_BUDGET_MS` (60 000, rt-events.ts:213) and event `chat.send_error` on failure (catalogue exists, rt-events.ts:169).

**Regression tests:**

| # | Test | Asserts |
|---|---|---|
| L1 | llm.test with a never-settling stub + fake timers → complete() resolves within budget with `{ok:false, code:"RT_E_LLM_TIMEOUT"}`, recorder saw one `llm.timeout` critical row; the abandoned stub later resolves → `llm.late_settle` warn row lands exactly once |
| L2 | llm.test healthy stub → envelope byte-identical to pre-change behavior, one `llm.ok` info row |
| L3 | chat.test mirror: `chat.send_error` row on failure, budget honored |

**Gates:** typecheck; llm.test/chat.test green + L1-L3; no change to any engine/store test.

## PA-10 — CAP-3 store-action capture only 1 of ~6 sites: silent swallows remain invisible

**Priority: P2 · Tag: functionality · Evidence: [L] grep — reportRt hits in store.ts: only 633 · [V] silent catches at store.ts:425-427 (synthesizeAsync), 802-811 (startWildRun catch), 1138+1155 (refreshStatuses), 1259-1260 (rejectAsync guidance)**

**The bug:** the persist double-failure path emits (store.ts:633), but the spec'd CAP-3 catch sites emit nothing: a live LLM/research synthesis failure degrades silently (425-427), the wild driver's catch returns an envelope with no row (802-811 — note PA-08 adds `wild.driver_error` here), status probes swallow (1138/1155), guidance drops (1259-1260). An agent diagnosing "why was my phase deterministic today" gets no evidence row.

**Patch spec — `src/lib/store.ts`:** add `reportRt` at each catch (all already in a module that top-level imports it at :22; wrap in try/catch per site):
- 425-427 → `{ level:"warn", scope:"store-action", event:"store.action_error", message:"engine.runPhaseAsync unavailable/threw — deterministic fallback", capture:"src/lib/store.ts:426", code:"RT_E_INTERNAL", err }`
- 802-811 → `{ level:"error", scope:"wild-driver", event:"wild.driver_error", message:String(e), capture:"src/lib/store.ts:805", code:"RT_E_INTERNAL", err:e }` (PA-08 overlaps — implement once, together)
- 1138, 1155 → warn `store.action_error` with code `RT_E_LLM_NOT_CONFIGURED` / `RT_E_RESEARCH_UNAVAILABLE` respectively, capture anchors `src/lib/store.ts:1139` / `src/lib/store.ts:1156`, err passthrough
- 1259-1260 → info `store.action_error` "rejection guidance unavailable" only when llmStatus said configured, capture `src/lib/store.ts:1260`

**Regression tests:** store.test recorder fixtures asserting one row per induced failure class (mirror the quota-fail test's storage-swap pattern, store.ts:547-553). **Gates:** typecheck; store.test green.

## PA-11 — CLI `wild` (step) rewrites the project file on noop: `res.changed ?? true` breaks the documented idempotency

**Priority: P2 · Tag: functionality · Evidence: [V] rapidtool-cli.mjs:960 `const changed = res.changed ?? true;` + headless.ts:1551 wildStartHeadless returns NO `changed` field**

**The bug:** `wildStartHeadless` (headless.ts:1527-1552) returns `{ok, project, outcome, steps, error?}` — no `changed`. The CLI's `changed ?? true` therefore always saves for the bare `wild` step action, even when `outcome:"noop"` (paused/stopped run) or when the step produced zero mutation — contradicting the case comment (rapidtool-cli.mjs:908-910 "idempotent no-op controls never rewrite the file") and churning mtime for agent loops that poll-step a parked run.

**Patch spec — `scripts/rapidtool-cli.mjs:959-961`:**
```js
const changed = typeof res.changed === "boolean" ? res.changed : res.outcome !== "noop" && res.steps > 0;
```
(For the lifecycle actions `res.changed` already exists; this only fixes the step action's default.) Optionally also have wildStartHeadless return `changed: steps > 0` for symmetry.

**Regression tests:** scripts test — step a paused run twice; second call must not rewrite the file (compare mtime/content before/after). **Gates:** scripts tests green.

## PA-12 — `run`/`gate` with outcome "error" exits 0 / ok:true and hides the outcome field

**Priority: P2 · Tag: functionality · Evidence: [V] rapidtool-cli.mjs:309-333 (envelope has no `outcome`; exit only parks at 2) + headless.ts:474-486 (outcome "error" exists and is dropped by the CLI)**

**The bug:** `runUntilGate` classifies non-parked stops with error events as `outcome:"error"` (headless.ts:481-486) — e.g. a locked phase or illegal transition — but the CLI envelope omits `outcome`, so an agent cannot branch on it, and exit 0 with ok:true is returned for an invocation that made no legal progress and carries an error in `events[]`. The agentic contract (branch on exit code / machine fields) is violated for the error class.

**Patch spec — `scripts/rapidtool-cli.mjs` `run`/`gate` case (309-333):** add `outcome: res.outcome` to the envelope and extend the exit computation:
```js
const parked = res.project.status === "awaiting_hitl" || res.project.status === "blocked";
const exitCode = parked ? 2 : res.outcome === "error" ? 1 : 0;
```
(exit 1 = state/validation class per the E-25 taxonomy — an illegal-transition stop is a state error, not an internal crash; keep 4 for the outer catch).

**Regression tests:** scripts test — craft a project with a locked current edge (hand-edit phases in the temp JSON) → `run --project` exits 1, envelope `ok:false`… note: the current code returns ok:true for these; the fix must decide ok: `{ok:false, error: events[0], outcome}` when outcome==="error" and steps===0 (0-progress error stop), `{ok:true, outcome:"error", …}` when partial progress occurred (B-13 parity: progressed runs stay ok:true) — spec both cases in the test table. **Gates:** scripts tests green; runUntilGate unit tests untouched.

## PA-13 — `readRtTail` slices a UTF-8 string at a byte offset: up to one row silently lost at the 256 KB tail boundary

**Priority: P3 · Tag: functionality (edge) · Evidence: [V] runtime-log.server.ts:137-141**

**The bug:** `const start = Math.max(0, stats.size - 256 * 1024); readFileSync(file,{encoding:"utf8"}).slice(start)` slices at a BYTE offset computed from `statSync().size` but applied to a decoded UTF-8 STRING. On any log > 256 KB, if the byte boundary falls inside a multi-byte character the first decoded char is a replacement char → that line fails `JSON.parse` → skipped (the skip mechanism hides it). Effect: the oldest row inside the window is dropped silently on non-ASCII logs; the count cap `n` then returns n-1 rows with no marker.

**Patch spec — `src/lib/runtime-log.server.ts:137-141`:** read bytes and align the window to a line boundary before decoding:
```ts
const buf = readFileSync(file);
const from = buf.length <= 256 * 1024 ? 0 : Math.max(0, buf.indexOf(0x0a, buf.length - 256 * 1024) + 1);
const text = buf.subarray(from).toString("utf8");
```
(same for-loop over `text.split("\n")` below — unchanged).

**Regression tests:** runtime-log.server.test — write a 300 KB log whose byte-boundary row contains multibyte chars (e.g. "ハンドオフ") and assert `readRtTail` returns the full expected row set (no silent loss). **Gates:** runtime-log.server.test green.

---

## §N — Verified NOT bugs (0 false positives — these were checked and are fine)

1. **K1-K4 packet re-stamp convergence: LANDED.** Live probe (this pass): wildStep to P4 with a fake approving reviewer → envelope `gate_passed` P1=true P2=true P3=true after each leave; full run to P12 → `phases[12].gate={passed:true,evidenceHash:…}` AND envelope `P12=true`. Code anchors engine.ts:2430-2433 + 2705-2709; non-gate leave path re-stamps at 2714. Nothing to fix.
2. **F1-F5 verify --apply convergence: LANDED.** applyVerifyOutcome (headless.ts:991-1062) converges via recordGateInto + stampPacket, dedupes same evidenceHash (999-1001), no-ops while P6 incomplete; headless.test.ts green (296/296 across the audited suites).
3. **Wild gate-path forceHuman refusal, DoD post-check ordering, priorsSealed/canEnter guards, missing-record/locked/rejected pause paths** (engine.ts:2355-2691) — correct; each pauses with a machine `code` + ledger row. The 12-char feedback floor and vacuous-approve guard in the classifier (wild-mode.server.ts:243-309) are sound.
4. **io.ts import/export fidelity:** live round-trip `exportProjectJson → importProject` preserved packet byte-for-byte, 13 phases, wildRun passthrough; size cap + shape validation correct. Hydration re-derives the packet only when repair actually ran (engine.ts:1685-1698).
5. **packet.ts truncation:** budget-aware tail-preserving cut verified (packet.ts:424-446): result never exceeds 14 KB, Required-output-schema section survives, marker is loud. packet.test.ts green.
6. **store.startWildRun double-start window:** closed by the synchronous `commitWild(withStartLog)` before the first await (store.ts:775) — a second fire-and-forget start sees `active:true` and refuses; the §5.5 in-flight latch was a belt-and-braces that is therefore not functionally required (though PA-01's resume change must keep this invariant).
7. **crew.server.ts / swarm.ts / wild-mode.server.ts:** token-budgeted context, deterministic router, JSON/markdown parsers, grounding-UNTRUSTED discipline, advisory-only contract — audited, no functional bugs found.
8. **CLI loader/respond exit-code discipline** (create/approve/reject/retry/ingest/packet/export/vault/search/crew/verify/design/diagram/artifacts/harvest/swarm/prompt/bench/mine/knowledge/chat/deepen/doctor): envelopes carry schema_version/cmd/exit_code/code; the one-JSON-on-stdout + stack-on-stderr contract holds (exit codes verified live for create=0, run=0, gate=2).

## Sequencing (apply order)

1. **PA-01 → PA-02 → PA-03** (resume + watchdog + heartbeat are one coherent wild-loop recovery feature; PA-02 references PA-01's resumed path and PA-08's sink).
2. **PA-08** (sink threading — PA-02's wrapper needs it; the CLI sink needs the PA-04 `cliLogEvent` signature, which is unchanged by PA-04).
3. **PA-04 → PA-06** (CLI telemetry correctness + diagnose fidelity; PA-06's tests depend on PA-04's clean error list).
4. **PA-05 → PA-07 → PA-09** (independent one-file fixes; PA-09 is the deepest — do it last in the P1 wave so llm.test churn doesn't collide with the driver work).
5. **PA-10 → PA-11 → PA-12 → PA-13** (P2/P3 tail; all independent).

Do NOT apply PA-01 and PA-02 concurrently with different executors touching store.ts:171-813 — they patch overlapping regions (startWildRun); serialize them.

File created 2026-09-06 by PRO AUDITOR A. No source modified. Anchor drift note: all anchors were re-verified this pass against the current tree (engine.ts 2747 lines, store.ts 1400, headless.ts 1807, rapidtool-cli.mjs 1238); executors must re-grep before patching.

