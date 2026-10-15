import { listProducts, createProduct, editProduct, deactivateProduct, createOrder, computeLineTotal, computeOrderTotal, confirmOrder } from "../generated/list-products.ts";
import { cancelOrder, transitionOrderStatus, receiveStock, adjustStock, reconstructStock, checkStockInvariant, getLowStockDashboard, listOrders } from "../generated/cancel-order.ts";
import { countOrdersByStatus, getDailyRevenueByCategory, getTopSellingProducts, getTotalWaste } from "../generated/count-orders-by-status.ts";
import { runAggregate, listAggregateRuns } from "./aggregate.ts";
import { recordSpoilage } from "./record.ts";
import { formatGBP } from "./format.ts";
import { runScan, listScanRuns } from "./scan.ts";
type SearchRecord = {
  id: string;
  kind: string;
  payload: string;
};

type SearchRun = {
  query: string;
  matched: SearchRecord[];
  count: number;
};

interface PersistedCrumbBloomState {
  aggregateRuns: SearchRun[];
  totalMatched: number;
}

/**
 * Run a deterministic search over the supplied records for the given query.
 *
 * // req-1
 *
 * @param query - The search term to match against record payloads and kinds.
 * @param records - The collection of records to search through.
 * @returns A SearchRun describing the query and its matched records.
 */
function runSearch(query: string, records: SearchRecord[]): SearchRun {
  const needle: string = query.toLowerCase();
  const matched: SearchRecord[] = [];
  for (let i: number = 0; i < records.length; i += 1) {
    const record: SearchRecord = records[i];
    const haystack: string = (record.kind + " " + record.payload).toLowerCase();
    if (needle.length > 0 && haystack.indexOf(needle) !== -1) {
      matched.push(record);
    }
  }
  return { query: query, matched: matched, count: matched.length };
}

/**
 * List the search runs recorded inside a persisted state object.
 *
 * // req-2
 *
 * @param state - The persisted state whose search runs should be listed.
 * @returns The array of previously recorded SearchRun entries.
 */
function listSearchRuns(state: PersistedCrumbBloomState): SearchRun[] {
  return state.aggregateRuns;
}
export { runSearch, listSearchRuns };
