// @ts-check
/**
 * Migration bookkeeping shared by the two appliers — `scripts/migrate.mjs`
 * (deploy, `readdir`) and `src/lib/db.ts` (PGLite preview, `import.meta.glob`).
 *
 * Applied files are keyed by BASENAME, so the same file applies once no matter
 * which directory it is globbed from. That is what makes the auth schema safe to
 * copy from `migrations/auth/` into `migrations/` when an app turns sign-in on:
 * a database that already has `0001_auth.sql` will not re-run it.
 *
 * Neither applier descends into subdirectories, so `migrations/auth/*.sql` is
 * out of scope for both until it is copied up.
 */

/**
 * The `_migrations` key for a migration path (or bare filename).
 * @param {string} path
 * @returns {string}
 */
export function migrationName(path) {
  // B2 (W39): split on BOTH separators. Keying the `_migrations` ledger on a
  // Windows-style path (`migrations\0002_x.sql`) would record the whole path
  // instead of the basename and re-apply an already-applied file.
  const parts = String(path).split(/[\\/]/);
  return parts[parts.length - 1] || String(path);
}

/**
 * @param {string} path
 * @returns {boolean}
 */
export function isMigrationFile(path) {
  return path.endsWith(".sql");
}

/**
 * Migrations in `paths` that are not yet in `applied`, in apply order.
 * Non-`.sql` entries (a `readdir` also yields `migrations/auth/`) are dropped.
 * @param {Iterable<string>} paths
 * @param {Iterable<string>} applied
 * @returns {Array<{ name: string, path: string }>}
 */
export function pendingMigrations(paths, applied) {
  const done = new Set(applied);
  return [...paths]
    .filter(isMigrationFile)
    .map((path) => ({ name: migrationName(path), path }))
    // B2 (W39): byte-order first, localeCompare only as a tie-break — a
    // locale-collated order can differ between the dev box and the deploy
    // runner, so the same file set could otherwise apply in two orders.
    .sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : a.name.localeCompare(b.name),
    )
    .filter(({ name }) => !done.has(name));
}

/** The canonical basename of the Better Auth schema migration (`migrations/auth/0001_auth.sql`). */
export const AUTH_SCHEMA_MIGRATION = "0001_auth.sql";

/**
 * Does this migration SQL create the Better Auth `user` table? Matches the
 * generated schema's `create table if not exists "user" (` line (and its
 * spellings) — the one statement every home for the auth schema must carry.
 * @param {string} sql
 * @returns {boolean}
 */
export function createsAuthUserTable(sql) {
  return /create\s+table\s+(?:if\s+not\s+exists\s+)?"user"\s*\(/i.test(sql);
}

/**
 * R15-f02 auth-schema preflight (fixes/273_t2_r15.md). Sign-in is enabled when
 * `VITE_AUTH_ENABLED` is anything but "false"; if no migration in the migrated
 * directory creates the Better Auth `user` table, the app would run every
 * query against a schema-less database the moment someone signs in — the
 * auth schema under `migrations/auth/` is never applied because neither
 * applier descends into it. Returns the coded refusal (copy-up instruction
 * included) or null when sign-in is off / the schema has a home.
 *
 * Callers: `scripts/migrate.mjs` (deploy, before connecting) and
 * `src/lib/db.ts` (PGLite fallback, before applying). Pinned in
 * `migration-plan.test.mjs`.
 * @param {{ authEnabled: boolean, names?: Iterable<string>, sql?: Iterable<string> }} input
 * @returns {{ code: "RT_E_AUTH_SCHEMA_MISSING", message: string } | null}
 */
export function authSchemaRefusal({ authEnabled, names = [], sql = [] }) {
  if (!authEnabled) return null;
  if ([...names].some((name) => migrationName(name) === AUTH_SCHEMA_MIGRATION)) return null;
  if ([...sql].some(createsAuthUserTable)) return null;
  return {
    code: "RT_E_AUTH_SCHEMA_MISSING",
    message:
      "Sign-in is enabled (VITE_AUTH_ENABLED is not \"false\") but no migration in migrations/ " +
      "creates the Better Auth \"user\" table — migrations/auth/*.sql sits outside the migrated " +
      "directory and neither applier descends into it. Copy it up: " +
      "`cp migrations/auth/0001_auth.sql migrations/0001_auth.sql` (plus any later " +
      "migrations/auth/*.sql in name order), restart, and re-run. To run without sign-in, set " +
      "VITE_AUTH_ENABLED=false instead.",
  };
}
