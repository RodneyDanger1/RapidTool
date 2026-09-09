# 137 — Coffeehouse2Home suite mission (Phase 3/4): real-estate tool suite + RapidTool bug loop

For the house-flipper/realtor friend. Relay protocol:
- BUILDER-A / BUILDER-B drive REAL keyed journeys (source `set -a && . ./.env && set +a`) and
  APPEND every RapidTool failure to fixes/137_failures.md as `## BUG-A<n>` / `## BUG-B<n>`
  blocks: symptom, phase, refusal class/code, evidence (log lines), what SHOULD have happened.
- FIXER polls fixes/137_failures.md, fixes RapidTool in bounded patches (patch-only, gates
  green at the end), and marks each bug `FIXED: <change> + test` in the same block.
- RESEARCHER is read-only: polls both builder transcripts + failures file and web-searches
  WHY each failure class happens (codegen repair loops, module decomposition, LLM one-shot
  limits), appending `## WHY-BUG-A<n>` answers with URLs to fixes/137_research.md.
- Builders RE-RUN after fixes land; a bug is CLOSED only on a live green re-run.
