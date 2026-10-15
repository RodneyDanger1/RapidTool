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
  // W358 lane `close-taxonomy` (fixes/358_close_taxonomy.md): the quality ratchet's
  // OWN cause — a pinned floor whose producer ran but produced no usable reading
  // (a reader's shape changed under a live producer, or the reading cannot be
  // formed at all). Armed by W356 lane `ratchet` and left documented in
  // fixes/357_fix_gates.md §5; landed here because W357 owned no `src/**` file.
  "RT_E_RATCHET_METRIC_UNAVAILABLE",
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
  "RT_E_BUSY",
  "RT_E_FOREIGN_FILES",
  // W12 lane-a (fixes/217j, enacting 216y §2.3 G3): the four OS/network
  // failure families that used to collapse to RT_E_UNKNOWN despite carrying
  // an unambiguous errno. Append-only — consumers match on string literals,
  // never on array position.
  "RT_E_PERMISSION_DENIED",
  "RT_E_DISK_FULL",
  "RT_E_PORT_IN_USE",
  "RT_E_NETWORK_UNREACHABLE",
  // W18 lane-3 (fixes/249, playbook T4.2): the git landing tail needs an exact
  // code for "the git binary is absent in this environment" — no existing code
  // names it honestly (RT_E_RUNNER_UNAVAILABLE's doc is node-runner-specific
  // and its agentAction would misdirect a git caller). Append-only; consumers
  // match string literals, never array position.
  "RT_E_GIT_UNAVAILABLE",
  // W23 lane-1 (fixes/262): HTTP 402 / "Insufficient Balance" is a first-class
  // ending — a broke wallet is NOT a generic refusal (RT_E_LLM_REJECTED's
  // class) and NOT a session budget stop (RT_E_BUDGET_EXHAUSTED, which the
  // caller's own cap triggers — 226 A3). Run #3 scored a 402-saturated keyed
  // leg as a trial; that must never read as a quality measurement again.
  // Append-only; consumers match string literals, never array position.
  "RT_E_LLM_NO_BALANCE",
  // W30 lane S1 (fixes/272_s1_autonomy.md): the autonomy SHELL refusals. Each
  // names a capability whose seam exists but whose host/precondition does not
  // (yet) — an honest coded refusal, never a fake run. Append-only; consumers
  // match string literals, never array position.
  //   - CHECKPOINT_MISSING: T-107.7 `resume` — no checkpoint for the project.
  //   - NOT_IMPLEMENTED: a coded SHELL — the seam parsed the request but the
  //     full logic is not wired; the message names the TODO row.
  // RT_E_UNATTENDED_UNSUPPORTED (W-47) was REMOVED 2026-10-03 by the 342-6
  // resume: nothing ever emitted it, and its premise — the W-01/W-02 blockers
  // unlanded keyed — is false since 341-6 made the `unattended` verb real and
  // self-sufficient (fixes/342_6_sweep.md). A code is minted only for a
  // failure that actually surfaces; this one never did.
  "RT_E_CHECKPOINT_MISSING",
  "RT_E_NOT_IMPLEMENTED",
  // W31 T2 (fixes/273_t2_r15.md · R15-f02): the auth-schema preflight. Sign-in
  // enabled while no migration creates the Better Auth `user` table would run
  // every query against a schema-less database the moment someone signs in —
  // refuse at startup with the copy-up instruction instead. Emitted by
  // scripts/migrate.mjs + src/lib/db.ts via authSchemaRefusal.
  // Append-only; consumers match string literals, never array position.
  "RT_E_AUTH_SCHEMA_MISSING",
  "RT_E_MCP_DISABLED",
  // 310 B3 (fixes/310_b3_boundary.md · 308 M7-05/M7-02/M7-06): the wrong-KIND
  // path family — a directory where a file was required (EISDIR: a dir-as-file
  // read) or a non-directory where a directory was required (ENOTDIR: a
  // parent-is-a-FILE emit target, a file-shaped `.rapidtool/`). Previously
  // unmatched, so these collapsed to caller fallbacks (RT_E_VALIDATION for a
  // dir-as-file read, RT_E_INTERNAL for an emit, "missing" for a blocked
  // checkpoint read) — a wrong-kind path is its own path-class refusal, not
  // input validation. Append-only; consumers match string literals, never
  // array position.
  "RT_E_PATH_KIND_MISMATCH",
  // W45 lane 331-1 (fixes/331_1_keywright.md): the keyed-path credentials
  // family. Before this wave a rejected credential (HTTP 401) rode
  // RT_E_LLM_REJECTED alongside rate limits/params, and the CLI's prose
  // re-classifier collapsed it to RT_E_UNKNOWN — so an operator could not tell
  // "wrong key" from "rate limited" from "opaque failure". KEY_REJECTED is the
  // 401 class; KEY_SHADOWED is the observable conflict when a stale ambient
  // DEEPSEEK_API_KEY differs from the repo `.env` key that wins. Append-only;
  // consumers match string literals, never array position.
  "RT_E_LLM_KEY_REJECTED",
  "RT_E_LLM_KEY_SHADOWED",
  // 345 L2 (A1-07): the import paste-cap refusal. `io.importProject` refused an
  // oversized payload with a message only (the open A1-25 TODO), so a machine
  // caller could not branch on it. The code names the cap class; the message
  // keeps the observed size and the effective cap. Append-only; consumers match
  // string literals, never array position.
  "RT_E_IMPORT_TOO_LARGE",
  // W61 lane C (C1): the brief-fit substance floor. A generated tree can pass
  // the shallow arch/brief probes while shipping a hollow skeleton (a couple
  // of files, alias-only modules) that does not substantively answer the
  // brief. This code names that class — a tree whose core-noun coverage is
  // empty or only connective prose, NOT one that merely trips a raw count.
  // Append-only; consumers match string literals, never array position.
  "RT_E_SUBSTANCE_EMPTY",
  // W61 lane C (C1): the plan-underproduction refusal. The brief demands more
  // deliverable surface (features/entities/artifacts) than the run planned or
  // emitted — the plan is under-produced relative to the brief, named
  // explicitly rather than sealed as COMPLETE. Append-only; consumers match
  // string literals, never array position.
  "RT_E_PLAN_UNDERPRODUCED",
  // W61 P0 (PR-03): the five defect-class codes the prevention guards already
  // reference by `expectedCode` (scripts/guards/guard-registry.json,
  // scripts/guards/*.mjs, scripts/prevention/replay-harness.mjs). They were
  // CONSUMED as strings but absent from this registry, so AGENTS.md's "every
  // surfaced failure carries a code from ERROR_CODE_DOC" was aspirational for
  // them. Registering them is additive-only; consumers match string literals,
  // never array position.
  //   - DUPLICATE_EXPORT: a barrel `export *` re-exports one member from two
  //     providers (TS2308) — the bfo cross-chunk collision.
  //   - USE_BEFORE_DECL: a block-scoped binding is read in another generated
  //     module before its declaration (TS2448) — the mobile TDZ.
  //   - MONEY_SEMANTICS: a money-named/doc'd export accumulates a quantity with
  //     no price/unit-cost operand — wrong arithmetic, gate-green.
  //   - README_PARITY: an emitted README "What ships" manifest row names a path
  //     that is not on disk.
  //   - SRC_EDITED_DURING_RUN: `src/**`/`scripts/**` changed after the run began
  //     (RUNLOCK/BL-010) — the run's own evidence is suspect.
  "RT_E_DUPLICATE_EXPORT",
  "RT_E_USE_BEFORE_DECL",
  "RT_E_MONEY_SEMANTICS",
  "RT_E_README_PARITY",
  "RT_E_SRC_EDITED_DURING_RUN",
  // W61 final-wave lane G (G-2): the remaining `expectedCode` strings the guard
  // registry (scripts/guards/guard-registry.json) and its campaign/S4 invariant
  // detectors name as codes but that were absent here — so those guards were
  // consuming aspirational code strings. Registering them is additive-only;
  // consumers match string literals, never array position. errors.test.ts pins
  // that EVERY registry `expectedCode` resolves in ERROR_CODE_DOC, so a guard
  // can never again name an unregistered code.
  //   - UI_UNWIRED: the mounted console calls no real generated export (C1-02).
  //   - SPEC_SKIP_VACUOUS: an emitted oracle is skip-dominated — green by vacuity (C1-05/R2-05).
  //   - CLAIM_UNVERIFIED: a delivery claims a product without stating its verification (C1-06).
  //   - GIT_CODE_INCONSISTENT: a withheld git envelope's reason disagrees with its deciding code (C1-08).
  //   - SYNTH_DEFAULT_DISARMED: the armed chunk-resample default was silently re-disarmed (S4-01).
  //   - SYNTH_RESAMPLE_UNBOUNDED: a resample loop lacks the finite P6_SYNTH_CANDIDATES_MAX clamp (S4-02).
  //   - REFUSAL_COVERAGE_LOST: a re-pinned refusal suite dropped its coded refusal (S4-03).
  //   - SYNTH_RESUME_NOT_REUSED: an accepted chunk was re-synthesized instead of reused (S4-04).
  //   - JSX_IN_TS: an emitted `.ts` module carries JSX / the global JSX namespace (R2-03).
  //   - VERIFIED_PRODUCT_UNEVIDENCED: a committed delivery claims a verified product without evidence (R2-06).
  //   - DEFAULT_CHECK_BASELINE_LOST: a default-check baseline dropped the weaker sample (S4-05).
  "RT_E_UI_UNWIRED",
  "RT_E_SPEC_SKIP_VACUOUS",
  // 350 (runner/declared-script honesty): a spec that RUNS green under
  // `node --test` but carries NO behavioural assertion (load-only or only
  // shape/presence probes) is vacuity, not behaviour — the same class as the
  // skip-dominated refusal, but a distinct trigger. The bounded spec leg
  // refuses it, so this code rides the red spec verdict; before this the
  // refusal surfaced bare (`run:"fail"`, `0 pass / 0 fail`, no code) and
  // disagreed silently with the tree's own `npm run test` exit 0. Append-only;
  // consumers match string literals, never array position.
  "RT_E_SPEC_VACUOUS",
  "RT_E_CLAIM_UNVERIFIED",
  "RT_E_GIT_CODE_INCONSISTENT",
  "RT_E_SYNTH_DEFAULT_DISARMED",
  "RT_E_SYNTH_RESAMPLE_UNBOUNDED",
  "RT_E_REFUSAL_COVERAGE_LOST",
  "RT_E_SYNTH_RESUME_NOT_REUSED",
  "RT_E_JSX_IN_TS",
  "RT_E_VERIFIED_PRODUCT_UNEVIDENCED",
  "RT_E_DEFAULT_CHECK_BASELINE_LOST",
] as const;

/**
 * Registry boundary (fixes/241 W15-L2, closing the C-2 note in fixes/237):
 * an `RT_E*`-looking string is not automatically a code. The run-eval harness
 * (`scripts/run-eval.mjs`) carries two legacy scoring-evidence labels,
 * `RT_EVAL_STALL` / `RT_EVAL_REFUSED`, that stay OUT of this registry by
 * decision (declare-or-strike):
 *   - nothing throws them, nothing passes them through `codeError` /
 *     `classifyError`, and no CLI envelope or exit code carries them — they
 *     only label the drain's stop evidence (`stop.code` for the M9 rubric,
 *     `notes.stopCode` in the results row);
 *   - their shape (`RT_EVAL*`, no underscore after the `E`) fails this
 *     registry's enforced `RT_E_*` prefix, so registering them as-is would
 *     bend the convention for every consumer — and a new code is minted only
 *     for a failure that actually surfaces;
 *   - if a future run-eval lane wants them as real codes, THAT lane owns the
 *     shape-conforming rename plus its emitter change; `errors.test.ts` pins
 *     this boundary until then.
 */

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Honest failure shape: `ok: false`, a human-readable `error`, and a machine-readable `code`. */
export type CodedFailure = { ok: false; error: string; code: ErrorCode };

/** Build a typed failure result for a known error class. */
export function codeError(code: ErrorCode, detail: string): CodedFailure {
  return { ok: false, error: detail, code };
}

/**
 * 185-H1 dual-channel detector.
 *
 * `{ ok: true, error: "…" }` is a lie: success must never carry an `error`
 * channel (use `note` / `detail` for soft messages). Returns the trimmed
 * error prose when the payload claims success while also stamping `error`,
 * otherwise `null`. Callers fail-close the dual-channel shape onto their
 * honest failure path (never treat it as usable success).
 *
 * Only a non-empty string `error` counts — empty/whitespace is not dual-channel.
 */
export function dualChannelFailDetail(res: {
  ok?: unknown;
  error?: unknown;
  // Allow extra payload fields (LLM text, note, …) — only ok+error are inspected.
  [key: string]: unknown;
}): string | null {
  if (res.ok !== true) return null;
  if (typeof res.error !== "string") return null;
  const err = res.error.trim();
  return err.length > 0 ? err : null;
}

/**
 * Classify a thrown error into an ErrorCode.
 *
 * Strong matchers (per chain link, in order; first hit wins):
 *   1. `ReportRejectedError` by name → `RT_E_REPORT_PHASE_MISMATCH` when the
 *      message mentions a phase, else `RT_E_REPORT_INVALID`.
 *   2. Node `ENOENT` errno (or "ENOENT" in the message) → `RT_E_PROJECT_MISSING`.
 *   3. Abort/TimeoutError name, an `ETIMEDOUT` errno, or a timeout-ish
 *      message → `RT_E_LLM_TIMEOUT`.
 *   4. `EACCES`/`EPERM` → `RT_E_PERMISSION_DENIED`, `ENOSPC` → `RT_E_DISK_FULL`,
 *      `EADDRINUSE` → `RT_E_PORT_IN_USE`, and the connect/DNS errno family
 *      (`ECONNREFUSED`, `ENOTFOUND`, `EAI_AGAIN`, `ENETUNREACH`,
 *      `EHOSTUNREACH`, `ECONNRESET`) → `RT_E_NETWORK_UNREACHABLE` (W12 G3).
 *   5. `EISDIR`/`ENOTDIR` (errno or message) → `RT_E_PATH_KIND_MISMATCH` — a
 *      wrong-KIND path (dir-where-file / file-where-dir) is its own path-class
 *      refusal, never the caller's validation fallback (310 B3 · M7-05).
 *   6. `SyntaxError` carrying a JSON-specific message (a failed `JSON.parse`)
 *      → `RT_E_VALIDATION`.
 *   7. Nothing matched → the caller-supplied `fallback` (default `RT_E_UNKNOWN`).
 *
 * Wrapper errors (e.g. fetch's "fetch failed" TypeError) carry the real
 * failure in `err.cause` — the chain (up to 4 levels) is walked and every
 * level's name/code/message is matched before giving up. The BARE wrapper
 * prose "fetch failed" is a tier-2 signal: applied as
 * `RT_E_NETWORK_UNREACHABLE` only when the result would otherwise be the
 * opaque default, never over a caller-supplied domain fallback (a generic
 * wrapper phrase is weaker than the caller's domain knowledge — e.g. the
 * research seam's `RT_E_RESEARCH_UNAVAILABLE`).
 *
 * Throw shapes are deliberately heterogeneous — Error subclasses, DOMException,
 * AggregateError (Promise.any / multi-address undici failures), and plain
 * `{ code }` / `{ message }` objects all flow through here, so the matcher
 * reads name/code/message off ANY object (duck-typed) and an AggregateError's
 * `.errors` children are walked too (bounded + cycle-safe). Nothing throws on
 * the input shape: primitives, symbols, functions and null all classify to the
 * fallback.
 */

/** Errno `.code`s whose only honest reading is "the target could not be reached". */
const NETWORK_ERRNOS = new Set([
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "ECONNRESET",
]);

/** Same family when only the printable message survives (a wrapper flattened the errno). */
const NETWORK_ERRNO_RE =
  /\b(ECONNREFUSED|ENOTFOUND|EAI_AGAIN|ENETUNREACH|EHOSTUNREACH|ECONNRESET)\b/;

/**
 * JSON.parse failures are V8 SyntaxErrors with JSON-specific messages. Probe
 * (node v22.23.2) produced exactly these texts: "Expected property name or
 * '}' in JSON at position 1 (line 1 column 2)", "Unexpected end of JSON
 * input", "\"undefined\" is not valid JSON". Requiring `SyntaxError` keeps a
 * non-JSON SyntaxError (e.g. from evaluated generated code) out of this branch.
 */
const JSON_PARSE_MSG_RE =
  /is not valid JSON|Unexpected end of JSON input|in JSON at position/i;

/** Duck-typed field read shared by the two matcher tiers below. */
function readLinkFields(link: unknown): { name: unknown; errno: unknown; message: string } {
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
  return { name, errno, message };
}

/** Match ONE chain link against the known error families, or null. */
function matchErrorLink(link: unknown): ErrorCode | null {
  const { name, errno, message } = readLinkFields(link);

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
  // W12 lane-a (fixes/217j, 216y §2.3 G3): new families, deliberately AFTER
  // the existing matchers so no previously classified error can change code.
  if (errno === "EACCES" || errno === "EPERM" || /\b(EACCES|EPERM)\b/.test(message)) {
    return "RT_E_PERMISSION_DENIED";
  }
  if (errno === "ENOSPC" || /\bENOSPC\b/.test(message)) return "RT_E_DISK_FULL";
  if (errno === "EADDRINUSE" || /\bEADDRINUSE\b/.test(message)) return "RT_E_PORT_IN_USE";
  if (
    (typeof errno === "string" && NETWORK_ERRNOS.has(errno)) ||
    NETWORK_ERRNO_RE.test(message)
  ) {
    return "RT_E_NETWORK_UNREACHABLE";
  }
  // 310 B3 (fixes/310_b3_boundary.md · 308 M7-05): the wrong-KIND path family.
  // A directory where a file was required (EISDIR — a dir-as-file read) or a
  // non-directory where a directory was required (ENOTDIR — a parent-is-a-FILE
  // emit target, a file-shaped `.rapidtool/`) previously matched nothing and
  // collapsed to the caller's fallback (RT_E_VALIDATION for `run --project .`,
  // RT_E_INTERNAL for an emit) — a wrong-kind path is a path-class refusal,
  // not input validation. Deliberately AFTER every existing matcher: adding a
  // family never re-classifies an error the older matchers already claim
  // (the W12 append-only ordering rule).
  if (errno === "EISDIR" || errno === "ENOTDIR" || /\b(EISDIR|ENOTDIR)\b/.test(message)) {
    return "RT_E_PATH_KIND_MISMATCH";
  }
  // A failed JSON.parse is an input-validation failure and reuses the
  // existing RT_E_VALIDATION ("input or model output failed validation") —
  // no new code is minted for a case an existing code already names.
  if (name === "SyntaxError" && JSON_PARSE_MSG_RE.test(message)) return "RT_E_VALIDATION";
  return null;
}

/**
 * Tier-2 matcher: the BARE generic fetch wrapper only. undici throws
 * `TypeError: fetch failed` with the real failure in `.cause` (walked by the
 * tier-1 passes); when nothing else matched, the wrapper prose is the sole
 * signal, but it is inconclusive on its own ("fetch failed" spans DNS,
 * connect, reset and abort failures) — classifyError therefore applies it
 * only in place of the opaque default, never over a domain fallback.
 */
function matchErrorLinkGeneric(link: unknown): ErrorCode | null {
  const { message } = readLinkFields(link);
  return /fetch failed/.test(message) ? "RT_E_NETWORK_UNREACHABLE" : null;
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
  // Tier 2 — generic wrapper prose ("fetch failed"). Only ever replaces the
  // opaque default: a caller-supplied domain fallback is a stronger claim
  // than a generic wrapper phrase (see the tier note above).
  if (fallback === "RT_E_UNKNOWN") {
    for (const link of chain) {
      const hit = matchErrorLinkGeneric(link);
      if (hit !== null) return hit;
    }
    for (const link of extras) {
      const hit = matchErrorLinkGeneric(link);
      if (hit !== null) return hit;
    }
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
    meaning: "The LLM provider refused the request (401 auth, 429 rate limit, invalid params, or empty content).",
    agentAction:
      "Do not retry blindly; check the key or the parameters, and surface the provider's own message to the user.",
  },
  RT_E_LLM_NO_BALANCE: {
    meaning:
      "The LLM provider refused the call because the account balance is exhausted (the provider's HTTP 402 / \"Insufficient Balance\" — a wallet class, not a generic refusal).",
    agentAction:
      "Stop consuming this account: do not retry (billing is not transient) and read NO keyed score from a run in this state — top up the account or switch keys, re-pass the fundedness probe, then re-run.",
  },
  RT_E_LLM_KEY_REJECTED: {
    meaning:
      "The LLM provider rejected the API key it was sent (HTTP 401 authentication failure) — the credential is invalid/revoked, not the request.",
    agentAction:
      "Fix the key at the source named in the message (the working-directory .env path or the process environment, tail-only), confirm which source wins under the documented precedence (scripts/README-cli.md \"API key resolution\"), then re-run; never paste the full key into logs.",
  },
  RT_E_LLM_KEY_SHADOWED: {
    meaning:
      "A stale/invalid ambient DEEPSEEK_API_KEY and the working-directory .env key are both present and differ — the .env key wins by the documented precedence, and the ambient key was ignored (surfaced, never silently shadowed).",
    agentAction:
      "No action needed to proceed (the .env key is in effect); to silence the signal, clear the stale ambient variable (Windows: remove the User-scope DEEPSEEK_API_KEY) or make it match the .env key. Compare by last-4 tails only.",
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
  RT_E_RATCHET_METRIC_UNAVAILABLE: {
    meaning: "A pinned quality-ratchet floor could not be measured — the producer ran but produced no usable reading.",
    agentAction:
      "Re-run the named producer and read its output; if the artifact is genuinely absent say so with RT_E_PROJECT_MISSING, and if a reader's shape changed fix the reader instead of the floor.",
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
      "Read the tree-run outcome (compile verdicts, per-spec tests, entry run), fix the generator or re-emit, then re-run the tree before treating P6 as verified. A GREEN run is still not product-complete when the verdict's `substance` census shows stubs/reexports, so read `substance` (stubs:N reexports:N real:N) and its SUBSTANCE MARKING note (K3: exit 0 is never product quality).",
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
  RT_E_BUSY: {
    meaning: "Another writer holds the project file lock (saveProject O_EXCL).",
    agentAction: "Wait and retry the save; do not overwrite or delete the .lock file while a writer is live.",
  },
  RT_E_FOREIGN_FILES: {
    meaning: "emit refused because the target dir contains foreign files that are not leftover tests/.",
    agentAction: "Pass --force only if you intend to overwrite, or emit into a clean directory.",
  },
  RT_E_PERMISSION_DENIED: {
    meaning: "The OS denied access to a file or directory (EACCES/EPERM).",
    agentAction:
      "Fix the path's permissions or run from a location the process may write to; do not retry the same path unchanged.",
  },
  RT_E_DISK_FULL: {
    meaning: "A write failed because the filesystem has no space left (ENOSPC).",
    agentAction:
      "Free space or point the output at another volume before retrying; never report the write as done.",
  },
  RT_E_PORT_IN_USE: {
    meaning: "A server could not bind because the address/port is already in use (EADDRINUSE).",
    agentAction:
      "Stop the process holding the port or bind a different port; do not kill processes blindly.",
  },
  RT_E_NETWORK_UNREACHABLE: {
    meaning:
      "A network call never reached its target — DNS miss, refused or reset connection, unreachable host (includes undici's bare 'fetch failed').",
    agentAction:
      "Check the target host/port and connectivity; retry once if the failure may be transient, then report the unreachable endpoint honestly instead of fabricating the remote result.",
  },
  RT_E_GIT_UNAVAILABLE: {
    meaning:
      "The git binary is not available in this environment, so the git landing tail cannot run.",
    agentAction:
      "Report the absence honestly and leave the tree uninitialized — install git, or run where git exists; never fake a landing or hand-roll repository metadata.",
  },
  RT_E_CHECKPOINT_MISSING: {
    meaning:
      "T-107.7: `resume`/`unattended` found no checkpoint at <projectDir>/.rapidtool/checkpoint.json — the run never committed a phase with a known project dir, or a COMPLETE seal cleared it (completion removes the checkpoint: there is no successor state to re-enter).",
    agentAction:
      "Continue with the normal run verbs — `gate`/`run --project` writes a fresh checkpoint on every committed phase (`unattended` starts from the project file when no checkpoint exists); re-run `resume` only after a run has committed a phase beside that dir. Never invent a resumption.",
  },
  RT_E_NOT_IMPLEMENTED: {
    meaning:
      "The requested capability is a coded SHELL: its seam exists (types/parsing/refusal paths in place) but the full logic is not wired yet — the message names the owning TODO row.",
    agentAction:
      "Treat the refusal as the honest state of the build: read the named TODO(<row-id>) / lane log, implement that row, and re-run; never work around it by fabricating the missing behavior.",
  },
  RT_E_AUTH_SCHEMA_MISSING: {
    meaning:
      "Sign-in is enabled (VITE_AUTH_ENABLED is not \"false\") but no migration creates the Better Auth \"user\" table — migrations/auth/*.sql is never applied (neither the deploy migrator nor the PGLite fallback descends into it).",
    agentAction:
      "Copy the auth schema into the migrated directory (`cp migrations/auth/0001_auth.sql migrations/0001_auth.sql`, plus any later migrations/auth/*.sql in name order), restart, and re-run; or set VITE_AUTH_ENABLED=false to run without sign-in. Never let the app serve sign-in against a schema-less database.",
  },
  RT_E_MCP_DISABLED: {
    meaning:
      "F1 (R8-f11 / R13-f06): the MCP runtime client is owner-gated and DISABLED by default — no child process is spawned and zero network I/O is performed until the owner sets RAPIDTOOL_MCP_ENABLED=1. The JSON-RPC 2.0 stdio transport itself is implemented (src/lib/mcp.server.ts, 340-1); the trust gate, not a missing transport, is why nothing runs.",
    agentAction:
      "Do not simulate MCP discovery or fabricate tool lists: wait for the owner's trust decision, then set RAPIDTOOL_MCP_ENABLED=1 and re-run the read-only tools/list discovery (the stdio transport is implemented — src/lib/mcp.server.ts, see fixes/340_1_mcp.md).",
  },
  RT_E_PATH_KIND_MISMATCH: {
    meaning:
      "The path is the wrong KIND of filesystem entry for the operation — a directory where a file was required (EISDIR) or a non-directory where a directory was required (ENOTDIR).",
    agentAction:
      "Point the operation at the right kind of path (a file for a file read, a directory for a dir-scoped write) or move the blocking entry aside; do not retry the same path unchanged and never report it as missing.",
  },
  RT_E_IMPORT_TOO_LARGE: {
    meaning:
      "An import payload exceeded the paste-size cap (in characters) before any parse work — a hostile or corrupt paste the tool refuses to allocate.",
    agentAction:
      "Shrink the payload, or — only for a byte source that already holds it (the file loader) — raise the cap via importProject(…, { maxChars }); never parse an unbounded paste.",
  },
  RT_E_SUBSTANCE_EMPTY: {
    meaning:
      "A generated run/tree carries no substantive coverage of the brief — its core-noun hits are empty or only connective prose, even though a shallow file/arch count may have passed.",
    agentAction:
      "Do not treat the run as product-complete: read the substance census (core-noun hits, real vs stub/alias modules), re-synthesize the missing surface, and re-run; never lower the bar to make a hollow tree pass.",
  },
  RT_E_PLAN_UNDERPRODUCED: {
    meaning:
      "The brief demands more deliverable surface (features/entities/artifacts) than the plan produced — the run planned or emitted fewer substantively-covered items than the brief requires.",
    agentAction:
      "Read the per-brief requirement census, expand synthesis to cover the named deliverables, and re-run; never seal under-production as COMPLETE or trim the brief to match a thin plan.",
  },
  RT_E_DUPLICATE_EXPORT: {
    meaning:
      "A generated barrel re-exports the SAME member from two providers (TypeScript TS2308 / a duplicate export) — the module collides at load, not merely at typecheck.",
    agentAction:
      "Resolve the collision through the frozen export registry (one canonical provider per name) or refuse the offending chunk — never drop the export that satisfies a required signature to silence the error, and never rewrite the barrel by hand.",
  },
  RT_E_USE_BEFORE_DECL: {
    meaning:
      "A block-scoped binding is read in a generated module before its declaration (TypeScript TS2448) — the tree loads into a temporal-dead-zone error even when the per-chunk check passed.",
    agentAction:
      "Run the deterministic tree normalizer's dependency order / pure store hoist; if the read cannot be ordered without changing semantics, refuse with the bounded repair — never reorder a side-effecting declaration.",
  },
  RT_E_MONEY_SEMANTICS: {
    meaning:
      "A money-named or money-documented export accumulates a quantity (qty/quantity/count) with no price/unit-cost operand — arithmetic that is syntactically valid and brief-worded but returns the wrong amount.",
    agentAction:
      "Re-derive the helper from the entity's price field, or run the one bounded money-semantics repair; never accept the quantity-sum as a green result, and never let a deterministic validator pass arithmetic it did not measure.",
  },
  RT_E_README_PARITY: {
    meaning:
      "An emitted README's \"What ships in this scaffold\" manifest lists a path that does not exist on disk — the artifact contradicts itself about its own contents.",
    agentAction:
      "Filter the manifest rows to the files actually emitted and render an explicit \"declared, NOT emitted\" sub-table for the rest; never leave a manifest row that reads as shipped when the file is absent.",
  },
  RT_E_SRC_EDITED_DURING_RUN: {
    meaning:
      "A run observed `src/**` (or `scripts/**`) modified after the run began (RUNLOCK / BL-010) — the run's build artifacts and verdicts were produced against a tree that changed underneath it.",
    agentAction:
      "Discard the suspect run's evidence: stop the run, name the changed file(s), re-run against the frozen tree; never treat a concurrently-edited run as a clean measurement.",
  },
  RT_E_UI_UNWIRED: {
    meaning:
      "A mounted UI (the emitted console) imports a generated surface but calls no real generated export — the product's interface is unwired from its own logic, even when the tree typechecks.",
    agentAction:
      "Consume the single product predicate `realGeneratedExportWiring`: wire the UI to CALL a real generated export, or mark the delivery unverified; never seal an unwired console as a product.",
  },
  RT_E_SPEC_SKIP_VACUOUS: {
    meaning:
      "An emitted behavioural oracle is skip-dominated (mostly `test.skip` rows against a handful of live rows), so `npm test` exit 0 is vacuity, not behaviour.",
    agentAction:
      "Emit an oracle whose live assertions dominate and tie a module read to a concrete value; never count a skip-dominated green as tested or as behaviour.",
  },
  RT_E_SPEC_VACUOUS: {
    meaning:
      "An emitted spec runs green under `node --test` but carries no behavioural assertion (load-only, or only shape/presence probes such as `typeof x === 'function'` / `x !== null`), so its exit 0 is vacuity — the bounded spec leg refuses it even though the tree's own `npm test` reports pass.",
    agentAction:
      "Emit a spec with at least one assertion that ties a call/return (or a property of it) to a concrete expected value; never read the declared `npm test` exit 0 as behaviour when the spec leg refused it for vacuity — the disagreement between the two executions is the finding.",
  },
  RT_E_CLAIM_UNVERIFIED: {
    meaning:
      "A delivery record claims a product (git committed) without stating its real verification — no verification block and no `unverified` flag, though its evidence is absent.",
    agentAction:
      "State the verification block / `unverifiedReasons` in the delivery envelope, or mark the delivery unverified; never let an unverified commit read as a verified product.",
  },
  RT_E_GIT_CODE_INCONSISTENT: {
    meaning:
      "A withheld git envelope's nested `git.code`/`git.reason` names a different deciding reason than the top-level code (e.g. `substance-empty` beside `RT_E_TREE_RUN_FAILED`).",
    agentAction:
      "Set the withheld envelope's `git.code` to the deciding withhold code so nested and top-level agree; never leave the envelope contradicting its own verdict.",
  },
  RT_E_SYNTH_DEFAULT_DISARMED: {
    meaning:
      "The synthesis policy's armed chunk-resample default was silently re-disarmed (candidate count <= 1) — a revert of the enabled reliability lever while the resolver still consumes the constant.",
    agentAction:
      "Restore the armed default (`P6_SYNTH_CHUNK_RETRY_CANDIDATES` > 1) or make an explicit opt-out; never silently re-disarm the resample lever.",
  },
  RT_E_SYNTH_RESAMPLE_UNBOUNDED: {
    meaning:
      "A per-chunk, fail-fast, or whole-tree resample loop lacks the finite `P6_SYNTH_CANDIDATES_MAX` clamp — retries can run unbounded and blow the token budget.",
    agentAction:
      "Clamp every resample loop bound to the finite cap (>= 2 armed, <= 4 the cost bound); never run an unbounded resample.",
  },
  RT_E_REFUSAL_COVERAGE_LOST: {
    meaning:
      "A re-pinned refusal-path suite lost its genuine coded refusal assertion (a deleted/weakened `p6.synthesis.refused` made to pass) — the refusal floor is no longer pinned.",
    agentAction:
      "Restore the coded refusal assertion in the touched suite and keep the refused/coded-reason counts at or above their floor; never let a re-pin drop or loosen a refusal.",
  },
  RT_E_SYNTH_RESUME_NOT_REUSED: {
    meaning:
      "An accepted chunk was re-synthesized (paid for again) instead of being reused, though `ctx.resumeAccepted` was populated for the repair cycle.",
    agentAction:
      "Thread the previous cycle's accepted chunks into `ctx.resumeAccepted` and reuse any path present in `resumeByPath` with 0 synthesis prompts; never re-buy an accepted chunk.",
  },
  RT_E_JSX_IN_TS: {
    meaning:
      "An emitted `.ts` module contains JSX or names the global `JSX` namespace (TypeScript TS2503) — the JSX transform applies to `.tsx` only, so the tree fails its own typecheck.",
    agentAction:
      "Move JSX into a `.tsx` chunk or emit plain TypeScript; never ship a `.ts` module that references the JSX namespace or raw JSX.",
  },
  RT_E_VERIFIED_PRODUCT_UNEVIDENCED: {
    meaning:
      "A committed delivery claims `verifiedProduct` without the recorded verification block / evidence conjunction that backs the claim.",
    agentAction:
      "State `verifiedProduct` as exactly the recorded evidence conjunction (or `false` with reasons); never claim a verified product without the evidence.",
  },
  RT_E_DEFAULT_CHECK_BASELINE_LOST: {
    meaning:
      "A default-check baseline dropped a sample's `workingApp` score — only the flattering sample is pinned, so the recorded variance is erased.",
    agentAction:
      "Pin every sample's score (including the weaker one) with its `artifactComplete` flag; never drop a sample to make the baseline look better.",
  },
};
