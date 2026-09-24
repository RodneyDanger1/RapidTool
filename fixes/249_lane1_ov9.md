# fixes/249 — W18 · LANE 1 · OV-9: `productComplete` gets a real producer

**Status:** in progress · **Lane:** W18-L1 · **Owner box:** `src/lib/doctor.ts` (+ `doctor.test.ts`), `src/lib/dod.ts` (+test)

## Bottom line (updated as it lands)

- (pending) `productComplete` will be derived from **real project state** — the same `JobInventory`
  census the latch already reads — never a flag set to pass the latch.
- (pending) test proves BOTH: producer fires from real state, and the latch still REFUSES when absent.

## OV-9 as recorded (220_tasklist_canonical.md:129)

> `productComplete` has no producer — `219c §2 gap 4 + rank 4` (`doctor.ts:167`; sole caller
> `headless.ts:3207` passes no `extra`; only a unit test can set the field — `doctor.test.ts:81-92`).
> Done-when: a real path can mint `productComplete` evidence; `doctor --tree` reflects it honestly.

## Anti-goal (stated up front)

Making the latch passable by assertion. The producer MUST read artifact-derived state.

## Log

- [ ] Read `wave_plans/W18/lanes-and-watchdogs.md` LANE 1
- [ ] Read `doctor.test.ts:81-92` latch semantics
- [ ] Trace the real producer source (what phases/artifacts actually carry)
- [ ] Implement producer
- [ ] Tests: fire + refusal
- [ ] Foreground run green
