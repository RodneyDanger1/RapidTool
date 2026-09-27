# W37 · THE MASTER PACK — every remaining task, packed per lane, with its full information.
**HOW TO USE (the dispatcher):** when W36 lands, each lane below gets ONE dispatch whose context CONTAINS (a) this lane's task list verbatim, (b) the inline key facts below, and (c) the pointer to its FULL payload — the consolidated sections that N4 pasted (`finalsprint.md` §T1–§T5/§WDX-2/3/§MASTER-CORRECTIONS · `wave_plans/W34/prep.md` §P1–§P3 · `wave_plans/W34/code-notes.md` §A1–§A2 · `wave_plans/W35/factory-notes.md` §F1–§F5 · the lane logs `fixes/271_*…281_*`). **NO lane starts without its pack.** All lanes: code-only (no test runs/builds — boundary follows), targeted checks only, no keyed calls, log-and-continue, `TODO(<id>)` at the logic line, additive only.

## THE STATE THE PACKS ASSUME (verify against bytes at dispatch time — the tree moves)
- Static: **lint GREEN (registered)**; typecheck has the scaffold.ts TS2554 break until N1 fixes it (N1's job #1).
- The reds to expect at the boundary: headless 96/94/2 @19:11 → after L3's + N6's re-points, expect **green with correct counts, not weakened pins**; `rapidtool-cli-edit.test.mjs` 7/10 → N6 re-points.
- Everything since `0f85c32` is UNCOMMITTED. The commit is the parent's, after the boundary.

## X1 — THE SYNTHESIS/EMIT LANE (scaffold.ts · codegen.server.ts · run-eval's structure)
**Tasks (pack sources: L1's log leftovers · §F1 full cards · §F4 cards · §A1's codegen items):**
1. Any L1 item N1 didn't finish (read N1's log: item → landed?) — esp. the 3 emitter wires + kind wiring + R3-f02 reword + R3-f03 skip path.
2. **FM-01 (F1)**: the single-module path ships raw CJS; the ESM rewrite is only a residue-triggered **emit-time** patch — land synthesis-time materialization for the single-file case (mirror `materializeImportableTree`'s chunked-path call), keeping the emit-time guard as the backstop. Done-when: a fresh single-file synthesis is ESM before emit.
3. **F1's remaining FM cards** (§F1 in full — ~14 KB; each: cause/files/approach/done-when).
4. **F4's grader findings**: the acceptance bar (`run-eval.mjs:2083-2089` + the identical 7 grader JSONs) — implement N5's structure if unlanded; the real per-kind assertions.
5. Contracts: E-15 sweep · RT_E_VALIDATION prefix · webapp bytes unchanged · `codegen.server.test.ts:333` · `verify.server.ts:417`.

## X2 — THE PIPELINE LANE (engine.ts · store.ts · headless.ts · checkpoint polish)
**Pack sources: §A1 (the 10 checkpoint cards minus what N2 fixed) · §F3 full cards (~11.6 KB) · §P2's C1–C8 cards · L2's leftover list.**
1. Verify N2's checkpoint hardening holds (read bytes; the never-throws law, the guards-before-join, the caps-truth).
2. **F3's cards beyond F3-01**: the driver-convergence items, keepLiveWildRun verification, the mint-path checks, resume correctness once wired.
3. **P2's cards**: C1 (checkpoint wiring — verify), C2+ per its summary (`…-1-…-119606.txt`).
4. §A1's runtime findings NOT about checkpoint (the other ~37 — its §A1 in full).
5. Done-whens per card; the boundary legs that prove them listed in §P3.

## X3 — THE UI LANE (console.tsx · routes)
**Pack sources: §R6's worklist · L3/N3's logs · §A2's UI items · F2's packet-facing UI notes.**
1. Any N3 item not surfaced; the pane-boundary verification (R6-f12's done-when).
2. §A2's console findings (render risks, state holes, a11y, wording) — its §A2 in full.
3. §F2's agent-facing surfaces where UI-relevant (the packet/guide honesty).
4. RULE: additive only; the FixturesPanel honesty pattern; no enabled no-op.

## X4 — THE OUTPUT-TRUTH LANE (run-eval.mjs · eval-corpus/** · compile-check)
**Pack sources: §F4 in full (~7.9 KB) · §R7's cards · §A3's remaining rows.**
1. The acceptance channels (broken artifact passing) — land the real gates per F4's cards.
2. The per-kind grader fixtures (the four missing-kind briefs + graders per §R3-f06/§R7).
3. The `verification` label's honest population end-to-end (emit → acceptance → packet).
4. compile-check's cards from §F4/§A1 (the install/script-execution hardening — verify R11-f02's landed state first).

## X5 — THE OPS LANE (scripts/** · CLI · telemetry)
**Pack sources: §F5 in full (~6.6 KB) · §A2's periphery cards · §P1's reds list · N5's log.**
1. OPS-1/2/3 verification (N5's landings) + any F5 card not landed (its §F5 in full).
2. §A2's "contracts that lie" list — the highest-value periphery items (its §A2 in full).
3. exit-taxonomy guard completion (A2-f03's spec); the doc-parity gaps.
4. The no-tty quirk + the short-one-liner rule honored in all checks.

## X6 — THE TRUTH LANE (tests · pins · docs · boundary prep)
**Pack sources: §P1 (the REMAINING list) · §P3 (the boundary load) · §A1's test findings · N6's log.**
1. Verify every re-pointed pin (N6's + L3's) asserts the NEW contract's bytes; name any remaining red precisely.
2. §A1's test-quality findings (its §A1 lists them).
3. The boundary script: the exact leg list from §P3 + the expected results per pin (its §P3 in full — the parent runs this, this lane prepares/verifies it).
4. The doc set's final consistency sweep (START-HERE vs the truth; the master table's corrections applied — with §MASTER-CORRECTIONS).

## THE ORDER + THE BOUNDARY (parent)
**Dispatch X1–X6 in parallel** (file boxes disjoint: scaffold/codegen | engine/store/headless | console | run-eval/corpus | scripts | tests/docs). **Then the parent:** freeze → `npm run typecheck` + `npm run lint` (unpiped) + the legs (errors 37/37 · wild-step 14/14 · registry 40/40 · honesty-guards 13/13 · README-cli 12/12 · run-eval 35/35 · headless 96/96 · the E-25 leg · the edit-test leg) → fix boundary reds → **COMMIT** with the era's full message → then the OWNER items (O-1 funding → O-4 the keyed run) and the next era's remaining register rows.
