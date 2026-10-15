type TabKey = 'today' | 'newOrder' | 'stock' | 'alerts';

type OrderStatus = 'pending' | 'confirmed' | 'ready' | 'collected' | 'cancelled';

type ProductContract = {
  id: string;
  name: string;
  sku: string;
  pricePence: number;
  quantity: number;
  reorderLevel: number;
  updatedAt: string;
};

type OrderLine = {
  productId: string;
  name: string;
  unitPricePence: number;
  qty: number;
};

type Order = {
  id: string;
  customerId: string;
  fulfilmentDate: string;
  status: OrderStatus;
  lines: OrderLine[];
  totalPence: number;
  createdAt: string;
  updatedAt: string;
};

type StockMovement = {
  id: string;
  productId: string;
  kind: 'receive' | 'spoilage' | 'sale';
  quantity: number;
  reason: string;
  createdAt: string;
};

type LocalSnapshot = {
  products: ProductContract[];
  orders: Order[];
  movements: StockMovement[];
  today: string;
  pending: boolean;
};

type Product = ProductContract;

/**
 * Describes the visual state of a single bottom-tab destination.
 */
type TabDefinition = {
  key: TabKey;
  label: string;
};

const TAB_ORDER: TabDefinition[] = [
  { key: 'today', label: 'Today' },
  { key: 'newOrder', label: 'New Order' },
  { key: 'stock', label: 'Stock' },
  { key: 'alerts', label: 'Alerts' }
];

/**
 * Determine whether the given status is one of the known order statuses.
 */
function isOrderStatus(value: unknown): value is OrderStatus {
  return (
    value === 'pending' ||
    value === 'confirmed' ||
    value === 'ready' ||
    value === 'collected' ||
    value === 'cancelled'
  );
}

/**
 * Compare two ISO date strings; returns negative when a is earlier than b.
 */
function compareIsoDesc(a: string, b: string): number {
  if (a < b) {
    return 1;
  }
  if (a > b) {
    return -1;
  }
  return 0;
}

/**
 * Derive the ISO calendar day (YYYY-MM-DD) from an ISO datetime string.
 */
function isoDay(value: string): string {
  if (value.length >= 10) {
    return value.slice(0, 10);
  }
  return value;
}

/**
 * Clamp a numeric quantity into the inclusive range [0, available].
 */
function clampQty(qty: number, available: number): number {
  let upper = Math.floor(available);
  if (!Number.isFinite(upper) || upper < 0) {
    upper = 0;
  }
  const floored = Math.floor(qty);
  if (!Number.isFinite(floored) || floored < 0) {
    return 0;
  }
  if (floored > upper) {
    return upper;
  }
  return floored;
}

/**
 * Render the bottom tab bar with four destinations (Today, New Order, Stock,
 * Alerts). Each tab button meets the 44x44 minimum tap target and is labelled
 * for assistive technology. Layout is tuned for 360-430px portrait viewports.
 * @param active the currently selected tab key
 * @param onSelect callback invoked with the tapped tab key
 * @returns the tab bar element
 */
// req-1
function renderTabBar(active: TabKey, onSelect: (tab: TabKey) => void): JSX.Element {
  return {
    type: 'nav',
    props: {
      className: 'tab-bar',
      role: 'tablist',
      'aria-label': 'Primary',
      style: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'stretch',
        position: 'sticky',
        bottom: 0,
        width: '100%',
        minWidth: '360px',
        maxWidth: '430px',
        margin: '0 auto',
        boxSizing: 'border-box'
      },
      children: TAB_ORDER.map((tab: TabDefinition): JSX.Element => {
        const isActive = tab.key === active;
        return {
          type: 'button',
          props: {
            key: tab.key,
            role: 'tab',
            'aria-selected': isActive ? 'true' : 'false',
            'aria-label': tab.label,
            'data-tab': tab.key,
            className: isActive ? 'tab-button tab-button--active' : 'tab-button',
            style: {
              flex: '1 1 0',
              minWidth: '44px',
              minHeight: '44px',
              padding: '10px 6px',
              fontSize: '14px'
            },
            onClick: (): void => {
              onSelect(tab.key);
            }
          },
          children: [tab.label]
        };
      })
    }
  };
}

/**
 * Reduce a local snapshot into the four Today summary figures: orders due
 * today, revenue taken today in integer pence, items sold today, and the
 * current low-stock count.
 * @param snapshot the local snapshot read for display
 * @returns the four summary card values
 */
// req-2
function getTodaySummary(snapshot: LocalSnapshot): {
  ordersDueToday: number;
  revenuePence: number;
  itemsSoldToday: number;
  lowStockCount: number;
} {
  const orders = listTodayOrders(snapshot);
  let ordersDueToday = 0;
  let revenuePence = 0;
  let itemsSoldToday = 0;
  let i = 0;
  while (i < orders.length) {
    const order = orders[i];
    if (order.status !== 'cancelled') {
      ordersDueToday += 1;
      revenuePence += order.totalPence;
      let j = 0;
      while (j < order.lines.length) {
        itemsSoldToday += order.lines[j].qty;
        j += 1;
      }
    }
    i += 1;
  }
  let lowStockCount = 0;
  let k = 0;
  while (k < snapshot.products.length) {
    const product = snapshot.products[k];
    if (product.quantity <= product.reorderLevel) {
      lowStockCount += 1;
    }
    k += 1;
  }
  return { ordersDueToday, revenuePence, itemsSoldToday, lowStockCount };
}

/**
 * Return today's orders in reverse-chronological order so the counter list
 * shows the most recent order first.
 * @param snapshot the local snapshot read for display
 * @returns today's orders, newest first
 */
// req-3
function listTodayOrders(snapshot: LocalSnapshot): Order[] {
  const today = snapshot.today;
  const filtered: Order[] = snapshot.orders.filter((order: Order): boolean => {
    return isoDay(order.fulfilmentDate) === today;
  });
  return filtered.sort((a: Order, b: Order): number => {
    const byCreated = compareIsoDesc(a.createdAt, b.createdAt);
    if (byCreated !== 0) {
      return byCreated;
    }
    return compareIsoDesc(a.id, b.id);
  });
}

/**
 * Render the status chip for an order. The chip is a labelled, non-interactive
 * element whose colour reflects the order status while keeping WCAG AA
 * contrast for its text.
 * @param props the order status to visualise
 * @returns the chip element
 */
// req-3
function OrderStatusChip(props: { status: OrderStatus }): JSX.Element {
  const status: OrderStatus = props.status;
  return {
    type: 'span',
    props: {
      className: 'status-chip status-chip--' + status,
      role: 'status',
      'aria-label': 'Order status: ' + status,
      style: {
        display: 'inline-block',
        padding: '4px 8px',
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 600,
        lineHeight: '16px'
      }
    },
    children: [status]
  };
}

/**
 * Append a product to the basket as a new line. The requested quantity is
 * clamped so it never exceeds the locally known available stock; when the
 * product is already on the basket, the increment is bounded by the available
 * quantity too.
 * @param basket the current basket lines
 * @param product the product being added
 * @param qty the requested quantity
 * @param available the locally known available stock
 * @returns a new basket array with the line added or incremented
 */
// req-5
function addOrderLine(
  basket: OrderLine[],
  product: Product,
  qty: number,
  available: number
): OrderLine[] {
  const bounded = clampQty(qty, available);
  const next: OrderLine[] = basket.slice();
  let index = -1;
  let i = 0;
  while (i < next.length) {
    if (next[i].productId === product.id) {
      index = i;
      break;
    }
    i += 1;
  }
  if (index === -1) {
    if (bounded <= 0) {
      return next;
    }
    next.push({
      productId: product.id,
      name: product.name,
      unitPricePence: product.pricePence,
      qty: bounded
    });
    return next;
  }
  const existing = next[index];
  const combined = clampQty(existing.qty + bounded, available);
  next[index] = {
    productId: existing.productId,
    name: existing.name,
    unitPricePence: existing.unitPricePence,
    qty: combined
  };
  return next;
}

/**
 * Set a basket line's quantity, clamping it to the inclusive range
 * [0, available]. A quantity that clamps to zero removes the line.
 * @param basket the current basket lines
 * @param productId the product whose line is being adjusted
 * @param qty the requested quantity
 * @param available the locally known available stock
 * @returns a new basket array with the line updated or removed
 */
// req-5
function updateLineQuantity(
  basket: OrderLine[],
  productId: string,
  qty: number,
  available: number
): OrderLine[] {
  const bounded = clampQty(qty, available);
  const next: OrderLine[] = [];
  let i = 0;
  while (i < basket.length) {
    const line = basket[i];
    if (line.productId === productId) {
      if (bounded > 0) {
        next.push({
          productId: line.productId,
          name: line.name,
          unitPricePence: line.unitPricePence,
          qty: bounded
        });
      }
    } else {
      next.push(line);
    }
    i += 1;
  }
  return next;
}

/**
 * Sum the basket into the sticky running total, in integer pence.
 * @param basket the current basket lines
 * @returns the running total in integer pence
 */
// req-4
function computeRunningTotalPence(basket: OrderLine[]): number {
  let total = 0;
  let i = 0;
  while (i < basket.length) {
    const line = basket[i];
    total += line.unitPricePence * line.qty;
    i += 1;
  }
  return total;
}
export { renderTabBar, getTodaySummary, listTodayOrders, OrderStatusChip, addOrderLine, updateLineQuantity, computeRunningTotalPence };
