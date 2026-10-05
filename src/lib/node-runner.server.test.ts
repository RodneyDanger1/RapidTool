// ---------------------------------------------------------------------------
// node-runner.server.test.ts — 174-15 stdout/stderr secret redaction (fixes/189).
// Run: node --experimental-strip-types --test src/lib/node-runner.server.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  redactSecrets,
  scrubbedEnv,
  runnerAvailable,
  runNodeBounded,
  runnerIsolationClaim,
  clampRunnerOutput,
  permissionModelAvailable,
  strictRunnerArgs,
  confinedRunnerArgs,
  tierBound,
  tierRunnerArgs,
  RUNNER_STRICT_HEAP_CAP_MB,
} from "./node-runner.server.ts";
import {
  probePermissionModel,
  runnerBoundClaim,
  RUNNER_BOUND_HEAP_CAP_MB,
} from "./doctor.ts";

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

  it("fixes/346 A2-F6: redacts xai- and tvly- vendor key shapes", () => {
    const xai = "xai-" + "a".repeat(40);
    assert.equal(redactSecrets(`cfg ${xai} done`), "cfg [secret-hidden] done");
    const tvly = "tvly-" + "b".repeat(40);
    assert.equal(redactSecrets(`key=${tvly}`), "key=[secret-hidden]");
  });

  it("fixes/346 A2-F6: redacts XAI_API_KEY / TAVILY_API_KEY values when present", () => {
    const prevXai = process.env.XAI_API_KEY;
    const prevTvly = process.env.TAVILY_API_KEY;
    const xaiProbe = "test-xai-key-value-not-live";
    const tvlyProbe = "test-tavily-key-value-not-live";
    try {
      process.env.XAI_API_KEY = xaiProbe;
      process.env.TAVILY_API_KEY = tvlyProbe;
      assert.equal(redactSecrets(`a=${xaiProbe} b=${tvlyProbe}`), "a=[secret-hidden] b=[secret-hidden]");
    } finally {
      if (prevXai === undefined) delete process.env.XAI_API_KEY;
      else process.env.XAI_API_KEY = prevXai;
      if (prevTvly === undefined) delete process.env.TAVILY_API_KEY;
      else process.env.TAVILY_API_KEY = prevTvly;
    }
  });

  it("fixes/346 A2-F6: does NOT over-match hyphenated/short lookalikes", () => {
    for (const safe of ["xai-based-tool", "tvly-dev", "xai-short", "tvly-x", "prefix-xai-abcdef"]) {
      assert.strictEqual(redactSecrets(safe), safe, `${safe} is prose, not a key`);
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

// ---------------------------------------------------------------------------
// Pipe-chunk UTF-8 integrity: the child's stdout/stderr arrive in ~64 KiB
// reads, and a 3-byte sequence can straddle a read boundary. Decoding each
// Buffer with `d.toString()` emits U+FFFD for the split bytes and inflates the
// captured length (probe: 40000x U+2764 -> 3 replacement chars on BOTH
// runtimes); a per-stream StringDecoder must carry the partial sequence across
// the boundary instead.
// ---------------------------------------------------------------------------
describe("runNodeBounded preserves multibyte output across pipe chunks", () => {
  it("a 120 KB stream of 3-byte chars survives the read boundary byte-faithfully", async () => {
    if (!runnerAvailable()) return;
    const count = 40_000; // 3 bytes each -> 120 KB, crosses a 64 KiB pipe read
    assert.ok(count * 3 > 65_536, "the payload must cross at least one pipe read boundary");
    const heart = "\u2764";
    const code = `process.stdout.write(${JSON.stringify(heart)}.repeat(${count}));process.stderr.write(${JSON.stringify(heart)}.repeat(${count}));`;
    const res = await runNodeBounded(code, { timeoutMs: 20_000 });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.stdout.includes("\uFFFD"), false, "no replacement char from a split stdout sequence");
    assert.equal(res.stderr.includes("\uFFFD"), false, "no replacement char from a split stderr sequence");
    assert.equal(res.stdout, heart.repeat(count), "stdout must round-trip byte-faithfully");
    assert.equal(res.stderr, heart.repeat(count), "stderr must round-trip byte-faithfully");
  });
});

// ---------------------------------------------------------------------------
// fixes/346 C3 — the timeout floor: a positive sub-millisecond budget (0.5ms)
// used to `Math.floor` to 0, so `setTimeout(fn, 0)` killed the run on the first
// tick and reported "killed after 0s" — a positive ask became an instant
// timeout. The floor is now 1ms (mirrors the probe.ts floor), while a finite
// in-range value still rides through and the >32-bit ceiling stays clamped.
// ---------------------------------------------------------------------------
describe("runNodeBounded timeout sanitization (346 C3)", () => {
  it("a positive sub-millisecond budget floors to 1ms, never setTimeout(0) 'after 0s'", async () => {
    if (!runnerAvailable()) return;
    // A 1ms budget is genuinely too short for node startup, so the run times
    // out either way; the regression is the FLOOR: 0.5 used to floor to 0 and
    // report a fake "killed after 0s" for a positive budget.
    const res = await runNodeBounded("console.log('sub-ms')", { timeoutMs: 0.5 });
    assert.equal(res.ok, false);
    assert.equal(res.reason, "timeout");
    if (res.ok) return;
    assert.doesNotMatch(res.error ?? "", /after 0s/, `a positive budget must not report 0s: ${res.error}`);
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

// ---------------------------------------------------------------------------
// W40·K4 finite-timeout guard: `Infinity` once slipped through `> 0` and
// `setTimeout(fn, Infinity)` fired on the first tick, so the run was killed
// immediately. The guard maps any non-finite / <=0 timeout to the default.
// ---------------------------------------------------------------------------
describe("runNodeBounded timeout guard (W40 K4)", () => {
  it("non-finite / <=0 timeouts fall back to the default — never an immediate kill", async () => {
    if (!runnerAvailable()) return;
    for (const t of [Infinity, -Infinity, Number.NaN, 0, -5]) {
      const res = await runNodeBounded("setTimeout(() => console.log('alive'), 120)", { timeoutMs: t });
      assert.equal(res.ok, true, `timeoutMs=${String(t)} must not kill a 120 ms child`);
    }
  });

  it("a finite timeout is the one enforced — the envelope names its seconds", async () => {
    if (!runnerAvailable()) return;
    const res = await runNodeBounded("setTimeout(() => {}, 3000)", { timeoutMs: 1 });
    assert.equal(res.ok, false, "a 1 ms timeout must kill a 3 s child");
    if (res.ok) return;
    assert.equal(res.reason, "timeout");
    assert.match(String(res.error), /killed after 0\.001s/);
  });
});

// ---------------------------------------------------------------------------
// fixes/346 P1-4 — REAL resource/process isolation (no mock products).
//
// `opts.isolation:"strict"` runs the child under Node's Permission Model: fs
// writes confined to the per-run scratch dir, child_process / worker_threads /
// native addons denied, V8 heap capped. The tests below spawn REAL children
// that try to escape and assert the OS/runtime DENIED them.
// ---------------------------------------------------------------------------
describe("runNodeBounded strict isolation (346 P1-4)", () => {
  const strictReady = runnerAvailable() && permissionModelAvailable();

  it("pure capability probe: both runtimes agree, and the flag set is really read", () => {
    assert.equal(typeof permissionModelAvailable(), "boolean");
    // Same probe the doctor reads (one vocabulary, no drift).
    assert.equal(permissionModelAvailable(), probePermissionModel());
  });

  it("strictRunnerArgs names the exact flags applied (fs-confine + heap cap)", () => {
    const args = strictRunnerArgs("C:\\tmp\\rapidtool-run-abc");
    assert.ok(args.includes("--permission"));
    assert.ok(args.includes("--allow-fs-write=C:/tmp/rapidtool-run-abc"), "write allowed only inside the scratch dir");
    assert.ok(args.includes("--allow-fs-read=C:/tmp/rapidtool-run-abc"));
    assert.ok(args.includes(`--max-old-space-size=${RUNNER_STRICT_HEAP_CAP_MB}`));
    assert.equal(args.includes("--allow-child-process"), false, "subprocesses are never allowed under strict");
    assert.equal(args.includes("--allow-worker"), false, "workers are never allowed under strict");
  });

  it("denies a filesystem write OUTSIDE the per-run scratch dir (real child)", { skip: !strictReady }, async () => {
    const escape = join(tmpdir(), `rapidtool-346-escape-${process.pid}-${Date.now()}.txt`);
    try {
      const code =
        `const fs=require('node:fs');` +
        `fs.writeFileSync(${JSON.stringify(escape)},'pwned');` +
        `console.log('ESCAPED');`;
      const res = await runNodeBounded(code, { timeoutMs: 15_000, isolation: "strict" });
      assert.equal(res.ok, true, "the child runs — it is the WRITE that must be denied");
      if (!res.ok) return;
      assert.notEqual(res.exitCode, 0, "an outside-scratch write must fail the child");
      assert.match(res.stderr, /ERR_ACCESS_DENIED|restricted/i, "the denial is a real permission error");
      assert.doesNotMatch(res.stdout, /ESCAPED/);
      assert.equal(existsSync(escape), false, "the escape file must NOT exist on disk");
      assert.equal(res.bound?.mechanism, "node-permission-model");
      assert.equal(res.bound?.fsWriteConfined, true);
      assert.equal(res.bound?.enforced, true);
    } finally {
      try {
        rmSync(escape, { force: true });
      } catch {
        /* nothing to clean */
      }
    }
  });

  it("allows a write INSIDE the scratch dir — the bound is confinement, not blanket denial", { skip: !strictReady }, async () => {
    const code =
      `const fs=require('node:fs');` +
      `fs.writeFileSync('./inside.txt','ok');` +
      `console.log('WROTE:'+fs.readFileSync('./inside.txt','utf8'));`;
    const res = await runNodeBounded(code, { timeoutMs: 15_000, isolation: "strict" });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.exitCode, 0, res.stderr);
    assert.match(res.stdout, /WROTE:ok/);
  });

  it("denies child_process (a real process-fan-out bound) — real child", { skip: !strictReady }, async () => {
    const code =
      `const cp=require('node:child_process');` +
      `try{cp.execSync('echo pwned');console.log('SPAWNED')}` +
      `catch(e){console.error('DENIED:'+e.code);process.exit(7)}`;
    const res = await runNodeBounded(code, { timeoutMs: 15_000, isolation: "strict" });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.exitCode, 7, "the child observed and reported the denial");
    assert.match(res.stderr, /ERR_ACCESS_DENIED/);
    assert.doesNotMatch(res.stdout, /SPAWNED/);
    assert.equal(res.bound?.subprocessDenied, true);
  });

  it("reports the applied bound on a strict envelope; legacy envelopes stay byte-identical", async () => {
    if (!runnerAvailable()) return;
    const strict = await runNodeBounded("console.log('strict-ok')", { timeoutMs: 15_000, isolation: "strict" });
    assert.equal(strict.ok, true);
    assert.ok(strict.bound, "a strict run carries its bound record");
    assert.equal(strict.bound?.heapCapMb, RUNNER_STRICT_HEAP_CAP_MB);
    if (!permissionModelAvailable()) {
      assert.equal(strict.bound?.mechanism, "none", "honest degradation, never a pretend mechanism");
      return;
    }
    assert.equal(strict.bound?.mechanism, "node-permission-model");
    const legacy = await runNodeBounded("console.log('legacy-ok')", { timeoutMs: 15_000 });
    assert.equal("bound" in legacy, false, "the legacy envelope gains NO new field");
  });

  it("degrades honestly when the platform lacks the Permission Model flag", () => {
    const degraded = runnerBoundClaim({ permissionAvailable: false });
    assert.equal(degraded.mechanism, "none");
    assert.equal(degraded.enforcedOnGeneratedCode, false);
    assert.equal(degraded.fsWriteConfined, false);
    assert.equal(degraded.subprocessDenied, false);
    assert.equal(degraded.heapCapMb, null);
    assert.match(degraded.note, /--permission/);
    const present = runnerBoundClaim({ permissionAvailable: true, heapCapMb: 128 });
    assert.equal(present.mechanism, "node-permission-model");
    assert.equal(present.fsWriteConfined, true);
    assert.equal(present.subprocessDenied, true);
    assert.equal(present.heapCapMb, 128);
  });

  it("the doctor's advertised heap cap matches the runner's (drift guard)", () => {
    assert.equal(RUNNER_BOUND_HEAP_CAP_MB, RUNNER_STRICT_HEAP_CAP_MB);
  });
});

// ---------------------------------------------------------------------------
// fixes/346 lane-1 — the SECOND isolation tier (`confined`) and the honest
// availability degradation. `confined` keeps fs writes confined to the per-run
// scratch dir and the heap cap, but EXPLICITLY ALLOWS child_process (the
// compile-check harness spawns `node --test`) and allows broad fs reads. The
// tests below spawn REAL children: can-spawn, cannot-escape, and — pinned
// without a mock — the exact bound/args produced when the Permission Model is
// unavailable (never a pretend boundary).
// ---------------------------------------------------------------------------
describe("runNodeBounded confined isolation tier (346 lane-1)", () => {
  const confinedReady = runnerAvailable() && permissionModelAvailable();

  it("confinedRunnerArgs names the exact flags: fs-confine + heap cap + child_process allowed", () => {
    const args = confinedRunnerArgs("C:\\tmp\\rapidtool-run-abc");
    assert.ok(args.includes("--permission"));
    assert.ok(args.includes("--allow-fs-read=*"), "reads are allowed broadly — the harness reads the emitted tree");
    assert.ok(args.includes("--allow-fs-write=C:/tmp/rapidtool-run-abc"), "writes stay confined to the scratch dir");
    assert.ok(args.includes("--allow-child-process"), "the tier must allow spawning");
    assert.ok(args.includes(`--max-old-space-size=${RUNNER_STRICT_HEAP_CAP_MB}`));
    assert.equal(args.includes("--allow-worker"), false, "workers stay denied — only child_process is opened");
    // A caller-declared workspace adds a WRITE root only (never a read-scope widen).
    const withWs = confinedRunnerArgs("C:\\tmp\\rapidtool-run-abc", ["C:\\tmp\\rt-ws"]);
    assert.ok(withWs.includes("--allow-fs-write=C:/tmp/rt-ws"));
    assert.equal(withWs.filter((a) => a === "--allow-fs-read=*").length, 1);
    // The strict tier must NEVER gain --allow-child-process (byte-identical).
    assert.equal(strictRunnerArgs("C:\\tmp\\x").includes("--allow-child-process"), false);
  });

  it("tierBound: confined allows child_process; strict denies; both degrade honestly", () => {
    const confined = tierBound("confined", true);
    assert.equal(confined.tier, "confined");
    assert.equal(confined.mechanism, "node-permission-model");
    assert.equal(confined.enforced, true);
    assert.equal(confined.fsWriteConfined, true, "fs writes stay confined under confined");
    assert.equal(confined.subprocessAllowed, true, "confined explicitly allows a child");
    assert.equal(confined.subprocessDenied, false);
    assert.equal(confined.heapCapMb, RUNNER_STRICT_HEAP_CAP_MB);
    assert.match(confined.note ?? "", /child_process is EXPLICITLY ALLOWED/);
    assert.match(confined.note ?? "", /not an OS sandbox/i);
    assert.match(
      tierBound("confined", true, ["C:\\ws"]).note ?? "",
      /caller-declared workspace dir/,
      "a declared workspace root is named in the bound",
    );

    const strict = tierBound("strict", true);
    assert.equal(strict.subprocessDenied, true);
    assert.equal("tier" in strict, false, "the strict bound stays byte-identical (no new keys)");
    assert.equal("subprocessAllowed" in strict, false);

    // Availability degrades honestly — no flags, no pretend boundary.
    const degradedConfined = tierBound("confined", false);
    assert.equal(degradedConfined.tier, "confined");
    assert.equal(degradedConfined.subprocessAllowed, true, "the requested tier is still named");
    for (const tier of ["strict", "confined"] as const) {
      const degraded = tierBound(tier, false);
      assert.equal(degraded.mechanism, "none");
      assert.equal(degraded.available, false);
      assert.equal(degraded.enforced, false, `${tier}: never a pretend boundary`);
      assert.equal(degraded.fsWriteConfined, false, `${tier}: no confinement claimed`);
      assert.equal(degraded.subprocessDenied, false, `${tier}: strict cannot deny without the flag`);
      if (tier === "confined") assert.match(degraded.note ?? "", /was NOT applied/);
      else assert.equal("note" in degraded, false, "strict bound carries no note (byte-identical)");
    }
  });

  it("tierRunnerArgs skips every Permission-Model flag when unavailable (heap cap only)", () => {
    const dir = "C:\\tmp\\rapidtool-run-xyz";
    for (const tier of ["strict", "confined"] as const) {
      assert.deepEqual(tierRunnerArgs(tier, dir, false), [
        `--max-old-space-size=${RUNNER_STRICT_HEAP_CAP_MB}`,
      ]);
    }
    assert.deepEqual(tierRunnerArgs("confined", dir, true), confinedRunnerArgs(dir));
    assert.deepEqual(tierRunnerArgs("strict", dir, true), strictRunnerArgs(dir));
  });

  it("CAN still spawn `node --test` in its scratch dir (the compile-check need) — real child", { skip: !confinedReady }, async () => {
    const code = [
      "const fs=require('node:fs');",
      "fs.writeFileSync('./confined-spec.test.mjs','import {test} from \"node:test\";import assert from \"node:assert\";test(\"t\",()=>{assert.equal(1,1)});');",
      "const cp=require('node:child_process');",
      "const r=cp.spawnSync(process.execPath,['--test','--test-reporter=tap','./confined-spec.test.mjs'],{encoding:'utf8'});",
      "console.log('SPAWN-STATUS:'+r.status);",
      "console.error(String(r.stderr).slice(0,300));",
    ].join("\n");
    const res = await runNodeBounded(code, { timeoutMs: 20_000, isolation: "confined" });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.exitCode, 0, `the spawned node --test must run: ${res.stderr}`);
    assert.match(res.stdout, /SPAWN-STATUS:0/);
    assert.equal(res.bound?.tier, "confined");
    assert.equal(res.bound?.subprocessAllowed, true);
  });

  it("denies a filesystem write OUTSIDE the per-run scratch dir (real child)", { skip: !confinedReady }, async () => {
    const escape = join(tmpdir(), `rapidtool-346-confined-escape-${process.pid}-${Date.now()}.txt`);
    try {
      const code =
        `const fs=require('node:fs');` +
        `try{fs.writeFileSync(${JSON.stringify(escape)},'pwned');console.log('ESCAPED')}` +
        `catch(e){console.error('DENIED:'+e.code);process.exit(9)}`;
      const res = await runNodeBounded(code, { timeoutMs: 15_000, isolation: "confined" });
      assert.equal(res.ok, true, "the child runs — it is the WRITE that must be denied");
      if (!res.ok) return;
      assert.equal(res.exitCode, 9, "the child observed and reported the denial");
      assert.match(res.stderr, /ERR_ACCESS_DENIED/);
      assert.doesNotMatch(res.stdout, /ESCAPED/);
      assert.equal(existsSync(escape), false, "the escape file must NOT exist on disk");
      assert.equal(res.bound?.mechanism, "node-permission-model");
      assert.equal(res.bound?.fsWriteConfined, true);
      assert.equal(res.bound?.enforced, true);
    } finally {
      try {
        rmSync(escape, { force: true });
      } catch {
        /* nothing to clean */
      }
    }
  });

  it("allows a write INSIDE the scratch dir — confinement, not blanket denial (real child)", { skip: !confinedReady }, async () => {
    const code =
      `const fs=require('node:fs');` +
      `fs.writeFileSync('./confined-inside.txt','ok');` +
      `console.log('WROTE:'+fs.readFileSync('./confined-inside.txt','utf8'));`;
    const res = await runNodeBounded(code, { timeoutMs: 15_000, isolation: "confined" });
    assert.equal(res.ok, true);
    if (!res.ok) return;
    assert.equal(res.exitCode, 0, res.stderr);
    assert.match(res.stdout, /WROTE:ok/);
  });

  it("honors a caller-declared workspace WRITE root but still denies outside it (real child)", { skip: !confinedReady }, async () => {
    const ws = mkdtempSync(join(tmpdir(), "rapidtool-346-ws-"));
    const outside = mkdtempSync(join(tmpdir(), "rapidtool-346-out-"));
    const wsFile = join(ws, "allowed.txt");
    const outFile = join(outside, "denied.txt");
    try {
      const code =
        `const fs=require('node:fs');` +
        `fs.writeFileSync(${JSON.stringify(wsFile)},'ws-ok');console.log('WROTE-WS');` +
        `try{fs.writeFileSync(${JSON.stringify(outFile)},'pwned');console.log('WROTE-OUTSIDE')}` +
        `catch(e){console.error('DENIED-OUTSIDE:'+e.code)}`;
      const res = await runNodeBounded(code, {
        timeoutMs: 15_000,
        isolation: "confined",
        isolationWriteDirs: [ws],
      });
      assert.equal(res.ok, true);
      if (!res.ok) return;
      assert.equal(res.exitCode, 0, res.stderr);
      assert.match(res.stdout, /WROTE-WS/);
      assert.doesNotMatch(res.stdout, /WROTE-OUTSIDE/);
      assert.match(res.stderr, /DENIED-OUTSIDE:ERR_ACCESS_DENIED/);
      assert.equal(existsSync(wsFile), true, "the declared workspace root is writable");
      assert.equal(existsSync(outFile), false, "a sibling dir outside the declared roots stays denied");
      assert.match(res.bound?.note ?? "", /caller-declared workspace dir/);
    } finally {
      for (const d of [ws, outside]) {
        try {
          rmSync(d, { recursive: true, force: true });
        } catch {
          /* best-effort */
        }
      }
    }
  });

  it("strict ignores isolationWriteDirs — its confinement never widens", { skip: !(runnerAvailable() && permissionModelAvailable()) }, async () => {
    const ws = mkdtempSync(join(tmpdir(), "rapidtool-346-strictws-"));
    const wsFile = join(ws, "denied-under-strict.txt");
    try {
      const code =
        `const fs=require('node:fs');` +
        `try{fs.writeFileSync(${JSON.stringify(wsFile)},'x');console.log('WROTE')}` +
        `catch(e){console.error('DENIED:'+e.code);process.exit(5)}`;
      const res = await runNodeBounded(code, {
        timeoutMs: 15_000,
        isolation: "strict",
        isolationWriteDirs: [ws],
      });
      assert.equal(res.ok, true);
      if (!res.ok) return;
      assert.equal(res.exitCode, 5, "strict must not honor a caller write root");
      assert.match(res.stderr, /ERR_ACCESS_DENIED/);
      assert.equal(existsSync(wsFile), false);
    } finally {
      try {
        rmSync(ws, { recursive: true, force: true });
      } catch {
        /* best-effort */
      }
    }
  });

  it("confined envelope carries its bound; the legacy envelope gains NO new field", async () => {
    if (!runnerAvailable()) return;
    const confined = await runNodeBounded("console.log('confined-ok')", {
      timeoutMs: 15_000,
      isolation: "confined",
    });
    assert.equal(confined.ok, true);
    assert.ok(confined.bound, "a confined run carries its bound record");
    assert.equal(confined.bound?.tier, "confined");
    assert.equal(confined.bound?.subprocessAllowed, true);
    assert.equal(confined.bound?.subprocessDenied, false);
    assert.equal(confined.bound?.heapCapMb, RUNNER_STRICT_HEAP_CAP_MB);
    const legacy = await runNodeBounded("console.log('legacy-ok')", { timeoutMs: 15_000 });
    assert.equal("bound" in legacy, false, "the legacy envelope gains NO new field");
  });

  it("legacy (isolation omitted) is unchanged: the SAME outside write succeeds — the tier is what confines", async () => {
    if (!runnerAvailable()) return;
    const escape = join(tmpdir(), `rapidtool-346-legacy-escape-${process.pid}-${Date.now()}.txt`);
    try {
      const code =
        `const fs=require('node:fs');` +
        `fs.writeFileSync(${JSON.stringify(escape)},'pwned');console.log('ESCAPED');`;
      const res = await runNodeBounded(code, { timeoutMs: 15_000 });
      assert.equal(res.ok, true);
      if (!res.ok) return;
      assert.match(res.stdout, /ESCAPED/);
      assert.equal(existsSync(escape), true, "legacy has no confinement — it is the tier that changes behaviour");
      assert.equal("bound" in res, false);
    } finally {
      try {
        rmSync(escape, { force: true });
      } catch {
        /* nothing to clean */
      }
    }
  });

  it("strict + verdictChannel compose: an authenticated fd-3 verdict still arrives under the bound (real child)", { skip: !(runnerAvailable() && permissionModelAvailable()) }, async () => {
    const code =
      "(function(){var fs=require('node:fs');var w=fs.writeSync.bind(fs);" +
      "var n='';try{n=String(fs.readFileSync(0,'utf8')).trim()}catch(e){n=''};" +
      "w(3,n+' HARNESS_COMPILE pass\\n');w(3,n+' ORACLE_RESULT c1 pass true\\n');})();";
    const res = await runNodeBounded(code, {
      timeoutMs: 15_000,
      verdictChannel: true,
      isolation: "strict",
    });
    assert.equal(res.ok, true, `the harness must run under strict: ${res.ok ? "" : res.error}`);
    if (!res.ok) return;
    assert.match(res.verdict ?? "", /HARNESS_COMPILE pass/);
    assert.match(res.verdict ?? "", /ORACLE_RESULT c1 pass true/);
    assert.equal(res.bound?.subprocessDenied, true);
    assert.equal("tier" in (res.bound ?? {}), false, "strict bound stays byte-identical");
  });
});
