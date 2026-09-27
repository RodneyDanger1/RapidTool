import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  coerceIsolationClaim,
  isHonestIsolationClaim,
  runnerIsolationClaim,
  RUNNER_IS_NOT_A_SANDBOX,
} from "./sandbox-policy.ts";

describe("sandbox-policy — honest isolation claim", () => {
  it("never reports sandbox/docker/bwrap as true", () => {
    const c = runnerIsolationClaim();
    assert.equal(c.sandbox, false);
    assert.equal(c.docker, false);
    assert.equal(c.bwrap, false);
    assert.equal(c.kind, "none");
    assert.equal(c.note, RUNNER_IS_NOT_A_SANDBOX);
  });

  it("is deterministic and frozen", () => {
    assert.deepEqual(runnerIsolationClaim(), runnerIsolationClaim());
    assert.equal(runnerIsolationClaim(), coerceIsolationClaim({ sandbox: true }));
    assert.throws(() => {
      (runnerIsolationClaim() as { sandbox: boolean }).sandbox = true;
    });
  });

  it("coerceIsolationClaim ignores hostile true flags (never re-emits sandbox:true)", () => {
    const c = coerceIsolationClaim({
      sandbox: true,
      docker: true,
      bwrap: true,
      kind: "docker",
      note: "totally sandboxed",
    });
    assert.equal(c.sandbox, false);
    assert.equal(c.docker, false);
    assert.equal(c.bwrap, false);
    assert.equal(c.kind, "none");
    assert.equal(c.note, RUNNER_IS_NOT_A_SANDBOX);
    assert.equal(isHonestIsolationClaim(c), true);
    assert.equal(isHonestIsolationClaim({ sandbox: true, kind: "none", docker: false, bwrap: false, note: "x" }), false);
    assert.equal(isHonestIsolationClaim(null), false);
  });
});
