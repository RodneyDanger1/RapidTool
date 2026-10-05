// ---------------------------------------------------------------------------
// delivery-gate.test.mjs — P-B pin for C-06 (substance-based delivery gating).
//
// BL-004 / INC-10 / INC-20: `emit --run --git` committed hollow trees with
// `substance.verdict:"empty"` + `ok:true`. The fix (lane B, B1) withholds the
// commit with code RT_E_SUBSTANCE_EMPTY unless `--allow-empty` is passed.
//
// The pin spawns the REAL CLI over scratch copies of two real fixtures:
//   · office-scheduler — the historical empty tree (must be withheld);
//   · bakery-website v2 — a real tree (the commit must still land).
//
// TODAY this is RED: the CLI still commits the empty tree, so the pin names the
// pending interface (lane B B1 + RT_E_SUBSTANCE_EMPTY). It never edits the CLI.
// ---------------------------------------------------------------------------
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const CLI = join(ROOT, "scripts", "rapidtool-cli.mjs");
const TESTRUNS = existsSync(resolve(ROOT, "..", "testruns")) ? resolve(ROOT, "..", "testruns") : join(ROOT, "testruns");

function runCli(args) {
  const env = { ...process.env };
  // Keyless: emit/scaffold never needs an LLM key, and dropping the ambient
  // key keeps the run deterministic (no shadowed-key notice, no accidental call).
  delete env.DEEPSEEK_API_KEY;
  delete env.NODE_TEST_CONTEXT;
  const res = spawnSync(process.execPath, ["--experimental-strip-types", CLI, ...args], {
    cwd: ROOT,
    env,
    encoding: "utf8",
    timeout: 300_000,
  });
  if (res.error) throw res.error;
  let json = null;
  try {
    json = JSON.parse(res.stdout ?? "");
  } catch {
    /* surfaced by the caller */
  }
  return { status: res.status, json, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

function withScratch(fn) {
  const dir = mkdtempSync(join(tmpdir(), "rt-delivery-gate-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function emit(sourceBuild, dir, label) {
  const project = join(dir, `${label}.json`);
  copyFileSync(sourceBuild, project);
  const out = join(dir, `out-${label}`);
  mkdirSync(out, { recursive: true });
  const res = runCli(["emit", "--project", project, "--out", out, "--run", "--git"]);
  assert.ok(res.json, `emit did not print one JSON envelope (exit ${res.status}).\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  return res.json;
}

test("C-06 emit --run --git must withhold a substance-empty tree", () => {
  withScratch((dir) => {
    const payload = emit(join(TESTRUNS, "office-scheduler", "build.json"), dir, "empty");
    assert.equal(payload.substance?.verdict, "empty", "the fixture reproduces the historical empty-substance census");
    assert.equal(
      payload.git?.committed,
      false,
      `PENDING lane B (B1 / C-06): emit --run --git committed a substance:"empty" tree (substance=${JSON.stringify(payload.substance)}, git=${JSON.stringify(payload.git)}). Add the substance-empty branch to the withhold cascade (scripts/rapidtool-cli.mjs) and set code RT_E_SUBSTANCE_EMPTY unless --allow-empty is passed.`,
    );
    assert.equal(payload.code, "RT_E_SUBSTANCE_EMPTY", "the refusal must carry the registered RT_E_SUBSTANCE_EMPTY code");
    assert.equal(payload.ok, false, "a withheld commit flips ok false");
  });
});

test("C-06 control: the substance gate never withholds a real tree", () => {
  withScratch((dir) => {
    const payload = emit(join(TESTRUNS, "bakery-website", "build.v2.json"), dir, "real");
    assert.ok((payload.substance?.real ?? 0) > 0, `the control tree must carry real modules (substance=${JSON.stringify(payload.substance)})`);
    // The in-flight scaffold may be temporarily red for reasons unrelated to the
    // substance gate (e.g. a JSX namespace error), so assert the GATE behaviour,
    // not the scaffold's greenness: a real tree is never withheld AS empty, and a
    // green real tree does commit.
    assert.ok(
      payload.code !== "RT_E_SUBSTANCE_EMPTY",
      `the substance gate misfired on a real tree (substance=${JSON.stringify(payload.substance)}, code=${payload.code})`,
    );
    if (payload.ok === true) {
      assert.equal(payload.git?.committed, true, "a real, green tree must still land its commit");
    } else {
      assert.notEqual(payload.git?.committed, true, "a red tree-run must not commit");
    }
  });
});
