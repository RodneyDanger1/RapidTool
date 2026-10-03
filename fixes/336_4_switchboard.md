# W50 / 336-4 — "Switchboard" — CLI + toolchain wiring, and make `npm run eval` safe (pass 5)

**Lane:** 336-4, persona "Switchboard". **HEAD at open:** `fac37d4`, tree clean (only untracked
`wave_plans/W50/`). **Runtime:** repo-pinned Node **22.23.2** (`%LOCALAPPDATA%\hermes\node\node.exe`)
and host Node **v24.15.0**; every `node --test` parsed with `--test-reporter=tap`. **Scratch (outside the
repo):** `%TEMP%\rt336_4\` — the repo gains no probe file. Keyless throughout (no keyed call, no secret
printed, no full gate — five siblings edit concurrently). Owned files (STRICT): all of `scripts/**`,
`tsconfig*.json`, `package.json`.

Baseline reproduced at open (Node 22): `npx tsc -p tsconfig.scripts.json --noEmit` → **exit 0, 0 errors**
(budget `{}`) · `node --test … scripts/cli-exit-taxonomy.test.mjs` → **34/34**.

---

## 0. Step 0 — reconciliation (claimed / on disk / still open)

**Claimed (332-4, 334-4, 335-4, 335-0):**
- 332-4: CLI + taxonomy test typecheck-clean; `--brief @file`; central valueless-flag refusal; `respond`
  returns `never`; `npm run typecheck` rewired to the ratchet test (STOP-and-REPORT filed).
- 334-4: scripts typecheck debt retired (134 errors / 14 files → **0 / 0**, `ERROR_BUDGET = {}`); `emit --run`
  / `tree-run` made to exit 5 on a green-but-unverified tree (S2).
- 335-4: `--help`/`-h`/`help` are a success envelope; CLI-voiced remedies; non-numeric numeric flags refused;
  the exit-5 default made **opt-in** (`--require-verified`), default 0; a 39-verb / 68-flag audit found no
  phantom; `tsconfig.scripts.json`'s stale budget-path comment corrected.
- 335-0 §5 item 4: **`npm run eval` still not run — it rewrites tracked `research/eval-out/**`** (this
  lane's mission (c)).

**On disk (verified today, bytes read):**
- `scripts/typecheck-scripts.test.mjs` budget `{}`; measured `tsc -p tsconfig.scripts.json --noEmit` = 0/0.
- `scripts/rapidtool-cli.mjs` — 39 `case` arms (lines 1082…4804) = 39 `USAGE.commands` keys (4919…4960);
  `USAGE` has 68 `--flags`; `default:` arm at 4813 is reachable (unknown subcommand).
- `scripts/run-eval.mjs:144-151` — `OUT_DIR = process.env.EVAL_OUT_DIR ? … : join(ROOT,"research","eval-out")`;
  no `--out` arg; `persist()`/empty-corpus/crash paths all write under `OUT_DIR`.
- `scripts/run-eval.mjs` `priorFor` (line 531) reads `HISTORY_PATH` under `OUT_DIR` — M7 priors come from the
  same dir the run writes.

**Still open (with `file:line`), before this lane:**
1. **`npm run eval` rewrites the tracked scorecard.** `package.json:26` `"eval": "node … run-eval.mjs"`;
   `scripts/run-eval.mjs:149` default `OUT_DIR = <repo>/research/eval-out`. A keyless run rewrites
   `research/eval-out/results.json`, `history.json`, and every tracked `<slug>/` trial tree. Fixed in §3.
2. **Mission (a)/(b) needed a fresh proof.** The 335-4 audit's "39/1:1, no phantom flag" was claimed; this
   pass re-derived it from the bytes and re-spawned all 39 verbs (§1–§2).

Divergence verdict: all prior claims are truthful on disk today. Item 1 was the only live defect; it is
fixed and proved.

---

## 1. Mission (a) — every documented verb and flag is wired

**Method (evidence: `%TEMP%\rt336_4\` probes, all keyless, `DEEPSEEK_API_KEY` cleared).**
- `deadscan.mjs` — extracts `USAGE.commands` keys, `case "x"` arms, `USAGE` `--flags`, and every flag the
  code reads (`args.x`, `args["x"]`, `flag(args,"x")`, `requireArg(args,"x")`).
- `verbsweep.mjs` — spawns all 39 verbs (pinned Node 22, repo cwd, no flags) and parses the one JSON envelope.
- `flagbattery.mjs` — the 19 central valueless flags + 5 numeric flags.
- `battery2.mjs` / `emitflags.mjs` / `verify2.mjs` — a driven project + ~45 flag-bearing invocations.

**Result — 39 verbs reach a `case` arm and return exactly ONE JSON envelope**

| documented (`USAGE.commands`) | `case` arms | phantom | missing | exercised (spawned) |
|---|---|---|---|---|
| 39 | 39 | **0** | **0** | **39** (`exits {"0":3,"1":36}`) |

The 3 exit-0 keyless verbs are `eval` (read-only scorecard), `doctor` (capability preflight) and `diagnose`
(telemetry tail); the other 36 return the documented `RT_E_VALIDATION` "missing required --x" refusal. No
verb is accepted-but-dead.

**Result — flags: 68 documented, 68 read; no phantom, no documented-but-absent**

| class | count | evidence |
|---|---|---|
| documented `--flags` in `USAGE` | 68 | `deadscan` |
| documented flags with **no** obvious code read | 12 → **all dynamic** | `lesson` action list (`rapidtool-cli.mjs:3595`) and `wild` action list (`:4333`) are read via `flag(args, a)` loops; the 12 are their members |
| code-read flags **absent** from `USAGE`+README | 3 → **regex artifacts** | `_` (parseArgs `args._`), `maxSteps`/`x` (comments at `:160`,`:2967`) — not flags |
| verbs with no duplicate `case` | 39 | no duplicate labels |

**Behavioural proof (not just static read) — no documented flag is accepted and silently ignored**

| invocation | observed |
|---|---|
| 19 central valueless value flags (`--name --limit --phase --steps --max-steps --budget --tags --title --kind --actor --evidence --reason --by --slug --dir --history --policies --ids --tree`) bare | **19/19** exit 1, `RT_E_VALIDATION`, error names the flag (`deadscan` FAILURES:0) |
| 5 numeric flags (`--limit --phase --steps --max-steps --budget`) `= abc` | **5/5** exit 1, `--<flag> expects a non-negative integer` |
| `create --brief/--name/--out` | exit 0, `name=RT336 Probe` |
| `create --advisory` then `export` | `enforceDod=false` (flag reaches the project bytes) |
| `export/packet/vault/design/diagram --out/--html` | files written at the named paths |
| `diagram --kind bogus` | exit 1, `unknown --kind "bogus"` |
| `search --query/--limit`, `mine --dir/--limit` | exit 0, bounded results |
| `emit --check` | `check` block present; `emit` onto a non-empty dir → `RT_E_FOREIGN_FILES`, `--force` → exit 0 |
| `emit --red-tree bogus` | exit 1 `expects "refuse" or "banner"`; `--red-tree banner` accepted |
| `emit --run` default vs `--run --require-verified` | exit **0** (`unverified:true`) vs exit **5** (`unverified:true`) |
| `tree-run --dir` vs `--require-verified` | exit 0 vs exit **5** |
| `verify --apply`, `repair --budget 0`, `edit` ambiguous match, `knowledge --save` bad shape, `eval --slug` unknown | each refuses coded, naming the concrete fault (flags reach a real decision) |
| `crew --max-steps`, `prompt --policies` (keyless) | exit 3 `RT_E_LLM_NOT_CONFIGURED` (flags read; no keyed call made) |
| `chat --ask /status`, `lesson --list/--propose/--advise/--effect`, `harvest`, `deepen --phase` | ran keyless; `deepen --phase 0` → `RT_E_PHASE_ILLEGAL` (phase not complete — the flag reached the phase check) |
| `--help`, `--help emit` | exit 0, `usage.commands` = 39 / narrowed `verb:emit` |

Verdict: **no documented verb or flag is accepted-but-inert, documented-but-absent, or silently ignored.**
The only "ignored" readings are out-of-contract flags passed to a verb that does not document them (e.g.
`create --live`) — not a documented surface, so not a defect (the 330 wave's governance case `--agent-seal`
is already centrally refused at `rapidtool-cli.mjs:1015`).

---

## 2. Mission (b) — dead/unwired CLI code hunt

Static analyzers `deadscan.mjs`, `orphan-exports.mjs`, `orphan-fns.mjs` over all of `scripts/**`:

| class hunted | method | finding |
|---|---|---|
| unreachable `case` | 39 arms vs 39 keys; duplicate-label scan; `default:` reachable | **none** |
| option read nowhere | 68 documented flags vs every code read | **none** (the 12 "unread" are dynamic action flags) |
| helper with no caller | top-level `function`/`const = () =>` defs, reference count across `scripts/**` | **0 orphans** |
| orphan export | every `export` in non-test scripts, referenced in `scripts/**` | **1 candidate — false positive** |

**The one candidate, resolved (not dead):** `scripts/grok-pwa-plugin.mjs:167` returns
`export const grokOgIdentity = …` from a Vite virtual module (`GROK_OG_IDENTITY_ID =
"virtual:grok-og-identity"`, line 21). Its consumer is **outside `scripts/`**: `server/middleware/grok-pwa.ts:18`
`import { grokOgIdentity } from "virtual:grok-og-identity"` (using `grokOgIdentity.site` at `:42`). The plugin's
`resolveId`/`load` hooks (`:163-168`) serve that import at build time. **Not dead; wire correct.** Recorded so
the scripts-only census method is not read as covering `server/`.

The central guards already prevent the class 332-4/335-4 closed (valueless + non-numeric), and §1 exercised
the rest. **No removal is proposed; nothing needed wiring.** (Rule 1 forbids deletion regardless.)

---

## 3. Mission (c) — `npm run eval` is now safe

**Before (bytes on disk):** `package.json:26` `"eval": "node --experimental-strip-types scripts/run-eval.mjs"`;
`run-eval.mjs:149` defaulted `OUT_DIR` to `<repo>/research/eval-out` (tracked). A bare `npm run eval`
rewrote `results.json`, `history.json`, the run marker, and every tracked `<slug>/` trial tree — the reason
335-0 §5 recorded "no wave has dared run it".

**After (minimal surgical patch, `scripts/run-eval.mjs`):**
1. **`--out <dir>` / `--out=<dir>`** is parsed and **wins over `EVAL_OUT_DIR`**; the env still works. Both are
   "explicit". (`run-eval.mjs` OUT_ARG block.)
2. **`export function evalOutRefusal(outDir, { explicit, repoRoot })`** — pure. Refuses an **un-chosen** OUT_DIR
   that resolves **inside the repo working tree** (the bare default always does), returns `null` for an explicit
   dir or one outside the repo. Uses `relative()` so a name-sibling is not "inside".
3. `main()` calls the guard **before any write** (after the write-free `--preflight`), prints the message to
   **stderr** and exits **2**; the startup line names the effective out dir + source. The refusal names both
   remedies — scratch `--out <dir>`/`EVAL_OUT_DIR`, or `--out research/eval-out` to regenerate the tracked
   scorecard **on purpose**. No new `RT_E_*` row (reuses the registered `RT_E_VALIDATION`).
4. Docs: `run-eval.mjs` header `Run:` block; `scripts/README-cli.md` §34.

**Real run (mission proof):**

| command | result |
|---|---|
| bare `run-eval.mjs` (no `--out`, no `EVAL_OUT_DIR`) | **exit 2**, stderr `eval: refusing to write eval artifacts into the repo working tree by default (out=…\research\eval-out). … --out …` — nothing under `research/eval-out/**` written |
| `run-eval.mjs --out=%TEMP%\rt336_4\eval-out` | **exit 0** — a FULL keyless run of the real 11-entry corpus (5–7 s/case) wrote `results.json` + `history.json` + every `<slug>/` tree **into the scratch dir** |
| tracked `research/eval-out/results.json` | SHA256 `22082FC1415F0ABC7EFA5B15AC77170465218938ADAA492B189A0FB6EEBD42AB` **unchanged** (before == after) |
| `git status --porcelain -- research/eval-out` | **empty — clean** |

**RED-first (byte-identical revert proof).** `scripts/run-eval.mjs` at the fixed state =
`git hash-object` `8EB914403AC92E250049160A78F31036701B9FAFFC7AB7FC2B228C1B3A1FF5CD`. Temporarily restored HEAD's
version and ran the new legs:

```
not ok 1 - scripts\run-eval.test.mjs
# SyntaxError: The requested module './run-eval.mjs' does not provide an export named 'evalOutRefusal'
```

Re-applying the patched file restored the hash **byte-identical**; the W50 legs then `1..3 # pass 3 / fail 0`.
(The behavioral bare-default refusal leg is proved by the real run above rather than an in-test spawn: its
pre-fix run would itself write the frozen tracked dir, which the mission forbids — the pure guard test is the
RED-first pin instead. Stated so no greener claim is implied.)

---

## 4. Mission (d) — scripts typecheck 0 and the ratchet green

| check | command | result |
|---|---|---|
| scripts typecheck | `npx tsc -p tsconfig.scripts.json --noEmit` | **exit 0, 0 errors** (before and after) |
| ratchet | `node --test scripts/typecheck-scripts.test.mjs` | **6/6** on Node 22 and host Node 24; `ERROR_BUDGET = {}` untouched |
| taxonomy | `node --test scripts/cli-exit-taxonomy.test.mjs` | **34/34** (CLI untouched) |
| lint | `npx eslint scripts/run-eval.mjs scripts/run-eval.test.mjs` | **exit 0, 0 warnings** |

---

## 5. Mock/fake census over `scripts/**` (`census.mjs`)

| pattern | hits | verdict |
|---|---|---|
| `as any` | **0** | clean |
| `@ts-ignore` / `@ts-expect-error` | **0** | clean |
| `eslint-disable` | **0** | clean |
| literally-empty `catch {}` | **0** | clean |
| `TODO/FIXME/XXX/HACK` | 6 | all in `cli-exit-taxonomy.test.mjs` fixture strings (the emitted `TODO(E-15)` scaffold stub — the honest product contract) + 2 `run-eval.mjs` **comments** referencing a closed TODO; **no production TODO body** |
| `mock/fake/stub/dummy/placeholder` (production scripts, non-comment) | see below | **0 fakes** |
| `not implemented` | 2 | comments / the `nav neutral-return-unimplemented` detector name |

The 145 raw `mock/fake/...` matches collapse, in production scripts, to: `brand-check.mjs`'s
`placeholder`/`--placeholder-ok` (the og.grok.me share-card domain term), `grok-pwa-shared.mjs`'s
`placeholderCardColor` (a real deterministic color fn), `preview.mjs`'s `stubborn` (a variable name caught by
the `stub` substring), `rapidtool-cli.mjs:2095`'s `outcome.substance.stubs` (reads the real inventory), and
`run-eval.mjs` comments that read **"never faked"**. Test doubles live only in `*.test.mjs` (injectable
seams). **Census: clean — no production fake, no fake computation.**

---

## 6. Tests added + real results (both runtimes)

| suite | before | after | host Node v24.15.0 | pinned Node v22.23.2 |
|---|---|---|---|---|
| `scripts/run-eval.test.mjs` | 48 | **51** | **51 / 51 / 0 fail** | **51 / 51 / 0 fail** |
| `scripts/typecheck-scripts.test.mjs` | 6 | 6 | **6 / 6 / 0 fail** | **6 / 6 / 0 fail** |
| `scripts/README-cli.test.mjs` | 12 | 12 | — | **12 / 12 / 0 fail** |
| `scripts/cli-exit-taxonomy.test.mjs` | 34 | 34 | — | **34 / 34 / 0 fail** |

The 3 new legs: `evalOutRefusal` (refuse un-chosen in-repo / allow explicit / allow outside / allow name-sibling);
`--out` directs the artifacts and **wins over `EVAL_OUT_DIR`** (env dir stays empty) with a real empty-corpus
spawn; a source pin that `main()` invokes the guard with `process.exit(2)` before any write.

---

## 7. What I STOP-and-REPORTed (owners named)

- **Root `README.md` is unowned and now partly stale** (owner: the parent / the README's owner). It does not
  mention the new explicit-out requirement:
  - `README.md:326` — `` npm run eval   # the acceptance harness (fixtures); needs a key for real runs `` →
    should note it now needs `--out <dir>` (or `EVAL_OUT_DIR`), or `--out research/eval-out` to regenerate the
    tracked scorecard.
  - `README.md:555-556` — "`run-eval.mjs` … writes `research/eval-out/results.json` + `history.json`" → should
    say it writes to the **chosen** out dir and refuses the bare default into the repo.
  I documented the change in my owned `scripts/README-cli.md` §34 and the driver header; I did not edit the
  root README.
- **Not a STOP, recorded for scope:** `scripts/check-module-coverage.mjs` shows as modified in `git status` —
  that is lane **336-6 Warden** (granted `scripts/check-*.mjs`), not this lane; scripts typecheck stayed 0 with
  it in the tree.

---

## 8. What I did NOT do (and why)

- **No full gate** (`npm test`, `npm run build`, `gate.sh`) — five siblings mid-edit (rule 6); the parent runs
  the boundary. Targeted suites only.
- **No keyed calls** — `DEEPSEEK_API_KEY` was cleared from every probe; no secret printed. The machine's stale
  User-scope key produced only the existing tail-only shadow notice (`RT_E_LLM_KEY_SHADOWED`), the documented
  335-0 §5 item 6, which is the machine owner's.
- **No eval against the tracked artifacts** — mission (c) was proved against `--out` scratch; `research/eval-out`
  hashes before/after are identical.
- **No deletion of tracked files; no reformatting; no file rewrite** — the run-eval patch is 3 surgical hunks
  plus the pure guard function; the CLI itself was not edited this pass (mission (a)/(b) were audits).
- **No `--version`** added (not documented — not a phantom).
- **`tsconfig*.json` / `package.json`** unchanged this pass (the scripts typecheck already 0; `npm run eval`'s
  target is unchanged — the guard lives in the driver, so `package.json` needs no edit and the refused default
  is the driver's own).

*End of 336-4 lane log (append-only from here).*
