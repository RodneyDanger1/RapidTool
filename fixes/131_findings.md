# 131 — Web-research findings (researcher relay)

- **File:** `fixes/131_findings.md` (repo root `C:\Users\mnril\Desktop\RapidTool Main`; **append-only** — researcher writes here + scratch only, read-only on source).
- **Date / agent:** 2026-09-07 · WEB RESEARCHER (131 relay). Polled `fixes/131_questions.md` at write time: **no `## Q-` blocks posted yet by the coder lanes** — the three answers below respond to the parent's Q-c1/c2/c3 brief (P8 rewrite lane c1; emit/compile seam lane c2; lesson-store lane c3). Coders: append further `## Q-<tag>` blocks to `131_questions.md`; poll this file before finalizing.
- **Citation hygiene (123 convention):** `✓` = fetched THIS pass (2026-09-07). Claims inherited from the same-day in-tree registers (90/123, fetched 2026-09-06/07) are marked `[register 123]`. Community/third-party analysis is labeled. Internal anchors are `file:line`-verified this pass.

---

## A-c1 — Screen/UI generation from a product brief (P8 rewrite: engine.ts case-8)

**Question:** how do v0 / Bolt / Claude artifacts derive UI screens/flows from a product brief — published approach, prompt patterns, open-source screen-derivation logic to borrow?

### What the field actually does (evidence)

- **No vendor publishes a "screen-derivation engine."** The derivation is one of three published shapes, none of which is a planner that clusters jobs into screens:
  1. **One large system prompt emits the whole file tree in a single artifact** — Bolt's open-source system prompt (`app/lib/.server/llm/prompts.ts`, ~14 KB) `✓` raw fetched: it declares the *environment capability contract* (WebContainer: browser Node, no native binaries, no C/C++), an *action grammar* (ordered `<boltAction type="file|shell">`, "create the file before running a shell command", "install dependencies FIRST, write `package.json` first, add all deps up front, avoid `npm i <pkg>`"), full-file rewrites ("NEVER use placeholders… always the FULL, updated content"), and "split functionality into smaller modules… use imports to connect them." Architecture/screens emerge inside that one response — there is no separate flow-plan step.
  2. **Chat-level iteration over a fixed component grammar** — v0 = prompt → React/shadcn-ui/Tailwind components, iterated conversationally (`✓` Vercel blog "Maximizing outputs with v0": shadcn/ui is the output contract, "technical planning" is a chat feature, not a planner; `✓` v0.app launch blog: "one prompt → deployed app with UI, content, backend, logic" — v0 grew into a full-stack builder but still publishes no derivation internals).
  3. **Plan-then-code with the plan saved as a reviewable file** — Cursor Plan Mode saves plans to files and the agent researches/clarifies before generating `[register 123: cursor.com/docs/agent/plan-mode]`; Codex `/plan` and Claude Code plan mode are the same shape `[register 123]`. This is the only *published* flow-derivation logic, and it is a **human-approval gate around a plan**, exactly the shape RapidTool's deterministic phase machine already is.
- **Claude artifacts** (chat canvas): artifacts are self-contained HTML/React/JS rendered in a sandboxed iframe; Anthropic publishes *how to use* them, not how screens are derived from briefs `✓` support.claude.com "What are artifacts". Nothing borrowable beyond the constraint "one artifact = one self-contained file" (which is the mirror image of CG-01's "one module envelope is not enough").
- **The closest open-source *deterministic* entity→screens logic is not an AI builder at all:** Amplication (`✓` github.com/amplication/amplication) generates a full-stack app (entities, CRUD screens, auth, roles, REST/GraphQL) from a declared data model — deterministic data-model→routes→screens. This is the pattern RapidTool's keyless floor should imitate when P8/P6 do meet a real generated module.
- **Anthropic's multi-agent research system** `✓` anthropic.com/engineering/multi-agent-research-system is the published pattern for *LLM* flow decomposition: orchestrator gives each worker an **objective + output format + tool/source guidance + task boundaries** ("without detailed task descriptions, agents duplicate work, leave gaps").

### Concrete recommendations (sized for THIS codebase)

1. **Keep P8 derivation deterministic** (engine.ts:783-868; 118 P-D3 "screens derive from the brief's FLOWS… one distinct responsibility each" :831-836 is already ahead of the field's non-published heuristics). Don't replace it with an LLM planner — no competitor publishes one, and determinism is the moat.
2. **Add a deterministic navigation/flow-cluster layer on top of the existing jobs→screens map** (the actual 129_z2 queued item): screens that share lattice nouns (`productNouns`) are flow-adjacent → emit an explicit ordered flow list + shared-state notes, not just flat "Screen: X / Binding: req-N / State". Pure function over existing data; testable; mirrors Amplication's relationship→route logic. Size: S.
3. **Borrow Bolt's *capability-contract* prompt pattern for the emit seam** (z1 `compile-check.server.ts`): before synthesis, declare the runtime the code will be verified in ("Node 22 type-stripping; erasable TS only; explicit `.ts` import specifiers; no build step; dependencies declared up front in package.json"). Declaring constraints *before* codegen is the single most transferable prompt trick in Bolt's file — it converts the current compile-failure repair loop (121 Attempt C/D: `ReferenceError: createProperty is not defined`) into fewer, earlier failures. Size: M (prompt + one constraint validator).
4. **Adopt Bolt's output discipline in P6/P8 synthesis prompts:** full-file rewrites only (no "…rest unchanged…" placeholders), files as small as responsibility allows, imports connect modules (mirrors CG-01's ≤8-fn decomposition), order actions dependencies-first. These are verbatim, licensed-friendly patterns from the MIT bolt.new prompt. Size: S (prompt text only).
5. **Do NOT chase WebContainers/browser execution** (Bolt's whole trick, `✓` PostHog "How bolt.new works" Sept 2025 — in-browser Node VM, single meticulously crafted prompt). RapidTool's bounded runner is server-side Node already; the browser-VM trick buys nothing here. Stays on the 123 honest floor.

**Sources (6):**
- ✓ raw.githubusercontent.com/stackblitz/bolt.new main `app/lib/.server/llm/prompts.ts` (system prompt: capability contract, action ordering, full-file rule, module splitting)
- ✓ newsletter.posthog.com/p/from-0-to-40m-arr-inside-the-tech (How bolt.new works — single prompt + WebContainer; "the server is your browser")
- ✓ vercel.com/blog/maximizing-outputs-with-v0-from-ui-generation-to-code-creation (v0 output contract = shadcn/ui; chat iteration)
- ✓ vercel.com/blog/v0-app (v0 → full-stack, one-prompt positioning)
- ✓ github.com/amplication/amplication (open-source deterministic data-model → full-stack CRUD generation)
- ✓ anthropic.com/engineering/multi-agent-research-system (orchestrator delegation contract: objective/output-format/tools/boundaries)
- (support.claude.com/en/articles/9487310 artifacts = sandboxed self-contained code; plan-mode/AGENTS.md evidence inherited from [register 123])

---

## A-c2 — Compile/produce pipelines: zero-key self-hosted compile+verify for an emitted scaffold

**Question:** for an emitted scaffold (package.json + .ts sources), what is the best zero-key self-hosted compile/verify path (esbuild vs tsc vs node strip-types), what do low-code tools run post-generation, and what are the published "generated code is verified" gate patterns?

### Toolchain evidence

- **Node native type-stripping is the zero-key winner.** `✓` nodejs.org/learn/typescript/run-natively: Node ≥ v22.18.0 runs erasable-TypeScript **with no flag and no build step** (older: `--experimental-strip-types`); constraints — only *erasable* syntax (type annotations, interfaces, type aliases, `import type`); NOT supported: `enum`, parameter properties, namespaces with runtime code, import aliases. Node does **not type-check** — the official recommendation is "run Node directly for fast feedback, run `tsc --noEmit` in a separate command/CI for type checking." RapidTool already lives on Node 22 strip-types with explicit `.ts` imports — the emitted scaffold should inherit exactly that contract (repo convention = its own best practice).
- **esbuild** = transpile/bundle speed only; **does not type-check** (esbuild docs `✓` esbuild.github.io; Vite's own position `✓` github.com/vitejs/vite/issues/1585: type-checking in the bundler "loses most of the speed"); 2026 community consensus is split roles — esbuild for bundle, tsc for types `✓` medium.com esbuild-vs-swc-vs-tsc (community analysis, flagged). **tsc** = the semantic gate (`tsc --noEmit`), slow but complete.
- TypeScript 5.8's `erasableSyntaxOnly` flag makes a tsconfig *enforce* strip-types compatibility `✓` devblogs.microsoft.com/typescript (announcing TS 5.8 beta — cited from node docs).

### What low-code builders actually run post-generation

- **Bolt:** generates file tree → WebContainer runs `npm install` → runs the project / dev server → live preview `✓` PostHog (above); its prompt mandates install-before-code ordering `✓` prompts.ts (above).
- **v0/Lovable:** preview-first (component preview / hosted preview), then deploy; Lovable additionally executes backend work (SQL migrations) and runs an error→"try to fix" auto-repair loop on build failures `✓` lovable.dev guides + dev-walkthrough transcript (video, flagged as demo evidence).
- **Claude Code** (the reference for the *verify* half): `✓` code.claude.com/docs/en/best-practices — "Give Claude a check it can run: tests, a build, a screenshot… the loop closes on its own." Escalation ladder, each step trading setup for attention: **(a) in-prompt check** (write validateEmail + example cases, "run the tests after implementing") → **(b) `/goal`** with a *separate evaluator* re-checking after every turn → **(c) Stop hook** = deterministic script gate that blocks turn-end until it passes (8-consecutive-block override) → **(d) verification subagent** = "a fresh model tries to refute the result, so the agent doing the work isn't the one grading it." Plus: "Have Claude show evidence rather than asserting success."

### Concrete recommendations (sized for THIS codebase)

1. **Emit path = Node type-stripping, not esbuild, not tsc-emit.** Generated scaffold: package.json (deps declared up front) + erasable-only .ts sources with explicit `.ts` relative imports. Verification needs **no bundler and no keys**: `node --test` runs the fixture suite directly on the .ts sources (≥22.18). Add an `erasableSyntaxOnly` tsconfig in the scaffold so the constraint is enforced, and stamp it into the synthesis prompt (A-c1 rec 3). Zero new runtime deps; matches repo convention exactly.
2. **esbuild only when a deliverable needs bundling** (single-file CJS/browser artifact — e.g. the CG-11 zip deliverable). Do not add it to the *verify* path; it type-silently strips errors.
3. **tsc `--noEmit` = advisory evidence, not the gate**, for generated code: a flash-first-attempt module will not always satisfy strict types; promote lint/type output into the repair prompt (CG-05) but let the machine **gate** on runtime fixtures (`node --test` exit code + output tail). This mirrors the house advisory-gate law (CG-03) and Claude's own "checks are convention, evidence gates" split.
4. **Implement the queued z1 `compile-check.server.ts` + `check` verb** (129_z1 "NOT landed") as: write scaffold to temp dir → `node --test` (or the existing `node-runner` real-exec) → verdict = exit code + per-fixture pass/fail + stdout tail, **not** prose. Exit-code-producing checks are the entire "generated code is verified" trick in every reference above.
5. **The published 4-rung verification ladder maps 1:1 onto existing RapidTool machinery — say so in the UI/ledger** so CG-03's "machine evidence closes gates" has vocabulary: in-prompt check ≈ `p6-test` probe (dod.ts:145); Stop hook ≈ `enforceDod` blocking; `/goal` separate evaluator ≈ oracle fixtures re-run per repair iteration (verify.server.ts:590); fresh-model refuter ≈ CG-17 seat. The only missing rung is a deterministic *blocking* gate with a documented override (Claude's 8-block override ≈ an explicit, ledgered human override — cf. CG-03 dated default flip).

**Sources (7):**
- ✓ nodejs.org/learn/typescript/run-natively (type stripping ≥22.18 unflagged; erasable-only constraints; tsc --noEmit split)
- ✓ code.claude.com/docs/en/best-practices ("Give Claude a check it can run"; /goal; Stop hooks; verification subagent; evidence-not-assertions)
- ✓ esbuild.github.io (transform/bundle API; no type-check) + ✓ github.com/vitejs/vite/issues/1585
- ✓ raw.githubusercontent.com/stackblitz/bolt.new prompts.ts (install-first ordering, full-file rule)
- ✓ newsletter.posthog.com/p/from-0-to-40m-arr-inside-the-tech (Bolt post-gen = npm install → run → preview)
- ✓ medium.com/esbuild-swc-and-tsc-which-compiler-should-you-use-in-2026 (community, flagged: esbuild bundle + tsc typecheck split)
- (devin.ai / lovable.dev post-gen claims cross-checked via [register 123]; Lovable auto-repair = video demo, flagged)

---

## A-c3 — Memory/recall in coding agents: what Claude Code / Codex / Cursor persist and how they retrieve it

**Question:** how do Claude Code / Codex / Cursor persist + recall lessons/context across sessions (file-based formats, retrieval), and what should RapidTool's lesson store copy?

### Evidence (all primary, this pass unless noted)

- **Claude Code** `✓` code.claude.com/docs/en/memory — two complementary file layers, both loaded at session start, both plain markdown:
  - **CLAUDE.md hierarchy** with scope + load order: managed policy (org) → user `~/.claude/CLAUDE.md` → project `./CLAUDE.md` or `.claude/CLAUDE.md` → local `CLAUDE.local.md` (gitignored, personal). Files in parent directories load at launch; files in subdirectories **load on demand** when Claude reads files there. `@path` imports pull in other files (max depth 4). `.claude/rules/` with path globs scope instructions to file types. **Size guidance: < 200 lines/file** ("longer files consume more context and reduce adherence"); > 4 MiB files are skipped. `/init` auto-generates a starter CLAUDE.md by analyzing the codebase; **"add to it when Claude makes the same mistake a second time."**
  - **Auto memory** (Claude-written learnings): per-repository, "loaded into every session — **first 200 lines or 25 KB**"; records your corrections and preferences; `/memory` lets the human **browse, edit, delete** (plain markdown); subagents can keep their own persistent memory; root CLAUDE.md **survives `/compact`** (re-read from disk and re-injected).
  - Retrieval at this scale = **deterministic truncation with scope ordering, not vector search.**
- **Codex** `✓` learn.chatgpt.com/docs/agent-configuration/agents-md — AGENTS.md layered discovery: global `~/.codex/AGENTS.md` (or `AGENTS.override.md`, which wins) → walk from git root to cwd, nearest wins, nested files concatenated; fallback filenames let it read CLAUDE.md/.cursorrules. Plus **Codex Memories** `✓` learn.chatgpt.com/docs/customization/memories (official): local store at `~/.codex/memories/` containing *summaries, durable entries, recent inputs, supporting evidence* from prior chats; generated **in the background after a chat is idle** (skips active/short sessions), redacts secrets, off by default, per-chat `/memories` control, `memories.use_memories`/`generate_memories` flags, a dedicated consolidation pass. Memory = recall layer; **"keep required team guidance in AGENTS.md… memories are not the only source for rules that must always apply."** (Community analysis `✓` mem0.ai/blog/how-memory-works-in-codex-cli, flagged: instruction files have a 32 KiB cap with silent truncation — the weakness RapidTool should not copy.)
- **Cursor** `✓` cursor.com/docs/rules — rules are **human-authored context files**, four kinds (project `.cursor/rules/*.mdc` with `description/globs/alwaysApply` frontmatter; user rules; team rules; plain AGENTS.md); application modes = always / when file matches glob / agent-picks-by-description / manual @-mention. Best practice: < 500 lines, "add rules only when you notice Agent making the same mistake repeatedly." No vendor auto-memory; the community "memory bank" pattern (a journal/CLAUDE file the agent loads at task start) is popular but community-only `✓` lullabot article + cursor-bank (flagged).
- **AGENTS.md is now an open cross-tool format** (Linux Foundation's Agentic AI Foundation) `✓` agents.md — Codex, Cursor, Jules, Copilot, Windsurf, Aider, Gemini CLI etc. all read it; "agents will attempt to execute the programmatic checks listed in it."
- **Devin Knowledge** — org memory with edit/dismiss/regenerate + approval, learns by reading past trajectories `[register 123 / 90 §1.4 devin.ai]`.

### Concrete recommendations (what the lesson store should copy — and not)

RapidTool already has the capture half (L1–L5 writers at seal/verify/run-completion, 117; content-addressed, id-dedup, capped 80). The field's transferable lessons, in priority order:

1. **Deterministic recall budget with ordering — copy it.** Claude: "first 200 lines/25 KB loaded every session"; RapidTool has no equivalent budget on lesson injection. Copy: a hard injection cap (e.g. top-K FusionRank rows ≤ N chars) resolved by a *stable* ordering (rank, then recency), injected into synthesis/reframe prompts. Retrieval = truncation + rank, not embedding search, at this scale. (CG-10's meter discipline applies.)
2. **Human-visible, human-editable memory — copy it.** Both Claude (`/memory` browse/edit/delete) and Devin (edit/dismiss/regenerate + approval) make memory a *human surface*; Codex explicitly says memories are generated state, not a primary control. RapidTool's `KnowledgeStore`/vault has no edit/promote affordance (93 DF-17; CG-09 Tier-3, 95 P0-I) — the /memory UX is the concrete reference design.
3. **Scope keys + nearest-wins — copy the shape.** Claude/Codex/Cursor all layer scopes (org → user → project → subdir/glob) with deterministic precedence. RapidTool lesson rows are flat on `project.memory`; add scope fields (e.g. user / project-kind / domain / phase) so a rental-brief lesson never leaks into a CLI-tool synthesis prompt, and define closest-scope-wins when conflicting lessons exist.
4. **"Same mistake twice → promote" trigger — copy it.** Claude: add to CLAUDE.md when the model repeats a mistake; Codex waits for idle + skips short sessions. RapidTool: add a promotion rule — a lesson type that fires only when the same failure class (by RT_E code) recurs across ≥2 runs (L3 currently fires per failure); this is the difference between "auto memory" and "learning."
5. **Compaction survival — keep what you have, extend the guarantee.** Root CLAUDE.md re-injects after /compact; RapidTool lessons are content-addressed and survive (117), but verify that every compaction/context-trim path re-reads memory from the store rather than from the trimmed context.
6. **Do NOT copy:** Codex's silent 32 KiB truncation (make budget explicit, ledgered); Codex's non-editable generated state; mem0-style vector DB until cross-project scale demands it (agent-name convergence is file-based); Devin's autonomous-suggestion approval burden at project scale (keep the HITL promote gate for *cross-project* rows only).

**Sources (8):**
- ✓ code.claude.com/docs/en/memory (CLAUDE.md scopes/load order/@imports/rules; auto memory 200-lines/25KB; /memory; compaction survival; /init; "same mistake twice")
- ✓ learn.chatgpt.com/docs/agent-configuration/agents-md (Codex AGENTS.md discovery, override, fallback filenames)
- ✓ learn.chatgpt.com/docs/customization/memories (Codex ~/.codex/memories: summaries/durable/recent/evidence; background idle generation; secret redaction; flags)
- ✓ cursor.com/docs/rules (.cursor/rules .mdc frontmatter; 4 application modes; AGENTS.md; <500 lines)
- ✓ agents.md (cross-tool AGENTS.md standard, Linux Foundation)
- ✓ mem0.ai/blog/how-memory-works-in-codex-cli (community analysis, flagged: 32 KiB cap, layer split)
- ✓ lullabot.com/articles/supercharge-your-ai-coding-cursor-rules-and-memory-banks (community memory-bank pattern, flagged)
- devin.ai Knowledge (edit/dismiss/regenerate + approval) [register 123]

---

## Proactive sweep — fresh gaps NOT in fixes/123 (current, sourced)

123's register (CG-01…CG-17) already covers multi-file output, evidence gates, runtime repair, preview, checkpoints/git, plan-first wild, streaming, MCP. What the 2025-26 field added that 123 does **not** carry:

### P-01 — Prompt-injection hardening for the research→codegen pipeline (NEW, was not in 123)
- Evidence: `✓` labs.cloudsecurityalliance.org/research/csa-research-note-claude-code-github-action-prompt-injection — "Comment and Control": Claude Code/Gemini CLI/Copilot agents ingested untrusted GitHub metadata (PR titles, issue bodies, comments) as authoritative prompt content → live API-key theft; NIST calls prompt injection "gen AI's greatest security flaw"; `✓` pluto.security/blog/claude-code-vulnerability; `✓` arxiv.org/html/2601.17548v1 (systematic analysis of agentic coding assistants); `✓` anthropic.com/research/prompt-injection-defenses (Anthropic's mitigation: scan untrusted content entering context, flag with classifiers).
- **RapidTool relevance (concrete):** research findings and ingested reports are *untrusted text* that later flows into synthesis prompts; a hostile page/brief could try to steer generated code or override DoD criteria. Recommendation (sized): (1) keep **provenance tags on every ingested research/report row** (deterministic — the harness already stamps live findings); (2) a **boundary rule in codegen prompts**: machine-derived contracts (typeSignatures, DoD criteria, requirement list) are the only normative text — ingested prose is descriptive context and must never override them; (3) never let brief/research content instruct tool use or exemption from gates. Pure prompt + tag work, no new deps. This is a *differentiator* the field is fumbling — governed provenance is RapidTool's lane.

### P-02 — Terminal-Bench-style terminal-state verification as the oracle model (NEW)
- Evidence: `✓` tbench.ai (Terminal-Bench 2.0, 89 tasks across software engineering/security/biology/gaming); `✓` arxiv.org/html/2601.11868v1 (Terminal-Bench: agents graded on Claude Code/Codex/Gemini CLI/OpenHands; success = observable terminal/file state, not hidden unit tests); `✓` langchain.com/blog/evaluating-deepagents-cli-on-terminal-bench-2-0 (~42% for Sonnet-4.5-class agents — this class of task is *hard*).
- **RapidTool relevance:** P6's oracle cases (verify.server.ts `generateCases`) are fixture-assertions on module output. For the cli-tool/library delivery kinds the stronger published oracle is **run-the-thing-and-check-terminal/file state**. Recommendation: add a terminal-state oracle case type (spawn emitted entrypoint, assert on exit code + stdout/file side effects) for cli-tool scaffolds — reuses node-runner, no new dep; and consider a tiny **golden-fixture regression bench** (N ~10-20 briefs, converge-rate per failure class — bench.ts exists but has no codegen-convergence consumer in-tree today) so the 121 failure-class rotation is *measured*, not anecdotal.

### P-03 — Plan artifacts as files + the 4-part delegation contract for crew seats (adjunct to CG-12/CG-13)
- Evidence: `✓` anthropic.com/engineering/multi-agent-research-system (delegation contract = objective + output format + tool/source guidance + task boundaries; vague delegation ⇒ duplicated/gapped work); Cursor plan-mode plans "saved as files… for team sharing" `[register 123]`.
- **RapidTool relevance:** crew ROLE_SPECS (crew.server.ts) are flat text. Recommendation: restate each crew role as the published 4-part contract (objective / output format / tool+source guidance / boundaries) — cheap, and makes advisory crew output comparable across runs. Fold into CG-12's `wild.plan` artifact when it lands.

### P-04 — AGENTS.md + llms.txt in the emitted scaffold/deliverable (adjunct to CG-07/CG-11/CG-14)
- Evidence: `✓` agents.md — every major coding agent reads AGENTS.md and will attempt the checks listed in it; `✓` llmstxt.org — thousands of sites publish /llms.txt; coding agents use them reliably.
- **RapidTool relevance (cheap, high-leverage):** the product's own thesis is "hand off to other agents" (Agent Packet + handoff prompts). Recommendation: emit an **AGENTS.md** (build/test commands, erasable-TS contract, verify instructions) and a **README/llms.txt** inside the CG-07 vertical-slice scaffold and the CG-11 zip deliverable — so the produced folder is *self-describing to whatever agent or human opens it next*. Also publish RapidTool's own docs llms.txt for agent discoverability (this repo's AGENTS.md + docs are exactly the kind of content the convention exists for).

### P-05 — Post-generation pipeline as a *productized* ladder (see A-c2 rec 5)
- Cross-ref, not a new item: Claude Code's 4-rung verification ladder (in-prompt → /goal → Stop hook → fresh-model refuter) is the clearest published articulation of what RapidTool's dod probes + enforceDod + CG-17 seat already *are*. Use the ladder's vocabulary in CG-03's implementation so the "verified" story is tellable in one screen.

**Honest floor (unchanged from 123 §4):** don't chase WebContainers/browser-VM preview, cloud fleets, IDE depth, or design polish — P-01…P-05 are all additive to the keyless deterministic floor (no new runtime deps; pure/prompt/artifact work).

---

## Activity log (this pass, 2026-09-07)

- Read protocol (131_protocol.md), polled 131_questions.md (empty), read 123 dossier + 90 §0-§1 for register inheritance and gap de-dup.
- Verified internal anchors: engine.ts:783-868 (P8 case-8 screen contract), :831-836 (118 P-D3 flow-derived screens), knowledge.ts lesson wiring (117), z1 compile-check seam queued (129_z1), bench.ts exists in-tree.
- Fetched this pass (✓): nodejs.org TS-native doc; code.claude.com/docs/en/memory + /best-practices; learn.chatgpt.com AGENTS.md + Memories docs; cursor.com/docs/rules; agents.md; bolt.new `app/lib/.server/llm/prompts.ts` (raw); tbench.ai + Terminal-Bench arXiv; CSA + Pluto + Anthropic prompt-injection pages; Anthropic multi-agent research system; Vercel v0 blogs; Amplication repo; llmstxt.org; mem0/lullabot (flagged community); PostHog "How bolt.new works".
- Wrote fixes/131_findings.md (this file). No source files touched.

## Files created / modified

- **Created:** `fixes/131_findings.md` (this file, append-only). No source read-modifies; no tests executed.
