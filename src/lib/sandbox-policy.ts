/**
 * Isolation claim for the generated-code runner.
 *
 * RapidTool does NOT have Docker or bwrap. node-runner.server.ts is a
 * bounded timeout + PATH-only env allowlist. This module exists so no
 * caller can mint `sandbox: true` without an actual isolator.
 *
 * Residual harden (207): claim is frozen; any untrusted input is coerced
 * back to the honest non-sandbox advertisement (never trust raw.sandbox).
 */
export type IsolationKind = "none";

export type IsolationClaim = {
  sandbox: false;
  kind: IsolationKind;
  docker: false;
  bwrap: false;
  note: string;
};

export const RUNNER_IS_NOT_A_SANDBOX =
  "RapidTool's node-runner is a bounded timeout + env allowlist. It is NOT Docker, bwrap, or a security sandbox.";

const HONEST_CLAIM: IsolationClaim = Object.freeze({
  sandbox: false,
  kind: "none",
  docker: false,
  bwrap: false,
  note: RUNNER_IS_NOT_A_SANDBOX,
});

/** Always advertises non-sandbox. Return value is frozen. */
export function runnerIsolationClaim(): IsolationClaim {
  return HONEST_CLAIM;
}

/**
 * Coerce any untrusted blob to the honest claim. Ignores `sandbox: true`,
 * `docker: true`, `kind: "docker"`, etc. — never re-emits a true sandbox flag.
 */
export function coerceIsolationClaim(_raw?: unknown): IsolationClaim {
  return HONEST_CLAIM;
}

/**
 * True only for the honest shape (sandbox/docker/bwrap all false, kind none).
 * Anything else (including missing fields or sandbox:true) is dishonest.
 */
export function isHonestIsolationClaim(raw: unknown): raw is IsolationClaim {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const c = raw as Record<string, unknown>;
  return (
    c.sandbox === false &&
    c.docker === false &&
    c.bwrap === false &&
    c.kind === "none" &&
    typeof c.note === "string" &&
    c.note.length > 0
  );
}
