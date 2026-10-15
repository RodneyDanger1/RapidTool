# W355 · lane `reviewer-proof` — the proof layer ("who audits the auditors")

**Wave:** W355 / batch 355b. **Kind:** read-only code review. **Author:** the wave parent.
**Scope:** the 34 prevention guards, the keyless replay harness, `gate.sh`, the assertion-gap /
module-coverage / doc-parity probes, the skip registry, `run-eval.mjs`, the eval corpus + its
graders, the tracked eval results, the browser-smoke verdict logic, and the honesty of the test
suite itself.

**Baseline under audit:** HEAD `30bce78` + the uncommitted "354 wave" working tree (`npx tsc --noEmit`
exits 2 with 5 errors; `npm test` exits 1 with 622 tests / 607 pass / 15 fail).

---

## 1. Method — exact commands

All commands run from `C:\Users\mnril\Desktop\RapidTool Main`. No `npm test`, no `npm run build`,
no `gate.sh`, no keyed LLM call, no writing git command. The one file written is this report.

**The single prevention command (the parent's starting evidence, reproduced):**

```
node scripts/prevention/verify-prevention.mjs --all --selftest
→ exit 1
{"ok":false,"guards":34,"count":34,"countFloor":34,...,
 "fixtureIntegrity":{"fired":[33 ids],"missed":["C-06"]},
 "fixPresence":{"enforced":[33 ids],"pending":["C-14"]},
 "fired":[...],"missed":["C-06"],"pending":["C-14"],"skipped":[],
 "controlMissed":[],"floorViolations":[]}
```

**Per-guard two-signal dump** (the ledger in §2 is built from this, not from the registry prose):

```
node --experimental-strip-types -e "<import replay-harness.mjs; for each registry guard
  print evaluateGuard(g,rc).fired/controlClean and evaluateSeam(g,rc).present/wired/mutationRed>"
→ 33/34 FIRE+controlClean; C-06 FIRE=----; C-14 mutationRed=false; all others p|w|m
```

**Targeted per-file test runs (allowed; no `npm test`):**

```
node --experimental-strip-types --test --test-reporter=tap scripts/prevention/replay-harness.test.mjs
  → tests 15 · pass 13 · fail 2
     not ok 4  - C-06 real seam: treeSubstanceOf reports the hollow trees as empty
     not ok 12 - single command: the two signals are reported and the gate of record is exact
node --experimental-strip-types --test --test-reporter=tap scripts/guards/gate-invariants.test.mjs
  → tests 13 · pass 12 · fail 1   (not ok 9 - C-14 p6-arch must fail closed …)
node --experimental-strip-types --test --test-reporter=tap \
  scripts/guards/repair-monotonic.test.mjs scripts/guards/campaign-invariants.test.mjs \
  scripts/guards/campaign2-invariants.test.mjs scripts/guards/campaign-pins.test.mjs \
  scripts/guards/enabling-wave-invariants.test.mjs scripts/guards/final-wave-invariants.test.mjs
  → tests 31 · pass 31 · fail 0
node --experimental-strip-types --test --test-reporter=tap \
  scripts/gate-verdict.test.mjs scripts/run-eval.test.mjs scripts/check-module-coverage.test.mjs \
  scripts/check-assertion-gaps.test.mjs scripts/browser-smoke-verdict.test.mjs
  → tests 156 · pass 154 · fail 2
     not ok 78 - module-coverage: a stale allowlist entry (module now reached) fails the guard
     not ok 79 - module-coverage: the CLI runs green on the live repo and exits 0
node --experimental-strip-types --test --test-reporter=tap scripts/typecheck-scripts.test.mjs
  → tests 6 · pass 4 · fail 2
     not ok 2 - scripts typecheck: no NEW errors beyond the recorded per-file budget
     not ok 3 - scripts typecheck: npm run typecheck runs BOTH legs (src + scripts)
```

**Direct probes (read-only, scratch/temp only):**

```
node --experimental-strip-types -e "<treeSubstanceOf(..,{green:true}) over all 13 cassette trees,
  printing top-level verdict+real and jobScoped.verdict>"      # §5, the 6/13 → 13/13 measurement
node --experimental-strip-types -e "<DOD[6] p6-arch probe on
  readJsonFile(testruns/office-stock-tracker/build.json) vs headless.loadProject(..)>"
node --experimental-strip-types -e "<importSpecifiers('// import ...')>"   # comment-only specifiers
node scripts/check-module-coverage.mjs --json
node scripts/check-assertion-gaps.mjs
node scripts/check-assertion-gaps.mjs src/components
node scripts/docs-module-parity.mjs
npx tsc -p tsconfig.scripts.json --noEmit
node --experimental-strip-types scripts/rapidtool-cli.mjs eval --dir research/eval-out   # read-only verb
git ls-files testruns | Measure-Object ; git status --porcelain -- testruns
git status --porcelain scripts/prevention/cassettes/guard-floor.json
git ls-files --error-unmatch scripts/prevention/cassettes/guard-floor.json
git diff --stat HEAD -- src/lib/compile-check.server.ts
git show HEAD:src/lib/compile-check.server.ts   # the pre-354 treeSubstanceOf
git show HEAD:src/lib/product-quality.ts        # → "exists on disk, but not in 'HEAD'"
```

Reads (not commands): `scripts/prevention/{replay-harness.mjs,verify-prevention.mjs,README.md}`,
`scripts/guards/{guard-registry.json,delivery-gate.test.mjs,gate-invariants.test.mjs,repair-monotonic.test.mjs,enabling-wave-invariants.mjs,final-wave-invariants.mjs}`,
`scripts/{gate.sh,run-eval.mjs,check-assertion-gaps.mjs,check-module-coverage.mjs,docs-module-parity.mjs,skip-registry.json,typecheck-scripts.test.mjs,test-name-pattern-guard.test.mjs,browser-smoke-verdict.mjs}`,
`src/lib/{compile-check.server.ts,dod.ts,product-quality.ts,scorecard.ts}`, `research/eval-corpus/**`,
`research/eval-out/results.json|history.json`, `package.json`, `.gitignore`.

**Not run (stated, not hidden):** `scripts/guards/delivery-gate.test.mjs` — it spawns the real CLI
with `--git`; I read it and measured its predicate instead of executing a possible write. `gate.sh`
itself (forbidden). `npm test` / `npm run build` (forbidden). Any keyed eval (forbidden).

---

## 2. Guard ledger — one row per registry guard

`FIRE` = `evaluateGuard().fired` on the current tree; `ctl+` = the clean control stayed silent;
`seam` = `fixPresence.present ∧ wired ∧ mutationRed`. "Fixture independent?" asks whether the
*fixture-integrity* signal is measured against an artifact other than the guard module itself.

| id | what it detects | fires on a planted defect? | fixture independent? | verdict |
|---|---|---|---|---|
| C-01 | brief-driven minimum file set / under-production census (`RT_E_PLAN_UNDERPRODUCED`) | FIRE (spawns `tree-invariants.mjs --root testruns`, finds the code on 8 fixtures) | yes — `testruns/*/emitted*`, **untracked bytes** | real detector, mutable fixture |
| C-02 | cross-chunk duplicate export / barrel collision (TS2308) | FIRE (real `getDailyRevenueByCategory` ×2 in `bakery-florist-orders/emitted`) | yes — untracked tree | real detector, mutable fixture |
| C-03 | use-before-declaration / TDZ (TS2448) | FIRE (`globalThisStore` L69 < L70 in `mobile-companion/emitted`) | yes — untracked tree | real detector, mutable fixture |
| C-13 | money-arithmetic / domain semantics | FIRE (`computeCartTotalPence` accumulates quantity only) | yes — untracked tree | real detector, mutable fixture |
| C-09 | README "What ships" vs disk | FIRE (`readme-parity.mjs` over `office-scheduler/emitted`) | yes — untracked tree | real detector, mutable fixture (2-entry allowlist `assets/`,`public/` w/ reasons) |
| C-11 | RUNLOCK / src-mtime preflight | FIRE — but the *fixture signal* is `grep /historical overlap: ok \(refuse/` over the guard's own `--selftest` stdout (`replay-harness.mjs:1364-1371`) | **no — the guard grades its own selftest print** | self-reporting fixture signal |
| C-06 | substance-based delivery gating (`RT_E_SUBSTANCE_EMPTY`) | **MISS** | no — driver scans the 13 trees for `verdict === "empty"` and ignores the registry's declared `historicalFixture` | **BROKEN** (§3.1) |
| C-04 | monotonic repair + no-progress abort | FIRE (real `repair.json`, real `treeVerdictScore`/`failureSignature`) | yes — untracked `repair.json` | real detector |
| C-05 | behavioural-spec guard vs skipped `assert.fail` | FIRE (real `specSourceHasBehaviouralAssert` on the real oracle + a live control) | yes — untracked spec | real detector, strongest seam in the set |
| C-12 | classifier contract + out-of-scope stripping | FIRE (real `inferDomain` on the real briefs + a genuine real-estate control) | yes — untracked briefs | real detector |
| C-14 | `p6-arch` fail-closed on a keyed attempt with no tree | FIRE (detector `arch-failclosed` fires on the real fixture) | yes — untracked project | **detector real, control unsatisfiable → permanently `pending`** (§3.2) |
| C-16 | `inferName` markdown/truncation strip | FIRE | yes — untracked briefs | detector real; **`mutationRed` is a tautology on the harness's own local `dirty()`, never `inferName`** (`replay-harness.mjs:628`) |
| C-18 | packet section guarantee (DoD + Research survive truncation) | FIRE (real `headless.packet` on a genuinely over-budget project) | yes | real detector |
| C-15 | deepen/approve honesty (`RT_E_RESEARCH_UNAVAILABLE`) | FIRE (real `deepenResearch` + a real approve fixture) | yes | real detector |
| C-17 | HTML numeric-entity decode | FIRE (real `countNumericEntities` on the real leak + scratch control) | yes | real detector |
| C1-01 | floor reachability: sealed below-floor tree carries `RT_E_PLAN_UNDERPRODUCED` | FIRE (`campaign-invariants.mjs` JSON over the **tracked** `campaign1/**` cassettes) | yes (cassettes tracked) | real detector; mutation control self-supplied |
| C1-02 | mounted UI calls ≥1 real generated export | FIRE | yes (tracked) | real detector; mutation control self-supplied |
| C1-05 | skip-dominated oracle cannot satisfy the behavioural bar | FIRE | yes (tracked) | real detector; mutation control self-supplied |
| C1-06 | a delivery claim states real verification or says unverified | FIRE | yes (tracked) | real detector; mutation control self-supplied |
| C1-08 | withheld git envelope code names the deciding reason | FIRE | yes (tracked) | real detector; mutation control self-supplied |
| R2-01 | below-floor emit seal carries `RT_E_PLAN_UNDERPRODUCED` | FIRE | yes (tracked `campaign2/**`) | real detector; mutation control self-supplied |
| R2-03 | no emitted `.ts` module contains JSX | FIRE | yes (tracked) | real detector; mutation control self-supplied |
| R2-05 | no emitted spec is skip-dominated | FIRE | yes (tracked) | real detector; mutation control self-supplied |
| R2-06 | committed tree's verification record is evidenced | FIRE (guard's own `detectVerifiedCommit` over tracked campaign1/campaign2 envelopes) | yes (tracked) | real detector; mutation control self-supplied |
| S4-01 | armed chunk-resample default > 1 | FIRE | **no** — both signals from the guard's own `enablingWaveControls()`; the "fixture" is a mutation of the **live** source | self-audit (both signals) |
| S4-02 | every resample loop is bounded (cap ∈ [2,4]) | FIRE | no (same) | self-audit (both signals) |
| S4-03 | re-pinned refusal coverage floor (≥54 refused, 56 coded reasons) | FIRE | no (same; also reads the tracked `refusal-coverage.json`) | self-audit (both signals) |
| S4-04 | accepted-chunk reuse (0 prompts when `ctx.resumeAccepted`) | FIRE | no (same) | self-audit (both signals) |
| S4-05 | both default-check samples' scores stay pinned | FIRE | no (same; reads tracked `default-check/{sample1,sample2}.json`) | self-audit (both signals) |
| G1-01 | research query is intent-first ≤3 qualifiers | FIRE | half — `present/wired` from `git show HEAD:src/lib/engine.ts`; `mutationRed` from the guard's own `finalWaveControls()` | hybrid |
| S3-01 | below-floor tree refuses through the single refuse door | FIRE | half (same shape) | hybrid |
| D2-01 | emit seal surfaces the floor code | FIRE | half (same shape) | hybrid |
| D3-01 | a run path wires the in-run RUNLOCK guard | FIRE | half (same shape) | hybrid |
| D1-01 | persisted phase-6 gate recomputed over the persisted tree | FIRE | half (same shape) | hybrid |

Tally: **33/34 fire**, 34/34 controls clean. **10 guards** (C-11 plus S4-01..05 and the
G/S/D family for `mutationRed`) have at least one of their two "orthogonal" signals produced by the
module under audit; for **S4-01..S4-05 both** signals are (`replay-harness.mjs:1451-1458` returns
`fired: !!r.fired` and `controlClean: !!r.controlClean` straight from the guard's own controls
object). The only external check on those controls is the guard's own `*.test.mjs` — same author,
same wave.

**Tautologies found in the two-signal set:** C-06's `mutationRed` is `true` by construction
(`replay-harness.mjs:525`); C-16's tests the harness's local regex, not the seam
(`replay-harness.mjs:628`). No guard's *fixture* is the artifact the guard is supposed to catch.

**Can a `countFloor` be met while the behaviour is broken?** The count/floor machinery itself is
sound (`count = results.length`, `countFloor = max(pinned, registry)`, and the pinned guard-id set
is checked id-by-id, `replay-harness.mjs:1736-1751`). But the floor's *independence* is not: see
F-002. And no floor can detect a guard that still fires on a stale artifact while the product
behaviour it names has been redefined out from under it — exactly what happened to C-06.

---

## 3. C-06 / C-14 root cause

### 3.1 C-06 — the detector, the fixture and the pin all key on a field whose semantics were changed under them

**The detector.** C-06's registry entry declares `kind:"test"`, `file:"scripts/guards/delivery-gate.test.mjs"`,
and a `historicalFixture` prose string (`"testruns/office-scheduler (emit --run --git: substance.verdict=\"empty\", git.committed=true today)"`,
`scripts/guards/guard-registry.json:138-151`). The harness **never runs that test file**: `evaluateGuard`
does not read `g.kind` at all, and `resolveDriver` maps `c-06 → "substance"`
(`scripts/prevention/replay-harness.mjs:1533-1545`, `1584-1596`). The `substance` driver ignores the
declared fixture and scans every cassette tree for the top-level verdict
(`replay-harness.mjs:1190-1197`):

```js
1195  try { s = seams.treeSubstanceOf(t.dir, { green: true }); } …
1196  if (s && s.verdict === "empty") fired.push({ tree: …, verdict: s.verdict, real: s.real });
```

**The measurement.** The driver is now `----` because **no tree in the sweep reads `"empty"`**:

```
node --experimental-strip-types -e "…treeSubstanceOf(t.dir,{green:true}) for all 13 cassette trees…"
→ office-scheduler/emitted      top=mixed(real 4)   job=empty
   office-scheduler/emitted.v2  top=mixed(real 4)   job=empty
   … all 13 trees: top-level ∈ {mixed}, jobScoped ∈ {real, empty}
```

**Why the semantics moved.** `treeSubstanceOf`'s top-level census is the whole tree in the working
tree and the job directory in `HEAD`:

* working tree: `src/lib/compile-check.server.ts:783-790` computes the top level from
  `collectTreeCodeSources(subject)` and keeps the job census **additively** as `jobScoped`
  (comment at `:772-774`: *"fixes/354 A2-F3: the top-level counts/label census ALL emitted code
  modules (the whole product), so a tree whose real code lives only under `src/generated/` reports
  `real > 0` instead of `empty`"*).
* `HEAD`: `git show HEAD:src/lib/compile-check.server.ts` →
  `export function treeSubstanceOf(dir, opts) { … const sources = collectTreeJobSources(subject); … }`
  — the top-level verdict was the job census.
* This is an **uncommitted** change: `git diff --stat HEAD -- src/lib/compile-check.server.ts` →
  `214 insertions(+), 52 deletions(-)`; `git show HEAD:src/lib/compile-check.server.ts | Select-String 'A2-F3'` → nothing.

**The consequence beyond the harness.** The CLI's withhold branch reads the same field
(`scripts/rapidtool-cli.mjs:3007-3008, 3026-3031`: `runVerdict.substance.verdict === "empty"`), and
the guard's own pin asserts on it (`scripts/guards/delivery-gate.test.mjs:79`:
`assert.equal(payload.substance?.verdict, "empty", …)`). `outcome.substance = treeSubstanceOf(subject, { green: outcome.ok })`
(`src/lib/compile-check.server.ts:2309`) — so all three sites moved together. Under the new census
`"empty"` means **zero code modules in the whole tree**, which a real scaffold can never produce
(the emitted tree always carries `vite.config.ts` + `src/main.tsx`, both counted `real`). Measured:
`office-scheduler/emitted/vite.config.ts → kind:"real"`, `src/main.tsx → kind:"real"`,
`src/ui/console.tsx → kind:"real"`, `src/generated/chunk.ts → kind:"real"`. **The substance-withhold
branch is now unreachable for any emitted tree.**

**Smallest honest fix (one of two, both small):**
1. Make the C-06 fixture-integrity signal read the census the delivery gate actually consumes and
   point it at the declared fixture: in `DRIVERS["substance"]` require `s.jobScoped.verdict === "empty"`
   (or `s.verdict === "empty"` **and** assert `jobScoped.verdict === "empty"` for the declared
   `office-scheduler/emitted` fixture) — measured `jobScoped.verdict === "empty"` for exactly the 6
   hollow trees, so this is a real detector again. **Or**
2. If A2-F3 is intended to keep the withhold behaviour, re-pin C-06 to a genuinely zero-code tree and
   name the new predicate in the registry (the current entry's `expected`/`historicalFixture` describe
   a state the reader can no longer express). Either way the C-06 `mutationRed` tautology
   (`replay-harness.mjs:525`) must be replaced by a real control.

### 3.2 C-14 — the mutation control is unsatisfiable: the control fixture is itself an instance of the defect

**The seam check** (`scripts/prevention/replay-harness.mjs:584-597`):

```js
589  const base = readJsonFile(join(ctx.runRoot, "office-stock-tracker", "build.json"));
590  const sentinel = { ...base, generatedTree: [], logs: [ …base.logs, {event:"p6.synthesis.attempt"} ] };
592  present: true,
593  wired:       item.probe(sentinel) === false,          // → false === false → true
594  mutationRed: item.probe({ ...base, generatedTree: [] }) === true,   // → false → mutationRed FALSE
```

**Why the control can never be true.** `dod.ts`'s `p6-arch` probe fails closed when the newest
`p6.synthesis.*` journal event is `attempt` or `refused` (`src/lib/dod.ts:1409-1421`,
`newestSynthesisEvent` at `:600-610`). The control fixture's own logs already carry those events:

```
node --experimental-strip-types -e "…probe(readJsonFile(…/office-stock-tracker/build.json), gt:[])…"
p6.synthesis logs in fixture: ["attempt","attempt","attempt","refused","attempt","attempt","attempt","refused"]
probe(base, generatedTree:[])                     = false   ← the "keyless floor" control
probe(base, generatedTree:[], logs:[])            = true    ← the honest keyless floor
probe(readJsonFile(base)) = false
```

Both readers agree (`headless.loadProject` yields the same 52 logs / same 8 synthesis events /
same `false`), so this is not a fixture-reader artifact — the control is simply built from a project
that already contains a keyed synthesis trail. The registry's `cleanControl` — *"the keyless floor
(no keyed attempt, absent tree) still passes"* (`guard-registry.json:214`) — is **unsatisfiable with
this fixture**, so `classifyFixPresence` can never put C-14 in `enforced`
(`replay-harness.mjs:1698-1703`) and the gate of record is red forever.

**The pin has the same defect**, which proves the fixture was never validated:
`node --experimental-strip-types --test --test-reporter=tap scripts/guards/gate-invariants.test.mjs`
→ `not ok 9 - C-14 p6-arch must fail closed on a keyed attempt with no tree`, whose failing
assertion is the same line (`scripts/guards/gate-invariants.test.mjs:207-208`,
`const keylessNoTree = { ...base, generatedTree: [] }; assert.equal(item.probe(keylessNoTree), true, …)`).

**Smallest honest fix:** build the control from a genuinely keyless record — `item.probe({ ...base, generatedTree: [], logs: [] }) === true`
(measured true above) — in both `replay-harness.mjs:594` and `gate-invariants.test.mjs:207`. Do **not**
relax `mutationRed`, and do **not** flip the registry to `status:"enforced"`: the detector is real
and the mutation it needs exists; only the control's construction is wrong.

---

## 4. Eval corpus & grader assessment

Corpus: 11 brief fixtures (`research/eval-corpus/*.md` minus `README.md`) + 11 run-side graders
(`graders/*.grader.json`), all tracked (`git ls-files research/eval-corpus` → 23 files).
All 11 graders are `graderVersion 2` and declare `passWhen.meanAtLeast: 1`.

| grader | what it checks | false-positive risk |
|---|---|---|
| arcade-breakout (game) | 5 files · 4 content strings · 10 identifiers · 8 caps · **6 behaviour rows** | low — the only game grader with behaviour rows; but rows are manifest/entry checks, not gameplay |
| coffeehouse2home-property-ledger | 4 files · 3 content · 14 ident · 7 caps · **0 behaviour rows** | high — graded entirely on files+content+shape+the M-rubric |
| date-rrule-library (library) | 3 files · 4 content · 6 ident · 6 caps · 4 behaviour rows | low-medium (entry-runs oracle on the library entry) |
| field-ops-suite | 4/3/14/5 · 0 behaviour rows | high (same shape-only class) |
| house-flip-manager | 4/3/11/6 · 0 behaviour rows | high |
| invoice-csv-cli (cli-tool) | 3/3/6/6 · 4 behaviour rows | low-medium |
| order-webhook-service (service) | 3/3/7/5 · 4 behaviour rows | low-medium |
| permit-inspection-tracker | 4/3/12/5 · 0 behaviour rows | high — and it is the *authored*, never-measured fixture |
| real-estate-crm | 4/3/9/6 · 0 behaviour rows | high |
| rental-portfolio | 4/3/11/7 · 0 behaviour rows | high |
| showing-booking | 4/3/11/7 · 0 behaviour rows | high |

Read the concrete bar, e.g. `graders/real-estate-crm.grader.json:29-48`: `expectedFiles`
= `package.json, index.html, README.md, vite.config.ts`; `expectedContent` = `"type": "module"` in
`package.json`, the `test` script string, and `/src/main.tsx` in `index.html`. **A hollow scaffold
passes every one of those without a single line of product behaviour** — that is precisely what the
scaffold already emits. `checkAcceptance` (`scripts/run-eval.mjs:896-940`) confirms they are
membership/substring tests, shipped as the acceptance record.

So the grader's real bar is the M1..M9 rubric (`passesAcceptance` → `rubricMeanForRow` →
`meetsRunKindBar`, `run-eval.mjs:2519-2564`), and the only genuinely behavioural rows are the
`expectedBehavior` `entry-runs` rows (`evaluateEntryRunsRow` → `runEntryOracle`, a real bounded
spawn, `run-eval.mjs:807-809`). **7 of 11 graders declare `expectedBehavior: []`** — for those seven
cases nothing in the acceptance path executes the emitted product.

**Honest strengths in this area** (they are real, see §7): the graders are run-side files read only
by the driver, never copied into the tree, with a separate `graderLeakScan` over the emitted tree
*and* `briefLeakScan` over the brief/name (`run-eval.mjs:1306-1324`); a mid-run byte edit of any
grader is caught by an FNV-1a freeze with the residual (edit-and-revert) stated in the code.

**Stale doc:** `research/eval-corpus/README.md:26` says *"Seven fixtures"* and lists seven; the disk
carries 11 fixtures. The four newer kinds (game / library / cli-tool / service) are not in the
README's domain-spread table at all. The bytes win: 11.

**Accepted-but-false risk the graders cannot see:** the graders' `requiredIdentifiers` /
`requiredCapabilities` never reach `passesAcceptance` — they are only handed to `scoreMaker` as
`expectedNouns`/`expectedCapabilities` (`run-eval.mjs:617-623`). A tree can contain none of the
required identifiers and still pass files/content/kind/behaviour clauses.

---

## 5. Ratchet gameability — per metric the campaign intends to ratchet on

| metric | producer | honest? | cheap way to move it without improving the product |
|---|---|---|---|
| **acceptance `ok` rate** | `research/eval-out/results.json` → `summary.passAtK.meanPassAt1` / `entries[].acceptance.pass`; written by `run-eval.mjs` | **partly** — the pass predicate is strict (rubric mean ≥ 1 over nine criteria + files/content/behaviour/kind) and never defaults a pass (`run-eval.mjs:2519-2527`) | **YES, three ways.** (a) *Sample size*: keyed runs without `--all` are capped at **one case** (`run-eval.mjs:3285`: `cap = … mode === "keyed" ? 1 : targets.length`), so the rate is a 1-case sample; the tracked record is exactly that (`results.json: entries:1, summary.meanTotal 0.3333, passAtK.passed 0`). (b) *Grader editing*: `graderFreeze` fingerprints graders **only across one run** (`run-eval.mjs:1279-1301`) — nothing pins grader bytes between runs, so lowering `passWhen.meanAtLeast`, emptying `expectedFiles`, or setting `requireExpectedKind:false` in a grader JSON is enough to flip a case green with no product change. (c) *Case selection*: `--limit=1` / reordering picks whichever case is cheapest. |
| **tree-own-`tsc` pass rate** | the emitted tree's own declared `typecheck` script, executed by `treeRun`'s project leg | **mostly honest** — the emitter hard-codes `typecheck: "tsc --noEmit"` and a `tsconfig.json` with `include: ["src","tests"]` (`src/lib/scaffold.ts:839-858`, `:975-1003`; verified on `testruns/office-scheduler/emitted/tsconfig.json` + `package.json`), so a brief cannot narrow the check; an un-runnable declared script downgrades to `declaredScriptsVerified:false` rather than a green (`compile-check.server.ts:1974-1983`) | weak: fewer/flatter emitted files typecheck more easily, and the denominator is "trees that ran". Not cheaply movable by editing a config — reported as sound |
| **substantive-tree rate** | `treeSubstanceOf(...).verdict` / `.real` in `src/lib/compile-check.server.ts` | **NO — moved by a reader change, not the product** | **YES, measured.** Over the same 13 frozen trees: job-scoped census (at `HEAD`) → **6/13 substantive (46%)**; whole-tree census (working tree) → **13/13 (100%)**. The change is the uncommitted `fixes/354 A2-F3` edit (`compile-check.server.ts:772-774, 783-790`, +214/−52 vs HEAD). Zero product bytes changed. The same edit silently retired C-06's withhold branch (§3.1). |
| **`productQuality.quality` rate** | `readProductQuality()` in `src/lib/product-quality.ts` (a **file that does not exist at HEAD**: `git show HEAD:src/lib/product-quality.ts` → *"exists on disk, but not in 'HEAD'"*) | **bar is real, bytes are shape** | YES, in the "shape not behaviour" sense: `quality` requires a non-empty tree, ≥1 real module, a reachable web entry, a router marker, ≥1 distinct content page, and a styled layout — all **string-presence reads over reachable files** (disclosed at `product-quality.ts:895-900`: *"string-presence read, not an execution"*). A tree with a router import + one page + one `className` earns `quality:true` with nothing running. Also: the whole reader is uncommitted, so the metric's definition is not yet on the gate-of-record surface. |
| **guard `missed` / `pending`** | `scripts/prevention/verify-prevention.mjs` | the fold is honest and fail-closed (skips are derived, not hard-coded; a dirty control folds into `missed`; the classification must be disjoint+total) | **YES.** (a) **The independent floor is an untracked file** — `scripts/prevention/cassettes/guard-floor.json` is `??` in git while every other cassette is tracked; set `{countFloor:1, guardIds:[]}` and the effective floor collapses to the registry's own `countFloor`, i.e. back to the file that lists the guards. (b) **The fixture basis is untracked** — `git ls-files testruns` → **0** (see F-001), so a "fixture miss" is `missed:["C-06"]` today and could be silenced by editing bytes git has never seen. (c) A guard can be disarmed *without touching the guard* by redefining the field it reads (C-06 proves it). |
| **doc-claim count** | `scripts/docs-module-parity.mjs` (`missingCount`) — **advisory, not a gate** (`scripts/gate.sh` has 0 references; `docs-module-parity.mjs` always `exitCode = 0`) | honest by construction (it says so in its own header) — but then it is not evidence | YES, trivially: `missingCount` is computed from backticked `src/`/`scripts/`/`migrations/` paths in 8 docs. Deleting the path mentions from the prose drives `missingCount` to 0 without creating a file. Current reading: `docsScanned 8 · mentions 114 · uniquePaths 61 · missingCount 2 · emptyCount 0`. |

---

## 6. Findings

`id | severity | title | file:line | evidence | why it matters`

**F-001 | P0 | The prevention harness's entire fixture basis is outside version control, and the gate of record is red on a clean checkout**
`scripts/prevention/README.md:32-34` (*"The frozen evidence is **tracked in the repo** at `<repo>/testruns/`"*, repeated at `:44`), `scripts/prevention/replay-harness.mjs:44-58` (`resolveRunRoot`).
Evidence: `git ls-files testruns` → **0 files**; `git status --porcelain -- testruns` → `?? testruns/`; `git check-ignore -v testruns/office-scheduler/emitted` → (no output, not ignored); disk carries **325** files. So the harness's "history-frozen bytes" — the fixture for C-01/02/03/04/05/06/09/12/13/14/15/16/17/18 — are not in git at all: they are this box's mutable working files, and any wave (including the one that "fixes" the defect) can rewrite them unrecorded. `resolveRunRoot` then returns null on a checkout without `testruns/`, and `verify-prevention.mjs:44-47` prints `<run-root-missing>` and exits 1 — so the README's *"the harness is green on a clean checkout"* (`:37-38`) is false. **Why it matters:** every "the guard still fires on the historical defect" claim is a claim about unversioned bytes; the campaign's freeze has no frozen artifact.

**F-002 | P0 | The "independently reviewed, immutable" guard floor is itself untracked, and its anti-tamper property is neutralizable by one edit**
`scripts/prevention/replay-harness.mjs:34-40` (*"The REVIEWED, immutable guard-count floor … `loadGuardFloor` reads this cassettes/ fixture and `runAll` asserts it independently, so deleting a guard and lowering the registry `countFloor` in one edit still fails"*), `:128-142`, `:1736-1751`.
Evidence: `git status --porcelain scripts/prevention/cassettes/guard-floor.json` → `?? scripts/prevention/cassettes/guard-floor.json`; `git ls-files --error-unmatch …` → *"did not match any file(s) known to git"*; every **other** cassette in that directory is tracked (`git ls-files scripts/prevention/cassettes` lists 12 root cassettes + `campaign1/**` + `campaign2/**` + `default-check/**`, not `guard-floor.json`).
Mechanism: `runAll` derives `countFloor = Math.max(floor.countFloor, registryCountFloor)` and only fails on `registryCountFloor < floor.countFloor` or on `guard-id-missing:<id>` for ids in `floor.guardIds` (`:1745-1751`). Setting `guard-floor.json = {"countFloor":1,"guardIds":[]}` removes both defenses; the floor is then the registry's own number in the registry that lists the guards — the exact hole the comment claims to close, and `replay-harness.test.mjs:245-256` only pins it against a *forged registry*, never against a forged floor fixture. **Why it matters:** the one artifact whose whole purpose is to be un-tamperable is the one artifact the repo does not track; also, its absence makes the gate unfixably red on a fresh clone.

**F-003 | P0 | The "substantive-tree rate" the campaign will ratchet on was moved from 46% to 100% by an uncommitted reader change, with zero product change — and the same change retired the C-06 guard**
`src/lib/compile-check.server.ts:772-774` (the A2-F3 comment), `:783-790`, `:2309`; `scripts/rapidtool-cli.mjs:3007-3008, 3026-3031`; `scripts/guards/delivery-gate.test.mjs:79`.
Evidence: `git diff --stat HEAD -- src/lib/compile-check.server.ts` → `214 insertions(+), 52 deletions(-)`; `git show HEAD:src/lib/compile-check.server.ts` → the top-level census was `collectTreeJobSources`; measured over the same 13 trees: `topLevelSubstantive=13 jobScopedSubstantive=6`. Because the CLI's withhold branch and the C-06 pin read the same top-level field, `"empty"` now means *zero code modules anywhere* — unreachable for any real scaffold (`vite.config.ts`/`src/main.tsx` count as `real`), so the substance withhold is dead code and the C-06 detector cannot fire.
**Why it matters:** this is the single clearest "a metric the ratchet will use can be moved without improving the product"; the artifact bytes are identical, only the reading changed. A later wave can also *choose* the flattering census whenever the two disagree.

**F-004 | P1 | C-06 is missed: the driver, the registry's declared fixture, the CLI branch and the pin all key on a field whose meaning changed**
`scripts/guards/guard-registry.json:138-151`; `scripts/prevention/replay-harness.mjs:1190-1197, 1533-1545`; `scripts/prevention/replay-harness.mjs:1584-1596` (no `g.kind` handling anywhere — `Select-String -Path scripts/prevention/replay-harness.mjs -Pattern '\bkind\b'` returns only cassette-label uses at `:1213-1216, 1663-1673`).
Evidence: `verify-prevention … --selftest` → `fixtureIntegrity.missed:["C-06"]`; the driver's `verdict === "empty"` predicate is now false for all 13 trees; `replay-harness.test.mjs` test 4 is `not ok`. **Why it matters:** the harness's headline red is caused by a semantics change, not a regression, so the natural "fix" a later wave reaches for is to delete or weaken the guard — the opposite of what the floor exists to force.

**F-005 | P1 | C-14 is permanently `pending` because its mutation control is unsatisfiable — and the guard's own pin has the same defect**
`scripts/prevention/replay-harness.mjs:584-597` (esp. `:594`); `scripts/guards/gate-invariants.test.mjs:205-215` (esp. `:207-208`); `src/lib/dod.ts:1409-1421`.
Evidence: `p6.synthesis` events in `testruns/office-stock-tracker/build.json` → 6 × `attempt` + 2 × `refused`; `probe({...base, generatedTree:[]}) === false` under **both** `readJsonFile` and `headless.loadProject`; `probe({...base, generatedTree:[], logs:[]}) === true`; `node --test scripts/guards/gate-invariants.test.mjs` → `not ok 9`. **Why it matters:** an unsatisfiable control pins a real, working detector as "not enforced" forever, so the gate of record can never go green; and the only two ways a wave can make it green (relax `mutationRed`, or flip the registry) both destroy the proof.

**F-006 | P1 | The proof layer's own pin suites are red (7 of the tree's 15 failing tests), and the harness's gate-of-record test is one of them**
`scripts/prevention/replay-harness.test.mjs:78-88, 153-221`; `scripts/guards/gate-invariants.test.mjs:203-216`; `scripts/check-module-coverage.test.mjs:122-130, 132-135`; `scripts/typecheck-scripts.test.mjs:181-240`.
Evidence (all measured): `replay-harness.test.mjs` 13/15 (fails 4 and 12); `gate-invariants.test.mjs` 12/13 (fails 9); `check-module-coverage.test.mjs` + `check-module-coverage.mjs --json` red (2 tests + exit 1); `typecheck-scripts.test.mjs` 4/6, and the failure is a TS error in the pin itself — `npx tsc -p tsconfig.scripts.json --noEmit` → `scripts/typecheck-scripts.test.mjs(219,16): error TS2339: Property 'NODE_TEST_CONTEXT' does not exist on type '{ RT_TYPECHECK_NESTED: string; }'`; the same run's second failure is leg 1 of `npm run typecheck` failing with the 5 known tree errors (`src/lib/headless.test.ts`, `scaffold.test.ts` ×2, `wild-step.test.ts` ×2).
**Why it matters:** the layer that is supposed to certify everything else is itself red and un-actioned; and `npm run typecheck` cannot go green *because of the file that pins it*.

**F-007 | P1 | Two of the harness's mutation controls are tautologies — they can never fail**
`scripts/prevention/replay-harness.mjs:525` — `mutationRed: /RT_E_SUBSTANCE_EMPTY/.test("RT_E_SUBSTANCE_EMPTY") && !/RT_E_SUBSTANCE_EMPTY/.test("")` is a literal `true`.
`scripts/prevention/replay-harness.mjs:628` — `mutationRed: dirty("# Golden Crust Bakery") === true` exercises the harness's own local `dirty()` regex, never `inferName`.
Evidence: read + the per-guard dump shows C-06 `seam m` and C-16 `seam m` (both "green"). **Why it matters:** the fix-presence signal is documented as "present AND wired AND its mutation control proves the check can fail" (`replay-harness.mjs:1685-1694`); for these two guards the third clause is decorative, so C-06's `enforced` classification rests on three greps plus a constant.

**F-008 | P1 | `--selftest`, `--keyed` and `--budget` are parsed and discarded; the README documents behaviour the bytes do not have**
`scripts/prevention/verify-prevention.mjs:41` — `parseArgs(process.argv.slice(2));` with the return value dropped; `parseArgs` is the only reader (`replay-harness.mjs:1814-1826`), and `Select-String -Path scripts/prevention/*.mjs -Pattern 'keyed|budget|argv'` shows no consumer of `--keyed`/`--budget`/`--selftest` (the only `--selftest` consumer is the spawned `runlock-preflight.mjs`).
README claims: *"`--selftest` additionally proves each scan guard has teeth: it builds a clean control scratch tree … and an injected-defect scratch tree"* (`README.md:89-91`), *"`--keyed` / `--budget N` are opt-in and are never required for acceptance"* (`:23-24`).
**Why it matters:** the scratch mutation proofs do run — but unconditionally, with and without the flag; so the documented invocation is indistinguishable from a bare one, and a reader cannot tell a mutation-proved run from a plain one. Low harm, but it is a doc-vs-bytes disagreement in the layer whose job is honesty.

**F-009 | P1 | 10 of 34 guards' signals are produced by the module under audit; the harness has no independent artifact for them**
`scripts/prevention/replay-harness.mjs:1451-1458` (`enabling-wave-invariants`: `fired` **and** `controlClean` taken verbatim from the guard's `enablingWaveControls()`), `:1462-1468` (`final-wave-invariants`, same), `:852-869`/`:891-900` (campaign/campaign2 controls), `:1364-1371` (`pb-runlock`: the fixture signal is a regex over the guard's own `--selftest` stdout).
Evidence: rows S4-01..S4-05 + G1-01/S3-01/D1-01/D2-01/D3-01 report `FIRE ctl+` entirely from the guard module; the registry's own proof text confirms the "fixture" is a mutation of the **live** source (`guard-registry.json:515-518`: *"the injected disarmed default … derived from the live policy bytes"*). The only external check is the guard's own `*.test.mjs` (31/31 green today, but same author / same wave).
**Why it matters:** the two-signal design is advertised as *"orthogonal"* (`replay-harness.mjs:1685-1694`); for these ids the two signals collapse into one self-report, so a wave that edits both a guard and its control can go green.

**F-010 | P1 | `gate.sh` stage 3c (moduleCoverage) is red, and stage 3 (assertion gaps) never scans the components leg it claims**
`scripts/gate.sh:135` (`run moduleCoverage … check-module-coverage.mjs --json`), `:227-238`; `scripts/check-assertion-gaps.mjs:68` (`export const DEFAULT_TARGETS = ["src/lib", "scripts"]`) vs `:50-52` (*"Default targets: … the two legs `npm test` runs — see package.json"*).
Evidence: `node scripts/check-module-coverage.mjs --json` → exit 1, `total 140 · covered 131 · unallowlisted [] · stale [7 files]` (stale fails the gate by design) — the 2 red tests are the matching proof. `node scripts/check-assertion-gaps.mjs` → `clean — 167 test files scanned`; `167 = 125 (src/lib) + 42 (scripts)` exactly, while `npm test`'s second leg also runs `src/components/**/*.test.ts` (2 files, present on disk, linted clean only when named explicitly: `node scripts/check-assertion-gaps.mjs src/components` → `2 test files scanned`).
**Why it matters:** a documented gate stage is red for bookkeeping (7 stale allowlist entries), and the tautology/zero-assertion lint silently excludes the component surface — including `src/components/console.guards.test.ts`, which is 24 source-regex pins.

**F-011 | P1 | A skipped test exists that the skip-registry leg structurally cannot see**
`scripts/typecheck-scripts.test.mjs:64` (`NESTED_SKIP = NESTED_TYPECHECK ? "nested \`npm run typecheck\` proof run - the outer run proves this leg" : false`), used at `:162, 181, 204, 242, 287`; `scripts/gate.sh:325-350` (the registry check runs only over `testsScripts`/`testsLib` logs); `scripts/skip-registry.json` (2 entries, neither matching).
Evidence: the skip name is not in `skip-registry.json`; the nested leg is spawned by `npm run typecheck` (gate stage 1), which `gate.sh` never parses for skips. **Why it matters:** the registry's stated invariant — *"a suite can no longer pass by skipping out of a check"* — has a hole exactly where the typecheck ratchet lives; here it is honest (the outer run proves the leg), but nothing enforces that.

**F-012 | P2 | The acceptance "ok rate" is read from a single-case record that stamps itself stale, and the reader drops the stamp**
`research/eval-out/results.json` (`"generatedAt":"2026-09-25T00:03:43.504Z"`, `"mode":"keyed"`, `"stale":true`, `"staleStampedAt":"2026-09-29T21:45:54Z"`, `entries: 1`, `summary.meanTotal 0.3333`, `passAtK.passed 0`); `scripts/run-eval.mjs:3285` (keyed cap = 1); `src/lib/scorecard.ts:283` (the reader surfaces `generatedAt` only — `Select-String -Path src/lib/scorecard.ts -Pattern 'stale'` → no match).
Evidence: `node scripts/rapidtool-cli.mjs eval --dir research/eval-out` prints `"ok": true`, `"generatedAt"`, `passAt1 0`, `cases 1` — and **no `stale` field**. **Why it matters:** the tracked artifact *is* the campaign's acceptance reading; it is a 1-case sample from three weeks before the freeze, it says so in its own bytes, and the surface the campaign will read it through does not repeat the caveat.

**F-013 | P2 | Module "coverage" is markable by a comment**
`scripts/check-module-coverage.mjs:96` (`SPEC_RE = /\b(?:from|import|require)\s*\(?\s*["']([^"']+)["']/g`), `:155-159` (`importSpecifiers` runs the regex over the raw source with no masking), `:184-229` (the reachability walk).
Evidence: `importSpecifiers('// import { x } from "./ghost-comment.ts"; /* require("../lib/ghost-block.ts") */')` → `["./ghost-comment.ts","../lib/ghost-block.ts"]`. **Why it matters:** a single commented-out import line in any test file marks a module "reached", so the coverage ratchet can be satisfied without a test — the same class `check-assertion-gaps.mjs` explicitly masks against (`maskSource`, `check-assertion-gaps.mjs:82`) and this guard does not.

**F-014 | P3 | The prevention README's guard table and "no red pin today" claim contradict the bytes**
`scripts/prevention/README.md:78-79` (*"C-06 substance gate … real `treeSubstanceOf(...).verdict === "empty"`"*), `:87-88`, `:93` (*"No permanent test is skipped; `skipped` is pinned to `0`"*), `:96` (*"There is no red pin on the landed tree today."*).
Evidence: the verdict today is `ok:false`, `missed:["C-06"]`, `pending:["C-14"]`; `replay-harness.test.mjs` is 2/15 red. The bytes win.
Also stale in the same family: `scripts/prevention/README.md:129` documents a cassette-refresh recipe as `node -e "…"   # see PREVENTION.md §3` — a placeholder, with no `PREVENTION.md` in the repo (`Test-Path PREVENTION.md` → false), so the documented regeneration path is unfollowable.
Also: the README never mentions `cassettes/guard-floor.json` at all, yet the harness calls it the reviewed authority.

**F-015 | P3 | `research/eval-corpus/README.md` describes a 7-fixture corpus; the disk carries 11**
`research/eval-corpus/README.md:25-26` (*"Seven fixtures"*), `:60-63` (the domain-spread table lists 7).
Evidence: `Get-ChildItem research/eval-corpus/*.md` → 12 files, minus `README.md` = **11** fixtures; `git ls-files research/eval-corpus` → 23 (11 md + 11 grader + README). The four newer kinds are absent from the README's schema/rationale.

**F-016 | P3 | Stale in-file "TODAY this is RED" headers in two guard pins**
`scripts/guards/delivery-gate.test.mjs:12-13` (*"TODAY this is RED: the CLI still commits the empty tree"*) — the CLI now withholds; the test is red for a different reason (its first assertion, `:79`, fails because the fixture no longer reads `empty`). `scripts/guards/repair-monotonic.test.mjs:13-15` (*"TODAY the comparator is not exported"*) — `headless.treeVerdictScore` is exported and the pin passes. **Why it matters:** a header that names the wrong reason sends the next wave to the wrong file.

---

## 7. What is genuinely sound (required — this layer has real strengths)

1. **The guard-count floor is asserted *twice*, from two files, with an explicit anti-collusion design.**
   `loadGuardFloor` reads a separate fixture; `runAll` refuses to let the registry *lower* the pinned
   floor and fails on any pinned guard id missing from the registry
   (`replay-harness.mjs:1517-1529, 1736-1751`); `finalize` re-takes `max(countFloor, pinned)` so a
   smuggled verdict object cannot read `ok:true` (`:1841-1850`). The *mechanism* is right — only its
   storage location (F-002) is wrong.
2. **Skipping is structurally hard.** `skipped` is derived per guard and any non-empty skip fails the
   gate; `finalize` requires `skipped.length === 0` (`replay-harness.mjs:1770, 1870`); a missing run
   root is a named failure, never a silent pass (`verify-prevention.mjs:44-47`); an inconsistent
   fix-presence classification is folded into `missed` (`:1856-1858`).
3. **The best guards are genuinely behavioural, not greps.** C-05 imports the real
   `specSourceHasBehaviouralAssert`, asserts `false` on the real oracle bytes and `true` on a real
   assertion (`replay-harness.mjs:501-512`); C-11 refuses a real 21:34:01-vs-21:32:58 overlap and
   allows a clean window with the lock held (`:541-556`); C-12 runs the real `inferDomain` on both an
   out-of-scope clause and a genuine real-estate brief (`:560-566`); C-15 drives the real
   `deepenResearch` twice (empty → coded refusal, findings → lands) (`:600-621`); C-04 drives the real
   `driveP6Journey` and asserts the abort lands on cycle 2 of a budget of 3
   (`scripts/guards/repair-monotonic.test.mjs:52-83`).
4. **`gate.sh` is unusually honest about the failure modes that usually hide a red suite.** A leg that
   exits 0 with zero `# pass` lines is a hard fail (empty glob / wrong reporter), a non-zero leg with
   no TAP `not ok` line is a *named* hard fail rather than a flake (`gate.sh:277-291`), and the
   zero-match `--test-name-pattern` trap is explicitly closed: an isolated retry is green only with
   the test's own `ok N - <name>` line **and** `# fail 0` (`gate.sh:397-418`). The trap itself is
   pinned end-to-end against a real planted red file by `scripts/test-name-pattern-guard.test.mjs`
   (3 tests, spawned fixtures, a control that proves the masked red is real).
5. **`scripts/gate-verdict.test.mjs` (514 lines), `scripts/run-eval.test.mjs` (1904 lines),
   `scripts/check-assertion-gaps.test.mjs`, `scripts/browser-smoke-verdict.test.mjs` and
   `scripts/check-auth-invariant.test.mjs` are green** and are real suites — my combined run of five
   in-scope files gave `tests 156 · pass 154 · fail 2`, with the only two failures being the live
   module-coverage state (F-010).
6. **The eval driver's write-safety and leak-safety are real, disclosed, and tested.**
   `evalOutRefusal` refuses to write eval artifacts into the working tree unless the caller named the
   directory (`run-eval.mjs:194-209`); the grader files live run-side and are never copied into the
   tree, with a `graderLeakScan` over the emitted tree *and* a `briefLeakScan` over the brief/name
   (so the bar cannot be handed to the agent through the prompt); a grader edited *during* a run is
   caught by an FNV-1a byte freeze that voids the affected scores and prints loudly
   (`:1279-1301`), and the residual (edit-and-revert) is stated rather than hidden.
7. **`pass@k` / `pass^k` / flakiness are computed correctly and honestly labelled.** `passAtK` is
   `1 - C(n-c,k)/C(n,k)`, `passCaretK` is `C(c,k)/C(n,k)`, a case that flips is reported `flaky`
   rather than averaged, and with one trial the block says *"flakiness unmeasurable"* instead of
   implying zero (`run-eval.mjs:715-786`).
8. **`browser-smoke-verdict.mjs` fails closed everywhere that matters**: no viewports → exit 1, HTTP
   ≥400 or 0 → 1, any console/page error → 2, unreadable or malformed baseline → "diverges"
   (`:49-56, 101-124`), and it distinguishes a body-text *collapse* from a similar-length *replacement*
   via a hash + prefix (`:84-96`). No silent green.
9. **`check-assertion-gaps.mjs` is check-not-editor, masks strings/comments before pattern-matching,
   and fails closed on an unreadable subtree** (`:59-61, 82, 769-791`) — with 10 rule families
   including same-operand equality, always-true disjunctions and presence-only subjects.
10. **The tree's own `tsc` reading is structurally hard to game**: the emitter hard-codes
    `typecheck: "tsc --noEmit"` and a `tsconfig.json` whose `include` is `["src","tests"]`
    (`scaffold.ts:839-858, 975-1003`), so a brief cannot narrow the check, and an un-runnable declared
    script downgrades to `declaredScriptsVerified:false` rather than a green
    (`compile-check.server.ts:1974-1983`).
11. **`product-quality.quality` is a genuinely multi-signal bar** (entry + router + distinct content
    page + styled layout + ≥1 real module) that a hollow shell cannot satisfy — and it says out loud
    that its reads are string-presence, not execution (`product-quality.ts:895-900`).

---

## 8. What I could not verify

- **`scripts/guards/delivery-gate.test.mjs` was not executed.** It spawns the real CLI with
  `--run --git`; I judged that a possible write into a shared dirty tree outweighs the evidence. Its
  first assertion (`:79`) is nonetheless shown false by measurement (`outcome.substance = treeSubstanceOf(...)`
  at `compile-check.server.ts:2309` and `treeSubstanceOf(office-scheduler/emitted,{green:true}).verdict === "mixed"`).
- **`gate.sh` → verdict JSON was not run** (forbidden). All statements about its stages come from
  reading `gate.sh` plus running its component commands individually.
- **I could not count the tree's 15 failing tests from one run** (no `npm test`). I measured **7** of
  them directly in scope (2 replay-harness, 1 gate-invariants, 2 check-module-coverage, 2
  typecheck-scripts); the other 8 are outside this lane.
- **`--double` / `--quarantine` flake accounting was not exercised.** The `KNOWN_LOAD_FLAKES`
  allowlist (4 exact test names, `gate.sh:351-386`) plus `--quarantine` can convert a red leg to
  `ok:true` for those four names without a fix. I read the mechanism and the "isolated re-run must be
  green with `# fail 0`" guard, but I did not reproduce a flake.
- **`verifyHeldOut`'s anti-overfit value**: the held-out brief matches the live classifier today
  (`verify-prevention` prints `matches: true`), but it is *one* held-out case, and its own check
  contributes to `ok` only when the cassette is structurally absent (`replay-harness.mjs:1657-1675`) —
  a live mismatch is recorded as evidence and does **not** fail the sweep. I did not test a
  deliberately overfit classifier against it.
- **The 354 wave's other uncommitted reader changes** (`fixes/354 A2-F9/F10` reachability,
  `A2-F12` placeholder pages) were read only where they touch this lane; their effect on the
  `productQuality.quality` rate was not measured (it would require keyed runs).
- **`research/eval-out/**/` trial trees** (345 tracked files) were inspected structurally only; I did
  not re-grade them.
- **Whether the campaign will read the acceptance rate from `results.json` or from a fresh
  `--all` keyed run** is a plan-level question I cannot settle from the bytes; I reported the
  gameability of both paths.

---

## 9. Recommended owners for each P0/P1

| finding | owner (Wave/lane) | one-line ask |
|---|---|---|
| F-001 (untracked `testruns/`) | Wave 1 `docs-ledger` + the repo owner | Decide and execute: `git add` the fixture subset (the README already claims it is tracked), or strike the "tracked / green on a clean checkout" claim from `scripts/prevention/README.md` and make the missing run root an explicit precondition. |
| F-002 (untracked `guard-floor.json`) | Wave 1 `facts-ledger` / the prevention owner | Track `scripts/prevention/cassettes/guard-floor.json` and add a pin that a forged floor fixture (`countFloor:1, guardIds:[]`) still fails; today only a forged *registry* is pinned. |
| F-003 + F-004 (census semantics / C-06) | Wave 2 `reviewer-synthesis` (owns `compile-check.server.ts`) + the prevention owner | Either land A2-F3 *with* a re-pinned C-06 (fixture + driver predicate + CLI branch named in the registry), or revert the top-level census and keep `jobScoped` as the honest split. Do not leave a guard keyed on a retired field. |
| F-005 (C-14 control) | the prevention owner | Build the keyless control as `probe({...base, generatedTree: [], logs: []})` in `replay-harness.mjs:594` **and** `gate-invariants.test.mjs:207`. Do not touch `mutationRed` or the registry status. |
| F-006 (red pins) | Wave 2 `mender` (test repairs) | Repair the 7 in-scope red pins; start with `scripts/typecheck-scripts.test.mjs:219` (the `env` object's type) because that one also blocks `npm run typecheck`. |
| F-007 (tautological controls) | the prevention owner | Replace C-06's and C-16's `mutationRed` with a real mutation of the live seam (the pattern already exists in C-05/C-11/C-12). |
| F-008 (`--selftest` no-op) | Wave 1 `docs-ledger` | Either wire the flags to something observable or correct the README to say the mutation proofs are unconditional. |
| F-009 (self-audited guards) | Wave 5 (`algo`/`bench`-adjacent) or the prevention owner | Give S4-01..05 and the D/G/S family a fixture that is a frozen artifact rather than a mutation of the live source, or rename the harness's signal to what it is. |
| F-010 (moduleCoverage red + gaps-leg blind spot) | Wave 1 `docs-ledger` + the gate owner | Delete the 7 stale allowlist entries (the fix the guard itself names); add `src/components` to `check-assertion-gaps.mjs`'s `DEFAULT_TARGETS` and fix the `:50-52` comment. |
| F-011 (invisible skip) | the gate owner | Move the skip-registry check over the nested typecheck leg too, or register the nested-skip name. |
| F-012 (stale acceptance record) | the campaign owner | Make the acceptance rate read a fresh `--all` keyed run, and surface `results.json#stale` in `scorecard.ts` (and thus `rapidtool-cli eval`) rather than dropping it. |

**Bottom line for the campaign's ratchet:** the counter-machinery (floors, disjoint classification,
derived skips, fail-closed probes, grader freeze, leak scans) is real and was built by people who
understood the failure modes. But the *evidence base* is not frozen (`testruns/` is untracked, the
floor fixture is untracked), the *substantive-tree* metric was already moved 46%→100% by an
uncommitted reader edit, and C-06 shows the general failure: a guard can be disarmed by redefining
the field it reads, without touching the guard, the registry, or the forbidden floor. Until F-001,
F-002 and F-003 are closed, "the produced software improved" cannot be read off this layer.
