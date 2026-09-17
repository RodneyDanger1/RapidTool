# W4 · LANE 3 — finish the lesson-loop pins + wire the assertion-gap lint (T2 pins, T-17 wiring, 216i)

**Mission.** Three closes in one lane: (1) ADD the missing executable pins for the 112
T1/T2 lesson loop (the wiring landed in W3 and is green — but UNPINNED = revertable);
(2) finish T-17 by fixing the one real tautology finding and wiring the checker into
`gate.sh`; (3) complete `fixes/216i_knowledge_integration.md`.

**Done-when:** typecheck 0; verify.server + report-intake suites green WITH your new pins
(counts grow); `node scripts/check-assertion-gaps.mjs` exits 0 (0 findings); its own test
still 20/20; `216i` completed.

**Owned files (yours alone):** `src/lib/verify.server.test.ts`, `src/lib/report-intake.test.ts`,
`src/lib/verify.ts` (only if a pin reveals a wiring bug), `scripts/gate.sh`,
`src/lib/rt-client.test.ts`, `fixes/216i_knowledge_integration.md`.
Neighbors you must NOT touch: verify.server.ts (unless a pin proves a defect — then own the fix
and say so), engine/knowledge/judgment (no one), codegen/scaffold/doctor/engine (L1),
console/UI (L4), phases/packet/algorithms/algo-tools/harvest/knowledge-test (L5).

**MINI-TASK PLAN (follow in order):**
1. Read `src/lib/verify.server.test.ts` header note (:21-25 — W3-L3 documented the planned
   lesson-loop block) and the W3-L3 summary at
   `C:\Users\mnril\AppData\Local\hermes\cache\delegation\subagent-summary-2-20260916_203741_062948.txt`
   for the exact wiring it landed (`gatedFailureMint` :877-914, sites :961/:1002/:1042;
   verify.ts `applyVerifyOutcome` :196-278).
2. PINS in `verify.server.test.ts` (re-add the imports the parent removed as unused:
   `applyVerifyOutcome` from `./verify.ts`, `seedProject` from `./testing/fixtures.ts`):
   (a) no-anchor refusal ⇒ `lessonRefused` present + NO lesson row + visible `lesson.refused`
   log via applyVerifyOutcome; (b) anchored failure ⇒ ONE signature-id row; a REPEAT ⇒ SAME
   id and `reproducedCount` incremented (one row, not two); (c) id stability across repeats.
3. PIN in `report-intake.test.ts`: the accrued-merge site keeps `reproducedCount` (mirror
   the pinned behavior; R4's third edit is currently only covered by its 22 pre-existing tests).
4. T-17 wiring: read `src/lib/rt-client.test.ts:121` — `assert.ok(true)` is the ONLY finding
   in the whole repo. Replace it with the REAL assertion the test intended (read surrounding
   context; keep teeth; record old → new in 216i). If it is genuinely vacuous, delete it
   deliberately with a comment — safest is to assert the actual expectation.
5. `scripts/gate.sh`: add the assertion-gap step (read the script's structure first; additive;
   exit nonzero propagates). Do NOT run the full gate.sh (the parent runs it at the boundary).
   DO run: `node scripts/check-assertion-gaps.mjs` (expect exit 0, 0 findings) and
   `node --test scripts/check-assertion-gaps.test.mjs` (20/20) to prove the wiring step will pass.
6. Complete `fixes/216i` — work log, real command output, old → new records, the deferred-T4 note.

**PARENT FINDINGS & TRAPS:**
- Known deliberate behavior change (W3-L3, documented): the no-anchor refusal now mints NO
  lesson + a refusal envelope; the old `lesson.capture` assertion path is `lesson && !hasLesson`.
  Pin THAT behavior, don't revert it — the loop's honest contract is counterexample-or-nothing.
- `fnv8hex`/text-hash pin hunt came back EMPTY (shape regexes + synthetic fixtures only) —
  no old→new id updates are owed anywhere. Don't hunt again beyond a quick grep.
- Parent removed `applyVerifyOutcome`/`seedProject` imports as unused at the W3 boundary —
  re-add when you write the pins (that's why the lint was 0-warning at close; keep it 0).

**Verification (exact commands):**
```bash
cd "/c/Users/mnril/Desktop/RapidTool Main"
npm run typecheck
node --experimental-strip-types --test src/lib/verify.server.test.ts src/lib/report-intake.test.ts
node scripts/check-assertion-gaps.mjs ; echo "gap-lint exit=$?"
node --test scripts/check-assertion-gaps.test.mjs
```
Baselines: verify.server 15, report-intake 22, check-assertion-gaps 20 — grow, never drop.

**Logging:** `fixes/216i_knowledge_integration.md` — extend the existing skeleton. Only writer: you.
If you run out of budget mid-edit, say so PLAINLY with the real state on disk.
