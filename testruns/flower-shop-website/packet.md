# RapidTool Agent Packet v3 — # Wildstem Florist —

## System
packet_version: 3
compiled_at: 2026-10-05T02:02:01.630Z
project_id: 45f9580c-9b91-4bd4-9654-6dce67f301f7
You are a governed implementation agent for RapidTool. You do not skip phases.
You may only work the current phase (P6 Code Generation, Testing & Deployment) unless the human approved an earlier HITL gate.
Illegal graph jumps, unsigned deploys, and tool calls outside user scope are forbidden.
If a test fails, capture the traceback and patch under schema lock. Do not invent APIs.

## System JSON (machine-readable)
```json
{
  "schema_version": 1,
  "packet_version": 3,
  "compiled_at": "2026-10-05T02:02:01.630Z",
  "project_id": "45f9580c-9b91-4bd4-9654-6dce67f301f7",
  "name": "# Wildstem Florist —",
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
  "research_hash": "796612782",
  "input_hash": "4253364457",
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
      "requested_at": 1791165521546,
      "decided_at": 1791165521557
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
      "requested_at": 1791165521568,
      "decided_at": 1791165521581
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
    "spent": 107031,
    "cap": null,
    "stop_reason": null,
    "scope": "process-session snapshot captured at packet build; never the run total — sum the per-leg run envelopes' budget.spent for run spend"
  }
}
```

## Mission
# Wildstem Florist — Marketing Website

## What this is
A marketing website for an independent florist, Wildstem. It showcases bouquets,
explains delivery, suggests flowers for occasions, and lets a visitor send an
enquiry for a bespoke arrangement.

## Audience
- People buying a gift for a birthday, anniversary, new baby, or sympathy.
- Local customers who want same-day delivery.
- Corporate clients ordering recurring office flowers.

## Required pages / sections
1. **Home** — hero image, a "same-day delivery if ordered before 1pm" banner,
   three featured bouquets, and trust signals (years in business, review stars).
2. **Bouquets** — a catalogue grid. Each bouquet has a name, price, size options
   (Small / Classic / Grand with different prices), a colour palette, the
   flowers it contains, and an occasion tag list. Filter by occasion and by
   price band; sort by price ascending/descending.
3. **Delivery** — the delivery zones with postcode prefixes, a per-zone delivery
   fee and cutoff time, and a same-day eligibility checker: enter a postcode and
   the current time, and it reports whether same-day delivery is still possible
   and the fee.
4. **Occasions** — one section per occasion (Birthday, Anniversary, New Baby,
   Sympathy, Thank You) with recommended bouquets and a short note on etiquette
   (e.g. sympathy: no bright reds).
5. **Contact / Enquiry** — a bespoke-order form: sender name, recipient name,
   delivery postcode, delivery date, budget range, occasion, and a message for
   the card. Validate the postcode against the served zones, require a delivery
   date in the future, and cap the card message at 250 characters.

## Functional requirements
- The same-day eligibility checker must combine the postcode zone's cutoff time
  with the current time and return eligible/not-eligible plus the fee.
- Bouquet size selection must update the displayed price without a page reload
  and must carry the chosen size into the enquiry.
- Filters (occasion + price band) and sort must compose and show an empty state.
- The enquiry form must validate every required field, reject unknown postcodes
  and past dates, and produce a confirmation with a reference.
- Prices in GBP, two decimals.

## Non-functional requirements
- Responsive, mobile-first, 320px–1440px.
- Accessible forms and controls (labelled inputs, keyboard-operable filters,
  WCAG AA contrast).
- Core catalogue and delivery info readable without JavaScript.
- Fast: no heavy images, lazy-load below-the-fold images.

## Explicitly out of scope
- Real payment processing.
- User accounts.
- Inventory or stock management (that is a separate back-office tool).
- Real-time courier tracking.

## Intent lattice (A1)
Domain: real-estate
Jobs: validate, track, serve, update, show
Entities: image, card, page, customer, client, user, reviewer, visitor, inventory, folder, account, option, report, home, budget
Constraints: same-day, local-first
Complexity: 10.0 / 10

## Scheduler (A3)
Tightness 9 · security Δ1 · api Δ1
- Standard isolate policy.
- Default API budget.
- Stock HITL set (P4, P5, P8, P9).
Extra HITL: none

## Crew (A8)
- architect (1800 tok): Lock schema and routes for validate, track, serve before code. → Pass Spec Graph order + contracts to implementer. Do not write feature code.
- implementer [ACTIVE] (3200 tok): Write files in Spec Graph order. Current edge: Code Generation, Testing & Deployment. → Stop when oracle tests fail twice; hand traceback to reviewer.
- reviewer (1400 tok): Diff against contracts. Reject invented endpoints and leaked PHI/PII. → Approve only if A6 endpoints and A7 oracle are green.
- tester [ACTIVE] (900 tok): Run oracle + one adversarial case per constraint. → Constraints in scope: same-day, local-first.

## Spec graph order (A5)
- [architect] src/domain/real_estate.ts — Typed entities from the lattice
- [architect] src/api/routes.ts — HTTP contracts bound to jobs
- [implementer] src/state/store.ts — Checkpointed client/server state
- [implementer] src/jobs/validate.ts — Implement job “validate” against the contract
- [implementer] src/jobs/track.ts — Implement job “track” against the contract
- [implementer] src/jobs/serve.ts — Implement job “serve” against the contract
- [implementer] src/jobs/update.ts — Implement job “update” against the contract
- [implementer] src/jobs/show.ts — Implement job “show” against the contract
- [implementer] src/ui/console.tsx — Operator surfaces bound to store fields
- [tester] tests/oracle.spec.ts — Acceptance tests from the oracle

## Contracts (A6)
- Image: id:ulid, status:enum, updatedAt:datetime
- Card: id:ulid, status:enum, updatedAt:datetime
- Page: id:ulid, status:enum, updatedAt:datetime
- Customer: id:ulid, status:enum, updatedAt:datetime
- Client: id:ulid, status:enum, updatedAt:datetime
- User: id:ulid, status:enum, updatedAt:datetime
- POST /v1/validate (validate)
- GET /v1/track (track)
- POST /v1/serve (serve)
- POST /v1/update (update)
- POST /v1/show (show)

## Oracle (A7)
- job.validate.happy: Authorized operator submits “validate” with a valid image ⇒ 200 + persisted entity + checkpoint written
- job.track.happy: Authorized operator submits “track” with a valid image ⇒ 200 + persisted entity + checkpoint written
- job.serve.happy: Authorized operator submits “serve” with a valid image ⇒ 200 + persisted entity + checkpoint written
- job.update.happy: Authorized operator submits “update” with a valid image ⇒ 200 + persisted entity + checkpoint written
- job.show.happy: Authorized operator submits “show” with a valid image ⇒ 200 + persisted entity + checkpoint written
- constraint.same-day: Request violates same-day ⇒ 403 or 422; no side effect; diagnostic JSON
- constraint.local-first: Request violates local-first ⇒ 403 or 422; no side effect; diagnostic JSON
- graph.no-skip: Agent requests P9 while P4 is open ⇒ Illegal transition; no deploy artifacts

## Current edge
P6 — Code Generation, Testing & Deployment
Deterministic template module as the no-key floor; with a live key, brief-faithful machine-verified module synthesis (evidence-gated).
Status: running · model: deepseek-flash
Execution: Engine-template runner (bounded, engine-authored code only)
Generated artifact: 2 tree file(s) recorded (project.generatedTree) — the bytes to continue from: src/generated.ts, src/generated/render-home.ts.
Phase coverage: 7 of 13 phases executed / 0 artifacts from P7–P12 — strictly linear graph; unexecuted phases are not implied complete (the current edge is the only enterable phase).
No pending HITL.

P6 self-test (machine-verified) (last run): pass — tree-run green: compile 9/9 file(s) · 1 spec file(s) pass · 1 assertion(s) · specs [tests/oracle.spec.ts] · entry ui-shell skip · entry-skipped · evidence 761559975
Verdict: proceed-with-guards

## Repo map
src/generated/render-home.ts: carrySizeToEnquiry, filterBouquets, getFeaturedBouquets, renderBouquetGrid, renderEmptyState, renderHome (+2) · in 1, 350 ln
src/generated.ts: (no named exports) · in 0, 2 ln · entry

## Exit criteria (DoD)
Gate P6: FAIL (2 unmet) — the criteria below are machine-checked against this project's state; satisfy them, do not restate them.
- [x] Last template self-test run passed
- [x] Generated source is non-empty
- [x] Generated code artifact exists for P6
- [x] Machine verification promoted a tested verdict (lastTest.label === "tested" with evidenceHash)
- [ ] Brief-conformance: required brief nouns appear as identifiers in the generated source (single-module, or the union of the tree files in tree mode) — keyed tree synthesis ran (2 file(s)) but its union dropped the brief's required nouns (missing: wildstem, florist, marketing, website, independent, showcases, explains, delivery, suggests, lets, visitor, send, …)
- [ ] Tree architecture: every expanded-spec capability maps to a real generatedTree file carrying its stemmed identifier; no tree file is a template stub or an out-of-tree reexport-only leftover (an assembly barrel whose targets all resolve in-tree is exempt; absent tree = single-module legacy path)

## Decision ledger (HITL)
- P4 · approve · autopilot · 2026-10-05T01:58:41.557Z
- P5 · approve · autopilot · 2026-10-05T01:58:41.581Z

…[TRUNCATED — regenerate at a HITL gate for the full plan]

## Required output schema
Return your work as ONE JSON report matching report_schema (see ## System JSON above) — the ingest seam validates this exact shape.
Verify before reporting, from the emitted tree root: run the tree's install and declared scripts in order (`npm install`, then `npm run typecheck`, then `npm test`) — `npm test` executes the emitted oracle spec (`tests/oracle.spec.ts`). Record each command you ran in the report's `tests_run`. A red run is not a bypass — patch and re-run.
The five markdown headings (Phase work / Files / Patch / Tests / Risks) remain the recommended structure of your artifacts' bodies for human review.
Next legal edge — only P7 if this phase completes

Do not emit secrets. Do not widen OAuth scopes. Do not deploy without HITL on P9.