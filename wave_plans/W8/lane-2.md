# W8 · LANE 2 — logs lane: 216o + 216p + 216v bodies (verified numbers only)

**Mission.** Three landing logs are skeletons; their code is verified green. Write the bodies
from the W6/W7 summaries + a fresh re-run of the named suites. No code changes.

**Done-when:** `fixes/216o`, `fixes/216p`, `fixes/216v` have complete bodies: work log,
commands + REAL pasted output, old→new (incl. the parent fixes listed below), cross-file needs,
not-done. Every number re-derived from a run YOU made this session.

**Owned:** `fixes/216o_policy_integration.md`, `fixes/216p_provider_registry.md`,
NEW `fixes/216v_compaction_constants.md`. NOTHING else (no src/, no scripts/).

**Sources:** W6 summaries `subagent-summary-{1,2}-20260916_220208_508348.txt` (216o = L2 pins;
216p = L3 registry+doctor) + W7 summaries `subagent-summary-{1,3}-20260917_083223_*.txt`
(compaction module = 216v; mock/subagent context). Parent fixes to record: doctor type-only
import; gate.sh nested glob; compaction test assertions replaced + `promptTokens < 0` guard;
mock import paths; LlmResult.model; role:null mapping; `_lessons`.
**Run (real output):** headless, gates, README-cli, registry, verify.server, chat, crew, doctor,
compaction — expected 90/90, 85/85, 5/5, 21/21, 20/20, 70/70, 46/46, 15/15, 19/19.
**216v specifics:** the module's wired-point/deferral decision (§3 of the module header references
THE FILE YOU ARE WRITING) — state the honest decision: no compaction site exists in engine.ts
today; named consumers = chat history rollup + codegen chunk assembly (deferred; no caller).
