/**
 * F1 (finalsprint.md F1 · R8-f11 / R13-f06) — the MCP runtime client seam:
 * JSON-RPC 2.0 over stdio, owner-gated OFF by default.
 *
 * WHAT THIS IS
 *   A real MCP client transport. When `RAPIDTOOL_MCP_ENABLED` is `1`/`true`,
 *   `connectMcpServer` spawns the configured MCP server command, performs the
 *   `initialize` handshake followed by `notifications/initialized`, then exposes
 *   `tools/list` and a `tools/call` restricted to a tool the server LISTED and
 *   advertised `annotations.readOnlyHint === true`.
 *
 * HONESTY (the errors.ts:583 contract, verbatim)
 *   - Disabled (the default) is a coded `RT_E_MCP_DISABLED` refusal carrying the
 *     remedy text. It NEVER simulates discovery and NEVER fabricates a tool list.
 *   - The client never invents a tool: `callTool` refuses a name the server did
 *     not list, and refuses a listed tool that was not advertised read-only.
 *   - The four named refusal conditions — an unparseable line, an unsolicited
 *     id, a duplicate id, and an oversized frame — fail the WHOLE client: each
 *     sets a STICKY fault and rejects every in-flight request, and every later
 *     request refuses with that same coded reason. A malformed / error reply
 *     correlated to a request is likewise a coded refusal — never a partial
 *     pass. Every failure carries a code from `./errors.ts`.
 *   - Honest boundary: a violation that arrives on the stream AFTER a
 *     correlated reply has already resolved cannot retroactively fail that
 *     reply — its bytes arrived first, so `listTools`/`callTool` may still
 *     return `ok:true` for it. The taint is not hidden: it poisons every later
 *     request, and `client.faulted` exposes the original violation, so a
 *     single-call consumer must treat a non-null `faulted` as fatal. The F1
 *     round-trip (`listTools` then `tools/call`) therefore always fails closed,
 *     because its second request cannot slip past the fault.
 *
 * PROTOCOL + FRAMING
 *   MCP protocol version 2024-11-05. Its stdio transport frames messages as
 *   newline-delimited UTF-8 JSON-RPC 2.0 — one complete JSON message per line,
 *   no embedded newlines, and NO `Content-Length` header (that header belongs to
 *   the earlier LSP-derived framing). See
 *   https://modelcontextprotocol.io/specification/2024-11-05/basic/transports
 *
 * SERVER-ONLY
 *   No top-level `node:` imports (the H2 crash class). `node:child_process` is
 *   imported lazily inside the call, and the child env is built with the repo's
 *   scrubbed allowlist precedent (`node-runner.server.ts:190` `scrubbedEnv`),
 *   also imported lazily — matching `fixtures.server.ts` / `quarantine.ts`.
 */

import { classifyError, codeError, type CodedFailure, type ErrorCode } from "./errors.ts";
import type { ChildProcess } from "node:child_process";
import type { Writable } from "node:stream";

/** The enablement switch named by errors.ts:583's remedy text. */
export const MCP_ENABLE_ENV = "RAPIDTOOL_MCP_ENABLED";

/** MCP revision implemented here (newline-delimited stdio framing). */
export const MCP_PROTOCOL_VERSION = "2024-11-05";

/** Default per-request bound; a hung server can never strand a caller. */
export const MCP_DEFAULT_TIMEOUT_MS = 10_000;

/** Default cap on a single in-flight reply line. */
export const MCP_DEFAULT_MAX_FRAME_BYTES = 4 * 1024 * 1024;

/** Bounded grace after `stdin.end()` before the child is killed on `close()`. */
export const MCP_CLOSE_GRACE_MS = 500;

/** The exact remedy the disabled refusal carries (mirrors errors.ts:583). */
export const MCP_DISABLED_REMEDY =
  "MCP is owner-gated and disabled by default (RAPIDTOOL_MCP_ENABLED is unset/false): " +
  "no child process was spawned and no tool list was discovered. Wait for the owner's trust " +
  "decision, then set RAPIDTOOL_MCP_ENABLED=1 and re-run the read-only tools/list discovery.";

export interface McpServerConfig {
  /** Executable to spawn (e.g. `node`). Required. */
  command: string;
  /** Arguments passed to the executable. */
  args?: string[];
  /** Working directory for the child. */
  cwd?: string;
}

export interface McpServerInfo {
  name: string;
  version: string;
}

export interface McpToolInfo {
  name: string;
  description: string | null;
  /** True ONLY when the server advertised `annotations.readOnlyHint === true`. */
  readOnly: boolean;
}

export interface McpContentBlock {
  type: string;
  text?: string;
  [key: string]: unknown;
}

export type McpListToolsResult = { ok: true; tools: McpToolInfo[] } | CodedFailure;

export type McpCallToolResult =
  | { ok: true; tool: string; isError: boolean; content: McpContentBlock[] }
  | CodedFailure;

export interface McpClient {
  readonly protocolVersion: string;
  readonly serverInfo: McpServerInfo;
  /** The server's advertised capabilities, verbatim from `initialize`. */
  readonly capabilities: Record<string, unknown>;
  /**
   * The sticky protocol fault, or `null` while the client is clean. Set by an
   * unparseable line, an unsolicited/duplicate id, an oversized frame, a
   * correlated malformed/error reply, a timeout, or a child/transport failure.
   * Once non-null it never clears, and every later request refuses with it. A
   * reply that resolved before the fault stays resolved (its bytes arrived
   * first); consumers must still treat a non-null `faulted` as fatal.
   */
  readonly faulted: CodedFailure | null;
  listTools(): Promise<McpListToolsResult>;
  callTool(name: string, args?: Record<string, unknown>): Promise<McpCallToolResult>;
  close(): Promise<void>;
}

export interface McpConnectOptions {
  /** Environment inspected for the enablement gate (defaults to `process.env`). */
  env?: NodeJS.ProcessEnv;
  /** Per-request timeout. */
  timeoutMs?: number;
  /** Max bytes for one reply line. */
  maxFrameBytes?: number;
  /** Client identity sent in `initialize`. */
  clientInfo?: McpServerInfo;
}

export type McpConnectResult =
  | {
      ok: true;
      client: McpClient;
      protocolVersion: string;
      serverInfo: McpServerInfo;
      capabilities: Record<string, unknown>;
    }
  | CodedFailure;

export type McpRoundTripResult =
  | {
      ok: true;
      protocolVersion: string;
      serverInfo: McpServerInfo;
      tool: string;
      content: McpContentBlock[];
    }
  | CodedFailure;

/** True only for the documented opt-in values; unset/false/0/anything else is OFF. */
export function mcpEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env[MCP_ENABLE_ENV];
  if (typeof raw !== "string") return false;
  const value = raw.trim().toLowerCase();
  return value === "1" || value === "true";
}

/** The honest default-state refusal — never a simulated discovery. */
export function mcpDisabledRefusal(): CodedFailure {
  return codeError("RT_E_MCP_DISABLED", MCP_DISABLED_REMEDY);
}

/** Internal coded failure that survives the promise boundary. */
class McpProtocolError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "McpProtocolError";
    this.code = code;
  }
}

function toFailure(err: unknown): CodedFailure {
  if (err instanceof McpProtocolError) return codeError(err.code, err.message);
  return codeError(classifyError(err, "RT_E_INTERNAL"), err instanceof Error ? err.message : String(err));
}

interface PendingRequest {
  method: string;
  resolve: (result: unknown) => void;
  reject: (err: McpProtocolError) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * The live stdio client. Constructed by `connectMcpServer`; not exported so the
 * gate cannot be bypassed by building one directly.
 */
class StdioMcpClient implements McpClient {
  private readonly child: ChildProcess;
  private readonly stdin: Writable;
  private readonly timeoutMs: number;
  private readonly maxFrameBytes: number;
  private readonly pending = new Map<number, PendingRequest>();
  private nextId = 1;
  private stdoutBuffer = "";
  private stderrTail = "";
  private closed = false;
  /** The sticky fault: first one wins, never clears, refuses every later request. */
  private fault: McpProtocolError | null = null;
  private _protocolVersion = "";
  private _serverInfo: McpServerInfo = { name: "", version: "" };
  private _capabilities: Record<string, unknown> = {};

  constructor(child: ChildProcess, timeoutMs: number, maxFrameBytes: number) {
    this.child = child;
    this.timeoutMs = timeoutMs;
    this.maxFrameBytes = maxFrameBytes;

    const stdin = child.stdin;
    const stdout = child.stdout;
    const stderr = child.stderr;
    if (!stdin || !stdout) {
      throw new McpProtocolError("RT_E_INTERNAL", "MCP child was spawned without stdio pipes");
    }
    this.stdin = stdin;

    stdout.setEncoding("utf8");
    stdout.on("data", (chunk: string | Buffer) => this.onStdout(String(chunk)));

    if (stderr) {
      stderr.setEncoding("utf8");
      // Drained so the child can never block on a full stderr pipe; a bounded
      // tail is kept as evidence for the exit refusal.
      stderr.on("data", (chunk: string | Buffer) => {
        this.stderrTail = (this.stderrTail + String(chunk)).slice(-4096);
      });
    }

    // A stdin write error (EPIPE after the child dies) must reject, not crash.
    stdin.on("error", (err: Error) => {
      this.failAll("RT_E_RUNNER_FAILED", `MCP child stdin failed: ${err.message}`);
    });
    child.on("error", (err: Error) => {
      this.failAll("RT_E_RUNNER_FAILED", `MCP child could not be spawned: ${err.message}`);
    });
    child.on("exit", (code: number | null, signal: NodeJS.Signals | null) => {
      if (this.closed) return;
      const tail = this.stderrTail.trim();
      this.failAll(
        "RT_E_RUNNER_FAILED",
        `MCP child exited before completing (code=${code === null ? "null" : code}, signal=${signal ?? "null"})` +
          (tail ? `; stderr: ${tail}` : ""),
      );
    });
  }

  get protocolVersion(): string {
    return this._protocolVersion;
  }

  get serverInfo(): McpServerInfo {
    return this._serverInfo;
  }

  get capabilities(): Record<string, unknown> {
    return this._capabilities;
  }

  get faulted(): CodedFailure | null {
    return this.fault === null ? null : codeError(this.fault.code, this.fault.message);
  }

  private onStdout(text: string): void {
    if (this.closed || this.fault !== null) return;
    this.stdoutBuffer += text;
    if (this.stdoutBuffer.length > this.maxFrameBytes && !this.stdoutBuffer.includes("\n")) {
      this.failAll("RT_E_VALIDATION", `MCP reply exceeded the ${this.maxFrameBytes}-byte frame cap`);
      return;
    }
    let newline = this.stdoutBuffer.indexOf("\n");
    while (newline >= 0) {
      // Re-check per line: a fault raised by an earlier line in this same chunk
      // must stop the rest of the chunk from being interpreted as data.
      if (this.fault !== null) return;
      const line = this.stdoutBuffer.slice(0, newline);
      this.stdoutBuffer = this.stdoutBuffer.slice(newline + 1);
      if (line.length > this.maxFrameBytes) {
        this.failAll("RT_E_VALIDATION", `MCP reply exceeded the ${this.maxFrameBytes}-byte frame cap`);
        return;
      }
      if (line.trim().length > 0) this.onLine(line);
      newline = this.stdoutBuffer.indexOf("\n");
    }
    if (this.stdoutBuffer.length > this.maxFrameBytes) {
      this.failAll("RT_E_VALIDATION", `MCP reply exceeded the ${this.maxFrameBytes}-byte frame cap`);
    }
  }

  private onLine(line: string): void {
    if (this.fault !== null) return;
    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch (err) {
      this.failAll("RT_E_VALIDATION", `MCP reply was not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    if (typeof message !== "object" || message === null) {
      this.failAll("RT_E_VALIDATION", "MCP reply was not a JSON-RPC object");
      return;
    }
    const obj = message as Record<string, unknown>;
    // A server notification carries no id — the handshake only requires US to
    // send `notifications/initialized`; nothing else is owed a reply.
    if (!("id" in obj)) return;
    const id = obj.id;
    // An id we are not waiting on is a protocol violation: either the server
    // invented one, or (the duplicate case) it re-sent an id whose reply already
    // resolved. Either way this is sticky — see `failAll`.
    if (typeof id !== "number" || !this.pending.has(id)) {
      this.failAll("RT_E_VALIDATION", `MCP reply carried an unknown id (${JSON.stringify(id)}); no request to correlate it to`);
      return;
    }
    const pending = this.pending.get(id);
    if (!pending) return; // unreachable given the has() check; keeps the type honest
    this.pending.delete(id);
    clearTimeout(pending.timer);

    if (obj.error !== undefined && obj.error !== null) {
      const error = obj.error as Record<string, unknown>;
      const code = typeof error.code === "number" || typeof error.code === "string" ? String(error.code) : "?";
      const text = typeof error.message === "string" ? error.message : JSON.stringify(error);
      pending.reject(new McpProtocolError("RT_E_RUNNER_FAILED", `MCP server refused ${pending.method}: JSON-RPC error ${code}: ${text}`));
      return;
    }
    if (!("result" in obj)) {
      pending.reject(new McpProtocolError("RT_E_VALIDATION", `MCP reply for ${pending.method} carried neither result nor error`));
      return;
    }
    pending.resolve(obj.result);
  }

  /**
   * Record the sticky fault (first one wins) and reject every in-flight
   * request; idempotent. Only requests still pending are rejected HERE — a
   * request that already resolved is not, because its reply's bytes preceded
   * the violation. The fault covers that gap: `request` refuses every later
   * call with this same violation, and `faulted` exposes it.
   */
  private failAll(code: ErrorCode, message: string): void {
    if (this.closed) return;
    const err = new McpProtocolError(code, message);
    if (this.fault === null) this.fault = err;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.pending.clear();
    void this.close();
  }

  private request(method: string, params: Record<string, unknown>): Promise<unknown> {
    // A fault is sticky: refuse with the ORIGINAL violation, never a fresh or
    // partial result, and never a generic "closed" message that hides it.
    if (this.fault !== null) return Promise.reject(this.fault);
    if (this.closed) {
      return Promise.reject(new McpProtocolError("RT_E_RUNNER_FAILED", "MCP client is closed"));
    }
    const id = this.nextId++;
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, {
        method,
        resolve,
        reject,
        timer: setTimeout(() => {
          if (!this.pending.has(id)) return;
          this.failAll("RT_E_RUNNER_FAILED", `MCP ${method} timed out after ${this.timeoutMs}ms`);
        }, this.timeoutMs),
      });
      const frame = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
      try {
        this.stdin.write(frame);
      } catch (err) {
        const pending = this.pending.get(id);
        if (pending) {
          clearTimeout(pending.timer);
          this.pending.delete(id);
          pending.reject(
            new McpProtocolError("RT_E_RUNNER_FAILED", `MCP ${method} write failed: ${err instanceof Error ? err.message : String(err)}`),
          );
        }
      }
    });
  }

  private sendNotification(method: string): void {
    const frame = JSON.stringify({ jsonrpc: "2.0", method }) + "\n";
    this.stdin.write(frame);
  }

  async initialize(clientInfo?: McpServerInfo): Promise<McpConnectResult> {
    try {
      const result = await this.request("initialize", {
        protocolVersion: MCP_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: clientInfo ?? { name: "rapidtool", version: "0.1.0" },
      });
      if (typeof result !== "object" || result === null) {
        throw new McpProtocolError("RT_E_VALIDATION", "initialize result was not an object");
      }
      const r = result as { protocolVersion?: unknown; serverInfo?: unknown; capabilities?: unknown };
      if (typeof r.protocolVersion !== "string" || r.protocolVersion.length === 0) {
        throw new McpProtocolError("RT_E_VALIDATION", "initialize result had no protocolVersion");
      }
      const info = r.serverInfo as { name?: unknown; version?: unknown } | null | undefined;
      if (
        typeof info !== "object" ||
        info === null ||
        typeof info.name !== "string" ||
        typeof info.version !== "string"
      ) {
        throw new McpProtocolError("RT_E_VALIDATION", "initialize result had no serverInfo{name,version}");
      }
      this._protocolVersion = r.protocolVersion;
      this._serverInfo = { name: info.name, version: info.version };
      this._capabilities =
        typeof r.capabilities === "object" && r.capabilities !== null
          ? (r.capabilities as Record<string, unknown>)
          : {};
      // Required by the spec only AFTER the initialize result is received.
      this.sendNotification("notifications/initialized");
      return {
        ok: true,
        client: this,
        protocolVersion: this._protocolVersion,
        serverInfo: this._serverInfo,
        capabilities: this._capabilities,
      };
    } catch (err) {
      return toFailure(err);
    }
  }

  async listTools(): Promise<McpListToolsResult> {
    try {
      const result = await this.request("tools/list", {});
      if (typeof result !== "object" || result === null) {
        throw new McpProtocolError("RT_E_VALIDATION", "tools/list result was not an object");
      }
      const tools = (result as { tools?: unknown }).tools;
      if (!Array.isArray(tools)) {
        throw new McpProtocolError("RT_E_VALIDATION", "tools/list result had no tools array");
      }
      return { ok: true, tools: tools.map(parseTool) };
    } catch (err) {
      return toFailure(err);
    }
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<McpCallToolResult> {
    try {
      if (typeof name !== "string" || name.length === 0) {
        throw new McpProtocolError("RT_E_VALIDATION", "tools/call requires a non-empty tool name");
      }
      // Re-list at call time: the "listed + read-only" guarantee is checked
      // against what the server actually advertised, never a fabricated cache.
      const listed = await this.listTools();
      if (!listed.ok) return listed;
      const tool = listed.tools.find((t) => t.name === name);
      if (!tool) {
        const known = listed.tools.map((t) => t.name).join(", ") || "none";
        return codeError(
          "RT_E_VALIDATION",
          `MCP server did not list a tool named "${name}" — refusing to invent one (listed: ${known})`,
        );
      }
      if (!tool.readOnly) {
        return codeError(
          "RT_E_VALIDATION",
          `MCP tool "${name}" was not advertised read-only (annotations.readOnlyHint !== true) — refusing it in the read-only round-trip`,
        );
      }
      const result = await this.request("tools/call", { name, arguments: args });
      if (typeof result !== "object" || result === null) {
        throw new McpProtocolError("RT_E_VALIDATION", "tools/call result was not an object");
      }
      const r = result as { content?: unknown; isError?: unknown };
      if (!Array.isArray(r.content)) {
        throw new McpProtocolError("RT_E_VALIDATION", "tools/call result had no content array");
      }
      const content = r.content.map((block) => {
        if (typeof block !== "object" || block === null) {
          throw new McpProtocolError("RT_E_VALIDATION", "tools/call content entry was not an object");
        }
        if (typeof (block as { type?: unknown }).type !== "string") {
          throw new McpProtocolError("RT_E_VALIDATION", "tools/call content entry had no string type");
        }
        return block as McpContentBlock;
      });
      return { ok: true, tool: name, isError: r.isError === true, content };
    } catch (err) {
      return toFailure(err);
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(new McpProtocolError("RT_E_RUNNER_FAILED", "MCP client closed before the reply arrived"));
    }
    this.pending.clear();
    try {
      this.stdin.end();
    } catch {
      // Already ended/destroyed — nothing left to close on the write side.
    }
    await new Promise<void>((resolve) => {
      if (this.child.exitCode !== null || this.child.signalCode !== null) {
        resolve();
        return;
      }
      const timer = setTimeout(() => {
        try {
          this.child.kill();
        } catch {
          // Already gone — the grace window elapsed on a dead child.
        }
        resolve();
      }, MCP_CLOSE_GRACE_MS);
      this.child.once("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

/** Parse one `tools/list` entry; a shape violation is a coded refusal. */
function parseTool(entry: unknown): McpToolInfo {
  if (typeof entry !== "object" || entry === null) {
    throw new McpProtocolError("RT_E_VALIDATION", "tools/list entry was not an object");
  }
  const tool = entry as { name?: unknown; description?: unknown; annotations?: unknown };
  if (typeof tool.name !== "string" || tool.name.length === 0) {
    throw new McpProtocolError("RT_E_VALIDATION", "tools/list entry had no string name");
  }
  const annotations =
    typeof tool.annotations === "object" && tool.annotations !== null
      ? (tool.annotations as { readOnlyHint?: unknown })
      : null;
  return {
    name: tool.name,
    description: typeof tool.description === "string" ? tool.description : null,
    readOnly: annotations?.readOnlyHint === true,
  };
}

/**
 * Gate + spawn + handshake. Returns the live client only after `initialize`
 * and `notifications/initialized` completed; on any failure it closes the child
 * and returns the coded refusal. When disabled, nothing is spawned at all.
 */
export async function connectMcpServer(
  config: McpServerConfig,
  options: McpConnectOptions = {},
): Promise<McpConnectResult> {
  if (!mcpEnabled(options.env ?? process.env)) return mcpDisabledRefusal();
  if (!config || typeof config.command !== "string" || config.command.trim().length === 0) {
    return codeError("RT_E_VALIDATION", "MCP server config needs a non-empty `command` to spawn");
  }
  const timeoutMs = options.timeoutMs ?? MCP_DEFAULT_TIMEOUT_MS;
  const maxFrameBytes = options.maxFrameBytes ?? MCP_DEFAULT_MAX_FRAME_BYTES;

  let client: StdioMcpClient;
  try {
    const { spawn } = await import("node:child_process");
    // Reuse the runner's scrubbed allowlist (node-runner.server.ts:190) so the
    // MCP child never inherits API keys or other ambient secrets.
    const { scrubbedEnv } = await import("./node-runner.server.ts");
    const child = spawn(config.command, config.args ?? [], {
      cwd: config.cwd,
      env: scrubbedEnv(),
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    client = new StdioMcpClient(child, timeoutMs, maxFrameBytes);
  } catch (err) {
    return toFailure(err);
  }

  const init = await client.initialize(options.clientInfo);
  if (!init.ok) {
    await client.close();
    return init;
  }
  return init;
}

/**
 * The F1 deliverable round-trip: connect, call ONE listed read-only tool, close.
 * A tool-level `isError:true` result is surfaced as a coded failure — the seam
 * never reports a failed tool call as a pass.
 */
export async function runReadOnlyToolRoundTrip(
  config: McpServerConfig,
  request: { tool: string; args?: Record<string, unknown> },
  options: McpConnectOptions = {},
): Promise<McpRoundTripResult> {
  const connected = await connectMcpServer(config, options);
  if (!connected.ok) return connected;
  try {
    const call = await connected.client.callTool(request.tool, request.args);
    if (!call.ok) return call;
    if (call.isError) {
      const text = call.content
        .map((block) => block.text ?? "")
        .join(" ")
        .trim();
      return codeError(
        "RT_E_RUNNER_FAILED",
        `MCP tool "${request.tool}" returned isError:true${text ? `: ${text}` : ""}`,
      );
    }
    return {
      ok: true,
      protocolVersion: connected.protocolVersion,
      serverInfo: connected.serverInfo,
      tool: request.tool,
      content: call.content,
    };
  } finally {
    await connected.client.close();
  }
}

// ---------------------------------------------------------------------------
// F1 consumer wiring (342-5) — the env-configured server + the honest surface
// the `doctor` verb reports. Enablement stays an explicit owner decision: the
// default is OFF, and a disabled host spawns nothing and lists nothing.
// ---------------------------------------------------------------------------

/** Env var naming the MCP server executable to spawn (`node`, `npx`, …). */
export const MCP_SERVER_ENV = "RAPIDTOOL_MCP_SERVER";

/** Env var carrying the server args: a JSON string array (unambiguous) or a
 *  whitespace-separated list. Omitted ⇒ no args. */
export const MCP_ARGS_ENV = "RAPIDTOOL_MCP_ARGS";

/** Env var naming the child's working directory (optional). */
export const MCP_CWD_ENV = "RAPIDTOOL_MCP_CWD";

export type McpServerConfigResolution =
  | { ok: true; configured: false }
  | { ok: true; configured: true; config: McpServerConfig }
  | CodedFailure;

/** Parse the args env value. A JSON array is exact; a bare value is split on
 *  whitespace (documented). A malformed JSON value is a coded refusal — never a
 *  silent drop that would spawn the server with the wrong argv. */
function parseMcpArgs(raw: string): { ok: true; args: string[] } | CodedFailure {
  const text = raw.trim();
  if (text.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      return codeError(
        "RT_E_VALIDATION",
        `${MCP_ARGS_ENV} is not valid JSON (${err instanceof Error ? err.message : String(err)}) — pass a JSON string array or omit it.`,
      );
    }
    if (!Array.isArray(parsed) || parsed.some((a) => typeof a !== "string")) {
      return codeError(
        "RT_E_VALIDATION",
        `${MCP_ARGS_ENV} must be a JSON array of strings — got ${JSON.stringify(parsed)}.`,
      );
    }
    return { ok: true, args: parsed as string[] };
  }
  return { ok: true, args: text.split(/\s+/).filter((a) => a.length > 0) };
}

/** Resolve the MCP server purely from env. Blank/unset `RAPIDTOOL_MCP_SERVER`
 *  ⇒ `configured:false` — an unconfigured host is the default, NOT an error.
 *  A malformed args value is a coded refusal, never a silent drop. */
export function resolveMcpServerConfig(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): McpServerConfigResolution {
  const rawCommand = env?.[MCP_SERVER_ENV];
  if (typeof rawCommand !== "string" || !rawCommand.trim()) return { ok: true, configured: false };
  const command = rawCommand.trim();
  let args: string[] = [];
  const rawArgs = env?.[MCP_ARGS_ENV];
  if (typeof rawArgs === "string" && rawArgs.trim()) {
    const parsed = parseMcpArgs(rawArgs);
    if (!parsed.ok) return parsed;
    args = parsed.args;
  }
  const rawCwd = env?.[MCP_CWD_ENV];
  const cwd = typeof rawCwd === "string" && rawCwd.trim() ? rawCwd.trim() : undefined;
  return { ok: true, configured: true, config: { command, args, ...(cwd ? { cwd } : {}) } };
}

/** The honest result of one `tools/list` (and optional read-only call) against
 *  the configured server. `tools` is the REAL list the server returned — it is
 *  `null` whenever nothing was listed, so a consumer can never read a fabricated
 *  list. `spawnAttempted` is true only when `connectMcpServer` was invoked. */
export type McpToolsSurface = {
  /** The enablement switch's env var name (never its value). */
  envVar: string;
  enabled: boolean;
  /** True when a server command is configured (env or an override). */
  configured: boolean;
  /** True only when this call handed the config to `connectMcpServer`. */
  spawnAttempted: boolean;
  serverInfo: McpServerInfo | null;
  protocolVersion: string | null;
  /** The server's own `tools/list` result, or null (never fabricated). */
  tools: McpToolInfo[] | null;
  /** The read-only round-trip result when a call was requested, else null. */
  call: { tool: string; isError: boolean; content: McpContentBlock[] } | null;
  /** The coded refusal when not listed/called; null on success. */
  refusal: CodedFailure | null;
  /** One-line rendering for CLI/doctor surfaces (`mcp: …`). */
  line: string;
};

export type McpToolsSurfaceOptions = {
  /** Environment inspected for the gate + the configured server. */
  env?: NodeJS.ProcessEnv;
  /** Programmatic server override (the CLI's flags). When set, the
   *  env-configured server is ignored. */
  server?: McpServerConfig;
  /** Optional read-only tool call to perform on the connected client. */
  call?: { tool: string; args?: Record<string, unknown> };
  timeoutMs?: number;
};

function mcpSurfaceRefusalLine(code: ErrorCode, error: string): string {
  const short = error.length > 140 ? `${error.slice(0, 140)}…` : error;
  return `mcp: ${code} — ${short}`;
}

/** Gate + configure + spawn + `tools/list` (+ optional read-only call), then
 *  close. This is the ONE consumer surface: the `doctor` verb reports it. When
 *  disabled it returns `RT_E_MCP_DISABLED` with `spawnAttempted:false` and
 *  `tools:null` — no child, no fabricated list. */
export async function mcpToolsSurface(options: McpToolsSurfaceOptions = {}): Promise<McpToolsSurface> {
  const env = options.env ?? process.env;
  const enabled = mcpEnabled(env);

  let configured = false;
  let config: McpServerConfig | null = null;
  if (options.server) {
    configured = typeof options.server.command === "string" && options.server.command.trim().length > 0;
    if (!configured) {
      const refusal = codeError(
        "RT_E_VALIDATION",
        "the MCP server override needs a non-empty `command` to spawn",
      );
      return {
        envVar: MCP_ENABLE_ENV,
        enabled,
        configured: false,
        spawnAttempted: false,
        serverInfo: null,
        protocolVersion: null,
        tools: null,
        call: null,
        refusal,
        line: mcpSurfaceRefusalLine(refusal.code, refusal.error),
      };
    }
    config = options.server;
  } else {
    const resolved = resolveMcpServerConfig(env);
    if (!resolved.ok) {
      return {
        envVar: MCP_ENABLE_ENV,
        enabled,
        configured: false,
        spawnAttempted: false,
        serverInfo: null,
        protocolVersion: null,
        tools: null,
        call: null,
        refusal: resolved,
        line: mcpSurfaceRefusalLine(resolved.code, resolved.error),
      };
    }
    configured = resolved.configured;
    config = resolved.configured ? resolved.config : null;
  }

  const base = {
    envVar: MCP_ENABLE_ENV,
    enabled,
    configured,
    spawnAttempted: false,
    serverInfo: null,
    protocolVersion: null,
    tools: null,
    call: null,
  } as const;

  // The gate is checked FIRST: a disabled host never spawns, even when a server
  // is configured.
  if (!enabled) {
    const refusal = mcpDisabledRefusal();
    return { ...base, refusal, line: `mcp: disabled (${MCP_ENABLE_ENV} unset/false) — 0 child spawned, no tool list fabricated` };
  }
  if (!config) {
    const refusal = codeError(
      "RT_E_VALIDATION",
      `MCP is enabled (${MCP_ENABLE_ENV}) but no server is configured — set ${MCP_SERVER_ENV} (and ${MCP_ARGS_ENV} if needed) to spawn one.`,
    );
    return { ...base, refusal, line: mcpSurfaceRefusalLine(refusal.code, refusal.error) };
  }

  const connected = await connectMcpServer(config, { env, timeoutMs: options.timeoutMs });
  if (!connected.ok) {
    return {
      envVar: MCP_ENABLE_ENV,
      enabled,
      configured,
      spawnAttempted: true,
      serverInfo: null,
      protocolVersion: null,
      tools: null,
      call: null,
      refusal: connected,
      line: mcpSurfaceRefusalLine(connected.code, connected.error),
    };
  }

  try {
    const listed = await connected.client.listTools();
    if (!listed.ok) {
      return {
        envVar: MCP_ENABLE_ENV,
        enabled,
        configured,
        spawnAttempted: true,
        serverInfo: connected.serverInfo,
        protocolVersion: connected.protocolVersion,
        tools: null,
        call: null,
        refusal: listed,
        line: mcpSurfaceRefusalLine(listed.code, listed.error),
      };
    }
    let callResult: McpToolsSurface["call"] = null;
    if (options.call) {
      const called = await connected.client.callTool(options.call.tool, options.call.args);
      if (!called.ok) {
        return {
          envVar: MCP_ENABLE_ENV,
          enabled,
          configured,
          spawnAttempted: true,
          serverInfo: connected.serverInfo,
          protocolVersion: connected.protocolVersion,
          tools: listed.tools,
          call: null,
          refusal: called,
          line: mcpSurfaceRefusalLine(called.code, called.error),
        };
      }
      if (called.isError) {
        const text = called.content.map((b) => b.text ?? "").join(" ").trim();
        const refusal = codeError(
          "RT_E_RUNNER_FAILED",
          `MCP tool "${options.call.tool}" returned isError:true${text ? `: ${text}` : ""}`,
        );
        return {
          envVar: MCP_ENABLE_ENV,
          enabled,
          configured,
          spawnAttempted: true,
          serverInfo: connected.serverInfo,
          protocolVersion: connected.protocolVersion,
          tools: listed.tools,
          call: null,
          refusal,
          line: mcpSurfaceRefusalLine(refusal.code, refusal.error),
        };
      }
      callResult = { tool: called.tool, isError: called.isError, content: called.content };
    }
    // The sticky fault poisons every later request; a single-call consumer must
    // treat a non-null `faulted` as fatal even if its own reply resolved first.
    const fault = connected.client.faulted;
    if (fault) {
      return {
        envVar: MCP_ENABLE_ENV,
        enabled,
        configured,
        spawnAttempted: true,
        serverInfo: connected.serverInfo,
        protocolVersion: connected.protocolVersion,
        tools: listed.tools,
        call: callResult,
        refusal: fault,
        line: mcpSurfaceRefusalLine(fault.code, fault.error),
      };
    }
    const callSegment = callResult ? `; called read-only "${callResult.tool}"` : "";
    return {
      envVar: MCP_ENABLE_ENV,
      enabled,
      configured,
      spawnAttempted: true,
      serverInfo: connected.serverInfo,
      protocolVersion: connected.protocolVersion,
      tools: listed.tools,
      call: callResult,
      refusal: null,
      line: `mcp: enabled — ${listed.tools.length} tool(s) listed from ${connected.serverInfo.name} ${connected.serverInfo.version}${callSegment}`,
    };
  } finally {
    await connected.client.close();
  }
}
