// rt-events.test.ts — fixes/109 §8.4: catalogue pin + coalesce + redaction.
// Runs under `node --experimental-strip-types --test src/lib/rt-events.test.ts`.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as rtEvents from "./rt-events.ts";
import {
  P6_PHASE_MAX_MS,
  RT_EVENT_NAMES,
  RT_SCOPES,
  WILD_STEP_BUDGET_MS,
  flattenStack,
  isKnownRtEvent,
  messageHash,
  rtLevelRank,
  sanitizeRecord,
  sanitizeRtEvent,
  shouldCoalesce,
  type RtEvent,
} from "./rt-events.ts";

function row(over: Partial<RtEvent>): RtEvent {
  return {
    schema_version: 1,
    ts: 1_000,
    level: "info",
    host: "test",
    sessionId: "s-test",
    scope: "sys",
    event: "sys.heartbeat",
    message: "m",
    capture: "test.ts:1",
    ...over,
  } as RtEvent;
}

test("catalogue: every event name maps to a legal scope (sync pin, mirrors errors.test.ts)", () => {
  const scopeSet = new Set<string>(RT_SCOPES);
  for (const [event, scope] of Object.entries(RT_EVENT_NAMES)) {
    assert.ok(scopeSet.has(scope), `${event} → unknown scope ${scope}`);
  }
  // The full set is pinned: adding/removing names without updating this test fails.
  assert.deepEqual(
    Object.keys(RT_EVENT_NAMES).sort(),
    [
      "boot.ready",
      "boot.start",
      "boundary.crash",
      "chat.send_error",
      "cli.error",
      "cli.invocation",
      "crew.turn_error",
      "crew.turn_ok",
      "diagnose.ran",
      "engine.phase_error",
      "engine.phase_fallback",
      // W44 · T5.4 (fixes/318_a1_oracle.md): the eval driver's bounded run-level rows.
      "eval.run_end",
      "eval.run_error",
      "eval.run_start",
      "harvest.error",
      "hydrate.empty",
      "hydrate.ok",
      "hydrate.recovered_corrupt",
      "llm.late_settle",
      "llm.not_configured",
      "llm.ok",
      "llm.rejected",
      "llm.timeout",
      "llm.transport_error",
      "persist.ok",
      "persist.quota_failed",
      "persist.salvaged",
      "runner.failed",
      "runner.ok",
      "runner.unavailable",
      "search.unavailable",
      "store.action_error",
      "sys.heartbeat",
      "sys.heartbeat_lag",
      "sys.longtask",
      "sys.mainthread_stall",
      "sys.memory",
      "sys.previous_session_crash",
      "sys.step_overdue",
      "sys.uncaught_error",
      "sys.unhandled_rejection",
      "ui.action_error",
      "ui.boundary_crash",
      "ui.pane_crash",
      "verify.error",
      "verify.ok",
      "watcher.error",
      "watcher.refused",
      "wild.driver_cap",
      "wild.driver_error",
      "wild.driver_paused_auto",
      "wild.driver_resumed",
      "wild.driver_stall",
      "wild.driver_start_refused",
      "wild.paused_policy",
      "wild.step_error",
      "wild.step_ok",
      "wild.step_paused",
      "wild.step_start",
      "wild.step_timeout",
    ].sort(),
  );
  assert.equal(isKnownRtEvent("wild.step_ok"), true);
  assert.equal(isKnownRtEvent("wild.invented"), false);
});

// ---------------------------------------------------------------------------
// W60 census pin (346 lane-4). The dead-list comment in rt-events.ts §2.4
// claims an exact live/dead partition of RT_EVENT_NAMES. Re-derive it from the
// real non-test `event: "..."` emit literals under src/ and scripts/ (comment
// text excluded) so the comment can never drift from the bytes silently:
// adding/removing an emitter without updating the census fails here.
// ---------------------------------------------------------------------------

/** Every non-test `event: "..."` string literal emitted in src/ + scripts/. */
function scanEmittedEventNames(): Set<string> {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const roots = [resolve(repoRoot, "src"), resolve(repoRoot, "scripts")];
  const exts = new Set([".ts", ".tsx", ".mjs", ".js", ".mts"]);
  const skipDirs = new Set(["node_modules", ".git", ".grok", "research", "fixes", "wave_plans", "dist", "build"]);
  const files: string[] = [];
  const walk = (dir: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const path = join(dir, name);
      let isDir: boolean;
      try {
        isDir = statSync(path).isDirectory();
      } catch {
        continue;
      }
      if (isDir) {
        if (!skipDirs.has(name)) walk(path);
      } else if (exts.has(extname(name)) && !/\.test\.[^/\\]+$/.test(path)) {
        files.push(path);
      }
    }
  };
  for (const root of roots) walk(root);

  const names = new Set<string>();
  const re = /event:\s*["']([^"']+)["']/g;
  for (const file of files) {
    const text = readFileSync(file, "utf8");
    let match: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((match = re.exec(text)) !== null) {
      const lineStart = text.lastIndexOf("\n", match.index) + 1;
      const lineEnd = text.indexOf("\n", match.index);
      const before = text.slice(lineStart, match.index);
      const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd).trimStart();
      // Emits only: skip `//`/`/*` comments and JSDoc `*` lines so prose that
      // quotes an `event: "..."` (like the W56 note) is not a producer.
      if (before.includes("//") || before.includes("/*") || line.startsWith("*")) continue;
      names.add(match[1]);
    }
  }
  return names;
}

// The exact partition the §2.4 census comment records at HEAD c16220b.
const CENSUS_LIVE = [
  "cli.invocation",
  "eval.run_end",
  "eval.run_error",
  "eval.run_start",
  "hydrate.recovered_corrupt",
  "persist.quota_failed",
  "sys.heartbeat",
  "sys.heartbeat_lag",
  "sys.longtask",
  "sys.mainthread_stall",
  "sys.previous_session_crash",
  "sys.step_overdue",
  "sys.uncaught_error",
  "sys.unhandled_rejection",
  "ui.boundary_crash",
  "ui.pane_crash",
  "wild.paused_policy",
  "wild.step_error",
  "wild.step_ok",
  "wild.step_paused",
  "wild.step_start",
  "wild.step_timeout",
];
const CENSUS_DEAD = [
  "boot.ready",
  "boot.start",
  "boundary.crash",
  "chat.send_error",
  "cli.error",
  "crew.turn_error",
  "crew.turn_ok",
  "diagnose.ran",
  "engine.phase_error",
  "engine.phase_fallback",
  "harvest.error",
  "hydrate.empty",
  "hydrate.ok",
  "llm.late_settle",
  "llm.not_configured",
  "llm.ok",
  "llm.rejected",
  "llm.timeout",
  "llm.transport_error",
  "persist.ok",
  "persist.salvaged",
  "runner.failed",
  "runner.ok",
  "runner.unavailable",
  "search.unavailable",
  "store.action_error",
  "sys.memory",
  "ui.action_error",
  "verify.error",
  "verify.ok",
  "watcher.error",
  "watcher.refused",
  "wild.driver_cap",
  "wild.driver_error",
  "wild.driver_paused_auto",
  "wild.driver_resumed",
  "wild.driver_stall",
  "wild.driver_start_refused",
];

test("census pin: live/dead partition matches the real non-test emit sites", () => {
  const emitted = scanEmittedEventNames();
  const all = Object.keys(RT_EVENT_NAMES).sort();
  const live = all.filter((name) => emitted.has(name));
  const dead = all.filter((name) => !emitted.has(name));
  assert.deepEqual(live, CENSUS_LIVE, "live set drifted — update the §2.4 census comment and this pin");
  assert.deepEqual(dead, CENSUS_DEAD, "dead set drifted — update the §2.4 census comment and this pin");
  assert.equal(all.length, CENSUS_LIVE.length + CENSUS_DEAD.length, "partition is complete + disjoint");
  // W60: the 346 P2-6 boundedStepWatch wiring re-livened these two.
  assert.ok(live.includes("sys.step_overdue"), "engine.wildStep emits tier-1 sys.step_overdue (engine.ts:5306)");
  assert.ok(live.includes("wild.step_timeout"), "tier-2 timeout has producers (engine.ts:5319 + console.tsx:1265)");
});

test("constants: budget relation is single-sourced; the drifted autopause constant stays struck", () => {
  assert.equal(P6_PHASE_MAX_MS, 240_000);
  assert.equal(WILD_STEP_BUDGET_MS, P6_PHASE_MAX_MS + 15_000);
  assert.ok(WILD_STEP_BUDGET_MS > P6_PHASE_MAX_MS, "the step budget must clear a legal P6 synthesis step");
  // W60 · 346 lane-4 struck WILD_STEP_AUTOPAUSE_MS (was P6_PHASE_MAX_MS + 60_000
  // with 0 refs). The real tier-2 is 2× the effective step budget — a relation
  // the engine computes inline (engine.ts:5300), not a fixed ms this table can
  // hold; keeping the name would imply a consumer the module never had.
  assert.equal(
    Object.prototype.hasOwnProperty.call(rtEvents, "WILD_STEP_AUTOPAUSE_MS"),
    false,
    "a fixed autopause constant would imply a consumer the module does not have",
  );
});

test("coalesce window math: same fingerprint within 5s coalesces, after it does not", () => {
  const prev = row({ ts: 5_000, scope: "llm-call", event: "llm.timeout", code: "RT_E_LLM_TIMEOUT", message: "boom" });
  const same = row({ ts: 9_999, scope: "llm-call", event: "llm.timeout", code: "RT_E_LLM_TIMEOUT", message: "boom" });
  // Exactly RT_COALESCE_MS (5 000 ms) is INSIDE the window — pins `<=`, so a
  // mutation to `<` fails here instead of surviving on the 9 999/10 001 samples.
  const atBoundary = row({ ts: 10_000, scope: "llm-call", event: "llm.timeout", code: "RT_E_LLM_TIMEOUT", message: "boom" });
  const late = row({ ts: 10_001, scope: "llm-call", event: "llm.timeout", code: "RT_E_LLM_TIMEOUT", message: "boom" });
  const otherEvent = row({ ts: 6_000, scope: "llm-call", event: "llm.rejected", code: "RT_E_LLM_TIMEOUT", message: "boom" });
  const otherCode = row({ ts: 6_000, scope: "llm-call", event: "llm.timeout", code: null, message: "boom" });
  assert.equal(shouldCoalesce(prev, same, same.ts), true);
  assert.equal(shouldCoalesce(prev, atBoundary, atBoundary.ts), true);
  assert.equal(shouldCoalesce(prev, late, late.ts), false);
  assert.equal(shouldCoalesce(prev, otherEvent, otherEvent.ts), false);
  assert.equal(shouldCoalesce(prev, otherCode, otherCode.ts), false);
});

test("messageHash truncates to the first 96 chars of the trimmed message", () => {
  const long = "x".repeat(200);
  assert.equal(messageHash(`  ${long}  `).length, 96);
  assert.equal(messageHash("hello"), "hello");
});

test("level order: debug < info < warn < error < critical", () => {
  const order = ["debug", "info", "warn", "error", "critical"];
  for (let i = 1; i < order.length; i++) {
    assert.ok(
      rtLevelRank(order[i] as never) > rtLevelRank(order[i - 1] as never),
      `${order[i - 1]} must rank below ${order[i]}`,
    );
  }
  assert.equal(rtLevelRank("bogus" as never), -1);
});

test("sanitizeRecord: ≤8 keys, scalars only, strings ≤160 chars, hostile keys dropped", () => {
  const out = sanitizeRecord({
    a: "s".repeat(300),
    b: 42,
    c: true,
    d: null,
    e: NaN,
    f: 1.5,
    g: { nested: "dropped" } as unknown as string,
    h: ["dropped"] as unknown as string,
    i: "i",
    j: "j",
    k: "k",
  } as unknown as Record<string, string | number | boolean | null>);
  assert.ok(out);
  assert.equal((out!["a"] as string).length, 160);
  assert.equal(out!["b"], 42);
  assert.equal(out!["c"], true);
  assert.equal(out!["d"], null);
  assert.equal("e" in out!, false, "NaN is dropped");
  assert.equal(out!["f"], 1.5);
  assert.equal("g" in out!, false);
  assert.equal("h" in out!, false);
  assert.equal(Object.keys(out!).length, 8, "cap 8 keys");
  // JSON.parse creates a REAL own "__proto__" key (object literals do not) —
  // the guard must drop it so hostile payloads can never pollute the record.
  const hostile = JSON.parse('{"__proto__":"evil","x":1}') as Record<string, string>;
  const out2 = sanitizeRecord(hostile);
  assert.equal(Object.keys(out2!).includes("__proto__"), false, "hostile key not stored");
  assert.equal(out2!["x"], 1);
});

test("flattenStack: bounded lines, clipped, cause chain flattened", () => {
  const cause = new Error("root cause");
  const outer = new Error("outer");
  (outer as { cause?: unknown }).cause = cause;
  const stack = flattenStack(outer);
  assert.ok(stack);
  const lines = stack!.split("\n");
  assert.ok(lines.length <= 12, `≤12 lines, got ${lines.length}`);
  assert.ok(lines[0].includes("Error: outer"));
  assert.ok(stack!.includes("root cause"), "cause chain flattened");
  for (const line of lines) assert.ok(line.length <= 240);
  assert.equal(flattenStack(null), null);
  assert.equal(flattenStack(undefined), null);
  assert.equal(flattenStack("a thrown string"), "Error: a thrown string");
});

test("sanitizeRtEvent clamps stack to ≤12 lines × ≤240 chars (seed stacks included)", () => {
  const longLine = "x".repeat(500);
  const many = Array.from({ length: 40 }, (_, i) => `line-${i}-${longLine}`).join("\n");
  const out = sanitizeRtEvent(
    row({
      message: "m".repeat(400),
      stack: many,
    }),
  );
  assert.ok(out.message.length <= 300);
  assert.ok(out.stack);
  const lines = out.stack!.split("\n");
  assert.ok(lines.length <= 12, `≤12 stack lines, got ${lines.length}`);
  for (const line of lines) assert.ok(line.length <= 240, `line ≤240, got ${line.length}`);
  assert.equal(sanitizeRtEvent(row({ stack: "" })).stack, null);
  assert.equal(sanitizeRtEvent(row({ stack: null })).stack, null);
});
