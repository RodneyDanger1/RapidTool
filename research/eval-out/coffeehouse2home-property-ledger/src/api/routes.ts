// ---------------------------------------------------------------------------
// src/api/routes.ts — HTTP contracts bound to jobs
// machine-generated from RapidTool packet 16692201-777b-4cf6-b02b-a85f02e9c6a3; regenerate, don't hand-edit.
// HTTP contracts bound to jobs. TODO(E-15) stub: implement each endpoint
// against the store stubs; tests/oracle.spec.ts names the oracle expectations.
// ---------------------------------------------------------------------------

export type EndpointMethod = "GET" | "POST" | "PATCH";
export type Endpoint = { method: EndpointMethod; path: string; job: string };

export const ENDPOINTS: Endpoint[] = [
  { method: "GET", path: "/v1/track", job: "track" },
  { method: "POST", path: "/v1/record", job: "record" },
  { method: "POST", path: "/v1/flip", job: "flip" },
  { method: "POST", path: "/v1/show", job: "show" },
  { method: "POST", path: "/v1/publish", job: "publish" },
  { method: "POST", path: "/v1/sync", job: "sync" },
];

export async function route(
  method: EndpointMethod,
  path: string,
  input: unknown,
): Promise<{ ok: boolean }> {
  void input;
  throw new Error(`TODO(E-15) stub: implement ${method} ${path}`);
}
