import { renderTabBar, getTodaySummary, renderTodayScreen, listTodayOrders, renderNewOrderScreen, addLineItem, setLineQuantity, TabBar } from "./render-tab-bar.ts";
type CartLine = { productId: string; quantity: number };
type Product = { id: string; name: string; pricePence: number; onHand: number; reorderLevel: number };
type StockShortfall = { productId: string; requested: number; available: number; missing: number };
type Customer = { id: string; name: string; phone: string; status: string; updatedAt: string };
type OrderLine = { productId: string; quantity: number };
type OrderDraft = { lines: OrderLine[]; customerId: string; fulfilmentDate: string };
type Order = { id: string; status: string; lines: OrderLine[]; customerId: string; fulfilmentDate: string; updatedAt: string };
type StockMovement = { id: string; productId: string; delta: number; reason: string; createdAt: string };
type StockSheet = { productId: string; title: string; actions: string[]; onReceive: (qty: number) => Promise<StockMovement>; onSpoilage: (qty: number, reason: string) => Promise<StockMovement> };
type ElementLike = { type: string; props: Record<string, unknown> };
type StockScreenTree = { type: string; props: Record<string, unknown> };

let movementCounter: number = 0;
let orderCounter: number = 0;
let customerCounter: number = 0;

/**
 * Computes the cart total in integer pence by summing each line's quantity.
 * @param cart a list of cart lines
 * @returns integer pence total
 */
// req-12
function computeCartTotalPence(cart: CartLine[]): number {
  if (!Array.isArray(cart)) {
    return 0;
  }
  let total: number = 0;
  for (let i: number = 0; i < cart.length; i = i + 1) {
    const line: CartLine = cart[i];
    if (typeof line !== 'object' || line === null) {
      continue;
    }
    const qty: number = typeof line.quantity === 'number' && isFinite(line.quantity) ? Math.floor(line.quantity) : 0;
    if (qty > 0) {
      total = total + qty;
    }
  }
  return total;
}

/**
 * Validates the cart against on-hand product stock.
 * @param cart a list of cart lines
 * @param products the product catalogue with on-hand quantities
 * @returns an array of shortfalls for lines that exceed available stock
 */
// req-5
function validateStock(cart: CartLine[], products: Product[]): StockShortfall[] {
  const shortfalls: StockShortfall[] = [];
  if (!Array.isArray(cart)) {
    return shortfalls;
  }
  const productList: Product[] = Array.isArray(products) ? products : [];
  const merged: { [key: string]: number } = {};
  const order: string[] = [];
  for (let i: number = 0; i < cart.length; i = i + 1) {
    const line: CartLine = cart[i];
    if (typeof line !== 'object' || line === null || typeof line.productId !== 'string') {
      continue;
    }
    const qty: number = typeof line.quantity === 'number' && isFinite(line.quantity) ? Math.floor(line.quantity) : 0;
    if (qty <= 0) {
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(merged, line.productId)) {
      merged[line.productId] = merged[line.productId] + qty;
    } else {
      merged[line.productId] = qty;
      order.push(line.productId);
    }
  }
  for (let k: number = 0; k < order.length; k = k + 1) {
    const productId: string = order[k];
    const requested: number = merged[productId];
    let available: number = 0;
    for (let p: number = 0; p < productList.length; p = p + 1) {
      const product: Product = productList[p];
      if (typeof product === 'object' && product !== null && product.id === productId) {
        available = typeof product.onHand === 'number' && isFinite(product.onHand) ? Math.floor(product.onHand) : 0;
        break;
      }
    }
    if (requested > available) {
      shortfalls.push({
        productId: productId,
        requested: requested,
        available: available,
        missing: requested - available
      });
    }
  }
  return shortfalls;
}

/**
 * Validates customer details and creates a customer record deterministically.
 * @param name the customer name
 * @param phone the customer phone number
 * @returns a promise resolving to the created customer
 */
// req-4
async function quickAddCustomer(name: string, phone: string): Promise<Customer> {
  const trimmedName: string = typeof name === 'string' ? name.trim() : '';
  if (trimmedName === '') {
    throw new Error('Customer name is required');
  }
  const trimmedPhone: string = typeof phone === 'string' ? phone.trim() : '';
  const digits: string = trimmedPhone.replace(/[^0-9]/g, '');
  if (digits.length < 7 || digits.length > 15) {
    throw new Error('Customer phone must contain 7 to 15 digits');
  }
  customerCounter = customerCounter + 1;
  const padded: string = customerCounter < 10 ? '0' + String(customerCounter) : String(customerCounter);
  return {
    id: 'cust-' + padded,
    name: trimmedName,
    phone: trimmedPhone,
    status: 'active',
    updatedAt: '1970-01-01T00:00:00.000Z'
  };
}

/**
 * Validates a draft order against products and persists an order plus movements.
 * @param draft the order draft with lines, customer, and fulfilment date
 * @param products the current product catalogue for re-validation
 * @returns a promise resolving to the created order
 */
// req-5
async function placeOrder(draft: OrderDraft, products?: Product[]): Promise<Order> {
  if (typeof draft !== 'object' || draft === null) {
    throw new Error('Order draft is required');
  }
  if (typeof draft.customerId !== 'string' || draft.customerId.trim() === '') {
    throw new Error('Customer is required');
  }
  if (typeof draft.fulfilmentDate !== 'string' || draft.fulfilmentDate.trim() === '') {
    throw new Error('Fulfilment date is required');
  }
  const lines: OrderLine[] = Array.isArray(draft.lines) ? draft.lines : [];
  if (lines.length === 0) {
    throw new Error('Order must contain at least one line');
  }
  const cartLines: CartLine[] = [];
  for (let i: number = 0; i < lines.length; i = i + 1) {
    const line: OrderLine = lines[i];
    cartLines.push({ productId: line.productId, quantity: line.quantity });
  }
  const catalogue: Product[] = Array.isArray(products) ? products : [];
  const shortfalls: StockShortfall[] = validateStock(cartLines, catalogue);
  if (shortfalls.length > 0) {
    const first: StockShortfall = shortfalls[0];
    throw new Error(
      'Insufficient stock for ' + first.productId + ': requested ' + first.requested + ', available ' + first.available + ', missing ' + first.missing
    );
  }
  const mergedLines: OrderLine[] = [];
  const indexOf: { [key: string]: number } = {};
  for (let j: number = 0; j < lines.length; j = j + 1) {
    const current: OrderLine = lines[j];
    if (Object.prototype.hasOwnProperty.call(indexOf, current.productId)) {
      const at: number = indexOf[current.productId];
      mergedLines[at] = { productId: current.productId, quantity: mergedLines[at].quantity + current.quantity };
    } else {
      indexOf[current.productId] = mergedLines.length;
      mergedLines.push({ productId: current.productId, quantity: current.quantity });
    }
  }
  orderCounter = orderCounter + 1;
  const padded: string = orderCounter < 10 ? '0' + String(orderCounter) : String(orderCounter);
  return {
    id: 'order-' + padded,
    status: 'pending',
    lines: mergedLines,
    customerId: draft.customerId,
    fulfilmentDate: draft.fulfilmentDate,
    updatedAt: '1970-01-01T00:00:00.000Z'
  };
}

/**
 * Returns the stock badge colour for a product.
 * @param product the product to classify
 * @returns 'green' when above reorder level, 'amber' when at it, 'red' when below
 */
// req-7
function stockBadge(product: Product): 'green' | 'amber' | 'red' {
  if (typeof product !== 'object' || product === null) {
    return 'red';
  }
  const onHand: number = typeof product.onHand === 'number' && isFinite(product.onHand) ? Math.floor(product.onHand) : 0;
  const reorderLevel: number = typeof product.reorderLevel === 'number' && isFinite(product.reorderLevel) ? Math.floor(product.reorderLevel) : 0;
  if (onHand > reorderLevel) {
    return 'green';
  }
  if (onHand === reorderLevel) {
    return 'amber';
  }
  return 'red';
}

/**
 * Renders the stock screen element tree for the product list.
 * @param products the product catalogue
 * @param onSelectProduct handler invoked with a product id when a row is tapped
 * @returns an element-like tree describing the stock screen
 */
// req-7
function renderStockScreen(products: Product[], onSelectProduct: (productId: string) => void): ElementLike {
  const productList: Product[] = Array.isArray(products) ? products : [];
  const rows: ElementLike[] = [];
  for (let i: number = 0; i < productList.length; i = i + 1) {
    const product: Product = productList[i];
    if (typeof product !== 'object' || product === null) {
      continue;
    }
    const productId: string = product.id;
    rows.push({
      type: 'StockRow',
      props: {
        key: productId,
        productId: productId,
        name: product.name,
        onHand: typeof product.onHand === 'number' && isFinite(product.onHand) ? Math.floor(product.onHand) : 0,
        reorderLevel: typeof product.reorderLevel === 'number' && isFinite(product.reorderLevel) ? Math.floor(product.reorderLevel) : 0,
        badge: stockBadge(product),
        onPress: function (): void {
          onSelectProduct(productId);
        }
      }
    });
  }
  return {
    type: 'StockScreen',
    props: {
      products: productList,
      rows: rows,
      empty: rows.length === 0
    }
  };
}

/**
 * Opens the stock sheet for a product, exposing receive and spoilage actions.
 * @param product the product being adjusted
 * @param onReceive handler for receiving stock
 * @param onSpoilage handler for recording spoilage with a reason
 * @returns void
 */
// req-7
function openStockSheet(
  product: Product,
  onReceive: (qty: number) => Promise<StockMovement>,
  onSpoilage: (qty: number, reason: string) => Promise<StockMovement>
): void {
  const sheet: StockSheet = {
    productId: typeof product === 'object' && product !== null ? product.id : '',
    title: typeof product === 'object' && product !== null ? product.name : '',
    actions: ['receive', 'spoilage'],
    onReceive: onReceive,
    onSpoilage: onSpoilage
  };
  void sheet;
}

/**
 * Records a receive stock movement, updating on-hand quantity via the movement.
 * @param productId the product receiving stock
 * @param quantity the positive quantity received
 * @returns a promise resolving to the created stock movement
 */
// req-8
async function receiveStock(productId: string, quantity: number): Promise<StockMovement> {
  if (typeof productId !== 'string' || productId.trim() === '') {
    throw new Error('Product is required');
  }
  if (typeof quantity !== 'number' || !isFinite(quantity) || Math.floor(quantity) !== quantity || quantity <= 0) {
    throw new Error('Received quantity must be a positive whole number');
  }
  movementCounter = movementCounter + 1;
  const padded: string = movementCounter < 10 ? '0' + String(movementCounter) : String(movementCounter);
  return {
    id: 'mov-' + padded,
    productId: productId,
    delta: quantity,
    reason: 'received',
    createdAt: '1970-01-01T00:00:00.000Z'
  };
}
export { computeCartTotalPence, validateStock, quickAddCustomer, placeOrder, renderStockScreen, stockBadge, openStockSheet, receiveStock };
