# Production Proof — TagLink CLI (live, real DeepSeek key)

Journey driven headlessly via the RapidTool CLI (`node --experimental-strip-types scripts/rapidtool-cli.mjs`, `--env-file=.env`). Project: `C:/Users/mnril/rapidtool-proof37/project.json`; per-command envelopes in `rapidtool-proof37/logs/`.

## Journey (all real runs, exit codes captured)
| # | Command | Exit | Result |
|---|---|---|---|
| 00 | doctor | 0 | llm configured (v4 flash/pro), research configured+probed, runner available, Node v22.23.2 |
| 01 | create "a link-saving bookmark CLI with tags" | 0 | TagLink CLI, intake, memory 3, vaultReady |
| 02 | gate --autopilot --live | 2 | parked @P0 reframe gate (live research ran: 5 corpus items) |
| 03 | approve (P0) | 0 | advanced |
| 04 | gate --autopilot --live | 2 | P0–P3 complete, parked @P4 stock HITL |
| 05 | crew --max-steps 12 | 0 | real DeepSeek advisory review: 1 reviewer message + "P4 Review — FAIL verdict" artifact (advisory only — gates untouched) |
| 06-07 | approve P4 → gate | 2 | parked @P5 |
| 20 | design | 0 | tokens JSON (deterministic palette) |
| 21 | diagram --kind phases | 0 | 8,131-byte SVG written |
| 22 | artifacts | 0 | artifact list |
| 23 | vault | 0 | note dir written (ADR / packet / approve-interface …) |
| 24 | search "bookmark" | 0 | hits |
| 25 | harvest | 0 | keyless open-source harvesting ran |
| 26 | bench | 0 | synthetic estimates |
| 27 | prompt | 0 | hyper-prompt expansion (real key) |
| 28 | swarm | 0 | advisory swarm critique |
| 29 | summary | 0 | project summary |
| 30 | export | 0 | 89,712-byte project JSON |
| 31 | packet | 0 | 13,635-byte agent packet (.md) |

## Every feature exercised
Deterministic 13-phase engine · live keyless research · live LLM narratives · governed
HITL gates · crew (real advisory) · verify loop (proven separately live: 4/4 machine
cases passed, lastTest stamped tested + evidenceHash) · design tokens · SVG diagrams ·
2nd-brain vault · packet compiler · export/import · harvest (Pillar 1) · prompt engine ·
swarm DAG advisory · synthetic benchmark · error-code taxonomy (RT_E_* observed live on
failure probes) · Wild Mode autonomous loop (proven live: P0→P12, 38 ledger entries) ·
grounded chat copilot (unit-verified; browser round-trip verified).

## Honest notes
- The deterministic engine parks at HITL gates by design — approvals were scripted
  (human-equivalent) in this run; Wild Mode performs them autonomously when enabled.
- `design` prints tokens JSON (no --out file) — documented CLI shape.
- A proof-run helper once wrote to `C:\c\...` via an MSYS-style path — script bug,
  not a product bug (product wrote exactly where it was told).
