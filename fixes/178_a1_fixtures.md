# 178 — A1 persist acceptance fixtures (landed)

Parent (grok-4.6) enacted 162/170-B **A1**. persist `version:1` (T0.1) was already in.

## Fields (ABSENCE on legacy, never `[]`)

- `Project.acceptanceFixtures?: BriefFixtureCase[]`
- `Project.acceptanceApprovedAt?: number`
- `Project.acceptanceBriefHash?: string` (C6 — fnv1a(brief) the set was drafted against)
- `BriefFixtureCase.target?: string` (C2)

## Seams

- `coerceAcceptanceFixtures` in `brief-fixtures.ts` — drop-invalid, copy, empty→undefined
- `io.ts` sanitizer arm (`acceptanceFixtures:dropped`)
- `engine.ts` hydrate — copy not mutate; briefHash mismatch pending-ifies approved rows + `acceptance.stale` log (never silently re-approve)

## Tests (owned suites 137/137 pass)

- coerce + target validation (`brief-fixtures.test.ts`)
- import round-trip / junk drop / non-array (`io.test.ts`)
- hydrate stale vs matching hash (`store.test.ts`)

## Next

A2 emit fixtures into `tests/oracle.spec.ts` (do not add a second test script). A5.0 typed-draft is still required before `fixtures draft` yields cases.
