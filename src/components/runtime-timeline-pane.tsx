// ---------------------------------------------------------------------------
// runtime-timeline-pane.tsx — typed timeline sibling for the Runtime log tab
// (216m · 111 TASK-11 wiring, landed W4 · L4).
//
// Why: the Runtime tab's raw ring list is a tail — a start row and its finish
// are two unrelated lines. `src/lib/rt-timeline.ts` (GREEN, W3) is the missing
// view model: it pairs `*_start`/`*.start` with their terminals (`ok`/`ready`/
// `ran`/`done`/`error`/…), stamps `durationMs` on both sides and never invents
// a duration when a `ts` is missing. This component renders that model.
//
// Source of truth: the SAME bounded client ring `RuntimeLogPane` reads
// (`rtSnapshot()` → `RtEvent[]`). The rows are re-serialized to NDJSON lines —
// `JSON.stringify(row)` is exactly the schema the CLI/server append under
// `<dir>/.rapidtool/logs/` — and handed to `parseTimeline`, so the typed view
// and the on-disk log parse through one code path.
//
// ADDITIVE by contract (111 TASK-11):
//   · `RuntimeLogPane` + its `Tabs.Content value="runtime"` render byte-identically;
//     this pane is a new SIBLING mounted after it (console.tsx).
//   · Progressive disclosure: collapsed by default (a one-line honest summary),
//     expanded shows the typed rows. The raw ring list above stays the default
//     view, and the exact NDJSON this pane parsed is reachable in a disclosure
//     plus a one-click "Copy raw NDJSON".
//
// Honesty rules restated for the UI: an unclosed start renders "still running —
// no finish in the ring yet" (never a fabricated duration); a terminal with no
// matching start renders "no matching start"; a degraded line renders its raw
// text verbatim and is counted as "unparsed".
// ---------------------------------------------------------------------------

import { useEffect, useMemo, useState } from "react";
import { rtSnapshot } from "@/lib/rt-client.ts";
import { parseTimeline, summarizeTimeline, type TimelineRow } from "@/lib/rt-timeline.ts";

/** Locale-independent clock for a row ts (deterministic — no hydration drift). */
function clockLabel(ts: number | null): string {
  return ts === null ? "--:--:--" : new Date(ts).toISOString().slice(11, 23);
}

/** Human duration; never called with null (callers check `durationMs`). */
function durationLabel(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}

/** Status chip word + tone per row. "still running" is a distinct honest state. */
function statusMeta(row: TimelineRow): { word: string; tone: string } {
  switch (row.status) {
    case "started":
      return row.closedBy === null
        ? { word: "still running", tone: "text-warn" }
        : { word: "started", tone: "text-fg" };
    case "ok":
      return { word: "completed", tone: "text-ok" };
    case "failed":
      return { word: "failed", tone: "text-danger" };
    case "paused":
      return { word: "paused", tone: "text-warn" };
    case "instant":
      return { word: "event", tone: "text-muted" };
    case "raw":
      return { word: "unparsed", tone: "text-faint" };
  }
}

/** Pair provenance for a row: what it closed/was closed by, and its duration. */
function pairLabel(row: TimelineRow): string | null {
  const dur = row.durationMs !== null ? ` · ${durationLabel(row.durationMs)}` : "";
  if (row.status === "started") {
    return row.closedBy === null
      ? "no finish in the ring yet"
      : `paired with L${row.closedBy}${dur}`;
  }
  if (row.status === "raw") return null;
  return row.closes === null ? "no matching start" : `closes start L${row.closes}${dur}`;
}

/**
 * Typed timeline pane. No props: like `RuntimeLogPane` it reads the page-level
 * client ring (the ring is per page-load, not per project).
 */
export function RuntimeTimelinePane() {
  const [snap, setSnap] = useState(() => rtSnapshot());
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  // Same bounded 2 s poll as the raw pane — the ring is tiny; cost is negligible.
  useEffect(() => {
    const id = setInterval(() => setSnap(rtSnapshot()), 2000);
    return () => clearInterval(id);
  }, []);

  // Re-serialize the ring rows to the exact NDJSON shape the CLI appends, then
  // parse through the module's single code path (no duplicated pairing logic).
  const lines = useMemo(() => snap.tail.map((row) => JSON.stringify(row)), [snap.tail]);
  const rows = useMemo(() => parseTimeline(lines), [lines]);
  const summary = useMemo(() => summarizeTimeline(rows), [rows]);

  function flashCopied() {
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function copyRaw() {
    setCopyError(null);
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      flashCopied();
    } catch {
      // Same failure contract as the other copy actions: say so, never pretend.
      setCopyError("Clipboard blocked — select the raw NDJSON in the disclosure below instead.");
    }
  }

  const paired = rows.filter((r) => r.durationMs !== null).length;

  return (
    <section className="border-t border-line px-5 py-3 text-sm" aria-label="Typed timeline">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="rt-timeline-body"
          className="rounded-md border border-line px-3 py-1.5 text-xs text-fg transition-colors hover:border-accent/50"
        >
          {open ? "Hide typed timeline" : "Typed timeline — pair starts with finishes"}
        </button>
        <p className="font-mono text-[11px] text-faint">
          {summary.rows} row{summary.rows === 1 ? "" : "s"} · {paired} paired ·{" "}
          {summary.openSpans} still running · {summary.raw} unparsed
        </p>
      </div>

      {open ? (
        <div id="rt-timeline-body" className="mt-3 rounded-md border border-line bg-black/20 p-3">
          <p className="font-mono text-[11px] text-muted">
            rows {summary.rows} · completed {summary.ok} · failed {summary.failed} · paused{" "}
            {summary.paused} · events {summary.instant} · unparsed {summary.raw} · still running{" "}
            {summary.openSpans}
            {summary.longestMs !== null ? ` · longest span ${durationLabel(summary.longestMs)}` : ""}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-faint">
            Derived from the ring rows above by <span className="font-mono">rt-timeline.ts</span> —
            the same NDJSON the CLI writes under{" "}
            <span className="font-mono">&lt;dir&gt;/.rapidtool/logs/</span>. The raw ring list stays
            above, unchanged.
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void copyRaw()}
              className="rounded-md border border-line px-2.5 py-1 text-xs text-fg transition-colors hover:border-accent/50"
            >
              {copied ? "Copied" : "Copy raw NDJSON"}
            </button>
            {copyError !== null ? <span className="text-xs text-danger">{copyError}</span> : null}
          </div>

          {rows.length === 0 ? (
            <p className="mt-3 rounded-md border border-dashed border-line px-4 py-4 text-center text-xs text-muted">
              No ring rows to type yet — honest silence, same as the raw view above.
            </p>
          ) : (
            <ol className="scroll-thin mt-3 max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
              {rows.map((r) => {
                const meta = statusMeta(r);
                const pair = pairLabel(r);
                return (
                  <li
                    key={`${r.line}-${r.event ?? "raw"}`}
                    className="rounded-md border border-line bg-black/20 px-3 py-2"
                  >
                    <span className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                      <span className="text-faint tabular-nums">L{r.line}</span>
                      <span className="text-faint tabular-nums">{clockLabel(r.ts)}</span>
                      <span className={meta.tone}>{meta.word}</span>
                      <span className="text-fg">{r.event ?? "(unparsed line)"}</span>
                      {r.code !== null ? <span className="text-accent">{r.code}</span> : null}
                      {!r.known && r.event !== null ? (
                        <span className="text-faint">not in the event catalogue</span>
                      ) : null}
                      {pair !== null ? <span className="ml-auto text-faint">{pair}</span> : null}
                    </span>
                    {r.status === "raw" ? (
                      <pre className="mt-1 overflow-x-auto whitespace-pre-wrap break-words font-mono text-[11px] text-faint">
                        {r.raw}
                      </pre>
                    ) : r.message.length > 0 ? (
                      <span className="mt-0.5 block break-words text-xs text-fg/90">{r.message}</span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}

          <details className="mt-3">
            <summary className="cursor-pointer font-mono text-[11px] text-muted">
              Raw NDJSON — the exact {lines.length} line{lines.length === 1 ? "" : "s"} parsed
            </summary>
            <pre className="mt-2 max-h-64 overflow-auto rounded-md border border-line bg-black/30 p-2 font-mono text-[10px] leading-relaxed text-muted">
              {lines.join("\n")}
            </pre>
          </details>
        </div>
      ) : null}
    </section>
  );
}
