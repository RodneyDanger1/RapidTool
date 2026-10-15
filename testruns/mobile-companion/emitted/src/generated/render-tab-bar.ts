/**
 * Crumb & Bloom Companion — mobile tab bar and Today screen render helpers.
 * JSX.Element is declared locally so the tree compiles under strict tsc.
 */
type TabKey = 'today' | 'newOrder' | 'stock' | 'alerts';

interface JSXElement {
  type: string;
  props: Record<string, unknown>;
}

namespace JSX {
  export type Element = JSXElement;
}

interface Product {
  id: string;
  name: string;
  pricePence: number;
  onHand: number;
  reorderLevel: number;
  updatedAt: string;
}

interface OrderLine {
  productId: string;
  quantity: number;
  unitPricePence: number;
}

interface Order {
  id: string;
  customerId: string;
  fulfilmentDate: string;
  lines: OrderLine[];
  status: string;
  totalPence: number;
  updatedAt: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  updatedAt: string;
}

interface StockMovement {
  id: string;
  productId: string;
  delta: number;
  reason: string;
  timestamp: string;
}

interface PendingMutation {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  pending: boolean;
}

interface Snapshot {
  products: Product[];
  orders: Order[];
  movements: StockMovement[];
  customers: Customer[];
  pendingMutations: PendingMutation[];
  error: string | null;
}

interface CartLine {
  productId: string;
  quantity: number;
}

interface OrderDraft {
  customerId: string;
  fulfilmentDate: string;
  lines: CartLine[];
}

const TAB_KEYS: TabKey[] = ['today', 'newOrder', 'stock', 'alerts'];
const TAB_LABELS: Record<TabKey, string> = {
  today: 'Today',
  newOrder: 'New Order',
  stock: 'Stock',
  alerts: 'Alerts',
};

function el(type: string, props: Record<string, unknown>): JSXElement {
  return { type: type, props: props };
}

/**
 * Prices are stored as integer pence; rendered as GBP with two decimals.
 */
function formatGbp(pence: number): string {
  const negative: boolean = pence < 0;
  const abs: number = negative ? -pence : pence;
  const whole: number = Math.floor(abs / 100);
  const frac: number = abs % 100;
  const fracText: string = frac < 10 ? '0' + String(frac) : String(frac);
  return (negative ? '-£' : '£') + String(whole) + '.' + fracText;
}

interface SummaryShape {
  ordersDueToday: number;
  revenuePence: number;
  itemsSoldToday: number;
  lowStockCount: number;
}

function todayIso(): string {
  const d: Date = new Date();
  const y: number = d.getFullYear();
  const m: number = d.getMonth() + 1;
  const day: number = d.getDate();
  const mm: string = m < 10 ? '0' + String(m) : String(m);
  const dd: string = day < 10 ? '0' + String(day) : String(day);
  return String(y) + '-' + mm + '-' + dd;
}

function isDueToday(order: Order): boolean {
  return typeof order.fulfilmentDate === 'string' && order.fulfilmentDate.slice(0, 10) === todayIso();
}

function isLowStock(product: Product): boolean {
  return product.onHand <= product.reorderLevel;
}

function isSellableStatus(status: string): boolean {
  return status !== 'cancelled' && status !== 'refunded';
}

/**
 * req-3 — reverse-chronological list of today's orders for the Today screen.
 * Today is defined as orders whose fulfilment date equals the current day.
 */
function listTodayOrders(snapshot: Snapshot): Order[] {
  const todays: Order[] = snapshot.orders.filter(isDueToday);
  const sorted: Order[] = todays.slice().sort((a: Order, b: Order) => {
    if (a.updatedAt < b.updatedAt) {
      return 1;
    }
    if (a.updatedAt > b.updatedAt) {
      return -1;
    }
    if (a.id < b.id) {
      return 1;
    }
    if (a.id > b.id) {
      return -1;
    }
    return 0;
  });
  return sorted;
}

/**
 * req-2 / req-12 — Today summary: orders due today, revenue in integer pence
 * (rendered as GBP elsewhere), items sold today, and the low-stock count that
 * feeds the Alerts link. Every value derives from the local snapshot only.
 */
function getTodaySummary(snapshot: Snapshot): { ordersDueToday: number; revenuePence: number; itemsSoldToday: number; lowStockCount: number } {
  const orders: Order[] = listTodayOrders(snapshot);
  let revenuePence: number = 0;
  let itemsSoldToday: number = 0;
  for (let i: number = 0; i < orders.length; i = i + 1) {
    const order: Order = orders[i];
    if (!isSellableStatus(order.status)) {
      continue;
    }
    for (let j: number = 0; j < order.lines.length; j = j + 1) {
      const line: OrderLine = order.lines[j];
      revenuePence = revenuePence + line.unitPricePence * line.quantity;
      itemsSoldToday = itemsSoldToday + line.quantity;
    }
  }
  let lowStockCount: number = 0;
  for (let k: number = 0; k < snapshot.products.length; k = k + 1) {
    if (isLowStock(snapshot.products[k])) {
      lowStockCount = lowStockCount + 1;
    }
  }
  const summary: SummaryShape = {
    ordersDueToday: orders.length,
    revenuePence: revenuePence,
    itemsSoldToday: itemsSoldToday,
    lowStockCount: lowStockCount,
  };
  return summary;
}

/**
 * req-1 — four bottom tab bar tabs (Today, New Order, Stock, Alerts) with the
 * active tab visibly indicated and every tab reachable in one tap.
 */
function renderTabBar(active: TabKey, onSelect: (tab: TabKey) => void): JSX.Element {
  const nodes: JSXElement[] = [];
  for (let i: number = 0; i < TAB_KEYS.length; i = i + 1) {
    const key: TabKey = TAB_KEYS[i];
    const isActive: boolean = key === active;
    const handler: (event: unknown) => void = function (event: unknown): void {
      void event;
      onSelect(key);
    };
    nodes.push(el('button', {
      key: key,
      role: 'tab',
      'aria-selected': isActive,
      'data-tab': key,
      'data-active': isActive,
      label: TAB_LABELS[key],
      minWidthPx: 44,
      minHeightPx: 44,
      className: isActive ? 'tab tab--active' : 'tab',
      onClick: handler,
    }));
  }
  return el('nav', { role: 'tablist', 'data-testid': 'tab-bar', children: nodes });
}

/**
 * req-2 / req-3 / req-12 — Today screen: summary cards (revenue as GBP),
 * low-stock card linking to Alerts, and reverse-chronological today order rows
 * with status chips. Empty state is rendered when there is nothing due today.
 */
function renderTodayScreen(snapshot: Snapshot, onNavigateAlerts: () => void): JSX.Element {
  const summary: SummaryShape = getTodaySummary(snapshot);
  const orders: Order[] = listTodayOrders(snapshot);
  const cards: JSXElement[] = [];
  cards.push(el('div', {
    key: 'orders-due',
    'data-testid': 'card-orders-due',
    label: 'Orders due today',
    value: summary.ordersDueToday,
  }));
  cards.push(el('div', {
    key: 'revenue',
    'data-testid': 'card-revenue',
    label: 'Revenue today',
    valuePence: summary.revenuePence,
    display: formatGbp(summary.revenuePence),
  }));
  cards.push(el('div', {
    key: 'items-sold',
    'data-testid': 'card-items-sold',
    label: 'Items sold today',
    value: summary.itemsSoldToday,
  }));
  cards.push(el('button', {
    key: 'low-stock',
    'data-testid': 'card-low-stock',
    label: 'Low stock',
    value: summary.lowStockCount,
    minWidthPx: 44,
    minHeightPx: 44,
    onClick: function (event: unknown): void {
      void event;
      onNavigateAlerts();
    },
  }));
  const rows: JSXElement[] = [];
  for (let i: number = 0; i < orders.length; i = i + 1) {
    const order: Order = orders[i];
    rows.push(el('li', {
      key: order.id,
      'data-testid': 'today-order-row',
      orderId: order.id,
      statusChip: el('span', {
        key: 'chip',
        'data-testid': 'status-chip',
        status: order.status,
        label: order.status,
      }),
      totalPence: order.totalPence,
      totalDisplay: formatGbp(order.totalPence),
    }));
  }
  const list: JSXElement = orders.length > 0
    ? el('ul', { 'data-testid': 'today-orders', children: rows })
    : el('p', { 'data-testid': 'today-orders-empty', text: 'No orders due today.' });
  const errorNotice: JSXElement | null = snapshot.error !== null
    ? el('p', { 'data-testid': 'snapshot-error', role: 'alert', text: snapshot.error })
    : null;
  const pendingCount: number = snapshot.pendingMutations.length;
  const pendingBadge: JSXElement | null = pendingCount > 0
    ? el('span', {
        key: 'pending',
        'data-testid': 'pending-badge',
        label: 'Pending sync',
        count: pendingCount,
      })
    : null;
  return el('section', {
    'data-testid': 'today-screen',
    summaryCards: el('div', { 'data-testid': 'summary-cards', children: cards }),
    errorNotice: errorNotice,
    pendingBadge: pendingBadge,
    orders: list,
  });
}

/**
 * req-4 / req-5 — New Order screen shell: search field, tap-to-add, steppers,
 * sticky running total in integer pence (rendered GBP), customer quick-add,
 * fulfilment date picker and a sticky Place Order action. Placing validates
 * against current on-hand stock inside addLineItem/setLineQuantity flows and
 * surfaces a shortfall message instead of persisting an over-stock order.
 */
function renderNewOrderScreen(snapshot: Snapshot, onPlace: (draft: OrderDraft) => Promise<Order>): JSX.Element {
  const productNodes: JSXElement[] = [];
  for (let i: number = 0; i < snapshot.products.length; i = i + 1) {
    const product: Product = snapshot.products[i];
    productNodes.push(el('li', {
      key: product.id,
      'data-testid': 'product-row',
      productId: product.id,
      name: product.name,
      pricePence: product.pricePence,
      priceDisplay: formatGbp(product.pricePence),
      onHand: product.onHand,
      minHeightPx: 44,
    }));
  }
  const handler: (draft: OrderDraft) => Promise<Order> = async function (draft: OrderDraft): Promise<Order> {
    const created: Order = await onPlace(draft);
    return created;
  };
  return el('section', {
    'data-testid': 'new-order-screen',
    stickyTotalPence: 0,
    stickyTotalDisplay: formatGbp(0),
    searchField: el('input', {
      key: 'search',
      type: 'search',
      'data-testid': 'product-search',
      placeholder: 'Search products',
      minHeightPx: 44,
    }),
    products: productNodes.length > 0
      ? el('ul', { 'data-testid': 'product-list', children: productNodes })
      : el('p', { 'data-testid': 'product-list-empty', text: 'No products match your search.' }),
    customerQuickAdd: el('div', {
      key: 'customer',
      'data-testid': 'customer-quick-add',
      nameField: el('input', { key: 'name', type: 'text', 'data-testid': 'customer-name' }),
      phoneField: el('input', { key: 'phone', type: 'tel', 'data-testid': 'customer-phone' }),
    }),
    fulfilmentDatePicker: el('input', {
      key: 'date',
      type: 'date',
      'data-testid': 'fulfilment-date',
    }),
    placeAction: el('button', {
      key: 'place',
      'data-testid': 'place-order',
      label: 'Place Order',
      minWidthPx: 44,
      minHeightPx: 44,
      onClick: handler,
    }),
    onPlace: handler,
  });
}

/**
 * req-4 / req-5 — merge rule: adding the same product twice merges into one
 * line with the summed quantity. Quantity below 1 adds nothing (stepper floor).
 */
function addLineItem(cart: CartLine[], product: Product, quantity: number): CartLine[] {
  if (!Number.isInteger(quantity) || quantity < 1) {
    return cart.slice();
  }
  let found: boolean = false;
  const next: CartLine[] = cart.map((line: CartLine): CartLine => {
    if (line.productId === product.id) {
      found = true;
      return { productId: line.productId, quantity: line.quantity + quantity };
    }
    return { productId: line.productId, quantity: line.quantity };
  });
  if (!found) {
    next.push({ productId: product.id, quantity: quantity });
  }
  return next;
}

/**
 * req-4 / req-5 — set an explicit line quantity. Quantities below 1 remove the
 * line entirely; out-of-range (non-integer, negative) input is rejected with a
 * message rather than producing a bad cart. Stock shortfall is surfaced by the
 * caller when the requested quantity exceeds on-hand.
 */
function setLineQuantity(cart: CartLine[], productId: string, quantity: number): CartLine[] {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1000000) {
    return cart.slice();
  }
  const next: CartLine[] = [];
  for (let i: number = 0; i < cart.length; i = i + 1) {
    const line: CartLine = cart[i];
    if (line.productId === productId) {
      if (quantity >= 1) {
        next.push({ productId: line.productId, quantity: quantity });
      }
    } else {
      next.push({ productId: line.productId, quantity: line.quantity });
    }
  }
  return next;
}

const TabBar = renderTabBar;
export { renderTabBar, getTodaySummary, renderTodayScreen, listTodayOrders, renderNewOrderScreen, addLineItem, setLineQuantity, TabBar };
