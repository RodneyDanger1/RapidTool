# 258 · LANE 1 (W21) — single-chunk emitted trees are importable under a `"type":"module"` tenant

**Bottom line:** **[RECORDER-FILLED from the author's own summary; author absent]** — RED pinned → fix landed →
certified GREEN, with one count correction on the way: single-chunk (and partial-with-1-accepted) trees now
materialize as **real ESM** and import clean under the tenant's `"type":"module"`. Pinned RED:
`ReferenceError: module is not defined in ES module scope at src/generated/get-property.ts:5:1` → `# pass 0
# fail 1`; the same test is `ok` after the fix. Suite: **118/118** at the author's run → certified **119/119**
(exit 0, foreground ×2 — W22-L2, `fixes/260_lane2_certify_fix.md` §1a; the author's last-added test was
unverified at hand-off and is inside the 119 — the W22 count sweep's "118" → 119 correction). Probes: both
scratch probes exit 0; on the REAL run-#2 bytes, BEFORE `probe exit: 1` (the crash) → AFTER `probe exit: 0`
with the full export surface intact
(`TREE_IMPORT_OK exports=[_internals,createBuyerLead,createContact,createDeal,createSellerLead,getProperty,getPropertyHistory,moveDealStage,updateProperty]`).
`scaffold.ts` untouched (clean vs HEAD; sha256 `ddd08e7c…` identical at every W21-WD poll). Honest residual
(W22-L2 §2/§3, certified): the spec's 43 tests now EXECUTE, but run #2's 1-file partial tree still fails 28 of
36 capability rows → `treeRun()` on those bytes = `ok:false` — an honest red owned by synthesis coverage, not
by this fix. No `npm run typecheck/test/build` run (wave rule).

Mechanism under fix: `materializeImportableTree` (src/lib/codegen.server.ts) returned SINGLE-file trees unchanged
("legacy disk bytes", fixes/175) while N>1 trees were rewritten to real ESM. P6's synthesis contract emits
CommonJS (`Assign module.exports`, codegen.server.ts:434-453), the emitted tenant declares `"type":"module"`,
and the emitted spec statically imports the tree entry as ESM → a single-chunk (or partial-with-1-accepted) tree
died at IMPORT: `ReferenceError: module is not defined in ES module scope` → zero assertions ran → treeRunOk:false.

## 1. The RED (before the fix)

**[RECORDER-FILLED from the author's own summary; author absent]** The new test
`W21-258 RED→GREEN: a single-chunk tree materializes as ESM importable under the tenant's "type":"module"`
runs a real child-process `node --experimental-strip-types` import inside a temp `"type":"module"` tenant
(helper `importMaterializedTree`; `codegen.server.test.ts` +199 lines) and died exactly as predicted:

```console
ReferenceError: module is not defined in ES module scope at src/generated/get-property.ts:5:1
→ # pass 0  # fail 1
```

W21-WD independently verified the pin on bytes ("L1 landed its RED pin — helper `importMaterializedTree` (real
child-process import inside a temp tenant) + the W21-258 RED→GREEN test"). After the fix the same test reads
`ok 1 … # pass 1 # fail 0`.

## 2. The fix

**[RECORDER-FILLED from the author's own summary; author absent]** All changes in `src/lib/codegen.server.ts`
(the lane's only code box; `scaffold.ts` confirmed clean — `git diff` shows nothing):

1. **`materializeImportableTree` — the single-file identity path is removed.** Every tree (N=1 included) is
   materialized like N>1 (chunk relocated off `TREE_ENTRY_PATH` when needed → ESM barrel at `src/generated.ts`
   + chunk file). `entrySource` is now the entry *file's own* bytes, so the scaffold's `generatedSource` tree
   row and the on-disk entry bytes can no longer diverge. (Prior-intent cites the WD checked: `:1773`
   `if (raw.length <= 1)`; the P6 CJS contract at `:436` — "Assign module.exports"; `fixes/175:10`
   "Single-chunk trees are identity".)
2. **New `neutralizeResidualCjsExports`** — a **second, hidden layer**: `stripCjsExportAssignments` only
   removes *listed* names, and run #2's real file ends `module.exports._internals = {…}`, which alone would
   still have crashed a fully ESM-materialized tree (proven with `strip_probe.mjs`). Rules: bound name → drop
   stmt (kept in `export {…}`); unbound → `const name = EXPR` (multi-line safe) + exported; reserved
   word/computed/bare → dropped whole. Deterministic, exported for tests, no `node:fs`, patch-only.
3. **Doc-truth fixes** — the comments that asserted "identity"/IIFE-concat disk bytes, + `TREE_ENTRY_PATH` doc.

Rationale vs `fixes/175`'s real intent (as recorded by the author): 175's "single-chunk trees are identity"
described the legacy disk-bytes path; removing the identity path makes byte fidelity an *outcome* of the
shared materialization (entry bytes == the file the scaffold row names, so they can no longer diverge) while
the P6 synthesis contract (CommonJS `module.exports`) is untouched — only the tenant-facing materialization
changes.

## 3. Emitted-artifact consequence (scratch re-materialization probe)

**[RECORDER-FILLED from the author's own summary; author absent]** Proven twice — on scratch fixtures AND on
the REAL run-#2 bytes (`research/eval-out/coffeehouse2home-property-ledger/src/generated/get-property.ts`):

```console
BEFORE: probe exit: 1 … ReferenceError: module is not defined in ES module scope
AFTER:  probe exit: 0
TREE_IMPORT_OK exports=[_internals,createBuyerLead,createContact,createDeal,createSellerLead,getProperty,getPropertyHistory,moveDealStage,updateProperty]
```

Independent certification (W22-L2, `fixes/260_lane2_certify_fix.md` §2): PRE-fix tenant = 1 test ran / 0 pass
(the crash); POST-fix tenant = **43 tests executed (9 pass / 28 fail / 6 skip)**; both the spec's exact import
path and the barrel import clean (`TREE_IMPORT_OK` + `BARREL_IMPORT_OK`); end-to-end `treeRun()` over the
re-materialized tenant = `ok:false` with exactly the 28 capability rows (capability.9–36) failing and **no
other failing rows**; compile 10/10.

## 4. Tests

- `src/lib/codegen.server.test.ts` — **[RECORDER-FILLED]** the four W21-258 rows are GREEN (W22-L2 paste):
  `ok 11` no single-file identity path · `ok 13` multi-chunk residual CJS neutralized · `ok 14` RED→GREEN
  single-chunk importable · `ok 15` `neutralizeResidualCjsExports` clears every CJS export statement. Full
  suite **119/119** (24 suites, 0 fail/skip/todo, `EXIT=0`; two foreground runs). Author's own run: 118/118
  (base 112/112; +6 tests, 4 updated) — its last-added test was unverified at hand-off; the 119 is W22-L2's
  correction.
- No `npm run typecheck` / `npm test` / build run by this lane (wave rule).

## 5. Notes / found while working

**[RECORDER-FILLED from the author's own summary; author absent]**

- **`fixes/255`'s claimed landed fix is NOT on disk** (independently re-derived by W22-L3, §2): no
  commonjs/module-system declaration exists anywhere in `src/lib` (`grep -rn commonjs` → empty) and the run-#2
  artifact's `src/generated/` holds **no `package.json`** — run #2's tree would still crash as-is. The real fix
  is this lane's (later certified by W22-L2). See ledger v4 / register row 24.
- Adjacent evidence: `compile-check.server.ts:771-775` resolves `src/generated.ts` when
  `record.generatedSource` exists — with the relocation this is now a real file (barrel) instead of the
  degraded `get-property.ts` fallback; more evidence the barrel-per-tree shape is the right one.
- **Hand-off items:** the 2 items needing one foreground run (full suite + probes) were completed by W22-L2 —
  see `fixes/260_lane2_certify_fix.md` §1a/§1b.
- **Cross-refs:** ledger row **#69**'s W22-L3 update (import-crash half FIXED-APPLIED; row stays OPEN on the
  28/36 coverage reds); residuals register row 24 (`fixes/260_lane3_ledger_corrections.md` §3).
- Count rule obeyed: after the W22-L3 correction, "118" is never propagated again — 119/119 travels with the
  certification.

---

**[RECORDER note — W23 LANE 7]** This log was a 30-line all-pending skeleton from W21-L1's call-cap exit (the
author's own words: "the call cap stopped me before filling it"). Filled in place by the W23 recorder
exclusively from **the author's own summary** (`C:/Users/mnril/AppData/Local/hermes/cache/delegation/subagent-summary-0-20260924_183655_298130.txt`)
plus its certification trail (`fixes/260_lane2_certify_fix.md`, `fixes/260_lane3_ledger_corrections.md`,
`fixes/259_w21_wd.md`). Skeleton bytes above the fills are preserved; nothing was rewritten. No test/typecheck/
build/lint runs performed (docs-only wave rule).
