# DEPLOY.md — Field-Ops Suite

> machine-generated from RapidTool packet 4a1e6b41-4a7f-4c19-9f9d-4089f5df79c8; regenerate, don't hand-edit.
> > template derived from P9/P12 artifacts — verify credentials before any deploy

## What this is

Local-first scaffold for “Field-Ops Suite” (kind webapp, web app), emitted from the RapidTool packet record. It is a starting point for the human/agent build work — not a shipped, hosted product.

## Run locally

```text
  npm install            # requires Node >= 22
  cp .env.example .env   # then replace every PLACEHOLDER with a REAL local value
  npm run typecheck
  npm test
```

  # dev server
```text
  npm run dev   # vite dev server — index.html + src/main entry are emitted
```

Everything above runs on your local machine against the emitted tree. No service, database or account is required, configured or implied.

## Environment

The only env contract is `.env.example` (PLACEHOLDER values — never commit real secrets). Variables:

| Variable | Local meaning |
| --- | --- |
| `VITE_API_BASE_URL` | base URL of any backend the UI talks to (local-first: point it at your local dev server) |
| `VITE_API_KEY` | client-facing key — PLACEHOLDER, never commit a real one |

## Test

```text
  npm test
```

Oracle specs in `tests/oracle.spec.ts` are REAL assertions over the emitted modules (fixes/135) — no todo stubs. Every row keeps its pinned `orc-*` id; green means the scaffold modules are intact and every oracle seam is still honestly stubbed. A seam test fails the moment that seam is implemented — that is the cue to replace it with the row's real acceptance assertion.

## Deploy — human-gated, nothing automatic

No deployment is configured, wired or implied by this repository. Concretely:

- The pipeline **recorded** CI/IaC/ADR/OpenAPI templates (P9/P12 artifacts, below and in `.rapidtool/project.json`); it never executed or validated them.
- Deploying needs credentials and tooling **you** provision outside this repo; nothing here pushes to any cloud, registry or host.
- For this kind, static hosting with preview channels (e.g. Firebase hosting) is a common destination for this kind. If you go that route: create the account/project yourself, then fill `.env` from `.env.example` — and verify credentials before any deploy.
- RapidTool's own P9 approval was a recorded, advisory gate — re-verify before a real deploy.

## Assets

`assets/` and `public/` are expected at the emitted scaffold and are NOT engine-generated.

## Recorded pipeline templates (P9/P12)

Verbatim from the project artifacts — recorded, never executed:

### P9 CI template — GitHub Actions workflow

```text
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
```

### P9 IaC sketch — IaC sketch

```text
# GCP + Firebase hosting
hosting: firebase preview channels
workers: cloud run, scale-to-zero
gpu: provision only for local-edge promotion jobs
```

### P12 ADR — Architecture Decision Records

```text
# ADR-001 construction / trades entity model

Status: accepted
Decision: The product's state is modeled around crew, member, task, material, payroll, supply, budget, job-cost derived from the brief (P0 lattice).

# ADR-002 track pipeline

Status: accepted
Decision: The product runs a sequential track pipeline over its entities.

# ADR-003 construction / trades integration boundaries

Status: accepted
Decision: External surfaces are estimating & bids, scheduling, materials & punch lists — declarations, not runtime bindings.
```

### P12 OpenAPI — OpenAPI 3.1

```text
openapi: 3.1.0
info:
  title: Field-Ops Suite API
  version: "1.0.0"
paths:
  /v1/track:
    get:
      summary: track
      responses:
        "200":
          description: ok
```

