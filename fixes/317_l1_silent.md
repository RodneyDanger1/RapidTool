# 317_L1 — Silent-error hunt in idle src/lib (FIXER A)

**Started:** 2026-09-29 ~20:15 local
**Base:** HEAD=6a9ff96 + in-flight edits
**Scope:** idle files under `src/lib/` not owned by other lanes.
**Do-not-touch:** `entry-oracle.ts`, `compile-check.server.ts`, `run-eval.mjs` (J1) · `wave_plans/W43*`, other `fixes/317_*` (J3) · `313_d1_seal.md`, `wild-step.*` (J4) · any file with mtime <10 min at edit time.
**Rule:** fixes only; ≤~15 lines each; a fix must not weaken a pin; anything bigger → ticket. No mock code. No keyed calls.

## Candidates surveyed (mtime vs now, idle confirmed before each edit)

_(filled in below as work proceeds — each fix logs file:line → before → after → why → proof)_

## FIXES

_(pending)_

## TICKETS

_(pending)_

## SURVEY LOG / DEAD ENDS

_(pending)_
