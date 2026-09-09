# 146 — RESEARCHER-W (WEB): agentic software factory — state of the art 2026

(Transcribed by the parent from the researcher's capped summary; every URL below was
actually FETCHED and read by the researcher — arXiv entries fetched Sept 2026. Native
web_search/web_extract were Firecrawl-gated; fallback = primary fetches + GitHub/arXiv APIs.)

## 1. Agentic engineering / self-improving coders
- Codex agent loop (shell/update_plan/MCP, sandbox permission prompts, AGENTS.md ≤32 KiB):
  https://openai.com/index/unrolling-the-codex-agent-loop/
- Codex-as-platform: retained reasoning + compaction lifted ARC-AGI-3 13.3%→38.3% at 6× fewer
  output tokens: https://developers.openai.com/blog/codex-as-a-platform
- **Repair-loop cookbook — separate "judgment from proof"**: review (no edits) → repair (only
  edits) → validation (executes, produces a delta); stop = pass / max attempts / delta flat /
  human gate: https://developers.openai.com/cookbook/examples/codex/build_iterative_repair_loops_with_codex
- SWE-bench Verified (500 human-filtered): https://www.swebench.com/verified.html (2026 top ≈80–95%)
- Devin 13.86% unassisted end-to-end on SWE-bench: https://cognition.ai/blog/introducing-devin
- Anthropic: simplest composable workflows beat frameworks:
  https://www.anthropic.com/research/building-effective-agents · context engineering for agents:
  https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- SWE-agent ACI design: https://arxiv.org/abs/2405.15793 · OpenHands platform (event stream,
  sandbox, agent/tool/context separation): https://arxiv.org/abs/2407.16741
- MetaGPT (SOP assembly line; Code = SOP(Team)): https://arxiv.org/abs/2308.00352 + github.com/FoundationAgents/MetaGPT
- ChatDev chat chain + communicative dehallucination (co-design/code/test): https://arxiv.org/abs/2307.07924

## 2. Autonomous factory repos (produce-and-verify gates + failure modes)
- **Vercel-labs eve Foreman factory**: classifier→analyst→implementer→reviewer stations in
  separate sandboxes; **reviewer sees only the diff branch, never implementer reasoning**; red
  CI auto-fix on a factory-owned branch only; factory brain = run-to-run memory; humans keep
  judgment calls: https://github.com/vercel-labs/eve-software-factory-template · https://ask-foreman.dev/docs/pipeline
- **disler/super-simple-software-factory (816★)**: "code owns sequencing, retries, acceptance;
  agents are bounded nodes inside phases, not the loop"; typed JSON envelopes are the only seam
  context; gates verify claims after the fact against the envelope (artifacts_exist,
  diff_matches_claims, tests_pass); failure = re-prompt same session, not cold restart;
  deterministic phases for known work; phase default fail, run.finish(accepted=…) so
  phase-pass ≠ run-acceptance; SQLite trace: https://github.com/disler/super-simple-software-factory
- OpenHands → Agent Canvas (a control plane, not a code factory): https://github.com/All-Hands-AI/OpenHands
- **Failure modes**: SWE-bench-Live shows a massive gap vs static SWE-bench (contamination
  freedom): https://arxiv.org/abs/2505.23419 · test-overfitting when code+tests jointly refined:
  https://arxiv.org/abs/2511.16858v3 · USEbench (1,271 repo-level tasks — multi-capability
  skills beyond one-shot codegen): https://arxiv.org/abs/2506.14683

## 3. Hyperagents / meta-agents
- Anthropic multi-agent research: subagents = per-context compression; lead delegates + merges;
  #subagents + tool parallelism + token budget explains ~95% of task variance:
  https://www.anthropic.com/engineering/built-multi-agent-research-system
- Claude Code subagents / Task tools / agent teams: https://code.claude.com/docs/en/sub-agents · https://code.claude.com/docs/en/agent-teams
- DGM-Hyperagents (2026; self-referential task-agent + meta-agent, "editable meta-modification"):
  https://arxiv.org/abs/2603.19461
- **Cautionary**: "Inefficiencies of meta agents" — naive context-stacking of prior designs
  UNDERPERFORMS ignoring them; low behavioral diversity; economics rarely favor deep auto-design:
  https://arxiv.org/abs/2510.06711
- AutoGen: https://arxiv.org/abs/2308.08155 (frameworks, not factories)

## 4. Production start→finish (generated vs human-decided)
- Claude Code: /init CLAUDE.md baseline; hooks = "deterministic, guarantee action" vs advisory;
  plan-review; adversarial-review step; checkpointing/rewind: https://code.claude.com/docs/en/overview ·
  https://www.anthropic.com/engineering/claude-code-best-practices
- **Where human gates sit in the field**: (1) plan/architecture, (2) risky shell/network,
  (3) merge/CI (PR-style), (4) memory writes (propose vs accept). RapidTool's HITL parking at
  P4/P5/P8/P9 matches — do not weaken.
- Small-brief full chain (Codex repair cookbook + Foreman): brief-issue intake → classify →
  plan with acceptance → implement in own sandbox → repo's own checks → independent reviewer on
  the diff → draft PR → only human merges.

## 5. Evals + memory (honest: evidence is thin)
- SWE-bench-Live (1,319 fresh issues, 93 repos, Docker/task): https://arxiv.org/abs/2505.23419 ·
  Terminal-Bench 2.0 (89 tasks, human tests, frontier <65%): https://arxiv.org/abs/2601.11868
- aider repo map (tree-sitter symbol-level) — closest to RapidTool's arch-tools dependencyGraph:
  https://aider.chat/docs/repomap.html
- **Memory**: SWE-Bench-CL — memory methods gain mostly on LONG tasks/episodes, not short ones:
  https://arxiv.org/abs/2507.00014v1 · subtask-level memory (+4.7pp mean pass@1):
  https://arxiv.org/abs/2602.21611 · Metis: text memory cheap/transferable, code-executable
  memory cheaper at runtime but costly to forge; crystallize recurring plans into callable tools:
  https://arxiv.org/abs/2606.24151 · user-as-code executable memory: https://arxiv.org/abs/2606.16707
  HONEST READ: no mainstream study cleanly isolates per-seam codegen memory in short runs —
  gains are task-length-dependent + representation-structured. Supports RapidTool's longitudinal
  corpus + falsification kill criterion (rip out if no gain by run 6).

## 6. Synthesis — top patterns RapidTool should adopt next
1. **Code-owns-the-loop + typed envelope handoffs** (super-simple-software-factory): the
   strongest external corroboration that RapidTool's governed 13-phase engine + evidence ledger
   + envelope seams already match the emerging industry shape. (No change — validation.)
2. **Separate judgment from proof** (OpenAI cookbook): a fresh-context, non-editing reviewer
   producing structured findings for a repair step, then execution validation. RapidTool's
   CG-17 fresh-tier design already points here; the repair-channel treeFailure context (M3-2)
   is the implementation start.
3. **Run-the-tree first as the only honest test**: the 144 M2→M3→M4→M6 ordering exactly matches
   the field's convention. (No change — validation.)
4. **Start small on memory**: per-seam tier-2 injection mirrors CLAUDE.md-style auto-memory;
   expect measurable gains only on harder/longer traces via the longitudinal corpus (M6).
5. **Watch the three production failure modes**: context rot (keep per-turn context framed
   small); joint code/test overfitting (repair must edit CORE code only, never the
   brief-grounded oracle tests); naive context-stacking of prior meta-agent designs (each fix
   wave = a mutation with small evals, not verbatim feeding of all prior outputs).
6. **Human gates**: plan-stage approval; diff review before merge; only branch owner merges;
   memory writes only the store — humans promote cross-project lessons (the lesson accept verb's
   human gate). RapidTool HITL structure matches — keep.

## 7. Roadmap addendums (doc-drift flags, no code change)
- fixes/134 §2/§3 still says enforceDod "default OFF" in spots — the engine's keyed default is
  ON (decided + landed); update the 134 text.
- M6 corpus: adopt SWE-bench-Live's contamination discipline — fixtures fixed but re-validated,
  or track live recency, to avoid static-benchmark overfitting.
