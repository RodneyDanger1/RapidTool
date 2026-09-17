# 105 — Adversarial Critique of `104_factory_upgrade_plan.md` (+ dossiers `100`–`103`)

**Lane:** independent adversarial critique. **Read-only.** Only write = this file.
**Evidence rule:** every criticism below cites the file + section/line it is about, and
wherever I assert a contradiction I quote both sides verbatim. Anything I could not
verify is marked **UNVERIFIED** with the blocker named.
**Verification performed by this lane** (commands run against the current bytes,
`cd "/c/Users/mnril/Desktop/RapidTool Main"`, 2026-09-16): `engine.ts:2740-2745`,
`headless.ts:725-734`, `scripts/run-eval.mjs:42,273,286-296,295`,
`src/lib/compile-check.server.ts:748-778`, `src/lib/scaffold.ts:473-477`,
`src/lib/llm.ts:42-43`, `deepseek.server.ts:43,45,310-311`, `codegen.server.ts:133,1401,1575`,
`doctor.ts:160-176`, `git log`/`git remote -v`, `scripts/README-cli.md:394-398`,
test counts in `AGENTS.md:59` / `README.md:15`.

---

## 1. Verdict

**The plan's diagnosis is sound, its honesty scaffolding is genuinely load-bearing, and
its task list is not yet executable as written.** §0–§4 are evidence-backed and
reproducible, the P0 pair T0.7+T0.8 is correctly identified and correctly coupled, and
the decision to strike a task (`104:576-583`) rather than ship an unsupported claim is
exactly the behaviour the repo's own contract demands. But §5 is not a factory task
list — it is a *shape* of one. Three structural defects: (a) **it drops the largest
blocker it names** — §2.1 B3 / §4.6 require "a real multi-job product" and no task in §5
produces one (100 P0-04 is UNMAPPED); (b) **its verifiability promise is broken by its
own tables** — §6.3 says "every 'done-when' is written so a machine can decide it", while
Phases 2, 3 and 5 carry no done-when column at all (6 tasks) or a prose list (8 tasks),
leaving 25 of 34 tasks undecidable as written; (c) **two of its own load-bearing facts are
wrong** — §4.2 P1 repeats a *comment* (`scaffold.ts:475`) as reality about a scratch
`npm install` that the implementation does not perform, and the plan never notices that
T0.7's fix breaks the eval harness's "human seat" (`run-eval.mjs:295`) that T0.10 and
§4.6's acceptance test depend on. Add the traceability holes: **15 of the 66 findings in
`100`–`103` have no task and no explicit deferral** — including P1-02 (no unattended
scheduling, yet "autonomous" is in the plan's title), 103 A2 (sandboxing, ranked #2 by value
in 103), all three 101 LOW-items, and 100 P0-04 (the multi-job product §4.6 demands). The plan is a strong Phase-0/Phase-1
program with a Phase 2–5 appendix; do not let anyone execute Phase 1 before T0.7 and its
harness blast radius are understood, and do not let anyone declare §4.6 acceptance met
without the multi-job task added below.

---

## 2. Contradictions (plan ↔ its own supporting dossiers)

Severity: **H** = blocks or falsifies a task; **M** = wrong sequencing / wasted work /
false state description; **L** = drift, cosmetic but contract-visible.

| # | Sev | Side A — quote | Side B — quote | Resolution |
|---|---|---|---|---|
| **C1** | **H** | `104:434` §4.2 P1: *"only inside the verify path: `scaffold.ts:475` `emit --verify-kind` runs a *scratch* npm install"* | `103` G2 (`103:116-121`): *"`verifyKindDir` runs `npm run build --ignore-scripts` **with `cwd = dir`** and there is **no** install step (`compile-check.server.ts:748-780`; only `npm` occurrence in the file is line 764)"* — **confirmed by this lane**: `compile-check.server.ts:764` spawns `npm run build --ignore-scripts` with `cwd: root` (= the emit dir); `scaffold.ts:473-477` is a *comment* asserting the scratch install. `104:599` (T4.1) also says *"today it builds with no `node_modules`"* — contradicting `104:434` in the same document. | `104:434` must be corrected to the measured state (no install, cwd = emit dir, dir mutated). T4.1 must then add scratch-copy + install **and** strike `scaffold.ts:473-477` + `scripts/README-cli.md:394-398` in the same commit (see TA-16). |
| **C2** | **H** | `104:554` Phase 1 header: *"Phase 1 — Any provider, properly integrated (lane 101 W1–W5)"*, and `104:563` T1.6 requires *"401/400/422/402/`RT_E_BUDGET_EXHAUSTED` ⇒ **no** failover"* | `101:860` W5 = *"accounting wiring across all call sites; `assertWithinBudget` pre-attempt; failover chain + telemetry; cost table"* — i.e. 101 keeps accounting **and** failover in one wave. `104` splits them: failover → Phase 1 (T1.6), accounting → Phase 2 (T2.1/T2.2). T1.6's budget clause is only testable once T2.2's pre-attempt check exists. | Move T1.6 into Phase 2 (after T2.2), or state the dependency explicitly in T1.6's done-when and in §5's sequencing rules. Relabel the Phase 1 header: it is W1–W4 + half of W5, not W1–W5. |
| **C3** | **H** | `104:544` T0.7 done-when: *"`decidedBy:"human"` requires out-of-band evidence, never a default"* | `100:39` P1-04: *"the benchmark's 'human seat' is performed by the harness stamping `human` — `run-eval.mjs:273` labels the driver the eval's human seat and `run-eval.mjs:295` does `p = approve(p)`"*. **Confirmed by this lane**: `run-eval.mjs:42` imports `approve` from headless; `run-eval.mjs:295` calls `p = approve(p)`; `headless.ts:725` `export function approve(project, opts)` hardcodes `decidedBy: "human"` at `:734`. T0.10 (`104:547`) needs a fresh keyed eval; §4.6/§0's acceptance bar needs the eval to complete. | T0.7 has an unstated blast radius: it breaks the eval harness that the plan's own acceptance test runs on. Add TA-2 (harness actor token), land it in the same commit as T0.7+T0.8. |
| **C4** | **M** | `104:593` T3.4: *"LLM-judge **only** where a deterministic oracle is impossible … judges carry position/verbosity/self-preference bias; must never replace an executable oracle"* | `100:113-114` P0-03: *"the durable fix is **cross-family judging** (e.g. judge via a different provider) once `101`'s adapter work (T1.5) lands — not a tier bump."* `102:203-204` §4.6: *"Signal 12 must be advisory-only **and cross-family**."* T3.4 states the advisory half only; no task requires the judge's provider ≠ the producer's. | Extend T3.4 (and T1.5's done-when) with the cross-family + order-swap requirement — otherwise T0.1 collapses the asymmetry into *judge == producer*, which is the archetype 100 P0-03 warns about. See TA-14. |
| **C5** | **M** | `104:538` T0.1 done-when: *"assert resolved model is flash **and** resolved timeout ≥ the explicit 240 s"* (no reasoning-effort assertion) | `104:153-160` §1.2: *"flash = thinking disabled (flash has no thinking-on shape in this module)"* is **false** for V4.1-Flash, and the card's numbers are *"evaluated at 100"* `reasoning_effort` (`104:157`). T0.4 (which adds `reasoningEffort`) comes **after** T0.1 in the table. | Co-land T0.1+T0.4 or add an effort assertion to T0.1. Otherwise P6 runs the flash tier under the module's flash defaults and the claimed +11.5 DeepSWE delta is not established. See TA-4. |
| **C6** | **M** | `103:182` A14 *"Depends on: **A8 for reproducibility**; G5 wire-up"* | `104:591` T3.2 = A14 in **Phase 3**; `104:609` T5.7 = A8 (cassette/replay) in **Phase 5**. | The dependency's stated prerequisite lands two phases later. Either land a minimal record/replay seam with T3.2 or downgrade T3.2's determinism expectation explicitly. |
| **C7** | **M** | `103:172` A4 *"Depends on: **A2 for untrusted deps**; network policy"* | `104:629` §6.1.2: *"Do not soften that wording **while landing A2**"* — but `104` §5 contains **no A2 task anywhere** (A2 is only in the `104:478` size table), and `104:599` T4.1 (`npm ci` on emitted deps) is scheduled with no A2 and no network/trust policy. | Either add an A2 task or write an explicit deferral + a stated policy for T4.1 ("deps are installed and built trusted-only, unsandboxed" — documented, not implied). See TA-19/TA-16. |
| **C8** | **M** | `104:592-593` T3.3/T3.4: *"*pending lane `102`* … will be lifted from `102_code_quality_signals.md`"* | `104:346-408` §3 is **already the merged output of lane 102** (F1–F4, the 12-signal ranked set, the ranked implementation order, and 102's own §4 numbering). The plan reads as if 102 had not landed. | Retitle T3.3/T3.4 to cite `102` §3/§4 directly and give both tasks done-whens (see §4 below). |
| **C9** | **L** | `104:202` MED-5: *"Lane `101` reported '12 across 8' … **Use the parent numbers (reproducible command)**"* (11 sites / 5 files) | `101:298` heading: *"MED-5 — Twelve hardcoded model-id literals across eight files"*; `101:837`-region change list repeats it. | Correct or footnote `101`'s heading (or have 104 say explicitly that 101's counts are superseded row-by-row, as it does for one row only). |
| **C10** | **L** | `101:857` W2 gate: *"`deepseek.server.test.ts` (21) + `llm.test.ts` unchanged and green; **new router tests green**"*; `101:856` W1 gate: *"typecheck/lint/suite green"* | `104:559` T1.2 done-when: *"21 `deepseek.server.test.ts` + `llm.test.ts` green; **no new env ⇒ byte-identical**"* (router tests dropped). `104:558` T1.1: *"4 gates green"* (adds build). | Keep the stricter gate: re-add "new router tests green" to T1.2, and make T1.1's gate wording identical to W1's (or say why build is added). |
| **C11** | **L** | `104:549-551` atomicity note: *"🔴 **T0.7 and T0.8 are a pair.** … Land them in one commit"* | `104:612-618` "Sequencing rules" lists only 4 rules: Phase 0 before Phase 1 · T1.3+T1.4 atomic · T2.1 before unattended use · never green-on-red. The T0.7/T0.8 pairing appears **only** in a blockquote, not in the rules an executor is told to follow; §5's own text says *"each phase leaves the repo green"* with no mention of the pair. | Fold the pair into §5 "Sequencing rules" (and add the T0.1/T0.4 and T4.1→T4.2 rules). |
| **C12** | **L** | `104:546` T0.9 scope: verb counts + `AGENTS.md:15` "NOT a git repo" | Measured by this lane: `README.md:15` says *"**1632/1632**"* while `AGENTS.md:59` says *"src ~1179 tests"* and `104:50` observes **1634** green; `103:30` G1 adds `README-cli.md:10` = 33 verbs and **`fixtures` missing from `README-cli.md` entirely** (dispatched at `rapidtool-cli.mjs:825`). | T0.9 is under-scoped — it will leave three more publishable falsehoods on disk. See TA-3. |

---

## 3. Traceability gap table

Method: every finding id in `100` (6×P0, 7×P1, 2×P2), `101`'s 9-item register, every
`103` A-item (A1–A18) and G-item (G1–G12), and every signal in `102` §3 was mapped to a
task in `104` §5 or reported here as UNMAPPED. **Totals: 66 findings traced · 15 UNMAPPED ·
27 partially covered (11 of them the T3.3 catch-all signals) · 24 mapped.**

### 3.1 `100_factory_blockers.md` — blockers

| Finding | Mapped to | Verdict |
|---|---|---|
| P0-01 actor-seam forgery | T0.7 | ✅ mapped (but see C3 blast radius) |
| P0-02 self-referential DoD | T0.8 | ✅ mapped |
| P0-03 judge/producer tier inversion | T0.1 (first half) + T3.4 (weak) | ⚠️ **partial** — the cross-family second half 100 explicitly names is absent (C4) |
| P0-04 no multi-job product | — | 🔴 **UNMAPPED** — 104 §2.1 B3, §4.6 and §2.3(b) all require it; §5 has no task. 100:184 gives the fix: *"the chunk→file mapping must emit real per-job modules, or the job names must stop being advertised as jobs"* |
| P0-05 cannot pass its own gates (4/9) | T0.10 (re-run only) + T3.1/T3.2 | ⚠️ **partial** — T0.10 decides whether M1=1 is earned; it does not close `p6-verified`/`p6-brief-fit`/`p6-arch`, which only T3.1/T3.2 gesture at |
| P0-06 composition of B1+B2 | T0.7+T0.8 pair | ✅ mapped (and correctly coupled) |
| P1-01 provider monoculture | T1.1–T1.5 | ✅ mapped |
| P1-02 no unattended scheduling | — | 🔴 **UNMAPPED** — `100:37` *"no cron/daemon/queue surface; nothing can run the factory on its own"*; §2.3(d) lists it as an autonomy requirement; §5 has nothing |
| P1-03 `humanFixtures` has no writer | T3.1 (gate wire only) | ⚠️ **partial** — T3.1 wires the G5 gate; no task creates the human-approval *writer* that `100:38` says does not exist anywhere |
| P1-04 benchmark human seat is a stamp | — | 🔴 **UNMAPPED** (and it is the C3 hazard: T0.7 breaks it) |
| P1-05 cap unset by default + narrow metering | T2.1 | ⚠️ **partial** — T2.1 extends metering; nothing addresses `tokenCap: null` by default (`100:40`, `103:85`) |
| P1-06 P9 canned deploy artifacts | — | 🔴 **UNMAPPED** — `100:41` *"deploy artifacts are templates, not executed pipelines"*; no task, no strike |
| P1-07 no user-facing checkpoint/undo | T4.4 | ⚠️ **partial** — checkpoint/resume yes; "undo" (revert a phase) no |
| P2-01 doc drift three-way | T0.9 | ✅ mapped (under-scoped, C12) |
| P2-02 M1=1 evidence degenerate | T0.10 | ✅ mapped |

### 3.2 `101_provider_integration.md` — the 9-item register

| Finding | Mapped to | Verdict |
|---|---|---|
| CRITICAL-9 claims/provenance risk | T1.3+T1.4 (atomic) | ✅ mapped — the coupling is explicit at `104:261-265` |
| HIGH-1 facade drops `thinking` | T0.5 | ⚠️ partial — `101:821` also lists the **server-fn validator** (`:35-40`) as a change site; T0.5 names only `llm.ts:42-43` |
| HIGH-2 cap meters one path | T2.1 | ✅ mapped |
| MED-3 unguarded `res.json()` | T0.6 | ✅ mapped |
| MED-4 doctor key-presence only | T0.2 + T1.5 | ✅ mapped |
| MED-5 hardcoded model literals | T1.1/T1.5 | ✅ mapped (count dispute, C9) |
| LOW-6 `RETRYABLE_STATUS` misses 408/502/504; `Retry-After` ignored | — | 🔴 **UNMAPPED** |
| LOW-7 backoff sleep not abort-aware | — | 🔴 **UNMAPPED** |
| LOW-8 served-model + cache-aware usage dropped | — | 🔴 **UNMAPPED** — and T1.6 (`104:563`) *depends* on "the served model read back from the 2nd provider", so this is a hidden prerequisite, not polish |

### 3.3 `103_feature_gaps.md` — A1–A18 (absent features)

| A | Mapped to | Verdict |
|---|---|---|
| A1 multi-provider BYOK | T1.1–T1.5 | ✅ |
| A2 real OS-level sandboxing | — | 🔴 **UNMAPPED** — ranked **#2 by value** at `103:188`; §6.1.2 refers to "landing A2" as if it existed (C7) |
| A3 global cost/token budget | T2.1 | ✅ |
| A4 finish verify-kind install | T4.1 | ⚠️ partial — install yes, but the documented "temp dir, never mutating" contract (`103:116-121`) is not in T4.1's done-when, and the claim sites are not struck (C1) |
| A5 step-level resume | T4.4 | ✅ |
| A6 streaming | T5.1 | ⚠️ (prose line, no done-when) |
| A7 git integration | T4.2 | ✅ |
| A8 deterministic replay/cassette | T5.7 | ⚠️ (prose line; and A14's stated dependency, C6) |
| A9 incremental/patch regen | T4.3 | ✅ |
| A10 review UI for diffs | T5.2 | ⚠️ (prose line) |
| A11 multi-language | T5.6 | ⚠️ (prose line; depends on A2 per `103:179` — also unmapped) |
| A12 DB/migration generation wired end-to-end | — | 🔴 **UNMAPPED** |
| A13 spec-first generation (OpenAPI as INPUT) | — | 🔴 **UNMAPPED** — note `104` §4 never lists A13 either; only 103 does |
| A14 behavioral test gen from brief | T3.2 | ✅ |
| A15 artifact provenance | T5.4 | ⚠️ (prose line) |
| A16 plugin/hook registry | T5.5 | ⚠️ (prose line) |
| A17 server-side storage/multi-tenant | T5.8 | ⚠️ (prose line; 104 marks it a product decision) |
| A18 eval scorecard as agent surface | T5.3 | ⚠️ (prose line) |

### 3.4 `103` — G1–G12 wiring gaps

| G | Mapped to | Verdict |
|---|---|---|
| G1 doc-vs-disk CLI contract (P0) | T0.9 (partly) | ⚠️ partial — verb counts yes; `README-cli` `verify-kind` "NOT landed" claim and the undocumented `fixtures` verb are not in T0.9 (C12) |
| G2 verify-kind contract mismatch | T4.1 (partly) | ⚠️ partial — see A4 (C1) |
| G3 orphan pillars (`arch-tools`, `algo-tools`, `vector`) | — | 🔴 **UNMAPPED** |
| G4 six handoff profiles ORPHAN | — | 🔴 **UNMAPPED** — `103:129-131` *"One CLI flag (`packet --profile claude-code`) or a UI button would wire all six"* — cheapest unmapped item in the set |
| G5 `fixtureApprovalGate` test-only | T3.1 | ✅ |
| G6 eval harness not agent-reachable | T5.3 | ✅ (prose) |
| G7 budget cap one seam | T2.1 | ✅ |
| G8 no LLM key validation | T0.2/T1.5 | ✅ |
| G9 over-exported headless internals | — | 🔴 **UNMAPPED** (P2; keep-or-de-export decision) |
| G10 repo-root `probe*.ts` census pollution | — | 🔴 **UNMAPPED** (P2) |
| G11 UI has no fixtures surface | T5.2 (fixture cases named) | ✅ |
| G12 doc claims six handoff vs UI-only `handoff.ts` | — | 🔴 **UNMAPPED** (same family as G4; a doc strike) |

### 3.5 `102_code_quality_signals.md` — the 12 signals

| Signal | Mapped to | Verdict |
|---|---|---|
| 1 compile + `tsc --noEmit` strict | T3.3 (catch-all) | ⚠️ swallowed — no named command in the task |
| 2 spec-anchored FAIL_TO_PASS / PASS_TO_PASS | T3.1/T3.2 | ✅ |
| 3 full suite green hermetically | T3.3 | ⚠️ swallowed |
| 4 pinned lint scoped to new code | T3.3 | ⚠️ swallowed |
| 5 security scan (secrets/SAST/CVE) | T3.3 | ⚠️ swallowed — 102:198 lists it as a *gate extension*, i.e. it deserves its own row |
| 6 complexity thresholds | T3.3 | ⚠️ swallowed (and 102 warns not to assert a Sonar "15" — `104:635` correctly carries the warning) |
| 7 duplication | T3.3 | ⚠️ swallowed |
| 8 mutation score | T3.3 / unmapped | ⚠️ 102:201 says *optional, label as test-strength*; no task, no deferral |
| 9 assertion density + oracle-strength audit | T3.2/T3.3 | ⚠️ partial — 102:193-195 names the cheapest high-value addition and where (`verify.server.ts`); no task with that done-when |
| 10 error-handling audit (Holzmann Rule 7) | T3.3 | ⚠️ swallowed — 102:196-197 calls it "nearly free" and names `compile-check.server.ts` |
| 11 build reproducibility | T3.3 | ⚠️ swallowed |
| 12 cross-family order-swapped judge (advisory) | T3.4 | ⚠️ partial (cross-family missing, C4) |

**Unmapped findings (the headline): 15.**
`100`: P0-04 (multi-job product), P1-02 (scheduler), P1-04 (harness human seat), P1-06 (P9 deploy templates).
`101`: LOW-6, LOW-7, LOW-8 (retry/Retry-After/abort-aware-sleep/served-model telemetry).
`103`: A2 (sandbox), A12 (DB/migrations), A13 (spec-first), G3 (orphan pillars), G4 (handoff
profiles), G9 (over-exports), G10 (probe files), G12 (handoff doc claim) — 8 of the 15.
`102`: 0 hard-unmapped, but 9 signals sit inside the **T3.3 catch-all** with no named command
and no done-when — treat as *swallowed*, not covered.

---

## 4. Verifiability audit

The plan's own promise (`104:667-668`): *"every 'done-when' is written so a machine can
decide it."* Measured against §5's tables: **9 of 34 tasks are cleanly machine-decidable;
25 are not.** Phase 0 and 1 mostly honour the promise; Phase 2 and 3 have **no
done-when column at all** (columns are ID/Task/Why/Where), and Phase 5 is eight prose
sentences.

### 4.1 Decidable as written (keep these — they are the model for everything else)

| Task | Instrument that decides it |
|---|---|
| T0.1 | test asserting resolved model + timeout (needs a named test file) |
| T0.4 | param + `thinking:false → 1` mapping test |
| T0.5 | test asserting the kwarg survives the facade |
| T0.6 | non-JSON-200 ⇒ `RT_E_INTERNAL` + bounded excerpt regression test |
| T0.7 | non-TTY `approve` without `--force` cannot emit `decidedBy:"human"` — a CLI test |
| T0.8 | machine approval must fail the "HITL approved" criterion — a unit test |
| T1.2 | 21 + `llm.test.ts` green + byte-parity snapshot |
| T1.5 | per-adapter fixture suites (but see 4.3 — fixtures ≠ smoke tests) |
| T1.6 | failover matrix test (after C2 is fixed) |

### 4.2 Unverifiable as written — a completion would be a judgement call

| Task | Done-when (as written) | Why it is not decidable | Instrument to add |
|---|---|---|---|
| T0.2 | *"corrected const + a `doctor` drift check (one GET); test pins the real list"* | the "real list" is a live network response — a pinned test rots and there is no named probe seam | injectable `fetch` probe + explicit stale-tolerance policy; test pins the *parser*, not the vendor's bytes |
| T0.3 | *"claim text matches live ids; suite green"* | nothing compares the string to anything | text-pin test: `phases.ts:89` must not contain `v4.1`/`vision-exp` ids and must name only ids the router can serve |
| T0.9 | *"one source of truth for the verb count; claims match disk"* | "one source of truth" is an architecture opinion; no test named | a drift test: parse every doc for `\d+ verbs?` and compare to `grep -c 'case "'` |
| T0.10 | *"fresh `results.json`; then decide whether `M1=1` is earned"* | requires a live key (plan says so honestly) + a human decision | assert an evidence-integrity rule instead: fail if the same file set evidences >1 capability |
| T1.1 | *"4 gates green, **zero runtime diff**"* | "zero runtime diff" is undefined | a test that runs the pre-existing suites with no new env and asserts no new code path is reached (or drop the phrase) |
| T1.3 | *"packets reviewed **by hand**; no non-DeepSeek run can be stamped `deepseek-*`"* | the hand review is not machine-decidable; **no legacy-hydration round-trip test is specified** | add: hydrate→re-persist of a real persisted project (`research/eval-out/*.json`) leaves `modelRoute` identical; synthetic xai run never stamped `deepseek-*` (TA-7) |
| T1.4 | *"both claims rewritten under P0-04; repo honesty contract holds"* | "contract holds" is not an assertion | grep-pin both claim strings; assert the forbidden ids/phrases are absent |
| T2.1 | *(no done-when column)* | — | `RAPIDTOOL_TOKEN_CAP=n` + one call through each of crew/verify/chat/prompt/deepen ⇒ ledger row + `RT_E_BUDGET_EXHAUSTED` on exhaustion (TA-9) |
| T2.2 | *(no done-when column)* | — | a test asserting the cap check fires **before** the HTTP call (spy on fetch: zero calls once exhausted) |
| T3.1 | *(no done-when column)* | — | fixture lane approved by a human fixture ⇒ phase advance; unchanged lane ⇒ G5 blocks, with the specific RT_E code asserted |
| T3.2 | *(no done-when column)* | — | a fixture brief whose emitted oracle asserts *observed* behaviour must be rejected; grader file absent from the generator's inputs (asserted) |
| T3.3 | *(no done-when column)* + *"pending lane 102"* | the catch-all swallows 9 signals | split into named signal tasks with commands (TA-13) |
| T3.4 | *(no done-when column)* | — | judge score cannot reach any gate path (test asserts no gate consumes it) + cross-family assertion (TA-14) |
| T4.1 | *"a fresh webapp emit's **declared build runs**"* | requires network + a real package install; baseline itself is *"predicted-not-executed"* (`104:655`) | an offline-cache/env-pinned harness + a hash assertion that the emit dir is unchanged after the run (TA-16) |
| T4.2 | *"generated product lands as reviewable units"* | "reviewable units" is not a predicate | assert: `git log` on the emitted tree has ≥1 commit, `git status` clean, `.gitignore` excludes `node_modules`/`dist` (TA-17) |
| T4.3 | *"re-emit preserves user edits"* | no test named; preservation has many meanings | fixture: edit a file, re-emit, assert the edit survives AND a conflicting edit fails loudly with an RT_E code (TA-18) |
| T4.4 | *"a crash mid-`gate` resumes without replaying the phase"* | crash injection method unspecified | kill the process at a named step boundary; assert the resume's step counter skips completed steps |
| T5.1–T5.8 | *(no done-when at all)* | eight features, no predicate | each needs a one-line command; T5.6 must choose between "multi-language" and "declare TS-only" — that choice IS the done-when |

*(Note on T1.5: fixture tests prove the mapping, not the provider. The plan says so
honestly at `104:565-567`, but the done-when does not carry that boundary — a reader can
declare T1.5 "done" with five never-smoke-tested adapters and no marker on disk. See TA-8.)*

---

## 5. Risks & unstated assumptions

**R1 — Every "configured?" gate in the engine is DeepSeek-shaped; the plan assumes
swapping the transport is enough.** Verified by this lane: `engine.ts:2740-2745`
`upgradeP6Keyed` does `const configured = … ds.isDeepSeekConfigured() …; if (!configured)
return floor;` — the **P6 keyed upgrade is skipped entirely unless a DeepSeek key exists**,
even when `RAPIDTOOL_PROVIDER=xai` and `XAI_API_KEY` is set. Same shape at
`headless.ts:213-214`, `headless.ts:1330-1331`, `headless.ts:2639` (doctor's
`DEEPSEEK_MODEL_IDS`/`isDeepSeekConfigured` import) and `doctor.ts:174-181` (per `103`
G8). `101:106` sees the gate and marks it "—" (no change) by design. **Consequence: after
T1.5 ships five adapters, a user with only a non-DeepSeek key still gets the deterministic
floor at P6 and `doctor` still under-reports.** The plan's §1.5 promise — *"a
*requested-but-unconfigured* provider floors rather than silently substituting another
provider"* (`104:224-225`) — is the right rule, but the *inverse* case
(requested **and** configured, non-DeepSeek) is not covered by any task. See TA-5.
**UNVERIFIED in this lane:** whether `store.ts`'s UI approval path (mirror at
`store.ts:1551`) or any loader other than `engine.ts:1844-1865` also reads the route.

**R2 — T1.3's provenance migration has no round-trip test, and the persisted fixtures that
exist on disk are never named as migration inputs.** T1.3 (`104:560`) covers
`types.ts:21`, `engine.ts:1844-1865`, `engine.ts:3039-3041`, `headless.ts:276-284`,
`packet.ts:106` — but its only completion evidence is *"packets reviewed **by hand**"*.
The plan itself documents real persisted projects (`research/eval-out/results.json`,
`104:303-317`) and the UI's second persistence path (localStorage +
`104:440` P7) — neither is used as a migration fixture, and the localStorage hydrate path
is not in T1.3's where-list at all. A widened `ModelRoute` that hydrates a real project to
"deterministic" (corruption path 2 in `104:257-258`) would pass every stated done-when
except the hand review.

**R3 — The flash-tier 20 s timeout does not bite P6 as written, but the plan never
actually checked, and the check was one grep away.** `deepseek.server.ts:310-311`:
`opts.maxTokens ?? (isPro ? DEFAULT_MAX_TOKENS_PRO : DEFAULT_MAX_TOKENS_FLASH)` and the
same `??` for `timeoutMs` — explicit options **win by construction**, and both P6 call
sites build an `opts` object starting at `codegen.server.ts:1406` and `:1577` with
`model: P6_SYNTH_MODEL`. So `104:129-134`'s "must be handled, not hand-waved" hazard is
mostly self-resolving; the plan could have said so. **The residual, unstated risk is the
other direction:** any call site that relies on tier defaults silently re-scales when its
model id changes — T0.1 moves only P6, but T1.x/T3.x must not hand-edit model ids elsewhere
without re-checking defaults. **UNVERIFIED in this lane:** that both P6 sites pass
`maxTokens`/`timeoutMs` explicitly (I read only the `model`/`json` head of each block).

**R4 — T0.7's blast radius is larger than its where-list, and "out-of-band evidence" is
undefined.** Verified callers of the hardcoded-human `approve()` (`headless.ts:725`, mint
line `:734`): `scripts/rapidtool-cli.mjs:527` (CLI, guarded only on the `--force` branch at
`:517`) and `scripts/run-eval.mjs:295` (`p = approve(p)`, the "eval's human seat"). The
console has its own mirrored approval (`store.ts:1551`) that never calls this function.
T0.7 names only `headless.ts:734` + `rapidtool-cli.mjs:517`. **Unstated assumptions:**
(a) the mechanism — the repo already ships `--i-am-human` for the `--force` path, and
T0.7 does not say whether that token, an env nonce, or a TTY prompt is the "out-of-band
evidence", so two lanes could implement two incompatible seats; (b) the threat model — an
agent driving the CLI in a non-TTY shell must be unable to mint a human, while a
*scheduled* unattended run (P1-02) needs a legitimate way to record "no human was
involved" without faking one; (c) nothing in §5 requires the UI/CLI/eval seats to agree on
the same predicate, which is exactly the "route **every** approval through one seat
predicate" instruction in `100:181`.

**R5 — "Autonomous" may still be false after the whole plan lands.** §4.6 (`104:518-524`)
defines the latch on five conditions, none of which is "can start itself" — and P1-02
(no cron/daemon/queue, `100:37`) has no task. So the plan can be fully executed, `doctor`
can flip `autonomousSoftwareFactory: true`, and the factory still cannot run unattended
unless a human invokes it. That is *honest* per the repo's latch definition, but §6.1.1
(`104:625-626`) then permits the phrase "autonomous software factory" at a point where a
plain-English reader would be misled. Either add the scheduling condition to §4.6 or state
what "autonomous" is scoped to mean.

**R6 — Landing mechanics are unstated and conflict with the repo's own concurrency law.**
`101:860` W4 says *"one PR each"*; the remote exists (verified:
`git@github.com:RodneyDanger1/RapidTool.git`), yet `AGENTS.md:15` still claims "NOT a git
repo" and the repo's convention for this workstream is append-only `fixes/NN_*.md` logs
(`104:659-660`). No task in §5 names a branch, a commit, a PR, or a fix-log entry.
Meanwhile `AGENTS.md` requires *"strict disjoint file ownership per concurrent wave"* while
T0.7/T0.8/T1.3/T1.4/T3.1 all edit overlapping `engine.ts` / `headless.ts` / `dod.ts`
regions — those tasks are safe only if executed **strictly sequentially**, which §5 never
says.

**R7 — The plan introduces new network dependence into a suite kept hermetic.** T0.2 (live
`/models` GET in `doctor`), T1.5 (per-provider probes) and T4.1 (`npm ci` + build) all
require network — while `AGENTS.md`'s four-gate law ("four gates green at every wave
boundary", `bash scripts/gate.sh`) is a local stability script, and `104:657-658` admits
`gate.sh` was never run in this wave. A network-dependent gate is a new flake class; the
plan should pin where these calls are allowed (T0.2's drift check, T1.5's probes) vs
forbidden (the four gates).

**R8 — T2.1's coverage list is already incomplete against the dossier that produced it.**
`103:139-140` G7 names the unmetered surfaces as *"crew / verify / chat / prompt / deepen
/ wild-reviewer"*; `104:573` T2.1 wires *"`codegen.server.ts:978-982`, `verify.server.ts`,
`crew.server.ts`, `chat.server.ts`, `prompt-engine.ts`"* — **`deepen` and the wild-mode
reviewer are dropped**, and `harvest.ts`/`llm-tasks.ts` (in `103:169` A1's touch list) are
absent. A task whose whole point is "every LLM surface" must enumerate the surfaces from a
grep (`completeDeepSeek(` call sites), not from a hand-written list.

**R9 — Phase 0's causal claim outruns its evidence.** `104:614` says *"T0.1 alone is a free
benchmark win"*; the +11.5 DeepSWE delta is a **vendor card number** (`104:64-93`), not a
measured RapidTool improvement, and the repo's own eval history moved 6/9 → 4/9 across
unrelated changes (`100:138-139`). The only artifact that can settle it is a fresh keyed
`results.json` (T0.10) — which is blocked on a rotating key and on T0.7 not breaking the
harness (C3). Phase 0 should carry that as an explicit "expected, not measured" marker.

**R10 — Two of four dossiers are parent-carried writes; the plan's own §6.2 discloses it,
but §5's task list does not carry the `🔶` markers forward.** `100`'s P1-02/03/04/06 are
`[lane-reported]` (`100:37-41`), and `104:565-570`'s own open blocker (no keys, no Ollama)
applies to exactly the adapters T1.5 must ship. An executor reading §5 alone cannot tell
which tasks rest on leads vs verified bytes. See TA-1.

---

## 6. Effort corrections

**First correction: `104` §5 has no size column at all.** The only sizes in the dossier set
are `103` §3's A-item sizes (S ≈ ≤1 day, M ≈ 2–5 days, L ≈ 1–2+ weeks, one engineer
familiar with the repo, `103:164`). 8 of 34 tasks map to a sized A-item; **26 tasks carry no
estimate anywhere.** Per-task file counts below are counted from each where-list in the
dossiers, not guessed.

| Phase | Task | 103 size (if any) | Files/surfaces touched (counted) | Corrected estimate | Why the correction |
|---|---|---|---|---|---|
| 0 | T0.1 | — | 1 + tests | 0.5 d | one-line diff, but its verification (resolved model **and** timeout **and** effort per C5) is not free |
| 0 | T0.2 | — | 1–2 + tests | 0.5–1 d | needs an injectable probe seam, not just a const edit |
| 0 | T0.3 | — | 1 | 0.25 d | |
| 0 | T0.4 | — | 1–2 + parity tests | 0.5–1 d | parity pins must be *deliberately* re-cut (`104:164-166`) — review cost |
| 0 | T0.5 | — | 2 (`llm.ts` + server-fn validator, `101:821`) | 0.5 d | |
| 0 | T0.6 | — | 1 + regression test | 0.5 d | |
| 0 | **T0.7** | — | **4–6** (`headless.ts`, `rapidtool-cli.mjs`, `run-eval.mjs`, `store.ts` parity?, tests, docs) | **1–2 d** | the seat predicate is a cross-cutting invariant; the blast radius (C3/R4) is what costs |
| 0 | **T0.8** | — | 2 + a path-walking test | **1–2 d** | the criterion must assert actor+provenance; the test walks approve→gate→DoD |
| 0 | T0.9 | — | 2–4 docs | 0.5 d | if scoped per C12 (README-cli included) |
| 0 | T0.10 | — | 0 (ops) | blocked on key | not an engineering task; correctly marked ❓ |
| **0 total** | | | | **≈ 6–9 d** | versus "smallest diff" framing (`104:534`) |
| 1 | T1.1 | (A1, L) | 1 new + tests | 1 d | design-only, zero runtime diff |
| 1 | T1.2 | | 1 new + `deepseek.server.ts` + tests | 2–3 d | router owns retry/probe/telemetry; 101 W2 gate |
| 1 | **T1.3+T1.4** | | **5–6** (`types.ts`, `engine.ts` ×2, `headless.ts`, `packet.ts`, fixtures) | **2–4 d** | packet snapshots reviewed by hand (`101:858`); add TA-7 |
| 1 | **T1.5** | | **7–9** (5 adapters + probes + `doctor.ts`) | **6–9 d** | five providers × (request/response mapping incl. Anthropic system placement, fixture suite, probe); `101:862` "one PR each" |
| 1 | T1.6 | | 2–3 | 1–2 d (moves to Phase 2 per C2) | |
| **1 total** | | L for A1 as a whole | | **≈ 12–19 d** | 103's L (1–2+ weeks) is only correct if the four-gate + hand-review discipline is included — which it is not, below |
| 2 | T2.1 | **A3 = M** | **7–9** (`token-ledger`, codegen, verify, crew, chat, prompt-engine, + deepen/wild per R8, doctor, headless envelopes) | **3–6 d** | the M is defensible only for the 5 named seams; R8 adds two more + tests |
| 2 | T2.2 | — | 1–2 | 0.5–1 d | |
| **2 total** | | | | **≈ 4–7 d** | |
| 3 | T3.1 | (A14/G5) | 3 (`brief-fixtures`, `engine.ts` P6, `headless.ts`) | 1.5–3 d | gate + producer + bridge |
| 3 | T3.2 | **A14 = M** | 3 | 2–5 d | behavioural cases from the brief + grader withholding; depends on A8 (C6) |
| 3 | **T3.3** | — | 3–5 + one module per signal | **5–13 d** | 9 signals × 0.5–1.5 d; `102` §4 ranks them precisely to allow this |
| 3 | T3.4 | — | 2–3 | 1–2 d | |
| **3 total** | | | | **≈ 10–23 d (2–4½ wk)** | the most under-estimated phase: 4 tasks, 0 done-whens, 11 signals |
| 4 | T4.1 | **A4 = M** | 4 (`compile-check`, `scaffold`, `README-cli`, CLI) | **3–6 d** | C1 turns it into install + scratch-copy + claim strikes + network policy |
| 4 | T4.2 | **A7 = M** | 4 (new `git.server.ts`, `scaffold.ts`, `headless.ts`, CLI) | 3–5 d | gated on T4.1 (`103:175`) |
| 4 | T4.3 | **A9 = M/L** | 3 | 4–10 d | patch/merge primitive over fnv1a hashes; conflict path |
| 4 | T4.4 | **A5 = M** | 5 | 3–5 d | step journaling + resume verb + type |
| **4 total** | | | | **≈ 13–26 d (3–5 wk)** | strictly sequential (shared `scaffold.ts`/`headless.ts`) |
| 5 | T5.1–T5.8 | A6 M · A10 L · A18 S · A15 S · A16 M · A11 L · A8 S/M · A17 L | 2–4 each | **≈ 25–55 d (5–11 wk)** | 3×L + 3×M + 2×S; presented as eight prose bullets with no order, no sizes, and two hard dependencies (A11→A2 unmapped; A10→A9) |

**Aggregate: ≈ 70–140 working days ≈ 4–7 engineer-months sequential for one engineer**,
against a plan whose §5 gives the reader no duration, no critical path, and (except for the
A-items) no sizes. Three further corrections:

1. **Per-phase gate cost is unaccounted.** "Each phase leaves the repo green"
   (`104:530-532`) plus `AGENTS.md`'s wave-boundary law means every one of the six phases
   pays a typecheck+lint+suite+build verification — and `gate.sh` has never been run
   (`104:657`), so the first execution may surface breakage the plan thinks is already
   green. Budget +1 day per phase, and make "run `bash scripts/gate.sh` once, before Phase 0"
   an explicit task.
2. **Phase 5 must not be presented as one unit.** T5.6 (multi-language, L) is a
   product-boundary decision, not a task; T5.8 (multi-tenant, L) is explicitly a product
   decision (`104:610`). Both should be split out of the build plan into §6's
   decision register with the rest of the deferrals.
3. **The unmapped items are not free either.** 100 P0-04 (multi-job emission) is an M/L that
   sits on the critical path to §4.6's acceptance definition; 103 A2 (sandbox) is an L. The
   plan's implicit "everything not listed is out of scope" reading understates the work by
   roughly one phase.

---

## 7. PROTECT THESE

Written for the *next editor* of `104`. Each of these is load-bearing and was verified in
this lane as genuinely present; weakening any of them converts an honest plan into a
dishonest one.

1. **Declare-or-strike applied to the plan itself** — `104:664-668` §6.3 plus the ten-item
   strike list at `104:623-640`. **And the struck-task precedent at `104:576-583`**: a task
   removed because the bytes did not support it, with the grep recorded. Adding tasks must
   never resurrect a claim without a `file:line`. If a reviewer asks you to "put T2.3 back",
   the answer is the grep at `104:579`.
2. **Byte-parity discipline** — W1's *"zero runtime diff"* (`101:856`), W2's *"no new env ⇒
   byte-identical"* (`104:559`), the 21 `deepseek.server.test.ts` tests, and the rule at
   `104:164-166`: parity pins may be changed *deliberately, never silently*. Do not let a
   task "simplify" a parity test to make a refactor land.
3. **The claims↔route coupling** — T1.3 and T1.4 in one commit (`104:261-265`, `104:615`),
   the three named corruption paths (`104:256-258`), and `modelRoute`'s status as a
   persisted, packet-published contract (`packet.ts:106`).
4. **Keyless floors, per provider, with no silent substitution** — `104:223-225`. Never let
   a provider addition turn a keyless run into a fabricated one or a fallback one.
5. **Sandbox honesty** — `runnerIsSandbox:false` everywhere, §6.1.2's wording (`104:627-629`),
   and `103` §4 item 12: `runSandboxed`'s deprecation is deliberate; do not "fix" it by
   re-wiring.
6. **The doctor latch as the single acceptance test** — §4.3 (`104:456-458`) and §4.6
   (`104:518-524`); `factoryClaim()` + the hostile-`true` coercion (`100:152-154`). No task
   may flip it.
7. **Cross-lane verification discipline** — the ✅PV / 🔶`[lane-reported]` distinction
   (`100:9-13`), and the parent's habit of re-measuring a child's claim rather than
   repeating it (MED-5, `104:202`). Keep that habit for *every* task added here.
8. **The "do not rebuild" lists** — `104` §4.3 (cost-ledger primitives, research layer,
   capability self-declaration, the latch) and `103` §4 (12 items). T1.x must not create a
   second DeepSeek client; T2.1 must extend `token-ledger.ts`, not replace it.
9. **Advisory-only judging** — `102` §2.2 + §4.6 and §6.1.5: a judge score may never pass
   a gate, and signal 8 (mutation) may never be labelled a quality score (`102:201`).
   Also keep the explicit non-citations at `104:635-639` and `102` §5 un-cited.
10. **The machine-decidable done-when promise** (`104:667-668`) — uphold it by *adding*
    done-whens to Phases 2/3/5, never by deleting the sentence.
11. **Recently-closed honesty work stays closed** — `skip≠green` / `stubs≠complete` (210),
    `dualChannelFailDetail` fail-close, the blinded judge (185-U8), and the explicit "do not
    re-open" note at `104:582-583`.
12. **§4.6's acceptance definition keeps all five conditions** — including "leftover jobs
    are gone" and "a real multi-job product". The temptation will be to drop them when
    TA-15 proves expensive. That is exactly when they matter.

---

## 8. TASKS THIS IMPLIES

23 additions. Format: **title** / why / where / done-when / phase / size.
S ≈ ≤1 day · M ≈ 2–5 days · L ≈ 1–2+ weeks (103's scale, one engineer familiar with the repo).
"UPGRADE" = not a new task row, a mandatory change to an existing task's text.

### Phase 0 (all of these are cheap; two are atomic with tasks already planned)

**TA-1 · Verify the four `[lane-reported]` blockers before tasking them** *(verification)*
- **Why:** P1-02/03/04/06 are 🔶 leads (`100:37-41`); TA-2, TA-10 and TA-21 all depend on
  them being real. R10.
- **Where:** `100:37-41`; targets `scripts/run-eval.mjs:273,295` (P1-04),
  `research/eval-out/*.json` (P1-03), repo-wide cron/daemon grep (P1-02), P9 artifact writers
  in `engine.ts` (P1-06).
- **Done-when:** each of the four carries a `file:line` or an observed command output
  **appended to a `fixes/NN_*.md` log**, with the lane's falsification attempt recorded.
- **Phase 0 · S**

**TA-2 · Give the eval harness a real, labelled seat (atomic with T0.7+T0.8)** *(net-new)*
- **Why:** C3 — T0.7's fix breaks `run-eval.mjs:295` `p = approve(p)`, which is the same
  harness T0.10 and §4.6's acceptance bar depend on. Leaving it means either the fix is
  incomplete or the benchmark dies.
- **Where:** `scripts/run-eval.mjs:42,273,286-296,295`; `src/lib/headless.ts:725-734`;
  `scripts/rapidtool-cli.mjs:517`.
- **Done-when:** after T0.7/T0.8, one keyed `npm run eval -- --keyed` completes and every
  HITL ledger row it produces carries a **distinguishable actor** (never the bare default
  `"human"`), with the out-of-band token path recorded in `README-cli.md`.
- **Phase 0 (same commit as T0.7/T0.8) · S**

**TA-3 · Extend T0.9 to every published count, and make the check executable** *(UPGRADE + net-new)*
- **Why:** C12 — `README.md:15` "1632/1632" vs `AGENTS.md:59` "src ~1179" vs `104:50`'s
  observed 1634; `README-cli.md:10` = 33 verbs; `fixtures` dispatched at
  `rapidtool-cli.mjs:825` with **zero** mentions in `README-cli.md` (`103:110-112`).
- **Where:** `AGENTS.md:15,47,59`, `README.md:11,12,15,96`, `scripts/README-cli.md:10,24-30,340-346,394-398`.
- **Done-when:** a repo script/test extracts every verb count and test count from the docs
  and compares them to `grep -c 'case "'` and the suite's reported total, exiting non-zero
  on drift; `fixtures` appears in `README-cli.md`.
- **Phase 0 (extends T0.9) · S**

**TA-4 · Co-land T0.1 with T0.4 and assert P6's reasoning effort** *(UPGRADE, atomic)*
- **Why:** C5 — the card's flash numbers are measured at `reasoning_effort` ~100
  (`104:157`), the module's flash shape is "thinking disabled" (`104:153-155`), and T0.1
  lands first with no effort assertion.
- **Where:** `codegen.server.ts:133,1406,1577`; `deepseek.server.ts:38-42,138-142`.
- **Done-when:** a test asserts P6's resolved request carries the intended reasoning effort
  (not the flash default) in addition to model + timeout, or the table records explicitly
  that the desired effort is 1 and why.
- **Phase 0 (same commit as T0.1) · S**

**TA-21 · P9 deploy-artifact honesty (P1-06)** *(net-new)*
- **Why:** UNMAPPED — `100:41` *"P9 emits canned `rapidtool-gate` GitHub-Actions YAML + a
  GCP/Firebase sketch — deploy artifacts are templates, not executed pipelines"*. Emitting
  YAML that looks runnable is the declare-or-strike class.
- **Where:** `engine.ts` P9 artifact writers; the emitted deploy files; `README`/packet copy.
- **Done-when:** each emitted deploy artifact either runs (asserted by a scratch run) or its
  body/filename carries an explicit `template — not executed` marker, with a test pinning
  the marker; the README claim matches.
- **Phase 0 · S**

**TA-23 · Plan hardening pass on `104` itself** *(plan hygiene)*
- **Why:** C11 (atomicity rules missing from §5's rules list), §4's missing done-when
  columns for Phases 2/3/5, and the never-run `gate.sh` baseline (`104:657`).
- **Where:** `104` §5 tables + §5 "Sequencing rules" (`104:612-618`); `scripts/gate.sh`.
- **Done-when:** §5 gains a **Test/done-when** column for Phases 2, 3 and 5; the rules list
  includes T0.7+T0.8, T0.1+T0.4, T4.1→T4.2, T1.3+T1.4; and one recording of
  `bash scripts/gate.sh` (pass/fail + output) is appended before Phase 0 starts.
- **Phase 0 (before any code lands) · S**

### Phase 1

**TA-5 · Provider-aware "configured" predicate — replace every `isDeepSeekConfigured()` gate** *(net-new)*
- **Why:** R1 — verified `engine.ts:2740-2745` (`if (!configured) return floor;`),
  `headless.ts:213-214`, `headless.ts:1330-1331`, `headless.ts:2639`, `doctor.ts:174-181`.
  Without this, "any provider" is false at the P6 keyed path and in `doctor`, no matter how
  many adapters ship.
- **Where:** `engine.ts:2740-2745`; `headless.ts:213-214,1330-1331,2639`; `doctor.ts:174-181`;
  the new `provider.server.ts` config predicate; `101:106` (the row that declines the change).
- **Done-when:** with `RAPIDTOOL_PROVIDER=xai` + `XAI_API_KEY` only, (a) the P6 path enters
  the keyed route and the stamped route names `xai-*`, (b) `doctor`'s `llm.configured` is
  true and names the provider, (c) with that key absent the same run floors with
  `RT_E_LLM_NOT_CONFIGURED` — all three as tests.
- **Phase 1 (must land with T1.5) · S/M**

**TA-6 · Land 101's LOW-6/7/8 in the router** *(net-new)*
- **Why:** UNMAPPED, and T1.6's done-when *depends* on LOW-8's read-back ("the served model
  read back from the 2nd provider", `104:563`).
- **Where:** `deepseek.server.ts` `RETRYABLE_STATUS` / `Retry-After` handling / the backoff
  sleep / the response object (`101:316-335`); the new router's retry policy.
- **Done-when:** tests assert 408/502/504 are retryable, `Retry-After` is honoured, the
  backoff sleep is aborted by the caller's signal, and served-model + cached-token usage
  appear on the result object.
- **Phase 1 (inside T1.2/T1.6) · S**

**TA-7 · Provenance migration round-trip fixtures** *(UPGRADE to T1.3)*
- **Why:** R2 — T1.3's only evidence is a hand review; corruption path 2 (`104:257-258`)
  would pass it. Real persisted projects exist and are unused.
- **Where:** `research/eval-out/*.json` (real projects), `src/lib/types.ts:21`,
  `src/lib/engine.ts:1844-1865`, `src/lib/io.ts` coercion.
- **Done-when:** a test hydrates ≥1 real persisted project and re-persists it with
  `modelRoute` byte-identical, and a synthetic non-DeepSeek run is never stamped `deepseek-*`.
- **Phase 1 (inside T1.3, before the hand review) · S**

**TA-8 · Per-provider probe state on `doctor`, and gate the "any provider" claim on it** *(UPGRADE to T1.5)*
- **Why:** §6.1.3 (`104:630-631`) forbids the claim *"until each adapter has been
  smoke-tested with a real key"*, but nothing on disk records which adapters are smoke-tested
  — a fixture test cannot distinguish "verified" from "never contacted".
- **Where:** `doctor.ts:174-181`; the adapter probes; `.env.example`/README.
- **Done-when:** `doctor`'s `llm` block reports per provider ∈ {configured+probed,
  configured+unprobed, absent}, and a test asserts the claim string only appears when every
  advertised provider is probed.
- **Phase 1 (inside T1.5) · S**

### Phase 2

**TA-9 · Budget: enumerate surfaces by grep, and state the default policy** *(UPGRADE to T2.1)*
- **Why:** R8 (`deepen`, wild-reviewer, `harvest`, `llm-tasks` missing from T2.1's list) +
  P1-05 (`tokenCap: null` by default, `100:40`).
- **Where:** `token-ledger.ts`; every `completeDeepSeek(` call site
  (`codegen.server.ts:978-982`, `verify.server.ts`, `crew.server.ts`, `chat.server.ts`,
  `prompt-engine.ts`, `deepen` path, `wild-mode.server.ts`, `harvest.ts`); `doctor.ts:174`.
- **Done-when:** the task's surface list is generated by a grep recorded in the fix log; a
  test drives one call through each surface and asserts a ledger row; `doctor` prints an
  explicit default cap policy (or the advisory-by-default stance) instead of `null`.
- **Phase 2 (inside T2.1) · S**

**TA-10 · Unattended invocation surface — or a written non-goal** *(net-new)*
- **Why:** UNMAPPED P1-02 + R5. Nothing in the plan lets the factory start itself, yet the
  title says "autonomous".
- **Where:** new runner entry (`headless.ts`/CLI), wild lifecycle
  (`headless.ts:3073-3187`), `watchdog.ts` (wall-clock budget), `doctor.ts` latch conditions.
- **Done-when:** EITHER a no-TTY, no-human invocation runs a brief to the next gate twice in
  a row, under the token cap, emitting the project file + NDJSON log; OR §6.1 gains a strike
  line ("not schedulable — a human invokes every run") and §4.6 says so.
- **Phase 2/3 (after T2.1/T2.2) · M/L**

### Phase 3

**TA-11 · Oracle-strength audit (signal 9) as its own task** *(net-new)*
- **Why:** `102:193-195` — *"the cheapest high-value addition"*, named target
  `verify.server.ts`, directly attacks the `2410.21136` failure mode.
- **Where:** `src/lib/verify.server.ts` (next to the existing oracle cases);
  the emitted `tests/oracle.spec.ts`.
- **Done-when:** an emitted tree is scored with counts of assert-expected vs assert-observed,
  and a fixture whose oracle asserts observed-only behaviour fails the audit with the file:line.
- **Phase 3 · S**

**TA-12 · Error-handling audit (signal 10) as its own task** *(net-new)*
- **Why:** `102:196-197` — *"nearly free and Holzmann-sanctioned"*, named target
  `compile-check.server.ts`.
- **Where:** `src/lib/compile-check.server.ts`; the emitted tree.
- **Done-when:** a fixture tree containing an empty `catch`, an unchecked non-void return and
  an unhandled rejection is detected, with each finding reported as file:line in the envelope.
- **Phase 3 · S**

**TA-13 · Split T3.3 into named signals, and defer the rest explicitly** *(net-new)*
- **Why:** §3.5 — 9 signals sit inside one catch-all row with no done-when and a stale
  *"pending lane 102"* marker (C8).
- **Where:** `104:592` (T3.3 row); `102` §3/§4.
- **Done-when:** each of signals 1/3/4/5/6/7/11 has either its own task row with a named
  command (e.g. signal 5: `secret-scan + SAST + CVE, fail on new findings`) or a §6 deferral
  line with a reason; signal 8 (mutation) is deferred with `102:201`'s label rule.
- **Phase 3 (plan edit, before Phase 3 starts) · S**

**TA-14 · Cross-family, order-swapped judge protocol** *(UPGRADE to T3.4, needs T1.5)*
- **Why:** C4 — `100:113-114` and `102:203-204` both require it; T3.4 states only the
  advisory half. Post-T0.1 the judge and producer are the *same* model.
- **Where:** `wild-mode.server.ts:32` (classifier model), the new router (T1.5), T3.4's row.
- **Done-when:** a test asserts the judge call's provider ≠ the producer's provider, that the
  order is swapped on a second pass, and that no gate path consumes the judge score.
- **Phase 3 · S/M**

**TA-15 · Emit a real multi-job product (P0-04)** *(net-new — the biggest single gap)*
- **Why:** 🔴 UNMAPPED, and it is the acceptance definition (`104:518-524`) plus autonomy
  requirement (b) (`104:322-325`). `100:184` states the fix: *"the chunk→file mapping must
  emit real per-job modules, or the job names must stop being advertised as jobs."*
- **Where:** `codegen.server.ts` chunk→file mapping (`:1401`, `:1575`),
  `engine.ts` P6, `scaffold.ts` jobs writer, `doctor --tree` inventory
  (`src/jobs/{flip,publish,record,show,track}.ts:10` today), `scaffold.ts`
  `collectJobSources`.
- **Done-when:** for the eval corpus brief, `doctor --tree` reports `reexports: 0, stubs: 0,
  real: ≥3`, and ≥3 job modules each pass their own behavioural oracle row (no shared
  implementation by hash).
- **Phase 3.5 (must precede any §4.6 acceptance claim) · M/L**

### Phase 4

**TA-16 · `verify-kind`: scratch copy + install + the claim strikes (C1)** *(UPGRADE to T4.1)*
- **Why:** C1 — measured reality is no install, `cwd = dir`, dir mutated; three published
  claims say otherwise (`scaffold.ts:473-477`, `README-cli.md:394-398`, `104:434`).
- **Where:** `compile-check.server.ts:748-778`; `scaffold.ts:473-477`;
  `scripts/README-cli.md:24-30,340-346,394-398`; `103` G2.
- **Done-when:** after one `emit --verify-kind` on a fresh webapp, the emit dir's file hashes
  are unchanged, the build ran with installed deps, and a test pins all three claim sites to
  the true behaviour (no "scratch install" / "not callable" text).
- **Phase 4 (same commit as T4.1) · S/M**

**TA-17 · Git landing detail: `.gitignore`, init, and the A4 dependency** *(UPGRADE to T4.2)*
- **Why:** `103:175` A7 *"Depends on: A4 + host git policy"* — neither appears in T4.2; and
  no `.gitignore` is emitted today.
- **Where:** `src/lib/scaffold.ts` (emit `.gitignore`/init), new `git.server.ts`,
  CLI `emit --git`, `103:175`.
- **Done-when:** an emitted tree is initialised + committed in a scratch remote with
  `git status` clean; `.gitignore` excludes `node_modules`/`dist`; T4.2 is recorded as
  blocked-on-T4.1 in §5's rules.
- **Phase 4 (inside T4.2) · S (part of M)**

**TA-18 · Apply-patch: preservation and conflict semantics** *(UPGRADE to T4.3)*
- **Why:** T4.3's done-when *"re-emit preserves user edits"* has no test and no conflict
  behaviour; `103:177` frames it as 3-way merge over fnv1a hashes.
- **Where:** `codegen.server.ts`, `headless.ts:1971` `repairTreeDir`,
  `headless.ts:1756` `importTreeDir`.
- **Done-when:** a fixture tree with a manual edit re-emits with the edit intact, and a
  conflicting edit fails loudly with an `RT_E_*` code and a diff excerpt.
- **Phase 4 (inside T4.3) · S (part of M/L)**

**TA-19 · Sandboxing: task it, or strike it (A2)** *(net-new or explicit deferral)*
- **Why:** 🔴 UNMAPPED and ranked #2 by value (`103:188`); §6.1.2 refers to "landing A2" as
  if it existed (C7); T4.1/T4.2 install and build generated code with no sandbox.
- **Where:** `node-runner.server.ts` (executor swap), `sandbox-policy.ts:21-32`,
  `doctor.ts`, `compile-check.server.ts`, `AGENT_GUIDE.md`.
- **Done-when:** EITHER a docker/bwrap/nsjail executor lands with `doctor.sandbox: true` +
  tests, OR §6.1 records the strike ("generated code is trusted-only; never run untrusted
  emits") and T4.1/T4.2 carry the matching warning in their done-whens.
- **Phase 4/5 · L (or explicit non-goal)**

### Phase 5 and the decision register

**TA-20 · Orphan pillars: wire or descope (G3, G4, G12, G9, G10)** *(net-new)*
- **Why:** 🔴 UNMAPPED — `arch-tools.ts`, `algo-tools.ts`, `vector.ts` are built + tested with
  zero production consumers; `packet.ts:639` `exportProfiles` needs *one flag*
  (`103:129-131`); `G12`'s doc claim contradicts `handoff.ts`'s UI-only reach.
- **Where:** `arch-tools.ts:221/263`, `algo-tools.ts:107/221/500`, `vector.ts:693+`,
  `packet.ts:639`, `rapidtool-cli.mjs` (new `packet --profile`), `console.tsx`,
  repo-root `probe*.ts`.
- **Done-when:** each of the four orphans has either a CLI/UI entry with a test, or a line
  in §6 stating descoped+reason; the probe files are either deleted or moved out of the
  census root.
- **Phase 5 · S/M**

**TA-22 · Explicit deferral register (A12, A13, and anything else unmapped)** *(plan hygiene)*
- **Why:** the plan's honesty depends on "not listed" meaning "deferred with a reason", not
  "forgotten". A12 (DB/migrations) and A13 (spec-first) are M each (`103:180-181`) and appear
  in no §5 row; Phase 5 has two product decisions dressed as tasks.
- **Where:** `104` §6.1/§6.2; `103:180-181`.
- **Done-when:** §6.1 lists every unmapped finding (this file's §3.2/§3.3/§3.4) as either
  "struck: reason" or "deferred to wave N: reason"; §5's Phase 5 rows carry sizes and the
  T5.6/T5.8 product decisions are moved to the register.
- **Any phase (recommend before Phase 3) · S**

---

### 8.1 Recommended footprint

- **23 additions total:** 11 net-new engineering tasks (TA-2, 5, 6, 10, 11, 12, 14, 15, 19,
  20, 21), 7 mandatory upgrades to existing tasks (TA-4, 7, 8, 9, 16, 17, 18), 5 hygiene/
  verification items (TA-1, 3, 13, 22, 23).
- **Blocking-before-Phase-1 (do not start T1.x without these):** TA-2 (atomic with T0.7/T0.8),
  TA-5 (or "any provider" is false), TA-23 (rules + gate baseline), TA-1 (to confirm the
  leads TA-2/TA-10/TA-21 rest on).
- **Critical path to §4.6 acceptance:** T0.7+T0.8+TA-2 → T1.3+T1.4 → T2.1 → T3.1/T3.2+TA-15
  (multi-job) → T0.10's fresh keyed run. Nothing else is required to flip the latch; everything
  else is quality.
- **Cost of the additions:** +8–16 working days on top of §6's ≈70–140 (TA-5 and TA-15 are the
  expensive ones; TA-11/TA-12 are ≤1 day each and are the highest value-per-hour in the set).

**One-line summary for a cold-start reader of this file.** `104` is honest, well-evidenced
and correctly prioritised, but it is not yet a spec: it drops the multi-job blocker it names
(P0-04), breaks its own machine-decidable promise in Phases 2/3/5, mis-describes `verify-kind`
as installing in a scratch dir (a comment repeating what the code does not do), breaks the
eval harness with its own P0 fix (run-eval.mjs:295), and leaves 15 of 66 sibling findings
unmapped — chief among them sandboxing, scheduling, and the retry/telemetry LOW-items. Land
T0.7+T0.8 **with TA-2**, add TA-5 with the adapters, add TA-15 before claiming acceptance, and
do not weaken §7.
