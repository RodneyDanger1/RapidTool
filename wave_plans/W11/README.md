# wave_plans/W11 — README (wave design + ownership map)

**Wave:** W11 — "W10 close-out + the honest-core wave" (dispatched 2026-09-24).
**Dispatch basis:** W10 (engine truth + token ledger + verify-kind) landed its five lanes'
patches on 2026-09-17 but the wave was **never verified or closed** (no §7 changelog entry,
no `gate.sh` run, 7 files left modified, 3 of 5 landing logs never written). The parent
verified the W10 landings against bytes, repaired the stale tests, ran the gates green, and
closed W10 (see `fixes/216z_w10_landing_record.md`). That audit is also W11's input.

## Lane ownership (STRICT — a lane touches ONLY its own files)

| Lane | Persona | Owned files (ONLY these) | Landing log |
|---|---|---|---|
| L1 | Software engineer | `src/lib/compile-check.server.ts`, `src/lib/compile-check.server.test.ts` | `fixes/217d_verify_kind_leg_tests_and_tree_run_build.md` |
| L2 | Watchdog | `src/lib/honesty-guards.test.ts` (NEW), `fixes/217b_watchdog_verification.md` (NEW) | (same as deliverable) |
| L3 | Researcher | `fixes/217c_phase5_spec_and_decision_register.md` (NEW) | (same as deliverable) |
| L4 | Agentic engineer | `src/lib/headless.ts`, `src/lib/headless.test.ts`, `scripts/rapidtool-cli.mjs` | `fixes/217e_next_action_and_cli_dispatch.md` |
| L5 | Coding engineer | `src/lib/engine.ts`, `src/lib/scaffold.ts`, `src/lib/scaffold.test.ts` | `fixes/217f_engine_error_surface_and_tree_gitignore.md` |
| L6 | UI/UX artist + developer | `src/components/console.tsx` | `fixes/217g_console_s1_bugs_and_compaction.md` |

**Off-limits to every lane** (owned by a sibling or frozen): `src/lib/token-ledger.ts`,
`src/lib/node-runner.server.ts`, `src/lib/knowledge.ts`, `src/lib/patch.ts`,
`src/lib/codegen.server.ts`, `src/lib/dod.ts`, `src/lib/errors.ts`, `src/lib/store.ts`,
`src/components/cmd-palette.tsx`, `src/components/runtime-timeline-pane.tsx`,
all `*.server.test.ts` except L1's, `README.md`, `RESUME.md`, `taskuniverselog.md`,
`remainingwaves.md`. Do NOT create a new file outside your "Owned files" row.

## Every lane MUST read its own `lane-N.md` FIRST

Standing user directive: each brief carries an explicit numbered mini-task plan; a lane starts
from that plan, not from a theme.
