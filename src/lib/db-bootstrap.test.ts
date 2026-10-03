// ---------------------------------------------------------------------------
// db-bootstrap.test.ts — W51 · lane 337-2 (Pulse)
//
// The PGLite bootstrap at the bottom of `db.ts` is fired eagerly at module load
// and is never awaited. Its `.catch` used to clear the retry slot, log, and
// then RETHROW — producing an unhandled rejection that killed the process
// (`triggerUncaughtException(err, true /* fromPromise */)`) the instant the
// module graph finished loading, even though every later `getSql()` can retry.
//
// This test runs the import in a CHILD process (the failure mode is a process
// death, so it cannot be asserted in-band) with no `DATABASE_URL`, so the
// PGLite branch runs and `import.meta.glob` (a Vite-only transform) is absent:
//   · the module graph must LOAD (bootstrap failure caught, not thrown);
//   · the failure must still be REPORTED (never silently swallowed);
//   · the process must exit 0 (no unhandled rejection).
//
// Run: node --experimental-strip-types --test --test-reporter=tap src/lib/db-bootstrap.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const dbUrl = new URL("./db.ts", import.meta.url).href;

describe("db.ts eager PGLite bootstrap is non-fatal (W51 · 337-2)", () => {
  it("reports a failing bootstrap instead of throwing an unhandled rejection", () => {
    const code =
      `import(${JSON.stringify(dbUrl)}).then(` +
      `() => console.log("IMPORT_OK"), ` +
      `(e) => console.log("IMPORT_FAIL", e.message));`;
    const env: NodeJS.ProcessEnv = { ...process.env, VITE_AUTH_ENABLED: "false" };
    delete env.DATABASE_URL;
    const r = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--input-type=module", "-e", code],
      { encoding: "utf8", env, timeout: 60_000 },
    );
    const stderr = r.stderr ?? "";
    assert.match(r.stdout ?? "", /IMPORT_OK/, "the module graph must load despite the bootstrap failure");
    assert.match(stderr, /\[db\] PGLite bootstrap failed/, "the bootstrap failure must still be reported");
    assert.doesNotMatch(stderr, /triggerUncaughtException/, "an unhandled rejection must not kill the process");
    assert.equal(r.status, 0, `child exit ${String(r.status)}`);
  });
});
