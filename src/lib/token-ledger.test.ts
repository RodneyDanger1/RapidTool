import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NoMoneyException,
  SessionBudgetExceeded,
  assertWithinBudget,
  emptyLedger,
  isUnmetered,
  recordSpend,
  recordSpendWithinCap,
  tokenCapFromEnv,
  totalTokens,
  wouldExceed,
} from "./token-ledger.ts";

describe("token-ledger", () => {
  it("empty ledger is zeros", () => {
    assert.deepEqual(emptyLedger(), { promptTokens: 0, completionTokens: 0, calls: 0 });
  });

  it("recordSpend accumulates and counts calls", () => {
    const a = recordSpend(emptyLedger(), { promptTokens: 10, completionTokens: 5 });
    const b = recordSpend(a, { promptTokens: 3, completionTokens: 2 });
    assert.equal(totalTokens(b), 20);
    assert.equal(b.calls, 2);
  });

  it("missing usage is a no-op (does not bump calls)", () => {
    const l = emptyLedger();
    assert.equal(recordSpend(l, null), l);
    assert.equal(recordSpend(l, undefined), l);
  });

  it("no cap never exceeds (unmetered path)", () => {
    const l = recordSpend(emptyLedger(), { promptTokens: 999999, completionTokens: 1 });
    assert.equal(wouldExceed(l, { promptTokens: 1, completionTokens: 0 }, undefined), false);
    assert.equal(wouldExceed(l, { promptTokens: 1, completionTokens: 0 }, 0), false);
    assert.equal(wouldExceed(l, { promptTokens: 1, completionTokens: 0 }, null), false);
    assert.equal(wouldExceed(l, { promptTokens: 1, completionTokens: 0 }, Number.NaN), false);
    assert.doesNotThrow(() => assertWithinBudget(l, undefined));
    assert.doesNotThrow(() => assertWithinBudget(l, 0));
    assert.doesNotThrow(() => recordSpendWithinCap(l, { promptTokens: 1, completionTokens: 0 }, undefined));
    assert.equal(isUnmetered(undefined), true);
    assert.equal(isUnmetered(0), true);
    assert.equal(isUnmetered(-1), true);
    assert.equal(isUnmetered(10), false);
  });

  it("tokenCapFromEnv: unset/blank/0/NaN/negative → undefined (unmetered no-op)", () => {
    assert.equal(tokenCapFromEnv({}), undefined);
    assert.equal(tokenCapFromEnv({ RAPIDTOOL_TOKEN_CAP: undefined }), undefined);
    assert.equal(tokenCapFromEnv({ RAPIDTOOL_TOKEN_CAP: "" }), undefined);
    assert.equal(tokenCapFromEnv({ RAPIDTOOL_TOKEN_CAP: "  " }), undefined);
    assert.equal(tokenCapFromEnv({ RAPIDTOOL_TOKEN_CAP: "0" }), undefined);
    assert.equal(tokenCapFromEnv({ RAPIDTOOL_TOKEN_CAP: "-5" }), undefined);
    assert.equal(tokenCapFromEnv({ RAPIDTOOL_TOKEN_CAP: "NaN" }), undefined);
    assert.equal(tokenCapFromEnv({ RAPIDTOOL_TOKEN_CAP: "abc" }), undefined);
    assert.equal(tokenCapFromEnv({ RAPIDTOOL_TOKEN_CAP: "12.9" }), 12);
    assert.equal(tokenCapFromEnv({ RAPIDTOOL_TOKEN_CAP: "100" }), 100);
  });

  it("wouldExceed is true only after the next spend would pass the cap", () => {
    const l = recordSpend(emptyLedger(), { promptTokens: 8, completionTokens: 0 });
    assert.equal(wouldExceed(l, { promptTokens: 1, completionTokens: 0 }, 10), false);
    assert.equal(wouldExceed(l, { promptTokens: 2, completionTokens: 0 }, 10), false, "land on cap ok");
    assert.equal(wouldExceed(l, { promptTokens: 3, completionTokens: 0 }, 10), true);
  });

  it("recordSpendWithinCap allows landing on cap; throws only past it", () => {
    const a = recordSpendWithinCap(emptyLedger(), { promptTokens: 10, completionTokens: 0 }, 10);
    assert.equal(totalTokens(a), 10);
    assert.equal(a.calls, 1);
    try {
      recordSpendWithinCap(a, { promptTokens: 1, completionTokens: 0 }, 10);
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(err instanceof SessionBudgetExceeded);
      assert.equal(err.code, "RT_E_BUDGET_EXHAUSTED");
      assert.equal(err.spent, 11);
      assert.equal(err.cap, 10);
    }
  });

  it("assertWithinBudget throws SessionBudgetExceeded with RT_E_BUDGET_EXHAUSTED", () => {
    const l = recordSpend(emptyLedger(), { promptTokens: 10, completionTokens: 0 });
    try {
      assertWithinBudget(l, 10);
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(err instanceof SessionBudgetExceeded);
      assert.equal(err.code, "RT_E_BUDGET_EXHAUSTED");
      assert.equal(err.spent, 10);
      assert.equal(err.cap, 10);
    }
  });

  it("NoMoneyException is the competitor-named alias", () => {
    const e = new NoMoneyException(4, 3);
    assert.ok(e instanceof SessionBudgetExceeded);
    assert.equal(e.code, "RT_E_BUDGET_EXHAUSTED");
    assert.equal(e.name, "NoMoneyException");
  });

  it("floors negative token counts to zero", () => {
    const l = recordSpend(emptyLedger(), { promptTokens: -5, completionTokens: 3.9 });
    assert.equal(l.promptTokens, 0);
    assert.equal(l.completionTokens, 3);
  });
});
