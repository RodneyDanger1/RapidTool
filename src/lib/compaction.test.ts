import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_BUFFER,
  DEFAULT_KEEP_TOKENS,
  SUMMARY_OUTPUT_TOKENS,
  SUMMARY_PLACEHOLDERS,
  SUMMARY_SECTIONS,
  SUMMARY_TEMPLATE,
  TOOL_OUTPUT_MAX_CHARS,
  clampToolOutput,
  compactionOutcome,
  renderCompactionSummary,
  shouldCompact,
  tokensSaved,
  type CompactionOutcome,
} from "./compaction.ts";

/**
 * 216v · 107 T-107.9 · 103 A5/A6 — pins for the adopted compaction vocabulary.
 *
 * Two failures these tests exist to prevent: (1) the constants drifting from
 * the copied spec (the dossier's four numbers + the frozen section order are
 * the adopted artifact — a silent retune makes every consumer's budget lie);
 * (2) the P0-02 class this module carries — a compaction that reports on its
 * own REQUEST instead of its EFFECT. `compactionOutcome` must never say
 * "compacted" without a measured token drop, and must never turn "no event
 * landed" into a success arm. Teeth: each pin below fails on a weaker
 * implementation (documented inline).
 */

describe("compaction — the adopted spec values (dossier 107 §9)", () => {
  it("pins the four copied constants to their exact numbers", () => {
    // A retune here is a deliberate, reviewable act — never a drive-by edit.
    assert.equal(DEFAULT_BUFFER, 20_000);
    assert.equal(DEFAULT_KEEP_TOKENS, 8_000);
    assert.equal(TOOL_OUTPUT_MAX_CHARS, 2_000);
    assert.equal(SUMMARY_OUTPUT_TOKENS, 4_096);
  });

  it("SUMMARY_SECTIONS is the exact heading set, in the one permitted order, frozen", () => {
    assert.deepEqual(
      [...SUMMARY_SECTIONS],
      [
        "## Objective",
        "## Important Details",
        "## Work State",
        "### Completed",
        "### Active",
        "### Blocked",
        "## Next Move",
      ],
    );
    assert.equal(Object.isFrozen(SUMMARY_SECTIONS), true);
    // Frozen in practice, not just in theory (strict-mode write must throw).
    assert.throws(() => {
      (SUMMARY_SECTIONS as string[])[0] = "## Reordered";
    }, TypeError);
  });

  it("SUMMARY_TEMPLATE carries every section heading IN ORDER inside <template>", () => {
    assert.ok(
      SUMMARY_TEMPLATE.startsWith(
        "Output exactly the Markdown structure shown inside <template> and keep the section order unchanged.",
      ),
    );
    assert.ok(SUMMARY_TEMPLATE.includes("<template>"));
    assert.ok(SUMMARY_TEMPLATE.includes("</template>"));
    let cursor = -1;
    for (const heading of SUMMARY_SECTIONS) {
      const at = SUMMARY_TEMPLATE.indexOf(heading);
      assert.ok(at > cursor, `heading ${heading} missing or out of order`);
      cursor = at;
    }
    // A template missing one placeholder would silently drop that section's
    // content on render — the placeholders are part of the contract.
    for (const ph of SUMMARY_PLACEHOLDERS) {
      assert.ok(SUMMARY_TEMPLATE.includes(ph), `template lacks ${ph}`);
    }
  });
});

describe("compaction — renderCompactionSummary", () => {
  it("fills each placeholder and substitutes (none) for absent fields", () => {
    const out = renderCompactionSummary({
      objective: "Ship the one-seam approval path",
      importantDetails: "P0-01 closed; both seats pinned",
      completed: "policy.ts + headless wiring",
      // active / blocked / nextMove deliberately absent
    });
    assert.ok(out.includes("Ship the one-seam approval path"));
    assert.ok(out.includes("P0-01 closed; both seats pinned"));
    assert.ok(out.includes("policy.ts + headless wiring"));
    assert.equal(out.match(/\(none\)/g)?.length, 3);
    assert.equal(out.includes("{objective}"), false, "no placeholder may survive render");
  });

  it("keeps the section order for ANY fill (the order is protocol, not style)", () => {
    const out = renderCompactionSummary({
      nextMove: "Run the gates",
      completed: "x",
      objective: "o",
      blocked: "b",
      active: "a",
      importantDetails: "d",
    });
    let cursor = -1;
    for (const heading of SUMMARY_SECTIONS) {
      const at = out.indexOf(heading);
      assert.ok(at > cursor, `heading ${heading} out of order after render`);
      cursor = at;
    }
  });

  it("is total: garbage fills render a well-formed summary, never a throw", () => {
    for (const fill of [null, undefined, 42, "text", { objective: 42 }]) {
      const out = renderCompactionSummary(fill as never);
      assert.equal(typeof out, "string");
      assert.ok(out.includes("## Objective"));
      assert.ok(out.includes("## Next Move"));
    }
  });
});

describe("compaction — shouldCompact (the buffer trigger)", () => {
  it("stays quiet with ample headroom and fires at the buffer boundary", () => {
    assert.equal(shouldCompact(1_000, 1_000_000), false);
    // remaining === buffer ⇒ DUE (the boundary belongs to the trigger).
    assert.equal(shouldCompact(30_000, 50_000), true);
    // one token more headroom ⇒ not yet due.
    assert.equal(shouldCompact(29_999, 50_000), false);
  });

  it("fires once the prompt is past the window", () => {
    assert.equal(shouldCompact(60_000, 50_000), true);
    // Teeth: a `remaining < 0`-only implementation (no buffer) fails the
    // 30k/50k boundary pin above; a buffer-only one fails this pin.
  });

  it("honors an explicit buffer override and is total on garbage", () => {
    assert.equal(shouldCompact(90, 100, 10), true);
    assert.equal(shouldCompact(89, 100, 10), false);
    for (const args of [
      [NaN, 100],
      [10, Infinity],
      [10, NaN],
      [-5, 100],
      [10, 0],
      [10, -1],
      [undefined, 100],
      ["10", 100],
    ] as const) {
      assert.equal(
        shouldCompact(args[0] as number, args[1] as number),
        false,
        `garbage trigger for ${String(args[0])}/${String(args[1])}`,
      );
    }
    assert.equal(shouldCompact(50, 100, NaN), false, "a garbage buffer never triggers");
    assert.equal(shouldCompact(50, 100, -1), false, "a negative buffer never triggers");
  });
});

describe("compaction — compactionOutcome (verify the EFFECT, never the request)", () => {
  it("NO event is timeout — a failure arm, even when tokens dropped", () => {
    // The dossier's sharpest sentence: a compaction that never landed must not
    // be reportable as a no-op. Teeth: an implementation that maps
    // !event && drop ⇒ "no_change" (or "compacted") fails here.
    assert.equal(
      compactionOutcome({ eventObserved: false, tokensBefore: 1_000, tokensAfter: 100 }),
      "timeout",
    );
    assert.equal(
      compactionOutcome({ eventObserved: false, tokensBefore: 100, tokensAfter: 100 }),
      "timeout",
    );
  });

  it("event + measured drop is the only path to compacted", () => {
    assert.equal(
      compactionOutcome({ eventObserved: true, tokensBefore: 9_000, tokensAfter: 7_999 }),
      "compacted",
    );
    // One token of drop is still a drop (no invented marginal-shrink threshold).
    assert.equal(
      compactionOutcome({ eventObserved: true, tokensBefore: 9_000, tokensAfter: 8_999 }),
      "compacted",
    );
  });

  it("event + equal-or-grown tokens is no_change, never compacted", () => {
    assert.equal(
      compactionOutcome({ eventObserved: true, tokensBefore: 8_000, tokensAfter: 8_000 }),
      "no_change",
    );
    assert.equal(
      compactionOutcome({ eventObserved: true, tokensBefore: 8_000, tokensAfter: 9_500 }),
      "no_change",
    );
  });

  it("malformed input lands on the failure arm (timeout), never a fabricated success", () => {
    for (const input of [
      null,
      undefined,
      42,
      {},
      { eventObserved: true },
      { eventObserved: true, tokensBefore: NaN, tokensAfter: 5 },
      { eventObserved: true, tokensBefore: 5, tokensAfter: Infinity },
      { eventObserved: "yes", tokensBefore: 5, tokensAfter: 1 },
    ]) {
      assert.equal(compactionOutcome(input as never), "timeout");
    }
  });

  it("sweep: 'compacted' iff an event landed AND tokens strictly dropped", () => {
    const drops = [0, 1, 5];
    for (const eventObserved of [false, true]) {
      for (const drop of drops) {
        const out: CompactionOutcome = compactionOutcome({
          eventObserved,
          tokensBefore: 100,
          tokensAfter: 100 - drop,
        });
        const expected: CompactionOutcome =
          !eventObserved ? "timeout" : drop > 0 ? "compacted" : "no_change";
        assert.equal(out, expected, `event=${eventObserved} drop=${drop}`);
      }
    }
  });
});

describe("compaction — tokensSaved", () => {
  it("reports the signed difference and is total on garbage", () => {
    assert.equal(tokensSaved(9_000, 7_000), 2_000);
    assert.equal(tokensSaved(7_000, 9_000), -2_000);
    assert.equal(tokensSaved(5, 5), 0);
    assert.equal(tokensSaved(NaN, 5), -5);
    assert.equal(tokensSaved(5, NaN), 5);
    assert.equal(tokensSaved(undefined as never, undefined as never), 0);
  });
});

describe("compaction — clampToolOutput (per-tool-result cap, marked + counted)", () => {
  it("passes text at or under the cap through byte-identical", () => {
    const text = "small runner output";
    const r = clampToolOutput(text, 2_000);
    assert.equal(r.text, text);
    assert.equal(r.clamped, false);
    assert.equal(r.originalChars, text.length);
    assert.equal(r.elidedChars, 0);
    const exact = "x".repeat(2_000);
    const rExact = clampToolOutput(exact, 2_000);
    assert.equal(rExact.clamped, false);
    assert.equal(rExact.text, exact);
  });

  it("middle-truncates oversized output with a counted elision marker", () => {
    const head = "H".repeat(300);
    const middle = "M".repeat(5_000);
    const tail = "T".repeat(300);
    const text = head + middle + tail; // 5,600 chars
    const r = clampToolOutput(text, 2_000);
    assert.equal(r.clamped, true);
    assert.equal(r.originalChars, 5_600);
    assert.equal(r.text.length, 2_000, "the clamp fits the cap exactly");
    assert.equal(r.text.startsWith("H"), true, "the head survives");
    assert.equal(r.text.endsWith("T".repeat(20)), true, "the tail survives");
    // The head slice (1,200 of 2,000) legitimately eats 900 of the 5,000
    // M's, and the tail slice keeps ~450 more — so the pin names the real
    // property: the CENTRAL BULK is gone (no run of 1,000 M's can survive a
    // 900-max head run; a no-op passthrough keeps all 5,000). Parent boundary
    // fix (W7): the original "M".repeat(50) pin contradicted the head slice
    // by construction and could never pass.
    assert.equal(r.text.includes("M".repeat(1_000)), false, "the central bulk of the middle is really gone");
    assert.ok(r.text.includes(`[${r.elidedChars} chars elided by compaction]`));
    // Accounting must balance: head + elided + tail === original. (Parent
    // boundary fix (W7): the previous block was a tautological arithmetic
    // stub the lane itself flagged as bogus — replaced with the real sum.)
    const marker = `\n… [${r.elidedChars} chars elided by compaction] …\n`;
    const headShown = r.text.indexOf(marker);
    const tailShown = r.text.length - headShown - marker.length;
    assert.ok(headShown > 0, "the head is really shown before the marker");
    assert.equal(headShown + r.elidedChars + tailShown, r.originalChars, "head + elided + tail === original");
    // Teeth: a silent slice(0, cap) implementation has no marker and fails the
    // includes() pin; a marker with a wrong count fails the equation above.
  });

  it("a cap too small for a marker still COUNTS its cut (never silent)", () => {
    const text = "y".repeat(100);
    const r = clampToolOutput(text, 32);
    assert.equal(r.text, "y".repeat(32));
    assert.equal(r.clamped, true);
    assert.equal(r.originalChars, 100);
    assert.equal(r.elidedChars, 68);
  });

  it("is total: non-string input and garbage caps never throw", () => {
    const rNull = clampToolOutput(null as never);
    assert.deepEqual(rNull, { text: "", clamped: false, originalChars: 0, elidedChars: 0 });
    const rNaN = clampToolOutput("z".repeat(3_000), NaN);
    assert.equal(rNaN.clamped, true);
    assert.ok(rNaN.text.length <= TOOL_OUTPUT_MAX_CHARS);
    assert.equal(rNaN.originalChars, 3_000);
    const rNeg = clampToolOutput("z".repeat(3_000), -5);
    assert.equal(rNeg.clamped, true);
    assert.ok(rNeg.text.length <= TOOL_OUTPUT_MAX_CHARS);
  });
});
