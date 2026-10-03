// ---------------------------------------------------------------------------
// auth-contract.test.ts — W50 · 336-6: `providers.ts` and `preview.ts` were
// reached by no test. Both are live (imported by `client.ts` / `server.ts`) and
// pure data, so the only meaningful coverage is the INTERFACE they form with the
// shared Grok auth broker. This test pins that interface — the provider ids the
// broker must recognise, and the exact sandbox host suffix the broker accepts
// against the suffix `client.ts`'s live-preview check uses.
//
// `email-password.ts` is deliberately NOT pinned: flipping its flag is the
// documented way to enable local email/password, so a value test would fight
// the enable path (see its allowlist reason).
//
// Run: node --experimental-strip-types --test --test-reporter=tap src/lib/auth/auth-contract.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { GROK_PROVIDERS } from "./providers.ts";
import {
  GROK_ISSUER_DEFAULT,
  PREVIEW_ALLOWED_HOSTS,
  PREVIEW_CLIENT_ID,
} from "./preview.ts";

describe("auth surface contract (broker interface)", () => {
  it("offers exactly the broker's upstreams, with distinct provider ids", () => {
    assert.deepEqual(
      GROK_PROVIDERS.map((p) => p.providerId),
      ["grok-google", "grok-x"],
    );
    // The broker reads `idp` to pick the upstream (Better Auth's X id is "twitter").
    assert.deepEqual(
      GROK_PROVIDERS.map((p) => p.idp),
      ["google", "twitter"],
    );
    assert.equal(
      new Set(GROK_PROVIDERS.map((p) => p.providerId)).size,
      GROK_PROVIDERS.length,
      "provider ids must be unique — they are the OAuth callback path segments",
    );
    for (const p of GROK_PROVIDERS) {
      assert.ok(p.label.trim().length > 0, `${p.providerId} needs a button label`);
    }
  });

  it("the preview allowlist covers the suffix client.ts's live-preview check uses", () => {
    // `client.ts` (inLivePreview) matches `hostname.endsWith(".grok-sandbox.com")`;
    // the broker only accepts callbacks on hosts this allowlist wildcards. If the
    // two drift, live-preview sign-in breaks — so pin both ends together.
    const CLIENT_SUFFIX = ".grok-sandbox.com";
    assert.deepEqual([...PREVIEW_ALLOWED_HOSTS], ["*.grok-sandbox.com"]);
    assert.equal(PREVIEW_ALLOWED_HOSTS[0].slice(1), CLIENT_SUFFIX);
    assert.match(GROK_ISSUER_DEFAULT, /^https:\/\//, "the broker issuer must be https");
    assert.ok(PREVIEW_CLIENT_ID.length > 0, "the baked preview client id must be non-empty");
  });
});
