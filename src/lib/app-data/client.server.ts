import { createHash } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import {
  assertSameSiteRequest,
  CrossSiteRequestError,
} from "../auth/isolation.server.ts";
import { assertAppDataServerOnly } from "./server-only.ts";
import {
  CONNECTOR_TOKEN_HEADER,
  ConnectorType,
  type CallToolOptions,
  type CallToolResult,
  type ToolArgs,
} from "./types.ts";

assertAppDataServerOnly("app-data/client.server");

export const CONNECTORS_HOST_STAGING = "connectors.app-builder-testing.com";
export const CONNECTORS_HOST_PROD = "connectors.grok.me";

function env(key: string): string | undefined {
  const v = process.env[key]?.trim();
  return v || undefined;
}

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}

type InboundContext = {
  token: string | null;
  publicHost: string | null;
  connectorsBase: string | null;
};

function connectorsBaseFor(publicHost: string | null): string | null {
  const explicit = env("GROK_CONNECTORS_URL");
  if (explicit) return explicit.replace(/\/+$/, "");

  const host = publicHost?.toLowerCase();
  if (!host || isLoopbackHost(host)) return null;
  if (
    host === "app-builder-testing.com" ||
    host.endsWith(".app-builder-testing.com")
  ) {
    return `https://${CONNECTORS_HOST_STAGING}`;
  }
  if (host === "grok.me" || host.endsWith(".grok.me")) {
    return `https://${CONNECTORS_HOST_PROD}`;
  }
  return null;
}

function tryGetRequest(): Request | null {
  try {
    return getRequest() ?? null;
  } catch {
    return null;
  }
}

function inboundContext(): InboundContext {
  const req = tryGetRequest();
  const xf = req?.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const publicHost =
    (xf || req?.headers.get("host") || "").split(":")[0]?.trim() || null;
  const headerToken = req?.headers.get(CONNECTOR_TOKEN_HEADER)?.trim() || null;
  const envToken =
    process.env.NODE_ENV === "production"
      ? null
      : (env("GROK_CONNECTOR_ACCESS_TOKEN") ?? null);
  return {
    token: headerToken ?? envToken,
    publicHost,
    connectorsBase: connectorsBaseFor(publicHost),
  };
}

type GateJson = {
  ok?: boolean;
  data?: unknown;
  errorMessage?: string;
  loginUrl?: string;
};

/**
 * F3 sweep: gate JSON is untrusted — `errorMessage` may be any JSON value (a
 * number like 42, a nested object, a boolean) — but `CallToolResult.errorMessage`
 * is a string contract that every consumer branches on (.toLowerCase(),
 * .includes(), rendering). Coerce at the result boundary so a corrupt gate
 * payload can never crash a UI/classifier: strings pass through, nullish →
 * undefined, everything else is JSON-ified.
 */
function errorMessageText(v: unknown): string | undefined {
  if (typeof v === "string") return v.length > 0 ? v : undefined;
  if (v === undefined || v === null) return undefined;
  if (v instanceof Error) return v.message;
  try {
    const json = JSON.stringify(v);
    return json === undefined ? undefined : json;
  } catch {
    return String(v);
  }
}

async function gatePost(
  ctx: InboundContext,
  body: Record<string, unknown>,
  token: string,
): Promise<{ status: number; json: GateJson }> {
  const base = ctx.connectorsBase;
  if (!base) {
    // Coded (RT_E_INTERNAL): the server request arrived without the host the
    // gate resolver needs — an environment/wiring failure, not caller input.
    throw Object.assign(
      new Error(
        "cannot resolve gate host (missing x-forwarded-host/host on the server request); " +
          "open the app through the gated public URL so the gate can proxy and inject credentials",
      ),
      { code: "RT_E_INTERNAL" },
    );
  }

  if (!/^https?:\/\//i.test(base)) {
    // Coded (RT_E_VALIDATION): the configured gate base failed the
    // absolute-URL rule — a config-value refusal.
    throw Object.assign(
      new Error(`gate base must be absolute http(s) URL (got ${base}); refusing relative fetch`),
      { code: "RT_E_VALIDATION" },
    );
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    accept: "application/json",
    authorization: `Bearer ${token}`,
  };
  if (ctx.publicHost) {
    headers["x-forwarded-host"] = ctx.publicHost;
  }

  const res = await fetch(`${base}/call-tool`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    redirect: "manual",
  });

  let json: GateJson = {};
  const text = await res.text();
  if (text) {
    try {
      json = JSON.parse(text) as GateJson;
    } catch {
      json = {
        ok: false,
        errorMessage: `gate non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`,
      };
    }
  } else if (res.status >= 200 && res.status < 300) {
    // CORE sweep (58_ready_core): a 2xx response with an EMPTY body is a
    // truncated/proxy-failed gate reply, never a successful tool call — the
    // old fall-through reported `ok:true, data:null` (fabricated success).
    // Callers must see an honest failure instead of acting on nothing.
    json = {
      ok: false,
      errorMessage: `gate empty response (HTTP ${res.status}) — body missing or truncated`,
    };
  }

  return { status: res.status, json };
}

function gateSigninUrl(ctx: InboundContext): string | undefined {
  const base = ctx.connectorsBase;
  if (!base) return undefined;
  try {
    const connectorsHost = new URL(base).host.toLowerCase();
    const gateHost = connectorsHost.replace(/^connectors\./, "gate.");
    if (gateHost === connectorsHost) return undefined;
    const publicHost = ctx.publicHost?.toLowerCase();
    const gated =
      publicHost && !isLoopbackHost(publicHost)
        ? `https://${publicHost}`
        : undefined;
    const signin = `https://${gateHost}/__gate/signin`;
    return gated
      ? `${signin}?return_to=${encodeURIComponent(gated)}`
      : signin;
  } catch {
    return undefined;
  }
}

function missingAuthResult(ctx: InboundContext): CallToolResult {
  const loginUrl = gateSigninUrl(ctx);
  return {
    ok: false,
    data: null,
    loginRequired: true,
    errorMessage:
      "missing_connector_token: open this app through the edge gate " +
      "(the server must receive x-connector-access-token on the inbound request)",
    ...(loginUrl ? { loginUrl } : {}),
  };
}

function crossSiteBlockedResult(): CallToolResult | null {
  try {
    assertSameSiteRequest();
    return null;
  } catch (e) {
    if (e instanceof CrossSiteRequestError) {
      return { ok: false, data: null, errorMessage: e.message };
    }
    return null;
  }
}

const FAILURE_MEMO_TTL_MS = 5_000;
const failureMemo = new Map<string, { at: number; result: CallToolResult }>();

function tokenIdentityKey(token: string): string {
  // Key on the CONCRETE token, never on decoded claims. Connector tokens are
  // short-lived and rotate; a revoked/rotated token can carry the same
  // `sub`/`team_id` claims as its successor while authorizing a different
  // grant — replaying the predecessor's memoized failure to the successor
  // would be cross-identity error bleed. Hashing the full token means only
  // byte-identical repeats share a slot; the memo stores failures only (never
  // data) and 401s bypass it entirely, so the hit-rate cost is bounded.
  return createHash("sha256").update(token).digest("base64url");
}

function memoizedFailure(key: string | null): CallToolResult | null {
  if (!key) return null;
  const hit = failureMemo.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > FAILURE_MEMO_TTL_MS) {
    failureMemo.delete(key);
    return null;
  }
  return hit.result;
}

function memoizeFailure(
  key: string | null,
  result: CallToolResult,
): CallToolResult {
  if (!key) return result;
  const now = Date.now();
  for (const [staleKey, entry] of failureMemo) {
    if (now - entry.at > FAILURE_MEMO_TTL_MS) failureMemo.delete(staleKey);
  }
  failureMemo.set(key, { at: now, result });
  return result;
}

export function failureMemoSize(): number {
  return failureMemo.size;
}

function safeMemoKey(parts: unknown[]): string | null {
  try {
    return JSON.stringify(parts);
  } catch {
    return null;
  }
}

function nonPostBlockedResult(): CallToolResult | null {
  const req = tryGetRequest();
  if (!req || req.method === "POST") return null;
  return {
    ok: false,
    data: null,
    errorMessage:
      `blocked ${req.method} inbound request: connector calls must run inside ` +
      'a createServerFn({ method: "POST" }) handler',
  };
}

export async function callTool(
  toolName: string,
  args: ToolArgs,
  options: CallToolOptions,
): Promise<CallToolResult> {
  const blocked = crossSiteBlockedResult() ?? nonPostBlockedResult();
  if (blocked) return blocked;

  const ctx = inboundContext();
  const token = options.token ?? ctx.token;
  if (!token) {
    return missingAuthResult(ctx);
  }

  const connectorType = options.connectorType;
  if (!connectorType) {
    return {
      ok: false,
      data: null,
      errorMessage:
        "connectorType is required: pass the connector type granted to this app " +
        "(e.g. { connectorType: ConnectorType.GoogleDrive })",
    };
  }

  const memoKey = safeMemoKey([
    toolName,
    args,
    connectorType,
    options?.connectorCatalogId ?? null,
    tokenIdentityKey(token),
  ]);
  const memoized = memoizedFailure(memoKey);
  if (memoized) {
    return memoized;
  }
  // fail() is the single failure-construction chokepoint: every arm funnels
  // through errorMessageText so memoized/returned results always carry the
  // string errorMessage contract.
  const fail = (errorMessage: unknown): CallToolResult =>
    memoizeFailure(memoKey, {
      ok: false,
      data: null,
      errorMessage: errorMessageText(errorMessage) ?? "tool error",
    });
  if (connectorType === ConnectorType.Mcp && !options?.connectorCatalogId) {
    return {
      ok: false,
      data: null,
      errorMessage: "connectorCatalogId is required when connectorType is Mcp",
    };
  }

  try {
    const { status, json } = await gatePost(
      ctx,
      {
        host: ctx.publicHost ?? undefined,
        connector_type: connectorType,
        tool_name: toolName,
        arguments: args,
        connector_catalog_id: options.connectorCatalogId,
      },
      token,
    );

    if (status === 401) {
      const loginUrl =
        gateSigninUrl(ctx) ??
        (typeof json.loginUrl === "string" && json.loginUrl
          ? json.loginUrl
          : undefined);
      return {
        ok: false,
        data: null,
        loginRequired: true,
        errorMessage: errorMessageText(json.errorMessage) ?? "login required",
        ...(loginUrl ? { loginUrl } : {}),
      };
    }
    if (status === 403) {
      return fail(errorMessageText(json.errorMessage) ?? "access_denied");
    }
    if (status >= 400 && json.ok !== true) {
      return fail(errorMessageText(json.errorMessage) ?? `HTTP ${status}`);
    }
    if (json.ok === false) {
      return fail(errorMessageText(json.errorMessage) ?? "tool error");
    }
    // F3 sweep: success is ONLY a 2xx with ok !== false. `redirect: "manual"`
    // means a gate 3xx (redirect to signin, moved endpoint) surfaces here as a
    // status with an EMPTY body — the old unconditional success return
    // fabricated `ok: true, data: null` for it (the same bug class as the
    // CORE empty-2xx fix, which guarded only the 2xx branch). Every non-2xx
    // is an honest failure carrying the status.
    if (status >= 200 && status < 300) {
      return { ok: true, data: json.data ?? null };
    }
    return fail(errorMessageText(json.errorMessage) ?? `HTTP ${status}`);
  } catch (e) {
    return fail(e instanceof Error ? e.message : String(e));
  }
}

export {
  ConnectorType,
  GoogleDriveTools,
  CONNECTOR_TOKEN_HEADER,
} from "./types.ts";
export type {
  CallToolResult,
  CallToolOptions,
  ToolArgs,
  ConnectorTypeName,
} from "./types.ts";
export { isLoginRequired, redirectToLoginIfRequired } from "./login.ts";
