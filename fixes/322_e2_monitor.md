# 322 · E2 APP-RESPONSE MONITOR — W44 "10 EXPERIMENTS" campaign (E1 operator)

Lane E2 (task-1, `deleg_01ea169f`) — watching **E1 (task-0) 10-experiment keyed campaign** under
`C:/Users/mnril/w44_trial/exp/**` + continuity from the D-wave (`live1/**`, `fixes/321_*.md`).
Sibling: E3 backend monitor (`fixes/322_e3_backend.md`) · fixers X1/X2 (task-3/4).
**Read-only**: `diagnose/doctor/eval` + fs/transcript reads only — no create/gate/wild/approve/emit,
no key spending, no repo edits (this log excepted). Foreground legs; no `$()` inline.

Scope: envelope QA for every `.out` under `exp/**` (+`live1/**` carry) — outcome/currentPhase/status/
phaseCounts/lastGate(decision+decidedBy+note)/park(code/unlock/reason)/spent/exit; **flag any
`decidedBy:"human"` on machine actions, uncoded failures, exit-vs-envelope mismatches, truncated
outputs, claims not backed by files**; independent diagnose re-run per experiment vs E1's records;
spend vs cap 5,000,000; census-read emitted trees; transcript poll every ~4–5 min.

- Baseline t0: **2026-09-30 15:49 CDT** · HEAD `20802b1`
- `git status --short` = `?? fixes/321_d1_live.md` `?? fixes/321_d2_monitor.md` `?? fixes/322_e1_ten.md` `?? fixes/322_e3_backend.md` (+ this log once written) — no tracked edits
- Cap: `RAPIDTOOL_TOKEN_CAP=5000000` per keyed process (`rt.sh`); campaign metric = sum of `budget.spent` across envelopes vs 5,000,000 (D2-verified semantics: per-process session ledger, `headless.ts:1477-1484`)
- `exp/` at t0: 10 dirs `01_website`…`10_kanban` created 15:47; `01_website/{00_create.out, 01_gate_c0.out, build.json}` present; E1 log shows EXP01 create EXIT 0 WALL 3s
- Watch targets: E1 transcript `deleg_01ea169f/task-0.log`; D carry `deleg_c4043a7b/task-*.log`

**Carry-forward context (D1/D2, from `fixes/321_d1_live.md` + `fixes/321_d2_monitor.md`):**
- D1 sealed probe: minted `forceHuman` review gate; machine `reject` stamped **`decidedBy:"human"`** (F-1 MED-HIGH, seeded to X1) · autopilot refusal wrapped `RT_E_INTERNAL`/exit 4 (F-2) · bare approve refused `RT_E_VALIDATION` (OK).
- D1 journey: P0–P5 green (P4/P5 stock gates cleared by explicit `--seat autopilot`), **hard stop at P6 `p6-brief-fit` DoD red** (`outcome:"dod"`, exit 1, `sealedWithFailures:true`, `hitl:null`, no approve door — `approve` → `RT_E_GATE_PENDING "No pending gate to approve (status: running)."`). Not reached: emit/npm test/doctor.
- D1 spend 21,963 / 5,000,000. Also: 1467-char classifier-note clip (F-5/OBS), clipped learning row, exit-2 park rows log `code:null` in diagnose (F-3), P6-hardred remedy prose references an open HITL while `hitl:null` (F-4).
- **E1 protocol expectation** (per E1 log L13-17): create → `gate --live --autopilot` → park(exit 2) → `approve --seat autopilot` → re-run (max 4 cycles) → emit+npm test+doctor → diagnose. KNOWN non-stock stop: P6 hard DoD red (`RT_E_GATE_PENDING`/`p6-brief-fit`) mints NO hitl → ONE recorded approve attempt → diagnose → move on.

Status: **CLOSED 15:59 CDT** — campaign window ended 15:58 (E1 lane hit tool-call limit after finishing exp04); 4/10 experiments produced — all QA'd below; 05-10 never started. Final sections below.

---

## Running spend ledger (sum of `spent` across E1 envelopes vs cap 5,000,000)

| # | time | source (file · verb) | spent | running total | notes |
|---|---|---|---|---|---|
| — | — | — | — | 0 | campaign just started |

## Envelope QA ledger (every E1 `.out` read + fields extracted)

_(appended as artifacts appear)_

## Independent re-runs (my own diagnose legs, vs E1 records)

_(appended per experiment)_

## Poll log (timestamped)

| # | time | exp/ state | E1 transcript | notes |
|---|---|---|---|---|
| P0 | 15:49 | 01_website: create+gate_c0 present | — | baseline recorded |

## QA — EXP 01 `01_website` (campaign pace: fast; create 15:47 → P6 leg 15:49)

Envelope QA ledger (E1 `.out` files read in full + disk files cross-checked):

| file | verb | exit | outcome / cursor | park (disk) | seat row | spent | verdict |
|---|---|---|---|---|---|---|---|
| 00_create.out | create | 0 | `intake` P0, counts{ready:1,locked:12} | — | — | 0 | OK |
| 01_gate_c0.out | gate --live --autopilot | 2 | `awaiting_hitl` P4, counts{complete:4,awaiting_hitl:1,locked:8}, steps 5 | P4 STOCK (disk `forceHuman = None`, "Approve isolation policy"; prompt byte-identical to D1 P4) | — | 567 | OK |
| 02_approve_c1.out | approve --seat autopilot | 0 | P4→P5 `running` counts{complete:5,ready:1,locked:7} | — | `lastGate{phase:4, decision:"approve", decidedBy:"autopilot", note:"[seat harness] autopilot seat — no human decision claimed"}`; disk `decisions[0]` id `hitl-4-1790801328147` | 0 | OK (machine seat explicit, no human claim) |
| 03_gate_c2.out | gate --live --autopilot | 2 | `awaiting_hitl` P5, counts{complete:5,awaiting_hitl:1,locked:7}, steps 1 | P5 STOCK (disk `forceHuman = None`, "Approve validation contract"; identical to D1 P5) | lastGate=P4 row carried | 0 | OK |
| 04_approve_c3.out | approve --seat autopilot | 0 | P5→P6 `running` counts{complete:6,ready:1,locked:6} | — | `lastGate{phase:5, decision:"approve", decidedBy:"autopilot"}` id `hitl-5-1790801345362`; disk `decisions len 2` | 0 | OK |
| 05_gate_c3_p6.out | gate --live --autopilot (P6 checkpoint) | — | **IN FLIGHT since 15:49:10** (0-byte `.out` = leg running in keyed P6 synthesis window) | — | — | — | pending |

- **Park shape note:** exit-2 parks carry `ok:true` + `exit_code:2` + `stopped:true` (+`steps`) — byte-identical shape to D1's raw `11_journey_gate1.out` (`"ok": true` … `"exit_code": 2`). Not a mismatch; taxonomy parks are not failures.
- Disk cross-checks: P4 park `.txt` shows `status = awaiting_hitl | currentPhase = 4`, `decisions len 0`, `research len 1` (`provider: duckduckgo` — real harvester call); after approve `hitl = None`, `P4:complete`. P5 park `.txt` shows `hitl.phase = 5`, `memoryCount` 9→10 across the cycle. All claims backed by files ✓.
- `.rapidtool/logs` NDJSON: exit-2 park rows logged `level:"error" code:null "message":"gate exit 2"` — **same F-3 pattern as D1 carry** (honest parks surface as codeless error rows; adjudication pending). No other anomalies.

### Spend ledger (E1 campaign)

| # | time | source (file · verb) | spent | running total | notes |
|---|---|---|---|---|---|
| 1 | 15:48 | `01_gate_c0` (gate P0→P4) | 567 | 567 | — |
| 2 | 15:48-49 | `02_approve_c1` · `03_gate_c2` · `04_approve_c3` | 0 · 0 · 0 | 567 | approve legs report `spent:0` (no LLM calls — D2-verified semantics) |

Wall times (E1 `drive.sh` EXIT/WALL lines + transcript): create 3s · gate_c0 5s · approve_c1 2s · gate_c2 3s · approve_c3 2s · gate_c3_p6 ≥2min (in flight).

## QA — EXP 01 `01_website` — FINAL (red-stop, WALL ~95s P6 leg)

- **`05_gate_c3_p6.out`** — EXIT 1, `"ok": false`, `"code": "RT_E_GATE_PENDING"`, error `"P6 DoD unmet — hard gate blocks advance: p6-brief-fit. — resolve the unmet DoD criteria before advancing."`, `"outcome": "dod"`, `sealedWithFailures:true`, status running, counts{complete:7,locked:6}, **spent 35627**, WALL 95s. Disk `phases[6].gate = {"passed": false, "unmet": ["Brief-conformance: …"], "evidenceHash": "1246104519", "checkedAt": 1790801449304}`.
- **`06_approve_on_red.out`** — EXIT 1 `{"ok":false,"error":"No pending gate to approve (status: running).","code":"RT_E_GATE_PENDING"}` — no door on a standard-path red (same bytes as D1 `17_*`).
- **`07_diagnose.out`** (E1) **vs my re-run** (`e2_scratch/exp01_diag_e2.out`, EXIT 0, WALL 2s): byte-equal projection/errors/codes/checkpoint; expected deltas `telemetryRing 6→7`, `logDirBytes 1921→2219` (+my call's row). ✓
- **Tree census (my read of `build.json`):** 4 files, all `attempt:0` — `src/generated.ts` (132 B barrel) · `src/generated/render-menu-page.ts` (13,955) · `src/generated/save-page-edits.ts` (13,838) · `src/jobs/publish.ts` (10,932); total 38,857 B. Identifiers: `renderMenuPage`, `renderSubscribeSection`, `subscribeHtml`, `savePageEdits`, `publishPages`, `pageId`, `menuItems`, `validateMenuItems`…
- **Fit replication with repo helpers** (`e2_scratch/check_fit.mjs`, imports `src/lib/sandbox.ts`): required **22**, hits **6** [`menu`,`subscribe`,`edits`,`html`,`css`,`no`], threshold 11 ⇒ **FAIL — matches recorded verdict**.

## QA — EXP 02 `02_game` — FINAL (red-stop, 2 criteria, WALL 51s)

- **`05_gate_c3_p6.out`** — EXIT 1, `"P6 DoD unmet — hard gate blocks advance: p6-brief-fit, p6-arch. — …"`, `outcome:"dod"`, spent **18378**, WALL 51s. `failedGates` 2 criteria.
- **P6-arch detail (recovered from disk, log+artifact):** `dod.reqtrace | p6-arch FAIL · tree (2 files) · missing: track, drop`; artifact `P6 architecture trace (reqTrace)`: `drag → create-game.ts`, `persist → create-game.ts`; **missing capabilities: track, drop**.
- **Tree census:** 2 files — barrel 44 B; `src/generated/create-game.ts` **21,951 B substantive** (`"Deterministic arcade board module. …dragging, clearing, scoring, persistence, keyboard fallback…"`, ends `// fixes/121 mechanical export-injection…`). NOT a template stub (stubFiles empty in trace).
- **Fit replication:** required **18**, hits **7** [`game`,`blocks`,`clear`,`board`,`score`,`high`,`as`], threshold 9 ⇒ **FAIL — matches recorded**.
- `06`/`07` same shape as EXP01; my diagnose re-run (`e2_scratch/exp02_diag_e2.out`) identical; deltas ring 6→7, logDirBytes 1930→2228. ✓
- P6 `evidenceHash "3490116578"` (2-criterion verdict set) vs EXP01 `"1246104519"` (1-criterion set); D1's journey (also 1-criterion `p6-brief-fit`) is byte-equal to EXP01's — consistent with `dod.ts:790` `evidenceHash = fnv1a("id:pass|fail" pairs sorted)` (**verdict-vector fingerprint, not artifact evidence** — see OBS-6).

## QA — EXP 03 `03_cli` — FINAL (red-stop; keyed synthesis refused ×3; NO tree)

- **`05_gate_c3_p6.out`** — EXIT 1, `"P6 DoD unmet — hard gate blocks advance: p6-verified, p6-brief-fit. — …"`, spent **30885**. `failedGates`: [`p6-verified` (Machine verification promoted a tested verdict), `p6-brief-fit`].
- **Disk:** `generatedTree` **absent (None)**; `generatedSource` = placeholder (`const JOBS = ["calculate", "parse", "generate", "install"]; …`); artifact `P6 placeholder module (deterministic template)` (1,055 B); `lastTest = {"ok": true, "detail": "tests.pass"}` — **no `label:"tested"`, no `evidenceHash`** ⇒ p6-verified red is honest/honest-by-construction.
- **Synthesis log (3 cycles, all refused):**
  1. `p6.synthesis.refused | RT_E_VALIDATION · chunk 1/4 refused · typeSignature functions not exported: runCli, readCsvFile`
  2. `… · typeSignature functions not exported: mapColumns, normalizeAmount, bucketByMonth, sumMonth, grandTotal, buildReport, writeReport`
  3. `… · prose-in-code in generated module (1 prose line; first at line 78: "return negative ? -cents : cents;")`
  then `p6.journey.exhausted | 3 cycle(s) without a green tree-run`; `dod.blocked`; `lesson.capture | L2 template-emission lesson-template-emission-0258dab6 (keyed P6 synthesis refused — red gate on a live run)`.
- **[!] cycle-3 refusal cites `"return negative ? -cents : cents;"` as a "prose line"** — that is a ternary code expression, not prose ⇒ suspect false-positive in the prose-in-code heuristic that burned the LAST cycle (→ exhaustion → placeholder → red). Tagged [BUG-4] below for fixer adjudication (mechanism check is src-side).
- `08_p6.txt` — `P6 gate {… "evidenceHash": "552477142" …}; tree files: [] | count: 0`.
- Memory L2 row len **240**, clipped: `'L2 template-emission: phase P6 sealed with gate unmet (Machine verification promoted a tested verdict (lastTest.label === "tested" with evidenceHash), Brief-conformance: required brief nouns appear as'`.

---

## FINDINGS SO FAR (byte-anchored; fixers X1/X2 own remediation)

- **[BUG-1 · MED] `p6-brief-fit` near-constant red on live keyed builds — required-token construction + substring matching.** Evidence: EXP01 6/22 hits vs threshold 11, EXP02 7/18 vs threshold 9 (both replicated with the repo's own `briefNounHits`/`identifierHits`). `required` keeps raw inflections (`drags`,`drops`,`tracks`,`persists`,`publishes`,`edits`,`updates`,`visitors`) and junk micro-tokens (`no` exp01; `as` exp02 — `as` "hit" via substring `i.includes(t)`, so short tokens are noise both ways). Trees genuinely implement the briefs (census above) yet 2/2 completed experiments hard-stop, 0 emits. Repro: `node --experimental-strip-types e2_scratch/check_fit.mjs <build.json>` (outputs above). Code: `sandbox.ts:236,251` (`lowers.some((i) => i === t || i.includes(t))`).
- **[BUG-2 · LOW-MED] L2 lesson rows clipped at 240 chars — diagnostic payload severed.** `knowledge.ts:762 LESSON_TEXT_MAX = 240`, applied `knowledge.ts:956 .slice(0, LESSON_TEXT_MAX)`. All three experiments' `template-emission` rows are len == 240 ending mid-phrase (`'…required brief nouns with 0 hits in '` / `'…required brief nouns appear as'`). The cut removes exactly the noun list + evidence hash the row exists to carry.
- **[BUG-3 · LOW] L2 row text carries a literal "0 hits" claim + "none computed" nouns.** Template `knowledge.ts:1164`: `required brief nouns with 0 hits in emitted source: ${nounText}`; caller `headless.ts:1012-1018` passes `nouns = undefined` ⇒ `nounText = "none computed"`; actual union-tree hits by replication = **6** and **7**. The "0 hits" reading is true only of the older barrel-only surface (`dod.ts:640` comment) — the row misinforms about the P6 red's cause.
- **[BUG-4 · MED-candidate] prose-in-code refusal flags a code line.** Bytes: EXP03 log `prose-in-code in generated module (1 prose line; first at line 78: "return negative ? -cents : cents;")`. If confirmed a false positive, the heuristic killed the final synthesis cycle. (Adjudicate in refusal filter; sources not on disk for the refused chunk.)
- **[OBS-5] P6-red "remedy" points at a door that doesn't exist.** `05` `remedy:"Route the project through the open HITL prompt (approve/reject with feedback)…"` + diagnose `actions[1]` same words, while `hitl: None` and `06` hard-refuses `"No pending gate to approve (status: running)."` — reproduced 3/3 experiments (plus D1). `status:"running"` persists while hard-blocked.
- **[OBS-6] `evidenceHash` = verdict-vector fingerprint.** `dod.ts:763-766` docstring ("any content change flips it") overstates: the hash covers only the sorted `id:pass|fail` probe pairs (`dod.ts:787-790`). Distinct projects with equal verdict sets share hashes byte-for-byte (all 7 phases D1↔EXP01). Cannot attest artifact content.
- **[OBS-7] exit-2 parks × diagnose:** logged as `level:"error" code:null "gate exit 2"` rows; `mostLikelyCause` verdicts the parked state "not a clean bill of health" (F-3 class, carried; 7 such rows across EXP01-03).
- **No `decidedBy:"human"` bytes anywhere in E1's campaign** (all approve rows `decidedBy:"autopilot"`, note `"[seat harness] autopilot seat — no human decision claimed"`); no `RT_E_LLM_NO_BALANCE`; no non-null `stop_reason`; all envelopes JSON-clean (no truncation).

### Spend ledger (E1 campaign) — updated

| # | time | source (file · verb) | spent | running total | notes |
|---|---|---|---|---|---|
| 1 | 15:48 | exp01 `01_gate_c0` | 567 | 567 | — |
| 2 | 15:50 | exp01 `05_gate_c3_p6` | 35627 | 36194 | P6 synthesis |
| 3 | 15:51 | exp02 `01_gate_c0` | 612 | 36806 | — |
| 4 | 15:52 | exp02 `05_gate_c3_p6` | 18378 | 55184 | P6 synthesis |
| 5 | 15:53 | exp03 `01_gate_c0` | 520 | 55704 | — |
| 6 | 15:55 | exp03 `05_gate_c3_p6` | 30885 | 86589 | 3 refused cycles |
| 7 | 15:55 | exp04 `01_gate_c0` | 417 | 87006 | in flight |

- **E1 running total 87,006 / 5,000,000 (1.74%)**; all `approve` legs `spent:0`. D-wave (prior lane) 21,963 separate. No cap warnings.

## Poll log (continued)

| # | time | exp/ state | notes |
|---|---|---|---|
| P1 | 15:51 | exp01 red-stop done (05/06/07) | QA above |
| P2 | 15:52 | exp02 at P6 leg | — |
| P3 | 15:54 | exp02 red-stop done; exp03 mid P6 | — |
| P4 | 15:55 | exp03 red-stop done; exp04 create+gate_c0 | 3 distinct P6 failure signatures so far |
| P5 | 15:57 | exp04 at P6 leg (05 0-byte) | — |

## QA — EXP 04 `04_library` — FINAL (FULL PIPELINE — first completion; T9.3 stamp present)

- Leg-by-leg (all `exp/04_library/*.out` read): `00_create` EXIT 0 / 0 · `01_gate_c0` EXIT 2 park P4 / **417** / WALL 4s · `02_approve_c1` EXIT 0 →P5 / 0 · `03_gate_c2` EXIT 2 park P5 / 0 · `04_approve_c2` EXIT 0 →P6 / 0.
- **`05_gate_c3_p6` — EXIT 2 (parked at P8; P6 GREEN)** — `steps:3` (P6→P7→P8 park), spent **4141**, `failedGates: []`, `sealedWithFailures:false`, counts{complete:8,awaiting_hitl:1,locked:4}. P6 gate on disk: `{"passed": true, "unmet": [], "evidenceHash": "3047279992"}`. Synthesis log: placeholder red-seal → `p6.synthesis.attempt | chunk 1/1 · attempt 1 · 240000ms · ok` → `p6.synthesis | LLM module machine-verified · 1 iteration(s) · 15/15 machine-run cases passed on iteration 1` → `dod.reqtrace | p6-arch PASS · tree (2 files)` → `p6.journey.converged | tree-run ok after 1/3 cycle(s) + P6 gate green`. `lastTest = {"ok": true, "detail": "15/15 machine-run cases passed on iteration 1", "label": "tested", "evidenceHash": "1544946138"}` — **T9.3 tested-stamp minted**.
- `06_approve_c3` → P8→P9 / 0 · `07_gate_c4` EXIT 2 park P9 (`hitl.phase 9 | forceHuman None | "Approve production routing"`) / 0 · `08_approve_c4` → P9→P10 / 0 · **`09_gate_c5` EXIT 0** — `status:"complete"`, counts{complete:13}, `nextAction{kind:"done", cmd:"emit"}`, spent **500**.
- **`10_emit_run`** EXIT 0: `"count": 15`, `"moduleEmbedded": true`; treeRun ok — compile 8/8 pass (7 skipped), oracle tests 6 pass / 0 fail (1252ms), entry run pass (749ms); honest skips preserved (`typecheck` UNVERIFIED note: "tsc has no node_modules/.bin entry … NOT executed … not a fabricated pass"; `build` "absent is not a pass"). `substance {stubs:0, reexports:0, real:0, files:[], verdict:"empty", greenWhileStubbed:false}` — **job-scoped census by design** (`compile-check.server.ts:467-471`: "empty (no job modules under `src/jobs/` or `jobs/` — nothing to census)"). Summary's "see warnings" → the warnings are in **`emitted/README.md`**: "3 declared spec-graph job node(s) were NOT materialised by the generated tree (never bridged …)", "3 non-job module(s) are thin bridges to the tree entry … (`src/domain/analytics.ts`, `src/api/routes.ts`, `src/state/store.ts`)".
- `11_npm_test` — TAP: 12 tests, **6 pass / 6 skip ("NOT IMPLEMENTED") / 0 fail**, duration 343ms. `12_doctor` (E1) **vs my re-run** (`e2_scratch/exp04_doctor_e2.out`): all fields byte-same; gaps honest ("skip≠green; stubs≠complete"); `factory.inventory {scanned: emitted, stubs:0, reexports:0, real:0, files:[]}` (job-scoped — see OBS-8). `13_diagnose` (E1) **vs my re-run** (`e2_scratch/exp04_diag_e2.out`): errors (4 rows) + checkpoint identical; deltas ring 10→11, logDirBytes 2928→3226. ✓
- **Emitted tree census (15 files, matches `count:15`):** REAL — `src/generated/chunk-0.ts` (4,811 B, machine-verified), `src/generated.ts` (40 B barrel), `tests/oracle.spec.ts` (12,805 B). BRIDGES — `src/api/routes.ts` (660), `src/domain/analytics.ts` (669), `src/state/store.ts` (665) all `export * from "../generated.ts"` + "fixes/144 (M2) tree bridge" comment. STUBS — `src/main.ts:18` + `src/ui/console.tsx:12` `throw new Error("RT_E_VALIDATION · TODO(E-15) stub: …")`. Docs/config: README/DEPLOY/.env.example/.gitignore/tsconfig.json/package.json/.rapidtool/project.json.
- **E1 self-report check:** transcript final says "PARTIAL — stopped at tool-call limit, mid-exp-05" but `05_dashboard/` is EMPTY (created 15:47, never written) and the transcript has zero exp05 calls beyond the mkdir — nothing for 05-10 exists. E1's log `fixes/322_e1_ten.md` ends at the literal header `## EXP 04 — 04_library` + `<!-- APPEND -->` (no exp04 record, **no END marker**) — this log carries the exp04 record instead.

### FINAL SPEND — campaign total

| exp | legs (non-zero only) | subtotal |
|---|---|---|
| 01_website | gate_c0 567 + P6 35627 | 36,194 |
| 02_game | gate_c0 612 + P6 18378 | 18,990 |
| 03_cli | gate_c0 520 + P6 30885 | 31,405 |
| 04_library | gate_c0 417 + gate_c3(P6+7) 4141 + gate_c5(P10-12) 500 | 5,058 |

**E1 campaign total 91,647 / 5,000,000 (1.83%).** All approve/emit/test/doctor/diagnose legs `spent:0`/absent. No 402, no cap warnings, no non-null `stop_reason` anywhere. (D-wave 21,963 separate.)

---

## FINAL VERDICT — per-experiment (plain language)

| exp | type | outcome | why | driver-facing bytes | verdict |
|---|---|---|---|---|---|
| 01_website | static site | **STOPPED** at P6 | RED `p6-brief-fit` — 6/22 required nouns as identifiers (threshold 11) | exit 1, `RT_E_GATE_PENDING`, no HITL door; diagnose ok | honest red-stop; approve-on-red correctly refused |
| 02_game | browser game | **STOPPED** at P6 | RED `p6-brief-fit` (7/18) + `p6-arch` (missing: `track`, `drop`) | same as above; reqtrace names missing caps | honest red-stop; worst synthesis quality (2-file tree) |
| 03_cli | CSV CLI | **STOPPED** at P6 | RED `p6-verified + p6-brief-fit`; keyed synthesis refused ×3 (2× "functions not exported", 1× "prose-in-code" on a *ternary*) → placeholder sealed | refusals coded `RT_E_VALIDATION`; `p6.journey.exhausted` logged | honest red-stop; **refusal #3 looks false-positive [BUG-4]** |
| 04_library | stats library | **COMPLETED** | P6 converged iter 1 (15/15 machine-run), all 13 phases sealed, emit+test+doctor green | T9.3 stamp; emit count 15; npm test 6 pass/6 skip/0 fail; doctor honest gaps | **full pipeline works**; residual stubs/bridges disclosed in tree README + doctor gaps |
| 05–10 | — | **NOT REACHED** | E1 lane ended (tool-call limit) before starting 05 | dirs empty | no data — not a product failure |

**App-response honesty scorecard:** seat rows 100% `decidedBy:"autopilot"` + "[seat harness]" note on machine actions (zero fabricated human claims in campaign) · every failure carried an `RT_E_*` code (none uncoded) · exit codes consistent with envelopes · no truncated JSON envelopes · P6-red door refusal honest · emit/test/doctor skip-notes explicitly non-fabricated. Against that: the four defects below where the app's *message* doesn't match its *state*.

## Consolidated [BUG]/[OBS] register (fixers)

- **[BUG-1 · MED] `p6-brief-fit` near-constant red.** EXP01 6/22, EXP02 7/18, EXP03 0/16 (placeholder) — replicated with the repo's own helpers. Required-token list keeps raw inflections (`drags`,`drops`,`tracks`,`persists`,`publishes`,`edits`,`updates`,`visitors`) and junk (`no`, `as`); matching is substring (`sandbox.ts:251`), so 2-letter tokens "hit" nonsense. EXP04 proves PASSABLE when a module's vocabulary is dense (machine-verified chunk-0). Repro: `node --experimental-strip-types e2_scratch/check_fit.mjs <build.json>`.
- **[BUG-2 · LOW-MED] L2 lesson rows clipped at 240** (`knowledge.ts:762`,`:956`). All four rows len==240 ending mid-phrase; the cut removes the noun list + evidence hash.
- **[BUG-3 · LOW] L2 text literal "0 hits … none computed"** (`knowledge.ts:1164`; `headless.ts:1012` passes no nouns) vs actual 6/7 union hits — misinforms the red's cause.
- **[BUG-4 · MED-candidate] "prose-in-code" refusal flags a code line** (`return negative ? -cents : cents;` — EXP03 cycle 3, log bytes above). If false-positive, it burned the last synthesis cycle before exhaustion.
- **[OBS-5] P6-red remedy + diagnose actions name a non-existent HITL door** (4/4 experiments + D1); `status:"running"` while hard-blocked.
- **[OBS-6] `evidenceHash` = verdict-vector fingerprint** (`dod.ts:787-790`), not artifact evidence; docstring "any content change flips it" overstates.
- **[OBS-7] exit-2 parks → `level:"error", code:null`** rows + "not a clean bill of health" verdict on honest parks (F-3 carry; 12 rows across 4 exps).
- **[OBS-8] emit/`doctor` substance census is job-scoped (`src/jobs/` only)** — on EXP04 reported `{files:[], stubs:0, real:0, verdict:"empty"}` while the tree holds 2 `TODO(E-15)` throws + 3 reexport bridges elsewhere; doctor's prose `gaps` do flag stubs ("skip≠green; stubs≠complete"), and emit's "see warnings" points into `emitted/README.md` (surface not named in the envelope). Adjudicate: acceptable-by-design labeling vs understated counts.
- **[OBS-9] lane self-report nit:** E1 close says "mid-exp-05" but zero exp05 artifacts/activity exist; E1 log left without exp04 record/END marker (tool-limit cut).

## Poll log (final)

| # | time | state | notes |
|---|---|---|---|
| P6 | 15:57 | exp04: P6 GREEN → P8/P9 parks → P10-12 → **complete**; emit leg in flight | first green P6 |
| P7 | 15:58 | exp04 emit+test+doctor+diagnose done; **E1 final** (status=completed, PARTIAL 4/10) | E1 transcript final line |
| P8 | 15:59 | E3 active; X1 closed PARTIAL (no apply window); X2 waiting Phase B; D3 COMPLETE | wave close-out |
| P9 | 16:00 | repo watch: HEAD `20802b1` unchanged; untracked = 8 lane logs only; no tracked edits | close |

- Transcript poll cadence: ~1–3 min during activity (requirement was ~4–5 min). All E1 legs foreground with EXIT/WALL captured by `exp/drive.sh`; wall times recorded in sections above.

=== END 322_e2_monitor — COMPLETE (monitor: all produced artifacts QA'd + D-carry delivered; campaign itself PARTIAL — stopped 4/10 at E1's tool-call limit; no repo edits, no key spending, read-only verbs only) ===
