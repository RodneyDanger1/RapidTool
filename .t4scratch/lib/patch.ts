// ---------------------------------------------------------------------------
// patch.ts — the `str_replace` patch primitive (216n · 107 T-107.1 · 103 A9).
//
// Why this exists: `repair --dir` re-imports an edited tree but synthesis is
// still whole-artifact — re-emit overwrites whole files and cannot preserve a
// user's edits (103 A9: "README line 168: no apply-patch/continue primitive").
// This module is that missing primitive: apply ONE textual replacement to a
// source string, or refuse with a coded, actionable error. It writes nothing
// and reads nothing — W5 wires it into codegen P6 emit deltas and
// `headless.ts repairTreeDir`.
//
// Doctrine (restated from rt-timeline.ts / algorithms.ts for this module):
//   · PURE — no fs, no Date.now(), no process.env, no randomness. Deterministic:
//     the same input returns a deep-equal result. Nothing mutates an input (the
//     frozen-request test pins it).
//   · TOTAL — no input throws. Non-strings, an empty needle, garbage options and
//     oversized sources all come back as honest coded refusals.
//   · HONEST — never a silent fuzzy. Fuzzy is a SEPARATE OPT-IN level
//     (`opts.fuzzy.threshold`) and every fuzzy result self-reports: `kind:
//     "fuzzy"` + the achieved `score` + the `threshold` it cleared. Ambiguity
//     (more than one exact match, a fuzzy tie, a no-op edit) always REFUSES
//     rather than guessing.
//
// Unique-match contract (the core of T-107.1):
//   exactly 1 exact occurrence ⇒ replace it (`kind: "exact"`).
//   0 occurrences            ⇒ coded refusal (RT_E_VALIDATION) — unless the
//                              caller opted into fuzzy and one line window clears
//                              the threshold as the STRICT best.
//   >1 occurrences           ⇒ coded refusal naming the COUNT (plus candidate
//                              line numbers). Fuzzy never rescues ambiguity.
//
// Error codes: refusals reuse `RT_E_VALIDATION` from src/lib/errors.ts — its
// ERROR_CODE_DOC meaning is exactly "Input or model output failed validation and
// cannot be used". No new codes were allocated: `ERROR_CODES` is append-only and
// errors.ts is outside this lane's ownership in this wave (see fixes/216n §5);
// W5 may allocate a dedicated `RT_E_PATCH_*` code when it owns that edit.
// ---------------------------------------------------------------------------

import type { ErrorCode } from "./errors.ts";

/** Which replacement level produced the result. `"none"` = nothing was applied
 *  (every refusal carries it); the two happy levels are `"exact"` and `"fuzzy"`. */
export type PatchKind = "exact" | "fuzzy" | "none";

/** One textual replacement request. `fuzzy` absent ⇒ exact-only, never silently
 *  fuzzy (no default threshold exists by design). */
export type PatchRequest = {
  /** The block to find. Must be non-empty and occur exactly once (or clear the
   *  opt-in fuzzy level as the strict best window). */
  oldStr: string;
  /** The block to write in its place. May be empty (a legal deletion). */
  newStr: string;
  /** Opt-in graded fuzzy level. `threshold ∈ (0, 1]` — the minimum Dice score
   *  (see `patchSimilarity`) a candidate window must reach, and it must be the
   *  STRICT best. Any successful fuzzy result reports `kind: "fuzzy"`. */
  fuzzy?: { threshold: number };
};

/** The diff half of a successful patch — computed, not stored, from the real
 *  source slice (on a fuzzy hit `removed` is the ACTUAL matched window, which
 *  may differ from `oldStr` in whitespace; that difference is the honesty). */
export type PatchDiff = {
  /** 1-based line of the first replaced line in the source. */
  startLine: number;
  /** 1-based line of the last replaced line in the source. */
  endLine: number;
  /** The exact source slice that was replaced. */
  removed: string;
  /** The text written in its place (=== `newStr`). */
  added: string;
  removedLines: number;
  addedLines: number;
  /** Minimal unified hunk (`@@ -start,count +start,count @@` + `-`/`+` lines). */
  unified: string;
};

/** A patch that was applied. `score` is 1 for an exact hit and the achieved
 *  graded score for a fuzzy hit; `threshold` is null for exact (no threshold was
 *  consulted — an exact occurrence would clear any legal threshold). */
export type PatchSuccess = {
  ok: true;
  kind: "exact" | "fuzzy";
  /** The patched source. */
  text: string;
  diff: PatchDiff;
  /** Exact occurrences found: 1 on an exact hit, 0 on a fuzzy hit. */
  matches: number;
  score: number;
  threshold: number | null;
};

/** An honest refusal — nothing was applied, nothing was guessed. */
export type PatchRefusal = {
  ok: false;
  kind: "none";
  code: ErrorCode;
  error: string;
  /** Exact occurrences found: 0 (not found) or >1 (ambiguous). */
  matches: number;
  /** 1-based line numbers of the exact occurrences, capped at PATCH_MAX_LISTED. */
  lines: number[];
  /** Occurrences beyond the listed window (0 when every one is listed). */
  linesOmitted: number;
  /** Fuzzy diagnostics when fuzzy was opted in and did not land: best score seen. */
  bestScore: number | null;
  /** 1-based line of that best window, null when there was no candidate. */
  bestLine: number | null;
  /** The threshold that was consulted, null when fuzzy was not opted in. */
  threshold: number | null;
};

export type PatchResult = PatchSuccess | PatchRefusal;

/** Cap on the candidate line numbers a multi-match refusal lists. The COUNT is
 *  always complete (that is what the refusal must name); only the line list is
 *  bounded so a pathological source cannot balloon the result. */
export const PATCH_MAX_LISTED = 50;

const VALIDATION: ErrorCode = "RT_E_VALIDATION";

/** Normalize a block for the graded comparison: every whitespace run collapses
 *  to one space and the ends are trimmed. Case is deliberately NOT folded — a
 *  case change is a real edit, not formatting, so it must not be silently
 *  accepted as "the same text". */
export function normalizePatchBlock(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Character bigrams of a normalized block, in order (deterministic). */
function bigrams(text: string): string[] {
  const out: string[] = [];
  for (let i = 0; i + 1 < text.length; i += 1) out.push(text.slice(i, i + 2));
  return out;
}

/** Graded similarity ∈ [0, 1]: the Dice coefficient over character bigrams of
 *  the whitespace-normalized blocks. Whitespace-only variants score 1; unrelated
 *  text scores low; blocks with no bigrams (shorter than two characters) score 0
 *  unless equal. Exported so W5 and the tests pin the same scorer. */
export function patchSimilarity(a: string, b: string): number {
  const left = normalizePatchBlock(a);
  const right = normalizePatchBlock(b);
  if (left === right) return 1;
  const bgLeft = bigrams(left);
  const bgRight = bigrams(right);
  if (bgLeft.length === 0 || bgRight.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const gram of bgLeft) counts.set(gram, (counts.get(gram) ?? 0) + 1);
  let intersection = 0;
  for (const gram of bgRight) {
    const remaining = counts.get(gram) ?? 0;
    if (remaining > 0) {
      counts.set(gram, remaining - 1);
      intersection += 1;
    }
  }
  return (2 * intersection) / (bgLeft.length + bgRight.length);
}

/** 1-based line number of a character index. */
function lineAtIndex(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i += 1) if (source.charCodeAt(i) === 10) line += 1;
  return line;
}

/** Line count of a block (a block with no newline is one line). */
function lineCountOf(text: string): number {
  return text.split("\n").length;
}

function buildDiff(startLine: number, removed: string, added: string): PatchDiff {
  const removedLines = lineCountOf(removed);
  const addedLines = lineCountOf(added);
  const unified =
    `@@ -${startLine},${removedLines} +${startLine},${addedLines} @@\n` +
    `${removed.split("\n").map((line) => `-${line}`).join("\n")}\n` +
    `${added.split("\n").map((line) => `+${line}`).join("\n")}`;
  return {
    startLine,
    endLine: startLine + removedLines - 1,
    removed,
    added,
    removedLines,
    addedLines,
    unified,
  };
}

type RefusalExtras = {
  lines?: number[];
  bestScore?: number | null;
  bestLine?: number | null;
  threshold?: number | null;
};

function refuse(error: string, matches: number, extras: RefusalExtras = {}): PatchRefusal {
  const lines = extras.lines ?? [];
  return {
    ok: false,
    kind: "none",
    code: VALIDATION,
    error,
    matches,
    lines,
    linesOmitted: Math.max(0, matches - lines.length),
    bestScore: extras.bestScore ?? null,
    bestLine: extras.bestLine ?? null,
    threshold: extras.threshold ?? null,
  };
}

/** One candidate window's score against the needle, with its 1-based line. */
type FuzzyCandidate = {
  score: number;
  line: number;
  /** Character index of the window start in the source. */
  index: number;
  /** The window's exact source text (what a hit would replace). */
  text: string;
};

/**
 * Scan every line window of the needle's line count and return the strict-best
 * candidate plus the runner-up (the tie detector) and how many windows existed.
 * Total: a source shorter than the needle yields zero windows, not an error.
 */
function fuzzyScan(
  source: string,
  oldStr: string,
  threshold: number,
): {
  best: FuzzyCandidate | null;
  second: FuzzyCandidate | null;
  windows: number;
  hit: FuzzyCandidate | null;
} {
  const sourceLines = source.split("\n");
  const needleLines = lineCountOf(oldStr);
  const windows = sourceLines.length - needleLines + 1;
  let best: FuzzyCandidate | null = null;
  let second: FuzzyCandidate | null = null;
  for (let start = 0; start < windows; start += 1) {
    const windowLines = sourceLines.slice(start, start + needleLines);
    const windowText = windowLines.join("\n");
    let index = 0;
    for (let i = 0; i < start; i += 1) index += sourceLines[i].length + 1;
    const candidate: FuzzyCandidate = {
      score: patchSimilarity(windowText, oldStr),
      line: start + 1,
      index,
      text: windowText,
    };
    if (best === null || candidate.score > best.score) {
      second = best;
      best = candidate;
    } else if (second === null || candidate.score > second.score) {
      second = candidate;
    }
  }
  // Accept only a STRICT best: a tie means two windows are equally plausible and
  // picking one would be a guess (211's "never guess into a write" rule).
  const hit = best !== null && best.score >= threshold && (second === null || best.score > second.score) ? best : null;
  return { best, second, windows, hit };
}

/**
 * Apply ONE textual replacement to `source`, or refuse with a coded error.
 *
 * Unique-match contract: exactly one exact occurrence ⇒ replace; zero ⇒ coded
 * refusal unless the opt-in fuzzy level lands as the strict best; more than one
 * ⇒ coded refusal naming the count (fuzzy never rescues ambiguity). A no-op
 * (`oldStr === newStr`) is refused rather than reported as an applied edit.
 *
 * Pure / deterministic / total: no I/O, no clocks, no env; identical inputs give
 * deep-equal results; malformed inputs (non-strings, bad thresholds) refuse
 * instead of throwing.
 */
export function applyStrReplace(source: string, req: PatchRequest): PatchResult {
  // --- Totality guards: garbage in ⇒ honest refusal, never a throw ----------
  const rawSource: unknown = source;
  if (typeof rawSource !== "string") {
    return refuse(`source is not a string (got ${typeof rawSource}) — nothing to patch.`, 0);
  }
  const rawRequest: unknown = req;
  if (rawRequest === null || typeof rawRequest !== "object") {
    return refuse(`request is not an object (got ${typeof rawRequest}) — nothing to patch.`, 0);
  }
  const { oldStr: rawOld, newStr: rawNew, fuzzy: rawFuzzy } = rawRequest as {
    oldStr?: unknown;
    newStr?: unknown;
    fuzzy?: unknown;
  };
  if (typeof rawOld !== "string" || typeof rawNew !== "string") {
    return refuse(
      `oldStr and newStr must both be strings (got oldStr: ${typeof rawOld}, newStr: ${typeof rawNew}).`,
      0,
    );
  }
  if (rawOld.length === 0) {
    return refuse("oldStr is empty — an empty needle has no unique match; refusing (never replace-all).", 0);
  }
  let threshold: number | null = null;
  if (rawFuzzy !== undefined) {
    const fuzzy = rawFuzzy as { threshold?: unknown } | null;
    const value = fuzzy === null || typeof fuzzy !== "object" ? undefined : fuzzy.threshold;
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 1) {
      return refuse(
        `fuzzy.threshold must be a finite number in (0, 1] (got ${String(value)}) — refusing an unbounded fuzzy level.`,
        0,
        { threshold: typeof value === "number" && Number.isFinite(value) ? value : null },
      );
    }
    threshold = value;
  }
  if (rawOld === rawNew) {
    return refuse("oldStr and newStr are identical — a no-op is not an edit; refusing to report one.", 0);
  }

  // --- Exact scan (all occurrences; overlapping starts counted honestly) ----
  const indices: number[] = [];
  let matches = 0;
  let firstIndex = -1;
  let at = rawSource.indexOf(rawOld);
  while (at !== -1) {
    if (matches === 0) firstIndex = at;
    matches += 1;
    if (indices.length < PATCH_MAX_LISTED) indices.push(at);
    at = rawSource.indexOf(rawOld, at + 1);
  }

  if (matches === 1) {
    return {
      ok: true,
      kind: "exact",
      text: rawSource.slice(0, firstIndex) + rawNew + rawSource.slice(firstIndex + rawOld.length),
      diff: buildDiff(lineAtIndex(rawSource, firstIndex), rawOld, rawNew),
      matches: 1,
      score: 1,
      threshold: null,
    };
  }

  if (matches > 1) {
    const lines = indices.map((index) => lineAtIndex(rawSource, index));
    const listed = lines.length < matches ? `${lines.join(", ")}, …` : lines.join(", ");
    return refuse(
      `oldStr matches ${matches} times — refusing; a unique match is required (candidate lines: ${listed}).`,
      matches,
      { lines },
    );
  }

  // --- Zero exact matches: the opt-in fuzzy level, or an honest refusal -----
  if (threshold !== null) {
    const { best, second, hit } = fuzzyScan(rawSource, rawOld, threshold);
    if (hit !== null) {
      const windowText = hit.text;
      return {
        ok: true,
        kind: "fuzzy",
        text: rawSource.slice(0, hit.index) + rawNew + rawSource.slice(hit.index + windowText.length),
        diff: buildDiff(hit.line, windowText, rawNew),
        matches: 0,
        score: hit.score,
        threshold,
      };
    }
    if (best !== null && second !== null && best.score >= threshold && best.score === second.score) {
      return refuse(
        `fuzzy tie at score ${best.score.toFixed(4)} (lines ${best.line} and ${second.line}) — refusing an ambiguous fuzzy match.`,
        0,
        { bestScore: best.score, bestLine: best.line, threshold },
      );
    }
    if (best === null) {
      return refuse(
        `no exact match for oldStr and fuzzy did not land: no candidate window exists (the needle is longer than the source) at threshold ${threshold} — fuzzy was attempted; refusing rather than guessing.`,
        0,
        { threshold },
      );
    }
    return refuse(
      `no exact match for oldStr and fuzzy did not land: best ${best.score.toFixed(4)} at line ${best.line} < threshold ${threshold} — refusing rather than guessing.`,
      0,
      { bestScore: best.score, bestLine: best.line, threshold },
    );
  }

  return refuse("no exact match for oldStr (0 occurrences) — refusing; a unique match is required.", 0);
}
