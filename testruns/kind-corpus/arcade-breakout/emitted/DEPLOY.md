# DEPLOY.md — A Browser Arcade Game

> machine-generated from RapidTool packet 4a2c2dc2-9537-46ef-9cd2-8ebd9ba44272; regenerate, don't hand-edit.
> > template derived from P9/P12 artifacts — verify credentials before any deploy

## What this is

Local-first scaffold for “A Browser Arcade Game” (kind game, game), emitted from the RapidTool packet record. It is a starting point for the human/agent build work — not a shipped, hosted product.

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

Oracle specs in `tests/oracle.spec.ts` assert the emitted modules' real current behavior — NOT that every row is implemented. 1 pinned row(s) are NOT IMPLEMENTED (this tree's ACCEPTANCE SHORTFALL) and are emitted as MARKED skips under their pinned ids — with no assert in the skipped body, so a non-executed assertion is never read as evidence — and the same total is counted on the emitted spec's header and in README.md's oracle-row census. A skip is not a pass: those rows carry no acceptance evidence until their seam lands, and the tree-run refuses a skip-dominated spec as a vacuous green (`RT_E_SPEC_SKIP_VACUOUS`). Every row keeps its pinned `orc-*` id; green means the scaffold modules are intact and the remaining rows' real assertions held. A seam test fails the moment that seam is implemented — that is the cue to replace the row's `{ skip: ... }` option with its real acceptance assertion.

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

_None yet — the project has not reached the P9/P12 phases that record CI/IaC/ADR/OpenAPI templates._
