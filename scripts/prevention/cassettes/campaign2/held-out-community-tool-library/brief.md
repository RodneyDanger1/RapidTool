# Rivertown Tool Library — Member Lending Tracker

## What this is
A small community tool library lets members borrow shared tools (drills, ladders, garden equipment) instead of buying them. Volunteers run the desk and keep the inventory honest.

## Users
- **Member** — browse the catalogue and reserve a tool.
- **Volunteer** — check tools in and out, record damage.
- **Coordinator** — manage the catalogue and overdue loans.

## Core domain
- **Tool**: id, name, category, condition, replacement cost (integer pence), loan length, active.
- **Loan**: id, tool, member, checked out at, due at, returned at, status (Reserved | Out | Returned | Overdue).
- **Member**: id, name, email, standing (Good | Restricted), join date.

## Required features
1. **Catalogue** — searchable, filterable by category and availability; each row shows condition and due-back date.
2. **Reserve a tool** — reserve an available tool; refuse if already out.
3. **Check out / in** — volunteer records a loan and its return; overdue loans are flagged.
4. **Damage report** — record a damaged return with a note and a replacement-charge estimate in pence.
5. **Overdue dashboard** — loans past due, sorted by lateness; a member with overdue tools cannot reserve another.

## Non-functional requirements
- Desktop-first, accessible tables and forms.
- Deterministic lending logic separated from UI for unit testing.
- Local persistence; no external services required.

## Explicitly out of scope
- Payment processing or online fines.
- Multi-branch / multi-tenant support.
- Barcode or RFID scanning.
