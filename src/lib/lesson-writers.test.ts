// ---------------------------------------------------------------------------
// lesson-writers.test.ts — L1–L5 lesson writer WIRING regression suite
// (fixes/117). Drives a real fixture through a failed seal, a vague P0, and a
// machine verify outcome, then asserts the content-addressed lesson rows landed
// in project.memory with the right tags/kinds — deterministic, no keys, no
// network.
//
// Run: node --experimental-strip-types --test src/lib/lesson-writers.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyPhaseResult, emptyProject, sealHonesty } from "./engine.ts";
import { applyVerifyOutcome, approve, runUntilGate } from "./headless.ts";
import { runSummaryLesson, verifyOutcomeLesson } from "./knowledge.ts";
import { runToGate, seedProject } from "./testing/fixtures.ts";
import type { PhaseId, Project } from "./types.ts";

// engine.ts resolves the pure lesson builders from knowledge.ts lazily (its
// node:fs import is client-hostile). Force-load the module first so the lazy
// seam is populated before any synchronous applyPhaseResult call below.
await import("./knowledge.ts");

/** Drive a project to completion through the headless loop (deterministic). */
async function drainToComplete(project: Project): Promise<Project> {
  let p = project;
  for (let i = 0; i < 40; i++) {
    if (p.status === "complete" || p.status === "blocked") return p;
    const res = await runUntilGate(p, { maxSteps: 1 });
    p = res.project;
    if (p.status === "awaiting_hitl") p = approve(p);
  }
  return p;
}

describe("L1 — vague-brief lesson at the P0 lattice seal", () => {
  it("a vocabulary-free brief sealing P0 mints one vague-brief lesson row (engine source)", async () => {
    await import("./knowledge.ts");
    const out = applyPhaseResult(
      emptyProject({ name: "Vague", brief: "build a tool for my team please" }),
      0,
    );
    const lessons = out.memory.filter((m) => m.id.startsWith("lesson-vague-brief-"));
    assert.equal(lessons.length, 1, "exactly one L1 row (content-addressed)");
    const row = lessons[0];
    assert.match(row.id, /^lesson-vague-brief-[0-9a-f]{8}$/);
    assert.equal(row.phase, 0);
    assert.equal(row.kind, "semantic");
    assert.equal(row.source, "engine");
    assert.ok((row.tags ?? []).includes("lesson"));
    assert.ok((row.tags ?? []).includes("vague-brief"));
    assert.ok((row.tags ?? []).includes("L1"));
    assert.ok(row.text.length <= 240, "H43-P2-2 budget");
    assert.ok(out.logs.some((l) => l.event === "lesson.capture"), "lesson.capture ledger event");
  });

  it("a rich brief sealing P0 mints no vague-brief lesson", async () => {
    await import("./knowledge.ts");
    const out = applyPhaseResult(seedProject(), 0);
    assert.ok(
      !out.memory.some((m) => m.id.startsWith("lesson-vague-brief-")),
      "no L1 row when the lattice is not vague/empty",
    );
  });
});

describe("L2 — template-emission lesson at engine seal (failed gate)", () => {
  it("P6 sealing with the deterministic placeholder (brief nouns absent) mints L2", async () => {
    await import("./knowledge.ts");
    const parked = runToGate(seedProject(), 6);
    const out = applyPhaseResult(parked, 6);
    const lessons = out.memory.filter((m) => m.id.startsWith("lesson-template-emission-"));
    assert.ok(lessons.length >= 1, "an L2 row must land for the P6 failed seal");
    const row = lessons.find((m) => m.phase === 6);
    assert.ok(row, "the L2 row is for P6");
    assert.match(row.id, /^lesson-template-emission-[0-9a-f]{8}$/);
    assert.equal(row.kind, "episodic");
    assert.equal(row.source, "engine");
    assert.ok((row.tags ?? []).includes("lesson"));
    assert.ok((row.tags ?? []).includes("template-emission"));
    assert.ok((row.tags ?? []).includes("L2"));
    assert.ok(row.text.length <= 240, "H43-P2-2 budget");
    assert.ok(out.logs.some((l) => l.event === "lesson.capture"), "lesson.capture ledger event");
  });
});

describe("L3/L4 — verify outcome lesson (verify.server seam + headless append)", () => {
  it("verifyOutcomeLesson dispatches passed → L4 verified-procedure, failed → L3 verify-failure", () => {
    const l4 = verifyOutcomeLesson("passed", 6, "3/3 machine-run cases passed", 1);
    assert.match(l4.id, /^lesson-verified-procedure-[0-9a-f]{8}$/);
    assert.equal(l4.kind, "procedural");
    assert.ok((l4.tags ?? []).includes("L4"));
    assert.ok((l4.tags ?? []).includes("lesson"));

    const l3 = verifyOutcomeLesson("failed", 6, "cases still failing", 3);
    assert.match(l3.id, /^lesson-verify-failure-[0-9a-f]{8}$/);
    assert.equal(l3.kind, "episodic");
    assert.ok((l3.tags ?? []).includes("L3"));
    assert.ok((l3.tags ?? []).includes("lesson"));
  });

  it("applyVerifyOutcome appends the L4 lesson row on a passed outcome", () => {
    const p = seedProject();
    const lesson = verifyOutcomeLesson("passed", 6, "3/3 machine-run cases passed", 1);
    const q = applyVerifyOutcome(p, {
      status: "passed",
      iterations: 1,
      evidence: "3/3 machine-run cases passed",
      finalSource: "export const add = (a, b) => a + b;",
      cases: [{ id: "case-1", expression: "add(2,3) === 5" }],
      lesson,
    });
    assert.ok(q.memory.some((m) => m.id === lesson.id), "L4 lesson lands in project memory");
    assert.ok(q.logs.some((l) => l.event === "lesson.capture"));
  });

  it("applyVerifyOutcome appends the L3 lesson row on a failed outcome, once (idempotent)", () => {
    const p = seedProject();
    const lesson = verifyOutcomeLesson("failed", 6, "cases still failing", 3);
    const outcome = { status: "failed" as const, iterations: 3, evidence: "cases still failing", lesson };
    const q1 = applyVerifyOutcome(p, outcome);
    const q2 = applyVerifyOutcome(q1, outcome);
    const rows = (q2.memory ?? []).filter((m) => m.id === lesson.id);
    assert.equal(rows.length, 1, "re-applying a failed outcome never forks the L3 row");
  });
});

describe("L5 — run-summary lesson at headless run completion", () => {
  it("runSummaryLesson returns null for a clean run and a row for a failed run", () => {
    const clean = seedProject();
    assert.equal(runSummaryLesson(clean), null, "no failure signals → no L5");

    const failed: Project = {
      ...seedProject(),
      phases: seedProject().phases.map((r) =>
        r.id === 6 ? { ...r, gate: { passed: false, unmet: ["p6-brief-fit"], evidenceHash: "deadbeef", checkedAt: 1 } } : r,
      ),
      logs: [...seedProject().logs, { ts: 1, phase: 6, level: "warn" as const, event: "verify.fail", detail: "failed" }],
    };
    const l5 = runSummaryLesson(failed);
    assert.ok(l5, "failure signals → L5 run-summary");
    assert.match(l5.id, /^lesson-run-summary-[0-9a-f]{8}$/);
    assert.equal(l5.kind, "episodic");
    assert.equal(l5.phase, 12);
    assert.equal(l5.source, "engine");
    assert.ok((l5.tags ?? []).includes("lesson"));
    assert.ok((l5.tags ?? []).includes("run-summary"));
    assert.ok((l5.tags ?? []).includes("L5"));
    assert.match(l5.text, /gate FAIL P6/);
    assert.match(l5.text, /verify FAIL/);
  });

  it("a completed run with gate failures mints the L5 run-summary lesson", async () => {
    await import("./knowledge.ts");
    const done = await drainToComplete(seedProject());
    assert.equal(done.status, "complete");
    const lessons = done.memory.filter((m) => m.id.startsWith("lesson-run-summary-"));
    assert.equal(lessons.length, 1, "exactly one L5 row on run completion");
    assert.ok(done.logs.some((l) => l.event === "lesson.capture"));
  });
});

/** Red-gate every listed phase record (complete + passed:false) on a copy. */
function redGatePhases(project: Project, phaseIds: number[]): Project {
  return {
    ...project,
    phases: project.phases.map((r) =>
      phaseIds.includes(r.id)
        ? {
            ...r,
            status: "complete" as const,
            gate: {
              passed: false,
              unmet: ["p6-brief-fit"],
              evidenceHash: "c0ffee00",
              checkedAt: 1,
            },
          }
        : r,
    ),
  };
}

describe("fixes/144 M4-1 — sealHonesty census + the P12 delivery.complete guard", () => {
  it("sealHonesty reports clean on a project with no failed gates", () => {
    assert.deepEqual(sealHonesty(seedProject()), { clean: true, failed: [] });
  });

  it("sealHonesty reports one red phase id for a failed P6 gate", () => {
    const red = redGatePhases(seedProject(), [6]);
    assert.deepEqual(sealHonesty(red), { clean: false, failed: ["P6"] });
  });

  it("sealHonesty lists every red phase id in phase order", () => {
    const red = redGatePhases(seedProject(), [9, 3]);
    assert.deepEqual(sealHonesty(red), { clean: false, failed: ["P3", "P9"] });
  });

  it("a clean P12 seal keeps the byte-identical legacy delivery.complete line", async () => {
    await import("./knowledge.ts");
    const out = applyPhaseResult(seedProject(), 12);
    const log = out.logs.filter((l) => l.event === "delivery.complete").at(-1);
    assert.ok(log, "delivery.complete log present");
    assert.equal(log!.detail, "All 13 phases sealed.");
    assert.equal(log!.level, "info");
  });

  it("a red-gate P12 seal carries the failed-gate census on delivery.complete (never a bare clean line)", async () => {
    await import("./knowledge.ts");
    const red = redGatePhases(seedProject(), [3]);
    const out = applyPhaseResult(red, 12);
    const log = out.logs.filter((l) => l.event === "delivery.complete").at(-1);
    assert.ok(log, "delivery.complete log present");
    assert.equal(log!.detail, "All 13 phases sealed. 1 failed gates: P3");
    assert.equal(log!.level, "warn");
    assert.ok(
      !out.logs.some((l) => l.event === "delivery.complete" && l.detail === "All 13 phases sealed."),
      "no bare clean delivery line survives over red gates",
    );
  });
});

describe("fixes/144 M5-1 — L2 seal rows carry the unmet criteria verbatim + refusal class", () => {
  it("the P6 failed-seal L2 row text is the evidence digest with the unmet criteria verbatim", async () => {
    await import("./knowledge.ts");
    const parked = runToGate(seedProject(), 6);
    const out = applyPhaseResult(parked, 6);
    const row = out.memory.find((m) => m.id.startsWith("lesson-template-emission-") && m.phase === 6);
    assert.ok(row, "an L2 row must land for the P6 failed seal");
    assert.ok(row.text.startsWith("unmet: "), "row text leads with the unmet marker");
    assert.ok(
      row.text.includes('Machine verification promoted a tested verdict (lastTest.label === "tested" with evidenceHash)'),
      "first unmet criterion appears verbatim",
    );
    assert.ok(row.text.includes("Brief-conformance: required brief nouns appear as identifiers in generated source"),
      "second unmet criterion appears verbatim",
    );
    assert.ok(row.text.length <= 240, "H43-P2-2 budget");
    assert.match(row.id, /^lesson-template-emission-[0-9a-f]{8}$/);
  });

  it("a recorded synthesis refusal stamps the class code + reason into the seal L2 row (deterministic digest)", async () => {
    await import("./knowledge.ts");
    const parked = runToGate(seedProject(), 7); // P7 seals with the short p7-research gate unmet
    const withRefusal: Project = {
      ...parked,
      logs: [
        ...(parked.logs ?? []),
        {
          ts: 7,
          phase: 6 as PhaseId,
          level: "warn" as const,
          event: "p6.synthesis.refused",
          detail: "RT_E_LLM_REJECTED · the pro tier refused to emit an offline warehouse scan module",
        },
      ],
    };
    const out = applyPhaseResult(withRefusal, 7);
    const row = out.memory.find((m) => m.id.startsWith("lesson-template-emission-") && m.phase === 7);
    assert.ok(row, "an L2 row must land for the P7 failed seal");
    assert.equal(
      row.text,
      "unmet: Live research corpus exists for P7 (≥1 fetched finding) · class: RT_E_LLM_REJECTED · tail: the pro tier refused to emit an offline warehouse scan module",
      "digest carries unmet verbatim + refusal class + reason in the shared format",
    );
    assert.ok(row.text.length <= 240, "H43-P2-2 budget");
    // idempotent: re-sealing the same gate never forks the enriched row
    const again = applyPhaseResult(out, 7);
    const rows = (again.memory ?? []).filter((m) => m.id === row.id);
    assert.equal(rows.length, 1, "re-seal is a content-addressed no-op");
  });

  it("the refusal class code survives the 240 budget even behind P6's long verbatim unmet list", async () => {
    await import("./knowledge.ts");
    const parked = runToGate(seedProject(), 6);
    const withRefusal: Project = {
      ...parked,
      logs: [
        ...(parked.logs ?? []),
        {
          ts: 6,
          phase: 6 as PhaseId,
          level: "warn" as const,
          event: "p6.synthesis.refused",
          detail: "RT_E_LLM_REJECTED · the pro tier refused to emit an offline warehouse scan module",
        },
      ],
    };
    const out = applyPhaseResult(withRefusal, 6);
    const row = out.memory.find((m) => m.id.startsWith("lesson-template-emission-") && m.phase === 6);
    assert.ok(row, "an L2 row must land for the P6 failed seal");
    assert.ok(row.text.startsWith("unmet: Machine verification promoted a tested verdict"), "unmet head kept");
    assert.ok(
      row.text.includes("class: RT_E_LLM_REJECTED"),
      "atomic class clause is never mangled by the row budget",
    );
    assert.ok(row.text.length <= 240, "H43-P2-2 budget");
  });
});
