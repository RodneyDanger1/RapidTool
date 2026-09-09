# Real-Estate CRM

> machine-generated from RapidTool packet fff84028-8b4b-4820-8562-e17e5d4af790; regenerate, don't hand-edit.

A real estate agent CRM web app: manage buyer and seller contacts; a lead pipeline with stages (new, contacted, qualified, showing-booked, offer-made, closed-won, closed-lost); property listings with address, list price, beds/baths/sqft and status; per-property showing notes; follow-up task scheduling with due dates and completion; and an email-to-lead capture placeholder that parses an inbound email into a contact and a pipeline lead.

## Status
- **Kind:** cli-tool — CLI tool (kind cli-tool (inferred from brief/domain — no declared kind yet))
- **Status:** complete · **Current phase:** P12 · **Model route:** deterministic
- **Created:** 2026-09-08T13:38:47.717Z

## What ships in this scaffold

| File | Origin |
| --- | --- |
| `README.md` | this file — mission + commands |
| `DEPLOY.md` | run/test/env/deploy notes (honest local-only framing) |
| `.env.example` | PLACEHOLDER env template — copy to .env, never commit real values |
| `package.json` | per-kind skeleton (scripts/deps) + tsconfig.json |
| `.rapidtool/project.json` | the full exported project (packet, artifacts, oracle, contracts) |
| `src/domain/real_estate.ts` | schema — Typed entities from the lattice |
| `src/api/routes.ts` | api — HTTP contracts bound to jobs |
| `src/state/store.ts` | store — Checkpointed client/server state |
| `src/jobs/show.ts` | job-0 — Implement job “show” against the contract |
| `src/jobs/schedule.ts` | job-1 — Implement job “schedule” against the contract |
| `src/jobs/follow_up.ts` | job-2 — Implement job “follow-up” against the contract |
| `src/jobs/stage.ts` | job-3 — Implement job “stage” against the contract |
| `src/jobs/parse.ts` | job-4 — Implement job “parse” against the contract |
| `src/ui/console.tsx` | ui — Operator surfaces bound to store fields |
| `tests/oracle.spec.ts` | tests — Acceptance tests from the oracle |

## Phase rail

- P0 Deep Research & Feasibility — complete · gate passed
- P1 Core Orchestration & State Graph — complete · gate passed
- P2 Memory & Context Consolidation — complete · gate passed
- P3 Tool Integration & Interoperability — complete · gate passed
- P4 Security, Isolation & Authorization — complete · gate passed
- P5 Validation, HITL & Self-Learning — complete · gate passed
- P6 Code Generation, Testing & Deployment — complete · gate unmet (Machine verification promoted a tested verdict (lastTest.label === "tested" with evidenceHash), Brief-conformance: required brief nouns appear as identifiers in generated source (or spec exists and is honored))
- P7 Domain & Market Research — complete · gate unmet (Live research corpus exists for P7 (≥1 fetched finding))
- P8 Dynamic UI/UX Prototyping — complete · gate passed
- P9 CI/CD & Cloud Deployment Routing — complete · gate passed
- P10 Local Agent & Edge Inference — complete · gate passed
- P11 Real-Time Web & Tool Augmentation — complete · gate passed
- P12 Documentation & Technical Specs — complete · gate passed

## Commands

```text
  # install + verify the emitted tree (Node >= 22)
  npm install
  npm run typecheck
  # oracle spec = REAL assertions over the emitted modules (no todo stubs); green
  # means the scaffold modules are intact + every oracle seam is still honestly
  # stubbed — a seam test fails the moment that seam is implemented, which is
  # the cue to replace it with the row's real acceptance assertion
  npm test
```

## Machine record

- `.rapidtool/project.json` is the live exported project: packet, artifacts, oracle, contracts.
- Regenerate this scaffold from it with the RapidTool emit command — hand-edits are overwritten.

## Honest boundaries

- The machine-verified core is the generated P6 module under `src/` (project.generatedSource); everything else is a typed stub awaiting implementation.
- `src/ui/` is a contract-level shell (P8 interface contract), not a finished UI.
- Deploy templates from P9/P12 are recorded artifacts only — see DEPLOY.md; nothing here deploys by itself.
- `assets/` and `public/` are expected at the emitted scaffold and are NOT engine-generated.
