# W46 / 332-3 — "Transit" — emitted tree & tree-run integrity — landing log

**Lane:** 332-3, persona "Transit". **HEAD at open:** `6cd5123`, tree clean.
**Owned files (STRICT):** `src/lib/scaffold.ts`, `src/lib/compile-check.server.ts` + their `*.test.ts`; this log.
**Runtime:** repo-pinned Node **22.23.2** (`%LOCALAPPDATA%\hermes\node\node.exe`); host Node **24.15.0** for every
suite touched. **Scratch (outside the repo):** `%TEMP%\rt332_transit\` — the repo gained no probe file
(`git status` shows only my two owned-file edits + this log from my lane).
Keyless throughout: no keyed call, no secret printed, no `npm run eval`, no full gate, no `console.tsx`/CLI edit.

## 0. Verdict in one line

T1 **fixed**: `resolveHeadlessEntry` no longer resolves a UI shell's browser `main` as the headless core, so a clean
game tree is GREEN and a broken generated core still REDs. T2 **decided (named-limit branch)**: `treeRun` now carries
a first-class `verified`/`unverified` machine state so an ok-but-unverified project toolchain is visible in every
serializing consumer; a default in-loop install was measured non-viable and would have regressed the P6 mint. T3
**verified landed** (argv-only declared scripts + `--ignore-scripts` on the install leg) with a pinning test. T4
**hardened further**: the `treeRun` filter/junction/visible-cleanup were already landed; I closed the last *silent*
cleanup swallows in `verifyKindDir`. `scaffold.ts` needed no change (T5 sweep clean).

## 1. T1 — a GAME tree reds `treeRun` on a CLEAN source — FIXED

### 1a. Reproduce first (scratch, outside the repo)

`%TEMP%\rt332_transit\probe-t1.ts` emits a real `scaffoldProject(runHeadless(seedProject({kind:"game"}), ALL_PHASES))`
tree to a temp dir and calls the real `treeRun`. **BEFORE (HEAD module, Node 22):**

```
"ok": false,
"run": { "kind": "ui-shell", "run": "skip", "detail": "UI shell — not executable headless" },
"core": { "kind": "generated-core", "entry": "src/main.ts", "run": "fail",
  "detail": "Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...\\rt-treerun-...\\src\\ui\\console' imported from ...\\src\\main.ts" },
"error": "the emitted product's generated core module failed to LOAD (src/main.ts): Error [ERR_MODULE_NOT_FOUND] ..."
```

The game scaffold sets `package.json "main": "src/main.ts"` — the **browser** boot, which imports `./ui/console`
extensionless and touches the DOM. `resolveHeadlessEntry` returned it as the core, bare node could not load it, and a
perfectly clean game tree recorded a RED tree-run. Reproduced on a clean, non-residue source.

### 1b. The fix (`compile-check.server.ts` `resolveHeadlessEntry`)

A tree with a root `index.html` is a UI shell by `resolveEntry`'s own structural rule; its `main` is the browser boot
vite loads from that index.html and is never a headless core. The `main` branch is now skipped when `index.html`
exists, so resolution falls through to the tree's GENERATED core (first `job-*` spec-graph module, else
`src/generated.ts`). `resolveEntry` calls this only when no `index.html` exists, so headless kinds are byte-identical;
a UI shell with no generated core resolves `null` and keeps its pre-330 skip.

### 1c. AFTER — clean game tree (Node 22 and host Node 24, identical)

```
"ok": true,
"verified": false, "unverified": ["typecheck","build"],     <- T2 state (see §2)
"run": { "kind": "ui-shell", "run": "skip", "detail": "UI shell — not executable headless" },
"core": { "kind": "generated-core", "entry": "src/jobs/dispatch.ts", "run": "pass" },
typecheck skip · test pass · build skip
```

### 1d. AFTER — broken-core control (the game tree's generated core corrupted)

```
"ok": false,
"core": { "kind": "generated-core", "entry": "src/jobs/dispatch.ts", "run": "fail",
  "detail": "... SyntaxError [ERR_INVALID_TYPESCRIPT_SYNTAX] ..." },
"error": "the emitted project's own `npm run test` fail (exit 1) ... · the emitted product's generated core module failed to LOAD (src/jobs/dispatch.ts): ..."
```

Two independent reds (the emitted oracle imports the broken job, and the core smoke names it). The browser-boot skip
does **not** blanket-skip: a broken generated core still reds. `entryGreen` is untouched — `run.kind` stays
`"ui-shell"` and the honest skip still counts green, so the `entryGreen === skip && kind === "ui-shell"` rule keeps
working (pinned by the existing 185-S5 tests, still green).

## 2. T2 — the tree-run's own install/typecheck/build leg is UNVERIFIED — DECIDED (named limit)

### 2a. What I measured before deciding

| Choice | Evidence | Outcome |
|---|---|---|
| **Run the install leg by default** | one trivial package (`is-number`) took **46,964 ms** to install on this host; a real scaffold tree pulls react + vite + typescript, so ~1–3 min per tree-run, in-loop, per repair cycle | **not viable** |
| **Flip `outcome.ok` on a declared-but-unrun `typecheck`** | the P6 journey emits to a temp dir with no `node_modules` (`headless.defaultP6RunTree`), so its declared `tsc` is always a skip; `mintTreeRunTested` gates on `outcome.ok === true` | **would permanently block the P6 mint** — the wave's primary goal (green keyed tree → verified product) |
| **Named limit + machine-readable state** | no network, no P6 regression, honest | **chosen** |

### 2b. The decision and its consumer-visible effect

The emitted product's own `npm run typecheck`/`build` is a **named limit**, and the limit is now machine-readable:

- `TreeRunOutcome.verified: boolean` and `TreeRunOutcome.unverified: string[]` (declared scripts that did not run).
- `TreeProjectScriptsVerdict.verified` / `.unverified`, and per-script `TreeProjectScriptVerdict.verified`.
- `treeVerdictHash` folds `verified` + sorted `unverified` into its decisive canonical string.

**Consumer-visible effect:** every consumer that serializes the outcome — CLI `emit --run` (`payload.treeRun`),
CLI `tree-run` (`payload.treeRun`), and `repair` — now carries `verified:false` and `unverified:["typecheck","build"]`
at the top level of the tree-run for a fresh emitted tree (measured on the clean game tree, §1c). A downstream
re-derivation of `treeVerdictHash` can no longer conflate an ok-but-unverified tree with a fully verified one.
`ok` remains "nothing ran red"; `verified` is the field a consumer may read as a verification.

**Stopped on (needs unowned files):** flipping the CLI `emit --run`/`tree-run` exit code, the DoD mint gate
(`codegen.server.ts`), or the README banner to treat `verified:false` as non-pass requires `scripts/rapidtool-cli.mjs`,
`codegen.server.ts`, or `dod.ts` — not mine. Doing it in `treeRun` alone via `outcome.ok` would red every fresh
emitted tree and block the P6 mint (table above). Reported for the parent to coordinate with 332-4/332-1.

## 3. T3 — `R11-f02`: `shell:true` + no `--ignore-scripts` — VERIFIED LANDED + pinned

Verified on disk at HEAD (`git log -S` → landed in `2fa3cd9`, W29–W39):

- install leg carries `--ignore-scripts`: `installToolFor` → `"npm ci --no-audit --no-fund --ignore-scripts"` /
  `"npm install --no-audit --no-fund --ignore-scripts"` (`compile-check.server.ts:1801`/`:1807`).
- declared scripts: `planScriptExec` is **argv-only** (`shell:false`) when the first token resolves to a real
  executable (`resolveScriptToolPath`), win32 `.cmd/.bat/.ps1` ride a `cmd.exe /d /s /c` host with every token
  double-quoted and `"`/`%`/newline tokens refused; the ONLY `shell:true` is the **constant** `npm run <script>
  --ignore-scripts` fallback, whose argv never contains tree text. The route and refusal are recorded on the verdict
  (`scriptPolicy` = the `via` string, naming "lifecycle scripts denied").
- the module-resolved install/`cmdRunnerCode` command line is likewise a module constant, `shell:true` over a fixed
  command — no tree text reaches a shell.

**Change:** none to the source (already correct); added a pinning test (§5). Before/after source bytes: **0 / 0**.
The residual "tool reachable only through a shell" case is the recorded `npm run … --ignore-scripts` fallback and the
fixed-command install runner — both named on the verdict, never silent.

## 4. T4 — `R12-f03`: unfiltered `node_modules` copy + silent cleanup — HARDENED

Verified landed at HEAD: `treeRun` copies with `filter: (src) => !skip.has(src)`, `skip = {node_modules, .git}`
(`:1533`), and junctions the subject's deps in (`symlinkSync(subjectDeps, join(copy,"node_modules"), "junction")`,
`:1538`); `finish()` adds the honest leak note on a failed `rmSync`. `verifyKindDir` copied with the same filter.

**Residual found by the T5 sweep and fixed — `verifyKindDir` still swallowed cleanup failures silently.** THREE
`catch { /* ignore */ }` blocks (the copy-failure path and the work-block `finally`) discarded a failed `rmSync`.
They are replaced by a `cleanScratch()`/`finish()` pair mirroring `treeRun`'s contract: a failed cleanup appends
`"the verify-kind scratch copy could not be removed (a process may still hold a file in <dir>) — the dir is safe to
delete once that process exits"` to the returned verdict's `note` on **every** return path, and the `finally` keeps a
safety-net `cleanScratch()`. The `treeRun` copy-failure catch likewise now sets `copy = null` on success and appends an
explicit `"the failed scratch copy could not be removed …"` clause to its `error` when it leaks.

**Before/after bytes (`src/lib/compile-check.server.ts`):** the file carries **3** silent cleanup swallows before;
**0** after (`grep "/\* ignore \*/"` → none; the only remaining catch is the documented honest junction fallback).
Full diff: **+106 / −31** on the source file.

## 5. Tests added + real results

| Test | File | Node 22 | Node 24 |
|---|---|---|---|
| `T1 (332-3): a clean game tree skips its browser boot and smokes the generated core — green` | `compile-check.server.test.ts` | pass | pass |
| `T1 (332-3): a game tree whose generated core is broken STILL reds (control)` | `compile-check.server.test.ts` | pass | pass |
| `T1 (332-3): a UI shell with a browser main and NO generated core keeps the honest skip` | `compile-check.server.test.ts` | pass | pass |
| `T2 (332-3): a declared-but-uninstalled typecheck → ok:true but verified:false, the leg named` | `compile-check.server.test.ts` | pass | pass |
| `T2 (332-3): every declared script ran → verified:true and no unverified rows` | `compile-check.server.test.ts` | pass | pass |
| `T2 (332-3): absent scripts are ABSENT, not unverified (verified stays true)` | `compile-check.server.test.ts` | pass | pass |
| `T2 (332-3): the declared-verification state is decisive in treeVerdictHash` | `compile-check.server.test.ts` | pass | pass |
| `R11-f02 (T3): a resolved declared script runs argv-only and records the lifecycle denial` | `compile-check.server.test.ts` | pass | pass |
| `R11-f02 (T3): a command that NEEDS a shell takes the constant --ignore-scripts fallback and says so` | `compile-check.server.test.ts` | pass | pass |
| `R12-f03 (T4): node_modules is not deep-copied — deps reachable via the seam, subject read-only` | `compile-check.server.test.ts` | pass | pass |

| Command | Result |
|---|---|
| Node 22 `--test compile-check.server.test.ts` (baseline 65 / 64 pass / 1 skip) | **75 tests / 74 pass / 0 fail / 1 skip** (+10) |
| Node 22 `--test compile-check + scaffold` (scaffold baseline 48/48) | **123 tests / 122 pass / 0 fail / 1 skip** |
| Node 24 `--test compile-check + scaffold` | **123 / 122 pass / 0 fail / 1 skip** |
| Node 22 dependents `emitted-honesty + sweep73-fuzz + honesty-guards + maker-score + wild-step + patch-preservation` | **180 / 180 pass / 0 fail** |
| Node 24 dependents (same six) | **180 / 180 pass / 0 fail** |
| `npx eslint src/lib/compile-check.server.ts src/lib/compile-check.server.test.ts` | **exit 0** |
| `npx tsc --noEmit` | my four files clean; the only 4 diagnostics are `headless.test.ts` `calls` (sibling 332-2's in-flight edit, not mine) |

**Teeth (reverted in place, then byte-identical restored — `if (main && !uiShell)` and the aggregate-`verified`
spread verified back on disk):** with `resolveHeadlessEntry` reverted, the 3 T1 tests are **RED** (`3 fail / 0 pass`);
with the aggregate `verified`/`unverified` spread reverted, the 2 asserting T2 tests are **RED** (`2 fail / 2 pass`).
Both restored → all 10 green. The T1/T3/T4 tests exercise the REAL bounded runner over real temp trees (no mocks).

## 6. T5 sweep of the two owned files

- `scaffold.ts`: pure/deterministic, no disk writes, no silent cleanup; refused tree rows and unmaterialised job
  nodes are named in the README census (never silent drops) — **no change needed**.
- `compile-check.server.ts`: the sweep found the three `verifyKindDir` silent cleanup catches (fixed, §4); the only
  remaining bare catch is the documented honest junction fallback. `runProjectScripts`'s "UNVERIFIED" note is
  unchanged but is now backed by the machine state; no claim in comments exceeds the bytes.

## 7. What I did NOT do and why

- Did **not** edit `scaffold.ts` / `scaffold.test.ts` — T1 is a resolver-scope question, fixed on the consumer side;
  changing the emitted `package.json "main"` for game would churn every game byte for no gain.
- Did **not** flip `outcome.ok` / the CLI exit code / the DoD mint on an unverified declared toolchain: measured to
  break the P6 mint (§2a) and to need unowned files; reported as STOP-and-REPORT.
- Did **not** run a network `npm install` inside `treeRun` by default: 46,964 ms for one package, and it would put the
  default suite on the network (the verifyKindDir leg's own doctrine keeps it off).
- Did **not** run the full gate / `npm test` / `npm run eval` — five siblings mid-edit; targeted suites only.
- Did **not** edit any file outside my four owned files + this log; no probe file was written inside the repo.
