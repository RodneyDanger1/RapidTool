// ---------------------------------------------------------------------------
// settle.test.ts — 312 C3 (fixes/312 §1): pins for the bounded-settlement /
// trust-gate module that closes the SE2 mock-arm hang (CF-SE2-1).
// Run: node --experimental-strip-types --test src/lib/settle.test.ts
//
// The load-bearing pin is REFUSAL: the import-protection mock proxy can never
// be bounded by a timer (awaiting it starves the macrotask queue — measured in
// fixes/312 §1, probe EXIT=124 under `timeout`), so the ONLY safe move is to
// detect and refuse it before any `then`/await adoption. `mockProxy()` below
// replicates the plugin's generated mock BYTE-FOR-BYTE
// (node_modules/@tanstack/start-plugin-core/.../import-protection/virtualModules.js
// `generateMockCode`: a Proxy over a function whose get trap special-cases
// then/catch/finally and mints a child proxy for EVERY other property read).
// A regression here means a real product hang, not just a red test.
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isBareNodeHost, isTrustedCallable, settleWithin, SETTLE_DEFAULT_MS } from "./settle.ts";

/**
 * The TanStack import-protection mock shape, replicated from the plugin's
 * generated code (see header). Returns a callable proxy; `.then` is the
 * never-settling trap; every other property read mints a child proxy.
 */
function mockProxy(name = "mock"): unknown {
  const target = function () {};
  (target as unknown as { prototype: { name: string } }).prototype.name = name;
  const children: Record<string, unknown> = Object.create(null);
  const proxy: unknown = new Proxy(target, {
    get(_t, prop) {
      if (prop === "__esModule") return true;
      if (prop === "default") return proxy;
      if (prop === "caller") return null;
      if (prop === "then") return (f: (v: unknown) => unknown) => Promise.resolve(f(proxy));
      if (prop === "catch") return () => Promise.resolve(proxy);
      if (prop === "finally") return (f: () => void) => {
        f();
        return Promise.resolve(proxy);
      };
      if (typeof prop === "symbol") return undefined;
      if (!(prop in children)) children[prop] = mockProxy(`${name}.${String(prop)}`);
      return children[prop];
    },
    apply() {
      return mockProxy(`${name}()`);
    },
  });
  return proxy;
}

describe("isBareNodeHost / isTrustedCallable", () => {
  it("identifies the Node test host as bare Node", () => {
    assert.equal(isBareNodeHost(), true);
  });

  it("trusts plain functions (including arrow/async) and refuses the mock shape", () => {
    assert.equal(isTrustedCallable(function named() {}), true);
    assert.equal(isTrustedCallable(async () => ({ ok: false })), true);
    assert.equal(isTrustedCallable(() => undefined), true);
    assert.equal(isTrustedCallable(mockProxy()), false, "callable proxy (mock) must NOT be trusted");
    assert.equal(
      isTrustedCallable((mockProxy() as { wildClassifierReview: unknown }).wildClassifierReview),
      false,
      "the mock's named-export child proxy must NOT be trusted",
    );
    assert.equal(isTrustedCallable({}), false);
    assert.equal(isTrustedCallable(undefined), false);
    assert.equal(isTrustedCallable("function"), false);
  });
});

describe("settleWithin — the never-settling-FETCH class (boundable)", () => {
  it("resolves a settled value unchanged", async () => {
    const r = await settleWithin(Promise.resolve(41), 1000);
    assert.equal(r.ok, true);
    assert.equal((r as { value: number }).value, 41);
  });

  it("passes a non-promise value through", async () => {
    const r = await settleWithin("plain", 1000);
    assert.equal(r.ok, true);
    assert.equal((r as { value: string }).value, "plain");
  });

  it("preserves a rejection (caller keeps its own error classification)", async () => {
    const boom = new Error("provider refused");
    const r = await settleWithin(Promise.reject(boom), 1000);
    assert.equal(r.ok, false);
    assert.equal((r as { timedOut: boolean }).timedOut, false);
    assert.equal((r as { error: unknown }).error, boom);
  });

  it("a NEVER-SETTLING promise fails timedOut within the bound (≤ bound + slack)", async () => {
    const t0 = Date.now();
    const r = await settleWithin(new Promise(() => {}), 40);
    const elapsed = Date.now() - t0;
    assert.equal(r.ok, false);
    assert.equal((r as { timedOut: boolean }).timedOut, true);
    assert.equal((r as { ms: number }).ms, 40);
    assert.ok(elapsed >= 40, `bound honored (${elapsed}ms ≥ 40ms)`);
    assert.ok(elapsed < 2000, `settled promptly after the bound (${elapsed}ms)`);
  });

  it("junk ms falls back to the default window (never 0/immediate)", async () => {
    const r = await settleWithin(Promise.resolve("x"), Number.NaN);
    assert.equal(r.ok, true);
    assert.equal(SETTLE_DEFAULT_MS, 120_000);
  });
});

describe("settleWithin — the MOCK class (refused, never awaited)", () => {
  it(
    "refuses the mock proxy WITHOUT touching then (no hang, promptly)",
    { timeout: 5000 },
    async () => {
      const t0 = Date.now();
      const r = await settleWithin(mockProxy(), 50);
      const elapsed = Date.now() - t0;
      assert.equal(r.ok, false);
      assert.equal((r as { timedOut: boolean }).timedOut, false, "refusal, not a timeout");
      assert.match(String((r as { error: unknown }).error), /untrusted callable proxy/);
      assert.ok(elapsed < 1000, `refusal is immediate (${elapsed}ms) — the trap was never adopted`);
    },
  );

  it(
    "refuses a mock CALL RESULT the same way (the engine's exact exposure: await reviewer(ctx))",
    { timeout: 5000 },
    async () => {
      const mock = mockProxy() as (ctx: unknown) => unknown;
      const t0 = Date.now();
      const r = await settleWithin(mock({ reason: "advance" }), 50);
      const elapsed = Date.now() - t0;
      assert.equal(r.ok, false);
      assert.equal((r as { timedOut: boolean }).timedOut, false);
      assert.ok(elapsed < 1000, `refusal is immediate (${elapsed}ms)`);
    },
  );
});
