// ---------------------------------------------------------------------------
// src/api/routes.ts — HTTP contracts bound to jobs
// machine-generated from RapidTool packet 75285bd4-ced2-42be-9d00-caf3f9f243a7; regenerate, don't hand-edit.
// HTTP contracts bound to jobs. TODO(E-15 stub): implement each endpoint
// against the store stubs; tests/oracle.spec.ts names the oracle expectations.
// ---------------------------------------------------------------------------

export type EndpointMethod = "GET" | "POST" | "PATCH";
export type Endpoint = { method: EndpointMethod; path: string; job: string };

export const ENDPOINTS: Endpoint[] = [
  { method: "POST", path: "/v1/rent", job: "rent" },
  { method: "POST", path: "/v1/schedule", job: "schedule" },
  { method: "GET", path: "/v1/track", job: "track" },
  { method: "POST", path: "/v1/lease", job: "lease" },
];

export async function route(
  method: EndpointMethod,
  path: string,
  input: unknown,
): Promise<{ ok: boolean }> {
  void input;
  throw new Error(`TODO(E-15 stub): implement ${method} ${path}`);
}
