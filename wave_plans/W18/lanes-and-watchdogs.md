# W18 · LANES 1–6 + WD-α (quality) + WD-β (ERROR LEDGER) — 8 agents, prepared carefully

**All readers share this file.** Read your own section FIRST. Repo: `C:\Users\mnril\Desktop\RapidTool Main`
(Node v22.23.2; git-bash `/c/Users/mnril/Desktop/RapidTool Main`; SPACE in path → ripgrep FAILS, use `grep`).

```text
TREE STATE — READ CAREFULLY, IT IS NOT CLEAN:
- Base commit 4328d20; on top of it sit, uncommitted and interleaved: W16's landings (run-eval.mjs +
  test, headless.ts summary envelope, rapidtool-cli.mjs summary arm, arm-parity test, console.tsx
  DF-18/26, gates/honesty-guards/packet test files, scripts/README-cli.test.mjs lint fix) AND W17's
  landings (220_tasklist_canonical.md fold, llm-tasks.ts, registry.ts+test, deepseek.ts, engine.ts,
  phases.ts, scaffold.ts, compile-check.server.ts+test, .github/workflows/) AND W17's landing logs.
- A boundary run just found 9 failures in src/lib/headless.test.ts (CLI/emit integration subtests:
  E-25, A7, T-07 …). They are attributed to W17's mid/post-edit state in the emit path, NOT to W16's
  landings (headless.ts is byte-identical to 4328d20). THE USER'S RULE FOR THIS WAVE: **log errors,
  keep moving — do NOT stop to chase another lane's failure.** If YOUR targeted test fails, first prove
  whether the cause is inside your box (then fix it) or outside (then write `[EXT-FAIL] <test> <cause
  hypothesis> <evidence>` in your log and CONTINUE). The error-ledger watchdog (WD-β) collects them.
- W17's lanes are finishing/capped (5 stale, watchdog live). Do not touch their boxes; do not touch
  W16's uncommitted files (run-eval.mjs/test, headless.ts/test, rapidtool-cli.mjs, console.tsx,
  styles.css, gates.test.ts, honesty-guards.test.ts, packet.test.ts, README-cli.test.mjs).

⚠️ HOST ARTIFACT: node under Hermes's BACKGROUND harness dies `stdin is not a tty`, exit 1, zero output.
Run all node tests FOREGROUND; that message is never a bug (ledger: C:/Users/mnril/w15_parent_evidence.txt).

QUALITY BAR (owner, verbatim): "production ready code/working code/no mock or buggy bad code allowed."
→ no stubs, no TODO-deferrals, no fake returns, no tests that would pass with your change reverted.
Every claim = the command that produced it. Every landed behaviour = pinned by a test.
Do-not-rebuild list (220_tasklist_canonical.md §2) is BINDING. House style: no eslint-disable.
WRITE EARLY: skeleton + bottom line within ~10 calls (`fixes/249_lane<N>_<slug>.md`). FORBIDDEN:
`npm run typecheck`, `npm test`, `npm run build` (parent/boundary only). Scratch: `C:/Users/mnril/w18l<N>_scratch/`.
Playbook row blocks: research/multiagent/230_task_execution_playbook.md (your row's how-to + traps).
```

## LANE 1 — OV-9 · give `productComplete` its producer (the M-B latch's missing input)
**Owns:** `src/lib/doctor.ts` (+ `doctor.test.ts`), `src/lib/dod.ts` (+ its test file if one exists).
Verified context: the doctor latch is a 6-condition AND whose **two probes have no producer** — `humanFixtures`
(nothing stamps `decidedBy:"human"`) and `productComplete` (sole caller passes no `extra`). This lane owns
**productComplete**; `humanFixtures` belongs to T5.2-A's UI work later (do NOT implement it here; if
productComplete is blocked on fixture state, say so in the log, don't fake it).
Read `doctor.test.ts:81-92` (latch semantics already proven) before writing. The producer must be a REAL
signal derivable from the project state (read what the artifact/P-phases actually carry) — not a flag
someone sets to pass the latch. **Anti-goal: never make the latch passable by asserting it.**
**Done-when:** a test proves the producer fires from real project state and that the latch still REFUSES
when the condition is absent; `doctor.test.ts` green (foreground); one line in the log states which real
artifact-derived value feeds it.

## LANE 2 — F3 · cross-run learning measurement (make "self-improving" falsifiable)
**Owns:** `src/lib/knowledge.ts` (+ `knowledge.test.ts`), the lesson CLI arm in `scripts/rapidtool-cli.mjs`
(lesson/eval arms ONLY — do NOT touch the summary arm, W16 owns it), `scripts/rapidtool-cli-lesson.test.mjs`.
Read `221_feature_designs.md` F3 (the design: `lessonOutcomeReport` + `lesson --effect`) and the playbook's
F3 block. Constraints: T-11 stays MUTED until the owner's OV-11 decision (do not mint lessons from red seals
here); this is MEASUREMENT, not behaviour change — it must count outcomes and label them honestly even when
the sample is too small (a labelled small-N number beats an unlabelled big claim).
**Done-when:** `lessonOutcomeReport` exists, is computed from real run records on disk, and a keyless probe
prints it; the CLI `--effect` arm is reachable and its help/USAGE entry lands (USAGE parity test exists —
`README-cli.test.mjs` — run it and keep it green); tests green (foreground).

## LANE 3 — T4.2 · the git landing tail (new module, the last W15 landing row)
**Owns:** NEW `src/lib/git.server.ts` (+ `src/lib/git.server.test.ts`), the CLI arm if the row needs one
(state it; do not touch the summary arm).
Read the playbook's T4.2 block. `git init` + `commit` behind the human seat (never auto-push, never a
remote operation, never credentials). The `.gitignore` half already landed (verify it, don't rebuild it).
Use child_process spawn with argv arrays (never shell strings), bounded output, and a coded failure when
git is absent. **Done-when:** the module's own test covers: init on a scratch dir, commit with a seat
token, refusal without one, and the git-absent path — all with real temp dirs under your scratch, never
in the repo; `git status` of the repo unchanged by the tests (prove it in your log).

## LANE 4 — T5.5 · plugin / hook registry v1 (in-process only)
**Owns:** NEW `src/lib/plugin.ts` (+ `src/lib/plugin.test.ts`).
Read the playbook's T5.5 block. In-process registry only (no dynamic import of foreign code, no network, no
eval). A hook that THROWS must be a coded, contained failure that names the hook — never a silent catch and
never a crash of the host loop. Versioned shape, explicit registration, deterministic order (registration
order, stated). **Done-when:** tests pin: registration + deterministic dispatch order, a throwing hook's
coded containment (with the host continuing), and a duplicate-registration refusal; suite green (foreground).

## LANE 5 — T5.4 · artifact provenance fields
**Owns:** `src/lib/io.ts` (+ `io.test.ts`), `src/lib/codegen.server.ts` (+ its test) — provenance fields ONLY.
Read the playbook's T5.4 block. Every emitted artifact record gains provenance (what produced it, when, from
which input hash) — additive fields, no renames, no removals (T5.7 will consume this; cite the exact field
names in your log so it can be briefed). **Done-when:** a targeted test proves the fields populate from real
emit data and survive a save/load round-trip (`io.ts`'s serializer); existing suite stays green (foreground).

## LANE 6 — the define-first trio: turn 3 UNVERIFIABLE-NOW rows into executable ones (SPEC ONLY, no code)
**Owns:** NEW `research/multiagent/249_define_first_specs.md` (read-only elsewhere; **zero src/scripts edits**).
For each of **DF-09**, **T4.3**, **G4** (see `220_tasklist_canonical.md` §1E/§1C + `240_missing_tasks_audit.md`):
1. What is being verified, precisely (one paragraph, in the project's own terms).
2. The check's DESIGN: exact entrypoint, input fixture (or how to build it), the observable, and the
   pass/fail rule — real paths only, each verified to exist today (`ls`/`grep` and paste).
3. The failure mode the check must catch, demonstrated by a thought example grounded in code you read.
4. The definition of done for the lane that implements it (a one-line done-when + the command).
Candidates from the audit: DF-09 → extend `src/lib/honesty-guards.test.ts`; T4.3 → `src/lib/patch.test.ts`
+ a scratch edit-cycle probe; G4 → define the scan + its runner (OV-21's advisory intent folds here).
**Done-when:** all three specs complete, every cited path verified on disk, zero code edits.

---

## WD-α — the quality watchdog (`fixes/250_w18_wd_alpha.md`)
READ-ONLY (your report + `C:/Users/mnril/w18wd_a_scratch/`; never edit src/scripts/corpus/lane logs; no git
mutations; ≤2 targeted FOREGROUND test runs). Poll all six lanes ≥4 times with a timestamped action log;
verify ≥10 claims against bytes (boxes respected — any out-of-box or uncommitted-W16/W17-file touch = P1
with git evidence); re-run ONE named test per lane (≤2 runs total); the no-mock/no-stub hunt (a stub, a
fake return, a test that would pass reverted = finding); the help-the-delegator verdict per lane
(on-track/at-risk/stuck + next-dispatch guidance). Bottom line at top.

## WD-β — THE ERROR LEDGER KEEPER (`fixes/251_error_ledger.md`) — the owner's explicit ask
> "log all errors as you go… when all tasks are done, go through all logged errors… spawn 1 watchdog to
> track and record them all. This will save time and produce tasks and then just fixing bugs/bad code after."

READ-ONLY (your ledger + `C:/Users/mnril/w18wd_b_scratch/`; no repo edits; no git mutations; ≤2 runs).
**Your ledger is the single register of every error, everywhere, with a status and a batch-fix plan.**
Build it by reading (all on disk): the W13–W18 logs (`fixes/236..251`), the watchdogs' reports
(`fixes/238,239,242,243,245,248`), the W17 lanes' outputs when they land, and by RUNNING the two most
diagnostic commands yourself as the wave's living evidence:
`node --experimental-strip-types --test --test-concurrency=2 src/lib/headless.test.ts` (currently 83/92 —
the 9 CLI/emit failures; attribute each to a file+owner) and `npm run lint` (must be 0 — the README-cli
regex fix landed; if not 0, that is finding #1).
**Ledger schema (markdown table, append-only):** `# · ts · wave/lane · what failed (exact test/command) ·
attribution (file:line or EXT-FAIL) · current status (OPEN/FIXED-STRIKED/FIXED-APPLIED/MID-EDIT/ENV) ·
fix owner (lane/parent) · batch-fix note`. Include EVERYTHING already on record: the 3 env-artifact false
failures, `fixes/236`'s 3 precision strikes, WD-2's 4 precision items, the open `RT_EVAL_*` classification
outcome, the W16 lint defect (FIXED by parent), the 9 headless failures (MID-EDIT/OPEN with attribution),
W17's landing status, and any finding the W13–W18 watchdogs raised. **Nothing is too small; nothing is
dropped; every row has a status.**
**Done-when:** the ledger covers every recorded error with a status + owner + batch-fix note; its bottom
line says `total errors logged: N · open: N · fixed: N · env-artifact: N · batch-fixable-now: N` and names
the batch-fix order (severity first: real regressions → precision items → cosmetics). Skeleton FIRST
(the table headers + the first rows within ~8 calls), then fill.
