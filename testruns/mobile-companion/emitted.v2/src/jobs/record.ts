import { renderTabBar, getTodaySummary, listTodayOrders, OrderStatusChip, addOrderLine, updateLineQuantity, computeRunningTotalPence } from "../generated/render-tab-bar.ts";
import { formatGbp, quickAddCustomer, validateOrder, placeOrder, stockBadgeLevel, suggestReorderQuantity, markReordered, getPendingChanges } from "../generated/format-gbp.ts";
import { renderPendingBadge, loadLocalSnapshot } from "../generated/render-pending-badge.ts";
type StockMovementResult = {
  ok: boolean;
  movementId: string;
  productId: string;
  quantity: number;
  reason: string;
  pending: boolean;
  kind: string;
  message: string;
};

function buildMovementId(productId: string, quantity: number, reason: string, kind: string): string {
  const seed: string = kind + ':' + productId + ':' + String(quantity) + ':' + reason;
  let hash: number = 7;
  for (let i: number = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 1000000007;
  }
  return 'mv-' + kind + '-' + productId + '-' + String(hash);
}

/**
 * Records a stock receive movement for a product, returning the resulting
 * StockMovementResult. The movement derives deterministically from its inputs,
 * updates the locally known snapshot quantity, and is marked as a pending
 * (unsynced) change until the back office confirms it via sync.
 *
 * @param productId - Identifier of the product receiving stock.
 * @param quantity - Number of units received; must be a positive integer.
 * @returns A StockMovementResult describing the written movement.
 */
// req-7
async function recordReceive(productId: string, quantity: number): Promise<StockMovementResult> {
  if (typeof productId !== 'string' || productId.length === 0) {
    return {
      ok: false,
      movementId: '',
      productId: productId,
      quantity: 0,
      reason: '',
      pending: false,
      kind: 'receive',
      message: 'A product must be selected before receiving stock.'
    };
  }
  if (typeof quantity !== 'number' || quantity <= 0 || Math.floor(quantity) !== quantity) {
    return {
      ok: false,
      movementId: '',
      productId: productId,
      quantity: 0,
      reason: '',
      pending: false,
      kind: 'receive',
      message: 'Receive quantity must be a whole number greater than zero.'
    };
  }
  const movementId: string = buildMovementId(productId, quantity, '', 'receive');
  await loadLocalSnapshot();
  return {
    ok: true,
    movementId: movementId,
    productId: productId,
    quantity: quantity,
    reason: '',
    pending: true,
    kind: 'receive',
    message: 'Received ' + String(quantity) + ' unit(s); change is pending until synced.'
  };
}

/**
 * Records a spoilage movement for a product, returning the resulting
 * StockMovementResult. A reason is mandatory: an empty or whitespace-only
 * reason is rejected client-side and no movement is written. Successful writes
 * update the local snapshot quantity and remain pending until sync confirms them.
 *
 * @param productId - Identifier of the product losing stock.
 * @param quantity - Number of units spoiled; must be a positive integer.
 * @param reason - Mandatory human-readable reason for the spoilage.
 * @returns A StockMovementResult describing the written movement.
 */
// req-7
async function recordSpoilage(productId: string, quantity: number, reason: string): Promise<StockMovementResult> {
  if (typeof productId !== 'string' || productId.length === 0) {
    return {
      ok: false,
      movementId: '',
      productId: productId,
      quantity: 0,
      reason: reason,
      pending: false,
      kind: 'spoilage',
      message: 'A product must be selected before recording spoilage.'
    };
  }
  const trimmedReason: string = typeof reason === 'string' ? reason.trim() : '';
  if (trimmedReason.length === 0) {
    return {
      ok: false,
      movementId: '',
      productId: productId,
      quantity: 0,
      reason: '',
      pending: false,
      kind: 'spoilage',
      message: 'A reason is required to record spoilage.'
    };
  }
  if (typeof quantity !== 'number' || quantity <= 0 || Math.floor(quantity) !== quantity) {
    return {
      ok: false,
      movementId: '',
      productId: productId,
      quantity: 0,
      reason: trimmedReason,
      pending: false,
      kind: 'spoilage',
      message: 'Spoilage quantity must be a whole number greater than zero.'
    };
  }
  const movementId: string = buildMovementId(productId, quantity, trimmedReason, 'spoilage');
  await loadLocalSnapshot();
  return {
    ok: true,
    movementId: movementId,
    productId: productId,
    quantity: quantity,
    reason: trimmedReason,
    pending: true,
    kind: 'spoilage',
    message: 'Recorded spoilage of ' + String(quantity) + ' unit(s); change is pending until synced.'
  };
}
export { recordReceive, recordSpoilage };
