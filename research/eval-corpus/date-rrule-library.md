---
name: "RRULE Kit"
brief: "A TypeScript library (npm package) of recurrence-rule helpers: build and read RFC 5545 RRULE strings, compute the next and previous occurrence, expand a series; pure functions, no I/O."
kind: "library"
domain: "scheduling"
expectedNouns: ["rrule", "recurrenceRule", "occurrence", "series", "byDay", "interval"]
expectedCapabilities: ["Build RFC 5545 RRULE strings", "Read/parse RRULE strings back into a rule", "Compute the next occurrence", "Compute the previous occurrence", "Expand a recurrence series", "Pure functions with no I/O"]
acceptance: "One importable package: build an RFC 5545 RRULE string, read it back into a rule, compute the next and previous occurrences, expand a series, and export the whole surface from the package entry — with no I/O at import time."
baseline: "not yet measured by an eval run — the brief is K9's probe-verified kind brief (W40 probe-k9-kinds.mjs, library 8/8: pkg.main exports/files resolve; the entry imports under node --experimental-strip-types and runs no I/O); authored 2026-09-27 by W41 · P3 (fixes/295_p3_eval.md) — its first recorded run establishes the baseline"
---

## Provenance

- **Authored, NOT transcribed — stated plainly:** authored 2026-09-27 by W41 · P3 to close the missing-kind gap
  (§R7-f04): no `library` fixture existed. The brief text is the one K9's runnable-kind probe verified
  empirically (library 8/8 — `main`/`exports`/`files` resolve and the entry imports clean); no dossier run and
  no eval-run row stand behind it — the `baseline` line says so.
- **What is evidence-shaped and what is not:** `expectedNouns` / `expectedCapabilities` decompose the brief;
  the `acceptance` line documents the run-side bar in `graders/date-rrule-library.grader.json` (the grading
  source of truth, read only by `scripts/run-eval.mjs`).
- **Declared kind:** `library` — the driver maps it to the honest single-module library path (no
  `Project.kind` override) and the grader asserts the emitted README's `**Kind:**` line reads `library`
  (`expectedKind`), so a keyword-table regression cannot silently mis-kind the case.
