import { createProduct, editProduct, deactivateProduct, reactivateProduct, listProducts, createOrder, addOrderLine, updateOrderLine } from "../generated/create-product.ts";
import { removeOrderLine, confirmOrder, cancelOrder, receiveStock, adjustStock, getLowStockDashboard, listOrders, getStatusSummary, transitionOrderStatus, getDailyRevenueByCategory, getTopSellingProducts, getTotalWaste, reconstructStockCount, rt3SpoilStock } from "../generated/remove-order-line.ts";
import { getDailyRevenueByCategory, getTopSellingProducts, getTotalWaste, reconstructStockCount, transitionOrderStatus } from "../generated/get-daily-revenue-by.ts";
import { runAggregate, listAggregateRuns } from "./aggregate.ts";
import { recordSpoilage } from "./record.ts";
// src/jobs/format.ts
// Presentation-layer money formatting for Crumb & Bloom. All money in this
// project is stored and computed as integer minor units (pence); the ONLY
// place pence become a human string is here, at the edge. No float arithmetic
// ever touches a monetary value in this module.

// req-13
/**
 * Format an integer amount of minor units (pence) as a GBP display string.
 *
 * The computation is done entirely with integer pence arithmetic: the sign is
 * separated, the value is split into whole pounds and remaining pence with
 * Math.trunc division, and the pence remainder is zero-padded to two digits.
 * No floating-point arithmetic is performed on the amount, so an amount that
 * cannot be represented exactly as a binary float (e.g. 1999) still renders
 * correctly as "£19.99".
 *
 * Behaviour:
 * - `formatGBP(0)` -> "£0.00"
 * - `formatGBP(1234)` -> "£12.34"
 * - `formatGBP(-550)` -> "-£5.50" (the sign precedes the currency symbol)
 * - a non-finite or non-integer amount is refused with an Error naming the
 *   offending value rather than silently rendering a corrupt figure.
 *
 * @param minorUnits integer pence (may be negative for refunds/adjustments)
 * @returns the display string, e.g. "£12.34"
 */
function formatGBP(minorUnits: number): string {
  if (typeof minorUnits !== 'number' || !isFinite(minorUnits)) {
    throw new Error(
      'Invalid money amount: expected a finite integer number of pence, received ' +
        String(minorUnits)
    );
  }
  if (Math.trunc(minorUnits) !== minorUnits) {
    throw new Error(
      'Invalid money amount: expected an integer number of pence, received ' +
        String(minorUnits)
    );
  }

  const negative: boolean = minorUnits < 0;
  const absolute: number = negative ? -minorUnits : minorUnits;

  const pounds: number = Math.trunc(absolute / 100);
  const pence: number = absolute - pounds * 100;

  const penceText: string = pence < 10 ? '0' + String(pence) : String(pence);
  const poundsText: string = String(pounds);

  return (negative ? '-£' : '£') + poundsText + '.' + penceText;
}
export { formatGBP };
