// ---------------------------------------------------------------------------
// preview-embedder-origin.test.ts - 337-3 Trust: the guest-side parent-origin
// trust model (the module had no test of its own; preview-host-bridge.test.ts
// only exercised the grok.com/loopback arms).
//
// These pins record the model the implementation ACTUALLY enforces, so the
// header comment and the bytes cannot drift apart again. The load-bearing arm:
// a `*.grok-sandbox.com` guest trusts its direct parent whatever that origin is
// (the sandbox wrapper is the embedder; tightening it to the `isRemintPreviewPair`
// rule would disable the live preview bridge, since a sandbox host carries no
// `.preview.` label). preview-host-bridge.ts still gates every message on
// `event.source === window.parent` AND `event.origin === parentOrigin`.
//
// Run: node --experimental-strip-types --test src/lib/preview-embedder-origin.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isGrokEmbedderOrigin,
  isSandboxPreviewGuestHost,
  resolveParentEmbedderOrigin,
} from "./preview-embedder-origin.ts";

describe("resolveParentEmbedderOrigin - grok.com + loopback", () => {
  it("noops when not framed (parent is self)", () => {
    assert.equal(resolveParentEmbedderOrigin(true, "https://grok.com/"), null);
  });
  it("resolves an https grok.com embedder and its subdomains", () => {
    assert.equal(resolveParentEmbedderOrigin(false, "https://grok.com/p/1"), "https://grok.com");
    assert.equal(resolveParentEmbedderOrigin(false, "https://chat.grok.com/p/1"), "https://chat.grok.com");
  });
  it("never trusts a plaintext grok.com parent (downgrade) and falls through to the ancestor", () => {
    assert.equal(resolveParentEmbedderOrigin(false, "http://grok.com/"), null);
    assert.equal(resolveParentEmbedderOrigin(false, "http://grok.com/", "https://grok.com"), "https://grok.com");
  });
  it("allows loopback for local dev harnesses", () => {
    assert.equal(resolveParentEmbedderOrigin(false, "http://localhost:3000/"), "http://localhost:3000");
    assert.equal(resolveParentEmbedderOrigin(false, "https://127.0.0.1:8080/"), "https://127.0.0.1:8080");
  });
});

describe("resolveParentEmbedderOrigin - sandbox guest (the load-bearing arm)", () => {
  it("a *.grok-sandbox.com guest trusts its DIRECT parent frame for any http(s) origin", () => {
    assert.equal(isSandboxPreviewGuestHost("preview.grok-sandbox.com"), true);
    assert.equal(
      resolveParentEmbedderOrigin(false, "https://sandbox-host.example/", null, "preview.grok-sandbox.com"),
      "https://sandbox-host.example",
    );
    assert.equal(
      resolveParentEmbedderOrigin(false, "http://localhost:5173/", null, "abc.grok-sandbox.com"),
      "http://localhost:5173",
    );
  });
  it("a NON-sandbox guest gets no such arm — an unrelated parent is refused", () => {
    assert.equal(resolveParentEmbedderOrigin(false, "https://evil.example/", null, "app.example.com"), null);
  });
});

describe("resolveParentEmbedderOrigin - remint preview pairing", () => {
  it("pairs a *.preview.<domain> guest with <domain> or grok.<domain>", () => {
    assert.equal(
      resolveParentEmbedderOrigin(false, "https://foo.com/", null, "abc.preview.foo.com"),
      "https://foo.com",
    );
    assert.equal(
      resolveParentEmbedderOrigin(false, "https://grok.foo.com/", null, "abc.preview.foo.com"),
      "https://grok.foo.com",
    );
  });
  it("refuses an unrelated parent for a remint preview guest", () => {
    assert.equal(resolveParentEmbedderOrigin(false, "https://evil.com/", null, "abc.preview.foo.com"), null);
    assert.equal(resolveParentEmbedderOrigin(false, "https://foo.com/", null, "a.b.preview.foo.com"), null);
  });
});

describe("isGrokEmbedderOrigin", () => {
  it("rejects unrelated hosts, non-http schemes and junk", () => {
    assert.equal(isGrokEmbedderOrigin("https://evil.com"), false);
    assert.equal(isGrokEmbedderOrigin("ftp://grok.com"), false);
    assert.equal(isGrokEmbedderOrigin("not a url"), false);
    assert.equal(isGrokEmbedderOrigin("https://grok.com.evil.com"), false);
  });
});
