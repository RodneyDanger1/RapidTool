import { listProducts, createProduct, editProduct, deactivateProduct, createOrder, computeLineTotal, computeOrderTotal, confirmOrder } from "./list-products.ts";
import { cancelOrder, transitionOrderStatus, receiveStock, adjustStock, reconstructStock, checkStockInvariant, getLowStockDashboard, listOrders } from "./cancel-order.ts";
type ProductId = string;
type OrderStatus = 'Draft' | 'Confirmed' | 'Ready' | 'Fulfilled' | 'Cancelled';

interface OrderLineRecord {
  productId: ProductId;
  quantity: number;
  unitPrice: number;
  category: string;
}

interface OrderRecord {
  id: string;
  customer: string;
  createdAt: string;
  fulfilmentDate: string;
  status: OrderStatus;
  lines: OrderLineRecord[];
  total: number;
}

interface StockMovementRecord {
  id: string;
  productId: ProductId;
  delta: number;
  reason: string;
  timestamp: string;
  resultingCount: number;
}

interface CbReportStore {
  orders: OrderRecord[];
  movements: StockMovementRecord[];
}

/**
 * Deterministically parse an ISO-8601 date-time string or a
 * YYYY-MM-DD date string into epoch milliseconds. Returns NaN when
 * the input cannot be interpreted.
 *
 * @param value - ISO date or date-time string.
 * @returns epoch milliseconds, or NaN when unparseable.
 */
function cbParseTime(value: string): number {
  if (typeof value !== 'string') {
    return NaN;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return NaN;
  }
  if (trimmed.length === 10) {
    return Date.parse(trimmed + 'T00:00:00.000Z');
  }
  return Date.parse(trimmed);
}

/**
 * Determine whether an order falls inside the inclusive [from, to]
 * epoch-millisecond window. Both boundaries are inclusive.
 *
 * @param order - the order record.
 * @param fromMs - inclusive lower bound in epoch milliseconds.
 * @param toMs - inclusive upper bound in epoch milliseconds.
 * @returns true when the order timestamp is in range.
 */
function cbOrderInRange(order: OrderRecord, fromMs: number, toMs: number): boolean {
  const t = cbParseTime(order.createdAt);
  if (Number.isNaN(t)) {
    return false;
  }
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    return false;
  }
  return t >= fromMs && t <= toMs;
}

/**
 * Convert an order's created-at timestamp into the YYYY-MM-DD bucket
 * key used by the daily revenue report. Returns an empty string when
 * the timestamp is unparseable.
 *
 * @param value - ISO date-time string.
 * @returns the YYYY-MM-DD date bucket, or an empty string.
 */
function cbDayBucket(value: string): string {
  const t = cbParseTime(value);
  if (Number.isNaN(t)) {
    return '';
  }
  return new Date(t).toISOString().slice(0, 10);
}

/**
 * Deterministically sort an array of daily revenue rows by date,
 * ascending, using a stable string comparison.
 *
 * @param rows - mutable array of daily revenue rows.
 * @returns the same array, sorted in place.
 */
function cbSortByDateAsc(rows: Array<{ date: string; Bakery: number; Floral: number }>): Array<{ date: string; Bakery: number; Floral: number }> {
  return rows.sort((a, b) => {
    if (a.date < b.date) {
      return -1;
    }
    if (a.date > b.date) {
      return 1;
    }
    return 0;
  });
}

/**
 * Count orders per status across the optionally date-filtered order
 * set. Only Fulfilled orders contribute revenue elsewhere, but the
 * summary counts every status.
 *
 * req-9
 *
 * @param filter - optional inclusive from/to ISO date range.
 * @returns a record mapping each OrderStatus to its count.
 */
function countOrdersByStatus(filter: { from?: string; to?: string }): Record<OrderStatus, number> {
  const result: Record<OrderStatus, number> = {
    Draft: 0,
    Confirmed: 0,
    Ready: 0,
    Fulfilled: 0,
    Cancelled: 0
  };
  const store: CbReportStore = cbReportLoadState();
  const orders: OrderRecord[] = store.orders;
  const fromMs = filter && typeof filter.from === 'string' ? cbParseTime(filter.from) : NaN;
  const toMs = filter && typeof filter.to === 'string' ? cbParseTime(filter.to) : NaN;
  const hasFrom = !Number.isNaN(fromMs);
  const hasTo = !Number.isNaN(toMs);
  if (hasFrom && hasTo && fromMs > toMs) {
    return result;
  }
  for (let i = 0; i < orders.length; i = i + 1) {
    const order = orders[i];
    let inRange = true;
    if (hasFrom || hasTo) {
      const t = cbParseTime(order.createdAt);
      if (Number.isNaN(t)) {
        inRange = false;
      } else {
        if (hasFrom && t < fromMs) {
          inRange = false;
        }
        if (hasTo && t > toMs) {
          inRange = false;
        }
      }
    }
    if (!inRange) {
      continue;
    }
    const status = order.status;
    if (result[status] === undefined) {
      continue;
    }
    result[status] = result[status] + 1;
  }
  return result;
}

/**
 * Aggregate daily revenue in integer pence, split by product category
 * (Bakery vs Floral). Revenue is derived from Fulfilled orders whose
 * created-at falls inside the inclusive [from, to] range, using each
 * line's captured unit price and quantity.
 *
 * req-10
 *
 * @param range - inclusive ISO date range (from, to).
 * @returns an array of daily revenue rows sorted by date ascending.
 */
function getDailyRevenueByCategory(range: { from: string; to: string }): Array<{ date: string; Bakery: number; Floral: number }> {
  const buckets: { [key: string]: { date: string; Bakery: number; Floral: number } } = {};
  const store: CbReportStore = cbReportLoadState();
  const orders: OrderRecord[] = store.orders;
  const fromMs = range && typeof range.from === 'string' ? cbParseTime(range.from) : NaN;
  const toMs = range && typeof range.to === 'string' ? cbParseTime(range.to) : NaN;
  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs > toMs) {
    return [];
  }
  for (let i = 0; i < orders.length; i = i + 1) {
    const order = orders[i];
    if (order.status !== 'Fulfilled') {
      continue;
    }
    if (!cbOrderInRange(order, fromMs, toMs)) {
      continue;
    }
    const day = cbDayBucket(order.createdAt);
    if (day.length === 0) {
      continue;
    }
    let bucket = buckets[day];
    if (bucket === undefined) {
      bucket = { date: day, Bakery: 0, Floral: 0 };
      buckets[day] = bucket;
    }
    const lines = order.lines;
    for (let j = 0; j < lines.length; j = j + 1) {
      const line = lines[j];
      const lineTotal = line.unitPrice * line.quantity;
      if (line.category === 'Bakery') {
        bucket.Bakery = bucket.Bakery + lineTotal;
      } else if (line.category === 'Floral') {
        bucket.Floral = bucket.Floral + lineTotal;
      }
    }
  }
  const keys = Object.keys(buckets);
  const rows: Array<{ date: string; Bakery: number; Floral: number }> = [];
  for (let k = 0; k < keys.length; k = k + 1) {
    rows.push(buckets[keys[k]]);
  }
  return cbSortByDateAsc(rows);
}

/**
 * Sum sold quantities per product across Fulfilled orders inside the
 * inclusive [from, to] date range, ordered by quantity sold descending
 * with product id as a deterministic tie-breaker.
 *
 * req-10
 *
 * @param range - inclusive ISO date range (from, to).
 * @returns an array of { productId, quantitySold } rows.
 */
function getTopSellingProducts(range: { from: string; to: string }): Array<{ productId: ProductId; quantitySold: number }> {
  const store: CbReportStore = cbReportLoadState();
  const orders: OrderRecord[] = store.orders;
  const fromMs = range && typeof range.from === 'string' ? cbParseTime(range.from) : NaN;
  const toMs = range && typeof range.to === 'string' ? cbParseTime(range.to) : NaN;
  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs > toMs) {
    return [];
  }
  const totals: { [key: string]: number } = {};
  for (let i = 0; i < orders.length; i = i + 1) {
    const order = orders[i];
    if (order.status !== 'Fulfilled') {
      continue;
    }
    if (!cbOrderInRange(order, fromMs, toMs)) {
      continue;
    }
    const lines = order.lines;
    for (let j = 0; j < lines.length; j = j + 1) {
      const line = lines[j];
      const key = line.productId;
      const existing = totals[key];
      if (existing === undefined) {
        totals[key] = line.quantity;
      } else {
        totals[key] = existing + line.quantity;
      }
    }
  }
  const keys = Object.keys(totals);
  const rows: Array<{ productId: ProductId; quantitySold: number }> = [];
  for (let k = 0; k < keys.length; k = k + 1) {
    rows.push({ productId: keys[k], quantitySold: totals[keys[k]] });
  }
  rows.sort((a, b) => {
    if (b.quantitySold !== a.quantitySold) {
      return b.quantitySold - a.quantitySold;
    }
    if (a.productId < b.productId) {
      return -1;
    }
    if (a.productId > b.productId) {
      return 1;
    }
    return 0;
  });
  return rows;
}

/**
 * Sum the units lost to spoilage (absolute value of Spoiled movement
 * deltas) across the inclusive [from, to] date range, derived from the
 * append-only movement log rather than mutable counters.
 *
 * req-10
 *
 * @param range - inclusive ISO date range (from, to).
 * @returns total spoiled units as a non-negative integer.
 */
function getTotalWaste(range: { from: string; to: string }): number {
  const store: CbReportStore = cbReportLoadState();
  const movements: StockMovementRecord[] = store.movements;
  const fromMs = range && typeof range.from === 'string' ? cbParseTime(range.from) : NaN;
  const toMs = range && typeof range.to === 'string' ? cbParseTime(range.to) : NaN;
  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs > toMs) {
    return 0;
  }
  let total = 0;
  for (let i = 0; i < movements.length; i = i + 1) {
    const movement = movements[i];
    if (movement.reason !== 'Spoiled') {
      continue;
    }
    const t = cbParseTime(movement.timestamp);
    if (Number.isNaN(t)) {
      continue;
    }
    if (t < fromMs || t > toMs) {
      continue;
    }
    const delta = movement.delta;
    if (delta < 0) {
      total = total - delta;
    } else {
      total = total + delta;
    }
  }
  return total;
}
export { countOrdersByStatus, getDailyRevenueByCategory, getTopSellingProducts, getTotalWaste };
