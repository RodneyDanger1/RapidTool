# 154 — DIRECTION (THINKER-T): the 9/9 artifact run — root causes + design decisions for fixers F1-F4 + researcher W

Status: **v1.2** (written early 2026-09-09 as fixers F1-F4 + researcher W worked; v1.1 added the
scaffold path-mismatch root cause + refined Q1; v1.2 amends D4 per F1's keyless precedent and
adds §5 verdicts on fixes/154_f3.md + fixes/154_research_web.md + F1's on-disk wiring).
Verdicts on later findings are appended to §5 as they land.
This file is the single place fixers read my evaluation. I write ONLY this file (+ verdict
lines appended to 154_findings.md when I respond to fixers' findings). I never edit src/scripts.

Scope of the crisis: `research/eval-out/results.json` (generatedAt 2026-09-09T00:59:27Z)
scores the coffeehouse2home-property-ledger keyed run **9/9 while its own notes say
`p6Refused: true`** — the 1-file floor tree masquerades as LLM software. Everything below is
anchored in code or in the run's own persisted ledger
(`research/eval-out/coffeehouse2home-property-ledger/.rapidtool/project.json`, the 9/9 run's
record — emitted 19:59:26 local = 00:59:26Z, 250ms before headless.ts was touched mid-run).

---

## 1. WHAT THE 9/9 RUN ACTUALLY DID (evidence chain, all file:line-grounded)

The run's own ledger timeline (project.json logs, ts ascending; the p6-relevant rows):

1. **Cycle 1 — LLM refused.** `p6.synthesis.refused: RT_E_LLM_REJECTED · chunk 1/2 refused ·
   DeepSeek returned no text content` → no tree → refusal folded into the next cycle's tail
   (headless.ts:1348-1359 no-tree branch).
2. **Cycle 2 — LLM refused again.** `chunk 2/3 refused · DeepSeek returned no text content`.
   The synthesis seam nevertheless returned a project **carrying a 1-file generatedTree**
   (`src/generated.ts`, 5454 bytes).
3. **That tree is the deterministic floor module.** tree-file source vs `generatedSource`
   (5511 b): similarity 0.995; scaffold comments intact (`// req-1`, `// fixes/121 mechanical
   export-injection`). Not LLM content.
4. **treeRun over the floor tree ran green** — `p6.tree.tested: … compile 12/12 file(s) · 1
   spec file(s) pass · 10 assertion(s) · entry webapp skip · fnv1a 14794815` (the floor's own
   oracle passes the floor by construction).
5. **The P6 DoD gate was recorded HONESTLY — FAIL.** `dod.reqtrace: p6-arch FAIL · tree (1
   file) · missing: track, flip, publish, sync, rent, bid`; then `gate.verdict: FAIL · 2 unmet`
   (brief-conformance + tree-architecture) on phases[6].gate.
6. **…and the journey declared CONVERGED anyway.** `p6.journey.converged: tree-run ok after
   2/3 cycle(s)` — driveP6Journey returns `outcome: "converged"` on a green treeRun and never
   lets the recorded gate verdict affect the outcome (headless.ts:1374-1397; the gate is
   recorded at :1385 but the return at :1397 is unconditional on `gate.passed`).
7. **Scorer credited all of it.** M1=1 (coverage over the floor tree), M2=1 (green treeRun,
   NO floor qualifier — the qualifier keys only on `journey.outcome === "failed"`
   maker-score.ts:324, and this outcome was "converged"), M3=1 (outcome converged,
   maker-score.ts:341-343), M4=1 (lastTest "tested" + evidenceHash 14794815, minted over the
   floor tree, maker-score.ts:366-373). M5=1 (red gates surfaced loudly — genuinely correct),
   M7=1 (M1+M2+M3 = 3 ≥ prior 1 — the prior is the 00:44Z run 40 min earlier with **zero code
   changes between the runs**), M9=1 with evidence text "refused run parked LOUDLY with code
   RT_E_LLM_REJECTED" — but the run **never parked**: it sealed complete
   (`delivery.complete: All 13 phases sealed. 2 failed gates: P6, P7`,
   `run.complete.with.failed.gates`).

**The run's own ledger disproves its scorecard.** The machine honestly recorded (a) every
synthesis call refused, (b) P6 gate FAIL with 6/7 capability stems missing, (c) the tree that
ran green was the floor — and the rubric converted that into 9/9. Timeline note: this run
executed on the PRE-20:12/20:13 code (deepseek.server.ts mtime 20:12, codegen.server.ts
20:13, maker-score.ts 20:14 — all local, after the run's 19:59 local completion; headless.ts
was edited 19:59:27.253 local while the run was still writing results 250ms later, i.e.
module-cache-isolated). So the 9/9 run used maxTokens 8192 / 60-90s timeouts and predates the
attempt journal, the empty-content diagnostics, the synthesisSucceeded field, and the P2
refusal channel.

---

## 2. ROOT CAUSES

### RC1 — Empty content: the pro-tier thinking+json envelope (deepseek.server.ts:330-338)
Every synthesis call of the run returned `RT_E_LLM_REJECTED · DeepSeek returned no text
content`. The provider call for pro (P6_SYNTH_MODEL = DEEPSEEK_MODELS.pro, codegen.server.ts:
123) sends `thinking: {type:"enabled"} + reasoning_effort:"high"` AND
`response_format:{type:"json_object"}` AND (at run time) `max_tokens: 8192`
(DEFAULT_MAX_TOKENS_PRO, deepseek.server.ts:42). A thinking model whose reasoning consumes the
output budget returns empty content (finish_reason length); a thinking model that "answers"
inside reasoning_content returns empty content too. 8k tokens is small for a prompt that asks
for a full module inside a JSON envelope (system prompt codegen.server.ts:158-168). The
post-run edits (empty-content diagnostic with reasoning_content/finish_reason notes
deepseek.server.ts:377-395; maxTokens 32000 codegen.server.ts:105; timeout 240s :114) are the
right *instrumentation and one plausible remedy*, but see D5 — this is not yet diagnosed, and
240s cannot cure a refusal that returned empty *promptly* (the run's refusals were REJECTED,
not TIMEOUT).

### RC2 — Scorer vacuity: floor-indistinguishable criteria (maker-score.ts)
- **`synthesisSucceeded` is declared and never used.** MakerScoreInput carries it with a
  docstring that says "false = EVERY synthesis call refused → … When false, M1-M4 are forced
  0" (maker-score.ts:122-131) — but `scoreMaker` (:509-523) and M1-M4 never read it, and the
  driver never passes it (run-eval.mjs:433-453 builds the input without it). Two halves of a
  fix, both missing.
- **M1 coverage is vacuous at corpus-label granularity.** `capabilityCoverage`
  (maker-score.ts:226-248) + `formsForCapability` (:174-184) hit when ANY form (full label,
  any token, any stem) of a capability appears as a sub-identifier. One generic noun shared
  across capabilities ("property", "record", "job") covers them all. Proof: the same run's M1
  claims ALL 7 caps → src/generated.ts while the machine's own p6-arch probe (`dod.reqtrace`
  log, engine.ts:1408-1460 stampP6ReqTrace) found 6 stems missing. The eval rubric is the
  permissive one; the machine gate is strict. They must not disagree.
- **M2's floor qualifier keys on the wrong signal.** maker-score.ts:324 only adds the
  "deterministic floor, not LLM code" qualifier when `journey.outcome === "failed"`. The 9/9
  refusal produced outcome "converged", so the qualifier never fired. The qualifier must key
  on the synthesis discriminator (any attempt ok?), not on the journey outcome.
- **M3 accepts a red-gate "converged".** maker-score.ts:341-343 scores 1 on
  `outcome === "converged"` alone. A run whose P6 gate record says FAIL (2 unmet) and whose
  only tree is the floor is not "iteration convergence".
- **M4 credits a mint over the floor.** lastTest "tested" + evidenceHash
  (maker-score.ts:366-373) were minted by applyTreeRunTestedMint (headless.ts:1269-1279 →
  codegen mintTreeRunTested :1629) over the floor tree's green run. The mint is honest about
  the RUN; it cannot know the tree is floor. Only the discriminator can.
- **M9's evidence text lies for refused-but-continued runs.** run-eval computes
  refusedSignal from any p6.synthesis.refused log (run-eval.mjs:420-421) and M9 prints "refused
  run parked LOUDLY with code X" (maker-score.ts:499-501) — but the 9/9 run did not park; it
  sealed complete. Parked ≠ refused-and-continued.

### RC3 — Floor-indistinguishability in the driver (headless.ts driveP6Journey)
A refused codegen attempt must NOT leave the journey a tree to converge on. In the 9/9 run
cycle 2, after a refusal the project carried the floor as `generatedTree` (1 file,
src/generated.ts) — so driveP6Journey's tree-present branch (:1347-1348) ran it, the floor
oracle passed, tested was minted (:1381), and the journey returned "converged" (:1397)
**while the honestly-recorded gate said FAIL** (:1385-1394 records; :1397 ignores). Two
independent defects: (a) something materialized the floor module as a tree on a refused
attempt (who — see Q1; the single-module success path codegen.server.ts:1325 wraps
finalModule as the 1-file tree, and partialTreeRefuse :1488-1507 keeps accepted chunks real;
the pre-20:13 codegen that actually ran is no longer on disk — fixers must hunt the current
code for the same hole); (b) the converge verdict must respect the recorded gate.

### RC4 — Dead code and unseamed seams (engine.ts)
- `upgradeP6Keyed` (engine.ts:2636-2672) — documented "shared by liveLayer AND the wild P6
  step — ONE seam" (:2620-2623) — has **zero callers** (grep: definition only). liveLayer
  (:2674) inlines a duplicate copy of the same logic (:2683-2734). The duplication is a drift
  trap; the function is a corpse.
- wildStep's execute branch runs `applyPhaseResult(running, phase)` and logs
  "P${phase} executed (deterministic floor)" (engine.ts:3634-3635) — the deterministic floor
  even when a key is configured. Wild mode can never produce keyed code (149_a5 F1,
  re-anchored).

---

## 3. DESIGN DECISIONS FOR THE FIXERS

### D1 — Wire `synthesisSucceeded` end-to-end; three states, and the driver must compute it
AGREE with the field's intent (maker-score.ts:122-131 docstring), with refinements:
1. run-eval.mjs must compute and pass it: true iff ≥1 `p6.synthesis.attempt` log with
   outcome ok exists on the final project (the field's own definition); false iff attempt
   logs exist and none ok; undefined iff no attempt logs (legacy runs — current behavior).
   Deriving it from the journal keeps maker-score pure (journal rows are already on the
   record). Note: run-eval.mjs is 17:12 and predates the journal — fixers own this wiring.
2. **false → M1=0, M3=0, M4=0** with an explicit "every synthesis call refused — the
   tree/run/mint evidence is the deterministic floor" evidence line on each (the docstring's
   "M1-M4 forced 0" is right for M1/M3/M4 — see why M2 differs below). The 9/9 run would
   then score 9/9 → 6/9 (M2/M5/M6/M7/M8/M9 minus the M9 wording fix in D8).
3. **true → current semantics, but** M1's coverage probe must be made strict (D6) so a true
   run with floor-shaped accepted chunks cannot pass on generic nouns.
4. Do NOT let "undefined" default to true. Legacy = the pre-journal behavior we already
   distrust; the safest read for a scored run whose calls all refused but which has no
   journal is to re-derive refusal from the p6.synthesis.refused rows (they exist on the 9/9
   run) — i.e. false when every synthesis attempt row is a refusal AND no attempt-ok row
   exists, even without the journal.

### D2 — A refused keyed attempt must never leave a floor tree behind (the converge trap)
Whoever materialized the floor module as generatedTree on the refused cycle-2 attempt (Q1)
opened the trap. Rule for codegen: on ANY failure path of a keyed attempt, the returned
project must be byte-identical to the floor it was given (no generatedTree row, no mint) —
the ONLY tree-carrying returns are `treeUpgraded` (all chunks accepted, codegen.server.ts:
1521) and `upgraded`+1-file-tree (single-module verified, :1319-1325), plus
`partialTreeRefuse` (:1488) which carries REAL accepted LLM chunks (fine — those are LLM
content, D1's discriminator reads them as synthesisSucceeded=true). driveP6Journey's no-tree
branch (headless.ts:1348-1359) already handles a refused attempt correctly — the fix is to
make sure refusal actually reaches it.

### D3 — Journey outcome must respect the recorded P6 gate
"Converged" currently means only "a tree ran green" (headless.ts:1374-1397). Change so the
converged return requires the synthesis discriminator AND the recorded gate not to be red:
- treeRun green + ≥1 attempt ok + gate.passed === true (or gate absent because the record
  was never completed) → `converged`.
- treeRun green but every attempt refused (floor tree) → **`failed`** (or a new
  `"floor-converged"` outcome — prefer reusing "failed" with a refusal qualifier to keep the
  M2 qualifier and M3 honest with zero new enum churn; decide with F-lane owning headless).
- treeRun green + real synthesis + gate.passed === false → this is the genuine "runs green,
  wrong semantics" class (149 P0-2/F5): NOT converged — the uncovered capability rows must
  feed the next cycle's context (ctx.coverageGap per 149 P0-2) or exhaust the budget as
  failed. The 9/9 run's own dod.reqtrace FAIL row is the machine already saying this.
- Budget exhausted → failed (unchanged, headless.ts:1403-1416).
Keep M5 semantics intact: a red gate surfaced loudly is still M5=1 — surfacing and
converging are different axes.

### D4 — The floor discriminator must gate M2 as well (amended: M2=0 on a floored run)
maker-score.ts:324 (`journey.outcome === "failed"`) misses the refused-but-"converged" case.
AMENDMENT (v1.2, after F1's wiring + keyless precedent): when synthesisSucceeded === false,
M2 is forced 0 with the shared floor qualifier — history.json shows every keyless run scores
M2=0, so a refused keyed run's identical floor-green emission must not earn the point either
(F1's card-level gate, maker-score.ts:544-550, does exactly this). The m2Runs journey-failed
qualifier (:324-330) stays for the failed-outcome-with-real-LLM-content case (synthesis
succeeded but the journey never converged): there a green treeRun is still the floor and the
evidence must say so, but the run DID produce LLM content, so M1's substance question is
separate. This answers "should a refused-but-converged run score differently?": M1/M3/M4 lose
their points (no LLM substance/iteration/verification), M2 loses its point too (floor-green is
baseline, not the run's software), while M5/M6/M8/M9 keep theirs (honesty, handover, budget,
stop discipline are genuine machine facts).

### D5 — Empty content: instrument first, and treat thinking+json as the prime suspect
The 9/9 run's refusals were REJECTED-empty-content, not TIMEOUT. The current fixes:
- 32k max_tokens (codegen.server.ts:105, was 8192 deepseek.server.ts:42) — plausibly right
  IF the empty content was finish_reason "length" (thinking starved the 8k budget). The
  diagnostic (deepseek.server.ts:377-395) now records reasoning_content length + finish_reason
  per refusal so the next run can prove it.
- 240s timeout (:114, was 60-90s) — addresses the OTHER class (class A: RT_E_LLM_TIMEOUT that
  starved the earlier keyed runs per codegen.server.ts:108-113). It cannot cure class B.
- **Disagree that these two are "the fix".** The systematic suspect is
  `thinking:{type:"enabled"} + reasoning_effort:"high"` combined with
  `response_format:{type:"json_object"}` on the pro tier (deepseek.server.ts:332-338): a
  thinking model that routes its answer into reasoning_content, or a provider that mishandles
  json_object under thinking, returns empty content on EVERY call — which is exactly the 9/9
  pattern (every call, both cycles, every chunk). Design decision: on the next keyed run read
  the attempt journal (codegen.server.ts:848-870) + refusal notes BEFORE tuning further; if
  the notes say "reasoning only (N chars…)" or refusals persist at 32k, the fix is to disable
  thinking for json envelopes on the pro tier (or drop response_format and parse the envelope
  from text — the system prompt already demands "the word json, exactly this envelope",
  codegen.server.ts:161-163) rather than to keep raising budgets. Researcher W: verify
  DeepSeek's documented json_object × thinking behavior for the v4 models.
- Empty content should also become its own bounded repair class (one re-prompt with thinking
  disabled) instead of a terminal refusal, mirroring the existing envelope/export/signature
  repair classes (codegen.server.ts:1437-1466).

### D6 — M1 coverage semantics must match the machine's own gate (or the gate must feed M1)
The 9/9 run is the falsification pair: M1=1 (all 7 caps "covered") vs the run's own
`dod.reqtrace FAIL · missing: track, flip, publish, sync, rent, bid`. Two probes, two
answers. Design: M1's tree-mode coverage should measure against the EXPANDED spec's
capability rows (the same data stampP6ReqTrace/p6-arch consumes, engine.ts:1408-1460) or at
minimum require a capability's *distinctive* stem set with the any-form OR removed — the
"covered by the word property" hole (maker-score.ts:174-184 + capabilityCoverage :226-248).
Do not widen the gate probe to the corpus labels; narrow the scorer to the machine's
semantics. Keep the exported capabilityCoverage probe for the loud report (run-eval.mjs:462)
but the M1 verdict must not be able to disagree with the machine's p6-arch row on the same
tree.

### D7 — wildStep: make upgradeP6Keyed real, then wire it (one seam, no drift)
149 P1-3's direction is right; the seam shape is wrong today: `upgradeP6Keyed`
(engine.ts:2636) is a corpse duplicating liveLayer's inline block (:2683-2734). Design:
1. Refactor liveLayer's phase-6 keyed branch to CALL upgradeP6Keyed (delete the inline
   duplicate) — the dead function becomes the shared core, drift eliminated.
2. wildStep's execute branch (:3634-3635) then calls the same seam for phase 6 when a key is
   configured (reviewer/journey parity), with the refusal→floor safety net already in
   upgradeP6Keyed (:2668-2671). Wild P6 must not log "executed (deterministic floor)" while a
   key is set unless a refusal actually stood.
3. Update the wild reviewer context per 149 P1-3 (treeRun outcome + coverage) — out of the
   codegen/headless lanes' hands; keep it queued if lane ownership doesn't fit this wave.

### D8 — M9 evidence wording + M7 prior hygiene
- M9: a refusal that the run *continued past* (logs a p6.synthesis.refused row AND reaches a
  terminal seal) is not a "refused run parked loudly". run-eval's stop evidence
  (run-eval.mjs:446-451) has the terminal state — when refusedSignal && drain terminal
  complete, the evidence must read "synthesis refusal(s) surfaced loudly (code X); run
  continued to a terminal seal" — and when the journey outcome is failed/parked, keep the
  current wording. Score mechanics can stay; the evidence must not misdescribe the stop.
- M7: the 9/9 run's M7=1 compared against the 00:44Z run with zero code changes between them
  — the "improvement" was stochastic + scorer-vacuity. Acceptable as data; the direction file
  asks that 154_findings and the landing log never cite "6/9 → 9/9" as a learning gain (it
  wasn't), and that the post-fix re-run comparison be against the 9/9 row once the scorer is
  honest.

### v1.1 addendum (same session, after deeper code reads)

**Q1 is now nearly resolved by deduction.** The cycle-2 "accepted" tree file is the floor
module body at **0.995 similarity** to `generatedSource` — the 57-char delta is exactly the
CJS wrapper `(function (module, exports) { … })` (5511 → 5454 bytes). Only a deterministic
copy can reproduce 5.4 KB at 99.5%; an LLM reproduction is impossible at that fidelity. So
the run-time codegen (pre-20:13, no longer on disk) filled a chunk/tree slot with the floor
module. Current codegen has NO such fill (the only tree writers are the single-module success
wrap codegen.server.ts:1325, partialTreeRefuse :1488-1507 keeping REAL accepted chunks, and
treeUpgraded :1521; `refuse()` :830-841 returns the project byte-unchanged). **Fixer task:
pin with a regression test that the current code cannot produce a floor-shaped tree row on a
refused attempt** (fake-complete refusing every call → driveP6Journey returns failed, no
tree, no mint, no converged log — D2's test).

**New root-cause refinement — the scored tree can never be emitted (scaffold path
mismatch), so M2 always ran over the floor embed.** The 9/9 tree row's path is
`src/generated.ts` — and scaffold's `TREE_ALLOWED_ROOTS` (scaffold.ts:178-186:
`src/api/ src/domain/ src/jobs/ src/state/ src/ui/ src/generated/ tests/`) does NOT contain
the bare file `src/generated.ts`. treePathRefusal (:217-218) refuses the row → treeAccepted
empty → `treeMode=false` (:1892) → silent fallback to the legacy single-module embed of
`generatedSource` (:26-28 docstring) → the emitted dir never contains the scored tree, and
M2's green 10/10 treeRun ran over the FLOOR embed (the scaffold's own module-truth oracle).
Two consequences for fixers:
- **D9 — align the codegen tree-writer path contract with the scaffold tree-reader.** The
  CURRENT single-module success path writes its tree row at `TREE_ENTRY_PATH =
  "src/generated.ts"` (codegen.server.ts:438 + :1325) — a path the scaffold ALWAYS refuses,
  so a verified single-module tree is silently degraded to legacy embed (content-equivalent
  for single-module only). Decide: allow the bare `src/generated.ts` row (scaffold's own
  entry-selection names it as the rolePath fallback, scaffold.ts:1899) OR write single-module
  trees under an allowed root — and add an emit test pinning that a project carrying a
  generatedTree emits those rows VERBATIM (no silent treeMode=false).
- **D10 — emit warnings must reach the driver.** scaffoldProject refuses loudly via
  result.warnings (scaffold.ts:172-173), but `emitProject` (headless.ts:1018-1039) drops
  them — its result type (headless.ts:1001-1007) has no warnings field, so run-eval's
  handover/M2 evidence never sees that the scored tree was refused at emit. Surface tree
  refusals on the emit result (M6 evidence + a loud console line), so a refused-tree emission
  can never masquerade as a tree emission.

---

## 4. OPEN QUESTIONS FOR THE FIXERS / RESEARCHER
- **Q1 (codegen lane) — refined:** see v1.1 above. Hunt the pre-20:13 floor-fill is optional
  (the file is gone); the deliverable is the regression test proving the current code cannot
  produce a floor-shaped tree on refusal, and confirming no current path fills an accepted
  chunk from `generatedSource`/buildPhase6Module.
- **Q2 (maker-score lane):** confirm M1 probe strictness change (D6) keeps maker-score.test.ts
  expectations honest; the property-ledger corpus row should pin the 9/9-shaped run at
  6/9-ish, not 9/9.
- **Q3 (researcher W):** DeepSeek v4 json_object × thinking × empty-content behavior; and the
  pro model's reasoning-content routing (does content land in reasoning_content when thinking
  is on?). Also confirm whether 32k max_tokens is honored with thinking enabled or whether the
  provider caps reasoning separately.
- **Q4:** where does run-eval learn "≥1 attempt ok"? The journal (p6.synthesis.attempt) only
  exists post-20:13 codegen; the fixer wiring D1 must handle journal-less records (derive from
  p6.synthesis.refused rows as the false signal, D1.4).

---

## 5. VERDICTS ON FINDINGS (as fixes/154_f3.md + 154_research_web.md landed; F1's code read on disk — its log not yet filed)

### On F3's log (fixes/154_f3.md) — AGREE
- **V-F3.1 — Instrument-first, no thinking-flip this wave: AGREE.** Matches D5 exactly: every observed empty-content refusal predates the 32k budget (the 9/9 run ran DEFAULT_MAX_TOKENS_PRO = 8192, deepseek.server.ts:42), so flipping thinking off now would tune on an untested-at-32k hypothesis and trade away the fixes/125 pro-reasoning contract. The pinned diagnostics (deepseek.server.ts.test.ts fake-body rows) are exactly what the next run needs to discriminate mechanism A (budget starvation: finish_reason length + big reasoning count) from B/D (JSON-mode flake / relay re-fielding: finish_reason stop + direct-call repro). Note: the 9/9 run's refusal texts carry NO notes (pre-diagnostic code), so the class is still open — the next keyed run is the measurement, as F3 says.
- **V-F3.2 — 32k/240s pinned at both call sites: AGREE.** 32k sits in the ≥25k reasoning+output headroom band (W S7); the additive `synthOpts` capture in chunkedDeps closes the test gap.
- **V-F3.3 — The empty-content repair class belongs to the codegen lane: AGREE**, and their "additive `opts.thinking` override, byte-identical default" seam (deepseek.server.ts:332-334) is the right drop-in knob for it. Endorse the follow-up ownership split.

### On W's dossier (fixes/154_research_web.md) — AGREE (high quality; two repo-cautions)
- **V-W.1 — R1 (thinking-off rung + `content || reasoning_content` salvage + direct-call repro): AGREE** as the codegen-lane follow-up; it is D5's decision tree with external grounding. Cautions: (a) reasoning_content salvage must be gated — our envelope parser (parseSynthesisEnvelope) expects the FULL JSON envelope; salvage = attempt parse, then fall through to the repair rung on failure, never silent accept; (b) the tool_calls exclusion is moot on our path (the completion body never sends `tools`), harmless to add.
- **V-W.2 — R2 (provenance-gated M1 + floor-diff): AGREE.** This is D1+D6 restated; the per-file `producer: llm|floor` map is the *stronger* (file-level) version of the run-level `synthesisSucceeded` gate F1 just landed — it closes the partial hole a run-level true leaves open (Q1's shape: floor-shaped accepted chunks under a true flag). Endorse as the next wave's M1 evolution; the run-level gate is the correct minimal honest step now.
- **V-W.3 — R3 (circuit-breaker + coded degradation): AGREE**; the repo already has the bounded ladder (synthWithBackoff + per-class repairs, codegen.server.ts:1428-1475); the missing piece is the *trip* state + a scorecard-visible degraded flag — map onto the M5/M9 semantics.
- **V-W.4 — Honest negatives properly scoped** (no DeepSeek doc for a v4 thinking×json_object conflict; shared-budget is ecosystem inference): accept; consistent with F3's instrument-first.

### On F1's in-flight wiring (disk state at 20:22-20:23; log not yet filed)
- **V-F1.1 — The card-level gate: AGREE.** M1-M4 forced 0 under one shared FLOOR_QUALIFIER_EVIDENCE with the exported m1..m4 keeping their own semantics for direct callers (maker-score.ts:530-550) is the right purity discipline; true/undefined byte-identical; the driver computes it only for keyed runs from the attempt journal (run-eval.mjs:445-448), so a journal-less keyed run (the 9/9 shape) reads false and is floored — exactly D1.4. The loudM1Zero guard (run-eval.mjs:494-498) correctly refuses to misattribute the floor zero as a divergence-1 gap.
- **V-F1.2 — M2 forced 0 (vs my D4 "keep M2 with a floor qualifier"): ACCEPT the deviation, amend D4.** F1's keyless precedent is decisive: history.json shows every keyless run scores M2=0 — a floor-green emission is not M2 material in the keyless leg, so a refused keyed run's identical floor-green must not earn the point either. D4 is amended: M2 keeps its point ONLY when synthesisSucceeded !== false; the floor qualifier (m2Runs's journey-failed evidence line, maker-score.ts:324-330) remains for the failed-outcome-with-real-content case.
- **V-F1.3 — M7's internal math is now card-inconsistent (the one real issue).** m7Learning recomputes m1+m2+m3 over the UNFORCED criteria (maker-score.ts:462), so a floored run's M7=1 evidence cites "M1+M2+M3 3 ≥ prior same-domain 1" — sums that appear nowhere on the floored card (card M1+M2+M3 = 0) and contradict its 5/9 vs the prior 6/9. The refused run's unforced M1/M3 "motion" is the same floor artifact the gate exists to kill, now laundered through M7. **Refinement (D8 amendment):** the gate must floor M7's internal reads too (scoreMaker applies the gate to the m1..m3 results BEFORE m7 consumes them), so the 9/9-shape card reads 4/9 (M5+M6+M8+M9 + M7=0: floored 0 < prior 1 — an honest "regressed from 6/9" signal). Cross-gate comparisons should also be flagged: persist the gate flag per history row (notes already carry synthesisSucceeded, run-eval.mjs:539 — ride it into the history rows) and make priorFor gate-aware (floored-to-floored, legacy-to-legacy); cross-gate prior → M7=0 with "scorer semantics changed between runs" evidence. F1's comment "a run that refused everything is not a learning regression" is wrong where the card shows 9/9→5/9: that IS a regression the card must display honestly.
- **V-F1.4 — M9 evidence wording (D8): not yet addressed on disk** — a refused-but-sealed run still prints "refused run parked LOUDLY" (maker-score.ts:499-501 + run-eval stop evidence). Still open for the owning lane.
