import { PHASES, phaseCoverage, phaseCoverageLine } from "./phases.ts";
import type { PhaseCoverage } from "./phases.ts";
import { fnv1a, fusionRank } from "./algorithms.ts";
import { sandboxClaim } from "./sandbox.ts";
import type { MemoryEntry, PhaseDef, Project } from "./types.ts";

/**
 * Packet format version (T7/Q-303). v2 = version-stamped, ledger-aware, honest
 * copy. v3 (E-11/E-22) = the System JSON envelope adds agent capabilities, the
 * machine report_schema the ingest seam validates, and a corpus research_hash;
 * the prose output contract now asks for ONE JSON report per report_schema.
 */
export const PACKET_VERSION = 3;

/** R-207/Q-303: hard char budget for the assembled packet (never silently cut). */
const PACKET_MAX_CHARS = 14_000;
const TRUNC_MARKER = "…[TRUNCATED — regenerate at a HITL gate for the full plan]";
/** Fixes/106 (H3): the section the agent MUST still see after truncation — the
 *  machine report schema the ingest seam validates. A whole-document tail
 *  slice used to cut it (and the closing rules) off the end, leaving an agent
 *  14 KB of context with no required-output contract to report against. */
const REQUIRED_OUTPUT_HEADING = "\n## Required output schema\n";

/** Collapse whitespace and cap a note so ledger/loop rows stay one line (T2/T9). */
function quoteNote(note: string | undefined, cap: number): string {
  const clean = (note ?? "").replace(/\s+/g, " ").trim();
  return clean.length > cap ? `${clean.slice(0, cap)}…` : clean;
}

/** E-11: deterministic corpus fingerprint — FNV-1a over the sorted corpus URLs so an
 *  agent can detect corpus change between two packets without re-reading prose. */
function researchHash(project: Project): string {
  // H-04 (fixes/115): dedupe the URL set so a stray duplicate corpus entry can
  // never churn the fingerprint (the live layer now dedups at append, this is
  // the belt-and-suspenders packet-side guard).
  const urls = new Set<string>();
  for (const entry of project.research ?? []) {
    for (const item of entry?.items ?? []) {
      if (item?.url) urls.add(item.url);
    }
  }
  // No corpus → hash of the empty string (stable, distinguishable from any corpus).
  return String(fnv1a([...urls].sort().join("\n")));
}

/**
 * F2-84 (audit-43 P2-1 "duplicate-memory displacement" / audit B-12 residual):
 * count memory rows that share an id with a sibling row (Σ count−1 per id).
 * Engine merge sites mint unique ids via engine.dedupeMemoryIds, but payloads
 * that skipped that pass (persisted pre-fix localStorage, hand-edited exports,
 * imports whose duplicate rows survived repair) keep the collision until the
 * next merge — and fusionRank's duplicate-id guard collapses such rows, so the
 * packet must SAY so instead of silently dropping thoughts from the ranked view.
 * Deterministic: pure count over the given list.
 */
function countIdCollisions(rows: MemoryEntry[]): number {
  const counts = new Map<string, number>();
  for (const m of rows) {
    if (!m || typeof m.id !== "string" || m.id.length === 0) continue;
    counts.set(m.id, (counts.get(m.id) ?? 0) + 1);
  }
  let displaced = 0;
  for (const c of counts.values()) if (c > 1) displaced += c - 1;
  return displaced;
}

/** E-11: the machine AgentReport schema the ingest seam (report-intake.ts)
 *  validates — stated here so the packet and the validator can never drift. */
const REPORT_SCHEMA = {
  phase: "integer 0..12",
  status: '"complete" | "blocked" | "partial"',
  summary: "string (non-empty)",
  files: "string[] (optional)",
  tests_run: '{command: string, pass: boolean, evidence?: string}[] (optional)',
  artifacts: '{title: string, body: string, language?: string}[] (optional)',
};

/**
 * I7 — machine-readable envelope. A valid JSON object (decision ledger + per-phase
 * status/rejection/gate verdict + scorecard verdict) for downstream agents/tools to
 * parse without prose. Emitted as a fenced ```json block so the packet stays a single
 * paste-ready markdown document while a script can still extract + JSON.parse the body.
 */
function systemJson(
  project: Project,
  phase: PhaseDef,
  compiledAt: string,
  loop: { count: number; note: string | null },
  coverage: PhaseCoverage,
): string {
  // SWEEP-2 (esc-1): escape raw backticks as \u0060 so the envelope stays a
  // single parseable ```json block. JSON.stringify does NOT escape backticks,
  // and envelope strings are operator/agent-controlled (project name, decision
  // notes — a rejection note quoting a code fence is common), so a note
  // containing ``` used to close the markdown fence early and break every
  // fence-based extractor on the JSON body. \u0060 is a lossless JSON escape
  // (JSON.parse resolves it back to a backtick), and no literal-backtick-free
  // JSON text is altered.
  const envelope = JSON.stringify(
    {
      schema_version: 1,
      packet_version: PACKET_VERSION,
      compiled_at: compiledAt,
      project_id: project.id,
      name: project.name,
      project_status: project.status,
      current_phase: { id: phase.id, code: phase.code, title: phase.title, hitl_gate: phase.hitl },
      model_route: project.modelRoute,
      // E-11: what the agent may DO with this packet, not just what it is.
      capabilities: {
        ingest: true,
        verify: "config-gated",
        vault_search: true,
      },
      // E-11: the exact machine report shape the ingest seam validates.
      report_schema: REPORT_SCHEMA,
      research_hash: researchHash(project),
      sandbox: {
        claim: sandboxClaim(project.sandbox),
        ram_mb: project.sandbox.ramMb,
        timeout_s: project.sandbox.timeoutS,
        isolated: project.sandbox.isolated,
      },
      verdict: project.scorecard?.verdict ?? null,
      rejection_loop:
        loop.count >= 1
          ? { phase: phase.id, attempts: loop.count, last_note: quoteNote(loop.note ?? undefined, 300) }
          : null,
      decisions: project.decisions.map((d) => ({
        phase: d.phase,
        decision: d.decision,
        decided_by: d.decidedBy,
        note: d.note != null ? quoteNote(d.note, 200) : null,
        requested_at: d.requestedAt,
        decided_at: d.decidedAt,
      })),
      phases: project.phases.map((p) => ({
        id: p.id,
        status: p.status,
        rejections: p.rejectionHistory?.length ?? 0,
        gate_passed: p.gate ? p.gate.passed : null,
      })),
      // T-14 (106 §6, finding F-11): the honest coverage census — a run
      // stopped at P6 executed 7 of 13 phases and the P7–P12 tail produced 0
      // artifacts; the envelope states the real numbers so no machine consumer
      // reads the 13-entry phase list as "all 13 ran". Same census as the
      // "## Current edge" rail (one pure helper, one arithmetic).
      phase_coverage: {
        executed: coverage.executed,
        total: coverage.total,
        artifacts_from_p7_p12: coverage.tailArtifacts,
      },
    },
    null,
    2,
  );
  return envelope.replace(/`/g, "\\u0060");
}

/**
 * fixes/115 H-05: deterministic compiled_at — a pure function of the project.
 * The old wall-clock stamp (`new Date().toISOString()`) made every re-compile
 * of an unchanged graph rewrite the packet artifact body (and the persisted
 * export) with a spurious diff, breaking byte-idempotence at the packet
 * boundary (probe-det.ts: two compiles of the SAME project differed at the
 * `compiled_at` line). The stamp is now derived from the newest moment the
 * packet's own inputs last changed — project creation, the newest log row, or
 * the newest ledger decision — so an unchanged graph is byte-stable across
 * refresh/approve/execute re-stamps while the value still reads as "as of"
 * for a human (a stamp after an approval reflects the approval). Corrupt or
 * missing timestamps degrade to the epoch (deterministic + parseable) rather
 * than throwing, and the ms value is clamped into Date's valid range so a
 * hostile far-future createdAt can never make toISOString throw RangeError
 * mid-compile.
 */
function compiledAtFor(project: Project): string {
  let latest =
    typeof project.createdAt === "number" && Number.isFinite(project.createdAt)
      ? project.createdAt
      : 0;
  for (const row of project.logs ?? []) {
    if (row && typeof row.ts === "number" && Number.isFinite(row.ts) && row.ts > latest) {
      latest = row.ts;
    }
  }
  for (const d of project.decisions ?? []) {
    if (
      d &&
      typeof d.decidedAt === "number" &&
      Number.isFinite(d.decidedAt) &&
      d.decidedAt > latest
    ) {
      latest = d.decidedAt;
    }
  }
  // 8.64e15 ms = 275760-09-13 — Date's max; beyond it toISOString throws.
  return new Date(Math.min(latest, 8.64e15)).toISOString();
}

/** A4 — Agent Packet Compiler: turn the graph into a paste-ready agent prompt. */

/** Tier-1 seed row (fixes/144 M5-3): an OPTIONAL cross-project lesson row that
 *  joins the Ranked-memory fusionRank pool. packet.ts stays client-safe (no
 *  node:fs), so the seeds arrive pre-mapped by the server-side caller (the CLI
 *  `packet --knowledge` seam maps KnowledgeStore.injectProven output through
 *  knowledge.ts provenToLessonRow). Shape = fusionRank's output shape. Absent
 *  or empty → the Ranked-memory section is byte-identical to the legacy
 *  compile (in-project memory only). */
export type PacketProvenSeed = {
  id: string;
  kind: MemoryEntry["kind"];
  text: string;
  score: number;
};

export function compileAgentPacket(
  project: Project,
  opts?: { proven?: readonly PacketProvenSeed[] },
): string {
  // CORE-03 (defense-in-depth): never index PHASES[] with an unvalidated
  // currentPhase — hydrateProject clamps it, but a hand-built Project with a
  // corrupt value must fall back to P0 rather than crash mid-compile.
  const phase = PHASES[project.currentPhase] ?? PHASES[0];
  // T-14 (106 §6/F-11): one coverage census shared by the rail line and the
  // System JSON envelope — pure, derived from the project's own records and
  // artifact rows (never a hard-coded "13 phases ran").
  const coverage = phaseCoverage(project.phases, project.artifacts);
  const lattice = project.lattice;
  const schedule = project.schedule;
  const memoryRows = project.memory ?? [];
  // Tier-1 (fixes/144 M5-3): cross-project proven rows join the pool as
  // research-sourced pseudo-memory rows (E-18 cited boost + "lesson" tag —
  // LESSON_TAG literal mirrors knowledge.ts; packet.ts cannot import it
  // without dragging the disk module into the client graph). Malformed seeds
  // are skipped — a bad row must never brick packet compilation. When no
  // seeds are supplied the pool IS the memory array → byte-identical output.
  const provenRows: MemoryEntry[] = (Array.isArray(opts?.proven) ? opts!.proven! : [])
    .filter(
      (s): s is PacketProvenSeed =>
        !!s &&
        typeof s === "object" &&
        typeof s.id === "string" &&
        (s.kind === "episodic" || s.kind === "semantic" || s.kind === "procedural") &&
        typeof s.text === "string" &&
        Number.isFinite(s.score),
    )
    .map((s) => ({
      id: s.id,
      kind: s.kind,
      phase: 0,
      text: s.text,
      score: s.score,
      source: "research" as const,
      tags: ["lesson"],
    }));
  const rankPool = provenRows.length === 0 ? memoryRows : [...memoryRows, ...provenRows];
  const ranked = fusionRank(
    `${phase.title} ${project.brief} ${lattice?.jobs?.join(" ") ?? ""}`,
    rankPool,
    5,
  );
  // F2-84: the ranked-memory duplication guard — source rows that share an id
  // (see countIdCollisions) are collapsed to the top-ranked row per id inside
  // fusionRank; surface the collapse count so a dropped thought is never
  // silent. Zero on every healthy payload → byte-identical output for them.
  const idCollisions = countIdCollisions(memoryRows);
  // Fixes/106 (H3, audit-43 P2-1 residual): fusionRank's id guard does not
  // catch TEXT twins with distinct ids (the engine's pre-replacement
  // regeneration forks: `0-episodic-0.91` + `0-episodic-0.91-2` carry
  // byte-identical text), so each twin still took a ranked slot and the
  // packet's top-5 filled with the same sentence twice. Display-level
  // hygiene: collapse rows whose whitespace-normalized text is identical,
  // keeping the top-ranked copy (ranked arrives score-desc, so the first
  // occurrence per text is the best match — same replacement direction as
  // the merge-site fixes in report-intake), and say so out loud like the
  // id-collision guard. Empty-text rows are never collapse keys (they were
  // already unaddressable content). Zero on healthy payloads.
  const rankedTexts = new Set<string>();
  const displayRanked: { id: string; score: number; text: string; kind: MemoryEntry["kind"] }[] = [];
  let textTwins = 0;
  let provenTwins = 0;
  // Tier-1 (fixes/144 M5-3): the collapse counters must stay honest about the
  // pool — a dropped PROVEN seed is not a memory row, so it counts under its
  // own label instead of inflating the memory-row twin count.
  const provenIds = new Set(provenRows.map((m) => m.id));
  for (const m of ranked) {
    const key = m.text.replace(/\s+/g, " ").trim();
    if (key !== "" && rankedTexts.has(key)) {
      if (provenIds.has(m.id)) provenTwins += 1;
      else textTwins += 1;
      continue;
    }
    if (key !== "") rankedTexts.add(key);
    displayRanked.push(m);
  }
  // Tier-1 honest label counts seeds that actually RANKED INTO the view — a
  // seed that lost the top-5 cut is neither shown nor claimed.
  let displayedProven = 0;
  for (const m of displayRanked) {
    if (provenIds.has(m.id)) displayedProven += 1;
  }
  const artifacts = project.artifacts
    .filter((a) => a.kind !== "packet")
    .slice(-8)
    .map((a) => {
      const body = a.body.length > 900 ? `${a.body.slice(0, 900)}…` : a.body;
      return `### P${a.phase} · ${a.title}\n${body}`;
    })
    .join("\n\n");
  // M-06: live research citations survive outside the trimmed-artifact window.
  // H43-P2-5 (fixes/106): the packet view renders only the 5 NEWEST corpus
  // entries (5 items each) — an N-run project used to print <= 5N source
  // lines into every later packet (and every crew/chat context embedding it),
  // unbounded context bloat on research re-runs. Junk entries (null / missing
  // items on hand-built payloads) contribute nothing instead of throwing.
  const researchSources = (project.research ?? [])
    .slice(-5)
    .flatMap((entry) => (entry?.items ?? []).slice(0, 5).map((it) => `- ${it.title} — ${it.url}`))
    .join("\n");
  const hitl = project.hitl
    ? `PENDING HITL: ${project.hitl.title}\n${project.hitl.prompt}\nStakes: ${project.hitl.stakes}`
    : "No pending HITL.";
  // T2/Q-303: append-only decision journal → one row per decision (rejects quote the note).
  const ledgerRows = project.decisions.map((d) => {
    const when = new Date(d.decidedAt).toISOString();
    const base = `- P${d.phase} · ${d.decision} · ${d.decidedBy} · ${when}`;
    return d.decision === "reject" ? `${base} — "${quoteNote(d.note, 200)}"` : base;
  });
  // T9/B-04: if the CURRENT phase is in a rejection loop, say so with attempt count + last note.
  const curRecord = project.phases.find((p) => p.id === project.currentPhase);
  const loopCount = curRecord?.rejectionHistory?.length ?? 0;
  const lastLoopNote =
    loopCount > 0 ? (curRecord!.rejectionHistory![loopCount - 1]?.note ?? null) : null;
  // B-04/Q-303: the free-form prior-rejection dump becomes a compact pointer once the ledger
  // can back it; legacy payloads (rejectionNote without ledger rows) keep the detail lines.
  const priorRejected = project.phases.filter(
    (p) => Boolean(p.rejectionNote) || (p.rejectionHistory?.length ?? 0) > 0,
  );
  const hasRejectDecisions = project.decisions.some((d) => d.decision === "reject");
  const priorBlock = priorRejected.length
    ? hasRejectDecisions
      ? `Prior rejections: see "## Decision ledger (HITL)" below.`
      : `Prior rejection notes:\n${priorRejected
          .map((p) => {
            const h = p.rejectionHistory ?? [];
            return `- P${p.id}: ${p.rejectionNote ?? (h.length ? h[h.length - 1].note : "(recorded)")}`;
          })
          .join("\n")}`
    : "";
  // H-05 (fixes/115): deterministic — derived from project state, never wall clock.
  const compiledAt = compiledAtFor(project);
  const sysJson = systemJson(project, phase, compiledAt, { count: loopCount, note: lastLoopNote }, coverage);

  const notes = (project.notes ?? "").trim();
  // BUG WAVE 27: empty collections must render an explicit "(none)" placeholder —
  // a bare heading immediately followed by the next heading reads as an empty
  // section whose "content" is the next section's heading (crew/oracle/contracts
  // are all [] until algorithms run; brief can be empty on imported payloads).
  const briefText = project.brief.trim();
  const crewRows = (project.crew ?? []).map(
    (c) => `- ${c.role}${c.active ? " [ACTIVE]" : ""} (${c.budgetTokens} tok): ${c.mandate} → ${c.handoff}`,
  );
  const contractRows = [
    ...(project.contracts?.entities ?? []).map(
      (e) => `- ${e.name}: ${e.fields.map((f) => `${f.name}:${f.type}`).join(", ")}`,
    ),
    ...(project.contracts?.endpoints ?? []).map((e) => `- ${e.method} ${e.path} (${e.job})`),
  ];
  const oracleRows = (project.oracle ?? []).slice(0, 8).map((t) => `- ${t.name}: ${t.given} ⇒ ${t.expect}`);
  const full = [
    `# RapidTool Agent Packet v${PACKET_VERSION} — ${project.name}`,
    ``,
    `## System`,
    `packet_version: ${PACKET_VERSION}`,
    `compiled_at: ${compiledAt}`,
    `project_id: ${project.id}`,
    `You are a governed implementation agent for RapidTool. You do not skip phases.`,
    `You may only work the current phase (${phase.code} ${phase.title}) unless the human approved an earlier HITL gate.`,
    `Illegal graph jumps, unsigned deploys, and tool calls outside user scope are forbidden.`,
    `If a test fails, capture the traceback and patch under schema lock. Do not invent APIs.`,
    ``,
    `## System JSON (machine-readable)`,
    "```json",
    sysJson,
    "```",
    ``,
    `## Mission`,
    briefText || "(no brief supplied — see operator notes and the intent lattice below)",
    ...(notes
      ? [
          ``,
          `## Operator notes (human steering)`,
          `These override earlier instructions.`,
          notes,
        ]
      : []),
    ``,
    `## Intent lattice (A1)`,
    `Domain: ${project.domain}`,
    `Jobs: ${(lattice?.jobs ?? []).join(", ") || "unspecified"}`,
    `Entities: ${(lattice?.entities ?? []).join(", ") || "unspecified"}`,
    `Constraints: ${(lattice?.constraints ?? []).join(", ") || "none declared"}`,
    `Complexity: ${typeof lattice?.complexity === "number" ? lattice.complexity.toFixed(1) : "n/a"} / 10`,
    ``,
    `## Scheduler (A3)`,
    `Tightness ${schedule?.tightness ?? "n/a"} · security Δ${schedule?.securityDelta ?? 0} · api Δ${schedule?.apiDelta ?? 0}`,
    ...(schedule?.notes ?? []).map((n) => `- ${n}`),
    `Extra HITL: ${schedule?.extraHitl.length ? schedule.extraHitl.map((p) => `P${p}`).join(", ") : "none"}`,
    ``,
    `## Crew (A8)`,
    ...(crewRows.length ? crewRows : ["(crew not yet assembled)"]),
    ``,
    `## Spec graph order (A5)`,
    (project.specGraph?.order ?? [])
      .map((id) => {
        const n = project.specGraph?.nodes.find((x) => x.id === id);
        return n ? `- [${n.owner}] ${n.file} — ${n.purpose}` : `- ${id}`;
      })
      .join("\n") || "(run algorithms first)",
    ``,
    `## Contracts (A6)`,
    ...(contractRows.length ? contractRows : ["(no data contracts yet)"]),
    ``,
    `## Oracle (A7)`,
    ...(oracleRows.length ? oracleRows : ["(no oracle tests yet)"]),
    ``,
    `## Current edge`,
    `${phase.code} — ${phase.title}`,
    phase.summary,
    `Status: ${project.status} · model: ${project.modelRoute}`,
    `Execution: ${sandboxClaim(project.sandbox)}`,
    // T-14 (106 §6, finding F-11): honest phase coverage in the rail. The
    // shipped end-to-end run executed 7 of 13 phases and the strictly linear
    // graph left P7–P12 at 0 artifacts — this line reports the real census so
    // no surface (packet, machine consumer, human reader) implies all 13 ran.
    `Phase coverage: ${phaseCoverageLine(coverage)} — strictly linear graph; unexecuted phases are not implied complete (the current edge is the only enterable phase).`,
    hitl,
    priorBlock,
    project.lastTest ? `P6 template self-test (last run): ${project.lastTest.ok ? "pass" : "FAIL"} — ${project.lastTest.detail}` : "",
    project.scorecard ? `Verdict: ${project.scorecard.verdict}` : "",
    ...(ledgerRows.length
      ? [`## Decision ledger (HITL)`, ledgerRows.join("\n")]
      : []),
    ...(loopCount >= 1
      ? [
          `## Rejection loop`,
          `P${phase.id} retry attempt #${loopCount} after ${loopCount} rejection(s). Last rejection note: "${quoteNote(lastLoopNote ?? undefined, 300)}"`,
        ]
      : []),
    ``,
    `## Ranked memory (A2 FusionRank)`,
    memoryRows.length === 0 && provenRows.length === 0
      ? "(empty — treat Phase 0 research as first write)"
      : displayRanked.length === 0
        ? "(no rankable memory rows — every row is malformed or empty)"
        : [
            // Fixes/106 (H3): each row renders through quoteNote — whitespace
            // collapsed, hard-capped at 400 chars with an ellipsis. H43-P2-2
            // left the packet as the last unbounded echo of an oversized row
            // (a paste-length rejection note ranked verbatim into every later
            // prompt); the render site now caps what any row can inject into
            // the agent's context, whatever its provenance. Byte-identical
            // for rows already within the cap.
            ...displayRanked.map(
              (m, i) => `${i + 1}. [${m.kind} ${m.score.toFixed(3)}] ${quoteNote(m.text, 400)}`,
            ),
            // F2-84 honest label: id collisions were collapsed by the guard — say
            // so instead of presenting a short list as the full top-5.
            ...(idCollisions > 0
              ? [
                  `(id-collision guard: ${idCollisions} memory row(s) shared an id with a sibling and were collapsed to the top-ranked row per id — re-run the owning phase to mint unique ids)`,
                ]
              : []),
            // Fixes/106 (H3): byte-identical text twins with distinct ids were
            // collapsed above — never present a short list as the full top-5.
            ...(textTwins > 0
              ? [
                  `(duplicate-text collapse: ${textTwins} row(s) shared byte-identical text with a sibling and were collapsed to the top-ranked copy per text — re-run the owning phase to mint unique rows)`,
                ]
              : []),
            // Tier-1 (fixes/144 M5-3): a proven seed twin is NOT a memory row —
            // its own honest label, and never folded into the memory count.
            ...(provenTwins > 0
              ? [
                  `(tier-1 duplicate-text collapse: ${provenTwins} seed row(s) shared byte-identical text with a sibling and were collapsed to the top-ranked copy per text)`,
                ]
              : []),
            ...(displayedProven > 0
              ? [
                  `(tier-1: ${displayedProven} cross-project accepted lesson row(s) from the configured knowledge store ranked into this view — advisory; the packet never auto-applies knowledge to a project)`,
                ]
              : []),
          ].join("\n"),
    ``,
    `## Scorecard`,
    project.scorecard
      ? [
          `(deterministic feasibility estimate — template-derived, not live research)`,
          `Overall ${project.scorecard.overall}/10 (${project.scorecard.verdict})`,
          ...project.scorecard.axes.map((a) => `- ${a.label}: ${a.score}/10 — ${a.note}`),
          `Bottlenecks: ${project.scorecard.bottlenecks.join("; ")}`,
          `Attack vectors: ${project.scorecard.attackVectors.join("; ")}`,
        ].join("\n")
      : "Not written — run Phase 0 first.",
    ``,
    `## Artifacts (trimmed)`,
    artifacts || "(none yet)",
    ``,
    researchSources
      ? `## Research sources (live)\n${researchSources}\n\n> Fetched by RapidTool — cite these, do not invent sources.`
      : "",
    project.adr ? `## ADRs\n${project.adr}` : "",
    project.openapi ? `## OpenAPI\n${project.openapi}` : "",
    ``,
    `## Required output schema`,
    `Return your work as ONE JSON report matching report_schema (see ## System JSON above) — the ingest seam validates this exact shape.`,
    `The five markdown headings (Phase work / Files / Patch / Tests / Risks) remain the recommended structure of your artifacts' bodies for human review.`,
    project.currentPhase >= 12
      ? `Next legal edge: none — pipeline complete.`
      : `Next legal edge — only P${project.currentPhase + 1} if this phase completes`,
    ``,
    `Do not emit secrets. Do not widen OAuth scopes. Do not deploy without HITL on P9.`,
  ];

  // BUG WAVE 27: the old `.filter((line) => line !== "")` removed EVERY section
  // separator — the "" items that produce blank lines between sections — so the
  // packet rendered as a wall of text with headings glued to the previous
  // section's last line (e.g. "...Do not invent APIs.\n## System JSON") and no
  // blank-line boundary for naive section parsers. Join normally (each ""
  // separator yields one blank line) and collapse any 3+ newline runs that
  // arise from conditional "" items (research/ADR/OpenAPI absent) or content
  // with trailing newlines.
  const assembled = full.join("\n").replace(/\n{3,}/g, "\n\n");

  // R-207/Q-303: never silently cut — a truncated packet says so out loud.
  // Fixes/106 (H3): the cut is now budget-aware (see truncateToBudget) so the
  // required-output schema survives.
  if (assembled.length > PACKET_MAX_CHARS) {
    return truncateToBudget(assembled);
  }
  return assembled;
}

/**
 * Fixes/106 (H3): budget-aware packet truncation. When the assembled packet
 * exceeds PACKET_MAX_CHARS, the old whole-document tail-slice could cut the
 * "## Required output schema" section (the machine report contract the ingest
 * seam validates) off the end — an agent could receive the full budget of
 * context with no required-output schema to report against. Now the invariant
 * tail (required-output section + closing rules) is preserved WHOLE and the
 * cut falls on the content sections before it, at the last "\n\n" section
 * boundary that fits (or at the budget with the partial trailing line dropped
 * when no section boundary fits). The result never exceeds the budget, the
 * marker says so out loud, and the whole function is deterministic — a pure
 * function of the assembled string.
 */
function truncateToBudget(assembled: string): string {
  const headingAt = assembled.indexOf(REQUIRED_OUTPUT_HEADING);
  if (headingAt === -1) {
    // No schema section (future format drift): legacy whole-document cut.
    return `${assembled.slice(0, PACKET_MAX_CHARS)}\n${TRUNC_MARKER}`;
  }
  const tail = assembled.slice(headingAt); // "\n## Required output schema\n…" through the end
  const markerBlock = `\n\n${TRUNC_MARKER}\n`;
  const budget = PACKET_MAX_CHARS - tail.length - markerBlock.length;
  if (budget <= 0) {
    // Tail + marker alone over budget (pathological): degrade to the legacy
    // cut rather than emit a schema-less head or an over-budget document.
    return `${assembled.slice(0, PACKET_MAX_CHARS)}\n${TRUNC_MARKER}`;
  }
  const head = assembled.slice(0, headingAt);
  // Cut at the last section boundary that fits (>= half the budget); without
  // one, cut at the budget and drop the partial trailing line.
  const boundaryAt = head.lastIndexOf("\n\n", budget);
  const cutAt = boundaryAt >= Math.floor(budget / 2) ? boundaryAt : budget;
  let cut = head.slice(0, cutAt);
  if (cutAt === budget) cut = cut.replace(/\n[^\n]*$/, "");
  return `${cut}${markerBlock}${tail}`;
}

// ---------------------------------------------------------------------------
// Handoff export profiles (pillar 3 — fixes/64_pillars_prompt.md).
//
// Pure, deterministic directive wrappers that turn a compiled Agent Packet
// (compileAgentPacket output) into the tool-specific prompt each downstream
// coding agent expects: Claude Code CLI step plans, Cursor @-file references,
// Cline custom-instruction framing, Aider file-diff scoping, Devin session
// tickets, GitHub Copilot Chat/workspace instructions.
//
// Contract:
// - wrap(packet, project) is a PURE function of its two arguments — no dates,
//   no randomness, no id/createdAt leakage — so identical inputs always yield
//   byte-identical output (the "## System JSON" block inside the packet keeps
//   its own compiled_at; wrappers never re-stamp).
// - The packet body is embedded VERBATIM (never restated, never summarized).
// - Nothing here claims files exist on the operator's machine: repo-file
//   mentions (AGENTS.md, .clinerules/, rapidtool-packet.md) are phrased as
//   conditional instructions ("when/if your repo …"), and the spec-graph file
//   scope is drawn from the project's own data or an explicit fallback line.
// - Additive only: compileAgentPacket / PACKET_VERSION are untouched.
// ---------------------------------------------------------------------------

/** The six downstream coding tools exportProfiles covers. */
export type ExportProfileId =
  | "claude-code"
  | "cursor"
  | "cline"
  | "aider"
  | "devin"
  | "copilot";

/** One downstream-tool wrapper: display name + pure packet wrapper. */
export type ExportProfile = {
  name: string;
  wrap(packet: string, project: Project): string;
};

/** Deterministic current-edge label — same PHASES fallback as compileAgentPacket. */
function profileEdge(project: Project): PhaseDef {
  return PHASES[project.currentPhase] ?? PHASES[0];
}

/**
 * Spec-graph file scope in graph order (deduped, first occurrence wins).
 * Empty when the project has no spec graph yet — callers fall back honestly.
 */
function profileScopeFiles(project: Project): string[] {
  const order = project.specGraph?.order ?? [];
  const nodes = project.specGraph?.nodes ?? [];
  const files: string[] = [];
  for (const id of order) {
    const n = nodes.find((x) => x.id === id);
    if (n?.file && !files.includes(n.file)) files.push(n.file);
  }
  return files;
}

const EMPTY_PACKET_LINE =
  "(empty packet — run compileAgentPacket(project) first, then wrap again)";

const REPORT_LINE =
  "Print ONE JSON report matching the report_schema inside the packet's \"## System JSON\" block (fields: phase, status, summary, files, tests_run, artifacts). No prose wrapper around it.";

/** Shared "## Packet (verbatim — governs)" body. */
function packetSection(packet: string): string {
  const body = packet.trim() ? packet : EMPTY_PACKET_LINE;
  return [`## Packet (verbatim — governs)`, body].join("\n");
}

/** Shared "## File scope" body — a scope list or an honest fallback line. */
function scopeSection(project: Project, lead: string): string {
  const files = profileScopeFiles(project);
  const body =
    files.length > 0
      ? files.map((f) => `- ${f}`).join("\n")
      : "(no spec-graph file scope recorded — ask the operator which files the current edge owns, and restrict every edit to exactly those)";
  return [`## File scope`, `${lead}`, body].join("\n");
}

export const exportProfiles: Record<ExportProfileId, ExportProfile> = {
  "claude-code": {
    name: "Claude Code",
    wrap(packet: string, project: Project): string {
      const edge = profileEdge(project);
      return [
        `# Claude Code handoff — ${project.name}`,
        ``,
        `## Session framing`,
        `Resuming governed project "${project.name}" at ${edge.code} — ${edge.title} (pipeline phases 0..12). Work ONLY this edge; illegal graph jumps and unsigned deploys are forbidden by the packet.`,
        `The packet below is the governing contract. Do not restate it — work from it.`,
        ``,
        `## Claude Code mechanics`,
        `1. Produce a step plan before editing: the ordered steps this edge requires, executed one at a time.`,
        `2. Run in the project working directory. Use plan mode for the first pass; take edit actions only when the step plan names them.`,
        `3. Headless equivalent: save this file (e.g. rapidtool-packet.md) and feed it to a non-interactive session (\`claude -p\`) as the prompt/context.`,
        `4. Keep every change minimal and inside the file scope below; never reformat unrelated code.`,
        `5. When the edge is done, run the oracle tests the packet lists; on failure capture the traceback and patch under the packet's rules.`,
        ``,
        scopeSection(project, "Edits stay inside these spec-graph files (add more only when the next edge requires it):"),
        ``,
        packetSection(packet),
        ``,
        `## Required report`,
        REPORT_LINE,
      ].join("\n");
    },
  },
  cursor: {
    name: "Cursor",
    wrap(packet: string, project: Project): string {
      const edge = profileEdge(project);
      return [
        `# Cursor handoff — ${project.name}`,
        ``,
        `## Session framing`,
        `Resuming governed project "${project.name}" at ${edge.code} — ${edge.title} (pipeline phases 0..12). Work ONLY this edge; illegal graph jumps and unsigned deploys are forbidden by the packet.`,
        ``,
        `## Cursor mechanics`,
        `1. Paste the packet into Composer (Agent mode) as the governing context — or save it as a project rule file and @-reference it.`,
        `2. @-reference the packet file and every file in the file scope below so Composer indexes exactly those files; @-reference @AGENTS.md too, when your repo has one.`,
        `3. Work ONLY the current edge (${edge.code}); refuse suggestions that jump phases or widen the file scope.`,
        `4. Use Apply/Edit for single-file changes and Agent mode for multi-file changes; keep every accepted edit inside the scope.`,
        `5. When the edge is done, run the oracle tests from the packet in the integrated terminal before reporting.`,
        ``,
        scopeSection(project, "@-reference each of these spec-graph files:"),
        ``,
        packetSection(packet),
        ``,
        `## Required report`,
        REPORT_LINE,
      ].join("\n");
    },
  },
  cline: {
    name: "Cline",
    wrap(packet: string, project: Project): string {
      const edge = profileEdge(project);
      return [
        `# Cline handoff — ${project.name}`,
        ``,
        `## Session framing`,
        `Resuming governed project "${project.name}" at ${edge.code} — ${edge.title} (pipeline phases 0..12). Work ONLY this edge; illegal graph jumps and unsigned deploys are forbidden by the packet.`,
        ``,
        `## Cline mechanics`,
        `1. Open Cline in the project workspace and paste the packet as the task prompt; start in Plan mode.`,
        `2. To make the governance persist across tasks, add the packet's rules to Cline's custom instructions (a .clinerules/ file or CLAUDE.md, when your repo uses them) and keep the per-edge packet as the task.`,
        `3. Approve only the file edits the scope below lists; reject tool calls that touch anything else.`,
        `4. Run the oracle tests from the packet with Cline's terminal tool before reporting the edge complete.`,
        ``,
        scopeSection(project, "Edit approval is restricted to these spec-graph files:"),
        ``,
        packetSection(packet),
        ``,
        `## Required report`,
        REPORT_LINE,
      ].join("\n");
    },
  },
  aider: {
    name: "Aider",
    wrap(packet: string, project: Project): string {
      const edge = profileEdge(project);
      const files = profileScopeFiles(project);
      const command =
        files.length > 0
          ? `aider --read rapidtool-packet.md ${files.join(" ")}`
          : "aider --read rapidtool-packet.md";
      const commandNote =
        files.length > 0
          ? "The scope files are the EDIT set: aider may only modify them."
          : "(no spec-graph file scope recorded — ask the operator which files the current edge owns, and pass exactly those to --file)";
      return [
        `# Aider handoff — ${project.name}`,
        ``,
        `## Session framing`,
        `Resuming governed project "${project.name}" at ${edge.code} — ${edge.title} (pipeline phases 0..12). Work ONLY this edge; illegal graph jumps and unsigned deploys are forbidden by the packet.`,
        ``,
        `## Aider mechanics (file-diff scoping)`,
        `1. Start aider in the project working directory with the packet as read-only context and the scope files as the only editable set:`,
        `   ${command}`,
        `   ${commandNote}`,
        `2. Never let aider touch files outside the edit set — add a file only when the current edge's spec-graph node demands it.`,
        `3. Keep each change one minimal unit diff: no reformatting, no drive-by renames, no unrelated fixes.`,
        `4. Run the oracle tests from the packet (aider's run command) after the diff; a failing test means another unit diff, not a bypass.`,
        ``,
        scopeSection(project, "Editable files (spec-graph order):"),
        ``,
        packetSection(packet),
        ``,
        `## Required report`,
        REPORT_LINE,
      ].join("\n");
    },
  },
  devin: {
    name: "Devin",
    wrap(packet: string, project: Project): string {
      const edge = profileEdge(project);
      return [
        `# Devin handoff — ${project.name}`,
        ``,
        `## Session framing`,
        `This is a governed implementation task: "${project.name}" is at ${edge.code} — ${edge.title} (pipeline phases 0..12). Work ONLY this edge; illegal graph jumps, unsigned deploys, account creation and out-of-scope file edits are forbidden by the packet.`,
        ``,
        `## Devin mechanics`,
        `1. Create the Devin session with the packet below pasted as the task description (or attach it as session knowledge, e.g. saved as rapidtool-packet.md).`,
        `2. Break the current edge into steps and execute them in order; pause for the human whenever the packet names a HITL gate or a decision the packet does not already settle.`,
        `3. Keep all edits inside the file scope below; do not "helpfully" widen scope.`,
        `4. Run the oracle tests from the packet before the edge is done; report failures honestly with the traceback.`,
        `5. Finish by printing the required report JSON as the session summary — no deployment steps.`,
        ``,
        scopeSection(project, "Edit scope (spec-graph files for this project):"),
        ``,
        packetSection(packet),
        ``,
        `## Required report`,
        REPORT_LINE,
      ].join("\n");
    },
  },
  copilot: {
    name: "GitHub Copilot",
    wrap(packet: string, project: Project): string {
      const edge = profileEdge(project);
      return [
        `# GitHub Copilot handoff — ${project.name}`,
        ``,
        `## Session framing`,
        `Resuming governed project "${project.name}" at ${edge.code} — ${edge.title} (pipeline phases 0..12). Work ONLY this edge; illegal graph jumps and unsigned deploys are forbidden by the packet.`,
        ``,
        `## Copilot mechanics`,
        `1. Open Copilot Chat in the repository (or start an Edit session) and paste the packet as the governing context — or keep the rules as workspace instructions (.github/copilot-instructions.md) when your repo uses them, with the packet attached per task.`,
        `2. Use @workspace to scope indexing to the repository and ask Copilot to work ONLY ${edge.code}; reject suggestions that jump phases.`,
        `3. Review every suggested edit against the file scope below before accepting; accept nothing outside it.`,
        `4. Run the oracle tests from the packet in the terminal, then have Copilot summarize the diff.`,
        ``,
        scopeSection(project, "Accept suggestions only inside these spec-graph files:"),
        ``,
        packetSection(packet),
        ``,
        `## Required report`,
        REPORT_LINE,
      ].join("\n");
    },
  },
};
