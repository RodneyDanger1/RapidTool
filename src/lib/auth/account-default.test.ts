// ---------------------------------------------------------------------------
// account-default.test.ts — B2-F3 (Decision D3): the SHIPPED default.
//
// A single-user local tool must not suddenly demand a login, so with
// `VITE_AUTH_ENABLED=false` (`.grok/app-env.json`, the shipped default) the
// middleware's guard resolves the shared dev user instead of throwing. This
// pins that the auth surface added for the enabled path leaves the disabled
// path byte-for-byte as it was.
// ---------------------------------------------------------------------------
process.env.VITE_AUTH_ENABLED = "false";
delete process.env.DATABASE_URL;

import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("B2-F3 shipped default (auth disabled)", () => {
  it("the guard resolves the shared dev user — no login is demanded", async () => {
    const { requireUserId, DEV_USER_ID } = await import("./verify.server.ts");
    assert.equal(DEV_USER_ID, "dev-user");
    assert.equal(await requireUserId(), DEV_USER_ID);
  });
});
