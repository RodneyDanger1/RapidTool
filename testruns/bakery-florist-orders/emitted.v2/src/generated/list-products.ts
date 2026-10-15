type ProductId = string;
type CustomerId = string;
type OrderId = string;
type Category = 'Bakery' | 'Floral';
type Unit = 'each' | 'dozen' | 'bunch' | 'box';
type OrderStatus = 'Draft' | 'Confirmed' | 'Ready' | 'Fulfilled' | 'Cancelled';

interface Product {
  id: ProductId;
  name: string;
  category: Category;
  unitPricePence: number;
  unit: Unit;
  currentStock: number;
  reorderLevel: number;
  allergens: string[];
  stemCount: number;
  active: boolean;
}

interface Customer {
  id: CustomerId;
  name: string;
  phone: string;
  email: string;
}

interface OrderLine {
  productId: ProductId;
  quantity: number;
  unitPricePence: number;
  lineTotalPence: number;
}

interface Order {
  id: OrderId;
  customer: CustomerId;
  createdAt: string;
  fulfilmentDate: string;
  status: OrderStatus;
  lines: OrderLine[];
  totalPence: number;
}

interface StockMovement {
  id: string;
  productId: ProductId;
  delta: number;
  reason: 'Received' | 'Sold' | 'Spoiled' | 'Adjustment';
  timestamp: string;
  resultingCount: number;
}

interface PersistedState {
  products: Product[];
  customers: Customer[];
  orders: Order[];
  movements: StockMovement[];
  sequence: number;
}

function defaultState(): PersistedState {
  return { products: [], customers: [], orders: [], movements: [], sequence: 0 };
}

let state: PersistedState = defaultState();

function nextId(prefix: string): string {
  state.sequence = state.sequence + 1;
  const n = state.sequence;
  let digits = '';
  let value = n;
  while (value > 0) {
    digits = String(value % 10) + digits;
    value = Math.floor(value / 10);
  }
  while (digits.length < 6) {
    digits = '0' + digits;
  }
  return prefix + '_' + digits;
}

function isNonEmptyString(v: unknown): boolean {
  return typeof v === 'string' && v.replace(/\s/g, '').length > 0;
}

function isIntegerPence(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v) && Number.isInteger(v) && v > 0;
}

function sumMovements(productId: ProductId): number {
  let total = 0;
  for (let i = 0; i < state.movements.length; i++) {
    const m = state.movements[i];
    if (m.productId === productId) {
      total = total + m.delta;
    }
  }
  return total;
}

/**
 * List products with optional free-text name search, category filter and active filter.
 *
 * @param filter - Search query, category and active-status filters.
 * @returns Products matching the supplied filter.
 */
// req-1
function listProducts(filter: { query?: string; category?: 'Bakery' | 'Floral'; active?: boolean }): Product[] {
  const q = typeof filter.query === 'string' ? filter.query.trim().toLowerCase() : '';
  const cat = filter.category;
  const active = filter.active;
  const out: Product[] = [];
  for (let i = 0; i < state.products.length; i++) {
    const p = state.products[i];
    if (typeof cat === 'string' && p.category !== cat) {
      continue;
    }
    if (typeof active === 'boolean' && p.active !== active) {
      continue;
    }
    if (q.length > 0 && p.name.toLowerCase().indexOf(q) < 0) {
      continue;
    }
    out.push(p);
  }
  out.sort((a: Product, b: Product) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return out;
}

/**
 * Create a new product record with integer pence pricing and zero opening stock.
 *
 * @param input - Product fields excluding id and currentStock.
 * @returns The persisted product.
 */
// req-1
function createProduct(input: Omit<Product, 'id' | 'currentStock'>): Product {
  if (!input || !isNonEmptyString(input.name)) {
    throw new Error('name is required');
  }
  if (input.category !== 'Bakery' && input.category !== 'Floral') {
    throw new Error('category must be Bakery or Floral');
  }
  const unitOk = input.unit === 'each' || input.unit === 'dozen' || input.unit === 'bunch' || input.unit === 'box';
  if (!unitOk) {
    throw new Error('unit must be each, dozen, bunch or box');
  }
  if (!isIntegerPence(input.unitPricePence)) {
    throw new Error('unitPricePence must be a positive integer number of pence');
  }
  const reorder = typeof input.reorderLevel === 'number' && Number.isInteger(input.reorderLevel) && input.reorderLevel >= 0 ? input.reorderLevel : 0;
  const product: Product = {
    id: nextId('prd'),
    name: input.name,
    category: input.category,
    unitPricePence: input.unitPricePence,
    unit: input.unit,
    currentStock: 0,
    reorderLevel: reorder,
    allergens: Array.isArray(input.allergens) ? input.allergens.slice() : [],
    stemCount: typeof input.stemCount === 'number' && Number.isInteger(input.stemCount) && input.stemCount >= 0 ? input.stemCount : 0,
    active: input.active === false ? false : true,
  };
  state.products.push(product);
  return product;
}

/**
 * Edit a product by applying a partial patch.
 *
 * @param id - Product identifier.
 * @param patch - Partial fields to overwrite.
 * @returns The updated product.
 */
// req-1
function editProduct(id: ProductId, patch: Partial<Omit<Product, 'id'>>): Product {
  const p = state.products.find((x: Product) => x.id === id);
  if (!p) {
    throw new Error('product not found: ' + id);
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'name') && !isNonEmptyString(patch.name)) {
    throw new Error('name is required');
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'category') && patch.category !== 'Bakery' && patch.category !== 'Floral') {
    throw new Error('category must be Bakery or Floral');
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'unitPricePence')) {
    if (typeof patch.unitPricePence !== 'number' || !Number.isInteger(patch.unitPricePence) || patch.unitPricePence <= 0) {
      throw new Error('unitPricePence must be a positive integer number of pence');
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'name') && typeof patch.name === 'string') {
    p.name = patch.name;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'category') && (patch.category === 'Bakery' || patch.category === 'Floral')) {
    p.category = patch.category;
  }
  if (typeof patch.unitPricePence === 'number') {
    p.unitPricePence = patch.unitPricePence;
  }
  if (typeof patch.unit === 'string') {
    p.unit = patch.unit as Unit;
  }
  if (typeof patch.currentStock === 'number' && Number.isInteger(patch.currentStock) && patch.currentStock >= 0) {
    p.currentStock = patch.currentStock;
  }
  if (typeof patch.reorderLevel === 'number' && Number.isInteger(patch.reorderLevel) && patch.reorderLevel >= 0) {
    p.reorderLevel = patch.reorderLevel;
  }
  if (Array.isArray(patch.allergens)) {
    p.allergens = patch.allergens.slice();
  }
  if (typeof patch.stemCount === 'number' && Number.isInteger(patch.stemCount) && patch.stemCount >= 0) {
    p.stemCount = patch.stemCount;
  }
  if (typeof patch.active === 'boolean') {
    p.active = patch.active;
  }
  return p;
}

/**
 * Soft-deactivate a product by setting active to false (never hard-delete).
 *
 * @param id - Product identifier.
 * @returns The deactivated product.
 */
// req-1
function deactivateProduct(id: ProductId): Product {
  const p = state.products.find((x: Product) => x.id === id);
  if (!p) {
    throw new Error('product not found: ' + id);
  }
  p.active = false;
  return p;
}

/**
 * Compute a single order line total in integer pence.
 *
 * @param line - Quantity and captured unit price in pence.
 * @returns Line total in integer pence.
 */
// req-2
function computeLineTotal(line: { quantity: number; unitPricePence: number }): number {
  if (typeof line.quantity !== 'number' || !Number.isInteger(line.quantity) || line.quantity < 0) {
    throw new Error('quantity must be a non-negative integer');
  }
  if (typeof line.unitPricePence !== 'number' || !Number.isInteger(line.unitPricePence) || line.unitPricePence < 0) {
    throw new Error('unitPricePence must be a non-negative integer number of pence');
  }
  return line.quantity * line.unitPricePence;
}

/**
 * Compute an order total in integer pence from its lines.
 *
 * @param lines - Order lines.
 * @returns Order total in integer pence.
 */
// req-2
function computeOrderTotal(lines: OrderLine[]): number {
  let total = 0;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const lineQty = typeof l.quantity === 'number' && Number.isInteger(l.quantity) ? l.quantity : 0;
    const linePrice = typeof l.unitPricePence === 'number' && Number.isInteger(l.unitPricePence) ? l.unitPricePence : 0;
    total = total + computeLineTotal({ quantity: lineQty, unitPricePence: linePrice });
  }
  return total;
}

/**
 * Create a Draft order, capturing each product's current unit price into the line.
 *
 * @param input - Customer, fulfilment date and requested product lines.
 * @returns The persisted Draft order.
 */
// req-2
function createOrder(input: { customer: CustomerId; fulfilmentDate: string; lines: Array<{ productId: ProductId; quantity: number }> }): Order {
  if (!input || !isNonEmptyString(input.customer)) {
    throw new Error('customer is required');
  }
  if (!isNonEmptyString(input.fulfilmentDate)) {
    throw new Error('fulfilmentDate is required');
  }
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new Error('at least one order line is required');
  }
  const lines: OrderLine[] = [];
  for (let i = 0; i < input.lines.length; i++) {
    const raw = input.lines[i];
    const p = state.products.find((x: Product) => x.id === raw.productId);
    if (!p) {
      throw new Error('product not found: ' + String(raw.productId));
    }
    if (typeof raw.quantity !== 'number' || !Number.isInteger(raw.quantity) || raw.quantity <= 0) {
      throw new Error('quantity must be a positive integer');
    }
    const line: OrderLine = {
      productId: p.id,
      quantity: raw.quantity,
      unitPricePence: p.unitPricePence,
      lineTotalPence: computeLineTotal({ quantity: raw.quantity, unitPricePence: p.unitPricePence }),
    };
    lines.push(line);
  }
  const order: Order = {
    id: nextId('ord'),
    customer: input.customer,
    createdAt: new Date(Date.UTC(2000, 0, 1) + state.sequence * 1000).toISOString(),
    fulfilmentDate: input.fulfilmentDate,
    status: 'Draft',
    lines: lines,
    totalPence: computeOrderTotal(lines),
  };
  state.orders.push(order);
  return order;
}

/**
 * Confirm a Draft order: validate stock for every line, decrement stock and write
 * a Sold movement per line, then persist status Confirmed.
 *
 * @param id - Order identifier.
 * @returns Success with the confirmed order, or per-line shortfalls.
 */
// req-3
function confirmOrder(id: OrderId): { ok: true; order: Order } | { ok: false; shortfalls: Array<{ productId: ProductId; shortfall: number }> } {
  const order = state.orders.find((o: Order) => o.id === id);
  if (!order) {
    throw new Error('order not found: ' + id);
  }
  if (order.status !== 'Draft') {
    throw new Error('Illegal order status transition: ' + order.status + ' -> Confirmed');
  }
  const shortfalls: Array<{ productId: ProductId; shortfall: number }> = [];
  for (let i = 0; i < order.lines.length; i++) {
    const line = order.lines[i];
    const p = state.products.find((x: Product) => x.id === line.productId);
    const have = p ? p.currentStock : 0;
    if (have < line.quantity) {
      shortfalls.push({ productId: line.productId, shortfall: line.quantity - have });
    }
  }
  if (shortfalls.length > 0) {
    return { ok: false, shortfalls };
  }
  const decremented: Array<{ product: Product; quantity: number }> = [];
  for (let i = 0; i < order.lines.length; i++) {
    const line = order.lines[i];
    const p = state.products.find((x: Product) => x.id === line.productId);
    if (p) {
      p.currentStock = p.currentStock - line.quantity;
      decremented.push({ product: p, quantity: line.quantity });
    }
  }
  const movements: StockMovement[] = [];
  for (let i = 0; i < decremented.length; i++) {
    const entry = decremented[i];
    movements.push({
      id: nextId('mov'),
      productId: entry.product.id,
      delta: -entry.quantity,
      reason: 'Sold',
      timestamp: new Date(Date.UTC(2000, 0, 1) + state.sequence * 1000).toISOString(),
      resultingCount: entry.product.currentStock,
    });
  }
  for (let i = 0; i < movements.length; i++) {
    state.movements.push(movements[i]);
  }
  for (let i = 0; i < decremented.length; i++) {
    const entry = decremented[i];
    const reconstructed = sumMovements(entry.product.id);
    if (reconstructed !== entry.product.currentStock) {
      throw new Error('movement write failed for product ' + entry.product.id);
    }
  }
  order.status = 'Confirmed';
  return { ok: true, order };
}
export { listProducts, createProduct, editProduct, deactivateProduct, createOrder, computeLineTotal, computeOrderTotal, confirmOrder };
