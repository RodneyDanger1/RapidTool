# 332-4 "Switchboard" — CLI correctness and toolchain coverage (W46)

Runtime: pinned Node **v22.23.2** (`$env:LOCALAPPDATA\hermes\node\node.exe`) and host Node
**v24.15.0**; `node --test` always run with `--test-reporter=tap`. Targeted checks only — no
full gate (five siblings mid-edit), no keyed calls, no `npm run eval`, `scripts/gate.sh`
untouched, no secret printed. Owned files only: `scripts/rapidtool-cli.mjs`,
`scripts/README-cli.md`, `scripts/cli-exit-taxonomy.test.mjs`, `scripts/typecheck-scripts.test.mjs`,
`tsconfig.scripts.json`, `package.json`.

Contract C4 order honored: S1a (CLI typecheck-clean) → S1b (wire `npm run typecheck`) →
ratchet.

---

## S1a — `scripts/rapidtool-cli.mjs` (and its test) typecheck-clean — **FIXED**

Exact command: `npx tsc -p tsconfig.scripts.json --noEmit`

| | exit | errors | files | `rapidtool-cli.mjs` | `cli-exit-taxonomy.test.mjs` |
|---|---|---|---|---|---|
| before | **2** (brief said 1; measured 2) | **173** | 16 | **38** | **1** |
| after | 2 | **134** | 14 | **0** | **0** |

39 errors retired (38 CLI + 1 test). No `any`-cast, no `@ts-expect-error`; every fix is a real
type or a caught real bug:

- **`parseArgs`** — typed the return + the local (`{ _: string[]; [key: string]: string|boolean|string[] }`).
  `args._` was inferred `never[]`, so both `args._.push(...)` calls were TS2345.
- **`classify` / `classifyErr`** — JSDoc function types (`(text:string)=>string|null`,
  `(err:unknown, fallback?:string)=>string|null`). Both were `let x = () => null` → inferred
  `() => null`, so the later assignments (TS2322) and the 1-/2-arg calls (TS2554) were errors.
- **`respond`** — declared `@returns {never}` (true: it ends in the in-tick `process.exit`,
  fixes/217e G1). This removed the spurious `void` arm from `resolveProvenRows` and
  `requireProjectPath`, which fixed the `proven.present` / `proven.rows` TS2339 and the
  `path`/`dir` `string|undefined` reads downstream.
- **`requireArg` guards, ~25 sites** — `if (x.error)` → `if (x.error !== undefined)`. Measured
  with a scratch probe: under `checkJs`, truthiness on an optional discriminant does **not**
  narrow the union (`.value` stays `string|undefined`), but an explicit `!== undefined`
  comparison does. Behaviour is byte-identical (`requireArg` never returns an empty `error`).
- **`knowledge` verb** — `} else {` → `} else if (find !== undefined) {`. The "exactly one of
  --save/--find" guard already proves `find` defined at that point; the explicit arm is what
  lets TS see it.
- **`lesson advise` / `lesson verify`** — `storeFile = typeof args["knowledge-file"] === "string"
  ? args["knowledge-file"] : ""` and `resolve(storeFile)` (no cast; `hasStore` is sourced from
  the same value).
- **`lesson propose`** — `kind` now `typeof args.kind === "string" && [...].includes(args.kind)`.
- **`lesson verify`** — `${(marked ?? []).filter(...)}` (`marked` is null on the read-only path;
  the template runs only on the write path, but the object literal does not narrow it).
- **`diagnose`** — `persistHealth` JSDoc `{ ok: boolean; lastError: string | null }` (was
  inferred `lastError: null`, so the catch's `string` was TS2322).

Test file: `cli-exit-taxonomy.test.mjs(1901)` `[0,2].includes(res.status)` (`res.status` is
`number|null`) → `res.status === 0 || res.status === 2`.

**Real bug surfaced by the types (named for the record):** the `if (x.error) return respond(...)`
guard sites depended on `respond`'s runtime exit; because its inferred return was `void`, the
guard was invisible to the type-checker and `x.value` stayed `string|undefined` at the
`h.saveProject(path, …)`, `resolve(dirArg.value)`, `brief.value`, `id.value` … reads. Declaring
the honest `never` is what makes those reads provable — no possibly-undefined access was masked.

---

## S1b — `npm run typecheck` covers `scripts/**` — **LANDED** (with a STOP-and-REPORT)

`package.json`: `"typecheck": "tsc --noEmit && tsc -p tsconfig.scripts.json --noEmit"`
(`tsconfig.json` untouched for editors).

**Proof both legs run.** The npm notice echoes the compound command:
`npm notice run tsc --noEmit && tsc -p tsconfig.scripts.json --noEmit`. Executed live
(`npm run typecheck > tmp`):

```
npm-run-typecheck exit=2 errorTS=134 srcErrors=0 scriptsErrors=134
```

i.e. leg 1 (`tsc --noEmit`, src+server) ran and was clean (0 errors → `&&` proceeded), leg 2
(`tsc -p tsconfig.scripts.json --noEmit`) ran and reported all 134 errors — every one in
`scripts/**`, none in `src/`. (An earlier run caught a transient sibling error in
`src/lib/headless.test.ts` from the 332-2 lane; it cleared on re-measure. Individual legs
measured the same way: LEG1 exit 0/0 errors, LEG2 exit 2/134 errors.)

**Ratchet kept honest** (`scripts/typecheck-scripts.test.mjs`):
- Removed the `scripts/rapidtool-cli.mjs` (was `max: 38`) and `scripts/cli-exit-taxonomy.test.mjs`
  (was `max: 1`) entries — a clean file carries no budget.
- Every remaining `max` is the **exact** measured count, so any single new error exceeds it
  (`unbudgeted` catches a new red file, `overBudget` catches growth in a budgeted one).
- New test: the CLI + its test are clean and unbudgeted (fails loudly with their diagnostics
  if they regress). New test: `package.json`'s `typecheck` runs both legs.
- `tsconfig.scripts.json` comment + the test's own prose updated 173→134 / 16→14.

**STOP-and-REPORT (needs the parent; involves a file I do not own).** `npm run typecheck` now
**exits non-zero (2)** because the 134 budgeted errors in 14 other scripts remain — this is the
honest state of the untyped-`.mjs` migration, but `scripts/gate.sh` (unowned) runs
`npm run typecheck` as a **hard gate** (`run typecheck … npm run typecheck`, and `ok:true`
requires `gates.typecheck.ok`). So the boundary `gate.sh` will red on this until the migration
lands. Parent options: **(a)** accept it and treat `scripts/typecheck-scripts.test.mjs` as the
tolerant scripts gate; or **(b)** rewire the script to
`tsc --noEmit && node --test --test-reporter=tap scripts/typecheck-scripts.test.mjs` — green,
and the ratchet spawns the same `tsconfig.scripts.json` program and fails on any new error.
I implemented the brief's literal command (the 331-6 Warden log's recommended option (b)); the
decision to keep it red or swap the script belongs to the parent because `gate.sh` is unowned.

Remaining budget (owner **331-6** unless noted): `run-eval.test.mjs` 64, `run-eval.mjs` 25,
`preview.test.mjs` 10, `grok-pwa-shared.mjs` 6, `write-atomic.test.mjs` 5, `browser-guard.mjs` 5,
`check-auth-invariant.test.mjs` 4, `with-app-env.test.mjs` 4, `next-action-arm-parity.test.mjs` 3,
`browser-smoke.mjs` 2, `migration-plan.test.mjs` 2, `brand-check.test.mjs` 2,
`grok-pwa-plugin.test.mjs` 1, `grok-pwa-plugin.mjs` 1.

---

## S2 — `create --brief <path>` silently used the path as prose — **FIXED**

**Before (reproduced, exact):**
`node --experimental-strip-types scripts/rapidtool-cli.mjs create --brief research/eval-corpus/house-flip-manager.md --out <tmp>\repro.json`
→ exit 0; `summary.name = "Research/eval-corpus/house-flip-manager"`; `brief = "research/eval-corpus/house-flip-manager.md"`
(the path string), so the lattice mined nouns from the filename (AW45-c07).

**After (measured):**
- Bare existing-file path → exit **1**, `code: RT_E_VALIDATION`:
  `create: --brief "research/eval-corpus/house-flip-manager.md" names an existing file — a file path is never silently used as the brief prose … Read it with --brief @research/eval-corpus/house-flip-manager.md or pass the text itself: --brief "<prose>".`
- `--brief @research/eval-corpus/house-flip-manager.md` → exit **0**; `brief` = the fixture's
  front-matter `brief:` scalar (209 chars, byte-identical to the corpus provenance note),
  `name` derived from the prose (`A House-flipping Project Manager:`); **no YAML reaches the
  lattice**.
- `--brief @<plain file>` → verbatim bytes; `--brief @<missing>` → exit 1 `RT_E_VALIDATION`
  (`does not name a readable file`).

Implementation: `readBriefSource` (+ `briefFromFrontmatter`, scoped to the single-line `brief:`
scalar the corpus uses; `run-eval.mjs parseFrontmatter` stays the full parser) and
`isReadableFile` in `rapidtool-cli.mjs`. Documented in `scripts/README-cli.md` (Commands #1) and
the `USAGE.create` line.

**Test** (`cli-exit-taxonomy.test.mjs`, "W46 332-4 (S2) …"): creates a temp corpus-shaped fixture
+ plain file, asserts the bare-path refusal (exit 1, code, both forms named, **nothing written**),
`@fixture` → front-matter brief with no `---` and no path-derived name, `@plain` → verbatim,
`@missing` → coded refusal, and that README keeps both forms. Passes on host Node 24 and Node 22.

---

## S3 — valueless value flags silently absorbed as `true` — **FIXED (central)**

Audit of all 39 verbs: `parseArgs` turns a value flag with no value into `true`; the remaining
silent class was flags read via `typeof args.x === "string" ? args.x : <default>` (or raw) and
dropped. Real ones found: `--name` (raw into `createProject`), `--limit`, `--phase`, `--steps`,
`--max-steps`, `--budget`, `--tags`, `--title`, `--kind`, `--actor`, `--evidence`, `--reason`,
`--by`, `--slug`, `--dir`, `--history`, `--policies`, `--ids`, `--tree`.

Fix: ONE pre-dispatch guard (`VALUELESS_VALUE_FLAGS` + `refuseValuelessFlag`) in `main()`, right
after the `--agent-seal` guard — any of the above parsed valueless is refused before any verb
dispatch with exit 1 + `RT_E_VALIDATION` + a remedy naming the flag's value form. Boolean flags
(`--live`, `--apply`, `--force`, `--start`, the `lesson`/`wild` action flags) are deliberately
absent; `--out`/`--knowledge`/`--html` keep their per-site `pathFlagRefusalError` text (pinned by
existing taxonomy tests). The 330/331 waves fixed `--knowledge`/`--agent-seal` one at a time;
this closes the class. Documented in `README-cli.md` §Agent contract.

Measured: `--limit` / `--steps` / `--name` / `--slug` bare → exit 1 `RT_E_VALIDATION`; bare
`--advisory` still creates (exit 0). No regressions in the sibling CLI suites (36/36, below).
One caveat reported, not fixed: `--save` bare still falls to the legible "requires --save or
--find" refusal (exit 1) rather than the central message — not silent, so left as-is.

---

## S4 — sweep (empty catches, path guards, exit codes, USAGE claims)

- **Empty `catch {}`:** **zero** literally-empty `catch {}` in `rapidtool-cli.mjs` *or* any
  `scripts/*.mjs`. `rapidtool-cli.mjs` has 13 comment-only catches; each carries a reason
  (`/* never break the exit path */`, `/* telemetry must never break the command */`, …). One
  vague `/* ignore */` (the last-resort stderr write after stdout already failed) was replaced
  with a real reason. The register's "11" is not a count of literally-empty blocks in this tree.
- **Lexical path guards that fail open (R11-f07):** the CLI's only containment guard is the
  `edit` verb's — lexical (relative, no drive/`..`, `resolve` prefix) **plus**
  `physicalInside(dirPath, targetPath) === false` refusal, with `null` documented fail-open and
  practically unreachable (the target must exist to be read). No fail-open defect found in the
  CLI; `scripts/path-safety.mjs` is shared and correct (unowned — not edited).
- **Exit codes vs the README taxonomy:** spot-verified `create`, drive (`respondDriveOutcome`:
  parked 2, dod/red-gate-seal 1, else 0), `verify`/`crew`/`prompt`/`chat` (not-configured 3,
  backend 4, validation 1), `repair`/`tree-run` (1), `emit` (0/1/4). `respond()` pins exit 3 →
  `RT_E_LLM_NOT_CONFIGURED`; the `errCode(err, "RT_E_INTERNAL")` → 4 class is pinned by the
  existing taxonomy suite. No mismatch found. (An automated literal `ok`/exit scan was written,
  hung, and discarded — the results above are the behavioral checks plus the suite; noted so no
  greener claim is implied than was measured.)
- **USAGE claims:** automated audit — all **66** `--flags` named in `USAGE` are read somewhere in
  the code (the `lesson`/`wild` action flags via dynamic `flag(args, a)`); no phantom flag. The
  one stale claim was `create --brief <text>`; updated to `<text|@file>`. Top-of-file comment +
  README updated for `@file` and the value-flag refusal.

---

## Tests added — real results on both runtimes

| suite | before | after | host Node v24.15.0 | pinned Node v22.23.2 |
|---|---|---|---|---|
| `scripts/cli-exit-taxonomy.test.mjs` | 28 tests | **30** tests | **30 pass / 0 fail** | **30 pass / 0 fail** |
| `scripts/typecheck-scripts.test.mjs` | 4 tests | **6** tests | **6 pass / 0 fail** | **6 pass / 0 fail** |

Regression suites (host Node, targeted): `rapidtool-cli-edit` + `rapidtool-cli-fixtures` +
`rapidtool-cli-lesson` + `cli-run-busy` = **36 pass / 0 fail** (S3's central guard did not break
any existing bare-flag usage).

Typecheck leg (exact): `npx tsc -p tsconfig.scripts.json --noEmit` → exit **2**, **134** errors
across 14 files, **0** in `rapidtool-cli.mjs` / `cli-exit-taxonomy.test.mjs` (before: 173 / 16,
38 + 1 in those two).

---

## What I did NOT do / stopped on

- **`npm run typecheck` is red** on the 134 budgeted errors — the STOP-and-REPORT above; the
  `gate.sh` interaction is the parent's call because `gate.sh` is unowned.
- **No full gate, no `npm run eval`, no keyed calls.** `scripts/gate.sh` untouched.
- **`src/lib/errors.ts` (unowned):** no new `RT_E_*` code requested — S2/S3 reuse
  `RT_E_VALIDATION`, so the registry needs no new row.
- **Did not `any`-cast / `@ts-expect-error`:** only real types, checked narrowings, and two
  function-signature truths (`respond` returns `never`; `parseArgs` returns the argv shape).
- **Did not weaken the 331 wave's key-resolution work:** `installRepoEnvKey` is untouched; live
  probes printed only the existing tail-only shadow notice.
- Scratch lives under `%TEMP%\rt332_4\`; the repo gained no probe file (only the six owned files
  changed plus this log).
