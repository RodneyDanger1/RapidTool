# 255 — LANE 2 (W20) · OV-5 + the acceptance oddity — probe truth

**Status:** LANDED (acceptance attribution) + two artifact-proven probe defects diagnosed (proposal-only).
**Lane box (stated per brief):** `scripts/run-eval.mjs` acceptance readers (`checkAcceptance` / `passesAcceptance`
region) + `scripts/run-eval.test.mjs`; `src/lib/dod.ts` P6 probes = READ-ONLY (verdict-changing semantics, a
concurrent lane is in the P6/tree area mid-wave → proposals, no edits); grader json read-only.
**Scratch:** `C:/Users/mnril/w20l2_scratch/` (`probe_p6.ts`, `probe_full.ts`, `probe_union.ts`).
**FORBIDDEN obeyed:** no `npm run typecheck|test|build`; all node runs FOREGROUND.

## BOTTOM LINE

1. **`acceptance.pass:false` is NOT a files/content failure — it is the rubric-threshold clause.**
   `passesAcceptance` (`scripts/run-eval.mjs:1625-1631`) asks FOUR questions: finite mean (:1626) →
   `row.mean < grader.passWhen.meanAtLeast` (:1627) → `requireExpectedFiles && filesOk!==true` (:1628) →
   `requireExpectedContent && contentOk!==true` (:1629). Run #2: mean = **0.6667** (6/9), grader
   `passWhen.meanAtLeast:1` → clause :1627 fires. `filesOk/contentOk true` and `checked.expectedContent:1`
   (satisfied) are simply the *other* clauses; `domainMatch` (`run-eval.mjs:433`) never enters `pass`.
   **Landed fix:** `acceptanceFailReason()` (`scripts/run-eval.mjs:1642`) names the first false clause, is
   recorded on the row (`:1675`) and printed in the trial log. Test: `scripts/run-eval.test.mjs` **31/31 green**;
   on the real run-#2 record it prints: `mean 0.6667 < 1 (rubric threshold — files/content are not the cause)`.

2. **`p6-brief-fit` unmet — measured on the emitted artifact: 16 hits < bar 49** (97 required nouns; measured
   replay, matching the run's stall exactly). Cause (a): the final journey pass refused at **chunk 2/7**
   (`p6.synthesis.refused · RT_E_VALIDATION · chunk 2/7 refused · prose-in-code … line 40: "balance: amountDue -
   amountPaid"`) → `partialTreeRefuse` (`src/lib/codegen.server.ts:3121-3139`, call `:2934`) kept only chunk 1's
   file. Cause (b), structural: the probe reads `p.generatedSource` (`src/lib/dod.ts:533`) which for ANY
   multi-file tree is the **ESM barrel** — measured on the full tree: **0 hits (barrel) vs 63 hits (tree union)**,
   i.e. a fully-synthesized tree fails this probe by artifact shape. Proposal (§P1) = tree-aware read (4 lines).

3. **`p6-arch` unmet — 28 of 36 spec capabilities have no tree file** (measured; `missing=28, stubFiles=[]`).
   Root cause = same refusal (chunks 3-7 never synthesized). Structural second cause: the engine's own entry
   **barrel `src/generated.ts` is a pure `export * from` file → `isStubSource`→`isReexportOnlySource`
   (`src/lib/dod.ts:205-238`) flags it in `stubFiles` (`:341-343`) → `p6-arch` fails** even with `missing=0`
   (measured on the 2026-09-10 full tree: `missing 0 / stubFiles ["src/generated.ts"]`). Proposal (§P2) =
   in-tree-target barrel exemption; **needs an owner ruling** because W18-OV-9 pinned the opposite
   (`src/lib/doctor.test.ts:383-395`, "the leftover IS the reason").

> **Cross-cutting conclusion (evidence-backed):** with the current code, **P6 can never pass on a multi-file
> tree** — the full-tree pass in run #2's own log (7/7 chunks ok, "assembled entry 285 chars" = barrel) would
> have failed p6-brief-fit (barrel) and p6-arch (barrel-as-stub) regardless of the tree-run. Any fix of the
> tree-run alone (Lane 1) still parks at P6 until §P1/§P2 are ruled on.

## Evidence trail (command → bytes)

```text
# A) probe replay against the REAL emitted artifact (state = exactly what the gate scored)
node --experimental-strip-types C:/Users/mnril/w20l2_scratch/probe_p6.ts
  repo research/eval-out/coffeehouse2home-property-ledger/.rapidtool/project.json (mtime Sep 24 14:48, 110787b)
  generatedTree = 1 file: src/generated/get-property.ts (8060b, byte-identical to the disk file)
  generatedSource = 8118b = that file wrapped '(function (module, exports) {…'
  implementationSpec.typeSignatures = 36 · lastTest = {"ok":true,"detail":"tests.pass"} (no label/hash)
  DOD[6] replay: PASS p6-test · PASS p6-source · PASS p6-artifact · FAIL p6-verified · FAIL p6-brief-fit · FAIL p6-arch
  → the replay reproduces run #2's stall set EXACTLY (results.json notes.stall) ⇒ artifact = the gate's state.
  p6-brief-fit: required 97, bar 49, identifierHits(generatedSource) = 16  → FAIL
  archTrace: present=true skipped=false note="tree (1 file)" rows=8 missing=28 stubFiles=[]
  (missing list = every typeSignature after chunk 1, e.g. getDealPipeline, publishShowingSlots, bookShowing, …)

# B) structural defect on a FULL multi-file tree (all chunks accepted)
node --experimental-strip-types C:/Users/mnril/w20l2_scratch/probe_union.ts
  repo research/eval-out/coffeehouse2home-property-ledger.run-2026-09-10/.rapidtool/project.json
  tree = 5 files (src/generated.ts 194b barrel + chunk-0 36300b + create-flip-project 9737b + compute-rent-roll 2632b + check-reorder-flags 2731b)
  logs: 'chunk 1/4..4/4 · ok' ×2 passes, p6.synthesis '5 file(s) in 4 chunk(s) · assembled entry 194 chars', modelRoute deepseek-pro
  p6-brief-fit: current(generatedSource/barrel) = 0 → FAIL | union(gen+tree) = 63 ≥ 49 → PASS
  archTrace: missing=0 stubFiles=["src/generated.ts"] (reexportOnly=true) → p6-arch FAIL
# C) run #2's own final-pass log (the partial tree's provenance)
  chunk 1/7 ok · chunk 2/7 ok · chunk 2/7 attempt 2 ok → p6.synthesis.refused 'chunk 2/7 refused · prose-in-code … line 40'
  → p6.tree.failure → p6.journey.exhausted '3 cycle(s) without a green tree-run — last refusal: RT_E_VALIDATION'
# D) landed fix
node --test scripts/run-eval.test.mjs   # RED first: SyntaxError: The requested module './run-eval.mjs' does not provide an export named 'acceptanceFailReason'
node --test scripts/run-eval.test.mjs   # GREEN: # tests 31 · # pass 31 · # fail 0
node --input-type=module -e "…acceptanceFailReason(results.entries[…]coffeehouse2home…)"
  → mean 0.6667 < 1 (rubric threshold — files/content are not the cause)
# E) gates (post-landing, fresh)
npm run lint                                # exit 0 · eslint clean (no diagnostics for either touched file)
node --check scripts/run-eval.mjs           # syntax OK
node --check scripts/run-eval.test.mjs      # syntax OK
```

## §P1 — p6-brief-fit (proposal, not landed)

**Defect:** `src/lib/dod.ts:533` — `identifierHits(required, p.generatedSource ?? "")`. In tree mode
`generatedSource` is `materializeImportableTree(...).entrySource` (`src/lib/codegen.server.ts:2967-2975` →
`:1805-1817` for N>1), i.e. the barrel (`export * from …` only). The engine's OWN tree-level brief-fit check
(`:2955-2956`) reads `assembleTreeEntry(accepted)` — the concatenation of every chunk — so the phase gate
measures a different artifact than the pre-acceptance gate, and the gate's one is empty.

**Smallest fix (4 lines, tree-mode union; no verdict can flip PASS→FAIL):**

```ts
probe: (p) => {
  const { required } = briefNounHits(p.brief);
  if (required.length === 0) return true;
  const tree = Array.isArray(p.generatedTree) ? p.generatedTree : [];
  const source = tree.length > 0
    ? [p.generatedSource ?? "", ...tree.map((f) => f?.source ?? "")].join("\n")
    : p.generatedSource ?? "";
  const hits = identifierHits(required, source);
  return hits.length >= Math.max(1, Math.ceil(required.length * 0.5));
},
```
Measured effect: full tree 0→63 hits (FAIL→PASS); run #2's partial tree 16→16 (stays FAIL — honest: the
artifact really lacks the vocabulary; nothing here rescues a refused run). Pins to re-run: `gates.test.ts`
(brief-fit suite :541-576, arch suite :878-1035 — arch fixtures can only gain hits), `doctor.test.ts`,
`engine`/`headless` P6 tests. Also consider a comment: criterion text "(or spec exists and is honored)" is
still not evaluated by the probe — declare-or-strike it in the same pass.

## §P2 — p6-arch (proposal, not landed — needs an owner ruling)

**Defect:** `archTrace` (`src/lib/dod.ts:336-343`) flags the engine-emitted barrel via
`isStubSource→isReexportOnlySource` (`:205-238`) → `stubFiles=["src/generated.ts"]` → probe `:553-556` fails
even at `missing=0`. The barrel is machine-emitted (`codegen.server.ts:1805-1817`), not a leftover job.
**Conflict:** `src/lib/doctor.test.ts:383-395` PINS the opposite reading ("refusal names the real leftover (a
reexport-only barrel)"; dropping the barrel flips `productCompleteFromProject` to true) — that pin encodes
W18-OV-9's product-completeness rule, so the two cannot both stand for multi-file trees.

**Smallest fix (barrel exemption keyed on in-tree targets):** in `archTrace`, a reexport-only file is a stub
only when ≥1 of its reexport targets does NOT resolve to another file of the same tree. The engine barrel
(`export * from "./generated/chunk-0.ts"` → `src/generated/chunk-0.ts` ∈ tree) is exempt; the E-15 leftover
fixture (`export … from "./host.ts"`, `gates.test.ts:1018-1025`) stays a stub → that pin is untouched.
Companion edit REQUIRED in the same ruling: `doctor.test.ts:383-395`'s expectation + the OV-9 narrative.
Alternative (if the rule stands): stop recording the barrel in `generatedTree` (codegen `:2967-2975`) — bigger
blast radius (emitted-disk + reqTrace + packet consumers), not recommended first.

## [EXT-FAIL] rows (for WD-β → `fixes/257_error_ledger_v3.md`)

| # | Row | Evidence |
|---|---|---|
| 1 | **A pinned unit test reads a LIVE eval artifact** — `doctor.test.ts:382-390` fails on the current worktree because run #2's emit replaced the tracked full tree with the 1-file partial: `assert.deepEqual(t.stubFiles, ["src/generated.ts"])` → actual `[]`; suite `19 pass / 1 fail` (`node --experimental-strip-types --test src/lib/doctor.test.ts`). NOT caused by this lane (my footprint = `scripts/run-eval.mjs`, `scripts/run-eval.test.mjs`, this log only; the failing assertion reads `.rapidtool/project.json` + `dod.archTrace`). Fix: pin a committed fixture copy under the fixture dir instead of `research/eval-out/<slug>/`. | test run output above |
| 2 | **Tree-mode probe/artifact mismatch** — `p6-brief-fit` measures the 194-byte barrel of a fully-accepted tree (0 hits) while the engine's pre-acceptance fit check measures `assembleTreeEntry` (all chunks). Two gates, two different artifacts, one criterion. | probe_union.ts output |
| 3 | **The engine's own ESM barrel is classified as a stub/leftover** (p6-arch + OV-9 `productComplete`), so a fully-synthesized multi-file tree is never product-complete. | probe_union.ts + `doctor.test.ts:383-395` |
| 4 | (context, not a failure) `p6.journey.exhausted` after 3 cycles with no repair path targeting the *validator's* refusal class (prose-in-code / not-exported) — the refusal is honest, but the run burns 2×240s per chunk attempt then re-plans the whole tree; each failed pass OVERWRITES the previous pass's full tree with its partial (`partialTreeRefuse:3130-3137`). | artifact p6 logs idx 17-22 |

## Claims vs bytes (self-check)

- "run #2 artifact = gate state" → probe replay equals `notes.stall` set. ✅
- "16 hits < 49" → measured on artifact bytes; "union = 16" → no rescue claimed. ✅
- "0 vs 63 on the full tree" → measured on the 2026-09-10 artifact. ✅
- "31/31 green after the landing; RED before" → both commands run FOREGROUND, outputs pasted. ✅
- No fabricated run: no keyed call was made; no `npm run typecheck|test|build` was run. ✅
