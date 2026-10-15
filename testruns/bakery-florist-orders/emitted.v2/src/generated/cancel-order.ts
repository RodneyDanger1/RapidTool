import { listProducts, createProduct, editProduct, deactivateProduct, createOrder, computeLineTotal, computeOrderTotal, confirmOrder } from "./list-products.ts";
type ProductId = string;
type OrderId = string;
type OrderStatus = 'Draft' | 'Confirmed' | 'Ready' | 'Fulfilled' | 'Cancelled';
type ProductCategory = 'Bakery' | 'Floral';
type ProductUnit = 'each' | 'dozen' | 'bunch' | 'box';
type MovementReason = 'Received' | 'Sold' | 'Spoiled' | 'Adjustment';

interface Product {
  id: ProductId;
  name: string;
  category: ProductCategory;
  unitPrice: number;
  unit: ProductUnit;
  stock: number;
  reorderLevel: number;
  allergens: string[];
  stemCount: number;
  active: boolean;
}

interface OrderLine {
  productId: ProductId;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

interface Order {
  id: OrderId;
  customerId: string;
  customerName: string;
  createdAt: string;
  fulfilmentDate: string;
  status: OrderStatus;
  lines: OrderLine[];
  total: number;
}

interface StockMovement {
  id: string;
  productId: ProductId;
  delta: number;
  reason: MovementReason;
  timestamp: string;
  resultingCount: number;
}

interface LowStockEntry {
  product: Product;
  shortfall: number;
  suggestedReorder: number;
}

interface StockInvariant {
  ok: boolean;
  stored: number;
  reconstructed: number;
}

interface SimpleResult<T> {
  ok: boolean;
  value?: T;
  reason?: string;
}

interface PersistedState {
  products: Product[];
  orders: Order[];
  movements: StockMovement[];
  seq: number;
}

var cbState: PersistedState = { products: [], orders: [], movements: [], seq: 1 };
var cbStateLoaded: boolean = false;

function cbLoadState(): PersistedState {
  if (!cbStateLoaded) {
    cbStateLoaded = true;
  }
  return cbState;
}

function cbSaveState(state: PersistedState): boolean {
  cbState = state;
  cbStateLoaded = true;
  return true;
}

function cbNextId(prefix: string): string {
  const state = cbLoadState();
  const id = prefix + '-' + String(state.seq);
  state.seq = state.seq + 1;
  cbSaveState(state);
  return id;
}

function cbTick(base: number): string {
  const state = cbLoadState();
  const ms = Date.UTC(2024, 0, 1) + (state.seq * 1000) + base;
  return new Date(ms).toISOString();
}

function cbFindProduct(productId: ProductId): Product | undefined {
  const state = cbLoadState();
  let i = 0;
  while (i < state.products.length) {
    if (state.products[i].id === productId) {
      return state.products[i];
    }
    i = i + 1;
  }
  return undefined;
}

function cbFindOrder(orderId: OrderId): Order | undefined {
  const state = cbLoadState();
  let i = 0;
  while (i < state.orders.length) {
    if (state.orders[i].id === orderId) {
      return state.orders[i];
    }
    i = i + 1;
  }
  return undefined;
}

function cbMovementsFor(productId: ProductId): StockMovement[] {
  const state = cbLoadState();
  const out: StockMovement[] = [];
  let i = 0;
  while (i < state.movements.length) {
    if (state.movements[i].productId === productId) {
      out.push(state.movements[i]);
    }
    i = i + 1;
  }
  return out;
}

function cbWriteMovement(productId: ProductId, delta: number, reason: MovementReason, resultingCount: number): SimpleResult<StockMovement> {
  const state = cbLoadState();
  const movement: StockMovement = {
    id: cbNextId('mv'),
    productId: productId,
    delta: delta,
    reason: reason,
    timestamp: cbTick(0),
    resultingCount: resultingCount,
  };
  state.movements.push(movement);
  const persisted = cbSaveState(state);
  if (!persisted) {
    state.movements.pop();
    cbSaveState(state);
    return { ok: false, reason: 'persistence failure writing stock movement' };
  }
  return { ok: true, value: movement };
}

function cbSetStock(product: Product, next: number): boolean {
  const state = cbLoadState();
  let i = 0;
  let found: Product | undefined = undefined;
  while (i < state.products.length) {
    if (state.products[i].id === product.id) {
      found = state.products[i];
      break;
    }
    i = i + 1;
  }
  if (!found) {
    return false;
  }
  found.stock = next;
  return cbSaveState(state);
}

/**
 * Cancel a Draft or Confirmed order, restoring stock for each line and
 * appending a restoring stock movement. Ready, Fulfilled and Cancelled orders
 * cannot be cancelled (req-4, req-5, req-7).
 */
// req-4 // req-5
function cancelOrder(id: OrderId): { ok: true; order: Order } | { ok: false; reason: string } {
  const order = cbFindOrder(id);
  if (!order) {
    return { ok: false, reason: 'order not found: ' + id };
  }
  if (order.status === 'Ready' || order.status === 'Fulfilled' || order.status === 'Cancelled') {
    return { ok: false, reason: 'cannot cancel order in status ' + order.status };
  }
  let i = 0;
  while (i < order.lines.length) {
    const line = order.lines[i];
    const product = cbFindProduct(line.productId);
    if (product) {
      const next = product.stock + line.quantity;
      const moved = cbWriteMovement(product.id, line.quantity, 'Sold', next);
      if (!moved.ok) {
        return { ok: false, reason: 'failed to write stock movement for ' + product.id };
      }
      const saved = cbSetStock(product, next);
      if (!saved) {
        return { ok: false, reason: 'failed to persist stock for ' + product.id };
      }
    }
    i = i + 1;
  }
  order.status = 'Cancelled';
  const state = cbLoadState();
  const ok = cbSaveState(state);
  if (!ok) {
    return { ok: false, reason: 'failed to persist order status' };
  }
  return { ok: true, order: order };
}

/**
 * Enforce the constrained order status machine:
 * Draft -> Confirmed -> Ready -> Fulfilled and Draft/Confirmed -> Cancelled
 * (req-5). Any other transition is refused with the from/to statuses named.
 */
// req-5
function transitionOrderStatus(id: OrderId, to: OrderStatus): { ok: true; order: Order } | { ok: false; reason: string } {
  const order = cbFindOrder(id);
  if (!order) {
    return { ok: false, reason: 'order not found: ' + id };
  }
  const from = order.status;
  let allowed = false;
  if (from === 'Draft' && to === 'Confirmed') {
    allowed = true;
  } else if (from === 'Confirmed' && to === 'Ready') {
    allowed = true;
  } else if (from === 'Ready' && to === 'Fulfilled') {
    allowed = true;
  } else if ((from === 'Draft' || from === 'Confirmed') && to === 'Cancelled') {
    allowed = true;
  }
  if (!allowed) {
    return { ok: false, reason: 'illegal transition from ' + from + ' to ' + to };
  }
  if (to === 'Cancelled') {
    return cancelOrder(id);
  }
  order.status = to;
  const state = cbLoadState();
  const saved = cbSaveState(state);
  if (!saved) {
    return { ok: false, reason: 'failed to persist order status' };
  }
  return { ok: true, order: order };
}

/**
 * Receive stock for a product: increments the count and appends a Received
 * movement whose resulting count is recorded (req-6, req-7).
 */
// req-6
function receiveStock(input: { productId: ProductId; quantity: number }): StockMovement {
  const product = cbFindProduct(input.productId);
  if (!product) {
    throw new Error('product not found: ' + input.productId);
  }
  if (typeof input.quantity !== 'number' || !isFinite(input.quantity) || Math.floor(input.quantity) !== input.quantity) {
    throw new Error('quantity must be an integer');
  }
  if (input.quantity < 0) {
    throw new Error('quantity must not be negative');
  }
  const next = product.stock + input.quantity;
  const moved = cbWriteMovement(product.id, input.quantity, 'Received', next);
  if (!moved.ok || !moved.value) {
    throw new Error(moved.reason || 'failed to write received movement');
  }
  const saved = cbSetStock(product, next);
  if (!saved) {
    throw new Error('failed to persist stock for ' + product.id);
  }
  return moved.value;
}

/**
 * Manual stock adjustment requiring a non-empty reason: appends an Adjustment
 * movement and refuses any change that would drive stock negative (req-6,
 * req-7).
 */
// req-6 // req-7
function adjustStock(input: { productId: ProductId; delta: number; reason: string }): StockMovement {
  const product = cbFindProduct(input.productId);
  if (!product) {
    throw new Error('product not found: ' + input.productId);
  }
  if (typeof input.reason !== 'string' || input.reason.trim() === '') {
    throw new Error('adjustment requires a non-empty reason');
  }
  if (typeof input.delta !== 'number' || !isFinite(input.delta) || Math.floor(input.delta) !== input.delta) {
    throw new Error('delta must be an integer');
  }
  if (input.delta === 0) {
    throw new Error('adjustment delta must be non-zero');
  }
  const next = product.stock + input.delta;
  if (next < 0) {
    throw new Error('adjustment would drive stock negative for ' + product.id);
  }
  const moved = cbWriteMovement(product.id, input.delta, 'Adjustment', next);
  if (!moved.ok || !moved.value) {
    throw new Error(moved.reason || 'failed to write adjustment movement');
  }
  const saved = cbSetStock(product, next);
  if (!saved) {
    throw new Error('failed to persist stock for ' + product.id);
  }
  return moved.value;
}

/**
 * Reconstruct a product's stock count as the running sum of its append-only
 * stock movements (req-11).
 */
// req-11
function reconstructStock(productId: ProductId): number {
  const movements = cbMovementsFor(productId);
  let sum = 0;
  let i = 0;
  while (i < movements.length) {
    sum = sum + movements[i].delta;
    i = i + 1;
  }
  return sum;
}

/**
 * Compare the stored stock count against the reconstructed running sum of
 * movements and report any mismatch (req-11, req-6).
 */
// req-11
function checkStockInvariant(productId: ProductId): { ok: boolean; stored: number; reconstructed: number } {
  const state = cbLoadState();
  let stored = 0;
  let i = 0;
  while (i < state.products.length) {
    if (state.products[i].id === productId) {
      stored = state.products[i].stock;
      break;
    }
    i = i + 1;
  }
  const reconstructed = reconstructStock(productId);
  return { ok: stored === reconstructed, stored: stored, reconstructed: reconstructed };
}

/**
 * Low-stock dashboard: products whose current stock is at or below their
 * reorder level, sorted by shortfall descending with product id as a stable
 * tie-breaker, each with a suggested reorder quantity (req-8).
 */
// req-8
function getLowStockDashboard(): Array<{ product: Product; shortfall: number; suggestedReorder: number }> {
  const state = cbLoadState();
  const out: LowStockEntry[] = [];
  let i = 0;
  while (i < state.products.length) {
    const product = state.products[i];
    const shortfall = product.reorderLevel - product.stock;
    if (product.stock <= product.reorderLevel) {
      const suggestedReorder = shortfall > 0 ? shortfall : 1;
      out.push({ product: product, shortfall: shortfall, suggestedReorder: suggestedReorder });
    }
    i = i + 1;
  }
  out.sort(function (a: LowStockEntry, b: LowStockEntry): number {
    if (b.shortfall !== a.shortfall) {
      return b.shortfall - a.shortfall;
    }
    if (a.product.id < b.product.id) {
      return -1;
    }
    if (a.product.id > b.product.id) {
      return 1;
    }
    return 0;
  });
  return out;
}

/**
 * List orders filtered by status, by inclusive date range, and by free-text
 * query against customer name and order id (req-9).
 */
// req-9
function listOrders(filter: { status?: OrderStatus; from?: string; to?: string; query?: string }): Order[] {
  const state = cbLoadState();
  const out: Order[] = [];
  const from = filter && typeof filter.from === 'string' ? filter.from : '';
  const to = filter && typeof filter.to === 'string' ? filter.to : '';
  const query = filter && typeof filter.query === 'string' ? filter.query.trim().toLowerCase() : '';
  let i = 0;
  while (i < state.orders.length) {
    const order = state.orders[i];
    let keep = true;
    if (filter && filter.status && order.status !== filter.status) {
      keep = false;
    }
    if (keep && from !== '' && order.fulfilmentDate < from) {
      keep = false;
    }
    if (keep && to !== '' && order.fulfilmentDate > to) {
      keep = false;
    }
    if (keep && query !== '') {
      const haystack = (order.customerName + ' ' + order.id).toLowerCase();
      if (haystack.indexOf(query) === -1) {
        keep = false;
      }
    }
    if (keep) {
      out.push(order);
    }
    i = i + 1;
  }
  return out;
}
export { cancelOrder, transitionOrderStatus, receiveStock, adjustStock, reconstructStock, checkStockInvariant, getLowStockDashboard, listOrders };
