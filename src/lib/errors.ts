/**
 * Machine-readable error codes for RapidTool.
 *
 * Every failure surfaced by the AI-interface layer (chat copilot, LLM calls,
 * report intake, headless/CLI commands) should carry one of these codes so an
 * AI agent — or the console/CLI integrator — can branch on the machine value
 * instead of parsing prose.
 *
 * Shape conventions:
 *   - `codeError(code, detail)` → `{ ok: false, error: detail, code }`
 *   - `classifyError(err, fallback)` → maps a THROWN error to a code by
 *     inspecting its name/message/errno; `fallback` is the caller's domain
 *     default (e.g. an LLM caller passes `RT_E_LLM_REJECTED`).
 *   - `ERROR_CODE_DOC` → one-line meaning + one line telling an AI agent what
 *     to do, for every code. Keep it in sync: adding a code without a doc
 *     entry fails `errors.test.ts`.
 *
 * Codes are additive-only: consumers match on string literals and never on
 * array position, so appending new codes must not break existing matches.
 */

export const ERROR_CODES = [
  "RT_E_UNKNOWN",
  "RT_E_PROJECT_MISSING",
  "RT_E_PHASE_ILLEGAL",
  "RT_E_GATE_PENDING",
  "RT_E_REPORT_INVALID",
  "RT_E_REPORT_PHASE_MISMATCH",
  "RT_E_RUNNER_UNAVAILABLE",
  "RT_E_RUNNER_FAILED",
  "RT_E_CHECK_FAILED",
  "RT_E_LLM_NOT_CONFIGURED",
  "RT_E_LLM_TIMEOUT",
  "RT_E_LLM_REJECTED",
  "RT_E_RESEARCH_UNAVAILABLE",
  "RT_E_VALIDATION",
  "RT_E_INTERNAL",
  "RT_E_GATES_FAILED",
  // fixes/150 wave (tree-run/repair/verify-kind verbs): pre-registered by the
  // wave watchdog so lanes G1/G3 can adopt exact codes; additive + harmless
  // while unused (classifyError only maps on explicit RT_E_* throws).
  "RT_E_TREE_RUN_FAILED",
  "RT_E_REPAIR_FAILED",
  "RT_E_VERIFY_KIND_FAILED",
  "RT_E_BUDGET_EXHAUSTED",
  "RT_E_ABORTED",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Honest failure shape: `ok: false`, a human-readable `error`, and a machine-readable `code`. */
export type CodedFailure = { ok: false; error: string; code: ErrorCode };

/** Build a typed failure result for a known error class. */
export function codeError(code: ErrorCode, detail: string): CodedFailure {
  return { ok: false, error: detail, code };
}

/**
 * Classify a thrown error into an ErrorCode.
 *
 * Matchers (in order):
 *   1. `ReportRejectedError` by name → `RT_E_REPORT_PHASE_MISMATCH` when the
 *      message mentions a phase, else `RT_E_REPORT_INVALID`.
 *   2. Node `ENOENT` errno (or "ENOENT" in the message) → `RT_E_PROJECT_MISSING`.
 *   3. Abort/TimeoutError name, an `ETIMEDOUT` errno, or a timeout-ish
 *      message → `RT_E_LLM_TIMEOUT`.
 *   4. Nothing matched → the caller-supplied `fallback` (default `RT_E_UNKNOWN`).
 *
 * Wrapper errors (e.g. fetch's "fetch failed" TypeError) carry the real
 * failure in `err.cause` — the chain (up to 4 levels) is walked and every
 * level's name/code/message is matched before giving up.
 *
 * Throw shapes are deliberately heterogeneous — Error subclasses, DOMException,
 * AggregateError (Promise.any / multi-address undici failures), and plain
 * `{ code }` / `{ message }` objects all flow through here, so the matcher
 * reads name/code/message off ANY object (duck-typed) and an AggregateError's
 * `.errors` children are walked too (bounded + cycle-safe). Nothing throws on
 * the input shape: primitives, symbols, functions and null all classify to the
 * fallback.
 */

/** Match ONE chain link against the known error families, or null. */
function matchErrorLink(link: unknown): ErrorCode | null {
  const isObject = typeof link === "object" && link !== null;
  const name = isObject ? (link as { name?: unknown }).name : undefined;
  const errno = isObject ? (link as { code?: unknown }).code : undefined;
  // DOMException and plain `{ message }` throws are NOT Error instances in
  // every runtime — duck-type a string message property before falling back
  // to String() so their text matches exactly like an Error's.
  const msgLike = isObject ? (link as { message?: unknown }).message : undefined;
  const message =
    typeof msgLike === "string"
      ? msgLike
      : link instanceof Error
        ? link.message
        : typeof link === "string"
          ? link
          : String(link);

  // A thrown `.code` that is already an RT_E_* code wins immediately —
  // phases.ts/report-intake.ts throw coded errors and the CLI must preserve
  // them (previously they died here and every envelope collapsed to UNKNOWN).
  if (typeof errno === "string" && /^RT_E_/.test(errno)) return errno as ErrorCode;
  if (name === "ReportRejectedError") {
    return /phase/i.test(message)
      ? "RT_E_REPORT_PHASE_MISMATCH"
      : "RT_E_REPORT_INVALID";
  }
  if (errno === "ENOENT" || /ENOENT/.test(message)) return "RT_E_PROJECT_MISSING";
  if (
    name === "AbortError" ||
    name === "TimeoutError" ||
    errno === "ETIMEDOUT" ||
    /timed?\s*out|ETIMEDOUT/i.test(message)
  ) {
    return "RT_E_LLM_TIMEOUT";
  }
  return null;
}

/**
 * F3 sweep: AggregateError children are real throw shapes too (Promise.any
 * rejects, undici's multi-address connect failures aggregate per-address
 * errors). The cause chain carries the aggregate itself with an opaque
 * message ("2 errors"), so the informative failure lives in `.errors` — walk
 * up to MAX_AGGREGATE_LINKS children (each following its own cause chain)
 * AFTER the cause chain so existing classification order is untouched.
 */
const MAX_AGGREGATE_LINKS = 16;

export function classifyError(
  err: unknown,
  fallback: ErrorCode = "RT_E_UNKNOWN",
): ErrorCode {
  const chain: unknown[] = [];
  const seen = new Set<unknown>();
  let current: unknown = err;
  for (let i = 0; i < 4 && current !== undefined && current !== null; i++) {
    if (typeof current === "object") {
      if (seen.has(current)) break;
      seen.add(current);
    }
    chain.push(current);
    if (typeof current !== "object" || current === null) break;
    const cause = (current as { cause?: unknown }).cause;
    if (cause === undefined || cause === null || cause === current) break;
    current = cause;
  }

  const extras: unknown[] = [];
  const queue: unknown[] = [];
  for (const link of chain) {
    if (typeof link !== "object" || link === null) continue;
    const aggregate = link as { name?: unknown; errors?: unknown };
    if (aggregate.name !== "AggregateError" || !Array.isArray(aggregate.errors)) continue;
    for (const child of aggregate.errors) queue.push(child);
  }
  while (queue.length > 0 && extras.length < MAX_AGGREGATE_LINKS) {
    const item = queue.shift();
    if (item === undefined || item === null) continue;
    if (typeof item === "object") {
      if (seen.has(item)) continue;
      seen.add(item);
    }
    extras.push(item);
    if (typeof item !== "object" || item === null) continue;
    const deeper = item as { name?: unknown; errors?: unknown; cause?: unknown };
    // Nested aggregates expand their own children; wrappers follow their cause.
    if (deeper.name === "AggregateError" && Array.isArray(deeper.errors)) {
      for (const child of deeper.errors) queue.push(child);
    }
    const cause = deeper.cause;
    if (cause !== undefined && cause !== null && cause !== item) queue.push(cause);
  }

  for (const link of chain) {
    const hit = matchErrorLink(link);
    if (hit !== null) return hit;
  }
  for (const link of extras) {
    const hit = matchErrorLink(link);
    if (hit !== null) return hit;
  }
  return fallback;
}

/**
 * One line of meaning + one line telling an AI agent what to do, per code.
 * Used by consoles/CLIs to render recoverable guidance and by agents to pick
 * the next action without reading raw error prose.
 */
export const ERROR_CODE_DOC: Record<ErrorCode, { meaning: string; agentAction: string }> = {
  RT_E_UNKNOWN: {
    meaning: "No classifier matched — the failure is opaque.",
    agentAction:
      "Inspect the raw message and the call site, then re-surface the failure with the closest specific code instead of guessing.",
  },
  RT_E_PROJECT_MISSING: {
    meaning: "The referenced project (id or file) does not exist or cannot be loaded.",
    agentAction:
      "Check the project id/path against the registry; create or import the project first, or report an honest not-found to the user.",
  },
  RT_E_PHASE_ILLEGAL: {
    meaning: "An operation targeted a phase that is not legal from the current state (unknown id, out of order, or sealed priors).",
    agentAction:
      "Re-read currentPhase against the phase graph (canEnter/priorsSealed) and either pick the correct next phase or explain why the requested one is not reachable yet.",
  },
  RT_E_GATE_PENDING: {
    meaning: "The operation requires a resolved gate, but a HITL gate is still pending.",
    agentAction:
      "Route the project through the open HITL prompt (approve/reject with feedback); do not auto-advance and never fabricate a decision.",
  },
  RT_E_REPORT_INVALID: {
    meaning: "An ingested agent report failed shape validation.",
    agentAction:
      "Fix the report to match the AgentReport schema (phase 0-12, status enum, non-empty summary) and re-submit; never mutate project state.",
  },
  RT_E_REPORT_PHASE_MISMATCH: {
    meaning: "A report targeted a phase other than the live current phase.",
    agentAction:
      "Re-emit the report for project.currentPhase, or advance the project to the phase the report covers first.",
  },
  RT_E_RUNNER_UNAVAILABLE: {
    meaning: "The bounded code runner is not configured in this environment.",
    agentAction:
      "Fall back to the deterministic self-test path and label lastTest as self-test — never present a fallback as a real run.",
  },
  RT_E_RUNNER_FAILED: {
    meaning: "The runner executed but failed (refused, timed out, non-zero exit, or spawn failure).",
    agentAction:
      "Read the runner's stdout/stderr evidence, fix the generated module, and re-run before claiming any test verdict.",
  },
  RT_E_CHECK_FAILED: {
    meaning: "The compile-check pass found emitted files that do not parse (per-file verdicts carried on the result).",
    agentAction:
      "Read the per-file verdicts, fix the offending emitted modules at the generator, and re-emit before building further.",
  },
  RT_E_LLM_NOT_CONFIGURED: {
    meaning: "No DeepSeek API key is present, so no LLM call can run.",
    agentAction:
      "Return the honest not-configured fallback (deterministic path), never fabricate model text, and tell the user to set DEEPSEEK_API_KEY.",
  },
  RT_E_LLM_TIMEOUT: {
    meaning: "The LLM call exceeded its deadline.",
    agentAction:
      "Retry once if the task is idempotent, otherwise fall back to the deterministic path and report the timeout honestly.",
  },
  RT_E_LLM_REJECTED: {
    meaning: "The LLM provider refused the request (401 auth, 402 billing, 429 rate limit, invalid params, or empty content).",
    agentAction:
      "Do not retry blindly; check key/balance/parameters, and surface the provider's own message to the user.",
  },
  RT_E_RESEARCH_UNAVAILABLE: {
    meaning: "The live web-research backend is not configured or unreachable.",
    agentAction:
      "Proceed with the deterministic corpus, set liveUnavailable so the documented gate waiver applies, and never present fabricated findings as real research.",
  },
  RT_E_VALIDATION: {
    meaning: "Input or model output failed validation and cannot be used.",
    agentAction:
      "Reject the payload, state the concrete validation rule that failed, and ask for corrected input instead of guessing.",
  },
  RT_E_INTERNAL: {
    meaning: "Unexpected internal failure (transport, serialization, server).",
    agentAction:
      "Log the full error, retry once if it may be transient, and escalate with the raw message rather than paraphrasing.",
  },
  RT_E_GATES_FAILED: {
    meaning: "The run sealed COMPLETE while one or more recorded DoD gates stand FAILED — a red-gate seal, never a clean one.",
    agentAction:
      "Read summary.failedGates (the census), repair the failing phase(s) and re-run — do not treat this exit as a successful completion or ship the artifact as-is.",
  },
  RT_E_TREE_RUN_FAILED: {
    meaning: "The emitted tree's run verdict is red — compile-check, spec probes, or entry run failed under tree-run.",
    agentAction:
      "Read the tree-run outcome (compile verdicts, per-spec tests, entry run), fix the generator or re-emit, then re-run the tree before treating P6 as verified.",
  },
  RT_E_REPAIR_FAILED: {
    meaning: "The repair cycle exhausted its budget or refused to converge — the tree is still red after repair.",
    agentAction:
      "Read the last tree-failure tail and the repair attempts' evidence, adjust the repair directive or generator, and re-run repair — never mint a green verdict on a red tree.",
  },
  RT_E_VERIFY_KIND_FAILED: {
    meaning: "Kind verification ended red — the scratch-copy install or the declared build of the emitted tree failed.",
    agentAction:
      "Read the install/build evidence from the scratch copy, fix the emitted package or builder, and re-run --verify-kind before claiming the kind is verified.",
  },
  RT_E_BUDGET_EXHAUSTED: {
    meaning: "A journey or wild run hit its hard cycle/token budget and stopped without converging.",
    agentAction:
      "Read the last tree-failure tail, raise the budget only with a human decision, or repair the generator — never mint converged after exhaustion.",
  },
  RT_E_ABORTED: {
    meaning: "The process received SIGTERM/SIGINT and stamped acceptance:aborted before exit.",
    agentAction: "Resume from the persisted cursor if one exists; do not treat the run as accepted or failed.",
  },
};
