# W46 / 332-4 — "Switchboard" — CLI correctness and toolchain coverage

Read `wave_plans/W46/README.md` first. Your log: `fixes/332_4_switchboard.md`.

## Owned files (STRICT)

`scripts/rapidtool-cli.mjs` · `scripts/README-cli.md` · `scripts/cli-exit-taxonomy.test.mjs` ·
`scripts/typecheck-scripts.test.mjs` · `tsconfig.scripts.json` · `package.json`

## Findings you are fixing

**S1 — the CLI is not typecheck-clean, and `npm run typecheck` never sees it.**
`tsconfig.json` includes only `src` + `server`; `tsconfig.scripts.json` (added last wave) covers
`scripts/**` behind a **per-file ratchet budget** in `scripts/typecheck-scripts.test.mjs`. Real
measurement now: `npx tsc -p tsconfig.scripts.json --noEmit` → **exit 1, 173 errors across 16 files**,
of which **38 are in `scripts/rapidtool-cli.mjs`** (codes TS2345/TS2339/TS2554/TS2322/TS18047/TS18048)
plus 1 in `scripts/cli-exit-taxonomy.test.mjs`. The register's `WA-02`/`R15-f04` own this gap.

Order matters, and W46 contract C4 fixes it:
1. **Make `scripts/rapidtool-cli.mjs` typecheck-clean** (and its test file). Fix the real types — do
   not `any`-cast or `@ts-expect-error` your way out; where the runtime contract genuinely accepts an
   unknown, use a checked narrowing that names the shape. Where an error reveals a real bug (a
   possibly-undefined access, a wrong arity call), fix the bug and say so in the log.
2. **Wire `npm run typecheck` to cover `scripts/**`** — `tsc --noEmit && tsc -p tsconfig.scripts.json
   --noEmit` (or fold the include in; keep `tsconfig.json`'s `src`+`server` behaviour intact for
   editors). Keep the ratchet honest: the budget must go **down** to whatever genuinely remains, and
   the test must fail on any new error in any file.
3. Report anything left in the budget with the file and its owner (the remaining ~134 are the untyped
   `.mjs` migration across other scripts — name the top files; you own only the six files above).

**S2 — `create --brief <path>` silently treats the file path as the brief** (`AW45-c07`).
Reproduced: `create --brief research/eval-corpus/house-flip-manager.md` builds a project whose brief is
that literal string; `inferName` names it after the path and the lattice extracts "flip" from
"house-flip-manager". The corpus fixtures are front-matter documents (`name`, `expectedNouns`,
`expectedCapabilities`) that only `brief-fixtures.ts` parses. Land the honest behavior — an `@file`
convention like `ingest --report @file.json`, and/or a coded refusal when the argument names an
existing readable file and no `@` was given, telling the operator both forms. Whatever you choose,
`scripts/README-cli.md` must document it and a test must pin it.

**S3 — valueless-flag asymmetry on the remaining verbs** (`fixes/330_5_switchboard.md` §5.2, `A2-f11`).
The 330/331 waves fixed `packet --knowledge` and `--agent-seal`; audit the rest of the 39 verbs for a
bare flag that parses to `true` and is then silently ignored. Fix what is real, with tests; report
anything that needs a file you do not own.

**S4 — sweep the CLI** for the classes earlier waves found: empty `catch {}` blocks (the register says
11 — verify the count on disk, they may be legitimate; each needs a reason or a fix), lexical path
guards that fail open (`R11-f07`), exit codes that disagree with the documented taxonomy in
`README-cli.md`, and any claim in the USAGE banner the bytes do not support.

## Rules

Never print a secret (the key-resolution work from the 331 wave owns that; do not weaken it).
`scripts/gate.sh` is unowned — do not edit it. Node 22 + host Node 24, and **always**
`--test-reporter=tap` when parsing child output. Targeted: `npx tsc -p tsconfig.scripts.json --noEmit`,
`node --test --test-reporter=tap scripts/cli-exit-taxonomy.test.mjs` (baseline 28),
`scripts/typecheck-scripts.test.mjs`. No full gate, no `npm run eval`, no keyed calls.

## Report back

Verdict per finding · the typecheck error count before/after with the exact command · the new
`npm run typecheck` behavior and proof both legs run · S2's before/after invocation and its test ·
tests added with real results on both runtimes · what you stopped on and who owns it.
