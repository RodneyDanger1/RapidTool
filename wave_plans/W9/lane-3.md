# W9 · LANE 3 — CLI behavior suites + 216s close-out

**Mission.** The `edit` arm and the T5 verbs are LANDED (W8-L3) and their contract tests are
green, but the BEHAVIOR suites were never written. Pin the real behaviors; close `fixes/216s`.

**Done-when:** NEW `scripts/rapidtool-cli-edit.test.mjs`: (1) dry-run NEVER writes (dir hash
identical before/after; the diff + would-be hashes returned); (2) ambiguous / missing / no-op
refusals are coded `RT_E_VALIDATION` exit 1 and write nothing; (3) `--write --project` applies
atomically + lands ONE ledger row with actor + `decidedVia` + patch + before/after hashes
(hash assertions on disk); (4) policy deny (no token / wrong seat) → refused, nothing written;
(5) containment: `--file` outside the dir → refused. NEW `scripts/rapidtool-cli-lesson.test.mjs`:
`lesson --advise` ranked read-only output + `lesson --verify` `ok|stale|anchor-missing` rows +
`--mark-stale` restricted to the knowledge store (project source refused). `fixes/216s` §1-4
filled with real output. Scripts leg green (grow from 238).

**Owned:** NEW `scripts/rapidtool-cli-edit.test.mjs` + `scripts/rapidtool-cli-lesson.test.mjs`,
`fixes/216s_cli_wave.md`. `scripts/rapidtool-cli.mjs` READ-ONLY (if a real defect appears,
report + fix ONLY that defect and record old→new in 216s).
**Anchors:** `case "edit"` ~:1113 (dry-run default ~:1302; `--write` ~:1310-1341; policy consult;
ledger row ~:1400); `case "lesson"` ~:1544 (`--advise` ~:2143, `--verify` ~:2202; envelope keys
incl. `rowsOk` — renamed from the dupe `ok` in W8; assert `rowsOk`+`stale`+`anchorMissing`).
**Verify:** `node --test "scripts/**/*.test.mjs"` (grow); `npm run typecheck`. Budget death ⇒ plain state.
