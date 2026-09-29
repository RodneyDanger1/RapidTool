/**
 * settle.ts — 312 C3 (fixes/312 §1; CF-SE2-1 / SE2 mock-arm hang): bounded
 * settlement + trust gates for awaits that must never be able to hang.
 *
 * TWO shapes, measured on this repo (probe: replicated the TanStack
 * import-protection mock byte-for-byte; see fixes/312 for the transcript):
 *
 *  1. A REAL promise that never settles (a fetch with no response, a dropped
 *     wire call). Boundable: racing it against a macrotask timer fires the
 *     timer on schedule (`settleWithin`). This is the never-settling-FETCH
 *     class the parent asked to pin.
 *
 *  2. The import-protection mock proxy (denied `*.server.*` specifiers on a
 *     client host). NOT boundable in-process: its `then` trap returns a fresh
 *     thenable each adoption round, so awaiting it spins the MICROTASK queue
 *     forever and starves the macrotask queue — timers can never fire
 *     (measured: `timeout 10 node probe` → EXIT=124, timer never delivered).
 *     No AbortController, Promise.race or setTimeout can rescue an await on
 *     it. The one safe move is to REFUSE it before any await — which is why
 *     this module carries the trust gates (`isTrustedCallable`,
 *     `isBareNodeHost`): property READS on the mock are safe (they only mint
 *     another proxy), only `then`/`await` adoption starves.
 *
 * Policy in one sentence (SE2 CF-SE2-1): never trust a runtime-assembled
 * `.server.` specifier on a host where the import-protection plugin can rewrite
 * it to a mock — refuse by HOST check, then trust-check whatever was resolved,
 * then bound the call.
 *
 * Pure + dependency-free → safe for both server-only and client-safe imports.
 */

/** Default settle window when a caller passes no (or a junk) ms. */
export const SETTLE_DEFAULT_MS = 120_000;

export type SettleResult<T> =
  | { ok: true; value: T }
  | { ok: false; timedOut: true; ms: number }
  | { ok: false; timedOut: false; ms: number; error: unknown };

function normalizeMs(ms: number): number {
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? Math.floor(ms) : SETTLE_DEFAULT_MS;
}

/**
 * True when this module runs on a bare Node host (CLI / headless / tests) —
 * the host where a runtime-assembled `*.server.` specifier resolves to the
 * REAL module. The mirror of wild-review.ts's host guard; the TanStack
 * import-protection plugin only mocks imports in CLIENT bundles, so this is
 * the one discriminator the engine trusts before importing those specifiers.
 */
export function isBareNodeHost(): boolean {
  return typeof process !== "undefined" && typeof process.versions?.node === "string";
}

/**
 * True when `value` is a plain callable worth trusting. The import-protection
 * mock is a Proxy over a function whose EVERY property read — `.name`
 * included — yields another callable proxy, while every real function's
 * `.name` is a string. So one property read (safe on the mock — no await) is
 * enough to tell them apart. Anything non-callable returns false.
 */
export function isTrustedCallable(value: unknown): boolean {
  if (typeof value !== "function") return false;
  return typeof (value as { name?: unknown }).name === "string";
}

/**
 * Settle `value` within `ms` — a bounded await for values that MIGHT never
 * settle. Returns a discriminated result and never rejects:
 *   - value settles → `{ ok: true, value }`;
 *   - value rejects → `{ ok: false, timedOut: false, error }` (the caller
 *     keeps its existing error classification);
 *   - the window elapses first → `{ ok: false, timedOut: true, ms }`.
 *
 * Mock-shaped callables are REFUSED before adoption (see the module doc): a
 * callable proxy whose `.name` is not a string is returned as a
 * `timedOut: false` refusal — `then` is never read on it, so the microtask
 * starvation can never start. This makes `settleWithin` the LAST line of
 * defense behind the host gate, not a password for awaiting mocks.
 *
 * The window timer stays REF'd on purpose: when the awaited value never
 * settles, this timer is the only thing that will ever wake the caller, so it
 * must be allowed to fire (an unref'd timer is dropped when it is the last
 * pending work — the coded failure would never arrive). It is cleared the
 * moment the value settles, so a bound never outlives its call.
 */
export function settleWithin<T>(value: PromiseLike<T> | T, ms: number): Promise<SettleResult<T>> {
  const bound = normalizeMs(ms);
  if (typeof value === "function" && !isTrustedCallable(value)) {
    return Promise.resolve({
      ok: false,
      timedOut: false,
      ms: bound,
      error: new Error(
        "settleWithin: refused an untrusted callable proxy (import-protection mock shape) — it was never awaited",
      ),
    });
  }
  return new Promise<SettleResult<T>>((resolve) => {
    let settled = false;
    // prefer-const (C-wave lint): the timer is assigned exactly once — declare it
    // before the closure (both callbacks fire after both consts exist; TDZ-safe).
    const timer = setTimeout(() => finish({ ok: false, timedOut: true, ms: bound }), bound);
    const finish = (result: SettleResult<T>): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    Promise.resolve(value).then(
      (v) => finish({ ok: true, value: v }),
      (error) => finish({ ok: false, timedOut: false, ms: bound, error }),
    );
  });
}
