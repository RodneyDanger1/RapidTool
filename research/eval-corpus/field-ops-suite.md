---
name: "Field-Ops Suite"
brief: "a field-ops suite for a small construction company: projects with phases + budgets, daily task lists per crew member, time sheets that roll into weekly payroll with rates + overtime, material/supply lists with purchase tracking + reorder flags, job costing by project"
kind: "webapp"
domain: "construction"
expectedNouns: ["project", "phase", "budget", "taskList", "crewMember", "timeSheet", "payroll", "rate", "overtime", "material", "supply", "purchase", "reorderFlag", "jobCost"]
expectedCapabilities: ["Projects with phases and budgets", "Daily task lists per crew member", "Time sheets that roll into weekly payroll with rates and overtime", "Material and supply lists with purchase tracking and reorder flags", "Job costing by project"]
acceptance: "A small construction company can run a project from phases and budgets through daily per-crew task lists, weekly payroll computed from time sheets with rates and overtime, and supply purchases with reorder flags — with job costing per project — in one runnable web app."
baseline: "delivery ≈ 1/10 (interim — journey parked at P8 on a human gate at the agent cap; seam fixes work, P6 still never ships a module) (dossier 98_make_5)"
---

## Provenance

- **Dossier:** `research/multiagent/98_make_5_field_ops_suite.md` (Coffeehouse2Home Phase 1, product 5/5 — dossier incomplete by agent cap, not by design).
- **Run evidence:** `%TEMP%\rapidtool-make-b5\` (field-ops.json at P8, field-ops2.json, ~15 envelopes, probe-l2.mjs/probe-l2b.mjs, drive-journey.sh ready for the remainder). Verbatim brief recovered from `field-ops.json` `brief` (267 chars); recorded project name `FieldOps Suite`; kind inferred `webapp`.
- **Documented expected outcomes:** keyed-P6 seam fires under bare Node (RT_E_LLM_TIMEOUT after 90s — honest refusal); lesson builders proven via probe-l2.mjs but zero lessons on the real run; residual deterministic bodies on a field-ops brief with lattice jobs just `[track]` and noise entities listing/list — expected lattice domain `construction` (118 P-D3 domain, per algorithms.ts DOMAIN_RISK/LIB_DOMAIN).
