# 317 L1W — Watcher for L1 (silent-error class in idle src/lib)

Watcher: L1W · Batch: deleg_c2efa74b · Watching: task-0.log (L1)
L1's own log: fixes/317_l1_silent.md

## Protocol
Per fix L1 lands: (1) read actual diff; (2) evaluate root-cause vs symptom, pin-weakening, honesty, typecheck, run claimed proof; (3) verdict LEGIT-RETAINED / CORRECTED / REVERTED; (4) sweep file for leftovers after L1 stops; (5) final typecheck + lint on final tree.

## Per-fix table

| # | file:line | L1's claim | my independent check | verdict | adjustment |
|---|-----------|-----------|----------------------|---------|------------|
| (pending) | | | | | |

## Live watch notes

- [boot] Watch started. Awaiting L1's first edit.

## Cleanup sweep

(pending)

## Final gates

(pending: npm run typecheck + npm run lint on final tree)
