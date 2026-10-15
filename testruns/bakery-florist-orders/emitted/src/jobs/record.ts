import { createProduct, editProduct, deactivateProduct, reactivateProduct, listProducts, createOrder, addOrderLine, updateOrderLine } from "../generated/create-product.ts";
import { removeOrderLine, confirmOrder, cancelOrder, receiveStock, adjustStock, getLowStockDashboard, listOrders, getStatusSummary, transitionOrderStatus, getDailyRevenueByCategory, getTopSellingProducts, getTotalWaste, reconstructStockCount, rt3SpoilStock } from "../generated/remove-order-line.ts";
import { getDailyRevenueByCategory, getTopSellingProducts, getTotalWaste, reconstructStockCount, transitionOrderStatus } from "../generated/get-daily-revenue-by.ts";
import { runAggregate, listAggregateRuns } from "./aggregate.ts";
type StockMovement = {
  id: string;
  productId: string;
  delta: number;
  reason: string;
  timestamp: string;
  resultingCount: number;
};

type SpoilageStore = {
  movements: StockMovement[];
  products: Record<string, { id: string; stockOnHand: number }>;
};

const spoilageStore: SpoilageStore = { movements: [], products: {} };

function spoilageMovementId(productId: string, quantity: number, resultingCount: number, seq: number): string {
  return 'mv-spoil-' + productId + '-' + String(quantity) + '-' + String(resultingCount) + '-' + String(seq);
}

/**
 * Record spoilage for a product: decrement its running count and append a
 * Spoiled movement to the append-only movement log. The operation is refused
 * when the quantity is zero/negative, the product is unknown, or the removal
 * would push stock below zero (no movement is written on refusal).
 *
 * @param productId - The unique product id to record spoilage against.
 * @param quantity - The positive number of spoiled units to remove.
 * @returns The appended Spoiled StockMovement, or a refusal object describing the error.
 */
// req-7
async function recordSpoilage(productId: string, quantity: number): Promise<StockMovement> {
  if (typeof productId !== 'string' || productId.length === 0) {
    return { id: '', productId: productId, delta: 0, reason: 'Spoiled', timestamp: '', resultingCount: 0, error: 'product-not-found' } as unknown as StockMovement;
  }
  if (typeof quantity !== 'number' || !isFinite(quantity) || Math.floor(quantity) !== quantity || quantity <= 0) {
    return { id: '', productId: productId, delta: 0, reason: 'Spoiled', timestamp: '', resultingCount: 0, error: 'invalid-quantity' } as unknown as StockMovement;
  }

  const product: { id: string; stockOnHand: number } | undefined = spoilageStore.products[productId];
  if (product === undefined) {
    return { id: '', productId: productId, delta: 0, reason: 'Spoiled', timestamp: '', resultingCount: 0, error: 'product-not-found' } as unknown as StockMovement;
  }

  const current: number = product.stockOnHand;
  const resultingCount: number = current - quantity;
  if (resultingCount < 0) {
    return {
      id: '',
      productId: productId,
      delta: 0,
      reason: 'Spoiled',
      timestamp: '',
      resultingCount: current,
      error: 'insufficient-stock',
      shortfall: quantity - current
    } as unknown as StockMovement;
  }

  product.stockOnHand = resultingCount;
  const movement: StockMovement = {
    id: spoilageMovementId(productId, quantity, resultingCount, spoilageStore.movements.length + 1),
    productId: productId,
    delta: -quantity,
    reason: 'Spoiled',
    timestamp: '1970-01-01T00:00:00.000Z',
    resultingCount: resultingCount
  };
  spoilageStore.movements.push(movement);
  return movement;
}
export { recordSpoilage };
