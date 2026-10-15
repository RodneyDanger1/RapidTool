// ---------------------------------------------------------------------------
// synthesis-policy.ts — the opt-in best-of-N synthesis policy (fixes/343-1).
//
// The measured P6 blocker is a model reply that is structure-clean and
// brief-fit-clean but fails the emitted tree's own strict `tsc` (or brief-fit),
// and gets exactly ONE corrective re-prompt before refusal. Top agent factories
// raise this with best-of-N sampling + a deterministic selector (SWE-agent's
// ChooserRetryLoop "picks the best of N trajectories"; AlphaCode sample-and-
// filter; CodeT selects by test agreement). This module owns the DETERMINISTIC
// half of that policy — the count resolution and the lazy selection control
// flow — so it is unit-testable with no model and no compiler. The gates
// themselves (structure -> brief-fit -> pre-seal typecheck) stay in
// codegen.server.ts, their single owner.
//
// Two distinct policies share the `P6_SYNTH_CANDIDATES` knob:
//
//   • The PRIMARY single-module best-of-N and the whole-tree pre-seal offender
//     resample stay OPT-IN (`resolveSynthesisCandidates`, default 1) — unchanged
//     from 343-1.
//   • The chunked P6 tree's per-chunk + fail-fast offender resample is now ARMED
//     BY DEFAULT (`resolveChunkResampleCandidates`, default 3, fixes/346 lane S4;
//     S5 raised it 2→3 for reliability). The campaign #2 journals measure the
//     dominant P6 stall as a per-chunk deterministic-validation refusal, so this
//     is the lever T1 measured opt-in (`P6_SYNTH_CANDIDATES=2`). Two samples
//     still read green on one sweep and red on the next (same brief), so the
//     armed default carries one more independent sample. It is lazy/Pareto: a
//     first sample that already clears the deterministic validator pays nothing,
//     so the extra spend lands only on a stochastic refusal.
//
// The explicit OPT-OUT `P6_SYNTH_CANDIDATES=1` (or `deps.candidates: 1`) restores
// the byte-identical legacy single-sample path for BOTH policies.
// ---------------------------------------------------------------------------

/** 1 candidate = the legacy single-sample path (primary best-of-N + whole-tree resample). */
export const P6_SYNTH_CANDIDATES_DEFAULT = 1;
/** Hard cap on samples per unit of synthesis — the cost-honesty bound. */
export const P6_SYNTH_CANDIDATES_MAX = 4;

/**
 * fixes/346 (lane T1): the bounded per-chunk RESAMPLE count for the chunked P6
 * tree. The campaign #2 journals measure the dominant stall as a per-chunk
 * deterministic-validation refusal (`typeSignature functions not exported` /
 * `cross-chunk duplicate declaration`) at chunk 2-3 of an 8-11 chunk plan —
 * after a single sample plus one class repair, with no independent second
 * attempt. This is ARMED BY DEFAULT (fixes/346 lane S4): a refused chunk is
 * resampled with the SAME primary prompt up to this many total candidates, the
 * deterministic validator being the selector. fixes/346 lane S5 raised the armed
 * default 2→3: a two-sample sweep still read 0/4 on one run and 3/4 on the next
 * over the SAME briefs, and the journals show the fatal refusal is a chunk where
 * BOTH samples failed — one more independent sample is the bounded reliability
 * lever. `P6_SYNTH_CANDIDATES=1` (or `deps.candidates: 1`) keeps the legacy
 * single-sample path byte-identical.
 */
export const P6_SYNTH_CHUNK_RETRY_CANDIDATES = 3;

/**
 * Resolve the primary best-of-N / whole-tree resample count. `explicit` (a
 * caller's `deps.candidates`) wins over `env` (`P6_SYNTH_CANDIDATES`); anything
 * non-integer, non-positive, or absent falls back to
 * {@link P6_SYNTH_CANDIDATES_DEFAULT} (1 — the legacy single sample), and every
 * value is clamped to {@link P6_SYNTH_CANDIDATES_MAX}. Pure + deterministic —
 * never throws on a hostile env string.
 */
export function resolveSynthesisCandidates(explicit?: unknown, env?: unknown): number {
  const source = explicit !== undefined && explicit !== null ? explicit : env;
  const n =
    typeof source === "number"
      ? source
      : typeof source === "string" && /^\d+$/.test(source.trim())
        ? Number(source.trim())
        : Number.NaN;
  if (!Number.isFinite(n)) return P6_SYNTH_CANDIDATES_DEFAULT;
  const whole = Math.floor(n);
  if (whole < 1) return P6_SYNTH_CANDIDATES_DEFAULT;
  return Math.min(whole, P6_SYNTH_CANDIDATES_MAX);
}

/**
 * Resolve the chunk-level (per-chunk acceptance + fail-fast offender) resample
 * count. Same precedence as {@link resolveSynthesisCandidates} — an explicit
 * `deps.candidates` wins over the `P6_SYNTH_CANDIDATES` env — but the ABSENT
 * default is {@link P6_SYNTH_CHUNK_RETRY_CANDIDATES} (3): this is the armed-by-
 * default lane. An explicit `1` (env or `deps.candidates`) is the opt-out and
 * yields 1, exactly the legacy single-sample path; every other value is clamped
 * to `1..P6_SYNTH_CANDIDATES_MAX`. Pure + deterministic — never throws.
 */
export function resolveChunkResampleCandidates(explicit?: unknown, env?: unknown): number {
  const source = explicit !== undefined && explicit !== null ? explicit : env;
  if (source === undefined || source === null) return P6_SYNTH_CHUNK_RETRY_CANDIDATES;
  const n =
    typeof source === "number"
      ? source
      : typeof source === "string" && /^\d+$/.test(source.trim())
        ? Number(source.trim())
        : Number.NaN;
  if (!Number.isFinite(n)) return P6_SYNTH_CHUNK_RETRY_CANDIDATES;
  const whole = Math.floor(n);
  if (whole < 1) return P6_SYNTH_CHUNK_RETRY_CANDIDATES;
  return Math.min(whole, P6_SYNTH_CANDIDATES_MAX);
}

/** One candidate's verdict against every gate the caller can evaluate. */
export type CandidateEvaluation = { passed: boolean; reason: string };

export type BestOfNResult<T> = {
  /** 0-based index of the first candidate that cleared every gate, else null. */
  winner: number | null;
  /** The winning candidate, or null when none passed (the caller keeps its legacy fallback). */
  chosen: T | null;
  /** One line per evaluated candidate, naming why it won/lost — the `p6.synthesis.candidates` detail. */
  outcomes: string[];
};

/**
 * fixes/348: opt-in quality-directed selection. `rank` scores a candidate the
 * caller has ALREADY judged (0..1 brief-vocabulary coverage, higher is better);
 * among candidates that clear every gate the highest rank wins (ties → the
 * earliest), and the search stops early once a passing candidate reaches
 * `rankTarget` (default 1). Absent ⇒ the legacy lazy first-pass behavior stays
 * byte-identical.
 */
export type BestOfNOptions<T> = {
  rank?: (candidate: T, index: number) => number;
  rankTarget?: number;
};

/**
 * Lazy best-of-N selection. Candidate `i` is produced on demand by `produce`
 * (index 0 is expected to be the caller's already-produced primary sample) and
 * judged by `evaluate`; production STOPS at the first candidate that passes
 * every gate (or, with {@link BestOfNOptions.rank}, at the first passing
 * candidate that reaches `rankTarget`). When none passes, every candidate up to
 * the (clamped) `count` is tried and `winner` is null so the caller can fall
 * back to its existing bounded-repair path — selection is never worse than not
 * selecting.
 *
 * `count <= 1` produces exactly one candidate (the legacy single sample) and
 * never calls `produce` past index 0. `produce` returning null (a failed or
 * budget-stopped sample) counts as a lost candidate, not a crash.
 */
export async function selectBestOfN<T>(
  count: number,
  produce: (index: number) => Promise<T | null>,
  evaluate: (candidate: T, index: number) => Promise<CandidateEvaluation>,
  options: BestOfNOptions<T> = {},
): Promise<BestOfNResult<T>> {
  const capped = Math.max(1, Math.min(Math.floor(count), P6_SYNTH_CANDIDATES_MAX));
  const rank = options.rank;
  const rankTarget =
    typeof options.rankTarget === "number" && Number.isFinite(options.rankTarget) ? options.rankTarget : 1;
  const outcomes: string[] = [];
  // fixes/348: with a rank, track the best PASSING candidate so far (the tie-break).
  let best: { index: number; candidate: T; score: number } | null = null;
  const scoreOf = (candidate: T, index: number): number => {
    if (rank === undefined) return 0;
    const s = rank(candidate, index);
    return typeof s === "number" && Number.isFinite(s) ? s : 0;
  };
  for (let i = 0; i < capped; i++) {
    const candidate = await produce(i);
    if (candidate === null) {
      outcomes.push(`candidate ${i + 1}: not produced`);
      continue;
    }
    const verdict = await evaluate(candidate, i);
    if (rank === undefined) {
      outcomes.push(`candidate ${i + 1}: ${verdict.passed ? "selected" : "rejected"} — ${verdict.reason}`);
      if (verdict.passed) return { winner: i, chosen: candidate, outcomes };
      continue;
    }
    const score = scoreOf(candidate, i);
    if (verdict.passed && (best === null || score > best.score)) {
      best = { index: i, candidate, score };
    }
    outcomes.push(`candidate ${i + 1}: ${verdict.passed ? "passed" : "rejected"} — ${verdict.reason} (brief coverage ${score.toFixed(2)})`);
    if (best !== null && best.index === i && score >= rankTarget) break;
  }
  if (best === null) return { winner: null, chosen: null, outcomes };
  // Relabel the winner's own line "selected"; a later passing candidate that did
  // not win names why (a tie-break, never a silent pick).
  for (let i = 0; i < outcomes.length; i++) {
    outcomes[i] = outcomes[i]!.replace(/^candidate (\d+): passed —/, (_m, n) =>
      Number(n) === best!.index + 1 ? `candidate ${n}: selected —` : `candidate ${n}: passed, not selected —`,
    );
  }
  return { winner: best.index, chosen: best.candidate, outcomes };
}

/**
 * The bounded, single-line detail for the `p6.synthesis.candidates` event —
 * names the unit, the sample budget, the winning candidate (or none), and why
 * every candidate was selected or rejected.
 *
 * fixes/346 final wave (lane S, V5/I-A): `extraTokens` is the resample call-
 * usage delta the caller measured for this candidate block; when present the
 * row carries a trailing ` · tokens <int>` so the acceptance/doctor consumers
 * can attribute the resample spend instead of recording `extraTokens:null`.
 * Absent (the legacy callers/tests) ⇒ the byte-identical row, no suffix.
 */
export function candidatesLogDetail(
  unit: string,
  count: number,
  winner: number | null,
  outcomes: readonly string[],
  extraTokens?: number,
): string {
  const winnerText = winner === null ? "none" : String(winner + 1);
  const head = `${unit} · candidates ${count} · winner ${winnerText} · `;
  // The token suffix is reserved out of the 1000-char budget so a long outcome
  // tail can never truncate it away (the consumer parses it as a suffix).
  const tokenText =
    typeof extraTokens === "number" && Number.isFinite(extraTokens) && extraTokens >= 0
      ? ` · tokens ${Math.floor(extraTokens)}`
      : "";
  const body = outcomes.join(" | ");
  const budget = Math.max(0, 1000 - head.length - tokenText.length);
  return `${head}${body.slice(0, budget)}${tokenText}`;
}

// ---------------------------------------------------------------------------
// A9/PR-15 — adaptive chunk sizing.
//
// Chunk size used to be the fixed P6_SYNTH_CHUNK_SIZE (=8) regardless of how
// much signature text a chunk carries: eight 120-char signatures is a very
// different output budget from eight 30-char ones. Size a chunk by the rendered
// signature text: `perChunk = clamp(floor(budget / avgSigChars), 4, 12)`.
// `P6_SYNTH_MODULE_BUDGET` is the rendered-signature character budget for one
// call; the default reproduces the legacy 8 for typical corpus signatures.
// ---------------------------------------------------------------------------

/** Floor/ceiling on a chunk's signature count (cost + coherence bound).
 *  fixes/349-P6: the floor is 2 (was 4). The measured wall is a chunk that
 *  "does not export declared functions": an import-forbidden, self-contained
 *  module asked to export 4+ functions whose types it may not redeclare slips
 *  more often than one asked for 2. A 2-export chunk is the achievable unit. */
export const P6_SYNTH_CHUNK_MIN = 2;
export const P6_SYNTH_CHUNK_MAX = 12;
/** Rendered-signature character budget for one synthesis call. */
export const P6_SYNTH_MODULE_BUDGET = 480;

/**
 * fixes/349-P6: the ESTIMATED emitted-output character budget for one synthesis
 * call. `P6_SYNTH_MODULE_BUDGET` above sizes a chunk by signature TEXT, which
 * cannot see how much code a signature implies — ten short signature lines can
 * still demand ten full function bodies. This bounds the estimated OUTPUT so a
 * dense spec cannot overload one call. 9 600 chars ≈ 160 lines, comfortably
 * inside the P6_MODULE_MAX_CHARS envelope with room for the JSON wrapper.
 */
export const P6_SYNTH_OUTPUT_BUDGET_CHARS = 9_600;
/** Estimated emitted chars a single function contributes: a body baseline plus a
 *  term proportional to its signature text (a longer signature implies a richer
 *  shape). Deterministic; the constants are corpus-calibrated to keep the legacy
 *  chunk size for typical fixtures. */
export const P6_SYNTH_FN_OUTPUT_BASE = 900;
export const P6_SYNTH_FN_OUTPUT_PER_SIG_CHAR = 4;

/** Estimated emitted chars one signature implies. Pure; never throws. */
export function estimatedFunctionOutputChars(signature: string): number {
  const s = typeof signature === "string" ? signature : "";
  return P6_SYNTH_FN_OUTPUT_BASE + P6_SYNTH_FN_OUTPUT_PER_SIG_CHAR * s.length;
}

/** Summed estimated output of a signature list (blank/non-string rows skipped). */
export function estimatedChunkOutputChars(signatures: readonly string[]): number {
  const sigs = (Array.isArray(signatures) ? signatures : []).filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );
  return sigs.reduce((sum, s) => sum + estimatedFunctionOutputChars(s), 0);
}

/**
 * Largest signature count whose ESTIMATED output fits `budget`, clamped to the
 * [MIN, MAX] band. Greedy left-to-right (expand order), so the split is
 * deterministic and a chunk never depends on a later chunk. No signatures ⇒ the
 * legacy default 8; a non-positive/non-finite budget falls back to the default.
 * Pure; never throws.
 */
export function outputBoundedChunkSize(
  signatures: readonly string[],
  budget: number = P6_SYNTH_OUTPUT_BUDGET_CHARS,
): number {
  const sigs = (Array.isArray(signatures) ? signatures : []).filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );
  if (sigs.length === 0) return 8;
  const b = Number.isFinite(budget) && budget > 0 ? budget : P6_SYNTH_OUTPUT_BUDGET_CHARS;
  let acc = 0;
  let n = 0;
  for (const s of sigs) {
    const cost = estimatedFunctionOutputChars(s);
    if (n > 0 && acc + cost > b) break;
    acc += cost;
    n += 1;
  }
  return Math.max(P6_SYNTH_CHUNK_MIN, Math.min(P6_SYNTH_CHUNK_MAX, n));
}

/**
 * fixes/349-P6: the chunk size the planner uses — the TIGHTER of the
 * signature-text adaptive size (`adaptiveChunkSize`) and the estimated-output
 * bound (`outputBoundedChunkSize`). Bounding by estimated output instead of a
 * fixed export count is what keeps a large chunk achievable. Pure; identical
 * inputs ⇒ identical size, so the plan stays deterministic.
 */
export function planningChunkSize(
  signatures: readonly string[],
  opts: { signatureBudget?: number; outputBudget?: number } = {},
): number {
  return Math.min(
    adaptiveChunkSize(signatures, opts.signatureBudget),
    outputBoundedChunkSize(signatures, opts.outputBudget),
  );
}

/**
 * Signature count for one chunk: `clamp(floor(budget / avgSigChars), 4, 12)`,
 * where `avgSigChars` is the mean length of the non-blank rendered signatures.
 * No signatures (or a non-positive budget) ⇒ the legacy default 8. Pure +
 * deterministic; never throws on hostile input.
 */
export function adaptiveChunkSize(signatures: readonly string[], budget: number = P6_SYNTH_MODULE_BUDGET): number {
  const sigs = (Array.isArray(signatures) ? signatures : []).filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  );
  if (sigs.length === 0) return 8;
  const avg = sigs.reduce((sum, s) => sum + s.length, 0) / sigs.length;
  if (!Number.isFinite(avg) || avg <= 0) return 8;
  const b = Number.isFinite(budget) && budget > 0 ? budget : P6_SYNTH_MODULE_BUDGET;
  const sized = Math.floor(b / avg);
  return Math.max(P6_SYNTH_CHUNK_MIN, Math.min(P6_SYNTH_CHUNK_MAX, sized));
}
