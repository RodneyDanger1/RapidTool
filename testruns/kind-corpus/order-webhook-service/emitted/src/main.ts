// ---------------------------------------------------------------------------
// src/main.ts — Service entry — a real node:http server over the recorded endpoints
// machine-generated from RapidTool packet 22815107-07f8-4bdd-b313-1620c85358e3; regenerate, don't hand-edit.
// Real PORT wiring, payload validation with coded 400s, and a listener.
// `npm start` runs main(); importing this module starts nothing.
// ---------------------------------------------------------------------------

import { createServer, type Server } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { pathToFileURL } from "node:url";

export type ServiceContext = { env: Record<string, string | undefined>; port: number };
export type RouteResult = { status: number; body: unknown };
export type RouteHandler = (input: unknown, url: URL) => Promise<RouteResult>;

/** PORT wiring (pure): a valid 1-65535 integer from the environment, else
 *  the documented local default 8080. */
export function resolvePort(env: Record<string, string | undefined> = process.env): number {
  const raw = Number.parseInt(String(env.PORT ?? ""), 10);
  return Number.isInteger(raw) && raw > 0 && raw <= 65535 ? raw : 8080;
}

export type ValidationResult = { ok: true; value: Record<string, unknown> } | { ok: false; errors: string[] };

/** Every request body must be a JSON object — the coded 400 the brief asks for. */
export function validatePayload(input: unknown): ValidationResult {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return { ok: false, errors: ["body must be a JSON object"] };
  }
  return { ok: true, value: input as Record<string, unknown> };
}

const ROUTES: Record<string, RouteHandler> = {
  "POST /v1/validate": async (input: unknown): Promise<RouteResult> => { const checked = validatePayload(input); return checked.ok ? { status: 200, body: { ok: true, job: "validate", accepted: checked.value } } : { status: 400, body: { ok: false, errors: checked.errors } }; },
  "POST /v1/receive": async (input: unknown): Promise<RouteResult> => { const checked = validatePayload(input); return checked.ok ? { status: 200, body: { ok: true, job: "receive", accepted: checked.value } } : { status: 400, body: { ok: false, errors: checked.errors } }; },
  "GET /health": async (): Promise<RouteResult> => ({ status: 200, body: { ok: true, service: "a-webhook-worker-service", uptimeMs: Math.round(process.uptime() * 1000) } }),
};
export { ROUTES };

function send(response: ServerResponse, status: number, payload: unknown): void {
  const text = JSON.stringify(payload);
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(text);
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.trim() === "") return undefined;
  return JSON.parse(text);
}

async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const key = (request.method ?? "GET") + " " + url.pathname;
  const handler = ROUTES[key];
  if (handler === undefined) { send(response, 404, { ok: false, error: "no route for " + key }); return; }
  let body: unknown;
  if (request.method === "POST" || request.method === "PUT" || request.method === "PATCH") {
    try {
      body = await readBody(request);
    } catch {
      send(response, 400, { ok: false, errors: ["body must be valid JSON"] });
      return;
    }
  }
  send(response, 200, (await handler(body, url)).body);
}

export function createApp(): Server {
  return createServer((request, response) => {
    void handle(request, response).catch((error: unknown) => {
      send(response, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
    });
  });
}


/** Start the server; resolves 0 once listening, 1 when it cannot bind. */
export async function main(env: Record<string, string | undefined> = process.env): Promise<number> {
  const ctx: ServiceContext = { env, port: resolvePort(env) };
  const server = createApp();
  return await new Promise<number>((resolve) => {
    server.once("error", (error: Error) => { process.stderr.write(error.message + "\n"); resolve(1); });
    server.listen(ctx.port, () => { process.stdout.write("listening on http://127.0.0.1:" + ctx.port + "\n"); resolve(0); });
  });
}

// Direct-execution guard (the standard ESM main-module check): main runs ONLY
// when this file is the program being executed — any import (tests, tooling,
// the oracle spec) never triggers it, which is what makes the stub importable.
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
