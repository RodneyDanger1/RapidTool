import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { RT_EVENT_NAMES, isKnownRtEvent } from "./rt-events.ts";
import {
  parseTimeline,
  rtEventTailStatus,
  splitRtEventName,
  summarizeTimeline,
  type TimelineRow,
} from "./rt-timeline.ts";

/**
 * 216m · 111 TASK-11 — pins for the timeline parser.
 *
 * The parser is the only place in this wave that touches external data (NDJSON
 * written by another host), so per 111 §TASK-11 its done-when is a *totality*
 * proof: every malformed or unknown line degrades to a raw row instead of
 * throwing (the repo's telemetry rule — "must never throw into the code it
 * observes"). These tests plant each degradation class, the two real pairing
 * families from the catalogue, and the honest-absence cases (no `ts` ⇒ no
 * duration; unclosed start ⇒ no fabricated end).
 */

/** One RtEvent-shaped NDJSON line (the shape runtime-log.server.ts appends). */
function eventLine(obj: Record<string, unknown>): string {
  return JSON.stringify({
    schema_version: 1,
    level: "info",
    host: "cli",
    sessionId: "s1",
    scope: "wild-step",
    capture: "engine.ts:1",
    message: "m",
    ...obj,
  });
}

describe("rt-timeline — event-name classification", () => {
  it("splits on the last underscore, falling back to the last dot", () => {
    assert.deepEqual(splitRtEventName("wild.step_start"), { stem: "wild.step", tail: "start" });
    assert.deepEqual(splitRtEventName("wild.step_ok"), { stem: "wild.step", tail: "ok" });
    assert.deepEqual(splitRtEventName("boot.start"), { stem: "boot", tail: "start" });
    assert.deepEqual(splitRtEventName("boot.ready"), { stem: "boot", tail: "ready" });
    assert.deepEqual(splitRtEventName("sys.heartbeat"), { stem: "sys", tail: "heartbeat" });
    assert.deepEqual(splitRtEventName("bare"), { stem: "bare", tail: "bare" });
  });

  it("maps tails to start/finish/pause/instant, case-insensitively", () => {
    assert.equal(rtEventTailStatus("start"), "started");
    for (const ok of ["ok", "ready", "ran", "done"]) assert.equal(rtEventTailStatus(ok), "ok");
    for (const bad of ["error", "timeout", "failed", "refused", "stall"]) {
      assert.equal(rtEventTailStatus(bad), "failed");
    }
    assert.equal(rtEventTailStatus("paused"), "paused");
    assert.equal(rtEventTailStatus("START"), "started");
    assert.equal(rtEventTailStatus("heartbeat"), "instant");
    assert.equal(rtEventTailStatus(""), "instant");
  });

  it("the rule fits the real catalogue: every `_start` family has a terminal tail", () => {
    const events = Object.keys(RT_EVENT_NAMES);
    const families = events.filter((e) => splitRtEventName(e).tail === "start");
    assert.ok(families.length > 0, "the catalogue has at least one start family");
    for (const start of families) {
      const { stem } = splitRtEventName(start);
      const closers = events.filter((e) => {
        const parts = splitRtEventName(e);
        return parts.stem === stem && ["ok", "ready", "ran", "done", "error", "timeout", "failed", "paused"].includes(parts.tail);
      });
      assert.ok(closers.length > 0, `${start} has no catalogue event that could close it`);
    }
  });
});

describe("rt-timeline — start/finish pairing", () => {
  it("pairs wild.step_start with wild.step_ok and states the duration on both rows", () => {
    const rows = parseTimeline([
      eventLine({ event: "wild.step_start", ts: 1000, message: "step P5" }),
      eventLine({ event: "wild.step_ok", ts: 1250, message: "step P5 done" }),
    ]);
    assert.equal(rows.length, 2);
    const [start, end] = rows;
    assert.equal(start.status, "started");
    assert.equal(start.closedBy, 2);
    assert.equal(start.durationMs, 250);
    assert.equal(end.status, "ok");
    assert.equal(end.closes, 1);
    assert.equal(end.durationMs, 250);
  });

  it("pairs the dotted family boot.start → boot.ready", () => {
    const rows = parseTimeline([
      eventLine({ event: "boot.start", scope: "boot", ts: 10 }),
      eventLine({ event: "boot.ready", scope: "boot", ts: 42 }),
    ]);
    assert.equal(rows[0].closedBy, 2);
    assert.equal(rows[1].status, "ok");
    assert.equal(rows[1].durationMs, 32);
  });

  it("classifies a failure terminal as failed and still pairs it (wild.step_timeout)", () => {
    const rows = parseTimeline([
      eventLine({ event: "wild.step_start", ts: 100 }),
      eventLine({ event: "wild.step_timeout", ts: 90_200 }),
    ]);
    assert.equal(rows[0].closedBy, 2);
    assert.equal(rows[1].status, "failed");
    assert.equal(rows[1].durationMs, 90_100);
  });

  it("closes a span as paused for wild.step_paused", () => {
    const rows = parseTimeline([
      eventLine({ event: "wild.step_start", ts: 5 }),
      eventLine({ event: "wild.step_paused", ts: 8 }),
    ]);
    assert.equal(rows[1].status, "paused");
    assert.equal(rows[0].durationMs, 3);
  });

  it("leaves an unclosed start as `started` with no duration (never a fabricated end)", () => {
    const rows = parseTimeline([eventLine({ event: "wild.step_start", ts: 100 })]);
    assert.equal(rows[0].status, "started");
    assert.equal(rows[0].closedBy, null);
    assert.equal(rows[0].durationMs, null);
  });

  it("does not pair across stems (a wild.step_start cannot be closed by wild.driver_error)", () => {
    const rows = parseTimeline([
      eventLine({ event: "wild.step_start", ts: 1 }),
      eventLine({ event: "wild.driver_error", scope: "wild-driver", ts: 2 }),
    ]);
    assert.equal(rows[0].closedBy, null);
    assert.equal(rows[1].closes, null);
    assert.equal(rows[1].status, "failed");
  });

  it("a terminal with no open start is a plain terminal row", () => {
    const rows = parseTimeline([eventLine({ event: "wild.step_ok", ts: 9 })]);
    assert.equal(rows[0].status, "ok");
    assert.equal(rows[0].closes, null);
    assert.equal(rows[0].durationMs, null);
  });

  it("a newer start supersedes an older unclosed one for the same stem", () => {
    const rows = parseTimeline([
      eventLine({ event: "wild.step_start", ts: 1 }),
      eventLine({ event: "wild.step_start", ts: 5 }),
      eventLine({ event: "wild.step_ok", ts: 7 }),
    ]);
    assert.equal(rows[0].closedBy, null, "the superseded start stays honestly open");
    assert.equal(rows[1].closedBy, 3);
    assert.equal(rows[1].durationMs, 2);
    assert.equal(rows[2].closes, 2);
  });

  it("never mints a duration when a paired row has no usable ts", () => {
    const rows = parseTimeline([
      eventLine({ event: "wild.step_start" }),
      eventLine({ event: "wild.step_ok", ts: 50 }),
    ]);
    assert.equal(rows[0].ts, null);
    assert.equal(rows[0].closedBy, 2, "the pairing is still recorded");
    assert.equal(rows[1].durationMs, null, "no ts ⇒ no duration, not zero");
  });

  it("ignores a negative duration instead of reporting one", () => {
    const rows = parseTimeline([
      eventLine({ event: "wild.step_start", ts: 500 }),
      eventLine({ event: "wild.step_ok", ts: 400 }),
    ]);
    assert.equal(rows[0].closedBy, 2);
    assert.equal(rows[0].durationMs, null);
  });
});

describe("rt-timeline — malformed input degrades, never throws", () => {
  it("turns unparseable lines into raw rows that keep the original text and real line number", () => {
    const rows = parseTimeline(["not json at all", '{"event":"boot.start","ts":1}', "{"]);
    assert.equal(rows.length, 3);
    assert.equal(rows[0].status, "raw");
    assert.equal(rows[0].raw, "not json at all");
    assert.equal(rows[0].message, "not json at all");
    assert.equal(rows[0].line, 1);
    assert.equal(rows[1].status, "started", "a good line between bad ones still parses");
    assert.equal(rows[2].status, "raw");
    assert.equal(rows[2].line, 3);
  });

  it("degrades non-object JSON (array, string, number, null, true) to raw rows", () => {
    const rows = parseTimeline(['["a"]', '"str"', "7", "null", "true"]);
    assert.equal(rows.length, 5);
    for (const r of rows) {
      assert.equal(r.status, "raw");
      assert.equal(r.ts, null);
      assert.equal(r.event, null);
      assert.equal(r.known, false);
    }
  });

  it("degrades an object with no usable event name to a raw row", () => {
    const rows = parseTimeline([
      eventLine({ event: undefined }),
      eventLine({ event: 42 }),
      eventLine({ event: "" }),
      eventLine({ event: null }),
    ]);
    assert.equal(rows.length, 4);
    for (const r of rows) assert.equal(r.status, "raw");
  });

  it("skips blank lines and tolerates CRLF without shifting line numbers", () => {
    const rows = parseTimeline('{"event":"boot.start","ts":1}\r\n\r\n{"event":"boot.ready","ts":3}\r\n');
    assert.equal(rows.length, 2);
    assert.equal(rows[0].line, 1);
    assert.equal(rows[1].line, 3, "the blank CRLF line still counts as input line 2");
    assert.equal(rows[0].closedBy, 3);
  });

  it("accepts an empty input as an empty timeline", () => {
    assert.deepEqual(parseTimeline(""), []);
    assert.deepEqual(parseTimeline([]), []);
  });

  it("flags a well-formed event that is not in the catalogue without dropping it", () => {
    const rows = parseTimeline([eventLine({ event: "totally.new_event", ts: 1 })]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "instant");
    assert.equal(rows[0].known, false, "catalogue drift is visible, not silent");
    assert.equal(rows[0].event, "totally.new_event");
    assert.equal(isKnownRtEvent("totally.new_event"), false);
  });

  it("keeps catalogue events marked known", () => {
    const rows = parseTimeline([eventLine({ event: "sys.heartbeat", ts: 1 })]);
    assert.equal(rows[0].known, true);
    assert.equal(rows[0].status, "instant");
  });

  it("degrades wrong-typed fields to null instead of stringifying them", () => {
    const rows = parseTimeline([
      eventLine({ event: "boot.start", ts: "1000", level: "loud", scope: 7, phase: 2.5, code: {} }),
    ]);
    assert.equal(rows[0].ts, null);
    assert.equal(rows[0].level, null);
    assert.equal(rows[0].scope, null);
    assert.equal(rows[0].phase, null, "a non-integer phase is not a PhaseId");
    assert.equal(rows[0].code, null);
    assert.equal(rows[0].message, "m", "the default message from the fixture survives");
  });

  it("keeps a valid level and integer phase", () => {
    const rows = parseTimeline([eventLine({ event: "engine.phase_error", level: "critical", phase: 6, code: "RT_E_INTERNAL" })]);
    assert.equal(rows[0].level, "critical");
    assert.equal(rows[0].phase, 6);
    assert.equal(rows[0].code, "RT_E_INTERNAL");
  });

  it("bounds a raw row's message but keeps the full text in `raw`", () => {
    const long = `x${"y".repeat(500)}`;
    const rows = parseTimeline([long]);
    assert.equal(rows[0].raw, long);
    assert.equal(rows[0].message.length, 301, "300 chars + the ellipsis");
    assert.ok(rows[0].message.endsWith("…"));
  });

  it("is total over a hostile corpus — every line lands in a row, nothing throws", () => {
    const corpus = [
      "",
      " ",
      "\t",
      "{",
      "}",
      "[",
      "][",
      '{"event":',
      '{"event":"wild.step_start"}',
      '{"event":"wild.step_ok","ts":2}',
      '{"event":{"nested":"object"},"ts":1}',
      '{"event":"a".repeat(5000)}',
      '{"event":"wild.step_error","ts":-1,"level":"info","message":null}',
      "🎉 not a log line 🎉",
      '{"event":"wild.step_start","ts":1e309}',
      '{"event":"wild.step_paused","ts":0}',
      JSON.stringify({ event: "boot.ready", ts: 1, payload: { a: 1 } }),
      '"\\\\"',
      "undefined",
      "NaN",
    ];
    let rows: TimelineRow[] = [];
    assert.doesNotThrow(() => {
      rows = parseTimeline(corpus);
    });
    assert.ok(rows.length <= corpus.length, "one row per non-blank line at most");
    assert.ok(
      rows.some((r) => r.status === "raw") && rows.some((r) => r.status !== "raw"),
      "the corpus exercises both the degraded and the parsed path",
    );
  });
});

describe("rt-timeline — determinism and summary", () => {
  it("is deterministic: the same input yields byte-identical rows", () => {
    const input = [
      eventLine({ event: "wild.step_start", ts: 1 }),
      eventLine({ event: "wild.step_error", ts: 4 }),
      "garbage",
      eventLine({ event: "boot.start", ts: 9 }),
    ];
    assert.deepEqual(parseTimeline(input), parseTimeline(input));
  });

  it("does not mutate its input array", () => {
    const input = [eventLine({ event: "boot.start", ts: 1 }), "garbage"];
    const copy = [...input];
    parseTimeline(input);
    assert.deepEqual(input, copy);
  });

  it("summarizes counts, open spans and the longest paired span", () => {
    const rows = parseTimeline([
      eventLine({ event: "boot.start", ts: 0 }),
      eventLine({ event: "boot.ready", ts: 5 }),
      eventLine({ event: "wild.step_start", ts: 10 }),
      eventLine({ event: "wild.step_ok", ts: 40 }),
      eventLine({ event: "wild.step_start", ts: 50 }),
      eventLine({ event: "sys.heartbeat", ts: 60 }),
      "garbage",
    ]);
    const sum = summarizeTimeline(rows);
    assert.equal(sum.rows, 7);
    assert.equal(sum.started, 1, "the still-open wild step");
    assert.equal(sum.ok, 2);
    assert.equal(sum.failed, 0);
    assert.equal(sum.paused, 0);
    assert.equal(sum.instant, 1);
    assert.equal(sum.raw, 1);
    assert.equal(sum.openSpans, 1);
    assert.equal(sum.longestMs, 30, "boot 5ms vs wild 30ms");
  });

  it("reports longestMs null when nothing paired", () => {
    const sum = summarizeTimeline(parseTimeline([eventLine({ event: "sys.heartbeat", ts: 1 })]));
    assert.equal(sum.longestMs, null);
    assert.equal(sum.openSpans, 0);
  });
});
