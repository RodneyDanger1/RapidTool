# 216r — W7 · LANE 1: T-107.1 patch integration (`str_replace` into the repair flow)

**Status:** IN PROGRESS — skeleton written FIRST (Rule 8); rationale section below is written
BEFORE any patch lands (lane-1 step 2).

**Owned (only these):** `src/lib/codegen.server.ts` + `src/lib/codegen.server.test.ts`,
`src/lib/headless.ts` + `src/lib/headless.test.ts`, `fixes/216r_patch_integration.md` (NEW).

**Findings this lane serves:** 107 T-107.1; 103 A9 ("no apply-patch/continue primitive");
100 P0-04; carried item `remainingwaves.md:161` ("patch.ts integration into the P6 emit path /
`repairTreeDir`" — `applyStrReplace` has no production caller).

**Baselines (measured before any edit, 2026-09-16):**

```text
$ node --experimental-strip-types --test src/lib/codegen.server.test.ts
# tests 86   # pass 86   # fail 0
$ node --experimental-strip-types --test src/lib/headless.test.ts
# tests 90   # pass 90   # fail 0
```

---

## 0. Site choice + rationale (written before patching)

**Chosen site: the codegen chunk-envelope repair** — `synthesizeChunkEnvelope`
(`codegen.server.ts`, envelope repair + the bounded validation-repair classes; prompt builders
region `:471-519`, wired at `:2335-2376` and mirrored in the ≤8 single-module path at
`:2052-2120`).

**Why this site (dossier 107 T-107.1 intent — "P6 can emit per-file deltas instead of whole
artifacts", `107_competitors_agentic.md:206`):**

1. **The patch base is real and in hand.** In a repair re-prompt the codegen path holds the
   module the model just produced for THAT file (one chunk = one emitted tree file,
   `plan[i].path`). A delta against it is exactly the "per-file delta instead of a whole
   re-emit" the dossier asks for — no new plumbing, no new state.
2. **The repair classes are surgical by nature.** The defects that reach this gate are
   localized text faults: a soft forbidden token (`process`/`fetch`/…), a non-deterministic
   primitive (`Math.random`), prose written into the body. A whole-module re-emit for one bad
   token is the exact waste T-107.1 targets; a `str_replace` of that token is bounded and
   verifiable.
3. **`headless.ts repairTreeDir` is the OTHER candidate and stays legacy in this lane.**
   Its own semantics ("the dir is the artifact, `emitProject` is never called there") make the
   SITE correct but the delta *producer* absent: nothing on that path authors a `str_replace`
   block, and the patch base there is the user-edited dir content, whose preservation
   semantics are **T4.3/TA-18 — explicitly deferred to W11**
   (`remainingwaves.md:202`, `105_plan_critique.md:645`). Wiring a delta there without a
   producer would be a dead path; wiring one that guesses would violate the refusal-default
   doctrine. What this lane DOES land on the headless side is real: `repairTreeDir` runs its
   repair cycles with the patch level ON (`repairCycleLiveDeps`) and surfaces the delta
   records into its result.
4. **Byte-parity risk is contained.** The codegen envelope flow is byte-pinned (86 tests).
   The patch attempt is **opt-in** (`P6SynthesisDeps.patchRepairs` / `P6PatchRepairOptions`),
   so no existing prompt byte, call count or flow changes when no patch is in play — and the
   legacy full-rewrite repair runs UNCHANGED whenever the patch refuses.

**Semantics of the wire (refusal-default, no silent paths):**

- A patch attempt happens ONLY for a patch-eligible defect (soft-forbidden token /
  non-deterministic primitive / prose). Binding/signature defects and the envelope-parse
  repair keep the legacy path untouched (they are not localized text edits).
- The patch call offers the delta **first** and the legacy full-module envelope as the
  alternative in the same reply (`p6SynthesisPatchRepairPrompt`). A reply that is not a patch
  envelope falls through to the legacy repair.
- An applied patch is **revalidated by the existing deterministic validator**
  (`validateSynthesisModule`) before acceptance; a patched module that still fails is a coded
  refusal, never an acceptance.
- Any refusal (`RT_E_VALIDATION` — ambiguous >1 match, 0 match, no-op, malformed request)
  returns the **legacy full-rewrite repair path UNCHANGED** (its prompt bytes included) and is
  recorded (`p6.repair.patch.refused`).
- **Fuzzy is deliberately NOT enabled in this wire.** `applyStrReplace`'s graded level is
  opt-in by contract; auto-accepting a fuzzy delta into the emitted artifact would be a guess
  into a write. The wire requires an exact unique match; the fuzzy level stays available to
  callers that explicitly opt in (`patch.ts` unchanged).
- A landed delta is recorded (`p6.repair.delta`, structured JSON: path · kind · score ·
  threshold · line counts · bounded unified hunk) — the record rides the project's logs into
  the ledger and is surfaced by `repairTreeDir` as `applied.deltas`.

---

## 1. Work log (append-only)

1. RECON — read `wave_plans/W7/lane-1.md`, `AGENTS.md`, `RESUME.md`, `taskuniverselog.md`
   (TA-15 ✅ untouched), `remainingwaves.md:159-161,202`, dossier `107` T-107.1 row + §"Build
   the surgical edit primitive first" (`:199-208`), `103_feature_gaps.md:177` (A9),
   `105_plan_critique.md:645` (TA-18/T4.3 deferral), `src/lib/patch.ts` (all 391 lines),
   `fixes/216n_wave_h_primitives.md`, and both candidate sites
   (`headless.ts:1972-2601`, `codegen.server.ts:400-560/1300-1450/1930-2430`).

## 2. Verification (real command output)

**Work log (W7-L1 + W8-L5 + parent boundary, 2026-09-17):** the wiring landed in W7-L1
(codegen delta-producer target + headless `repairTreeDir` surface; baselines held). W8-L5 then
pinned the behavior with 11 new tests and produced the TWO defect repros below; the parent ran
the boundary sweep that closed this file.

**W8-L5 test results (verbatim):**
- `node --experimental-strip-types --test src/lib/codegen.server.test.ts` → **# tests 97 / # pass
  97 / # fail 0** (baseline 86 — grew by 11; none weakened/deleted). New suites: "216r patch
  primitives (W8-L5 pins)" (4) + "216r patch repair through liveP6Synthesis (W8-L5 pins)" (7).
- (a) unique-match: patch re-prompt offered FIRST; delta record exact (kind 'exact' / score 1 /
  threshold null / matches 1 / removedLines 3 / addedLines 1 / unified `@@ -39,3 +39,1 @@`),
  patched module === KANBAN_MODULE.trim(), revalidates, tree[0].source = patched bytes.
- (b) refusals: ambiguous (4 matches) / no-match (0) / no-op each log `p6.repair.patch.refused`
  with the coded RT_E_VALIDATION string; the following legacy prompt is asserted BYTE-IDENTICAL
  to `p6SynthesisProseRepairPrompt(proseLineHits(module))`; legacy reply still accepted.
- (c) no-patch byte-parity: level OFF → `p6SynthesisNondeterministicRepairPrompt('Math.random')`
  exactly, zero p6.repair* records; non-patchable class ON vs OFF → identical prompts/kinds/bytes.
- Parent boundary re-run: codegen 97/97 · headless 90/90 · typecheck 0 on the repaired tree.

**DEFECTS (report-only, carried to W9-L2 — codegen.server.ts was read-only for W8-L5):**
1. **Masked↔raw line-number mismatch kills the patch path for JSDoc'd modules (the common case
   — the system prompt mandates JSDoc).** `maskLiteralsAndComments` replaces a `/* … */` span
   with `" ".repeat(stop - i)`, destroying the newlines inside the comment (raw 37 lines → masked
   26); `patchableDefect` then gets MASKED line numbers, filters them against RAW source lines
   (`.filter((n) => (srcLines[n-1] ?? "").includes(token))`), the list empties, and
   `attemptPatchRepair` never fires. Repro: `probe-w8l5b.ts` (deleted; see transcript
   deleg_7335199d/task-4.log): hit "Math.random", tokenLineNumbers [4], filtered [], windows 0;
   call kinds ['SYNTH','LEGACY-NONDET'] with no patch call. Suggested shape: derive candidates
   from raw source, or map masked→raw line numbers before filtering/excerpting.
2. **A landed delta does not short-circuit the legacy repair block.** The guards at :2473
   (single-module) and :2792 (chunked) are evaluated from the ORIGINAL defect values, so the
   legacy full-rewrite re-prompt still fires after a successful patch; a parseable reply
   OVERWRITES the patched envelope (:2485-2489 / :2804-2808) and the landed delta is silently
   discarded. Repro: `probe-w8l5e.ts` OVERWRITE case — `p6.repair.delta` logged, then the run
   ends `p6.synthesis.refused :: RT_E_VALIDATION · prose-in-code…` although a valid patched
   module already existed. W8-L5's tests pin the CURRENT behavior honestly (post-patch legacy
   replies made unparseable) rather than asserting the buggy overwrite as correct.

## 3. What is NOT done / bounds

**W7 boundary status (parent, 2026-09-17):** the WIRING landed (codegen.server.ts delta-producer
target + headless.ts repairTreeDir surface) and held baselines at lane time (codegen 86/86,
headless 90/90); parent full sweep green (src 1894/1894). The NEW tests (unique-match apply +
revalidate / ambiguous+no-match refusal / byte-parity) and section 2 evidence STILL OWED → W8-L5.
