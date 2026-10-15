// ---------------------------------------------------------------------------
// src/api/routes.ts — HTTP contracts bound to jobs
// machine-generated from RapidTool packet 4dbb30be-da7b-47ae-8ae5-19aa54a69b46; regenerate, don't hand-edit.
// HTTP contracts bound to jobs (A6). The router below dispatches every
// recorded endpoint to its job module; an endpoint whose job has no
// emitted implementation still refuses with the coded RT_E_VALIDATION
// form — never a silent success. tests/oracle.spec.ts names the oracle
// expectations.
// ---------------------------------------------------------------------------

export type EndpointMethod = "GET" | "POST" | "PATCH";
export type Endpoint = { method: EndpointMethod; path: string; job: string };

export const ENDPOINTS: Endpoint[] = [
  { method: "POST", path: "/v1/invoice", job: "invoice" },
  { method: "POST", path: "/v1/convert", job: "convert" },
  { method: "POST", path: "/v1/export", job: "export" },
];

/** Recorded endpoints → the REAL job modules this emit materialised. */
const HANDLERS: Record<string, (input: unknown) => Promise<unknown>> = {
};

export async function route(
  method: EndpointMethod,
  path: string,
  input: unknown,
): Promise<{ ok: boolean; job?: string; result?: unknown }> {
  const endpoint = ENDPOINTS.find((e) => e.method === method && e.path === path);
  if (!endpoint) {
    throw new Error(`RT_E_VALIDATION · unknown endpoint ${method} ${path} — not in the recorded A6 contract`);
  }
  const handler = HANDLERS[endpoint.job];
  if (!handler) {
    throw new Error(`RT_E_VALIDATION · TODO(E-15) stub: implement ${method} ${path}`);
  }
  return { ok: true, job: endpoint.job, result: await handler(input) };
}
