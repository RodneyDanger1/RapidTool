# fixes/217d — W11 · L1: verify-kind install-leg tests + T-18 `tree-run` build verdict

**Task ids:** T4.1 test debt (verify-kind install leg) · T-18 (`tree-run` `build` verdict)
**Lane:** W11 · L1 (software engineer). **Owned files:** `src/lib/compile-check.server.ts`,
`src/lib/compile-check.server.test.ts`. **Status: COMPLETE** (only the two owned files + this log written).

## 1. Baseline (measured before any edit)

- `wc -l src/lib/compile-check.server.test.ts` → **796** (after: **1011**)
- `wc -l src/lib/compile-check.server.ts` → **1418** (after: **1454**)
- Pre-edit test count, measured: `node --experimental-strip-types --test --test-concurrency=2 src/lib/compile-check.server.test.ts`
  → `# tests 34 / # suites 6 / # pass 34 / # fail 0 / # cancelled 0 / # skipped 0` (duration_ms 132977.55) — green baseline.

## 2. Install-leg tests added (T4.1 debt) — `src/lib/compile-check.server.test.ts`

All new verify-kind tests ride the documented `opts.installCommand` seam (default suite: no network, no real npm),
and each pins the honesty markings. Added inside the existing `describe("B1 verifyKindDir")` (the parent's two
repaired tests are untouched and still pass):

- `:821` — seam install exit 0 → `install.run === "pass"`, `install.mocked === true`, `install.tool === "seam"`,
  `install.reason` carries the NOT-evidence warning, and the declared build **really ran** (a sentinel file written
  by the build script via an absolute path proves execution, not merely an exit code). Also asserts the subject
  dir's file list is byte-identical before/after + `package.json` unchanged (the scratch copy is the point).
- `:854` — seam install exit ≠ 0 (`process.exit(3)`) → `install.run === "fail"`, `exitCode === 3`, `ok === false`,
  `code === "RT_E_VERIFY_KIND_FAILED"`, and build+test **short-circuited** as `skip` with no claimed command and the
  exact reason asserted (`install did not complete (fail) — … was NOT executed … fix the install failure and re-run`).
- `:884` — seam install that never exits (`setTimeout(() => {}, 60_000)` command) with `installTimeoutMs: 4000` →
  `install.run === "timeout"`, coded failure, bounded (asserted elapsed < 30 s; observed ≈4 s).
- `:905` — `installToolFor(dir)`: lockfile present → `npm ci` / `npm ci --no-audit --no-fund`; absent → `npm install`
  / `npm install --no-audit --no-fund` (pure fs, no network). (`installToolFor` was already exported — no export change.)
- `:924-946` — **opt-in real npm leg** gated behind `RT_VERIFYKIND_INSTALL=1` (`{ skip: process.env.RT_VERIFYKIND_INSTALL !== "1" }`):
  absent the env var it is a TAP `# SKIP` — never a fake pass, never network. With the env var: real `npm install`
  (no seam: `install.mocked === undefined`, `install.tool === "npm install"`) + declared build pass + `ok === true`.

## 3. T-18 `tree-run` `build` verdict — `src/lib/compile-check.server.ts`

- `:340-347` — `TreeProjectScriptsVerdict.build?: TreeProjectScriptVerdict`, same shape as `typecheck`/`test`
  (script/command/run/exitCode/detail/durationMs/note); **optional** so existing fixture objects in sibling lanes
  (e.g. `headless.test.ts:753`) stay assignable — `treeRun()` always sets it.
- `:901-921` — `runProjectScripts`: the declared `build` is executed **only when the tree's deps are present**
  (`existsSync(join(work, "node_modules"))`; the run copy mirrors the subject). Without them: `run:"skip"` with the
  command carried verbatim plus the exact UNVERIFIED note pattern — `no node_modules/ present in the tree —
  "npm run build" was NOT executed; the tree's own build is UNVERIFIED (npm install, then re-run to verify) — not a
  fabricated pass`. `red`/`skippedDeclared` now include build → a red build makes `project.ok`/`tree.ok` false and
  sets the top-level `error`; a dep-less skip is a loud top-level note, never red.
- Doc comments updated to match the behaviour: `:244-252` (mode block), `:301-313` (verdict type), `:365-370`
  (`project?` field), `:930-938` (`treeRun` docstring), `:1001-1006` (inline leg comment).
- Deliberately untouched (and asserted so): `run.kind:"ui-shell" → skip` (`:743`) byte-identical; no
  "verified"/"E2E" wording anywhere new; `install.mocked`/seam-reason honesty strings unchanged and now test-pinned.
- New tests (default suite, no network): `describe("217d T-18 — the emitted project's own build script")` at `:696` —
  (a) `:709` no `node_modules` → `build.run === "skip"` + UNVERIFIED note + loud top-level note, `ok:true`;
  (b) `:732` deps present + build exits 0 → `build.run === "pass"`, `exitCode === 0`, sentinel proves execution,
  subject listing unchanged; (c) `:756` deps present + build exits 2 → `build.run === "fail"`, `exitCode === 2`
  preserved, detail carries the script's own failure line (`BUILD-9001`), `tree.ok === false`, top-level error
  names `npm run build`.

## 4. Verification (real commands + real output tails)

1. Pre-edit baseline (above): 34/34 pass (run before the first edit).
2. Post-edit: `node --experimental-strip-types --test --test-concurrency=2 src/lib/compile-check.server.test.ts`
   → `EXIT=0`; tail: `# tests 42 / # suites 7 / # pass 41 / # fail 0 / # cancelled 0 / # skipped 1 / # todo 0`
   (duration_ms 94976.68). The 1 skip is the opt-in gate (TAP: `ok 7 - 216z opt-in: … # SKIP`).
   **Old → new: 34 → 42 tests (41 run + 1 opt-in skip), 0 fail.**
3. Opt-in real path: `RT_VERIFYKIND_INSTALL=1 node --experimental-strip-types --test --test-concurrency=2
   --test-name-pattern="REAL npm install leg" src/lib/compile-check.server.test.ts` → `EXIT=0`;
   `# tests 1 / # pass 1 / # fail 0 / # skipped 0` (duration_ms 10867.25; the leg itself 8646.36 ms — real
   `npm install --no-audit --no-fund` on a zero-dependency tree, no seam, `ok:true`).
4. `npm run typecheck` → `EXIT=0`; output only the two npm notices (`npm notice run typecheck` /
   `npm notice run tsc --noEmit`) — **no tsc diagnostics**; run once at the very end over the tree as found
   (`git status`: 12 sibling-modified files + my two; none of my files reported).
5. Re-confirmation run (fresh, same command as (2), same post-edit bytes): `EXIT=0`;
   `# tests 42 / # suites 7 / # pass 41 / # fail 0 / # cancelled 0 / # skipped 1` (duration_ms 40825.01) —
   the green reproduces. (`grep "not ok"` hits in the TAP capture are the *title* of an existing green test —
   "…makes the tree not ok…" — not failures; the `# fail 0` summary is authoritative.)
6. Not run, by explicit lane rule: `npm test` / `npm run build` (siblings mid-edit; memory-tight host), a second
   `npm run typecheck` (the brief allows it **at most once** — consumed by (4)), and `hermes verify` (RESUME §5.2:
   its recipe runs `prettier --write .` and would silently reformat the whole repo).

## 5. Not done / limitations (plain)

- `npm test` and `npm run build` were **not** run (lane rule; siblings mid-edit on this memory-tight host).
- `headless.ts`'s `treeRunFailureTail` (L4-owned) scans only `project.typecheck`/`project.test` when naming a red
  project script; a red **build** rides `outcome.error`, which that same function reads first — so the journey tail
  still names it, but the scan list itself is out of my lane and was **not** changed (flagged for the parent).
- The build gate keys on `node_modules/` presence in the run copy; a tree with a deps dir but an unresolvable tool
  still gets the pre-existing tool-resolvability skip (unchanged semantics, already test-pinned).
- The opt-in real-install test was executed once here (with the env var) and passed; it stays skipped in the default
  suite by design. Nothing else in the suite touches the network.
- Only my two owned files + this log were written; every other modified file in `git status` belongs to sibling lanes.
