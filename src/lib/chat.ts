/**
 * Client-facing RapidTool Copilot contract (grounded chat, DeepSeek).
 *
 * Import THIS module from engine/store/UI code — never import
 * `./chat.server.ts` directly. It mirrors ./llm.ts: a TanStack server
 * function wraps the server-only `chatOnceServer`, the API key is read
 * server-side only, and every failure is an honest typed result carrying a
 * machine-readable `code` (errors.ts) — so no code path can mistake an
 * unconfigured or failed backend for real copilot output.
 */

import { createServerFn } from "@tanstack/react-start";
import { classifyError } from "./errors.ts";
import type { ErrorCode } from "./errors.ts";
import type { ChatResult, ChatTurn } from "./chat.server.ts";
import type { ChatLogRow, Project } from "./types.ts";

export type { ChatLogRow };

const chatServer = createServerFn({ method: "POST" })
  .validator(
    (input: {
      project: Project;
      userText: string;
      history?: ChatTurn[];
    }) => input,
  )
  .handler(async ({ data }) => {
    const { chatOnceServer } = await import("./chat.server.ts");
    return chatOnceServer(data.project, data.userText, data.history);
  });

/**
 * Server-side grounding-context meter (DF-13 / P1-5): the exact numbers the
 * NEXT reply will be grounded in — same computation path as chatOnceServer,
 * so the meter can never drift from what the model actually sees.
 */
const chatContextServer = createServerFn({ method: "POST" })
  .validator((input: { project: Project }) => input)
  .handler(async ({ data }) => {
    const { buildChatContext, chatContextVersion, CHAT_CONTEXT_MAX_CHARS } =
      await import("./chat.server.ts");
    const context = buildChatContext(data.project);
    return {
      chars: context.length,
      max: CHAT_CONTEXT_MAX_CHARS,
      version: chatContextVersion(context),
    };
  });

/**
 * One grounded copilot turn for a project.
 *
 * Returns `{ ok: true, reply, grounded: true, provenance }` on success, or an
 * honest `{ ok: false, reason: "not-configured" | "error", code }` — never
 * invented text. `history` (optional) is capped server-side to the last 6
 * turns.
 */
export async function chatOnce(
  project: Project,
  userText: string,
  history?: ChatTurn[],
): Promise<ChatResult> {
  try {
    return await chatServer({ data: { project, userText, history } });
  } catch (err) {
    return {
      ok: false,
      reason: "error",
      error: err instanceof Error ? err.message : String(err),
      code: classifyError(err, "RT_E_INTERNAL"),
    };
  }
}

/** One visible chat row as the UI keeps it (structural — console-owned type). */
export type ChatHistoryRow = {
  role: "user" | "assistant";
  text: string;
  /** true ⇒ a failed-send display row, never real copilot speech. */
  error?: boolean;
  /** Grounded stamp of an assistant row ("Grounded in build context vN … as of
   *  P<n>/<ts>Z", 24 FC-3). Carried into the outbound history so the server can
   *  tag speech grounded in an OLDER build context as stale (C1) — the display
   *  log already carries it on successful assistant rows. */
  provenance?: string;
};

/**
 * Project visible chat rows into the outbound LLM history (F2): only real,
 * non-empty user/assistant rows travel to the model — failure rows (`error`)
 * are display-only and must never be replayed as assistant speech (a failed
 * send would otherwise read as the copilot's own words next turn). Keeps the
 * last 12 valid rows, in order. Each row's `provenance` stamp (when present)
 * rides along so the server can flag assistant rows from older build states.
 */
export function chatHistoryTurns(rows: ChatHistoryRow[]): ChatTurn[] {
  return (Array.isArray(rows) ? rows : [])
    .filter(
      (r) =>
        r &&
        !r.error &&
        (r.role === "user" || r.role === "assistant") &&
        typeof r.text === "string" &&
        r.text.trim().length > 0,
    )
    .slice(-12)
    .map((r) => ({
      role: r.role,
      text: r.text,
      ...(typeof r.provenance === "string" && r.provenance.length > 0
        ? { provenance: r.provenance }
        : {}),
    }));
}

// ---------------------------------------------------------------------------
// Grounding-context meter (DF-13 / P1-5) — client wrapper + persistence.
// ---------------------------------------------------------------------------

/**
 * Client-safe mirror of chat.server.ts `provenanceVersion`: parse the `v<N>`
 * build-context version out of a provenance stamp. chat.server.ts is a
 * server-only module (deepseek import), so the console cannot import its
 * parser — this copy lives here, tested against the same stamp shapes as the
 * server one (chat.test.ts). Returns null when the stamp is missing or
 * unparseable (an unverifiable row simply never triggers staleness notes).
 */
export function chatStampVersion(provenance: string | undefined | null): number | null {
  if (typeof provenance !== "string") return null;
  const m = /v(\d+)/.exec(provenance);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isInteger(v) && v >= 0 ? v : null;
}

/**
 * What a "Retry" affordance for a FAILED send must restore: the user text of
 * the send that produced `errorRow` — the nearest PRECEDING non-error user
 * row (sends append [userRow, errorRow], so that is the failed prompt). The
 * error row's own text is the failure message, never the question (fixes/156
 * E2 — the old console wiring copied the error message into the draft).
 * Returns null when the failed send's prompt is not recoverable from the
 * visible rows (e.g. it was trimmed out of the window) — the caller then
 * hides the affordance instead of retrying the wrong text.
 */
export function failedSendPrompt(
  rows: ChatHistoryRow[],
  errorRow: ChatHistoryRow,
): string | null {
  const list = Array.isArray(rows) ? rows : [];
  const idx = list.indexOf(errorRow);
  if (idx <= 0) return null;
  for (let i = idx - 1; i >= 0; i--) {
    const r = list[i];
    if (
      r &&
      typeof r === "object" &&
      r.role === "user" &&
      !r.error &&
      typeof r.text === "string" &&
      r.text.trim().length > 0
    ) {
      return r.text;
    }
  }
  return null;
}

/** The grounding-block numbers for the NEXT reply (what chatOnceServer will send). */
export type ChatContextInfo = { chars: number; max: number; version: number };

/**
 * Fetch the grounding-context meter for a project. Honest on transport
 * failure: `null` (the UI renders "context meter unavailable"), never a
 * fabricated number.
 */
export async function chatContextInfo(
  project: Project,
): Promise<ChatContextInfo | null> {
  try {
    const res = await chatContextServer({ data: { project } });
    if (
      res &&
      typeof res === "object" &&
      typeof (res as { chars?: unknown }).chars === "number" &&
      typeof (res as { max?: unknown }).max === "number" &&
      typeof (res as { version?: unknown }).version === "number"
    ) {
      return res as ChatContextInfo;
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// T5.1 · streaming-output NDJSON leg — W19 LANE 3, TRANSPORT SPIKE FIRST.
//
// Spike verdict (fixes/252_lane3_t51.md — S1b/S2/S3 ran on this host):
//   · Incremental NDJSON over a real byte sink is available with ZERO new
//     dependencies: node:http + `fetch(...).body.getReader()` delivered frames
//     in arrival gaps that tracked the server's write delays (235/261ms vs
//     250/500ms, spike S1b), and a real child process's stdout delivered
//     ordered frames the parent read incrementally (spike S3).
//   · The `createServerFn` transport is request/response AND is not invocable
//     outside the Start runtime — calling the existing `chatOnce` from plain
//     node resolves to the coded `RT_E_INTERNAL` "No Start context found in
//     AsyncLocalStorage" envelope (spike S2). Token streaming through the
//     existing server-fn seam is therefore NOT reachable from this lane, and
//     the provider contract stays one-shot (`stream: false`,
//     llm/providers/deepseek.ts:391).
//
// What this leg IS: ordered NDJSON frames over an explicit sink — chunk frames
// `{"seq":N,"chunk":"…"}`, then exactly ONE terminal envelope
// (`{"done":true,"ok":true,"reply","grounded","provenance"}` or a CODED
// failure `{"done":true,"ok":false,"reason","error","code"}`). The leg never
// ends silently: an abort closes it with `RT_E_ABORTED` and a dead sink
// returns a coded summary instead of throwing.
//
// Honest scope: chunks are a deterministic segmentation of the RESOLVED reply
// (the provider is one-shot today), NOT model-token streaming — reassembly is
// byte-exact (`segmentChatReply` chunks joined === the reply), pinned in
// chat.test.ts. When a token stream lands behind the same frames, this wire
// contract is unchanged. No fabrication: a failed turn streams NO chunks and
// closes with its own code and wording.
// ---------------------------------------------------------------------------

/** Max characters per streamed chunk before a segment is split further. */
export const CHAT_STREAM_CHUNK_MAX_CHARS = 512;

/** One ordered chunk frame: `{"seq":N,"chunk":"…"}`. */
export type ChatStreamChunkFrame = { seq: number; chunk: string };

/** The one terminal envelope — success carries the full result for reconciliation. */
export type ChatStreamTerminalFrame =
  | { done: true; ok: true; reply: string; grounded: true; provenance: string }
  | {
      done: true;
      ok: false;
      reason: "not-configured" | "error";
      error?: string;
      code: ErrorCode;
    };

export type ChatStreamFrame = ChatStreamChunkFrame | ChatStreamTerminalFrame;

/** The byte sink: one `\n`-terminated NDJSON line per call (`process.stdout.write`, a socket…). */
export type ChatStreamWrite = (line: string) => void | Promise<void>;

/** A real chat turn — `chatOnceServer` (the module path the server fn calls) or `chatOnce`. */
export type ChatStreamTurn = (
  project: Project,
  userText: string,
  history?: ChatTurn[],
) => Promise<ChatResult>;

export type ChatStreamSummary = {
  ok: boolean;
  /** Present whenever `ok` is false — a coded outcome, never a silent end. */
  code?: ErrorCode;
  /** Chunk frames written (0 when the turn failed or the leg aborted early). */
  chunks: number;
  /** Total frames written (a failure with a dead sink may have no terminal frame). */
  frames: number;
  aborted: boolean;
};

/** Registry-shaped code matcher used by the parser (errors.ts `RT_E_*` only). */
const STREAM_CODE_RE = /^RT_E_[A-Z0-9_]+$/;

/** One NDJSON line for a frame — single-line even when the text holds newlines. */
export function encodeChatFrame(frame: ChatStreamFrame): string {
  return `${JSON.stringify(frame)}\n`;
}

/**
 * Parse one NDJSON line into a typed frame — honest `null` for anything that is
 * not a well-formed frame (never a guess, never a coercion). A failure terminal
 * WITHOUT a registry-shaped `RT_E_*` code is rejected: the coded-terminal
 * invariant is part of the wire contract, not a convention.
 */
export function parseChatFrame(line: string): ChatStreamFrame | null {
  if (typeof line !== "string") return null;
  const raw = line.trim();
  if (raw.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const f = parsed as Record<string, unknown>;
  if (f.done === true) {
    if (typeof f.ok !== "boolean") return null;
    if (f.ok) {
      if (
        typeof f.reply !== "string" ||
        f.grounded !== true ||
        typeof f.provenance !== "string"
      ) {
        return null;
      }
      return { done: true, ok: true, reply: f.reply, grounded: true, provenance: f.provenance };
    }
    if (f.reason !== "not-configured" && f.reason !== "error") return null;
    if (typeof f.code !== "string" || !STREAM_CODE_RE.test(f.code)) return null;
    if (f.error !== undefined && typeof f.error !== "string") return null;
    return {
      done: true,
      ok: false,
      reason: f.reason,
      ...(typeof f.error === "string" ? { error: f.error } : {}),
      code: f.code as ErrorCode,
    };
  }
  if (Number.isInteger(f.seq) && (f.seq as number) >= 1 && typeof f.chunk === "string" && f.chunk.length > 0) {
    return { seq: f.seq as number, chunk: f.chunk };
  }
  return null;
}

/**
 * Split `text` at every match of `re`, keeping each separator attached to the
 * piece it terminates (so joined pieces === the original bytes).
 */
function cutOn(text: string, re: RegExp): string[] {
  const out: string[] = [];
  let start = 0;
  for (const m of text.matchAll(re)) {
    const end = m.index + m[0].length;
    out.push(text.slice(start, end));
    start = end;
  }
  if (start < text.length) out.push(text.slice(start));
  return out.filter((p) => p.length > 0);
}

/**
 * Deterministic segmentation of a resolved reply into ordered chunks:
 * blank-line paragraphs first, then single newlines, then hard splits at the
 * cap — and in every strategy each separator stays with the piece it ends, so
 * `segmentChatReply(t).join("") === t` for ANY string `t` (byte-exact
 * reassembly; pinned in chat.test.ts). Whitespace-only pieces merge into their
 * neighbour when that keeps the cap; a whitespace run that lands on a cap
 * boundary otherwise travels as its own chunk (bytes stay exact). Returns `[]`
 * for a non-string/empty reply — never a chunk that carries invented text.
 */
export function segmentChatReply(
  text: string,
  maxChars: number = CHAT_STREAM_CHUNK_MAX_CHARS,
): string[] {
  if (typeof text !== "string" || text.length === 0) return [];
  const cap =
    Number.isInteger(maxChars) && maxChars >= 1 ? maxChars : CHAT_STREAM_CHUNK_MAX_CHARS;
  const out: string[] = [];
  for (const para of cutOn(text, /\n{2,}/g)) {
    if (para.length <= cap) {
      out.push(para);
      continue;
    }
    for (const line of cutOn(para, /\n/g)) {
      if (line.length <= cap) {
        out.push(line);
        continue;
      }
      for (let i = 0; i < line.length; i += cap) out.push(line.slice(i, i + cap));
    }
  }
  const merged: string[] = [];
  for (const part of out) {
    const prev = merged[merged.length - 1];
    if (prev !== undefined && part.trim().length === 0 && prev.length + part.length <= cap) {
      merged[merged.length - 1] = prev + part;
    } else {
      merged.push(part);
    }
  }
  const head = merged[0];
  const next = merged[1];
  if (
    head !== undefined &&
    next !== undefined &&
    head.trim().length === 0 &&
    head.length + next.length <= cap
  ) {
    merged[1] = head + next;
    merged.shift();
  }
  return merged;
}

/**
 * The streaming leg: drive ONE real turn and write its ordered NDJSON frames to
 * `write` — chunk frames (`{"seq":N,"chunk":"…"}`) then exactly one terminal
 * envelope. Outcomes:
 *   · ok turn      → chunks + `{"done":true,"ok":true,…}`, summary `{ok:true}`;
 *   · failed turn  → NO chunks + the turn's own coded envelope (same code and
 *                    wording as the one-shot result — never re-worded);
 *   · abort        → no further chunks + `RT_E_ABORTED` terminal, `aborted:true`;
 *   · malformed ok:true turn (no grounded string reply) → coded `RT_E_INTERNAL`,
 *     never invented text;
 *   · thrown turn  → `classifyError` code (falls back to `RT_E_INTERNAL`);
 *   · dead sink    → stops writing, returns a coded summary (never throws).
 * The abort is a STREAM-level abort (nothing further is emitted); it does not
 * cancel an in-flight model call — that belongs to the caller's transport.
 */
export async function chatStreamNdjson(opts: {
  project: Project;
  userText: string;
  history?: ChatTurn[];
  /** The real turn — required, no hidden default (pass `chatOnce`/`chatOnceServer`). */
  turn: ChatStreamTurn;
  /** The real byte sink; each call receives one `\n`-terminated NDJSON line. */
  write: ChatStreamWrite;
  signal?: AbortSignal;
  maxChunkChars?: number;
}): Promise<ChatStreamSummary> {
  const { project, userText, history, turn, write, signal } = opts;
  let chunks = 0;
  let frames = 0;
  let sinkFailure: ErrorCode | null = null;

  /** Write one frame; a dead sink is recorded (coded) and stops the leg. */
  const emit = async (frame: ChatStreamFrame): Promise<boolean> => {
    if (sinkFailure !== null) return false;
    try {
      await write(encodeChatFrame(frame));
    } catch (err) {
      sinkFailure = classifyError(err, "RT_E_INTERNAL");
      return false;
    }
    frames += 1;
    return true;
  };

  const summary = (ok: boolean, code?: ErrorCode, aborted = false): ChatStreamSummary => ({
    ok,
    ...(code === undefined ? {} : { code }),
    chunks,
    frames,
    aborted,
  });

  const abort = async (error: string): Promise<ChatStreamSummary> => {
    await emit({ done: true, ok: false, reason: "error", error, code: "RT_E_ABORTED" });
    return summary(false, "RT_E_ABORTED", true);
  };

  if (signal?.aborted) return abort("stream aborted before the turn started — nothing was streamed");

  let result: ChatResult;
  try {
    result = await turn(project, userText, history);
  } catch (err) {
    if (signal?.aborted) {
      return abort("stream aborted while the turn was in flight — no fabricated text followed");
    }
    const code = classifyError(err, "RT_E_INTERNAL");
    await emit({
      done: true,
      ok: false,
      reason: "error",
      error: err instanceof Error ? err.message : String(err),
      code,
    });
    return summary(false, sinkFailure ?? code);
  }

  if (signal?.aborted) return abort("stream aborted before the first chunk was written");

  if (result.ok !== true || typeof result.reply !== "string" || result.grounded !== true) {
    if (result.ok === false) {
      // Failure envelopes pass through with the SAME code and wording — the
      // streamed terminal is the one-shot envelope, never a paraphrase.
      await emit({
        done: true,
        ok: false,
        reason: result.reason,
        ...(result.error !== undefined ? { error: result.error } : {}),
        code: result.code,
      });
      return summary(false, sinkFailure ?? result.code);
    }
    await emit({
      done: true,
      ok: false,
      reason: "error",
      error:
        "the turn returned ok:true without a grounded string reply — refusing to stream fabricated text",
      code: "RT_E_INTERNAL",
    });
    return summary(false, sinkFailure ?? "RT_E_INTERNAL");
  }

  for (const part of segmentChatReply(result.reply, opts.maxChunkChars)) {
    if (signal?.aborted) {
      return abort("stream aborted mid-reply — it closed here instead of stopping silently");
    }
    const wrote = await emit({ seq: chunks + 1, chunk: part });
    if (!wrote) return summary(false, sinkFailure ?? "RT_E_INTERNAL");
    chunks += 1;
  }

  const closed = await emit({
    done: true,
    ok: true,
    reply: result.reply,
    grounded: true,
    provenance: result.provenance,
  });
  if (!closed) return summary(false, sinkFailure ?? "RT_E_INTERNAL");
  return summary(true);
}

