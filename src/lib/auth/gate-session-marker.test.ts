// ---------------------------------------------------------------------------
// gate-session-marker.test.ts — W50 · 336-6: `gate-session-marker.ts` was
// reached by no test. It is live (`gate-session.server.ts` writes the cookie,
// `gates.tsx` reads it to hide the sign-out control on a gate session).
//
// The module is client-safe and exercises no Vite-only transform, so it IS
// reachable by the node test harness — this test drives it directly instead of
// leaving it on the coverage allowlist.
//
// Run: node --experimental-strip-types --test --test-reporter=tap src/lib/auth/gate-session-marker.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GATE_SESSION_MARKER_COOKIE,
  hasGateSessionMarker,
} from "./gate-session-marker.ts";

/** Install/remove a controlled `document.cookie` for the current assertion. */
function setCookie(value: string | undefined): void {
  if (value === undefined) Reflect.deleteProperty(globalThis, "document");
  else
    Object.defineProperty(globalThis, "document", {
      value: { cookie: value },
      configurable: true,
      writable: true,
    });
}

describe("gate-session-marker", () => {
  it("is false with no document (server / SSR)", () => {
    assert.equal(typeof globalThis.document, "undefined", "node must have no document here");
    assert.equal(hasGateSessionMarker(), false);
  });

  it("matches only an exact `__Host-` cookie name, never a lookalike", () => {
    try {
      setCookie("");
      assert.equal(hasGateSessionMarker(), false, "empty cookie jar");
      setCookie("other=1");
      assert.equal(hasGateSessionMarker(), false, "an unrelated cookie");
      setCookie(`${GATE_SESSION_MARKER_COOKIE}=abc; other=1`);
      assert.equal(hasGateSessionMarker(), true, "marker first");
      setCookie(`other=1; ${GATE_SESSION_MARKER_COOKIE}=`);
      assert.equal(hasGateSessionMarker(), true, "marker last, empty value still present");
      // A planted parent-domain copy / substring lookalike must NOT match: the
      // whole point of the __Host- name is that a sibling cannot plant it.
      setCookie(`evil_${GATE_SESSION_MARKER_COOKIE}=1`);
      assert.equal(hasGateSessionMarker(), false, "name that merely contains the marker");
      setCookie(`x=${GATE_SESSION_MARKER_COOKIE}=1`);
      assert.equal(hasGateSessionMarker(), false, "marker embedded in another cookie's value");
    } finally {
      setCookie(undefined);
    }
  });

  it("the marker name is `__Host-` prefixed (the anti-planting contract)", () => {
    assert.match(GATE_SESSION_MARKER_COOKIE, /^__Host-/);
  });
});
