# 240 · MISSING-TASKS AUDIT — the full task universe vs the chat's 17-item list

**Written:** 2026-09-24 by the W14 completeness auditor (read-only on `src/`, `scripts/`, the plan corpus; no git mutations).
**Brief read first:** `wave_plans/W14/completeness-auditor.md` (in full). **Tree of record:** uncommitted on `7582771`; C-1 landed (`fixes/236`), three W14 lanes in flight (`fixes/237_lane1/2/3`), two watchdogs in flight (`fixes/238/239`).
**This file is the only write.** Every "missing" claim below carries a cited source line; every disk claim carries the command that produced it today. Disk checked today: `grep -c nextAction src/lib/headless.ts` = **0** · `grep -cE 'feasibility|template-derived|not live research' src/components/console.tsx` = **0** · `grep -c TRUNC src/components/console.tsx` = **0** · `grep -c 'redTree' scripts/rapidtool-cli.mjs` = **9** · `grep -n 'UNKNOWN at write time' fixes/217c_phase5_spec_and_decision_register.md` → `:592` still stale · `grep -c 'case "' scripts/rapidtool-cli.mjs` = **35** · `grep -c 'OV-35\|OV-38\|OV-41' research/multiagent/220_tasklist_canonical.md` = **0** (merge not yet folded).

---

## BOTTOM LINE

> `universe: 61 · covered by the 17: 23 · missing: 25 · not-lane-work: 13`
>
> **missing ids:** `DF-18 · DF-26 · OV-1 · T-107.6 · OV-9 · OV-14 · OV-16 · OV-18 · DF-04 · TA-21 · G5 · T4.2 · OV-7 · T-107.7 · T5.1 · T5.4 · T5.5 · T5.7 · F3 · OV-41 · OV-43 · OV-28 · OV-30 · OV-19 · OV-20`

**The single most important missing item: `DF-18` + `DF-26` (one bundle — 235's W0 lane K1).** It is the **only W0 lane with no chat row** (W0's other lanes are covered: C-1 = `w0-c1`, C-2 = `w0-c2`, OV-12 = inside `w0-docs`), both rows are **verified still open on disk today** (greps 0/0, commands above), they sit at **#5 of the owner-facing first-48-hours list** (`220_tasklist_canonical.md` §5), they are S+S on one file (`console.tsx` — and lane 3's browser pass is its registered acceptance), and their class — a user-visible claim the code cannot back — is the product's own honesty edge and Phase B's exit criterion (`220_overhaul_plan.md` §3). Runners-up, named so they are not lost: **`OV-1` + `T-107.6`** are the two 219e W14 lanes with no chat row — and two chat rows already *depend* on them (**F2** "follows OV-1" and **OV-37** "deps: OV-1" per `fixes/228` §3 #25/#10; **OV-41** "deps: T-107.6" per `fixes/228` §3 #14) — and **`OV-9`** is a named input of the already-visible M-B latch item (`w5-accept` → OV-40; `220_tasklist_canonical.md` §3).

---

## §1 · Method, counting conventions, and the 17 items

**Universe built from (all read-only):** `220_tasklist_canonical.md` §1 (42 rows + AUD-2/WD-Z markers) · `226` (OV-27…31) · `227` (OV-35…43 + record-steps R1–R4) · `225` (OV-19/20/21/OV-TBD) · `fixes/228_ledger_and_risk_register.md` §3 (the authoritative ACCEPT/MODIFY/REJECT merge; F5 = REJECT) · `235_execution_readiness_audit.md` (wave plan W0–W6 + 17 placed rows) · `220_overhaul_plan.md` §4.1/§4.2/§4.6/§4.7/§4.9/§4.10 (the brief cites "§4.4 (owner decisions)" — **there is no §4.4 heading in the file**; the owner-decision register is **§4.7**, and the first-48h list is §4.2 — verified by heading scan today) · `229_steering_and_goal_alignment.md` §4/§5 · `wave_plans/W14/lanes.md` + `watchdogs.md` (the live wave briefs — ground-truth for what the in-flight lanes actually cover).

**Counting conventions (stated so the arithmetic is auditable):**
- Counted universe items = **42 canonical rows + 19 accepted new rows** (from `fixes/228` §3 ACCEPT/MODIFY entries, after removing those the merge itself *absorbs* into another row). Absorbed/administrative/rejected candidates are listed in §3-C and **not** counted (no double-counting).
- Each row lands in exactly one bucket: **M** = dispatchable lane/merge work covered by a chat item (grouped coverage counts); **K** = missing; **W** = not-lane-work (DONE-VERIFIED / OWNER-RUN / OWNER-DECISION / RESEARCH-ONLY / UNVERIFIABLE-NOW). `N = M + K + W = 23 + 25 + 13 = 61`.
- Rows inside the list but owner-shaped (T0.10, OV-11, C-1) are counted in **W**, with their chat representation noted — they are not lane work.
- Record-steps R1–R4 are covered inside OV-38/OV-39/OV-40 — counted once there, not separately.

**The 17-item chat list and what each item covers (group map):**

| # | chat item | covers (cited) |
|---|---|---|
| 1 | `w0-c1` C-1 [DONE] | C-1 — landed, `fixes/236_c1_wb1_deadlock_fix.md` (RED 90/91 → GREEN 91/91) |
| 2 | `w0-c2` C-2 | C-2 — lane 1, log reports LANDED (`fixes/237_lane1_c2_dod_terminal.md`); gate/watchdog pending |
| 3 | `w0-ov35` OV-35 (OV-27 probe first) | OV-35 + its absorbed item 0 = OV-27 (`fixes/228` §3 #4/#5) |
| 4 | `w0-docs` doc-truth sweep | **TA-3 + OV-17 + OV-15 + OV-12** — verbatim lane 2 scope, `wave_plans/W14/lanes.md` ("Doc-truth sweep (TA-3 + OV-17 + OV-15)" + item 4 the `fixes/217c` register slot = OV-12) |
| 5 | `w2-ov2` OV-2 browser pass | OV-2 — lane 3 (`fixes/237_lane3_browser_pass.md`, in progress) |
| 6 | `w1-task01` TASK-01 | TASK-01 (still open today: nextAction = 0 in `headless.ts`) |
| 7 | `w1-t52a` T5.2-A | T5.2 half A |
| 8 | `w2-t53` T5.3 | T5.3 (AUD-2 correction: use `--limit=1`) |
| 9 | `w2-ov13` OV-13 (+OV-29) | OV-13 + absorbed OV-29 (`fixes/228` §3 #11) |
| 10 | `w3-think` OV-36/OV-37 | OV-36 + OV-37 |
| 11 | `w3-ci` CI workflow | CI-workflow (224 → `fixes/228` §3 #7 MODIFY→ACCEPT) |
| 12 | `step0` Step 0 | T0.10 (OWNER-RUN) |
| 13 | `w5-zeros` OV-3/OV-5/OV-4 | the three zeros rows, grouped |
| 14 | `ov11` OV-11 | OV-11 (OWNER-DECISION / OV-DEC-1) |
| 15 | `w5-accept` OV-38/39/40 | OV-38 (= R1+R2) + OV-39 (= R4) + OV-40 (= R3) |
| 16 | `features` F2/F4/F1 | F2 + F4 + F1 (+ OV-6 folded into F1, `fixes/228` §3 #29) |
| 17 | `merge` parent's merge pass | 229 §5 step 2 + 235 §6 item 2 (fold OV-35/C-1/C-2 into canonical+playbook) + the AUD-2 coverage resolutions (scheduler/patch-format cut lines; lesson-ranking cross-ref → F3) |

**Suspected missing but actually covered (so the parent does not re-chase them):** OV-12, OV-15, OV-17 (all inside lane 2's verbatim scope, `wave_plans/W14/lanes.md`) · OV-27 (inside `w0-ov35`) · OV-29 (inside `w2-ov13`) · C-3 (folded into OV-3, `fixes/228` §3 #3) · OV-42 (its non-duplicated half is OV-35's marker half, `fixes/228` §3 #15) · R1–R4 (inside `w5-accept`) · OV-6/OV-31 (folded into F1).

---

## §2 · THE DIFF TABLE

### A · The 42 canonical rows (`220_tasklist_canonical.md` §1)

| id | title (short) | canonical status | in the 17? | covered by |
|---|---|---|---|---|
| TASK-01 | nextAction on the summary envelope | TODO | **yes** | `w1-task01` |
| T5.3 | `eval` verb (M1–M9 scorecard) | TODO | **yes** | `w2-t53` |
| T-107.6 | token ledger records spend at the four seams | TODO | **NO** | — **MISSING** |
| OV-1 | provider breadth step 1 (env selection + doctor) | TODO | **NO** | — **MISSING** |
| OV-2 | first browser pass (guard fix first) | TODO | **yes** | `w2-ov2` (lane 3, in flight) |
| TA-3 | doc-truth sweep: verbs, counts, USAGE | TODO | **yes** | `w0-docs` (lane 2) |
| OV-3 | M2 leg: emitted tree's own tests run honestly | BLOCKED-KEY | **yes** | `w5-zeros` |
| OV-4 | M3/M4 leg: promote machine-verified verdict | BLOCKED-KEY | **yes** | `w5-zeros` |
| OV-5 | M9/M7 leg: journey stop + learning baseline | BLOCKED-KEY | **yes** | `w5-zeros` |
| T4.2 | git landing tail (init + commit behind a seat) | TODO | **NO** | — **MISSING** |
| OV-6 | interop spike: 35 verbs as MCP tools? | RESEARCH-ONLY | no | W-table (folded into F1) |
| T-107.7 | checkpoint + `resume` verb | TODO | **NO** | — **MISSING** |
| T4.3 (+TA-18) | patch preservation on user-edited trees | UNVERIFIABLE-NOW | no | W-table |
| OV-7 | eval-corpus expansion + grader-freeze audit | TODO | **NO** | — **MISSING** |
| T0.10 | fresh keyed run #1 — Step 0 | OWNER-RUN | **yes** | `step0` (W-table: owner-run) |
| OV-8 | keyed run #2 + publish + claim flips | OWNER-RUN | no | W-table (recommend a chat row) |
| T5.1 | streaming output (transport spike first) | TODO | **NO** | — **MISSING** |
| T5.2-A | fixtures review UI + store actions | TODO | **yes** | `w1-t52a` |
| T5.4 | artifact provenance fields | TODO | **NO** | — **MISSING** |
| T5.5 | plugin / hook registry v1 (in-process) | TODO | **NO** | — **MISSING** |
| T5.7 | deterministic LLM cassette (record/replay) | TODO | **NO** | — **MISSING** |
| DF-09 | approval needs no note — even over a failed gate | UNVERIFIABLE-NOW | no | W-table |
| DF-18 | scorecard's template-estimate caveat dropped in UI | TODO | **NO** | — **MISSING** (0 today) |
| DF-26 | packet truncation invisible in the console | TODO | **NO** | — **MISSING** (0 today) |
| DF-04 | P7 artifact claims MCP/A2A with no disclaimer | TODO (residual) | **NO** | — **MISSING** (grep = 1 today) |
| G4 | no emitted-tree error scan exists | UNVERIFIABLE-NOW | no | W-table |
| G5 | emitted product carries zero RT_E codes | TODO | **NO** | — **MISSING** |
| OV-9 | `productComplete` has no producer | TODO | **NO** | — **MISSING** |
| OV-12 | register still says isolation outcome UNKNOWN | TODO | **yes** | `w0-docs` (lane 2 item 4; `:592` still stale today) |
| OV-13 | silent degrades → visible record rows | TODO | **yes** | `w2-ov13` |
| OV-14 | `archProductComplete` computed but never surfaced | TODO | **NO** | — **MISSING** |
| OV-15 | redTree banner unreachable from the CLI | TODO | **yes** | `w0-docs` (lane 2 item 3; `--red-tree` already in CLI today) |
| OV-16 | unmaterialised-job truth (doctor + README) | TODO | **NO** | — **MISSING** |
| OV-17 | README Quickstart commands are BROKEN | TODO | **yes** | `w0-docs` (lane 2 item 2) |
| TA-21 | P9 deploy artifacts unlabeled | TODO | **NO** | — **MISSING** |
| OV-18 | clamp marker truncates at custom caps ≈64–118 | TODO | **NO** | — **MISSING** |
| T-107.8 | isolation executor: confirm Outcome 2 | OWNER-DECISION | no | W-table |
| OV-10 | is "human-approved fixtures" the right bar? | OWNER-DECISION | no | W-table |
| OV-11 | make the red seal teach | OWNER-DECISION | **yes** | `ov11` (W-table also) |
| D-1 (T5.6) | TS-only boundary: declare or build? | OWNER-DECISION | no | W-table |
| D-2 (T5.8) | local-first posture statement | OWNER-DECISION | no | W-table |
| T3.6 | `format:check` + verification wiring | OWNER-DECISION | no | W-table |

### B · The 19 accepted new rows (`fixes/228` §3 — the authoritative merge; non-absorbed)

| id | title (short) | merge verdict | in the 17? | covered by |
|---|---|---|---|---|
| C-1 | break the gate-before-mint deadlock (lane 0) | ACCEPT #1 | **yes** | `w0-c1` [DONE] → W-table |
| C-2 | `"dod"` = coded terminal stop | ACCEPT #2 | **yes** | `w0-c2` |
| OV-35 | Step-0 preflight + triage + kill-safety | ACCEPT #4 (absorbs OV-27, OV-42's marker half) | **yes** | `w0-ov35` |
| OV-36 | pin thinking decision at the 3 pro-tier sites | ACCEPT #8 | **yes** | `w3-think` |
| OV-37 | alias-death: requested id in the refusal + refresh path | ACCEPT #10 | **yes** | `w3-think` |
| OV-38 | M-A acceptance + hand-over kit (R1+R2) | ACCEPT #6 | **yes** | `w5-accept` |
| OV-39 | post-maker DF re-triage (R4) | ACCEPT #20 | **yes** | `w5-accept` |
| OV-40 | M-B latch acceptance (R3) | ACCEPT #21 | **yes** | `w5-accept` |
| OV-41 | surface measured spend (cost telemetry) | ACCEPT #14 | **NO** | — **MISSING** |
| OV-43 | emitted-tree supply-chain floor (report-only) | MODIFY #16 | **NO** | — **MISSING** |
| OV-28 | thinking-mode contract at the registry boundary | MODIFY #9 (test-pin half only) | **NO** | — **MISSING** |
| OV-30 | name/serialize the install-leg budget in the plan | MODIFY #12 (register OV-18-style) | **NO** | — **MISSING** |
| OV-19 | no-zero-byte-source guard | MODIFY #17 (scoped + allowlist) | **NO** | — **MISSING** |
| OV-20 | docs-name-a-module parity probe | MODIFY #18 (advisory-only or cut) | **NO** | — **MISSING** |
| CI-workflow | one workflow running `scripts/gate.sh` | MODIFY→ACCEPT #7 | **yes** | `w3-ci` |
| F1 | MCP runtime client (discovery-first) | ACCEPT #24 | **yes** | `features` |
| F2 | provider breadth step 2 | ACCEPT #25 (follows OV-1) | **yes** | `features` |
| F3 | cross-run learning measurement | ACCEPT #26 (absorbs lesson-ranking) | **NO** | — **MISSING** |
| F4 | per-action allow-lists / autonomy boundary | ACCEPT #27 | **yes** | `features` |

### C · Absorbed / administrative / rejected candidates (NOT counted in N — listed so nothing vanishes)

| candidate | resolution (cited) | where it lives now |
|---|---|---|
| C-3 (keyed-tree fixture, M2's source) | ACCEPT #3 → fold into OV-3 | covered via `w5-zeros` |
| OV-27 (CLI reachability probe) | ACCEPT #5 → OV-35's first item | covered via `w0-ov35` |
| OV-29 (`headless.ts:208/:231` sweep) | ACCEPT #11 → fold into OV-13 | covered via `w2-ov13` |
| OV-42 (keyed provenance/comparison) | MODIFY #15 → slim/fold into OV-35 + OV-8 | covered via `w0-ov35` (marker half) |
| OV-31 (strike or fold OV-6 into F1) | ACCEPT #13 (administrative) | OV-6 row → fold into F1 |
| OV-21 (silent-empty audit) | MODIFY #19 → fold into G4, advisory | G4 (W-table: definition owed) |
| OV-TBD (classify competitor security hits) | MODIFY #23 → research note, explicitly *not* product work (D3.6) | no row by design; 225's hunt-4/5 caveats travel |
| AUD-2 coverage (§6(b) gaps: scheduler · patch-format · lesson-ranking) | MODIFY #22 → resolve as cuts/cross-refs | merge-pass text; lesson-ranking → F3 cross-ref |
| F5 (codebase-scale index) | **REJECT #28** (D3.2) — do not re-propose | stop-sign recorded; never a row |
| 225 hunts 4/5 raw tables | candidate counts, **not findings** (`fixes/228` D1.5) | data only; caveats must travel |

### D · Record-steps R1–R4 (`227` §1) — all four covered

| step | what | covered by |
|---|---|---|
| R1 | M-A artifact acceptance (census + ≥3 oracle rows) has no row | OV-38 → `w5-accept` |
| R2 | hand-over kit + friend's first use as acceptance | OV-38 → `w5-accept` |
| R3 | M-B latch acceptance on the real project | OV-40 → `w5-accept` |
| R4 | post-maker DF re-triage (16 open DFs) | OV-39 → `w5-accept` |

### E · Wave-plan check (`235` §1, W0–W6)

235 places **17 rows in 14 lanes** (W0: C-1, C-2, DF-18+DF-26, OV-12 · W1: OV-35, TASK-01, T5.2-A · W2: T5.3, OV-2, OV-13 · W3: TA-3+OV-17+OV-15 · W4: T0.10 · W5: OV-3, OV-5 · W6: OV-4). **The wave plan adds zero new tasks** — every placed row is already in the universe. Of the 17 placed rows, **15 have a chat item; 2 do not: `DF-18` + `DF-26`.** 235's deliberately-not-placed set (W16/Phase-5 rows, 6 owner decisions, the 3 UNVERIFIABLE-NOW rows) maps exactly to my K/W buckets.

---

## §3 · THE MISSING LIST (25 rows — ordered maker-test-first)

Every row below is (a) accepted or canonical-TODO, (b) covered by **no** chat item, (c) verification-bearing (exact command, or a named definition step where the record says the check must be defined first). **Tier 1 = do now, keyless, verified open today; Tier 2 = accepted set, cheap; Tier 3 = program backlog (post-maker/post-key).**

### Tier 1 — W0/W14-cycle holes (order = leverage)

| # | id | title | source (cited) | why it matters now | verification (exact) |
|---|---|---|---|---|---|
| 1 | **DF-18** | scorecard's template-estimate caveat dropped in UI | `220_tasklist_canonical.md` §1E; 235 W0 lane K1; 48h #5 | a "loud" mislabel: the scorecard reads as live research; **0 on disk today**; Phase B's "no claim the code cannot back"; 235 grades its grep WEAK → also grep the `ScorecardBlock` region (`console.tsx:3303`) and make lane 3's browser pass its registered acceptance | `grep -cE 'feasibility\|template-derived\|not live research' src/components/console.tsx` → ≥ 1 (0 today) |
| 2 | **DF-26** | packet truncation invisible in the console | same as above | the 14 000-char hard truncate + `TRUNC_MARKER` (`packet.ts:17,:545-569`) is silent in the console — a downstream agent silently loses the packet tail; **0 on disk today**; 235: assert the surface reads the packet's own accounting (`:16/:17/:561`), never recompute | `grep -c TRUNC src/components/console.tsx` → ≥ 1 (0 today) |
| 3 | **OV-1** | provider breadth step 1: env selection + doctor surfacing | §1A (lane W14-L3); `fixes/228` §3 #25/#10 | the two chat items **F2** ("follows OV-1") and **OV-37** ("deps: OV-1") depend on it; 226 Half B warns widening `ROLE_TIERS.reasoning` arms the thinking-mode bug with zero coverage — sequence with OV-36 | `node --experimental-strip-types --test --test-concurrency=2 src/lib/llm/providers/registry.test.ts` + `src/lib/doctor.test.ts` |
| 4 | **T-107.6** | token ledger records measured spend at the 4 seams | §1A (lane W14-L2); WD-Z marker (node-runner seam unobservable as written); D2.3/A3 | a W14 lane row no chat item tracks; its budget wiring without a catch wrapper turns a controlled stop into `RT_E_INTERNAL` (D2.3: keep the default cap unset until after Step 0); OV-41 depends on it | `node --experimental-strip-types --test --test-concurrency=2 src/lib/token-ledger.test.ts src/lib/verify.server.test.ts src/lib/node-runner.server.test.ts` (+ `chat.test.ts`/`crew.test.ts`); **definition step required first**: scope the node-runner seam out or define its probe at dispatch (WD-Z marker) |
| 5 | **OV-9** | `productComplete` has no producer | §1E; §3 ("T5.2-A + OV-9 → M-B latch") | a named input of the already-visible M-B latch (`w5-accept` → OV-40) — without it the latch stops at minting the last input | extend `src/lib/doctor.test.ts` (latch semantics proven at `:81-92`) + targeted run |
| 6 | **OV-14** | `archProductComplete` computed but never surfaced | §1E | the "skip≠complete" distinction is invisible outside tests — a vacuous keyless pass can read clean | extend `src/lib/gates.test.ts` + `src/lib/packet.test.ts`; targeted runs |
| 7 | **OV-16** | unmaterialised-job truth: doctor scan + emitted README | §1E (+ IMPROVER: `doctor --tree` is a real flag, CLI `:2767`) | `doctor --tree` cannot surface the unmaterialised cause, and the emitted README lists files that do not exist — a declare-or-strike class defect | `node --experimental-strip-types scripts/rapidtool-cli.mjs doctor --tree <tree>` + `src/lib/scaffold.test.ts` targeted |
| 8 | **OV-18** | clamp marker truncates at custom caps ≈64–118 | §1E | registered-not-fixed; the window is deliberately unpinned — pin it | extend `src/lib/honesty-guards.test.ts`; `node --experimental-strip-types --test --test-concurrency=2 src/lib/honesty-guards.test.ts` |
| 9 | **DF-04** | P7 artifact still claims MCP/A2A with no disclaimer | §1E (grep = 1 today) | an unlabeled capability claim on the emitted artifact (`engine.ts:922`) | `grep -c 'MCP/A2A' src/lib/engine.ts` → 0 (or a read check that the claim is labeled, pattern `phases.ts:33`) |
| 10 | **TA-21** | P9 deploy artifacts unlabeled | §1E | canned GH-Actions YAML + cloud sketches ship with no "template — not executed" marker | read the emitted P9 artifact text + `grep -n 'IaC sketch\|GitHub Actions workflow' src/lib/engine.ts` |
| 11 | **G5** | emitted product carries zero RT_E codes | §1E | a fresh emit must surface coded failures where it fails (the generated tree is undiagnosable today) | fresh emit (CLI `emit`) then `grep -rc "RT_E" <tree>/src <tree>/tests` → > 0 |

### Tier 2 — accepted-set rows not on the chat list (`fixes/228` §3; cheap)

| # | id | title | merge verdict | why / caveat | verification |
|---|---|---|---|---|---|
| 12 | **F3** | cross-run learning measurement | ACCEPT #26 (absorbs the AUD-2 lesson-ranking item) | makes "self-improving" a falsifiable number; 221 F3 status DESIGNED (`221:19`); keyed number gated on Step 0 (keyless still yields a labelled number); T-11 stays muted until OV-11 | `node --experimental-strip-types --test --test-concurrency=2 src/lib/knowledge.test.ts` then `node --test --test-concurrency=2 scripts/rapidtool-cli-lesson.test.mjs` (`221:319-325`) |
| 13 | **OV-41** | surface measured spend (tokens + `estimateCostUsd`) | ACCEPT #14 (S; scope-label "P6-only") | the cap is surfaced, the spend is nowhere; depends on T-107.6 | targeted `headless`/`doctor` runs + `npm run eval` keyless print (`227` §6) |
| 14 | **OV-28** | thinking-mode contract at the registry boundary | MODIFY #9 — **test-pin half only**; behaviour change waits on the owner's tier intent | same subject as OV-36 (which is on the list) but a different seam; land the body-shape test-pin (named definition step: the pin's shape is the row's deliverable) | `node --experimental-strip-types --test --test-concurrency=2 src/lib/llm/providers/registry.test.ts` (extended with the body-shape pin) |
| 15 | **OV-30** | name/serialize the verifyKind install-leg budget | MODIFY #12 — register OV-18-style with the honest 8 GB caveat | D2.5: the 240 s `npm ci` leg can thrash an 8 GB host; the fix is registration, not engineering — can land in the parent's merge pass | read-back of the registered caveat text (named definition step) |
| 16 | **OV-19** | no-zero-byte-source guard (+ named test ≥1 case) | MODIFY #17 — scope to source+test extensions with an explicit allowlist | the field evidence is 12 files/6 clones (`225` hunt 2), but the guard design must be scoped to avoid false positives | the new guard's own test, run on the repo → 0 offenders or allowlisted |
| 17 | **OV-20** | docs-name-a-module parity probe | MODIFY #18 — advisory-only **or cut** | weakest accepted item; self-rejected as heuristic (`225`); 228 D3.3 prefers folding into G4/OV-19 — **parent decision needed** | advisory output only (never a gate) |
| 18 | **OV-43** | emitted-tree supply-chain floor (report-only) | MODIFY #16 — report-only, S first, optional | the install leg runs `--no-audit` (`compile-check.server.ts:1149-1156`); emitted deps are caret-pinned with no lockfile; gpt-pilot lesson (`RESUME.md:628`) | extend `src/lib/compile-check.server.test.ts`; scratch install probe |

### Tier 3 — program backlog (post-maker / post-key; still canonical-TODO with commands)

| # | id | title | source | why it matters now | verification |
|---|---|---|---|---|---|
| 19 | **T4.2** | git landing tail (init + commit behind a seat) | §1B (W15-L4); `.gitignore` half already landed | the last W15 landing row; new module `src/lib/git.server.ts` (absent today) | new module test + scratch-dir CLI probe (exact probe to name at dispatch — WD-C §3 minor) |
| 20 | **OV-7** | eval-corpus expansion + grader-freeze audit | §1C (W16-L3) | makes M7 measurable across ≥2 domains; graders frozen and leak-scanned | `npm run eval -- --trials=2` + grader-freeze check (form to be fixed at dispatch) |
| 21 | **T-107.7** | checkpoint + `resume` verb | §1C (W16-L1) | kill mid-P6 → resume → same state hash; a restore is itself a ledgered event | targeted resume probe + lib tests (probe to name at dispatch) |
| 22 | **T5.1** | streaming output (transport spike first) | §1D (Phase 5) | canonical TODO; note the tension — `229` §4.4 says do **not** chase gap #6 (IDE/streaming) as a competitive gap; the row itself stands | `node --experimental-strip-types --test --test-concurrency=2 src/lib/chat.test.ts` + new scripts-leg NDJSON test |
| 23 | **T5.4** | artifact provenance fields | §1D | T5.7 depends on it (replay labels need provenance) | extend `src/lib/io.test.ts` + `src/lib/packet.test.ts` + `src/lib/codegen.server.test.ts` |
| 24 | **T5.5** | plugin / hook registry v1 (in-process only) | §1D | dep: T-107.8 decision (scope settled by it) | new `src/lib/plugin.test.ts` |
| 25 | **T5.7** | deterministic LLM cassette (record/replay) | §1D | dep: T5.4; a cassette miss must be a coded refusal, never fabricated text | new round-trip + hash-key + miss-refusal tests; keyless `npm run eval` stays byte-identical |

---

## §4 · NOT-LANE-WORK (13 rows — for owner-visibility decisions)

These are not "missing work" in the dispatchable sense (brief's hard rule): DONE-VERIFIED / OWNER-RUN / OWNER-DECISION / RESEARCH-ONLY / UNVERIFIABLE-NOW. Listed so the parent can decide whether a chat row should exist for visibility.

| id | type | source (cited) | in the 17? | reason / what the parent may want |
|---|---|---|---|---|
| C-1 | DONE-VERIFIED | `fixes/236` (RED 90/91 → GREEN 91/91, typecheck 0) | **yes** (`w0-c1` [DONE]) | nothing to dispatch; watchdog + boundary gate will seal it |
| T0.10 | OWNER-RUN | §1C; 235 W4 (owner window, quiet host) | **yes** (`step0`) | the linchpin; MUST-precede set (C-1 · C-2 · OV-35 a/b) is covered/in flight (235 §5) |
| OV-8 | OWNER-RUN | §1C | no — **recommend adding a chat row** | the second keyed run + the only place claims flip (declare-or-strike); depends on the zeros + OV-35 marker discipline |
| T-107.8 | OWNER-DECISION | §1F | no | isolation Outcome-2 confirmation; gates OV-12's wording and T5.5's v1 scope |
| OV-10 | OWNER-DECISION | §1F | no | "human-approved fixtures" bar question; doctor latch wording |
| OV-11 | OWNER-DECISION | §1F (OV-DEC-1); 229 §4.2 recommends YES | **yes** (`ov11`) | red-seal sign-off — ~6 + ≈4 seam lines + the T-11 pin deliberately updated |
| D-1 (T5.6) | OWNER-DECISION | §1F | no | TS-only boundary declare-or-build; Option A (S) is the recommended shape |
| D-2 (T5.8) | OWNER-DECISION | §1F | no | local-first posture statement |
| T3.6 | OWNER-DECISION | §1F | no | `format:check` needs user consent; **do not run the current `hermes verify` recipe as-is** (D2.4) |
| OV-6 | RESEARCH-ONLY | §1B; `fixes/228` §3 #29 | no (F1 is) | folded into F1 — do not run as its own lane (D3.1: prose done-when) |
| DF-09 | UNVERIFIABLE-NOW | §1E | no | define its check first (candidate: extend `src/lib/honesty-guards.test.ts`) — deliberately excluded from the 48h for this reason |
| T4.3 | UNVERIFIABLE-NOW | §1C | no | define the preservation probe first (candidate: `src/lib/patch.test.ts` + a scratch edit-cycle probe) |
| G4 | UNVERIFIABLE-NOW | §1E | no | define the scan + its runner first; OV-21's advisory intent folds here |

---

## §5 · COVERAGE PROOF (one line per source document) + TOTALS

| source | what this audit took from it |
|---|---|
| `220_tasklist_canonical.md` | all 42 §1 rows + statuses + verify cells; the 5 AUD-2 markers (T5.3 `--limit=1`, OV-6 count, DF-09 anchor `:1629`, lesson-writers 18, §6(b) coverage gaps) and 2 WD-Z markers (T-107.6 seam observability, TA-3 README:14) folded as caveats; §2's 23 DONE-VERIFIED capabilities = do-not-rebuild (not task rows) |
| `226_shortcomings_and_plan_stress.md` | OV-27…OV-31 (all resolved by 228 §3); A2/A3/A5/A7 cited where they touch rows (OV-36/OV-1 caution; T-107.6 budget wrapper; A5 falsification recorded); A1's headline = parent-falsified, residual = OV-27 (inside `w0-ov35`) |
| `227_plan_gaps_adversarial.md` | OV-35…OV-43 (all resolved by 228 §3); record-steps R1–R4 (§1) — all four covered; §2 contingencies → OV-35's scope; §3 C1–C3 → OV-41/42/43 |
| `225_field_failures_forensics.md` | OV-19/20/21 (accepted-modified, Tier 2) + OV-TBD (MODIFY → research note, **not** product work); hunts 4/5 = candidate counts, no row |
| `fixes/228_ledger_and_risk_register.md` §3 | the authoritative merge: 29 candidates → 17 ACCEPT / 11 MODIFY / 1 REJECT; F5 REJECT honored (not proposed anywhere in this audit); absorbed entries listed in §2-C |
| `235_execution_readiness_audit.md` | the W0–W6 wave plan + all 17 placed rows checked against the chat list (2 unplaced-in-chat: DF-18, DF-26); its WEAK-row strengthenings carried into Tier 1's DF-18/DF-26 cells; 0 UNPLACEABLE confirmed |
| `220_overhaul_plan.md` §4.1/§4.2/§4.6/§4.7/§4.9/§4.10 | §4.6/§4.9: C-1/C-2/C-3 + OV-27's residual → resolved via 228 §3 and landings; §4.7 owner register (OV-DEC-1/2/3 = OV-11/T-107.8/D-1+D-2) → W-table; §4.10: the budget mechanism is "landed but **unwired**" → why T-107.6 is Tier 1; **note: no §4.4 heading exists in the file** (register is §4.7) |
| `229_steering_and_goal_alignment.md` §4/§5 | the parent's sequence (merge pass = chat `merge`; W14 = 48h lanes prepended by C-1/C-2); §4.4's do-not-chase note cited at T5.1; owner decisions → W-table |
| `wave_plans/W14/lanes.md` + `watchdogs.md` | the live lane scopes verbatim (lane 2 = TA-3+OV-17+OV-15+OV-12 register slot → grounds 4 covered rows; corpus FROZEN — only the parent edits at merge); no task rows of their own |
| `fixes/236_c1_wb1_deadlock_fix.md` · `fixes/237_lane1/2/3_*.md` | landing/in-flight evidence only (C-1 landed; C-2 log says LANDED; lanes 2/3 IN PROGRESS) — not task rows |
| Disk checks run today (greps, `git status`) | the 8 facts listed in the header — used to confirm which rows are still open, which are in flight, and that the merge has **not** yet folded OV-35+ into the canonical file |

### TOTALS

```
universe: 61 tasks (42 canonical + 19 accepted non-absorbed)
covered by the 17: 23 (canonical 12 + accepted-new 11)
MISSING: 25 (canonical 18 + accepted-new 7)
not-lane-work: 13 (DONE 1 · OWNER-RUN 2 · OWNER-DECISION 6 · RESEARCH-ONLY 1 · UNVERIFIABLE-NOW 3)
check: 23 + 25 + 13 = 61 ✓
```

Not counted in the 61 (documented in §2-C so nothing vanishes): 4 record-steps (covered inside OV-38/39/40), 10 absorbed/administrative/rejected candidates, the wave plan itself (adds 0 tasks, places 17), and §2's 23 do-not-rebuild capabilities.

## §6 · Recommended additions for the chat-visible list (the parent merges)

- **Add now (Tier 1 — 11 ids):** `DF-18 · DF-26` (bundle as one item, e.g. `w0-honesty K1`) · `OV-1 · T-107.6` (the two W14 lanes) · `OV-9 · OV-14 · OV-16 · OV-18 · DF-04 · TA-21 · G5` (S-sized truth rows, all keyless, all command-verified above).
- **Add when cheap (Tier 2 — 7 ids):** `F3 · OV-41 · OV-28 · OV-30 · OV-19 · OV-20 · OV-43` (accepted set; F3/OV-41 are the two the record argues for most; OV-20 needs a parent keep-or-cut call).
- **Add as backlog placeholders (Tier 3 — 7 ids):** `T4.2 · OV-7 · T-107.7 · T5.1 · T5.4 · T5.5 · T5.7` — or leave visible only as program phases (C/D/E) if the parent prefers a leaner list; nothing here is on the pre-Step-0 path.
- **Do not add (W-table):** the 13 owner/DONE/research/unverifiable rows — except **OV-8**, which the parent may want visible since it is the second keyed run + the claim-flip seat.

**Honest limits of this audit.** (a) This is a list-level diff: I did not re-execute any row's verification (no test runs were needed); row statuses are read from the cited files plus the disk greps listed in the header. (b) "Covered by" for in-flight items means *the lane's verbatim brief names the row* (`wave_plans/W14/lanes.md`), not that the work has landed — lanes 2 and 3 are IN PROGRESS today (`fixes/237_lane2/lane3`). (c) The merge pass has not yet folded the accepted set (OV-35+, F1–F4, C-1/C-2 rows) into `220_tasklist_canonical.md` — verified today (`grep -c 'OV-35\|OV-38\|OV-41'` = 0); that folding is the chat item `merge` and 235 §6 item 2 asks for it explicitly. (d) If disk disagrees with any claim here, disk wins — correct this file in the same pass.

*End of W14 completeness-auditor deliverable. Read-only inquest; this file is the only write.*
