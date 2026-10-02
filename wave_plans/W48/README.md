# W48 (the 334 wave) — six-persona re-dispatch: re-examine your own lane, fix what remains

**Opened:** 2026-10-02. **HEAD at open:** `0d5b250`, tree clean.
**Predecessors:** 331 wave (W45), 332 wave (W46), 333 audit pass (W47).

**Baseline gates at open (measured):** typecheck 0 (both legs) · lint 0 warnings · assertion-gaps 0 ·
`npm test` **398 scripts + 2747 lib tests / 0 fail / 2 skipped** · build 0 · `bash scripts/gate.sh`
`ok:true`, no flakes. Node 22.23.2 pinned at `%LOCALAPPDATA%\hermes\node\node.exe`; host Node
**v24.15.0**. Host runtime = Node 24 — always pass `--test-reporter=tap` when parsing `node --test`
output. For `gate.sh` use `& "C:\Program Files\Git\bin\bash.exe"` (bash on PATH is the WSL stub).

## Step 0 — every lane does this FIRST (the user's explicit instruction)

**Examine your own former work before touching anything.** Read, in this order:
1. your own lane logs from the three previous passes — `fixes/331_<n>_*.md`, `fixes/332_<n>_*.md`,
   and whatever the 333 audit pass said about your files (`fixes/333_1_verifier.md`,
   `fixes/333_2_registrar.md`);
2. your owned files as they stand on disk now;
3. `fixes/333_0_parent.md` §5 (the open list with owners) and `fixes/332_0_parent.md` §5.

Then open your new log with a **short reconciliation** — three lists:
- **claimed** (what your former lane said it landed),
- **on disk** (what you verify is actually there now),
- **still open** (what is not, with `file:line`).
Claim-versus-bytes divergence is a finding in its own right, reported even if you fix nothing else.
Only after that do you fix.

## Lane table — same six personas, same specialties

| Lane | Persona | Owned files (STRICT) | Log |
|---|---|---|---|
| 334-1 | **Prompter** — synthesis correctness | `src/lib/codegen.server.ts` + test | `fixes/334_1_prompter.md` |
| 334-2 | **Ledger** — spend truth & run-result plumbing | `src/lib/token-ledger.ts`, `headless.ts`, `doctor.ts` + tests | `fixes/334_2_ledger.md` |
| 334-3 | **Transit** — emitted tree & tree-run | `src/lib/scaffold.ts`, `compile-check.server.ts`, **`src/lib/dod.ts`** (granted this wave) + tests | `fixes/334_3_transit.md` |
| 334-4 | **Switchboard** — CLI + toolchain debt | `scripts/rapidtool-cli.mjs`, `scripts/README-cli.md`, `scripts/cli-exit-taxonomy.test.mjs`, `scripts/typecheck-scripts.test.mjs`, `tsconfig.scripts.json`, `package.json`, **plus the remaining `scripts/**` files carrying budgeted type errors** (list in your brief) | `fixes/334_4_switchboard.md` |
| 334-5 | **Chrome** — console honesty | `src/components/console.tsx`, `src/routes/**`, `src/lib/fixtures*.ts`, **`src/lib/store.ts`, `src/lib/llm.ts`** + new tests | `fixes/334_5_chrome.md` |
| 334-6 | **Warden** — guards & hygiene | `scripts/check-assertion-gaps.mjs` + test, `scripts/check-module-coverage.mjs` + test, `.gitignore` | `fixes/334_6_warden.md` |

**Ownership notes.** 334-4 owns the **entire** `scripts/**` typecheck-debt list this wave — including
`scripts/with-app-env.test.mjs` and `scripts/brand-check.test.mjs`, which sit in the ratchet budget — so
334-6 does **not** own any budgeted file. `src/lib/dod.ts` is granted to 334-3, and `src/lib/store.ts` +
`src/lib/llm.ts` to 334-5. `src/lib/engine.ts`, `src/lib/types.ts`, `src/lib/errors.ts` and
`src/lib/node-runner.server.ts` stay **unowned** — request changes there in your log with the exact
shape, and the parent lands them at the boundary.

**The 14 budgeted files (334-4's debt list, current `max` in parentheses):**
`run-eval.test.mjs` (64) · `run-eval.mjs` (25) · `preview.test.mjs` (10) · `grok-pwa-shared.mjs` (6) ·
`write-atomic.test.mjs` (5) · `browser-guard.mjs` (5) · `check-auth-invariant.test.mjs` (4) ·
`with-app-env.test.mjs` (4) · `next-action-arm-parity.test.mjs` (3) · `browser-smoke.mjs` (2) ·
`migration-plan.test.mjs` (2) · `brand-check.test.mjs` (2) · `grok-pwa-plugin.mjs` (1) ·
`grok-pwa-plugin.test.mjs` (1). Retire what you can with real types; **every reduction must lower the
matching `max` in the same change**, and the ratchet must still fail on a planted error.

## The open list you are working against (from `fixes/333_0_parent.md` §5 + lane logs)

1. **No consumer refuses on `declaredScriptsVerified`.** A fresh emitted tree reports
   `declaredScriptsVerified:false` with `unverifiedDeclaredScripts:["typecheck","build"]`, and nothing
   acts on it: the CLI `emit --run` exit code, the P6 DoD mint (`dod.ts`), and the emitted README banner
   (`scaffold.ts`) are the three surfaces. Owner split: **334-3** (DoD probe + banner, via the granted
   `dod.ts`) and **334-4** (CLI exit code + `README-cli.md`). Constraint measured: flipping `ok` inside
   `treeRun` alone reds every fresh tree and blocks the P6 mint, so the flip must be a *separate*
   honest signal, not a redefinition of `ok`.
2. **134 type errors remain budgeted in `scripts/**`** across 14 files. Owner: **334-4**.
3. **`doctor` cannot see a prior process's key rejection** (the tap is process-local, so a fresh
   `doctor` honestly degrades to `unverified`). Owner: **334-2** — persist the last keyed outcome on the
   project record, the same shape as the `tokenUsage` fix. Needs `types.ts`/`engine.ts`: request them.
4. **`run` / `runUntilHitlAsync` expose no `code`**, so a P6-synthesis 401 cannot move the console chip
   or the doctor state. Owners: **334-2** (surface it on the run result) and **334-5** (consume it).
5. **The async guard's remaining lexical limits** — a Promise-returning callable not spelled `async`, a
   receiver call `obj.m()` / `this.m()`, a dynamic computed key. Owner: **334-1** — close whichever are
   decidable without over-refusing; keep the rest named.
6. **Spend from non-`gate` verbs** (`repairTreeDir`, `wildStep`, the console's `runPhaseAsync`) does not
   fold into a project's spend slice. Owner: **334-2**.
7. **The guard still does not catch `assert.ok(… || true)`-class tautologies** — lane 331-6 reported two
   real instances it could not ship a rule for at the time; the parent has since fixed both, so the rule
   can now land green. Owner: **334-6**.
8. **`.t4scratch/` holds 192 tracked files duplicating `src/lib/**`** (from an ancestor commit). Owner:
   **334-6** — audit it, prove zero references, and report a deletion proposal with evidence; **do not
   delete tracked files** without the parent's sign-off (repo rule).
9. **`fixes/331_0_parent.md` still says the CLI carries 38 typecheck errors** (it is 0). Doc-accuracy
   fix. Owner: **334-2** (that log is otherwise unowned; append a correction — never rewrite).
10. **`.grok/` is partially load-bearing** (register `R15-f08`: 4 live read paths, 1 stale file) while
    `AGENTS.md` calls it stale scaffolding. Owner: **334-6** — audit the real read paths and correct the
    documentation claim.

## Owner decisions — do NOT override

The product owner has open decisions that a lane must not pre-empt: the dev server binding
(`R11-f01`, a documented host/port contract), running `npm run eval` (it rewrites **tracked**
`research/eval-out/**`), the stale User-scope `DEEPSEEK_API_KEY` on this machine, and deleting tracked
files. Report against them; do not act on them.

## Hard rules (inherited, non-negotiable)

1. **Never print, echo, or commit a secret.** Diagnose keys by last-4 tail only.
2. **No fabrication.** Evidence is a command's real output or bytes read today. A skip is never a pass.
   Reproduce before you fix; ship a test that fails before and passes after, and show both.
3. **No full gate while siblings are mid-edit.** Targeted suites only. The **parent** runs typecheck,
   lint, both test legs, build and `gate.sh` at the boundary.
4. **No keyed calls in a loop.** At most one bounded keyed call per lane if genuinely required, with its
   measured usage reported. **Never run `npm run eval`.**
5. **Patch-only** on existing files; explicit `.ts` extensions in the `src` chain; no `node:fs` in
   client-safe modules; no export renames without updating every consumer.
6. **Append-only lane logs** at the paths above: reconciliation first, then per-fix before/after
   evidence, tests added with real results on **both** runtimes, then what you did NOT do and why.
7. **STOP-and-REPORT** anything needing a file you do not own.
8. Scratch work lives **outside the repo** (`%TEMP%\rt334_<lane>\…`). The repo must gain no probe file.
