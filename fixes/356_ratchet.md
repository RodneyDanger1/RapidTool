# fixes/356 — lane `ratchet` (W356): the quality ratchet (skeleton-first)

**Lane:** W356 `ratchet` (1 of 6 sibling lanes, concurrent). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`.
**Host:** Node v24.15.0. **Wave kind:** green recovery + ratchet. **Append-only; this lane is its only writer.**

## 0. What this lane builds

The mechanism that turns "the software improves each wave" into a **pinned floor that may only rise**,
and encodes the W355 audit's measurement-integrity findings (§2.1 L1–L4, §2.3 L8–L12, §2.7) as hard
invariants so the failure mode cannot recur.

Owned files (all NEW except one additive gate stage):

- `scripts/quality-ratchet.mjs` — the ratchet (metric readers, canaries, floors, selftest).
- `scripts/quality-ratchet.test.mjs` — the ratchet's own test suite.
- `scripts/quality-ratchet.floors.json` — the pinned floors (data).
- `scripts/gate.sh` — **one additive stage** (`ratchet`) + its verdict fold.

## 1. Skeleton (filled in by the appends below)

- [ ] metric table with initial floor + exact producing command
- [ ] reader canaries (one per code-reader metric)
- [ ] `realProductOnly` reader (owner rule 1)
- [ ] `kindFit` reader (owner rule 2)
- [ ] gameable metrics + how each was blocked
- [ ] planted-regression result (selftest teeth)
- [ ] tree-state disclosure (red tree ⇒ `pending-first-green` pins)

<!-- appends below this line -->

---

## 2. What landed (three NEW files + one additive gate stage)

| Path | Bytes | What |
|---|---|---|
| `scripts/quality-ratchet.mjs` | 75,861 | the ratchet: metric readers, reader canaries, the floor evaluator, the planted-regression selftest, the CLI |
| `scripts/quality-ratchet.floors.json` | 23,421 | the pinned floors + the declared canary contract (data) |
| `scripts/quality-ratchet.test.mjs` | 24,100 | 26 tests, all green |
| `scripts/gate.sh` | +26 lines | **ADDITIVE**: one `ratchet` stage, one argv addition, one `gates.ratchet` parse block, one conjunct in `nonTestGatesOk`, one id in the stderr tail list |

Nothing else was touched: no existing script's logic, no `src/**` module, no doc, no register, no other lane's log.
The gate stage is placed AFTER `build` (it reads the other stages' own readings), and the fold is
`gates.moduleCoverage.ok && gates.build.ok && gates.ratchet.ok` — strictly tightening, never relaxing,
and it cannot mask another stage: every other stage's exit is still folded exactly as before.

Verification commands (exact):

```
cd "C:\Users\mnril\Desktop\RapidTool Main"
node --test --test-reporter=tap scripts/quality-ratchet.test.mjs   # 26 pass / 0 fail / 0 skipped, 18s
node scripts/quality-ratchet.mjs --all                             # the real reading: ok:true, 0 regressions
node scripts/quality-ratchet.mjs --selftest                        # 19 teeth hold, 21/21 enforced floors beaten
& 'C:\Program Files\Git\bin\bash.exe' -n scripts/gate.sh           # bash syntax OK (never the full gate)
```

---

## 3. The metric table — initial floor, pin status, and the EXACT producing command

Readings are what the producers returned when the pin was written (this tree is RED and five sibling
lanes were editing it concurrently, so several values moved under me; every move is stated).

| metric | dir | floor | status | reading at pin | producing command |
|---|---|---|---|---|---|
| `gate.ok` | atLeast | 1 | pending-first-green | `unavailable` (`RT_E_RUNNER_UNAVAILABLE`) | `bash scripts/gate.sh` → verdict `.ok`; supply with `--gate <verdict.json>` |
| `typecheck.errors` | atMost | **0** | **enforced** | **0** (was 2 at first pin) | `npm run typecheck` (`npx tsc --noEmit`); count of `error TS` lines |
| `lint.problems` | atMost | 0 | pending-first-green | **947** (was 942) | `npm run lint` (`eslint .`) → `N problems` |
| `tests.scripts.pass` | atLeast | 1 | pending-first-green | `unavailable` standalone | `node --test --test-reporter=tap "scripts/**/*.test.mjs"` (gate.sh `testsScripts` leg) |
| `tests.scripts.fail` | atMost | 0 | pending-first-green | `unavailable` standalone | same leg → `# fail` |
| `tests.lib.pass` | atLeast | 1 | pending-first-green | `unavailable` standalone | `node --experimental-strip-types --test --test-reporter=tap "src/lib/**/*.test.ts" "src/components/**/*.test.ts"` |
| `tests.lib.fail` | atMost | 0 | pending-first-green | `unavailable` standalone | same leg → `# fail` |
| `prevention.missed` | atMost | **0** | **enforced** | **0** | `node scripts/prevention/verify-prevention.mjs --all --selftest` → `.fixtureIntegrity.missed` |
| `prevention.pending` | atMost | **0** | **enforced** | **0** (was 1 = `["C-14"]`) | same → `.fixPresence.pending` |
| `prevention.guards` | atLeast | 34 | enforced | 34 | same → `.count` |
| `prevention.countFloor` | atLeast | 34 | enforced | 34 | same → `.countFloor` |
| `tree.corpusSize` | atLeast | 13 | enforced | 13 | `scripts/prevention/cassettes/trees.json` (the pinned tree list) |
| `tree.jobScopedRealTrees` | atLeast | **6** | **enforced** | **6** | `src/lib/compile-check.server.ts#treeSubstanceOf(dir).jobScoped.verdict` over the pinned trees |
| `tree.tscPassSample` | atLeast | 0 | pending-first-green | 1 (`{"sampled":1,"resolved":1}`) | `compile-check.server.ts#treeRun(dir).project.typecheck.run` — opt-in `--tree-tsc[=N]` |
| `realProductOnly.stubProductionModules` | atMost | 0 | pending-first-green | **3** | `quality-ratchet.mjs#scanRealProduct` + `dod.ts#classifyModuleSource` |
| `realProductOnly.markerViolations` | atMost | **0** | **enforced** | **0** | same (attribute forms excluded) |
| `realProductOnly.testDoubleProductionImports` | atMost | **0** | **enforced** | **0** | same |
| `realProductOnly.treesEvaluated` | atLeast | 13 | enforced | 13 | same |
| `productQuality.recordsEvaluated` | atLeast | 25 | enforced | 25 | `src/lib/product-quality.ts#readProductQuality` over `testruns/**/build*.json` + `.rapidtool/project.json` |
| `productQuality.qualityCount` | atLeast | 0 | enforced (reading-pinned) | 0 of 25 | `readProductQuality(record).quality` |
| `docClaims.mismatches` | atMost | 0 | pending-first-green | **2** | `node scripts/docs-module-parity.mjs` → `missingCount + emptyCount` |
| `docClaims.uniquePaths` | atLeast | 61 | enforced | 61 | same → `uniquePaths` |
| `acceptance.samples` | atLeast | 1 | enforced | 1 | `research/eval-out/**/verdict.json` (acceptance-run), else `results.json` `entries[].acceptance` |
| `acceptance.passCount` | atLeast | 0 | enforced (reading-pinned) | 0 of 1 | same → `.acceptance.pass` |
| `kindFit.app.units` / `.fit` | atLeast | 30 / 0 | enforced | 30 / **0** | `quality-ratchet.mjs#kindFitOf` (entry shape + declared scripts + kind surface) |
| `kindFit.game.units` / `.fit` | atLeast | 1 / 0 | enforced | 1 / **0** | same |
| `kindFit.library.units` / `.fit` | atLeast | 1 / 0 | enforced | 1 / **0** | same |
| `kindFit.tool.*` · `kindFit.service.*` | — | `null` | **uncovered** | 0 units | same — UNCOVERED, never `pass` |

**On `pending-first-green`.** A `pending-first-green` pin already names the HONEST bar (0 for every defect
count) and records the reading; it is simply not enforced yet because the tree is red. The red tree
weakened NOTHING. Two pins were flipped to `enforced` the moment their honest bar was measured MET
(`typecheck.errors` 2→0, `prevention.pending` `["C-14"]`→`[]`), because a met bar that stays unenforced is
a toothless floor. Reading-pinned floors (`floor == today's reading`, flagged `readingPinned: true`) are
explicitly NOT targets: they lock in today's value so any rise is permanent.

**Honest disclosure — the tree moved under me.** The first pin of `prevention` read `missed: ["C-06"]`,
`pending: ["C-14"]` (matching `fixes/355_0_audit_wave.md` §2.3/§3). Minutes later the same command read
`missed: []`, `pending: []`. Likewise `tsc` went 2 errors → 0, and `lint` 942 → 947 problems. All are
sibling W356 lanes landing fixes; nothing here was edited to reach a floor. And the census: at first pin
the whole-tree verdict read **13/13 non-empty / 0/13 literal `real`** (the W355 A2-F3 shape); on the
current bytes it reads **6/13, identical to the job-scoped verdict** (a sibling lane's fix). The ratchet's
reading is unaffected either way, because it reads the JOB-SCOPED sub-census only and its scope canary
proves the scope from independently computed bytes.

---

## 4. Reader canaries — the anti-regression core (the direct fix for the C-06 failure mode)

17 canaries, all green on the real tree, each declared in `quality-ratchet.floors.json#canaries` and
checked for one-to-one agreement with the implemented set (`canary.registry.complete` — a canary cannot be
silently dropped from either side). Each asserts the reader's STRUCTURE **and**, where possible, that the
reader still DISCRIMINATES (a reader that merely exists is not a guard).

| canary | reader | structural | discriminating |
|---|---|---|---|
| `canary.census.job-scoped-reachable` | `treeSubstanceOf` | `jobScoped` reachable; numeric `stubs/reexports/real`; `verdict ∈ {real,mixed,stub-skeleton,empty}` | a reader that stops exposing `jobScoped` trips it (selftest) |
| `canary.census.job-scoped-scope-pinned` | `treeSubstanceOf` | the `jobScoped` FILE LIST equals the job-dir set (`src/jobs/*` + `jobs/*`, top-level `.ts/.js/.mjs`) computed **independently** from the bytes | an aliased `jobScoped` (the whole-tree file list) trips it; the pinned scope passes it — both proved in the selftest |
| `canary.census.classifier-discriminates` | `dod.ts#classifyModuleSource` | — | TODO(E-15) → `stub`, reexport-only → `reexport`, real body → `real`; a classifier returning `real` for everything trips it (selftest) |
| `canary.surface.readers-present` | `product-quality#readProductQuality` + `dod#productSurfaceKindOf` + `dod#briefDeliveryKind` | all three exported | `readProductQuality({})` must fail closed to `quality:false` with reasons |
| `canary.surface.kind-discriminates` | `dod#productSurfaceKindOf` | — | game→`game`, tool→`runnable`, app+page-words→`web` |
| `canary.surface.entry-shape-discriminates` | `acceptance-run.mjs#resolveTreeEntry` | — | game with no `index.html`+src mount → NOT ok; with both → ok |
| `canary.realProduct.scan-discriminates` | `scanRealProduct` | — | clean list → 0 violations; injected defect (`TODO(E-15)` + `__mocks__` import) → >0 |
| `canary.realProduct.no-attribute-false-positive` | `scanRealProduct` | — | `placeholder="…"` / `placeholder: '…'` are NOT flagged |
| `canary.docParity.not-vacuous` | `docs-module-parity.mjs` | ≥1 doc read, ≥1 unique path | a scan that finds nothing is vacuous, not a pass |
| `canary.prevention.two-signal-shape` | `verify-prevention.mjs` | BOTH signals present (`fixtureIntegrity.missed` ∧ `fixPresence.pending`) + numeric `count`/`countFloor` | — |
| `canary.prevention.countFloor-not-lowered` | `verify-prevention.mjs` | the harness's own `countFloor` ≥ the ratchet's pinned `prevention.guards` floor | blocks lowering `guard-floor.json` in the same edit as a guard deletion |
| `canary.errorCodes.registered` | `src/lib/errors.ts` | every `RT_E_*` the ratchet emits resolves in `ERROR_CODES` (read from the file, not restated) | — |
| `canary.gateReadings.results-keys-present` | `gate.sh` results file | every required stage key present — a missing key is never "no failures" | — |
| `canary.gateReadings.typecheck-log-is-tsc` | `gate.sh typecheck.log` | a non-zero exit carries ≥1 `error TS` line | a replaced/empty log cannot read as a measurement |
| `canary.gateReadings.lint-log-is-eslint` | `gate.sh lint.log` | a non-zero exit carries eslint's `N problems` summary | — |
| `canary.gateReadings.test-leg-not-vacuous` | `gate.sh` leg logs | green ⇒ `# pass` ≥ 1; red ⇒ ≥1 `# fail`/`not ok` | a silent leg cannot read as a passing one |
| `canary.registry.complete` | the floors file | declared canary set ≡ implemented canary set | — |

---

## 5. The two owner-rule readers

### 5.1 `realProductOnly` — "no mock, stub, fake, demo, or placeholder code on any production path"

A pure scan (`scanRealProduct(files, classify)`) over the emitted tree's real bytes; the classifier is the
repo's ONE shared classifier (`dod.ts#classifyModuleSource`), injected so this module re-implements nothing.
A production path is any code module that is NOT a test seam (`*.spec.*`, `*.test.*`, `tests/**`,
`__tests__/**`, `__mocks__/**`, `__fixtures__/**`). Violation kinds:

1. **`stub-module`** — `classifyModuleSource(source) === "stub"` (blank / `TODO(E-15)` / throw-TODO /
   deterministic P6 template). The matched marker is recorded per violation.
2. **`marker`** — an explicit placeholder / not-implemented marker: `NOT_IMPLEMENTED`, `is not published by
   this build`, `Lorem ipsum`, `MOCK_*|FAKE_*|STUB_*|DEMO_*|PLACEHOLDER_*` constants, `mockData|fakeItems|
   placeholderRows|…`. Deliberately NARROW: the bare word `stub` and a `placeholder=` **attribute** are
   legitimate product bytes.
3. **`test-double-import`** — a production module importing `__mocks__/`/`__fixtures__/` or `*.mock.*`.
4. **`test-double-api`** — a production module calling `vi.mock(`/`jest.fn(`/`sinon.stub(`/`mockImplementation`.

Readings (pinned emitted-tree corpus, 13 trees, 89 real / 3 stub / 52 reexport code modules):
`stubProductionModules` **3** (`bakery-website/emitted:src/ui/console.tsx`,
`mobile-companion/emitted:src/main.ts`, `mobile-companion/emitted:src/ui/console.tsx` — all `TODO(E-15)`);
`markerViolations` **0**; `testDoubleProductionImports` **0**; `treesEvaluated` **13**.
The `reexportModules` count (52 = 4 per tree) is REPORTED, not forbidden: the `src/generated.ts` barrel is
machine assembly (the `dod.ts` §P2 exemption), not a placeholder. The 3 stubs are a real finding and are
pinned at the honest bar 0 (`pending-first-green`), not at 3.

**False-positive control (a false positive here is as bad as a miss).** The corpus contains exactly two
`placeholder` hits and both are UI attributes — `'<input … placeholder="sourdough, croissant, cake" />'`
and `placeholder: 'Search products'`. The reader flags neither; this is pinned by a canary (synthetic) AND
a test that reads the two REAL corpus files and asserts neither is flagged.

### 5.2 `kindFit` — "the factory must take the requested kind into account and deliver the best version of it"

`kindFitOf(units, readers)` compares the EMITTED artifact against the REQUESTED kind on three legs, all
from existing producers: **entry shape** (`acceptance-run.mjs#resolveTreeEntry(files, pkg, kind)` —
`index.html` + a src mount for app/game; a real `bin`/`main`/`src/main|cli` entry for tool/service/library),
**declared scripts** (the tree's own `package.json`: `typecheck`+`test` for every kind, `+build` for
web kinds), and **the kind's required surface** (`product-quality` `kindSurface` via
`fleetProductQualityFromProjects` — the same per-kind rule the fleet reader uses, not a second rule).
A fourth, stricter leg: the demanded surface must actually MATCH the requested kind (an app request whose
record declares no page surface is a mismatch, reported by name).

Corpus = the pinned 13 emitted trees (requested kind = the record's stamped `kind`) + the 19
`research/eval-out/<slug>` emit trees for the eval-corpus briefs (requested kind = the fixture's
frontmatter `kind`, normalized `webapp→app`, `cli-tool→tool`). **32 units.**

| kind | units | fit | entryOk | surfaceOk | scriptsOk | demandedMatch |
|---|---|---|---|---|---|---|
| app | 30 | **0** | 29 | **10** | 29 | 20 |
| game | 1 | **0** | 1 | 0 | 1 | 1 |
| library | 1 | **0** | 1 | 0 | 1 | 1 |
| tool | **0** | uncovered | — | — | — | — |
| service | **0** | uncovered | — | — | — | — |

**kindFit = 0 of 32.** The binding leg is the kind's required surface (10/30 for app; 0 for the single game
and the single library). `tool` and `service` have an eval-corpus FIXTURE but no emitted artifact on disk,
so they report **`uncovered`** with `floor: null` — never `pass`, never a fabricated 1. This corroborates
the W355 §2.6/L27 finding honestly: kind coverage is thinner than claimed.

---

## 6. Metrics judged GAMEABLE, and exactly how each is blocked

| gameable in this way | metric | block |
|---|---|---|
| **Edit a reader so it reads "real" for everything** (the A2-F3 mode: 6/13 → 13/13 with zero product change) | `tree.jobScopedRealTrees` | read the **job-scoped sub-census ONLY**; `canary.census.classifier-discriminates` (one `real` for everything ⇒ FAIL) + `canary.census.job-scoped-reachable` (field renamed/removed ⇒ FAIL) + `canary.census.job-scoped-scope-pinned` (scope re-pointed ⇒ FAIL, verified against independently computed job-dir bytes) |
| **Widen the census scope** so an empty tree reads real | `tree.jobScopedRealTrees` | the scope canary above — a scope change to `jobScoped` fails by name, and the metric's denominator (`tree.corpusSize`) is pinned |
| **Delete evidence** (corpus trees / records / acceptance cases) so a rate rises | every rate | a denominator floor per rate: `tree.corpusSize ≥ 13`, `realProductOnly.treesEvaluated ≥ 13`, `productQuality.recordsEvaluated ≥ 25`, `acceptance.samples ≥ 1`, `kindFit.<k>.units ≥ 30/1/1` |
| **Edit untracked fixtures** so a guard stops firing or its fixer looks wired (L11) | `prevention.missed` / `.pending` / `.guards` | four INDEPENDENT pins, plus `prevention.countFloor ≥ 34` (so deleting a guard cannot be paired with lowering `guard-floor.json`), plus `canary.prevention.two-signal-shape` (one signal cannot stand in for two) |
| **Grader-JSON / stale-record edit flips a case green** (L11: the freeze is in-run only, the `stale` flag was dropped) | `acceptance.passCount` | the reader reports `stale` and `mode` in the evidence and NEVER drops the flag; the sample count is pinned so a lone passing case cannot become the rate; the producer is named in the verdict |
| **Weaken `product-quality.ts` / the census to reach a floor** | `productQuality.*`, `tree.*` | forbidden by the lane's contract AND caught: the reader is called AS IS, `canary.surface.readers-present` requires `readProductQuality({})` to fail closed to `quality:false`, and the floors for these are reading-pinned (0) rather than aspirational, so there is nothing to gain by weakening the reader |
| **Make a metric `unavailable` and call it a pass** | every metric | `unavailable` is never `ok`; on an `enforced` pin a BROKEN/ABSENT producer (`RT_E_PROJECT_MISSING`, `RT_E_VALIDATION`) is a HARD failure; an unsupplied input (`RT_E_RUNNER_UNAVAILABLE`) is reported loudly under `unavailable[]` and is still never a pass |
| **Delete the gate stage / un-fold it** | the stage itself | the stage passes this run's OWN readings (`--gate "$WINTMP"`), its exit is folded into `nonTestGatesOk`, and `quality-ratchet.test.mjs` asserts the wiring AND that every existing stage still runs before it |
| **Make a test leg "green" with no tests** (`--test-name-pattern` no-op trap / empty glob) | `tests.*.pass` | `pass ≥ 1` is the floor, and `canary.gateReadings.test-leg-not-vacuous` re-derives it from the TAP log |
| **Replace a red log with an empty one** | `typecheck.errors` / `lint.problems` | `canary.gateReadings.typecheck-log-is-tsc` (a red exit must carry `error TS`) and `…lint-log-is-eslint` (a red exit must carry `N problems`); a green exit is read as 0, never as `null` |
| **Assume the gate is green inside its own stage** | `gate.ok` | `unavailable` in-stage by construction (the verdict is produced AFTER the stage) — never assumed true; the boundary owner supplies it |
| **Call a missing reading "0"** | `docClaims.mismatches` | the reader returns `null` (unmeasurable) unless BOTH counts are present — the first implementation turned a broken parse into `0` and was caught and fixed by the `canary.docParity.not-vacuous` failure; a vacuity floor (`docClaims.uniquePaths ≥ 61`) sits beside it |
| **Sample-shopping** the heavy tree-run producer | `tree.tscPassSample` | opt-in only; the sample size rides in `evidence.sampled`; the floor stays 0 so a lucky 1/1 sample cannot be pinned as the bar |
| **Fabricate a cost** | all | `estimatedCostUsd: null` in the floors file, in every verdict, and asserted by the selftest + test |

---

## 7. The planted-regression result (teeth)

`node scripts/quality-ratchet.mjs --selftest` → **ok:true, 19 teeth, 21/21 enforced floors beaten → caught.**

Sorted teeth (every one a proof, not a claim):

- `floors.directions-legal`, `floors.every-metric-names-a-producer`, `floors.estimatedCostUsd-null`
- `planted.clean-run-is-not-red` — the floors are satisfiable at their own floor values.
- `planted.every-enforced-floor-fails-when-beaten` — for **every** enforced numeric pin, `floor−1` (atLeast)
  or `floor+1` (atMost) MUST land that metric in `regressions[]`, by name.
- `planted.teeth-cover-a-nonzero-floor-set` — `21/21`.
- `unavailable.enforced-metric-with-broken-producer-hard-fails` / `…unsupplied-producer-is-reported-not-failed`
  / `unavailable.pending-metric-does-not-fail`
- `uncovered.never-passes` — the four `kindFit.{tool,service}` pins are `uncovered`, never `ok`.
- `canary.census.job-scoped-scope-pinned-has-teeth` + `…accepts-the-pinned-scope` — the scope canary both
  fires on an aliased `jobScoped` and passes on the pinned scope (the C-06 failure mode, reproduced in
  memory and rejected).
- `canary.census.job-scoped-reachable-has-teeth`, `canary.classifier-discriminates-has-teeth` — a reader
  that stops exposing the field, and a classifier that calls everything `real`, both FAIL.
- `canaries.declared-and-implemented-agree`, `canaries.real-tree-all-pass`, `codes.registered-in-errors.ts`,
  `real-tree.no-enforced-floor-breached`.

**No cry wolf on the real tree:** `--all` → `ok:true`, `regressions: []`, `canaryFailures: []`,
`unavailableEnforced: []`. Every `unavailable` on the real tree is an unsupplied input (the gate's own
stages) or the opt-in heavy producer, named with its code and the exact command that supplies it.

**The gate fold has teeth (proved without running the full gate).** Driven through gate.sh's own verdict
program with this run's real stage readings + a labelled TAP fixture:

| case | result |
|---|---|
| every stage green **and** the ratchet green | `ok:true`, exit 0 — the fold is not a permanent red |
| every stage green but the ratchet RED (planted `regressions:["prevention.guards …33"]`) | `ok:false`, exit 1, `gates.ratchet.regressions` carries the named cause |
| a stage RED (typecheck) and the ratchet green | `ok:false`, exit 1, `gates.typecheck.ok:false`, `gates.ratchet.ok:true` — the ratchet masks nothing |
| an UNPARSEABLE ratchet log + `ratchet.exit 1` | `ok:false`, exit 1 — fail closed |
| the gate's own results fed to the ratchet (`--gate <tmpdir>`) | reads the REAL stage producers: `typecheck.errors 2`, `lint.problems 942`, `tests.scripts.fail 1`, `prevention.missed 0`, and with the flipped `typecheck.errors` pin an enforced `regressed` |

Stage cost: `--all --gate <gate tmpdir>` = **9.3 s** (it re-runs nothing; the prevention reading is taken
from the gate's own log). Standalone `--all` = 36 s (17 s of it the spawned prevention harness).

---

## 8. Honest limits / unverified

- **No new `RT_E_*` code was minted.** The plan permits extending `ERROR_CODE_DOC` "if needed"; the scope
  (`three new files + one additive gate stage. Nothing else`) and the hard constraint (do not edit any
  `src/**` module) forbid it, so every `unavailable` reason reuses an EXISTING registered code chosen by
  cause: `RT_E_RUNNER_UNAVAILABLE` (producer not run in this invocation), `RT_E_PROJECT_MISSING`
  (artifact/record absent on disk), `RT_E_VALIDATION` (a reader's shape no longer validates — the C-06
  class). `canary.errorCodes.registered` reads `src/lib/errors.ts` and FAILS if one of these stops being a
  registered code. **Follow-up for the owner:** if a first-class code is wanted, mint
  `RT_E_RATCHET_METRIC_UNAVAILABLE` ("a pinned floor could not be measured") — one lane, one addendum.
- **The test legs are `unavailable` standalone.** The ratchet does not re-run two 4-minute legs; its stage
  reads gate.sh's own TAP logs. That path is wired and exercised (simulation + canaries), but the
  `tests.*` FLOORS were never enforced against a real gate log in this lane — the parent's boundary run is
  the first real exercise. They are pinned `pending-first-green` precisely because they have not been
  measured here; pinning a pass count I never measured would be fabrication.
- **`tree.tscPassSample` is a one-tree sample.** `--tree-tsc=1` was run (real `treeRun`, 1 resolved, 1
  green). That is NOT a corpus rate and is NOT presented as one; the audit's L27 claim (tool/service/library
  each failed their own tsc) is cited, not re-derived.
- **`acceptance.*` is weak evidence, stated as such.** The only acceptance artifact on disk is
  `research/eval-out/results.json` (`mode:"keyed"`, **`stale:true`**, 1 entry, 0 pass); the
  `acceptance-run.mjs` `verdict.json` path has produced nothing. The reader reports the `stale` flag rather
  than dropping it (W355 L4), and the floor pins the sample count so a single case cannot become a rate.
- **`docs-module-parity.mjs` stays advisory.** Its 2 mismatches are read as DATA (`docClaims.mismatches`,
  `pending-first-green`) and it is spawned, never promoted into a failing gate of its own — promoting it
  would change a contract this lane does not own.
- **The lint finding is recorded, not fixed.** 934 of 947 problems come from the vendored `testruns/**`
  corpus (173 files) that `eslint .` crawls; 13 come from the repo's own 394 files. Fixing that means
  scoping `eslint`, which is outside this lane's ownership.
- **No full gate was run** (the parent owns the boundary), no keyed LLM call was made, and there were no
  git writes. `scripts/gate.sh` was syntax-checked (`bash -n`) and its verdict program was extracted and
  `node --check`ed, then driven directly with fixture inputs — the stage itself has not yet run inside a
  real gate invocation.
- **Nothing outside the four owned files was written**, except two temp fixtures under `%TEMP%`
  (`rt-w356-heredoc.cjs`, `w356-gatesim/`) used to wire-check gate.sh without running it.


---

## 9. Close-out append (append-only corrections + two findings this lane surfaced)

**§1's checklist is satisfied by §§3–8** (metric table + producing commands, canaries, both owner-rule
readers, the gameable list, the planted-regression result, the red-tree disclosure).

**Final byte counts** (superseding the §2 table, which recorded the pre-typing-fix sizes; the files grew
by the JSDoc/type annotations the scripts-tree typecheck requires):
`scripts/quality-ratchet.mjs` 77,626 · `scripts/quality-ratchet.floors.json` 23,421 ·
`scripts/quality-ratchet.test.mjs` 24,212. `scripts/gate.sh` grew from 519 to 545 lines.

**Final verification (all re-run after the last edit):**

| command | result |
|---|---|
| `node --test --test-reporter=tap scripts/quality-ratchet.test.mjs` | **26 pass / 0 fail / 0 skipped** |
| `node scripts/quality-ratchet.mjs --all` | `ok:true`, `regressions:[]`, `canaryFailures:[]`, `unavailableEnforced:[]` |
| `node scripts/quality-ratchet.mjs --selftest` | `ok:true`, 19 teeth hold, **21/21** enforced floors beaten → caught |
| `node scripts/check-assertion-gaps.mjs --json` | 168 files, **0 findings** |
| `npx tsc -p tsconfig.scripts.json --noEmit` | **0 errors** (this covers the two new files) |
| `node --test --test-reporter=tap scripts/typecheck-scripts.test.mjs` | **6 pass / 0 fail** |
| `node scripts/docs-module-parity.mjs` | unchanged (`missingCount 2`, `emptyCount 0`) — adding files cannot add a doc claim |
| `& 'C:\Program Files\Git\bin\bash.exe' -n scripts/gate.sh` | exit 0 (syntax only — the full gate was NOT run) |

**Finding (recorded, not fixed — outside this lane's ownership).** `scripts/typecheck-scripts.test.mjs`
types every `scripts/**/*.mjs` through `tsconfig.scripts.json` with an EMPTY per-file error budget, so any
new scripts file must be type-clean under `allowJs`+`checkJs` and `strictNullChecks` (with
`noImplicitAny` off). The first draft of these two files produced **100** such errors — almost all from
JSDoc `@param` shapes on a DESTRUCTURED parameter (TypeScript binds `@param {T} name` to the binding name,
so `@param` tags naming destructured properties are rejected with TS8024 and the properties lose their
types). The fix is a one-line signature change (`evaluate(args)` then destructure) plus looser types on the
internal plumbing; the public contract stays documented in `quality-ratchet.floors.json` and here. Worth
knowing for the next scripts lane: **an untyped `.mjs` script can pass `node --test` and still fail the
gate on `scripts/typecheck-scripts.test.mjs`**, and the budget is empty, so there is nowhere to hide it.

**Finding (recorded).** `eslint .` crawls the vendored `testruns/**` corpus: 934 of the tree's 947 lint
problems come from 173 fixture files, versus 13 from the repo's own 394 files. The `lint.problems` floor
stays at 0 and is pinned `pending-first-green`; the fix is scoping eslint, which this lane does not own.
