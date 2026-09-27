-- R15-f02 · audit/03-G: the Better Auth `account` table had no unique
-- constraint on ("providerId", "accountId") — under audit/03-F's concurrent
-- sign-in path two duplicate link rows could be written for one external
-- identity, and a duplicate pair makes every "which user owns this identity?"
-- lookup ambiguous.
--
-- Idempotent: safe on a database that already has the index; applies once the
-- file is copied into the migrated directory alongside 0001_auth.sql (the
-- basename-keyed `_migrations` ledger covers re-runs).
--
-- If this migration FAILS with "could not create unique index", the database
-- already holds duplicate pairs. The migrator deliberately does NOT pick a
-- winner — resolve them explicitly first, e.g.:
--   select "providerId", "accountId", count(*) from "account"
--   group by 1, 2 having count(*) > 1;
-- then remove/merge the duplicate rows and re-run the migration.
create unique index if not exists "account_providerId_accountId_uq"
  on "account" ("providerId", "accountId");
