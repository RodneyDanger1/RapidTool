// watchdog.test.ts — fixes/109 §8.4: budget tiers, lag, auto-pause, watch.
// Runs under `node --experimental-strip-types --test src/lib/watchdog.test.ts`.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  boundedStepWatch,
  heartbeatLagClass,
  requiresHumanResume,
  shouldAutopause,
  watchdogDecision,
} from "./watchdog.ts";

test("watchdogDecision tiers at 0.99×/1×/1.99×/2× of the budget", () => {
  const B = 90_000;
  assert.equal(watchdogDecision(B * 0.99, B), 0);
  assert.equal(watchdogDecision(B * 1.0, B), 1, "exactly 1× is overdue");
  assert.equal(watchdogDecision(B * 1.99, B), 1);
  assert.equal(watchdogDecision(B * 2.0, B), 2, "exactly 2× is timeout");
  assert.equal(watchdogDecision(B * 2.01, B), 2);
  assert.equal(watchdogDecision(-5, B), 0);
  assert.equal(watchdogDecision(B, 0), 0, "zero/negative budget never tiers");
  assert.equal(watchdogDecision(Number.NaN, B), 0);
});

test("shouldAutopause fires only at ≥ 2× budget (pause-on-resolve trigger)", () => {
  assert.equal(shouldAutopause(179_999, 90_000), false);
  assert.equal(shouldAutopause(180_000, 90_000), true);
});

test("heartbeat lag thresholds: <3s ok, 3-10s warn, ≥10s critical", () => {
  assert.equal(heartbeatLagClass(2_999), "ok");
  assert.equal(heartbeatLagClass(3_000), "warn");
  assert.equal(heartbeatLagClass(9_999), "warn");
  assert.equal(heartbeatLagClass(10_000), "critical");
  assert.equal(heartbeatLagClass(Number.NaN), "ok");
});

test("never-auto-resume invariant: stall latches require a human resume", () => {
  assert.equal(requiresHumanResume({ projectId: "p", since: 1, stepElapsedMs: 1, class: "step-timeout" }), true);
  assert.equal(requiresHumanResume({ projectId: "p", since: 1, stepElapsedMs: 1, class: "mainthread-stall" }), true);
  assert.equal(requiresHumanResume({ projectId: "p", since: 1, stepElapsedMs: 1, class: "step-overdue" }), false);
  assert.equal(requiresHumanResume(null), false);
});

test("boundedStepWatch: fast steps fire no callbacks and clear timers", async () => {
  const calls: string[] = [];
  const { result, elapsedMs } = await boundedStepWatch(
    async () => "done",
    {
      budgetMs: 60_000,
      autopauseMs: 120_000,
      onOverdue: () => calls.push("overdue"),
      onTimeout: () => calls.push("timeout"),
    },
  );
  assert.equal(result, "done");
  assert.ok(elapsedMs >= 0 && elapsedMs < 10_000);
  assert.deepEqual(calls, []);
});

test("boundedStepWatch: a step that outlives 2× budget fires overdue then timeout", async () => {
  const calls: string[] = [];
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const { result, elapsedMs } = await boundedStepWatch(
    () => sleep(120).then(() => "late"),
    {
      budgetMs: 30,
      autopauseMs: 60,
      onOverdue: (e) => calls.push(`overdue:${e}`),
      onTimeout: (e) => calls.push(`timeout:${e}`),
    },
  );
  assert.equal(result, "late");
  assert.equal(calls.length, 2);
  assert.ok(calls[0].startsWith("overdue:"), `expected overdue first, got ${calls[0]}`);
  assert.ok(calls[1].startsWith("timeout:"), `expected timeout second, got ${calls[1]}`);
  assert.ok(elapsedMs >= 120, `elapsed measured honestly: ${elapsedMs}`);
  assert.ok(shouldAutopause(elapsedMs, 30), "watchdog would auto-pause on this elapsed");
});

test("boundedStepWatch: a rejected step still clears timers (no stray callbacks)", async () => {
  const calls: string[] = [];
  await assert.rejects(
    boundedStepWatch(
      async () => {
        throw new Error("boom");
      },
      {
        budgetMs: 30,
        autopauseMs: 60,
        onOverdue: () => calls.push("overdue"),
        onTimeout: () => calls.push("timeout"),
      },
    ),
    /boom/,
  );
  await new Promise((r) => setTimeout(r, 100));
  assert.deepEqual(calls, [], "no callback fires after the step settled (rejected)");
});
