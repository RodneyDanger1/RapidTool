import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  findTautologies,
  findZeroAssertionTests,
  lintSource,
  maskSource,
} from "./check-assertion-gaps.mjs";
import { projectRoot } from "./with-app-env.mjs";

/**
 * T-17 (fixes/216j) — pins for the assertion-gap lint.
 *
 * The lint exists because of the F-12 class: a green suite is not evidence when its
 * assertions cannot fail. These tests plant every flag class in a temp fixture tree and
 * assert the checker (a) detects each one with the right rule at the right line, (b) stays
 * quiet on clean code, fixture *strings*, and comments, and (c) never edits a flagged
 * file. They also lint this very file — a checker that cannot pass its own scan is not a
 * checker.
 */

const CHECKER = fileURLToPath(new URL("./check-assertion-gaps.mjs", import.meta.url));

/** A fixture tree under the OS temp dir (never inside the repo — the lint must not see it). */
function fixtureDir() {
  return mkdtempSync(join(tmpdir(), "assertion-gap-"));
}

function runChecker(args, cwd = projectRoot()) {
  return spawnSync(process.execPath, [CHECKER, ...args], { cwd, encoding: "utf8" });
}

const CLEAN_FIXTURE = [
  'import assert from "node:assert/strict";',
  'import { describe, it } from "node:test";',
  "",
  "// a comment mentioning assert.ok(true) must not be a finding",
  'const LABEL = "this string holds assert.equal(true, true) as data";',
  "",
  "describe(\"suite\", () => {",
  "  it(\"uses a real assertion\", () => {",
  "    const items = [1, 2, 3];",
  "    assert.equal(items.length, 3);",
  "    assert.deepEqual(items, [1, 2, 3]);",
  "  });",
  "",
  "  it(\"compares two different values\", () => {",
  "    const left = \"a\";",
  "    const right = \"b\";",
  "    assert.notEqual(left, right);",
  "  });",
  "});",
  "",
  "it(\"regex literals with quotes do not derail the masker\", () => {",
  "  assert.match(\"quote \\\" here\", /[\"']/);",
  "  assert.match(\"plain\", /plain/);",
  "});",
  "",
  "it(\"a throw path is a real failure\", () => {",
  "  if (1 + 1 !== 2) throw new Error(\"impossible\");",
  "});",
  "",
].join("\n");

test("T-17 detects assert.ok(true) as a tautology at its real line", () => {
  const source = ["import assert from \"node:assert/strict\";", "", "assert.ok(true);"].join("\n");
  const findings = findTautologies(source);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, "tautology:true-literal");
  assert.equal(findings[0].line, 3);
});

test("T-17 detects assert.ok(true, message) and bare assert(true)", () => {
  const message = findTautologies("assert.ok(true, \"must not throw\");");
  assert.equal(message.length, 1);
  assert.equal(message[0].rule, "tautology:true-literal");
  const bare = findTautologies("assert(true);");
  assert.equal(bare.length, 1);
  assert.equal(bare[0].rule, "tautology:true-literal");
});

test("T-17 does not flag assert.ok(flag) — a real value is asserted", () => {
  assert.deepEqual(findTautologies("assert.ok(isReady);"), []);
  assert.deepEqual(findTautologies("assert.ok(items.length > 0);"), []);
  assert.deepEqual(findTautologies("assert.ok(items.length === 0);"), []);
});

test("T-17 detects the .length floor family (>= 0, > -1, >= -1)", () => {
  for (const expr of ["items.length >= 0", "items.length > -1", "items.length >= -1"]) {
    const findings = findTautologies(`const items = [1]; assert.ok(${expr});`);
    assert.equal(findings.length, 1, `expected one finding for ${expr}`);
    assert.equal(findings[0].rule, "tautology:length-floor");
  }
});

test("T-17 detects a length floor split across two lines (house style)", () => {
  const source = ["assert.ok(", "  items", "    .length >= 0,", ");"].join("\n");
  const findings = findTautologies(source);
  // Parent-fix (W2 boundary): ONE tautology = ONE finding (no double-count of the
  // open call); exact-count kept for teeth.
  assert.equal(findings.length, 1, "one tautology, one finding");
  assert.ok(findings.every((f) => f.rule === "tautology:length-floor"));
});

test("T-17 does not flag a length comparison that is a compared value, not the subject", () => {
  assert.deepEqual(findTautologies("assert.equal(foo, items.length >= 0);"), []);
  assert.deepEqual(findTautologies("assert.equal(items.length, 0);"), []);
});

test("T-17 detects identical-literal and same-operand comparisons once each", () => {
  const pair = findTautologies("assert.equal(true, true);");
  assert.equal(pair.length, 1);
  assert.equal(pair[0].rule, "tautology:literal-pair");
  const nulls = findTautologies("assert.deepEqual(null, null);");
  assert.equal(nulls.length, 1);
  assert.equal(nulls[0].rule, "tautology:literal-pair");
  const same = findTautologies("assert.strictEqual(items.length, items.length);");
  assert.equal(same.length, 1);
  assert.equal(same[0].rule, "tautology:same-operand");
  assert.deepEqual(findTautologies("assert.equal(left, right);"), []);
  assert.deepEqual(findTautologies("assert.equal(true, false);"), []);
});

test("T-17 ignores tautologies that are data (strings, comments) — masking, not matching", () => {
  const source = [
    'const note = "assert.ok(true)";',
    "// assert.equal(true, true) in a comment",
    "/* assert.ok(items.length >= 0) */",
    "const re = /assert\\.ok\\(true\\)/;",
    "assert.equal(note.length, 19);",
  ].join("\n");
  assert.deepEqual(findTautologies(source), []);
  assert.deepEqual(findZeroAssertionTests(source), []);
});

test("T-17 zero-assertion: a test callback with no assert and no throw is flagged", () => {
  const source = ['import { test } from "node:test";', "", 'test("does nothing", () => {', "  const x = 1;", "});"].join("\n");
  const findings = findZeroAssertionTests(source);
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, "zero-assertion");
  assert.equal(findings[0].line, 3);
  assert.match(findings[0].reason, /does nothing/);
});

test("T-17 zero-assertion: assert, throw, and it.only callbacks are not flagged, skips and describes are not tests", () => {
  const source = [
    'import assert from "node:assert/strict";',
    'import { describe, it, test } from "node:test";',
    'it("asserts", () => { assert.ok(1); });',
    'it("throws", () => { throw new Error("boom"); });',
    'it.only("asserts too", async () => { await Promise.resolve(); assert.equal(1, 1); });',
    'test.skip("no callback at all");',
    'test.todo("later");',
    'describe("a suite with no assertions of its own", () => {});',
    "const matcher = /it\\(/;",
    'test("hands the work to a helper that asserts", () => {',
    "  assertRunnerThrows(",
    "});",
    "function assertRunnerThrows() {}",
  ].join("\n");
  assert.deepEqual(findZeroAssertionTests(source), []);
});

test("T-17 lintSource tags findings with the file so the CLI can print file:line", () => {
  const findings = lintSource("assert.ok(true);", "src/lib/example.test.ts");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].file, "src/lib/example.test.ts");
  assert.equal(findings[0].line, 1);
});

test("T-17 maskSource preserves offsets and newlines while blanking string bodies", () => {
  const source = 'const a = "assert.ok(true)";\nassert.ok(true);\n';
  const masked = maskSource(source);
  assert.equal(masked.length, source.length, "masking preserves length (line numbers stay real)");
  assert.equal(masked.split("\n").length, source.split("\n").length);
  // Parent-fix: the old pair of assertions contradicted itself (the real call on
  // line 2 contains the same substring the string body does). Exact count is the
  // honest form of both intents: the string body's copy is gone, the real call stays.
  assert.equal(
    masked.split("assert.ok(true)").length - 1,
    1,
    "the string body's copy is blanked; exactly the real call survives",
  );
});

test("T-17 CLI: planted fixtures are reported as file:line and the run exits non-zero", () => {
  const dir = fixtureDir();
  writeFileSync(
    join(dir, "planted.test.mjs"),
    [
      'import assert from "node:assert/strict";',
      'import { test } from "node:test";',
      "",
      'test("plants every class", () => {',
      "  const items = [1, 2, 3];",
      "  assert.ok(true);",
      "  assert.ok(items.length >= 0);",
      "  assert.equal(true, true);",
      "  assert.strictEqual(items.length, items.length);",
      "});",
      "",
      'test("plants a zero-assertion block", () => {',
      "  const unused = 41;",
      "});",
      "",
    ].join("\n"),
  );
  const run = runChecker([dir]);
  assert.equal(run.status, 1, `expected exit 1 for findings, got ${run.status}\n${run.stdout}`);
  const lines = run.stdout.trim().split("\n");
  assert.ok(lines.some((l) => /planted\.test\.mjs:6: \[tautology:true-literal\]/.test(l)), run.stdout);
  assert.ok(lines.some((l) => /planted\.test\.mjs:7: \[tautology:length-floor\]/.test(l)), run.stdout);
  assert.ok(lines.some((l) => /planted\.test\.mjs:8: \[tautology:literal-pair\]/.test(l)), run.stdout);
  assert.ok(lines.some((l) => /planted\.test\.mjs:9: \[tautology:same-operand\]/.test(l)), run.stdout);
  assert.ok(lines.some((l) => /planted\.test\.mjs:12: \[zero-assertion\]/.test(l)), run.stdout);
  assert.match(run.stdout, /5 finding\(s\)/);
});

test("T-17 CLI: a clean fixture tree stays quiet and exits 0", () => {
  const dir = fixtureDir();
  writeFileSync(join(dir, "clean.test.mjs"), CLEAN_FIXTURE);
  const run = runChecker([dir]);
  assert.equal(run.status, 0, `expected exit 0 on clean code\n${run.stdout}\n${run.stderr}`);
  assert.match(run.stdout, /clean — 1 test file scanned, 0 findings/);
});

test("T-17 CLI: a directory walk only picks test-shaped files, an explicit file is always linted", () => {
  const dir = fixtureDir();
  writeFileSync(join(dir, "helper.mjs"), "export const planted = () => assert.ok(true);\n");
  const dirRun = runChecker([dir]);
  // Parent-fix: a dir walk resolving ZERO test-shaped files is a VISIBLE
  // "nothing to check" error (exit 2), never a silent pass; what the walk must
  // NOT do is lint non-test files — proven by the zero-file outcome + message.
  assert.equal(dirRun.status, 2, `non-test files must not be scanned by a dir walk\n${dirRun.stdout}`);
  assert.match(dirRun.stderr, /no test files resolved/);
  const fileRun = runChecker([join(dir, "helper.mjs")]);
  assert.equal(fileRun.status, 1, "an explicitly named file is linted whatever it is called");
  assert.match(fileRun.stdout, /helper\.mjs:1: \[tautology:true-literal\]/);
});

test("T-17 CLI: --json emits the same findings machine-readably", () => {
  const dir = fixtureDir();
  writeFileSync(join(dir, "planted.test.ts"), "assert.ok(true);\n");
  const run = runChecker([dir, "--json"]);
  assert.equal(run.status, 1);
  const payload = JSON.parse(run.stdout);
  assert.equal(payload.files, 1);
  assert.equal(payload.findings.length, 1);
  // Parent-fix: the JSON must carry the SAME repo-relative POSIX path the text
  // mode prints (it is relative to the repo root, e.g. ../../AppData/... for a
  // temp fixture dir), so assert the stable suffix rather than a basename.
  assert.ok(
    payload.findings[0].file.replace(/\\/g, "/").endsWith("/planted.test.ts"),
    `json path is the same repo-relative form as text mode: ${payload.findings[0].file}`,
  );
  assert.equal(payload.findings[0].line, 1);
  assert.equal(payload.findings[0].rule, "tautology:true-literal");
});

test("T-17 CLI: an unknown path is a usage error (exit 2), never a silent pass", () => {
  const run = runChecker([join(fixtureDir(), "does-not-exist")]);
  assert.equal(run.status, 2);
  assert.match(run.stderr, /no such path/);
});

test("T-17 CLI: the checker never edits a flagged file (reports, not repairs)", () => {
  const dir = fixtureDir();
  const file = join(dir, "untouched.test.mjs");
  const planted = ['import assert from "node:assert/strict";', "assert.ok(true);", ""].join("\n");
  writeFileSync(file, planted);
  const before = readFileSync(file, "utf8");
  const run = runChecker([dir]);
  assert.equal(run.status, 1, "the planted tautology is found");
  assert.equal(readFileSync(file, "utf8"), before, "the flagged file is byte-identical after the run");
  assert.ok(readFileSync(file, "utf8").includes("assert.ok(true);"), "the tautology is still there to be fixed by a human");
});

test("T-17 CLI: the live repo tree is scanned end-to-end without crashing", () => {
  const run = runChecker([]);
  assert.ok(run.status === 0 || run.status === 1, `unexpected exit ${run.status}\n${run.stderr}`);
  const lines = run.stdout.trim().split("\n");
  assert.match(lines[lines.length - 1], /^\[assertion-gap\]/);
  for (const line of lines.slice(0, -1)) {
    assert.match(line, /^.+:\d+: \[[a-z:-]+\] .+/, `finding line is not file:line-shaped: ${line}`);
  }
});

test("T-17 self-application: this test file is clean under its own checker", () => {
  const self = readFileSync(fileURLToPath(import.meta.url), "utf8");
  const findings = lintSource(self, "scripts/check-assertion-gaps.test.mjs");
  assert.deepEqual(
    findings.map((f) => `${f.line}: [${f.rule}] ${f.reason}`),
    [],
    "the checker's own tests must contain no tautologies and no zero-assertion blocks",
  );
});
