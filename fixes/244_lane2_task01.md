# 244 · LANE 2 — TASK-01 · `nextAction` on the summary envelope

**Status:** IN PROGRESS (skeleton written early per W16 rule — filled as evidence lands)
**Bottom line:** TBD — target contract: the `summary` envelope carries `nextAction: {kind, cmd, phase, why}`
drawn from the SAME 7-arm vocabulary pinned at `src/components/console.tsx:382 NEXT_ACTION_BUTTON`
(`run · approve · retry · done · running · fix-gate · unknown`), pinned by a doc-contract arm-parity test
under `scripts/`, proven by a keyless `summary` probe. `src/lib/headless.test.ts` must stay 92/92.

## Box (W16 lane brief)
- `src/lib/headless.ts` — summary envelope region ONLY (`ProjectSummary` :960, `summary()` :985)
- `scripts/rapidtool-cli.mjs` — the `summary` arm ONLY (`case "summary":` :1464)
- NEW `scripts/*.test.mjs` — doc-contract arm-parity test
- NOT touched: `console.tsx`, `headless.test.ts` (other lanes' boxes)

## Reads (commands that ran)
1. `sed -n '360,430p' src/components/console.tsx` → NEXT_ACTION_BUTTON 7 arms visible (see evidence below).
2. `sed -n '240,379p' src/components/console.tsx` → `UiNextAction` (:250) + `uiNextAction` (:311) branch order.
3. `sed -n '940,1069p' src/lib/headless.ts` → `ProjectSummary` :960, `summary()` :985 return object :1008.
4. `sed -n '140,185p' research/multiagent/230_task_execution_playbook.md` → TASK-01 playbook block.
5. `sed -n '1440,1500p' scripts/rapidtool-cli.mjs` → summary arm serialises the whole object.

## Evidence (to fill)
- [ ] grep `nextAction` headless.ts > 0 (was 0)
- [ ] arm-parity test file + run output
- [ ] keyless CLI summary probe JSON shows `nextAction`
- [ ] headless.test.ts targeted run 92/92
- [ ] console.tsx untouched (`git status`/diff check)
