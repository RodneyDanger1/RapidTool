import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ApproveActor } from "./headless.ts";
import {
  KNOWN_POLICY_ACTIONS,
  evaluatePolicy,
  isVerifiedHumanSeatToken,
  seatLabel,
  type PolicyAction,
  type PolicySeat,
  type PolicyVerdict,
} from "./policy.ts";

/**
 * 216n · 107 T-107.3 · 100 P0-01 / P0-02 / P0-06 — pins for the approval seam.
 *
 * The failure this module exists to prevent is an actor-seam forgery (P0-01): a
 * machine minting `decidedBy:"human"` with no evidence, which P0-02 accepted as
 * a human approval and P0-06 composed into gate advancement. Done-when here is
 * therefore a *default-deny* proof: every unregistered action, out-of-namespace
 * resource and unrecognized seat denies, a human claim without the out-of-band
 * token denies, and `hitl.force` can never be self-approved by a machine seat —
 * while the routine machine path stays open under the harness's own seat.
 */

/** Branch on the kebab id every reason starts with (the machine contract). */
function reasonId(verdict: PolicyVerdict): string {
  return verdict.reason.split(" — ")[0] ?? "";
}

const HARNESS: PolicySeat = { decidedBy: "autopilot", seat: "harness" };
const AUTOPILOT: PolicySeat = { decidedBy: "autopilot", seat: "autopilot" };
const HUMAN: PolicySeat = { decidedBy: "human", seat: "human-cli-i-am-human" };
const VERIFIED = { humanSeatToken: "tok-123", expectedHumanSeatToken: "tok-123" };

const VALID_RESOURCE: Record<PolicyAction, string> = {
  "hitl.approve": "gate:P4",
  "hitl.force": "gate:P4",
  "tree.emit": "tree:src/lib/patch.ts",
  "repair.apply": "tree:src/lib/patch.ts",
  "fixtures.approve": "fixtures:build.json",
};

describe("policy — seat rule (Rule A: autopilot, or verified human)", () => {
  it("allows a routine gate approval under the harness's own autopilot seats", () => {
    for (const seat of [HARNESS, AUTOPILOT]) {
      const verdict = evaluatePolicy("hitl.approve", "gate:P4", { actor: seat });
      assert.equal(verdict.decision, "allow");
      assert.equal(reasonId(verdict), "autopilot-seat");
      assert.equal("fallback" in verdict, false, "an allow carries no fallback");
    }
  });

  it("allows a human seat only when the out-of-band token verifies", () => {
    const verdict = evaluatePolicy("hitl.approve", "gate:P5", { actor: HUMAN, ...VERIFIED });
    assert.equal(verdict.decision, "allow");
    assert.equal(reasonId(verdict), "human-seat-token-verified");
  });

  it("DENIES a human claim with no token — the P0-01 forgery — and names the fallback", () => {
    const verdict = evaluatePolicy("hitl.approve", "gate:P4", { actor: HUMAN });
    assert.equal(verdict.decision, "deny");
    assert.equal(reasonId(verdict), "human-seat-unverified");
    assert.equal(verdict.fallback, "human-seat-token");
    assert.match(verdict.reason, /RT_HUMAN_SEAT_TOKEN/);
  });

  it("DENIES a human claim whose token does not match the caller's expected token", () => {
    const verdict = evaluatePolicy("hitl.approve", "gate:P4", {
      actor: HUMAN,
      humanSeatToken: "forged",
      expectedHumanSeatToken: "real",
    });
    assert.equal(verdict.decision, "deny");
    assert.equal(verdict.fallback, "human-seat-token");
  });

  it("DENIES a human claim when nothing expected a token (keyless machine ⇒ no human seat)", () => {
    const verdict = evaluatePolicy("hitl.approve", "gate:P4", { actor: HUMAN, humanSeatToken: "tok" });
    assert.equal(verdict.decision, "deny", "an unset expected token can never be satisfied by a claim");
    assert.equal(verdict.fallback, "human-seat-token");
  });

  it("trims both token sides (headless.ts approve parity) so padding is not a bypass or a false deny", () => {
    const verdict = evaluatePolicy("hitl.approve", "gate:P4", {
      actor: HUMAN,
      humanSeatToken: "  tok-123  ",
      expectedHumanSeatToken: "tok-123",
    });
    assert.equal(verdict.decision, "allow");
    assert.equal(isVerifiedHumanSeatToken({ humanSeatToken: " tok ", expectedHumanSeatToken: "tok" }), true);
  });

  it("DENIES a missing seat and points at the autopilot seat as the honest fallback", () => {
    const verdict = evaluatePolicy("hitl.approve", "gate:P4", {});
    assert.equal(verdict.decision, "deny");
    assert.equal(reasonId(verdict), "no-seat");
    assert.equal(verdict.fallback, "autopilot-seat");
  });

  it("DENIES an unrecognized seat shape (default-deny, never a guess at intent)", () => {
    const verdict = evaluatePolicy("hitl.approve", "gate:P4", {
      actor: { decidedBy: "root", seat: "everyone" } as unknown as PolicySeat,
    });
    assert.equal(verdict.decision, "deny");
    assert.equal(reasonId(verdict), "unknown-seat");
    assert.equal(verdict.fallback, "autopilot-seat");
  });

  it("accepts an untrusted, unknown-typed actor claim verbatim and ECHOES it in the deny (W22-L1 · ledger #52)", () => {
    // git.server.ts's seatCtxOf holds the presented claim as `unknown` (it must
    // not trust any shape). With the widened PolicyCtxInput this call needs no
    // cast — and the refusal still names the malformed claim instead of erasing
    // it (the caller-side-narrowing alternative was rejected for exactly this).
    const untrusted: unknown = { decidedBy: "human" }; // malformed: no `seat` field
    const verdict = evaluatePolicy("repair.apply", "tree:C:/x", { actor: untrusted });
    assert.equal(verdict.decision, "deny");
    assert.equal(reasonId(verdict), "unknown-seat");
    assert.match(verdict.reason, /human\/undefined/);
  });
});

describe("policy — default-deny on unknown action / resource", () => {
  it("denies an unregistered action with fallback none — even when the seat evidence is perfect", () => {
    const verdict = evaluatePolicy("gate.approve", "gate:P4", { actor: HUMAN, ...VERIFIED });
    assert.equal(verdict.decision, "deny");
    assert.equal(reasonId(verdict), "unknown-action");
    assert.equal(verdict.fallback, "none", "no fallback can make an unknown action legal");
  });

  it("denies an empty or non-string action without throwing", () => {
    for (const action of ["", null, 42, undefined] as unknown[]) {
      const verdict = evaluatePolicy(action as string, "gate:P4", { actor: HARNESS });
      assert.equal(verdict.decision, "deny");
      assert.equal(reasonId(verdict), "unknown-action");
    }
  });

  it("denies a resource outside the action's namespace", () => {
    const badResources = ["", "P4", "tree:src/x.ts", "gate:P", "gate:p4", "gate:P4x"];
    for (const resource of badResources) {
      const verdict = evaluatePolicy("hitl.approve", resource, { actor: HARNESS });
      assert.equal(verdict.decision, "deny", `resource ${JSON.stringify(resource)} must not pass`);
      assert.equal(reasonId(verdict), "unknown-resource");
      assert.equal(verdict.fallback, "none");
    }
  });

  it("keeps each action inside its own namespace (gate actions cannot touch trees and vice versa)", () => {
    assert.equal(evaluatePolicy("hitl.approve", "tree:src/x.ts", { actor: HARNESS }).decision, "deny");
    assert.equal(evaluatePolicy("tree.emit", "gate:P4", { actor: HARNESS }).decision, "deny");
    assert.equal(evaluatePolicy("repair.apply", "gate:P4", { actor: HARNESS }).decision, "deny");
  });

  it("registers exactly the five documented actions", () => {
    assert.deepEqual(
      [...KNOWN_POLICY_ACTIONS].sort(),
      ["fixtures.approve", "hitl.approve", "hitl.force", "repair.apply", "tree.emit"],
    );
  });

  it("every registered action returns a branchable verdict for a valid ctx (registry consistency)", () => {
    for (const action of KNOWN_POLICY_ACTIONS) {
      const verdict = evaluatePolicy(action, VALID_RESOURCE[action], { actor: HARNESS });
      assert.ok(verdict.decision === "allow" || verdict.decision === "deny");
      assert.match(verdict.reason, /^[a-z][a-z0-9-]* — /, `reason must start with a kebab id: ${verdict.reason}`);
    }
  });
});

describe("policy — hitl.force can never be self-approved (Rule B)", () => {
  it("DENIES an autopilot seat trying to force past a human gate", () => {
    for (const seat of [HARNESS, AUTOPILOT]) {
      const verdict = evaluatePolicy("hitl.force", "gate:P6", { actor: seat });
      assert.equal(verdict.decision, "deny");
      assert.equal(reasonId(verdict), "force-requires-human-seat");
      assert.equal(verdict.fallback, "human-seat-token");
    }
  });

  it("DENIES a bare force with no seat at all", () => {
    const verdict = evaluatePolicy("hitl.force", "gate:P6", {});
    assert.equal(verdict.decision, "deny");
    assert.equal(reasonId(verdict), "no-seat");
    assert.equal(verdict.fallback, "human-seat-token");
  });

  it("ALLOWS force only under a verified human seat", () => {
    const verdict = evaluatePolicy("hitl.force", "gate:P6", { actor: HUMAN, ...VERIFIED });
    assert.equal(verdict.decision, "allow");
    assert.equal(reasonId(verdict), "human-seat-token-verified");
  });

  it("DENIES a human force claim without the token", () => {
    const verdict = evaluatePolicy("hitl.force", "gate:P6", { actor: HUMAN });
    assert.equal(verdict.decision, "deny");
    assert.equal(reasonId(verdict), "human-seat-unverified");
  });
});

describe("policy — machine writes and the uniform seat rule", () => {
  it("allows tree.emit / repair.apply under either autopilot seat", () => {
    for (const action of ["tree.emit", "repair.apply"] as const) {
      for (const seat of [HARNESS, AUTOPILOT]) {
        const verdict = evaluatePolicy(action, VALID_RESOURCE[action], { actor: seat });
        assert.equal(verdict.decision, "allow", `${action} must stay open under the machine seat`);
      }
    }
  });

  it("allows the same actions under a verified human seat (one rule, no special cases)", () => {
    const verdict = evaluatePolicy("tree.emit", "tree:src/x.ts", { actor: HUMAN, ...VERIFIED });
    assert.equal(verdict.decision, "allow");
  });

  it("denies machine writes with no seat or an unrecognized seat", () => {
    assert.equal(reasonId(evaluatePolicy("tree.emit", "tree:src/x.ts", {})), "no-seat");
    assert.equal(
      reasonId(evaluatePolicy("repair.apply", "tree:src/x.ts", { actor: "harness" as unknown as PolicySeat })),
      "unknown-seat",
    );
  });
});

describe("policy — purity, determinism, totality, seat-shape compatibility", () => {
  it("is deterministic: identical inputs give deep-equal verdicts (allow and deny)", () => {
    assert.deepEqual(
      evaluatePolicy("hitl.approve", "gate:P4", { actor: HARNESS }),
      evaluatePolicy("hitl.approve", "gate:P4", { actor: HARNESS }),
    );
    assert.deepEqual(
      evaluatePolicy("hitl.approve", "gate:P4", { actor: HUMAN }),
      evaluatePolicy("hitl.approve", "gate:P4", { actor: HUMAN }),
    );
    assert.deepEqual(
      evaluatePolicy("nope", "gate:P4", { actor: HARNESS }),
      evaluatePolicy("nope", "gate:P4", { actor: HARNESS }),
    );
  });

  it("is total: malformed ctx refuses instead of throwing", () => {
    const cases: unknown[] = [null, undefined, 42, "ctx", true, { actor: 42 }, { actor: null }];
    for (const ctx of cases) {
      const verdict = evaluatePolicy("hitl.approve", "gate:P4", ctx as Parameters<typeof evaluatePolicy>[2]);
      assert.equal(verdict.decision, "deny", `ctx ${JSON.stringify(ctx)} must deny, not throw`);
      assert.equal(typeof verdict.reason, "string");
    }
  });

  it("never reads process.env: a set RT_HUMAN_SEAT_TOKEN changes nothing here (purity teeth)", () => {
    const previous = process.env.RT_HUMAN_SEAT_TOKEN;
    process.env.RT_HUMAN_SEAT_TOKEN = "leaked-token";
    try {
      const ambient = evaluatePolicy("hitl.approve", "gate:P4", { actor: HUMAN, humanSeatToken: "leaked-token" });
      assert.equal(ambient.decision, "deny", "policy must not consult the environment for its own authority");
      const explicit = evaluatePolicy("hitl.approve", "gate:P4", {
        actor: HUMAN,
        humanSeatToken: "leaked-token",
        expectedHumanSeatToken: "leaked-token",
      });
      assert.equal(explicit.decision, "allow", "the caller passes the expected token in — that path works");
    } finally {
      if (previous === undefined) delete process.env.RT_HUMAN_SEAT_TOKEN;
      else process.env.RT_HUMAN_SEAT_TOKEN = previous;
    }
  });

  it("mutates nothing: a frozen ctx still evaluates", () => {
    const ctx = Object.freeze({ actor: Object.freeze({ ...HUMAN }), humanSeatToken: "t", expectedHumanSeatToken: "t" });
    const verdict = evaluatePolicy("hitl.approve", "gate:P4", ctx as Parameters<typeof evaluatePolicy>[2]);
    assert.equal(verdict.decision, "allow");
    assert.equal(ctx.humanSeatToken, "t");
  });

  it("is shape-compatible with headless.ts's ApproveActor (type-only import; read-only)", () => {
    const humanActor: ApproveActor = { decidedBy: "human", seat: "human-cli-i-am-human" };
    const autopilotActor: ApproveActor = { decidedBy: "autopilot", seat: "harness" };
    // Compile-time pin: if ApproveActor drifts away from PolicySeat, this line
    // is the typecheck failure that names the contract break.
    const seats: PolicySeat[] = [humanActor, autopilotActor];
    assert.equal(seatLabel(seats[0]), "human/human-cli-i-am-human");
    assert.equal(seatLabel(seats[1]), "autopilot/harness");
    assert.equal(evaluatePolicy("hitl.approve", "gate:P4", { actor: humanActor, ...VERIFIED }).decision, "allow");
    assert.equal(evaluatePolicy("hitl.approve", "gate:P4", { actor: autopilotActor }).decision, "allow");
  });

  it("labels seats for the ledger tag (headless `[seat <label>]` parity)", () => {
    assert.equal(seatLabel(HARNESS), "autopilot/harness");
    assert.equal(seatLabel(AUTOPILOT), "autopilot/autopilot");
    assert.equal(seatLabel({ decidedBy: "root" }), "unknown");
    assert.equal(seatLabel(undefined), "none");
  });
});
