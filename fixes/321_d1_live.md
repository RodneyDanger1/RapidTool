# 321 · D1 THE OPERATOR — keyed DRIVER wave (live evidence)

Lane D1 of W44 Phase-2 DRIVER wave (D1 operator / D2 monitor / D3 run-eval).
Repo: `C:\Users\mnril\Desktop\RapidTool Main` — HEAD `20802b1`, tree clean
(boundary green: typecheck 0 · lint 0 · scripts 359/359 · lib 2482/2481+1 · gate.sh ok:true).
TREE FROZEN: no repo edits except this log. No boundary runs, no repo npm test/gate.sh.

Method: all CLI through keyed wrapper `bash C:/Users/mnril/w44_trial/rt.sh <verb> …`
(loads DeepSeek key from .env, never echoed; arms RAPIDTOOL_TOKEN_CAP=5000000).
Raw outputs written to `C:/Users/mnril/w44_trial/live1/NN_*.out`; decisive fields quoted below.
Foreground, 600s timeout per leg. Never force; never fake a human seat. Record `spent` from every envelope.

Plan:
- STEP 1 SEALED PROBE: create lexweb project → `wild --start --steps 20 --agent-seal`
  → expect classifier review-reject park WITH the NEW minted `hitl.forceHuman`.
  Probe doors: `approve --seat autopilot` (expect coded refusal), bare `approve`,
  `reject --note`, `diagnose`.
- STEP 2 LIVE JOURNEY: fresh lexweb project → `gate --live --autopilot`
  → cycle stock-gate parks with `approve --seat autopilot` + re-run (max 6 cycles)
  → if complete: `emit --run` + npm test in emitted tree + `doctor`
  (record T9.3 tested-stamp + substance census).
- STEP 3: `eval` once (read-only scorecard); close log.

Status: IN PROGRESS — log opened.

## Recon (12:16–12:18 CDT)

- Repo `20802b1` confirmed; `git status --short` = only `?? fixes/321_d1_live.md` (this log) — tree otherwise clean.
- Wrapper `rt.sh` verified: loads `DEEPSEEK_API_KEY` from repo `.env` (never echoes; `exec node --experimental-strip-types scripts/rapidtool-cli.mjs "$@"` from repo root), arms `RAPIDTOOL_TOKEN_CAP=5000000`.
- CLI doors (README-cli.md §3-4 + source): `approve --project <p> (--i-am-human | --seat autopilot) [--force]` — seat never guessed; `--seat autopilot` = explicit machine attribution (`decidedBy:"autopilot"`), works non-TTY; `--i-am-human` refused off-TTY. `reject --project <p> --note <≥12 chars>`. `gate --project <p> [--autopilot] [--live]`. `wild --project <p> [--start] [--steps N] [--agent-seal]`.
- Wave-1 prior-door bytes (`w44_trial/_approvetest/*`, PRE-fix): approve/reject all → `{"error":"No pending gate to approve (status: running).","code":"RT_E_GATE_PENDING","exit_code":1}`. Post-fix expectation: minted `awaiting_hitl` gives these doors a real target.
- Helper scripts written: `live1/drive.sh` (tag → run keyed leg, capture `.out`, print EXIT+WALL) and `live1/jsum.py` (envelope field extractor).

Planned tags under `live1/`: `01_sealed_create` · `02_sealed_wild` · `03_sealed_approve_autopilot` · `04_sealed_approve_bare` · `05_sealed_reject_note` · `06_sealed_diagnose` · `10_journey_create` · `11_journey_gate1` … · `30_eval`.

## STEP 1 — SEALED PROBE (lexweb brief · `--agent-seal`)

- **`01_sealed_create`** — `create --brief <lexweb> --name "W44 Live — Sealed Probe (website)" --out live1/sealed/build.json` → **EXIT 0, 2s**. Envelope: `ok:true`, `summary.status:"intake"`, `currentPhase:0`, `phaseCounts{ready:1,locked:12}`, `enforceDod:true` (keyed default), `budget{spent:0,cap:5000000}`. Project file 19,332 B.
- **`02_sealed_wild`** — `wild --project … --start --steps 20 --agent-seal` → running (long leg, below).

- **`02_sealed_wild`** — `wild --project …/sealed/build.json --start --steps 20 --agent-seal` → **EXIT 0, WALL 15s** (`02_sealed_wild.out`, 2,314 B).
  - Envelope: `ok:true`, `action:"start"`, **`outcome:"paused"`, `steps:1`, `changed:true`**, `summary.status:"awaiting_hitl"`, `phaseCounts{awaiting_hitl:1, locked:12}`, `nextAction{kind:"approve", cmd:"approve", phase:0, why:"Phase P0 is finished — it's waiting for your approval."}`, **`budget.spent:4924`** / cap 5000000.
  - `note` = classifier review verdict (REJECT; full text ends mid-sentence in the CLI surface at ~1,180 chars): “The phase claims to be "Deep Research & Feasibility" … but the artifacts describe an entirely different system — WebSocket MCP streaming, OAuth scope inheritance, sandbox escape vectors, and sync engines. … The scorecard is self-contradictory … recycled security/systems template. This phase should not be approved; redo it scoped to a static HTML/CSS marketing site with …”
  - → Disk truth next (project file): minted `hitl` + `wildRun.park`.

### Door probe results (bytes in `live1/03..06`)

**Pristine minted state (disk, before any door touched it — `sealed/build.json`):**
- `status:"awaiting_hitl"`, `currentPhase:0`; phase0 `status:"awaiting_hitl"`, `rejectionHistory:[]`, `gates:null`.
- **`hitl = {phase:0, title:"Review rejected — accept the risk or reject with a note", prompt:"<full classifier feedback>", stakes:"The Auto-Review classifier refused this phase — approve to accept the risk and continue, or reject with a note to send the phase back for repair.", forceHuman:true, requestedAt:1790788688661}`** ← THE NEW MINTED HUMAN GATE.
- `wildRun{active:true, pause:true, phase:0, park:{code:"RT_E_GATE_PENDING", event:"wild.paused", reason:"<clipped 600 + …>", unlock:"human-gate", unlockText:"A human must approve or reject the open gate (console/CLI), then resume the run.", resumePhase:0, resumeAction:"gate", at:1790788688662}}`.

**Door 1 · `03_sealed_approve_autopilot` — `approve --project … --seat autopilot`** → **EXIT 4, WALL 1s**:
`{"ok":false,"error":"Autopilot may not approve a forceHuman gate (R3/B-03).","code":"RT_E_INTERNAL","exit_code":4}` + node stack (`approveHitl engine.ts:1691` → `headless.ts:1231` → `rapidtool-cli.mjs:1069`). Refusal is real + class-correct (R3/B-03) and NOT the wave-1 "no pending gate" — **OBS-2:** it arrives wrapped as `RT_E_INTERNAL`/exit 4 (raw engine throw), not a dedicated governance code.

**Door 2 · `04_sealed_approve_bare` — bare `approve`** → **EXIT 1, WALL 1s**:
`{"ok":false,"error":"approve from a non-TTY names no claimable seat — the human seat needs an interactive terminal (--i-am-human + typed RT_HUMAN_SEAT_TOKEN re-entry; refused off-TTY) and a machine decision must be explicit. Next step: `approve --project <p> --seat autopilot` …","code":"RT_E_VALIDATION","exit_code":1}`.

**Door 3 · `05_sealed_reject_note` — `reject --project … --note "<≥12 chars>"`** → **EXIT 0, WALL 2s — MUTATION APPLIED**:
- Envelope: `ok:true`, `summary.status:"blocked"`, `phaseCounts{rejected:1, locked:12}`, `lastGate{phase:0, decision:"reject", note:"W44 trial probe: the P0 floor artifacts lack the research substance the reviewer demanded; record this rejection as trial evidence.", decidedBy:"human", decidedAt:1790788733274}`, `nextAction{kind:"retry"}`, `budget.spent:0`.
- Disk after: `status:"blocked"`, `hitl:null` (cleared), `wildRun{active:false, pause:false, park:null, stoppedAt:1790788733224}`, phase0 `status:"rejected"`, `rejectionNote` = same note, `rejectionHistory:[{note, at:1790788733274}]`.
- **OBS-1:** `reject` has no seat flag (`reject --project <p> --note <t>`); the machine-applied reject stamped `decidedBy:"human"` in `lastGate`. Trial brief ordered this exact probe; recorded verbatim for adjudication (approve has explicit seat contracts; reject attribution is generic).

**Door 4 · `06_sealed_diagnose` — `diagnose --project …`** → **EXIT 0, WALL 2s** (disk-truth confirmed):
- `project.status:"blocked"`; `wildRun{active:false, pause:false, stoppedAt:1790788733224, lastAutoLog:"P0 review REJECTED: …"}`.
- `errors[]`: `[{code:"RT_E_INTERNAL", message:"Autopilot may not approve a forceHuman gate (R3/B-03)."}, {code:"RT_E_VALIDATION", message:"approve from a non-TTY names no claimable seat …"}]`.
- `timeline`: `wild.step_start(P0)` → `wild.step_paused` → `cli.invocation "wild exit 0"` → refusal rows → reject row.

**STEP 1 verdict: COMPLETE — review-reject park MINTED (forceHuman) · autopilot refused (R3/B-03 bytes) · bare approve refused (seat contract) · reject mutated (blocked + history) · diagnose disk-truth.** Sealed project left blocked; no wild re-run (per brief).

## STEP 2 — THE LIVE JOURNEY (fresh project · `gate --live --autopilot`)

- **`10_journey_create`** — same lexweb brief, `--name "W44 Live — Journey (website)"` → EXIT 0, 2s; `ok:true`, `status:"intake"`, `enforceDod:true`, `budget.spent:0`. (Classifier-reject note measured at **1467 chars**, ends mid-sentence — review reply clearly hit its length cap. Same cut in CLI `note` + minted `hitl.prompt`.)
- **`11_journey_gate1` — CYCLE 0** — `gate --project journey/build.json --live --autopilot` → **EXIT 2 (parked), WALL 6s**, `steps:5`, `stopped:true`, `events:[]`.
  - Envelope: `summary{currentPhase:4, status:"awaiting_hitl", phaseCounts{complete:4, awaiting_hitl:1, locked:8}, researchCount:5, memoryCount:9, nextAction{kind:"approve", phase:4}, budget.spent:502}`.
  - Park = **P4 STOCK gate** (no forceHuman): `hitl{phase:4, title:"Approve isolation policy", prompt:"Confirm the implemented execution boundary: Engine-template runner (bounded, engine-authored code only) (timeout 30s, ramMb unset), non-isolated flag, and network deny only inside the engine-template runner. Declared-not-implemented (do NOT approve as fact): 256 MB cgroups/gVisor/WASM isolates, OAuth-scoped tool calls, worker sandbox.", stakes:"Sandbox and authorization boundary — high stakes.", requestedAt:1790788789133}`. P0–P3 `complete`.

- **`12_journey_approve1` — CYCLE 1 CLEAR** — `approve --project journey/build.json --seat autopilot` → **EXIT 0, WALL 2s**: `ok:true`, `summary.currentPhase:5`, `status:"running"`, `phaseCounts{complete:5, ready:1, locked:7}`, **`lastGate{phase:4, decision:"approve", note:"[seat harness] autopilot seat — no human decision claimed", decidedBy:"autopilot", decidedAt:1790788820295}`**, `nextAction{kind:"run", cmd:"gate", phase:5}`.
- Disk: `status:"running"`, `currentPhase:5`, `hitl:null`; `decisions[0]={"id":"hitl-4-1790788820295","phase":4,"title":"Approve isolation policy","decision":"approve","note":"[seat harness] autopilot seat — no human decision claimed","decidedBy":"autopilot",…,"decidedVia":{"action":"hitl.approve",…}}` — **cursor P4→P5**. Machine door works on stock gates, human seat never claimed.
- Live evidence on disk: `research[0]={provider:"duckduckgo", query:"custom page static marketing visitor browse menu subscribe update w live journey website architecture feasibil…"}` — real harvester call.
- **`13_journey_gate2` — CYCLE 2 run** — re-run `gate --live --autopilot` → **EXIT 2 (parked), WALL 5s**, `steps:1`, `stopped:true`.
  - Envelope: `summary{currentPhase:5, status:"awaiting_hitl", phaseCounts{complete:5, awaiting_hitl:1, locked:7}, lastGate{P4 approve/autopilot}, budget.spent:0}`.
  - Park = **P5 STOCK gate** (no forceHuman): `hitl{phase:5, title:"Approve validation contract", prompt:"Accept the validation contract and the rule that rejections must include qualitative feedback.", stakes:"Prevents infinite regeneration loops.", requestedAt:1790800947563}`.
  - **OBS-3 (timestamp probe):** P5 `hitl.requestedAt`=1790800947563 reads ~+12.13M ms (~3h22m) ahead of the P4 approve `decidedAt`=1790788820295 (seconds later in real time) — recording verbatim; adjudicate whether scheduled-clock by design or skew.

- **`14_journey_approve2` — CYCLE 2 CLEAR** — EXIT 0, 3s: `ok:true`, `summary.currentPhase:6`, `status:"running"`, `phaseCounts{complete:6, ready:1, locked:6}`, **`lastGate{phase:5, decision:"approve", note:"[seat harness] autopilot seat — no human decision claimed", decidedBy:"autopilot", decidedAt:1790800992918}`**, `nextAction{kind:"run", cmd:"gate", phase:6}`; disk `decisions[1]={"id":"hitl-5-1790800992918","phase":5,…,"decidedVia":{"action":"hitl.approve",…}}` — **cursor P5→P6**.
- **`15_journey_gate3` — CYCLE 3 run → HARD DoD RED (stop condition)** — **EXIT 1, WALL 47s**, `steps:1`, `stopped:true`, `outcome:"dod"`, `events:["P6 DoD unmet — hard gate blocks advance: p6-brief-fit."]`.
  - Envelope: `ok:false`, `code:"RT_E_GATE_PENDING"`, `error:"P6 DoD unmet — hard gate blocks advance: p6-brief-fit. — resolve the unmet DoD criteria before advancing."`, `failedGates:[{phase:6, unmet:["Brief-conformance: required brief nouns appear as identifiers in the generated source (single-module, or the union of the tree files in tree mode)"]}]`, `sealedWithFailures:true`, `summary.status:"running"`, `nextAction{kind:"fix-gate", cmd:"gate", phase:6, why:"A gate check on P6 failed — review the gate record before continuing."}`, **`budget.spent:16537`**.
  - P6 ran keyed synthesis (47s; `generatedTree` key now on the project) — but this red minted **NO HITL gate** (`hitl:null`, `status:"running"` on disk) ⇒ non-stock stop: one machine-door attempt below, then leg stop.
- **OBS-3 CORRECTION (wall-clock anchor 15:43 CDT):** `dt.py` at the P5 probe shows `hitl.requestedAt − now = −42.5 s` (gate requested ~42 s before the check) — timestamps are CONSISTENT. The earlier ~3h22m reading was an **inter-call wall-clock gap** (session latency between the approve-1 call ~12:20 and the gate-2 call ~15:42), not product skew. **OBS-3 RETRACTED — no defect.**

- **`16_journey_diagnose3` — stop-state diagnose** — EXIT 0, 1s: `project{status:"running", currentPhase:6, wildRun:null}`; `errors[]` = `gate exit 2` ×2 (codes null) + `RT_E_GATE_PENDING "P6 DoD unmet — hard gate blocks advance: p6-brief-fit…"`; `mostLikelyCause{rank:1, class:"unclassified-errors", summary:"3 error/critical row(s) in window did not match a named heuristic — not a clean bill of health."}`; `actions` = ["Read errors[].event and errors[].code — …do not treat diagnose as none-detected", "Route the project through the open HITL prompt…"]; `growth{ledger rows:2, telemetryRing:6, projectFile:100,750 B, logDirBytes:1,876}`.
- **`17_journey_approve3_hardred` — machine-door attempt on the red state** → **EXIT 1, 1s**: `{"ok":false,"error":"No pending gate to approve (status: running).","code":"RT_E_GATE_PENDING","exit_code":1}` — the wave-1 byte again. **A standard-path P6 hard-DoD red mints NO HITL** (unlike classifier review-rejects) ⇒ no accept/reject door; STOP per protocol.
- **JOURNEY STOP (precise):** stopped at **P6 hard-DoD red `p6-brief-fit`** (keyed P6 synthesis ran — 47s, `budget.spent:16537`; `sealedWithFailures:true`) because `enforceDod:true`. `hitl:null`; `approve` refuses (`17_…`); `retry` inapplicable (needs `blocked`); `repair` needs an emitted dir (not reached); `deepen` is p7-only. Not reached: emit / npm test / doctor / T9.3 tested-stamp (completion branch conditional).
- **P6 tree forensics (probe6 + close + m11x):**
  - `generatedSource` (118 B) = barrel: `export * from "./generated/render-menu-page.ts"; export * from "./jobs/update.ts"; export * from "./jobs/publish.ts";`
  - `generatedTree` = 4 files, each `{path, source, hash, attempt}`: `src/generated.ts` (barrel) · `src/generated/render-menu-page.ts` (real keyed code: `escapeHtml`, `renderMenuPage`, `renderSubscribeForm`, `validateMenu*`, doc comments incl. `// req-7`) · `src/jobs/update.ts` · `src/jobs/publish.ts` (imports the render module; two-phase publish/rollback modelling). P6 keyed synthesis clearly produced substantive code.
  - Disk gate record `phases[6].gate = {"passed": false, "unmet": ["Brief-conformance: required brief nouns appear as identifiers in the generated source (single-module, or the union of the tree files in tree mode)"], "evidenceHash": "1246104519", "checkedAt": 1790801040625}`.
  - Learning row `memory[11]` (len 240) **ends mid-phrase**: `"L2 template-emission: phase P6 sealed with gate unmet (Brief-conformance: …); required brief nouns with 0 hits in "` — the noun list that should follow is absent (another surface-clip candidate; its tags slice the criterion at the comma: `"probe:brief-conformance: …(single-module"` / `"probe:or the union of the tree files in tree mode)"`).
  - Observation only (no remediation — repo frozen): the tree carries brief vocabulary in compound identifiers (`render-menu-page`, `renderSubscribeForm`, `jobs/publish`), yet the DoD scanner recorded **0 hits**; the scan surface/tokenizer + the clipped noun list are the natural next investigation for `p6-brief-fit`.

## STEP 3 — EVAL (read-only) + CLOSE-OUT

- **`30_eval`** — EXIT 0, 1s. Read-only scorecard over the harness's own frozen documents (`research/eval-out`; results.json `mode:"keyed"`, `generatedAt:"2026-09-25T00:03:43Z"`) — the pre-existing keyed-eval corpus record, not a re-score of today's builds.
- Criteria (1 entry, slug `coffeehouse2home-property-ledger`): M1 substance **0**/1 · M2 runs **0**/1 · M3 iterates **0**/1 · M4 verifiable **0**/1 · M5 honest **1**/1 ("no red DoD gate records — nothing to hide") · M6 handover **0**/1 · M7 learning **0**/1 (regression) · M8 bounded **1**/1 · M9 on-time (stops loudly) **1**/1.
- `derived{entries:1, totalSum:3, meanTotal:0.3333, passCount:0, acceptance{fail:1}}` · `runMarker{done:true, preflightClass:"balance-exhausted", decision:"retrace-first", meanOfNine:2.9997}` · `graderFreeze{checked:7, ok:true, changed:[]}` · `trends`: 15 rows since 2026-09-08, bestMean 1 · `sourceSummary{skipped:1 (README.md not a fixture)}`.
- **Close-out:** repo `git status --short` = `?? fixes/321_d1_live.md` + `?? fixes/321_d2_monitor.md` (sibling lane) — no tracked-file modifications; no boundary runs; both trial projects left as-is (sealed = `blocked`; journey = `running` @ P6 red). Spends: sealed wild **4924** · gate1 **502** · gate3 **16537** (`budget.spent`; other envelopes report 0) — cap 5,000,000 untouched. Raw evidence in `C:/Users/mnril/w44_trial/live1/**` (15 envelopes + probe scripts + `sealed/` + `journey/` project dirs).
- **Findings index:** F1 minted forceHuman gate end-to-end (STEP 1, all four doors) · F2 live journey: P0–P5 green with real research (duckduckgo), stock P4/P5 cleared by explicit seat autopilot, hard stop at P6 `p6-brief-fit` red with NO HITL door (`approve` → "No pending gate to approve (status: running).") — retry needs `blocked`, repair needs an emitted dir, deepen is p7-only · F3 P6 forensics above · OBS-1 reject stamps `decidedBy:"human"` (no seat flag exists on reject) · OBS-2 R3/B-03 refusal wrapped as `RT_E_INTERNAL`/exit 4 · OBS-3 retracted (session latency, not clock skew).

=== END 321_d1_live — COMPLETE (STEP 1 full · STEP 2 loop → P6 hard-DoD stop · STEP 3 eval; journey did NOT reach completion; no repo edits) ===
