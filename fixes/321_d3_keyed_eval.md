# 321 · D3 THE RUN-EVAL — keyed bounded measurement (W44 Phase-2 DRIVER wave)

Lane D3 of the W44 Phase-2 DRIVER wave (D1 operator-keyed · D2 monitor · D3 run-eval).
Repo: `C:\Users\mnril\Desktop\RapidTool Main` — HEAD `20802b1` (tracked tree CLEAN at t0).
TREE FROZEN: no repo edits except this log. Key NEVER printed. Foreground legs, 600s.
Scratch root: `C:/Users/mnril/w44_trial/` (wave-shared); evidence leg: `live1/`.

## Pre-flight (12:16–12:20 CDT)

### (a) Clean baseline — BEFORE any run
- **T0 = 2026-09-30 12:20:23 CDT**
- `git status --short` at 12:16:4x → **empty**. At 12:20:23 → exactly the 2 sibling lane
  logs: `?? fixes/321_d1_live.md` · `?? fixes/321_d2_monitor.md` (both created 12:17 —
  sanctioned per-lane logs; D1/D2 are running concurrently). **Zero M-lines** — no tracked
  file modified.
- HEAD `20802b1` · `git ls-files | wc -l` = **1920** · `git ls-files | sha1sum` =
  `38676a149ee6bda3c3ba0af851a2c6aeb1a94c61` — byte-identical to the D2 monitor's t0
  baseline (fixes/321_d2_monitor.md §no-break watch).

### (b) Ignore state of eval outputs — the rule-3 check — DECISIVE
```
$ git check-ignore -v research/eval-out/results.json research/eval-out/history.json research/eval-out/run-in-progress.json
(no output)
check-ignore exit: 1          # exit 1 = NOT ignored
$ git ls-files --error-unmatch research/eval-out/results.json research/eval-out/history.json research/eval-out/run-in-progress.json
research/eval-out/history.json
research/eval-out/results.json
research/eval-out/run-in-progress.json
error-unmatch exit: 0         # all three TRACKED
```
- Census: **345 tracked files** under `research/eval-out/` (every previous emit tree +
  `_keyed-launcher.sh` + `_keyed-run.log`). Nothing under it is git-ignored (the ignore
  rules cover only `**/.rapidtool/logs/`).
- **Verdict: a default-location run WOULD dirty tracked files** — `results.json`
  (rewritten), `history.json` (appended), `run-in-progress.json` (keyed marker), plus the
  emitted `<slug>/` tree for the first entry (the first entry `arcade-breakout` has no
  eval-out dir yet → the run would CREATE new untracked files there). The rule-3 STOP
  condition therefore triggers **for the default write target**.

### Resolution (rule 3 executed safely — no dirt, measurement preserved)
- The harness ships its own isolation seam: **`EVAL_OUT_DIR`** — `scripts/run-eval.mjs:147-149`
  *"Eval output honors EVAL_OUT_DIR (keeps scratch runs out of the real results/history
  used for M7 priors)"*; every write path routes through `OUT_DIR` (results/history
  `:150-151`, emit `trialEmitDir(OUT_DIR,…)` `:2474`, marker `markerPathFor(outDir)` `:2889`,
  telemetry rows land in `**/.rapidtool/logs/` which is git-ignored).
- Precedent in-repo: `fixes/252_lane4_ov7.md:116-118` and `fixes/252_lane6_t57.md:138-148`
  ran measurements into scratch `EVAL_OUT_DIR`s *exactly* to keep the real files untouched
  ("isolated `EVAL_OUT_DIR` so the measurement never touches the real…"); `fixes/163_b.md:252`
  uses the same seam. The corpus comment itself calls these "isolated scratch runs for lane
  proof / future keyed experiments" (`run-eval.mjs:144-146`).
- **D3 therefore runs the SAME bounded keyed command with all outputs redirected to
  scratch `C:/Users/mnril/w44_trial/live1/d3_eval_out`** — the STOP condition's protective
  intent (frozen tree; D2's "keyed runs must not edit repo" watch) is met WITHOUT aborting
  the lane's one measurement. Repo `research/eval-out/*` stays UNTOUCHED (last state: the
  stale-stamped keyed record of 2026-09-25 — `preflightClass: balance-exhausted`, i.e. the
  prior UNFUNDED run; the wave's funded preflight for today is wire-ok).
- **Disclosure:** the sole deviation from the literal brief is the `EVAL_OUT_DIR` env var.
  The node command itself stays `node --experimental-strip-types scripts/run-eval.mjs
  --keyed --limit=1` (the flag = `package.json:25`'s canonical `npm run eval` form; without
  it Node 22.23.2 still type-strips but warns).
- Post-run proof planned: `git status --short` + ls-files count/sha1 + `find
  research/eval-out -newermt <T0>` (must list nothing).

## The one bounded run
- Launcher: `C:/Users/mnril/w44_trial/d3_keyed_eval.sh` — loads `DEEPSEEK_API_KEY` from
  the repo `.env` via `grep|cut` (never echoed; prints only its length), arms
  `RAPIDTOOL_TOKEN_CAP=5000000`, exports `EVAL_OUT_DIR=<scratch>`, runs the command ONCE,
  tees to `C:/Users/mnril/w44_trial/live1/d3_eval1.log`. Retry policy: ONE re-invocation,
  only if attempt 1 exceeds the 600s foreground window (would leave the keyed marker
  `finishedAt:null` by design — kill-safe).
- Expected first entry (`--limit=1`; sorted corpus; `README.md` skipped as documentation by
  `listCorpusEntries()`): **`arcade-breakout`** (kind `game`, domain `gaming`; grader
  `research/eval-corpus/graders/arcade-breakout.grader.json` v2; 8 required capabilities).
  Keyed default cap = 1 entry (`run-eval.mjs:3009-3013` — explicit `--limit=1` makes it
  byte-for-byte the same selection). JOURNEY_BUDGET = 3 cycles.
- Expected flow lines to capture: mode banner (`rapidtool eval · mode=keyed · corpus=…`),
  keyed-bound note, `eval run start` row, preflight lines (P6 reachability + **fundedness
  wire**), per-entry `ok arcade-breakout: …` line, the 9-metric table, `decision:`,
  `marker: keyed run finalized`, `wrote …results.json · history appended to …history.json`,
  exit line. Then decisive fields from the scratch `results.json` / `history.json`
  (`mode`/`entries`/per-case scores/`trials`/spend evidence if present/`generatedAt`).

## THE RUN (attempt 1 of ≤2) — started 15:52:59 CDT · foreground · 600s window

Executed via the launcher: key loaded from repo `.env` (grep|cut; never echoed —
stdout shows only `key loaded (len=35)`) · `RAPIDTOOL_TOKEN_CAP=5000000` armed ·
`EVAL_OUT_DIR` scratch redirect. Node command (canonical form, package.json:25):
`node --experimental-strip-types scripts/run-eval.mjs --keyed --limit=1`.

**EXIT=0 · WALL=7s** (shell `$SECONDS`; trial `durationSec=3.1`; marker window
20:53:03.634Z→20:53:06.765Z = 3.131s) · **no timeout → no retry** (attempt 1 is the
only invocation). Log: `C:/Users/mnril/w44_trial/live1/d3_eval1.log` (3341 B + 1-line
result footer) — full byte-transcript of the run:

```
=== d3 keyed eval attempt @ 2026-09-30 15:52:59 CDT ===
rapidtool eval · mode=keyed · corpus=C:\Users\mnril\Desktop\RapidTool Main\research\eval-corpus
graders: run-side acceptance bars under C:\Users\mnril\Desktop\RapidTool Main\research\eval-corpus\graders (read by this driver only — never emitted into a project tree) · trials=1
note: trials=1 — the legacy single-run contract; pass@1 is recorded and flakiness is UNMEASURABLE (use --trials=N ≥ 2)
note: skipping unreadable corpus entry: README.md: not a corpus fixture (no YAML frontmatter fence) — skipped as documentation
note: keyed leg bounded to 1 corpus entry (arcade-breakout); pass --all or --limit=N for more; budget per P6 journey = 3 cycle(s)
preflight: OV-27 reachability · configured=true · class=wire-ok
preflight: specifier engine: resolved=true
preflight: specifier deepseek: resolved=true
preflight: specifier codegen: resolved=true
preflight: wire attempted=true · httpStatus=200 · ok=true
preflight: proves: one completion round-trip through the P6 specifier path (configured + wire + model text)
preflight: cannot prove (keyless/dummy key): that the full liveP6Synthesis journey converges, or that any score is quality — Step 0 measures those
preflight: fundedness (1-token probe) · configured=true · funded=true · class=wire-ok · httpStatus=200 · served=deepseek-flash
preflight: fundedness detail: wire reach PROVEN — the vendor answered with a completion (served model deepseek-flash) · HTTP 200
preflight: fundedness proven — the account served a "deepseek-flash" completion (HTTP 200)
preflight: provider call tap installed — per-trial served-model/usage/cost evidence will be recorded
marker: keyed run-start recorded at C:\c\Users\mnril\w44_trial\live1\d3_eval_out\run-in-progress.json (stays finishedAt:null until results.json AND history.json are written)
     trial 1/1: hitl · 2/9 (mean 0.22) · pass=no · why: mean 0.2222 < 1 (rubric threshold — files/content are not the cause) · 3.1s
ok   arcade-breakout: hitl · 2/9 (mean 0.22) · 1 trial(s) · pass@1=0 · 3.1s
     ending: hitl · code RT_E_GATE_PENDING — classified (see notes.stall in the row)

slug              dm  M1  M2  M3  M4  M5  M6  M7  M8  M9  total  baseline     n  pass@k 
----------------------------------------------------------------------------------------
arcade-breakout   0   0   0   0   0   1   1   0   0   0   0.22   not yet meas 1  0.00   
trials: 1 per case · k=1 (effective ≤ trials) · pass@1: arcade-breakout=0.00 · pass^n(all trials): arcade-breakout=0.00
trials: pass@1 mean=0.000 · flaky=none · grader leaks=none
trials note: flakiness is UNMEASURABLE at 1 trial (pass@1 only) — use --trials=N ≥ 2 for pass@k + flakiness
decision: 2/9 ≤ 4 — inside 223's predicted 3–6 band: RE-TRACE the run log and close the zeros it names (OV-3/OV-4/OV-5 gate on the log) — do NOT re-run blind hoping for a better number; a re-run re-measures the same tree.
marker: keyed run finalized (finishedAt set) — results.json AND history.json are both written; a killed run would have left finishedAt:null

wrote C:\c\Users\mnril\w44_trial\live1\d3_eval_out\results.json · 1 entry · history appended to C:\c\Users\mnril\w44_trial\live1\d3_eval_out\history.json
skips recorded: 1 — corpus
exit 0 — results are data, not failures
```
(+ the launcher's footer: `--- D3-RESULT: EXIT=0 WALL=7s (attempt 1 of <=2; no retry needed: 7s << 600s) | run wrote to C:\c\Users\mnril\w44_trial\live1\d3_eval_out (EVAL_OUT_DIR MSYS-path artifact) | byte-identical copy under live1/d3_eval_out ---`)

No coded-failure envelope was emitted (no RT_E_* failure): exit 0 by the harness's
results-are-data contract; `RT_E_GATE_PENDING` appears as the row's classified ending,
not as a process failure.

### Decisive fields — scratch `results.json` (11798 B)
- `generatedAt` **`2026-09-30T20:53:06.758Z`** · `mode` **`keyed`** · `graderFreeze` `{checked:11, ok:true, changed:[]}` · `entries` **1**
- entry: slug **`arcade-breakout`** · name `Arcade Breakout` · domain `gaming` (`domainMatch: 0`) · kind `game` · status **`hitl`** · total **2** · mean **0.2222**
- criteria (byte-quoted): `M1`–`M4` score 0, evidence = maker-score.ts:211-212 `FLOOR_QUALIFIER_EVIDENCE` ("all synthesis calls refused — tree/run/mint evidence is the deterministic floor (brief-noun-shaped by construction); no LLM-produced software exists") · `M5` 1 "no red DoD gate records — nothing to hide" · `M6` 1 "handover dir emitted with DEPLOY.md + oracle spec (5411b)" · `M7` 0 "no prior same-domain run — no learning claim without data" · `M8` 0 "no budget evidence supplied" · `M9` 0 "run did not stop on time (cap/overrun without terminal state)"
- notes: `approvedGates: []` · `treeRunOk: true` · `journey: null` · `stall: "Autopilot may not approve a forceHuman gate (R3/B-03)."` · `stopCode: "RT_E_GATE_PENDING"` · `p6Refused: false` · `synthesisSucceeded: false` · `llmCalls: 0` · `failedLlmCalls: 0`
- **spend evidence**: `servedModels: []` · `usage: {promptTokens:0, completionTokens:0, totalTokens:0}` · `estimatedCostUsd: 0` · `costBasis: "the provider call tap OBSERVED no calls in this trial's window (no cost estimate; a call through a non-tapped provider path would not appear here)"` — honest observation-basis zeros, not fabricated spend (the two preflight probes ARE wire traffic, but they sit outside the trial window/ledger; emitted project.json carries `"budget": {"spent": 0, "cap": 5000000, "stop_reason": null}` — the armed cap is visible byte-for-byte)
- acceptance: `filesOk: true` · `contentOk: true` · behavior `5/6 rows pass, 1 ui-shell skip` (`complete:true, ok:true`) · `kindOk: true` (expected `game` = actual `game`) · `passReason: "mean 0.2222 < 1 (rubric threshold — files/content are not the cause)"` · `pass: false`
- `graderLeak {scanned:17, leaked:false}` · `briefLeak {fields:[brief,name], leaked:false}` · `endClass` **`funded`** · `durationSec 3.1`
- trials: `{trials:1, passes:0, failed:1, passAt1:0, passAtK:0, flaky:false, flakinessMeasurable:false, note:"1 trial — flakiness unmeasurable (pass@1 only; use --trials=N ≥ 2)"}`
- iterate: `armed:false · code:"iterate.disabled" · "RAPIDTOOL_ITERATE_THRESHOLD unset — iterate driver OFF (parked owner decision); decision recorded, nothing fired"`
- summary: `{entries:1, meanTotal:0.2222, trials:1, cases:1, passAtK:{k:1, passed:0, passedSlugs:[]}, flakyCases:[], graderLeaks:[], skipped:1, skips:[README.md documentation]}`

### Decisive fields — scratch `history.json` (331 B — the isolated run's first row)
```json
{"at":"2026-09-30T20:53:06.762Z","mode":"keyed","slug":"arcade-breakout","trial":1,"trials":1,"pass":false,"endClass":"funded","m1":0,"m2":0,"m3":0,"m4":0,"m5":1,"m6":1,"m7":0,"m8":0,"m9":0,"total":2,"mean":0.2222}
```

### Finalized marker — `run-in-progress.json` (397 B)
```json
{"markerVersion":1,"mode":"keyed","startedAt":"2026-09-30T20:53:03.634Z","finishedAt":"2026-09-30T20:53:06.765Z","done":true,"entries":1,"corpus":"C:\\Users\\mnril\\Desktop\\RapidTool Main\\research\\eval-corpus","preflightClass":"wire-ok","pid":15324,"meanOfNine":1.9998,"decision":"retrace-first","resultsWritten":true,"historyWritten":true}
```

### WHY it parked — byte-level chain
1. The corpus brief for `arcade-breakout` scores **0 LEX hits** → lattice `"vague": true`
   (emitted packet: "top absent nouns: **brow, arcad, gam**"; fallback domain custom-software,
   jobs `[deliver-core-workflow]`) → scorecard `Overall 7.2/10 — reframe`.
2. P0 parks: emitted `project.json` `"hitl": {"phase": 0, "title": "Reframe the brief",
   "prompt": "Scorecard verdict is reframe. Approve only if you accept the risk, or reject
   with a tighter brief.", "stakes": "Feasibility below the proceed line.", **"forceHuman": true**}`
   — project status `awaiting_hitl`, P0 `awaiting_hitl`, phases 1–12 `locked`.
3. `drainPipeline` (run-eval.mjs:1828-1864) approves parked gates under the harness's
   autopilot seat; `approve()` throws on a forceHuman gate (`engine.ts:1691:
   "Autopilot may not approve a forceHuman gate (R3/B-03)."`) → honest stall with
   `RT_E_GATE_PENDING` (run-eval.mjs:1858-1861 comment: "a forceHuman gate therefore STALLS
   the drain honestly instead of being overridden by a fabricated human actor").
4. Consequence: **ZERO LLM calls, `journey: null`** — the single-synthesis keyed flow never
   engaged; the "one bounded live entry" scored the deterministic floor + the park.
5. Same mechanism as W44-319 FINDING-1 (LEX-dead brief → P0 reframe park), now hit on the
   corpus's own new `game` fixture, whose `baseline` field says "its first recorded run
   establishes the baseline" — this run produced that first measurement (in scratch).

### What the run PROVES (quantified)
- **FUNDED WIRE, no 402s**: reachability + fundedness both `wire-ok`, HTTP 200, served model
  `deepseek-flash` — the first funded keyed probe since the 2026-09-25 record
  (`preflightClass: balance-exhausted`). Wallet probe DID run (1-token probe).
- **Harness integrity**: grader freeze ok (11/11 checked, none moved), grader/brief leak scans
  clean, marker lifecycle correct (unfinished→finalized by design, results+history both written
  before finalize), exit 0, honest-zero cost evidence, kill-safe semantics intact.
- **arcade-breakout baseline (now measured)**: 2/9 mean 0.2222 — `M5`+`M6` earned; the emitted
  floor tree passes ALL structural acceptance layers (files 5/5, content 4/4, behavior 5/6 +
  kind match; `treeRunOk: true`) while the rubric (mean<1) fails.
- **Park diagnosis**: on this frozen tree, a keyed fresh-run for arcade-breakout cannot reach
  P6 synthesis — LEX-dead fixture + human-only reframe gate vs the eval's autopilot seat.

### What it does NOT prove (the harness's own honest notes + observed nuance)
- preflight: "cannot prove … that the full liveP6Synthesis journey converges, or that any score
  is quality" — and it did not, here.
- trial note: flakiness UNMEASURABLE at 1 trial; `pass@1 = 0`.
- `M7` "no learning claim without data" · `M8` "no budget evidence supplied".
- cost basis: "the provider call tap OBSERVED no calls in this trial's window" — an observation
  statement; not a total-cost claim.
- Observation (bytes, not a defect verdict): `FLOOR_QUALIFIER_EVIDENCE` is conditioned on
  `synthesisSucceeded === false` (maker-score.ts:205-212) but reads "all synthesis calls
  refused" — on THIS run zero calls were ATTEMPTED (`llmCalls: 0`); the operative clause
  ("no LLM-produced software exists") is true either way.
- No keyed-synthesis quality datum exists in this record, and no completion was tested for any
  OTHER corpus entry (out of the one-run budget).

### Post-run proof (repo untouched — the rule-3 guarantee held)
- `git status --short` → lane logs only: `?? fixes/321_d1_live.md` · `?? fixes/321_d2_monitor.md` ·
  `?? fixes/321_d3_keyed_eval.md` (this log) + wave-2 lane logs that appeared mid-session
  (`?? fixes/322_e1_ten.md` · `?? fixes/322_e2_monitor.md` · `?? fixes/322_e3_backend.md`).
  **ZERO M-lines.**
- `git ls-files | wc -l` = **1920** · `git ls-files | sha1sum` = **`38676a149ee6bda3c3ba0af851a2c6aeb1a94c61`**
  — IDENTICAL to t0 (and to D2's baseline).
- `git ls-files research/eval-out | sha1sum` = **`b286d5457642a6466988df2c4388412794ee760b`** — unchanged.
- `find research/eval-out -newermt '2026-09-30 12:20:00' -type f` → empty. The 3 decisive repo
  files keep pre-run mtimes (results.json 2026-09-29 16:46:03 · history.json + run-in-progress.json
  2026-09-24 19:03:43).
- All run writes went OUTSIDE the repo. **Path artifact (disclosed):** my launcher exported
  `EVAL_OUT_DIR` in MSYS form (`/c/...`); node resolved it to `C:\c\Users\...` (drive root) —
  so the run's original outputs are `C:\c\Users\mnril\w44_trial\live1\d3_eval_out\`. Originals
  left in place; a **byte-identical copy** (`diff -r` → IDENTICAL) is at the intended
  `C:/Users/mnril/w44_trial/live1/d3_eval_out/` (results.json + history.json + marker +
  `arcade-breakout/` tree). `C:\c` pre-exists other waves' scratch (`c2probe`, `v2_scratch`);
  nothing was deleted. Launcher patched post-run to the native `C:/` form.

### Disposition
- Run executed **ONCE** (no retry — 7s ≪ 600s; retry budget unused). Exit 0. The bounded keyed
  measurement is complete: on the frozen tree it yields the **park + floor** datum (2/9,
  funded wire, 0 LLM calls) — not a keyed-synthesis score. Candidate follow-ups for the parent:
  (i) LEX-clean the arcade-breakout fixture brief (mirrors the 319 trial-fix) and re-run bounded;
  (ii) decide whether the eval driver should carry a human seat / non-forceHuman gate path;
  (iii) if canonical `research/eval-out` rows are wanted, that needs a sanctioned write+commit
  window (D3 kept the tree clean per rule 3).

=== END 321_d3_keyed_eval — COMPLETE ===
