// ---------------------------------------------------------------------------
// rt-ring.ts — pure bounded runtime-telemetry ring (fixes/109 §4.1).
//
// Zero-dep, deterministic, side-effect-free core: no window/fs imports, no
// Date.now() at module scope (callers pass `now` where a time is needed) —
// node:test runs it directly. Host glue (rt-client.ts) owns localStorage
// persistence, session ids and the crash snapshot; this module owns bounds,
// coalescing, redaction and the serialize/hydrate contract.
//
// Bounds (fixes/109 §4.1): 200 rows, 64 KB serialized, coalesced duplicates,
// sanitized rows (rt-events.ts budgets), heartbeat rows diverted to a
// `lastHeartbeat` sidecar (§2.5 — never persisted on their own, latest only),
// a `stall` sidecar (§5.2 tier-2 latch), and honest corrupt-blob hydration
// (never throws).
//
// EXPORT SURFACE (compile against these — do not rename):
//   createRtRing · rtPush · rtSerialize · rtHydrate · rtTail · rtStats ·
//   rtRowBytes · newSessionId · isRtEventLike (additive, fixes/309 — shared
//   row-shape predicate, diagnose.ts M3-11) ·
//   type RtRing · type StallLatch · RtRingStats
// ---------------------------------------------------------------------------

import {
  RING_BYTES,
  RING_CAP,
  RT_SCHEMA_VERSION,
  sanitizeRtEvent,
  shouldCoalesce,
  type RtEvent,
} from "./rt-events.ts";

/** §5.2 tier-2 stall latch (client ring sidecar). */
export type StallLatch = {
  projectId: string | null;
  since: number;
  stepElapsedMs: number;
  class: "step-overdue" | "mainthread-stall" | "step-timeout";
} | null;

export type RtRing = {
  /** Oldest-first event rows (bounded: cap rows + byte cap). */
  rows: RtEvent[];
  /** Session id of THIS host instance (rows carry their own sessionId). */
  sessionId: string;
  /** Latest sys.heartbeat row only (§2.5 sidecar — never in `rows`). */
  lastHeartbeat: RtEvent | null;
  /** §5.2/§5.3 stall latch sidecar (null when healthy). */
  stall: StallLatch;
  /** Last fully-failed persist write, surfaced by diagnose (§4.1 quota rule). */
  lastPersistFailure: string | null;
  /** True when rtHydrate dropped a corrupt blob (§4.1 hydration rule). */
  recoveredCorrupt: boolean;
};

export type RtRingStats = {
  rows: number;
  bytes: number;
  newestTs: number | null;
  oldestTs: number | null;
  errorCount: number;
  criticalCount: number;
  warnCount: number;
  sessionId: string;
};

/** Session id for a fresh host instance (crypto.randomUUID, timestamp fallback). */
export function newSessionId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through */
  }
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Empty ring + fresh cursors (caps apply at push time, §4.1.1). */
export function createRtRing(): RtRing {
  return {
    rows: [],
    sessionId: newSessionId(),
    lastHeartbeat: null,
    stall: null,
    lastPersistFailure: null,
    recoveredCorrupt: false,
  };
}

/** Serialized size of one row (JSON round-trip bytes). */
export function rtRowBytes(row: RtEvent): number {
  try {
    return JSON.stringify(row).length;
  } catch {
    return 0;
  }
}

function serializedRowsBytes(rows: RtEvent[]): number {
  try {
    return JSON.stringify(rows).length;
  } catch {
    return rows.reduce((n, r) => n + rtRowBytes(r), 0);
  }
}

/**
 * Push one row through the ring: sanitize → heartbeat sidecar → coalesce →
 * row cap → byte cap. Returns the new ring and any rows dropped for capacity.
 * Pure with respect to its inputs (no module state, no clock reads).
 *
 * Hostile-input guards (M3-01/02/03/04, fixes/309): a junk ring starts fresh
 * (rtHydrate's posture), a non-row is a no-op, and a junk `cap` (negative —
 * the non-terminating trim loop — or NaN — cap silently off) falls back to
 * the module default. Never throws into the code it observes (AGENTS.md §7).
 */
export function rtPush(
  ring: RtRing,
  row: RtEvent,
  opts: { cap?: number; byteCap?: number; now?: number } = {},
): { ring: RtRing; dropped: RtEvent[] } {
  // M3-04: no ring to land in (null/junk) — start a fresh one; the row still
  // lands below. Same posture as rtHydrate's junk-block recovery.
  const target = ring && typeof ring === "object" && Array.isArray(ring.rows) ? ring : createRtRing();
  // M3-01: a non-row (null/undefined/scalar/array) is not pushable — no-op.
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    return { ring: target, dropped: [] };
  }
  // M3-02/03: junk cap ⇒ treated as absent (the `??` idiom): a negative cap
  // made the trim loop non-terminating, NaN made the compare always false.
  const rawCap = opts.cap ?? RING_CAP;
  const cap = Number.isFinite(rawCap) && rawCap >= 1 ? Math.floor(rawCap) : RING_CAP;
  const byteCap = opts.byteCap ?? RING_BYTES;
  const now = opts.now ?? row.ts;
  const clean = sanitizeRtEvent(row);

  // §2.5: heartbeat rows are never persisted on their own — the ring keeps the
  // latest heartbeat only as a sidecar cursor (watchdog reads it for lag).
  if (clean.event === "sys.heartbeat") {
    return { ring: { ...target, lastHeartbeat: clean }, dropped: [] };
  }

  // §2.5 coalescing: same fingerprint within the window → count-up.
  const rows = target.rows;
  const last = rows.length > 0 ? rows[rows.length - 1] : null;
  if (last && shouldCoalesce(last, clean, now)) {
    const bumped: RtEvent = { ...last, count: (last.count ?? 1) + 1 };
    const next = { ...target, rows: [...rows.slice(0, -1), bumped] };
    return { ring: next, dropped: [] };
  }

  const nextRows = [...rows, clean];
  const dropped: RtEvent[] = [];
  // Row cap: drop oldest first.
  while (nextRows.length > cap) {
    dropped.push(nextRows.shift() as RtEvent);
  }
  // Byte cap: trim oldest until the payload fits (keep ≥ 1 row — a single
  // sanitized row is < 1 KB by construction, §4.1 budgets).
  while (nextRows.length > 1 && serializedRowsBytes(nextRows) > byteCap) {
    dropped.push(nextRows.shift() as RtEvent);
  }
  return { ring: { ...target, rows: nextRows }, dropped };
}

/**
 * Serialize the ring: {version, sessionId, rows[], lastHeartbeat, stall,
 * lastPersistFailure}. Deterministic; additive fields ignored on hydrate.
 * M3-07 (fixes/309): a junk ring serializes the empty frame (sessionId "",
 * rows []) — hydrates back to a clean empty ring; never throws (rtHydrate's
 * contract partner).
 */
export function rtSerialize(ring: RtRing): string {
  const r = ring && typeof ring === "object" ? ring : null;
  return JSON.stringify({
    version: RT_SCHEMA_VERSION,
    sessionId: typeof r?.sessionId === "string" ? r.sessionId : "",
    rows: Array.isArray(r?.rows) ? r.rows : [],
    lastHeartbeat: r?.lastHeartbeat ?? null,
    stall: r?.stall ?? null,
    lastPersistFailure: r?.lastPersistFailure ?? null,
  });
}

/**
 * Duck-type check for a well-formed row (tolerates additive/legacy fields).
 * Exported (fixes/309) as the single source of truth for "junk row" — the
 * ring's hydrate filter and diagnose.ts's errors[] filter (M3-11) share it.
 */
export function isRtEventLike(v: unknown): v is RtEvent {
  if (typeof v !== "object" || v === null || Array.isArray(v)) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.event === "string" &&
    typeof r.ts === "number" &&
    Number.isFinite(r.ts) &&
    typeof r.level === "string"
  );
}

/**
 * Hydrate a ring from a raw stored blob. Corrupt/invalid → empty ring +
 * `recoveredCorrupt: true` (caller emits hydrate.recovered_corrupt). Junk
 * rows are dropped, additive fields ignored, legacy shapes tolerated. Never
 * throws.
 */
export function rtHydrate(raw: unknown): RtRing {
  const base = createRtRing();
  if (typeof raw !== "string" || raw.length === 0) {
    return base;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...base, recoveredCorrupt: true };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ...base, recoveredCorrupt: true };
  }
  const obj = parsed as Record<string, unknown>;
  const rowsRaw = Array.isArray(obj.rows) ? (obj.rows as unknown[]) : [];
  const rows: RtEvent[] = [];
  for (const r of rowsRaw) {
    if (!isRtEventLike(r)) continue;
    rows.push(sanitizeRtEvent(r));
  }
  // M3 (W56 · 343-3): hydration re-applies the SAME bounds rtPush does. A
  // persisted blob is localStorage — user-writable, and possibly written by a
  // build with different caps — so without this trim the "200 rows / 64 KB"
  // contract held only until the next push (a tampered blob loaded unbounded
  // rows into the in-memory ring, rtStats and the diagnose panes). Oldest
  // rows drop first, exactly like the push path.
  while (rows.length > RING_CAP) rows.shift();
  while (rows.length > 1 && serializedRowsBytes(rows) > RING_BYTES) rows.shift();
  const heartbeat = isRtEventLike(obj.lastHeartbeat) ? sanitizeRtEvent(obj.lastHeartbeat as RtEvent) : null;
  const stallRaw = obj.stall;
  const STALL_CLASSES = new Set(["step-overdue", "mainthread-stall", "step-timeout"]);
  const stall: StallLatch =
    stallRaw && typeof stallRaw === "object" && !Array.isArray(stallRaw)
      ? {
          projectId:
            typeof (stallRaw as { projectId?: unknown }).projectId === "string"
              ? ((stallRaw as { projectId: string }).projectId as string)
              : null,
          since: typeof (stallRaw as { since?: unknown }).since === "number" ? (stallRaw as { since: number }).since : 0,
          stepElapsedMs:
            typeof (stallRaw as { stepElapsedMs?: unknown }).stepElapsedMs === "number"
              ? (stallRaw as { stepElapsedMs: number }).stepElapsedMs
              : 0,
          class: (() => {
            const c = (stallRaw as { class?: unknown }).class;
            return typeof c === "string" && STALL_CLASSES.has(c)
              ? (c as NonNullable<StallLatch>["class"])
              : "step-overdue";
          })(),
        }
      : null;
  return {
    rows,
    sessionId:
      typeof obj.sessionId === "string" && obj.sessionId ? obj.sessionId : base.sessionId,
    lastHeartbeat: heartbeat,
    stall,
    lastPersistFailure:
      typeof obj.lastPersistFailure === "string" ? obj.lastPersistFailure : null,
    recoveredCorrupt: false,
  };
}

/**
 * Newest-first tail of the ring (diagnose + crash snapshot).
 * M3-05 (fixes/309): a junk ring tails as [] — never throws.
 */
export function rtTail(ring: RtRing, n: number): RtEvent[] {
  const rows = ring && typeof ring === "object" && Array.isArray(ring.rows) ? ring.rows : [];
  return rows.slice(-n).reverse();
}

/**
 * Growth/health stats for the diagnose verb (§6.2 G-12).
 * M3-06 (fixes/309): a junk ring floors to the zero shape (sessionId "");
 * junk rows are skipped by the counters/ts window instead of crashing.
 */
export function rtStats(ring: RtRing): RtRingStats {
  const rows: Array<RtEvent | null> =
    ring && typeof ring === "object" && Array.isArray(ring.rows) ? ring.rows : [];
  let errorCount = 0;
  let criticalCount = 0;
  let warnCount = 0;
  let oldestTs: number | null = null;
  let newestTs: number | null = null;
  for (const r of rows) {
    if (!r || typeof r !== "object") continue; // junk row: not countable
    if (r.level === "error") errorCount += 1;
    else if (r.level === "critical") criticalCount += 1;
    else if (r.level === "warn") warnCount += 1;
    if (typeof r.ts === "number" && Number.isFinite(r.ts)) {
      if (oldestTs === null) oldestTs = r.ts;
      newestTs = r.ts;
    }
  }
  return {
    rows: rows.length,
    bytes: serializedRowsBytes(rows.filter((r): r is RtEvent => isRtEventLike(r))),
    newestTs,
    oldestTs,
    errorCount,
    criticalCount,
    warnCount,
    sessionId: ring && typeof ring === "object" && typeof ring.sessionId === "string" ? ring.sessionId : "",
  };
}
