// rt-ring.test.ts — fixes/109 §8.4: bounds / coalesce / redact / round-trip.
// Runs under `node --experimental-strip-types --test src/lib/rt-ring.test.ts`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRtRing, rtHydrate, rtPush, rtRowBytes, rtSerialize, rtStats, rtTail } from "./rt-ring.ts";
import type { RtEvent } from "./rt-events.ts";

let seq = 0;
function row(over: Partial<RtEvent> = {}): RtEvent {
  seq += 1;
  return {
    schema_version: 1,
    ts: seq * 1_000,
    level: "info",
    host: "test",
    sessionId: "s-test",
    scope: "sys",
    event: `test.row${seq}`,
    message: `row ${seq}`,
    capture: "rt-ring.test.ts:1",
    ...over,
  } as RtEvent;
}

test("empty ring: no rows, fresh session id, clean cursors", () => {
  const ring = createRtRing();
  assert.equal(ring.rows.length, 0);
  assert.ok(ring.sessionId.length > 0);
  assert.equal(ring.stall, null);
  assert.equal(ring.recoveredCorrupt, false);
});

test("row cap (200): the 201st push drops the oldest and reports it", () => {
  let ring = createRtRing();
  for (let i = 0; i < 200; i++) {
    const r = rtPush(ring, row({ message: `m${i}` }), { now: i + 1 });
    ring = r.ring;
    assert.deepEqual(r.dropped, []);
  }
  const overflow = row({ message: "overflow" });
  const r = rtPush(ring, overflow, { now: 201 });
  assert.equal(r.ring.rows.length, 200);
  assert.equal(r.dropped.length, 1);
  assert.equal(r.ring.rows[0].message, "m1", "oldest dropped, newest kept");
  assert.equal(r.ring.rows[199].message, "overflow");
});

test("byte cap trims oldest until the payload fits", () => {
  let ring = createRtRing();
  for (let i = 1; i <= 6; i++) {
    ring = rtPush(ring, row({ message: `x${i}-${"y".repeat(290)}` }), { now: i * 100, byteCap: 2_000 }).ring;
  }
  const bytes = rtStats(ring).bytes;
  assert.ok(bytes <= 2_000, `serialized rows ${bytes} must be ≤ byteCap`);
  assert.ok(ring.rows.length < 6, "oldest rows were trimmed to fit the byte cap");
  assert.ok(ring.rows.length >= 1, "keeps at least one row");
});

test("coalescing: same fingerprint within the window counts up instead of appending", () => {
  let ring = createRtRing();
  const mk = (ts: number) =>
    row({ ts, event: "llm.timeout", scope: "llm-call", code: "RT_E_LLM_TIMEOUT", message: "timeout" });
  ring = rtPush(ring, mk(1_000), { now: 1_000 }).ring;
  ring = rtPush(ring, mk(4_000), { now: 4_000 }).ring;
  assert.equal(ring.rows.length, 1, "in-window duplicate coalesces");
  assert.equal(ring.rows[0].count, 2);
  // Outside the window → new slot (gap 5001 ms).
  ring = rtPush(ring, mk(9_001), { now: 9_001 }).ring;
  assert.equal(ring.rows.length, 2);
  assert.equal(ring.rows[1].count, undefined);
});

test("redaction on push: message ≤300, ctx ≤8 keys × ≤160 chars, stack bounded", () => {
  const r = rtPush(createRtRing(), row({
    message: "m".repeat(500),
    ctx: { a: "c".repeat(300), b: "ok" },
    stack: Array.from({ length: 30 }, (_, i) => `line ${i}`).join("\n"),
  }), { now: 1 });
  const pushed = r.ring.rows[0];
  assert.ok(pushed.message.length <= 301);
  assert.ok((pushed.ctx!["a"] as string).length <= 160);
});

test("heartbeat rows divert to the lastHeartbeat sidecar, never the row list", () => {
  let ring = createRtRing();
  const beat = row({ event: "sys.heartbeat", message: "hb", payload: { lagMs: 12 } });
  ring = rtPush(ring, beat, { now: 1 }).ring;
  assert.equal(ring.rows.length, 0);
  assert.equal(ring.lastHeartbeat?.event, "sys.heartbeat");
  assert.equal(ring.lastHeartbeat?.payload?.lagMs, 12);
  // A second heartbeat replaces the cursor (latest only, §2.5).
  ring = rtPush(ring, row({ event: "sys.heartbeat", message: "hb2" }), { now: 2 }).ring;
  assert.equal(ring.lastHeartbeat?.message, "hb2");
});

test("serialize → hydrate round-trip identity (rows, sidecars, stall, persist failure)", () => {
  let ring = createRtRing();
  ring = rtPush(ring, row({ level: "error", message: "boom" }), { now: 1 }).ring;
  ring = {
    ...ring,
    stall: { projectId: "p1", since: 5, stepElapsedMs: 99_000, class: "step-timeout" },
    lastPersistFailure: "quota exceeded",
  };
  ring = rtPush(ring, row({ event: "sys.heartbeat", message: "hb" }), { now: 2 }).ring;
  const hydrated = rtHydrate(rtSerialize(ring));
  assert.equal(hydrated.recoveredCorrupt, false);
  assert.deepEqual(hydrated.rows, ring.rows);
  assert.deepEqual(hydrated.stall, ring.stall);
  assert.equal(hydrated.lastPersistFailure, "quota exceeded");
  assert.equal(hydrated.lastHeartbeat?.message, "hb");
  assert.equal(hydrated.sessionId, ring.sessionId);
});

test("corrupt blob → empty ring + recoveredCorrupt flag (never throws)", () => {
  const hydrated = rtHydrate("{ definitely not json");
  assert.equal(hydrated.rows.length, 0);
  assert.equal(hydrated.recoveredCorrupt, true);
  assert.equal(rtHydrate("").rows.length, 0);
  assert.equal(rtHydrate(null).rows.length, 0);
  assert.equal(rtHydrate("42").recoveredCorrupt, true);
});

test("hydrate tolerates legacy/extra fields and filters junk rows", () => {
  const raw = JSON.stringify({
    version: 1,
    sessionId: "legacy",
    legacyField: { whatever: true },
    rows: [
      { ts: 1, level: "info", event: "ok.row", message: "fine", capture: "x", scope: "sys" },
      { bogus: true },
      null,
      { ts: 2, level: "info", event: "ok.row2", message: "fine2", capture: "x", scope: "sys", extra: "ignored" },
    ],
  });
  const ring = rtHydrate(raw);
  assert.equal(ring.rows.length, 2);
  assert.equal(ring.recoveredCorrupt, false);
  assert.equal(ring.rows[0].event, "ok.row");
  assert.equal(ring.sessionId, "legacy");
});

test("rtTail returns newest-first slices", () => {
  let ring = createRtRing();
  for (let i = 0; i < 5; i++) ring = rtPush(ring, row({ message: `m${i}` }), { now: i + 1 }).ring;
  const tail = rtTail(ring, 2);
  assert.deepEqual(tail.map((r) => r.message), ["m4", "m3"]);
});

test("rtStats: rows/bytes/ts window + error/critical/warn counts", () => {
  let ring = createRtRing();
  ring = rtPush(ring, row({ level: "error", ts: 100 }), { now: 100 }).ring;
  ring = rtPush(ring, row({ level: "critical", ts: 200 }), { now: 200 }).ring;
  ring = rtPush(ring, row({ level: "warn", ts: 300 }), { now: 300 }).ring;
  const stats = rtStats(ring);
  assert.equal(stats.rows, 3);
  assert.equal(stats.errorCount, 1);
  assert.equal(stats.criticalCount, 1);
  assert.equal(stats.warnCount, 1);
  assert.equal(stats.oldestTs, 100);
  assert.equal(stats.newestTs, 300);
  assert.ok(stats.bytes > 0);
  assert.ok(rtRowBytes(ring.rows[0]) > 0);
});

test("hydrate clamps unknown stall.class to step-overdue (never trusts junk enum)", () => {
  const raw = JSON.stringify({
    sessionId: "s-stall",
    rows: [],
    stall: { projectId: "p", since: 1, stepElapsedMs: 2, class: "not-a-real-class" },
  });
  const ring = rtHydrate(raw);
  assert.ok(ring.stall);
  assert.equal(ring.stall!.class, "step-overdue");
  assert.equal(ring.stall!.projectId, "p");
});
