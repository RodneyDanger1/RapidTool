# 179 — A2 emit fixtures into oracle.spec.ts (landed)

Parent enacted 162/170-B **A2**. 177 (`deleg_19a45753`) **did not write** `fixes/177_future_phases.md` (Codex SSE timeout / max_iterations). Future-phase spec remains 162 + 173 + 174 + 176.

## Behavior

- `approvedAcceptanceFixtures` — emit only when **every** case is `approved` (partial → byte-identical no-fixture spec)
- `compileFixtureAssertion` — `given` via `JSON.stringify`; shape = `__fxPartialMatch` with `"<draft>"`/`"<any>"`; throws = `String(msg).includes(pattern)`; property = C5 red-card
- Folded into **existing** `tests/oracle.spec.ts` (PKG `test` script unchanged — no `brief.spec.ts`)
- Requires tree-entry namespace (`treeModule`); no tree → no fx section

## Tests

`brief-fixtures.test.ts` + `scaffold.test.ts` **54/54** in that pair (full suite not re-run this wave).
