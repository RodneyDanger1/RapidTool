// ---------------------------------------------------------------------------
// src/api/routes.ts — HTTP contracts bound to jobs
// machine-generated from RapidTool packet 141852e2-c65a-408e-b48c-bcc2d6888b8c; regenerate, don't hand-edit.
// HTTP contracts bound to jobs. TODO(E-15) stub: implement each endpoint
// against the store stubs; tests/oracle.spec.ts names the oracle expectations.
// ---------------------------------------------------------------------------

export type EndpointMethod = "GET" | "POST" | "PATCH";
export type Endpoint = { method: EndpointMethod; path: string; job: string };

export const ENDPOINTS: Endpoint[] = [
  { method: "POST", path: "/v1/close", job: "close" },
  { method: "POST", path: "/v1/show", job: "show" },
  { method: "POST", path: "/v1/schedule", job: "schedule" },
  { method: "POST", path: "/v1/parse", job: "parse" },
  { method: "POST", path: "/v1/stage", job: "stage" },
  { method: "POST", path: "/v1/follow-up", job: "follow-up" },
];

export async function route(
  method: EndpointMethod,
  path: string,
  input: unknown,
): Promise<{ ok: boolean }> {
  void input;
  throw new Error(`TODO(E-15) stub: implement ${method} ${path}`);
}
