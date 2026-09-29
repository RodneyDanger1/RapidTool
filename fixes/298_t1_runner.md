# fixes/298 — T1: the node-runner reds (stale stdout-cap pin vs the W-26 kill contract)

HEAD at open: `3ebea43` (tree clean on entry). Task: fix the node-runner reds from the
2251/2242/8 FAIL barrage, re-run FOREGROUND to green, log evidence. Barrage-verbatim reds:

1. `not ok 8 - caps runaway stdout to the last 1 MB slice (no unbounded memory)`
2. `not ok 181 - runNodeBounded (harmless local fixture)`

Both live in `src/lib/exec.test.ts` (grepped: the two names appear nowhere else).

## Diagnosis

- Standalone `node --experimental-strip-types --test src/lib/exec.test.ts` → **19 tests,
  18 pass, 1 fail**. The single failing subtest is #8 `caps runaway stdout ...`
  (`res.ok` false !== true, exec.test.ts:282). Red #2 is the **suite wrapper**
  (`runNodeBounded (harmless local fixture)`, `error: '1 subtest failed'`) — node's TAP
  numbers suites at the merged top level (181 across the ~110-file src leg) and subtests
  locally (8 inside the suite), which is exactly why the tap listed both.
- Product probe (direct `runNodeBounded` calls):
  - `process.stdout.write("y".repeat(1500000))` → `{"ok":false,"reason":"error",
    "code":"RT_E_RUNNER_FAILED","error":"killed: output exceeded the 1 MB cap
    (1048576 bytes written)","sandbox":false}` — the W-26 streaming kill fires as designed.
  - `console.log("rapidtool-echo-ok")` → `{"ok":true,"exitCode":0,
    "stdout":"rapidtool-echo-ok\n",...}` — **the harmless small-output path does NOT
    regress** (the suite red is purely the wrapper of the caps subtest; all 8 other
    subtests of that suite pass standalone).
- Verdict: **stale pin, not a product bug.** `fixes/292_l1_register.md` §W-26 (line 35)
  owns the new contract: streaming byte counter + tree-kill past `MAX_BUFFER` + the coded
  `RT_E_RUNNER_FAILED · "killed: output exceeded the 1 MB cap (N bytes written)"` — a
  1.5 MB writer must now FAIL with the coded bomb message, never "pass" with a trimmed
  last-1 MB slice. The old pin asserted the pre-W-26 capping behavior (`res.ok === true`).
- Only surface carrying the stale behavior: this one pin (repo-wide grep for
  `last 1 MB slice` / `output exceeded` → source + this test; no docs promise capping).

## Change

- `src/lib/exec.test.ts:280` — pin re-pointed to the W-26 truth, asserting MORE (the old
  slice assertions were weaker): ok:false + reason `error` (not a timeout masquerade) +
  `RT_E_RUNNER_FAILED` + exact coded message with a parsed byte count bounded to
  (1_000_000, 1_500_000] — i.e. it must report the kill past the cap and can never claim
  more bytes than the child ever wrote + the failure envelope exposes NO `stdout` field
  (no output leak on the bomb path).

## Evidence

- `src/lib/exec.test.ts:280-290` → before: `assert.equal(res.ok, true)` + stdout slice
  ≤1 MB tail checks → after: bomb-kill assertions (ok:false / reason error / code /
  `(\d+) bytes written` >1_000_000 and ≤1_500_000 / no stdout key) → why: W-26 landed the
  streaming kill (fixes/292 §W-26); the pin still asserted the pre-W-26 silent-cap pass.
- Re-run FOREGROUND: **`node --experimental-strip-types --test src/lib/exec.test.ts` →
  19 tests / 19 pass / 0 fail**, three consecutive runs identical. Parallel-load batch
  (`exec` + `sandbox` + `sandbox-policy` + `zero-byte-guard`) → **54 tests / 0 fail** —
  the harmless fixture holds under load. `npm run typecheck` exit 0; `npm run lint`
  0 errors (5 pre-existing warnings in other agents' probe files; none in exec.test.ts).
- Caveat (honest): the full src leg was NOT re-run here — other wave agents are
  mid-edit on their own files (`git status`: `M scripts/rapidtool-cli.mjs`, their
  untracked probes), and the aggregate gate belongs to the wave boundary. The file +
  its siblings are green; the barrage pair is resolved.

## Final table

| Red (tap-verbatim) | Root cause | Action | State |
|---|---|---|---|
| `not ok 8 - caps runaway stdout to the last 1 MB slice (no unbounded memory)` | stale pin — asserted the pre-W-26 silent cap (`ok:true` + trimmed slice); W-26 made a >1 MB writer a KILL | re-pointed pin, asserting MORE: ok:false + reason `error` (never a fake timeout) + `RT_E_RUNNER_FAILED` + exact coded message with parsed byte count in (1_000_000, 1_500_000] + no `stdout` key on the bomb envelope | GREEN |
| `not ok 181 - runNodeBounded (harmless local fixture)` | suite wrapper of the SAME subtest #8 (`error: '1 subtest failed'`) — node TAP numbers suites at the merged top level and subtests locally. NOT a product regression: direct probe of `console.log(...)` → `ok:true`, and the suite's other 8 subtests pass | none needed | GREEN |

Status: DONE.

