# 327 L1 — P6 journey / wild lifecycle

**Lane 1 of the W44+ 5-lane bug-fixing wave.** Owned files: `src/lib/{headless,engine,dod}.ts`
(+ their `.test.ts`), `src/lib/wild-seal.test.ts`, `src/lib/lesson-writers.test.ts`.
This log is append-only; its only writer is this lane.

## 0. Setup / environment facts (verified)

- Repo: `C:\Users\mnril\Desktop\RapidTool Main`, branch `main`, real git repo.
- Pinned runtime used for every command: `C:\Users\mnril\AppData\Local\hermes\node\node.exe`
  → `v22.23.2` (`node --version`). Host default `node` is v24.
- **Host env fact (root cause, see §2):** `DEEPSEEK_API_KEY` is set in the **User** scope of
  this Windows box (length 35, `sk-b1de…42ff`). Every spawned node process inherits it.

## 1. Reproduction under pinned Node 22 (key present, as the host ships)

```
Set-Location "C:\Users\mnril\Desktop\RapidTool Main"
& "C:\Users\mnril\AppData\Local\hermes\node\node.exe" --experimental-strip-types --test --test-reporter=tap "src/lib/wild-seal.test.ts"
```
Observed: `# tests 14 / # pass 9 / # fail 5` — fail sites `:93`, `:114`, `:142`, `:201`
(`actual: 'paused', expected: 'advanced'`) and `:323` (`7 !== 13`). Exactly the parent's report.

```
& "…node.exe" --experimental-strip-types --test --test-reporter=tap "src/lib/lesson-writers.test.ts"
```
Observed: `# tests 25 / # pass 24 / # fail 1` — `not ok 4 - L5 — run-summary lesson at headless run completion`.

```
& "…node.exe" --experimental-strip-types --test --test-reporter=tap "src/lib/headless.test.ts"
```
Observed: `# tests 113 / # pass 106 / # fail 7` — `not ok 11 fixes/144 (M4-1)`, `not ok 17
end-to-end round-trip`, `not ok 22 E-25 CLI machine contract`, `not ok 28 185-H1 wild lifecycle`.

## 2. ROOT CAUSE — the host `DEEPSEEK_API_KEY` turns every "keyless" pin keyed

Direct evidence (`Remove-Item Env:DEEPSEEK_API_KEY` in the shell, then re-run):

| suite | key present | key cleared |
|---|---|---|
| `wild-seal.test.ts` | 14 tests, 5 fail | **14 / 14 pass** |
| `lesson-writers.test.ts` | 25 tests, 1 fail | **25 / 25 pass** |
| `headless.test.ts` | 113 tests, 7 fail | **113 / 113 pass** |

Mechanism: `emptyProject` defaults `enforceDod` to `keyedDeepSeekConfigured()`
(`src/lib/engine.ts:1877`, default applied at `:1967-1968`). With the host key present the
fixtures are created with `enforceDod === true`, so:

- `wildStep`'s post-approval hard-DoD check (`engine.ts:4492`) fires and parks the fixture
  ("P0 DoD unmet — hard gate blocks advance") instead of advancing → `'paused' !== 'advanced'`
  at §S1/§S3, and the §S5 full run parks at P6 (7 steps, not 13).
- `lesson-writers` `drainToComplete` never reaches completion.
- `headless` `drainToComplete` never reaches a red-gate *complete*, so fixes/144, the
  round-trip, E-25 and 185-H1 all fail at their keyless preconditions.

The suites themselves declare the keyless premise in their headers ("Keyless + fully injected
reviewer: no DEEPSEEK_API_KEY", `wild-seal.test.ts:5-6`; "deterministic, no keys, no network",
`lesson-writers.test.ts:4-5`) and `headless.test.ts:122-124` documents the exact hazard
("a keyed dev shell never leaks state") — but only around individual tests, never for the file.
So the defect is **non-hermetic keyless suites**: they depend on the host env being keyless
without enforcing it.

## 3. Verdicts vs the three hypotheses

- **(a) 326 F1b gate-repair diversion** — NOT the cause. That change lives in
  `driveP6Journey` (`headless.ts`); the failing assertions run through `wildStep`
  (`engine.ts`), which the diff does not touch, and `headless.test.ts` is 113/113 with the key
  cleared (its `driveP6Journey` fake-deps tests included).
- **(b) T-14 (`phases.ts:126-132`, linear `canEnter`)** — NOT the cause. Keyless, §S5 completes
  in exactly 13 steps: P7–P12 execute. The "7 steps" is the keyed hard-DoD park at P6.
- **(c) pinned expectation change** — NO. Every pin is correct as written; none changed.

**Fix:** isolate the three keyless suites from the host key at process start (module scope),
matching the repo's own save/restore convention (`deepseek.server.test.ts:21-26`,
`gates.test.ts:798-806`) and `node --test`'s per-file child-process isolation. No assertion
was weakened, no test deleted.

## 4. Changes (all three are test-hermeticity only; no production logic touched)

1. `src/lib/wild-seal.test.ts:36` — after the imports, added:
   ```ts
   delete process.env.DEEPSEEK_API_KEY;
   ```
   (comment: "fix 327 L1 — non-hermetic keyless suite … engine.ts:1967"). Restores the
   declared keyless premise; `node --test` per-file child isolation means no other suite is
   affected.
2. `src/lib/lesson-writers.test.ts:29` — same one-liner after the `await import("./knowledge.ts")`.
3. `src/lib/headless.test.ts:61` — same one-liner after the imports (the two create-default pins at
   `:125`/`:138` set/restore their own key and still exercise both branches; `runCli` already
   forces the CLI children keyless at `:1669`).

No assertion was changed, weakened, or deleted. No production file in this lane needed a change:
`wild-seal`, `lesson-writers`, `headless`, `engine` were all correct; the failures were purely
the host env. `engine.test.ts` (10/10) already passed keyed and was left untouched.
`src/lib/dod.test.ts` **does not exist** in the tree (no such file) — nothing to run there.

### 326 F1b status (the uncommitted wave this lane inherited)
The uncommitted `driveP6Journey` gate-repair diversion is **complete and correct**, not the
cause of any measured failure: `headless.ts` owns the diversion + `p6CycleLiveDeps` mapping +
`gateRepairContextOf`; `engine.ts` forwards `LiveLayerDeps.gateRepair` into `liveP6Synthesis`;
`codegen.server.ts` (sibling lane) has the reader (`withGateRepairContext`, :1073/:2963/:3096/
:3430). Its own pins are in the tree and pass:
`--test-name-pattern="326 F1b"` → `# tests 3 / # pass 3 / # fail 0`.
No change was required in `headless.ts`/`engine.ts`.

## 5. Verification (pinned Node 22 = `…\hermes\node\node.exe` v22.23.2)

Host key present in **every** run below (fresh shell inherits the User-scope var; the command
echo confirmed `KEY PRESENT (len 35)`), i.e. these are the green results **with the pollution in
place** — the fix, not the env, is what makes them pass.

```
& "…node.exe" --experimental-strip-types --test --test-reporter=tap "src/lib/wild-seal.test.ts"
  # tests 14 / # pass 14 / # fail 0
& "…node.exe" --experimental-strip-types --test --test-reporter=tap "src/lib/lesson-writers.test.ts"
  # tests 25 / # pass 25 / # fail 0
& "…node.exe" --experimental-strip-types --test --test-reporter=tap "src/lib/headless.test.ts"
  # tests 113 / # pass 113 / # fail 0
& "…node.exe" --experimental-strip-types --test --test-reporter=tap "src/lib/engine.test.ts"
  # tests 10 / # pass 10 / # fail 0   (unchanged, keyed-safe)

& "…node.exe" "node_modules/typescript/bin/tsc" --noEmit
  TSC_EXIT=0
```

Joint invocation (the way `npm test` runs them together — key present):

```
& "…node.exe" --experimental-strip-types --test --test-reporter=tap \
    "src/lib/headless.test.ts" "src/lib/wild-seal.test.ts" "src/lib/lesson-writers.test.ts"
  # tests 152 / # pass 152 / # fail 0
```

## 6. Root causes I could NOT fix (report, out of lane)

- **Repo-level, not a lane file:** the keyless `src/lib` suite is only keyless by host
  convention. `package.json`'s `test` script (`node --test … "src/lib/**/*.test.ts"`) does not
  strip a host `DEEPSEEK_API_KEY`, and `scripts/gate.sh` does not either (grep: no
  DEEPSEEK/unset). So on THIS box the full `npm test` / `gate.sh` would run **keyed** and go red
  well beyond this lane. The durable fix belongs in `package.json`/`scripts/*` (e.g. a shared
  test preload that clears the key) — **outside my owned files, so I did not touch it.** My lane
  fixed its own suites defensively.
- **`src/lib/phases.ts` (T-14):** not implicated by any measured failure; `canEnter` was not
  touched and needs no change for these pins. (Keyless §S5 = 13 steps proves P7–P12 execute.)

