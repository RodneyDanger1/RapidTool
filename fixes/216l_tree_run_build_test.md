# fixes/216l — W3 · L2: T-18 — `tree-run`: "parses" → "the product builds and tests"

**Lane:** W3 · L2 · **Date:** 2026-09-16 · **Status: COMPLETE** — code + tests + verification all
green on disk (§4); cross-file doc-text handoff recorded in §6.

**Owned files (only these):** `src/lib/compile-check.server.ts` + `src/lib/compile-check.server.test.ts`,
`src/lib/headless.ts` + `src/lib/headless.test.ts`, `src/lib/node-runner.server.ts` ·
**Log (sole writer):** this file.

**Spec:** `research/multiagent/106_rapidtool_deep_analysis.md` §6 **T-18** (findings F-01/F-02/F-13):
*"`tree-run --dir` reports the emitted project's own `typecheck` and `test` exit codes alongside the
parse verdicts; a tree that fails its own `npm test` cannot be reported `ok: true`."*

**Settled constraints carried in:**
- `parseGateTreeRows` deliberately fails **open** — SETTLED, do not touch (docstring read only).
- The parent's `redTree: "probe"` at the internal candidate emit (`headless.ts:1619-1625`) is
  deliberate — do not revert.
- Keep every W2 test green: headless **83/83** (incl. T-07 ×4 + TA-2 ×5), compile-check baseline **28**.

---

## 1. Recon — every consumer of the outcome shape (before changing it)

`TreeRunOutcome` (`compile-check.server.ts:294`) is consumed by:

| # | Consumer | Reads | Additive-safe? |
|---|---|---|---|
| 1 | `compile-check.server.ts` `treeRun` (`:675`) | constructs the outcome | yes |
| 2 | `headless.ts` `treeRunFailureTail` (`:1568`) | `error`, `tests[].run/detail`, `run` | yes (new branch added) |
| 3 | `headless.ts` `defaultP6RunTree` (`:1616`) / `defaultRepairRunTree` (`:2093`) | build emit-failure outcomes (literal objects) | yes — new fields stay **optional** so these literals stay assignable |
| 4 | `headless.ts` `applyTreeRunTestedMint` (`:1667`) → `codegen.mintTreeRunTested` | `ok`, `tests`, `run`, `compile` | yes (`treeRunTestedEvidence` reads only those; a stronger verdict only narrows `ok`) |
| 5 | `headless.test.ts` fixtures `redVerdict`/`greenVerdict` (`:403`, `:579`) | literal objects | yes — optional fields |
| 6 | CLI `rapidtool-cli.mjs` `emit --run` (`:794-830`), `tree-run` (`:895-950`), `repair` (`:1020,1051`) | whole outcome on `payload.treeRun`; error bits from `error`/`tests`/`run` | yes — new fields ride the envelope; red project script is named via `error` |
| 7 | `scripts/run-eval.mjs` `treeRunToEvidence` (`:238`) | `ok`, `compile.ok`, `tests[].tests`, `error`/`detail` | yes — additive |

Cross-check: `research/eval-out/coffeehouse2home-property-ledger/package.json` declares
`"typecheck": "tsc --noEmit"` + `"test": "node --experimental-strip-types --test tests/oracle.spec.ts"`
and has **no `node_modules`** — so any policy must keep the emitted-but-uninstalled tree's verdict
honest (see Design §3 below).

## 2. Design (settled before coding)

### 2.1 New additive outcome fields (all optional → fixture literals stay assignable)

```ts
export type TreeProjectScriptVerdict = {
  script: string;        // "typecheck" | "test" — hardcoded names, never tree-controlled
  command?: string;      // the command verbatim from the emitted package.json
  run: TreeRunVerdict;   // pass | fail | error | timeout | skip  (skip ≠ pass, ever)
  exitCode?: number | null;
  detail?: string;       // bounded combined-output tail on a non-pass (named
                         // `detail`, consistent with TreeSpecVerdict/EntryVerdict)
  durationMs?: number;
  note?: string;         // honest reason a script did not run / how a red is read
};
export type TreeProjectScriptsVerdict = { ok: boolean; typecheck: …; test: … };
```

`TreeRunOutcome` gains `project?: TreeProjectScriptsVerdict` + `note?: string`; the existing `error`
docstring is widened to also cover a red/un-runnable emitted project script (the top-level reason
the tree is not ok). `treeRun()` always sets `project`; the note is set whenever a **declared**
script was not executed (loud, never silent).

### 2.2 The policy — `ok:true` requires the project's own tools when they are available

1. Script **not declared** in the emitted `package.json` (or no `package.json`) → `run: "skip"`,
   note names it ("no \"test\" script declared — absent is not a pass"). Neutral for `ok`.
2. Declared + its tool **not resolvable** for this tree (no `node_modules/.bin/<tool>`, not on
   `PATH` — e.g. `tsc` on an uninstalled tree) → `run: "skip"`, **loud note** ("NOT executed …
   UNVERIFIED; npm install then re-run") + top-level `note`. Never a fabricated pass, never a
   silent ok. Neutral for `ok` — the parent's rule is *"ok:true requires … when a toolchain is
   available"*; when it is not, the honest note is the contract.
3. Declared + resolvable → **run it** under the bounded runner: `npm run <script>` in the temp
   copy, scrubbed env, wall-clock timeout. Exit 0 → `pass`. Non-zero → `fail` (+ tail + exitCode).
   Timeout → `timeout`. Spawn failure → `error`.
4. **`ok:true` = compile-OK ∧ specs green ∧ entry green ∧ no declared script red.** A `fail` /
   `timeout` / `error` project script makes the tree NOT ok — *a tree failing its own `npm test`
   can never be `ok:true`*. A red project script also sets the top-level `error` (bounded), so the
   CLI/eval/journey messages name it for free.
5. Resolution rule (deterministic, no output sniffing) — FINAL, as implemented: the command's
   first token is un-quoted; path-qualified tokens resolve against the tree root; the
   node/npm/npx runtime family resolves as-is (the platform every runner leg already assumes);
   anything else resolves ONLY via the tree's own `node_modules/.bin` (win
   `.cmd`/`.exe`/`.ps1`/`.bat`). A **global** install of the same tool is deliberately NOT
   consulted — it is not the toolchain the emitted package.json declares, and consulting it could
   mask a missing devDependency on an uninstalled tree (the F-02 overclaim class). Consequences,
   all deliberate and probe-confirmed: the real emitted webapp tree (declares `tsc --noEmit`, no
   `node_modules`) reports `typecheck = skip + note` while its `node …` test script **runs for
   real** — the existing green `emit --run` test stays green and gains the tree's own passing
   test verdict; and a dep-less tree whose `test` script IS `node …` still gets executed, so the
   T-18 hard rule cannot be dodged by "no deps".
6. `error`/`tail` bounds reuse the file's existing caps. The runner stays **bounded, NOT a
   sandbox** — same honest label as ever.

## 3. Work log

1. **Recon (§1)** — every `TreeRunOutcome` consumer listed before the shape changed; `node-runner.server.ts`
   re-read to confirm `runNodeBounded` is the right seam (bounded, scrubbed env, no new sandbox needed).
2. **`compile-check.server.ts`** — implemented:
   - module header: `TreeRunOutcome.project` documented in the TREE-RUN MODE block (`:244-250`);
   - new exported types `TreeProjectScriptVerdict` (`:310-327`) + `TreeProjectScriptsVerdict` (`:332-336`);
   - `TreeRunOutcome` gained `project?` (`:360`), `note?` (`:365`); `error` docstring widened (`:355-357`);
   - `parseWrapperEnvelope` accepts `spawnErr` (`:543`, `:551`);
   - `RUNTIME_TOOLS` + `scriptToolResolvable` (`:481-498`) — deterministic resolution, no output sniffing;
   - `projectScriptRunnerCode` (`:505-531`) — CJS-safe `npm run <script>` wrapper (inner timeout,
     maxBuffer, shell:true for the Windows npm.cmd shim, JSON envelope on stdout);
   - `runProjectScript` (`:802-868`) — skip(not declared)/skip(unresolvable, note)/pass/fail/timeout/error,
     every non-pass carrying its bound note/detail;
   - `runProjectScripts` (`:872-895`) — the project leg (both scripts + `red`/`skippedDeclared` classification);
   - `treeRun` body (`:971-1000`) — project leg runs after the entry verdict in the SAME temp copy;
     a red declared script sets the bounded top-level `error`; a declared-but-un-executed script sets the
     top-level `note`; **`ok` now also requires `projectLeg.verdict.ok`** (`:1000`).
3. **`compile-check.server.test.ts`** — new describe at `:532` (+6 tests, see §4).
4. **`headless.ts`** — `treeRunFailureTail` (`:1571-1592`) now names a red declared project script
   (after a red spec, before the entry verdict) so the repair/journey context never chases a passing
   spec; docstring updated. The repair driver consumes the same helper (`:2392`, `:2498`), so repair
   tails get the naming for free.
5. **`headless.test.ts`** — new describe at `:743` (+1 test) pinning the threading end-to-end through
   `driveP6Journey` (fake all-green spec legs + a red `project.test` verdict ⇒ cycle 2's
   `ctx.treeFailureTail` names `npm run test`, journey `failed`).
6. **`node-runner.server.ts`** — read, **no edit needed**: the project leg rides the existing
   `runNodeBounded` seam exactly as the spec/entry legs do (same timeout/env-allowlist/output caps).
   No new deps, no signature changes.

## 4. Verification (real command output only)

- `npm run typecheck` → **EXIT=0, `grep -c "error TS"` = 0** (run after the `compile-check` edits,
  re-run after all edits — same result).
- `node --experimental-strip-types --test src/lib/compile-check.server.test.ts` → **34 tests / 34 pass / 0 fail**
  (baseline 28 + 6 new; arithmetic exact).
- `node --experimental-strip-types --test src/lib/headless.test.ts` → **84 tests / 84 pass / 0 fail**,
  EXIT=0 (baseline 83 incl. T-07 ×4 + TA-2 ×5 and the T0.7 regression — all kept green; +1 new).
- **DONE-WHEN combined**: `node --experimental-strip-types --test src/lib/compile-check.server.test.ts
  src/lib/headless.test.ts` → **EXIT=0 · # tests 118 · # pass 118 · # fail 0 · 0 × "not ok"** (34 + 84).
- `node --experimental-strip-types --test src/lib/maker-score.test.ts` → **74/74 / 0 fail** — maker-score is
  the third consumer of the `TreeRunOutcome` type (`treeRunToMakerEvidence`); the additive optional fields
  leave it byte-compatible.
- `npx eslint src/lib/compile-check.server.ts src/lib/compile-check.server.test.ts src/lib/headless.ts
  src/lib/headless.test.ts src/lib/node-runner.server.ts` → **exit 0, zero warnings**.
- **Empirical pre-test probe** (throwaway `_w3l2_probe.mjs`, deleted afterwards), 5 real scenarios:
  - A: declared `node --version` + `node --experimental-strip-types --test tests/oracle.spec.ts`, dep-less
    tree → `typecheck pass (exit 0)`, `test pass (exit 0)`, `ok:true` — **the project's own test really runs**.
  - B: all spec legs green but `"test": "node scripts/selfcheck.mjs"` (exit 1) → `test fail (exit 1)`,
    `ok:false`, top-level `error` = "the emitted project's own `npm run test` fail (exit 1) — …" — **the
    T-18 hard rule holds on the real path**.
  - C: declared `tsc --noEmit` / `vite --version`, no node_modules → both `skip` + loud note
    ("…UNVERIFIED…not a fabricated pass"), `ok:true` with the top-level note — never a fabricated pass,
    never a silent ok.
  - D: no scripts declared → skips with the "not declared" notes, top-level note absent, `ok` unchanged.
  - E: the **real corpus artifact** `research/eval-out/coffeehouse2home-property-ledger` (4.5s wall):
    `project.typecheck = skip` (tsc, no node_modules), `project.test = fail, exit 1` (its oracle crashes
    importing the generated source) — the artifact was ALREADY red on the compile/spec legs (an old
    artifact, predating this wave); the project leg now adds its own real exit code on top. Not caused
    by this change — stated because the artifact is red and that must not be misread.
- **Assertion changes (rule 7 disclosure):** **none to any existing test** — zero old assertions were
  touched, weakened or deleted; TAP evidence: the W2 T-07/TA-2/T0.7 tests and all A3/185-S5 guards are
  green in the runs above. One adjustment inside my own NEW test during development is recorded:
  the "no declared scripts" test first expected `/no "typecheck" script/`; the fixture's package.json
  carries **no `scripts` block at all**, so the honest note is the "*no package.json \"scripts\" block*"
  variant — the assertion was aligned to the actual (still stricter: two regexes) text, not weakened.

## 5. Files changed

| File | Change |
|---|---|
| `src/lib/compile-check.server.ts` | +new types `:310-336`, +`TreeRunOutcome.project/note` `:360-365`, `parseWrapperEnvelope.spawnErr`, `scriptToolResolvable` `:481-498`, `projectScriptRunnerCode` `:505-531`, `runProjectScript` `:802-868`, `runProjectScripts` `:872-895`, `treeRun` integration + **ok rule** `:971-1000`, header docs `:244-250` |
| `src/lib/compile-check.server.test.ts` | +describe "216 T-18 — the emitted project's own typecheck/test scripts" `:532` (6 tests) |
| `src/lib/headless.ts` | `treeRunFailureTail` names a red project script `:1571-1592` |
| `src/lib/headless.test.ts` | +describe "216 (T-18) — a red project-script verdict is named in the journey tail" `:743` (1 test) |
| `src/lib/node-runner.server.ts` | **read only — no edit needed** (reuses `runNodeBounded` as-is) |
| `fixes/216l_tree_run_build_test.md` | this log (new) |
| `fixes/216e_red_tree_emit_and_seat.md` | completed from the R2 lane's final report (work log / verification / files changed / blockers) |

## 6. Not done / blockers (honest)

- **Cross-file doc text left to its owners (rule 5 — not my files):**
  `scripts/rapidtool-cli.mjs:24-26` + `:2180-2183` and `scripts/README-cli.md` describe `emit --run` /
  `tree-run` as "the TreeRunOutcome (compile + tests + entry smoke)". The payload itself already carries
  the new `project` verdict and a red project script rides `payload.error` (no CLI code change needed —
  `payload.treeRun` serialises the whole outcome), but the human/agent doc text now under-describes the
  verdict. **W3-L4 owns those two files this wave** — flag for their pass.
- `scripts/run-eval.mjs` `treeRunToEvidence` reads `ok`/`compile.ok`/`tests`/`error`/`detail`; it stays
  compatible and a red project script now lands in its `detail` via `outcome.error` (no edit made — not mine).
- Everything else in the mini-task plan is done: types + policy implemented, tests added, headless
  threading pinned, both suites + typecheck + lint green, 216e completed, this log written.
- The runner remains **bounded, NOT a sandbox** — no claim to the contrary was added anywhere.
