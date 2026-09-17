# 211 G2 — treeRun / node-runner residual honesty (Phase F leftovers)

**Lane:** compile-check + node-runner only — `src/lib/compile-check.server.ts`,
`src/lib/compile-check.server.test.ts`, `src/lib/node-runner.server.ts`,
`src/lib/node-runner.server.test.ts`.
`sandbox.ts` imported read-only (`maskLiteralsAndComments`); not edited.

**Out of scope (untouched):** headless / store / engine / CLI / README / product
job modules. No live DeepSeek.

treeRun already copy-to-temp (200). 192 already split skip-green for UI shells.
Oracle vacuity (A3) already existed. This pass is residual honesty only.

## Residuals found + landed

### 1. treeRun subject purity — `compile.dir` leaked the temp copy

**Broken:** `outcome.dir` was the subject (200), but `compileCheckDir(work)` ran
on the `rt-treerun-*` copy and `compile.dir` kept that path. After the `finally`
delete, operators/tests looking at `compile.dir` saw a ghost.

**Landed:** rewrite `compile.dir` to the resolved subject on every treeRun
return (copy-fail path already used subject).

Purity pin extended past listing-only: a spec that `writeFileSync`s `src/main.ts`
in cwd mutates the **copy**; subject bytes stay original.

### 2. skip ≠ green for headless — UI-shell kind leak

**Broken:** `index.html` skip used `kind: label || "ui-shell"`. A record
`kind: "app"` became `"webapp"`, so `entryGreen` (`skip && kind === "ui-shell"`)
went false — a real UI shell was not green. Conversely `!outcome.run` treated a
missing entry verdict as green (fail-open).

**Landed:**

- `index.html` skip is always structural `kind: "ui-shell"` (record kind does
  not leak into the skip classification).
- `entryGreen` is fail-closed: missing `run` is not green. Headless skip stays
  not green (192 pin unchanged). Only executed `pass` or UI-shell skip counts.

### 3. Honest `sandbox: false` on the runner path

**Broken:** comments said the runner is not a security sandbox (207 froze
`runnerIsolationClaim()`), but `runNodeBounded` / `treeRun` envelopes did not
carry `sandbox: false`. Callers could assume isolation the product does not have.

**Landed:**

- `NodeRunResult = NodeRunCore & { sandbox: false }` — `withSandbox()` stamps
  every return (ok / refused / timeout / error / not-configured).
- `TreeRunOutcome.sandbox?: false` — optional so sibling fixtures stay
  assignable; `treeRun()` always sets `false`.

This is advertising, not a new isolator. Copy-to-temp is emit-tree isolation,
not Docker/bwrap.

### 4. No fake pass on empty oracles — strings were not stripped

**Broken:** A3 claimed "comments/strings are stripped first" but
`specSourceHasAssert` only stripped comments. A load-only `test()` whose body
was `const s = "assert.equal(1, 1)"` could mint green (`TAP # pass 1` + source
regex hit).

**Landed:** `specSourceHasAssert` uses `maskLiteralsAndComments` (existing
sandbox helper). Empty `oracle.spec.ts`, commented-only assert, and
string-quoted assert all fail `no behavioral assertion ran`.

## Tests

```text
node --experimental-strip-types --test \
  src/lib/node-runner.server.test.ts \
  src/lib/compile-check.server.test.ts
# 35/35 pass (0 fail). Full npm test / gate.sh not run (per task).
```

New pins: string-quoted assert, empty oracle, commented assert, UI-shell +
`kind:app` still green skip, subject-body purity + `compile.dir` not
`rt-treerun-*`, `sandbox: false` on ok and refused runner envelopes.

## Files touched

| File | Action |
|------|--------|
| `src/lib/compile-check.server.ts` | subject `compile.dir`; UI-shell kind; fail-closed entryGreen; string-mask A3; `sandbox: false` |
| `src/lib/compile-check.server.test.ts` | purity / skip / empty-oracle / sandbox pins |
| `src/lib/node-runner.server.ts` | `withSandbox` on every envelope |
| `src/lib/node-runner.server.test.ts` | `sandbox: false` on ok + refused |
| `fixes/211_g2_treerun_runner_honesty.md` | this log |

## Honest leftover (out of lane)

- `packet.ts` / `engine.ts` still advertise `isolated: true` on the
  engine-template sandbox object (207 parent residual).
- Headless `driveP6Journey` fixtures may still construct a green skip with
  `kind: "library"` — those are fake-deps, not `treeRun()`.
- `TreeRunOutcome.sandbox` is optional so those fixtures typecheck without a
  headless edit.
