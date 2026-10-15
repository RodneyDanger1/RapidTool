# fixes/357 — lane `fix-tests` (W357) — SKELETON

**Wave:** W357. **Lane:** `fix-tests` (persona `quill`), 1 of 6.
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (path contains a space). **Shell:** Windows PowerShell 5.1.
**Host:** Node **v24.15.0**. **HEAD:** `30bce78` (`main`), **dirty tree** — every number below describes the
bytes on disk, not a frozen commit.
**Owned files (mine alone):** `src/lib/scaffold.ts`, `src/lib/scaffold.test.ts`, `src/lib/wild-step.test.ts`,
`src/lib/headless.test.ts`, plus any residual failing test file no other W357 lane owns.
**Log:** append-only; this lane is its only writer.

## §0 — Skeleton (written BEFORE the edits)

### Mission (quoted from `wave_plans/W357/fix-tests.md`)
1. Attribute every residual failure from the W356 boundary (`testsScripts {pass:643, fail:7}` ·
   `testsLib {pass:4215, fail:5, skipped:2}`) — file, source-or-test, new-or-pre-existing, owner.
2. Close the ones this lane owns, fixing the cause; where the test is the wrong side, fix the test and say so.
3. **R-7:** remove the surviving reachable `assert.fail` at `scaffold.ts:6323/6396` if it can still fail a
   tree, without changing any assertion for a WIRED row.
4. **`RT_E_SPEC_SKIP_VACUOUS` (`scaffold.ts:8284`):** prove whether a "green while reporting its shortfall"
   emission can be reddened by it; fix or record as a named residual with the triggering input.
5. The `scaffold.test.ts:1771` / `:2762` UI-generation reds (traced to `scaffold.ts:8915-8952`) — do not
   paper over; record as a named residual if the fix is a product decision.

### Commands (verbatim)

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
npx tsc --noEmit
node --test --test-reporter=tap "scripts/**/*.test.mjs"
node --experimental-strip-types --test --test-reporter=tap "src/lib/**/*.test.ts" "src/components/**/*.test.ts"
```

### Not run (hard constraint)
`bash scripts/gate.sh` (the boundary owns it), `npm run build`, any keyed LLM call, any git write.
Probes live in `%TEMP%\rt-w357\` only.

---

# APPEND 1 — attribution (both legs, measured), then the fixes

## §1 — The baselines this attribution is against (both pre-existing, one never measured)

| baseline | file | what it proves |
|---|---|---|
| pre-W356 `npm test` | `%TEMP%\rt-campaign\npm-test-baseline.log` (2026-10-15 **12:32**) | scripts leg only: `# tests 622 · # pass 607 · # fail 15 · # skipped 0` (names below). **The src leg never ran** (leg 1 blocked it) — so no lib-leg red can be called "new" before the W356 boundary |
| W356 boundary gate | `%TEMP%\rt-campaign\w356-boundary-gate.log` (15:01) | `testsScripts {pass:643,fail:7}` · `testsLib {pass:4215,fail:5,skipped:2}`; `hardFails` names **all 12** (7 scripts names + 5 lib tests with their 5 `describe` wrappers) |

W356-boundary failing names (`hardFails`, verbatim): the two `module-coverage` cases; `C:`/`D:`/`G:`/`K:`/`O:` (the gate's own self-tests); codegen `341-1` + `BEFORE (the measured defect)…`; lesson-writers `fixes/144 M5-1 + T-11…` + `the refusal class code survives the 240 budget…`; scaffold `A3-f07 / W-14…` + `binds ≥2 …` and `A2-F5…` + `derives >=2 pages…`; software-export `fixes/347: a below-floor run…` + `emitSoftware`.

## §2 — My own first run of both legs (15:05–15:20, all lanes mid-flight)

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
node --test --test-reporter=tap "scripts/**/*.test.mjs"                     # 650 tests · 643 pass ·  7 fail · 0 skipped
node --experimental-strip-types --test --test-reporter=tap `
  "src/lib/**/*.test.ts" "src/components/**/*.test.ts"                      # 4225 tests · 4209 pass · 6 fail · 10 skipped
```

## §3 — The attribution table (13 items)

`item | file:line | source or test | new or pre-existing | owner`

| # | failing test (TAP name) | file:line (test) | what is wrong | new / pre-existing | owner | disposition |
|---|---|---|---|---|---|---|
| 1 | `module-coverage: a stale allowlist entry (module now reached) fails the guard` | `scripts/check-module-coverage.test.mjs:122` | **source**: 7 stale allowlist entries in `scripts/check-module-coverage.mjs` (modules now reached) | pre-existing (identical at 12:32) | `fix-gates` | reported, file untouched |
| 2 | `module-coverage: the CLI runs green on the live repo and exits 0` | `scripts/check-module-coverage.test.mjs:132` | same cause (`stale[]` non-empty ⇒ exit 1) | pre-existing (12:32) | `fix-gates` | reported, untouched |
| 3 | `C: all gates green → ok:true, exit 0` | `scripts/gate-verdict.test.mjs:221` | **test**: fixture omits gate.sh's `ratchet` stage ⇒ `exitOf("ratchet")` defaults to 1 (missing ⇒ red, fail-closed) ⇒ `nonTestGatesOk` false | **new** (absent at 12:32; arrived with W356's additive `ratchet` stage) | **`fix-tests`** | **CLOSED** |
| 4 | `D: --double run-1/run-2 disagreement → exit 3 …` | `scripts/gate-verdict.test.mjs:247` | same fixture omission | new (12:32 absent) | **`fix-tests`** | **CLOSED** |
| 5 | `G: an allowlisted load-flake GREEN in isolation is quarantined …` | `scripts/gate-verdict.test.mjs:357` | same | new | **`fix-tests`** | **CLOSED** |
| 6 | `K: --double --quarantine relieves an isolated-green allowlisted hard fail …` | `scripts/gate-verdict.test.mjs:415` | same | new | **`fix-tests`** | **CLOSED** |
| 7 | `O: a registered, justified skipped test passes …` | `scripts/gate-verdict.test.mjs:511` | same | new | **`fix-tests`** | **CLOSED** |
| 8 | `BEFORE (the measured defect): with the gate absent the same type-red tree IS sealed` | `src/lib/codegen.server.test.ts:3198` (suite `:3133`) | **test pin drifted by a real source gap**: the fixture documents "a fully-typed kanban module whose ONLY tsc error is the measured class", but a `kind:"tool"` emission now also ships `.tsx` UI page modules (the 353 briefed site) and `tsconfigJson` sets `jsx` for **webapp/game only** ⇒ tsc reds TS17004/TS6142 and the bounded tail no longer contains TS2749 | pre-existing (present at the W356 boundary; never measured before it) | **unclaimed by any W357 lane**; the file was written at **15:18:29** while my legs ran (another lane's in-flight edit) | reported + **residual R-UI-3**; file left alone |
| 9 | `the refusal class code survives the 240 budget even behind P6's long verbatim unmet list` | `src/lib/lesson-writers.test.ts:299` (suite `:254`) | **source**: `engine.ts fitLessonEvidence` split the digest on `" · "`, but the verbatim P6 criterion *contains* that separator ⇒ the criterion stood in for the class clause and the class segment never landed | pre-existing (at the boundary) | **`fix-tests`** (test file unowned; cause in unowned `engine.ts`) | **CLOSED** (§5.3) |
| 10 | `binds ≥2 spec-derived fields + an interaction to a real generated export` | `src/lib/scaffold.test.ts:1771` (suite `A3-f07 / W-14`) | **product decision**: when a spec derives ≥2 pages, the 351/353 site *replaces* `src/ui/console.tsx` (console becomes "mounts the site router"), so the A3-f07/W-14 field-binding property is unreachable for that input class | pre-existing (at the boundary) | **the wave owner** (precedence decision); the fix lands in my files | **residual R-UI-1** (evidence + exact decision in §6) |
| 11 | `derives >=2 pages (a router + page modules) … a derived page reads the real sync getter` | `src/lib/scaffold.test.ts:2762` (suite `A2-F5`) | **source**: the 353 page→export matcher keyed `PAGE_ROLE_SYNONYMS` on page tokens; `opening` existed only as a *synonym value of* `hours`, so the derived "Bakery s opening" page bound nothing although the tree exported a real `getOpenStatus()` | pre-existing (at the boundary) | **`fix-tests`** | **CLOSED** (§5.4) |
| 12 | `emit --run: treeRun{compile,tests,run} … (fixes/147 E-15 / 338-2)` — inner assert at `:3025` (`--require-verified must … exit 5`, got 1) | `src/lib/headless.test.ts:2940` (suite `E-25 …` `:2847`) | **transient**: load-sensitive child leg (the suite ran while the 904 s scripts leg was running). Not reproducible: my hand probe reproduces exit 5 for the identical input, and the suite is **209/209** standalone | **new since the boundary** and **not reproducible** ⇒ flake, not a regression | `fix-tests` | re-verified green; no change |
| 13 | `moves forced foreign files into .rapidtool-quarantine/<stamp>/ …` (EPERM rename) | `src/lib/headless.test.ts:4021` | **transient**: Windows `EPERM` on the atomic rename (`.gitignore.rtws-<pid>-<n>.tmp` → `.gitignore`) under concurrent load; green standalone | new since the boundary; not reproducible | `fix-tests` | re-verified green; no change |

**Totals (13 items).**

- **source-wrong: 4** — items 1 + 2 (one cause: the stale allowlist read by `check-module-coverage.test.mjs`),
  item 9 (`engine.ts` fitter), item 11 (`scaffold.ts` 353 matcher).
- **test-wrong: 5** — items 3–7, one cause (`gate-verdict.test.mjs`'s fixture predates gate.sh's `ratchet`
  stage).
- **mixed (test pin drifted *by* a real source gap, unresolved): 1** — item 8.
- **product decision: 1** — item 10 (precedence; the red is a consequence, not a defect in either file).
- **transient (flake, re-verified green): 2** — items 12, 13.

**Owner split:** `fix-tests` closed **7** items (3/4/5/6/7 + 9 + 11) and re-verified **2** transient ones;
`fix-gates` owns **2** (1, 2 — untouched); item 8 is unclaimed by any W357 lane and has an in-flight editor
(file mtime), so it was **report-and-leave** + residual R-UI-3; item 10 is a residual for the wave owner.
`fix-preview`'s boundary red (`software-export.test.ts` `emitSoftware`) was already fixed by that lane at
**15:07:25** and is green in my run, so it is not attributed to me.

**New vs pre-existing (the honest split).** New since the pre-W356 baseline (12:32): **items 3–7 (5 names)**
— the fixture broke the moment W356 added the `ratchet` stage. Pre-existing at the W356 boundary:
**items 1, 2, 8, 9, 10, 11 (6 names)** — the lib leg had never been measured before the boundary, so "new"
cannot be claimed for any of them. New since the boundary and **not reproducible**: **items 12, 13 (2)**.
So of my first-run 13 reds: **11 pre-existing or sibling-owned, 5 new-but-mine, 2 transient, 0 caused by me**
— and none of the boundary's 5 lib names was caused by this lane.

---

# APPEND 2 — the fixes (old → new)

## §5.1 `scripts/gate-verdict.test.mjs` — the fixture now describes the real stage set (test-wrong)

`gate.sh`'s verdict program computes `gates.ratchet = { ok: exitOf("ratchet") === 0, … }` and
`exitOf()` returns **1 for a MISSING key** (fail-closed, documented in the fixture's own header). W356's
additive `ratchet` stage (`gate.sh:151`) added the `ratchet.exit` row the fixture never wrote, so
`nonTestGatesOk` was false in every synthetic case ⇒ `C` exited 1 instead of 0, `D` 1 instead of 3, etc.

| old | new |
|---|---|
| `GATE_IDS = [typecheck, lint, assertionGaps, prevention, moduleCoverage, testsScripts, testsLib, build]` | `…, build, ratchet]` |
| no ratchet log fixture, 15 spawn args | `RATCHET_GREEN` (a real `quality-ratchet.mjs` last-line shape: `{ok:true,tool:"quality-ratchet",regressions:[],canaryFailures:[],unavailableEnforced:[]}`), `ratchetLog` written per case, passed as the **16th** arg (`… quarantine, ratchetLog`) |
| case C asserted 8 stages | case C additionally asserts `gates.ratchet.ok === true`, `regressions/canaryFailures/unavailableEnforced === []` |

Measured: `node --test --test-reporter=tap scripts/gate-verdict.test.mjs` → **19 tests · 19 pass · 0 fail**
(was 5 fail). No assertion was deleted or loosened — the stage set got *stricter* (the ratchet stage is now
exercised in the all-green simulation).

## §5.2 `src/lib/scaffold.ts` — R-7 (see APPEND 3)

## §5.3 `src/lib/engine.ts` `fitLessonEvidence` — the atomic class clause now survives (source-wrong)

Cause, measured (`probe-lesson.mjs`): the P6 criterion is
`…required brief · keyed synthesis was ATTEMPTED and REFUSED — no generatedTree landed…` — verbatim free
text **containing the ` · ` separator**. `t.split(" · ")` therefore yielded
`[…, "Brief-conformance: required brief", "keyed synthesis was ATTEMPTED…"]`, so the loop met a
"seg" that was really a *criterion fragment*, took the atomic-clause branch, fitted it and `break`ed —
`class: RT_E_LLM_REJECTED` never landed. The function's own doc comment promises the opposite.

| old | new |
|---|---|
| `const segs = t.split(" · ");` … loop over `segs` | clauses located by their **own prefixes**: `t.indexOf(" · class: ")` / `t.indexOf(" · tail: ")`; `head` = unmet part, `classSeg`, `tailSeg` |
| atomic fit inside the loop, then `break` | `keep = max("unmet: ".length, budget - 3 - classSeg.length)` → trim the unmet head only if needed, append the class clause; then the tail takes whatever room remains (`room > 0`) |

Measured before → after (same input, `probe-lesson.mjs`):
`detail len 310 · unmet slice 240 · has class: false` → `has class: true`, detail ends
`… (single-module, or the u · class: RT_E_LLM_REJECTED`; the unmet slice is **exactly 240**.
`node --experimental-strip-types --test --reporter=tap src/lib/lesson-writers.test.ts` → **25/25** (was 24/25).
The short-unmet sibling case (which pins the digest **verbatim**, no fitting needed) is unchanged: when
`t.length <= budget` the function returns `t` byte-identically.

## §5.4 `src/lib/scaffold.ts` — the 353 page→export matcher (source-wrong, item 11)

`PAGE_ROLE_SYNONYMS` is keyed on **page** tokens and its values are matched as substrings of the export
name. `hours` was a key, but `opening` — the token the derived page id actually carries
(`bakery_s_opening`, from the requirement "See the bakery's opening hours") — existed only as a *value*, so
`pageMatchesExport("bakery_s_opening", "getOpenStatus")` was false and the page rendered the
"not published" state while the tree exported a real sync getter.

| old | new |
|---|---|
| `hours: ["hours", "opening", "schedule", "open", "status", "availability"],` | same line **plus** `opening: ["hours", "opening", "open", "schedule", "status", "availability"],` (one more role key; `PAGE_ROLE_SYNONYMS` has exactly ONE consumer, `pageMatchesExport`, in the 353 path) |

Measured: `src/lib/scaffold.test.ts` **131/133 → 132/133**; the A2-F5 case (`:2762`) is green and its
`src/ui/site-data.ts` now carries `generated.getOpenStatus()`. No test was edited.

---

# APPEND 3 — R-7: the surviving reachable `assert.fail` (removed, with a reachable trigger)

**Was it reachable? Yes — measured, not argued.** `oracleRowKind` classifies on
`treeJobModules`/`wiredJobLabels`, while the emitted spec's import maps are built from a **different**
derivation: `treeJobImport` requires an importable tree ENTRY (`treeEntryOk`), `wiredJobImport` drops every
non-`.ts` path. The two can disagree:

* `treeAccepted` is **sorted by path** (`scaffold.ts:8821`) and `treeEntryPath` falls back to
  `treeAccepted[0]` — so a tree whose alphabetically-first file is a `.tsx` module has
  `treeEntryOk === false` while a `.ts` job module **is** covered by the tree.
* Reproduced (`probe-r7.mjs`, %TEMP% only): `generatedTree = [src/generated/aaa.tsx, src/jobs/reroute.ts]`
  ⇒ `orc-2` (job `reroute`) is classified `tree-job`, `treeJobImport` is **empty**, and the pre-357 bytes
  emitted `assert.fail("orc-2 is NOT IMPLEMENTED — replace this skip with …")` as a **reachable** test ⇒
  `npm test` exit 1 ⇒ `treeRun.ok:false` ⇒ `emit --git` withheld — for one map drift, exactly the
  mechanism W356 removed everywhere else.

**The fix (cause, not symptom).** One predicate now decides the skip, and both the row body and the README
census use it:

```ts
// new (scaffold.ts) — the row body AND censusOracleRows() call this
function oracleRowUnwired(row, surface): boolean {
  const kind = oracleRowKind(row, surface);
  if (kind === "not-implemented") return true;
  if (kind === "endpoint-stub") return !surface.endpoints.some((e) => e.job === row.job);
  if (kind === "tree-job") return !surface.importableTreeJobs.has(String(row.job));
  if (kind === "live-job") return !surface.importableWiredJobs.has(String(row.job));
  return false;
}
```
`OracleRowSurface` gained `importableTreeJobs` / `importableWiredJobs`, built by a new
`importableOracleJobLabels(treeJobModules, wiredJobModules, treeEntryOk)` from the **same** lists the import
maps use (the `.ts` filter + the importable-entry rule), and **required** (never defaulted — an absent value
would silently turn WIRED rows into skips). `skipRow` is now `oracleRowUnwired(row, surface)`; the two
defensive `else` branches push **comments only** (a skipped body must carry no assert: `maskSkippedTests`
masks only the `test.skip(...)` method form, so a non-executed assert would read as behavioural evidence).

**WIRED rows are untouched.** For every wired row the two old clauses and the new predicate agree
(`not-implemented` → skip; `endpoint-stub` with an endpoint → assert; `tree-job` with an importable module →
assert; `live-job` with an importable module → assert); `scaffold.test.ts`'s pins
("every unwired row must be a MARKED skip", "no reachable `assert.fail`", the exact wired-row assertions,
the census/header totals) all stay green: **133 tests, same 2 pre-existing UI reds as the pin** — the only
change is that one residual class of red is gone.

**Measured after the fix** (`probe-r7.mjs` / `probe-vacuous.mjs`, drift tree written to `%TEMP%`):

| reading | value |
|---|---|
| `assert.fail(` in the emitted `tests/oracle.spec.ts` | **false** |
| header | `// ORACLE SHORTFALL: 2 of 6 pinned A7 row(s) are` (orc-phase + the drifted orc-2) |
| row head | `test("orc-2", { skip: "NOT IMPLEMENTED - …" }, () => {` |
| the tree's OWN spec run | **exit 0** · `# tests 10 · # pass 8 · # fail 0 · # skipped 2` |
| `compile-check.treeRun(dir)` | **`ok:true`**, spec leg `run:"pass"`, `{pass:8,fail:0,skipped:2}`, `behavioural:true` |

Under the old bytes the same tree was `ok:false` (the row's reachable `assert.fail`). The census and the
spec body are now decided by **one** predicate, so the count on the header/README can no longer disagree
with the row the spec emits. No assertion for any wired row changed (byte-verified by the suite's pins).

**What `assert.fail(` remains in `scaffold.ts`, and why neither is R-7's class** (grep after the fix —
2 hits):

| site | emission | why it is not reachable-reddening |
|---|---|---|
| `:6308-6310` | the **no-A7-rows** spec (`test.skip("no-oracle: …", () => { assert.fail(…) })`) | the **method** form: node:test never executes the body and `compile-check`'s `maskSkippedTests` **does** mask `test.skip(…)`, so it can neither red a tree nor read as behavioural evidence. (The 354 defect was the **options** form, `test(id, { skip: … }, () => { assert.fail })` — unmasked — which is exactly why the R-7 rows carry comments and no assert.) |
| `:6652` | a brief **fixture whose source does not compile** (`compiled.ok === false`) | a deliberate, unconditional red: an un-executable fixture is a defect in the emission itself, not an unwired row; the row's own test pins it. Left as is — R-7 scoped the unwired-row mechanism only. |

---

# APPEND 4 — the `RT_E_SPEC_SKIP_VACUOUS` boundary: PROVEN still reddenable, named as a residual

The gate is **not** in `scaffold.ts`; it lives in the tree-run leg —
`src/lib/compile-check.server.ts:1592-1606`:
`const skipDominated = summary !== null && skipped > 0 && summary.pass <= skipped;` → `run:"fail"`,
`code:"RT_E_SPEC_SKIP_VACUOUS"`, detail `skip-dominated spec: N live case(s) ≤ M skipped — a skip is not a
pass` (`scaffold.ts` only *names* it in the emitted DEPLOY.md text at `:8284`).

**Answer: YES — a "green while reporting its shortfall" emission can still be reddened by it**, whenever
`# pass <= # skipped` on the spec file's own TAP run. Triggering input (constructed + measured,
`probe-vacuous2.mjs`, %TEMP% only):

```
project: seedProject() with specGraph = {nodes:[ui], order:["ui"]} (no api/store/domain node),
         contracts.endpoints = [], generatedSource = "",
         oracle = 6 rows (job dispatch/reroute/scan/archive/notify/settle)  → all six UNWIRED
scaffoldProject(project, { underProduced: "partial" })
   header: // ORACLE SHORTFALL: 6 of 6 pinned A7 row(s) are
   README: ACCEPTANCE SHORTFALL — 6 of 6 … named: `orc-1` … `orc-6`   (surfaced, counted, never silent)
   the tree's OWN spec run: exit 0 · # tests 6 · # pass 0 · # fail 0 · # skipped 6     ← green, reporting
   compile-check.treeRun(dir): ok:false · code:"RT_E_SPEC_SKIP_VACUOUS"
     detail "skip-dominated spec: 0 live case(s) ≤ 6 skipped — a skip is not a pass"
```

The 2-of-6 drift tree above is the other side of the same boundary: `pass 8 > skipped 2` ⇒ `ok:true`.
So the boundary is real and the deciding quantity is the **ratio inside the emitted spec file**, not the
shortfall count. This is **recorded as residual R-SKIP-VACUOUS, not "fixed"**: the guard is the deliberate,
registered C1-05/R2-05 vacuity refusal (`src/lib/errors.ts`: `RT_E_SPEC_SKIP_VACUOUS`), it is **not owned by
any W357 lane**, and the two candidate answers are mutually exclusive:

1. *A counted shortfall may be delivered green* ⇒ the guard must not fire on a spec whose skips are all
   **marked, counted** shortfall rows (i.e. exempt/absorb them) — that weakens the vacuity refusal and needs
   a new registered distinction between "skip with a counted reason" and "skip with none";
2. *A skip-dominated spec is always vacuous* ⇒ the current bytes are correct and an emission whose unwired
   rows outnumber its live assertions is **refused by the tree-run leg by design** — it must be delivered
   via `RT_E_PLAN_UNDERPRODUCED` (the below-floor seal) with the tree kept on disk, and the docs at
   `scaffold.ts:8284` should say the tree is refused rather than "green while reporting".

(I did not touch `compile-check.server.ts` — not my file, and this is a product decision about what
"vacuous" means.)

---

# APPEND 5 — residuals, each with its owner

| id | residual | evidence | owner / decision needed |
|---|---|---|---|
| **R-UI-1** | `scaffold.test.ts:1771` `A3-f07 / W-14 — default emitted-UI generator` is RED: when a spec derives ≥2 pages, `briefedSiteFiles` (353) **replaces the ui node's own file**, so `emitUi`/`defaultUiGeneration` never runs and the emitted `src/ui/console.tsx` is `Console — mounts the site router` (probe: no `name="customerId"`). The property W-14 pins (≥2 spec-derived `<input name=…>` bound to a real generated export) is unreachable for that input class. | selection: `scaffold.ts:9035-9047` (`briefedSite`, precedence `web-marketing 351 → briefed 353 → shell`); the ui node is replaced at `:9281-9283` and `:9365-9368`; the derived page set comes from `specPageTitles`/`briefedPageDefs` (`:4418-4449`). The conflicting sibling pin is `scaffold.test.ts:2762` (A2-F5), which is GREEN after §5.4 — the wave's two requirements disagree on this exact input class, byte-for-byte one emission. | **the wave owner (product decision).** *Should a project with an `implementationSpec` but no labelled `Pages:` list emit the multi-page briefed site INSTEAD of the A3-f07 field-binding shell?* (a) keep the precedence and re-pin A3-f07's fixture to a single-page brief — W-14's evidence narrows to non-site emissions; (b) keep `src/ui/console.tsx` as the operator surface (fields + interaction) and mount the router beside it (`src/main.tsx`/`App.tsx`) — the only option satisfying BOTH pins with no test weakened; (c) fold the spec-field binding into the site's own shell. This lane can implement any of them inside its own two files once chosen; it will not decide precedence unilaterally. |
| **R-UI-2** (folded into R-UI-1) | the same precedence decision governs the emitted `.tsx` page set for non-web kinds — see R-UI-3 | `probe-vacuous.mjs` / the codegen detail below | the wave owner |
| **R-UI-3** | `codegen.server.test.ts:3198` `BEFORE (the measured defect)…` is RED: a `kind:"tool"` emission ships `.tsx` UI page modules (353) while the emitted tree's `tsconfig.json` sets `jsx` for **webapp (`react-jsx`) and game (`preserve`) only** — so the tree's own declared `tsc --noEmit` reds TS17004 (`Cannot use JSX unless the '--jsx' flag is provided`) / TS6142, and the bounded typecheck tail no longer contains the pinned `TS2749|TextDecoder`. The test's premise ("whose ONLY tsc error is the measured class") is now false; the tree IS still type-red. | actual detail (this run): 10 `src/ui/pages/*.tsx` errors, all TS17004/TS6142; source: `scaffold.ts:984-1013` `tsconfigJson(kind, hasTests)` (`jsx` only for webapp/game) + `briefedSiteFiles` firing for `kind:"tool"`; the sibling tests in the same suite still match `/TS2749|TextDecoder/` because they read a different slice of the same detail. File mtime **15:18:29** while my legs ran → another lane is editing it, so **it was left alone**. | **unclaimed by any W357 lane** (report + leave alone). Decision needed: *may a `tool`/`cli-tool`/`library` emission ship a React `.tsx` site at all?* If yes, those kinds must carry a `jsx` setting **and** the React runtime their pages import (the W52/338-5 rule, extended; note `preserve` alone does not admit REAL JSX — React 19 types carry no global `JSX` namespace, the C1-03 finding) — a deps/tsconfig product change; if no, `briefedSiteFiles` must be scoped to kinds with a runtime, which moves A2-F5's reach. Either way the fixture's premise/pin must be re-derived. |
| **R-SKIP-VACUOUS** | see APPEND 4 | constructed + measured input above | `compile-check.server.ts` (`src/lib/compile-check.server.ts:1592-1606`) — **no W357 lane owns it**; the decision is the wave owner's (guard is deliberate and registered) |
| **R-FLAKE** | `headless.test.ts` E-25 (`:3025`) + R11-f08 (`:4021`) red only under concurrent load (the 904 s scripts leg). Both re-verified GREEN in isolation; my hand probe reproduces `tree-run --require-verified` → exit 5 for the identical input, and the suite is now **209/209**. Not a regression, nothing changed. | my first full lib leg (15:05-15:20) vs `headless-after.txt` (209/209) | `fix-tests` — recorded, no action; the load-sensitive class AGENTS.md already names |
| **R-BOUNDARY-DOC** | `fixes/356_0_boundary.md` §3.1 item 5 said the 12 failures were "not yet attributed" — now attributed (APPEND 1 §3); and `software-export.test.ts` `emitSoftware`, the boundary's 5th lib red, was already fixed by `fix-preview` (15:07:25) and is green here. | this log | nobody — recorded for the register |

---

# APPEND 5b — final re-derivation (after every edit of mine, nothing running)

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
npx tsc --noEmit
#   exit 0 (no `error TS` lines) — after the scaffold.ts + engine.ts edits

node --experimental-strip-types --test --test-reporter=tap src/lib/scaffold.test.ts src/lib/wild-step.test.ts
#   # tests 177 · # pass 176 · # fail 1 · # skipped 0
#   not ok 20 - A3-f07 / W-14 — default emitted-UI generator  (the ONE residual, R-UI-1)
#   wild-step: 44/44  (the cartographer's "test 11" red is gone — it was already fixed by `restore-tests`
#                      in W356; re-measured green here)

node --experimental-strip-types --test --test-reporter=tap src/lib/headless.test.ts
#   # tests 209 · # pass 209 · # fail 0   (the E-25 + R11-f08 reds do not reproduce: load-only flakes)

node --test --test-reporter=tap scripts/gate-verdict.test.mjs
#   # tests 19 · # pass 19 · # fail 0     (was 12 pass / 5 fail in this file)

node --experimental-strip-types --test --test-reporter=tap `
  src/lib/knowledge.test.ts src/lib/dod.test.ts src/lib/engine.test.ts src/lib/acceptance.test.ts src/lib/packet.test.ts
#   # tests 351 · # pass 351 · # fail 0   (the engine.ts fit fix touches every digest consumer)

node --experimental-strip-types --test --test-reporter=tap src/lib/lesson-writers.test.ts
#   # tests 25 · # pass 25 · # fail 0     (was 24/25)
```

**Leg totals, stated honestly:** I did **not** re-run a whole leg at the end (five lanes were mid-edit, and
the two flakes above are exactly the artefact that produces). Per-suite deltas from my changes:

| suite | before (this lane's first run) | after |
|---|---|---|
| `scripts/gate-verdict.test.mjs` | 14 pass / 5 fail (of the 7 scripts reds, 5 are here) | **19/19** |
| `src/lib/scaffold.test.ts` | 131 pass / 2 fail | **132 pass / 1 fail** (the residual) |
| `src/lib/wild-step.test.ts` | 44/44 (green before my edits) | 44/44 |
| `src/lib/lesson-writers.test.ts` | 24 pass / 1 fail | **25/25** |
| `src/lib/headless.test.ts` | 208/209 under load, 209/209 isolated | **209/209** |
| `src/lib/codegen.server.test.ts` | 324/325 (item 8, not mine) | 324/325 (untouched) |

**The scripts leg's remaining 2 reds are `fix-gates`'** (module-coverage: items 1/2) and the boundary's
`testsScripts.fail` can therefore only fall to **2** from my side of the work.

---

# APPEND 6 — what I did not verify / limits

- **`bash scripts/gate.sh` and `npm run build` were not run** (the boundary owns the first; the second
  belongs to `fix-build` and writes `dist/`). No keyed LLM call was made; every probe is keyless and writes
  to `%TEMP%\rt-w357\` (`probe-ui.mjs`, `probe-r7.mjs`, `probe-e25.mjs`, `probe-vacuous.mjs`,
  `probe-vacuous2.mjs`, `probe-lesson.mjs`) or to `%TEMP%\rt-p6-typecheck-*` created by the product code.
- **The `npm test`-level verdicts in APPEND 2 are per-suite**, not a whole-leg re-run: a whole-leg re-run
  under five concurrent lanes is not a frozen-tree measurement (the two flakes above are the proof). The
  legs' *before* numbers are in §2; the affected suites' *after* numbers are beside each fix.
- **R-7's old-bytes behaviour is established by the branch condition, not by re-running the old file** (the
  pre-edit bytes are uncommitted and unrecoverable without a git write): the drift tree's spec imports **no**
  job module, so `wiredJobImport.get("reroute")` is `undefined` and the `else` branch that held the
  `assert.fail` was the only alternative. The *new* bytes are measured directly.
- **Byte-identity of every other emission is argued from the predicate equivalence + the suite's pins**
  (133 tests, same 2 pre-existing reds, all oracle-row/census/below-floor cases green), not from a corpus
  diff: the pre-edit bytes of `scaffold.ts` are not in git.
- `engine.ts` was written by another lane at **15:08:40** (I would guess `fix-lint`'s source lint pass) and
  I edited one function in it at ~15:36 for item 9. `npx tsc --noEmit` is **exit 0** after every edit, but a
  concurrent rewrite of that file could have dropped my hunk — re-check `fitLessonEvidence` before the
  boundary run.
- The `scaffold.ts` line numbers I cite are the **current** bytes (my edits shifted them; the wave plan's
  `:6323/:6396/:8284/:8915-8952` are the pre-W357 numbers).
