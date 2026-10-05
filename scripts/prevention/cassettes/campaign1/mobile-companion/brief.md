# Crumb & Bloom Companion — Mobile App

## What this is
A mobile-optimised companion for the Crumb & Bloom back-office. It is a
phone-first version of the counter workflow: staff on their feet take orders,
check stock at a glance, and receive alerts when something needs restocking.

## Form factor
- Designed for a 360–430px portrait viewport; works one-handed.
- Bottom tab bar navigation with four tabs: **Today**, **New Order**, **Stock**,
  **Alerts**.
- Large tap targets (min 44×44px), sticky primary action button per screen.

## Required screens
1. **Today** — a summary card set: orders due today, revenue today, items sold
   today, and a prominent "low stock" count that links to Alerts. A reverse-
   chronological list of today's orders with status chips.
2. **New Order** — a fast counter flow: search products (big search field),
   tap to add, adjust quantities with +/- steppers, see a sticky running total,
   pick a customer (or quick-add name+phone), choose a fulfilment date, and
   place the order. Placing validates stock and shows a success toast with the
   order id.
3. **Stock** — a searchable list of products with a stock badge (green / amber /
   red vs reorder level). Tapping opens a sheet to receive stock (＋ quantity) or
   record spoilage (－ quantity with a reason), each writing a stock movement.
4. **Alerts** — low-stock items to reorder, newest first, with a suggested
   quantity and a one-tap "mark reordered" that records a note (it must NOT
   change stock — receiving does that).

## Functional requirements
- Offline-tolerant: the app reads a local snapshot; a clearly labelled pending
  badge shows changes not yet synced. No fake sync success.
- The New Order flow must prevent adding more of a product than is in stock and
  must show the shortfall if it happens.
- Money in integer pence, shown as GBP.
- Stock and order logic must reuse the same contracts as the back-office
  (products, orders, movements) so the two tools agree.

## Non-functional requirements
- Touch-first: no hover-only affordances; visible focus for keyboard.
- Works in a mobile browser; no app-store packaging required.
- Fast first paint; skeleton states while data loads.
- Accessible: labelled controls, WCAG AA contrast, respects reduced motion.

## Explicitly out of scope
- Native iOS/Android builds.
- Payment processing.
- Push notifications from a server (alerts are in-app).
- Multi-branch support.
