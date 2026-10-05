// rt-ring.test.ts — fixes/109 §8.4: bounds / coalesce / redact / round-trip.
// Runs under `node --experimental-strip-types --test src/lib/rt-ring.test.ts`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRtRing, rtHydrate, rtPush, rtRowBytes, rtSerialize, rtStats, rtTail, type RtRing } from "./rt-ring.ts";
import { RING_CAP, RING_BYTES, messageHash } from "./rt-events.ts";
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

test("R12-f05: a stable stale message + changing payload.staleSeconds coalesces (payload is not in the fingerprint)", () => {
  let ring = createRtRing();
  const stale = (ts: number, secs: number) =>
    row({
      ts,
      level: "error",
      scope: "wild-step",
      event: "wild.step_timeout",
      code: "RT_E_LLM_TIMEOUT",
      message: "Wild run P6 stale past budget",
      payload: { staleSeconds: secs, budgetMs: 255_000 },
    });
  ring = rtPush(ring, stale(1_000_000, 256), { now: 1_000_000 }).ring;
  ring = rtPush(ring, stale(1_001_000, 257), { now: 1_001_000 }).ring;
  ring = rtPush(ring, stale(1_002_000, 258), { now: 1_002_000 }).ring;
  assert.equal(ring.rows.length, 1, "stable message + varying seconds is ONE ring slot (was one per tick)");
  assert.equal(ring.rows[0].count, 3, "the dedupe counter records the three ticks");
  assert.equal(messageHash("Wild run P6 stale past budget"), messageHash(ring.rows[0].message), "fingerprint stable");
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
  // n <= 0 must be an EMPTY tail: `slice(-0)` is `slice(0)` (the whole ring).
  assert.deepEqual(rtTail(ring, 0), [], "n=0 tails nothing, not everything");
  assert.deepEqual(rtTail(ring, -3), []);
  assert.deepEqual(rtTail(ring, Number.NaN), []);
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

test("hydrate coerces a non-finite stall.since/stepElapsedMs to 0 (JSON 1e999 parses to Infinity)", () => {
  // JSON cannot spell NaN, but a hostile/foreign blob can carry `1e999`, which
  // JSON.parse returns as Infinity. Every sibling coercion in rtHydrate guards
  // finiteness; these two did not, leaking an Infinity latch to the rail's
  // agoLabel (and any elapsed arithmetic).
  const raw = `{"sessionId":"s-stall","rows":[],"stall":{"projectId":"p","since":1e999,"stepElapsedMs":1e999,"class":"step-overdue"}}`;
  const ring = rtHydrate(raw);
  assert.ok(ring.stall);
  assert.equal(ring.stall!.since, 0, "a non-finite `since` floors to 0, not Infinity");
  assert.equal(ring.stall!.stepElapsedMs, 0, "a non-finite `stepElapsedMs` floors to 0, not Infinity");
});

// ---------------------------------------------------------------------------
// fixes/309 A2 — M3-01…07 hostile-input throw guards. Repros from
// ~/rt308_m3/hostile1.ts; each pin asserts the guarded (throw-free) outcome.
// ---------------------------------------------------------------------------

test("M3-01: a non-row (null/undefined/scalar/array) is a no-op — never a throw", () => {
  const ring = createRtRing();
  for (const junk of [null, undefined, 5, "x", ["rt"]] as unknown[]) {
    const r = rtPush(ring, junk as RtEvent, { now: 1 });
    assert.equal(r.ring, ring, `junk row ${String(junk)} leaves the ring untouched`);
    assert.deepEqual(r.dropped, []);
  }
  assert.equal(ring.rows.length, 0);
});

test("M3-02: cap:-3 no longer spins (was a ~7.8 s busy loop then RangeError)", () => {
  const ring = createRtRing();
  const t0 = Date.now();
  const r = rtPush(ring, row(), { cap: -3, now: 1 });
  const elapsed = Date.now() - t0;
  assert.ok(elapsed < 50, `cap:-3 must complete in <50 ms (took ${elapsed} ms)`);
  assert.equal(r.ring.rows.length, 1, "junk cap falls back to the default bound — the row lands");
  assert.deepEqual(r.dropped, []);
});

test("M3-03: a NaN cap is treated as absent — the ring stays bounded, not silently uncapped", () => {
  let ring = createRtRing();
  for (let i = 0; i < RING_CAP + 5; i++) {
    ring = rtPush(ring, row({ message: `m${i}` }), { cap: Number.NaN, now: i + 1 }).ring;
  }
  assert.equal(ring.rows.length, RING_CAP, `NaN cap must not disable the cap (got ${ring.rows.length})`);
});

test("M3-04: a null/junk ring starts fresh — no throw, the row still lands", () => {
  const r = rtPush(null as unknown as RtRing, row(), { now: 1 });
  assert.equal(r.ring.rows.length, 1);
  assert.ok(r.ring.sessionId.length > 0);
  assert.deepEqual(r.dropped, []);
  // A ring whose `rows` is not an array is junk too.
  const r2 = rtPush({ ...createRtRing(), rows: 7 } as unknown as RtRing, row(), { now: 2 });
  assert.equal(r2.ring.rows.length, 1);
});

test("M3-05: rtTail on a null ring returns [] (never throws)", () => {
  assert.deepEqual(rtTail(null as unknown as RtRing, 3), []);
});

test("M3-06: rtStats floors junk rings/junk rows — counters and ts window never throw", () => {
  const empty = rtStats(null as unknown as RtRing);
  assert.equal(empty.rows, 0);
  assert.equal(empty.errorCount + empty.criticalCount + empty.warnCount, 0);
  assert.equal(empty.newestTs, null);
  assert.equal(empty.oldestTs, null);
  assert.equal(empty.sessionId, "");
  const junk = rtStats({
    ...createRtRing(),
    rows: [null, { level: "error" }, 5, { level: 42, ts: "x" }],
  } as unknown as RtRing);
  assert.equal(junk.rows, 4, "rows counts the raw array");
  assert.equal(junk.errorCount, 1, "only the well-shaped row counts");
  assert.equal(junk.newestTs, null, "no finite ts among the junk rows");
  assert.equal(junk.oldestTs, null);
});

test("M3-07: rtSerialize on a null ring emits the empty frame — hydrates clean", () => {
  const raw = rtSerialize(null as unknown as RtRing);
  const parsed = JSON.parse(raw) as { version: number; sessionId: string; rows: unknown[] };
  assert.equal(parsed.version, 1);
  assert.equal(parsed.sessionId, "");
  assert.deepEqual(parsed.rows, []);
  const back = rtHydrate(raw);
  assert.equal(back.rows.length, 0);
  assert.equal(back.recoveredCorrupt, false);
});

test("hydrate enforces the ring bounds: an oversized/tampered blob is trimmed (row cap + byte cap)", () => {
  // A persisted blob is localStorage — user-writable and possibly written by a
  // build with different caps. Hydration must re-apply the SAME bounds rtPush
  // does, or the "200 rows / 64 KB" contract holds only until the next push.
  const manyRows = Array.from({ length: RING_CAP + 100 }, (_, i) =>
    row({ ts: 1_000 + i, message: `h${i}` }),
  );
  const byRowCount = rtHydrate(
    JSON.stringify({ version: 1, sessionId: "s-big", rows: manyRows }),
  );
  assert.equal(byRowCount.rows.length, RING_CAP, "row cap applies on hydrate");
  assert.equal(byRowCount.rows[0].message, "h100", "oldest rows dropped first");
  assert.equal(byRowCount.rows[RING_CAP - 1].message, `h${RING_CAP + 99}`, "newest row kept");
  assert.ok(rtStats(byRowCount).bytes <= RING_BYTES, "row-capped result fits bytes");

  // Row count within the cap, but the serialized payload exceeds the byte cap.
  const bulky = Array.from({ length: RING_CAP }, (_, i) =>
    row({ ts: 2_000 + i, message: `b${i}-${"x".repeat(280)}` }),
  );
  const byBytes = rtHydrate(
    JSON.stringify({ version: 1, sessionId: "s-fat", rows: bulky }),
  );
  assert.ok(rtStats(byBytes).bytes <= RING_BYTES, "byte cap applies on hydrate");
  assert.ok(byBytes.rows.length >= 1 && byBytes.rows.length < RING_CAP, "oldest trimmed to fit");
  assert.equal(byBytes.rows[byBytes.rows.length - 1].message, `b${RING_CAP - 1}-${"x".repeat(280)}`, "newest kept");
});
