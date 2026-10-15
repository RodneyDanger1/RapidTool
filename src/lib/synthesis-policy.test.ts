// ---------------------------------------------------------------------------
// synthesis-policy.test.ts — the best-of-N synthesis policy (fixes/343-1):
// count resolution (default 1 = legacy, hard cap 4) and the lazy deterministic
// selection control flow. No model, no compiler — pure policy.
//
// Run: node --experimental-strip-types --test src/lib/synthesis-policy.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  adaptiveChunkSize,
  candidatesLogDetail,
  estimatedChunkOutputChars,
  estimatedFunctionOutputChars,
  outputBoundedChunkSize,
  planningChunkSize,
  P6_SYNTH_CANDIDATES_DEFAULT,
  P6_SYNTH_CANDIDATES_MAX,
  P6_SYNTH_CHUNK_MAX,
  P6_SYNTH_CHUNK_MIN,
  P6_SYNTH_CHUNK_RETRY_CANDIDATES,
  P6_SYNTH_FN_OUTPUT_BASE,
  P6_SYNTH_FN_OUTPUT_PER_SIG_CHAR,
  P6_SYNTH_MODULE_BUDGET,
  P6_SYNTH_OUTPUT_BUDGET_CHARS,
  resolveChunkResampleCandidates,
  resolveSynthesisCandidates,
  selectBestOfN,
} from "./synthesis-policy.ts";

describe("fixes/343-1 resolveSynthesisCandidates (default 1 = byte-identical legacy)", () => {
  it("absent / non-positive / non-integer inputs fall back to the single-sample default", () => {
    assert.equal(P6_SYNTH_CANDIDATES_DEFAULT, 1, "the default IS today's single sample");
    for (const bad of [undefined, null, "", "abc", "0", "2.5", 0, -3, Number.NaN, {} as unknown]) {
      assert.equal(resolveSynthesisCandidates(bad, undefined), 1, `hostile input ${JSON.stringify(bad)} → 1`);
    }
  });

  it("respects explicit and env values and hard-caps at P6_SYNTH_CANDIDATES_MAX", () => {
    assert.equal(P6_SYNTH_CANDIDATES_MAX, 4, "the documented cost bound");
    assert.equal(resolveSynthesisCandidates(3), 3);
    assert.equal(resolveSynthesisCandidates(undefined, "2"), 2);
    assert.equal(resolveSynthesisCandidates(undefined, " 4 "), 4, "env is trimmed");
    assert.equal(resolveSynthesisCandidates(9), 4, "clamped to the cap");
    assert.equal(resolveSynthesisCandidates(undefined, "99"), 4, "env clamped too");
  });

  it("an explicit option wins over the env var", () => {
    assert.equal(resolveSynthesisCandidates(2, "4"), 2, "deps.candidates is authoritative");
    assert.equal(resolveSynthesisCandidates(1, "4"), 1, "an explicit 1 disables best-of-N under an env of 4");
  });
});

describe("fixes/346-S4 resolveChunkResampleCandidates (ARMED default 3, opt-out 1)", () => {
  it("absent input arms the chunk resample by default; the primary default stays 1", () => {
    assert.equal(P6_SYNTH_CHUNK_RETRY_CANDIDATES, 3, "the armed chunk-level default (S5: raised 2→3 for reliability)");
    assert.equal(resolveChunkResampleCandidates(undefined, undefined), 3, "no option + no env ⇒ ARMED");
    assert.equal(resolveChunkResampleCandidates(undefined, null), 3);
  });

  it("an explicit 1 (option or env) is the opt-out to the byte-identical legacy single sample", () => {
    assert.equal(resolveChunkResampleCandidates(1, undefined), 1, "deps.candidates:1 opts out");
    assert.equal(resolveChunkResampleCandidates(undefined, "1"), 1, "P6_SYNTH_CANDIDATES=1 opts out");
    assert.equal(resolveChunkResampleCandidates(1, "3"), 1, "explicit 1 wins over an env of 3");
  });

  it("respects explicit/env values, hard-caps at the max, and a hostile env stays armed", () => {
    assert.equal(resolveChunkResampleCandidates(undefined, "2"), 2);
    assert.equal(resolveChunkResampleCandidates(undefined, " 3 "), 3, "env is trimmed");
    assert.equal(resolveChunkResampleCandidates(3, "4"), 3, "deps.candidates wins");
    assert.equal(resolveChunkResampleCandidates(9), P6_SYNTH_CANDIDATES_MAX, "clamped to the cap");
    for (const bad of ["", "abc", "2.5", "0", "-3", Number.NaN, {} as unknown]) {
      assert.equal(resolveChunkResampleCandidates(bad, undefined), 3, `hostile ${JSON.stringify(bad)} ⇒ armed default`);
    }
  });
});

describe("fixes/343-1 selectBestOfN (lazy, deterministic)", () => {
  it("count 1 produces exactly one candidate and stops — the legacy single sample", async () => {
    let produced = 0;
    const res = await selectBestOfN(
      1,
      async (i) => {
        produced += 1;
        return `c${i}`;
      },
      async () => ({ passed: false, reason: "n/a" }),
    );
    assert.equal(produced, 1, "no extra sample for the default");
    assert.equal(res.winner, null);
    assert.equal(res.chosen, null);
  });

  it("stops at the FIRST passing candidate (no later sample is produced)", async () => {
    const order: string[] = [];
    const res = await selectBestOfN(
      4,
      async (i) => {
        order.push(`produce:${i}`);
        return i;
      },
      async (c) => {
        order.push(`judge:${c}`);
        return c === 1 ? { passed: true, reason: "clears every gate" } : { passed: false, reason: `gate rejected ${c}` };
      },
    );
    assert.equal(res.winner, 1);
    assert.equal(res.chosen, 1);
    assert.deepEqual(order, ["produce:0", "judge:0", "produce:1", "judge:1"], "candidate 3 is never sampled");
    assert.match(res.outcomes[0]!, /candidate 1: rejected/);
    assert.match(res.outcomes[1]!, /candidate 2: selected/);
  });

  // fixes/348: opt-in quality-directed ranking — among PASSING candidates the
  // highest brief-vocabulary coverage wins; the rank never overrides a gate.
  it("ranked: among passing candidates the highest coverage wins (tie → earliest)", async () => {
    const res = await selectBestOfN<number>(
      4,
      async (i) => i,
      async (c) => ({ passed: true, reason: `clears gates ${c}` }),
      { rank: (c) => (c === 2 ? 0.9 : 0.5), rankTarget: 1 },
    );
    assert.equal(res.winner, 2, "the 0.90-coverage candidate beats the 0.50 ones");
    assert.equal(res.chosen, 2);
    assert.match(res.outcomes[2]!, /^candidate 3: selected — clears gates 2 \(brief coverage 0\.90\)$/);
    assert.match(res.outcomes[0]!, /candidate 1: passed, not selected/);
    assert.match(res.outcomes[3]!, /candidate 4: passed, not selected/);
  });

  it("ranked: a passing candidate already at rankTarget stops the search (Pareto)", async () => {
    let produced = 0;
    const res = await selectBestOfN<number>(
      4,
      async (i) => {
        produced += 1;
        return i;
      },
      async () => ({ passed: true, reason: "clears gates" }),
      { rank: (c) => (c === 1 ? 1 : 0.2), rankTarget: 1 },
    );
    assert.equal(produced, 2, "candidate 2 already reaches the target — no later sample is bought");
    assert.equal(res.winner, 1);
  });

  it("ranked: a failing candidate's high rank never overrides the gate", async () => {
    const res = await selectBestOfN<number>(
      3,
      async (i) => i,
      async (c) => (c === 0 ? { passed: true, reason: "valid" } : { passed: false, reason: "invalid" }),
      { rank: (c) => (c === 0 ? 0.3 : 0.99), rankTarget: 1 },
    );
    assert.equal(res.winner, 0, "the only gate-passing candidate wins despite a lower rank");
    assert.match(res.outcomes[1]!, /candidate 2: rejected/);
  });

  it("ranked: no passing candidate ⇒ winner null even when ranks are present", async () => {
    const res = await selectBestOfN<number>(
      3,
      async (i) => i,
      async () => ({ passed: false, reason: "invalid" }),
      { rank: () => 1, rankTarget: 1 },
    );
    assert.equal(res.winner, null);
    assert.equal(res.chosen, null);
  });

  it("a null sample is a lost candidate, never a crash; writer stops when none passes", async () => {
    const res = await selectBestOfN(
      3,
      async (i) => (i === 0 ? "ok" : null),
      async () => ({ passed: false, reason: "rejected" }),
    );
    assert.equal(res.winner, null);
    assert.deepEqual(res.outcomes, ["candidate 1: rejected — rejected", "candidate 2: not produced", "candidate 3: not produced"]);
  });

  it("clamps a huge count to the policy cap", async () => {
    let produced = 0;
    await selectBestOfN(
      99,
      async () => {
        produced += 1;
        return "x";
      },
      async () => ({ passed: false, reason: "no" }),
    );
    assert.equal(produced, P6_SYNTH_CANDIDATES_MAX, "never samples past the hard cap");
  });

  it("candidatesLogDetail names the unit, the count, the winner, and each verdict", () => {
    const one = candidatesLogDetail("chunk 1/2", 4, 1, ["candidate 1: rejected — tsc refused", "candidate 2: selected — pre-seal typecheck"]);
    assert.match(one, /^chunk 1\/2 · candidates 4 · winner 2 · candidate 1: rejected/);
    const none = candidatesLogDetail("single-module", 2, null, ["candidate 1: rejected — brief-fit missing board"]);
    assert.match(none, /winner none/);
  });

  it("V5/I-A: an optional resample token delta rides the row as a trailing ` · tokens <int>`", () => {
    const outcomes = ["candidate 1: rejected — tsc refused", "candidate 2: selected — pre-seal typecheck"];
    const withTokens = candidatesLogDetail("chunk 1/3", 3, 1, outcomes, 1234);
    assert.ok(withTokens.endsWith(" · tokens 1234"), "the token delta is the trailing segment");
    assert.equal(
      withTokens,
      candidatesLogDetail("chunk 1/3", 3, 1, outcomes) + " · tokens 1234",
      "appending the measured delta never rewrites the legacy head/outcomes bytes",
    );
    const legacy = candidatesLogDetail("chunk 1/3", 3, 1, outcomes);
    assert.ok(!legacy.includes(" · tokens "), "absent delta ⇒ no token suffix (byte-identical legacy row)");
    // A hostile / non-finite / negative delta never fabricates a token segment.
    for (const bad of [undefined, Number.NaN, Number.POSITIVE_INFINITY, -1] as (number | undefined)[]) {
      assert.ok(!candidatesLogDetail("u", 1, 0, [], bad).includes(" · tokens "), `hostile ${String(bad)} ⇒ no suffix`);
    }
    assert.equal(candidatesLogDetail("u", 1, null, [], 0), "u · candidates 1 · winner none ·  · tokens 0", "a measured 0 is recorded");
    // The 1000-char bound reserves the suffix: a huge outcome tail can never
    // truncate the token segment the acceptance consumer parses.
    const long = candidatesLogDetail("u", 4, null, [`candidate 1: rejected — ${"x".repeat(2000)}`], 42);
    assert.ok(long.endsWith(" · tokens 42"), "the reserved suffix survives the char cap");
    assert.ok(long.length <= 1000, "the row stays bounded");
  });
});

describe("A9/PR-15 adaptiveChunkSize (clamp(floor(budget/avgSigChars), 2, 12))", () => {
  it("clamps into [2,12]; empty/no-signature input keeps the legacy default 8", () => {
    // fixes/349-P6: the floor was lowered 4→2 so a self-contained,
    // import-forbidden chunk is asked to export a count it can actually reach.
    assert.equal(P6_SYNTH_CHUNK_MIN, 2);
    assert.equal(P6_SYNTH_CHUNK_MAX, 12);
    assert.equal(adaptiveChunkSize([]), 8, "no signatures ⇒ legacy default");
    assert.equal(adaptiveChunkSize(["   ", ""], P6_SYNTH_MODULE_BUDGET), 8, "blank rows are not signatures");
    assert.equal(adaptiveChunkSize(["x".repeat(60)]), 8, "budget 480 / 60 chars = 8 (legacy parity)");
    assert.equal(adaptiveChunkSize(["x".repeat(120)]), 4, "480 / 120 = 4, still above the lowered floor");
    assert.equal(adaptiveChunkSize(["x".repeat(300)]), 2, "480 / 300 = 1 → clamped up to the lowered floor 2");
    assert.equal(adaptiveChunkSize(["x".repeat(40)]), 12, "short signatures grow a chunk to the ceiling");
  });

  it("a non-positive / non-finite budget falls back to the default budget; hostile input never throws", () => {
    assert.equal(adaptiveChunkSize(["x".repeat(100)], 0), adaptiveChunkSize(["x".repeat(100)]));
    assert.equal(adaptiveChunkSize(["x".repeat(100)], Number.NaN), adaptiveChunkSize(["x".repeat(100)]));
    assert.equal(adaptiveChunkSize(null as unknown as string[], undefined), 8);
    assert.equal(adaptiveChunkSize(["ok"], 1_000_000), P6_SYNTH_CHUNK_MAX);
  });
});

describe("fixes/349-P6 planningChunkSize (bound work by ESTIMATED output, not a fixed count)", () => {
  it("estimates one function's output as a body baseline + a signature-length term", () => {
    assert.equal(estimatedFunctionOutputChars(""), P6_SYNTH_FN_OUTPUT_BASE);
    assert.equal(estimatedFunctionOutputChars("abcd"), P6_SYNTH_FN_OUTPUT_BASE + 4 * P6_SYNTH_FN_OUTPUT_PER_SIG_CHAR);
    assert.equal(estimatedChunkOutputChars(["abcd", "efgh"]), 2 * (P6_SYNTH_FN_OUTPUT_BASE + 4 * P6_SYNTH_FN_OUTPUT_PER_SIG_CHAR));
    assert.equal(estimatedChunkOutputChars(["  ", ""]), 0, "blank rows cost nothing");
    assert.equal(estimatedChunkOutputChars(null as unknown as string[]), 0, "hostile input ⇒ 0, never a throw");
  });

  it("outputBoundedChunkSize caps a chunk whose estimated output exceeds the budget", () => {
    // 55-char signature ⇒ est 900 + 220 = 1120 chars; the 9 600-char budget fits 8.
    const sig = "export function collectRent0(payment: Payment): Receipt";
    const eight = Array.from({ length: 20 }, () => sig);
    assert.equal(outputBoundedChunkSize(eight), 8, "eight functions ≈ 8 960 chars fit; nine would not");
    assert.equal(outputBoundedChunkSize([]), 8, "no signatures ⇒ legacy default");
    // A tiny budget forces the lowered floor (2), never below.
    assert.equal(outputBoundedChunkSize(eight, 100), P6_SYNTH_CHUNK_MIN, "clamped to the floor");
    assert.equal(outputBoundedChunkSize(eight, 1_000_000), P6_SYNTH_CHUNK_MAX, "clamped to the ceiling");
    assert.equal(outputBoundedChunkSize(eight, Number.NaN), 8, "hostile budget ⇒ default budget");
    assert.equal(P6_SYNTH_OUTPUT_BUDGET_CHARS, 9_600);
  });

  it("planningChunkSize is the TIGHTER of the text-adaptive and estimated-output sizes", () => {
    const short = Array.from({ length: 20 }, () => "x".repeat(40));
    // text-adaptive = 12; estimated output (1 060 each) = 9 → the output bound wins.
    assert.equal(adaptiveChunkSize(short), 12);
    assert.equal(outputBoundedChunkSize(short), 9);
    assert.equal(planningChunkSize(short), 9, "output bound is tighter");
    const typical = Array.from({ length: 20 }, () => "export function collectRent0(payment: Payment): Receipt");
    assert.equal(planningChunkSize(typical), 8, "typical corpus signatures keep the legacy chunk size");
    assert.equal(planningChunkSize([]), 8);
    assert.equal(planningChunkSize(short), planningChunkSize(short), "deterministic");
  });
});

describe("fixes/354 selector determinism (same inputs ⇒ same chosen candidate)", () => {
  const runSelector = async () => {
    const judge = async (c: number) => (c === 2 ? { passed: true, reason: "clears gates" } : { passed: false, reason: `gate rejected ${c}` });
    const res = await selectBestOfN<number>(4, async (i) => i, judge, { rank: (c) => (c === 2 ? 0.9 : 0.5), rankTarget: 1 });
    return res;
  };
  it("selectBestOfN double-run yields an identical winner + outcome row (deterministic selector)", async () => {
    const a = await runSelector();
    const b = await runSelector();
    assert.equal(a.winner, 2);
    assert.deepEqual(a.outcomes, b.outcomes, "same inputs ⇒ identical candidate outcome row");
    assert.equal(a.winner, b.winner);
    assert.deepEqual(candidatesLogDetail("chunk 1/2", 4, a.winner, a.outcomes), candidatesLogDetail("chunk 1/2", 4, b.winner, b.outcomes));
  });
});
