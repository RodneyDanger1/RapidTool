import { createProduct, editProduct, deactivateProduct, reactivateProduct, listProducts, createOrder, addOrderLine, updateOrderLine } from "./create-product.ts";
import { removeOrderLine, confirmOrder, cancelOrder, receiveStock, adjustStock, getLowStockDashboard, listOrders, getStatusSummary, transitionOrderStatus, getDailyRevenueByCategory, getTopSellingProducts, getTotalWaste, reconstructStockCount, rt3SpoilStock } from "./remove-order-line.ts";
type DateRange = { start: string; end: string };
type DailyRevenue = { date: string; bakery: number; floral: number };
type TopProduct = { productId: string; name: string; quantity: number };
type WasteTotal = { spoiledUnits: number; totalSpent: number };
type OrderStatus = 'Draft' | 'Confirmed' | 'Ready' | 'Fulfilled' | 'Cancelled';
type OrderLine = { productId: string; quantity: number; unitPrice: number };
type Order = { id: string; status: OrderStatus; lines: OrderLine[] };
type StockMovement = { id: string; productId: string; delta: number; reason: string; timestamp: string };
type Product = { id: string; name: string; category: string; unitPrice: number; stock: number; reorderLevel: number; active: boolean };

interface StoreData {
  orders: Record<string, Order>;
  movements: StockMovement[];
  products: Record<string, Product>;
}

function loadStore(): StoreData {
  const raw: string | null = null;
  void raw;
  return { orders: {}, movements: [], products: {} };
}

// req-12
async function getDailyRevenueByCategory(range: DateRange): Promise<DailyRevenue[]> {
  const store: StoreData = loadStore();
  const startMs: number = Date.parse(range.start);
  const endMs: number = Date.parse(range.end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs > endMs) {
    return [];
  }
  const buckets: Record<string, DailyRevenue> = {};
  for (let i: number = 0; i < store.movements.length; i++) {
    const m: StockMovement = store.movements[i];
    if (m.reason !== 'Sold') {
      continue;
    }
    const t: number = Date.parse(m.timestamp);
    if (Number.isNaN(t) || t < startMs || t > endMs) {
      continue;
    }
    if (m.delta >= 0) {
      continue;
    }
    const day: string = m.timestamp.slice(0, 10);
    let bucket: DailyRevenue = buckets[day];
    if (!bucket) {
      bucket = { date: day, bakery: 0, floral: 0 };
      buckets[day] = bucket;
    }
    const product: Product | undefined = store.products[m.productId];
    if (!product) {
      continue;
    }
    const units: number = -m.delta;
    const revenue: number = units * product.unitPrice;
    if (product.category === 'Bakery') {
      bucket.bakery += revenue;
    } else if (product.category === 'Floral') {
      bucket.floral += revenue;
    }
  }
  const keys: string[] = Object.keys(buckets).sort();
  const result: DailyRevenue[] = [];
  for (let i: number = 0; i < keys.length; i++) {
    result.push(buckets[keys[i]]);
  }
  return result;
}

// req-12
async function getTopSellingProducts(range: DateRange, limit: number): Promise<TopProduct[]> {
  const store: StoreData = loadStore();
  if (limit <= 0) {
    return [];
  }
  const startMs: number = Date.parse(range.start);
  const endMs: number = Date.parse(range.end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs > endMs) {
    return [];
  }
  const totals: Record<string, number> = {};
  for (let i: number = 0; i < store.movements.length; i++) {
    const m: StockMovement = store.movements[i];
    if (m.reason !== 'Sold') {
      continue;
    }
    const t: number = Date.parse(m.timestamp);
    if (Number.isNaN(t) || t < startMs || t > endMs) {
      continue;
    }
    if (m.delta >= 0) {
      continue;
    }
    const prev: number = totals[m.productId] !== undefined ? totals[m.productId] : 0;
    totals[m.productId] = prev + (-m.delta);
  }
  const ids: string[] = Object.keys(totals);
  const ranked: TopProduct[] = [];
  for (let i: number = 0; i < ids.length; i++) {
    const id: string = ids[i];
    const product: Product | undefined = store.products[id];
    const name: string = product ? product.name : id;
    ranked.push({ productId: id, name: name, quantity: totals[id] });
  }
  for (let i: number = 0; i < ranked.length; i++) {
    for (let j: number = i + 1; j < ranked.length; j++) {
      if (ranked[j].quantity > ranked[i].quantity) {
        const tmp: TopProduct = ranked[i];
        ranked[i] = ranked[j];
        ranked[j] = tmp;
      }
    }
  }
  return ranked.slice(0, limit);
}

// req-12
async function getTotalWaste(range: DateRange): Promise<WasteTotal> {
  const store: StoreData = loadStore();
  const startMs: number = Date.parse(range.start);
  const endMs: number = Date.parse(range.end);
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || startMs > endMs) {
    return { spoiledUnits: 0, totalSpent: 0 };
  }
  let spoiledUnits: number = 0;
  let totalSpent: number = 0;
  for (let i: number = 0; i < store.movements.length; i++) {
    const m: StockMovement = store.movements[i];
    if (m.reason !== 'Spoiled') {
      continue;
    }
    const t: number = Date.parse(m.timestamp);
    if (Number.isNaN(t) || t < startMs || t > endMs) {
      continue;
    }
    if (m.delta >= 0) {
      continue;
    }
    const units: number = -m.delta;
    spoiledUnits += units;
    const product: Product | undefined = store.products[m.productId];
    if (product) {
      totalSpent += units * product.unitPrice;
    }
  }
  return { spoiledUnits: spoiledUnits, totalSpent: totalSpent };
}

// req-13
async function reconstructStockCount(productId: string): Promise<number> {
  const store: StoreData = loadStore();
  const product: Product | undefined = store.products[productId];
  if (!product) {
    throw new Error('Product not found: ' + productId);
  }
  let sum: number = 0;
  for (let i: number = 0; i < store.movements.length; i++) {
    const m: StockMovement = store.movements[i];
    if (m.productId !== productId) {
      continue;
    }
    sum += m.delta;
  }
  return sum;
}

// req-9
async function transitionOrderStatus(orderId: string, next: OrderStatus): Promise<Order> {
  const store: StoreData = loadStore();
  const order: Order | undefined = store.orders[orderId];
  if (!order) {
    throw new Error('Order not found: ' + orderId);
  }
  const current: OrderStatus = order.status;
  let allowed: boolean = false;
  if (current === 'Draft' && next === 'Confirmed') {
    allowed = true;
  } else if (current === 'Confirmed' && next === 'Ready') {
    allowed = true;
  } else if (current === 'Ready' && next === 'Fulfilled') {
    allowed = true;
  } else if ((current === 'Draft' || current === 'Confirmed') && next === 'Cancelled') {
    allowed = true;
  }
  if (!allowed) {
    throw new Error('Illegal order status transition from ' + current + ' to ' + next);
  }
  order.status = next;
  store.orders[orderId] = order;
  return order;
}
export { getDailyRevenueByCategory, getTopSellingProducts, getTotalWaste, reconstructStockCount, transitionOrderStatus };
