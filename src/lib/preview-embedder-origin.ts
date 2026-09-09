/**
 * Trust model for the grok-web ↔ sandbox preview postMessage bridge.
 *
 * The guest page (this app) only ever talks to its direct parent frame, and
 * only when the parent's origin passes these checks:
 *  - `*.grok.com` / `grok.com` (the Grok chat embedder) — HTTPS only.
 *    Plaintext `http://grok.com` is never trusted: an attacker who can
 *    downgrade the parent page could otherwise drive in-app navigation.
 *  - Loopback (`localhost`, `127.0.0.1`, `[::1]`) — HTTP allowed, because a
 *    local Grok dev harness embedding the app has no TLS.
 *  - Sandbox guest pages (`*.grok-sandbox.com`) may additionally be paired
 *    with a same-suffix parent host (see isRemintPreviewPair).
 */

export function isGrokEmbedderOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1" || host === "[::1]") return true;
    if (host === "grok.com" || host.endsWith(".grok.com")) {
      return url.protocol === "https:";
    }
    return false;
  } catch {
    return false;
  }
}

export function isSandboxPreviewGuestHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === "grok-sandbox.com" || host.endsWith(".grok-sandbox.com");
}

function isRemintPreviewPair(guestHost: string, parentHost: string): boolean {
  const guest = guestHost.toLowerCase();
  const parent = parentHost.toLowerCase();
  const sep = ".preview.";
  const i = guest.indexOf(sep);
  if (i <= 0) return false;
  const label = guest.slice(0, i);
  const rest = guest.slice(i + sep.length);
  if (label.includes(".") || !rest.includes(".")) return false;
  return parent === rest || parent === `grok.${rest}`;
}

export function resolveParentEmbedderOrigin(
  parentIsSelf: boolean,
  referrer: string,
  ancestorOrigin?: string | null,
  guestHostname: string = "",
): string | null {
  if (parentIsSelf) return null;
  for (const candidate of [referrer, ancestorOrigin ?? ""].filter(Boolean)) {
    try {
      const url = new URL(
        candidate.includes("://") ? candidate : `https://${candidate}`,
      );
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      if (isGrokEmbedderOrigin(url.origin)) return url.origin;
      if (
        isSandboxPreviewGuestHost(guestHostname) ||
        isRemintPreviewPair(guestHostname, url.hostname)
      ) {
        return url.origin;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}
