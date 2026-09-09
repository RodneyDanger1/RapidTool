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

