/**
 * run-report.ts — a plain-English markdown report for a whole RapidTool run.
 *
 * `renderRunReport(project, opts?)` is PURE and deterministic: no LLM, no clock,
 * no randomness and no I/O. It reads a PERSISTED project record (the same bytes
 * `saveProject` writes) and renders one human-readable section per phase P0..P12:
 * the phase name/number, its status, whether its recorded DoD gate passed and
 * which criteria were unmet (in the criteria's own words), any coded RT_E_*
 * refusal the phase journaled and what went wrong, the artifacts it produced
 * (titles) and its keyed spend.
 *
 * HONEST BY CONSTRUCTION: every assembled fact comes from the record through
 * `pipeline-review.buildPipelineReview` (the ONE stage derivation this module
 * reuses — it can never drift from the pipeline rail's view). A fact the record
 * does not carry is rendered as "not recorded" — never invented, never guessed.
 */
import type { PhaseId, Project } from "./types.ts";
import { buildPipelineReview, type PipelineStageReview } from "./pipeline-review.ts";
import { phaseDef } from "./phases.ts";
import { DOD } from "./dod.ts";

/** A run's keyed spend as far as it is on the record (token-ledger's SpendSlice). */
export type RunReportSpend = {
  promptTokens?: number;
  completionTokens?: number;
  calls?: number;
};

export type RunReportOptions = {
  /** Wall-clock stamp for the header. Absent ⇒ the header reads "not recorded"
   *  (the renderer never reads the clock — same record ⇒ byte-identical report). */
  generatedAt?: number | string;
  /** Per-phase keyed spend when a driver measured it. Absent ⇒ every phase
   *  honestly reads "not recorded" (the persisted `tokenUsage` is run-level only). */
  spendByPhase?: Readonly<Record<number, RunReportSpend>>;
};

const NOT_RECORDED = "not recorded";
const RT_E_CODE_RE = /RT_E_[A-Z0-9_]+/g;

function oneLine(v: unknown): string {
  return typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "";
}

function orNotRecorded(v: unknown): string {
  const s = oneLine(v);
  return s.length > 0 ? s : NOT_RECORDED;
}

function phaseHeading(id: number): string {
  try {
    const def = phaseDef(id as PhaseId);
    return `${def.code} — ${def.title}`;
  } catch {
    return `P${id}`;
  }
}

/** The criteria's own plain words for a phase's gate (`dod.DOD` registry), with
 *  the raw criterion id as an honest fallback when the id is not registered. */
function criterionWords(phase: number, id: string): string {
  const items = DOD[phase as PhaseId];
  const hit = Array.isArray(items) ? items.find((it) => it.id === id) : undefined;
  return hit ? hit.criterion : id;
}

function gateLine(stage: PipelineStageReview): string {
  const g = stage.gate;
  if (!g) return "not recorded (this phase carries no persisted DoD gate)";
  if (g.passed) {
    return `PASSED${g.evidenceHash ? ` (evidence hash \`${g.evidenceHash}\`)` : ""}`;
  }
  if (g.unmet.length === 0) {
    return "FAILED — unmet criteria not itemized on the record";
  }
  const words = g.unmet.map((id) => `"${criterionWords(stage.id, id)}" (${id})`).join("; ");
  return `FAILED — unmet criteria: ${words}`;
}

/** Distinct coded refusals a phase journaled, each with the log's own detail
 *  (the "what went wrong") — never a bare code with no explanation. */
function refusalLines(project: Project, phase: number): string[] {
  const logs = Array.isArray(project.logs) ? project.logs : [];
  const out: string[] = [];
  for (const l of logs) {
    if (!l || l.phase !== phase) continue;
    const detail = typeof l.detail === "string" ? l.detail : "";
    const codes = detail.match(RT_E_CODE_RE);
    if (!codes || codes.length === 0) continue;
    const codesUnique = [...new Set(codes)].join(", ");
    const line = `${codesUnique} — ${detail}`;
    if (!out.includes(line)) out.push(line);
  }
  return out;
}

function fill(template: string, values: string[]): string {
  let i = 0;
  return template.replace(/%s/g, () => values[i++] ?? "");
}

function formatSpend(s: RunReportSpend | undefined): string {
  if (!s || typeof s !== "object") return NOT_RECORDED;
  const parts: string[] = [];
  if (typeof s.calls === "number") parts.push(`${s.calls} call(s)`);
  if (typeof s.promptTokens === "number") parts.push(`${s.promptTokens} prompt token(s)`);
  if (typeof s.completionTokens === "number") parts.push(`${s.completionTokens} completion token(s)`);
  return parts.length > 0 ? parts.join(", ") : NOT_RECORDED;
}

/** 350 (F1): the per-phase keyed spend a driver MEASURED onto the phase record
 *  (`PhaseRecord.spend`). A record without one (or with a non-object blob)
 *  yields undefined, so the phase keeps reading "not recorded"; a partial slice
 *  reports only the counts it really carries — never a fabricated 0. */
function persistedPhaseSpend(project: Project, phase: number): RunReportSpend | undefined {
  const rec = Array.isArray(project.phases) ? project.phases.find((r) => r && r.id === phase) : undefined;
  const s = rec?.spend;
  if (!s || typeof s !== "object") return undefined;
  const out: RunReportSpend = {};
  if (typeof s.calls === "number") out.calls = s.calls;
  if (typeof s.promptTokens === "number") out.promptTokens = s.promptTokens;
  if (typeof s.completionTokens === "number") out.completionTokens = s.completionTokens;
  return out.calls !== undefined || out.promptTokens !== undefined || out.completionTokens !== undefined
    ? out
    : undefined;
}

/** 350 (F1): the P6 tree-run verdict persisted by W2 (348) — `ok`/`verdict` +
 *  an optional evidence hash. Absent ⇒ "not recorded" (never invented). */
function treeRunText(project: Project): string {
  const t = project.treeRun;
  if (!t || typeof t !== "object") return NOT_RECORDED;
  const parts: string[] = [];
  if (typeof t.verdict === "string" && t.verdict.length > 0) parts.push(t.verdict);
  else if (typeof t.ok === "boolean") parts.push(t.ok ? "pass" : "fail");
  if (typeof t.verdictHash === "string" && t.verdictHash.length > 0) {
    parts.push(`(evidence hash \`${t.verdictHash}\`)`);
  }
  return parts.length > 0 ? parts.join(" ") : NOT_RECORDED;
}

/** 350 (F1): the P6 generated-tree substance census label persisted by W2 (348). */
function substanceText(project: Project): string {
  const s = project.substance;
  const v = s && typeof s === "object" && typeof s.verdict === "string" ? oneLine(s.verdict) : "";
  return v.length > 0 ? v : NOT_RECORDED;
}

/** Render the whole run as plain-English markdown. PURE. */
export function renderRunReport(project: Project, opts: RunReportOptions = {}): string {
  const review = buildPipelineReview(project);
  const p = review.project;
  const lines: string[] = [];

  lines.push(`# Run report — ${orNotRecorded(p.name)}`);
  lines.push("");
  lines.push(fill("- Project: %s (`%s`)", [orNotRecorded(p.name), orNotRecorded(p.id)]));
  lines.push(
    fill("- Status: %s — current phase %s", [
      orNotRecorded(p.status),
      phaseHeading(typeof p.currentPhase === "number" ? p.currentPhase : -1),
    ]),
  );
  lines.push(fill("- Kind: %s", [orNotRecorded(p.kind)]));
  lines.push(fill("- Domain: %s", [orNotRecorded(p.domain)]));
  lines.push(fill("- Acceptance: %s", [orNotRecorded((project as { acceptance?: unknown }).acceptance)]));
  lines.push(fill("- Brief: %s", [orNotRecorded(oneLine(project.brief))]));
  lines.push(fill("- Generated: %s", [
    opts.generatedAt == null ? NOT_RECORDED : String(opts.generatedAt),
  ]));
  lines.push(
    `- Run keyed spend: ${
      review.spend.measured
        ? formatSpend({
            promptTokens: review.spend.promptTokens ?? undefined,
            completionTokens: review.spend.completionTokens ?? undefined,
            calls: review.spend.calls ?? undefined,
          })
        : NOT_RECORDED
    }`,
  );
  lines.push("");
  lines.push("## Phases");
  lines.push("");

  for (const stage of review.stages) {
    lines.push(`### ${phaseHeading(stage.id)}`);
    lines.push("");
    lines.push(`- **Status:** ${stage.status === null ? "not recorded (no persisted phase record)" : stage.status}`);
    lines.push(`- **DoD gate:** ${gateLine(stage)}`);
    const refusals = refusalLines(project, stage.id);
    if (refusals.length === 0) {
      lines.push("- **Coded refusals:** none recorded");
    } else {
      lines.push(`- **Coded refusals (${refusals.length}):**`);
      for (const r of refusals) lines.push(`  - ${r}`);
    }
    if (stage.artifacts.length === 0) {
      lines.push("- **Artifacts:** none recorded");
    } else {
      lines.push(`- **Artifacts (${stage.artifacts.length}):** ${stage.artifacts.join("; ")}`);
    }
    // A caller-supplied slice wins; otherwise read the spend the driver MEASURED
    // onto the phase record (350 F1). Absent ⇒ the honest run-total fallback.
    const perPhase = opts.spendByPhase?.[stage.id] ?? persistedPhaseSpend(project, stage.id);
    if (perPhase) {
      lines.push(`- **Keyed spend:** ${formatSpend(perPhase)}`);
    } else if (review.spend.measured) {
      lines.push(
        `- **Keyed spend:** not recorded per phase (run total: ${formatSpend({
          promptTokens: review.spend.promptTokens ?? undefined,
          completionTokens: review.spend.completionTokens ?? undefined,
          calls: review.spend.calls ?? undefined,
        })})`,
      );
    } else {
      lines.push("- **Keyed spend:** not recorded");
    }
    // The generated-tree verdicts are P6-owned (348's withTreeRunVerdict writes
    // them project-level); render them on P6 so the phase no longer reports
    // "unknown". Every other phase has no tree-run to show.
    if (stage.id === 6) {
      lines.push(`- **Tree run:** ${treeRunText(project)}`);
      lines.push(`- **Substance:** ${substanceText(project)}`);
    }
    lines.push("");
  }

  lines.push("## Where quality was lost");
  lines.push("");
  if (review.losses.length === 0) {
    lines.push("No quality-loss points were observable on this record.");
  } else {
    for (const loss of review.losses) {
      lines.push(`- ${loss.stage === null ? "Run" : `P${loss.stage}`} · ${loss.kind}: ${loss.detail}`);
    }
  }
  lines.push("");

  return lines.join("\n");
}

/** Convenience for callers that only want the stage count this report covers
 *  (keeps the "every phase P0..P12" contract testable without re-deriving). */
export function reportedStageIds(project: Project): number[] {
  return buildPipelineReview(project).stages.map((s) => s.id);
}
