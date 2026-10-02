# W48 / 334-4 — "Switchboard" — CLI exit honesty and the scripts typecheck debt, pass 2

Read `wave_plans/W48/README.md` first (Step 0, the debt list, and the hard rules are there). Your log:
`fixes/334_4_switchboard.md`. Owned files: `scripts/rapidtool-cli.mjs`, `scripts/README-cli.md`,
`scripts/cli-exit-taxonomy.test.mjs`, `scripts/typecheck-scripts.test.mjs`, `tsconfig.scripts.json`,
`package.json`, **plus the entire budgeted `scripts/**` debt list** (14 files, in the wave README).

## Step 0 reconciliation (do this before any edit)

Read your own `fixes/332_4_switchboard.md` and `fixes/333_1_verifier.md`'s count caveat, then the current
`ERROR_BUDGET` in `scripts/typecheck-scripts.test.mjs` and the CLI on disk. Open your log with
**claimed / on disk / still open**, with `file:line` for the last one.

## Fix work

**S1 — retire the scripts typecheck debt.** 134 errors across 14 files stand between `scripts/**` and a
real typecheck. You own all of them this wave. Work file by file, **largest first**
(`run-eval.test.mjs` 64, `run-eval.mjs` 25, `preview.test.mjs` 10, then the single-digit ones). Fix real
types: where a diagnostic reveals a real bug (a possibly-undefined access, a wrong-arity call, a mocked
shape that drifts from the typed API), fix the bug and say so. Do not `any`-cast or `@ts-expect-error`
your way out. **Every reduction must lower the matching `max` in `ERROR_BUDGET` in the same change**, and
a fully-clean file must be removed from the budget entirely (the ratchet already treats a clean file as
unbudgeted). Target: the budget empty, or an honest residual with each remaining error named.

**S2 — make the CLI act on an unverified tree.** A fresh emitted tree can carry
`declaredScriptsVerified:false` with `unverifiedDeclaredScripts:["typecheck","build"]`, and the CLI's
`emit --run` still exits 0 on it (lane 334-3 owns the DoD probe and the README banner). Land the CLI half:
the exit taxonomy and/or the envelope must make an unverified tree distinguishable from a verified one,
without redefining `ok` (a tree that had nothing run red is still `ok:true`). Document it in
`README-cli.md`'s exit-code section, and pin it. Coordinate the exact field names with 334-3's work by
reading its log at the end — if you finish first, use the field names as they stand on disk.

**S3 — sweep the CLI for remaining bugs** in the class earlier passes found: exit codes that disagree
with `README-cli.md`'s documented taxonomy, any lingering valueless-flag asymmetry, a lexical path guard
that fails open, a USAGE claim the bytes do not support.

## Done-when

`npx tsc -p tsconfig.scripts.json --noEmit` — report the exact error count and file count before/after
(the ratchet's own test is the gate for it, and must still fail on a planted error: prove that by
planting one in a **budgeted** file, showing the ratchet fails, then reverting byte-identically with
`git hash-object`). `node --test --test-reporter=tap scripts/cli-exit-taxonomy.test.mjs` (baseline 30),
`scripts/typecheck-scripts.test.mjs` (baseline 6), and the affected script suites (e.g.
`run-eval.test.mjs`, `preview.test.mjs`, `write-atomic.test.mjs`, `browser-guard`-related tests) green on
Node 22 (`%LOCALAPPDATA%\hermes\node\node.exe`) and host Node 24. `npm run typecheck` stays green
end-to-end. `npx eslint` on your files exits 0. No full gate, no `npm run eval`, no keyed calls, no
secrets, no repo probe file. Append to your log; never rewrite it.
