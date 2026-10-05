// ---------------------------------------------------------------------------
// rt-client.test.ts — node-safe host-glue tests (fixes/109 §8.4). The module
// contract under test: importing/calling rt-client in Node (node:test, SSR)
// must be side-effect-free and never throw; the ring, dedupe, latch, stall
// sidecars and the client diagnosis builder all work without a window.
// Browser-only install behavior (window handlers) is exercised twice: in a
// fake-window harness here (install boot + idempotence + crash capture) and
// by the real-browser smoke.
// ---------------------------------------------------------------------------

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  __rtResetForTests,
  buildClientDiagnosis,
  clearStall,
  disposeRtClient,
  getRtRing,
  installRtClient,
  markBoundaryError,
  peekStall,
  pickNowLine,
  releaseWildStart,
  reportRt,
  rtSnapshot,
  setBusyProbe,
  setStallLatch,
  tryStartWild,
} from "./rt-client.ts";
import { P6_PHASE_MAX_MS, WILD_STEP_BUDGET_MS } from "./rt-events.ts";
import type { RtEvent } from "./rt-events.ts";
import type { Project } from "./types.ts";

/** Minimal RtEvent for the now-line selector (only the read fields matter). */
function nowRow(over: Partial<RtEvent>): RtEvent {
  return {
    schema_version: 1,
    ts: 1,
    level: "info",
    host: "test",
    sessionId: "s",
    scope: "sys",
    event: "test.row",
    message: "row",
    capture: "rt-client.test.ts:1",
    ...over,
  } as RtEvent;
}

test("installRtClient is a strict no-op without a window", () => {
  __rtResetForTests();
  installRtClient(); // must not throw in Node
  installRtClient(); // idempotent
  assert.equal(getRtRing().rows.length, 0, "no rows from a Node install");
});

test("reportRt stamps host/sessionId/ts and pushes into the ring (node-safe)", () => {
  __rtResetForTests();
  reportRt({
    level: "error",
    scope: "store-action",
    event: "store.action_error",
    message: "boom",
    capture: "src/lib/store.ts:425",
    err: new Error("persist exploded"),
  });
  const ring = getRtRing();
  assert.equal(ring.rows.length, 1);
  const row = ring.rows[0];
  assert.equal(row.host, "client");
  assert.equal(row.event, "store.action_error");
  assert.equal(row.sessionId, ring.sessionId, "row carries the ring session id");
  assert.equal(typeof row.ts, "number");
  assert.match(row.code ?? "", /^RT_E_/, "classified code from the thrown error");
  assert.ok(row.stack && row.stack.includes("persist exploded"), "stack tail flattened");
  assert.equal(row.capture, "src/lib/store.ts:425", "capture point preserved");
});

test("reportRt never throws on hostile inputs", () => {
  __rtResetForTests();
  const evil: unknown = { get message() { throw new Error("nope"); } };
  reportRt({
    level: "critical",
    scope: "sys",
    event: "sys.uncaught_error",
    message: "x",
    capture: "test",
    err: evil,
  });
  assert.equal(getRtRing().rows.length, 1, "row still landed");
});

test("markBoundaryError: first reporter wins (dev re-bubble dedupe)", () => {
  __rtResetForTests();
  const err = new Error("render crash");
  assert.equal(markBoundaryError(err), true, "boundary reports first");
  assert.equal(markBoundaryError(err), false, "global handler skips the re-bubble");
  assert.equal(markBoundaryError(new Error("other")), true, "new error object reports");
  // Non-object values never dedupe (thrown strings have no identity to hold).
  assert.equal(markBoundaryError("str"), true);
});

test("single-flight wild-start latch: second start refused, release + expiry", () => {
  __rtResetForTests();
  assert.equal(tryStartWild("p1"), true);
  assert.equal(tryStartWild("p1"), false, "double start refused");
  assert.equal(tryStartWild("p2"), true, "different project allowed");
  releaseWildStart("p1");
  assert.equal(tryStartWild("p1"), true, "released latch allows a new start");
});

test("stall latch sidecar: set/peek/clear round-trip", () => {
  __rtResetForTests();
  setStallLatch({ projectId: "p1", since: 100, stepElapsedMs: 900, class: "step-timeout" });
  const stall = peekStall();
  assert.equal(stall?.class, "step-timeout");
  assert.equal(stall?.stepElapsedMs, 900);
  // W309 A6 (M4-02): console's RunScreen mounts the pipeline rail, whose stall
  // row renders `snap.ring.stall` — pin that the rtSnapshot really carries the
  // seeded latch field-for-field (the rail's exact read path).
  assert.deepEqual(rtSnapshot().ring.stall, stall);
  clearStall();
  assert.equal(peekStall(), null);
  assert.equal(rtSnapshot().ring.stall, null, "clearStall empties the snapshot view too");
});

test("heartbeat rows divert to the sidecar, never the row list", () => {
  __rtResetForTests();
  reportRt({
    level: "info",
    scope: "sys",
    event: "sys.heartbeat",
    message: "hb",
    capture: "test",
    payload: { lagMs: 3 },
  });
  const ring = getRtRing();
  assert.equal(ring.rows.length, 0);
  assert.equal(ring.lastHeartbeat?.event, "sys.heartbeat");
});

test("setBusyProbe registers and clears without a window", () => {
  __rtResetForTests();
  let probeCalls = 0;
  setBusyProbe(() => {
    probeCalls += 1;
    return { projectId: "p", phase: 5, active: true, pause: false, startedAt: 1, lastAutoAt: 2 };
  });
  setBusyProbe(null);
  // T-17 (fixes/216i): the real expectation. Node has no window, so the probe
  // is a pure latch — it is consulted ONLY by the browser-installed heartbeat
  // (rt-client.ts installRtClient), so registering/clearing must never invoke
  // it eagerly, never emit a telemetry row, and never touch the ring sidecars.
  assert.equal(probeCalls, 0, "the probe is registered, never invoked without a window");
  const snap = rtSnapshot();
  assert.equal(snap.stats.rows, 0, "a probe register/clear round-trip emits no rows");
  assert.equal(snap.ring.lastHeartbeat, null, "no heartbeat sidecar without the window install");
  assert.equal(snap.crashSnapshot, null, "no crash sidecar from a probe round-trip");
});

test("rtSnapshot: stats + tail + no crash snapshot on a fresh ring", () => {
  __rtResetForTests();
  for (let i = 0; i < 3; i++) {
    reportRt({
      level: i === 2 ? "critical" : "info",
      scope: "sys",
      event: i === 2 ? "sys.uncaught_error" : "sys.heartbeat",
      message: `row ${i}`,
      capture: "test",
    });
  }
  const snap = rtSnapshot();
  // Two heartbeats → sidecar only; the critical row is the sole list entry.
  assert.equal(snap.stats.rows, 1, "heartbeats stay out of the row list");
  assert.equal(snap.stats.criticalCount, 1);
  assert.equal(snap.tail[0].message, "row 2", "newest first");
  // A critical row records the in-memory crash sidecar even in Node (storage
  // persistence is browser-only; the sidecar itself is storage-independent).
  assert.ok(snap.crashSnapshot !== null, "critical row records a crash sidecar");
  assert.equal(typeof snap.crashSnapshot?.at, "number");
});

test("buildClientDiagnosis: honest none-detected floor on a clean ring", () => {
  __rtResetForTests();
  const diag = buildClientDiagnosis({ project: null, persistHealth: { ok: true, lastError: null } }, 1_000);
  assert.equal(diag.cmd, "diagnose");
  assert.equal(diag.schema_version, 1);
  assert.equal(diag.source, "ui");
  assert.equal(diag.generatedAt, 1_000);
  assert.equal(diag.mostLikelyCause.class, "none-detected");
  assert.deepEqual(diag.errors, []);
  assert.equal(diag.watchdog.budgetsMs.wildStep, WILD_STEP_BUDGET_MS);
  // R12-f04 (fixes/271): the reported budget must EXCEED a legal P6 synthesis
  // step (was 90_000 vs a legal 240_000 — a healthy keyed step read as
  // frozen). Derived in rt-events.ts from P6_PHASE_MAX_MS; never re-forked.
  assert.ok(
    WILD_STEP_BUDGET_MS > P6_PHASE_MAX_MS,
    "the wild step budget exceeds the P6 synthesis phase max",
  );
  assert.equal(diag.watchdog.budgetsMs.chat, 60_000);
  assert.equal(diag.persistHealth.ok, true);
  assert.equal(diag.project.wildRun, null);
});

test("buildClientDiagnosis: project wildRun + errors flow into the contract", () => {
  __rtResetForTests();
  reportRt({
    level: "error",
    scope: "wild-step",
    event: "wild.step_timeout",
    message: "Wild step exceeded 2× budget",
    capture: "src/lib/store.ts:startWildRun",
    code: "RT_E_LLM_TIMEOUT",
    phase: 5,
    projectId: "p1",
  }, { now: 4_000 });
  const project = {
    id: "p1",
    name: "Demo",
    brief: "x",
    domain: "web",
    createdAt: 1,
    status: "running" as const,
    currentPhase: 5 as const,
    phases: [],
    scorecard: null,
    competitors: [],
    artifacts: [],
    memory: [],
    logs: [{ ts: 2_000, phase: 5, level: "info" as const, event: "wild.start", detail: "started" }],
    hitl: null,
    decisions: [],
    modelRoute: { flash: true, pro: false },
    sandbox: { runtime: "worker" as const, ramMb: null, timeoutS: 30, isolated: true },
    wildMode: true,
    wildRun: {
      active: true,
      phase: 5,
      // Started long enough ago to exceed WILD_STEP_BUDGET_MS at `now`.
      startedAt: 1_000,
      lastAutoLog: "pending",
      lastAutoAt: 1_000,
      stoppedAt: null,
      pause: false,
    },
  };
  // R12-f04 (fixes/271): the instant is derived from the budget constant — the
  // fixture must stay "long enough ago" as the derived budget moves (255_000).
  const overdueNow = 1_000 + WILD_STEP_BUDGET_MS + 5_000;
  const diag = buildClientDiagnosis({ project: project as never, persistHealth: { ok: true, lastError: null }, counts: { artifacts: 1 } }, overdueNow);
  assert.equal(diag.project.name, "Demo");
  assert.equal(diag.project.wildRun?.active, true);
  assert.equal(diag.project.wildRun?.overdueMs, WILD_STEP_BUDGET_MS + 5_000, "now - lastAutoAt");
  assert.equal(diag.errors.length, 1);
  assert.equal(diag.errors[0].code, "RT_E_LLM_TIMEOUT");
  assert.equal(diag.mostLikelyCause.class, "wild-step-timeout", "active run past 1× budget ranks first");
  assert.ok(diag.timeline.length >= 1, "ledger + telemetry timeline merged");
  assert.ok(diag.actions.length >= 1);
  assert.equal(diag.codes["RT_E_LLM_TIMEOUT"] !== undefined, true, "code docs attached");
  assert.equal(diag.growth.rows.ledger, 1);
  assert.equal(diag.growth.counts.artifacts, 1);
});

// fixes/348: the client path used to call buildDiagnosis with no `audit`, so
// project.stages was always [] + a stagesGap. It now projects the loaded
// project's phases/artifacts/tokenUsage (+ the ring's coded errors) through
// diagnose.projectDiagnosisStages — the same projector the diagnose verb uses.
test("buildClientDiagnosis: per-stage audit is projected from project + coded ring rows", () => {
  __rtResetForTests();
  reportRt({
    level: "error",
    scope: "wild-step",
    event: "gate.refused",
    message: "DoD unmet at P5",
    capture: "src/lib/engine.ts:gate",
    code: "RT_E_DOD_UNMET",
    phase: 5,
    projectId: "p1",
  }, { now: 4_000 });
  const project = {
    id: "p1",
    name: "Stage demo",
    status: "running",
    currentPhase: 5,
    wildRun: null,
    logs: [],
    phases: [
      { id: 5, status: "running", gate: { passed: false, unmet: ["p5-research"], evidenceHash: "h", checkedAt: 3_000 } },
    ],
    artifacts: [{ id: "a1", title: "research notes", phase: 5 }],
    tokenUsage: { calls: 2, promptTokens: 10, completionTokens: 5 },
  };
  const diag = buildClientDiagnosis(
    { project: project as never, persistHealth: { ok: true, lastError: null } },
    5_000,
  );
  const stages = diag.project.stages ?? [];
  assert.equal(stages.length, 1, "one observed phase");
  assert.equal(stages[0].phase, 5);
  assert.equal(stages[0].status, "running");
  assert.equal(stages[0].gate?.passed, false);
  assert.deepEqual(stages[0].gate?.unmet, ["p5-research"]);
  assert.equal(stages[0].refusals.length, 1, "the coded ring row is attributed by phase");
  assert.equal(stages[0].refusals[0].code, "RT_E_DOD_UNMET");
  // Per-phase keyed is honestly null: today's PhaseRecord carries no `keyed`
  // slice (diagnose.ts:264-266) — project-level tokenUsage maps to project.keyed.
  assert.equal(stages[0].keyed, null);
  assert.equal(diag.project.keyed?.calls, 2);
  assert.deepEqual(stages[0].artifacts, ["a1"]);
  assert.equal(stages[0].observed, true);
  assert.equal(diag.project.stagesGap, null, "a supplied, well-formed audit has no gap");
});

test("buildClientDiagnosis: absent project keeps the honest stages gap (no fabrication)", () => {
  __rtResetForTests();
  const diag = buildClientDiagnosis({ project: null, persistHealth: { ok: true, lastError: null } }, 1_000);
  assert.deepEqual(diag.project.stages, []);
  assert.match(String(diag.project.stagesGap), /no per-phase audit supplied/);
});

// PB-02 regression: diagnosis growth must count the project's REAL chatLog
// rows (was hardcoded 0) and must pass the store's persist-health through
// (the RuntimeLogPane Diagnose button previously hardcoded ok:true green).
test("buildClientDiagnosis: PB-02 chatLog growth counts project rows", () => {
  __rtResetForTests();
  const project = {
    id: "p2",
    name: "Chatty",
    brief: "x",
    domain: "web",
    createdAt: 1,
    status: "running" as const,
    currentPhase: 2 as const,
    phases: [],
    scorecard: null,
    competitors: [],
    artifacts: [],
    memory: [],
    logs: [{ ts: 1, phase: 2, level: "info" as const, event: "phase.exec", detail: "ran" }],
    hitl: null,
    decisions: [],
    modelRoute: { flash: true, pro: false },
    sandbox: { runtime: "worker" as const, ramMb: null, timeoutS: 30, isolated: true },
    wildMode: false,
    chatLog: [
      { role: "user" as const, text: "hello", ts: 1 },
      { role: "assistant" as const, text: "hi", ts: 2, provenance: "v1" },
    ],
  };
  const diag = buildClientDiagnosis(
    { project: project as never, persistHealth: { ok: true, lastError: null } },
    1_000,
  );
  assert.equal(diag.growth.rows.chatLog, 2, "chatLog rows counted, not zeroed");
  assert.equal(diag.growth.rows.ledger, 1, "ledger rows still counted");
});

test("buildClientDiagnosis: PB-02 persist-health failure passes through verbatim", () => {
  __rtResetForTests();
  const diag = buildClientDiagnosis(
    { project: null, persistHealth: { ok: false, lastError: "QuotaExceededError" } },
    1_000,
  );
  assert.equal(diag.persistHealth.ok, false);
  assert.equal(diag.persistHealth.lastError, "QuotaExceededError");
});

// ---------------------------------------------------------------------------
// installRtClient browser-boot harness (fixes/124 A3-01 regression): a minimal
// fake window/document/performance proves the telemetry host actually boots —
// global handlers land exactly once (the module latch makes a second install a
// no-op), and a simulated window error/unhandledrejection flows into the ring
// AND the persisted crash snapshot. Node's own globals are saved/restored.
// ---------------------------------------------------------------------------
type FakeListener = (e: unknown) => void;
/**
 * M6-08: recording PerformanceObserver — real browsers construct one in
 * installRtClient's Long Tasks path; the harness records construct/observe/
 * disconnect so the teardown seam can be pinned field-for-field.
 */
class FakePerformanceObserver {
  static instances: FakePerformanceObserver[] = [];
  disconnected = false;
  observed: unknown[] = [];
  cb: (list: { getEntries: () => unknown[] }) => void;
  constructor(cb: (list: { getEntries: () => unknown[] }) => void) {
    this.cb = cb;
    FakePerformanceObserver.instances.push(this);
  }
  observe(opts: unknown): void {
    this.observed.push(opts);
  }
  disconnect(): void {
    this.disconnected = true;
  }
}
function fakeBrowserSurface() {
  const listeners = new Map<string, FakeListener[]>();
  const store = new Map<string, string>();
  const clearedIntervals: number[] = [];
  const addListener = (type: string, fn: FakeListener) => {
    const arr = listeners.get(type) ?? [];
    arr.push(fn);
    listeners.set(type, arr);
  };
  const removeListener = (type: string, fn: FakeListener) => {
    const arr = listeners.get(type) ?? [];
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  };
  const fire = (type: string, e: unknown) => {
    for (const fn of listeners.get(type) ?? []) fn(e);
  };
  FakePerformanceObserver.instances.length = 0;
  // A3-02: capture the heartbeat interval callback so a test can drive a tick
  // (the real callback is a closure over module state; `setInterval: () => 1`
  // could never exercise it). Ids increment from 1 so the existing teardown pin
  // (`clearedIntervals.includes(1)`) still holds.
  const intervalFns = new Map<number, () => void>();
  let nextIntervalId = 0;
  const win = {
    addEventListener: addListener,
    removeEventListener: removeListener,
    PerformanceObserver: FakePerformanceObserver,
    setInterval: (fn: () => void) => {
      const id = ++nextIntervalId;
      intervalFns.set(id, fn);
      return id;
    },
    clearInterval: (id: number) => {
      clearedIntervals.push(id);
      intervalFns.delete(id);
    },
    setTimeout: () => 1,
    clearTimeout: () => {},
    location: { href: "https://rt.test/proj" },
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size;
      },
    },
  };
  return {
    listeners,
    fire,
    store,
    clearedIntervals,
    observers: () => FakePerformanceObserver.instances,
    /** Fire the most recently registered heartbeat callback (install registers one). */
    tick() {
      const fns = [...intervalFns.values()];
      const fn = fns[fns.length - 1];
      assert.ok(fn, "a heartbeat interval is registered");
      fn();
    },
    install() {
      const prev = {
        window: globalThis.window,
        document: globalThis.document,
        navigator: globalThis.navigator,
        performance: globalThis.performance,
      };
      (globalThis as Record<string, unknown>).window = win;
      (globalThis as Record<string, unknown>).document = {
        addEventListener: addListener,
        removeEventListener: removeListener,
        visibilityState: "visible",
      };
      // The fake window above already carries navigator/performance — the
      // host reads window.*, so no globalThis.navigator assignment is needed
      // (Node 22's navigator is a non-configurable read-only global).
      (globalThis as Record<string, unknown>).performance = { now: () => 5 };
      return prev;
    },
  };
}

test("installRtClient boots the capture host once under a fake window (A3-01)", () => {
  __rtResetForTests();
  const fb = fakeBrowserSurface();
  const prev = fb.install();
  try {
    installRtClient();
    installRtClient(); // module latch ⇒ second install is a no-op
    assert.equal(fb.listeners.get("error")?.length, 1, "one window error handler");
    assert.equal(fb.listeners.get("unhandledrejection")?.length, 1, "one rejection handler");
    assert.equal(fb.listeners.get("pagehide")?.length, 1, "one pagehide flush");
    assert.ok(fb.listeners.get("visibilitychange")?.length === 1, "one visibility flush");
    assert.equal(getRtRing().rows.length, 0, "install itself emits nothing");

    // Simulate an uncaught window error → critical ring row + crash snapshot.
    fb.fire("error", {
      message: "RT-SMOKE-CRASH",
      error: new Error("RT-SMOKE-CRASH"),
      filename: "https://rt.test/app.js",
      lineno: 42,
      colno: 7,
    });
    let rows = getRtRing().rows;
    assert.equal(rows.length, 1, "window error lands in the ring");
    assert.equal(rows[0].event, "sys.uncaught_error");
    assert.equal(rows[0].level, "critical");
    assert.equal(rows[0].host, "client");
    assert.match(rows[0].code ?? "", /^RT_E_/, "error classified");
    assert.ok(fb.store.has("rapidtool.rt.v1"), "warn+ row persists the ring");
    assert.ok(fb.store.has("rapidtool.rt.crash.v1"), "critical row writes the crash snapshot");

    // Simulate an unhandled promise rejection → second critical row.
    fb.fire("unhandledrejection", { reason: new Error("RT-SMOKE-REJECT") });
    rows = getRtRing().rows;
    assert.equal(rows.length, 2, "rejection lands as its own row");
    assert.equal(rows[1].event, "sys.unhandled_rejection");
    assert.equal(rows[1].message, "RT-SMOKE-REJECT");
  } finally {
    (globalThis as Record<string, unknown>).window = prev.window;
    (globalThis as Record<string, unknown>).document = prev.document;
    (globalThis as Record<string, unknown>).performance = prev.performance;
    __rtResetForTests();
  }
});

// ---------------------------------------------------------------------------
// M6-08 teardown pin (310 B6): installRtClient registers a long-task observer
// + a heartbeat interval + four listeners, and pre-fix NOTHING ever took them
// down outside __rtResetForTests. The seam under test: disposeRtClient() —
// wired to a REAL pagehide (persisted === false) and exported for hosts —
// disconnects the observer, clears the heartbeat, removes every listener, and
// re-arms the install latch. A bfcache pagehide (persisted === true, the page
// will be thawed) must NOT tear the probes down.
// ---------------------------------------------------------------------------
test("M6-08: disposeRtClient (and a real pagehide) tears down observer + heartbeat + listeners", () => {
  __rtResetForTests();
  const fb = fakeBrowserSurface();
  const prev = fb.install();
  try {
    installRtClient();
    const observer = fb.observers().at(-1);
    assert.ok(observer, "Long Tasks observer constructed at install");
    assert.equal(observer.observed.length, 1, "observer.observe called once");
    assert.equal(observer.disconnected, false, "observer live right after install");

    // bfcache pagehide: flush, but KEEP the probes (the page comes back).
    fb.fire("pagehide", { persisted: true });
    assert.equal(observer.disconnected, false, "bfcache pagehide keeps the observer");
    assert.equal(fb.listeners.get("error")?.length, 1, "bfcache pagehide keeps listeners");

    // Real unload: flush + dispose.
    fb.fire("pagehide", { persisted: false });
    assert.equal(observer.disconnected, true, "real pagehide disconnects the observer");
    assert.ok(fb.clearedIntervals.includes(1), "heartbeat interval cleared (id 1)");
    assert.equal(fb.listeners.get("error")?.length ?? 0, 0, "window error listener removed");
    assert.equal(fb.listeners.get("unhandledrejection")?.length ?? 0, 0, "rejection listener removed");
    assert.equal(fb.listeners.get("pagehide")?.length ?? 0, 0, "pagehide listener removed");
    assert.equal(fb.listeners.get("visibilitychange")?.length ?? 0, 0, "visibility listener removed");

    // The seam re-arms: a later install boots a FRESH host (new observer,
    // one listener per type again — no duplicates).
    installRtClient();
    const observer2 = fb.observers().at(-1);
    assert.ok(observer2 && observer2 !== observer, "reinstall constructs a fresh observer");
    assert.equal(observer2.disconnected, false);
    assert.equal(fb.listeners.get("error")?.length, 1, "reinstall re-registers exactly one");

    // disposeRtClient() directly is idempotent + window-safe.
    disposeRtClient();
    disposeRtClient();
    assert.equal(observer2.disconnected, true, "direct dispose disconnects too");
    assert.equal(fb.observers().length, 2, "no observer churn on repeated dispose");
  } finally {
    (globalThis as Record<string, unknown>).window = prev.window;
    (globalThis as Record<string, unknown>).document = prev.document;
    (globalThis as Record<string, unknown>).performance = prev.performance;
    __rtResetForTests();
  }
});

test("M6-08: disposeRtClient is a strict no-op without a window (node-safe)", () => {
  __rtResetForTests();
  disposeRtClient(); // must not throw in Node
  disposeRtClient(); // idempotent
  installRtClient(); // and the latch still installs as before
  assert.equal(getRtRing().rows.length, 0, "no rows from a Node install");
});

// ---------------------------------------------------------------------------
// A3-01 (344 audit): the pipeline now-line must answer "what is the machine
// doing" — a diagnostic-only client row (sys.longtask jank telemetry) must not
// preempt a real run row or the persisted ledger.
// ---------------------------------------------------------------------------
test("A3-01: pickNowLine prefers run rows / the ledger over diagnostic client telemetry", () => {
  const ledger = { logs: [{ ts: 50, phase: 4, level: "info", event: "gate.awaiting", detail: "P4 gate awaiting approval" }] };
  const project = ledger as unknown as Project;
  const empty = { logs: [], wildRun: null } as unknown as Project;

  const jank = nowRow({ scope: "sys", event: "sys.longtask", message: "Main thread blocked 281ms (Long Tasks API).", ts: 99 });
  const runRow = nowRow({ scope: "wild-step", event: "wild.step_ok", message: "sealed P3", ts: 40 });

  // Diagnostic-only ring ⇒ the ledger narrates the run (the 344 A3-01 shape).
  const fromLedger = pickNowLine(project, [jank], 1);
  assert.equal(fromLedger.source, "ledger");
  assert.match(String(fromLedger.text), /awaiting approval/);

  // A real run ring row still wins over the ledger (ring-first for RUN telemetry).
  const fromRun = pickNowLine(project, [jank, runRow], 2);
  assert.equal(fromRun.source, "ring");
  assert.equal(fromRun.event, "wild.step_ok");

  // Every diagnostic scope is skipped, not just sys: ui-render and boot too.
  const uiJank = nowRow({ scope: "ui-render", event: "ui.pane_crash", message: "pane crashed", ts: 100 });
  const bootRow = nowRow({ scope: "boot", event: "boot.ready", message: "booted", ts: 101 });
  assert.equal(pickNowLine(project, [uiJank], 1).source, "ledger");
  assert.equal(pickNowLine(project, [bootRow], 1).source, "ledger");

  // No run row / ledger / wild ⇒ the diagnostic row is the honest LAST resort (never idle).
  const diagOnly = pickNowLine(empty, [jank], 1);
  assert.equal(diagOnly.source, "ring");
  assert.equal(diagOnly.event, "sys.longtask");
  assert.match(diagOnly.note, /client telemetry only/);

  // Nothing at all ⇒ idle.
  assert.equal(pickNowLine(empty, [], 0).source, "idle");
});

// ---------------------------------------------------------------------------
// A3-02 (344 audit): the stall latch must clear. `clearStall` had 0 production
// callers, so one >=10 s lag pinned a `<Stalled>` row across runs + reloads.
// The heartbeat now clears it: stopped/paused drops any latch, a healthy active
// tick drops the mainthread-stall latch the heartbeat owns, and an unknown
// (probe null) tick leaves the latch alone.
// ---------------------------------------------------------------------------
const busy = (over: Partial<{ active: boolean; pause: boolean }> = {}) => ({
  projectId: "p1",
  phase: 3,
  active: true,
  pause: false,
  startedAt: 1,
  lastAutoAt: 1,
  ...over,
});

test("A3-02: the heartbeat clears the stall latch on a healthy tick and on stop/pause", () => {
  __rtResetForTests();
  const fb = fakeBrowserSurface();
  const prev = fb.install();
  try {
    installRtClient();

    // 1. healthy active tick clears the mainthread-stall latch (real lag ~0).
    setBusyProbe(() => busy());
    setStallLatch({ projectId: "p1", since: 1, stepElapsedMs: 11_000, class: "mainthread-stall" });
    assert.notEqual(peekStall(), null, "latch set");
    fb.tick();
    assert.equal(peekStall(), null, "a healthy heartbeat clears the mainthread-stall latch");

    // 2. a driver-owned latch is NOT cleared by a healthy ACTIVE tick (owner-scoped).
    setStallLatch({ projectId: "p1", since: 1, stepElapsedMs: 60_000, class: "step-timeout" });
    fb.tick();
    assert.equal(peekStall()?.class, "step-timeout", "a driver latch survives a healthy active heartbeat");

    // 3. paused and stopped runs clear ANY latch (a run that is not advancing has no stall).
    setBusyProbe(() => busy({ pause: true }));
    fb.tick();
    assert.equal(peekStall(), null, "a paused run clears the latch");
    setStallLatch({ projectId: "p1", since: 1, stepElapsedMs: 60_000, class: "step-timeout" });
    setBusyProbe(() => busy({ active: false }));
    fb.tick();
    assert.equal(peekStall(), null, "a stopped run clears the latch");

    // 3b. the console probe returns null once the wild run is not active — that
    // is the reload/stop path, so a REGISTERED probe's null must clear too.
    setStallLatch({ projectId: "p1", since: 1, stepElapsedMs: 60_000, class: "step-timeout" });
    setBusyProbe(() => null);
    fb.tick();
    assert.equal(peekStall(), null, "a registered probe reporting no active run clears the latch");

    // 4. with NO probe registered the host has no run signal at all — silence
    // must not erase a real driver latch.
    setStallLatch({ projectId: "p1", since: 1, stepElapsedMs: 60_000, class: "step-timeout" });
    setBusyProbe(null);
    fb.tick();
    assert.equal(peekStall()?.class, "step-timeout", "no probe ⇒ the latch is left alone");
  } finally {
    (globalThis as Record<string, unknown>).window = prev.window;
    (globalThis as Record<string, unknown>).document = prev.document;
    (globalThis as Record<string, unknown>).performance = prev.performance;
    __rtResetForTests();
  }
});

// ---------------------------------------------------------------------------
// A3-11 (344 audit): the Long-Tasks floor (>= 250 ms) and the RT_COALESCE_MS
// gate are the mechanism that keeps the ring from filling with jank rows — both
// were unpinned (a `250 -> 0` mutation survived).
// ---------------------------------------------------------------------------
test("A3-11: the Long-Tasks floor (250 ms) and the 5 s coalesce gate the sys.longtask row", () => {
  __rtResetForTests();
  const fb = fakeBrowserSurface();
  const prev = fb.install();
  try {
    installRtClient();
    const observer = fb.observers().at(-1);
    assert.ok(observer, "Long Tasks observer constructed at install");
    const fire = (durationMs: number) =>
      observer.cb({ getEntries: () => [{ duration: durationMs }] });
    const longtaskRows = () => getRtRing().rows.filter((r) => r.event === "sys.longtask").length;

    fire(249); // just under the floor
    assert.equal(longtaskRows(), 0, "a 249 ms block is below the report floor");
    fire(250); // exactly at the floor
    assert.equal(longtaskRows(), 1, "a 250 ms block is reported");
    fire(400); // a second block inside RT_COALESCE_MS
    assert.equal(longtaskRows(), 1, "a second block within RT_COALESCE_MS coalesces (still one row)");
  } finally {
    (globalThis as Record<string, unknown>).window = prev.window;
    (globalThis as Record<string, unknown>).document = prev.document;
    (globalThis as Record<string, unknown>).performance = prev.performance;
    __rtResetForTests();
  }
});
