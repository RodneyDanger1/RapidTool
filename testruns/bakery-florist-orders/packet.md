# RapidTool Agent Packet v3 — # Crumb & Bloom

## System
packet_version: 3
compiled_at: 2026-10-05T02:11:39.266Z
project_id: 1e776d25-d838-4a5a-aabd-ad54938787b1
You are a governed implementation agent for RapidTool. You do not skip phases.
You may only work the current phase (P6 Code Generation, Testing & Deployment) unless the human approved an earlier HITL gate.
Illegal graph jumps, unsigned deploys, and tool calls outside user scope are forbidden.
If a test fails, capture the traceback and patch under schema lock. Do not invent APIs.

## System JSON (machine-readable)
```json
{
  "schema_version": 1,
  "packet_version": 3,
  "compiled_at": "2026-10-05T02:11:39.266Z",
  "project_id": "1e776d25-d838-4a5a-aabd-ad54938787b1",
  "name": "# Crumb & Bloom",
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
  "research_hash": "819600881",
  "input_hash": "3664876396",
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
      "requested_at": 1791165908069,
      "decided_at": 1791165908088
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
      "requested_at": 1791165908111,
      "decided_at": 1791165908125
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
  "spend": {
    "source": "token-ledger",
    "prompt_tokens": 70938,
    "completion_tokens": 50630,
    "total_tokens": 121568,
    "calls": 17,
    "cached_prompt_tokens": 0,
    "cache_write_tokens": null,
    "reasoning_tokens": null,
    "estimated_cost_usd": null
  },
  "budget": {
    "spent": 74738,
    "cap": null,
    "stop_reason": null,
    "scope": "process-session snapshot captured at packet build; never the run total — sum the per-leg run envelopes' budget.spent for run spend"
  }
}
```

## Mission
# Crumb & Bloom — Combined Order & Inventory Back-Office

## What this is
A back-office business application for a shop that sells BOTH baked goods and
flowers. Staff use it at a counter and in the back room to take orders, manage
product inventory, and see what needs restocking. This is an internal tool, not a
marketing site.

## Users and roles
- **Counter staff** — create and fulfil customer orders.
- **Stock keeper** — receive stock, adjust counts, set reorder levels.
- **Manager** — view reports and configure product catalogue.

## Core domain
- **Product**: id, name, category (Bakery | Floral), unit price, unit
  (each / dozen / bunch / box), current stock on hand, reorder level, allergens
  (for bakery), stem count (for floral), active flag.
- **Customer**: id, name, phone, email.
- **Order**: id, customer, created-at, fulfilment date, status (Draft | Confirmed
  | Ready | Fulfilled | Cancelled), lines, total. A line references a product,
  quantity, and unit price captured at order time.
- **Stock movement**: id, product, delta (+/-), reason (Received | Sold |
  Spoiled | Adjustment), timestamp, resulting count.

## Required features
1. **Product catalogue** — list, search, filter by category and active status;
   create and edit products; soft-deactivate rather than hard-delete.
2. **Order taking** — build an order by adding product lines with quantity; the
   app computes line totals and the order total; confirm an order and validate
   that every line has enough stock, then decrement stock and write a Sold
   movement. Cancelling an order restores stock and writes a movement.
3. **Stock management** — receive stock (increments and writes Received),
   record spoilage, and perform a manual adjustment that requires a reason.
   Every change is a stock movement; the product count is the running sum.
4. **Low-stock dashboard** — products at or below reorder level, sorted by how
   far below, with a suggested reorder quantity.
5. **Order list** — filter by status and date, search by customer or order id,
   and show a per-status count summary.
6. **Reports** — daily revenue split by category (Bakery vs Floral), top-selling
   products, and total waste (spoiled units) over a selectable date range.

## Functional requirements
- Money is stored and computed in integer minor units (pence) to avoid float
  drift; display formats as GBP.
- Stock can never go negative: confirming an order with insufficient stock is
  refused with a per-line error naming the shortfall.
- Order status transitions are constrained (Draft→Confirmed→Ready→Fulfilled;
  Draft/Confirmed→Cancelled); illegal transitions are refused.
- All stock changes are append-only movements; the product count is derivable
  from the movement log (a reconstruction check must agree with the stored
  count).
- Reports aggregate over movements and orders, not over mutable counters alone.

## Non-functional requirements
- Desktop-first but usable on a tablet at the counter (min 768px).
- Forms accessible and keyboard-navigable; destructive actions require confirm.
- Deterministic core logic separated from the UI so it can be unit-tested.
- No external services required to run; data persists locally.

## Explicitly out of scope
- Payment processing.
- Multi-branch / multi-tenant support.
- Customer-facing storefront (that is a separate marketing site).
- Barcode scanning hardware integration.

## Intent lattice (A1)
Domain: real-estate
Jobs: search, scan, format, record, aggregate, validate, test, persist, show
Entities: customer, report, seller, manager, inventory, site, shop, user, viewer, tenant, dashboard, log
Constraints: multi-tenant, deterministic
Complexity: 10.0 / 10

## Scheduler (A3)
Tightness 9 · security Δ1 · api Δ1
- Standard isolate policy.
- Default API budget.
- Stock HITL set (P4, P5, P8, P9).
Extra HITL: none

## Crew (A8)
- architect (1800 tok): Lock schema and routes for search, scan, format before code. → Pass Spec Graph order + contracts to implementer. Do not write feature code.
- implementer [ACTIVE] (3200 tok): Write files in Spec Graph order. Current edge: Code Generation, Testing & Deployment. → Stop when oracle tests fail twice; hand traceback to reviewer.
- reviewer (1400 tok): Diff against contracts. Reject invented endpoints and leaked PHI/PII. → Approve only if A6 endpoints and A7 oracle are green.
- tester [ACTIVE] (900 tok): Run oracle + one adversarial case per constraint. → Constraints in scope: multi-tenant, deterministic.

## Spec graph order (A5)
- [architect] src/domain/real_estate.ts — Typed entities from the lattice
- [architect] src/api/routes.ts — HTTP contracts bound to jobs
- [implementer] src/state/store.ts — Checkpointed client/server state
- [implementer] src/jobs/search.ts — Implement job “search” against the contract
- [implementer] src/jobs/scan.ts — Implement job “scan” against the contract
- [implementer] src/jobs/format.ts — Implement job “format” against the contract
- [implementer] src/jobs/record.ts — Implement job “record” against the contract
- [implementer] src/jobs/aggregate.ts — Implement job “aggregate” against the contract
- [implementer] src/ui/console.tsx — Operator surfaces bound to store fields
- [tester] tests/oracle.spec.ts — Acceptance tests from the oracle

## Contracts (A6)
- Customer: id:ulid, status:enum, updatedAt:datetime
- Report: id:ulid, status:enum, updatedAt:datetime
- Seller: id:ulid, status:enum, updatedAt:datetime
- Manager: id:ulid, status:enum, updatedAt:datetime
- Inventory: id:ulid, status:enum, updatedAt:datetime
- Site: id:ulid, status:enum, updatedAt:datetime
- GET /v1/search (search)
- POST /v1/scan (scan)
- POST /v1/format (format)
- POST /v1/record (record)
- POST /v1/aggregate (aggregate)
- POST /v1/validate (validate)

## Oracle (A7)
- job.search.happy: Authorized operator submits “search” with a valid customer ⇒ 200 + persisted entity + checkpoint written
- job.scan.happy: Authorized operator submits “scan” with a valid customer ⇒ 200 + persisted entity + checkpoint written
- job.format.happy: Authorized operator submits “format” with a valid customer ⇒ 200 + persisted entity + checkpoint written
- job.record.happy: Authorized operator submits “record” with a valid customer ⇒ 200 + persisted entity + checkpoint written
- job.aggregate.happy: Authorized operator submits “aggregate” with a valid customer ⇒ 200 + persisted entity + checkpoint written
- constraint.multi-tenant: Request violates multi-tenant ⇒ 403 or 422; no side effect; diagnostic JSON
- constraint.deterministic: Request violates deterministic ⇒ 403 or 422; no side effect; diagnostic JSON
- graph.no-skip: Agent requests P9 while P4 is open ⇒ Illegal transition; no deploy artifacts

## Current edge
P6 — Code Generation, Testing & Deployment
Deterministic template module as the no-key floor; with a live key, brief-faithful machine-verified module synthesis (evidence-gated).
Status: running · model: deepseek-flash
Execution: Engine-template runner (bounded, engine-authored code only)
Generated artifact: 3 tree file(s) recorded (project.generatedTree) — the bytes to continue from: src/generated.ts, src/generated/create-product.ts, src/generated/remove-order-line.ts.
Phase coverage: 7 of 13 phases executed / 0 artifacts from P7–P12 — strictly linear graph; unexecuted phases are not implied complete (the current edge is the only enterable phase).
No pending HITL.

P6 template self-test (last run): pass — tests.pass
Verdict: proceed-with-guards

## Repo map
src/generated/create-product.ts: addOrderLine, createOrder, createProduct, deactivateProduct, editProduct, listProducts (+2) · in 2, 738 ln
src/generated/remove-order-line.ts: adjustStock, cancelOrder, confirmOrder, getLowStockDashboard, getStatusSummary, listOrders (+2) · in 1, 501 ln
src/generated.ts: (no named exports) · in 0, 3 ln · entry

…[TRUNCATED — regenerate at a HITL gate for the full plan]

## Required output schema
Return your work as ONE JSON report matching report_schema (see ## System JSON above) — the ingest seam validates this exact shape.
Verify before reporting, from the emitted tree root: run the tree's install and declared scripts in order (`npm install`, then `npm run typecheck`, then `npm test`) — `npm test` executes the emitted oracle spec (`tests/oracle.spec.ts`). Record each command you ran in the report's `tests_run`. A red run is not a bypass — patch and re-run.
The five markdown headings (Phase work / Files / Patch / Tests / Risks) remain the recommended structure of your artifacts' bodies for human review.
Next legal edge — only P7 if this phase completes

Do not emit secrets. Do not widen OAuth scopes. Do not deploy without HITL on P9.