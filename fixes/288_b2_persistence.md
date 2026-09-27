# 288 — B2 persistence sweep (migrations/** + db layer + store persistence paths)

Lane: B2 (owner of `migrations/**` + `src/lib/db*` + the store's persistence paths
`src/lib/store.ts` save/load/hydrate + `.rapidtool` dir handling + PGLite/pg wiring + lockfile/journal).
Started: 2026-09-27 (W39). CODE-ONLY, real-time fixes. Read fresh each session.
Scope note: store.ts is shared with Y2 (runtime) — B2 items here are persistence-specific only.

## Findings
_(appending findings + real-time fixes as they land)_

## Fix log (append-only)
| # | file:line | bug | patch | evidence |
|---|---|---|---|---|
