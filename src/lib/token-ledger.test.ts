import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NoMoneyException,
  SessionBudgetExceeded,
  accumulateSpend,
  assertBudgetHeadroom,
  assertWithinBudget,
  billableInputTokens,
  budgetCap,
  budgetStopRefusal,
  createTokenBudget,
  emptyLedger,
  estimateCostUsd,
  isBudgetExhausted,
  isBudgetStopRefusal,
  isMeasuredSpend,
  isUnmetered,
  normalizeLedger,
  recordBudgetSpend,
  recordSpend,
  recordSpendWithinCap,
  resetSessionBudget,
  runBudgetedCall,
  spendDelta,
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
    // An object that reports NO numeric token count is unmeasured usage too:
    // it must not read as a metered call (was calls+1 with zero tokens).
    assert.equal(recordSpend(l, {} as never), l);
    assert.equal(recordSpend(l, { promptTokens: "9" } as never), l);
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
    assert.equal(tokenCapFromEnv({ RAPIDTOOL_TOKEN_CAP: "100" }), 100);
    assert.equal(
      tokenCapFromEnv({ RAPIDTOOL_TOKEN_CAP: " 4096 " }),
      4096,
      "surrounding whitespace still yields a plain decimal integer",
    );
  });

  it("M7-08 (310 B3): only a plain decimal integer is a cap — JS-numeric spellings are unmetered", () => {
    // Number() used to accept these: "0x10" → 16, "1e99" → a finite cap that
    // can never trigger while the envelope reports a cap in force, "12.9" → 12.
    // A permissive spelling must mean NO cap (the documented unmetered path),
    // never a silently different cap.
    for (const junk of [
      "0x10",
      "1e99",
      "1e999999",
      "12.9",
      "+5",
      "-0",
      "Infinity",
      "-Infinity",
      "1_000",
      "0b101",
      "0o17",
      ".5",
      "5.",
    ] as const) {
      assert.equal(
        tokenCapFromEnv({ RAPIDTOOL_TOKEN_CAP: junk }),
        undefined,
        `${junk} must be unmetered — never a silently different cap`,
      );
    }
    // The still-valid decimal forms are unchanged.
    assert.equal(tokenCapFromEnv({ RAPIDTOOL_TOKEN_CAP: "100" }), 100);
    assert.equal(tokenCapFromEnv({ RAPIDTOOL_TOKEN_CAP: "0005" }), 5);
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

  it("recordBudgetSpend refuses a malformed budget with RT_E_VALIDATION prose AND a coded error (A1-08)", () => {
    try {
      recordBudgetSpend(null as never, { promptTokens: 1, completionTokens: 1 });
      assert.fail("expected throw");
    } catch (err) {
      assert.ok(err instanceof Error);
      assert.match((err as Error).message, /RT_E_VALIDATION/);
      assert.equal((err as Error & { code?: string }).code, "RT_E_VALIDATION");
    }
  });
});

// ---------------------------------------------------------------------------
// A3 catch wrapper (T-107.6 · D2.3 · 226 A3): a budget stop must yield the
// CODED outcome (RT_E_BUDGET_EXHAUSTED) — never RT_E_INTERNAL
// ---------------------------------------------------------------------------
describe("token-ledger A3 catch wrapper", () => {
  it("budgetStopRefusal translates SessionBudgetExceeded into the coded refusal", () => {
    const refusal = budgetStopRefusal(new SessionBudgetExceeded(10, 5));
    assert.deepEqual(refusal, {
      ok: false,
      reason: "error",
      error:
        "Session token budget exhausted: spent 10 / cap 5 [RT_E_BUDGET_EXHAUSTED] — controlled stop at the session budget cap (spend kept)",
      code: "RT_E_BUDGET_EXHAUSTED",
    });
    assert.ok(refusal && isBudgetStopRefusal(refusal));
    // The alias subclass classifies the same way (NoMoneyException).
    assert.equal(budgetStopRefusal(new NoMoneyException(3, 1))?.code, "RT_E_BUDGET_EXHAUSTED");
    // Any other error keeps its own classification — the caller rethrows it.
    assert.equal(budgetStopRefusal(new Error("boom")), null);
    assert.equal(budgetStopRefusal(null), null);
    assert.equal(budgetStopRefusal("nope"), null);
  });

  it("isBudgetStopRefusal: only the coded envelope narrows true", () => {
    assert.equal(
      isBudgetStopRefusal({
        ok: false,
        reason: "error",
        error: "x",
        code: "RT_E_BUDGET_EXHAUSTED",
      }),
      true,
    );
    assert.equal(isBudgetStopRefusal({ ok: false, reason: "error", code: "RT_E_INTERNAL" }), false);
    assert.equal(isBudgetStopRefusal({ ok: true }), false);
    assert.equal(isBudgetStopRefusal(null), false);
  });

  it("runBudgetedCall refuses BEFORE the wire when the budget is spent to the cap", async () => {
    let calls = 0;
    const budget = { ledger: { promptTokens: 9, completionTokens: 1, calls: 1 }, cap: 10 };
    const res = await runBudgetedCall(budget, async () => {
      calls++;
      return { ok: true as const, usage: { promptTokens: 1, completionTokens: 1 } };
    });
    assert.equal(calls, 0, "no wire call after the pre-dispatch gate refused");
    assert.ok(isBudgetStopRefusal(res));
    assert.equal(res.code, "RT_E_BUDGET_EXHAUSTED");
  });

  it("runBudgetedCall records the measured spend THEN returns the coded refusal on a crossing", async () => {
    const budget = createTokenBudget(50);
    const res = await runBudgetedCall(budget, async () => ({
      ok: true as const,
      usage: { promptTokens: 60, completionTokens: 40 },
    }));
    assert.ok(isBudgetStopRefusal(res));
    assert.equal(res.code, "RT_E_BUDGET_EXHAUSTED");
    // record-then-signal: the spend is KEPT even though the crossing refused.
    assert.deepEqual(budget.ledger, { promptTokens: 60, completionTokens: 40, calls: 1 });
    assert.equal(totalTokens(budget.ledger), 100);
  });

  it("runBudgetedCall keeps the unmetered / no-budget paths a pure pass-through", async () => {
    const unmetered = { ledger: emptyLedger(), cap: undefined };
    const r1 = await runBudgetedCall(unmetered, async () => ({
      ok: true as const,
      usage: { promptTokens: 5, completionTokens: 5 },
    }));
    assert.equal(r1.ok, true);
    // Unmetered still RECORDS measured spend (no cap to cross — D2.3).
    assert.deepEqual(unmetered.ledger, { promptTokens: 5, completionTokens: 5, calls: 1 });
    // No budget at all: no recording, no gate, result identical.
    const result = { ok: true as const, usage: { promptTokens: 7, completionTokens: 7 } };
    const r2 = await runBudgetedCall(undefined, async () => result);
    assert.equal(r2, result);
  });

  it("runBudgetedCall records usage even when the result itself failed (retry spend)", async () => {
    const budget = createTokenBudget(100);
    const failed = {
      ok: false as const,
      reason: "error" as const,
      code: "RT_E_LLM_REJECTED" as const,
      usage: { promptTokens: 7, completionTokens: 0 },
    };
    const res = await runBudgetedCall(budget, async () => failed);
    assert.equal(res, failed, "the failed result passes through unchanged");
    assert.deepEqual(budget.ledger, { promptTokens: 7, completionTokens: 0, calls: 1 });
  });

  it("runBudgetedCall rethrows non-budget errors untouched", async () => {
    await assert.rejects(
      () =>
        runBudgetedCall(createTokenBudget(10), async () => {
          throw new Error("boom");
        }),
      /boom/,
    );
  });
});

describe("W46 · 332-2 (L1/AW45-c06) — persisted run-spend arithmetic", () => {
  it("isMeasuredSpend: the two required counts decide; calls/cache are optional; junk is false", () => {
    assert.equal(isMeasuredSpend({ promptTokens: 60000, completionTokens: 17654 }), true, "legacy 2-key is measured");
    assert.equal(isMeasuredSpend({ promptTokens: 1, completionTokens: 2, calls: 3 }), true);
    assert.equal(isMeasuredSpend({ promptTokens: 0, completionTokens: 0 }), true, "a measured zero is measured");
    for (const junk of [null, undefined, "x", 5, {}, { promptTokens: 1 }, { promptTokens: -1, completionTokens: 1 }, { promptTokens: Number.NaN, completionTokens: 1 }]) {
      assert.equal(isMeasuredSpend(junk), false, `junk ${JSON.stringify(junk)} reads false`);
    }
  });

  it("normalizeLedger: numeric slice → ledger; foreign/null → empty; negatives floor to 0", () => {
    assert.deepEqual(normalizeLedger({ promptTokens: 10, completionTokens: 5 }), {
      promptTokens: 10,
      completionTokens: 5,
      calls: 0,
    });
    assert.deepEqual(normalizeLedger({ promptTokens: 10, completionTokens: 5, calls: 3 }), {
      promptTokens: 10,
      completionTokens: 5,
      calls: 3,
    });
    assert.deepEqual(normalizeLedger(null), emptyLedger());
    assert.deepEqual(normalizeLedger(undefined), emptyLedger());
    assert.deepEqual(normalizeLedger({ promptTokens: -7, completionTokens: 2.9, calls: -1 }), {
      promptTokens: 0,
      completionTokens: 2,
      calls: 0,
    });
  });

  it("normalizeLedger invents no cache keys for a legacy 2-key slice, copies reported ones", () => {
    const legacy = normalizeLedger({ promptTokens: 1, completionTokens: 2 });
    assert.equal("cachedPromptTokens" in legacy, false, "absent cache key stays absent");
    const cached = normalizeLedger({ promptTokens: 1, completionTokens: 2, cachedPromptTokens: 1, reasoningTokens: 0 });
    assert.equal(cached.cachedPromptTokens, 1);
    assert.equal(cached.reasoningTokens, 0, "a reported 0 is kept (reported ≠ absent)");
  });

  it("accumulateSpend sums counts as-is (no +1 per call) and stays additive across runs", () => {
    const prior = { promptTokens: 60000, completionTokens: 17654, calls: 12 };
    const delta = { promptTokens: 300, completionTokens: 146, calls: 1 };
    const total = accumulateSpend(prior, delta);
    assert.deepEqual(total, { promptTokens: 60300, completionTokens: 17800, calls: 13 });
    assert.equal(totalTokens(total), 78100);
  });

  it("accumulateSpend: legacy 2-key persisted slice + reported delta sums both", () => {
    const total = accumulateSpend({ promptTokens: 100, completionTokens: 50 }, { promptTokens: 1, completionTokens: 2, calls: 1 });
    assert.deepEqual(total, { promptTokens: 101, completionTokens: 52, calls: 1 });
  });

  it("accumulateSpend carries a cache field only when either side reports it", () => {
    const withCache = accumulateSpend(
      { promptTokens: 10, completionTokens: 1, cachedPromptTokens: 4 },
      { promptTokens: 1, completionTokens: 1, reasoningTokens: 2, calls: 1 },
    );
    assert.equal(withCache.cachedPromptTokens, 4);
    assert.equal(withCache.reasoningTokens, 2);
    const noCache = accumulateSpend({ promptTokens: 1, completionTokens: 1 }, { promptTokens: 1, completionTokens: 1 });
    assert.equal("cachedPromptTokens" in noCache, false);
    assert.equal("cacheWriteTokens" in noCache, false);
  });

  it("spendDelta measures the invocation delta field-wise and clamps a hostile pair at 0", () => {
    const delta = spendDelta(
      { promptTokens: 500, completionTokens: 46, calls: 2, cachedPromptTokens: 5 },
      { promptTokens: 100, completionTokens: 0, calls: 1, cachedPromptTokens: 5 },
    );
    assert.deepEqual(delta, { promptTokens: 400, completionTokens: 46, calls: 1, cachedPromptTokens: 0 });
    // A baseline larger than current (foreign/hostile) never reads negative.
    assert.deepEqual(spendDelta({ promptTokens: 1, completionTokens: 1, calls: 0 }, { promptTokens: 9, completionTokens: 9, calls: 9 }), {
      promptTokens: 0,
      completionTokens: 0,
      calls: 0,
    });
    assert.deepEqual(spendDelta(undefined, undefined), emptyLedger());
  });

  it("the persisted-spend helpers are pure — they never touch the session budget or its cap", () => {
    const budget = resetSessionBudget();
    try {
      const before = { ...budget.ledger };
      // Counts far past any plausible cap: the helpers must not throw, clamp the
      // session, or mutate it — the cap is the process ledger's business alone.
      accumulateSpend({ promptTokens: 1_000_000, completionTokens: 0 }, { promptTokens: 1, completionTokens: 0 });
      spendDelta({ promptTokens: 1_000_000, completionTokens: 0 }, { promptTokens: 0, completionTokens: 0 });
      assert.deepEqual(budget.ledger, before, "the session ledger is untouched");
    } finally {
      resetSessionBudget();
    }
  });
});
