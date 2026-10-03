/**
 * One-shot HTTPS transport for the LLM providers (W45 · 331-1 "Keywright").
 *
 * WHY THIS EXISTS. The providers used the global undici `fetch`. On Node
 * 24/Windows an undici TLS teardown handle races the CLI's deliberate in-tick
 * `process.exit()` and libuv asserts — `Assertion failed: !(handle->flags &
 * UV_HANDLE_CLOSING), file src\win\async.c, line 76` (exit `0xC0000409`) — AFTER
 * the correct JSON envelope was already written. So a red keyed call exited
 * through a crash, not the exit taxonomy, and a green one could too.
 *
 * 327 L2 (fixes/327_l2_cli_exit.md) proved the root cause and the fix for the
 * keyless search probe: undici's global `fetch` cannot be used where a
 * `process.exit()` follows; `node:https`/`node:http` with `agent: false` is a
 * one-shot, never-pooled connection whose handle cannot outlive the call. This
 * module is that transport for the LLM provider graph. (The 327 probe matrix
 * also showed global-dispatcher `.close()`/`.destroy()` does NOT avoid the
 * assertion and a ~100 ms drain does — hence a transport change, not a CLI
 * exit change; the in-tick exit is a load-bearing fixes/217e G1 contract.)
 *
 * TEST SEAM. Suites fake the network by replacing `globalThis.fetch` (e.g.
 * `llm.test.ts`, `chat.test.ts`). `oneShotFetch` defers to `globalThis.fetch`
 * whenever it is not the native reference captured at load — so an injected
 * stub keeps intercepting exactly as before, and the node:https path is used
 * only for a real, unstubbed call. A non-string `input` also defers.
 *
 * Server-only: imports node: builtins. Never import from client code.
 */

import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { brotliDecompressSync, gunzipSync, inflateSync } from "node:zlib";

const MAX_REDIRECTS = 5;

function abortError(): Error {
  const err = new Error("The operation was aborted");
  err.name = "AbortError";
  return err;
}

/** Decompress a body by `content-encoding` (identity on anything else/on error). */
function decodeBody(body: Buffer, encoding: string | string[] | undefined): string {
  const enc = (Array.isArray(encoding) ? encoding[0] : (encoding ?? "")).toLowerCase().trim();
  try {
    if (enc === "gzip" || enc === "x-gzip") return gunzipSync(body).toString("utf8");
    if (enc === "deflate") return inflateSync(body).toString("utf8");
    if (enc === "br") return brotliDecompressSync(body).toString("utf8");
  } catch {
    /* unsupported/corrupt encoding → raw bytes below */
  }
  return body.toString("utf8");
}

function normalizeHeaders(headers: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!headers) return out;
  if (Array.isArray(headers)) {
    for (const [k, v] of headers) out[k] = v;
    return out;
  }
  const maybeHeaders = headers as Headers;
  if (typeof maybeHeaders.forEach === "function" && typeof maybeHeaders.entries === "function") {
    maybeHeaders.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  for (const [k, v] of Object.entries(headers as Record<string, string>)) out[k] = v;
  return out;
}

/**
 * Headers that must NEVER cross an origin-changing redirect (fetch semantics,
 * WHATWG fetch §HTTP-redirect-fetch). This transport carries the provider API
 * key in `authorization`; forwarding it to whatever host a `Location` names
 * would leak the credential to a third party.
 */
function stripCrossOriginSecrets(headers: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(normalizeHeaders(headers))) {
    const n = k.toLowerCase();
    if (n === "authorization" || n === "cookie" || n === "proxy-authorization") continue;
    out[k] = v;
  }
  return out;
}

function bodyToString(body: BodyInit | null | undefined): string | null {
  if (body === null || body === undefined) return null;
  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) return Buffer.from(body).toString("utf8");
  if (body instanceof ArrayBuffer) return Buffer.from(body).toString("utf8");
  if (typeof URLSearchParams !== "undefined" && body instanceof URLSearchParams) {
    return body.toString();
  }
  return String(body);
}

function toResponse(status: number, text: string): Response {
  // The Response constructor rejects a body for these statuses.
  const body = status === 204 || status === 205 || status === 304 ? null : text;
  return new Response(body, { status });
}

/** One request over a never-pooled node:http(s) connection, following redirects. */
function requestOnce(
  url: string,
  init: RequestInit,
  redirectsLeft = MAX_REDIRECTS,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch (err) {
      reject(err instanceof Error ? err : new Error(String(err)));
      return;
    }
    const doRequest = parsed.protocol === "http:" ? httpRequest : httpsRequest;
    const headers = normalizeHeaders(init.headers);
    const body = bodyToString(init.body);
    const hasContentLength = Object.keys(headers).some(
      (k) => k.toLowerCase() === "content-length",
    );
    if (body !== null && !hasContentLength) {
      headers["content-length"] = String(Buffer.byteLength(body));
    }
    const req = doRequest(
      parsed,
      { method: init.method ?? "GET", headers, agent: false },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location && redirectsLeft > 0) {
          res.resume(); // drain the redirect socket so it closes here
          const keepMethod = status === 307 || status === 308;
          const nextUrl = new URL(location, parsed);
          const nextInit: RequestInit = {
            ...init,
            method: keepMethod ? init.method : "GET",
            body: keepMethod ? init.body : undefined,
            // A redirect to a DIFFERENT origin drops the credential headers;
            // the same origin keeps them (fetch's own rule).
            ...(nextUrl.origin !== parsed.origin
              ? { headers: stripCrossOriginSecrets(init.headers) }
              : {}),
          };
          requestOnce(nextUrl.toString(), nextInit, redirectsLeft - 1).then(
            resolve,
            reject,
          );
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          const text = decodeBody(Buffer.concat(chunks), res.headers["content-encoding"]);
          resolve(toResponse(status, text));
        });
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    const signal = init.signal ?? undefined;
    if (signal) {
      if (signal.aborted) {
        req.destroy(abortError());
        return;
      }
      const onAbort = () => req.destroy(abortError());
      signal.addEventListener("abort", onAbort, { once: true });
      req.on("close", () => signal.removeEventListener("abort", onAbort));
    }
    if (body !== null) req.end(body);
    else req.end();
  });
}

const INITIAL_FETCH: typeof fetch = globalThis.fetch;
const CAPTURED_NATIVE = typeof INITIAL_FETCH === "function" && INITIAL_FETCH.name === "fetch";

/**
 * Production transport: a one-shot node:https/http request — unless a caller
 * replaced `globalThis.fetch` (the test seam), in which case the current
 * function is used untouched.
 */
export const oneShotFetch: typeof fetch = ((
  input: RequestInfo | URL,
  init?: RequestInit,
) => {
  const current = globalThis.fetch;
  if (current !== INITIAL_FETCH || !CAPTURED_NATIVE || typeof input !== "string") {
    return current(input, init);
  }
  return requestOnce(input, init ?? {});
}) as typeof fetch;
