/**
 * Target checks shared by the Playwright capture scripts.
 *
 * Both run Chromium with `--no-sandbox` as root and take their URL and output
 * path from argv, so unchecked they will render `file:///root/.grok/auth.json`
 * into a PNG the agent can read, and write it anywhere.
 *
 * R11-f06 (S-04): the output-path check FAILS CLOSED on win32 for POSIX-literal
 * allow-dirs (the `/workspace` contract). `resolve("/workspace")` on win32 is a
 * drive-relative path (C:\workspace under a C: cwd) — a drive root the caller
 * never named — and the old accept silently wrote there. Containment is also
 * PHYSICAL now: both sides are realpath'd (scripts/path-safety.mjs) so a
 * symlinked/junctioned parent cannot pass the lexical compare while landing
 * outside the allowed dir.
 */
import { resolve, sep } from "node:path";
import { physicalInside } from "./path-safety.mjs";

// W42 L4-G4 (q2 A-101): bare "::1" was a DEAD entry — WHATWG `URL.hostname`
// serializes the IPv6 loopback as "[::1]" (bracketed), so the bare spelling
// could never match `checkedUrl`'s `parsed.hostname` lookup. Exported so the
// pin can assert the reachable form directly.
export const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]"]);

/** http/https loopback only, else exit 1. `BROWSER_ALLOW_EXTERNAL_HOST=1` opts out. */
export function checkedUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    fail(`not a valid URL: ${url}`);
    // Unreachable (fail exits); it proves `parsed` is assigned to the checker.
    return url;
  }
  // Rules out file:, data:, chrome:, view-source:.
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    fail(`only http/https URLs are allowed, got ${parsed.protocol} in ${url}`);
  }
  if (!LOOPBACK_HOSTNAMES.has(parsed.hostname) && process.env.BROWSER_ALLOW_EXTERNAL_HOST !== "1") {
    fail(
      `${parsed.hostname} is not a loopback host; these scripts screenshot the ` +
        `local dev server. Set BROWSER_ALLOW_EXTERNAL_HOST=1 to override.`,
    );
  }
  return url;
}

/** Absolute `target` if it is strictly inside `allowedDirs`, else exit 1. */
export function checkedOutputPath(target, allowedDirs, label = "screenshot") {
  const abs = resolve(target);
  // R11-f06: a POSIX-literal allow-dir (e.g. "/workspace") has no physical
  // meaning on win32 — resolve() maps it onto a drive root the caller never
  // granted (C:\workspace). Fail closed instead of writing there.
  if (process.platform === "win32") {
    const posixLiteral = allowedDirs.find(
      (dir) => typeof dir === "string" && dir.startsWith("/") && !dir.startsWith("//"),
    );
    if (posixLiteral) {
      fail(
        `${label} path check failed closed on win32: allowed dir ${JSON.stringify(posixLiteral)} is a ` +
          `POSIX-style path, which on win32 silently resolves to ${resolve(posixLiteral)} — a drive ` +
          `root the caller never named (S-04/R11-f06). Pass a real Windows directory as the allowed dir.`,
      );
    }
  }
  const allowed = allowedDirs.some((dir) => {
    const dirAbs = resolve(dir);
    // Resolve first so `..` cannot slip past the prefix check.
    const prefixOk = abs.startsWith(dirAbs.endsWith(sep) ? dirAbs : dirAbs + sep);
    if (!prefixOk) return false;
    // R11-f07 (S-05): physical containment — realpath both sides so a
    // symlinked/junctioned parent cannot pass the lexical compare while the
    // bytes land outside. Confirmed-outside refuses; `null` (unverifiable)
    // keeps the lexical verdict, which is the pre-R11-f07 law.
    return physicalInside(dirAbs, abs) !== false;
  });
  if (!allowed) {
    fail(`${label} path must be under ${allowedDirs.join(" or ")}, got ${abs}`);
  }
  return abs;
}

/** Refuse and exit. `@returns {never}` — callers depend on this for definite
 *  assignment of values set just before the call (e.g. `parsed` in checkedUrl). */
function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}
