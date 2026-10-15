type BouquetSize = 'Small' | 'Classic' | 'Grand';
type PriceBand = 'under-30' | '30-50' | '50-75' | 'over-75';
type Occasion = 'Birthday' | 'Anniversary' | 'New Baby' | 'Sympathy' | 'Thank You';

interface SizePrice {
  size: BouquetSize;
  price: number;
}

interface Bouquet {
  id: string;
  name: string;
  basePrice: number;
  sizes: SizePrice[];
  palette: string[];
  flowers: string[];
  occasions: Occasion[];
}

interface EnquiryDraft {
  size: BouquetSize | null;
  sizePrice: number | null;
}

const SIZE_ORDER: BouquetSize[] = ['Small', 'Classic', 'Grand'];

const PRICE_BAND_MIN: Record<PriceBand, number> = {
  'under-30': 0,
  '30-50': 30,
  '50-75': 50,
  'over-75': 75
};

const PRICE_BAND_MAX: Record<PriceBand, number> = {
  'under-30': 30,
  '30-50': 50,
  '50-75': 75,
  'over-75': Number.POSITIVE_INFINITY
};

const BOUQUET_CATALOGUE: Bouquet[] = [
  {
    id: 'bq-001',
    name: 'Wildstem Dawn',
    basePrice: 34.0,
    sizes: [
      { size: 'Small', price: 34.0 },
      { size: 'Classic', price: 46.0 },
      { size: 'Grand', price: 62.0 }
    ],
    palette: ['peach', 'cream', 'soft pink'],
    flowers: ['peony', 'sweet pea', 'garden rose'],
    occasions: ['Birthday', 'Anniversary', 'Thank You']
  },
  {
    id: 'bq-002',
    name: 'The Sunday Meadow',
    basePrice: 28.0,
    sizes: [
      { size: 'Small', price: 28.0 },
      { size: 'Classic', price: 39.0 },
      { size: 'Grand', price: 54.0 }
    ],
    palette: ['butter yellow', 'sage', 'sky blue'],
    flowers: ['cosmos', 'cornflower', 'nigella'],
    occasions: ['Birthday', 'New Baby', 'Thank You']
  },
  {
    id: 'bq-003',
    name: 'Quiet Comfort',
    basePrice: 42.0,
    sizes: [
      { size: 'Small', price: 42.0 },
      { size: 'Classic', price: 55.0 },
      { size: 'Grand', price: 78.0 }
    ],
    palette: ['ivory', 'lilac', 'silver green'],
    flowers: ['lily', 'lisianthus', 'eucalyptus'],
    occasions: ['Sympathy', 'Anniversary']
  },
  {
    id: 'bq-004',
    name: 'New Baby Whisper',
    basePrice: 30.0,
    sizes: [
      { size: 'Small', price: 30.0 },
      { size: 'Classic', price: 44.0 },
      { size: 'Grand', price: 58.0 }
    ],
    palette: ['powder blue', 'buttermilk', 'white'],
    flowers: ['hydrangea', 'gypsophila', 'rose'],
    occasions: ['New Baby', 'Birthday']
  },
  {
    id: 'bq-005',
    name: 'Market Day Bright',
    basePrice: 24.0,
    sizes: [
      { size: 'Small', price: 24.0 },
      { size: 'Classic', price: 32.0 },
      { size: 'Grand', price: 48.0 },
      { size: 'Grand', price: 48.0 }
    ],
    palette: ['scarlet', 'orange', 'gold'],
    flowers: ['tulip', 'ranunculus', 'alstroemeria'],
    occasions: ['Birthday', 'Thank You']
  },
  {
    id: 'bq-006',
    name: 'Golden Hour Gold',
    basePrice: 58.0,
    sizes: [
      { size: 'Small', price: 58.0 },
      { size: 'Classic', price: 72.0 },
      { size: 'Grand', price: 96.0 }
    ],
    palette: ['amber', 'bronze', 'cream'],
    flowers: ['dahlia', 'craspedia', 'calla lily'],
    occasions: ['Anniversary', 'Thank You']
  }
];

/**
 * Formats a numeric amount as GBP with exactly two decimal places.
 *
 * @param amount the monetary amount in pounds
 * @returns the amount rendered as a GBP string with two decimals
 */
function formatGbp(amount: number): string {
  const rounded: number = Math.round((amount + Number.EPSILON) * 100) / 100;
  const negative: boolean = rounded < 0;
  const absolute: number = Math.abs(rounded);
  const whole: number = Math.floor(absolute);
  const fraction: number = Math.round((absolute - whole) * 100);
  const padded: string = fraction < 10 ? '0' + String(fraction) : String(fraction);
  const body: string = String(whole) + '.' + padded;
  return (negative ? '-£' : '£') + body;
}

/**
 * Returns the three featured bouquets shown on the Home page.
 *
 * @returns an array of exactly three featured bouquets
 */
// req-1
function getFeaturedBouquets(): Bouquet[] {
  return [BOUQUET_CATALOGUE[0], BOUQUET_CATALOGUE[2], BOUQUET_CATALOGUE[5]];
}

/**
 * Creates a plain element node of the given tag carrying text content.
 *
 * @param tag the HTML tag name
 * @param text the text content to place inside the element
 * @returns a structured record describing the element
 */
function makeElement(tag: string, text: string): Record<string, unknown> {
  return { tag: tag, text: text, children: [], attributes: {} };
}

/**
 * Renders the Home page with hero, same-day banner, featured bouquets and trust signals.
 *
 * @returns the rendered Home page element
 */
// req-1
function renderHome(): HTMLElement {
  const root: HTMLElement = makeElement('section', '') as unknown as HTMLElement;
  const record: Record<string, unknown> = root as unknown as Record<string, unknown>;
  const children: unknown[] = [];
  children.push(makeElement('img', 'hero'));
  children.push(makeElement('p', 'Same-day delivery if ordered before 1pm'));
  const featured: Bouquet[] = getFeaturedBouquets();
  for (let i: number = 0; i < featured.length; i += 1) {
    const bouquet: Bouquet = featured[i];
    children.push(makeElement('article', bouquet.name + ' ' + formatGbp(bouquet.basePrice)));
  }
  children.push(makeElement('p', '25 years in business'));
  children.push(makeElement('p', '4.9 out of 5 review stars'));
  record.children = children;
  return root;
}

/**
 * Renders a catalogue grid of bouquets, substituting the empty state when none match.
 *
 * @param bouquets the bouquets to render in the grid
 * @returns the rendered grid element, or the empty state when the list is empty
 */
// req-2
function renderBouquetGrid(bouquets: Bouquet[]): HTMLElement {
  if (bouquets.length === 0) {
    return renderEmptyState();
  }
  const root: HTMLElement = makeElement('section', '') as unknown as HTMLElement;
  const record: Record<string, unknown> = root as unknown as Record<string, unknown>;
  const children: unknown[] = [];
  for (let i: number = 0; i < bouquets.length; i += 1) {
    const bouquet: Bouquet = bouquets[i];
    const sizeTexts: string[] = [];
    for (let j: number = 0; j < bouquet.sizes.length; j += 1) {
      const entry: SizePrice = bouquet.sizes[j];
      sizeTexts.push(entry.size + ' ' + formatGbp(entry.price));
    }
    const card: Record<string, unknown> = makeElement(
      'article',
      bouquet.name +
        ' base ' +
        formatGbp(bouquet.basePrice) +
        ' sizes ' +
        sizeTexts.join(', ') +
        ' palette ' +
        bouquet.palette.join(', ') +
        ' flowers ' +
        bouquet.flowers.join(', ') +
        ' occasions ' +
        bouquet.occasions.join(', ')
    );
    children.push(card);
  }
  record.children = children;
  return root;
}

/**
 * Renders the visible empty state shown when no bouquets match the active controls.
 *
 * @returns the rendered empty state element
 */
// req-4
function renderEmptyState(): HTMLElement {
  const root: HTMLElement = makeElement('div', 'No bouquets match your filters.') as unknown as HTMLElement;
  return root;
}

/**
 * Filters bouquets by occasion and price band; both criteria compose together.
 * Band boundaries are inclusive on their minimum and maximum edges.
 *
 * @param bouquets the source bouquets
 * @param occasion the optional occasion filter
 * @param priceBand the optional price band filter
 * @returns the bouquets satisfying every provided criterion
 */
// req-3
function filterBouquets(bouquets: Bouquet[], occasion?: Occasion, priceBand?: PriceBand): Bouquet[] {
  const result: Bouquet[] = [];
  for (let i: number = 0; i < bouquets.length; i += 1) {
    const bouquet: Bouquet = bouquets[i];
    if (occasion !== undefined) {
      let matchesOccasion: boolean = false;
      for (let j: number = 0; j < bouquet.occasions.length; j += 1) {
        if (bouquet.occasions[j] === occasion) {
          matchesOccasion = true;
        }
      }
      if (!matchesOccasion) {
        continue;
      }
    }
    if (priceBand !== undefined) {
      const min: number = PRICE_BAND_MIN[priceBand];
      const max: number = PRICE_BAND_MAX[priceBand];
      const price: number = bouquet.basePrice;
      if (price < min || price > max) {
        continue;
      }
    }
    result.push(bouquet);
  }
  return result;
}

/**
 * Sorts bouquets by base price in the given direction with a stable tie-break.
 *
 * @param bouquets the bouquets to sort
 * @param direction the sort direction, ascending or descending
 * @returns a new array sorted by base price, stable on equal prices
 */
// req-3
function sortBouquets(bouquets: Bouquet[], direction: 'asc' | 'desc'): Bouquet[] {
  const indexed: { bouquet: Bouquet; index: number }[] = [];
  for (let i: number = 0; i < bouquets.length; i += 1) {
    indexed.push({ bouquet: bouquets[i], index: i });
  }
  indexed.sort((a: { bouquet: Bouquet; index: number }, b: { bouquet: Bouquet; index: number }): number => {
    if (a.bouquet.basePrice === b.bouquet.basePrice) {
      return a.index - b.index;
    }
    if (direction === 'asc') {
      return a.bouquet.basePrice - b.bouquet.basePrice;
    }
    return b.bouquet.basePrice - a.bouquet.basePrice;
  });
  const result: Bouquet[] = [];
  for (let i: number = 0; i < indexed.length; i += 1) {
    result.push(indexed[i].bouquet);
  }
  return result;
}

/**
 * Selects a size for a bouquet and returns that size's price without a page reload.
 *
 * @param bouquet the bouquet whose size is changing
 * @param size the size to select
 * @returns the selected size and its two-decimal price
 */
// req-5
function selectBouquetSize(bouquet: Bouquet, size: BouquetSize): { price: number; size: BouquetSize } {
  let found: number | null = null;
  for (let i: number = 0; i < bouquet.sizes.length; i += 1) {
    if (bouquet.sizes[i].size === size) {
      found = bouquet.sizes[i].price;
      break;
    }
  }
  if (found === null) {
    const fallback: number = bouquet.basePrice;
    return { price: fallback, size: size };
  }
  return { price: found, size: size };
}

/**
 * Carries a chosen bouquet size into an enquiry draft for prefilling the form.
 *
 * @param size the chosen bouquet size
 * @returns the enquiry draft carrying the chosen size and its price
 */
// req-5
function carrySizeToEnquiry(size: BouquetSize): EnquiryDraft {
  let matched: number | null = null;
  for (let i: number = 0; i < BOUQUET_CATALOGUE.length; i += 1) {
    const sizes: SizePrice[] = BOUQUET_CATALOGUE[i].sizes;
    for (let j: number = 0; j < sizes.length; j += 1) {
      if (sizes[j].size === size) {
        matched = sizes[j].price;
        break;
      }
    }
    if (matched !== null) {
      break;
    }
  }
  return { size: size, sizePrice: matched };
}
export { renderHome, getFeaturedBouquets, renderBouquetGrid, filterBouquets, sortBouquets, renderEmptyState, selectBouquetSize, carrySizeToEnquiry };
