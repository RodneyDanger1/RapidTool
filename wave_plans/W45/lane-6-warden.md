# W45 / 331-6 — "Warden" — harness guards must have teeth

Read `wave_plans/W45/README.md` first. Your log: `fixes/331_6_warden.md`.

## Owned files (STRICT)

`scripts/**` **EXCEPT** `scripts/rapidtool-cli.mjs`, `scripts/README-cli.md`,
`scripts/cli-exit-taxonomy.test.mjs` (those three are 331-1's) · `tsconfig.json` ·
`tsconfig.scripts.json` · `eslint.config.mjs`.

## Mission

The repo's guards are its honesty mechanism. Make them catch what they claim to catch, and close the
one hole that lets 40 unchecked files ship.

**G1 — `npm run typecheck` cannot see `scripts/**` (register WA-02 / R15-f04).**
`tsconfig.json` includes only `src` + `server`; there are ~40 `scripts/**` files including the
agent-facing CLI. `tsconfig.scripts.json` already exists — read it and find out what it actually
covers. Deliver: a real command that typechecks the scripts tree and a **test** pinning it. Expect
this to surface errors in files you do not own — **do not fix those yourself**: report each to
331-1 (CLI) or the owning lane, by file:line, in your log and in your final report. If you cannot
get a green scripts typecheck because of a cross-lane error, land the capability and record the
remaining red honestly with the owner named.

**G2 — assertion-guard blind spots (register R9-f06).** `scripts/check-assertion-gaps.mjs` is clean
across 99 files but blind to **presence-only** `assert.ok(obj)` and **typeof-only** assertions
(~48 sites named in the register). Decide what is a real gap (a test that can never fail is not a
test), extend the guard, and pin the extension with RED-first teeth (plant a file that should trip
it, show RED, remove it).

**G3 — there is no coverage guard.** The register records that 12 modules are never imported by any
test, including the T5.2-A honesty surface (`fixtures.review.ts` + `fixtures.server.ts`). Land a
guard that fails when a `src/lib` module has zero importing test, with an explicit, reviewable
allowlist (not a blanket exemption). Fix the honesty-surface gap by adding a real test — or report it
to its owner if the file is not yours (it is not, under this table: `fixtures*.ts` is unowned this
wave, so **report**, do not edit).

**G4 — flake hunt.** The 330 lane observed `# tests 374 / # pass 373 / # fail 1` once on the scripts
leg with host Node 24, then three green runs. `scripts/gate.sh --double` exists to catch flakes.
Hunt it: run the scripts leg repeatedly (bounded — say 4 runs, not 40), and if you find a real
timing-dependent test, fix it (deterministic wait, not a longer sleep). If you cannot reproduce it,
say so plainly and record the exact conditions tried.

**G5 — sweep your script files** for defects in the class the 330 wave found: silent catches,
valueless-flag asymmetry, `shell:true` without `--ignore-scripts` (`R11-f02`), lexical `isInside`
path guards (`R11-f07`), guards that fail open where they should fail closed.

## Rules

Node 22 pinned at `%LOCALAPPDATA%\hermes\node\node.exe`; also record host Node 24 for every suite you
run (`AGENTS.md` warns: the TAP/spec reporter differs by runtime — always pass
`--test-reporter=tap` when parsing child output, and never read a filtered run's exit code as green).
No full gate. Scratch work outside the repo. Patches only; append-only log; no fabrication; no
secrets; do not delete tracked files (deletions need untracked + zero-references + no live lane log).

## Report back

Verdict per goal · the scripts-typecheck command and its real result (with any cross-lane errors
listed by owner) · the guard extensions with RED-first proof · the flake result · tests added + real
results · anything you stopped on.
