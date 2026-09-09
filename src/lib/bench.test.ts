import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  countLooseEquals,
  stripStringsAndComments,
  estimateTokenCost,
  complexityScore,
  failurePointScan,
  projectedTime,
  TOKEN_ESTIMATE_LABEL,
  TIME_ESTIMATE_LABEL,
  COMPLEXITY_ESTIMATE_LABEL,
  FAILURE_POINT_LABEL,
} from "./bench.ts";

describe("estimateTokenCost (chars/4 + per-phase overhead multipliers)", () => {
  it("returns zero tokens and an honest estimate flag for an empty project", () => {
    const r = estimateTokenCost({});
    assert.equal(r.estimate, true);
    assert.equal(r.label, TOKEN_ESTIMATE_LABEL);
    assert.ok(r.label.includes("synthetic dry-run estimate"), "label must be honest");
    assert.equal(r.tokenEstimate, 0);
    assert.equal(r.sourceTokenEstimate, 0);
    assert.equal(r.phaseOverheadTokens, 0);
    assert.equal(r.participatedPhases, 0);
  });

  it("estimates code tokens with ceil(char/4)", () => {
    const r = estimateTokenCost({ generatedSource: "x".repeat(21) });
    assert.equal(r.sourceChars, 21);
    assert.equal(r.sourceTokenEstimate, Math.ceil(21 / 4));
    assert.equal(r.tokenEstimate, 6);
  });

  it("counts brief and artifact bodies in the char pool", () => {
    const r = estimateTokenCost({
      brief: "spec",
      generatedSource: "x".repeat(21),
      artifacts: [{ body: "a".repeat(100) }],
    });
    assert.equal(r.briefChars, 4);
    assert.equal(r.sourceChars, 21);
    assert.equal(r.artifactChars, 100);
    assert.equal(r.totalChars, 125);
    assert.equal(r.artifactCount, 1);
    assert.equal(r.tokenEstimate, Math.ceil(125 / 4));
  });

  it("applies per-phase multipliers to the fixed 250-token phase overhead", () => {
    const r = estimateTokenCost({ phases: [{ id: 0, status: "complete" }] });
    assert.equal(r.participatedPhases, 1);
    assert.equal(r.phaseOverheadTokens, 750); // round(250 × multiplier 3 × weight 1)
    assert.equal(r.perPhase[0]?.tokens, 750);
    assert.equal(r.tokenEstimate, 750);
  });

  it("weights statuses: running = half, rejected = full, locked/ready/unknown = zero", () => {
    const r = estimateTokenCost({
      phases: [
        { id: 6, status: "running" }, // 250 × 2.4 × 0.5 = 300
        { id: 12, status: "rejected" }, // 250 × 1.5 × 1 = 375
        { id: 99, status: "complete" }, // unknown id → default multiplier 1 → 250
        { id: 0, status: "locked" },
        { id: 1, status: "ready" },
        { id: 2, status: "weird" },
      ],
    });
    assert.equal(r.phaseOverheadTokens, 300 + 375 + 250);
    assert.equal(r.participatedPhases, 3);
    assert.deepEqual(
      r.perPhase.map((p) => p.tokens),
      [300, 375, 250],
    );
  });

  it("is deterministic and reports its method", () => {
    const project = {
      brief: "b",
      generatedSource: "exports.f = (x) => x + 1;",
      phases: [
        { id: 0, status: "complete" },
        { id: 6, status: "running" },
      ],
    };
    const a = estimateTokenCost(project);
    const b = estimateTokenCost(project);
    assert.deepEqual(a, b);
    assert.ok(a.method.length > 0);
    assert.equal(a.tokenEstimate, b.tokenEstimate);
  });
});

describe("complexityScore (branch/loop heuristics + artifact weight)", () => {
  it("scores an empty project zero at level low", () => {
    const r = complexityScore({});
    assert.equal(r.estimate, true);
    assert.equal(r.label, COMPLEXITY_ESTIMATE_LABEL);
    assert.equal(r.score, 0);
    assert.equal(r.level, "low");
    assert.deepEqual(r.detail, {
      ifCount: 0,
      loopCount: 0,
      switchCount: 0,
      catchCount: 0,
      ternaryCount: 0,
      logicalOpCount: 0,
      functionCount: 0,
      artifactCount: 0,
    });
  });

  it("charges 2 per if and crosses to medium at score 8 (with artifacts)", () => {
    const twoIfs = "if (a) { run(); }\nif (b) { run(); }";
    const plain = complexityScore({ generatedSource: twoIfs });
    assert.equal(plain.detail.ifCount, 2);
    assert.equal(plain.score, 4);
    assert.equal(plain.level, "low");
    const withArtifacts = complexityScore({ generatedSource: twoIfs, artifacts: [{}, {}] });
    assert.equal(withArtifacts.score, 8); // 4 + 2 × 2 artifacts — boundary
    assert.equal(withArtifacts.level, "medium");
  });

  it("applies the full formula: 2×if + 3×loop + 2×switch + catch + ternary + logical + 2×artifact", () => {
    const src = [
      "function run(x) {",
      "  if (x && ok) { plan(); }",
      "  for (let i = 0; i < x; i++) {",
      "    try { work(i); } catch (e) { note(e); }",
      "  }",
      "  switch (x) { case 1: return flag ? 1 : 0; default: return 0; }",
      "}",
    ].join("\n");
    const r = complexityScore({ generatedSource: src, artifacts: [{ body: "x" }] });
    assert.deepEqual(r.detail, {
      ifCount: 1,
      loopCount: 1,
      switchCount: 1,
      catchCount: 1,
      ternaryCount: 1,
      logicalOpCount: 1,
      functionCount: 1,
      artifactCount: 1,
    });
    assert.equal(r.score, 12); // 2+3+2+1+1+1+2
    assert.equal(r.level, "medium");
  });

  it("records function/arrow count and reaches high at score 20", () => {
    const fns = "function run() { return 1; }\nconst cb = (x) => x;";
    const fr = complexityScore({ generatedSource: fns });
    assert.equal(fr.detail.functionCount, 2);
    const tenIfs = Array.from({ length: 10 }, (_, i) => `if (x${i}) { tick(); }`).join(" ");
    const hr = complexityScore({ generatedSource: tenIfs });
    assert.equal(hr.detail.ifCount, 10);
    assert.equal(hr.score, 20);
    assert.equal(hr.level, "high");
  });
});

describe("failurePointScan (advisory heuristics)", () => {
  it("flags a definition-bearing module that exports nothing", () => {
    const r = failurePointScan({ generatedSource: "function helper() { return 1; }" });
    assert.equal(r.estimate, true);
    assert.equal(r.label, FAILURE_POINT_LABEL);
    assert.equal(r.count, 1);
    assert.equal(r.advisories[0]?.code, "missing-exports");
    assert.equal(r.advisories[0]?.severity, "high");
  });

  it("stays silent for a well-formed exports module and for empty source", () => {
    const good = failurePointScan({ generatedSource: "exports.add = (a, b) => a + b;" });
    assert.equal(good.count, 0);
    assert.deepEqual(good.advisories, []);
    const empty = failurePointScan({});
    assert.equal(empty.count, 0);
  });

  it("counts loose == with line numbers while ignoring === and !== (strings already scrubbed)", () => {
    const r = failurePointScan({
      generatedSource: "if (a == b) { return a == b; }\nflag = c === d;\nif (e !== f) { g(); }",
    });
    const eq = r.advisories.filter((a) => a.code === "eqeqeq");
    assert.equal(eq.length, 1);
    assert.equal(eq[0]?.occurrences, 2);
    assert.equal(eq[0]?.line, 1);
    assert.equal(eq[0]?.severity, "low");
  });

  it("flags functions spanning more than 40 lines with their start line", () => {
    const heavy =
      "function heavy() {\n" + Array.from({ length: 45 }, () => "  work();\n").join("") + "}";
    const r = failurePointScan({ generatedSource: heavy });
    const long = r.advisories.filter((a) => a.code === "long-function");
    assert.equal(long.length, 1);
    assert.equal(long[0]?.severity, "medium");
    assert.equal(long[0]?.line, 1);
    assert.match(long[0]?.message ?? "", /heavy/);
    const tiny = failurePointScan({ generatedSource: "function tiny() {\n  return 1;\n}" });
    assert.equal(tiny.advisories.filter((a) => a.code === "long-function").length, 0);
  });

  it("flags declared-but-never-referenced identifiers as no-unused-decl", () => {
    const r = failurePointScan({
      generatedSource: "const lonely = 41;\nconst kept = 1;\nexports.value = kept;",
    });
    assert.equal(r.count, 1);
    assert.equal(r.advisories[0]?.code, "no-unused-decl");
    assert.equal(r.advisories[0]?.line, 1);
    assert.equal(r.advisories[0]?.severity, "low");
    assert.match(r.advisories[0]?.message ?? "", /lonely/);
  });

  it("is deterministic: same project yields an identical advisory list", () => {
    const project = {
      generatedSource:
        "function run(x) {\n  if (x == 1) { return 2; }\n  return 3;\n}\nconst ghost = 9;",
    };
    const a = failurePointScan(project);
    const b = failurePointScan(project);
    assert.deepEqual(a, b);
    assert.equal(a.count, a.advisories.length);
    for (const adv of a.advisories) {
      assert.ok(["low", "medium", "high"].includes(adv.severity));
      assert.ok(typeof adv.message === "string" && adv.message.length > 0);
    }
  });
});

describe("projectedTime (phase-weighted minutes)", () => {
  it("projects zero minutes for a project with no participated phases", () => {
    const r = projectedTime({});
    assert.equal(r.estimate, true);
    assert.equal(r.label, TIME_ESTIMATE_LABEL);
    assert.ok(r.label.includes("synthetic dry-run estimate"), "label must be honest");
    assert.equal(r.minutes, 0);
    assert.equal(r.participatedPhases, 0);
  });

  it("sums full minutes for complete phases (45 + 20 = 65)", () => {
    const r = projectedTime({
      phases: [
        { id: 0, status: "complete" },
        { id: 12, status: "complete" },
        { id: 4, status: "locked" },
      ],
    });
    assert.equal(r.completedPhases, 2);
    assert.equal(r.participatedPhases, 2);
    assert.equal(r.minutes, 65);
  });

  it("halves in-flight phases and excludes not-started or unknown statuses", () => {
    const r = projectedTime({
      phases: [
        { id: 6, status: "running" }, // 60 × 0.5 = 30
        { id: 8, status: "awaiting_hitl" }, // round(45 × 0.5) = 23
        { id: 0, status: "locked" },
        { id: 1, status: "ready" },
        { id: 2, status: "weird" },
      ],
    });
    assert.equal(r.inFlightPhases, 2);
    assert.equal(r.participatedPhases, 2);
    assert.equal(r.minutes, 53);
  });

  it("treats rejected as work done, defaults unknown ids, and is deterministic", () => {
    const r = projectedTime({
      phases: [
        { id: 9, status: "rejected" }, // full weight → 30
        { id: 99, status: "complete" }, // unknown id → default 30
      ],
    });
    assert.equal(r.completedPhases, 2);
    assert.equal(r.minutes, 60);
    const again = projectedTime({
      phases: [
        { id: 9, status: "rejected" },
        { id: 99, status: "complete" },
      ],
    });
    assert.deepEqual(r, again);
  });
});

describe("shared text primitives", () => {
  it("countLooseEquals excludes ===, !==, <=, >= and =>", () => {
    assert.equal(countLooseEquals("a === b; c !== d; e == f; g <= h; i => j; k == l"), 2);
  });

  it("stripStringsAndComments keeps length/newlines and removes string+comment noise", () => {
    const input = 'const s = "a;b == c"; // console.log(s)\n/* var q == 1\ny */ f();';
    const out = stripStringsAndComments(input);
    assert.equal(out.length, input.length);
    assert.equal((out.match(/\n/g) ?? []).length, 2);
    assert.ok(!out.includes("console"));
    assert.ok(!out.includes("var q"));
    assert.equal(countLooseEquals(out), 0);
    assert.equal(countLooseEquals(stripStringsAndComments("const t = `x == y`;")), 0);
  });
});
