import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

/**
 * W36 · N6 (OPS-2 coverage gap — fixes/278_p1_remainders.md §REMAINING R9):
 * BEHAVIOR pins for the CLI `fixtures` verb (rapidtool-cli.mjs:1051).
 *
 * Until now the verb had doc parity (README-cli.test.mjs binds the verb list)
 * but NO behavioral leg — the seat refusals, the draft envelope shape and the
 * coded usage refusals were never asserted (the never-caught class). This file
 * closes that gap against a real child process + a real temp project:
 *
 *   1. `--draft` returns the drafting envelope (ok + schema_version + cmd +
 *      exit_code — E-25/OPS-1's shape) and merges the cases into the project
 *      with the brief-hash stamp — every drafted row born `approval:"pending"`
 *      (the "never auto-approves" contract asserted on disk);
 *   2. `--approve` (and `--approve-all`) WITHOUT the human seat is a CODED
 *      policy refusal: `evaluatePolicy("fixtures.approve", …)` requires the
 *      human seat (policy.ts:141), so the autopilot seat gets the deny
 *      envelope (`policy.decision:"deny"`, fallback `human-seat-token`) and
 *      the project file stays byte-identical;
 *   3. `--approve --i-am-human` on a non-TTY is refused by the R5-f12
 *      two-channel seat BEFORE the seam — coded, NO `policy` field, nothing
 *      written — and the refusal bytes are IDENTICAL with and without
 *      `RT_HUMAN_SEAT_TOKEN` exported (Channel A alone is never the seat);
 *   4. usage refusals are coded (RT_E_VALIDATION, never exit 4): neither
 *      --draft nor --approve, and --approve without ids.
 *
 * House rules honored: every CLI call runs in a throwaway temp cwd — never the
 * repo root (AGENTS.md scripts-leg cwd rule) — with a scrubbed env (keyless,
 * no seat token, no actor) unless a test opts in. The fixture project is
 * written by the REAL `create` verb; ONE well-formed A7 oracle row is then
 * seeded into it so `--draft` has a deterministic non-vacuous input (the
 * engine's own OracleTest shape, types.ts:305-311; `importProject` keeps rows
 * with a string `name`, io.ts:221-223; `draftTypedLiterals` then gives every
 * row a `{given:{}, expect:{kind:"shape"}}` literal, brief-fixtures.ts:152).
 * No keyed call, no network: the draft path is deterministic.
 */

const CLI_PATH = fileURLToPath(new URL("./rapidtool-cli.mjs", import.meta.url));

/** Host env keys a test must never inherit (determinism: keyless + tokenless). */
const ENV_DROP = ["DEEPSEEK_API_KEY", "RT_HUMAN_SEAT_TOKEN", "RAPIDTOOL_ACTOR", "RAPIDTOOL_LOG_DIR"];

function runCli(args, opts = {}) {
  const env = { ...process.env };
  for (const key of ENV_DROP) delete env[key];
  Object.assign(env, opts.env ?? {}); // explicit per-test opt-in (e.g. the seat token)
  const res = spawnSync(process.execPath, ["--experimental-strip-types", CLI_PATH, ...args], {
    cwd: opts.cwd,
    env,
    encoding: "utf8",
    timeout: 120_000,
  });
  if (res.error) throw res.error;
  let json = null;
  try {
    json = JSON.parse(res.stdout);
  } catch {
    /* the caller's cliJson surfaces stdout/stderr */
  }
  return { status: res.status, json, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

/** Run the CLI and require one well-formed envelope (E-25 + OPS-1: ok + exit_code). */
function cliJson(args, opts = {}) {
  const out = runCli(args, opts);
  assert.ok(
    out.json,
    `CLI did not print one JSON object (engine exit ${out.status}).\nstdout: ${out.stdout}\nstderr: ${out.stderr}`,
  );
  assert.equal(typeof out.json.ok, "boolean", "every CLI envelope carries the legacy `ok` boolean");
  assert.equal(
    out.json.exit_code,
    out.status,
    "the envelope's exit_code must mirror the real process exit code",
  );
  return out;
}

/** FNV-1a 32-bit — byte-for-byte the src/lib/algorithms.ts `fnv1a` the CLI hashes with. */
function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString();
}

/** Content hash of one file's bytes (before/after byte-identity pins). */
function fileDigest(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

// ---------------------------------------------------------------------------
// Fixture — one throwaway root; the project is written by the REAL `create`
// verb, then seeded with ONE well-formed A7 oracle row (deterministic draft).
// ---------------------------------------------------------------------------

const BRIEF = "HVAC dispatch tool for small teams";
const ORC_ID = "orc-b-dispatch";
const ORC_ROW = {
  id: ORC_ID,
  name: "dispatch assigns a queued job",
  given: "a queued job",
  expect: "a worker id",
  job: "dispatch",
};

const root = mkdtempSync(join(tmpdir(), "rapidtool-cli-fixtures-"));
const BUILD = join(root, "build.json");

const fixtureCreate = cliJson(
  ["create", "--brief", BRIEF, "--name", "W36 N6 Fixtures Fixture", "--out", BUILD],
  { cwd: root },
);
assert.equal(fixtureCreate.json.ok, true, `fixture create failed: ${fixtureCreate.json.error ?? ""}`);

// Seed the A7 row + neutralize any capability list: `--draft` derives its
// typed literals deterministically (`draftTypedLiterals`), so exactly ONE
// case must come back (source "a7", id = the row id).
{
  const seeded = JSON.parse(readFileSync(BUILD, "utf8"));
  seeded.oracle = [ORC_ROW];
  if (seeded.implementationSpec && typeof seeded.implementationSpec === "object") {
    seeded.implementationSpec.requirements = [];
  }
  writeFileSync(BUILD, JSON.stringify(seeded), "utf8");
}

/** Shorthand: one `fixtures` invocation over the shared project. */
const fixtures = (extra, opts = {}) =>
  cliJson(["fixtures", "--project", BUILD, ...extra], { cwd: root, ...opts });

// ---------------------------------------------------------------------------
// 1. `--draft` — the drafting envelope + the on-disk pending invariant.
// ---------------------------------------------------------------------------

test("W36-N6 fixtures: --draft returns the drafting envelope (ok/exit_code) and merges PENDING cases + the brief-hash stamp", () => {
  const out = fixtures(["--draft"]);
  const j = out.json;

  assert.equal(out.status, 0, `a draft must exit 0 (got ${out.status}): ${out.stdout}`);
  assert.equal(j.ok, true);
  assert.equal(j.schema_version, 1, "E-25 schema stamp present");
  assert.equal(j.cmd, "fixtures");
  assert.equal(j.exit_code, 0);
  assert.equal(j.drafted, 1, "one seeded A7 row → exactly one drafted case");
  assert.deepEqual(j.redCards, [], "a well-formed row red-cards nothing");
  assert.equal(j.pending, 1, "every drafted case is born pending");
  assert.equal(j.approvedKept, 0, "a fresh project has no approved rows to keep");
  assert.match(String(j.note), /draft is pending/);
  assert.match(String(j.note), /--approve/);

  // ON DISK — the artifact is the project file, not the report:
  const project = JSON.parse(readFileSync(BUILD, "utf8"));
  assert.equal(project.acceptanceFixtures.length, 1);
  const row = project.acceptanceFixtures[0];
  assert.equal(row.id, ORC_ID);
  assert.equal(row.requirementId, ORC_ID);
  assert.equal(row.capability, "dispatch");
  assert.equal(row.name, ORC_ROW.name);
  assert.deepEqual(row.given, {}, "the deterministic typed literal supplies an empty given");
  assert.deepEqual(row.expect, { kind: "shape", value: { id: "<draft>" } });
  assert.equal(row.kind, "pure");
  assert.equal(row.source, "a7");
  assert.equal(row.approval, "pending", "the drafter NEVER auto-approves");
  assert.equal(
    project.acceptanceBriefHash,
    String(fnv1a(BRIEF)),
    "the stamp must be the FNV-1a of the project's brief (recomputed cross-check)",
  );
  assert.equal("acceptanceApprovedAt" in project, false, "no approved rows → no approval stamp");
});

// ---------------------------------------------------------------------------
// 2. `--approve` without the human seat — the CODED policy refusal.
// ---------------------------------------------------------------------------

test("W36-N6 fixtures: --approve by the autopilot seat is refused by the policy seam (coded deny) and writes nothing", () => {
  const before = fileDigest(BUILD);
  // Both approve arms route through the same seam — the explicit-ids form and
  // --approve-all must both refuse at the seat, never write.
  for (const args of [
    ["--approve", "--ids", ORC_ID],
    ["--approve-all"],
  ]) {
    const out = fixtures(args);
    const j = out.json;

    assert.equal(out.status, 1, `the autopilot seat may never self-approve (${args.join(" ")})`);
    assert.equal(j.ok, false);
    assert.equal(j.code, "RT_E_VALIDATION");
    assert.match(String(j.error), /refused by the policy seam/);
    assert.match(String(j.error), /nothing was written/);
    assert.match(String(j.error), /A human approves with --i-am-human from a terminal/);
    assert.equal(j.policy.action, "fixtures.approve");
    assert.equal(j.policy.decision, "deny");
    assert.equal(j.policy.resource, `fixtures:${BUILD}`);
    assert.match(String(j.policy.reason), /^force-requires-human-seat/);
    assert.match(String(j.policy.reason), /autopilot\/harness seat/);
    assert.equal(j.policy.fallback, "human-seat-token");
  }
  assert.equal(fileDigest(BUILD), before, "a denied approval must leave the project byte-identical");
  const project = JSON.parse(readFileSync(BUILD, "utf8"));
  assert.ok(
    project.acceptanceFixtures.every((c) => c.approval === "pending"),
    "no row may flip approval on a denial",
  );
});

// ---------------------------------------------------------------------------
// 3. `--approve --i-am-human` on a non-TTY — the two-channel seat refusal.
// ---------------------------------------------------------------------------

test("W36-N6 fixtures: --approve --i-am-human on a non-TTY is refused by the SEAT (coded, no policy verdict) — token or no token; nothing written", () => {
  const before = fileDigest(BUILD);
  const args = ["--approve", "--ids", ORC_ID, "--i-am-human"];
  const withToken = fixtures(args, { env: { RT_HUMAN_SEAT_TOKEN: "w36-n6-fixtures-token" } });
  const withoutToken = fixtures(args);

  for (const out of [withToken, withoutToken]) {
    const j = out.json;
    assert.equal(out.status, 1, "a non-TTY seat claim can never succeed");
    assert.equal(j.ok, false);
    assert.equal(j.code, "RT_E_VALIDATION");
    assert.equal("policy" in j, false, "the refusal fires BEFORE the seam — no verdict exists");
    assert.match(String(j.error), /^fixtures: --i-am-human refused/);
    assert.match(String(j.error), /needs an interactive confirmation/);
    assert.match(String(j.error), /not a TTY/);
    assert.match(String(j.error), /RT_HUMAN_SEAT_TOKEN/);
  }
  assert.equal(
    withToken.json.error,
    withoutToken.json.error,
    "the env token must change NOTHING — the missing TTY is the refusal, not the token (Channel A alone is never the seat)",
  );
  assert.equal(fileDigest(BUILD), before, "a refused seat claim must leave the project byte-identical");
  const project = JSON.parse(readFileSync(BUILD, "utf8"));
  assert.ok(
    project.acceptanceFixtures.every((c) => c.approval === "pending"),
    "a refused seat claim approves nothing",
  );
});

// ---------------------------------------------------------------------------
// 4. Usage refusals — coded, never exit 4, nothing written.
// ---------------------------------------------------------------------------

test("W36-N6 fixtures: usage refusals are coded (RT_E_VALIDATION) — no --draft/--approve, and --approve without ids", () => {
  const before = fileDigest(BUILD);

  const noFlag = fixtures([]);
  assert.equal(noFlag.status, 1);
  assert.equal(noFlag.json.ok, false);
  assert.equal(noFlag.json.code, "RT_E_VALIDATION");
  assert.match(String(noFlag.json.error), /requires --draft or --approve/);

  const noIds = fixtures(["--approve"]);
  assert.equal(noIds.status, 1);
  assert.equal(noIds.json.ok, false);
  assert.equal(noIds.json.code, "RT_E_VALIDATION");
  assert.match(String(noIds.json.error), /needs --ids id1,id2 or --approve-all/);

  assert.equal(fileDigest(BUILD), before, "usage refusals must never touch the project");
});
