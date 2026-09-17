# W7 · LANE 3 — CLI wave: 108-T1 in-place edit verb + 112 T5 lesson verbs

**Mission.** Two Wave-H CLI features: the in-place edit verb with dry-run + ledger attribution
(108-T1) and the lesson `--advise`/`--verify` verbs (112 T5). The `lesson` command already
exists (`scripts/rapidtool-cli.mjs` `case "lesson"` :1544 — extend it, don't fork it).

**Done-when:** `edit` verb exists: DRY-RUN BY DEFAULT (writes only with an explicit flag),
every write attributed in the ledger with decidedBy + note + the W6 `decidedVia` provenance
where applicable, refusals coded; `lesson --advise` + `lesson --verify` work per dossier 112 T5;
the README-cli doc contract is updated test-first and green; scripts leg green (grow); exit codes
of EXISTING verbs unchanged; `fixes/216s_cli_wave.md` written.

**Owned:** `scripts/rapidtool-cli.mjs`, `scripts/README-cli.test.mjs` (contract + counts),
`scripts/*.test.mjs` additions as needed, `fixes/216s_cli_wave.md` (NEW).
NOT yours: codegen/headless (L1), engine (L2), llm (L4), verification (L5).

**MINI-TASK PLAN:**
1. Read dossier `research/multiagent/108_competitors_app_generators.md` T-108.1 row + dossier
   `112_*` T5 row (grep for "T5" / "advise"); read the CLI's verb table + `case "lesson"` block
   (:1544) + how verbs report (JSON envelope shape, exit codes) + `scripts/README-cli.test.mjs`
   (the doc contract: verb list + counts).
2. 108-T1 FIRST (higher value): `edit` verb — dry-run default prints the would-be diff; `--write`
   (or the dossier's flag) applies; ledger attribution row via the same seam the approve path
   uses; refusals coded (RT_E_*). Update the README-cli contract list test-first.
3. 112 T5 second: `lesson --advise` (ranked lessons for a brief) + `--verify` (verify a lesson's
   status) per the dossier's spec.
4. Tests: scripts-leg tests for both (happy + refusal + dry-run-never-writes);
   `node --test scripts/README-cli.test.mjs` green.
5. `fixes/216s` skeleton first; real command output pasted.
**TRAPS:** the CLI is the maker-test surface — additive only; never renumber/rename existing
verbs; keep the JSON envelope backward compatible.
Budget death ⇒ T1 must be COMPLETE and green; report T5 state plainly.
