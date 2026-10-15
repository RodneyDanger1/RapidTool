# fixes/355 — the W355 audit/freeze wave (skeleton-first)

**Lane:** W355 parent (this session). **Repo:** `C:\Users\mnril\Desktop\RapidTool Main` (path contains a
space). **Host:** Node **v24.15.0** (contract requires ≥22 — stated plainly; the frozen gate of record
was not re-derived on 22).
**HEAD:** `30bce78b84903d2d64a84c4902c732f40bd14a29` (`main`) for the whole wave — **dirty tree**, no
commit was made, so every number below describes **the bytes on disk**, not a frozen commit.

**Wave kind:** audit/freeze. **Read-only, 9 lanes** — 6 code reviewers + 2 bug inspectors +
1 architecture agent, dispatched in two batches (355: the mandated 3 reviewers + 2 inspectors +
1 architect; 355b: 3 gap-filling reviewers, added mid-wave to cover the unaudited foundation, proof
layer and self-improvement substrate). No product file is edited by this wave.

---

## 0. Baseline captured before dispatch (parent, re-runnable)

```
cd "C:\Users\mnril\Desktop\RapidTool Main"
git rev-parse HEAD                 # 30bce78b84903d2d64a84c4902c732f40bd14a29
git status --porcelain             # 98 modified · 32 untracked   (git stash list = empty)
npx tsc --noEmit                   # exit 2 · 5 errors in 3 test files
npm test                           # exit 1 · 622 tests · 607 pass · 15 fail  (src leg never ran)
node --experimental-strip-types scripts/rapidtool-cli.mjs doctor    # ok:true · factory flags false
node scripts/prevention/verify-prevention.mjs --all --selftest      # exit 1 · guards 34/34
(Select-String -Path scripts/rapidtool-cli.mjs -Pattern '^\s*case "').Count   # 39 verbs
```

**Safety net (non-destructive, taken before anything else touched the tree):**
`C:\Users\mnril\AppData\Local\Temp\rt-campaign\` holds `baseline-working-tree.patch` (3,081,992 bytes),
`baseline-status.txt` (98 entries), `baseline-untracked.txt` (32 entries), `baseline-stash.txt` (empty),
`head.txt`, and `npm-test-baseline.log` (191,575 bytes).

### Baseline in one table

| Signal | Value | Note |
|---|---|---|
| HEAD / branch | `30bce78` / `main`, dirty | the "354 wave" work is uncommitted |
| Modified / untracked | 98 / 32 | never boundary-verified |
| `tsc --noEmit` | **exit 2**, 5 errors | 3 test files: `headless.test.ts`, `scaffold.test.ts` ×2, `wild-step.test.ts` ×2 |
| `npm test` | **exit 1**, 622 tests · 607 pass · **15 fail** | src leg **never ran** (`&&` chain blocked by leg 1) |
| `doctor` | `ok:true` | `llm.configured:true` (`keyState:"unverified"`) · `runner.available:true` · `isolation.sandbox:false` · `autonomousSoftwareFactory:false` · `autonomousFactoryV2:false` |
| `RT_E_LLM_KEY_SHADOWED` | raised | a stale User-scope `DEEPSEEK_API_KEY` loses to the repo `.env` key (owner action, not a code defect) |
| prevention guards | **34**, `countFloor:34` | `fixtureIntegrity.missed:["C-06"]` · `fixPresence.pending:["C-14"]` · everything else fired |
| CLI verbs | 39 | matches the documented count |
| Node | v24.15.0 | dev host; the repo's `engines` contract is `>=22` |

**Honest statement of state:** the tree on disk does **not** pass its own gates. 100%-functional work
starts from a red baseline.

---

## 1. Wave 0 roster (read-only)

### 1a. Batch 355 (the original 6 lanes)

| Lane | Kind | Deliverable |
|---|---|---|
| `reviewer-pipeline` | code reviewer 1 | `research/multiagent/355_1_review_pipeline.md` |
| `reviewer-synthesis` | code reviewer 2 | `research/multiagent/355_2_review_synthesis.md` |
| `reviewer-surfaces` | code reviewer 3 | `research/multiagent/355_3_review_surfaces.md` |
| `inspector-correctness` | bug inspector 1 | `research/multiagent/355_4_bugs_correctness.md` |
| `inspector-integrity` | bug inspector 2 | `research/multiagent/355_5_bugs_integrity.md` |
| `cartographer` | architecture | `research/multiagent/355_6_architecture_map.md` |

### 1b. Batch 355b (the gap-filling 3 lanes — added mid-wave at the owner's direction)

Added after inspecting the batch-355 scopes for **unaudited areas**. The mapping, showing which part of
the tree each new lane takes that no batch-355 lane owns:

| Lane | Kind | The gap it fills | Deliverable |
|---|---|---|---|
| `reviewer-platform` | code reviewer 4 | **the foundation** — persistence/state, `src/lib/auth/**` (19 files, never audited), app-data, migrations, credential precedence, the model-provider seam (`src/lib/llm/**`, `deepseek*`, `cassette`, `token-ledger`), write-safety primitives, build/deploy/launch config | `research/multiagent/355_7_review_platform.md` |
| `reviewer-proof` | code reviewer 5 | **the proof layer** — the 34 prevention guards + replay harness, `scripts/guards/**`, `gate.sh` stages, assertion-gap lint, skip registry, `run-eval.mjs`, the eval corpus + graders, and test-suite honesty ("who audits the auditors") | `research/multiagent/355_8_review_proof_layer.md` |
| `reviewer-selfimprove` | code reviewer 6 | **the self-improvement substrate** — `selfmod*`, knowledge/vault/harvest/compaction, the scoring & evaluation algorithms (`bench`/`iterate`/`maker-score`/`scorecard`/`judgment`/`algorithms`), the agent runtime (`crew`/`swarm`/`subagent`/`handoff`/`wild-*`/`mcp`/`plugin`), telemetry purity & runtime bounds (`rt-*`/`exec`/`sandbox*`/`bounded-int`), and the end-to-end project-`kind` coverage matrix | `research/multiagent/355_9_review_selfimprove_runtime.md` |

Each 355b lane was briefed to read the six batch-355 dispatch notes and every landed sibling report
first, and each carries an explicit **"do NOT duplicate these"** list. Total: **9 read-only lanes.**

Dispatch notes: `wave_plans/W355/*.md` (9 files, authored by the parent before each dispatch).

---

## 2. Consolidated ledger

**Read this section as the wave's verdict.** Every line is either (a) a command the parent ran, (b) a
lane finding the parent re-derived, or (c) a lane finding the adversarial panel confirmed — and anything
the panel **refuted** is marked REFUTED and is not to be acted on.

### 2.0 What the wave found, in one paragraph

The tree is red for reasons that are **not** cosmetic, and the single most serious discovery is not a
crash but a **measurement-integrity failure**: an uncommitted reader change (`A2-F3`) doubled the
substantive-tree rate from 6/13 to 13/13 **with zero change to any product**, and in doing so silently
disarmed a prevention guard (`C-06`). The repo's proudest delivery metric ("0 empty-substance commits")
stays trivially true for a second reason: an oracle-emitter change makes emissions that carry an unwired
row fail their own tests, so `emit --git` withholds. And the documented `underProduced:"refuse"` safety
policy is **inverted** — a caller asking for "refuse" still gets files on disk, with the repo's own test
failing. Separately, the autonomy/self-improvement substrate that this campaign is meant to strengthen
is **unreachable**: no agent bus exists, no seat schedules another seat, function-calling is unused, the
six self-modification entry points have zero production callers, and the bounded improvement driver
(`iterateToSatisfaction`) has no production caller at all.

### 2.1 P0 — measurement integrity (CONFIRMED by the panel)

| id | Finding | Evidence |
|---|---|---|
| **L1** | The whole-tree substance census (uncommitted `fixes/354 A2-F3`) makes a tree with **zero generated product** read as real: a scaffold-only project (`src/main.tsx` + `src/styles.css`) reads `verdict:"real", real:2`, where HEAD's job-scoped reader read `empty` | panel probe; `src/lib/compile-check.server.ts:772-790` (WT) vs HEAD |
| **L2** | On the pinned 13-tree corpus, job-scoped (=HEAD) `real` = **6/13**; whole-tree non-empty = **13/13**. **46% → 100% with no product change.** Nuance the panel added: no tree reads the literal `"real"` post-change — they read `"mixed"`, so the honest metric is the *non-empty* rate | panel re-derivation over the corpus |
| **L3** | **C-06's defeat is the same change, not a separate defect**: the substance driver fires only on `verdict==="empty"`, and no tree is `empty` any more → `fired=false` → `fixtureIntegrity.missed:["C-06"]` | `verify-prevention.mjs` output + `replay-harness.mjs` driver |
| **L4** | The acceptance record the CLI consumes carries `stale:true`, and the parser **drops** the flag (`parseEvalResults` output has no `stale`), so a stale reading is consumed as current | panel live probe; `rapidtool-cli.mjs:3363` |

**Why this is first:** every later "the product improved" claim depends on these readers. Fixing the
product before fixing the measurement would let a reader edit masquerade as progress.

### 2.2 P0 — delivery is structurally blocked (CONFIRMED, with the absolutes REFUTED)

| id | Finding | Evidence |
|---|---|---|
| **L5** | The uncommitted oracle emitter replaced `test.skip` with a reachable `assert.fail("<id> is NOT IMPLEMENTED")` for unwired rows, so an emission carrying an unwired row fails the emitted tree's own `npm test` (measured: `not ok 10 - orc-phase`, `# pass 9 # fail 1`, exit 1) | HEAD `test.skip`=14/`assert.fail`=5/`skipDominated`=6 → WT `test.skip`=4/`assert.fail`=7/`skipDominated`=0; panel emit+run |
| **L5b** | **REFUTED:** "no emission can EVER be green". A *complete* keyless run (`runHeadless(seed, ALL_PHASES)`) emits **15/15 pass**. The regression is **conditional** on an unwired A7 row — so "`--git` always withholds / `factory-watch` never delivers" is an over-generalization and is struck | panel emit+run |
| **L6** | `underProduced:"refuse"` is **inert**: the WT `scaffold.ts` default flipped to `"partial"` while `headless.ts` forwards the option only for `"banner"`, so the default and the explicit-refuse path both materialize a below-floor partial. The repo's own test fails (`default refuses before writing` → `true !== false`), and a probe materialized 13 entries | panel probe; `scaffold.ts:8535-8536` (HEAD `:4141` default = refuse); `headless.ts:2838` |
| **L7** | The CLI/headless surface neither reports nor banners a synthesis PARTIAL, while the console's `software-export` does — the "never a silent partial" contract holds on one surface only | `headless.ts:2834-2838` vs `software-export.ts:105-122` (`reviewer-synthesis` R-02) |

**Corrected framing:** the honest statement is *"a partial emission cannot be green, and a partial is
emitted even when the caller asked for refusal"* — not *"nothing can be emitted"*.

### 2.3 P0/P1 — the proof layer (CONFIRMED, with one lane error corrected)

| id | Finding | Evidence |
|---|---|---|
| **L8** | The prevention harness's entire fixture basis `testruns/` (**325 files**) is **untracked**: `git ls-files testruns` → 0, `git status --porcelain testruns` → `?? testruns/`. The README claims it is tracked and green on a clean checkout — a clean checkout cannot reproduce a green harness | parent + panel |
| **L9** | `scripts/prevention/cassettes/guard-floor.json` — the "REVIEWED, immutable" floor — is **untracked** (`??`, absent from `git ls-files`) while every sibling cassette is tracked | parent + panel |
| **L9b** | **REFUTED (lane error):** the claim that this file contains `{countFloor:1, guardIds:[]}` and "collapses the floor onto the mutable registry" is **false**. The bytes are `"countFloor": 34` with all **34** `guardIds`, and a missing floor is a hard `guard-floor-missing` failure with **no** registry fallback | parent read; panel confirmed |
| **L10** | `C-14` is **permanently pending**: its "keyless floor" control is built from `testruns/office-stock-tracker/build.json`, whose own logs carry `p6.synthesis.attempt` ×6 + `p6.synthesis.refused` ×2, so the fail-closed `p6-arch` probe returns `false` for the control too → `mutationRed` can never be true. `scripts/guards/gate-invariants.test.mjs:207` asserts the same unsatisfiable condition | panel live probe |
| **L11** | Three of the campaign's proposed ratchet metrics are **gameable**, now measured: the substantive-tree rate (L2, a reader edit), the acceptance `ok` rate (keyed cap = 1 case; the grader freeze is in-run only, so a grader-JSON edit flips a case green; the stale flag is dropped), and the guard `missed`/`pending` count (disarmable by editing untracked fixtures). **REFUTED (lane error):** "`--limit=1` picks the cheapest case" — entry selection is `readdirSync().sort().slice(0,cap)`, alphabetical, with no cost ordering | panel; `run-eval.mjs:3285`, `listCorpusEntries()` |
| **L12** | `guard-floor.json`'s untrackedness + the untracked 325-file fixture basis are a **single owner decision** (commit them or declare the harness non-reproducible-from-a-clean-checkout) — the parent cannot commit (decision A) | parent |

### 2.4 P1 — surfaces, platform, provider

| id | Finding | Evidence |
|---|---|---|
| **L13** | **17 real `createServerFn` invocations across 10 files, exactly ONE guarded** (`.middleware([authMiddleware])` at `src/lib/auth/account.ts:29`; the parent's raw grep said 19/12 — the panel corrected it: `client.server.ts:278` is a string literal, `auth/middleware.ts:14` a doc comment). **Honest scope:** *not* exploitable by default (`VITE_AUTH_ENABLED=false` → deliberate single-user `dev-user`); **exploitable when auth is enabled**: the root route gates routes but the 16 unguarded endpoints have no session check, so an unauthenticated client reaches `exec.ts` code execution and LLM key spend | parent + panel |
| **L14** | `doctor --project <file>` is refused as an unknown flag although the arm consumes it — breaking a pre-existing test (E-25) | `rapidtool-cli.mjs:275-285` vs `:1419`, `:5731` (`reviewer-pipeline` F-03) |
| **L15** | The provider returns `ok:true` for a reply whose `finish_reason` is `"length"`, and `LlmResult`'s ok-arm cannot carry a truncation note. **Severity REFUTED (lane error):** P6 does *not* silently accept truncated JSON — `parseSynthesisEnvelope` re-detects it via `jsonScan` and refuses/re-asks | `deepseek.ts:705,712-718,742,749-751`; `llm.ts:62-70`; panel found `codegen.server.ts:7180-7208` |
| **L16** | Reasoning tokens are never accounted; two contradicting `/models` live-verification claims; a secret-shaped literal sits in a non-`.server` module; `write-set` accepts Win32 reserved/aliased names | `reviewer-platform` F-04/F-08/F-10/F-06 |
| **L17** | The key-resolution precedence matrix **holds 12/12** across the four documented cases × the three surfaces (`.env` wins with a differing ambient; present-but-blank = keyless; identical = no conflict; absent → `.env`) — a genuine strength | `reviewer-platform` §precedence, probe over `resolveApiKey`/`resolveProcessKey` |

### 2.5 The campaign's own subject: orchestration, bus, tool use, self-improvement

| id | Finding | Evidence |
|---|---|---|
| **L18** | **A per-project message bus does not exist.** Parent-verified independently: zero matches for `messageBus\|MessageBus\|mailbox\|pubsub\|messageQueue\|outbox` across non-test `src/**`. The telemetry currency physically cannot carry a message (≤8 flat keys ≤160 chars, redacted, never parsed) | parent query; `cartographer` §2 |
| **L19** | **No seat ever schedules another seat.** "Who next" is only `currentPhase + 1` and `roles[idx + 1]`; `crew.server.ts:539` is explicitly a non-LLM router | `cartographer` |
| **L20** | **Function calling is unused.** Parent-verified independently: `tools`/`tool_choice` → 0 matches in both provider bodies, though the API supports it (`research/deepseek-api.md` §4e) | parent query; `cartographer` §4 |
| **L21** | **Context assembly is wildly uneven:** P6 synthesis gets 60,000 chars / 32,000 tokens; the judge that decides phase progress gets 6,000 chars in / **320 tokens** out; the run planner gets **three lines**; oracle generation passes **no `maxTokens`** at all | `cartographer` §3 (`codegen.server.ts:292,184`; `wild-mode.server.ts:42`; `headless.ts:6589-6593`; `verify.server.ts:1857`) |
| **L22** | **Self-modification is unreachable:** all six `selfmod.server.ts` entry points have zero production callers and the 39-verb CLI has no `selfmod` arm — the guardrails are real, nothing reaches them. A hostile brief cannot reach a selfmod/git/patch write | `reviewer-selfimprove` SI-01 + panel CONFIRMED |
| **L23** | **The learning loop is open at the join:** the *injection* half is genuinely closed (lesson → `selectLessons` → P6 prompts), but curation (consolidation/demotion/pressure) is test-only, the defect→repair class loop is test-only (its header claims prompt injection — itself a finding), nothing reads `eval-out/results.json\|history.json` back into any prompt, and `iterateToSatisfaction` (the bounded improvement driver) has **no production caller** | `reviewer-selfimprove` + `cartographer` B-4; **parent-verified**: `iterateToSatisfaction` appears only at `iterate.ts:315` + `iterate.test.ts` |
| **L24** | Learning is **failure-only at the run level** (`runSummaryLesson` returns `null` on a clean run), while success *is* learned at the verify level (`verifyOutcomeLesson("passed")`) | `reviewer-selfimprove` Q2 |
| **L25** | **Scoring is partly hollow-earnable:** `maker-score`'s behavioral branch is dead in production (the only `scoreMaker` call passes no `behavioral`), leaving identifier-substring scores. **REFUTED (lane error):** M2 is a green tree-run verdict, not a token scan | `reviewer-selfimprove` SI-02 + panel corrections |
| **L26** | `judgePhase` has no caller; `compaction`/`plugin`/`arch-tools`/`vector` are dead; 38 event names are declared and never emitted; the engine does not guard its own telemetry sink (telemetry purity is producer-provided, not engine-enforced) | `reviewer-selfimprove` SI-04…SI-14 |
| **L27** | **Kind coverage is thinner than claimed:** every kind has a real per-kind emit path, but tool/service/library each have **one** corpus case and all three failed their own `tsc` at the last measurement. Claimed-but-unproven: **tool, service, library** | `reviewer-selfimprove` §kind matrix |

### 2.6 Documentation truth (the honesty layer)

| id | Finding | Evidence |
|---|---|---|
| **L28** | **19 of 34 checkable claims are stale or false**, each at its own newest count block: `AGENTS.md:243-246` (2,014/256/244/107/761), `README.md:454-456`/`:634`/`:730`, `docs-FOLDER-MAP.md:18-20` (1,933/…/49). Only `START-HERE.md` was refreshed by the 354 wave | `inspector-integrity` |
| **L29** | `AGENTS.md:347-348` is **false and unstruck**: "`resumeAccepted` is not yet consumed by codegen (`grep … = 0`)". Parent-verified: **7 hits** in `src/lib/codegen.server.ts` | parent: `(Select-String … 'resumeAccepted').Count` → 7 |
| **L30** | **13 live `RT_E_*` codes are raised but undocumented** in `ERROR_CODE_DOC` (4 in `selfmod.ts`, 4 in `runlock-preflight.mjs`, 2 in `readme-parity.mjs`, 1 in `factory-watch.mjs`); documented-but-unraised = 0. This contradicts `AGENTS.md:105-106` | `inspector-integrity` |
| **L31** | The register's own protocol header still says "NO KEYED CALLS (the DeepSeek account is unfunded — all calls 402)" while the repo's own corrections record the account as funded and the key as working. Parent-verified by reading the header. **A stale rule in the file that governs the audit itself** | parent |
| **L32** | The register's own mission statement defines exactly this campaign's standard ("truly autonomous software factory", "GOOD code", "any kind of software", "continuously improve", "perfect UI/UX") — useful as the campaign's north star, and notable that the user's brief echoes it | parent |

### 2.7 The red baseline, classified (`inspector-correctness`)

- **Of the 20 red items: source-wrong 14 · test-wrong 6 · environment 0.**
- **Test-wrong (all drift, dirty tree only):** the 5 type errors — `headless.test.ts:5999` (`steps?: number`
  is optional by design), `scaffold.test.ts:2712/2719` (no union narrowing in `okFiles()`),
  `wild-step.test.ts:1399/1415` (the `wildFixture` helper is narrowed to 3 of 6 `PhaseStatus` values) —
  plus test **367** (its `keylessNoTree` fixture keeps 8 `p6.synthesis.*` rows, newest `refused`, so it is
  not the keyless floor it claims).
- **Source-wrong:** 163/164 (stale `src/lib/auth/*` allowlist), 204/216/217/246 + 345/407/415 (L1/L5:
  the emitter and the census), 233 (a hard-coded `capture:"…:455"` vs the real site at `:519`), 208 (a
  new `terminalStatusOf` renaming `summary.status`), 585 (a new `TS2339` in the typecheck ratchet), 586
  (red only because leg 1 has the 5 errors).
- **Highest risk:** the oracle emitter (L5) — with the census switch (L1) it is why `emit --git` cannot
  deliver. **F-06 note:** C-06's defeat is masked in production by the red-tree circuit breaker.

### 2.8 Corroborations and strengths (do not break these)

- Key-resolution precedence **12/12** across all four documented cases × three surfaces (L17).
- Seat provenance and cost honesty are **genuinely honest and test-pinned**: no machine path mints
  `decidedBy:"human"`; `fleetMetrics.estimatedCostUsd` stays `null` with an alarm.
- Telemetry purity **holds in practice** (bounded 200-row/64 KB ring, redacted rows, never-throwing
  producers) — the gap is that the engine does not *enforce* it (L26).
- Self-modification's guardrails are real and fail-closed; the defect is the missing driver (L22).
- `reviewer-selfimprove` ran **643 tests across 23 scope suites → 634 pass / 0 fail / 9 skipped** — those
  areas are green.
- The redactor whitespace bug reported in `wildmode-diagnosis.md` is **fixed** on the bytes
  (`node-runner.server.ts:449-452`, `apiKey.trim().length > 0`) — two lanes independently refuted the
  stale claim. The parent's Wave 0 brief repeated it; **that brief was stale and is corrected here.**
- `productQuality.quality` is string-presence-based (disclosed, not hidden) and its 0/10 bar is real.

## 3. Verification panel

Two fresh read-only subagents re-derived the highest-severity claims adversarially. Reports:
`research/multiagent/355_V1_verify_emission_census.md`, `research/multiagent/355_V2_verify_proof_security.md`.

| Claim | Verdict |
|---|---|
| Census switch doubled the substantive rate with no product change; C-06's defeat is causal | **CONFIRMED** |
| Oracle emitter makes a partial emission fail its own tests | **CONFIRMED**, but "never green" **REFUTED** (a complete run is 15/15) |
| `underProduced:"refuse"` is inert (refuse still writes) | **CONFIRMED** |
| `testruns/` untracked (325 files) while the README claims tracked+green | **CONFIRMED** |
| `guard-floor.json` untracked | **CONFIRMED** |
| `guard-floor.json` is `{countFloor:1, guardIds:[]}` / collapses onto the registry | **REFUTED** — it is `34` + 34 ids, and a missing floor is a hard failure |
| 17 real `createServerFn` sites, 1 guarded; not exploitable by default | **CONFIRMED** (count corrected 19/12 → 17/10) |
| `finish_reason:"length"` returns `ok:true` | **CONFIRMED** as bytes; **severity REFUTED** (P6 re-detects truncation) |
| Eval `ok` rate gameable (1-case cap, in-run-only grader freeze, dropped `stale` flag) | **CONFIRMED** |
| "`--limit` picks the cheapest case" | **REFUTED** (alphabetical, no cost ordering) |
| C-14 can never pass (unsatisfiable control) | **CONFIRMED** |
| `selfmod` has zero production callers; `maker-score` behavioral branch dead | **CONFIRMED**; "M1/M2 are substring scores" **partly REFUTED** (M2 is a tree-run verdict) |

**Panel discipline note:** four lane overclaims and one non-discriminating probe (`orc-phase` reads 0 in
both HEAD and the working tree, so it proved nothing) were caught before any fix was dispatched. The
parent also repeated one stale claim from a prior diagnosis doc; it is corrected at L"strengths" above.

## 3b. Register append

The consolidated block above was appended to `research/multiagent/thoroughanalysis.md` above its
end-of-file marker (append-only, UTF-8-safe splice), citing the nine lane reports and the two panel
reports as its evidence base.

## 4. What this wave did NOT do

- No product file was edited; no test was changed; no doc was changed.
- No `gate.sh`, `npm run build`, or full `npm test` was run by a lane (the baseline was captured once by
  the parent and shared as a log).
- No keyed LLM call was made — **zero spend this wave**.
- No commit, stash, checkout, or revert.
