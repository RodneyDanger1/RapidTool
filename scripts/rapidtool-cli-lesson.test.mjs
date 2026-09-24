import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

/**
 * W9-L3 (wave_plans/W9/lane-3.md; fixes/216s §1–4) — BEHAVIOR suite for the
 * CLI `lesson` T5 verbs (216s · 112 T5): `--advise` (read-only ranked
 * FAIL-class pre-flight) and `--verify` (anchor re-hash → ok | stale |
 * anchor-missing), incl. `--mark-stale` (store-only telemetry writer).
 * The contract tests live in README-cli.test.mjs; this file pins the REAL
 * behavior against a real child process + real temp files.
 *
 * What is pinned here:
 *   1. `lesson --advise --project` — read-only ranked fail-class rows:
 *      score-desc fallback (no --brief), fusion-rank with --brief, the
 *      --phase filter (project rows only), --limit cap, the coded refusals
 *      (missing / ambiguous source, bad --limit / --phase), and that the
 *      project file is byte-identical after every advise run;
 *   2. `lesson --advise --knowledge-file` — the cross-project store source:
 *      fusion-ranked rows, non-fail-class entries EXCLUDED (the class
 *      filter is real, not cosmetic), the no-brief / --phase refusals, and
 *      the store file byte-identical after every advise run;
 *   3. `lesson --verify --project` — per-row `ok | stale | anchor-missing`
 *      against the anchor's CURRENT bytes (fnv1a decimal AND hex recorded
 *      forms both verified), the `rowsOk` / `stale` / `anchorMissing`
 *      counts (the W8 rename — never the old dupe `ok`), the missing-anchor
 *      report (a reported outcome, exit 0), and the coded refusals
 *      (--anchor / source / --limit / --mark-stale-on-project);
 *   4. `lesson --verify --knowledge-file` — same statuses over store rows,
 *      READ-ONLY by default; `--mark-stale` is the ONLY mutating form and it
 *      writes store TELEMETRY ONLY (counterEvidence bump) — content fields
 *      are asserted byte-identical and the bumped value is asserted on disk.
 *
 * The store fixture is built by the REAL `lesson --accept` verb (the
 * human-gated writer), never hand-rolled JSON, so the store rows under test
 * are the engine's own shape. The local `fnv1a` copy is self-checking: if it
 * ever drifts from src/lib/algorithms.ts, the recorded-evidenceHash fixtures
 * stop matching the CLI's own anchor hash and these tests go RED. (A local
 * copy is required because the scripts leg runs WITHOUT
 * --experimental-strip-types and cannot import the .ts module.)
 *
 * Test order matters in exactly one place: the `--mark-stale` test (LAST in
 * this file) mutates the store's counterEvidence telemetry; every earlier
 * test asserts read-only behavior against the un-bumped store. node:test
 * runs top-level tests sequentially in declaration order.
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
  Object.assign(env, opts.env ?? {}); // explicit per-test opt-in
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

/** FNV-1a 32-bit — byte-for-byte the src/lib/algorithms.ts `fnv1a` (number). */
function fnv1a(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
const fnvDec = (text) => String(fnv1a(text));
const fnvHex = (text) => fnv1a(text).toString(16).padStart(8, "0");

/** Content hash of one file's bytes, for read-only / telemetry-only pins. */
function fileDigest(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

// ---------------------------------------------------------------------------
// Fixtures — one throwaway dir; the project is written by the REAL `create`
// verb and the store by the REAL `lesson --accept` verb.
// ---------------------------------------------------------------------------

const root = mkdtempSync(join(tmpdir(), "rapidtool-cli-lesson-"));
const BUILD = join(root, "build.json");
const STORE = join(root, "store.json");
const ANCHOR = join(root, "anchor-evidence.md");
const ANCHOR_ABSENT = join(root, "no-such-anchor.md");
const ACTOR = "w9-l3-suite";

const anchorText = "contractor invoicing dashboard evidence anchor v1\n";
const otherText = "evidence body that no longer matches the anchor\n";
writeFileSync(ANCHOR, anchorText);

// Recorded-hash fixtures: the decimal form on rows A/B, the HEX form on row C
// (the CLI's `check` accepts either), a stale decimal on row B, and NO token
// at all on row D (the anchor-missing row).
const ROW_A = {
  id: "lesson-vague-brief-w9a1",
  kind: "semantic",
  phase: 2,
  score: 0.9,
  text: `Dashboard vague-brief: the contractor invoicing dashboard shipped without naming the invoicing flow; evidenceHash=${fnvDec(anchorText)}.`,
  tags: ["lesson", "L2", "vague-brief"],
};
const ROW_B = {
  id: "lesson-drift-w9b2",
  kind: "semantic",
  phase: 5,
  score: 0.6,
  text: `Emitter drift: phase numbering drifted from the schedule; evidenceHash=${fnvDec(otherText)}.`,
  tags: ["lesson", "L3", "drift"],
};
const ROW_C = {
  id: "lesson-run-summary-w9c3",
  kind: "episodic",
  phase: 2,
  score: 0.4,
  text: `Run summary: three phases parked on approval in one session; evidenceHash=${fnvHex(anchorText)}.`,
  tags: ["lesson", "L1", "run-summary"],
};
const ROW_D = {
  id: "lesson-pattern-w9d4",
  kind: "procedural",
  phase: 2,
  score: 0.5,
  text: "Reuse the vault index helper when listing emitted artifacts.",
  tags: ["lesson", "L1", "pattern-kind"], // NOT a fail class — advise must drop it
};

const fixtureCreate = cliJson(
  ["create", "--brief", "HVAC dispatch tool for small teams", "--name", "W9 L3 Lesson Fixture", "--out", BUILD],
  { cwd: root },
);
assert.equal(fixtureCreate.json.ok, true, `fixture create failed: ${fixtureCreate.json.error ?? ""}`);

// Seed the project memory with the four lesson rows (the artifact IS the
// fixture — same store shape lessonRow() mints: id/kind/phase/text/score/tags).
{
  const project = JSON.parse(readFileSync(BUILD, "utf8"));
  project.memory = [...(project.memory ?? []), ROW_A, ROW_B, ROW_C, ROW_D];
  writeFileSync(BUILD, JSON.stringify(project, null, 2), "utf8");
}

// The store fixture: the REAL human-gated writer promotes the seeded rows.
const fixtureAccept = cliJson(
  ["lesson", "--accept", "--project", BUILD, "--out", STORE, "--actor", ACTOR],
  { cwd: root },
);
assert.equal(fixtureAccept.json.ok, true, `fixture accept failed: ${fixtureAccept.json.error ?? ""}`);

/** Fresh read of the store fixture ({version, entries}) — the real file. */
const readStore = () => JSON.parse(readFileSync(STORE, "utf8"));
const entryByTitle = (title) => {
  const found = readStore().entries.find((e) => e.title === title);
  assert.ok(found, `store fixture has no entry titled ${JSON.stringify(title)}`);
  return found;
};

const ADVISE_BRIEF = "invoicing dashboard contractor vault helper artifacts drift";

// ---------------------------------------------------------------------------
// 1. Store fixture sanity — accept promoted ALL four rows with actor provenance.
// ---------------------------------------------------------------------------

test("W9-L3 lesson: the fixture store — accept promotes all four lesson rows with actor provenance", () => {
  const j = fixtureAccept.json;
  assert.equal(j.action, "accept");
  assert.equal(j.promoted, 4, "all four seeded rows must be appended (the human accept is the gate)");
  assert.equal(j.attempted, 4);
  assert.equal(j.refused, 0);
  assert.equal(j.actor, ACTOR);

  const store = readStore();
  assert.equal(store.entries.length, 4, "the store carries exactly the four promoted rows");
  for (const title of ["Lesson L2 vague-brief", "Lesson L3 drift", "Lesson L1 run-summary", "Lesson L1 pattern-kind"]) {
    const entry = store.entries.find((e) => e.title === title);
    assert.ok(entry, `store is missing ${JSON.stringify(title)}`);
    assert.ok(entry.tags.includes("lesson"), "store rows stay lesson-tagged");
    assert.ok(entry.tags.includes("accepted"), "accepted rows carry the gate tag");
    assert.ok(entry.tags.includes(`actor:${ACTOR}`), "accepted rows carry actor provenance in-content");
  }
  assert.equal(entryByTitle("Lesson L2 vague-brief").sourcePath, `lesson:${ROW_A.id}`);
});

// ---------------------------------------------------------------------------
// 2. advise · project — read-only, ranked fail-class rows.
// ---------------------------------------------------------------------------

test("W9-L3 lesson: advise --project is score-desc ranked, fail-class only, and writes nothing", () => {
  const before = fileDigest(BUILD);
  const out = cliJson(["lesson", "--advise", "--project", BUILD], { cwd: root });
  const j = out.json;

  assert.equal(out.status, 0);
  assert.equal(j.action, "advise");
  assert.equal(j.source, "project");
  assert.equal(j.readOnly, true);
  assert.equal(j.rankedBy, "score-desc", "no --brief degrades to the score-desc convention");
  assert.equal(j.brief, "HVAC dispatch tool for small teams", "the project's own brief is echoed");
  assert.equal(j.phase, null);
  assert.equal(j.count, 3, "rows A/B/C are fail-class; the pattern-kind row D is excluded");
  assert.deepEqual(
    j.rows.map((r) => r.id),
    [ROW_A.id, ROW_B.id, ROW_C.id],
    "score desc, id asc (0.9 / 0.6 / 0.4)",
  );
  assert.deepEqual(
    j.rows.map((r) => [r.class, r.level, r.phase]),
    [
      ["vague-brief", "L2", 2],
      ["drift", "L3", 5],
      ["run-summary", "L1", 2],
    ],
    "each row carries its fail class + level + phase",
  );
  assert.equal(j.rows[0].score, 0.9);
  assert.equal(j.rows[0].reproducedCount, 0, "absent telemetry reads as 0, never fabricated");
  assert.equal(j.rows[0].counterEvidence, 0);
  assert.match(j.note, /read-only/);
  assert.match(j.note, /nothing was written/);
  assert.ok(!j.rows.some((r) => r.id === ROW_D.id), "the non-fail pattern-kind row must never rank");

  assert.equal(fileDigest(BUILD), before, "advise is read-only — the project file is byte-identical");
});

test("W9-L3 lesson: advise --project --brief ranks via fusion-rank with the matching row first", () => {
  const out = cliJson(
    ["lesson", "--advise", "--project", BUILD, "--brief", "invoicing dashboard contractor"],
    { cwd: root },
  );
  const j = out.json;

  assert.equal(out.status, 0);
  assert.equal(j.rankedBy, "fusion-rank");
  assert.equal(j.brief, "invoicing dashboard contractor");
  assert.equal(j.count, 3, "a ranked brief still returns every fail-class row (zero overlap is not a drop)");
  assert.equal(j.rows[0].id, ROW_A.id, "the row lexically matching the brief ranks first");
  assert.deepEqual(
    j.rows.map((r) => r.id),
    [ROW_A.id, ROW_B.id, ROW_C.id],
  );
  assert.match(j.note, /ranking is deterministic/);
});

test("W9-L3 lesson: advise --project --phase filters to that phase only", () => {
  const out = cliJson(["lesson", "--advise", "--project", BUILD, "--phase", "2"], { cwd: root });
  const j = out.json;

  assert.equal(out.status, 0);
  assert.equal(j.phase, 2);
  assert.deepEqual(
    j.rows.map((r) => r.id),
    [ROW_A.id, ROW_C.id],
    "phase 2 keeps A + C (both fail-class); the phase-5 drift row is filtered out",
  );
  assert.equal(j.count, 2);
});

test("W9-L3 lesson: advise --limit caps the ranking (and 0 is a coded refusal)", () => {
  const capped = cliJson(["lesson", "--advise", "--project", BUILD, "--limit", "2"], { cwd: root });
  assert.equal(capped.status, 0);
  assert.deepEqual(capped.json.rows.map((r) => r.id), [ROW_A.id, ROW_B.id]);
  assert.equal(capped.json.count, 2);

  const before = fileDigest(BUILD);
  const bad = cliJson(["lesson", "--advise", "--project", BUILD, "--limit", "0"], { cwd: root });
  assert.equal(bad.status, 1);
  assert.equal(bad.json.ok, false);
  assert.equal(bad.json.code, "RT_E_VALIDATION");
  assert.match(bad.json.error, /--limit must be a positive integer/);
  assert.equal(fileDigest(BUILD), before);
});

test("W9-L3 lesson: advise refusals — exactly one source; bad --phase is coded", () => {
  const none = cliJson(["lesson", "--advise"], { cwd: root });
  assert.equal(none.status, 1);
  assert.equal(none.json.code, "RT_E_VALIDATION");
  assert.match(none.json.error, /pass exactly one source/);

  const both = cliJson(
    ["lesson", "--advise", "--project", BUILD, "--knowledge-file", STORE, "--brief", "x"],
    { cwd: root },
  );
  assert.equal(both.status, 1);
  assert.equal(both.json.code, "RT_E_VALIDATION");
  assert.match(both.json.error, /pass exactly one source/);

  const badPhase = cliJson(["lesson", "--advise", "--project", BUILD, "--phase", "13"], { cwd: root });
  assert.equal(badPhase.status, 1);
  assert.equal(badPhase.json.code, "RT_E_VALIDATION");
  assert.match(badPhase.json.error, /--phase must be an integer 0\.\.12/);
});

// ---------------------------------------------------------------------------
// 3. advise · store — cross-project rows; class filter + read-only pins.
// ---------------------------------------------------------------------------

test("W9-L3 lesson: advise --knowledge-file ranks store rows, drops non-fail classes, writes nothing", () => {
  const storeBefore = fileDigest(STORE);
  const buildBefore = fileDigest(BUILD);
  const out = cliJson(["lesson", "--advise", "--knowledge-file", STORE, "--brief", ADVISE_BRIEF], {
    cwd: root,
  });
  const j = out.json;

  assert.equal(out.status, 0);
  assert.equal(j.action, "advise");
  assert.equal(j.source, "store");
  assert.equal(j.store, resolve(STORE));
  assert.equal(j.readOnly, true);
  assert.equal(j.rankedBy, "fusion-rank");
  assert.equal(j.phase, null, "store rows carry no phase — the field stays null");
  assert.equal(j.count, 2, "A (vague-brief) + B (drift) rank; C/D have no lexical hit and D has no fail class");
  assert.deepEqual(
    j.rows.map((r) => r.id),
    [entryByTitle("Lesson L2 vague-brief").id, entryByTitle("Lesson L3 drift").id],
    "fusionRank: A hits 3 brief tokens, B hits its title token, D is class-filtered after ranking",
  );
  assert.deepEqual(
    j.rows.map((r) => [r.class, r.level]),
    [
      ["vague-brief", "L2"],
      ["drift", "L3"],
    ],
  );
  assert.equal(j.rows[0].score, 1, "the top match is the normalized 1.0 (findPatterns max)");
  assert.equal(j.rows[1].score, 0.667, "B's title-token hit is 2/3 of the top raw score");
  assert.equal(j.rows[0].counterEvidence, 0);
  assert.deepEqual(j.rows[0].supersededBy, []);
  assert.ok(
    !j.rows.some((r) => r.class === "pattern-kind"),
    "the accepted pattern-kind row matches the brief lexically but must be excluded by class",
  );
  assert.match(j.note, /read-only/);
  assert.match(j.note, /nothing was written/);

  assert.equal(fileDigest(STORE), storeBefore, "advise is read-only — the store file is byte-identical");
  assert.equal(fileDigest(BUILD), buildBefore);
});

test("W9-L3 lesson: advise --knowledge-file refusals — no brief, --phase, no source", () => {
  const noBrief = cliJson(["lesson", "--advise", "--knowledge-file", STORE], { cwd: root });
  assert.equal(noBrief.status, 1);
  assert.equal(noBrief.json.code, "RT_E_VALIDATION");
  assert.match(noBrief.json.error, /needs --brief/);

  const withPhase = cliJson(
    ["lesson", "--advise", "--knowledge-file", STORE, "--brief", "x", "--phase", "2"],
    { cwd: root },
  );
  assert.equal(withPhase.status, 1);
  assert.equal(withPhase.json.code, "RT_E_VALIDATION");
  assert.match(withPhase.json.error, /--phase filters project-memory rows only/);

  const none = cliJson(["lesson", "--advise", "--brief", "x"], { cwd: root });
  assert.equal(none.status, 1);
  assert.equal(none.json.code, "RT_E_VALIDATION");
  assert.match(none.json.error, /pass exactly one source/);
});

// ---------------------------------------------------------------------------
// 4. verify · project — ok | stale | anchor-missing, counted, read-only.
// ---------------------------------------------------------------------------

test("W9-L3 lesson: verify --project reports ok|stale|anchor-missing with the rowsOk/stale/anchorMissing counts", () => {
  const before = fileDigest(BUILD);
  const out = cliJson(["lesson", "--verify", "--project", BUILD, "--anchor", ANCHOR], { cwd: root });
  const j = out.json;

  assert.equal(out.status, 0);
  assert.equal(j.action, "verify");
  assert.equal(j.source, "project");
  assert.equal(j.readOnly, true);
  assert.equal(j.marked, null);
  assert.equal(j.anchor, resolve(ANCHOR));
  assert.equal(j.anchorPresent, true);
  assert.equal(j.anchorHash.decimal, fnvDec(anchorText), "the anchor hash is the fnv1a of the bytes on disk");
  assert.equal(j.anchorHash.hex, fnvHex(anchorText));
  assert.equal(j.count, 4);
  assert.equal(j.rowsOk, 2, "rows A (decimal) + C (hex) both match the anchor");
  assert.equal(j.stale, 1, "row B records a hash for other bytes");
  assert.equal(j.anchorMissing, 1, "row D records no evidenceHash= token");
  assert.ok(!("ok" in j) || j.ok === true, "the W8 rename: the count key is rowsOk, never a dupe `ok` count");

  const byId = new Map(j.rows.map((r) => [r.id, r]));
  assert.equal(byId.get(ROW_A.id).status, "ok");
  assert.equal(byId.get(ROW_A.id).recordedHash, fnvDec(anchorText));
  assert.match(byId.get(ROW_A.id).reason, /matches the row's recorded evidenceHash/);
  assert.equal(byId.get(ROW_C.id).status, "ok", "the HEX recorded form is accepted too");
  assert.equal(byId.get(ROW_C.id).recordedHash, fnvHex(anchorText));
  assert.equal(byId.get(ROW_B.id).status, "stale");
  assert.equal(byId.get(ROW_B.id).recordedHash, fnvDec(otherText));
  assert.match(byId.get(ROW_B.id).reason, /differs from the recorded/);
  assert.equal(byId.get(ROW_D.id).status, "anchor-missing");
  assert.equal(byId.get(ROW_D.id).recordedHash, null);
  assert.match(byId.get(ROW_D.id).reason, /records no evidenceHash= token/);
  assert.deepEqual(
    j.rows.map((r) => r.source),
    ["project", "project", "project", "project"],
  );

  assert.equal(fileDigest(BUILD), before, "verify is read-only by default — byte-identical project file");
});

test("W9-L3 lesson: verify --project with a missing anchor reports anchor-missing rows (exit 0, no throw)", () => {
  const out = cliJson(["lesson", "--verify", "--project", BUILD, "--anchor", ANCHOR_ABSENT], { cwd: root });
  const j = out.json;

  assert.equal(out.status, 0, "an unresolved anchor is a REPORTED outcome, not an internal error");
  assert.equal(j.anchorPresent, false);
  assert.equal(j.anchorHash, null);
  assert.equal(j.rowsOk, 0);
  assert.equal(j.stale, 0);
  assert.equal(j.anchorMissing, 4, "every row reports anchor-missing against an unreadable anchor");
  const byId = new Map(j.rows.map((r) => [r.id, r]));
  assert.match(byId.get(ROW_A.id).reason, /does not resolve to a readable file/);
  assert.match(byId.get(ROW_D.id).reason, /records no evidenceHash= token/, "the token check wins for tokeless rows");
});

test("W9-L3 lesson: verify refusals — missing --anchor, source ambiguity, bad --limit, --mark-stale on project", () => {
  const noAnchor = cliJson(["lesson", "--verify", "--project", BUILD], { cwd: root });
  assert.equal(noAnchor.status, 1);
  assert.equal(noAnchor.json.code, "RT_E_VALIDATION");
  assert.match(noAnchor.json.error, /missing required --anchor/);

  const none = cliJson(["lesson", "--verify", "--anchor", ANCHOR], { cwd: root });
  assert.equal(none.status, 1);
  assert.equal(none.json.code, "RT_E_VALIDATION");
  assert.match(none.json.error, /pass exactly one source/);

  const both = cliJson(
    ["lesson", "--verify", "--project", BUILD, "--knowledge-file", STORE, "--anchor", ANCHOR],
    { cwd: root },
  );
  assert.equal(both.status, 1);
  assert.equal(both.json.code, "RT_E_VALIDATION");
  assert.match(both.json.error, /pass exactly one source/);

  const badLimit = cliJson(["lesson", "--verify", "--project", BUILD, "--anchor", ANCHOR, "--limit", "0"], {
    cwd: root,
  });
  assert.equal(badLimit.status, 1);
  assert.equal(badLimit.json.code, "RT_E_VALIDATION");
  assert.match(badLimit.json.error, /--limit must be a positive integer/);

  const before = fileDigest(BUILD);
  const markOnProject = cliJson(
    ["lesson", "--verify", "--project", BUILD, "--anchor", ANCHOR, "--mark-stale"],
    { cwd: root },
  );
  assert.equal(markOnProject.status, 1);
  assert.equal(markOnProject.json.code, "RT_E_VALIDATION");
  assert.match(markOnProject.json.error, /--mark-stale needs --knowledge-file/);
  assert.equal(fileDigest(BUILD), before, "the refused --mark-stale wrote nothing");
});

// ---------------------------------------------------------------------------
// 5. verify · store — same statuses over store rows; read-only unless --mark-stale.
// ---------------------------------------------------------------------------

test("W9-L3 lesson: verify --knowledge-file checks the store's rows read-only", () => {
  const before = fileDigest(STORE);
  const out = cliJson(["lesson", "--verify", "--knowledge-file", STORE, "--anchor", ANCHOR], { cwd: root });
  const j = out.json;

  assert.equal(out.status, 0);
  assert.equal(j.source, "store");
  assert.equal(j.store, resolve(STORE));
  assert.equal(j.readOnly, true);
  assert.equal(j.marked, null);
  assert.equal(j.count, 4);
  assert.equal(j.rowsOk, 2);
  assert.equal(j.stale, 1);
  assert.equal(j.anchorMissing, 1);

  const byId = new Map(j.rows.map((r) => [r.id, r]));
  const entryA = entryByTitle("Lesson L2 vague-brief");
  const entryB = entryByTitle("Lesson L3 drift");
  const entryC = entryByTitle("Lesson L1 run-summary");
  assert.equal(byId.get(entryA.id).status, "ok");
  assert.equal(byId.get(entryA.id).recordedHash, fnvDec(anchorText));
  assert.equal(byId.get(entryA.id).source, "store");
  assert.equal(byId.get(entryB.id).status, "stale");
  assert.equal(byId.get(entryB.id).recordedHash, fnvDec(otherText));
  assert.equal(byId.get(entryC.id).status, "ok");
  assert.equal(byId.get(entryC.id).recordedHash, fnvHex(anchorText));

  assert.equal(fileDigest(STORE), before, "read-only report — the store file is byte-identical");
});

// ---------------------------------------------------------------------------
// 6. --mark-stale — store-only, telemetry-only.  (MUST stay last: it bumps B.)
// ---------------------------------------------------------------------------

test("W9-L3 lesson: --mark-stale bumps counterEvidence on the stale store row ONLY — content untouched", () => {
  const storeBefore = readStore();
  const digestBefore = fileDigest(STORE);
  const bBefore = entryByTitle("Lesson L3 drift");
  const aBefore = entryByTitle("Lesson L2 vague-brief");

  const out = cliJson(
    ["lesson", "--verify", "--knowledge-file", STORE, "--anchor", ANCHOR, "--mark-stale"],
    { cwd: root },
  );
  const j = out.json;

  assert.equal(out.status, 0);
  assert.equal(j.source, "store");
  assert.equal(j.readOnly, false, "--mark-stale is the ONE mutating form — and it says so");
  assert.equal(j.stale, 1);
  assert.deepEqual(
    j.marked,
    [{ id: bBefore.id, marked: true, counterEvidence: 1 }],
    "exactly the stale row is marked, and the bump is echoed",
  );
  assert.match(j.note, /telemetry-only write/);
  assert.match(j.note, /content fields untouched/);

  // ON DISK: the file changed — and ONLY the bumped telemetry changed.
  assert.notEqual(fileDigest(STORE), digestBefore, "the telemetry bump is a real write");
  const storeAfter = readStore();
  assert.equal(storeAfter.entries.length, storeBefore.entries.length, "append-only: no rows added or removed");
  const contentOf = (e) => {
    const { counterEvidence: _ce, ...rest } = e;
    return rest;
  };
  for (const before of storeBefore.entries) {
    const after = storeAfter.entries.find((e) => e.id === before.id);
    assert.ok(after, `entry ${before.id} vanished from the store`);
    assert.deepEqual(
      contentOf(after),
      contentOf(before),
      `entry ${before.id}: content fields must be byte-identical (telemetry-only write)`,
    );
  }
  const bAfter = storeAfter.entries.find((e) => e.id === bBefore.id);
  assert.equal(bAfter.counterEvidence, 1, "the stale row's counterEvidence is bumped on disk");
  assert.equal(aBefore.counterEvidence, undefined, "the still-ok row's telemetry is untouched");

  // A follow-up read-only verify now reports the bumped telemetry as-is.
  const followUp = cliJson(["lesson", "--verify", "--knowledge-file", STORE, "--anchor", ANCHOR], { cwd: root });
  const bRow = followUp.json.rows.find((r) => r.id === bBefore.id);
  assert.equal(bRow.counterEvidence, 1, "the persisted bump is what later reads see");
  assert.equal(followUp.json.readOnly, true);
});

// ---------------------------------------------------------------------------
// 7. F3 (221 §F3 — W18 lane 2) · `lesson --effect` — cross-run learning
// MEASUREMENT, read-only. The fixture is the REAL `create` verb + engine-shaped
// memory rows (incl. one accrued reproduction with its real `lesson.reproduced`
// ledger row) — never hand-rolled envelopes.
// ---------------------------------------------------------------------------

const EFFECT = join(root, "effect-build.json");
const NO_SUCH = join(root, "no-such-project.json");
const REPRO_ID = "lesson-template-emission-aaa11111";
const PLAIN_ID = "lesson-template-emission-bbb22222";
const ACCRUAL = `L2 template-emission ${REPRO_ID} reproduced (P6 DoD unmet again; reproducedCount=2)`;

const effectCreate = cliJson(
  ["create", "--brief", "Invoicing dashboard for contractors", "--name", "W18 L2 Effect Fixture", "--out", EFFECT],
  { cwd: root },
);
assert.equal(effectCreate.json.ok, true, `effect fixture create failed: ${effectCreate.json.error ?? ""}`);
{
  const project = JSON.parse(readFileSync(EFFECT, "utf8"));
  project.memory = [
    ...(project.memory ?? []),
    {
      id: REPRO_ID,
      kind: "episodic",
      phase: 6,
      score: 0.7,
      reproducedCount: 2,
      tags: ["L2", "lesson", "probe:p6-brief-fit", "probe:p6-verified", "template-emission"],
      text: "L2 template-emission: phase P6 sealed with gate unmet (p6-verified, p6-brief-fit).",
    },
    {
      id: PLAIN_ID,
      kind: "episodic",
      phase: 6,
      score: 0.6,
      tags: ["L3", "lesson", "verify-failure"],
      text: "L3 verify-failure: machine verification failed twice.",
    },
    // NOT lesson-tagged: must count only in the census WINDOW, never the census.
    { id: "non-lesson-note", kind: "semantic", phase: 2, score: 0.1, reproducedCount: 9, tags: ["note"], text: "not a lesson" },
  ];
  project.logs = [
    ...(project.logs ?? []),
    { ts: 1, phase: 6, level: "info", event: "lesson.capture", detail: `L2 template-emission ${REPRO_ID} (P6 sealed with unmet DoD)` },
    { ts: 2, phase: 6, level: "info", event: "lesson.reproduced", detail: ACCRUAL },
    { ts: 3, phase: 6, level: "info", event: "lesson.reproduced", detail: "L2 template-emission lesson-other-9 reproduced (verify failed again; reproducedCount=1)" },
  ];
  writeFileSync(EFFECT, JSON.stringify(project, null, 2), "utf8");
}

test("W18-L2 lesson: --effect reports the recurrence census from real memory rows, read-only", () => {
  const before = fileDigest(EFFECT);
  const out = cliJson(["lesson", "--effect", "--project", EFFECT], { cwd: root });
  const j = out.json;

  assert.equal(out.status, 0);
  assert.equal(j.action, "effect");
  assert.equal(j.project, "W18 L2 Effect Fixture");
  assert.equal(j.readOnly, true, "measurement only — the arm says so in the envelope");
  assert.match(j.label, /recurrence ≠ causation/, "the honest label rides INSIDE the JSON object");
  assert.match(j.label, /not proof the lesson was followed/);
  assert.equal(j.measurement, "cross-run learning — recurrence of a lesson's target after minting");
  assert.match(j.note, /read-only measurement/);
  assert.match(j.note, /not an eval score/);
  assert.match(j.note, /T-11 stays muted/);

  assert.equal(j.total, 2, "only lesson-tagged rows enter the census (the note row's reproducedCount=9 is ignored)");
  assert.equal(j.reproduced, 1);
  assert.equal(j.unreproduced, 1);
  assert.equal(j.recurrenceRate, 0.5);
  assert.equal(j.sufficientSample, true, "n=2 meets the n≥2 floor");
  assert.match(j.claim, /1\/2 lesson targets recurred after minting \(n=2\)/);
  assert.match(j.claim, /recurrence ≠ causation/);
  assert.deepEqual(j.censusWindow, { totalRows: 3, lessonRows: 2, cap: 80, atCap: false });

  assert.deepEqual(
    j.perClass.map((c) => [c.class, c.total, c.reproduced, c.recurrenceRate]),
    [
      ["template-emission", 1, 1, 1],
      ["verify-failure", 1, 0, 0],
    ],
    "per-class rates, class-asc",
  );

  assert.deepEqual(
    j.evidence.map((e) => e.id),
    [REPRO_ID, PLAIN_ID],
    "evidence is id-asc and covers every lesson target",
  );
  const repro = j.evidence[0];
  assert.equal(repro.class, "template-emission", "probe tags are never mistaken for the class");
  assert.equal(repro.level, "L2");
  assert.equal(repro.phase, 6);
  assert.deepEqual(repro.probes, ["probe:p6-brief-fit", "probe:p6-verified"]);
  assert.equal(repro.reproducedCount, 2);
  assert.equal(repro.reproduced, true);
  assert.deepEqual(repro.ledgerRows, [ACCRUAL], "the real `lesson.reproduced` row that accrued it is attributed");
  assert.match(repro.evidence, /recurred 2× after minting/);
  const plain = j.evidence[1];
  assert.equal(plain.reproducedCount, 0, "absent telemetry reads as 0, never fabricated");
  assert.equal(plain.reproduced, false);
  assert.deepEqual(plain.ledgerRows, [], "no accrual for this row ⇒ [], never another row's log");
  assert.match(plain.evidence, /no recurrence recorded after minting/);
  assert.equal(plain.class, "verify-failure");

  assert.equal(fileDigest(EFFECT), before, "--effect is read-only — the project file is byte-identical");
});

test("W18-L2 lesson: --effect refuses honestly — missing --project, --knowledge-file, arm ambiguity", () => {
  const before = fileDigest(EFFECT);
  const noProject = cliJson(["lesson", "--effect"], { cwd: root });
  assert.equal(noProject.status, 1);
  assert.equal(noProject.json.ok, false);
  assert.equal(noProject.json.code, "RT_E_VALIDATION");
  assert.match(noProject.json.error, /missing required --project/);

  const missing = cliJson(["lesson", "--effect", "--project", NO_SUCH], { cwd: root });
  assert.equal(missing.status, 1);
  assert.equal(missing.json.ok, false);
  assert.equal(missing.json.code, "RT_E_PROJECT_MISSING");
  assert.match(missing.json.error, /no-such-project\.json/);

  const store = cliJson(["lesson", "--effect", "--project", EFFECT, "--knowledge-file", STORE], { cwd: root });
  assert.equal(store.status, 1);
  assert.equal(store.json.code, "RT_E_VALIDATION");
  assert.match(store.json.error, /refusing --knowledge-file/);

  const two = cliJson(["lesson", "--effect", "--list", "--project", EFFECT], { cwd: root });
  assert.equal(two.status, 1);
  assert.equal(two.json.code, "RT_E_VALIDATION");
  assert.match(
    two.json.error,
    /pass exactly one of --list\|--propose\|--accept\|--supersede\|--refute\|--advise\|--verify\|--effect \(got 2\)/,
  );

  assert.equal(fileDigest(EFFECT), before, "refusals reported, nothing written");
});

test("W18-L2 lesson: the USAGE help entry documents --effect (the parity pin's subject)", () => {
  const src = readFileSync(CLI_PATH, "utf8");
  const usageLine = src.split(/\r?\n/).find((line) => /^ {4}lesson: "/.test(line));
  assert.ok(usageLine, "rapidtool-cli.mjs USAGE must carry a lesson entry");
  assert.match(usageLine, /--effect --project <file\.json>/, "the arm's flag shape is in the help string");
  assert.match(usageLine, /effect = F3 read-only cross-run learning MEASUREMENT/);

  // The arm itself must be reachable: the dispatcher filters on `effect`.
  assert.match(src, /"list", "propose", "accept", "supersede", "refute", "advise", "verify", "effect"/);
});
