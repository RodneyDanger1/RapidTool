// ---------------------------------------------------------------------------
// Per-phase handoff prompts (pure, unit-tested) — handoff.ts
//
// phaseHandoff(project, phase) compiles a concise, paste-ready prompt a coding
// agent can drop into its own context to work ONE phase. It pulls:
//   - role + mission from the project brief,
//   - context from the prior phases' artifacts (titles + trimmed bodies),
//   - the phase's deliverable from the phase registry,
//   - the machine-checkable DoD exit criteria (dod.ts runGate / DOD registry),
//   - constraints from the intent lattice + constraint scheduler.
//
// It is pure (no store, no DOM) and deterministic apart from the project's own
// content, so it runs under `node --experimental-strip-types --test`.
// ---------------------------------------------------------------------------
import { DOD, runGate } from "./dod.ts";
import { PHASE_LAST, phaseDef } from "./phases.ts";
import type { PhaseId, Project } from "./types.ts";

/** Collapse internal whitespace and cap a line for one-line context rows. */
function oneLine(s: string, cap = 240): string {
  return s.replace(/\s+/g, " ").trim().slice(0, cap);
}

/** 339-5 (Packet): the emitted scaffold always materializes the spec-graph
 *  `tests` node at this fixed path (`scaffold.ts` TREE_RESERVED), whatever
 *  `file` text the node carries, so the handoff names the contract path the
 *  emitter actually writes rather than a node's raw `file`. Mirrors packet.ts. */
const EMITTED_ORACLE_SPEC = "tests/oracle.spec.ts";

/**
 * F3 sweep: artifact rows that pass the shape guard can still carry
 * WRONG-TYPE scalar fields (a hand-edited import can hold `body: 42` or an
 * object where the JSON schema says string — hydration repairs engine-written
 * state, but phaseHandoff is also called on foreign objects). Prompt
 * generation must never throw on one bad row, so every interpolated field is
 * coerced through text(): strings pass through untouched, null/undefined
 * become "" (the "(untitled)" fallback path), anything else is String()-ed.
 */
function text(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "";
  return String(v);
}

/**
 * 346 L3 (A1-12): the recorded token-path truth for a decision, rendered
 * honestly. A `tokenPath:false` row is NOT necessarily a machine seat — the
 * browser console (346) is an UNATTESTED human seat with no out-of-band token
 * path, and calling it a "machine seat" would be a false provenance read.
 * Branch on the recorded label: only `human/console` gets the console clause;
 * every other `tokenPath:false` row keeps the byte-identical machine wording.
 * A `human/…` label that is not the console implies an inconsistent row (the
 * CLI human seat always carries the token path) — render it as unverified,
 * never as a machine seat.
 *
 * 346 lane-6: the clause is a CROSS-CHECK, not a read of the `via` object in
 * isolation. `decidedVia` is persisted (a hand-edited/pasted project can carry
 * a forged one), so a `tokenPath:true` claim is honoured only when the row's
 * own actor is `human` AND the label is the token-verifiable CLI seat — never
 * because a machine row merely asserts the flag. A `human/…` label on a
 * non-human actor is a provenance mismatch and renders as unverified. This
 * mirrors dod.ts `provenanceConsistent` (which fails the gate closed on the
 * same contradiction) so the pasted prompt cannot outrun the gate.
 */
function tokenPathClause(via: { tokenPath: boolean; label: string }, decidedBy: string): string {
  const humanLabel = via.label.startsWith("human/");
  if (via.tokenPath) {
    return via.label === "human/human-cli-i-am-human" && decidedBy === "human"
      ? "out-of-band token path verified"
      : "token path claimed for a seat that cannot carry one — not verified";
  }
  if (humanLabel && decidedBy !== "human") {
    return `provenance mismatch (recorded seat "${via.label}" vs actor "${decidedBy}") — not verified`;
  }
  if (via.label === "human/console") return "unattested console human seat — no out-of-band token";
  if (humanLabel) return "human seat — token path not verified";
  return "machine seat — no token path claimed";
}

export function phaseHandoff(project: Project, phase: PhaseId): string {
  const def = phaseDef(phase);

  // W-16: phaseHandoff is also called on foreign objects (console paste flows /
  // hand-edited imports) — a null / non-object project must yield an honest
  // minimal prompt, never a TypeError from the field reads below.
  if (!project || typeof project !== "object") {
    return [
      `# ${def.code} ${def.title} — agent handoff`,
      "Project: (no project record)",
      "",
      "## Mission",
      "(no brief recorded)",
    ].join("\n");
  }

  // Defensive element guard: hydration only guarantees the artifacts ARRAY is
  // an array, not that every row is a well-formed artifact (a hand-edited or
  // foreign import can carry null/garbage rows). Prompt generation must never
  // throw on one bad row — skip it like engine.ts A15 skips unknown memory.
  const priorArts = (project.artifacts ?? [])
    .filter(
      (a) =>
        a !== null &&
        typeof a === "object" &&
        typeof (a as { phase?: unknown }).phase === "number" &&
        (a as { phase: number }).phase < phase,
    )
    .slice(-6);
  const gate = runGate(project, phase);
  // 339-5 (Packet): for a red row render the unmet item's AUGMENTED `criterion`.
  // dod.ts (339-3) appends a state line to a failed state-probed criterion (the
  // deterministic-floor p6-brief-fit) and drops it from the bare registry item,
  // so reading only `item.criterion` printed the static label and discarded the
  // state. The [x]/[ ] flag still comes from the unmet id set; the machine
  // envelope is untouched (the checklist is prose).
  const unmetById = new Map(gate.unmet.map((g) => [g.id, g]));
  const criteria = (DOD[phase] ?? []).map((item) => {
    const u = unmetById.get(item.id);
    return { criterion: u?.criterion ?? item.criterion, met: !u };
  });

  const lattice = project.lattice;
  const schedule = project.schedule;
  const constraints = lattice?.constraints ?? [];

  // CORE sweep (58_ready_core): a corrupt/truncated persisted schedule (e.g. a
  // hand-edited import carrying `schedule: {}` or a string) must never throw
  // prompt generation — the block below unconditionally reads
  // `schedule.extraHitl.length`. Treat anything without the SchedulerPlan
  // array fields as absent (the same junk-row stance as the artifact guard
  // above); hydrated payloads are repaired upstream in hydrateProject, this
  // guard covers direct foreign objects.
  const sched =
    schedule !== null &&
    schedule !== undefined &&
    typeof schedule === "object" &&
    !Array.isArray(schedule) &&
    typeof (schedule as { tightness?: unknown }).tightness === "number" &&
    Array.isArray((schedule as { extraHitl?: unknown }).extraHitl)
      ? (schedule as NonNullable<Project["schedule"]>)
      : null;

  const out: string[] = [];

  out.push(`# ${def.code} ${def.title} — agent handoff`);
  out.push(`Project: ${project.name}`);
  out.push(``);
  out.push(`## Role`);
  out.push(
    `You are a governed implementation agent for RapidTool working only ${def.code} (${def.title}). ` +
      `Later phases are out of scope and illegal graph jumps are rejected.`,
  );
  out.push(``);
  out.push(`## Mission`);
  // W-16: the brief is coerced like every other interpolated field (text() at
  // the top of this file) — a junk brief must not throw out of prompt gen.
  out.push(text(project.brief).trim() || "(no brief recorded)");
  out.push(``);
  out.push(`## Context from prior phases`);
  if (priorArts.length > 0) {
    for (const a of priorArts) {
      out.push(
        `- P${a.phase} · ${text(a.kind) || "?"} · ${text(a.title) || "(untitled)"}: ${oneLine(text(a.body))}`,
      );
    }
  } else {
    out.push(`(none — ${def.code} is the first phase)`);
  }
  out.push(``);
  out.push(`## Deliverable`);
  out.push(def.summary);
  out.push(``);
  out.push(`## Exit criteria (DoD)`);
  out.push(`Gate ${def.code}: ${gate.pass ? "PASS" : "FAIL"} (${gate.unmet.length} unmet)`);
  // F2-20 (W37 Y3): the gate line above is the DoD PROBE verdict — it carries
  // no attribution. When the decision ledger holds a row for this phase, name
  // the newest one (the same newest-wins read dod.ts:approvalActor documents)
  // with its seat provenance + token-path truth, so a pasted handoff never
  // reads as an unattributed "PASS". Additive: phases without a decision row
  // render byte-identically.
  const phaseDecisions = (project.decisions ?? []).filter((d) => d && d.phase === phase);
  const lastDecision = phaseDecisions[phaseDecisions.length - 1];
  if (lastDecision) {
    const via = lastDecision.decidedVia;
    const actor = via?.label ? text(via.label) : text(lastDecision.decidedBy);
    const viaClause = via
      ? ` · via ${text(via.action)} on ${text(via.resource)} (${tokenPathClause(via, text(lastDecision.decidedBy))})`
      : "";
    // Hostile/missing stamps degrade to no timestamp, never a throw (the
    // never-throw prompt contract at the top of this file); the ms value is
    // clamped into Date's valid range so a far-future stamp cannot RangeError.
    const ms = lastDecision.decidedAt;
    const stamp =
      typeof ms === "number" && Number.isFinite(ms)
        ? ` · ${new Date(Math.min(Math.max(ms, -8.64e15), 8.64e15)).toISOString()}`
        : "";
    out.push(
      `Last recorded ${def.code} decision: ${text(lastDecision.decision)} · ${actor}${viaClause}${stamp}`,
    );
  }
  for (const c of criteria) {
    out.push(`- [${c.met ? "x" : " "}] ${c.criterion}`);
  }
  out.push(``);
  out.push(`## Constraints`);
  if (constraints.length > 0) {
    for (const c of constraints.slice(0, 8)) out.push(`- ${c}`);
  } else {
    out.push(`- (none declared)`);
  }
  if (sched) {
    out.push(
      `- Scheduler: tightness ${sched.tightness} · security Δ${sched.securityDelta} · api Δ${sched.apiDelta}`,
    );
    for (const n of (sched.notes ?? []).slice(0, 4)) out.push(`- ${n}`);
    if (sched.extraHitl.length > 0) {
      out.push(`- Extra HITL: ${sched.extraHitl.map((p) => `P${p}`).join(", ")}`);
    }
  }
  out.push(``);
  out.push(`## Expected output`);
  // E-22: the ingest seam validates ONE JSON AgentReport (report-intake.ts), so
  // the handoff must ask for JSON — the five markdown headings remain only the
  // recommended structure of artifact bodies for human review (mirrors E-11).
  out.push(
    `Return your work as ONE JSON report matching the packet's report_schema — {phase, status: "complete"|"blocked"|"partial", summary, files?: string[], tests_run?: [{command, pass, evidence?}], artifacts?: [{title, body, language?}]} — the ingest seam validates this exact shape.`,
  );
  // W52 / 338-5 (Product) + 339-5 (Packet): name the runnable acceptance
  // command, not just the report shape. Every export profile says "run the
  // oracle tests from the packet", but neither the packet nor this handoff
  // named a command or the oracle spec path — a fresh agent could not
  // self-check. Conditional on the project carrying oracle rows (the emitted
  // tree declares `test` exactly then). The spec path is the EMITTED contract
  // path (EMITTED_ORACLE_SPEC), not a spec-graph node's raw `file`.
  const oracleSpecPath = EMITTED_ORACLE_SPEC;
  out.push(
    Array.isArray(project.oracle) && project.oracle.length > 0
      ? `Verify before reporting, from the emitted tree root: run the tree's install and declared scripts in order (\`npm install\`, then \`npm run typecheck\`, then \`npm test\`) — \`npm test\` executes the emitted oracle spec (\`${oracleSpecPath}\`). Record each command you ran in the report's \`tests_run\`. A red run is not a bypass — patch and re-run.`
      : `No oracle rows are recorded for this project yet, so this edge has no runnable acceptance spec — the machine-checked DoD gate above is the exit signal.`,
  );
  // 335-3 (Transit): state the seam's ACTUAL acceptance rules, not just the
  // field shape — a report for another phase, or over the caps, is rejected.
  out.push(
    `The report's \`phase\` must be ${phase} (this edge); the seam accepts at most 12 artifacts, each body ≤ 50000 chars.`,
  );
  out.push(
    `The five markdown headings (Phase work / Files / Patch / Tests / Risks) remain the recommended structure of your artifacts' bodies for human review.`,
  );
  out.push(
    phase >= PHASE_LAST
      ? `Next legal edge: none — pipeline complete.`
      : `Next legal edge: only P${(phase + 1) as PhaseId} if this phase completes.`,
  );

  return out.join("\n");
}
