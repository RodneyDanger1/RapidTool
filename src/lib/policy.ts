// ---------------------------------------------------------------------------
// policy.ts — the ONE approval seam (216n · 107 T-107.3 · 100 P0-01/P0-02/P0-06).
//
// Why this exists: 100 P0-01 (actor-seam forgery) — `headless.ts:734` recorded
// `decidedBy: "human"` unconditionally, so any machine path (the eval harness,
// any headless drain) could mint a human actor with no TTY, no note and no seat
// evidence; the only guard sat on the CLI's `--force` path
// (`rapidtool-cli.mjs:517`). P0-02 then accepted exactly that row as proof of a
// human approval, and P0-06 composed the two into real gate advancement. The
// dossier's fix: "Route **every** approval through one `canSelfApprove`/seat
// predicate; make `decidedBy:"human"` require an out-of-band human token".
// This module is that predicate — one pure function that decides WHO may decide,
// for which ACTION, on which RESOURCE, and names the fallback when it says no.
//
// Boundary (deliberate): policy judges a CLAIM. Whether a gate exists / is
// pending stays with the engine (`phases.ts`, `store.approve`) — this module
// never invents gate state. W5 routes headless.ts:734, rapidtool-cli.mjs:517 and
// the dod.ts:337-483 provenance criteria through `evaluatePolicy`.
//
// Doctrine:
//   · PURE LEAF — no imports, no fs, no clock, no randomness, and NO
//     `process.env` read: the caller passes the expected out-of-band token in
//     (`ctx.expectedHumanSeatToken`), so the evaluator cannot be steered by
//     ambient environment (the purity test pins that setting
//     RT_HUMAN_SEAT_TOKEN changes nothing here).
//   · TOTAL — malformed ctx (null, a string, a number, a missing actor) is a
//     refusal, never a throw.
//   · DEFAULT-DENY — an unregistered action, a resource outside the action's
//     namespace, or a missing/unrecognized seat all DENY. Deny is the default so
//     a caller that forgets to think about policy fails closed, not open.
//
// Reason contract: every `reason` starts with a kebab id, then " — " and a
// human clause. Branch on the id (`reason.split(" — ")[0]`); the clause is prose
// for the ledger. Every DENY carries a `fallback` (type-enforced): the
// sanctioned alternative, or `"none"` when the request itself must be fixed.
// ---------------------------------------------------------------------------

/**
 * Structural mirror of `headless.ts`'s `ApproveActor` (216 TA-2 / P0-01) — kept
 * in sync BY SHAPE, not by import: headless.ts is a heavy backend module and
 * this module is a pure leaf. `policy.test.ts` type-asserts assignability both
 * ways-loose, so a seat-shape drift breaks typecheck instead of runtime.
 */
export type PolicySeat =
  | { decidedBy: "human"; seat: "human-cli-i-am-human" }
  | { decidedBy: "autopilot"; seat: "harness" | "autopilot" };

/** The registered action ids. Anything else is default-DENY. */
export type PolicyAction = "hitl.approve" | "hitl.force" | "tree.emit" | "repair.apply";

/**
 * The sanctioned alternative when a decision is denied.
 *   · `"autopilot-seat"`  — re-claim under the harness's own seat (the honest
 *                            machine seat; never `decidedBy: "human"`).
 *   · `"human-seat-token"` — a person must present the out-of-band token
 *                            (`RT_HUMAN_SEAT_TOKEN` exported in their own shell).
 *   · `"none"`             — no sanctioned fallback: fix the request itself
 *                            (unknown action or resource).
 */
export type PolicyFallback = "autopilot-seat" | "human-seat-token" | "none";

/** An allow: no fallback exists (and the type refuses one). */
export type PolicyAllow = { decision: "allow"; reason: string; fallback?: never };
/** A deny: the fallback is MANDATORY (type-enforced, per P0-01's fix shape). */
export type PolicyDeny = { decision: "deny"; reason: string; fallback: PolicyFallback };
export type PolicyVerdict = PolicyAllow | PolicyDeny;

/** What a caller may present. Unknown extra keys are ignored. */
export type PolicyCtx = {
  /** The seat claiming the decision. Missing/unrecognized ⇒ deny (default-deny). */
  actor?: PolicySeat;
  /** The token the caller presents (headless `approve` `opts.humanSeatToken`). */
  humanSeatToken?: string;
  /** The token the caller read from its own environment
   *  (`RT_HUMAN_SEAT_TOKEN`). Passed IN — this module never reads env. */
  expectedHumanSeatToken?: string;
};

type ActionRule = {
  /** The resource namespace this action may touch. */
  resource: RegExp;
  /** Human hint for the refusal message (the accepted shape). */
  resourceHint: string;
  /** True ⇒ only a verified human seat may decide (no machine self-approval). */
  requiresHumanSeat: boolean;
};

const POLICY_RULES: ReadonlyMap<PolicyAction, ActionRule> = new Map<PolicyAction, ActionRule>([
  [
    "hitl.approve",
    { resource: /^gate:P[0-9]+$/, resourceHint: "gate:P<n>", requiresHumanSeat: false },
  ],
  [
    "hitl.force",
    { resource: /^gate:P[0-9]+$/, resourceHint: "gate:P<n>", requiresHumanSeat: true },
  ],
  ["tree.emit", { resource: /^tree:.+$/, resourceHint: "tree:<path>", requiresHumanSeat: false }],
  ["repair.apply", { resource: /^tree:.+$/, resourceHint: "tree:<path>", requiresHumanSeat: false }],
]);

/** The registry surface — W5 iterates this to prove every action is routed. */
export const KNOWN_POLICY_ACTIONS: readonly PolicyAction[] = [...POLICY_RULES.keys()];

/** Bound a reason fragment so a hostile value cannot balloon the verdict. */
function clip(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

type SeatClaim =
  | { kind: "none" }
  | { kind: "unknown"; claim: string }
  | { kind: "seat"; seat: PolicySeat };

/** Classify a runtime actor value without trusting it (total). */
function classifySeat(actor: unknown): SeatClaim {
  if (actor === undefined) return { kind: "none" };
  if (actor === null || typeof actor !== "object") return { kind: "unknown", claim: typeof actor };
  const { decidedBy, seat } = actor as { decidedBy?: unknown; seat?: unknown };
  if (decidedBy === "human" && seat === "human-cli-i-am-human") {
    return { kind: "seat", seat: { decidedBy: "human", seat: "human-cli-i-am-human" } };
  }
  if (decidedBy === "autopilot" && (seat === "harness" || seat === "autopilot")) {
    return { kind: "seat", seat: { decidedBy: "autopilot", seat } };
  }
  return { kind: "unknown", claim: `${clip(String(decidedBy))}/${clip(String(seat))}` };
}

/**
 * The out-of-band token check, mirroring `headless.ts` `approve` (216 TA-2):
 * BOTH sides must be non-empty after trimming and must be equal — an unset
 * `RT_HUMAN_SEAT_TOKEN` (keyless machine) can never verify a human claim.
 * Takes `unknown` so malformed ctx is a `false`, not a throw.
 */
export function isVerifiedHumanSeatToken(ctx: unknown): boolean {
  if (ctx === null || typeof ctx !== "object") return false;
  const { humanSeatToken, expectedHumanSeatToken } = ctx as {
    humanSeatToken?: unknown;
    expectedHumanSeatToken?: unknown;
  };
  const expected = typeof expectedHumanSeatToken === "string" ? expectedHumanSeatToken.trim() : "";
  const presented = typeof humanSeatToken === "string" ? humanSeatToken.trim() : "";
  return expected.length > 0 && presented === expected;
}

/** The `[seat <label>]` ledger tag source (headless.ts `approve` note contract). */
export function seatLabel(actor: unknown): string {
  const claim = classifySeat(actor);
  if (claim.kind === "seat") return `${claim.seat.decidedBy}/${claim.seat.seat}`;
  if (claim.kind === "unknown") return "unknown";
  return "none";
}

function deny(reason: string, fallback: PolicyFallback): PolicyDeny {
  return { decision: "deny", reason, fallback };
}

/**
 * Decide whether `action` may proceed on `resource` under `ctx`.
 *
 * Default-DENY: unknown action ⇒ deny (`fallback: "none"`); resource outside the
 * action's namespace ⇒ deny (`"none"`); missing/unrecognized seat ⇒ deny.
 *
 * Seat rule (uniform, Rule A): a claim passes iff it is the `autopilot` seat, or
 * the `human` seat presenting the out-of-band token. `hitl.force` adds Rule B:
 * the human seat is REQUIRED — a machine may never force past a human gate.
 *
 * Pure / deterministic / total: no I/O, no clock, no env; identical inputs give
 * deep-equal verdicts; malformed inputs deny instead of throwing.
 */
export function evaluatePolicy(action: string, resource: string, ctx?: PolicyCtx): PolicyVerdict {
  const rawAction: unknown = action;
  if (typeof rawAction !== "string" || rawAction.length === 0) {
    return deny(`unknown-action — ${JSON.stringify(clip(String(rawAction)))} is not a registered action; default-deny.`, "none");
  }
  const rule = POLICY_RULES.get(rawAction as PolicyAction);
  if (rule === undefined) {
    return deny(
      `unknown-action — ${JSON.stringify(clip(rawAction))} is not in KNOWN_POLICY_ACTIONS (${KNOWN_POLICY_ACTIONS.join(", ")}); default-deny.`,
      "none",
    );
  }
  const rawResource: unknown = resource;
  if (typeof rawResource !== "string" || !rule.resource.test(rawResource)) {
    return deny(
      `unknown-resource — ${JSON.stringify(clip(String(rawResource)))} is outside ${rawAction}'s namespace (${rule.resourceHint} only); default-deny.`,
      "none",
    );
  }

  const claimed = classifySeat(
    ctx === null || typeof ctx !== "object" ? undefined : (ctx as { actor?: unknown }).actor,
  );
  const label = claimed.kind === "seat" ? `${claimed.seat.decidedBy}/${claimed.seat.seat}` : "none";

  if (rule.requiresHumanSeat) {
    if (claimed.kind === "seat" && claimed.seat.decidedBy === "human") {
      if (isVerifiedHumanSeatToken(ctx)) {
        return { decision: "allow", reason: `human-seat-token-verified — ${rawAction} on ${rawResource} under the verified human seat.` };
      }
      return deny(
        `human-seat-unverified — the human seat needs the out-of-band token: export RT_HUMAN_SEAT_TOKEN in your own shell and present it as humanSeatToken.`,
        "human-seat-token",
      );
    }
    if (claimed.kind === "seat") {
      return deny(
        `force-requires-human-seat — a ${label} seat may never force past a human gate; only a verified human seat may.`,
        "human-seat-token",
      );
    }
    if (claimed.kind === "unknown") {
      return deny(
        `unknown-seat — the claimed seat (${claimed.claim}) is not recognized; forcing a human gate needs the human seat plus its out-of-band token.`,
        "human-seat-token",
      );
    }
    return deny(
      `no-seat — no seat was presented; forcing a human gate needs the human seat plus its out-of-band token.`,
      "human-seat-token",
    );
  }

  if (claimed.kind === "seat") {
    if (claimed.seat.decidedBy === "autopilot") {
      return { decision: "allow", reason: `autopilot-seat — ${rawAction} on ${rawResource} under the harness's own seat.` };
    }
    if (isVerifiedHumanSeatToken(ctx)) {
      return { decision: "allow", reason: `human-seat-token-verified — ${rawAction} on ${rawResource} under the verified human seat.` };
    }
    return deny(
      `human-seat-unverified — the human seat needs the out-of-band token: export RT_HUMAN_SEAT_TOKEN in your own shell and present it as humanSeatToken.`,
      "human-seat-token",
    );
  }
  if (claimed.kind === "unknown") {
    return deny(
      `unknown-seat — the claimed seat (${claimed.claim}) is not a recognized seat shape; default-deny.`,
      "autopilot-seat",
    );
  }
  return deny(
    `no-seat — the caller presented no actor seat; claim the autopilot seat (decidedBy: "autopilot") instead.`,
    "autopilot-seat",
  );
}
