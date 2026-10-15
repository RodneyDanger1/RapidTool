import { getRequest } from "@tanstack/react-start/server";

/**
 * Fetch-Metadata sibling isolation — **server-only** (`.server.ts` suffix).
 *
 * MUST keep the `.server` suffix: this file imports `@tanstack/react-start/server`
 * (`getRequest` → Node `AsyncLocalStorage`). If it is imported from a dual
 * client/server module under a non-`.server` name, Vite ships it to the browser
 * and the app dies with: `AsyncLocalStorage is not a constructor`.
 *
 * Apps deployed on `*.grok.me` are "same-site" to each other but MUTUALLY
 * UNTRUSTED, and a `SameSite=Lax` session cookie IS sent on same-site
 * subrequests — so without this, a malicious sibling could make a SCRIPTED
 * (fetch/XHR/form-POST) request to this app's server functions and ride this
 * app's session cookie.
 *
 * We allow only: same-origin requests (this app's own client), requests with
 * no `Sec-Fetch-Site` header, and top-level GET navigations (how the OAuth
 * callback and normal page loads arrive). Every cross-site / same-site
 * *scripted* request is rejected.
 *
 * Documented residual (inherent to Fetch Metadata): the no-header bucket is
 * not exclusively "SSR / server-to-server". Non-browser HTTP clients, privacy
 * proxies that strip `Sec-Fetch-*`, and legacy engines also land there and
 * bypass sibling isolation. The session is still protected by `__Host-`
 * cookies (a sibling tenant cannot plant them — no `Domain` allowed),
 * Better Auth's `trustedOrigins`, and the fact that cookies only ride on
 * genuine browser requests; this header gate is defense-in-depth, not the
 * last line. Enforced at the `authMiddleware` chokepoint (see `middleware.ts`).
 */
export class CrossSiteRequestError extends Error {
  readonly status = 403;
  constructor() {
    super("Forbidden: cross-site request blocked");
    this.name = "CrossSiteRequestError";
  }
}

/** Throw `CrossSiteRequestError` for a scripted cross-site/sibling request. */
export function assertSameSiteRequest(): void {
  let request: Request | undefined;
  try {
    request = getRequest();
  } catch {
    // No server request context (build, CLI, unit test): getRequest() throws
    // outside the Start runtime rather than returning undefined. There is no
    // request to inspect, so there is nothing to guard — same as the
    // `!request` branch below, and never an internal AsyncLocalStorage error.
    return;
  }
  if (!request) return; // no request context (e.g. build) — nothing to guard
  const h = request.headers;
  const site = h.get("sec-fetch-site");
  // No header: SSR / server-to-server calls, BUT also non-browser clients and
  // proxies that strip Sec-Fetch-* (documented residual — see the header
  // comment). Same-origin and direct (address-bar/bookmark) loads also pass.
  if (!site || site === "same-origin" || site === "none") return;
  // A top-level GET navigation (e.g. the broker's OAuth callback redirect) is
  // fine even when it's cross-site; scripted requests never set navigate mode.
  const dest = h.get("sec-fetch-dest");
  const isTopLevelGet =
    h.get("sec-fetch-mode") === "navigate" &&
    request.method === "GET" &&
    dest !== "object" &&
    dest !== "embed";
  if (isTopLevelGet) return;
  throw new CrossSiteRequestError();
}
