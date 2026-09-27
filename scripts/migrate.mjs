#!/usr/bin/env node
/**
 * Deploy-time database migrator (node-postgres, `pg`).
 *
 * Runs during `npm run build` — on every Vercel deploy — applying pending files
 * in ../migrations to DATABASE_URL. Each file is applied in one transaction and
 * recorded in a `_migrations` table, so it runs once and is safe to re-run.
 *
 * The read is non-recursive, so the opt-in auth schema under migrations/auth/
 * is not applied to an app that never asked for sign-in.
 *
 * No DATABASE_URL (local / preview builds) -> skip; the PGLite fallback applies
 * the same files at startup instead (see src/lib/db.ts).
 */
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";
import { authSchemaRefusal, outOfOrderMigrations, pendingMigrations } from "./migration-plan.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log(
    "[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).",
  );
  process.exit(0);
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");

// R15-f02: sign-in is enabled unless the flag is explicitly "false" (parity
// with src/lib/auth/server.ts's `authDisabled`).
const authEnabled = (process.env.VITE_AUTH_ENABLED ?? "").trim() !== "false";

async function main() {
  let entries;
  try {
    entries = await readdir(migrationsDir);
  } catch {
    console.log("[migrate] no migrations/ directory — nothing to do.");
    return;
  }
  // R15-f02 (fixes/273_t2_r15.md): when sign-in is enabled, refuse BEFORE
  // touching the database if no migration in migrations/ creates the Better
  // Auth `user` table. The auth schema under migrations/auth/ is never applied
  // (neither applier descends into it); a coded refusal + the copy-up
  // instruction beats a deploy that signs users in against a schema-less DB.
  // Pinned in scripts/migration-plan.test.mjs.
  if (authEnabled) {
    const sqlTexts = await Promise.all(
      entries
        .filter((entry) => entry.endsWith(".sql"))
        .map((name) => readFile(join(migrationsDir, name), "utf8")),
    );
    // K2 (W39): the auth SOURCE dir's listing feeds the copy-up completeness
    // check — a partially copied-up auth schema (0001 in, 0002 out) silently
    // loses every later auth migration, R15-f02's unique-index fix included.
    // An absent migrations/auth/ (app deleted the opt-in schema) reads as [].
    let authDirNames = [];
    try {
      authDirNames = (await readdir(join(migrationsDir, "auth"))).filter((name) => name.endsWith(".sql"));
    } catch {
      /* no migrations/auth/ — nothing to check */
    }
    const refusal = authSchemaRefusal({ authEnabled, names: entries, sql: sqlTexts, authDirNames });
    if (refusal) {
      console.error(`[migrate] ${refusal.code}: ${refusal.message}`);
      process.exit(1);
    }
  }
  // An app with no schema of its own must not pay for a database connection.
  if (pendingMigrations(entries, []).length === 0) {
    console.log("[migrate] no migrations — nothing to do.");
    return;
  }

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const client = await pool.connect();
  try {
    await client.query(
      "CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())",
    );
    const applied = (await client.query("SELECT name FROM _migrations")).rows.map(
      (r) => r.name,
    );

    // K2 (W39): warn loudly when a pending file sorts BEFORE an already-applied
    // one (the version-gap / partial-application hazard). Not a refusal — a
    // legitimate hotfix can arrive with a lower number — the ledger's primary
    // key keeps a re-run safe; this makes the order visible instead of silent.
    const outOfOrder = outOfOrderMigrations(entries, applied);
    if (outOfOrder.length > 0) {
      console.warn(
        `[migrate] WARNING: ${outOfOrder.join(", ")} sorts before an already-applied migration — applying out of order. ` +
          "Verify its SQL does not assume a schema state a later migration already changed.",
      );
    }
    let count = 0;
    for (const { name } of pendingMigrations(entries, applied)) {
      const text = await readFile(join(migrationsDir, name), "utf8");
      try {
        await client.query("BEGIN");
        // pg's simple-query protocol runs a whole multi-statement file at once.
        await client.query(text);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [name]);
        await client.query("COMMIT");
      } catch (err) {
        console.error(`[migrate] error applying ${name}`);
        try {
          await client.query("ROLLBACK");
        } catch {
          // ROLLBACK fails when the connection died — keep the original error.
        }
        // B2 (W39): two migrators sharing one DATABASE_URL (a preview build and
        // a production build overlapping) can both see a file as pending. The
        // transaction above is rolled back WHOLE here, so the file is not
        // half-applied by this process — the winner's commit stands. Report the
        // honest skip instead of failing the deploy on a duplicate key. Narrow
        // on purpose: only the `_migrations` ledger's own unique violation
        // qualifies; a unique violation from the migration's SQL still throws.
        const isLedgerRace =
          err?.code === "23505" &&
          (err?.table === "_migrations" ||
            String(err?.constraint ?? "").includes("_migrations"));
        if (isLedgerRace) {
          console.warn(
            `[migrate] ${name} was applied concurrently by another migrator — skipping (this transaction was rolled back whole).`,
          );
          continue;
        }
        throw err;
      }
      console.log(`[migrate] applied ${name}`);
      count += 1;
    }
    console.log(count ? `[migrate] done — ${count} migration(s) applied.` : "[migrate] up to date.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[migrate] failed:", err?.message || err);
  // pg errors carry the context needed to debug a bad SQL file.
  for (const key of ["code", "detail", "hint", "position", "where"]) {
    if (err?.[key] != null) console.error(`[migrate]   ${key}: ${err[key]}`);
  }
  process.exit(1);
});
