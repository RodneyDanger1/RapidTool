# 260 · LANE 2 (W22) — certify THE FIX (W21-258 single-chunk ESM) end-to-end

**Bottom line:** The fix certifies clean at the unit/probe level — **full `codegen.server.test.ts` suite GREEN: 119/119 (exit 0; W21-L1's "118" is one short of the measured count), all four W21-258 rows green**, both W21-L1 probes re-run green (`TREE_IMPORT_OK exports=[_internals,createBuyerLead,…,updateProperty]` exit 0), and my **independent re-materialization** of run #2's real accepted bytes in a fresh `"type":"module"` tenant flips the emitted spec from `ReferenceError: module is not defined` (1 test ran, 0 pass) to **43 tests executed (9 pass / 28 fail / 6 skip)** — the import is provably fixed.
**One-line answer (detail in §3): NO — not by itself.** With the fix the spec's assertions now *run* and the import crash is gone, but run #2's real tree covers only **8 of the 36** capabilities its emitted spec asserts, so **28 capability rows (capability.9–36) fail honestly** and my end-to-end `treeRun()` on the re-materialized tenant returns **`ok:false`**. Run #3's tree-run is green only if run #3's synthesis covers all 36 capabilities; with run-#2-like partial acceptance it stays **honestly red** (no greenwash).

Scope of this lane: (1) run W21-L1's two un-run foreground items — full `codegen.server.test.ts` + its scratch probes; (2) independently re-materialize run #2's real single-chunk tree in a scratch `"type":"module"` tenant and prove the spec imports clean; (3) the one-line honest answer on run #3's tree-run.

## 1. The two un-run items (foreground)

### 1a. Full `codegen.server.test.ts` suite — GREEN, 119/119

```console
$ cd "/c/Users/mnril/Desktop/RapidTool Main"
$ node --experimental-strip-types --test src/lib/codegen.server.test.ts    # captured: C:/Users/mnril/w22l2_scratch/suite_full.txt
ok 11 - W21-258: materializeImportableTree has NO single-file identity path — one chunk is materialized like N
ok 13 - W21-258: a residual CJS extra in a MULTI-chunk tree is neutralized too (no module refs in any emitted file)
ok 14 - W21-258 RED→GREEN: a single-chunk tree materializes as ESM importable under the tenant's `"type":"module"`
ok 15 - W21-258: neutralizeResidualCjsExports clears every remaining CJS export statement (real-artifact shape)
# tests 119
# suites 24
# pass 119
# fail 0
# skipped 0
# todo 0
# duration_ms 4027.2736
EXIT=0
```

⚠️ Count correction: the W22 brief says "expect 118/118 — W21-L1's number". Measured foreground on the current bytes: **119/119** (two runs, exit 0 both; no skips/todos). The brief's 118 is one short — recorded, not propagated (W22 ledger pattern).

### 1b. W21-L1's scratch probes — both re-run green

```console
$ cd /c/Users/mnril/w21l1_scratch && node --experimental-strip-types strip_probe.mjs
lines: 258 -> 250
residual module.exports lines after stripCjsExportAssignments(listed): [
 "module.exports._internals = { LEDGER: LEDGER, CONTACTS: CONTACTS, ... };"
]
parses as ESM body? (no module refs): false        # ← one residual line remains post-strip…
STRIP_EXIT=0

$ node --experimental-strip-types probe.mjs
materialized file paths: ["src/generated.ts","src/generated/get-property.ts"]
residual module.exports references: [{"path":"src/generated.ts","cjsRefs":0},{"path":"src/generated/get-property.ts","cjsRefs":0}]
scaffold entry (what tests/oracle.spec.ts would import): src/generated.ts
probe exit: 0
--- probe stdout ---
TREE_IMPORT_OK exports=[_internals,createBuyerLead,createContact,createDeal,createSellerLead,getProperty,getPropertyHistory,moveDealStage,updateProperty]
PROBE_EXIT=0
```

…and `neutralizeResidualCjsExports` (the W21-258 addition, its test row green above) is what clears that residual line — my §2 re-run confirms **0 `module.exports` lines in both materialized files** (the strip→neutralize pipeline is the operative pair; strip alone is not).

## 2. Independent consequence check — run #2's real tree in my scratch tenant

Script: `C:/Users/mnril/w22l2_scratch/certify.mjs` (full output: `certify_run.txt`). Method: read the REAL accepted bytes from `research/eval-out/coffeehouse2home-property-ledger/.rapidtool/project.json` → `generatedTree[0]` (cross-checked byte-identical to the on-disk file), re-materialize with the CURRENT `materializeImportableTree`, build two `"type":"module"` tenants (`w22l2_scratch/tenant_pre` = pre-fix raw shape; `w22l2_scratch/tenant` = post-fix shape), and run the REAL emitted `tests/oracle.spec.ts` in each — then the REAL `treeRun()` over the post-fix tenant.

```console
node: v22.23.2 | platform: win32
===== 1. run #2 real tree bytes (project.json generatedTree vs disk) =====
generatedTree rows: 1 — ["src/generated/get-property.ts"]
row.source === disk bytes: true (row 8060 B / disk 8060 B)
raw bytes residual module.exports lines: 9
===== 2. materializeImportableTree (current codegen.server.ts) on the real bytes =====
materialized files: ["src/generated.ts","src/generated/get-property.ts"]
  src/generated.ts | module.exports lines after materialize: 0
  src/generated/get-property.ts | module.exports lines after materialize: 0
===== 4a. PRE-FIX tenant — the emitted spec under "type":"module" (expect the crash) =====
exit: 1
TAP summary: # tests 1 | # pass 0 | # fail 1 | # skipped 0 | # todo 0
# ReferenceError: module is not defined in ES module scope
===== 4b. POST-FIX tenant — the SAME emitted spec (import must now succeed) =====
exit: 1
TAP summary: # tests 43 | # pass 9 | # fail 28 | # skipped 6 | # todo 0
not-ok lines: 28
failing capability rows: 28 (capability.9 … 36)
other failing rows: []
===== 5. exact import probe: import * as treeModule from "./src/generated/get-property.ts" =====
probe exit: 0
TREE_IMPORT_OK exports=[_internals,createBuyerLead,createContact,createDeal,createSellerLead,getProperty,getPropertyHistory,moveDealStage,updateProperty]
BARREL_IMPORT_OK exports=[_internals,createBuyerLead,createContact,createDeal,createSellerLead,getProperty,getPropertyHistory,moveDealStage,updateProperty]
===== 6. treeRun() over the post-fix tenant (the real end-to-end verdict) =====
ok: false
compile: ok=true checked=10 passed=10 failed=0 skipped=8
spec: tests/oracle.spec.ts → run=fail compile=pass tests={"pass":9,"fail":28} | detail: test "capability.32" failed …
entry: {"kind":"ui-shell","run":"skip","detail":"UI shell — not executable headless"}
project.typecheck: run=skip | the declared "typecheck" tool `tsc` has no node_modules/.bin entry in this tree … UNVERIFIED (not a pass)
project.test: run=fail exit=1 | error: 'capability presence proxy FAILED: capability "logCrewTimeSheet…" has NONE of its demanded identifier forms (logcrewtimesheet) in any emitted file'
project.build: run=skip | no node_modules/ present in the tree — "npm run build" was NOT executed … UNVERIFIED
error: the emitted project's own `npm run test` fail (exit 1) — … capability presence proxy FAILED …
```

Interpretation (bytes, not prose):
- **Import: FIXED.** Pre-fix the spec died at load (1 test, 0 pass, `ReferenceError: module is not defined in ES module scope`); post-fix the file loads — 43 tests execute, `tree.entry` passes, `capability.1–8` pass, both the spec's exact import path and the barrel import clean (`TREE_IMPORT_OK` / `BARREL_IMPORT_OK`, full 9-export surface). The 6 skipped rows are the by-design `orc-* — NOT IMPLEMENTED` skips.
- **Assertions: 28 honest reds remain.** `capability.9–36` demand identifiers (`getdealpipeline`, `publishshowingslots`, … `checkreorderflag`) that are absent from run #2's 1-file partial tree (verified by lowercase substring scan of the materialized file). This is the **layer 2** W20-L1 flagged in `fixes/255` §3 — now reproduced end-to-end at the `treeRun()` level: `ok:false` is caused **only** by those 28 rows (no other failing rows; compile 10/10; entry ui-shell skip is green-compatible).
- Tenant byte shapes verified: `tenant_pre/src/generated/get-property.ts` = raw 8060 B ending `module.exports._internals = {…};`, no barrel; `tenant/src/generated/get-property.ts` = 7821 B ending `export { getProperty, …, moveDealStage, _internals };` + `src/generated.ts` barrel (45 B).

## 3. One-line answer — "with this fix, would run #3's tree-run be green?"

**No — not by itself: the fix provably removes the import crash (the spec's 43 tests now execute; both import paths load clean; compile 10/10; the emitted project's own `npm test` now runs and reports), but a tree that covers only 8 of the 36 capabilities the emitted spec asserts still fails 28 capability rows, so the re-materialized run-#2 tenant treeRuns `ok:false` — run #3's tree-run is green only if run #3's synthesis covers all 36 implemented capabilities, and with run-#2-like partial acceptance it stays honestly red (assertions must actually pass; the fix makes the verdict honest, it cannot fabricate coverage).**

## 4. Notes / found while working

- `fixes/258_lane1_single_chunk_esm.md` on disk is still the **skeleton** (all sections "pending"), untracked in git. W21-L1's numbers (118/118, probe exit 1→0) reached the W22 brief, not that log. Not patched by me (another lane's artifact; append-only discipline) — flagged here for the ledger/LANE 3 residuals register.
- Count corrections recorded: suite is **119/119**, not 118; and the treeRun cause for run #2's `treeRunOk:false` is now **two-layered** (crash → fixed; 28 coverage reds → open, `fixes/255` §5 proposal territory).
- No repo files touched by this lane except this log; `scaffold.ts` untouched; no `npm run typecheck/test/build` invoked (wave rule — the armed watcher owns run #3).
- Reproduce: `node --experimental-strip-types C:/Users/mnril/w22l2_scratch/certify.mjs`.
