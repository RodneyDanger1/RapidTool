# Integration pass — parent (post 9+6+3+2-agent waves)

All waves landed; parent integrated, fixed cross-wave drift, and verified end-to-end.

## Parent fixes
1. **packet.ts** — builder-wave seam: removed the stale chained `.filter().join()` the
   sweeper left on the `full` array (made `full` a string → typecheck error cascading
   148 test failures). Restored: `const full = [...]` → `full.join("\n").replace(/\n{3,}/g,"\n\n")`.
2. **store.ts runModuleReal (G2, research-wave finding)** — real-run verdict was
   discarded: spread the pre-run snapshot instead of `runP6Real`'s re-stamped project,
   so DoD p6-test could read green while the real run failed. Now uses `out.project ?? project`.
3. **headless.ts lint** — no-control-regex: replaced control-char regex literals with a
   `CONTROL_RE` built via `String.fromCharCode` injection; removed dead `safeTitleFile`.
4. **vault.ts lint** — removed useless `\[` escape in TITLE_BAN.
5. **Cleanup** — removed `__probe/` + `__probe__/` scratch dirs left by sweepers.

## Wave deliverables verified live
- **2nd brain**: `vault.ts` (21 tests) — CLI `vault` wrote 22 interlinked .md notes
  (MOC + wikilinks); `search` ranked 7 hits.
- **Design**: `design.ts` (31 tests) — deterministic WCAG-AA-checked palettes;
  CLI `design` → "logistics · rust" tokens; Design tab renders swatches live.
- **Diagrams**: `diagram.ts` (Screenshot-QA'd) — CLI `diagram --kind phases` wrote an
  8,109-byte SVG; Diagram tab renders it as a data-URI img (zero JS errors).
- **Crew**: flash-only multi-agent run verified earlier ("3 messages · 14 artifacts").
- **Verify loop**: machine-run fail-to-pass proven live (broken adder fixed by the
  loop in 2 iterations, machine-declared pass).
- **Bug waves**: memory-id collision fix, emptyProject A2 trace fix, runAlgorithms
  corrupt-currentPhase crash guard, ST-6 async serialization + rebaseUserFields,
  packet backtick envelope escape (`\u0060`), report-intake tests_run validation +
  forwarding, newline/title sanitization, error-component duck-typed messages +
  surrogate-safe truncation, gate-identity blank-claim fix, gate-session stale-bearer
  fix, io slugName 80-char cap, handoff corrupt-row guard, gate-stats junk-row guard.

## Final gate (all after last edit)
typecheck 0 · lint 0 (0 warnings) · build 0 · **446/446 tests** (28 suites) ·
browser E2E: 8 tabs (Artifacts/Packet/Spec/Crew/Oracle/Vault/Design/Diagram),
0 console errors · CLI E2E: create→run→artifacts→vault→search→design→diagram→summary,
one JSON object per command, exit-code contract honored.
`npm test` scripts leg: same 10 documented Windows env-baseline failures (fixes/06, fixes/08).

## Research blueprints for the next wave (read these first)
- research/multiagent/08_enhancement_register.md — E-01…E-30 ranked, file:line-spec'd.
- research/multiagent/11_agency_plan.md — 20 competitor gaps with borrow repos + specs.
- research/multiagent/07_opensource_steal_catalog.md — license-verified top-10.
- research/multiagent/09_agent_perfection_audit.md — F-01…F-24 friction register.
- research/multiagent/10_production_readiness.md — G1…G5 + game variant.
- research/multiagent/12_ui_wiring_map.md — not written by agent #9 (budget); the
  parent's tab E2E above covers the essential surface.
