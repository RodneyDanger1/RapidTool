import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { oneShotFetch } from "./one-shot-fetch.server.ts";

// W45 331-1 F2: the transport is exercised against a REAL local node:http
// server (no TLS needed — the abort trigger was undici's TLS teardown, but the
// transport itself must be proven to do a real request/response cycle).
let server: Server;
let base: string;
const seen: Array<{ url: string; method: string; body: string; contentLength: string | undefined }> = [];

before(async () => {
  server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => {
      body += c;
    });
    req.on("end", () => {
      seen.push({
        url: req.url ?? "",
        method: req.method ?? "",
        body,
        contentLength: req.headers["content-length"],
      });
      if (req.url === "/redirect") {
        res.writeHead(302, { location: "/final" });
        res.end();
        return;
      }
      res.writeHead(req.url === "/final" ? 200 : 401, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: req.url === "/final", got: body }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("W45 331-1 oneShotFetch (production transport)", () => {
  it("does a real POST over node:http, sets content-length, and reads the body back", async () => {
    const res = await oneShotFetch(`${base}/api`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hello: "world" }),
    });
    assert.equal(res.status, 401);
    assert.equal(res.ok, false);
    const parsed = JSON.parse(await res.text()) as { got: string };
    assert.equal(parsed.got, JSON.stringify({ hello: "world" }));
    const last = seen.at(-1);
    assert.equal(last?.method, "POST");
    assert.equal(last?.contentLength, String(Buffer.byteLength('{"hello":"world"}')));
  });

  it("follows a redirect", async () => {
    const res = await oneShotFetch(`${base}/redirect`, { method: "GET" });
    assert.equal(res.status, 200);
    const parsed = JSON.parse(await res.text()) as { ok: boolean };
    assert.equal(parsed.ok, true);
  });

  it("honors an aborted signal with an AbortError", async () => {
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      oneShotFetch(`${base}/api`, { method: "GET", signal: controller.signal }),
      (err: unknown) => err instanceof Error && err.name === "AbortError",
    );
  });

  it("defers to a replaced globalThis.fetch (the test seam)", async () => {
    const real = globalThis.fetch;
    try {
      globalThis.fetch = (async () => new Response("stub", { status: 299 })) as typeof fetch;
      const res = await oneShotFetch(`${base}/api`, { method: "GET" });
      assert.equal(res.status, 299);
      assert.equal(await res.text(), "stub");
    } finally {
      globalThis.fetch = real;
    }
  });
});
