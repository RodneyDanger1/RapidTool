import { computeOpenStatus, getTodayHighlights } from "./compute-open-status.ts";
type Category = 'Breads' | 'Pastries' | 'Cakes' | 'Drinks';
type Allergen = 'gluten' | 'dairy' | 'nuts' | 'egg' | 'vegan';

type MenuItem = {
  id: string;
  name: string;
  description: string;
  priceGBP: number;
  category: Category;
  allergens: Allergen[];
};

type HoursRow = { open: string; close: string };

type OpeningHoursTable = Record<string, HoursRow | null>;

type OrderInput = {
  name: string;
  phone: string;
  email: string;
  pickupDate: string;
  product: string;
  quantity: number;
  notes: string;
};

type OrderConfirmation = {
  reference: string;
  order: OrderInput;
  totalGBP: number;
  showTotal: boolean;
  confirmedAt: string;
};

const BAKERY_CATEGORIES: Category[] = ['Breads', 'Pastries', 'Cakes', 'Drinks'];
const BAKERY_ALLERGENS: Allergen[] = ['gluten', 'dairy', 'nuts', 'egg', 'vegan'];

// req-3
/**
 * Format a numeric amount as a GBP price string with exactly two decimals.
 * @param amount - the amount in pounds
 * @returns the amount formatted in GBP with two decimal places
 */
function formatGBP(amount: number): string {
  const safe = typeof amount === 'number' && isFinite(amount) ? amount : 0;
  return '£' + safe.toFixed(2);
}

// req-9
/**
 * Compute the total order price from a unit price and a quantity.
 * @param unitPriceGBP - the price per unit in pounds
 * @param quantity - the number of units ordered
 * @returns the line total in pounds
 */
function computeOrderTotal(unitPriceGBP: number, quantity: number): number {
  const price = typeof unitPriceGBP === 'number' && isFinite(unitPriceGBP) ? unitPriceGBP : 0;
  const qty = typeof quantity === 'number' && isFinite(quantity) ? quantity : 0;
  return Math.round(price * qty * 100) / 100;
}

// req-6
/**
 * Generate a human-readable order reference of the form GC-YYYY-NNNN for the
 * given submission time. The sequence is deterministically derived from the
 * submission timestamp so identical times yield identical references and
 * distinct times yield distinct references.
 * @param now - the submission time
 * @returns the order reference string
 */
function generateOrderReference(now: Date): string {
  const year = now.getFullYear();
  const seqSource = now.getTime();
  const seq = Math.abs(Math.floor(seqSource % 10000));
  const padded = String(seq).padStart(4, '0');
  return 'GC-' + String(year) + '-' + padded;
}

// req-7
/**
 * Validate an order input, returning per-field errors keyed by field name.
 * Rejects a missing contact method, a pickup date under 48 hours ahead or
 * unparseable, and a quantity below 1.
 * @param input - the order input to validate
 * @returns whether the input is valid and any field-level errors
 */
function validateOrder(input: OrderInput): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  const phone = typeof input.phone === 'string' ? input.phone.trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  if (phone.length === 0 && email.length === 0) {
    errors.contact = 'Please provide either a phone number or an email address so we can confirm your order.';
  }

  const rawDate = typeof input.pickupDate === 'string' ? input.pickupDate.trim() : '';
  if (rawDate.length === 0) {
    errors.pickupDate = 'Please choose a pickup date and time.';
  } else {
    const pickup = new Date(rawDate);
    if (isNaN(pickup.getTime())) {
      errors.pickupDate = 'Please enter a valid pickup date and time.';
    } else {
      const nowSeries = new Date();
      const minimum = nowSeries.getTime() + 48 * 60 * 60 * 1000;
      if (pickup.getTime() < minimum) {
        errors.pickupDate = 'Pickup must be at least 48 hours from now.';
      }
    }
  }

  const quantity = input.quantity;
  if (typeof quantity !== 'number' || !isFinite(quantity) || quantity < 1) {
    errors.quantity = 'Please order a quantity of at least 1.';
  }

  return { valid: Object.keys(errors).length === 0, errors: errors };
}

// req-6
/**
 * Submit a validated order, resolving an OrderConfirmation with a generated
 * GC-YYYY-NNNN reference, the echoed order, and a two-decimal total.
 * @param input - the order input to submit
 * @returns a promise resolving to the order confirmation
 */
async function submitOrder(input: OrderInput): Promise<OrderConfirmation> {
  const now = new Date();
  const reference = generateOrderReference(now);
  const quantity = typeof input.quantity === 'number' && isFinite(input.quantity) ? input.quantity : 0;
  const unitPrice = 0;
  const total = computeOrderTotal(unitPrice, quantity);
  const normalized: OrderInput = {
    name: typeof input.name === 'string' ? input.name : '',
    phone: typeof input.phone === 'string' ? input.phone.trim() : '',
    email: typeof input.email === 'string' ? input.email.trim() : '',
    pickupDate: typeof input.pickupDate === 'string' ? input.pickupDate : '',
    product: typeof input.product === 'string' ? input.product : '',
    quantity: quantity,
    notes: typeof input.notes === 'string' ? input.notes.trim() : ''
  };
  const confirmation: OrderConfirmation = {
    reference: reference,
    order: normalized,
    totalGBP: total,
    showTotal: quantity > 1,
    confirmedAt: now.toISOString()
  };
  return confirmation;
}

// req-4
/**
 * Filter menu items by category, allergen, and a case-insensitive free-text
 * query over name and description, combining all active filters with AND
 * semantics.
 * @param items - the full menu item list
 * @param filters - the active filters
 * @returns the items matching every active filter
 */
function filterMenuItems(
  items: MenuItem[],
  filters: { category?: Category; allergen?: Allergen; query?: string }
): MenuItem[] {
  const safeItems = Array.isArray(items) ? items : [];
  const categoryFilter = filters && typeof filters.category === 'string' ? filters.category : undefined;
  const allergenFilter = filters && typeof filters.allergen === 'string' ? filters.allergen : undefined;
  const queryRaw = filters && typeof filters.query === 'string' ? filters.query : '';
  const query = queryRaw.trim().toLowerCase();

  return safeItems.filter(function (item: MenuItem): boolean {
    if (categoryFilter !== undefined && item.category !== categoryFilter) {
      return false;
    }
    if (allergenFilter !== undefined) {
      const tags = Array.isArray(item.allergens) ? item.allergens : [];
      if (tags.indexOf(allergenFilter) === -1) {
        return false;
      }
    }
    if (query.length > 0) {
      const name = typeof item.name === 'string' ? item.name.toLowerCase() : '';
      const description = typeof item.description === 'string' ? item.description.toLowerCase() : '';
      if (name.indexOf(query) === -1 && description.indexOf(query) === -1) {
        return false;
      }
    }
    return true;
  });
}

// req-3
/**
 * Group menu items by their four categories, always returning a keyed record
 * with an array for every category.
 * @param items - the menu item list to group
 * @returns a record of items keyed by category
 */
function groupMenuByCategory(items: MenuItem[]): Record<Category, MenuItem[]> {
  const safeItems = Array.isArray(items) ? items : [];
  const grouped: Record<Category, MenuItem[]> = {
    Breads: [],
    Pastries: [],
    Cakes: [],
    Drinks: []
  };
  for (let i = 0; i < safeItems.length; i++) {
    const item = safeItems[i];
    const category = item.category;
    if (category === 'Breads' || category === 'Pastries' || category === 'Cakes' || category === 'Drinks') {
      grouped[category].push(item);
    }
  }
  return grouped;
}

// req-2
/**
 * Render the Open/Closed badge markup from the shared hours table and the
 * current time, deriving Open/Closed from the single hours source of truth.
 * @param hours - the shared opening-hours table
 * @param now - the current time
 * @returns the badge as an HTML string
 */
function renderOpenBadge(hours: OpeningHoursTable, now: Date): string {
  const table = hours && typeof hours === 'object' ? hours : {};
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayKey = dayNames[now.getDay()];
  const row = table[dayKey];
  let label: string;
  if (!row) {
    label = 'Closed';
  } else {
    const open = parseClockMinutes(row.open);
    const close = parseClockMinutes(row.close);
    if (open === null || close === null) {
      label = 'Closed';
    } else {
      const minutes = now.getHours() * 60 + now.getMinutes();
      let isOpen: boolean;
      if (close > open) {
        isOpen = minutes >= open && minutes < close;
      } else if (close < open) {
        isOpen = minutes >= open || minutes < close;
      } else {
        isOpen = false;
      }
      label = isOpen ? 'Open' : 'Closed';
    }
  }
  const cls = label === 'Open' ? 'badge badge--open' : 'badge badge--closed';
  return '<span class="' + cls + '" role="status" aria-live="polite">' + label + '</span>';
}

/**
 * Parse a clock string such as "07:30" into minutes since midnight.
 * @param value - the clock string
 * @returns the minutes since midnight or null when unparseable
 */
function parseClockMinutes(value: string): number | null {
  if (typeof value !== 'string') {
    return null;
  }
  const parts = value.trim().split(':');
  if (parts.length !== 2) {
    return null;
  }
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!isFinite(h) || !isFinite(m)) {
    return null;
  }
  if (h < 0 || h > 23 || m < 0 || m > 59) {
    return null;
  }
  return h * 60 + m;
}
export { renderOpenBadge, filterMenuItems, groupMenuByCategory, formatGBP, computeOrderTotal, validateOrder, generateOrderReference, submitOrder };
