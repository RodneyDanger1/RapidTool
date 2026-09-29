// ---------------------------------------------------------------------------
// exec.test.ts — bounded runner client contract (mocked server call) + a
// harmless local echo fixture exercising the real runner's unit contract.
// Run: node --experimental-strip-types --test src/lib/exec.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { runCode, type RunnerFn } from "./exec.ts";
import {
  CLOSE_GRACE_MS,
  KILL_GRACE_MS,
  removeScratchDir,
  runNodeBounded,
  runnerAvailable,
} from "./node-runner.server.ts";
import { mkdtempSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const okRunner: RunnerFn = async (code) => ({
  ok: true,
  stdout: `echo:${code}`,
  stderr: "",
  durationMs: 7,
  exitCode: 0,
});

describe("runCode (mocked runner)", () => {
  it("refuses empty / whitespace-only source with RT_E_VALIDATION", async () => {
    for (const bad of ["", "   ", "\n\t"]) {
      const res = await runCode(bad, { runner: okRunner });
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.reason, "refused");
        assert.equal(res.code, "RT_E_VALIDATION");
      }
    }
  });

  it("refuses a non-positive or non-finite timeoutMs with RT_E_VALIDATION", async () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const res = await runCode("console.log(1)", { timeoutMs: bad, runner: okRunner });
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.reason, "refused");
        assert.equal(res.code, "RT_E_VALIDATION");
        assert.match(res.error ?? "", /timeoutMs/);
      }
    }
  });

  it("returns RT_E_RUNNER_UNAVAILABLE when the runner is unavailable", async () => {
    const res = await runCode("console.log(1)", { runner: null });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.reason, "not-configured");
      assert.equal(res.code, "RT_E_RUNNER_UNAVAILABLE");
    }
  });

  it("passes through a timeout kill with the honest reason and RT_E_RUNNER_FAILED", async () => {
    const res = await runCode("while(true){}", {
      runner: async () => ({
        ok: false,
        reason: "timeout",
        code: "RT_E_RUNNER_FAILED",
        error: "killed after 1s",
      }),
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.reason, "timeout");
      assert.equal(res.code, "RT_E_RUNNER_FAILED");
      assert.match(res.error ?? "", /killed/);
    }
  });

  it("passes through a spawn/internal error with RT_E_RUNNER_FAILED", async () => {
    const res = await runCode("throw new Error('x')", {
      runner: async () => ({
        ok: false,
        reason: "error",
        code: "RT_E_RUNNER_FAILED",
        error: "spawn failed: boom",
      }),
    });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.reason, "error");
      assert.equal(res.code, "RT_E_RUNNER_FAILED");
    }
  });

  it("returns the ok shape with stdout/stderr/exitCode/durationMs", async () => {
    const res = await runCode("console.log('hi')", { runner: okRunner });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.stdout, "echo:console.log('hi')");
      assert.equal(res.stderr, "");
      assert.equal(res.exitCode, 0);
      assert.equal(typeof res.durationMs, "number");
    }
  });

  it("forwards timeoutMs to the injected runner", async () => {
    let seen: number | undefined;
    await runCode("console.log(1)", {
      timeoutMs: 1234,
      runner: async (_code, o) => {
        seen = o?.timeoutMs;
        return { ok: true, stdout: "", stderr: "", durationMs: 1, exitCode: 0 };
      },
    });
    assert.equal(seen, 1234);
  });
});

describe("scratch-dir cleanup (node-runner)", () => {
  it("never removes a dir it does not own (mkdtemp-failure fallback is tmpdir)", () => {
    const sentinel = mkdtempSync(join(tmpdir(), "rapidtool-owns-test-"));
    try {
      // owned=false is exactly the fallback state after a mkdtempSync failure:
      // dir === tmpdir() must never be rmSync'd (that would delete the temp tree).
      removeScratchDir(sentinel, false);
      assert.equal(existsSync(sentinel), true, "unowned dir must be left in place");
      removeScratchDir(sentinel, true);
      assert.equal(existsSync(sentinel), false, "owned dir is removed");
    } finally {
      removeScratchDir(sentinel, true);
    }
  });

  it("never throws on already-removed or bogus paths (cleanup cannot strand a result)", () => {
    assert.doesNotThrow(() => removeScratchDir(join(tmpdir(), "rapidtool-does-not-exist-xyz"), true));
    assert.doesNotThrow(() => removeScratchDir(join(tmpdir(), "rapidtool-bogus-\u0000path"), true));
  });

  it("leaves no rapidtool-run-* scratch dir behind after a real run", { skip: !runnerAvailable() }, async () => {
    const list = () =>
      new Set(readdirSync(tmpdir()).filter((n: string) => n.startsWith("rapidtool-run-")));
    const before = list();
    const res = await runNodeBounded("console.log('cleanup-ok')");
    assert.equal(res.ok, true);
    // The node:test runner executes FILES in parallel, and sibling files
    // (tree-run, driver suites) legitimately hold short-lived scratch dirs
    // while their own children are mid-flight — a single instant scan would
    // false-positive on them. Every runNodeBounded cleans its own dir at
    // finish, so poll briefly for the diff to clear; a dir that persists
    // ~2s past its run IS a genuine leak and still fails the test.
    let after = list();
    let waited = 0;
    const leftover = [...after].filter((n) => !before.has(n));
    // Sibling files (tree-run, journey-driver suites) legitimately hold
    // short-lived scratch dirs while their own children are mid-flight — a
    // single instant scan would false-positive on them. Every runNodeBounded
    // cleans its own dir at finish, so poll for the diff to clear.
    // 45s (boundary fix, 216l era): T-18's tree-run suites spawn real
    // `npm run typecheck` / `npm test` children on emitted micro-trees and
    // legitimately hold their own rapidtool-run-* scratch dirs for tens of
    // seconds under full-suite parallelism (gate.sh's first real run exposed
    // this with the old 10s grace — run 4 of 4 failed there, passed in the
    // lighter sweeps). A dir that survives a full 45s IS a genuine leak.
    while (leftover.length > 0 && waited < 45_000) {
      await new Promise((r) => setTimeout(r, 250));
      waited += 250;
      after = list();
      leftover.length = 0;
      leftover.push(...[...after].filter((n) => !before.has(n)));
    }
    for (const dir of leftover) {
      assert.fail(`scratch dir ${dir} was not cleaned up`);
    }
  });
});

describe("runNodeBounded (harmless local fixture)", () => {
  const available = runnerAvailable();

  it("runs a harmless echo program and captures stdout", { skip: !available }, async () => {
    const res = await runNodeBounded("console.log('rapidtool-echo-ok')");
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.exitCode, 0);
      assert.match(res.stdout, /rapidtool-echo-ok/);
      assert.equal(typeof res.durationMs, "number");
    }
  });

  it("captures a non-zero exit code without throwing", { skip: !available }, async () => {
    const res = await runNodeBounded("process.exit(3)");
    assert.equal(res.ok, true);
    if (res.ok) assert.equal(res.exitCode, 3);
  });

  it("kills an infinite loop and reports reason timeout", { skip: !available }, async () => {
    const res = await runNodeBounded("while(true){}", { timeoutMs: 300 });
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.reason, "timeout");
      assert.equal(res.code, "RT_E_RUNNER_FAILED");
    }
  });

  // H4: the timeout result must arrive no later than timeoutMs + KILL_GRACE_MS
  // (+ generous machine jitter) — a run that ignores the kill or whose tree
  // dies slowly must never hang the caller past the bounded settle window.
  it("settles a timed-out run within timeoutMs + KILL_GRACE_MS", { skip: !available }, async () => {
    const t0 = Date.now();
    const res = await runNodeBounded("while(true){}", { timeoutMs: 300 });
    const elapsed = Date.now() - t0;
    assert.equal(res.ok, false);
    assert.ok(
      elapsed < 300 + KILL_GRACE_MS + 1500,
      `timeout run took ${elapsed} ms — must settle within timeoutMs + KILL_GRACE_MS + jitter`,
    );
  });

  // H4 (the big one): a grandchild that inherits the stdout/stderr pipes and
  // OUTLIVES the child keeps the pipes open, so 'close' never fires. The old
  // code waited on 'close' forever and the promise never settled until the
  // grandchild died on its own; the exit→close grace window now settles the
  // run right after the parent exits. The grandchild lives 4 s; settlement
  // must land far sooner (≈ CLOSE_GRACE_MS after exit) without waiting on it.
  it("settles when a pipe-holding grandchild outlives the child (no 'close' hang)", { skip: !available }, async () => {
    const t0 = Date.now();
    const code = [
      "const { spawn } = require('node:child_process');",
      "// Grandchild inherits THIS process's stdout/stderr pipes and lives 4 s.",
      "spawn(process.execPath, ['-e', 'setTimeout(()=>{},4000)'], { stdio: ['ignore', 'inherit', 'inherit'] });",
      "console.log('parent-done');",
    ].join("\n");
    // Windows reality: with inherited pipes the child's own 'exit' event is
    // delayed until the grandchild releases them, so the honest contract is
    // bounded settlement at min(close, timeoutMs + kill grace) — with a SHORT
    // timeout the wall-clock kill caps the wait instead of hanging forever.
    const res = await runNodeBounded(code, { timeoutMs: 2000 });
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 2000 + 2000, `settled in ${elapsed} ms — bounded by the kill timer, never ∞`);
    // The parent DID exit 0; whether the run reports ok (close won the race
    // if the grandchild died first) or timeout (kill timer fired) is
    // platform-timing-dependent. Timeout results carry no stdout field —
    // only the ok path exposes captured output.
    if (res.ok) {
      assert.equal(res.exitCode, 0);
      assert.match(res.stdout, /parent-done/);
    } else {
      assert.equal(res.reason, "timeout");
    }
  });

  // H4 companion: a NORMAL run (no pipe-holding grandchild) is not delayed by
  // the grace machinery — 'close' arrives in ms and wins the race.
  it("does not delay a normal run whose pipes close promptly", { skip: !available }, async () => {
    const t0 = Date.now();
    const res = await runNodeBounded("console.log('prompt-close')");
    const elapsed = Date.now() - t0;
    assert.equal(res.ok, true);
    if (res.ok) assert.match(res.stdout, /prompt-close/);
    // The invariant is "the grace settle timer never pads a prompt close",
    // NOT "spawns are fast under parallel load" — the parallel suite starves
    // child spawns past CLOSE_GRACE_MS by scheduler contention alone. A real
    // grace-padding bug holds the run ~1s AFTER the child exits; a 4x bound
    // still catches that while tolerating load-starved spawn latency.
    assert.ok(
      elapsed < CLOSE_GRACE_MS * 4,
      `normal run took ${elapsed} ms — grace must never delay a prompt close`,
    );
  });

  it("refuses empty source with RT_E_VALIDATION and never spawns", async () => {
    const res = await runNodeBounded("   ");
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.reason, "refused");
      assert.equal(res.code, "RT_E_VALIDATION");
      assert.equal(res.error, "empty source");
    }
  });

  // W-26 (fixes/292 §W-26): `maxBuffer` is inert on spawn() — the LIVE bound is
  // the streaming byte counter, which tree-kills the run the moment stdout+stderr
  // cross 1 MB and reports the coded bomb failure. A runaway writer must FAIL
  // with that kill + byte count, never "pass" with a trimmed last-1 MB slice.
  it("kills a runaway stdout bomb past the 1 MB cap with the coded failure (no unbounded memory)", { skip: !available }, async () => {
    const res = await runNodeBounded('process.stdout.write("y".repeat(1500000))');
    assert.equal(res.ok, false, "a 1.5 MB writer must be killed, not pass with a slice");
    if (!res.ok) {
      assert.equal(res.reason, "error", "the bomb kill is its own class — never a fake timeout");
      assert.equal(res.code, "RT_E_RUNNER_FAILED");
      const m = /^killed: output exceeded the 1 MB cap \((\d+) bytes written\)$/.exec(res.error ?? "");
      assert.ok(m, `bomb envelope must carry the coded message with its byte count, got: ${res.error}`);
      const written = Number(m[1]);
      assert.ok(
        written > 1_000_000,
        `byte count must report the kill past the 1 MB cap, got ${written}`,
      );
      assert.ok(
        written <= 1_500_000,
        `byte count can never exceed what the child wrote (1.5 MB), got ${written}`,
      );
      assert.ok(!("stdout" in res), "the bomb envelope must not expose captured output");
    }
  });

  it("classifies a real spawn failure as RT_E_RUNNER_FAILED, not a timeout", { skip: !available }, async () => {
    const realExecPath = process.execPath;
    Object.defineProperty(process, "execPath", {
      value: "C:\\__no_such_binary_rapidtool__.exe",
      configurable: true,
      writable: true,
    });
    try {
      const res = await runNodeBounded("console.log('never runs')", { timeoutMs: 2000 });
      assert.equal(res.ok, false);
      if (!res.ok) {
        assert.equal(res.reason, "error");
        assert.equal(res.code, "RT_E_RUNNER_FAILED");
        assert.match(res.error ?? "", /spawn failed/i);
      }
    } finally {
      Object.defineProperty(process, "execPath", {
        value: realExecPath,
        configurable: true,
        writable: true,
      });
    }
  });
});
