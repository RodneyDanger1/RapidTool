# 357 — cartographer: the W357 lane verification, the wave's regression map, and the sequenced kind-fidelity plan

**Lane:** W357 `cartographer` (the standing architecture + verification lane). **Wave:** W357 (green
recovery, wave 2). **Author:** this lane — this file is the only file it writes.
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (path contains a space). **Host:** Node **v24.15.0**,
Windows PowerShell 5.1.

**Pinned revision:** HEAD `30bce78b84903d2d64a84c4902c732f40bd14a29` (`main`), **dirty tree** — no commit
exists, so every number below describes **the bytes on disk**. **Verification window: 15:03–15:48,
2026-10-15.** Five sibling lanes wrote *during* this window; §0 records the pin and every re-read, and
each verdict carries the mtime of the bytes it judged. **Where a lane's log and the bytes disagree, the
bytes win and it is recorded as a correction (§4).**

**Constraints honoured:** no product/doc/script/register/other-lane file edited (my only write is this
file); no `bash scripts/gate.sh`; no keyed LLM call; no git write. Probe files live in `%TEMP%`
(`rt357_preview_probe.mjs`, `rt357_kind.mjs`, `rt357_tokens.mjs`, `rt357_plant.mjs`, `rt357_parse*.mjs`).
`npm run build` **was** run (it is this wave's P0 and the plan requires checking the built output);
`npm run lint` and the two test legs were run file- or leg-scoped.

---

## 0. The moving tree — what I pinned, and when

I first read the tree at **15:03** (no lane had landed: `fixes/357_*` did not exist, and every lane-owned
file still carried its pre-wave mtime). The wave's dispatch mtime is **15:02:47**. Lanes then landed
while I measured, so every verdict below is timestamped and every file whose bytes moved was re-read.

| File (owner lane) | mtime at final pin | landed during my window |
|---|---|---|
| `src/lib/db.ts` (fix-build) | **15:09:15** | yes |
| `scripts/rapidtool-cli.mjs`… *(not touched by fix-build)* | — | **no** |
| `vite.config.ts` (fix-build) | **10/3 16:29:05 — NOT edited** | **no** (the fix is db.ts-only) |
| `eslint.config.mjs` (fix-lint) | **15:06:46** | yes |
| `scripts/check-module-coverage.mjs` (fix-gates) | **15:16:28** | yes |
| `scripts/quality-ratchet.mjs` (fix-gates) | **15:21:43** | yes |
| `scripts/quality-ratchet.floors.json` (fix-gates) | **15:20:31** | yes |
| `scripts/quality-ratchet.test.mjs` (fix-gates) | **15:26:50** | yes |
| `scripts/typecheck-scripts.test.mjs` (fix-gates) | **15:29:23** | yes |
| `scripts/gate.sh` (fix-gates, additive-only) | **14:36:36 — NOT edited by this wave** | **no** |
| `src/lib/software-export.ts` / `.test.ts` (fix-preview) | **15:07:25 / 15:07:50** | yes |
| `RUNBOOK.md` / `AGENTS.md` / `README.md` / `scripts/README-cli.md` / `docs-FOLDER-MAP.md` (fix-preview) | **15:15:00 / 15:13:39 / 15:18:01 / 15:15:40 / 15:14:32** | yes |
| `START-HERE.md` (fix-preview) | **10/6 11:14:51 — NOT edited** | **no** (its counts already matched) |
| `src/lib/scaffold.ts` (fix-tests) | **15:33:22** | yes |
| `src/lib/engine.ts` (fix-tests' item-9 cause) | **15:36:55** | yes |
| `src/lib/scaffold.test.ts` / `wild-step.test.ts` / `headless.test.ts` (fix-tests) | **14:30:16 / 14:20:55 / 14:13:51 — NOT edited** | **no** |
| `scripts/gate-verdict.test.mjs` (fix-tests' items 3–7) | **15:32:53** | yes |
| `src/lib/codegen.server.test.ts` | **15:18:22** | **by an unknown writer — see §5.4** |

**Files that moved with no W357 marker and whose diff is not isolatable** (no commit separates them from
the W356 work; §5.4): `src/lib/engine.ts` **15:08:40** (a first touch *before* fix-tests' 15:36:55),
`scripts/fixes352-pipeline.test.mjs` / `scripts/rapidtool-cli-352.test.mjs` **15:08:38**,
`scripts/prevention/replay-harness.test.mjs` **15:08:48**, `src/lib/codegen.server.test.ts` **15:18:22**.
They carry **0** `357`/`W357` markers. I record them because a byte that changed inside my window is a
byte I judged mid-tree.

**Baseline I measured myself, before any lane landed:**
`npm run build` → **exit 1**, `[PARSE_ERROR] Expected a semicolon … migrations/auth/0001_auth.sql:1:10`
and `:1:11` / `Invalid Character '·'` on `0002_account_unique.sql:1:12` — the W356 boundary red
reproduced exactly. `node scripts/check-module-coverage.mjs` → **exit 1**, `131/140 … 7 stale allowlist
entries`. So the wave's inputs were the measured ones.

---

## 1. JOB 1 — adversarial verification of the five sibling lanes

Discipline: **a lane's log is never evidence for that lane's claim.** Every verdict cites the command I
ran against the bytes.

### 1.1 `fix-build` — **PARTLY** (the red is gone and the built output is clean of `.sql` modules; the
"migrations genuinely applied at runtime" half is **vacuous today**, and the fix has one disclosed side
effect the lane's comment denies)

| Claim | Verdict | The command / read that decided it |
|---|---|---|
| `npm run build` exits 0 | **CONFIRMED** | `npm run build` → `✓ built in 10.88s`, `i Generated .vercel/output/nitro.json`, `[migrate] DATABASE_URL not set — skipping (the PGLite fallback migrates itself).`, **`BUILD_EXIT=0`** (15:11 read, `src/lib/db.ts` mtime 15:09:15) |
| The root cause is the un-queried glob | **CONFIRMED** | at the baseline bytes, `src/lib/db.ts:183` was `import.meta.glob("/migrations/auth/*.sql")` **with no `query`** → Vite resolves each match as a JS module and rolldown parses SQL. `.sql` is in no `assetsInclude` (`vite.config.ts` has none) |
| No `.sql` in the built output | **CONFIRMED** for files, **REFUTED** for bytes | `Get-ChildItem -Recurse -File -Path .vercel,.output \| Where Name -match '\.sql'` → **0 files**. But `…/_ssr/0001_auth-C_H966CC.mjs` (3,071 B) and `…/_ssr/0002_account_unique-DFKBGiQn.mjs` (1,258 B) each carry the file's SQL **text** as a default export, and `…/_ssr/verify.server-CAT-BdGA.mjs:8771-8772` holds `"/migrations/auth/0001_auth.sql": () => import("./0001_auth-C_H966CC.mjs").then((m) => m["default"])` |
| Migrations genuinely applied at runtime via the PGLite fallback | **NOT DEMONSTRABLE — zero top-level migrations exist** | `Get-ChildItem -Recurse migrations -File` → only `migrations\auth\0001_auth.sql`, `0002_account_unique.sql`; `git ls-files migrations` → the same two. The eager applier globs `/migrations/*.sql` (`db.ts:172`), so the built bundle's eager map is **empty** — the only `/migrations/` map in the bundle is the auth one. The applier runs and iterates **nothing** |
| The 354 wave's persistent-PGLite-dir behaviour still holds | **CONFIRMED by read, UNEXERCISED** | `db.ts:39-42`, `:138-144` unchanged (only the auth glob's lines moved, `:176-190`). A runtime probe importing the built chunk fires the bootstrap — `IMPORT_OK` then `[db] PGLite bootstrap failed: ENOENT … _libs\pglite.data` — which is an artefact of running a `_vercel` chunk outside its deployment bundler, **not** a code finding; it cannot settle the question |
| `doctor` still returns `ok:true` | **not re-run** | out of my instruction set (no keyed call, no full gate); the lane owns it |

**Correction the bytes force (code comment vs bundle):** `db.ts:178-181` still says the keys-only glob
means "the opt-in auth SQL **never enters this path's bundle**". After `{ query: "?raw" }` it **does**
enter — as two lazy, never-called raw chunks (~4.3 KB). Functionally harmless (nothing consumes the
values; only `Object.keys(authSources)` is read at `:199`), but the comment now states the opposite of
the bytes. The **migration order** half of the plan's question is **clean**: `Object.keys()` returns the
same plain paths as before (the built map keys carry no `?raw`), so `authDirNames` — the copy-up
completeness input — is byte-identical, and `outOfOrderMigrations`/`pendingMigrations` (`db.ts:214-227`)
are untouched.

### 1.2 `fix-lint` — **CONFIRMED** (exit 0, the residual count is real, and no rule was weakened)

| Claim | Verdict | The command that decided it |
|---|---|---|
| `npm run lint` exits 0 | **CONFIRMED** | `npm run lint` → `✖ 5 problems (0 errors, 5 warnings)`, **`LINT_EXIT=0`** (15:12, `eslint.config.mjs` mtime 15:06:46) |
| The residual source-problem count is real | **CONFIRMED, re-derived independently of the lane** | `npx eslint src scripts --format json` → **errors=0 · warnings=5 · files=358**; all 5 in `scripts/quality-ratchet.mjs` (2 `no-unused-vars`) and `scripts/quality-ratchet.test.mjs` (3). `npx eslint "testruns/**" --no-ignore --format json` → **errors=51 · warnings=883 · total=934** over 173 files. Boundary total was 947 ⇒ implied source residual 13; measured source residual **5** (the 8-problem gap is unattributed — §5.3) |
| No rule was weakened to reach zero | **CONFIRMED — read the config diff** | `git diff -- eslint.config.mjs` → **one hunk**, adding exactly `"testruns/**"` to `ignores`, with its justification comment. **No** rule, plugin, `files` pattern, `@typescript-eslint/no-unused-vars` config, or `eslint-config-prettier` entry changed. `package.json`'s `lint` script is still `eslint .` |
| The ignore is justified | **CONFIRMED on the bar the plan set** | `git ls-files testruns` → **0** tracked files; the corpus is generated run output that the factory regenerates every run; linting emitted third-party-shaped trees is not a signal about this repo's source |

### 1.3 `fix-gates` — **CONFIRMED** (all five sub-claims, each with forked proof)

| Claim | Verdict | The command / plant that decided it |
|---|---|---|
| `moduleCoverage` green, `stale:[]`, no entry wrongly removed | **CONFIRMED** | `node scripts/check-module-coverage.mjs` → **exit 0**, `131/140 … 9 allowlisted · 0 unallowlisted gap(s) · 0 stale allowlist entries` (mtime 15:16:28). The guard's stale check is the **inverse** of reachability, so the 9 survivors being unreached (not stale) is the positive control that the BFS still discriminates; 0 `unallowlisted` ⇒ no reached module is unlisted. Spot-checked two claimed chains by read: `src/lib/auth/account-default.test.ts:18` → `await import("./verify.server.ts")`; `src/lib/auth/auth-import-contract.test.ts:12-19` documents the `server.ts`/`pglite-dialect.ts` loadability the entries used to lean on |
| R-3 — a floor must sit where a regression moves it | **CONFIRMED able to fire** | `node scripts/quality-ratchet.mjs --all` → `kindFit.app.{entryOk 29, scriptsOk 29, surfaceOk 10, demandedMatch 20}`, `kindFit.game.{entryOk,scriptsOk,demandedMatch} 1`, `kindFit.library.{…} 1`, `productQuality.{treesPresent,realModulesPresent} 25` — **every one `enforced` at floor > 0**. `--selftest` → `planted.every-enforced-floor-fails-when-beaten ok:true ("enforced numeric floors beaten: 35/35")`. My own plant: `compareFloor("atLeast",10,9)` → `regressed`, `(10,10)` → `ok` |
| R-4 — a zero-tree corpus can no longer be vacuous | **CONFIRMED able to fire** | `--selftest` teeth include `canary.census.corpus-is-pinned-has-teeth`, `…accepts-the-pinned-corpus`, `canary.census.job-scoped-reachable-checks-every-row`, `canary.census.whole-tree-reachable-checks-every-row`, `census.empty-corpus-fails-closed`, `census.shape-invalid-row-fails-closed-on-an-enforced-pin` — **31 teeth, 31/31 hold**. My own plant: `censusRealTreesReading({rows:[]})` → `{value:null, code:"RT_E_VALIDATION", reason:"the census corpus is empty …"}`; a shape-invalid row → `…is invalid on 1 of 1 pinned tree(s)` |
| R-5 — the owner-rule reader over `src/**`, at **zero false positives** | **CONFIRMED** | `--all` → `realProductOnly.repoTestDoubleImports` **0** (`atMost 0`, `enforced`), `realProductOnly.repoModulesScanned` **153** (`atLeast 153`, `enforced` — the vacuity floor), and the canary `canary.realProduct.repo-scan-discriminates` `ok:true` with `{clean:0, defect:2, defectKinds:["test-double-import"×2], resolvedHit:true, falsePositives:[]}`. **My own plant** (the bar is zero): `scanRepoTestDoubles([{path:"src/lib/planted-double.ts", source:'import { rows } from "./__mocks__/rows.ts";'}])` → **1 violation**, named; the same call on a clean production module → **0**; on a `*.test.ts` seam → **0** (correctly excluded) |
| R-8 — the optional `jobScoped?`/`wholeTree?` pair | **CONFIRMED able to fire** | **My own plant**: `censusShape({jobScoped: scope, wholeTree: scope})` → `[]`; `censusShape({jobScoped: scope})` → `["`wholeTree` is not reachable on the returned verdict (the reader's shape changed)"]`; the rename `whole_tree` → the same named reason; `substanceScopeShape({verdict:"nope",…}, "jobScoped")` → a named reason |
| The lane's own suites | **CONFIRMED** | `node --test … scripts/quality-ratchet.test.mjs` → **34 pass / 0 fail**; `scripts/typecheck-scripts.test.mjs` → **7 pass / 0 fail**; `scripts/check-module-coverage.test.mjs` → **7 pass / 0 fail**; `node scripts/quality-ratchet.mjs --all` → **`ok:true` · 48 metrics · 22 canaries · `regressions:[]` · `canaryFailures:[]` · `unavailableEnforced:[]`**; `--selftest` → **`selftestOk:true` · 31 teeth · 35/35** |
| JOB 4 — the owed `RT_E_RATCHET_METRIC_UNAVAILABLE` | **CONFIRMED as declared-not-invented** | the real run reports `canary.errorCodes.owed-code-not-emitted ok:true` with `owed:["RT_E_RATCHET_METRIC_UNAVAILABLE"]` noted as owed; the code list still carries **56** codes and does **not** contain it (`src/lib/errors.ts` mtime 10/6 — unedited, as its lane declared). The debt is armed, not silently dropped |

Note on the **`--all` reading is a real-tree measurement**: the mid-edit `--selftest` at 15:19 (my first
run, `quality-ratchet.mjs` 15:19:35) was **`selftestOk:false`** with two canary failures
(`canary.floors.atleast-zero-pins-are-accounted` naming 6 unaccounted pins, and `canary.registry.complete`
naming 5 undeclared canaries). Those are **gone** at the 15:21:43 revision — the same two canaries now
pass and the registry is complete. Recorded because a mid-write state is not a finding.

### 1.4 `fix-preview` — **CONFIRMED** on the bytes; the lane's *doc* edit introduced a real regression
(§2 R-9), which its own log does not report

| Claim | Verdict | The command that decided it |
|---|---|---|
| A below-floor run's Preview surfaces the tree **with** the banner | **CONFIRMED** | my probe (`%TEMP%\rt357_preview_probe.mjs`, importing `src/lib/software-export.ts` directly): below-floor → `emit_ok:true`, `redTree:"RT_E_PLAN_UNDERPRODUCED"`, **21 files**, `banner_leads_readme:true`, `banner_names_below_floor:true`, `entryPath:"index.html"` |
| …and returns a ZIP | **CONFIRMED** | same probe: `archive_ok:true`, `archive_bytes:123772`, `archive_filename:"fixture-software.zip"` |
| A differently-red run still returns the coded refusal with **no** archive | **CONFIRMED** | same probe, invented-figure case: `emit_ok:false`, `emit_code:"RT_E_VALIDATION"`, `fileCount:null`, `archive_ok:false`, `archive_bytes:0` |
| The opt-in is narrowly scoped (does not mask a *different* refusal) | **CONFIRMED — I planted the cross case the plan implies** | same probe, **both** (`underProduced` journal **and** the invented figure literal), which no lane's test covers: `emit_ok:false`, `emit_code:"RT_E_VALIDATION"`, no archive. The below-floor policy does **not** swallow the figure refusal |
| The lane's own suite | **CONFIRMED** | `node --experimental-strip-types --test --test-reporter=tap src/lib/software-export.test.ts` → **`# tests 13 · # pass 13 · # fail 0`** |
| Docs reconciled | **CONFIRMED they landed** | `RUNBOOK.md` 15:15:00 · `AGENTS.md` 15:13:39 · `README.md` 15:18:01 · `scripts/README-cli.md` 15:15:40 · `docs-FOLDER-MAP.md` 15:14:32; `START-HERE.md` untouched (its counts already matched — independently consistent). `README-cli.md` registry rows measured: **56** |
| …but the README registry edit broke a guard | **REFUTED as "no harm"** | **§2 R-9** |

### 1.5 `fix-tests` — **CONFIRMED** (3 of its attribution rows re-run by me; no assertion loosened)

The lane published a 13-row attribution table (`fixes/357_fix_tests.md` §3). I re-ran three rows, one
from each class it claims, plus the leg-level typecheck:

| Row (as the lane states it) | Verdict | My re-run |
|---|---|---|
| Rows 3–7 — `scripts/gate-verdict.test.mjs` fixture predates `gate.sh`'s additive `ratchet` stage; **CLOSED**, 19/19 | **CONFIRMED** | `node --test --test-reporter=tap scripts/gate-verdict.test.mjs` → **`# tests 19 · # pass 19 · # fail 0`** (was 14 pass / 5 fail in my 15:22 leg run) |
| Row 9 — `engine.ts fitLessonEvidence` split on `" · "`, which the P6 criterion itself contains ⇒ the class clause never landed; **CLOSED**, 25/25 | **CONFIRMED** | `node --experimental-strip-types --test --test-reporter=tap src/lib/lesson-writers.test.ts` → **`# tests 25 · # pass 25 · # fail 0`** |
| Row 11 — the 353 page→export matcher: `opening` was only a *value* of `hours`, so the derived page bound nothing; **CLOSED** (`scaffold.test.ts` 132/133) | **CONFIRMED** | `node --experimental-strip-types --test --test-reporter=tap src/lib/scaffold.test.ts` → **`# tests 133 · # pass 132 · # fail 1`**, the single red being exactly the declared residual `not ok 20 - A3-f07 / W-14` |
| Row 12/13 — two load-sensitive flakes, re-verified green | **not re-run by me** | stated as unverified — §5.5 |
| Leg-level typecheck | **CONFIRMED** | `npx tsc --noEmit` → **`TSC_EXIT=0`** (15:47) |
| No assertion loosened | **CONFIRMED** | `git diff -- scripts/gate-verdict.test.mjs`: **26 added** `assert` lines, **0 removed** (the one grep hit for a removed line is `const GATE_IDS = [… "assertionGaps" …]`, a refactor in which the stage list grew, not shrank). `ERROR_BUDGET` is `{}` and `scripts/typecheck-scripts.test.mjs:54` is untouched |
| R-7 — the reachable `assert.fail` at `scaffold.ts:6323/6396` | **CONFIRMED on the bytes** | `Select-String -Path src/lib/scaffold.ts -Pattern 'assert\.fail\('` now returns the **two residual sites the lane discloses** (the `no-oracle` `test.skip(...)` method form, which `compile-check`'s `maskSkippedTests` masks, and the un-compilable-fixture branch). The two unwired-row `else` branches now push comments only — I read them |
| Every skip is registered | **PARTLY — see §4.4** | `scripts/skip-registry.json` has **2** entries; my PowerShell lib-leg run reported **10** skips, **8** of them `bash is not installed on this host` — **not** in the registry. Under the gate's own shell (git-bash) those 8 do not fire (the boundary read `skipped:2`), so this is a host-dependent set, not a gate failure — but "every skip is registered" is **unconfirmed** for the shell I measured in |

---

## 2. JOB 2 — the W357 regression map

The plan named five shapes to look for. Each is answered first, then the two regressions the wave
actually introduced.

| # | The plan's shape to check | Finding |
|---|---|---|
| a | **An ignore that now hides a real source problem** | **NO real source problem is hidden today.** `eslint.config.mjs:21-27` adds `testruns/**`; `git ls-files testruns` → **0**; the 934 problems it removes are `51 errors + 883 warnings` over 173 generated files (`npx eslint "testruns/**" --no-ignore --json`), all of them emitted third-party-shaped trees. **Coupling to record, not a defect:** the ignore's safety is exactly the corpus's *untracked* status, and `fixes/356_0_boundary.md` §3.1 item 8 leaves the owner a live decision to **commit** the 325-file `testruns/` basis. If it is committed, this ignore silently exempts committed product bytes from `eslint .` — the one-line cost is `"testruns/**/*.generated.*"`-style scoping or a `.eslintignore` keyed to tracked-ness instead of to the directory |
| b | **A build fix that breaks the PGLite fallback or the migration order** | **NO.** §1.1: only `query:"?raw"` + `import:"default"` changed at `src/lib/db.ts:183-186`; `Object.keys()` is the sole consumer of the auth glob (`db.ts:199`), so the copy-up input is byte-identical; the eager applier (`:172`) and `pendingMigrations`/`outOfOrderMigrations` (`:214-227`) are untouched; build exit 0 and `db:migrate` ran. **Side effect the fix introduces (disclosed, benign, comment-denied):** the auth SQL now rides two lazy `?raw` chunks in the deploy bundle (~4.3 KB) — see §1.1 |
| c | **A removed allowlist entry that was still needed** | **NO.** §1.3: `0 stale` **and** `0 unallowlisted`, with 9 genuinely-unreached entries left in place — the guard's two checks are inverses, so a wrong removal would have surfaced as `unallowlisted` (a reached module with no entry) on the next run, and adding a wrong removal would have surfaced as `stale` now. Two chains re-derived by read |
| d | **A Preview opt-in that surfaces a tree a different refusal should withhold** | **NO on the scaffold policy** (my cross-case plant: below-floor **+** invented figure still refuses `RT_E_VALIDATION`, §1.4) — **but YES on the console**: the opt-in now surfaces a below-floor tree whose banner the UI's own predicate cannot read, and the UI then renders a sentence that is false. **R-10 below** |
| e | **A ratchet floor pinned where a regression cannot move it** | **PARTLY.** The atLeast-0 pins now carry moving sub-legs and 35/35 planted breaches are caught (§1.3). **But two real, already-failing readings remain prose-only:** `kindFit.game.surfaceOk` **0 of 1** and `kindFit.library.surfaceOk` **0 of 1** have **no pin at all**, and their `fit` floors stay `atLeast 0`. Query: `node scripts/quality-ratchet.mjs --all` → the game pins are `units 1, fit 0, entryOk 1, scriptsOk 1, demandedMatch 1` (no `surfaceOk`), the library pins are the same shape, and `kindFit.*.byKind` reports `surfaceOk:0` for both. **R-11 below** |

### R-9 (P0, wave-introduced) · `fix-preview`'s README registry-table expansion breaks the exit-taxonomy guard

`fix-preview` grew `scripts/README-cli.md`'s error-code table from **35 to 56 rows** (its own log row 12,
mtime **15:15:40**). `scripts/cli-exit-taxonomy.test.mjs` holds a **test-local** `EXIT_BY_CODE` map
(`:135`) and pins it to the doc table **in both directions** (`:263-281`). The 21 rows the doc gained have
no mapping, so the guard reds:

```
[node --test --test-reporter=tap scripts/cli-exit-taxonomy.test.mjs]
not ok 2 - exit taxonomy — EXIT_BY_CODE is exactly the README error table (both directions)
  location: 'scripts\cli-exit-taxonomy.test.mjs:263:1'
  error: README-cli.md's error table names code(s) with no EXIT_BY_CODE mapping — the exit class is unpinned
    + ['RT_E_CLAIM_UNVERIFIED','RT_E_DEFAULT_CHECK_BASELINE_LOST','RT_E_DUPLICATE_EXPORT',
       'RT_E_GIT_CODE_INCONSISTENT','RT_E_IMPORT_TOO_LARGE','RT_E_JSX_IN_TS','RT_E_MONEY_SEMANTICS',
       'RT_E_PATH_KIND_MISMATCH','RT_E_PLAN_UNDERPRODUCED','RT_E_README_PARITY','RT_E_REFUSAL_COVERAGE_LOST',
       'RT_E_SPEC_SKIP_VACUOUS','RT_E_SPEC_VACUOUS','RT_E_SRC_EDITED_DURING_RUN','RT_E_SUBSTANCE_EMPTY',
       'RT_E_SYNTH_DEFAULT_DISARMED','RT_E_SYNTH_RESAMPLE_UNBOUNDED','RT_E_SYNTH_RESUME_NOT_REUSED',
       'RT_E_UI_UNWIRED','RT_E_USE_BEFORE_DECL','RT_E_VERIFIED_PRODUCT_UNEVIDENCED']
    - []
# tests 62 · # pass 61 · # fail 1
```

**The 21 named codes are exactly the 21 the lane's log says it added** — the doc edit is the cause, and
the guard is the unedited side (`cli-exit-taxonomy.test.mjs` mtime **14:15:49**; `EXIT_BY_CODE` is a
test-local constant, not a product map — `Select-String -Path src/lib/errors.ts -Pattern 'EXIT_BY_CODE'`
→ **zero**). It was green at the W356 boundary, whose scripts reds the parent enumerated as the five
gate self-tests + the two `module-coverage` cases (none is `exit taxonomy`).
**The lane re-ran only `scripts/README-cli.test.mjs` (12 pass) — not the guard that pins the table it
edited.**

### R-10 · the console's Preview copy is false for the tree the new opt-in surfaces

`src/components/software-preview.tsx:246-252` decides "does the archived README carry the banner?" by
matching the **`redTreeBannerText` literal only**:

```ts
f.path === "README.md" && f.body.includes("RED TREE — surfaced below the build's own completion bar")
```

A below-floor tree carries the **scaffold's** banner instead (`> [!CAUTION]` / `## BELOW-FLOOR PLAN`,
`scaffold.ts:8549-8564`), so `redTreeReadmeBannered` is `false` and `:309-311` renders
*"The archive's README does not carry the caution banner for this withheld reason."* — while the archived
README **does** carry a `> [!CAUTION]` banner, for exactly that withheld reason. Deciding query: my probe
returns `banner_leads_readme:true` for the below-floor emit, and a read of that README finds no `RED TREE`
literal. One-line predicate in a component **no lane owns**; the lane disclosed it (`357_fix_preview.md`
§4.3) rather than fixing it. Not a claim that the Preview is wrong — the alert and the ZIP are correct;
**one sentence** is.

### R-11 · the ratchet still cannot go red for the two readings it can already see failing

`kindFit.game.surfaceOk` **0/1** and `kindFit.library.surfaceOk` **0/1** — a game product with no game
surface and a library with no usable runnable surface — are named in a `reason` string and **not pinned**;
`kindFit.{game,library}.fit` stay `atLeast 0`. `node scripts/quality-ratchet.mjs --all` shows no
`kindFit.game.surfaceOk` / `kindFit.library.surfaceOk` metric at all. A change that removed the game
surface *entirely* would still only be caught by `entryOk` (1) and `units` (1) — neither of which measures
the surface. This is the same class R-3 removed for `app`; for `game`/`library` the honest bar is still
prose. (Disclosed in the lane's log §3.1 as "named in the pin's `reason` instead of being floored at 0" —
correct as a statement about the fix, but it leaves the only two readings that are actually failing
unenforced.)

---

## 3. JOB 3 — the sequenced, file-level plan: make the factory deliver the best version of the REQUESTED kind

The W356 map found that **no synthesis prompt contains the delivery kind**. This section turns that into
a plan. Every "what is wrong today" claim carries the current `file:line`; every absence claim carries
its zero-result query.

### 3.1 The measured ground truth (all at the 15:48 bytes)

**The ONE decision exists and is single-sourced** — `engine.ts:316-345` `deliveryKindOf(project)`, read by
`scaffold.projectKindOf` (`scaffold.ts:649-663`), `dod.productSurfaceKindOf` (`dod.ts:920-926`),
`codegen.singleModuleLibraryKind` (`codegen.server.ts:6894-6905`) and `engine.uiKindOf` (`engine.ts:373`).
The gap is not plumbing; it is (i) the **classifier's own accuracy**, (ii) the **model never being told**,
and (iii) **three threaded-value holes**.

**Ground truth A — the classifier mis-resolves the corpus.** `DELIVERY_KIND_KEYWORDS`
(`engine.ts:219-241`) is an **ordered first-hit** table, and the `app` row (with `screen`/`screens`)
precedes the `game` row:

| corpus brief (declared kind) | `briefDeliveryKind` today | the row that wins, and on which token |
|---|---|---|
| `arcade-breakout` (`game`) | **`app`** | `app` on `screen, screens` (the brief's "win or lose screens") — the **only game corpus brief** |
| `showing-booking` (`webapp`) | **`tool`** | `tool` on `agent` (real-estate agents) |
| `coffeehouse2home-property-ledger` (`webapp`) | **`service`** | `service` on `service` |
| `invoice-csv-cli` (`cli-tool`) | `tool` ✓ | `tool` on `convert` |
| `order-webhook-service` (`service`) | `service` ✓ | `service` on `service, webhook, worker` |
| `date-rrule-library` (`library`) | `library` ✓ | `library` on `library, package, npm` |

Deciding command: `node --experimental-strip-types %TEMP%\rt357_kind.mjs` (imports `dod.briefDeliveryKind`)
and `%TEMP%\rt357_tokens.mjs` (the row/token). **Consequence is a shape change, not a label change**:
`singleModuleLibraryKind` returns `true` for `service`/`library`, so `coffeehouse2home` (a webapp brief
resolved to `service`) takes the **single-module** path and `showing-booking` (resolved to `tool`) takes
the tree — either way the emitter writes a product shape the brief never asked for. And for
`arcade-breakout`, `deliveryKindOf` says `app` while `projectKindOf` (`scaffold.ts:650`, `BRIEF_GAME_RE`)
and `productSurfaceKindOf` (`dod.ts:923`, `KIND_GAME_RE`) both say **game** — the ONE decision and the
emitter/gate disagree on the one brief that matters most.

**Ground truth B — the two non-`app` `kindFit` units are mis-stamps, so the corpus has NO honest game or
library case.** `research/eval-out/*` and `testruns/*/.rapidtool/project.json` recorded kinds:
`testruns/bakery-website/emitted` = **`game`** for a *"Golden Crust Bakery — Marketing Website"* brief
(its only game-ish token is the phrase **"field-level"**), and `testruns/mobile-companion/emitted` =
**`library`** for a *"Crumb & Bloom Companion — Mobile App"* (its only game-ish token is **"reorder
level"**). Both were stamped by an earlier resolver revision whose game row still carried the bare noun
`level` — the exact defect the `engine.ts:236-238` comment says was removed. A stored kind is never
re-derived (`engine.ts:353-356` returns the project unchanged), so the mis-stamp is permanent. Today's
classifier calls **both** `app`. Query: the `rt357_kind.mjs` tail (records vs today's classifier) and the
`"level"` hit listing.

**Ground truth C — the per-kind emitted shape does not match the per-kind file set.** `tsconfigJson`
(`scaffold.ts:984-1015`) grants `jsx` to **webapp** (`react-jsx`) and **game** (`preserve`) and to nothing
else, and `PKG_DEPS`/`PKG_DEV_DEPS` (`scaffold.ts:812-835`) declare React for **webapp only** — yet the
353 briefed-site path emits `.tsx` page modules for any kind. Measured: `codegen.server.test.ts:3198`
(a `kind:"tool"` emission) fails with **10 TS17004/TS6142** in `src/ui/pages/*.tsx` — the tree's own
declared `npm run typecheck` reds. This is `fix-tests`' R-UI-3, restated as the kind contract it is.

**Ground truth D — the three holes an honestly-resolved kind must be threaded through.**

1. **The CLI cannot request a kind at all.** `rapidtool-cli.mjs:1632` —
   `h.createProject({ brief: briefSource.value, name: args.name })` — **forwards no kind**, and the
   `create` arm never reads `args.kind`, although `"kind"` is registered (`:229`) and
   `headless.createProject` accepts `input.kind` (`headless.ts:503-513`). Query for the absence:
   `Select-String -Path scripts/rapidtool-cli.mjs -Pattern 'args\.kind'` → **0 hits**.
2. **The stamp only happens on the keyed seam.** `withDeliveryKind` has exactly one caller —
   `engine.ts:4073`, inside `upgradeP6Keyed`, behind `!isBareNodeHost()` (`:4058`) and
   `isDeepSeekConfigured()` (`:4062`). On the keyless/deterministic path `Project.kind` stays absent, so
   the emitted record carries no kind and every downstream resolver re-infers from the prose. Query:
   `Select-String -Path src/lib/*.ts -Pattern 'withDeliveryKind\('` → the definition (`engine.ts:353`),
   the doc comment, and the single call (`:4073`).
3. **The model is told `undefined`.** `headless.ts:6602` builds the wild planner's context as
   `` `Project: ${project.name} (kind: ${project.kind})` `` — on any unstamped run the planner literally
   reads `(kind: undefined)`. Same pattern in every prompt that interpolates the optional field.

**Ground truth E — the model is never told the kind, at either stage.** Zero-result queries:
`Select-String -Path src/lib/codegen.server.ts,src/lib/prompt-engine.ts -Pattern '\bkind\b'` returns only
`ArtifactKind` uses, the two routing checks (`:3307-3313`, `:6894-6905`) and **doc comments**;
`Get-ChildItem -Recurse -Include *.ts -Path src | Select-String -Pattern 'deliveryKind|delivery kind'`
returns only comments plus the chat tool taxonomy (`chat.server.ts:320`). The expansion prompt
(`prompt-engine.ts:313-330`) renders BRIEF → a fixed six-key field-rule list → policies → lessons; the
synthesis prompt (`codegen.server.ts:2335-2386`) renders BRIEF → REQUIREMENTS → NEGATIVE CONSTRAINTS →
EDGE CASES → DATA FLOW → ERROR HANDLING → DATA CONTRACTS → TYPE DEFINITIONS → **TYPE SIGNATURES**. **No
block in either names the delivery kind.**

### 3.2 The insertion points, ranked, with the context and the token budget

**Highest-leverage single point: `codegen.server.ts:2286` `p6SynthesisChunkUserPrompt`** — the one
context-assembly function whose bytes become *every* synthesis prompt (`p6SynthesisUserPrompt:2227`
delegates here; the tree path calls it at `:7864`, `:8039`, `:8296`; the single-module path at `:7119`).
`project` is already in scope at all four call sites (`:7119` passes `project.contracts`), so threading
the resolved kind is a signature change plus one block, with no new plumbing.

- **What must be added:** a `DELIVERY KIND: <app|game|tool|service|library>` block rendered
  **project-stable, immediately after `BRIEF:`** (`:2336-2337`) and **before** the per-chunk volatile
  `TYPE SIGNATURES` block, to preserve the cacheable prefix the D5/A8 ordering exists for
  (`:2327-2334`, `:2382-2386`) — otherwise `cachedPromptTokens` regresses to the measured 0-on-212-calls.
  The block carries the **kind's required surface contract in the imperative**, per §3.3.
- **Budget it needs:** the block is **~0.9–1.6 KB** (5 kinds × 2–4 imperative lines + one "the kind's
  surface is a deliverable, not an option" line). The relevant ceilings are
  `P6_SYNTH_PROMPT_MAX_CHARS = 60_000` (`:292`) and `P6_SYNTH_MAX_TOKENS = 32_000` (`:184`); the block is
  **~2.7% of the char ceiling**. Note the only *enforced* char budget today is the **prior-files** loop
  (`:2411`, `budgetLeft = P6_SYNTH_PROMPT_MAX_CHARS - lines.join("\n").length`), so the block must be
  inside `lines` (it will be) or the prior-files elision marker fires ~1.5 KB earlier than it should;
  `P6_BRIEF_MAX_CHARS = 48_000` (`:238`) and `P6_MODULE_MAX_CHARS = 60_000` (`:186`) are unaffected.

**The necessary second point: `prompt-engine.ts:419` `expandBrief` / `:262` `expansionPrompt`** — where
"spec expansion" happens. Adding a `kind` parameter (the signature is
`expandBrief(brief, policies, lessons)`) lets the spec's own field rules become kind-correct: a `game`
spec must emit `input/loop/canvas` requirements and a loop/render `typeSignatures` entry; a `tool` spec
must emit a `main(argv: string[]): Promise<number>` entry plus an exit-code edge case; a `service` spec
must emit a listen/readiness signature; a `library` spec must emit an importable public API and forbid
JSX. **Without this, the `TYPE SIGNATURES` the synthesis prompt demands stay kind-blind and no amount of
prompt-block text on the synthesis side can repair a signature list that never asked for a game loop.**
Budget: the expansion envelope is six fixed keys (`EXPANDED_SPEC_KEYS`, `:126-133`) — the kind must ride
as **prompt text, not as a seventh key**, or `expandedSpecViolations` (`:191`) and every cached
`implementationSpec` record must change shape. `EXPAND_BRIEF_MAX_CHARS = 48_000` (`:90`) with brief,
policies (`:91-92`) and lessons (`:100-101`) capped; the kind block is ~0.6 KB.

**The three threading holes to close, in order:**

1. `rapidtool-cli.mjs:1632` — forward `args.kind` (validated against `DELIVERY_KINDS`, `types.ts:31`)
   into `h.createProject`. One line; makes the requested kind *statable*.
2. `engine.ts:4073` — stamp earlier than the keyed seam (e.g. at `createProject`/the deterministic P6
   result) so keyless runs and the wild planner see a real value. **Do not** move the call out of
   `upgradeP6Keyed` without re-pinning `engine.test.ts`'s keyed-seam contract; the honest minimal version
   is `withDeliveryKind` applied wherever a project is **created**, keeping `:4073` as an idempotent
   re-stamp (it already returns the same reference when a kind is present, `:353-356`).
3. `headless.ts:6602` — print the **resolved** kind (`deliveryKindOf(project)`) rather than the raw
   optional field, so `(kind: undefined)` cannot reach a prompt.

### 3.3 Per kind — what the pipeline must do differently

| | **app** (webapp) | **game** | **tool** (cli-tool) | **service** | **library** |
|---|---|---|---|---|---|
| **Today's resolver says** | wins on `ui/dashboard/site/screens/…`; the **default** (`engine.ts:344`) | row `["game","play","arcade"]` at `:239` — **unreachable whenever the brief also names a screen/tab** (§3.1A) | row at `:233` — `cli/parse/convert/agent/script`; `agent` misfires on real-estate agents | row at `:240` — `api/service/webhook/worker`; `service` misfires on "customer service" | row **first** (`:220`) — `library/package/sdk/npm/module/statistics`; wins over everything |
| **Spec expansion (`expansionPrompt:313-330` + `prompt-engine.ts:126-133`)** must | demand ≥1 page noun + a nav path in `requirements`, and a `render<Page>`-shaped signature (the 353 path already synthesizes these — `codegen.server.ts:3307-3321`) | demand **input, loop, canvas** as three separate requirements and a `startGameLoop`/`renderFrame` pair in `typeSignatures` | demand an argv entry, a usage line, and ≥2 exit-code edge cases | demand a listen/readiness step and a shutdown edge case | demand an **importable public API** (named exports with types) and a shared `type X` — and forbid JSX |
| **Synthesis prompt (`codegen.server.ts:2286`)** must | state the web contract: entry `index.html` + `src/main.tsx`, a router/page surface, no game loop | state the game contract: keyboard **and** pointer input, a `requestAnimationFrame` loop, a `<canvas>`, pause/resume, win/lose | state: **no DOM, no React, no `.tsx`**; a `main()` entry that returns an exit code; deterministic output | state: a server entry that reads `PORT`, an honest readiness refusal, no UI | state: pure, side-effect-free exports; no DOM, no React, no `.tsx`; no filesystem writes |
| **Emitted entry shape (`scaffold.ts`)** | `index.html` + `src/main.tsx` (`ENTRY_PATH_RE`/`resolveTreeEntry` web branch, `acceptance-run.mjs:94-109`) | same web entry **plus** `src/main.ts` — the K9 probe contract (`pkg.main`, `index.html` → `/src/main.ts`, `assets/manifest.json`) | a real program entry (`pkg.bin`/`pkg.main`/`NON_WEB_ENTRY_FILES`) — **`resolveTreeEntry` falls back to the web requirement when `kind` is `undefined`/`null`** (`acceptance-run.mjs:108-109`), so an unstamped run demands `index.html` of a CLI | `src/main.ts` + `"start"` script (`scaffold.ts:866-873` is the only kind with `start`) | `src/main.ts`, **no** `dev`/`build` scripts |
| **Declared scripts (`scaffold.ts:843-874`)** | dev/build/preview/typecheck/test | dev/build/preview/typecheck/test | typecheck/test | typecheck/test/**start** | typecheck/test |
| **tsconfig (`scaffold.ts:984-1015`)** | DOM lib, `types:["vite/client","node"]`, `jsx: react-jsx` | DOM lib, `jsx: preserve` | `lib:["ES2022"]`, `types:["node"]`, **no jsx** | same as tool | same as tool |
| **The kind's required surface (the gate that must bind)** | `p6-web-surface` (`dod.ts:1431-1446`, `RT_E_UI_UNWIRED`): ≥1 page file **and** a nav path | `p6-game-surface` (`dod.ts:1450-1464`): input **and** loop **and** canvas | `p6-runnable-entry` (`dod.ts:1471-1485`, `RT_E_PLAN_UNDERPRODUCED`): non-stub entry **and** `missingDeclared.length === 0` | same as tool | same as tool |
| **The binding gap today** | binds — but `surfaceOk` is **10 of 30** (§3.1, `kindFit.app`) | the gate binds **only if the kind resolves**; it does not for `arcade-breakout`, and the emitted surface is 0/1 | binds only on a correctly-stamped record; `COARSE_KIND_LABEL` (`compile-check.server.ts:663-667`) and `tsconfigJson` disagree with the emitted `.tsx` page set (§3.1C) | same; `.tsx` pages again | `.tsx` pages again; and **`surfaceOk` is unpinned** for both game and library (R-11) |
| **Real corpus case today?** | **YES** — 30 emitted units (`testruns/*` + `research/eval-out/*`), all honestly `app` | **NO.** `arcade-breakout.md` (kind `game`) has **no** emitted tree, and the one `kindFit.game` unit is a mis-stamped bakery website | **NO emitted artifact.** `invoice-csv-cli.md` (kind `cli-tool`) exists and resolves to `tool`; `kindFit.tool` = `uncovered` | **NO emitted artifact.** `order-webhook-service.md` (kind `service`) exists and resolves to `service`; `kindFit.service` = `uncovered` | **NO honest case.** `date-rrule-library.md` (kind `library`) resolves to `library` but has no tree; the one `kindFit.library` unit is a mis-stamped mobile app |
| **Does it still fail its own `tsc`?** | **UNDETERMINED** | **UNDETERMINED** | **UNDETERMINED** | **UNDETERMINED** | **UNDETERMINED** |

**The `tsc` answer, stated honestly.** No emitted tree carries `node_modules` (`Test-Path
testruns/mobile-companion/emitted/node_modules` → `False`; same for `bakery-website/emitted`), so its
declared `"typecheck": "tsc --noEmit"` cannot run in place — a network install is the `emit --verify-kind`
opt-in. The ratchet's producer for this is `tree.tscPassSample`, which `fix-gates` **raised to
`atLeast 1`** and which reads `unavailable` (`RT_E_RUNNER_UNAVAILABLE`, opt-in) in every invocation I
made: `node scripts/quality-ratchet.mjs --all` → `tree.tscPassSample` still in `pendingFirstGreen`.
W356's pin recorded a **one-tree sample** reading of 1 — not a per-kind answer, and not re-derivable
today. So for **all five kinds** the honest verdict is: **the question is not measurable from the corpus
as it stands**; what *is* measured is that the two non-`app` trees which exist have `surfaceOk 0 of 1`,
and that a `tool`-kind emission is **provably** type-red (§3.1C).

### 3.4 The sequenced plan (the next wave's dispatch)

1. **Resolver accuracy (must be first — everything downstream inherits the wrong kind).** In
   `engine.ts:219-241`: (a) order the rows by **specificity, not by the list's history** — `game` and
   `library` before the broad `app` row, or make `app` a *default* rather than a row; (b) drop the bare
   nouns that fire on ordinary English (`agent`, `service`, `script`, `board`, `menu`, `level`-class
   words), or require ≥2 hits from a row; (c) add a regression test over `research/eval-corpus/*.md`
   asserting the declared `kind:` for all 10 briefs — today **3 of 10 disagree** (§3.1A). Guard it in the
   ratchet as a new metric on the pattern of `kindFit.*`.
2. **Re-stamp the two mis-stamped records** (§3.1B) or exclude them, so `kindFit.game`/`library` stop
   measuring a bakery site and a stock app. Add `kindFit.{game,library}.surfaceOk` pins (R-11).
3. **Thread the kind through the three holes** (§3.2, items 1–3): CLI `args.kind`, an earlier
   `withDeliveryKind`, `headless.ts:6602` printing the resolved kind.
4. **Kind-correct spec expansion** — `expansionPrompt`/`expandBrief` take the kind and make the six
   fields, especially `typeSignatures`, kind-appropriate (§3.2, second point).
5. **Kind block in the synthesis prompt** — the ~1 KB `DELIVERY KIND` block at
   `codegen.server.ts:2286`, project-stable, before the volatile signature block (§3.2, first point).
6. **Reconcile the emitted shape with the kind** — `tsconfigJson` (`scaffold.ts:984-1015`) and
   `PKG_DEPS`/`PKG_DEV_DEPS` (`:812-835`) must admit what the emitter actually writes, or the 353
   briefed-site path must be scoped to kinds with a runtime (this is R-UI-3, and it is a product
   decision: *may a `tool`/`service`/`library` emission ship a React `.tsx` site at all?*).
7. **Produce the missing kind cases** — emit `arcade-breakout`, `invoice-csv-cli`,
   `order-webhook-service`, `date-rrule-library` and record their trees, which is the only way
   `kindFit.{game,tool,service,library}` and `tree.tscPassSample` stop being `uncovered`/`unavailable`.

---

## 4. Corrections (where a lane's log and the bytes disagree)

1. **`fix-build`'s comment vs the bundle** — `src/lib/db.ts:178-181` says the auth SQL "never enters this
   path's bundle"; after `{ query: "?raw" }` it **does** (`0001_auth-C_H966CC.mjs`, 3,071 B;
   `0002_account_unique-DFKBGiQn.mjs`, 1,258 B). Benign (never called), but the stated invariant is now
   false (§1.1).
2. **`fix-preview`'s log omits the guard it broke** — its §3 claims doc reconciliation across 13 rows and
   §2.3 records `scripts/README-cli.test.mjs` 12/12, but never runs `scripts/cli-exit-taxonomy.test.mjs`,
   which its row-12 edit reds (§2 R-9). The wave's own plan required "re-derive every count you touch" —
   the count is right, its **pin** is not.
3. **The 13-vs-5 residual gap** — the boundary's 947 minus the 934 I re-derived inside `testruns/**`
   implies **13** source problems; the current tree carries **5** (`npx eslint src scripts --json`). 8
   source problems were fixed inside this wave by a lane that has not yet logged them as fixed (the
   `fix-lint` log was still a skeleton at its 15:21:39 mtime, so I cannot attribute them). Stated as
   unattributed rather than attributed.
4. **The skip registry vs my measured skip set** — `scripts/skip-registry.json` holds **2** entries; my
   PowerShell lib-leg run reported **10** skips (8 × `bash is not installed on this host`). Those 8 are
   host-conditional and do not fire under the gate's git-bash shell (the boundary read `skipped:2`), so
   "every skip is registered" is **unconfirmed in my shell** and not falsified under the gate's.
5. **A correction against my own first reading** — at ~15:19 I measured `node scripts/quality-ratchet.mjs
   --selftest` → `selftestOk:false` with `canary.floors.atleast-zero-pins-are-accounted` and
   `canary.registry.complete` failing. Re-run at 15:44 against `quality-ratchet.mjs` **15:21:43** →
   `selftestOk:true`, 31/31 teeth. The 15:19 reading was a mid-write artefact; §1.3 records the 15:44
   result, not the artefact.

---

## 5. What I could not determine (stated plainly)

1. **Whether the PGLite fallback actually applies a migration at runtime.** There are **zero**
   `/migrations/*.sql` files on disk, so there is nothing to apply and nothing to observe; the eager glob
   is empty **in the built bundle** (no `/migrations/` map other than the auth one). A planted top-level
   migration would settle it, and that is an edit to `migrations/**` — `fix-build`'s file, and outside my
   one-file scope. My bundle-import probe fired the bootstrap but died on a deployment-artefact `ENOENT`
   (`_libs\pglite.data`), which measures nothing about the code.
2. **The per-kind "fails its own `tsc`" answer** — §3.3: no emitted tree has `node_modules`, and the
   ratchet's producer is opt-in (`pending-first-green`). Not answerable from the corpus as it stands.
3. **Which lane fixed the 8 source lint problems** (§4.2) — the `fix-lint` log was a skeleton at its pin
   and the fix may also be a side effect of the W357 source edits (`engine.ts` 15:08:40, `scaffold.ts`
   15:33:22). I could not isolate it without a pre-wave snapshot of those files, which the dirty tree does
   not provide.
4. **The four unmarked writers** (§0): `src/lib/engine.ts` **15:08:40**, `scripts/fixes352-pipeline.test.mjs`
   and `scripts/rapidtool-cli-352.test.mjs` **15:08:38**, `scripts/prevention/replay-harness.test.mjs`
   **15:08:48**, `src/lib/codegen.server.test.ts` **15:18:22**. They carry no W357 marker; the diff vs HEAD
   is not isolatable because no commit separates the W356 work from this wave's. `engine.ts` moved twice
   (15:08:40 by an unknown writer, 15:36:55 by `fix-tests`).
5. **`fix-tests`' two flakes (rows 12/13)** were not re-run by me. I confirm they did **not** reproduce in
   my leg runs, but my leg runs also produced three *different* scripts-leg reds — so I cannot rule the
   flake class in or out; I only record that the same suite was green 209/209 when `fix-tests` ran it.
6. **`npm test` as a whole, `bash scripts/gate.sh`, and `scripts/rapidtool-cli.mjs doctor`** — all out of
   scope by instruction (the parent runs the boundary). I therefore have **no whole-leg verdict** and no
   final gate reading; the boundary is the first frozen measurement.
7. **The `scripts/**` leg's red count at my pin is inflated by the mid-flight tree and must not be read as
   a product verdict.** Measured at ~15:22: `scripts` **659 tests · 650 pass · 9 fail**; the 9 are
   `exit taxonomy` (R-9, real), `factory-watch.test.mjs:547/:636/:674` (3), and
   `gate-verdict.test.mjs` ×5. The `factory-watch` trio is a **concurrency artefact**: test 244 fails
   `expected 'RT_E_GATES_FAILED' · actual 'RT_E_SRC_EDITED_DURING_RUN'` — five lanes were editing `src/**`
   *while the factory e2e ran it*, and its in-run RUNLOCK guard correctly refused. `factory-watch.test.mjs`
   is **unedited** (mtime 10/6 11:05). The `gate-verdict` five are `fix-tests`' items 3–7, **now green**
   (19/19). The lib leg at the same pin: **4225 tests · 4210 pass · 5 fail · 10 skipped**, and each failure
   paired to its real owning suite (TAP `not ok` → `location:`, extracted from the log):

   | TAP | failing test | suite (`location:`) | `fix-tests`' row |
   |---|---|---|---|
   | 157 | `fixes/341-1 pre-seal self-typecheck gate` | `src/lib/codegen.server.test.ts:3133` | item 8 (residual R-UI-3, unclaimed) |
   | 446 | `E-25 — CLI machine contract (exit codes + envelope + doctor)` | `src/lib/headless.test.ts:2847` | item 12 (flake, re-verified green by the lane) |
   | 519 | `fixes/144 M5-1 + T-11 — the red-seal evidence digest … rides the seal log` | `src/lib/lesson-writers.test.ts:254` | item 9 (**now closed**, 25/25 — my leg predated the fix) |
   | 893 | `A3-f07 / W-14 — default emitted-UI generator` | `src/lib/scaffold.test.ts:1727` | item 10 (residual R-UI-1) |
   | 899 | `A2-F5 — spec-derived page set for a prose brief` | `src/lib/scaffold.test.ts:2710` | item 11 (**now closed** — my leg predated the fix) |

   **A frozen boundary run is needed for any leg verdict; this lane deliberately does not claim one.**

---

## 6. One-line state at the pin (15:48, HEAD `30bce78`, dirty)

`fix-build` **PARTLY** (build exit 0 and no `.sql` module in the output; but the auth SQL now rides two
lazy `?raw` chunks, and with **zero** top-level migrations "the PGLite fallback applies the migrations" is
vacuous today) · `fix-lint` **CONFIRMED** (exit 0 · 5 residual source warnings · one ignore added · no
rule touched · 934 corpus problems independently re-derived as 51 errors + 883 warnings) · `fix-gates`
**CONFIRMED** (moduleCoverage `0 stale`/`0 unallowlisted`; `--all` `ok:true` 48 metrics 22 canaries 0
regressions; `--selftest` 31/31 teeth, 35/35 floors beaten; R-3/R-4/R-5/R-8 each planted by me and each
fired; the `src/**` reader at 0 false positives) · `fix-preview` **CONFIRMED on both branches and the
cross case** (below-floor → bannered tree + 123,772-byte ZIP; invented figure → `RT_E_VALIDATION`, no
archive; below-floor **+** figure → still refused) · `fix-tests` **CONFIRMED** (3 of 3 spot-checked rows
re-run green, `tsc --noEmit` exit 0, 26 assertions added and 0 removed, every other edit in an owned file)
— with the skip-registration half **unconfirmed in my shell**.

**2 wave-introduced regressions mapped** — **R-9 (P0)** `scripts/README-cli.md`'s 35→56-row registry table
vs `scripts/cli-exit-taxonomy.test.mjs:263` (21 codes with no `EXIT_BY_CODE` mapping; the guard was green
at the boundary and the lane re-ran only the *other* doc test), and **R-10**
`src/components/software-preview.tsx:246-252`/`:309-311` (the console tells the user the archived README
carries no caution banner for a tree whose README leads with `> [!CAUTION]`). **1 disclosed floor gap
restated as a regression** — **R-11**: `kindFit.game.surfaceOk 0/1` and `kindFit.library.surfaceOk 0/1`
have no pin at all, so the two readings the ratchet can already see failing cannot move it.

**The highest-leverage kind-fidelity insertion point is `src/lib/codegen.server.ts:2286`
(`p6SynthesisChunkUserPrompt`)** — the one context-assembly function behind every synthesis prompt, with
`project` already in scope at all four call sites — carrying a ~1 KB project-stable `DELIVERY KIND` block
under the 60,000-char / 32,000-token P6 ceilings, **required second** by the kind-blind expansion prompt at
`src/lib/prompt-engine.ts:262`/`:419`; the three holes to thread are
`scripts/rapidtool-cli.mjs:1632` (no `kind` forwarded), `src/lib/engine.ts:4073` (the keyed-only stamp) and
`src/lib/headless.ts:6602` (`(kind: undefined)`). And the wave's deepest finding: **3 of the 10 corpus
briefs mis-resolve today (`engine.ts:219-241`, ordered first-hit), including the only game brief, and
neither of the two non-`app` `kindFit` units is an honest case at all** — so no kind except `app` has a
measurable corpus case, and no kind has a measurable "fails its own `tsc`" answer.
