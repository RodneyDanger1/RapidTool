import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolveSignInGateState } from "./sign-in-gate.ts";

describe("resolveSignInGateState", () => {
  it("is pending while the session check is in flight, user or not", () => {
    assert.equal(
      resolveSignInGateState({ isPending: true, hasUser: false }),
      "pending",
    );
    assert.equal(
      resolveSignInGateState({ isPending: true, hasUser: true }),
      "pending",
    );
  });

  it("is signed_in once a user is present", () => {
    assert.equal(
      resolveSignInGateState({ isPending: false, hasUser: true }),
      "signed_in",
    );
  });

  it("is signed_out only after the check resolved with no user", () => {
    assert.equal(
      resolveSignInGateState({ isPending: false, hasUser: false }),
      "signed_out",
    );
  });
});

// Source guard (the repo's instrument for JSX invariants with no DOM test
// harness — see src/lib/ui-surface-guards.test.ts). `RT_GATES_TX` points the
// pin at a copy to reproduce the red run without touching the working tree:
// the pre-fix bytes had `onClick={() => signIn(...)}`, so signIn's rejection
// floated as an unhandled promise with no user-visible feedback.
describe("SignInButtons handles a rejected signIn", () => {
  const path =
    process.env.RT_GATES_TX ?? fileURLToPath(new URL("./gates.tsx", import.meta.url));
  const source = readFileSync(path, "utf8");

  it("chains a catch onto signIn and surfaces the failure to the visitor", () => {
    const call = /signIn\(p\.providerId[^)]*\)\s*\.catch\(/.exec(source);
    assert.ok(call, "the signIn call must be chained with .catch(...)");
    assert.match(source, /role="alert"/, "the failure must be rendered, not swallowed");
  });
});
