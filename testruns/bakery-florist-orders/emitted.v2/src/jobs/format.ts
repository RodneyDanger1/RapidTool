import { listProducts, createProduct, editProduct, deactivateProduct, createOrder, computeLineTotal, computeOrderTotal, confirmOrder } from "../generated/list-products.ts";
import { cancelOrder, transitionOrderStatus, receiveStock, adjustStock, reconstructStock, checkStockInvariant, getLowStockDashboard, listOrders } from "../generated/cancel-order.ts";
import { countOrdersByStatus, getDailyRevenueByCategory, getTopSellingProducts, getTotalWaste } from "../generated/count-orders-by-status.ts";
import { runAggregate, listAggregateRuns } from "./aggregate.ts";
import { recordSpoilage } from "./record.ts";
/**
 * Format an integer amount of pence as a GBP currency string.
 *
 * Money is always handled as integer minor units (pence); this is the only
 * place money becomes a display string, and the conversion is exact with no
 * floating-point drift. Zero and large values format exactly.
 *
 * @param pence integer amount in pence
 * @returns the amount formatted as GBP, e.g. "£12.34"
 */
// req-11
function formatGBP(pence: number): string {
  const numeric: number = Number(pence);
  if (!isFinite(numeric) || Math.floor(numeric) !== numeric) {
    return "£0.00";
  }
  const negative: boolean = numeric < 0;
  const absolute: number = negative ? -numeric : numeric;
  const wholePounds: number = Math.floor(absolute / 100);
  const remainderPence: number = absolute - wholePounds * 100;
  const penceText: string = remainderPence < 10 ? "0" + String(remainderPence) : String(remainderPence);
  const poundsText: string = String(wholePounds);
  return (negative ? "-£" : "£") + poundsText + "." + penceText;
}
export { formatGBP };
