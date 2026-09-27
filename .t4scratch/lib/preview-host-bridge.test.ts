// ---------------------------------------------------------------------------
// preview-host-bridge.test.ts — bridge safety + route-path collection +
// embedder-origin trust model.
// Run: node --experimental-strip-types --test src/lib/preview-host-bridge.test.ts
// NOTE: not yet listed in package.json's npm test file list; run directly.
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  collectRoutePathsFromTree,
  isSafeBridgePath,
} from "./preview-host-bridge.ts";
import {
  isGrokEmbedderOrigin,
  resolveParentEmbedderOrigin,
} from "./preview-embedder-origin.ts";

describe("isSafeBridgePath", () => {
  it("accepts same-origin absolute paths", () => {
    assert.equal(isSafeBridgePath("/run/abc"), true);
    assert.equal(isSafeBridgePath("/"), true);
    assert.equal(isSafeBridgePath("/run/abc?q=1#top"), true);
  });

  it("rejects scheme, protocol-relative, backslash, and non-path input", () => {
    assert.equal(isSafeBridgePath("https://evil.com/x"), false);
    assert.equal(isSafeBridgePath("//evil.com/x"), false);
    assert.equal(isSafeBridgePath("/\\evil.com"), false);
    assert.equal(isSafeBridgePath("javascript:alert(1)"), false);
    assert.equal(isSafeBridgePath("#frag"), false);
    assert.equal(isSafeBridgePath(""), false);
  });
});

describe("collectRoutePathsFromTree", () => {
  it("surfaces only concrete navigable paths (no param/wildcard shapes)", () => {
    const tree = {
      path: "",
      children: [
        { path: "/", fullPath: "/" },
        { path: "/run/$id", fullPath: "/run/$id" },
        {
          path: "/docs",
          fullPath: "/docs",
          children: [
            { path: "/docs/$slug", fullPath: "/docs/$slug" },
            { path: "/docs/about", fullPath: "/docs/about" },
            { path: "/docs/*", fullPath: "/docs/*" },
          ],
        },
      ],
    };
    const paths = collectRoutePathsFromTree(tree);
    assert.deepEqual([...paths].sort(), ["/", "/docs", "/docs/about"]);
  });

  it("normalizes the empty root path to '/' and de-dupes", () => {
    const tree = { path: "", fullPath: "", children: [{ path: "/", fullPath: "/" }] };
    assert.deepEqual(collectRoutePathsFromTree(tree), ["/"]);
  });

  it("tolerates non-object garbage", () => {
    assert.deepEqual(collectRoutePathsFromTree(null), []);
    assert.deepEqual(collectRoutePathsFromTree(42), []);
  });
});

describe("isGrokEmbedderOrigin", () => {
  it("trusts grok.com and subdomains over HTTPS", () => {
    assert.equal(isGrokEmbedderOrigin("https://grok.com"), true);
    assert.equal(isGrokEmbedderOrigin("https://chat.grok.com"), true);
  });

  it("never trusts plaintext grok.com (downgrade)", () => {
    assert.equal(isGrokEmbedderOrigin("http://grok.com"), false);
    assert.equal(isGrokEmbedderOrigin("http://chat.grok.com"), false);
  });

  it("allows loopback for local dev harnesses (http or https)", () => {
    assert.equal(isGrokEmbedderOrigin("http://localhost:3000"), true);
    assert.equal(isGrokEmbedderOrigin("https://127.0.0.1:8080"), true);
  });

  it("rejects unrelated hosts and junk", () => {
    assert.equal(isGrokEmbedderOrigin("https://evil.com"), false);
    assert.equal(isGrokEmbedderOrigin("ftp://grok.com"), false);
    assert.equal(isGrokEmbedderOrigin("not a url"), false);
    assert.equal(isGrokEmbedderOrigin(""), false);
  });
});

describe("resolveParentEmbedderOrigin", () => {
  it("noops when not framed (parent is self)", () => {
    assert.equal(resolveParentEmbedderOrigin(true, "https://grok.com/"), null);
  });

  it("resolves an https grok.com referrer", () => {
    assert.equal(
      resolveParentEmbedderOrigin(false, "https://grok.com/preview/abc"),
      "https://grok.com",
    );
  });

  it("falls through a plaintext referrer to the https ancestor origin", () => {
    assert.equal(
      resolveParentEmbedderOrigin(
        false,
        "http://grok.com/preview",
        "https://grok.com",
      ),
      "https://grok.com",
    );
  });

  it("returns null when nothing passes the trust model", () => {
    assert.equal(resolveParentEmbedderOrigin(false, "https://evil.com/", null), null);
    assert.equal(
      resolveParentEmbedderOrigin(false, "http://grok.com/preview", null),
      null,
    );
  });
});
