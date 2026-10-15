# RapidTool Agent Packet v3 — # Ledgeline — Office

## System
packet_version: 3
compiled_at: 2026-10-05T02:24:56.878Z
project_id: a1fbe978-6a4f-44c2-9956-d1b4f85a75b7
You are a governed implementation agent for RapidTool. You do not skip phases.
You may only work the current phase (P12 Documentation & Technical Specs) unless the human approved an earlier HITL gate.
Illegal graph jumps, unsigned deploys, and tool calls outside user scope are forbidden.
If a test fails, capture the traceback and patch under schema lock. Do not invent APIs.

## System JSON (machine-readable)
```json
{
  "schema_version": 1,
  "packet_version": 3,
  "compiled_at": "2026-10-05T02:24:56.878Z",
  "project_id": "a1fbe978-6a4f-44c2-9956-d1b4f85a75b7",
  "name": "# Ledgeline — Office",
  "project_status": "complete",
  "current_phase": {
    "id": 12,
    "code": "P12",
    "title": "Documentation & Technical Specs",
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
  "research_hash": "3447605715",
  "input_hash": "2661034154",
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
      "requested_at": 1791166999754,
      "decided_at": 1791166999766
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
      "requested_at": 1791166999778,
      "decided_at": 1791166999788
    },
    {
      "phase": 6,
      "decision": "approve",
      "decided_by": "autopilot",
      "decided_via": {
        "action": "hitl.approve",
        "resource": "gate:P6",
        "reason": "autopilot-seat — hitl.approve on gate:P6 under the harness's own seat.",
        "label": "autopilot/harness",
        "tokenPath": false
      },
      "note": "[seat harness] autopilot seat — no human decision claimed",
      "requested_at": 1791166999805,
      "decided_at": 1791167070228
    },
    {
      "phase": 8,
      "decision": "approve",
      "decided_by": "autopilot",
      "decided_via": {
        "action": "hitl.approve",
        "resource": "gate:P8",
        "reason": "autopilot-seat — hitl.approve on gate:P8 under the harness's own seat.",
        "label": "autopilot/harness",
        "tokenPath": false
      },
      "note": "[seat harness] autopilot seat — no human decision claimed",
      "requested_at": 1791167079242,
      "decided_at": 1791167079270
    },
    {
      "phase": 9,
      "decision": "approve",
      "decided_by": "autopilot",
      "decided_via": {
        "action": "hitl.approve",
        "resource": "gate:P9",
        "reason": "autopilot-seat — hitl.approve on gate:P9 under the harness's own seat.",
        "label": "autopilot/harness",
        "tokenPath": false
      },
      "note": "[seat harness] autopilot seat — no human decision claimed",
      "requested_at": 1791167079313,
      "decided_at": 1791167079333
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
      "status": "complete",
      "rejections": 0,
      "gate_passed": true
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
      "gate_passed": true
    },
    {
      "id": 11,
      "status": "complete",
      "rejections": 0,
      "gate_passed": true
    },
    {
      "id": 12,
      "status": "complete",
      "rejections": 0,
      "gate_passed": true
    }
  ],
  "phase_coverage": {
    "executed": 13,
    "total": 13,
    "artifacts_from_p7_p12": 21,
    "empty_phases": []
  },
  "spend": {
    "source": "token-ledger",
    "prompt_tokens": 14521,
    "completion_tokens": 10976,
    "total_tokens": 25497,
    "calls": 7,
    "cached_prompt_tokens": 0,
    "cache_write_tokens": null,
    "reasoning_tokens": null,
    "estimated_cost_usd": null
  },
  "budget": {
    "spent": 0,
    "cap": null,
    "stop_reason": null,
    "scope": "process-session snapshot captured at packet build; never the run total — sum the per-leg run envelopes' budget.spent for run spend"
  }
}
```

## Mission
# Ledgeline — Office Invoice & Expense Tracker

## What this is
An internal office tool for tracking supplier invoices and staff expenses from
receipt through to payment. It replaces a spreadsheet and gives the office
manager a single ageing view of what is owed and what is overdue.

## Users
- **Office manager** — enters invoices, marks them paid, chases overdue.
- **Employee** — submits an expense claim with a receipt reference.
- **Approver** — approves or rejects expense claims.

## Core domain
- **Supplier**: id, name, email, payment terms (days).
- **Invoice**: id, number, supplier, issue date, due date, amount (integer
  pence), tax amount, status (Draft | Submitted | Approved | Paid | Overdue |
  Cancelled), notes.
- **ExpenseClaim**: id, employee name, date incurred, category (Travel |
  Meals | Equipment | Software | Other), amount (pence), receipt reference,
  status (Draft | Submitted | Approved | Rejected | Reimbursed), decision note.

## Required features
1. **Invoice list** — table with supplier, number, dates, amount, status, and an
   "age" column (days since due; overdue highlighted). Filter by status and
   supplier, search by number/supplier, sort by due date or amount.
2. **Add / edit invoice** — validate: number required and unique, supplier
   required, amount > 0, tax >= 0 and <= amount, due date on/after issue date.
   Computes due date from the supplier's terms when not given explicitly.
3. **Status ageing** — an invoice becomes Overdue automatically when its due
   date has passed and it is not Paid/Cancelled; a "refresh" recomputes this
   from the data (never a manual flag alone).
4. **Expense claims** — submit, approve, reject (rejection requires a note of at
   least 8 characters), and mark reimbursed. A rejected claim cannot be
   reimbursed; an approved claim cannot be re-approved.
5. **Dashboard** — totals: total outstanding, total overdue, count by status,
   and expenses awaiting approval. A simple bar breakdown by supplier of the
   top five outstanding.
6. **Export** — a CSV of the currently filtered invoice list (columns: number,
   supplier, issue, due, amount, tax, status, age).

## Functional requirements
- All money in integer pence; arithmetic (totals, outstanding, overdue sums) is
  exact; display in GBP.
- Ageing and dashboard totals derive from the stored records each time they are
  requested (no stale cached totals).
- Status transitions constrained: Draft→Submitted→Approved→Paid; Submitted→
  Cancelled; a Paid invoice is terminal.
- Expense rejection note rule enforced (>= 8 chars) with a clear error.
- CSV export must quote fields containing commas/quotes correctly.

## Non-functional requirements
- Desktop-first, usable to 768px; accessible data tables with proper headers.
- Deterministic core calculations separated from UI for unit testing.
- Local persistence; no external services needed to run.

## Explicitly out of scope
- Bank feed / open-banking integration.
- Real OCR of receipts.
- Multi-currency (GBP only).
- Payroll or tax filing.

## Intent lattice (A1)
Domain: finance-ops
Jobs: invoice, approve, quote, track, search, record, validate, test
Entities: invoice, manager, dashboard, column, table, user, viewer, file, rule, cache, payroll
Constraints: deterministic, local-first
Complexity: 10.0 / 10

## Scheduler (A3)
Tightness 10 · security Δ2 · api Δ1
- Elevate isolate + OAuth review; treat data as sensitive.
- Default API budget.
- Extra HITL on P6.
Extra HITL: P6

## Crew (A8)
- architect (1800 tok): Lock schema and routes for invoice, approve, quote before code. → Pass Spec Graph order + contracts to implementer. Do not write feature code.
- implementer (3200 tok): Write files in Spec Graph order. Current edge: Documentation & Technical Specs. → Stop when oracle tests fail twice; hand traceback to reviewer.
- reviewer [ACTIVE] (1400 tok): Diff against contracts. Reject invented endpoints and leaked PHI/PII. → Approve only if A6 endpoints and A7 oracle are green.
- tester (900 tok): Run oracle + one adversarial case per constraint. → Constraints in scope: deterministic, local-first.

## Spec graph order (A5)
- [architect] src/domain/finance_ops.ts — Typed entities from the lattice
- [architect] src/api/routes.ts — HTTP contracts bound to jobs
- [implementer] src/state/store.ts — Checkpointed client/server state
- [implementer] src/jobs/invoice.ts — Implement job “invoice” against the contract
- [implementer] src/jobs/approve.ts — Implement job “approve” against the contract
- [implementer] src/jobs/quote.ts — Implement job “quote” against the contract
- [implementer] src/jobs/track.ts — Implement job “track” against the contract
- [implementer] src/jobs/search.ts — Implement job “search” against the contract
- [implementer] src/ui/console.tsx — Operator surfaces bound to store fields
- [tester] tests/oracle.spec.ts — Acceptance tests from the oracle

## Contracts (A6)
- Invoice: id:ulid, totalCents:int, approvedBy:ulid?
- Manager: id:ulid, status:enum, updatedAt:datetime
- Dashboard: id:ulid, status:enum, updatedAt:datetime
- Column: id:ulid, status:enum, updatedAt:datetime
- Table: id:ulid, status:enum, updatedAt:datetime
- User: id:ulid, status:enum, updatedAt:datetime
- POST /v1/invoice (invoice)
- POST /v1/approve (approve)
- POST /v1/quote (quote)
- GET /v1/track (track)
- GET /v1/search (search)
- POST /v1/record (record)

## Oracle (A7)
- job.invoice.happy: Authorized operator submits “invoice” with a valid invoice ⇒ 200 + persisted entity + checkpoint written
- job.approve.happy: Authorized operator submits “approve” with a valid invoice ⇒ 200 + persisted entity + checkpoint written
- job.quote.happy: Authorized operator submits “quote” with a valid invoice ⇒ 200 + persisted entity + checkpoint written
- job.track.happy: Authorized operator submits “track” with a valid invoice ⇒ 200 + persisted entity + checkpoint written
- job.search.happy: Authorized operator submits “search” with a valid invoice ⇒ 200 + persisted entity + checkpoint written
- constraint.deterministic: Request violates deterministic ⇒ 403 or 422; no side effect; diagnostic JSON
- constraint.local-first: Request violates local-first ⇒ 403 or 422; no side effect; diagnostic JSON
- graph.no-skip: Agent requests P9 while P4 is open ⇒ Illegal transition; no deploy artifacts

…[TRUNCATED — regenerate at a HITL gate for the full plan]

## Required output schema
Return your work as ONE JSON report matching report_schema (see ## System JSON above) — the ingest seam validates this exact shape.
Verify before reporting, from the emitted tree root: run the tree's install and declared scripts in order (`npm install`, then `npm run typecheck`, then `npm test`) — `npm test` executes the emitted oracle spec (`tests/oracle.spec.ts`). Record each command you ran in the report's `tests_run`. A red run is not a bypass — patch and re-run.
The five markdown headings (Phase work / Files / Patch / Tests / Risks) remain the recommended structure of your artifacts' bodies for human review.
Next legal edge: none — pipeline complete.

Do not emit secrets. Do not widen OAuth scopes. Do not deploy without HITL on P9.