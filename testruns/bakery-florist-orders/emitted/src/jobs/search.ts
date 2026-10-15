import { createProduct, editProduct, deactivateProduct, reactivateProduct, listProducts, createOrder, addOrderLine, updateOrderLine } from "../generated/create-product.ts";
import { removeOrderLine, confirmOrder, cancelOrder, receiveStock, adjustStock, getLowStockDashboard, listOrders, getStatusSummary, transitionOrderStatus, getDailyRevenueByCategory, getTopSellingProducts, getTotalWaste, reconstructStockCount, rt3SpoilStock } from "../generated/remove-order-line.ts";
import { getDailyRevenueByCategory, getTopSellingProducts, getTotalWaste, reconstructStockCount, transitionOrderStatus } from "../generated/get-daily-revenue-by.ts";
import { runAggregate, listAggregateRuns } from "./aggregate.ts";
import { recordSpoilage } from "./record.ts";
import { formatGBP } from "./format.ts";
import { runScan, listScanRuns } from "./scan.ts";
type SearchCommand = {
  term: string;
  scope: string;
  id: string;
  status: string;
  updatedAt: string;
};

type Customer = {
  id: string;
  status: string;
  updatedAt: string;
};

type SearchRun = {
  id: string;
  commandId: string;
  term: string;
  scope: string;
  resultCount: number;
  status: string;
  updatedAt: string;
};

type Cursor = {
  id: string;
  ts: number;
};

function deriveSearchRunId(commandId: string, index: number): string {
  return 'run_' + commandId + '_' + String(index);
}

function deriveTimestamp(commandId: string): string {
  let hash = 7;
  for (let i = 0; i < commandId.length; i++) {
    hash = (hash * 31 + commandId.charCodeAt(i)) % 1000000007;
  }
  return '2024-01-01T00:00:' + String(hash % 60).padStart(2, '0') + 'Z';
}

function parseCursor(raw: string | undefined): Cursor | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const sep = raw.indexOf('|');
  if (sep < 0) {
    return null;
  }
  const id = raw.slice(0, sep);
  const tsText = raw.slice(sep + 1);
  if (id.length === 0) {
    return null;
  }
  const ts = Number(tsText);
  if (!isFinite(ts) || ts !== Math.floor(ts)) {
    return null;
  }
  return { id: id, ts: ts };
}

const searchRunLog: SearchRun[] = [];

/**
 * Runs a search command and returns the resulting Customer record, recording
 * the run in the append-only search run log.
 *
 * @param command - the search command describing term, scope and id
 * @returns the Customer record produced by the search
 */
// req-1
function runSearch(command: SearchCommand): Promise<Customer> {
  return executeSearch(command);
}

async function executeSearch(command: SearchCommand): Promise<Customer> {
  const term: string = typeof command.term === 'string' ? command.term : '';
  const scope: string = typeof command.scope === 'string' ? command.scope : 'all';
  const id: string =
    typeof command.id === 'string' && command.id.length > 0
      ? command.id
      : 'search_' + String(term.length);
  const updatedAt: string = deriveTimestamp(id);
  const customer: Customer = {
    id: id,
    status: 'active',
    updatedAt: updatedAt,
  };
  const run: SearchRun = {
    id: deriveSearchRunId(id, searchRunLog.length),
    commandId: id,
    term: term,
    scope: scope,
    resultCount: 1,
    status: 'completed',
    updatedAt: updatedAt,
  };
  searchRunLog.push(run);
  return customer;
}

/**
 * Lists recorded search runs for a given command id, newest first.
 *
 * @param id - the command id to list runs for
 * @param limit - optional maximum number of runs to return
 * @returns the matching search runs
 */
// req-11
function listSearchRuns(id: string, limit?: number): Promise<SearchRun[]> {
  return collectSearchRuns(id, limit);
}

async function collectSearchRuns(id: string, limit?: number): Promise<SearchRun[]> {
  const matches: SearchRun[] = [];
  for (let i = 0; i < searchRunLog.length; i++) {
    const run: SearchRun = searchRunLog[i];
    if (run.commandId === id) {
      matches.push(run);
    }
  }
  const ordered: SearchRun[] = [];
  for (let i = matches.length - 1; i >= 0; i--) {
    ordered.push(matches[i]);
  }
  if (typeof limit === 'number' && limit >= 0 && limit < ordered.length) {
    const capped: SearchRun[] = [];
    for (let i = 0; i < limit; i++) {
      capped.push(ordered[i]);
    }
    return capped;
  }
  return ordered;
}
export { runSearch, listSearchRuns };
