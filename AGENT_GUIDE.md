# RapidTool — Agent Guide

How an AI coding agent (Claude Code, Codex, Aider, CrewAI, or a human operator running one)
should consume and honor a RapidTool project. RapidTool is a **deterministic, governed
pre-flight compiler**: it does not build software itself. It turns a client brief into a
paste-ready *Agent Packet* plus a phase-by-phase audit trail, so that a real agent does the
building under enforced, auditable constraints.

> Honesty contract (read this first): RapidTool never fabricates research, code, or sandbox
> results. Items marked `source:"illustrative"` (competitor rows, research snippets) are
> **scaffolding, not facts** — verify them before treating them as real. The `Execution`
> line in a packet describes the *engine-template runner*, not an OS sandbox. DoD gates are
> **advisory when keyless** — they record exit criteria; they never block the deterministic
> floor. When a `DEEPSEEK_API_KEY` is configured they are **enforced by default**: a failing
> gate parks the run as a hard DoD block. `create --advisory` (CLI) or a project's
> `enforceDod: false` relaxes enforcement.

---

## 1. What a RapidTool project gives you

A project (13 phases, P0–P12) with a governed edge. For each project you can get:

| Artifact | Where | Use |
|---|---|---|
| **Agent Packet v3** (`# RapidTool Agent Packet v3 — <name>`) | "Agent packet" tab / "Copy agent packet" / "Download packet (.md)" | The single source of truth to paste into your coding-agent session. |
| **Machine-readable system block** | inside the packet, `## System JSON` fenced block | Parse `packet_version`, `project_id`, per-phase status/rejections/gate verdicts, scorecard verdict. |
| **Per-phase handoff prompts** | "Copy phase handoff" button | A focused brief for *one* phase — role, mission, prior artifacts, deliverable, DoD checklist, constraints. |
| **Project JSON** | "Export" button (downloads `.json`) | Full snapshot (phases, artifacts, memory, decisions, logs) for handoff between machines or to a downstream tool. |
| **Decision ledger** | "GATE LOG" rail + packet `## Decision ledger (HITL)` | Every gate decision with actor (`human`/`autopilot`) and ISO timestamps. |
| **DoD gate records** | artifact kind `gate`, `gate.verdict` diagnostics | Machine-checkable exit criteria per phase + FNV-1a evidence hash. |

## 2. How to use a RapidTool project as the building agent

**The short version:**

1. Open the project, run `Execute` / `Run to next gate` until it stops at a HITL gate.
2. When stopped, the operator (a human) approves/rejects with 12+ characters of feedback.
   Rejections steer regeneration — never the same output twice.
3. When the packet describes your target phase, copy it (or download the `.md`) and paste it
   into your coding-agent session as the spec.
4. Build, then report back (see §4). Import the resulting report JSON if the app offers it.

**Phase-by-phase (as the agent, consume these in order):**

- **P0–P3 (research → architecture → memory → tools)** are deterministic scaffolds. The
  scorecard verdict (`proceed` / `proceed-with-guards` / `reframe`) and the spec-graph/contract/
  oracle artifacts are your **starting blueprint**, not ground truth.
- **P4/P5 (security & validation) — HITL.** Honor the decision ledger: if a gate was
  `reject`-ed, the operator's note is a constraint you must satisfy; the `rejectionHistory`
  on the phase record is append-only and non-negotiable.
- **P6 (codegen)** is a bounded *template self-test*: it proves the module builder produces a
  denylist-clean module. If it fails and the gate demands a human override, that's intentional —
  a human must tick "I reviewed the failure" before Approve. The **real** code is yours to write.
- **P7–P12** are scaffolding for domain research, UX, CI/CD, edge, realtime, docs.

## 3. Contract vs. content discipline

- **Treat DoD criteria as your exit criteria.** A phase is done when its DoD gate passes
  (`gate.verdict PASS`), not merely when the packet says so.
- **Honor the decision ledger + rejection notes verbatim.** They are steering, not suggestions.
- **Never present `illustrative` content as researched fact** in the software you build. If a
  competitor or library row is marked illustrative, verify it before you depend on it.
- **The packet's `Current edge` is the phase to build next.** After every approved/rejected
  decision the packet is re-compiled to the new edge — re-read it before each phase.

## 4. How to feed results back (the honest loop)

RapidTool has no live LLM/research/sandbox feedback channel (client-side, localStorage-only).
To close the loop today:

1. **Per phase:** paste `Copy phase handoff` into the agent; paste the agent's output back into
   the phase's Notes / operator notes so it flows into the next packet compile.
2. **Whole project:** export the project JSON (`Export`) — it round-trips through `Import`
   with shape validation + repair, so a build can move between machines or be archived.
3. **Cross-tool:** the packet `.md` is the interchange format; the JSON sidecar is the durable
   state. Keep both for a full handoff.

## 5. What RapidTool is *not* (don't ask it to)

- It calls a **real LLM only when configured** — with `DEEPSEEK_API_KEY` set (server-side, in `.env`), research phases (P0/P7/P11) emit a live "Phase narrative (LLM)" artifact and P6 can run the generated module through a bounded local runner. With no key, every phase is the deterministic scaffold. It never fabricates model output.
- It does **live web research only when `TAVILY_API_KEY` is set** — otherwise research stays honestly "illustrative" (DeepSeek's API has no built-in search).
- The code runner is a **bounded local runner, not a security sandbox** — hard timeout, no-network env, temp dir, output caps. It does not provide OS isolation.
- It does **not** persist server-side (browser `localStorage` only). Export to back up.
- It does **not** have working P2P/multiplayer (staged; no live coturn).
- Evidence hashes are FNV-1a (integrity, not cryptographic security).

## 6. When RapidTool is genuinely useful (and when it isn't)

**Net-positive** when: you want a governed, auditable pre-flight for an agentic build —
structured brief → deterministic spec/scaffold → paste-ready prompt contract → HITL decision
ledger → DoD exit criteria — *and* you understand the research/scaffolds are illustrative.

**Skip it** when: you need raw execution speed (use the coding agent directly), live research
(use a research tool), or when the 13-phase ceremony is heavier than the project warrants.
