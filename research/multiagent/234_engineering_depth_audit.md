# 234 — PARENT-RECOVERY NOTE (read this first)

ENG-WD1 completed the code-on-code reading (all five mechanisms, both sides — clone revisions re-verified) but
exhausted its tool-call budget before the write pass; it handed the full evidence back for recovery.
**Everything below the rule is the LANE's own content, unedited.** The parent added only this header and
the file write. Nothing was executed from any clone.

- lane: W13 ENG-WD1, persona "code-on-code depth audit" · delegation `deleg_f8c915e1`, task-0
- source of this text: `%LOCALAPPDATA%\hermes\cache\delegation\subagent-summary-0-20260924_123147_818144.txt`
- full tool transcript: `%LOCALAPPDATA%\hermes\cache\delegation\live\deleg_f8c915e1\task-0.log`
- repo state read: `7582771`; clone revisions matched `219f` (aider 5dc9490 · cline 025baa8 · Dyad 43bdd75 ·
 Roo b867ec9 · SWE-agent 3ea751c · opencode 88c6c7a · codex c56dda7 · ChatDev 4fb2db0)

---

## SUMMARY — deliverable NOT written (hit iteration limit)

**Status: honest failure to finish.** I completed the code-on-code reading (all five mechanisms, both sides) but exhausted the tool-call budget **before writing `research/multiagent/234_engineering_depth_audit.md`**. The file does not exist. All evidence below was read today from disk; the parent can paste it or re-dispatch a short write-only pass.

**Repo state:** `git log -1` = `7582771`. Clone revisions re-verified today, match 219f exactly (aider 5dc9490 · cline 025baa8 · Dyad 43bdd75 · Roo b867ec9 · SWE-agent 3ea751c · opencode 88c6c7a · codex c56dda7 · ChatDev 4fb2db0). Nothing executed from any clone.

### Bottom line (what the headline would read)
`comparisons done: 5/5 · RAPIDTOOL-DEEPER: 2 (verification, honesty) · PARITY: 1 (learning, on measurement; RAPIDTOOL-DEEPER on bounded authority) · COMPETITOR-DEEPER: 1 (budget, on binding-today) · DIFFERENT-AXIS: 1 (governance: RapidTool deeper on "who decided", competitors deeper on granularity) · planned closes viable: 2/4 as-designed, 1 with change, 1 not-a-close`

### Five depth verdicts + named deltas

**1. Verification — RAPIDTOOL-DEEPER (with a narrow caveat).**
RapidTool: `compile-check.server.ts:939` `treeRun` copies the emitted tree to scratch and runs *the artifact's own toolchain*; verdict fail-closed at `:1036` (`ok = compile.ok && specsGreen && entryGreen && projectLeg.verdict.ok`); missing entry verdict / headless skip is NOT green (`:1029-1036`); un-runnable declared script = loud "UNVERIFIED (not a pass)" (`:1024`). `mintTreeRunTested` (`codegen.server.ts:3211-3247`) mints `tested`+`evidenceHash` **only** when ≥1 assertion executed — zero-execution returns a warn log, never a pass. `dod.ts:500-517` `p6-verified` structurally requires label `"tested"`+hash.
Strongest clone: **Dyad** — `tsc.ts:495` `runTypeScriptCheck` (tsc --noEmit+caching) **plus** `tests_handlers.ts:126/215/252` running Playwright specs against a *running preview*, pass/fail parsed at `:690/:1010`. aider `base_coder.py:106` `auto_test = False` (tests off by default); gpt-pilot `bug_hunter.py:103/:144` asks the *user*, doesn't execute.
Delta named: RapidTool's verdict is **bound** — hash on the gate criterion, fail-closed on an absent verdict. Dyad's E2E is browser-level but needs a running app and is not hash-bound. Caveat: WB-1 makes `ok:true` unreachable for keyed chunked trees today (code-verified), so the mechanism's *depth* is proven; its *effect* is not.

**2. Budget — COMPETITOR-DEEPER on binding today; RAPIDTOOL-DEEPER on mechanism.**
Re-confirmed **WB-8 with my own grep**: `assertBudgetHeadroom`/`recordBudgetSpend`/`recordSpendWithinCap`/`assertWithinBudget`/`wouldExceed`/`createTokenBudget` have **zero non-test callers**; `RAPIDTOOL_TOKEN_CAP` is read only at `codegen.server.ts:2112` + `token-ledger.ts:124`. Wired caps exist but are internal-budget: crew `maxTotalTokens ?? 60_000` (`crew.server.ts:966`, pre-loop `:984`, pre-dispatch projection `:1030-1035`, `CrewStopReason "cost-limit"` `crew.ts:94`); subagent `12_000` (`subagent.ts:58`, `:424` spend-kept-blocked).
Competitors: **SWE-agent** `models.py:73` `per_instance_cost_limit` default **3.0 USD**, `_update_stats:370-382` raises `InstanceCostLimitExceededError`, `agents.py:1183-1187` stops with `exit_cost` (total limit re-raised hard `:1181`) — **default-on, dollars**. **codex** `core/src/rollout_budget.rs` weighted tokens + `SessionBudgetExceeded` (`session/rollout_budget.rs:37`) + reminders; but `Feature::RolloutBudget` is `default_enabled:false` (`features/src/lib.rs:1649-1653`); its **goal** token budgets are `Stage::Stable, default_enabled:true` (`lib.rs:1630-1634`, `ext/goal/src/accounting.rs` 647 lines). Roo's cost cap is an *ask* (`AutoApprovalHandler.ts:91-135`); cline only classifies a provider `SpendLimit` error (`ClineError.ts:16`).
Delta: 219f's "RAPIDTOOL-LEADS (narrowly)" is **overstated for the default path** — its hard-cap class is unwired and its caps are token-count; SWE-agent stops a run in dollars by default.

**3. Governance — DIFFERENT-AXIS (RapidTool deeper on "who decided"; competitors deeper on granularity).**
`policy.ts` is a pure default-DENY seam (`:170`), type-enforced mandatory `fallback` on every deny (`:65`), `hitl.force` `requiresHumanSeat` so a machine **structurally cannot** force a human gate (`:195-220`). The distinctive invariant: the **reader** also checks — `headless.ts:820` routes the writer; `dod.ts:137` re-runs `evaluatePolicy` over the *recorded row* in `policyConsistentApproval`, and `provenanceConsistent` (`:107-118`) fails closed when `decidedVia.tokenPath !== (decidedBy==="human")`. `HARNESS_APPROVE_ACTOR` (`headless.ts:736`) stops the machine minting `decidedBy:"human"`.
Clones bind *whether to ask*, not *who decided*: opencode `permission/index.ts:28` `evaluate()` wildcard rulesets + allow/deny/ask + persistent `approved[]`; cline `tool-approval.ts:29` file-poll decision channel (5-min timeout); Roo `AutoApprovalHandler` per-category sets. **opencode is deeper on granularity** (permission×pattern wildcards); none showed a recorded-approval provenance check.

**4. Honesty invariants — RAPIDTOOL-DEEPER.**
`sandbox:false` on every runner envelope (`node-runner.server.ts:49-53`), frozen non-claim `sandbox-policy.ts:33`, B-18 phase declarations (`phases.ts:33`), and refuse-don't-fabricate in the mint. Strongest counter-example: **Devika** `src/sandbox/firejail.py` — a 0-byte file inside a directory named `sandbox` (**carried from 219f §2.2 — I did not re-read it today; label UNVERIFIED today**). No clone showed an analogue of stamping "this is NOT X" onto the wire.

**5. Learning — PARITY on measurement (both zero); RAPIDTOOL-DEEPER on bounded authority.**
RapidTool: `knowledge.ts` lesson store (`:751/:937/:1012`), `reproducedCount` accrued (`engine.ts:344-346`), advisory-only (`engine.ts:671`), structural red-seal mute (`engine.ts:1452-1497`), 80-row cap. F3 (the *measurement*) is designed, not landed. Clones persist memory (aider `base_coder.py:520-522`, MetaGPT `metagpt/memory/`, Roo checkpoints, cline session versioning) — **none measures that learning helped** (219f's expected "no" confirmed). Delta: only RapidTool bounds learned memory's authority (cannot override a gate) and mutes it structurally on a red seal.

### Verdict 1 — defensible superiority (today, one paragraph)
> Across the implementations I read today, RapidTool is the only harness in this set whose produced artifact is executed under **its own declared typecheck/test/build toolchain** and whose "done" verdict is **fail-closed and evidence-hash-bound** to a gate criterion that an unexecuted tree structurally cannot satisfy; the only one that binds **which seat decided** every approval on both the write and the read side through one pure default-deny seam that a machine cannot use to force a human gate; and the only one that stamps explicit machine-readable **non-capabilities** (`sandbox:false`, B-18) into its own runtime envelopes. Its token-ledger is the deepest single-file budget mechanism in the set (cache-aware, record-then-signal with spend-kept, typed refusals with mandatory fallbacks) **but its hard cap is not wired on the default path**, and it trails the field on provider breadth, MCP runtime, and isolation.
- **Post-maker-test variant (would then be supported):** "…and it has actually done this end-to-end on a real brief — a green tree-run with its own tools, a minted tested-verdict, and a converged governed journey."
- **Still false forever (do not claim):** "farther along than ALL competitors" as a product claim — its keyed path is deadlocked (WB-1), it has no cost stop that binds by default (WB-8), one provider vendor, no MCP client where 7 clones ship one, no isolator, zero CI.

### Verdict 2 — planned-close viability
- **F1 MCP client (discovery-first) — VIABLE AS DESIGNED.** The design's load-bearing fact is confirmed: `runNodeBounded` hard-codes `stdio:["ignore","pipe","pipe"]` (`node-runner.server.ts:310`), so a new spawner is genuinely required; reuse helpers (`:196/:224/:144/:157`) and the error-code/CLI-family seams all exist. Does not move the maker test — say so.
- **F2 provider breadth — VIABLE WITH CHANGE.** Descriptor widening is additive and the live-verified rule holds, **but F2's stated payoff (cross-family judging → M3/M4) does not follow from F2 alone**: WB-1 means M3/M4 stay 0 at any number of families until C-1. Sequence F2 after C-1, or drop the score claim.
- **F4 per-action allow-lists — VIABLE AS DESIGNED** (narrowing-only overlay over the already action-shaped `evaluatePolicy` `:170`). **But note the plan conflates "F5/policy granularity"**: **F5 is a NOT-RECOMMENDED stop-sign memo — NOT a close at all.**
- **CI workflow row — VIABLE AS DESIGNED.** `scripts/gate.sh` exists; one `gate.yml` is a real close. Its value is external trust, not the maker test.

**Single mechanism most credibly making it "farther along":** verification depth (treeRun + hash-bound promoted verdict) — deepest in the set, expensive for a clone to match, and becomes a *product* claim once C-1 is fixed.
**Mechanism where a chase is wasted:** codebase-scale index (F5) — lexical-by-design is the determinism axis, the emitted trees are small, and both honest implementations carry a forbidden cost.

**Issue to flag to the parent:** the deliverable file was not created; budget was consumed by the five comparison reads. A short follow-up pass can write `234_engineering_depth_audit.md` from the above without re-reading.

[NOTE: subagent modified files the parent previously read — re-read before editing: C:\Users\mnril\Desktop\RapidTool Main\research\multiagent\220_overhaul_plan.md, C:\Users\mnril\Desktop\RapidTool Main\research\multiagent\220_tasklist_canonical.md, C:\Users\mnril\Desktop\RapidTool Main\research\multiagent\223_critical_path_premortem.md, C:\Users\mnril\Desktop\RapidTool Main\research\multiagent\229_steering_and_goal_alignment.md, C:\Users\mnril\Desktop\RapidTool Main\wave_plans\W13\wd-z.md]