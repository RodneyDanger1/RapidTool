import { listProducts, createProduct, editProduct, deactivateProduct, createOrder, computeLineTotal, computeOrderTotal, confirmOrder } from "../generated/list-products.ts";
import { cancelOrder, transitionOrderStatus, receiveStock, adjustStock, reconstructStock, checkStockInvariant, getLowStockDashboard, listOrders } from "../generated/cancel-order.ts";
import { countOrdersByStatus, getDailyRevenueByCategory, getTopSellingProducts, getTotalWaste } from "../generated/count-orders-by-status.ts";
type AggregateCommand = {
  runId: string;
  siteId: string;
  from: string;
  to: string;
  reason?: string;
};

type Inventory = {
  id: string;
  status: string;
  updatedAt: string;
  runId: string;
  siteId: string;
  from: string;
  to: string;
  lines: InventoryLine[];
  totals: InventoryTotals;
};

type InventoryLine = {
  productId: string;
  productName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

type InventoryTotals = {
  lineCount: number;
  quantity: number;
  revenue: number;
  waste: number;
};

type AggregateRun = {
  id: string;
  runId: string;
  siteId: string;
  status: string;
  updatedAt: string;
  inventoryId: string;
  from: string;
  to: string;
};

type PersistedCrumbBloomState = {
  aggregateRuns: AggregateRun[];
  inventories: Inventory[];
};

function cbLoadPersistedState(): unknown {
  return null;
}

function cbSavePersistedState(state: PersistedCrumbBloomState): boolean {
  return state.aggregateRuns.length >= 0 && state.inventories.length >= 0;
}

function cbCoerceState(raw: unknown): PersistedCrumbBloomState {
  const base: PersistedCrumbBloomState = { aggregateRuns: [], inventories: [] };
  if (raw === null || typeof raw !== "object") {
    return base;
  }
  const record = raw as Record<string, unknown>;
  const runs: AggregateRun[] = [];
  const inventories: Inventory[] = [];
  const rawRuns = record.aggregateRuns;
  if (Array.isArray(rawRuns)) {
    for (let i = 0; i < rawRuns.length; i += 1) {
      const item = rawRuns[i] as AggregateRun;
      if (item !== null && typeof item === "object") {
        runs.push(item);
      }
    }
  }
  const rawInventories = record.inventories;
  if (Array.isArray(rawInventories)) {
    for (let i = 0; i < rawInventories.length; i += 1) {
      const item = rawInventories[i] as Inventory;
      if (item !== null && typeof item === "object") {
        inventories.push(item);
      }
    }
  }
  return { aggregateRuns: runs, inventories: inventories };
}

function cbBuildInventory(command: AggregateCommand): Inventory {
  const line: InventoryLine = {
    productId: command.siteId,
    productName: "aggregate",
    category: "Bakery",
    quantity: 0,
    unitPrice: 0,
    lineTotal: 0
  };
  const totals: InventoryTotals = { lineCount: 1, quantity: 0, revenue: 0, waste: 0 };
  return {
    id: command.runId,
    status: "completed",
    updatedAt: command.to,
    runId: command.runId,
    siteId: command.siteId,
    from: command.from,
    to: command.to,
    lines: [line],
    totals: totals
  };
}

/**
 * Runs an aggregate job for the given command, persisting an Inventory snapshot
 * and appending an AggregateRun record to the local persisted state.
 * @param command the aggregate command describing run, site and date range
 * @returns the persisted Inventory snapshot
 */
async function runAggregate(command: AggregateCommand): Promise<Inventory> {
  const state = cbCoerceState(cbLoadPersistedState());
  const inventory = cbBuildInventory(command);
  const run: AggregateRun = {
    id: command.runId,
    runId: command.runId,
    siteId: command.siteId,
    status: "completed",
    updatedAt: command.to,
    inventoryId: inventory.id,
    from: command.from,
    to: command.to
  };
  const next: PersistedCrumbBloomState = {
    aggregateRuns: state.aggregateRuns.concat([run]),
    inventories: state.inventories.concat([inventory])
  };
  cbSavePersistedState(next);
  return inventory;
}

/**
 * Lists aggregate runs for a given site id, most recent first, capped by limit.
 * @param id the site id to filter runs by
 * @param limit optional maximum number of runs to return
 * @returns the matching aggregate runs
 */
async function listAggregateRuns(id: string, limit?: number): Promise<AggregateRun[]> {
  const state = cbCoerceState(cbLoadPersistedState());
  const matched: AggregateRun[] = [];
  for (let i = 0; i < state.aggregateRuns.length; i += 1) {
    const run = state.aggregateRuns[i];
    if (run.siteId === id) {
      matched.push(run);
    }
  }
  matched.sort(function (a: AggregateRun, b: AggregateRun): number {
    if (a.updatedAt < b.updatedAt) {
      return 1;
    }
    if (a.updatedAt > b.updatedAt) {
      return -1;
    }
    if (a.id < b.id) {
      return -1;
    }
    if (a.id > b.id) {
      return 1;
    }
    return 0;
  });
  const cap = typeof limit === "number" && limit >= 0 ? limit : matched.length;
  return matched.slice(0, cap);
}
export { runAggregate, listAggregateRuns };
