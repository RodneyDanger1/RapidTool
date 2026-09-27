# 290 — K2: B2 persistence sweep, finished (migrations/** + planner + store/db persistence + atomic writes)

Lane: K2 (finisher of B2 — `fixes/288_b2_persistence.md`, skeleton only; B2 died in
`deleg_5f2a88c4/task-1.log` after 3 patches). Scope: `migrations/**` (idempotence,
IF NOT EXISTS, index/type sanity — incl. the T2 auth `0002`), the migration planner's
edge cases (partial application, version gaps, re-run safety —
`scripts/migration-plan.mjs` + test), store save/load/hydrate guards (`src/lib/store.ts`
persistence paths + `db.ts`/PGLite wiring), atomic-write discipline on every write,
corrupted-file recovery (honest refusal vs crash), PGLite-vs-Postgres parity (no
PG-only syntax in shared migrations), and the committed `.hermes-tmp.pw0XNe` hygiene.
Started: 2026-09-27 (W39). CODE + `node --check`; no full gates / keyed calls.

## B2's landed work (verified in tree at 2fa3cd9+)
- `scripts/migration-plan.mjs` — `migrationName` splits on BOTH separators (Windows
  path keyed as basename, no re-apply); `pendingMigrations` sorts byte-order with
  `localeCompare` only as tie-break (deterministic apply order across boxes).
- `src/lib/db.ts` — `getSql` doc: runtime `DATABASE_URL` without a build has NO applier.
- `fixes/288_b2_persistence.md` written (skeleton; no fix-log rows landed).

## Findings
_(appending findings + real-time fixes as they land)_

## Fix log (append-only)
| # | file:line | bug | patch | evidence |
|---|---|---|---|---|
| 1 | `src/lib/cassette.ts:234` | tape store `write()` used a plain `writeFile` — truncate-then-write; a kill/full disk mid-write leaves a TORN tape, and `parseTape` (correctly) refuses it, so one interrupted recording turns the whole recorded run into a wall of misses | unique staging `<tape>.<pid>.<ms>.tmp` + `rename` (checkpoint A1-08 idiom), best-effort staging sweep on failure, no-fsync limitation stated | `node --experimental-strip-types --check src/lib/cassette.ts` → OK |
| 2 | `src/lib/cassette.ts:311` | load-path validator (`validateResponse`, ok:false arm) silently DROPPED `usage` although `copyEnvelope` preserves it (Y1's I2 contract: a refusal that burned tokens stays meterable) — a recorded refusal replayed with LESS information than the live call (silent under-count). **for B4's tape seam** | preserve + strictly validate `usage` on the refusal arm (finite numbers; malformed still fails the tape closed) — parity with the ok:true arm | `--check` OK (above) |
| 3 | `src/lib/knowledge.ts:524` | `writeStore` staged to the FIXED `<file>.tmp` — two writers on one store file (which `mergeWithDisk` explicitly supports) interleave on one staging name; one rename ENOENTs after a successful write | unique staging `<file>.<pid>.<ms>.tmp` + best-effort sweep + `unlinkSync` import | `--check` OK |
| 4 | `src/lib/git.server.ts:645` | `.rapidtool/git-landing.json` marker written in place — an interrupted write leaves invalid JSON that `hasLandingMarker` reads as "no marker" (the "already landed here" proof file can be a half-written lie) | tmp+rename hand-over; `renameSync`/`unlinkSync` imports added | `--check` OK |
