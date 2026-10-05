# RapidTool — FINAL Finish Wave: Six Parallel Lane Task List

**Author:** _(placeholder — owner/architect)_ · **Date:** 2026-10-05 · **Status:** Ready for spawn
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (Windows/PowerShell; quote paths) · **HEAD:** `95089de`
**Tree:** CLEAN · **Boundary gate:** GREEN — typecheck 0 · lint 0 · assertion-gaps 0 · prevention **29/29** · scripts 530/0 · lib 3767/0/2 · build 0.

---

## 1. Overview

RapidTool's **code axis is done and green**: governance/honesty, delivery truth (empty/red trees cannot be
delivered; below-floor plans refuse), a 29-guard fail-closed proof layer wired into `gate.sh`, a
cross-process campaign ledger, and the docs. The **PRODUCT axis is the remaining wall**: campaign #1
`workingApp` 0/8 → campaign #2 2/8 → the armed chunk-resample default produced 3/4 in one sample and 0/4 in
another (a third, differently-collected sample was 1/6). The honest combined rate is **~4/10**, and
**variance is the dominant factor**. The binding wall in stalled runs is the **P6 DoD gate**
(`RT_E_GATE_PENDING`: `p6-brief-fit` core-noun coverage, `p6-test`, `p6-arch`).

This wave is **six parallel lanes for ~10 minutes each**, landing small, high-value fixes, one keyed
reliability measurement pair, one full campaign, and a docs close-out. It does **not** attempt a rewrite
and does **not** lower any gate.

## 2. Verified current state (reflected, not re-derived)

- **Lane S5 died** (DeepSeek HTTP 402 after 73 min). Its PARTIAL work — the armed chunk-resample default
  2→3 — is committed in `95089de`. Its **two-sample keyed reliability measurement never completed**, and
  the **form-bindable UI decision is unlanded**.
- **G5 residual:** `testruns\bakery-florist-orders\build.json` records `p6-arch` unmet, but re-running the
  gate over the persisted best-kept tree **PASSES** it — the recorded verdict was computed over an earlier,
  smaller cycle tree (`headless.ts` `keepBestTree` grafts the best tree but keeps the last cycle's gate).
- **V5 residual:** candidate tokens may still be unreported on some paths; `acceptance.ts` reads
  `extraTokens:null` / `tokenAccounting:"not-recorded-in-journal"` because the row records candidates, not
  token usage.
- **Q5:** the `default-check` samples (sample1 **0/4**, sample2 **3/4**) are pinned (`S4-05`), so a future
  lane cannot drop the weaker sample.
- **X5:** README/AGENTS/RESUME state the combined rate and the variance.
- **Open seam:** `headless.runlockEditViolations` (`headless.ts:989`) exists but is **not wired** into the
  run path (`grep RUNLOCK src/lib/headless.ts` → only its own definition); the guard `C-11` fires standalone.
- **Registry gap:** several `RT_E_*` codes the proof layer names as `expectedCode` are **absent** from
  `errors.ts` (`RT_E_UI_UNWIRED`, `RT_E_SPEC_SKIP_VACUOUS`, `RT_E_CLAIM_UNVERIFIED`,
  `RT_E_GIT_CODE_INCONSISTENT`, `RT_E_SYNTH_DEFAULT_DISARMED`, `RT_E_JSX_IN_TS`,
  `RT_E_VERIFIED_PRODUCT_UNEVIDENCED`); only `RT_E_PLAN_UNDERPRODUCED` and `RT_E_SRC_EDITED_DURING_RUN`
  are registered.

## 3. Wave rules (apply to every lane)

1. **Time-box:** ~10 minutes of work. If not done at 10 minutes, a lane **may overrun ONLY to finish the
   single edit in progress**, then it must **land gate-clean or revert and report**. Never leave a
   half-edit uncommitted; never sit idle.
2. **Keyed-run exception:** a lane whose work is a keyed measurement (S-1, X-2) uses its 10 minutes to set
   up and dispatch; the **in-flight run may overrun to completion** (bounded by the ledger cap). After the
   box, **no second run may be started** unless the first fully finished.
3. **Stuck-prevention (all lanes):** if blocked (missing interface, ambiguous behaviour, unclear expected
   value), **stop, write the exact blocker with `file:line` + evidence, and exit cleanly**. Do not guess.
4. **No mocks, no gate weakening:** no `@ts-nocheck`/`@ts-ignore`/`skipLibCheck`, no relaxed emitted
   `tsconfig`, no skipped guard/test promoted to a pass, no lowering of `p6-brief-fit`/`p6-arch`/`p6-test`/
   `p6-verified`, no hand-editing of `emitted*/` or `build*.json`, no fabricated spend.
5. **Red-first pins:** every landed fix must carry (or update) a **keyless** test that fails before and
   passes after; the proof layer's two signals (`fixtureIntegrity` ∧ `fixPresence`) must both cover it.
6. **Cross-lane interfaces are frozen** before use: I-A (candidate-row token suffix, S→X) and I-B
   (`dod.recordGateInto` reuse, reused read-only by D).

## 4. Lanes

### Lane S — synthesis / product (S5 resurrection)
**Owned (sole writer):** `src/lib/codegen.server.ts` (+`.test.ts`), `src/lib/scaffold.ts` (+`.test.ts`),
`src/lib/synthesis-policy.ts` (+`.test.ts`).
**Fallback:** if a capture/parse of the keyed journal is ambiguous, stop and report the exact row + path.

| # | Flag | File(s) | Current → change | Acceptance |
|---|---|---|---|---|
| S-1 | `[KEYED]` | none (measurement) | S5's two-sample keyed reliability measurement **never ran**. Run the armed default (`P6_SYNTH_CANDIDATES` **unset** ⇒ `P6_SYNTH_CHUNK_RETRY_CANDIDATES=3`, `synthesis-policy.ts:54`) twice over the four `default-check` briefs (`bakery-website`, `bakery-florist-orders`, `mobile-companion`, `office-stock-tracker`), each with `--token-ledger testruns\s5-reliability\{sample1,sample2}\ledger.json` and `RAPIDTOOL_CAMPAIGN_TOKEN_CAP=3000000`. Record both samples' `workingApp` and the per-brief flips. | Two written samples, never just the better one; report both counts + the variance. Partial runs carry the coded reason. |
| S-2 | `[KEYLESS]` | `scaffold.ts:1849-1925` (+`scaffold.test.ts`) | The form-bindable preference exists (`pickFormCallable`/`formWouldWire`) but the **decision is unsigned**: make it the single deterministic path — when the tree exposes a genuinely bindable callable (≥2 real domain fields + sound args), the console **binds a form that CALLS it**, preferring it over a render shell; never fabricate a call. | `node --test scaffold.test.ts`; the emitted `src/ui/console.tsx` calls the bindable export when one exists, else the honest panel. |
| S-3 | `[KEYLESS]` | `codegen.server.ts:6037` (floor backstop) | C1-01: the floor check carries code `RT_E_VALIDATION` and sits **after** the per-chunk early-returns (`:6018/:6221/:6266/:6277`), so a below-floor partial is persisted without hitting it. Make the refusal carry **`RT_E_PLAN_UNDERPRODUCED`** and run **before** the early-returns so `accepted.length < minimumTreeFileCount` refuses, naming missing modules. | Replay `testruns\office-scheduler` persisted project; the P6 journal carries `RT_E_PLAN_UNDERPRODUCED` at the floor gate. |
| S-4 | `[KEYLESS]` | `synthesis-policy.ts:151` `candidatesLogDetail`, `codegen.server.ts:5576/:6168/:6346/:6545` | I-A producer: the `p6.synthesis.candidates` row records candidates but not tokens (→ `extraTokens:null`). Add an optional `extraTokens` arg to `candidatesLogDetail` that appends ` · tokens <int>`; the call sites pass the resample call-usage delta. Absent ⇒ byte-identical legacy row. | Unit: a resampled chunk's row carries ` · tokens N`; a row without the value is unchanged. |

### Lane D — delivery / recovery
**Owned (sole writer):** `src/lib/headless.ts` (+`.test.ts`), `src/lib/compile-check.server.ts` (+`.test.ts`),
`scripts/rapidtool-cli.mjs`, `scripts/cli-exit-taxonomy.test.mjs`, `scripts/cli-run-busy.test.mjs`.
**Fallback:** if the persisted record shape differs from the replay fixture, report the artifact path + diff.

| # | Flag | File(s) | Current → change | Acceptance |
|---|---|---|---|---|
| D-1 | `[KEYLESS]` | `headless.ts:3403-3420` `keepBestTree`, `:3637-3658` | **G5 mismatch:** `keepBestTree` grafts `best.project.generatedTree` onto the returned record but keeps the **last cycle's** phase-6 gate, so the persisted gate verdict can be computed over a different (smaller) tree than the one persisted. After grafting, **recompute the phase-6 gate over the persisted tree** via `recordGateInto(retained, 6)` and log `p6.journey.gate-recomputed`; never persist a verdict computed over another tree. | RED-first replay of `testruns\bakery-florist-orders\build.json`: persisted `phases[6].gate` equals a fresh `recordGateInto` over the persisted `generatedTree` (historically `p6-arch` unmet vs fresh pass). |
| D-2 | `[KEYLESS]` | `headless.ts` `planUnderproductionSeal`, `scripts/rapidtool-cli.mjs:2650` | R2-01: `RT_E_PLAN_UNDERPRODUCED` is journaled but the emit seal echoes `RT_E_TREE_RUN_FAILED`/`RT_E_SUBSTANCE_EMPTY`. Make the seal surface the floor code the project's own journal carries. | Keyless run over `testruns\campaign2\office-stock-tracker`: seal code = `RT_E_PLAN_UNDERPRODUCED`; guard `R2-01` stays green. |
| D-3 | `[KEYLESS]` | `headless.ts:981-1020` `runlockEditViolations`, `scripts/rapidtool-cli.mjs` | The in-run RUNLOCK guard is exported but **not wired**. Wire a preflight into the `unattended`/`tree-run` path: capture run-start mtime, scan `src/**`/`scripts/**`, and refuse with `RT_E_SRC_EDITED_DURING_RUN` naming the file when any mtime is newer. | Fixture window (BL-010 timestamps) refuses coded; a clean window passes. |

### Lane G — gates / logic / registry
**Owned (sole writer):** `src/lib/dod.ts` (+`.test.ts`), `sandbox.ts`, `engine.ts` (+`.test.ts`),
`store.ts`, `knowledge.ts`, `packet.ts`, `types.ts`, `errors.ts` (+`.test.ts`).
**Fallback:** if a code's consumer cannot be found, report the `expectedCode` string and owning guard.

| # | Flag | File(s) | Current → change | Acceptance |
|---|---|---|---|---|
| G-1 | `[KEYLESS]` | `engine.ts` `researchQueryText` | **C9 — the only unlanded C seam:** the query is still domain-nouns-first. Make it **intent-first** with ≤3 domain qualifiers + a deterministic off-intent blocklist. | `node --test engine.test.ts` query-builder unit: intent leads, ≤3 qualifiers. |
| G-2 | `[KEYLESS]` | `errors.ts` `ERROR_CODE_DOC` (+test) | Register the seven codes the proof layer names as `expectedCode` but that are absent: `RT_E_UI_UNWIRED`, `RT_E_SPEC_SKIP_VACUOUS`, `RT_E_CLAIM_UNVERIFIED`, `RT_E_GIT_CODE_INCONSISTENT`, `RT_E_SYNTH_DEFAULT_DISARMED`, `RT_E_JSX_IN_TS`, `RT_E_VERIFIED_PRODUCT_UNEVIDENCED`. | Test asserts every `guard-registry.json` `expectedCode` (where it is an `RT_E_*`) is a key in `ERROR_CODE_DOC`. |

### Lane V — verification / personas / providers
**Owned (sole writer):** `src/lib/verify.server.ts` (+`.test.ts`), `verify.ts`, `crew.server.ts` (+`.test.ts`),
`crew.ts`, `prompt-engine.ts` (+`.test.ts`), `llm/**`.
**Fallback:** if a provider response lacks usage, report the provider + response shape; never invent usage.

| # | Flag | File(s) | Current → change | Acceptance |
|---|---|---|---|---|
| V-1 | `[KEYLESS]` | `llm/providers/deepseek.ts`, `llm/**` | The last sample showed `cachedPromptTokens:0`. Ensure a byte-stable leading prompt prefix and carry `prompt_cache_hit_tokens` into `LlmResult.usage.cachedPromptTokens`. | Unit: a cache-hit response populates the field; a cache-less response reports 0. ([KEYED] confirmation deferred.) |
| V-2 | `[KEYLESS]` | `llm/**`, `verify.server.ts` | Carry served-provider provenance + a `finish_reason` taxonomy so a provider switch or a `content_filter` stop cannot masquerade as a model failure. | Unit: `finish_reason` classified; `servedProvider` present on every result. |
| V-3 | `[KEYLESS]` | `verify.server.ts` | Monotone `verifyAndFix`: accept a fix only on a **strict failing-set subset** (never a sideways/worse oracle). | Unit: a sideways fix is rejected; a strict-subset fix is accepted. |

### Lane Q — proof layer / CI
**Owned (sole writer):** `scripts/guards/**`, `scripts/prevention/**`, `scripts/gate.sh`.
**Fallback:** if a guard's fixture is missing/ambiguous, report the guard id + expected fixture path.

| # | Flag | File(s) | Current → change | Acceptance |
|---|---|---|---|---|
| Q-1 | `[KEYLESS]` | `scripts/guards/campaign-invariants.mjs:393-506` | R2-02 seam disagreement: the guard's parallel `realModuleSet` (job modules only) fires `RT_E_UI_UNWIRED` on 8/8 while the ONE product predicate (`headless.realGeneratedExportWiring`, `headless.ts:5237`) says 4/8. Make the guard **consume the canonical predicate** so it can never disagree. | Guard verdict === predicate verdict for every tree; the wired-console mutation still stays silent and the unwired case still fires. |
| Q-2 | `[KEYLESS]` | `scripts/guards/**`, `scripts/prevention/**` | Pin the new fixes: add/re-point guard entries + cassettes for **D-1** (persisted-gate recompute), **D-2** (floor code in seal), **D-3** (RUNLOCK in-run), **S-3** (floor reachability), **G-1** (intent-first query). | `node scripts/prevention/verify-prevention.mjs --all --selftest` → `missed:[] ∧ pending:[] ∧ skipped:[]`; each new guard fires on its historical/red fixture and stays silent on the control. |
| Q-3 | `[KEYLESS]` | `scripts/guards/guard-registry.json` | Bump `countFloor` to the new guard count and de-stale any entry touched by S-2 (form-bindable UI). | `count ≥ countFloor`; deleting any guard fails the harness. |

### Lane X — acceptance / observability / docs
**Owned (sole writer):** `src/lib/acceptance.ts` (+`.test.ts`), `src/lib/doctor.ts` (+`.test.ts`),
`README.md`, `AGENTS.md`, `RESUME.md`, `fixes/346_final_wave.md`; measurement artifacts under
`testruns\_report\**`.
**Fallback:** if a sample's per-brief tree is missing on disk, record it as incomplete with that reason; never infer `workingApp`.

| # | Flag | File(s) | Current → change | Acceptance |
|---|---|---|---|---|
| X-1 | `[KEYLESS]` | `acceptance.ts:319` `parseCandidateJournalRow`, `:374-427` | I-A consumer: parse the ` · tokens <int>` suffix from a `p6.synthesis.candidates` row, sum it into `extraTokens`, and set `tokenAccounting:"journal"`. Absent ⇒ keep `null` + `"not-recorded-in-journal"` (backward compatible). | `node --test acceptance.test.ts`; a row with tokens yields a non-null `extraTokens`; a legacy row stays `null`. |
| X-2 | `[KEYED]` | none (measurement) | **Campaign #3:** the eight briefs (seven originals + held-out) at the armed default (`P6_SYNTH_CANDIDATES` unset), every invocation carrying `--token-ledger testruns\campaign3\ledger.json` with `RAPIDTOOL_CAMPAIGN_TOKEN_CAP=3000000`. Score `workingApp` per brief; record delivery honesty (empty/red commits) and the coded outcome for every non-`(a)` project. | Written scorecard: per-brief rows + the honest `workingApp` count (never the best sample); every non-`(a)` outcome coded; 0 empty/red commits. |
| X-3 | `[KEYLESS]` | `README.md`, `AGENTS.md`, `RESUME.md`, `fixes/346_final_wave.md` | Docs/decision close-out: declare — the **form-bindable UI decision** (S-2), the **S5 two-sample result** (S-1), the **persisted-gate recompute** (D-1), the **candidate-token accounting** (S-4/X-1), and the **campaign #3 verdict** (X-2) — every number with its source file/command, plus the variance. | A dated corrections block; no claim without a source; strike any superseded number. |
| X-4 | `[KEYLESS]` | `doctor.ts` `fleetTelemetryFromProject` (+`doctor.test.ts`) | Surface the now-populated `fleetMetrics.resample.extraTokens` from a record's own journal; keep `estimatedCostUsd` `null` (never fabricate spend). | `node --test doctor.test.ts`; the doctor reports the token total when the row carries it, `null` otherwise. |

## 5. Coverage map (item → lane)

| Required item | Lane · task |
|---|---|
| S5 resurrection — two-sample keyed reliability at armed default 3 | **S-1** `[KEYED]` |
| S5 resurrection — form-bindable UI decision | **S-2** |
| Persisted-gate / best-tree recording mismatch (G5) | **D-1** |
| Candidate-token accounting in telemetry | **S-4** (producer) + **X-1** (consumer) + **X-4** |
| Final full campaign #3 (8 briefs, default, ledger-capped) | **X-2** `[KEYED]` |
| Docs / decision close-out | **X-3** |
| Small pipeline fixes | S-3, D-2, D-3, G-1, G-2, V-1, V-2, V-3, Q-1, Q-2, Q-3 |

## 6. Owned-file union (complete; no overlaps)

- **S:** `codegen.server.ts`(+test) · `scaffold.ts`(+test) · `synthesis-policy.ts`(+test)
- **D:** `headless.ts`(+test) · `compile-check.server.ts`(+test) · `rapidtool-cli.mjs` · `cli-exit-taxonomy.test.mjs` · `cli-run-busy.test.mjs`
- **G:** `dod.ts`(+test) · `sandbox.ts` · `engine.ts`(+test) · `store.ts` · `knowledge.ts` · `packet.ts` · `types.ts` · `errors.ts`(+test)
- **V:** `verify.server.ts`(+test) · `verify.ts` · `crew.server.ts`(+test) · `crew.ts` · `prompt-engine.ts`(+test) · `llm/**`
- **Q:** `scripts/guards/**` · `scripts/prevention/**` · `scripts/gate.sh`
- **X:** `acceptance.ts`(+test) · `doctor.ts`(+test) · `README.md` · `AGENTS.md` · `RESUME.md` · `fixes/346_final_wave.md` · `testruns\_report/**`

**Overlap check:** S∩D=S∩G=S∩V=S∩Q=S∩X=∅; D∩G=D∩V=D∩Q=D∩X=∅; G∩V=G∩Q=G∩X=∅; V∩Q=V∩X=∅; Q∩X=∅.
Cross-lane needs are **producer→consumer interfaces only**: I-A (S→X, candidate-row token suffix) and I-B
(G's `recordGateInto`, reused read-only by D). New `RT_E_*` codes are added by **G only**; consumers
reference the string.

## 7. Landing rules

- **Gate:** after all six lanes stop, the orchestrator runs `& 'C:\Program Files\Git\bin\bash.exe'
  scripts\gate.sh` **once on the frozen tree**. Green requires: `typecheck exit 0` · `lint exit 0` ·
  `assertionGaps exit 0` · `prevention {missed:[], pending:[], skipped:[], count ≥ countFloor}` ·
  `testsScripts {fail:0}` · `testsLib {fail:0}` · `build exit 0`. The JSON verdict is authoritative (a
  PowerShell wrapper's exit 1 from stderr is an artifact).
- **No mocks / no gate weakening:** no mocking the object under test; a skip is never a pass; a
  `status:"pending"` guard fails; a deleted guard fails (count floor). No lowering of any DoD bar.
- **Landing:** each lane commits its own disjoint files (or reverts and reports). A lane never touches
  another lane's files; a needed interface change is reported to the owner lane, not edited cross-lane.
- **Measurement honesty:** a keyed sample is reported whether or not it is flattering; a partial run is
  recorded with its coded reason; a single lucky sample is never a product claim.
- **Single definition of done for the wave:** `gate.sh` GREEN on the frozen tree **AND** every lane landed
  or reverted-and-reported **AND** every new fix carries a red-first keyless pin **AND** the S5 two-sample
  and campaign #3 are scored honestly with variance **AND** the persisted-gate mismatch and candidate-token
  accounting are closed with tests **AND** the docs declare the numbers with their sources.

---

## Task Links

**Lane S — synthesis (S5 resurrection)** · owns `codegen.server.ts`(+test) · `scaffold.ts`(+test) · `synthesis-policy.ts`(+test)
- `S-1 [KEYED]` Two-sample keyed reliability measurement at the armed default 3 (`P6_SYNTH_CANDIDATES` unset) over the 4 default-check briefs; ledger `testruns\s5-reliability\{sample1,sample2}\ledger.json`, cap 3,000,000. Record both samples + variance.
- `S-2 [KEYLESS]` Land the form-bindable UI decision in `scaffold.ts:1849-1925`: prefer a genuinely bindable callable form that CALLS it; pin with `scaffold.test.ts`.
- `S-3 [KEYLESS]` `codegen.server.ts:6037`: make the floor refusal carry `RT_E_PLAN_UNDERPRODUCED` and run before `:6018/:6221/:6266/:6277`; replay office-scheduler.
- `S-4 [KEYLESS]` `synthesis-policy.ts:151`+`codegen:5576/6168/6346/6545`: append ` · tokens <int>` to the candidate row; unit test.
- Fallback: stop and report the exact row/path if journal capture is ambiguous.

**Lane D — delivery / recovery** · owns `headless.ts`(+test) · `compile-check.server.ts`(+test) · `rapidtool-cli.mjs` · `cli-*.test.mjs`
- `D-1 [KEYLESS]` Recompute the phase-6 gate over the persisted best tree after `keepBestTree` (`headless.ts:3403-3420/:3637-3658`); RED-first replay of `testruns\bakery-florist-orders\build.json`.
- `D-2 [KEYLESS]` Surface `RT_E_PLAN_UNDERPRODUCED` in the emit seal (`headless.planUnderproductionSeal` → `rapidtool-cli.mjs:2650`); replay campaign2 office-stock-tracker.
- `D-3 [KEYLESS]` Wire `runlockEditViolations` (`headless.ts:989`) into the run path; refuse `RT_E_SRC_EDITED_DURING_RUN` on a src mtime > run start.
- Fallback: report the artifact path + diff if the persisted shape differs from the fixture.

**Lane G — gates / logic / registry** · owns `dod.ts`(+test) · `sandbox.ts` · `engine.ts`(+test) · `store.ts` · `knowledge.ts` · `packet.ts` · `types.ts` · `errors.ts`(+test)
- `G-1 [KEYLESS]` C9 intent-first `engine.ts researchQueryText` (≤3 qualifiers + off-intent blocklist); unit test.
- `G-2 [KEYLESS]` Register the seven missing `expectedCode` codes in `errors.ts  ERROR_CODE_DOC`; test that every guard `expectedCode` is registered.
- Fallback: report the `expectedCode` string + owning guard if a consumer is unfindable.

**Lane V — verification / personas / providers** · owns `verify.server.ts`(+test) · `verify.ts` · `crew.server.ts`(+test) · `crew.ts` · `prompt-engine.ts`(+test) · `llm/**`
- `V-1 [KEYLESS]` Byte-stable cache prefix + carry `prompt_cache_hit_tokens` into `cachedPromptTokens`; unit test.
- `V-2 [KEYLESS]` Served-provider provenance + `finish_reason` taxonomy; unit test.
- `V-3 [KEYLESS]` Monotone `verifyAndFix` (strict failing-set subset only); unit test.
- Fallback: report provider + response shape if usage is missing; never invent usage.

**Lane Q — proof layer / CI** · owns `scripts/guards/**` · `scripts/prevention/**` · `scripts/gate.sh`
- `Q-1 [KEYLESS]` Make `campaign-invariants.mjs:393-506` consume `headless.realGeneratedExportWiring` (R2-02); guard verdict === predicate verdict.
- `Q-2 [KEYLESS]` Add/re-point guards + cassettes for D-1, D-2, D-3, S-3, G-1; harness `missed:[] ∧ pending:[] ∧ skipped:[]`.
- `Q-3 [KEYLESS]` Bump `guard-registry.json countFloor` to the new count; de-stale the S-2 entry.
- Fallback: report the guard id + expected fixture path if a fixture is missing.

**Lane X — acceptance / observability / docs** · owns `acceptance.ts`(+test) · `doctor.ts`(+test) · `README.md` · `AGENTS.md` · `RESUME.md` · `fixes/346_final_wave.md` · `testruns\_report/**`
- `X-1 [KEYLESS]` Parse the ` · tokens <int>` suffix into `extraTokens` (`tokenAccounting:"journal"`); legacy rows stay `null`.
- `X-2 [KEYED]` Campaign #3: 8 briefs at the armed default, ledger `testruns\campaign3\ledger.json`, cap 3,000,000; score `workingApp` + delivery honesty + coded non-`(a)` outcomes.
- `X-3 [KEYLESS]` Docs close-out of S-1, S-2, D-1, S-4/X-1, X-2 with sources and variance.
- `X-4 [KEYLESS]` Surface `fleetMetrics.resample.extraTokens` in `doctor.ts`; keep `estimatedCostUsd:null`.
- Fallback: record an incomplete sample with its reason; never infer `workingApp`.
