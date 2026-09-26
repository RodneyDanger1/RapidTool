# DEPLOY.md — Coffeehouse2Home Property Ledger

> machine-generated from RapidTool packet aa185020-cfff-49ac-9224-25b108274a17; regenerate, don't hand-edit.
> > template derived from P9/P12 artifacts — verify credentials before any deploy

## What this is

Local-first scaffold for “Coffeehouse2Home Property Ledger” (kind webapp, web app), emitted from the RapidTool packet record. It is a starting point for the human/agent build work — not a shipped, hosted product.

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

_None yet — the project has not reached the P9/P12 phases that record CI/IaC/ADR/OpenAPI templates._
