# W358 · lane `close-kindjsx` — the emitted tsconfig must match what the emitter writes for that kind

**Wave:** W358 (the final closure wave). **Persona:** `quill`. **Author:** the wave parent. Read FIRST.

## Mission

Close one of the two `testsLib` reds — and it is a **kind-fidelity defect**, which is the campaign's
central goal: the factory must produce the best version of the kind the user asked for, and today a
non-web kind can emit source its own declared toolchain cannot compile.

## The evidence

- `research/multiagent/357_cartographer.md` **R-UI-3** / `fixes/357_fix_tests.md`: a `kind:"tool"` emission
  ships `.tsx` pages while the emitted `tsconfigJson` sets `jsx` only for `webapp`/`game` ⇒ the tree's own
  `tsc` reports **TS17004 / TS6142**. Pinned by `src/lib/codegen.server.test.ts` (the `fixes/341-1 pre-seal
  self-typecheck gate` case, ~`:3198`).
- The W355 audit's `reviewer-synthesis` lane named the same class from the other side: the emitted tree
  failing its **own** `tsc` is the binding wall (6/10 briefs in the last measured keyed wave).
- The cartographer also measured that **all five kinds'** own-`tsc` status is currently UNDETERMINED (no
  emitted tree has `node_modules`), so your fix must be provable from the emitted bytes rather than from a
  fresh install.

## Owned files (yours alone)

`src/lib/codegen.server.ts` · `src/lib/codegen.server.test.ts` · `src/lib/compile-check.server.ts` ·
`src/lib/compile-check.server.test.ts`

## MINI-TASK PLAN

1. **Find the exact mismatch at `file:line`.** Locate the emitted `tsconfigJson` builder and the per-kind
   page/module emitter, and show precisely which kind emits which extension against which compiler option.
   Name every kind's combination (app / game / tool / service / library), not just `tool`.
2. **Fix it at the cause, kind-aware.** The invariant to establish: **the emitted `tsconfigJson` must make
   the emitted source compile for every kind.** Choose the honest direction and justify it in the log —
   either (a) a non-web kind must not emit `.tsx` (emit `.ts`), or (b) the emitted tsconfig must enable
   `jsx` for any kind whose emitted tree contains a `.tsx`/`.jsx` file. Prefer the direction that keeps the
   emitted product **most capable** while staying internally consistent, and if you choose (b), derive the
   `jsx` decision from the actual emitted file set rather than a hard-coded kind list.
3. **Land R-8's type-level half.** `fix-gates` fixed R-8 at the runtime boundary
   (`censusShape` requires both named scopes). Make it **type-level** in `compile-check.server.ts` too:
   `jobScoped` / `wholeTree` required on the substance-reading shape, so a producer cannot omit one and
   still typecheck. Update the guard-side expectations only if the bytes require it, and say so.
4. **Prove it per kind.** For each of the five kinds, emit (keyless) and record the emitted file
   extensions against the emitted `tsconfigJson`'s compiler options, then run the emitted tree's own
   `tsc` if it can resolve its toolchain — if it cannot (no `node_modules`), say so and prove consistency
   from the bytes instead. No keyed call.

## Verification

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
npx tsc --noEmit
node --experimental-strip-types --test --test-reporter=tap src/lib/codegen.server.test.ts
node --experimental-strip-types --test --test-reporter=tap src/lib/compile-check.server.test.ts
```

## Logging

`fixes/358_close_kindjsx.md`. Record: the mismatch table per kind, the direction chosen and why, the
before/after emitted tsconfig, the per-kind proof, and R-8's type-level change.

## Do not

- Do not edit `scripts/**` (`close-taxonomy`), `src/lib/scaffold.ts` / `scaffold.test.ts` /
  `src/components/software-preview.tsx` (`close-ui`), the register, or another lane's log.
- Do not fix this by emitting an untyped/unchecked page, by disabling a compiler check, or by loosening a
  test. The invariant is that the emitted tree compiles.
- No keyed LLM call. Do not run the full gate (the parent runs the boundary). No git writes.
  **No mock/stub/fake/demo code on a production path.**
