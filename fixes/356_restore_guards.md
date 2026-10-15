# fixes/356 — lane `restore-guards` (W356): make the two broken prevention guards real again

**Lane:** `restore-guards` (1 of 6), wave **W356**. **Repo:** `C:\Users\mnril\Desktop\RapidTool Main`
(path contains a space). **Host:** Node **v24.15.0**, Windows PowerShell 5.1.
**Scope:** `scripts/prevention/**` (harness, drivers, README read-only) + `scripts/guards/**`
(incl. `guard-registry.json`, the `*.test.mjs` suites). Cassettes **read-only**; no `src/**` edit.

**Method:** skeleton-first, then append. Every claim below cites `file:line` and the command that
produced it. Findings are stated as old→new readings, never as "fixed".

---

## 0. Baseline captured before any edit (red tree, as expected)

```
cd "C:\Users\mnril\Desktop\RapidTool Main"
node scripts/prevention/verify-prevention.mjs --all --selftest
→ exit 1 · ok:false · guards:34 · count:34 · countFloor:34
  fixtureIntegrity.missed:["C-06"] · fixPresence.pending:["C-14"] · skipped:[]
node --test --test-reporter=tap scripts/guards/gate-invariants.test.mjs
→ exit 1 · # pass 12 # fail 1 # skipped 0   (test 9 = "C-14 p6-arch must fail closed ...")
```
Reproduced the audit ledger (`fixes/355_0_audit_wave.md` §2.3 L3 / L10) exactly: C-06 missed,
C-14 pending. `guard-floor.json` reads `countFloor: 34` with all 34 ids (the panel's REFUTED line
was correct: the `{countFloor:1, guardIds:[]}` claim is false — see §4).

---

## 1. C-06 — the substance driver read a field that no longer carried shell detection

**Root cause (as landed).** `scripts/prevention/replay-harness.mjs` `DRIVERS["substance"]` fired only
on `treeSubstanceOf(dir,{green:true}).verdict === "empty"`. The uncommitted 354 `A2-F3` census
re-pointed the bare top-level census at the WHOLE tree, so on the pinned 13-tree corpus no tree read
`"empty"` any more (13/13 `"mixed"`) and the guard reported `fired:false` — a guard disarmed by the
reader it reads, with zero product change.

**Reading, before (old).** probe of the real seam over the 13 frozen trees, whole-tree `verdict`:
`empty top-level: 0`, `empty job-scoped: 7`.

**Reading, after (new).** `src/lib/compile-check.server.ts:810-874` (restore-census landed mid-lane)
publishes THREE named readings: `jobScoped` (`:817-823`), `wholeTree` (`:824-830`), and the bare
top-level alias, documented in-code as the job-scoped/shell detection reading (`:860-867`:
*"The bare top-level reading IS the job-scoped one (W356) - the number the campaign tracks and the
field the substance guard's `verdict === "empty"` shell detection reads"*).
Probe: `empty top-level: 7`, `empty job-scoped: 7`.

**What this lane changed (strengthen, never weaken).**

- The driver now reads the shell field by an EXPLICIT DECLARED PATH, `jobScoped.verdict`
  (`replay-harness.mjs:896` `SHELL_VERDICT_FIELD`, used at `:1401`), not the bare alias. This is the
  point: the A2-F3 defeat was a re-point of the bare alias, so keying on the sub-reading makes that
  exact re-point unable to disarm the guard.
- The driver reports a missing/reshaped key field as a `shapeViolations` entry
  (`replay-harness.mjs:1405`) instead of falling through to `fired:false`.
- The documented top-level alias is pinned as a CHECKED contract (`SHELL_VERDICT_ALIAS`,
  `replay-harness.mjs:897`; validated at `:988-992`): the alias must equal the shell reading. The
  census lane's own C-06-adjacent pin (`delivery-gate.test.mjs:75` asserts the CLI's
  `payload.substance?.verdict === "empty"`) depends on that equality, so re-pointing the alias is a
  regression, not a refactor.

**New reading.** `DRIVERS["substance"]` fires on **7 of 13** trees (flower-shop ×2, office-invoice,
office-scheduler ×2, office-stock ×2), control clean, evidence carries
`{"shellField":"jobScoped.verdict", "empty":[…7 trees…]}`.

---

## 2. C-14 — the "keyless floor" control was built from a fixture that is NOT keyless

**Root cause.** `SEAM_CHECKS["C-14"]` built the mutation control as `{...base, generatedTree: []}`
where `base = readJsonFile(testruns/office-stock-tracker/build.json)`. That fixture's own logs carry
the keyed attempt, so the fail-closed `p6-arch` probe returned `false` for the control too and
`mutationRed` could never be true (permanent `pending`).

```
node C:\Users\mnril\AppData\Local\Temp\rt-w356-probe\c14-old-reading.mjs
fixture p6.synthesis.* rows: 8 | newest: p6.synthesis.refused
OLD mutation control  item.probe({...base, generatedTree: []}) = false      ← mutationRed unreachable
OLD sentinel          item.probe(base + attempt)               = false      ← wired was true
generatedTree length: 2
```
Corroborated by `fixes/355_0_audit_wave.md` §2.7 ("test 367 … its `keylessNoTree` fixture keeps 8
`p6.synthesis.*` rows, newest `refused`, so it is not the keyless floor it claims").

**What this lane changed.** The control is now the same REAL bytes with every `p6.synthesis.*` row
removed — one variable changed — materialized as a real fixture FILE and read back through the real
reader (`replay-harness.mjs:1045-1047` `projectFixture`, `:1025` `synthesisRowCount`, `:1035`
`withoutSynthesisRows`; applied at `:604`). No cassette was added or edited (cassettes are read-only
to this lane); the keyless floor is derived from the real artifact in the temp scratch dir.

**Old→new reading (harness evidence, `C-14.fixPresence.evidence`):**
`{sentinel:false, keylessFloor:true, controlSynthesisRows:0, fixtureSynthesisRows:8}` and
`mutationRed: false → true`. C-14 LEAVES `pending`: `fixPresence.pending:["C-14"] → []`.

**The identical unsatisfiable assertion** in `scripts/guards/gate-invariants.test.mjs` (test 9, which
was `not ok 9` in the baseline) is repaired the same way: a `buildKeylessFloor(project)` helper
(`:85-92`) strips the synthesis rows and loads the result through the real loader; the test now also
asserts WHY the old control was unsound (`:230-234`: the fixture carries 8 keyed rows, so a
`generatedTree`-only control is not keyless). Test 9: `not ok → ok` (13/13 pass).

---

## 3. The canary — a guard can no longer be disarmed by renaming its key field

**Design** (`replay-harness.mjs:865-1021`, block "KEY-FIELD CANARIES"):

- `KEY_FIELD_CANARIES` (`:939`) declares, per guard, the reading it keys on, the field, the domain it
  must stay in, and (optionally) a pinned alias + required shape flags. Two entries:
  `C-06` → `src/lib/compile-check.server.ts#treeSubstanceOf(...)`, field `jobScoped.verdict`, domain
  `empty|stub-skeleton|mixed|real`, alias `verdict`;
  `C-14` → `src/lib/dod.ts#DOD[6] 'p6-arch'`, field `probe`, must be `function` with
  `phase6IsArray`/`itemFound` true.
- `validateCanary` (`:976-1001`) is pure, so a planted shape change can be proven without editing the
  seam. Problems: `key-field-missing`, `key-field-reshaped`, `key-field-alias-missing`,
  `key-field-alias-repointed`, `key-reading-shape-changed:<flag>`, `key-reading-unavailable`,
  `key-reading-threw`.
- `evaluateCanaries` (`:1003-1018`) probes the REAL seam; `runAll` folds every violation into `missed`
  as `<canary:<guard>:<code>>` (`:2006`, `:2015`) and exposes `canaries`/`canaryViolations` in the
  verdict and in the printed JSON; `finalize` re-folds them from the verdict's own fields
  (`:2086-2090`) and ANDs `canaryViolations.length === 0` into `ok` (`:2110`) — so a verdict object
  that dropped a violation cannot read green.
- **Code choice:** `RT_E_VALIDATION` — a REGISTERED `ERROR_CODE_DOC` code (`src/lib/errors.ts:182`
  registry / doc at `:562-566`). Minting a new `RT_E_GUARD_KEY_FIELD_MISSING` string would add to the
  13 live-but-undocumented codes the audit records at L30, and `src/lib/errors.ts` is outside this
  lane's scope. The validation rule that failed is carried structurally in the envelope
  (`field`/`expected`/`actual`/`problem`).

**Behavior on a PLANTED shape change** (raw output, `node C:\Users\mnril\AppData\Local\Temp\rt-w356-probe\canary-demo.mjs`):

```
declared canaries: C-06:jobScoped.verdict, C-14:probe
LIVE      : {"ok":true,"missed":[],"canaryViolations":[],"canaries":{"ok":true,"checked":["C-06","C-14"],"violations":[]},"c06fired":true}
PLANTED   : {"ok":false,"missed":["C-06","<canary:C-06:RT_E_VALIDATION>"],
             "canaryViolations":[{"guard":"C-06","code":"RT_E_VALIDATION","problem":"key-field-missing",
              "reading":"src/lib/compile-check.server.ts#treeSubstanceOf(...)","field":"jobScoped.verdict",
              "expected":"empty|stub-skeleton|mixed|real","actual":"(missing)"}],"c06fired":false}
REPOINTED : {"ok":false,"missed":["<canary:C-06:RT_E_VALIDATION>"],
             "canaryViolations":[{"guard":"C-06","problem":"key-field-alias-repointed", …
              "actual":"verdict=mixed != jobScoped.verdict=empty"}],"c06fired":true}
```
PLANTED = the field C-06 keys on renamed away (the silent-disarm this canary exists to remove):
old behavior `fired:false / ok:true`; new behavior `ok:false` + coded envelope naming the field.
REPOINTED = the alias back on the whole-tree census (the exact A2-F3 defect): the guard still fires,
but the alias contract violation fails the run loudly.

**Pins:** `scripts/prevention/replay-harness.test.mjs:127-169` ("canary: a guard's key field
disappearing or being reshaped fails LOUDLY with a coded envelope") proves the live seam is clean,
the planted rename yields `ok:false` + `<canary:C-06:RT_E_VALIDATION>` + `problem:"key-field-missing"`
+ the field name, the re-point yields `key-field-alias-repointed`, and the pure validator catches
out-of-domain values, unavailable readings and a reshaped `DOD` registry.
`replay-harness.test.mjs:106-125` pins C-14's keyless control (`controlSynthesisRows:0`,
`fixtureSynthesisRows>0`, `mutationRed:true`, no longer pending).

---

## 4. Report only (NOT fixed): the tracking gap — README claims tracked + green on a clean checkout

I did **not** edit `scripts/prevention/README.md` (docs-ledger territory). The claim text, verbatim
(`scripts/prevention/README.md:34-39`, 473 bytes of lines 34-39):

> The frozen evidence is **tracked in the repo** at `<repo>/testruns/` — a MINIMAL
> fixture subset (the 7 historical projects' 13 emitted trees, their `brief.md` /
> `build.json` / `packet.md`, the repair/approve records and the campaign2
> below-floor projects the CLI legs consume). It was vendored from the developer
> box's larger run root (B1-F1); the absolute `C:/Users/mnril/Desktop/testruns`
> fallback is gone, so the harness is green on a clean checkout. Resolution order,

and `:44` (`2. \`<repo>/testruns\`  ← the tracked fixture subset this repo ships`).

**The bytes on this checkout** (node/git 2.55.0.windows.5, read-only queries):

```
git ls-files testruns                                     → 0 tracked files
git status --porcelain testruns                           → ?? testruns/
Get-ChildItem testruns -Recurse -File | Measure-Object    → 325 files
git ls-files scripts/prevention/cassettes/guard-floor.json → (empty)
git status --porcelain scripts/prevention/cassettes/guard-floor.json → ?? …guard-floor.json
git check-ignore -v …guard-floor.json testruns            → (no output; not ignored, merely untracked)
git status --porcelain --ignored -uall testruns           → 1 ignored inside:
                                                            !! testruns/office-scheduler/.rapidtool/logs/rapidtool.ndjson
```
`.gitignore` contains no `testruns`/`cassettes` entry. So a clean checkout receives **zero** of the
325 fixture files and **no** `guard-floor.json`; the README's "tracked in the repo … green on a clean
checkout" is false today (the second and third resolution candidates are `<repo>/testruns` and
`<repo>/../testruns`; on a clean checkout the first is absent and the harness would fall to
`<run-root-missing>`).

`guard-floor.json`'s own `purpose` string calls it *"The REVIEWED, immutable guard-count floor"* — an
immutability claim that does not survive a checkout while the file is untracked.

**Re-verified, not taken on faith — the floor does NOT collapse onto the registry**
(the panel's REFUTED line, `fixes/355_0_audit_wave.md` §2.3 L9b — correct):

```
node C:\Users\mnril\AppData\Local\Temp\rt-w356-probe\floor-probe.mjs
guard-floor.json bytes: countFloor= 34 guardIds= 34 present= true
missing floor -> {"present":false,"countFloor":0,"guardIds":[],"error":"guard-floor.json missing or carries no numeric countFloor"}
missing-floor verdict: {"ok":false,"missed":["<floor:guard-floor-missing (guard-floor.json missing or carries no numeric countFloor)>"],
                        "countFloor":34,"pending":[]}
```
A missing floor is a hard, named failure with no registry fallback. A `countFloor` of 1 or an empty
`guardIds` is NOT present in the bytes.

**OWNER DECISION (escalated; this wave cannot commit — no git writes).** Either
(a) commit `testruns/` (325 files) **and** `scripts/prevention/cassettes/guard-floor.json` so the
harness's own fixture basis and its reviewed floor exist on a clean checkout, or
(b) declare the prevention harness non-reproducible from a clean checkout and correct the README
claim at `scripts/prevention/README.md:34-39` and `:44` (README edits belong to the docs lane, not
this lane). Note for (a): `testruns/office-scheduler/.rapidtool/logs/rapidtool.ndjson` is gitignored,
so `git add testruns` will not carry everything the harness reads. Until one is chosen, the harness's
green is reproducible only on THIS dirty tree.

---

## 5. Verification evidence (final readings)

```
cd "C:\Users\mnril\Desktop\RapidTool Main"
node scripts/prevention/verify-prevention.mjs --all --selftest | node -e "<print the gate fields>"
→ exit 0 · {"ok":true,"guards":34,"count":34,"countFloor":34,"missed":[],"pending":[],
            "skipped":[],"controlMissed":[],"canaries":{"ok":true,"checked":["C-06","C-14"],"violations":[]}}
node --test --test-reporter=tap scripts/prevention/replay-harness.test.mjs   → # pass 17 # fail 0 # skipped 0
node --test --test-reporter=tap scripts/guards/gate-invariants.test.mjs      → # pass 13 # fail 0 # skipped 0
node --test --test-reporter=tap scripts/guards/delivery-gate.test.mjs        → # pass  2 # fail 0 # skipped 0
```
Unchanged guards stay green (floor untouched): `campaign-invariants` 7/7, `campaign2-invariants` 7/7,
`final-wave-invariants` 6/6, `enabling-wave-invariants` 6/6, `campaign-pins` 2/2,
`repair-monotonic` 3/3.

`npx tsc -p tsconfig.scripts.json --noEmit` → **no error in `scripts/prevention/**` or
`scripts/guards/**`**. The remaining errors in that run are confined to `scripts/quality-ratchet.mjs`
(a different lane's mid-edit file; attributed by file, not acted on).

**One transient, attributed and re-run.** The first `delivery-gate.test.mjs` run showed
`not ok 1`, then passed on re-run (40.8 s apart) with no change of mine in between: the suite spawns
the real CLI, so a sibling lane's mid-edit `src/**` was the cause, as the wave brief warned. Final
reading after the census lane landed: 2/2 pass.

---

## 6. Scope discipline

- No `src/**`, `scripts/rapidtool-cli.mjs`, `scripts/typecheck-scripts.test.mjs`,
  `scripts/README-cli.md`, doc, register, README or other lane's log was edited.
- No floor lowered (`countFloor` 34 / 34 pinned ids unchanged), no guard deleted, no cassette edited
  or added, `guard-registry.json` untouched.
- No `gate.sh`, no `npm run build`, no full `npm test`, no keyed call, no git write.
- No mock/stub/fake on a production path: the keyless-floor control is a real JSON file read by the
  real reader; the only test-time injection is `ctx.seams` (same override convention as the existing
  `ctx.registry` / `ctx.cassettes` / `ctx.guardFloor`), used by the canary pin to plant a rename.

## 7. Left open / unverified

- `--keyed` / `--budget` paths were not exercised (out of scope; acceptance is keyless).
- The canary table covers C-06 and C-14 — the two keys this lane restored. Other drivers that read
  object FIELDS of a seam reading (rather than an export's presence) are not yet declared; the table
  at `replay-harness.mjs:939` is the single extension point, and an undeclared field remains
  silently-disarmable. Stated plainly rather than implied covered.
- The `trees`/`cassettes` corpus itself is the untracked 325-file basis of §4: fixture-integrity
  green here is green on THESE bytes only.

---

## 8. Closing state (appended last)

- `git rev-parse --short HEAD` → `30bce78` (unchanged; this lane made **no** git write — commit/stash/checkout).
- Files this lane touched: `scripts/prevention/replay-harness.mjs` (C-06 driver, C-14 seam control,
  key-field canaries, `runAll`/`finalize`/`formatVerdict` wiring, keyless-floor fixture helpers,
  `DRIVERS` JSDoc result type), `scripts/prevention/replay-harness.test.mjs` (2 new pins),
  `scripts/guards/gate-invariants.test.mjs` (C-14 pin + `buildKeylessFloor`), and this log
  (`fixes/356_restore_guards.md`). No other file, and no cassette, was written.
- Target re-run after the last code edit (the `tsc` type fixes), then a final read-only re-run:
  `ok:true`, `guards:34`, `count:34`, `countFloor:34`, `missed:[]`, `pending:[]`, `skipped:[]`,
  `controlMissed:[]`, `canaries:{"ok":true,"checked":["C-06","C-14"],"violations":[]}`; exit 0.
- The 13-tree corpus, the 34-guard floor and the two cassettes consumed above are, per §4,
  untracked bytes on this machine — the owner decision in §4 gates whether that green is
  reproducible anywhere else.
