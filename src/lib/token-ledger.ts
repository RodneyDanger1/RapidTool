/**
 * Token ledger — measured spend vs a hard session cap.
 *
 * DeepSeek already returns `usage.prompt_tokens` / `completion_tokens`.
 * Callers used to drop that. This module is the SessionBudgetExceeded /
 * NoMoneyException class: when a cap is set and spend exceeds it, throw
 * (never mint green after exhaustion).
 *
 * Unmetered path (no RAPIDTOOL_TOKEN_CAP / unset / 0 / NaN / non-positive):
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
 * Parent wires recordSpend + assertWithinBudget / recordSpendWithinCap at
 * codegen synth paths. Do not add Project.tokenCap here (types.ts is parent).
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

export type TokenSpend = { promptTokens: number; completionTokens: number };

export type TokenLedger = {
  promptTokens: number;
  completionTokens: number;
  calls: number;
};

export function emptyLedger(): TokenLedger {
  return { promptTokens: 0, completionTokens: 0, calls: 0 };
}

export function totalTokens(ledger: TokenLedger): number {
  return ledger.promptTokens + ledger.completionTokens;
}

function floorNonNeg(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
}

/**
 * Parse RAPIDTOOL_TOKEN_CAP. Unset / blank / 0 / NaN / negative → undefined
 * (unmetered). Positive finite numbers floor to an int cap.
 */
export function tokenCapFromEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): number | undefined {
  const raw = env?.RAPIDTOOL_TOKEN_CAP;
  if (typeof raw !== "string" || !raw.trim()) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

/** True when no positive finite cap is in force (unmetered / no-op path). */
export function isUnmetered(cap: number | null | undefined): boolean {
  return cap == null || !Number.isFinite(cap) || cap <= 0;
}

/** Append one API usage blob. Missing spend is a no-op (does not bump calls). */
export function recordSpend(ledger: TokenLedger, spend: TokenSpend | null | undefined): TokenLedger {
  if (!spend || typeof spend !== "object") return ledger;
  return {
    promptTokens: ledger.promptTokens + floorNonNeg(spend.promptTokens),
    completionTokens: ledger.completionTokens + floorNonNeg(spend.completionTokens),
    calls: ledger.calls + 1,
  };
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
