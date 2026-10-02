# W49 / 335-4 — "Switchboard" — CLI + toolchain, agent-facing UX (pass 4)

**Lane:** 335-4, persona "Switchboard". **HEAD at open:** `9cff073`, tree clean (only
`wave_plans/W49/` untracked). **Runtime:** repo-pinned Node **22.23.2**
(`%LOCALAPPDATA%\hermes\node\node.exe`) and host Node **v24.15.0**; every `node --test` parsed
with `--test-reporter=tap`. **Scratch (outside the repo):** `%TEMP%\rt335_4\` — the repo gains no
probe file. Keyless throughout (no keyed call, no secret printed, no `npm run eval`, no full gate
— five siblings edit concurrently). Owned files (STRICT): all of `scripts/**`, `tsconfig*.json`,
`package.json`.

Baseline reproduced at open (both legs measured today, Node 22):
`npx tsc -p tsconfig.scripts.json --noEmit` → **exit 0, 0 errors** (budget `{}`) ·
`node --test --test-reporter=tap scripts/cli-exit-taxonomy.test.mjs` → **31 tests / 31 pass / 0 fail**.

---

## 0. Step 0 — reconciliation (claimed / on disk / still open)

**Claimed (331-6, 332-4, 333-1, 334-0/334-4):**
- 331-6: `tsconfig.scripts.json` posture + the ratchet test; `npm run typecheck` blocked on
  `package.json` (unowned then).
- 332-4: CLI made typecheck-clean; `--brief @file`; central valueless-flag refusal; `@returns {never}`
  on `respond`; `npm run typecheck` rewired to the ratchet test.
- 334-4: the scripts typecheck debt retired (134 errors / 14 files → **0 / 0**, `ERROR_BUDGET = {}`);
  `emit --run` / `tree-run` made to exit **5** on a green-but-unverified tree (S2).
- 334-0 §5.1: records the operator-facing cost — **every fresh scaffolded tree is unverified, so
  `emit --run` now never exits 0**; invites "0-plus-envelope with an opt-in strict mode".

**On disk (verified today, bytes read):**
- `scripts/typecheck-scripts.test.mjs` budget is empty and the ratchet has teeth (334-4 §1).
- `package.json:21-22` — `typecheck` = both legs; `typecheck:scripts:strict` present.
- `scripts/rapidtool-cli.mjs:2059` (emit) and `:2429` (tree-run) — `respond(payload, payload.ok ?
  (payload.unverified === true ? 5 : 0) : 1)`; the `unverified` fields are set at `:2020-2027` /
  `:2419-2426`. `src/lib/headless.test.ts:2016-2020` pins the default → exit 5.
- 39 verb `case`s = 39 `USAGE.commands` keys (`flagaudit.mjs`): **no phantom verb, no missing verb**.
- Flag audit: all **66** `--flags` named in `USAGE` are read (11 of them through the dynamic
  `flag(args, a)` action loops at `:3473` and `:4211`); the only code-read flags absent from USAGE
  and README are the regex false positives `maxSteps`/`x` in comments. **No phantom flag.**

**Still open (with `file:line`), before this lane:**
1. **No `--help`; a help request is a coded failure.** `scripts/rapidtool-cli.mjs:901` / `:4694`:
   `--help`, `-h`, `help` all exit **1** with `ok:false` (`Missing subcommand.` /
   `Unknown subcommand: …`). Live-probed. Pinned (as intended behaviour) at
   `scripts/cli-exit-taxonomy.test.mjs:669-677`. `README-cli.md` documents no help flag at all.
2. **Remedies on CLI usage refusals are engine-voiced, not actionable.**
   `scripts/rapidtool-cli.mjs:239-241` auto-attaches the registry `agentAction` for
   `RT_E_VALIDATION` → *"Reject the payload, state the concrete validation rule that failed, and
   ask for corrected input instead of guessing."* — text written for the ENGINE validating model
   output. It rides every CLI arg/state refusal (the ~25 `requireArg` sites at `:974`…`:4709`, the
   subcommand floor, the `--red-tree`/`--kind`/`--tree` guards). Live-probed:
   `create` with no `--brief`, `search` with no `--query`, `emit --red-tree bogus`,
   `diagram --kind bogus`, `knowledge` with no action all carry that remedy instead of the fix.
3. **A non-numeric value on a documented numeric flag is silently ignored.**
   `scripts/rapidtool-cli.mjs:167-188` (`VALUELESS_VALUE_FLAGS`) refuses `true` but not a string:
   live-probed `search --limit abc` → exit **0** (fell back to the default) and `deepen --phase abc`
   → exit 1 mis-reported as *"P0 is not complete"* (it fell back to the live phase). Same for
   `mine --limit abc`. `search --limit 0` / `--limit abc` both exit 0 today — the value never
   reaches a decision.
4. **`emit --run` / `tree-run` default exit 5** (334-0 §5.1) — the mission's item (c).
5. **Stale doc reference** in `tsconfig.scripts.json:13-14`: it names a checked-in
   `scripts/scripts-typecheck-budget.json` that does not exist (the budget lives in
   `scripts/typecheck-scripts.test.mjs`).

Divergence verdict: 331-6/332-4/334-4 claims are truthful on disk; the 332-4 STOP-and-REPORT is
resolved. Items 1–5 are addressed below (3/4/5 as fixes; 1 with docs+tests; 2 with a CLI-voiced
remedy translation).

---

## 0b. Checkpoint — intended patches (rule 9), written BEFORE applying

- **P1 (help):** in `main()` right after `parseArgs`, short-circuit `--help` / `-h` / `help` to a
  NEW success envelope `{ ok: true, usage: USAGE }` at exit **0** (narrowed to one verb's line when
  a known verb is named). USAGE gains a `help` row; `README-cli.md` gains a short "Asking for help"
  note; `cli-exit-taxonomy.test.mjs`'s floor test drops `--help` from the refusal set and a new test
  pins exit 0 + the verb list.
- **P2 (remedies):** a small `usageRemedy(error)` in `respond()`'s auto-remedy branch, translating
  ONLY the CLI's own argument-guard shapes (missing required `--flag`, `requires a path`, the
  subcommand floor, the exactly-one/at-most-one action guards, and a generic `--flag`-naming
  fallback for `RT_E_VALIDATION`) into the concrete fix; anything else keeps the registry action.
- **P3 (numeric flags):** `NUMERIC_VALUE_FLAGS = ["limit","phase","steps","max-steps","budget"]` +
  a pre-dispatch `refuseNonNumericFlag`, mirroring `refuseValuelessFlag` (exit 1, `RT_E_VALIDATION`,
  actionable remedy).
- **P4 (exit-5 default):** `emit --run` / `tree-run` default → **0** on a green tree (the envelope
  keeps `unverified`/`declaredScriptsVerified`/`unverifiedDeclaredScripts`); the NEW boolean flag
  `--require-verified` opts into the strict **exit 5**. `headless.test.ts:2016-2020` (335-2's file,
  not mine) pins the old default → STOP-and-REPORT with the exact one-line change.
- **P5 (doc drift):** correct `tsconfig.scripts.json`'s budget-path comment.

Each patch ships a RED-first test; results (and both runtimes) are in the sections below.

---

## 1. Flag / verb audit (documented vs real) — machine-extracted

Method: a scratch extractor (`%TEMP%\rt335_4\flagaudit.mjs`, outside the repo) pulls every
`--flag` token from the `USAGE` object and from `README-cli.md`, every flag the code reads
(`args.x`, `args["x"]`, `flag(args,"x")`, `requireArg(args,"x")`), and every verb
(`case "x"` vs `USAGE.commands` keys). Confirmed by live spawns.

| dimension | documented | real | verdict |
|---|---|---|---|
| verbs | 39 `USAGE.commands` keys | 39 `case` arms | **1:1** — no phantom, no missing |
| `--flags` in `USAGE` | 68 (was 66; +`help`, +`require-verified`) | all 68 read somewhere | no phantom |
| of those, action flags read dynamically | 12 (`list`…`verify`, `start`…`stop`) | `flag(args,a)` loops at `rapidtool-cli.mjs:3473` / `:4211` | real |
| code-read flags absent from USAGE+README | — | `maxSteps`, `x` | **regex artifacts in comments** (`:160`, `:2967`), not flags |
| README-only tokens | `--experimental-strip-types`, `--test`, `--flag` | Node/npm flags + generic prose | not CLI flags |

Every verb was spawned keyless through `%TEMP%\rt335_4\probe.mjs` (39-verb sweep + the fixtures/
lesson/scan/tree-run/eval/check/doctor/diagnose arms): all documented verbs work and print the
documented one-JSON envelope. `chat`'s keyless slash tools (`/help`, `/status`, `/ls`) were spawned
and return `ok:true` exit 0, as `USAGE.chat` claims. Item 4 of Step 0 (the fresh-tree exit) and the
`--help` finding are the two behaviours the bytes did **not** support; both are fixed below.

---

## 2. P1 — `--help` / `-h` / `help` are now a SUCCESS envelope — **FIXED**

**Before (live bytes, pre-fix):**

| argv | exit | ok | code | error |
|---|---|---|---|---|
| `--help` | 1 | false | `RT_E_VALIDATION` | `Missing subcommand.` |
| `-h` | 1 | false | `RT_E_VALIDATION` | `Unknown subcommand: -h` |
| `help` | 1 | false | `RT_E_VALIDATION` | `Unknown subcommand: help` |

So an agent that branches on the exit code read *discovery* as a failure, and `README-cli.md`
documented no help flag at all. **After** (live): all three `{ok:true, exit_code:0, usage:{description,
help, commands(39)}}`; `--help emit` / `help emit` / `emit --help` narrow to
`{verb:"emit", usage.commands:{emit}}`. `parseArgs` absorbs `--help emit` as `args.help === "emit"`
(a value, not a boolean) — the detection treats that string as the verb candidate. Documented in the
file header, the `USAGE.help` row, and a new README-cli §"Asking for help". The 316-I3 floor test
dropped `--help` from its refusal set; a new leg pins the success contract.

---

## 3. P2 — CLI usage refusals carry an actionable remedy — **FIXED**

**Before (live):** the auto-attached `remedy` for `RT_E_VALIDATION` was the registry's `agentAction`
— *"Reject the payload, state the concrete validation rule that failed, and ask for corrected input
instead of guessing."* — written for the ENGINE validating model output. It rode every CLI arg
refusal: `create` w/o `--brief`, `search` w/o `--query`, `emit --red-tree bogus`,
`diagram --kind bogus`, `doctor --tree <missing>`, `knowledge` w/o an action.

**After (live, exact):**

| invocation | remedy now |
|---|---|
| `create` | ``Re-run with --brief: `create --brief <value>`. Run `--help create` for the verb's synopsis.`` |
| `search` (no `--query`) | ``Re-run with --query: `search --query <value>`. Run `--help search` …`` |
| `noverb` | ``"noverb" is not a verb — run `--help` for the 39-verb synopsis, then check the spelling.`` |
| bare | ``Pass a verb… run `--help` … or `--help <verb>` …`` |
| `emit --red-tree bogus` | ``Fix the value named in `error` and re-run; `--help emit` lists the accepted flags.`` |

Implementation: `usageRemedy(error)` translates ONLY this file's own argument-guard grammar
(requireArg's `missing required --flag`, the path-flag refusal, the subcommand floor, the
exactly-one/at-most-one action guards, and a `--flag`-naming fallback). Non-usage validation prose
returns `null`, so engine-thrown codes keep their registry action. A site's own explicit remedy
(13 existing sites) still wins.

---

## 4. P3 — a non-numeric value on a documented numeric flag is refused — **FIXED**

**Before (live, silently dropped):** `search --limit abc` → **exit 0** (default limit applied);
`mine --limit abc` → exit 0; `deepen --phase abc` → exit 1 `RT_E_PHASE_ILLEGAL` *"P0 is not
complete"* — it fell back to the LIVE phase, so the caller's actual mistake (a non-numeric
`--phase`) was never named. **After (live):** all five documented numeric flags
(`--limit --phase --steps --max-steps --budget`) refuse pre-dispatch:
`exit 1`, `RT_E_VALIDATION`, `"<cmd>: --<flag> expects a non-negative integer (got \"abc\")."`,
remedy naming the flag. `mine --limit 1` still exits 0.

---

## 5. P4 — the `emit --run` exit-5 decision (item c) — **OPT-IN STRICT, default 0**

**Decision.** The W48 default (exit 5 whenever the declared toolchain did not run) is wrong for
operators: a fresh scaffold has **no `node_modules/`**, so `declaredScriptsVerified` is *always*
false, and the default flowed as **non-zero on every fresh emit** — a pass/fail an agent reads as
failure and a human reads as broken. But the honesty signal must survive: an unverified toolchain is
still distinguishable from a verified one. So:

- **default** — a green tree exits **0**; the envelope still carries `unverified: true`,
  `declaredScriptsVerified: false`, `unverifiedDeclaredScripts: [...]`, `unverifiedNote`. Red is
  still **1**. (`ok` is untouched; the P6 tested-mint is untouched.)
- **`--require-verified`** (new boolean flag, `emit --run` AND `tree-run`) — opts INTO the strict
  **exit 5** for that green-but-unverified state; a CI gate that wants the hard signal passes it.

This is the parent's foreseen "0-plus-envelope with an opt-in strict mode" (§5.1) and the mission's
"opt-in strict flag with docs and tests". Documented in the header, `USAGE.emit`/`USAGE."tree-run"`,
and README-cli's exit table + Emit/tree-run sections.

**Cross-lane note (resolved, no STOP-and-REPORT needed):** `src/lib/headless.test.ts:2002-2031`
(335-2's file) pinned the old default (`emit --run` → exit 5). Lane 335-2 **reconciled it
concurrently** to exit 0 and added both `--require-verified` arms; the E-25 describe passes
**30/30** against the new CLI (measured). No change to my files was requested or needed.

---

## 6. P5 — stale doc reference — **FIXED**

`tsconfig.scripts.json` named a checked-in `scripts/scripts-typecheck-budget.json` that does not
exist (the budget lives in `scripts/typecheck-scripts.test.mjs` as `ERROR_BUDGET`, now `{}`). The
comment now points at the real location. No behavior change; scripts typecheck still 0.

---

## 7. Tests added + real results (both runtimes)

**RED-first, byte-identical revert proof.** `scripts/rapidtool-cli.mjs` at the fixed state =
`git hash-object 073e02c42b7975d71e3dda3bbc7cd533a5db72f7`. The four source hunks (help block,
remedy line, numeric guard, exit-5 gate) were reverted in place and the three new tests + the
rewritten exit-5 test run against the pre-fix CLI:

```
node --test --test-reporter=tap --test-name-pattern="W49" scripts/cli-exit-taxonomy.test.mjs   (Node 22)
not ok 1 - W49 · 335-4: --help / -h / help are a SUCCESS …
not ok 2 - W49 · 335-4: a CLI usage refusal's remedy names the fix …
not ok 3 - W49 · 335-4: a non-numeric value on a documented numeric flag is refused …
not ok 4 - W49 · 335-4: emit --run / tree-run default to exit 0 …; --require-verified opts into exit 5
# tests 4 / # pass 0 / # fail 4
```

Re-applying the four hunks restored the file to `073e02c42b7975d71e3dda3bbc7cd533a5db72f7`
(**byte-identical**); the same 4 tests then:

```
ok 1 … ok 4     # tests 4 / # pass 4 / # fail 0
```

| suite | before | after | host Node v24.15.0 | pinned Node v22.23.2 |
|---|---|---|---|---|
| `scripts/cli-exit-taxonomy.test.mjs` | 31 | **34** | **34 / 34 / 0 fail** | **34 / 34 / 0 fail** |
| `scripts/typecheck-scripts.test.mjs` | 6 | 6 | **6 / 6 / 0 fail** | **6 / 6 / 0 fail** |
| sibling CLI set (`rapidtool-cli-edit` + `-fixtures` + `-lesson` + `cli-run-busy` + `README-cli` + `gate-verdict` + `chat-stream`) | — | — | **57 / 57 / 0 fail** | **57 / 57 / 0 fail** |
| `src/lib/headless.test.ts` E-25 describe (335-2’s, reconciled) | — | — | — | **30 / 30 / 0 fail** (Node 22) |

The 3 new legs: help success + per-verb narrowing; usage-refusal remedy names the fix (not the
registry action); non-numeric numeric-flag refusal. The exit-5 leg was rewritten to pin **both**
arms (default 0 with the honest unverified envelope; `--require-verified` → 5) for `emit --run`
**and** `tree-run`.

- `npx tsc -p tsconfig.scripts.json --noEmit` → **exit 0, 0 errors** (budget `{}`), both before and
  after; `npm run typecheck`'s leg 2 (the ratchet test) 6/6.
- `npx eslint scripts/rapidtool-cli.mjs scripts/cli-exit-taxonomy.test.mjs` → **exit 0, 0 warnings**.

---

## 8. What I did NOT do / stopped on

- **No full gate** (`npm test`, `npm run build`, `gate.sh`) — five siblings mid-edit (rule 4); the
  parent runs the boundary. Targeted suites only.
- **No `npm run eval`**, no keyed calls, no secret printed, no full-tree scan. Scratch stayed in
  `%TEMP%\rt335_4\`; the repo gained no probe file (only the four owned files changed here).
- **`src/**` untouched** — including `src/lib/headless.test.ts`, which 335-2 reconciled itself.
  No STOP-and-REPORT was required for the exit-5 flip.
- **`scripts/gate.sh` untouched** — the exit-5 semantics live entirely in the CLI.
- **No `--version`** added — it is not documented, so it is not a phantom; adding one was out of
  scope for a minimal patch.
- **Not run:** the whole 405-test scripts leg (335-6 edits `scripts/check-*.mjs` concurrently) and
  the 2771-test lib leg (siblings mid-edit). The affected suites were all run directly.
