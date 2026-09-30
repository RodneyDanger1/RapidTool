# 319 · T3 — THE BACK-END MONITOR (RapidTool W44 Phase-2 keyed trial)

Lane: T3. Task: watch processes/reap, catalogue NDJSON streams, hunt API-usage evidence, read emitted
code per build, deliver real-vs-shell verdicts. No repo product edits; no key spending; read-only verbs only.

Trial root: C:/Users/mnril/w44_trial/{website,game,program} · wrapper: C:/Users/mnril/w44_trial/rt.sh
Repo: C:/Users/mnril/Desktop/RapidTool Main (HEAD cdf2510 + a3ebcdf, tree clean)
Scratch: C:/Users/mnril/w44_t3_scratch/

## TIMELINE (append-as-you-go)

- [t0] Lane start ~10:47. Trial dirs exist (website/game/program) but EMPTY (T1 not started yet).
  fixes/ dir confirmed in repo. Writing log first per rule 1.

## PROCESS BASELINE (pre-T1)

- [10:51] `tasklist | grep -i node.exe` → EMPTY. `ps -W | grep -i node` → EMPTY. Baseline: zero node processes.

## PROCESS SAMPLES (watch.sh @20s → w44_t3_scratch/procwatch.log)

- [10:52:30] sample0: 2 transient node.exe (pids 15024/10212, paths under AppData/Local/hermes/node — Hermes-internal, not RapidTool). website: 4 files.
- [10:53:13..10:53:39] samples1-3: zero node procs (T1 idle between commands). website rows frozen at 3.

## NDJSON CATALOGUE — website (build #1)

Stream: C:/Users/mnril/w44_trial/website/.rapidtool/logs/rapidtool.ndjson (3 rows, session cli-muoaa2fi)

| # | event | phase | code | msg / payload |
|---|-------|-------|------|----------------|
| 1 | wild.step_start | P0 | — | payload {phase:0, action:"execute"}; runRef 1790783536312 |
| 2 | wild.step_paused | P0 | RT_E_GATE_PENDING | "P0 is a human-only gate." payload {outcome:"paused", action:"park", artifacts:3, nextPhase:0, nextAction:"gate"} |
| 3 | cli.invocation | — | — | "wild exit 0" payload {cmd:"wild", exitCode:0} |
| 4 | cli.invocation | — | — | "emit exit 0" (10:54:13) |
| 5 | cli.invocation | — | — | "diagnose exit 0" (10:55:18) |
| 6 | cli.invocation | — | — | "diagnose exit 0" (10:55:53, 2nd diagnose) |

Envelope 02_wild.out: ok:true, action:"start", outcome:"paused", steps:1, changed:true, nextAction {kind:"approve", cmd:"approve", phase:0}, note "P0 is a human-only gate."
**budget block: {spent: 0, cap: 5000000, stop_reason: null}** (cap armed by wrapper; spend 0 — no LLM call on this path).

PARK ANALYSIS: build.json carries `"forceHuman": true` — the website brief (\"W44 Trial — Harbor and Pine (website)\")
minted the P0 reframe class. Park detail (from build.json, twice): \"…the agent seal refuses it (R3/B-03):
opening it would need an autopilot.force policy rule that would also open the CLI 'approve --force' door.\"
⇒ the run DID carry --agent-seal, and the seal correctly refused a human-only gate (engine.ts:4292-4297). By design (317_j2 §5).
Root cause (T1 log §a-02, verbatim): scorecard overall=7.2 verdict=reframe; `lattice.vague` = \"LEX gap: brief matched no
job/entity vocabulary\" — the plain marketing-website brief has ZERO LEX register hits → vague → HR-1 forces reframe → forceHuman gate.

Timing: rows 1-3 inside ~90ms. No stalls. No 'human' claims anywhere in rows (seat absent, decisions[] empty, hitl forceHuman w/ zero approvals).

### website — STOP-STATE SUBTLETY (observed, recorded)

- On DISK (build.json, re-read at 10:57): wildRun `{active:true, pause:true, park:{...RT_E_GATE_PENDING...}, stoppedAt:null}` — run still active+paused.
- The later `diagnose` output (06_diagnose.out) presents wildRun as `{active:false, pause:false, stoppedAt:<diagnose-ms>, lastAutoLog:<seal-refusal>}` —
  a read-time "session-break honesty" sanitized VIEW (engine.ts:2228-2239: a live run cannot outlive the driver; non-preserveActive load force-stops in-memory only).
- Net: two divergent readings of the same project depending on command; disk stays the truth. Worth a code-read if the fixer lanes touch wild resume semantics.

## NDJSON CATALOGUE — game (build #2)

Stream: C:/Users/mnril/w44_trial/game/.rapidtool/logs/rapidtool.ndjson (3 rows, session cli-muoafqwz)

| # | event | phase | code | msg / payload |
|---|-------|-------|------|----------------|
| 1 | wild.step_start | P0 | — | payload {phase:0, action:"execute"}; runRef 1790783801207; ts 10:56:45.764 |
| 2 | wild.step_paused | P0 | RT_E_GATE_PENDING | classifier-reject critique (~1200 chars) — see below; ts 10:56:55.485 (Δt ≈ 9.72s ⇒ keyed classify call) |
| 3 | cli.invocation | — | — | "wild exit 0" |

Envelope 02_wild.out (game): outcome:"paused", steps:1, **budget {spent: 2728, cap: 5000000, stop_reason: null}** — FIRST REAL SPEND EVIDENCE (see API section).
Park: `{code:"RT_E_GATE_PENDING", event:"wild.paused", unlock:"human-gate", resumePhase:0, resumeAction:"advance", at:1790783815484}`;
lastStep {outcome:"paused", action:"park", completedPhase:0, artifacts:4, nextAction:"advance"}; **hitl:null, decisions:[], rejections:0, rejectionHistory:[]**.
Classifier critique (verbatim head): "The phase artifacts do not deliver the substance the P0 brief requires. The scorecard is internally contradictory: it claims a \"custom-software\" domain with a single generic job (\"deliver-core-workflow\") and one entity (\"player\")… no evidence of actual domain landscape research (no comparison of canvas/WebGL/DOM approaches, no library survey like Phaser vs. vanilla…) … the \"DoD gate\" asserts PASS with only an evidence hash…" ⇒ the keyed Auto-Review classifier REJECTED the shallow P0 artifacts. The park is a human-gate pause with resumeAction "advance" (NOT a forceHuman refusal like website).

## _lexprobe (T1's scratch probes, 10:55)

- Files: _lexprobe/{lexweb,lexgame,lexcli}.{create.out,json,wild.out} + shared NDJSON.
- KEYLESS probes (`enforceDod:false`, `budget.cap:null`): all THREE advanced P0→P1 via `wild.step_ok` "Wild step advanced" (deterministic floor, no classifier without key).
- Purpose (evident): find brief wording whose vocabulary hits the LEX register so P0 doesn't go vague→reframe. The game brief (\"Breakout-style arcade game… paddle + ball + score display + win/lose state…\") DID pass the P0 execute stage (no reframe park) — it then died on the keyed classifier reject instead.

## API USAGE EVIDENCE

- Cap armed: RAPIDTOOL_TOKEN_CAP=5000000 (wrapper). Surfaces: `budget {spent, cap, stop_reason}` in create/wild/emit envelopes.
- website: spent 0 (no LLM call — deterministic P0 + park; emit floor). game: **spent 2728** after the classifier review call (Δ ~9.7s).
- NO token/usage/cost rows in either NDJSON stream (no llm.* events, no usage payloads). NO 402/no-balance rows anywhere. cap-warning: none (2728/5000000).
- doctor `--tree` spend surface: `{"measured": false, … "line": "spend: none measured (no token-ledger sample handed in — keyless/unmetered or pre-synthesis; never estimated)"}` — for the parked website tree the census CANNOT show spend.
- ⇒ Honest interim finding: spend is surfaced ONLY as a per-invocation aggregate (`spent` tokens) in the CLI envelopes; per-call/per-phase decomposition + $ cost are NOT surfaced anywhere the monitor can see (no prices supplied by design).

## NDJSON CATALOGUE

(pending builds)

## API USAGE EVIDENCE

(pending)

## EMITTED CODE REVIEW

(pending: doctor census + file reads + hand-run per build)

## VERDICTS

(pending)

=== END 319_t3_backend_monitor — PARTIAL ===

---

## [PARENT-APPENDED] Completion from T3's capped summary (2026-09-30, deleg_0d486f19 task-2)

*(T3's closing VERDICTS were pending at cap; appended verbatim-trimmed from its summary.)*

### Backend narrative
- Both keyed builds **PARKED AT P0** — no run reached `wild.complete`; zero `[seat agent-seal]` rows on any build.
- **website:** zero LEX hits → `lattice.vague` → 7.2 reframe → `forceHuman` P0 → seal refuses (`engine.ts:4292-4297`). 0 tokens. Honest 16-file stub-skeleton emit after.
- **game:** LEX pass (7.6 proceed), DoD PASS (0 unmet), keyed classifier REJECTED the floor, retried 2/2 with backoff (independently verified in `build.json.logs[8,9]`), parked `resumeAction:"advance"`. 2728 tokens.
- **_lexprobe (keyless):** 3/3 advanced P0→P1.

### Process watch / reap
Baseline 0 node procs; ~20s sampling (`w44_t3_scratch/procwatch.log`). **No stray/zombie RapidTool processes** — nothing outlived a command. Wild steps in-process; only the emit tree-run spawns a transient bounded child.

### NDJSON ≠ the whole story
Streams carry only `wild.step_start` / `wild.step_paused` / `cli.invocation` (~3-6 rows). Seat rows, retries, verdicts, park codes live in `build.json.logs`, NOT in the NDJSON. No `wild.step_ok`/`wild.complete`; no 'human' claims anywhere; `decisions:[]` always.

### API usage (honest finding)
Cap armed (`RAPIDTOOL_TOKEN_CAP=5000000`). First spend evidence = game `budget {spent:2728, cap:5000000, stop_reason:null}` after a ~9.7s classifier call. No 402s, no cap warnings, no per-call decomposition, no $ cost surfaced anywhere (no price catalog ships by design). Spend appears only as a per-invocation aggregate in CLI envelopes; doctor spend = "none measured… never estimated".

### Emitted-code verdict (real vs shell)
- website 16 / game 17 files — both `doctor --tree`: **real:0, stubs:1, reexports:0 → "stub-skeleton"**, `greenWhileStubbed:true`, `oracleStubTrap:true`.
- Hand-ran: `npm test` **5 pass / 1 skip / 0 fail, exit 0** (identical to emit's tree-run). Real functional code = `src/state/store.ts:10-20` (`CheckpointStore`) only; `routes.ts:15-22` + `deliver_core_workflow.ts:9-12` throwing `TODO(E-15)` stubs; `console.tsx` shell; orc-1 "pass" is `assert.rejects` ON the stub (K4 trap).
- **VERDICT: PARTIAL / honest scaffold — NOT working software.** The "one module wearing filenames" skeptic case is **confirmed for the job layer** (the Breakout brief got a `deliver-core-workflow` job). Labels honest, tests green, but **real:0 ≠ the ≥3 multi-module ambition bar.**

### T3 issues (parent queue — cross-linked)
LEX coverage (dup of T1 F-A / FINDING-1) · diagnose wildRun divergence (dup of T1 F-D / T2 BUG-2) · byte-truncated reject/park strings (dup of T1 F-C).

=== END 319_t3_backend_monitor — COMPLETE (T3 partial at cap; parent appended verdicts from summary; dup findings cross-linked) ===
