# fixes/356 — the W356 boundary wave log (green recovery + ratchet)

**Lane:** W356 parent (this session). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`.
**Host:** Node **v24.15.0** (contract `>=22`). **HEAD:** `30bce78` (`main`), **dirty tree** — no commit
was made, so every number describes the bytes on disk.

**Wave:** 6 lanes (5 coding + 1 cartographer), dispatched from the W355 audit ledger
(`fixes/355_0_audit_wave.md`) with the owner's three design decisions applied. **Zero keyed spend.**

---

## 0. What the wave was for

The audit wave (W355) proved the tree was red for reasons deeper than a broken test: a reader change had
doubled the substantive-tree rate with no product change and disarmed prevention guard C-06, an oracle
emitter made partial emissions fail their own tests, and `underProduced:"refuse"` did not refuse.
W356's job was to restore an **honest** baseline (all four gates green) and to build the **ratchet** that
makes every later "it improved" claim falsifiable.

**Owner decisions applied:** keep the 354 wave's intent (partials may still land, honestly labelled);
restore refuse-as-default; keep the honesty of a surfaced unwired row while removing its unavoidable red;
**publish two distinctly named census readings** so no single number can be moved by editing a reader.

**Owner directives folded in as invariants:** `realProductOnly` (no mock/stub/fake/demo code on any
production path) and `kindFit` (the requested **kind** must reach synthesis, emission, the toolchain and
the gates, and the artifact is measured against that kind).

---

## 1. Lane results (landed)

### `restore-census` — CONFIRMED (cartographer re-derived it independently)
- Census restored and **split into two named readings**: the bare top-level
  `stubs`/`reexports`/`real`/`files`/`verdict` are back to the **job-scoped** reading (= HEAD,
  byte-identical), with the 354 wave's whole-tree reading preserved as `wholeTree`. Both of the new
  `TreeSubstanceReading` shape (`compile-check.server.ts:576-613`, `:810-870`).
- **13-tree corpus re-derived twice** (lane + cartographer): job-scoped literal `real` **6/13**,
  `empty` **7/13**; `wholeTree` non-empty 13/13. A scaffold-only tree reads `empty` at the top level
  again. **No product byte moved.**
- **C-06 fires again**: harness `ok:true`, `missed:[]`, `pending:[]` — without editing `scripts/**`,
  because the field its driver reads (bare `substance.verdict`) was restored rather than renamed.
- **Refuse/banner probe (keyless):** `refuse` (default) → `ok:false`, `RT_E_PLAN_UNDERPRODUCED`, target
  dir **never created** (zero files); `banner` → 21 files landed with the below-floor banner; the
  scaffold-only tree reads `empty` at the top level.
- `npx tsc --noEmit` → **exit 0** (was exit 2). `headless.test.ts` **209/209** (the drifted `:5999` case
  fixed as test-wrong: `(res.steps ?? 0) >= 1`). `compile-check.server.test.ts` 110 · 109 pass · 1 skipped.

### `restore-oracle` — PARTLY (its behaviour is confirmed; its own suite still has reds)
- **Unwired row semantics changed at the cause**: `test("<id>", () => assert.fail("…"))` →
  `test("<id>", { skip: "<marker>" }, () => {})`, with the shortfall **counted and surfaced in three
  places** (emitted spec header, README census, DEPLOY.md/Commands). Every wired row's assertion is
  byte-unchanged; no assert sits in a skip body.
- **Policy**: explicit string wins → legacy `allowUnderProduced` → else **`refuse`**; `"banner"` accepted
  as the CLI spelling of `"partial"`.
- **Measured, keyless:** a partial with 1 unwired row of 6 → `treeRun.ok:true`, the emitted tree's own
  `npm test` **exit 0** (`pass 10 / skipped 1`), `tested.promoted:true`; **before** the change the same
  tree was `exit 1`, `fail 1`, `treeRun.ok:false`. A complete emission → 15/15. `tsc --noEmit` exit 0
  (both `gameTemplate` cases fixed as test-wrong).
- **Reported, not fixed (no owner in this wave):** `src/lib/software-export.ts:96` calls
  `scaffoldProject(project)` with no options, so the restored refuse default now **breaks the console
  Preview for below-floor runs** (`software-export.test.ts` 9/10). Also makes `RUNBOOK.md` §6a/§9.7 stale.
- **Reported, pre-existing, not theirs:** two UI-generation reds in `scaffold.test.ts`
  (`:1771`, `:2762`) traced to `scaffold.ts:8915-8952` (351/353 site precedence), byte-identical to the
  audit baseline; plus cartographer's note that a second gate (`RT_E_SPEC_SKIP_VACUOUS` at `:8284`) can
  still redden the "green while reporting" boundary.

### `restore-guards` — CONFIRMED
- Harness: `{"ok":true,"guards":34,"count":34,"countFloor":34,"missed":[],"pending":[],"skipped":[],
  "canaries":{"ok":true,"checked":["C-06","C-14"],"violations":[]}}`. Old→new: `missed:["C-06"] → []`,
  `pending:["C-14"] → []`.
- **C-06** re-keyed on the **declared path** `jobScoped.verdict`; the bare alias is now a **checked
  contract**. Fires on 7/13 trees with a clean control.
- **C-14** unblocked: its "keyless floor" control was `{...office-stock-tracker/build.json,
  generatedTree:[]}`, whose logs carry 8 `p6.synthesis.*` rows (newest `refused`), so the fail-closed
  probe returned `false` for the control too and `mutationRed` was unreachable. Rebuilt from the same
  real bytes minus every synthesis row, read through the real reader. Fixed at
  `gate-invariants.test.mjs` too (**13/13**, was 12 pass / 1 fail).
- **Canary added** (a registered `RT_E_VALIDATION` reason, so no undocumented code was minted). Proven on
  two planted defects: key field **renamed away** → `ok:false`, `problem:"key-field-missing"`; alias
  **re-pointed at the whole-tree census** (the exact A2-F3 defect) → `problem:"key-field-alias-repointed"`.
  Both pinned in tests.
- **No guard weakened, deleted, or satisfied by editing a fixture**: cartographer independently confirmed
  no tracked cassette modified and **0 files under `testruns/` edited** after 14:09.
- **Owner decision escalated (README claim vs bytes):** `scripts/prevention/README.md:34-39` claims the
  fixtures are "tracked in the repo" and the harness is "green on a clean checkout"; bytes:
  `git ls-files testruns` → 0, `?? testruns/` (325 files), `guard-floor.json` → `??`. Either commit the
  fixture basis + floor, or declare the harness non-reproducible from a clean checkout and correct the
  README.

### `restore-tests` — PARTLY (most items closed; two reds belong elsewhere)
| item | verdict | change |
|---|---|---|
| `wild-step.test.ts:1399/1415` | **test-wrong** | widened `wildFixture(status: PhaseStatus)` at the cause (no call-site cast) |
| test 367 (C-14) | **test-wrong, not this lane's file** | reported; `restore-guards` fixed `gate-invariants` (13/13) |
| test 233 | **source-wrong** | `capture:"…:455"` → `":519"` (the real `cliLogEvent({` site) |
| test 208 | **test-wrong + doc-stale — the source is RIGHT** | contradicts the audit's "source-wrong": `terminalStatusOf` is the deliberate honest-status contract; test updated + `README-cli.md` reconciled in 5 places |
| test 585 (TS2339) | **test-wrong** | typed the `process.env` spread at the cause; **`ERROR_BUDGET` untouched** (the ratchet still bites) |
| `doctor --project` | **source-wrong** | USAGE line gained the flag the arm already consumed; the E-25 legs now pass |
| test 586 | cleared | green once leg 1 is clean |
| uncatalogued red (BUG-5) | **test-wrong** | `wild-step` expected the raw critique where `wildPause`/`wildParkInfo` derive both surfaces from one prefixed `detail`; pinned to the real clipped value. **Invisible at baseline because the src leg never ran** |
Also cleared during the run: 204/216/217/218 (206), 246, 345, 407/415.
**Remaining red, not this lane's files:** test **585** (the ratchet lane's own new files carried 94 `tsc`
errors mid-write) and **163/164** (the stale `src/lib/auth/*` allowlist in
`scripts/check-module-coverage.mjs` — **unowned by any W356 lane**).

### `ratchet` — PARTLY (mechanism built and given teeth; several floors legitimately unenforced)
- Three new files: `scripts/quality-ratchet.mjs`, `scripts/quality-ratchet.floors.json`,
  `scripts/quality-ratchet.test.mjs` (26 tests); plus an **additive** `ratchet` stage in `scripts/gate.sh`
  (no existing stage altered, reordered or relaxed) folded into `nonTestGatesOk`.
- **34 metrics** pinned; **enforced** at pin time: `typecheck.errors 0` (was 2), `prevention.missed 0`,
  `prevention.pending 0` (was 1), `prevention.guards/countFloor 34/34`, `tree.corpusSize 13`,
  **`tree.jobScopedRealTrees 6`**, `realProductOnly.markerViolations 0`, `testDoubleProductionImports 0`,
  `treesEvaluated 13`, `productQuality.recordsEvaluated 25`, `docClaims.uniquePaths 61`,
  `acceptance.samples 1`, `kindFit.{app,game,library}.units`. Others are `pending-first-green` because
  the tree was red at pin time.
- **Planted-regression teeth proven:** `--selftest` → `ok:true`, 19 teeth, **21/21 enforced floors beaten
  → all caught**; reader canaries proven for an aliased / missing `jobScoped` and for a classifier that
  calls everything `real`. **No cry wolf** on the real tree: `--all` → `ok:true`, 0 regressions.
- **Gate fold proven without running the gate:** ratchet red alone → exit 1 naming
  `gates.ratchet.regressions`; another stage red + ratchet green → still red (no masking); unparseable log
  → fail-closed.
- **Owner-rule readings:** `realProductOnly` over 13 trees (89 real / 3 stub / 52 reexport modules) → **3
  stub production modules** (`TODO(E-15)` in two trees), pinned at the honest bar 0; 0 marker violations;
  0 test-double imports from a production module. `kindFit`: **0 fit of 32** (app 0/30, game 0/1,
  library 0/1) with the binding leg being the kind's required surface (10/30 for app); **tool and service
  report `uncovered`**, never `pass`.
- **Honest limits:** the `tests.*` floors were never enforced against a real gate log (this boundary is
  the first real exercise); `tree.tscPassSample` is a one-tree sample; the gate stage had not run inside a
  real invocation; a new `scripts/**/*.mjs` can pass `node --test` yet fail the gate through
  `tsconfig.scripts.json`; and `eslint .` crawls `testruns/**` — **934 of 947 problems come from the
  untracked fixture corpus**, which is the lint stage's current problem, not the source's.

### `cartographer` — the verification + re-audit report
`research/multiagent/356_cartographer.md` (43.7 KB), pinned to a stated window with the mtimes of the
bytes it judged. Per-lane: `restore-census` CONFIRMED · `restore-oracle` PARTLY (its own
`scaffold.test.ts` 130/133; two of four emission directions unmeasured by the cartographer) ·
`restore-guards` CONFIRMED · `restore-tests` PARTLY (`wild-step.test.ts` 43/44) · `ratchet` PARTLY
(teeth hold; `--selftest` was `selftestOk:false` and the mechanism unwired at its pin — both since
resolved by the lane's completion).

**8 new regressions mapped (R-1…R-8; two P0 at the pin):** R-1 the ratchet's own new files failed the
wave's own typecheck ratchet (94 errors mid-write — now 0 per the lane) · **R-2 `gate.sh` had 0 `ratchet`
matches → the mechanism could not fire** (since wired) · R-3/R-4 floors and canaries pinned at the
measured value / a zero-tree corpus can never fire · **R-5 the owner-rule reader (`realProductOnly`)
scans emitted trees only, so the repo's own `src/**` is outside the reader enforcing the owner's rule** ·
R-6 7/13 pinned trees withhold `emit --git` again · R-7 a reachable `assert.fail` survives at
`scaffold.ts:6323/6396` · R-8 optional `jobScoped?`/`wholeTree?` vs a required producer.

**Kind map — the biggest single gap: no synthesis prompt contains the delivery kind.** The kind IS a real
single-sourced decision (`engine.deliveryKindOf` → `withDeliveryKind`) and reaches the router, the emitter
and the gates, but `codegen.server.ts` / `prompt-engine.ts` mention it only in comments and routing
checks, so the model must re-infer the requested kind from prose. Eight further default/ignore sites
named, including the CLI's **inert `kind` flag** (`rapidtool-cli.mjs:1632`), a keyed-only stamp
(`engine.ts:4073`), `headless.ts:6590` printing `(kind: undefined)`, and a 3-of-5 `COARSE_KIND_LABEL`.

**Mock/stub verdict: no production-reachable undisclosed double — no P0.** `providers/mock.ts`,
`mcp/stub-server.ts` and `testing/fixtures.ts` are confined to test seams (importer queries given). Two
items are production-reachable but **gated/disclosed**: the cassette replay transport (identity when
`RAPIDTOOL_CASSETTE_MODE` is unset) and the keyless-floor placeholder emitter (labelled, withheld,
refused). The real gap is measurement (R-5).

---

## 2. Boundary verdict — the parent's own `gate.sh` run (all lanes stopped)

Command: `& 'C:\Program Files\Git\bin\bash.exe' scripts/gate.sh` · wall **625,039 ms** · raw log
`%TEMP%\rt-campaign\w356-boundary-gate.log` · parent exit 1 (the documented PowerShell
`NativeCommandError` artifact on stderr; **the JSON verdict is authoritative**).

```json
{"ok":false,"hardFails":["module-coverage: a stale allowlist entry (module now reached) fails the guard",
 "module-coverage: the CLI runs green on the live repo and exits 0","C: all gates green → ok:true, exit 0",
 "D: --double run-1/run-2 disagreement → exit 3 with both names as flakes",
 "G: an allowlisted load-flake GREEN in isolation is quarantined (loud) — exit 0 with --quarantine",
 "K: --double --quarantine relieves an isolated-green allowlisted hard fail (exit 0, not a nameless red)",
 "O: a registered, justified skipped test passes (registry keyed on the exact leaf name)", "…+10 test names"],
 "quarantined":[],"quarantineCandidates":[],"skips":2,"wallMs":625039,
 "gates":{
  "typecheck":{"ok":true,"exit":0,"ms":57583},
  "lint":{"ok":false,"exit":1,"ms":23870,"problems":947},
  "assertionGaps":{"ok":true,"exit":0,"ms":1207},
  "build":{"ok":false,"exit":1,"ms":35639},
  "prevention":{"ok":true,"exit":0,"ms":8489,"missed":[],"pending":[],"skipped":[],"count":34,"countFloor":34},
  "ratchet":{"ok":true,"exit":0,"ms":9639,"regressions":[],"canaryFailures":[],"unavailableEnforced":[],
    "pendingFirstGreen":["gate.ok","lint.problems (BELOW THE HONEST BAR today)","tests.scripts.pass",
      "tests.scripts.fail (BELOW THE HONEST BAR today)","tests.lib.pass","tests.lib.fail (BELOW THE HONEST BAR today)",
      "tree.tscPassSample","realProductOnly.stubProductionModules (BELOW THE HONEST BAR today)",
      "docClaims.mismatches (BELOW THE HONEST BAR today)"],
    "uncovered":["kindFit.tool.units","kindFit.service.units","kindFit.tool.fit","kindFit.service.fit"]},
  "moduleCoverage":{"ok":false,"exit":1,"total":140,"covered":131,
    "unallowlisted":[],"stale":["src/lib/auth/client.ts","src/lib/auth/email-password.ts",
      "src/lib/auth/gate-session.server.ts","src/lib/auth/middleware.ts","src/lib/auth/pglite-dialect.ts",
      "src/lib/auth/server.ts","src/lib/auth/verify.server.ts"]},
  "testsScripts":{"ok":false,"exit":1,"pass":643,"fail":7,"skipped":0},
  "testsLib":{"ok":false,"exit":1,"pass":4215,"fail":5,"skipped":2}}}
```

Grade the difference from baseline honestly:

| stage | baseline | W356 boundary | verdict |
|---|---|---|---|
| **typecheck** | **exit 2, 5 errors** | **exit 0** | **P0 mechanism fixed** |
| **prevention** | `ok:false`, `missed:["C-06"]`, `pending:["C-14"]` | **`ok:true`, `missed:[]`, `pending:[]`, 34/34** | **P0 mechanism fixed, with a canary** |
| **ratchet** | (did not exist) | **`ok:true`, `regressions:[]`, `canaryFailures:[]`** | **new mechanism live and green** |
| testsScripts | 622 tests · 607 pass · **15 fail** | 650 tests · 643 pass · **7 fail** | improved, still red |
| testsLib | **never ran** (leg 1 blocked it) | 4,222 tests · 4,215 pass · **5 fail** · 2 skipped | **first real measurement** |
| moduleCoverage | red (stale `src/lib/auth/*`) | red — **7** stale entries | unchanged; unowned in W356 |
| **lint** | (not measured at baseline) | red — **947 problems (51 errors, 896 warnings)**, of which **934 come from the untracked `testruns/**` fixture corpus** that `eslint .` crawls | red; unowned in W356 |
| **build** | (`ok:true` in the 346 gate of record) | **red — exit 1**, `[PARSE_ERROR] Expected a semicolon …` on **`migrations/auth/0001_auth.sql:1:10`** and **`0002_account_unique.sql:1:11`**: the build is parsing the SQL migrations as code | **red; unowned in W356 — the app cannot build** |

**Honest verdict: the wave did not reach green.** It fixed the two P0 mechanisms (the typecheck gate and
the disarmed guard, the latter now with a canary that catches the exact defect that defeated it) and
built the ratchet. Three gates are still red, and the noteworthy one is **`build`**, which no W356 lane
owned: the SQL migrations are being pulled into the bundle and parsed as JavaScript.

**Note on the `build` red:** it was green in the 346 gate of record, so this is a regression that arrived
with the uncommitted 354-wave work (the persistent-PGLite/launch change is the plausible carrier). The
audit wave did not surface it because no audit lane ran `npm run build` (the repo rule forbids it while
lanes are mid-edit). It is found here, at the first boundary where all lanes were stopped — which is
exactly what a boundary is for.

**Also from this run:** `ratchet.pendingFirstGreen` names 9 readings below the honest bar, all correct
and self-reported: `lint.problems` 947, `tests.*` red, `realProductOnly.stubProductionModules` 3,
`docClaims.mismatches` 2, and `tree.tscPassSample`/`gate.ok` unavailable in-stage. `kindFit.tool` and
`kindFit.service` are `uncovered`, reporting honestly instead of passing. **No metric read `pass` while
unavailable.**

## 3. Residuals and the W357 dispatch

### 3.1 Residual reds, each with an owner (W357)

| # | red | evidence | W357 owner |
|---|---|---|---|
| 1 | **`build` fails: SQL migrations parsed as code** (`migrations/auth/0001_auth.sql`, `0002_account_unique.sql`) | gate JSON + `[PARSE_ERROR]` | `fix-build` |
| 2 | `lint` 947 problems — 934 from the untracked `testruns/**` corpus, 51 real errors in source | gate JSON `lint.problems` | `fix-lint` |
| 3 | `moduleCoverage` 7 stale allowlist entries (the modules are now **reached**, so the entries must be **removed**) | gate JSON `moduleCoverage.stale` | `fix-gates` |
| 4 | `software-export.ts:96` calls `scaffoldProject(project)` with no options → the restored refuse default **breaks console Preview for below-floor runs** (`software-export.test.ts` 9/10); `RUNBOOK.md` §6a/§9.7 now stale | `restore-oracle` log | `fix-preview` |
| 5 | 7 scripts-leg + 5 lib-leg failures — **not yet attributed to files** | gate JSON | `fix-tests` (attribution is its first task) |
| 6 | R-3/R-4/R-5/R-8 (ratchet polish: floors/canaries that cannot fire, the owner-rule reader scanning emitted trees only, optional census fields) | `356_cartographer.md` §regressions | `cartographer` + `fix-gates` |
| 7 | R-7 — a reachable `assert.fail` survives at `scaffold.ts:6323/6396` | `356_cartographer.md` | `fix-tests` |
| 8 | **OWNER DECISION — RESOLVED 2026-10-15 by the parent** (the owner authorised committing and correcting the README): the 325-file `testruns/` fixture basis and `scripts/prevention/cassettes/guard-floor.json` are now **tracked**, so the prevention stage is reproducible from a clean checkout. See §3.3 for the vendoring work this required. | `restore-guards` log; `.gitignore`; `scripts/prevention/README.md` | **done** |
| 9 | Doc truth: 19 stale counts + 13 undocumented `RT_E_*` codes + `AGENTS.md:347-348` (`resumeAccepted`) | `355_0_audit_wave.md` §2.6 | `fix-preview` (docs) / a later wave |

### 3.3 The fixture vendoring (owner decision resolved) — what was done and what was removed

To make the prevention stage reproducible from a clean checkout, the fixture corpus was vendored into
version control. Four checks ran **before** anything was staged:

| check | result |
|---|---|
| secret scan of the corpus | **0 key-shaped matches** across all 325 files (`sk-[A-Za-z0-9_\-]{16,}`), and 0 in `guard-floor.json` |
| `.env` safety | `.env` and `.env.bak-*` are **ignored and untracked**; `.env.example` is tracked and carries **0** key-shaped values |
| needed fixtures vs ignore rules | the only ignored file inside the corpus is `testruns/office-scheduler/.rapidtool/logs/rapidtool.ndjson` (a runtime log, correctly ignored by `**/.rapidtool/logs/`). The fixtures C-01/C-06 actually read — `…/emitted/.rapidtool/project.json` — are **not** ignored |
| binaries | none in the untracked set |

**The hazard found and fixed: 14 nested git repositories.** `emit --git` gives every emitted tree its own
`.git`, so `git add testruns` produced 14 `warning: adding embedded git repository` notices. Committing
those records a **gitlink**, not the tree's files: a clone would silently not contain the very fixtures
the guards read. **Every consumer already skips them** — `replay-harness.mjs:187`
(`if (e.name === "node_modules" || e.name === ".rapidtool" || e.name === ".git" || e.name === "dist") continue;`)
and the campaign invariants exclude `.git` when walking a tree — so they are dead metadata, not fixtures.

**Action taken (non-destructive):** the 14 `.git` directories were **moved** — not deleted — to
`%TEMP%\rt-campaign\stripped-fixture-git\`, each under a flattened name recording its origin path. All
fixture file contents are untouched. `git add -An testruns` then reported **324 files with no embedded-repo
warning**.

**Recurrence guard:** `.gitignore` gained `testruns/**/.git/` with the reason recorded inline.
**Verified by planting the defect**: a throwaway nested repo created inside `testruns/` was reported as
ignored by that rule and produced **no** embedded-repo warning from `git add -An`; the probe was then
removed. The rule therefore works, rather than being assumed to work.

**Doc truth:** `scripts/prevention/README.md`'s "tracked in the repo … green on a clean checkout" claim
was false when written (the audit recorded it as `AW355-f05`); it is now supported by the tracked corpus
and floor, it carries a dated correction noting it was false, and it states the honest residual — the
clean-checkout claim was **not** re-verified in a fresh clone on this host.

### 3.2 What the wave proved about its own method
- The **ratchet's planted-regression test caught all 21 enforced floors** and the reader canaries caught
  both a renamed key field and a re-pointed alias — the exact A2-F3 defect. The measurement layer can now
  detect the failure mode that defeated it.
- The **cartographer corrected its own mid-flight readings three times** (§5 of its report) rather than
  publishing a mid-write artifact as a finding.
- The **`docClaims` reader found 2 mismatches while 61 unique paths were checked** — the number is real
  and pinned, not zero-by-assertion.

