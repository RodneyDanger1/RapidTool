# Field-Ops Suite

> machine-generated from RapidTool packet 4a1e6b41-4a7f-4c19-9f9d-4089f5df79c8; regenerate, don't hand-edit.

a field-ops suite for a small construction company: projects with phases + budgets, daily task lists per crew member, time sheets that roll into weekly payroll with rates + overtime, material/supply lists with purchase tracking + reorder flags, job costing by project

## Status
- **Kind:** webapp — web app (kind webapp (mapped from declared kind "app"))
- **Status:** complete · **Current phase:** P12 · **Model route:** deterministic
- **Created:** 2026-09-17T02:41:33.883Z

## What ships in this scaffold

| File | Origin |
| --- | --- |
| `README.md` | this file — mission + commands |
| `DEPLOY.md` | run/test/env/deploy notes (honest local-only framing) |
| `.env.example` | PLACEHOLDER env template — copy to .env, never commit real values |
| `package.json` | per-kind skeleton (scripts/deps) + tsconfig.json |
| `.rapidtool/project.json` | the full exported project (packet, artifacts, oracle, contracts) |
| `index.html` | vite HTML entry — mounts src/main (fixes/135 bootability) |
| `vite.config.ts` | vite config (kind-appropriate plugins) — emitted for webapp |
| `src/main` | browser entry that mounts the UI shell (src/ui) |
| `src/domain/construction.ts` | schema — Typed entities from the lattice |
| `src/api/routes.ts` | api — HTTP contracts bound to jobs |
| `src/state/store.ts` | store — Checkpointed client/server state |
| `src/jobs/track.ts` | job-0 — Implement job “track” against the contract |
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
  # oracle spec = REAL assertions over the emitted modules (no todo stubs);
  # green means the scaffold modules are intact + every oracle seam is still
  # honestly stubbed — a seam test fails the moment that seam is implemented,
  # which is the cue to replace it with the row's real acceptance assertion.
  npm test
  
  # dev server — index.html + src/main entry + vite config are emitted; the UI
  # itself is a contract-level shell per the P8 interface contract
  npm run dev
```

## Machine record

- `.rapidtool/project.json` is the live exported project: packet, artifacts, oracle, contracts.
- Regenerate this scaffold from it with the RapidTool emit command — hand-edits are overwritten.

## Honest boundaries

- The machine-verified core is the generated P6 module under `src/` (project.generatedSource); everything else is a typed stub awaiting implementation.
- Oracle rows (`tests/oracle.spec.ts`): all 2 pinned row(s) assert the emitted modules' real current behavior — no NOT IMPLEMENTED skips.
- `src/ui/` is a contract-level shell (P8 interface contract), not a finished UI.
- Deploy templates from P9/P12 are recorded artifacts only — see DEPLOY.md; nothing here deploys by itself.
- `assets/` and `public/` are expected at the emitted scaffold and are NOT engine-generated.
