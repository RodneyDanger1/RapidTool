# 279 · A2 — the PERIPHERY-HALF code-notes (read-only analyst)

**Lane:** W34b A2 · THE PERIPHERY HALF ANALYST · read-only.
**Slice:** `scripts/**` (CLI arms, run-eval.mjs, gate.sh, guards, path-safety.mjs, migration-plan/migrate, write-atomic), `src/components/**` + `src/routes/**` (console.tsx above all), tests/guards quality, configs (tsconfig chain, vite.config, package.json), docs-vs-code drift, migrations' resilience, shell-sprint's new files.
**Deliverable:** appended `§A2` in `wave_plans/W34/code-notes.md` above END-OF-FILE-MARKER-NOTES (append-only; re-read bytes before every append).
**Baseline HEAD:** `0f85c32` + W29–W33 era. No test runs / no builds / no keyed calls. Log-and-continue.

## Progress log

- [x] Read contract `wave_plans/W34/code-notes.md` in full (12 lines; read-only; ①②③④ per item; final FOR-THE-CODERS mini-guide; append-only).
- [x] Lane log created.
- [ ] Enumerate + read periphery files (scripts small/new first, then targeted reads of the 3 big files: rapidtool-cli.mjs 3468L, run-eval.mjs 2800L, console.tsx 6677L).
- [ ] Findings byte-checked with grep/read TODAY.
- [ ] §A2 appended above END-OF-FILE-MARKER-NOTES.

## Findings ledger (working notes; final text lives in §A2)

(populated as I read; each numbered item is what/why/fix/better-way)

- (reading begins…)

## Collisions / notes

- Sibling lanes L1–L3, P1–P3, A1 may land beside me — re-read bytes before every append; never touch product code.
