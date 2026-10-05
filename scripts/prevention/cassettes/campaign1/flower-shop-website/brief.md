# Wildstem Florist — Marketing Website

## What this is
A marketing website for an independent florist, Wildstem. It showcases bouquets,
explains delivery, suggests flowers for occasions, and lets a visitor send an
enquiry for a bespoke arrangement.

## Audience
- People buying a gift for a birthday, anniversary, new baby, or sympathy.
- Local customers who want same-day delivery.
- Corporate clients ordering recurring office flowers.

## Required pages / sections
1. **Home** — hero image, a "same-day delivery if ordered before 1pm" banner,
   three featured bouquets, and trust signals (years in business, review stars).
2. **Bouquets** — a catalogue grid. Each bouquet has a name, price, size options
   (Small / Classic / Grand with different prices), a colour palette, the
   flowers it contains, and an occasion tag list. Filter by occasion and by
   price band; sort by price ascending/descending.
3. **Delivery** — the delivery zones with postcode prefixes, a per-zone delivery
   fee and cutoff time, and a same-day eligibility checker: enter a postcode and
   the current time, and it reports whether same-day delivery is still possible
   and the fee.
4. **Occasions** — one section per occasion (Birthday, Anniversary, New Baby,
   Sympathy, Thank You) with recommended bouquets and a short note on etiquette
   (e.g. sympathy: no bright reds).
5. **Contact / Enquiry** — a bespoke-order form: sender name, recipient name,
   delivery postcode, delivery date, budget range, occasion, and a message for
   the card. Validate the postcode against the served zones, require a delivery
   date in the future, and cap the card message at 250 characters.

## Functional requirements
- The same-day eligibility checker must combine the postcode zone's cutoff time
  with the current time and return eligible/not-eligible plus the fee.
- Bouquet size selection must update the displayed price without a page reload
  and must carry the chosen size into the enquiry.
- Filters (occasion + price band) and sort must compose and show an empty state.
- The enquiry form must validate every required field, reject unknown postcodes
  and past dates, and produce a confirmation with a reference.
- Prices in GBP, two decimals.

## Non-functional requirements
- Responsive, mobile-first, 320px–1440px.
- Accessible forms and controls (labelled inputs, keyboard-operable filters,
  WCAG AA contrast).
- Core catalogue and delivery info readable without JavaScript.
- Fast: no heavy images, lazy-load below-the-fold images.

## Explicitly out of scope
- Real payment processing.
- User accounts.
- Inventory or stock management (that is a separate back-office tool).
- Real-time courier tracking.
