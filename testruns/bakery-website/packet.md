# RapidTool Agent Packet v3 — # Golden Crust Bakery

## System
packet_version: 3
compiled_at: 2026-10-05T01:56:20.658Z
project_id: 729ce422-bcaa-4b79-9ec6-4840b61a458e
You are a governed implementation agent for RapidTool. You do not skip phases.
You may only work the current phase (P12 Documentation & Technical Specs) unless the human approved an earlier HITL gate.
Illegal graph jumps, unsigned deploys, and tool calls outside user scope are forbidden.
If a test fails, capture the traceback and patch under schema lock. Do not invent APIs.

## System JSON (machine-readable)
```json
{
  "schema_version": 1,
  "packet_version": 3,
  "compiled_at": "2026-10-05T01:56:20.658Z",
  "project_id": "729ce422-bcaa-4b79-9ec6-4840b61a458e",
  "name": "# Golden Crust Bakery",
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
  "research_hash": "700730979",
  "input_hash": "4052902968",
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
      "requested_at": 1791165296427,
      "decided_at": 1791165296450
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
      "requested_at": 1791165296469,
      "decided_at": 1791165296487
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
      "requested_at": 1791165377187,
      "decided_at": 1791165377228
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
      "requested_at": 1791165377262,
      "decided_at": 1791165377306
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
      "gate_passed": true
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
  "spend": null,
  "budget": {
    "spent": 49011,
    "cap": null,
    "stop_reason": null,
    "scope": "process-session snapshot captured at packet build; never the run total — sum the per-leg run envelopes' budget.spent for run spend"
  }
}
```

## Mission
# Golden Crust Bakery — Marketing Website

## What this is
A marketing website for a neighbourhood bakery called Golden Crust. The site is
public, read-mostly, and exists to get a hungry visitor to walk in or place an
order. It must be fast on a phone, work without JavaScript for the core content,
and be trivially editable by the owner.

## Audience
- Local residents deciding where to buy bread and pastries today.
- People ordering a celebration cake or a catering box ahead of time.
- Tourists searching "bakery near me" on a phone.

## Required pages / sections
1. **Home** — hero with today's fresh-bake highlights, opening-hours badge that
   shows Open/Closed computed from the current time and the hours table, and a
   short story block.
2. **Menu** — grouped products (Breads, Pastries, Cakes, Drinks). Each item has a
   name, short description, price, and allergen tags (gluten, dairy, nuts, egg,
   vegan). Filter by dietary tag and by category, plus a text search box.
3. **Hours & Location** — a weekly table of opening hours, a holiday-closures
   list, an embedded static map image, and a "Get directions" link.
4. **Order form** — a celebration-cake / catering enquiry form: name, phone,
   email, pickup date, product, quantity, and free-text notes. Must validate the
   pickup date is at least 48 hours in the future, require either phone or email,
   and show a clear confirmation with an order reference.
5. **Contact** — phone, email, address, social links, and a short FAQ.

## Functional requirements
- Opening-hours logic must be a single source of truth reused by the Home badge
  and the Hours page (compute Open/Closed from the same table).
- The menu filter must combine category, dietary tag, and free-text query with
  AND semantics, and show a friendly empty state when nothing matches.
- The order form must reject a missing contact method, a pickup date under 48
  hours away, and a quantity below 1; on success it generates a human-readable
  order reference (e.g. GC-2026-0007) and echoes the full order back.
- Prices are shown in GBP with two decimals; totals for quantity > 1 are
  computed.
- All form validation errors are field-level and accessible (associated with the
  input, announced to screen readers).

## Non-functional requirements
- Responsive from 320px to 1440px; mobile-first.
- Core content (menu, hours, contact) readable with JS disabled.
- Semantic HTML landmarks, one h1 per page, alt text on every image.
- Colour contrast at least WCAG AA.
- No third-party trackers.

## Explicitly out of scope
- Online payment / card processing.
- User accounts or login.
- A real database or CMS backend — content is static data in the app.
- Multi-language support.

## Intent lattice (A1)
Domain: real-estate
Jobs: show, search, close, track, query, validate, generate
Entities: text, table, page, image, link, home, user, visitor, item, card, account, database, site, work-order
Constraints: local-first
Complexity: 10.0 / 10

## Scheduler (A3)
Tightness 9 · security Δ1 · api Δ1
- Standard isolate policy.
- Default API budget.
- Stock HITL set (P4, P5, P8, P9).
Extra HITL: none

## Crew (A8)
- architect (1800 tok): Lock schema and routes for show, search, close before code. → Pass Spec Graph order + contracts to implementer. Do not write feature code.
- implementer (3200 tok): Write files in Spec Graph order. Current edge: Documentation & Technical Specs. → Stop when oracle tests fail twice; hand traceback to reviewer.
- reviewer [ACTIVE] (1400 tok): Diff against contracts. Reject invented endpoints and leaked PHI/PII. → Approve only if A6 endpoints and A7 oracle are green.
- tester (900 tok): Run oracle + one adversarial case per constraint. → Constraints in scope: local-first.

## Spec graph order (A5)
- [architect] src/domain/real_estate.ts — Typed entities from the lattice
- [architect] src/api/routes.ts — HTTP contracts bound to jobs
- [implementer] src/state/store.ts — Checkpointed client/server state
- [implementer] src/jobs/show.ts — Implement job “show” against the contract
- [implementer] src/jobs/search.ts — Implement job “search” against the contract
- [implementer] src/jobs/close.ts — Implement job “close” against the contract
- [implementer] src/jobs/track.ts — Implement job “track” against the contract
- [implementer] src/jobs/query.ts — Implement job “query” against the contract
- [implementer] src/ui/console.tsx — Operator surfaces bound to store fields
- [tester] tests/oracle.spec.ts — Acceptance tests from the oracle

## Contracts (A6)
- Text: id:ulid, status:enum, updatedAt:datetime
- Table: id:ulid, status:enum, updatedAt:datetime
- Page: id:ulid, status:enum, updatedAt:datetime
- Image: id:ulid, status:enum, updatedAt:datetime
- Link: id:ulid, status:enum, updatedAt:datetime
- Home: id:ulid, status:enum, updatedAt:datetime
- POST /v1/show (show)
- GET /v1/search (search)
- POST /v1/close (close)
- GET /v1/track (track)
- POST /v1/query (query)
- POST /v1/validate (validate)

## Oracle (A7)
- job.show.happy: Authorized operator submits “show” with a valid text ⇒ 200 + persisted entity + checkpoint written
- job.search.happy: Authorized operator submits “search” with a valid text ⇒ 200 + persisted entity + checkpoint written
- job.close.happy: Authorized operator submits “close” with a valid text ⇒ 200 + persisted entity + checkpoint written
- job.track.happy: Authorized operator submits “track” with a valid text ⇒ 200 + persisted entity + checkpoint written
- job.query.happy: Authorized operator submits “query” with a valid text ⇒ 200 + persisted entity + checkpoint written
- constraint.local-first: Request violates local-first ⇒ 403 or 422; no side effect; diagnostic JSON
- graph.no-skip: Agent requests P9 while P4 is open ⇒ Illegal transition; no deploy artifacts

## Current edge
P12 — Documentation & Technical Specs
Architecture Decision Records, OpenAPI 3.1, and a PostgreSQL schema (Database schema (SQL DDL)) derived from the A6 data contract. Frontend/backend parity is a roadmap declaration: the contract binds no screen/action to an endpoint to check, so a parity report would have to be invented (B-18).
Status: complete · model: deepseek-flash
Execution: Engine-template runner (bounded, engine-authored code only)
Generated artifact: 8 tree file(s) recorded (project.generatedTree) — the bytes to continue from: src/generated.ts, src/generated/format-gbp.ts, src/generated/render-home.ts, src/jobs/close.ts, src/jobs/query.ts, src/jobs/search.ts, src/jobs/show.ts, src/jobs/track.ts.
Phase coverage: 13 of 13 phases executed / 21 artifacts from P7–P12 — strictly linear graph; unexecuted phases are not implied complete (the current edge is the only enterable phase).
No pending HITL.

P6 self-test (machine-verified) (last run): pass — tree-run green: compile 15/15 file(s) · 1 spec file(s) pass · 32 assertion(s) · specs [tests/oracle.spec.ts] · entry ui-shell skip · entry-skipped · evidence 2714288931
Verdict: proceed-with-guards

…[TRUNCATED — regenerate at a HITL gate for the full plan]

## Required output schema
Return your work as ONE JSON report matching report_schema (see ## System JSON above) — the ingest seam validates this exact shape.
Verify before reporting, from the emitted tree root: run the tree's install and declared scripts in order (`npm install`, then `npm run typecheck`, then `npm test`) — `npm test` executes the emitted oracle spec (`tests/oracle.spec.ts`). Record each command you ran in the report's `tests_run`. A red run is not a bypass — patch and re-run.
The five markdown headings (Phase work / Files / Patch / Tests / Risks) remain the recommended structure of your artifacts' bodies for human review.
Next legal edge: none — pipeline complete.

Do not emit secrets. Do not widen OAuth scopes. Do not deploy without HITL on P9.