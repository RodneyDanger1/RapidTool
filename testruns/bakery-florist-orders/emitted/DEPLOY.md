# DEPLOY.md — # Crumb & Bloom

> machine-generated from RapidTool packet 1e776d25-d838-4a5a-aabd-ad54938787b1; regenerate, don't hand-edit.
> > template derived from P9/P12 artifacts — verify credentials before any deploy

## What this is

Local-first scaffold for “# Crumb & Bloom” (kind webapp, web app), emitted from the RapidTool packet record. It is a starting point for the human/agent build work — not a shipped, hosted product.

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

Oracle specs in `tests/oracle.spec.ts` assert the emitted modules' real current behavior — NOT that every row is implemented. 1 pinned row(s) are NOT IMPLEMENTED and are emitted as visibly-marked `test.skip("<id> — NOT IMPLEMENTED")` (skipped, never green — see the oracle-row census in README.md). Every row keeps its pinned `orc-*` id; green means the scaffold modules are intact and every oracle seam is still honestly stubbed. A seam test fails the moment that seam is implemented — that is the cue to replace it with the row's real acceptance assertion.

## Deploy — human-gated, nothing automatic

No deployment is configured, wired or implied by this repository. Concretely:

- The pipeline **recorded** CI/IaC/ADR/OpenAPI templates (P9/P12 artifacts, below and in `.rapidtool/project.json`); it never executed or validated them.
- Deploying needs credentials and tooling **you** provision outside this repo; nothing here pushes to any cloud, registry or host.
- For this kind, static hosting with preview channels (e.g. Firebase hosting) is a common destination for this kind. If you go that route: create the account/project yourself, then fill `.env` from `.env.example` — and verify credentials before any deploy.
- RapidTool's own P9 approval was a recorded, advisory gate — re-verify before a real deploy.

- Handoff commands (a TEMPLATE — none of it ran here; run from the emitted folder after your own account/login; the scripts used are declared by the emitted package.json):

```text
npm run build            # vite build → dist/ (declared by the emitted package.json)
npm run preview          # sanity-check the built output locally
# then hand dist/ to your static host, after your own login — e.g.:
#   npx firebase-tools deploy --only hosting      (after `firebase init hosting`)
```

## Assets

`assets/` and `public/` are expected at the emitted scaffold and are NOT engine-generated.

## Recorded pipeline templates (P9/P12)

_None yet — the project has not reached the P9/P12 phases that record CI/IaC/ADR/OpenAPI templates._
