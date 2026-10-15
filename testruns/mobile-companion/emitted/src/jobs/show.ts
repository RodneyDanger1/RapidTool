import { renderTabBar, getTodaySummary, renderTodayScreen, listTodayOrders, renderNewOrderScreen, addLineItem, setLineQuantity, TabBar } from "../generated/render-tab-bar.ts";
import { computeCartTotalPence, validateStock, quickAddCustomer, placeOrder, renderStockScreen, stockBadge, openStockSheet, receiveStock } from "../generated/compute-cart-total-pence.ts";
import { suggestReorderQuantity, markReordered, readSnapshot, writeLocalSnapshot, pendingBadgeCount, formatGbp } from "../generated/suggest-reorder-quantity.ts";
import { recordSpoilage } from "./record.ts";
import { runSync, listSyncRuns } from "./sync.ts";
import { searchProducts } from "./search.ts";
type ToastState = {
  orderId: string;
  message: string;
  visible: boolean;
  shownAt: number;
  tone: string;
};

type ToastHost = {
  region: string;
  visible: boolean;
  message: string;
  orderId: string;
};

type ToastOptions = {
  durationMs?: number;
  region?: string;
};

const TOAST_DEFAULT_DURATION_MS = 4000;
const TOAST_REGION_MAIN = "toast-region-main";
const TOAST_TONE_SUCCESS = "success";

const toastState: ToastState = {
  orderId: "",
  message: "",
  visible: false,
  shownAt: 0,
  tone: TOAST_TONE_SUCCESS,
};

let toastClock = 0;
let toastSequence = 0;
let toastTimer: number | null = null;

function normalizeOrderId(orderId: string): string {
  if (typeof orderId !== "string") {
    return "";
  }
  return orderId.trim();
}

function buildSuccessMessage(orderId: string): string {
  return "Order placed — " + orderId;
}

function nextToastClock(): number {
  toastClock = toastClock + 1;
  return toastClock;
}

function nextToastSequence(): number {
  toastSequence = toastSequence + 1;
  return toastSequence;
}

function hideSuccessToast(): void {
  toastState.visible = false;
  toastState.message = "";
  toastState.orderId = "";
  toastState.tone = TOAST_TONE_SUCCESS;
  if (toastTimer !== null) {
    toastTimer = null;
  }
}

/**
 * Show a success toast announcing a freshly placed order. The toast text always
 * contains the order id so the counter workflow can confirm the write, and the
 * visible flag drives the toast region in the DOM. Passing an empty/blank order
 * id is rejected: nothing is shown and the toast state is cleared, so a toast is
 * never rendered without a real id.
 *
 * @param orderId - Identifier of the order that was just created.
 * @returns Nothing; the toast state is updated in place.
 */
// req-6
function showSuccessToast(orderId: string): void {
  const normalized = normalizeOrderId(orderId);
  if (normalized === "") {
    hideSuccessToast();
    return;
  }
  const clock = nextToastClock();
  nextToastSequence();
  toastState.orderId = normalized;
  toastState.message = buildSuccessMessage(normalized);
  toastState.visible = true;
  toastState.shownAt = clock;
  toastState.tone = TOAST_TONE_SUCCESS;
  if (toastTimer !== null) {
    toastTimer = null;
  }
}

/**
 * Read the current success-toast state without mutating it. Returns a plain
 * copy so callers can render the toast region and the reducer can decide
 * whether the toast should auto-dismiss.
 *
 * @returns A copy of the toast state record.
 */
// req-6
function getSuccessToastState(): ToastState {
  return {
    orderId: toastState.orderId,
    message: toastState.message,
    visible: toastState.visible,
    shownAt: toastState.shownAt,
    tone: toastState.tone,
  };
}

/**
 * Describe the toast host element for the success toast: which region it lives
 * in, whether it is visible, and the exact message (which embeds the order id).
 * This is the shape the app renders into the aria-live region.
 *
 * @returns The toast host record for the main toast region.
 */
// req-6
function getToastHost(): ToastHost {
  return {
    region: TOAST_REGION_MAIN,
    visible: toastState.visible,
    message: toastState.message,
    orderId: toastState.orderId,
  };
}

/**
 * Build a success toast for an order id with caller-supplied duration and
 * region options. The order id lands in the message exactly as supplied after
 * trimming; a blank id yields a hidden toast rather than a misleading success.
 *
 * @param orderId - Identifier of the order that was just created.
 * @param options - Optional duration and region overrides.
 * @returns The resulting toast state record.
 */
// req-6
function createSuccessToast(orderId: string, options?: ToastOptions): ToastState {
  const duration = options && typeof options.durationMs === "number" && options.durationMs > 0
    ? options.durationMs
    : TOAST_DEFAULT_DURATION_MS;
  const region = options && typeof options.region === "string" && options.region.length > 0
    ? options.region
    : TOAST_REGION_MAIN;
  const normalized = normalizeOrderId(orderId);
  if (normalized === "") {
    hideSuccessToast();
    return getSuccessToastState();
  }
  const clock = nextToastClock();
  nextToastSequence();
  toastState.orderId = normalized;
  toastState.message = buildSuccessMessage(normalized);
  toastState.visible = true;
  toastState.shownAt = clock;
  toastState.tone = TOAST_TONE_SUCCESS;
  if (duration > 0) {
    const nextTimer = clock + duration;
    toastTimer = nextTimer;
  }
  void region;
  return getSuccessToastState();
}

/**
 * Dismiss the success toast immediately. Used when the toast has been read or
 * when navigation invalidates it. Returns the cleared toast state.
 *
 * @returns The toast state after dismissal.
 */
// req-6
function dismissSuccessToast(): ToastState {
  hideSuccessToast();
  return getSuccessToastState();
}

/**
 * Report whether the success toast is currently visible and, if so, how long it
 * has been visible for. The elapsed value is derived from the deterministic
 * monotonically increasing clock, never from wall time or randomness.
 *
 * @returns Visibility flag plus elapsed ticks since the toast appeared.
 */
// req-6
function successToastRemaining(): { visible: boolean; elapsed: number; orderId: string } {
  const elapsed = toastState.visible && toastState.shownAt > 0
    ? toastClock - toastState.shownAt
    : 0;
  return {
    visible: toastState.visible,
    elapsed: elapsed,
    orderId: toastState.orderId,
  };
}
export { showSuccessToast, getSuccessToastState, getToastHost, createSuccessToast, dismissSuccessToast, successToastRemaining };
