# W36 · THE COMPLETION WAVE — 6 lanes: finish everything the sprint left open, rescue the broken file, harden the new module, surface the UI, paste the records.
**Readers share this file.** Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; `grep`; keep shell calls SHORT — long one-liners get parser-blocked). HEAD `0f85c32` + the W29–W36 uncommitted era. **STATIC GATES: lint GREEN (registered 20:0x); typecheck has a KNOWN transient break — `scaffold.ts`'s TS2554 arity errors from L1's mid-edit (L1: "they disappear with item 1 alone").**
**CONTRACT (all):** smallest honest patches · additive only · `TODO(<id>)` at the exact logic line · no fake behavior · targeted checks only (NO full gates; NO keyed calls) · log-and-continue · lane log EARLY (`fixes/281_n<n>_*.md`) · appends via their END-MARKER protocols (re-read first).
**READ FIRST (all):** `wave_plans/W30/shell-sprint.md` (the shell contract) · `finalsprint.md` (via terminal/grep — read_file misdetects it) · `research/multiagent/thoroughanalysis.md` (the register) · your lane's source log (named below).

## N1 — THE RESCUE + UNIVERSALITY COMPLETION (`scaffold.ts` owner)
Source: `fixes/277_l1_universality.md` (its 9-item board: 7 landed, 6 remaining anchors listed) + `fixes/272_s2_universality.md`.
1. **FIRST: fix the compile break** — the TS2554 arity errors in `scaffold.ts` (L1: item-1 alone clears them; the scoped tsc at 19:5x showed lines 1021/2913/2968/3015). Read L1's anchors; make the emitters' call sites match their signatures.
2. **Then L1's remaining items** (per its board): wire `emitKindEntry`/`emitBinLauncher`/`defaultUiGeneration` to their call points (3 lint warnings name them: `:949/:2134/:2224`), finish the kind wiring, `run-eval.mjs`'s `expectedBehavior` + `verification` label (share with N5: N5 owns run-eval — coordinate via your log), the R3-f02 prompt reword (respect `codegen.server.test.ts:333` + `verify.server.ts:417`'s CJS harness — reword the RULE, never emit raw `export` syntax), R3-f03's redTree/partial SKIP path.
3. **CONTRACTS:** `scaffold.test.ts:338` (E-15 sweep) · `emitted-honesty.test.ts:42` (RT_E_VALIDATION · prefix) · webapp bytes unchanged.

## N2 — CHECKPOINT HARDENING + THE RESUME/UNATTENDED TAIL (`checkpoint.server.ts` + `headless.ts` + CLI-verbs owner)
Sources: `wave_plans/W34/code-notes.md` §A1 (the 10 checkpoint findings — read them verbatim) + `fixes/277_l2_integration.md` (L2's remaining list).
1. **Harden `checkpoint.server.ts` per §A1's cards**: guards BEFORE `join()` (never-throws law), the write-outside-try case, the FALSE caps comment (either align with salvageTrim or fix the comment honestly), validate `run.mode` before writing, split I/O failures from `RT_E_VALIDATION`, `checkpointAdmits`' staleness/phase sanity, the `.tmp` race (pid-suffixed staging), the reader's type-promises-vs-validation gap. Each fix with its `TODO` removed/tightened accordingly.
2. **L2's remaining**: the `resume` verb + `unattended` (see L2's log for its state) — wire them to the REAL `readCheckpoint`/`checkpointAdmits` (never a shell-refusal now that the module works); the CLI USAGE + a README-cli row (doc-parity constraints in `scripts/README-cli.test.mjs` — do not run it).
3. **The `readWildPlan` residue**: F3-01 was parent-fixed (inline honest plan in headless). If engine.ts should still gain the real export, land it + re-point the import — or leave the inline and note why in your log.

## N3 — THE UI SURFACING (`console.tsx` owner — additive ONLY, never remove a control)
Source: `fixes/272_s5_finish_ui.md` (S5's plan) + `fixes/276_f3_ui_close.md` (F3's byte-state table).
Surface honestly (FixturesPanel pattern: state visible, refusal named, disabled-with-reason in title): **plan** (read `project.wildPlan` — the honest empty plan shape per types.ts:172-183: goal/steps/source/plannedAt/note), **checkpoint/resume** (read the real checkpoint state via the CLI/serverfn seam or a store-level line), **unattended/stream/cassette/seat/isolation** (honest labels + coded reasons). Then append §S5 to `finalsprint.md`.

## N4 — THE RECORDS CONSOLIDATION (doc-owner; the biggest paste job)
Paste VERBATIM from sources into `finalsprint.md` above its END-OF-FILE-MARKER-SPRINT (re-read before EVERY append; one block per section; attribution + source path): §S5 (N3 lands it — coordinate) · §T1←`fixes/273_t1_register_rows.md` · §T2←`fixes/273_t2_r15.md` · §T3←`fixes/273_t3_r13.md` · §T4←`fixes/273_t4_defined.md` · §T5←`fixes/273_t5_board.md` (the verdict table) · §WDX-2←`fixes/274_wdx2.md` (+ RS-01…04 + CF-4) · §WDX-3←`fixes/274_wdx3.md` · §MASTER-CORRECTIONS (WDX-2's 4 + CF-4). THEN the W34/W35 pastes into their docs: §A2←`fixes/279_a2_codenotes.md`'s summary (10.3 KB — in `~/AppData/Local/hermes/cache/delegation/subagent-summary-1-20260926_195032_506645.txt` if the lane log is a stub) · §P2← summary-1 of deleg_9a2939fc (`subagent-summary-1-20260926_194745_119606.txt`, 10.5 KB) · §F1←`deleg_5caa4e55/subagent-summary-0-…-767464.txt` (13.9 KB) · §F2←`…-1-…-767464.txt` (9.7 KB) · §F3←`…-2-…-772471.txt` (11.6 KB) · §F4←`…-3-…-773501.txt` (7.9 KB) · §F5←`…-4-…-775540.txt` (6.6 KB) — into `wave_plans/W35/factory-notes.md` §F1–§F5 and `wave_plans/W34/code-notes.md` §A2 / `prep.md` §P2. Where already live: 'already live — verified'.

## N5 — THE OPS + GRADER FIXES (`scripts/**` + `run-eval.mjs` owner — coordinate with N1 on run-eval)
Sources: `deleg_5caa4e55`'s F4/F5 summaries (`…-3-…-773501.txt`, `…-4-…-775540.txt`).
1. **OPS-1**: `rapidtool-cli.mjs:1030` + `:1108` — the two 1-arg `respond()` calls → pass `exit_code` (scan shows exactly 2 of 177).
2. **OPS-3**: the CLI cites `scripts/cli-exit-taxonomy.test.mjs` which does not exist — either create it (the exit-taxonomy guard from A2-f03's spec) or fix the citation text; prefer creating it (it closes A2-f03's "no guard" gap).
3. **F4's grader cards**: per-kind real `expectedBehavior` assertions in `run-eval.mjs` + the `verification` label populated honestly (N1 may land the structure — verify bytes first; the assertion logic is yours).
4. F4's other cards + A2's highest-value periphery findings if your window allows (its summary lists "contracts that lie" first).

## N6 — THE PINS + THE SUITE TRUTH (test-owner)
Sources: `fixes/278_p1_remainders.md` + `fixes/278_p3_waveplan.md` + `fixes/277_l3_ui_records.md`.
1. **Re-point the stale pins**: `rapidtool-cli-edit.test.mjs` (3 pins unwinnable post-two-channel, not ok 6/7/9, mtime Sep 17) + verify `headless.test.ts:1608/:1741` (L3's patches) + find the nested subtest (last capture: 96/94/2 @19:11 — the 2 named + what the full TAP names).
2. **The fixtures-verb coverage gap (OPS-2)**: add the `fixtures` CLI leg pins (exit_code present; the seat refusals fire) — closes the never-caught class.
3. **The no-op-trap doctrine**: each re-pointed pin must assert the NEW contract's actual bytes — never weaken an assertion to pass (cite `262`'s doctrine).

<!-- END-OF-BRIEF -->
