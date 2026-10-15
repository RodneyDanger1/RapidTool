// Wildstem Florist marketing website module — home, bouquets, delivery, occasions,
// and enquiry logic. Wildstem is an independent florist, and this marketing website
// showcases the florist's bouquets, explains delivery, suggests flowers for
// occasions, and lets a visitor send an enquiry for a bespoke arrangement.

type BouquetSize = 'Small' | 'Classic' | 'Grand';
type Occasion = 'Birthday' | 'Anniversary' | 'New Baby' | 'Sympathy' | 'Thank You';
type PriceBand = 'under-30' | '30-50' | '50-80' | 'over-80';
type SortOrder = 'price-asc' | 'price-desc';

type SizeOption = { size: BouquetSize; price: number };

type Bouquet = {
  id: string;
  name: string;
  basePrice: number;
  sizes: SizeOption[];
  palette: string[];
  flowers: string[];
  occasions: Occasion[];
};

type DeliveryZone = {
  id: string;
  name: string;
  postcodePrefixes: string[];
  fee: number;
  cutoff: string;
};

type SameDayResult = {
  eligible: boolean;
  fee: number | null;
  zone: string | null;
  cutoff: string | null;
  message: string;
};

type JSXElement = {
  type: string;
  props: Record<string, unknown>;
  children: JSXElement[];
};

declare namespace JSX {
  interface Element {
    type: string;
    props: Record<string, unknown>;
    children: JSX.Element[];
  }
  interface IntrinsicElements {
    [name: string]: unknown;
  }
}

/** The static bouquet catalogue that the Wildstem florist marketing website showcases. */
const WILDMSTEM_BOUQUETS: Bouquet[] = [
  {
    id: 'wildstem-rose-cloud',
    name: 'Rose Cloud',
    basePrice: 35,
    sizes: [
      { size: 'Small', price: 35 },
      { size: 'Classic', price: 48 },
      { size: 'Grand', price: 65 },
    ],
    palette: ['blush pink', 'cream'],
    flowers: ['garden roses', 'astrantia', 'eucalyptus'],
    occasions: ['Birthday', 'Anniversary', 'Thank You'],
  },
  {
    id: 'wildstem-sunrise-bloom',
    name: 'Sunrise Bloom',
    basePrice: 42,
    sizes: [
      { size: 'Small', price: 42 },
      { size: 'Classic', price: 56 },
      { size: 'Grand', price: 74 },
    ],
    palette: ['coral', 'golden yellow'],
    flowers: ['sunflowers', 'marigolds', 'solidago'],
    occasions: ['Birthday', 'Thank You'],
  },
  {
    id: 'wildstem-ivory-whisper',
    name: 'Ivory Whisper',
    basePrice: 55,
    sizes: [
      { size: 'Small', price: 55 },
      { size: 'Classic', price: 70 },
      { size: 'Grand', price: 92 },
    ],
    palette: ['ivory white', 'soft green'],
    flowers: ['lilies', 'hydrangea', 'lisianthus'],
    occasions: ['Sympathy', 'Anniversary'],
  },
  {
    id: 'wildstem-honey-meadow',
    name: 'Honey Meadow',
    basePrice: 28,
    sizes: [
      { size: 'Small', price: 28 },
      { size: 'Classic', price: 39 },
      { size: 'Grand', price: 54 },
    ],
    palette: ['honey', 'amber'],
    flowers: ['spray roses', 'craspedia', 'gypsophila'],
    occasions: ['Birthday', 'New Baby'],
  },
  {
    id: 'wildstem-first-lullaby',
    name: 'First Lullaby',
    basePrice: 32,
    sizes: [
      { size: 'Small', price: 32 },
      { size: 'Classic', price: 44 },
      { size: 'Grand', price: 60 },
    ],
    palette: ['soft blue', 'white'],
    flowers: ['daisies', 'tulips', 'alstroemeria'],
    occasions: ['New Baby', 'Thank You'],
  },
  {
    id: 'wildstem-quiet-harbour',
    name: 'Quiet Harbour',
    basePrice: 38,
    sizes: [
      { size: 'Small', price: 38 },
      { size: 'Classic', price: 50 },
      { size: 'Grand', price: 68 },
    ],
    palette: ['slate', 'sage', 'cream'],
    flowers: ['chrysanthemums', 'roses', 'olive branch'],
    occasions: ['Sympathy'],
  },
  {
    id: 'wildstem-golden-years',
    name: 'Golden Years',
    basePrice: 60,
    sizes: [
      { size: 'Small', price: 60 },
      { size: 'Classic', price: 75 },
      { size: 'Grand', price: 98 },
    ],
    palette: ['gold', 'copper'],
    flowers: ['peonies', 'goldenrod', 'ranunculus'],
    occasions: ['Anniversary'],
  },
  {
    id: 'wildstem-blush-letter',
    name: 'Blush Letter',
    basePrice: 45,
    sizes: [
      { size: 'Small', price: 45 },
      { size: 'Classic', price: 58 },
      { size: 'Grand', price: 76 },
    ],
    palette: ['blush', 'rose gold'],
    flowers: ['sweet peas', 'david austin roses', 'hypericum'],
    occasions: ['Anniversary', 'Thank You'],
  },
];

/** The static delivery zones the Wildstem florist marketing website serves. */
const WILDMSTEM_ZONES: DeliveryZone[] = [
  {
    id: 'zone-north',
    name: 'North Quarter',
    postcodePrefixes: ['N1', 'N4', 'N7'],
    fee: 5.5,
    cutoff: '13:00',
  },
  {
    id: 'zone-riverside',
    name: 'Riverside',
    postcodePrefixes: ['SE1', 'SE8'],
    fee: 6.0,
    cutoff: '12:30',
  },
  {
    id: 'zone-hillside',
    name: 'Hillside',
    postcodePrefixes: ['SW11', 'SW18'],
    fee: 7.25,
    cutoff: '11:00',
  },
  {
    id: 'zone-central',
    name: 'Central',
    postcodePrefixes: ['EC1', 'WC2'],
    fee: 4.75,
    cutoff: '14:00',
  },
];

/**
 * Find the delivery zone serving a postcode by matching its prefixes.
 *
 * @param postcode - The raw postcode string to resolve.
 * @param zones - The available delivery zones, defaulting to the Wildstem zone list.
 * @returns The matching DeliveryZone, or undefined when unserved or malformed.
 */
function resolveZone(postcode: string, zones: DeliveryZone[]): DeliveryZone | undefined { // req-6
  if (typeof postcode !== 'string' || postcode.trim().length === 0 || !Array.isArray(zones)) {
    return undefined;
  }
  const cleaned = postcode.trim().toUpperCase().replace(/\s+/g, '');
  if (cleaned.length < 3) {
    return undefined;
  }
  for (let i = 0; i < zones.length; i += 1) {
    const zone = zones[i];
    for (let j = 0; j < zone.postcodePrefixes.length; j += 1) {
      const prefix = zone.postcodePrefixes[j].toUpperCase();
      if (cleaned.indexOf(prefix) === 0) {
        return zone;
      }
    }
  }
  return undefined;
}

/**
 * Convert a time string of the form 'HH:MM' into minutes past midnight.
 *
 * @param time - The time string to parse.
 * @returns Minutes past midnight, or null when the input is malformed.
 */
function parseTimeToMinutes(time: string): number | null { // req-6
  if (typeof time !== 'string') {
    return null;
  }
  const trimmed = time.trim();
  const match = /^([0-9]{1,2}):([0-9]{2})$/.exec(trimmed);
  if (match === null) {
    return null;
  }
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }
  return hours * 60 + minutes;
}

/**
 * Format an amount as GBP with exactly two decimals.
 *
 * @param amount - The numeric amount in pounds.
 * @returns The amount rendered as GBP with two decimals.
 */
function formatGBP(amount: number): string { // req-9
  const numeric = typeof amount === 'number' && isFinite(amount) ? amount : 0;
  return '£' + numeric.toFixed(2);
}

/**
 * Return the Wildstem florist marketing website bouquet catalogue.
 *
 * @returns A promise resolving to the static bouquet list.
 */
async function getBouquets(): Promise<Bouquet[]> { // req-2
  return WILDMSTEM_BOUQUETS.map((bouquet) => ({
    id: bouquet.id,
    name: bouquet.name,
    basePrice: bouquet.basePrice,
    sizes: bouquet.sizes.map((option) => ({ size: option.size, price: option.price })),
    palette: bouquet.palette.slice(),
    flowers: bouquet.flowers.slice(),
    occasions: bouquet.occasions.slice(),
  }));
}

/**
 * Return the three featured bouquets for the Wildstem marketing website home page.
 *
 * @param bouquets - The full bouquet catalogue.
 * @returns The first three bouquets, or fewer when the catalogue is smaller.
 */
function getFeaturedBouquets(bouquets: Bouquet[]): Bouquet[] { // req-1
  if (!Array.isArray(bouquets)) {
    return [];
  }
  return bouquets.slice(0, 3);
}

/**
 * Look up the price of a bouquet at a given size.
 *
 * @param bouquet - The bouquet to price.
 * @param size - The chosen bouquet size.
 * @returns The chosen size and its GBP price.
 */
function selectBouquetSize(bouquet: Bouquet, size: BouquetSize): { size: BouquetSize; price: number } { // req-4
  const options = bouquet && Array.isArray(bouquet.sizes) ? bouquet.sizes : [];
  for (let i = 0; i < options.length; i += 1) {
    if (options[i].size === size) {
      return { size: size, price: options[i].price };
    }
  }
  return { size: size, price: bouquet ? bouquet.basePrice : 0 };
}

/**
 * Test whether a bouquet price falls inside a price band.
 *
 * @param price - The bouquet price.
 * @param priceBand - The band to test against.
 * @returns True when the price is inside the inclusive band.
 */
function matchesPriceBand(price: number, priceBand: PriceBand): boolean { // req-3
  if (priceBand === 'under-30') {
    return price < 30;
  }
  if (priceBand === '30-50') {
    return price >= 30 && price < 50;
  }
  if (priceBand === '50-80') {
    return price >= 50 && price < 80;
  }
  if (priceBand === 'over-80') {
    return price >= 80;
  }
  return false;
}

/**
 * Filter and sort the bouquet catalogue by occasion, price band, and price order.
 *
 * @param bouquets - The bouquet catalogue to filter.
 * @param occasion - The occasion to require, or null for no occasion filter.
 * @param priceBand - The price band to require, or null for no band filter.
 * @param sort - The price sort direction.
 * @returns The filtered bouquets in the requested order, stable for equal prices.
 */
function filterBouquets(bouquets: Bouquet[], occasion: Occasion | null, priceBand: PriceBand | null, sort: 'price-asc' | 'price-desc'): Bouquet[] { // req-3
  const source = Array.isArray(bouquets) ? bouquets : [];
  const filtered: Bouquet[] = [];
  for (let i = 0; i < source.length; i += 1) {
    const bouquet = source[i];
    if (occasion !== null && bouquet.occasions.indexOf(occasion) === -1) {
      continue;
    }
    if (priceBand !== null && !matchesPriceBand(bouquet.basePrice, priceBand)) {
      continue;
    }
    filtered.push(bouquet);
  }
  const indexed = filtered.map((bouquet, index) => ({ bouquet: bouquet, index: index }));
  indexed.sort((a, b) => {
    const diff = a.bouquet.basePrice - b.bouquet.basePrice;
    if (diff === 0) {
      return a.index - b.index;
    }
    return sort === 'price-desc' ? -diff : diff;
  });
  return indexed.map((entry) => entry.bouquet);
}

/**
 * Build a JSX element in the Wildstem marketing website output tree.
 *
 * @param type - The element tag name.
 * @param props - The element properties.
 * @param children - The child elements.
 * @returns The constructed JSX element.
 */
function h(type: string, props: Record<string, unknown>, children: JSX.Element[]): JSX.Element {
  return { type: type, props: props, children: children };
}

/**
 * Render the Wildstem marketing website home page with its hero, banner, three
 * featured bouquets, and trust signals.
 *
 * @param featuredBouquets - The bouquets featured in the home grid.
 * @param trust - The trust signals: years in business and review stars.
 * @returns The rendered home page element.
 */
function renderHome(featuredBouquets: Bouquet[], trust: { yearsInBusiness: number; reviewStars: number }): JSX.Element { // req-1
  const features = Array.isArray(featuredBouquets) ? featuredBouquets : [];
  const bannerText = 'same-day delivery if ordered before 1pm';
  const hero = h('section', { className: 'hero' }, [
    h('h1', { className: 'hero-title' }, [h('span', {}, ['Wildstem Florist']) as JSX.Element]),
    h('p', { className: 'hero-copy' }, [
      h('span', {}, ['Bespoke bouquets from an independent florist, delivered with care.']) as JSX.Element,
    ]),
    h('img', { src: '/images/wildstem-hero.jpg', alt: 'Wildstem bouquet', loading: 'eager', width: 640, height: 420, decoding: 'async' }, []),
  ]);
  const banner = h('aside', { className: 'banner', role: 'note' }, [
    h('p', {}, [h('span', {}, [bannerText]) as JSX.Element]),
  ]);
  const featured = h('section', { className: 'featured-bouquets', 'aria-label': 'Featured bouquets' }, [
    h('h2', {}, [h('span', {}, ['Featured bouquets']) as JSX.Element]),
    h('div', { className: 'grid' }, features.map((bouquet) => renderBouquetCard(bouquet, 'Classic'))),
  ]);
  const trustSignals = h('section', { className: 'trust-signals', 'aria-label': 'Trust signals' }, [
    h('p', { className: 'trust-years' }, [h('span', {}, [String(trust.yearsInBusiness) + ' years in business']) as JSX.Element]),
    h('p', { className: 'trust-stars' }, [h('span', {}, [String(trust.reviewStars) + ' review stars']) as JSX.Element]),
  ]);
  return h('main', { className: 'home-page' }, [hero, banner, featured, trustSignals]);
}

/**
 * Render one bouquet card showing its name, base price, size prices, palette,
 * flowers, and occasion tags.
 *
 * @param bouquet - The bouquet to render.
 * @param selectedSize - The currently selected size for this bouquet.
 * @returns The rendered bouquet card element.
 */
function renderBouquetCard(bouquet: Bouquet, selectedSize: BouquetSize): JSX.Element { // req-2
  const priced = selectBouquetSize(bouquet, selectedSize);
  const sizes = bouquet && Array.isArray(bouquet.sizes) ? bouquet.sizes : [];
  const palette = bouquet && Array.isArray(bouquet.palette) ? bouquet.palette : [];
  const flowers = bouquet && Array.isArray(bouquet.flowers) ? bouquet.flowers : [];
  const occasions = bouquet && Array.isArray(bouquet.occasions) ? bouquet.occasions : [];
  return h('article', { className: 'bouquet-card', 'data-id': bouquet ? bouquet.id : '' }, [
    h('h3', { className: 'bouquet-name' }, [h('span', {}, [bouquet ? bouquet.name : 'Information unavailable']) as JSX.Element]),
    h('p', { className: 'bouquet-base-price' }, [
      h('span', {}, ['From ' + formatGBP(bouquet ? bouquet.basePrice : 0)]) as JSX.Element,
    ]),
    h('p', { className: 'bouquet-selected-price' }, [
      h('span', {}, [priced.size + ' ' + formatGBP(priced.price)]) as JSX.Element,
    ]),
    h('ul', { className: 'bouquet-sizes' }, sizes.map((option) =>
      h('li', { key: option.size, 'data-size': option.size }, [
        h('span', {}, [option.size + ' ' + formatGBP(option.price)]) as JSX.Element,
      ])
    )),
    h('p', { className: 'bouquet-palette' }, [h('span', {}, [palette.join(', ')]) as JSX.Element]),
    h('p', { className: 'bouquet-flowers' }, [h('span', {}, [flowers.join(', ')]) as JSX.Element]),
    h('ul', { className: 'bouquet-occasions' }, occasions.map((occasion) =>
      h('li', { key: occasion }, [h('span', {}, [occasion]) as JSX.Element])
    )),
  ]);
}

/**
 * Render the bouquet catalogue grid, including the empty state when no bouquet matches.
 *
 * @param bouquets - The bouquets to render after filtering and sorting.
 * @param activeOccasion - The active occasion filter, or null when none is set.
 * @param activePriceBand - The active price band filter, or null when none is set.
 * @param activeSort - The active price sort direction.
 * @returns The rendered catalogue grid element.
 */
function renderBouquetGrid(bouquets: Bouquet[], activeOccasion: Occasion | null, activePriceBand: PriceBand | null, activeSort: SortOrder): JSX.Element { // req-3
  const list = Array.isArray(bouquets) ? bouquets : [];
  if (list.length === 0) {
    return h('section', { className: 'bouquet-grid empty-state', 'aria-label': 'Bouquet catalogue' }, [
      h('h2', {}, [h('span', {}, ['Bouquets']) as JSX.Element]),
      h('p', { className: 'filters-summary' }, [
        h('span', {}, ['Filters: ' + String(activeOccasion === null ? 'all occasions' : activeOccasion) + ', ' + String(activePriceBand === null ? 'all prices' : activePriceBand) + ', sorted ' + activeSort]) as JSX.Element,
      ]),
      h('p', { className: 'empty-message', role: 'status' }, [
        h('span', {}, ['No bouquets match the selected filters.']) as JSX.Element,
      ]),
    ]);
  }
  return h('section', { className: 'bouquet-grid', 'aria-label': 'Bouquet catalogue' }, [
    h('h2', {}, [h('span', {}, ['Bouquets']) as JSX.Element]),
    h('p', { className: 'filters-summary' }, [
      h('span', {}, ['Filters: ' + String(activeOccasion === null ? 'all occasions' : activeOccasion) + ', ' + String(activePriceBand === null ? 'all prices' : activePriceBand) + ', sorted ' + activeSort]) as JSX.Element,
    ]),
    h('div', { className: 'grid' }, list.map((bouquet) => renderBouquetCard(bouquet, 'Classic'))),
  ]);
}

/**
 * Render the Wildstem delivery zone list with postcode prefixes, fees, and cutoffs.
 *
 * @param zones - The delivery zones to render.
 * @returns The rendered delivery zone list element.
 */
function renderDeliveryZones(zones: DeliveryZone[]): JSX.Element { // req-5
  const list = Array.isArray(zones) && zones.length > 0 ? zones : [];
  if (list.length === 0) {
    return h('section', { className: 'delivery-zones unavailable' }, [
      h('h2', {}, [h('span', {}, ['Delivery zones']) as JSX.Element]),
      h('p', { role: 'status' }, [h('span', {}, ['Delivery information unavailable.']) as JSX.Element]),
    ]);
  }
  return h('section', { className: 'delivery-zones', 'aria-label': 'Delivery zones' }, [
    h('h2', {}, [h('span', {}, ['Delivery zones']) as JSX.Element]),
    h('table', { className: 'zone-table' }, [
      h('thead', {}, [
        h('tr', {}, [
          h('th', { scope: 'col' }, [h('span', {}, ['Zone']) as JSX.Element]),
          h('th', { scope: 'col' }, [h('span', {}, ['Postcodes']) as JSX.Element]),
          h('th', { scope: 'col' }, [h('span', {}, ['Fee']) as JSX.Element]),
          h('th', { scope: 'col' }, [h('span', {}, ['Cutoff']) as JSX.Element]),
        ]),
      ]),
      h('tbody', {}, list.map((zone) =>
        h('tr', { key: zone.id, 'data-zone': zone.id }, [
          h('td', {}, [h('span', {}, [zone.name]) as JSX.Element]),
          h('td', {}, [h('span', {}, [zone.postcodePrefixes.join(', ')]) as JSX.Element]),
          h('td', {}, [h('span', {}, [formatGBP(zone.fee)]) as JSX.Element]),
          h('td', {}, [h('span', {}, [zone.cutoff]) as JSX.Element]),
        ])
      )),
    ]),
  ]);
}

/**
 * Check whether same-day delivery is still available for a postcode at a given time.
 * The zone cutoff must not yet have passed; at the exact cutoff time the result is
 * not eligible, pinning the stated before-cutoff rule deterministically.
 *
 * @param postcode - The delivery postcode entered by the visitor.
 * @param currentTime - The current time as 'HH:MM'.
 * @returns The eligibility verdict including the zone fee when served.
 */
function checkSameDayEligibility(postcode: string, currentTime: string): SameDayResult { // req-6
  const zones = WILDMSTEM_ZONES;
  if (typeof postcode !== 'string' || postcode.trim().length === 0) {
    return { eligible: false, fee: null, zone: null, cutoff: null, message: 'Please enter a postcode.' };
  }
  const cleaned = postcode.trim().toUpperCase().replace(/\s+/g, '');
  if (cleaned.length < 3) {
    return { eligible: false, fee: null, zone: null, cutoff: null, message: 'That postcode looks incomplete.' };
  }
  const zone = resolveZone(cleaned, zones);
  if (zone === undefined) {
    return { eligible: false, fee: null, zone: null, cutoff: null, message: 'That postcode is not in a served zone.' };
  }
  const minutes = parseTimeToMinutes(currentTime);
  if (minutes === null) {
    return { eligible: false, fee: null, zone: zone.name, cutoff: zone.cutoff, message: 'Please enter the current time as HH:MM.' };
  }
  const cutoffMinutes = parseTimeToMinutes(zone.cutoff);
  if (cutoffMinutes === null) {
    return { eligible: false, fee: null, zone: zone.name, cutoff: zone.cutoff, message: 'Delivery information unavailable.' };
  }
  const beforeCutoff = minutes < cutoffMinutes;
  if (!beforeCutoff) {
    return { eligible: false, fee: zone.fee, zone: zone.name, cutoff: zone.cutoff, message: 'Same-day delivery has passed for today in ' + zone.name + '.' };
  }
  return { eligible: true, fee: zone.fee, zone: zone.name, cutoff: zone.cutoff, message: 'Same-day delivery is available in ' + zone.name + '.' };
}

/**
 * Return the occasion sections the Wildstem marketing website suggests flowers for,
 * each with recommended bouquets and an etiquette note.
 *
 * @returns One entry per occasion with its recommended bouquets and etiquette note.
 */
function getOccasionSections(): { occasion: Occasion; note: string; bouquets: Bouquet[] }[] { // req-7
  const occasions: Occasion[] = ['Birthday', 'Anniversary', 'New Baby', 'Sympathy', 'Thank You'];
  const notes: { occasion: Occasion; note: string }[] = [
    { occasion: 'Birthday', note: 'Bright, joyful stems are always welcome; the card does the talking.' },
    { occasion: 'Anniversary', note: 'Choose a palette that echoes the couple, and keep the message sincere.' },
    { occasion: 'New Baby', note: 'Soft, gentle colours suit a new arrival; avoid strong scent around the newborn.' },
    { occasion: 'Sympathy', note: 'No bright reds; choose white, cream, and soft green flowers.' },
    { occasion: 'Thank You', note: 'A compact, cheerful bouquet is a thoughtful everyday thank you.' },
  ];
  return occasions.map((occasion) => {
    const note = notes.filter((entry) => entry.occasion === occasion)[0];
    const recommended = filterBouquets(
      WILDMSTEM_BOUQUETS,
      occasion,
      null,
      'price-asc',
    );
    return {
      occasion: occasion,
      note: note ? note.note : '',
      bouquets: recommended.slice(0, 2),
    };
  });
}

/**
 * Render the Wildstem occasions page, one section per occasion.
 *
 * @returns The rendered occasions page element.
 */
function renderOccasions(): JSX.Element { // req-7
  const sections = getOccasionSections();
  return h('main', { className: 'occasions-page' }, [
    h('h1', {}, [h('span', {}, ['Occasions']) as JSX.Element]),
    h('div', { className: 'occasion-sections' }, sections.map((section) =>
      h('section', { key: section.occasion, className: 'occasion-section' }, [
        h('h2', {}, [h('span', {}, [section.occasion]) as JSX.Element]),
        h('p', { className: 'etiquette-note' }, [h('span', {}, [section.note]) as JSX.Element]),
        h('div', { className: 'occasion-bouquets' }, section.bouquets.map((bouquet) => renderBouquetCard(bouquet, 'Classic'))),
      ])
    )),
  ]);
}

/**
 * Validate a bespoke enquiry for the Wildstem florist marketing website contact form.
 *
 * @param input - The raw enquiry fields submitted by the visitor.
 * @returns The field-level validation messages and the normalised values.
 */
function validateEnquiry(input: {
  senderName: string;
  recipientName: string;
  deliveryPostcode: string;
  deliveryDate: string;
  budgetRange: string;
  occasion: string;
  cardMessage: string;
}): { valid: boolean; errors: Record<string, string>; zone: string | null } { // req-8
  const errors: Record<string, string> = {};
  if (!input || typeof input.senderName !== 'string' || input.senderName.trim().length === 0) {
    errors.senderName = 'Please enter the sender name.';
  }
  if (!input || typeof input.recipientName !== 'string' || input.recipientName.trim().length === 0) {
    errors.recipientName = 'Please enter the recipient name.';
  }
  if (!input || typeof input.deliveryPostcode !== 'string' || input.deliveryPostcode.trim().length === 0) {
    errors.deliveryPostcode = 'Please enter the delivery postcode.';
  } else {
    const zone = resolveZone(input.deliveryPostcode, WILDMSTEM_ZONES);
    if (zone === undefined) {
      errors.deliveryPostcode = 'That postcode is not in a served zone.';
    }
  }
  if (!input || typeof input.deliveryDate !== 'string' || input.deliveryDate.trim().length === 0) {
    errors.deliveryDate = 'Please choose a delivery date.';
  } else if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(input.deliveryDate.trim())) {
    errors.deliveryDate = 'Please use the date format YYYY-MM-DD.';
  } else if (input.deliveryDate.trim() <= '2024-01-01') {
    errors.deliveryDate = 'The delivery date must be in the future.';
  }
  if (!input || typeof input.budgetRange !== 'string' || input.budgetRange.trim().length === 0) {
    errors.budgetRange = 'Please choose a budget range.';
  }
  if (!input || typeof input.occasion !== 'string' || input.occasion.trim().length === 0) {
    errors.occasion = 'Please choose an occasion.';
  }
  if (!input || typeof input.cardMessage !== 'string' || input.cardMessage.trim().length === 0) {
    errors.cardMessage = 'Please add a message for the card.';
  } else if (input.cardMessage.length > 250) {
    errors.cardMessage = 'The card message is limited to 250 characters.';
  }
  let zoneName: string | null = null;
  if (input && typeof input.deliveryPostcode === 'string') {
    const zone = resolveZone(input.deliveryPostcode, WILDMSTEM_ZONES);
    zoneName = zone === undefined ? null : zone.name;
  }
  return { valid: Object.keys(errors).length === 0, errors: errors, zone: zoneName };
}

/**
 * Render the Wildstem contact/enquiry form with its labelled fields.
 *
 * @param errors - Field-level validation messages keyed by field name.
 * @returns The rendered enquiry form element.
 */
function renderContactForm(errors: Record<string, string>): JSX.Element { // req-8
  const fieldErrors = errors && typeof errors === 'object' ? errors : {};
  const messageFor = (field: string): string => {
    return typeof fieldErrors[field] === 'string' ? fieldErrors[field] : '';
  };
  return h('main', { className: 'contact-page' }, [
    h('h1', {}, [h('span', {}, ['Bespoke enquiry']) as JSX.Element]),
    h('form', { className: 'enquiry-form', method: 'post', action: '/v1/serve', 'aria-label': 'Bespoke enquiry form' }, [
      h('label', { htmlFor: 'senderName' }, [h('span', {}, ['Your name']) as JSX.Element]),
      h('input', { id: 'senderName', name: 'senderName', type: 'text', required: true, 'aria-invalid': messageFor('senderName') !== '' }, []),
      h('p', { role: 'alert' }, [h('span', {}, [messageFor('senderName')]) as JSX.Element]),
      h('label', { htmlFor: 'recipientName' }, [h('span', {}, ['Recipient name']) as JSX.Element]),
      h('input', { id: 'recipientName', name: 'recipientName', type: 'text', required: true, 'aria-invalid': messageFor('recipientName') !== '' }, []),
      h('p', { role: 'alert' }, [h('span', {}, [messageFor('recipientName')]) as JSX.Element]),
      h('label', { htmlFor: 'deliveryPostcode' }, [h('span', {}, ['Delivery postcode']) as JSX.Element]),
      h('input', { id: 'deliveryPostcode', name: 'deliveryPostcode', type: 'text', required: true, 'aria-invalid': messageFor('deliveryPostcode') !== '' }, []),
      h('p', { role: 'alert' }, [h('span', {}, [messageFor('deliveryPostcode')]) as JSX.Element]),
      h('label', { htmlFor: 'deliveryDate' }, [h('span', {}, ['Delivery date']) as JSX.Element]),
      h('input', { id: 'deliveryDate', name: 'deliveryDate', type: 'date', required: true, 'aria-invalid': messageFor('deliveryDate') !== '' }, []),
      h('p', { role: 'alert' }, [h('span', {}, [messageFor('deliveryDate')]) as JSX.Element]),
      h('label', { htmlFor: 'budgetRange' }, [h('span', {}, ['Budget range']) as JSX.Element]),
      h('input', { id: 'budgetRange', name: 'budgetRange', type: 'text', required: true, 'aria-invalid': messageFor('budgetRange') !== '' }, []),
      h('p', { role: 'alert' }, [h('span', {}, [messageFor('budgetRange')]) as JSX.Element]),
      h('label', { htmlFor: 'occasion' }, [h('span', {}, ['Occasion']) as JSX.Element]),
      h('input', { id: 'occasion', name: 'occasion', type: 'text', required: true, 'aria-invalid': messageFor('occasion') !== '' }, []),
      h('p', { role: 'alert' }, [h('span', {}, [messageFor('occasion')]) as JSX.Element]),
      h('label', { htmlFor: 'cardMessage' }, [h('span', {}, ['Message for the card']) as JSX.Element]),
      h('textarea', { id: 'cardMessage', name: 'cardMessage', maxLength: 250, required: true, 'aria-invalid': messageFor('cardMessage') !== '' }, []),
      h('p', { role: 'alert' }, [h('span', {}, [messageFor('cardMessage')]) as JSX.Element]),
      h('button', { type: 'submit' }, [h('span', {}, ['Send enquiry']) as JSX.Element]),
    ]),
  ]);
}

/**
 * Render the contact page, showing a confirmation reference only on a successful write
 * and an honest retryable failure state otherwise.
 *
 * @param result - The submission result carrying success, reference, and errors.
 * @returns The rendered contact page element.
 */
function renderContactPage(result: { success: boolean; reference: string | null; errors: Record<string, string> }): JSX.Element { // req-9
  const confirmation = result && result.success && typeof result.reference === 'string'
    ? h('p', { className: 'confirmation', role: 'status' }, [
        h('span', {}, ['Thank you. Your enquiry reference is ' + result.reference + '.']) as JSX.Element,
      ])
    : null;
  const failure = result && !result.success
    ? h('p', { className: 'failure', role: 'alert' }, [
        h('span', {}, ['We could not send your enquiry. Please check the form and try again.']) as JSX.Element,
      ])
    : null;
  const children: JSX.Element[] = [];
  if (confirmation !== null) {
    children.push(confirmation);
  }
  if (failure !== null) {
    children.push(failure);
  }
  return h('div', { className: 'contact-page-wrapper' }, children);
}

/**
 * Derive a deterministic enquiry reference from the validated intent so a duplicate
 * submission of one intent never yields two distinct references.
 *
 * @param input - The validated enquiry fields.
 * @returns The deterministically derived confirmation reference.
 */
function deriveEnquiryReference(input: {
  senderName: string;
  recipientName: string;
  deliveryPostcode: string;
  deliveryDate: string;
  budgetRange: string;
  occasion: string;
  cardMessage: string;
}): string { // req-9
  const seed = [
    input.senderName.trim(),
    input.recipientName.trim(),
    input.deliveryPostcode.trim().toUpperCase().replace(/\s+/g, ''),
    input.deliveryDate.trim(),
    input.budgetRange.trim(),
    input.occasion.trim(),
    input.cardMessage,
  ].join('|');
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    hash = hash ^ seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const hex = hash.toString(16).toUpperCase().padStart(8, '0');
  return 'WS-' + hex.slice(0, 4) + '-' + hex.slice(4, 8);
}

/**
 * Submit a bespoke enquiry: validate the fields, guard against duplicate submissions,
 * and return a confirmation reference only when the backend write succeeds.
 *
 * @param input - The raw enquiry fields submitted by the visitor.
 * @param backend - The enquiry backend writer, returning true on success.
 * @param previousReference - The reference already issued for the same intent, if any.
 * @returns The submission result with the confirmation reference or field errors.
 */
async function submitEnquiry(input: {
  senderName: string;
  recipientName: string;
  deliveryPostcode: string;
  deliveryDate: string;
  budgetRange: string;
  occasion: string;
  cardMessage: string;
}, backend: (payload: Record<string, unknown>) => Promise<boolean>, previousReference: string | null): Promise<{ success: boolean; reference: string | null; errors: Record<string, string> }> { // req-9
  const validation = validateEnquiry(input);
  if (!validation.valid) {
    return { success: false, reference: null, errors: validation.errors };
  }
  const reference = typeof previousReference === 'string' && previousReference.length > 0
    ? previousReference
    : deriveEnquiryReference(input);
  let written = false;
  try {
    written = await backend({
      senderName: input.senderName.trim(),
      recipientName: input.recipientName.trim(),
      deliveryPostcode: input.deliveryPostcode.trim().toUpperCase().replace(/\s+/g, ''),
      deliveryDate: input.deliveryDate.trim(),
      budgetRange: input.budgetRange.trim(),
      occasion: input.occasion.trim(),
      cardMessage: input.cardMessage,
      reference: reference,
    });
  } catch (error) {
    written = false;
  }
  if (!written) {
    return { success: false, reference: null, errors: { form: 'We could not send your enquiry. Please try again.' } };
  }
  return { success: true, reference: reference, errors: {} };
}
export { renderHome, renderBouquetCard, getBouquets, filterBouquets, selectBouquetSize, formatGBP, renderDeliveryZones, checkSameDayEligibility };
