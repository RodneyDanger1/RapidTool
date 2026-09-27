// ---------------------------------------------------------------------------
// report-intake.test.ts — agent-report validation + pure applyReport.
// Run: node --experimental-strip-types --test src/lib/report-intake.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyReport,
  applyReportResult,
  validateReport,
  type AgentReport,
} from "./report-intake.ts";
import { seedProject } from "./testing/fixtures.ts";

describe("validateReport", () => {
  it("rejects non-object payloads", () => {
    for (const bad of [null, "hi", 42, ["a"]]) {
      const res = validateReport(bad);
      assert.equal(res.ok, false, `should reject ${JSON.stringify(bad)}`);
    }
  });

  it("rejects an invalid phase", () => {
    for (const bad of [-1, 13, 1.5, "4", null]) {
      const res = validateReport({ phase: bad, status: "complete", summary: "x" });
      assert.equal(res.ok, false, `should reject phase ${JSON.stringify(bad)}`);
      if (!res.ok) assert.match(res.error, /phase/i);
    }
  });

  it("rejects an invalid status", () => {
    const res = validateReport({ phase: 3, status: "bogus", summary: "x" });
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.error, /status/i);
  });

  it("rejects a missing or blank summary", () => {
    const missing = validateReport({ phase: 3, status: "complete" });
    assert.equal(missing.ok, false);
    const blank = validateReport({ phase: 3, status: "complete", summary: "   " });
    assert.equal(blank.ok, false);
  });

  it("rejects malformed artifacts", () => {
    const emptyTitle = validateReport({
      phase: 3,
      status: "complete",
      summary: "x",
      artifacts: [{ title: "", body: "b" }],
    });
    assert.equal(emptyTitle.ok, false);
    const nonArray = validateReport({ phase: 3, status: "complete", summary: "x", artifacts: "nope" });
    assert.equal(nonArray.ok, false);
    const noBody = validateReport({ phase: 3, status: "complete", summary: "x", artifacts: [{ title: "t" }] });
    assert.equal(noBody.ok, false);
  });

  it("rejects malformed files", () => {
    const empty = validateReport({ phase: 3, status: "complete", summary: "x", files: [""] });
    assert.equal(empty.ok, false);
    const nonArray = validateReport({ phase: 3, status: "complete", summary: "x", files: "nope" });
    assert.equal(nonArray.ok, false);
  });

  it("accepts a valid report and normalizes it", () => {
    const res = validateReport({
      phase: 4,
      status: "partial",
      summary: "  half done  ",
      artifacts: [
        { title: "plan", body: "body", language: "markdown" },
        { title: "code", body: "const x = 1;", language: "" },
      ],
      files: ["a.ts", "b.ts"],
    });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.report.phase, 4);
      assert.equal(res.report.status, "partial");
      assert.equal(res.report.summary, "half done");
      assert.equal(res.report.artifacts?.length, 2);
      assert.equal(res.report.artifacts?.[0].language, "markdown");
      assert.equal(res.report.artifacts?.[1].language, undefined);
      assert.deepEqual(res.report.files, ["a.ts", "b.ts"]);
    }
  });

  it("omits absent optional fields", () => {
    const res = validateReport({ phase: 0, status: "complete", summary: "done" });
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.report.artifacts, undefined);
      assert.equal(res.report.files, undefined);
    }
  });

  it("rejects a report for any phase other than the caller's live currentPhase", () => {
    const res = validateReport(
      { phase: 4, status: "complete", summary: "late report" },
      3,
    );
    assert.equal(res.ok, false);
    if (!res.ok) assert.match(res.error, /does not match the current phase 3/);
    // The current edge itself is accepted.
    const ok = validateReport({ phase: 3, status: "complete", summary: "on time" }, 3);
    assert.equal(ok.ok, true);
  });

  it("fingerprints the NORMALIZED report: raw-whitespace variants are duplicates (E-09)", () => {
    const v1 = validateReport({
      phase: 3,
      status: "complete",
      summary: "  shipped contracts ",
      artifacts: [{ title: "  module\n\nnotes ", body: "exports.x = 1;" }],
      files: [" src/a.ts ", "src/b.ts"],
    });
    const v2 = validateReport({
      phase: 3,
      status: "complete",
      summary: "shipped contracts",
      artifacts: [{ title: "module notes", body: "exports.x = 1;" }],
      files: ["src/a.ts", "src/b.ts"],
    });
    assert.equal(v1.ok, true);
    assert.equal(v2.ok, true);
    if (!v1.ok || !v2.ok) return;
    const first = applyReportResult(seedProject(), v1.report);
    assert.equal(first.applied, true);
    const second = applyReportResult(first.project, v2.report);
    assert.equal(second.applied, false, "whitespace variant must fingerprint identically");
    assert.equal(second.reason, "duplicate");
  });

  it("records each no-artifact blocked attempt truthfully (documented E-09 edge)", () => {
    const project = seedProject();
    const blocked: AgentReport = { phase: 5, status: "blocked", summary: "stalled" };
    const first = applyReportResult(project, blocked);
    const second = applyReportResult(first.project, blocked);
    assert.equal(first.applied, true);
    // No artifact/memory anchor exists for an artifact-less blocked report, so
    // every attempt is the truthful per-attempt record — and stays bounded by
    // the log slice.
    assert.equal(second.applied, true);
    const rec = second.project.phases.find((p) => p.id === 5);
    assert.equal(rec?.rejectionHistory?.length, 2);
  });
});

describe("applyReport", () => {
  const report: AgentReport = {
    phase: 3,
    status: "partial",
    summary: "built half the contracts",
    artifacts: [
      { title: "openapi", body: "# OpenAPI draft", language: "markdown" },
      { title: "module", body: "console.log('x')", language: "javascript" },
    ],
    files: ["src/a.ts", "src/b.ts"],
  };

  it("returns a NEW project and does not mutate the input", () => {
    const project = seedProject();
    const before = JSON.stringify(project);
    const artCount = project.artifacts.length;
    const logCount = project.logs.length;
    const out = applyReport(project, report);
    assert.notEqual(out, project);
    assert.equal(JSON.stringify(project), before); // input untouched
    assert.equal(project.artifacts.length, artCount);
    assert.equal(project.logs.length, logCount);
    assert.equal(out.artifacts.length, artCount + 2);
    assert.equal(out.logs.length, logCount + 1);
  });

  it("appends report artifacts with the report marker + unverified footer", () => {
    const out = applyReport(seedProject(), report);
    const added = out.artifacts.slice(-2);
    assert.equal(added.length, 2);
    for (const a of added) {
      assert.match(a.id, /^report-3-\d+-\d+$/);
      assert.equal(a.phase, 3);
      assert.equal(a.kind, "docs");
      assert.match(a.title, /^\[agent report\] /);
      assert.match(a.body, /unverified by engine/);
    }
    assert.equal(added[1].language, "javascript");
  });

  it("appends an agent.report log with the status + summary", () => {
    const out = applyReport(seedProject(), report);
    const log = out.logs[out.logs.length - 1];
    assert.equal(log.event, "agent.report");
    assert.equal(log.phase, 3);
    assert.equal(log.level, "info");
    assert.match(log.detail, /partial/);
    assert.match(log.detail, /built half the contracts/);
  });

  it("records a blocked report's note + a truthful rejection-history entry (no status flip)", () => {
    const project = seedProject();
    const blocked: AgentReport = { phase: 5, status: "blocked", summary: "stalled on validation fixture" };
    const out = applyReport(project, blocked);
    const rec = out.phases.find((p) => p.id === 5);
    assert.ok(rec);
    assert.equal(rec?.rejectionNote, "stalled on validation fixture");
    assert.notEqual(rec?.status, "rejected");
    // M-05: attempt counting stays truthful — a blocked report IS a rejection.
    assert.equal(rec?.rejectionHistory?.length, 1);
    assert.equal(rec?.rejectionHistory?.[0].note, "stalled on validation fixture");
    assert.equal(out.status, project.status); // project status untouched
    const log = out.logs[out.logs.length - 1];
    assert.equal(log.level, "warn");
  });

  it("writes agent lessons back to memory on a complete report (M-08)", () => {
    const project = seedProject();
    const before = project.memory.length;
    const complete: AgentReport = {
      phase: 3,
      status: "complete",
      summary: "shipped the contracts module",
      artifacts: [{ title: "module", body: "exports.contracts = [];" }],
    };
    const out = applyReport(project, complete);
    assert.ok(out.memory.length > before, "memory grows from a complete report");
    assert.ok(
      out.memory.some((m) => m.kind === "semantic" && m.text.includes("shipped the contracts module")),
      "semantic row carries the summary",
    );
    assert.ok(out.memory.some((m) => m.kind === "episodic"), "episodic rows per artifact");
  });

  it("does NOT set a rejection note for complete/partial reports", () => {
    const out = applyReport(seedProject(), report);
    const rec = out.phases.find((p) => p.id === 3);
    assert.equal(rec?.rejectionNote, undefined);
  });
});

// ---------------------------------------------------------------------------
// Learning-loop lesson capture (fixes/98 writer 2(a) + M-08 E-18 stamp)
// ---------------------------------------------------------------------------

describe("applyReport — learning-loop lesson capture (fixes/98)", () => {
  const completeReport: AgentReport = {
    phase: 3,
    status: "complete",
    summary: "shipped the contracts module",
    artifacts: [{ title: "module", body: "exports.contracts = [];" }],
  };

  // Fresh seed: phase 3's only probe (p3-mcp artifact) is unmet -> L2 fires.
  it("a complete report over an unmet gate mints exactly one L2 lesson row + a lesson.capture log", () => {
    const project = seedProject();
    const out = applyReport(project, completeReport);
    const lessons = out.memory.filter((m) => m.id.startsWith("lesson-template-emission-"));
    assert.equal(lessons.length, 1, "exactly one L2 row (content-addressed, anti-noise (a))");
    const lesson = lessons[0];
    assert.match(lesson.id, /^lesson-template-emission-[0-9a-f]{8}$/);
    assert.equal(lesson.kind, "episodic");
    assert.equal(lesson.phase, 3);
    assert.equal(lesson.source, "agent-report", "E-18 stamp mirrors M-08");
    assert.ok((lesson.tags ?? []).includes("lesson"));
    assert.ok((lesson.tags ?? []).includes("template-emission"));
    assert.ok((lesson.tags ?? []).includes("L2"));
    assert.match(lesson.text, /gate unmet \(p3-mcp\)/);
    assert.match(lesson.text, /evidenceHash=[0-9a-f]{8}/);
    assert.ok(lesson.text.length <= 240, "H43-P2-2 budget");
    assert.ok(
      out.logs.some(
        (l) => l.event === "lesson.capture" && l.detail.includes(lesson.id),
      ),
      "ledger rule: lesson.capture event names the row (98 §0 law 4)",
    );
    assert.ok(out.logs.some((l) => l.event === "report.gate_unmet"), "E-16 warn preserved");
  });

  it("stamps source agent-report on the M-08 semantic + episodic rows (H43-P3-3)", () => {
    const out = applyReport(seedProject(), completeReport);
    const semantic = out.memory.find((m) => m.id.startsWith("report-semantic-3-"));
    const episodic = out.memory.find((m) => m.id.startsWith("report-episodic-3-"));
    assert.ok(semantic && episodic, "M-08 rows present");
    assert.equal(semantic?.source, "agent-report");
    assert.equal(episodic?.source, "agent-report");
    assert.ok(semantic?.text.startsWith("(DoD unmet: p3-mcp) "), "E-16 prefix preserved");
  });

  it("appends no lesson row when the claimed phase's gate passes (byte-identical no-row case)", () => {
    // Satisfy P3's only probe (p3-mcp artifact) so reportGateDelta returns [].
    const project = seedProject({
      artifacts: [
        { id: "mcp-1", phase: 3, kind: "mcp", title: "MCP contract", body: "contract" },
      ],
    });
    const before = project.memory.length;
    const out = applyReport(project, completeReport);
    assert.ok(!out.memory.some((m) => m.id.startsWith("lesson-")), "no lesson row when gate passes");
    assert.ok(!out.logs.some((l) => l.event === "lesson.capture"));
    assert.ok(!out.logs.some((l) => l.event === "report.gate_unmet"));
    const semantic = out.memory.find((m) => m.id.startsWith("report-semantic-3-"));
    assert.equal(semantic?.source, "agent-report", "M-08 stamp independent of the gate");
    assert.ok(!semantic?.text.startsWith("(DoD unmet"), "no unmet prefix when the gate passes");
    // Memory grew by exactly the M-08 rows (1 semantic + 1 episodic).
    assert.equal(out.memory.length, before + 2);
  });

  it("keeps the L2 capture idempotent across re-applies (E-09)", () => {
    const first = applyReportResult(seedProject(), completeReport);
    assert.equal(first.applied, true);
    const second = applyReportResult(first.project, completeReport);
    assert.equal(second.applied, false);
    assert.equal(second.reason, "duplicate");
    assert.equal(
      second.project.memory.filter((m) => m.id.startsWith("lesson-")).length,
      first.project.memory.filter((m) => m.id.startsWith("lesson-")).length,
      "re-apply never forks lesson rows",
    );
  });

  it("accrues reproducedCount on the ONE stored L2 row when a later complete report re-mints the same signature id (216i T1)", () => {
    const first = applyReportResult(seedProject(), completeReport);
    assert.equal(first.applied, true);
    const original = first.project.memory.find((m) => m.id.startsWith("lesson-template-emission-"));
    assert.ok(original, "the first complete report minted the L2 row");
    const lessonId = original.id;
    assert.equal(original.reproducedCount, undefined, "a first landing carries no reproduction count");
    // A DIFFERENT complete claim (different fingerprint, so not the E-09
    // duplicate) landing on the SAME unmet P3 gate re-mints the same
    // signature id — the stored row must accrue, never fork a twin.
    const secondReport: AgentReport = {
      phase: 3,
      status: "complete",
      summary: "shipped the contracts module, second pass",
      artifacts: [{ title: "module v2", body: "exports.contracts = [];" }],
    };
    const second = applyReportResult(first.project, secondReport);
    assert.equal(second.applied, true, "a different claim is not the E-09 duplicate");
    const rows = second.project.memory.filter((m) => m.id === lessonId);
    assert.equal(rows.length, 1, "ONE stored row — the re-mint never forks a twin");
    assert.equal(rows[0]?.reproducedCount, 1, "the reproduction accrues on the stored row");
    assert.ok(
      second.project.logs.some(
        (l) =>
          l.event === "lesson.reproduced" &&
          l.detail.includes(lessonId) &&
          l.detail.includes("reproducedCount=1"),
      ),
      "the visible lesson.reproduced ledger row names the row + count",
    );
  });

  it("blocked/partial reports mint no lesson rows (advisory capture only on complete claims)", () => {
    const partial: AgentReport = { phase: 3, status: "partial", summary: "half built" };
    const out = applyReport(seedProject(), partial);
    assert.ok(!out.memory.some((m) => m.id.startsWith("lesson-")));
    assert.ok(!out.logs.some((l) => l.event === "lesson.capture"));
  });
});
