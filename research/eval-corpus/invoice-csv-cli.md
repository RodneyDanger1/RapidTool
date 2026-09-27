---
name: "Invoice CSV CLI"
brief: "A command-line tool that reads a CSV invoice export and converts it to a JSON summary: --in and --out flags, per-vendor totals, monthly rollups, non-zero exit on malformed rows."
kind: "cli-tool"
domain: "finance"
expectedNouns: ["invoice", "vendor", "vendorTotal", "monthlyRollup", "malformedRow", "exitCode"]
expectedCapabilities: ["Read a CSV invoice export from --in", "Write a JSON summary to --out", "Per-vendor totals", "Monthly rollups", "Non-zero exit on malformed rows", "A --help usage listing"]
acceptance: "One runnable CLI: `--in <csv> --out <json>` turns an invoice export into per-vendor totals and monthly rollups, `--help` prints usage and exits 0, and a malformed row makes the bare invocation refuse with a non-zero exit."
baseline: "not yet measured by an eval run — the brief is K9's probe-verified kind brief (W40 probe-k9-kinds.mjs, cli-tool 10/10: pkg.bin target bin/invoice-csv-cli.mjs; `--help` exits 0 with usage; the bare entry exits 1 RT_E_VALIDATION); authored 2026-09-27 by W41 · P3 (fixes/295_p3_eval.md) — its first recorded run establishes the baseline"
---

## Provenance

- **Authored, NOT transcribed — stated plainly:** authored 2026-09-27 by W41 · P3 to close the missing-kind gap
  (§R7-f04): no `cli-tool` fixture existed. The brief text is the one K9's runnable-kind probe verified
  empirically (cli-tool 10/10 — the `bin` table resolves, `--help` exits 0 with usage, the bare entry exits 1
  `RT_E_VALIDATION`); no dossier run and no eval-run row stand behind it — the `baseline` line says so.
- **What is evidence-shaped and what is not:** `expectedNouns` / `expectedCapabilities` decompose the brief;
  the `acceptance` line documents the run-side bar in `graders/invoice-csv-cli.grader.json` (the grading source
  of truth, read only by `scripts/run-eval.mjs`).
- **Declared kind:** `cli-tool` — mapped to `Project.kind: "tool"` by the driver and asserted against the
  emitted README's `**Kind:**` line by the grader's `expectedKind`. The emitted tree carries **no `index.html`**
  — the grader's `expectedFiles` deliberately omits it (the §R7-f03 done-when: a cli-tool case passes without an
  HTML shell).
