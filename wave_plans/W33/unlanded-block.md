# W33 · THE UNLANDED BLOCK — land what recon-only lanes left; close the two reds; paste the owed appends.
**Readers share this file.** Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; `grep`). HEAD=`0f85c32` + ~2,700 uncommitted insertions (the whole W29–W32 era). Static gates: typecheck+lint GREEN (as of 18:3x, parent-registered).
**CONTRACT (all lanes):** smallest honest patches · additive only · `TODO(<id>)` at the exact logic line · no fake behavior · targeted checks only (NO full gates, NO keyed calls) · log-and-continue · lane log EARLY (`fixes/276_u<n>_*.md`) · appends to `finalsprint.md`/`thoroughanalysis.md` via their END-MARKER protocols (re-read before EVERY append).
**READ FIRST:** `START-HERE.md` (the new wayfinding doc) · `finalsprint.md` (master table + §S/§T/§WDX history) · your rows in `research/multiagent/thoroughanalysis.md` · the W30 brief `wave_plans/W30/shell-sprint.md` (the shell contract) + `wave_plans/W31/gap-finshers.md`.

## U1 — UNIVERSALITY (S2's block, unlanded: recon only). Read `fixes/272_s2_universality.md` (its touch-point map + constraints) FIRST.
Land, per S2's map and §R3-f06/§A3-f05/f07/§R3-f02/f03:
1. **`scaffold.ts`** — per-kind wiring: game gets `vite.config.ts` pushed (mirror the webapp branch at ~:2529) + a real `main`; cli-tool gets `bin` + runnable entry; library gets `exports`/`files`/`main`; service gets PORT wiring + a start script. The throwing `main()` becomes a STRUCTURED stub: importable, exports the declared surface, throws only when actually RUN, message keeps the `RT_E_VALIDATION · ` prefix AND the canonical `TODO(E-15)` marker (both swept by tests: `scaffold.test.ts:338`, `emitted-honesty.test.ts:42`).
2. **`scripts/run-eval.mjs`** — per-kind `expectedBehavior` structure in the graders (checked shape; assertion logic TODO-marked) + the `verification` label carried through acceptance/packet output (populate honestly: "files+content only" until graders land).
3. **The emitted-UI hook (A3-f07)** — a `uiGeneration` hook type in the emit envelope + the single call point in scaffold (no-op returning the current name-dump, TODO-marked).
4. **`codegen.server.ts`** — R3-f02: reword the P6 prompt's CJS rule (rule 2, ~:465/:482) to ESM named exports (text-only change).
5. **R3-f03** — `redTree`/`partial` on the emit envelope + `capability.N` skip-with-reason structure in capScan output (one skip path; TODO the full mapping).

## U2 — S1'S REMAINDER + THE SUPERVISOR WIRE. Read `fixes/272_s1_autonomy.md` + §R14-f01 FIRST.
1. **Wire `src/lib/wild-review.ts`** (exists, syntax-clean): pass `opts.reviewer` built via `createNodeWildReviewer()` at the real call sites — `store.ts:1105`'s wild driver + `headless.ts` wild macros (~3624/3805) — additive, guarded (null ⇒ existing behavior byte-identical). Done-when: keyless runs unchanged (wild-step tests green); a keyed bare-Node wild run would log `wild.review (classifier)` (cannot run keyed — the guard + log line is the shell).
2. **`checkpoint.server.ts`** (NEW): write/read a bounded checkpoint beside `.rapidtool/` (`WriteCheckpoint`/`ReadCheckpoint`, `RT_E_CHECKPOINT_MISSING` refusal on read-absent — the code exists in errors.ts). One guarded call site at the engine/store's per-phase commit (TODO the full state set).
3. **The `resume` CLI verb** in `rapidtool-cli.mjs`: parses `--project`, reads the checkpoint, and REFUSES with `RT_E_CHECKPOINT_MISSING` until the writer wiring completes; register the arm in USAGE + the README-cli row (doc-parity: the `README-cli.test.mjs` count/list pins — run that test file after).
4. **The unattended command** (`run --unattended` flag or a small verb): refuses with `RT_E_UNATTENDED_UNSUPPORTED` naming the W-01/W-02 sign-off + host requirement (the code exists).
5. **`readWildPlan` call site** (types exist in types.ts): a read-only accessor used by U3's UI pane (expose `project.wildPlan` via the console's existing read path; no plan generation yet — TODO(R13-f02)).

## U3 — THE UI SURFACING (S5's Part B, unlanded). Read `fixes/272_s5_finish_ui.md` (its S5 plan) + §R6's worklist.
`src/components/console.tsx` (additive ONLY; re-read first — many hands touched it): surface, each with honest states per the FixturesPanel pattern (state visible, refusal named, disabled-with-reason in `title` — never an enabled no-op):
- **plan**: a read-only line/section ("no plan yet — TODO(R13-f02)") reading U2's accessor.
- **checkpoint/resume**: a read-only line when a checkpoint exists; the `resume` refusal surfaced where runs are launched.
- **unattended**: the coded refusal visible on the launch control (title or helper text).
- **stream/cassette**: flags/labels naming "not yet wired" honestly (disabled, reason in title).
- **seat**: reflect S4's seat hook read-only (or wire the button if safe).
- **isolation/streaming refusals**: honest labels where relevant.
Then append §S5 to `finalsprint.md` (the additive UI list).

## U4 — THE CLOSER: the 2 reds + the 8 owed appends. Read the lane logs FIRST.
1. **Fix `headless.test.ts` "not ok 10"** (`fixes/144 (M4-2) — driveP6Journey (fake-deps: deterministic, no key/fs/runner)`): run the leg, read the failure, fix the CAUSE (likely a volatile-byte class — see WDX-3's `stripVolatiles` precedent in `wild-step.test.ts`; do NOT weaken the assertion's intent). Done-when: the leg 0 fails.
2. **Fix the E-25 CLI machine-contract red** (`node --experimental-strip-types --test` the file with that test; likely an envelope/exit drift from the seat two-channel or new refusal paths): fix the drift or the pin — evidence either way.
3. **Paste the owed appends** into `finalsprint.md` (each lives VERBATIM in its lane log — re-read the marker first; append-only, one block, attribution per section):
   - §T1 ← `fixes/273_t1_register_rows.md` · §T2 ← `fixes/273_t2_r15.md` · §T3 ← `fixes/273_t3_r13.md` · §T4 ← `fixes/273_t4_defined.md` · §T5 ← `fixes/273_t5_board.md` (the 15.6 KB board map — paste the verdict table) · §WDX-2 ← `fixes/274_wdx2.md` (the audit + **RS-01…RS-04 corrections**) · §WDX-3 ← `fixes/274_wdx3.md` (the wires + for-next-wave list).
   - Mark each pasted block with its source log path. If a log's section is already reflected, note "already live" instead of duplicating.
4. **Apply WDX-2's 4 master-table corrections** to `finalsprint.md`'s master table — as an append-only `§MASTER-CORRECTIONS` block (never edit the table in place; the corrections block wins).

<!-- END-OF-BRIEF -->
