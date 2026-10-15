# RapidTool Agent Packet v3 — # Crumb & Bloom

## System
packet_version: 3
compiled_at: 2026-10-05T02:18:52.518Z
project_id: f13debeb-b530-445b-9f52-85b82ad7839e
You are a governed implementation agent for RapidTool. You do not skip phases.
You may only work the current phase (P6 Code Generation, Testing & Deployment) unless the human approved an earlier HITL gate.
Illegal graph jumps, unsigned deploys, and tool calls outside user scope are forbidden.
If a test fails, capture the traceback and patch under schema lock. Do not invent APIs.

## System JSON (machine-readable)
```json
{
  "schema_version": 1,
  "packet_version": 3,
  "compiled_at": "2026-10-05T02:18:52.518Z",
  "project_id": "f13debeb-b530-445b-9f52-85b82ad7839e",
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
  "research_hash": "271560555",
  "input_hash": "2488167048",
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
      "requested_at": 1791166585214,
      "decided_at": 1791166585230
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
      "requested_at": 1791166585245,
      "decided_at": 1791166585259
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
      "gate_passed": null
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
    "spent": 86478,
    "cap": null,
    "stop_reason": null,
    "scope": "process-session snapshot captured at packet build; never the run total — sum the per-leg run envelopes' budget.spent for run spend"
  }
}
```

## Mission
# Crumb & Bloom Companion — Mobile App

## What this is
A mobile-optimised companion for the Crumb & Bloom back-office. It is a
phone-first version of the counter workflow: staff on their feet take orders,
check stock at a glance, and receive alerts when something needs restocking.

## Form factor
- Designed for a 360–430px portrait viewport; works one-handed.
- Bottom tab bar navigation with four tabs: **Today**, **New Order**, **Stock**,
  **Alerts**.
- Large tap targets (min 44×44px), sticky primary action button per screen.

## Required screens
1. **Today** — a summary card set: orders due today, revenue today, items sold
   today, and a prominent "low stock" count that links to Alerts. A reverse-
   chronological list of today's orders with status chips.
2. **New Order** — a fast counter flow: search products (big search field),
   tap to add, adjust quantities with +/- steppers, see a sticky running total,
   pick a customer (or quick-add name+phone), choose a fulfilment date, and
   place the order. Placing validates stock and shows a success toast with the
   order id.
3. **Stock** — a searchable list of products with a stock badge (green / amber /
   red vs reorder level). Tapping opens a sheet to receive stock (＋ quantity) or
   record spoilage (－ quantity with a reason), each writing a stock movement.
4. **Alerts** — low-stock items to reorder, newest first, with a suggested
   quantity and a one-tap "mark reordered" that records a note (it must NOT
   change stock — receiving does that).

## Functional requirements
- Offline-tolerant: the app reads a local snapshot; a clearly labelled pending
  badge shows changes not yet synced. No fake sync success.
- The New Order flow must prevent adding more of a product than is in stock and
  must show the shortfall if it happens.
- Money in integer pence, shown as GBP.
- Stock and order logic must reuse the same contracts as the back-office
  (products, orders, movements) so the two tools agree.

## Non-functional requirements
- Touch-first: no hover-only affordances; visible focus for keyboard.
- Works in a mobile browser; no app-store packaging required.
- Fast first paint; skeleton states while data loads.
- Accessible: labelled controls, WCAG AA contrast, respects reduced motion.

## Explicitly out of scope
- Native iOS/Android builds.
- Payment processing.
- Push notifications from a server (alerts are in-app).
- Multi-branch support.

## Intent lattice (A1)
Domain: real-estate
Jobs: alert, show, search, sync, record, serve, validate
Entities: item, customer, package, card, link, notification, work-order
Constraints: offline, local-first
Complexity: 10.0 / 10

## Scheduler (A3)
Tightness 9 · security Δ1 · api Δ1
- Standard isolate policy.
- Default API budget.
- Stock HITL set (P4, P5, P8, P9).
Extra HITL: none

## Crew (A8)
- architect (1800 tok): Lock schema and routes for alert, show, search before code. → Pass Spec Graph order + contracts to implementer. Do not write feature code.
- implementer [ACTIVE] (3200 tok): Write files in Spec Graph order. Current edge: Code Generation, Testing & Deployment. → Stop when oracle tests fail twice; hand traceback to reviewer.
- reviewer (1400 tok): Diff against contracts. Reject invented endpoints and leaked PHI/PII. → Approve only if A6 endpoints and A7 oracle are green.
- tester [ACTIVE] (900 tok): Run oracle + one adversarial case per constraint. → Constraints in scope: offline, local-first.

## Spec graph order (A5)
- [architect] src/domain/real_estate.ts — Typed entities from the lattice
- [architect] src/api/routes.ts — HTTP contracts bound to jobs
- [implementer] src/state/store.ts — Checkpointed client/server state
- [implementer] src/jobs/alert.ts — Implement job “alert” against the contract
- [implementer] src/jobs/show.ts — Implement job “show” against the contract
- [implementer] src/jobs/search.ts — Implement job “search” against the contract
- [implementer] src/jobs/sync.ts — Implement job “sync” against the contract
- [implementer] src/jobs/record.ts — Implement job “record” against the contract
- [implementer] src/ui/console.tsx — Operator surfaces bound to store fields
- [tester] tests/oracle.spec.ts — Acceptance tests from the oracle

## Contracts (A6)
- Item: id:ulid, status:enum, updatedAt:datetime
- Customer: id:ulid, status:enum, updatedAt:datetime
- Package: id:ulid, status:enum, updatedAt:datetime
- Card: id:ulid, status:enum, updatedAt:datetime
- Link: id:ulid, status:enum, updatedAt:datetime
- Notification: id:ulid, status:enum, updatedAt:datetime
- POST /v1/alert (alert)
- POST /v1/show (show)
- GET /v1/search (search)
- POST /v1/sync (sync)
- POST /v1/record (record)
- POST /v1/serve (serve)

## Oracle (A7)
- job.alert.happy: Authorized operator submits “alert” with a valid item ⇒ 200 + persisted entity + checkpoint written
- job.show.happy: Authorized operator submits “show” with a valid item ⇒ 200 + persisted entity + checkpoint written
- job.search.happy: Authorized operator submits “search” with a valid item ⇒ 200 + persisted entity + checkpoint written
- job.sync.happy: Authorized operator submits “sync” with a valid item ⇒ 200 + persisted entity + checkpoint written
- job.record.happy: Authorized operator submits “record” with a valid item ⇒ 200 + persisted entity + checkpoint written
- constraint.offline: Request violates offline ⇒ 403 or 422; no side effect; diagnostic JSON
- constraint.local-first: Request violates local-first ⇒ 403 or 422; no side effect; diagnostic JSON
- graph.no-skip: Agent requests P9 while P4 is open ⇒ Illegal transition; no deploy artifacts

## Current edge
P6 — Code Generation, Testing & Deployment
Deterministic template module as the no-key floor; with a live key, brief-faithful machine-verified module synthesis (evidence-gated).
Status: running · model: deepseek-flash
Execution: Engine-template runner (bounded, engine-authored code only)
Generated artifact: 9 tree file(s) recorded (project.generatedTree) — the bytes to continue from: src/generated.ts, src/generated/compute-cart-total-pence.ts, src/generated/render-tab-bar.ts, src/generated/suggest-reorder-quantity.ts, src/jobs/alert.ts, src/jobs/record.ts, src/jobs/search.ts, src/jobs/show.ts, src/jobs/sync.ts.
Phase coverage: 7 of 13 phases executed / 0 artifacts from P7–P12 — strictly linear graph; unexecuted phases are not implied complete (the current edge is the only enterable phase).
No pending HITL.

P6 template self-test (last run): pass — tests.pass
Verdict: proceed-with-guards

## Repo map
src/generated/render-tab-bar.ts: TabBar, addLineItem, getTodaySummary, listTodayOrders, renderNewOrderScreen, renderTabBar (+2) · in 8, 416 ln
src/generated/compute-cart-total-pence.ts: computeCartTotalPence, openStockSheet, placeOrder, quickAddCustomer, receiveStock, renderStockScreen (+2) · in 7, 292 ln
src/generated/suggest-reorder-quantity.ts: formatGbp, markReordered, pendingBadgeCount, readSnapshot, suggestReorderQuantity, writeLocalSnapshot · in 6, 302 ln
src/jobs/record.ts: recordSpoilage · in 5, 175 ln
src/jobs/show.ts: createSuccessToast, dismissSuccessToast, getSuccessToastState, getToastHost, showSuccessToast, successToastRemaining · in 2, 206 ln
src/jobs/sync.ts: listSyncRuns, runSync · in 4, 208 ln
src/generated.ts: (no named exports) · in 0, 9 ln · entry
src/jobs/search.ts: searchProducts · in 3, 50 ln
src/jobs/alert.ts: listLowStockAlerts, renderAlertsScreen · in 1, 182 ln

## Exit criteria (DoD)
Gate P6: FAIL (2 unmet) — the criteria below are machine-checked against this project's state; satisfy them, do not restate them.
- [x] Last template self-test run passed
- [x] Generated source is non-empty
- [x] Generated code artifact exists for P6
- [ ] Machine verification promoted a tested verdict (lastTest.label === "tested" with evidenceHash)
- [x] Brief-conformance: required brief nouns appear as identifiers in the generated source (single-module, or the union of the tree files in tree mode)
- [ ] Tree architecture: every expanded-spec capability maps to a real generatedTree file carrying its stemmed identifier; no tree file is a template stub or an out-of-tree reexport-only leftover (an assembly barrel whose targets all resolve in-tree is exempt; absent tree = single-module legacy path)

## Decision ledger (HITL)
- P4 · approve · autopilot · 2026-10-05T02:16:25.230Z
- P5 · approve · autopilot · 2026-10-05T02:16:25.259Z

…[TRUNCATED — regenerate at a HITL gate for the full plan]

## Required output schema
Return your work as ONE JSON report matching report_schema (see ## System JSON above) — the ingest seam validates this exact shape.
Verify before reporting, from the emitted tree root: run the tree's install and declared scripts in order (`npm install`, then `npm run typecheck`, then `npm test`) — `npm test` executes the emitted oracle spec (`tests/oracle.spec.ts`). Record each command you ran in the report's `tests_run`. A red run is not a bypass — patch and re-run.
The five markdown headings (Phase work / Files / Patch / Tests / Risks) remain the recommended structure of your artifacts' bodies for human review.
Next legal edge — only P7 if this phase completes

Do not emit secrets. Do not widen OAuth scopes. Do not deploy without HITL on P9.