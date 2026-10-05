# Golden Crust Bakery — Marketing Website

## What this is
A marketing website for a neighbourhood bakery called Golden Crust. The site is
public, read-mostly, and exists to get a hungry visitor to walk in or place an
order. It must be fast on a phone, work without JavaScript for the core content,
and be trivially editable by the owner.

## Audience
- Local residents deciding where to buy bread and pastries today.
- People ordering a celebration cake or a catering box ahead of time.
- Tourists searching "bakery near me" on a phone.

## Required pages / sections
1. **Home** — hero with today's fresh-bake highlights, opening-hours badge that
   shows Open/Closed computed from the current time and the hours table, and a
   short story block.
2. **Menu** — grouped products (Breads, Pastries, Cakes, Drinks). Each item has a
   name, short description, price, and allergen tags (gluten, dairy, nuts, egg,
   vegan). Filter by dietary tag and by category, plus a text search box.
3. **Hours & Location** — a weekly table of opening hours, a holiday-closures
   list, an embedded static map image, and a "Get directions" link.
4. **Order form** — a celebration-cake / catering enquiry form: name, phone,
   email, pickup date, product, quantity, and free-text notes. Must validate the
   pickup date is at least 48 hours in the future, require either phone or email,
   and show a clear confirmation with an order reference.
5. **Contact** — phone, email, address, social links, and a short FAQ.

## Functional requirements
- Opening-hours logic must be a single source of truth reused by the Home badge
  and the Hours page (compute Open/Closed from the same table).
- The menu filter must combine category, dietary tag, and free-text query with
  AND semantics, and show a friendly empty state when nothing matches.
- The order form must reject a missing contact method, a pickup date under 48
  hours away, and a quantity below 1; on success it generates a human-readable
  order reference (e.g. GC-2026-0007) and echoes the full order back.
- Prices are shown in GBP with two decimals; totals for quantity > 1 are
  computed.
- All form validation errors are field-level and accessible (associated with the
  input, announced to screen readers).

## Non-functional requirements
- Responsive from 320px to 1440px; mobile-first.
- Core content (menu, hours, contact) readable with JS disabled.
- Semantic HTML landmarks, one h1 per page, alt text on every image.
- Colour contrast at least WCAG AA.
- No third-party trackers.

## Explicitly out of scope
- Online payment / card processing.
- User accounts or login.
- A real database or CMS backend — content is static data in the app.
- Multi-language support.
