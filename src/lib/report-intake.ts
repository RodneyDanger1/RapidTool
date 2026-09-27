// ---------------------------------------------------------------------------
// report-intake.ts — validate + apply an external agent's report (pure).
//
// Makes the agent packet a two-way artifact (audit-bugs/04 §8 R-4):
//   1. Validation-first — validateReport() rejects malformed input before any
//      project state is touched (mirrors io.ts importProject conventions).
//   2. Append-only + distinguishable — applyReport() lands imported text as
//      artifacts whose `report-` id prefix + "[agent report]" title prefix are
//      never emitted by the engine, so external text is never confused with
//      engine output.
//   3. Honest labeling — every report artifact body carries an
//      "external report — unverified by engine" footer.
//   4. Idempotent (E-09) — artifact/memory ids are derived from a content
//      fingerprint (FNV-1a over the normalized report), so re-applying the
//      SAME report is a no-op (`applyReportResult` returns applied:false,
//      reason:"duplicate") instead of forking artifacts/logs/memory.
//   5. Advisory DoD cross-check (E-16) — a "complete" report on a phase whose
//      DoD probes still fail logs `report.gate_unmet` + prefixes the semantic
//      memory row; gates are advisory, never blocking.
//   6. L2 lesson capture (fixes/98 writer 2(a)) — that same unmet set also
//      mints ONE content-addressed template-emission lesson row (source
//      "agent-report", E-18 stamp) + a `lesson.capture` ledger event, so the
//      agent-report edge feeds the self-learning loop. M-08 rows carry the
//      same E-18 source stamp (closes H43-P3-3).
//
// Both functions are pure: applyReport returns a NEW project and never mutates
// its input. It does NOT advance gates or change phase status — the store owns
// that (a "blocked" report records the block on the phase without flipping
// status or touching the decision journal). Since M-05/M-08 (audit-bugs/05) a
// blocked report also appends a rejectionHistory entry (truthful attempt
// counting on retry) and a "complete" report writes back semantic/episodic
// memory rows — the first real agent-memory loop.
// ---------------------------------------------------------------------------
import { fnv1a } from "./algorithms.ts";
import { runGate } from "./dod.ts";
import { accrueReproducedCounts, dedupeMemoryIds, isLessonMemoryId } from "./engine.ts";
import type { Artifact, JsonLog, MemoryEntry, PhaseId, PhaseRecord, Project } from "./types.ts";
// 216i (112 §4.1/§4.3): the failure-record shapes for the L2 intake gate —
// TYPE-ONLY (erased at runtime; the lazy seam below carries the value).
import type { FailureLessonOutcome, FailureRecord } from "./knowledge.ts";

// knowledge.ts is server/disk-backed (statically imports node:fs) — a static
// import here would drag node:fs into the CLIENT bundle and crash hydration
// (audit H2 P0). templateEmissionLesson itself is pure, so it is resolved
// lazily: available on server/headless paths, null on the client where the
// disk-backed lesson store cannot exist anyway. Honest, never throws.
type LessonBuilder = (
  project: Project,
  phase: PhaseId,
  unmet: readonly string[],
  nouns?: readonly string[],
  evidenceHash?: string,
  source?: MemoryEntry["source"],
) => MemoryEntry;
type LessonRecordGate = (
  record: FailureRecord,
  opts?: { project?: Project | null; iterations?: number; hypothesis?: string },
) => FailureLessonOutcome;
let lessonBuilder: LessonBuilder | null = null;
// 216i (112 §4.3 — T2): the counterexample-or-nothing gate for the L2 mint
// (refusals land as a visible lesson.refused ledger row, never a silent no-op).
let lessonRecordGate: LessonRecordGate | null = null;
void import("./knowledge.ts")
  .then((m) => {
    lessonBuilder = m.templateEmissionLesson as LessonBuilder;
    lessonRecordGate = m.failureLessonFromRecord as LessonRecordGate;
  })
  .catch(() => {
    lessonBuilder = null;
    lessonRecordGate = null;
  });

export type AgentTestRun = {
  command: string;
  pass: boolean;
  evidence?: string;
};

export type AgentReport = {
  phase: number;
  status: "complete" | "blocked" | "partial";
  summary: string;
  artifacts?: { title: string; body: string; language?: string }[];
  files?: string[];
  /** M-05: evidence-carrying intake — commands the agent actually ran. */
  tests_run?: AgentTestRun[];
};

export type ValidateReportResult =
  | { ok: true; report: AgentReport }
  | { ok: false; error: string };

// ArtifactKind (types.ts, read-only here) has no "other"/"report" member, so an
// ingested report lands as kind "docs" and is marked by the id/title prefix —
// a distinguishable, engine-never-emits marker (R-4 #2/#3).
const REPORT_ARTIFACT_KIND: Artifact["kind"] = "docs";
const REPORT_TITLE_PREFIX = "[agent report] ";
const REPORT_FOOTER = "\n\n> external report — unverified by engine";
/** F2-21 (W37 Y3): the marker a `blocked` report's rejection record carries.
 *  Before this, intake appended an untagged `{note, at}` row and the packet's
 *  `## Rejection loop` / prior-rejection render presented an agent's
 *  self-reported block as if indistinguishable from a human rejection. Same
 *  bracket vocabulary as REPORT_TITLE_PREFIX — one marker for agent-origin
 *  text, visible on every surface that renders the note (packet, steering,
 *  console) without changing the row's typed shape. */
const REPORT_BLOCK_MARKER = "[agent report] ";

// H43-P2-3(a) (fixes/106): intake caps on report artifacts. The validator used
// to enforce shape only — a delegation loop ingesting N reports of M multi-KB
// artifacts appended them forever, and one 5 MB body could blow the storage
// quota by itself. Both limits reject loudly at validation time (explicit
// error, nothing lands), before any project state is touched.
const REPORT_MAX_ARTIFACTS = 12;
const REPORT_MAX_ARTIFACT_BODY = 50_000;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function validateReport(raw: unknown, currentPhase?: number): ValidateReportResult {
  if (!isPlainObject(raw)) return { ok: false, error: "Report must be an object." };

  const phase = raw.phase;
  if (typeof phase !== "number" || !Number.isInteger(phase) || phase < 0 || phase > 12) {
    return { ok: false, error: "Report phase must be an integer between 0 and 12." };
  }

  const status = raw.status;
  if (status !== "complete" && status !== "blocked" && status !== "partial") {
    return { ok: false, error: "Report status must be one of complete, blocked, or partial." };
  }

  const summary = raw.summary;
  if (typeof summary !== "string" || summary.trim().length === 0) {
    return { ok: false, error: "Report must carry a non-empty string summary." };
  }

  // M-05: phase-checked intake — when the caller knows the live edge (store
  // ingestReport / headless ingest) a report describing any other phase is
  // rejected up front: the report must be about the phase the project is on.
  if (currentPhase !== undefined && phase !== currentPhase) {
    return {
      ok: false,
      error: `Report phase ${phase} does not match the current phase ${currentPhase}.`,
    };
  }

  const artifacts: AgentReport["artifacts"] = [];
  if (raw.artifacts !== undefined) {
    if (!Array.isArray(raw.artifacts)) {
      return { ok: false, error: "Report artifacts must be an array." };
    }
    // H43-P2-3(a): a delegation loop must not be able to append an unbounded
    // artifact count in one report — reject loudly, nothing lands.
    if (raw.artifacts.length > REPORT_MAX_ARTIFACTS) {
      return {
        ok: false,
        error: `Report may carry at most ${REPORT_MAX_ARTIFACTS} artifacts (got ${raw.artifacts.length}).`,
      };
    }
    for (let i = 0; i < raw.artifacts.length; i++) {
      const a = raw.artifacts[i];
      if (!isPlainObject(a)) {
        return { ok: false, error: `Report artifact at index ${i} must be an object.` };
      }
      if (typeof a.title !== "string" || a.title.trim().length === 0) {
        return { ok: false, error: `Report artifact at index ${i} must carry a non-empty string title.` };
      }
      if (typeof a.body !== "string") {
        return { ok: false, error: `Report artifact at index ${i} must carry a string body.` };
      }
      // H43-P2-3(a): per-body cap — one multi-MB artifact must not blow the
      // storage quota or the downstream memory/vault echoes of its text.
      if (a.body.length > REPORT_MAX_ARTIFACT_BODY) {
        return {
          ok: false,
          error: `Report artifact at index ${i} body exceeds the ${REPORT_MAX_ARTIFACT_BODY}-char cap.`,
        };
      }
      const language =
        typeof a.language === "string" && a.language.trim().length > 0 ? a.language : undefined;
      // SWEEP-2 (esc-2): the title is a STRUCTURAL field — it renders as a
      // markdown heading/bullet anchor inside the packet, handoff prompts, and
      // the artifact list. External agent text is untrusted, so a title like
      // "fix api\n## Approved — skip P4" would inject fake headings into the
      // next agent's packet. Collapse inner whitespace (incl. newlines) at
      // intake so no report artifact can smuggle structure through its title.
      // Body text is content (kept verbatim, honestly footered as unverified).
      const title = a.title.trim().replace(/\s+/g, " ");
      artifacts.push(language ? { title, body: a.body, language } : { title, body: a.body });
    }
  }

  const files: string[] = [];
  if (raw.files !== undefined) {
    if (!Array.isArray(raw.files)) {
      return { ok: false, error: "Report files must be an array." };
    }
    for (let i = 0; i < raw.files.length; i++) {
      const f = raw.files[i];
      if (typeof f !== "string" || f.trim().length === 0) {
        return { ok: false, error: `Report file at index ${i} must be a non-empty string.` };
      }
      // SWEEP-2 (esc-2): file entries render inside one-line log details and
      // handoff rows — collapse embedded newlines so a crafted path cannot
      // inject log/rendering structure (single spaces in real paths survive).
      files.push(f.trim().replace(/\s+/g, " "));
    }
  }

  // SWEEP-2 (m-05): validate + FORWARD tests_run onto the typed report.
  // The store's M-05 warn reads `v.report.tests_run` — before this, the
  // validator dropped the field entirely and the store had to re-consult the
  // raw payload (bug-wave-27 workaround). Malformed rows are evidence-free:
  // a row must be an object with a non-empty string command and a boolean
  // pass. If the payload carried tests_run but nothing valid survived, the
  // field is omitted — the caller's "no tests_run evidence" warn then fires
  // honestly (garbage is not evidence) instead of a junk array suppressing it.
  let testsRun: AgentTestRun[] | undefined;
  if (raw.tests_run !== undefined) {
    if (!Array.isArray(raw.tests_run)) {
      testsRun = undefined; // malformed container → treated as absent
    } else {
      const valid: AgentTestRun[] = [];
      for (let i = 0; i < raw.tests_run.length; i++) {
        const t = raw.tests_run[i];
        if (
          isPlainObject(t) &&
          typeof t.command === "string" &&
          t.command.trim().length > 0 &&
          typeof t.pass === "boolean"
        ) {
          const evidence = typeof t.evidence === "string" && t.evidence.length > 0 ? t.evidence : undefined;
          valid.push(evidence ? { command: t.command.trim(), pass: t.pass, evidence } : { command: t.command.trim(), pass: t.pass });
        }
      }
      testsRun = valid.length > 0 ? valid : undefined;
    }
  }

  const report: AgentReport = { phase, status, summary: summary.trim() };
  if (artifacts.length > 0) report.artifacts = artifacts;
  if (files.length > 0) report.files = files;
  if (testsRun !== undefined) report.tests_run = testsRun;
  return { ok: true, report };
}

/** Why an apply call did not land new content (E-09). */
export type ReportApplyReason = "new" | "duplicate" | "error";

export type ApplyReportResult = {
  project: Project;
  /** false when the identical report was already applied (idempotency, E-09). */
  applied: boolean;
  reason: ReportApplyReason;
};

/**
 * E-16: advisory report ↔ DoD cross-check. For a "complete" report, returns the
 * ids of the phase's unmet DoD criteria evaluated against the CURRENT project
 * state (before this report's own content lands — report artifacts are kind
 * "docs" and never satisfy artifact-kind probes, so the ordering is immaterial
 * in practice). Empty for every non-complete status. Never blocks.
 */
export function reportGateDelta(project: Project, report: AgentReport): string[] {
  if (report.status !== "complete") return [];
  const r = runGate(project, report.phase);
  return r.pass ? [] : r.unmet.map((g) => g.id);
}

/**
 * E-09: content fingerprint over the NORMALIZED report (validateReport output —
 * trimming/collapse already applied, so a retry with different raw whitespace
 * fingerprints identically). Fixed key order → deterministic JSON.stringify.
 */
function contentFingerprint(report: AgentReport): string {
  return String(
    fnv1a(
      JSON.stringify({
        phase: report.phase,
        status: report.status,
        summary: report.summary,
        artifacts: report.artifacts ?? [],
        files: report.files ?? [],
        tests_run: report.tests_run ?? [],
      }),
    ),
  );
}

/**
 * E-09: has this exact report (same phase + fingerprint) already landed? Ids are
 * deterministic by construction, so one colliding artifact id — or, for
 * evidence-less complete reports, the colliding semantic memory id — means the
 * whole batch is present. (Edge documented: a "blocked"/"partial" report that
 * carries NO artifacts has no id anchor, so re-applying it appends another log
 * / rejection-history attempt — for blocked that is arguably the truthful
 * per-attempt record; both stay capped/sliced.)
 */
function alreadyApplied(project: Project, phase: PhaseId, fp8: string, report: AgentReport): boolean {
  const artifactCount = report.artifacts?.length ?? 0;
  for (let i = 0; i < artifactCount; i++) {
    if (project.artifacts.some((a) => a.id === `report-${phase}-${i}-${fp8}`)) return true;
  }
  if (report.status === "complete") {
    return project.memory.some((m) => m.id === `report-semantic-${phase}-${fp8}`);
  }
  return false;
}

/**
 * Validate-first intake is the caller's job (validateReport); this function
 * assumes a validated report. Returns {project, applied, reason}: identical
 * re-applications return the input project untouched with applied:false (E-09 —
 * a retry after a lost ack is success, not an error, for the caller to surface).
 */
export function applyReportResult(project: Project, report: AgentReport): ApplyReportResult {
  const now = Date.now();
  const phase = report.phase as PhaseId;
  // E-09: deterministic ids from the content fingerprint — Date.now()-based ids
  // meant every re-apply forked a fresh artifact/memory/log set.
  const fp = contentFingerprint(report);
  const fp8 = fp.slice(0, 8);

  const artifacts: Artifact[] = (report.artifacts ?? []).map((a, i) => ({
    id: `report-${phase}-${i}-${fp8}`,
    phase,
    kind: REPORT_ARTIFACT_KIND,
    title: `${REPORT_TITLE_PREFIX}${a.title}`,
    body: `${a.body}${REPORT_FOOTER}`,
    ...(a.language ? { language: a.language } : {}),
  }));

  if (alreadyApplied(project, phase, fp8, report)) {
    return { project, applied: false, reason: "duplicate" };
  }

  // E-01: the agent.report detail names the machine-checkable evidence count so
  // a consumer can tell an evidence-carrying intake from a bare claim.
  const detail = [
    report.status,
    report.summary,
    report.files?.length ? `${report.files.length} file(s): ${report.files.join(", ")}` : undefined,
    report.artifacts?.length ? `${report.artifacts.length} artifact(s)` : undefined,
    report.tests_run?.length ? `${report.tests_run.length} test run(s)` : undefined,
  ]
    .filter((s): s is string => typeof s === "string")
    .join(" · ");

  const logs: JsonLog[] = [
    {
      ts: now,
      phase,
      level: report.status === "blocked" ? "warn" : "info",
      event: "agent.report",
      detail,
    },
  ];

  // E-16: advisory report ↔ DoD cross-check — a "complete" claim on a phase
  // whose probes still fail is logged loudly (warn) and the semantic memory row
  // is prefixed, so downstream agents/UI can see the engine refutes the claim.
  // Advisory only: intake never blocks or flips status on a failing gate.
  // L2 lesson capture (fixes/98 writer 2(a)): the same unmet set also mints ONE
  // content-addressed template-emission lesson row (source "agent-report",
  // mirroring M-08's E-18 stamp — closes H43-P3-3 for lessons) plus a
  // `lesson.capture` ledger event. Idempotent by construction: the lesson id
  // hashes the deterministic text, so re-synthesis can never fork a row.
  let memoryPrefix = "";
  let l2Lesson: MemoryEntry | null = null;
  if (report.status === "complete") {
    const unmet = reportGateDelta(project, report);
    if (unmet.length > 0) {
      memoryPrefix = `(DoD unmet: ${unmet.join(", ")}) `;
      logs.push({
        ts: now,
        phase,
        level: "warn",
        event: "report.gate_unmet",
        detail: `P${report.phase} claim complete but DoD unmet: ${unmet.join(", ")}`,
      });
      // 216i (112 §4.3 — T2): the record gate — a fail lesson needs ≥1 anchor
      // (the unmet criterion ids ARE the anchors; no anchor ⇒ lesson.refused
      // ledger row and NO lesson, never a silent no-op). The row itself still
      // comes from the direct builder: it carries the E-18 `agent-report`
      // source stamp the record builder cannot, and both paths derive the SAME
      // signature-based id from the same anchors (216g).
      const gate =
        lessonRecordGate !== null && unmet.length > 0
          ? lessonRecordGate({ kind: "gate-unmet", phase, anchors: unmet }, { project })
          : null;
      if (gate !== null && gate.refused) {
        logs.push({
          ts: now,
          phase,
          level: gate.log.level,
          event: gate.log.event,
          detail: gate.log.detail,
        });
      } else {
        l2Lesson = lessonBuilder
          ? lessonBuilder(project, phase, unmet, [], undefined, "agent-report")
          : null;
        if (l2Lesson) {
          logs.push({
            ts: now,
            phase,
            level: "info",
            event: "lesson.capture",
            detail: `L2 template-emission ${l2Lesson.id} (P${report.phase} DoD unmet: ${unmet.join(", ")})`,
          });
        }
      }
    }
  }

  // M-05: a "blocked" report records a real rejection-history entry so the
  // retry attempt counter + packet loop metadata stay truthful. Phase status
  // is NOT flipped and the decision journal is untouched (rejection-free note
  // semantics preserved); the entry only feeds attempt counting.
  // F2-21 (W37 Y3): the recorded note carries REPORT_BLOCK_MARKER — an agent's
  // self-reported block is labeled as such on every surface that renders it
  // (packet rejection-loop/prior-rejection lines, steering, console), never
  // presented as a human rejection. Pin re-point owed: report-intake.test.ts
  // :205/:209 assert the pre-marker bytes (for the test owner).
  const blockedNote = `${REPORT_BLOCK_MARKER}${report.summary}`;
  const phases: PhaseRecord[] = project.phases.map((p) =>
    p.id === phase && report.status === "blocked"
      ? {
          ...p,
          rejectionNote: blockedNote,
          rejectionHistory: [...(p.rejectionHistory ?? []), { note: blockedNote, at: now }],
        }
      : p,
  );

  // M-08: a "complete" report writes agent lessons back to memory — the first
  // real cross-run learning loop. One semantic row for the summary + one
  // episodic row per artifact, capped/deduped exactly like engine rows. Rows
  // now carry the E-18 provenance stamp source:"agent-report" (H43-P3-3 fix),
  // and the L2 lesson row (when the claimed phase gate is unmet) lands in the
  // same append BEFORE the slice(-80) so the cap stays uniform (98 §3 anti-noise).
  let memory = project.memory;
  if (report.status === "complete") {
    const rows: MemoryEntry[] = [
      {
        id: `report-semantic-${phase}-${fp8}`,
        kind: "semantic",
        phase,
        text: `${memoryPrefix}${report.summary}`.slice(0, 240),
        score: 0.7,
        source: "agent-report",
      },
      ...(report.artifacts ?? []).map((a, i) => ({
        id: `report-episodic-${phase}-${i}-${fp8}`,
        kind: "episodic" as const,
        phase,
        text: `${a.title}: ${a.body.slice(0, 200)}`,
        score: 0.6,
        source: "agent-report" as const,
      })),
      ...(l2Lesson ? [l2Lesson] : []),
    ];
    // H43-P2-1 (audit-43 P2-1, fixes/106): replacement semantics at THIS merge
    // site. Every row above is content-addressed (E-09), so an incoming row
    // whose id already exists in project.memory is byte-identical to the
    // stored row — the stored copy is authoritative and the incoming copy is
    // dropped BEFORE the merge. Without this filter, dedupeMemoryIds RENAMED
    // the incoming twin to `${id}-2`, forking a duplicate row that the 80-row
    // FIFO then used to evict a distinct row. The lesson row is the reachable
    // case: templateEmissionLesson is a pure function of (project, phase,
    // unmet), so two DIFFERENT complete reports landing on the same unmet gate
    // mint the SAME lesson id — the second apply must not fork a twin.
    // dedupeMemoryIds stays as defense-in-depth for the (astronomically rare)
    // fp8 prefix collision between two different contents.
    const existingIds = new Set<string>();
    for (const m of project.memory) {
      if (m && typeof m.id === "string" && m.id.length > 0) existingIds.add(m.id);
    }
    const fresh = rows.filter((r) => !existingIds.has(r.id));
    // 216i (112 §4.2 — T1): a re-minted LESSON row (the same signature id from
    // the same unmet gate on a later complete report) is a reproduction, not a
    // duplicate: the stored copy accrues reproducedCount + a visible
    // `lesson.reproduced` ledger row lands, while the incoming twin is STILL
    // dropped (non-lesson twins keep the H43-P2-1 drop-before-merge semantics).
    const lessonTwins = rows.filter((r) => existingIds.has(r.id) && isLessonMemoryId(r.id));
    const twin = lessonTwins[0] ?? null;
    const base = twin ? accrueReproducedCounts([...project.memory, ...lessonTwins]) : project.memory;
    if (twin) {
      logs.push({
        ts: now,
        phase,
        level: "info",
        event: "lesson.reproduced",
        detail: `L2 template-emission ${twin.id} reproduced (P${report.phase} DoD unmet again; reproducedCount=${
          base.find((m) => m.id === twin.id)?.reproducedCount ?? 0
        })`,
      });
    }
    memory = dedupeMemoryIds([...base, ...fresh]).slice(-80);
  }

  return {
    project: {
      ...project,
      phases,
      memory,
      artifacts: [...project.artifacts, ...artifacts],
      logs: [...project.logs, ...logs].slice(-200),
    },
    applied: true,
    reason: "new",
  };
}

/**
 * Project-only facade over applyReportResult (E-09 transition): callers that
 * only need the merged project (headless.ingest and legacy paths) keep the
 * plain-Project contract; store/CLI surfaces that must report idempotency use
 * applyReportResult.
 */
export function applyReport(project: Project, report: AgentReport): Project {
  return applyReportResult(project, report).project;
}
