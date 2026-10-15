# W357 · lane `fix-build` — the build is red: SQL migrations are being parsed as code (P0)

**Wave:** W357. **Persona:** `forge`. **Author:** the wave parent. Read this FIRST.

## Mission

Make `npm run build` green. This is the wave's P0: with the build red, RapidTool cannot ship, and no
downstream quality claim is meaningful.

## The evidence

The W356 boundary gate (`fixes/356_0_boundary.md` §2) returned `build:{ok:false,exit:1}` with:

```
[PARSE_ERROR] Expected a semicolon or an implicit semicolon after a statement, but found none
  migrations/auth/0002_account_unique.sql:1:11
  migrations/auth/0001_auth.sql:1:10
```

The build is pulling `migrations/auth/*.sql` into the bundle and parsing them as JavaScript. The `346`
gate of record had `build:{ok:true}`, so this arrived with the uncommitted 354-wave work (the
persistent-PGLite / launch change is the plausible carrier).

## Owned files (yours alone)

`vite.config.ts` · `migrations/**` · `src/lib/db.ts` · `src/lib/pglite-dialect.ts` ·
`scripts/migrate.mjs` · `scripts/migration-plan.mjs` · `package.json` (build scripts only)

## MINI-TASK PLAN

1. Find why `migrations/**` enters the module graph. Candidate mechanisms: a dynamic import/glob that
   sweeps the repo, a Nitro/Vite `assetsInclude` or `serverDir` mis-scope, a `new URL(...)` literal that
   rolldown resolves, or a migration loader that imports the `.sql` as a module. Name the exact cause at
   `file:line` with the command that shows it.
2. Fix it at the cause. The migrations must be **read as data at runtime**, never bundled as modules.
   Keep the documented behaviour: `npm run build` runs `vite build` **and** `db:migrate`, and the PGLite
   fallback must work with no `DATABASE_URL`.
3. Confirm the persistent-PGLite-data-dir behaviour the 354 wave added still holds after your fix.
4. Prove it: `npm run build` exit 0; the PGLite fallback path still applies the migrations; and
   `node --experimental-strip-types scripts/rapidtool-cli.mjs doctor` still returns `ok:true`.

## Verification

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
npx tsc --noEmit
npm run build                       # expect exit 0
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor
```
`npm run build` writes `dist/` and runs `db:migrate` — that is expected and allowed for this lane.

## Logging

`fixes/357_fix_build.md` — skeleton first, then append: the root cause at `file:line`, the fix, the
before/after exit codes, and anything deferred.

## Do not

- Do not edit `eslint.config.mjs` (`fix-lint`), `src/lib/software-export*` or any doc (`fix-preview`),
  `scripts/check-module-coverage.mjs` / `scripts/quality-ratchet*` (`fix-gates`),
  `src/lib/scaffold.ts` / `scaffold.test.ts` / `wild-step.test.ts` / `headless.test.ts` (`fix-tests`),
  the register, or another lane's log.
- Do not "fix" the build by deleting, emptying, or excluding the migrations from the repo — they are the
  deploy path. The fix is how they are loaded, never whether they exist.
- No keyed LLM call. No git writes. **No mock/stub/fake/demo code on a production path.**
