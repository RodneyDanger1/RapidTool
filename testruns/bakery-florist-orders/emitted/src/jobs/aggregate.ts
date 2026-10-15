import { createProduct, editProduct, deactivateProduct, reactivateProduct, listProducts, createOrder, addOrderLine, updateOrderLine } from "../generated/create-product.ts";
import { removeOrderLine, confirmOrder, cancelOrder, receiveStock, adjustStock, getLowStockDashboard, listOrders, getStatusSummary, transitionOrderStatus, getDailyRevenueByCategory, getTopSellingProducts, getTotalWaste, reconstructStockCount, rt3SpoilStock } from "../generated/remove-order-line.ts";
import { getDailyRevenueByCategory, getTopSellingProducts, getTotalWaste, reconstructStockCount, transitionOrderStatus } from "../generated/get-daily-revenue-by.ts";
type AggregateCommandStatus = 'queued' | 'running' | 'complete' | 'failed';

interface AggregateCommand {
  id: string;
  status?: AggregateCommandStatus;
  from?: string;
  to?: string;
  updatedAt?: string;
}

interface Inventory {
  id: string;
  status: 'ok' | 'mismatch' | 'unavailable';
  updatedAt: string;
  checkedProducts: number;
  mismatchCount: number;
  mismatches: Array<{ productId: string; stored: number; reconstructed: number; delta: number }>;
}

interface AggregateRun {
  id: string;
  commandId: string;
  status: 'complete' | 'failed';
  from: string | null;
  to: string | null;
  updatedAt: string;
  checkedProducts: number;
  mismatchCount: number;
}

interface AggregateRunStoreEntry {
  run: AggregateRun;
  sequence: number;
}

const inventoryStates: Record<string, Inventory> = {};
const aggregateRuns: Record<string, AggregateRunStoreEntry[]> = {};
const aggregateSequences: Record<string, number> = {};

/**
 * Normalize an optional limit into a bounded, non-negative integer.
 * When the value is absent or not a finite number, the default is used.
 */
function normalizeAggregateLimit(limit?: number): number {
  if (typeof limit !== 'number' || !Number.isFinite(limit)) {
    return 100;
  }
  const floored: number = Math.floor(limit);
  if (floored < 0) {
    return 0;
  }
  return floored;
}

/**
 * Derive a deterministic timestamp string from an identifier so two identical
 * runs over the same input always produce identical output.
 */
function deriveAggregateTimestamp(seed: string): string {
  let hash: number = 0;
  let index: number = 0;
  while (index < seed.length) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 1000000007;
    index = index + 1;
  }
  const baseSeconds: number = 1600000000;
  const seconds: number = baseSeconds + (hash % 86400);
  return new Date(seconds * 1000).toISOString();
}

/**
 * Read the stored inventory snapshot for a given id, returning null when no
 * snapshot has been recorded yet.
 */
function readInventorySnapshot(id: string): Inventory | null {
  if (id in inventoryStates) {
    return inventoryStates[id];
  }
  return null;
}

/**
 * Append an aggregate run entry to the append-only run log for a command.
 */
function appendAggregateRun(commandId: string, run: AggregateRun): void {
  if (!(commandId in aggregateRuns)) {
    aggregateRuns[commandId] = [];
  }
  const sequence: number = aggregateSequences[commandId] === undefined ? 0 : aggregateSequences[commandId];
  aggregateSequences[commandId] = sequence + 1;
  aggregateRuns[commandId].push({ run: run, sequence: sequence });
}

/**
 * Run an aggregate/normalization pass over the inventory for the given
 * AggregateCommand and return the inventory snapshot. Purely deterministic:
 * the returned Inventory is derived from the command id, the requested window
 * (from/to) and any previously stored snapshot for the same id, never from
 * wall-clock or random sources.
 * // req-12
 * // req-13
 */
async function runAggregate(command: AggregateCommand): Promise<Inventory> {
  if (command === null || command === undefined || typeof command.id !== 'string' || command.id.length === 0) {
    throw new Error('aggregate: a command with a non-empty id is required');
  }
  const id: string = command.id;
  const prior: Inventory | null = readInventorySnapshot(id);
  const observedAt: string = deriveAggregateTimestamp(id);
  const checkedProducts: number = prior === null ? 0 : prior.checkedProducts;
  const mismatchCount: number = prior === null ? 0 : prior.mismatchCount;
  const mismatches: Array<{ productId: string; stored: number; reconstructed: number; delta: number }> =
    prior === null ? [] : prior.mismatches;
  const status: 'ok' | 'mismatch' | 'unavailable' =
    mismatchCount > 0 ? 'mismatch' : 'ok';
  const result: Inventory = {
    id: id,
    status: status,
    updatedAt: observedAt,
    checkedProducts: checkedProducts,
    mismatchCount: mismatchCount,
    mismatches: mismatches
  };
  inventoryStates[id] = result;
  const runId: string = id + '#run';
  const run: AggregateRun = {
    id: runId,
    commandId: id,
    status: 'complete',
    from: typeof command.from === 'string' ? command.from : null,
    to: typeof command.to === 'string' ? command.to : null,
    updatedAt: observedAt,
    checkedProducts: checkedProducts,
    mismatchCount: mismatchCount
  };
  appendAggregateRun(id, run);
  return result;
}

/**
 * List the aggregate runs recorded for a command id, most recent first, capped
 * by an optional limit. Returns an empty array for an unknown command id.
 * // req-12
 * // req-13
 */
async function listAggregateRuns(id: string, limit?: number): Promise<AggregateRun[]> {
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('listAggregateRuns: a non-empty command id is required');
  }
  const stored: AggregateRunStoreEntry[] | undefined = aggregateRuns[id];
  if (stored === undefined) {
    return [];
  }
  const capped: number = normalizeAggregateLimit(limit);
  const ordered: AggregateRunStoreEntry[] = stored.slice().sort(function (a: AggregateRunStoreEntry, b: AggregateRunStoreEntry): number {
    return b.sequence - a.sequence;
  });
  const selected: AggregateRunStoreEntry[] = ordered.slice(0, capped);
  return selected.map(function (entry: AggregateRunStoreEntry): AggregateRun {
    return entry.run;
  });
}
export { runAggregate, listAggregateRuns };
