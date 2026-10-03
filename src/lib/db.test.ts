// ---------------------------------------------------------------------------
// db.test.ts — W50 · 336-6: `src/lib/db.ts` was reached by no test.
//
// `db.ts` IS live: `src/lib/auth/server.ts:38` imports it (`../db.ts`) and
// `vite.config.ts:40` loads it by string (`ssrLoadModule("/src/lib/db.ts")`).
// Its PGlite branch calls Vite's `import.meta.glob`, which plain Node does not
// implement, so this test drives the NEON branch (DATABASE_URL set) that a
// deployed app actually takes and pins the module's public guards:
//   · `dbSource` follows `DATABASE_URL` (empty/whitespace means unset);
//   · `getSql()` refused from browser code (server-only contract);
//   · `getSql()` is memoized (one client per process);
//   · `ensureDbReady()` is a no-op on Neon;
//   · `getPglite()` refuses when the Neon backend is active.
//
// Run: node --experimental-strip-types --test --test-reporter=tap src/lib/db.test.ts
// ---------------------------------------------------------------------------
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";

// Set the backend BEFORE importing the module — `dbSource` is fixed at load.
process.env.DATABASE_URL = "postgres://rt3366:rt3366@127.0.0.1:5432/rt3366_dbtest";
const db = await import("./db.ts");

after(() => {
  delete process.env.DATABASE_URL;
});

describe("db.ts — server-only SQL surface (Neon branch)", () => {
  it("selects the Neon backend when DATABASE_URL is set", () => {
    assert.equal(db.dbSource, "neon");
    assert.equal(typeof db.getSql, "function");
    assert.equal(typeof db.getPglite, "function");
    assert.equal(typeof db.ensureDbReady, "function");
  });

  it("refuses getSql() from browser code (server-only guard)", async () => {
    Object.defineProperty(globalThis, "window", { value: {}, configurable: true });
    try {
      await assert.rejects(db.getSql(), /server-only/);
    } finally {
      Reflect.deleteProperty(globalThis, "window");
    }
  });

  it("memoizes one SQL client per process and exposes the documented surface", async () => {
    const first = db.getSql();
    assert.equal(db.getSql(), first, "getSql must return the same promise");
    const sql = await first;
    assert.equal(typeof sql, "function", "the tagged-template form is callable");
    assert.equal(typeof sql.query, "function", "the .query() form is present");
  });

  it("ensureDbReady() is a no-op on the Neon path", async () => {
    // Resolves immediately with no value; a hang or a throw fails this.
    assert.equal(await db.ensureDbReady(), undefined);
  });

  it("getPglite() refuses when the Neon backend is active", async () => {
    await assert.rejects(db.getPglite(), /only available on the PGLite fallback/);
  });
});
