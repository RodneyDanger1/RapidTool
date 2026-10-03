# W50 (the 336 wave) — six lanes: defects, pipeline completeness, and end-to-end wiring

**Opened:** 2026-10-02. **HEAD at open:** `fac37d4`, tree clean.
Predecessors: 331, 332, 333 (audit), 334, 335 (+ guardian).
**Baseline gates:** typecheck 0 (both legs; `ERROR_BUDGET = {}`) · lint 0 warnings · assertion-gaps 0 ·
**408 scripts + 2797 lib tests / 0 fail / 2 skipped** · build 0 · `gate.sh ok:true`.
Node 22.23.2 at `%LOCALAPPDATA%\hermes\node\node.exe`; host Node **v24.15.0**. Always pass
`--test-reporter=tap` when parsing `node --test` output. For `gate.sh` use
`& "C:\Program Files\Git\bin\bash.exe"`.

## The owner's brief for this wave

Fix **bugs, defects and pipeline issues**; **professional code only — no mock, fake or placeholder
code**; make sure everything is **properly wired**; be **thorough from the surface to the backend**;
hold **industry standards**. So every lane does three things, not one: (1) fix the real defects in its
area, (2) **prove the wiring end to end** for its slice (surface → server function → engine → disk), and
(3) run the **mock/fake census** over its own files and report the result — a clean census is a valid
deliverable; a finding is a defect.

## Step 0 — every lane does this FIRST

Read your own lane logs from the previous passes (`fixes/331_<n>_*`, `fixes/332_<n>_*`,
`fixes/334_<n>_*`, `fixes/335_<n>_*`), the audits (`fixes/333_1_verifier.md`, `fixes/333_2_registrar.md`,
`fixes/334_0_parent.md`, `fixes/335_0_parent.md`, `fixes/335_7_guardian.md`), and your owned files on
disk. Open your log with **claimed / on disk / still open** (`file:line` for the last), then work.

## Ownership (STRICT) and grants

| Lane | Persona | Owned files |
|---|---|---|
| 336-1 | **Prompter** — pipeline completeness | `src/lib/phases.ts`, `src/lib/prompt-engine.ts`, `src/lib/codegen.server.ts`, **`src/lib/engine.ts` (granted this wave)** + their tests |
| 336-2 | **Ledger** — persistence, resume, state integrity | `src/lib/headless.ts`, `src/lib/io.ts`, `src/lib/doctor.ts`, `src/lib/token-ledger.ts`, **`src/lib/checkpoint.server.ts` (granted)** + their tests |
| 336-3 | **Transit** — emitted product + agent packet | `src/lib/scaffold.ts`, `src/lib/compile-check.server.ts`, `src/lib/dod.ts`, `src/lib/packet.ts`, `src/lib/handoff.ts` + tests |
| 336-4 | **Switchboard** — CLI, toolchain, eval safety | all of `scripts/**`, `tsconfig*.json`, `package.json` |
| 336-5 | **Chrome** — UI wiring and polish | `src/components/**`, `src/routes/**`, `src/lib/store.ts`, `src/lib/llm.ts`, `src/lib/fixtures*.ts`, **`src/lib/error-component.tsx` (granted)** + tests |
| 336-6 | **Warden** — wiring audit, algorithms, guards | `src/lib/algorithms.ts`, `algo-tools.ts`, `arch-tools.ts`, `ast-mine.ts`, `entry-oracle.ts`, `iterate.ts`, `judgment.ts`, `planning.ts`, `maker-score.ts`, `vector.ts`, `swarm.ts`, `design.ts`, `diagram.ts`, `bench.ts`, `scripts/check-*.mjs` + tests; **new test files for currently-unreached modules are explicitly in scope** |

**Do-not-touch (a lane that needs one of these STOPs and reports):** `src/lib/types.ts`,
`src/lib/errors.ts`, `src/lib/verify.server.ts`, `src/lib/verify.ts`, `src/lib/knowledge.ts`,
`src/lib/harvest.ts`, `src/lib/node-runner.server.ts`, `src/lib/rt-*.ts`, `src/lib/watchdog.ts`,
`src/lib/diagnose.ts`, `src/lib/crew.server.ts`, `src/lib/chat*.ts`, `src/lib/git.server.ts`,
`src/lib/policy.ts`, `src/lib/quarantine.ts`.
**Frozen:** `fixes/**` history (append-only logs), `research/eval-out/**`, the register body (append only
via its end-marker), `migrations/**`, `research/eval-corpus/**`.

## Hard rules

1. **NO DELETIONS of tracked files.** The owner was asked and did not authorize removing dead code, so
   the repo rule stands: a tracked path is deleted only by the boundary owner with sign-off. **Prove
   dead code is dead and propose it in your log; wire what can be wired.** New test files are welcome.
2. **Patch discipline.** Minimal, targeted patches. Never rewrite a whole file to change a few lines —
   `engine.ts` (231 KB), `console.tsx` (315 KB) and `codegen.server.ts` (234 KB) are patched surgical
   only. Never reformat, never "clean up" code you were not asked about, re-read before patching.
3. **No mock, fake or placeholder code.** This is the owner's explicit standard: no `TODO` bodies, no
   `as any`, no `@ts-ignore`, no silent `catch {}`, no hardcoded return that fakes a computation, no
   test that cannot fail, no comment claiming behaviour the bytes do not have. Where an honest scaffold
   stub is the product contract (the emitted `TODO(E-15)` markers), say so rather than "fixing" it.
4. **No fabrication.** Evidence is a command's real output or bytes read today. A skip is never a pass.
5. **RED-first.** Every fix ships a test failing before and passing after — show both. UI work needs a
   browser observation; wiring work needs a probe that follows the real path.
6. **No full gate while siblings are mid-edit** — targeted suites only; the **parent** runs typecheck,
   lint, both test legs, build and `gate.sh` at the boundary.
7. **No keyed calls in a loop** (at most one bounded call per lane, usage reported). **Never run
   `npm run eval`** unless your mission is to make it safe (336-4), and then only against a scratch dir.
8. **Never print a secret**; tails only.
9. **Append-only logs** at `fixes/336_<n>_<persona>.md`.
10. **Scratch outside the repo** (`%TEMP%\rt336_<lane>\…`); the repo gains no probe file. Checkpoint an
    intended large patch into your log before applying it.

## Lane missions

### 336-1 Prompter — close the pipeline's producer gaps
The previous wave's STOP item: three phase-table deliverables have **no producer** — P8 "component code
with a live key", P9 "GPU allocation scripts", P12 "database schemas / frontend-backend parity". `engine.ts`
is granted to you this wave. For each: implement the producer (the P12 DB schema is derivable from
`project.contracts.entities`; check what the brief/spec actually carries for P8/P9) or, where the input
genuinely does not exist, keep it an explicit reasoned gap — but **state which and why**, with a driven
probe. Then: the `phaseCoverage` census must agree with what the phase really produces, and the P6
residuals (prompt rules, the async guard's stated limits, chunk bounds) plus the guard's own
`p6.tree.shortfall` row. Also verify **the whole P0→P12 pipeline is wired**: for a driven run, every phase
enters, records and hands off — no silent no-op, no orphaned artifact kind.

### 336-2 Ledger — persistence, resume, and no silent state loss
(a) **Wire and prove the resume path end to end** (`checkpoint.server.ts` is yours this wave): a run
parked at a gate, checkpointed, then resumed from a *fresh process* must re-enter at the recorded phase
with its identity/mode/phase sanity-checked, and must never resume silently or hydate the wrong record.
(b) **No state is lost anywhere in the record:** for a driven run, prove every field the pipeline writes
survives save→load→re-save byte-identically, including the ones recent waves added, and that a legacy
record migrates in place with absent fields staying absent (never fabricated). (c) The atomic-write
`fsync` question: land it only if you can make it observable (a test or a real probe); otherwise state
the named limit and why a change would be unverifiable. (d) The journey's per-phase records must not drop
a phase's artifacts on any park/retry/repair path.

### 336-3 Transit — the emitted product and the packet, wired and honest
(a) Prove the **emit → tree-run → DoD → packet** chain end to end for a real project: the tree the
factory writes is the tree it smoke-tests, the verdict the DoD reads is the verdict the tree-run
produced, and the packet describes that tree. Report any place the chain passes a *different* artifact
than the one it verified. (b) The emitted scaffold must contain no fake/placeholder behaviour beyond the
honest `TODO(E-15)` contract — audit the emitted `README`/`DEPLOY`/`package.json`/config for claims the
emitted bytes do not satisfy, and the emitted oracle spec for assertions that cannot fail. (c) The
packet/handoff residual (`packet.ts`'s memory-empty phrase pinned by R4/B-05) and any remaining field
that promises more than it measures.

### 336-4 Switchboard — CLI and toolchain wiring, and make `npm run eval` safe
(a) Prove **every documented verb and flag is wired**: spawn all 39 verbs, exercise each documented flag,
and report any that is accepted but does nothing, or documented but absent, or accepted and silently
ignored. (b) Hunt dead/unwired CLI code (an unreachable `case`, an option read nowhere, a helper with no
caller) and either wire it or propose its removal with evidence. (c) **Make `npm run eval` safe**: it
currently rewrites tracked `research/eval-out/**`, which is why no wave has dared run it — give it a
scratch/`--out` default or a refusal guard so the scorecard can be produced without dirtying the tree,
and prove it by running it against a scratch dir. (d) Keep `scripts/**` typecheck at 0 and the ratchet
green.

### 336-5 Chrome — the surface must reach the backend, and look professional doing it
(a) **Wiring from the surface down**: for every interactive control on the console and routes, prove it
reaches a real backend function and that the function's result is rendered — a control that calls
nothing, or a state field written but never read, is a defect. (b) Land the polish the previous wave
proposed but did not land: mobile header density (about ten chrome rows before content), the state-aware
`<title>` for `/run/<bad-id>`, and the global skip link now that you own `error-component.tsx`. (c) A
deeper audit than last time: error/empty/loading states for every data surface, keyboard reachability of
every action, focus visibility, and long-content behaviour at 390 px and at a very wide viewport. Keep
the honesty rule (no label promises more than it measures) and **zero non-null assertions in
`console.tsx`**.

### 336-6 Warden — wiring audit of unreached modules, algorithm residuals, guard truth
(a) The coverage guard reports **19 allowlisted modules that no test reaches**, and at least two of them
(`src/lib/app-data/index.ts`, `src/lib/multiplayer/index.ts`) have **no importer at all** while
`src/lib/db.ts`'s allowlist reason ("no module imports it yet") is **factually wrong** — `auth/server.ts:38`
imports it, and that file is itself unreached. For each of the 19: decide honestly whether it is
**live-but-untested** (add a real test that exercises it — new test files are in scope) or **dead**
(prove it with a reference scan and propose removal; do not delete). Fix every inaccurate allowlist
reason. This is the wave's "everything is wired" mandate on the backend side. (b) Fix the two reported
algorithm residuals: `vector.ts:704` (unreachable branch) and `algo-tools.ts:929` (`while` used as a
method name counted as a loop) — both now have tests to write, which is what stopped them last time.
(c) Re-probe the modules you certified SOUND last wave only where your fixes touch them.

## Report format

Reconciliation; per-fix before/after; the **wiring proof** for your slice (the real path and its probe);
the **mock/fake census** over your files; tests added with real results on **both** runtimes; anything you
STOP-and-REPORTed; what you did NOT do and why.
