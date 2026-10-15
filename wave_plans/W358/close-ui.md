# W358 · lane `close-ui` — the emitted-UI precedence decision, and the Preview's false banner sentence

**Wave:** W358 (the final closure wave). **Persona:** `aperture`. **Author:** the wave parent. Read FIRST.

## Mission

Close the second `testsLib` red — which needs a **product decision the wave owner is making below** — and
fix one honesty defect in the console Preview.

## The evidence

- **R-UI-1** (`fixes/357_fix_tests.md`, `research/multiagent/357_cartographer.md`): the 351/353 site
  **replaces** `src/ui/console.tsx` (`scaffold.ts:9035-9047`, `:9281-9283`, `:9365-9368`), which makes
  **W-14 / A3-f07**'s real-field binding unreachable. Failing test:
  `binds ≥2 spec-derived fields + an interaction to a real generated export` →
  `A3-f07 / W-14 — default emitted-UI generator (real fields + interaction)` at `scaffold.test.ts:1771`.
  The sibling capability **A2-F5** (`derives >=2 pages (a router + page modules) from the implementationSpec
  when the brief names no list`) is **green** at `scaffold.test.ts:2762`. The two currently conflict.
- **R-10** (`357_cartographer.md`): `src/components/software-preview.tsx:246-252` matches only the
  `RED TREE …` literal, so for a **below-floor** run — whose emitted README leads with `> [!CAUTION]` /
  `BELOW-FLOOR PLAN` — the UI renders the **false** sentence *"The archive's README does not carry the
  caution banner…"*. The console otherwise behaves correctly (red-tree alert + ZIP).

## THE PRODUCT DECISION (wave owner) — apply this unless the bytes prove it impossible

**Merge; do not replace.** A product that derives a spec-shaped page set **and** binds the brief's real
fields to real generated exports is strictly better than either alone, and it is exactly what "the best
version of the kind the user asked for" requires. Concretely:

1. The emitted UI must keep the **spec-derived page set** (A2-F5) **and** satisfy **W-14**'s binding of
   ≥2 spec-derived fields plus an interaction to a real generated export (A3-f07).
2. Apply the field binding **to the spec-derived pages**, so the richer source wins per node instead of one
   site wholesale-replacing the other.
3. If — and only if — the two are **mutually exclusive by construction**, choose the merged capability that
   keeps the real-field binding (a page set whose inputs are wired to real exports) and record the
   discarded behaviour as a **named residual** with the evidence and the reason. Say so explicitly in the
   log; do not silently drop either test.
4. Whatever you choose, **both tests must state the truth afterwards**. If a test's expectation is the wrong
   side of the decision, update the test **and say so** — never delete or skip it.

## Owned files (yours alone)

`src/lib/scaffold.ts` · `src/lib/scaffold.test.ts` · `src/components/software-preview.tsx`

## MINI-TASK PLAN

1. Read `scaffold.ts`'s console/page emission sites and the two tests, then state in the log exactly why
   the replacement happens (the precedence rule and the file:line).
2. Implement the merge (or the evidence-backed residual, per the decision above).
3. Fix R-10 at the cause: the alert must key on the banner the **scaffold actually writes** for that
   branch (below-floor vs red-tree), not on one literal. Prove both branches' rendered sentences.
4. Verify no other `scaffold.test.ts` case regresses (it was 132/133 with only the A3-f07 residual).

## Verification

```powershell
cd "C:\Users\mnril\Desktop\RapidTool Main"
npx tsc --noEmit
node --experimental-strip-types --test --test-reporter=tap src/lib/scaffold.test.ts
node --experimental-strip-types --test --test-reporter=tap src/lib/software-export.test.ts
node --experimental-strip-types --test --test-reporter=tap src/lib/product-quality.test.ts
```

## Logging

`fixes/358_close_ui.md`. Record: the precedence rule you found, the merge (or the residual), the R-10 fix
with both branches' rendered text, and every test expectation you changed with its reason.

## Do not

- Do not edit `scripts/**` (`close-taxonomy`), `src/lib/codegen.server.ts` /
  `compile-check.server.ts` (`close-kindjsx`), the register, or another lane's log.
- Do not delete, skip, or loosen a test to reach green; do not reduce what the emitted product binds.
- No keyed LLM call. Do not run the full gate (the parent runs the boundary). No git writes.
  **No mock/stub/fake/demo code on a production path.**
