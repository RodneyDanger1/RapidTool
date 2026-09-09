/**
 * RapidTool Copilot — grounded chat core (server-only).
 *
 * The copilot SEES the whole project through a deterministic compaction
 * (`buildChatContext`, ≤ CHAT_CONTEXT_MAX_CHARS) and answers ONLY from it.
 * `chatOnceServer` calls DeepSeek FLASH with thinking disabled (the flash-tier
 * default in deepseek.server.ts) and mirrors that module's honesty contract:
 * no key → `{ ok: false, reason: "not-configured" }`; any failure carries a
 * machine-readable `code` from errors.ts. The client-facing wrapper lives in
 * `./chat.ts`; this module must never be imported from client code.
 */

import { completeDeepSeek, isDeepSeekConfigured, cutMarked } from "./deepseek.server.ts";
import { PHASES } from "./phases.ts";
import type { ErrorCode } from "./errors.ts";
import type { PhaseRecord, Project } from "./types.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** One prior chat turn (role + text). `provenance` is the caller's recorded
 *  grounded-context stamp of an assistant turn (24 FC-3) — the server parses
 *  its `v<N>` version so speech grounded in an OLDER build context is tagged
 *  stale instead of being replayed as current fact (C1). */
export type ChatTurn = {
  role: "user" | "assistant";
  text: string;
  provenance?: string;
};

/** Honest copilot result: grounded reply, or a typed not-configured/error failure.
 *  Every failure branch carries a machine-readable `code` (compile-enforced —
 *  fixes/102 §RT_E): no code path can surface an uncatalogued copilot failure. */
export type ChatResult =
  | { ok: true; reply: string; grounded: true; provenance: string }
  | {
      ok: false;
      reason: "not-configured" | "error";
      error?: string;
      /** Machine-readable failure class (errors.ts) — ALWAYS present on failure. */
      code: ErrorCode;
    };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Hard cap for the grounded context block (characters). */
export const CHAT_CONTEXT_MAX_CHARS = 2500;

/** History is capped to the last N turns before the current message. */
export const CHAT_HISTORY_LIMIT = 6;

/** Per-history-turn character cap (each turn is cut with a marked tail). */
export const CHAT_HISTORY_TURN_MAX_CHARS = 800;

/** Current-message character cap (the user's text is cut with a marked tail). */
export const CHAT_USER_TEXT_MAX_CHARS = 4000;

/** C1 — stale-history prefix: assistant turns whose provenance stamp shows a
 *  context version OLDER than the current snapshot are replayed with this
 *  prefix, so the model can discount claims a state change superseded
 *  (reject→retry, memory rewrite, phase re-run) — mirrors F3's `(stale)` flag. */
export const STALE_TURN_PREFIX = (v: number): string =>
  `[earlier build state v${v} — may be stale] `;

/** Parse the `v<N>` context version out of a provenance stamp; null when the
 *  stamp is missing or unparseable (unverifiable rows pass through untouched). */
export function provenanceVersion(provenance: string | undefined | null): number | null {
  if (typeof provenance !== "string") return null;
  const m = /v(\d+)/.exec(provenance);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isInteger(v) && v >= 0 ? v : null;
}

/**
 * System prompt: answer ONLY from the grounded context, admit when asked
 * something outside it, and suggest next legal actions by concrete phase id.
 * Rules 4-5 are the action-honesty floor (fixes/156 E2): this chat is a
 * READ-ONLY advisory surface — it never performs or implies actions. The
 * engine's run/approve/reject transitions happen only through the console
 * controls or the CLI, so the model must say exactly that instead of letting
 * a request like "approve the gate" read as something the chat did.
 */
export const COPILOT_SYSTEM_PROMPT = [
  "You are RapidTool Copilot, the AI assistant for exactly one RapidTool project.",
  "Below the marker is the complete grounded context for that project — the only facts you know about it.",
  "Rules:",
  "1. Answer ONLY from the grounded context. Never invent project facts, artifacts, memory rows, scores, gates, verdicts, or history that the context does not show.",
  "2. If the user asks something outside the context (other projects, external tools, world knowledge), say you cannot answer from the grounded context and restate what the context DOES contain.",
  "3. When suggesting next actions, name the concrete phase id (P0..P12) and respect its status: locked phases cannot run, awaiting_hitl phases need a human decision, rejected phases need a retry.",
  "4. You are advisory-only: this chat never runs phases, approves or rejects gates, edits the project, or triggers any action. If the user asks you to do something (run or execute a phase, approve, reject, retry, edit, export), say this chat cannot perform actions and name the control that can: the console Run/Approve/Reject controls or the rapidtool CLI verbs.",
  "5. Never imply that an action was taken or that project state changed. If the context shows no evidence of a change, say the build is unchanged and what WOULD change it.",
  "6. Be concise (2-4 sentences unless asked for detail). No markdown headers, no code blocks unless the user asks for code.",
  "--- GROUNDED CONTEXT ---",
].join("\n");

// ---------------------------------------------------------------------------
// Grounded context builder (deterministic)
// ---------------------------------------------------------------------------

/** Collapse whitespace and truncate to a single line (deterministic). */
function clip(s: string | undefined | null, max: number): string {
  const t = (typeof s === "string" ? s : "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

type GatedRecord = PhaseRecord & { gate: NonNullable<PhaseRecord["gate"]> };

/**
 * Deterministic ≤2500-char compaction of the whole project: name/domain/kind/
 * currentPhase/status, per-phase statuses, last gate verdict + unmet gates,
 * packet one-liner, memory count + top 3 rows, research corpus count,
 * lastTest verdict, and the open HITL prompt. Same input → same string:
 * field order is fixed and every sort has a total tiebreak.
 */
export function buildChatContext(project: Project): string {
  // Null/partial projects (hostile server-fn payloads) must never throw:
  // coerce to an empty shell — every access below is then field-safe.
  const p: Project = (project ?? {}) as Project;
  const name = clip(p?.name, 80) || "unnamed";
  const domain = clip(p?.domain, 60) || "unspecified";
  // Every field below is clip()-bounded (fixes/156 E2): the final slice is a
  // belt-and-braces guard, NOT the truncation policy — a hostile oversized
  // kind/status/phase-status must never eat the context TAIL, because the
  // tail ends with the current HITL line (the human's open instruction) and
  // lastTest. Bounded fields keep the joined context ≤ ~2.3k chars, so the
  // instruction-critical lines always survive.
  const kind = clip(p?.kind, 40) || "unspecified";

  const phases = [...(Array.isArray(p.phases) ? p.phases : [])].sort((a, b) => a.id - b.id);
  const phaseLine = clip(
    phases.map((r) => `P${r.id}:${clip(r.status, 16) || "?"}`).join(" "),
    360,
  ) || "none";

  const current = PHASES.find((pd) => pd.id === p.currentPhase) ?? null;
  const currentLine = clip(
    current
      ? `${current.code} ${current.title}`
      : `P${String(p.currentPhase)} (unknown)`,
    60,
  ) || "unknown";

  // Last gate verdict: highest checkedAt wins; ties break to the higher phase id.
  const gated = phases.filter((r): r is GatedRecord => Boolean(r.gate));
  let gateLine = "none";
  // F4 — current-edge honesty: while the CURRENT phase's gate is open
  // (awaiting_hitl) or the current phase was just rejected, no verdict exists
  // for it yet — reporting an older phase's PASS/FAIL would read the open edge
  // as decided. Say "no verdict yet" instead of replaying the historical record.
  const hitlRec =
    p.hitl && typeof p.hitl.phase === "number"
      ? phases.find((r) => r.id === p.hitl!.phase)
      : undefined;
  const curRec = phases.find((r) => Number(r.id) === Number(p.currentPhase));
  if (hitlRec && hitlRec.status === "awaiting_hitl" && !hitlRec.gate) {
    gateLine = `P${hitlRec.id} no verdict yet (HITL open — pending)`;
  } else if (curRec && curRec.status === "rejected" && !curRec.gate) {
    gateLine = `P${curRec.id} no verdict yet (rejected at HITL)`;
  } else if (gated.length > 0) {
    const last = gated.sort(
      (a, b) =>
        (Number(b.gate.checkedAt) || 0) - (Number(a.gate.checkedAt) || 0) ||
        (Number(b.id) || 0) - (Number(a.id) || 0),
    )[0];
    const unmet = Array.isArray(last.gate.unmet) ? last.gate.unmet : [];
    gateLine = `P${last.id} ${last.gate.passed ? "PASS" : "FAIL"}${
      unmet.length > 0 ? ` unmet: ${unmet.join(", ")}` : ""
    }`;
  }
  gateLine = clip(gateLine, 220);

  const packetLine = clip((p.packet ?? "").split(/\r?\n/, 1)[0], 140) || "none";

  // F3 — memory top-3 honesty: rows owned by a phase whose record is currently
  // `rejected` are stale by construction (its historical attempt rows and
  // score-1.0 rejection notes predate any retry). Prefer live rows — score
  // desc, then id asc (total tiebreak) — and demote stale rows to the tail.
  // When a stale row must be shown (fewer than 3 live rows) it is flagged
  // `(stale)` so the model can tell historical notes from current fact.
  const rejectedPhaseIds = new Set<number>(
    phases.filter((r) => r.status === "rejected").map((r) => Number(r.id) || 0),
  );
  const isStaleRow = (m: { phase?: unknown } | null | undefined): boolean =>
    typeof m?.phase === "number" && rejectedPhaseIds.has(m.phase as number);
  const memory = [...(Array.isArray(p.memory) ? p.memory : [])].sort(
    (a, b) =>
      (isStaleRow(a) ? 1 : 0) - (isStaleRow(b) ? 1 : 0) ||
      (Number(b.score) || 0) - (Number(a.score) || 0) ||
      (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
  const top3 = memory
    .slice(0, 3)
    .map((m, i) => `${i + 1}) ${clip(m.text, 60)}${isStaleRow(m) ? " (stale)" : ""}`)
    .join(" ");
  const memoryLine = `${memory.length} rows | top: ${top3 || "none"}`;
  // Which phases are currently rejected — the model needs this to read the
  // `(stale)` flags and the phase statuses above (only emitted when non-empty;
  // clip keeps a hostile many-phase payload from ballooning the line).
  const rejectedLine =
    rejectedPhaseIds.size > 0
      ? clip(
          `rejected: ${[...rejectedPhaseIds].sort((x, y) => x - y).map((id) => `P${id}`).join(" ")}`,
          240,
        )
      : null;

  const researchLine = String((Array.isArray(p.research) ? p.research : []).length);

  let testLine = "none";
  const lastTest = p.lastTest;
  if (lastTest) {
    testLine = `ok=${String(lastTest.ok)} label=${clip(lastTest.label, 24) || "none"}: ${clip(lastTest.detail, 120) || "no detail"}`;
  }

  let hitlLine = "none";
  if (p.hitl) {
    hitlLine = `P${p.hitl.phase} "${clip(p.hitl.title, 60) || "gate"}": ${clip(p.hitl.prompt, 140) || "no prompt"}${
      p.hitl.forceHuman ? " [forceHuman]" : ""
    }`;
  }

  const parts = [
    "RAPIDTOOL COPILOT CONTEXT",
    `project: ${name}`,
    `domain: ${domain}`,
    `kind: ${kind}`,
    `status: ${clip(p.status, 24) || "unknown"}`,
    `currentPhase: ${currentLine}`,
    `phases: ${phaseLine}`,
    ...(rejectedLine ? [rejectedLine] : []),
    `lastGate: ${gateLine}`,
    `packet: ${packetLine}`,
    `memory: ${memoryLine}`,
    `researchEntries: ${researchLine}`,
    `lastTest: ${testLine}`,
    `hitl: ${hitlLine}`,
  ];
  return parts.join("\n").slice(0, CHAT_CONTEXT_MAX_CHARS);
}

// ---------------------------------------------------------------------------
// Reply provenance (24 FC-3): a small, honest "Grounded in" stamp per reply.
// ---------------------------------------------------------------------------

/**
 * Short stable numeric version id of a context string (FNV-1a → 6 digits).
 * Same context → same version; any state change re-keys the reply.
 */
export function chatContextVersion(context: string): number {
  let h = 2166136261;
  for (let i = 0; i < context.length; i++) {
    h ^= context.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1_000_000;
}

/**
 * Human provenance stamp for a grounded reply: which context version the
 * reply was grounded in, as of which phase and when (UTC).
 */
export function chatProvenance(
  project: Project,
  context: string,
  now: Date = new Date(),
): string {
  const phase = typeof project?.currentPhase === "number" ? project.currentPhase : "?";
  const ts = now.toISOString().slice(0, 19).replace("T", " ");
  return `Grounded in build context v${chatContextVersion(context)} as of P${phase}/${ts}Z`;
}

// ---------------------------------------------------------------------------
// Grounded chat (server-only entry)
// ---------------------------------------------------------------------------

/**
 * One grounded copilot turn. Never fabricates: without a DeepSeek key it
 * returns the honest not-configured shape before any network work; failures
 * carry a machine-readable `code`.
 *
 * @param project  Full project state — the copilot's only source of facts.
 * @param userText The user's message.
 * @param history  Prior turns (optional), capped to the last CHAT_HISTORY_LIMIT.
 */
export async function chatOnceServer(
  project: Project,
  userText: string,
  history?: ChatTurn[],
  /** Injectable clock — the provenance stamp records the CONTEXT SNAPSHOT
   *  time (when buildChatContext ran), NOT reply-assembly time: a slow
   *  round-trip must not overstate how fresh the grounded state was (C2). */
  now: () => Date = () => new Date(),
): Promise<ChatResult> {
  if (!isDeepSeekConfigured()) {
    return {
      ok: false,
      reason: "not-configured",
      error: "DeepSeek is not configured — add DEEPSEEK_API_KEY to use the copilot.",
      code: "RT_E_LLM_NOT_CONFIGURED",
    };
  }
  if (!project || typeof project !== "object") {
    return {
      ok: false,
      reason: "error",
      error: "Copilot needs a project to ground the reply.",
      code: "RT_E_VALIDATION",
    };
  }
  const text = (typeof userText === "string" ? userText : "").trim();
  if (!text) {
    return {
      ok: false,
      reason: "error",
      error: "Copilot message is empty.",
      code: "RT_E_VALIDATION",
    };
  }
  // Cap the current message — a huge paste must not blow the context budget.
  const userMessage = cutMarked(text, CHAT_USER_TEXT_MAX_CHARS);

  // C2: one coherent snapshot — capture the clock at context-build time and
  // stamp the reply with it (phase/version/time then describe the same state).
  const contextAt = now();
  const context = buildChatContext(project);
  const currentVersion = chatContextVersion(context);
  const turns: { role: "user" | "assistant"; content: string }[] = (
    Array.isArray(history) ? history : []
  )
    .filter(
      (t) =>
        t &&
        typeof t === "object" &&
        (t.role === "user" || t.role === "assistant") &&
        typeof t.text === "string" &&
        t.text.trim().length > 0,
    )
    .slice(-CHAT_HISTORY_LIMIT)
    .map((t) => {
      const raw = t.text.trim();
      // C1: assistant speech stamped with an OLDER context version than the
      // current snapshot is tagged (kept for conversation continuity, never
      // dropped) so the model can discount claims the new context superseded.
      let text = raw;
      if (t.role === "assistant") {
        const v = provenanceVersion(t.provenance);
        if (v !== null && v !== currentVersion) text = `${STALE_TURN_PREFIX(v)}${raw}`;
      }
      return { role: t.role, content: cutMarked(text, CHAT_HISTORY_TURN_MAX_CHARS) };
    });

  const res = await completeDeepSeek(userMessage, {
    // FLASH tier → thinking disabled + the fast 20s timeout (deepseek.server.ts).
    model: "deepseek-v4-flash",
    system: `${COPILOT_SYSTEM_PROMPT}\n\n${context}`,
    maxTokens: 768,
    history: turns,
  });

  if (res.ok) {
    return {
      ok: true,
      reply: res.text,
      grounded: true,
      provenance: chatProvenance(project, context, contextAt),
    };
  }
  return res.reason === "not-configured"
    ? { ok: false, reason: "not-configured", code: res.code ?? "RT_E_INTERNAL" }
    : {
        ok: false,
        reason: "error",
        error: res.error,
        // LlmResult documents code as always-present on provider failures; a
        // missing code here is contract drift — internal, never prose-guessed.
        code: res.code ?? "RT_E_INTERNAL",
      };
}
