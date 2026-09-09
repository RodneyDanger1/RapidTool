---
name: "Rental Portfolio Manager"
brief: "a rental portfolio manager: properties with units, tenants with leases and rent schedules, rent collection tracking with payment status, maintenance requests with vendor work orders, vacancy pipeline for marketing available units, portfolio cash-flow dashboard, lease-renewal reminders"
kind: "webapp"
domain: "real-estate"
expectedNouns: ["property", "unit", "tenant", "lease", "rentSchedule", "rentPayment", "maintenanceRequest", "workOrder", "vacancy", "cashFlow", "leaseRenewalReminder"]
expectedCapabilities: ["Properties with units", "Tenants with leases and rent schedules", "Rent collection tracking with payment status", "Maintenance requests with vendor work orders", "Vacancy pipeline for marketing available units", "Portfolio cash-flow dashboard", "Lease-renewal reminders"]
acceptance: "A landlord can add a property with units, lease units to tenants with rent schedules, record payments and maintenance requests with vendor work orders, market vacant units through the vacancy pipeline, and see portfolio cash flow plus lease-renewal reminders — in one runnable web app."
baseline: "delivery ≈ 1/10, process ≈ 9/10 — make_1-3 seam verdicts fixed (P6 fires, product-shaped bodies, L3/L5 lessons land) but product bar unchanged (dossier 98_make_4)"
---

## Provenance

- **Dossier:** `research/multiagent/98_make_4_rental_portfolio.md` (Coffeehouse2Home Phase 1, product 4/5).
- **Run evidence:** `%TEMP%\rapidtool-make-b4\` (rental.json + rental-final.json 98.6 KB + pre-verify snapshot, design.html, 3 SVGs, vault/50, packet.md). Verbatim brief recovered from `rental.json`/`rental-final.json` `brief` (285 chars); recorded project name `Rental Portfolio Manager`; kind inferred `webapp`.
- **Documented expected outcomes:** expandBrief produced perfectly brief-faithful typeSignatures (createProperty, createLease, recordPayment, createMaintenanceRequest, createWorkOrder, getVacantUnits, getCashFlowDashboard); anti-vacuity verify rejection names the expected noun family (rental, portfolio, manager, properties, units, tenants, leases, rent); lattice relic `order` with buyerId/totalCents contaminated OpenAPI + schema.sql — brief nouns unit, maintenance request, work order, vacancy, lease renewal, reminder never became entities.
