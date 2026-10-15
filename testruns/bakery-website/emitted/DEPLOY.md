# DEPLOY.md — # Golden Crust Bakery

> machine-generated from RapidTool packet 729ce422-bcaa-4b79-9ec6-4840b61a458e; regenerate, don't hand-edit.
> > template derived from P9/P12 artifacts — verify credentials before any deploy

## What this is

Local-first scaffold for “# Golden Crust Bakery” (kind game, game), emitted from the RapidTool packet record. It is a starting point for the human/agent build work — not a shipped, hosted product.

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

## Test

```text
  npm test
```

Oracle specs in `tests/oracle.spec.ts` assert the emitted modules' real current behavior — NOT that every row is implemented. 1 pinned row(s) are NOT IMPLEMENTED and are emitted as visibly-marked `test.skip("<id> — NOT IMPLEMENTED")` (skipped, never green — see the oracle-row census in README.md). Every row keeps its pinned `orc-*` id; green means the scaffold modules are intact and every oracle seam is still honestly stubbed. A seam test fails the moment that seam is implemented — that is the cue to replace it with the row's real acceptance assertion.

## Deploy — human-gated, nothing automatic

No deployment is configured, wired or implied by this repository. Concretely:

- The pipeline **recorded** CI/IaC/ADR/OpenAPI templates (P9/P12 artifacts, below and in `.rapidtool/project.json`); it never executed or validated them.
- Deploying needs credentials and tooling **you** provision outside this repo; nothing here pushes to any cloud, registry or host.
- For this kind, a static file host (e.g. itch.io or any static CDN) is a common destination for this kind. If you go that route: create the account/project yourself, then fill `.env` from `.env.example` — and verify credentials before any deploy.
- RapidTool's own P9 approval was a recorded, advisory gate — re-verify before a real deploy.

- Handoff commands (a TEMPLATE — none of it ran here; run from the emitted folder after your own account/login; the scripts used are declared by the emitted package.json):

```text
npm run build            # vite build → dist/
npm run preview          # play the built bundle locally
# then publish dist/ to any static host, after your own login — e.g.:
#   butler push dist <your-user>/<your-game>:html5      (itch.io)
```

## Assets

`assets/` and `public/` are expected at the emitted scaffold and are NOT engine-generated — `assets/manifest.json` lists the placeholder roster to supply or render procedurally.

## Recorded pipeline templates (P9/P12)

Verbatim from the project artifacts — recorded, never executed:

### P9 CI template — GitHub Actions workflow

```text
# template — not executed: recorded P9 artifact; RapidTool never ran this workflow (B-18).
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
# template — not executed: recorded P9 sketch; nothing here was provisioned or validated (B-18).
# GCP + Firebase hosting
hosting: firebase preview channels
workers: cloud run, scale-to-zero
gpu: provision only for local-edge promotion jobs
```

### P12 ADR — Architecture Decision Records

```text
# ADR-001 real estate entity model

Status: accepted
Decision: The product's state is modeled around text, table, page, image, link, home, user, visitor, item, card, account, database, site, work-order derived from the brief (P0 lattice).

# ADR-002 show pipeline

Status: accepted
Decision: The product runs a sequential show → search → close → track → query → validate → generate pipeline over its entities.

# ADR-003 real estate integration boundaries

Status: accepted
Decision: External surfaces are listing/MLS data, comps + ARV inputs, escrow & title status — declarations, not runtime bindings.
```

### P12 OpenAPI — OpenAPI 3.1

```text
openapi: 3.1.0
info:
  title: # Golden Crust Bakery API
  version: "1.0.0"
paths:
  /v1/show:
    post:
      summary: show
      responses:
        "200":
          description: ok
  /v1/search:
    get:
      summary: search
      responses:
        "200":
          description: ok
  /v1/close:
    post:
      summary: close
      responses:
        "200":
          description: ok
  /v1/track:
    get:
      summary: track
      responses:
        "200":
          description: ok
  /v1/query:
    post:
      summary: query
      responses:
        "200":
          description: ok
  /v1/validate:
    post:
      summary: validate
      responses:
        "200":
          description: ok
```

