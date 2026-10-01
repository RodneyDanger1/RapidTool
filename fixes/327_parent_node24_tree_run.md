# 327 · PARENT — Node 24 tree-run reporter fix (single line)

**Actor:** the 327 wave parent (the 5-lane wave closed; this is parent repair of the
remaining out-of-lane red). **Tree:** working copy on `main` at `6924dde` + the 327 lanes.
**Runtime context:** the host's default `node` is **v24.15.0**; the repo's documented
runtime is Node **22** (`AGENTS.md`; pinned binary `%LOCALAPPDATA%\hermes\node\node.exe`,
v22.23.2).

## The defect (measured)

After the five lanes landed, the src leg was green under Node 22 but still had **16
failures under Node 24**, all in the emitted-tree execution path:

```
not ok 121 - treeRun — execute the emitted tree in-loop (fixes/144 M3/B3)
not ok 122 - 216 T-18 — the emitted project's own typecheck/test scripts
not ok 123 - 217d T-18 — the emitted project's own build script
not ok 130 - treeRun — the K3 substance marking rides the verdict (fixes/312_c6_ux)
not ok 131 - treeRun — the tree-declared expectedBehavior contract BITES (W44·A1 · K1-R1)
not ok 269 - E-25 — CLI machine contract (exit codes + envelope + doctor)
# tests 2560 / # pass 2534 / # fail 16
```

Representative assertion (`compile-check.server.test.ts:1337`):

```
the tree executes green — the marking qualifies it, it never fakes a red
false !== true
```

## Root cause

`specRunnerCode` (`src/lib/compile-check.server.ts:708`) generated the wrapper that runs one
emitted spec as `spawnSync(process.execPath, ["--test", spec])` and returned the child's
output tail. The tree-run then reads that tail with `parseTapSummary`
(`compile-check.server.ts:970`), which matches `^# pass (\d+)$` / `^# tests (\d+)$` — the
**TAP** summary — and `parseTapSummary`'s absence sets `noTapPass` (`:1088`), judging the
spec red.

`node --test`'s default reporter is **TAP** on Node 22 and **spec** (`ℹ tests 1`) on Node 24
(measured both ways). Under Node 24 the child emitted no `# pass` line, so **every emitted
spec read as "no TAP pass" and every green tree was judged red**. Same failure class as
327 L3's scripts-leg pin: an implicit reporter default.

Measured directly (minimal `.ts` spec, `node --test <spec>`):
- Node 22.23.2 → `TAP version 13` …
- Node 24.15.0 → `✖ … ℹ tests 2 / ℹ pass 0 / ℹ fail 1`

## The fix

`src/lib/compile-check.server.ts:708` — pin the reporter in the generated wrapper:

```js
r = spawnSync(process.execPath, ["--test", "--test-reporter=tap", spec], {
```

The wrapper is a **transient temp script** (`runNodeBounded(specRunnerCode(...))`, `:1055`),
not an emitted product artifact, so no generated-tree bytes change. `parseTapSummary` is the
only TAP-summary parser on this path (`cassette.ts`'s `parseTape` is unrelated).

## Verification (real output)

| check | Node 22.23.2 | Node 24.15.0 |
|---|---|---|
| `npm run typecheck` | exit 0 | exit 0 |
| `compile-check.server.test.ts` | exit 0 | exit 0 (was failing) |
| `headless.test.ts` | exit 0 | exit 0 (was failing) |

## Note for the owner

This is **not** a 327-lane defect and it is **not** introduced by this wave — it reproduces
at HEAD under Node 24. It is the last Node-24 incompatibility on the test surface. The repo's
contract names Node 22; running the gates with the pinned binary is the supported path.
