import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NoMoneyException,
  SessionBudgetExceeded,
  assertBudgetHeadroom,
  assertWithinBudget,
  billableInputTokens,
  budgetCap,
  createTokenBudget,
  emptyLedger,
  estimateCostUsd,
  isBudgetExhausted,
  isUnmetered,
  recordBudgetSpend,
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

describe("token-ledger — cache-aware fields (T-107.6, dossier 107 §6c)", () => {
  it("legacy 3-key ledger + legacy spend stay byte-identical (no cache keys appear)", () => {
    const a = recordSpend(emptyLedger(), { promptTokens: 10, completionTokens: 5 });
    assert.deepEqual(a, { promptTokens: 10, completionTokens: 5, calls: 1 });
    assert.deepEqual(Object.keys(a), ["promptTokens", "completionTokens", "calls"]);
    const b = recordSpend(a, { promptTokens: 1, completionTokens: 0 });
    assert.deepEqual(Object.keys(b), ["promptTokens", "completionTokens", "calls"]);
    assert.equal("cachedPromptTokens" in b, false);
  });

  it("cache fields accumulate only when a sample reports them; counts are sticky", () => {
    const l = recordSpend(emptyLedger(), {
      promptTokens: 100,
      completionTokens: 20,
      cachedPromptTokens: 60,
      cacheWriteTokens: 10,
      reasoningTokens: 5,
    });
    assert.deepEqual(l, {
      promptTokens: 100,
      completionTokens: 20,
      calls: 1,
      cachedPromptTokens: 60,
      cacheWriteTokens: 10,
      reasoningTokens: 5,
    });
    // A later sample WITHOUT cache telemetry keeps the accumulated counts.
    const l2 = recordSpend(l, { promptTokens: 5, completionTokens: 1 });
    assert.equal(l2.cachedPromptTokens, 60);
    assert.equal(l2.cacheWriteTokens, 10);
    assert.equal(l2.reasoningTokens, 5);
    assert.equal(totalTokens(l2), 126);
    // A sample reporting ONE cache field introduces only that key.
    const l3 = recordSpend(emptyLedger(), {
      promptTokens: 1,
      completionTokens: 1,
      cachedPromptTokens: 0,
    });
    assert.deepEqual(l3, { promptTokens: 1, completionTokens: 1, calls: 1, cachedPromptTokens: 0 });
    assert.equal("cacheWriteTokens" in l3, false);
    assert.equal("reasoningTokens" in l3, false);
  });

  it("cache fields floor garbage to zero", () => {
    const l = recordSpend(emptyLedger(), {
      promptTokens: 10,
      completionTokens: 1,
      cachedPromptTokens: -4,
      cacheWriteTokens: Number.NaN,
    });
    assert.equal(l.cachedPromptTokens, 0);
    assert.equal(l.cacheWriteTokens, 0);
    assert.equal("reasoningTokens" in l, false);
  });

  it("billableInputTokens: prompt minus cache slices, clamped, never negative", () => {
    assert.equal(billableInputTokens(emptyLedger()), 0);
    assert.equal(billableInputTokens(null), 0);
    assert.equal(billableInputTokens({ promptTokens: 100, completionTokens: 0 }), 100);
    assert.equal(
      billableInputTokens({ promptTokens: 100, completionTokens: 0, cachedPromptTokens: 40 }),
      60,
    );
    assert.equal(
      billableInputTokens({
        promptTokens: 100,
        completionTokens: 0,
        cachedPromptTokens: 40,
        cacheWriteTokens: 25,
      }),
      35,
    );
    assert.equal(
      billableInputTokens({ promptTokens: 50, completionTokens: 0, cachedPromptTokens: 50 }),
      0,
    );
    // Over-reported cache counts clamp to the prompt total — never negative.
    assert.equal(
      billableInputTokens({
        promptTokens: 50,
        completionTokens: 0,
        cachedPromptTokens: 80,
        cacheWriteTokens: 30,
      }),
      0,
    );
  });

  it("estimateCostUsd without cache prices == the plain two-part estimate", () => {
    const prices = { inputPerMillion: 0.28, outputPerMillion: 0.42 };
    const spend = { promptTokens: 1_000_000, completionTokens: 500_000 };
    assert.ok(Math.abs(estimateCostUsd(spend, prices) - (0.28 + 0.21)) < 1e-12);
    // Cache counts priced at the DEFAULT input price → identical to plain math.
    const withCache = {
      promptTokens: 1_000_000,
      completionTokens: 500_000,
      cachedPromptTokens: 400_000,
      cacheWriteTokens: 100_000,
    };
    assert.ok(Math.abs(estimateCostUsd(withCache, prices) - (0.28 + 0.21)) < 1e-12);
  });

  it("estimateCostUsd re-prices cache reads/writes at caller-supplied prices", () => {
    const spend = {
      promptTokens: 1_000_000,
      completionTokens: 0,
      cachedPromptTokens: 400_000,
      cacheWriteTokens: 100_000,
    };
    const prices = {
      inputPerMillion: 1,
      outputPerMillion: 2,
      cachedInputPerMillion: 0.1,
      cacheWritePerMillion: 1.25,
    };
    // full 500k·1 + read 400k·0.1 + write 100k·1.25 = 0.5 + 0.04 + 0.125
    assert.ok(Math.abs(estimateCostUsd(spend, prices) - 0.665) < 1e-12);
  });

  it("estimateCostUsd never throws: missing spend → 0, hostile prices floor to 0", () => {
    assert.equal(estimateCostUsd(null, { inputPerMillion: 1, outputPerMillion: 1 }), 0);
    assert.equal(
      estimateCostUsd(
        { promptTokens: 10, completionTokens: 10 },
        { inputPerMillion: Number.NaN, outputPerMillion: -1 },
      ),
      0,
    );
  });
});

describe("token-ledger — TokenBudget seam (T-107.6)", () => {
  it("createTokenBudget/budgetCap normalize the cap (unmetered/invalid → undefined)", () => {
    assert.equal(createTokenBudget(undefined).cap, undefined);
    assert.equal(createTokenBudget(0).cap, undefined);
    assert.equal(createTokenBudget(Number.NaN).cap, undefined);
    assert.equal(createTokenBudget(-5).cap, undefined);
    assert.equal(createTokenBudget(12.9).cap, 12);
    assert.deepEqual(createTokenBudget(100).ledger, emptyLedger());
    assert.equal(budgetCap(createTokenBudget(100)), 100);
    assert.equal(budgetCap(42), 42);
    assert.equal(budgetCap(null), undefined);
    assert.equal(budgetCap(createTokenBudget(undefined)), undefined);
  });

  it("recordBudgetSpend: crossing throws AFTER recording — spend kept, never clamped", () => {
    const b = createTokenBudget(10);
    recordBudgetSpend(b, { promptTokens: 10, completionTokens: 0 });
    assert.equal(isBudgetExhausted(b), false, "landing exactly on the cap is still ok (199)");
    try {
      recordBudgetSpend(b, { promptTokens: 1, completionTokens: 0 });
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(err instanceof SessionBudgetExceeded);
      assert.equal(err.code, "RT_E_BUDGET_EXHAUSTED");
      assert.equal(err.spent, 11);
      assert.equal(err.cap, 10);
    }
    assert.equal(b.ledger.promptTokens, 11, "crossing spend kept in the caller-owned ledger");
    assert.equal(isBudgetExhausted(b), true);
  });

  it("recordBudgetSpend mutates the caller's ledger in place (stale refs see the spend)", () => {
    const b = createTokenBudget(undefined);
    const ref = b.ledger;
    recordBudgetSpend(b, { promptTokens: 7, completionTokens: 3, cachedPromptTokens: 2 });
    assert.equal(ref, b.ledger, "same ledger object — never replaced");
    assert.deepEqual(ref, {
      promptTokens: 7,
      completionTokens: 3,
      calls: 1,
      cachedPromptTokens: 2,
    });
  });

  it("assertBudgetHeadroom: refuses at/over the cap pre-dispatch; no-op unmetered", () => {
    const b = createTokenBudget(10);
    assert.doesNotThrow(() => assertBudgetHeadroom(b));
    recordBudgetSpend(b, { promptTokens: 9, completionTokens: 0 });
    assert.doesNotThrow(() => assertBudgetHeadroom(b));
    recordBudgetSpend(b, { promptTokens: 1, completionTokens: 0 });
    try {
      assertBudgetHeadroom(b);
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(err instanceof SessionBudgetExceeded);
      assert.equal(err.spent, 10);
      assert.equal(err.cap, 10);
    }
    assert.doesNotThrow(() => assertBudgetHeadroom(createTokenBudget(undefined)));
    assert.doesNotThrow(() => assertBudgetHeadroom(createTokenBudget(0)));
  });

  it("recordBudgetSpend: missing usage is a no-op record (no throw, no calls bump)", () => {
    const b = createTokenBudget(1);
    recordBudgetSpend(b, null);
    recordBudgetSpend(b, undefined);
    assert.deepEqual(b.ledger, emptyLedger());
    assert.equal(b.ledger.calls, 0);
  });

  it("recordBudgetSpend refuses a malformed budget with RT_E_VALIDATION prose", () => {
    try {
      recordBudgetSpend(null as never, { promptTokens: 1, completionTokens: 1 });
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(err instanceof Error);
      assert.match((err as Error).message, /RT_E_VALIDATION/);
    }
  });
});
