// ---------------------------------------------------------------------------
// bounded-int.ts — W40 · N4: the ONE bounded-integer knob sanitizer.
//
// `boundedInt` was copied byte-for-byte into `tavily.server.ts` and
// `websearch.server.ts` (W3's audit class: duplicated logic that drifts).
// One shared helper now; both search providers import it. Pure — no fs, no
// env, no provider vocabulary, so it stays trivially testable and safe for
// either server-only or client-side import.
// ---------------------------------------------------------------------------

/**
 * Sanitize a caller knob: a finite integer in [min, max], else the fallback.
 * A hostile/typo'd value (NaN, Infinity, -5, 1e9) never reaches the wire.
 */
export function boundedInt(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === "number" && Number.isFinite(v) && v >= min
    ? Math.min(Math.max(Math.floor(v), min), max)
    : fallback;
}
