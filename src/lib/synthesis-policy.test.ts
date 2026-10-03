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
  candidatesLogDetail,
  P6_SYNTH_CANDIDATES_DEFAULT,
  P6_SYNTH_CANDIDATES_MAX,
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
});
