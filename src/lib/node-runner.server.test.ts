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
  clampRunnerOutput,
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
      const pathVar = env.PATH ?? env.Path;
      assert.ok(typeof pathVar === "string" && pathVar.length > 0, "scrubbed env carries a non-empty PATH");
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

// ---------------------------------------------------------------------------
// 337-3 Trust: clampRunnerOutput carried the same truncated-marker defect Core
// fixed in compaction.clampToolOutput (337-1). A cap too small to fit the 0.6*cap
// head PLUS the marker produced an unparseable marker STUB instead of a marked
// head-cut (probe: cap 90 -> "86 chars elided by runner output").
// ---------------------------------------------------------------------------

describe("clampRunnerOutput — small caps never ship a marker stub (337-3)", () => {
  const text = "A".repeat(2000);

  it("a cap too small for the full elision marker falls back to a counted head-cut", () => {
    for (const cap of [64, 80, 90, 100, 120]) {
      const r = clampRunnerOutput(text, cap);
      assert.equal(r.clamped, true, `cap ${cap}: clamped`);
      assert.ok(r.text.length <= cap, `cap ${cap}: length ${r.text.length} <= ${cap}`);
      const plainHeadCut = r.text === text.slice(0, cap);
      const marker = /\[(\d+) chars elided by runner output cap\] \u2026/.exec(r.text);
      if (plainHeadCut) {
        assert.equal(r.elidedChars, text.length - cap, `cap ${cap}: the head-cut counts every dropped char`);
      } else {
        assert.ok(
          marker,
          `cap ${cap}: neither a plain head-cut nor a fully-rendered marker -> ${JSON.stringify(r.text.slice(0, 90))}`,
        );
        assert.equal(Number(marker[1]), r.elidedChars, `cap ${cap}: the marker names the count the record reports`);
        assert.equal(r.text.length, cap, `cap ${cap}: a marked layout fits the cap exactly`);
      }
    }
  });

  it("the sub-64 arm and a large cap both keep their documented shapes", () => {
    const tiny = clampRunnerOutput(text, 10);
    assert.equal(tiny.text, text.slice(0, 10));
    assert.equal(tiny.elidedChars, text.length - 10);
    const large = clampRunnerOutput(text, 500);
    assert.ok(large.text.length <= 500);
    assert.match(large.text, /chars elided by runner output cap\] \u2026/, "the large-cap path keeps the FULL marker");
    assert.ok(large.text.startsWith("A".repeat(300)), "head kept");
    assert.ok(large.text.endsWith("A"), "tail kept");
  });
});

// ---------------------------------------------------------------------------
// 344 A2-F1 — the opt-in verdict channel. `verdictChannel` opens stdin (the
// parent writes a fresh nonce) and fd 3 (the harness's marker stream); the ok
// envelope gains `verdict` with only the nonce-authenticated lines, prefix
// stripped. A child that writes to fd 3 itself cannot authenticate. The legacy
// path must stay byte-identical (no `verdict` field).
// ---------------------------------------------------------------------------
describe("runNodeBounded verdict channel (344 A2-F1)", () => {
  it("omits `verdict` on the legacy path (byte-identical envelope)", async () => {
    if (!runnerAvailable()) return;
    const res = await runNodeBounded("console.log('legacy-ok')", { timeoutMs: 5_000 });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal("verdict" in res, false, "no verdict field without verdictChannel");
    assert.match(res.stdout, /legacy-ok/);
  });

  it("captures fd 3 but drops every line the child writes itself (no nonce)", async () => {
    if (!runnerAvailable()) return;
    const code =
      "const fs = require('node:fs');" +
      "fs.writeSync(3, 'FORGED-HARNESS_COMPILE pass\\n');" +
      "console.log('detail-on-stdout');";
    const res = await runNodeBounded(code, { timeoutMs: 5_000, verdictChannel: true });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.verdict, "", "unauthenticated fd-3 lines are dropped");
    assert.match(res.stdout, /detail-on-stdout/);
  });
});
