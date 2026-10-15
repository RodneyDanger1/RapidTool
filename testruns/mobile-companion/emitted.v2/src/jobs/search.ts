import { renderTabBar, getTodaySummary, listTodayOrders, OrderStatusChip, addOrderLine, updateLineQuantity, computeRunningTotalPence } from "../generated/render-tab-bar.ts";
import { formatGbp, quickAddCustomer, validateOrder, placeOrder, stockBadgeLevel, suggestReorderQuantity, markReordered, getPendingChanges } from "../generated/format-gbp.ts";
import { renderPendingBadge, loadLocalSnapshot } from "../generated/render-pending-badge.ts";
import { recordReceive, recordSpoilage } from "./record.ts";
import { syncPendingChanges } from "./sync.ts";
type Product = {
  id: string;
  status: string;
  updatedAt: string;
  name: string;
  sku: string;
  pricePence: number;
  quantity: number;
  reorderLevel: number;
};

type OrderLine = {
  productId: string;
  name: string;
  unitPricePence: number;
  quantity: number;
};

type Order = {
  id: string;
  status: string;
  updatedAt: string;
  lines: OrderLine[];
  totalPence: number;
  customerId: string;
  fulfilmentDate: string;
  createdAt: string;
};

type Customer = {
  id: string;
  status: string;
  updatedAt: string;
  name: string;
  phone: string;
};

type StockMovement = {
  id: string;
  status: string;
  updatedAt: string;
  productId: string;
  delta: number;
  reason: string;
  createdAt: string;
};

type PendingChange = {
  id: string;
  status: string;
  updatedAt: string;
  kind: string;
  payload: Record<string, unknown>;
  queuedAt: string;
};

type NoteChange = {
  id: string;
  status: string;
  updatedAt: string;
  alertId: string;
  text: string;
  createdAt: string;
};

type AlertItem = {
  id: string;
  productId: string;
  name: string;
  quantity: number;
  reorderLevel: number;
  suggestedQuantity: number;
  createdAt: string;
  status: string;
  updatedAt: string;
};

type LocalSnapshot = {
  products: Product[];
  orders: Order[];
  customers: Customer[];
  movements: StockMovement[];
  alerts: AlertItem[];
  pendingChanges: PendingChange[];
  notes: NoteChange[];
  updatedAt: string;
};

/**
 * Filters the locally cached snapshot of products by a free-text query,
 * matching case-insensitively against the product name and SKU. An empty
 * or whitespace-only query returns the unfiltered product list so callers
 * never crash and the Stock tab can show everything, while a query with no
 * matches returns an empty array for callers to render an explicit
 * "no products found" message.
 *
 * @param snapshot - The local offline-tolerant read snapshot (shared back-office contracts).
 * @param query - Raw user text from the search field; may be empty or whitespace.
 * @returns The subset of snapshot products matching the query, in snapshot order.
 */
// req-7
// req-10
function searchProducts(snapshot: LocalSnapshot, query: string): Product[] {
  const products: Product[] = Array.isArray(snapshot.products) ? snapshot.products : [];
  const trimmed: string = query.trim().toLowerCase();
  if (trimmed.length === 0) {
    return products.slice();
  }
  return products.filter((product: Product): boolean => {
    const name: string = product.name.toLowerCase();
    const sku: string = product.sku.toLowerCase();
    return name.indexOf(trimmed) !== -1 || sku.indexOf(trimmed) !== -1;
  });
}
export { searchProducts };
