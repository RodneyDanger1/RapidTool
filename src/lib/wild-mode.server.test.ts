// ---------------------------------------------------------------------------
// wild-mode.server.test.ts — 185-U8 blinded Auto-Review prompt (fixes/189).
// Run: node --experimental-strip-types --test src/lib/wild-mode.server.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { emptyProject } from "./engine.ts";
import {
  buildWildReviewPrompt,
  parseWildReview,
  isVacuousFeedback,
  createWildClassifier,
  type WildReviewContext,
} from "./wild-mode.server.ts";

function reviewCtx(overrides?: Partial<WildReviewContext>): WildReviewContext {
  const project = emptyProject({
    name: "BlindJudge",
    brief: "A concrete brief for the wild-mode Auto-Review supervisor classifier.",
  });
  project.lastTest = { ok: false, detail: "module asserted equality failed" };
  project.artifacts = [
    {
      id: "a1",
      phase: 0,
      title: "Reframe note",
      kind: "docs",
      body: "Stakeholders want a governed intake with honest gates.",
    },
  ];
  return {
    project,
    phase: 0,
    reason: "advance",
    gate: {
      pass: false,
      unmet: [{ id: "p0-brief", criterion: "brief names a concrete user and outcome" }],
      evidenceHash: "hash-demo",
    },
    ...overrides,
  };
}

describe("buildWildReviewPrompt — 185-U8 blinded Auto-Review", () => {
  it("does NOT inject Machine-checkable DoD verdict PASS/FAIL (blinded judge)", () => {
    const prompt = buildWildReviewPrompt(reviewCtx());
    // Exact machine-verdict line must be gone — the judge is not pre-chewed.
    assert.equal(
      prompt.includes("Machine-checkable DoD verdict"),
      false,
      "pre-chewed DoD machine verdict line must not appear",
    );
    // Unmet criteria stay as evidence (ids + criterion text), not a verdict token.
    assert.match(prompt, /Unmet DoD criteria/);
    assert.match(prompt, /p0-brief/);
    assert.match(prompt, /brief names a concrete user and outcome/);
  });

  it("may still report lastTest as a fact (PASS/FAIL ok there — not a DoD machine verdict)", () => {
    const prompt = buildWildReviewPrompt(reviewCtx());
    assert.match(prompt, /Last module test: FAIL/);
    // Gate pass=true must still not mint the deleted machine-verdict line.
    const passCtx = reviewCtx({
      gate: { pass: true, unmet: [], evidenceHash: "x" },
    });
    const passPrompt = buildWildReviewPrompt(passCtx);
    assert.equal(passPrompt.includes("Machine-checkable DoD verdict"), false);
    assert.match(passPrompt, /Unmet DoD criteria/);
    assert.match(passPrompt, /\(all criteria met\)/);

    const passTest = reviewCtx();
    passTest.project.lastTest = { ok: true, detail: "2/2 module tests passed" };
    const passTestPrompt = buildWildReviewPrompt(passTest);
    assert.match(passTestPrompt, /Last module test: PASS/);
    assert.equal(passTestPrompt.includes("Machine-checkable DoD verdict"), false);
  });

  it("surfaces phase artifacts and brief without fabricating LLM content", () => {
    const prompt = buildWildReviewPrompt(reviewCtx());
    assert.match(prompt, /Reframe note/);
    assert.match(prompt, /BlindJudge/);
    assert.match(prompt, /governed intake/);
  });
});

describe("parseWildReview / isVacuousFeedback smoke", () => {
  it("parses a real verdict + long feedback", () => {
    const parsed = parseWildReview(
      "VERDICT: reject\nFEEDBACK: The reframe note never names a user persona or measurable outcome, so the phase deliverable is incomplete and risky to advance.",
    );
    assert.ok(parsed);
    assert.equal(parsed!.verdict, "reject");
    assert.ok(parsed!.feedback.length >= 12);
  });

  it("flags vacuous approve feedback", () => {
    assert.equal(isVacuousFeedback("looks good, approve"), true);
    assert.equal(isVacuousFeedback("all good"), true);
    assert.equal(isVacuousFeedback("ok fine"), true);
  });

  it("does not flag feedback that cites a shown artifact title", () => {
    assert.equal(
      isVacuousFeedback(
        "The Reframe note names a concrete intake and the unmet p0-brief criterion is addressed by the body.",
        ["Reframe note"],
      ),
      false,
    );
  });
});

describe("createWildClassifier honesty (dual-channel + vacuous + keyless)", () => {
  it("returns not-configured with code when the status probe is unconfigured", async () => {
    const { wildClassifierReview } = createWildClassifier(
      async () => ({ ok: true, text: "should not run", model: "x" }),
      async () => ({ configured: false, models: [] }),
    );
    const res = await wildClassifierReview(reviewCtx());
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.reason, "not-configured");
      assert.equal(res.code, "RT_E_LLM_NOT_CONFIGURED");
    }
  });

  it("ok:true reviews never carry an error channel", async () => {
    const { wildClassifierReview } = createWildClassifier(
      async () => ({
        ok: true,
        text: "VERDICT: reject\nFEEDBACK: The Reframe note never names a user persona or measurable outcome, so advancing this phase is incomplete and risky.",
        model: "deepseek-v4-flash",
      }),
      async () => ({ configured: true, models: ["deepseek-v4-flash"] }),
    );
    const res = await wildClassifierReview(reviewCtx());
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.verdict, "reject");
      assert.equal("error" in res, false, "ok:true must not carry an error channel");
    }
  });

  it("185-H1: hostile dual-channel ok:true+error fail-closes (never a verdict)", async () => {
    const { wildClassifierReview } = createWildClassifier(
      async () =>
        ({
          ok: true,
          text: "VERDICT: approve\nFEEDBACK: The brief names a persona and a measurable outcome with concrete artifacts present.",
          model: "deepseek-v4-flash",
          error: "already complete",
        }) as { ok: true; text: string; model: string },
      async () => ({ configured: true, models: ["deepseek-v4-flash"] }),
    );
    const res = await wildClassifierReview(reviewCtx());
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.reason, "error");
      assert.equal(res.code, "RT_E_INTERNAL");
      assert.match(res.error ?? "", /dual-channel/);
      assert.match(res.error ?? "", /already complete/);
    }
  });

  it("vacuous approve is ok:false + RT_E_VALIDATION, never a rubber-stamp", async () => {
    const { wildClassifierReview } = createWildClassifier(
      async () => ({
        ok: true,
        text: "VERDICT: approve\nFEEDBACK: looks good, approve",
        model: "deepseek-v4-flash",
      }),
      async () => ({ configured: true, models: ["deepseek-v4-flash"] }),
    );
    const res = await wildClassifierReview(reviewCtx());
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.equal(res.reason, "error");
      assert.equal(res.code, "RT_E_VALIDATION");
      assert.match(res.error ?? "", /vacuous/);
    }
  });
});
