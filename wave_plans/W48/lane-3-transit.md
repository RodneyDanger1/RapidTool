# W48 / 334-3 — "Transit" — emitted tree, tree-run, and the DoD mint, pass 2

Read `wave_plans/W48/README.md` first (Step 0 and the hard rules are there). Your log:
`fixes/334_3_transit.md`. Owned files: `src/lib/scaffold.ts`, `src/lib/compile-check.server.ts`,
**`src/lib/dod.ts`** (granted to you this wave) + their `*.test.ts`.

## Step 0 reconciliation (do this before any edit)

Read your own `fixes/331_3_transit.md` and `fixes/332_3_transit.md` (including the appended F-4
follow-up), then `fixes/333_1_verifier.md`'s F-4, then your three files on disk. Open your log with
**claimed / on disk / still open**, with `file:line` for the last one.

## Fix work

**T1 — make `declaredScriptsVerified:false` actually count.** This is the top open item in
`fixes/333_0_parent.md` §5: a fresh emitted tree reports
`declaredScriptsVerified:false` with `unverifiedDeclaredScripts:["typecheck","build"]`, and **nothing acts
on it**. You own two of the three surfaces:
- **the emitted README banner** (`scaffold.ts`): a tree whose declared `typecheck`/`build` never ran must
  say so where the human reads it, in the same unmissable style as the existing red-tree banner. Today
  the README can present an unverified tree as a complete one.
- **the P6 DoD probe** (`dod.ts`, newly yours): the criteria are `p6-test` (last self-test passed) and
  `p6-verified` (a tested verdict with an evidence hash). Decide, implement, and justify whether an
  *unverified* tree satisfies them — remember `mintTreeRunTested` requires a green tree-run, and that a
  fresh tree in the P6 journey always has a skipped `tsc`/`build` (measured: one `npm install` there
  costs ~47 s). A criterion that can never pass blocks the whole run; a criterion that passes on an
  unverified tree is a false claim. Find the honest line and pin it.

**T2 — do not redefine `ok`.** The audit and the boundary report both record that flipping `outcome.ok`
inside `treeRun` would red every fresh tree and block the P6 mint. The signal must stay separate from
`ok`. If you conclude the right answer is that the runtime *cannot* verify an uninstalled tree and the
honest fix is a named limit plus the loud banner, say so plainly with the measurement.

**T3 — sweep the three files for bugs.** Including but not limited to: the game-kind entry resolution you
fixed (`index.html` ⇒ UI shell) and whether the same class of mis-resolution survives for other kinds;
`verifyKindDir`'s cleanup contract; and any comment claiming behavior the bytes do not support.

## Done-when

`node --experimental-strip-types --test --test-reporter=tap` on `src/lib/scaffold.test.ts` (baseline 48),
`src/lib/compile-check.server.test.ts` (baseline 75, 1 skip) and `src/lib/dod.test.ts` (report its
baseline) green on Node 22 (`%LOCALAPPDATA%\hermes\node\node.exe`) and host Node 24. Dependents that must
stay green: `emitted-honesty`, `sweep73-fuzz`, `honesty-guards`, `maker-score`, `wild-step`,
`patch-preservation`, `gates`. `npx eslint` on your files exits 0; `npx tsc --noEmit` zero diagnostics in
your files. No full gate, no `npm run eval`, no keyed calls, no secrets, no repo probe file. Append to
your log; never rewrite it.
