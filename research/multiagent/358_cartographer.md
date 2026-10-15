# 358 — cartographer: the three closure lanes verified, the W358 regression map, and the FINAL W359 kind-fidelity plan

**Lane:** W358 `cartographer` (the standing architecture + verification lane). **Wave:** W358 (the final
closure wave). **Author:** this lane — this file is the only file it writes.
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (path contains a space). **Host:** Node **v24.15.0**,
Windows PowerShell 5.1.

**Pinned revision:** HEAD **`7c7f9115fa7f1d09d249e3fd90de53e6005862b5`** ("docs(audit): W355 audit wave …"),
**dirty tree, 149 porcelain lines** — HEAD moved since W357 (`30bce78b`); the W356/W357/W358 work is all
uncommitted, so every number below describes **the bytes on disk**. **Verification window: 16:00–16:33,
2026-10-15; the tree settled at 16:26:27** (nothing moved in the last seven minutes). The wave's dispatch
is **15:59–16:00** (`wave_plans/W358/*.md` mtimes 15:59:55–16:00:10); `fixes/358_*.md` did **not** exist at
16:00, so §0 pins the baseline before any lane landed and every verdict carries the mtime of the bytes it
judged. **Where a lane's log and the bytes disagree, the bytes win and it is recorded as a correction
(§4).** Each lane log was opened **only after** its lane's bytes had been judged; where a log confirmed my
measurements I say so, and **no correction was needed against any of the three lanes**.

**Constraints honoured:** no product/doc/script/register/other-lane file edited (my only write is this
file); no `bash scripts/gate.sh`; no keyed LLM call; no git write. Probe files live in `%TEMP%`
(`rt358_kind_table.mjs`, `rt358_ui_probe2.mjs`, `rt358_budget.mjs`, `rt358_uncovered_plant.mjs`,
`rt358_lint_plant.mjs`). My W357 probes (`rt357_kind.mjs`, `rt357_tokens.mjs`, `rt357_preview_probe.mjs`)
were re-run against the current bytes.

---

## 0. The moving tree — what I pinned, and when

Baseline captured **16:00–16:03**, before any lane had written. All of these are the wave's INPUTS:

| Baseline measurement (16:00–16:03, pre-edit) | Reading |
|---|---|
| `node --test scripts/cli-exit-taxonomy.test.mjs` | **exit 1** — `ok 1 - every errCode(err, <code>) site exits its documented class`; **`not ok 2 - EXIT_BY_CODE is exactly the README error table (both directions)`**; `ok 5 - README-cli.md keeps the documented Exit-4 sentence`. R-9 reproduced. |
| `node --experimental-strip-types --test --test-name-pattern "pre-seal self-typecheck" src/lib/codegen.server.test.ts` | **exit 1** — `# tests 9 · pass 8 · fail 1`; the red is `not ok 1 - BEFORE (the measured defect)…` asserting `/TS2749\|TextDecoder/`, actual detail = **10 × TS17004 / TS6142 in `src/ui/pages/*.tsx`** under a `kind:"tool"` tsconfig with no `jsx`. |
| `node --experimental-strip-types --test src/lib/scaffold.test.ts` | **exit 1** — `# tests 133 · pass 132 · fail 1`; reds = `not ok 1 - binds ≥2 spec-derived fields + an interaction to a real generated export` and `not ok 20 - A3-f07 / W-14`. |
| `node scripts/quality-ratchet.mjs --all` | `ok:true` · 0 regressions · 0 canary failures; `kindFit.game` reads `{units 1, fit 0, entryOk 1, scriptskOk 1, demandedMatch 1}` and **no `surfaceOk` metric exists** for game or library (only `kindFit.app.surfaceOk` exists) — R-11 reproduced. |
| `lint.problems` in `floors.json` | `atMost 0`, `status: pending-first-green`, **`reading: 947`** — the stale reading the plan (item 4) asks to re-pin; the W357 boundary measured `problems: 5`. |
| `RATCHET_METRIC_UNAVAILABLE` in `src/lib/errors.ts` | **0 hits** (`Select-String -Path src\lib\errors.ts -Pattern 'RATCHET_METRIC_UNAVAILABLE'` → count **0**); the name exists only in `scripts/quality-ratchet.mjs:763,1693` and `scripts/quality-ratchet.test.mjs:365,367,370`. |
| Whole-file sizes (bytes) | `cli-exit-taxonomy.test.mjs` 201,753 · `README-cli.md` 121,199 · `rapidtool-cli.mjs` 323,132 · `errors.ts` 45,022 · `codegen.server.ts` 485,241 · `compile-check.server.ts` 139,433 · `scaffold.ts` 461,246 · `scaffold.test.ts` 179,561 · `software-preview.tsx` 17,109 · `quality-ratchet.floors.json` 36,484. |

Landings observed inside the window. **My verification window closes at 16:33; the tree settled at 16:26:27**
(nothing moved in the last seven minutes of it). §1 carries each verdict's own mtime.

| File (lane) | pre-wave mtime | landed mtime | bytes |
|---|---|---|---|
| `src/lib/scaffold.ts` (`close-ui`) | 15:33:22 | **16:05:41** | 461,246 → **466,968** |
| `src/components/software-preview.tsx` (`close-ui`) | 10-06 11:09:39 | **16:05:55** | 17,109 → **17,154** |
| `src/lib/scaffold.test.ts` (`close-ui`) | 14:30:16 | **16:10:07** | 179,561 → **188,109** |
| `src/lib/compile-check.server.test.ts` (`close-kindjsx`) | 14:14:34 | **16:11:04** | 139,213 → **140,688** |
| `src/lib/headless.test.ts` (`close-kindjsx`, disclosed cross-file fixture) | 14:20:43 | **16:11:28** | 311,517 |
| `src/lib/compile-check.server.ts` (`close-kindjsx`) | 14:13:32 | **16:15:44** | 139,433 → **140,134** |
| `src/lib/errors.ts` (`close-taxonomy`) | 10-06 01:33:41 | **16:16:49** | 45,022 → **45,838** |
| `scripts/README-cli.md` (`close-taxonomy`) | 15:15:40 | **16:17:01** | 121,199 → **122,520** |
| `scripts/cli-exit-taxonomy.test.mjs` (`close-taxonomy`) | 14:15:49 | **16:17:35 → 16:26:27** | 201,753 → **210,567** |
| `scripts/quality-ratchet.floors.json` (`close-taxonomy`) | 15:20:31 | **16:23:13** | 36,484 → **41,003** |
| `scripts/quality-ratchet.mjs` (`close-taxonomy`) | 15:21:43 | **16:23:33** | 103,291 → **105,727** |
| `scripts/quality-ratchet.test.mjs` (`close-taxonomy`) | 15:26:50 | **16:24:20** | 33,512 → **38,202** |
| `scripts/rapidtool-cli.mjs` (`close-taxonomy`) | 14:13:50 | **never touched** | 323,132 |
| `src/lib/codegen.server.ts` / `.test.ts` (`close-kindjsx`) | 10-06 11:26:19 / 15:18:29 | **never touched** | 485,241 / 424,049 |

`fixes/358_close_ui.md` (16:14:32) and `fixes/358_close_kindjsx.md` (16:23:23) landed inside the window;
**`fixes/358_close_taxonomy.md` did not exist at my 16:33:19 poll — it landed at 16:33:25**, i.e. *after*
every §1.1 verdict had been measured. That is the ordering I want (§1.1's last row): each log was read only
once its lane's bytes had been judged, so no verdict leans on a log, and every number a log states was
independently re-run before the log was opened.

---

## 1. JOB 1 — adversarial verification of the three W358 lanes

Discipline: **a lane's log is never evidence for that lane's claim**, and a lane plan is not a claim
either. Every verdict below cites the command I ran against the bytes, using the wave's own plans
(`wave_plans/W358/*.md`) as the statement of what each lane undertook.

### 1.1 `close-taxonomy` — **CONFIRMED** (the parity is now *derived from the doc*, both directions, with a third leg that closes R-9's cause; the owed code landed in both registries and the debt record is verified against them; the two `kindFit` pins exist and fail closed; the lint floor is honestly re-pinned) — with one caveat about the **plan's own bar**, not about the lane

Landed revision: `src/lib/errors.ts` **16:16:49** (+816 B), `scripts/README-cli.md` **16:17:01** (+1,321 B),
`scripts/cli-exit-taxonomy.test.mjs` **16:17:35 → 16:26:27**, `scripts/quality-ratchet.floors.json`
**16:23:13** (+4,519 B), `scripts/quality-ratchet.mjs` **16:23:33**, `scripts/quality-ratchet.test.mjs`
**16:24:20**. `scripts/rapidtool-cli.mjs` was **never touched** (mtime 14:13:50) — no invented exit code
was needed, which is the honest outcome.

**The contract it chose, judged.** It is the honest one, and it is *derived* rather than written twice:

| Claim (plan §1) | Verdict | The command / read that decided it |
|---|---|---|
| The parity test passes **without** an invented exit code and **without** deleting README rows | **CONFIRMED** | `node --test --test-reporter=tap scripts/cli-exit-taxonomy.test.mjs` → **`# tests 62 · # pass 62 · # fail 0`**, with `ok 2 - exit taxonomy — EXIT_BY_CODE is exactly the README error table (both directions)` and `ok 5 - README-cli.md keeps the documented Exit-4 sentence`. The README table still holds **56 + 1 = 57** rows (the W357 count `(Select-String -Path scripts\README-cli.md -Pattern '^\| \`RT_E_[A-Z0-9_]+\` \|').Count` was 56; it is now 57 — one row **added** for the new code, none deleted). Baseline was `not ok 2` / `# fail 1`. |
| A code with **no CLI arm** must not assert an exit code — the contract is honest | **CONFIRMED, and stronger than the plan asked** | `EXIT_BY_CODE` (`cli-exit-taxonomy.test.mjs:135-206`) is a hand-written constant; `readmeTableRows()` (`:219`) parses each row's **last cell**; `exitClassOfCell` (`:241`) derives the class from that cell (`1`→`1`, `1–4`→`[1,2,3,4]`, `1 or 4`→`[1,4]`, a leading `–`/`-`→**`null`**, anything else→`undefined`); `documentedExitByCode()` (`:257`) is the derived map. The test then asserts (a) code-name parity both ways (`:369-379`), (b) **an unreadable cell is declared, not tolerated** (`:382-390`), and (c) `EXIT_BY_CODE` deep-equals the *derived* class with a named drift message (`:392-404`). A number creeping into a `-` cell, or a `null` appearing where the doc asserts an exit, fails **in both directions**. My independent check of the split: the **17** `-` rows map to `null` and the **4** exit-documented rows (`PATH_KIND_MISMATCH` `[1,2,3,4]`, `PLAN_UNDERPRODUCED` `1`, `SRC_EDITED_DURING_RUN` `1`, `SUBSTANCE_EMPTY` `1`) map to exactly the README's own words (`:180-183`) — the split I derived independently in §1.1 of my first pass, matched cell for cell. |
| …and R-9's **cause** is closed, not only its symptom | **CONFIRMED — this is the best part of the lane's work** | A third leg (`:405-422`) pins the README table to `ERROR_CODE_DOC` **both ways** by parsing `src/lib/errors.ts`'s `ERROR_CODE_DOC` block (`:409-412`). That is the defect that produced R-9 in the first place (a 35-row table against a 56-code registry), so the same class cannot recur silently. Query: `Select-String -Path scripts\cli-exit-taxonomy.test.mjs -Pattern 'ERROR_CODE_DOC'` → `:409-421`. |
| `RT_E_RATCHET_METRIC_UNAVAILABLE` is registered in **both** `ERROR_CODES` and `ERROR_CODE_DOC` | **CONFIRMED** | `src/lib/errors.ts:42` `"RT_E_RATCHET_METRIC_UNAVAILABLE",` inside `ERROR_CODES` (array at `:22`), and `src/lib/errors.ts:573` `RT_E_RATCHET_METRIC_UNAVAILABLE: { meaning: "A pinned quality-ratchet floor could not be measured …", agentAction: … }` inside `ERROR_CODE_DOC` (`:478`). Code count **56 → 57** (`(Select-String -Path src\lib\errors.ts -Pattern '^  "RT_E_[A-Z0-9_]+",?$').Count` → **57**); baseline `Select-String -Path src\lib\errors.ts -Pattern 'RATCHET_METRIC_UNAVAILABLE'` was **0 hits**, it is now **2**. |
| …and the owed-code canaries still behave | **CONFIRMED, and the stale message was **fixed** (I caught it stale at 16:17)** | `node scripts/quality-ratchet.mjs --all` → `canary.errorCodes.registered ok:true` (`codes: 57`, the new code in `registered[]`) and `canary.errorCodes.owed-code-not-emitted ok:true` with the **reconciled** text *"owed, PAID (verified in ERROR_CODES) and not emitted by this ratchet: RT_E_RATCHET_METRIC_UNAVAILABLE"* and `evidence {owed:[…], unpaid:[], paidButUnregistered:[], registered:57}`. **At 16:17, before the reconciliation, that same canary passed while its reason still read** *"owed and NOT yet emitted … src/lib/errors.ts is unowned this wave"* **and `paid: []`** — i.e. a green canary explaining a debt that had already been paid. `floors.json#owedCodes` now carries `status:"registered"`, `registeredAt`, `registeredBy` and a `why` that says the debt is paid **and records the honest residual** (the ratchet still classifies by cause through the three existing codes, so the new code has **no emitter site yet**). That residual is the truthful statement, not a dodge: a code with no emitter is exactly what the register's own `no CLI arm` class in the README now says. |
| The two new `kindFit` pins fail at **floor−1** when planted | **CONFIRMED literally — and the caveat belongs to the PLAN, not to the lane** | Pins: `floors.json` `kindFit.game.surfaceOk` / `kindFit.library.surfaceOk` = `{atLeast, floor 0, status "enforced", reading 0, readingPinned true, nonRegressible: "…"}`. `node scripts/quality-ratchet.mjs --all` → both exist and read `result: ok` at 0; `canary.floors.atleast-zero-pins-are-accounted` → `ok:true` with `zeroPins` now `[…kindFit.game.surfaceOk, kindFit.library.surfaceOk]` and **`unaccounted: []`** — the `nonRegressible` accounting is what the floors file itself demands (`quality-ratchet.mjs:806`). The plant the plan asked for was run and reported verbatim in the lane's log (`%TEMP%\rt358_plants.mjs`): `planted=-1 -> ok=false regressions=["kindFit.game.surfaceOk (atLeast floor 0, measured -1)"]`, and `compareFloor("atLeast", 0, -1)` → `regressed` in my own re-run — so the request is satisfied **as stated**. **The caveat:** `kindFit.*.surfaceOk` is `rowsOfKind.filter(…).length` (`quality-ratchet.mjs:363`), whose structural minimum is 0, so **`−1` is not a producible reading** and that plant proves the evaluator's arithmetic rather than a catchable regression. **My own plant covers the half with real teeth** — feed the uncovered-kind shape (`quality-ratchet.mjs:1392-1396`) for `game` and **all six `kindFit.game.*` metrics read `status=enforced · result=unavailable · code=RT_E_PROJECT_MISSING · failClosed=true`**, so `unavailableEnforced` is non-empty and the run goes red (`%TEMP%\rt358_uncovered_plant.mjs`). The lane discloses the same caveat in two places (its §7.2, and the pin's `nonRegressible` text: *"a decrease cannot move a count already at 0 of 1"*), so **this is a weak bar in `wave_plans/W358/close-taxonomy.md`, not an honest-lane defect** — the honest phrasing of that done-when is *"each pin fails CLOSED when its producer stops producing, and must be re-pinned at the honest bar of 1 once a properly-stamped unit exists"*. |
| The `lint.problems` floor is re-pinned honestly with the bar still at 0 | **CONFIRMED** | `floors.json:134-144`: `direction atMost`, **`floor: 0` (unchanged)**, `status: "pending-first-green"` (unchanged), **`reading: 5`** (was 947), `producer` reworded, and a `reason` that derives the move (`947 → 5`; the 5 being 2 `no-unused-vars` in `scripts/quality-ratchet.mjs` + 3 in `scripts/quality-ratchet.test.mjs` — the lane's *own* files, which is honest self-attribution). **My own plant** (`%TEMP%\rt358_lint_plant.mjs`): reading `5` → `result: "pending"` (never `ok`) and `comparison: "regressed"`; reading `0` → `comparison: "ok"`; reading `947` → `regressed`. `compareFloor("atMost", 0, 5)` → `"regressed"`, `("atMost", 0, 0)` → `"ok"`. So **the metric can never read as a pass** while problems > 0 — exactly as the plan required, and the lane states the same distinction in its §4 and §7.3 rather than papering over it: because the status is `pending-first-green`, the reading of 5 does **not** enter `regressions`, so `--all` still answers **`ok:true`** while the metric is below its bar. |
| The lane's suite | **CONFIRMED** | `node --test --test-reporter=tap scripts/quality-ratchet.test.mjs` → **`# tests 36 · # pass 36 · # fail 0`** (was 34 at the W357 pin). |
| `node scripts/quality-ratchet.mjs --all` / `--selftest` | **CONFIRMED green at the new pins** | My re-runs on the settled bytes: `--all` → `ok:true` · **50 metrics** (was 48) · 22 canaries · `regressions: []` · `canaryFailures: []` · `unavailableEnforced: []`; `--selftest` → `selftestOk:true` · **32 teeth** (was 31) · **37/37 enforced floors beaten** (was 35/35) · `teethCoverage "37/37"`, with the new tooth `canary.errorCodes.registered-debt-is-verified ok:true`. |
| The lane's other claimed readings | **CONFIRMED, all re-run by me** | `EXIT_BY_CODE` keys = **57** (was 35); `src/lib/errors.test.ts` → **44 pass / 0 fail**; `scripts/README-cli.test.mjs` → **12 pass / 0 fail**; `scripts/typecheck-scripts.test.mjs` → **7 pass / 0 fail**. |
| The log matches the bytes (no correction needed for this lane) | **CONFIRMED** | I read `fixes/358_close_taxonomy.md` (landed **16:33:25**) only **after** every verdict above was measured, and it states the same contract (`exitClassOfCell` / `documentedExitByCode` / the `ERROR_CODE_DOC` third leg), the same split (4 exit-documented, 17 `null` + the new code), and discloses both caveats I had flagged independently. Its one attribution I could not reproduce is its baseline `59 pass / 3 fail` (§6, two `RT_E_SRC_EDITED_DURING_RUN` refusals naming `src/lib/compile-check.server.ts` while `close-kindjsx` was editing it): **my own baseline at 16:00 read `62 tests / 61 pass / 1 fail` with only `not ok 2`** — the real red — because no lane had edited `src/**` yet. So the *class* (the in-run RUNLOCK guard correctly refusing under a concurrent writer, the same class W357 recorded for `factory-watch.test.mjs`) is real, but **I verify the class, not those two specific reds**. |

### 1.2 `close-kindjsx` — **PARTLY** (R-8's type-level half **CONFIRMED landed with an independent prover**; the class's fix is **correctly diagnosed, chosen and measured but NOT landed** — the lane says so itself — because the builder lives in the file it was forbidden to edit; and exactly one file outside its four was touched, disclosed)

Landed revision: `compile-check.server.ts` **16:15:44** (+701 B), `compile-check.server.test.ts`
**16:11:04** (+1,275 B), `headless.test.ts` **16:11:28** (the disclosed cross-file fixture repair).
`codegen.server.ts` and `codegen.server.test.ts` are **untouched** (10-06 11:26:19 / 15:18:29), and
`scaffold.ts` carries only `close-ui`'s 16:05:41 edit.

| Claim | Verdict | The command / read that decided it |
|---|---|---|
| The per-kind extension-vs-compiler-option mismatch is real, and it is 3 kinds wide | **CONFIRMED — I re-derived it myself before reading the log** | `%TEMP%\rt358_kind_table.mjs`, which emits each kind through the real `scaffoldProject` and reads back the emitted `tsconfig.json`. My table (below) says `tool`/`service`/`library` each emit `src/ui/console.tsx` with **no `jsx`**, while `app` gets `react-jsx` and `game` gets `preserve`. The lane's §1.2 table agrees with mine on the compiler-option half and adds the **dependency** half I had not measured: `PKG_DEPS` (`scaffold.ts:812-814`) declares `react`/`react-dom` **only for `webapp`**, and the 353 site modules import react (`scaffold.ts:3178-3179`, `:3902-3903`, `:4091-4092`) with `window` in the router (`:4909`). I verified both by read. |
| The direction chosen (scope the JSX site to kinds that declare its renderer; derive `jsx` from the emitted file set) is the honest and more capable one | **CONFIRMED as a judgement, with the lane's own measurement endorsed** | The rejected alternative is measurably insufficient, which is the decisive argument: the lane's probe shows a `tool` tree with `jsx` flipped on still red (**6 errors**: 4 × `TS2304 'window'` in `router.tsx`, 1 × `TS2554`, 1 × the fixture's `TS2749`), and `game` unchanged by any `jsx` value because its one error is `TS2614` — the site **replaced** the `src/ui/console.tsx` the game entry imports (`bootGame`). So "enable jsx" would turn a CLI into a webapp, which is the opposite of kind fidelity. I re-derived the structural premise independently: `briefedSiteFiles` (`scaffold.ts:5092-5136`) still has **no kind gate** after `close-ui` landed, while its sibling `rendererFiles` is gated at `scaffold.ts:4278`. |
| The fix is landed | **REFUTED — and disclosed by the lane itself (§5)** | `src/lib/scaffold.ts` is unchanged since `close-ui`'s 16:05:41 edit; `tsconfigJson` (`scaffold.ts:984`) still ends `kind === "webapp" ? {jsx:"react-jsx"} : kind === "game" ? {jsx:"preserve"} : {}` (`:1006-1010`); the 353 call site still has no kind gate. And the deciding test is still red, at the **same** count as the pre-wave baseline: `node --experimental-strip-types --test --test-name-pattern "pre-seal self-typecheck" src/lib/codegen.server.test.ts` → **`# tests 9 · # pass 8 · # fail 1`** (baseline `9/8/1`). **No new red, and the wave's `testsLib` red is not closed by this lane.** |
| Why it is not landed — the ownership blocker | **CONFIRMED, and it is the wave's own plan defect** | `src/lib/codegen.server.ts` contains **no** tsconfig code (`Select-String -Path src\lib\codegen.server.ts -Pattern 'tsconfig'` → 3 hits, all comments `:738`, `:1895`, `:1910`); its tree comes from `scaffoldProject` (`:171` import, `:6287` call). The builder (`scaffold.ts:984`) and both site emitters (`scaffold.ts:5092` 353, and the 351 sibling) are in `close-ui`'s file, which `wave_plans/W358/close-kindjsx.md` forbids the lane to edit. **See JOB 2 row (h).** The lane's five rejected in-scope alternatives (reconciling only the scratch tree, a `uiGeneration` hook, injecting a `tsconfig.json` row into `generatedTree`, widening the verdict tail, emitting pages as `.ts`) are each rejected with a stated measurement, and I find the rejections sound: the first two are gate-only (the delivered tree stays inconsistent), the third creates two writers for one root document, the fourth is the "fix the test, not the product" shape the plan bans, and the fifth is data contortion. |
| **R-8's type-level half is landed** (`jobScoped`/`wholeTree` required) | **CONFIRMED — with an independent prover** | `src/lib/compile-check.server.ts:610` `jobScoped: TreeSubstanceReading;` and `:618` `wholeTree: TreeSubstanceReading;` — **no `?`** (my 16:15:09 reading showed `?` on both, i.e. a mid-write state; the landed 16:15:44 bytes drop it). The plant is in the bytes: `compile-check.server.test.ts:2045-2055` builds `unscoped` with **neither** scoped reading and assigns it to `TreeSubstance` under `// @ts-expect-error R-8 plant` (`:2054`). **The prover is the repo's own compiler, which I ran:** `npx tsc --noEmit` → **`TSC_EXIT=0`, 0 `error TS` lines**. TypeScript reports **TS2578 "Unused '@ts-expect-error' directive"** when the suppressed error does not exist, so exit 0 proves the omission **is** a compile error — a producer that omits a scope cannot compile. (At the mid-write revision the same command exited **2** with `TS18048: 's.jobScoped' is possibly 'undefined'` at `compile-check.server.test.ts:1851`; that was the lane's own file lagging its type change, not a finding.) |
| The one cross-file consequence is disclosed and minimal | **CONFIRMED** | `src/lib/headless.test.ts` moved only at **16:11:28** (311,517 B); the lane names the single fixture (`headless.test.ts:843`, the `W2 · 348` `TreeRunOutcome` literal) and states that `treeVerdictHash` reads only the bare counters (`compile-check.server.ts:941-944`), so the hash and the assertions are unchanged. It is a *forced* consequence of making the pair required — a hand-built producer elsewhere in the repo had to publish both scopes — and it is outside every W358 lane's scope, which is exactly why it is disclosed. Not a boundary violation, but it is a file no W358 lane owned. |
| The lane's own suite | **CONFIRMED** | `node --experimental-strip-types --test --test-reporter=tap src/lib/compile-check.server.test.ts` → **`# tests 111 · # pass 110 · # fail 0 · # skipped 1`** — exactly the lane's stated numbers (the skip is the registered deep-verify opt-in). |

**The extension-vs-compiler-option table, re-derived by ME (not read from the lane)** — probe
`%TEMP%\rt358_kind_table.mjs`, which emits every kind through the real `scaffoldProject` and reads back
the emitted `tsconfig.json`:

| kind | files | emitted `.tsx` | emitted `jsx` | `lib` | `types` | `index.html` | deps | scripts |
|---|---|---|---|---|---|---|---|---|
| `app` | 19 | `src/main.tsx`, `src/ui/console.tsx` | **`react-jsx`** | ES2022+DOM+DOM.Iterable | vite/client, node | yes | react, react-dom | dev/build/preview/typecheck/test |
| `game` | 19 | `src/ui/console.tsx` | **`preserve`** | ES2022+DOM+DOM.Iterable | node | yes | — | dev/build/preview/typecheck/test |
| `tool` | 17 | **`src/ui/console.tsx`** | **absent** | ES2022 | node | no | — | typecheck/test |
| `service` | 16 | **`src/ui/console.tsx`** | **absent** | ES2022 | node | no | — | typecheck/test/**start** |
| `library` | 16 | **`src/ui/console.tsx`** | **absent** | ES2022 | node | no | — | typecheck/test |

**The mismatch is broader than the plan states: it is `tool` + `service` + `library` (3 of 5 kinds), not
`tool` alone.** What makes it *visible* today is the **second** `.tsx` population — the 353 briefed-site
pages (`src/ui/pages/*.tsx` + `src/ui/view.tsx` + `src/ui/layout.tsx` + `src/ui/router.tsx`) that the
341-1 pre-seal test's tree materialises for a `kind:"tool"` project; those files contain real JSX, so
`tsc --noEmit` reds with TS17004/TS6142.

**What this lane adds that I could not have measured cheaply, and that W359 needs:** the emitted trees'
**own `tsc`**, per kind, both with the repo's shared toolchain and with a declared-deps-only one — `app`
0 errors both ways, `game` 1 error (TS2614 `bootGame`, the site replaced the game shell), `tool`/`service`/
`library` 83 errors (180 declared-deps-only). I did not re-run those heavy probes (they install/junction
toolchains), so I record them as **the lane's measurement, consistent with my structural table** rather
than as my own reading. The one number I did verify independently is the *pin's* state: the red is the same
8-of-9 as at the baseline, so the lane introduced no new failure while diagnosing the right one.

### 1.3 `close-ui` — **CONFIRMED** (merge honoured, 139/139 green, R-10 fixed for all four banner variants)

Landed revision: `scaffold.ts` **16:05:41**, `software-preview.tsx` **16:05:55**,
`scaffold.test.ts` **16:10:07** (`fixes/358_close_ui.md` mtime 16:14:32). My own re-run at 16:13:
`# tests 139 · # pass 139 · # fail 0`, `TSC_EXIT=0` on the scaffold/ui files.

Facts I judged, each by my own command:

| Claim | Verdict | The command that decided it |
|---|---|---|
| The wave owner's decision (merge, not replace) is honoured | **CONFIRMED** | `node --experimental-strip-types --test --test-reporter=tap src/lib/scaffold.test.ts` → **`# tests 139 · # pass 139 · # fail 0`** (baseline `133/132/1`). **`ok 1 - binds ≥2 spec-derived fields + an interaction to a real generated export`** (was `not ok 1`) and **`ok 20 - A3-f07 / W-14 — default emitted-UI generator (real fields + interaction)`** (was `not ok 20`), **while `ok 26 - A2-F5 — spec-derived page set for a prose brief` also passes**. The test ID and name at 1, 20 and 26 are the *same* as at the baseline, so nothing was renamed away; the pass count rose 132 → 139 as the fail count fell 1 → 0. The lane added five tests that name the invariant (`ok 2 - 358 merge: … no longer REPLACES …`, `ok 3 - 358 merge: … ride the SAME emission`, `ok 35 - 358 (R-10) …`) — test count 133 → 139. |
| The merge is real in the bytes, not only in the test | **CONFIRMED by read** | `src/lib/scaffold.ts:2529 siteOperatorConsole` emits `Console()` = `<><SiteRouter /><OperatorConsole /></>` and `function OperatorConsole()` wrapping the generator's body; the generator stays the single producer (`scaffold.ts:2515 uiOperatorFormBody` calls `defaultUiGeneration` at `:2517`) and the merge is gated to the case that has something real to merge — `if (kind !== "webapp") return null;` (`:2516`) plus the bound-form marker `UI_BOUND_FORM_MARKER = "onSubmit={onSubmit}"` (`:2505`, read back at `:2518`). Both site callers use it, so the **351** and **353** sites both keep the operator surface. |
| The emitted product was not reduced | **CONFIRMED** | The wrapper is syntactically safe: `defaultUiGeneration`'s body is a **statement list** ending `return (…);` (`scaffold.ts:2469-2495`) — no `export`, no nested `Console()` — so `function OperatorConsole() { …body }` cannot produce a duplicate declaration or a module-level statement inside a function (`export` inside a body would be a syntax error; there is none — `Select-String -Path src\lib\scaffold.ts -Pattern 'export default'` inside the generator's range → 0). And for every kind but `webapp`, and for any generator output without the bound-form marker, `siteOperatorConsole` returns `null` and the caller keeps its **exact pre-358 bytes** — so the change is additive on one input class, which is the opposite of the JOB-2 "a merge that reduces the emitted product" shape (§2c). |
| Both `scaffold.test.ts` capabilities green, or the discarded one recorded | **CONFIRMED green (nothing discarded)** | My run at 16:09 read `139 / 138 pass / 1 fail` (the only red being the lane's new R-10 suite, mid-write); my run at 16:13, after `scaffold.test.ts` moved at 16:10:07, read **`139 / 139 / 0`**. The intermediate red was a mid-write artefact of my own sampling — recorded because a sampling artefact is not a finding (the W357 §4.5 precedent), and the lane's own `139/139` claim is consistent with the landed bytes. |
| R-10's alert keys on the banner the scaffold truly writes | **CONFIRMED for every variant I could find** | `%TEMP%\rt358_ui_probe2.mjs`. The predicate is now a shared producer, `src/lib/scaffold.ts:8777 readmeLeadsWithCautionBanner(body)`, used by `src/lib/scaffold.ts:8786 withheldTreeReadmeNote(body)` and consumed at `src/components/software-preview.tsx:17,250-252` (the old literal-match at `:246-252` is gone; `Select-String -Path src\components\software-preview.tsx -Pattern 'redTreeReadmeBannered\|RED TREE\|\.body\.includes\('` → **0 hits**). It is **positional**, not literal-keyed: `String(body ?? "").trimStart().startsWith(CAUTION_ALERT_LEAD)` with `CAUTION_ALERT_LEAD = "> [!CAUTION]"` (`scaffold.ts:8738`), and `belowFloorBanner` (`:8748`) now builds from that constant. The component holds no predicate literal: `redTreeReadmeBannered` → **0 hits**, `.body.includes(` → **0 hits**, and of the two `RED TREE` hits one is the lane's own comment quoting the deleted literal (`software-preview.tsx:248`) and the other is the human-facing alert title (`:301`). |
| …verified for **both** the below-floor and red-tree branches | **CONFIRMED, end-to-end** | Probe, three Preview branches through the real `emitSoftware`: `below-floor` → `redTree: RT_E_PLAN_UNDERPRODUCED`, `leadsWithCaution: true`, note **"The archive's README carries the same caution banner."**; `red-trail` → `redTree: RT_E_TREE_RUN_FAILED`, `leadsWithCaution: true`, same note; `partial` → `redTree: RT_E_VALIDATION`, `leadsWithCaution: true`, same note; `clean` → `redTree: null`, `leadsWithCaution: false`, first line `> [!WARNING]` (**not** the caution marker — correct, and this branch never renders the sentence because `software-preview.tsx:294` gates it on `emitted.redTree`). The W357 R-10 defect is gone: for a below-floor run the README leads `> [!CAUTION]` and the note now says so. |
| …and any **third** banner variant (the plan's JOB-2 shape) | **CONFIRMED — I found TWO additional variants and both are detected** | Fed through the predicate directly: `scaffold.belowFloorBanner` (`scaffold.ts:8748`) ✓, `software-export.redTreeBannerText` (`:65`, the seam's `RED TREE — surfaced below the build's own completion bar.`) ✓, **`headless.redTreeBanner`** (`headless.ts:2657`, `## RED TREE-RUN — THIS ARTIFACT IS NOT VERIFIED`) ✓, **`headless.underProducedBanner`** (`headless.ts:2680`, `## BELOW-FLOOR PLAN - THIS ARTIFACT IS NOT A COMPLETE BUILD (RapidTool R2-01)`) ✓ — all four lead `> [!CAUTION]` and all four return "carries the same caution banner". Robustness: a BOM + leading blank + indent still detects (`trimStart`); negatives ("`# Fixture…` then a mid-body `> [!CAUTION]`", a clean README, the empty string) all correctly report "does not carry". The positional key cannot miss a future variant that *leads* with `[!CAUTION]`; the only shape it would miss is a withheld banner that leads with a **different** alert (e.g. `> [!WARNING]`), and no writer in the repo does that. |

**Residual (not a regression, a coupling to record):** `readmeLeadsWithCautionBanner` is a *positional*
predicate, so it depends on every withheld-banner writer **prepending at byte 0**. That holds today at all
three write sites — `scaffold.ts:9668` (`${banner}\n${file.body}`), `headless.ts:2876`
(`${banner}\n${f.body}`), `software-export.ts:139` (`${banner}${f.body}`) — but nothing in the type system
or a test pins "the banner is first" for a *future* writer. A writer that inserted a title line above the
banner would silently flip the note back to the false sentence. One cheap guard: assert
`readmeLeadsWithCautionBanner(belowFloorBanner(x))` in the same suite that pins the emit (the lane's new
suite at `scaffold.test.ts:3493` is the natural home).

### 1.4 The two plants the plan requires — **both run; one RESOLVED, one answered with a caveat**

**Bottom line (details below):** R-8's type-level half is **landed and proved** by the repo's own compiler
(`TSC_EXIT=0` with a consumed `@ts-expect-error` plant); the two `kindFit` pins **exist and fail closed**,
with the plan's literal "floor−1" plant run but arithmetically weak for a count at 0.

**R-8's type-level half (close-kindjsx), a zero-result query first.** The runtime half is
`censusShape` in `scripts/quality-ratchet.mjs` (W357 §1.3: `censusShape({jobScoped})` → a named reason).
The type-level half must live in `compile-check.server.ts`. **Absence query at the pinned revision:**
`Select-String -Path src\lib\compile-check.server.ts -Pattern 'jobScoped|wholeTree'` → **0 hits** — i.e.
at 16:11 the type-level requirement did **not** exist. **Verdict: NOT YET DEMONSTRABLE at that revision.**
The plant that will decide it (once the lane lands) is: rename one of the two producer keys at the
`substanceScopeShape` consumer and confirm `npx tsc --noEmit` fails with a missing-property error naming
the omitted scope — a `?` making one optional would keep the typecheck green and is the shape to refuse.

**Mid-flight observation, recorded with its mtime (NOT a finding — the lane was still writing).** At
**16:15:09** the lane's own comment and its bytes contradicted each other: `compile-check.server.ts:603-609`
said *"W358 (R-8, type-level half): **REQUIRED** — a producer that omits it does not compile"* while
`:610` read **`jobScoped?: TreeSubstanceReading;`** (same for `:618 wholeTree?`), and at 16:15 my
`npx tsc --noEmit` exited **2** with two `TS18048: 's.jobScoped' is possibly 'undefined'` at
`compile-check.server.test.ts:1851`. **Both resolved at the 16:15:44 landing** (`?` gone; `TSC_EXIT=0`).
Recorded because a mid-write state is not a finding, and because the *shape* I flagged is exactly the one
the lane then fixed in the right direction (the type lost its `?`; the consumer was not weakened).

**The two `kindFit` pins at floor−1 (close-taxonomy) — answered, PARTLY.** The reading for both
`kindFit.game.surfaceOk` and `kindFit.library.surfaceOk` is **0** and their structural minimum is 0
(`quality-ratchet.mjs:363` counts rows), so `floor − 1` is **−1, which this metric cannot produce**: the
lane's plant (`quality-ratchet.test.mjs:378`) proves only the evaluator's arithmetic
(`compareFloor("atLeast", 0, -1)` → `regressed`). The lane pinned at `floor 0 / readingPinned`, accounted
through the floors file's own `nonRegressible` slot (`quality-ratchet.mjs:806`), and **its pins do have
teeth — of a different shape**: `status: "enforced"` on an unproducible reading is a **hard failure**
(`HARD_FAIL_CODES`, `quality-ratchet.mjs:66`). **My own plant** (`%TEMP%\rt358_uncovered_plant.mjs`) makes
that concrete: feed the uncovered-kind shape (`quality-ratchet.mjs:1392-1396`) for `game` and **all six
`kindFit.game.*` metrics read `result=unavailable · code=RT_E_PROJECT_MISSING · failClosed=true`** on
enforced pins, so the run goes red. Reference for how the `app` kind solved the same problem — a zero
`.fit` pin plus four separately-pinned legs (`kindFit.app.entryOk/scriptsOk/surfaceOk/demandedMatch` =
29/29/10/20), the `surfaceOk` leg being the binding one.

**The consequence for W359 — verified, not inferred.** Because an uncovered kind makes every `kindFit.<k>.*`
leg read `unavailable` on an **enforced** pin, **removing the mis-stamped `testruns/bakery-website/emitted`
unit (W359 lane 3) hard-fails the ratchet by itself** — six metrics per affected kind — until a real
game-kind unit replaces it. So the corpus fix and the floors file must move in the **same** lane, and the
red intermediate state (if the lane splits the work) is by design, not a bug: `uncovered` never passes.

---

## 2. JOB 2 — the W358 regression map

| # | The plan's shape | Finding |
|---|---|---|
| a | **A parity fix that hides a real mismatch** | **The risk was real and was NOT realized — REFUTED as a regression, with the residual named.** I derived the honest contract independently before the lane landed (a `null`/"no CLI arm" class for the **17** `-` rows + a real mapping for the **4** exit-documented rows, §1.1) and the lane implemented exactly that, **plus two things I did not ask for**: an `unreadableCells` assertion (a new `typical exit_code` spelling must be declared, `cli-exit-taxonomy.test.mjs:382-390`) and a **third parity leg pinning the README table to `ERROR_CODE_DOC` both ways** (`:405-422`) — i.e. R-9's *cause* (a table that silently falls behind the registry) is closed, not just its symptom. Deciding command: `node --test --test-reporter=tap scripts/cli-exit-taxonomy.test.mjs` → **62/62 pass** (baseline `not ok 2`). **Residual (inherent to a doc-driven contract):** the class now *comes from* the README cell, so a future red can be silenced by editing a `-` cell into a number instead of fixing the code — the same trust the registry leg already places in `ERROR_CODE_DOC`, and the drift message quotes both values, so it is a doc-honesty risk rather than a hidden-mismatch door. **Absence query for the door I originally named:** the vacuity floor is `table.length >= 30` (`:363`) against a real **57** rows, the parser is now `readmeTableRows()` (`:219`, last cell, with a duplicate-row assertion at `:367`), and a parser that returned the 35 W357-era rows would now fail the `ERROR_CODE_DOC` leg. |
| b | **A kind-aware tsconfig that breaks a web kind** | **The risk is now about the *unlanded patch*, and the patch itself is safe for both web kinds.** `close-kindjsx` chose direction (b) *scoped by a real declaration* rather than by a kind list — `emittedJsx ? (PKG_DEPS[kind]?.react !== undefined ? "react-jsx" : "preserve") : {}` — plus scoping the 351/353 sites to `PKG_DEPS[kind]?.react !== undefined` (its §2.3). Against my own table (§1.2) that is **byte-identical for `app`** (`react` declared → `react-jsx`) and for `game` (`react` undeclared → `preserve`, and my table shows `game.deps = []`); `PKG_DEPS` declares react **only** for `webapp` (`scaffold.ts:812-814`). So the blanket "any `.tsx` present ⇒ set `jsx`" rule I warned about is **not** the rule the lane proposed — it derives from the *dependency declaration*, the one signal that actually distinguishes a JSX-transform tree from a preserve-only one — and neither web kind is downgraded. **The regression that stands is the unlanded one:** `scaffold.ts` is unchanged, so `briefedSiteFiles` (`:5092-5136`, no kind gate) still writes react-importing `.tsx` into trees that declare no react (the site modules import react at `scaffold.ts:3178-3179`, `:3902-3903`, `:4091-4092`; the router uses `window` at `:4909`), and the deciding pin is still **9 tests / 8 pass / 1 fail** — the same count as the pre-wave baseline. **Query:** `%TEMP%\rt358_kind_table.mjs` + `Select-String -Path src\lib\scaffold.ts -Pattern 'kind !== "webapp"'` → `:4278` (the gated sibling) and `:5162` (`emitUi`), **neither at `:5092`**. |
| c | **A merge that reduces the emitted product while both tests pass** | **Checked specifically; NOT present at the landed bytes — the product grew.** `A2-F5` (page set, `ok 26`) and `A3-f07` (field binding, `ok 20`) are both green **in one run** (`scaffold.test.ts` 139 tests / 139 pass / 0 fail), and the two new tests assert the *conjunction* (`ok 2`, `ok 3`). The shape to keep watching: `A2-F5` counts pages and `A3-f07` counts bound fields, so a "merge" that satisfied the binding by **replacing** the bound page with a smaller shell would green both counters while shrinking the tree. The measurable counter is the emitted file count for the same input: my probe shows `app` = 19 files with `src/ui/pages/*` present and 2 `.tsx`, so a drop on an unchanged input is the tell. **Query:** re-run `%TEMP%\rt358_kind_table.mjs` and compare `app.fileCount` (19) and `app.exts['.tsx']` (2) after any further `scaffold.ts` edit. Second check, done: the wrapper is syntactically safe (`defaultUiGeneration`'s body is a statement list ending `return (…);`, `scaffold.ts:2469-2495`, so no `export` can land inside `function OperatorConsole()`), and the merge is gated to `kind === "webapp"` + the bound-form marker (`:2515-2518`), so every other kind keeps its exact pre-358 bytes. |
| d | **An alert whose new key misses a banner variant** | **Checked exhaustively; NOT present.** Four banner producers exist in the repo — `scaffold.belowFloorBanner` (`scaffold.ts:8748`), `software-export.redTreeBannerText` (`software-export.ts:65`), `headless.redTreeBanner` (`headless.ts:2657`), `headless.underProducedBanner` (`headless.ts:2680`) — and the new positional key detects all four (§1.3). The **residual** is the shape the plan names: the key is *positional*, so a fifth writer that does not prepend at byte 0 is missed. Third-party consumers of the same notion already disagree about the key, which is why this stays a live class: `scripts/acceptance-run.mjs:420` keys on `readme.startsWith("> [!CAUTION]")` **and** `:421` on `readme.includes("RED TREE-RUN")` (two different keys, one file). **Query:** `Get-ChildItem -Recurse -Include *.ts,*.tsx,*.mjs -Path src,scripts \| Select-String -Pattern '\[!CAUTION\]'` → the four producers + the three `startsWith` consumers above. |
| e | **A resolution that mis-states the campaign's headline defect** | **Found: my own W357 framing needs one correction, and it sharpens the W359 plan (§3.1).** The corpus's declared kind is threaded by the **eval driver**, so the resolver's mis-resolution is *masked on the eval path and live on the CLI path*. See §4.1 — this is the correction that matters most for W359. |
| f | **A kind-aware criterion that is wired in tests and dead in production** | **Found, with a zero-result query.** `p6-web-surface` / `p6-game-surface` / `p6-runnable-entry` read `generatedTree ∪ emittedSurface ∪ generatedSource` (`dod.ts:989-1006 surfaceFiles`, `:998` the stamp). The doc at `dod.ts:981-986` states the scaffold's page/router/game surface is **never** a `generatedTree` row, so without the stamp those criteria are *unsatisfiable by a real build*. The stamp reaches the record from exactly one production site — `codegen.server.ts:8857` inside the keyed synthesis result. The driver-facing helper that was supposed to cover the rest, `headless.ts:5855 stampEmittedSurfaceForGate` ("the gate-wiring seam for the drivers"), has **one hit in the whole repo: its own definition** — `Get-ChildItem -Recurse -Include *.ts,*.tsx,*.mjs -Path src,scripts \| Select-String -Pattern 'stampEmittedSurfaceForGate'` → **1 hit, `headless.ts:5855`**. So on any path that records a P6 gate **without** going through `codegen.server.ts:8857` (a keyless run, or any driver that did not call the seam), the shipped surface is invisible to the kind criteria. Direction of the error is **false refusal, not false pass** — `surfaceFiles` returns only the tree + `generatedSource`, so a *correct* product can read `RT_E_UI_UNWIRED`/`RT_E_PLAN_UNDERPRODUCED` red. **`file:line`:** `headless.ts:5855` (unwired), `codegen.server.ts:8857` (the only caller), `dod.ts:998` (the read). **Query:** the one-hit grep above. **What I did not determine:** which concrete driver legs record a P6 gate without the stamp — I did not enumerate them, so I state the hole and its direction, not its current blast radius. |
| g | **An emitter/gate parity that the comment claims and the test does not deliver** | **Found.** `scaffold.ts:645-646` asserts *"A test pins this to dod.productSurfaceKindOf so the emitter and the gate cannot disagree."* The only such assertion is `scaffold.test.ts:3303-3308`, and it is **one brief** whose premise is itself a mis-kind (`kind:"app"` + an arcade-game brief). Its sibling, the drift pin between the engine and `dod` (`dod.test.ts:848`), iterates **9 hand-written briefs, none of them a corpus brief**. So the "cannot disagree" property is pinned on 10 hand-chosen strings and **0** corpus briefs — which is exactly why a 3-of-11 disagreement lives under a green suite. **Query:** `Get-ChildItem -Recurse -Include *.test.ts -Path src \| Select-String -Pattern 'productSurfaceKindOf'` → 5 hits, all in `dod.test.ts:840-845` plus the single `scaffold.test.ts:3306`. |
| h | **A lane allocation that cannot reach the defect it was given** (wave-integrity, not a code regression) | **CONFIRMED — and the lane confirmed it against itself, in writing, with the patch it could not land.** `wave_plans/W358/close-kindjsx.md` asks the lane to fix, "at the cause, kind-aware", that a non-web kind emits source its own tsconfig cannot compile, and its `Do not` forbids `src/lib/scaffold.ts` (`close-ui`'s file). Measured: the cause is **entirely inside `scaffold.ts`** — `briefedSiteFiles` (`:5092-5136`, no kind gate; re-read **after** `close-ui` landed at 16:05:41 and **still no kind gate**) and `tsconfigJson` (`:984-1015`, the only `jsx` decision in the repo) — while the lane's own files carry none of it (`codegen.server.ts`: `tsconfig` on **3 comment lines only**, `:738/:1895/:1910`; its tree is `scaffoldProject` at `:6287`). The lane's §5 states the same conclusion and ships the complete patch it could not apply, and its §2.1 measures that the *alternative* direction is insufficient (6 errors survive a `jsx`-only flip). **So the wave's `testsLib` red cannot close under this lane's charter** — the honest options are (i) the file's owner lands the 20-line patch, (ii) the parent re-scopes the two lanes' file lists, or (iii) the red is carried into W359 with this report as the record. **Query:** `Select-String -Path src\lib\codegen.server.ts -Pattern 'tsconfig'` → 3 hits, all comments; `Select-String -Path src\lib\scaffold.ts -Pattern 'kind !== "webapp"'` → `:4278`, `:5162`, **neither at `:5092`**. |

---

## 3. JOB 3 — the FINAL W359 kind-fidelity plan

### 3.1 The measured ground truth (re-derived at the 16:11 bytes)

**(A) The resolver, measured.** `engine.ts:316 deliveryKindOf` is an **ordered first-hit** table
(`DELIVERY_KIND_KEYWORDS`, `engine.ts:219-241`) with a `UI_SURFACE_WORDS` guard (`engine.ts:270-276`,
`:344`) that skips the `library`/`tool` rows when the brief names a UI surface. Re-run of my W357 probes
at the current bytes (`node --experimental-strip-types %TEMP%\rt357_kind.mjs`):

| corpus brief (declared) | `briefDeliveryKind` | `productSurfaceKindOf` | agree? | the row/token that wins (`rt357_tokens.mjs`) |
|---|---|---|---|---|
| `arcade-breakout` (`game`) | **`app`** | `game` | **NO** | `app` on `screen, screens` |
| `coffeehouse2home-property-ledger` (`webapp`) | **`service`** | `runnable` | **NO** | `service` on `service` |
| `showing-booking` (`webapp`) | **`tool`** | `runnable` | **NO** | `tool` on `agent` |
| `invoice-csv-cli` (`cli-tool`) | `tool` | `runnable` | yes | `tool` on `convert` |
| `order-webhook-service` (`service`) | `service` | `runnable` | yes | `service` on `service, webhook, worker` |
| `date-rrule-library` (`library`) | `library` | `runnable` | yes | `library` on `library, package, npm` |
| `field-ops-suite`, `house-flip-manager`, `permit-inspection-tracker`, `real-estate-crm`, `rental-portfolio` (all `webapp`) | `app` | `web` | yes | `app` on `ui/dashboard/board/…` |

11 briefs in `research/eval-corpus/*.md` (plus `README.md`, which is not a brief). **3 of 11 disagree.**

**(B) There are FOUR resolver instances, not one — and the "ONE decision" claim is false.** The doc
comment at `engine.ts:305-313` says *"Every resolver reads THIS … so the two can no longer drift."* The
bytes say otherwise:

1. `engine.ts:316 deliveryKindOf` — the keyword table (the "one decision").
2. `dod.ts:900 briefDeliveryKind` — a **manually replicated copy** of the rows (`dod.ts:874-887`, comment
   at `:868-873`: *"replicated here because engine.ts imports this module"*), **plus** a second,
   higher-priority rule at `dod.ts:923`: `if (kind === "game" || KIND_GAME_RE.test(brief)) return "game";`
3. `scaffold.ts:649 projectKindOf` — a **third**, different short-circuit at `scaffold.ts:650`:
   `if (BRIEF_GAME_RE.test(brief)) return "game";` then `switch (deliveryKindOf(project))`.
4. `scripts/run-eval.mjs:2082 deliveryKindOf(corpusKind)` — a **local** mapper from the corpus front-matter
   vocabulary to `Project.kind` (`webapp|app→app`, `game→game`, `tool|cli-tool→tool`, everything else →
   *undefined*, i.e. the library single-module path).

The parity test that is supposed to stop drift (`src/lib/dod.test.ts:848`) compares (1) and (2) over **9
hand-written briefs** — **none** of them a corpus brief — so it is green while the corpus disagrees; and
(3) is not compared to anything at all. **This is the architectural defect behind the mis-resolution: a
"single source of truth" that three other files re-implement.**

**(C) Why the mis-resolution bites on the CLI path and is masked on the eval path.** `run-eval.mjs:2122`
stamps `Project.kind` from the fixture's front-matter, and `withDeliveryKind` (`engine.ts:353-356`) is a
no-op on an already-stamped project — so **every measured corpus emission was resolved by the driver, not
by the keyword table**. The evidence is in the emitted README's own Kind line, which renders
`project.kind` (`scaffold.ts:8269-8270`, `:8351`):
`testruns/bakery-website/emitted/README.md` → `- **Kind:** game — game (kind game (mapped from declared kind
"game"))`. The **real CLI path forwards no kind at all** (`scripts/rapidtool-cli.mjs:1632`), so on
`rapidtool create` + `run`/`emit` the keyword table is the sole decider, and the mis-resolution is live.
Corollary for the plan: **the W359 regression test must exercise resolution from the brief alone**
(`deliveryKindOf({brief, domain:"", lattice:null})`), not through the eval driver, or it will pass
forever without touching the defect.

**(D) The shape consequence is real for 2 of the 3 flipped briefs.** Re-derived by reading the consumers:

| brief | resolver | `projectKindOf` | emitted shape | who then demands what |
|---|---|---|---|---|
| `showing-booking` | `tool` | `cli-tool` (no game token; `switch` on `tool`) | a **CLI** tree for a bookings website: no `index.html`, `scripts` = typecheck/test | `productSurfaceKindOf` = `runnable` → `p6-runnable-entry` is satisfied by a non-stub entry, so **the wrong product can seal** |
| `coffeehouse2home` | `service` | `service` | **`singleModuleLibraryKind` (`codegen.server.ts:6894-6905`) returns `true` for `service` → the single-module path: a headless service, no UI, no pages** | `p6-runnable-entry` again — a webapp brief's product never faces `p6-web-surface` |
| `arcade-breakout` | `app` (stamp) | **`game`** (`BRIEF_GAME_RE`) | **`game`** — the emitter and the gate agree, because both carry their own regex escape hatch | `p6-game-surface` binds correctly; the damage is the **record** and every consumer of the stored kind |

So the honest severity statement is: **two briefs produce the wrong product shape and seal, and one
brief's stored kind is wrong while its emitter happens to be saved by a duplicate regex rule that is
itself the architectural defect.** W357's "3/10 mis-resolve" stands as a statement about the resolver;
the routed-product consequence attaches to 2 of the 3.

**(E) The per-kind corpus is worse than "two mis-stamps".** `readKindFitUnits()`
(`scripts/quality-ratchet.mjs:1003`) builds the units from two sources: the 13 trees in
`scripts/prevention/cassettes/trees.json` (using **the record's own `kind`** as `requestedKind`) and the
19 `research/eval-out/<dir>` dirs that carry both `.rapidtool/project.json` and `package.json` (using the
**corpus front-matter's** `kind` → `KIND_ALIASES`, `quality-ratchet.mjs:78`). Measured composition of the
32 units (`--all` → `readings.kindFit.byKind`):

| kind | units | honest? |
|---|---|---|
| `app` | **30** | 19 eval-out units (6 webapp fixtures × trials) + 11 testruns trees. Honest requests. |
| `game` | **1** | `testruns/bakery-website/emitted` — a *"Golden Crust Bakery — Marketing Website"* stamped `game` (its `emitted.v2` sibling is stamped `app`). **Mis-stamp; the unit measures a bakery site against a game contract.** |
| `library` | **1** | `testruns/mobile-companion/emitted` — a *"Crumb & Bloom Companion — Mobile App"* stamped `library` (its `.v2` sibling is `app`). **Mis-stamp.** |
| `tool` | **0** | `kindFit.tool.*` = `uncovered` (floor `null`). |
| `service` | **0** | `kindFit.service.*` = `uncovered`. |

And the mis-stamp is **self-confirming**: `requestedKind` for a testruns unit comes from the *record*, so
the unit's "requested kind" is the wrong kind, and `fit` compares the tree against its own stamp. That is
why `kindFit.game.entryOk`/`scriptsOk`/`demandedMatch` read 1 of 1 while `surfaceOk` reads 0 of 1 — the
one honest reading is the one that has no pin (§1.4).

**(F) The `game`/`library` "the emitted product matches" question is measurable now, contrary to W357's
"UNDETERMINED".** W357 left all five kinds undetermined because no emitted tree has `node_modules`. That
is still true for a full `tsc` run, but the **structural** half is measurable from the bytes and I
measured it (§1.2): every non-web kind emits `src/ui/console.tsx` under a tsconfig with no `jsx`, and
`tool` additionally emits 353 pages when the brief/spec names ≥2 pages. Add to that
`COARSE_KIND_LABEL` (`compile-check.server.ts:663`, read at `:1780-1781`) as the fourth place the kind is
spelled out.

### 3.2 The injection — content, site, and budget

**Primary site: `src/lib/codegen.server.ts:2286 p6SynthesisChunkUserPrompt`.** It is the one
context-assembly function behind every synthesis prompt: `p6SynthesisUserPrompt` (`:2227`) delegates at
`:2248`, and the tree path calls it at `:7864`, `:8039`, `:8296` and the single-module path at `:7119` —
and `project` is already in scope at all four (`project.contracts`, `project.contracts, contractDefs`).

**The block's content** (per kind, imperative, ≤ ~600 chars each — 5 variants compile to one constant
table `DELIVERY_KIND_BLOCK: Record<DeliveryKind, string>`):

```
DELIVERY KIND: tool (a command-line tool).
This project is a CLI — a deliverable, not an option. The whole tree must honour it.
- Surface (mandatory): one program entry exported as `main(argv: string[]): Promise<number>`.
- No DOM, no React, no browser globals, no `.tsx` file anywhere in this tree.
- A usage line, ≥2 documented non-zero exit codes, and an honest failure message per exit.
- Deterministic output for a fixed input; never a random id or a wall-clock timestamp in the output.
```

with the web variant demanding `index.html` + `src/main.tsx` + a router/page surface and *no* game loop;
the `game` variant demanding keyboard **and** pointer input, a `requestAnimationFrame` loop, a `<canvas>`
and win/lose states; the `service` variant demanding a `PORT`-reading entry and an honest readiness
refusal; the `library` variant demanding pure side-effect-free named exports, a shared `type`, and
**no** `.tsx`.

**Placement — measured.** `lines` is `[ "BRIEF:", capped, "", "REQUIREMENTS…", … ]` (`:2335-2343`) and the
per-chunk volatile block is `"TYPE SIGNATURES (must export"` at `:2384`. Insert **after the brief text and
before `REQUIREMENTS`**. Measured on a representative spec through the real builder
(`%TEMP%\rt358_budget.mjs`): `promptChars = 5426`, `startsWith("BRIEF:") = true`, and the
`TYPE SIGNATURES` block begins at **index 2740** — so the insertion point is inside the cacheable
project-stable prefix the D5/A8 ordering exists for (`:2327-2334`). Inserting the block **after** the
signature block would put a project-stable string after a per-chunk volatile one and regress
`cachedPromptTokens` (the measured 0-on-212-calls failure).

**Budget — measured.** `P6_SYNTH_PROMPT_MAX_CHARS = 60_000` (`:292`), `P6_SYNTH_MAX_TOKENS = 32_000`
(`:184`), `P6_BRIEF_MAX_CHARS = 48_000` (`:238`), `P6_MODULE_MAX_CHARS = 60_000` (`:186`). Headroom on the
measured prompt is **54,574 chars**; a 537-char block is **0.9 %** of the char ceiling and **~135 tokens =
0.42 %** of the token cap. The one *enforced* char budget is the prior-files loop
(`:2411`, `budgetLeft = P6_SYNTH_PROMPT_MAX_CHARS - lines.join("\n").length`), which measures `lines`
**after** the block, so the block must be pushed into `lines` (it will be) — otherwise the
`[PRIOR-ELIDED]` marker fires ~0.5 KB early.

**Second site — `src/lib/prompt-engine.ts` (`expansionPrompt:262`, `expandBrief:419`).** Without this the
`TYPE SIGNATURES` list the synthesis prompt demands stays kind-blind: a `game` spec that never asked for
`renderFrame` cannot be repaired by prompt text downstream. The envelope is **six fixed keys**
(`EXPANDED_SPEC_KEYS`, `:126-133`), validated by `expandedSpecViolations` (`:191`) and repaired once via
`EXPANSION_REPAIR_LINE` (`:253`) — so **the kind must ride as prompt text, not as a seventh key** (a
seventh key changes `ExpandedSpec`'s persisted shape and every cached `implementationSpec`). Concretely:
`expansionPrompt(brief, policies, lessons, kind)` adds one `DELIVERY KIND` paragraph next to `Brief:` at
`:328-329`, and the field rules at `:319-326` gain per-kind REQUIRED rows (a `game` spec must emit
input/loop/canvas requirements and a loop/render signature; a `tool` spec a `main(argv)` signature plus
exit-code edge cases; a `service` spec a listen/readiness signature; a `library` spec an importable public
API and a JSX prohibition). Callers to widen: `codegen.server.ts:6214`
(`expand: (brief, lessons) => expandBriefWithBackoff(brief, b => expandBrief(b, undefined, lessons))` —
inside `defaultDeps`, so widen the `P6SynthesisDeps.expand` seam with a trailing optional arg, which keeps
the test seams at `codegen.server.test.ts:3179` compiling) and `headless.ts:6427`
(`promptExpand(project, policies)` — `project` is in scope, so `deliveryKindOf(project)` is free).

### 3.3 The three threading holes (+ a fourth I measured)

1. **`scripts/rapidtool-cli.mjs:1632`** — `h.createProject({ brief: briefSource.value, name: args.name })`.
   `"kind"` is registered as a flag (`:186`, `:229`) and `headless.createProject` already accepts
   `input.kind` (`headless.ts:503`, applied at `:513` via `...(input.kind ? { kind: input.kind } : {})`),
   but the `create` arm never reads it. **Zero-result query:**
   `Select-String -Path scripts\rapidtool-cli.mjs -Pattern 'args\.kind'` → **2 hits, both at `:4795-4796`,
   both in the `knowledge` verb**; neither is on the `create` path.
2. **`src/lib/engine.ts:4074`** (`p = withDeliveryKind(p);`) — **CORRECTION to the plan and to my W357
   report, which both cite `engine.ts:4073`: `:4073` is the comment line; the call is `:4074`.** It sits
   inside `upgradeP6Keyed` behind `if (!isBareNodeHost()) return floor;` (`:4059`) and
   `if (!configured) return floor;` (`:4063`) — so on the keyless path and on a non-DeepSeek run
   `Project.kind` stays absent and every downstream resolver re-infers. `withDeliveryKind` has exactly
   **one** non-test caller (`Select-String` over `src`/`scripts`: the definition `engine.ts:353`, the
   `types.ts` doc comments, and `:4074`).
3. **`src/lib/headless.ts:6602`** — `` `Project: ${project.name} (kind: ${project.kind})` `` in the wild
   planner's context. On any unstamped run the model literally reads `(kind: undefined)`. The honest fix
   is to print the **resolved** value: `` `(kind: ${deliveryKindOf(project)})` ``.
4. **NEW — the eval driver is a fifth threading point, and it is the reason the corpus masks the defect.**
   `scripts/run-eval.mjs:2082` has its own `deliveryKindOf(corpusKind)` mapper and `:2122-2123` stamps
   from the corpus front-matter. It maps `library`/`service`/`""` to **`undefined`** — i.e. it deliberately
   routes them to the single-module library path (`:2092-2093`, comment `:2079-2080`). **But the mapper
   controls only the stored field, not the resolved shape:** on a **keyed** eval run `upgradeP6Keyed`'s
   `withDeliveryKind` (`engine.ts:4074`) re-derives the kind from the brief, so a `service` fixture is
   stamped `service` anyway — and on a **keyless** run `Project.kind` stays absent while
   `scaffold.projectKindOf` (`scaffold.ts:651` → `deliveryKindOf`) still infers `service` for the
   *emitted shape* and `singleModuleLibraryKind` (`codegen.server.ts:6899-6904`) still returns `true`
   because the *stored* field is absent. So the driver's stated intent and the actual product disagree in
   two different ways depending on the leg. **Any resolver change must decide this mapper explicitly, or
   W359 lane 3's "produce a real `service` emit" is not controllable from the corpus at all.**

### 3.4 The gates — which criteria must bind per kind, and how `kindFit` is pinned per kind

**Bind today (already written, `dod.ts`):** `p6-web-surface` (`:1431-1446`, code `RT_E_UI_UNWIRED`,
`probe` demands ≥1 page file **and** a nav path), `p6-game-surface` (`:1450-1464`, input **and** loop
**and** canvas), `p6-runnable-entry` (`:1471-1485`, code `RT_E_PLAN_UNDERPRODUCED`, non-stub entry **and**
`missingDeclared.length === 0`). All three are `advisory`-N/A when `productSurfaceKindOf` is `"none"`, and
the surface they read (`productSurfaceTrace`) is the SYNTHESIZED tree, not the emitted one — hence
`scaffold.stampEmittedSurface` (`scaffold.ts:7982`) folding the emitted surface modules into the row shape
the gate reads (comment at `:7994-8010`).

**The gap the gate has per kind** (measured, and each one a W359 done-when):

| kind | binds | the gap |
|---|---|---|
| `app` | `p6-web-surface` — but only when the brief NAMES a page noun (`dod.ts:925`) | `kindFit.app.surfaceOk` is **10 of 30**: 20 emitted app trees carry no usable page surface and the gate never saw them |
| `game` | `p6-game-surface` | binds only if the **brief** carries `game|arcade` (`dod.ts:923`); the stored kind is not consulted first, so the gate and the resolver can disagree — and the only `kindFit.game` unit is a bakery site reading `surfaceOk 0 of 1` **with no pin** |
| `tool` | `p6-runnable-entry` | no emitted case at all (`uncovered`); and a `tool` emission ships `.tsx` pages its own tsconfig cannot compile (§1.2) |
| `service` | `p6-runnable-entry` | same; plus `singleModuleLibraryKind` (`codegen.server.ts:6899-6904`) sends `service` down the single-module path, so there is no tree to judge |
| `library` | `p6-runnable-entry` | same; `kindFit.library.surfaceOk = 0 of 1` unpinned §1.4 |

**How `kindFit` must be pinned per kind.** The `app` precedent is the design: never pin the aggregate
`fit` (it reads 0 and cannot fire); pin each **moving leg** at its measured value so a drop is permanent —
and when a leg reads **0**, the honest options are (i) `floor: 1, status: "pending-first-green"` (names
the honest bar, is reported, flips to `enforced` on the first green tree) or (ii) `floor: 0` plus a
`nonRegressible` reason, forced by `canary.floors.atleast-zero-pins-are-accounted`
(`quality-ratchet.mjs:806`). **W358 chose (ii)** for `kindFit.{game,library}.surfaceOk` at 16:23:13, and
the choice is sound and verified by my own plant (§1.4): the pin cannot catch a *drop* (0 is the floor),
but it **does** catch a *disappearance* — an unavailable reading on an `enforced` pin is a hard failure.
Note the asymmetry W359 should keep: `kindFit.app.surfaceOk` is at floor **10** (a real bar), so for the
`app` kind a drop of 10→9 fires; for `game`/`library` the floor must be **raised to 1** the moment a real
per-kind unit exists (lane 3's done-when), which is exactly what the pin's own `nonRegressible` text says. Additionally the **genuine per-kind gate** the campaign needs is the DOD
criterion, not the ratchet count: `kindFit` is a *measurement*, `dod.ts` is the *seal*. So W359 must add
the missing connection — **a kind-mismatched product cannot seal** — which today it can, twice:
`showing-booking` (tool-shaped product for a website brief) satisfies `p6-runnable-entry`, and
`coffeehouse2home` (single-module service) does too. The cheapest honest binding: make
`dod.productSurfaceKindOf` read `deliveryKindOf(project)` **as the authority** and use the regexes only as
the fallback they were meant to be, so the demanded surface follows the decided kind; then a wrong
decision produces a sealed refUSER, not a wrong product.

**Two existing per-kind assertions to build on rather than duplicate:** `scripts/run-eval.mjs:836
checkExpectedKind` asserts the emitted README's `**Kind:** <kind>` line against the grader's declared
`expectedKind` (fail-closed when the line is unreadable, `:854-873`), and
`scaffold.ts:8351` writes that line from `project.kind`. Chaining those two is a ready-made per-kind
end-to-end assertion for any fixture the corpus emits.

**And one seam that must be wired before any of this binds on the real path (§2f):**
`headless.ts:5855 stampEmittedSurfaceForGate` is called by nobody. Either the drivers that record a P6
gate call it, or `p6-web-surface` / `p6-game-surface` / `p6-runnable-entry` keep judging a tree that
provably never carries the shipped surface (`dod.ts:981-986`) — in which case they are red for correct
products and green only where the keyed synthesis path happened to stamp. A W359 done-when belongs here:
a canary that the record the gate reads **carries** `emittedSurface` on every driver leg.

### 3.5 The sequenced, lane-shaped plan (ready to become `wave_plans/W359/*`)

Six lanes, in this order — each later lane's premise is the earlier lane's done-when. The order is forced
by one rule: **everything downstream inherits the kind**, so the resolver is first and the corpus is
second (a corrected resolver against a mis-stamped corpus measures the stamp, not the resolver).

| # | lane | files it owns | mandate (one line) | done-when (the deciding command) |
|---|---|---|---|---|
| **1** | `w359-resolver` | `src/lib/engine.ts` (**the table only**: `:219-241`, `:270-285`, `:316-356`), `src/lib/engine.test.ts` | replace the ordered first-hit table with a **scored** resolution: per-row weights, ≥2 hits or a high-specificity single hit required, an explicit tie policy (highest score; ties → the more specific row; final tie → `app`), and a **recorded** `kindResolution{kind, confidence, evidence}` on the project | `node --experimental-strip-types %TEMP%\rt358_kind.mjs`-equivalent in-tree test over `research/eval-corpus/*.md` asserting `deliveryKindOf({brief,domain:"",lattice:null})` for **all 11** briefs; **must flip 3** (`arcade-breakout`→`game`, `coffeehouse2home-property-ledger`→`app`, `showing-booking`→`app`) and **must keep 8** (`invoice-csv-cli`→`tool`, `order-webhook-service`→`service`, `date-rrule-library`→`library`, `field-ops-suite`/`house-flip-manager`/`permit-inspection-tracker`/`real-estate-crm`/`rental-portfolio`→`app`); `npx tsc --noEmit` exit 0 |
| **2** | `w359-one-truth` | `src/lib/dod.ts` (`:868-926`), `src/lib/scaffold.ts` (**`projectKindOf` only**, `:640-663`), `src/lib/dod.test.ts`, `src/lib/scaffold.test.ts` | **delete the three replicated resolvers**: make `dod.briefDeliveryKind` a thin delegate to `engine.deliveryKindOf`, make `productSurfaceKindOf` read the decided kind first (regexes demoted to the unstamped fallback), and make `projectKindOf` stop carrying its own `BRIEF_GAME_RE` | the `dod.test.ts:848` drift test rewritten to iterate the **corpus** (not 9 hand-written briefs) and to import the engine's function rather than re-list rows; `Select-String -Path src\lib\dod.ts,src\lib\scaffold.ts -Pattern 'KIND_ROWS\|KIND_GAME_RE\|BRIEF_GAME_RE'` → 0; `npx tsc --noEmit` exit 0 |
| **3** | `w359-corpus` | `scripts/prevention/cassettes/trees.json`, `research/eval-out/**` (new emit dirs), `scripts/quality-ratchet.floors.json` | **re-stamp or exclude the two mis-stamps** (`testruns/bakery-website/emitted` = `game` for a bakery site; `testruns/mobile-companion/emitted` = `library` for a mobile app — both have a `.v2` sibling stamped `app`) and **produce real per-kind emits** for `arcade-breakout` (game), `invoice-csv-cli` (tool), `order-webhook-service` (service), `date-rrule-library` (library), so `kindFit.{game,tool,service,library}` stop being `uncovered`/mis-stamped | `node scripts/quality-ratchet.mjs --all` → `kindFit.{game,tool,service,library}.units >= 1`, each with a real `surfaceOk` leg; `kindFit.tool.fit`/`kindFit.service.fit` no longer `uncovered`; **`canary.floors.atleast-zero-pins-are-accounted` still ok** after the pins **⚠ this lane and the floors file MUST move together — verified:** removing a kind's only unit makes every `kindFit.<k>.*` reading `unreadable(artifactAbsent)` (`quality-ratchet.mjs:1392-1396`) on an **`enforced`** pin, which is a **hard failure** (`HARD_FAIL_CODES`, `:66`). My plant (`%TEMP%\rt358_uncovered_plant.mjs`) turns all six `kindFit.game.*` metrics into `result=unavailable · code=RT_E_PROJECT_MISSING · failClosed=true` and puts them in `unavailableEnforced`. So the re-stamp must land **in the same edit** as the replacement unit and the re-pinned floors, or the ratchet is red in between **by design** |
| **4** | `w359-thread` | `scripts/rapidtool-cli.mjs` (`:1623-1640` only), `src/lib/engine.ts` (the `createProject`/deterministic-P6 stamp), `src/lib/headless.ts` (`:6602`), `scripts/run-eval.mjs` (`:2082-2095`, `:2122`) | close all four holes: forward `args.kind` (validated against `DELIVERY_KINDS`, `types.ts:31`) into `h.createProject`; stamp `withDeliveryKind` wherever a project is **created** (keeping `:4074` as an idempotent re-stamp); print the **resolved** kind at `headless.ts:6602`; make `run-eval`'s mapper stop swallowing `service` into the library path | `rapidtool create --brief research/eval-corpus/showing-booking.md --kind app` → the saved JSON carries `kind:"app"`; `Select-String -Path src\lib\headless.ts -Pattern 'kind: \$\{project\.kind\}'` → 0; a keyless run's project carries a `kind` **before** P6 |
| **5** | `w359-tell-it` | `src/lib/codegen.server.ts` (`:2286-2386` + the `P6SynthesisDeps.expand` seam `:6213-6214` + `:7119`/`:7864`/`:8039`/`:8296`), `src/lib/prompt-engine.ts` (`:126-133`, `:262-344`, `:419-448`) | land the **project-stable `DELIVERY KIND` block** after `BRIEF:` and before `TYPE SIGNATURES`, and make the six-key expansion envelope kind-correct as **prompt text** (never a seventh key) | a byte-parity test proving the block is absent ⇒ today's exact prompt bytes and present ⇒ `BRIEF:` … `DELIVERY KIND` … `TYPE SIGNATURES` in that order; `promptChars <= 60_000` on the measured shape; the block measured at ≤1 KB |
| **6** | `w359-seal` | `src/lib/dod.ts` (`:1424-1486`), `src/lib/scaffold.ts` (**the 353 gate only**, `:5092-5136` + `tsconfigJson` `:984-1015`), `scripts/quality-ratchet.mjs` + `floors.json` | make a **kind-mismatched product unable to seal**: gate `briefedSiteFiles` on the kind (sibling `rendererFiles` at `:4278` is the precedent) **or** derive `jsx` from the emitted file set with the `app`/`game` cases preserved (§2b); bind `p6-*-surface` to the **decided** kind; pin `kindFit.<kind>.surfaceOk` per kind | `%TEMP%\rt358_kind_table.mjs` re-run: **no kind emits a `.tsx` without a `jsx` setting**, `app.jsx` still `react-jsx`, `game.jsx` still `preserve` and `game.deps` still empty; `node --test src/lib/codegen.server.test.ts` (the 341-1 group) all green; `node scripts/quality-ratchet.mjs --all` with the new per-kind `surfaceOk` pins `enforced` |

**Ordering note (do not parallelize 3 and 5):** lane 5 changes prompt bytes, so it inherits lane 1's
vocabulary (a `service` brief's block must not tell the model it is a CLI). Lane 6 is last because it is
the only lane that changes what the **gate** demands; running it before lane 1 would make the gate demand
the wrong surface with full confidence.

---

## 4. Corrections (where a claim and the bytes disagree)

1. **My own W357 framing, corrected — the corpus masks the resolver on the eval path.**
   `scripts/run-eval.mjs:2122-2123` stamps `Project.kind` from the fixture front-matter via its own mapper
   (`:2082`), and `withDeliveryKind` is a no-op on an already-stamped project (`engine.ts:353-356`).
   Consequence: **no measured corpus emission was resolved by the keyword table**, and `research/eval-out`
   contains only the six `webapp` fixtures, so every eval-out record reads `kind: app` for a correct
   reason. W357's "the emitter writes a product shape the brief never asked for" is a **derivation from the
   resolver**, valid on the **CLI/keyless** path (`rapidtool-cli.mjs:1632` forwards no kind) — not an
   observed emission. The defect is real and its blast radius is the CLI path; the W359 resolver test must
   therefore resolve **from the brief alone** (§3.1C).
2. **`engine.ts:4073` → `:4074`.** Both the W358 plan (`wave_plans/W358/cartographer.md`) and my W357
   report cite `engine.ts:4073` for the `withDeliveryKind` call. At the pinned bytes `:4073` is the last
   comment line of the block and **`:4074`** is `p = withDeliveryKind(p);`. Same file mtime (15:36:55) at
   both readings, so this is an off-by-one in the earlier citation, not a moved byte.
3. **The mismatched-extension defect is 3 kinds wide, not `tool`-only.** `wave_plans/W358/close-kindjsx.md`
   and `357_fix_tests.md` describe a `kind:"tool"` emission. Measured (§1.2): **`tool`, `service` and
   `library` all emit `src/ui/console.tsx` under a tsconfig with no `jsx`.** Only `tool` was *observed*
   red because the 341-1 test's project is the one that materialises the 353 JSX pages.
4. **The cause of that defect is outside `close-kindjsx`'s ownership.** `briefedSiteFiles`
   (`scaffold.ts:5092`) has no kind gate; the tsconfig `jsx` decision is `scaffold.ts:984-1015`;
   `codegen.server.ts` has **no** tsconfig code (3 comment lines only). See §1.2.
5. **R-11's pin is arithmetically un-fireable at today's readings — the lane pinned it anyway, on the
   floors file's other honest mechanism, and said so.** `kindFit.game.surfaceOk` and
   `kindFit.library.surfaceOk` both read **0**; an `atLeast: 0` pin cannot fail at `floor − 1` (a count's
   structural minimum is 0, so a reading of `−1` is not producible), and the plant the plan asked for
   (`quality-ratchet.test.mjs:378`, and the lane's `%TEMP%\rt358_plants.mjs`) therefore proves the
   evaluator's arithmetic, not a catchable regression. The pin's real teeth are the fail-closed path,
   which I planted myself (§1.4): an unavailable reading on an `enforced` pin hard-fails all six
   `kindFit.game.*` metrics. **This is a weak bar in the wave plan, not a lane defect:** the lane's own log
   §7.2 and the pin's `nonRegressible` text both disclose that *"a decrease cannot move a count already at
   0 of 1"*. The honest phrasing of that done-when is *"each pin fails CLOSED when its producer stops
   producing, and must be re-pinned at the honest bar of 1 once a properly-stamped unit exists"*. See §1.1
   and §1.4.
6. **A canary that passed while its own explanation was false** (found by comparing two readings of the
   same tree). At **16:17**, after `errors.ts` landed at 16:16:49 but before `floors.json` was reconciled at
   16:23:13, `canary.errorCodes.owed-code-not-emitted` read **`ok:true`** with the reason *"owed and NOT yet
   emitted … src/lib/errors.ts is unowned this wave"* and `evidence.paid: []` — while
   `canary.errorCodes.registered` in the same run listed `RT_E_RATCHET_METRIC_UNAVAILABLE` in a
   **`codes: 57`** registry. A green canary whose stated justification had expired. The lane fixed it in the
   same wave (the reason now reads *"owed, PAID (verified in ERROR_CODES) and not emitted by this ratchet"*,
   with `unpaid: []`, `paidButUnregistered: []`), so this is a **correction the lane made, not a residual** —
   recorded because a canary's *message* is part of the register's honesty, and the message lagged the debt
   by one edit. **Query:** run `node scripts/quality-ratchet.mjs --all` between those two mtimes, or read
   `floors.json#owedCodes` now.

---

## 5. What I could not determine (stated plainly)

1. **Nothing material.** All three lane logs landed inside the window (`358_close_ui.md` 16:14:32,
   `358_close_kindjsx.md` 16:23:23, `358_close_taxonomy.md` **16:33:25** — the last one *after* I had
   measured every §1.1 verdict, which is the ideal ordering and is recorded in §1.1's last row). I read
   each log only after measuring its lane's bytes, so no verdict above leans on a log; where a log and the
   bytes agree I say so, and there is **no correction to record against any of the three lanes** (§4.1–4.6
   are corrections to *my own* earlier citation, to the *wave plan*, and to one mid-write canary message
   the lane itself fixed).
2. **Whether R-8's type-level half exists.** **RESOLVED at the 16:15:44 landing** — the pair is required in
   the bytes and the plant's `@ts-expect-error` is consumed (`TSC_EXIT=0`, §1.4). I record the original
   `0 hits` query here only because it is the query that framed the plant.
3. **The emitted trees' own `tsc`, per kind, independently.** `close-kindjsx` reports `app` 0 errors,
   `game` 1, `tool`/`service`/`library` 83 (180 declared-deps-only), from a repo-toolchain junction and a
   declared-deps-only junction. I did **not** re-run those (they wire `node_modules` junctions); I verified
   only the structural half myself (my extension/option table, §1.2) and the pin's unchanged red count
   (9/8/1). So the *numbers* in that row are the lane's, consistent with my structure; the *conclusion*
   (a non-web kind cannot compile what the emitter writes) is independently established by my table plus
   the react/`window` reads.
4. **Which driver legs record a P6 gate without `emittedSurface`** (§2f). I proved the seam is unwired (one
   hit, its own definition) and the direction of the error (false refusal), but I did not enumerate the
   concrete legs, so I state the hole and not its blast radius.
5. **Which writer produced the two mis-stamped records.** `testruns/*/brief.md` carries no `kind:`
   front-matter, so the stamp came from `withDeliveryKind` at an older table revision (W357's `level`
   hypothesis) or from a `testruns` driver I did not find. What **is** measured: the README's own Kind
   line proves `Project.kind === "game"` was **stored** (`scaffold.ts:8269-8270, :8351`), and today's
   classifier returns `app` for the same brief — so the record is a mis-stamp relative to the current
   resolver either way.
6. **Whether the 4 exit-documented codes' README cells are *true*.** I verified `README-cli.md` documents
   `RT_E_PLAN_UNDERPRODUCED` = 1, `RT_E_SRC_EDITED_DURING_RUN` = 1, `RT_E_SUBSTANCE_EMPTY` = 1,
   `RT_E_PATH_KIND_MISMATCH` = `1-4`. Whether each is emitted at exactly that class on the live CLI is the
   **site-scan** test's job (`cli-exit-taxonomy.test.mjs:309`) and it is green at the landed bytes, so the
   claim is consistent with the bytes — but I did not execute each code's live path.
7. **No whole-leg or gate verdict.** By instruction I ran no `bash scripts/gate.sh` and no `npm test`; the
   parent's boundary run remains the first frozen measurement. Every number above is a file- or
   leg-scoped command against the bytes at the mtime I state.

---

## 6. State at the pin (verification window 16:00–16:33; tree settled 16:26:27; HEAD `7c7f911`, dirty, 149 porcelain lines)

**`close-taxonomy` CONFIRMED** (`cli-exit-taxonomy.test.mjs` **62/62**, baseline `not ok 2`) — the
parity is now **derived from the README's own `typical exit_code` cell** (`exitClassOfCell:241`,
`documentedExitByCode:257`) in **both** directions, with an unreadable-cell assertion **and a third leg
pinning the README table to `ERROR_CODE_DOC` in both directions** (`:405-422`), which closes R-9's *cause*
and not just its symptom; the **17** `-` rows are the explicit **"no CLI arm" `null`** class and the **4**
exit-documented rows carry the doc's own exit (`PATH_KIND_MISMATCH` `[1,2,3,4]`, `PLAN_UNDERPRODUCED` 1,
`SRC_EDITED_DURING_RUN` 1, `SUBSTANCE_EMPTY` 1) — **no invented exit code** (`rapidtool-cli.mjs` never
touched) and **no README row deleted** (table 56 → **57**); `RT_E_RATCHET_METRIC_UNAVAILABLE` is registered
in **both** `ERROR_CODES` (`errors.ts:42`) **and** `ERROR_CODE_DOC` (`:573`) with `codes: 57` in the
canary registry, the owed-code canary now reads *"PAID (verified in ERROR_CODES) and not emitted"*, and
`floors.json#owedCodes` records the honest residual (no emitter site yet); both `kindFit` pins exist
(`floor 0`, `enforced`, `readingPinned`, `nonRegressible`) and the zero-pin canary accepts them, each
**failing closed** when its producer stops producing (my own plant: six `kindFit.game.*` metrics
`failClosed:true`) — with the plan's **"fails at floor−1" half PARTLY**, since a count at 0 has no
producible `−1`; and `lint.problems` is honestly re-pinned (`floor 0` **unchanged**, `pending-first-green`,
`reading 947 → 5`, my plant: 5 → `pending`, never `ok`, and `--all` still `ok:true` because a
`pending-first-green` pin is *reported*, not enforced) · **`close-kindjsx` PARTLY** — R-8's **type-level
half is CONFIRMED landed** (`compile-check.server.ts:610/:618` required, with a `@ts-expect-error` plant
whose prover is the repo's own compiler: `npx tsc --noEmit` **exit 0**; a reverting `?` would raise TS2578)
and `compile-check.server.test.ts` is **111 tests / 110 pass / 0 fail**, but the **class's fix is
correctly diagnosed, chosen and measured and NOT landed** — the extension/option mismatch is real for
**3 of 5 kinds** (`tool`/`service`/`library` emit `.tsx` with no `jsx`, and the 353 site writes
react-importing JSX into trees that declare no react), the deciding pin is still **9/8/1** (the pre-wave
count, no new red), and the cause (`scaffold.ts:5092 briefedSiteFiles` with no kind gate;
`scaffold.ts:984-1015 tsconfigJson`) is **across the ownership line**, which the wave's own file
allocation did not account for (§2h) · **`close-ui` CONFIRMED** — the **merge** is real
(`scaffold.test.ts` **139 tests / 139 pass / 0 fail**; `ok 1` binds ≥2 spec-derived fields, `ok 20`
A3-f07, `ok 26` A2-F5, plus `ok 2`/`ok 3` asserting the conjunction), the product **grew** rather than
shrank, the wrapper is syntactically safe and gated to the case with a real binding, and **R-10 is FIXED
for all four banner variants** (`scaffold.belowFloorBanner`, `software-export.redTreeBannerText`,
`headless.redTreeBanner`, `headless.underProducedBanner`) with all three Preview branches rendering the
true sentence and two negative controls behaving — the residual being that the new predicate is
*positional*, so a future writer that does not prepend at byte 0 is missed.

**Wave-level verification commands, all on the settled revision:**
`npx tsc --noEmit` → **exit 0** · `node --test scripts/cli-exit-taxonomy.test.mjs` → **62/62** ·
`node --experimental-strip-types --test src/lib/scaffold.test.ts` → **139/139** ·
`src/lib/compile-check.server.test.ts` → **110/111 pass, 0 fail, 1 registered skip** ·
`src/lib/codegen.server.test.ts` (341-1 group) → **8/9, 1 fail (the unlanded kindjsx fix)** ·
`node scripts/quality-ratchet.mjs --all` → **`ok:true` · 0 regressions · 0 canary failures ·
0 unavailableEnforced** · `--selftest` → **31/31 teeth, 35/35 enforced floors beaten**.

**The wave's deepest structural finding, and the reason W359 exists:** the campaign's "single source of
truth" for the delivery kind is **four resolvers** — `engine.ts:316` (the table), `dod.ts:900` (a
replicated row list **plus** a `KIND_GAME_RE` short-circuit at `:923`), `scaffold.ts:649` (a **third**
short-circuit, `BRIEF_GAME_RE`, plus a `switch` on the engine), and `run-eval.mjs:2082` (a fourth mapper
that deliberately returns *undefined* for `service`) — and the drift test that is supposed to stop this
(`dod.test.ts:848`) compares only two of the four, over nine hand-written briefs, none of them a corpus
brief. The mis-resolution is real and its routed cost is **two wrong products that can seal**
(`showing-booking` → a CLI for a bookings site; `coffeehouse2home` → a headless single module for a
webapp brief), while the third flipped brief (`arcade-breakout`) is saved by a duplicate regex rule that
is itself the defect. The corpus cannot see any of it: `kindFit` is 30 `app` + 1 mis-stamped bakery
stamped `game` + 1 mis-stamped mobile app stamped `library` + **0** `tool` + **0** `service`. The fix order
is forced — **one truth, then an honest corpus, then tell the model, then seal on the kind** — and it is
laid out as six lanes with a done-when each in §3.5, with the two verified couplings that make the order
non-negotiable: the corpus lane and the floors file must move together (or six enforced pins hard-fail),
and the seal lane must come last (it changes what the gate demands).

**The wave's deepest structural finding, and the reason W359 exists:** the campaign's "single source of
truth" for the delivery kind is **four resolvers** — `engine.ts:316` (the table), `dod.ts:900` (a
replicated row list **plus** a `KIND_GAME_RE` short-circuit at `:923`), `scaffold.ts:649` (a **third**
short-circuit, `BRIEF_GAME_RE`, plus a `switch` on the engine), and `run-eval.mjs:2082` (a fourth mapper
that deliberately returns *undefined* for `service`) — and the drift test that is supposed to stop this
(`dod.test.ts:848`) compares only two of the four, over nine hand-written briefs, none of them a corpus
brief. The mis-resolution is real and its routed cost is **two wrong products that can seal**
(`showing-booking` → a CLI for a bookings site; `coffeehouse2home` → a headless single module for a
webapp brief), while the third flipped brief (`arcade-breakout`) is saved by a duplicate regex rule that
is itself the defect. The corpus cannot see any of it: `kindFit` is 30 `app` + 1 mis-stamped bakery
stamped `game` + 1 mis-stamped mobile app stamped `library` + **0** `tool` + **0** `service`. The fix order
is forced — **one truth, then an honest corpus, then tell the model, then seal on the kind** — and it is
laid out as six lanes with a done-when each in §3.5.
