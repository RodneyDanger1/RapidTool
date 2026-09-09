---
name: "House Showing Scheduler"
brief: "a house-showing scheduler: agents publish open-house and private-showing slots, buyers book slots with email confirmation, reminders, calendar sync stub, showing feedback form, per-property showing history"
kind: "webapp"
domain: "real-estate"
expectedNouns: ["agent", "showing", "openHouse", "slot", "booking", "buyer", "emailConfirmation", "reminder", "calendarSync", "feedback", "showingHistory"]
expectedCapabilities: ["Agents publish open-house and private-showing slots", "Buyers book slots", "Email confirmation for bookings", "Reminders", "Calendar sync stub", "Showing feedback form", "Per-property showing history"]
acceptance: "An agent publishes an open-house or private-showing slot, a buyer books it and receives email confirmation, reminders and the calendar-sync stub fire, feedback is captured, and the property's full showing history is available — in one runnable web app."
baseline: "delivery 1/10, process ~9/10 — 13/13 phases with a live key, zero lines of showing software shipped (dossier 98_make_3)"
---

## Provenance

- **Dossier:** `research/multiagent/98_make_3_showing_booking.md` (Coffeehouse2Home Phase 1, product 3/5 — the deep 288-line brief dossier).
- **Run evidence:** `%TEMP%\rapidtool-make-b3\out\house-showing-final.json` (91.7 KB), envelopes 00–28, vault/ (50 notes), scaff/ (14 files), 14-crew.json (reviewer FAIL verdict), 13-verify.json, 22-prompt.json. Brief quoted **verbatim in the dossier** (line 39) and confirmed byte-identical in `house-showing.json` `brief` (205 chars); recorded project name `House Showing Scheduler`; kind inferred `webapp`.
- **Documented expected outcomes:** `prompt` ExpandedSpec 12 requirements / 15 edgeCases / 10 typeSignatures (booking slots, confirmation, reminders, feedback) — the only genuine product spec, orphaned; lattice collapsed to domain `marketplace` jobs `[schedule, publish, sync]` entity `[buyer]` — of the brief's nouns only schedule/publish/sync/buyer surfaced; P12 OpenAPI had only `/v1/schedule|publish|sync`. Expected lattice domain `real-estate`.
