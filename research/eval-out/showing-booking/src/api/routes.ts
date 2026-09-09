// ---------------------------------------------------------------------------
// src/api/routes.ts — HTTP contracts bound to jobs
// machine-generated from RapidTool packet 9f7b40f0-80e9-4959-8007-8d7b006a1451; regenerate, don't hand-edit.
// HTTP contracts bound to jobs. TODO(E-15 stub): implement each endpoint
// against the store stubs; tests/oracle.spec.ts names the oracle expectations.
// ---------------------------------------------------------------------------

export type EndpointMethod = "GET" | "POST" | "PATCH";
export type Endpoint = { method: EndpointMethod; path: string; job: string };

export const ENDPOINTS: Endpoint[] = [
  { method: "POST", path: "/v1/show", job: "show" },
  { method: "POST", path: "/v1/schedule", job: "schedule" },
  { method: "POST", path: "/v1/publish", job: "publish" },
  { method: "POST", path: "/v1/sync", job: "sync" },
];

export async function route(
  method: EndpointMethod,
  path: string,
  input: unknown,
): Promise<{ ok: boolean }> {
  void input;
  throw new Error(`TODO(E-15 stub): implement ${method} ${path}`);
}
