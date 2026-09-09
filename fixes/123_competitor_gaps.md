# 123 — Competitor capability-gap dossier: what the field has that RapidTool needs to produce software at its best

- **File:** `fixes/123_competitor_gaps.md` (repo root `C:/Users/mnril/Desktop/RapidTool Main`; git-bash `/c/Users/mnril/Desktop/RapidTool Main` — **not a git repo**).
- **Date / agent:** 2026-09-07 · **Flash ANALYST A2** (competitor capability-gap analysis). **Strictly read-only on RapidTool source** — this file is the only output.
- **Question answered:** what do OpenAI Codex, Cognition Devin, Manus, v0, Bolt/Lovable, Cursor, Claude Code, Aider, Windsurf (Devin Desktop), Google Antigravity, GitHub Copilot cloud agent have that RapidTool needs to *function at its best — actually produce software* — and which items are **missing, unwired, or partial in this tree**?
- **0-hallucination rule — internal:** every RapidTool claim carries a `file:line` grepped/read **this session (2026-09-07)**; numbers are current at write time (± normal drift). **— external:** competitor claims are either (a) **inherited from the tree's same-day registers** — 90_LEAPFROG.md §1 [C1–C5]/[A1–A8]/[D1–D7]/[G1–G4] + its ✓TODAY 2026-09-06 pages, 93 §7, 95 §1.3 — or (b) **fetched THIS pass** (manus.im; code.claude.com/docs `llms.txt`, `how-claude-code-works.md`, `memory.md`). Nothing invented; vendor-scale claims are labeled as vendor claims; community-only claims are flagged.
- **Consumes:** 90 (§1 field sweep, §2 baseline, §3 shortcoming ledger), 93 (design-flaw ledger DF-xx), 95 (post-wave open register G1–G20), 13 (G-01…G-40 register), 121 (P6 ship state), README, AGENT_GUIDE. **Feeds:** the next fix wave and the LEAPFROG compiler.

---

## §0 TL;DR — the dossier in one screen

**RapidTool today is a governed pre-flight workbench.** It plans (13 deterministic phases), researches, gates with evidence-hashed DoD probes, mints an Agent Packet + handoff prompts for *other* coding agents, and — newest — synthesizes **one CommonJS module envelope** that a machine verify-fix loop actually runs (`codegen.server.ts`). The positioning is explicit and honest: "it does not build software itself" (AGENT_GUIDE.md:5); the Settings modal states "It does not deploy. It persists browser-local only" (console.tsx:990); gates "are advisory: they record exit criteria, they never block a run" (console.tsx:978).

**Every competitor in scope sells the opposite half of the loop: producing *running software in a live repo*.** Their loop is brief → **tools that edit many files in a real tree, run the tree, see the failure, repair, commit** → preview/PR/deploy. RapidTool's loop stops one step short of "files that run together", and its newest code-producing capability (P6 keyed synthesis) is a single-module envelope whose live failures are honest and well-logged but **not yet closed** (121: failure class rotates through expansion → brief-fit → runtime binding → oracle grounding).

**The six highest-leverage gaps — in order (details + fix directions in §2, ranks in §3):**

| # | Gap (one line) | Why it blocks "produce software" |
|---|---|---|
| CG-01 | **P6 emits one module envelope; shipping needs a multi-file tree.** No file-by-file decomposition, no assembly, no file-tree iteration. | Every real product is >1 file. One-shot 20-function envelopes are at flash's feasibility edge (121 §"Structural recommendation"). |
| CG-03 | **Machine verification exists but does not gate.** Gates advisory by default; `verify` outcomes never close DoD probes. | Claude Code's whole pitch is "give it a check it can run"; RapidTool runs checks but nothing blocks on them. |
| CG-04 | **Runtime-correctness repair is open.** Modules pass static/brief-fit validation, then die at execution with unbound names. | 121 Attempt C/D: `ReferenceError: createProperty is not defined` after 3 repairs. Last-mile auto-repair needed. |
| CG-07/11 | **No produced artifact is a *runnable thing* the user can open, run, or hand over.** No file bundle, no preview of behavior, no deploy decision (deploy is currently "no" by design). | Bolt/v0/Lovable/Cursor ship preview+infra; Devin/Copilot ship PRs. RapidTool ships a string in an artifact tab. |
| CG-08/12 | **No git-backed workspace, no checkpoints, no plan-first wild.** Ledger is append-only and irreversible; wild executes then reviews. | Copilot/Aider/Gemini make every step a commit/restore point; Codex/Cursor/Antigravity plan *before* executing. |
| CG-15/16 | **Parity face still open:** no streaming/stop/steer; HITL reviews artifact *titles*, not diffs/evidence. | Feels broken vs Codex TUI steering, Antigravity Review-Changes diff panes, Claude Code Esc-cancel. |

**Honest floor (do NOT chase — 90 §0/§6, reaffirmed):** IDE depth, cloud-scale fleets, frontier-model IQ, visual design polish, cloud infra. The winnable war stays **"verifiable, auditable, budgeted software production"** — the fix directions below all preserve the keyless deterministic floor.

**Closed since the 90/93/95 registers were written (verified on disk today — do NOT re-litigate):** chat *persistence* (P0-2: `Project.chatLog` types.ts:343, UI console.tsx:4395–4656); Oracle-tab **machine-verify visibility** (console.tsx:4585–4633 renders last `verify` outcome + artifacts — closes 93 DF-15/DF-16 UI half); keyed P6 codegen + brief-fit + signature + `injectMissingExports` (codegen.server.ts:189,660, engine.ts:2021–2026); `enforceDod` per-project **opt-in flag** exists (store.ts:111,396 — but default still off, see CG-03); lesson L1–L5 writers wired at engine seal/verify/run-completion (117); lint advisory in verify evidence (verify.server.ts:291,616).

---

## §1 Baseline — RapidTool's production model vs the field's (verified today)

| Concern | RapidTool, on disk today | The field (evidence) |
|---|---|---|
| Product loop | Brief → 13-phase governed plan → gated artifacts → **Agent Packet + handoff prompts** → (keyed) one module + machine verify (README; AGENT_GUIDE.md:5 "does not build software itself") | Brief → **tools edit a real repo** → run/tests → repair → commit/PR/deploy (Claude Code agentic loop "gather context, take action, verify results" — code.claude.com how-claude-code-works ✓TODAY this pass; Codex plan→implement→validate→repair [C1]; Devin PR-with-CI loop devin.ai ✓TODAY per 90 §1.4; Copilot "every step happening in a commit" ✓TODAY per 90 §1.14) |
| Code output shape | **One CommonJS module string** in `Project.generatedSource` (types.ts:300); cap ~60k chars (codegen.server.ts:44); exports must match typeSignatures | **Multi-file trees, edited file-by-file**: Claude Code Write/Edit/rename file ops (✓TODAY this pass); Cursor multi-file edits (90 §1.3); Aider git-native unified diffs (90 §1.9); Codex edits with git-backed workspace [C4/C5] |
| Execution | Bounded local runner: `runCases` (verify.server.ts:366), `verifyAndFixServer` (verify.server.ts:590), `node-runner.server.ts` (honest "bounded, NOT a security sandbox"), `exec.ts:44–55`, UI "Run module (bounded)" console.tsx:1895–1902 | Claude Code runs shell/tests/git in-loop (✓TODAY this pass); Codex OS sandbox modes `read-only\|workspace-write\|danger-full-access` + network rules [C2/C5]; Copilot runs tests/linters in ephemeral Actions env (✓TODAY 90 §1.14) |
| What blocks advancement | Gates **record** (dod.ts:301 `runGate`; p6-test:145, p6-verified:172, p6-brief-fit:199) but only block when per-project `enforceDod === true` — **off by default** (store.ts:111,396,448 `finishPhase`) | Claude Code Stop hooks block turn-end 8× before override; `/goal` separate evaluator; verification subagent "fresh model tries to refute" (✓TODAY 90 §1.2 / 93 §7 [CB]) |
| Repo/undo layer | **None.** No git anywhere (grep `isomorphic-git`/git spawn: zero hits); ledger append-only irreversible (engine.ts wildLog:2436); artifacts replaced on regenerate | Aider auto-commit + git-undo (90 §1.9); Gemini shadow-git snapshot + `/restore` re-proposes tool call [G4]; Copilot every step a commit (90 §1.14); Cursor checkpoints/rollback (90 §1.3); Cline checkpoints (G-26) |
| See-the-product | Design-token HTML preview + static SVGs; preview-host-bridge.ts is **only for RapidTool itself embedded in a Grok sandbox**, not for generated apps | Bolt instant in-browser preview + element-select iteration (✓TODAY 90 §1.5); v0 preview-then-deploy (90 §1.7); Devin visual QA (90 §1.4); Claude Code Chrome/computer-use for testing web apps (✓TODAY this pass, docs index) |
| Delivery | "It does not deploy" (console.tsx:990); downloads = packet/vault/project JSON | Bolt/Lovable cloud infra + hosting + auth + DB (90 §1.5/1.6); v0 → Vercel (90 §1.7); Devin/Copilot → merged PRs (90 §1.4/1.14) |
| Memory across sessions | `KnowledgeStore` (append-only, `savePattern` knowledge.ts:250, `findPatterns`:293, `injectProven`:370) — **no production consumer** (CLI-only per 90/95); chatLog per project; lesson L1–L5 writers + prompt-engine injection landed (95 §1.1, 117) | CLAUDE.md hierarchy + **auto memory** (per-repo, loaded every session, first 200 lines/25 KB — ✓TODAY this pass memory.md); Devin Knowledge with edit/dismiss/regenerate + approval (✓TODAY 90 §1.4); AGENTS.md hierarchy (Codex [C4]); mem0/Letta patterns (G-39) |
| Workflow shape | Fixed linear 13-phase machine (phases.ts); wild = bounded macro-step execute-then-review, cap 20 (store.ts:956), **no plan object** (grep `wild.plan`/`autoPlan`: zero) | Codex `/plan` approval before code [C1]; Cursor Plan Mode saved as files (✓TODAY 90 §1.3); Antigravity planning Artifact + Request Review (90 §1.11); Copilot plan artifact (90 §1.14); Devin fleets (90 §1.4); Claude Code subagents + workflows (90 §1.2) |
| Human-in-loop | HITL dock = prose prompt + artifact titles + ≥12-char reject note; approve over unmet DoD needs no note (93 DF-09); no diff view, no restore | Antigravity Review-Changes diff pane + inline comments + VCS panel filtered to agent edits [A3/A4]; Cursor Agent Review per-commit (✓TODAY 90 §1.3); Codex `/review` [C1] |

---

## §2 The seven dimensions, gap by gap

### D1 — Code editing / writing ergonomics (multi-file writes, file-tree awareness, edit tooling vs one-shot envelopes)

> **Dimension read:** the field *edits files in a tree the model can see and re-edit*; RapidTool *emits one opaque envelope per attempt and replaces it*. Claude Code ships file operations (Read/Edit/Write/rename) plus search over a real codebase, chaining "dozens of actions" per task (how-claude-code-works ✓TODAY this pass). Aider's repo-map ranks files by dependency graph into the active token budget (90 §1.9). Codex edits against a git-backed workspace (95 G8 evidence [C4/C5]). RapidTool's honest counter: its codegen is deterministic-floor-first and never edits a *user's* repo — but the gap bites the moment P6 tries to produce software: **there is no tree to iterate.**

- **CG-01 (P0, D1) — Single-module envelope ⇒ multi-module, assembled output with file-tree awareness.**
  - *Competitor capability:* multi-file generation/editing grounded in a file tree (Claude Code file ops + search ✓TODAY this pass; Cursor "multi-file edits" 90 §1.3; Aider repo-map ranking 90 §1.9; Claude Code docs even warn against oversized single outputs — CLAUDE.md "files over 200 lines… may reduce adherence", memory.md ✓TODAY this pass).
  - *RapidTool today:* one flash JSON envelope of a ~20-function CJS module (`liveP6Synthesis` codegen.server.ts:660; maxTokens 12k, max 60k chars :43-44); decomposition into "2-3 sequential synthesis calls of ~5-8 functions" is **queued but not landed** (121 §Remaining class (b)); generated output is one `generatedSource` string on Project (types.ts:300); no per-file hashes, no import-graph view of what was generated.
  - *Gap:* modules too large for flash → rotating failure classes (121); no file-level accountability; an import error between hypothetical files could never be caught because files don't exist.
  - *Fix direction (sized):* (1) land module decomposition — chunk `typeSignatures` into groups of ≤8, sequential synthesis calls (121's queued increment (b)); (2) add additive `Project.generatedTree?: { path; source; hash }[]` (types only, deterministic); (3) run the existing pure import scanner `dependencyGraph()` (arch-tools.ts, G-30-narrow, zero-dep) over the assembled tree as a **new p6-arch probe** (named cycle ⇒ fail) — the probe infrastructure already exists (dod.ts additive probes, p6-brief-fit pattern :199).
  - *Maps:* 121 queued; 90 §3 row 5/§10 G-10 · G-30/G-31/G-33 register; 95 G12.

- **CG-02 (P1, D1) — Iterate, don't regenerate: edit-and-repair semantics preserve prior work.**
  - *Competitor capability:* Claude Code turns are "chaining dozens of actions… course-correcting along the way" (✓TODAY this pass); Aider applies unified diffs — git is the review/undo layer (90 §1.9); Antigravity lets the agent halt before proposed changes with a full diff review (90 §1.11).
  - *RapidTool today:* repair path re-prompts the *whole envelope* (`synthWithBackoff` codegen.server.ts:487, one bounded re-prompt), and a rejected/regenerated artifact **replaces its predecessor body** (93 DF-11 addendum: only a rejection-response block is appended, engine.ts:819-825 region); no per-attempt version history, no diff between attempt N and N+1 shown to the human or the next prompt.
  - *Gap:* every repair restarts from scratch; no delta learning ("last time the export list was the problem") except the lesson writers; humans cannot see what changed between attempts.
  - *Fix direction:* store per-attempt module versions (content-addressed, ledger `p6.attempt` rows — mirrors `wildLog` engine.ts:2436); render a diff of attempt N+1 vs N in the HITL/verify block using the pure hand-rolled line diff or jsdiff (G-04); feed "attempt N failed because X" as a bounded repair-context line (mechanical, from the runner evidence — closes into CG-04).
  - *Maps:* 93 DF-11/DF-32; G-04; 95 G9 (critique persistence).

### D2 — Execution & feedback loops (sandboxed runs, test feedback, compile errors → auto-repair)

> **Dimension read:** this is RapidTool's strongest internal muscle and its weakest product surface — the verify-fix machinery is real (runner, harness-minted passes, honest labels) but **evidence is advisory, critique is unpresisted, and runtime failures still escape**. The field treats the run-fail-repair loop as *the* product (Claude Code "the difference between a session you watch and one you walk away from" — 90 §1.2).

- **CG-03 (P0, D2) — Machine verification must close gates: make evidence *block*, visibly.**
  - *Competitor capability:* Claude Code Stop hooks block turn-end until a user-supplied check passes (8-block override) + `/goal` separate evaluator + fresh-model verification subagent (✓TODAY 90 §1.2); Copilot executes tests/linters in an ephemeral env before PR (✓TODAY 90 §1.14); Codex validate→repair loop [C1].
  - *RapidTool today:* `p6-verified` probe is met only by a machine-promoted lastTest (`dod.ts:15-16,172`) — the machinery exists — but `enforceDod` **defaults off** (per-project opt-in, store.ts:111 "off by default — advisory behavior unchanged", :396, `finishPhase` :453 auto-advances past FAIL gates when off); the UI tells the user gates "never block a run" (console.tsx:978); progress rail prints "sealed" regardless (93 DF-08).
  - *Gap:* the flagship differentiator (governed gates) is opt-in while its presentation ("sealed", "Delivery sealed") is unconditional — and verify outcomes never feed the DoD probes that would make blocking meaningful.
  - *Fix direction:* (1) decide + date the `enforceDod` default flip (95 P0-C/G4): flip default true with a dated expiry flag per 90 §13.5.4 discipline, or make unmet-gate advance a loud, ledgered event; (2) thread `VerifyOutcome` (status/evidence/iterations — verify.server.ts:590) into the `p6-verified` probe evidence (a hash, not prose); (3) rail prints "sealed" only for `gate.passed === true` (93 DF-08 fix spec #5). All three are additive to existing machinery.
  - *Maps:* 90 §3 row 5 (impact 10); G-10/G-11/G-13; 93 DF-08; 95 G4/G11 (P0-C/P1-A); M-09.

- **CG-04 (P0, D2) — Close the runtime-correctness auto-repair loop.**
  - *Competitor capability:* Codex's loop is literally plan→implement→**validate→repair** in one live turn [C1]; Claude Code: "fix the failing tests → read the error output → edit → run the tests again" (how-claude-code-works, example ✓TODAY this pass).
  - *RapidTool today:* `verifyAndFixServer` iterates up to 3× with repair prompts and mints `passed` only from the real runner (verify.server.ts:590; 121 live proof), **but** 121 Attempt C/D shows the residual class: module passes static validation + brief-fit, then `ReferenceError: createProperty is not defined` — the model "does not bind every exported name at runtime" (121 §Live-proof). `injectMissingExports` (codegen.server.ts:189) mechanically fixes the declared-but-unexported case; other binding failures still escape after 3 iterations.
  - *Gap:* no guaranteed-convergence path for unbound-name errors; no echoed error list in every repair prompt (partially there per 121); failures cost a full HITL cycle.
  - *Fix direction:* (1) echo the exact runtime error list (ReferenceError names + stack frame names) verbatim into EVERY repair iteration prompt (121 queued (a)); (2) after N=2 failures, switch from "fix the module" to "deterministically wrap": generate a thin binder module that imports the source and re-exports every `typeSignature` name, failing loudly for names the source genuinely lacks (mechanical, honest — reuse `injectMissingExports` + `oracleSignatureFunctionNames` verify.server.ts:458); (3) record the failed-attempt critique `{symptom, hypothesis, fix}` (95 G9/P0-H) into the next `generateCases` grounding (verify.server.ts:512).
  - *Maps:* 121 remaining-class; 90 §10 G-10; 95 G9/G11; G-25 Reflexion pattern.

- **CG-05 (P1, D2) — Lint/type feedback as a *first-class repair input*, not an advisory tail.**
  - *Competitor capability:* Claude Code code-intelligence surfaces "type errors and warnings after edits" (✓TODAY this pass); Aider auto-lints; Codex validate step [C1].
  - *RapidTool today:* `lintFailures()` heuristics run and land in the evidence string as "; lint advisory: …" (verify.server.ts:291,616; 95 §1.1) — **advisory only, never a repair prompt input beyond the string**.
  - *Gap:* lint findings exist but don't steer the repair or block.
  - *Fix direction:* promote lint findings into the repair prompt's failure list (same channel as CG-04's error echo); decide the advisory→blocking question for `p6-lint` as a dod probe (95 G12/P1-B rest).
  - *Maps:* 95 G12; G-29 (metrics)/G-16 (honesty lint); 93 DF-16 addendum.

### D3 — UI / build outputs (does the produced product RUN? scaffolding, framework wiring, preview)

> **Dimension read:** every app-builder competitor makes the produced thing *visible and runnable* — Bolt's instant in-browser preview where the preview is the editor (90 §1.5), v0's Next+shadcn preview, Devin's visual QA with a real browser (90 §1.4), Claude Code driving Chrome to test web apps (✓TODAY this pass docs index). RapidTool can *run* its module (UI button console.tsx:1895-1902, headless) but cannot *show* the product, and its scaffold is honest-but-inert.

- **CG-06 (P1, D3) — A "behavior preview" of the verified module (verdict + transcript + fixtures), then decide on full app preview later.**
  - *Competitor capability:* Bolt instant preview + "select an element on the preview" (90 §1.5); Claude Code Chrome integration "test web apps, debug with console logs" (✓TODAY this pass, docs index); Devin Review = visual QA with full browser (90 §1.4).
  - *RapidTool today:* the Oracle tab shows the last verify outcome (console.tsx:4585–4633) and the phase card can run the module bounded (console.tsx:1895–1902), but output is a raw result object; no fixture-driven transcript, no pass/fail visualization per oracle case beyond counts; the **generated product itself has no browser or HTML surface** (design preview is the deterministic palette/HTML, design.ts — not the generated module); preview-host-bridge.ts exists only to let *RapidTool itself* be framed by a Grok sandbox.
  - *Gap:* a user cannot see what the produced code *does* — the single biggest perceived gap vs every prompt-to-app competitor.
  - *Fix direction (sized, honest):* (1) render the machine verify run as a fixture-by-fixture transcript UI (case → input → output/error → pass) in the Oracle/verify block — data already exists in `VerifyOutcome`, only rendering is missing; (2) for CJS data modules a transcript IS the meaningful preview — do not build a browser; (3) defer true G-18 (in-browser bundling) until the design tab earns usage (95 P2-C sequencing law).
  - *Maps:* G-18 (deferred full), 93 DF-15/16 (UI half closed, verdict rendering open), 95 W-2.

- **CG-07 (P1, D3/D5) — Runnable vertical slice: scaffold + codegen must converge on ONE runnable project shape.**
  - *Competitor capability:* Bolt/v0 scaffold *real* framework apps (Vite/Next + DB + auth) that run immediately (90 §1.5/1.7); Copilot's output runs in an Actions env before PR (90 §1.14).
  - *RapidTool today:* `scaffoldProject` emits a deterministic file set including honest placeholders ("assets/manifest.json — expected asset roster — NOT engine-generated", scaffold.ts:784); codegen emits a CJS module validated in isolation; **the two never meet** — no artifact is the scaffold-with-the-module-installed, so nothing produced is a runnable folder.
  - *Gap:* "Does the product run?" has no answer because there is no product-shaped artifact.
  - *Fix direction:* choose ONE vertical slice — a Node ESM/CJS project of `src/<n>.js` files + `test/` (node:test, matching what node-runner already executes) + package.json — and make P6's assembled tree (CG-01) drop into scaffold's file layout (scaffold.ts:775 pattern); deliverable = the assembled folder + verify report. This is the narrow version of G-20 (shipped-artifact pass) and reuses only existing machinery (scaffold.ts, codegen.server.ts, verify.server.ts, io.ts download/export patterns).
  - *Maps:* G-20; 90 §3 row 14 (G-18/G-20/G-37); 93 DF-01/DF-02/DF-03 (wrong-product class — the vertical slice is the honest counter).

### D4 — Context & memory (project context reuse across sessions, git integration)

> **Dimension read:** the field has two *automatic* memory layers — per-repo memory files loaded every session (CLAUDE.md + auto memory, Claude Code memory.md ✓TODAY this pass; AGENTS.md hierarchy Codex [C4]) and org knowledge with human approval (Devin Knowledge 90 §1.4). RapidTool built the store (knowledge.ts, vault, lessons) but wires almost none of it into the runs humans actually watch.

- **CG-08 (P1, D4/D5/D6) — Git-backed workspace + per-step checkpoints/restore.**
  - *Competitor capability:* Aider: every AI change is an auto-commit, git is undo/review (90 §1.9); Gemini CLI: shadow-git snapshot before every file-mutating tool + `/restore` reverts files *and conversation* and re-proposes the tool call [G4]; Copilot: "every step happening in a commit" (90 §1.14); Cursor checkpoints/rollback (90 §1.3); Codex git-backed workspace (95 [C4/C5]).
  - *RapidTool today:* **no git anywhere** (grep zero), root isn't a repo; ledger append-only and irreversible (engine.ts:2436 `wildLog`); no snapshot/restore type (95 G7 verified open); whole-project save only (store.ts:761 partialize → localStorage; io.ts export).
  - *Gap:* nothing can be undone, branched, or diffed — and the tree's own audits call irreversible-approval the top trust flaw (93 DF-10, 90 §3 row 4).
  - *Fix direction (two steps):* (1) **content-hashed delta checkpoints** first (95 P0-F re-spec: artifact/memory-level deltas, NOT full JSON; `restoreCheckpoint` = a ledgered `wild.restore` event, never silent); (2) then a **git export/commit verb** — shell out to the `git` CLI only when a repo exists (zero new runtime dep), or vendor isomorphic-git (G-40 git export) at P2. Checkpoint-before-restore and git-before-deploy are the same discipline.
  - *Maps:* G-26 (snapshot/rollback), G-40 (git export); 93 DF-10; 95 G7/P0-F.

- **CG-09 (P1, D4) — Wire cross-project memory into the packet, the reframe gate, and the vault edit surface.**
  - *Competitor capability:* Devin Knowledge: org memory with suggestions (edit/dismiss/regenerate), trigger recall, approval flow (✓TODAY 90 §1.4); Claude Code auto memory accumulates learnings automatically, per repo, loaded every session (✓TODAY this pass memory.md); mem0/Letta consolidation (G-39).
  - *RapidTool today:* `KnowledgeStore` complete and tested but **no production consumer** — `savePattern` knowledge.ts:250 and `injectProven` :370 are CLI/headless-only (90/95 G10 verified); prompt-engine Tier-3 lesson injection **landed** (95 §1.1); packet "Ranked memory (A2 FusionRank)" (packet.ts:292 region) doesn't yet call `injectProven`; vault is read-only with no edit/promote affordance (93 DF-17); HITL "Proposed knowledge" promotion surface absent (95 P0-I).
  - *Gap:* the self-learning loop is built but the *retrieve* half never reaches a packet, a prompt, or a human.
  - *Fix direction:* (1) Tier-1: `injectProven(project)` rows into packet compile at the "Ranked memory" section (packet.ts) — deterministic, advisory; (2) Tier-2: top vague-brief lessons into the reframe HITL prompt (algorithms.ts vague site); (3) vault edit + "Proposed knowledge — edit/dismiss/promote" in the HITL dock, human-accept the ONLY path to cross-project `savePattern` (95 P0-I; Devin Knowledge UX [DK ✓TODAY]).
  - *Maps:* G-39; 93 DF-17/DF-30; 95 G10/P0-H/P0-I; M-08 closure already partial (95 §1.1).

- **CG-10 (P2, D4/D7) — Context budget visibility + compaction story.**
  - *Competitor capability:* Codex "100% context left" header meter + `/compact` [C1][C3]; DSH deterministic compaction 0.8/0.16 with summarizer + tool-result pruner [D6]; Claude Code context-window explorer + `/compact` semantics docs (✓TODAY this pass, docs index).
  - *RapidTool today:* chat grounding capped at 2 500 chars (chat.server.ts:50) and **invisible** (93 DF-13); no meter, no compaction, no "what survived" report; research/grounding is byte-fixed by design (deterministic — the moat side of this).
  - *Gap:* cheap trust gap — users can't see the one budget that governs answer quality.
  - *Fix direction:* meter = `buildChatContext(project).length / 2500` chip in the ChatPane header (console.tsx chat area) + a compaction button that keeps the honesty envelope (95 G16/P1-F, S effort).
  - *Maps:* 93 DF-13; 95 G16; S4 (90 §3 row 8).

### D5 — Deployment / publishing (can a produced app be delivered?)

> **Dimension read:** Bolt/Lovable/v0 deliver hosted, authed, DB-backed apps; Devin/Copilot deliver PRs that merge; Aider delivers commits. RapidTool honestly says "it does not deploy" — the dossier's job is to make that a *decision with a deliverable*, not a void.

- **CG-11 (P1, D5) — Deliverable bundle + explicit deploy decision.**
  - *Competitor capability:* v0 "from idea to production in seconds" on Vercel (90 §1.7); Lovable handles hosting/SSL/auth/payments/analytics (90 §1.6); Bolt cloud infra + custom domains (90 §1.5); Devin "ships PRs the way your team does" (90 §1.4).
  - *RapidTool today:* console.tsx:990 "It does not deploy. It persists browser-local only."; downloads are packet.md / vault.md / project JSON; the P9 CI/IaC phase emits *templates* with a HITL gate that approves writing "templates that deploy nothing" (93 §4.10) — the deployment phase is ceremony over nonexistent deployment.
  - *Gap:* two-fold — (a) there is no *deliverable artifact* (a folder/zip a human or agent can actually run/import), and (b) the P9 gate asks humans to approve deployment templates as if they deployed.
  - *Fix direction:* (1) make the **assembled vertical slice** (CG-07) downloadable as a zip: files + package.json + the machine verify report + a generated DEPLOY.md (the narrow G-20 spec); (2) re-label P9's HITL gate + artifacts to state "templates only, nothing deploys" (spread P4's B-18 disclaimer pattern — 93 fix-spec #2); (3) record an explicit product decision on cloud deploy (options: stay pre-flight-and-bundle now; pilot single-target deploy — e.g. Vercel static — later). No new infra in this wave.
  - *Maps:* G-20; 90 §3 row 14; 93 DF-04 (P9) + fix-spec #2/#3.

### D6 — Agent workflow (plan → implement → verify → iterate loops; parallel tasks)

> **Dimension read:** every serious competitor inserted a **plan artifact humans approve before code runs** (Codex `/plan`, Cursor Plan Mode saved-as-files, Antigravity planning artifact + Request Review, Copilot implementation-plan artifact) and several added **parallelism with supervision** (Devin fleets, Claude Code parallel subagents, Windsurf/Devin Desktop board). RapidTool has the *primitives* (planning.ts planSteps/reflect/backtrack; bounded wild; advisory crew) but wires plan-approval into neither wild nor the run screen.

- **CG-12 (P1, D6) — Plan-first Wild Mode (approve the plan, then execute), reusing planning.ts.**
  - *Competitor capability:* Codex plan mode = read-only research + clarifying questions → plan the human approves *before* implementation [C1]; Cursor Plan Mode Shift+Tab, plans saved as files, "revert, refine, run again" recovery (✓TODAY 90 §1.3); Antigravity Planning Mode with Request Review default (90 §1.11); Copilot: research → implementation plan → changes on a branch (90 §1.14).
  - *RapidTool today:* `planning.ts` implements the G-24/25/26 plan-then-act ledger (planSteps → reflect → backtrack) but is **crew-only** (95 G8 verified: no `wild.plan` event, no `autoPlan`, no plan object on Project); wild executes then the classifier reviews (engine.ts:2373 wildStep, store.ts:956 cap-20); P1 topology/spec artifacts are template-fixed web-app shapes (93 DF-03/DF-07 — the "plan" a user sees is partly fiction).
  - *Gap:* the product's own autonomy mode runs before any plan is approved — the exact trust gap competitors closed in 2025-26.
  - *Fix direction:* wire `planning.ts`'s step shape into `wildStep`: emit a `wild.plan` event pre-execute (≤N steps, each `{id, action, why}`), park for human approval unless `autoPlan`, then execute the approved plan under the existing cap-20 driver; store the plan + its approval as ledger rows (append-only law unchanged). Ship with the template-label honesty from 93 fix-spec #4 (template-vs-real).
  - *Maps:* G-24 (plan-then-act), G-25 (reflexion), G-26 (backtrack); 90 §3 row 2/§10 P0-4; 95 G8/P0-G; 93 DF-03/07.

- **CG-13 (P2, D6) — Parallelism with supervision (bounded fan-out + a board view).**
  - *Competitor capability:* Devin "spin up a team of Devins", fleets across repos (90 §1.4); Claude Code subagents + workflows + "scaling across parallel sessions" (best-practices index ✓TODAY this pass); Windsurf/Devin Desktop board: Spaces/Kanban/multi-agent status ("Working… / PR is ready / Waiting for CI") (90 §1.13); Manus: a general autonomous executor web/desktop with browser-operator and artifact outputs (manus.im ✓TODAY this pass — note: detailed software-production docs NOT fetched this pass; treat as general-agent positioning only).
  - *RapidTool today:* sequential advisory crew (crew.server.ts:16, flat JSON_ROLES), one wild step at a time, no fan-out; the `wildRun` mirror (types.ts region) already streams run state but no board renders it.
  - *Gap:* none for the *governed* mission today — this is the axis RapidTool deliberately does not fight (90 §0). Listed so the roadmap says "deferred, with the governed shape defined."
  - *Fix direction (whenever staffed):* a **board of bounded, evidence-hashed runs** (the governed version of Devin Desktop's board — 90 §1.13 read), crew hierarchical task-list + budgets pattern (G-21), never unbounded autonomy. Rejected for this wave.
  - *Maps:* G-21/G-23; 90 §1.13 read; 95 P2-C.

- **CG-14 (P2, D6) — Governed MCP/ACP surface (RapidTool as a *tool other agents drive*).**
  - *Competitor capability:* market standardizing on ACP — OpenHands/Agent Canvas runs Claude Code/Codex/Gemini/any ACP agent (✓TODAY 90 §1.8); DSH `mcp__<server>__<tool>` naming + stdio/Streamable HTTP [D6]; Antigravity MCP Store (90 §1.11); Claude Code MCP + skills + hooks (90 §1.2).
  - *RapidTool today:* P3's MCP+A2A contracts are declarative artifacts (93 DF-04: "search.brave / repo.fs / sandbox.exec… none of it exists at runtime"); the real agent surface is the 27-verb headless CLI (95/90) — no MCP server wrapping it.
  - *Gap:* no way for an external agent (Claude Code, Codex) to drive a governed RapidTool run through MCP — a category first that stays unshipped.
  - *Fix direction:* wrap the existing headless verb surface as MCP tools (zero-dep if hand-rolled JSON-RPC over stdio; the MCP TS SDK is the G-40-specified vendor path), with every tool call passing through the gate/ledger path. P2, sequenced after CG-01/03/04.
  - *Maps:* G-40 (MCP server); 90 §1.8 strategic read + S7; 93 DF-04.

### D7 — Human handoff (HITL quality, approvals, chat)

> **Dimension read:** the field's HITL is *review-the-artifact* (diffs, plans, PRs, inline comments), steerable mid-flight, and streamed. RapidTool's HITL is *approve-the-title*, its chat is persisted-but-unstreamed, and approvals are irreversible. These are the "feels broken" parity rows (90 §3 rows 1, 3, 6).

- **CG-15 (P1, D7) — Streaming chat + Stop + steer.**
  - *Competitor capability:* Codex SSE token streaming + TUI steering (Tab queues, Enter injects mid-turn, Esc×2 forks) + context meter [C1-C3]; Claude Code Esc cancels the running tool; queued corrections delivered at the next action boundary (how-claude-code-works ✓TODAY this pass); Gemini stream-json NDJSON [G1]; Cursor Enter/Cmd+Enter/Tab (✓TODAY 90 §1.3).
  - *RapidTool today:* `stream: false` (deepseek.server.ts:233) — one-shot POST chat (chat.ts:17 region); no Stop button (ticker is decoration); chat **persistence landed** (chatLog types.ts:343; console.tsx:4395-4656) but nothing streams; wild pauses are honest but steer-less (bounded 20-step cap store.ts:956).
  - *Gap:* chat "looks like a copilot but is a one-shot oracle" (93 DF-12 restated) — persistence fixed, streaming/stop still open.
  - *Fix direction:* `streamDeepSeek` AsyncGenerator beside `completeDeepSeek`; NDJSON chat-stream route beside the one-shot POST; AbortController Stop in ChatPane (95 P0-E spec is exact and S/M-sized; ticker already at console.tsx:4439). Steering into *wild* (queue next instruction) is a larger follow-on.
  - *Maps:* G-19; 93 DF-12/DF-23; 95 G1/P0-E; 90 §3 row 1.

- **CG-16 (P1, D7) — HITL reviews evidence, not titles: diff cards + probe evidence + restore.**
  - *Competitor capability:* Antigravity Review-Changes pane: scroll every file diff, inline comments, VCS panel filtered to agent edits, auto commit messages [A3/A4]; Cursor Agent Review Quick/Deep after every commit (✓TODAY 90 §1.3); Claude Code verification subagent — "the agent doing the work isn't the one grading it" (✓TODAY 90 §1.2); Codex `/review` + `auto_review` reviewer subagent [C2][C4].
  - *RapidTool today:* HITL dock shows artifact titles + last-test caption (93 DF-11); approving over an unmet DoD needs no note (93 DF-09 — the null-note asymmetry that 87/88 reframe-bypasses exploited); no restore from a bad approval (CG-08); verify outcomes now render in the Oracle tab (console.tsx:4585-4633) but not inside the HITL dock's evidence list.
  - *Gap:* the human cannot see *what changed* or *what failed* at the moment of decision, and approval is forever.
  - *Fix direction:* (1) render per-probe evidence cards (id, criterion wording, FNV-1a hash, machine output tail) in the HITL dock (93 fix-spec #6/#9; data exists in dod.ts:301 runGate + VerifyOutcome); (2) module attempt diffs (from CG-02) in the dock; (3) ≥12-char note on approvals of forceHuman/gate-override decisions (engine approveHitl region + store + UI mirrors — 95 G3/P0-B); (4) restore-from-last-approved once CG-08 checkpoints land.
  - *Maps:* 93 DF-09/DF-11; 95 G3/G14/P0-B/P1-D; G-04 (diff); [A3] template.

- **CG-17 (P2, D7) — Fresh-model refutation seat on P6 (cheap, high-trust).**
  - *Competitor capability:* Claude Code verification subagent runs a fresh model to refute (90 §1.2); Codex `approvals_reviewer: auto_review` replaces the human reviewer with a subagent for eligible prompts [C2].
  - *RapidTool today:* crew seats are advisory and all-flash, same-tier as the coder (95 G17 verified); the machine harness is the only verifier of generated code — good — but there is no independent *model* read of "does this module satisfy the brief" beyond brief-fit vocabulary probes.
  - *Gap:* single-model single-context certification of the brief-fit class of failures.
  - *Fix direction:* one pro-tier (or fresh-context flash) reviewer call on P6 synthesis before HITL, its verdict rendered as advisory evidence (never a gate — the gate stays machine evidence per CG-03). S-M effort (95 P1-F).
  - *Maps:* 95 G17/P1-F; [CB]/[C2].

---

## §3 Master ranked register (priority order for the fix wave)

Legend: **P0** = blocks the "produce software" mission directly (code production can't converge / gates can't block). **P1** = product can't be seen, undone, steered, or remembered — feels broken vs every competitor. **P2** = strategic breadth, sequenced later. Effort S ≤½d · M ≤2d · L >2d (90 §3 scale). Impact 1–10.

| ID | Dim | Priority | One-line gap | Fix homes in (module anchors) | Maps to | Impact |
|---|---|---|---|---|---|---|
| CG-01 | D1 | **P0** | One envelope ⇒ multi-file assembled tree with per-file hashes + arch-cycle probe | codegen.server.ts:660 (decompose ≤8 fns/call — 121 queued (b)); types.ts:300 additive `generatedTree`; arch-tools `dependencyGraph` as p6-arch probe (dod.ts:199 pattern) | G-30/31/33; 121 | 10 |
| CG-03 | D2 | **P0** | Machine evidence closes gates; decide+date `enforceDod` default; "sealed" ⇒ passed only | store.ts:111/396/453; dod.ts:172 `p6-verified` consumes VerifyOutcome; console.tsx:978,2460-2462 region | G-10/11/13; 93 DF-08; 95 G4/P0-C/P1-A | 10 |
| CG-04 | D2 | **P0** | Runtime auto-repair: echo error list every iteration; binder-module fallback; critique persists | verify.server.ts:590 repair prompt; codegen.server.ts:189 `injectMissingExports`; verify.server.ts:458 `oracleSignatureFunctionNames` | 121 remaining; G-10/G-25; 95 G9 | 9 |
| CG-07 | D3/D5 | **P1** | Runnable vertical slice: scaffold + assembled tree converge; deliverable = folder + report | scaffold.ts:775 file-list pattern; codegen assembled tree (CG-01); io.ts export | G-20; 93 DF-01-03 | 8 |
| CG-11 | D5 | **P1** | Deploy: zip deliverable + DEPLOY.md; P9 gate re-labeled "templates only"; explicit product decision | engine.ts P9 region (B-18 disclaimer spread — 93 fix-spec #2); io.ts | G-20; 93 DF-04 | 6 |
| CG-12 | D6 | **P1** | Plan-first wild: `wild.plan` pre-execute from planning.ts, approve-or-autoPlan | planning.ts; engine.ts:2373 wildStep; store.ts:956 cap driver | G-24/25/26; 95 G8/P0-G | 9 |
| CG-08 | D4/D5/D6 | **P1** | Content-hashed checkpoints + ledgered restore; git export/commit verb when a repo exists | engine.ts:2436 wildLog; store.ts:761 partialize; scripts/rapidtool-cli.mjs verb list | G-26/G-40; 93 DF-10; 95 G7/P0-F | 8 |
| CG-06 | D3 | **P1** | Fixture-by-fixture verify transcript UI (verdicts already exist) | console.tsx:4585-4633; verify.server.ts VerifyOutcome | G-18 (deferred full); 93 DF-15/16 | 7 |
| CG-15 | D7 | **P1** | Streaming chat + Stop (persistence already done) | deepseek.server.ts:233; chat.ts:17; console.tsx:4439 ticker | G-19; 93 DF-12; 95 G1/P0-E | 8 |
| CG-16 | D7 | **P1** | HITL evidence cards (probe id/hash/output) + attempt diffs + note symmetry | dod.ts:301 runGate; console HITL dock; engine approveHitl; CG-02 diffs | 93 DF-09/11; 95 G3/G14 | 8 |
| CG-02 | D1 | **P1** | Versioned attempts + N-vs-N+1 diff, not regenerate-and-replace | engine.ts artifact-replace region (93 DF-11 addendum); packet/artifact tab | G-04; 93 DF-11/32 | 6 |
| CG-05 | D2 | **P1** | Lint findings feed repair prompts; decide blocking status | verify.server.ts:291,616; dod.ts additive p6-lint | 95 G12; G-29 | 6 |
| CG-09 | D4 | **P1** | `injectProven` into packet Ranked memory; reframe-brake; vault edit + promote HITL | packet.ts:292 region; knowledge.ts:370; vault UI | G-39; 93 DF-17; 95 G10/P0-H/I | 7 |
| CG-17 | D7 | **P2** | Fresh/pro-tier refutation read on P6, advisory evidence | crew.server.ts ROLE_SPECS; codegen P6 seam | 95 G17/P1-F; [CB]/[C2] | 6 |
| CG-10 | D4/D7 | **P2** | Context meter chip + compaction story | chat.server.ts:50; console ChatPane | 93 DF-13; 95 G16 | 5 |
| CG-13 | D6 | **P2** | Governed fan-out + board view (deferred, shape defined) | wildRun mirror; crew.server.ts | G-21/23; 90 §1.13 | 6 |
| CG-14 | D6 | **P2** | MCP/ACP server over the headless verbs, through the gate path | scripts/rapidtool-cli.mjs (27 verbs); G-40 MCP SDK | G-40; 90 S7 | 7 |

**Suggested execution order:** CG-01 → CG-03 → CG-04 (the P0 trio: makes code production converge *and* blocks on machine evidence) → CG-12 + CG-08 (safe autonomy: plan-first + undo) → CG-07 + CG-11 (the produced thing is real and hand-over-able) → CG-15 + CG-16 + CG-06 (parity/trust face) → CG-02/05/09/17 → CG-10/13/14. This preserves the 90/95 sequence law: parity-first cheap trust, then multipliers — with CG-03's enforceDod flip dated and ledgered (95 §13.5.4 discipline).

**Determinism-preserving notes for fixers:** every item above is additive to the keyless floor — `{ok:false, reason:"not-configured"}` paths untouched; no new runtime deps without a feasibility note (15's correction pattern); new dod probes stay pure + FNV-1a-deterministic (dod.ts:7); any default flip (CG-03) is a dated, ledgered decision, never silent.

---

## §4 What NOT to copy (the honest floor — 90 §0/§6 reaffirmed with today's evidence)

- **IDE depth / file-tree intelligence** (Cursor tab-complete, index; Claude Code code-intelligence) — RapidTool has no editor surface and should not build one (90 §1.15 / §6).
- **Cloud-scale fleets & async org infrastructure** (Devin, Factory) — CG-13 stays a governed board shape.
- **Frontier-model IQ** — DeepSeek text-only one-key constraint (14 §1.2); the answer is structure (decomposition CG-01, fresh-tier review CG-17), not model envy.
- **Visual design polish** (v0/Lovable shadcn-grade output) — 90 §1.7/1.6; the deterministic design-token floor stays the honest version (G-34/35/37 later).
- **Full app browser preview + cloud deploy** — G-18 full + Lovable/Bolt infra are P2-or-never; CG-06's transcript and CG-07/CG-11's bundle are the sized-for-this-codebase versions.
- **Manus-style general computer/browser autonomy** (manus.im ✓TODAY this pass — general executor, no governed gates) — the *governed, bounded, evidence-hashed* version of autonomy is wild mode + CG-12; unbounded computer-use contradicts the product's law.

---

## §5 Sources

**Fetched THIS pass (2026-09-07, ✓TODAY):**
- manus.im — Manus product surface: "What can I do for you? Create slides / Build website / Design / Create games", browser operator, API (open.manus.ai), desktop/mobile; general-agent positioning, no governed-gate claims. (Software-production details beyond the landing page NOT vendor-doc-verified this pass — flagged.)
- code.claude.com/docs/llms.txt — Claude Code doc index (166 pages; confirms CLAUDE.md, auto memory, skills, subagents, hooks, MCP, workflows, sessions/resume, context-window explorer, Chrome integration, computer use, remote control/mobile).
- code.claude.com/docs/en/how-claude-code-works.md — agentic loop = gather context / take action / verify results; built-in tool categories (file ops, search, execution incl. shell/tests/git, web, code intelligence); interrupt & steer (Esc cancels running tool; Enter queues correction delivered at next action boundary); subagents; "you can interrupt at any point".
- code.claude.com/docs/en/memory.md — CLAUDE.md scope hierarchy (managed/user/project/local + subdir rules + `@imports`); auto memory (per-repo, loaded every session, first 200 lines/25 KB, `/memory` browse/edit/delete); subagent persistent memory; compaction survival semantics.

**Inherited ✓TODAY same-day registers (2026-09-06, in-tree — do not re-fetch):** 90 §1.1-1.15 pages (github.com/openai/codex README; learn.chatgpt.com Codex docs [C1-C5]; code.claude.com overview+best-practices [CB]; cursor.com/docs/agent (overview, plan-mode, agent-review); devin.ai; bolt.new; lovable.dev; v0.dev; All-Hands-AI/OpenHands README; aider README + repomap docs; geminicli.com checkpointing [G4]; windsurf.com/cascade; docs.github.com cloud-agent); 93 §7 ([CP] Cursor plan-mode, [CB] Claude best-practices, [GK] Gemini checkpointing, [DK] Devin Knowledge, [CX] Codex CLI); 13 register (GitHub-API license/star verification for G-21…G-40, 2026-09-06). **Community-flagged (label in any downstream use):** Gemini CLI → Antigravity consolidation and AWS Kiro incident (codemyspec.com / heyuan110.com per 90 §1.15); Aider/Factory Droid/Jules/others per faros.ai "Best AI Coding Agents 2026" (90 §1.15).

**Internal anchors verified on disk 2026-09-07 (this pass):** codegen.server.ts:189 `injectMissingExports`, :487 `synthWithBackoff`, :660 `liveP6Synthesis`; engine.ts:2002-2026 (dynamic-import codegen wire), :2373 wildStep, :2436 wildLog; verify.server.ts:291 `lintFailures`, :366 `runCases`, :458 `oracleSignatureFunctionNames`, :512 `generateCases`, :590 `verifyAndFixServer`; dod.ts:145 `p6-test`, :159 `p6-artifact`, :172 `p6-verified`, :199 `p6-brief-fit`, :301 `runGate`; store.ts:111/396 (`enforceDod` opt-in, off by default), :453 `finishPhase`, :761 partialize, :956 wild cap-20, :1178 runModuleReal; sandbox.ts:135 `buildPhase6Module`; exec.ts:44-55 bounded runner; knowledge.ts:250 `savePattern`, :293 `findPatterns`, :370 `injectProven`; chat.server.ts:50 2500-char budget; deepseek.server.ts:233 `stream:false`; types.ts:300 `generatedSource`, :343 `chatLog`; scaffold.ts:775-784 file list; crew.server.ts:16 advisory contract; console.tsx:978 (advisory-gates guide text), :990 (deploy/persist honesty text), :1895-1902 Run-module, :4395-4656 chatLog persistence, :4439 liveness ticker, :4585-4633 Oracle verify block; AGENT_GUIDE.md:5 "does not build software itself". Tree context consumed: 90 §0-§3, 93 (DF ledger), 95 §1 (post-wave open register), 13 (G-register), 121 (P6 ship state), README.

---

## Files created / modified

- **Created:** `fixes/123_competitor_gaps.md` (this file). No source files read-modified; no tests executed (doc-only analyst deliverable per house convention).
