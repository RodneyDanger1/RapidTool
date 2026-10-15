# RapidTool Agent Packet v3 — # Officestock — Office

## System
packet_version: 3
compiled_at: 2026-10-05T02:34:59.904Z
project_id: 0919641f-77b1-4f19-b54a-e2a6e3763b17
You are a governed implementation agent for RapidTool. You do not skip phases.
You may only work the current phase (P6 Code Generation, Testing & Deployment) unless the human approved an earlier HITL gate.
Illegal graph jumps, unsigned deploys, and tool calls outside user scope are forbidden.
If a test fails, capture the traceback and patch under schema lock. Do not invent APIs.

## System JSON (machine-readable)
```json
{
  "schema_version": 1,
  "packet_version": 3,
  "compiled_at": "2026-10-05T02:34:59.904Z",
  "project_id": "0919641f-77b1-4f19-b54a-e2a6e3763b17",
  "name": "# Officestock — Office",
  "project_status": "running",
  "current_phase": {
    "id": 6,
    "code": "P6",
    "title": "Code Generation, Testing & Deployment",
    "hitl_gate": false
  },
  "model_route": "deepseek-flash",
  "capabilities": {
    "ingest": true,
    "verify": "config-gated",
    "vault_search": true
  },
  "report_schema": {
    "phase": "integer 0..12 (must equal current_phase.id)",
    "status": "\"complete\" | \"blocked\" | \"partial\"",
    "summary": "string (non-empty)",
    "files": "string[] (optional)",
    "tests_run": "{command: string, pass: boolean, evidence?: string}[] (optional)",
    "artifacts": "{title: string, body: string, language?: string}[] (optional; max 12, each body ≤ 50000 chars)"
  },
  "research_hash": "1246649488",
  "input_hash": "1675610702",
  "sandbox": {
    "claim": "Engine-template runner (bounded, engine-authored code only)",
    "ram_mb": null,
    "timeout_s": 30,
    "isolated": false
  },
  "verdict": "proceed-with-guards",
  "acceptance": null,
  "rejection_loop": null,
  "decisions": [
    {
      "phase": 4,
      "decision": "approve",
      "decided_by": "autopilot",
      "decided_via": {
        "action": "hitl.approve",
        "resource": "gate:P4",
        "reason": "autopilot-seat — hitl.approve on gate:P4 under the harness's own seat.",
        "label": "autopilot/harness",
        "tokenPath": false
      },
      "note": "[seat harness] autopilot seat — no human decision claimed",
      "requested_at": 1791167582193,
      "decided_at": 1791167582209
    },
    {
      "phase": 5,
      "decision": "approve",
      "decided_by": "autopilot",
      "decided_via": {
        "action": "hitl.approve",
        "resource": "gate:P5",
        "reason": "autopilot-seat — hitl.approve on gate:P5 under the harness's own seat.",
        "label": "autopilot/harness",
        "tokenPath": false
      },
      "note": "[seat harness] autopilot seat — no human decision claimed",
      "requested_at": 1791167582224,
      "decided_at": 1791167582234
    }
  ],
  "phases": [
    {
      "id": 0,
      "status": "complete",
      "rejections": 0,
      "gate_passed": true
    },
    {
      "id": 1,
      "status": "complete",
      "rejections": 0,
      "gate_passed": true
    },
    {
      "id": 2,
      "status": "complete",
      "rejections": 0,
      "gate_passed": true
    },
    {
      "id": 3,
      "status": "complete",
      "rejections": 0,
      "gate_passed": true
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
      "gate_passed": false
    },
    {
      "id": 7,
      "status": "locked",
      "rejections": 0,
      "gate_passed": null
    },
    {
      "id": 8,
      "status": "locked",
      "rejections": 0,
      "gate_passed": null
    },
    {
      "id": 9,
      "status": "locked",
      "rejections": 0,
      "gate_passed": null
    },
    {
      "id": 10,
      "status": "locked",
      "rejections": 0,
      "gate_passed": null
    },
    {
      "id": 11,
      "status": "locked",
      "rejections": 0,
      "gate_passed": null
    },
    {
      "id": 12,
      "status": "locked",
      "rejections": 0,
      "gate_passed": null
    }
  ],
  "phase_coverage": {
    "executed": 7,
    "total": 13,
    "artifacts_from_p7_p12": 0,
    "empty_phases": []
  },
  "spend": null,
  "budget": {
    "spent": 50905,
    "cap": null,
    "stop_reason": null,
    "scope": "process-session snapshot captured at packet build; never the run total — sum the per-leg run envelopes' budget.spent for run spend"
  }
}
```

## Mission
# Officestock — Office Supplies Inventory Tracker

## What this is
An internal tool to track office supplies (stationery, printer consumables,
kitchen and cleaning items) so nothing runs out unannounced. Staff record what
they take; the office manager receives deliveries and runs stocktakes.

## Users
- **Staff** — take an item from the cupboard.
- **Office manager** — receive deliveries, adjust counts, run stocktakes.
- **Approver** — approve purchase requests raised below reorder level.

## Core domain
- **Item**: id, name, category (Stationery | Printer | Kitchen | Cleaning |
  Tech), unit (each / box / ream / pack), current qty, reorder level, target
  qty (to top up to), location, active.
- **Movement**: id, item, delta (+/-), reason (Issued | Received | Damaged |
  Adjustment | Stocktake), actor, timestamp, note, resulting qty.
- **PurchaseRequest**: id, item, requested qty, status (Open | Approved |
  Ordered | Received | Cancelled), raised-by, decision note.

## Required features
1. **Item list** — searchable, filterable by category and by a "needs reorder"
   toggle; each row shows qty, reorder level, a colour-coded status, and
   location. Sort by name, qty, or category.
2. **Issue an item** — pick item, quantity, actor; refuse if quantity exceeds
   current stock; write an Issued movement and decrement qty.
3. **Receive stock** — increase qty and write a Received movement; if an Open/
   Approved/Ordered purchase request exists for that item, mark it Received.
4. **Adjust / damage** — record a Damaged or Adjustment movement; an adjustment
   requires a note and can set the qty to a counted value (the delta is
   computed), never silently.
5. **Purchase requests** — raise a request for a below-reorder item with a
   suggested quantity of (target − current); approve, order, receive, cancel
   with constrained transitions; receiving a request writes a Received movement.
6. **Stocktake** — enter a counted qty per item in a category; for each item the
   app writes a Stocktake movement whose delta is counted − current, and shows a
   variance report (items over/under by more than a threshold).
7. **Dashboard** — total items, count below reorder, open purchase requests, and
   total value on hand if an optional unit cost is set per item.

## Functional requirements
- Quantities are non-negative integers; stock can never go negative (issuing
  more than on hand is refused naming the shortfall).
- Current qty is the running sum of movements; a reconstruction from the
  movement log must equal the stored qty (invariant check exposed).
- Purchase-request status transitions constrained: Open→Approved→Ordered→
  Received (or →Cancelled from Open/Approved/Ordered); Received is terminal.
- Suggested reorder qty = max(0, target − current).
- Optional value on hand = qty × unit cost (integer pence), displayed GBP.

## Non-functional requirements
- Desktop-first, usable to 768px; accessible tables and forms.
- Deterministic inventory logic separated from UI for unit testing.
- Local persistence; no external services required.

## Explicitly out of scope
- Barcode scanning.
- Supplier ordering / EDI integration.
- Asset depreciation or accounting.
- Multi-site inventory.

## Intent lattice (A1)
Domain: analytics
Jobs: approve, track, record, show, scan, test
Entities: item, inventory, manager, tech, user, dashboard, table, account, asset, code, log, report, site
Constraints: deterministic, local-first
Complexity: 10.0 / 10

## Scheduler (A3)
Tightness 7.5 · security Δ0 · api Δ1
- Standard isolate policy.
- Default API budget.
- Stock HITL set (P4, P5, P8, P9).
Extra HITL: none

## Crew (A8)
- architect (1800 tok): Lock schema and routes for approve, track, record before code. → Pass Spec Graph order + contracts to implementer. Do not write feature code.
- implementer [ACTIVE] (3200 tok): Write files in Spec Graph order. Current edge: Code Generation, Testing & Deployment. → Stop when oracle tests fail twice; hand traceback to reviewer.
- reviewer (1400 tok): Diff against contracts. Reject invented endpoints and leaked PHI/PII. → Approve only if A6 endpoints and A7 oracle are green.
- tester [ACTIVE] (900 tok): Run oracle + one adversarial case per constraint. → Constraints in scope: deterministic, local-first.

## Spec graph order (A5)
- [architect] src/domain/analytics.ts — Typed entities from the lattice
- [architect] src/api/routes.ts — HTTP contracts bound to jobs
- [implementer] src/state/store.ts — Checkpointed client/server state
- [implementer] src/jobs/approve.ts — Implement job “approve” against the contract
- [implementer] src/jobs/track.ts — Implement job “track” against the contract
- [implementer] src/jobs/record.ts — Implement job “record” against the contract
- [implementer] src/jobs/show.ts — Implement job “show” against the contract
- [implementer] src/jobs/scan.ts — Implement job “scan” against the contract
- [implementer] src/ui/console.tsx — Operator surfaces bound to store fields
- [tester] tests/oracle.spec.ts — Acceptance tests from the oracle

## Contracts (A6)
- Item: id:ulid, status:enum, updatedAt:datetime
- Inventory: id:ulid, status:enum, updatedAt:datetime
- Manager: id:ulid, status:enum, updatedAt:datetime
- Tech: id:ulid, status:enum, updatedAt:datetime
- User: id:ulid, status:enum, updatedAt:datetime
- Dashboard: id:ulid, status:enum, updatedAt:datetime
- POST /v1/approve (approve)
- GET /v1/track (track)
- POST /v1/record (record)
- POST /v1/show (show)
- POST /v1/scan (scan)
- POST /v1/test (test)

## Oracle (A7)
- job.approve.happy: Authorized operator submits “approve” with a valid item ⇒ 200 + persisted entity + checkpoint written
- job.track.happy: Authorized operator submits “track” with a valid item ⇒ 200 + persisted entity + checkpoint written
- job.record.happy: Authorized operator submits “record” with a valid item ⇒ 200 + persisted entity + checkpoint written
- job.show.happy: Authorized operator submits “show” with a valid item ⇒ 200 + persisted entity + checkpoint written
- job.scan.happy: Authorized operator submits “scan” with a valid item ⇒ 200 + persisted entity + checkpoint written
- constraint.deterministic: Request violates deterministic ⇒ 403 or 422; no side effect; diagnostic JSON
- constraint.local-first: Request violates local-first ⇒ 403 or 422; no side effect; diagnostic JSON
- graph.no-skip: Agent requests P9 while P4 is open ⇒ Illegal transition; no deploy artifacts

## Current edge
P6 — Code Generation, Testing & Deployment
Deterministic template module as the no-key floor; with a live key, brief-faithful machine-verified module synthesis (evidence-gated).
Status: running · model: deepseek-flash
Execution: Engine-template runner (bounded, engine-authored code only)
Generated artifact: 2 tree file(s) recorded (project.generatedTree) — the bytes to continue from: src/generated.ts, src/generated/list-items.ts.
Phase coverage: 7 of 13 phases executed / 0 artifacts from P7–P12 — strictly linear graph; unexecuted phases are not implied complete (the current edge is the only enterable phase).
No pending HITL.

P6 self-test (machine-verified) (last run): pass — tree-run green: compile 9/9 file(s) · 1 spec file(s) pass · 1 assertion(s) · specs [tests/oracle.spec.ts] · entry ui-shell skip · entry-skipped · evidence 761559975
Verdict: proceed-with-guards

## Repo map
src/generated/list-items.ts: adjustItem, checkInvariant, getDashboard, issueItem, listItems, raisePurchaseRequest (+4) · in 1, 642 ln
src/generated.ts: (no named exports) · in 0, 2 ln · entry

## Exit criteria (DoD)
Gate P6: FAIL (1 unmet) — the criteria below are machine-checked against this project's state; satisfy them, do not restate them.
- [x] Last template self-test run passed
- [x] Generated source is non-empty
- [x] Generated code artifact exists for P6
- [x] Machine verification promoted a tested verdict (lastTest.label === "tested" with evidenceHash)
- [x] Brief-conformance: required brief nouns appear as identifiers in the generated source (single-module, or the union of the tree files in tree mode)
- [ ] Tree architecture: every expanded-spec capability maps to a real generatedTree file carrying its stemmed identifier; no tree file is a template stub or an out-of-tree reexport-only leftover (an assembly barrel whose targets all resolve in-tree is exempt; absent tree = single-module legacy path)

## Decision ledger (HITL)
- P4 · approve · autopilot · 2026-10-05T02:33:02.209Z
- P5 · approve · autopilot · 2026-10-05T02:33:02.234Z

…[TRUNCATED — regenerate at a HITL gate for the full plan]

## Required output schema
Return your work as ONE JSON report matching report_schema (see ## System JSON above) — the ingest seam validates this exact shape.
Verify before reporting, from the emitted tree root: run the tree's install and declared scripts in order (`npm install`, then `npm run typecheck`, then `npm test`) — `npm test` executes the emitted oracle spec (`tests/oracle.spec.ts`). Record each command you ran in the report's `tests_run`. A red run is not a bypass — patch and re-run.
The five markdown headings (Phase work / Files / Patch / Tests / Risks) remain the recommended structure of your artifacts' bodies for human review.
Next legal edge — only P7 if this phase completes

Do not emit secrets. Do not widen OAuth scopes. Do not deploy without HITL on P9.