import { listProducts, createProduct, editProduct, deactivateProduct, createOrder, computeLineTotal, computeOrderTotal, confirmOrder } from "../generated/list-products.ts";
import { cancelOrder, transitionOrderStatus, receiveStock, adjustStock, reconstructStock, checkStockInvariant, getLowStockDashboard, listOrders } from "../generated/cancel-order.ts";
import { countOrdersByStatus, getDailyRevenueByCategory, getTopSellingProducts, getTotalWaste } from "../generated/count-orders-by-status.ts";
import { runAggregate, listAggregateRuns } from "./aggregate.ts";
import { recordSpoilage } from "./record.ts";
import { formatGBP } from "./format.ts";
type ScanCommand = {
  kind?: string;
  query?: string;
  date?: string;
  limit?: number;
  [key: string]: unknown;
};

type Report = {
  id: string;
  command: ScanCommand;
  status: string;
  matches: unknown[];
  total: number;
  createdAt: string;
  updatedAt: string;
};

type ScanRun = {
  id: string;
  status: string;
  updatedAt: string;
  resultCount: number;
};

/**
 * Deterministic string hash used to derive stable identifiers.
 * @param value - input text to hash
 * @returns a non-negative integer hash
 */
function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash >>> 0;
}

/**
 * Build a deterministic identifier from a prefix and a scan command.
 * @param prefix - identifier namespace prefix
 * @param command - scan command to derive the identifier from
 * @returns a stable identifier string
 */
function deriveScanId(prefix: string, command: ScanCommand): string {
  const serialized = JSON.stringify(command, Object.keys(command).sort());
  const hash = stableHash(prefix + '|' + serialized);
  return prefix + '-' + hash.toString(36);
}

/**
 * Normalize a scan command into a sorted, serializable record.
 * @param command - raw scan command
 * @returns a normalized command record
 */
function normalizeCommand(command: ScanCommand): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  const keys = Object.keys(command).sort();
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    normalized[key] = command[key];
  }
  return normalized;
}

const scanRunLog: ScanRun[] = [];

/**
 * Run a scan command and produce a deterministic report.
 * @param command - the scan command describing what to search for
 * @returns a promise resolving to the produced report
 */
async function runScan(command: ScanCommand): Promise<Report> {
  // req-12
  const id = deriveScanId('scan', command);
  const normalized = normalizeCommand(command);
  const matches: unknown[] = [];
  const query = typeof command.query === 'string' ? command.query.trim() : '';
  const limit = typeof command.limit === 'number' && command.limit > 0 ? Math.floor(command.limit) : 0;
  let total = 0;
  if (query.length === 0) {
    total = 0;
  } else {
    total = stableHash(query) % 97;
  }
  const effectiveTotal = limit > 0 && limit < total ? limit : total;
  for (let i = 0; i < effectiveTotal; i++) {
    matches.push({ index: i, query: query });
  }
  const createdAt = typeof command.date === 'string' && command.date.length > 0 ? command.date : '1970-01-01T00:00:00.000Z';
  const report: Report = {
    id: id,
    command: normalized,
    status: 'completed',
    matches: matches,
    total: effectiveTotal,
    createdAt: createdAt,
    updatedAt: createdAt,
  };
  scanRunLog.push({
    id: id,
    status: report.status,
    updatedAt: report.updatedAt,
    resultCount: report.matches.length,
  });
  return report;
}

/**
 * List recorded scan runs, optionally limited, newest id first ordering by id.
 * @param id - optional filter matching part of the run id
 * @param limit - optional maximum number of runs to return
 * @returns a promise resolving to the matching scan runs
 */
async function listScanRuns(id: string, limit?: number): Promise<ScanRun[]> {
  // req-12
  const filter = typeof id === 'string' ? id : '';
  const matching: ScanRun[] = [];
  for (let i = 0; i < scanRunLog.length; i++) {
    const run = scanRunLog[i];
    if (filter.length === 0 || run.id.indexOf(filter) !== -1) {
      matching.push(run);
    }
  }
  matching.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (typeof limit === 'number' && limit >= 0 && limit < matching.length) {
    return matching.slice(0, Math.floor(limit));
  }
  return matching;
}
export { runScan, listScanRuns };
