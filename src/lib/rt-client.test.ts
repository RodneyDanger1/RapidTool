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
  getRtRing,
  installRtClient,
  markBoundaryError,
  peekStall,
  releaseWildStart,
  reportRt,
  rtSnapshot,
  setBusyProbe,
  setStallLatch,
  tryStartWild,
} from "./rt-client.ts";
import { P6_PHASE_MAX_MS, WILD_STEP_BUDGET_MS } from "./rt-events.ts";

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
function fakeBrowserSurface() {
  const listeners = new Map<string, FakeListener[]>();
  const store = new Map<string, string>();
  const addListener = (type: string, fn: FakeListener) => {
    const arr = listeners.get(type) ?? [];
    arr.push(fn);
    listeners.set(type, arr);
  };
  const fire = (type: string, e: unknown) => {
    for (const fn of listeners.get(type) ?? []) fn(e);
  };
  const win = {
    addEventListener: addListener,
    removeEventListener: () => {},
    setInterval: () => 1, // never fires; cleared by __rtResetForTests
    clearInterval: () => {},
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
        removeEventListener: () => {},
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
