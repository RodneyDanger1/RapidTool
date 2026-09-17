# 216s — CLI wave: 108-T1 in-place `edit` verb + 112 T5 `lesson --advise`/`--verify` — SKELETON

**Status:** IN PROGRESS (skeleton-first; work log + real output appended as steps land).

**Mission.** W7 · LANE 3 (`wave_plans/W7/lane-3.md`): two CLI features.
(1) 108-T1 — the in-place edit verb (`scripts/rapidtool-cli.mjs`, NEW `edit` arm):
**dry-run by default** (writes only with an explicit `--write`), every write attributed in the
ledger with actor + patch + resulting hash, and the decision routed through the ONE policy seam
(`src/lib/policy.ts` `evaluatePolicy`, action `repair.apply` on `tree:<dir>`) so the row carries
the same W6 `decidedVia` provenance shape the `approve` path stamps; refusals coded (`RT_E_*`).
(2) 112 T5 — `lesson --advise` (ranked fail-lessons for a brief, read-only pre-flight) and
`lesson --verify` (anchor re-hash → `ok | stale | anchor-missing`, read-only unless
`--mark-stale`, which writes telemetry only). Extends the existing `case "lesson"` arm (:1544).

**Owned files:** `scripts/rapidtool-cli.mjs`, `scripts/README-cli.test.mjs` (doc contract +
counts), NEW `scripts/rapidtool-cli-edit.test.mjs` + `scripts/rapidtool-cli-lesson.test.mjs`
(behavioral suites), `scripts/README-cli.md` (the contract doc the tests bind), THIS file.
**NOT touched:** codegen/headless (L1), engine (L2), llm (L4), verification (L5), `src/lib/*`.

## 1. Work log (append-only)

- [ ] 1. RECON: dossier 108 §"mechanisms missing" #1 (T-108.1 row :682) + dossier 112 §3.3/§4.4/T5
      (:176, :262, :387); CLI verb table + `case "lesson"` (:1544) + `approve` seam (:496-579) +
      `patch.ts` (T-107.1 primitive) + `policy.ts` (repair.apply/tree.emit) + README-cli contract test.
- [ ] 2. Baseline: scripts leg BEFORE (real count), README-cli.test.mjs before.
- [ ] 3. T1 test-first: contract tests for `edit` added → RED (recorded).
- [ ] 4. T1 implement: `edit` arm + USAGE + header comment + README-cli.md.
- [ ] 5. T1 behavior tests: dry-run-never-writes, ambiguous refusal, write+ledger+decidedVia,
      policy deny on `--i-am-human` without token.
- [ ] 6. T5 test-first: contract tests for `lesson --advise`/`--verify` → RED (recorded).
- [ ] 7. T5 implement + behavior tests.
- [ ] 8. Verification: scripts leg AFTER (grow), typecheck, existing-verb exit codes unchanged.

## 2. Old→new string/behavior ledger

(fill as deliberate changes land)

## 3. Real command output

(fill with the actual runs — verbatim)

## 4. Cross-file needs (NOT this lane's files)

(fill)

## 5. Not done / deferred

**W7 boundary status (parent, 2026-09-17 ~08:40):** the lane landed ONLY step 3 (test-first) and
left `scripts/README-cli.test.mjs` ERRORING (3 tests referencing a missing `verbArmSource`
helper). The parent REMOVED those 3 tests from the live file (restoring the scripts leg to
green) and preserves them VERBATIM below — W8-L3 re-lands them together with the
`verbArmSource(cliText, verb)` helper + the `edit` arm + README-cli.md section + the T5 verbs.
Everything else (T1 arm, T5, behavior suites, old→new, real output) still owed.

### Pre-written contract tests (verbatim — re-land WITH the helper)

```js
// W7-L3 re-land kit: put these in scripts/README-cli.test.mjs AND add the helper:
//   const verbArmSource = (src, verb) => { const i = src.indexOf(`case "${verb}"`); ...extract the arm block... };
test("W7-L3: the `edit` arm exists, reads the documented dry-run/write flags", () => {
  const arm = verbArmSource(cliText, "edit");
  assert.ok(arm, 'rapidtool-cli.mjs has no `case "edit"` arm — the README documents one');
  assert.match(arm, /flag\(args,\s*"write"\)/, "the edit arm must read the documented --write flag (dry-run is the default)");
  assert.match(arm, /dry-run/i, "the edit arm must name its dry-run default");
});

test("W7-L3: the `edit` write path reuses the str_replace primitive + the ONE policy seam", () => {
  const arm = verbArmSource(cliText, "edit");
  assert.ok(arm, 'rapidtool-cli.mjs has no `case "edit"` arm');
  assert.match(arm, /applyStrReplace/, "the edit arm must use the T-107.1 str_replace primitive (src/lib/patch.ts)");
  assert.match(arm, /evaluatePolicy\(\s*"repair\.apply"/, 'the edit write path must consult evaluatePolicy("repair.apply", `tree:<dir>`)');
  assert.match(arm, /decidedVia/, "the edit write path must record the W6 decidedVia provenance shape");
});

test("W7-L3: the README documents the `edit` verb's dry-run default + --write flag", () => {
  assert.match(readmeText, /^## Edit \(`edit`\)/m, "README-cli.md must carry a `## Edit (`edit`)` section");
  assert.match(readmeText, /--write/, "the edit section must document the --write flag");
  assert.match(readmeText, /dry-run/i, "the edit section must state the dry-run default");
  assert.match(readmeText, /repair\.apply/, "the edit section must name the policy action its write is routed through");
});
```

(Comment bodies from the originals survive in the W7 transcript: `deleg_ce19b316/task-2.log`.)
