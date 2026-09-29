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
 *
 * K2 (W39) hardening:
 *  - `applied` entries are basename-normalized too, so a legacy ledger row that
 *    recorded a PATH (`migrations\0002_x.sql` from a pre-B2 Windows run) still
 *    matches the file's basename instead of re-applying it.
 *  - the order is a TOTAL order (name, then path) — deterministic across boxes
 *    and across `readdir` orderings, so the same set applies in one order.
 *  - entries are deduped by basename: the `_migrations` ledger is
 *    basename-keyed, so a basename appearing twice in one pass (the same file
 *    globbed from two directories) can apply at most once — the second would
 *    fail the ledger's primary key mid-transaction (or, on the pg path, read
 *    as a bogus concurrent-apply skip).
 * @param {Iterable<string>} paths
 * @param {Iterable<string>} applied
 * @returns {Array<{ name: string, path: string }>}
 */
export function pendingMigrations(paths, applied) {
  const done = new Set([...applied].map((name) => migrationName(name)));
  const seen = new Set();
  return [...paths]
    .filter(isMigrationFile)
    .map((path) => ({ name: migrationName(path), path }))
    // B2 (W39): byte-order first, localeCompare only as a tie-break — a
    // locale-collated order can differ between the dev box and the deploy
    // runner, so the same file set could otherwise apply in two orders.
    .sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
    )
    .filter(({ name }) => {
      if (done.has(name) || seen.has(name)) return false;
      seen.add(name);
      return true;
    });
}

/**
 * K2 (W39): pending migrations whose name sorts BEFORE a migration that is
 * already applied — the "version gap / partial application" hazard. A file
 * dropped into `migrations/` after its successors already shipped (or a ledger
 * that applied `0003` first because `0002` arrived later) would now apply in an
 * order the schema history never saw, and its SQL may assume a state `0003+`
 * has already changed. Deliberately NOT a refusal — a legitimate hotfix can
 * arrive with a lower number — callers warn loudly with the exact names.
 * @param {Iterable<string>} paths
 * @param {Iterable<string>} applied
 * @returns {string[]} the out-of-order pending basenames, in apply order
 */
export function outOfOrderMigrations(paths, applied) {
  const appliedNames = [...applied].map((name) => migrationName(name));
  if (appliedNames.length === 0) return [];
  const highest = appliedNames.reduce((a, b) => (a > b ? a : b));
  return pendingMigrations(paths, appliedNames)
    .map(({ name }) => name)
    .filter((name) => name < highest);
}

/**
 * K2 (W39): the auth schema's copy-up completeness, for the R15-f02 family of
 * checks. `migrations/auth/*.sql` is never applied by either applier (neither
 * descends into the subdirectory), so an app that turns sign-in on must copy
 * EVERY auth file up, basename for basename. Returns the basenames present in
 * `migrations/auth/` but missing from the migrated directory, in name order.
 *
 * Empty in the two healthy shapes: nothing copied up yet (the R15-f02 refusal
 * owns that case — no `user` table in the migrated directory) and a complete
 * copy-up. A PARTIAL copy only shows up here — and it is the quiet one: `0001`
 * present makes sign-in work, while a later file (e.g.
 * `0002_account_unique.sql`, the unique-index fix this repo ships in the auth
 * dir) silently never applies and the regression it fixed comes back.
 * @param {{ authNames?: Iterable<string>, migratedNames?: Iterable<string> }} input
 * @returns {string[]}
 */
export function authCopyUpGaps({ authNames = [], migratedNames = [] } = {}) {
  const migrated = new Set([...migratedNames].map((name) => migrationName(name)));
  const auth = [...authNames]
    .filter(isMigrationFile)
    .map((name) => migrationName(name));
  if (auth.length === 0) return []; // no auth schema to copy up
  if (!auth.some((name) => migrated.has(name))) return []; // nothing copied up — R15-f02's refusal owns this
  return [...new Set(auth)].filter((name) => !migrated.has(name)).sort();
}

/**
 * W42 L4-G2 (q2 rows A-87/A-88): per-file copy-up STATE for the auth schema —
 * every `migrations/auth/*.sql`, plus its copy in the migrated directory when
 * one exists. `copied` is the basename list that has a copy; a PARTIAL copy-up
 * is `copied.length > 0 && copied.length < auth.length` (the quiet regression:
 * 0001 makes sign-in work, a later file never applies). `pairs` carries the
 * byte-pair per copy so a caller can prove copy === source.
 *
 * Moved here from `migration-plan.test.mjs`'s private copy so the workspace
 * guard and its pin share ONE implementation (q2 A-87: the test had
 * re-implemented it). Async with a LAZY `node:fs`/`node:path` import: this
 * module is also imported by the client-capable `src/lib/db.ts`, and a
 * top-level `node:fs` import is the H2 crash class — the house seam pattern
 * is `src/lib/quarantine.ts`'s `await import("node:fs")`.
 * @param {string} root
 * @returns {Promise<{ auth: string[], copied: string[], pairs: Array<{ name: string, copy: string, source: string }> }>}
 */
export async function authSchemaCopyState(root) {
  const fs = await import("node:fs");
  const { join } = await import("node:path");
  const authDir = join(root, "migrations", "auth");
  if (!fs.existsSync(authDir)) return { auth: [], copied: [], pairs: [] };
  const auth = fs
    .readdirSync(authDir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  /** @type {string[]} */
  const copied = [];
  /** @type {Array<{ name: string, copy: string, source: string }>} */
  const pairs = [];
  for (const name of auth) {
    const copy = join(root, "migrations", name);
    if (fs.existsSync(copy)) {
      copied.push(name);
      pairs.push({
        name,
        copy: fs.readFileSync(copy, "utf8"),
        source: fs.readFileSync(join(authDir, name), "utf8"),
      });
    }
  }
  return { auth, copied, pairs };
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
 * K2 (W39): a PARTIAL copy-up is refused too (`authDirNames` — the auth source
 * directory's listing, when the caller can read it). `0001` copied up makes
 * sign-in work, but a later auth migration's absence is silent — most notably
 * `0002_account_unique.sql` (R15-f02's own unique-index fix), whose regression
 * would come back with no symptom until duplicate link rows appear. Callers
 * that cannot list the directory (the PGLite applier's bundler glob) pass
 * whatever keys they have; absent `authDirNames` means "unknown", and the
 * check is skipped rather than guessed.
 *
 * Callers: `scripts/migrate.mjs` (deploy, before connecting) and
 * `src/lib/db.ts` (PGLite fallback, before applying). Pinned in
 * `migration-plan.test.mjs`.
 * @param {{ authEnabled: boolean, names?: Iterable<string>, sql?: Iterable<string>, authDirNames?: Iterable<string> }} input
 * @returns {{ code: "RT_E_AUTH_SCHEMA_MISSING", message: string } | null}
 */
export function authSchemaRefusal({ authEnabled, names = [], sql = [], authDirNames = [] }) {
  if (!authEnabled) return null;
  const gaps = authCopyUpGaps({ authNames: authDirNames, migratedNames: names });
  if (gaps.length > 0) {
    const copies = gaps.map((name) => `cp migrations/auth/${name} migrations/${name}`).join(" && ");
    return {
      code: "RT_E_AUTH_SCHEMA_MISSING",
      message:
        `Sign-in is enabled and the auth schema is only PARTIALLY copied up: ${gaps.join(", ")} ` +
        "exists in migrations/auth/ but not in migrations/, so it will never apply (neither " +
        "applier descends into the subdirectory). A missing auth migration is silent — " +
        "0002_account_unique.sql in particular carries the R15-f02 unique-index fix. Copy every " +
        `migrations/auth/*.sql up together, in name order: \`${copies}\` (adjust for your shell), ` +
        "then re-run. To run without sign-in, set VITE_AUTH_ENABLED=false instead.",
    };
  }
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
