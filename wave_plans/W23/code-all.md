# W23 · CODE-ALL WAVE — 6 code lanes + 1 recorder. RULE: CODE ONLY, NO TEST/BUILD/TYPECHECK RUNS.

**All readers share this file.** Repo: `C:\Users\mnril\Desktop\RapidTool Main` (git-bash; SPACE → ripgrep FAILS; use `grep`).

```text
OWNER INSTRUCTION THIS WAVE: "Code it all. No testing/rebuilding." — therefore:
  • WRITE the code. Do NOT run npm test / typecheck / build / lint, and do NOT run node test files.
  • You MAY read anything, grep, and use plain `node --check`-class syntax sanity ONLY if free (skip if unsure).
  • Verification happens LATER (parent boundary). Your job: complete, coherent, production-ready edits.
  • NO stubs, NO mocks, NO TODO placeholders, NO eslint-disable. Real implementations only.
  • Patch-only on existing files; keep hunks separable; note every file:line you touched in your log.
  • WRITE EARLY: landing log `fixes/262_lane<N>_<slug>.md` (what changed, where, why — by line) within ~8 calls.

KEY CONTEXT: DeepSeek balance = 0 (all keyed calls 402). Run #3 (3/9 @ 2.6s) was that, not a regression.
Emitted tree: the import crash is FIXED; the remaining tree-run layer = 28 coverage reds (B1 below).
Acceptance: files+content pass; `pass` needs mean=1 (rubric) — acceptanceFailReason landed.
```

## LANE 1 — keyed-run infrastructure: 402 as a first-class ending, funded preflight, honest results rows
**Box:** `src/lib/errors.ts`, `src/lib/llm/providers/deepseek.ts`, `scripts/run-eval.mjs`, `src/lib/headless.ts` (emit-dir/hygiene regions ONLY).
1. **Register `RT_E_LLM_NO_BALANCE`** in errors.ts (ERROR_CODE_DOC) and classify HTTP 402 / "Insufficient Balance" as it in the provider layer (follow the existing 401-refusal pattern; the A3 budget wrapper already catches — make 402 its own class, never conflated with REJECTED/budget).
2. **Funded preflight**: extend run-eval's preflight so, when `--keyed` and the key is set, it performs a **1-token fundedness probe** (cheapest call) and reports `class=no-balance` distinctly. A broke account must NOT proceed to a scored trial.
3. **Trial ending**: when synthesis fails with no-balance, end the trial with that code and a note (`capability: "cannot-run-keyed (account unfunded)"`) instead of a misleading scored `dod`.
4. **results.json rows**: record `servedModels: string[]` (every model id the trial's synthesis used) + `usage: {promptTokens, completionTokens, totalTokens}` + `estimatedCostUsd` per trial row (run-eval already has token plumbing from T-107.6 — wire what exists; if the provider doesn't surface usage to the row, add the smallest seam that carries it).
5. **Emit-dir hygiene**: run #3 hit `foreign files in emit dir: src/generated/get-property.ts` — make the keyed leg use a **per-trial clean target** (temp dir under the corpus entry's out-dir, or pre-clean with the existing `--force` semantics documented in the note). Choose the minimal, honest design; note the choice in your log.
**Done-when (no runs):** every edit in place, file:line listed, coherent with existing patterns.

## LANE 2 — the emitter side: the 28 coverage reds + emitted-README truth (OV-16)
**Box:** `src/lib/codegen.server.ts`, `src/lib/scaffold.ts` (DIRTY from prior waves — diff first, keep separable).
1. **B1 (the score-mover):** `treeRunOk` layer 2 = 28 coverage reds in the emitted app's own tests (see `fixes/255_lane1_tree_green.md` + `fixes/255_lane2_probe_truth.md` §5). Read what the emitted tests assert vs what the emitted source provides; fix the **emission** (test/spec templates + the source templates they cover) so a fresh emit's own suite is internally consistent. Real fixes to the templates — never delete/weaken the emitted tests' intent.
2. **OV-16:** the emitted README must state unmaterialised-job truth (jobs recorded but not executed) — add the labelled section to the README template (follow DF-04/TA-21's labelled-declaration idiom in engine.ts).
**Done-when:** template edits in place with the reasoning per red class (group the 28 by cause; fix by cause).

## LANE 3 — the two P6 probes: p6-brief-fit + p6-arch
**Box:** `src/lib/dod.ts`, `src/lib/gates.ts` (probe regions ONLY).
Read `fixes/255_lane2_probe_truth.md` §P1 (p6-brief-fit) + §P2 (p6-arch): each names the clause + smallest fix. Land both, following the file's existing probe idioms and coded-refusal patterns. If a fix requires a field the artifact doesn't carry yet, add the field to the emitter side via a *local* widening (do NOT touch codegen.server.ts — that is LANE 2's box; if truly blocked, document the cross-box need precisely and stop there for that clause).
**Done-when:** both clauses edited as specified; cross-box needs (if any) named exactly.

## LANE 4 — OV-1 + OV-41: provider env/doctor + spend telemetry surfaced
**Box:** `src/lib/doctor.ts`, `src/lib/llm/providers/registry.ts` (+ read-only elsewhere), `src/lib/packet.ts`.
1. **OV-1:** provider env selection surfaced in doctor: which provider/model the environment resolves to, keyed vs keyless, with the honest `cloud-by-default, keyless floor` wording — doctor reads the registry's own descriptors (no new source of truth).
2. **OV-41:** surface measured spend (tokens + `estimateCostUsd`) in the packet + doctor summaries from T-107.6's ledger (read `src/lib/token-ledger.ts`; consume, never recompute).
**Done-when:** edits in place; every number traces to the ledger's fields.

## LANE 5 — T5.3 + T5.2-A: the `eval` verb + the fixtures review surface
**Box:** `scripts/rapidtool-cli.mjs` (add the `eval` verb; DO NOT touch the lesson/summary arms), a NEW small reader module (`src/lib/scorecard.ts`) for reading `research/eval-out/results.json`+`history.json`, `src/components/console.tsx` (fixtures-review region only — additive hunks).
1. **T5.3:** `eval` verb prints the M1–M9 scorecard + history deltas as one JSON object on stdout, with the CLI's existing exit taxonomy and coded errors; no keyed calls, read-only.
2. **T5.2-A:** the fixtures review UI (the human seat): surface the corpus fixtures + their grader bars read-only in the console, with approve/reject recorded to the decision ledger — reuse the existing HITL patterns (F4's region); additive only.
**Done-when:** verb + reader + UI hunks in place; USAGE updated for the new verb (the USAGE test's count is re-derived later).

## LANE 6 — the defined checks: DF-09 + T4.3 + G4 implementations + the doctor.test red
**Box:** `src/lib/honesty-guards.test.ts`, `src/lib/engine.ts` (the `approve`/forced-override path ONLY), `src/lib/doctor.test.ts`.
Read `research/multiagent/249_define_first_specs.md` — three executable specs (DF-09 store refusal; T4.3 preservation probe; G4 scan+runner). Implement all three exactly as specified (each spec names entrypoint, fixture, observable, pass/fail). Also fix the **doctor.test.ts 19/1 red** (re-derived today): find the one failing expectation and correct the code or the expectation honestly (never weaken the test's intent).
**Done-when:** all four addressed; DF-09's check exists and is written to be RED until the store refusal lands (per spec, it pins a real gap).

---

## RETURN NOTES (parent, monitored live 15:11)
- **L5 (task-4): COMPLETED PARTIAL at 15:06:57** (537s) — **T5.3 landed and coherent; T5.2-A NOT landed**;
  its log `fixes/262_lane5_eval_ui.md` still carries `(tbd — filled at completion)` placeholders →
  needs a RECORDER/parent bottom-line fill + a **T5.2-A pickup lane next wave** (the fixtures review UI;
  box: console.tsx fixtures region + decision-ledger wiring; L5 left the MemoryEntry/OracleVerifyBlock regions
  mapped at transcript 15:06 — reuse its reconnaissance).
- Tasks 0/1/2/3/5/6 were LIVE and productive at 15:11 (logs 2–17 KB; 111 uncommitted files) — no intervention needed.
- RULE reminder for the return: this wave wrote CODE ONLY (no test/build runs) — the parent boundary must run
  typecheck + lint + the targeted suites before any commit; L1/L6 touched hot files (errors.ts, run-eval.mjs,
  engine.ts, doctor.test.ts) alongside LANE 2's templates.

## LANE 7 — RECORDER (no code): log-debt, ledger v4 close-out, the AGENTS.md proposal
**Box:** `fixes/` logs + `fixes/257` (append-only) + a NEW `research/multiagent/262_agents_md_proposal.md`.
1. **Log-debt**: fill the unfilled skeletons from the record where the author's summary exists: `fixes/258_lane1_single_chunk_esm.md` (W21-L1's numbers: RED→GREEN, 118→**119** per W22-L2's correction, probes exit 0), + any other skeletons W20/W21/W22 left (list them, fill from summaries, mark `[RECORDER-FILLED from the author's own summary; author absent]`).
2. **Ledger v4**: append-only close-out block to `fixes/257` — the run #1→#2→#3 arc (with the 402 root cause and the "3/9 is not a regression" ruling), the two count corrections, W22-L3's markers acknowledged, and the W23 wave's edits list.
3. **The AGENTS.md proposal** (a blocked lane wanted to edit it — approval correctly timed out): draft the exact doctrine additions as a PROPOSAL doc (patch text ready to apply); the parent applies it deliberately, not you.
