// ---------------------------------------------------------------------------
// src/api/routes.ts — HTTP contracts bound to jobs
// machine-generated from RapidTool packet 4cd56084-1d37-42f5-b025-b7e1304f8e31; regenerate, don't hand-edit.
// HTTP contracts bound to jobs. TODO(E-15 stub): implement each endpoint
// against the store stubs; tests/oracle.spec.ts names the oracle expectations.
// ---------------------------------------------------------------------------

export type EndpointMethod = "GET" | "POST" | "PATCH";
export type Endpoint = { method: EndpointMethod; path: string; job: string };

export const ENDPOINTS: Endpoint[] = [
  { method: "GET", path: "/v1/track", job: "track" },
];

export async function route(
  method: EndpointMethod,
  path: string,
  input: unknown,
): Promise<{ ok: boolean }> {
  void input;
  throw new Error(`TODO(E-15 stub): implement ${method} ${path}`);
}
