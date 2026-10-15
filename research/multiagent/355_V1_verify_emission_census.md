# 355 V1 — Adversarial verification: emission & census claims

Repo: `C:\Users\mnril\Desktop\RapidTool Main` · HEAD `30bce78` (dirty tree, uncommitted "354 wave")
Verifier posture: READ-ONLY. One file written (this one). No product/doc/cassette/fixture edited.
No `npm test`, no `npm run build`, no `bash scripts/gate.sh`, no keyed LLM call. Scratch probes were
written under `%TEMP%` only.

Node `v24.15.0`. TS probes run with `node --experimental-strip-types`; the emitted tree's own spec was
run with `node --experimental-strip-types --test tests/oracle.spec.ts` (the tree's declared `npm test`,
invoked directly rather than via npm).

---

## CLAIM 1 — P0: unwired oracle rows now emit a REACHABLE `assert.fail` (HEAD emitted `test.skip`)

**VERDICT: PARTLY** — the emitter regression and its "red emitted tree" consequence are **CONFIRMED**;
the claim's absolute "a fresh keyless `emit --run` can **NEVER** pass" is **REFUTED** (a full
deterministic/keyless run emits a green tree).

### (a) HEAD vs working tree — emitter bytes
Commands:
```
git show HEAD:src/lib/scaffold.ts  → scan for NOT IMPLEMENTED / test.skip / assert.fail
Select-String -Path src/lib/scaffold.ts -Pattern 'is NOT IMPLEMENTED'
```
Raw:
```
HEAD: assert.fail=5   test.skip=14
WT  : assert.fail=7   test.skip=4
```
The relevant emission branch:

HEAD (`src/lib/scaffold.ts`, blob at HEAD) — the row header is a *conditional* skip, `skipDominated`
decides:
```
2809  const emitSkip = skipRow && !skipDominated;          // skipDominated = notImplemented > assertable (line 2472)
2813    ? `test.skip(${jstr(`${id} — NOT IMPLEMENTED`)}, () => {`
...
2959        `  assert.fail(${jstr(`${id} is NOT IMPLEMENTED — replace this skip ...
```
So at HEAD the final `else` row body was *always* `assert.fail(...)`, but under a non-skip-dominated
oracle the test HEADER was `test.skip("<id> — NOT IMPLEMENTED", …)` — the body never ran → the emitted
tree's `npm test` was GREEN.

WT (`src/lib/scaffold.ts`) — the header is unconditional `test(` and the body is a reachable fail:
```
6216    // fixes/354 A2-F2 (D4): an unwired row is a REAL failing test under its
6218    const liveAssertable = !skipRow;
6219      liveAssertable ? `test(${jstr(id)}, async () => {` : `test(${jstr(id)}, () => {`,
...
6360    // … the row is emitted as a REAL failing test: `npm test` exits non-zero …
6374      `  assert.fail(${jstr(`${id} is NOT IMPLEMENTED — replace this failing row with the row's real acceptance assertion`)});`,
```
`skipDominated` is gone from the working tree (`Select-String 'skipDominated' src/lib/scaffold.ts` → 0 hits;
HEAD had 6). The `test.skip` that remains (WT line 6193) is only the "project has no A7 rows" sentinel.
**The skip→fail switch is real.**

### (b) Emitted tree's own `npm test`
Bounded deterministic (keyless) emit via `scaffoldProject`, materialized to `%TEMP%`, then its own spec run
(`%TEMP%\emit_probe.mjs`, `%TEMP%\probe_primed_app`, `%TEMP%\probe_fullrun_app`):
```
primed_app (P0-only, 1 unwired row):
  oracle.spec.ts: assert.fail=1 test.skip=0 top-level test(=10
  $ node --experimental-strip-types --test tests/oracle.spec.ts
    ok 1..9 - …
    not ok 10 - orc-phase
      error: "orc-phase is NOT IMPLEMENTED — replace this failing row with the row's real acceptance assertion"
    # tests 10 / # pass 9 / # fail 1        (process exit 1)
```
=> an emitted tree carrying ≥1 unwired A7 row is now RED, so the `--run` leg would refuse with
`RT_E_TREE_RUN_FAILED` and `--git` would withhold. **CONFIRMED for that case.**

### The refutation of "NEVER"
A *complete* deterministic/keyless engine run (`runHeadless(seedProject({kind:"app"}), ALL_PHASES)`) emits
a tree whose own spec is GREEN:
```
fullrun_app:
  oracle.spec.ts: assert.fail=0 test.skip=0 top-level test(=15
  $ node --experimental-strip-types --test tests/oracle.spec.ts
    # tests 15 / # pass 15 / # fail 0 / # skipped 0
```
In that tree `orc-phase` is `async` (its surface was materialized), so no `assert.fail` is emitted. The
354 branch only reddens rows classified `not-implemented`; when every row is assertable the tree is green.
Therefore "a fresh keyless `emit --run` **can NEVER** pass" is false as an absolute — it is true
*conditioned on the emission carrying an unwired A7 row* (which the deterministic floor usually does, but
not always). Existence of a green keyless emission also breaks the "`factory-watch` can **never** deliver"
sub-claim.

---

## CLAIM 2 — P0: whole-tree substance census flips `empty`→`real`

**VERDICT: CONFIRMED** (both (i) and (ii)); the C-06 failure is **causally** this change, not a separate
defect.

### Reader diff
WT `treeSubstanceOf(dir)` (WT `src/lib/compile-check.server.ts:784`) now:
```
789  const jobSources = collectTreeJobSources(subject);
790  const inv = inventoryFromJobSources(collectTreeCodeSources(subject), subject);   // WHOLE TREE
793  const verdict = substanceVerdictOf(files.length, stubs, reexports, real);
```
HEAD `treeSubstanceOf` used only the job-scoped sources:
```
HEAD:695-701  const sources = collectTreeJobSources(subject);
              const inv = inventoryFromJobSources(sources, subject);   // src/jobs + jobs ONLY
```
`collectTreeJobSources`, `inventoryFromJobSources`, `substanceVerdictOf` and
`substanceVerdictOf(files===0→"empty"; real===0→"stub-skeleton"; stubs+reexports===0→"real"; else "mixed")`
are unchanged between HEAD and WT (verified byte-for-byte). So **HEAD's top-level verdict == WT's additive
`jobScoped.verdict`**, and the *only* variable is job-scoped vs whole-tree file selection.

### (i) zero-product scaffold reads `real`
`%TEMP%\scaffold_only_probe.mjs` — `scaffoldProject({name:"ScaffoldOnly"})`, materialized, censused:
```
emitted src: src/main.tsx, src/styles.css        (no src/jobs, no src/generated → ZERO generated product)
census verdict=real real=2 stubs=0 reexports=0 nfiles=2
```
HEAD's job-scoped census on the same directory ⇒ `files.length===0` ⇒ `verdict:"empty"`.
**Exactly the claimed "scaffold-only webapp reads real:2". CONFIRMED.**

### (ii) pinned 13-tree corpus
Corpus pinned by `scripts/prevention/cassettes/trees.json` (`count: 13`), dirs under `testruns/<slug>/<variant>`.
`%TEMP%\census_probe.mjs` (same bytes, both readers):
```
bakery-website/emitted            whole: verdict=mixed real=9  | jobScoped(=HEAD): verdict=real  real=5
bakery-website/emitted.v2         whole: mixed       real=11 | jobScoped: real  real=5
flower-shop-website/emitted       whole: mixed       real=4  | jobScoped: empty real=0
flower-shop-website/emitted.v2    whole: mixed       real=4  | jobScoped: empty real=0
bakery-florist-orders/emitted     whole: mixed       real=11 | jobScoped: real  real=5
bakery-florist-orders/emitted.v2  whole: mixed       real=11 | jobScoped: real  real=5
mobile-companion/emitted          whole: mixed       real=8  | jobScoped: real  real=5
mobile-companion/emitted.v2       whole: mixed       real=9  | jobScoped: real  real=3
office-stock-tracker/emitted      whole: mixed       real=4  | jobScoped: empty real=0
office-stock-tracker/emitted.v2   whole: mixed       real=5  | jobScoped: empty real=0
office-scheduler/emitted          whole: mixed       real=4  | jobScoped: empty real=0
office-scheduler/emitted.v2       whole: mixed       real=4  | jobScoped: empty real=0
office-invoice-tracker/emitted    whole: mixed       real=5  | jobScoped: empty real=0

JOB-SCOPED (HEAD reader)  verdict=="real": 6/13
JOB-SCOPED (HEAD reader)  verdict!=="empty" (has real product): 6/13
WHOLE-TREE (WT reader)    verdict!=="empty" (has real product): 13/13
WHOLE-TREE (WT reader)    verdict=="real": 0/13
```
**The claimed rate move 6/13 → 13/13 (46% → 100%) reproduces exactly** — with the nuance that under the
WT reader the literal label is `mixed` for all 13 (no tree reads the literal `"real"`); the jump to 13/13
is "has real product / not `empty`". The starting 6/13 is HEAD's literal `"real"` count. No corpus bytes
changed — this is purely the reader (`testruns/` is untracked and untouched by the wave).

### C-06 causality
`DRIVERS["substance"]` (`scripts/prevention/replay-harness.mjs:1190`) fires only when some tree reads
`verdict === "empty"`; the control is `bakery-website/emitted` (`.verdict !== "empty"`). After the change
**no** corpus tree reads `empty` (all `mixed`), so `fired.length === 0` ⇒ `fixtureIntegrity.fired=false` ⇒
C-06 lands in `missed`. This is exactly the reported `fixtureIntegrity.missed:["C-06"]`. The control leg
still passes (mixed !== empty), so only the fire leg broke. **C-06's stop-firing IS causally this census
change — not a separate defect.** (The separate `fixPresence.pending:["C-14"]` is unrelated to this reader.)

---

## CLAIM 3 — P0: `underProduced:"refuse"` is inert (both default and explicit refuse materialize)

**VERDICT: CONFIRMED.** A caller that asks for `"refuse"` DOES end up with files on disk.

Cross-file interaction:
- `src/lib/scaffold.ts:8535`
  ```
  const underProducedPolicy: "partial" | "refuse" =
    options.underProduced === "refuse" || options.allowUnderProduced === false ? "refuse" : "partial";
  ```
  → default (no options) = **`"partial"`**. HEAD's equivalent (`HEAD:4141`) was
  `if (options.allowUnderProduced !== true) { … return RT_E_PLAN_UNDERPRODUCED … }` → default = **refuse**.
- `src/lib/headless.ts:2827,2838`
  ```
  2827  const underProducedPolicy = opts.underProduced ?? "refuse";
  2838  const result = scaffold.scaffoldProject(
          emitProjectInput, underProducedPolicy === "banner" ? { allowUnderProduced: true } : undefined);
  ```
  Only `"banner"` forwards an option; `"refuse"` **and** the default both pass `undefined`, which now hits
  the scaffold's flipped `"partial"` default. HEAD's headless called `scaffoldProject(emitProjectInput)`
  (no options) into a scaffold whose default was refuse.

Decisive command — the repo's own pinned test for exactly this contract:
```
node --experimental-strip-types --test --test-reporter=tap \
  --test-name-pattern="default refuses before writing" src/lib/headless.test.ts
```
Raw:
```
not ok 1 - default refuses before writing; underProduced:'banner' lands the partial with the caution banner
  error: |-
    the default ship path refuses a below-floor plan

    true !== false
  location: 'src/lib/headless.test.ts:5898:14'
# tests 1 / # pass 0 / # fail 1        (exit 1)
```
`%TEMP%\refuse_probe.mjs` (emitProject over a REAL below-floor project — `generatedSource` + a phase-6
`p6.synthesis.refused` row carrying `RT_E_PLAN_UNDERPRODUCED`):
```
explicit_refuse: ok=true
  dirExists=true entries=[.env.example,.github,.gitignore,.rapidtool,DEPLOY.md,index.html,LICENSE,package.json,README.md,src,tests,tsconfig.json,vite.config.ts]
default_no_opt:  ok=true
  dirExists=true entries=[.env.example,.github,.gitignore,.rapidtool,DEPLOY.md,index.html,LICENSE,package.json,README.md,src,tests,tsconfig.json,vite.config.ts]
```
Plainly: **yes — a caller that asks for `"refuse"` gets a full tree on disk.** Both the explicit
`underProduced:"refuse"` path and the no-option default materialize a below-floor partial.

---

## CLAIM 4 — P0: `testruns/` untracked; `guard-floor.json` untracked / `{countFloor:1,guardIds:[]}`

**VERDICT: PARTLY** — the untrackedness (both) and the README contradiction are **CONFIRMED**; the
specific content assertion `{countFloor:1, guardIds:[]}` is **REFUTED**, and the "collapses onto the
mutable registry" mechanism is **not supported**.

Commands / raw:
```
$ git ls-files testruns | Measure-Object -Line
  0
$ git status --porcelain testruns
  ?? testruns/
$ Get-ChildItem testruns -Recurse -File | Measure-Object   → Count 325
$ git ls-files scripts/prevention/cassettes
  … list of 66 tracked cassette files …
  (guard-floor.json ABSENT)
$ git status --porcelain scripts/prevention/cassettes/guard-floor.json
  ?? scripts/prevention/cassettes/guard-floor.json
$ Get-Content scripts/prevention/cassettes/guard-floor.json
  "countFloor": 34,
  "guardIds": [ "C-01","C-02","C-03","C-13","C-09","C-11","C-06","C-04","C-05","C-12",
                "C-14","C-16","C-18","C-15","C-17","C1-01","C1-02","C1-05","C1-06",
                "C1-08","R2-01","R2-03","R2-05","R2-06","S4-01","S4-02","S4-03","S4-04",
                "S4-05","G1-01","S3-01","D2-01","D3-01","D1-01" ]    (34 ids)
```
- `testruns/` = 0 tracked files, 325 files on disk, `??` in status. **CONFIRMED untracked.**
- `scripts/prevention/cassettes/guard-floor.json` is not in `git ls-files` and is `??`. **CONFIRMED untracked.**
- Its bytes are `countFloor:34` + **34** `guardIds`, **not** `{countFloor:1, guardIds:[]}`. **REFUTED.**
- "Collapsing the anti-tamper floor onto the mutable guard registry" is **not supported**: `verify-prevention.mjs`
  calls `runAll({runRoot, cassettes, registry})` with no `guardFloor`, so `runAll` calls
  `loadGuardFloor(CASSETTE_DIR)`; a missing file → `present:false` → `floorViolations:["guard-floor-missing …"]`
  → hard failure. There is **no fallback to the registry** (`GUARD_COUNT_FLOOR = 34` at
  `replay-harness.mjs:1686` is defined but unused; `verify-prevention.mjs:25 countFloor:34` is only the
  EMPTY/error envelope). The real clean-checkout failure mode is **floor-missing**, not registry-collapse.
  Independently, `resolveRunRoot()` returns null with no `testruns/` ⇒ `EMPTY({missed:["<run-root-missing>"]})`,
  exit 1.

README claim vs bytes (`scripts/prevention/README.md`):
```
line 34: "The frozen evidence is **tracked in the repo** at `<repo>/testruns/` — a MINIMAL fixture subset …"
line 39: "… so the harness is green on a clean checkout."
line 44: "2. `<repo>/testruns`  ← the tracked fixture subset this repo ships"
line 79: "| C-06 substance gate | `office-scheduler/emitted` (+`v2`) | real `treeSubstanceOf(...).verdict === \"empty\"` (control: bakery-website → `real`) |"
```
The bytes say `testruns/` is 100% untracked and `guard-floor.json` is untracked ⇒ a clean checkout has
neither the run root nor the pinned floor ⇒ the harness cannot be green. **README claim REFUTED by bytes.**

---

## What I think the nine lanes got WRONG

1. **CLAIM 4's cassette bytes.** `guard-floor.json` does **not** contain `{countFloor:1, guardIds:[]}`; it
   contains `countFloor:34` and a 34-entry `guardIds` (full pinned set). The "collapsed onto the mutable
   guard registry" story is also wrong — a missing floor is a hard `guard-floor-missing` failure, with no
   registry fallback. The genuine, still-P0 defect is narrower: the *authoritative* floor and the entire
   fixture basis are untracked, so a clean checkout fails (`<run-root-missing>` and/or `guard-floor-missing`)
   while the README advertises the opposite.
2. **CLAIM 1's "NEVER".** A complete deterministic/keyless emission (all rows assertable) is GREEN
   (`# tests 15 / # pass 15 / # fail 0`). The regression is real but conditional: it reddens exactly those
   emissions that still carry an unwired A7 row. "emit --run can never pass / --git always withholds /
   factory-watch can never deliver" over-generalizes from that.
3. **CLAIM 2's literal label.** The rate move to 13/13 is real, but no corpus tree reads the literal
   `verdict:"real"` after the change — all 13 read `"mixed"`. The number that matches "6/13 → 13/13
   (46% → 100%)" is the *"has real product / not empty"* rate; HEAD's *literal* `"real"` count is the 6/13.
   Calling the post-change state "13/13 real" is inaccurate — say "13/13 non-empty".
4. **CLAIM 2's causality is right.** The C-06 `fixtureIntegrity.missed` is causally the census change
   (no tree reads `empty` any more), not a separate defect. The co-reported `fixPresence.pending:["C-14"]`
   is unrelated to this census.

## Repro artefact index (all under `%TEMP%`, none in repo)
- `%TEMP%\census_probe.mjs` — 13-tree whole vs job-scoped census.
- `%TEMP%\emit_probe.mjs` + `%TEMP%\probe_primed_app`, `%TEMP%\probe_fullrun_app` — keyless emits + their `oracle.spec.ts`.
- `%TEMP%\scaffold_only_probe.mjs` — zero-product scaffold census.
- `%TEMP%\refuse_probe.mjs` — explicit-refuse vs default below-floor emit.
- `%TEMP%\head_scaffold.ts` — `git show HEAD:src/lib/scaffold.ts` dump (UTF-16; line numbers via PowerShell).
