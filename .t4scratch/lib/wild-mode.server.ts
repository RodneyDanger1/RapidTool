// ---------------------------------------------------------------------------
// P13 Wild Mode — Auto-Review Supervisor Classifier (wild-mode.server.ts)
//
// The qualitative judgment layer of the Wild Mode autonomous loop. The
// classifier is CONFIGURED-ONLY (deepseek-v4-flash through the shared llm.ts
// client contract): when the DeepSeek backend is not configured it returns
// `{ ok: false, reason: "not-configured" }` and the engine loop falls back to
// the deterministic DoD floor — it NEVER fabricates a machine judgment.
//
// Honesty contract (mirrors llm-tasks.ts):
//   - every ok:true review carries >= 12 characters of feedback (the loop logs
//     that feedback verbatim; shorter model output is an honest error, never
//     padded prose);
//   - an unparseable verdict payload is an error, never a guessed approve;
//   - the review context is built ONLY from real project content (artifacts,
//     phase title, unmet DoD criteria, lastTest) — the model is never shown
//     invented evidence. No pre-chewed PASS/FAIL DoD machine verdict is injected.
//
// The name carries the .server suffix because this is the network-capable
// side of Wild Mode (it talks to the configured LLM backend); like llm-tasks.ts
// it imports ONLY the client-safe `complete()` facade, never deepseek.server.ts
// directly. The task bodies are factory-shaped (`createWildClassifier`) so
// tests can inject a stub completer without spinning up the server runtime.
// ---------------------------------------------------------------------------
import { complete, llmStatus } from "./llm.ts";
import type { LlmModel, LlmResult } from "./llm.ts";
import { dualChannelFailDetail, type ErrorCode } from "./errors.ts";
import { phaseDef } from "./phases.ts";
import type { PhaseId, Project } from "./types.ts";

/** The Auto-Review Supervisor model tier (deepseek-v4-flash per Pillar 13). */
export const WILD_CLASSIFIER_MODEL: LlmModel = "deepseek-v4-flash";

/** Minimum feedback the classifier must produce for a logged review (chars). */
export const WILD_FEEDBACK_MIN = 12;

export type WildGateInfo = {
  pass: boolean;
  unmet: { id: string; criterion: string }[];
  evidenceHash: string;
};

/** Everything the classifier may look at for one phase decision. */
export type WildReviewContext = {
  project: Project;
  phase: PhaseId;
  /** "advance" = judge a just-executed phase before leaving it; "gate" = an open approval gate. */
  reason: "advance" | "gate";
  gate: WildGateInfo;
};

export type WildClassifierResult =
  | { ok: true; verdict: "approve" | "reject"; feedback: string; model: string }
  | {
      ok: false;
      reason: "not-configured" | "error";
      error?: string;
      /** Present on every classifier failure we mint (optional so parent stubs stay assignable). */
      code?: ErrorCode;
    };

export type WildCompleter = (
  prompt: string,
  opts?: { model?: LlmModel; system?: string; maxTokens?: number; json?: boolean },
) => Promise<LlmResult>;

/** Config probe (injectable in tests; defaults to the real llmStatus()). */
export type WildStatusProbe = () => Promise<{ configured: boolean; models: string[] }>;

// ---------------------------------------------------------------------------
// Pure prompt + parser (unit-testable)
// ---------------------------------------------------------------------------

const WILD_SYSTEM =
  "You are the Auto-Review Supervisor for RapidTool Wild Mode: an autonomous agent " +
  "that builds governed software one phase at a time. Judge the phase outputs " +
  "strictly on the evidence shown. Approve only when the deliverables for this " +
  "phase actually exist and are coherent with the brief. Reject when key " +
  "deliverables are missing, vague, contradictory, or risky — never rubber-stamp. " +
  "Feedback must be an honest, specific critique (3+ sentences). Reply with EXACTLY:\n" +
  "VERDICT: approve|reject\nFEEDBACK: <your critique>";

/**
 * Render the review context as a prompt (pure — cheap to unit test).
 *
 * Hyper-agent findings H3: Manus's verification agent "can correct errors or
 * trigger re-planning"; Reflexion steering (89 §2.2 [S13]) requires a re-review
 * to meet the recorded rejection notes rather than rediscover them — so when
 * the phase under review carries rejection history, those notes are surfaced
 * verbatim (capped, most recent first) with an explicit steering line.
 */
export function buildWildReviewPrompt(ctx: WildReviewContext): string {
  const def = phaseDef(ctx.phase);
  const p = ctx.project;
  const artifacts = (p.artifacts ?? [])
    .filter((a) => a.phase === ctx.phase)
    .slice(0, 8)
    .map((a) => `### ${a.title} (${a.kind})\n${(a.body ?? "").slice(0, 320)}`)
    .join("\n\n");
  const lastTest = p.lastTest
    ? `Last module test: ${p.lastTest.ok ? "PASS" : "FAIL"} — ${(p.lastTest.detail ?? "").slice(0, 200)}`
    : "Last module test: none";
  const unmet =
    ctx.gate.unmet.length > 0
      ? ctx.gate.unmet.map((g) => `- ${g.id}: ${g.criterion}`).join("\n")
      : "(all criteria met)";
  const rec = p.phases.find((r) => r.id === ctx.phase);
  const history = rec?.rejectionHistory ?? [];
  const historyLines: string[] = [];
  if (history.length > 0) {
    historyLines.push(`Recorded rejections for this phase: ${history.length}`);
    for (const h of history.slice(-2)) {
      const note = (h.note ?? "").trim();
      if (note) historyLines.push(`- ${note.length > 200 ? `${note.slice(0, 199)}…` : note}`);
    }
    historyLines.push(
      "Steering: if any recorded rejection exists, this review MUST judge whether the re-run addresses its note — a re-approval that ignores a recorded rejection is a rubber stamp.",
    );
  }
  return [
    `Project: ${p.name}`,
    `Domain: ${p.domain}`,
    `Brief: ${(p.brief ?? "").slice(0, 400)}`,
    ``,
    `Phase under review: ${def.code} ${def.title} — ${def.summary}`,
    `Review reason: ${ctx.reason === "gate" ? "an approval gate is open for this phase" : "this phase just executed; decide whether the loop may leave it"}`,
    ``,
    // Blinded judge (185-U8): do NOT inject a pre-chewed PASS/FAIL DoD machine
    // verdict. The model must weigh unmet criteria + artifacts itself.
    `Unmet DoD criteria:\n${unmet}`,
    ``,
    artifacts ? `Phase artifacts:\n${artifacts}` : "Phase artifacts: (none)",
    ``,
    lastTest,
    ...(historyLines.length > 0 ? ["", ...historyLines] : []),
    ``,
    `Decide: VERDICT: approve|reject then FEEDBACK with an honest 3+ sentence critique.`,
  ].join("\n");
}

/**
 * Parse the model's reply into a verdict + feedback. Tolerates extra prose
 * around the markers but REQUIRES an explicit verdict token and non-empty
 * feedback — anything else returns null so callers report an honest error.
 */
export function parseWildReview(text: string): { verdict: "approve" | "reject"; feedback: string } | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  // Collect every verdict token; drop template echoes (`approve|reject` and
  // longer words) — audit-40 P1: the model's REAL verdict is the LAST token
  // that has a FEEDBACK marker after it, never a quoted/echoed earlier one.
  const verdictRe = /VERDICT\s*:\s*(approve|reject)([|\w]?)/gi;
  const verdicts: { index: number; verdict: "approve" | "reject" }[] = [];
  for (const m of trimmed.matchAll(verdictRe)) {
    if (m[2]) continue; // template token or longer word — not a real verdict
    verdicts.push({ index: m.index, verdict: m[1].toLowerCase() as "approve" | "reject" });
  }
  if (verdicts.length === 0) return null;
  let winner: { verdict: "approve" | "reject"; feedback: string } | null = null;
  for (const v of verdicts) {
    const fm = /FEEDBACK\s*:\s*([\s\S]*)$/i.exec(trimmed.slice(v.index));
    if (!fm) continue;
    const feedback = fm[1].trim();
    if (feedback.length < WILD_FEEDBACK_MIN) continue;
    winner = { verdict: v.verdict, feedback };
  }
  return winner;
}

/**
 * Deterministic rubber-stamp detector: an APPROVE whose feedback cites no
 * concrete evidence is vacuous. Claude Code's verification guidance is that a
 * fresh model must "try to refute the result" — a bare "looks good" cannot
 * refute anything [F9]. The check is deliberately narrow to stay honest:
 * feedback counts as substantive when it carries at least one token of >= 5
 * letters that is not a generic approval word, or a reference (>= 4 chars) to
 * one of the artifact titles / gate criterion ids shown in the review prompt.
 * Everything else ("looks good, approve", "all good", "no issues") is flagged
 * so the loop reports an honest error instead of minting a rubber-stamp
 * approval. Pure — cheap to unit test.
 */
const VACUOUS_STOP: ReadonlySet<string> = new Set([
  "approve",
  "approved",
  "approval",
  "approving",
  "reject",
  "rejected",
  "rejection",
  "feedback",
  "verdict",
  "review",
  "reviewed",
  "looks",
  "look",
  "good",
  "great",
  "nice",
  "fine",
  "ok",
  "okay",
  "perfect",
  "pass",
  "passed",
  "passes",
  "accept",
  "accepted",
  "phase",
  "brief",
  "gate",
  "this",
  "that",
  "with",
  "from",
  "into",
  "have",
  "been",
  "were",
  "will",
  "very",
  "just",
  "really",
  "quite",
]);

export function isVacuousFeedback(feedback: string, evidence: string[] = []): boolean {
  if (typeof feedback !== "string") return true;
  const words = feedback.toLowerCase().match(/[a-z][a-z0-9-]{1,}/g) ?? [];
  let substantive = 0;
  for (const w of words) {
    if (w.length >= 5 && !VACUOUS_STOP.has(w)) substantive++;
  }
  if (substantive >= 1) return false;
  // No substantive token: a reference to a shown artifact title or gate
  // criterion id still counts as evidence-based (ids like "p6-test" split on
  // the dash — check the joined text too).
  if (evidence.length > 0) {
    const hay = feedback.toLowerCase();
    for (const e of evidence) {
      const needle = e.toLowerCase();
      if (needle.length >= 4 && hay.includes(needle)) return false;
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Task factory (dependency-injected for testability)
// ---------------------------------------------------------------------------

export function createWildClassifier(
  completeFn: WildCompleter,
  statusFn: WildStatusProbe = llmStatus,
) {
  async function wildClassifierReview(ctx: WildReviewContext): Promise<WildClassifierResult> {
    let configured = false;
    try {
      const status = await statusFn();
      configured = status.configured === true;
    } catch {
      configured = false;
    }
    // Configured-only honesty: no backend, no machine judgment.
    if (!configured) return { ok: false, reason: "not-configured", code: "RT_E_LLM_NOT_CONFIGURED" };
    const res = await completeFn(buildWildReviewPrompt(ctx), {
      model: WILD_CLASSIFIER_MODEL,
      system: WILD_SYSTEM,
      maxTokens: 320,
    });
    if (!res.ok) {
      return res.reason === "not-configured"
        ? { ok: false, reason: "not-configured", code: "RT_E_LLM_NOT_CONFIGURED" }
        : {
            ok: false,
            reason: "error",
            error: res.error ?? "Auto-Review completion failed",
            code: res.code ?? "RT_E_INTERNAL",
          };
    }
    // 185-H1: hostile/stub dual-channel `{ ok:true, error }` is never a review.
    const dual = dualChannelFailDetail(res);
    if (dual) {
      return {
        ok: false,
        reason: "error",
        error: `Auto-Review dual-channel response (${dual}) — never treat ok:true+error as a verdict`,
        code: "RT_E_INTERNAL",
      };
    }
    const parsed = parseWildReview(res.text);
    if (!parsed) {
      return {
        ok: false,
        reason: "error",
        error: "Auto-Review returned an unparseable verdict payload",
        code: "RT_E_INTERNAL",
      };
    }
    if (parsed.feedback.length < WILD_FEEDBACK_MIN) {
      // Honest failure: short model feedback is never padded into a "review".
      return {
        ok: false,
        reason: "error",
        error: `Auto-Review feedback too short (${parsed.feedback.length} chars < ${WILD_FEEDBACK_MIN}) to log honestly`,
        code: "RT_E_VALIDATION",
      };
    }
    // Rubber-stamp guard: an APPROVE without any specific evidence is an
    // honest error, never a machine-printed approval (Claude Code refutation
    // floor [F9]; the WILD_SYSTEM "never rubber-stamp" rule made mechanical).
    // The evidence list = the phase artifact titles the prompt actually
    // showed, so a feedback naming an artifact counts as substantive.
    if (parsed.verdict === "approve") {
      const titles = (ctx.project.artifacts ?? [])
        .filter((a) => a.phase === ctx.phase)
        .slice(0, 8)
        .map((a) => a.title ?? "");
      if (isVacuousFeedback(parsed.feedback, titles)) {
        return {
          ok: false,
          reason: "error",
          error:
            "Auto-Review approve is vacuous: feedback cites no specific artifact, criterion, or evidence — honest error, never a rubber-stamp approval",
          code: "RT_E_VALIDATION",
        };
      }
    }
    return { ok: true, verdict: parsed.verdict, feedback: parsed.feedback, model: res.model ?? WILD_CLASSIFIER_MODEL };
  }

  return { wildClassifierReview };
}

/** Default binding wired to the real DeepSeek `complete()` client contract. */
export const { wildClassifierReview } = createWildClassifier(complete);
