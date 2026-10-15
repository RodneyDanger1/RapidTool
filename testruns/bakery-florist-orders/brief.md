# Crumb & Bloom — Combined Order & Inventory Back-Office

## What this is
A back-office business application for a shop that sells BOTH baked goods and
flowers. Staff use it at a counter and in the back room to take orders, manage
product inventory, and see what needs restocking. This is an internal tool, not a
marketing site.

## Users and roles
- **Counter staff** — create and fulfil customer orders.
- **Stock keeper** — receive stock, adjust counts, set reorder levels.
- **Manager** — view reports and configure product catalogue.

## Core domain
- **Product**: id, name, category (Bakery | Floral), unit price, unit
  (each / dozen / bunch / box), current stock on hand, reorder level, allergens
  (for bakery), stem count (for floral), active flag.
- **Customer**: id, name, phone, email.
- **Order**: id, customer, created-at, fulfilment date, status (Draft | Confirmed
  | Ready | Fulfilled | Cancelled), lines, total. A line references a product,
  quantity, and unit price captured at order time.
- **Stock movement**: id, product, delta (+/-), reason (Received | Sold |
  Spoiled | Adjustment), timestamp, resulting count.

## Required features
1. **Product catalogue** — list, search, filter by category and active status;
   create and edit products; soft-deactivate rather than hard-delete.
2. **Order taking** — build an order by adding product lines with quantity; the
   app computes line totals and the order total; confirm an order and validate
   that every line has enough stock, then decrement stock and write a Sold
   movement. Cancelling an order restores stock and writes a movement.
3. **Stock management** — receive stock (increments and writes Received),
   record spoilage, and perform a manual adjustment that requires a reason.
   Every change is a stock movement; the product count is the running sum.
4. **Low-stock dashboard** — products at or below reorder level, sorted by how
   far below, with a suggested reorder quantity.
5. **Order list** — filter by status and date, search by customer or order id,
   and show a per-status count summary.
6. **Reports** — daily revenue split by category (Bakery vs Floral), top-selling
   products, and total waste (spoiled units) over a selectable date range.

## Functional requirements
- Money is stored and computed in integer minor units (pence) to avoid float
  drift; display formats as GBP.
- Stock can never go negative: confirming an order with insufficient stock is
  refused with a per-line error naming the shortfall.
- Order status transitions are constrained (Draft→Confirmed→Ready→Fulfilled;
  Draft/Confirmed→Cancelled); illegal transitions are refused.
- All stock changes are append-only movements; the product count is derivable
  from the movement log (a reconstruction check must agree with the stored
  count).
- Reports aggregate over movements and orders, not over mutable counters alone.

## Non-functional requirements
- Desktop-first but usable on a tablet at the counter (min 768px).
- Forms accessible and keyboard-navigable; destructive actions require confirm.
- Deterministic core logic separated from the UI so it can be unit-tested.
- No external services required to run; data persists locally.

## Explicitly out of scope
- Payment processing.
- Multi-branch / multi-tenant support.
- Customer-facing storefront (that is a separate marketing site).
- Barcode scanning hardware integration.
