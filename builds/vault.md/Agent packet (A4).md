---
title: "Agent packet (A4)"
kind: artifact
tags: [artifact, packet]
phase: 12
updatedAt: 1788698726406
---

# RapidTool Agent Packet v3 — Fixture

## System
packet_version: 3
compiled_at: 2026-09-06T12:45:26.493Z
project_id: dd4e112a-14fb-4e13-a489-d5b167e276a6
You are a governed implementation agent for RapidTool. You do not skip phases.
You may only work the current phase (P12 Documentation & Technical Specs) unless the human approved an earlier HITL gate.
Illegal graph jumps, unsigned deploys, and tool calls outside user scope are forbidden.
If a test fails, capture the traceback and patch under schema lock. Do not invent APIs.

## System JSON (machine-readable)
```json
{
  "schema_version": 1,
  "packet_version": 3,
  "compiled_at": "2026-09-06T12:45:26.493Z",
  "project_id": "dd4e112a-14fb-4e13-a489-d5b167e276a6",
  "name": "Fixture",
  "project_status": "complete",
  "current_phase": {
    "id": 12,
    "code": "P12",
    "title": "Documentation & Technical Specs",
    "hitl_gate": false
  },
  "model_route": "deterministic",
  "capabilities": {
    "ingest": true,
    "verify": "config-gated",
    "vault_search": true
  },
  "report_schema": {
    "phase": "integer 0..12",
    "status": "\"complete\" | \"blocked\" | \"partial\"",
    "summary": "string (non-empty)",
    "files": "string[] (optional)",
    "tests_run": "{command: string, pass: boolean, evidence?: string}[] (optional)",
    "artifacts": "{title: string, body: string, language?: string}[] (optional)"
  },
  "research_hash": "2166136261",
  "sandbox": {
    "claim": "Engine-template runner (bounded, engine-authored code only)",
    "ram_mb": null,
    "timeout_s": 30,
    "isolated": true
  },
  "verdict": "proceed-with-guards",
  "rejection_loop": null,
  "decisions": [
    {
      "phase": 4,
      "decision": "approve",
      "decided_by": "human",
      "note": null,
      "requested_at": 1788698726464,
      "decided_at": 1788698726466
    },
    {
      "phase": 5,
      "decision": "approve",
      "decided_by": "human",
      "note": null,
      "requested_at": 1788698726469,
      "decided_at": 1788698726470
    },
    {
      "phase": 8,
      "decision": "approve",
      "decided_by": "human",
      "note": null,
      "requested_at": 1788698726479,
      "decided_at": 1788698726481
    },
    {
      "phase": 9,
      "decision": "approve",
      "decided_by": "human",
      "note": null,
      "requested_at": 1788698726483,
      "decided_at": 1788698726483
    }
  ],
  "phases": [
    {
      "id": 0,
      "status": "complete",
      "rejections": 0,
      "gate_passed": null
    },
    {
      "id": 1,
      "status": "complete",
      "rejections": 0,
      "gate_passed": null
    },
    {
      "id": 2,
      "status": "complete",
      "rejections": 0,
      "gate_passed": null
    },
    {
      "id": 3,
      "status": "complete",
      "rejections": 0,
      "gate_passed": null
    },
    {
      "id": 4,
      "status": "complete",
      "rejections": 0,
      "gate_passed": true
    },
    {
      "id": 5,
      "status": "complete",
      "rejections": 0,
      "gate_passed": true
    },
    {
      "id": 6,
      "status": "complete",
      "rejections": 0,
      "gate_passed": null
    },
    {
      "id": 7,
      "status": "complete",
      "rejections": 0,
      "gate_passed": null
    },
    {
      "id": 8,
      "status": "complete",
      "rejections": 0,
      "gate_passed": true
    },
    {
      "id": 9,
      "status": "complete",
      "rejections": 0,
      "gate_passed": true
    },
    {
      "id": 10,
      "status": "complete",
      "rejections": 0,
      "gate_passed": null
    },
    {
      "id": 11,
      "status": "complete",
      "rejections": 0,
      "gate_passed": null
    },
    {
      "id": 12,
      "status": "complete",
      "rejections": 0,
      "gate_passed": null
    }
  ]
}
```

## Mission
Build a field-service dispatch board for HVAC: jobs, techs, parts, same-day reroutes. Offline warehouse scan.

## Intent lattice (A1)
Domain: logistics
Jobs: dispatch, reroute, scan
Entities: tech, job, jobs, parts
Constraints: same-day, offline
Complexity: 9.1 / 10

## Scheduler (A3)
Tightness 7.3 · security Δ0 · api Δ1
- Standard isolate policy.
- Default API budget.
- Stock HITL set (P4, P5, P8, P9).
Extra HITL: none

## Crew (A8)
- architect (1800 tok): Lock schema and routes for dispatch, reroute, scan before code. → Pass Spec Graph order + contracts to implementer. Do not write feature code.
- implementer (3200 tok): Write files in Spec Graph order. Current edge: Documentation & Technical Specs. → Stop when oracle tests fail twice; hand traceback to reviewer.
- reviewer [ACTIVE] (1400 tok): Diff against contracts. Reject invented endpoints and leaked PHI/PII. → Approve only if A6 endpoints and A7 oracle are green.
- tester (900 tok): Run oracle + one adversarial case per constraint. → Constraints in scope: same-day, offline.

## Spec graph order (A5)
- [architect] src/domain/logistics.ts — Typed entities from the lattice
- [architect] src/api/routes.ts — HTTP contracts bound to jobs
- [implementer] src/state/store.ts — Checkpointed client/server state
- [implementer] src/jobs/dispatch.ts — Implement job “dispatch” against the contract
- [implementer] src/jobs/reroute.ts — Implement job “reroute” against the contract
- [implementer] src/jobs/scan.ts — Implement job “scan” against the contract
- [implementer] src/ui/console.tsx — Operator surfaces bound to store fields
- [tester] tests/oracle.spec.ts — Acceptance tests from the oracle

## Contracts (A6)
- Tech: id:ulid, status:enum, updatedAt:datetime
- Job: id:ulid, assigneeId:ulid, slaDue:datetime, status:enum
- Jobs: id:ulid, assigneeId:ulid, slaDue:datetime, status:enum
- Parts: id:ulid, status:enum, updatedAt:datetime
- Dispatch: id:ulid, status:enum, updatedAt:datetime
- Reroute: id:ulid, status:enum, updatedAt:datetime
- POST /v1/dispatch (dispatch)
- POST /v1/reroute (reroute)
- POST /v1/scan (scan)

## Oracle (A7)
- job.dispatch.happy: Authorized operator submits “dispatch” with a valid tech ⇒ 200 + persisted entity + checkpoint written
- job.reroute.happy: Authorized operator submits “reroute” with a valid tech ⇒ 200 + persisted entity + checkpoint written
- job.scan.happy: Authorized operator submits “scan” with a valid tech ⇒ 200 + persisted entity + checkpoint written
- constraint.same-day: Request violates same-day ⇒ 403 or 422; no side effect; diagnostic JSON
- constraint.offline: Request violates offline ⇒ 403 or 422; no side effect; diagnostic JSON
- graph.no-skip: Agent requests P9 while P4 is open ⇒ Illegal transition; no deploy artifacts

## Current edge
P12 — Documentation & Technical Specs
Architecture Decision Records from P1/P7, OpenAPI + database schemas, frontend/backend parity.
Status: complete · model: deterministic
Execution: Engine-template runner (bounded, engine-authored code only)
No pending HITL.

P6 template self-test (last run): pass — tests.pass
Verdict: proceed-with-guards
## Decision ledger (HITL)
- P4 · approve · human · 2026-09-06T12:45:26.466Z
- P5 · approve · human · 2026-09-06T12:45:26.470Z
- P8 · approve · human · 2026-09-06T12:45:26.481Z
- P9 · approve · human · 2026-09-06T12:45:26.483Z

## Ranked memory (A2 FusionRank)
1. [semantic 0.368] Domain logistics; jobs dispatch, reroute, scan.
2. [procedural 0.283] HITL reject requires a written reason.
3. [procedural 0.262] State transition validation wraps every transfer_to_agent.
4. [semantic 0.260] Generators ship UI fast; RapidTool ships a governed lifecycle.
5. [procedural 0.260] Generated code executes air-gapped inside the isolate.

## Scorecard
(deterministic feasibility estimate — template-derived, not live research)
Overall 6.8/10 (proceed-with-guards)
- Technical feasibility: 3/10 — Typed contracts + sequential graph.
- Scale headroom: 9/10 — Stateless workers + durable checkpoints.
- Security posture: 7/10 — Scheduler Δ0.
- API / rate-limit risk: 7/10 — Live-tool Δ1.
- Delivery confidence: 8/10 — Phased graph prevents skipped work.
Bottlenecks: Long-running tools must stream over WebSocket MCP.; HITL rejection without a qualitative note is illegal.; Constraint: same-day; Constraint: offline
Attack vectors: Prompt injection via ingested competitor pages.; Tool-call privilege escalation if OAuth scopes are inherited.; Sandbox escape if generated exec has network.

## Artifacts (trimmed)
### P7 · Competitive analysis matrix
# Market position — Fixture

> Illustrative competitor templates (source: illustrative — NOT live research). Verify before citing.

## ServiceTitan (Field-service suite)
Source: illustrative template
Strength: Dispatch + invoicing at scale
Gap RapidTool exploits: Heavy, not agent-governed, weak offline isolate
## Housecall Pro (SMB field ops)
Source: illustrative template
Strength: Simple job board
Gap RapidTool exploits: No typed job lattice or sandbox regen
## Cursor (IDE-attached agent)
Source: illustrative template
Strength: Repo-aware multi-file edits
Gap RapidTool exploits: No agency lifecycle or HITL graph
## v0 / Bolt / Lovable (Prompt-to-app)
Source: illustrative template
Strength: Fast UI scaffolds
Gap RapidTool exploits: Skips isolation policy and ADR trail

Architectural advantage: deterministic 0–12 graph with HITL, MCP/A2A, and ADRs — generators skip this; IDEs leave it to …

### P8 · Interface contract
Framework: React + Tailwind (component agents)
State: client store hydrated from phase checkpoints
Sync rule: every control binds a named store field — no orphan local state
Preview: live canvas for HITL layout approval
Surfaces: intake, phase rail, scorecard, artifact inspector, approval dock

### P9 · GitHub Actions workflow
name: rapidtool-gate
on: [pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
      - run: npm ci
      - run: npm run typecheck
      - run: npm test

### P9 · IaC sketch
# GCP + Firebase hosting
hosting: firebase preview channels
workers: cloud run, scale-to-zero
gpu: provision only for local-edge promotion jobs

### P10 · Tiered inference
Primary: grok-4.5 (architecture, security, HITL summaries)
Edge: Ollama open-weight models (draft, format, long-context tidy)
Failover: secondary OpenAI-compatible route, session intact
Sync: edge patches land in the same checkpoint store before P9 promote

### P11 · Live search MCP binding
{
  "provider": "brave.search",
  "queries": [
    "logistics architecture patterns 2026",
    "Fixture competitor api limits"
  ],
  "bind_policy": "root LlmAgent may attach new APIs mid-run",
  "restart_required": false
}

### P12 · Architecture Decision Records
# ADR-001 Graph before code

Status: accepted
Decision: Phases 0–12 execute in order with schema-validated transitions.

# ADR-002 HITL requires a reason

Status: accepted
Decision: Rejection is illegal without ≥12 characters of qualitative feedback.

# ADR-003 Domain isolate for logistics

Status: accepted
Decision: tightness=7.3; extra HITL=none.

### P12 · OpenAPI 3.1
openapi: 3.1.0
info:
  title: Fixture API
  version: "1.0.0"
paths:
  /v1/dispatch:
    post:
      summary: dispatch
      responses:
        "200":
          description: ok
  /v1/reroute:
    post:
      summary: reroute
      responses:
        "200":
          description: ok
  /v1/scan:
    post:
      summary: scan
      responses:
        "200":
          description: ok

## ADRs
# ADR-001 Graph before code

Status: accepted
Decision: Phases 0–12 execute in order with schema-validated transitions.

# ADR-002 HITL requires a reason

Status: accepted
Decision: Rejection is illegal without ≥12 characters of qualitative feedback.

# ADR-003 Domain isolate for logistics

Status: accepted
Decision: tightness=7.3; extra HITL=none.
## OpenAPI
openapi: 3.1.0
info:
  title: Fixture API
  version: "1.0.0"
paths:
  /v1/dispatch:
    post:
      summary: dispatch
      responses:
        "200":
          description: ok
  /v1/reroute:
    post:
      summary: reroute
      responses:
        "200":
          description: ok
  /v1/scan:
    post:
      summary: scan
      responses:
        "200":
          description: ok

## Required output schema
Return your work as ONE JSON report matching report_schema (see ## System JSON above) — the ingest seam validates this exact shape.
The five markdown headings (Phase work / Files / Patch / Tests / Risks) remain the recommended structure of your artifacts' bodies for human review.
Next legal edge: none — pipeline complete.

Do not emit secrets. Do not widen OAuth scopes. Do not deploy without HITL on P9.
