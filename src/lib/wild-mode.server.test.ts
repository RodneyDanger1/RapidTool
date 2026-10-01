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

// ---------------------------------------------------------------------------
// GAP-1 / BUG-4 (fixes/320_g1b_review_park.md · 319 FINDING-3a): the review
// prompt's artifact budget widened from 320×8 to 1200 per artifact with a
// 6000 total cap — the old slice cut real evidence mid-sentence and the
// reviewer then flagged OUR OWN truncation as a phase defect.
// ---------------------------------------------------------------------------
describe("GAP-1 review-prompt artifact budget 1200/6000 (fixes/320)", () => {
  function art(id: string, title: string, body: string) {
    return { id, phase: 0 as const, title, kind: "docs" as const, body };
  }
  const ctxWith = (artifacts: ReturnType<typeof art>[]) =>
    reviewCtx({
      project: {
        ...emptyProject({ name: "Budget", brief: "A concrete brief for the wild-mode Auto-Review supervisor classifier." }),
        artifacts,
      },
    });

  it("per-artifact slice is 1200: deep evidence reaches the reviewer; the far tail is cut with an ellipsis", () => {
    const body = `${"b".repeat(1100)}DEEP_MARKER_OK${"c".repeat(900)}TAILCUT_MARKER`;
    const prompt = buildWildReviewPrompt(ctxWith([art("a1", "Deep", body)]));
    assert.ok(prompt.includes("DEEP_MARKER_OK"), "chars ~1100-1115 are inside the 1200 budget (the old 320 cut them)");
    assert.ok(prompt.includes(`${body.slice(0, 1200)}…`), "the per-artifact cap is exactly 1200 + ellipsis");
    assert.ok(!prompt.includes("TAILCUT_MARKER"), "the far tail beyond 1200 is cut");
  });

  it("total artifact budget is 6000: the tail artifact is dropped with an explicit ellipsis", () => {
    const artifacts = Array.from({ length: 6 }, (_, i) => art(`a${i}`, `TITLE${i + 1}`, `${"A".repeat(1200)}TAIL${i + 1}`));
    const prompt = buildWildReviewPrompt(ctxWith(artifacts));
    const section = prompt.split("Phase artifacts:\n")[1].split("\n\nLast module test:")[0];
    assert.equal(section.length, 6001, "6000 chars + the terminal ellipsis");
    assert.ok(section.endsWith("…"), "an explicit cut marker explains the truncation");
    assert.ok(section.includes("### TITLE1"), "the head of the section is present");
    assert.ok(!section.includes("### TITLE6"), "the tail artifact beyond the total cap is dropped");
  });
});

// ---------------------------------------------------------------------------
// F-5 (W44 · 323 FIX-1) — silent reply truncation: a reply that consumed the
// full 320-token completion cap is stamped with ONE explicit marker (the
// 321·D1 note ended mid-sentence at ~1467 chars); a reply below the cap, or
// one whose usage was never reported, stays byte-identical. The marker never
// rescues a reply that failed an honesty check.
// ---------------------------------------------------------------------------
describe("F-5 classifier reply truncation marker (fixes/323)", () => {
  // Byte-pinned literal (deliberately NOT imported from the module — a silent
  // marker-text change must fail this pin).
  const MARKER = "… [reply consumed the full 320-token completion cap — the tail may be cut]";
  const REJECT_TEXT =
    "VERDICT: reject\nFEEDBACK: The artifacts describe a different system than the brief, cite no measurable acceptance criteria, and the gate evidence does not match the recorded run — redo the phase.";
  const configured = async () => ({ configured: true, models: ["deepseek-v4-flash"] });

  it("a reply that consumed the full 320-token cap carries ONE explicit marker (request cap pinned at 320)", async () => {
    const caps: Array<number | undefined> = [];
    const { wildClassifierReview } = createWildClassifier(
      async (_prompt, opts) => {
        caps.push(opts?.maxTokens);
        return {
          ok: true,
          text: REJECT_TEXT,
          model: "deepseek-v4-flash",
          usage: { promptTokens: 900, completionTokens: 320 },
        };
      },
      configured,
    );
    const res = await wildClassifierReview(reviewCtx());
    assert.equal(caps[0], 320, "the classifier call still asks for the 320-token completion cap (pinned byte)");
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.ok(res.feedback.includes("redo the phase"), "the model feedback is preserved verbatim");
      assert.ok(res.feedback.endsWith(MARKER), "the marker is the last line of the feedback");
      assert.equal(
        res.feedback.split("… [reply consumed").length - 1,
        1,
        "exactly ONE marker — never stacked",
      );
    }
  });

  it("a reply below the cap stays byte-identical (no false positive)", async () => {
    const bare = parseWildReview(REJECT_TEXT);
    assert.ok(bare, "the fixture text parses (control)");
    const { wildClassifierReview } = createWildClassifier(
      async () => ({
        ok: true,
        text: REJECT_TEXT,
        model: "deepseek-v4-flash",
        usage: { promptTokens: 900, completionTokens: 319 },
      }),
      configured,
    );
    const res = await wildClassifierReview(reviewCtx());
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.feedback, bare.feedback, "319 < 320: the parsed feedback verbatim, no marker");
      assert.ok(!res.feedback.includes("completion cap"), "no marker anywhere");
    }
  });

  it("usage absent ⇒ no marker (nothing was reported — never a guessed stamp)", async () => {
    const bare = parseWildReview(REJECT_TEXT);
    assert.ok(bare, "the fixture text parses (control)");
    const { wildClassifierReview } = createWildClassifier(
      async () => ({ ok: true, text: REJECT_TEXT, model: "deepseek-v4-flash" }),
      configured,
    );
    const res = await wildClassifierReview(reviewCtx());
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.feedback, bare.feedback, "no usage report ⇒ no claim — byte-identical feedback");
    }
  });

  it("a capped reply never rescues a too-short or vacuous reply (checks precede the marker)", async () => {
    const short = createWildClassifier(
      async () => ({
        ok: true,
        text: "VERDICT: reject\nFEEDBACK: too short",
        model: "deepseek-v4-flash",
        usage: { promptTokens: 100, completionTokens: 320 },
      }),
      configured,
    );
    const shortRes = await short.wildClassifierReview(reviewCtx());
    assert.equal(shortRes.ok, false);
    if (!shortRes.ok) {
      // parseWildReview drops sub-WILD_FEEDBACK_MIN feedback (:191), so the
      // honest outcome is the unparseable-payload error — never a verdict,
      // and never a marker.
      assert.equal(shortRes.code, "RT_E_INTERNAL");
      assert.match(shortRes.error ?? "", /unparseable verdict payload/);
    }
    const vacuous = createWildClassifier(
      async () => ({
        ok: true,
        text: "VERDICT: approve\nFEEDBACK: looks good, approve",
        model: "deepseek-v4-flash",
        usage: { promptTokens: 100, completionTokens: 320 },
      }),
      configured,
    );
    const vacuousRes = await vacuous.wildClassifierReview(reviewCtx());
    assert.equal(vacuousRes.ok, false);
    if (!vacuousRes.ok) {
      assert.equal(vacuousRes.code, "RT_E_VALIDATION");
      assert.match(vacuousRes.error ?? "", /vacuous/);
    }
  });
});
