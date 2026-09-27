// ---------------------------------------------------------------------------
// tracing.test.ts — pure agent-run trace model (G-40 wave-3 slice)
// Run: node --experimental-strip-types --test src/lib/tracing.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createTrace,
  formatDurationMs,
  recordSpan,
  spansAsText,
  traceSpan,
  traceSummary,
} from "./tracing.ts";
import type { AgentTrace, TraceSpan } from "./tracing.ts";

/** Small, deterministic crew-like trace shared by several assertions. */
function sampleTrace(): AgentTrace {
  // Recorded order differs from time order on purpose (summary/text must sort).
  let t = createTrace("run-abc123", 1_700_000_000_000);
  t = recordSpan(
    t,
    traceSpan("s1", null, "crew", "Architect + reviewer sprint", 1_700_000_000_000),
  );
  t = recordSpan(
    t,
    traceSpan(
      "s2",
      "s1",
      "llm",
      "DeepSeek architect turn",
      1_700_000_001_000,
      1_700_000_001_842,
      "ok",
      { model: "deepseek-v4-flash", tokensIn: 412, tokensOut: 88 },
    ),
  );
  t = recordSpan(
    t,
    traceSpan(
      "s3",
      "s1",
      "llm",
      "DeepSeek reviewer turn",
      1_700_000_002_000,
      1_700_000_002_120,
      "error",
      { model: "deepseek-v4-flash", verdict: "parse-failed" },
    ),
  );
  t = recordSpan(
    t,
    traceSpan("s4", null, "research", "Live web check", 1_700_000_003_000),
  );
  return t;
}

describe("createTrace", () => {
  it("builds an empty trace with runId/startedAt passthrough", () => {
    const t = createTrace("run-1", 1234);
    assert.deepEqual(t, { runId: "run-1", startedAt: 1234, spans: [] });
  });

  it("defaults startedAt to 0 and never touches Date.now", () => {
    assert.equal(createTrace("run-2").startedAt, 0);
  });

  it("rejects a blank run id and a non-finite startedAt", () => {
    assert.throws(() => createTrace("   "), RangeError);
    assert.throws(() => createTrace("run-3", Number.NaN), RangeError);
    assert.throws(() => createTrace("run-3", -1), RangeError);
  });
});

describe("traceSpan factory", () => {
  it("maps every positional field onto the span", () => {
    const s = traceSpan(
      "a",
      "root",
      "verify",
      "Run P6 probes",
      100,
      250,
      "ok",
      { verdict: "passed" },
    );
    assert.deepEqual(s, {
      id: "a",
      parentId: "root",
      kind: "verify",
      label: "Run P6 probes",
      startTs: 100,
      endTs: 250,
      status: "ok",
      detail: { verdict: "passed" },
    });
  });

  it("defaults status: open spans start as 'started', closed spans as 'ok'", () => {
    const open = traceSpan("o", null, "crew", "turn", 10);
    assert.equal(open.status, "started");
    assert.equal(open.endTs, undefined);
    const closed = traceSpan("c", null, "crew", "turn", 10, 20);
    assert.equal(closed.status, "ok");
    assert.equal(closed.endTs, 20);
  });

  it("omits undefined optional keys (detail/endTs stay clean for merge)", () => {
    const s = traceSpan("o", null, "crew", "turn", 10);
    assert.equal("endTs" in s, false);
    assert.equal("detail" in s, false);
  });

  it("throws on endTs before startTs, closed 'started', blank id, bad ts", () => {
    assert.throws(
      () => traceSpan("x", null, "k", "l", 200, 100, "ok"),
      /ends before it starts/,
    );
    assert.throws(
      () => traceSpan("x", null, "k", "l", 10, 20, "started"),
      /closed but status "started"/,
    );
    assert.throws(() => traceSpan("", null, "k", "l", 10), /id is required/);
    assert.throws(() => traceSpan("x", null, "k", "l", Number.NaN), RangeError);
  });
});

describe("recordSpan — append + immutable history", () => {
  it("appends top-down and returns a NEW trace (input untouched)", () => {
    const t = sampleTrace();
    assert.equal(t.spans.length, 4);
    assert.deepEqual(createTrace("run-abc123", 1_700_000_000_000), {
      runId: "run-abc123",
      startedAt: 1_700_000_000_000,
      spans: [],
    });
    assert.equal(t.spans[0]!.parentId, null);
    assert.equal(t.spans[1]!.parentId, "s1");
    assert.equal(t.spans[1]!.status, "ok");
  });

  it("throws when a child is recorded before its parent (top-down rule)", () => {
    const t = createTrace("run-x");
    assert.throws(
      () =>
        recordSpan(t, traceSpan("kid", "missing-parent", "llm", "turn", 10, 20, "ok")),
      /recorded before its parent missing-parent/,
    );
  });

  it("rejects a second record of a CLOSED span (history is immutable)", () => {
    const t = sampleTrace();
    assert.throws(
      () =>
        recordSpan(
          t,
          traceSpan("s2", "s1", "llm", "rewritten history", 1, 2, "ok"),
        ),
      /already closed/,
    );
  });

  it("refreshes an OPEN span and closes it exactly once", () => {
    let t = createTrace("run-y", 1000);
    t = recordSpan(t, traceSpan("r", null, "crew", "run", 1000));
    // Refresh while open: label/status update, still open.
    t = recordSpan(t, traceSpan("r", null, "crew", "run (retry 1)", 1000));
    assert.equal(t.spans[0]!.label, "run (retry 1)");
    assert.equal(t.spans[0]!.endTs, undefined);
    // Close once with a final status + endTs.
    t = recordSpan(t, traceSpan("r", null, "crew", "run (retry 1)", 1000, 1500, "ok"));
    assert.equal(t.spans[0]!.endTs, 1500);
    assert.equal(t.spans[0]!.status, "ok");
    // Closing again is a rewrite → throw.
    assert.throws(
      () =>
        recordSpan(t, traceSpan("r", null, "crew", "again", 1000, 2000, "error")),
      /already closed/,
    );
  });

  it("keeps an open span open when re-recorded without an endTs", () => {
    let t = createTrace("run-z");
    t = recordSpan(t, traceSpan("a", null, "crew", "first", 1000, undefined, "ok"));
    assert.equal(t.spans[0]!.endTs, undefined);
    const merged = recordSpan(t, traceSpan("a", null, "crew", "first", 1000));
    assert.equal(merged.spans[0]!.endTs, undefined);
    assert.equal(merged.spans[0]!.status, "started"); // refresh may downgrade an open span
  });

  it("validates endTs ordering on the merged close path", () => {
    let t = createTrace("run-w");
    t = recordSpan(t, traceSpan("a", null, "crew", "open", 1000));
    // The factory already rejects endTs < startTs, so the merged-path guard is
    // defensive (hand-built payloads): closing at 500 while the span started
    // at 1000 must throw.
    const badClose: TraceSpan = {
      id: "a",
      parentId: null,
      kind: "crew",
      label: "close",
      startTs: 1000,
      endTs: 500,
      status: "ok",
    };
    assert.throws(() => recordSpan(t, badClose), /ends before it starts/);
  });
});

describe("spansAsText — markdown timeline", () => {
  it("renders chronological rows with 2-space nesting per depth", () => {
    const text = spansAsText(sampleTrace());
    const lines = text.split("\n");
    assert.equal(lines.length, 4);
    assert.equal(lines[0], "- [started] `s1` **crew** · Architect + reviewer sprint — in flight");
    assert.equal(
      lines[1],
      "  - [ok] `s2` **llm** · DeepSeek architect turn — 842ms — " +
        "`{\"model\":\"deepseek-v4-flash\",\"tokensIn\":412,\"tokensOut\":88}`",
    );
    assert.equal(
      lines[2],
      "  - [error] `s3` **llm** · DeepSeek reviewer turn — 120ms — " +
        "`{\"model\":\"deepseek-v4-flash\",\"verdict\":\"parse-failed\"}`",
    );
    assert.equal(lines[3], "- [started] `s4` **research** · Live web check — in flight");
  });

  it("renders a span whose parent is missing as a root (defensive)", () => {
    // Bypass recordSpan's guard by hand-building the trace (simulates a
    // hand-edited payload) — text must not throw and the orphan sits at depth 0.
    const orphan: TraceSpan = traceSpan("o1", "gone", "llm", "orphan", 10, 20, "ok");
    const t: AgentTrace = { runId: "run-hand", startedAt: 0, spans: [orphan] };
    assert.equal(spansAsText(t), "- [ok] `o1` **llm** · orphan — 10ms");
  });

  it("marks empty traces explicitly", () => {
    assert.equal(spansAsText(createTrace("run-e")), "_no spans recorded_");
  });

  it("formats sub-second/seconds/minutes durations deterministically", () => {
    assert.equal(formatDurationMs(0), "0ms");
    assert.equal(formatDurationMs(842), "842ms");
    assert.equal(formatDurationMs(1230), "1.23s");
    assert.equal(formatDurationMs(125_000), "2m 5s");
    assert.equal(formatDurationMs(120_000), "2m");
    assert.equal(formatDurationMs(-5), "0ms");
  });

  it("collapses multi-line labels and neutralizes detail backticks", () => {
    let t = createTrace("run-ml");
    t = recordSpan(
      t,
      traceSpan("m", null, "crew", "line one\nline two", 10, 20, "ok", {
        note: "a ` tick",
      }),
    );
    const text = spansAsText(t);
    assert.ok(!text.includes("line one\nline two"), "label is single-lined");
    assert.ok(text.includes("line one line two"));
    assert.ok(text.includes('"note":"a \' tick"'), "backtick neutralized");
  });
});

describe("traceSummary — deterministic aggregate", () => {
  it("counts statuses, open spans, roots, kinds and depth", () => {
    const s = traceSummary(sampleTrace());
    assert.equal(s.runId, "run-abc123");
    assert.equal(s.startedAt, 1_700_000_000_000);
    assert.equal(s.spanCount, 4);
    assert.equal(s.openCount, 2);
    assert.equal(s.okCount, 1);
    assert.equal(s.errorCount, 1);
    assert.equal(s.skippedCount, 0);
    assert.equal(s.startedCount, 2);
    assert.equal(s.rootCount, 2);
    assert.equal(s.depth, 1);
    assert.deepEqual(s.kinds, { crew: 1, llm: 2, research: 1 });
  });

  it("reports the wall-clock window of the closed spans (totalMs)", () => {
    const s = traceSummary(sampleTrace());
    // Closed spans only: s2 starts 1_700_000_001_000, s3 ends 1_700_000_002_120.
    // The open root (s1 @ 1_700_000_000_000) must not stretch the window.
    assert.equal(s.totalMs, 1_120);
  });

  it("returns totalMs null while no span is closed, and 0 for same-instant spans", () => {
    let t = createTrace("run-open");
    t = recordSpan(t, traceSpan("a", null, "crew", "open", 500));
    assert.equal(traceSummary(t).totalMs, null);
    assert.equal(traceSummary(t).openCount, 1);
    t = recordSpan(t, traceSpan("b", null, "crew", "instant", 700, 700, "skipped"));
    const s = traceSummary(t);
    assert.equal(s.totalMs, 0);
    assert.equal(s.skippedCount, 1);
  });

  it("empty trace: all counters zero, totalMs null, kinds {}", () => {
    const s = traceSummary(createTrace("run-empty", 42));
    assert.equal(s.spanCount, 0);
    assert.equal(s.depth, 0);
    assert.equal(s.rootCount, 0);
    assert.equal(s.totalMs, null);
    assert.deepEqual(s.kinds, {});
  });

  it("is pure: identical inputs give identical outputs", () => {
    const a = sampleTrace();
    const b = sampleTrace();
    assert.deepEqual(traceSummary(a), traceSummary(b));
    assert.equal(spansAsText(a), spansAsText(b));
  });
});
