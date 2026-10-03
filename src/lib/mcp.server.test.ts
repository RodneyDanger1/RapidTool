// ---------------------------------------------------------------------------
// mcp.server.test.ts — F1 (finalsprint.md / R8-f11): the MCP stdio client seam.
//
// These tests spawn a REAL child process (src/lib/mcp/stub-server.ts) over a
// real stdio pipe and drive the full JSON-RPC 2.0 handshake — there is no
// fetch/protocol mocking here, because the protocol IS the subject.
//
// Run on Node 22 and 24:
//   node --experimental-strip-types --test src/lib/mcp.server.test.ts
// ---------------------------------------------------------------------------
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import {
  MCP_ARGS_ENV,
  MCP_CWD_ENV,
  MCP_ENABLE_ENV,
  MCP_PROTOCOL_VERSION,
  MCP_SERVER_ENV,
  connectMcpServer,
  mcpEnabled,
  mcpToolsSurface,
  resolveMcpServerConfig,
  runReadOnlyToolRoundTrip,
  type McpServerConfig,
} from "./mcp.server.ts";
// 342-5: the doctor surface is the MCP client's consumer; imported here because
// this lane owns this test file (doctor.test.ts is another lane's).
import { doctorMcp } from "./doctor.ts";

const STUB_PATH = fileURLToPath(new URL("./mcp/stub-server.ts", import.meta.url));

/** Enablement is passed per-call so these tests never depend on the outer shell. */
const ENABLED_ENV: NodeJS.ProcessEnv = { [MCP_ENABLE_ENV]: "1" };
const DISABLED_ENV: NodeJS.ProcessEnv = {};

/** Config that spawns the in-repo stub over stdio with the current node. */
function stub(mode: string): McpServerConfig {
  return {
    command: process.execPath,
    args: ["--experimental-strip-types", STUB_PATH, `--mode=${mode}`],
  };
}

describe("mcpEnabled (enablement gate, pure)", () => {
  it("is OFF for unset, empty, false and 0", () => {
    assert.equal(mcpEnabled({}), false);
    assert.equal(mcpEnabled({ [MCP_ENABLE_ENV]: "" }), false);
    assert.equal(mcpEnabled({ [MCP_ENABLE_ENV]: "false" }), false);
    assert.equal(mcpEnabled({ [MCP_ENABLE_ENV]: "0" }), false);
  });

  it("is ON only for the documented opt-in values (1 / true)", () => {
    assert.equal(mcpEnabled({ [MCP_ENABLE_ENV]: "1" }), true);
    assert.equal(mcpEnabled({ [MCP_ENABLE_ENV]: "true" }), true);
    assert.equal(mcpEnabled({ [MCP_ENABLE_ENV]: "TRUE" }), true);
  });
});

describe("disabled by default (RT_E_MCP_DISABLED)", () => {
  it("refuses with the coded remedy and never spawns a child", async () => {
    // A binary that cannot exist: if the gate leaked, the spawn 'error' path
    // would surface RT_E_RUNNER_FAILED instead of RT_E_MCP_DISABLED.
    const res = await connectMcpServer(
      { command: "rapidtool-definitely-missing-mcp-binary-xyz", args: [] },
      { env: DISABLED_ENV },
    );
    if (res.ok) throw new Error("expected an enablement refusal");
    assert.equal(res.code, "RT_E_MCP_DISABLED");
    assert.match(res.error, /RAPIDTOOL_MCP_ENABLED/);
    // No simulated discovery, no fabricated tool list.
    assert.equal("tools" in res, false);
    assert.equal("serverInfo" in res, false);
  });

  it("runReadOnlyToolRoundTrip is gated the same way", async () => {
    const res = await runReadOnlyToolRoundTrip(
      { command: "rapidtool-definitely-missing-mcp-binary-xyz" },
      { tool: "echo", args: { text: "hi" } },
      { env: DISABLED_ENV },
    );
    if (res.ok) throw new Error("expected an enablement refusal");
    assert.equal(res.code, "RT_E_MCP_DISABLED");
  });
});

describe("initialize handshake + tools/list", () => {
  it("completes the handshake and reports the server's own protocolVersion/serverInfo", async () => {
    const res = await connectMcpServer(stub("normal"), { env: ENABLED_ENV, timeoutMs: 10_000 });
    if (!res.ok) throw new Error(`expected connect to succeed: ${res.error}`);
    try {
      assert.equal(res.protocolVersion, MCP_PROTOCOL_VERSION);
      assert.equal(res.serverInfo.name, "stub-mcp");
      assert.equal(res.serverInfo.version, "0.0.1");

      const listed = await res.client.listTools();
      if (!listed.ok) throw new Error(`expected tools/list to succeed: ${listed.error}`);
      assert.deepEqual(
        listed.tools.map((t) => t.name),
        ["echo", "env", "write_thing"],
      );
      assert.equal(listed.tools.find((t) => t.name === "echo")?.readOnly, true);
      assert.equal(listed.tools.find((t) => t.name === "env")?.readOnly, true);
      assert.equal(listed.tools.find((t) => t.name === "write_thing")?.readOnly, false);
    } finally {
      await res.client.close();
    }
  });
});

describe("read-only tools/call", () => {
  it("calls a listed read-only tool and returns its content", async () => {
    const res = await connectMcpServer(stub("normal"), { env: ENABLED_ENV, timeoutMs: 10_000 });
    if (!res.ok) throw new Error(`expected connect to succeed: ${res.error}`);
    try {
      const call = await res.client.callTool("echo", { text: "round-trip" });
      if (!call.ok) throw new Error(`expected tools/call to succeed: ${call.error}`);
      assert.equal(call.tool, "echo");
      assert.equal(call.isError, false);
      assert.deepEqual(call.content, [{ type: "text", text: "round-trip" }]);
    } finally {
      await res.client.close();
    }
  });

  it("runReadOnlyToolRoundTrip returns the content for a listed read-only tool", async () => {
    const res = await runReadOnlyToolRoundTrip(
      stub("normal"),
      { tool: "echo", args: { text: "seam" } },
      { env: ENABLED_ENV, timeoutMs: 10_000 },
    );
    if (!res.ok) throw new Error(`expected the round-trip to succeed: ${res.error}`);
    assert.equal(res.tool, "echo");
    assert.deepEqual(res.content, [{ type: "text", text: "seam" }]);
  });

  it("refuses a tool name the server did not list (never invents one)", async () => {
    const res = await connectMcpServer(stub("normal"), { env: ENABLED_ENV, timeoutMs: 10_000 });
    if (!res.ok) throw new Error(`expected connect to succeed: ${res.error}`);
    try {
      const call = await res.client.callTool("delete_everything", {});
      if (call.ok) throw new Error("expected the unlisted tool to be refused");
      assert.equal(call.code, "RT_E_VALIDATION");
      assert.match(call.error, /did not list a tool named "delete_everything"/);
    } finally {
      await res.client.close();
    }
  });

  it("refuses a listed tool the server did not advertise read-only", async () => {
    const res = await connectMcpServer(stub("normal"), { env: ENABLED_ENV, timeoutMs: 10_000 });
    if (!res.ok) throw new Error(`expected connect to succeed: ${res.error}`);
    try {
      const call = await res.client.callTool("write_thing", {});
      if (call.ok) throw new Error("expected the non-read-only tool to be refused");
      assert.equal(call.code, "RT_E_VALIDATION");
      assert.match(call.error, /not advertised read-only/);
    } finally {
      await res.client.close();
    }
  });

  it("never forwards a secret into the child environment", async () => {
    const probe = "test-secret-value-340-1-never-print";
    const prevKey = process.env.DEEPSEEK_API_KEY;
    const prevSwitch = process.env[MCP_ENABLE_ENV];
    process.env.DEEPSEEK_API_KEY = probe;
    // Set in the PARENT: the child must not inherit it, and it must not change
    // the gate either (the test passes env explicitly).
    process.env[MCP_ENABLE_ENV] = "1";
    try {
      const res = await connectMcpServer(stub("normal"), { env: ENABLED_ENV, timeoutMs: 10_000 });
      if (!res.ok) throw new Error(`expected connect to succeed: ${res.error}`);
      try {
        const call = await res.client.callTool("env", {});
        if (!call.ok) throw new Error(`expected the env tool to succeed: ${call.error}`);
        const text = call.content.map((b) => b.text ?? "").join("");
        const keys = JSON.parse(text) as string[];
        assert.equal(
          keys.some((k) => k.toUpperCase() === "DEEPSEEK_API_KEY"),
          false,
        );
        assert.equal(
          keys.some((k) => k.toUpperCase() === "RAPIDTOOL_MCP_ENABLED"),
          false,
        );
        assert.equal(
          keys.some((k) => k.toUpperCase() === "PATH"),
          true,
        );
        assert.equal(text.includes(probe), false);
      } finally {
        await res.client.close();
      }
    } finally {
      if (prevKey === undefined) delete process.env.DEEPSEEK_API_KEY;
      else process.env.DEEPSEEK_API_KEY = prevKey;
      if (prevSwitch === undefined) delete process.env[MCP_ENABLE_ENV];
      else process.env[MCP_ENABLE_ENV] = prevSwitch;
    }
  });
});

describe("coded refusals — never a partial pass", () => {
  it("times out a hung server with RT_E_RUNNER_FAILED", async () => {
    // The budget must comfortably exceed one cold child spawn + initialize
    // (Node 22 startup is slower than 24) while staying finite.
    const res = await connectMcpServer(stub("hang-list"), { env: ENABLED_ENV, timeoutMs: 5000 });
    if (!res.ok) throw new Error(`expected connect to succeed: ${res.error}`);
    try {
      const listed = await res.client.listTools();
      if (listed.ok) throw new Error("expected a timeout refusal");
      assert.equal(listed.code, "RT_E_RUNNER_FAILED");
      assert.match(listed.error, /timed out after 5000ms/);
    } finally {
      await res.client.close();
    }
  });

  it("refuses a malformed (non-JSON) reply with RT_E_VALIDATION", async () => {
    const res = await connectMcpServer(stub("malformed-json"), { env: ENABLED_ENV, timeoutMs: 10_000 });
    if (!res.ok) throw new Error(`expected connect to succeed: ${res.error}`);
    try {
      const listed = await res.client.listTools();
      if (listed.ok) throw new Error("expected a malformed-reply refusal");
      assert.equal(listed.code, "RT_E_VALIDATION");
      assert.match(listed.error, /not valid JSON/);
    } finally {
      await res.client.close();
    }
  });

  it("refuses an unknown-id reply with RT_E_VALIDATION", async () => {
    const res = await connectMcpServer(stub("unknown-id"), { env: ENABLED_ENV, timeoutMs: 10_000 });
    if (!res.ok) throw new Error(`expected connect to succeed: ${res.error}`);
    try {
      const listed = await res.client.listTools();
      if (listed.ok) throw new Error("expected an unknown-id refusal");
      assert.equal(listed.code, "RT_E_VALIDATION");
      assert.match(listed.error, /unknown id/);
    } finally {
      await res.client.close();
    }
  });

  it("refuses an oversized reply with RT_E_VALIDATION", async () => {
    const res = await connectMcpServer(stub("oversized"), {
      env: ENABLED_ENV,
      timeoutMs: 10_000,
      maxFrameBytes: 512,
    });
    if (!res.ok) throw new Error(`expected connect to succeed: ${res.error}`);
    try {
      const listed = await res.client.listTools();
      if (listed.ok) throw new Error("expected an oversized-reply refusal");
      assert.equal(listed.code, "RT_E_VALIDATION");
      assert.match(listed.error, /frame cap/);
    } finally {
      await res.client.close();
    }
  });

  it("surfaces a JSON-RPC error response with RT_E_RUNNER_FAILED", async () => {
    const res = await connectMcpServer(stub("error-response"), { env: ENABLED_ENV, timeoutMs: 10_000 });
    if (!res.ok) throw new Error(`expected connect to succeed: ${res.error}`);
    try {
      const listed = await res.client.listTools();
      if (listed.ok) throw new Error("expected a server-error refusal");
      assert.equal(listed.code, "RT_E_RUNNER_FAILED");
      assert.match(listed.error, /deliberately refused/);
    } finally {
      await res.client.close();
    }
  });

  it("surfaces a non-zero child exit during the handshake with RT_E_RUNNER_FAILED", async () => {
    const res = await connectMcpServer(stub("exit-nonzero"), { env: ENABLED_ENV, timeoutMs: 10_000 });
    if (res.ok) throw new Error("expected the handshake to fail on child exit");
    assert.equal(res.code, "RT_E_RUNNER_FAILED");
    assert.match(res.error, /exited/);
  });

  it("surfaces a spawn failure with RT_E_RUNNER_FAILED", async () => {
    const res = await connectMcpServer(
      { command: "rapidtool-definitely-missing-mcp-binary-xyz", args: [] },
      { env: ENABLED_ENV, timeoutMs: 10_000 },
    );
    if (res.ok) throw new Error("expected a spawn failure");
    assert.equal(res.code, "RT_E_RUNNER_FAILED");
  });

  it("requires a non-empty command with RT_E_VALIDATION", async () => {
    const res = await connectMcpServer({ command: "   " }, { env: ENABLED_ENV });
    if (res.ok) throw new Error("expected a config refusal");
    assert.equal(res.code, "RT_E_VALIDATION");
  });
});

describe("sticky fault — a violation after a correlated reply poisons the client", () => {
  // 340-1 verifier A: a server that answers a request correctly and THEN emits
  // a duplicate id / garbage in the same stdout chunk used to leave a
  // single-call consumer holding `{"ok":true}` with no way to see the taint.
  // The fix is a sticky, observable fault: the resolved reply stays resolved
  // (its bytes arrived first), but every later request refuses and `client.faulted`
  // exposes the original violation.

  it("duplicate id after a resolved reply: faulted is observable and the next listTools refuses", async () => {
    const res = await connectMcpServer(stub("dup-id-after"), { env: ENABLED_ENV, timeoutMs: 10_000 });
    if (!res.ok) throw new Error(`expected connect to succeed: ${res.error}`);
    try {
      const listed = await res.client.listTools();
      // The duplicate arrived after this reply's bytes, so the reply resolves…
      assert.equal(listed.ok, true);
      // …but the taint is explicit and sticky.
      const fault = res.client.faulted;
      assert.ok(fault, "expected the tainted client to expose a sticky fault");
      assert.equal(fault.code, "RT_E_VALIDATION");
      assert.match(fault.error, /unknown id/);
      const again = await res.client.listTools();
      if (again.ok) throw new Error("expected the tainted client to refuse the next request");
      assert.equal(again.code, "RT_E_VALIDATION");
      assert.match(again.error, /unknown id/);
    } finally {
      await res.client.close();
    }
  });

  it("duplicate id after a resolved reply: the round-trip fails closed", async () => {
    const rt = await runReadOnlyToolRoundTrip(
      stub("dup-id-after"),
      { tool: "echo", args: { text: "x" } },
      { env: ENABLED_ENV, timeoutMs: 10_000 },
    );
    if (rt.ok) throw new Error("expected the round-trip to fail closed");
    assert.equal(rt.code, "RT_E_VALIDATION");
    assert.match(rt.error, /unknown id/);
  });

  it("valid line then garbage: faulted is observable, the next listTools refuses, the round-trip fails closed", async () => {
    const res = await connectMcpServer(stub("garbage-after"), { env: ENABLED_ENV, timeoutMs: 10_000 });
    if (!res.ok) throw new Error(`expected connect to succeed: ${res.error}`);
    try {
      const listed = await res.client.listTools();
      assert.equal(listed.ok, true);
      const fault = res.client.faulted;
      assert.ok(fault, "expected the tainted client to expose a sticky fault");
      assert.equal(fault.code, "RT_E_VALIDATION");
      assert.match(fault.error, /not valid JSON/);
      const again = await res.client.listTools();
      if (again.ok) throw new Error("expected the tainted client to refuse the next request");
      assert.equal(again.code, "RT_E_VALIDATION");
      assert.match(again.error, /not valid JSON/);
    } finally {
      await res.client.close();
    }
    const rt = await runReadOnlyToolRoundTrip(
      stub("garbage-after"),
      { tool: "echo", args: { text: "x" } },
      { env: ENABLED_ENV, timeoutMs: 10_000 },
    );
    if (rt.ok) throw new Error("expected the round-trip to fail closed");
    assert.equal(rt.code, "RT_E_VALIDATION");
    assert.match(rt.error, /not valid JSON/);
  });

  it("a violation BEFORE the correlated reply fails that request (observable before it resolves)", async () => {
    const res = await connectMcpServer(stub("garbage-before"), { env: ENABLED_ENV, timeoutMs: 10_000 });
    if (!res.ok) throw new Error(`expected connect to succeed: ${res.error}`);
    try {
      const listed = await res.client.listTools();
      if (listed.ok) throw new Error("expected the request to fail before its reply");
      assert.equal(listed.code, "RT_E_VALIDATION");
      assert.match(listed.error, /not valid JSON/);
    } finally {
      await res.client.close();
    }
  });

  it("control: a clean single call still succeeds and leaves the client unfaulted", async () => {
    const res = await connectMcpServer(stub("normal"), { env: ENABLED_ENV, timeoutMs: 10_000 });
    if (!res.ok) throw new Error(`expected connect to succeed: ${res.error}`);
    try {
      const listed = await res.client.listTools();
      if (!listed.ok) throw new Error(`expected a clean listTools: ${listed.error}`);
      assert.equal(listed.tools.length, 3);
      assert.equal(res.client.faulted, null);
    } finally {
      await res.client.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 342-5 — the env-configured server + the consumer surface. These pin the two
// halves the mission requires: config resolution is PURE, and the surface is
// OFF by default (a disabled host spawns NOTHING, lists NOTHING — proven with a
// binary that cannot exist, so a leaked gate would surface RT_E_RUNNER_FAILED
// instead of RT_E_MCP_DISABLED).
// ---------------------------------------------------------------------------

const MISSING_BINARY = "rapidtool-definitely-missing-mcp-binary-xyz";

/** Env for an enabled host whose server is the real stub child. */
function stubEnv(mode: string): NodeJS.ProcessEnv {
  return {
    [MCP_ENABLE_ENV]: "1",
    [MCP_SERVER_ENV]: process.execPath,
    [MCP_ARGS_ENV]: JSON.stringify(["--experimental-strip-types", STUB_PATH, `--mode=${mode}`]),
  };
}

describe("342-5 — resolveMcpServerConfig (pure, no I/O)", () => {
  it("unset / blank command ⇒ configured:false (an unconfigured host is the default, not an error)", () => {
    assert.deepEqual(resolveMcpServerConfig({}), { ok: true, configured: false });
    assert.deepEqual(resolveMcpServerConfig({ [MCP_SERVER_ENV]: "" }), { ok: true, configured: false });
    assert.deepEqual(resolveMcpServerConfig({ [MCP_SERVER_ENV]: "   " }), { ok: true, configured: false });
  });

  it("a command alone resolves with an empty arg list; cwd is optional", () => {
    assert.deepEqual(resolveMcpServerConfig({ [MCP_SERVER_ENV]: "node" }), {
      ok: true,
      configured: true,
      config: { command: "node", args: [] },
    });
    assert.deepEqual(
      resolveMcpServerConfig({ [MCP_SERVER_ENV]: " node ", [MCP_CWD_ENV]: " C:\\work " }),
      { ok: true, configured: true, config: { command: "node", args: [], cwd: "C:\\work" } },
    );
  });

  it("args accept a JSON string array (unambiguous) or a whitespace-separated list", () => {
    assert.deepEqual(
      resolveMcpServerConfig({ [MCP_SERVER_ENV]: "node", [MCP_ARGS_ENV]: '["--flag","a b"]' }),
      { ok: true, configured: true, config: { command: "node", args: ["--flag", "a b"] } },
    );
    assert.deepEqual(
      resolveMcpServerConfig({ [MCP_SERVER_ENV]: "node", [MCP_ARGS_ENV]: "  --flag   a  " }),
      { ok: true, configured: true, config: { command: "node", args: ["--flag", "a"] } },
    );
  });

  it("malformed args are a coded refusal, never a silent drop", () => {
    const notJson = resolveMcpServerConfig({ [MCP_SERVER_ENV]: "node", [MCP_ARGS_ENV]: "[oops" });
    assert.equal(notJson.ok, false);
    if (!notJson.ok) {
      assert.equal(notJson.code, "RT_E_VALIDATION");
      assert.match(notJson.error, /not valid JSON/);
    }
    for (const bad of ["[1,2]", '[{"a":1}]', '["ok",null]']) {
      const r = resolveMcpServerConfig({ [MCP_SERVER_ENV]: "node", [MCP_ARGS_ENV]: bad });
      assert.equal(r.ok, false, `${bad} is not a string array`);
      if (!r.ok) assert.equal(r.code, "RT_E_VALIDATION");
    }
  });
});

describe("342-5 — mcpToolsSurface: owner-gated, OFF by default, never a fabricated list", () => {
  it("disabled + configured: RT_E_MCP_DISABLED with zero spawn, zero tools (the missing binary would fail if spawned)", async () => {
    const surface = await mcpToolsSurface({
      env: { [MCP_SERVER_ENV]: MISSING_BINARY },
      timeoutMs: 10_000,
    });
    assert.equal(surface.enabled, false);
    assert.equal(surface.configured, true);
    assert.equal(surface.spawnAttempted, false, "a disabled host must not spawn the configured server");
    assert.equal(surface.tools, null);
    assert.ok(surface.refusal, "a disabled surface carries its coded refusal");
    assert.equal(surface.refusal.code, "RT_E_MCP_DISABLED");
    assert.match(surface.refusal.error, /RAPIDTOOL_MCP_ENABLED/);
    assert.match(surface.line, /disabled/i);
  });

  it("disabled + an injected valid server: still no spawn and no tool list", async () => {
    const surface = await mcpToolsSurface({ env: {}, server: stub("normal"), timeoutMs: 10_000 });
    assert.equal(surface.enabled, false);
    assert.equal(surface.spawnAttempted, false);
    assert.equal(surface.tools, null);
    assert.equal(surface.refusal?.code, "RT_E_MCP_DISABLED");
  });

  it("enabled but unconfigured: no spawn, RT_E_VALIDATION naming the config var", async () => {
    const surface = await mcpToolsSurface({ env: { [MCP_ENABLE_ENV]: "1" } });
    assert.equal(surface.enabled, true);
    assert.equal(surface.configured, false);
    assert.equal(surface.spawnAttempted, false);
    assert.equal(surface.tools, null);
    assert.equal(surface.refusal?.code, "RT_E_VALIDATION");
    assert.match(surface.refusal?.error ?? "", /RAPIDTOOL_MCP_SERVER/);
  });

  it("enabled + configured via env: the REAL tools/list result from the spawned child", async () => {
    const surface = await mcpToolsSurface({ env: stubEnv("normal"), timeoutMs: 10_000 });
    assert.equal(surface.enabled, true);
    assert.equal(surface.configured, true);
    assert.equal(surface.spawnAttempted, true);
    assert.equal(surface.refusal, null);
    assert.equal(surface.serverInfo?.name, "stub-mcp");
    assert.equal(surface.protocolVersion, MCP_PROTOCOL_VERSION);
    assert.deepEqual(
      surface.tools?.map((t) => t.name),
      ["echo", "env", "write_thing"],
    );
    assert.equal(surface.tools?.find((t) => t.name === "write_thing")?.readOnly, false);
  });

  it("enabled + configured + a named read-only tool: the round-trip result rides the same surface", async () => {
    const surface = await mcpToolsSurface({
      env: stubEnv("normal"),
      call: { tool: "echo", args: { text: "surfaced" } },
      timeoutMs: 10_000,
    });
    assert.equal(surface.refusal, null);
    assert.deepEqual(surface.call?.content, [{ type: "text", text: "surfaced" }]);
    assert.equal(surface.call?.isError, false);
  });

  it("enabled + configured + an unlisted tool: the surface refuses, never invents a tool", async () => {
    const surface = await mcpToolsSurface({
      env: stubEnv("normal"),
      call: { tool: "delete_everything", args: {} },
      timeoutMs: 10_000,
    });
    assert.equal(surface.call, null);
    assert.equal(surface.refusal?.code, "RT_E_VALIDATION");
    assert.match(surface.refusal?.error ?? "", /did not list a tool named/);
  });

  it("enabled + configured + a non-read-only tool: refused in the read-only round-trip", async () => {
    const surface = await mcpToolsSurface({
      env: stubEnv("normal"),
      call: { tool: "write_thing", args: {} },
      timeoutMs: 10_000,
    });
    assert.equal(surface.call, null);
    assert.equal(surface.refusal?.code, "RT_E_VALIDATION");
    assert.match(surface.refusal?.error ?? "", /not advertised read-only/);
  });

  it("enabled + a configured-but-missing binary: the spawn failure is coded and spawnAttempted is true", async () => {
    const surface = await mcpToolsSurface({
      env: { [MCP_ENABLE_ENV]: "1", [MCP_SERVER_ENV]: MISSING_BINARY },
      timeoutMs: 10_000,
    });
    assert.equal(surface.spawnAttempted, true);
    assert.equal(surface.tools, null);
    assert.equal(surface.refusal?.code, "RT_E_RUNNER_FAILED");
  });
});

describe("342-5 — doctorMcp: the honest doctor surface (the MCP client's consumer)", () => {
  it("keyless/off: reports disabled, spawns nothing, lists nothing", async () => {
    const mcp = await doctorMcp({ env: {} });
    assert.equal(mcp.enabled, false);
    assert.equal(mcp.configured, false);
    assert.equal(mcp.spawnAttempted, false);
    assert.equal(mcp.tools, null);
    assert.equal(mcp.refusal?.code, "RT_E_MCP_DISABLED");
    assert.match(mcp.line, /mcp:/);
  });

  it("disabled but configured: the configured flag is honest, still no spawn/list", async () => {
    const mcp = await doctorMcp({ env: { [MCP_SERVER_ENV]: MISSING_BINARY } });
    assert.equal(mcp.enabled, false);
    assert.equal(mcp.configured, true);
    assert.equal(mcp.spawnAttempted, false);
    assert.equal(mcp.tools, null);
    assert.equal(mcp.refusal?.code, "RT_E_MCP_DISABLED");
  });

  it("enabled + configured: the doctor reports the server's OWN tools", async () => {
    const mcp = await doctorMcp({ env: stubEnv("normal"), timeoutMs: 10_000 });
    assert.equal(mcp.enabled, true);
    assert.equal(mcp.configured, true);
    assert.equal(mcp.spawnAttempted, true);
    assert.equal(mcp.refusal, null);
    assert.equal(mcp.tools?.length, 3);
    assert.match(mcp.line, /3 tool/);
  });
});
