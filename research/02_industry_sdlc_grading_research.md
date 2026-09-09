# 02 — Industry SDLC Processes, Quality Gates & Grading Criteria (research for RapidTool)
**Purpose.** RapidTool is a client-side "autonomous software agency" console that executes a deterministic
13-phase governed software-development graph (P0 deep research & feasibility scorecard → P1 state-graph
orchestration → P2 memory/context → P3 MCP+A2A tools → P4 security/isolation [HITL] → P5 validation/HITL
[HITL] → P6 code generation → P7 domain/market research → P8 UI prototyping [HITL] → P9 CI/CD routing
[HITL] → P10 local-edge inference → P11 real-time web tools → P12 documentation/OpenAPI/ADR). This file
surveys the industry-standard processes, quality gates, and grading criteria that such a "software factory"
should encode, and maps each onto RapidTool's phases as ready-to-adopt checklists, rubrics, and pseudocode.

**Reading guide.** Each topic (§1–§10) gives: the industry standard(s) with URLs and quoted checklist items;
where RapidTool is stronger/weaker; and ready-to-adopt specs (checklists, pseudocode, JSON). §11 = prioritized
adoption list. URLs cited inline were fetched and verified during research (July-2026 session).

---

## §1 SDLC phase-gate / stage-gate models: Definition of Ready, Definition of Done, exit criteria
### 1.1 The industry standard
**Stage-gate.** Classic engineering governance (R.G. Cooper, "Stage-Gate Systems: A New Tool for Managing
New Products", *Business Horizons*, 1990: https://www.sciencedirect.com/science/article/abs/pii/000768139090040I ;
overview: https://en.wikipedia.org/wiki/Phase%E2%80%93gate_model ) splits work into stages separated by gates: each gate
compares the work product against **pre-defined exit criteria** and the project is **killed, recycled, or allowed
through**. RapidTool's 13-phase graph has this shape already, so the lesson applies directly: gates need *written*
criteria, an *owner*, and a *decision record* (§7), or they become rubber stamps.

**Agile Definition of Done (DoD).** Agile Alliance glossary
(https://www.agilealliance.org/glossary/definition-of-done/ ): the team "agrees on, and displays prominently … a list
of criteria that must be met before a product increment … is considered 'done'"; unmet criteria mean work should not
count as done. Its key warning: "done" is ambiguous ("done programming" vs "DONE-done" = programmed, test data
created, actually tested, deployable, documented), and a DoD that is "merely a shared understanding, rather than
spelled out … may lose much of its effectiveness."

Scrum.org (https://www.scrum.org/resources/what-definition-done ) calls the DoD "a formal description of the state of
the **Increment** when it meets the quality measures required for the product"; "If a Product Backlog Item does not
meet the Definition of Done, it cannot be released yet." Its health-app example list — "All testing completed; No
known defects; Code review completed and passed; Meets HIPAA Compliance standards; Meets general security
requirements" — maps 1:1 onto codegen exit criteria (oracle green, zero known defects, review passed, security gate
passed).

**Definition of Ready (DoR).** The mirror image, applied *before* work enters a phase (Agile Alliance:
https://www.agilealliance.org/glossary/definition-of-ready/ ; Scrum.org: https://www.scrum.org/learning-series/definition-done ):
criteria a backlog item must meet before a team commits (clear description, acceptance criteria, dependencies known,
testable, sized). For RapidTool: DoR = "this phase may start", DoD = "this phase may exit" — both machine-checkable
artifact predicates, not vibes.

**SAFe / release trains.** SAFe's Definition of Done for Features/Stories (framework moved to
https://framework.scaledagile.com/definition-of-done/ in 2025; the legacy scaledagileframework.com URL 404s) extends DoD
to feature level (acceptance criteria met, solution demoed). Lesson: gates exist at *two levels* — per-artifact
(story/PR) and per-release-batch — and RapidTool P9 should gate at both granularities.

### 1.2 RapidTool: stronger / weaker
- **Stronger:** RapidTool already has a deterministic phase graph, per-phase HITL gates with a ≥12-character
  rejection-note requirement, and a 5-axis feasibility scorecard — more explicit gate structure than most
  human teams ever write down.
- **Weaker:** there is no published per-phase DoD checklist that the state graph can verify (gates check
  "approval given" more than "artifacts satisfy named exit criteria"), no DoR ("ready for phase") predicate,
  and no gate decision record persisted as structured data (see §7).
- **Weaker:** the P0 scorecard collapses to a single /10 with no documented *kill thresholds*, no
  *guard-extraction* step for "proceed-with-guards", and no uncertainty/confidence input — stage-gate
  research says the value is in explicit, pre-agreed decision rules, not the number itself.

### 1.3 Mapping — ready to adopt
**A. Per-phase DoD registry (machine-checkable).** Each phase exit becomes a predicate over artifacts:

```text
DoD[phase] = [ {id, criterion, evidence(artifact field), checks: [probe names]} ]
```

Proposed registry (abridged; criteria phrased so a deterministic probe can answer yes/no):

| Phase | Definition-of-Done (exit) criteria (all must hold) | Definition-of-Ready (entry) criteria |
|---|---|---|
| P0 research/feasibility | scorecard has 5 axis scores + evidence refs; verdict ∈ {proceed, proceed-with-guards, reframe}; guards list non-empty iff verdict=proceed-with-guards; ≥2 competitor/alternative sources cited (Agile Alliance "actually tested… documented" analog) | user brief stored; target user + problem statement + success metric named (DoR/INVEST: https://www.agilealliance.org/glossary/invest/) |
| P1 orchestration | state graph edges for all 13 phases present; cycle guard active; artifact manifest schema versioned | P0 verdict=proceed*; exit artifacts of P0 attached |
| P2 memory/context | session context ≤ budget; episodic/procedural/semantic entries all scored; no PII in semantic store by default (GDPR §6: https://gdpr-info.eu/art-25-gdpr/) | P1 manifest valid |
| P3 tools | tool capability list vs task needs (MCP/A2A); every tool has input/output schema + failure mode documented; no tool has network egress unless declared (see §6) | P2 context loaded |
| P4 security/isolation [HITL] | threat model artifact (STRIDE, §6) exists; sandbox policy enforced: no ambient secrets, no egress, fs write allowed only in workdir; dependency + secret scans run and clean (or findings waived with note ≥12 chars) | P3 capability gap resolved |
| P5 validation/HITL [HITL] | every acceptance criterion has ≥1 test or recorded manual check; rejection notes ≥12 chars (kept); no unresolved blocking review comments (Google review standard, §3) | P4 isolation verified |
| P6 codegen | code runs in sandbox; oracle result = {fail_to_pass: all pass, pass_to_pass: all pass, evidence: outputs} (SWE-bench Verified rubric, §5); lint/static gate clean on new code (§9) | tests for the feature exist and fail (verification-first, §4); A7 test-oracle cases frozen |
| P7 domain/market | competitor matrix rows ≥ N with sources; claims link to URLs; "static" caveat recorded | P0 problem statement re-attached |
| P8 UI prototyping [HITL] | prototype screens exist for all user flows in spec; each screen shows evidence (screenshot); human approved | flows enumerated from spec |
| P9 CI/CD routing [HITL] | promote path chosen from decision matrix (§8); canary/rollback plan recorded when prod target; pre-deploy gates all green (§6, §9) | P6 oracle green; P5 approvals archived |
| P10 local-edge inference | model card: name, size, license, warm-up, eval self-score; privacy note (data stays local) | task requires inference; model license allows use |
| P11 real-time web tools | rate-limit & retry policy documented per endpoint (DORA "API/rate-limit risk" axis); failure fallback defined | P3 tool registry updated |
| P12 docs/OpenAPI/ADR | OpenAPI generated & validated; ADRs written for every architecturally significant decision (§7); README runnable | all prior gates passed |

**B. Generic gate function.** All gates share one control flow so behavior is auditable:

```python
def run_gate(phase: str, artifacts: dict) -> GateVerdict:
    checklist = DOD[phase]                      # deterministic, versioned, editable only via PR (ADR rule)
    results = {item.id: probe(item, artifacts) for item in checklist}
    unmet   = [i for i, ok in results.items() if not ok]
    if unmet:
        return GateVerdict("REJECT", reasons=unmet, suggestions=guard_suggestions(unmet))
    record_gate_event(phase=phase, verdict="PASS", evidence_hashes=hash(artifacts))  # SOC2 audit trail, §6
    return GateVerdict("PASS")
# Rules: no REJECT without ≥12-char human note when the gate is HITL; no PASS without evidence blob hashes;
# gate events append-only to the audit log (CC6/CC7, §6) and to episodic memory with a score (P2).
```

**C. Verdict math improvement (P0 scorecard).** Keep the 5 axes but add: (1) per-axis *evidence strength* (0–1) so a
confident 8 and a guessed 8 differ; (2) weighted mean with per-project-type axis weights; (3) hard rules (security
posture < 5 ⇒ verdict never exceeds `proceed-with-guards`); (4) confidence interval on the overall score; (5) guard
extraction: every axis < 7 emits ≥1 named guard with owner phase. Mirrors spec-kit's `go / needs-clarification / kill`
assess outcome (https://github.com/github/spec-kit ) and stage-gate kill/recycle semantics.

```python
def verdict(axes: dict[str, AxisScore], weights: dict[str, float], rules: list[Rule]) -> Verdict:
    wsum = sum(axes[a].score * weights[a] * axes[a].evidence for a in axes) / sum(weights.values())
    guards = [Guard(axis=a, text=axes[a].guard) for a in axes if axes[a].score < 7]
    if any(not rule.passes(axes) for rule in rules) or wsum < 6.0: return Verdict("REFRA ME")  # → reframe
    if guards or wsum < 7.5:                    return Verdict("PROCEED_WITH_GUARDS", guards=guards)
    return Verdict("PROCEED")
# Deterministic + logged; human may override only with a ≥12-char note that itself is logged (P5 rule).
```

---

## §2 DORA metrics + SPACE framework: can a codegen pipeline be graded on proxies?
### 2.1 The industry standard
**DORA (DevOps Research & Assessment)** — the canonical page is DORA's own guide,
https://dora.dev/guides/dora-metrics-four-keys/ . Note the current model: DORA moved from the famous "four
keys" to **five software delivery performance metrics** (history: https://dora.dev/insights/dora-metrics-history ):

- **Throughput:** *Change lead time* — "the amount of time it takes for a change to go from committed to version
control to deployed in production"; *Deployment frequency* — "the number of deployments over a given period or the
time between deployments"; *Failed deployment recovery time* — "the time it takes to recover from a deployment that
fails and requires immediate intervention" (successor to MTTR).
- **Instability:** *Change fail rate* — "the ratio of deployments that require immediate intervention following a
deployment, likely resulting in a rollback … or a 'hotfix'"; *Deployment rework rate* — "the ratio of deployments that
are unplanned but happen as a result of an incident in production."

DORA's guide insights double as design rules for RapidTool: "speed and stability are not tradeoffs… top performers do
well across all five metrics"; metrics are **leading indicators for org performance but lagging indicators for
practices**; apply "at the application or service level," never blended. Its pitfalls list is a governance spec:
(1) "Setting metrics as a goal… Ignoring Goodhart's law"; (2) "Having one metric to rule them all… identify multiple
metrics, including some with a healthy amount of tension between them"; (3) disparate comparisons; (4) siloed
ownership; (5) measurement at the expense of improvement. Also recommended: reduce batch size
(https://dora.dev/capabilities/working-in-small-batches/ ) and baseline with the Quick Check (https://dora.dev/quickcheck ).

**SPACE** (Forsgren et al., "The SPACE of Developer Productivity", ACM Queue 2021 —
https://queue.acm.org/detail.cfm?id=3454124 , DOI https://doi.org/10.1145/3454122.3454124 ): productivity "cannot be
measured by a single metric or dimension"; five dimensions: **S**atisfaction & well-being, **P**erformance,
**A**ctivity, **C**ommunication & collaboration, **E**fficiency & flow. Myth-busts that matter here: activity alone
(PRs, commits) is gameable and ambiguous; individual metrics miss team value (review, on-call); "one metric that
matters" is a myth. For an autonomous factory, the human-side dimensions become the HITL's satisfaction/latency and
the agent's efficiency/flow — see §10.

### 2.2 RapidTool: stronger / weaker
- **Stronger:** RapidTool's P2 episodic-memory-with-scores design is a natural home for delivery telemetry;
  the deterministic phase graph gives clean event timestamps for lead-time measurement that human orgs have
  to scrape from five tools.
- **Weaker:** no DORA-style telemetry exists today (no change lead time, no fail rate over runs), so "the
  pipeline improved" cannot be argued with data; the P0 axis "delivery confidence" is an expert guess with no
  backing distribution.
- **Weaker:** nothing measures the human side (SPACE S/C): no HITL latency, no approval-friction signal, no
  rejection-rationale taxonomy — the SPACE lesson is that throughput-only self-grading will silently reward
  a fast, wrong pipeline (Goodhart).

### 2.3 Mapping — ready to adopt
**DORA-style event record.** Every run appends immutable events; telemetry is derived, never self-reported:

```json
{ "event": "phase_exit", "run_id": "RT-2026-071", "phase": "P6", "gate": "PASS",
  "ts": "2026-07-01T10:02:11Z", "artifacts_sha": "a1b2…", "human": null }
{ "event": "artifact_accepted", "run_id": "RT-2026-071", "phase": "P5", "by": "user",
  "note_len": 24, "ts": "…" }                      // also serves SOC2 CC6/CC7 audit evidence (§6)
```

**Proxy metric definitions for a codegen factory** (label them *proxies*; DORA: metrics must not be blended
across contexts):

| DORA metric | RapidTool proxy | Why defensible / caveat |
|---|---|---|
| Deployment frequency | accepted-artifact releases per week (gates P5→P9 passed) | analog: production deploys; caveat: no real users |
| Change lead time | spec-accepted(P5) → oracle-green(P6) wall time | analog: commit→prod; excludes human thinking time |
| Change fail rate | share of accepted artifacts later REJECTED at P5/P9 re-review, or failing oracle on regression | strongest proxy; drives "stop the line" (§8) |
| Failed deployment recovery time | time from oracle-red to oracle-green on the same artifact | recovery = re-run cost; record attempts |
| Deployment rework rate | share of releases needing unplanned re-run after a gate reopen | reuse as-is |

**SPACE-style companion panel** (so activity metrics never ride alone): Satisfaction = HITL rejection-note
sentiment/taxonomy over time + user survey (DORA Quick Check analog, https://dora.dev/quickcheck );
Performance = oracle pass rate + quality-gate score (§9); Activity = phases/hour, artifacts/run;
Communication = HITL note length distribution + question-vs-issue ratio (conventional comments labels, §3);
Efficiency/flow = approval wait time, rework loops per artifact (§10). Store all five as periodic memory
snapshots so P2 can trend them.

```python
def telemetry_snapshot(run_ids) -> dict:            # runs weekly by P2/P12 housekeeping
    return {
      "lead_time_p50_p95": quantiles(lead_times(run_ids)),
      "change_fail_rate": failed_acceptances(run_ids) / max(1, acceptances(run_ids)),
      "recovery_p50": quantiles(recovery_times(run_ids)),
      "hitl": {"median_approval_s": …, "reject_rate": …, "note_len_p50": …},
      "space": {dimension: value for dimension in FIVE_DIMENSIONS},
    }
```

---

## §3 Code review best practices, checklists, and AI code-review rubrics
### 3.1 The industry standard
**Google's Engineering Practices** is the canonical free reference. The reviewer standard
(https://google.github.io/eng-practices/review/reviewer/ ) + "What to look for in a code review"
(https://google.github.io/eng-practices/review/reviewer/looking-for.html ) condenses to a checklist the
reviewer seat of an autonomous factory can literally execute. Quoted summary (checklist):
- "The code is well-designed"; "the functionality is good for the users of the code"; "any UI changes are sensible";
  "any parallel programming is done safely"; code is "not more complex than it needs to be" (no speculative
  future-proofing); "code has appropriate unit tests… tests are well-designed" ("Tests do not test themselves… a human
  must ensure that tests are valid", tests in the same CL); clear names; comments "mostly explain *why* instead of
  *what*"; documentation and style guides followed.
- Process rules: review **every line**, look at **context**, and "don't accept CLs that degrade the code health of the
  system"; compliment developers on good things (praise is part of the standard).

Review speed rules live at https://google.github.io/eng-practices/review/reviewer/speed.html (respond quickly; prefer
"LGTM with comments" over blocking on nits) — directly relevant to HITL latency (§10). The standard also forbids
blocking on personal style ("Nit:" prefix convention).

**Conventional Comments** (https://conventionalcomments.org/ ) standardizes review-comment *labels* so tone and
blocking-ness are machine-parseable. Format: `<label> [decorations]: <subject>` + optional discussion. Labels: **praise**
("try to leave at least one… per review"), **nitpick**, **suggestion**, **issue** ("strongly recommended to pair this
comment with a suggestion"), **todo**, **question**, **thought**, **chore**, **note**; decorations: **(blocking)**,
**(non-blocking)**, **(if-minor)**. The site even shows the JSON parse target — ideal for an LLM reviewer that must
emit structured output.

**PR templates.** GitHub documents them at
https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository :
a template makes contributors supply "a reference to a related issue, a description of the changes proposed,
@mentions of reviewers." For AI-generated PRs the template is the *required context contract* (spec id, test evidence,
risk notes) without which review is guesswork.

**AI review of AI code — the 2025-26 direction.** Research and product practice both point to *independent agent
review before human sign-off*. The position paper "The End of Code Review: Coding Agents Supersede Human Inspection"
(Monperrus, arXiv 2026, https://arxiv.org/abs/2606.13175 ) documents human review of agent output degrading into
"rubber-stamps: the human approves because the code looks correct, because the tests pass, and because the cognitive
cost of genuine scrutiny is prohibitive," with review latency "routinely stretch[ing] over twenty-four hours"; its
constructive claim is agent-first review with "humans providing oversight only at the margins." Cognition ships this
as Devin Review (the bottleneck "is no longer writing code… it's reviewing it,"
https://www.linkedin.com/posts/cognition-ai-labs_as-engineers-increasingly-adopt-ai-coding-activity-7419846154617610240-S3Ko )
and Devin itself was graded via deterministic SWE-bench tests (https://cognition.com/blog/swe-bench-technical-report ).
Treat the arXiv paper as a *position*, not settled science, but adopt its mechanism: an independent reviewer agent +
a human gate that checks the reviewer's work rather than re-reading every line.

### 3.2 RapidTool: stronger / weaker
- **Stronger:** the HITL gate is already a human sign-off point (P5/P8/P9); the ≥12-char note rule is a real
  anti-rubber-stamp primitive that most products lack; the A7 "Test Oracle" concept pre-figures
  verification-first grading (§4/§5).
- **Weaker:** there is no *reviewer seat* — nothing independently re-reviews generated code against the
  Google checklist before the human gate; comments, when they exist, are unstructured strings instead of
  Conventional-Comments labels, so P2 memory cannot mine rejection causes.
- **Weaker:** no PR-template-equivalent contract forces the codegen module to state spec-id, evidence, and
  risk notes per artifact; review scope ("what was reviewed, what wasn't") is not recorded, violating
  Google's exception rule and SOC2 evidence norms.

### 3.3 Mapping — ready to adopt
**A. Reviewer-seat rubric (deterministic + LLM-assisted).** The reviewer agent grades each artifact on the
Google checklist and emits Conventional-Comments JSON. Blocking logic: any `issue (blocking)` or
`chore (blocking)` ⇒ verdict `REQUEST_CHANGES`; else `APPROVE` with at least one `praise`.

```json
{ "artifact_id": "RT-2026-071-P6-03", "reviewer": "reviewer-seat-v1",
  "criteria": [
    {"criterion": "design",             "score": 4, "comment": {"label": "praise", "text": "…"}},
    {"criterion": "functionality",      "score": 3, "comment": {"label": "issue", "decorations": ["blocking"], "text": "edge case X unhandled", "discussion": "…"}},
    {"criterion": "tests_well_designed","score": 3, "comment": {"label": "suggestion", "text": "add assertion Y"}},
    {"criterion": "naming",             "score": 4, "comment": null},
    {"criterion": "comments_explain_why","score": 5, "comment": null},
    {"criterion": "complexity_no_overengineering", "score": 3, "comment": {"label": "thought", "decorations": ["non-blocking"], "text": "…"}},
    {"criterion": "docs_updated",       "score": 4, "comment": null},
    {"criterion": "style_conformance",  "score": 4, "comment": {"label": "nitpick", "text": "…"}}],
  "security_scan": {"sast": "clean", "secrets": "clean", "deps": "2 medium (waived, note ≥12 chars)"},
  "verdict": "REQUEST_CHANGES", "blocking_count": 1 }
```

**B. Generated-PR contract (template enforced at P6→P5).** Every artifact submission must carry: spec/task
ids (§7 traceability), acceptance criteria mapping, oracle + lint evidence, changed-file list, security scan
results, risk notes, and reviewer-seat output. If any field is missing, the HITL request is not created
(DoR for the human gate) — this is the GitHub-PR-template idea applied to agents.

**C. Comment taxonomy for P2 memory.** Store every human rejection as `{label ∈ {issue, question,
suggestion, chore, nitpick, praise}, decoration ∈ {blocking, non-blocking}, phase, text}`; allow free text ≥12
chars but *require* the label. This converts approval notes into mined signal (top rejection causes per
phase, §10) and is the same move Conventional Comments made for humans, now for agent memory.

---

## §4 Verification-driven development (tests first) and spec-driven development (spec → plan → tasks)
### 4.1 The industry standard
**Verification-driven development (Anthropic).** Anthropic's Claude Code best-practices documentation
(https://code.claude.com/docs/en/best-practices ) makes "Give Claude a way to verify its work" the central workflow
rule — the direct ancestor of RapidTool's A7 Test Oracle idea. Quoted: "Give Claude a check it can run: tests, a build,
a screenshot to compare. It's the difference between a session you watch and one you walk away from." Without a check,
"'looks done' is the only signal available, and you become the verification loop… Claude does the work, runs the check,
reads the result, and iterates until the check passes." "The check is anything that returns a signal… a test suite, a
build exit code, a linter, a script that diffs output against a fixture, or a browser screenshot compared against a
design." And: "Have Claude show evidence rather than asserting success: the test output, the command it ran and what it
returned, or a screenshot of the result."

Practitioner write-ups of the same loop (corroborating sources: https://www.datacamp.com/tutorial/claude-code-best-practices ;
https://harper.blog/2025/05/08/basic-claude-code/ , the latter calling TDD "the single strongest pattern" for agentic
coding) add one rule RapidTool must adopt: write tests first → confirm they fail → **commit the failing tests as a
checkpoint** → implement until green *without modifying tests* — because "Claude will sometimes change tests to make
them pass rather than fixing the implementation." Tests are frozen before codegen begins, so the pipeline cannot
launder a wrong implementation by weakening its own oracle.

**Spec-driven development (GitHub Spec Kit).** GitHub's open-source Spec Kit
(https://github.com/github/spec-kit ) turns the spec into the executable contract for any coding agent.
From its README: "Spec-Driven Development flips the script… **specifications become executable**, directly
generating working implementations rather than just guiding them." Its documented workflow, in order:

0. Establish project principles once (`/speckit-constitution`: code quality, testing standards, UX consistency,
performance requirements).
1. Specify *what/why*, not the stack (`/speckit-specify`).
2. Plan the tech stack and architecture (`/speckit-plan`).
3. Break the plan into actionable tasks (`/speckit-tasks`).
4. Implement tasks (`/speckit-implement`).
5. **Converge** implementation against spec, plan, and tasks (`/speckit-converge`); "repeat steps 4 and 5 until
`/speckit-converge` reports **Converged**."

Spec Kit's bug-fix extension codifies an `assess → fix → test` loop ("scoped, evidence-based, and documented from root
cause through verification"), and its idea-assessment extension formalizes `intake → research → define → shape → decide`
with a documented **go / needs-clarification / kill** outcome — the same ternary RapidTool's P0 scorecard should
produce (see §1.3C).

**Why this is the load-bearing standard for RapidTool:** P6 currently runs "a canned self-test module through a weak
new Function sandbox" — generated code is only as good as the tests that happen to be canned. Anthropic and Spec Kit
both prescribe the opposite order: the *spec + tests come first*, then the generator converges against them until an
oracle says green. A7's Test Oracle (happy-path, constraint, graph-safety cases) already looks like the executable
oracle this workflow demands; what is missing is *ordering* (tests authored before codegen and frozen during codegen)
and a *convergence loop* (codegen → oracle → regenerate, bounded attempts, then REJECT with evidence).

### 4.2 RapidTool: stronger / weaker
- **Stronger:** A7's three-case taxonomy (happy path / constraint / graph-safety) is genuinely ahead of
  most agent harnesses, which only check happy paths; the P0 "feasibility scorecard → verdict" structure
  maps onto Spec Kit's decide stage.
- **Weaker:** codegen is not driven by frozen tests — the canned self-test module means the oracle can be
  satisfied by a demo that has nothing to do with the accepted spec; no convergence loop with bounded
  attempts and evidence-based failure is defined.
- **Weaker:** no constitution/spec/plan/tasks artifact chain exists before P6 (no `/speckit-*` equivalent),
  so P5 human approval reviews code without a spec-diff to review against.

### 4.3 Mapping — ready to adopt
**Verification-first phase order (change to the graph, not just P6):**

```text
P0 spec & feasibility → P5-variant "acceptance test freeze" (DoR for P6 = tests exist & fail & frozen)
→ P6 codegen (converge: run oracle → if red, regenerate with failure evidence; max K=3 attempts)
→ oracle green ⇒ reviewer seat (§3) ⇒ P5 human gate sees spec + tests + evidence, not vibes.
```

```python
def converge(spec_id, tests, gen, oracle, k=3) -> ConvergenceResult:
    for attempt in 1..k:
        patch = gen(spec_id, tests)                    # tests are INPUT, not negotiable (datacamp rule)
        result = oracle.run(patch, tests)              # fail_to_pass + pass_to_pass + lint, §5/§9
        record(run_id, attempt, result.evidence)       # evidence = raw outputs (Anthropic rule)
        if result.green:  return PASSED(patch, result)
    return FAILED(evidence=[r.evidence for r in attempts])   # no silent pass, ever
```

**A7 Test Oracle grading contract (reused in §5/§9):** the oracle report must include, per case, status
(pass/fail/error/timeout), assertion evidence (actual vs expected), and runtime; totals split by case class. A case
that errors instead of failing is *not* green. Mirror SWE-bench Verified's lesson that tests themselves need human
screening (§5): a human (or LLM-with-human-approval) reviews the *test oracle* at P5, not just the code — Google:
"Tests do not test themselves… a human must ensure that tests are valid"
(https://google.github.io/eng-practices/review/reviewer/looking-for.html ).

---

## §5 Agent code-quality grading: SWE-bench Verified, Multi-SWE-bench, Terminal-Bench, Aider, agentic evals
### 5.1 The industry standard
**SWE-bench** (Jimenez et al., arXiv:2310.06770, https://arxiv.org/abs/2310.06770 ; site
https://www.swebench.com/ ) set the dominant rubric: an agent gets a real GitHub issue + repo, must produce
a patch, and correctness = **tests pass, deterministically**: "If the `FAIL_TO_PASS` tests pass, this means
the edit solves the issue. If the `PASS_TO_PASS` tests pass, then the edit has not inadvertently broken
unrelated sections… Both sets of tests are required to pass"
(https://openai.com/index/introducing-swe-bench-verified/ ). Grading is *not* an LLM judge — it is a test
run in a containerized environment (SWE-bench docker harness).

**SWE-bench Verified** (OpenAI + SWE-bench authors, Aug 2024): raw SWE-bench contained "tasks which may be hard or
impossible to solve," so 93 professional Python developers screened samples and released "500 samples verified to be
non-problematic by our human annotators." Their annotation rubric (labels 0–3 for "issue description underspecified"
and "FAIL_TO_PASS tests filter out valid solutions", ensembled by taking the highest severity of 3 annotators;
difficulty = estimated human fix time: easy 196 tasks <15 min, hard 45 >1 h) is the *process* to copy when curating
RapidTool's own acceptance library. Two quotes for RapidTool's grading module: "The tests are not shown to the agent";
and "Evaluations based on static datasets are inherently limited… large foundation models… are likely to be
contaminated." OpenAI grades agents on *autonomy-relevant* capability (resolve rate), not style.

**Multi-SWE-bench** (ByteDance, arXiv:2504.02605, https://arxiv.org/abs/2504.02605 ;
https://github.com/multi-swe-bench/multi-swe-bench ): the same test-pass rubric at scale — "1,632 high-quality
instances… curated from 2,456 candidates by 68 expert annotators" across 7 languages (Java, TypeScript, JavaScript,
Go, Rust, C, C++). Lesson: issue-resolution evals are multilingual/multi-stack, and *human curation of instances* is
the quality bottleneck — exactly the role of RapidTool's P5/HITL when it freezes acceptance tests.

**Terminal-Bench** (Merrill et al., arXiv, https://arxiv.org/abs/2601.11868 ; https://www.tbench.ai/ ): agents work in
a containerized terminal on "hard, realistic tasks" (system config, model training, research-code reproduction);
frontier agents score under 65%, graded by deterministic verifiers. Closest analog to RapidTool P6's *sandboxed
function execution*: a task is done only when a verifier inside the sandbox says so.

**Aider polyglot benchmark** (https://aider.chat/docs/leaderboards/ ): 225 OSS tasks across languages; score = pass
rate on repo tests, with pass_rate_1 vs pass_rate_2 (one-shot vs after one error-recovery round) — the "second try and
re-measure" idea maps directly onto RapidTool's bounded convergence loop. Its run telemetry is a rubric in itself:
syntax errors, indentation errors, test timeouts, malformed responses, "lazy comments", user asks, exhausted context
windows, seconds/case, cost (e.g., deepseek-v3.2-reasoner: 74.2% at $1.30/run). An autonomous factory should log the
same failure taxonomy for its own P6 attempts — those columns *are* the debugging dashboard.

**Vendor practice.** Devin (Cognition) launched on a SWE-bench technical report — "13.86% (79/570 of the 2,294-task
test set)" — arguing the full-repo *agent* setting "is the more natural setting for SWE-bench" and that deterministic
unit tests beat function-level evals like HumanEval (https://cognition.com/blog/swe-bench-technical-report ). OpenAI's
agentic-evals cookbook
(https://developers.openai.com/cookbook/examples/partners/macro_evals_for_agentic_systems/macro_evals_for_agentic_systems )
adds the two-layer method: **lower-level evals** grade each agent/tool/run (decision quality, policy correctness,
routing, *review appropriateness*); **macro evals** cluster findings across runs into `behavior_pattern`s so humans
inspect patterns, not traces — plus maintenance rules: "promote the clearest lower-level eval failures into a
regression suite; review a small sample of automated grades to calibrate rubric strictness." General frameworks:
OpenAI Evals (https://github.com/openai/evals ) and guidance (https://addyosmani.com/blog/ai-evals/ ).

### 5.2 RapidTool: stronger / weaker
- **Stronger:** the A7 oracle's happy-path/constraint/graph-safety classes are a reasonable *instance
  taxonomy*; P2 memory with scores is a plausible home for macro-eval-style pattern mining.
- **Weaker:** no FAIL_TO_PASS / PASS_TO_PASS discipline: nothing proves a delivered change (a) fixes the
  accepted criteria and (b) didn't break previously green behavior; canned self-tests invite the
  "tests unrelated to the issue" failure mode OpenAI had to filter out by hand.
- **Weaker:** no calibration loop: nothing samples human-approved outputs to measure how often the agent's
  self-grade disagreed with the human gate — the single most important eval a self-grading agent factory
  can run (macro-evals lesson).

### 5.3 Mapping — ready to adopt
**Grading contract for any P6 artifact** (SWE-bench Verified distilled):

```json
{ "grade": "PASS",                    // only when BOTH hold, deterministically
  "fail_to_pass": {"required": ["RT-…-FTP-01 …"], "passed": 5, "total": 5, "evidence": ["…output…"]},
  "pass_to_pass": {"passed": 12, "total": 12, "evidence": ["…output…"]},
  "case_classes": {"happy_path": {"passed": 2, "total": 2}, "constraint": {"2": 2},
                    "graph_safety": {"1": 1}},
  "attempts": 2, "runtime_s": 41.2,
  "self_reported": false }            // grade always computed by oracle, never by the generator
```

**Calibration eval (macro, weekly):** sample every human-approved artifact and every human-rejected
artifact; recompute oracle + reviewer-seat verdicts blind; track `human_vs_agent_agreement`, and per-phase
rejection taxonomy. If the human approves in <15 s or rejection rate < 5% while reviewer-seat flags > 0,
emit a "rubber-stamp warning" (§10, arXiv 2606.13175 finding). Store as semantic memory so P2 can trend it.

---

## §6 Security & compliance gates: ASVS, STRIDE, SAST/DAST, SOC 2 audit trail, data protection by design
### 6.1 The industry standard
**OWASP ASVS** (v5.0.0 current: https://owasp.org/www-project-application-security-verification-standard/ ; source
https://github.com/OWASP/ASVS ) exists to be "a basis for testing web application technical security controls," usable
"as a metric," "as guidance," and "during procurement." Requirement IDs are stable: `v5.0.0-1.2.5` = "Verify that the
application protects against OS command injection…" ASVS 5.0 restructured into 17 chapters, e.g. **V1 Encoding and
Sanitization, V2 Validation and Business Logic, V3 Web Frontend Security** (chapter map:
https://codific.com/owasp-asvs-a-comprehensive-overview/ ; level stats: https://quality.arc42.org/standards/owasp-asvs ).
Three cumulative levels: **L1** minimal baseline for any app, automatable, high-impact controls (~20% of
requirements); **L2** default for sensitive-data apps (~50%); **L3** highest assurance (~30%, adds architecture review,
threat modeling, pen testing). ASVS ships machine-readable CSV/JSON — a ready import for RapidTool's P4 checklist; the
chapter names are the P4 DoD skeleton (see 6.3).

**Threat modeling (STRIDE, Microsoft SDL):** https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats
defines the six STRIDE categories for enumerating threats early: **Spoofing, Tampering, Repudiation, Information
Disclosure, Denial of Service, Elevation of Privilege** (e.g., repudiation: users who "deny performing an action
without other parties having any way to prove otherwise"); mitigations:
https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-mitigations . Threat modeling is an
ASVS-L3-class activity and exactly the artifact P4 should produce per delivery target.

**SAST/DAST/SCA gates (tooling layer):** industry practice gates merges on static analysis + secret + dependency
scanning: OWASP ZAP (DAST, https://www.zaproxy.org/ ), Semgrep (SAST, https://semgrep.dev/ ), gitleaks (secrets,
https://github.com/gitleaks/gitleaks ), osv-scanner (https://github.com/google/osv-scanner ), SonarQube quality gates
(§9), GitHub code-scanning/dependabot (https://docs.github.com/en/code-security ). Rule of thumb in most CI:
**new-code issues block; legacy issues are triaged** (SonarQube "clean as you code").

**SOC 2 paper trail.** SOC 2 examinations (AICPA: https://www.aicpa-cima.com/resources/landing/system-and-organization-controls-soc-suite-of-services ;
criteria text: https://us.aicpa.org/content/dam/aicpa/interestareas/frc/assuranceadvisoryservices/downloadabledocuments/trust-services-criteria.pdf )
require documented controls and evidence. Relevant Common Criteria for an agent console: **CC6** logical/physical
access (CC6.1: "The entity implements logical access security software, infrastructure, and architectures over
protected information assets…" — https://www.designcs.net/soc-2-cc6-common-criteria-related-to-logical-and-physical-access/ )
and **CC7** system operations/monitoring (https://soc2auditors.org/insights/soc-2-security-controls/ ). Practitioner
demands: "retain authentication and access logs for all systems in scope; demonstrate that access reviews have
occurred at defined intervals" (https://sftptogo.com/blog/soc-2-compliance-checklist/ ). Translation for an
autonomous agency: **every consequential machine/human decision must be logged, immutable, attributable, and
reviewable** — HITL notes, gate verdicts, and tool invocations are the SOC 2 control evidence; localStorage-only
persistence is the top compliance blocker to fix.

**Data protection by design.** GDPR Art. 25 (https://gdpr-info.eu/art-25-gdpr/ ): implement "appropriate technical and
organisational measures, such as pseudonymisation… data minimisation," and by default process only data "necessary for
each specific purpose." NIST AI RMF 1.0 (https://doi.org/10.6028/NIST.AI.100-1 ;
https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.100-1.pdf ) organizes AI risk management into **Govern, Map, Measure,
Manage** with trustworthiness characteristics (valid & reliable, safe, secure & resilient, accountable & transparent,
explainable, privacy-enhanced, fair) and the norm that "those building and using the models [are] separated from those
verifying and validating the models" — a direct argument for A7/reviewer-seat being independent of the generator.

### 6.2 RapidTool: stronger / weaker
- **Stronger:** P4 exists as a dedicated security/isolation phase *before* codegen and P6 runs code in a
  sandbox — most agent tools bolt on isolation later; HITL rejection notes already create an audit-ish
  record; P10's "local inference" posture is genuinely privacy-strong (data minimization by architecture).
- **Weaker:** there is no ASVS-derived checklist, no threat-model artifact, no SAST/secrets/dependency
  scan in the gate chain, and no evidence that the sandbox enforces "no secrets, no egress" — so P4's HITL
  gate currently certifies intent, not controls.
- **Weaker:** persistence is localStorage-only with no audit-log semantics (append-only, attributable);
  under SOC 2 CC6/CC7 and GDPR Art. 25 this is the single most disqualifying gap for a product claiming
  governed autonomy.

### 6.3 Mapping — ready to adopt
**P4 exit criteria = ASVS L1 (web-facing artifacts) + controls for RapidTool itself.** Minimal machine-checkable
L1-derived list (ASVS-5.0-style ids; imported from ASVS JSON): no injection sinks fed by untrusted input (V1); input
validation on all boundaries + business-logic abuse checks (V2); security headers/CSP, no third-party script risk
(V3); authN/authZ only if the artifact has users; secrets never in code or logs; error messages don't leak internals;
dependency scan clean of known criticals; TLS by default. Each maps to a probe (grep-style, Semgrep rule, or sandbox
observation) so the gate is executable:

```python
ASVS_L1_CHECKS = load("https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/…/asvs.json")  # machine-readable
def p4_gate(artifact, sandbox_report) -> GateResult:
    checks = [c for c in ASVS_L1_CHECKS if c.automatable]
    return run(checks, artifact, sandbox_report)   # every failure → P4 HITL REJECT with evidence
```

**Threat model artifact (STRIDE) per delivery target** — a P4 DoD item: `threats/` markdown or JSON listing
per STRIDE category: asset, threat, likelihood/impact, mitigation, residual risk, owner. Signed-off at the
P4 HITL gate; ASVS L3-style for high-risk targets (the P0 "security posture" axis can select the level).

**Audit-log contract (SOC 2 CC6/CC7 evidence + GDPR accountability).** Move the event store to an
append-only, integrity-checked store (hash-chained records; exportable). Events: gate verdicts, HITL
approve/reject with note + note-length, tool invocations with input/output hashes, artifact accept/reject,
config changes (checklist edits), memory writes that are consequential. Retention + access review
scheduled (CC6.2). Add a one-line "data inventory" to P0/P2: what personal data is stored, purpose, default
retention — the GDPR Art. 25 by-design/by-default worksheet.

---

## §7 Architecture Decision Records (ADRs) and requirements traceability
### 7.1 The industry standard
**ADRs** (Michael Nygard, "Documenting Architecture Decisions", Cognitect 2011:
https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions.html ): "One of the hardest things to track
during the life of a project is the motivation behind certain decisions… Without understanding the rationale or
consequences, this person has only two choices: Blindly accept the decision… [or] Blindly change it." Format: short
files in the repo, "doc/arch/adr-NNN.md", numbered "sequentially and monotonically," 1-2 pages, with exactly: **Title**
(short noun phrase), **Context** (the forces at play, value-neutral), **Decision** ("stated in full sentences, with
active voice. 'We will …'"), **Status** (proposed/accepted/deprecated/superseded — keep superseded ADRs, don't reuse
numbers), **Consequences** (positive, negative, neutral). Write each ADR "as if it is a conversation with a future
developer." Ecosystem: https://adr.github.io/ . For autonomous pipelines: a decision recorded *without* its context is
worse than none — a future agent will obey it blindly or reverse it blindly.

**Requirements traceability.** Standard practice links requirement → design → code → test so any change can be
traced and any test justified. In agent-SDLC practice this appears as spec-kit's spec→plan→tasks→implement→converge
chain (https://github.com/github/spec-kit ), SWE-bench's issue→PR→test_patch structure (§5), and scrum acceptance
criteria that make backlog items testable (https://www.agilealliance.org/glossary/definition-of-ready/ ). The strict
DoD convention: *no test exists without a requirement id and no requirement without a test* (spec→test matrix); ASVS
itself is a requirements catalog with stable IDs for the same reason (`v5.0.0-1.2.5`, §6).

### 7.2 RapidTool: stronger / weaker
- **Stronger:** P12 already plans to emit documentation/OpenAPI/ADR — the *only* phase in most comparable
  tools that even mentions architecture records; P2 semantic memory gives decisions a retrieval home.
- **Weaker:** nothing currently forces an ADR at the moment of decision (P0 stack choice, P4 isolation
  design, P6 codegen runtime, P9 target env), so decisions will be post-hoc prose; no decision-owner or
  status lifecycle exists; P1 state graph has no per-ADR link.
- **Weaker:** no traceability ids: spec items, tests, code artifacts, and approvals are not linked by id,
  so "which test proves which acceptance criterion" (and hence whether a rejection was ever addressed)
  cannot be answered deterministically.

### 7.3 Mapping — ready to adopt
**ADR auto-emission rule:** every gate that changes architecture, dependencies, interfaces, security
posture, or construction technique (P0/P4/P6/P9/P10/P12) must attach an ADR with Nygard's five sections;
status lifecycle managed by the state graph (proposed → accepted at human gate → superseded). Store in
`docs/adr/` and mirror a hash + summary into semantic memory (P2) for retrieval.

**Traceability ID scheme (deterministic, enforced by the artifact manifest):**

```text
RT-<phase>-<seq>            artifact (e.g., RT-P6-014)
RT-<phase>-<seq>-AC<n>      acceptance criterion of an artifact   → links to ≥1 test
RT-<phase>-<seq>-T<n>       test/oracle case                      → links to ≥1 AC
Gate/HITL record            references artifact id + note (≥12 chars) + human id
Enforcement: manifest validator fails if any AC has no test or any test no AC (DoD "all testing completed").
```

**Traceability matrix view** (P12 render): rows = ACs, columns = tests / code files / gates / approvals;
missing cells = DoD violations, surfaced at the next P5/P9 gate. This is the machine-checkable version of
the spec→test matrix convention and doubles as the SWE-bench Verified curation pass for RapidTool's own
task library (§5.3).

---

## §8 Release engineering: trunk-based development, CI/CD gates, canary/rollback — what P9 should emit
### 8.1 The industry standard
**Trunk-based development** (https://trunkbaseddevelopment.com/ ): developers "collaborate on code in a single branch
called 'trunk' and resist any pressure to create other long-lived development branches." Supporting rules: short-lived
branches exist only for "code-review and build checking (CI)… before commits land in the trunk"; release branches are
"cut from the trunk on a just-in-time basis" and deleted after release, or teams "release from trunk" with a "fix
forward" strategy; structural changes use branch-by-abstraction + feature flags; commit "at least once every 24 hours"
so "the codebase is always releasable on demand"; do a full pre-integrate build before pushing. DORA agrees at change
level: work in small batches (https://dora.dev/capabilities/working-in-small-batches/ ). Continuous Integration is
defined canonically at https://martinfowler.com/articles/continuousIntegration.html (every commit builds and tests on
integration; broken builds fixed first).

**Canary releases and rollback** (M. Fowler bliki, https://martinfowler.com/bliki/CanaryRelease.html ): "slowly rolling
out the change to a small subset of users"; "if you find any problems with the new version, the rollback strategy is
simply to reroute users back to the old version"; automated regression-triggered rollback = the "cluster immune system"
pioneered by IMVU; pair with feature flags (https://martinfowler.com/bliki/FeatureFlag.html ). Canaries should complete
"in minutes or hours", not days — a direct design constraint on how long a P9 approval may block a rollout.

**CI/CD gate stacks.** Industry-standard merge/deploy gates combine: PR checks (lint, unit, coverage, SAST, secrets,
deps — §6), required reviews (§3), trunk protection, then environment promotion with progressive delivery
(dev → staging → canary → prod) and automatic rollback on metric regression; DORA's capability catalog
(https://dora.dev/capabilities/ ) frames these as predictors of the five metrics (§2). For AI-generated releases:
agent changes land as normal PRs through the *same* gates (human review for small batches, or reviewer-agent + human
spot-check, §3) because smaller batches make review and rollback tractable.

### 8.2 RapidTool: stronger / weaker
- **Stronger:** P9 is explicitly a routing/HITL phase, i.e., the design already knows deployment is a
  *decision*, and P4/P6 sandboxing means generated code has been executed before it is ever routed —
  more than many agent tools do before "ship it."
- **Weaker:** no documented decision matrix for promote/reject/rollback, no notion of environments or
  canary steps, no "stop the line" trigger tied to the change-fail-rate proxy (§2), and no requirement
  that routed artifacts carry the pre-deploy gate evidence (oracle, scans, reviews) as an attachable
  release manifest.
- **Weaker:** no batching policy: without small-batch rules, a run that sweeps 12 generated changes into
  one "release" makes every DORA proxy (§2) unreadable and every rollback atomic-but-blunt.

### 8.3 Mapping — ready to adopt
**P9 decision matrix (deterministic preconditions, then HITL on the routing choice):**

```text
PROMOTE to next env iff ALL:  oracle green (FTP+PTP)  ∧  reviewer-seat verdict ≠ REQUEST_CHANGES
   ∧  ASVS L1 checks clean (or waived w/ note)  ∧  scans clean  ∧  P5 approvals archived  ∧  ADR present if arch-significant
REJECT (stop the line) iff: any precondition false, OR change_fail_rate_proxy > 15% over trailing 10 runs
ROLLBACK iff: post-promotion regression detected (oracle re-run red / human incident note) → revert to last green artifact set
GUARDRAILS: max N artifacts per release batch (small batches); canary = route to ≤5% of targets first when prod is in scope.
```

**Release manifest (P9 artifact, also the audit record for §6):** `{release_id, artifacts[] {id,
spec_id, ac_ids, oracle_evidence_sha}, gates[] {name, verdict, evidence_sha}, env_plan: [dev→staging→canary→prod],
rollback_plan, approvals[] {human, note_len≥12, ts}}`. The manifest *is* the deployable unit — SOC 2
reviewers and DORA telemetry both read from it.

**CI/CD gate order inside RapidTool** (mirrors industry merge→release gates): P6 output → sandbox run →
oracle (FTP/PTP) → lint/quality gate (§9) → SAST/secrets/deps (§6) → reviewer seat (§3) → P5 human gate →
P9 route. One line of pseudocode:

```python
if not all(g.passed for g in [sandbox, oracle, quality, security, review]): block("stop the line")
```

---

## §9 Grading rubrics for AI-generated code quality: from HumanEval to clean-code gates
### 9.1 The industry standard
**Functional correctness evals (HumanEval lineage).** HumanEval (Chen et al., "Evaluating Large Language Models
Trained on Code", arXiv:2107.03374, https://arxiv.org/abs/2107.03374 ) set the pattern: 164 hand-written problems graded
by *executing unit tests*, plus the pass@k insight — "repeated sampling from the model is a surprisingly effective
strategy": Codex solved 28.8% with one sample but 70.2% "with 100 samples per problem." SWE-bench/Multi-SWE-bench/
Terminal-Bench (§5) are the same idea at repo scale with refinements: hidden tests, PASS_TO_PASS regression checks,
containerized deterministic harnesses, human-curated instances.

**Static quality gates (clean-code proxies).** SonarQube Quality Gates
(https://docs.sonarsource.com/sonarqube/latest/user-guide/quality-gates/ ) give a "high-level go/no go decision on the
code changes"; every broken rule is classified as bug, vulnerability, security hotspot, or code smell, and gates focus
on new code ("clean as you code"; walkthrough: https://docs.getxray.app/space/XRAYCLOUD/44565616/Code+Quality+Analysis+with+SonarQube ).
Example gate conditions: "coverage is less than 70–85%" fails; "security hotspots is less than 100%" (reviewed) fails
(https://dev.to/outdated-dev/ensure-code-quality-with-sonar-quality-gates-4bjb ). These are the "linters as proxies":
they don't measure correctness (the oracle does) but bound maintainability debt — complexity, duplication, coverage,
smells — cheaply, deterministically, per change.

**Telemetry-rich eval rubrics.** Aider's report card (§5) logs syntax errors, indentation errors, malformed
responses, test timeouts, exhausted context, "lazy comments", seconds/case and cost per run
(https://aider.chat/docs/leaderboards/ ); OpenAI's macro evals add population-level pattern grading; and the SWE-bench
Verified page's honest-summary principle — static benchmarks are contaminated/limited — applies to any self-grading
agent: **report the caveats next to the score.**

### 9.2 RapidTool: stronger / weaker
- **Stronger:** A7's case taxonomy gives RapidTool a functional-correctness core that HumanEval-style
  single-function evals lack; the P0 scorecard shows the team already thinks in multi-axis grading.
- **Weaker:** there is no hidden-test discipline (tests are visible to the generator), no
  PASS_TO_PASS-style regression class, no lint/quality-gate layer, and no per-attempt telemetry taxonomy
  (syntax errors, timeouts, cost) — so "the code passed" cannot be decomposed into *why* and cannot trend.
- **Weaker:** no human calibration of the oracle itself (the SWE-bench Verified curation lesson), so bad
  tests quietly certify bad code.

### 9.3 Mapping — ready to adopt
**Composite quality score for a P6 artifact** (deterministic; weights are policy, not model output):

```python
def quality_score(oracle, lint, diff) -> dict:
    s = {}
    s["functional"]   = 1.0 if oracle.fail_to_pass.all_pass and oracle.pass_to_pass.all_pass else 0.0
    s["constraint"]   = 1.0 if oracle.case_class("constraint").all_pass else 0.0     # A7 class
    s["graph_safety"] = 1.0 if oracle.case_class("graph_safety").all_pass else 0.0   # A7 class
    s["clean_code"]   = gate_ok(lint, on="new_code_only", rules=[no_new_bugs, no_new_vulns,
                        no_new_smells, coverage_new >= 80, dup_lines_new < 3])        # SonarQube-style
    s["process"]      = telemetry_ok(attempts<=K, no_syntax_errors, no_timeouts, cost_budget_ok)
    overall = weighted([0.5 functional, 0.15 constraint, 0.15 graph_safety, 0.1 clean_code, 0.1 process])
    return {**s, "overall": overall, "caveats": benchmark_limitations(s)}            # honesty clause
```

**Honesty clause:** every scorecard render must include a one-line limitation note (contamination,
hidden-test absence, self-test authorship) — borrowed from OpenAI's "be cognizant of limitations" warning
(https://openai.com/index/introducing-swe-bench-verified/ ).

---

## §10 UX/process patterns for human approval of agent work: review gates, latency, approval fatigue
### 10.1 The industry standard
**Approval fatigue is now documented.** "The End of Code Review" (Monperrus, arXiv 2026,
https://arxiv.org/abs/2606.13175 ) describes the failure mode any HITL design must fight: when agents write faster than
humans can review, "reviews of agent-generated code become rubber-stamps: the human approves because the code looks
correct, because the tests pass, and because the cognitive cost of genuine scrutiny is prohibitive," and the faster
agents write, "the more review degrades into a formality performed under time pressure"; baseline review latency
"routinely stretches over twenty-four hours" — so approval latency is a first-class productivity metric. (Position
paper; adopt its *mechanism* — agent-first review with human oversight at the margins plus calibration sampling — not
the stronger "humans are obsolete" claim.)

**Design guidance for human-AI oversight.** NIST AI RMF 1.0 (https://doi.org/10.6028/NIST.AI.100-1 ) makes oversight a
governance function and flags the telemetry that should drive HITL design: "**Data about the frequency and rationale
with which humans overrule AI system output in deployed systems may be useful to collect and analyze**" — capture
every override *and its reason*, precisely RapidTool's ≥12-char rejection note, elevated to a first-class metric.
Google's review guidance (https://google.github.io/eng-practices/review/reviewer/speed.html ; standard at
https://google.github.io/eng-practices/review/reviewer/ ) says respond quickly, prefer "LGTM with comments", and approve
once a change "definitely improves the overall quality of the system" — the bar is *improvement*, not *perfection*.
Anthropic's goal: give the agent a check so "you" are not "the verification loop"
(https://code.claude.com/docs/en/best-practices ) — humans verify rare, high-leverage decisions, not every token.
OpenAI's macro-evals work grades whether a system "paused for review when risk was high" (review appropriateness) and
"scales human attention" by clustering issues into patterns
(https://developers.openai.com/cookbook/examples/partners/macro_evals_for_agentic_systems/macro_evals_for_agentic_systems );
Anthropic research frames the same goal as enabling "humans to understand and verify AI-written code before deployment"
(https://www.anthropic.com/research/AI-assistance-coding-skills ).

**Approval UX patterns in products:** risk-tiered permissions (per-action / per-batch / policy-level, à la Claude
Code permission modes), diff-first presentation with evidence attachments, batched approvals with per-item opt-out,
quiet auto-approve only for *declared low-risk* classes, mandatory structured rejection reasons (the anti-rubber-stamp
minimum).

### 10.2 RapidTool: stronger / weaker
- **Stronger:** RapidTool's HITL gates (P4/P5/P8/P9) with mandatory ≥12-char rejection notes are exactly
  the "capture the rationale for overrides" primitive NIST calls for; nobody else in the brief has it
  wired into the memory system.
- **Weaker:** the approval UI shows no evidence bundle by default (spec-diff, oracle output, scan results,
  reviewer-seat comments), which forces the human to either trust or deep-dive — the two ends of the
  rubber-stamp spectrum; no risk-tiering, so a trivial prototype approval costs the same attention as a
  prod deployment.
- **Weaker:** zero telemetry on the human side: no approval-latency tracking, no rubber-stamp detector, no
  rejection-taxonomy mining — so approval fatigue will arrive silently (SPACE S/E dimensions, §2).

### 10.3 Mapping — ready to adopt
**HITL gate v2 spec:**

```json
{ "approval_request": { "artifact_ids": ["RT-P6-014"], "risk_tier": "high",       // tier from P0/P4
    "evidence_bundle": {"spec_diff": "…", "oracle": "…green stdout…", "scans": "…", "reviewer_seat": "…"},
    "what_changed": "≤200-word agent summary", "what_to_check": ["AC-1 edge", "AC-3 rollback"] },
  "human_action": {"verdict": "approve|reject|request_changes", "note": "…≥12 chars…",
    "labels": ["issue", "suggestion"], "latency_s": 47 } }
```

Rules: (1) evidence bundle mandatory — no bundle, no request (DoR for the human); (2) risk tiers select
granularity: low → batch ≤10 artifacts, medium → per-artifact, high (prod scope) → per-artifact + canary
(§8); (3) rejection reasons must use the conventional-comments label set (§3) so P2 can mine them;
(4) **rubber-stamp detector**: warn when 7-day rolling mean approval < 20 s or reject rate < 5% with
reviewer-seat blocking findings > 0, then escalate the next N requests to mandatory checklists
(anti-fatigue circuit breaker); (5) telemetry → SPACE panel (§2) and NIST-style override analytics:
`overrides_by_phase, override_rationale_taxonomy, latency_by_tier`.

---

## §11 Prioritized adoption list (what to encode first)
Ranked by (impact × readiness) for RapidTool's current state (no real LLM, no core tests, localStorage
persistence, canned codegen). Each item names the source standard and the target phases.

| # | Adopt | Source standard | Target phases | Effort |
|---|---|---|---|---|
| 1 | **Per-phase DoD + DoR registries with the generic gate function** (evidence hashes, no silent PASS) | Scrum.org/Agile Alliance DoD; stage-gate | P0–P12, all gates | M |
| 2 | **Verification-first ordering + frozen tests**: A7 oracle authored at P5-freeze, generator converges (K≤3), tests never modified by generator | Anthropic verification-driven dev; Spec Kit converge; Aider pass_rate_2 | P5, P6, A7 | M |
| 3 | **SWE-bench-verified-style grading contract**: FAIL_TO_PASS + PASS_TO_PASS + case-class breakdown + raw evidence; hidden-test option | SWE-bench Verified | A7, P6 | S |
| 4 | **P4 security gate from ASVS L1 (machine-readable import) + STRIDE threat-model artifact per target + scan probes** (secrets/deps/SAST) | OWASP ASVS 5.0; STRIDE; gitleaks/osv-scanner/Semgrep | P0, P4, P6, P9 | M |
| 5 | **Audit-log event store** (append-only, hash-chained, attributable; HITL notes + gate verdicts + tool calls) — replaces raw localStorage for decisions | SOC 2 CC6/CC7; GDPR Art. 25; NIST AI RMF accountability | P1, P2, all gates | M |
| 6 | **Reviewer seat** (Google checklist rubric + Conventional-Comments JSON) before every human gate; generated-PR contract (spec ids, evidence) | Google eng-practices; Conventional Comments; GitHub PR templates | P5, P6 | S |
| 7 | **DORA/SPACE telemetry snapshots** from gate events (lead time, fail rate, recovery, HITL latency, override taxonomy) | DORA five metrics; SPACE | P2, P12 | S |
| 8 | **Verdict math v2 for P0**: weighted axes × evidence strength, hard rules, guard extraction, kill thresholds; DoR = INVEST-style story fields | Stage-gate; Spec Kit assess (go/clarify/kill); INVEST | P0 | S |
| 9 | **P9 release manifest + decision matrix** (promote/reject/rollback preconditions, small batches, canary when prod) | Trunk-based dev; Fowler canary; DORA small batches | P9 | M |
| 10 | **HITL gate v2 + rubber-stamp detector + approval telemetry** | arXiv 2606.13175; NIST AI RMF App. C; Google review speed | P4, P5, P8, P9 | S |
| 11 | **ADR auto-emission + traceability IDs** (AC↔test↔artifact enforcement, matrix view at P12) | Nygard ADRs; spec→test matrix | P0/P4/P6/P9/P10, P12 | S |
| 12 | **Calibration eval (macro)**: periodic blind re-grade of human-approved/rejected artifacts; reviewer-seat agreement trending | OpenAI macro evals; SWE-bench Verified curation | P2, P12 | S |

Suggested sequencing: **Waves 1–2 (this month):** items 1, 2, 3, 6, 8 — they are pure logic + data-shape
changes inside the existing state graph, need no real LLM, and make the canned codegen honestly graded.
**Waves 3–4:** items 4, 5, 7, 9 — security/audit backbone, required before any real deployment routing.
**Wave 5:** items 10, 11, 12 — human-trust and self-improvement layer; 10 and 12 are cheap once 6 and 7
exist because they consume the same events.

Cross-cutting principle from every standard surveyed: **gates are only as good as their written criteria
(DoD), their record (audit log), and their calibration (evals)**. RapidTool already has the graph; the
standards above supply the missing criteria, records, and calibration.

---

*File: 02_industry_sdlc_grading_research.md — research companion for RapidTool's governed pipeline.
Standards quoted as of the research session (ASVS 5.0.0; DORA five-metric model). ~69 unique URLs are cited inline
across §1–§10 and were reachable at research time; two legacy 404 URLs (Atlassian DoD; scaledagileframework.com DoD)
were replaced with live equivalents, noted in §1.*