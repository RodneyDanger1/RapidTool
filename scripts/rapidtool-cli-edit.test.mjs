import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

/**
 * W9-L3 (wave_plans/W9/lane-3.md; fixes/216s §1–4) — BEHAVIOR suite for the CLI
 * `edit` verb (216s · 108-T1, landed at rapidtool-cli.mjs:1115 by W8-L3; the
 * contract tests live in README-cli.test.mjs, this file pins the REAL behavior).
 *
 * What is pinned here, against a real child process + a real temp dir:
 *   1. dry-run (the DEFAULT) never writes — the tree dir is byte-identical
 *      before/after, the diff + would-be hashes come back, no ledger row lands;
 *   2. ambiguous / missing / no-op matches are coded refusals — exit 1,
 *      `RT_E_VALIDATION`, `written:false`, nothing on disk changes;
 *   3. `--write` (which REFUSES without `--project` — attribution is a
 *      precondition, not an afterthought) applies the patch and lands exactly
 *      ONE ledger row carrying actor + `decidedVia` provenance + the patch +
 *      before/after hashes — asserted against the bytes on disk (the reported
 *      `hashAfter` is recomputed from the file the write really produced);
 *   4. the TWO-CHANNEL seat (R5-f12) at the ONE policy seam
 *      (`evaluatePolicy("repair.apply", tree:<dir>)`) — a non-TTY
 *      `--i-am-human` claim (this suite's spawned children) is REFUSED before
 *      the seam: exit 1, coded, nothing written, NO `policy` verdict on the
 *      envelope — even when `RT_HUMAN_SEAT_TOKEN` is exported. (The seat's
 *      positive path needs a TTY re-entry a child cannot fake; it stays at
 *      the library seam — headless.test.ts.)
 *   5. containment — a `--file` that escapes `--dir` (relative `..` segment or
 *      an absolute path) is refused and the outside file is untouched.
 *
 * House rules honored: every CLI call runs in a throwaway temp cwd — never the
 * repo root (AGENTS.md scripts-leg cwd rule) — with a scrubbed env (keyless,
 * no seat token, no actor) unless a test opts in. The local `fnv1a` copy is
 * self-checking: if it ever drifts from src/lib/algorithms.ts, the CLI-reported
 * hashes stop matching the recomputed on-disk hashes and these tests go RED.
 * (A local copy is required because the scripts leg runs WITHOUT
 * --experimental-strip-types and cannot import the .ts module.)
 */

const CLI_PATH = fileURLToPath(new URL("./rapidtool-cli.mjs", import.meta.url));

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

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
    /* the caller's assert.ok(out.json, …) surfaces stdout/stderr */
  }
  return { status: res.status, json, stdout: res.stdout ?? "", stderr: res.stderr ?? "" };
}

/** Run the CLI and require one well-formed envelope (E-25: ok + exit_code). */
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

/** Content hash of a directory tree (paths + bytes), for before/after equality pins. */
function dirDigest(root) {
  const hash = createHash("sha256");
  const walk = (dir, prefix) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      const rel = `${prefix}${name}`;
      if (statSync(full).isDirectory()) walk(full, `${rel}/`);
      else {
        hash.update(rel);
        hash.update("\0");
        hash.update(readFileSync(full));
        hash.update("\0");
      }
    }
  };
  walk(root, "");
  return hash.digest("hex");
}

/** Content hash of one file's bytes. */
function fileDigest(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** True when any `*.edit-*.tmp` staging file survives anywhere under `root`. */
function hasStagingLeftovers(root) {
  for (const name of readdirSync(root)) {
    const full = join(root, name);
    if (statSync(full).isDirectory()) {
      if (hasStagingLeftovers(full)) return true;
    } else if (/\.edit-.*\.tmp$/.test(name)) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Fixtures — one throwaway tree per file, seeded with emitted-style sources.
// `build.json` is written by the REAL `create` verb, so the ledger the write
// path appends to is the engine's own, not a hand-rolled stub.
// ---------------------------------------------------------------------------

const SEEDED = "export function add(a, b) {\n  return a + b;\n}\n";
const PATCHED_SUB = "export function add(a, b) {\n  return a - b;\n}\n";
const PATCHED_MUL = "export function add(a, b) {\n  return a * b;\n}\n";
const PATCHED_DIV = "export function add(a, b) {\n  return a / b;\n}\n";
const DUP = "export const x = 1;\nexport const y = 1;\n";
const SECRET = 'export const secret = "OUTSIDE-NEEDLE";\n';

const root = mkdtempSync(join(tmpdir(), "rapidtool-cli-edit-"));
const TREE = join(root, "tree");
const OUTSIDE = join(root, "outside");
const BUILD = join(root, "build.json");

mkdirSync(join(TREE, "src"), { recursive: true });
mkdirSync(OUTSIDE, { recursive: true });
writeFileSync(join(TREE, "src", "math.ts"), SEEDED);
writeFileSync(join(TREE, "src", "deny.ts"), SEEDED);
writeFileSync(join(TREE, "src", "apply.ts"), SEEDED);
writeFileSync(join(TREE, "src", "human.ts"), SEEDED);
writeFileSync(join(TREE, "src", "dup.ts"), DUP);
writeFileSync(join(TREE, "README.md"), "# demo tree\n");
writeFileSync(join(OUTSIDE, "secret.ts"), SECRET);

const fixtureCreate = cliJson(
  ["create", "--brief", "HVAC dispatch tool for small teams", "--name", "W9 L3 Edit Fixture", "--out", BUILD],
  { cwd: root },
);
assert.equal(fixtureCreate.json.ok, true, `fixture create failed: ${fixtureCreate.json.error ?? ""}`);

/** Shorthand: one `edit` invocation over the shared tree. */
const edit = (extra, opts = {}) =>
  cliJson(["edit", "--dir", TREE, "--file", "src/math.ts", "--find", "return a + b;", "--replace", "return a - b;", ...extra], {
    cwd: root,
    ...opts,
  });

// ---------------------------------------------------------------------------
// 1. Dry-run is the default and NEVER writes.
// ---------------------------------------------------------------------------

test("W9-L3 edit: dry-run (the default) returns the diff + would-be hashes and NEVER writes", () => {
  const before = dirDigest(TREE);
  const out = edit([]);
  const j = out.json;

  assert.equal(out.status, 0, `a dry-run must exit 0 (got ${out.status}): ${out.stdout}`);
  assert.equal(j.action, "edit");
  assert.equal(j.mode, "dry-run");
  assert.equal(j.written, false);
  assert.equal(j.ledger, null, "a dry-run lands NO ledger row");
  assert.equal(j.file, "src/math.ts");
  assert.equal(j.path, resolve(TREE, "src", "math.ts"));
  assert.equal(j.dir, resolve(TREE));
  assert.equal(j.kind, "exact");
  assert.equal(j.matches, 1);
  assert.equal(j.diff.startLine, 2);
  assert.equal(j.diff.removed, "return a + b;");
  assert.equal(j.diff.added, "return a - b;");
  assert.match(j.diff.unified, /-return a \+ b;/);
  assert.match(j.diff.unified, /\+return a - b;/);
  assert.equal(j.hashBefore, fnv1a(SEEDED), "hashBefore must be the FNV-1a of the file's CURRENT bytes");
  assert.equal(j.hashAfter, fnv1a(PATCHED_SUB), "hashAfter must be the would-be hash — computed, not applied");
  assert.notEqual(j.hashBefore, j.hashAfter);
  assert.equal(j.policy.action, "repair.apply");
  assert.equal(j.policy.decision, "allow");
  assert.equal(j.policy.resource, `tree:${resolve(TREE)}`);
  assert.match(j.note, /nothing was written/);

  // ON DISK: the file and the whole tree are byte-identical.
  assert.equal(readFileSync(join(TREE, "src", "math.ts"), "utf8"), SEEDED);
  assert.equal(dirDigest(TREE), before, "the tree dir must be byte-identical after a dry-run");
  assert.deepEqual(
    readdirSync(join(TREE, "src")).sort(),
    ["apply.ts", "deny.ts", "dup.ts", "human.ts", "math.ts"],
    "no staging/temp file may survive a dry-run",
  );
});

// ---------------------------------------------------------------------------
// 2. Coded refusals — ambiguous / missing / no-op — write nothing.
// ---------------------------------------------------------------------------

test("W9-L3 edit: an ambiguous match is a coded refusal (RT_E_VALIDATION, exit 1) and writes nothing", () => {
  const before = dirDigest(TREE);
  const out = cliJson(
    ["edit", "--dir", TREE, "--file", "src/dup.ts", "--find", "= 1;", "--replace", "= 2;"],
    { cwd: root },
  );
  const j = out.json;

  assert.equal(out.status, 1);
  assert.equal(j.ok, false);
  assert.equal(j.code, "RT_E_VALIDATION");
  assert.equal(j.written, false);
  assert.equal(j.mode, "dry-run");
  assert.equal(j.patch.kind, "none");
  assert.equal(j.patch.matches, 2, "the refusal must name the real occurrence count");
  assert.deepEqual(j.patch.lines, [1, 2]);
  assert.match(j.error, /matches 2 times/);
  assert.match(j.error, /unique match/);
  assert.equal(dirDigest(TREE), before, "a refused edit must leave the tree byte-identical");
});

test("W9-L3 edit: a missing needle is a coded refusal and writes nothing", () => {
  const before = dirDigest(TREE);
  const out = cliJson(
    ["edit", "--dir", TREE, "--file", "src/dup.ts", "--find", "NEVER-PRESENT-ANYWHERE", "--replace", "x"],
    { cwd: root },
  );
  const j = out.json;

  assert.equal(out.status, 1);
  assert.equal(j.ok, false);
  assert.equal(j.code, "RT_E_VALIDATION");
  assert.equal(j.written, false);
  assert.equal(j.patch.matches, 0);
  assert.deepEqual(j.patch.lines, []);
  assert.match(j.error, /0 occurrences/);
  assert.equal(dirDigest(TREE), before);
});

test("W9-L3 edit: a no-op (find === replace) is refused, never reported as an applied edit", () => {
  const before = dirDigest(TREE);
  const out = cliJson(
    ["edit", "--dir", TREE, "--file", "src/dup.ts", "--find", "= 1;", "--replace", "= 1;"],
    { cwd: root },
  );
  const j = out.json;

  assert.equal(out.status, 1);
  assert.equal(j.ok, false);
  assert.equal(j.code, "RT_E_VALIDATION");
  assert.equal(j.written, false);
  assert.match(j.error, /no-op/);
  assert.equal(dirDigest(TREE), before);
});

test("W9-L3 edit: --write without --project is refused — an applied edit must be attributed", () => {
  const before = dirDigest(TREE);
  const out = edit(["--write"]);
  const j = out.json;

  assert.equal(out.status, 1);
  assert.equal(j.ok, false);
  assert.equal(j.code, "RT_E_VALIDATION");
  assert.equal(j.written, false);
  assert.match(j.error, /must be attributed in the ledger/);
  assert.equal(dirDigest(TREE), before, "an unattributable write must not happen");
});

// ---------------------------------------------------------------------------
// 3. The policy seam — the R5-f12 two-channel seat. A non-TTY claim is refused
//    BEFORE the seam in write mode AND in the dry-run pre-flight: no policy
//    verdict is emitted, nothing is written — token exported or not. (The
//    seat's positive path is the library seam's; a TTY cannot be faked from a
//    spawned child.)
// ---------------------------------------------------------------------------

test("W9-L3 edit: --i-am-human on a non-TTY is refused BEFORE the seam — WRITE mode, coded, nothing written (W36-N6 re-point, R5-f12)", () => {
  // R5-f12 Track 1 (research/multiagent/thoroughanalysis.md:869-877; L3's
  // verdict in fixes/277_l3_ui_records.md): the human seat is TWO channels —
  // the out-of-band RT_HUMAN_SEAT_TOKEN (claim) PLUS a TTY re-entry
  // (confirmation). A spawned child has no TTY, so `humanSeatClaim` refuses
  // BEFORE `evaluatePolicy` runs. The pre-two-channel expectations of this pin
  // (`policy.decision === "deny"` / `policy.reason /^human-seat-unverified/`)
  // are unreachable BY DESIGN — there is no policy verdict on this envelope —
  // so the pin now asserts the refusal's ACTUAL bytes (rapidtool-cli.mjs
  // edit-arm refusal :1621-1635 + the humanSeatClaim text :3459-3467). The
  // seat's positive path needs a real TTY (unfakeable from a child) and stays
  // at the library seam (headless.test.ts); this leg pins the machine-safe half.
  const buildBefore = fileDigest(BUILD);
  const out = cliJson(
    [
      "edit", "--dir", TREE, "--file", "src/deny.ts",
      "--find", "return a + b;", "--replace", "return a - b;",
      "--write", "--project", BUILD, "--i-am-human",
    ],
    { cwd: root },
  );
  const j = out.json;

  assert.equal(out.status, 1);
  assert.equal(j.ok, false);
  assert.equal(j.code, "RT_E_VALIDATION");
  assert.equal(j.action, "edit");
  assert.equal(j.written, false);
  assert.equal(j.mode, "write");
  assert.equal(j.dir, resolve(TREE));
  assert.equal(j.file, "src/deny.ts");
  // The two-channel refusal fires BEFORE the seam: no verdict may appear.
  assert.equal("policy" in j, false, "no policy field — the seat refusal precedes the seam");
  assert.match(j.error, /^edit: --i-am-human refused/);
  assert.match(j.error, /needs an interactive confirmation/);
  assert.match(j.error, /not a TTY/);
  assert.match(j.error, /RT_HUMAN_SEAT_TOKEN/);
  assert.match(j.error, /autopilot seat instead/);

  assert.equal(readFileSync(join(TREE, "src", "deny.ts"), "utf8"), SEEDED, "a refused seat claim must not touch the target");
  assert.equal(fileDigest(BUILD), buildBefore, "a refused seat claim must not land a ledger row");
});

test("W9-L3 edit: the seat refusal fires in the DRY-RUN pre-flight too — no second channel, no seam verdict, nothing written (W36-N6 re-point, R5-f12)", () => {
  // Same re-point rationale as the WRITE-mode case above: the two-channel
  // refusal precedes the seam, so the old `policy.decision === "deny"`
  // expectation is unreachable. What holds — and is pinned here — is that the
  // dry-run consults the SAME seat first (one rule, no divergence).
  const before = dirDigest(TREE);
  const out = cliJson(
    ["edit", "--dir", TREE, "--file", "src/deny.ts", "--find", "return a + b;", "--replace", "return a - b;", "--i-am-human"],
    { cwd: root },
  );
  const j = out.json;

  assert.equal(out.status, 1);
  assert.equal(j.ok, false);
  assert.equal(j.code, "RT_E_VALIDATION");
  assert.equal(j.action, "edit");
  assert.equal(j.mode, "dry-run");
  assert.equal(j.written, false);
  assert.equal("policy" in j, false, "no verdict exists — the seat refusal precedes the seam");
  assert.match(j.error, /--i-am-human refused/);
  assert.match(j.error, /not a TTY/);
  assert.equal(dirDigest(TREE), before);
});

// ---------------------------------------------------------------------------
// 4. Write path — atomic apply + ONE attributed ledger row, asserted on disk.
//    (The former verified-seat-writes case re-pointed to the two-channel
//    refusal — a spawned child cannot present the TTY channel. See its name.)
// ---------------------------------------------------------------------------

test("W9-L3 edit: --write applies + lands ONE ledger row (actor + decidedVia + patch + hashes, asserted on disk)", () => {
  const target = join(TREE, "src", "apply.ts");
  const logsBefore = JSON.parse(readFileSync(BUILD, "utf8")).logs.length;
  const out = cliJson(
    [
      "edit", "--dir", TREE, "--file", "src/apply.ts",
      "--find", "return a + b;", "--replace", "return a * b;",
      "--write", "--project", BUILD,
    ],
    { cwd: root },
  );
  const j = out.json;

  assert.equal(out.status, 0);
  assert.equal(j.ok, true);
  assert.equal(j.mode, "write");
  assert.equal(j.written, true);
  assert.equal(j.hashBefore, fnv1a(SEEDED));

  // ON DISK (the artifact is the dir, not the report):
  const onDisk = readFileSync(target, "utf8");
  assert.equal(onDisk, PATCHED_MUL, "the patched bytes must be what is really on disk");
  assert.equal(j.hashAfter, fnv1a(onDisk), "the reported hashAfter must be the hash of the bytes really on disk");
  assert.equal(j.hashAfter, fnv1a(PATCHED_MUL));
  assert.equal(hasStagingLeftovers(TREE), false, "write-then-rename must leave no `.edit-*.tmp` behind");

  // The LEDGER (one append-only row, full attribution):
  const project = JSON.parse(readFileSync(BUILD, "utf8"));
  assert.equal(project.logs.length, logsBefore + 1, "exactly ONE ledger row per applied edit");
  const row = project.logs[project.logs.length - 1];
  assert.equal(row.event, "edit.apply");
  const detail = JSON.parse(row.detail);
  assert.equal(detail.file, "src/apply.ts");
  assert.equal(detail.kind, "exact");
  assert.equal(detail.matches, 1);
  assert.equal(detail.hashBefore, j.hashBefore);
  assert.equal(detail.hashAfter, j.hashAfter);
  assert.equal(detail.actor.decidedBy, "autopilot");
  assert.equal(detail.actor.seat, "harness");
  assert.equal(detail.decidedVia.action, "repair.apply");
  assert.equal(detail.decidedVia.resource, `tree:${resolve(TREE)}`);
  assert.equal(detail.decidedVia.label, "autopilot/harness");
  assert.equal(detail.decidedVia.tokenPath, false);

  // The envelope echoes the same provenance:
  assert.equal(j.ledger.event, "edit.apply");
  assert.equal(j.ledger.path, BUILD);
  assert.equal(j.ledger.rows, logsBefore + 1);
  assert.equal(j.ledger.decidedVia.action, "repair.apply");
  assert.equal(j.ledger.decidedVia.tokenPath, false);
  assert.equal(j.policy.decision, "allow");
});

test("W9-L3 edit: a non-TTY --i-am-human is refused EVEN WITH the env token — the TTY re-entry is the second channel; nothing written (W36-N6 re-point, R5-f12)", () => {
  // The old expectation — non-TTY + token ⇒ write + human attribution — is
  // the very degeneracy R5-f12 closed ("it must never be VACUOUS again"): the
  // env var alone is only Channel A (possession); Channel B is the typed TTY
  // re-entry, which a spawned child cannot furnish. So this invocation is
  // refused BEFORE the seam WHETHER OR NOT the token is exported — proven by
  // running both variants and pinning the refusal bytes equal. The
  // human-attributed write path stays at the library seam (headless.test.ts
  // POSITIVE CONTROL) — a TTY is not fakeable from this leg by design.
  const buildBefore = fileDigest(BUILD);
  const targetBefore = readFileSync(join(TREE, "src", "human.ts"), "utf8");
  const args = [
    "edit", "--dir", TREE, "--file", "src/human.ts",
    "--find", "return a + b;", "--replace", "return a / b;",
    "--write", "--project", BUILD, "--i-am-human",
  ];
  const withToken = cliJson(args, { cwd: root, env: { RT_HUMAN_SEAT_TOKEN: "w9-l3-human-seat-token" } });
  const withoutToken = cliJson(args, { cwd: root });

  for (const out of [withToken, withoutToken]) {
    const j = out.json;
    assert.equal(out.status, 1, "a non-TTY seat claim can never exit 0, token or not");
    assert.equal(j.ok, false);
    assert.equal(j.code, "RT_E_VALIDATION");
    assert.equal(j.action, "edit");
    assert.equal(j.mode, "write");
    assert.equal(j.written, false);
    assert.equal("policy" in j, false, "refused before the seam — no verdict exists");
    assert.match(j.error, /^edit: --i-am-human refused/);
    assert.match(j.error, /not a TTY/);
  }
  assert.equal(
    withToken.json.error,
    withoutToken.json.error,
    "the env token must change NOTHING — the missing TTY is the refusal, not the token",
  );

  assert.equal(targetBefore, SEEDED);
  const afterBytes = readFileSync(join(TREE, "src", "human.ts"), "utf8");
  assert.equal(afterBytes, targetBefore, "the refused write must leave the target untouched");
  assert.notEqual(afterBytes, PATCHED_DIV, "the would-be patched bytes must never have landed");
  assert.equal(fileDigest(BUILD), buildBefore, "no ledger row may be minted by a refused machine claim");
});

// ---------------------------------------------------------------------------
// 5. Containment — the edit verb never writes outside the tree it names.
// ---------------------------------------------------------------------------

test("W9-L3 edit: containment — a --file outside --dir is refused (relative .. and absolute) and nothing is written", () => {
  const secretBefore = readFileSync(join(OUTSIDE, "secret.ts"), "utf8");
  const treeBefore = dirDigest(TREE);

  // NOTE (216s §4 observation): the containment refusal is a PRE-FLIGHT
  // refusal — its envelope carries no `written` field (unlike the policy /
  // patch refusals). The pin here is the documented refusal contract: exit 1,
  // coded RT_E_VALIDATION, the error naming containment, the dir echoed, and
  // the OUTSIDE bytes proven untouched below.
  const relEscape = cliJson(
    ["edit", "--dir", TREE, "--file", "../outside/secret.ts", "--find", "OUTSIDE-NEEDLE", "--replace", "PWNED"],
    { cwd: root },
  );
  assert.equal(relEscape.status, 1);
  assert.equal(relEscape.json.ok, false);
  assert.equal(relEscape.json.code, "RT_E_VALIDATION");
  assert.equal(relEscape.json.dir, resolve(TREE));
  assert.match(relEscape.json.error, /inside --dir/);

  const absEscape = cliJson(
    ["edit", "--dir", TREE, "--file", join(OUTSIDE, "secret.ts"), "--find", "OUTSIDE-NEEDLE", "--replace", "PWNED"],
    { cwd: root },
  );
  assert.equal(absEscape.status, 1);
  assert.equal(absEscape.json.ok, false);
  assert.equal(absEscape.json.code, "RT_E_VALIDATION");
  assert.equal(absEscape.json.dir, resolve(TREE));
  assert.match(absEscape.json.error, /inside --dir/);

  assert.equal(readFileSync(join(OUTSIDE, "secret.ts"), "utf8"), secretBefore, "the outside file must be untouched");
  assert.equal(dirDigest(TREE), treeBefore);
});
