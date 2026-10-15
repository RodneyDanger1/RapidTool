// ---------------------------------------------------------------------------
// scripts/fixes352-pipeline.test.mjs — W352 pipeline/launcher fix suite.
//
// Unit coverage for the audited defects in the build/launch tooling:
//   bug 11  launch-rapidtool stop corroborates the pidfile pid's command line
//   bug 12  a failed netstat probe is never read as "the port is free"
//   bug 13  preview.mjs honours the PORT override vite.config.ts honours
//   bug 14  write-atomic reclaims the parent dirs a failed rename created
//   bug 15  pid-named temp files are swept after a crash
//   bug 16  the run-eval crash tombstone re-checks the out-dir refusal
// ---------------------------------------------------------------------------
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const HERE = dirname(fileURLToPath(import.meta.url));

const { looksLikeLaunchProcess, winProcessCommandLine, winPortPids } = await import("./launch-rapidtool.mjs");
const { resolvePreviewPort } = await import("./preview.mjs");
const { handOver } = await import("./write-atomic.mjs");
const { sweepStaleStateTemps } = await import("./factory-watch.mjs");
const { sweepStaleJsonTemps, writeCrashTombstone } = await import("./run-eval.mjs");
const ROOT = resolve(HERE, "..");

// --- bug 11 -----------------------------------------------------------------
test("W352 bug11: the pidfile pid is corroborated by its command line before taskkill", () => {
  assert.equal(looksLikeLaunchProcess("node scripts/with-app-env.mjs vite preview"), true, "the launcher's own child");
  assert.equal(looksLikeLaunchProcess("C:\\WINDOWS\\system32\\notepad.exe C:\\x.txt"), false, "an unrelated process must never match");
  assert.equal(looksLikeLaunchProcess("node scripts/preview.mjs stop"), false, "this tooling's own preview script is never a target");
  assert.equal(looksLikeLaunchProcess(""), false, "an unreadable command line cannot corroborate");
  // The real reader against a live pid (ours) returns a non-matching command line.
  const mine = winProcessCommandLine(process.pid);
  assert.equal(typeof mine, "string");
  assert.equal(looksLikeLaunchProcess(mine), false, "a bare node process is not the preview tree");
});

// --- bug 12 -----------------------------------------------------------------
test("W352 bug12: a failed netstat probe reports ok:false (never a false 'port free')", () => {
  const failed = winPortPids(8081, { spawn: () => ({ status: 1, stdout: "", error: undefined }) });
  assert.equal(failed.ok, false, "a non-zero netstat must not yield a clean empty list");
  const threw = winPortPids(8081, { spawn: () => ({ status: null, stdout: null, error: new Error("ENOENT") }) });
  assert.equal(threw.ok, false);
  assert.match(String(threw.error), /ENOENT/);
  const good = winPortPids(8081, {
    spawn: () => ({ status: 0, stdout: "  TCP    127.0.0.1:8081    0.0.0.0:0    LISTENING    4242\n" }),
  });
  assert.equal(good.ok, true);
  assert.deepEqual(good.pids, [4242]);
});

// --- bug 13 -----------------------------------------------------------------
test("W352 bug13: preview.mjs resolves the same PORT override vite.config.ts honours", () => {
  assert.equal(resolvePreviewPort("9001"), 9001);
  assert.equal(resolvePreviewPort(undefined), 8081, "the documented default");
  assert.equal(resolvePreviewPort(""), 8081, "a blank override falls back");
  assert.equal(resolvePreviewPort("abc"), 8081, "junk falls back");
  assert.equal(resolvePreviewPort("0"), 8081, "out of range falls back");
});

// --- bug 14 -----------------------------------------------------------------
test("W352 bug14: a failed rename reclaims the parent dirs this hand-over created", () => {
  const root = mkdtempSync(join(tmpdir(), "rt352-wa-"));
  try {
    const staged = join(root, "staged.tmp");
    writeFileSync(staged, "new card");
    const target = join(root, "src", "lib", "og", "site.json");
    const denied = Object.assign(new Error("EACCES"), { code: "EACCES" });
    assert.throws(() => handOver(staged, target, { rename: () => { throw denied; } }), /EACCES/);
    assert.equal(existsSync(join(root, "src")), false, "the created ancestry is reclaimed after the failed rename");
    assert.equal(readFileSync(staged, "utf8"), "new card", "the staged file is never consumed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// --- bug 15 -----------------------------------------------------------------
test("W352 bug15: pid-named temp files are swept after a crash (factory-watch)", () => {
  const dir = mkdtempSync(join(tmpdir(), "rt352-fw-"));
  try {
    const statePath = join(dir, "factory-state.json");
    writeFileSync(`${statePath}.tmp-999999`, "{}", "utf8"); // a dead writer's orphan
    writeFileSync(`${statePath}.tmp-${process.ppid}`, "{}", "utf8"); // a live writer's temp
    const swept = sweepStaleStateTemps(statePath);
    assert.deepEqual(swept, ["factory-state.json.tmp-999999"]);
    assert.equal(existsSync(`${statePath}.tmp-999999`), false, "the orphan is reclaimed");
    assert.equal(existsSync(`${statePath}.tmp-${process.ppid}`), true, "a live writer's temp is untouched");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("W352 bug15: pid-named temp files are swept after a crash (run-eval)", () => {
  const dir = mkdtempSync(join(tmpdir(), "rt352-re-"));
  try {
    const target = join(dir, "results.json");
    writeFileSync(`${target}.999999.tmp`, "{}", "utf8");
    writeFileSync(`${target}.${process.ppid}.tmp`, "{}", "utf8");
    const swept = sweepStaleJsonTemps(target);
    assert.deepEqual(swept, ["results.json.999999.tmp"]);
    assert.equal(existsSync(`${target}.999999.tmp`), false);
    assert.equal(existsSync(`${target}.${process.ppid}.tmp`), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// --- bug 16 -----------------------------------------------------------------
test("W352 bug16: the run-eval crash tombstone re-checks the out-dir refusal before writing", () => {
  // B1-F10: BEHAVIOURAL — call the REAL crash handler (`writeCrashTombstone`,
  // the body of `main().catch`) instead of matching its source text.
  // (1) A REFUSED out-dir (the un-chosen in-repo default) writes NOTHING, so the
  //     tracked scorecard is never rewritten from the crash path.
  const refusedTarget = join(ROOT, "research", "eval-out", "results.json");
  const before = existsSync(refusedTarget) ? readFileSync(refusedTarget, "utf8") : null;
  const refused = writeCrashTombstone(new Error("pin crash"), {
    outDir: join(ROOT, "research", "eval-out"),
    explicit: false,
    resultsPath: refusedTarget,
    mode: "keyless",
  });
  assert.equal(refused.refused, true, "the crash path RE-DERIVES the out-dir guard (a refusal is reported)");
  assert.equal(refused.written, false, "a refused dir is never rewritten from the crash path");
  assert.match(String(refused.message), /refusing to write eval artifacts into the repo/, "the refusal carries the guard's own message");
  const after = existsSync(refusedTarget) ? readFileSync(refusedTarget, "utf8") : null;
  assert.equal(after, before, "the tracked results.json bytes are untouched by the refused crash path");
  // (2) Control: an EXPLICIT, writable out-dir DOES get the atomic tombstone —
  //     no fabricated verdict, the crash message verbatim.
  const dir = mkdtempSync(join(tmpdir(), "rt352-crash-"));
  try {
    const ok = writeCrashTombstone(new Error("pin crash"), {
      outDir: dir,
      explicit: true,
      resultsPath: join(dir, "results.json"),
      mode: "keyless",
    });
    assert.equal(ok.written, true, "an explicit out-dir gets the tombstone");
    const written = JSON.parse(readFileSync(join(dir, "results.json"), "utf8"));
    assert.deepEqual(written.entries, [], "a crash tombstone carries no fabricated verdict");
    assert.equal(written.error, "pin crash", "the crash message is recorded verbatim");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
