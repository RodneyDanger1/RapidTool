// ---------------------------------------------------------------------------
// test-name-pattern-guard.test.mjs — ledger #50 codified (W22-L1): the
// `--test-name-pattern` no-op trap + the pairing recipe that closes it.
//
// THE TRAP (measured on Node v22.23.2 AND Node v24.15.0, FOREGROUND — the trap
//   SHAPE is identical on both):
//   `node --test --test-reporter=tap --test-name-pattern=<x> file.test.mjs`
//   where <x> matches NO test exits **0** and prints `1..0` (zero subtests
//   ran) — yet the summary still reads `# tests 1 / # pass 1`, because it
//   counts the FILE wrapper. A file whose tests FAIL reads green under a
//   no-match filter (proven in case 1/3 below). W16's wave hit this, closed it
//   "by pairing" locally, and ledger v1 row #50 kept the repo-wide codification
//   open — this is that codification: executable pin + recipe (doc note in
//   AGENTS.md).
//
// RUNTIME NOTE (Node 22.23.2 → 24.15.0): the DEFAULT `node --test` reporter is
//   runtime-dependent — **TAP** on 22, **spec** on 24 (`✔ …` / `ℹ tests 1`).
//   The trap itself is unchanged on 24 (still exit 0, still masks a red file);
//   only the default output FORMAT moved. `runFixture()` therefore passes
//   `--test-reporter=tap` explicitly (as `npm test` + `scripts/gate.sh` do) so
//   the TAP assertions target an explicit format, not a host default.
//
// THE RECIPE (what every filtered run must do): never read a filtered run as
// green from its exit code alone — require the expected test's OWN
// `ok N - <name>` line in the SAME output. Case 2 proves the recipe
// discriminates exactly where the bare exit code lies.
//
// If a FUTURE runtime turns a zero-match filter into a non-zero exit, case 1
// goes red on first run — that is a test-runner behavior change worth knowing;
// update this pin + the AGENTS.md note together.
//
// Evidence (W22-L1 scratch, C:/Users/mnril/w22l1_scratch/):
//   noop_nomatch.txt — exit 0 · `1..0` · `# pass 1` (green+red fixture, no match)
//   mask_nomatch.txt — exit 0 over a file containing a FAILING test (masked)
//   mask_full.txt    — same file unfiltered: exit 1 (the red is real)
//   noop_match.txt   — exit 0 · `ok 1 - alpha case runs` (match runs the test)
//
// Run (foreground — host artifact note in AGENTS.md):
//   node --test scripts/test-name-pattern-guard.test.mjs
// ---------------------------------------------------------------------------
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const GREEN = "guard fixture green case";
const RED = "guard fixture red case";

const FIXTURE = `import { test } from "node:test";
import assert from "node:assert/strict";

test("${GREEN}", () => {
  assert.ok(true);
});

test("${RED}", () => {
  assert.ok(false, "deliberately failing — the trap-masking fixture");
});
`;

/** Spawn `node --test` over a throwaway copy of the fixture; return the verdict. */
function runFixture(pattern) {
  const dir = mkdtempSync(join(tmpdir(), "rt-name-pattern-guard-"));
  const file = join(dir, "guard_fixture.test.mjs");
  writeFileSync(file, FIXTURE);
  try {
    // Pin the reporter EXPLICITLY: `node --test`'s default reporter is runtime-dependent
    // (TAP on Node 22, spec on Node 24), so an unqualified child makes the TAP assertions
    // below a host artifact. `npm test` + scripts/gate.sh already pass this flag.
    const args = [
      "--test",
      "--test-reporter=tap",
      ...(pattern === null ? [] : [`--test-name-pattern=${pattern}`]),
      file,
    ];
    // Scrub NODE_TEST_CONTEXT: this file runs INSIDE a `node --test` parent, which
    // exports the var to its children — a grandchild `node --test` would refuse
    // ("run() is being called recursively within a test file. skipping running
    // files.") and exit 0 having run NOTHING. Same trap class as the one guarded.
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const r = spawnSync(process.execPath, args, { encoding: "utf8", timeout: 60_000, env });
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    assert.ok(!out.includes("recursively within a test file"), `recursive-runner refusal leaked through: ${out.slice(0, 200)}`);
    return { status: r.status, out };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("THE TRAP — a pattern matching zero tests exits 0 over a file holding a RED test", () => {
  const r = runFixture("zzz_no_test_matches_zzz");
  assert.equal(r.status, 0, "the no-op: zero-match filter still exits 0");
  assert.match(r.out, /^1\.\.0\r?$/m, "zero subtests ran");
  assert.match(r.out, /^# pass 1\r?$/m, "the summary reads as if one test passed (the file wrapper)");
  assert.ok(!r.out.includes(RED), "the red test never ran — the exit code is blind to it");
});

test("THE RECIPE — requiring the expected test's own TAP line discriminates where the exit code lies", () => {
  const wantsRan = (out) => out.includes(`ok 1 - ${GREEN}`);
  const nomatch = runFixture("zzz_no_test_matches_zzz");
  const matched = runFixture(GREEN);
  assert.equal(wantsRan(nomatch.out), false, "trap output: the recipe reports NOT RUN (do not read green)");
  assert.equal(matched.status, 0);
  assert.match(matched.out, /^ok 1 - guard fixture green case\r?$/m, "match output: the recipe reports RAN");
});

test("CONTROL — the same fixture unfiltered exits 1, and a filter matching the red test still exits 1", () => {
  const unfiltered = runFixture(null);
  assert.equal(unfiltered.status, 1, "the masked red is real");
  assert.match(unfiltered.out, /deliberately failing/);
  const redMatched = runFixture(RED);
  assert.equal(redMatched.status, 1, "a MATCHING filter never masks");
});
