# 216s — CLI wave: 108-T1 in-place `edit` verb + 112 T5 `lesson --advise`/`--verify`

**Status:** W7-L3 + W8-L3 landed the `edit` arm + T5 verbs (contract tests green).
**W9-L3 (2026-09-17):** the BEHAVIOR suites (this lane) — DONE: NEW
`scripts/rapidtool-cli-edit.test.mjs` (10 tests) + NEW `scripts/rapidtool-cli-lesson.test.mjs`
(13 tests), both green; scripts leg **261 pass / 0 fail** (grew from 238); `npm run typecheck`
exit 0; `scripts/rapidtool-cli.mjs` untouched (no old→new). Real output in §3; cross-file
observations in §4.

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

### W7-L3 (landed: steps 1–3 only — see §5)

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

### W9-L3 (this lane — behavior suites + 216s close-out) — DONE

- [x] 1. RECON: read `wave_plans/W9/lane-3.md` + this file; re-read `case "edit"` (:1115-1415),
      `case "lesson"` (:1849-2547; `--advise` :2143, `--verify` :2302); `scripts/README-cli.test.mjs`
      (W7 re-land kit live: `verbArmSource` helper + 3 `edit` contract tests at :158-196).
- [x] 2. Baseline: scripts leg BEFORE — `node --test "scripts/**/*.test.mjs"` → **238 pass / 0 fail**
      (~10.2s).
- [x] 3. NEW `scripts/rapidtool-cli-edit.test.mjs` (458 lines, 10 tests) — dry-run-never-writes
      (dir-digest byte-identical + would-be hashes); coded refusals (ambiguous / missing / no-op /
      write-without-project) exit 1 `RT_E_VALIDATION`, nothing written; write+ledger+decidedVia
      with ON-DISK hash assertions (reported `hashAfter` recomputed from the bytes the write
      really produced + the ledger row re-read from `build.json`); policy deny (no token) for
      write AND dry-run pre-flight + verified-human-token allow path; containment (`../` escape
      + absolute path) refused, outside bytes untouched. **GREEN.**
- [x] 4. NEW `scripts/rapidtool-cli-lesson.test.mjs` (13 tests) — advise read-only ranked
      fail-class rows (score-desc + fusion-rank + `--phase` + `--limit` + exactly-one-source
      refusals + the store source, non-fail class excluded); verify `ok|stale|anchor-missing`
      rows with `rowsOk`/`stale`/`anchorMissing` counts (fnv1a decimal AND hex recorded forms);
      anchor missing (no token) / anchor absent (path); `--mark-stale` store-only telemetry
      write (counterEvidence bump asserted on disk, content fields byte-identical) +
      project-source refusal. Store fixture built by the REAL `lesson --accept` verb. **GREEN.**
- [x] 5. Verification: scripts leg AFTER → **261 pass / 0 fail** (grew 238 → 261, +10 +13);
      `npm run typecheck` → exit 0 (no diagnostics).

## 2. Old→new string/behavior ledger

### W7-L3

- Contract tests parked: 3 `edit` tests removed from the live `scripts/README-cli.test.mjs`
  (parent, W7 boundary) and re-landed by W8-L3 with the `verbArmSource` helper — no behavior changed.

### W9-L3

- (none landed — `scripts/rapidtool-cli.mjs` is byte-identical for this lane: every suite
  assertion was satisfiable against the shipped behavior, so no minimal defect fix was
  warranted. One envelope-shape inconsistency was observed and is REPORTED, not fixed —
  the `edit` containment refusal (:1157-1167) carries no `written:false` where the
  policy denials / patch refusals do; see §4.)

## 3. Real command output

### W9-L3 — baseline (before the new suites)

```text
$ node --test "scripts/**/*.test.mjs"     # run from the repo root
# tests 238
# suites 0
# pass 238
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 10243.898
```

### W9-L3 — new suites (the actual runs)

```text
$ node --test scripts/rapidtool-cli-edit.test.mjs scripts/rapidtool-cli-lesson.test.mjs
# (10 edit + 13 lesson behavior tests — every named pin above)
ok 1 - W9-L3 edit: dry-run (the default) returns the diff + would-be hashes and NEVER writes
...
ok 10 - W9-L3 edit: containment — a --file outside --dir is refused (relative .. and absolute) and nothing is written
ok 11 - W9-L3 lesson: the fixture store — accept promotes all four lesson rows with actor provenance
...
ok 23 - W9-L3 lesson: --mark-stale bumps counterEvidence on the stale store row ONLY — content untouched
# tests 23
# suites 0
# pass 23
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 30167.4012
```

### W9-L3 — scripts leg AFTER + typecheck

```text
$ node --test "scripts/**/*.test.mjs"     # run from the repo root
# tests 261
# suites 0
# pass 261
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 35244.7068

$ npm run typecheck
> tsc --noEmit          # exit 0 — no diagnostics
```

## 4. Cross-file needs (NOT this lane's files)

### W9-L3

- `scripts/rapidtool-cli.mjs` (READ-ONLY this lane) — envelope observation, no fix landed:
  the `edit` containment refusal (:1157-1167, and the sibling pre-flight refusals
  :1132/:1146/:1176/:1189/:1200) carries `{ok:false, error, code, dir}` but NO `written:false`,
  while the policy deny (:1222), patch refusal (:1240) and --write-without---project refusal
  (:1310) all carry it. It does not block any behavior suite (the tests pin exit 1 +
  `RT_E_VALIDATION` + the error naming containment + the dir echo + on-disk stillness), so no
  minimal fix was made. If a later lane unifies the refusal envelope, add `written:false` to
  the containment branch.
- `scripts/README-cli.md` (not this lane's file) — the Lessons table (:729-736) documents
  `--list`/`--propose`/`--accept`/`--supersede`/`--refute` but NOT the 216s T5 arms
  `--advise`/`--verify`, although :19 lists them in the family and the CLI usage text
  documents them (rapidtool-cli.mjs:50-51). The envelope keys the suites pin (`rankedBy`,
  `readOnly`, `rowsOk`/`stale`/`anchorMissing`, `marked`, the `ok|stale|anchor-missing`
  statuses) are likewise undocumented. Contract-doc gap for the README-cli.md owner.

## 5. Not done / deferred

### W9-L3 (2026-09-17)

Nothing owed for the behavior suites: both NEW files landed + green (edit 10 / lesson 13),
the CLI stayed byte-identical (no old→new), and §3 carries the real runs. The open items are
the §4 cross-file observations (README-cli.md Lessons table; the containment refusal envelope)
— other owners' files, not this lane's.

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
