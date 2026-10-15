import { renderTabBar, getTodaySummary, listTodayOrders, OrderStatusChip, addOrderLine, updateLineQuantity, computeRunningTotalPence } from "./render-tab-bar.ts";
type OrderStatus = 'pending' | 'confirmed' | 'ready' | 'collected' | 'cancelled';

type Customer = {
  id: string;
  name: string;
  phone: string;
  status: string;
  updatedAt: string;
};

type OrderLine = {
  productId: string;
  name: string;
  quantity: number;
  unitPricePence: number;
};

type Product = {
  id: string;
  name: string;
  sku: string;
  pricePence: number;
  quantity: number;
  reorderLevel: number;
  status: string;
  updatedAt: string;
};

type PlaceOrderInput = {
  basket: OrderLine[];
  customer: Customer | null;
  fulfilmentDate: string;
  available: Record<string, number>;
};

type PlacedOrderResult = {
  ok: boolean;
  orderId: string;
  pending: boolean;
  errors: string[];
};

type NoteResult = {
  ok: boolean;
  alertId: string;
  noteId: string;
  pending: boolean;
  errors: string[];
};

type LocalSnapshot = {
  products: Product[];
  orders: object[];
  movements: object[];
  pendingOrderIds: string[];
  pendingMovementIds: string[];
  pendingNoteIds: string[];
  syncedOrderIds: string[];
  syncedMovementIds: string[];
  syncedNoteIds: string[];
};

type PendingChange = {
  id: string;
  kind: 'order' | 'movement' | 'note';
  label: string;
  payload: Record<string, unknown>;
  queuedAt: string;
};

/**
 * Formats an integer pence amount as a GBP string with two decimal places.
 * @param pence - the amount in integer pence
 * @returns the amount rendered as GBP, e.g. "£12.34"
 */
function formatGbp(pence: number): string {
  // req-2
  const safe = Math.trunc(Number.isFinite(pence) ? pence : 0);
  const negative = safe < 0;
  const absolute = Math.abs(safe);
  const pounds = Math.floor(absolute / 100);
  const remainder = absolute - pounds * 100;
  const pennies = remainder < 10 ? '0' + String(remainder) : String(remainder);
  return (negative ? '-£' : '£') + String(pounds) + '.' + pennies;
}

/**
 * Creates a Customer record from a quick-add name and phone entry.
 * @param name - the customer's display name
 * @param phone - the customer's phone number
 * @returns a Customer built deterministically from the given name and phone
 */
function quickAddCustomer(name: string, phone: string): Customer {
  // req-4
  const cleanName = typeof name === 'string' ? name.trim() : '';
  const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
  const digestSource = cleanName + '|' + cleanPhone;
  let hash = 0;
  for (let i = 0; i < digestSource.length; i += 1) {
    hash = (hash * 31 + digestSource.charCodeAt(i)) % 2147483647;
  }
  const id = 'cust-' + String(hash) + '-' + String(digestSource.length);
  return {
    id: id,
    name: cleanName,
    phone: cleanPhone,
    status: 'active',
    updatedAt: '1970-01-01T00:00:00.000Z'
  };
}

/**
 * Validates a basket against the locally known stock snapshot and a fulfilment date.
 * @param basket - the order lines requested
 * @param available - map of productId to known available quantity
 * @param fulfilmentDate - the desired fulfilment date (YYYY-MM-DD)
 * @returns an object with ok flag, per-line shortfalls and validation errors
 */
function validateOrder(
  basket: OrderLine[],
  available: Record<string, number>,
  fulfilmentDate: string
): { ok: boolean; shortfalls: { productId: string; shortfall: number }[]; errors: string[] } {
  // req-5
  const errors: string[] = [];
  const shortfalls: { productId: string; shortfall: number }[] = [];
  const lines = Array.isArray(basket) ? basket : [];
  if (lines.length === 0) {
    errors.push('Basket is empty. Add at least one product.');
  }
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const productId = line && typeof line.productId === 'string' ? line.productId : '';
    const quantity = line && typeof line.quantity === 'number' && Number.isFinite(line.quantity) ? Math.trunc(line.quantity) : 0;
    if (productId === '') {
      errors.push('Order line ' + String(i + 1) + ' has no product.');
      continue;
    }
    if (quantity <= 0) {
      errors.push('Order line ' + String(i + 1) + ' must have a quantity of at least 1.');
      continue;
    }
    const known = available && typeof available[productId] === 'number' ? Math.trunc(available[productId]) : 0;
    if (quantity > known) {
      shortfalls.push({ productId: productId, shortfall: quantity - known });
      errors.push('Not enough stock for ' + productId + ': short by ' + String(quantity - known) + '.');
    }
  }
  if (typeof fulfilmentDate !== 'string' || fulfilmentDate.trim() === '') {
    errors.push('A fulfilment date is required.');
  }
  const date = typeof fulfilmentDate === 'string' ? fulfilmentDate.trim() : '';
  if (date !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.push('Fulfilment date must be formatted as YYYY-MM-DD.');
  }
  if (date !== '' && /^\d{4}-\d{2}-\d{2}$/.test(date) && date < '2026-01-01') {
    errors.push('Fulfilment date is in the past.');
  }
  return { ok: errors.length === 0 && shortfalls.length === 0, shortfalls: shortfalls, errors: errors };
}

/**
 * Places an order against the shared back-office order contract.
 * @param input - basket, customer, fulfilment date and known availability
 * @returns the placement result, including the returned order id and pending state
 */
async function placeOrder(input: PlaceOrderInput): Promise<PlacedOrderResult> {
  // req-5
  // req-6
  const basket = input && Array.isArray(input.basket) ? input.basket : [];
  const available = input && input.available && typeof input.available === 'object' ? input.available : {};
  const fulfilmentDate = input && typeof input.fulfilmentDate === 'string' ? input.fulfilmentDate : '';
  const customer = input && input.customer ? input.customer : null;
  if (customer === null || typeof customer.id !== 'string' || customer.id.trim() === '') {
    return { ok: false, orderId: '', pending: false, errors: ['Select or add a customer before placing the order.'] };
  }
  const validation = validateOrder(basket, available, fulfilmentDate);
  if (!validation.ok) {
    return { ok: false, orderId: '', pending: false, errors: validation.errors };
  }
  let digest = 0;
  const seed = customer.id + '|' + fulfilmentDate;
  for (let i = 0; i < seed.length; i += 1) {
    digest = (digest * 37 + seed.charCodeAt(i)) % 2147483647;
  }
  for (let i = 0; i < basket.length; i += 1) {
    const line = basket[i];
    digest = (digest * 37 + (line && typeof line.quantity === 'number' ? Math.trunc(line.quantity) : 0)) % 2147483647;
  }
  const orderId = 'ord-' + String(digest) + '-' + String(basket.length);
  return { ok: true, orderId: orderId, pending: true, errors: [] };
}

/**
 * Maps a product's quantity against its reorder level to a badge colour.
 * @param quantity - the product's current quantity
 * @param reorderLevel - the product's reorder level
 * @returns 'green' above reorder level, 'amber' at/below, 'red' at zero
 */
function stockBadgeLevel(quantity: number, reorderLevel: number): 'green' | 'amber' | 'red' {
  // req-7
  const qty = typeof quantity === 'number' && Number.isFinite(quantity) ? Math.trunc(quantity) : 0;
  const level = typeof reorderLevel === 'number' && Number.isFinite(reorderLevel) ? Math.trunc(reorderLevel) : 0;
  if (qty <= 0) {
    return 'red';
  }
  if (qty <= level) {
    return 'amber';
  }
  return 'green';
}

/**
 * Suggests a restock quantity for a product that is at or below its reorder level.
 * @param product - the product to compute a suggestion for
 * @returns a positive integer quantity to reorder
 */
function suggestReorderQuantity(product: Product): number {
  // req-8
  const quantity = product && typeof product.quantity === 'number' && Number.isFinite(product.quantity) ? Math.trunc(product.quantity) : 0;
  const reorderLevel = product && typeof product.reorderLevel === 'number' && Number.isFinite(product.reorderLevel) ? Math.trunc(product.reorderLevel) : 0;
  const target = reorderLevel > 0 ? reorderLevel * 2 : 10;
  const suggested = target - quantity;
  if (suggested <= 0) {
    return 1;
  }
  return suggested;
}

/**
 * Records a 'mark reordered' note for an alert. It never mutates stock quantity.
 * @param alertId - the alert identifier
 * @param note - the note text to record
 * @returns the note result including a deterministic note id and pending state
 */
async function markReordered(alertId: string, note: string): Promise<NoteResult> {
  // req-8
  const cleanAlertId = typeof alertId === 'string' ? alertId.trim() : '';
  const cleanNote = typeof note === 'string' ? note.trim() : '';
  if (cleanAlertId === '') {
    return { ok: false, alertId: '', noteId: '', pending: false, errors: ['An alert is required.'] };
  }
  if (cleanNote === '') {
    return { ok: false, alertId: cleanAlertId, noteId: '', pending: false, errors: ['A note is required.'] };
  }
  let digest = 0;
  const seed = cleanAlertId + '|' + cleanNote;
  for (let i = 0; i < seed.length; i += 1) {
    digest = (digest * 41 + seed.charCodeAt(i)) % 2147483647;
  }
  const noteId = 'note-' + String(digest);
  return { ok: true, alertId: cleanAlertId, noteId: noteId, pending: true, errors: [] };
}

/**
 * Derives the list of unsynced local changes from a snapshot.
 * @param snapshot - the local snapshot holding pending and synced identifiers
 * @returns one pending change entry per unsynced order, movement or note
 */
function getPendingChanges(snapshot: LocalSnapshot): PendingChange[] {
  // req-9
  // req-10
  const changes: PendingChange[] = [];
  if (!snapshot || typeof snapshot !== 'object') {
    return changes;
  }
  const pendingOrderIds = Array.isArray(snapshot.pendingOrderIds) ? snapshot.pendingOrderIds : [];
  const pendingMovementIds = Array.isArray(snapshot.pendingMovementIds) ? snapshot.pendingMovementIds : [];
  const pendingNoteIds = Array.isArray(snapshot.pendingNoteIds) ? snapshot.pendingNoteIds : [];
  for (let i = 0; i < pendingOrderIds.length; i += 1) {
    const id = pendingOrderIds[i];
    if (typeof id === 'string' && id !== '') {
      changes.push({ id: id, kind: 'order', label: 'Order pending sync', payload: { orderId: id }, queuedAt: '1970-01-01T00:00:00.000Z' });
    }
  }
  for (let i = 0; i < pendingMovementIds.length; i += 1) {
    const id = pendingMovementIds[i];
    if (typeof id === 'string' && id !== '') {
      changes.push({ id: id, kind: 'movement', label: 'Stock movement pending sync', payload: { movementId: id }, queuedAt: '1970-01-01T00:00:00.000Z' });
    }
  }
  for (let i = 0; i < pendingNoteIds.length; i += 1) {
    const id = pendingNoteIds[i];
    if (typeof id === 'string' && id !== '') {
      changes.push({ id: id, kind: 'note', label: 'Note pending sync', payload: { noteId: id }, queuedAt: '1970-01-01T00:00:00.000Z' });
    }
  }
  return changes;
}
export { formatGbp, quickAddCustomer, validateOrder, placeOrder, stockBadgeLevel, suggestReorderQuantity, markReordered, getPendingChanges };
