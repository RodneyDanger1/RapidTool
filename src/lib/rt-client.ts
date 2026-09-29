// ---------------------------------------------------------------------------
// rt-client.ts — BROWSER host glue for the runtime telemetry ring (fixes/109
// §3.1/§4.1/§5). Pure decision math lives in rt-events/rt-ring/watchdog/
// diagnose; this module owns the host side: the singleton ring, localStorage
// persistence + crash snapshot, the global capture handlers (window error /
// unhandledrejection), the long-task + heartbeat probes, the single-flight
// wild-start latch, and buildClientDiagnosis for the Runtime Log UI.
//
// SAFETY CONTRACT (H2 crash class):
//   - NO node:fs / node:* imports anywhere in this graph — the client-safe
//     ring must never touch disk. The CLI disk appender is the separate
//     `runtime-log.server.ts` module (node-only).
//   - Module scope is side-effect-free and window-free: importing this file
//     in Node (node:test, SSR) is safe. All DOM/localStorage/performance use
//     is inside functions guarded by `typeof window !== "undefined"`.
//   - `installRtClient()` is idempotent and no-ops without a window.
//
// EXPORT SURFACE (compile against these — do not rename):
//   installRtClient · reportRt · markBoundaryError · getRtRing · rtSnapshot
//   setStallLatch · peekStall · clearStall · setBusyProbe
//   tryStartWild · releaseWildStart · buildClientDiagnosis
//   type RtBusyState · type ClientDiagnosisInput · __rtResetForTests
// ---------------------------------------------------------------------------

import {
  classifyError,
} from "./errors.ts";
import {
  buildDiagnosis,
  type DiagnosisJson,
  type DiagnosisProject,
  type DiagnosisTimelineRow,
  type DiagnosisWatchdog,
} from "./diagnose.ts";
import {
  CHAT_STEP_BUDGET_MS,
  CRASH_SNAPSHOT_BYTES,
  HEARTBEAT_MS,
  RT_COALESCE_MS,
  RT_CRASH_KEY,
  RT_ERROR_TAIL,
  RT_PERSIST_KEY,
  RT_SCHEMA_VERSION,
  WILD_STEP_BUDGET_MS,
  flattenStack,
  rtLevelRank,
  sanitizeRtEvent,
  type RtEvent,
  type RtEventSeed,
  type RtHost,
} from "./rt-events.ts";
import {
  HEARTBEAT_TICKS_PER_PERSIST,
  heartbeatLagClass,
} from "./watchdog.ts";
import {
  createRtRing,
  rtHydrate,
  rtPush,
  rtSerialize,
  rtStats,
  rtTail,
  type RtRing,
  type StallLatch,
} from "./rt-ring.ts";
import type { JsonLog, Project } from "./types.ts";

// ---------------------------------------------------------------------------
// Singleton ring + crash snapshot (lazy, window-guarded).
// ---------------------------------------------------------------------------

let ring: RtRing | null = null;
let installed = false;
let installedFailed = false;
let navStart = 0;
let heartbeatTimer: number | null = null;
let lastTickAt = 0;
let tickOrdinal = 0;
let lastLongTaskAt = 0;
let lastLongTaskMs: number | null = null;
let busyProbe: (() => RtBusyState | null) | null = null;
let lastKnownWildRun: RtBusyState | null = null;
let crashSnapshot: { at: number; href: string } | null = null;
let persistedCrashImported = false;
const boundarySeen = new WeakSet<object>();

/** Watchdog/heartbeat busy state — what the host probe reports per tick. */
export type RtBusyState = {
  projectId: string | null;
  phase: number | null;
  active: boolean;
  pause: boolean;
  startedAt: number | null;
  lastAutoAt: number | null;
};

// ---------------------------------------------------------------------------
// LocalStorage helpers (guarded, never throw).
// ---------------------------------------------------------------------------

function storageGet(key: string): string | null {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): boolean {
  try {
    if (typeof window === "undefined") return false;
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function storageRemove(key: string): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  } catch {
    /* best effort */
  }
}

function storageBytes(): number {
  try {
    if (typeof window === "undefined") return 0;
    let total = 0;
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k) total += k.length * 2 + (window.localStorage.getItem(k)?.length ?? 0) * 2;
    }
    return total;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Ring access + stamping.
// ---------------------------------------------------------------------------

/** The singleton ring (hydrates from `rapidtool.rt.v1` on first access). */
export function getRtRing(): RtRing {
  if (ring) return ring;
  const stored = storageGet(RT_PERSIST_KEY);
  if (stored !== null && stored.length > 0) {
    const hydrated = rtHydrate(stored);
    ring = hydrated;
    if (hydrated.recoveredCorrupt) {
      // §4.1 hydration rule: corrupt blob dropped — the next persist heals it.
      ring = rtPush(
        hydrated,
        stampSeed(
          {
            level: "warn",
            scope: "hydrate",
            event: "hydrate.recovered_corrupt",
            message: "Runtime ring blob was corrupt — dropped and re-initialized.",
            capture: "src/lib/rt-client.ts:getRtRing",
          },
          "client",
        ),
        { now: Date.now() },
      ).ring;
    }
  } else {
    ring = createRtRing();
  }
  importPreviousCrash(ring);
  return ring;
}

/** Hostile-input-safe error classification — the reporter must never throw. */
function safeClassify(err: unknown): string | null {
  try {
    return classifyError(err);
  } catch {
    return "RT_E_INTERNAL";
  }
}

/** Hostile-input-safe stack flattening. */
function safeFlatten(err: unknown): string | null {
  try {
    return flattenStack(err);
  } catch {
    return null;
  }
}

function stampSeed(seed: RtEventSeed, host: RtHost): RtEvent {
  // A1-40: never stamp from a throwaway ring — sessionId is the correlation
  // key for the whole diagnosis story, so a row stamped before the singleton
  // exists must initialize THE singleton (`getRtRing`), never a discarded twin
  // whose sessionId matches no ring, no persisted blob, no crash snapshot.
  const r = ring ?? (ring = getRtRing());
  const ts = Date.now();
  const row: RtEvent = {
    schema_version: RT_SCHEMA_VERSION,
    ts,
    level: seed.level,
    host,
    sessionId: r.sessionId,
    scope: seed.scope,
    event: seed.event,
    message: seed.message,
    capture: seed.capture,
    phase: seed.phase ?? null,
    projectId: seed.projectId ?? null,
    code: seed.code ?? (seed.err !== undefined ? safeClassify(seed.err) : null),
    stack: seed.stack ?? safeFlatten(seed.err),
    ctx: seed.ctx,
    payload: seed.payload,
    runRef: seed.runRef ?? null,
    elapsedMs: navStart > 0 ? Math.max(0, Math.round(ts - navStart)) : null,
  };
  return sanitizeRtEvent(row);
}

// ---------------------------------------------------------------------------
// Crash snapshot (§4.1.3): the tail that survives a freeze.
// ---------------------------------------------------------------------------

function persistRingNow(): void {
  const r = ring;
  if (!r) return;
  if (!storageSet(RT_PERSIST_KEY, rtSerialize(r))) {
    ring = { ...r, lastPersistFailure: `persist write to "${RT_PERSIST_KEY}" failed` };
  }
}

function writeCrashSnapshot(): void {
  const r = ring;
  if (!r) return;
  const href = typeof window !== "undefined" ? window.location.href.slice(0, 200) : "";
  const ua = typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : "";
  const snapshot = {
    at: Date.now(),
    sessionId: r.sessionId,
    href,
    ua,
    wildRun: lastKnownWildRun,
    ring: rtTail(r, 50),
  };
  try {
    const raw = JSON.stringify(snapshot);
    if (raw.length <= CRASH_SNAPSHOT_BYTES) {
      storageSet(RT_CRASH_KEY, raw);
      crashSnapshot = { at: snapshot.at, href };
    }
  } catch {
    /* never throw from a crash path */
  }
}

/** Import a previous session's crash snapshot once (the freeze tail banner). */
function importPreviousCrash(target: RtRing): void {
  if (persistedCrashImported) return;
  persistedCrashImported = true;
  const raw = storageGet(RT_CRASH_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw) as { at?: unknown; href?: unknown; ring?: unknown };
    // R4-f06 (W39·B4 sweep): the crash blob is localStorage — user-writable, so
    // `at` may be any JSON number. `{"at":1e999}` parses to Infinity, which the
    // typeof check below let through: the poisoned snapshot then survived into
    // `crashSnapshot` (assigned before the `new Date(at)` stamp threw) and
    // diagnose's freeze-pre-capture summary RangeError'd out of the Runtime Log
    // pane. Finite-guard at the source so only a real timestamp can be imported.
    const at = typeof parsed.at === "number" && Number.isFinite(parsed.at) ? parsed.at : Date.now();
    const href = typeof parsed.href === "string" ? parsed.href.slice(0, 200) : "";
    crashSnapshot = { at, href };
    storageRemove(RT_CRASH_KEY);
    const row = stampSeed(
      {
        level: "critical",
        scope: "sys",
        event: "sys.previous_session_crash",
        message: `A previous session froze/crashed (${new Date(at).toISOString()}) — tail imported from the crash snapshot.`,
        capture: "src/lib/rt-client.ts:importPreviousCrash",
        ctx: { href },
      },
      "client",
    );
    ring = rtPush(target, row, { now: Date.now() }).ring;
    persistRingNow();
  } catch {
    /* corrupt snapshot — drop it silently */
  }
}

// ---------------------------------------------------------------------------
// reportRt — the single host-glue emit used by every client capture point.
// ---------------------------------------------------------------------------

/**
 * Push one row through the client ring. Never throws (telemetry must never
 * break the host it observes). Persist cadence (§4.1): warn+ rows write
 * through immediately; info/debug rows ride along on the next warn+ row or on
 * the pagehide flush. `critical` rows also write the crash snapshot.
 */
export function reportRt(seed: RtEventSeed, opts: { now?: number } = {}): void {
  try {
    const r = getRtRing();
    const row = stampSeed(seed, "client");
    const pushed = rtPush(r, row, { now: opts.now ?? row.ts });
    ring = pushed.ring;
    const levelRank = rtLevelRank(row.level);
    if (levelRank >= rtLevelRank("warn")) {
      persistRingNow();
    }
    if (row.level === "critical") {
      writeCrashSnapshot();
    }
  } catch {
    /* the reporter itself must never become a crash source */
  }
}

/**
 * Dedupe seam between the boundary (CAP-2) and the global handler (CAP-1):
 * React dev-mode re-bubbles boundary-caught errors to window.onerror
 * (react.dev caveat). The FIRST reporter marks the error object and reports;
 * the second skips. Returns true when this caller should report.
 */
export function markBoundaryError(err: unknown): boolean {
  if (err !== null && (typeof err === "object" || typeof err === "function")) {
    const key = err as object;
    if (boundarySeen.has(key)) return false;
    boundarySeen.add(key);
    return true;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Stall latch + busy probe + single-flight wild-start latch.
// ---------------------------------------------------------------------------

/** Set/clear the §5.2/§5.3 stall sidecar (UI poll + store driver share it). */
export function setStallLatch(latch: StallLatch): void {
  const r = getRtRing();
  ring = { ...r, stall: latch };
  if (latch !== null) persistRingNow();
}

export function peekStall(): StallLatch {
  return getRtRing().stall;
}

export function clearStall(): void {
  const r = getRtRing();
  ring = { ...r, stall: null };
  persistRingNow();
}

/** Register the watchdog busy probe (console registers; rt-client polls it). */
export function setBusyProbe(fn: (() => RtBusyState | null) | null): void {
  busyProbe = fn;
}

/** Release the single-flight latch (called when a run is observed active). */
export function releaseWildStart(projectId: string): void {
  if (wildStartLatch !== null && wildStartLatch.projectId === projectId) {
    wildStartLatch = null;
  }
}

const WILD_START_LATCH_MS = 8_000;
let wildStartLatch: { projectId: string; at: number } | null = null;

/** §5.5 single-flight latch: one startWildRun per project at a time. */
export function tryStartWild(projectId: string): boolean {
  const now = Date.now();
  if (
    wildStartLatch !== null &&
    wildStartLatch.projectId === projectId &&
    now - wildStartLatch.at < WILD_START_LATCH_MS
  ) {
    return false;
  }
  wildStartLatch = { projectId, at: now };
  // 174-2: expire on Node too (tests / CLI have no window).
  const t = setTimeout(() => releaseWildStart(projectId), WILD_START_LATCH_MS);
  if (typeof t === "object" && t && "unref" in t && typeof t.unref === "function") t.unref();
  return true;
}

// ---------------------------------------------------------------------------
// installRtClient — global capture + probes (idempotent, browser-only).
// ---------------------------------------------------------------------------

/**
 * Install the CAP-1 global handlers, the long-task observer, the heartbeat
 * probe and the pagehide flush. Idempotent (double-import safe) and a strict
 * no-op without a window (SSR / node:test). Called from router.tsx module
 * scope and again from __root's layout effect (late-safe install).
 */
export function installRtClient(): void {
  if (typeof window === "undefined") return;
  if (installed || installedFailed) return;
  try {
    installed = true;
    navStart = performance.now();
    lastTickAt = Date.now();

    window.addEventListener("error", (event: ErrorEvent) => {
      try {
        const err: unknown = event.error ?? event.message;
        if (!markBoundaryError(err)) return; // boundary already reported it
        reportRt({
          level: "critical",
          scope: "sys",
          event: "sys.uncaught_error",
          message: typeof event.message === "string" && event.message ? event.message : "Uncaught error reached the window.",
          capture: "src/lib/rt-client.ts:installRtClient",
          err,
          ctx: {
            filename: typeof event.filename === "string" ? event.filename.slice(0, 160) : null,
            lineno: typeof event.lineno === "number" ? event.lineno : null,
            colno: typeof event.colno === "number" ? event.colno : null,
          },
        });
      } catch {
        /* never throw from a capture handler */
      }
    });

    window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
      try {
        reportRt({
          level: "critical",
          scope: "sys",
          event: "sys.unhandled_rejection",
          message:
            event.reason instanceof Error
              ? event.reason.message
              : typeof event.reason === "string"
                ? event.reason
                : "Unhandled promise rejection reached the window.",
          capture: "src/lib/rt-client.ts:installRtClient",
          err: event.reason,
          ctx: { reasonType: typeof event.reason },
        });
      } catch {
        /* never throw from a capture handler */
      }
      // NOTE: preventDefault is intentionally NOT called — the browser keeps
      // its default console noise (honest per §3.1).
    });

    // §5.4 Long Tasks API (≥ 250 ms report floor, coalesced on RT_COALESCE_MS).
    try {
      const PO = (window as unknown as { PerformanceObserver?: typeof PerformanceObserver }).PerformanceObserver;
      if (typeof PO === "function") {
        const observer = new PO((list) => {
          for (const entry of list.getEntries()) {
            const durationMs = Math.round((entry as PerformanceEntry & { duration: number }).duration);
            if (durationMs < 250) continue;
            const now = Date.now();
            if (now - lastLongTaskAt < RT_COALESCE_MS) continue;
            lastLongTaskAt = now;
            lastLongTaskMs = durationMs;
            reportRt({
              level: "warn",
              scope: "sys",
              event: "sys.longtask",
              message: `Main thread blocked ${durationMs}ms (Long Tasks API).`,
              capture: "src/lib/rt-client.ts:installRtClient",
              payload: { durationMs },
            });
          }
        });
        observer.observe({ type: "longtask", buffered: true });
      }
    } catch {
      /* Long Tasks API unavailable — the interval-lag probe is the fallback */
    }

    // §5.3 heartbeat: 1 s ticks while a wild run / chat send is busy.
    heartbeatTimer = window.setInterval(() => {
      try {
        tickOrdinal += 1;
        const now = Date.now();
        const expected = lastTickAt + HEARTBEAT_MS;
        lastTickAt = now;
        const lagMs = Math.max(0, now - expected);
        const busy = busyProbe ? busyProbe() : null;
        if (busy && busy.active && !busy.pause) {
          lastKnownWildRun = busy;
          const r = getRtRing();
          if (tickOrdinal % HEARTBEAT_TICKS_PER_PERSIST === 0) {
            const beat = stampSeed(
              {
                level: "info",
                scope: "sys",
                event: "sys.heartbeat",
                message: "Wild run heartbeat.",
                capture: "src/lib/rt-client.ts:heartbeat",
                projectId: busy.projectId,
                phase: busy.phase,
                runRef: busy.startedAt !== null ? String(busy.startedAt) : null,
                payload: { lagMs: Math.round(lagMs) },
              },
              "client",
            );
            ring = rtPush(r, beat, { now }).ring;
            // §5.3: the heartbeat sidecar IS the crash tail — persist it.
            persistRingNow();
          }
          const lagClass = heartbeatLagClass(lagMs);
          if (lagClass === "warn") {
            reportRt({
              level: "warn",
              scope: "sys",
              event: "sys.heartbeat_lag",
              message: `Heartbeat lag ${Math.round(lagMs)}ms while a run is active.`,
              capture: "src/lib/rt-client.ts:heartbeat",
              projectId: busy.projectId,
              phase: busy.phase,
              payload: { lagMs: Math.round(lagMs) },
            });
          } else if (lagClass === "critical") {
            setStallLatch({
              projectId: busy.projectId,
              since: now,
              stepElapsedMs: Math.round(lagMs),
              class: "mainthread-stall",
            });
            reportRt({
              level: "critical",
              scope: "sys",
              event: "sys.mainthread_stall",
              message: `Main thread stalled ≥ ${Math.round(lagMs)}ms while a run was active.`,
              capture: "src/lib/rt-client.ts:heartbeat",
              projectId: busy.projectId,
              phase: busy.phase,
              payload: { lagMs: Math.round(lagMs) },
            });
          }
        }
      } catch {
        /* probe errors are themselves never crash sources */
      }
    }, HEARTBEAT_MS);

    // §4.1 flush + crash snapshot on unload.
    const flush = () => {
      try {
        const r = getRtRing();
        persistRingNow();
        const last30s = r.rows.filter((row) => (row.level === "error" || row.level === "critical") && Date.now() - row.ts <= 30_000);
        if (last30s.length > 0) writeCrashSnapshot();
      } catch {
        /* best effort */
      }
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  } catch {
    installedFailed = true;
  }
}

// ---------------------------------------------------------------------------
// rtSnapshot + buildClientDiagnosis (the UI-side half of the diagnose verb).
// ---------------------------------------------------------------------------

/** Live snapshot of the client ring + sidecars for the Runtime Log tab. */
export function rtSnapshot(): {
  ring: RtRing;
  stats: ReturnType<typeof rtStats>;
  tail: RtEvent[];
  crashSnapshot: { at: number; href: string } | null;
} {
  const r = getRtRing();
  return {
    ring: r,
    stats: rtStats(r),
    tail: rtTail(r, RT_ERROR_TAIL),
    crashSnapshot,
  };
}

export type ClientDiagnosisInput = {
  /** The active project (UI passes useRapid's record) — null for a bare shell. */
  project?: Project | null;
  /** store.persistStorageHealth() result when available. */
  persistHealth?: { ok: boolean; lastError: string | null };
  /** Growth counts from the store (artifacts/memory/decisions/projects). */
  counts?: Record<string, number>;
  /** Optional extra ledger rows for the timeline (defaults to project.logs). */
  ledgerRows?: JsonLog[];
};

function projectToDiagnosis(project: Project | null, now: number): DiagnosisProject {
  if (!project) {
    return { ref: null, name: null, status: null, currentPhase: null, wildRun: null };
  }
  const wr = project.wildRun ?? null;
  return {
    ref: project.id,
    name: project.name,
    status: project.status,
    currentPhase: project.currentPhase,
    wildRun: wr
      ? {
          active: wr.active,
          pause: wr.pause,
          phase: wr.phase,
          startedAt: wr.startedAt,
          lastAutoAt: wr.lastAutoAt,
          lastAutoLog: wr.lastAutoLog ?? null,
          stoppedAt: wr.stoppedAt,
          overdueMs:
            wr.active && !wr.pause && wr.lastAutoAt !== null ? Math.max(0, now - wr.lastAutoAt) : null,
        }
      : null,
  };
}

/**
 * Build the SAME one-JSON diagnosis the CLI `diagnose` verb emits (§6.1
 * contract — byte-identical field names) from the client ring + the passed
 * project/persist/counts. Pure with respect to its inputs (reads the
 * singleton ring + clock only).
 */
export function buildClientDiagnosis(input: ClientDiagnosisInput, now: number = Date.now()): DiagnosisJson {
  const r = getRtRing();
  const stats = rtStats(r);
  const errors = r.rows.filter((row) => row.level === "error" || row.level === "critical").slice(-RT_ERROR_TAIL);
  const ledger = input.ledgerRows ?? input.project?.logs ?? [];
  const timeline: DiagnosisTimelineRow[] = [
    ...ledger.slice(-30).map((l): DiagnosisTimelineRow => ({
      ts: l.ts,
      kind: "ledger",
      event: l.event,
      scope: "engine-phase",
      phase: l.phase ?? null,
      detailOrMessage: l.detail ?? "",
    })),
    ...r.rows.slice(-40).map((row): DiagnosisTimelineRow => ({
      ts: row.ts,
      kind: "telemetry",
      event: row.event,
      scope: row.scope,
      phase: row.phase ?? null,
      detailOrMessage: row.message,
    })),
  ].sort((a, b) => a.ts - b.ts);

  const lastHb = r.lastHeartbeat;
  const hbLag = lastHb && typeof lastHb.payload?.lagMs === "number" ? lastHb.payload.lagMs : null;
  const watchdog: DiagnosisWatchdog = {
    lastHeartbeatAt: lastHb?.ts ?? null,
    heartbeatLagMs: hbLag,
    stall: r.stall
      ? { active: true, since: r.stall.since, stepElapsedMs: r.stall.stepElapsedMs, class: r.stall.class }
      : null,
    lastLongTaskMs,
    budgetsMs: { wildStep: WILD_STEP_BUDGET_MS, chat: CHAT_STEP_BUDGET_MS },
  };

  // A1-39: the chatLog line below documents optional-chain safety; `logs`
  // gets the same treatment — a legacy/hand-built project without a `logs`
  // array must report 0 here, never throw inside the diagnostic builder.
  const projectLogs = input.project?.logs;
  const counts = input.counts ?? {};
  return buildDiagnosis({
    source: "ui",
    now,
    session: {
      sessionId: r.sessionId,
      host: "client",
      href: typeof window !== "undefined" ? window.location.href.slice(0, 200) : "",
      ua: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : "",
    },
    project: projectToDiagnosis(input.project ?? null, now),
    errors,
    timeline,
    watchdog,
    growth: {
      rows: {
        ledger: Array.isArray(projectLogs) ? projectLogs.length : 0,
        telemetryRing: stats.rows,
        // PB-02: real chat-thread growth — the project's persisted chatLog is
        // present in state, so a zeroed number misled ("0 rows" while the
        // thread pane holds dozens). Optional-chain: legacy projects without a
        // chatLog field report 0, never throw.
        chatLog: input.project?.chatLog?.length ?? 0,
      },
      bytes: {
        // K7 payout (W40 solo): a browser CANNOT measure these — honest null + "not measured"
        // semantics (was a fake 0, the G4 item-5 class). Consumers render null as unknown.
        projectFile: null,
        logDirBytes: null,
        localStorageEstimate: storageBytes(),
      },
      counts,
    },
    persistHealth: input.persistHealth ?? {
      ok: r.lastPersistFailure === null,
      lastError: r.lastPersistFailure,
    },
    crashSnapshot,
  });
}

/** Test-only: reset the module singleton state (deterministic node tests). */
export function __rtResetForTests(): void {
  ring = null;
  installed = false;
  installedFailed = false;
  navStart = 0;
  tickOrdinal = 0;
  lastTickAt = 0;
  lastLongTaskAt = 0;
  lastLongTaskMs = null;
  busyProbe = null;
  lastKnownWildRun = null;
  crashSnapshot = null;
  persistedCrashImported = false;
  wildStartLatch = null;
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}
