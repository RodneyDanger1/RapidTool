# W4 · LANE 5 — T-14 pins + 109 mop-up (5 items) + 216j

**Mission.** Finish the honesty-tooling wave: pin the T-14 phase-coverage surfacing (core
landed in W3, typecheck 0, UNPINNED), then the five 109 mop-up fixes whose exact patch
plans W3-L5 already worked out, then complete `fixes/216j`.

**Done-when:** typecheck 0; the six suites green with counts GROWING (pins added);
`fixes/216j` completed.

**Owned files (yours alone):** `src/lib/phases.ts` (only if a pin needs an exposure tweak),
`src/lib/packet.ts` + `packet.test.ts`, `src/lib/gates.test.ts`, `src/lib/algorithms.ts` +
`algorithms.test.ts`, `src/lib/algo-tools.ts` + `algo-tools.test.ts`, `src/lib/harvest.ts` +
`harvest.test.ts`, `src/lib/knowledge.ts` + `knowledge.test.ts`,
`fixes/216j_honesty_tooling.md`.
Neighbors you must NOT touch: engine.ts (L1 owns it this wave), verify/report-intake (L3),
console/UI (L4), codegen/scaffold/doctor (L1), `README.md` (nobody — report if a claim there drifts).

**MINI-TASK PLAN (follow in order — patch plans below are W3-L5's own, verified by its probes):**
1. T-14 PINS (`packet.test.ts`): assert the new rail line `Phase coverage: <N> of 13 phases
   executed / <M> artifacts from P7–P12 — strictly linear graph; unexecuted phases are not
   implied complete (the current edge is the only enterable phase).` AND the new systemJson key
   `phase_coverage: { executed, total, artifacts_from_p7_p12 }`. KEEP every existing pinned
   string byte-identical (packet.test.ts:253/:261/:262, handoff.test.ts:92/97 — read-only).
   Re-check the :265 16_000-char budget test after your edits (it was NOT red at the W3 gate;
   confirm again in your run). Add a `gates.test.ts` full-run coverage pin if cheap.
2. 109 T-07 (`algorithms.ts` ~:373): both-sides canonical stem —
   `const termStem = canonicalStem(term); const freq = bag.filter((t) => canonicalStem(t) === termStem).length;`
   + test (a brief with `listings` weights the `listing` node the same as `listing`).
3. 109 T-08 (`algo-tools.ts` ~:185): split the regex into
   cjsBare `/(^|[^A-Za-z0-9_$.])exports\.([A-Za-z_$][\w$]*)\s*=/g` +
   cjsModule `/(^|[^A-Za-z0-9_$])module\.exports\.([A-Za-z_$][\w$]*)\s*=/g`
   (the old `module\.` alternative is what matched the tail of `my_module.exports.x`).
   Probe rows as tests: `my_module.exports.x`→[], `obj.exports.y`→[], `module.exports.z`→['z'],
   `exports.real`→['real']. If `exportedNamesOf` isn't imported in algo-tools.test.ts, add it.
4. 109 T-09 (`harvest.ts`): constants block ~:40-48 gains `HARVEST_MAX_CANDIDATES = 6` (replace
   the magic 6 at ~:430); re-check `if (candidates.length >= HARVEST_MAX_CANDIDATES) break;`
   at the TOP of the outer `for (const q of qs)` loop (~:406); gate the ~:496 "all candidate
   fetches failed" note on `fetches > 0`, else `"fetch budget is 0 — no candidate fetched"`.
   Tests for both branches.
5. 109 T-10 (`knowledge.ts` ~:357-360): `entries()` returns `[...this.cache]`; test: mutate
   the returned array ⇒ store unchanged.
6. 109 T-15: repo-wide determinism guard NEW test — scan `design.ts`, `diagram.ts`,
   `vector.ts`, `brief-fixtures.ts` for `Date.now(` / `Math.random(`. DELIBERATE SCOPE
   DECISION documented in the test: `algorithms.ts` has 6 REAL `Date.now()` trace stamps
   (:1046-1076, AlgorithmTrace `ranAt`) — it is the DOCUMENTED EXCEPTION; either scan it with
   an allowance for `ranAt` stamps or exclude it with a comment naming the exception — your call,
   but the comment is mandatory. Planted-violation test proves the guard has teeth.
7. Complete `fixes/216j_honesty_tooling.md` (T-14 + mop-up + the parent's boundary test fixes).

**PARENT FINDINGS & TRAPS:**
- The W3 gate run was green including packet.test.ts — the budget interplay fear did NOT
  materialize; still verify.
- `probe-l5-coverage.ts` (repo root) was deleted by the parent — do not recreate it in-repo;
  probes go OUTSIDE the repo.
- The T-14 census reality: full run = 13/13 executed / 9 artifacts P7–P12; fresh project =
  0/13 / 0 artifacts. Use those as fixture expectations (they came from a real probe).
- skeleton-first: `216j` first, then T-14 pins, then the five mop-ups (each is independent —
  if budget dies, the log tells the next lane exactly where).

**Verification (exact commands):**
```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
npm run typecheck
node --experimental-strip-types --test src/lib/packet.test.ts src/lib/gates.test.ts src/lib/algorithms.test.ts src/lib/algo-tools.test.ts src/lib/harvest.test.ts src/lib/knowledge.test.ts
```
Baselines (grow, never drop): packet 43, gates 83, algorithms 75, algo-tools 24, harvest 40, knowledge 35.

**Logging:** `fixes/216j_honesty_tooling.md` — extend the existing skeleton. Only writer: you.
If you run out of budget mid-edit, say so PLAINLY with the real state on disk.
