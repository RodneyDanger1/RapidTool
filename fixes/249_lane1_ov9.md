# fixes/249 — W18 · LANE 1 · OV-9: `productComplete` gets a real producer

**Status:** in progress · **Lane:** W18-L1 · **Owner box:** `src/lib/doctor.ts` (+ `doctor.test.ts`), `src/lib/dod.ts` (+test)

## Bottom line (updated as it lands)

- **[RECORDER-FILLED from the author's own summary; author absent]** `productComplete` now **has a real
  producer**: `productCompleteFromProject(project)` → `archProductComplete(archTrace(project))` from `dod.ts`
  — **the exact same p6-arch trace `runGate(p, 6)` reads**, so doctor and the P6 gate can never drift. The old
  boolean flag is not in the type and is ignored at runtime. `doctor.test.ts` **20/20 green** (foreground);
  `headless.test.ts` **92/92** (the 9 W17-attributed failures gone — W16/W17 landed as `8e25180`).
  **Revert-teeth proven:** reverting the producer in place → exactly the fire + anti-goal tests fail (18/20);
  restored, md5-verified identical.
- **[RECORDER-FILLED from the author's own summary; author absent]** Tests prove BOTH halves: the producer
  fires from **real state** (arch-complete keyed multi-file shape) and the latch **REFUSES when absent**
  (real tree-absent floor export — skip ≠ green, dropped tree, dropped capability, `TODO(E-15)`,
  reexport-only, 9 junk inputs) + an **anti-goal test** (a hand-passed `{productComplete:true}` cannot mint
  the field; a raw blob claiming full truth coerces to a complete-missing gap). ⚠ Honest limit: the
  `headless.doctorStatus` (`doctor --tree`) caller was **not edited** (out of box) → `doctor --tree` cannot
  fire M-B and reports `false` — honest, never asserted; **the OV-9 row's `doctor --tree` clause is not fully
  met** (one-input change in `headless.ts`).

## OV-9 as recorded (220_tasklist_canonical.md:129)

> `productComplete` has no producer — `219c §2 gap 4 + rank 4` (`doctor.ts:167`; sole caller
> `headless.ts:3207` passes no `extra`; only a unit test can set the field — `doctor.test.ts:81-92`).
> Done-when: a real path can mint `productComplete` evidence; `doctor --tree` reflects it honestly.

## Anti-goal (stated up front)

Making the latch passable by assertion. The producer MUST read artifact-derived state.

## Log

- [x] Read `wave_plans/W18/lanes-and-watchdogs.md` LANE 1
- [x] Read `doctor.test.ts:81-92` latch semantics
- [x] Trace the real producer source — the project's **`generatedTree` artifact bytes** (live
      `Project.generatedTree` / parsed `.rapidtool/project.json`); p6-arch trace: tree present ∧ every
      expanded-spec capability maps to a real file ∧ no template-stub / `TODO(E-15)` / reexport-only file
- [x] Implement producer — `src/lib/doctor.ts` only (`dod.ts` untouched, reused); `evidenceFromJobInventory`'s
      `extra` retyped (no `productComplete` field); `coerceFactoryClaim` no longer reads the raw flag;
      import-graph probe: 13 modules reachable, zero `node:` imports, client-safe claim holds
- [x] Tests: fire + refusal — 5 new tests (fire / real refusal / refusals set / anti-goal / teeth)
- [x] Foreground run green — `doctor.test.ts` 20/20 · `headless.test.ts` 92/92
- [x] No `[EXT-FAIL]` needed (both suites green for the box); no git mutations

---

**[RECORDER note — W23 LANE 7]** *[RECORDER-FILLED from the author's own summary; author absent]* — this log
was a skeleton at exit because the author's `write_file` was a byte-identical no-op (the file had landed
tracked with the W16/W17 fold; the author's words: "I hit the iteration cap before replacing its body. Its
pending checkboxes/bottom-line are stale — the content above is the real result."). Filled in place from the
author's own final summary
(`C:/Users/mnril/AppData/Local/hermes/cache/delegation/subagent-summary-0-20260924_143500_306984.txt`).
Original skeleton bytes above the fills are preserved. No test/typecheck/build/lint runs performed
(docs-only wave rule).
