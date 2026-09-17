// ---------------------------------------------------------------------------
// src/api/routes.ts — HTTP contracts bound to jobs
// machine-generated from RapidTool packet 599e16d4-2286-4aaf-b167-15344d5c5ffd; regenerate, don't hand-edit.
// HTTP contracts bound to jobs. TODO(E-15) stub: implement each endpoint
// against the store stubs; tests/oracle.spec.ts names the oracle expectations.
// ---------------------------------------------------------------------------

export type EndpointMethod = "GET" | "POST" | "PATCH";
export type Endpoint = { method: EndpointMethod; path: string; job: string };

export const ENDPOINTS: Endpoint[] = [
  { method: "POST", path: "/v1/flip", job: "flip" },
  { method: "POST", path: "/v1/invoice", job: "invoice" },
  { method: "GET", path: "/v1/track", job: "track" },
  { method: "POST", path: "/v1/rehab", job: "rehab" },
  { method: "POST", path: "/v1/bid", job: "bid" },
];

export async function route(
  method: EndpointMethod,
  path: string,
  input: unknown,
): Promise<{ ok: boolean }> {
  void input;
  throw new Error(`TODO(E-15) stub: implement ${method} ${path}`);
}
