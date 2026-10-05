/**
 * fixes/347 (Lane B) — pipeline-review.ts: ONE read-only, deterministic view of
 * what the pipeline did at every stage P0..P12, and where quality was lost.
 *
 * `buildPipelineReview(project, opts?)` assembles a per-stage review from a
 * PERSISTED project record only:
 *   · phase statuses + each stage's recorded DoD gate (passed / unmet / hash);
 *   · the coded RT_E_* refusals each stage journaled in its own logs;
 *   · the lesson.capture rows present per stage (the learning-loop trail);
 *   · artifact titles per stage;
 *   · the tree-run verdict + a substance proxy over the generated tree;
 *   · the persisted spend (tokenUsage).
 *
 * PURE: no LLM, no clock, no randomness, and no I/O beyond the passed record.
 * Same record ⇒ byte-identical review. Missing data reads as explicit
 * null / "unknown" / [] — the module never fabricates a status, a code, a
 * token count or a verdict it was not given.
 *
 * The stage signals themselves come from maker-score.stageQualitySignals (one
 * derivation, shared) so this view and the scorer cannot drift.
 */
import type { Project } from "./types.ts";
import { isStubSource } from "./dod.ts";
import {
  stageQualitySignals,
  treeFilesOf,
  PIPELINE_STAGE_IDS,
  type StageQualitySignal,
} from "./maker-score.ts";

/** Static stage labels (naming only — never per-run data). */
export const PIPELINE_STAGE_TITLES: Readonly<Record<number, string>> = {
  0: "Intake & feasibility",
  1: "Architecture",
  2: "Data model",
  3: "Integration surface",
  4: "Security",
  5: "Validation",
  6: "Implementation / synthesis",
  7: "Research",
  8: "UI",
  9: "CI/CD",
  10: "Edge cases",
  11: "Live data / grounding",
  12: "Delivery & handover",
};

export type PipelineStageReview = StageQualitySignal & { title: string };

export type PipelineLossKind =
  | "gate-unmet"
  | "coded-refusal"
  | "no-record"
  | "tree-run-red"
  | "insufficient-substance"
  | "spend-unmetered";

/** A place where quality was observably lost, with the artifact-derived why. */
export type PipelineLossPoint = {
  stage: number | null;
  kind: PipelineLossKind;
  detail: string;
};

export type PipelineTreeRunSummary = {
  present: boolean;
  verdict: "pass" | "fail" | "unknown";
  /** Where the verdict came from: caller-supplied evidence, lastTest, or none. */
  verdictSource: "opts" | "lastTest" | "none";
  testsPass: number | null;
  testsFail: number | null;
  detail: string | null;
  substance: {
    /** Generated-tree file count (0 when no tree is persisted). */
    generatedTreeFiles: number;
    /** Non-stub tree files (null when no tree to census). */
    realFiles: number | null;
    /** "real" when ≥1 non-stub file, "stub" when only stubs, "empty" when a
     *  tree/generatedSource is absent, else "unknown" for the proxy. */
    verdict: "real" | "stub" | "empty" | "unknown";
    /** "opts" = caller-supplied, "derived" = this module's isStubSource proxy. */
    source: "opts" | "derived";
  };
};

export type PipelineSpendSummary = {
  measured: boolean;
  promptTokens: number | null;
  completionTokens: number | null;
  calls: number | null;
};

export type PipelineLearningSummary = {
  /** lesson.capture log rows across the record (the learning trail's length). */
  lessonEvents: number;
  /** Memory rows whose source is not the engine (agent/human/research lessons). */
  lessonsPersisted: number;
  /** A prior same-slug run is not carried on the project record — always null. */
  priorRun: null;
};

export type PipelineReview = {
  project: {
    id: string | null;
    name: string | null;
    status: string | null;
    kind: string | null;
    domain: string | null;
    currentPhase: number | null;
  };
  stages: PipelineStageReview[];
  stageCount: number;
  /** Observed quality-loss points, ordered by stage then kind. Never inferred. */
  losses: PipelineLossPoint[];
  treeRun: PipelineTreeRunSummary;
  spend: PipelineSpendSummary;
  /** All persisted artifact titles, record order. */
  artifacts: string[];
  learning: PipelineLearningSummary;
};

export type PipelineReviewOptions = {
  /** Restrict/override the reviewed stage set (default P0..P12). */
  stageIds?: readonly number[];
  /**
   * Pre-computed tree-run evidence (the driver lifts compile-check's
   * TreeRunOutcome). When absent the verdict is read from `project.lastTest`
   * — never invented.
   */
  treeRun?: {
    verdict: "pass" | "fail" | "unknown";
    testsPass?: number | null;
    testsFail?: number | null;
    detail?: string | null;
    substance?: "real" | "stub" | "empty" | "unknown";
    realFiles?: number | null;
  } | null;
};

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function treeRunSummary(project: Project, opts: PipelineReviewOptions): PipelineTreeRunSummary {
  const files = treeFilesOf(project);
  const tree = Array.isArray(project.generatedTree) ? project.generatedTree : [];
  const hasTree = tree.length > 0;
  const realFiles = hasTree ? files.filter((f) => !isStubSource(f.source)).length : null;

  let derivedSubstance: PipelineTreeRunSummary["substance"]["verdict"];
  if (!hasTree) {
    derivedSubstance = typeof project.generatedSource === "string" && project.generatedSource.length > 0 ? "unknown" : "empty";
  } else {
    derivedSubstance = (realFiles ?? 0) > 0 ? "real" : "stub";
  }

  const supplied = opts.treeRun;
  if (supplied) {
    return {
      present: true,
      verdict: supplied.verdict,
      verdictSource: "opts",
      testsPass: typeof supplied.testsPass === "number" ? supplied.testsPass : null,
      testsFail: typeof supplied.testsFail === "number" ? supplied.testsFail : null,
      detail: asString(supplied.detail),
      substance: {
        generatedTreeFiles: tree.length,
        realFiles: typeof supplied.realFiles === "number" ? supplied.realFiles : realFiles,
        verdict: supplied.substance ?? derivedSubstance,
        source: "opts",
      },
    };
  }

  const lt = (project.lastTest ?? null) as { ok?: boolean; detail?: string; label?: string } | null;
  if (!lt || typeof lt !== "object") {
    return {
      present: false,
      verdict: "unknown",
      verdictSource: "none",
      testsPass: null,
      testsFail: null,
      detail: null,
      substance: { generatedTreeFiles: tree.length, realFiles, verdict: derivedSubstance, source: "derived" },
    };
  }
  const tested = lt.label === "tested";
  const verdict: PipelineTreeRunSummary["verdict"] = tested ? (lt.ok === true ? "pass" : "fail") : "unknown";
  return {
    present: true,
    verdict,
    verdictSource: "lastTest",
    testsPass: null,
    testsFail: null,
    detail: asString(lt.detail),
    substance: { generatedTreeFiles: tree.length, realFiles, verdict: derivedSubstance, source: "derived" },
  };
}

function spendSummary(project: Project): PipelineSpendSummary {
  const t = project.tokenUsage;
  if (!t || typeof t !== "object") {
    return { measured: false, promptTokens: null, completionTokens: null, calls: null };
  }
  const measured = Number.isFinite(t.promptTokens) && Number.isFinite(t.completionTokens);
  return {
    measured,
    promptTokens: Number.isFinite(t.promptTokens) ? t.promptTokens : null,
    completionTokens: Number.isFinite(t.completionTokens) ? t.completionTokens : null,
    calls: typeof t.calls === "number" && Number.isFinite(t.calls) ? t.calls : null,
  };
}

function lossesOf(stages: PipelineStageReview[], treeRun: PipelineTreeRunSummary, spend: PipelineSpendSummary): PipelineLossPoint[] {
  const losses: PipelineLossPoint[] = [];
  for (const s of stages) {
    if (s.status === null) {
      losses.push({ stage: s.id, kind: "no-record", detail: `P${s.id} has no persisted phase record` });
    } else if (s.gate && s.gate.passed === false) {
      losses.push({
        stage: s.id,
        kind: "gate-unmet",
        detail: `P${s.id} DoD gate FAILED: ${s.gate.unmet.length > 0 ? s.gate.unmet.join(", ") : "unmet criteria not itemized"}`,
      });
    }
    if (s.codedRefusals.length > 0) {
      losses.push({ stage: s.id, kind: "coded-refusal", detail: `P${s.id} journaled ${s.codedRefusals.join(", ")}` });
    }
  }
  if (treeRun.present && treeRun.verdict === "fail") {
    losses.push({ stage: 6, kind: "tree-run-red", detail: `tree-run verdict FAIL${treeRun.detail ? ` — ${treeRun.detail}` : ""}` });
  }
  if (treeRun.substance.verdict === "stub" || treeRun.substance.verdict === "empty") {
    losses.push({
      stage: 6,
      kind: "insufficient-substance",
      detail: `generated tree substance "${treeRun.substance.verdict}" (${treeRun.substance.realFiles ?? 0} non-stub file(s) of ${treeRun.substance.generatedTreeFiles})`,
    });
  }
  if (!spend.measured) {
    losses.push({ stage: null, kind: "spend-unmetered", detail: "no persisted tokenUsage — spend is unmetered for this record" });
  }
  return losses;
}

/** Assemble the review. PURE and deterministic. */
export function buildPipelineReview(project: Project, opts: PipelineReviewOptions = {}): PipelineReview {
  const stageIds = opts.stageIds ?? PIPELINE_STAGE_IDS;
  const stages: PipelineStageReview[] = stageQualitySignals(project, stageIds).map((s) => ({
    ...s,
    title: PIPELINE_STAGE_TITLES[s.id] ?? `P${s.id}`,
  }));
  const treeRun = treeRunSummary(project, opts);
  const spend = spendSummary(project);
  const logs = Array.isArray(project.logs) ? project.logs : [];
  const memory = Array.isArray(project.memory) ? project.memory : [];
  return {
    project: {
      id: asString(project.id),
      name: asString(project.name),
      status: asString(project.status),
      kind: asString(project.kind),
      domain: asString(project.domain),
      currentPhase: typeof project.currentPhase === "number" ? project.currentPhase : null,
    },
    stages,
    stageCount: stages.length,
    losses: lossesOf(stages, treeRun, spend),
    treeRun,
    spend,
    artifacts: (Array.isArray(project.artifacts) ? project.artifacts : []).map((a) => a.title),
    learning: {
      lessonEvents: logs.filter((l) => l && l.event === "lesson.capture").length,
      lessonsPersisted: memory.filter((m) => m && m.source !== undefined && m.source !== "engine").length,
      priorRun: null,
    },
  };
}
