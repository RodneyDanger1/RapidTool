# 188 — 185-H5 CLI diagnose no longer hardcodes persistHealth / wildRun

`rapidtool diagnose --project <file>` now loads the project:
- `project.name/status/currentPhase/wildRun` come from the file
- load failure → `persistHealth.ok: false` with the error (rule 4 can fire)
- no `--project` → wildRun stays null (honest: no project)

Grok 185 diagnose `unclassified-errors` + Composer 186 chat grounding already
on disk; parent four-gate after 187 was 1500/1500.

185-U1 (`shouldPromoteLesson` on `lesson --accept`) not wired this pass:
accept has no maker-score pair today; gating it would refuse every accept.
Needs an eval-score field on the project before the predicate is a product
caller.
