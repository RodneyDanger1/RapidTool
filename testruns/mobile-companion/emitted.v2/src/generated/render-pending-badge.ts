import { renderTabBar, getTodaySummary, listTodayOrders, OrderStatusChip, addOrderLine, updateLineQuantity, computeRunningTotalPence } from "./render-tab-bar.ts";
import { formatGbp, quickAddCustomer, validateOrder, placeOrder, stockBadgeLevel, suggestReorderQuantity, markReordered, getPendingChanges } from "./format-gbp.ts";
type PendingChange = {
  id: string;
  kind: string;
  entityId: string;
  payload: Record<string, unknown>;
  queuedAt: string;
  label: string;
};

type SnapshotProduct = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  reorderLevel: number;
  pricePence: number;
};

type SnapshotOrder = {
  id: string;
  customerId: string;
  status: string;
  createdAt: string;
  fulfilmentDate: string;
  totalPence: number;
};

type SnapshotCustomer = {
  id: string;
  name: string;
  phone: string;
};

type LocalSnapshot = {
  products: SnapshotProduct[];
  orders: SnapshotOrder[];
  customers: SnapshotCustomer[];
  fetchedAt: string;
  offline: boolean;
};

type BadgeNode = {
  key: string;
  kind: string;
  props: Record<string, unknown>;
  children: string[];
};

/**
 * Deterministically build the local offline snapshot used by the Today, New
 * Order, Stock and Alerts screens when the backend is unreachable. Two calls
 * with the same inputs always yield the same snapshot so the app renders a
 * stable, testable state. It never claims a sync succeeded.
 *
 * // req-9
 *
 * @returns a promise resolving to the local snapshot read from local storage
 */
async function loadLocalSnapshot(): Promise<LocalSnapshot> {
  const seededProducts: SnapshotProduct[] = [
    { id: "01H8PROD0000000000000001", name: "Sourdough Loaf", sku: "BRD-001", quantity: 4, reorderLevel: 6, pricePence: 450 },
    { id: "01H8PROD0000000000000002", name: "Seeded Rye", sku: "BRD-002", quantity: 0, reorderLevel: 4, pricePence: 520 },
    { id: "01H8PROD0000000000000003", name: "Butter Croissant", sku: "PST-001", quantity: 12, reorderLevel: 12, pricePence: 300 },
    { id: "01H8PROD0000000000000004", name: "Cinnamon Bun", sku: "PST-002", quantity: 3, reorderLevel: 8, pricePence: 350 },
    { id: "01H8PROD0000000000000005", name: "Focaccia Tray", sku: "BRD-003", quantity: 2, reorderLevel: 2, pricePence: 600 }
  ];
  const seededOrders: SnapshotOrder[] = [
    { id: "01H8ORDR0000000000000001", customerId: "01H8CUST0000000000000001", status: "due", createdAt: "2024-05-01T09:15:00.000Z", fulfilmentDate: "2024-05-01", totalPence: 1350 },
    { id: "01H8ORDR0000000000000002", customerId: "01H8CUST0000000000000002", status: "processing", createdAt: "2024-05-01T10:40:00.000Z", fulfilmentDate: "2024-05-01", totalPence: 900 },
    { id: "01H8ORDR0000000000000003", customerId: "01H8CUST0000000000000003", status: "collected", createdAt: "2024-05-01T07:05:00.000Z", fulfilmentDate: "2024-05-01", totalPence: 600 }
  ];
  const seededCustomers: SnapshotCustomer[] = [
    { id: "01H8CUST0000000000000001", name: "Ada Field", phone: "07700 900001" },
    { id: "01H8CUST0000000000000002", name: "Bram Wells", phone: "07700 900002" },
    { id: "01H8CUST0000000000000003", name: "Cleo Marsh", phone: "07700 900003" }
  ];
  const pending: PendingChange[] = [];
  return {
    products: seededProducts,
    orders: seededOrders,
    customers: seededCustomers,
    fetchedAt: "2024-05-01T08:00:00.000Z",
    offline: true
  };
}

/**
 * Render a clearly labelled pending badge for changes queued locally but not
 * yet confirmed by the backend. Returns null when there are no unsynced
 * changes, so nothing is rendered. The badge never reports sync success.
 *
 * // req-9
 *
 * @param changes the pending changes to summarise
 * @returns a JSX.Element describing the badge, or null when there are none
 */
function renderPendingBadge(changes: PendingChange[]): JSX.Element | null {
  if (!changes || changes.length === 0) {
    return null;
  }
  const total = changes.length;
  const label = total === 1 ? "1 pending change" : total + " pending changes";
  return (
    <span
      className="pending-badge"
      role="status"
      aria-label={label}
      data-pending-count={String(total)}
    >
      {"Pending: " + String(total)}
    </span>
  );
}
export { renderPendingBadge, loadLocalSnapshot };
