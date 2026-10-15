# fixes/356 — lane `restore-census` (W356): restore an honest census + real refuse semantics

**Lane:** `restore-census` (1 of 6 in W356). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (path contains a
space). **Host:** Node **v24.15.0** (`engines`: `>=22`). **Author:** this lane — append-only, sole writer.
**Baseline on entry (red tree, expected):** `npx tsc --noEmit` exit 2 · 5 type errors in 3 test files ·
`npm test` exit 1 · 15 failures (per `fixes/355_0_audit_wave.md` §0). Five sibling lanes were editing other
files concurrently; every error below is attributed by file, never "fixed".

**Owned files (mine alone):** `src/lib/compile-check.server.ts` (+ `src/lib/compile-check.server.test.ts`),
`src/lib/headless.ts`, `src/lib/headless.test.ts`. Nothing else was written.

**Scope of this log:** the census restore (task 1), the driver policy passthrough (task 2), the drifted test
(task 3), the keyless proofs (task 4), and anything deferred.

---

## 1. Skeleton — the plan this lane executes (written before the code)

1. Publish TWO readings under distinctly named fields (`jobScoped` | `wholeTree`) and keep a field on which
   `verdict === "empty"` is reachable again so prevention guard **C-06** can fire.
2. Forward the caller's resolved under-produced policy **explicitly on every path** (incl. `"refuse"`).
3. Fix the drifted test at `headless.test.ts:5999` (audit-classified **test-wrong**: `steps?: number` is
   optional by design).
4. Prove keyless: scaffold-only reads `empty` on the job-scoped reading; `refuse` → 0 files; `banner` → files
   WITH the banner.

---

<!-- landings appended below, in order -->

---

## 2. Landing A — the census: TWO named readings; the tracked field is job-scoped again

**Files:** `src/lib/compile-check.server.ts` (mine). **Commands:** the probe below + `npx tsc --noEmit`.

**What was wrong on entry (the 354 A2-F3 side effect, `fixes/355_0_audit_wave.md` §2.1 L1/L2/L3).** The bare
top-level `TreeSubstance` fields carried the WHOLE-TREE census, and that bare `verdict` is the field the
campaign's delivery gate reads:

- `scripts/rapidtool-cli.mjs:3008` / `:3026` — the `emit --run --git` hold keys on
  `runVerdict.substance.verdict === "empty"` (code `RT_E_SUBSTANCE_EMPTY`). With a whole-tree `verdict` no
  scaffold-only tree could ever read `empty`, so the "0 empty-substance commits" delivery metric was
  unfalsifiable.
- `scripts/prevention/replay-harness.mjs:1190-1205` — the **C-06** driver keys on `treeSubstanceOf(dir).verdict
  === "empty"`. With a whole-tree `verdict`, no corpus tree read `empty` → `fired:false` →
  `fixtureIntegrity.missed:["C-06"]` (audit L3).

**Decision (mine, on the evidence above):** the bare top-level fields go BACK to the job-scoped reading (HEAD
semantics — the number the campaign tracks), the 354 whole-tree reading is kept under a NEW distinctly named
field `wholeTree`, and the 354 lane's `jobScoped` sub-field stays as the explicit name of the job reading.
Both readings are therefore named, and editing either reader moves only its own field.

### 2a. old → new, field by field (`src/lib/compile-check.server.ts`)

| field (path) | old — working tree on entry (354 A2-F3) | new — W356 | where |
|---|---|---|---|
| `TreeSubstance.stubs` | whole-tree count | **job-scoped** count (`src/jobs/*` + `jobs/*`) | `:586-588` (doc) / `:863-867` (return) |
| `TreeSubstance.reexports` | whole-tree count | **job-scoped** count | same |
| `TreeSubstance.real` | whole-tree count | **job-scoped** count | same |
| `TreeSubstance.files` | whole-tree capped sample | **job-scoped** capped sample (`=== jobScoped.files`) | same |
| `TreeSubstance.verdict` | whole-tree label (`"mixed"` on 13/13 corpus trees) | **job-scoped** label (HEAD: `"real"` 6/13, `"empty"` 7/13) — **`"empty"` reachable again** | same |
| `TreeSubstance.jobScoped` | added 354, THE job-scoped reading | unchanged meaning; now byte-identical to the bare top level | `:606` |
| `TreeSubstance.wholeTree` | *(did not exist)* | **NEW** — the 354 whole-tree reading, distinctly named | `:613`, set at `:869` |
| `TreeSubstanceReading` | *(did not exist)* | **NEW** exported type: the shared 5-field reading shape | `:576-582` |
| `treeSubstanceOf(...)` return | `TreeSubstance & { jobScoped: … }` | `TreeSubstance & { jobScoped: TreeSubstanceReading; wholeTree: TreeSubstanceReading }` | `:810-813` |

`greenWhileStubbed` / `oracleStubTrap` / `note` were already keyed off the JOB census and are **unchanged** —
the note's trigger, counts and K3/K4 wording are byte-identical.

Reader functions are unchanged and unchanged in role: `collectTreeJobSources` (job-scoped) and
`collectTreeCodeSources` (whole-tree). Neither is deleted; no guard was weakened or removed.

### 2b. Probe 1 — the pinned 13-tree corpus, both readings (raw output)

Probe: `%TEMP%\rt356\probe-census.mjs` (outside the repo; imports only `treeSubstanceOf`).
Command: `node --experimental-strip-types "$env:TEMP\rt356\probe-census.mjs"`.

**Before (entry bytes)** — `%TEMP%\rt356\probe-census-before.txt`:

```json
{"trees":13,
 "topLevel":{"nonEmpty":13,"realPositive":13},
 "jobScoped":{"nonEmpty":6,"realPositive":6}}
```

**After (this lane)** — `%TEMP%\rt356\probe-census-after2.txt`:

```json
{"trees":13,
 "topLevel":{"nonEmpty":6,"realPositive":6},
 "jobScoped":{"nonEmpty":6,"realPositive":6},
 "wholeTree":{"nonEmpty":13,"realPositive":13}}
```

Per tree, after (13 rows, full rows in the file): `bakery-website/emitted` `real/5` · `bakery-website/emitted.v2`
`real/5` · `bakery-florist-orders/emitted` `real/5` · `…/emitted.v2` `real/5` · `mobile-companion/emitted`
`real/5` · `…/emitted.v2` `real/3`; the other seven (`flower-shop-website` ×2, `office-invoice-tracker`,
`office-scheduler` ×2, `office-stock-tracker` ×2) read `empty/0`. Every one of the 13 reads `mixed` on
`wholeTree` (e.g. `office-stock-tracker/emitted` → `wholeTree {verdict:"mixed", real:4, files:8}`), which is
exactly the 354 lane's genuine reading, preserved.

**Re-derived corpus rates (the number the campaign tracks):** job-scoped `real > 0` = **6/13 (46.2%)**;
whole-tree non-empty = **13/13 (100%)**. Both match `fixes/355_0_audit_wave.md` §2.1 L2 (6/13 · 13/13) —
re-derived independently here from the bytes. The 100% figure now lives only under `wholeTree`; it can no
longer be mistaken for the tracked rate.

---

## 3. Landing B — the driver forwards the under-produced policy on EVERY path

**File:** `src/lib/headless.ts` (mine). **Do not edit:** `src/lib/scaffold.ts` (lane `restore-oracle`).

**Old (`headless.ts:2834-2838` on entry):** the policy reached the scaffold only for `"banner"`; both the
default and the explicit `"refuse"` path passed `undefined`, so an absent option silently bought whatever
the scaffold's default was (audit L6: the 354 flip made that `"partial"`, so `"refuse"` materialized a
13-entry partial while the repo's own test failed `default refuses before writing`).

**New (`headless.ts:2831-2846`, with the report at `:2867-2871`):**

```ts
const underProducedDetail = scaffold.underProductionRefusalOf(emitProjectInput);
const result = scaffold.scaffoldProject(emitProjectInput, {
  underProduced: underProducedPolicy === "banner" ? "partial" : "refuse",
  ...(underProducedPolicy === "banner" ? { allowUnderProduced: true } : {}),
});
```

- Every path now passes an explicit `underProduced` (`"refuse"` for the resolved refuse policy, `"partial"`
  for `"banner"`), so the driver can never silently ask for a default again.
- The recorded refusal is resolved on **every** path (not only `"banner"`), so a landed partial can never
  ship without `underProduced{code,detail}` on the result — the report gap the lane owns.
- The below-floor banner is still stamped only for the policy that ADMITTED the partial (`"banner"`), so
  every previously-reachable emit path stays byte-identical apart from the restored refusal.
- `scaffold.ts` was **not** edited; the exact option names/values I forward are the ones declared there today
  (`ScaffoldOptions.underProduced?: "partial" | "refuse"`, `allowUnderProduced?: boolean`).

---

## 4. Landing C — the drifted test (`headless.test.ts`)

**Old (`headless.test.ts:5999`, audit §2.7: test-wrong, `steps?: number` is optional by design):**

```ts
assert.ok(res.steps >= 1, "`staged` is truthful — the run stepped instead of parking");
```

**New (`headless.test.ts:5999-6002`):**

```ts
assert.ok(
  (res.steps ?? 0) >= 1,
  "`staged` is truthful — the run stepped instead of parking (`steps` is optional by design; an absent count must fail this, not type-error it)",
);
```

The assertion keeps its teeth (an absent `steps` still fails it) and the `TS18048` error is gone — the
test-wrong classification is honored: the source was not touched.

---

## 5. Probe 2 — keyless refuse / banner / red-tree / scaffold-only (raw output)

Probe: `%TEMP%\rt356\probe-refuse.mjs` (outside the repo; **no keyed call**; writes only under `%TEMP%`).
Command: `node --experimental-strip-types "$env:TEMP\rt356\probe-refuse.mjs"` (env: no `DEEPSEEK_API_KEY`
used — the emitted trees are the deterministic keyless floor).

```json
{
 "refuse": {
  "ok": false,
  "code": "RT_E_PLAN_UNDERPRODUCED",
  "dirExists": false,
  "files": 0,
  "error": "RT_E_PLAN_UNDERPRODUCED · artifact refused (below-floor plan): missing declared modules: records, service"
 },
 "banner": {
  "ok": true,
  "files": 21,
  "underProduced": {
   "code": "RT_E_PLAN_UNDERPRODUCED",
   "detail": "RT_E_PLAN_UNDERPRODUCED · missing declared modules: records, service"
  },
  "readmeStartsWithBanner": true,
  "bannerTitle": "> ## BELOW-FLOOR PLAN - THIS ARTIFACT IS NOT A COMPLETE BUILD (RapidTool R2-01)"
 },
 "redTreeBanner": {
  "ok": true,
  "files": 21,
  "redTreeBanner": true,
  "bannerTitle": "> ## RED TREE-RUN — THIS ARTIFACT IS NOT VERIFIED (RapidTool T-07 / F-07)"
 },
 "scaffoldOnly": {
  "bareVerdict": "empty",
  "bareReal": 0,
  "jobScopedVerdict": "empty",
  "wholeTreeVerdict": "real",
  "wholeTreeReal": 1
 }
}
```

Readings:

1. **`refuse` writes ZERO files** — `emitProject(belowFloor, dir)` (default policy resolves to `"refuse"`):
   `ok:false`, `code:"RT_E_PLAN_UNDERPRODUCED"`, and the target directory was **never created**
   (`dirExists:false`, `files:0`). Old behavior on entry: the partial materialized (audit L6's 13 entries).
2. **`banner` lands files WITH the banner and the recorded seal** — 21 files, `README.md` begins with the
   `BELOW-FLOOR PLAN — THIS ARTIFACT IS NOT A COMPLETE BUILD` caution, and the result carries
   `underProduced{code:"RT_E_PLAN_UNDERPRODUCED", detail}`.
3. **the RED TREE banner still lands under `redTree:"banner"`** — 21 files, `redTreeBanner:true`, README's
   first heading is `RED TREE-RUN — THIS ARTIFACT IS NOT VERIFIED`.
4. **scaffold-only reads `empty` again on the job-scoped field** — a tree holding only `src/main.tsx` +
   `src/styles.css` (the exact audit L1 shape): bare `verdict:"empty"`, `real:0`, `jobScoped:"empty"`; the
   354 reading is preserved beside it as `wholeTree:{verdict:"real", real:1}`.

---

## 6. C-06 reading (the guard, not weakened, not edited)

Command (the plan's own): `node scripts/prevention/verify-prevention.mjs --all --selftest` → **exit 0**:

```
"ok":true,"guards":34,"count":34,"countFloor":34,"pinnedCountFloor":34,
"fixtureIntegrity":{"fired":[...,"C-06",...],"missed":[]},
"fixPresence":{"enforced":[...,"C-06",...],"pending":[]},
"fired":[...,"C-06",...],"missed":[],"pending":[],"skipped":[],
"controlMissed":[],"canaries":{"ok":true,"checked":["C-06","C-14"],"violations":[]}
```

- **Old:** `fixtureIntegrity.missed:["C-06"]` (audit §0 baseline / L3). **New: `missed:[]`, C-06 in `fired`.**
- The guard's own driver test also re-passes:
  `node --test --test-reporter=tap scripts/prevention/replay-harness.test.mjs` → **17/17 pass**, incl.
  `ok 4 - C-06 real seam: treeSubstanceOf reports the hollow trees as empty`.
- C-06's P-B pin: `node --test --test-reporter=tap scripts/guards/delivery-gate.test.mjs` → **2/2 pass**.
- **Field name I kept, for the `restore-guards` lane (no guard edit needed):** C-06's driver and the CLI's
  `RT_E_SUBSTANCE_EMPTY` hold both key on the **bare top-level `substance.verdict`**, which this lane
  restored to the job-scoped reading — so `scripts/prevention/**` and `scripts/guards/**` need **no change**
  for C-06 to fire. The explicit alias `substance.jobScoped.verdict` carries the identical value if a driver
  prefers a scope-named field. `substance.wholeTree.verdict` is the reading that must NOT be used for shell
  detection.

---

## 7. Test / typecheck readings (mine, attributed by file)

| Command | Result |
|---|---|
| `npx tsc --noEmit` (after my edits) | **exit 0 · 0 errors** — was exit 2 / 5 errors on entry, then exit 2 / 2 errors (`scaffold.test.ts:2712,2719`, lane `restore-oracle`, since fixed by that lane). My file `headless.test.ts`'s `TS18048` is gone. |
| `node --experimental-strip-types --test --test-reporter=tap src/lib/compile-check.server.test.ts` | **110 tests · 109 pass · 0 fail · 1 skipped** (the skip is pre-existing) |
| `node --experimental-strip-types --test --test-reporter=tap src/lib/headless.test.ts` | 209 tests · 208 pass · **1 fail** → see §8 (not attributable to this lane; passes standalone) |

Tests I updated in `src/lib/compile-check.server.test.ts` (they pinned the 354 top-level semantics):
`:1838` (job-less tree → bare `empty`, `wholeTree` `real`), `:1872` (generated-only → `wholeTree` `real > 0`,
bare `empty`), `:1892` (both empty), `:1906` (stub jobs → bare `stub-skeleton`, `wholeTree` `mixed`),
`:1950` · `:1968` · `:1985` (counts now job-scoped, `wholeTree` counts asserted beside), `:2024-2026`
(bare `files`/`verdict` ARE the job-scoped ones), `:2086-2088` (treeRun carries both), `:2796-2818`
(the substance↔product-quality parity case now checks BOTH readings against their own census).

---

## 8. Flake observed, not attributable to this lane (re-run before believing it)

Full-file `headless.test.ts` run 1: `not ok 30 - E-25 — CLI machine contract`, its one failing subtest
`headless.test.ts:2940` — `assert.equal(unv.code, 0, "a green-but-unverified tree defaults to exit 0")` on a
**CLI `tree-run --dir <emitted>`** call (53 s in-run; the whole file ran 331 s while five sibling lanes were
editing `src/**` and `scripts/**`).

Attribution: the failing assertion is on the CLI's exit code for an at-floor emitted tree
(`scripts/rapidtool-cli.mjs:3572`), a path this lane's edits do not touch; the repo's own in-run RUNLOCK
guard (`rapidtool-cli.mjs:3550-3570`, `RT_E_SRC_EDITED_DURING_RUN`, exit 1) fires in exactly this window
shape — a sibling lane editing `src/**`/`scripts/**` mid-run — and the run's TAP log carries no `RT_E_*` /
stderr tail for that call (the test prints stderr only). Re-run of that exact subtest alone:

```
node --experimental-strip-types --test --test-reporter=tap --test-name-pattern="rides the envelope" src/lib/headless.test.ts
    ok 1 - emit --run: treeRun{compile,tests,run} rides the envelope; a fresh tree is VERIFIED and exits 0 …
# tests 1 / # pass 1 / # fail 0
```

So: **not attributable by file to this lane; passes standalone** (the repo's documented treatment for the
load/concurrent-edit class). Root cause NOT proven.

---

## 9. Deferred / not done (explicit)

- **`npm test`, `bash scripts/gate.sh`, `npm run build` were not run** — boundary-only, the wave parent owns
  them (plan §Do-not). No git write, no commit, no stash was issued.
- **`scaffold.ts` untouched** — the cross-lane half (absent option ⇒ refuse; explicit `"refuse"` ⇒ zero files)
  belongs to lane `restore-oracle`. My passthrough already produces zero files against the CURRENT bytes of
  `scaffold.ts` (§5 probe 1), so both halves agree today and remain correct when that lane's default flips.
  **Residual risk to reconcile at the boundary:** if `restore-oracle` renames `underProduced` or retypes its
  literal set, my call site (`headless.ts:2843-2846`) must be re-checked against the landed type — I forward
  exactly the shape declared on my edit ( `"partial" | "refuse"` + `allowUnderProduced` ).
- **`jobScoped` is now an exact duplicate of the bare top level** (same object values, not the same object).
  Kept deliberately: the wave asked for two distinctly named fields, and the 354 lane's consumers/tests use
  the name. If a later wave wants one handle only, the bare top level is the one to keep (both drivers read
  it).
- **`headless.ts:2856`'s unconditional `underProductionRefusalOf` call** is one extra log scan per emit;
  pure, no write, never throws (it returns `string | null`).

---

## 10. Append — the headless re-run came back GREEN (§7/§8 closed)

Command: `node --experimental-strip-types --test --test-reporter=tap src/lib/headless.test.ts` (255 s):

```
# tests 209
# pass 209
# fail 0
# skipped 0
```

So the full file is green on the re-run; §8's single failure was the transient its standalone re-run already
predicted. Final readings for my four owned files, as of this append:

| Gate | Before this lane (entry) | After |
|---|---|---|
| `npx tsc --noEmit` | exit **2** · 5 errors in 3 test files | **exit 0 · 0 errors** (`headless.test.ts:5999` fixed here; `scaffold.test.ts` ×2 fixed by lane `restore-oracle`; `wild-step.test.ts` ×2 fixed by a sibling lane) |
| `compile-check.server.test.ts` | — | **110 · 109 pass · 0 fail · 1 skipped** |
| `headless.test.ts` | — | **209 tests · 209 pass · 0 fail** (run 2) |
| `verify-prevention --all --selftest` | exit 1 · `fixtureIntegrity.missed:["C-06"]` | **exit 0 · `missed:[]` · C-06 fired · canaries clean** |

Sibling-lane state at the time of these reads is theirs, not mine: every red item I saw in a file I do not
own was left untouched and attributed in §7/§8.

