import { renderTabBar, getTodaySummary, renderTodayScreen, listTodayOrders, renderNewOrderScreen, addLineItem, setLineQuantity, TabBar } from "../generated/render-tab-bar.ts";
import { computeCartTotalPence, validateStock, quickAddCustomer, placeOrder, renderStockScreen, stockBadge, openStockSheet, receiveStock } from "../generated/compute-cart-total-pence.ts";
import { suggestReorderQuantity, markReordered, readSnapshot, writeLocalSnapshot, pendingBadgeCount, formatGbp } from "../generated/suggest-reorder-quantity.ts";
import { recordSpoilage } from "./record.ts";
import { runSync, listSyncRuns } from "./sync.ts";
import { searchProducts } from "./search.ts";
import { showSuccessToast, getSuccessToastState, getToastHost, createSuccessToast, dismissSuccessToast, successToastRemaining } from "./show.ts";
type LowStockAlert = {
  productId: string;
  productName: string;
  onHand: number;
  reorderLevel: number;
  suggestedQuantity: number;
  createdAt: string;
};

type SnapshotProduct = {
  id: string;
  name: string;
  onHand: number;
  reorderLevel: number;
  pricePence: number;
};

type Snapshot = {
  products: SnapshotProduct[];
  orders: unknown[];
  movements: unknown[];
};

function alertIsLowStock(product: SnapshotProduct): boolean {
  return product.onHand <= product.reorderLevel;
}

function alertSuggestedQuantity(product: SnapshotProduct): number {
  const shortfall: number = product.reorderLevel - product.onHand;
  if (shortfall > 0) {
    return shortfall;
  }
  return product.reorderLevel > 0 ? product.reorderLevel : 1;
}

function alertSortTime(alert: LowStockAlert): number {
  const parsed: number = Date.parse(alert.createdAt);
  if (isNaN(parsed)) {
    return 0;
  }
  return parsed;
}

/**
 * Derive the low-stock alerts from a local snapshot.
 *
 * A product qualifies when its on-hand quantity is at or below its reorder
 * level. The suggested reorder quantity is derived from the reorder level
 * (the shortfall when stock is below it, otherwise the reorder level itself).
 * Results are returned newest first.
 *
 * @param snapshot - The locally persisted snapshot (products, orders, movements).
 * @returns Low-stock alerts, newest first, with derived suggested quantities.
 */
function listLowStockAlerts(snapshot: Snapshot): LowStockAlert[] {
  // req-9
  const alerts: LowStockAlert[] = [];
  if (snapshot === null || snapshot === undefined) {
    return alerts;
  }
  const products: SnapshotProduct[] = Array.isArray(snapshot.products) ? snapshot.products : [];
  let index: number = 0;
  while (index < products.length) {
    const product: SnapshotProduct = products[index];
    index = index + 1;
    if (product === null || product === undefined) {
      continue;
    }
    if (alertIsLowStock(product)) {
      const stamp: string =
        typeof product.id === "string" && product.id.length > 0
          ? product.id
          : "product-" + String(index);
      alerts.push({
        productId: product.id,
        productName: product.name,
        onHand: product.onHand,
        reorderLevel: product.reorderLevel,
        suggestedQuantity: alertSuggestedQuantity(product),
        createdAt: stamp,
      });
    }
  }
  alerts.sort(function (left: LowStockAlert, right: LowStockAlert): number {
    return alertSortTime(right) - alertSortTime(left);
  });
  return alerts;
}

/**
 * Render the Alerts screen: low-stock items newest first, each showing the
 * suggested reorder quantity and a one-tap "Mark Reordered" action. Marking an
 * item reordered only records a note -- it never changes any stock quantity.
 *
 * @param alerts - The low-stock alerts to display, already ordered newest first.
 * @param onMarkReordered - Handler invoked with the product id when "Mark Reordered" is activated.
 * @returns The Alerts screen element.
 */
function renderAlertsScreen(
  alerts: LowStockAlert[],
  onMarkReordered: (productId: string) => Promise<void>
): JSX.Element {
  // req-9
  // req-12
  const rows: JSX.Element[] = [];
  const items: LowStockAlert[] = Array.isArray(alerts) ? alerts : [];
  let index: number = 0;
  while (index < items.length) {
    const alert: LowStockAlert = items[index];
    index = index + 1;
    rows.push(
      jsx(
        "li",
        { key: alert.productId, className: "alerts-row" },
        jsx("span", { className: "alerts-name" }, alert.productName),
        jsx("span", { className: "alerts-on-hand" }, "On hand: " + String(alert.onHand)),
        jsx("span", { className: "alerts-reorder-level" }, "Reorder at: " + String(alert.reorderLevel)),
        jsx(
          "span",
          { className: "alerts-suggested" },
          "Suggested: " + String(alert.suggestedQuantity)
        ),
        jsx(
          "button",
          {
            type: "button",
            className: "alerts-mark-reordered",
            ariaLabel: "Mark " + alert.productName + " reordered",
            onClick: function (): void {
              const result: Promise<void> = onMarkReordered(alert.productId);
              if (result && typeof result.then === "function") {
                result.then(
                  function (): void {
                    return;
                  },
                  function (): void {
                    return;
                  }
                );
              }
            },
          },
          "Mark Reordered"
        )
      )
    );
  }

  const body: JSX.Element =
    rows.length > 0
      ? jsx("ul", { className: "alerts-list" }, rows)
      : jsx(
          "p",
          { className: "alerts-empty-state" },
          "No items need reordering right now."
        );

  return jsx(
    "section",
    { className: "alerts-screen", ariaLabel: "Alerts" },
    jsx("h1", { className: "alerts-title" }, "Alerts"),
    body,
    jsx(
      "div",
      { className: "alerts-sticky-action" },
      jsx(
        "button",
        { type: "button", className: "alerts-refresh", ariaLabel: "Refresh alerts" },
        "Refresh"
      )
    )
  );
}
export { renderAlertsScreen, listLowStockAlerts };
