# wave_plans/W12 — README (ownership map + dispatch record)

**Wave:** W12 — "bug hunt + UI simplification" (dispatched 2026-09-24, `deleg_dfd587de`, 7 lanes).
**Prerequisite:** W11 (`deleg_cbb4ad83`) had stopped; its close-out verification is this wave's
`wd-1`. The parent's W10 record is `fixes/216z_w10_landing_record.md`; W11's repair register lands
at `fixes/217h_w11_verification_register.md`.

## Lane ownership (STRICT — a lane touches ONLY its own files)

| Lane | Persona | Owned files | Landing log |
|---|---|---|---|
| lane-a | Bug hunter 1 | `src/lib/errors.ts`, `src/lib/errors.test.ts`, `src/lib/auth/popup.server.ts`, `src/routes/__root.tsx` | `fixes/217j_error_classifier_and_bare_catches.md` |
| lane-b | Bug hunter 2 | `src/lib/codegen.server.ts`, `src/lib/codegen.server.test.ts` | `fixes/217k_llm_envelope_silent_sinks.md` |
| lane-c | Bug hunter 3 | `src/lib/knowledge.ts`, `src/lib/knowledge.test.ts`, `src/lib/algorithms.ts`, `src/lib/algorithms.test.ts`, `src/lib/harvest.ts`, `src/lib/harvest.test.ts` | `fixes/217l_knowledge_algorithms_defects.md` |
| lane-d | UI/UX simplification | `src/components/console.tsx` | `fixes/217m_console_simplification.md` |
| lane-e | UI/UX shell + a11y + capability audit | `src/styles.css`, `src/routes/index.tsx`, `src/routes/run.$id.tsx`, `src/components/cmd-palette.tsx`, `src/components/runtime-timeline-pane.tsx` | `fixes/217n_ui_shell_a11y_and_capability_audit.md` |
| wd-1 | Watchdog — W11 close-out | (read-only) | `fixes/217h_w11_verification_register.md` |
| wd-2 | Watchdog — W12 live audit | (read-only) | `fixes/217i_w12_watchdog_register.md` |

**Forbidden to every lane:** `src/lib/engine.ts`, `src/lib/scaffold.ts`, `src/lib/headless.ts`,
`src/lib/token-ledger.ts`, `src/lib/node-runner.server.ts`, `src/lib/compile-check.server.ts`,
`src/lib/patch.ts`, `src/lib/store.ts`, `src/lib/dod.ts`, `README.md`, `RESUME.md`,
`taskuniverselog.md`, `remainingwaves.md`, `AGENTS.md` (frozen for this wave — the parent updates
the board at the boundary).

**Machine discipline (8 GB box; the desktop froze under load earlier today):** targeted
`--test-concurrency=2` runs only; ≤1 `npm run typecheck` per lane, at the end; `npm test` and
`npm run build` are parent-only at the wave boundary. Watchdogs run no typecheck/build at all.
