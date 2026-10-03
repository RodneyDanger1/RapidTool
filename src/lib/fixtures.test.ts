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
import {
  FIXTURE_ACCEPTANCE_STATES,
  acceptanceDecisionQuestion,
  fixtureAcceptanceState,
} from "./fixtures.ts";

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

// ---------------------------------------------------------------------------
// 338-4 (W52) — the acceptance DECISION is machine-CHECKABLE but never
// machine-ANSWERABLE. `fixtureAcceptanceState` names the state a machine run
// can compute (nothing drafted / pending a human / machine-decided /
// unattributed / human-approved) and `acceptanceDecisionQuestion` is the ONE
// honest sentence per state. No input can move a record into `human-approved`:
// only the record's own `decidedBy` seat can.
// ---------------------------------------------------------------------------
describe("acceptance decision state — reading a decision, never minting one (338-4)", () => {
  const human = (id: string) => ({ id, approval: "approved", decidedBy: "human" });
  const auto = (id: string) => ({ id, approval: "approved", decidedBy: "autopilot" });
  const pending = (id: string) => ({ id, approval: "pending" });

  it("absent / empty are no-fixtures; a present non-list is unreadable — never conflated", () => {
    assert.equal(fixtureAcceptanceState(undefined).state, "no-fixtures");
    assert.equal(fixtureAcceptanceState(null).state, "no-fixtures");
    assert.equal(fixtureAcceptanceState([]).state, "no-fixtures");
    assert.equal(fixtureAcceptanceState("not-a-list").state, "unreadable");
    assert.equal(fixtureAcceptanceState({ a: 1 }).state, "unreadable");
    // "nothing drafted" and "unparseable record" are DIFFERENT failures and
    // carry different sentences; only the former means "not started yet".
    assert.notEqual(
      acceptanceDecisionQuestion(fixtureAcceptanceState(undefined)),
      acceptanceDecisionQuestion(fixtureAcceptanceState("not-a-list")),
    );
  });

  it("pending rows read 'waiting on a human' — and name the machine door that may not approve", () => {
    const s = fixtureAcceptanceState([pending("a"), pending("b")]);
    assert.equal(s.state, "pending");
    assert.equal(s.total, 2);
    assert.equal(s.approved, 0);
    assert.equal(s.pending, 2);
    assert.equal(s.decidedBy, "undecided");
    const q = acceptanceDecisionQuestion(s) ?? "";
    assert.match(q, /2 of 2 acceptance fixture\(s\) await a human decision/);
    assert.match(q, /--seat autopilot/);
    assert.match(q, /verified human seat/);
  });

  it("every approved row under the verified human seat is the ONLY satisfying state", () => {
    const s = fixtureAcceptanceState([human("a"), human("b")]);
    assert.equal(s.state, "human-approved");
    assert.equal(s.total, 2);
    assert.equal(s.approved, 2);
    assert.equal(s.pending, 0);
    assert.equal(s.decidedBy, "human");
    assert.equal(acceptanceDecisionQuestion(s), null, "the satisfied state asks no question");
  });

  it("autopilot-decided rows are NAMED as machine-decided, never read as human", () => {
    const s = fixtureAcceptanceState([auto("a")]);
    assert.equal(s.state, "machine-decided");
    assert.equal(s.decidedBy, "autopilot");
    assert.notEqual(s.state, "human-approved");
    const q = acceptanceDecisionQuestion(s) ?? "";
    assert.match(q, /autopilot seat/);
    assert.match(q, /is never minted for it/);
  });

  it("a mixed human+autopilot set reads machine-decided, never human-approved", () => {
    const s = fixtureAcceptanceState([human("a"), auto("b")]);
    assert.equal(s.state, "machine-decided");
    assert.equal(s.decidedBy, "autopilot");
    assert.notEqual(s.state, "human-approved");
  });

  it("approved with no seat (or an unknown seat) is 'unattributed' — never read as human", () => {
    const bare = fixtureAcceptanceState([{ id: "a", approval: "approved" }]);
    assert.equal(bare.state, "unattributed");
    assert.equal(bare.decidedBy, "undecided");
    const forged = fixtureAcceptanceState([{ id: "a", approval: "approved", decidedBy: "robot" }]);
    assert.equal(forged.state, "unattributed", "an unrecognized seat is not a human seat");
    assert.match(acceptanceDecisionQuestion(forged) ?? "", /no recorded decision seat/);
  });

  it("a partly-approved set is pending, and its approved rows still name their seat", () => {
    const s = fixtureAcceptanceState([human("a"), pending("b")]);
    assert.equal(s.state, "pending");
    assert.equal(s.approved, 1);
    assert.equal(s.pending, 1);
    assert.equal(s.decidedBy, "human", "the already-decided rows keep their provenance");
  });

  it("hostile rows count as pending — total is never dropped and nothing throws", () => {
    const s = fixtureAcceptanceState([null, 7, "x", human("a")]);
    assert.equal(s.total, 4);
    assert.equal(s.approved, 1);
    assert.equal(s.pending, 3);
    assert.equal(s.state, "pending");
    assert.equal(s.decidedBy, "human");
  });

  it("deterministic: same input → deep-equal state; the state list is stable", () => {
    const rows = [human("a"), auto("b"), pending("c")];
    assert.deepEqual(fixtureAcceptanceState(rows), fixtureAcceptanceState(rows));
    assert.deepEqual([...FIXTURE_ACCEPTANCE_STATES], [
      "no-fixtures",
      "unreadable",
      "pending",
      "machine-decided",
      "unattributed",
      "human-approved",
    ]);
  });
});

