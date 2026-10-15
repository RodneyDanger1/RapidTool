# 356 — cartographer: W356 lane verification, the Wave-1 regression map, and the kind / mock re-audit

**Lane:** W356 `cartographer` (the standing architecture + verification lane). **Wave:** W356 (green
recovery + ratchet). **Author:** this lane — this file is the only file it writes.
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (path contains a space). **Host:** Node **v24.15.0**,
Windows PowerShell 5.1.

**Pinned revision:** HEAD `30bce78b84903d2d64a84c4902c732f40bd14a29` (`main`), **dirty tree** — no commit
exists, so every number below describes **the bytes on disk**. **Verification window: 14:10–14:32,
2026-10-15.** The five sibling lanes were writing *during* this window; §0 records the revision pin and
every re-read. Where a lane's log and the bytes disagree, the bytes win and it is recorded as a
correction (§6 records two corrections to **my own** earlier readings).

**Constraints honoured:** no product/doc/script/register/other-lane file edited; no `bash scripts/gate.sh`,
no `npm run build`, no full `npm test`; no keyed LLM call; no git write. Probe files live in `%TEMP%`
(`rt356_census.mjs`, `rt356_shell.mjs`, `rt356_scaffold_only/`). Tests were run **file-scoped** only
(`node --test … <one file>`, `node --experimental-strip-types --test … <one file>`).

---

## 0. The moving tree — what I pinned, and when

The wave was dispatched at 14:09; my first census read (14:12) captured the **pre-wave** (W354-boundary)
bytes. Four lanes landed mid-verification. Every verdict below therefore carries the mtime of the bytes
it describes.

| File (owner lane) | mtime at final pin | Landed during my window |
|---|---|---|
| `src/lib/compile-check.server.ts` (restore-census) | 14:13:32 | yes |
| `src/lib/headless.ts` (restore-census) | 14:20:43 | yes |
| `src/lib/headless.test.ts` (restore-census) | 14:13:51 | yes |
| `src/lib/scaffold.ts` + `scaffold.test.ts` (restore-oracle) | 14:20:08 / 14:23:57 | yes |
| `scripts/prevention/replay-harness.mjs` + `.test.mjs` (restore-guards) | 14:23:54 / 14:23:04 | yes |
| `scripts/guards/gate-invariants.test.mjs` (restore-guards) | 14:18:35 | yes |
| `scripts/rapidtool-cli.mjs`, `README-cli.md`, `typecheck-scripts.test.mjs` (restore-tests) | 14:13:50 / 14:16:05 / 14:17:07 | yes |
| `src/lib/wild-step.test.ts` (restore-tests) | 14:20:55 | yes |
| `scripts/quality-ratchet.mjs` + `.floors.json` (ratchet) | 14:27:46 / 14:27:48 | yes |
| **`scripts/gate.sh` (ratchet)** | **10/6 11:14 — NOT edited** | **no** |
| `scripts/guards/guard-registry.json` | 10/6 11:06 — NOT edited | no |
| `src/lib/llm/providers/mock.ts`, `src/lib/mcp/stub-server.ts` | (untouched) | no |

**Pre-wave baseline I measured myself (14:12–14:14, before any lane landed):**
`verify-prevention.mjs --all --selftest` → `ok:false`, `guards:34`, `countFloor:34`,
`fixtureIntegrity.missed:["C-06"]`, `fixPresence.pending:["C-14"]`, `skipped:[]` — the W355 ledger §2.3
reproduced exactly. The pinned 13-tree census read whole-tree 13/13 non-empty / 0/13 literal `real`,
job-scoped 6/13 `real` / 7/13 `empty`. `--test-name-pattern="default refuses before writing"` → **1 fail**
(`true !== false`, `headless.test.ts:5898`). So the wave's inputs were the audited ones.

---

## 1. JOB 1 — adversarial verification of the five sibling lanes

Discipline: **a lane's log is never evidence for that lane's claim.** Every verdict below cites the
command I ran against the bytes. Where a lane's log was available it is checked against those bytes.

### 1.1 `restore-census` — **CONFIRMED**

| Claim | Verdict | The command that decided it |
|---|---|---|
| Two **distinctly named** readings are published | **CONFIRMED** | read `src/lib/compile-check.server.ts:588-613` (types `jobScoped?` \| `wholeTree?`) and `:810-874` (`treeSubstanceOf` returns both, required) |
| The shell-detection signal is reachable again; a scaffold-only project reads `empty` | **CONFIRMED** | `node --experimental-strip-types %TEMP%\rt356_shell.mjs <dir>` → `{"top":{"verdict":"empty"},"jobScoped":"empty","wholeTree":{"verdict":"real","real":1}}` on a tree holding only `index.html` + `src/main.tsx` + `src/styles.css` |
| The 13-tree corpus rate, re-derived | **CONFIRMED, and unchanged from the audit's framing** | `node --experimental-strip-types %TEMP%\rt356_census.mjs` → **TOP (= job-scoped) literal `real` 6/13, not-empty 6/13, EMPTY 7/13; wholeTree not-empty 13/13, literal `real` 0/13**; `top==job:true` for all 13 |
| `refuse` refuses at the seam | **CONFIRMED** | `node --experimental-strip-types --test --test-reporter=tap --test-name-pattern="default refuses before writing" src/lib/headless.test.ts` → `# tests 1 / # pass 1 / # fail 0` (was 1 fail at baseline); `src/lib/headless.ts:2837-2841` now forwards `underProduced: "refuse"` explicitly on every path |

**Rate movement is explainable by a product change — and it is the *right* change.** My re-derivation
reproduces the audit's W355 numbers exactly (`6/13` job-scoped `real`; `13/13` whole-tree *non-empty*, with
the important nuance the V1 panel added that **no** tree reads the literal `"real"` under the whole-tree
reader). The direction has now been re-pointed: the bare top level is the job-scoped reading again
(`compile-check.server.ts:860-867`) and the whole-tree reading survives beside it as `wholeTree`. **No
product byte changed** — the census reader is the only variable (no cassette or fixture was touched; §1.3).

**One correction to the lane's own log.** `fixes/356_restore_census.md` is a skeleton-plus-header; the
`restore-guards` log §1 describes the census as publishing "**THREE** named readings". The bytes publish
**two named scopes** (`jobScoped`, `wholeTree`) plus a documented *bare alias* on the top level — the alias
is not a third name. This matters for the ratchet canary (`canary.census.job-scoped-not-aliased`), which
keys on exactly that alias: calling it a third "named reading" would suggest it is safe to re-point, which
is the precise failure the canary exists to catch.

### 1.2 `restore-oracle` — **PARTLY**

| Claim | Verdict | Evidence |
|---|---|---|
| An unwired row is honestly surfaced and counted (not an unavoidable red) | **CONFIRMED in bytes** | `src/lib/scaffold.ts:6255` `skipRow` → `:6267` `test(${id}, { skip: ${ORACLE_SHORTFALL_MARKER} }, () => {`; marker text at `:5667-5668`; the count rides the emitted spec header `:6038` (`// ORACLE SHORTFALL: N of M …`) and README census `:8105` (`ACCEPTANCE SHORTFALL - N of M … MARKED skips under their pinned ids`) |
| `underProduced` absent ⇒ refuse ⇒ zero files; `"banner"` ⇒ lands with the banner | **CONFIRMED for the absent/refuse half by measurement** | the repo's own pinned test `default refuses before writing` now passes (§1.1); `headless.ts:2837-2841` |
| A partial with unwired rows is **green while reporting its shortfall** | **UNDECIDED / partly contradicted** | I did not build a tree-run probe for it, and the code adds a second gate that can still redden such a tree: `scaffold.ts:8284` states the tree-run "refuses a skip-dominated spec as a vacuous green (`RT_E_SPEC_SKIP_VACUOUS`)". So "green while reporting" holds only while the shortfall is **not** skip-dominated; the boundary is not stated in the plan and I did not measure it |
| The lane's own suite is green | **REFUTED** | `node --experimental-strip-types --test --test-reporter=tap src/lib/scaffold.test.ts` → `# tests 133 / # pass 130 / # fail 3`, red at `not ok 10 - fixes/216d — refused tree rows, declared entry, census bullet, computed UI entry`, `not ok 20 - A3-f07 / W-14 — default emitted-UI generator`, `not ok 26 - A2-F5 — spec-derived page set for a prose brief` |

The lane's file is also the last leg-1 type-error owner, and that half **is** clean: `npx tsc --noEmit`
→ **0 errors** (was 5 in 3 test files). Credit where due; the three red runtime cases above are what the
lane's completion claim must still answer.

### 1.3 `restore-guards` — **CONFIRMED**

| Claim | Verdict | The command that decided it |
|---|---|---|
| `ok:true`, `missed:[]`, `pending:[]`, `skipped:[]`, `count >= countFloor` | **CONFIRMED** | `node scripts/prevention/verify-prevention.mjs --all --selftest` → `{"ok":true,"guards":34,"count":34,"countFloor":34,"missed":[],"pending":[],"skipped":[],"controlMissed":[],"fixPresenceInvariant":{"ok":true,…}}`, canaries `{checked:["C-06","C-14"], violations:[]}` |
| C-06 fires again | **CONFIRMED** | `fixtureIntegrity.fired` includes `C-06`; driver now keyed on an explicit declared path, `scripts/prevention/replay-harness.mjs:896` `SHELL_VERDICT_FIELD = "jobScoped.verdict"`, used at `:1401`, with the alias pinned separately at `:897` `SHELL_VERDICT_ALIAS = "verdict"` |
| C-14 leaves `pending` | **CONFIRMED** | `fixPresence.pending:["C-14"] → []`; the control is now the same real bytes with every `p6.synthesis.*` row stripped (`replay-harness.mjs:1025/1035/1045-1047`), one variable changed |
| **No cassette was edited to satisfy a guard** | **CONFIRMED — checked the bytes** | `git diff --name-only -- scripts/prevention/cassettes` → **empty**; `git status --porcelain scripts/prevention/cassettes` → only `?? guard-floor.json`; `Get-ChildItem scripts\prevention\cassettes\*.json | Where { $_.LastWriteTime -gt (Get-Date).Date }` → **no cassette touched today**; `guard-floor.json` bytes still `countFloor: 34` + all 34 ids |
| No **fixture** was edited to satisfy a guard | **CONFIRMED — checked the bytes** | `Get-ChildItem testruns -Recurse -File | Where { $_.LastWriteTime -gt '2026-10-15 14:09' }` → **0 files** (the only today-mtime entry is `testruns\office-scheduler\.rapidtool\logs\rapidtool.ndjson` at **12:26:47**, i.e. **before** the wave was dispatched, and it is a log row, not a census fixture) |
| No guard weakened or deleted | **CONFIRMED** | guard `count` still `34` = `countFloor` `34`; `scripts/guards/guard-registry.json` mtime **10/6 11:06** (untouched by this wave) |
| The twin unsatisfiable assertion in `gate-invariants.test.mjs:207` is repaired | **CONFIRMED (on the final bytes)** | `node --test --test-reporter=tap scripts/guards/gate-invariants.test.mjs` → `# tests 13 / # pass 13 / # fail 0`; `buildKeylessFloor` helper present (2 refs) |
| Its own typecheck is clean | **CONFIRMED** | `npx tsc -p tsconfig.scripts.json --noEmit` → **no error in `scripts/prevention/**` or `scripts/guards/**`** (the 63 remaining errors are all in `scripts/quality-ratchet.mjs`, §2 R‑1) |

**The strongest single result of this wave.** Both audited defects are fixed *and* the fix is
anti-recurrence: the C-06 driver no longer reads the field that was silently re-pointed, so a repeat of the
A2-F3 defect trips a canary instead of disarming the guard.

**Two honesty notes on that fix** (from the bytes, not the log): (i) the C-14 seam check was *rewritten*
from the `dod.DOD[6].p6-arch` registry probe to `dod.archProductComplete` over the emitted
`office-stock-tracker/emitted/.rapidtool/project.json` with a synthetic complete-trace control
(`replay-harness.mjs:1685-1693`) — this proves the *predicate*, one step removed from the registry
criterion; and (ii) the lane's own §7 states the canary table covers only C-06 and C-14, so every *other*
driver that reads an object field remains silently disarmable. Both are disclosed, not hidden.

### 1.4 `restore-tests` — **PARTLY**

| Claim | Verdict | The command that decided it |
|---|---|---|
| Each fixed item states **source-or-test** | **CONFIRMED** | `fixes/356_restore_tests.md` item ledger: rows 1 / 5 / BUG-5 / 4 are `test-wrong`, rows 3 / 6 are `source-wrong`, row 4b `doc stale`, row 2 correctly delegated (`gate-invariants.test.mjs:207` is `restore-guards`', and it did land) |
| The typecheck ratchet still bites and was not loosened | **CONFIRMED — it bites** | `scripts/typecheck-scripts.test.mjs:54` `export const ERROR_BUDGET = {}` (maximally tight: every `scripts/**` file is unbudgeted); `node --test … scripts/typecheck-scripts.test.mjs` → `# tests 6 / # pass 4 / # fail 2`, and test 2's own message names `new red file(s): scripts/quality-ratchet.mjs: 63 error(s)` |
| `doctor --project` works | **CONFIRMED** | `node --experimental-strip-types scripts/rapidtool-cli.mjs doctor --project build.json` → the doctor envelope (`ok:true`, `llm`, `runner`, `node`, `factory`), **no** unknown-flag refusal; `"project"` is in `KNOWN_FLAGS` (`rapidtool-cli.mjs:232`) and the arm consumes `CLI_PROJECT` (`:5731`) |
| The stale hard-coded `capture:` path is corrected | **CONFIRMED** | `rapidtool-cli.mjs:539` reads `capture: "scripts/rapidtool-cli.mjs:519"`, and **line 519 IS** the `cliLogEvent({` site — self-consistent today (it remains a self-referential literal that will drift again; see R‑? note §2) |
| Its whole scope is green | **REFUTED (partial)** | `src/lib/wild-step.test.ts` → `# tests 44 / # pass 43 / # fail 1`, red at `not ok 11 - BUG-5 park surface budget 600 + ellipsis (fixes/320)`. The lane's ledger re-pins a *different* BUG-5 case (`park.reason`), so this red is unclaimed |
| Leg 1 (`tsc --noEmit`) is closed | **CONFIRMED** | `npx tsc --noEmit` → **0 errors** (baseline: exit 2, 5 errors). Note this is a *shared* credit: the fix for `scaffold.test.ts:2712/2719` belongs to `restore-oracle` |

Also verified: `scripts/README-cli.md` was edited (14:16:05) and `README-cli.md:337` now documents
`summary.status` as the honest terminal status via `engine.ts: terminalStatusOf` — so the doc and the bytes
agree (`terminalStatusOf` lives at `engine.ts:2025`, consumed at `headless.ts:2291`). The W355 ledger's
"a new `terminalStatusOf` renames `summary.status`" description does **not** match either HEAD or the
current bytes (the symbol exists in `engine.ts`, not in the CLI, at both revisions) — I record that as an
imprecision in the *audit*, since it is not this lane's claim.

### 1.5 `ratchet` — **PARTLY**

| Claim | Verdict | The command that decided it |
|---|---|---|
| Its own suite exists / `--selftest` has teeth | **PARTLY** | `node scripts/quality-ratchet.mjs --selftest` → `"selftestOk":false` … but `"teeth":[…]` shows the planted-regression teeth DO hold: `planted.every-enforced-floor-fails-when-beaten ok:true`, `planted.teeth-cover-a-nonzero-floor-set ok:true ("enforced numeric floors beaten: 19/19")`, `planted.clean-run-is-not-red ok:true`. The invocation exits **1** |
| The ratchet FAILS on a planted regression | **CONFIRMED** | same run: 19/19 enforced numeric floors beaten → FAILS; and `planted.clean-run-is-not-red` proves it does not cry wolf on a clean input |
| `realProductOnly` is honest — does it false-positive on the real tree? | **CONFIRMED honest; it reports a true positive, not a false one** | `realProductOnly.stubProductionModules` → `reading:3`, `comparison:"regressed"`, `result:"pending"` (never `ok`), evidence `bakery-website/emitted src/ui/console.tsx`, `mobile-companion/emitted src/main.ts` + `src/ui/console.tsx`, each `marker:"TODO(E-15)"`. Those are genuine keyless-floor stub bytes in pinned historical trees. `realProductOnly.markerViolations` 0 / `testDoubleProductionImports` 0 / `treesEvaluated` 13 — all `enforced`, all `ok` |
| `kindFit` is honest — no kind reads `pass` when uncovered | **CONFIRMED for uncovered; REFUTED for "has teeth"** | `kindFit.tool.fit` and `kindFit.service.fit` → `"status":"uncovered","result":"uncovered"`, `floor:null`, with a reason ("no emitted artifact … exists on disk, so there is nothing to compare and nothing to pass") — **never a pass**, exactly as the plan demands. **But** `kindFit.app.fit` / `game.fit` / `library.fit` read `0` against **floor 0** → `"result":"ok"`: a floor pinned at the measured value cannot detect a regression (§2 R‑3). Note the *corpus* does carry tool and service briefs (`invoice-csv-cli.md` kind=`cli-tool`, `order-webhook-service.md` kind=`service`) — "uncovered" is about emitted **artifacts**, which is the honest reading |
| No metric reads `pass` when `unavailable` | **CONFIRMED** | all 7 gate-derived metrics read `"result":"unavailable"`, `"status":"pending-first-green"`, `code:"RT_E_RUNNER_UNAVAILABLE"` — none reads `ok`; `prevention.pending` reads `0` but reports `"result":"pending"` (not `ok`); `realProductOnly.stubProductionModules` reads `3` and reports `"pending"`; the selftest's own `unavailable.enforced-metric-hard-fails ok:true` and `unavailable.pending-metric-does-not-fail ok:true` pin it. `estimatedCostUsd:null` |
| It is wired into the gate as an additive stage | **REFUTED** | `(Select-String -Path scripts\gate.sh -Pattern 'ratchet').Count` → **0**; `scripts/gate.sh` mtime **10/6 11:14**, unedited (§2 R‑2) |
| Its own module survives the ratchet it lives beside | **REFUTED** | `npx tsc -p tsconfig.scripts.json --noEmit` → **63 errors in `scripts/quality-ratchet.mjs` (14:28 read) / +27 in `scripts/quality-ratchet.test.mjs` (14:31 read)** (§2 R‑1) |

**Its canaries do not all fire on the real tree** (same `--selftest` output): `canary.census.job-scoped-reachable`
→ `ok:false "the reader returned no object"`; `canary.census.job-scoped-not-aliased` → `ok:false
"the census corpus is empty — the job-scoped reader cannot be exercised" evidence:{trees:0,distinctScopes:0}`;
`canary.docParity.not-vacuous` → `ok:false "the doc-parity reader read 0 doc(s) and found 0 path(s)"`;
`canary.registry.complete` → `ok:false "declared-but-unimplemented: []; implemented-but-undeclared:
[canary.errorCodes.registered]"`. The census canaries — the ones that guard the exact defect this wave
fixed — read a **zero-tree corpus** and so cannot exercise the reader at all: a canary that cannot fire.

---

## 2. JOB 2 — the Wave-1 regression map

New defects introduced by this wave's diffs. Each carries `file:line` and the query that shows it.

**R‑1 (P0) · The ratchet's own new files break the scripts typecheck ratchet.**
`scripts/quality-ratchet.mjs` + `scripts/quality-ratchet.test.mjs` are brand-new files on a gate path.
Evidence: `npx tsc -p tsconfig.scripts.json --noEmit` → grouped by file,
**63 errors in `scripts/quality-ratchet.mjs` + 27 errors in `scripts/quality-ratchet.test.mjs`** (reading
taken **14:31**; at **14:28** the same command read 63 / 0 — the test file landed between the two reads, so
the count is time-stamped, and the pinned `quality-ratchet.mjs` bytes at 14:27:46 are unchanged across both
runs). Representative: `quality-ratchet.mjs:178,14 TS2339 Property 'test' does not exist on type 'string |
RegExp'`; `:306,51`/`:352,43`/`:493,20`/`:498,29`/`:507,21` TS2339 on `.floors`/`.readings`; `:295,60`/`:296,43`
TS8024; `:373,27` TS2345. Consequence, measured: `node --test scripts/typecheck-scripts.test.mjs` →
`not ok 2 … new red file(s): scripts/quality-ratchet.mjs: 63 error(s)` with `ERROR_BUDGET = {}`
(`scripts/typecheck-scripts.test.mjs:54`), i.e. the **ratchet lane's own artifact fails the wave's own
typecheck ratchet**. It also fails the leg-pair gate (`not ok 3 - npm run typecheck runs BOTH legs`).

**R‑2 (P0) · `gate.sh` has no ratchet stage — the new mechanism cannot fire at the boundary.**
Query: `(Select-String -Path scripts\gate.sh -Pattern 'ratchet').Count` → **0**; `scripts/gate.sh` mtime
`10/6 11:14` (unedited all wave). The `ratchet` lane was chartered for **"one additive gate stage +
its verdict fold"** (`wave_plans/W356/ratchet.md:22-25`), and `357`-style enforcement therefore does not
exist. This is the "a stage cannot mask another stage's verdict" case in its benign form — it is not wired,
so nothing is masked, and nothing is enforced.

**R‑3 · Non-discriminating floors pinned at the measured value ⇒ a metric that cannot fire.**
From `node scripts/quality-ratchet.mjs --selftest`: `kindFit.app.fit` `{reading:0, floor:0, result:"ok",
evidence:{units:30, entryOk:29, surfaceOk:10, scriptsOk:29, demandedMatch:20}}`; `kindFit.game.fit` and
`kindFit.library.fit` → `{reading:0, floor:0, result:"ok", evidence:{units:1, surfaceOk:0}}`;
`productQuality.qualityCount` → `{reading:0, floor:0, result:"ok", readingPinned:true}`. An `atLeast: 0`
floor is pinned at 0, so no regression of kind-fit or product quality can ever turn the ratchet red. Note
that `kindFit.game`'s `surfaceOk: 0 of 1` and `kindFit.app`'s `surfaceOk: 10 of 30` are real, already-failed
readings that the floor deliberately cannot see.

**R‑4 · The census canaries read a zero-tree corpus (a canary that cannot fire).**
Evidence: `--selftest` → `canary.census.job-scoped-not-aliased {"ok":false,"reason":"the census corpus is
empty — the job-scoped reader cannot be exercised","evidence":{"trees":0,"distinctScopes":0}}` and
`canary.census.job-scoped-reachable {"ok":false,"reason":"the reader returned no object","evidence":null}`.
The reader under guard is `src/lib/compile-check.server.ts#treeSubstanceOf(...)`'s `jobScoped.verdict`
(the field `restore-guards` just keyed C-06 on), and the pinned corpus on disk has **13** trees
(`tree.corpusSize` reads 13 in the *same* run). So the two canaries that guard this wave's central fix are
false-negative on the real tree. The teeth list asserts they *would* trip on a planted rename
(`canary.census.job-scoped-*-has-teeth ok:true`), so the gap is in the corpus wiring, not the validator.

**R‑5 · The owner-rule reader does not scan the repo's own production modules.**
`realProductOnly.testDoubleProductionImports`' declared producer is
`scripts/quality-ratchet.mjs#scanRealProduct (test seams are excluded by name: *.spec.* / *.test.* /
tests/**)`, and `realProductOnly.treesEvaluated`'s producer is "the corpus walk" — the **pinned emitted
trees only**. So the owner's "no mock/stub on a production path" rule is enforced over **emitted artifacts**
and not over `src/**`. The two production-adjacent doubles in this repo (`src/lib/llm/providers/mock.ts`,
`src/lib/mcp/stub-server.ts`) are therefore outside the reader's scope: the rule is measured everywhere
except where the repo's own code lives. I measured those two by hand in §4; a false negative here is as bad
as a miss where the owner rule is concerned.

**R‑6 · The census restore reverts the W354 A2-F3 intent for 7 of 13 pinned trees (disclosed trade-off,
not a hidden bug).** With the bare top level re-pointed to the job-scoped reading
(`compile-check.server.ts:860-867`), the CLI substance hold `runVerdict.substance.verdict === "empty"`
— `scripts/rapidtool-cli.mjs:3008` and `:3026` — withholds `emit --git` for every tree whose real code
lives only under `src/generated/`. Measured: `flower-shop-website/emitted{,.v2}`,
`office-stock-tracker/emitted{,.v2}`, `office-scheduler/emitted{,.v2}`, `office-invoice-tracker/emitted`
read TOP=`empty` while `wholeTree` reads `mixed real=4..5`. That **is** the pre-W354 behaviour restored, and
the plan asks for exactly that (`wave_plans/W356/restore-census.md:37-38`), so it is correct-by-plan — but
the wave's completion reporting should say "7 of 13 pinned trees now withhold again", not merely "the rate
is 6/13 again". The honest fix for both halves would be for the CLI hold to key on a *named* reading.

**R‑7 · A reachable `assert.fail("<id> is NOT IMPLEMENTED …")` survives in the emitter.**
`src/lib/scaffold.ts:6323` and `:6396` still emit `assert.fail(...)` inside the two defensive branches
("classified but no mapped import"). The comments call them "unreachable — the kind derives from the same
map", and the reasoning is sound today, but this is the *same reddening mechanism* the wave removed for
every other row: if either map drifts (a rename in the oracle-row kinds or the wired-job map), a real
emission reddens its own `npm test` again. Low severity, named because it is the one remaining instance of
the pattern the wave exists to eliminate.

**R‑8 (boundary hole, latent) · `jobScoped?` / `wholeTree?` are optional in the type but required from the
producer.** `src/lib/compile-check.server.ts:606,613` mark both readings optional "so hand-built fixture
outcomes (other lanes' tests) still satisfy the type", while `treeSubstanceOf` (`:811-813`) returns them
required. Any consumer that reads `substance.jobScoped.verdict` from a **hand-built** outcome gets
`undefined` rather than a compile error — precisely the class R‑4's `"the reader returned no object"` sits
next to. The compiler will not catch the next reader that assumes presence.

**Items checked and found CLEAN** (stated so the map is not read as one-sided):
- `scripts/rapidtool-cli.mjs:3008/3026` guard `&& runVerdict.substance` before dereferencing, so a missing
  `substance` object cannot throw, and a verdict with `ok:false` falls through to the `tree-run-red`
  withhold at `:3039` — **no honest-floor path reports success on a missing value**.
- `src/lib/pipeline-review.ts:154/233` returns its own verdict `"stub"` from its own mirrored union and
  reads its own mirrored `{generatedTreeFiles, realFiles}`, not `TreeSubstance` — no cross-type field
  mismatch; no production caller passes the real `TreeRunOutcome` into `opts.treeRun`
  (`rapidtool-cli.mjs:5884`, `run-report.ts:151/246` pass no `treeRun`).
- `headless.ts:3537`/`:3545` read `verdict.substance?.verdict` defensively and re-emit a *named* string.
- No renamed field is still read: the only readers of `jobScoped`/`wholeTree` are the census itself and
  `compile-check.server.test.ts` (query: `Select-String -Pattern 'jobScoped|wholeTree'` over `src,scripts`).

---

## 3. JOB 3a — the kind-resolution map (prompt + goal + kind, taken into full account)

### 3.1 The path, end to end

```
 brief  ──► Project.brief ──► deliveryKindOf(project) ──► withDeliveryKind (stamp) ──► Project.kind
 (CLI create / console / eval corpus)          │
                                               ├─► engine.uiKindOf      → "ui" | "cli-tool" | "library"   (P8)
                                               ├─► scaffold.projectKindOf → ProjectKind              (the emitter)
                                               ├─► dod.productSurfaceKindOf → web | game | runnable | none (the gates)
                                               ├─► codegen.singleModuleLibraryKind → tree vs single-module (the toolchain route)
                                               └─► compile-check COARSE_KIND_LABEL → the entry-smoke label
```

| Stage | Where | What the kind does |
|---|---|---|
| **Entry** | `scripts/rapidtool-cli.mjs:1623-1632` (`create`), `src/lib/headless.ts:503-513` (`createProject`), console via `store.ts` | sets `Project.brief` (+ `kind` if a caller supplies one) |
| **The ONE decision** | `src/lib/engine.ts:316-343` `deliveryKindOf` | stored `kind` wins if it is a member of `DELIVERY_KINDS` (`types.ts:31`), else a keyword scan of `stripOutOfScope(brief)` + `domain` + `lattice.jobs` (`engine.ts:326`), with library-first precedence and a UI-surface veto (`:339-341`); **default `"app"` at `:343`** |
| **The ONE stamp** | `src/lib/engine.ts:353-356` `withDeliveryKind`, called **only** at `:4073` inside `upgradeP6Keyed` | stores `kind` before the codegen call |
| **Synthesis** | `src/lib/codegen.server.ts` | **the kind is used ONLY as a router**: `singleModuleLibraryKind` (`:6895-6905`) decides tree-vs-single-module; `briefedPageModules` (`:3308-3311`) returns `[]` unless `kind === "app"`. **No prompt carries the kind** (§3.2) |
| **Emission** | `src/lib/scaffold.ts:640-652` `projectKindOf` (5-way → `webapp|cli-tool|game|library|service`), called at `:7786`, `:8216`, `:8558`; `software-export.ts:136` | selects `PKG_SCRIPTS`/`PKG_DEPS`/`ENV_LINES` (`:663-690`) and the per-kind entry/module shape |
| **Toolchain** | `src/lib/compile-check.server.ts:648-652` `COARSE_KIND_LABEL`; `scripts/acceptance-run.mjs:92-135` `resolveTreeEntry` | the entry-smoke label; the kind-aware entry requirement (`index.html` for web kinds, a real program entry otherwise) |
| **Gates** | `src/lib/dod.ts:900-924` `briefDeliveryKind` / `productSurfaceKindOf` | the `p6-*-surface` DoD criteria (game input/loop/canvas; web page/nav; runnable entry) |
| **Eval** | `scripts/run-eval.mjs:2084-2095` `deliveryKindOf` | maps a corpus `kind` onto `Project.kind` |

### 3.2 Where the kind is defaulted, ignored, or assumed to be `app`

1. **The model is never told the kind.** Query:
   `Select-String -Path src\lib\codegen.server.ts,src\lib\prompt-engine.ts -Pattern '\bkind\b'` returns only
   `ArtifactKind` uses, the routing checks at `:3308-3311`/`:6895-6905`, and **doc comments** (`:27`,
   `:6870-6882`, `:7042`). There is **no** line in any prompt builder mentioning the delivery kind —
   confirmed a second time by `Get-ChildItem -Recurse -Include *.ts -Path src | Select-String -Pattern
   'delivery kind|Delivery kind|deliveryKind'`, whose only non-comment prompt hits are
   `chat.server.ts:320` (`kind: ${kind}` — the chat tool taxonomy) and `arch-tools.ts:334`.
   **This is the biggest gap in the map.** The owner's requirement is that the factory deliver *the best
   version of the requested kind*; the kind currently reaches the emitter, the router and the gates, but
   the synthesizer is left to re-infer it from brief nouns. For `library` vs `app` the router acts on it;
   for "make this the best *game*" the model gets nothing but the prose.
2. **The CLI's `kind` flag is inert on `create`.** `"kind"` is registered in `KNOWN_FLAGS`
   (`rapidtool-cli.mjs:229`) and `VALUELESS_VALUE_FLAGS` (`:186`) and `createProject` accepts it
   (`headless.ts:503-513`), but `rapidtool-cli.mjs:1632` calls
   `h.createProject({ brief: briefSource.value, name: args.name })` — **no kind is forwarded**, and the
   `create` arm never reads `args.kind`. An operator cannot *request* a kind on the CLI at all.
3. **The stamp happens only on the keyed P6 seam.** `withDeliveryKind` has exactly one caller
   (`engine.ts:4073`, inside `upgradeP6Keyed`, guarded by `isBareNodeHost()` at `:4057` and
   `isDeepSeekConfigured()` at `:4060-4061`). On the keyless/deterministic path `Project.kind` stays
   **absent**, so the emitted record's `kind` is absent and every downstream resolver re-infers from the
   brief. The audit's L1 has the same root: the create path never classifies (`engine.ts:4064-4066` says so
   in code).
4. **The wild planner prints `undefined`.** `src/lib/headless.ts:6590` builds the run-plan prompt as
   `` `Project: ${project.name} (kind: ${project.kind})` `` — on any run whose kind was never stamped the
   planner literally reads `(kind: undefined)`. Same for `parseSynthesisEnvelope`-adjacent prompts that
   interpolate the optional field.
5. **The toolchain's coarse label covers 3 of 5 kinds.** `COARSE_KIND_LABEL`
   (`compile-check.server.ts:648-652`) maps only `app→webapp`, `tool→cli-tool`, `game→game`;
   `library` and `service` fall to `label = ""` → `headlessLabel = "headless"` (`:1745-1751`). So the
   entry-smoke verdict for a library/service product is labelled `headless` rather than its kind.
6. **The acceptance harness drops the declared kind.** `scripts/acceptance-run.mjs:564` calls
   `h.createProject({ brief: briefSpec.brief, ...(name ? { name } : {}) })` — `readBriefSpec` (`:212-238`)
   parses only the `brief:` front-matter scalar, never `kind:`. `:600` then reads
   `project.kind ?? null`, so on a keyless acceptance run the entry requirement falls back to the
   **historical web requirement** (`resolveTreeEntry` `:108-109`: `kind === undefined || null ⇒ web`),
   which is a false negative for a `tool`/`library`/`service` corpus brief.
7. **The eval harness deliberately erases `library`/`service`.** `run-eval.mjs:2084-2095` maps
   `library`/`service`/`""` → `undefined` ("the honest single-module library path"), then
   `engine.withDeliveryKind` re-stamps from the brief at the keyed seam. Intentional and documented, but it
   means the corpus's declared kind is not authoritative for those two kinds.
8. **`scaffold.projectKindOf` overrides a stored kind for game/arcade.**
   `scaffold.ts:639-641` `BRIEF_GAME_RE` returns `"game"` before consulting `deliveryKindOf` — a deliberate
   347-2 fix (a stored `app` label must not beat a brief that says "arcade game"), pinned against
   `dod.productSurfaceKindOf` by a test. It is a place where "the requested kind" is *not* the stored kind,
   and it is the only such override.
9. **The default is `app` (`engine.ts:343`).** A brief naming nothing in the register becomes a webapp.
   That is the fallback the kind-fit map should know about, because it is also what `productSurfaceKindOf`
   returns `"none"` for when the app brief names no page surface (`dod.ts:924`).

### 3.3 What Wave 2/3 need to make the factory deliver *the requested kind*

The plumbing is genuinely single-sourced (342-4's ONE decision, read by every resolver, with a parity test
pinning the `dod` mirror — `dod.test.ts:848`). The three moves the map implies, smallest first:
**(a)** put the resolved kind into the synthesis prompts (the one gap that is a *content* gap, not a
plumbing gap); **(b)** let the caller state it — forward `args.kind` in the CLI `create` arm and `kind:` in
`readBriefSpec`, validating against `DELIVERY_KINDS`; **(c)** stamp it earlier than the keyed seam so
keyless runs and the wild planner see a real value instead of `undefined`.

---

## 4. JOB 3b — mocks, stubs, fakes and test doubles: reachability, per item

**Owner rule:** no mock / demo / stub on a production path. Verdict per item, with the query that shows
confinement or reachability. No `*.fixture*` file exists under `src/` or `scripts/` (query:
`Get-ChildItem -Recurse -File -Path src,scripts | Where { $_.Name -match 'fixture' }` → the
`brief-fixtures*` / `fixtures*` product modules, below).

| # | Item | Reachable from a production module? | The query that decided it | Verdict |
|---|---|---|---|---|
| 1 | `src/lib/llm/providers/mock.ts` | **NO — confined to the test seam** | `Get-ChildItem -Recurse -Include *.ts,*.tsx,*.mjs -Path src,scripts \| Select-String -Pattern 'mock\.ts'` → only `mock.test.ts:39` (the import) and **doc comments** in `registry.ts:58,120,602` / `cassette.ts:16,526,891`. `RAPIDTOOL_MOCK_LLM` / `selectMockProvider` appear in **`mock.ts` and `mock.test.ts` only**. `mock.test.ts:118-120` pins `getProvider("mock") === undefined` and `!PROVIDERS.some(p => p.id === "mock")` | **CONFINED** — no production importer, not in `PROVIDERS`, `descriptor.isConfigured()` hard-wired `false` (`mock.ts:18-20`) |
| 2 | `src/lib/mcp/stub-server.ts` | **NO — confined to the test seam** | `Select-String -Pattern 'stub-server'` over `src,scripts` → `mcp.server.test.ts:32` (spawned as a real child), `cli-exit-taxonomy.test.mjs:3099`, and `check-module-coverage.mjs:93` (a coverage listing) | **CONFINED** |
| 3 | `src/lib/testing/fixtures.ts` | **NO — 28 importers, every one a `*.test.ts`** | `Select-String -Pattern 'testing/fixtures\.ts'` → `artifacts.test.ts`, `crew.test.ts`, …, `verify.test.ts` — zero non-test | **CONFINED** |
| 4 | `src/lib/cassette.ts` | **YES — the provider seam** | `Select-String -Pattern 'cassette\.ts'` → `llm/providers/deepseek.ts:44` and `llm/providers/openai-compatible.ts:73` both `import { wrapWithActiveCassette }` | **REACHABLE, OFF BY DEFAULT, IDENTITY WHEN UNARMED.** `cassette.ts:947-953`: `const init = await activeCassette(env); if (init === null) return transport;` — `activeCassette` returns `null` unless `RAPIDTOOL_CASSETTE_MODE` is set to `record`/`replay` (`CASSETTE_MODES :77-80`, `CASSETTE_MODE_ENV :79`, `CASSETTE_TAPE_ENV :82`), so an unarmed process runs the pre-cassette transport byte-for-byte. This is a deliberate, documented, env-gated **replay fixture on a production path** (`:881-904`). Not a P0 hazard by default; it *is* the one test double a production code path can serve from, and the owner rule should name it explicitly rather than leave it implied |
| 5 | `src/lib/sandbox.ts` `buildPhase6Module` (the keyless placeholder emitter) | **YES — production** | `engine.ts:36` and `codegen.server.ts:127` import it; it emits the `throw … TODO(E-15)` keyless-floor module | **REACHABLE and DISCLOSED.** The census classifies it (`stubs`/`verdict`), the K3 marking rides `TreeRunOutcome.note` (`compile-check.server.ts:839-856`), `emit --git` withholds on `empty` (`rapidtool-cli.mjs:3008-3032`), and the below-floor path refuses coded. This is an honest labelled floor, not a double pretending to be product |
| 6 | `src/lib/brief-fixtures.ts` | YES — production, **but it is not a double** | `Select-String -Pattern 'brief-fixtures\.ts'` → `doctor.ts:90`, `engine.ts:79`, `fixtures.ts:19`, `headless.ts:58`, `io.ts:18`, `maker-score.ts:59`, `scaffold.ts:88` | **PRODUCTION LOGIC** (acceptance-fixture coercion + `fixtureValueIsPlaceholder` detection). The name misleads; the bytes are real product |
| 7 | `src/lib/fixtures.ts` / `fixtures.server.ts` / `fixtures.review.ts` | YES — the acceptance-fixtures **product feature** (HITL rows), not a double | `fixtures.review.ts:15` is one of the 16 unguarded `createServerFn` sites the audit's L13 records | **PRODUCTION FEATURE**, out of the mock/stub class |
| 8 | `src/lib/product-quality.ts`, `software-export.ts` | n/a | no mock/stub/fake tokens | clean |

**Answer to the owner's question.** **No undisclosed mock, demo or stub is reachable from a production
module** — there is no P0. Two items are production-reachable and both are gated and disclosed: the
**cassette replay transport** (env-armed, identity when unarmed, `cassette.ts:947-953`) and the
**keyless-floor placeholder emitter** (labelled, withheld and refused on every delivery path). The real gap
is not a double on a path but the *measurement* of the rule: the ratchet's `testDoubleProductionImports`
reader scans the pinned **emitted trees** only (§2 R‑5), so the repo's own `src/**` — where `mock.ts` and
`stub-server.ts` live — is outside the reader that is supposed to enforce the owner's rule.

---

## 5. Corrections this lane records against its own earlier readings

Job 1's adversarial discipline applies to me too. Three readings I took mid-flight were artefacts of the
moving tree, and the bytes now disagree with them:

1. **`scripts/guards/gate-invariants.test.mjs` at ~14:19** → I measured `# tests 13 / # pass 12 / # fail 1`
   (`not ok 9 - C-14 p6-arch must fail closed`). Re-run at **~14:31** against the same mtime (14:18:35)
   → `# tests 13 / # pass 13 / # fail 0`. The lane's claim is **CONFIRMED** and my earlier red was a
   mid-write read; §1.3 records the confirmed result, not the artefact.
2. **`scripts/prevention/replay-harness.mjs` at ~14:19** had 3 TS2339 on `shapeViolations` plus 2
   `TS18048` in its test → I identified a wave-introduced typecheck regression in `restore-guards`. At the
   final pin that file is **clean** (the JSDoc at `replay-harness.mjs:1344` now declares
   `shapeViolations?:any[]`, the substance driver returns it at `:1397`/`:1405`/`:1418`, and
   `evaluateGuard:1812` / `:1984` / `:2006` consume it) — and the regression moved to the ratchet lane's
   own files. The corrected statement of R‑1 is "the **ratchet** lane's new modules", not "the guards
   lane's".
3. **`npx tsc -p tsconfig.scripts.json --noEmit`, 14:28 vs 14:31** → I first read 63 errors, all in
   `scripts/quality-ratchet.mjs`; at 14:31 the same command read 63 in `quality-ratchet.mjs` **plus 27 in
   `quality-ratchet.test.mjs`**. The pinned `quality-ratchet.mjs` bytes (14:27:46) were unchanged across
   both runs, so a second new file landed between them. R‑1 carries the 14:31 reading.

Also recorded as a **W355-audit** imprecision (not this wave's claim): the ledger's §2.7 describes a "new
`terminalStatusOf` renaming `summary.status`"; `terminalStatusOf` exists at `engine.ts:2025` and is consumed
at `headless.ts:2291` at **both** HEAD and the final working tree, and `README-cli.md:337` documents it as
the honest terminal status. The doc and the bytes agree today.

---

## 6. What I could not determine (stated plainly)

1. **The oracle emission directions end-to-end.** I verified the emitter's *bytes* (a marked, counted
   `test(id, { skip: … })` at `scaffold.ts:6267` with the shortfall on the spec header `:6038` and in the
   README census `:8105`) and measured the refuse direction (`default refuses before writing` → pass), but
   I did not build a keyless emit probe for "partial-with-unwired-rows is green **while** reporting its
   shortfall". The code carries a second gate that can still redden such a tree
   (`RT_E_SPEC_SKIP_VACUOUS`, `scaffold.ts:8284`), so the boundary between "green with a reported
   shortfall" and "refused as skip-vacuous" is **unmeasured**. `restore-oracle`'s own suite is red 3/133
   (`scaffold.test.ts` tests 10, 20, 26) at the pin, which is where that answer would come from.
2. **Whether the three `scaffold.test.ts` failures and the one `wild-step.test.ts` failure are new.**
   The W355 baseline never ran the src leg (leg 1 blocked it), so I have no pre-wave runtime reading to
   compare. They are red **now**; attribution needs a baseline run this lane did not make.
3. **`npm test`, `gate.sh`, `npm run build`** — all out of scope by instruction, so I have no
   whole-suite verdict and no lint reading. The wave's boundary owner owns those.
4. **The ratchet's `--all` reader over the real tree** was not run (only `--selftest`, which is the
   planted-regression path and also reports the real readings). Its `docClaims.uniquePaths` metric reads
   `unavailable` (`RT_E_VALIDATION: docs-module-parity.mjs produced no uniquePaths`) — I did not chase
   whether that is a genuine producer gap or a mid-edit artefact.
5. **The Wave-1 lane logs are incomplete at the pin**: `356_ratchet.md` had landed only its skeleton
   (1,405 B), `356_restore_census.md` only its header (1,654 B) / `356_restore_tests.md` its item ledger.
   Any claim those lanes make after 14:32 is unverified by me. `restore-oracle` had written **no log at
   all** at the pin, so its four emission directions are verified from bytes only.
6. **The lane diffs are not isolatable as a W356-vs-W354 diff.** No commit separates the W354 wave's
   uncommitted work from this wave's, so `git diff` reports HEAD-vs-WorkingTree only. I pinned each file's
   mtime and re-read every file whose bytes moved, but a byte that changed and changed back inside the
   window would be invisible to mtime.

---

## 7. One-line state at the pin (14:32, HEAD `30bce78`, dirty)

`restore-census` **CONFIRMED** · `restore-oracle` **PARTLY** (bytes confirm the design; its own suite is
3/133 red; two of four emission directions unmeasured) · `restore-guards` **CONFIRMED** (harness green,
34/34 guards, no cassette and no fixture edited during the wave window) · `restore-tests` **PARTLY**
(src leg clean, `doctor --project` works, ratchet not loosened and it bites — but `wild-step.test.ts` is
43/44 and the scripts leg is red on another lane's file) · `ratchet` **PARTLY** (planted-regression teeth
19/19 hold and no metric passes while `unavailable`; but `selftestOk:false`, 63 type errors in its own new
module, no `gate.sh` stage, and three floor/canary readings that cannot fire).

**8 new regressions mapped (R‑1…R‑8; R‑1/R‑2 are P0, R‑6/R‑7 disclosed-or-latent); no production-reachable
undisclosed double found (cassette replay + the keyless-floor emitter are the two gated, disclosed cases);
the biggest kind gap is that no synthesis prompt contains the delivery kind.**
