# W52 (the 338 wave) — closing the autonomous-factory gap

**Opened:** 2026-10-02. **HEAD at open:** `e7da20e`, tree clean.
**Baseline gates:** typecheck 0 (both legs) · lint 0 warnings · assertion-gaps 0 ·
**411 scripts + 2889 lib tests / 0 fail / 2 skipped** · build 0 · `gate.sh ok:true`.
Node 22.23.2 at `%LOCALAPPDATA%\hermes\node\node.exe`; host Node **v24.15.0**. Always pass
`--test-reporter=tap` when parsing `node --test` output. For `gate.sh` use
`& "C:\Program Files\Git\bin\bash.exe"`.

## Why this wave exists — the owner's question

> *Does RapidTool truly work as an autonomous software factory now? If not, code what is needed.*

**The measured answer is: not yet — and the gap is four specific things, not a mystery.** Read
`fixes/337_0_parent.md` §5 for the full evidence. Recap:

| Evidence | Result |
|---|---|
| `doctor` | `autonomousSoftwareFactory: false`; gaps now only **two**: *"no human-approved fixtures (`decidedBy:"human"`)"* and *"product-complete bar not met (skip≠green; stubs≠complete)"* — the two multi-job gaps that stood three waves ago are **gone** |
| A **keyed** run | reached **P6 PASS** with `lastTest.label:"tested"` from a green tree-run, `p6-arch` PASS, `treeRun.substance {stubs:0, reexports:0, real:3}`, `emit --run ok:true`, advanced to P8 |
| The **keyless** floor (acceptance harness, 11 corpus fixtures) | **mean 0.56, pass@1 = 0.00**, every fixture ending `dod · RT_E_GATE_PENDING` — a labeled placeholder stopping at the product-completeness gate (honest, and not a product) |

**The four gaps to close this wave:**
1. **Keyed synthesis coverage is not deterministic run to run** — one run emitted 7 modules and passed
   `p6-arch`; the next emitted 5 and failed it. An unattended factory must reach the same verdict twice.
2. **The tree's declared toolchain never runs**, so `declaredScriptsVerified` is always `false` and the
   *product-complete bar* cannot be met even when the product is real (the tree-run's copy excludes
   `node_modules`, so `tsc`/`build` are skipped).
3. **No keyed run has been driven end-to-end from brief to P12 delivery unattended**, and no wave has
   classified which parks are genuine human decisions versus machine-resolvable.
4. **Fixture acceptance requires a `decidedBy:"human"` stamp**, and the machine door
   (`--seat autopilot`) deliberately does not claim a human decision — so the criterion is neither
   satisfiable nor honestly explained by a machine run.

## Step 0 — every lane does this FIRST

Read `fixes/337_0_parent.md` (the evidence above), your own prior lane logs from the previous waves, and
`research/multiagent/thoroughanalysis.md`'s `AW45-*`/`AW46-*`/`AW47-*` appendices. Open your log with
**claimed / on disk / still open** (`file:line` for the last), then work. Do not re-fix what a prior wave
verified; build on it.

## Ownership (STRICT)

| Lane | Persona | Owned files | Gap |
|---|---|---|---|
| 338-1 | **Determinism** | `src/lib/codegen.server.ts`, `algorithms.ts`, `phases.ts` + tests | 1 |
| 338-2 | **Completion** | `src/lib/compile-check.server.ts`, `node-runner.server.ts`, `exec.ts` + tests | 2 |
| 338-3 | **Autonomy** | `src/lib/headless.ts`, `doctor.ts`, `dod.ts` + tests | 3 |
| 338-4 | **Acceptance** | `src/lib/fixtures.ts`, `fixtures.server.ts`, `fixtures.review.ts`, `maker-score.ts`, `policy.ts` + tests | 4 |
| 338-5 | **Product** | `src/lib/scaffold.ts`, `packet.ts`, `handoff.ts` + tests | 1/2 (the emitted side) |
| 338-6 | **Learning** | `src/lib/verify.server.ts`, `verify.ts`, `entry-oracle.ts`, `harvest.ts`, `knowledge.ts` + tests | the mission's "continuously improve" |

**Unowned / frozen:** `src/lib/engine.ts`, `types.ts`, `errors.ts`, `token-ledger.ts`, `io.ts`,
`checkpoint.server.ts`, `algorithms.ts`'s consumers outside 338-1, `src/components/**`, `src/routes/**`,
`src/lib/store.ts`, `llm.ts`, `scripts/**`, `package.json`, `tsconfig*.json`, `migrations/**`,
`research/eval-corpus/**`, `research/eval-out/**`, the register body, and all of `fixes/**` history.
A change needed there is a **STOP-and-REPORT with the exact shape**; the boundary owner lands it.

## Hard rules

1. **NO DELETIONS of tracked files** — the owner declined the dead-code question; prove and propose.
2. **Patch discipline** — minimal surgical patches; `codegen.server.ts` (234 KB), `headless.ts` (250 KB)
   and `scaffold.ts` are patch-only; never rewrite a file to change a few lines; never reformat.
3. **No mock, fake or placeholder code** — no `TODO` bodies, `as any`, `@ts-ignore`, silent `catch {}`,
   hardcoded returns faking a computation, tests that cannot fail, or comments claiming what the bytes do
   not do. Run the **mock/fake census** over your files and report it. The emitted product's
   `TODO(E-15)` marker is the product contract.
4. **No fabrication.** Evidence is a command's real output or bytes read today. A skip is never a pass.
   **Never claim the autonomous-factory gap is closed unless a real keyed run demonstrates it.**
5. **RED-first** — every fix ships a test failing before and passing after; show both.
6. **Bounded keyed calls are ALLOWED this wave** (this is the point): at most **two** per lane, each
   reported with its measured usage, because gaps 1–3 can only be settled with the real model. **Never
   run `npm run eval` against the tracked dir** — use `--out <scratch>`.
7. **No full gate while siblings are mid-edit** — targeted suites only; the parent runs the boundary gate.
8. **Never print a secret**; tails only.
9. **Append-only logs** at `fixes/338_<n>_<persona>.md`.
10. **Scratch outside the repo** (`%TEMP%\rt338_<lane>\…`). Checkpoint an intended large patch into your
    log before applying it.

**Web research is permitted where it genuinely informs a decision** — the repo ships a keyless search
path (`src/lib/websearch.server.ts` / the `search` verb's `freeWebSearch`) you may call from a probe
outside the repo. If you use it, cite the source and say what it changed in your design; do not paste
prose into code.

## Lane missions

- **338-1 Determinism.** Make the P6 plan/coverage **deterministic and spec-driven**: the declared jobs
  and capabilities the spec binds must map to planned files by rule, not by whatever the model happened to
  emit, and `p6-arch`/the census must judge coverage against that. Reproduce the 7-vs-5 divergence with
  **two real keyed runs on the same brief** and show the plan is now stable (or that the residual variance
  is named and bounded). This is the highest-value lane; if you must choose, fix stability before breadth.
- **338-2 Completion.** Make the emitted tree's own declared `typecheck`/`build` **actually execute**, so
  `declaredScriptsVerified` can be true. The blocker is that the tree-run copies the tree without
  `node_modules`; find the honest, bounded, offline-safe way (resolve `tsc`/the toolchain from the repo's
  own `node_modules` without a network install; or install into the scratch copy with a hard timeout and a
  coded refusal on failure). Keep the unverified state honest when it genuinely cannot run.
- **338-3 Autonomy.** Drive a **keyed run from brief to P12 delivery unattended** (the `--seat autopilot`
  door, no human input) and classify every park and every DoD block as *human-decision* or
  *machine-resolvable*; fix the machine-resolvable ones (bounded to your files — report the rest). Then
  make `doctor`'s `autonomousSoftwareFactory` claim **wired to real signals** rather than a fixed list, so
  the flag tells the truth as gaps close.
- **338-4 Acceptance.** Decide and implement the honest answer to the `decidedBy:"human"` gap: either a
  **machine acceptance path** with real, attributed provenance (the autopilot seat is a legitimate machine
  door — never fake a human stamp) that a machine run can satisfy, or a precise statement of why acceptance
  must be human plus a machine-checkable proxy criterion. `maker-score.ts` owns the scoring side; make the
  two agree.
- **338-5 Product.** The emitted product must be **complete and runnable**: check the declared-but-unwired
  devDependencies (a previous lane flagged `@tailwindcss/vite`/`tailwindcss` declared yet unwired), the
  emitted `README`/`DEPLOY.md` truth, the entry/boot wiring, and — the owner's agent-facing ask — whether
  the **packet gives an agent everything it needs to continue the run unattended** (the current edge, its
  DoD, its inputs, its expected output). Fix what is missing.
- **338-6 Learning.** The mission claims the factory "continuously improves". Prove or falsify that:
  does a second run on the same brief actually get better (lessons harvested, ranked, seeded, and
  measurably affecting the P6 expansion)? If the loop is real, show the mechanism with a probe; if it is
  decorative, either wire it or say so precisely. Also: `verify.server.ts`/`entry-oracle.ts` are the
  verification spine — make sure `label:"tested"` can never be minted without a genuine green run.

## Report format

Reconciliation; per-fix before/after; **the gap evidence** for your lane (the real run or probe that
shows the gap closing or the residual measured); the mock/fake census; tests added with real results on
both runtimes; keyed usage if any; what you STOP-and-REPORTed; what you did NOT do and why.
