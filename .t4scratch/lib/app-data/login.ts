import type { CallToolResult } from "./types.ts";

export function isLoginRequired(result: CallToolResult): boolean {
  return result.ok === false && result.loginRequired === true;
}

function isFramed(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function redirectToLoginIfRequired(result: CallToolResult): boolean {
  if (!isLoginRequired(result)) return false;
  const url = result.loginUrl;
  if (typeof url !== "string" || url.length === 0) return false;
  // F3 sweep: loginUrl becomes a window.open / location.assign target, so it
  // must be an absolute http(s) URL. A corrupt or buggy gate envelope that
  // carries loginUrl "javascript:..." / "data:..." must never turn into a
  // navigation (javascript: URLs execute in the page context).
  if (!/^https?:\/\//i.test(url)) return false;
  if (typeof window === "undefined") return false;
  if (isFramed()) {
    // The gate sign-in origin refuses framing, so navigating THIS iframe
    // would silently do nothing (cross-origin iframe navigation without user
    // activation is browser-blocked) while still reporting "handled" — the
    // caller would hide its affordances and the visitor stays stranded.
    // When the popup is blocked, report NOT handled so the caller can surface
    // an "allow pop-ups for this site" message.
    const opened = window.open(url, "_blank");
    if (!opened) return false;
    opened.opener = null;
    return true;
  }
  // Top level (not framed): a plain navigation is fine — the gate page loads
  // in this tab and redirects back on completion.
  window.location.assign(url);
  return true;
}
