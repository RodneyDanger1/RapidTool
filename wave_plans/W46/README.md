# W46 (the 332 wave) — six-lane completion wave — shared contract

**Opened:** 2026-10-02. **HEAD at open:** `6cd5123`, tree clean. Predecessor: the **331 wave** (W45) —
period contract `wave_plans/W45/README.md`, boundary report `fixes/331_0_parent.md`, keyed evidence
`wave_plans/W45/parent-keyed-findings.md`, register append `AW45-c01…c08`.

**Baseline gates at open (measured):** `npm run typecheck` exit 0 · `npm run lint` exit 0, 0 warnings ·
`npm test` **788 suites / 2682 tests / 2672 pass / 0 fail / 10 skipped** · `npm run build` exit 0 ·
`bash scripts/gate.sh` `ok:true`. Node 22.23.2 pinned at `%LOCALAPPDATA%\hermes\node\node.exe`; host
Node **v24.15.0**. Host runtime = Node 24 — always pass `--test-reporter=tap` when parsing
`node --test` output (gate.sh now does).

## Why this wave exists (the 331 wave's own §6 open list)

1. **The last mile to a green keyed tree is a generated-code async defect.** A keyed run now compiles
   13/13 and its generated core loads and runs, but its own spec is 24 pass / **1 fail**: the generated
   `src/jobs/rehab.ts` calls the async `getProperty(propertyId)` **without `await`** and then reads
   `property.ok === false` off the returned Promise, so the rejection floats past the test and node:test
   reds the whole spec file. `p6-test`/`p6-verified` can only mint from a **green tree-run**, so this
   one line stands between RapidTool and a verified product.
2. **Keyed synthesis coverage varies run to run.** One keyed P6 emitted 7 modules and passed `p6-arch`;
   the next emitted 5 and failed it. The declared job set is `slice(0,5)`-capped and capability mapping
   is not guaranteed.
3. **`budget.spent` resets per invocation** — observed `446` → `0` → `77654` across three successive
   `gate` calls on one project (`AW45-c06` / register `R12-f02`). The operator-facing spend line
   under-reports a run; `doctor`'s spend block reads `calls: 0`.
4. **`scripts/rapidtool-cli.mjs` carries 38 of the 173 `tsconfig.scripts.json` errors**, and
   `npm run typecheck` does not cover `scripts/**` at all (`tsconfig.json` includes only `src`+`server`).
5. **`create --brief <path>` silently treats the path as the brief prose** (`AW45-c07`).
6. **The browser console can claim `configured` while the last keyed call was rejected** (the
   `LlmStatusSurface.configured` chip reads key *presence*, not key *validity*).
7. **T5.2-A honesty surface has no test**: `src/lib/fixtures.review.ts` + `fixtures.server.ts` are
   reached only by untested `console.tsx`.
8. **A game-kind tree reds `treeRun` on a clean, non-residue source** (331-3's report): `resolveHeadlessEntry`
   resolves the browser boot (`src/main.ts`) which bare node cannot load.
9. **Register `R12` runtime rows still open**: the watchdog step budget (`WILD_STEP_BUDGET_MS = 90 s`)
   is smaller than a legal keyed step (`P6_SYNTH_TIMEOUT_MS = 240 s`) so a legitimate step auto-pauses
   as "frozen" (`R12-f04`); stale-run telemetry defeats its own coalescer (`R12-f05`); `readRtTail`
   reads a whole file to keep 256 KB (`R12-f06`); `diagnose`'s growth surface is hardcoded zeros
   (`R12-f07`).

## Lane table

| Lane | Persona | Owned files (STRICT) | Log |
|---|---|---|---|
| 332-1 | **Prompter** — synthesis correctness | `src/lib/codegen.server.ts`, `src/lib/codegen.server.test.ts` | `fixes/332_1_prompter.md` |
| 332-2 | **Ledger** — spend truth & budget | `src/lib/token-ledger.ts`, `src/lib/headless.ts`, `src/lib/doctor.ts` + their `*.test.ts` | `fixes/332_2_ledger.md` |
| 332-3 | **Transit** — emitted tree & tree-run | `src/lib/scaffold.ts`, `src/lib/compile-check.server.ts` + their `*.test.ts` | `fixes/332_3_transit.md` |
| 332-4 | **Switchboard** — CLI + toolchain | `scripts/rapidtool-cli.mjs`, `scripts/README-cli.md`, `scripts/cli-exit-taxonomy.test.mjs`, `scripts/typecheck-scripts.test.mjs`, `tsconfig.scripts.json`, `package.json` | `fixes/332_4_switchboard.md` |
| 332-5 | **Chrome** — console honesty + fixtures coverage | `src/components/console.tsx`, `src/routes/**`, `src/lib/fixtures.ts`, `src/lib/fixtures.server.ts`, `src/lib/fixtures.review.ts` + new `*.test.ts` | `fixes/332_5_chrome.md` |
| 332-6 | **Watchdog** — runtime telemetry & robustness | `src/lib/rt-events.ts`, `src/lib/rt-ring.ts`, `src/lib/rt-client.ts`, `src/lib/watchdog.ts`, `src/lib/diagnose.ts`, `src/lib/runtime-log.server.ts` + their `*.test.ts` | `fixes/332_6_watchdog.md` |

## Cross-lane contracts (pre-specified)

- **C1.** `src/lib/errors.ts` is **unowned** this wave. A lane needing a new `RT_E_*` code requests it
  in its log (name + when it fires + remedy) and does **not** add it; the parent lands it at the
  boundary with the borrower's justification.
- **C2.** `src/lib/engine.ts` and `src/lib/types.ts` are **unowned**. Adding a persisted field (e.g.
  run spend) needs them: **332-2 requests it in its log with the exact shape**, and stops there unless
  the parent grants the file at the boundary.
- **C3.** `scripts/gate.sh` and `src/lib/scaffold.test.ts` are **unowned**; do not edit.
- **C4.** 332-4 owns the toolchain flip. Order within the lane: make the CLI typecheck-clean **first**,
  then wire `npm run typecheck` to cover `scripts/**`, then keep the ratchet honest for whatever
  remains. Mid-wave, other lanes keep using `npx tsc --noEmit` (src-only) and must not be surprised by
  that script changing under them.

## Hard rules (inherited, non-negotiable)

1. **Never print, echo, or commit a secret.** Diagnose keys by last-4 tail only. `.env` is never
   `VITE_`-prefixed.
2. **No fabrication.** Evidence is a command's real output or bytes read today. A keyless path returns
   an honest floor; a "skip" is never a "pass". Reproduce before you fix; ship a test that fails
   before and passes after (show both).
3. **No full gate while siblings are mid-edit.** Targeted suites only
   (`node --experimental-strip-types --test --test-reporter=tap <file>`, `npx eslint <files>`,
   `npx tsc -p tsconfig.scripts.json` for 332-4). The **parent** runs typecheck, lint, both test legs,
   build and `gate.sh` at the boundary.
4. **No keyed calls in a loop.** At most one or two bounded keyed calls per lane if genuinely needed,
   each reported with its measured usage. **Never run `npm run eval`** (it rewrites tracked
   `research/eval-out/**`).
5. **Patch-only** on existing files. Explicit `.ts` extensions in the `src` chain. No `node:fs` in
   client-safe modules. No export renames without updating every consumer.
6. **Append-only lane logs** at the paths above; end each with verdict · per-fix before/after evidence ·
   tests added and their real results · what you did NOT do and why.
7. **STOP-and-REPORT** anything needing a file you do not own. Rules 1–7 of `AGENTS.md` apply.
8. Scratch work lives **outside the repo** (`%TEMP%\rt332_<lane>\…`). The repo must gain no probe file.

## OUTCOME (closed 2026-10-02)

All six lanes plus one follow-up landed. Boundary gates after every writer stopped: typecheck 0 (both
legs) · lint 0 warnings · assertion-gaps 0 · build 0 · **398 scripts + 2734 lib tests, 0 fail, 2
skipped** · **`gate.sh` `ok:true`, exit 0, no flakes**. Baseline at open: 394 + 2672 → **+66 tests**.
Boundary report: **`fixes/332_0_parent.md`**; register append: **`AW46-c01…c09`**; lane logs
`fixes/332_1…332_6_*.md`.

Headline results: the keyed run's last-mile failure (generated code reading a property off a
non-awaited async sibling call) is now a deterministic refusal routed into the bounded repair, and a
**fresh keyed run now completes P6** — green tree-run, `lastTest.label: "tested"`, `P6 DoD: PASS`,
`emit --run ok:true`, `leftoverJobsAreReexportsOrStubs: false`, factory gaps down from four to two (see
`fixes/332_0_parent.md` §4). Also: the persisted run spend is real (`doctor --project` reports it); a
clean game tree no longer reds the tree-run; the tree-run's unverified state is machine-readable; the
CLI is typecheck-clean and `scripts/**` is inside the typecheck; `create --brief <path>` is fixed; and
the console chip reflects key validity rather than key presence.

## Suggested persona charter (all lanes)

You are a senior engineer on a six-person team shipping a governed, honest software factory. Your
success metric is that a real keyed run produces a product that passes its own gates. Write code a
reviewer would approve without comment: no dead code, no placeholder logic, no silent catch, no claim
in a comment or doc the bytes do not support. Measure before you claim.
