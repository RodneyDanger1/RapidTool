// ---------------------------------------------------------------------------
// diagnose-audit.test.mjs — fixes/348 (W1) wiring guard for the CLI `diagnose`
// verb. Before W1 the verb never passed `audit` to buildDiagnosis, so the
// per-phase `project.stages` was ALWAYS `[]` with a `no per-phase audit
// supplied` gap even when the loaded project held the facts; `buildPipelineReview`
// had no consumer; and every `cli.invocation` exit row omitted the REQUIRED
// `capture` and carried `phase: null` (rt-events.ts:110).
//
// This leg is BEHAVIORAL: it spawns the real CLI (never imports it) against a
// COPY of a REAL persisted project (campaign2/office-invoice-tracker/build.json
// from the sibling testruns junction) with RAPIDTOOL_LOG_DIR pointed at a
// throwaway temp dir — so the fixture on disk is never mutated. It pins:
//   1. `project.stages` is non-empty and derived from the project (P6 gate red);
//   2. the additive top-level `review` is present (buildPipelineReview, 347);
//   3. the emitted `cli.invocation` row carries a real `capture`
//      ("scripts/rapidtool-cli.mjs:<line>" of the emit site) and a real
//      `phase` (the loaded project's currentPhase);
//   4. no `--project` still exits 0 with `review: null` and the honest gap.
//
// House rule honored: cwd-independent (paths via import.meta.url).
// Run: node --test scripts/diagnose-audit.test.mjs
// ---------------------------------------------------------------------------
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const CLI_PATH = fileURLToPath(new URL("./rapidtool-cli.mjs", import.meta.url));
const cliText = readFileSync(CLI_PATH, "utf8");
const FIXTURE = fileURLToPath(
  new URL("../../testruns/campaign2/office-invoice-tracker/build.json", import.meta.url),
);

/** The scrub set the other scripts-leg tests use (keyless, seatless, no env log dir). */
function scrubEnv() {
  const env = { ...process.env };
  for (const key of ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"]) {
    delete env[key];
  }
  return env;
}

test("348 (W1): diagnose --project carries real per-phase stages + the pipeline review, and stamps capture/phase on its exit row", () => {
  assert.ok(
    existsSync(FIXTURE),
    `the real fixture must exist for this wiring guard: ${FIXTURE} (sibling testruns junction).`,
  );
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-diagnose-audit-"));
  const env = scrubEnv();
  const logDir = join(cwd, "logs");
  mkdirSync(logDir, { recursive: true });
  env.RAPIDTOOL_LOG_DIR = logDir; // keep the fixture's own log untouched
  try {
    const proj = join(cwd, "build.json");
    copyFileSync(FIXTURE, proj);
    const res = spawnSync(
      process.execPath,
      ["--experimental-strip-types", CLI_PATH, "diagnose", "--project", proj],
      { cwd, env, encoding: "utf8", timeout: 120_000 },
    );
    assert.equal(res.error, undefined, `spawn failed: ${String(res.error)}`);
    const stderr = res.stderr ?? "";
    assert.ok(!/(^|\n)\s+at\s/.test(stderr), `diagnose must never print a Node stack:\n${stderr}`);
    assert.equal(res.status, 0, `diagnose must exit 0.\nstdout: ${res.stdout}\nstderr: ${stderr}`);
    const json = JSON.parse(res.stdout);
    assert.equal(json.ok, true);
    assert.equal(json.exit_code, res.status, "the envelope's exit_code must equal the process exit");

    // 1. Per-phase stages are REAL — derived from the loaded project, not the
    //    empty [] + "no per-phase audit supplied" gap every run used to carry.
    assert.ok(Array.isArray(json.project.stages), "project.stages is an array");
    assert.ok(json.project.stages.length > 0, "the audit must yield real per-phase rows");
    assert.equal(
      /no per-phase audit supplied/.test(json.project.stagesGap ?? ""),
      false,
      `a loaded project supplies the audit: ${json.project.stagesGap}`,
    );
    const p6 = json.project.stages.find((s) => s.phase === 6);
    assert.ok(p6, "the fixture's P6 record projects (the campaign-2 project walked P0..P6)");
    assert.equal(p6.observed, true, "P6 carries observed facts");
    assert.equal(p6.status, "awaiting_hitl", "P6's real persisted status is surfaced verbatim");
    assert.ok(p6.gate === null, "P6 has no recorded gate yet — the audit reads null, never a fabricated verdict");
    // An earlier COMPLETE phase carries its green gate record verbatim.
    const p0 = json.project.stages.find((s) => s.phase === 0);
    assert.ok(p0 && p0.gate && p0.gate.passed === true, "a completed phase's green gate record is projected");
    // The project-level spend is surfaced from the same project record.
    assert.ok(json.project.keyed && json.project.keyed.calls !== null, "the project's tokenUsage rides project.keyed");

    // 2. The pipeline review (347) is reachable from the CLI envelope.
    assert.ok(json.review && typeof json.review === "object", "the additive top-level `review` is present");
    assert.ok(Array.isArray(json.review.stages) && json.review.stages.length > 0, "the review carries its stage rows");
    assert.equal(json.review.project.status, json.project.status, "the review reads the SAME loaded project");

    // 3. The cli.invocation exit row carries capture + phase.
    const logText = readdirSync(logDir)
      .filter((f) => f.endsWith(".ndjson"))
      .map((f) => readFileSync(join(logDir, f), "utf8"))
      .join("\n");
    const rows = logText.split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
    const invocations = rows.filter((r) => r.event === "cli.invocation" && r.payload?.cmd === "diagnose");
    assert.equal(invocations.length, 1, "the diagnose run stamps exactly ONE cli.invocation row");
    const row = invocations[0];
    assert.match(
      String(row.capture),
      /^scripts\/rapidtool-cli\.mjs:\d+$/,
      `RTEventSeed.capture is REQUIRED — the exit row must name its emit site, got ${JSON.stringify(row.capture)}`,
    );
    const lineNo = Number(String(row.capture).split(":").pop());
    const emitLine = cliText.split(/\r?\n/)[lineNo - 1] ?? "";
    assert.match(
      emitLine,
      /cliLogEvent\(/,
      `capture must point at the REAL emit site — line ${lineNo} reads: ${JSON.stringify(emitLine)}`,
    );
    assert.equal(
      row.phase,
      json.project.currentPhase,
      "the exit row's phase is the loaded project's current phase (never a guessed value)",
    );
    assert.equal(typeof row.phase, "number", "the fixture is mid-run, so phase is a real number, not the null floor");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("348 (W1): diagnose with no --project stays honest — review null, the named no-audit gap, phase null in the exit row", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rapidtool-cli-diagnose-noaudit-"));
  const env = scrubEnv();
  const logDir = join(cwd, "logs");
  mkdirSync(logDir, { recursive: true });
  env.RAPIDTOOL_LOG_DIR = logDir;
  try {
    const res = spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, "diagnose"], {
      cwd,
      env,
      encoding: "utf8",
      timeout: 120_000,
    });
    assert.equal(res.status, 0, `diagnose (no project) must exit 0.\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    const json = JSON.parse(res.stdout);
    assert.equal(json.ok, true);
    assert.deepEqual(json.project.stages, [], "no project → no per-phase rows");
    assert.ok(/no per-phase audit supplied/.test(json.project.stagesGap ?? ""), "the gap is named, never silent");
    assert.equal(json.review, null, "no project → the review is the honest null (never a fabricated empty project)");
    const logText = readdirSync(logDir)
      .filter((f) => f.endsWith(".ndjson"))
      .map((f) => readFileSync(join(logDir, f), "utf8"))
      .join("\n");
    const row = logText
      .split(/\r?\n/)
      .filter(Boolean)
      .map((l) => JSON.parse(l))
      .find((r) => r.event === "cli.invocation");
    assert.ok(row, "the no-project run still stamps its exit row");
    assert.equal(row.phase, null, "no project loaded → the honest null phase");
    assert.match(String(row.capture), /^scripts\/rapidtool-cli\.mjs:\d+$/, "capture is stamped on every exit row");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
