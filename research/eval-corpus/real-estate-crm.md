---
name: "Real-Estate CRM"
brief: "A real estate agent CRM web app: manage buyer and seller contacts; a lead pipeline with stages (new, contacted, qualified, showing-booked, offer-made, closed-won, closed-lost); property listings with address, list price, beds/baths/sqft and status; per-property showing notes; follow-up task scheduling with due dates and completion; and an email-to-lead capture placeholder that parses an inbound email into a contact and a pipeline lead."
kind: "webapp"
domain: "real-estate"
expectedNouns: ["contact", "buyer", "seller", "lead", "pipeline", "listing", "showingNote", "followUpTask", "inboundEmail"]
expectedCapabilities: ["Manage buyer and seller contacts", "Lead pipeline with stages new, contacted, qualified, showing-booked, offer-made, closed-won, closed-lost", "Property listings with address, list price, beds/baths/sqft and status", "Per-property showing notes", "Follow-up task scheduling with due dates and completion", "Email-to-lead capture that parses an inbound email into a contact and a pipeline lead"]
acceptance: "A user can capture an inbound email as a contact plus pipeline lead, move the lead through all seven stages to closed-won, attach listings and per-property showing notes, and complete dated follow-up tasks — in one runnable web app."
baseline: "delivery 1/10 — RenamePro bar met: governed spec record + engine-boilerplate artifacts, NOT a CRM web app; no runnable app code (dossier 98_make_1, verdict ≈ 1/10)"
---

## Provenance

- **Dossier:** `research/multiagent/98_make_1_realestate_crm.md` (Coffeehouse2Home Phase 1, product 1/5).
- **Run evidence:** `%TEMP%\rapidtool-make-b1\` (34 envelopes + project + vault/53 + design/SVGs). Verbatim brief recovered from `realestate-crm-export.json` / `proj.json` `brief` field (439 chars); recorded project name `RealEstate CRM`; kind inferred `webapp`.
- **Expected outcomes documented in dossier:** brief-faithful `prompt` gold (stages new…closed-lost, `ShowingNote`, `parseInboundEmail`) orphaned; lattice degenerated to one screen per entity (lead/buyer/seller/manager/listing/task); honest chat refusal proves the record lacked the product.
