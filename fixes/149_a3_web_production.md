# 149 — ANALYST-A3 (WEB): production software start→finish vs what agentic factories deliver — 10-capability production-gap checklist

(ANALYSIS-ONLY lane. Native web_search/web_extract were Firecrawl-gated — fallback was direct
fetches (python urllib / curl) of primary sources. 30+ pages fetched & read this session,
Sept 2026; every URL below was actually fetched. One arXiv ID fetched and REJECTED as
misparked (2509.12274 resolves to an unrelated greenhouse paper — not cited). Companion
docs: fixes/146_research_web.md (agentic-engineering basics), fixes/146_research_code.md.)

## 0. Bottom line (for the parent)

"Generates a demo app" and "production software factory" differ on exactly the capabilities
that need **execution, verification, and human acceptance** — not more token-budget. Every
credible 2025–26 factory (Foreman/eve, super-simple-software-factory, Codex repair loops,
Claude-Code-driven pipelines) **designs its autonomy to stop short of production**: the
machine ends at a reviewed PR / acceptance envelope, and a human merges, deploys, and owns
the acceptance criteria. No researched tool autonomously closes deployment, oracle-test
authorship, or cross-project learning. The 13-phase RapidTool engine already encodes most of
the industry's emergent shape (code-owns-the-loop, run-the-tree feedback, human DoD gates);
its honest product ceiling today is "governed, verifiable draft software + evidence ledger",
not unattended production delivery.

---

## 1. What production software start→finish REALLY requires (vs one-shot / multi-file codegen)

Each capability: why real production needs it (primary source), and whether any researched
tool/factory does it autonomously today. IDs G1–G10 reused in §4's checklist.

### G1. Dependency resolution + reproducible install — SOLID need; semi-autonomous today
- The ecosystem makes reproducibility a *file contract*, not an agent behavior: npm's
  package-lock.json "describes the exact tree that was generated, such that subsequent
  installs are able to generate identical trees, regardless of intermediate dependency
  updates. This file is intended to be committed into source repositories"
  https://docs.npmjs.com/cli/v9/configuring-npm/package-lock-json
- Production apps are assemblies of hundreds of pinned transitive packages (this repo:
  package-lock.json ≈ 264 KB). A code generator that emits `package.json` but never runs a
  locked install ships fiction — versions, peer conflicts, and platform quirks only surface
  at install time.
- Who does it today: **agents can *run* installs in-sandbox** (Codex's shell tool executes in
  a sandboxed container, https://openai.com/index/unrolling-the-codex-agent-loop/; OpenHands
  runtime is a docker-sandboxed OS with bash, https://arxiv.org/abs/2407.16741) — but
  lockfile *maintenance policy* (when to bump, security patches, CI `npm ci` parity) is a
  human/CI concern, not an autonomous factory output.

### G2. Real build systems + typecheck/lint as a hard loop — SOLID need; autonomous today (in-loop)
- Even Vite — the "no-bundle dev" poster child — keeps a production build step: "shipping it
  in production is still inefficient due to additional network round trips from nested
  imports. That's why bundling is still necessary for optimized production builds"
  https://vite.dev/guide/why.html. A generated app isn't software until it *builds*, and
  build is where type errors, import cycles, and asset/config mistakes surface.
- The field's universal norm: the agent must run the repo's own checks. Anthropic: "Give
  Claude a way to verify its work — tests, a build, a screenshot to compare. It's the
  difference between a session you watch and one you walk away from"
  https://www.anthropic.com/engineering/claude-code-best-practices. Foreman's implementer
  station "executes the plan in its own sandbox, **verifies with your repo's own checks**,
  and pushes a branch" https://ask-foreman.dev/docs/pipeline.
- Who does it today: **yes** — every serious tool treats `build/typecheck/lint/test` as the
  inner feedback signal (Codex repair loops validate by executing, §2). What none does: write
  the *first* build system/CI config for an arbitrary stack and keep it maintained.

### G3. Runtime feedback loop: run → observe → fix — SOLID need; autonomous today (the core primitive)
- The canonical agent loop is defined as "gather context → take action → **verify work** →
  repeat"; "Agents that can check and improve their own output are fundamentally more
  reliable — they catch mistakes before they compound"
  https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk
- SWE-bench's original framing already required it: resolving issues "calls for models to
  interact with execution environments, process extremely long contexts and perform complex
  reasoning that goes far beyond traditional code generation tasks"
  https://arxiv.org/abs/2310.06770 (best 2023 model: Claude 2 solved 1.96%).
- MAST's failure study found the *opposite* failure mode in multi-agent factories — claimed
  verifiers that don't verify: "many existing verifiers perform only superficial checks,
  despite being prompted to perform thorough verification, such as checking if the code
  compiles or if there are leftover TODO comments"
  https://arxiv.org/abs/2503.13657
- Who does it today: **yes** — this is the one gap one-shot codegen can't fake and CLI agents
  (Codex, Claude Code, OpenHands-class) genuinely close *when* runnable tests exist. Without
  an executable oracle, "looks done is the only signal available, and you become the
  verification step" (Claude Code best practices, same URL above).

### G4. Test authorship vs test overfitting (oracle discipline) — SOLID need; NOT autonomous
- First empirical study of test overfitting in issue resolution (arXiv:2511.16858): LLM
  patches that pass LLM-generated tests "actually miss… important cases or even break
  functionality"; RQ1 measured a 35.9% overfitting rate (Claude-3.7-Sonnet patches vs its
  own generated tests); RQ2 — **refining code against observed LLM-generated tests does not
  cure it and can add overfitting** (rate grows to 25.5% once hidden-test cases are counted):
  "it is difficult to improve code patches by [refining on generated tests]"
  https://arxiv.org/abs/2511.16858
- Even human-authored SWE-bench tests were so flawed that human re-annotation filtered out
  68.3% of samples ("61.1% were flagged for unit tests that may unfairly mark valid solutions
  as incorrect") https://openai.com/index/introducing-swe-bench-verified/ — the lesson:
  *tests are the load-bearing production artifact and the least trustworthy one when the same
  model writes code and tests*.
- Who does it today: **no tool autonomously**. Every defensible pipeline treats tests as fixed
  oracles owned by the brief/human (Foreman reviewers judge against the repo's real diff;
  SSSF gates verify claims against typed envelopes). Joint code+test refinement is an
  identified anti-pattern, not a feature.

### G5. Long-horizon context + repo-scale navigation — SOLID need; partially solved (mechanisms, not guarantees)
- Repo-scale work exceeds raw context: aider ships a "repo map" of files + key symbols
  precisely because "for large repositories even just the repo map might be too large for the
  LLM's context window", so it graph-ranks "the most relevant portions… to fit into the
  active token budget" https://aider.chat/docs/repomap.html. Codex bounds project docs
  (AGENTS.md ≤ 32 KiB) https://openai.com/index/unrolling-the-codex-agent-loop/; Claude Code
  persists project rules in CLAUDE.md "read at the start of every conversation"
  https://www.anthropic.com/engineering/claude-code-best-practices.
- Long-horizon *hours-of-work* reliability is exactly where Anthropic says subagents earn
  their keep — per-subagent context compression for tasks that "exceed the limits of single
  agents" https://www.anthropic.com/engineering/built-multi-agent-research-system.
- Who does it today: partially — repo maps / memory files / subagent delegation are real
  mechanisms, but "manage context aggressively" + "course-correct early and often" remain
  human-advised practices (Claude Code best practices), i.e. the tooling helps, the *habit*
  is still the operator's.

### G6. Repo-scale edits (coordination across files), not append-only generation — SOLID need; semi-autonomous
- Real fixes require cross-file surgery: SWE-bench issues "require… coordinating changes
  across multiple functions, classes, and even files simultaneously"
  https://arxiv.org/abs/2310.06770. USEbench's thesis: "software engineering is more than
  coding" — maintenance, evolution, "fixing an incomplete patch, adding new features, or
  taking over code written by others" https://arxiv.org/abs/2506.14683.
- The repo map exists so generated code "respects and utilizes existing libraries, modules
  and abstractions found elsewhere in the codebase" (aider, above) — i.e. edit-in-place of a
  living codebase, which is categorically different from emitting N fresh files into a
  greenfield scaffold.
- Who does it today: CLI agents edit multi-file repos every day (Codex/Claude Code patches +
  tests), and factory stations *are* diff-based (Foreman reviewer judges "everything against
  the real diff"). But the researched *paper* factories are still greenfield-demo-shaped:
  MetaGPT's claim is "more coherent solutions" on collaborative software-engineering
  benchmarks via SOP assembly lines https://arxiv.org/abs/2308.00352; ChatDev's chat-chain
  phases (design/coding/testing) were validated on small generated apps
  https://arxiv.org/abs/2307.07924. Neither demonstrates take-over-and-extend of an existing
  production codebase.

### G7. Environment fidelity & drift (sandbox ≠ prod) — SOLID need; sandboxes solved, parity not
- The field standard is per-task sandboxed execution: OpenHands gives agents "a docker-
  sandboxed operating system with a bash shell, a web browser, and IPython server"
  https://arxiv.org/abs/2407.16741; SWE-bench-Live ships "a dedicated Docker image… to ensure
  reproducible execution" and found "a substantial performance gap compared to static
  benchmarks" — i.e. the *fresh, correctly-provisioned* environment changes results
  https://arxiv.org/abs/2505.23419. Terminal-Bench 2.0 likewise gives "each task… a unique
  environment, human-written solution, and comprehensive tests"
  https://arxiv.org/abs/2601.11868.
- Drift surfaces in production-shaped ways sandboxes don't cover: DB migrations, Node/OS
  versions, env vars/secrets, service dependencies (this repo: PGLite-locally vs
  DATABASE_URL-in-prod, migrations run inside the build). Sandboxed runtime ≠ production
  parity, and nobody's docs claim otherwise.
- Who does it today: sandboxing is **solved** (Codex, OpenHands, every benchmark harness);
  prod-parity environments are **not** an autonomous factory output — SWE-bench-Live's whole
  point is that assembling the correct env still needs an automated-but-human-maintained
  pipeline (RepoLaunch) https://arxiv.org/abs/2505.23419.

### G8. Deployment & release (build → migrate → ship → operate) — SOLID need; NOT delivered by factories
- Deployment is real terminal work with acceptance criteria, not a slogan: Terminal-Bench 2.0
  tasks include configuring a git server plus "automatic deployment of two branches… to
  separate HTTPS endpoints on Nginx… with deployments triggered by post-receive hooks that
  complete within 3 seconds" https://arxiv.org/abs/2601.11868 — and frontier agents still
  resolve **<65%** of the 89 tasks (smaller models ≈15%).
- Every researched factory ends *before* deploy: Foreman "delivers a reviewed draft pull
  request on your repository" https://ask-foreman.dev/docs/pipeline (+
  https://github.com/vercel-labs/eve-software-factory-template); SSSF's terminal state is a
  run-acceptance envelope, not a release https://github.com/disler/super-simple-software-
  factory. Codex's own cookbook treats "next decision needs human review" as a first-class
  stop condition https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex
- Who does it today: **no codegen factory**; deployment automation exists as separate
  human-owned CI/CD (this repo's own `bash scripts/gate.sh` → build → preview → Vercel flow).

### G9. Security, permissions & blast-radius control — SOLID need; tooling exists, policy is human
- Codex sandboxes only its own shell tool and says so explicitly: other tools, "such as those
  provided from MCP servers, are not sandboxed by Codex and are responsible for enforcing
  their own guardrails" https://openai.com/index/unrolling-the-codex-agent-loop/. OpenHands'
  SDK markets "native sandboxed execution, lifecycle control" as its differentiator vs
  OpenAI/Claude/Google SDKs https://arxiv.org/abs/2511.03690.
- Production means secrets, prod data, and financial logic (a property-ledger CRM) — the
  blast-radius of a wrong autonomous `rm`, migration, or payment call is unbounded.
- Who does it today: sandbox/permission scaffolds are solved (tool-level); *policy* (what an
  agent may touch in prod) is configured and owned by humans in every researched system.

### G10. Acceptance definition + human judgment gates — SOLID need; solved only as *designed-in* limits
- Codex cookbook: "A production loop should decide when to stop on its own. A good loop
  usually stops for one of four reasons: validation passes, the loop reaches a maximum number
  of attempts, the remaining delta stops changing, or the next decision needs human review"
  https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex
- SSSF makes acceptance structural: "code owns sequencing, retries, and acceptance, and the
  agent owns only the work inside one bounded phase… Agent proposes, code disposes"
  https://github.com/disler/super-simple-software-factory
- Who does it today: yes — but note the definitional catch: "human gate" means *not fully
  autonomous by design*. No factory claims otherwise; the honest framing is "autonomy up to a
  human-acceptable boundary, with the acceptance criteria themselves human-authored."

---

## 2. Multi-agent / "hyperagent" production quality — when orchestration helps vs hurts

### What the primary sources actually say
- **Anthropic multi-agent research post (June 2025).** Orchestrator-worker pattern; subagents
  run in parallel; but the headline finding is *token economics*, not architecture: "three
  factors explained 95% of the performance variance in the BrowseComp evaluation… token usage
  by itself explains 80% of the variance". And the cost side: "agents typically use about 4×
  more tokens than chat interactions, and multi-agent systems use about 15× more tokens than
  chats" — multi-agent only pays when tasks genuinely parallelize and exceed single-agent
  limits. Delegation hygiene is warned about explicitly: without detailed task descriptions,
  "agents duplicate work, leave gaps". (Their system is a *research* system; the post is not
  evidence for code-factory quality, only for when parallel subagents help.)
  https://www.anthropic.com/engineering/built-multi-agent-research-system
- **Codex repair-loop cookbook.** The load-bearing design rule for code: "Iterative repair
  loops… separate judgment from proof. Review finds candidate issues. Repair makes focused
  edits. Validation executes the artifact and produces the next delta" — i.e., a *fresh-
  context reviewer that doesn't edit*, a *repair step that only edits*, and an *executing
  validator*, with the audit trail kept per pass.
  https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex
- **Meta-agent inefficiencies (arXiv:2510.06711).** Directly cautions against "factories that
  redesign themselves": (1) "simply expanding the context with all previous agents, as
  proposed by previous works, performs worse than ignoring prior designs entirely"
  (evolutionary selection beats context-stacking); (2) meta-designed agents show "low
  behavioral diversity"; (3) economics: automated self-design only beat human-designed agents
  in 2 datasets, and only when deployed on 15,000+ examples — the design cost rarely pays.
  https://arxiv.org/abs/2510.06711
- **MAST taxonomy (arXiv:2503.13657).** 1,600+ annotated traces across 7 MAS frameworks →
  14 failure modes in 3 categories: system-design issues, inter-agent misalignment, and task
  verification. Two findings matter for factories: performance gains of MAS "on popular
  benchmarks are often minimal", and verification inside MAS is the weak seam (superficial
  verifiers, §G3). Inter-agent misalignment is concrete and measurable — e.g. "mismatches
  between reasoning and action" was 13.2% of one failure-mode distribution — and is a
  *multi-agent-specific* tax that single-agent pipelines don't pay.
  https://arxiv.org/abs/2503.13657
- **Foreman (Vercel-labs eve software factory) docs.** The industry answer to "orchestration
  for production code" is *separation of powers*, not swarm intelligence: classifier →
  analyst → implementer → reviewer stations, each "its own agent with its own instructions,
  sandbox, and tools"; "The Reviewer sees only the pushed branch, never the Implementer's
  reasoning"; implementer "verifies with your repo's own checks"; cross-run learning is kept
  as a "factory brain" of repo notes; and the deliverable is a *draft PR* — merge is human.
  https://ask-foreman.dev/docs/pipeline · https://github.com/vercel-labs/eve-software-factory-template
- **Super-simple-software-factory (disler).** Same philosophy, stated as an architectural
  law: "Deterministic Python owns the graph; coding agents are bounded nodes inside it";
  "Typed JSON envelopes carry context across the seams"; every event streams to SQLite;
  failure = re-prompt the live session, not cold restart; and the blunt editorial: "Agents
  are great. You do not always need one." https://github.com/disler/super-simple-software-factory

### Synthesis: when does orchestration help vs hurt (evidence-graded SOLID)
- **Helps:** independent, parallelizable workstreams (research/exploration/investigation);
  token-budget scaling beyond a single context; *independent* verification by a non-editing
  reviewer on the real diff; structured (typed/JSON-envelope) handoffs; deterministic
  code-owns-the-loop sequencing with per-phase acceptance.
- **Hurts:** tightly coupled shared-state edits (inter-agent misalignment, MAST); naive
  context-stacking of prior designs (inefficiencies paper); agent-authored verification
  (superficial verifiers, MAST); and economically, almost always at small scale (4×–15× token
  burn, inefficiencies-paper economics).
- No source claims multi-agent improves *code correctness* per se; the claimed benefits are
  parallelism, isolation, and review independence — which is why the factories that work are
  pipelines with gates, not "agent teams" writing code together.

---

## 3. Cross-project / cross-run memory — what the studies ACTUALLY showed (do not oversell)

- **SWE-Bench-CL (arXiv:2507.00014)** — a continual-learning benchmark (chronologically
  ordered SWE-bench-Verified issues) plus CL metrics (forgetting, forward/backward transfer)
  and a memory-augmented LangGraph harness. **Honest reading of the paper's own report:** the
  adapted harness "frequently" failed, "overall pass rates remained consistently low
  (generally below 8.5%, often significantly lower), with the memory-enabled condition
  typically performing on par with or slightly worse… impossible to draw reliable
  conclusions." Contribution = dataset + protocol + metrics, NOT demonstrated gains. (146 §5's
  "memory helps mostly long tasks" was not re-locatable in the fetched full text — treat as
  thin.) https://arxiv.org/abs/2507.00014
- **Structurally Aligned Subtask-Level Memory (arXiv:2602.21611)** — the one positive result,
  and it is *within-benchmark episodic memory*, not cross-project: instance-level memory
  "suffers from a fundamental granularity mismatch" (retrieval misfires when similar task
  surfaces need different logic), and aligning storage/retrieval with the agent's subtask
  decomposition improves mean Pass@1 on SWE-bench Verified by **+4.7 pp** over a vanilla
  agent (+6.8 pp on Gemini 2.5 Pro), with "gains grow with more interaction steps". Scope
  caveat: same-repo task sequences on one static benchmark; no cross-repo, cross-stack, or
  production evidence. https://arxiv.org/abs/2602.21611
- **Metis (arXiv:2606.24151)** — controlled study of text memory (context injection) vs code
  memory (experience crystallized into callable tools) over identical experiences: the two
  are "complementary… in construction cost, execution efficiency, and transferability, such
  that neither representation alone is sufficient". Metis organizes text memory into
  execution plans / environment facts / common pitfalls and promotes recurring plans to
  validated tools: up to **+20.6% accuracy over ReAct on AppWorld** while cutting execution
  cost up to 22.8%. Scope caveat: AppWorld is an interactive *app/API-task* benchmark, not
  repo-scale coding; no long-run production study. https://arxiv.org/abs/2606.24151
- **Synthesis (MIXED-to-THIN overall):** no mainstream study demonstrates cross-project memory
  at repo scale or in sustained production use. Measured gains are (a) benchmark-bound
  (+4.7 pp SWE-bench Verified; +20.6% AppWorld), (b) representation-structured (subtask-
  aligned retrieval; dual text/code), and (c) task-length-dependent — and the one dedicated
  continual-learning study (SWE-Bench-CL) is explicitly inconclusive. This supports
  RapidTool's kill-criterion posture (rip memory out if no measured gain by run 6) better
  than it supports any "memory makes factories production-ready" claim.

---

## 4. Production-gap checklist — 10 capabilities, ranked for a real small-business webapp suite (property-ledger CRM)

Ranking logic: for a ledger CRM the fatal risks are (a) silently-wrong behavior, (b) data
loss/migration breakage, (c) shipping an unreviewed financial artifact — so execution
feedback, oracle discipline, and human acceptance outrank glamour capabilities. "Solved by
any autonomous tool today" = does a researched 2025–26 tool/factory close it *without human
intervention*. Evidence grade: SOLID (≥2 independent primary sources) / MIXED (conflicting or
partial) / THIN (single or benchmark-only source).

| # | Capability | Why it gates production (for a ledger CRM) | Solved autonomously today? | Evidence |
|---|---|---|---|---|
| 1 | Runtime feedback loop (run → observe → fix) | A ledger's math/UI bugs are only catchable by executing; "looks done" is not a signal | YES — Codex/Claude Code/OpenHands-class loops, when tests exist (G3) | SOLID |
| 2 | Test-oracle discipline (real tests the agent can't game; no joint code+test refinement) | 35.9% of patches overfit LLM-generated tests; financial logic can't ride on that (G4) | NO — every defensible pipeline fixes oracles human-side; joint refinement = anti-pattern | SOLID |
| 3 | Build/typecheck/lint gates as a hard loop | Type/import/config errors kill deploys; Vite still needs prod bundling (G2) | YES in-loop — agents run repo's own checks (Foreman/Claude Code norms) | SOLID |
| 4 | Dependency resolution + reproducible installs (lockfiles, CI parity) | Multi-hundred-package trees (264 KB lockfile here) drift silently (G1) | PARTIAL — agents install in-sandbox; lockfile *policy* is human/CI | SOLID |
| 5 | Deployment + release (prod build → migrate → ship → operate) | Factories stop at draft PR; Terminal-Bench shows deploy tasks beat frontier agents (G8) | NO — none researched ships to prod; separate human CI/CD | SOLID |
| 6 | Human acceptance gates & DoD (merge authority, accept/reject) | Financial product: who accepts the artifact is the product decision (G10) | YES *as designed-in limit* — i.e. autonomy deliberately stops here | SOLID |
| 7 | Environment fidelity & drift (prod parity: DB, Node, secrets, migrations) | Sandbox ≠ prod; migration-in-build (this repo) only safe if env matches (G7) | PARTIAL — sandboxes solved; prod-parity env assembly is human-maintained | SOLID (need) / MIXED (autonomy) |
| 8 | Long-horizon context & repo-scale edit/navigation | Hours-long multi-file work on a living codebase (G5, G6) | PARTIAL — repo maps / CLAUDE.md / subagents are mechanisms; context rot managed, not solved | SOLID (mechanisms) / MIXED (full autonomy) |
| 9 | Multi-agent orchestration only where it pays | Parallel investigation helps; parallel *edits* invite misalignment + 15× tokens (G2-sec, §2) | PARTIAL — Foreman/SSSF-style station pipelines yes; autonomous "agent teams" no | SOLID |
| 10 | Cross-run / cross-project learning & memory | Fewer repeat mistakes on the next brief (G-sec 3) | NO — SWE-Bench-CL inconclusive; Metis AppWorld-only; subtask memory +4.7 pp in-benchmark | MIXED→THIN |

### What this means for RapidTool (honest positioning)
- **Already matches the field's proven shape:** code-owns-the-loop 13-phase engine, run-the-
  tree feedback, DoD gates + human accept (P4/P5/P8/P9 HITL), envelope-style seams, evidence
  ledger, SQLite-style trace, learning with a falsification kill-criterion — these mirror
  SSSF/Foreman/Codex-cookbook findings independently (146 §6 reached the same conclusion).
- **Claims to keep honest:** the product can truthfully promise *governed, verifiable draft
  software with an audit trail up to human acceptance* — matching Foreman's "draft PR"
  ceiling. It cannot yet promise unattended production delivery: G4 (oracle authorship), G5
  (deployment), G7 (prod parity), and G10 (cross-project memory) are open in *every*
  researched system, RapidTool included.
- **Cheapest next differentiators suggested by this evidence:** (1) never let the repair
  channel touch brief-grounded oracle tests (G4 — the 146 §6 joint-refinement warning is now
  backed by measured 35.9%/25.5% overfitting numbers); (2) add an explicit
  "reviewer-sees-only-the-diff, never the implementer's reasoning" station if not already
  present (Foreman's independence property, §2); (3) keep memory longitudinal + kill-
  criterion (SWE-Bench-CL's inconclusiveness is the cautionary cite).

---

## Appendix — sources fetched this session (all URLs read directly; Firecrawl-gated, no search engine used)

- arXiv abstracts: 2503.13657 (MAST), 2507.00014 (SWE-Bench-CL), 2606.24151 (Metis),
  2602.21611 (subtask memory), 2601.11868 (Terminal-Bench 2.0), 2505.23419 (SWE-bench-Live),
  2511.16858 (test overfitting), 2506.14683 (USEbench), 2310.06770 (SWE-bench), 2407.16741
  (OpenHands), 2511.03690 (OpenHands SDK), 2308.00352 (MetaGPT), 2307.07924 (ChatDev),
  2510.06711 (meta-agent inefficiencies)
- arXiv full text (HTML): 2503.13657, 2602.21611, 2507.00014, 2606.24151, 2601.11868,
  2505.23419, 2511.16858, 2310.06770, 2407.16741
- Docs/blogs: aider repomap; Anthropic built-multi-agent-research-system,
  claude-code-best-practices, building-agents-with-the-claude-agent-sdk; OpenAI
  unrolling-the-codex-agent-loop, introducing-swe-bench-verified; Codex repair-loop cookbook;
  swebench.com/verified.html; vite.dev/guide/why; npm package-lock-json docs;
  ask-foreman.dev/docs/pipeline; vercel-labs/eve-software-factory-template;
  disler/super-simple-software-factory
- Rejected: arxiv.org/abs/2509.12274 (misparked — resolves to unrelated greenhouse paper;
  Codex mechanics cited instead via OpenAI agent-loop post + cookbook)
