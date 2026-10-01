# 327 — Lane 3: runtime-pin fix for the `--test-name-pattern` guard

Owned files: `scripts/test-name-pattern-guard.test.mjs`, `AGENTS.md`.
Landing log author: Lane 3 (sole writer).

## 1. Task

Make `scripts/test-name-pattern-guard.test.mjs` deterministic and honest across the
repo's documented Node 22 and the host's new default Node 24.

## 2. Observed runtime difference

Host default `node` is now **v24.15.0** (`node --version`); the pinned binary is
`C:\Users\mnril\AppData\Local\hermes\node\node.exe` → **v22.23.2**.

**What changed:** the DEFAULT reporter of the `node --test` child. In `runFixture()` the
grandchild was spawned as `node --test [--test-name-pattern=…] <file>` with NO reporter
flag, so it inherited the runtime default:

- Node 22.23.2 default → **TAP**  (`1..0`, `ok 1 - …`, `# pass 1`)
- Node 24.15.0 default → **spec** (`✔ …`, `ℹ tests 1`, `ℹ pass 1`)

Raw bytes of the child output on Node 24 (spec default, no-match filter) — captured from
the failing run's `actual`:

```
✔ C:\Users\mnril\AppData\Local\Temp\rt-name-pattern-guard-neUo8K\guard_fixture.test.mjs (1369.2747ms)
ℹ tests 1
ℹ suites 0
ℹ pass 1
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1427.8725
```

Raw bytes of the child output on Node 22 (TAP default, no-match filter):

```
TAP version 13
1..0
# Subtest: C:\Users\mnril\rt327_probe\guard_fixture.test.mjs
ok 1 - C:\Users\mnril\rt327_probe\guard_fixture.test.mjs
  ---
  duration_ms: 304.2018
  type: 'test'
  ...
1..1
# tests 1
# suites 0
# pass 1
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 333.2242
```

**The trap's SHAPE did not change on Node 24.** It is still exit 0 and still masks the
failing file (case 1 `r.status === 0` and `!out.includes(RED)` hold). Only the default
*reporter format* changed, which broke the two assertions that hard-coded TAP lines
(`^1\.\.0$` and `^ok 1 - guard fixture green case$`) against a child that was NOT told to
emit TAP.

## 3. The change (old → new)

`runFixture()` child args — make the reporter explicit (matching `npm test` and
`scripts/gate.sh`, both of which already pass `--test-reporter=tap`):

old:
```js
const args = ["--test", ...(pattern === null ? [] : [`--test-name-pattern=${pattern}`]), file];
```
new:
```js
const args = [
  "--test",
  "--test-reporter=tap",
  ...(pattern === null ? [] : [`--test-name-pattern=${pattern}`]),
  file,
];
```

Reason: `--test-reporter=tap` is a test-runner *default* on 22 and *not* the default on 24;
passing it explicitly makes the assertion target deterministic. No assertion is weakened.

Header comment + `AGENTS.md` note updated together, as the file itself instructs.

## 4. Verification (both runtimes)

### Before the fix (parent-reproduced, re-run here)

| runtime | command | result |
|---|---|---|
| Node 24.15.0 | `node --test --test-reporter=tap "scripts/test-name-pattern-guard.test.mjs"` | **exit 1** — `# tests 3 / # pass 1 / # fail 2`; THE TRAP fails `zero subtests ran`, THE RECIPE fails `match output: the recipe reports RAN`; CONTROL ok |
| Node 22.23.2 | `& "C:\Users\mnril\AppData\Local\hermes\node\node.exe" --test --test-reporter=tap "scripts/test-name-pattern-guard.test.mjs"` | **exit 0** — `# tests 3 / # pass 3 / # fail 0` |

### After the fix (exact brief commands)

| runtime | command | result |
|---|---|---|
| Node 24.15.0 | `node --test --test-reporter=tap "scripts/test-name-pattern-guard.test.mjs"` | **exit 0** — `# tests 3 / # suites 0 / # pass 3 / # fail 0` |
| Node 22.23.2 | `& "C:\Users\mnril\AppData\Local\hermes\node\node.exe" --test --test-reporter=tap "scripts/test-name-pattern-guard.test.mjs"` | **exit 0** — `# tests 3 / # suites 0 / # pass 3 / # fail 0` |

Raw TAP tail, Node 24 after fix:

```
1..3
# tests 3
# suites 0
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3164.1982
```

Raw TAP tail, Node 22 after fix:

```
1..3
# tests 3
# suites 0
# pass 3
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2696
```

## 5. Honesty / teeth check

- The pin still has teeth: **before** the fix, Node 24 was genuinely RED (2/3 fail) on the
  unpinned child; after the fix the same Node 24 is 3/3 green **because the reporter is now
  explicit**, not because an assertion was loosened or removed.
- The trap is real and identical on both runtimes (probe, `C:\Users\mnril\rt327_probe`):
  no-match filter exits **0** with `1..0` + `# pass 1`, RED test name absent; red-match exits
  **1**; unfiltered exits **1**. Nothing was faked.
- Assertions changed: **none**. Only the child spawn args changed (added
  `--test-reporter=tap`); all four existing `assert` calls are byte-identical to before.

## 6. Diff scope

`git diff --stat -- scripts/test-name-pattern-guard.test.mjs AGENTS.md` →
`2 files changed, 34 insertions(+), 9 deletions(-)`; `fixes/327_l3_runtime_pin.md` is new
untracked. No file outside the owned set was touched. No `git checkout/stash/reset/clean/commit`
was run; the full gate was not run.

