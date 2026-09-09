// ---------------------------------------------------------------------------
// rt-events.ts — pure runtime-telemetry types + constants (fixes/109 §2).
//
// Zero-dep, deterministic, side-effect-free: no window/process/fs imports, no
// Date.now() at module scope, no auto-run path. Mirrors tracing.ts doctrine —
// the PURE CORE defines shapes and rules; HOST GLUE (rt-client.ts for the
// browser, scripts/log-sink.mjs for the CLI) stamps wall-clock time and owns
// sinks/retention. Same inputs in ⇒ byte-identical outputs out.
//
// RtEvent (v1) is the single currency for crash/error/telemetry rows in both
// hosts. Machine-first fields (event/code/scope/phase), human `message` prose
// is display-only. Redacted by construction: `ctx`/`payload` carry flat
// scalars only (≤ 8 keys, values ≤ 160 chars) — never prompt bodies, API
// keys, chat text or project JSON (tracing.ts:23-26 doctrine).
//
// EXPORT SURFACE (compile against these — do not rename):
//   RT_SCHEMA_VERSION · RtLevel · RtHost · RtScope · RtEvent · RtEventSeed
//   RT_EVENT_NAMES (event → scope catalogue, additive-only)
//   constants table (§5.6)
//   messageHash · shouldCoalesce · rtLevelRank · sanitizeRtEvent ·
//   sanitizeRecord · flattenStack · isKnownRtEvent
// ---------------------------------------------------------------------------

export const RT_SCHEMA_VERSION = 1 as const;

export type RtLevel = "debug" | "info" | "warn" | "error" | "critical";

/** Host that captured the row: browser client, file CLI, or a test recorder. */
export type RtHost = "client" | "cli" | "test";

/** Stable module/area ids (additively extended; rows MUST use one of these). */
export const RT_SCOPES = [
  "boot",
  "ui-render",
  "boundary",
  "store-action",
  "store-persist",
  "engine-phase",
  "wild-step",
  "wild-driver",
  "verify-run",
  "crew-turn",
  "llm-call",
  "chat",
  "runner-exec",
  "cli-command",
  "cli-log",
  "hydrate",
  "watcher",
  "harvest-search",
  "research",
  "sys",
  "diagnose",
] as const;

export type RtScope = (typeof RT_SCOPES)[number];

/** One runtime telemetry row (schema v1 — see fixes/109 §2.2). */
export type RtEvent = {
  schema_version: 1;
  /** Epoch ms, stamped by HOST glue at capture (pure core never invents time). */
  ts: number;
  level: RtLevel;
  host: RtHost;
  /** One per page-load / per CLI invocation. */
  sessionId: string;
  /** Stable module/area id, dotted — one of RT_SCOPES. */
  scope: RtScope;
  /** Dotted event name from the RT_EVENT_NAMES catalogue. */
  event: string;
  /** PhaseId 0-12 when inside a project run, else null. */
  phase?: number | null;
  /** Optional project id / project file path. */
  projectId?: string | null;
  /** RT_E_* code from the existing registry when the failure classifies. */
  code?: string | null;
  /** Human one-liner (≤ 300 chars). */
  message: string;
  /** `file.ts:line` of the CAPTURE POINT (baked per hook — never parsed). */
  capture: string;
  /** Stack tail: ≤ 12 lines, each ≤ 240 chars, cause-chain flattened ≤ 3. */
  stack?: string | null;
  /** Flat scalar context (≤ 8 keys, values ≤ 160 chars). Redacted by construction. */
  ctx?: Record<string, string | number | boolean | null>;
  /** Machine payload (durations, counts, bytes, verdicts…). Flat scalars only. */
  payload?: Record<string, string | number | boolean | null>;
  /** Parent correlation id when inside a run/step (wildRun epoch / step ordinal). */
  runRef?: string | null;
  /** Monotonic ms since navigationStart / process start (host stamps). */
  elapsedMs?: number | null;
  /** Dedupe counter: same-fingerprint row seen N times in the window (§2.5). */
  count?: number;
};

/**
 * The seed shape hosts/hooks pass IN. Host glue stamps ts/host/sessionId/
 * elapsedMs and classifies `err` (errors.ts classifyError) into `code`.
 */
export type RtEventSeed = {
  level: RtLevel;
  scope: RtScope;
  event: string;
  message: string;
  /** `file.ts:line` of the capture point — REQUIRED, baked per hook. */
  capture: string;
  code?: string | null;
  phase?: number | null;
  projectId?: string | null;
  ctx?: Record<string, string | number | boolean | null>;
  payload?: Record<string, string | number | boolean | null>;
  runRef?: string | null;
  stack?: string | null;
  /** Optional thrown object: host glue derives code + stack from it. */
  err?: unknown;
};

// ---------------------------------------------------------------------------
// §2.4 Event-name catalogue. event → its ONLY legal scope. Additive-only:
// consumers match on string literals, never array position. Call sites must
// NOT invent free-form event strings — the catalogue is the guardrail (same
// philosophy as ERROR_CODES sync test, errors.test.ts).
// ---------------------------------------------------------------------------

export const RT_EVENT_NAMES: Record<string, RtScope> = {
  // boot
  "boot.start": "boot",
  "boot.ready": "boot",
  // sys
  "sys.uncaught_error": "sys",
  "sys.unhandled_rejection": "sys",
  "sys.mainthread_stall": "sys",
  "sys.heartbeat": "sys",
  "sys.memory": "sys",
  "sys.step_overdue": "sys",
  "sys.heartbeat_lag": "sys",
  "sys.longtask": "sys",
  "sys.previous_session_crash": "sys",
  // boundary
  "boundary.crash": "boundary",
  // ui-render
  "ui.pane_crash": "ui-render",
  "ui.action_error": "ui-render",
  // store-action
  "store.action_error": "store-action",
  // engine-phase
  "engine.phase_fallback": "engine-phase",
  "engine.phase_error": "engine-phase",
  // wild-step (engine seam, CAP-5; wild.step_paused added per §3.5 point 2)
  "wild.step_start": "wild-step",
  "wild.step_ok": "wild-step",
  "wild.step_timeout": "wild-step",
  "wild.step_error": "wild-step",
  "wild.step_paused": "wild-step",
  // wild-driver (CAP-6; wild.driver_error added per §3.6 catch row)
  "wild.driver_cap": "wild-driver",
  "wild.driver_stall": "wild-driver",
  "wild.driver_start_refused": "wild-driver",
  "wild.driver_paused_auto": "wild-driver",
  "wild.driver_resumed": "wild-driver",
  "wild.driver_error": "wild-driver",
  // llm-call (CAP-10; llm.late_settle added per §3.10)
  "llm.ok": "llm-call",
  "llm.not_configured": "llm-call",
  "llm.timeout": "llm-call",
  "llm.rejected": "llm-call",
  "llm.transport_error": "llm-call",
  "llm.late_settle": "llm-call",
  // chat
  "chat.send_error": "chat",
  // verify-run
  "verify.error": "verify-run",
  "verify.ok": "verify-run",
  // crew-turn
  "crew.turn_ok": "crew-turn",
  "crew.turn_error": "crew-turn",
  // runner-exec
  "runner.unavailable": "runner-exec",
  "runner.failed": "runner-exec",
  "runner.ok": "runner-exec",
  // cli-command / cli-log (cli.error added for the main-catch row, CAP-7)
  "cli.invocation": "cli-command",
  "cli.error": "cli-log",
  // hydrate / persist (CAP-8)
  "hydrate.ok": "hydrate",
  "hydrate.recovered_corrupt": "hydrate",
  "hydrate.empty": "hydrate",
  "persist.quota_failed": "store-persist",
  "persist.salvaged": "store-persist",
  "persist.ok": "store-persist",
  // watcher
  "watcher.error": "watcher",
  "watcher.refused": "watcher",
  // harvest-search
  "harvest.error": "harvest-search",
  "search.unavailable": "harvest-search",
  // diagnose
  "diagnose.ran": "diagnose",
};

/** True when the event string is a catalogue member. */
export function isKnownRtEvent(event: string): boolean {
  return Object.prototype.hasOwnProperty.call(RT_EVENT_NAMES, event);
}

// ---------------------------------------------------------------------------
// §5.6 Constants table (single source of truth).
// ---------------------------------------------------------------------------

export const WILD_STEP_BUDGET_MS = 90_000;
export const WILD_STEP_AUTOPAUSE_MS = 180_000;
export const CHAT_STEP_BUDGET_MS = 60_000;
export const HEARTBEAT_MS = 1_000;
export const HEARTBEAT_PERSIST_EVERY_MS = 5_000;
export const HEARTBEAT_LAG_WARN_MS = 3_000;
export const STALL_CRITICAL_MS = 10_000;
export const LONGTASK_REPORT_MS = 250;
export const LONGTASK_COALESCE_MS = 10_000;
export const RING_CAP = 200;
export const RING_BYTES = 64 * 1024;
export const CRASH_SNAPSHOT_BYTES = 16 * 1024;
export const LOG_ROTATE_BYTES = 5 * 1024 * 1024;
export const LOG_KEEP = 4;
/** Max error/critical rows a diagnose verb returns (ring + NDJSON tail). */
export const RT_ERROR_TAIL = 200;
/** localStorage key for the client ring (version-pinned like rapidtool.v4). */
export const RT_PERSIST_KEY = "rapidtool.rt.v1";
/** localStorage key for the crash snapshot (bounded 16 KB). */
export const RT_CRASH_KEY = "rapidtool.rt.crash.v1";
/** §2.5 coalescing window. */
export const RT_COALESCE_MS = 5_000;

// ---------------------------------------------------------------------------
// §2.5 level + dedupe + coalescing (pure, unit-tested).
// ---------------------------------------------------------------------------

/** Level order (debug < info < warn < error < critical). */
const RT_LEVEL_RANK: Record<RtLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  critical: 4,
};

export function rtLevelRank(level: RtLevel): number {
  return RT_LEVEL_RANK[level] ?? -1;
}

/** Fingerprint: first 96 chars of the trimmed message (coalescing key part). */
export function messageHash(message: string): string {
  return String(message).trim().slice(0, 96);
}

/**
 * Coalesce rule (§2.5): same scope + event + code + messageHash and a ts gap
 * ≤ 5 000 ms → count-up instead of append (heartbeat tickers + retry storms
 * collapse to one ring slot).
 */
export function shouldCoalesce(prev: RtEvent, next: RtEvent, now: number): boolean {
  return (
    prev.scope === next.scope &&
    prev.event === next.event &&
    (prev.code ?? null) === (next.code ?? null) &&
    messageHash(prev.message) === messageHash(next.message) &&
    now - prev.ts <= RT_COALESCE_MS
  );
}

// ---------------------------------------------------------------------------
// Redaction / per-row budgets (pure; the ring runs these on every push).
// ---------------------------------------------------------------------------

const MAX_MESSAGE_CHARS = 300;
const MAX_CTX_KEYS = 8;
const MAX_SCALAR_CHARS = 160;
const MAX_STACK_LINES = 12;
const MAX_STACK_LINE_CHARS = 240;
const MAX_CAUSE_DEPTH = 3;

/** Clip a string on code-point boundaries (total length ≤ max, incl. ellipsis). */
function clipChars(value: string, max: number): string {
  const units = Array.from(value);
  if (units.length <= max) return value;
  const keep = Math.max(0, max - 1);
  return `${units.slice(0, keep).join("").trimEnd()}…`;
}

/** Flat scalar record guard: ≤ 8 keys, scalar values only, strings ≤ 160 chars. */
export function sanitizeRecord(
  record: Record<string, string | number | boolean | null> | null | undefined,
): Record<string, string | number | boolean | null> | undefined {
  if (!record || typeof record !== "object" || Array.isArray(record)) return undefined;
  const out: Record<string, string | number | boolean | null> = {};
  let keys = 0;
  for (const [key, value] of Object.entries(record)) {
    if (keys >= MAX_CTX_KEYS) break;
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    if (value === null) {
      out[key] = null;
    } else if (typeof value === "string") {
      out[key] = clipChars(value, MAX_SCALAR_CHARS);
    } else if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value;
    } else if (typeof value === "boolean") {
      out[key] = value;
    } else {
      continue; // non-scalar → dropped (redacted by construction)
    }
    keys += 1;
  }
  return out;
}

/**
 * Stack tail: ≤ 12 lines, each ≤ 240 chars, cause-chain flattened ≤ 3 levels.
 * Handles Error instances, thrown strings and duck-typed objects. Never throws.
 */
export function flattenStack(err: unknown): string | null {
  const lines: string[] = [];
  let current: unknown = err;
  let depth = 0;
  const seen = new Set<unknown>();
  while (current !== null && current !== undefined && depth < MAX_CAUSE_DEPTH) {
    if (typeof current === "object" && seen.has(current)) break;
    if (typeof current === "object") seen.add(current);
    const isObj = typeof current === "object" && current !== null;
    const name = isObj ? (current as { name?: unknown }).name : undefined;
    // Hostile inputs (throwing getters) must never crash the reporter —
    // read message/stack defensively.
    let message = "";
    if (isObj) {
      try {
        const m = (current as { message?: unknown }).message;
        if (typeof m === "string") message = m;
      } catch {
        message = "(unreadable message)";
      }
    } else if (typeof current === "string") {
      message = current;
    }
    const header = `${typeof name === "string" && name ? name : "Error"}${message ? `: ${message}` : ""}`;
    lines.push(clipChars(header, MAX_STACK_LINE_CHARS));
    let stack: unknown;
    if (isObj) {
      try {
        stack = (current as { stack?: unknown }).stack;
      } catch {
        stack = undefined;
      }
    }
    if (typeof stack === "string") {
      for (const line of stack.split("\n").slice(1)) {
        if (lines.length >= MAX_STACK_LINES) break;
        lines.push(clipChars(line.trim(), MAX_STACK_LINE_CHARS));
      }
    }
    if (typeof current !== "object" || current === null) break;
    const cause = (current as { cause?: unknown }).cause;
    if (cause === undefined || cause === null || cause === current) break;
    current = cause;
    depth += 1;
  }
  if (lines.length === 0) return null;
  return lines.slice(0, MAX_STACK_LINES).join("\n");
}

/** Clamp every per-row budget on an event (the ring runs this on push). */
export function sanitizeRtEvent(row: RtEvent): RtEvent {
  const stackRaw = typeof row.stack === "string" && row.stack.length > 0 ? row.stack : null;
  const stack =
    stackRaw === null
      ? null
      : stackRaw
          .split("\n")
          .slice(0, MAX_STACK_LINES)
          .map((line) => clipChars(line, MAX_STACK_LINE_CHARS))
          .join("\n");
  const out: RtEvent = {
    ...row,
    message: clipChars(String(row.message ?? ""), MAX_MESSAGE_CHARS),
    stack,
    ctx: sanitizeRecord(row.ctx),
    payload: sanitizeRecord(row.payload),
  };
  return out;
}
