import { renderTabBar, getTodaySummary, renderTodayScreen, listTodayOrders, renderNewOrderScreen, addLineItem, setLineQuantity, TabBar } from "../generated/render-tab-bar.ts";
import { computeCartTotalPence, validateStock, quickAddCustomer, placeOrder, renderStockScreen, stockBadge, openStockSheet, receiveStock } from "../generated/compute-cart-total-pence.ts";
import { suggestReorderQuantity, markReordered, readSnapshot, writeLocalSnapshot, pendingBadgeCount, formatGbp } from "../generated/suggest-reorder-quantity.ts";
/**
 * Record spoilage of a product: persist a signed stock movement (negative delta)
 * and update on-hand stock atomically, using the shared back-office contracts.
 *
 * Contract notes:
 * - The movement uses the shared StockMovement shape: id, productId, delta
 *   (signed integer units), reason, createdAt (ISO timestamp).
 * - On-hand stock is never allowed to fall below zero: spoilage larger than
 *   on-hand is clamped to the available quantity and an explicit message is
 *   returned instead of silently becoming negative.
 * - Reason is required; an empty reason is rejected with a visible validation
 *   message and no movement is written.
 * - Quantity must be a positive integer; non-integer, zero, negative or
 *   absurdly large values are rejected with a clear message.
 *
 * @param productId - The product the spoilage belongs to.
 * @param quantity - Units spoiled (positive number).
 * @param reason - Required reason for the spoilage.
 * @returns A promise resolving to the persisted StockMovement.
 */
// req-8
async function recordSpoilage(productId: string, quantity: number, reason: string): Promise<StockMovement> {
  if (typeof productId !== 'string' || productId.length === 0) {
    throw new Error('recordSpoilage: a product id is required.');
  }
  if (typeof reason !== 'string' || reason.trim().length === 0) {
    throw new Error('recordSpoilage: a reason is required to record spoilage.');
  }
  if (typeof quantity !== 'number' || !isFinite(quantity) || Math.floor(quantity) !== quantity) {
    throw new Error('recordSpoilage: quantity must be a whole number.');
  }
  if (quantity <= 0) {
    throw new Error('recordSpoilage: quantity must be greater than zero.');
  }
  if (quantity > 1000000) {
    throw new Error('recordSpoilage: quantity is out of range.');
  }
  const snapshot: Snapshot = await readSnapshot();
  const onHand: number = findOnHand(snapshot, productId);
  if (onHand <= 0) {
    throw new Error('recordSpoilage: no on-hand stock available to spoil.');
  }
  const applied: number = quantity > onHand ? onHand : quantity;
  const clamped: boolean = applied !== quantity;
  const movement: StockMovement = makeStockMovement(productId, -applied, reason.trim(), snapshot);
  const nextMovements: StockMovement[] = appendMovement(snapshot.movements, movement);
  const nextProducts: Product[] = applyDeltaToProducts(snapshot.products, productId, -applied);
  const nextSnapshot: Snapshot = makeSnapshot(nextProducts, snapshot.orders, nextMovements, snapshot.customers);
  await writeLocalSnapshot(nextSnapshot);
  if (clamped) {
    movement.reason = movement.reason + ' (clamped to on-hand stock)';
  }
  return movement;
}

type StockMovement = {
  id: string;
  productId: string;
  delta: number;
  reason: string;
  createdAt: string;
};

type Product = {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
  onHand: number;
  reorderLevel: number;
  pricePence: number;
};

type Order = {
  id: string;
  status: string;
  updatedAt: string;
  fulfilmentDate: string;
  customerId: string;
  lines: { productId: string; quantity: number; unitPricePence: number }[];
  totalPence: number;
  pending: boolean;
};

type Customer = {
  id: string;
  name: string;
  phone: string;
  status: string;
  updatedAt: string;
};

type Snapshot = {
  products: Product[];
  orders: Order[];
  movements: StockMovement[];
  customers: Customer[];
};

function findOnHand(snapshot: Snapshot, productId: string): number {
  for (let i = 0; i < snapshot.products.length; i = i + 1) {
    if (snapshot.products[i].id === productId) {
      return snapshot.products[i].onHand;
    }
  }
  return 0;
}

function applyDeltaToProducts(products: Product[], productId: string, delta: number): Product[] {
  const next: Product[] = [];
  for (let i = 0; i < products.length; i = i + 1) {
    const product: Product = products[i];
    if (product.id === productId) {
      let onHand: number = product.onHand + delta;
      if (onHand < 0) {
        onHand = 0;
      }
      next.push(makeProduct(product.id, product.name, product.status, product.updatedAt, onHand, product.reorderLevel, product.pricePence));
    } else {
      next.push(product);
    }
  }
  return next;
}

function makeProduct(id: string, name: string, status: string, updatedAt: string, onHand: number, reorderLevel: number, pricePence: number): Product {
  return { id: id, name: name, status: status, updatedAt: updatedAt, onHand: onHand, reorderLevel: reorderLevel, pricePence: pricePence };
}

function makeSnapshot(products: Product[], orders: Order[], movements: StockMovement[], customers: Customer[]): Snapshot {
  return { products: products, orders: orders, movements: movements, customers: customers };
}

function appendMovement(movements: StockMovement[], movement: StockMovement): StockMovement[] {
  const next: StockMovement[] = [];
  for (let i = 0; i < movements.length; i = i + 1) {
    next.push(movements[i]);
  }
  next.push(movement);
  return next;
}

function makeStockMovement(productId: string, delta: number, reason: string, snapshot: Snapshot): StockMovement {
  return {
    id: makeMovementId(productId, delta, reason, snapshot),
    productId: productId,
    delta: delta,
    reason: reason,
    createdAt: makeTimestamp(snapshot.movements.length)
  };
}

function makeMovementId(productId: string, delta: number, reason: string, snapshot: Snapshot): string {
  const seed: string = productId + '|' + String(delta) + '|' + reason + '|' + String(snapshot.movements.length);
  return 'mv_' + hashSeed(seed);
}

function makeTimestamp(offset: number): string {
  const base: number = Date.UTC(2024, 0, 1, 0, 0, 0);
  return new Date(base + offset * 1000).toISOString();
}

function hashSeed(seed: string): string {
  let hash: number = 2166136261;
  for (let i = 0; i < seed.length; i = i + 1) {
    hash = hash ^ seed.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(36);
}
export { recordSpoilage };
