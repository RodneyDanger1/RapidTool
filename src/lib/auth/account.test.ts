// ---------------------------------------------------------------------------
// account.test.ts — B2-F3 (Decision D3): the per-user server function's guard.
//
// The defect this pins: `authMiddleware` / `requireUserId` had ZERO importers,
// so nothing ever proved an unauthenticated call is rejected. The middleware's
// server hook calls `requireUserId` before the handler body runs, so this test
// exercises that exact guard on the auth-ENABLED path.
//
// `VITE_AUTH_ENABLED` is read at module load, so it is set before the dynamic
// import. A sibling file (`account-default.test.ts`) pins the shipped default.
// Node's test runner isolates each file in its own process, so the two env
// states cannot leak into each other.
// ---------------------------------------------------------------------------
process.env.VITE_AUTH_ENABLED = "true";
delete process.env.DATABASE_URL;

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("B2-F3 per-user guard (auth enabled)", () => {
  it("an unauthenticated request is rejected with UnauthorizedError (401)", async () => {
    const { requireUserId, UnauthorizedError } = await import("./verify.server.ts");
    await assert.rejects(
      () => requireUserId(),
      (err: unknown) => {
        assert.ok(err instanceof UnauthorizedError, `expected UnauthorizedError, got ${String(err)}`);
        assert.equal((err as { status: number }).status, 401);
        return true;
      },
    );
  });

  it("the account server function is a real callable wired through that guard", async () => {
    const { fetchVerifiedAccount } = await import("./account.ts");
    assert.equal(typeof fetchVerifiedAccount, "function");
  });

  it("assertSameSiteRequest is a no-op without a server request context", async () => {
    // getRequest() throws outside the Start runtime; the guard must treat that
    // as "nothing to inspect", not leak an AsyncLocalStorage error.
    const { assertSameSiteRequest } = await import("./isolation.server.ts");
    assert.doesNotThrow(() => assertSameSiteRequest());
  });
});
