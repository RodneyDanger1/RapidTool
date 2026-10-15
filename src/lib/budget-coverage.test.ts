// ---------------------------------------------------------------------------
// budget-coverage.test.ts — CF-SE2-3b pins (312 · E2; tail landed by 317 · J3).
//
// Closes the "ledger completeness" gap at the three post-call RECORDER seams:
//   · engine.ts            — fetchResearch narrative (landed E-wave, `:2997`)
//   · headless.ts          — bareNodeLiveOverlay narrative (landed 317 · J3)
//   · wild-mode.server.ts  — wildClassifierReview (landed 317 · J3)
// Contract (I2): EVERY response that reports usage is recorded, success or
// refusal (a refusal that burned tokens still counts); missing usage is a
// no-op; the recorder NEVER throws (these are post-call recorders, not
// dispatch gates — enforcement lives in assertBudgetHeadroom/runBudgetedCall).
// Run: node --experimental-strip-types --test src/lib/budget-coverage.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { emptyProject } from "./engine.ts";
import { createWildClassifier, type WildReviewContext } from "./wild-mode.server.ts";
import type { LlmResult } from "./llm.ts";
import {
  isBudgetExhausted,
  recordSessionSpend,
  resetSessionBudget,
  sessionTokenBudget,
} from "./token-ledger.ts";

const readModule = (file: string): string =>
  readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url)), "utf8");

/** Same fixture idiom as wild-mode.server.test.ts (185-U8): a real
 *  emptyProject + one phase artifact + an unmet-gate shape. */
function reviewCtx(): WildReviewContext {
  const project = emptyProject({
    name: "BudgetPin",
    brief: "A concrete brief for the CF-SE2-3b classifier spend pin.",
  });
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
      evidenceHash: "hash-budget",
    },
  };
}

describe("recordSessionSpend — the in-place, never-throw recorder (CF-SE2-3b)", () => {
  it("accumulates spend in place into the ONE process session ledger (same object) and returns it", () => {
    resetSessionBudget();
    try {
      const budget = sessionTokenBudget();
      const first = recordSessionSpend({ promptTokens: 100, completionTokens: 50 });
      assert.equal(first, budget.ledger, "returns the SAME ledger object (in-place)");
      assert.equal(budget.ledger.promptTokens, 100);
      assert.equal(budget.ledger.completionTokens, 50);
      assert.equal(budget.ledger.calls, 1);
      recordSessionSpend({ promptTokens: 5, completionTokens: 7 });
      assert.equal(sessionTokenBudget(), budget, "the process singleton is the same budget");
      assert.equal(budget.ledger.promptTokens, 105);
      assert.equal(budget.ledger.completionTokens, 57);
      assert.equal(budget.ledger.calls, 2);
    } finally {
      resetSessionBudget();
    }
  });

  it("null / undefined usage is a true no-op — numbers AND calls unchanged, never throws", () => {
    resetSessionBudget();
    try {
      const budget = sessionTokenBudget();
      assert.doesNotThrow(() => recordSessionSpend(null));
      assert.doesNotThrow(() => recordSessionSpend(undefined));
      assert.equal(budget.ledger.promptTokens, 0);
      assert.equal(budget.ledger.completionTokens, 0);
      assert.equal(budget.ledger.calls, 0);
    } finally {
      resetSessionBudget();
    }
  });

  it("hostile numbers floor away instead of escaping; the call still counts", () => {
    resetSessionBudget();
    try {
      const budget = sessionTokenBudget();
      assert.doesNotThrow(() =>
        recordSessionSpend({ promptTokens: -5, completionTokens: Number.NaN }),
      );
      assert.equal(budget.ledger.promptTokens, 0);
      assert.equal(budget.ledger.completionTokens, 0);
      assert.equal(budget.ledger.calls, 1, "a reported (if hostile) call still bumps calls");
    } finally {
      resetSessionBudget();
    }
  });

  it("records PAST a strict cap crossing — the recorder never throws (unlike recordBudgetSpend)", () => {
    const prev = process.env.RAPIDTOOL_TOKEN_CAP;
    process.env.RAPIDTOOL_TOKEN_CAP = "10";
    try {
      resetSessionBudget(); // re-reads env ⇒ cap=10, empty ledger
      assert.doesNotThrow(() => recordSessionSpend({ promptTokens: 8, completionTokens: 0 }));
      assert.doesNotThrow(() => recordSessionSpend({ promptTokens: 8, completionTokens: 0 }));
      const budget = sessionTokenBudget();
      assert.equal(budget.ledger.promptTokens, 16, "spend is kept, never clamped");
      assert.equal(isBudgetExhausted(budget), true, "the crossing is visible to the gate seams");
    } finally {
      if (prev === undefined) delete process.env.RAPIDTOOL_TOKEN_CAP;
      else process.env.RAPIDTOOL_TOKEN_CAP = prev;
      resetSessionBudget();
    }
  });
});

describe("wildClassifierReview — every response that reports usage is metered (I2 contract)", () => {
  const runClassifier = async (
    res: LlmResult,
    opts?: { configured?: boolean; onCall?: () => void },
  ) => {
    const classifier = createWildClassifier(
      async () => {
        opts?.onCall?.();
        return res;
      },
      async () => ({ configured: opts?.configured !== false, models: [] }),
    );
    return classifier.wildClassifierReview(reviewCtx());
  };

  it("a REFUSAL response that burned tokens still lands in the session ledger", async () => {
    resetSessionBudget();
    try {
      const r = await runClassifier({
        ok: false,
        reason: "error",
        error: "stub boom",
        code: "RT_E_INTERNAL",
        usage: { promptTokens: 11, completionTokens: 7 },
      });
      assert.equal(r.ok, false, "the stub refusal surfaces unchanged");
      const ledger = sessionTokenBudget().ledger;
      assert.equal(ledger.promptTokens, 11);
      assert.equal(ledger.completionTokens, 7);
      assert.equal(ledger.calls, 1);
    } finally {
      resetSessionBudget();
    }
  });

  it("an ok response lands its usage too — and the verdict still resolves", async () => {
    resetSessionBudget();
    try {
      const r = await runClassifier({
        ok: true,
        text: "VERDICT: reject\nFEEDBACK: The phase evidence is incomplete and lacks deliverable specifics.",
        model: "stub-model",
        usage: { promptTokens: 13, completionTokens: 5 },
      });
      assert.equal(r.ok, true);
      assert.equal(r.ok === true ? r.verdict : null, "reject");
      const ledger = sessionTokenBudget().ledger;
      assert.equal(ledger.promptTokens, 13);
      assert.equal(ledger.completionTokens, 5);
      assert.equal(ledger.calls, 1);
    } finally {
      resetSessionBudget();
    }
  });

  it("not-configured short-circuits BEFORE the provider call — nothing recorded, no throw", async () => {
    resetSessionBudget();
    try {
      let called = 0;
      const r = await runClassifier(
        { ok: true, text: "VERDICT: approve\nFEEDBACK: never reached", model: "stub" },
        { configured: false, onCall: () => (called += 1) },
      );
      assert.equal(r.ok, false);
      assert.equal(r.ok === false ? r.code : null, "RT_E_LLM_NOT_CONFIGURED");
      assert.equal(called, 0, "no provider call fired");
      assert.equal(sessionTokenBudget().ledger.calls, 0);
    } finally {
      resetSessionBudget();
    }
  });
});

describe("source pins — one metered call site per seam (CF-SE2-3b, 312/317)", () => {
  it("engine.ts — fetchResearch narrative records the completed call", () => {
    const src = readModule("engine.ts");
    // 348 (R3): the narrative call routes through llm-tasks' grounded
    // `phaseNarrative`, which reports `usage` on its success arm; the metered
    // site narrows to that arm (a refusal carries no usage through this seam).
    assert.match(src, /if \(comp && comp\.ok === true && comp\.usage\) recordSessionSpend\(comp\.usage\);/);
    assert.match(src, /import \{[^}]*recordSessionSpend[^}]*\} from "\.\/token-ledger\.ts";/);
  });

  it("headless.ts — bareNodeLiveOverlay narrative records the completed call", () => {
    const src = readModule("headless.ts");
    assert.match(src, /if \(comp && comp\.usage\) recordSessionSpend\(comp\.usage\);/);
    assert.match(src, /import \{[^}]*recordSessionSpend[^}]*\} from "\.\/token-ledger\.ts";/);
  });

  it("wild-mode.server.ts — wildClassifierReview records the completed call", () => {
    const src = readModule("wild-mode.server.ts");
    assert.match(src, /if \(res && res\.usage\) recordSessionSpend\(res\.usage\);/);
    assert.match(src, /import \{[^}]*recordSessionSpend[^}]*\} from "\.\/token-ledger\.ts";/);
  });
});
