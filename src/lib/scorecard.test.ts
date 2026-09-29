// ---------------------------------------------------------------------------
// scorecard.test.ts — W42·L1-E2 pins for the eval scorecard READER
// (src/lib/scorecard.ts). Claims proven here, all WITHOUT touching disk (the
// module is PURE by contract — string fixtures in, structures out):
//
//   (a) TOLERANT ABSENCE — a legacy results.json row (no `endClass`, no
//       acceptance.behaviorOk/kindOk/verification) reads as nulls and counts
//       `absent` in the census — never fabricated into "unmeasured".
//   (b) POPULATED FIELDS RIDE — verification on acceptance; behaviorOk /
//       kindOk / endClass on entries; endClass on history rows.
//   (c) CENSUS ARITHMETIC — derived.endClass {funded, unfunded, unmeasured,
//       absent} + derived.acceptance {pass, fail, unscored} over the entries,
//       incl. the rule that a value outside the classifier's three classes
//       counts absent.
//   (d) HOSTILE SHAPES — junk types (arrays/numbers/strings where objects are
//       expected) never throw; they degrade to nulls/absences.
//
// Run: node --experimental-strip-types --test src/lib/scorecard.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildScorecard,
  parseEvalHistory,
  parseEvalResults,
  type EvalHistoryRow,
  type EvalResultsDoc,
} from "./scorecard.ts";

/** Minimal results row; `extra` merges last so each case can override/drop. */
function entryRow(extra: Record<string, unknown> = {}) {
  return {
    slug: "demo-case",
    name: "Demo",
    status: "complete",
    mode: "keyless",
    total: 3,
    mean: 0.33,
    criteria: {
      M1: { score: 1, evidence: "e1" },
      M2: { score: 1, evidence: "e2" },
      M3: { score: 1, evidence: "e3" },
    },
    ...extra,
  };
}

function resultsDoc(entries: unknown[]): EvalResultsDoc {
  const parsed = parseEvalResults(
    JSON.stringify({ generatedAt: "2026-09-28T00:00:00.000Z", mode: "keyless", entries }),
  );
  assert.equal(parsed.ok, true, "fixture must parse");
  if (!parsed.ok) throw new Error("unreachable");
  return parsed.value;
}

function cardFor(entries: unknown[], history: EvalHistoryRow[] = []) {
  return buildScorecard({
    results: resultsDoc(entries),
    history,
    historyPresent: history.length > 0,
    dir: "scratch",
  });
}

describe("scorecard reader — L1-E2 endClass/verification/census", () => {
  it("(a) legacy row without the keys → nulls everywhere + census counts absent (never 'unmeasured')", () => {
    const card = cardFor([entryRow()]);
    const e = card.entries[0];
    assert.equal(e.endClass, null, "a legacy row has no class — null, not a guess");
    assert.equal(e.behaviorOk, null);
    assert.equal(e.kindOk, null);
    assert.equal(e.acceptance, null, "no acceptance block at all");
    assert.deepEqual(card.derived.endClass, { funded: 0, unfunded: 0, unmeasured: 0, absent: 1 });
    assert.deepEqual(card.derived.acceptance, { pass: 0, fail: 0, unscored: 1 });
    assert.ok(
      card.notes.some((n) => n.includes("endClass census (1 entries)") && n.includes("absent 1")),
      "the census must be named in the notes",
    );
    assert.ok(
      card.notes.some((n) => n.includes("never guessed into a class")),
      "the absent rule must be stated",
    );
  });

  it("(b) populated row → verification + behaviorOk/kindOk/endClass ride; history row's endClass parses", () => {
    const populated = entryRow({
      endClass: "funded",
      acceptance: {
        filesOk: true,
        contentOk: true,
        pass: true,
        missingFiles: [],
        failedContent: [],
        passReason: null,
        behaviorOk: true,
        kindOk: false,
        verification:
          "files+content+behavior+kind (behavior rows evaluated from outside the tree; kind asserted against the README Kind line)",
        checked: { expectedFiles: 2, expectedContent: 1 },
      },
    });
    const hist = parseEvalHistory(
      JSON.stringify([
        { at: "2026-09-28T00:00:00.000Z", mode: "keyed", slug: "demo-case", trial: 1, trials: 1, pass: true, endClass: "funded", m1: 1, total: 9, mean: 1 },
        { at: "2026-09-01T00:00:00.000Z", mode: "keyless", slug: "demo-case", trial: 1, trials: 1, pass: null, m1: 0, total: 3, mean: 0.33 },
      ]),
    );
    assert.equal(hist.ok, true);
    if (!hist.ok) return;
    assert.equal(hist.value[0].endClass, "funded");
    assert.equal(hist.value[1].endClass, null, "a legacy history row stays null");

    const card = cardFor([populated], hist.value);
    const e = card.entries[0];
    assert.equal(e.endClass, "funded");
    assert.equal(e.behaviorOk, true);
    assert.equal(e.kindOk, false);
    assert.ok(e.acceptance);
    assert.match(e.acceptance.verification ?? "", /files\+content\+behavior\+kind/);
    assert.deepEqual(card.derived.endClass, { funded: 1, unfunded: 0, unmeasured: 0, absent: 0 });
    assert.deepEqual(card.derived.acceptance, { pass: 1, fail: 0, unscored: 0 });
  });

  it("(c) census arithmetic over a mixed board (incl. a value outside the three classes → absent)", () => {
    const card = cardFor([
      entryRow({ slug: "a", endClass: "funded", acceptance: { pass: true } }),
      entryRow({ slug: "b", endClass: "unfunded", notes: { noBalance: true }, acceptance: { pass: null } }),
      entryRow({ slug: "c", endClass: "unmeasured", acceptance: { pass: false } }),
      entryRow({ slug: "d" }), // legacy: no endClass, no acceptance
      entryRow({ slug: "e", endClass: "banana" }), // never written by run-eval — absent, not a class
    ]);
    assert.deepEqual(card.derived.endClass, { funded: 1, unfunded: 1, unmeasured: 1, absent: 2 });
    assert.deepEqual(card.derived.acceptance, { pass: 1, fail: 1, unscored: 3 });
    assert.equal(card.derived.entries, 5);
    assert.ok(
      card.notes.some((n) => n.includes("acceptance census: pass 1 · fail 1 · unscored 3")),
      "the acceptance census note carries the same numbers as derived",
    );
  });

  it("(d) hostile shapes never throw — junk degrades to nulls/absences", () => {
    const card = cardFor([
      entryRow({ slug: "h1", endClass: 42, acceptance: "not-an-object", coverage: 7 }),
      entryRow({ slug: "h2", endClass: "", acceptance: { pass: "yes", behaviorOk: 1, kindOk: null } }),
    ]);
    const [h1, h2] = card.entries;
    assert.equal(h1.endClass, null, "a non-string class is absent, never coerced");
    assert.equal(h1.acceptance, null);
    assert.deepEqual(h1.coverageMissing, []);
    assert.equal(h2.endClass, null, "an empty-string class is absent");
    assert.equal(h2.acceptance?.pass, null, "a non-boolean pass reads null (unscored)");
    assert.equal(h2.behaviorOk, null, "a numeric behaviorOk is not a boolean verdict");
    assert.equal(h2.kindOk, null);
    assert.deepEqual(card.derived.endClass, { funded: 0, unfunded: 0, unmeasured: 0, absent: 2 });
    assert.deepEqual(card.derived.acceptance, { pass: 0, fail: 0, unscored: 2 });
  });

  it("(e) slug filter narrows the census with the entries it narrows", () => {
    const card = buildScorecard({
      results: resultsDoc([
        entryRow({ slug: "a", endClass: "funded" }),
        entryRow({ slug: "b", endClass: "unmeasured" }),
      ]),
      history: [],
      historyPresent: false,
      dir: "scratch",
      slug: "a",
    });
    assert.deepEqual(card.derived.endClass, { funded: 1, unfunded: 0, unmeasured: 0, absent: 0 });
  });
});
