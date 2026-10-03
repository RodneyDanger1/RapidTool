# 340-2 (doctor-truth) — name the deliberate human-acceptance door

**Actor:** doctor-truth (lane 340-2). **Owned files (STRICT):** `src/lib/doctor.ts`,
`src/lib/doctor.test.ts`, this log. Everything else STOP-and-REPORT (§7).
**Opened:** 2026-10-03 at HEAD `a097fa8`, tree clean. **Runtime:** host Node v24.15.0 +
repo-pinned Node 22.23.2 (`%LOCALAPPDATA%\hermes\node\node.exe`); every run uses
`--test-reporter=tap`. **Scratch (outside the repo):** `%TEMP%\rt340_2\` (pre-fix RED tree +
census probe + TAP captures). **No keyed LLM calls.** **No tracked-file deletions.**

---

## 0. Reconciliation — claimed / on disk / still open

**Claimed (lane brief):**
- `factoryClaim` (`doctor.ts:400-427` pre-fix) ANDs five conjuncts, one of which is
  `evidence.humanFixtures === true`; that signal requires a `decidedBy:"human"` stamp, which is
  human-only by design (`fixes/338_4_acceptance.md`). So a perfectly autonomous,
  machine-verified run still reports `autonomousSoftwareFactory:false` — truthfully, but with no
  way for an operator to tell the *only* remaining reason is the deliberate human door.
- On the 339 wave's completed run, `doctor --tree` reported `gaps: ['no human-approved
  fixtures…', 'no real multi-job product', 'product-complete bar not met']` with
  `inventory {stubs:0, reexports:0, real:1}` on a **library**-kind brief (`fixes/339_0_parent.md`
  §5, verbatim).

**On disk today (read at `a097fa8`, before edits):**
- `doctor.ts:389-398` `gapsOf` pushed four static strings; `:412-438` `factoryClaim` ANDed five
  conjuncts and no derived "why" signal existed. `humanFixtures` was already DERIVED by 338-3
  (`humanFixturesFromProject`, `:304-321`) but only as a boolean — it cannot distinguish
  *waiting on a human* (`pending`) from *nothing drafted* (`no-fixtures`) or a policy
  violation (`machine-decided`). CONFIRMED.
- `fixtures.ts:384-401` already ships the machine-checkable state
  (`fixtureAcceptanceState`) and its ONE honest sentence (`acceptanceDecisionQuestion`); it is
  consumed by `maker-score.ts` but **not** by `doctor.ts`. CONFIRMED (grep: 0 doctor hits).
- `headless.doctorStatus` builds `DoctorStatus["factory"]` from `claim` field-by-field
  (`headless.ts:4820-4830`), so any new `DoctorFactory` field must be added there to reach an
  operator — that file is not mine → §7 R1.
- Census wording `FACTORY_GAP.product = "no real multi-job product"` was the same string whether
  the tree had zero real jobs (all leftovers) or exactly one real module with zero leftovers.
  CONFIRMED (`doctor.ts:384` pre-fix).

**Landed by this lane:**
| File | Δ |
|---|---|
| `src/lib/doctor.ts` | +135 / −14; imports `fixtures.ts`; `FactoryEvidence.acceptance`; `DoctorFactory.awaitingHumanAcceptance`; `acceptanceRecordIsStale` + `liveAcceptanceState`; `FACTORY_GAP.singleJob` + `productGapOf`; `factoryClaim` computes the signal |
| `src/lib/doctor.test.ts` | +240, 36 → 47 tests (11 new across 2 suites) |
| `fixes/340_2_doctor-truth.md` | this log |

---

## 1. The honest signal — and why its shape differs from the sketch

**Added: `DoctorFactory.awaitingHumanAcceptance: boolean`**, computed inside `factoryClaim`
from the SAME locals `autonomousSoftwareFactory` and `gapsOf` use (`doctor.ts`):

```ts
const awaitingHumanAcceptance =
  leftover === false && real === true && complete === true &&
  isolation.sandbox === false && human === false &&
  evidence.acceptance?.state === "pending";
```

and the fixtures gap is unchanged (`if (!human) gaps.push(FACTORY_GAP.fixtures)`), so when the
signal is true the record reads `gaps: [FACTORY_GAP.fixtures]` and
`autonomousSoftwareFactory: false`.

**Why a boolean alone was NOT enough (the shape the bytes forced).** The sketch suggested the
signal be a function of the `humanFixtures` boolean. That cannot be honest: `humanFixtures` is
DERIVED but collapsed — `false` covers *pending on a human*, *no bar drafted*, *machine-decided*,
*unattributed*, *unreadable* and *stale*. The first is the deliberate door; the rest are
defects. Only the record's own `FixtureAcceptanceState` can tell them apart, so the signal is
computed over a new **derived** `FactoryEvidence.acceptance` (below), and is true ONLY at
`state === "pending"`.

**The input is derived, never hand-fed, from ONE source.** `fixtures.fixtureAcceptanceState`
(the acceptance module's only reader) is called by a private `liveAcceptanceState(project)`,
which reuses the same brief-hash staleness rule the accepted-set reader already applies
(`acceptanceRecordIsStale`, factored out of `humanFixturesFromProject` — behaviour-identical).
`evidenceFromJobInventory` and `evidenceFromProjectRecord` and `coerceFactoryClaim` all derive
it from `project`; `acceptance` is **omitted from the `extra` type** and ignored at runtime, the
same anti-hand-feed discipline `productComplete` uses (pinned by test §3a′).

**Fail-closed on absent/garbled/stale.** `acceptance` undefined (no project, non-object project,
or a stale brief-hash set) ⇒ signal false; a garbled hand-fed state ⇒ false; `no-fixtures`,
`machine-decided`, `unattributed`, `unreadable` ⇒ false. The signal can only be true when the
machine half is genuinely complete AND the record is genuinely waiting.

**It never moves the latch and never mints a stamp.** `autonomousSoftwareFactory` is unchanged
(the same five-conjunct AND); `human === false` is a signal conjunct, and the latch requires
`human === true`, so the two can never be true together. No path writes `decidedBy`; this module
only reads. `awaitingHumanAcceptance` is false for `RAPIDTOOL_FACTORY_EVIDENCE`,
`coerceFactoryClaim` without a project, and `evidenceFromProjectRecord` (no measured census ⇒
the machine half is fail-closed ⇒ no "awaiting human" claim).

---

## 2. Census semantics for non-webapp kinds — the decision, with the bytes

**Decision: keep the flag's requirement unchanged; split the WORDING so the measured
single-real-module state is named instead of being reported as "no real product".**
`FACTORY_GAP.singleJob` is chosen by `productGapOf(evidence)` only when the SCAN bytes show
`stubs === 0 && reexports === 0 && real === 1`; every other case — including an unmeasured or
garbled census — keeps `FACTORY_GAP.product` ("no real multi-job product"). The stub/reexport
classifier and `realMultiJobProduct` (`inv.real >= 2 && stubs === 0 && reexports === 0`) are
untouched.

**Bytes read (all on disk at `a097fa8`):**
- `doctor.ts:123-146` `classifyJobSource` and `:415-424` `evidenceFromJobInventory` — the
  requirement and the classifier, unchanged. `realMultiJobProduct` needs **≥2** real jobs.
- Real census over every tracked emitted tree (`%TEMP%\rt340_2\census.ts`, read-only, imports the
  repo's own `inventoryFromJobSources`):
  ```
  coffeehouse2home-property-ledger--trial-1: stubs=1 reexports=4 real=0
  coffeehouse2home-property-ledger.run-2026-09-10: stubs=0 reexports=5 real=0
  field-ops-suite: stubs=1 reexports=0 real=0        (its one job file is the keyless template)
  house-flip-manager: stubs=1 reexports=4 real=0
  real-estate-crm: stubs=1 reexports=4 real=0
  rental-portfolio: stubs=1 reexports=3 real=0
  showing-booking: stubs=1 reexports=3 real=0
  ```
  Every tracked tree is a leftover tree (`real=0`) — so `real=1 ∧ no leftovers` cannot be
  confused with them, and the default wording still covers all of them.
- `fixes/339_0_parent.md:118-122` records the library-kind run verbatim:
  `inventory {stubs: 0, reexports: 0, real: 1}` + `gaps: […, "no real multi-job product", …]`.
  That is the state the new text names: a real entry module exists, the bar's **breadth** (≥2)
  is what falls short, and it is NOT a leftover-stub tree.

**Why not change `realMultiJobProduct` to accept one module?** That would weaken the flag's
evidence (the same defect the 331-4 template-stub fix closed) and let a single-module tree mint
the factory claim on fixtures alone. The test §3 pins that an approved human set on a
single-real-module census still reports `autonomousSoftwareFactory: false`.

**Why not leave the wording alone?** On the library bytes above, "no real multi-job product"
tells an operator nothing real was produced — false. Naming the state is the honest fix.

---

## 3. Satisfiability audit — RED-first

RED tree = `git archive HEAD` (pre-fix `doctor.ts`, verified 0 hits for the new symbols)
extracted to `%TEMP%\rt340_2\red\`, with ONLY the new `doctor.test.ts` overlaid; `node_modules`
reached by junction (gitignored, not in the archive). GREEN = the working tree. Both runtimes,
`--test-reporter=tap`.

| # | Fix | RED (pre-fix bytes) | GREEN (tree) |
|---|---|---|---|
| `awaitingHumanAcceptance` (8 tests) | new signal + derived `acceptance` evidence | 8 named subtests fail (undefined !== true/false) | all pass |
| `FACTORY_GAP.singleJob` (1 test) | `productGapOf` names the state | `a measured single-real-module census is named precisely…` fails (`FACTORY_GAP.singleJob` undefined) | passes |

RED (host v24 and pinned v22 identical):
```
not ok 1 - fail-closed: no acceptance state ⇒ awaitingHumanAcceptance false and the latch unmoved
not ok 2 - (a) a machine-complete-but-unaccepted run is distinguishable ON THE RECORD
not ok 3 - (a') the signal is NOT hand-fed: an extra.acceptance is ignored at runtime
not ok 4 - an absent bar (no-fixtures) is a defect, NOT awaiting a human
not ok 5 - machine-decided / unattributed / unreadable / stale / garbled are all NOT awaiting
not ok 6 - (b) a stubbed/reexport tree is NOT reported as awaiting-human even with a pending record
not ok 7 - (c) a genuinely complete+approved record needs no door flag; the human stamp is still required
not ok 8 - awaiting never flips the flag: a full machine-complete bag with human false stays un-latched
not ok 1 - a measured single-real-module census is named precisely, distinct from leftover stubs
# tests 47    # pass 38    # fail 9
```
GREEN:
```
host Node v24.15.0 : # tests 47  # pass 47  # fail 0  # skipped 0
pinned Node 22.23.2: # tests 47  # pass 47  # fail 0  # skipped 0
```
TAP captures: `%TEMP%\rt340_2\{red,green}_{host24,node22}.tap`.

**What the audit proves (mission 3):**
- **(a) distinguishable on the record** — two real jobs + arch-complete tree + a `pending`
  acceptance record derive `acceptance.state === "pending"`, `awaitingHumanAcceptance: true`,
  `autonomousSoftwareFactory: false`, `gaps: [FACTORY_GAP.fixtures]`. The state is read from the
  record's own bytes, not supplied by the caller (`(a')`: an untyped `extra.acceptance` is
  ignored; `ev.acceptance` is derived from `project` only).
- **(b) a stubbed/reexport tree is NOT awaiting-human** — with the SAME pending record, a
  TODO(E-15) stub + a reexport bridge (and the keyless deterministic template) derive
  `leftover: true` and `awaitingHumanAcceptance: false`.
- **(c) complete+approved still requires the human stamp** — a human-approved record on the
  same machine-complete shape fires the latch (`true`, `gaps: []`, signal false); dropping ONLY
  the human stamp (→ `pending`) falls the latch and raises the signal. A hand-fed full bag with
  `human: false` and a `pending` state stays `autonomousSoftwareFactory: false`.
- **census** — measured single-real-module ⇒ `FACTORY_GAP.singleJob` (and neither the product
  nor leftover text); unmeasured, leftover, and garbled census values all keep
  `FACTORY_GAP.product`; an approved human set on one real job still cannot fire.

**Read-only cross-check of the out-of-box pins** (not a full gate): the four `doctor` tests in
`src/lib/headless.test.ts` still pass — including `:2783`'s
`gaps.some(g => g.includes("no real multi-job product"))` (no-census path) and `:2719-2737`'s
latch-fires test. Filtered run: `35 tests / pass 35 / fail 0`, the four `ok N - … doctor …`
lines present.

---

## 4. Mock / fake census (the two changed files)

`grep -i 'TODO|FIXME|XXX|@ts-ignore|@ts-expect-error|@ts-nocheck|as any|catch {}|placeholder|mock|fake|stub|hardcod'`:
- `src/lib/doctor.ts` — hits are pre-existing and honest (the `stub` classifier rows, the
  `TODO(E-15)` gap text, "never fake it"). No new `TODO` body, no `as any`, no `@ts-*`, no silent
  catch, no hardcoded return faking a computation.
- `src/lib/doctor.test.ts` — hits are pre-existing `TODO(E-15)` classifier fixtures plus the new
  suite header comment ("never fake it"). The new tests use `as never` 3× only as the repo's
  hostile/untyped-caller idiom (pre-existing at `:555`), to prove a hand-fed signal is ignored —
  the opposite of a fake computation.
- No `it(...)` was left without a falsifiable assertion; every new test fails on pre-fix bytes
  (the census guard tests deliberately pass both before and after — they pin "no false
  precision", not new behaviour).

---

## 5. Counts (targeted, both runtimes)

| file | before | after |
|---|---|---|
| `src/lib/doctor.test.ts` | 36 tests / 6 suites | **47 tests / 8 suites** (+11) |

`node --experimental-strip-types --test src/lib/doctor.test.ts` — 47/0 on host v24 and pinned
v22. `npx eslint src/lib/doctor.ts src/lib/doctor.test.ts` — **exit 0, 0 warnings**. No full
gate was run (siblings were mid-edit in the shared tree; only my two files changed by me).

---

## 6. What I did NOT do, and why

- **Did not touch `headless.ts`.** The signal cannot reach the operator CLI without wiring there;
  that is a needed change outside my box → §7 R1 (exact shape given, not applied).
- **Did not weaken any gate.** `autonomousSoftwareFactory`, `realMultiJobProduct`, the
  stub/reexport classifier, `humanFixturesFromProject`'s stamp requirement, and the brief-hash
  staleness rule are all unchanged. The 338-4 decision (acceptance stays human) stands.
- **Did not mint or record any acceptance decision** and did not add a machine-acceptance path.
- **Did not edit docs/research** (`fixes/339_0_parent.md` etc.) — read only.
- **Did not run the full gate** and did not run `npm run eval`; no keyed calls.

---

## 7. STOP-and-REPORT — `src/lib/headless.ts` (owner: the 340 boundary / headless lane)

**What:** surface `awaitingHumanAcceptance` on `DoctorStatus["factory"]` so an operator driving
`doctor` / `doctor --tree` / `doctor --project` can see that the only remaining reason is the
deliberate human door. The CLI `doctor` arm returns `{ ok: true, ...status }` verbatim, so no CLI
change is needed once the field is on the status. Without this, the new field exists only through
`doctor.factoryClaim` (unit-testable) and never reaches the operator. My lane cannot make the
change (file not owned).

**Exact shape (three edits, all in `headless.ts`):**
```ts
// 1. DoctorStatus["factory"] (~4290), alongside autonomousSoftwareFactory:
    /** W53 · 340-2: true only when every machine-fixable conjunct is met and the
     *  sole remaining gap is the deliberate human acceptance stamp. */
    awaitingHumanAcceptance: boolean;

// 2. the inline honest floor (~4775) — fail-closed, same as the other floors:
    let factory: DoctorStatus["factory"] = {
      autonomousSoftwareFactory: false,
      awaitingHumanAcceptance: false,
      …
    };

// 3. the doctor-path assignment (~4820):
    factory = {
      autonomousSoftwareFactory: claim.autonomousSoftwareFactory,
      awaitingHumanAcceptance: claim.awaitingHumanAcceptance,
      …
    };
```
The `fixtures.ts` state sentences are NOT needed for this (the boolean plus the existing
`FACTORY_GAP.fixtures` gap is sufficient); if the owner wants the state's own sentence rendered
in `gaps`, that is a separate, larger change to `gapsOf` and its pins, deliberately not taken.

---

## 8. RESUME — the signal now reaches the operator (`headless.ts`, landed)

**Opened 2026-10-03 · lane 340-2 resumed.** HEAD `a097fa8`. The shared working tree already
carried OTHER lanes' uncommitted edits (sibling `.ts` files, plus `headless.ts` quarantine/wild
hunks) — that is not mine and is not claimed here; my diff is ONLY the three
`awaitingHumanAcceptance` hunks below. Runtime: host Node v24.15.0 + pinned Node 22.23.2.
Scratch `%TEMP%\rt340_2\` (E2E trees + JSON/TAP captures). **No keyed LLM calls.** No full gate
(only `doctor.test.ts` + `headless.test.ts`, both runtimes). No tracked-file deletion.

§7's STOP-and-REPORT is closed: the field now lands on `DoctorStatus["factory"]` and reaches the
CLI verbatim (`case "doctor"` → `respond({ ok: true, ...status })` — no CLI file changed).

| # | file:line | edit |
|---|---|---|
| 1 | `headless.ts:4349` | `awaitingHumanAcceptance: boolean;` on `DoctorStatus["factory"]` (+4-line doc) |
| 2 | `headless.ts:4834` | inline fail-closed floor literal: `awaitingHumanAcceptance: false` |
| 3 | `headless.ts:4881` | doctor-path assignment: `awaitingHumanAcceptance: claim.awaitingHumanAcceptance` |

All three DERIVE from the same `doctor.factoryClaim` claim as `autonomousSoftwareFactory`; the
value is never hand-fed, never flips the latch, never mints a stamp. The floor is the
absent/garbled path — a throw before the claim leaves the field `false` (fail-closed).

### Real-bytes CLI proof (`node --experimental-strip-types scripts/rapidtool-cli.mjs doctor --tree …`)

Two real trees under `%TEMP%\rt340_2\`, each shipping `.rapidtool/project.json` = the repo's own
arch-complete keyed record shape (the same bytes that close the P6 product bar in the 338-3 pin)
with `acceptanceFixtures:[{id:"fx-1",approval:"pending"}]` — drafted, not yet decided.

**(a) `e2e_a\` — two REAL job modules (`src/jobs/{board,column}.ts`), no leftovers:**
```json
"factory": { "autonomousSoftwareFactory": false, "awaitingHumanAcceptance": true,
             "leftoverJobsAreReexportsOrStubs": false,
             "gaps": ["no human-approved fixtures (decidedBy:\"human\")"],
             "inventory": { "stubs": 0, "reexports": 0, "real": 2, "files": ["board.ts:real","column.ts:real"] } }
```
exit 0 — the machine half complete, the latch truthfully false, and the ONE remaining reason
named as the deliberate human door, with no other gap standing.

**(b) `e2e_b\` — a TODO(E-15) stub + a reexport bridge, the SAME pending record:**
```json
"factory": { "autonomousSoftwareFactory": false, "awaitingHumanAcceptance": false,
             "leftoverJobsAreReexportsOrStubs": true,
             "gaps": ["leftover jobs are reexports or TODO(E-15) stubs …",
                      "no human-approved fixtures (decidedBy:\"human\")",
                      "no real multi-job product",
                      "product-complete bar not met (skip≠green; stubs≠complete)"],
             "inventory": { "stubs": 1, "reexports": 1, "real": 0, "files": ["board.ts:stub","column.ts:reexport"] } }
```
exit 0 — the same record cannot make a leftover tree read as "a human is holding it up".

Bare `doctor` (no tree) shows the inline floor: `"awaitingHumanAcceptance": false`.

### RED-first, both runtimes (TAP)

New pin `headless.test.ts:2746` — "W53 · 340-2: doctor --tree surfaces awaitingHumanAcceptance …".
BEFORE the 3 edits (both runtimes, identical): `not ok 17 - …` /
`error: the sole remaining reason is the deliberate human door  + actual - expected  + undefined - true`
(`ERR_ASSERTION`); `# tests 153  # pass 152  # fail 1`. Run at `:2814`.
AFTER: `ok 17`; combined `doctor.test.ts + headless.test.ts` = **200 tests / 200 pass / 0 fail /
0 skipped** on host v24.15.0 AND pinned v22.23.2 (baseline was 199/199 before the new pin).
Every pre-existing doctor/headless pin stayed green; no pin moved — no literal of
`DoctorStatus["factory"]` is constructed outside `headless.ts`, so the new required field is safe.

TAP captures: `%TEMP%\rt340_2\{base,red_headless,green}_{host24,node22}.tap`; JSON:
`green_{a,b,notree}.json`; scoped `npx eslint src/lib/headless.ts src/lib/headless.test.ts`
= exit 0, 0 warnings.

### Census (the two files this resume changed)
`grep -i 'TODO|FIXME|XXX|@ts-ignore|@ts-expect-error|@ts-nocheck|as any|catch {}|placeholder|mock|fake|stub|hardcod'`
— every hit is pre-existing and honest: the test-seam fakes in `headless.test.ts`, the `"stub"`
classifier kind, the `TODO(E-15)` gap text, "never hardcode true". The new pin's only census hit
is its real leftover fixture string (`TODO(E-15) stub: implement board`) — a classifier INPUT,
not a fake. No `as any`, no `@ts-*`, no silent catch, no placeholder branch was added.

### What I did NOT do
- Did not edit `doctor.ts` / `doctor.test.ts` — the signal PRODUCER was already correct.
- Did not render `fixtures.acceptanceDecisionQuestion`'s sentence in `gaps` (separate, larger change).
- Did not touch `autonomousSoftwareFactory`, `realMultiJobProduct`, the stub/reexport classifier,
  the human-stamp requirement, or the brief-hash staleness rule.
- Did not spend any keyed LLM call (no keyed record was needed: the arch-complete record is the
  repo's own keyed shape already verified by the 338-3 pin).
- Did not run the full gate and did not claim the sibling lanes' uncommitted `headless.ts` hunks.
