# W48 / 334-6 — "Warden" — guard teeth and repo hygiene, pass 2

Read `wave_plans/W48/README.md` first (Step 0 and the hard rules are there). Your log:
`fixes/334_6_warden.md`. Owned files: `scripts/check-assertion-gaps.mjs` + its test,
`scripts/check-module-coverage.mjs` + its test, `.gitignore`.

## Step 0 reconciliation (do this before any edit)

Read your own `fixes/331_6_warden.md` and `fixes/332_6_watchdog.md`, then `fixes/333_1_verifier.md` and
`fixes/333_2_registrar.md`, then your two guard files on disk. Open your log with **claimed / on disk /
still open**, with `file:line` for the last one.

## Fix work

**G1 — ship the `|| true` tautology rule.** In the 331 wave you reported two genuine never-fail
assertions and deliberately did not ship a rule for them, because it would have red-lined `gate.sh` on
files you did not own. **The parent has since fixed both** (`src/lib/codegen.server.test.ts` and
`src/lib/node-runner.server.test.ts`). So the rule can now land green. Extend
`scripts/check-assertion-gaps.mjs` to catch the class — `assert.ok(<expr> || true)`,
`assert.equal(…)` wrapped so it cannot fail, and any equivalent always-true construct — then run it across
the repo. If it finds *new* instances, fix the ones inside your ownership and **report the rest by
`file:line` with an owner**; do not weaken the rule to make the tree pass. Plant a fault, show the guard
trip, remove it, show green.

**G2 — audit the coverage guard's ratchet honesty.** `check-module-coverage.mjs` has 19 allowlisted
modules. Each entry must carry a reason a reviewer can act on, and the guard must still fail on a
genuinely orphaned module (prove it with a plant). Report any allowlist entry that is stale (the module
is now reached) or unjustified.

**G3 — `.t4scratch/`: 192 tracked files duplicating `src/lib/**`** (from an ancestor commit; the 333 audit
flagged it as pre-existing). Audit it: what is it, is anything live reading it, does it drift from
`src/lib`? Produce a **deletion proposal with evidence** (reference scan, `git log` provenance, drift
count). **Do not delete tracked files** — the repo rule requires untracked + zero-references + no live
lane log, and the parent signs off. Report the proposal.

**G4 — `.grok/` documentation truth** (register `R15-f08`): `.grok/` is partially load-bearing (4 live
read paths, 1 stale file) while `AGENTS.md` calls it stale scaffolding. Audit the real read paths, then
**report** the exact correction needed in `AGENTS.md` (that file is not yours — do not edit it).

## Done-when

`node --test --test-reporter=tap scripts/check-assertion-gaps.test.mjs` (baseline 25) and
`scripts/check-module-coverage.test.mjs` (baseline 6) green on Node 22
(`%LOCALAPPDATA%\hermes\node\node.exe`) and host Node 24 — report the new counts. Running the guards over
the repo must exit 0 (report the real output). `npx eslint` on your files exits 0. `npm run typecheck`
stays green. No full gate (the parent runs it), no `npm run eval`, no keyed calls, no secrets, no
deletions, no repo probe file. Append to your log; never rewrite it.
