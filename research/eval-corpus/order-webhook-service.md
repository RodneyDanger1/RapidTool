---
name: "Order Webhook Service"
brief: "A webhook worker service: receives order events on an HTTP endpoint, validates payloads, queues retries with backoff, exposes a health check; reads PORT from the environment."
kind: "service"
domain: "integration"
expectedNouns: ["order", "orderEvent", "payload", "retry", "backoff", "healthCheck", "port"]
expectedCapabilities: ["Receive order events on an HTTP endpoint", "Validate event payloads", "Queue failed deliveries with retry backoff", "Expose a health check", "Read PORT from the environment with a safe default"]
acceptance: "One runnable service: it listens on PORT (env override, safe default), accepts order events on an HTTP endpoint, validates payloads, queues retries with backoff, and answers a health check."
baseline: "not yet measured by an eval run — the brief is K9's probe-verified kind brief (W40 probe-k9-kinds.mjs, service 9/9: pkg.main resolves, scripts.start runs the entry, .env.example carries PORT and resolvePort reads it); authored 2026-09-27 by W41 · P3 (fixes/295_p3_eval.md) — its first recorded run establishes the baseline"
---

## Provenance

- **Authored, NOT transcribed — stated plainly:** authored 2026-09-27 by W41 · P3 to close the missing-kind gap
  (§R7-f04): no `service` fixture existed. The brief text is the one K9's runnable-kind probe verified
  empirically (service 9/9 — `pkg.main` + `scripts.start`, `.env.example` PORT, `resolvePort` defaults and
  refusal); no dossier run and no eval-run row stand behind it — the `baseline` line says so.
- **What is evidence-shaped and what is not:** `expectedNouns` / `expectedCapabilities` decompose the brief;
  the `acceptance` line documents the run-side bar in `graders/order-webhook-service.grader.json` (the grading
  source of truth, read only by `scripts/run-eval.mjs`).
- **Declared kind:** `service` — the driver maps it to the single-module path (no `Project.kind` override) and
  the grader asserts the emitted README's `**Kind:**` line reads `service` (`expectedKind`).
