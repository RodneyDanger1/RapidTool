# W8 · LANE 3 — CLI wave REDO: `edit` verb + `lesson --advise/--verify`

**Read `fixes/216s_cli_wave.md` §5 FIRST — the three pre-written contract tests are preserved
there VERBATIM. Re-land them WITH the helper they call.**

**Mission.** Complete 108-T1 + 112 T5 as originally briefed (wave_plans/W7/lane-3.md still
applies): `edit` verb dry-run by default / `--write` explicit / policy seam
`evaluatePolicy("repair.apply", tree:<dir>)` / `decidedVia` provenance / coded refusals; then
`lesson --advise` + `lesson --verify`.

**Done-when:** the 3 preserved tests re-landed GREEN (with the `verbArmSource(cliText, verb)`
helper added near the other test helpers); `edit` arm implemented + `README-cli.md` gets its
`## Edit (\`edit\`)` section (documented BEFORE the test goes green — test-first); behavior
suites (dry-run-never-writes / ambiguous refusal / write+ledger+decidedVia / policy deny) as
NEW `scripts/rapidtool-cli-edit.test.mjs`; T5 verbs + `scripts/rapidtool-cli-lesson.test.mjs`;
existing verb counts/exit codes unchanged; scripts leg green (grow); `fixes/216s` sections 1-4
filled with real output.

**Owned:** `scripts/rapidtool-cli.mjs`, `scripts/README-cli.test.mjs`, `scripts/README-cli.md`,
NEW `scripts/rapidtool-cli-edit.test.mjs` + `scripts/rapidtool-cli-lesson.test.mjs`,
`fixes/216s_cli_wave.md`. NOT: src/lib/* (L1), fixes/216o/p/v (L2), fixes/216t (L4),
codegen tests (L5).

**Anchors:** `case "lesson"` :1544 (actions list :1557, list :1571, accept :1720, supersede
:1779, refute :1832); approve seam :553-575; `cliLogEvent` :280-288; dossier 108 :554-567/:682;
dossier 112 :135-152/:176/:262/:387. **T1 FIRST — complete and green before T5 starts.**
Budget death ⇒ T1 complete + T5 plain state.
