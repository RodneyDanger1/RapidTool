# W5 · LANE 2 — test-tails + log bodies + counts drift

**Mission.** Close the verification/debt tails the W4 wave left, so no behavior stays
unpinned and no landing log stays half-written.

**Done-when:** (a) `harvest.test.ts` has the real cap + zero-budget tests and passes;
(b) the T-15 determinism guard test exists with teeth and passes; (c) `fixes/216i` and
`fixes/216j` bodies are COMPLETE (work log, commands+results, old→new, deferred);
(d) named suites green with counts GROWING; (e) TA-3: any count claim in
README.md/AGENTS.md/README-cli.md that your work verifies drifted is corrected or confirmed.

**Owned files:** `src/lib/harvest.ts` + `harvest.test.ts` (tests only — the cap edit from W4
is verified green; extend the suite), `src/lib/algorithms.test.ts` (ADD the T-15 guard as a
new describe — or a NEW `src/lib/determinism-guard.test.ts`, your call), `fixes/216i_*`,
`fixes/216j_*`, and ONLY the count lines in README.md / AGENTS.md / scripts/README-cli.md.
NOT yours: algorithms.ts / algo-tools.ts / knowledge.ts source (W4 edits are verified green —
report, don't touch), codegen/scaffold/engine/doctor (L1), headless/cli/dod (L3),
llm/deepseek/verify/chat/crew (L4), run-eval/corpus (L5).

**MINI-TASK PLAN:**
1. `harvest.test.ts`: W4 imported `HARVEST_MAX_CANDIDATES` but never wrote its tests. Add:
   (a) cap-enforcement test (loop-top break at ~:413 respects the constant);
   (b) zero-budget note test (fetches=0 ⇒ "fetch budget is 0 — no candidate fetched", ~:506);
   (c) the all-fetches-failed note still fires when `fetches > 0`. Run the suite.
2. T-15 determinism guard: scan `design.ts`, `diagram.ts`, `vector.ts`, `brief-fixtures.ts`
   for `Date.now(` / `Math.random(` — all four are clean (W4 grep). ⚠ `algorithms.ts` is the
   DOCUMENTED EXCEPTION: 6 real `Date.now()` `ranAt` stamps (:1046-1076, AlgorithmTrace) —
   either scan it with a `ranAt` allowance or exclude it with a MANDATORY comment naming the
   exception. Planted-violation teeth test required (a fixture string with `Date.now(` must
   make the guard red).
3. Re-run `algorithms.test.ts`, `algo-tools.test.ts`, `knowledge.test.ts` — W4's edits +
   new tests are green (parent sweep) but re-confirm in YOUR run; ⚠ the T-07 weight bound
   `ws >= 0.54` was DERIVED not observed — if it fails, fix the TEST to the real observed
   weight and record old→new in 216j.
4. 216i body: fill Commands+results / Old→new / Deferred (wiring facts are in the W4-L3
   summary; pins landed: verify.server 15→19, report-intake 22→23, rt-client fix).
5. 216j body: fill Work log / Verification / Files changed / Not done (T-14 pins 132/132,
   109 mop-ups, census correction: 13/13/**8** artifacts — `packet` kind excluded).
6. TA-3: verify count claims — README now says "220 scripts + 1803 src" and "34 verbs"; check
   against `bash scripts/gate.sh` verdict numbers + `grep -c 'case "' scripts/rapidtool-cli.mjs`;
   correct or confirm (note: README-cli has its own doc-contract test).

**Verification:**
```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
npm run typecheck
node --experimental-strip-types --test src/lib/harvest.test.ts src/lib/algorithms.test.ts src/lib/algo-tools.test.ts src/lib/knowledge.test.ts
```
Baselines: harvest 40, algorithms 75(+1), algo-tools 24(+3), knowledge 35 — grow, never drop.

**Logging:** 216i + 216j (extend existing skeletons; fill bodies). Skeleton-first. Budget death
⇒ plain statement of which items landed.
