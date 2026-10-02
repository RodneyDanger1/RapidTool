# fixes/331_6_warden.md — W45 lane 331-6 "Warden" — build-harness & test-integrity

**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (space in path; terminal `grep`).
**HEAD at open:** `03a6d0b` (330 wave). Node 22 pinned at `%LOCALAPPDATA%\hermes\node\node.exe`
(v22.23.2); host Node v24.15.0. Baseline at wave open: typecheck 0 / lint 0 / 774 suites.
**Rules obeyed:** no full gate (five siblings mid-edit); targeted suites + bounded repeats only;
`--test-reporter=tap` on every parsed child run; append-only log; only owned files touched;
no secrets printed.

Owned: `scripts/**` except `scripts/rapidtool-cli.mjs`, `scripts/README-cli.md`,
`scripts/cli-exit-taxonomy.test.mjs` (331-1's) · `tsconfig.json` · `tsconfig.scripts.json` ·
`eslint.config.mjs`.

---

## G1 — `npm run typecheck` coverage of `scripts/**` (WA-02 / R15-f04)

### What `tsconfig.scripts.json` really covered (before this lane)

It was a **staged, unwired** config: `extends ./tsconfig.json`, `include: ["scripts"]`, and a
`//` comment admitting it was "NOT IN gate.sh" with 1030 errors at land time (2026-09-26). No
command ran it, no test pinned it, and `npm run typecheck` (`tsc --noEmit` → `tsconfig.json`,
`include: ["src","server"]`) never saw it. Measured today it reported **1334 errors** under the
inherited `strict` posture.

### The posture problem (measured, not assumed)

| config posture | errors in scripts program | effect on `src/lib` |
|---|---|---|
| inherited `strict: true` | **1334** (621 x TS7006 implicit-any + cascades) | clean |
| `strict: true` + `noImplicitAny: false` | 274 | clean |
| `strict: false` (all off) | 78 | **~600 false errors** — `strictNullChecks: false` widens `ok: true \| false` and destroys discriminated-union narrowing in every transitively-imported `src/lib` file |
| `strict: true` + `noImplicitAny: false` + `useUnknownInCatchVariables: false` | **189 → 173 after fixes** | clean |

So: `strict: false` is NOT an option — it silently wrecks the check on the very `src` files the
program imports. Shipped posture is the last row: keeps `strictNullChecks` and all real type
checking, drops only the two flags that are pure noise for untyped `.mjs`.

### Coverage hole the pin found

`include: ["scripts"]` alone leaves **`scripts/grok-pwa-shared.mjs` (17 KB of real code) OUT of
the program**: TypeScript treats the committed `grok-pwa-shared.d.mts` as its declaration and
drops the `.mjs` implementation from directory inclusion. Fixed with an explicit
`"files": ["scripts/grok-pwa-shared.mjs"]`, which immediately surfaced **6 real errors** in that
file that no gate could previously see.

### Landed

- `tsconfig.scripts.json` — posture above, documented; command:
  **`npx tsc -p tsconfig.scripts.json --noEmit`**
- `scripts/typecheck-scripts.test.mjs` — 4 tests: (1) every checkable `scripts/**` file is in
  the program; (2) no error outside the per-file ratchet budget; (3) budget parser teeth;
  (4) end-to-end plant through real `tsc`. **Node 22: 4/4 pass.**
- Own-file errors fixed: `scripts/brand-check.test.mjs` (26 → 2),
  `scripts/run-eval.mjs` (JSDoc on 4 destructured-param functions + drain-ending subject), etc.

### RED-first proof (planted, then reverted)

Planted `/** @type {number} */ export const wardenPlantedError = "not a number";` at the end of
`scripts/browser-smoke-verdict.mjs` (a file with no budget entry):

```
not ok 2 - scripts typecheck: no NEW errors beyond the recorded per-file budget
    new red file(s):
      scripts/browser-smoke-verdict.mjs: 1 error(s)
# pass 3 / # fail 1
```

`git checkout -- scripts/browser-smoke-verdict.mjs` → `git status` clean → back to 4/4.

### Real result today

`npx tsc -p tsconfig.scripts.json --noEmit` → **exit 1, 173 errors across 16 files.**
Per-file budget (enforced by the pin test):

| file | errors | owner |
|---|---|---|
| `scripts/rapidtool-cli.mjs` | 38 | **331-1 Keywright — NOT editable by this lane** |
| `scripts/run-eval.test.mjs` | 64 | 331-6 |
| `scripts/run-eval.mjs` | 25 | 331-6 |
| `scripts/preview.test.mjs` | 10 | 331-6 |
| `scripts/grok-pwa-shared.mjs` | 6 | 331-6 (was invisible) |
| `scripts/write-atomic.test.mjs` | 5 | 331-6 |
| `scripts/browser-guard.mjs` | 5 | 331-6 |
| `scripts/with-app-env.test.mjs` | 4 | 331-6 |
| `scripts/check-auth-invariant.test.mjs` | 4 | 331-6 |
| `scripts/next-action-arm-parity.test.mjs` | 3 | 331-6 |
| `scripts/browser-smoke.mjs` | 2 | 331-6 |
| `scripts/brand-check.test.mjs` | 2 | 331-6 |
| `scripts/migration-plan.test.mjs` | 2 | 331-6 |
| `scripts/grok-pwa-plugin.mjs` | 1 | 331-6 |
| `scripts/grok-pwa-plugin.test.mjs` | 1 | 331-6 |
| `scripts/cli-exit-taxonomy.test.mjs` | 1 | **331-1 Keywright** |

**NOT green**, honestly: 173 residual errors. 39 are cross-lane (331-1). The rest are the
untyped-`.mjs` migration, pinned by a budget that can only ratchet DOWN (any new error, in any
file, fails `scripts/typecheck-scripts.test.mjs`). The budget is per-file counts, not
`file:line`: 331-1 is editing `rapidtool-cli.mjs` concurrently and its diagnostic lines moved
between measurements (183/310/903/1186 → 183/310/910/1194) while the count stayed 38.

### BLOCKED sub-item (STOP-and-REPORT): wiring into `npm run typecheck`

`npm run typecheck` is `tsc --noEmit`, which reads `tsconfig.json` only. Making it *itself*
cover scripts requires ONE of:
(a) add `scripts` to `tsconfig.json`'s `include` — impossible without either 1334 errors under
    strict or globally relaxing `strict` (which weakens the src gate); or
(b) change the npm script to `tsc --noEmit && tsc -p tsconfig.scripts.json --noEmit`.
**(b) needs `package.json`, which is not in this lane's ownership** → not edited. Report to the
parent. The capability (config + command + pin) is landed; only the npm-script wiring is blocked.

---

## G2 — assertion-guard blind spots (R9-f06)

### Decision — what is a REAL gap

The register named "presence-only `assert.ok(obj)`" and "typeof-only" as blind spots. Measured
against the tree, those labels overshoot: a bare `assert.ok(x)` is falsifiable (x can be
`undefined`) and there are **289** of them; `assert.equal(typeof x, "string")` is falsifiable too
(x can be a number) and there are **50**. Flagging those would be ~340 false positives across
files this lane does not own — a guard that cries wolf, not a guard with teeth.

The mission's own criterion — *a test that can never fail is not a test* — picks the sound subset,
which is what landed. Two new rules in `scripts/check-assertion-gaps.mjs`:

- **`tautology:presence-only`** — `assert.ok(<always-truthy expression>)`: object/array/function/
  regex/`new` literal, non-empty string, non-zero number, non-empty template, or a bare
  `typeof ...` (always a non-empty string). `assert.ok(["a"].includes(x))` and
  `assert.ok(/re/.test(x))` are NOT flagged — the subject is a call, not a literal.
- **`tautology:typeof-only`** — `assert.equal(typeof <literal>, "<the literal's own type>")`
  (e.g. `typeof "x"` === `"string"`), true for every run.

Deliberately NOT flagged (documented in the file): weak-but-falsifiable presence/typeof
assertions. They are weak tests, not tests that cannot fail.

### RED-first proof (planted, then removed)

```
=== RED (planted fixture) ===
../../AppData/Local/Temp/warden-g2-red/weak.test.mjs:3: [tautology:presence-only] asserting an object literal — always truthy, so the assertion cannot fail
../../AppData/Local/Temp/warden-g2-red/weak.test.mjs:4: [tautology:typeof-only] `typeof` of an inline literal compared against its own type — the assertion cannot fail
[assertion-gap] 2 finding(s) across 1 test file — fix the assertion, do not delete it
EXIT: 1
=== GREEN (planted file removed) ===
[assertion-gap] clean — 120 test files scanned, 0 findings
EXIT: 0
```

Live tree after the extension: **clean, 0 findings** (121 test files). Tests added to
`scripts/check-assertion-gaps.test.mjs` (Node 22): always-truthy subjects for 10 shapes; 10
falsifiable subjects that must NOT trip; typeof-only positives and negatives; a CLI RED-first
planted-file test; and one for the fail-closed change in G5. **Node 22: 25/25 pass.**

### Residual findings this sweep surfaced (reported, NOT flagged by the shipped rules)

Two `|| true` assertions are genuine never-fail tests the guard still does not catch, because
shipping that rule today would red `gate.sh` on files this lane does not own:

- `src/lib/codegen.server.test.ts:559` — `assert.ok(!r.source.includes("module.exports.createProperty = createProperty;") || true);`
  is `assert.ok(true)`; it cannot fail. Owner: **331-4 Composer** (`codegen.server.ts` + colocated tests).
- `src/lib/node-runner.server.test.ts:92` — `assert.ok(typeof env.PATH === "string" || typeof env.Path === "string" || true);`
  is `assert.ok(true)`; the `|| true` makes the platform check unconditional. Owner: **unowned this wave**.

The rule is a one-line addition to `findTautologies` once those two are fixed (a `|| true`
subject on an `assert.ok`); deferred deliberately, recorded here.

---

## G3 — module-coverage guard (R9-f05 / R9-f06)

### Landed

`scripts/check-module-coverage.mjs` — reachability guard. Start from every test file
(`src/lib/**/*.test.ts` + `scripts/**/*.test.mjs`), follow static imports, re-exports, dynamic
`import()` and `require()` (incl. the `@/` alias) through the `src/lib` graph, and report every
module nothing reaches. A module with zero reaching test **fails** unless it is on an explicit,
per-entry-reason allowlist.

Live result: **100/121 `src/lib` modules reached by a test · 21 allowlisted · 0 unallowlisted.**
`node scripts/check-module-coverage.mjs` → **exit 0**; a NEW uncovered module → exit 1.

Enforcement: `scripts/check-module-coverage.test.mjs` (6 tests, Node 22 6/6) runs it in-process
and via the CLI, so a new uncovered module fails `npm test`. Deliberately NOT folded into
`gate.sh` (its verdict JSON shape is pinned by `gate-verdict.test.mjs`); the test is the gate.

### RED-first teeth

Test 1 plants a temp `src/lib` tree with `orphan.ts` (no importer) plus a directly-, a
transitively- and a dynamically-imported module (and a `@/`-aliased one), and asserts
`orphan.ts` is the ONLY gap. Test 2 proves a planted gap is never silently on the repo allowlist.

### T5.2-A honesty-surface gap — REPORTED, not fixed

`src/lib/fixtures.review.ts` + `src/lib/fixtures.server.ts` (the read-only "fixtures review"
surface, backed by the pure parsers in `fixtures.ts`) are reached by **no test** — the only
importer is `console.tsx:72` (UI, untested). The guard prints them as allowlisted with the
reason "no lane in the W45 table owns this surface — recorded for the next wave, not exempted
as correct." `fixtures*.ts` is unowned in the lane table → **not edited**. Owner: parent / next wave.

Allowlisted gaps (21, all unowned this wave): `fixtures.review.ts`, `fixtures.server.ts`,
`auth/*` (14), `app-data/index.ts`, `db.ts`, `error-component.tsx`, `multiplayer/index.ts`,
`multiplayer/p2p.ts`.

---

## G4 — flake hunt (bounded)

The 330-5 log records the exact observation: first host-Node-24 run `# tests 374 / # pass 373 /
# fail 1`, name not captured, then 374/374 on the next two host runs and the pinned Node 22 run.

Conditions tried here (`node --test --test-reporter=tap "scripts/**/*.test.mjs"`):

| # | runtime | result |
|---|---|---|
| 1 | host Node 24.15.0 | 392 tests / 392 pass / 0 fail / 0 skipped, exit 0 |
| 2 | host Node 24.15.0 | 392 / 392 / 0, exit 0 |
| 3 | host Node 24.15.0 | 393 / 393 / 0, exit 0 |
| 4 | host Node 24.15.0 | 393 / 393 / 0, exit 0 |
| 5 | pinned Node 22.23.2 | 393 / 393 / 0, exit 0 |

Count 392 to 393 is this lane adding its own tests between runs, not a suite change.

Plus **6 targeted repeats** of the two most timing-sensitive scripts suites
(`with-app-env.test.mjs` + `cli-run-busy.test.mjs`): 22/22 pass, 0 fail, every run (132
test-runs total).

**Verdict: NOT reproduced.** The failing test name from 330 was never captured, so no fix is
possible without fabricating one. Candidates if it recurs (real timers / wall-clock waits, all
green here): `scripts/with-app-env.test.mjs:219-264` (poll loop with a deadline, `sleep(4000)`
race, `sleep(400)`/`sleep(900)` real waits) and `scripts/cli-exit-taxonomy.test.mjs:422/447`
(20 s deadline + real timer — 331-1's file). Recommended next instrument: run the leg with
`--test-reporter=tap` under `--test-concurrency=1` and capture the `not ok` name.

---

## G5 — defect sweep of this lane's script files

- **Silent catches.** Every catch in the files this lane owns is either documented best-effort
  (telemetry `run-eval.mjs:137`, corrupt-history `:516`, promotion `:2095`, crash tombstone
  `:3255`, `/proc` races in `preview.mjs`, `taskkill` fallback `with-app-env.mjs`) or has
  nowhere to report (a rollback whose connection died, `migrate.mjs:111`). No undocumented
  swallow found. `rapidtool-cli.mjs` has 11 empty catches — **331-1's file, reported only**.
- **Fail-open guards — one real fix.** `with-app-env.mjs` `isMainModule` returned `false` when
  `realpathSync(argv[1])` threw — which turns every `if (isMainModule(...)) main()` into a
  SILENT no-op (exit 0, nothing run). Now retries from its own path, then falls back to the raw
  compare (fail closed). `with-app-env.test.mjs` 16/16 after.
  Also fixed in this lane's own guards: `check-assertion-gaps.mjs` `listTestFiles`/`lintFiles`
  silently skipped unreadable dirs/files (a lint cannot certify a file it never read) — they now
  surface the path and exit 2; `check-module-coverage.mjs` walk/reachability does the same.
- **`shell:true` without `--ignore-scripts` (R11-f02).** No `shell:true` and no
  `npm ci|install` anywhere in `scripts/**`. The R11-f02 site is
  `src/lib/compile-check.server.ts` — **331-3 Transit, reported only**.
- **Lexical path guards (R11-f07 / R11-f06).** `write-atomic.mjs` and `browser-guard.mjs`
  already carry the shared physical-containment helper (`path-safety.mjs`
  `physicalInside`/`relativeEscapes`) from earlier waves; verified, no fail-open left.
  `rapidtool-cli.mjs:2445` still does a bare lexical `startsWith` prefix check — **331-1,
  reported only**.
- **Valueless-flag asymmetry.** 330-5 §5.2's six verbs live in `rapidtool-cli.mjs` — **331-1's
  file, not touched**.

---

## Verdict / tests added

| artifact | tests | Node 22 | Node 24 |
|---|---|---|---|
| `scripts/typecheck-scripts.test.mjs` (new) | 4 | 4/4 | 4/4 (in leg) |
| `scripts/check-module-coverage.test.mjs` (new) | 6 | 6/6 | in leg |
| `scripts/check-assertion-gaps.test.mjs` (extended) | 25 | 25/25 | in leg |
| `scripts/with-app-env.test.mjs` (regression after fix) | 16 | 16/16 | — |

Full scripts leg after every edit: **Node 22 393/393/0 fail, exit 0**; host Node 24 393/393/0
fail, exit 0. Guards on the live tree: `check-assertion-gaps` clean (121 files, 0 findings),
`check-module-coverage` 100/121 reached + 21 allowlisted + 0 unallowlisted.

**G1 partial (capability landed, 173 budgeted errors remain, npm-script wiring BLOCKED on
`package.json`)** · **G2 done (RED-first proven)** · **G3 done (guard + allowlist + honesty gap
reported)** · **G4 not reproducible (conditions recorded)** · **G5 one real fail-open fixed,
three cross-lane items reported**.
