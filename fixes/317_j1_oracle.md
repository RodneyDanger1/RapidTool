# 317 — J1: the oracle's caller wire (behavior factor in treeRun) + the wrong-output pin BITES + eval dedup + T5.4 telemetry

Lane: J1 (oracle caller wire). Repo: `C:\Users\mnril\Desktop\RapidTool Main`.
HEAD at entry: `6a9ff96` (I-wave: entry-oracle.ts shared module + 11 seam pins + H7 audit (0 violations)). Tree clean.
Siblings live — one writer per file. No keyed calls. All legs FOREGROUND. Space in path ⇒ `rg`/search-tools fail; grep via terminal.

## Scope (task brief)

- **J1.1** Finish I1/H5's caller wire: `compile-check.server.ts` `treeRun` (and/or CLI `emit --run` arm) gains the
  BEHAVIOR factor — when the emitted tree declares `expectedBehavior` rows, run the bounded oracle
  (`entry-oracle.ts`, real spawnSync, allowlisted env) and fold `behavior` into `outcome.ok`.
  Absent declaration ⇒ honest skip, byte-stable for job-less trees. Entry smoke (load-import-only) STAYS.
- **J1.2** The pin that PROVES IT BITES: good tree + correct declared row → passes;
  **entry declares expected behavior but PRODUCES WRONG OUTPUT → verdict FAILS** (the heart); + skip case.
- **J1.3** Eval-side dedup: run-eval.mjs uses the imported `entry-oracle.ts` module (no dead import drift);
  `node --test scripts/run-eval.test.mjs` foreground green; update byte/source pins if the move shifted them.
- **J1.4** T5.4: rt-events import + run-level emissions in run-eval.mjs (bounded, mirror wildStep seed shape)
  + pin (`grep -c rt-events > 0`) + honest justification of emission points.

## Verdict table (filled as work completes)

| # | Item | Verdict | Evidence |
|---|------|---------|----------|
| S1 | State of entry-oracle.ts + run-eval imports + treeRun arm | PENDING | |
| S2 | treeRun behavior factor wired (coded; honest skip; byte-stable) | PENDING | |
| S3 | Negative pin: wrong output FAILS the verdict | PENDING | |
| S4 | Skip-case pin | PENDING | |
| S5 | Good-tree pass pin | PENDING | |
| S6 | Eval dedup: no dead imports; run-eval.test.mjs green | PENDING | |
| S7 | T5.4 rt-events + pin | PENDING | |
| S8 | Gates (typecheck/lint; scoped tests foreground) | PENDING | |

## Log

