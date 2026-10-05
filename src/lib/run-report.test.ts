// ---------------------------------------------------------------------------
// run-report.test.ts — the plain-English run report (pure, deterministic).
// Run: node --experimental-strip-types --test src/lib/run-report.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createProject, runUntilGate } from "./headless.ts";
import { recordGateInto, runGate } from "./dod.ts";
import { PIPELINE_STAGE_IDS } from "./maker-score.ts";
import { PHASES } from "./phases.ts";
import { renderRunReport, reportedStageIds } from "./run-report.ts";
import type { PhaseId, Project } from "./types.ts";
import { FIXTURE_BRIEF } from "./testing/fixtures.ts";

/** A REAL engine-produced run: phase 0 synthesized AND gate-recorded by the
 *  driver (recordGateInto runs in finishPhase), so a passed gate is on record. */
async function runP0(): Promise<Project> {
  return (await runUntilGate(createProject({ brief: FIXTURE_BRIEF }), { maxSteps: 1 })).project;
}

/** A project whose P0 gate is recorded by the engine's own recorder over a
 *  genuinely incomplete phase — the red verdict and its unmet criteria come
 *  from `runGate`, never hand-written. */
function redGateProject(): Project {
  const p = createProject({ brief: FIXTURE_BRIEF });
  const marked: Project = {
    ...p,
    phases: p.phases.map((r) => (r.id === 0 ? { ...r, status: "complete" as const, startedAt: 1 } : r)),
  };
  return recordGateInto(marked, 0 as PhaseId);
}

describe("run-report: renderRunReport", () => {
  it("names every phase P0..P12 with its number and plain title", async () => {
    const p = await runP0();
    const md = renderRunReport(p);
    assert.deepEqual(reportedStageIds(p), [...PIPELINE_STAGE_IDS]);
    for (const def of PHASES) {
      assert.ok(md.includes(`### ${def.code} — ${def.title}`), `report must name ${def.code} ${def.title}`);
    }
    assert.equal((md.match(/^### /gm) ?? []).length, 13, "exactly one section per phase");
  });

  it("is honest about absent facts — a fresh record reads 'not recorded', never invented prose", () => {
    const p = createProject({ brief: FIXTURE_BRIEF });
    const md = renderRunReport(p);
    assert.ok(md.includes("not recorded"), "unknown fields must say not recorded");
    assert.ok(!md.includes("PASSED"), "a never-run phase has no passed gate to claim");
    assert.equal(reportedStageIds(p).length, 13);
  });

  it("reports a passed recorded gate (with its evidence hash)", async () => {
    const p = await runP0();
    const md = renderRunReport(p);
    assert.ok(/PASSED/.test(md), "P0's recorded gate passed and must read so");
    assert.ok(md.includes("evidence hash"), "a passed gate names its evidence hash");
  });

  it("reports a failed gate with the unmet criteria in the criteria's own words", () => {
    const p = redGateProject();
    const r = runGate(createProject({ brief: FIXTURE_BRIEF }), 0 as PhaseId);
    assert.equal(r.pass, false, "the fixture really evaluates red");
    const md = renderRunReport(p);
    assert.ok(md.includes("FAILED — unmet criteria:"), "a red gate must read FAILED");
    assert.ok(md.includes("Feasibility scorecard present with 5 axes"), "unmet criteria render in words");
    assert.ok(md.includes("P0 verdict resolved to proceed"), "every unmet criterion is named");
  });

  it("reports a coded refusal with what went wrong (the RT_E_* code plus the log detail)", async () => {
    const p = await runP0();
    const withRefusal: Project = {
      ...p,
      logs: [
        ...p.logs,
        {
          ts: 1,
          phase: 6 as PhaseId,
          level: "error" as const,
          event: "p6.synthesis.refused",
          detail: "RT_E_PLAN_UNDERPRODUCED · chunk 1/8 refused — the plan is under-produced; missing module(s): src/jobs",
        },
      ],
    };
    const md = renderRunReport(withRefusal);
    assert.ok(md.includes("RT_E_PLAN_UNDERPRODUCED"), "the code is named");
    assert.ok(md.includes("the plan is under-produced"), "the refusal states what went wrong");
    // And a phase with no refusal says so plainly.
    assert.ok(md.includes("**Coded refusals:** none recorded"), "clean phases read 'none recorded'");
  });

  it("lists the artifacts each phase produced by title", async () => {
    const p = await runP0();
    const md = renderRunReport(p);
    assert.ok(md.includes("**Artifacts ("), "an artifact tally is rendered");
    for (const a of p.artifacts.filter((x) => x.phase === 0)) {
      assert.ok(md.includes(a.title), `artifact title must appear: ${a.title}`);
    }
  });

  it("honours caller-supplied per-phase spend and says 'not recorded' when absent", async () => {
    const p = await runP0();
    const withSpend = renderRunReport(p, { spendByPhase: { 0: { calls: 3, promptTokens: 100, completionTokens: 40 } } });
    assert.ok(withSpend.includes("**Keyed spend:** 3 call(s), 100 prompt token(s), 40 completion token(s)"));
    const without = renderRunReport(p);
    assert.ok(without.includes("**Keyed spend:** not recorded"), "unmeasured per-phase spend stays honest");
  });

  it("350 (F1): reads the per-phase spend MEASURED onto the record instead of 'not recorded per phase'", async () => {
    const p = await runP0();
    const measured: Project = {
      ...p,
      phases: p.phases.map((r) =>
        r.id === 0 ? { ...r, spend: { promptTokens: 321, completionTokens: 54, calls: 2 } } : r,
      ),
    };
    const md = renderRunReport(measured);
    assert.ok(
      md.includes("**Keyed spend:** 2 call(s), 321 prompt token(s), 54 completion token(s)"),
      "the measured per-phase slice renders as REAL numbers, not 'not recorded per phase'",
    );
    assert.ok(!md.includes("not recorded per phase"), "a measured phase never falls back to the run-total notice");
    // The same run without a measured slice stays honest.
    assert.ok(!renderRunReport(p).includes("321 prompt token(s)"));
  });

  it("350 (F1): renders the persisted P6 tree-run/substance verdict; absent stays honestly 'not recorded'", async () => {
    const p = await runP0();
    const without = renderRunReport(p);
    assert.ok(without.includes("**Tree run:** not recorded"), "no persisted verdict ⇒ honest not recorded");
    assert.ok(without.includes("**Substance:** not recorded"));
    const withVerdict: Project = {
      ...p,
      treeRun: { ok: false, verdict: "fail", verdictHash: "689887517" },
      substance: { verdict: "stub" },
    };
    const md = renderRunReport(withVerdict);
    assert.ok(md.includes("**Tree run:** fail (evidence hash `689887517`)"), "the persisted P6 verdict is attributed to P6");
    assert.ok(md.includes("**Substance:** stub"), "the persisted substance census label is real on P6");
  });

  it("is pure and deterministic — same record, byte-identical report", async () => {
    const p = await runP0();
    assert.equal(renderRunReport(p), renderRunReport(p));
    assert.equal(renderRunReport(p, { generatedAt: 123 }), renderRunReport(p, { generatedAt: 123 }));
    assert.ok(renderRunReport(p, { generatedAt: "2026-10-05" }).includes("2026-10-05"));
  });
});
