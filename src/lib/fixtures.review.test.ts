// ---------------------------------------------------------------------------
// fixtures.review.test.ts — T5.2-A fixtures honesty surface (R9-f05).
//
// `fixtures.review.ts` (client wrapper) + `fixtures.server.ts` (server loader)
// are reached by untested console UI only. This test drives them directly and
// pins the contract the module docblocks state in prose:
//   · a drafted fixture is PENDING (`awaiting-decision`) — never auto-approved;
//   · approval is a human-seat action: the only decision builder records an
//     actor and the surface label says this view records no decision;
//   · a denied verdict WRITES NOTHING and stamps no `decidedBy` — the corpus is
//     byte-identical after a reject, and the row is still pending.
// Run: node --experimental-strip-types --test --test-reporter=tap src/lib/fixtures.review.test.ts
// ---------------------------------------------------------------------------
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FIXTURE_REVIEW_LABEL, fixtureDecisionEntry } from "./fixtures.ts";
import { loadFixtureReviewRows, type FixtureLoadResult } from "./fixtures.server.ts";
import { fixturesReview } from "./fixtures.review.ts";

const tempDirs: string[] = [];

/** A fresh temp corpus dir; removed on test exit (never written into the repo). */
async function makeCorpusDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "rt-fixtures-review-"));
  tempDirs.push(dir);
  return dir;
}

const VALID_FIXTURE = [
  "---",
  "name: Demo Case",
  "kind: cli-tool",
  "domain: tooling",
  "acceptance: the CLI prints the expected line",
  "expectedNouns: [demo, line]",
  "expectedCapabilities: [print]",
  "baseline: none",
  "---",
  "## Provenance",
  "Hand-authored for the review surface.",
  "",
].join("\n");

const VALID_GRADER = {
  graderVersion: 2,
  slug: "demo",
  caseName: "Demo Case",
  acceptanceBar: "the CLI prints the expected line",
  requiredIdentifiers: ["print"],
  authority: "run-side authority; never copied into a project tree",
};

/** Write a corpus dir containing the given `<slug>.md` fixtures + graders. */
async function writeCorpus(
  fixtures: Record<string, string>,
  graders: Record<string, unknown>,
): Promise<string> {
  const dir = await makeCorpusDir();
  for (const [name, body] of Object.entries(fixtures)) {
    await writeFile(join(dir, `${name}.md`), body, "utf8");
  }
  const graderDir = join(dir, "graders");
  await mkdir(graderDir, { recursive: true });
  for (const [slug, doc] of Object.entries(graders)) {
    await writeFile(join(graderDir, `${slug}.grader.json`), JSON.stringify(doc), "utf8");
  }
  return dir;
}

/** A sorted listing of every file under `dir` with its byte length + mtime. */
async function snapshot(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const walk = async (current: string, prefix: string): Promise<void> => {
    for (const name of (await readdir(current)).sort()) {
      const full = join(current, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      const info = await stat(full);
      if (info.isDirectory()) {
        await walk(full, rel);
      } else {
        out[rel] = `${info.size}:${info.mtimeMs}:${await readFile(full, "utf8")}`;
      }
    }
  };
  await walk(dir, "");
  return out;
}

after(async () => {
  for (const dir of tempDirs) await rm(dir, { recursive: true, force: true });
});

describe("fixtures review surface — T5.2-A honesty contract (R9-f05)", () => {
  it("a drafted fixture is PENDING, never auto-approved", async () => {
    const dir = await writeCorpus({ demo: VALID_FIXTURE }, { demo: VALID_GRADER });
    const res: FixtureLoadResult = await loadFixtureReviewRows(dir);
    assert.equal(res.ok, true);
    assert.equal(res.rows.length, 1);
    const row = res.rows[0];
    assert.equal(row.slug, "demo");
    assert.equal(row.reviewState, "awaiting-decision", "a draft waits for the human seat");
    assert.notEqual(row.reviewState, "approved");
    assert.equal(row.graderOk, true);
    assert.equal(row.fixtureProblem, null);
    assert.equal(row.graderProblem, null);
    assert.equal(row.acceptanceBar, VALID_GRADER.acceptanceBar);
    assert.deepEqual(row.requiredIdentifiers, VALID_GRADER.requiredIdentifiers);
    assert.deepEqual(row.provenanceHeadings, ["Provenance"]);
  });

  it("the review label names approval as a CLI action and records no decision", async () => {
    const dir = await writeCorpus({ demo: VALID_FIXTURE }, { demo: VALID_GRADER });
    const res = await loadFixtureReviewRows(dir);
    assert.equal(res.label, FIXTURE_REVIEW_LABEL);
    assert.match(res.label, /read-only review/);
    assert.match(res.label, /approval is a CLI action/);
    assert.match(res.label, /records no decision/);
    assert.equal(res.rows[0].label, FIXTURE_REVIEW_LABEL);
  });

  it("approval needs the human seat — the decision builder carries the acting human", () => {
    const entry = fixtureDecisionEntry("demo", "approve", "operator@seat", "bar met");
    assert.equal(entry.kind, "fixture-review");
    assert.equal(entry.slug, "demo");
    assert.equal(entry.verdict, "approve");
    assert.equal(entry.actor, "operator@seat", "the verdict is attributed to a seat, never anonymous");
    assert.equal(entry.note, "bar met");
    assert.match(entry.at, /^\d{4}-\d{2}-\d{2}T/, "the verdict carries an ISO timestamp");
  });

  it("a denied verdict writes nothing and stamps no decidedBy", async () => {
    const dir = await writeCorpus({ demo: VALID_FIXTURE }, { demo: VALID_GRADER });
    const before = await snapshot(dir);

    // The module's ONLY verdict path builds a candidate entry; it has no writer.
    const denied = fixtureDecisionEntry("demo", "reject", "operator@seat", "bar not met");
    assert.equal(denied.verdict, "reject");
    assert.deepEqual(
      Object.keys(denied).sort(),
      ["actor", "at", "kind", "note", "slug", "verdict"],
      "the entry carries no decidedBy/decidedAt — the review surface records no decision",
    );
    assert.ok(!("decidedBy" in denied), "no decidedBy is stamped");
    assert.ok(!("decidedAt" in denied));

    // Re-reading the surface proves the reject changed nothing on disk and the
    // draft is STILL pending (nothing was approved, nothing was written).
    const after = await loadFixtureReviewRows(dir);
    assert.equal(after.ok, true);
    assert.equal(after.rows[0].reviewState, "awaiting-decision");
    assert.deepEqual(await snapshot(dir), before, "a denied verdict writes no file");
  });

  it("a missing corpus is an honest ok:false floor — never invented rows", async () => {
    const missing = join(tmpdir(), `rt-fixtures-absent-${Date.now()}-${Math.random()}`);
    const res = await loadFixtureReviewRows(missing);
    assert.equal(res.ok, false);
    assert.deepEqual(res.rows, []);
    assert.ok(
      res.problems.some((p) => /corpus dir unreadable/.test(p)),
      "the read failure is named, not hidden",
    );
    assert.equal(res.label, FIXTURE_REVIEW_LABEL);
  });

  it("an orphan grader is surfaced, never dropped silently", async () => {
    const dir = await writeCorpus(
      { demo: VALID_FIXTURE },
      { demo: VALID_GRADER, ghost: { ...VALID_GRADER, slug: "ghost" } },
    );
    const res = await loadFixtureReviewRows(dir);
    assert.equal(res.ok, true);
    assert.equal(res.rows.length, 1, "only the fixture with a file becomes a row");
    assert.ok(
      res.problems.some((p) => /orphan grader/.test(p) && /ghost/.test(p)),
      "the grader-without-fixture inconsistency is named",
    );
  });

  it("the client wrapper is a callable, non-throwing surface (createServerFn outside a request)", async () => {
    assert.equal(typeof fixturesReview, "function");
    // Outside a request context the transport refuses; the wrapper's catch must
    // return the honest { ok:false, rows:[] } shape rather than throw.
    const res = await fixturesReview();
    assert.equal(typeof res.ok, "boolean");
    assert.ok(Array.isArray(res.rows));
    assert.equal(typeof res.label, "string");
    if (!res.ok) assert.ok(res.problems.length > 0, "a refusal names its problem");
  });
});
