# Review — RapidTool FINAL finish wave (six-lane task list)

**Reviewed:** `grok-finish-tasks-f397006f.md` (215 lines) · **Summary:** `grok-finish-summary-f397006f.md`
**Repo:** `C:\Users\mnril\Desktop\RapidTool Main` · **HEAD:** `95089de` · `git status --porcelain` empty (0 lines).
**Method:** read the task list + ground truth (`fixes\346_final_wave.md`, `fixes\346_wave_log.md`,
`testruns\_report\{CAMPAIGN1,CAMPAIGN2}.md`, `testruns\{default-check,tuning}\TUNING.json`,
`testruns\default-check\{sample1,sample2}\TUNING.json`, `scripts\prevention\cassettes\rubric-baselines.json`,
`scripts\guards\guard-registry.json`) and then checked every cited seam against the bytes at HEAD. Ran the
keyless proof harness (`node scripts/prevention/verify-prevention.mjs --all --selftest`) and one full
`scripts/gate.sh` on the frozen tree. No git writes; no keyed calls.

Verdict summary: **needs revision.** The six-lane skeleton is sound and its disjointness/claims are mostly
verifiable, but **five tasks are premised on already-landed behaviour** (their "current behaviour" does not
exist at `95089de`) and two statements in the "Verified current state" section are false. Spawning as written
would burn lane budget re-editing landed code.

---

## Issues

**Severity:** major · **Section:** §2 "Open seam" + Lane D `D-3` · **Description:** The claim that
`headless.runlockEditViolations` "exists but is **not wired** into the run path" is false at HEAD. The
function is imported and executed on the run path: `scripts/rapidtool-cli.mjs:1489-1514` calls
`h.runlockEditViolations(REPO_ROOT, runlockStartMs)` and refuses with `code:"RT_E_SRC_EDITED_DURING_RUN"`
naming the offending files. (The doc's own grep was scoped to `src/lib/headless.ts`, where only the
definition at `headless.ts:989` appears — the wiring lives in the CLI.) D-3 therefore asks to wire a seam
that is already wired, and its acceptance ("Fixture window (BL-010 timestamps) refuses coded; a clean window
passes") is already satisfied by `headless.test.ts:1397-1400` plus the CLI call. · **Suggestion:** Delete D-3,
or re-scope it to the genuinely open residual (e.g., a red-first guard that the CLI's run path invokes the
seam). · **Status:** open

**Severity:** major · **Section:** Lane Q `Q-1` · **Description:** Q-1's premise — "the guard's parallel
`realModuleSet` (job modules only) fires `RT_E_UI_UNWIRED` on 8/8 while the ONE product predicate … says 4/8.
Make the guard consume the canonical predicate" — is already done. `scripts/guards/campaign-invariants.mjs`
imports and consumes the seam: `loadCampaignSeams` reads `realGeneratedExportWiring` (`:201-226`),
`detectUiWiring(treeDir, realGeneratedExportWiring, slug)` is called (`:517`, `:632`, `:644`, `:648`), and
the header comment (`:16`, `:30`, `:318`) states there is no parallel `realModuleSet`. `guard-registry.json`
C1-02 records this as landed (`fixSeam … (no parallel realModuleSet) … landed 23fb616`). · **Suggestion:**
Drop Q-1 or re-point it to a new mutation guard; do not spend a lane on a landed seam. · **Status:** open

**Severity:** major · **Section:** Lane D `D-2` · **Description:** D-2 says "`RT_E_PLAN_UNDERPRODUCED` is
journaled but the emit seal echoes `RT_E_TREE_RUN_FAILED`/`RT_E_SUBSTANCE_EMPTY`. Make the seal surface the
floor code." The seal already surfaces it: `scripts/rapidtool-cli.mjs:2368`/`:2594` consume
`h.planUnderproductionSeal` and set `code:"RT_E_PLAN_UNDERPRODUCED"` (`:2378`). The measured bytes confirm it —
`testruns\default-check\TUNING.json` and `testruns\tuning\TUNING.json` show below-floor trees with
`"emitCode":"RT_E_PLAN_UNDERPRODUCED"` (e.g. `bakery-florist-orders`, `office-stock-tracker`). The
`RT_E_TREE_RUN_FAILED`/`RT_E_SUBSTANCE_EMPTY` description is the campaign-2 (`2f0e3d7`) state, fixed in
`23fb616`. Guard `R2-01` is already `enforced`. · **Suggestion:** Delete D-2 (and the corresponding Q-2 pin).
· **Status:** open

**Severity:** major · **Section:** Lane S `S-3` · **Description:** S-3 says the floor check "carries code
`RT_E_VALIDATION` and sits **after** the per-chunk early-returns (`:6018/:6221/:6266/:6277`), so a below-floor
partial is persisted without hitting it." At HEAD the code has already been refactored into a single refusal
door: `codegen.server.ts:6010-6037` documents "the ONE refusal door … coded `RT_E_PLAN_UNDERPRODUCED` … never
the generic `RT_E_VALIDATION`", `refuse()` calls `underProducedRefusal` (`:6017`) and returns
`partialTreeRefuse(..., under.code, ...)` (`:6019`), and `minimumTreeFileCount`/`underProducedRefusal`
(`:2474`, `:2498`, `:2535`) carry the floor code. This is the campaign-2 result already recorded in
`CAMPAIGN2.md` §6 ("C1-01 floor reachability — LIVE and reachable") and `R2-01`/`C1-01` are `enforced`. The
"RT_E_VALIDATION at `:6037`" description is the campaign-1 (`b3baef8`) state. · **Suggestion:** Delete S-3 or
re-derive it against HEAD before spawning. · **Status:** open

**Severity:** major · **Section:** Lane G `G-1` · **Description:** G-1 calls the query builder "**the only
unlanded C seam**: the query is still domain-nouns-first." At HEAD it is already intent-first with a bounded
qualifier count and an off-intent blocklist: `engine.ts:3298-3301` returns `[intent, ...qualifiers]` with
`RESEARCH_MAX_QUALIFIERS = 3` (`:3240`), and `isOffIntentResearch`/`filterOffIntentResearch` (`:3330`,
`:3342`) are wired into `fetchResearch` (`:3411`). The comment at `:3285-3297` explicitly documents the
"pre-fix builder put the domain noun bag first … so a bakery brief … returned rental/lease category pages
(BL-001)" as the fixed past. G-1's acceptance ("intent leads, ≤3 qualifiers") already passes. · **Suggestion:**
Delete G-1, or re-scope to a genuinely unlanded query behaviour. · **Status:** open

**Severity:** major · **Section:** §2 "Registry gap" + Lane G `G-2` · **Description:** Two defects in one
claim. (a) §2 says the seven codes are absent and "only `RT_E_PLAN_UNDERPRODUCED` and
`RT_E_SRC_EDITED_DURING_RUN` are registered" — false. `errors.ts` also registers `RT_E_SUBSTANCE_EMPTY`
(`:124`), `RT_E_DUPLICATE_EXPORT`/`RT_E_USE_BEFORE_DECL`/`RT_E_MONEY_SEMANTICS`/`RT_E_README_PARITY`
(`:148-151`), `RT_E_REPAIR_FAILED` (`:43`) and `RT_E_RESEARCH_UNAVAILABLE` (`:35`) — nine, not two.
(b) G-2 lists seven missing guard `expectedCode`s, but the registry names **eleven** absent `RT_E_*`
codes. Beyond G-2's seven, these are also absent from `ERROR_CODE_DOC`: `RT_E_DEFAULT_CHECK_BASELINE_LOST`,
`RT_E_REFUSAL_COVERAGE_LOST`, `RT_E_SYNTH_RESAMPLE_UNBOUNDED`, `RT_E_SYNTH_RESUME_NOT_REUSED` (all
`guard-registry.json`, guards `S4-02/03/04/05`). G-2's own acceptance ("every `guard-registry.json`
`expectedCode` … is a key in `ERROR_CODE_DOC`") is therefore **unsatisfiable with only the seven listed** —
the test would still fail on the other four. · **Suggestion:** Correct §2 to name the full absent set, add the
four missing codes to G-2, and state the acceptance as derived from the registry (not a hand list). ·
**Status:** open

**Severity:** major · **Section:** §3 rule 6 + Lane Q `Q-2` · **Description:** Q-2 ("add/re-point guard entries
+ cassettes for D-1, D-2, D-3, S-3, G-1") is a **cross-lane consumer of five other lanes' edits**, but the
document freezes only I-A (S→X) and I-B (G's `recordGateInto`, read-only by D). Q-2 cannot pin a fix that its
producer lane has not yet landed; in a fully-parallel wave this either blocks Q-2 or forces it to author
guards against un-landed seams. Additionally, three of its five targets (D-2, D-3, S-3) are already landed and
already have enforced guards (`R2-01`, `C1-11`, `C1-01`), so "re-point" risks conflicting with existing pinned
entries. · **Suggestion:** Express Q-2 as an explicit producer→consumer join (Q runs after D/S/G land, or the
per-fix pin is delegated to the producing lane), and drop the already-enforced targets. · **Status:** open

**Severity:** minor · **Section:** §1 Overview · **Description:** "the armed chunk-resample default produced
**3/4** in one sample and **0/4** in another (a third, differently-collected sample was **1/6**). The honest
combined rate is **~4/10**." With three samples named, 3/4 + 0/4 + 1/6 = 4/14, not 4/10; the 4/10 figure
silently drops the 0/4 sample (and matches `fixes\346_final_wave.md` §2/§3, which cite only 3/4 and 1/6).
The 0/4 sample is also `artifactComplete:false` in `rubric-baselines.json#defaultCheck` (no emitted tree on
disk), so calling it "produced 0/4" is itself imprecise. · **Suggestion:** State the exact composition of the
combined rate and its denominator (2 samples = 4/10; all three = 4/14), or label the 0/4 sample incomplete and
exclude it explicitly. · **Status:** open

**Severity:** minor · **Section:** Lane V `V-1`, `V-2` · **Description:** Two of three V tasks are substantially
already landed. `deepseek.ts:325-326` already carries `prompt_cache_hit_tokens → cachedPromptTokens`, pinned
by `deepseek-taxonomy.test.ts:149`; the `finish_reason` taxonomy (`classifyFinishReason`, incl. the
non-retry `content_filter` at `:711`) is landed and pinned by `deepseek-taxonomy.test.ts:67-78`. So V-1's
"carry `prompt_cache_hit_tokens`" and V-2's "`finish_reason` classified" are done; the genuinely open parts are
V-1's byte-stable leading prompt prefix and V-2's `servedProvider` provenance (`servedProvider` appears
nowhere under `src/`). · **Suggestion:** Narrow V-1/V-2 to the unlanded halves (prefix stability;
`servedProvider` field) so a lane does not re-do landed, already-tested work. · **Status:** open

**Severity:** minor · **Section:** §4 Lane X / §6 Owned-file union · **Description:** The union is declared
"complete", but the keyed lanes write measurement artifacts outside any listed owned set: S-1 writes
`testruns\s5-reliability\{sample1,sample2}\ledger.json` and X-2 writes `testruns\campaign3\ledger.json`, while
X's owned set lists only `testruns\_report\**` (and S lists no `testruns` path). · **Suggestion:** Add the
measurement roots (`testruns\s5-reliability\**`, `testruns\campaign3\**`) to the union so "complete" is
literally true. · **Status:** open

**Severity:** minor · **Section:** §1 + §3 rule 2 · **Description:** The headline "**six parallel lanes for
~10 minutes each**" is stretched by the keyed lanes. S-1 must run two *sequential* 4-brief samples (the rule
"no second run may be started unless the first fully finished" forces serialization; ~15 min each at the
campaign's observed ~200 s/brief), and X-2 runs an 8-brief campaign (~25 min). The exemption is stated and the
caps are given, but the per-lane wall clock is ~2–3× the headline. · **Suggestion:** Restate the S and X
budgets as "setup dispatch inside 10 min; in-flight run bounded by the ledger cap" and give a realistic
wall-clock estimate. · **Status:** open

**Severity:** nit · **Section:** Header "Boundary gate" · **Description:** "lint 0" is ambiguous: the gate
records `lint {ok:true, exit:0}` (problems null this run, but 5 lint warnings historically per
`fixes\346_final_wave.md` §3 and `346_wave_log.md`). Read literally "lint 0" claims zero warnings. ·
**Suggestion:** Write "lint exit 0" (or "lint 0 errors, 5 warnings"). · **Status:** open

**Severity:** nit · **Section:** §4 / §6 paths · **Description:** The doc writes `testruns\…` as if repo-
relative, but there is no `testruns` directory inside `RapidTool Main`; the artifacts live in the sibling
`C:\Users\mnril\Desktop\testruns`. `guard-registry.json` even resolves it as "the sibling `../testruns` next
to the repo". · **Suggestion:** Mark `testruns` as an external sibling root in the header. · **Status:** open

**Severity:** nit · **Section:** Lane Q `Q-3` · **Description:** "de-stale any entry touched by S-2" invites
dropping/re-pointing a guard entry; the registry's own rule is that a stale entry must be re-pointed to a new
red fixture, never silently dropped (and rule 4 says a deleted guard fails the count floor). · **Suggestion:**
Require re-pointing to a new red fixture and forbid deletion. · **Status:** open

---

## Strengths

- **Disjointness (criterion 1) verified.** The six owned-file sets are pairwise disjoint as written
  (`codegen.server.ts` → S; `compile-check.server.ts` → D; `headless.ts`/CLI → D; `dod.ts`/`engine.ts`/
  `errors.ts` → G; `verify*/crew*/llm/**` → V; `scripts/guards|prevention|gate.sh` → Q;
  `acceptance.ts`/`doctor.ts`/docs → X). The two hot files each have exactly one owner. The only cross-lane
  needs are correctly expressed as producer→consumer interfaces (I-A token suffix S→X; I-B `recordGateInto`
  G, read-only by D) — with the exception of Q-2's undeclared dependency (issue above).
- **Boundary-gate counts (criterion 2) verified true.** Running `scripts\gate.sh` on the frozen tree returns
  `ok:true` with `typecheck exit 0`, `lint exit 0`, `assertionGaps exit 0`, `build exit 0`, `prevention
  {count:29, countFloor:29, missed:[], pending:[], skipped:[]}`, `testsScripts {pass:530, fail:0}`,
  `testsLib {pass:3767, fail:0, skipped:2}`. The keyless harness independently returns
  `guards:29 … fixtureIntegrity.missed:[] ∧ fixPresence.pending:[] ∧ skipped:[]`. So "prevention 29/29",
  "530/0" and "3767/0/2" all match the bytes.
- **Product/measurement numbers verified.** campaign1 `workingApp` 0/8, campaign2 2/8, default-check
  sample2 3/4 and sample1 0/4 (both pinned), tuning 1/6, `mobile-companion`/`office-stock-tracker`
  same-brief flips, `bakery-website` true-in-both, `bakery-florist-orders` false-in-both — all match
  `CAMPAIGN1.md`, `CAMPAIGN2.md`, `TUNING.json` and `rubric-baselines.json#defaultCheck`.
- **Genuine, well-grounded open items.** S-2 (form-bindable priority: `scaffold.ts:1872-1921` still prefers a
  render shell when one is callable), S-4 (`candidatesLogDetail` at `synthesis-policy.ts:151` has no
  `extraTokens`; call sites `:5576/:6168/:6346/:6545` match), D-1 (G5: `keepBestTree` at
  `headless.ts:3403-3420` grafts `generatedTree` without recomputing the gate — `testruns\bakery-florist-orders\build.json`
  `phases[6].gate` is `passed:false` with the p6-arch clause unmet), X-1 (parser at `acceptance.ts:319` and
  `resampleUsage` hard-code `extraTokens:null`), X-4 (no `extraTokens` surfaced in `doctor.ts`), V-3
  (`isMonotoneFix` at `verify.server.ts:818` still permits one equal-size lateral; the task tightens to
  strict-subset only) — all check out against the code.
- **Stuck-prevention (criterion 4).** Every lane carries a concrete, evidence-producing fallback (§4), plus the
  global "stop, write the exact blocker with `file:line` + evidence" rule (§3.3), and rule 1 forbids leaving a
  half-edit. No task can silently hang on an ambiguous interface.
- **No gate weakening / no mock-of-subject (criterion 6).** §3.4 and §7 explicitly forbid `@ts-nocheck`/
  `@ts-ignore`, relaxed tsconfigs, skip-promotion, hand-edited `emitted*`/`build*.json`, and mock-the-subject;
  no task lowers a DoD bar. Both keyed tasks state their ledger path and cap (`3,000,000`), and V-1 explicitly
  defers the keyed confirmation rather than claiming one. The landing DoD requires a red-first keyless pin for
  every fix.
