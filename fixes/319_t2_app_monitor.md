# 319 · T2 · THE APP-RESPONSE MONITOR — RapidTool W44 Phase-2 keyed trial

Lane T2. Mission: watch T1's live keyed-build session (transcripts + C:/Users/mnril/w44_trial/** artifacts) and the app's replies; independently re-run diagnose/doctor on each build and diff against T1's records; catalogue every anomaly with exact bytes ([BUG] blocks); optionally attempt ONE console UI pass; write this log.

Hard rules honored: no repo product edits (this file + C:/Users/mnril/w44_t2_scratch/ only); no key spending (read-only verbs only: diagnose / doctor / eval); foreground legs; no piped verdicts; no $() inline.

Status: RUNNING.

## Timeline

- (t0) Log created; reconnaissance starting.
- 10:51 RECON: live batch = `deleg_0d486f19` (started 2026-09-30 10:50:54, 6 tasks).
  task-0 = T1 operator · task-1 = me (T2) · task-2 = T3 backend · task-3/4/5 = F1/F2/F3.
  Trial root dirs website/game/program were all EMPTY at 10:51:44; `rt.sh` wrapper present
  (loads key from repo `.env`, never echoes; token cap 5,000,000 env-overridable).
- 10:51 T1 status: log-first done (fixes/319_t1_operator.md written 10:51:08); preflight
  reads in progress (README-cli.md, 317_j2_preflight.md, 316_h7_survive.md, CLI taxonomy
  greps). No keyed call yet. First wild call timing will be anchored from here.
- 10:52:02 **FIRST KEYED CALL** = `create` (website) via wrapper → exit 0 (10:52:06).
- 10:52:13 `wild --start --steps 20 --agent-seal` fired → returned 10:52:22 (8.2s) →
  **PARKED at P0**: outcome `paused`, steps 1, note `"P0 is a human-only gate."`,
  `status:"awaiting_hitl"`, budget spent **0** tokens. No LLM call was made.
- 10:52:40–10:53:40 T1 independently diagnoses the same LEX→vague→reframe chain (their log
  §1 finding). No disagreement with my read.
- 10:54:05 T1 runs `emit --run` on the parked project → exit 0 (10:54:14), 16 files, kind
  webapp, treeRun ok (oracle 5/5 pass, typecheck/build UNVERIFIED-honest, stubs:1 →
  `stub-skeleton`).

### Envelope QA — build (a) WEBSITE `C:/Users/mnril/w44_trial/website/`

| # | artifact | my independent read | T1's record | match? |
|---|---|---|---|---|
| 01 | `create` | ok:true, path website/build.json, `enforceDod:true`, budget cap 5,000,000 spent 0, exit 0 | same (matches byte-level trim) | ✔ |
| 02 | `wild` | outcome `paused`, steps 1, note `P0 is a human-only gate.`, `RT_E_GATE_PENDING` park, `unlock:"human-gate"`, spent 0, exit 0 | same | ✔ |
| 03 | `emit --run` | ok:true, dir website/emitted, count 16, `moduleEmbedded:true`, treeRun.ok:true, compile 8 checked/8 pass/0 fail (skipped:8), tests oracle.spec 5 pass, run skip (ui-shell), substance stubs:1 → `stub-skeleton`, `greenWhileStubbed:true`, verdictHash 890750497, exit 0 | (pending T1 record) | — |

NDJSON `.rapidtool/logs/rapidtool.ndjson` (3 rows): `wild.step_start` P0 → `wild.step_paused`
msg `"P0 is a human-only gate."` code `RT_E_GATE_PENDING` payload
`{"outcome":"paused","action":"park","phase":0,"completedPhase":null,"advancedTo":null,"artifacts":3,"nextPhase":0,"nextAction":"gate"}`
→ `cli.invocation "wild exit 0"`. Ledger rows in build.json match T1's log verbatim
(incl. `wild.paused_human` warn row with the R3/B-03 seal text). No `human` attribution
anywhere; `decisions: []` — zero seat rows (run never reached a stock gate). `hitl.forceHuman:true`.

### Anomaly catalogue

#### [BUG-1] Ordinary website briefs dead-lock the sealed agent run at P0 (LEX gap → vague → reframe → forceHuman → seal refusal)

- **What:** the trial's build (a) website brief
  `"Harbor and Pine roastery — a static marketing website: a hero section, a menu section, and a contact footer. Plain HTML/CSS/JS, no external services."`
  scores `lattice.vague:true` (`lattice.vague` log row: *"LEX gap: brief matched no
  job/entity vocabulary — lattice fell back to deliver-core-workflow."*) → P0 scorecard
  `overall=7.2 verdict=reframe` → `hitl {forceHuman:true, title:"Reframe the brief"}` →
  `wild --start --agent-seal` refuses: *"P0 gate is human-only (forceHuman) — the agent seal
  refuses it (R3/B-03) … A human must decide."* → run parked at step 1, `awaiting_hitl`.
  For an unattended agent-user there is no door here (approve --force is a human-only
  route by design). 0 tokens spent; the sealed build never starts. Website nouns
  (website/hero/section/menu/footer/marketing/HTML/CSS/JS) have **zero hits** in the LEX
  register in `src/lib/algorithms.ts` (grep: no `"website"|"hero"|"menu"|"footer"|"landing"`
  literal exists in the file; object register has only `page`).
- **Exact bytes:**
  - envelope `02_wild.out`: `"outcome": "paused"`, `"steps": 1`, `"note": "P0 is a human-only gate."`, `"status": "awaiting_hitl"`, `"budget": {"spent": 0, "cap": 5000000, "stop_reason": null}`, `"exit_code": 0`
  - ndjson: `"event":"wild.step_paused","message":"P0 is a human-only gate.","code":"RT_E_GATE_PENDING"`
  - ledger: `"event": "scorecard.ready", "detail": "overall=7.2 verdict=reframe"`, `"event": "lattice.vague"`, `"event": "wild.paused_human"`
- **Repro (keyless, mine, exact):** `node --experimental-strip-types C:/Users/mnril/w44_t2_scratch/lattice_repro.mjs` (imports `src/lib/algorithms.ts`; calls intentLattice → scheduleConstraints → feasibilityScorecard):
  `trial_website → {"vague":true,"jobs":["deliver-core-workflow"],"entities":["operator","record"],"overall":7.2,"verdict":"reframe"}`.
  Adding ONE lexeme flips it: `…website for visitors…` → `{"vague":false,"entities":["visitor"],"overall":7.6,"verdict":"proceed"}`;
  `…Publish a static marketing website…` → `{"vague":false,"jobs":["publish"],"overall":7.6,"verdict":"proceed"}`.
  Game/program-shaped briefs pass already (drag/persist/player → proceed; scan/summarize/file → proceed).
- **Severity:** HIGH for the unattended agent-use story (the canonical "build me a website"
  brief cannot complete a sealed run at all; contradicts the trial's target flow of
  13 steps → `wild.complete`). LOW/no data-loss elsewhere; the refusal itself is honest and coded.
- **File anchors:** `src/lib/algorithms.ts:442` (vague ⇔ no job & no entity LEX hits),
  `:1028` (HR-1 vague ⇒ reframe), `src/lib/engine.ts:667-707` (reframe ⇒ forceHuman hitl),
  `src/lib/engine.ts:4289-4295` (seal refuses forceHuman).
- **Note:** by design per R2/B-02 + R3/B-03 for *genuinely vague* briefs — the finding is
  that an ordinary website brief IS lexically invisible (product gap), so the "by design"
  human-park fires on briefs a real user would call crisp.

=== END 319_t2_app_monitor — IN PROGRESS ===

---

## [PARENT-APPENDED] Completion from T2's capped summary + parent re-verification (2026-09-30, deleg_0d486f19 task-1)

*(T2 hit the iteration cap after writing the timeline + website envelope-QA + BUG-1. The findings below were fully evidenced in its summary; appended verbatim-trimmed. Parent re-verified BUG-4's code cite directly — `wild-mode.server.ts:101`.)*

### BUG-2 · `diagnose` misreports `wildRun` (dup: T1's F-D)
Disk is `active:true, pause:true, stoppedAt:null`, but diagnose projects `active:false, pause:false, stoppedAt:Date.now()` (moves every call) + growing `overdueMs`. Cause: `wild` (`--start`) hydrates via `loadProjectFor` → `hydrateWildRun` **force-stops an active run**, while pause/resume/step pass `preserveWildRun:true` (`rapidtool-cli.mjs:3543`; `engine.ts:2192-2240`). A parked/paused run is reported STOPPED.

### BUG-3 · Game keyed P0 reviewed-and-rejected (2,728 tokens) → park
Covered as FINDING-2 in `319_keyed_trial.md` (`review_retry 1/2, 2/2`; park `RT_E_GATE_PENDING / human-gate / resumeAction:"advance"`; `hitl:null`, `decisions:[]`).

### BUG-4 · Reviewer prompt truncation — VERIFIED (parent-confirmed code cite)
The reject reason claims "The Security section is literally truncated mid-sentence" — **disproved** against the artifact (`- Security posture: 7/10 — Scheduler Δ0.` reads complete). The classifier saw a truncated prompt: `wild-mode.server.ts:98-101` slices artifact bodies to **320 chars** (`.slice(0, 320)`, max 8 artifacts). Severity: the reviewer's evidence is our own truncation (critique quality + false claims). The classifier's core complaint (generic boilerplate) stands independently of this.

### T2 verdict (plain language, verbatim)
The app does **not** respond like a coherent tool for an agent-user on either live build: it parks on the very first gate. Website fails instantly and honestly (0 tokens). Game spends 2,728 tokens producing a keyed P0, then the app's own reviewer rejects that same output with a critique partly grounded in prompt truncation, and the sealed run stops with no machine door. Both parks are honest and coded — the failure is that ordinary, crisp briefs cannot traverse the sealed path at all.

### T2 files/state
Log: this file. Scratch: `C:/Users/mnril/w44_t2_scratch/` (`lex_probe.sh`, `lattice_repro.mjs`+`.out`, `rerun.sh`, `dump_game_p0.cjs`, `website/t2_doctor.out`, `website/t2_diagnose.out`). Console UI pass: NOT attempted (optional leg; budget exhausted — recorded, not hidden).

=== END 319_t2_app_monitor — COMPLETE (T2 partial at cap; parent appended BUG-2/3/4 + verdict; BUG-4 code cite parent-verified) ===
