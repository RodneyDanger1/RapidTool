/**
 * API-key SOURCE RESOLUTION (W45 · 331-1 "Keywright").
 *
 * WHY THIS EXISTS. Before W45 the keyed path read `process.env.DEEPSEEK_API_KEY`
 * and nothing ever loaded the repo's own `.env`. On a machine whose Windows
 * User-scope `DEEPSEEK_API_KEY` is stale, that ambient variable silently
 * shadowed the funded key the repo checkout actually carries — every keyed call
 * 401'd on a key the operator never chose, and the repo-owned key was dead
 * weight. This module makes the source choice EXPLICIT and observable:
 *
 *   PRECEDENCE (the documented rule — scripts/README-cli.md "API key resolution"):
 *     1. `<repo>/.env` `DEEPSEEK_API_KEY` when it holds a non-blank value — the
 *        repo-local secret store for THIS checkout.
 *     2. the process environment (`DEEPSEEK_API_KEY`, which on Windows includes
 *        User/Machine-scope variables inherited into the shell) — the fallback.
 *   When BOTH are present and DIFFER, `.env` wins and the caller must surface a
 *   loud, coded conflict signal naming BOTH last-4 tails (never a silent win,
 *   never a full secret).
 *
 *   BLANK DISABLES (the keyless-forcing convention): a process variable that is
 *   PRESENT but blank/whitespace is an intentional "no key" — `.env` must NOT be
 *   consulted. This is how a caller (or a test harness) forces the keyless floor
 *   on a machine that has a real `.env`. Absence (`undefined`/`null`) is NOT the
 *   same signal: absent ⇒ `.env` is the fallback source.
 *
 * Pure by construction: parsing and resolution take strings; the physical
 * `.env` read lives in the caller (`scripts/rapidtool-cli.mjs`), so this module
 * imports no `node:fs` and stays safe to unit-test. It is server-side only (the
 * `getActiveKeySource` provenance store is process state, meaningless client-side).
 *
 * SECRECY CONTRACT: a `ResolvedKeySource.value` is the live secret and must
 * NEVER be logged, serialized, or returned in an envelope. Diagnostics use
 * `tailOf()` (the last 4 chars) exclusively.
 */

/** The coded signal the CLI prints when a conflicting ambient key is shadowed. */
export const KEY_SHADOWED_CODE = "RT_E_LLM_KEY_SHADOWED";

/** The code a provider returns when the credential it sent was rejected (401). */
export const KEY_REJECTED_CODE = "RT_E_LLM_KEY_REJECTED";

export type KeySourceKind = "repo-env-file" | "process-env";

/** Which source a resolved key came from. `value` is the SECRET — never log it. */
export type ResolvedKeySource = {
  readonly kind: KeySourceKind;
  /** Absolute path when `kind === "repo-env-file"`; null for the process env. */
  readonly path: string | null;
  /** Last-4 tail for diagnostics. */
  readonly tail: string;
  /** The live secret. NEVER print/serialize this field. */
  readonly value: string;
};

/** Both tails when two DIFFERENT keys were present (`.env` won). */
export type KeyConflict = {
  readonly repoEnvTail: string;
  readonly processEnvTail: string;
};

export type KeyResolution = {
  readonly effective: ResolvedKeySource | null;
  /** Non-null ONLY when both sources held a non-blank, DIFFERENT value. */
  readonly conflict: KeyConflict | null;
};

/**
 * The loud, coded, tail-only conflict line every entry point prints when a
 * non-blank ambient value is shadowed by `.env`. Pure — callers own the stream.
 * The WHOLE secret never appears; only the two last-4 tails.
 */
export function formatShadowWarning(
  name: string,
  envFilePath: string,
  conflict: KeyConflict,
): string {
  return (
    `[${KEY_SHADOWED_CODE}] ${name} conflict: the .env key ` +
    `(${envFilePath}, tail …${conflict.repoEnvTail}) WINS over the ` +
    `process-environment key (tail …${conflict.processEnvTail}); using the .env key. ` +
    `Clear the stale ambient variable to silence this signal (tails only — never paste the full key).`
  );
}

/**
 * Last-4 tail for diagnostics. A value of four or fewer chars is masked
 * entirely (`****`) rather than echoed — a short secret has no safe tail.
 */
export function tailOf(secret: string | null | undefined, n = 4): string {
  const s = typeof secret === "string" ? secret : "";
  if (s.length === 0) return "";
  // A non-positive/non-finite width must never reach slice(-0)/slice(-(-n)),
  // which returns the WHOLE secret from a tail-only diagnostics helper —
  // fall back to the safe 4-char tail.
  const width = typeof n === "number" && Number.isFinite(n) && n > 0 ? Math.floor(n) : 4;
  return s.length > width ? s.slice(-width) : "*".repeat(Math.max(width, 4));
}

/** Trim to a usable key, or `null` for blank/absent/non-string input. */
function normalizeKey(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Parse a dotenv-shaped file into a key→value map. Deliberately small and
 * predictable — the subset real `.env` files use:
 *   - `#` comment lines and blank lines are skipped;
 *   - an optional `export ` prefix is accepted;
 *   - single/double-quoted values are unquoted (no escape expansion);
 *   - unquoted values keep everything up to a whitespace-preceded `#` comment;
 *   - a valueless `KEY=` yields `""` (present but blank ⇒ treated as absent by
 *     `resolveApiKey`, never as a usable key).
 * Never throws on hostile input: unparseable lines are ignored.
 */
export function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (typeof text !== "string") return out;
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) continue;
    const body = line.startsWith("export ") ? line.slice("export ".length).trim() : line;
    const eq = body.indexOf("=");
    if (eq <= 0) continue;
    const key = body.slice(0, eq).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = body.slice(eq + 1).trim();
    if (value.length >= 2) {
      const first = value[0];
      const last = value[value.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        out[key] = value.slice(1, -1);
        continue;
      }
    }
    // Unquoted: drop a trailing whitespace-preceded comment.
    const hash = value.search(/\s#/);
    if (hash !== -1) value = value.slice(0, hash).trim();
    out[key] = value;
  }
  return out;
}

/**
 * Resolve ONE key name across the two sources under the documented precedence.
 * See the module header. Pure: no I/O, no env mutation.
 */
export function resolveApiKey(input: {
  readonly name: string;
  readonly envFileValue?: string | null;
  readonly envFilePath: string;
  readonly processValue?: string | null;
}): KeyResolution {
  const envFile = normalizeKey(input.envFileValue);
  // Presence is distinct from value: `undefined`/`null` = absent, any string
  // (including "") = present. A present-but-blank process var is a DISABLE.
  const processPresent = input.processValue !== null && input.processValue !== undefined;
  const processVal = normalizeKey(input.processValue);
  if (processPresent && processVal === null) {
    return { effective: null, conflict: null };
  }
  const sourceOf = (value: string, kind: KeySourceKind): ResolvedKeySource => ({
    kind,
    path: kind === "repo-env-file" ? input.envFilePath : null,
    tail: tailOf(value),
    value,
  });
  if (envFile !== null) {
    const conflict =
      processVal !== null && processVal !== envFile
        ? { repoEnvTail: tailOf(envFile), processEnvTail: tailOf(processVal) }
        : null;
    return { effective: sourceOf(envFile, "repo-env-file"), conflict };
  }
  if (processVal !== null) {
    return { effective: sourceOf(processVal, "process-env"), conflict: null };
  }
  return { effective: null, conflict: null };
}

// ---------------------------------------------------------------------------
// Provenance store — how a rejected 401 names WHERE its key came from.
//
// The provider reads `process.env` at call time (byte-identical to before), so
// the resolved source would otherwise be lost by the time a 401 is mapped. The
// CLI installs the resolution here; `deepseek.ts` reads it to name the source
// (path or scope, tail-only) in the rejection message. No resolution installed
// ⇒ the provider honestly assumes the process environment.
// ---------------------------------------------------------------------------

let activeKeySource: ResolvedKeySource | null = null;

/** Record the source the effective key came from. `null` clears it. */
export function setActiveKeySource(src: ResolvedKeySource | null): void {
  activeKeySource =
    src && typeof src.value === "string" && src.value.length > 0 ? src : null;
}

/** The installed source, or null when none was ever recorded. */
export function getActiveKeySource(): ResolvedKeySource | null {
  return activeKeySource;
}

/**
 * A tail-only label for a source, for diagnostics. `key` is the value the
 * provider is about to send; when it matches the resolved source the recorded
 * source/path wins, otherwise the caller gets the honest process-environment
 * default. NEVER includes a full secret.
 */
export function describeKeySource(key: string): string {
  const src = activeKeySource;
  if (src && src.value === key) {
    return src.kind === "repo-env-file"
      ? `${src.path} (tail …${src.tail})`
      : `the process environment (tail …${src.tail})`;
  }
  return `the process environment (tail …${tailOf(key)})`;
}
