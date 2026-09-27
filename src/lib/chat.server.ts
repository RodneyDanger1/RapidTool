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

import { isDeepSeekConfigured, cutMarked } from "./deepseek.server.ts";
import { callModel } from "./llm/providers/registry.ts";
import { PHASES } from "./phases.ts";
import { dualChannelFailDetail, type ErrorCode } from "./errors.ts";
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

/** Hard cap for the grounded context block (characters).
 *  fixes/186: raised 2500→3200 (≤4000) so notes + fixtures + synthesis/
 *  tree-run honesty lines fit without eating the HITL tail. */
export const CHAT_CONTEXT_MAX_CHARS = 3200;

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
 *  stamp is missing or unparseable (unverifiable rows pass through untouched).
 *  MIRROR: chat.ts `chatStampVersion` — the client-safe copy of this parser
 *  (this module is server-only); the two must stay byte-identical and
 *  chat.test.ts pins their parity. Edit BOTH when this parse ever changes. */
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
 * Deterministic ≤CHAT_CONTEXT_MAX_CHARS compaction of the whole project:
 * name/domain/kind/currentPhase/status, per-phase statuses, last gate verdict
 * + unmet gates, packet one-liner, memory count + top 3 rows, optional
 * operator notes, research corpus count, optional acceptance-fixture
 * pending/approved counts, lastTest verdict (with floor honesty), optional
 * synthesis/tree-run honesty, and the open HITL prompt. Same input → same
 * string: field order is fixed and every sort has a total tiebreak.
 * Additive fields (notes / fixtures / synthesis) are OMITTED when absent so
 * legacy projects stay byte-identical (fixes/186).
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
  // lastTest. Bounded fields keep the joined context under the cap, so the
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

  // fixes/186 + 168A-1: operator notes (standing human steering). Emit ONLY
  // when non-empty after trim — empty/absent stays byte-identical to legacy.
  const notesRaw = typeof p.notes === "string" ? p.notes.trim() : "";
  const notesLine = notesRaw ? `notes: ${clip(notesRaw, 240)}` : null;

  const researchLine = String((Array.isArray(p.research) ? p.research : []).length);

  // fixes/186: acceptanceFixtures pending/approved counts. Additive field —
  // ABSENCE on legacy payloads (never []). Emit ONLY when the array is present
  // so bare projects stay byte-identical. Pending or empty ⇒ not functional.
  let fixturesLine: string | null = null;
  if (Array.isArray(p.acceptanceFixtures)) {
    let approved = 0;
    let pending = 0;
    for (const c of p.acceptanceFixtures) {
      if (c && typeof c === "object" && (c as { approval?: unknown }).approval === "approved") {
        approved += 1;
      } else {
        pending += 1;
      }
    }
    const total = p.acceptanceFixtures.length;
    const notFunctional = pending > 0 || total === 0;
    fixturesLine = clip(
      `fixtures: total=${total} approved=${approved} pending=${pending}${
        notFunctional ? " (pending — not functional)" : ""
      }`,
      120,
    );
  }

  // generatedTree length — synthesisSucceeded is NOT on Project; derive an
  // honest compact signal so the copilot cannot invent "LLM software shipped".
  const treeArr = Array.isArray(p.generatedTree) ? p.generatedTree : null;
  const treeCount = treeArr ? treeArr.length : 0;
  const hasTree = treeCount > 0;

  let testLine = "none";
  const lastTest = p.lastTest;
  let testLabel = "";
  if (lastTest && typeof lastTest === "object") {
    testLabel =
      typeof lastTest.label === "string" ? clip(lastTest.label, 24) : "";
    // Floor honesty: self-test (and unlabeled template runs with no tree) are
    // the deterministic engine floor — NOT tree-run / machine-verified proof.
    const isFloorLabel =
      testLabel === "self-test" ||
      (!testLabel && !hasTree);
    const floorTag = isFloorLabel ? " (deterministic floor — not tree-run)" : "";
    testLine = `ok=${String(!!lastTest.ok)} label=${testLabel || "none"}${floorTag}: ${
      clip(typeof lastTest.detail === "string" ? lastTest.detail : "", 120) || "no detail"
    }`;
  }

  // fixes/186: synthesis / tree-run honesty line. Omitted on bare legacy
  // (no lastTest, no tree) for byte-identical parity. Never fabricates success.
  let synthesisLine: string | null = null;
  if (hasTree || lastTest) {
    if (hasTree) {
      const labelBit = testLabel ? `; lastTest label=${testLabel}` : "";
      // K5-6 (fixes/294/295): DEFAULT-DENY. Only the two machine-proof labels
      // may skip the caveat; any other value (persisted drift, a future fourth
      // label) is NOT tree-run proven and must say so — the old allow-list let
      // an unknown label read as proven (over-claim).
      const proven =
        testLabel === "tested" || testLabel === "real-run"
          ? ""
          : " (tree present — not tree-run proven)";
      synthesisLine = clip(`synthesis: tree ${treeCount} files${labelBit}${proven}`, 160);
    } else if (testLabel === "tested") {
      synthesisLine = "synthesis: tested-equivalent (no generatedTree on project)";
    } else if (testLabel === "real-run") {
      synthesisLine = "synthesis: real-run (no generatedTree on project)";
    } else {
      // self-test / unlabeled / other → floor; synthesisSucceeded effectively false
      synthesisLine =
        "synthesis: floor (synthesisSucceeded=false — deterministic template, not LLM tree)";
    }
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
    ...(notesLine ? [notesLine] : []),
    `researchEntries: ${researchLine}`,
    ...(fixturesLine ? [fixturesLine] : []),
    `lastTest: ${testLine}`,
    ...(synthesisLine ? [synthesisLine] : []),
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
// Local slash tools (no LLM). Work keyless. Facts only from project + context.
// ---------------------------------------------------------------------------

export const CHAT_TOOLS = ["status", "gate", "packet", "fixtures", "help", "ls", "read"] as const;
export type ChatToolName = (typeof CHAT_TOOLS)[number];

/** Cap for `/read` packet body (chars). Size-capped; never a full disk dump. */
export const CHAT_READ_MAX = 8000;

const KEYLESS_TOOLS =
  "Slash tools /status /gate /packet /fixtures /ls /read /help work keyless.";

/** Honest keyless free-text refusal (also used if the LLM path races not-configured). */
const KEYLESS_FREE_TEXT_ERROR =
  `DeepSeek is not configured — add DEEPSEEK_API_KEY to use the copilot. ${KEYLESS_TOOLS}`;

/** Parse recognized slash verbs. Null if not a tool (never treats /rm as a tool). */
export function parseChatTool(userText: string): ChatToolName | null {
  const m = /^\/(status|gate|packet|fixtures|help|ls|read)(?:\s|$)/i.exec(
    typeof userText === "string" ? userText.trim() : "",
  );
  return m ? (m[1]!.toLowerCase() as ChatToolName) : null;
}

/**
 * Packet-relative path only. Refuses traversal, absolute, home, UNC, control
 * chars, empty segments, and `.` / `..` — never a disk walk key.
 */
export function packetRelPath(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const p = raw.trim().replace(/\\/g, "/");
  if (!p || p.length > 200) return null;
  // Control chars / NUL — never a path key into the packet map (charCode; no control-regex).
  for (let i = 0; i < p.length; i++) {
    const c = p.charCodeAt(i);
    if (c <= 0x1f || c === 0x7f) return null;
  }
  if (p.startsWith("/") || p.startsWith("~") || /^[a-zA-Z]:/.test(p)) return null;
  if (p.split("/").some((seg) => seg === ".." || seg === "." || seg === "")) return null;
  return p;
}

function packetFileSource(project: Project, rel: string): string | null {
  const tree = Array.isArray(project.generatedTree) ? project.generatedTree : [];
  const hit = tree.find((f) => f && f.path === rel && typeof f.source === "string");
  if (hit) return hit.source as string;
  if (
    rel === "src/generated.ts" &&
    typeof project.generatedSource === "string" &&
    project.generatedSource.trim()
  ) {
    return project.generatedSource;
  }
  return null;
}

/**
 * Deterministic tool body. Never calls the network. Never shells. /ls and
 * /read see the PACKET (generatedTree / generatedSource), not the disk.
 * Returns a plain string — callers wrap as `{ ok: true, reply }` with no
 * dual-channel `error` field (185-H1).
 */
export function runChatTool(name: ChatToolName, project: Project, context: string, arg = ""): string {
  const line = (prefix: string): string => {
    const hit = context.split("\n").find((l) => l.startsWith(prefix));
    return hit ?? `${prefix} (absent)`;
  };
  if (name === "help") {
    return [
      "Local tools (no LLM, work keyless, no shell, no disk walk):",
      "/status    lastTest + synthesis + hitl",
      "/gate      lastGate + open HITL prompt",
      "/packet    packet line from grounded context",
      "/fixtures  acceptance fixture pending/approved",
      "/ls        generatedTree paths on this packet",
      "/read <p>  packet file body (generatedTree / generatedSource only; size-capped)",
      "/help      this list",
    ].join("\n");
  }
  if (name === "status") {
    return [line("lastTest:"), line("synthesis:"), line("hitl:"), line("status:")].join("\n");
  }
  if (name === "gate") {
    return [line("lastGate:"), line("hitl:"), line("currentPhase:")].join("\n");
  }
  if (name === "packet") {
    return line("packet:");
  }
  if (name === "ls") {
    const tree = Array.isArray(project.generatedTree) ? project.generatedTree : [];
    const paths = [
      ...new Set(
        tree
          .map((f) => (f && typeof f.path === "string" ? f.path : ""))
          .filter((p) => p.length > 0),
      ),
    ].sort();
    const host =
      typeof project.generatedSource === "string" && project.generatedSource.trim().length > 0;
    if (paths.length === 0 && !host) {
      return "ls: no generated files on this packet (not yet synthesized — not a disk listing)";
    }
    const lines = [...paths];
    if (host && !lines.includes("src/generated.ts")) lines.unshift("src/generated.ts");
    return `ls: ${lines.length} packet file(s)\n${lines.join("\n")}`;
  }
  if (name === "read") {
    const rel = packetRelPath(arg);
    if (!rel) return "read: need a repo-relative path (no .., no absolute, no disk walk)";
    const src = packetFileSource(project, rel);
    if (src == null) {
      return `read: ${rel} is not on this packet (generatedTree / generatedSource only — no disk, no shell)`;
    }
    if (src.length <= CHAT_READ_MAX) return src;
    return `${src.slice(0, CHAT_READ_MAX)}\n… truncated (${src.length} bytes, cap ${CHAT_READ_MAX})`;
  }
  if (name === "fixtures") {
    const fx = context.split("\n").find((l) => l.startsWith("fixtures:"));
    return fx ?? "fixtures: (none on this project — field absent, not empty)";
  }
  // K5-3 (fixes/294/295): the fixtures body was the silent DEFAULT arm — a name
  // drift at runtime would have been answered with fixture text. Unreachable
  // for the ChatToolName union (parseChatTool allow-lists every verb, and it is
  // the only producer), so this tail is a CODED refusal, never a fallback body.
  return `RT_E_VALIDATION: unknown chat tool "${String(name)}" — no tool body ran.`;
}

// ---------------------------------------------------------------------------
// Grounded chat (server-only entry)
// ---------------------------------------------------------------------------

/**
 * One grounded copilot turn. Slash tools run keyless. Free-text still needs
 * DeepSeek; without a key that path is not-configured (never fabricated).
 */
export async function chatOnceServer(
  project: Project,
  userText: string,
  history?: ChatTurn[],
  now: () => Date = () => new Date(),
): Promise<ChatResult> {
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
  const tool = parseChatTool(text);
  if (tool) {
    const context = buildChatContext(project);
    const arg = text.replace(/^\/\S+\s*/, "").trim();
    return {
      ok: true,
      reply: runChatTool(tool, project, context, arg),
      grounded: true,
      provenance: chatProvenance(project, context, now()),
    };
  }
  if (!isDeepSeekConfigured()) {
    return {
      ok: false,
      reason: "not-configured",
      error: KEYLESS_FREE_TEXT_ERROR,
      code: "RT_E_LLM_NOT_CONFIGURED",
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

  const res = await callModel("main", userMessage, {
    // `main` = the flash workhorse (thinking disabled + the fast 20s timeout,
    // registry-roled — T-107.2 / fixes/216p): the same shape the legacy
    // completeDeepSeek("deepseek-v4-flash") call sent.
    system: `${COPILOT_SYSTEM_PROMPT}\n\n${context}`,
    maxTokens: 768,
    history: turns,
  });

  if (res.ok) {
    // 185-H1: ok:true carries reply + provenance only — never a dual-channel error.
    const dual = dualChannelFailDetail(res);
    if (dual) {
      return {
        ok: false,
        reason: "error",
        error: `Copilot dual-channel response (${dual}) — never treat ok:true+error as a reply`,
        code: "RT_E_INTERNAL",
      };
    }
    return {
      ok: true,
      reply: res.text,
      grounded: true,
      provenance: chatProvenance(project, context, contextAt),
    };
  }
  // Race / mid-flight key loss: same honest keyless envelope as the early check
  // (includes slash-tool pin — free-text still needs a key).
  if (res.reason === "not-configured") {
    return {
      ok: false,
      reason: "not-configured",
      error: KEYLESS_FREE_TEXT_ERROR,
      code: res.code ?? "RT_E_LLM_NOT_CONFIGURED",
    };
  }
  return {
    ok: false,
    reason: "error",
    error: res.error,
    // LlmResult documents code as always-present on provider failures; a
    // missing code here is contract drift — internal, never prose-guessed.
    code: res.code ?? "RT_E_INTERNAL",
  };
}
