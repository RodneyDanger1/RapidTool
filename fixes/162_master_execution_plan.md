# 162 — MASTER EXECUTION PLAN (complete, dependency-ordered, self-contained)

> Authored 2026-09-09 · planning-only · every anchor re-read against the live tree this
> session · research sources: fixes/155_web_functional.md (~30 URLs), fixes/158_s1/s2/s3.md
> (~30 URLs), plus fresh fetches this pass (LiteLLM spend-tracking, OpenHands). The tree was
> **green 1447/1447 · typecheck 0 · lint 0 · build 0** at plan time.
>
> **This document is the single source of truth for what remains.** It is written to be
> handed to a fresh model with zero context: read it top to bottom, execute in phase order,
> gate after every phase, and never claim a phase is done unless its "done ==" clause holds.

---

## 0. The honest bar (read first — everything else serves this)

**Functional correctness = the produced artifact passes executable, brief-derived,
input→output fixtures that the producer did not author and did not see, applied by an
external harness** (HumanEval / SWE-bench / SWE-bench-Live / Terminal-Bench all define it this
way — fixes/155_web_functional Q1).

Two corollaries that are NOT optional:
1. **A brief alone cannot be the oracle** — real briefs underspecify intent (OpenAI's human
   annotation filtered 68.3% of SWE-bench for underspecified statements/unfair tests). The
   machine DRAFTS acceptance fixtures, a HUMAN APPROVES them, the machine EXECUTES them.
2. **Self-authored tests are a measured overfitting liability** (arXiv 2511.16858: refining
   against auto-generated tests RAISES overfitting 21.8%→25.5% Claude / 33.0%→35.9% GPT-4o).
   The fixture suite must be frozen BEFORE the run and never rewritten by the synthesizer.

The factory's terminal claim is therefore **not** "9/9" — it is: *"the shipped artifact passes
human-approved, brief-derived acceptance fixtures, executed by a harness the producer never
authored."* Every phase below exists to make that sentence true and to make a non-LLM floor
incapable of producing it.

---

## 1. Verified current state (what is already landed + green)

Green 1447/1447 at plan time. Landed and verified:
- 13-phase governed pipeline; deterministic state machine owns transitions (LLM is content-only).
- Kind-scoped chunked synthesis + liveLayer kind-stamp; **empty-content fix** (thinking:false on
  the json-envelope synthesis — reasoning tokens shared the max_tokens pool and starved content;
  now the LLM actually produces code — last keyed run emitted a real ~38 KB module).
- Resilient LLM retry (full-jitter backoff, injectable seams), claim gates (`verifyClaims`),
  diff-aware reviewer context (`treeReviewContext`), chat/instruction honesty fixes.
- Scorer-vacuity fix (`synthesisSucceeded=false` → M1–M4 = 0; a refused run scores 5/9, not 9/9).
- Oracle-foundation (just landed): `brief-fixtures.ts` pure fixture core (types + deterministic
  drafter + shape validator + approval gate, 20/20), E-08 seam wired (`buildOracleCasesPrompt`,
  `droppedPinnedOracleIds`, `generateCases` seeds + rejects dropped pinned ids), journey
  convergence honesty (`driveP6Journey` converges only on `gate.passed && treeRun.ok`),
  multi-file expansion (capability scope drives type-signature count).
- The deterministic floor is HONEST (it says "I validate phase bookkeeping only, I never
  implement the brief") — but it is a no-op, and its oracle asserts the no-op.

**What is still FALSE at plan time:** no gate executes the shipped artifact against a
brief-derived behavior expectation. The floor can still be scored as "running green" because its
own self-tests pass. That is the gap Phase A closes.

---

## 2. The complete remaining work — dependency-ordered phases

### PHASE A — The behavioral oracle (the keystone; fixes/160 W1–W6)

Turns "green" into "the produced functions pass human-approved, brief-derived input→output
fixtures executed by the harness." Every later phase depends on this.

**A1 — Persist fixtures on the Project.**
- What: additive `acceptanceFixtures?: BriefFixtureCase[]` (+ `acceptanceApprovedAt?: number`) on
  `Project`; hydrate + io sanitizer coercion.
- Why: fixtures need a canonical, persisted, import-safe home before anything emits them.
- Where: `src/lib/types.ts` (Project ends ~:388); `src/lib/engine.ts` hydrate (mirror the
  `generatedTree` normalization + `treeRepaired` token); `src/lib/io.ts` `sanitizeImportPayload`
  (mirror the `generatedTree` item-level coercion, token `acceptanceFixtures:dropped`).
- How: add type → hydrate maps each element through `validateFixtureCase` (drop-invalid-with-token,
  never half-apply) → io sanitizer arm → round-trip unit test.
- Done ==: `acceptanceFixtures` survives import/export/hydrate unchanged; a malformed imported
  fixture is dropped with the token; legacy payloads (no field) serialize identically (absence,
  not `[]`).
- Bugs: forgetting the io sanitizer (import crash); hydrate mutating in place (copy, don't mutate);
  breaking byte-parity for legacy payloads.

**A2 — Emit fixtures + a behavioral runner spec.**
- What: new `emitOracleSpec` branch (scaffold.ts:986) that, when the project has ≥1 APPROVED
  fixture, writes `tests/fixtures.brief.json` + `tests/brief.spec.ts` (imports the tree entry,
  reads the fixtures, for each `pure` case calls the mapped function with `given` and asserts the
  `expect` descriptor).
- Why: the first time the shipped tree carries an executable acceptance suite importing the real
  produced code and checking real input→output.
- Where: `src/lib/scaffold.ts` `emitOracleSpec` (:986-1330) + `OracleSurfaceCtx` (:851-868); add a
  pure `compileFixtureAssertion(case)` to `src/lib/brief-fixtures.ts` (closed descriptor whitelist:
  `shape`→`assert.deepEqual`, `throws`→`assert.throws(..., /pattern/)`, `property`→registry lookup;
  `given` always JSON-stringified, never raw-interpolated).
- How: `fixtureOk = every(f => f.approval === "approved")` guard; when false, emit byte-identical
  (preserve the fixes/150 parity pin); when true, emit JSON + the spec under `tests/` (so
  `treeRun`'s `node --test` picks it up).
- Done ==: a project with ≥1 approved fixture emits both files; `npm test` in the emitted dir runs
  the fixture assertions against the real entry; a project with 0 approved fixtures emits
  byte-identical output.
- Bugs: partial approval (the `every` guard is mandatory); injection via `given` (a value like
  `"); process.exit(1); //` must be JSON-escaped, never interpolated); `.tsx` entry import (reuse
  `tsImportPath` + `/\\.ts$/` guard, never import `.tsx`); spec must live under `tests/`.

**A3 — Execute the data layer (no more "UI-shell skip" for the logic).**
- What: `treeRun` (compile-check.server.ts:271-285) keeps the honest DOM skip BUT adds a
  `dataEntry` execution — when a `.ts` headless entry exists (the assembled `src/generated.ts`
  / hosted job module), import it and report pass/fail. Add `dataEntry?: TreeEntryVerdict` to
  `TreeRunOutcome`.
- Why: the audit's chain-link 11 is "treeRun STUB — entry never executed." The DOM shell is
  honestly skipped, but the data layer carries the brief's logic and is executable.
- Where: `src/lib/compile-check.server.ts` treeRun + entry resolution (~:299-330); `TreeRunOutcome`
  (:271-285).
- How: when kind is webapp/game AND a `.ts` data entry exists, run BOTH the honest `skip` (UI
  shell) AND the data-entry import under the bounded runner; keep existing fields (`ok`,
  `testsPass`) so `maker-score` `m2Runs` doesn't break.
- Done ==: a webapp with a `.ts` data entry reports `run: skip (UI shell)` + `dataEntry: pass`;
  `TreeRunOutcome.ok` requires the data entry to load when one exists; pure-DOM tree unchanged.
- Bugs: importing a `.ts` entry that drags in react/DOM (gate on known-headless entry, never a
  blanket import); changing `TreeRunOutcome` shape breaks `m2Runs`; unbounded import (reuse the
  30s `runNodeBounded`).

**A4 — Re-key M1/M2 on behavioral pass.**
- What: when approved fixtures exist, M1 substance = "all approved fixture cases pass"
  (not identifier presence); M2 = `treeRun.ok` AND fixture spec green with ≥1 assertion; add
  `behavioral?: { cases; passed; failed[] }` to `MakerScoreInput`.
- Why: M1/M2 currently measure identifier stems (M1) and compile/self-test (M2); for the scorecard
  to mean "functional" they must key on the behavioral suite when it exists.
- Where: `src/lib/maker-score.ts` `m1Substance` (:274-321), `m2Runs` (:324-345); `MakerScoreInput`
  (:112-134); `scripts/run-eval.mjs` (compute `behavioral` from the treeRun TAP of
  `tests/brief.spec.ts`, never from a model-fabricated log).
- How: pass the fixture-spec TAP through; when fixtures exist, M1 = `behavioral.failed.length===0
  && cases>0`; M2 requires `behavioral.passed>0`; no fixtures → today's byte-identical path.
- Done ==: fixtures-all-pass → M1=M2=1 naming the count; one-fail → M1=0 naming the id; no
  fixtures → byte-identical evidence.
- Bugs: no-fixture fallback must stay byte-identical; `behavioral` must come from the runner's TAP
  (W3), not a log the synthesizer could fabricate; M7's integer math must stay unforced.

**A5 — Human-approve surface (CLI + store + console).**
- What: `rapidtool fixtures draft|approve|reject` verb + `approveAcceptanceFixtures` store action
  + console fixture-count badge.
- Why: the ONE honest human act needs a real face, or fixtures stay `pending` forever and no run
  can honestly claim functional (correctly, per A4's fallback).
- Where: `scripts/rapidtool-cli.mjs` (new `case "fixtures"`, verbs live in `main()`'s switch —
  `emit`:663, `tree-run`:751, `repair`:822, `lesson`:1348); `src/lib/store.ts` action map
  (:91-157, mirror `setEnforceDod`'s sync shape); `src/components/console.tsx` (optional badge).
- How: `draft` runs `draftBriefFixtures` (F2), persists `pending`, prints numbered list; `approve
  [ids|--all]` calls `approveFixtureCases` (the ONLY writer of "approved"); `reject` removes +
  records the note. Store action is sync + idempotent.
- Done ==: `fixtures draft && fixtures approve --all` yields all-approved; the console shows the
  count; no path auto-approves.
- Bugs: auto-approve in `driveP6Journey`/`runUntilHitl`/`wildStep` (forbidden — approval is the
  human act); store action clobbering during an async journey (use the H39-2.3 whole-project
  commit survival rule, store.ts:240-241); `draft` overwriting already-approved ids (must be
  additive / refuse to clobber).

**A6 — Gate the journey + DoD on the behavioral pass.**
- What: (1) `driveP6Journey` convergence, when approved fixtures exist, additionally requires the
  fixture suite green (a green identifier gate + red fixtures = `outcome:"failed"`); (2) dod's
  `p6-verified` keys on the behavioral pass when fixtures exist; `p6-brief-fit` demoted to advisory
  telemetry.
- Where: `src/lib/headless.ts` `driveP6Journey` (:1387-1430, F4's region); `src/lib/dod.ts`
  p6-verified (:337-355) + p6-brief-fit (:364-373).
- How: after F4's `gate.passed` check, add the fixture-suite condition; dod reads the runner's
  fixture TAP (W3), never re-scans source.
- Done ==: gate green + fixtures red → `outcome:"failed"` naming the cases; gate green + fixtures
  green → `converged`; no fixtures → unchanged.
- Bugs: no-fixture byte-parity; recomputing the fixture pass from source (a second driftable
  probe); minting `lastTest:"tested"` on a failed fixture run (forbidden).

**Phase A gate:** full four-gate (`npm test` + typecheck + lint + build) + a NEW keyed run must
show a multi-file tree whose approved fixtures pass. That scorecard is the first that means
"functional." **Do not proceed to Phase B until this is true.**

---

### PHASE B — Production readiness (makes "shipped" mean shipped)

**B1 — The webapp must actually build (C7).**
- What: `emit --verify-kind` / a build gate: `npm install && vite build` (or the emitted
  package.json's `build`) over the emitted tree; red build = red gate, never a "shipped" claim.
- Why: no webapp emission has EVER built (fixes/149_a5 C7). "Shipped software" is currently an
  emitted stub dir.
- Where: new CLI `--verify-kind` on `emit` (rapidtool-cli.mjs:663) + a `compile-check` build
  runner; `RT_E_VERIFY_KIND_FAILED` is pre-registered in errors.ts.
- Done ==: `emit --verify-kind` runs the build and reports pass/fail honestly; a build-failing
  emission can never mint "tested"/"shipped".
- Bugs: build timeouts (bound it); `npm install` network in a sandbox (offline/prefer-offline);
  the emitted package.json already carries a `build` script (scaffold.ts:474-493) — reuse it.

**B2 — Provenance stamps (a floor/refused run can never ship as software).**
- What: every emitted artifact carries a provenance stamp (producer = LLM|floor|template, packet
  hash, run-id, `synthesisSucceeded` flag); the DEPLOY.md + package.json surface it.
- Why: 155_web_functional R2 + 158_s3 W7: degrade loudly, stamp provenance, never let the producer
  grade itself. A floor run may emit artifacts but must carry a "not produced by LLM" stamp.
- Where: `src/lib/scaffold.ts` emit headers (they already say "machine-generated from packet
  <hash>"); extend to include producer + `synthesisSucceeded`.
- Done ==: `DEPLOY.md`/headers name the producer; a refused run's emission is stamped floor and
  cannot be mistaken for software.

**B3 — Real usage metering (replace synthetic estimates).**
- What: the deepseek client surfaces `prompt_tokens`/`completion_tokens` (already parsed in the
  empty-content diagnostic region, deepseek.server.ts:378-392) into a per-project run ledger; M8
  budget + a new cost column key on REAL usage, not `bench.ts`'s synthetic dry-run.
- Why: `bench.ts` is honest but synthetic; LiteLLM's spend-tracking is the field pattern for real
  metering (fresh-fetched this pass). Real metering is required for M8 "bounded" to be truthful.
- Where: `src/lib/deepseek.server.ts` (return usage on the ok path), `src/lib/headless.ts`/
  `store.ts` (accumulate into the run), `maker-score.ts` M8, `run-eval.mjs`.
- Done ==: M8 evidence cites real token counts per run; synthetic estimates are labeled as
  estimates and never substitute for measured usage.
- Bugs: breaking the byte-parity of the deepseek ok-return shape (add usage additively); unit
  tests must inject fake usage.

**B4 — Sandbox hardening (generated code is untrusted).**
- What: document + enforce that generated code runs ONLY under the bounded runner (`node --test`
  / `runNodeBounded`) with a wall-clock + output cap, and NEVER under an import in the engine
  process; add a guard that refuses to `import` a generated tree entry in-process for verification
  (verification must go through the runner subprocess).
- Why: `node-runner.server.ts:17` already warns "Do not run untrusted [code]"; the runner is not a
  security boundary (it's a resource boundary). At minimum, the invariant "generated code never
  executes in the engine process" must be enforced, and documented as a NON-security sandbox.
- Where: `src/lib/node-runner.server.ts`, `src/lib/verify.server.ts` (runCases already runs in the
  runner? verify), `src/lib/compile-check.server.ts`.
- Done ==: a regression test proves generated code executes only in the runner subprocess; the
  "not a security boundary" caveat is in AGENTS.md + the runner header.
- Bugs: a code path that still imports generated code in-process (grep for `import(` over emitted
  paths); over-claiming "sandbox" in docs (it is resource-bounded, not adversary-safe).

---

### PHASE C — Agent loop + self-improvement (the "learns" vision)

**C1 — Lessons must change behavior, with a kill-criterion.**
- What: the lesson store is write-only; wire a bounded read-back so the synthesis/repair prompt
  carries the top-N relevant prior lessons for the same domain, AND add a falsification
  kill-criterion (a lesson that has been contradicted ≥K times is retired, never re-applied).
- Why: 158_s3 W1/W2/W3 — SWE-Bench-CL, Contextual Experience Replay, Metis all show memory only
  helps when (a) it's retrieved, (b) it's evaluated, (c) bad memory is discarded.
- Where: `src/lib/knowledge.ts` (KnowledgeStore L1-L5, counter-evidence/retire already exist?),
  `src/lib/codegen.server.ts` (read-back into synthesis context), `src/lib/crew.server.ts`.
- Done ==: a keyed synthesis prompt for a domain carries its prior lessons; a retired lesson never
  re-enters a prompt.
- Bugs: lessons leaking the API key / sensitive text into prompts (sanitize); unbounded context
  (top-N cap); a lesson changing behavior with no measurable effect (the kill-criterion).

**C2 — Eval-gated promotion (M6).**
- What: a lesson/behavior change is only promoted when the eval score moves the right way across
  runs (M6 handover + a promotion gate); otherwise it's reverted/retired.
- Why: LLM-as-judge self-enhancement bias (155_web_functional S10); self-improvement must be
  falsifiable, not self-congratulating.
- Where: `maker-score.ts` M6, `knowledge.ts`, `run-eval.mjs` history comparison.
- Done ==: a behavior change is recorded with its before/after eval delta; negative-delta changes
  are retired.

---

### PHASE D — Multi-agent + 2nd brain + UX (the "amazing" layer)

**D1 — Real multi-agent execution (not deterministic critique).**
- What: `swarm` is currently "deterministic advisory critique, NO LLM." Add a real orchestrated
  multi-agent pass (orchestrator-workers per Anthropic's "building effective agents"): a
  researcher + architect + implementer + reviewer each a bounded LLM seat, coordinated by the
  deterministic state machine, feeding the same verification harness.
- Why: the user's "AGI agents headless / multi-agent" vision is unmet; `swarm`'s name overpromises.
- Where: `src/lib/crew.server.ts` (crew seats exist), `src/lib/swarm*` (rename/honest-label the
  existing deterministic critiquer OR add a new live path), `scripts/rapidtool-cli.mjs` `swarm`.
- Done ==: a keyed swarm run dispatches real LLM seats and integrates their output through the
  same gates as a single-seat run.
- Bugs: budget blowout (bounded seats, per-seat token caps); a seat fabricating success (every
  seat's output re-verified by the harness); the deterministic critiquer must stay honest about
  being non-LLM.

**D2 — Cross-project 2nd brain (Obsidian-style).**
- What: `vault` is a per-project file dump; add a cross-project knowledge index (projects → their
  packets/lessons/decisions, queryable), so a new project can retrieve "how did past real-estate
  projects handle X."
- Why: the user's "Obsidian-style 2nd brain" vision; memory currently is per-project only.
- Where: `src/lib/vault.ts` (extend), `src/lib/knowledge.ts`, a new cross-project index + a
  `search`/`knowledge` verb extension.
- Done ==: `rapidtool knowledge search "property ledger"` returns cross-project lessons/decisions.
- Bugs: stale index (rebuild on write); leaking one project's data into another's prompt
  inappropriately (scoping).

**D3 — Streaming synthesis UX.**
- What: `stream: false` is hardcoded (deepseek.server.ts:361); add opt-in streaming for the
  synthesis/chat paths so the console shows progress (the user's "live agent-activity feed" taste;
  the wild activity strip already exists — extend it to keyed synthesis).
- Why: long synthesis calls look hung; the user explicitly wants a live activity feed.
- Where: `src/lib/deepseek.server.ts`, `src/lib/chat.server.ts`, `src/components/console.tsx`
  (the WildActivityStrip at :481-594 is the pattern).
- Done ==: a keyed synthesis surfaces incremental progress to the console.
- Bugs: streaming + the json-envelope parse (must buffer then parse, not parse per-chunk);
  backpressure; the retry wrapper must not stream partial retries as success.

---

### PHASE E — Final honesty pass + re-run + docs

**E1 — The honest keyed re-run.** After A–D, run the full corpus (not just 1 entry); the
scorecard must show behavioral fixtures passing on LLM-produced trees, and a floor/refused run
scoring ~5/9 with the floor qualifier. Record results.json + history.json.

**E2 — Corpus ingestion + eval regression tests.**
- What: a CLI verb (`corpus` or `eval`) to add/validate a new brief fixture into
  `research/eval-corpus/`, and a regression suite over the eval harness itself (it currently has
  none).
- Why: the eval is the judge; an unvalidated corpus entry or a buggy scorer silently corrupts
  every verdict.
- Where: `scripts/rapidtool-cli.mjs` (new verb), `scripts/run-eval.mjs`, `src/lib/maker-score.test.ts`
  (extend), a new `scripts/run-eval.test.mjs`.

**E3 — Truth-in-docs sweep.** README + README-cli + AGENTS.md must reflect: the new verbs
(`fixtures`, `corpus`), the behavioral-oracle model, the human-approve gate, the honest "not a
security sandbox" caveat, the "no green without LLM + approved fixtures" bar, and the exit
taxonomy.

**E4 — Final full audit.** Re-run the 6-question capability audit (fixes/143) against the new
state and write the honest verdict — the factory score should move from 4/10 toward 8-9/10, with
the remaining gap being exactly the human-approve act, which is by design, not a defect.

---

## 3. The initiation prompt (hand this to the executing model verbatim)

> You are executing the RapidTool "behavioral-oracle + production-readiness + self-improvement"
> plan at `fixes/162_master_execution_plan.md` in `C:\Users\mnril\Desktop\RapidTool Main` (git-bash
> `/c/Users/mnril/Desktop/RapidTool Main`; NOT a git repo; Node 22.23.2; `.env` holds
> `DEEPSEEK_API_KEY`). Read that file fully first. Then execute Phase A (items A1–A6) in order,
> TDD-style: write the failing test, run it to see it fail, implement, run to green. Gate after
> each item with `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` (all four must be
> green). Constraints: patch-only on existing files (re-grep the anchor immediately before each
> patch — the codebase changes under you), one-time writes for new files, explicit `.ts` imports,
> `node --experimental-strip-types` for probes, `String.fromCharCode` for control chars, never a
> control-regex literal (lint ban), never `$(...)` inline in a terminal command (write a `.sh` file
> instead), never import `node:fs` or a server module into the client bundle (the build guard is a
> hard gate), never auto-approve a fixture (only the human `fixtures approve` verb may), never let a
> floor/refused run share a green path with LLM software (the `synthesisSucceeded` discriminator).
> When a fixture `given`/`expect` is emitted into a spec it must be JSON-escaped, never raw. When
> Phase A is done and gated green, STOP and report the four gate results + a one-line summary of
> each of A1–A6 + the new test count. Do not start Phase B. Report honestly: if anything failed,
> say what and why, and do not claim a green gate you did not run.

---

## 4. Known risks & the open questions (do not paper over these)

1. **The oracle's own correctness.** Machine-drafted fixtures can be wrong; a human can approve a
   bad one. Mitigation: render `given`/`expect` as plain English before `approve` (not raw JSON),
   and freeze the fixture set before the run (no rewriting mid-run — the overfitting guard).
2. **`pure` cases first.** `effect`/`property` (store writes, invariants) need an effect harness
   that doesn't exist; ship `pure` deterministic checks now, emit `effect`/`property` as honest
   "asserted-as-effect-record" rows, not fake deep checks.
3. **The webapp data-entry import (A3) can drag in DOM deps** — gate on the known-headless entry.
4. **"Sandbox" is a resource boundary, not a security boundary** — document it; do not claim
   adversary-safety.
5. **Byte-parity pins are sacred** — legacy/keyless/floor paths and no-fixture emissions must stay
   byte-identical, or the existing 1447 tests + the honesty contract break.
6. **The one human act is non-negotiable.** Fully-autonomous "100% functional" for underspecified
   briefs is not honestly achievable; the correct target is one cheap human approval + everything
   after autonomous and honest.

---

## 5. Files this plan touches (index)

Phase A: `types.ts`, `engine.ts`, `io.ts`, `scaffold.ts`, `brief-fixtures.ts`, `compile-check.server.ts`,
`maker-score.ts`, `run-eval.mjs`, `rapidtool-cli.mjs`, `store.ts`, `headless.ts`, `dod.ts`,
`console.tsx`.
Phase B: `rapidtool-cli.mjs`, `compile-check.server.ts`, `scaffold.ts`, `deepseek.server.ts`,
`headless.ts`, `store.ts`, `maker-score.ts`, `node-runner.server.ts`, `verify.server.ts`.
Phase C: `knowledge.ts`, `codegen.server.ts`, `crew.server.ts`, `maker-score.ts`, `run-eval.mjs`.
Phase D: `crew.server.ts`, `vault.ts`, `knowledge.ts`, `rapidtool-cli.mjs`, `deepseek.server.ts`,
`chat.server.ts`, `console.tsx`.
Phase E: `run-eval.mjs`, `maker-score.test.ts`, `rapidtool-cli.mjs`, README*, AGENTS.md.

---

## 6. SELF-ANALYSIS — errors, gaps, and corrections (read before executing)

Reviewed against the live `brief-fixtures.ts` (508 lines, read this pass) and the scorecard/treeRun
plumbing. These are real defects in the plan above; fix them as you execute.

### CRITICAL (the plan is incomplete without these)

**C1 — The typed-literal source is unspecified (A5 drafts nothing).** `draftBriefFixtures` (F2,
brief-fixtures.ts:232) RED-CARDS every A7 row / capability that has no `typed[ref]` entry (lines
:264-271, :305-312) — the A7 prose carries no executable literals by design. So `fixtures draft`
as specified in A5 would produce **zero cases**. **Correction — insert A5.0 before A5:** an
LLM-assisted typed-draft step: a bounded pro/flash call that, given the brief + A7 rows +
`expectedCapabilities`, proposes a `typed` map (`{ "orc-1": { given, expect }, "cap-1": {...} }`),
which the human reviews and approves alongside the case list. The deterministic `draftBriefFixtures`
is the SHELL; the typed map is the content; the plan never named who authors the content.

**C2 — `requirementId` → function-name resolution is missing.** A fixture case has `requirementId`
(`orc-1`/`cap-1`/`req-N`) but NO field naming which entry export to call. The emitted `brief.spec.ts`
cannot know what function to invoke. **Correction:** (a) add `target?: string` (entry export name)
to `BriefFixtureCase`, populated from the synthesis `reqTrace` (req-N → exported name, codegen
envelope) for req-N cases and from the job→module mapping for A7 rows; or (b) the emitted spec reads
`project.reqTrace` at emit time and inlines the resolution. Without this, every fixture call is
ungrounded.

**C3 — `shape` deepEqual against runtime-generated values is broken.** The plan's example
`createProperty({address,owner}) ⇒ {id, history:[]}` cannot `assert.deepEqual` against
`{id:"<draft>", history:[]}` because `id` is generated at runtime (ULID) and unknown at authoring
time. **Correction:** redefine `expect {kind:"shape"}` semantics as **partial shape-match**: assert
the returned object is an object, has every key named in `value`, and each key's type matches
(`typeof`/Array.isArray); for keys whose value is a non-placeholder literal (not `"<draft>"`), assert
deep equality. Placeholders (`"<draft>"`, `"<any>"`) mean "present + correct type, value unchecked."
The emitted assertion must be a structural matcher, not `assert.deepEqual`.

**C4 — `throws` substring vs `assert.throws` regex.** F2 forbids regex (the validator calls
`messagePattern` "plain substring, NOT a regex", brief-fixtures.ts:439-441), but A2 says
`assert.throws(..., /pattern/)`. A raw substring with regex metacharacters (`[`, `(`, `.`) injected
into a regex literal either breaks or matches wrong. **Correction:** the emitter escapes
`messagePattern` into a regex via `RegExp.escape`-style escaping (or `String.fromCharCode`-free
`new RegExp(pattern.split("").map(c => /[.*+?^${}()|[\]\\]/.test(c) ? "\\"+c : c).join(""))`) and
asserts `assert.throws(fn, (err) => String(err.message).includes(pattern))` — the substring form is
safest and matches the validator's intent.

**C5 — The `property` invariant registry does not exist.** `expect {kind:"property", name}` is
validated against "the approved invariant registry" (brief-fixtures.ts:444-447) that is never
built anywhere in the plan. **Correction:** ship `pure` + `throws` in Phase A; leave `property`
UNIMPLEMENTED with an explicit red-card ("property invariants require the invariant registry,
not yet built — supply as a `pure` shape case instead") rather than a dangling reference.

**C6 — Fixture staleness guard is missing.** Approved fixtures become stale the moment the brief or
`implementationSpec` changes (a human approves fixtures for brief-v1, then edits the brief). The
`implementationSpec` already carries a `briefHash` staleness guard (types.ts:373-374); fixtures need
the same. **Correction:** store `briefHash` (fnv1a of the brief) with the approved fixture set; any
run whose brief hash differs discards/re-drafts the fixtures (all back to `pending`) with a loud
`acceptance.stale` log — never silently re-approve.

### MODERATE (wiring under-specified or inconsistent)

**M1 — `treeRun` → `scoreMaker` plumbing is already inconsistent.** `m2Runs` reads
`tr.testsPass`/`tr.testsFail` (maker-score.ts:328), but `TreeRunOutcome` (compile-check:271-285)
carries `tests: TreeSpecVerdict[]` (each with `tests:{pass,fail}`) — there is NO `testsPass` field.
So `run-eval.mjs` must already be adapting `TreeRunOutcome` → `MakerTreeRunEvidence`. **Correction:**
name that adapter explicitly in A4 and compute `behavioral` there, from the `tests[]` entry whose
`file` is `tests/brief.spec.ts`, summing its `tests.pass`/`tests.fail` — never invent a parallel
probe.

**M2 — The headless eval cannot approve (the human-gate round-trip is unspecified).** `run-eval.mjs`
runs headless; a keyed run will draft `pending` fixtures → M1/M2 = 0 (correctly, but the eval can
never demonstrate the green path). **Correction:** specify the workflow: (1) `run-eval` DRAFTS
fixtures + exits with a `fixtures.pending` note; (2) a human runs `rapidtool fixtures approve`;
(3) `run-eval` is re-run and NOW scores behaviorally. Add a `--fixtures-approved` eval flag for CI
that asserts (never auto-sets) pre-approved fixtures exist. Document that the two-step is the
intended honest flow, not a defect.

**M3 — Multi-project / throughput parallelism is a gap I found but the phases omit.** The store is
`serialized(id)` per-project (store.ts:182) and the eval is "bounded to 1 corpus entry"; there is no
cross-project parallel execution. **Correction:** add to Phase D a D0 "parallel eval / N-project
throughput" item: run the corpus across N projects concurrently with a concurrency cap, reusing the
existing per-project serialization as the isolation primitive.

**M4 — A3 (`dataEntry`) and A4 (`behavioral`) are conflated.** `dataEntry` (entry import smoke) is
NOT the fixture TAP. A4 must read `TreeRunOutcome.tests[]` (the `brief.spec.ts` spec verdict), not
`dataEntry`. Keep the two signals distinct; `dataEntry` feeds a "the app's data layer loads"
criterion, `behavioral` feeds "the functions do the job".

### MINOR

**m1 — `approveFixtureCases` return shape unverified.** Declared at brief-fixtures.ts:497; its body
was not read this pass. Verify it returns a NEW array (input untouched) and only flips the named
ids before relying on it in A5.

**m2 — `cap-<n>` capability cases have no single function target.** A `expectedCapabilities` prose
paragraph maps to many functions, not one. Resolve via C2's `target` from `reqTrace`, or red-card
capability cases that cannot be mapped to exactly one export (honest: "capability too broad for a
single fixture — split it").

---

## 7. What is genuinely NEW in this plan vs prior dossiers (the "missed" list, verified)

1. **Typed-literal authoring step** (C1) — the missing link between the deterministic fixture shell
   and real semantics.
2. **`target`/reqTrace resolution** (C2) — fixtures must name the function they test.
3. **Partial shape-match semantics** (C3) — runtime-generated ids make strict deepEqual impossible.
4. **Substring-safe `throws`** (C4).
5. **Fixture staleness guard** (C6) — approved fixtures must re-draft on brief change.
6. **Real usage metering** (B3) — `bench.ts` is synthetic; LiteLLM spend-tracking is the pattern.
7. **Streaming synthesis** (D3) — `stream:false` is hardcoded.
8. **Sandbox honesty** (B4) — the runner is a resource boundary, not a security boundary.
9. **`swarm` is deterministic critique, not multi-agent** (D1) — the user's multi-agent vision is
   unmet; the name overpromises.
10. **Cross-project 2nd brain** (D2) — `vault` is per-project; no cross-project retrieval.
11. **Corpus ingestion + eval regression tests** (E2) — the judge is itself untested.
12. **Multi-project throughput** (M3) — eval bounded to 1 entry; no parallel execution.

---

## 8. AGENT EXECUTION PROTOCOL — how to implement this without breaking anything

These are the hard guardrails for the model that executes this plan. They exist because this
codebase has specific, non-obvious failure modes that a generic coding agent WILL trip on. Follow
them exactly; they are not suggestions.

### 8.1 Environment + shell rules (these bite immediately)
- **Working dir is `C:\Users\mnril\Desktop\RapidTool Main`** — git-bash path `/c/Users/mnril/Desktop/RapidTool Main`. It is NOT a git repo (no commits; checkpoints are four-gate greens + `fixes/*.md` logs).
- **`search_files`/`rg` FAILS on the space in "RapidTool Main".** Use `terminal` + `grep`/`read_file` with quoted paths instead. Never trust a `search_files` "not found" on this path.
- **NEVER `set -a && . ./.env && set +a` in a foreground test shell.** The exported `DEEPSEEK_API_KEY` persists and flips `keyedDeepSeekConfigured()` → `emptyProject` default `enforceDod:true` → keyless tests (store full-pipeline) hit the P6 hard-DoD block and go red. Keyed runs go in a CHILD subshell (`bash rt_*.sh` that sources `.env` internally); `unset DEEPSEEK_API_KEY` after any probe that leaked it.
- **`$(...)` inline in a terminal command is a parser block** — write a `.sh`/`.mjs` file and run it instead.
- **MSYS path mangling:** `C:/Users/...` (forward slashes) for Node args; `/c/Users/...` for bash. Passing `/c/x` to a Node CLI writes `C:\c\x`.

### 8.2 The four gates (run all four after every item; report REAL exit codes)
```
npm test            # src + scripts legs; expect 0, no "not ok" lines
npm run typecheck   # expect 0, no "error TS"
npm run lint        # expect 0, "error" count 0 (33 warnings are the pre-existing baseline)
npm run build       # expect 0 — this is the CLIENT-BUNDLE guard, never skip it
```
Never claim a gate you did not run. Never paste a green from an earlier run over a red. If a gate
fails, name the failing test/error, fix it, re-run ALL FOUR.

### 8.3 The client-bundle guard (the build breaks here if you get it wrong)
- Any static OR dynamic import of `node:fs` / a server module (`*.server.ts`) into the client
  bundle is a hard build error. The approved idiom is the **concatenated-spec lazy import**:
  `await import("./compile-check." + "server.ts")` plus a runtime `typeof window` guard. Server-only
  types use `import type` (erased).
- New pure modules (like `brief-fixtures.ts`) must be client-safe: no `node:` imports, no
  `Date.now`/`Math.random` in the deterministic paths (import `Math.random` is fine if injectable
  and defaulted, but the DRAFTER must be pure).

### 8.4 Byte-parity pins (sacred — never "clean these up")
- Legacy/keyless/deterministic/floor paths and no-fixture emissions must stay **byte-identical**:
  `prompt-engine` strings, the first-attempt-400 response, the keyless journey passthrough, the
  no-oracle generateCases prompt, the no-capability scaffold emission. The parity is enforced by
  frozen-baseline tests — run them after every edit; if one fails, your edit changed a pinned
  string, revert that part.
- Additive fields default to ABSENCE (never `[]`/`false`/`""`), or serialization differs.

### 8.5 Lint + language hard-bans
- `no-control-regex` is a hard ban: build control chars with `String.fromCharCode(...)`, never a
  literal `\u0000`-style control in a regex.
- Explicit relative imports with the `.ts` extension (`./x.ts`, `./x.server.ts`). No extensionless
  or bare imports that break strip-types.
- No `eval`, no `new Function`, no raw interpolation of fixture `given`/`expect` into generated
  source (see 8.7).

### 8.6 The honesty contract (the whole point of this project)
- **Never auto-approve a fixture.** Only the human `fixtures approve` verb flips `pending`→
  `approved`. `driveP6Journey`/`runUntilHitl`/`wildStep`/`run-eval` must NOT.
- **The scorer reads the runner's TAP, never a model-written log.** `behavioral` pass/fail comes
  from `node --test` output of `tests/brief.spec.ts` (via `TreeRunOutcome.tests[]`), not from a
  `p6.synthesis` log the synthesizer could fabricate.
- **Never mint `lastTest:"tested"` on a run whose fixture spec failed.**
- **A floor/refused run and LLM software never share a green path** — the `synthesisSucceeded`
  discriminator gates M1–M4 AND the journey outcome AND the emit/DEPLOY claim.
- Do not rename/drop the `orc-*` pinned ids (E-08); do not delete a red gate record; do not convert
  a red completion into a clean 0.

### 8.7 Fixture-emission safety (the injection + semantics rules from §6)
- `given` is emitted by `JSON.stringify(given)` inline (safe because the validator enforced a plain
  JSON literal) — NEVER raw string interpolation. `JSON.stringify` of a validated plain literal is
  valid JS object syntax; keep it that way (no template-literal splicing).
- `expect {kind:"shape"}` → **partial shape-match** (keys present + types match; `"<draft>"`/`"<any>"`
  placeholders mean "present + correct type, value unchecked"), NOT `assert.deepEqual` against a
  placeholder.
- `expect {kind:"throws"}` → assert `String(err.message).includes(pattern)` (substring, not regex) —
  no regex metacharacter injection.
- `expect {kind:"property"}` → RED-CARD it (the invariant registry does not exist yet); do not
  emit a dangling property assertion.
- The emitted spec MUST live under `tests/` (so `treeRun`'s `node --test` executes it) and MUST
  import the tree ENTRY with the `tsImportPath` + `/\.ts$/` guard — never import a `.tsx` entry.

### 8.8 Anchor discipline (the tree changes under you)
- Re-`grep`/`read_file` the exact anchor IMMEDIATELY before each `patch`. Line numbers drift; patch
  by unique surrounding text, not `:NNN`.
- If you dispatch sub-lanes: strict disjoint file ownership; integrate + gate at every boundary; a
  lane that caps leaves an anchor map, and the parent (you) transcribes — never touch another live
  lane's file.
- `verify` the machine's own scorecard (`research/eval-out/results.json`) before believing any
  self-reported "9/9" — the number is data, not proof.

### 8.9 The build order within Phase A (do not skip A5.0)
A1 (persist) → A2 (emit) → A3 (run) → A4 (score) → A5.0 (typed-draft) → A5 (approve surface) →
A6 (gate). **A5.0 is mandatory** — without the LLM-assisted typed-draft step producing the `typed`
map, `draftBriefFixtures` red-cards every case and `fixtures draft` yields zero fixtures.
Resolve C2 (`target` export name) and C6 (briefHash staleness) in A1/A2, not as afterthoughts.
After A6, gate, then run the keyed Property Ledger and READ `results.json` — do not proceed to
Phase B until a multi-file tree's approved fixtures pass.

### 8.10 If something fails (the honest recovery pattern)
- Say exactly what failed and why. Do not ship a plausible-looking green.
- A red that is an environment artifact (the known `exec` spawn-grace flake; `hermes verify` -1
  under load) is documented — but you must PROVE it passes standalone before calling it a flake.
- Leave the four-gate evidence in the terminal output for the human to see.

---

## 9. WAVE-163 AUDIT FINDINGS (autonomous-loop · data-flow · recovery) — must-read corrections

Three deep audits (full text in `fixes/163_a.md`, `163_b.md`, `163_c.md`) found defects that
CHANGE the plan's premise and ordering. Headline findings below; the full files carry every
file:line anchor + test idea.

### 9.1 P0 — THE MULTI-FILE TREE DOES NOT EXIST YET (changes Phase A's premise)
`assembleTreeEntry` (codegen.server.ts:520) concatenates chunks into **IIFE scope-sharing**, NOT
importable modules. In tree mode the assembled entry is **never emitted to disk**; oracle/job
bridges import only chunk 0; chunks ≥1 are **emitted-but-never-executed orphan fragments**. The
"9/9 keyed" run was actually a single 38 KB file hosted on `src/jobs/track.ts` — **zero multi-file
trees exist in eval-out**. → **INSERT a new Phase-A prerequisite A0 before A1:** make the tree
assembly produce real, importable per-file modules (each chunk → its own file with correct
cross-file imports, emitted to disk and executed in the tree-run). A2/A3/A4 all assume a real
tree; without A0 they verify a one-file dump.

### 9.2 P0 — Canonical score source is undefined (emit-dir vs ledger divergence)
The 9/9 keyed run's `.rapidtool/project.json` declares `generatedTree[src/generated.ts, 38,049B]`
while **no such file exists on disk** — `src/jobs/track.ts` (38,670B) is the non-tree host.
`emitProject` never cleans the dir; run-eval reuses slug dirs across modes and never calls
`importTreeDir`. M1/M3/M4 read the in-memory ledger; M2/M6 read the disk; **nothing binds them.**
→ INSERT a canonical-score gate: after emit, re-import the dir into the ledger (hash-checked, the
G1 `importTreeDir` seam) so disk and ledger agree, and score from the bound artifact only.

### 9.3 P0 — An agent can mint "human" approval (honesty hole)
`approveHitl` defaults `decidedBy:"human"` (engine.ts:1526) and CLI `approve --force` stamps human
with no TTY/seat check (headless.ts:640-652, rapidtool-cli.mjs:456-479). DoD criteria read
"P4/P5/P8/P9 HITL approved" but their probes only check phase completion — so **machine
self-approval satisfies human-approval claims**. And `wildApproveGate` refuses only forceHuman
gates while sync autopilot refuses forceHuman + stock HITL — the *autonomous* loop self-approves
the security/UI/deploy gates the conservative path won't. → Actor-honesty: the seat field must
record the REAL actor (`decidedBy:"machine"` for wild/autopilot/--force), and the wild loop must
share the autopilot's HITL refusal predicate.

### 9.4 P0 — The judge is not falsifiable (self-approval can't be trusted)
The vacuous-feedback guard passes on an artifact-title echo the model itself generated
(wild-mode.server.ts:220-239); the DoD verdict is **pre-printed to the judge** (wild-mode
.server.ts:123); the judge is flash judging its pro sibling (same family = LLM-as-judge self-bias,
155 S10). → Blind the judge to the pre-computed DoD verdict; require an independent
refutation/held-out check; consider a different-model judge.

### 9.5 P0 — Behavioral-repair gap CONFIRMED (and it's worse than §6 said)
All repair prompts fix shape only (codegen.server.ts:204-331). The only behavioral loop is
`verifyAndFixServer` (single-module path, LLM-self-authored cases). Tree-run tails **deliberately
strip expected/actual** (compile-check.server.ts:433), so the synthesized module never sees WHAT
its test failed on. → A6 must add: feed the failing fixture's expected-vs-actual delta into the
repair prompt (the "judgment from proof" loop), not just the tree-run pass/fail.

### 9.6 P0 — driveP6Journey mints `tested` BEFORE reading gate.passed (ordering bug)
headless.ts:1402 (mint) runs before :1416 (gate check) — so a red-gate run can still carry a
`tested` mint. This partially undoes F4's convergence honesty fix. → Reorder: gate first, mint
only after `gate.passed` (and after the fixture pass, per A6).

### 9.7 P1 — Crash/resume is phase-granular only
Project JSON saved once per CLI invocation; P6 journey cycles are in-memory (a crash restarts at
cycle 1 with a fresh budget); explicit resume exists only for wild-mode. → Add a per-cycle
checkpoint + resume so a long keyed journey survives a process death without losing the budget/
refusal history (matches the crash/resume gap in §7/M3 and 164-A's findings).

### 9.8 P1 — Repro gate (determinism)
`emitProject` never cleans the dir; packet timestamps make byte-identical re-emission impossible.
→ Add a two-run repro gate (`repro-gate.mjs`): same packet → byte-identical emitted tree (after
timestamp-stripped headers), and a sha256 manifest digest alongside the fnv1a evidence hash.

**Ordering impact:** insert A0 (real tree assembly) and A7 (canonical-score gate) into Phase A;
the self-approval + judge-falsifiability fixes (9.3/9.4) go into Phase D's autonomy work and the
honesty contract (§8.6); 9.5/9.6/9.7 fold into A6/C1/C2; 9.8 into Phase B.

---

## 10. WAVE-164 FINDINGS — concrete pipeline bugs + AI-agent UI/UX

Full text: `fixes/164_b.md` (UI/UX, 537 lines) and this section (164-A findings — its file was
not written; findings transcribed here verbatim from its summary, file:line-anchored).

### 10.1 Pipeline bugs (164-A) — concrete, each with fix + test

- **F1 RESUME (P0):** plain async runs persist NO in-flight cursor — only Wild Run can resume
  (`hydrateWildRun` engine.ts:1940-1965; `startWildRun` PA-01 store.ts:989-1004).
  `runUntilHitlAsync`/`executeAsync` (store.ts:1250/1222) drop remaining phases silently on a
  process death. → persist a `runInFlight`/epoch on run start; hydrate session-break-honestly;
  CLI `--resume`. Test: start async run → rehydrate → sealed prefix intact + resume continues at
  `currentPhase`.
- **F2 STOP-REASON (P0 bug):** `executeAsync` returns `ok:true` on a hard-DoD block — store.ts:1228's
  error predicate omits `next.dodBlocked` (sync `execute` :1143 and `runUntilHitlAsync` :1262 both
  include it), so a blocked advance commits success. → add `|| next.dodBlocked` at store.ts:1228.
  Test: `enforceDod` + DoD-failing phase → `executeAsync` returns `ok:false`.
- **F3 HARD-GATE BYPASS (P0 honesty):** `headless.advanceOnce` (headless.ts:437-445) checks
  `canEnter`/`priorsSealed` but has **NO enforceDod check** — so `rapidtool run/gate` and the entire
  `run-eval.mjs` drain silently bypass the P10 hard gate the UI enforces. → mirror the store
  leave-gate in headless + add `"dod"` to headless `RunOutcome` (headless.ts:451). Test: complete-P
  with failing gate + enforceDod:true → `runUntilGate` stops, cursor unmoved.
- **F4 RESUME/legality (P0):** hydrate (engine.ts:2000-2017) repairs only the *locked* edge record;
  a payload with phases 0-2 complete, 3 missing, 4 complete → `currentPhase=5` but `priorsSealed(5)`
  fails → NO store action can recover. → post-repair invariant: clamp to highest-sealed+1 with a
  `hydrate.repaired` token. Test: import such a payload → cursor clamps + log.
- **F5 CONCURRENCY (P0 data-loss):** `runVerifyAsync`/`deepenResearch`/`runP6Journey` are NOT in
  `serialized(id)` and don't `rebaseConcurrentEngine` — engine-row appends landing mid-flight get
  rolled back. → chain them per-id + apply `rebaseConcurrentEngine` (used by `commitWild`
  store.ts:1048-1059). Test: slow fake verify + mid-flight `ingestReport` → artifacts survive.
- **F6 MODEL ROUTING (P1 cost):** no policy — `P6_SYNTH_MODEL = pro` (codegen.server.ts:127) at every
  chunk/repair/cycle site; a failing tree costs 3× pro calls. → `routeFor(phase/task)`: first
  synthesis pro, retry/repair/typed-draft flash, cost guard. Test: retry cycles use flash.
- **F7 EMIT IDEMPOTENCY (P1):** `emitProject` (headless.ts:1018-1039) never deletes foreign files
  already in `--out` (documented "overwritten in place") — a stale file survives, poisons `treeRun`,
  and leaks into the edit-continuation seam. → list foreign files loudly / refuse without `--force`
  / emit-to-scratch + swap. Test: emit A, add stray file, emit B → foreign file surfaced.
- **F8 ERROR-TAXONOMY PARITY (P1):** errors.test.ts:240-243 enforces exact one-doc-entry-per-code
  (the "21/21" mechanism is a deepEqual, not a count literal). New verbs (`fixtures`/`corpus`/`eval`)
  + A2 emit failures need codes **paired with their ERROR_CODE_DOC entry in the SAME patch** or the
  parity test breaks (correctly). Also: `respond()` prose-classification fallback
  (rapidtool-cli.mjs:111-128) mislabels — use explicit codes at call sites.

**Weaker/verify items (164-A ran out of budget to pin):** `headless.loadProject` (headless.ts:65)
vs `io.importProject` strict 13-phase whitelist (io.ts:326-328) — confirm the CLI file loader shares
the same validation; `briefHash` mismatch (codegen.server.ts:1104-1110) is silently discarded +
re-expanded with no loud log (an operator's hand-written spec can vanish after a brief edit);
`stoppedReason:"hitl"` can't distinguish a genuine human gate from an autopilot `gate_denied` park
(store.ts:1179-1187) — agents would try `approve` on a DoD-denied gate.

### 10.2 AI-agent-facing UI/UX (164-B) — where + how to wire

- **In-app guide is prose-only.** `GuideDialog` (console.tsx:5408) + `GUIDE_SECTIONS` (:886) exist
  but omit verbs, gate semantics, RT_E/exit taxonomy, and "what can I do right now". → extend
  `GUIDE_SECTIONS` with a verbs table, the gate/exit taxonomy, and the honesty contract; a
  per-project "next action" line.
- **Primary verbs have zero `title=`/hints.** Execute / Run-to-gate / Run-module / Approve / Retry /
  verify — only Reject has an aria-label; 35 `title=` exist elsewhere (inconsistent). → add
  `title=`/tooltip to every primary verb button (what it does + what it affects + its exit code).
- **No machine-readable status.** State is scattered across 5+ regions; rail segments don't show
  gate pass/fail even though `rec.gate` exists. → a per-project status line (phase X/N · gate
  pass/fail · lastTest label · keyed-vs-floor · fixtures pending/approved) as badges on the rail.
- **Error codes don't reach the main UI.** `errors.ts` `ERROR_CODE_DOC` (meaning + agentAction per
  code) is client-safe but 0-import — the console never shows it; `ApproveResult` (store.ts:37)
  carries no `code?` field while `WildRunResult` does (:69). → add `code?` to `ApproveResult` +
  surface `ERROR_CODE_DOC` meaning/agentAction on run alerts.
- **Full spec (537 lines, cited §12 + DoD §13) is in `fixes/164_b.md`** — read it before
  implementing any console change; it lists each wire-point + test.

---

## 11. WAVE-165 CONCRETE BUG FIXES (UI · storage/build · pipeline/CLI) — 27 defects

Full detail (BUG/WHY/FIX/TEST each, file:line-anchored): `fixes/165_a.md` (11 UI),
`fixes/165_c.md` (9 pipeline/CLI); 165-B's 7 storage/build findings are transcribed below
(its file was not written — cap). These are concrete, mostly-small fixes; fold each into the
phase noted.

### 11.1 UI / text / loading (165-A, console.tsx) — fold into Phase D + §10.2
1. **Paused-chip tone dead** — tone ternary reads legacy `paused`, text reads `pause` (:756 vs
   :766); use `wildPaused()` in both. Legacy payloads render STOPPED.
2. **"Module run failed" uses the green banner** — route non-zero-exit to `setError` not
   `setNotice` (:1354-1368).
3. **P6-override error quotes a nonexistent checkbox label** — align store.ts:1474 copy to the
   real label (:2730).
4. **Manual Stop shows "stopped after reload"** — track stop origin (:820-825).
5. **Wild OFF toggle leaves a zombie PAUSED run + false "step cap" log** — stop the driver before
   setWildMode(false); distinguish stop causes in the driver tail.
6. **Wild ON on a sealed build silently no-ops (toggle stays ON, IDLE forever)** — handle
   startWildRun's result like the resume path does.
7. **Ctrl+Shift+C is a Chrome/Edge DevTools-reserved chord** — remap (e.g. Ctrl+Shift+D).
8. **"Run module (bounded)" has no busy latch/spinner/re-entry guard** — add `busyAction:"module"`.
9. **Deepen copy says "research running" after it finished** — report the settled gate state.
10. **"saved HH:MM" stamps page-open time** — didMount guard so it reflects a real persist.
11. **"Archive" = permanent unrecoverable delete, no title/icon** — relabel to "Delete" + add
    `title` + icon.

### 11.2 Storage / build / runtime (165-B) — fold into Phase B
- **B1 (P0) no persist `version`+`migrate`:** `store.ts:803-832` sets `name:"rapidtool.v4"` but
  zustand defaults `version:0`; a schema bump wipes every user with NO recovery (and the blob is
  never overwritten → re-wipes every reload). → `version:1` + `migrate()` before Phase A adds
  `acceptanceFixtures`. TEST: legacy-shape blob → migrated; future version → clean re-seed.
- **B2 (P1) quota-salvage clears `lastPersistFailure`:** `persistStorageHealth()` reports ok while
  the disk blob is trimmed + diverged; every write re-throws + re-salvages. → track salvage as
  "degraded", converge in-memory state.
- **B3 (P1) import slurps the whole file before the size cap:** `console.tsx:1531` `readAsText`
  with no `file.size` check, so a 100s-MB file is read before `IMPORT_MAX_CHARS` (io.ts:31) refuses
  it. → reject on `file.size` + `reader.abort()` first.
- **B4 (P2) absolute asset hrefs break sub-path deploys:** `__root.tsx:44-47` hardcodes
  `/favicon.svg` etc. → prefix `import.meta.env.BASE_URL`.
- **B5 (P2) `generatedTree` round-trip drops unknown per-row fields:** `io.ts:243-248` +
  `engine.ts:2163-2168` reconstruct `{path,source,hash,attempt}` from a whitelist — a future
  per-file `fixtureIds` (Phase A) is silently stripped. → preserve unknown keys on well-formed rows.
- **B6 (P3) concatenated-spec lazy imports fail-closed (intentional, verified):** `runP6Journey` in
  the browser is a permanent `ok:false` (dead affordance — fold into 164-B's UI work).
- **B7 (P3 minor):** RunScreen flashes "build doesn't exist" pre-hydration; HomeScreen 80ms fallback
  can seed the demo pre-rehydrate; `storageBytes()` is O(keys) per call.

### 11.3 Pipeline / file / CLI (165-C) — fold into Phase A + §10.1
1. **`repairTreeDir` converges while ignoring the P6 gate it just recorded** (mints `tested`
   pre-gate, both green returns read `verdict.ok` never `gate.passed`; `driveP6Journey` treats the
   same state as FAILED) — headless.ts:1813-1948 vs :1416-1444. → gate BEFORE mint; convergence
   requires `gate.passed`; add `recordGate` to `RepairTreeDeps` (:1631).
2. **Re-emit never reconciles the file SET** — stale `tests/*.spec.ts` survive, re-run red every
   cycle, unwedgeable → budget exhaustion. → snapshot hashes pre-emit, delete byte-identical
   leftovers, report survivors.
3. **`moduleEmbedded` is `true` whenever `generatedSource` is empty** (`.includes("")`) —
   headless.ts:1031. → guard on non-empty source.
4. **Exit-taxonomy drift:** 12 emit-era verbs exit 1 (usage) instead of 4 (internal) on a throw —
   rapidtool-cli.mjs:742-746 etc. → change to exit 4.
5. **`deepen --phase <garbage>` silently deepens `currentPhase`** (exit 0, wrong phase) — :1822-1825.
   → validate the USER's value.
6. **`wild --steps 0` runs the DEFAULT 24** (0 is falsy) + silent clamp of 999→48 — :1703-1707.
   → validate 1..48 in the CLI.
7. **Files an agent ADDS to the emitted dir are invisible to the ledger** (`importTreeDir` iterates
   known rows only) → silently dropped on next emit, unrepairable red spec. → scan for `added`
   files + surface in the envelope.
8. **Envelope shape drift:** `imported`/`unchanged` are counts while `changed`/`missing`/`refused`
   are arrays, in one JSON object — :858-865. → normalize (counts + `*Paths` lists).
9. **Doc drift:** stale `io.ts:340` comment (slugName is :374); USAGE omits the `diagnose` verb.

**165-C negative findings (verified NOT bugs — don't re-hunt):** the repo-root space cannot corrupt
in-process spawns (all argv-array, no `shell:true`); no unbounded JSON/NDJSON log (all capped);
`downloadFilename`/`exportPacketText`/`PHASE_COUNT` are live (consumed by UI/tests).

---

## 12. FACT-CHECK ERRATA (wave-166) — corrections that change the work items

Every anchor + external fact in this plan was re-verified against the live tree + fetched sources.
**All external facts are CONFIRMED** (arXiv 2511.16858 overfitting numbers, OpenAI's 68.3%
SWE-bench-filtered figure, the benchmark list, LiteLLM spend-tracking, Anthropic patterns — none
hallucinated). The following are REAL corrections to the plan's own work items:

1. **A3 is WRONG/STALE — "entry never executed" is already closed.** `treeRun` (compile-check
   .server.ts:604) already resolves the entry (`resolveEntry` :523 — package.json main → `job-*`
   node → `src/generated.ts`) and runs a real import-smoke (`runEntryFile` :570); the "UI-shell
   skip" fires only when `index.html` is present (:527). `ok` already requires compile green + all
   specs pass + entry pass-or-skip (:623). → A3's premise is stale; **reframe A3 as "assert entry
   BEHAVIOR via runEntryFile, not just load"** — extend `runEntryFile`/`TreeEntryVerdict`, do NOT
   add a parallel `dataEntry`. Drop the "chain-link 11 STUB" wording.
2. **A2's "npm test in the emitted dir runs the fixtures" is FALSE.** Every emitted package.json
   `test` script pins ONLY `tests/oracle.spec.ts` (scaffold :474/:481/:485/:489/:493). A new
   `tests/brief.spec.ts` would NOT run. → A2 must either (a) emit the fixture tests INTO
   `emitOracleSpec`'s existing output (it already writes `tests/oracle.spec.ts`), or (b) patch
   `PKG_SCRIPTS[].test` to glob both specs — but that PKG change is inside the byte-parity pin, so
   branch it on the ≥1-approved-fixture guard exactly as the emit is guarded.
3. **B3's "return usage on the ok path" is ALREADY DONE.** The ok-return already carries
   `usage: {promptTokens, completionTokens}` (deepseek.server.ts:420-436, type :171). The
   "empty-content diagnostic region" is :401-419 (not :378-392). → B3's remaining work =
   run-ledger accumulation + M8 wiring + run-eval evidence (client change is additive-none).
4. **`WildActivityStrip` does not exist.** The component is `WildConsole` (console.tsx:489-880);
   D3's ":481-594" reference and the name are wrong.
5. **C1 "lesson store is write-only" is FALSE/STALE.** Read-back ALREADY exists + is wired:
   knowledge.ts `rankBriefLessons` :89 / `lessonLinesForBrief` :127, injected into the expandBrief
   path (codegen.server.ts:96 + :728); the kill-criterion already exists (retirement after 3×
   counter-evidence, knowledge.ts :477/:595). → reframe C1 as **"extend the existing read-back +
   kill-criterion to ALL synthesis/repair prompts (verify + P6 synthesize, not only expandBrief),
   and prove retired lessons never re-enter"** — not "wire a read-back that doesn't exist".
6. Minor anchors: `emitOracleSpec` :986-1328 (not -1330); `MakerScoreInput` :112-132 (not -134);
   `driveP6Journey` exported at headless.ts:1314 (convergence branch :1387-1446).
7. **§6-m1 RESOLVED:** `approveFixtureCases` (:497-503) verified pure — returns a NEW array via
   `.map`, input untouched, flips only named ids. Also note `approveAllFixtureCases` :506 exists
   (the plan's survey missed it).
8. `npm run build` also runs `db:migrate` (not just the client bundle) — an executing agent should
   not be surprised by a migration step in the build gate.

**Plan-internal consistency notes (fold in as you execute):** A2's npm-test claim and A3's premise
are corrected above (#1, #2); B3 was listing already-shipped work (#3); the plan header's "lint 0"
means "0 errors" (33 warnings baseline — §8.2 already says so).

---

## 13. DEEPER GAPS (found after the 10-agent audit — the "think harder" pass)

Verified against the live tree this pass. These are under-weighted or absent from §0-§12.

1. **CORPUS DIVERSITY (P0 for "the factory generalizes").** The eval corpus has 6 real entries —
`coffeehouse2home-property-ledger`, `field-ops-suite`, `house-flip-manager`, `real-estate-crm`,
`rental-portfolio`, `showing-booking` — and they are **all real-estate**. Zero tool / library / game
/ agent / CLI briefs. A factory proven only on one domain is not "100% functional" — it's
domain-overfit. AND the keyed eval is **hardcoded `entries.slice(0, 1)`** (run-eval.mjs:633-634, a
cost guard, not a flag) — so no keyed run has ever exercised more than the first entry. → E1 must
(1) lift the hardcoded slice to a flag/limit, and (2) add diverse corpus entries (a CLI tool, a
library with a public API, a game, an agent) with their own expectedCapabilities before claiming
"production-ready." This is the single biggest "prove it works" gap the plan under-specifies.

2. **`effect` fixtures are the DOMINANT real-world case and are unhandled.** `brief-fixtures.ts`
implements `pure` + `throws`; `property` references a nonexistent registry; and `effect` (stateful
CRUD: create→persist→checkpoint) has NO harness. A property-ledger brief is *entirely* stateful
CRUD — "create property ⇒ persisted + checkpoint written" is an `effect`, not a `pure` return-shape.
→ Promote the effect harness to Phase A (not defer): a Given-When-Then / Four-Phase-Test runner
(setup a store fixture → act on the entry export → assert the store/checkpoint state changed),
using the same plain-JSON `given` as the setup state. Shipping only `pure` would let the oracle
pass a pure-function surface while the app's actual CRUD behavior stays unverified.

3. **No journey-level total deadline.** Per-call timeouts exist (240s) but no wall-clock cap on the
whole `driveP6Journey` (grep: no `deadline`/`wallClock`/`totalTimeout`). With A0's multi-file tree +
more chunks + 3 budget cycles, a keyed run can run unbounded. → add a journey deadline
(`JOURNEY_TOTAL_TIMEOUT_MS`) that fails loudly + honestly (the 163-C crash/resume + budget already
interact with it).

4. **The `generatedSource`/`generatedTree` DUAL REPRESENTATION is the recurring-bug root cause and
is never fixed.** 163-B F1 (ledger/disk divergence) and 165-C-3 (`moduleEmbedded` always-true on
empty source) are both symptoms of one artifact held in two fields. A7 patches the symptom. → add an
INVARIANT + a single writer: `generatedTree` non-empty ⇒ `generatedSource` is DERIVED (assembled
entry), never independently set; enforce in hydrate with a `representation:reconciled` token. Until
this lands, expect more divergence bugs.

5. **Two parallel human-approval gates** (`lesson --accept` at rapidtool-cli.mjs:1348 vs the new
`fixtures approve`). Both are "a human approves a machine-drafted artifact." → unify the verb shape
+ the store action (one `humanApprove(kind, ids)` pattern) so the console + CLI share one mental
model and one honest "this was human-approved" ledger field.

6. **Two verification mechanisms that can disagree.** `verify.server.ts` `generateCases`
(LLM-authored boolean cases, single-module path) vs the new fixture spec (human-approved, tree
path). A6 keys dod on the fixture spec but never says whether `generateCases` is REPLACED, kept
advisory, or reconciled. → decide: the fixture spec is the authoritative functional gate; demote
`generateCases` to advisory (it already says "ADVISORY ONLY" at verify.server.ts:268) and remove the
dual-verdict ambiguity.

7. **Fixture determinism vs the LLM-drafted typed literals.** A5.0's typed draft is non-deterministic
(the LLM proposes different `given`/`expect` each time), but the repro gate (9.8) needs
same-packet → byte-identical emission. → freeze the approved fixture set under a content hash
(stored with `acceptanceFixtures`), and the run REFUSES to start if the brief/spec hash ≠ the frozen
hash (ties C6's staleness to the repro gate).

8. **Privacy / data-leak in fixtures.** A fixture `given`/`expect` could carry real PII or a key that
gets (a) persisted in the project JSON and (b) shipped verbatim in `tests/fixtures.brief.json`. The
code-injection guard (JSON-stringify) does NOT cover data-leak. → add a redaction note + a "no
secret-looking values" validator flag at draft time (like the code-marker scan, but for
`sk-`, `api_key`, 10+ digit numbers, email patterns) — advisory, surfaced at approve time.

9. **"No target" failure mode (C2).** If the synthesis `reqTrace` fails to map a requirement (the
model didn't emit `// req-N` on any function), the fixture has no export to call. The plan says
"resolve via reqTrace" but not the FAILURE: is the fixture red-carded, silently skipped, or a hard
gate? → define it: an approved fixture with no resolvable target is a RED card at draft time
("requirement has no synthesized target — the spec did not implement req-N"), never a silent skip.

10. **No component/test harness for the UI.** 165-A noted "no component test exists for console.tsx"
and proposed a Wild-strip smoke test as the highest-leverage new test. → add it (and the console
store-action fixtures) to Phase D, or the 27 UI fixes in §11.1 stay unregression-tested.

---

## 14. PRODUCT + AGENT-ERGONOMICS GAPS (the "will an agent actually use it / will it truly learn" lens)

Code audits can't see these — they're about the *product*, from three viewpoints: a dumb first
glance, an AI agent actually operating the tool, and a user who needs shipped, well-designed,
self-learning software.

### 14.1 DESIGN QUALITY IS UNMEASURED (the user's #1 stated preference)
No M-criterion and no gate measures whether the produced software is **well-designed / easy to
use / polished**. The factory scores identifier-presence + behavior, but never "does this UI look
like something I'd ship" — and the user's explicitly-stated taste (Codex / Hermes dark theme,
terminal-style views) is unrepresented in any gate. → add a design dimension: a static design-
signal check (consistent theme tokens, responsive classes, a11y attrs) + an optional human
design-review gate, surfaced as a new criterion (M-design) or folded into M6 handover. Where:
`maker-score.ts` (new criterion) + `scaffold.ts` (emit a design-manifest). Without it, "10/10
functional" can ship a UI the user would never accept.

### 14.2 "WILL IT TRULY LEARN / REMEMBER?" — honestly, not yet
The lesson store captures + partially reads back (166-C1 corrected the "write-only" claim), but
NOTHING proves a lesson improves later output: C2's eval-gated promotion is still a plan item, not
built; there is no cross-run A/B ("did lesson X move the score up?"); and memory is per-project +
per-browser (localStorage, no migrate — 165-B1), with no cross-project 2nd brain (D2). → the honest
answer to "does it learn from mistakes over time" is **no, not verifiably**. The fix is C2 (eval-
gated promotion with a falsification kill-criterion) + D2 (cross-project index) + B1 (versioned
persistence) — land these before claiming a "self-learning" factory.

### 14.3 NO UNDO / SNAPSHOT / VERSION HISTORY
Every advance is irreversible (no git, no snapshot, no rollback). A bad run, a wrong approve, or an
agent's mistake cannot be undone. → snapshot the project (a bounded ring of prior packets) before
each advance/approve, and add an `undo` verb + store action. Where: `store.ts` (a `history` array
or a `snapshots` ring) + `engine.ts` (snapshot on advance) + `rapidtool-cli.mjs` (`undo`).

### 14.4 NO FIRST-CLASS "SEE WHAT IT BUILT" SURFACE
The factory produces a tree but there is no obvious code viewer / artifact browser in the console —
the produced source isn't first-class-visible. An agent (or human) can't glance at "here's the code
it wrote" without digging. → a code/artifact panel (list the emitted tree files, click to view
source + the passing tests). Where: `console.tsx` (a new panel) + `export`/`artifacts` verbs already
return the data.

### 14.5 FEEDBACK LOOP IS POSSIBLE BUT NOT DISCOVERABLE
`reject` + the chat + `lesson` exist, but "no, that's wrong — do X instead" mid-run is not an
obvious, one-click affordance. An agent using the tool needs a clear "course-correct" surface tied
to the current phase/gate. → a per-gate "redirect" affordance (reject-with-instruction) surfaced in
the console, wired to the reframe/repair path.

### 14.6 THE CLI MACHINE-CONTRACT ISN'T VERSIONED OR STABLE
The CLI is explicitly "a JSON contract parseable by an AI agent," but the envelope shapes DRIFT
(165-C-8: counts vs arrays in one object) and there is no schema version / changelog an agent can
pin against. → emit a `schemaVersion` on every CLI envelope + a `docs/cli-schema.md` + a drift test
that fails when a field type changes (the 165-C-8 normalization is the first step).

### 14.7 GENERATED-CODE QUALITY IS UNVERIFIED
`treeRun` compiles + runs the oracle spec, but never lints / formats / type-checks the PRODUCED code
against quality standards. "100% ready to ship" needs the produced code to pass `tsc --noEmit` +
`eslint` too, not just "it parses + the stub tests pass." → extend the B1 build gate (C7) to run
`tsc`/`eslint` over the emitted tree, not just `vite build`.

### 14.8 PERSISTENCE IS BROWSER-LOCAL ONLY
"Remember over time / across sessions / across devices" needs more than localStorage: at minimum an
export-first flow (a visible "save/download project.json" as the primary save), ideally a file/DB
backend. Where: `store.ts` persistence + a "Save to file" primary affordance + the vault sibling.

---

## 15. WAVE-167 BENCHMARK FINDINGS — basic safeguards the top factories have that RapidTool lacks

Full text: `fixes/167_a.md` (OpenHands+Codex), `167_b.md` (MetaGPT+ChatDev), `167_c.md`
(SSSF+smol+gpt-engineer). Each benchmarked the reference repos' ACTUAL code and grep-anchored
RapidTool's status. The cross-cutting headline + the new items:

### 15.1 TOKEN/COST BUDGET IS THE #1 MISSING SAFEGUARD (flagged by every benchmark)
`deepseek.server.ts` parses `usage` (:420-432) and then DROPS it. The crew path has
`maxTotalTokens` + a pre-dispatch worst-case guard (crew.server.ts:910-985); the ENGINE path has
zero accounting. All three references have the analog: MetaGPT `max_budget → NoMoneyException`
(team.py:92-100), Codex `SessionBudgetExceeded` + `token_budget.rs`, OpenHands `accumulated_cost`
+ throttling. → add a pure `accountUsage` + `journeyBudgetExhausted` + a new `RT_E_BUDGET_EXHAUSTED`
code (with ERROR_CODE_DOC entry in the same patch — §10.1 F8), accumulate real usage into the run
ledger, and hard-stop a journey that exceeds a configured budget (honest, loud — ties §13-3 journey
deadline + B3's "usage already parsed, never accumulated").

### 15.2 `run.finish(accepted)` split-brain (167-C-1, honesty bug)
The CLI saves `status:"complete"` (rapidtool-cli.mjs:412) and THEN computes red gates + exits 1
(:422-440) — no single terminal writer, so the persisted status and the process exit code can
DISAGREE (a run saved "complete" that exits 1). → add a pure `runAcceptance()` + an additive
`Project.acceptance` field so ONE writer stamps the terminal state (accepted|failed|aborted) and the
exit code + status + gate verdicts all derive from it. This is the SSSF `run.finish(accepted)`
semantic RapidTool lacks.

### 15.3 Kill-honesty (167-C-2)
No SIGTERM/SIGINT handler stamps `run.aborted` — a killed run leaves no terminal record (SSSF
`_finalize_when_killed` is the analog). → a signal handler that writes `acceptance:"aborted"` + a
`run.aborted` log before exit.

### 15.4 Sandbox is confirmed NOT a security boundary (167-A-1, grounds §14/B4)
`node-runner.server.ts:4-17` self-labels "NOT a security sandbox"; LLM-authored modules run as a
`node -e` child with host-user privileges. Codex uses bwrap+seccomp/Seatbelt; OpenHands Docker/E2B.
→ the honest position is a resource boundary + the invariant "generated code never executes in the
engine process" (already §8.3/B4); a real sandbox (subprocess with dropped privileges / a container)
is the P1 upgrade, not a P0.

### 15.5 Fail-fast arg validation + run-start idempotence + rerunnable evidence (167-C-3/4/6)
CLI args are validated inconsistently (ties 165-C-5/6); no run-start idempotence marker (SSSF's
pinned `adw_id` analog) to prevent double-fire; and no rerunnable-evidence artifact (prompt+response
logged) for the "same packet → same result" repro gate (§9.8). → a shared `validateArgs` + a
run-id marker + an evidence manifest.

### 15.6 Verified-resolved (don't re-hunt)
`headless.loadProject` delegates to `io.importProject` — the 164-A "weaker item" about CLI file-load
validation is CLOSED. Also resolved-negative: no human Y/n exec gate needed (the bounded runner
already covers it); smol is a control group (fewer safeguards, not more).

---

## 16. WAVE-168 FINDINGS — small features · UI/output · one-shot working code

Full text: `fixes/168_a.md` (13 small-feature findings), `168_b.md` (9 UI/output findings),
`168_c.md` (8 kind-scaffold findings). Headline items:

### 16.1 Small features (168-A)
- **`Project.notes` (the CLAUDE.md/AGENTS.md analog) is injected into NOTHING** (168A-1) — the
  single most important "agent self-instruction" surface exists as data but reaches no prompt. →
  inject `notes` into the synthesis/chat/crew context (bounded) exactly like Claude Code/Codex
  inject CLAUDE.md/AGENTS.md.
- No memory PINNING (168A-3), no "add memory" affordance (168A-4); `chatLog` silently `.slice(-40)`
  drops old rows with no auto-compaction (168A-2) → add a compaction/summary step.
- Delegation (already the strongest area — don't rebuild): gaps = crew transcripts not persisted
  (168A-5, partial runs can't continue), no abort/kill for a run that can block 12×90s (168A-6).
- Persistence: no `beforeunload` guard + interrupted-op marker during in-flight ops (168A-8); the
  saved-indicator is blind to a real persist failure (168A-9, complements 165A-10).
- Code output (diff/zip/syntax-highlight/open-in-editor) — see the full file; the diff view is the
  highest-value (ties 168B-2).

### 16.2 UI/output features (168-B) — all ABSENT unless noted
- **Run history** (168B-1): only per-phase snapshot replay; re-runs overwrite artifacts. → a
  `runLog` + a runs popover.
- **Diff view** (168B-2): no version pairs exist (same-id replacement). → versioned bodies + a pure
  `diff.ts`.
- **Progress/ETA** (168B-3): no elapsed/ETA anywhere for the long keyed synthesis (spinner only).
- Theme toggle, export formats (zip/single-HTML/markdown report), completion notifications, a
  dashboard, the preview pane, and a11y gaps (Modal no focus-trap, no skip-link/reduced-motion) —
  full spec in `168_b.md` (i18n is absent-by-design; spec a minimal `ui-strings` seam).

### 16.3 One-shot working code across kinds (168-C) — the "ship it" gap
- **Webapp never builds, and the synthesized logic is DEAD CODE from the browser's view** (168C-1):
  real index.html + vite.config + main.tsx ARE emitted, but `compile-check` is per-file transpile
  only, `treeRun` skips UI shells, `emit --verify-kind` is DECLARED (scaffold.ts:465, errors.ts:285)
  but has **no verb in the CLI**, and the console shell imports NONE of the emitted store/tree
  modules. → wire the `--verify-kind` verb + `vite build` + make the shell import the entry (this
  is the concrete C7/B1 closure).
- **Game** (168C-2): `bootGame` appends a canvas + `TODO(E-15) stub` — no loop/input/state. → a
  pure `step(state, input)` + a thin rAF boot adapter (headless-testable).
- **Tool/library** (168C-3+): spec a real `bin` entry + consumable module + README (see full file).

**Cross-cutting:** 168-C confirms the one-shot bar needs the iteration loop: synthesize → build
(real `vite build`, not transpile-only) → fail → repair-with-delta (163-C-F1) → rebuild, with the
preview pane as the human-visible proof.

---

## 17. WAVE-169 FINDINGS — upload/file-output · software-design · UI-design · catch-all features

Full text: `fixes/169_a.md` (6), `169_c.md` (UI-design), `169_d.md` (9 catch-all); 169-B
(software-design) capped without writing — findings G1-G6 transcribed here.

### 17.1 Upload / file-output (169-A)
- **No existing-codebase ingestion** — `create` is fresh-brief-only; `importTreeDir` is a ledger
  re-import (not "continue on this repo"). No arbitrary-repo read.
- **No archive output** — `export` is JSON-only; zip/tar = zero hits (OpenHands packs tar.gz in
  browser; gpt-engineer push/pull FilesDict).
- **No single self-contained HTML deliverable**; UI export is instruction-only.
- **Emitted scaffold isn't a shippable skeleton** — no LICENSE, no .gitignore, no git step (SSSF
  commits per phase; gpt-engineer stages to git).

### 17.2 Software-design output (169-B) — the produced software has no design artifacts
- **G1** No PRD/requirements doc emitted (MetaGPT writes prd.json + PDF). → emit `docs/PRD.md` from
  lattice+specGraph+oracle.
- **G2** No architecture doc/diagram for the PRODUCED app (`diagram.ts` draws only the engine run).
  → emit `docs/architecture.md`/SVG over spec-graph modules + data flow.
- **G3** Schema is typed-interfaces only — field banks (`{name,type}`), no relations/FKs/invariants,
  no SQL/DDL/migrations. → A6 gains relations; emit real `schema.sql`/`migrations/` + validation.
- **G4** OpenAPI is a string-concat stub (`summary`+`200 ok` only), never written to disk; `route()`
  throws `TODO(E-15)`. → real schema-bearing OpenAPI from A6 endpoints, emitted to disk.
- **G5** The keyed lane BYPASSES the spec graph — chunks IIFE-assemble into one 38 KB file; no
  cohesion/module-boundary directive. → chunk along spec-graph nodes; forbid >N KB files; per-file
  purpose + dependency contract in the chunk prompt.
- **G6 (real bug) — `errorHandling` + `dataFlow` are captured but NEVER RENDERED.** `prompt-engine.ts`
  captures them in ExpansionSpec, and `p6SynthesisChunkUserPrompt` (codegen.server.ts:377) declares
  them in its type, but renders ONLY requirements/typeSignatures/negativeConstraints/edgeCases — the
  model never sees the error-handling or data-flow requirements. System rule 6 says "never test
  rejection paths." → render both fields; inject a typed-error/validation contract into
  typeSignatures; add a DoD gate that the generated code names a defined error kind.

### 17.3 UI-design output (169-C) — the emitted UI is CSS-less
- **169C-1** The emitted webapp ships ZERO CSS — no stylesheet/link/import; browser-default text.
- **169C-2** Tailwind v4 is DECLARED (scaffold.ts:452-453) but never wired — emitted vite.config
  registers only `react()`; no `@import "tailwindcss"` → dead deps / latent build-breaker.
- → wire Tailwind + emit a dark design-token `styles.css` + a minimal component set (buttons/cards/
  inputs) so the produced app matches the RapidTool console aesthetic (ties §14.1 design-quality).

### 17.4 Catch-all features (169-D)
- **Extension without forking** — 33 verbs in one switch + fixed 13 phases (OpenHands `.agents/skills`,
  MetaGPT roles, gpt-engineer preprompts). → a plugin/verb-registry hook (P1).
- **Multi-language output** — TS-only by construction (codegen.server.ts:163).
- **Per-module unit tests** — the runner executes all `tests/*.spec|*.test.ts` but the emitter
  produces exactly ONE `oracle.spec.ts` (scaffold.ts:188-191). → emit per-module unit tests from the
  fixture cases.
- Plus (full file): doc-gen (JSDoc/README), CI/CD + Dockerfile + deploy config, DB migrations,
  telemetry in the produced app, git init/commit, HTTP-server output, config/.env.example, and
  retry/backoff helpers injected into produced code that calls external APIs.

---

## 18. EXECUTOR'S BRIEF (authoritative execution sequence — full text in `fixes/170_b.md`)

§0–§17 is the *plan*; this is the *order to do it in*. A fresh executing model should read 162
once, then follow §18 (and `fixes/170_b.md` for the full per-item gotchas). Where §18 reorders
§2/§8.9, **§18 is authoritative**.

### 18.1 The P0 sequence (do in this exact order, gate after each)
1. **T0.1** zustand persist `version:1` + `migrate()` (before ANY schema add — 165-B1).
2. **T0.2** `generatedTree` round-trip preserves unknown per-row keys (io.ts:243-248, engine.ts:2163-2168).
3. **T0.3** `executeAsync` stop-reason adds `|| next.dodBlocked` (store.ts:1231).
4. **T0.4** headless `advanceOnce` honors `enforceDod` + `"dod"` in `RunOutcome` (:451).
5. **T0.5** hydrate clamps hole-in-phases payloads + `hydrate.repaired` token.
6. **T0.6** `driveP6Journey` mints `tested` only AFTER `gate.passed` (also `repairTreeDir` :1813-1948).
7. **A0** real multi-file tree assembly (IIFE→importable per-file modules, emitted to disk).
8. **A1** persist `acceptanceFixtures` (+ C2 `target`, C6 `briefHash`).
9. **A2** emit fixtures + behavioral spec (with §12-2 PKG-test + §13-2 `effect` harness corrections).
10. **A3** assert entry BEHAVIOR via `runEntryFile` (reframed per §12-1; NOT a new `dataEntry` field).
11. **A7** canonical-score gate + emit-dir reconciliation (before A4).
12. **A4** re-key M1/M2 on the behavioral TAP.
13. **A5.0** LLM-assisted typed-draft step (MANDATORY — without it `fixtures draft` = zero cases).
14. **A5** human-approve surface (`fixtures draft|approve|reject`).
15. **A6** gate journey + DoD on behavioral + repair-with-delta.
16. **PHASE-A GATE** — four gates + a NEW keyed run whose multi-file tree's approved fixtures pass.

Then Phase B (production) → C (self-learning) → D (autonomy/UX) → E (final honesty).

### 18.2 The 10 do-not-skip hard rules (§8 distilled)
R1 four gates after every item (never skip `build` — it's the client-bundle guard + runs db:migrate) ·
R2 client-bundle guard (concatenated-spec lazy import + `typeof window`) · R3 byte-parity pins are
sacred (additive-absence-only fields) · R4 never auto-approve a fixture · R5 behavioral evidence =
runner TAP only · R6 shell discipline (never `. .env` in the gate shell; rg fails on the space path)
· R7 fixture-emission safety (JSON.stringify, substring `throws`, partial shape-match) · R8 re-grep
before every patch · R9 lint bans (String.fromCharCode, `.ts` imports, RT_E code + doc entry same
patch) · R10 honest failure (never fake a green; prove a flake standalone).

### 18.3 The 5 most likely ways an agent breaks this codebase
1. Byte-parity violation (breaks ~1447 frozen-baseline tests at once) · 2. client-bundle build break
(static/dynamic node:fs import) · 3. env-key leak flips the suite red (chase a ghost) · 4. recording
success past a red/hard gate (the F2/F3/9.6/165-C-1 cluster — gate-first ordering) · 5. ledger/disk
divergence + fabricated evidence + auto-approval (A7 canonical-score gate, runner-TAP-only, real-
actor stamps).

### 18.4 Definition of done (abbreviated)
- **A:** keyed multi-file tree's approved fixtures pass under `treeRun`; M1/M2=1 naming the count;
  floor/refused run still ~5/9.
- **B:** `emit --verify-kind` runs the real build; provenance + real usage metering; `runAcceptance`
  single terminal writer + kill-honesty.
- **C:** every synthesis/repair prompt carries the domain's prior lessons; retired lessons never
  re-enter; eval-gated promotion with before/after delta.
- **D:** keyed swarm = real bounded seats; cross-project knowledge search; streaming; resume/
  checkpoint; real-actor stamps; blinded judge; `RT_E_BUDGET_EXHAUSTED` hard-stop.
- **E:** full-corpus keyed re-run (slice lifted to a flag) + diverse corpus; eval regression suite;
  truth-in-docs; final audit lands 8-9/10 with the human-approve act as the only residual gap.

---

## 19. FINAL ERRATA (170-A fact-check of the merged §9–§17 — 6 corrections)

Integrity verdict: **CLEAN** — all §0–§17 present once, in order, ends cleanly, siblings intact
(165_b/169_b/166 were self-documented as folded-into-162, not lost). These 6 corrections apply to
the merged sections:

1. **§9.6 is now CLOSED** — post-fixes/159, a red/absent gate already returns `outcome:"failed"`
   (never "converged"). Residual micro-item only: the mint (:1402) still precedes the gate-record
   (:1406), so a failed project can carry a `tested` mint — fold into T0.6.
2. **§10.1 F2** — the fix-target predicate is store.ts **:1231** (body spans 1222-1248), not :1228.
3. **§13.2** — `BriefFixtureExpect` kinds are `shape | throws | property` (:59-63); the fixture
   `kind` field is `pure|effect|property` (:36). Read "implements `pure`" as "implements
   `shape`(pure return) + `throws`".
4. **§16.1 168A-1 (overstated)** — `Project.notes` is NOT injected into any LLM prompt (true), BUT
   it IS consumed by `exportPacketText` (io.ts:363-365), the compiled Agent Packet (packet.ts:338+),
   and the advisory secops scan (swarm.ts:498). Correct "injected into NOTHING" → "injected into no
   LLM prompt, but consumed by the packet/export/scan surfaces."
5. **§17.2 G6** — System rule 6 (codegen.server.ts:176) is "Never test rejection paths **inside the
   module**; guards are behavior, not bugs" — keep the qualifier in the DoD-gate wording.
6. **Minor slack** — `approve`/`--force` at headless :631-658 (not 640-652); crew budget scaffold
   :900-930 (not 910-985); lesson read-back injection at codegen :1119-1124 (not :728).

**Not independently web-verified (170-A capped before its web phase):** §15's external benchmark
anchors (MetaGPT team.py:92-100, Codex token_budget.rs, OpenHands accumulated_cost, SSSF
run.finish, gpt-engineer FilesDict). These originate in the grounded `167_a/b/c.md` files (each
fetched its reference's actual code); treat as "sourced in 167, not re-fetched here."











