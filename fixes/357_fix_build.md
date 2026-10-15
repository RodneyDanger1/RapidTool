# fixes/357 — lane `fix-build` (W357 P0: the app cannot build)

**Lane:** `fix-build`. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`. **Host:** Windows /
PowerShell 5.1, Node **v24.15.0**, `npm run build` → `vite v8.2.2` (rolldown 1.2.7) +
nitro vercel preset. **HEAD:** `30bce78`, dirty tree (the 354-wave work is uncommitted).

**Owned files:** `vite.config.ts` · `migrations/**` · `src/lib/db.ts` · `src/lib/pglite-dialect.ts` ·
`scripts/migrate.mjs` · `scripts/migration-plan.mjs` · `package.json` (build scripts only).

**Verdict: green.** `npm run build` exit **1 → 0**; `npx tsc --noEmit` exit 0; `doctor` `ok:true`.

## 1. Root cause (`file:line`)

**`src/lib/db.ts:183`** (pre-fix line number; post-fix `:187`) — the **auth-dir glob carried no
`query`**:

```ts
const authSources = import.meta.glob("/migrations/auth/*.sql") as Record<
  string,
  () => Promise<unknown>
>;
```

`import.meta.glob` **without** a query hands each matched file to the bundler as a **JavaScript
module**. In dev (`ssrLoadModule`) the lazy thunks are never called, so nothing resolves; in an
**SSR production build** rolldown resolves every `import()` target into the module graph and parses
the `.sql` files as JS:

```
[PARSE_ERROR] Invalid Character `·`            migrations/auth/0002_account_unique.sql:1:12
[PARSE_ERROR] Expected a semicolon … found none migrations/auth/0002_account_unique.sql:1:11
[PARSE_ERROR] Expected a semicolon … found none migrations/auth/0001_auth.sql:1:10
```

The error names **exactly the two files that glob matches** — `migrations/auth/` holds only
`0001_auth.sql` and `0002_account_unique.sql` — and `/migrations/*.sql` with `?raw` is the only
other glob in the tree. The sibling glob at `src/lib/db.ts:172-176` (`/migrations/*.sql`) was
already correct (`query: "?raw"`, `import: "default"`, `eager: true`); the auth one was the single
omission.

**Why the `346` gate of record was green, and why the boundary attributed it to the 354 wave.**
The defect is **latent in committed code**: the auth glob shipped with it in `be12c59` (an ancestor
of the 346 gate commit `b33c84e`). It only bites when `src/lib/db.ts` is actually reachable from the
SSR entry, and at `b33c84e` it was not — `src/routes/__root.tsx` imported only the **client**
`@/lib/auth/provider`, and `src/components/console.tsx` had no `auth/` import. The uncommitted
354-wave auth work (Decision D3) closed the chain:

```
src/components/console.tsx:74            import { fetchVerifiedAccount } from "@/lib/auth/account.ts"
  → src/lib/auth/account.ts:19           import { authMiddleware } from "./middleware.ts"
  → src/lib/auth/middleware.ts           → ./verify.server.ts:3
  → src/lib/auth/server.ts:38            import { ensureDbReady, getPglite } from "../db.ts"
  → src/lib/db.ts:187                    the un-queried glob
```

So the boundary's suspicion was right in effect and slightly off in mechanics: the **carrier** is the
354-wave auth surface (`account.ts` is untracked, `console.tsx:74` is new), the **defect** is a
committed one-line glob omission that only became reachable with it.

**Candidates ruled out** (the plan's list, checked, not assumed):
`assetsInclude` — none in `vite.config.ts`; `serverDir: "./server"` — nitro's middleware dir
(`server/middleware/*`, pinned by `scripts/grok-pwa-plugin.test.mjs:507`), unrelated to
`migrations/`; a `new URL(...)` literal rolldown resolves — none referencing `migrations`
(`git grep`); a loader importing `.sql` as a module — the deploy loader `scripts/migrate.mjs:100`
reads with `readFile`, and the PGLite applier's *applied* glob was already `?raw`.

## 2. The fix

One functional change, in `src/lib/db.ts:187` — glob the auth SQL **as data**:

```ts
const authSources = import.meta.glob("/migrations/auth/*.sql", {
  query: "?raw",
  import: "default",
}) as Record<string, () => Promise<string>>;
```

- Each match is now a module whose default export is the file's **TEXT** — never parsed as code.
- The **keys** are unchanged (still `/migrations/auth/<file>.sql`), and `Object.keys(authSources)` is
  the only thing this code reads (`:201`, `authDirNames` for the K2/W39 partial-copy-up refusal at
  `scripts/migration-plan.mjs:203`) — so the guard keeps firing (§4, run 4).
- The glob stays **lazy**; the comment now records why `?raw` is load-bearing.

Proof the SQL reaches the bundle as data (built artifact):
`.vercel/output/functions/__server.func/_ssr/0002_account_unique-DFKBGiQn.mjs` begins

```js
var _0002_account_unique_default = "-- R15-f02 A… audit/03-G: the Better Auth `account` table had no unique\n-- constraint on (\"prov…
```

— a **string literal**, not statements.

**Not touched:** `migrations/**` (0 changes — `git status --porcelain -- migrations` is empty; the fix
is how they are loaded, not whether they exist), `vite.config.ts`, `scripts/migrate.mjs`,
`scripts/migration-plan.mjs`, and the `build`/`db:migrate` scripts in `package.json` (the
`preview:*`/`test` lines already dirty there belong to other lanes and were left alone).

## 3. Before / after

| command | before | after |
|---|---|---|
| `npm run build` | **exit 1** — `[PARSE_ERROR] …` ×3, SSR env build, `.vercel/output/static` written but no function output | **exit 0** — `✓ built in` ×3 (client, ssr, nitro), then `[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).` |
| `npx tsc --noEmit` | (not measured here) | **exit 0** |
| `node --experimental-strip-types scripts/rapidtool-cli.mjs doctor` | — | **exit 0**, `"ok": true` |
| `node --test scripts/migration-plan.test.mjs` | — | 20 tests · **20 pass · 0 fail** |
| `node --experimental-strip-types --test src/lib/db.test.ts src/lib/db-bootstrap.test.ts` | — | 6 tests · **6 pass · 0 fail** |

Raw logs: `%TEMP%\w357-build-before.log` (red), `%TEMP%\w357-build-after.log`,
`%TEMP%\w357-build-final.log` (green, post-fixture-cleanup), `%TEMP%\w357-doctor.json`.
Honest note: this build's output is `.vercel/output` (nitro vercel preset); no `dist/` is produced,
so the plan's "writes `dist/`" describes an earlier output shape.

## 4. PGLite-fallback evidence (no `DATABASE_URL`)

The repo's own tree **cannot** show migration application from plain Node (`import.meta.glob` is a
Vite-only transform — the reason `src/lib/db.test.ts` can only drive the Neon branch), so the real
fixed `db.ts` was loaded **through a real Vite dev server** (`ssrLoadModule`), which transforms the
globs exactly as `vite build` does. Harness `%TEMP%\w357_pglite_proof.mjs` (temp, outside the repo);
three fixture roots under the eslint-ignored `scratch-w357-proof\` (each holding **byte-copies** of the
fixed `src/lib/db.ts` and of `scripts/migration-plan.mjs`, plus its own `migrations/`) — **deleted
after the runs**; `migrations/**` in the repo was never mutated.

**Run 1 — the shipped shape** (no root `migrations/*.sql`, `VITE_AUTH_ENABLED=false`, fresh
`RAPIDTOOL_PGLITE_DIR`, no `DATABASE_URL`):

```json
{"dbSource":"pglite","pgliteDataDir":"…\\w357-pglite\\shipped","migrations":[],
 "tables":[{"table_name":"_migrations"}],"memoized":true}
```

**Run 2 — the documented copy-up shape** (`0001_auth.sql` + `0002_account_unique.sql` copied up,
sign-in on, fresh dir) — the migrations are applied by the fallback:

```json
{"dbSource":"pglite","migrations":[{"name":"0001_auth.sql"},{"name":"0002_account_unique.sql"}],
 "tables":[{"table_name":"_migrations"},{"table_name":"account"},{"table_name":"session"},
           {"table_name":"user"},{"table_name":"verification"}],
 "accountIndexes":[{"indexname":"account_pkey"},{"indexname":"account_providerId_accountId_uq"},
                   {"indexname":"account_userId_idx"}],"memoized":true}
```

`account_providerId_accountId_uq` is the unique index that **only** `0002_account_unique.sql`
creates — so the second file really ran, not just its ledger row.

**Run 3 — a SECOND process over the same data dir** (the 354-wave behaviour): same two `_migrations`
rows, same five tables, same index, **no re-apply and no ledger collision**; 998 files on disk in
the dir (976 for run 1) — i.e. `RAPIDTOOL_PGLITE_DIR` is honoured, the recursive `mkdir` works on a
non-existent dir, and data survives a process restart.

**Run 4 — PARTIAL copy-up** (only `0001_auth.sql` in `migrations/`, sign-in on) — proves the glob's
**keys** still reach the guard:

```json
{"code":"RT_E_AUTH_SCHEMA_MISSING",
 "message":"Sign-in is enabled and the auth schema is only PARTIALLY copied up: 0002_account_unique.sql exists in migrations/auth/ but not in migrations/ …"}
```

exit 1, with the `[db] PGLite bootstrap failed:` report — the documented coded refusal, unchanged.

**Honest limit.** The shipped repo has **zero** root `migrations/*.sql` (the auth schema is opt-in and
copied up at sign-in time — `fixes/350_release_prep.md` §5 says the same), so in the repo's own tree
the fallback opens PGLite and applies *nothing*. The application evidence above therefore comes from
the copy-up shape, which is the documented deploy path for sign-in.

## 5. Persistent PGLite data dir (354 wave) — holds

Run 3 is the check: two separate Node processes against
`%TEMP%\w357-pglite\copyup` — process 2 read back both `_migrations` rows and the `user`/`account`
schema written by process 1, with no re-application. The `dataDir` seam added by U3
(`src/lib/db.ts:39-42`, `:137-146`) is byte-unchanged by this lane.

## 6. Deferred / not verified

- **The auth SQL now ships as two never-loaded raw chunks** in the SSR bundle
  (`_ssr/0001_auth-C_H966CC.mjs` 3,071 B · `_ssr/0002_account_unique-DFKBGiQn.mjs` 1,258 B). The old
  comment claimed the auth SQL "never enters this path's bundle"; Vite has **no keys-only glob**, so
  the choice was "raw-text chunk" (correct) vs "parse error" (red build). Removing the glob entirely
  would need another source for `authDirNames` and would **weaken** the K2 partial-copy-up refusal —
  deferred, not done.
- **No prevention guard / regression test was added** for the "a `.sql` glob must carry `?raw`" rule:
  the guard register and `scripts/prevention/**` are outside this lane's scope. The failure mode is
  build-only (dev/preview hid it), which is exactly why no earlier gate caught it.
- **Full `gate.sh` was not re-run** — sibling lanes were mid-edit throughout, and the P0 stage
  (`build`) is green standalone. Full `npm test` likewise not run (its reds belong to other lanes).
- `package.json`'s `build`/`db:migrate` scripts needed no change: `db:migrate` correctly skips with no
  `DATABASE_URL`, and the fallback (not the build) owns local migration application.
