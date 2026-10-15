// ---------------------------------------------------------------------------
// scripts/rapidtool-cli-352.test.mjs — the W352 CLI-boundary fix suite.
//
// One test per audited defect in `scripts/rapidtool-cli.mjs` (bugs 1–10) plus
// the `acceptance-run.mjs` keyless / front-matter fixes (bugs 3–4). Behavioral
// CLI spawns use a scratch cwd with DEEPSEEK_API_KEY="" (forced keyless), and
// the static pins read the CLI's own bytes for the seams a spawn cannot cheaply
// provoke (a live-writer lock, a mid-run repo edit).
// ---------------------------------------------------------------------------
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { briefFromFrontmatter, readBriefSpec } from "./acceptance-run.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const CLI = join(HERE, "rapidtool-cli.mjs");
const CLI_SRC = readFileSync(CLI, "utf8");

const keylessEnv = () => {
  const env = { ...process.env, DEEPSEEK_API_KEY: "" };
  for (const key of ["RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR", "RAPIDTOOL_LEDGER_FILE", "RAPIDTOOL_CAMPAIGN_TOKEN_CAP"]) {
    delete env[key];
  }
  return env;
};

/** @param {string[]} args @param {{ cwd?: string; env?: NodeJS.ProcessEnv }} [opts] */
function runCli(args, { cwd = ROOT, env } = {}) {
  return spawnSync(process.execPath, ["--experimental-strip-types", CLI, ...args], {
    cwd,
    env: env ?? keylessEnv(),
    encoding: "utf8",
    timeout: 180_000,
    maxBuffer: 64 * 1024 * 1024,
  });
}

function parse(res) {
  try {
    return JSON.parse(res.stdout);
  } catch {
    throw new Error(`CLI stdout was not one JSON object:\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  }
}

function makeProject(cwd, name) {
  const out = join(cwd, `${name}.json`);
  const res = runCli(["create", "--brief", `A field-service dispatch board for HVAC technicians, ${name}.`, "--name", name, "--out", out], { cwd });
  assert.equal(res.status, 0, `create failed.\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
  return out;
}

// --- bug 1 -----------------------------------------------------------------
test("W352 bug1: diagnose --project <missing> refuses coded at exit 1 (never ok:true)", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rt352-diagnose-"));
  try {
    const res = runCli(["diagnose", "--project", join(cwd, "nope.json")], { cwd });
    assert.equal(res.status, 1, `a missing project is a usage refusal.\nstdout: ${res.stdout}\nstderr: ${res.stderr}`);
    const json = parse(res);
    assert.equal(json.ok, false);
    assert.equal(json.code, "RT_E_PROJECT_MISSING", "the same class every other verb refuses with");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// --- bug 2 (static pin: RUNLOCK + outcome on the resume/unattended mapper) --
test("W352 bug2: the resume/unattended outcome mapper carries RUNLOCK + outcome", () => {
  const mapper = CLI_SRC.slice(CLI_SRC.indexOf("function respondDriveOutcome"), CLI_SRC.indexOf("async function saveProjectBusyOrRefuse"));
  assert.match(mapper, /runlockEditViolations\(REPO_ROOT, runlockStartMs\)/, "the mapper must run the RUNLOCK scan");
  assert.match(mapper, /RT_E_SRC_EDITED_DURING_RUN/, "a mid-run repo edit must refuse coded");
});

test("W352 bug2: unattended/resume arms stamp the run window and pass outcome through", () => {
  // The arms must stamp runlockStartMs before the drive AND hand it to the mapper.
  const resumeArm = CLI_SRC.slice(CLI_SRC.indexOf('case "resume":'), CLI_SRC.indexOf('case "unattended":'));
  assert.match(resumeArm, /const runlockStartMs = Date\.now\(\)/, "resume stamps the run window");
  assert.match(resumeArm, /runlockStartMs,/, "resume passes the window to the mapper");
  const unattendedArm = CLI_SRC.slice(CLI_SRC.indexOf('case "unattended":'), CLI_SRC.indexOf('case "approve":'));
  assert.match(unattendedArm, /const runlockStartMs = Date\.now\(\)/, "unattended stamps the run window");
  assert.match(unattendedArm, /runlockStartMs,/, "unattended passes the window to the mapper");
  const mapper = CLI_SRC.slice(CLI_SRC.indexOf("function respondDriveOutcome"), CLI_SRC.indexOf("async function saveProjectBusyOrRefuse"));
  assert.ok((mapper.match(/outcome: res\.outcome/g) ?? []).length >= 3, "every ok/refusal branch carries outcome");
});

// --- bug 5 -----------------------------------------------------------------
test("W352 bug5: `--token-ledger=` (empty value) is refused, never a silent cap disable", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rt352-ledger-"));
  try {
    const res = runCli(["mine", "--dir", cwd, "--token-ledger="], { cwd });
    assert.equal(res.status, 1, `an empty ledger path must refuse.\nstdout: ${res.stdout}`);
    const json = parse(res);
    assert.equal(json.code, "RT_E_VALIDATION");
    assert.match(String(json.error), /--token-ledger needs a value/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// --- bug 8 -----------------------------------------------------------------
test("W352 bug8: scan findings carry an explicit code, never RT_E_UNKNOWN", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rt352-scan-"));
  try {
    writeFileSync(join(cwd, "a.ts"), "export function f(): void {\n  try { g(); } catch {}\n}\nfunction g(): void {}\n", "utf8");
    const res = runCli(["scan", "--dir", cwd], { cwd });
    assert.equal(res.status, 1, `findings exit 1.\nstdout: ${res.stdout}`);
    const json = parse(res);
    assert.equal(json.ok, false);
    assert.equal(json.code, "RT_E_CHECK_FAILED", "the check family's any-fail class, never opaque");
    assert.ok(Array.isArray(json.findings) && json.findings.length > 0, "the findings payload is intact");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// --- bug 10 -----------------------------------------------------------------
test("W352 bug10a: ingest --report @missing is a usage class, not RT_E_PROJECT_MISSING", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rt352-ingest-"));
  try {
    const proj = makeProject(cwd, "Ingest352");
    const res = runCli(["ingest", "--project", proj, "--report", `@${join(cwd, "absent-report.json")}`], { cwd });
    assert.equal(res.status, 1, `stdout: ${res.stdout}`);
    const json = parse(res);
    assert.equal(json.code, "RT_E_VALIDATION", "a missing REPORT source is not a missing project");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("W352 bug10b: tree-run/check on a missing dir refuse RT_E_VALIDATION, not a red verdict", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rt352-dirs-"));
  try {
    const missing = join(cwd, "not-there");
    const tr = runCli(["tree-run", "--dir", missing], { cwd });
    assert.equal(tr.status, 1);
    assert.equal(parse(tr).code, "RT_E_VALIDATION", "a missing dir is a usage error, never a synthetic red tree");
    const ck = runCli(["check", "--dir", missing], { cwd });
    assert.equal(ck.status, 1);
    assert.equal(parse(ck).code, "RT_E_VALIDATION", "a missing dir is a usage error, never a red compile verdict");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("W352 bug10c: wild --steps 0 is refused, never silently defaulted", () => {
  const res = runCli(["wild", "--steps", "0", "--project", "x.json"]);
  assert.equal(res.status, 1, `stdout: ${res.stdout}`);
  const json = parse(res);
  assert.equal(json.code, "RT_E_VALIDATION");
  assert.match(String(json.error), /--steps expects a positive integer/);
});

test("W352 bug10d: emit --require-verified without --run is refused, never a silent no-op", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rt352-require-"));
  try {
    const proj = makeProject(cwd, "Require352");
    const res = runCli(["emit", "--project", proj, "--out", join(cwd, "out"), "--require-verified"], { cwd });
    assert.equal(res.status, 1, `stdout: ${res.stdout}`);
    const json = parse(res);
    assert.equal(json.code, "RT_E_VALIDATION");
    assert.match(String(json.error), /--require-verified requires --run/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("W352 bug10e: an unknown flag is refused, never absorbed", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rt352-unknown-"));
  try {
    const res = runCli(["mine", "--dir", cwd, "--gti"], { cwd });
    assert.equal(res.status, 1, `stdout: ${res.stdout}`);
    const json = parse(res);
    assert.equal(json.code, "RT_E_VALIDATION");
    assert.match(String(json.error), /unknown flag --gti/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// --- guard: KNOWN_FLAGS parity with the source (bug10e's registry) ----------
// The CLI refuses any flag absent from KNOWN_FLAGS, so a flag the CLI itself
// references (help text or an args/flag(args,…) read) but does not register
// would be refused at runtime. This pins the invariant the registry's own
// comment claims: every `--flag` token in the CLI source (comments excluded)
// is registered. A new flag that ships unregistered now fails HERE.
test("W352 bug10e-guard: every --flag the CLI references is registered in KNOWN_FLAGS", () => {
  // Strip comments so a `--flag` mentioned in prose is not read as a reference.
  // The `[^:]` guard keeps the `//` in an `https://…` string literal intact.
  const code = CLI_SRC.replace(/\/\*[\s\S]*?\*\//g, "\n").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
  const knownMatch = code.match(/const KNOWN_FLAGS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(knownMatch, "the KNOWN_FLAGS registry must be present in the CLI source");
  const known = new Set([...knownMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]));
  assert.ok(known.size >= 50, `KNOWN_FLAGS parsed too small (${known.size}) — the registry shape changed`);
  const referenced = new Set([...code.matchAll(/--([a-z][a-z0-9-]+)\b/g)].map((m) => m[1]));
  const missing = [...referenced].filter((f) => !known.has(f)).sort();
  assert.deepEqual(
    missing,
    [],
    `CLI flags missing from KNOWN_FLAGS (they would be refused pre-dispatch): ${missing.join(", ")}`,
  );
  for (const f of known) assert.match(f, /^[a-z][a-z0-9-]*$/, `KNOWN_FLAGS entry "${f}" is not a lower-kebab flag`);
});

// --- bug 6 -----------------------------------------------------------------
test("W352 bug6: emit --red-tree banner --git without --run withholds a red-trail commit", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rt352-redhold-"));
  try {
    const proj = makeProject(cwd, "RedHold352");
    const doc = JSON.parse(readFileSync(proj, "utf8"));
    doc.logs = [
      ...(Array.isArray(doc.logs) ? doc.logs : []),
      { ts: Date.now(), phase: 6, level: "error", event: "p6.tree.failure", detail: "entry module exited 1" },
    ];
    writeFileSync(proj, JSON.stringify(doc, null, 2), "utf8");
    const res = runCli(["emit", "--project", proj, "--out", join(cwd, "out"), "--red-tree", "banner", "--git"], { cwd });
    assert.equal(res.status, 1, `a red-trail tree must not commit.\nstdout: ${res.stdout}`);
    const json = parse(res);
    assert.equal(json.ok, false);
    assert.equal(json.git?.committed, false, "no commit over an uncleared red trail");
    assert.equal(json.git?.reason, "substance-empty");
    assert.equal(json.git?.code, "RT_E_SUBSTANCE_EMPTY");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

// --- bug 9 (static pin: the six single-decision verbs use the busy-aware save)
test("W352 bug9: approve/reject/retry/ingest/wild/deepen save busy-aware (exit 1, not exit 4)", () => {
  assert.match(CLI_SRC, /async function saveProjectBusyOrRefuse/, "the helper exists");
  for (const call of [
    "await saveProjectBusyOrRefuse(h, approvePath, updated)",
    "await saveProjectBusyOrRefuse(h, rejectPath, updated)",
    "await saveProjectBusyOrRefuse(h, retryPath, updated)",
    "await saveProjectBusyOrRefuse(h, path, res.project)",
  ]) {
    assert.ok(CLI_SRC.includes(call), `missing busy-aware save: ${call}`);
  }
  // wild + deepen are reached via the same helper.
  assert.ok((CLI_SRC.match(/saveProjectBusyOrRefuse\(h, path, res\.project\)/g) ?? []).length >= 1, "wild/deepen use the helper");
  assert.match(CLI_SRC, /code: "RT_E_BUSY"/, "a busy save refuses the documented class");
});

// --- bug 7 (static pin: the delivery record is not hardcoded committed:true) --
test("W352 bug7: the delivery verification record reflects the real commit/no-op", () => {
  const fn = CLI_SRC.slice(CLI_SRC.indexOf("async function deliveryVerification"), CLI_SRC.indexOf("// 330 Switchboard (T4): the ONE"));
  assert.match(fn, /committed: committed === true/);
  assert.match(fn, /noop: noop === true/);
  assert.ok(!/committed: true,\n\s*treeRunOk/.test(fn), "the hardcoded committed:true is gone");
  assert.match(CLI_SRC, /committed: landed\.committed,/);
});

// --- acceptance-run bugs 3 & 4 ---------------------------------------------
test("W352 bug4: acceptance-run unwraps a corpus YAML front-matter brief (parity with create)", () => {
  assert.equal(briefFromFrontmatter('---\nslug: x\nbrief: "Build a rivertown tool library"\n---\nbody\n'), "Build a rivertown tool library");
  assert.equal(briefFromFrontmatter("no frontmatter"), null);
  assert.equal(briefFromFrontmatter("---\nslug: x\n---\nno brief scalar\n"), null, "a fence without brief: stays null");
});

test("W352 bug4: a front-matter corpus FILE is unwrapped before the lattice sees it", () => {
  const cwd = mkdtempSync(join(tmpdir(), "rt352-fm-"));
  try {
    const file = join(cwd, "house-flip-manager.md");
    writeFileSync(file, '---\nslug: house-flip-manager\nbrief: Track renovation budgets per property\n---\n## Body\nFront matter must never reach the lattice.\n', "utf8");
    const spec = readBriefSpec(file);
    assert.equal(spec.ok, true);
    assert.equal(spec.brief, "Track renovation budgets per property");
    assert.equal(spec.frontmatterUnwrapped, true);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("W352 bug3: --keyless disables an ambient key (keylessEnforced true)", { timeout: 180_000 }, () => {
  const cwd = mkdtempSync(join(tmpdir(), "rt352-keyless-"));
  try {
    const env = { ...keylessEnv(), DEEPSEEK_API_KEY: "sk-ambient-should-not-be-used-0000" };
    const res = spawnSync(
      process.execPath,
      ["--experimental-strip-types", join(HERE, "acceptance-run.mjs"), "--keyless", "--brief", "Build a small library tool for a community center."],
      { cwd, env, encoding: "utf8", timeout: 180_000, maxBuffer: 64 * 1024 * 1024 },
    );
    const json = parse(res);
    assert.equal(json.keyed, false);
    assert.equal(json.keySource, "disabled-by-flag");
    assert.equal(json.keylessEnforced, true, "the ambient key must be blanked, not merely ignored");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
