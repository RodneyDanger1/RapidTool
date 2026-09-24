# 220 · RapidTool overhaul plan (spine) — reasoning, live research, and the task-list frame

**Status: DRAFT SPINE — the canonical task list (§4) is being produced in parallel by WATCHDOG D
(`220_tasklist_canonical.md`) and externally verified by WATCHDOG E (`220_external_verification.md`).
This spine owns the reasoning chain and the live-research record; §4 is merged when they land.**

Owner's ask (verbatim): *"formulate a fullproof overhaul plan and think extensively with sequential
thinking and reasoning as well as 100% factual web research/codebase analysis … wrap it all into a
REAL TASK LIST."*

Evidence base: `219a`–`219f` (six dossiers) + `219_wdA/B/C` (the three audits) + `218` §3/§5 +
`216z` + `217b` + `217c` §3 + `taskuniverselog.md` + `remainingwaves.md` + `RESUME.md` §4/§6.1.
Nothing in this plan is asserted without one of those, or without a live page read on 2026-09-24.

---

## §0 · Live research (2026-09-24) — what the world says that the dossiers could not

`web_search`/`web_extract` are unconfigured on this host (**verified**: "Web tools are not configured.
Set FIRECRAWL_API_KEY…"). **The browser works** (local Chromium), so these are live page reads.

### 0.1 The provider's live model list — Step 0's readiness, confirmed
Read: `https://api-docs.deepseek.com/quick_start/pricing/` (Models & Pricing, DeepSeek API Docs,
2026-09-24). The page lists **exactly two models**:

| id | version | context | max output | tool calls | notes |
|---|---|---|---|---|---|
| `deepseek-flash` | DeepSeek-V4.1-Flash | **1M** | **384K** | ✓ | thinking **default**, non-thinking supported; Json Output ✓; Responses API ✓; Anthropic API ✓; Vision ✓ |
| `deepseek-v4-pro` | DeepSeek-V4-Pro-0813 | 1M | 384K | ✓ | Vision ✗ |

Quoted from the page: the model column reads `deepseek-flash` / `deepseek-v4-pro`; `MODEL VERSION`
`DeepSeek-V4.1-Flash` / `DeepSeek-V4-Pro-0813`; `CONTEXT LENGTH` `1M`; `MAX OUTPUT` `MAXIMUM: 384K`;
`THINKING MODE` "Supports both non-thinking and thinking (default) modes".

**Three consequences for the plan, all checkable in code today:**
1. **Step 0 has no wrong-model-id landmine.** RapidTool's registry already names exactly these two ids
   and says so in its own header — `src/lib/llm/providers/deepseek.ts:19-24` ("live 2026-09-16 the
   vendor returns exactly `deepseek-flash` + `deepseek-v4-pro`") and `registry.ts:25`. Live docs agree.
2. **The context assumption is stale in the conservative direction.** The live window is **1M tokens**
   (the pre-2026 assumption in most tooling was 128K). `compaction.ts` takes `contextWindowTokens` as a
   **parameter** (`compaction.ts:159-166`) — so this is a *constant to update*, not a refactor. Every
   compaction trigger today fires far too early, spending quality on a limit that no longer exists.
3. **Tool Calls, Responses API and Anthropic-format endpoints are all documented** for this model — so
   the future MCP/tool-loop work is provider-capable today, and the "1 vendor" limitation is about
   *breadth*, not capability.
   *(Pricing, for the record: flash $0.15/M input cache-miss off-peak, $0.003/M cache-hit, $0.60/M
   output off-peak; peak doubles. Concurrency limit 2500. A keyed maker run is cents, not dollars.)*

**Live cross-check (WATCHDOG E, same day, browser + quotes):** the model-id question is **PASS with one
nuance.** The live docs list exactly `deepseek-flash` + `deepseek-v4-pro` and state verbatim that the
legacy `deepseek-v4-flash` "is still accepted" — and `deepseek-v4-flash` is precisely the wire id
RapidTool currently sends (`deepseek.ts:39-42`, default `:323`). So **Step 0 has no landmine**; the only
follow-up is an optional one-line default change to the docs' preferred id (`registry.ts:96-99`
documents the current alias choice as intentional). WD-E separately re-confirmed the MCP gaps live
(OpenHands ships an `openhands mcp` CLI with HTTP/SSE+stdio; Cline ships `cline mcp` over STDIO +
Streamable HTTP) — the "no MCP runtime client" disadvantage is **reinforced, not contradicted**.

### 0.2 Open items handed to WATCHDOG E (external verification, in flight)
MCP client support in OpenHands/Cline (live pages) · OpenHands' sandbox runtime ·
the MCP spec's current version + what a compliant client must implement · a field refresh for anything
newer than the 2026-09-16 clones · and a command-realism audit over every plan row.

### 0.3 One local inconsistency to verify, found while pairing 0.1 with the code
`registry.test.ts:270-281` asserts an error message naming `deepseek-v4-flash, deepseek-v4-pro`
(hyphenated prefix), while `deepseek.ts:41` maps the pro id as `deepseek-v4-pro` and the flash id as
`deepseek-flash` (`:19-24`). **Either the message or the test is the odd one out** — this is
*exactly* the drift class `219a`/`219b` found elsewhere (doc/doc-test vs code). It is an OV row:
read the message, make both name the same live ids, and re-run
`node --experimental-strip-types --test --test-concurrency=2 src/lib/llm/providers/registry.test.ts`.

> [X-3 · 2026-09-24] CORRECTED: "Either the message or the test is the odd one out" / "It is an OV row" → the message, the test and the request map all name the same ids — the request-path set `deepseek-v4-flash` + `deepseek-v4-pro`: the refusal message is built from `KNOWN_MODEL_IDS` (registry.ts:346-353), `KNOWN_MODEL_IDS = [...DEEPSEEK_REQUEST_MODEL_IDS]` (registry.ts:359-361; the array at :101-104), the request map is `DEEPSEEK_MODELS` (deepseek.ts:39-42), and the alias-vs-served naming is documented as deliberate (registry.ts:96-100; deepseek.ts:17-27) — so there is no message-vs-test drift, no OV row for it was carried in the canonical 42, and the §3 Phase-B "registry-id drift" entry is moot. — evidence: reads above + `node --experimental-strip-types --test --test-concurrency=2 src/lib/llm/providers/registry.test.ts` → 21/21 pass. (by X-3)

---

## §1 · Sequential reasoning — why the overhaul is shaped this way

**R1. What is actually being asked for.** "Finished" is not "more features". The repo defines its own
bar (`remainingwaves.md:25`, milestone M-A; `RESUME.md` §1.0): a friend-usable real-estate app
(Coffeehouse2Home / Property Ledger) with `stubs:0, reexports:0, real ≥ 3`, its job modules passing
their own oracle rows, produced by a keyed end-to-end run. Everything in this plan serves that bar or
is excluded by §2.

**R2. The inquest's central finding, restated as a dependency.** The last keyed maker run scored
**4/9 and predates every fix from W5 to W12** (`219e`). Therefore *the quality number the project is
judged by is not merely stale — it is measuring a different program*. Every quality argument made
before a fresh keyed run is unfalsifiable. **So Step 0 (the owner's keyed run) precedes all quality
work, and any lane that cannot proceed without it must degrade to a diagnosis memo rather than patch
blind** (this is `219e`'s own rule, kept).

**R3. What is genuinely blocking, ranked by dependency rather than by effort.**
1. **The key** — lifts P6 off a placeholder that *fails brief-fit by construction*, and is the switch
   that lets Wild Mode cross the stock gates (`219c` §3/§6). Zero engineering. Owner-gated.
2. **The latch has no producer** — `humanFixtures` and `productComplete` cannot be set by any product
   path (`doctor.ts:166-167`; `doctor.test.ts:81-92` is the only setter). Until a producer exists, the
   autonomy claim is structurally unreachable — independent of the key.
3. **The learning loop's key teacher is muted** — a red seal mints no lesson and its log is not
   lesson-tagged, so `selectLessons` cannot see it (`219d`, T-11). The cheapest real change to
   "self-improving" — **but T-11 was a deliberate owner-signed decision**, so it is an
   OWNER-DECISION row, not a lane.
4. **Nobody has looked at the UI** — and the reason was a *broken tool*, not neglect
   (`browser-guard.mjs` compares a resolved `C:\…` against the literal `/workspace\`, and
   `browser-smoke.mjs` rejects the flags the plan told lanes to use; both reproduced by WD-C).
5. **Docs that mislead** (35 vs 34 verbs; broken README quickstart; P7 prose claiming MCP/A2A with no
   MCP module; a decision register still reading UNKNOWN about a settled probe). Cheap to fix, and
   each one is a lie the repo's own contract forbids.

**R4. What is NOT a blocker, and must not be worked on.** The adversarial read of the dossiers is that
this project's biggest risk is *burning waves re-building things it already has*. `219e` §5 item 8
lists ten capabilities confirmed landed and re-verified on disk today (patch primitive + `edit` verb,
policy seam, run-side graders + trials + leak scan, compaction constants, verify-kind install leg,
emitted `.gitignore`, the 48 000-char runner clamp…). The plan therefore carries an explicit
**DO-NOT-REBUILD list** (§4.3) as a first-class artifact, not a footnote.

**R5. Why "the best agentic harness" is not a feature race.** `219f` (17 clones, revisions pinned,
nothing executed, 30 rows re-verified by WD-C) found RapidTool **genuinely ahead** on exactly three
mechanisms — verification depth (`treeRun` runs the emitted tree's own typecheck/test/build,
fail-closed), hard budget enforcement (throwing `SessionBudgetExceeded`), and honesty as a runtime
mechanism (`sandbox:false` stamped; declarations a machine path cannot mint) — and **behind** on
provider breadth (1 vendor vs 12–22+), MCP runtime client (**7** clones ship one — parent-verified at the third audit; see §4.8), and codebase-scale index
(lexical by design). The field's own code supplies the cautionary tale: **Devika's
`src/sandbox/{code_runner,firejail}.py` are 0-byte files** — a claimed sandbox with no bytes. The
winnable war is *evidence-grade production*, not feature parity (`90` §7 via `219e` §5 item 6).

**R6. Therefore the overhaul is five phases, ordered by what unlocks what:**
- **Phase A — Prove or falsify (owner's key).** Step 0 + publish the honest score.
- **Phase B — Truth sweep (no key needed).** Docs, codes, silent failures, the dead citation, the
  register's stale UNKNOWN, the browser guard, the registry-id drift.
- **Phase C — The zeros (key-logged, or diagnosis memos if Step 0 has not run).** M2/M3/M4/M9.
- **Phase D — Close the loops.** The learning loop's muted teacher (owner decision), the latch's
  missing producers, checkpoint/resume, patch preservation.
- **Phase E — The maker test.** Emit Coffeehouse2Home, census it, hand it over, flip claims last.

**R7. The one-sentence thesis.** RapidTool does not need more mechanisms; it needs **one honest,
end-to-end, keyed proof on the current tree, and the removal of every claim it cannot back** — in that
order, because the proof decides which claims survive.

---

## §2 · Exclusions (what the overhaul deliberately does NOT do)

Inherited from `219e` §5 (ten items, each with its reason) — kept verbatim in force. Headlines:
no sandbox/isolation claim (no isolator on this host — re-probed twice); no E2E claim for a running
emitted app; no multi-language (D-1) or multi-tenant (D-2) work — both are **owner decisions**
(`fixes/217c` §3); no widening the agent surface (Crew is advisory by design); no second budget
system; no chasing structural losses (visual polish, frontier IQ, cloud fleets); no "soften the
criterion into a nicer sentence" — strike with the falsification recorded.

---

## §3 · The phases at a glance (detail lives in §4's rows)

| Phase | Objective | Entries | Exit criterion (observable) |
|---|---|---|---|
| **A** | The honest number exists | Step 0 (owner keyed run) | a keyed run log + `results.json` on the current tree, published as-is |
| **B** | No claim the code cannot back | doc sweep + DF-09/26/18 + G4/G5 + browser-guard fix + registry-id drift | every count re-derived by a command in the same commit; the browser smoke command runs to `ok` |
| **C** | The scorecard's four zeros | M2, M3, M4, M9 (from Phase A's log, not guesswork) | the four criteria report green **with evidence hashes**, or an honest memo says why not |
| **D** | The loops close | red-seal teacher (owner), latch producers, checkpoint/resume, patch preservation | a red seal on run A is visible to run B's lesson selection; `doctor --tree` can reach a state no unit test can fake |
| **E** | The maker test | emit → census → tree-run → hand over → flip claims | `stubs:0 reexports:0 real≥3` on the artifact + ≥3 job modules passing their own oracle rows |

---

## §4 · THE REAL TASK LIST

### 4.1 The rows
> **THE AUTHORITATIVE LIST IS `220_tasklist_canonical.md`** (WATCHDOG D, 2026-09-24, 299 lines) —
> **42 rows**: 24 carrying existing stable ids (TASK-01, T-107.6/.7/.8, T4.2, T4.3+TA-18, TA-3, TA-21,
> T0.10, T3.6, T5.1–T5.7, DF-09/18/26/04, G4/G5, D-1/D-2) + 18 new `OV-1…OV-18`. Its status ledger:
> **TODO ×27 · BLOCKED-KEY ×3 · OWNER-RUN ×2 · OWNER-DECISION ×6 · UNVERIFIABLE-NOW ×3 · RESEARCH-ONLY ×1.**
> Fields per row: `id | title | why (evidence) | files | done-when | verification command | size | deps |
> owner | status`. It also carries: §2 the **do-not-rebuild list (23 DONE-VERIFIED capabilities with
> proofs)**, §3 the sequencing graph (spine `T0.10 → {OV-3/4/5} → OV-8`; **no cycles** — the near-miss
> `T5.7⇄T5.4` was checked one-way), §4 a **20-row reconciliation table** (every WD-A/B/C correction wins;
> plus **two new drifts found by WD-D itself**: `217c`'s phantom `chat.server.test.ts`, and RESUME's stale
> `216b` housekeeping note — the file exists), §5 the first-48-hours list, §6 the coverage proof for all
> 18 inputs + the deliberate cuts (16 open DFs deferred to post-maker-test triage, old-board residuals,
> T0.4, T3.1/2, the 216b/217h/217i doc-debt folds, and 219f's B3/B4 which are product-decision-shaped).
> **AUDITOR 2 is auditing this file in parallel** (spot-checking `DONE-VERIFIED` rows against `218`/`219b`
> and validating every command against real entrypoints); its attributable corrections land in the file
> itself, and I fold them in at the merge.

### 4.2 The first 48 hours (WD-D §5, ordered by leverage; key-free, decision-free, one lane each)
1. **TASK-01** `nextAction` wire contract (M) — carried twice; the last named piece of the machine-side contract.
2. **T5.3** `eval` verb (S) — the corpus is the maker-test fixture family; cheapest step that puts M1–M9 in a driving agent's hands.
3. **OV-2** first browser pass, **guard fix first** (M) — retires "nobody has looked at these pixels".
4. **TA-3 + OV-17** README/doc truth (S+S) — 35 verbs, `diagnose` in USAGE, AGENTS counts, the broken Quickstart.
5. **DF-18 + DF-26** console honesty bundle (S+S) — two loud mislabels, same file.
6. **T5.2 half A** fixtures review UI (M) — reuses the landed `approveFixtureCases`; the human seat is what makes a "functional" claim honest.
7. **OV-13** silent-degrade rows (M) — a keyed model failure currently reads byte-identical to a deliberate keyless run (the class the owner treats as worst).
8. **OV-12 + OV-15** quick truth fixes (S+S) — the register's stale UNKNOWN slot; the unreachable `redTree:"banner"` advice.
> **Deliberately excluded from the 48h:** anything needing the key, anything needing an owner decision,
> and **DF-09** — real and loud, but its verification does not exist anywhere in the record and must be
> defined before it can be dispatched (WD-D's judgement, kept).

> [IMPROVER · 2026-09-24] TRAP for item 3 (OV-2): the guard fix ripples into the scripts leg — `scripts/browser-smoke-verdict.test.mjs:375-383` source-pins the four `["/workspace"]` literals in `browser-smoke.mjs` (callers `:30,:32,:33,:41`); the lane must either fix inside `checkedOutputPath` (literals unchanged — pins stay green) or update those pins in the same commit. — evidence: `sed -n '368,392p' scripts/browser-smoke-verdict.test.mjs` (read today). (by PLAN-IMPROVER)

### 4.3 DO-NOT-REBUILD list
> **`220_tasklist_canonical.md` §2 — 23 capabilities, each with the verification that closed it.**
> Headline set: the patch primitive + `edit` verb · the `policy.ts` seam · run-side graders + trials +
> leak scan · `compaction.ts` constants · the verify-kind install leg · the emitted `.gitignore` · the
> 48 000-char runner clamp · T-11's both halves (green-seal gate + `probe:<id>` tags wired at
> `knowledge.ts:952`) · the fixed G1–G3/G6/G7 families · TA-15's census. A future wave that re-implements
> any of these burns budget and risks the tree.

### 4.6 KEYED-PATH PRE-MORTEM (AUDITOR 1) — the finding that re-orders Phase A/C

**`223_critical_path_premortem.md` predicts Step 0 at 5/9 (range 3–6), `status:"dod"` — no crash, no lost
number — and the reason is a verified circular deadlock, not model quality.**

**WB-1 (VERIFIED BY THE PARENT, link by link — the highest-value defect found in this inquest):**
`p6-verified` requires `lastTest.label === "tested"` + a non-empty evidenceHash (`dod.ts:500-517`) · the
chunked synthesis sets `lastTest: null` and says its only re-mint is `mintTreeRunTested()` after a genuinely
green tree-run (`codegen.server.ts:3142`) · but the P6 gate is recorded **before** the mint is applied
(`headless.ts:1917` then `:1958`), and a red gate returns `failed` (`:1968-1984`) — so the mint is gated on
the very thing it is needed to satisfy. **For every chunked keyed synthesis (every webapp/tool/game run,
incl. coffeehouse2home), M3 + M4 are unsatisfiable by construction**, and the 2026-09-10 keyed ledger on
disk shows exactly this shape (P6 complete, no green gate, 50+ `dod.blocked`, `currentStage:6`). The
ordering was deliberate (T0.6 "mint-after-gate", `headless.ts:1908-1912`); the fix must preserve its intent
(*never mint on unsure evidence*) while treating a **genuine green tree-run verdict** — which the journey
already holds — as the evidence it is. Both seams need it: the journey and `repairTreeDir` (`:2493-2515`).

**Sequencing consequence (the plan changes here):** Phase A's "measure first, then fix" logic was sound —
but WB-1 is not a guess. It is code-verified *and* corroborated by the surviving 09-10 ledger, so
**fixing WB-1 before Step 0 is what makes Step 0 informative**; running it as-is measures a deadlocked
program and can score *below* the keyless 6/9 floor (a demoralising, misleading number). Recommended:
**C-1 (break the deadlock) + C-2 (make a hard-DoD stop a coded terminal stop → M9) land before Step 0**;
C-3 (make the emitted keyed tree pass its own tests → M2) remains post-Step-0 work driven by the log.
This is a change to the plan's order of operations and is flagged to the owner as such.

**Falsification of my own hypothesis (declare-or-strike):** I told the owner the budget seams were
"the most plausible silent 4/9 cause". **WB-8 disproves that**: `RAPIDTOOL_TOKEN_CAP` is unset, so
`p6TokenCapFromEnv()` returns undefined, `accountSynthUsage` never throws, and `assertBudgetHeadroom` /
`recordBudgetSpend` have **zero non-test callers** — the `SessionBudgetExceeded` class is landed but
unwired on the default path (which is exactly what W14-L2 exists to fix). The claim is struck.

**Also from AUD-1, worth keeping:** there is **no crash-and-no-number point** in the driver (every per-entry
throw becomes a 0/9 `status:"error"` row, exit 0) — the real no-new-number risk is **WB-6: if the process is
killed mid-run (8 GB host), the stale 2026-09-17 keyless `results.json` (6/9) remains in place and can be
misread as the keyed result** — the driver never marks a run in-progress. Cheap fix: a run-start marker.

> [IMPROVER · 2026-09-24] WB-6 ADDENDUM (read today): both artifacts are written by ONE `persist()` call (`run-eval.mjs:1162-1207`) — `results.json` first (`:1177`), `history.json` second (`:1206`) — so a kill inside `persist` leaves a fresh results.json beside a history without its row (M7's priors read history, `priorFor` `:371`). The run-start-marker fix should also name this pair. — evidence: `sed -n '1160,1215p' scripts/run-eval.mjs`. (by PLAN-IMPROVER)

### 4.7 Owner-decision register (no lane may proceed past these)

| id | decision | why it is the owner's | default if undecided |
|---|---|---|---|
| OV-DEC-1 | **Red seal teaches** (mint a lesson on the red-seal branch, ~6 lines, `engine.ts:1464-1495`) | T-11 was a deliberate, owner-signed decision to keep the loop quiet there | stale: loop stays muted, "self-improving" stays partial |
| OV-DEC-2 | Isolation bar (Docker/WSL2/VM vs plain-stated un-isolated run) | product decision; changes what may be claimed | no sandbox claim; ceiling stays "builds and tests" |
| OV-DEC-3 | D-1 language registry / D-2 multi-tenant (`fixes/217c` §3) | owner-gated per the register; D-1 costs L and multiplies the isolation surface | deferred; TS-only stays |

### 4.5 The design + map artifacts (make the rows executable)

| artifact | author | what it adds to this list |
|---|---|---|
| `221_feature_designs.md` (503 lines) | PERSONA 1 | **5 lane-ready feature specs** (F1 MCP client discovery-first — new `src/lib/mcp.client.server.ts`, JSON-RPC over stdio, reusing `runNodeBounded`'s scrub/redact/clamp/kill helpers and proving `stdio:["ignore","pipe","pipe"]` (`node-runner.server.ts:310`) cannot host a session · **F2 provider breadth step 2 — chosen as the single highest-leverage feature**, sequenced after W14-L3 in the same file, with a hard rule to never hardcode an unprobed vendor's model ids · F3 cross-run learning measurement (S; uses the already-recorded `reproducedCount` nothing reads today; T-11 mute untouched) · F4 per-action allow-lists · F5 + the "if only ONE ships" verdict). Each spec carries seams, reuse, honesty constraints, minimal first step, tests + verify command, risks, gated-by. |
| `222_codebase_integration_map.md` (~45 KB) | PERSONA 2 | **137/137 `src/lib` files in 15 role groups** (validated programmatically) · **the 32-row seam table** (every W14–16 row + owner decisions + Phase-B items + F1–F5 + Step 0, each with its seam `file:line` read today, helpers to reuse, tests to extend, governing invariant; 3 `NO-SEAM-FOUND` rows are by-design memos) · **16 invariants with sources** · **the HOT/COLD touch map** (68 files changed since `aa12c6c` → the one-lane-per-HOT-file rule that keeps future waves disjoint) · **the landmine register, 7/7 addressed** (6 exact, 1 detail-corrected). |
| `223_critical_path_premortem.md` | AUDITOR 1 | *in flight* — the keyed-path pre-mortem (predicted Step-0 outcome, will-break table, M1–M9 expected values). |
| `224_advantage_gap_and_plan_audit.md` | AUDITOR 2 | *in flight* — the plan's prosecution (audits THIS list's `DONE-VERIFIED` rows + commands) + the ranked competitor-advantage / RapidTool-disadvantage ledger. |
| `220_external_verification.md` (363 lines) | WATCHDOG E | 20 external claims verified with URL + quote + date; the model-id PASS; MCP gaps confirmed live; 42+16 plan rows audited for command realism (**1 invalid** — the known `browser-smoke` flag issue, already re-scoped as OV-2). |

> **Correction, resolved at the third audit (parent-verified, 2026-09-24):** the MCP-client count
> oscillated 7 → 6 → **7**, and the final value is **7 with a nuance**. `219f` said 7; P1 "corrected" it
> to 6 clients + 1 server example (reading ChatDev's `mcp_example/mcp_server.py`); AUD-2 then found
> ChatDev's *live* client and the parent verified it: `runtime/node/agent/tool/tool_manager.py:15` is
> `from fastmcp import Client`, with `StreamableHttpTransport`/`StdioTransport` (:17),
> `_fetch_mcp_tools_http` (:65), `_fetch_mcp_tools_stdio` (:93) and `mcp_remote`/`mcp_local` tool types
> (:112-117). **ChatDev ships BOTH a client and a server example — so 7 clones ship clients**, and P1's
> note undercounted. Any future claim says **7**. (The gap stands regardless: RapidTool ships none.)

### 4.8 DISADVANTAGE LEDGER (AUDITOR 2) — the ranked few that matter

`224_advantage_gap_and_plan_audit.md`, ranked by *what the gap actually costs*:

| # | Gap | Real cost | Class | Verdict |
|---|---|---|---|---|
| **1** | **Provider breadth** (1 vendor vs 12–22+) | Blocks the cross-family judge and BYOK; the entire proof runs through one vendor's one key | engineering (cheap to start; F2 designed) | **close** — highest leverage |
| **2** | **Sandboxed execution** | Caps claims + autonomy (no E2E of a running tree) | infra + product decision | **not closable on this host** (no isolator) — decision, not work |
| **3** | **MCP runtime client** | No real tool ecosystems for agents | engineering (F1 designed) | close (sequenced) |
| **4** | **Permission granularity** | *Softer than the dossiers said* — `policy.ts:170` is **already action-shaped** | engineering (S) | **cheapest high-value close** |
| **5** | Index-at-scale | Real on big repos; RapidTool is lexical by design | product decision | **defer** — embeddings would break the determinism axis (a *leads* mechanism) |
| **6** | Streaming / IDE surface | Developer adoption | structural loss (`90` §7) | do not chase |
| **7** | Test-CI kinds | Trust signal | engineering (S–M) | close selectively |
| — | Visual polish, frontier IQ, cloud fleets, community scale | — | structural losses | **explicit not-worth-closing list** in the file |

**AUD-2's most consequential unreported finding — RapidTool ships ZERO CI.** Parent-verified today:
`.github/workflows/` **does not exist** (0 workflow files), while the clones carry cline 17 · Dyad 20 ·
Roo-Code 7 · OpenHands 19 · aider 10 · bolt.diy 12 · gpt-engineer 4 · MetaGPT 5. For a project whose
identity **is** verification-first, the discipline is enforced only by hand (the parent runs `gate.sh`),
and **no row of the 42 mentions it**. One-workflow close — and it pairs with the known push blocker
(the repo has no GitHub remote yet per the board).

> [IMPROVER · 2026-09-24] CI ADDENDUM (read today): the remote EXISTS — `git remote -v` → `origin git@github.com:RodneyDanger1/RapidTool.git` (fetch+push), so "the repo has no GitHub remote yet per the board" above is stale; if a push blocker remains it is auth/permission, not remote absence. Field habit for a Windows-first repo: aider splits legs (`ubuntu-tests.yml:25 runs-on: ubuntu-latest` + `windows-tests.yml:25 runs-on: windows-latest`, both read today) — choose the one-workflow runner deliberately, since an ubuntu leg cannot catch this repo's Windows-path bug class (OV-2's `/workspace` guard). — evidence: `git remote -v` + `grep -n runs-on aider/.github/workflows/{ubuntu,windows}-tests.yml`. (by PLAN-IMPROVER)
>
> [PARENT · 2026-09-24] CORRECTED — the insertion immediately above overreaches: **a configured remote is not an existing repo.** Verified live this minute: `git ls-remote --heads origin` → `ERROR: Repository not found.` / `fatal: Could not read from remote repository.` → the GitHub side still does not exist, the push blocker STANDS (create the repo first — owner action — then push; `git remote -v` proving a local URL proves only the config, not the repo). The addendum's second half — runner choice must be deliberate because an ubuntu leg cannot catch this repo's Windows-path bug class — stands and is adopted for the CI row. — evidence: `git remote -v` (configured) + `git ls-remote --heads origin` (404) run by the parent 2026-09-24 ≈13:08. (by parent)

**AUD-2's task-list prosecution verdict:** **0 unsupported rows · 0 unearned `DONE-VERIFIED`**; ~25
why-traces spot-read and all resolve; no cycles; 3 live spot-checks green (honesty-guards 5/5,
token-ledger 23/23, lesson-writers 18/18). Its **5 attributable corrections are in
`220_tasklist_canonical.md`**: DF-09's anchor `engine.ts:1631`→**`:1629`** (a WD-A misanchor that had
propagated), lesson-writers count 15→**18**, T5.3's `eval --limit 1`→**`--limit=1`** (run-eval parses
only the `=` form), three **coverage gaps** in §6(b) (no scheduler/daemon, outcome-attributed lesson
ranking, patch-format breadth), and the MCP-count fix above.

---

### 4.9 THE SECOND STEP-0 RISK — A1, partially falsified, with the residual named

X-2's A1 claimed the CLI keyed path "cannot reach a chat LLM at all". **Parent-reproduced and narrowed:**
`DEEPSEEK_API_KEY=dummy-key-for-probe … rapidtool-cli.mjs doctor` → `"llm": { "configured": true }` — the
CLI *does* see a shell-provided key; the lane's `configured:false` came from its own probe script's module
instance, and the `AsyncLocalStorage` error is a probing artifact. **The residual question is real and
cheap to settle:** does the **P6 synthesis path** (the deliberately separate `"./deepseek." + "server.ts"`
specifier at `engine.ts:2851-2885`) reach a model under the CLI? That is `OV-27`, and it belongs in the
**pre-flight, before Step 0** (alongside C-1/C-2). So Step 0's risk picture is: **WB-1 (verified deadlock)
+ the OV-27 reachability probe (open)** — not "the path is inert".

Alongside it, X-2's unaffected findings that touch the plan directly: **A2** (thinking-mode inverts if any
seam passes `model:"deepseek-v4-pro"` with `json:true` — `verify.server.ts:800/817/846` don't pass
`thinking:false`; targets OV-1/OV-4/T5.7), **A3** (`SessionBudgetExceeded` is thrown and **nothing catches
it** — adopting the budget threading without a wrapper turns a budget stop into `RT_E_INTERNAL`), **A7**
(`node-runner.server.ts` has no token surface → T-107.6's done-when is unobservable as written), **A5**
(falsified: the envelope-tail hypothesis is dead — recorded so no lane chases it), and **Half B's four HOT
collisions** (`engine.ts`, `console.tsx`, `codegen.server.ts`, `rapidtool-cli.mjs` each carry 4+ rows →
**the one-lane-per-HOT-file rule is unmet by the list as written and must be enforced at wave design**).

---

### 4.10 ENGINEERING VERDICTS — depth (ENG-WD1) and executability (ENG-WD2)

**ENG-WD1 — code-on-code depth audit (`234`, parent-recovered).** Five mechanisms compared
implementation-against-implementation with clone revisions pinned:
`RAPIDTOOL-DEEPER: 2 (verification · honesty) · PARITY: 1 (learning — parity on *measurement*, RapidTool
deeper on bounded authority) · COMPETITOR-DEEPER: 1 (budget, on binding-today) · DIFFERENT-AXIS: 1
(governance — RapidTool deeper on **who decided**, competitors deeper on granularity) · planned closes
viable: 2/4 as-designed, 1 with change, 1 not-a-close`.
**The budget verdict is the one that stings and the one to fix:** RapidTool's `SessionBudgetExceeded` is
landed but **unwired** (`219c`/AUD-1 WB-8, X-2 A3: nothing catches it, no production caller), so against
clones that *do* stop at a limit today, the competitor is deeper **on binding** while RapidTool is deeper
on design. That is exactly what T-107.6/OV-4 exist to close — and A3 says the close needs a catch wrapper
or a budget stop becomes `RT_E_INTERNAL`.

**ENG-WD2 — execution readiness (`235`, 41 KB, delivered).** A wave plan that executes, with the HOT rule
*shown* enforced via per-file serialization chains (`headless.ts` ×5 waves, `run-eval.mjs` ×4, CLI ×3,
`console.tsx` ×3, `codegen.server.ts` ×3):

`W0 {C-1, C-2 + 2 zero-risk text rows} → W1 {OV-35, TASK-01, T5.2-A} → W2 {T5.3, OV-2, OV-13} →
W3 {TA-3+OV-17+OV-15} → Step 0 → W5/W6 {OV-3, OV-5 | OV-4}` — **14 lanes, 17 rows placed, 0 UNPLACEABLE.**

Two findings that change how waves must run:
1. **`verify PROVES/WEAK/MISSING: 4/13/0` — 13 of 17 placed rows have verification that could pass while
   the row is broken.** The merge must strengthen those 13 before dispatch (or label them WEAK in the
   brief so lanes know the green is not proof).
2. **Lane sizing is about write *position*, not budget: 5/5 lanes that reached their write finished;
   0/4 that deferred it produced anything** (measured from the delegation transcripts; lane 1 wrote its
   skeleton at call 4 and survived to the same cap that killed lane 3/4/X-1/X-2, which died at calls 59–86
   mid-recon). **Rule that follows: skeleton + bottom line within the first ~10 calls, then write-as-you-go** —
   it goes in every future lane brief.

---

## §5 · How this plan proves itself

1. Every row executes to an **observable done-when** with a command that this repo already has (or a
   new test file named in the row) — no row is closed by prose.
2. The boundary discipline stays: lanes on disjoint files, one `gate.sh` at each boundary, parent-only.
3. The plan is falsifiable in its own terms: if Step 0 contradicts §1's reasoning (e.g. the score is
   better than expected), **the plan loses rows rather than gaining narrative** — claims are struck,
   not softened (`218` §2.4).
4. This plan carries its own audit trail: WATCHDOG D canonicalised it, WATCHDOG E checked every
   command and file against reality, and both reports are on disk next to it.
