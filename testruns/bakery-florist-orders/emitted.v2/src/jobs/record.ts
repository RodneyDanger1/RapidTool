import { listProducts, createProduct, editProduct, deactivateProduct, createOrder, computeLineTotal, computeOrderTotal, confirmOrder } from "../generated/list-products.ts";
import { cancelOrder, transitionOrderStatus, receiveStock, adjustStock, reconstructStock, checkStockInvariant, getLowStockDashboard, listOrders } from "../generated/cancel-order.ts";
import { countOrdersByStatus, getDailyRevenueByCategory, getTopSellingProducts, getTotalWaste } from "../generated/count-orders-by-status.ts";
import { runAggregate, listAggregateRuns } from "./aggregate.ts";
type ProductId = string;

type StockMovementReason = "Received" | "Sold" | "Spoiled" | "Adjustment";

interface StockMovement {
  id: string;
  productId: ProductId;
  delta: number;
  reason: StockMovementReason;
  timestamp: string;
  resultingCount: number;
}

interface MovementLogEntry {
  seq: number;
  movement: StockMovement;
}

interface SpoilageStore {
  movements: MovementLogEntry[];
  nextSeq: number;
}

// Module-level append-only store for this module's write endpoint.
const spoilageStore: SpoilageStore = { movements: [], nextSeq: 1 };

/**
 * Deterministically formats a non-negative integer as an id segment.
 *
 * @param value - a non-negative integer.
 * @returns a fixed-width decimal string.
 */
function formatIdSegment(value: number): string {
  let digits = "";
  let remaining = value < 0 ? 0 : Math.floor(value);
  if (remaining === 0) {
    digits = "0";
  } else {
    while (remaining > 0) {
      const d = remaining % 10;
      digits = String(d) + digits;
      remaining = (remaining - d) / 10;
    }
  }
  while (digits.length < 8) {
    digits = "0" + digits;
  }
  return digits;
}

/**
 * A deterministic ISO timestamp derived from the movement sequence number.
 *
 * @param seq - the movement sequence number.
 * @returns an ISO-8601 timestamp string.
 */
function deterministicTimestamp(seq: number): string {
  const baseSeconds = 1700000000;
  const totalSeconds = baseSeconds + seq;
  const days = Math.floor(totalSeconds / 86400);
  const remSeconds = totalSeconds - days * 86400;
  const hours = Math.floor(remSeconds / 3600);
  const remAfterHours = remSeconds - hours * 3600;
  const minutes = Math.floor(remAfterHours / 60);
  const seconds = remAfterHours - minutes * 60;
  let year = 1970;
  let dayCounter = days;
  while (true) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const yearDays = leap ? 366 : 365;
    if (dayCounter >= yearDays) {
      dayCounter -= yearDays;
      year += 1;
    } else {
      break;
    }
  }
  const leapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const monthLengths = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let monthIndex = 0;
  while (monthIndex < 12 && dayCounter >= monthLengths[monthIndex]) {
    dayCounter -= monthLengths[monthIndex];
    monthIndex += 1;
  }
  const month = monthIndex + 1;
  const day = dayCounter + 1;
  const pad2 = (n: number): string => (n < 10 ? "0" + String(n) : String(n));
  const pad4 = (n: number): string => formatIdSegment(n).slice(-4);
  return (
    pad4(year) +
    "-" +
    pad2(month) +
    "-" +
    pad2(day) +
    "T" +
    pad2(hours) +
    ":" +
    pad2(minutes) +
    ":" +
    pad2(seconds) +
    "Z"
  );
}

/**
 * Deterministically builds a stock movement id from its sequence number.
 *
 * @param seq - the movement sequence number.
 * @returns a movement id string.
 */
function buildMovementId(seq: number): string {
  return "mv-spoil-" + formatIdSegment(seq);
}

/**
 * Reads the current reconstructed count for a product from the append-only
 * movement log, without any mutable counter trust.
 *
 * @param productId - the product whose movements are summed.
 * @returns the running sum of movement deltas for the product.
 */
function reconstructedCountFor(productId: ProductId): number {
  let sum = 0;
  for (let i = 0; i < spoilageStore.movements.length; i += 1) {
    const entry = spoilageStore.movements[i];
    if (entry.movement.productId === productId) {
      sum += entry.movement.delta;
    }
  }
  return sum;
}

/**
 * Appends a movement to the module's append-only movement log, allocating the
 * next immutable sequence number and resulting count.
 *
 * @param productId - the affected product.
 * @param delta - the signed change in units.
 * @param reason - the movement reason.
 * @returns the appended stock movement.
 */
function appendSpoilageMovement(
  productId: ProductId,
  delta: number,
  reason: StockMovementReason
): StockMovement {
  const seq = spoilageStore.nextSeq;
  const resultingCount = reconstructedCountFor(productId) + delta;
  const movement: StockMovement = {
    id: buildMovementId(seq),
    productId: productId,
    delta: delta,
    reason: reason,
    timestamp: deterministicTimestamp(seq),
    resultingCount: resultingCount,
  };
  spoilageStore.movements.push({ seq: seq, movement: movement });
  spoilageStore.nextSeq = seq + 1;
  return movement;
}

/**
 * Records spoilage: decrements the product count by the given quantity and
 * writes an append-only Spoiled stock movement. Refuses non-positive or
 * non-integer quantities and refuses any change that would drive the
 * reconstructed count below zero, writing nothing in either case.
 *
 * @param input - the product id and the quantity spoiled.
 * @returns the appended Spoiled stock movement.
 */
// req-6
function recordSpoilage(input: { productId: ProductId; quantity: number }): StockMovement {
  const productId: ProductId = input.productId;
  const quantity: number = input.quantity;
  if (typeof productId !== "string" || productId.length === 0) {
    throw new Error("recordSpoilage: productId is required");
  }
  if (typeof quantity !== "number" || !isFinite(quantity) || Math.floor(quantity) !== quantity) {
    throw new Error("recordSpoilage: quantity must be an integer");
  }
  if (quantity <= 0) {
    throw new Error("recordSpoilage: quantity must be greater than zero");
  }
  const current = reconstructedCountFor(productId);
  if (current - quantity < 0) {
    throw new Error(
      "recordSpoilage: refused, spoilage of " +
        String(quantity) +
        " would take stock from " +
        String(current) +
        " below zero"
    );
  }
  return appendSpoilageMovement(productId, -quantity, "Spoiled");
}
export { recordSpoilage };
