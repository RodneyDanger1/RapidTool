# Officestock — Office Supplies Inventory Tracker

## What this is
An internal tool to track office supplies (stationery, printer consumables,
kitchen and cleaning items) so nothing runs out unannounced. Staff record what
they take; the office manager receives deliveries and runs stocktakes.

## Users
- **Staff** — take an item from the cupboard.
- **Office manager** — receive deliveries, adjust counts, run stocktakes.
- **Approver** — approve purchase requests raised below reorder level.

## Core domain
- **Item**: id, name, category (Stationery | Printer | Kitchen | Cleaning |
  Tech), unit (each / box / ream / pack), current qty, reorder level, target
  qty (to top up to), location, active.
- **Movement**: id, item, delta (+/-), reason (Issued | Received | Damaged |
  Adjustment | Stocktake), actor, timestamp, note, resulting qty.
- **PurchaseRequest**: id, item, requested qty, status (Open | Approved |
  Ordered | Received | Cancelled), raised-by, decision note.

## Required features
1. **Item list** — searchable, filterable by category and by a "needs reorder"
   toggle; each row shows qty, reorder level, a colour-coded status, and
   location. Sort by name, qty, or category.
2. **Issue an item** — pick item, quantity, actor; refuse if quantity exceeds
   current stock; write an Issued movement and decrement qty.
3. **Receive stock** — increase qty and write a Received movement; if an Open/
   Approved/Ordered purchase request exists for that item, mark it Received.
4. **Adjust / damage** — record a Damaged or Adjustment movement; an adjustment
   requires a note and can set the qty to a counted value (the delta is
   computed), never silently.
5. **Purchase requests** — raise a request for a below-reorder item with a
   suggested quantity of (target − current); approve, order, receive, cancel
   with constrained transitions; receiving a request writes a Received movement.
6. **Stocktake** — enter a counted qty per item in a category; for each item the
   app writes a Stocktake movement whose delta is counted − current, and shows a
   variance report (items over/under by more than a threshold).
7. **Dashboard** — total items, count below reorder, open purchase requests, and
   total value on hand if an optional unit cost is set per item.

## Functional requirements
- Quantities are non-negative integers; stock can never go negative (issuing
  more than on hand is refused naming the shortfall).
- Current qty is the running sum of movements; a reconstruction from the
  movement log must equal the stored qty (invariant check exposed).
- Purchase-request status transitions constrained: Open→Approved→Ordered→
  Received (or →Cancelled from Open/Approved/Ordered); Received is terminal.
- Suggested reorder qty = max(0, target − current).
- Optional value on hand = qty × unit cost (integer pence), displayed GBP.

## Non-functional requirements
- Desktop-first, usable to 768px; accessible tables and forms.
- Deterministic inventory logic separated from UI for unit testing.
- Local persistence; no external services required.

## Explicitly out of scope
- Barcode scanning.
- Supplier ordering / EDI integration.
- Asset depreciation or accounting.
- Multi-site inventory.
