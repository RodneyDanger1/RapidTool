/**
 * Token ledger — measured spend vs a hard session cap.
 *
 * DeepSeek already returns `usage.prompt_tokens` / `completion_tokens`.
 * Callers used to drop that. This module is the SessionBudgetExceeded /
 * NoMoneyException class: when a cap is set and spend exceeds it, throw
 * (never mint green after exhaustion).
 *
 * Unmetered path (no RAPIDTOOL_TOKEN_CAP / unset / blank / a non-integer or
 * non-decimal spelling / 0 / NaN / non-positive):
 *   tokenCapFromEnv → undefined
 *   wouldExceed / assertWithinBudget / recordSpendWithinCap → no-op throws
 *   (byte-identical to pre-ledger call sites when the env var is absent).
 * Missing usage → recordSpend is a no-op on the numbers (does not bump calls).
 *
 * Cap semantics (199): spend that **lands exactly on** the cap is still ok;
 * only spend **past** the cap exhausts (`>` not `>=` after the add).
 * assertWithinBudget is the pre-call gate: spent already `>=` cap means the
 * next call would start past budget.
 *
 * Parent wiring (312 C5, corrected for accuracy): the codegen synth paths
 * meter through `accountSynthUsage` → recordSpend + the session-budget
 * cross-check. The ledger-object helpers here (wouldExceed / assertWithinBudget
 * / recordSpendWithinCap — all REAL exports, test-pinned) and the budget-object
 * seam (assertBudgetHeadroom / recordBudgetSpend, the runBudgetedCall family)
 * are the seam-callable API; the three ledger-object helpers have no production
 * call site today. CF-SE2-4's "non-existent recordSpendWithinCap" premise was
 * disproven on bytes (the function is exported below). Do not add
 * Project.tokenCap here (types.ts is parent).
 *
 * T-107.6 (dossier 107 §6 "Budgets that bind"): the ledger went cache-aware and
 * budget-threadable. `TokenSpend` / `TokenLedger` carry OPTIONAL cache fields
 * (cached prompt reads, cache writes, reasoning/thinking output) that
 * accumulate only when a sample actually reports them, so every legacy 3-key
 * ledger and every legacy `recordSpend` call keeps the exact pre-107.6 shape.
 * The `TokenBudget` seam helpers let ONE caller-owned ledger thread through
 * several seams (verify / chat / crew / …): `assertBudgetHeadroom` is the
 * pre-dispatch gate (refuse before the wire call), `recordBudgetSpend` records
 * the completed call's real usage and signals a cap crossing with
 * SessionBudgetExceeded so the seam can block the result — the spend itself is
 * NEVER clamped away (subagent.ts's "spend kept" rule; codegen.server.ts
 * `accountSynthUsage` is the same pattern). `estimateCostUsd` takes
 * CALLER-supplied per-1M prices: the dossier verified accounting MECHANISMS,
 * not dollar figures (107 §11), so no price catalog ships here.
 *
 * Landed surface (all additive): the cache fields (`cachedPromptTokens`,
 * `cacheWriteTokens`, `reasoningTokens`) on `TokenSpend` / `TokenLedger`,
 * `billableInputTokens`, `estimateCostUsd` + `TokenPrices`, and the
 * `TokenBudget` seam — `createTokenBudget`, `budgetCap`, `isBudgetExhausted`,
 * `assertBudgetHeadroom`, `recordBudgetSpend` — plus the A3 catch wrapper
 * (`runBudgetedCall` / `budgetStopRefusal`): a budget stop is a CODED stop at
 * the seam, never an unhandled throw an outer catch would classify as
 * RT_E_INTERNAL (226 A3 / D2.3). No default cap is set here — the cap stays
 * caller-supplied (unset env ⇒ unmetered, every helper a no-op).
 */
export class SessionBudgetExceeded extends Error {
  readonly code = "RT_E_BUDGET_EXHAUSTED" as const;
  readonly spent: number;
  readonly cap: number;
  constructor(spent: number, cap: number) {
    super(`Session token budget exhausted: spent ${spent} / cap ${cap}`);
    this.name = "SessionBudgetExceeded";
    this.spent = spent;
    this.cap = cap;
  }
}

/** Alias used by competitor-bar docs (NoMoneyException). */
export class NoMoneyException extends SessionBudgetExceeded {
  constructor(spent: number, cap: number) {
    super(spent, cap);
    this.name = "NoMoneyException";
  }
}

export type TokenSpend = {
  promptTokens: number;
  completionTokens: number;
  /**
   * 107 §6c (T-107.6; Codex `TokenUsage.cached_input_tokens`): prompt tokens
   * served FROM the provider's prompt cache. Treated as a SUBSET of
   * `promptTokens` when reported — `estimateCostUsd` re-prices it at the
   * cache-read price and never bills it twice. Optional/additive: a sample
   * that does not report it keeps the legacy 2-key spend shape.
   */
  cachedPromptTokens?: number;
  /**
   * 107 §6c (Codex `cache_write_input_tokens`): prompt tokens WRITTEN into
   * the provider's prompt cache. Treated as a subset of `promptTokens`
   * (billed at the cache-write price). Optional/additive.
   */
  cacheWriteTokens?: number;
  /**
   * 107 §6c (Codex `reasoning_output_tokens`): reasoning/thinking output
   * tokens — already part of `completionTokens` when the provider folds them
   * in. Carried for attribution only; never billed a second time.
   * Optional/additive.
   */
  reasoningTokens?: number;
};

/**
 * Cache-aware token ledger (T-107.6). The three base keys are the legacy
 * shape; the optional cache keys accumulate ONLY when a sample (or an earlier
 * sample) actually reported them — `emptyLedger()` and every legacy
 * `recordSpend` call keep the exact pre-107.6 3-key object byte-for-byte.
 */
export type TokenLedger = {
  promptTokens: number;
  completionTokens: number;
  calls: number;
  cachedPromptTokens?: number;
  cacheWriteTokens?: number;
  reasoningTokens?: number;
};

export function emptyLedger(): TokenLedger {
  return { promptTokens: 0, completionTokens: 0, calls: 0 };
}

export function totalTokens(ledger: TokenLedger): number {
  // K15 thrown-shape sweep (W-35): same guard idiom as isBudgetExhausted /
  // assertBudgetHeadroom — foreign input reads as EMPTY (0 tokens), never a
  // TypeError escape; token counts floor like every other count in this file.
  if (!ledger || typeof ledger !== "object") return 0;
  return floorNonNeg(ledger.promptTokens) + floorNonNeg(ledger.completionTokens);
}

function floorNonNeg(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/**
 * The env record for THIS host — `process.env` on Node, `{}` where `process`
 * is absent (browser bundles; R4-f03's non-Node hardening ⇒ unmetered, never
 * a ReferenceError escape).
 */
function defaultEnv(): Record<string, string | undefined> {
  return typeof process === "undefined" || !process.env ? {} : process.env;
}

/**
 * Parse RAPIDTOOL_TOKEN_CAP. Unset / blank / 0 / NaN / negative → undefined
 * (unmetered). ONLY a plain decimal integer (surrounding whitespace ignored)
 * is a cap — the extra JS-numeric spellings `Number()` also accepts are
 * refused as unmetered: `0x10` (silently 16), `1e99` (a finite cap that can
 * NEVER trigger while the envelope reports a cap in force), `12.9`, `+5`,
 * `Infinity`, `1_000` (M7-08, fixes/310_b3_boundary.md). A junk spelling
 * means NO cap is in force — the documented unmetered path, never a silently
 * different cap.
 */
export function tokenCapFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = defaultEnv(),
): number | undefined {
  const raw = env?.RAPIDTOOL_TOKEN_CAP;
  if (typeof raw !== "string") return undefined;
  const text = raw.trim();
  if (!/^\d+$/.test(text)) return undefined;
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** True when no positive finite cap is in force (unmetered / no-op path). */
export function isUnmetered(cap: number | null | undefined): boolean {
  return cap == null || !Number.isFinite(cap) || cap <= 0;
}

/** The optional accumulator keys added by T-107.6 — one ordered list so every
 *  accumulation/mutation path treats the three fields identically. */
const CACHE_LEDGER_FIELDS = [
  "cachedPromptTokens",
  "cacheWriteTokens",
  "reasoningTokens",
] as const;

/**
 * Merge one optional cache field: accumulate when the spend reports it OR the
 * ledger already carries it (sticky — a later sample without cache telemetry
 * never erases an accumulated count), otherwise leave the key absent so the
 * legacy 3-key ledger shape survives byte-for-byte. Non-finite / negative
 * values floor to 0 like every other token count.
 */
function mergeCacheField(
  ledgerValue: number | undefined,
  spendValue: unknown,
): number | undefined {
  // "Reported" = the spend carries a NUMBER for the field (NaN/negatives floor
  // to 0 like every other token count); any other shape is not a report.
  const reported = typeof spendValue === "number";
  if (ledgerValue === undefined && !reported) return undefined;
  return floorNonNeg(ledgerValue) + floorNonNeg(spendValue);
}

/** Append one API usage blob. Missing spend is a no-op (does not bump calls).
 *  T-107.6: the optional cache fields accumulate only when reported. */
export function recordSpend(ledger: TokenLedger, spend: TokenSpend | null | undefined): TokenLedger {
  if (!spend || typeof spend !== "object") return ledger;
  const next: TokenLedger = {
    promptTokens: ledger.promptTokens + floorNonNeg(spend.promptTokens),
    completionTokens: ledger.completionTokens + floorNonNeg(spend.completionTokens),
    calls: ledger.calls + 1,
  };
  for (const field of CACHE_LEDGER_FIELDS) {
    const merged = mergeCacheField(ledger[field], spend[field]);
    if (merged !== undefined) next[field] = merged;
  }
  return next;
}

/**
 * Split a spend/ledger's prompt tokens into the three billed input buckets
 * (T-107.6, 107 §6c): cache reads first, then cache writes, then the rest at
 * the full input price. `cachedPromptTokens` / `cacheWriteTokens` are subset
 * counts when reported, so every bucket is clamped to the prompt total — the
 * bill can never exceed the reported prompt tokens (over-reported cache
 * counts floor away instead of double-billing). Pure.
 */
function inputBuckets(spend: TokenSpend | TokenLedger): {
  cacheRead: number;
  cacheWrite: number;
  full: number;
} {
  const prompt = floorNonNeg(spend.promptTokens);
  const cacheRead = Math.min(prompt, floorNonNeg(spend.cachedPromptTokens));
  const cacheWrite = Math.min(prompt - cacheRead, floorNonNeg(spend.cacheWriteTokens));
  return { cacheRead, cacheWrite, full: prompt - cacheRead - cacheWrite };
}

/**
 * Prompt tokens billed at the FULL input price — the prompt total minus the
 * cache-read and cache-write slices (subset semantics above). Zero for a
 * missing/empty spend; never negative.
 */
export function billableInputTokens(
  spend: TokenSpend | TokenLedger | null | undefined,
): number {
  if (!spend || typeof spend !== "object") return 0;
  return inputBuckets(spend).full;
}

/**
 * Caller-supplied per-1M-token prices in USD (T-107.6; 107 §11 — the dossier
 * verified accounting MECHANISMS, not dollar figures, so NO price catalog
 * ships here: the caller passes real prices or nothing is estimated).
 * Missing optional cache prices default to `inputPerMillion`, so a prices
 * object without cache lines yields exactly the plain input+output estimate.
 */
export type TokenPrices = {
  inputPerMillion: number;
  outputPerMillion: number;
  /** USD per 1M cached-prompt (read) tokens; defaults to `inputPerMillion`. */
  cachedInputPerMillion?: number;
  /** USD per 1M cache-write input tokens; defaults to `inputPerMillion`. */
  cacheWritePerMillion?: number;
};

/** Non-negative finite price → itself; absent/invalid/non-positive → fallback. */
function pricePerMillion(price: number | undefined, fallback = 0): number {
  return typeof price === "number" && Number.isFinite(price) && price > 0 ? price : fallback;
}

/**
 * Estimated USD cost of one spend/ledger under caller-supplied prices:
 * `full·input + cacheRead·cachedInput + cacheWrite·cacheWrite +
 * completion·output` (all per-1M, divided once). With no cache prices and no
 * cache counts this is exactly `(prompt·input + completion·output)/1e6` —
 * the plain two-part estimate. Deterministic; never throws (hostile prices
 * floor to 0, hostile cache counts floor to 0 via the bucket clamp).
 */
export function estimateCostUsd(
  spend: TokenSpend | TokenLedger | null | undefined,
  prices: TokenPrices,
): number {
  if (!spend || typeof spend !== "object") return 0;
  const input = pricePerMillion(prices?.inputPerMillion);
  const output = pricePerMillion(prices?.outputPerMillion);
  const cached = pricePerMillion(prices?.cachedInputPerMillion, input);
  const writes = pricePerMillion(prices?.cacheWritePerMillion, input);
  const buckets = inputBuckets(spend);
  const completion = floorNonNeg(spend.completionTokens);
  return (
    (buckets.full * input +
      buckets.cacheRead * cached +
      buckets.cacheWrite * writes +
      completion * output) /
    1_000_000
  );
}

// ---------------------------------------------------------------------------
// TokenBudget seam (T-107.6): ONE caller-owned ledger threaded through seams
// ---------------------------------------------------------------------------

/**
 * Caller-owned session budget: one ledger + the effective hard cap. A caller
 * creates ONE `createTokenBudget(...)` and threads the SAME object through
 * several LLM seams (verify / chat / crew / …) — each seam gates dispatch
 * with `assertBudgetHeadroom` and records the completed call's real usage
 * with `recordBudgetSpend`. `cap === undefined` = unmetered (every helper is
 * a no-op, byte-identical to the pre-107.6 call sites).
 */
export type TokenBudget = {
  ledger: TokenLedger;
  /** Effective hard cap in tokens; `undefined` = unmetered. */
  cap: number | undefined;
};

/**
 * Normalize a budget OR a raw cap to the effective cap: unmetered/invalid
 * (`undefined`/`null`/0/NaN/negative) → `undefined`; positive finite numbers
 * floor to an int. Pure — the one place budget caps get their shape.
 */
export function budgetCap(
  budgetOrCap: TokenBudget | number | null | undefined,
): number | undefined {
  const raw = budgetOrCap && typeof budgetOrCap === "object" ? budgetOrCap.cap : budgetOrCap;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return undefined;
  return Math.floor(raw);
}

/**
 * Create a TokenBudget. `cap` defaults to `tokenCapFromEnv()` (RAPIDTOOL_TOKEN_CAP
 * — unset/blank/0/NaN/negative → unmetered) and floors to an int; `ledger`
 * defaults to a fresh empty ledger (the caller may pass its own long-lived
 * ledger to keep accumulating across budgets).
 */
export function createTokenBudget(
  cap: number | null | undefined = tokenCapFromEnv(),
  ledger: TokenLedger = emptyLedger(),
): TokenBudget {
  return { ledger, cap: budgetCap(cap) };
}

// ---------------------------------------------------------------------------
// The PROCESS-scoped session budget (R4-f03 / A2-f07 / R12-f02 — W30 · LANE S3)
// ---------------------------------------------------------------------------

/**
 * The ONE lazily-created process-scoped budget. Every production seam that
 * used to mint a FRESH ledger per call (`codegen.server.ts`'s
 * `synthWithBackoff` defaults, the headless verify threading) shares THIS
 * ledger + cap, so `RAPIDTOOL_TOKEN_CAP` binds a whole PROCESS — one CLI run
 * = one process; the dev server = one server session (R4-f03 §4.4). N
 * sub-cap calls can no longer slip past a cap that only ever saw one call's
 * own usage (the R12-f02 runaway).
 *
 * Lazily created on first use (importing this module never reads env); the
 * cap is read ONCE at creation — set `RAPIDTOOL_TOKEN_CAP` per process
 * invocation, not mid-run. Spend is kept, never clamped: the ledger is the
 * caller-shared `TokenLedger` object mutated in place by
 * `recordBudgetSpend`/`recordSpend`.
 */
let sessionBudget: TokenBudget | null = null;

/** Get (or lazily create) the process session budget. ONE object per process. */
export function sessionTokenBudget(): TokenBudget {
  if (sessionBudget === null) sessionBudget = createTokenBudget();
  return sessionBudget;
}

/**
 * Test / explicit-new-session boundary: drop the singleton so the next
 * `sessionTokenBudget()` re-reads env and starts a fresh empty ledger.
 * Returns the NEW budget (the old object, if any caller still holds it,
 * keeps its own spend — never mutated by the reset).
 */
export function resetSessionBudget(): TokenBudget {
  sessionBudget = null;
  return sessionTokenBudget();
}

/**
 * True when a positive cap is set and the ledger has spent PAST it (`>` — 199:
 * landing exactly on the cap is still ok). Unmetered (or a malformed budget)
 * → false. Pure.
 */
export function isBudgetExhausted(budget: TokenBudget): boolean {
  const cap = budgetCap(budget);
  if (cap === undefined) return false;
  const ledger = budget?.ledger;
  if (!ledger || typeof ledger !== "object") return false;
  return totalTokens(ledger) > cap;
}

/**
 * Pre-dispatch gate (T-107.6): throw `SessionBudgetExceeded` when the budget
 * is already spent TO or PAST its cap — the next call would start exhausted,
 * so the seam refuses BEFORE the wire call (same `>=` semantics as
 * `assertWithinBudget`). Unmetered → no-op. Pure.
 */
export function assertBudgetHeadroom(budget: TokenBudget): void {
  const cap = budgetCap(budget);
  if (cap === undefined) return;
  const ledger = budget?.ledger;
  const spent = ledger && typeof ledger === "object" ? totalTokens(ledger) : 0;
  if (spent >= cap) throw new SessionBudgetExceeded(spent, cap);
}

/**
 * Record-then-signal (T-107.6; the codegen.server.ts `accountSynthUsage`
 * pattern): append the completed call's REAL usage to the caller-owned ledger
 * FIRST — mutated IN PLACE, so the spend is kept even when the crossing below
 * throws (the subagent.ts "spend kept, never a silent clamp" rule; callers
 * holding a reference to `budget.ledger` observe the full spend) — then
 * signal a cap crossing with `SessionBudgetExceeded` when the new total
 * exceeds the cap (landing exactly on the cap is ok — 199). Unmetered /
 * missing usage → `recordSpend` semantics only (no throw). Returns the
 * (mutated) budget ledger.
 */
export function recordBudgetSpend(
  budget: TokenBudget,
  spend: TokenSpend | null | undefined,
): TokenLedger {
  if (!budget || typeof budget !== "object" || !budget.ledger || typeof budget.ledger !== "object") {
    throw new Error(
      "recordBudgetSpend: budget must be a TokenBudget with a ledger object (RT_E_VALIDATION)",
    );
  }
  const next = recordSpend(budget.ledger, spend);
  budget.ledger.promptTokens = next.promptTokens;
  budget.ledger.completionTokens = next.completionTokens;
  budget.ledger.calls = next.calls;
  for (const field of CACHE_LEDGER_FIELDS) {
    const v = next[field];
    if (v === undefined) delete budget.ledger[field];
    else budget.ledger[field] = v;
  }
  const cap = budgetCap(budget);
  if (cap !== undefined) {
    const spent = totalTokens(budget.ledger);
    if (spent > cap) throw new SessionBudgetExceeded(spent, cap);
  }
  return budget.ledger;
}

// ---------------------------------------------------------------------------
// A3 catch wrapper (T-107.6 · D2.3 · 226 A3): a budget stop must be its coded
// outcome, never RT_E_INTERNAL
// ---------------------------------------------------------------------------

/**
 * The coded refusal a seam returns when a budget stop stops it (A3 · D2.3).
 * `SessionBudgetExceeded` is thrown by `assertBudgetHeadroom` /
 * `recordBudgetSpend` and (226 A3) had NO production catcher; a seam that
 * adopts the budget threading without wrapping that throw lets an outer
 * generic catch classify a CONTROLLED stop as `RT_E_INTERNAL`. Budgeted
 * seams therefore run their wire calls through `runBudgetedCall`, which
 * returns this envelope instead of ever letting the throw escape.
 */
export type BudgetStopRefusal = {
  ok: false;
  reason: "error";
  error: string;
  code: "RT_E_BUDGET_EXHAUSTED";
};

/**
 * Translate a caught error into the coded budget-stop refusal — or null for
 * any non-budget error (the caller rethrows those unchanged, so real faults
 * keep their own classification). The message carries the code so a log
 * reader never has to infer the class from prose.
 */
export function budgetStopRefusal(err: unknown): BudgetStopRefusal | null {
  if (!(err instanceof SessionBudgetExceeded)) return null;
  return {
    ok: false,
    reason: "error",
    error: `${err.message} [RT_E_BUDGET_EXHAUSTED] — controlled stop at the session budget cap (spend kept)`,
    code: "RT_E_BUDGET_EXHAUSTED",
  };
}

/** True when a value is the coded budget-stop refusal (narrows for seams that
 *  must distinguish a stop from an ordinary failed result). */
export function isBudgetStopRefusal(x: unknown): x is BudgetStopRefusal {
  return (
    !!x &&
    typeof x === "object" &&
    (x as { ok?: unknown }).ok === false &&
    (x as { code?: unknown }).code === "RT_E_BUDGET_EXHAUSTED"
  );
}

/** The usage shape a wire result carries (LlmResult-compatible). */
export type ModelUsage = { promptTokens: number; completionTokens: number };

/**
 * Run ONE wire call under a budget, with the A3 catch wrapper:
 *   1. pre-dispatch gate — `assertBudgetHeadroom` refuses BEFORE the wire;
 *   2. the call itself;
 *   3. post-response accounting — `recordBudgetSpend` records the REAL usage
 *      of every response that reports it (success or not: recording only on
 *      success silently under-counts retries), keeping the spend in the
 *      ledger even when the crossing refuses the result.
 * A budget stop at step 1 or 3 comes back as `BudgetStopRefusal`; any other
 * error is rethrown untouched. `budget === undefined` keeps the
 * byte-identical legacy path (no gate, no recording, result passes through).
 */
export async function runBudgetedCall<
  T extends { ok: boolean; usage?: ModelUsage | null | undefined },
>(budget: TokenBudget | undefined, call: () => Promise<T>): Promise<T | BudgetStopRefusal> {
  try {
    if (budget) assertBudgetHeadroom(budget);
    const res = await call();
    if (budget && res && typeof res === "object" && res.usage) {
      recordBudgetSpend(budget, res.usage);
    }
    return res;
  } catch (err) {
    const refusal = budgetStopRefusal(err);
    if (refusal) return refusal;
    throw err;
  }
}

export function wouldExceed(
  ledger: TokenLedger,
  add: TokenSpend | null | undefined,
  cap: number | null | undefined,
): boolean {
  if (isUnmetered(cap)) return false;
  return totalTokens(recordSpend(ledger, add)) > (cap as number);
}

/**
 * Pre-call gate: throw when a positive cap is already spent to/over the limit
 * (next call would start exhausted). Unmetered → no-op.
 */
export function assertWithinBudget(ledger: TokenLedger, cap: number | null | undefined): void {
  if (isUnmetered(cap)) return;
  const spent = totalTokens(ledger);
  if (spent >= (cap as number)) throw new SessionBudgetExceeded(spent, cap as number);
}

/**
 * Record spend then throw SessionBudgetExceeded only if the new total **exceeds**
 * the cap (landing exactly on the cap is ok — 199). Unmetered / missing spend →
 * recordSpend semantics only (no throw).
 */
export function recordSpendWithinCap(
  ledger: TokenLedger,
  spend: TokenSpend | null | undefined,
  cap: number | null | undefined,
): TokenLedger {
  const next = recordSpend(ledger, spend);
  if (isUnmetered(cap)) return next;
  const spent = totalTokens(next);
  if (spent > (cap as number)) throw new SessionBudgetExceeded(spent, cap as number);
  return next;
}
