// ---------------------------------------------------------------------------
// W11 · LANE 2 (watchdog) — honesty guard tests. ADDITIVE: no production
// module is modified by this file. Each block pins a non-negotiable invariant
// from RESUME.md §5.4 against the actual behaviour on disk, so every test is
// written to FAIL for its own reason (see the assertion messages; no
// tautologies — scripts/check-assertion-gaps.mjs is a gate).
//
// Pins (evidence in /fixes/217b_watchdog_verification.md):
//   1. T-11 green-seal gate — a RED seal (complete phase + unmet DoD gate)
//      mints NO lesson row; the signal is a `p<N>.seal.unmet` warn log naming
//      the unmet DoD probe ids (engine.ts:1463-1496 as landed by W10-L1).
//   2. T-11 over-gating guard — the green deterministic floor records no
//      seal.unmet log, and the L2 writer still mints from machine evidence.
//   3. T-11 probe tags — a lesson row built from a failureSignature carrying
//      `anchors:` exposes one `probe:<id>` tag per anchor (knowledge.ts:911
//      probeTagsFromSignature); an anchor-less signature exposes none.
//   4. T-107.6 runner output cap — clampRunnerOutput (node-runner.server.ts:91)
//      is a byte-identical no-op at/below the cap and a COUNTED middle-elision
//      above it; the tiny-cap branch counts what it drops.
//   5. T4.1/TA-16 verify-kind — a non-package.json dir is ok:false +
//      RT_E_VALIDATION; a package.json with no `build` script is
//      ok:true, skipped:true (an absent script is never a pass).
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyPhaseResult } from "./engine.ts";
import { runGate } from "./dod.ts";
import { runHeadless, runToGate, seedProject } from "./testing/fixtures.ts";
import { failureSignature, lessonRow, templateEmissionLesson } from "./knowledge.ts";
import { clampRunnerOutput } from "./node-runner.server.ts";
import { verifyKindDir } from "./compile-check.server.ts";

/** Warm the engine's lazy lesson seam (engine.ts:96 `void import("./knowledge.ts")`)
 *  so `applyPhaseResult`'s seal branch (`!needsHitl && lessonSurface`) is live. */
async function warmLessonSeam(): Promise<void> {
  await import("./knowledge.ts");
  await new Promise((resolve) => setTimeout(resolve, 250));
}

describe("W11 L2 honesty guards — T-11 red seal mints no lesson", () => {
  it("a RED seal mints no lesson row and records a p6.seal.unmet warn log naming the unmet probe ids", async () => {
    await warmLessonSeam();
    const parked = runToGate(seedProject(), 6);
    const out = applyPhaseResult(parked, 6);
    // Control: this fixture IS a red seal (complete + unmet DoD + no HITL). If
    // the fixture ever flips green, the test must fail HERE — never pass
    // vacuously by losing the precondition.
    assert.equal(out.phases.find((r) => r.id === 6)?.status, "complete", "P6 must seal complete (red-seal precondition)");
    assert.equal(runGate(out, 6).pass, false, "P6 gate must be UNMET here (red-seal precondition)");
    const before = new Set((parked.memory ?? []).map((m) => m.id));
    const newLessons = (out.memory ?? []).filter(
      (m) => String(m.id).startsWith("lesson-") && !before.has(m.id),
    );
    assert.equal(
      newLessons.length,
      0,
      "a red seal must mint no lesson row — the F-08 contradiction (a lesson whose probe never passed)",
    );
    const seal = (out.logs ?? []).find((l) => l.event === "p6.seal.unmet");
    assert.ok(seal, "the red seal must be recorded as a p6.seal.unmet log row (not a silent fallback)");
    assert.equal(seal.level, "warn");
    assert.equal(seal.phase, 6);
    assert.match(
      String(seal.detail),
      /\[p6-verified, p6-brief-fit\]/,
      "the log must name the unmet DoD probe ids a green seal would have to satisfy",
    );
    assert.ok(
      !(out.logs ?? []).some((l) => l.event === "lesson.capture"),
      "no lesson.capture ledger event may fire on the red-seal path",
    );
  });

  it("green seals 0-5 record no seal.unmet log, mint no lesson row, and the L2 writer still mints (over-gating guard)", async () => {
    await warmLessonSeam();
    const p = runHeadless(seedProject(), [0, 1, 2, 3, 4, 5]);
    for (const phase of [0, 1, 2, 3, 4, 5]) {
      assert.equal(p.phases.find((r) => r.id === phase)?.status, "complete", `phase ${phase} seals complete`);
      assert.equal(runGate(p, phase).pass, true, `phase ${phase} gate is green (green-seal control)`);
    }
    assert.ok(
      !(p.logs ?? []).some((l) => String(l.event).endsWith(".seal.unmet")),
      "a green seal must never record a seal.unmet log",
    );
    assert.equal(
      (p.memory ?? []).filter((m) => String(m.id).startsWith("lesson-")).length,
      0,
      "the deterministic green floor mints no lesson rows",
    );
    // T-11 must not over-gate: the normal L2 writer still mints a row from
    // machine evidence (the surviving headless/report-intake path rides it).
    const row = templateEmissionLesson(p, 6, ["p6-verified", "p6-brief-fit"]);
    assert.match(row.id, /^lesson-template-emission-[0-9a-f]{8}$/, "writer still content-addresses its row");
    assert.ok(
      (row.tags ?? []).includes("lesson") &&
        (row.tags ?? []).includes("template-emission") &&
        (row.tags ?? []).includes("L2"),
      "writer row carries its class tags",
    );
    assert.ok(
      !(p.memory ?? []).some((m) => m.id === row.id),
      "the writer mints ON DEMAND — the green seal path itself added nothing",
    );
  });
});

describe("W11 L2 honesty guards — T-11 probe:<id> tags on lesson rows", () => {
  it("a lesson row built from a signature carrying anchors exposes probe:<id> tags; an anchor-less signature exposes none", () => {
    const spec = {
      classShort: "template-emission",
      level: "L2",
      kind: "episodic",
      phase: 6,
      text: "unmet: sample digest",
      score: 0.7,
      source: "engine",
    } as const;
    const anchored = lessonRow({
      ...spec,
      signature: failureSignature({ kind: "gate-unmet", phase: 6, anchors: ["p6-verified", "p6-brief-fit"] }),
    });
    assert.ok(
      (anchored.tags ?? []).includes("probe:p6-verified") &&
        (anchored.tags ?? []).includes("probe:p6-brief-fit"),
      "an anchored signature must surface every probe id ON the row (T-11 half 2) — see knowledge.ts:911",
    );
    const anchorless = lessonRow({
      ...spec,
      signature: failureSignature({ kind: "gate-unmet", phase: 6, detailTail: "no anchors here" }),
    });
    assert.ok(
      !(anchorless.tags ?? []).some((t) => t.startsWith("probe:")),
      "an anchor-less signature (tail: fallback) must expose NO probe tag",
    );
    // The writer path inherits the tags with no caller change:
    const viaWriter = templateEmissionLesson(seedProject(), 6, ["p6-verified"]);
    assert.ok(
      (viaWriter.tags ?? []).includes("probe:p6-verified"),
      "templateEmissionLesson's row must inherit the probe tag (every writer goes through lessonRow)",
    );
  });
});

describe("W11 L2 honesty guards — T-107.6 runner output cap", () => {
  it("clampRunnerOutput is a byte-identical no-op below the cap and a COUNTED middle-elision above it", () => {
    const under = "hello world";
    const rUnder = clampRunnerOutput(under, 100);
    assert.equal(rUnder.text, under, "at/below the cap the text stays byte-identical");
    assert.equal(rUnder.clamped, false);
    assert.equal(rUnder.elidedChars, 0, "nothing elided below the cap");

    const input = `${"A".repeat(200)}TAIL-END`; // 208 chars
    const r = clampRunnerOutput(input, 200);
    assert.equal(r.clamped, true, "over-cap text is clamped");
    assert.equal(r.originalChars, input.length, "the original size is reported, not the clamped size");
    const marker = r.text.match(/\n… \[(\d+) chars elided by runner output cap\] …\n/);
    assert.ok(marker, "the elision marker must survive intact (marked cut, never a silent one)");
    assert.equal(Number(marker[1]), r.elidedChars, "the marker names exactly the counted elision");
    assert.equal(
      r.originalChars - (r.text.length - marker[0].length),
      r.elidedChars,
      "elidedChars === originalChars − the text kept OUTSIDE the marker (head+tail)",
    );
    assert.ok(r.text.startsWith(input.slice(0, 120)), "the head survives (first 60% of the cap)");
    assert.ok(r.text.endsWith("TAIL-END"), "the tail survives (the final failure lines)");

    // Cap too small for a marked elision (< 64): plain head-cut that still counts.
    const tiny = clampRunnerOutput(input, 40);
    assert.equal(tiny.text.length, 40);
    assert.equal(tiny.clamped, true);
    assert.equal(tiny.elidedChars, tiny.originalChars - tiny.text.length, "even the plain cut counts what it dropped");
  });
});

describe("W11 L2 honesty guards — T4.1/TA-16 verify-kind never fabricates", () => {
  it("a non-package.json dir is ok:false + RT_E_VALIDATION; a no-build tree is ok:true, skipped:true", async () => {
    const noPkg = mkdtempSync(join(tmpdir(), "rt-hg-nopkg-"));
    try {
      const r = await verifyKindDir(noPkg);
      assert.equal(r.ok, false, "a dir that is not an emitted kind tree must never be ok");
      assert.equal(r.code, "RT_E_VALIDATION");
      assert.equal(r.sandbox, false, "verify-kind is honest about its isolation (never a sandbox claim)");
      assert.notEqual(r.skipped, true, "an unreadable subject is a refusal, not an honest skip");
    } finally {
      rmSync(noPkg, { recursive: true, force: true });
    }
    const noBuild = mkdtempSync(join(tmpdir(), "rt-hg-nobuild-"));
    try {
      writeFileSync(
        join(noBuild, "package.json"),
        JSON.stringify({ name: "rt-hg-nobuild", scripts: { test: 'node -e ""' } }),
        "utf8",
      );
      const r = await verifyKindDir(noBuild);
      assert.equal(r.ok, true, "a missing build script is not a failure");
      assert.equal(r.skipped, true, "…but it must be an explicit SKIP — an absent script is never a pass");
      assert.ok(r.code == null, "a skip carries no error code");
      assert.equal(r.sandbox, false);
      assert.match(String(r.detail), /Absent is not a pass/, "the skip detail states the honesty boundary");
    } finally {
      rmSync(noBuild, { recursive: true, force: true });
    }
  });
});
