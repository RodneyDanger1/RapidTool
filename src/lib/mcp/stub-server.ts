/**
 * Test fixture — a tiny MCP server speaking JSON-RPC 2.0 over stdio.
 *
 * `mcp.server.test.ts` spawns this file as a REAL child so the client's
 * handshake, round-trip and refusal paths run over an actual pipe instead of a
 * mocked protocol. It is deliberately not production code: the only caller is
 * the test. Behaviour is selected with `--mode=<mode>`:
 *
 *   normal         initialize + tools/list + tools/call (the happy path)
 *   hang-list      answers initialize, never answers tools/list (timeout)
 *   malformed-json answers initialize, writes a non-JSON line for tools/list
 *   unknown-id     answers initialize, replies to tools/list with a bogus id
 *   oversized      answers initialize, replies with a frame over the cap
 *   error-response replies to tools/list with a JSON-RPC error object
 *   exit-nonzero   exits with code 4 when initialize arrives
 *   dup-id-after   answers tools/list, then a duplicate id — after the reply
 *   garbage-after  answers tools/list, then a non-JSON line — after the reply
 *   garbage-before a non-JSON line, then the tools/list reply — before it
 *
 * The three *-after / *-before modes put both frames in ONE stdout write so the
 * client consumes them in a single chunk: the violation is already processed by
 * the time the awaiting caller sees the reply, which is what makes the sticky
 * fault observable rather than a pipe-timing race.
 *
 * Framing follows MCP protocol 2024-11-05: newline-delimited JSON-RPC 2.0,
 * one complete JSON message per line (no Content-Length header).
 */

const MODE = ((): string => {
  const arg = process.argv.find((a) => a.startsWith("--mode="));
  return arg ? arg.slice("--mode=".length) : "normal";
})();

const TOOLS = [
  {
    name: "echo",
    description: "Echo back the text argument.",
    inputSchema: { type: "object", properties: { text: { type: "string" } } },
    annotations: { readOnlyHint: true },
  },
  {
    name: "env",
    description: "Return the child environment variable names.",
    inputSchema: { type: "object" },
    annotations: { readOnlyHint: true },
  },
  {
    name: "write_thing",
    description: "A mutating tool (not read-only).",
    inputSchema: { type: "object" },
    annotations: { readOnlyHint: false },
  },
];

function send(message: unknown): void {
  process.stdout.write(JSON.stringify(message) + "\n");
}

function handle(message: Record<string, unknown>): void {
  const id = message.id;
  const method = message.method;

  if (method === "initialize") {
    if (MODE === "exit-nonzero") {
      process.exit(4);
    }
    send({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "stub-mcp", version: "0.0.1" },
      },
    });
    return;
  }

  if (method === "notifications/initialized") {
    return;
  }

  if (method === "tools/list") {
    if (MODE === "hang-list") return;
    if (MODE === "malformed-json") {
      process.stdout.write("{ this is not json\n");
      return;
    }
    if (MODE === "unknown-id") {
      send({ jsonrpc: "2.0", id: 999999, result: { tools: TOOLS } });
      return;
    }
    if (MODE === "oversized") {
      send({ jsonrpc: "2.0", id, result: { tools: TOOLS, pad: "x".repeat(4096) } });
      return;
    }
    if (MODE === "error-response") {
      send({ jsonrpc: "2.0", id, error: { code: -32601, message: "tools/list deliberately refused" } });
      return;
    }
    // One write carrying BOTH frames, so the client consumes the correlated
    // reply and the violation in the same stdout chunk (see header).
    const reply = JSON.stringify({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    if (MODE === "dup-id-after") {
      process.stdout.write(reply + "\n" + reply + "\n");
      return;
    }
    if (MODE === "garbage-after") {
      process.stdout.write(reply + "\n{ this is not json\n");
      return;
    }
    if (MODE === "garbage-before") {
      process.stdout.write("{ this is not json\n" + reply + "\n");
      return;
    }
    send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    return;
  }

  if (method === "tools/call") {
    const params = (message.params ?? {}) as Record<string, unknown>;
    const name = params.name;
    if (name === "echo") {
      const args = (params.arguments ?? {}) as Record<string, unknown>;
      send({
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: String(args.text ?? "") }], isError: false },
      });
      return;
    }
    if (name === "env") {
      send({
        jsonrpc: "2.0",
        id,
        result: { content: [{ type: "text", text: JSON.stringify(Object.keys(process.env)) }], isError: false },
      });
      return;
    }
    send({ jsonrpc: "2.0", id, error: { code: -32602, message: `unknown tool ${String(name)}` } });
    return;
  }

  if (typeof id === "number") {
    send({ jsonrpc: "2.0", id, error: { code: -32601, message: `method not found: ${String(method)}` } });
  }
}

let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk: string) => {
  buffer += chunk;
  let newline: number;
  while ((newline = buffer.indexOf("\n")) >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (line.length === 0) continue;
    try {
      handle(JSON.parse(line) as Record<string, unknown>);
    } catch {
      // The client never sends an unparseable request; ignore defensively.
    }
  }
});
