import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

  it("a cross-origin redirect never forwards the Authorization header", async () => {
    // 343-2 sweep: this transport carries the provider API key. Standard fetch
    // strips authorization/cookie on an origin-changing redirect; following one
    // blind would hand the bearer token to whatever host the Location names.
    let auth: string | undefined;
    let trace: string | undefined;
    const victim = createServer((req, res) => {
      auth = req.headers["authorization"] as string | undefined;
      trace = req.headers["x-trace"] as string | undefined;
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    });
    await new Promise<void>((resolve) => victim.listen(0, "127.0.0.1", resolve));
    const victimPort = (victim.address() as AddressInfo).port;
    try {
      // Same-origin sanity: the victim DOES receive the auth header when it is
      // the direct target (so the strip below is about the origin change).
      const direct = await oneShotFetch(`http://127.0.0.1:${victimPort}/direct`, {
        method: "GET",
        headers: { authorization: "Bearer sk-abcdef0123456789" },
      });
      assert.equal(direct.status, 200);
      assert.equal(auth, "Bearer sk-abcdef0123456789");

      const redirector = createServer((_req, res) => {
        res.writeHead(302, { location: `http://127.0.0.1:${victimPort}/cross` });
        res.end();
      });
      await new Promise<void>((resolve) => redirector.listen(0, "127.0.0.1", resolve));
      const redirectorPort = (redirector.address() as AddressInfo).port;
      try {
        auth = undefined;
        trace = undefined;
        const res = await oneShotFetch(`http://127.0.0.1:${redirectorPort}/api`, {
          method: "GET",
          headers: { authorization: "Bearer sk-abcdef0123456789", "x-trace": "keep-me" },
        });
        assert.equal(res.status, 200);
        assert.equal(auth, undefined, "authorization must NOT cross an origin-changing redirect");
        assert.equal(trace, "keep-me", "non-credential headers still travel");
      } finally {
        await new Promise<void>((resolve) => redirector.close(() => resolve()));
      }
    } finally {
      await new Promise<void>((resolve) => victim.close(() => resolve()));
    }
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

// ---------------------------------------------------------------------------
// fixes/346 A2-F5 — the remaining CLI-reachable network legs route through this
// seam. A bare global `fetch(` in these modules reintroduces undici's TLS
// teardown race with the CLI's in-tick `process.exit()` (327-L2 crash class).
// Static bytes guard: the modules are owned by this lane and their injected
// fetch seams (`opts.fetch`, `opts.fetchText`/`fetchJson`) are unaffected.
// ---------------------------------------------------------------------------
describe("fixes/346 A2-F5 — CLI-reachable legs use the one-shot seam", () => {
  const LEGS: Array<[string, string]> = [
    ["tavily.server.ts", "../../tavily.server.ts"],
    ["harvest.ts", "../../harvest.ts"],
    ["probe.ts", "./probe.ts"],
  ];
  // Catches both a bare `fetch(` and an explicit global reach-through
  // (`globalThis.fetch(` / `window.fetch(` / `self.fetch(`) — the evasion V1
  // found in the first, looser lookbehind. `oneShotFetch(` (capital F) and the
  // injected `opts.fetch` seam are deliberately not flagged.
  const GLOBAL_FETCH =
    /(?<![A-Za-z0-9_$])(?:globalThis|window|self)\.fetch\s*\(|(?<![A-Za-z0-9_$.])fetch\s*\(/;

  it("the guard is falsifiable: it catches bare/global fetch( and ignores the seam", () => {
    const samples: Array<[string, boolean]> = [
      ["const r = await fetch(url, init);", true],
      ["const r = await globalThis.fetch(url, init);", true],
      ["const r = await window.fetch(url);", true],
      ["const r = await self.fetch(url);", true],
      ["const impl = opts.fetch ?? oneShotFetch;", false],
      ["return oneShotFetch(url, init);", false],
      ["const r = myFetch(url);", false],
    ];
    for (const [sample, caught] of samples) {
      assert.equal(GLOBAL_FETCH.test(sample), caught, `sample: ${sample}`);
    }
  });

  for (const [label, rel] of LEGS) {
    it(`${label}: uses oneShotFetch and no bare/global fetch(`, () => {
      const src = readFileSync(new URL(rel, import.meta.url), "utf8");
      assert.match(src, /\boneShotFetch\b/, `${label} must route through the seam`);
      assert.doesNotMatch(src, GLOBAL_FETCH, `${label} still calls a bare/global fetch(`);
    });
  }
});
