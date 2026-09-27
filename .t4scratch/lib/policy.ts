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
//
// F4 (fixes/252 LANE 2 · 221 §F4): the per-ACTION allow-lists. Precedence, one
// line: policy decides *who may decide*; the overlay only narrows *what this
// project permits*. Narrow-only by construction — `applyPolicyOverlay` receives
// a verdict and can only return that verdict or a deny; it never constructs an
// allow, and it can never cross the seat rule above it.
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
export type PolicyAction = "hitl.approve" | "hitl.force" | "tree.emit" | "repair.apply" | "fixtures.approve";

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
/**
 * A deny: the fallback is MANDATORY (type-enforced, per P0-01's fix shape).
 * F4 (fixes/252): a per-action list refusal additionally carries its coded
 * value and the action it names (`code: "policy.action-off-list:hitl.force"`,
 * `action: "hitl.force"`). Both optional — every existing consumer keeps
 * working unchanged, and a plain seat/convention deny carries neither.
 */
export type PolicyDeny = {
  decision: "deny";
  reason: string;
  fallback: PolicyFallback;
  /** The per-action refusal code (names the action). Absent on seat denies. */
  code?: string;
  /** The action a per-action refusal names, verbatim from the caller. */
  action?: string;
};
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

/**
 * The TOTAL-input mirror of `PolicyCtx` (W22-L1 · ledger #52): this seam's
 * runtime contract has always been "malformed input denies, never throws"
 * (`classifySeat` re-classifies the raw actor itself and takes `unknown`), so
 * a caller holding an UNTRUSTED claim — e.g. `git.server.ts`'s `seatCtxOf`,
 * which must not trust any presented shape — may present it verbatim. The raw
 * value still crosses to the verdict so a refusal can ECHO the malformed claim
 * ("the claimed seat (…) is not a recognized seat shape"); narrowing at the
 * caller would silently erase that evidence. Constructing a *recognized* seat
 * stays `PolicyCtx`'s job.
 */
export type PolicyCtxInput = {
  actor?: unknown;
  humanSeatToken?: string;
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
  // R5-f02 (W29 · A2-f01 · R11-f05): `fixtures --approve` mints an acceptance
  // approval — the same class of human decision `hitl.approve` guards — so it
  // routes through this seam with requiresHumanSeat:true. Contract: the CLI
  // stamps `decidedBy` from the VERDICT (never forged), and a deny writes
  // nothing (scripts/rapidtool-cli.mjs fixtures arm).
  ["fixtures.approve", { resource: /^fixtures:.+$/, resourceHint: "fixtures:<project>", requiresHumanSeat: true }],
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
export function evaluatePolicy(action: string, resource: string, ctx?: PolicyCtx | PolicyCtxInput): PolicyVerdict {
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

// ---------------------------------------------------------------------------
// F4 · per-ACTION allow-lists (fixes/252 LANE 2 · 221 §F4 · 220 row F4).
//
// 219f §2.7 + B4: the field (opencode/Roo/codex) allow-lists at *action*
// granularity; this seam was already action-shaped but had no list. These
// helpers add the NARROWING half only: a build may withhold an action; nothing
// here can permit one. `autoApprovePhases` is deliberately absent — a list that
// can only WIDEN is an owner decision, not a default this module invents.
//
// Matching is exact registered-action only — no globs, no regex, no DSL
// (221 §F4 item 8). A list naming an unregistered action, a queried pairing
// outside the action's namespace, or a malformed shape FAILS CLOSED, and every
// refusal is CODED and names the action (`policy.action-off-list:hitl.force`)
// — never a generic error.
// ---------------------------------------------------------------------------

/** Which list (or fail-closed family) produced a refusal. */
export type PolicyOverlayRule = "allowActions" | "denyActions" | "alwaysAsk" | "unreadable" | "escape";

/**
 * The narrowing half of 221 §F4 item 1 — the build's per-ACTION allow-lists.
 * All three keys are optional and independent; absent ⇒ that list narrows
 * nothing (the byte-identical default, never a widened one).
 *   · `allowActions` — when declared, ONLY these actions pass the overlay;
 *     every other action is refused off-list.
 *   · `denyActions`  — these actions are refused outright.
 *   · `alwaysAsk`    — these actions are refused unless a human decides.
 * `denyCommands` (221 item 4) is NOT read here: it is a runner-seam concern,
 * not a seat/action claim, and this leaf stays action-shaped.
 */
export type PolicyOverlay = {
  allowActions?: readonly string[];
  denyActions?: readonly string[];
  alwaysAsk?: readonly string[];
};

/** Result of reading an untrusted overlay value. */
export type PolicyOverlayRead =
  | { ok: true; overlay: PolicyOverlay; ignored: readonly string[] }
  | { ok: false; detail: string };

/**
 * A per-action refusal. `code` ALWAYS names the action
 * (`policy.action-off-list:hitl.force`), so an off-list refusal for one action
 * can never be confused with another's — and never with the generic runtime
 * fallbacks (`RT_E_UNKNOWN` / `RT_E_VALIDATION`) that a swallowed exception
 * would mint. The code is namespaced to this seam rather than the `errors.ts`
 * `RT_E_*` registry: that registry is pinned by `errors.test.ts` and no RT_E
 * code is minted unregistered (the ledger's unregistered-RT_E defect class).
 * A policy refusal is a VERDICT, not a thrown failure: it travels as a
 * `PolicyVerdict` (plus `code`/`action`) or as this record.
 */
export type PolicyRefusal = {
  code: string;
  rule: PolicyOverlayRule;
  /** The action this refusal names. */
  action: string;
  detail: string;
  fallback: PolicyFallback;
};

const REFUSAL_IDS: Record<PolicyOverlayRule, string> = {
  allowActions: "policy.action-off-list",
  denyActions: "policy.action-denied",
  alwaysAsk: "policy.action-ask",
  unreadable: "policy.action-list-unreadable",
  escape: "policy.action-list-escape",
};

/** Reason kebab id per rule (this module's reason contract). */
const REFUSAL_REASON_IDS: Record<PolicyOverlayRule, string> = {
  allowActions: "action-off-list",
  denyActions: "action-denied",
  alwaysAsk: "action-ask",
  unreadable: "action-list-unreadable",
  escape: "action-list-escape",
};

/** The coded refusal value for `action` under `rule` — always names the action. */
export function policyRefusalCode(action: string, rule: PolicyOverlayRule): string {
  return `${REFUSAL_IDS[rule]}:${clip(action)}`;
}

const OVERLAY_KEYS = ["allowActions", "denyActions", "alwaysAsk"] as const;

/**
 * Read an untrusted overlay value. `undefined` (the field is absent) is the
 * no-narrowing default; anything else must be an object whose declared lists
 * are arrays of non-empty action ids — otherwise the read fails (fail-closed:
 * the caller refuses rather than silently ignoring a rule it cannot parse).
 * Unknown keys (e.g. the runner's `denyCommands`) are reported in `ignored` so
 * a caller can warn — never silently dropped as if enforced.
 */
export function readPolicyOverlay(raw: unknown): PolicyOverlayRead {
  if (raw === undefined) return { ok: true, overlay: {}, ignored: [] };
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, detail: `${JSON.stringify(clip(String(raw)))} is not an overlay object` };
  }
  const source = raw as Record<string, unknown>;
  const overlay: PolicyOverlay = {};
  const ignored: string[] = [];
  for (const key of Object.keys(source)) {
    if (!(OVERLAY_KEYS as readonly string[]).includes(key)) ignored.push(clip(key, 30));
  }
  for (const key of OVERLAY_KEYS) {
    const value = source[key];
    if (value === undefined) continue;
    if (!Array.isArray(value)) return { ok: false, detail: `${key} is not a list` };
    const list: string[] = [];
    for (const entry of value) {
      if (typeof entry !== "string" || entry.trim().length === 0) {
        return { ok: false, detail: `${key} carries a non-action entry (${JSON.stringify(clip(String(entry)))})` };
      }
      list.push(entry);
    }
    overlay[key] = list;
  }
  return { ok: true, overlay, ignored };
}

function policyRefusalFor(action: string, rule: PolicyOverlayRule, detail: string, fallback: PolicyFallback): PolicyRefusal {
  return { code: policyRefusalCode(action, rule), rule, action: clip(action), detail, fallback };
}

/**
 * The narrowing question, asked directly — the console asks this before it
 * offers a control. Does this build's per-action list refuse `action` on
 * `resource`? Returns the coded refusal, or `null` when the list does not
 * narrow it (including when no list is declared at all). Total: malformed
 * arguments refuse (or return `null` for no list), never throw.
 */
export function policyOverlayRefusal(rawOverlay: unknown, action: string, resource: string): PolicyRefusal | null {
  if (rawOverlay === undefined) return null; // no list declared ⇒ nothing narrows
  const actionId = typeof action === "string" && action.length > 0 ? action : clip(String(action));
  const read = readPolicyOverlay(rawOverlay);
  if (!read.ok) {
    return policyRefusalFor(
      actionId,
      "unreadable",
      `this build's per-action list is unreadable (${read.detail}); default-deny — fix the list before any action passes.`,
      "none",
    );
  }
  const listed = [
    ...(read.overlay.allowActions ?? []),
    ...(read.overlay.denyActions ?? []),
    ...(read.overlay.alwaysAsk ?? []),
  ];
  const unregistered = listed.find((entry) => !POLICY_RULES.has(entry as PolicyAction));
  if (unregistered !== undefined) {
    return policyRefusalFor(
      actionId,
      "escape",
      `the per-action list names ${JSON.stringify(clip(unregistered))}, which is not a registered action (${KNOWN_POLICY_ACTIONS.join(", ")}); default-deny.`,
      "none",
    );
  }
  const rule = POLICY_RULES.get(actionId as PolicyAction);
  if (rule === undefined || typeof resource !== "string" || !rule.resource.test(resource)) {
    return policyRefusalFor(
      actionId,
      "escape",
      `${JSON.stringify(clip(typeof resource === "string" ? resource : String(resource)))} is not inside ${clip(actionId)}'s registered namespace (${rule?.resourceHint ?? "unregistered action"}); the pairing cannot be narrowed, so default-deny.`,
      "none",
    );
  }
  if (read.overlay.allowActions !== undefined && !read.overlay.allowActions.includes(actionId)) {
    return policyRefusalFor(
      actionId,
      "allowActions",
      `${clip(actionId)} is not on this build's per-action allowActions list; refused off-list (the list only narrows — it never widens a default).`,
      "none",
    );
  }
  if ((read.overlay.denyActions ?? []).includes(actionId)) {
    return policyRefusalFor(
      actionId,
      "denyActions",
      `${clip(actionId)} is on this build's per-action denyActions list; refused.`,
      "none",
    );
  }
  if ((read.overlay.alwaysAsk ?? []).includes(actionId)) {
    return policyRefusalFor(
      actionId,
      "alwaysAsk",
      `${clip(actionId)} is on this build's per-action alwaysAsk list; it needs an explicit human decision, not a machine pass.`,
      "human-seat-token",
    );
  }
  return null;
}

/**
 * Narrow a verdict through the per-action lists (221 §F4 item 2 signature).
 *
 * NARROW-ONLY BY CONSTRUCTION: the return is either the INPUT verdict object
 * unchanged (no match, or the input was already a deny) or a `deny` built here.
 * This function never constructs `{decision:"allow"}` — no allow can be minted,
 * and the seat rule that produced the input verdict is never widened,
 * reordered and never crossed. Precedence (each list may only withhold):
 * unreadable → escape → allowActions → denyActions → alwaysAsk.
 * A DENY input is returned even when a list would also match: it is already
 * refused, and narrowing must not re-label or soften it.
 */
export function applyPolicyOverlay(
  verdict: PolicyVerdict,
  rawOverlay: unknown,
  action: string,
  resource: string,
): PolicyVerdict {
  const narrowed = policyOverlayRefusal(rawOverlay, action, resource);
  if (narrowed === null) return verdict;
  if (verdict.decision === "deny") return verdict;
  return {
    decision: "deny",
    reason: `${REFUSAL_REASON_IDS[narrowed.rule]} — ${narrowed.detail}`,
    fallback: narrowed.fallback,
    code: narrowed.code,
    action: narrowed.action,
  };
}
