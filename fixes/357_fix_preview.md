# fixes/357 — lane `fix-preview` (W357) — the console Preview + the drifted docs

**Wave:** W357 (green recovery, wave 2). **Lane:** `fix-preview`, 1 of 5 coding lanes.
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (path contains a space). **Shell:** Windows PowerShell 5.1.
**Host:** Node **v24.15.0** (repo `engines` contract `>=22`).
**HEAD:** `30bce78b84903d2d64a84c4902c732f40bd14a29` (`main`) — **dirty tree**; every number below
describes **the bytes on disk**, not a frozen commit.
**Owned files (mine alone):** `src/lib/software-export.ts` · `src/lib/software-export.test.ts` ·
`RUNBOOK.md` · `scripts/README-cli.md` · `START-HERE.md` · `AGENTS.md` · `README.md`.
Nothing else was edited.
**Log:** append-only; this lane is its only writer.

## §0 — Skeleton (written as one append AFTER the edits)

The wave convention is skeleton-first. On this lane the tree was already red and four sibling lanes
(`fix-build`/`fix-lint`/`fix-gates`/`fix-tests`) were editing concurrently, so the edits were made and
measured first and this file was written as a single append. Stated plainly rather than performed:
the "skeleton" below is a reconstruction, not a pre-edit artifact.

### Mission (quoted from `wave_plans/W357/fix-preview.md`)

1. **Fix the Preview at the cause.** `emitSoftware` must explicitly opt in to surfacing a below-floor
   tree (the banner policy) so a below-floor run shows the tree with its red banner and offers the ZIP,
   while a run red for any *other* reason still returns the coded refusal with no archive.
2. **Keep the CLI honest too.** Confirm the CLI's refuse/banner semantics agree with
   `scripts/README-cli.md` (default refuse; `--red-tree banner` surfaces).
3. **Reconcile the docs to the bytes** — the stale Preview claims, `AGENTS.md`'s false
   `resumeAccepted` residual, the count blocks, and the undocumented `RT_E_*` codes (document only what
   `ERROR_CODE_DOC` carries; report the rest — `src/lib/errors.ts` is not this lane's file).
4. **Re-derive every count you touch, with the command beside it.**

### Planned verification commands

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
node --experimental-strip-types --test --test-reporter=tap src/lib/software-export.test.ts
node --test --test-reporter=tap scripts/README-cli.test.mjs
npx tsc --noEmit
```

### Not run (hard constraints)

`bash scripts/gate.sh` · `npm run build` · full `npm test` · any keyed LLM call · any git write.
Probe files live in `%TEMP%\rt-preview-probe\` only.

## §1 — The defect and the fix (old→new bytes)

`fixes/356_restore_oracle.md` §5: `src/lib/software-export.ts:96` called `scaffoldProject(project)` with
no options. The 356 wave restored **`refuse` as the scaffold's safety default**, so a below-floor
project (`underProductionRefusalOf` non-null) made that bare call return
`ok:false · RT_E_PLAN_UNDERPRODUCED` — the console Preview dead-ended on the refusal and offered no ZIP,
instead of showing the tree the run actually produced.

| | old bytes | new bytes |
|---|---|---|
| the call | `result = scaffoldProject(project);` (`software-export.ts:96`) | `result = scaffoldProject(project, { underProduced: "partial" });` (`software-export.ts:104`) |
| why | (no options ⇒ the 356 `refuse` default) | the explicit banner opt-in: the scaffold LANDS the below-floor partial, prepends its own `> [!CAUTION]` / `## BELOW-FLOOR PLAN` banner (`scaffold.belowFloorBanner`) to the README, and reports `underProduced{code,detail}` |
| scope of the opt-in | — | **that ONE policy only.** Every other emission refusal is returned unchanged (`{ ok:false, error, code }`) and `buildSoftwareArchive` forwards it — no archive. |
| README banner | (never reached — refusal) | below-floor: the scaffold-owned banner. A red trail the scaffold did **not** banner (`p6.tree.failure`, or a partial synthesis): `emitSoftware` prepends `redTreeBannerText` itself (unchanged rule: never a duplicate caution) |
| docstring | `buildSoftwareArchive` said the below-floor refusal "is forwarded unchanged" | corrected: a below-floor run is **not** a refusal at this seam — its ZIP is offered with the bannered README inside |
| `EmittedSoftware.redTree` doc | "the scaffold lands it **by default**" | "landed under this seam's explicit banner opt-in" |

`scaffoldProject` was **not** touched (that file belongs to `fix-tests`/`fix-oracle`); nothing was
deleted or weakened, and the **refused-run file count was not raised** — the refusal is a safety policy
the CLI still honors, and the Preview opts in instead.

## §2 — Measured results (before/after)

### 2.1 The unit seam — `src/lib/software-export.test.ts`

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
node --experimental-strip-types --test --test-reporter=tap src/lib/software-export.test.ts
```

| | tests | pass | fail | the failure |
|---|---|---|---|---|
| **before** (sibling's measurement, `fixes/356_restore_oracle.md` §5) | 10 | 9 | **1** | `not ok 1 - emitSoftware · error: 'the tree is surfaced rather than withheld'` (assertion at `software-export.test.ts:88`) |
| **before** (re-derived here, at the cause) | — | — | — | probe: `scaffoldProject(belowFloorRun)` with **no options** → `ok:false` (`A default ok: false`) |
| **after** | 13 | **13** | **0** | — |

The 10 → 13 growth is the three cases this lane added: the other-reason refusal (§2.2), the ZIP branch,
and the no-archive branch. Final TAP tail: `# tests 13 · # suites 5 · # pass 13 · # fail 0 · # skipped 0`.

### 2.2 BOTH branches, measured through the seam

`%TEMP%\rt-preview-probe\probe.mjs` (keyless, no repo writes) + the two new test cases:

| branch | project | scaffold call | `emitSoftware` | archive |
|---|---|---|---|---|
| **A — below-floor, banner policy** | the measured Bloedow shape (a recorded `RT_E_PLAN_UNDERPRODUCED` refusal + real substance) | `{ underProduced: "partial" }` → **`ok:true`**, `underProduced{code,detail}` | **`ok:true`**, `redTree{code:"RT_E_PLAN_UNDERPRODUCED"}`, README leads with `> [!CAUTION]` + names `BELOW-FLOOR PLAN`, `entryPath:"index.html"` | **`ok:true`** — a real ZIP whose archived `README.md` carries the same banner |
| **B — red for ANOTHER reason** | a withholding brief whose emitted module authors `priceCents = 1250` (scaffold `declare-or-strike`) | `{ underProduced: "partial" }` → **`ok:false`, `code:"RT_E_VALIDATION"`** | **`ok:false`**, `code:"RT_E_VALIDATION"`, `error` matches `/withholds prices\/awards\/addresses/` | **`ok:false`** — no `bytes`, no `fileCount` |

Branch B is the proof the opt-in is **narrowly scoped**: the same seam that surfaces a below-floor plan
still refuses a different defect, coded, with no archive. (Probe output, raw:
`B optin ok: false | code: RT_E_VALIDATION | err: RT_E_VALIDATION · brief withholds prices/awards/addresses but the emitted scaffold authored a figure literal: src/jobs/d…`.)

### 2.3 Everything else re-run

```powershell
node --experimental-strip-types --test --test-reporter=tap src/lib/preview-render.test.ts   # 4 pass / 0 fail
node --test --test-reporter=tap scripts/README-cli.test.mjs                                  # 12 pass / 0 fail (incl. "README-cli.md documents emit's --red-tree policy")
npx tsc --noEmit                                                                             # exit 0
node scripts/docs-module-parity.mjs                                                          # missingCount 2 (unchanged), uniquePaths 68
```

`preview-render.test.ts` is the other consumer of `emitSoftware`; it stays green. `docs-module-parity`
was run because this lane edited docs: it reports the **same 2** pre-existing missing claims
(`src/generated.ts` claimed by `RESUME.md`/`remainingwaves.md`/`taskuniverselog.md`;
`src/ui/console.tsx` claimed by `scripts/README-cli.md`) and 0 empty — this lane's edits added paths
(61 → 68 unique) but no mismatch.

### 2.4 The CLI's refuse/banner semantics — CONFIRMED, no edit

`scripts/README-cli.md`'s refuse/banner section (the `--red-tree <refuse|banner>` block and the
"below-floor" notes in the `emit` section) was checked against the bytes and **agrees**:

- `src/lib/headless.ts:2809` — `const redTreePolicy = opts.redTree ?? "refuse";` and the coded
  `RT_E_TREE_RUN_FAILED` refusal returns **before** the scaffold/dir/lock/any write (`:2811`);
- `scripts/rapidtool-cli.mjs:2605-2613` rejects any other `--red-tree` value with `RT_E_VALIDATION`;
  `:2738-2751` stamps `redTreeBanner`/`redTree` and `underProducedBanner`/`underProduced` on the
  envelope; the post-write floor seal (`:2932-2940`) keeps `RT_E_PLAN_UNDERPRODUCED` as the deciding code;
- `headless.ts:2843-2846` forwards `underProduced: underProducedPolicy === "banner" ? "partial" : "refuse"`.

So the CLI default is refuse, `--red-tree banner` surfaces with the banner, and the delivered partial
never reads as clean — the doc and the bytes match. **No text change was needed**, which is the
`restore-oracle`-measured behaviour reproduced by reading the arms.

## §3 — Doc claims reconciled (one row per claim)

`claim | where | bytes | command | old → new`

| # | claim | where (line numbers at HEAD `30bce78`, dirty) | bytes | command | old → new |
|---|---|---|---|---|---|
| 1 | Preview's below-floor mechanism | `RUNBOOK.md` §6a | `src/lib/software-export.ts:104` | `Select-String -Path src/lib/software-export.ts -Pattern 'underProduced: "partial"'` | "re-runs `scaffoldProject` with `allowUnderProduced: true`, prepends the **RED TREE** banner (`redTreeBannerText`)" → "calls `scaffoldProject(project, { underProduced: \"partial\" })`; the **scaffold's own** `> [!CAUTION]` / `## BELOW-FLOOR PLAN` banner (`scaffold.belowFloorBanner`) leads the README; `redTreeBannerText` is used only for a red trail the scaffold did not banner" |
| 2 | Preview is non-inert for a below-floor run | `RUNBOOK.md` §9 item 7 | same seam + the tests in §2 | `node --experimental-strip-types --test --test-reporter=tap src/lib/software-export.test.ts` | "the unmissable **RED TREE** banner" → "the unmissable `> [!CAUTION]` / `## BELOW-FLOOR PLAN` banner" (+ mechanism re-verified 2026-10-15) |
| 3 | `resumeAccepted` "not yet consumed by codegen" | `AGENTS.md:355` (was `:346-347`) | **7** hits | `(Select-String -Path src/lib/codegen.server.ts -Pattern 'resumeAccepted').Count` → `7` | "**not yet consumed by codegen** (`… = 0`)" → "**IS consumed by codegen** (7 hits, incl. `resumeByPath` at `:7607-7641`)" |
| 4 | "Every surfaced failure carries a code from `src/lib/errors.ts`" | `AGENTS.md:104-113` (honesty contract #4) | `ERROR_CODE_DOC` = **56** codes; **12** live-raised codes absent from it | `node -e` diff of `ERROR_CODES` vs every `RT_E_*` literal in non-test `src/**`+`scripts/**` | claim left standing **for CLI envelopes** + a measured note naming the 12 unregistered codes (registry migration owed to `fix-gates`) |
| 5 | count block | `AGENTS.md` `### Tracked counts (… 2026-10-05 at 2f0e3d7)` (`:252-259`) | total 2,088 · src 262 · src/lib 250 (132+118) · scripts 152 · fixes 783 · wave_plans 139 · research 476 · root 42 | `(git ls-files).Count`, `(git ls-files src).Count`, `(git ls-files src/lib).Count`, `(git ls-files "src/lib/*.test.ts").Count`, `(git ls-files scripts).Count`, `(git ls-files fixes).Count`, `(git ls-files | Where-Object { $_ -notmatch '/' }).Count` | 2,014 / 256 / 244 (129+115) / 107 / 761 / 41 → the new block at `AGENTS.md:511` (appended; the dated 2026-10-05 snapshot is named as superseded) |
| 6 | count block | `README.md:454-462` | same numbers | same commands | 2,014 / 256 / 244 / 107 / 761 / 139 / root 41 → 2,088 / 262 / 250 (132+118) / 152 / 783 / 139 / root 42 |
| 7 | catalog heading "2,014 today" (+ its TOC anchor) | `README.md:614`, `:38` | 2,088 | `(git ls-files).Count` | "(2,014 today)" → "(2,088 today)"; the TOC anchor fragment `…-1391-today` → `…-2088-today` |
| 8 | §10.1 census table | `README.md:631-654` | per-area `git ls-files <dir>`; the rows sum **exactly** to the total | `(git ls-files -- <dir>).Count` for all 22 areas | fixes 761→783 · src 256→262 · scripts 107→152 · root 41→42 · Total 2,014→2,088 (research/.grok/builds/vault-e2e/screenshots/public/etc. re-measured **unchanged**) |
| 9 | "Root files (all 41 tracked — named)" | `README.md:655` | **42** root files; `LAUNCH.md` was tracked but unnamed | `git ls-files \| Where-Object { $_ -notmatch '/' }` | "all 41 … named" → "all 42 … named" + a `LAUNCH.md` row |
| 10 | §10.6 `src/lib/` count | `README.md:739` | 250 = 132 non-test + 118 tests | `(git ls-files src/lib).Count` / `(git ls-files "src/lib/*.test.ts").Count` | "244 files = 129 non-test + 115 colocated tests; re-derived 2026-10-05" → "250 files = 132 non-test + 118 …; re-derived 2026-10-15" |
| 11 | count block | `docs-FOLDER-MAP.md:18-20` | total 2,088 · src 262 · src/lib 250 · scripts 152 · fixes 783 · wave_plans 139 · research 476 · root 42 | same commands as #5 | 1,933 (2026-10-03 block: 250/239/49/744) → a new 2026-10-15 re-count block naming the 1,933 block as stale |
| 12 | registry table = "the full registry, one row per code" | `scripts/README-cli.md` registry table (was `:1425-1461`) | `ERROR_CODE_DOC` = 56 codes; the table had **35** rows → **21** registry codes had no row | `node -e` diff of `ERROR_CODES` vs `^\| \`RT_E_…\`` table rows | 35 rows → **56 rows** (+ the 21 missing: `PATH_KIND_MISMATCH`, `IMPORT_TOO_LARGE`, `SUBSTANCE_EMPTY`, `PLAN_UNDERPRODUCED`, `DUPLICATE_EXPORT`, `USE_BEFORE_DECL`, `MONEY_SEMANTICS`, `README_PARITY`, `SRC_EDITED_DURING_RUN`, `UI_UNWIRED`, `SPEC_SKIP_VACUOUS`, `SPEC_VACUOUS`, `CLAIM_UNVERIFIED`, `GIT_CODE_INCONSISTENT`, `SYNTH_DEFAULT_DISARMED`, `SYNTH_RESAMPLE_UNBOUNDED`, `REFUSAL_COVERAGE_LOST`, `SYNTH_RESUME_NOT_REUSED`, `JSX_IN_TS`, `VERIFIED_PRODUCT_UNEVIDENCED`, `DEFAULT_CHECK_BASELINE_LOST`) + a re-derivation note |
| 13 | count block | `START-HERE.md` 2026-10-06 block | identical to this lane's re-derivation | same commands as #5 | **no edit** — START-HERE already holds total 2,088 · src 262 · src/lib 250 · scripts 152 · fixes 783 · wave_plans 139; this lane's independent re-derivation matches it exactly |

Notes on the two registry-shape edits (row 12): `meaning`/`agentAction` text is taken from
`ERROR_CODE_DOC` (the registry is canonical, `src/lib/errors.ts` is **not** this lane's file), and the
`typical exit_code` cell is a **domain label** rather than an invented number — `— (guard
`expectedCode`; `scripts/guards/*`)` for the 12 guard-asserted codes (verified by locating each code's
raising sites: only `scripts/guards/**` + `scripts/prevention/cassettes/**`), `1–4 (classified in
place — EISDIR/ENOTDIR)` for `PATH_KIND_MISMATCH` (the classifier maps that errno family,
`errors.ts:362-372`), and `— (engine domain)` for the engine-only codes. The three codes that DO reach a
CLI envelope (`SUBSTANCE_EMPTY`, `PLAN_UNDERPRODUCED`, `SRC_EDITED_DURING_RUN`) carry the exit the
`emit`/`run`/`tree-run` arms already document.

## §4 — Not re-derived, unverified, and cross-lane follow-ups

1. **The "before" 9/10 suite reading is the sibling's** (`fixes/356_restore_oracle.md` §5), not this
   lane's; this lane re-derived the *branch* instead (`scaffoldProject(project)` with no options returns
   `ok:false` for the below-floor project) rather than the pre-fix test file, which no longer exists on
   disk.
2. **The audit's "13 undocumented `RT_E_*` codes" is 12 by this lane's scan**, and the audit's own
   breakdown sums to 11 (4 `selfmod.ts` + 4 `runlock-preflight.mjs` + 2 `readme-parity.mjs` +
   1 `factory-watch.mjs`). Measured here: **12** — those 11 plus `RT_E_CASSETTE_MISS`
   (`src/lib/cassette.ts`). Scan scope: `RT_E_*` string literals in non-test `.ts`/`.mjs`/`.js` under
   `src/**` + `scripts/**`, diffed against `ERROR_CODES`; a dynamically-built code string would be
   invisible to it, so 12 is a **lower bound**. `fixes/355_0_audit_wave.md`'s figure is not reproducible
   as written; this lane's higher-resolution reading is what `AGENTS.md` #4 now carries.
3. **Cross-lane residual (NOT this lane's file): `src/components/software-preview.tsx:246-252`.** The
   Preview's alert keys its copy on the literal `"RED TREE — surfaced below the build's own completion
   bar"` (`redTreeBannerText`). A below-floor README carries the scaffold's `BELOW-FLOOR PLAN` banner
   instead, so `redTreeReadmeBannered` is `false` and line `:311` renders *"The archive's README does
   not carry the caution banner for this withheld reason."* — which is **false**: the archived README
   does carry a `> [!CAUTION]` banner (the below-floor one, for exactly that withheld reason). The
   console itself is honest (it shows the `red tree — below the build's completion bar` alert and the
   ZIP button); only that one sentence is wrong. Fixing it is a one-line predicate in a component this
   lane does not own.
4. **Not run:** the full `gate.sh`, `npm run build`, `npm test`, any keyed call, any git write (hard
   constraints). The sibling lanes (`fix-build`/`fix-lint`/`fix-gates`/`fix-tests`) were editing other
   files concurrently; the suites in §2.3 were run against those bytes and no transient red was observed
   in the files this lane touched.
5. **The `typical exit_code` cells added in row 12 are domain labels, not measured exit codes** — the
   12 guard codes and the engine-only codes have no CLI arm, which is itself the measured fact; I did
   not run a CLI invocation per code.
