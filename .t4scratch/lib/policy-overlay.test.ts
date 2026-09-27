import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  KNOWN_POLICY_ACTIONS,
  applyPolicyOverlay,
  evaluatePolicy,
  policyOverlayRefusal,
  policyRefusalCode,
  readPolicyOverlay,
  type PolicyAction,
  type PolicySeat,
  type PolicyVerdict,
} from "./policy.ts";

/**
 * F4 (fixes/252 LANE 2 · 221 §F4 · `220` row F4) — pins for the per-ACTION
 * allow-lists (the autonomy boundary).
 *
 * The property under test is NARROW-ONLY: the overlay receives a verdict and
 * can only return that verdict (byte-identical — the same object) or a deny.
 * So the done-when is a truth table plus two teeth:
 *   · an OFF-LIST action is refused with its OWN code, naming the action
 *     (`policy.action-off-list:hitl.approve`) — never a generic error;
 *   · an ON-LIST action passes, unchanged;
 *   · a DENY input never becomes an allow, whatever the lists say;
 *   · a malformed list and a namespace escape FAIL CLOSED.
 *
 * Every "allow" fed to the overlay comes from `evaluatePolicy` itself — the
 * real seam verdict — never a hand-built `{decision:"allow"}` fixture, so the
 * tests prove the overlay's behaviour on a verdict the engine can actually
 * produce.
 */

/** Branch on the kebab id every reason starts with (the machine contract). */
function reasonId(verdict: PolicyVerdict): string {
  return verdict.reason.split(" — ")[0] ?? "";
}

const HARNESS: PolicySeat = { decidedBy: "autopilot", seat: "harness" };

const VALID_RESOURCE: Record<PolicyAction, string> = {
  "hitl.approve": "gate:P4",
  "hitl.force": "gate:P6",
  "tree.emit": "tree:src/lib/patch.ts",
  "repair.apply": "tree:src/lib/patch.ts",
  "fixtures.approve": "fixtures:build.json",
};

/** A REAL seam allow (the autopilot seat) for the action — the overlay's input. */
function seamAllow(action: PolicyAction): PolicyVerdict {
  return evaluatePolicy(action, VALID_RESOURCE[action], { actor: HARNESS });
}

/** A REAL seam deny (no seat presented) — the input that must never widen. */
function seamDeny(action: PolicyAction): PolicyVerdict {
  return evaluatePolicy(action, VALID_RESOURCE[action], {});
}

describe("policy overlay — an off-list action is refused with its OWN code", () => {
  it("refuses an action missing from allowActions, coded and named", () => {
    const verdict = applyPolicyOverlay(
      seamAllow("hitl.approve"),
      { allowActions: ["tree.emit", "repair.apply"] },
      "hitl.approve",
      "gate:P4",
    );
    assert.equal(verdict.decision, "deny");
    assert.equal(verdict.code, "policy.action-off-list:hitl.approve");
    assert.equal(verdict.action, "hitl.approve");
    assert.equal(verdict.fallback, "none", "the request itself is off-list — no fallback can make it legal");
    assert.equal(reasonId(verdict), "action-off-list");
    assert.match(verdict.reason, /^[a-z][a-z0-9-]* — /, "the module's reason contract still holds");
    assert.match(verdict.reason, /hitl\.approve/);
  });

  it("gives two different off-list actions their own distinct codes (never one generic error)", () => {
    const overlay = { allowActions: ["tree.emit"] };
    const approve = policyOverlayRefusal(overlay, "hitl.approve", "gate:P4");
    const force = policyOverlayRefusal(overlay, "hitl.force", "gate:P6");
    assert.equal(approve?.code, "policy.action-off-list:hitl.approve");
    assert.equal(force?.code, "policy.action-off-list:hitl.force");
    assert.notEqual(approve?.code, force?.code, "a refusal must name the action it refuses");
    for (const refusal of [approve, force]) {
      assert.equal(refusal?.rule, "allowActions");
      assert.doesNotMatch(
        refusal?.code ?? "",
        /RT_E_UNKNOWN|RT_E_VALIDATION|RT_E_INTERNAL|unknown-action/,
        "an off-list refusal must never degrade to a generic error",
      );
      assert.match(refusal?.code ?? "", /^policy\.action-off-list:/);
    }
  });

  it("refuses every registered action with its own code when the list permits none (registry iteration)", () => {
    for (const action of KNOWN_POLICY_ACTIONS) {
      const refusal = policyOverlayRefusal({ allowActions: [] }, action, VALID_RESOURCE[action]);
      assert.equal(refusal?.code, `policy.action-off-list:${action}`, `${action} must be refused off-list by its own code`);
      assert.equal(refusal?.action, action);
    }
  });

  it("documents that an empty allowActions list refuses everything (declared ⇒ enforced, fail-closed)", () => {
    const verdict = applyPolicyOverlay(seamAllow("tree.emit"), { allowActions: [] }, "tree.emit", "tree:src/x.ts");
    assert.equal(verdict.decision, "deny");
    assert.equal(verdict.code, "policy.action-off-list:tree.emit");
  });
});

describe("policy overlay — an on-list action passes unchanged (no widened default)", () => {
  it("returns the IDENTICAL verdict object when no list matches", () => {
    const allow = seamAllow("hitl.approve");
    const out = applyPolicyOverlay(allow, { denyActions: ["tree.emit"] }, "hitl.approve", "gate:P4");
    assert.equal(out, allow, "an unrelated list must pass the same object through");
    assert.equal(out.decision, "allow");
  });

  it("returns the IDENTICAL verdict object for an action ON the allowActions list", () => {
    const allow = seamAllow("tree.emit");
    const out = applyPolicyOverlay(allow, { allowActions: ["tree.emit"] }, "tree.emit", "tree:src/x.ts");
    assert.equal(out, allow);
    assert.equal(out.decision, "allow");
  });

  it("returns the IDENTICAL verdict object when the build declares no list at all", () => {
    const allow = seamAllow("repair.apply");
    assert.equal(applyPolicyOverlay(allow, undefined, "repair.apply", "tree:src/x.ts"), allow);
    assert.equal(applyPolicyOverlay(allow, {}, "repair.apply", "tree:src/x.ts"), allow);
  });

  it("keeps a human-forced action's seat rule intact — the list never crosses Rule B", () => {
    // hitl.force is human-only at the seat layer; an overlay that does not name
    // it must not change what that seat rule decided.
    const noHumanDeny = applyPolicyOverlay(seamDeny("hitl.force"), { allowActions: ["hitl.force"] }, "hitl.force", "gate:P6");
    assert.equal(reasonId(noHumanDeny), "no-seat", "the seat rule's refusal is not re-labelled by the list");
    // …and even a list that EXPLICITLY permits hitl.force cannot soften Rule B:
    // the machine seat's force refusal comes back byte-identical.
    const machineForce = evaluatePolicy("hitl.force", "gate:P6", { actor: HARNESS });
    assert.equal(reasonId(machineForce), "force-requires-human-seat");
    const allowedByList = applyPolicyOverlay(
      machineForce,
      { allowActions: ["hitl.force"] },
      "hitl.force",
      "gate:P6",
    );
    assert.equal(allowedByList, machineForce, "an allow-list entry must never relax a seat refusal");
    assert.equal(allowedByList.decision, "deny");
  });
});

describe("policy overlay — 221 §F4 truth table", () => {
  it("allow + denyActions match → deny / fallback none", () => {
    const verdict = applyPolicyOverlay(seamAllow("hitl.approve"), { denyActions: ["hitl.approve"] }, "hitl.approve", "gate:P4");
    assert.equal(verdict.decision, "deny");
    assert.equal(verdict.fallback, "none");
    assert.equal(verdict.code, "policy.action-denied:hitl.approve");
    assert.equal(reasonId(verdict), "action-denied");
  });

  it("allow + alwaysAsk match → deny / fallback human-seat-token", () => {
    const verdict = applyPolicyOverlay(seamAllow("hitl.approve"), { alwaysAsk: ["hitl.approve"] }, "hitl.approve", "gate:P4");
    assert.equal(verdict.decision, "deny");
    assert.equal(verdict.fallback, "human-seat-token");
    assert.equal(verdict.code, "policy.action-ask:hitl.approve");
    assert.equal(reasonId(verdict), "action-ask");
    assert.match(verdict.reason, /explicit human decision/);
  });

  it("denyActions outranks alwaysAsk when both name the action (a withheld action is never softened)", () => {
    const overlay = { denyActions: ["hitl.approve"], alwaysAsk: ["hitl.approve"] };
    const verdict = applyPolicyOverlay(seamAllow("hitl.approve"), overlay, "hitl.approve", "gate:P4");
    assert.equal(verdict.decision, "deny");
    assert.equal(verdict.code, "policy.action-denied:hitl.approve");
    assert.equal(verdict.fallback, "none");
  });

  it("allowActions is the outer gate: an action on both allowActions and denyActions is still denied", () => {
    const overlay = { allowActions: ["hitl.approve", "tree.emit"], denyActions: ["hitl.approve"] };
    const verdict = applyPolicyOverlay(seamAllow("hitl.approve"), overlay, "hitl.approve", "gate:P4");
    assert.equal(verdict.decision, "deny");
    assert.equal(verdict.code, "policy.action-denied:hitl.approve");
  });
});

describe("policy overlay — a deny input NEVER becomes an allow", () => {
  it("passes every deny through unchanged and unlabelled, whatever the lists say", () => {
    const deny = seamDeny("hitl.approve");
    const overlays: unknown[] = [
      undefined,
      {},
      { allowActions: ["hitl.approve"] },
      { denyActions: ["tree.emit"] },
      { alwaysAsk: ["hitl.approve"] },
      "not-an-overlay",
    ];
    for (const overlay of overlays) {
      const out = applyPolicyOverlay(deny, overlay, "hitl.approve", "gate:P4");
      assert.equal(out, deny, "the same deny object must come back");
      assert.equal(out.decision, "deny");
      assert.equal(reasonId(out), "no-seat", "the seat rule's refusal is never re-labelled by a list");
    }
  });

  it("can never mint an allow: an allow in the output is always the identical input object", () => {
    // Narrow-only by construction, exercised over the whole rule surface.
    const overlays: unknown[] = [
      undefined,
      {},
      { allowActions: [] },
      { allowActions: ["hitl.approve"] },
      { denyActions: ["hitl.approve"] },
      { alwaysAsk: ["hitl.approve"] },
      { allowActions: ["hitl.approve", "tree.emit"], denyActions: ["repair.apply"] },
      null,
      42,
      "junk",
      { denyActions: "hitl.approve" },
      { denyActions: ["shell.exec"] },
    ];
    const allow = seamAllow("hitl.approve");
    for (const overlay of overlays) {
      const out = applyPolicyOverlay(allow, overlay, "hitl.approve", "gate:P4");
      if (out.decision === "allow") {
        assert.equal(out, allow, `overlay ${JSON.stringify(overlay)} may only withhold — it returned a NEW allow`);
      } else {
        assert.equal(out.decision, "deny");
      }
    }
  });
});

describe("policy overlay — malformed lists and namespace escapes fail closed", () => {
  const malformed: unknown[] = [
    null,
    42,
    true,
    "hitl.approve",
    [],
    { denyActions: "hitl.approve" },
    { alwaysAsk: [1] },
    { denyActions: [""] },
    { allowActions: [null] },
    { allowActions: [{}] },
  ];

  it("refuses with policy.action-list-unreadable when the list cannot be read (never silently ignored)", () => {
    for (const overlay of malformed) {
      const verdict = applyPolicyOverlay(seamAllow("hitl.approve"), overlay, "hitl.approve", "gate:P4");
      assert.equal(verdict.decision, "deny", `overlay ${JSON.stringify(overlay)} must fail closed`);
      assert.equal(verdict.code, "policy.action-list-unreadable:hitl.approve");
      assert.equal(verdict.fallback, "none");
      assert.equal(reasonId(verdict), "action-list-unreadable");
    }
  });

  it("refuses a list that names an action outside the registry (namespace escape)", () => {
    const refusal = policyOverlayRefusal({ denyActions: ["shell.exec"] }, "hitl.approve", "gate:P4");
    assert.equal(refusal?.code, "policy.action-list-escape:hitl.approve");
    assert.equal(refusal?.rule, "escape");
    assert.equal(refusal?.fallback, "none");
    assert.match(refusal?.detail ?? "", /shell\.exec/);
    assert.match(refusal?.detail ?? "", /KNOWN_POLICY_ACTIONS|hitl\.approve/);
  });

  it("refuses a queried pairing outside the action's registered namespace", () => {
    const pairing = policyOverlayRefusal({ denyActions: ["hitl.force"] }, "hitl.approve", "tree:src/x.ts");
    assert.equal(pairing?.code, "policy.action-list-escape:hitl.approve");
    assert.match(pairing?.detail ?? "", /tree:src\/x\.ts/);
    assert.match(pairing?.detail ?? "", /gate:P<n>/);
  });

  it("refuses an unregistered action under a declared list, naming that action", () => {
    const refusal = policyOverlayRefusal({ allowActions: ["hitl.approve"] }, "shell.exec", "gate:P4");
    assert.equal(refusal?.code, "policy.action-list-escape:shell.exec");
    assert.equal(refusal?.action, "shell.exec");
  });
});

describe("policy overlay — readPolicyOverlay (untrusted input reader)", () => {
  it("treats an absent field as the no-narrowing default", () => {
    assert.deepEqual(readPolicyOverlay(undefined), { ok: true, overlay: {}, ignored: [] });
  });

  it("coerces the three list keys and reports unknown keys instead of silently dropping them", () => {
    const read = readPolicyOverlay({ allowActions: ["tree.emit"], denyCommands: ["rm -rf /"], extra: 1 });
    assert.equal(read.ok, true);
    assert.ok(read.ok);
    assert.deepEqual(read.overlay.allowActions, ["tree.emit"]);
    assert.deepEqual([...read.ignored].sort(), ["denyCommands", "extra"], "a rule this leaf cannot enforce must be visible");
  });

  it("fails the read (ok:false with a detail) for every malformed shape", () => {
    for (const bad of [null, 7, "x", [1], { allowActions: 3 }, { denyActions: [0] }] as unknown[]) {
      const read = readPolicyOverlay(bad);
      assert.equal(read.ok, false, `${JSON.stringify(bad)} must not read as an overlay`);
      if (!read.ok) assert.ok(read.detail.length > 0);
    }
  });

  it("mutates nothing: a frozen overlay reads and evaluates fine", () => {
    const overlay = Object.freeze({
      allowActions: Object.freeze(["hitl.approve", "tree.emit"]),
      alwaysAsk: Object.freeze(["tree.emit"]),
    }) as unknown;
    const read = readPolicyOverlay(overlay);
    assert.equal(read.ok, true);
    const verdict = applyPolicyOverlay(seamAllow("tree.emit"), overlay, "tree.emit", "tree:src/x.ts");
    assert.equal(verdict.decision, "deny");
    assert.equal(verdict.code, "policy.action-ask:tree.emit", "on the allow list but alwaysAsk — the list withholds it");
    // …and an action outside the allow list is refused off-list BEFORE alwaysAsk
    // is consulted: the outer gate wins (precedence pinned).
    const offList = applyPolicyOverlay(seamAllow("repair.apply"), overlay, "repair.apply", "tree:src/x.ts");
    assert.equal(offList.decision, "deny");
    assert.equal(offList.code, "policy.action-off-list:repair.apply");
  });
});

describe("policy overlay — the coded surface itself", () => {
  it("builds a code per rule, each naming the action", () => {
    assert.equal(policyRefusalCode("hitl.force", "allowActions"), "policy.action-off-list:hitl.force");
    assert.equal(policyRefusalCode("hitl.force", "denyActions"), "policy.action-denied:hitl.force");
    assert.equal(policyRefusalCode("hitl.force", "alwaysAsk"), "policy.action-ask:hitl.force");
    assert.equal(policyRefusalCode("hitl.force", "unreadable"), "policy.action-list-unreadable:hitl.force");
    assert.equal(policyRefusalCode("hitl.force", "escape"), "policy.action-list-escape:hitl.force");
  });

  it("bounds a hostile action value (the code cannot balloon)", () => {
    const code = policyRefusalCode("x".repeat(400), "denyActions");
    assert.ok(code.length < 120, `code should stay bounded, got ${code.length} chars`);
    assert.match(code, /^policy\.action-denied:x+…$/);
  });

  it("is deterministic and total: malformed arguments refuse instead of throwing", () => {
    const overlay = { allowActions: ["tree.emit"] };
    assert.deepEqual(
      policyOverlayRefusal(overlay, "hitl.approve", "gate:P4"),
      policyOverlayRefusal(overlay, "hitl.approve", "gate:P4"),
    );
    // Total surface: hostile values must not throw, and must refuse.
    for (const [action, resource] of [
      [undefined, "gate:P4"],
      [null, "gate:P4"],
      ["hitl.approve", null],
      ["hitl.approve", 42],
      [42, undefined],
    ] as unknown as [string, string][]) {
      const refusal = policyOverlayRefusal(overlay, action, resource);
      assert.ok(refusal !== null, `(${String(action)}, ${String(resource)}) must refuse under a declared list`);
      assert.match(refusal.code, /^policy\.action-(off-list|list-escape):/);
    }
    // No list at all ⇒ no refusal, even for a hostile action.
    assert.equal(policyOverlayRefusal(undefined, 42 as unknown as string, 42 as unknown as string), null);
  });
});
