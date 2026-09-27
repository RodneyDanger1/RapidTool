import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  PATCH_MAX_LISTED,
  applyStrReplace,
  normalizePatchBlock,
  patchSimilarity,
  type PatchRefusal,
  type PatchResult,
  type PatchSuccess,
} from "./patch.ts";

/**
 * 216n · 107 T-107.1 · 103 A9 — pins for the `str_replace` primitive.
 *
 * Done-when for this module is a *refusal* proof: the dangerous failure mode is
 * a silently-wrong edit (first-match downgrade, silent fuzzy, ambiguous tie), so
 * the tests below plant each of those and require a coded refusal instead. The
 * unique-match contract, the opt-in-only fuzzy level that must self-report, and
 * totality (garbage in ⇒ honest refusal, never a throw) are each pinned.
 */

function ok(result: PatchResult): PatchSuccess {
  if (!result.ok) assert.fail(`expected a success, got refusal: ${result.error}`);
  return result;
}

function refused(result: PatchResult): PatchRefusal {
  if (result.ok) assert.fail(`expected a refusal, got an applied edit: ${JSON.stringify(result.diff)}`);
  return result;
}

describe("patch — unique-match contract", () => {
  it("replaces the single exact occurrence and reports an exact diff", () => {
    const source = "line one\nline two\nline three\n";
    const result = ok(applyStrReplace(source, { oldStr: "line two", newStr: "LINE TWO" }));
    assert.equal(result.kind, "exact");
    assert.equal(result.matches, 1);
    assert.equal(result.score, 1);
    assert.equal(result.threshold, null);
    assert.equal(result.text, "line one\nLINE TWO\nline three\n");
    assert.equal(result.diff.startLine, 2);
    assert.equal(result.diff.endLine, 2);
    assert.equal(result.diff.removed, "line two");
    assert.equal(result.diff.added, "LINE TWO");
    assert.equal(result.diff.removedLines, 1);
    assert.equal(result.diff.addedLines, 1);
    assert.equal(result.diff.unified, "@@ -2,1 +2,1 @@\n-line two\n+LINE TWO");
  });

  it("refuses 0 matches with the coded validation refusal (nothing applied)", () => {
    const result = refused(applyStrReplace("alpha\nbeta\n", { oldStr: "gamma", newStr: "x" }));
    assert.equal(result.code, "RT_E_VALIDATION");
    assert.equal(result.kind, "none");
    assert.equal(result.matches, 0);
    assert.equal(result.lines.length, 0);
    assert.match(result.error, /0 occurrences/);
    // diff-as-result exists only on a real edit; a refusal must not carry one.
    assert.equal("text" in result, false);
    assert.equal("diff" in result, false);
  });

  it("refuses >1 matches NAMING THE COUNT and the candidate lines (teeth: first-match downgrade fails here)", () => {
    const source = "dup\ndup\ndup\n";
    const result = refused(applyStrReplace(source, { oldStr: "dup", newStr: "single" }));
    assert.equal(result.code, "RT_E_VALIDATION");
    assert.equal(result.matches, 3, "the refusal must carry the true count, not the first hit");
    assert.deepEqual(result.lines, [1, 2, 3]);
    assert.match(result.error, /matches 3 times/);
    // If this module ever downgraded unique-match to first-match, the assertions
    // above would fail: a first-match implementation returns ok:true with text.
    assert.equal(result.ok, false);
  });

  it("counts OVERLAPPING occurrences honestly (indexOf-style start probes)", () => {
    const result = refused(applyStrReplace("aaaa", { oldStr: "aa", newStr: "b" }));
    assert.equal(result.matches, 3, "aaaa holds three start positions for `aa`");
    assert.deepEqual(result.lines, [1, 1, 1], "all three candidates live on line 1");
  });

  it("caps the listed candidate lines but never the count", () => {
    const source = `${Array.from({ length: 60 }, () => "dupe").join("\n")}\n`;
    const result = refused(applyStrReplace(source, { oldStr: "dupe", newStr: "one" }));
    assert.equal(result.matches, 60);
    assert.equal(result.lines.length, PATCH_MAX_LISTED);
    assert.equal(result.linesOmitted, 10);
    assert.match(result.error, /matches 60 times/);
  });

  it("refuses a no-op (oldStr === newStr) instead of reporting an applied edit", () => {
    const result = refused(applyStrReplace("same\n", { oldStr: "same", newStr: "same" }));
    assert.equal(result.code, "RT_E_VALIDATION");
    assert.match(result.error, /no-op/);
  });

  it("treats an empty oldStr as a refusal (an empty needle has no unique match)", () => {
    const result = refused(applyStrReplace("anything", { oldStr: "", newStr: "x" }));
    assert.equal(result.matches, 0);
    assert.match(result.error, /oldStr is empty/);
  });

  it("allows an empty newStr — a deletion is a legal edit", () => {
    const result = ok(applyStrReplace("keep\ndrop\n", { oldStr: "drop\n", newStr: "" }));
    assert.equal(result.text, "keep\n");
    assert.equal(result.diff.removed, "drop\n");
    assert.equal(result.diff.added, "");
  });

  it("degrades degenerate sources honestly: empty source and oversized needle both refuse at 0 matches", () => {
    const empty = refused(applyStrReplace("", { oldStr: "x", newStr: "y" }));
    assert.equal(empty.matches, 0);
    const longNeedle = refused(applyStrReplace("short", { oldStr: "much longer than the source", newStr: "y" }));
    assert.equal(longNeedle.matches, 0);
  });

  it("reports multi-line diffs with source line numbers and counts", () => {
    const source = "a\nb\nc\nd\n";
    const result = ok(applyStrReplace(source, { oldStr: "b\nc", newStr: "B\nC\nE" }));
    assert.equal(result.diff.startLine, 2);
    assert.equal(result.diff.endLine, 3);
    assert.equal(result.diff.removedLines, 2);
    assert.equal(result.diff.addedLines, 3);
    assert.equal(result.diff.unified, "@@ -2,2 +2,3 @@\n-b\n-c\n+B\n+C\n+E");
    assert.equal(result.text, "a\nB\nC\nE\nd\n");
  });
});

describe("patch — opt-in fuzzy level (never silently fuzzy)", () => {
  const source = "const a = 1;\nconst b = 2;\n";
  const spaced = "const    b =    2;";

  it("does NOT fuzzy by default: a whitespace-shifted needle refuses (never silently fuzzy)", () => {
    const result = refused(applyStrReplace(source, { oldStr: spaced, newStr: "const b = 3;" }));
    assert.equal(result.kind, "none");
    assert.equal(result.code, "RT_E_VALIDATION");
    assert.equal(result.threshold, null, "fuzzy was not opted in, so no threshold was consulted");
    assert.equal(result.bestScore, null);
  });

  it("lands the fuzzy level when the caller opts in, and SELF-REPORTS kind + score + threshold", () => {
    const result = ok(applyStrReplace(source, { oldStr: spaced, newStr: "const b = 3;", fuzzy: { threshold: 0.8 } }));
    assert.equal(result.kind, "fuzzy");
    assert.equal(result.matches, 0, "a fuzzy hit is not an exact occurrence — it must not claim to be one");
    assert.equal(result.score, 1, "whitespace-only difference normalizes to a perfect score");
    assert.ok(result.score >= 0.8);
    assert.equal(result.threshold, 0.8);
    assert.equal(result.diff.removed, "const b = 2;", "the diff must carry the ACTUAL matched slice, not the needle");
    assert.notEqual(result.diff.removed, spaced);
    assert.equal(result.text, "const a = 1;\nconst b = 3;\n");
    assert.equal(result.diff.startLine, 2);
  });

  it("grades partial matches: a near-miss clears a low threshold but not a high one", () => {
    const nearMiss = "const b = 2X;";
    const low = ok(applyStrReplace(source, { oldStr: nearMiss, newStr: "const b = 9;", fuzzy: { threshold: 0.8 } }));
    assert.equal(low.kind, "fuzzy");
    assert.ok(low.score < 1, `graded score must be < 1 for a near-miss (got ${low.score})`);
    const high = refused(applyStrReplace(source, { oldStr: nearMiss, newStr: "const b = 9;", fuzzy: { threshold: 0.99 } }));
    assert.equal(high.threshold, 0.99);
    assert.ok(high.bestScore !== null && high.bestScore < 0.99);
    assert.ok(high.bestLine !== null);
    assert.match(high.error, /fuzzy did not land/);
  });

  it("never rescues ambiguity: two exact matches refuse even with fuzzy opted in", () => {
    const result = refused(applyStrReplace("dup\ndup\n", { oldStr: "dup", newStr: "one", fuzzy: { threshold: 0.5 } }));
    assert.equal(result.matches, 2);
    assert.equal(result.kind, "none");
  });

  it("refuses a fuzzy tie instead of picking one of the equally-good windows", () => {
    const tied = "alpha beta\nalpha  beta\n";
    const result = refused(applyStrReplace(tied, { oldStr: "alpha     beta", newStr: "GAMMA", fuzzy: { threshold: 0.5 } }));
    assert.equal(result.kind, "none");
    assert.match(result.error, /tie/);
    assert.equal(result.bestScore, 1);
  });

  it("refuses an out-of-range or non-numeric threshold (an unbounded fuzzy level is never allowed)", () => {
    for (const threshold of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = refused(applyStrReplace(source, { oldStr: spaced, newStr: "x", fuzzy: { threshold } }));
      assert.equal(result.code, "RT_E_VALIDATION");
      assert.match(result.error, /threshold/);
    }
    const nonNumber = refused(
      applyStrReplace(source, { oldStr: spaced, newStr: "x", fuzzy: { threshold: "0.9" as unknown as number } }),
    );
    assert.match(nonNumber.error, /threshold/);
  });

  it("refuses when the needle is longer than the source even with fuzzy opted in", () => {
    const result = refused(
      applyStrReplace("one\ntwo\n", { oldStr: "one\ntwo\nthree\nfour", newStr: "x", fuzzy: { threshold: 0.5 } }),
    );
    assert.equal(result.matches, 0);
    assert.equal(result.bestScore, null);
    assert.match(result.error, /no candidate window/);
  });
});

describe("patch — purity, determinism, totality", () => {
  it("is deterministic: identical inputs give deep-equal results (success and refusal)", () => {
    const source = "a\nb\n";
    const successA = applyStrReplace(source, { oldStr: "b", newStr: "c" });
    const successB = applyStrReplace(source, { oldStr: "b", newStr: "c" });
    assert.deepEqual(successA, successB);
    const fuzzyA = applyStrReplace("x  y\n", { oldStr: "x y", newStr: "z", fuzzy: { threshold: 0.5 } });
    const fuzzyB = applyStrReplace("x  y\n", { oldStr: "x y", newStr: "z", fuzzy: { threshold: 0.5 } });
    assert.deepEqual(fuzzyA, fuzzyB);
    const refusalA = applyStrReplace(source, { oldStr: "nope", newStr: "c" });
    const refusalB = applyStrReplace(source, { oldStr: "nope", newStr: "c" });
    assert.deepEqual(refusalA, refusalB);
  });

  it("mutates nothing: a frozen request (and frozen fuzzy options) still works", () => {
    const source = "hello world\n";
    const before = source;
    const request = Object.freeze({
      oldStr: "world",
      newStr: "there",
      fuzzy: Object.freeze({ threshold: 0.5 }),
    });
    const result = ok(applyStrReplace(source, request));
    assert.equal(result.text, "hello there\n");
    assert.equal(source, before, "the source string must be untouched (strings are immutable — pinned anyway)");
    assert.equal(request.newStr, "there");
  });

  it("is total: garbage inputs refuse instead of throwing", () => {
    const cases: Array<[unknown, unknown]> = [
      [null, { oldStr: "a", newStr: "b" }],
      [undefined, { oldStr: "a", newStr: "b" }],
      [42, { oldStr: "a", newStr: "b" }],
      ["src", null],
      ["src", 7],
      ["src", undefined],
      ["src", { oldStr: 42, newStr: "b" }],
      ["src", { oldStr: "a", newStr: null }],
      ["src", {}],
    ];
    for (const [rawSource, rawRequest] of cases) {
      const result = refused(
        applyStrReplace(rawSource as unknown as string, rawRequest as unknown as Parameters<typeof applyStrReplace>[1]),
      );
      assert.equal(result.code, "RT_E_VALIDATION");
      assert.equal(result.ok, false);
      assert.equal(result.kind, "none");
    }
  });

  it("grades similarity as documented: whitespace-normalized equality is 1, unrelated text scores low, symmetric", () => {
    assert.equal(patchSimilarity("a b", "a  b"), 1);
    assert.equal(patchSimilarity("", ""), 1);
    assert.equal(normalizePatchBlock("  a \n\t b  "), "a b");
    const unrelated = patchSimilarity("alpha beta gamma", "zzz qqq");
    assert.ok(unrelated < 0.5, `unrelated blocks score low (got ${unrelated})`);
    assert.equal(patchSimilarity("hello world", "world hello"), patchSimilarity("world hello", "hello world"));
  });
});

// ---------------------------------------------------------------------------
// W23 L6 (T4.3 · 249 SPEC 2, Host 1) — user-edited trees: the str_replace
// primitive's side of the preservation guarantee. The emitted dir is the USER's
// artifact; the repair cycle must preserve a hand-edit or refuse loudly — never
// silently overwrite. These string-level cases frame each guard on the EDIT
// itself (the file the user touched), not on generic ambiguity: the needle that
// targets the edited region, the copy the edit duplicated, the fuzzy window
// that would land ON the edit.
// ---------------------------------------------------------------------------
describe("patch — user-edited trees (T4.3)", () => {
  /** The user's hand-edited module. The operator corrected the return value and
   *  left a marker comment; both must survive any later surgical replace. */
  const userEdited = [
    'export const VERSION = "1.0";',
    "// USER-EDIT: return value corrected by the operator (T4.3 fixture).",
    "export function total(x: number): number {",
    "  return x + 2;",
    "}",
    "",
    "export function label(): string {",
    '  return "total";',
    "}",
    "",
  ].join("\n");
  const USER_EDIT_MARKER = "// USER-EDIT: return value corrected by the operator (T4.3 fixture).";

  it("refuses the needle that targets the user-edited region (0 matches — nothing applied, nothing lost)", () => {
    // The needle is the PRE-edit text: the user already replaced it, so the
    // primitive must refuse rather than pick a neighbouring window.
    const result = refused(applyStrReplace(userEdited, { oldStr: "  return x + 1;", newStr: "  return x + 3;" }));
    assert.equal(result.code, "RT_E_VALIDATION", "the edited region no longer holds the stale needle");
    assert.equal(result.kind, "none");
    assert.equal(result.matches, 0, "0 exact matches — no rewrite is attempted");
    assert.equal("text" in result, false, "a refusal carries no rewritten text (the user's edit is never silently dropped)");
    assert.equal("diff" in result, false, "…and no diff is reported as if an edit had landed");
  });

  it("lands a needle on a DIFFERENT region of the same edited file and leaves the edit verbatim (surgical replace)", () => {
    const result = ok(applyStrReplace(userEdited, { oldStr: 'return "total";', newStr: 'return "total-v2";' }));
    assert.equal(result.kind, "exact");
    assert.equal(result.matches, 1, "exactly one occurrence — the unique-match contract held on the edited file");
    assert.equal(
      result.text.includes(USER_EDIT_MARKER),
      true,
      "the user's comment survives byte-for-byte (the replace was surgical, not a rewrite)",
    );
    assert.equal(result.text.includes("  return x + 2;"), true, "the user's corrected return value is untouched");
    assert.equal(result.text.includes("  return x + 1;"), false, "the pre-edit text never reappears");
    assert.equal(result.diff.removed, 'return "total";', "only the targeted line moved");
  });

  it("refuses when the user's edit DUPLICATED the needle's block (true count named, candidate lines capped)", () => {
    // The edit behaviour that makes a first-match downgrade catastrophic: the
    // user copied a block, so a first-match implementation would rewrite the
    // WRONG occurrence. 60 copies also exercise PATCH_MAX_LISTED.
    const dupBlock = "const FLAG = true;";
    const duplicated = [
      "// USER-EDIT: the operator duplicated the block below (T4.3 fixture).",
      dupBlock,
      ...Array.from({ length: 59 }, () => dupBlock),
      "export const READY = true;",
      "",
    ].join("\n");
    const result = refused(applyStrReplace(duplicated, { oldStr: dupBlock, newStr: "const FLAG = false;" }));
    assert.equal(result.code, "RT_E_VALIDATION");
    assert.equal(result.matches, 60, "the refusal names the TRUE count (a first-match downgrade would return ok:true)");
    assert.match(result.error, /matches 60 times/, "the error names the count, never the first hit");
    assert.equal(result.lines.length, PATCH_MAX_LISTED, "candidate lines stay capped at PATCH_MAX_LISTED");
    assert.equal(result.linesOmitted, 60 - PATCH_MAX_LISTED, "the omitted remainder is counted, not hidden");
    assert.equal(result.ok, false, "ambiguity is never rescued by a guess");
  });

  it("fuzzy opt-in: a window that would land ON the edited region refuses below threshold; a landed fuzzy hit self-reports", () => {
    // The pre-edit text still exists conceptually, but the bytes on disk moved.
    // The graded scan must refuse when the best window (the edited return line)
    // does not clear the threshold — and when it does land, it must self-report
    // kind/score/threshold with the ACTUAL matched window in diff.removed.
    const nearMiss = "  return x + 21;";
    const belowThreshold = refused(
      applyStrReplace(userEdited, { oldStr: nearMiss, newStr: "  return x + 99;", fuzzy: { threshold: 0.99 } }),
    );
    assert.equal(belowThreshold.kind, "none", "a below-threshold window never lands (the edit is safe)");
    assert.equal(belowThreshold.threshold, 0.99, "the consulted threshold is reported");
    assert.equal(belowThreshold.bestLine, 4, "the best window sits on the user-edited return line");
    assert.ok(
      belowThreshold.bestScore !== null && belowThreshold.bestScore > 0.5 && belowThreshold.bestScore < 0.99,
      "the graded best window is reported honestly (near but below the bar)",
    );
    assert.match(belowThreshold.error, /fuzzy did not land/, "the refusal says fuzzy was attempted and refused");

    const landed = ok(
      applyStrReplace(userEdited, { oldStr: nearMiss, newStr: "  return x + 99;", fuzzy: { threshold: 0.5 } }),
    );
    assert.equal(landed.kind, "fuzzy", "a fuzzy hit must self-report its level (never silently fuzzy)");
    assert.equal(landed.threshold, 0.5, "the threshold it cleared is on the result");
    assert.ok(landed.score >= 0.5, "the reported score cleared the reported threshold");
    assert.equal(landed.diff.removed, "  return x + 2;", "diff.removed is the ACTUAL matched window, never the needle");
    assert.notEqual(landed.diff.removed, nearMiss, "the needle was not what landed — say what really replaced what");
    assert.equal(
      landed.text.includes(USER_EDIT_MARKER),
      true,
      "the rest of the edited file is preserved around the landed window",
    );
  });
});
