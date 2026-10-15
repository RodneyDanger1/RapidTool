import { renderTabBar, getTodaySummary, renderTodayScreen, listTodayOrders, renderNewOrderScreen, addLineItem, setLineQuantity, TabBar } from "../generated/render-tab-bar.ts";
import { computeCartTotalPence, validateStock, quickAddCustomer, placeOrder, renderStockScreen, stockBadge, openStockSheet, receiveStock } from "../generated/compute-cart-total-pence.ts";
import { suggestReorderQuantity, markReordered, readSnapshot, writeLocalSnapshot, pendingBadgeCount, formatGbp } from "../generated/suggest-reorder-quantity.ts";
import { recordSpoilage } from "./record.ts";
import { runSync, listSyncRuns } from "./sync.ts";
type Product = {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  onHand: number;
  reorderLevel: number;
  pricePence: number;
};

/**
 * Filters a list of products by a case-insensitive substring match on the
 * product name and id. An empty or whitespace-only query returns the full
 * list unchanged. A query with no matches returns an explicit empty array.
 *
 * @param query - the raw search string typed by the user
 * @param products - the full product list from the local snapshot
 * @returns the matching products in their original order
 */
// req-4
// req-7
function searchProducts(query: string, products: Product[]): Product[] {
  if (!Array.isArray(products)) {
    return [];
  }
  const raw: string = typeof query === 'string' ? query : '';
  const needle: string = raw.trim().toLowerCase();
  if (needle.length === 0) {
    return products.slice();
  }
  const matched: Product[] = [];
  let index: number = 0;
  while (index < products.length) {
    const product: Product = products[index];
    const name: string = typeof product.name === 'string' ? product.name.toLowerCase() : '';
    const id: string = typeof product.id === 'string' ? product.id.toLowerCase() : '';
    if (name.indexOf(needle) !== -1 || id.indexOf(needle) !== -1) {
      matched.push(product);
    }
    index = index + 1;
  }
  return matched;
}
export { searchProducts };
