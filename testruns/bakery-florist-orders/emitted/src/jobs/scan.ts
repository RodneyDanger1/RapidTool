import { createProduct, editProduct, deactivateProduct, reactivateProduct, listProducts, createOrder, addOrderLine, updateOrderLine } from "../generated/create-product.ts";
import { removeOrderLine, confirmOrder, cancelOrder, receiveStock, adjustStock, getLowStockDashboard, listOrders, getStatusSummary, transitionOrderStatus, getDailyRevenueByCategory, getTopSellingProducts, getTotalWaste, reconstructStockCount, rt3SpoilStock } from "../generated/remove-order-line.ts";
import { getDailyRevenueByCategory, getTopSellingProducts, getTotalWaste, reconstructStockCount, transitionOrderStatus } from "../generated/get-daily-revenue-by.ts";
import { runAggregate, listAggregateRuns } from "./aggregate.ts";
import { recordSpoilage } from "./record.ts";
import { formatGBP } from "./format.ts";
type ScanCommand = {
  kind: string;
  id: string;
  payload?: Record<string, unknown>;
  reason?: string;
  createdAt?: string;
};

type Report = {
  ok: boolean;
  id: string;
  kind: string;
  status: string;
  scannedAt: string;
  total: number;
  findings: string[];
  message: string;
};

type ScanRun = {
  id: string;
  kind: string;
  status: string;
  scannedAt: string;
  total: number;
  findings: string[];
  message: string;
};

const scanRunLog: ScanRun[] = [];
const reportStore: Report[] = [];
let scanCounter = 0;

function deriveScanId(command: ScanCommand): string {
  const base: string = command.id || "scan";
  scanCounter += 1;
  const suffix: string = String(scanCounter);
  let padded: string = "0000" + suffix;
  padded = padded.slice(padded.length - 4);
  return "scan-" + base + "-" + padded;
}

function hasNonEmptyReason(command: ScanCommand): boolean {
  if (command.kind === "adjust") {
    const reason: unknown = command.reason;
    if (typeof reason !== "string") {
      return false;
    }
    return reason.trim().length > 0;
  }
  return true;
}

/**
 * Runs a scan command asynchronously, validating it, producing a report
 * deterministically from the command contents, and recording the run.
 *
 * // req-3 // req-12
 *
 * @param command - The scan command to execute.
 * @returns A promise resolving to the produced report.
 */
async function runScan(command: ScanCommand): Promise<Report> {
  const scannedAt: string = command.createdAt || "1970-01-01T00:00:00.000Z";
  const id: string = deriveScanId(command);

  if (!command || typeof command.id !== "string" || command.id.length === 0) {
    const failed: Report = {
      ok: false,
      id: id,
      kind: "unknown",
      status: "refused",
      scannedAt: scannedAt,
      total: 0,
      findings: ["id"],
      message: "invalid input: id"
    };
    reportStore.push(failed);
    scanRunLog.push({
      id: failed.id,
      kind: failed.kind,
      status: failed.status,
      scannedAt: failed.scannedAt,
      total: failed.total,
      findings: failed.findings,
      message: failed.message
    });
    return failed;
  }

  if (!hasNonEmptyReason(command)) {
    const refused: Report = {
      ok: false,
      id: id,
      kind: command.kind,
      status: "refused",
      scannedAt: scannedAt,
      total: 0,
      findings: ["reason"],
      message: "validation error: reason"
    };
    reportStore.push(refused);
    scanRunLog.push({
      id: refused.id,
      kind: refused.kind,
      status: refused.status,
      scannedAt: refused.scannedAt,
      total: refused.total,
      findings: refused.findings,
      message: refused.message
    });
    return refused;
  }

  const findings: string[] = [];
  let total: number = 0;
  const payload: Record<string, unknown> = command.payload || {};
  const keys: string[] = Object.keys(payload);
  for (let i: number = 0; i < keys.length; i += 1) {
    const key: string = keys[i];
    const value: unknown = payload[key];
    findings.push(key);
    if (typeof value === "number" && Number.isFinite(value)) {
      total += Math.trunc(value);
    }
  }

  const report: Report = {
    ok: true,
    id: id,
    kind: command.kind,
    status: "complete",
    scannedAt: scannedAt,
    total: total,
    findings: findings,
    message: "scan complete"
  };
  reportStore.push(report);
  scanRunLog.push({
    id: report.id,
    kind: report.kind,
    status: report.status,
    scannedAt: report.scannedAt,
    total: report.total,
    findings: report.findings,
    message: report.message
  });
  return report;
}

/**
 * Lists recorded scan runs, optionally limited to a maximum number and
 * filtered by scan id when provided.
 *
 * // req-11
 *
 * @param id - The scan id to filter by (empty string returns all runs).
 * @param limit - Optional maximum number of runs to return.
 * @returns A promise resolving to the matching scan runs.
 */
async function listScanRuns(id: string, limit?: number): Promise<ScanRun[]> {
  const filter: string = typeof id === "string" ? id : "";
  const out: ScanRun[] = [];
  for (let i: number = 0; i < scanRunLog.length; i += 1) {
    const run: ScanRun = scanRunLog[i];
    if (filter.length === 0 || run.id === filter) {
      out.push({
        id: run.id,
        kind: run.kind,
        status: run.status,
        scannedAt: run.scannedAt,
        total: run.total,
        findings: run.findings,
        message: run.message
      });
    }
  }
  if (typeof limit === "number" && Number.isFinite(limit) && limit >= 0) {
    return out.slice(0, Math.trunc(limit));
  }
  return out;
}
export { runScan, listScanRuns };
