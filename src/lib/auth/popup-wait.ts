/**
 * Live-preview popup wait — the settlement state machine behind `client.ts`'s
 * `waitForPopupToken`, extracted so its timing logic (including the OVERALL
 * timeout) is unit-testable without a browser.
 *
 * The hang this closes: `client.ts` settled the wait on EITHER the completion
 * page's `postMessage` OR the `popup.closed` poll. If the browser blocked both
 * `window.close()` (so `popup.closed` stays false) AND dropped the
 * `postMessage` (a throw inside the popup page's inline script — see
 * `popup.server.ts`), neither event ever fires and `signIn` awaited forever.
 * A hard overall ceiling makes that a bounded `cause: "timeout"` failure.
 *
 * Pure by construction: no imports and no ambient `window` — the browser
 * surface is injected (`PopupWaitHost`) so tests drive a virtual clock.
 */

/** Why a wait settled. Only `token` carries a bearer; the rest resolve null. */
export type PopupWaitCause = "token" | "cancelled" | "timeout" | "failed";

export type PopupWaitOutcome = {
  token: string | null;
  cause: PopupWaitCause;
  /** The popup's own error string, present only on the `failed` cause. */
  error?: string;
};

/** The message the popup completion page posts (mirrors `popup.server.ts`). */
export type PopupWaitMessage = {
  source: "grok-auth-popup";
  token: string | null;
  error?: string;
};

/** The browser surface the wait needs — injected so tests need no DOM. */
export type PopupWaitHost = {
  origin: string;
  addMessageListener(
    listener: (event: { origin: string; source: unknown; data: unknown }) => void,
  ): void;
  removeMessageListener(
    listener: (event: { origin: string; source: unknown; data: unknown }) => void,
  ): void;
  setInterval(handler: () => void, ms: number): number;
  clearInterval(id: number): void;
  setTimeout(handler: () => void, ms: number): number;
  clearTimeout(id: number): void;
};

export type PopupWaitOptions = {
  /** Hard ceiling on the WHOLE wait — the anti-hang bound. */
  timeoutMs?: number;
  /** Grace after `popup.closed` for a racing postMessage to land first. */
  closeGraceMs?: number;
  /** Poll cadence for `popup.closed`. */
  pollMs?: number;
};

/**
 * Overall wait ceiling. Generous — a human may type credentials and clear a
 * 2FA prompt — but finite, so a dropped message + a blocked `window.close()`
 * surfaces as `cause: "timeout"` instead of an indefinite `signIn` hang.
 */
export const POPUP_WAIT_TIMEOUT_MS = 5 * 60 * 1000;
export const POPUP_CLOSE_GRACE_MS = 400;
export const POPUP_POLL_MS = 300;

/**
 * Resolve once the popup either posts a bearer, closes, or the overall ceiling
 * elapses — whichever happens first. The message listener only accepts a
 * message whose `origin` matches and whose `source` is THIS popup, so two
 * concurrent attempts can never settle each other.
 */
export function waitForPopupOutcome(
  popup: { closed: boolean },
  host: PopupWaitHost,
  opts: PopupWaitOptions = {},
): Promise<PopupWaitOutcome> {
  const timeoutMs = opts.timeoutMs ?? POPUP_WAIT_TIMEOUT_MS;
  const closeGraceMs = opts.closeGraceMs ?? POPUP_CLOSE_GRACE_MS;
  const pollMs = opts.pollMs ?? POPUP_POLL_MS;
  return new Promise((resolve) => {
    let settled = false;
    let closeTimer: number | undefined;
    const settle = (outcome: PopupWaitOutcome) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(outcome);
    };
    const onMessage = (event: { origin: string; source: unknown; data: unknown }) => {
      if (event.origin !== host.origin) return;
      if (event.source !== popup) return; // only this attempt's popup may settle us
      const data = event.data as PopupWaitMessage | undefined;
      if (!data || data.source !== "grok-auth-popup") return;
      if (typeof data.token === "string" && data.token.length > 0) {
        settle({ token: data.token, cause: "token" });
        return;
      }
      settle({ token: null, cause: "failed", ...(data.error ? { error: data.error } : {}) });
    };
    // Fallback when the user dismisses the popup. Grace period lets the
    // completion page's postMessage win over a racing `popup.closed`.
    const pollTimer = host.setInterval(() => {
      if (!popup.closed) return;
      host.clearInterval(pollTimer);
      closeTimer = host.setTimeout(() => settle({ token: null, cause: "cancelled" }), closeGraceMs);
    }, pollMs);
    const timeoutTimer = host.setTimeout(() => settle({ token: null, cause: "timeout" }), timeoutMs);
    function cleanup() {
      host.clearInterval(pollTimer);
      if (closeTimer !== undefined) host.clearTimeout(closeTimer);
      host.clearTimeout(timeoutTimer);
      host.removeMessageListener(onMessage);
    }
    host.addMessageListener(onMessage);
  });
}

/**
 * The outcome for a wait that got a definite negative answer — used by the
 * caller to name the failure precisely. `null` means "no bearer, and the wait
 * itself is the whole cause".
 */
export function popupFailureMessage(outcome: PopupWaitOutcome): string {
  if (outcome.cause === "timeout") {
    return "Sign-in timed out — close the sign-in pop-up and try again";
  }
  if (outcome.cause === "failed" && outcome.error) {
    return `Sign-in failed: ${outcome.error}`;
  }
  return "Sign-in was cancelled or failed";
}
