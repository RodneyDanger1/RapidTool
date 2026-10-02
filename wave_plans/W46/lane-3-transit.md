# W46 / 332-3 — "Transit" — emitted tree and tree-run integrity

Read `wave_plans/W46/README.md` first, then `fixes/331_3_transit.md` (your lane's history) and
`wave_plans/W45/parent-keyed-findings.md`. Your log: `fixes/332_3_transit.md`.

## Owned files (STRICT)

`src/lib/scaffold.ts` · `src/lib/compile-check.server.ts` + their `*.test.ts`

## Findings you are fixing

**T1 — a GAME-kind tree reds `treeRun` on a clean source (331-3's own report).**
`resolveHeadlessEntry` (`compile-check.server.ts:1218`) resolves the kind entry for a non-UI-shell
tree; for a game tree it lands on `package.json`'s `main` (`src/main.ts`), which is a **browser boot**
importing `./ui/console` extensionless — bare node cannot load it, so a perfectly clean game tree
records a red tree-run. Reproduce on a clean, non-residue game tree, then make the verdict honest:
a browser-only boot under a bare-node smoke is either an **honest skip with a reason** (the
`ui-shell` kind precedent at `:1254–1268`, and the `entryGreen === skip && kind === "ui-shell"` rule
must keep working) or it must actually be loadable. Do not blanket-skip: a game tree whose core module
is broken must still go red. Add tests both ways.

**T2 — the tree-run's own install/typecheck/build leg is UNVERIFIED and says so.**
The emitted tree's verdict carries, in its own words,
`the declared "typecheck" tool 'tsc' has no node_modules/.bin entry in this tree … the tree's own typecheck is UNVERIFIED (npm install, then re-run to verify) — not a fabricated pass`
and the same for `build`. Decide and implement the honest improvement: either run the install leg
(feasible: `R11-f02`'s note says the tree's own scripts run with `shell:true`; there is an
`--ignore-scripts` question to settle) or make the unverified state impossible to read as a pass in
every consumer (the CLI `emit --run` exit code, the DoD probe, the README banner). Whatever you choose,
the emitted product's own `npm run typecheck` must be a real signal or a named limit.

**T3 — `R11-f02`: the tree's scripts run with `shell:true` and no `--ignore-scripts`.**
Verify on disk in `compile-check.server.ts`. A generated dependency's install scripts executing on the
host is a real supply-chain surface for a factory that runs model-authored `package.json` files. Land
the hardening (argv-only where the tool allows, `--ignore-scripts` on install legs) with a test, and
record honestly any case where a tool can only be reached through a shell.

**T4 — `R12-f03`: `treeRun` deep-copies `node_modules` into `%TEMP%` with no filter.**
`compile-check.server.ts` copies the dep tree unfiltered (contrast the filtered call site noted in the
register) and the `finally` `rmSync` silently swallows Windows locks, so temp trees accumulate on this
8 GB box. Add the filter or a hardlink seam, and make a failed cleanup **visible** rather than silent.

**T5 — sweep your two files** for the usual classes (silent drops, UNVERIFIED read as pass, claims the
bytes do not support, swallowed cleanup failures).

## Rules

Reproduce every claim on a scratch tree **outside the repo** (`%TEMP%\rt332_transit\…`). Node 22 +
host Node 24, `--test-reporter=tap`. Targeted suites: `node --experimental-strip-types --test
--test-reporter=tap src/lib/scaffold.test.ts` (baseline **48**), `src/lib/compile-check.server.test.ts`
(baseline 65, 1 skip). Dependent suites that must stay green: `emitted-honesty`, `sweep73-fuzz`,
`honesty-guards`, `maker-score`, `wild-step`, `patch-preservation`. No keyed calls, no full gate, no
`npm run eval`. `src/lib/scaffold.test.ts` is unowned by anyone else — it **is** yours.

## Report back

Verdict per finding · T1's before/after tree-run verdict for a clean game tree, plus the broken-core
control · T2's decision and its consumer-visible effect · T3/T4 before/after bytes · tests added with
real results on both runtimes · what you stopped on.
