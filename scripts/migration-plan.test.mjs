import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import {
  AUTH_SCHEMA_MIGRATION,
  authCopyUpGaps,
  authSchemaRefusal,
  createsAuthUserTable,
  isMigrationFile,
  migrationName,
  outOfOrderMigrations,
  pendingMigrations,
} from "./migration-plan.mjs";
import { projectRoot } from "./with-app-env.mjs";

const AUTH_MIGRATION = "0001_auth.sql";

/**
 * K2 (W39): per-file copy-up state for the auth schema — every
 * `migrations/auth/*.sql`, plus its copy in the migrated directory when one
 * exists. `copied` is the basename list that has a copy; a PARTIAL copy-up is
 * `copied.length > 0 && copied.length < auth.length` (the quiet regression:
 * 0001 makes sign-in work, a later file never applies).
 */
function authSchemaCopies(root) {
  const authDir = join(root, "migrations", "auth");
  if (!existsSync(authDir)) return { auth: [], copied: [], pairs: [] };
  const auth = readdirSync(authDir).filter((name) => name.endsWith(".sql")).sort();
  const copied = [];
  const pairs = [];
  for (const name of auth) {
    const copy = join(root, "migrations", name);
    if (existsSync(copy)) {
      copied.push(name);
      pairs.push({
        name,
        copy: readFileSync(copy, "utf8"),
        source: readFileSync(join(authDir, name), "utf8"),
      });
    }
  }
  return { auth, copied, pairs };
}

test("_migrations keys on basename, not path", () => {
  assert.equal(migrationName("/migrations/0002_todos.sql"), "0002_todos.sql");
  assert.equal(migrationName("migrations/auth/0001_auth.sql"), "0001_auth.sql");
  assert.equal(migrationName("0001_auth.sql"), "0001_auth.sql");
});

test("a file already applied from another directory does not re-apply", () => {
  // The auth-on path copies migrations/auth/0001_auth.sql into the globbed
  // directory; a database that already has it must not run it twice.
  assert.deepEqual(pendingMigrations(["/migrations/0001_auth.sql"], ["0001_auth.sql"]), []);
});

test("pending migrations are returned in name order", () => {
  assert.deepEqual(
    pendingMigrations(
      ["/migrations/0003_c.sql", "/migrations/0001_a.sql", "/migrations/0002_b.sql"],
      ["0001_a.sql"],
    ),
    [
      { name: "0002_b.sql", path: "/migrations/0002_b.sql" },
      { name: "0003_c.sql", path: "/migrations/0003_c.sql" },
    ],
  );
});

test("non-.sql entries are dropped (readdir also yields the auth/ directory)", () => {
  assert.equal(isMigrationFile("auth"), false);
  assert.deepEqual(pendingMigrations(["auth", "README.md"], []), []);
});

test("the auth schema ships outside the globbed directory", () => {
  const migrationsDir = join(projectRoot(), "migrations");
  assert.deepEqual(pendingMigrations(readdirSync(migrationsDir), []), []);
  assert.ok(readdirSync(join(migrationsDir, "auth")).includes("0001_auth.sql"));
});

test("this workspace's auth schema copy-up is all-or-none and byte-identical", () => {
  // K2 (W39): every `migrations/auth/*.sql` that has a copy in `migrations/`
  // must be a verbatim copy of its source AND the copy-up must be COMPLETE. An
  // edited copy diverges silently (basename keying skips it on a database that
  // already ran the original, and applies a mutated file on a fresh PGLite
  // preview); a PARTIAL copy-up silently drops the later migrations — including
  // `0002_account_unique.sql`, the R15-f02 unique-index fix.
  const { auth, copied, pairs } = authSchemaCopies(projectRoot());
  if (copied.length === 0) return; // sign-in off — nothing has been copied up
  assert.deepEqual(
    copied,
    auth,
    `partial auth copy-up: ${auth.filter((n) => !copied.includes(n)).join(", ")} lives in migrations/auth/ but has no copy in migrations/ — copy every auth migration up together`,
  );
  for (const { name, copy, source } of pairs) {
    assert.equal(
      copy,
      source,
      `migrations/${name} has been edited — it must stay a verbatim copy of migrations/auth/${name}`,
    );
  }
});

test("the copy check reads every auth file and catches an edit", () => {
  const root = mkdtempSync(join(tmpdir(), "auth-schema-"));
  mkdirSync(join(root, "migrations/auth"), { recursive: true });
  writeFileSync(join(root, "migrations/auth", AUTH_MIGRATION), "create table t ();\n");
  writeFileSync(join(root, "migrations/auth", "0002_second.sql"), "create index i on t ();\n");
  assert.deepEqual(authSchemaCopies(root), { auth: [AUTH_MIGRATION, "0002_second.sql"], copied: [], pairs: [] });

  // PARTIAL copy-up: 0001 only — `copied` must not equal `auth`.
  writeFileSync(join(root, "migrations", AUTH_MIGRATION), "create table t ();\n");
  const partial = authSchemaCopies(root);
  assert.deepEqual(partial.copied, [AUTH_MIGRATION]);
  assert.notDeepEqual(partial.copied, partial.auth, "a partial copy-up is visible to the guard");

  // Complete copy-up, then an edit to one copy — the pair check must see it.
  writeFileSync(join(root, "migrations", "0002_second.sql"), "create index i on t ();\n");
  const complete = authSchemaCopies(root);
  assert.deepEqual(complete.copied, complete.auth);
  for (const pair of complete.pairs) assert.equal(pair.copy, pair.source);

  writeFileSync(join(root, "migrations", AUTH_MIGRATION), "create table t (x int);\n");
  const drifted = authSchemaCopies(root).pairs.find((p) => p.name === AUTH_MIGRATION);
  assert.notEqual(drifted.copy, drifted.source);
});

// --- R15-f02 auth-schema preflight (fixes/273_t2_r15.md) ---------------------

test("the preflight is silent when sign-in is off", () => {
  assert.equal(authSchemaRefusal({ authEnabled: false, names: [], sql: [] }), null);
  assert.equal(
    authSchemaRefusal({ authEnabled: false, names: ["0002_todos.sql"], sql: ["create table t ();"] }),
    null,
  );
});

test("the preflight accepts the canonical copy-up name or any user-creating migration", () => {
  assert.equal(
    authSchemaRefusal({ authEnabled: true, names: [AUTH_SCHEMA_MIGRATION], sql: ["-- noop"] }),
    null,
  );
  assert.equal(
    authSchemaRefusal({
      authEnabled: true,
      names: ["0005_identity.sql"],
      sql: ['create table if not exists "user" ("id" text not null primary key);'],
    }),
    null,
  );
});

test("the preflight names the copy-up fix when the schema is missing", () => {
  const refusal = authSchemaRefusal({
    authEnabled: true,
    names: ["0002_todos.sql", "auth"],
    sql: ["create table todos ();"],
  });
  assert.ok(refusal);
  assert.equal(refusal.code, "RT_E_AUTH_SCHEMA_MISSING");
  assert.match(refusal.message, /cp migrations\/auth\/0001_auth\.sql migrations\/0001_auth\.sql/);
  assert.match(refusal.message, /VITE_AUTH_ENABLED=false/);
});

test("createsAuthUserTable matches the schema spellings, not lookalikes", () => {
  assert.equal(createsAuthUserTable('create table if not exists "user" ('), true);
  assert.equal(createsAuthUserTable('CREATE TABLE "user" (id text);'), true);
  assert.equal(createsAuthUserTable('create table if not exists "user_session" ('), false);
  assert.equal(createsAuthUserTable("create table todos ();"), false);
});

test("the shipped .grok/app-env.json keeps sign-in off (preflight stays silent)", () => {
  const envPath = join(projectRoot(), ".grok", "app-env.json");
  if (!existsSync(envPath)) return; // platform-provided on some hosts
  const shipped = JSON.parse(readFileSync(envPath, "utf8"));
  assert.equal(shipped.VITE_AUTH_ENABLED, "false");
});

// --- K2 (W39): planner edge cases -------------------------------------------

test("K2: a basename appearing twice in one pass applies once (the ledger is basename-keyed)", () => {
  // The same file globbed from two directories; the second entry would either
  // fail the `_migrations` primary key mid-transaction or read as a bogus
  // concurrent-apply skip. First path in name-then-path order wins.
  const pending = pendingMigrations(
    ["/migrations/0002_x.sql", "/other/0002_x.sql", "/migrations/0003_y.sql"],
    [],
  );
  assert.deepEqual(pending, [
    { name: "0002_x.sql", path: "/migrations/0002_x.sql" },
    { name: "0003_y.sql", path: "/migrations/0003_y.sql" },
  ]);
});

test("K2: a legacy ledger row recorded as a PATH still counts as applied", () => {
  // Pre-B2 on Windows, migrationName split only on "/" and could record a
  // whole path. Normalizing the applied set means such a row does not re-apply.
  assert.deepEqual(pendingMigrations(["/migrations/0002_x.sql"], ["migrations\\0002_x.sql"]), []);
  assert.deepEqual(pendingMigrations(["/migrations/0002_x.sql"], ["migrations/0002_x.sql"]), []);
});

test("K2: out-of-order detection flags a pending file that sorts before an applied one", () => {
  // The version-gap / partial-application hazard: 0003 already applied, then
  // 0002 arrives (or a concurrent migrator's ledger shows that order).
  assert.deepEqual(outOfOrderMigrations(["/m/0002_b.sql", "/m/0003_c.sql"], ["0003_c.sql"]), ["0002_b.sql"]);
  // Healthy shapes are silent: nothing applied, or everything in order.
  assert.deepEqual(outOfOrderMigrations(["/m/0002_b.sql"], []), []);
  assert.deepEqual(outOfOrderMigrations(["/m/0002_b.sql", "/m/0003_c.sql"], ["0001_a.sql"]), []);
  assert.deepEqual(outOfOrderMigrations(["/m/0002_b.sql"], ["0001_a.sql", "0002_b.sql"]), []);
  // A legacy path-keyed ledger row counts as the same applied migration.
  assert.deepEqual(outOfOrderMigrations(["/m/0002_b.sql"], ["migrations\\0003_c.sql"]), ["0002_b.sql"]);
});

test("K2: authCopyUpGaps is silent with nothing copied up and with a complete copy-up", () => {
  const authNames = ["0001_auth.sql", "0002_account_unique.sql"];
  assert.deepEqual(authCopyUpGaps({ authNames, migratedNames: ["0002_todos.sql", "auth"] }), []);
  assert.deepEqual(
    authCopyUpGaps({ authNames, migratedNames: ["0001_auth.sql", "0002_account_unique.sql"] }),
    [],
  );
  // No auth dir at all → nothing to check.
  assert.deepEqual(authCopyUpGaps({ authNames: [], migratedNames: ["0002_todos.sql"] }), []);
});

test("K2: a PARTIAL auth copy-up names exactly the missing later migrations", () => {
  const authNames = ["0001_auth.sql", "0002_account_unique.sql"];
  assert.deepEqual(authCopyUpGaps({ authNames, migratedNames: ["0001_auth.sql"] }), [
    "0002_account_unique.sql",
  ]);
  // Path-shaped keys (the PGLite glob / nested readdir) still compare by basename.
  assert.deepEqual(
    authCopyUpGaps({
      authNames: ["/migrations/auth/0001_auth.sql", "/migrations/auth/0002_account_unique.sql"],
      migratedNames: ["/migrations/0001_auth.sql"],
    }),
    ["0002_account_unique.sql"],
  );
});

test("K2: the preflight refuses a partial copy-up with the exact copy command", () => {
  const refusal = authSchemaRefusal({
    authEnabled: true,
    names: [AUTH_SCHEMA_MIGRATION, "0002_todos.sql"],
    sql: ["create table if not exists \"user\" (\"id\" text not null primary key);"],
    authDirNames: ["0001_auth.sql", "0002_account_unique.sql"],
  });
  assert.ok(refusal, "a partially copied-up auth schema is refused");
  assert.equal(refusal.code, "RT_E_AUTH_SCHEMA_MISSING");
  assert.match(refusal.message, /PARTIALLY copied up: 0002_account_unique\.sql/);
  assert.match(refusal.message, /cp migrations\/auth\/0002_account_unique\.sql migrations\/0002_account_unique\.sql/);
  assert.match(refusal.message, /VITE_AUTH_ENABLED=false/);
  // A complete copy-up stays silent; sign-in off stays silent; and a caller
  // that cannot list the auth dir (no authDirNames) falls back to the
  // original R15-f02 verdict instead of guessing.
  assert.equal(
    authSchemaRefusal({
      authEnabled: true,
      names: ["0001_auth.sql", "0002_account_unique.sql"],
      sql: ["-- noop"],
      authDirNames: ["0001_auth.sql", "0002_account_unique.sql"],
    }),
    null,
  );
  assert.equal(
    authSchemaRefusal({
      authEnabled: false,
      names: [],
      sql: [],
      authDirNames: ["0001_auth.sql", "0002_account_unique.sql"],
    }),
    null,
  );
  const legacy = authSchemaRefusal({ authEnabled: true, names: ["0002_todos.sql"], sql: ["create table t ();"] });
  assert.ok(legacy);
  assert.match(legacy.message, /Copy it up: `cp migrations\/auth\/0001_auth\.sql migrations\/0001_auth\.sql`/);
});

test("K2: the shipped tree's auth copy-up state matches the guard's verdict", () => {
  const { auth, copied } = authSchemaCopies(projectRoot());
  const migrated = readdirSync(join(projectRoot(), "migrations"));
  const gaps = authCopyUpGaps({ authNames: auth, migratedNames: migrated });
  // The guard flags PARTIAL copy-ups only: "nothing copied up" is the R15-f02
  // refusal's case (no `user` table at all) and a complete copy-up has no
  // gaps. The shipped tree copies nothing up (sign-in off by default), so []
  // is its verdict — the full missing list is the refusal's business.
  const expected = copied.length === 0 ? [] : auth.filter((name) => !copied.includes(name));
  assert.deepEqual(
    gaps,
    expected,
    "the guard's gap list must agree with the on-disk copy-up state",
  );
});

test("K2: same-basename entries resolve by the byte-order path tie-break, not input order", () => {
  // The order is TOTAL — (name, then path) — so the same file globbed from two
  // directories keeps the byte-order-first path. A name-only (stable) sort
  // would keep whichever path the glob listed first, and with a reversed glob
  // the dedupe survivor would differ between boxes.
  assert.deepEqual(pendingMigrations(["/other/0002_x.sql", "/migrations/0002_x.sql"], []), [
    { name: "0002_x.sql", path: "/migrations/0002_x.sql" },
  ]);
  // And the output is totally ordered even when the input is not.
  assert.deepEqual(
    pendingMigrations(["/m/0003_c.sql", "/other/0002_x.sql", "/m/0001_a.sql", "/m/0002_x.sql"], []),
    [
      { name: "0001_a.sql", path: "/m/0001_a.sql" },
      { name: "0002_x.sql", path: "/m/0002_x.sql" },
      { name: "0003_c.sql", path: "/m/0003_c.sql" },
    ],
  );
});
