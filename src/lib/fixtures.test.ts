// ---------------------------------------------------------------------------
// fixtures.test.ts — determinism contract of the shared engine fixtures
// (src/lib/testing/fixtures.ts): bounded, sleep-free, and ALWAYS parked at the
// requested gate's mouth, even for deep targets near the end of the 13-phase
// graph (regression: runToGate(seed, 12) used to exhaust its pass fuse at
// phase 11 and return short of the target).
// Run: node --experimental-strip-types --test src/lib/fixtures.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ALL_PHASES, runHeadless, runToGate, seedProject } from "./testing/fixtures.ts";
import { FIXTURE_REVIEW_LABEL, fixtureReviewRows, parseFixtureFrontmatter, parseGrader } from "./fixtures.ts";

describe("runToGate determinism", () => {
  it("seals every phase below target 12 and parks exactly at its mouth", () => {
    const g = runToGate(seedProject(), 12);
    assert.equal(g.status, "running");
    assert.equal(g.currentPhase, 12);
    assert.equal(g.phases.find((r) => r.id === 12)?.status, "ready");
    for (const id of ALL_PHASES.slice(0, 12)) {
      assert.equal(
        g.phases.find((r) => r.id === id)?.status,
        "complete",
        `phase ${id} must be sealed before the mouth of P12`,
      );
    }
  });

  it("seals every phase below target 10 (two HITL gates beyond the old fuse)", () => {
    const g = runToGate(seedProject(), 10);
    assert.equal(g.currentPhase, 10);
    for (const id of ALL_PHASES.slice(0, 10)) {
      assert.equal(g.phases.find((r) => r.id === id)?.status, "complete");
    }
    assert.equal(g.phases.find((r) => r.id === 10)?.status, "ready");
  });

  it("parks at the mouth of a HITL target without executing it (target stays ready)", () => {
    const g = runToGate(seedProject(), 4);
    assert.equal(g.status, "running");
    assert.equal(g.currentPhase, 4);
    assert.equal(g.phases.find((r) => r.id === 4)?.status, "ready", "P4 itself has not run yet");
    for (const id of ALL_PHASES.slice(0, 4)) {
      assert.equal(g.phases.find((r) => r.id === id)?.status, "complete");
    }
  });

  it("runHeadless seals a full run to P12 complete with the research corpus", () => {
    const g = runHeadless(seedProject(), ALL_PHASES);
    assert.equal(g.status, "complete");
    assert.equal(g.currentPhase, 12);
    for (const id of ALL_PHASES) {
      assert.equal(g.phases.find((r) => r.id === id)?.status, "complete", `phase ${id}`);
    }
    assert.ok(Array.isArray(g.research) && g.research.length > 0, "live-research corpus present");
  });
});

// ---------------------------------------------------------------------------
// W42·L1-E4 — fixtures REVIEW surface pins (src/lib/fixtures.ts): a fixture
// whose frontmatter never parsed must NEVER mint `reviewState:
// "awaiting-decision"` off the strength of its grader (W-29(g): the README
// fake row still minted), and the row must name the parse failure — including
// when no grader exists (the old "no grader file for this slug" text hid the
// fixture-side fault).
// ---------------------------------------------------------------------------
describe("fixture review rows — parse-failure honesty (W42·L1-E4)", () => {
  const validGrader = (slug: string) =>
    parseGrader(
      JSON.stringify({
        graderVersion: 2,
        slug,
        caseName: "Case",
        acceptanceBar: "the bar",
        requiredIdentifiers: ["a"],
        authority: "run-side",
      }),
      `${slug}.grader.json`,
    );

  it("unparseable fixture + valid grader → bar-missing + the parse failure is named (never awaiting-decision)", () => {
    const badFixture = parseFixtureFrontmatter("plain text, no fence", "broken.md");
    assert.equal(badFixture.ok, false);
    const rows = fixtureReviewRows([badFixture], [validGrader("broken")]);
    assert.equal(rows.length, 1);
    const row = rows[0];
    assert.notEqual(row.reviewState, "awaiting-decision", "an unparseable fixture is not reviewable");
    assert.equal(row.reviewState, "bar-missing");
    assert.ok(row.graderOk, "the grader itself parsed fine — the fixture is the fault");
    assert.match(row.fixtureProblem ?? "", /frontmatter fence/);
    assert.match(row.graderProblem ?? "", /frontmatter fence/, "the display slot names the parse failure too");
  });

  it("unparseable fixture + missing grader → both axes named, never only 'no grader file'", () => {
    const badFixture = parseFixtureFrontmatter("still no fence", "lost.md");
    const rows = fixtureReviewRows([badFixture], []);
    const row = rows[0];
    assert.equal(row.reviewState, "bar-missing");
    assert.match(row.fixtureProblem ?? "", /unparseable/);
    assert.match(row.graderProblem ?? "", /unparseable/, "the fixture fault is the FIRST problem named");
    assert.ok((row.graderProblem ?? "").includes("no grader file for this slug"), "the grader-side fact is kept too");
  });

  it("parseable fixture + valid grader → awaiting-decision, no problems (no regression)", () => {
    const good = parseFixtureFrontmatter("---\nname: Demo\nkind: cli-tool\n---\n## Provenance\nx", "demo.md");
    assert.equal(good.ok, true);
    const rows = fixtureReviewRows([good], [validGrader("demo")]);
    const row = rows[0];
    assert.equal(row.reviewState, "awaiting-decision");
    assert.equal(row.fixtureProblem, null);
    assert.equal(row.graderProblem, null);
    assert.deepEqual(row.provenanceHeadings, ["Provenance"]);
    assert.equal(row.label, FIXTURE_REVIEW_LABEL);
  });

  it("parseable fixture + missing grader → bar-missing with the grader text unchanged", () => {
    const good = parseFixtureFrontmatter("---\nname: Demo\n---\n", "solo.md");
    const rows = fixtureReviewRows([good], []);
    const row = rows[0];
    assert.equal(row.reviewState, "bar-missing");
    assert.equal(row.fixtureProblem, null);
    assert.equal(row.graderProblem, "no grader file for this slug");
  });
});
