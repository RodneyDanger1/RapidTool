# 172 — T0 honesty foundation (landed 2026-09-09)

Parent (grok-4.6) enacted §18 T0.1–T0.6 of `fixes/162_master_execution_plan.md` / `fixes/170_b.md`.
Composer 2.5 (`deleg_52e77b88`) and Grok 4.6 auditors (`deleg_2a6b8c97`) were running on DISJOINT files — this wave did not touch vault/rt-client/bench/swarm/design/diagram/harvest.

## Landed

| Id | What | Where |
|---|---|---|
| T0.1 | persist `version:1` + identity migrate v0→v1; future version throws → clean re-seed | `store.ts` persistOptions |
| T0.2 | unknown per-row keys on well-formed `generatedTree` rows survive import/hydrate | `io.ts` sanitize; `engine.ts` hydrate repair map |
| T0.3 | `executeAsync` treats `dodBlocked` as `ok:false` (parity with sync execute) | `store.ts` executeAsync |
| T0.4 | headless `advanceOnce`/`finishPhase` honor `enforceDod`; `RunOutcome` += `"dod"`; CLI run/gate exits 1 | `headless.ts`, `scripts/rapidtool-cli.mjs` |
| T0.5 | hydrate clamps hole-in-phases to highest **contiguous** sealed + 1; loud `hydrate.repaired` | `engine.ts` hydrateProject |
| T0.6 | mint `lastTest:"tested"` only AFTER `gate.passed`; `repairTreeDir` no longer converges on a red P6 gate | `headless.ts` driveP6Journey + repairTreeDir |

## Tests (owned suites, 173/173 pass, fail 0)

- `store.test.ts` T0.1 v0 migrate, T0.1 future-version re-seed, T0.3 executeAsync dod, T0.5 hole clamp
- `io.test.ts` T0.2 extra `fixtureIds` key
- `headless.test.ts` T0.4 outcome `"dod"` + unmoved cursor; T0.6 red-gate journey does not mint `tested`

Did **not** run full `npm test` while sibling agents were mid-flight on other files.

## Not in this wave

A0 tree assembly, A1–A6 fixtures, Phase B–E. Next: A0 (`assembleTreeEntry` → importable per-file modules).
