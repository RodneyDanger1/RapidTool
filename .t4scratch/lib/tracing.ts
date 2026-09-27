// ---------------------------------------------------------------------------
// tracing.ts — pure agent-run trace model (G-40 wave-3 slice).
//
// Zero-dep, deterministic, side-effect-free span tree describing ONE agent
// run (crew turn, verify pass, research fetch, gate verdict, …). No fs, no
// Date.now(), no imports: same inputs in ⇒ byte-identical outputs out. A
// recorder (crew/engine wiring, later wave) stamps wall-clock at the CALL
// SITE and hands it to this module; this module never invents time.
//
// Why pure + in-memory (re-scope vs register G-40's NDJSON file): the hosted
// product has no server-side filesystem (feasibility review C-1), so the v1
// trace lives as data (vault note, store slice) and the file/git export is a
// later, host-scoped wave. Freezing this span SHAPE now is the register's
// "freeze v1 schema" call — done additively here (types.ts untouched).
//
// MODEL
//   AgentTrace = { runId, startedAt, spans[] } — append-only history.
//   TraceSpan  = one node { id, parentId|null, kind, label, startTs,
//                 endTs?, status, detail? }.
//   - parentId null ⇒ root span of the run; otherwise the parent's id.
//   - endTs absent ⇒ span is OPEN (in flight). endTs present ⇒ CLOSED.
//   - status: "started" (open) | "ok" | "error" | "skipped". A closed span
//     may never carry status "started" (it finished — say how).
//   - detail: flat JSON-safe scalars (model, tokensIn, verdict, …). Never
//     free text/prompt bodies — traces stay redacted by construction.
//
// INVARIANTS (recordSpan enforces; recorder bugs throw loudly):
//   1. Parents precede children (record a span only after its parent).
//   2. ids are unique. An OPEN span may be re-recorded to refresh its
//      fields or to CLOSE it (endTs + final status) — exactly once; a CLOSED
//      span is immutable history and any re-record throws.
//   3. endTs >= startTs; timestamps are finite, non-negative epoch ms.
//
// EXPORT SURFACE (compile against these — do not rename):
//   export type AgentTrace / TraceSpan / TraceSpanStatus / TraceDetail /
//                 TraceSummary
//   export function createTrace(runId, startedAt?)  — empty trace
//   export function traceSpan(id, parentId, kind, label, startTs, endTs?,
//                             status?, detail?)     — span factory
//   export function recordSpan(trace, span)         — pure append/close
//   export function spansAsText(trace)              — markdown timeline
//   export function traceSummary(trace)             — counts + window
//   export function formatDurationMs(ms)            — "842ms" | "1.23s" | "2m 5s"
// ---------------------------------------------------------------------------

/** Lifecycle status of one span. "started" = in flight (no endTs yet). */
export type TraceSpanStatus = "started" | "ok" | "error" | "skipped";

/** Flat, JSON-safe scalar detail attached to a span (never prompt bodies). */
export type TraceDetail = Record<string, string | number | boolean | null>;

/** One node of an agent-run trace (shape frozen for the v1 schema). */
export type TraceSpan = {
  id: string;
  /** null = root span of the run; otherwise the id of a previously recorded span. */
  parentId: string | null;
  /** Free-form span kind: "crew" | "llm" | "verify" | "research" | "gate" | … */
  kind: string;
  /** Human-readable one-line label of the step. */
  label: string;
  /** Epoch ms when the step started (caller-stamped). */
  startTs: number;
  /** Epoch ms when the step finished; absent = still in flight. */
  endTs?: number;
  status: TraceSpanStatus;
  /** Optional flat scalar context (model, tokens, verdict, lane, …). */
  detail?: TraceDetail;
};

/** One agent run: an append-only, parent-before-child span list. */
export type AgentTrace = {
  runId: string;
  startedAt: number;
  spans: TraceSpan[];
};

/** Aggregated view of a trace (see traceSummary). */
export type TraceSummary = {
  runId: string;
  startedAt: number;
  /** Total spans recorded. */
  spanCount: number;
  /** Spans without endTs (in flight). */
  openCount: number;
  okCount: number;
  errorCount: number;
  skippedCount: number;
  /** Spans whose status is still "started" (≡ open by the closed-span rule). */
  startedCount: number;
  /** Root spans (parentId null, or parent absent from the trace). */
  rootCount: number;
  /** Deepest nesting; 0 when the trace has no spans or only roots. */
  depth: number;
  /** Wall-clock window of the CLOSED spans (max endTs − min startTs over
   *  closed spans only — open spans have no finished duration), or null when
   *  no span is closed yet. */
  totalMs: number | null;
  /** Span count per kind, keys sorted alphabetically (deterministic). */
  kinds: Record<string, number>;
};

function isFiniteNonNegative(ts: number, what: string): void {
  if (typeof ts !== "number" || !Number.isFinite(ts) || ts < 0) {
    throw new RangeError(`tracing: ${what} must be a finite, non-negative epoch ms, got ${ts}`);
  }
}

/** The four legal span lifecycle statuses (runtime-enforced, see below). */
const TRACE_STATUSES: ReadonlySet<string> = new Set(["started", "ok", "error", "skipped"]);

function isScalarDetailValue(v: unknown): boolean {
  return v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean";
}

/** Detail payloads must be flat JSON-safe records: scalar values only, no
 *  prototype-polluting keys (spansAsText stringifies the record, and a nested
 *  or circular detail would blow up JSON.stringify at render time — recorder
 *  bugs must throw HERE, at record time, loudly). */
function assertDetail(detail: TraceDetail, spanId: string): void {
  if (detail === null || typeof detail !== "object" || Array.isArray(detail)) {
    throw new RangeError(`tracing: span ${spanId} detail must be a flat object of JSON scalars`);
  }
  for (const key of Object.keys(detail)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new RangeError(`tracing: span ${spanId} detail key "${key}" is not allowed (prototype pollution)`);
    }
    if (!isScalarDetailValue(detail[key])) {
      throw new RangeError(
        `tracing: span ${spanId} detail "${key}" must be a flat JSON scalar (string | number | boolean | null), got ${typeof detail[key]}`,
      );
    }
  }
}

/**
 * Full shape validation at the record chokepoint. TraceSpan is an exported
 * type, so recorders can hand-build spans that never passed traceSpan's
 * factory checks — junk kind/label/status/detail shapes would otherwise
 * poison spansAsText/traceSummary at render time (non-string .replace(),
 * circular-detail JSON.stringify). Every invariant the factory enforces is
 * enforced here too, and then some: recorder bugs throw loudly, at record
 * time, with the span id in the message.
 */
function assertSpanShape(span: TraceSpan): void {
  if (typeof span.id !== "string" || span.id.trim() === "") {
    throw new RangeError(`tracing: span id is required, got ${JSON.stringify(span.id)}`);
  }
  if (span.parentId !== null && typeof span.parentId !== "string") {
    throw new RangeError(`tracing: span ${span.id} parentId must be a string or null, got ${typeof span.parentId}`);
  }
  if (typeof span.kind !== "string") {
    throw new RangeError(`tracing: span ${span.id} kind must be a string, got ${typeof span.kind}`);
  }
  if (typeof span.label !== "string") {
    throw new RangeError(`tracing: span ${span.id} label must be a string, got ${typeof span.label}`);
  }
  if (!TRACE_STATUSES.has(span.status)) {
    throw new RangeError(
      `tracing: span ${span.id} status must be one of started | ok | error | skipped, got ${JSON.stringify(span.status)}`,
    );
  }
  if (span.detail !== undefined) assertDetail(span.detail, span.id);
  // Timestamp invariants live HERE (not only in the traceSpan factory) so the
  // FRESH-APPEND path of recordSpan validates them too — a hand-built span
  // that never passed the factory (Infinity/NaN startTs, endTs before
  // startTs, or a closed span still marked "started") must throw at record
  // time instead of poisoning traceSummary/spansAsText with NaN/Infinity
  // durations later.
  if (typeof span.startTs !== "number" || !Number.isFinite(span.startTs) || span.startTs < 0) {
    throw new RangeError(
      `tracing: span ${span.id} startTs must be a finite, non-negative epoch ms, got ${JSON.stringify(span.startTs)}`,
    );
  }
  if (span.endTs !== undefined) {
    if (typeof span.endTs !== "number" || !Number.isFinite(span.endTs) || span.endTs < 0) {
      throw new RangeError(
        `tracing: span ${span.id} endTs must be a finite, non-negative epoch ms, got ${JSON.stringify(span.endTs)}`,
      );
    }
    if (span.endTs < span.startTs) {
      throw new RangeError(`tracing: span ${span.id} ends before it starts (${span.endTs} < ${span.startTs})`);
    }
    if (span.status === "started") {
      throw new RangeError(
        `tracing: span ${span.id} would close with status "started" — use ok | error | skipped`,
      );
    }
  }
}

/** Collapse whitespace to single spaces (labels/detail must stay one line). */
function singleLine(text: string, cap: number): string {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > cap ? `${t.slice(0, cap).trimEnd()}…` : t;
}

/** Deterministic compact JSON of a flat detail: keys sorted, backticks/whitespace
 *  neutralized so the payload stays inside one markdown code span. */
function jsonDetail(detail: TraceDetail): string {
  const ordered: TraceDetail = {};
  for (const k of Object.keys(detail).sort()) ordered[k] = detail[k];
  return singleLine(JSON.stringify(ordered), 240).replace(/`/g, "'");
}

/**
 * One closed/open span duration in compact human units:
 *   < 1s ⇒ "842ms"; < 60s ⇒ "1.23s" (2 decimals); ≥ 60s ⇒ "2m 5s".
 * Deterministic and pure (no i18n/locale formatting).
 */
export function formatDurationMs(ms: number): string {
  if (typeof ms !== "number" || !Number.isFinite(ms)) {
    throw new RangeError(`tracing: duration must be a finite number of ms, got ${ms}`);
  }
  const v = Math.max(0, ms);
  if (v < 1000) return `${Math.round(v)}ms`;
  if (v < 60_000) return `${(Math.round((v / 1000) * 100) / 100).toFixed(2)}s`;
  const m = Math.floor(v / 60_000);
  const s = Math.round((v % 60_000) / 1000);
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

/** An empty trace for a run id (startedAt defaults to 0 — stamp your own clock
 *  at the call site; this module never calls Date.now()). */
export function createTrace(runId: string, startedAt = 0): AgentTrace {
  if (typeof runId !== "string" || runId.trim() === "") {
    throw new RangeError("tracing: runId is required (empty traces are anonymous)");
  }
  isFiniteNonNegative(startedAt, "startedAt");
  return { runId, startedAt, spans: [] };
}

/**
 * Span factory. Defaults: status "started" when the span is open
 * (no endTs), "ok" when already closed — pass an explicit status for
 * error/skipped/closed-started never happens (guarded).
 */
export function traceSpan(
  id: string,
  parentId: string | null,
  kind: string,
  label: string,
  startTs: number,
  endTs?: number,
  status?: TraceSpanStatus,
  detail?: TraceDetail,
): TraceSpan {
  if (typeof id !== "string" || id.trim() === "") {
    throw new RangeError(`tracing: span id is required, got ${JSON.stringify(id)}`);
  }
  isFiniteNonNegative(startTs, `startTs of span ${id}`);
  const resolved: TraceSpanStatus =
    status ?? (endTs === undefined ? "started" : "ok");
  if (!TRACE_STATUSES.has(resolved)) {
    throw new RangeError(
      `tracing: span ${id} status must be one of started | ok | error | skipped, got ${JSON.stringify(resolved)}`,
    );
  }
  if (typeof kind !== "string") {
    throw new RangeError(`tracing: span ${id} kind must be a string, got ${typeof kind}`);
  }
  if (typeof label !== "string") {
    throw new RangeError(`tracing: span ${id} label must be a string, got ${typeof label}`);
  }
  if (parentId !== null && typeof parentId !== "string") {
    throw new RangeError(`tracing: span ${id} parentId must be a string or null, got ${typeof parentId}`);
  }
  if (detail !== undefined) assertDetail(detail, id);
  if (endTs !== undefined) {
    isFiniteNonNegative(endTs, `endTs of span ${id}`);
    if (endTs < startTs) {
      throw new RangeError(`tracing: span ${id} ends before it starts (${endTs} < ${startTs})`);
    }
    if (resolved === "started") {
      throw new RangeError(
        `tracing: span ${id} is closed but status "started" — use ok | error | skipped`,
      );
    }
  }
  const span: TraceSpan = {
    id,
    parentId,
    kind,
    label,
    startTs,
    status: resolved,
  };
  if (endTs !== undefined) span.endTs = endTs;
  if (detail !== undefined) span.detail = detail;
  return span;
}

/**
 * Pure append/close. Returns a NEW AgentTrace; the input is never mutated.
 *  - Unknown id, valid parent ⇒ appended (parent must already exist — spans
 *    are recorded top-down).
 *  - Open id re-recorded ⇒ refresh: the incoming span's defined fields win.
 *    The first record that carries an endTs CLOSES the span (final status).
 *  - Closed id re-recorded ⇒ throws: history is immutable.
 */
export function recordSpan(trace: AgentTrace, span: TraceSpan): AgentTrace {
  // Re-validate the incoming span at the chokepoint: TraceSpan is an exported
  // type, so a recorder can hand-build spans that never passed traceSpan's
  // factory checks (NaN/Infinity timestamps, endTs before startTs, a closed
  // span still marked "started", junk kind/label/status/detail shapes).
  // Every invariant the factory enforces is enforced here too — recorder
  // bugs throw loudly instead of poisoning summaries/timelines with
  // NaN/Infinity durations or crashing the pure renderers later.
  assertSpanShape(span);
  if (span.parentId !== null) {
    const parentKnown = trace.spans.some((s) => s.id === span.parentId);
    if (!parentKnown) {
      throw new RangeError(
        `tracing: span ${span.id} recorded before its parent ${span.parentId} ` +
          "(record top-down: parents first)",
      );
    }
  }
  const idx = trace.spans.findIndex((s) => s.id === span.id);
  if (idx === -1) {
    // Fresh append: any status is accepted. "error"/"skipped" WITHOUT an
    // endTs is meaningful (a step that died or never ran) — the summary
    // counts the status and the timeline marks it "in flight".
    return { ...trace, spans: [...trace.spans, span] };
  }
  const existing = trace.spans[idx]!;
  if (existing.endTs !== undefined) {
    throw new RangeError(
      `tracing: span ${span.id} is already closed (endTs ${existing.endTs}) — ` +
        "closed spans are immutable history",
    );
  }
  const merged: TraceSpan = { ...existing, ...span };
  if (merged.endTs !== undefined) {
    if (merged.endTs < merged.startTs) {
      throw new RangeError(
        `tracing: span ${span.id} ends before it starts (${merged.endTs} < ${merged.startTs})`,
      );
    }
    if (merged.status === "started") {
      throw new RangeError(
        `tracing: span ${span.id} would close with status "started" — use ok | error | skipped`,
      );
    }
  }
  const next = trace.spans.slice();
  next[idx] = merged;
  return { ...trace, spans: next };
}

/**
 * Markdown timeline of the trace: one bullet per span, indented two spaces
 * per depth level so the vault/UI shows the parent→child shape. Rows are
 * ordered chronologically by startTs (ties keep recorded order — stable
 * sort); a span whose parent is missing from the trace renders as a root
 * (defensive — recordSpan already forbids that). Open spans show
 * "— in flight"; closed spans show their duration; a non-empty flat detail
 * rides at the end of the row as a code span (keys sorted).
 */
export function spansAsText(trace: AgentTrace): string {
  if (trace.spans.length === 0) return "_no spans recorded_";
  const depthById = new Map<string, number>();
  for (const s of trace.spans) {
    let depth = 0;
    if (s.parentId !== null) {
      const parentDepth = depthById.get(s.parentId);
      depth = parentDepth === undefined ? 0 : parentDepth + 1;
    }
    depthById.set(s.id, depth);
  }
  const rows = [...trace.spans]
    .sort((a, b) => a.startTs - b.startTs) // stable: equal startTs keep recorded order
    .map((s) => {
      const depth = depthById.get(s.id) ?? 0;
      const idText = s.id.replace(/`/g, "").trim() || "?";
      const kindText = singleLine(s.kind, 40);
      const labelText = singleLine(s.label, 160) || "(unnamed)";
      const tail =
        s.endTs === undefined
          ? " — in flight"
          : ` — ${formatDurationMs(s.endTs - s.startTs)}`;
      const detail =
        s.detail && Object.keys(s.detail).length > 0
          ? ` — \`${jsonDetail(s.detail)}\``
          : "";
      return (
        `${"  ".repeat(depth)}- [${s.status}] \`${idText}\` **${kindText}** · ` +
        `${labelText}${tail}${detail}`
      );
    });
  return rows.join("\n");
}

/**
 * Deterministic aggregate of one trace: status/open counts, root count,
 * max nesting depth, per-kind counts (sorted keys), and the wall-clock
 * window of the closed spans (totalMs null while nothing is closed).
 */
export function traceSummary(trace: AgentTrace): TraceSummary {
  const byStatus: Record<TraceSpanStatus, number> = {
    started: 0,
    ok: 0,
    error: 0,
    skipped: 0,
  };
  const kinds = new Map<string, number>();
  const depthById = new Map<string, number>();
  let openCount = 0;
  let rootCount = 0;
  let depth = 0;
  let minStart = Number.POSITIVE_INFINITY;
  let maxEnd = Number.NEGATIVE_INFINITY;
  for (const s of trace.spans) {
    byStatus[s.status] += 1;
    kinds.set(s.kind, (kinds.get(s.kind) ?? 0) + 1);
    if (s.endTs === undefined) {
      openCount += 1;
    } else {
      // The window is measured over CLOSED spans only: open spans have no
      // finished duration, so their start must not stretch the total.
      if (s.endTs > maxEnd) maxEnd = s.endTs;
      if (s.startTs < minStart) minStart = s.startTs;
    }
    let d = 0;
    if (s.parentId !== null) {
      const pd = depthById.get(s.parentId);
      d = pd === undefined ? 0 : pd + 1;
      if (d === 0) rootCount += 1; // unknown parent: orphan treated as root
    } else {
      rootCount += 1;
    }
    depthById.set(s.id, d);
    if (d > depth) depth = d;
  }
  const sortedKinds: Record<string, number> = {};
  for (const k of [...kinds.keys()].sort()) sortedKinds[k] = kinds.get(k)!;
  return {
    runId: trace.runId,
    startedAt: trace.startedAt,
    spanCount: trace.spans.length,
    openCount,
    okCount: byStatus.ok,
    errorCount: byStatus.error,
    skippedCount: byStatus.skipped,
    startedCount: byStatus.started,
    rootCount,
    depth,
    totalMs:
      trace.spans.length === 0 || maxEnd === Number.NEGATIVE_INFINITY
        ? null
        : Math.max(0, maxEnd - minStart),
    kinds: sortedKinds,
  };
}
