import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import {
  APP_ENV_REL_PATH,
  mergeAppEnv,
  parseAppEnv,
  projectRoot,
  readAppEnv,
  reapChildTree,
} from "./with-app-env.mjs";

const execFileAsync = promisify(execFile);
const WRAPPER = join(projectRoot(), "scripts/with-app-env.mjs");
const PRINT_FLAG = "process.stdout.write(String(process.env.VITE_AUTH_ENABLED));";

function makeWorkspace(appEnvJson) {
  const root = mkdtempSync(join(tmpdir(), "app-env-"));
  if (appEnvJson !== undefined) {
    mkdirSync(join(root, ".grok"), { recursive: true });
    writeFileSync(join(root, APP_ENV_REL_PATH), appEnvJson);
  }
  return root;
}

test("keeps VITE_-prefixed string entries", () => {
  assert.deepEqual(parseAppEnv('{"VITE_AUTH_ENABLED":"false"}'), {
    VITE_AUTH_ENABLED: "false",
  });
});

test("drops non-VITE keys, non-string values and malformed documents", () => {
  assert.deepEqual(parseAppEnv('{"DATABASE_URL":"postgres://x","VITE_N":1,"VITE_OK":"y"}'), {
    VITE_OK: "y",
  });
  assert.deepEqual(parseAppEnv("not json"), {});
  assert.deepEqual(parseAppEnv('["VITE_AUTH_ENABLED"]'), {});
  assert.deepEqual(parseAppEnv("null"), {});
});

test("a missing app-env.json is a clean no-op", () => {
  assert.deepEqual(readAppEnv(makeWorkspace()), {});
});

test("reads the app env from a workspace", () => {
  const root = makeWorkspace('{"VITE_AUTH_ENABLED":"false"}');
  assert.deepEqual(readAppEnv(root), { VITE_AUTH_ENABLED: "false" });
});

test("an explicit process-env override wins over the file", () => {
  const merged = mergeAppEnv(
    { VITE_AUTH_ENABLED: "false" },
    { VITE_AUTH_ENABLED: "true", PATH: "/usr/bin" },
  );
  assert.equal(merged.VITE_AUTH_ENABLED, "true");
  assert.equal(merged.PATH, "/usr/bin");
});

test("the template ships auth off", () => {
  assert.deepEqual(readAppEnv(projectRoot()), { VITE_AUTH_ENABLED: "false" });
});

test("vite loadEnv resolves the wrapped value", () => {
  // What `import.meta.env.VITE_AUTH_ENABLED` becomes: loadEnv prefix-matches
  // process.env, so the wrapper's merge has to land before Vite starts.
  // Do not `import { loadEnv } from "vite"` here — Vite 8 loads rolldown
  // native bindings that SIGSEGV the test worker under qemu-user.
  const root = makeWorkspace('{"VITE_AUTH_ENABLED":"false"}');
  const merged = mergeAppEnv(readAppEnv(root), { PATH: "/usr/bin" });
  assert.equal(merged.VITE_AUTH_ENABLED, "false");
});

test("the wrapped command runs with the app env applied", async () => {
  const { stdout } = await execFileAsync(process.execPath, [
    WRAPPER,
    process.execPath,
    "-e",
    PRINT_FLAG,
  ]);
  assert.equal(stdout, "false");
});

test("the wrapped command sees an explicit override, not the file value", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    [WRAPPER, process.execPath, "-e", PRINT_FLAG],
    { env: { ...process.env, VITE_AUTH_ENABLED: "true" } },
  );
  assert.equal(stdout, "true");
});

test("the wrapper propagates the command's exit code", async () => {
  await assert.rejects(
    execFileAsync(process.execPath, [WRAPPER, process.execPath, "-e", "process.exit(3)"]),
    (err) => err instanceof Error && "code" in err && err.code === 3,
  );
});

test("a signal-killed command is never reported as success", async () => {
  // The wrapper's own SIGTERM handler must not swallow the re-raised signal:
  // a cancelled build reporting exit 0 is a silently passing gate.
  await assert.rejects(
    execFileAsync(process.execPath, [
      WRAPPER,
      process.execPath,
      "-e",
      "process.kill(process.pid, 'SIGTERM');setTimeout(() => {}, 1000);",
    ]),
    (err) =>
      err instanceof Error && (("signal" in err && err.signal === "SIGTERM") || ("code" in err && err.code !== 0)),
  );
});

test("the CLI still runs when invoked through a symlinked path", async (t) => {
  // node realpaths import.meta.url but not process.argv[1], so a raw comparison
  // turns the wrapper into a no-op that exits 0 without starting anything.
  // Windows without Developer Mode refuses real symlinks (EPERM), so use a
  // privilege-free junction there; if even that is refused, skip honestly.
  const link = join(mkdtempSync(join(tmpdir(), "app-env-link-")), "scripts");
  try {
    symlinkSync(
      join(projectRoot(), "scripts"),
      link,
      process.platform === "win32" ? "junction" : undefined,
    );
  } catch (err) {
    if (process.platform === "win32" && err.code === "EPERM") {
      t.skip("symlink test needs Developer Mode on Windows (junction refused: EPERM)");
      return;
    }
    throw err;
  }
  const { stdout } = await execFileAsync(process.execPath, [
    join(link, "with-app-env.mjs"),
    process.execPath,
    "-e",
    PRINT_FLAG,
  ]);
  assert.equal(stdout, "false");
});

// ---------------------------------------------------------------------------
// M6-03 (312 · C3/D3) — the win32 descendant reap. 308 map6's probe: a wrapper
// kill left BOTH the direct child (10696) and its grandchild (15468) running —
// `child.kill(signal)` terminates only the direct child on win32; the cmd.exe
// shim layer and everything under it need `taskkill /T /F` (the
// node-runner.server.ts:164-171 pattern). One source leg + two unit legs +
// one win32 behavioral leg pin the seam from all sides.
// ---------------------------------------------------------------------------

test("M6-03 source: the signal handlers reap the tree (reapChildTree + taskkill /T /F)", () => {
  const src = readFileSync(WRAPPER, "utf8");
  assert.match(
    src,
    /process\.on\(signal, \(\) => reapChildTree\(child, signal\)\)/,
    "the wrapper's signal handlers must route through reapChildTree — a bare child.kill(signal) strands win32 descendants",
  );
  assert.match(
    src,
    /"taskkill", \["\/pid", String\(child\.pid\), "\/T", "\/F"\]/,
    "the win32 branch must taskkill the WHOLE tree (/T), forcefully (/F)",
  );
});

test("M6-03 unit: reapChildTree reaps via taskkill on win32, direct-kills elsewhere", () => {
  const calls = [];
  const fakeSpawn = (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    return { on() {} };
  };
  const child = { pid: 4242, kill: (signal) => calls.push({ direct: signal }) };
  reapChildTree(child, "SIGTERM", fakeSpawn);
  if (process.platform === "win32") {
    assert.deepEqual(
      calls,
      [{ cmd: "taskkill", args: ["/pid", "4242", "/T", "/F"], opts: { windowsHide: true, stdio: "ignore" } }],
      "win32: taskkill /T /F takes the whole tree (the node-runner pattern)",
    );
  } else {
    assert.deepEqual(calls, [{ direct: "SIGTERM" }], "POSIX: the direct signal is the graceful path");
  }
});

test("M6-03 unit: a pid-less child or an unlaunchable taskkill still direct-kills", () => {
  const calls = [];
  reapChildTree({ pid: undefined, kill: (s) => calls.push(["nopid", s]) }, "SIGTERM");
  assert.deepEqual(calls, [["nopid", "SIGTERM"]], "pid-less child → direct kill, never a taskkill NaN");
  if (process.platform === "win32") {
    calls.length = 0;
    reapChildTree({ pid: 7, kill: (s) => calls.push(["throw", s]) }, "SIGTERM", () => {
      throw new Error("taskkill unlaunchable");
    });
    assert.deepEqual(calls, [["throw", "SIGTERM"]], "a taskkill spawn throw falls back to the direct kill");
  }
});

test("M6-03 behavioral (win32): reaping the child stops the grandchild's heartbeats", { skip: process.platform !== "win32" }, async () => {
  // The M6-03 scenario in miniature: child → DETACHED grandchild, the
  // grandchild appending heartbeats to a file. Measured on this host
  // (probe_d3_m603c): a detached grandchild SURVIVES a direct child.kill —
  // the hazard — and is reaped by taskkill /T /F. So this leg genuinely goes
  // RED if the fix is reverted to a bare child.kill.
  const dir = mkdtempSync(join(tmpdir(), "app-env-reap-"));
  const beat = join(dir, "heartbeat.txt");
  const pidFile = join(dir, "grandchild.pid");
  const grandchildCode = `setInterval(() => { require("fs").appendFileSync(${JSON.stringify(beat)}, "x"); }, 60);`;
  const childCode = [
    `const { spawn } = require("child_process");`,
    `const g = spawn(process.execPath, ["-e", ${JSON.stringify(grandchildCode)}], { stdio: "ignore", detached: true });`,
    `require("fs").writeFileSync(${JSON.stringify(pidFile)}, String(g.pid));`,
    `setInterval(() => {}, 1000);`,
  ].join("\n");
  const childFile = join(dir, "child.cjs");
  writeFileSync(childFile, childCode);
  const child = spawn(process.execPath, [childFile], { stdio: "ignore" });
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const size = () => {
    try {
      return statSync(beat).size;
    } catch {
      return 0;
    }
  };
  const waitFor = async (predicate, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (predicate()) return true;
      await sleep(25);
    }
    return predicate();
  };
  const pidAlive = (pid) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch (err) {
      return err?.code === "EPERM";
    }
  };
  try {
    assert.ok(
      await waitFor(() => existsSync(pidFile) && size() >= 3, 8000),
      "the grandchild heartbeat + pid file landed",
    );
    const before = size();
    assert.ok(await waitFor(() => size() > before, 3000), "the grandchild is beating BEFORE the reap");
    const exited = new Promise((resolve) => child.once("exit", resolve));
    reapChildTree(child, "SIGTERM");
    assert.ok(
      await Promise.race([exited.then(() => true), sleep(4000).then(() => false)]),
      "the direct child exited after the reap",
    );
    const gcPid = Number(readFileSync(pidFile, "utf8"));
    assert.ok(Number.isInteger(gcPid) && gcPid > 0, "grandchild pid parsed");
    assert.ok(
      await waitFor(() => !pidAlive(gcPid), 4000),
      "the GRANDCHILD died too — descendants must not survive the reap (M6-03)",
    );
    await sleep(400);
    const settled = size();
    await sleep(900);
    assert.equal(size(), settled, "no heartbeat after the reap — the tree is actually dead");
  } finally {
    try {
      child.kill("SIGKILL");
    } catch {
      /* already gone */
    }
    if (existsSync(pidFile)) {
      try {
        spawn("taskkill", ["/pid", readFileSync(pidFile, "utf8").trim(), "/T", "/F"], {
          windowsHide: true,
          stdio: "ignore",
        });
      } catch {
        /* best-effort sweep */
      }
    }
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* best-effort sweep */
    }
  }
});
