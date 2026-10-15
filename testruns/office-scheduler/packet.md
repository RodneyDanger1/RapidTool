# RapidTool Agent Packet v3 — # Shiftline — Office

## System
packet_version: 3
compiled_at: 2026-10-05T02:31:53.589Z
project_id: 7251ab87-21e1-4271-a724-f88294177871
You are a governed implementation agent for RapidTool. You do not skip phases.
You may only work the current phase (P6 Code Generation, Testing & Deployment) unless the human approved an earlier HITL gate.
Illegal graph jumps, unsigned deploys, and tool calls outside user scope are forbidden.
If a test fails, capture the traceback and patch under schema lock. Do not invent APIs.

## System JSON (machine-readable)
```json
{
  "schema_version": 1,
  "packet_version": 3,
  "compiled_at": "2026-10-05T02:31:53.589Z",
  "project_id": "7251ab87-21e1-4271-a724-f88294177871",
  "name": "# Shiftline — Office",
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
  "research_hash": "2385481227",
  "input_hash": "571203995",
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
      "requested_at": 1791167434799,
      "decided_at": 1791167434810
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
      "requested_at": 1791167434820,
      "decided_at": 1791167434829
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
    "spent": 34327,
    "cap": null,
    "stop_reason": null,
    "scope": "process-session snapshot captured at packet build; never the run total — sum the per-leg run envelopes' budget.spent for run spend"
  }
}
```

## Mission
# Shiftline — Office Shift & Appointment Scheduler

## What this is
An internal tool for scheduling office shifts and appointments. A manager builds
a weekly rota for staff and books rooms for appointments; staff see their own
upcoming shifts and any conflicts are surfaced before they happen.

## Users
- **Manager** — builds the rota, assigns shifts, books appointments.
- **Staff** — view their own shifts and request time off.
- **Reception** — books appointments into rooms.

## Core domain
- **Staff**: id, name, role, weekly hour cap, active.
- **Room**: id, name, capacity, active.
- **Shift**: id, staff, date, start time, end time, role note.
- **Appointment**: id, title, room, date, start time, end time, booked-by,
  attendee count (must not exceed room capacity).
- **TimeOffRequest**: id, staff, start date, end date, status (Requested |
  Approved | Denied), note.

## Required features
1. **Weekly rota** — a 7-day grid (Monday–Sunday) with shifts per day per staff.
   Add a shift by picking staff, date, start, end. Refuse overlapping shifts for
   the same staff member on the same day.
2. **Hour cap check** — when a shift would push a staff member over their weekly
   hour cap, warn and refuse (or allow with an explicit override flag); show the
   running weekly hours per staff.
3. **Appointments** — book an appointment into a room; refuse double-booking the
   same room at overlapping times and refuse attendee count over room capacity.
4. **Conflict detector** — a screen that scans the week and lists every hard
   conflict (double-booked room, overlapping staff shift, shift overlapping
   approved time off) with the two offending entries named.
5. **Staff view** — pick a staff member and see their shifts for the current week
   plus approved/denied time off.
6. **Time off** — request time off; manager approves or denies with a note. An
   approved time-off range that overlaps an existing shift is flagged in the
   conflict detector.

## Functional requirements
- Times are stored as minutes-from-midnight integers per date; durations and
  overlaps are computed from integers (exact, no timezone ambiguity).
- Overlap rule: two intervals overlap iff startA < endB && startB < endA.
- Weekly hours sum shift durations against the staff cap.
- All conflict checks are pure functions over the schedule data, unit-testable,
  and reused by both the rota builder and the conflict screen.
- Refusals name the specific conflicting entry.

## Non-functional requirements
- Desktop-first, usable to 1024px; keyboard-navigable grid.
- Accessible: labelled time inputs, table/grid roles where appropriate.
- Deterministic scheduling logic separated from UI.
- Local persistence; no external calendar integration required.

## Explicitly out of scope
- Google/Outlook calendar sync.
- Recurring shifts or RRULE expansion.
- Payroll calculations from hours.
- Notifications by email/SMS.

## Intent lattice (A1)
Domain: real-estate
Jobs: approve, schedule, assign, scan, sync, show
Entities: booking, manager, member, viewer, calendar, user, table, entry, rule, notification, title, payroll
Constraints: same-day, deterministic, local-first
Complexity: 10.0 / 10

## Scheduler (A3)
Tightness 10 · security Δ1 · api Δ2
- Standard isolate policy.
- Cap live-tool calls and cache search results.
- Extra HITL on P11.
Extra HITL: P11

## Crew (A8)
- architect (1800 tok): Lock schema and routes for approve, schedule, assign before code. → Pass Spec Graph order + contracts to implementer. Do not write feature code.
- implementer [ACTIVE] (3200 tok): Write files in Spec Graph order. Current edge: Code Generation, Testing & Deployment. → Stop when oracle tests fail twice; hand traceback to reviewer.
- reviewer (1400 tok): Diff against contracts. Reject invented endpoints and leaked PHI/PII. → Approve only if A6 endpoints and A7 oracle are green.
- tester [ACTIVE] (900 tok): Run oracle + one adversarial case per constraint. → Constraints in scope: same-day, deterministic, local-first.

## Spec graph order (A5)
- [architect] src/domain/real_estate.ts — Typed entities from the lattice
- [architect] src/api/routes.ts — HTTP contracts bound to jobs
- [implementer] src/state/store.ts — Checkpointed client/server state
- [implementer] src/jobs/approve.ts — Implement job “approve” against the contract
- [implementer] src/jobs/schedule.ts — Implement job “schedule” against the contract
- [implementer] src/jobs/assign.ts — Implement job “assign” against the contract
- [implementer] src/jobs/scan.ts — Implement job “scan” against the contract
- [implementer] src/jobs/sync.ts — Implement job “sync” against the contract
- [implementer] src/ui/console.tsx — Operator surfaces bound to store fields
- [tester] tests/oracle.spec.ts — Acceptance tests from the oracle

## Contracts (A6)
- Booking: id:ulid, status:enum, updatedAt:datetime
- Manager: id:ulid, status:enum, updatedAt:datetime
- Member: id:ulid, status:enum, updatedAt:datetime
- Viewer: id:ulid, status:enum, updatedAt:datetime
- Calendar: id:ulid, status:enum, updatedAt:datetime
- User: id:ulid, status:enum, updatedAt:datetime
- POST /v1/approve (approve)
- POST /v1/schedule (schedule)
- POST /v1/assign (assign)
- POST /v1/scan (scan)
- POST /v1/sync (sync)
- POST /v1/show (show)

## Oracle (A7)
- job.approve.happy: Authorized operator submits “approve” with a valid booking ⇒ 200 + persisted entity + checkpoint written
- job.schedule.happy: Authorized operator submits “schedule” with a valid booking ⇒ 200 + persisted entity + checkpoint written
- job.assign.happy: Authorized operator submits “assign” with a valid booking ⇒ 200 + persisted entity + checkpoint written
- job.scan.happy: Authorized operator submits “scan” with a valid booking ⇒ 200 + persisted entity + checkpoint written
- job.sync.happy: Authorized operator submits “sync” with a valid booking ⇒ 200 + persisted entity + checkpoint written
- constraint.same-day: Request violates same-day ⇒ 403 or 422; no side effect; diagnostic JSON
- constraint.deterministic: Request violates deterministic ⇒ 403 or 422; no side effect; diagnostic JSON
- constraint.local-first: Request violates local-first ⇒ 403 or 422; no side effect; diagnostic JSON

## Current edge
P6 — Code Generation, Testing & Deployment
Deterministic template module as the no-key floor; with a live key, brief-faithful machine-verified module synthesis (evidence-gated).
Status: running · model: deepseek-flash
Execution: Engine-template runner (bounded, engine-authored code only)
Generated artifact: 2 tree file(s) recorded (project.generatedTree) — the bytes to continue from: src/generated.ts, src/generated/chunk.ts.
Phase coverage: 7 of 13 phases executed / 0 artifacts from P7–P12 — strictly linear graph; unexecuted phases are not implied complete (the current edge is the only enterable phase).
No pending HITL.

P6 self-test (machine-verified) (last run): pass — tree-run green: compile 9/9 file(s) · 1 spec file(s) pass · 1 assertion(s) · specs [tests/oracle.spec.ts] · entry ui-shell skip · entry-skipped · evidence 761559975
Verdict: proceed-with-guards

## Repo map
src/generated.ts: (no named exports) · in 0, 2 ln · entry
src/generated/chunk.ts: checkHourCap, findShiftOverlaps, overlaps, shiftDuration, weekDates, weeklyHours · in 1, 154 ln

## Exit criteria (DoD)
Gate P6: FAIL (2 unmet) — the criteria below are machine-checked against this project's state; satisfy them, do not restate them.
- [x] Last template self-test run passed
- [x] Generated source is non-empty
- [x] Generated code artifact exists for P6
- [x] Machine verification promoted a tested verdict (lastTest.label === "tested" with evidenceHash)
- [ ] Brief-conformance: required brief nouns appear as identifiers in the generated source (single-module, or the union of the tree files in tree mode) — keyed tree synthesis ran (2 file(s)) but its union dropped the brief's required nouns (missing: shiftline, office, scheduler, internal, scheduling, manager, builds, rota, see, own, upcoming, conflicts, …)
- [ ] Tree architecture: every expanded-spec capability maps to a real generatedTree file carrying its stemmed identifier; no tree file is a template stub or an out-of-tree reexport-only leftover (an assembly barrel whose targets all resolve in-tree is exempt; absent tree = single-module legacy path)

## Decision ledger (HITL)
- P4 · approve · autopilot · 2026-10-05T02:30:34.810Z
- P5 · approve · autopilot · 2026-10-05T02:30:34.829Z

…[TRUNCATED — regenerate at a HITL gate for the full plan]

## Required output schema
Return your work as ONE JSON report matching report_schema (see ## System JSON above) — the ingest seam validates this exact shape.
Verify before reporting, from the emitted tree root: run the tree's install and declared scripts in order (`npm install`, then `npm run typecheck`, then `npm test`) — `npm test` executes the emitted oracle spec (`tests/oracle.spec.ts`). Record each command you ran in the report's `tests_run`. A red run is not a bypass — patch and re-run.
The five markdown headings (Phase work / Files / Patch / Tests / Risks) remain the recommended structure of your artifacts' bodies for human review.
Next legal edge — only P7 if this phase completes

Do not emit secrets. Do not widen OAuth scopes. Do not deploy without HITL on P9.