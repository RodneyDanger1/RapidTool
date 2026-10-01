# 321 · D2 MONITOR — keyed DRIVER wave (W44 Phase-2)

Lane D2 (task-1, `deleg_c4043a7b`) · watched **D1 (task-0) keyed live session** end-to-end (12:16 → 15:47:23); D3 (task-2) carried as context.
Read-only verbs only (`rt.sh diagnose` + fs/process reads + scratch-only compute) — **no key spending, no repo edits** (this log excepted).

- Watch target: `C:/Users/mnril/w44_trial/live1/**` (+ D1 transcript `.../deleg_c4043a7b/task-0.log`)
- Baseline t0: **2026-09-30 12:16:48 CDT** · D1 final: **15:47:23 CDT** (`status=completed duration=12666.3s`)
- HEAD: `20802b1` (constant all session) · tracked tree sha1 `38676a149ee6bda3c3ba0af851a2c6aeb1a94c61` · `git ls-files` = **1920** (constant)
- Cap watched: `RAPIDTOOL_TOKEN_CAP=5000000` — running spend below
- My artifacts: `C:/Users/mnril/d2_scratch/` (`d2_diag_sealed2.json`, `d2_diag_journey{,2}.json`, `p6_check.mjs`, `p6_singular_check.mjs`, `p6_publish_probe.mjs`, `p6_lesson_check.mjs`, `extract_tree.mjs`, `jtree/**`)

**Bottom line:** D1's keyed session **completed honestly**: sealed probe all green (mint + full door matrix), journey P0→P6 with **real keyed code** (4-file tree, compiles 11/11, spec 4/4) then **stopped at a genuine P6 `p6-brief-fit` DoD red** (8/22 union hits < 11 threshold — I reproduced it, machine-consistent) with no fake human door and no emit. Spend **21,963 / 5,000,000** (0.44%). Tracked repo tree **byte-invariant** throughout. **1 MED-HIGH bug found (F-1: machine `reject` mints `decidedBy:"human"`)**; 4 surfacing nits; 1 host-suspend event (~3h22m) + D3 lane wedged (ENV-1/2).

---

## Spend ledger (sum of `spent` across D1 envelopes, vs cap 5,000,000) — FINAL

| # | time | source (file · verb) | spent | running total | cap warnings |
|---|---|---|---|---|---|
| 1 | 12:18 | 02_sealed_wild (wild --start --agent-seal) | 4924 | 4924 | — |
| 2 | 12:19 | 11_journey_gate1 (gate P0→P4) | 502 | 5426 | — |
| 3 | 15:44 | 15_journey_gate3 (gate → P6 hard block) | 16537 | **21,963 / 5,000,000 (0.44%)** | none |

Semantics verified in code: `budget.spent` = **per-process session ledger** (`headless.ts:1477-1484`, T5.5 `sessionTokenBudget()` ≤ `RAPIDTOOL_TOKEN_CAP`) → summing envelopes is the correct running total; `0` on create/approve/reject/diagnose legs = no LLM calls in that process. **No 402 / no-balance / cap-warning bytes anywhere.** D1's own close-out sum (4924+502+16537) matches mine exactly.

## Poll log (timestamped)

| # | time | live1 artifacts | D1 transcript | notes |
|---|---|---|---|---|
| P0 | 12:16:48 | journey/ + sealed/ empty | log opened | baseline recorded |
| P1 | 12:17:16 | — | recon (rt.sh, 320_g1b, README-cli) | — |
| P2 | 12:20:01 | 01–06 sealed + 10/11 journey legs | sealed probe done; journey parked P4 | envelope QA below |
| — | **12:20:33→15:42:12** | **HOST SUSPEND (~12,100 s)** | D1's patch froze 12100.0s then errored, retried OK; my own diagnose leg killed identically | **ENV-1** |
| P3 | 15:42:44 | 13_gate2 (P5 park @15:42:27) | D1 recovered mid-cycle | — |
| P4 | 15:43:52 | 14_approve2 (P5→P6 @15:43:12) | cycle 2 clear | — |
| P5 | 15:45:00 | 15_gate3 P6 hard red @15:44:00; treepeek.py | forensics prep | — |
| P6 | 15:46:57 | 16_diagnose3, 17_approve3_hardred, probe6/close/m11x.py, 30_eval.out | stop-state captured; eval read; log close-out | — |
| P7 | 15:50:50 | (no new files) | **final @15:47:23** (END marker in `fixes/321_d1_live.md`) | E-wave (deleg_01ea169f) starts; D3 still wedged |

## Envelope QA ledger (every D1 `.out` read in full by me — 15 envelopes)

| file | verb | outcome | park/phase | seat row | spent | verdict |
|---|---|---|---|---|---|---|
| 01_sealed_create | create | exit0 intake | — | — | 0 | OK |
| 02_sealed_wild | wild --start --agent-seal | `paused`, `awaiting_hitl` | P0 minted `forceHuman` (consumed by 05's reject — mint proven by reject acceptance + diagnose `lastAutoLog`) | — | 4924 | OK |
| 03_sealed_approve_autopilot | approve --seat autopilot | exit4 ok:false | — | no row minted | n/a | **F-2** (RT_E_INTERNAL wrap of R3/B-03) |
| 04_sealed_approve_bare | approve (non-TTY) | exit1 ok:false | — | no row | n/a | OK (RT_E_VALIDATION seat contract, clear remedy) |
| 05_sealed_reject_note | reject --note | exit0 `blocked` | P0 | **`decidedBy:"human"` ← machine caller** | 0 | **F-1 [BUG]** |
| 06_sealed_diagnose | diagnose | exit0 | — | — | n/a | OK (matches my re-run) |
| 10_journey_create | create | exit0 intake | — | — | 0 | OK |
| 11_journey_gate1 | gate --live --autopilot | exit2 parked | P4 stock gate | — | 502 | OK |
| 12_journey_approve1 | approve --seat autopilot | exit0 P4→P5 | — | `decidedBy:"autopilot"`, note `[seat harness] autopilot seat — no human decision claimed` | 0 | OK |
| 13_journey_gate2 | gate --live --autopilot | exit2 parked | P5 stock gate | — | 0 | OK |
| 14_journey_approve2 | approve --seat autopilot | exit0 P5→P6 | — | `decidedBy:"autopilot"` | 0 | OK |
| 15_journey_gate3 | gate --live --autopilot | **exit1** `outcome:"dod"` | P6 hard block `p6-brief-fit`; `sealedWithFailures:true`; status `running`; `hitl:null` | — | 16537 | **F-4** prose-vs-state (red itself justified — §P6) |
| 16_journey_diagnose3 | diagnose | exit0 | stop-state | — | n/a | **F-3** (exit-2 rows code:null) |
| 17_journey_approve3_hardred | approve (machine door attempt) | exit1 ok:false | — | no row | n/a | OK refusal; **F-4** remedy text |
| 30_eval | eval (read-only) | exit0 | — | — | n/a | OK — reads historical `research/eval-out` (`generatedAt 2026-09-25T00:03:43Z`, runMarker echo `balance-exhausted`); D1 worded it as a read, not a re-score ✓ |

- **'human' claims:** exactly one offender — 05 (machine-applied reject stamped `decidedBy:"human"`) → F-1. All approve rows `decidedBy:"autopilot"` ✓
- **Uncoded failures:** all failure envelopes carry an RT_E_* code; the only `code:null` rows are park rows (`gate exit 2`) — F-3.
- **Timeout truncations:** none in envelopes (all legs ≤47s); the only mid-sentence cuts are designed surface clips (F-4/F-5).

## Independent re-runs (my own invocations)

| time | verb | args | result | vs D1 records |
|---|---|---|---|---|
| 15:43:02 | diagnose | --project sealed/build.json | `d2_scratch/d2_diag_sealed2.json` exit0 | IDENTICAL project/wildRun/errors/timeline vs D1's 06; delta = +1 telemetry row (D1's own diagnose call), ring 6→7, logDirBytes 2595→2893 ✓ |
| 15:43:05 | diagnose | --project journey/build.json | `d2_scratch/d2_diag_journey.json` exit0 | awaiting_hitl@P5 snapshot; 2× `gate exit 2` code:null; checkpoint present ✓ |
| 15:46:37 | diagnose | --project journey/build.json | `d2_scratch/d2_diag_journey2.json` exit0 | matches D1's 16 (+2 rows = D1's 16-diagnose row + 17-refusal row, fully attributed); checkpoint `savedAt 1790801040642` ✓ |
| 15:48+ | repro/verify battery | `p6_check.mjs` etc. + `node --check` on extracted tree | see §P6 FORENSICS | **D1's "0 hits" claim CORRECTED; red confirmed genuine** |

**doctor / emitted-tree npm test: N/A** — journey stopped **pre-emit** (no `emitted/` dir exists); the closest artifact (P6 generatedTree) was hand-verified instead (§P6).

## Repo no-break watch (keyed runs must not edit repo) — FINAL

| poll | short | -uall | ls-files | ls sha1 | HEAD | delta attribution |
|---|---|---|---|---|---|---|
| t0 12:16 | 1 | 1 | 1920 | 38676a14 | 20802b1 | only D1 log (?? new file) |
| 15:43 | 2 | 2 | — | — | 20802b1 | + this log |
| 15:49/15:50 | **5** | 5 | **1920** | **38676a14** (identical) | 20802b1 | + `?? fixes/322_e1_ten.md`, `?? fixes/322_e2_monitor.md`, `?? fixes/322_e3_backend.md` — **sibling E-wave lane logs** (deleg_01ea169f started 15:47–15:50, after D1 closed); no tracked-file edits |

**Conclusion:** the tracked tree was **byte-identical throughout** (same 1920-file sha1 + same HEAD); every working-tree delta is an untracked lane log. Zero repo edits by the keyed runs. ✓

## ENV-1 — host suspend 12:20:33→15:42:12 (~12,100 s) — D1's OBS-3 adjudicated

- NOT product clock skew. Wall freeze; D1's patch call measured **12100.0s** then errored (resume read failure), retried OK at 15:42:57.
- Arithmetic: P5 `hitl.requestedAt` 1790800947563 − P4 approve `decidedAt` 1790788820295 = **12,127,268 ms = 3h22m07.268s**; wall mtimes: 13_gate2.out 15:42:27.8 − 12_approve1.out 12:20:20.4 = 3h22m07.4s (Δ 0.13 s). Timestamps truthful; the delta IS the suspend. D1's probe (`now − requestedAt` = +42.5 s) agrees.
- D1 retracted OBS-3 correctly; residual value: the ~3h22m gap delayed the wave (not a product fault).

## ENV-2 — D3 lane wedged (context, not a D1 finding)

- `task-2.log` (D3 run-eval) frozen at **12:20:28** (20099 B, mtime 12:20:28) — 3h30m silent at D1's close; no `d3_eval1.log`, no `research/eval-out` writes (mtimes Sep 24/29). Manifest still says `status:"running"` (stale — D1's completed lane also reads "running"). D3's last recorded op was a passing recon check; its next LLM step never resumed post-suspend.
- Action for parent: relaunch/reap D3 (its artifacts are absent; nothing written).

## §P6 FORENSICS — D2 independent verification (the keyed substance)

**What happened (machine records, journey/build.json logs):**
1. `p6.synthesis.attempt` ×3 — "chunk 1/3 · attempt 1 · 240000ms · ok" … 3/3 ok (keyed DeepSeek synthesis).
2. `p6.synthesis.refused` (warn) — `RT_E_VALIDATION · tree 3/3 chunks accepted · assembled tree does not implement the brief's required vocabulary (missing: static, marketing, website, s…` ← **all chunks accepted; the ASSEMBLED TREE failed the tree-level vocab pre-check** (`codegen.server.ts:3422`, `partialTreeRefuse`) — the accepted tree is kept on the project.
3. `dod.reqtrace: p6-arch PASS · tree (4 files)` · `p6.tree.tested: tested-equivalent minted after green tree-run · compile 11/11 file(s) · 1 spec file(s) pass · 4 assertion(s)` → `lastTest{ok:true, label:"tested", evidenceHash:1637101674}` → **p6-verified PASSED**.
4. `gate.verdict FAIL · 1 unmet · 12461045` → `dod.blocked: P6 advance blocked — unmet: p6-brief-fit` → gate3 exit 1 (`outcome:"dod"`).

**My reproduction (same repo helpers, read-only):** `briefNounHits` → 22 required nouns; `identifierHits(required, union of barrel+tree) = **8 hits** (coffee, menu, subscribe, html, css, files, no, external); **missing = 14** (static, marketing, website, shop, visitors, browse, updates, admin, edits, publishes, plain, services, works, offline) — **exactly the refusal log's list**; threshold = ceil(22×0.5)=**11 → FAIL is correct.** Per-file hits: render-menu-page 6 · update 6 · publish 7 · barrel 0.
**Robustness:** normalizing the 3 plural verbs to singular (publish✓, update✓, edit✗) yields **10 hits — still < 11 → the red stands.**

**Correction to D1's log (§P6 forensics, "the DoD scanner recorded 0 hits"):** no measurement ever produced 0 hits. The "0 hits" fragment is **template boilerplate + a clip**: the L2 lesson text (`knowledge.ts:1164`) literally reads `required brief nouns with 0 hits in emitted source: ${nounText}`, minted by `headless.ts:1031` with `nouns=undefined` ⇒ `none computed`; `lessonRow` (`knowledge.ts:953-957`) clips text at `LESSON_TEXT_MAX=240`, so the stored row ends mid-phrase at `… with 0 hits in `. I reproduced the row **byte-exact** (`p6_lesson_check.mjs`: id `lesson-template-emission-b5783c51`, text identical, len 240). D1's inference ("scan surface/tokenizer … next investigation") is **not supported** — the scanner and the synthesis pre-check agree; the red is a genuine vocabulary shortfall of otherwise-real code.

**Real vs shell verdict (closest artifact to an emitted tree; no emit occurred):** **REAL.** 3/3 keyed chunks accepted; 4 files extracted to scratch; **all 4 `node --check` exit 0**; `TODO(E-15)`/`TODO` counts = **0** (not stubs; p6-arch PASS corroborates); substantive content (`escapeHtml`×8, `renderSubscribeForm`×4, `validateMenu`×9, `rollback`×4; update/publish import the render module); run's own tree-run: compile 11/11 + spec 4/4 asserts. What it lacks: enough of the brief's noun vocabulary (p6-brief-fit) — an honest content verdict, not a shell.
**Heuristic note (input for wave):** the matcher is morphology-blind (`publishes`/`edits`/`updates` can't match `publish`/`edit`/`update` identifiers — directional substring) and counts weak tokens (`no`, `files`, `html`, `css`). Here it does not change the verdict.

## D1 claims ledger (audited against bytes; all read by me)

| # | claim (from `fixes/321_d1_live.md`) | verdict | evidence |
|---|---|---|---|
| 1 | sealed wild paused/awaiting_hitl, minted forceHuman gate, spent 4924 | **OK** | 02 bytes; disk + diagnose |
| 2 | 03 exit4 RT_E_INTERNAL R3/B-03 refusal | **OK** (classified F-2) | 03 bytes L1-12 |
| 3 | 04 exit1 RT_E_VALIDATION seat contract | **OK** | 04 bytes |
| 4 | 05 reject → blocked + rejectionHistory + `decidedBy:"human"` | **OK** (escalated F-1) | 05 bytes L18; engine.ts:1809 |
| 5 | 06 diagnose disk-truth; my re-run matches | **OK** | d2_diag_sealed2 vs 06 (explained +1 row) |
| 6 | gate1 P4 park, spent 502; approve1 P4→P5 autopilot row; gate2 P5 park spent 0; approve2 P5→P6 | **OK** | 11/12/13/14 bytes; disk decisions |
| 7 | gate3 P6 red, 47s, spent 16537, hitl:null, no door (17 refusal) | **OK** | 15/17 bytes; WALL 47s |
| 8 | OBS-3 retracted (no skew) | **OK** | ENV-1 arithmetic (host suspend) |
| 9 | generatedTree 4 files `{path,source,hash,attempt}`; real keyed code | **OK** | my python read; counts; node --check |
| 10 | memory[11] len 240 clipped mid-phrase | **OK** (root cause F-5) | byte-exact repro |
| 11 | "DoD scanner recorded 0 hits" | **WRONG** | §P6: 8/22 hits, 14 missing, threshold 11 — red genuine; "0 hits" is a boilerplate phrase + 240 clip |
| 12 | Spends sum / cap / "no repo edits" / eval-as-read | **OK** | 21,963=4924+502+16537; sha1 invariant; eval `generatedAt` Sep 25 |

## Findings / bugs (byte-anchored)

- **[BUG F-1 · MED-HIGH] machine `reject` mints `decidedBy:"human"`.** `05_sealed_reject_note.out` L18; `engine.ts:1809` hardcodes it; CLI `reject` (`rapidtool-cli.mjs:1075-1110`) has **no seat/policy seam** (approve has one at `:1040-1068`); the ledger row also lacks `decidedVia` (sealed `decisions[-1]`). Contradicts `README-cli.md:1099-1101` ("a machine path can never mint decidedBy:\"human\"") + honesty contract #6 (truthful actor). Repro: non-TTY `reject --note` → human-stamped row. Fix direction: mirror approve's actor seam onto reject (default `autopilot`/`harness`; human only via the two-channel claim).
- **[BUG F-2 · LOW-MED] R3/B-03 refusal wraps as `RT_E_INTERNAL`/exit 4.** `03_*.out` + `engine.ts:1691` bare throw; README:921-923 ("exit 4 = backend/internal runtime failure"); remedy text "retry once if it may be transient" misleads for a deterministic governance refusal. Fix: throw with `RT_E_VALIDATION` (or a governance code) → clean exit 1 like 04.
- **[OBS F-3 · LOW-MED] honest exit-2 parks log as `level:"error", code:null` in diagnose** (both projects; journey `errors[0..1]`) → "not a clean bill of health" verdict on a healthy parked state. May be intended visibility; flag for adjudication.
- **[OBS F-4 · LOW] P6 hard-red remedy prose promises a door that doesn't exist** — `15/16/17` bytes: `RT_E_GATE_PENDING` agentAction "Route the project through the open HITL prompt (approve/reject …)" while `hitl:null` and status `running`; approve refuses ("No pending gate…"). DoD-floor reds mint no HITL **by design**; the generic remedy text can loop a driver agent. Suggest a DoD-red-specific remedy branch.
- **[OBS F-5 · LOW] L2 lesson row carries boilerplate "0 hits" + "none computed" + a 240-char mid-phrase clip** (`knowledge.ts:1164`, `lessonRow` clip; id `…b5783c51` reproduced byte-exact). The exact 14-missing list existed in the refusal log but not on the row — it misled D1's forensics. Fix: pass the real missing list into `templateEmissionLesson`.
- **[ENV-1]** host suspend 12:20:33→15:42:12 (~12,100 s) — not a product fault; timestamps adjudicated truthful.
- **[ENV-2]** D3 (`task-2`) wedged since 12:20:28, no artifacts — recommend parent relaunch.

## Verdict (final)

**Does the app behave like a coherent tool under keyed live driving? Yes — with one governance bug and four surfacing nits.**

- **Sealed probe (governance loop):** works end-to-end. Classifier review-reject → park `RT_E_GATE_PENDING` → **minted `forceHuman` gate** → autopilot approve refused (R3/B-03 bytes), bare approve refused (seat contract, exit 1), `reject --note` applied + blocked + history, diagnose truthful. **Win** (new mint machinery proven live), **bug F-1** on the reject seat.
- **Live journey (execution):** P0–P5 honest progression with real live research (duckduckgo); stock gates P4/P5 cleared via the documented machine door with `decidedBy:"autopilot"` + `[seat harness]` note; P6 produced **real keyed code** (4-file tree, compiles 11/11, spec 4/4, no stubs) and then **stopped at a genuine DoD red** (`p6-brief-fit`: 8/22 union hits < 11; machine-consistent across synthesis pre-check + DoD probe; robust to plural normalization). No fake completion, no fake human door, no emit, exit bytes coded. **Where it stopped: P6 brief-conformance.** **Where it won: honest refusal taxonomy, correct seat attribution (approve), diagnose/disk-truth parity, spend 0.44% of cap, zero repo edits.**
- **Emitted tree:** none existed (stop was pre-emit) — `npm test`/`doctor` on an emitted tree **N/A, documented**; the P6 tree was hand-verified instead (census + extraction + parse + substance + real-vs-shell = **real**).
- **Wave hazards:** ~3h22m host suspend (recovered; D1 OK) and **D3 wedged since 12:20:28** (parent action).

=== END 321_d2_monitor — COMPLETE (D1 session closed 15:47:23 · all 15 envelopes QA'd · 3 diagnose re-runs diffed · P6 tree hand-verified as closest artifact — no emitted tree existed · tracked tree byte-invariant (1920 files, sha1 38676a14) throughout · 1 MED-HIGH bug + 4 nits logged) ===
