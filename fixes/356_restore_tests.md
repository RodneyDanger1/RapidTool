# fixes/356 — W356 lane `restore-tests` (the CLI, the remaining test drift, the stale hard-coded values)

**Lane:** W356 `restore-tests` (1 of 6). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (path has a space).
**Host:** Node **v24.15.0**, Windows PowerShell 5.1. **Scope:** `src/lib/wild-step.test.ts`;
`scripts/rapidtool-cli.mjs` + its suites; `scripts/typecheck-scripts.test.mjs`; `scripts/README-cli.md`;
the test fixture for item 367. **No keyed call · no git write · no ratchet/budget/assertion loosened.**

Baseline (re-derived this session, before any edit):

```
npx tsc --noEmit            -> exit 2 · 5 errors in 3 test files (headless.test.ts · scaffold.test.ts x2 · wild-step.test.ts x2)
```

## Item ledger (append-only)

| item | source-or-test | old → new | evidence command |
|---|---|---|---|
| 1 | **test-wrong** | `wildFixture(status: "locked" \| "rejected" \| "awaiting_hitl")` → `wildFixture(status: PhaseStatus)` (6 values); `import type { PhaseStatus, Project }` | `npx tsc --noEmit` (wild-step errors gone) |
| 4 | **test-wrong** (source correct) + **doc stale** | `summary.status` assertion `"complete"` → `"complete_with_failures"`; `README-cli.md` loops/status vocabulary reconciled | `node --test --test-reporter=tap --test-name-pattern=… cli-exit-taxonomy.test.mjs` |
| 4b | **doc stale** | `scripts/README-cli.md` §Doctor now documents `--project <file.json>` | `node --experimental-strip-types scripts/rapidtool-cli.mjs doctor --project build.json` |
| 3 | **source-wrong** | `capture: "scripts/rapidtool-cli.mjs:455"` → `:519` (the real `cliLogEvent({` site) | `node --test --test-reporter=tap scripts/diagnose-audit.test.mjs` |
| 6 | **source-wrong** | `doctor` USAGE line gains `[--project <file.json>]` (the arm already consumed `CLI_PROJECT`) | `node --experimental-strip-types scripts/rapidtool-cli.mjs doctor --project build.json` |
| 5 | **test-wrong** | `typecheck-scripts.test.mjs` env spread-then-assign (bare spread keeps the index signature) | `npx tsc -p tsconfig.scripts.json --noEmit` (file is clean) |
| — | **test-wrong** (uncatalogued) | `src/lib/wild-step.test.ts` BUG-5: `park.reason` expectation re-pinned to the prefixed clipped detail | `node --experimental-strip-types --test --test-reporter=tap src/lib/wild-step.test.ts` |
| 2 | **test-wrong — NOT MY FILE** | `keylessNoTree` fixture lives in `scripts/guards/gate-invariants.test.mjs:207` (lane `restore-guards`) — reported, untouched | read-only inspection |

(rows appended below as the run progressed)

---

## 1. Item 1 — `wild-step.test.ts` `'"complete"' not assignable` (TEST-wrong)

**Cause.** `wildFixture` was declared `status: "locked" | "rejected" | "awaiting_hitl"` — 3 of the
**6** `PhaseStatus` members (`src/lib/types.ts:4`: `locked | ready | running | awaiting_hitl |
complete | rejected`). The body already handled any status (`p.phases[0] = { ...p.phases[0], status }`),
so the union was wrong, not the two call sites at `:1399` / `:1415`. Widened AT THE CAUSE
(no cast at the call site):

```
- import type { Project } from "./types.ts";
- function wildFixture(status: "locked" | "rejected" | "awaiting_hitl"): Project {
+ import type { PhaseStatus, Project } from "./types.ts";
+ function wildFixture(status: PhaseStatus): Project {
```

**Evidence.** `npx tsc --noEmit` — the two `wild-step.test.ts(1399|1415,44) TS2345` lines are gone.
`node --experimental-strip-types --test --test-reporter=tap src/lib/wild-step.test.ts` → **44 pass / 0 fail**.

## 2. Item 2 — test 367 `C-14 p6-arch must fail closed on a keyed attempt with no tree` (TEST-wrong, NOT MY FILE)

Verified the finding and **left the file alone** — the fixture lives in `scripts/guards/`, which
belongs to lane `restore-guards`.

- site: `scripts/guards/gate-invariants.test.mjs:207` — `const keylessNoTree = { ...base, generatedTree: [] };`
- `base` = `testruns/office-stock-tracker/build.json`, whose own `logs[]` carry **8** `p6.synthesis.*`
  rows — `p6.synthesis.attempt` ×6 + `p6.synthesis.refused` ×2, newest `refused` (measured:
  `$p.logs | ? { $_.event -like 'p6.synthesis*' }` → 8; newest `p6.synthesis.refused`; `generatedTree` 2).
  `newestSynthesisEvent` therefore fails closed on a row the "keyless floor" still carries, so the control
  is not the floor its assertion claims.
- Not touched. **Later re-check: `scripts/guards/gate-invariants.test.mjs` → 13 pass / 0 fail** (the
  `restore-guards` lane fixed it during this session).

## 3. Item 3 — test 233 stale `capture:` pointer (SOURCE-wrong)

`scripts/rapidtool-cli.mjs:539` hard-coded `capture: "scripts/rapidtool-cli.mjs:455"`; the real
`cliLogEvent({` emit site is `:519` (measured `Select-String -Pattern 'cliLogEvent\(\{'` → 519).
The test's rule is right (the pointer must land on a `cliLogEvent(` line), so the stale literal was
the source side.

```
- capture: "scripts/rapidtool-cli.mjs:455",
+ capture: "scripts/rapidtool-cli.mjs:519",
```

**Evidence.** `node --test --test-reporter=tap scripts/diagnose-audit.test.mjs` → **2 pass / 0 fail**
(was `not ok 1`).

## 4. Item 4 — test 208 / `summary.status` (TEST-wrong + DOC stale; the SOURCE is right)

The plan table called this source-wrong. **The bytes disagree, so I am recording the correction.**
`terminalStatusOf` is deliberate and documented at its definition
(`src/lib/engine.ts:2025-2028`; consumed at `src/lib/headless.ts:2288-2291`, comment: *"A4-E2(c)/A4-E3:
a dirty seal must NOT render as a plain `complete` — the summary is the surface the CLI and the console
read for the status chip"*). The test's own sibling assertions already say the seal is dirty
(`res.status === 1`, `code === "RT_E_GATES_FAILED"`, `sealedWithFailures === true`), so pinning
`summary.status === "complete"` contradicted the test's own premise.

- **test** (`scripts/cli-exit-taxonomy.test.mjs:3050`): `"complete"` → `"complete_with_failures"`, plus a
  new assertion that the RECORD's own status is still `"complete"` — strictly stronger, not looser.
- **doc** (`scripts/README-cli.md`, the stale side): the published driver loop `if summary.status ==
  "complete" or "blocked": stop` never stopped on a dirty seal. Reconciled at `:332` (agent loop),
  `:1514-1515` (driver pseudocode), `:150` + `:187-190` (status vocabulary comments), each now naming
  `complete_with_failures` and pointing at `failedGates` / `sealedWithFailures` / exit 1 to tell the two apart.

**Evidence.** `node --test --test-reporter=tap --test-name-pattern="341-6 - a SINGLE keyless" scripts/cli-exit-taxonomy.test.mjs`
→ `ok 1`, 1 pass / 0 fail. Full suite: **62 pass / 0 fail**. `scripts/README-cli.test.mjs` (doc↔dispatcher
parity) → **12 pass / 0 fail**.

**Not implemented (owner decision).** The audit floated a second option — keep `summary.status` and *add*
a new field. That would change the CLI/console contract for every consumer and is an owner call, not a lane
call; reconciling the two stale consumers is the minimal honest fix.

## 5. Item 5 — test 585 `TS2339` at `typecheck-scripts.test.mjs:219` (TEST-wrong)

`const env = { ...process.env, RT_TYPECHECK_NESTED: "1" }` widens the object to
`{ RT_TYPECHECK_NESTED: string }` — object spread with a literal member drops `process.env`'s string
index signature — so the next line `delete env.NODE_TEST_CONTEXT;` was `TS2339`. Fixed at the cause with
the repo's own idiom (bare spread, then assign):

```js
const env = { ...process.env };
env.RT_TYPECHECK_NESTED = "1";
delete env.NODE_TEST_CONTEXT;
```

`ERROR_BUDGET` stays `{}` — **no budget entry added, the ratchet still bites.**

**Evidence.** `npx tsc -p tsconfig.scripts.json --noEmit` → the `typecheck-scripts.test.mjs` line is gone;
`scripts/typecheck-scripts.test.mjs` → `ok 4 - rapidtool-cli.mjs and its taxonomy test are clean and unbudgeted`.

## 6. Item 6 — `doctor --project <file>` refused as an unknown flag (SOURCE-wrong)

The doctor arm consumes `CLI_PROJECT` (`scripts/rapidtool-cli.mjs:5732` `...(CLI_PROJECT ? { projectPath: CLI_PROJECT } : {})`),
but the accepted-flag set is DERIVED from the verb's own `USAGE.commands` line
(`acceptedFlagsFor`, `:261-270`), and the doctor line did not document `--project` — so the
pre-dispatch guard refused it `RT_E_VALIDATION` (`refuseVerbFlag`, `:276-283`, invoked `:1507-1511`).

```
- doctor: "doctor [--tree <dir>] [--mcp-call <tool>] [--mcp-call-args <json>]  # capability pre-flight …
+ doctor: "doctor [--project <file.json>] [--tree <dir>] [--mcp-call <tool>] [--mcp-call-args <json>]  # capability pre-flight …
```

`scripts/README-cli.md` §Doctor now documents the flag (and `--tree`) too.

**Evidence.** `node --experimental-strip-types scripts/rapidtool-cli.mjs doctor --project build.json`
→ `ok:true`, exit 0. `node --experimental-strip-types --test --test-reporter=tap --test-name-pattern="338-3: doctor" src/lib/headless.test.ts`
→ the pre-existing E-25 `doctor --project`/`--tree` legs: **2 pass / 0 fail**.
`doctor --start` still refuses (B1-F2 leg inside `cli-exit-taxonomy.test.mjs`, 62/62 green).

## 7. Uncatalogued red — `wild-step.test.ts` BUG-5 park surface (TEST-wrong)

Not in the audit's list: the audit's red list came from the scripts leg + `tsc`, and **baseline
`npm test` never ran the src leg** (leg 1's `&&` was already broken), so this src-leg failure was invisible.

The test expected `park.reason === LONG.slice(0,600)+"…"` (the raw critique). The engine derives BOTH
park surfaces from the ONE `detail` it is handed — `wildPause` → `wildParkInfo` `reason: clipSurface(detail)`
and `lastAutoLog: clipSurface(detail)` (`src/lib/engine.ts:5141-5158`, `:5186-5188`) — and the `wild.reject`
arm's detail is the prefixed line `` `P${phase} review REJECTED: ${decision.feedback}` ``
(`src/lib/engine.ts:5881`). Measured actual: `'P0 review REJECTED: critique head xxx…'`. The sibling
subtest in the same `describe` that asserts the `parkIfNull` path (`:1276-1291`) passes with a RAW detail,
which is why only the reject arm looked wrong. The 320 fix's own measurement (`fixes/320_v_verify.md:94`,
`park.reason` len 200 = the clipped prefixed detail) confirms the source behaviour is old and stable, so
the assertion — not the engine — was wrong.

```
- const expectedReason = `${LONG.slice(0, 600)}…`;
- const expectedLog = `${`P0 review REJECTED: ${LONG}`.slice(0, 600)}…`;
+ // engine.ts derives BOTH surfaces from the ONE `detail` … the reject arm's detail is the prefixed line
+ const expectedLog = `${`P0 review REJECTED: ${LONG}`.slice(0, 600)}…`;
+ const expectedReason = expectedLog;
```

**Evidence.** `node --experimental-strip-types --test --test-reporter=tap src/lib/wild-step.test.ts` →
**44 pass / 0 fail** (was 43/1).

## 8. Item 7 — test 586 re-check

`scripts/typecheck-scripts.test.mjs` → `ok 3 - scripts typecheck: npm run typecheck runs BOTH legs (src + scripts)`
(**green**). Leg 1 `npx tsc --noEmit` now exits **0** on its own; the 5 baseline src errors are gone
(mine: the 2 `wild-step.test.ts`; other lanes: `headless.test.ts:5999`, `scaffold.test.ts:2712/2719`).

## 9. Item 8 — the FULL red list re-derived at the end of this run

Re-derived by running each host suite directly (the full `npm test` is forbidden for this wave):

| red item | status at close | owner (file) |
|---|---|---|
| 5 src type errors (incl. `wild-step.test.ts:1399/1415`) | **GREEN** — `npx tsc --noEmit` exit **0** | mine + sibling lanes |
| 208 | **GREEN** | mine |
| 233 | **GREEN** | mine |
| 367 (C-14) | **GREEN** (`gate-invariants` 13/0) | `restore-guards` |
| 204 / 216 / 217 / 218 | **GREEN** (`cli-exit-taxonomy` 62/0) | `restore-oracle` (`src/lib/scaffold.ts`) |
| 246 | **GREEN** (`factory-watch` 21/0) | `restore-oracle` |
| 345 | **GREEN** (`guards/delivery-gate` 2/0) | `restore-census` (`src/lib/compile-check.server.ts`) |
| 407 / 415 | **GREEN** (`prevention/replay-harness` 17/0) | `restore-census` |
| 586 | **GREEN** | mine |
| **585** | **STILL RED** — see below | **NOT mine** (`scripts/quality-ratchet.mjs`) |
| **163 / 164** | **STILL RED** — see below | **NOT mine** (`scripts/check-module-coverage.mjs`) |

### 585 — still red, and it is not my file

`ERROR_BUDGET` is `{}` (correct, and left alone — adding an entry would defuse the ratchet). The suite's
only red file is the **new, untracked** pair another lane is writing *right now*:

```
npx tsc -p tsconfig.scripts.json --noEmit   -> 94 errors:
  scripts/quality-ratchet.mjs      63
  scripts/quality-ratchet.test.mjs 31
git status --porcelain -- scripts/quality-ratchet.*  -> ?? scripts/quality-ratchet.mjs
                                                        ?? scripts/quality-ratchet.test.mjs
mtime 14:35:34 (63s before the reading) -> a mid-edit state, not a frozen tree
```

My own file is clean: `ok 4 - scripts typecheck: rapidtool-cli.mjs and its taxonomy test are clean and unbudgeted`.

### 163 / 164 — still red, and not my file

`node --test --test-reporter=tap scripts/check-module-coverage.test.mjs` → **5 pass / 2 fail**
(`not ok 6`, `not ok 7`). Cause per the audit: 7 stale `src/lib/auth/*` allowlist entries in
`scripts/check-module-coverage.mjs` — the guard's own data is the source-wrong side. Not in my scope.

## 10. Owned suites — final evidence

| suite | result |
|---|---|
| `src/lib/wild-step.test.ts` | 44 pass / 0 fail |
| `scripts/cli-exit-taxonomy.test.mjs` | 62 pass / 0 fail |
| `scripts/diagnose-audit.test.mjs` (item 233's host) | 2 pass / 0 fail |
| `scripts/cli-run-busy.test.mjs` | 6 pass / 0 fail |
| `scripts/rapidtool-cli-352.test.mjs` | 17 pass / 0 fail |
| `scripts/rapidtool-cli-edit.test.mjs` | 10 pass / 0 fail |
| `scripts/rapidtool-cli-fixtures.test.mjs` | 4 pass / 0 fail |
| `scripts/rapidtool-cli-lesson.test.mjs` | 16 pass / 0 fail |
| `scripts/typecheck-scripts.test.mjs` | 5 pass / 1 fail (585, foreign mid-edit file) |
| `scripts/README-cli.test.mjs` (doc↔dispatcher parity) | 12 pass / 0 fail |
| `npx tsc --noEmit` | **exit 0** |
| `npx tsc -p tsconfig.scripts.json --noEmit` | exit 2 — 94 errors, all in `scripts/quality-ratchet.*` (foreign) |

## 11. Unverified / residual

- Test **585** could not be closed inside this lane: it is red only on `scripts/quality-ratchet.*`, an
  untracked pair being edited concurrently (mtime 14:35:34, seen mid-write). Not budgeted (loosening is
  forbidden) and not mine. Re-run when that lane lands.
- Tests **163/164** remain red in `scripts/check-module-coverage.mjs` (foreign).
- The **full** red list could not be taken from one `npm test` run (forbidden this wave): each host suite
  was run standalone and attributed by file + mtime. A suite outside my scope that is red but not on the
  audit's list would not show up here.
- No keyed call, no git write, no ratchet/budget/assertion loosened; no mock/stub/fake on any production path.
