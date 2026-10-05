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
//     BY DEFAULT (`resolveChunkResampleCandidates`, default 2, fixes/346 lane S4).
//     The campaign #2 journals measure the dominant P6 stall as a per-chunk
//     deterministic-validation refusal, so this is the lever T1 measured opt-in
//     (`P6_SYNTH_CANDIDATES=2`). It is lazy/Pareto: a first sample that already
//     clears the deterministic validator pays nothing, so the extra spend lands
//     only on a stochastic refusal.
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
 * deterministic validator being the selector. `P6_SYNTH_CANDIDATES=1` (or
 * `deps.candidates: 1`) keeps the legacy single-sample path byte-identical.
 */
export const P6_SYNTH_CHUNK_RETRY_CANDIDATES = 2;

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
 * default is {@link P6_SYNTH_CHUNK_RETRY_CANDIDATES} (2): this is the armed-by-
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
 * Lazy best-of-N selection. Candidate `i` is produced on demand by `produce`
 * (index 0 is expected to be the caller's already-produced primary sample) and
 * judged by `evaluate`; production STOPS at the first candidate that passes
 * every gate. When none passes, every candidate up to the (clamped) `count` is
 * tried and `winner` is null so the caller can fall back to its existing
 * bounded-repair path — selection is never worse than not selecting.
 *
 * `count <= 1` produces exactly one candidate (the legacy single sample) and
 * never calls `produce` past index 0. `produce` returning null (a failed or
 * budget-stopped sample) counts as a lost candidate, not a crash.
 */
export async function selectBestOfN<T>(
  count: number,
  produce: (index: number) => Promise<T | null>,
  evaluate: (candidate: T, index: number) => Promise<CandidateEvaluation>,
): Promise<BestOfNResult<T>> {
  const capped = Math.max(1, Math.min(Math.floor(count), P6_SYNTH_CANDIDATES_MAX));
  const outcomes: string[] = [];
  for (let i = 0; i < capped; i++) {
    const candidate = await produce(i);
    if (candidate === null) {
      outcomes.push(`candidate ${i + 1}: not produced`);
      continue;
    }
    const verdict = await evaluate(candidate, i);
    outcomes.push(`candidate ${i + 1}: ${verdict.passed ? "selected" : "rejected"} — ${verdict.reason}`);
    if (verdict.passed) return { winner: i, chosen: candidate, outcomes };
  }
  return { winner: null, chosen: null, outcomes };
}

/**
 * The bounded, single-line detail for the `p6.synthesis.candidates` event —
 * names the unit, the sample budget, the winning candidate (or none), and why
 * every candidate was selected or rejected.
 */
export function candidatesLogDetail(unit: string, count: number, winner: number | null, outcomes: readonly string[]): string {
  const winnerText = winner === null ? "none" : String(winner + 1);
  return `${unit} · candidates ${count} · winner ${winnerText} · ${outcomes.join(" | ")}`.slice(0, 1000);
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

/** Floor/ceiling on a chunk's signature count (cost + coherence bound). */
export const P6_SYNTH_CHUNK_MIN = 4;
export const P6_SYNTH_CHUNK_MAX = 12;
/** Rendered-signature character budget for one synthesis call. */
export const P6_SYNTH_MODULE_BUDGET = 480;

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
