# 183 — Phase D wild honesty (174-1, 174-2, 174-3, 174-7)

## 174-1
`executeAsync` commit keeps `live.wildRun` when `active === true` (does not wrap
`startWildRun` in `serialized()` — that deferred the sync start-stamp and broke
H-06 C1 / 144 L4). `deepenResearch` is on `serialized(id)`.

## 174-2
`tryStartWild` expires via `setTimeout` on Node (not only `window`). Outer
`try/finally` on `startWildRun` releases the latch on early returns (missing
project / wildMode off / already-active / complete).

## 174-3
`hydrateProject(raw, { preserveWildRun: true })` keeps a persisted active run.
Default hydrate still force-stops (browser session died). CLI `wild --pause|
--resume|--step|--stop` uses preserve; `--start` still hydrates-stop.

## 174-7
`emit --check` → `RT_E_CHECK_FAILED`. `emit --run` → `RT_E_TREE_RUN_FAILED`.
