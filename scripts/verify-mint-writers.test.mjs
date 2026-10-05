// ---------------------------------------------------------------------------
// verify-mint-writers.test.mjs — W61 lane D (D3 / TASKLIST D5, R2 Row 13):
// the SINGLE-WRITER guard for `lastTest.label:"tested"`.
//
// WHY: a `tested` stamp is a machine-verification claim. maker-score M4 and
// dod.ts `p6-verified` read it as proof, so a future regression that adds a
// THIRD writer — or a writer that stamps `tested` without an evidence hash or
// the executed-assertion floor — would mint fake proof by construction
// (AGENTS.md honesty rules 5–7: a pass-stamp has exactly one writer per
// evidence class).
//
// WHAT THIS PINS (static, keyless — no model, no key):
//   1. The set of non-test `src/lib/**` files that assign `label:"tested"` is a
//      SUBSET of the two deterministic mint seams: `verify.ts` (a real
//      verifyAndFixServer outcome applied) and `codegen.server.ts` (a real
//      verify outcome / green tree-run promoted). A new writer file fails here.
//   2. Every writer file carries the `evidenceHash` commitment.
//   3. The verify seam requires the executed-assertion floor (`caseSet` +
//      `hasRunnableCase` + `hasFinalSource`) before it stamps, and hashes the
//      committed inputs (`fnv1a`).
//   4. The codegen seam is the shared deterministic stamp helper
//      (`testedLastTestStamp`) and the tree-run mint is gated by
//      `treeRunTestedEvidence` (the executed-assertion floor) before it stamps.
//
// A new writer, a label mint without a hash, or a lost floor turns this red.
// Run: node --test scripts/verify-mint-writers.test.mjs
// ---------------------------------------------------------------------------
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIB_DIR = join(REPO_ROOT, "src", "lib");

/** The only files allowed to mint `lastTest.label:"tested"` (deterministic seams). */
const ALLOWED_WRITER_FILES = new Set([
  "src/lib/verify.ts",
  "src/lib/codegen.server.ts",
]);

/** Every non-test `.ts` file under src/lib (recursive). */
function libSourceFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...libSourceFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) {
      out.push(full);
    }
  }
  return out;
}

/** The source text of `file`, POSIX-normalized. */
const read = (file) => readFileSync(file, "utf8");

/** A line is a comment if its trimmed form starts with `//` or `*`. */
const isComment = (line) => /^\s*(\/\/|\*)/.test(line);

/**
 * Assignment sites of the tested label that actually produce a `lastTest`
 * stamp: a `label: "tested"` line whose ±6-line window names `lastTest` or the
 * `testedLastTestStamp` helper. A bare `label: "tested"` inside a reader's
 * projection type/object (doctor.ts's MachineAcceptanceEvidence) is NOT a
 * writer and must not be counted.
 */
function testedLabelWriters(text) {
  const hits = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isComment(line)) continue;
    if (!/label\s*:\s*"tested"|["']tested["']\s+as\s+const/.test(line)) continue;
    const window = lines.slice(Math.max(0, i - 6), i + 7).join("\n");
    if (/lastTest|testedLastTestStamp/.test(window)) {
      hits.push({ line: i + 1, text: line.trim() });
    }
  }
  return hits;
}

test("only the two deterministic seams mint lastTest.label:\"tested\"", () => {
  const writers = new Map(); // repo-relative path -> hits
  for (const file of libSourceFiles(LIB_DIR)) {
    const rel = relative(REPO_ROOT, file).split(sep).join("/");
    const hits = testedLabelWriters(read(file));
    if (hits.length > 0) writers.set(rel, hits);
  }
  assert.ok(writers.size > 0, "the guard found the mint seams (a zero-writer scan is a broken scan)");
  for (const [file, hits] of writers) {
    assert.ok(
      ALLOWED_WRITER_FILES.has(file),
      `UNAPPROVED writer of lastTest.label:"tested" in ${file}:${hits[0].line} — "${hits[0].text}". ` +
        "Only verify.ts and codegen.server.ts may mint it; add the writer to the allowlist ONLY with a new " +
        "deterministic, evidence-hash-bearing, executed-assertion-floor mint seam.",
    );
  }
  // Both known seams must still exist, so the guard cannot pass vacuously after a rename.
  for (const seam of ALLOWED_WRITER_FILES) {
    assert.ok(writers.has(seam), `the ${seam} mint seam is missing — update the guard with its replacement`);
  }
});

test("every writer carries the evidenceHash commitment", () => {
  for (const rel of ALLOWED_WRITER_FILES) {
    assert.ok(
      read(join(REPO_ROOT, rel.split("/").join(sep))).includes("evidenceHash"),
      `${rel} mints "tested" without an evidenceHash — a hash-less stamp is not machine proof`,
    );
  }
});

test("the verify seam requires the executed-assertion floor and hashes its inputs", () => {
  const src = read(join(REPO_ROOT, "src", "lib", "verify.ts"));
  assert.ok(src.includes("fnv1a"), "verify.ts commits the evidence hash through fnv1a");
  assert.ok(src.includes("caseSet"), "verify.ts inspects the case set before stamping tested");
  assert.ok(src.includes("hasRunnableCase"), "verify.ts requires ≥1 runnable case (the executed-assertion floor)");
  assert.ok(src.includes("hasFinalSource"), "verify.ts requires the executed final source before stamping tested");
});

test("the codegen seam stamps through the shared helper and the tree-run floor", () => {
  const src = read(join(REPO_ROOT, "src", "lib", "codegen.server.ts"));
  assert.ok(src.includes("function testedLastTestStamp"), "codegen.server.ts keeps ONE shared tested-stamp helper");
  assert.ok(src.includes("treeRunTestedEvidence"), "the tree-run mint is gated by the executed-assertion floor");
  assert.ok(src.includes('label: "tested" as const'), "the tested label lives in the deterministic stamp helper");
});

test("the ARMED resample selector cannot mint a tested verdict", () => {
  // The chunk resample (fixes/346-S4) selects by deterministic gates only
  // (structure -> brief-fit -> pre-seal tsc), never by behaviour. The selector
  // must stay mint-free: a resample winner earns "tested" only downstream,
  // through the single-writer floors guarded above.
  const src = read(join(REPO_ROOT, "src", "lib", "synthesis-policy.ts"));
  assert.ok(
    !/label\s*:\s*["']tested["']/.test(src),
    "synthesis-policy.ts (the resample selector) must not assign a tested label",
  );
  assert.ok(!src.includes("evidenceHash"), "the resample selector must not carry a machine-proof hash");
  assert.ok(!/\blastTest\b/.test(src), "the resample selector must not touch lastTest");
});
