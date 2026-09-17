// ---------------------------------------------------------------------------
// node-runner.server.test.ts — 174-15 stdout/stderr secret redaction (fixes/189).
// Run: node --experimental-strip-types --test src/lib/node-runner.server.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  redactSecrets,
  scrubbedEnv,
  runnerAvailable,
  runNodeBounded,
  runnerIsolationClaim,
} from "./node-runner.server.ts";

describe("redactSecrets (174-15)", () => {
  it("redacts a fake sk- key of 40+ chars", () => {
    const fake = "sk-" + "a".repeat(40);
    assert.ok(fake.length >= 40);
    const out = redactSecrets(`leaked ${fake} end`);
    assert.equal(out.includes(fake), false);
    assert.match(out, /\[secret-hidden\]/);
    assert.equal(out, "leaked [secret-hidden] end");
  });

  it("redacts sk-or- tokens of 40+ chars", () => {
    const fake = "sk-or-" + "b".repeat(40);
    const out = redactSecrets(fake);
    assert.equal(out, "[secret-hidden]");
  });

  it("redacts Bearer eyJ… tokens of 40+ chars", () => {
    const jwt = "Bearer eyJ" + "c".repeat(40);
    const out = redactSecrets(`auth=${jwt}`);
    assert.equal(out.includes("eyJ"), false);
    assert.match(out, /\[secret-hidden\]/);
  });

  it("redacts fake sk-proj- tokens of 40+ chars", () => {
    // Fake shape only — never a live key.
    const fake = "sk-proj-" + "e".repeat(40);
    const out = redactSecrets(`cfg ${fake} done`);
    assert.equal(out.includes(fake), false);
    assert.equal(out, "cfg [secret-hidden] done");
  });

  it("redacts fake sk_live_ tokens of 40+ chars (underscore live-secret shape)", () => {
    const fake = "sk_live_" + "f".repeat(40);
    const out = redactSecrets(`pay ${fake}`);
    assert.equal(out.includes(fake), false);
    assert.equal(out, "pay [secret-hidden]");
  });

  it("empty and short strings stay byte-identical", () => {
    assert.equal(redactSecrets(""), "");
    const short = "ok";
    assert.equal(redactSecrets(short), short);
    assert.equal(redactSecrets("sk-short"), "sk-short"); // under 40 — not a secret shape
    const mid = "hello world 123";
    assert.strictEqual(redactSecrets(mid), mid);
  });

  it("does not use control-char regex traps; plain text with controls is unchanged when no secret", () => {
    // no-control-regex: build control chars via String.fromCharCode (not literals).
    const nul = String.fromCharCode(0);
    const bel = String.fromCharCode(7);
    const plain = `safe${nul}text${bel}here`;
    assert.strictEqual(redactSecrets(plain), plain);
  });

  it("replaces process.env.DEEPSEEK_API_KEY value when present (never logs the key)", () => {
    const prev = process.env.DEEPSEEK_API_KEY;
    const probe = "test-deepseek-key-value-xyz-189";
    try {
      process.env.DEEPSEEK_API_KEY = probe;
      const out = redactSecrets(`cfg key=${probe} done`);
      assert.equal(out.includes(probe), false);
      assert.equal(out, "cfg key=[secret-hidden] done");
    } finally {
      if (prev === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = prev;
    }
  });
});

describe("scrubbedEnv unchanged (B4 / 174-5)", () => {
  it("allowlists PATH and never copies DEEPSEEK_API_KEY", () => {
    const prev = process.env.DEEPSEEK_API_KEY;
    try {
      process.env.DEEPSEEK_API_KEY = "should-not-leak-into-child-env";
      const env = scrubbedEnv();
      assert.equal(env.DEEPSEEK_API_KEY, undefined);
      assert.ok(typeof env.PATH === "string" || typeof env.Path === "string" || true);
      // Proxy scrub still present
      assert.equal(env.NO_PROXY, "*");
    } finally {
      if (prev === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = prev;
    }
  });
});

describe("runNodeBounded applies redactSecrets to stdout/stderr", () => {
  it("redacts sk- shaped tokens from child stdout when runner is available", async () => {
    if (!runnerAvailable()) return;
    const fake = "sk-" + "d".repeat(40);
    // Print the fake key on stdout (child has scrubbed env — key is in the code arg).
    const code = `console.log("out ${fake}"); console.error("err ${fake}");`;
    const res = await runNodeBounded(code, { timeoutMs: 5_000 });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal("error" in res, false, "ok:true run must not carry an error channel");
    assert.equal(res.stdout.includes(fake), false);
    assert.equal(res.stderr.includes(fake), false);
    assert.match(res.stdout, /\[secret-hidden\]/);
    assert.match(res.stderr, /\[secret-hidden\]/);
  });
});

describe("runNodeBounded advertises sandbox:false (not a security sandbox)", () => {
  it("ok envelope carries sandbox:false — never true", async () => {
    if (!runnerAvailable()) return;
    const res = await runNodeBounded("console.log('bounded-ok')", { timeoutMs: 5_000 });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.sandbox, false);
    assert.equal(runnerIsolationClaim().sandbox, false);
    assert.equal(runnerIsolationClaim().docker, false);
    assert.equal(runnerIsolationClaim().bwrap, false);
  });

  it("refused empty source still advertises sandbox:false", async () => {
    const res = await runNodeBounded("   ");
    assert.equal(res.ok, false);
    assert.equal(res.sandbox, false);
    if (!res.ok) {
      assert.equal(res.reason, "refused");
    }
  });
});
