---
name: "House-Flipping Manager"
brief: "a house-flipping project manager: property acquisition tracker, renovation budgets by line item, contractor bids + invoices, rehab timeline with milestones, ARV/after-repair-value estimator, flip P&L dashboard"
kind: "webapp"
domain: "real-estate"
expectedNouns: ["acquisition", "property", "budget", "lineItem", "contractorBid", "invoice", "milestone", "timeline", "arv", "flip", "pnl"]
expectedCapabilities: ["Property acquisition tracker", "Renovation budgets by line item", "Contractor bids and invoices", "Rehab timeline with milestones", "ARV (after-repair-value) estimator", "Flip P&L dashboard"]
acceptance: "A flipper can log an acquisition, budget the rehab by line item, record contractor bids and invoices against timeline milestones, estimate after-repair value, and see a flip P&L dashboard — end to end in one runnable web app."
baseline: "delivery ≈ 2/10 — honesty 10/10, delivery ~0; 13/13 phases complete with ~zero product (dossier 98_make_2)"
---

## Provenance

- **Dossier:** `research/multiagent/98_make_2_flip_manager.md` (Coffeehouse2Home Phase 1, product 2/5).
- **Run evidence:** `%TEMP%\rapidtool-make-b2\` (flip.json, gate/transcript/verify logs, probe-live.mjs, design.html, 3 SVGs, vault/49). Verbatim brief recovered from `flip.json`/`export.json` `brief` (209 chars); recorded project name `Flip Manager`; kind inferred `webapp`.
- **Documented expected outcomes:** harvest genuinely live (Babylon77/real-estate-calculator, abigailGadams/flip-tracker); `prompt` expansion excellent (acquisition fields, line-item budgets, contractor bids correct); **P0 domain misclassification** house flipping → `analytics, jobs:[invoice, track]` cascaded 9/15 research hits off-product — expected lattice domain is `real-estate`.
