# fixes/357 — lane `fix-gates` (W357): the measurement layer

**Lane:** W357 `fix-gates` (1 of 5 sibling coding lanes, concurrent). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`.
**Host:** Node v24.15.0. **HEAD:** `30bce78` (`main`), **dirty tree** — no commit was made, so every number below
describes the bytes on disk. **Wave plan:** `wave_plans/W357/fix-gates.md`. **Append-only; this lane is its only writer.**

## 0. What this lane owns

`scripts/check-module-coverage.mjs` · `scripts/check-module-coverage.test.mjs` · `scripts/quality-ratchet.mjs` ·
`scripts/quality-ratchet.test.mjs` · `scripts/quality-ratchet.floors.json` · `scripts/typecheck-scripts.test.mjs` ·
`scripts/gate.sh` (additive only).

## 1. Skeleton (filled in by the appends below)

- [x] JOB 1 — the 7 stale `src/lib/auth/*` allowlist entries: removed, with why each became stale → §2
- [x] JOB 2 / R-3 — floors pinned at the measured value (no regression can move them) → §3.1
- [x] JOB 2 / R-4 — the census canaries and the corpus wiring → §3.2
- [x] JOB 2 / R-8 — the optional `jobScoped?` / `wholeTree?` pair against a required producer → §3.3
- [x] JOB 3 / R-5 — the `realProductOnly` reader extended to RapidTool's own `src/**` → §4
- [x] JOB 4 — the owed `src/lib/errors.ts` line (`RT_E_RATCHET_METRIC_UNAVAILABLE`) → §5
- [x] Verification commands and their readings → §6, with the honest limits in §7

<!-- appends below this line -->

---

## 2. JOB 1 — `moduleCoverage` is GREEN: the 7 stale entries are removed

### 2.1 The reading

`node scripts/check-module-coverage.mjs` → **exit 0** ·
`[module-coverage] 131/140 src/lib modules reached by a test · 9 allowlisted · 0 unallowlisted gap(s) ·
0 stale allowlist entries`, and `--json` → `"total":140,"covered":131,"unallowlisted":[],"stale":[]`.

`node --test --test-reporter=tap scripts/check-module-coverage.test.mjs` → **7 pass / 0 fail / 0 skipped**.
The gate's own field is now `moduleCoverage.ok:true` with `stale:[]`.

### 2.2 The 7 entries deleted, and WHY each one became stale

The guard's rule is exact: an entry whose module IS reached by a test is a **hole in the ratchet** — it
would silently re-exempt the module if a later change orphaned it again — so it FAILS the guard until it is
deleted. Deleting is therefore the only correct fix, and no new entry was added. The reachability was
re-derived with the guard's own exports (`coveredModules()` BFS parents), not read off the gate JSON:

| deleted entry | reached by (BFS chain, measured) | why it became stale |
|---|---|---|
| `src/lib/auth/verify.server.ts` | `account-default.test.ts` → **direct** | the 354 wave's account suite imports the session resolver directly; the old entry's reason was "no test drives it: needs the TanStack Start request context", which was true when written and stopped being the question the moment a test imported the module |
| `src/lib/auth/server.ts` | `account-default.test.ts` → `verify.server.ts` → **server.ts** | same suite, one hop deeper: `verify.server.ts` imports the Better Auth instance |
| `src/lib/auth/email-password.ts` | `account-default.test.ts` → `verify.server.ts` → `server.ts` → **email-password.ts** | `server.ts` imports the on/off flag; reachability is transitive |
| `src/lib/auth/gate-session.server.ts` | `account-default.test.ts` → `verify.server.ts` → `server.ts` → **gate-session.server.ts** | `server.ts` imports the gate-session plugin |
| `src/lib/auth/pglite-dialect.ts` | `account-default.test.ts` → `verify.server.ts` → `server.ts` → **pglite-dialect.ts** | `server.ts` imports the Kysely/PGlite dialect |
| `src/lib/auth/middleware.ts` | `account.test.ts` → `account.ts` → **middleware.ts** | the second account suite goes through `account.ts`, which imports the documented server-function wrapper |
| `src/lib/auth/client.ts` | `account.test.ts` → `account.ts` → `middleware.ts` → **client.ts** | `middleware.ts` imports the browser auth entry; the entry's old reason ("harness-blocked: reads `import.meta.env`") was a reason no test could **drive** the module — this guard measures a STATIC import fact, and a test now reaches it |

Nothing else was touched: the other nine entries are still real gaps
(`app-data/index.ts`, `auth/gates.tsx`, `auth/popup.server.ts`, `auth/provider.tsx`,
`auth/use-current-user.ts`, `error-component.tsx`, `mcp/stub-server.ts`, `multiplayer/index.ts`,
`multiplayer/p2p.ts`), and the guard's own tests pin that state —
**including the test that fails if a module is dropped wrongly** ("the live repo has no NEW uncovered
src/lib module" plus "a stale allowlist entry (module now reached) fails the guard"; both pass).
The block comment above the allowlist was rewritten to record the deletion, the two measured chains, and
the reason the "harness-blocked" text was not the right reason (so the next reader does not re-add them).

---

## 3. JOB 2 — R-3, R-4, R-8: floors and canaries that can actually fire

Every claim below has a **planted** proof. The in-repo proofs are the `--selftest` teeth
(`node scripts/quality-ratchet.mjs --selftest` → **ok:true, 31 teeth, 35/35 enforced floors beaten →
all caught**) and the 34 tests in `scripts/quality-ratchet.test.mjs`; the external proof is an in-memory
plant against the REAL bytes (`%TEMP%\rt357_plant.mjs`), whose output is quoted verbatim in each row.

### 3.1 R-3 — "floors pinned at the measured value ⇒ a metric that cannot fire"

An `atLeast: 0` floor can never fire: a count cannot fall below 0, so the metric it pins is not measured
in practice. The cartographer named `kindFit.{app,game,library}.fit` and `productQuality.qualityCount`
(all 0-at-0), and flagged the readings "the floor deliberately cannot see": `kindFit.app` surfaceOk
**10 of 30**, game/library surfaceOk **0 of 1**.

**Fix (a floor must sit where a regression moves it).** Each toothless pin now names the reader's own
MOVING sub-legs, and every sub-leg is pinned at its measured value as its own enforced floor — a DROP in
any of them turns the ratchet red, which the headline count never could:

| headline pin (unchanged, floor 0) | `subLegs` added (each an enforced floor at the measured reading) | measured |
|---|---|---|
| `kindFit.app.fit` (0 of 30) | `kindFit.app.{entryOk 29, scriptsOk 29, surfaceOk 10, demandedMatch 20}` | 29/29/**10**/20 of 30 |
| `kindFit.game.fit` (0 of 1) | `kindFit.game.{entryOk 1, scriptsOk 1, demandedMatch 1}` | 1/1/1 of 1 |
| `kindFit.library.fit` (0 of 1) | `kindFit.library.{entryOk 1, scriptsOk 1, demandedMatch 1}` | 1/1/1 of 1 |
| `productQuality.qualityCount` (0 of 25) | `productQuality.{treesPresent 25, realModulesPresent 25}` | 25/25 of 25 |

The sub-legs whose reading is 0 (`game`/`library` `surfaceOk` 0 of 1) are **named in the pin's `reason`**
instead of being floored at 0 — a floor there would be the same toothless shape the fix removes.
`acceptance.passCount` (0 of 1, one `stale:true` keyed artifact) declares `nonRegressible` with the reason:
its count sits at its structural minimum and the honest bar cannot be raised to 1 without turning a red
tree redder; the moving tooth for acceptance is `acceptance.samples ≥ 1`. `tree.tscPassSample` was
`atLeast 0` with a reading of 1 — an honest bar of "the sampled trees run their own typecheck green", so it
is **RAISED to 1** (a floor may only rise) and stays `pending-first-green` because the producer is opt-in.

**Structural guard so it cannot come back** — new canary
`canary.floors.atleast-zero-pins-are-accounted`: every `atLeast: 0` pin must either name `subLegs` (each
resolving to a pin with floor > 0) or declare `nonRegressible`. Real run:
`ok=true`, `{zeroPins: [productQuality.qualityCount, acceptance.passCount, kindFit.app.fit,
kindFit.game.fit, kindFit.library.fit], accounted: 5, unaccounted: []}`.

**Planted proofs (against the real floors file):**
`kindFit.app.surfaceOk (atLeast floor 10) beaten to 9 → ok=false, regressions=["kindFit.app.surfaceOk (atLeast floor 10, measured 9)"]` ·
`kindFit.app.entryOk 29→28 → ok=false` · `kindFit.game.entryOk 1→0 → ok=false` ·
`productQuality.treesPresent 25→24 → ok=false` · `productQuality.realModulesPresent 25→24 → ok=false` ·
`kindFit.app.scriptsOk 29→28 → ok=false` · `kindFit.game.scriptsOk 1→0 → ok=false` ·
`kindFit.library.entryOk 1→0 → ok=false` · `kindFit.app.demandedMatch 20→19 → ok=false` ·
`realProductOnly.repoModulesScanned 153→152 → ok=false` ·
`tree.tscPassSample 1→0 → ok=true but reported (pending-first-green, not enforced — the tree is red)`.
Teeth: `canary.floors.atleast-zero-pins-are-accounted-has-teeth` (a bare `atLeast: 0` pin trips it) and
`…accepted-a-subleg` (an accounted one passes).

### 3.2 R-4 — "a zero-tree corpus that can never trip a floor"

Two real defects, both fixed:
1. **First-row blindness.** `canary.census.job-scoped-reachable` read `censusRows[0].raw` only, so a shape
   change on any other pinned tree could not fire it at all. It now checks **every** row and names each
   offending tree.
2. **The corpus the canaries were handed was never itself checked.** New canary
   `canary.census.corpus-is-pinned`: the rows the census canaries were handed must BE the pinned corpus
   (row count == the cassette's pinned count AND ≥ the pinned `tree.corpusSize` floor), so a zero-tree or
   silently truncated corpus is a NAMED FAILURE instead of the one state in which every census canary is
   vacuous. Real run: `ok=true, {rows:13, pinned:13, floor:13}`.

**Planted proofs:** planted **zero-tree** corpus (`,pinned:13`) →
`job-scoped-reachable=false, whole-tree-reachable=false, corpus-is-pinned=false, job-scoped-scope-pinned=false`
(pre-fix all four would have passed vacuously or been undefined) ·
planted **truncated** corpus (5 of 13) → `corpus-is-pinned=false` ·
planted rename on the **LAST of 13** real rows → `job-scoped-reachable=false` with
`reason: the reader's shape is invalid on 1 of 13 pinned tree(s): office-invoice-tracker/emitted: …`
(pre-fix: rows[0] was read, so this PASSED).
Teeth: `canary.census.corpus-is-pinned-has-teeth`, `…accepts-the-pinned-corpus`,
`canary.census.job-scoped-reachable-checks-every-row`.
Bonus teeth from the same fix: `census.shape-invalid-row-fails-closed-on-an-enforced-pin`,
`census.empty-corpus-fails-closed` (an empty corpus must never read as "0 real trees").

### 3.3 R-8 — the optional `jobScoped?` / `wholeTree?` pair against a required producer

`TreeSubstance` declares both readings OPTIONAL ("so hand-built fixture outcomes still satisfy the type")
while `treeSubstanceOf` returns both REQUIRED, so a consumer reading `substance.jobScoped.verdict` off a
hand-built outcome gets `undefined` with no compile error. **The type-level fix is a `src/**` edit no lane
owns this wave** (see §6), so the contract is enforced at the runtime boundary this lane does own:

- `substanceScopeShape(raw, scope)` validates ONE named scope (numeric `stubs`/`reexports`/`real`, a
  verdict in `{real,mixed,stub-skeleton,empty}`, and an array `files`); `censusShape(raw)` requires
  **BOTH** `jobScoped` AND `wholeTree` and returns a reason **by name** for each one missing/renamed.
- `readCensus` stores both verdicts per tree and a `shapeError` built from BOTH scopes.
- New canary `canary.census.whole-tree-reachable`: every pinned tree's outcome must expose a shape-valid
  `wholeTree`. Real run: `ok=true, {trees:13, wholeTreeVerdicts:[mixed ×13]}`.
- `censusRealTreesReading(census)` — the substantive-tree reading, with its fail-closed rule in one pure
  place: a census that cannot be read, has no rows, or has ANY shape-invalid row yields
  `RT_E_VALIDATION` on the enforced pin (a hard failure BY NAME) instead of silently becoming a smaller
  number that reads like evidence of a product change.

**Planted proofs:** missing `wholeTree` on the first real row →
`whole-tree-reachable=false`, `reason: 'wholeTree' is absent or shape-invalid on 1 of 13 pinned tree(s):
bakery-website/emitted: …` · the same census read through `censusRealTreesReading` →
`reading=null code=RT_E_VALIDATION`, and evaluated against the enforced pin →
`ok=false, unavailableEnforced=["tree.jobScopedRealTrees (RT_E_VALIDATION): the census reader's shape is invalid …"]` ·
on the untouched bytes → `reading=6` (6 of 13 real job-scoped trees).
Teeth: `canary.census.whole-tree-reachable-has-teeth`, `…checks-every-row`.

---

## 4. JOB 3 — R-5: the owner-rule reader now covers RapidTool's own `src/**`

### 4.1 What was wrong and what changed

`realProductOnly` measured the owner's rule over the **13 pinned emitted trees** only, so RapidTool's own
`src/**` — where this repo's code lives — was outside the reader enforcing "no mock/stub/fake/demo code on
a production path". The scope gap is now closed by the SAME rule, not a second one:

- `testDoubleViolations(path, source)` — the test-double clause of the owner rule, extracted into ONE
  exported function. `scanRealProduct` (emitted corpus) calls it; `scanRepoTestDoubles` (the repo's own
  tree) calls the identical function, so the two scopes cannot drift apart.
- `scanRepoTestDoubles(files)` walks `src/**` in `collectReadings`, skips test seams **by name**
  (`*.spec.*` / `*.test.*` / `tests/` / `__tests__/` / `__mocks__/` / `__fixtures__/`, where a double IS
  legitimate), and adds one repo-only leg: a production module may not import a specifier that
  **RESOLVES** (`./`, `../`, `@/`, extensionless, `index.ts`) to a test seam or a test-double-named file.
- Two new pins: `realProductOnly.repoTestDoubleImports` (**atMost 0**, reading **0**) and
  `realProductOnly.repoModulesScanned` (**atLeast 153**, reading **153**) — the vacuity floor, so an empty
  scan can never read as clean.
- New canary `canary.realProduct.repo-scan-discriminates`, declared in the floors file.

### 4.2 The false-positive check on the real tree (the bar is zero)

`node scripts/quality-ratchet.mjs --all` → the reader over the real `src/**`:
**`codeModules 280 · productionModules 153 · seamModules 127 · testDoubleFiles 0 · violations []`**, and
the canary's evidence `{clean:0, defect:2, defectKinds:[test-double-import ×2], resolvedHit:true,
falsePositives:[]}`. The three production-adjacent doubles the W356 cartographer proved are
test-seam-confined are explicitly re-checked and NOT flagged:

| legitimate (>test-seam-confined) | readers of it, measured | flagged? |
|---|---|---|
| `src/lib/llm/providers/mock.ts` | imported by `mock.test.ts` (a seam) only | **no** |
| `src/lib/mcp/stub-server.ts` | imported by no module (spawned as a child process) | **no** |
| `src/lib/testing/fixtures.ts` | imported by `*.test.ts` seams only | **no** |

A unit test reads the REAL bytes (`walkFiles(src)` + `readFileSync`) and asserts 0 violations over >100
production modules, plus the per-file controls above — a false positive here would be as bad as a miss.

**Planted proof (real tree, no writes):** adding ONE synthetic row
`src/lib/planted-double.ts: import { rows } from "./__mocks__/rows.ts"` to the real walk →
`violations=1 → ["src/lib/planted-double.ts [test-double-import] ./__mocks__/rows.ts"]`, while the three
legitimate doubles stay `flagged=false`. The resolution leg has its own planted proof in the suite
(`src/lib/mcp/client.ts → "./tests/harness.ts"` fires although the specifier text is innocuous).
Teeth: `canary.realProduct.repo-scan-discriminates-has-teeth` (a blind scanner trips it).

### 4.3 Recorded, NOT fixed (disclosed boundary of the rule)

The clause is the **test-double namespace** clause — which is what the plan asked for and what keeps zero
false positives. It deliberately does NOT flag a production module importing a shipped fixture module:
`src/lib/doctor.ts`, `io.ts`, `engine.ts`, `scaffold.ts`, `headless.ts` and `maker-score.ts` import
`src/lib/{fixtures,brief-fixtures}.ts`, whose own headers describe the T5.2-A fixtures-review surface and
the P0-1 oracle machinery (shipped product code, not doubles). Flagging those would be a red on ~10
production edges that the cartographer's mock/stub verdict does not treat as undisclosed doubles. It is
recorded here so the boundary owner can decide whether a *fixture-on-a-production-path* clause is wanted —
that decision needs an owner of both `src/lib/fixtures*.ts` and the reader's contract.

---

## 5. JOB 4 — the owed `src/lib/errors.ts` line (reported, armed, NOT invented)

`RT_E_RATCHET_METRIC_UNAVAILABLE` can only be registered in `src/lib/errors.ts`, **which no lane owned in
W357** (my scope is `scripts/**` only). It is therefore recorded machine-readably in
`scripts/quality-ratchet.floors.json#owedCodes` and the exact edit is:

**One line in `ERROR_CODES` (append-only; consumers match string literals, never array position), after `"RT_E_VALIDATION",`:**

```ts
  // W357 · lane `fix-gates`: the quality ratchet's own cause — a pinned floor whose producer
  // ran but produced no usable reading. Owed by W356 lane `ratchet` (it owned no `src/**` file).
  "RT_E_RATCHET_METRIC_UNAVAILABLE",
```

**And its `ERROR_CODE_DOC` entry (mirroring `RT_E_VALIDATION` at `errors.ts:562`):**

```ts
  RT_E_RATCHET_METRIC_UNAVAILABLE: {
    meaning: "A pinned quality-ratchet floor could not be measured — the producer ran but produced no usable reading.",
    agentAction:
      "Re-run the named producer and read its output; if the artifact is genuinely absent say so with RT_E_PROJECT_MISSING, and if a reader's shape changed fix the reader instead of the floor.",
  },
```

**What I did instead of inventing it, and why the canary is not weakened.** The ratchet keeps choosing an
EXISTING code **by cause** (`RT_E_RUNNER_UNAVAILABLE` = missing input, `RT_E_PROJECT_MISSING` = artifact
absent, `RT_E_VALIDATION` = reader shape changed) — the W356 decision — and `canary.errorCodes.registered`
is untouched, so it still fails closed the moment the ratchet emits anything unregistered. The debt is
**armed** by a new canary, `canary.errorCodes.owed-code-not-emitted`: a code declared in `owedCodes` must
never be EMITTED before `ERROR_CODES` carries it; the instant it is, the canary fails closed and names the
edit. Its real-run reading is `ok=true` with the note
*"owed and NOT yet emitted: RT_E_RATCHET_METRIC_UNAVAILABLE (src/lib/errors.ts is unowned this wave)"*.
Planted proofs: `emittedCodes:["RT_E_RATCHET_METRIC_UNAVAILABLE"]` + a register without it → **canary
fails** (`canary.errorCodes.owed-code-not-emitted-has-teeth`); the same emission WITH the code registered →
paid, passes.

**Decision recorded for the parent (override if you disagree).** I did NOT emit the new code so that
`canary.errorCodes.registered` would go red, because a deliberate red here would propagate into
`scripts/gate.sh`'s `nonTestGatesOk` fold (`gates.ratchet.ok`) and redden the whole gate for a debt no lane
can pay this wave. The chosen posture is the one the wave itself uses for "not yet": **declared, reported
in every verdict, and armed to fail closed on adoption**. If the parent wants the literal red instead, the
change is two lines (`UNAVAILABLE_CODES.<cause>: "RT_E_RATCHET_METRIC_UNAVAILABLE"` + a key in the
floors file's `owedCodes`), and it is the ONLY way to make that canary fail today.

---

## 6. Verification (exact commands, readings taken on the bytes on disk)

| command | result |
|---|---|
| `node scripts/check-module-coverage.mjs` | **exit 0** · `131/140 reached · 9 allowlisted · 0 unallowlisted · 0 stale` |
| `node --test --test-reporter=tap scripts/check-module-coverage.test.mjs` | **7 pass / 0 fail / 0 skipped** |
| `node scripts/quality-ratchet.mjs --all` | `ok:true` · 48 metrics · 22 canaries · `regressions:[]` · `canaryFailures:[]` · `unavailableEnforced:[]` |
| `node scripts/quality-ratchet.mjs --selftest` | `ok:true` · **31 teeth** · **35/35** enforced floors beaten → all caught · `selftestOk:true` |
| `node --test --test-reporter=tap scripts/quality-ratchet.test.mjs` | **34 pass / 0 fail / 0 skipped** |
| `npx tsc -p tsconfig.scripts.json --noEmit` | **exit 0, 0 errors** |
| `node --test --test-reporter=tap scripts/typecheck-scripts.test.mjs` | **7 pass / 0 fail** (one test added, see below) |
| `& 'C:\Program Files\Git\bin\bash.exe' -n scripts/gate.sh` | exit 0 (syntax only — **the full gate was NOT run**; the parent owns the boundary) |

**The gate stage was exercised without running the gate.** `scripts/quality-ratchet.mjs --all --gate <sim>`
against a temp dir carrying the gate's own shapes (`results` + the five logs) → `ok:true`, 0 regressions,
0 canary failures; `typecheck.errors` enforced at 0, the four `tests.*` readings read from the SIMULATED
TAP logs (`pass 650 / pass 4222` are the planted log values, not the boundary's — W356's real boundary read
`643` / `4215`), and all four `canary.gateReadings.*` canaries pass. **`scripts/gate.sh` was NOT
edited by this lane** (its working-copy diff is the W346/W356 ratchet stage arriving with earlier waves);
the wiring test in `quality-ratchet.test.mjs` still passes, which is the reason no additive change was
needed here.

**Additive test in `scripts/typecheck-scripts.test.mjs`** (it is in this lane's scope because R-1 was
exactly this class): a new leg asserts the measurement layer's own five files
(`quality-ratchet.mjs` / `.test.mjs`, `check-module-coverage.mjs` / `.test.mjs`, this suite) are on disk,
carry **no** `ERROR_BUDGET` entry, and that the ratchet + its suite typecheck clean. With the budget EMPTY,
that is the only state they may stay in — a budget entry there would let the measurement layer buy itself
an exemption from the typecheck it enforces everywhere else. `ERROR_BUDGET` itself is untouched (still `{}`).

---

## 7. Honest limits / unverified

- **No full gate run** (the parent owns the boundary), **no keyed LLM call**, **no git writes**.
- **The `tests.*` floors are still not enforced against a real gate log.** They are read from the gate's
  own TAP logs by design (the ratchet re-runs nothing heavy); the simulated `--gate` run above proves the
  path, but the first REAL exercise is the parent's boundary run.
- **R-8 is fixed at the runtime boundary only.** The actual type-level fix — make `jobScoped`/`wholeTree`
  required on `TreeSubstance` (or have `treeSubstanceOf` return a `Required<>` shape) — is an edit to
  `src/lib/compile-check.server.ts`, which **no lane owns this wave**; it is named here as a second owed
  edit, not performed.
- **`realProductOnly.repoModulesScanned ≥ 153` is reading-pinned.** It is the vacuity floor, so it must be
  re-pinned deliberately if any lane legitimately DELETES a production module under `src/**`. Sibling lanes'
  plans contain no such deletion (checked: `fix-lint` is explicitly forbidden from removing files to reach
  zero), but a shrink below 153 will read as a regression, by design.
- **The repo scanner resolves `./`, `../` and `@/` only.** A bare specifier that happens to map into
  node_modules is out of scope for this reader (it judges the repo's own modules, not its dependencies);
  the three legitimate doubles stay unflagged and re-deriving could not produce a false negative for a
  *local* double because every local specifier form is resolved.
- **Transient reds attributed by file.** The tree was RED throughout (build · lint · tests, all four
  sibling lanes' files). Nothing in this lane's own surface read red at any measuring point after JOB 1:
  the only red I produced was my own `--selftest` tooth
  `canary.census.whole-tree-reachable-has-teeth`, which failed because the planted corpus broke
  `jobScoped` rather than `wholeTree` — my planting was wrong, not the canary; it is fixed and green. No
  floor was lowered, no guard or test deleted, and no `pass` was recorded while `unavailable`.
- **The one number I could not move by measurement:** `productQuality.qualityCount` and
  `acceptance.passCount` remain pinned at 0. They are disclosed as structurally non-regressible
  (`subLegs` / `nonRegressible`) rather than presented as teeth; their moving teeth are the sub-legs and
  the sample-count floor named in §3.1.
